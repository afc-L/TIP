import * as THREE from 'three';
import { clamp, damp, lerp, rand } from './util.js';

// First-person controller + survival stats.

export class Player {
  constructor(game) {
    this.game = game;
    this.pos = new THREE.Vector3(0, 0, 0); // feet
    this.vel = new THREE.Vector3();
    this.vy = 0;
    this.yaw = 0; this.pitch = 0;
    this.radius = 0.38;
    this.eye = 1.68;
    this.crouch = false;
    this.eyeCur = 1.68;
    this.grounded = true;
    this.surface = 'grass';
    this.onSurfaceKind = null;
    this.stride = 0;
    this.bob = 0;
    this.speed = 0;
    this.noise = 0; // how loud the player currently is (metres of hearing radius)
    this.stats = { health: 100, hunger: 85, stamina: 100, fear: 0, battery: 100 };
    this.exhausted = false;
    this.dead = false;
    this.climb = null; // ladder animation
    this.recoil = 0;
    this.trauma = 0;
    this.knock = new THREE.Vector3();
    this.indoors = false;
    this.inWater = false;
    this.lastHurt = -99;
    this.sinceSprint = 99;
  }

  get eyePos() { return new THREE.Vector3(this.pos.x, this.pos.y + this.eyeCur, this.pos.z); }

  forward(out = new THREE.Vector3()) {
    return out.set(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
  }

  teleport(x, z, yaw = this.yaw) {
    const w = this.game.world;
    this.pos.set(x, w.groundAt(x, z).y, z);
    this.vy = 0;
    this.yaw = yaw;
    this.pitch = 0;
  }

  look(dx, dy, sens, invert, zoomFactor) {
    const s = sens * 0.0022 * zoomFactor;
    this.yaw -= dx * s;
    this.pitch -= dy * s * (invert ? -1 : 1);
    this.pitch = clamp(this.pitch, -1.45, 1.45);
  }

  hurt(amount, fromX, fromZ, knock = 0) {
    if (this.dead || this.game.godMode) return;
    this.stats.health -= amount;
    this.trauma = Math.min(1, this.trauma + amount / 40);
    this.lastHurt = this.game.time;
    if (knock && fromX !== undefined) {
      const dx = this.pos.x - fromX, dz = this.pos.z - fromZ;
      const d = Math.hypot(dx, dz) || 1;
      this.knock.set((dx / d) * knock, 0, (dz / d) * knock);
      this.vy = 3;
    }
    this.game.audio.hurt();
    this.game.ui.damageFlash(amount);
    if (this.stats.health <= 0) {
      this.stats.health = 0;
      this.dead = true;
      this.game.onPlayerDeath();
    }
  }

  update(dt, input, settings) {
    const g = this.game;
    const w = g.world;
    const st = this.stats;
    if (this.dead) return;

    if (this.climb) { this.updateClimb(dt); this.updateStats(dt, false); return; }

    // movement intent
    let mx = 0, mz = 0;
    const canMove = g.state === 'play' && !g.ui.modalOpen;
    if (canMove) {
      if (input.down('KeyW')) mz -= 1;
      if (input.down('KeyS')) mz += 1;
      if (input.down('KeyA')) mx -= 1;
      if (input.down('KeyD')) mx += 1;
      if (input.hit('KeyC') || input.hit('ControlLeft')) this.crouch = !this.crouch;
    }
    const moving = mx !== 0 || mz !== 0;
    const len = Math.hypot(mx, mz) || 1;
    mx /= len; mz /= len;
    const wantSprint = canMove && input.down('ShiftLeft') && mz < 0 && !this.crouch && !g.equip.aiming;
    const sprint = wantSprint && moving && !this.exhausted && st.stamina > 0;
    let speed = this.crouch ? 1.7 : sprint ? 6.2 : 3.3;
    if (g.equip.aiming) speed *= 0.5;
    if (st.health < 25) speed *= 0.82;
    if (this.inWater) speed *= 0.55;
    if (st.hunger <= 0) speed *= 0.85;
    // rotate intent by yaw
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const wx = (mx * cos + mz * sin) * speed;
    const wz = (-mx * sin + mz * cos) * speed;
    const accel = this.grounded ? 12 : 2.5;
    this.vel.x = damp(this.vel.x, moving ? wx : 0, accel, dt);
    this.vel.z = damp(this.vel.z, moving ? wz : 0, accel, dt);
    // knockback
    this.vel.x += this.knock.x; this.vel.z += this.knock.z;
    this.knock.multiplyScalar(0);

    // jump / gravity
    if (canMove && input.hit('Space') && this.grounded && st.stamina > 8) {
      this.vy = 5.0;
      this.grounded = false;
      st.stamina -= 8;
      if (this.crouch) this.crouch = false;
    }
    this.vy -= 18 * dt;

    const prev = this.pos.clone();
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this.pos.y += this.vy * dt;

    // deep water is a wall
    if (w.heightAt(this.pos.x, this.pos.z) < w.waterLevel - 1.0 && !this.onDock()) {
      this.pos.x = prev.x; this.pos.z = prev.z;
      this.vel.x *= -0.2; this.vel.z *= -0.2;
    }
    const headY = this.pos.y + this.eyeCur + 0.1;
    w.collide(this.pos, this.radius, this.pos.y, headY);

    const ground = w.groundAt(this.pos.x, this.pos.z, this.pos.y);
    if (this.pos.y <= ground.y) {
      if (!this.grounded && this.vy < -11) {
        this.hurt(Math.round((-this.vy - 11) * 6));
      }
      if (!this.grounded && this.vy < -4) g.audio.footstep(this.surface, 1.4);
      this.pos.y = ground.y;
      this.vy = 0;
      this.grounded = true;
    } else if (this.pos.y > ground.y + 0.3) {
      this.grounded = false;
    } else if (this.grounded) {
      // stick to ground going downhill
      this.pos.y = ground.y;
      this.vy = 0;
    }
    this.onSurfaceKind = ground.kind;
    this.inWater = !ground.kind && w.inWater(this.pos.x, this.pos.z);
    this.surface = this.inWater ? 'water' : w.surfaceKind(this.pos.x, this.pos.z, ground.kind);
    this.indoors = ground.kind === 'wood' && g.isUnderRoof(this.pos);

    // footsteps + head bob
    const hs = Math.hypot(this.vel.x, this.vel.z);
    this.speed = hs;
    if (this.grounded && hs > 0.5) {
      this.stride += hs * dt;
      const strideLen = sprint ? 1.25 : this.crouch ? 0.7 : 0.85;
      if (this.stride > strideLen) {
        this.stride = 0;
        const vol = this.crouch ? 0.35 : sprint ? 1.2 : 0.75;
        g.audio.footstep(this.surface, vol);
      }
      this.bob += hs * dt * (sprint ? 1.6 : 1.9);
    } else {
      this.bob = damp(this.bob, Math.round(this.bob / Math.PI) * Math.PI, 6, dt);
    }
    this.noise = !moving ? 0 : this.crouch ? 6 : sprint ? 45 : 20;
    if (this.surface === 'gravel' || this.surface === 'wood') this.noise *= 1.3;

    // crouch eye height
    this.eyeCur = damp(this.eyeCur, this.crouch ? 1.1 : this.eye, 10, dt);
    this.updateStats(dt, sprint);
    this.sinceSprint = sprint ? 0 : this.sinceSprint + dt;
    this.recoil = damp(this.recoil, 0, 8, dt);
    this.trauma = Math.max(0, this.trauma - dt * 0.8);
  }

  onDock() {
    const k = this.game.world.groundAt(this.pos.x, this.pos.z, this.pos.y + 0.2).kind;
    return k === 'wood';
  }

  updateStats(dt, sprint) {
    const st = this.stats;
    const g = this.game;
    if (sprint) {
      st.stamina -= 16 * dt;
      if (st.stamina <= 0) { st.stamina = 0; this.exhausted = true; }
    } else {
      st.stamina = Math.min(100, st.stamina + (this.speed < 0.5 ? 16 : 10) * dt * (st.hunger > 15 ? 1 : 0.5));
      if (this.exhausted && st.stamina > 30) this.exhausted = false;
    }
    // hunger drains over game time (≈ 2.4 per game hour)
    const gh = dt * g.env.timeScale;
    st.hunger = Math.max(0, st.hunger - gh * (sprint ? 3.6 : 2.4));
    if (st.hunger <= 0) {
      if (g.time - this.lastHurt > 6) this.hurt(2);
    } else if (st.hunger > 45 && g.time - this.lastHurt > 8 && st.health < 100) {
      st.health = Math.min(100, st.health + dt * 0.35);
    }
    if (this.exhausted && rand() < dt * 0.8) g.audio.breathing(0.8);
  }

  startClimb(from, to, onDone) {
    this.climb = { from: from.clone(), to: to.clone(), t: 0, onDone };
    this.vel.set(0, 0, 0);
  }

  updateClimb(dt) {
    const c = this.climb;
    c.t += dt / 2.2;
    const k = Math.min(1, c.t);
    const e = k * k * (3 - 2 * k);
    this.pos.lerpVectors(c.from, c.to, e);
    // step up/down rung by rung
    if (Math.floor(c.t * 12) !== Math.floor((c.t - dt / 2.2) * 12)) this.game.audio.footstep('wood', 0.6);
    this.bob += dt * 6;
    if (k >= 1) {
      this.climb = null;
      this.vy = 0;
      this.grounded = true;
      c.onDone?.();
    }
  }

  applyCamera(camera, t, zoomFov, baseFov) {
    const bobAmt = this.climb ? 0.02 : Math.min(this.speed / 6, 1) * (this.game.equip.aiming ? 0.15 : 1);
    const by = Math.abs(Math.sin(this.bob)) * 0.055 * bobAmt;
    const bx = Math.cos(this.bob) * 0.03 * bobAmt;
    const shake = this.trauma * this.trauma;
    const fear = Math.max(0, this.stats.fear - 0.5) * 0.4;
    const sx = (Math.sin(t * 37) + Math.sin(t * 23.1)) * 0.012 * (shake + fear * 0.3);
    const sy = (Math.sin(t * 31) + Math.sin(t * 17.3)) * 0.012 * (shake + fear * 0.3);
    camera.position.set(this.pos.x + bx * Math.cos(this.yaw), this.pos.y + this.eyeCur + by, this.pos.z - bx * Math.sin(this.yaw));
    camera.rotation.order = 'YXZ';
    camera.rotation.y = this.yaw + sx;
    camera.rotation.x = this.pitch + this.recoil + sy;
    camera.rotation.z = bx * 0.15 + sx * 0.5;
    const fov = lerp(baseFov, zoomFov, 1);
    if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  }
}
