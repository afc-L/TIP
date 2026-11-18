// The player-controlled monster: controller, camera and procedural animation.
// Design rule: every physical action here originates from player input. Animation
// layers only *decorate* what the player is doing; nothing steers, moves, attacks or
// turns the camera on its own.
import * as THREE from 'three';
import { buildMonster } from './monsterModel.js';
import { clamp, damp, dampAngle, angleDiff, lerp, smooth } from '../core/util.js';

const L1 = 0.75, L2 = 0.7; // thigh, shin
const META = { y: 0.41, z: 0.10, ang: Math.atan2(-0.10, 0.41) };
const HALF_PI = Math.PI / 2;

// keyframe interpolation helper: ks = [[u, value], ...]
function kf(u, ks) {
  if (u <= ks[0][0]) return ks[0][1];
  for (let i = 1; i < ks.length; i++) {
    if (u <= ks[i][0]) { const a = ks[i - 1], b = ks[i]; const t = smooth((u - a[0]) / (b[0] - a[0])); return a[1] + (b[1] - a[1]) * t; }
  }
  return ks[ks.length - 1][1];
}

export class Monster {
  constructor(game, skin = 'pale') {
    this.game = game;
    this.model = buildMonster(skin);
    this.root = this.model.root; this.B = this.model.B;
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.yaw = 0; this.camYaw = 0; this.camPitch = 0.25;
    this.radius = 0.5; this.height = 2.5;
    this.onGround = true; this.climbing = false; this.crouch = false; this.crouchW = 0; this.sprintW = 0; this.airW = 0;
    this.stamina = 100; this.health = 100; this.hunger = 100;
    this.phase = 0; this.prevStance = [true, true];
    this.attack = null; this.attackCombo = 0; this.attackCooldown = 0;
    this.feeding = null; this.roarT = 0; this.interactT = 0; this.landSquash = 0; this.hurtT = 0;
    this.camDist = 4.6; this.firstPerson = false; this.camShake = 0;
    this.breathT = 2; this.exertion = 0; this.idleT = 0;
    this.footG = [0, 0]; this.lookYaw = 0; this.lookPitch = 0;
    this.speed = 0; this.moveInput = new THREE.Vector3();
    this.noiseLevel = 0; this.visibility = 1; this.stealthMul = 1;
    this.cur = {}; // smoothed bone rotations
    for (const k in this.B) this.cur[k] = [0, 0, 0];
    this.time = 0;
    this.camPos = new THREE.Vector3(); this.camTarget = new THREE.Vector3();
    this.speedMul = 1; this.jumpMul = 1; this.attackMul = 1;
    this.dead = false;
  }

  setSkin(key) {
    const old = this.root; const parent = old.parent; this.fpApplied = undefined;
    this.model = buildMonster(key); this.root = this.model.root; this.B = this.model.B;
    for (const k in this.B) this.cur[k] = [0, 0, 0];
    if (parent) { parent.remove(old); parent.add(this.root); }
  }

  place(p, yaw = 0) {
    this.pos.copy(p); this.vel.set(0, 0, 0); this.yaw = yaw; this.camYaw = yaw; this.camPitch = 0.2;
    this.root.position.copy(p); this.root.rotation.y = yaw;
    this.camPos.set(p.x - Math.sin(yaw) * 4, p.y + 3, p.z - Math.cos(yaw) * 4);
  }

  get forward() { return new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }
  get camForward() { return new THREE.Vector3(Math.sin(this.camYaw), 0, Math.cos(this.camYaw)); }
  headPos(out = new THREE.Vector3()) { return this.B.head.getWorldPosition(out); }
  chestPos(out = new THREE.Vector3()) { return this.B.chest.getWorldPosition(out); }

  damage(amount, from) {
    if (this.dead || this.game.godMode) return;
    this.health -= amount; this.hurtT = 0.6; this.camShake = Math.max(this.camShake, 0.25);
    this.game.audio.play('growl', this.headPos(), { vol: 0.6, dur: 0.6, pitch: 1.3 });
    if (this.health <= 0) { this.health = 0; this.dead = true; this.game.onMonsterDeath(); }
  }

  // ---------------------------------------------------------------- update
  update(dt, input, allowInput = true) {
    this.time += dt;
    const g = this.game, world = g.world;
    // --- look (mouse) ---
    if (allowInput) {
      const [mx, my] = input.consumeMouse();
      this.camYaw -= mx * 0.0022; this.camPitch = clamp(this.camPitch + my * 0.0022, -1.1, 1.2);
      if (input.hit('KeyV')) this.firstPerson = !this.firstPerson;
      if (input.wheel) this.camDist = clamp(this.camDist + input.wheel * 0.5, 2.6, 8);
    } else input.consumeMouse();

    // --- movement intent ---
    let fx = 0, fz = 0;
    if (allowInput && !this.dead) {
      if (input.down('KeyW')) fz += 1; if (input.down('KeyS')) fz -= 1;
      if (input.down('KeyA')) fx -= 1; if (input.down('KeyD')) fx += 1;
      if (input.hit('KeyC')) this.crouch = !this.crouch;
    }
    const holdCrouch = allowInput && (input.down('ControlLeft') || input.down('ControlRight'));
    let wantCrouch = this.crouch || holdCrouch;
    const cf = this.camForward, cr = new THREE.Vector3(-cf.z, 0, cf.x);
    // cr = (-cf.z, 0, cf.x) is screen-right for a camera looking along cf
    const move = new THREE.Vector3().addScaledVector(cf, fz).addScaledVector(cr, fx);
    const moving = move.lengthSq() > 0.01; if (moving) move.normalize();
    this.moveInput.copy(move);
    const wantSprint = allowInput && (input.down('ShiftLeft') || input.down('ShiftRight')) && moving && fz >= 0 && this.stamina > 2 && !wantCrouch;
    if (wantSprint) { wantCrouch = false; this.crouch = false; }

    // can't stand up under a low ceiling
    if (!wantCrouch && this.crouchW > 0.5) {
      const ceil = world.ceilingAt(this.pos.x, this.pos.z, this.pos.y + 1.5, this.radius);
      if (ceil < this.pos.y + this.height) wantCrouch = true;
    }
    this.crouchW = damp(this.crouchW, wantCrouch ? 1 : 0, 8, dt);
    this.sprintW = damp(this.sprintW, wantSprint ? 1 : 0, 5, dt);

    const feedSlow = this.feeding ? 0.35 : 1;
    const attackSlow = this.attack ? (this.attack.type === 'heavy' ? 0.55 : 0.8) : 1;
    let speed = (wantSprint ? 9.2 : wantCrouch ? 1.9 : 3.6) * this.speedMul * feedSlow * attackSlow;
    if (g.abilities && g.abilities.active.stalk) speed *= wantCrouch ? 2.2 : 1.25;
    const desired = move.clone().multiplyScalar(moving ? speed : 0);
    const accel = this.onGround ? (wantSprint ? 7 : 10) : 1.8;
    this.vel.x = damp(this.vel.x, desired.x, accel, dt);
    this.vel.z = damp(this.vel.z, desired.z, accel, dt);

    // stamina
    if (wantSprint) this.stamina -= 8.5 * dt; else if (!this.climbing) this.stamina = Math.min(100, this.stamina + (moving ? 13 : 20) * dt);
    this.exertion = clamp(this.exertion + (wantSprint ? dt * 0.25 : -dt * 0.08), 0, 1);

    // jumping / climbing
    const jumpHeld = allowInput && input.down('Space');
    if (allowInput && input.hit('Space') && this.onGround && !this.dead) {
      this.vel.y = 8.4 * this.jumpMul * (wantCrouch ? 0.8 : 1);
      if (wantSprint) { this.vel.x *= 1.15; this.vel.z *= 1.15; }
      this.onGround = false; this.crouch = false;
      g.emitNoise(this.pos, 10, 'jump');
      g.audio.play('breath', this.headPos(), { vol: 0.35, inhale: false, intensity: 1.5 });
    }

    // --- integrate horizontal ---
    const prevY = this.pos.y;
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
    const h = this.height * (1 - this.crouchW * 0.4);
    const hit = world.resolve(this.pos, this.radius, h, 0.6);
    // climbing: hold Space while pushing into a climbable surface
    this.climbing = false;
    if (hit && jumpHeld && moving && hit.obj.climbable !== false && this.stamina > 1) {
      const into = -(move.x * hit.nx + move.z * hit.nz);
      if (into > 0.35) {
        this.climbing = true; this.vel.y = 3.4; this.stamina -= 9 * dt;
        if (Math.random() < dt * 4) g.audio.play('scratch', this.pos.clone().setY(this.pos.y + 1), { vol: 0.25, dur: 0.3 });
      }
    }
    if (hit && !this.climbing) {
      // remove velocity into wall
      const vn = this.vel.x * hit.nx + this.vel.z * hit.nz;
      if (vn < 0) { this.vel.x -= vn * hit.nx; this.vel.z -= vn * hit.nz; }
    }

    // --- vertical ---
    if (!this.climbing) this.vel.y -= 24 * dt;
    this.pos.y += this.vel.y * dt;
    const gr = world.groundAt(this.pos.x, this.pos.z, Math.max(prevY, this.pos.y), this.radius * 0.8, 0.6);
    const wasGround = this.onGround;
    if (this.pos.y <= gr.y + 0.02 || (wasGround && this.vel.y <= 0 && this.pos.y - gr.y < 0.65)) {
      if (!wasGround && this.vel.y < -6) {
        const impact = clamp(-this.vel.y / 16, 0, 1);
        this.landSquash = Math.max(this.landSquash, impact); this.camShake = Math.max(this.camShake, impact * 0.35);
        g.audio.play('step', this.pos, { surface: gr.surface || g.surfaceAt(this.pos), heavy: 2, vol: 1.2 });
        g.emitNoise(this.pos, 8 + impact * 18, 'land');
      }
      this.pos.y = gr.y; if (this.vel.y < 0) this.vel.y = 0; this.onGround = true;
    } else this.onGround = false;
    if (this.vel.y > 0) {
      const ceil = world.ceilingAt(this.pos.x, this.pos.z, prevY + 0.5, this.radius * 0.7);
      if (this.pos.y + h > ceil) { this.pos.y = ceil - h; this.vel.y = Math.min(0, this.vel.y); }
    }
    if (this.pos.y < world.killY) { const sp = g.map.spawn; this.pos.copy(sp); this.vel.set(0, 0, 0); }
    g.map.clampBounds && g.map.clampBounds(this.pos);
    this.airW = damp(this.airW, this.onGround ? 0 : 1, 10, dt);

    // --- facing: body turns toward movement (or toward camera while attacking/feeding) ---
    const hs = Math.hypot(this.vel.x, this.vel.z); this.speed = hs;
    let targetYaw = this.yaw;
    if (this.attack || this.roarT > 0) targetYaw = this.camYaw;
    else if (moving && hs > 0.3) targetYaw = Math.atan2(move.x, move.z);
    else if (this.feeding) targetYaw = this.camYaw;
    const prevYaw = this.yaw;
    this.yaw = dampAngle(this.yaw, targetYaw, this.attack ? 16 : wantSprint ? 7 : 10, dt);
    this.turnRate = angleDiff(prevYaw, this.yaw) / Math.max(dt, 1e-4);

    // --- actions ---
    if (allowInput && !this.dead) this.actions(dt, input);
    if (this.attack) this.updateAttack(dt);
    this.attackCooldown -= dt;
    if (this.roarT > 0) this.roarT -= dt;
    if (this.interactT > 0) this.interactT -= dt;
    if (this.ripT > 0) this.ripT -= dt;
    if (this.bloody > 0) { this.bloody = Math.max(0, this.bloody - dt * 0.008); if (Math.random() < dt * this.bloody * 4) { const mp = this.headPos(); mp.y -= 0.15; mp.addScaledVector(this.forward, 0.15); this.game.fx.bloodDrip(mp, 1); } }
    this.landSquash = Math.max(0, this.landSquash - dt * 2.5);
    this.hurtT = Math.max(0, this.hurtT - dt);

    // --- noise emitted (for NPC hearing) ---
    this.noiseLevel = this.sprintW > 0.5 ? 22 : this.crouchW > 0.5 ? 1.5 : hs > 0.5 ? 7 : 0;
    if (g.abilities && g.abilities.active.stalk) this.noiseLevel *= 0.35;
    this.visibility = (1 - this.crouchW * 0.45) * this.stealthMul;

    // --- survival meters ---
    const hungerRate = g.mode === 'survival' ? 0.75 : g.mode === 'free' ? 0.18 : 0.3;
    this.hunger = Math.max(0, this.hunger - hungerRate * dt);
    if (this.hunger <= 0) this.damage(dt * 1.5);
    else if (this.hunger > 50 && this.health < 100) this.health = Math.min(100, this.health + dt * 1.2);

    // --- breathing (purely audio) ---
    this.breathT -= dt;
    if (this.breathT <= 0) {
      const heavy = this.exertion > 0.3;
      this.breathInhale = !this.breathInhale;
      g.audio.play('breath', this.headPos(), { vol: heavy ? 0.45 : 0.22, inhale: this.breathInhale, intensity: heavy ? 1.6 : 0.8 });
      this.breathT = heavy ? 0.65 : this.breathInhale ? 1.4 : 2.4;
    }

    this.animate(dt);
    this.updateCamera(dt);
  }

  actions(dt, input) {
    const g = this.game;
    // attacks
    if (input.btnHit(0) && !this.feeding && (!this.attack || this.attack.t > this.attack.dur * 0.6) && this.attackCooldown <= 0) {
      this.attackCombo = (this.attackCombo + 1) % 3;
      const variant = this.attackCombo === 2 ? 'rake' : this.attackCombo === 1 ? 'swipeL' : 'swipeR';
      this.startAttack(variant);
    }
    if (input.btnHit(2) && !this.feeding && !this.attack && this.attackCooldown <= 0) this.startAttack(this.sprintW > 0.5 ? 'pounce' : 'heavy');
    // feeding (hold F)
    if (input.down('KeyF')) {
      if (!this.feeding) { const t = g.combat.findFeedTarget(); if (t) this.feeding = g.combat.startFeed(t); }
    } else if (this.feeding) { g.combat.cancelFeed(this.feeding); this.feeding = null; }
    if (this.feeding) {
      const done = g.combat.updateFeed(this.feeding, dt);
      if (done !== null) this.feeding = null;
    }
    // interact
    if (input.hit('KeyE')) { if (g.interact()) this.interactT = 0.6; }
  }

  startAttack(type) {
    const durs = { swipeR: 0.55, swipeL: 0.55, rake: 0.7, heavy: 0.95, pounce: 0.8 };
    const dur = durs[type] / this.attackMul;
    this.attack = { type, t: 0, dur, hitDone: false };
    const hp = this.headPos();
    if (type === 'heavy' || type === 'pounce') {
      this.game.audio.play('growl', hp, { vol: 0.7, dur: 0.8, pitch: 1.1 });
      if (type === 'pounce') { const f = this.camForward; this.vel.x += f.x * 7; this.vel.z += f.z * 7; this.vel.y = Math.max(this.vel.y, 4); this.onGround = false; }
    }
    this.game.emitNoise(this.pos, 12, 'attack');
  }

  updateAttack(dt) {
    const A = this.attack; A.t += dt;
    const u = A.t / A.dur;
    const hitAt = { swipeR: 0.42, swipeL: 0.42, rake: 0.5, heavy: 0.5, pounce: 0.45 }[A.type];
    if (!A.whoosh && u > hitAt - 0.15) { A.whoosh = true; this.game.audio.play('swipe', this.chestPos(), { vol: 0.8, pitch: A.type === 'heavy' ? 0.6 : 1 }); }
    if (!A.hitDone && u >= hitAt) {
      A.hitDone = true;
      this.game.combat.resolveAttack(A.type);
      if (A.type === 'heavy') { this.camShake = Math.max(this.camShake, 0.3); this.game.audio.play('impact', this.pos, { vol: 0.6, heavy: 1.4 }); this.game.emitNoise(this.pos, 18, 'slam'); }
    }
    if (A.t >= A.dur) { this.attack = null; this.attackCooldown = 0.08; }
  }

  // ---------------------------------------------------------------- animation
  animate(dt) {
    const B = this.B, w = this.game.world;
    this.root.position.copy(this.pos); this.root.rotation.y = this.yaw;
    const sp = this.speed;
    const walkW = clamp(sp / 3.6, 0, 1);
    const sprint = this.sprintW, crouch = this.crouchW, air = this.airW;
    // gait phase advances with distance travelled (feet don't slide)
    const cycle = lerp(lerp(1.9, 1.3, crouch), 3.8, sprint);
    this.phase = (this.phase + (sp * dt) / cycle + Math.abs(this.turnRate) * dt * 0.08) % 1;
    if (sp < 0.15 && Math.abs(this.turnRate) < 0.3) this.phase = damp(this.phase, this.phase < 0.25 ? 0 : this.phase < 0.75 ? 0.5 : 1, 4, dt) % 1;
    const ph = this.phase * Math.PI * 2;
    const t = this.time;
    const breath = Math.sin(t * (1.3 + this.exertion * 2)) * (0.5 + this.exertion);

    // ---- base posture targets (radians) ----
    const T = {};
    const set = (k, x = 0, y = 0, z = 0) => { T[k] = [x, y, z]; };
    const addT = (k, x = 0, y = 0, z = 0) => { const a = T[k] || (T[k] = [0, 0, 0]); a[0] += x; a[1] += y; a[2] += z; };
    const hipsPitch = 0.12 + crouch * 0.35 + sprint * 0.55 + walkW * 0.06;
    set('hips', hipsPitch, -Math.sin(ph) * 0.08 * walkW, 0);
    set('spine1', 0.22 + crouch * 0.15 + sprint * 0.12 + breath * 0.01, 0, 0);
    set('spine2', 0.22 + crouch * 0.12 + sprint * 0.1, Math.sin(ph) * 0.06 * walkW, 0);
    set('chest', 0.18 + crouch * 0.1 + sprint * 0.08 - breath * 0.02, Math.sin(ph) * 0.1 * walkW, Math.sin(ph) * 0.04 * walkW);
    set('neck1', 0.45, 0, 0); set('neck2', 0.1, 0, 0);
    let headWorld = 0.15 - sprint * 0.05; // desired head pitch relative to root
    let jaw = 0.04 + Math.max(0, breath) * 0.03 + this.exertion * 0.12;

    // look direction: head follows camera within limits (cosmetic, never the other way around)
    const ly = clamp(angleDiff(this.yaw, this.camYaw), -1.1, 1.1);
    this.lookYaw = damp(this.lookYaw, ly, 6, dt); this.lookPitch = damp(this.lookPitch, this.camPitch, 6, dt);
    addT('neck2', 0, this.lookYaw * 0.35, 0);
    headWorld += this.lookPitch * 0.55;

    // arms: computed in "world pitch" then converted relative to chest
    let armL = { x: -0.08, z: 0.12, fore: -0.35, hand: -0.15, curl: 0.35, spread: 0 };
    let armR = { x: -0.08, z: -0.12, fore: -0.35, hand: -0.15, curl: 0.35, spread: 0 };
    // walking swing
    const swing = Math.sin(ph) * 0.45 * walkW * (1 - sprint);
    armL.x += swing; armR.x -= swing;
    // sprint: gallop — arms reach far forward and claw back
    if (sprint > 0.01) {
      const aL = Math.sin(ph + 0.6), aR = Math.sin(ph + 0.6 + Math.PI * 0.85);
      armL.x = lerp(armL.x, -0.6 - aL * 0.9 - (1 - hipsPitch), sprint); armR.x = lerp(armR.x, -0.6 - aR * 0.9 - (1 - hipsPitch), sprint);
      armL.fore = lerp(armL.fore, -0.2 + Math.max(0, aL) * -0.6, sprint); armR.fore = lerp(armR.fore, -0.2 + Math.max(0, aR) * -0.6, sprint);
      armL.curl = armR.curl = lerp(0.35, 0.7, sprint);
    }
    // crouch: arms reach forward to the ground, creeping
    if (crouch > 0.01) {
      const c = Math.sin(ph) * 0.35 * walkW;
      armL.x = lerp(armL.x, -0.75 + c, crouch); armR.x = lerp(armR.x, -0.75 - c, crouch);
      armL.fore = lerp(armL.fore, -0.6, crouch); armR.fore = lerp(armR.fore, -0.6, crouch);
      armL.z = lerp(armL.z, 0.3, crouch); armR.z = lerp(armR.z, -0.3, crouch);
      headWorld += crouch * 0.1;
    }
    // airborne
    if (air > 0.01) {
      armL.x = lerp(armL.x, -0.9, air); armR.x = lerp(armR.x, -0.9, air); armL.z = lerp(armL.z, 0.7, air); armR.z = lerp(armR.z, -0.7, air);
      armL.curl = lerp(armL.curl, 0.05, air); armR.curl = lerp(armR.curl, 0.05, air);
    }
    if (this.climbing) {
      const c = Math.sin(t * 9);
      armL.x = -2.4 + c * 0.4; armR.x = -2.4 - c * 0.4; armL.fore = armR.fore = -0.5; armL.curl = armR.curl = 0.8;
    }

    // ---- action overlays ----
    const A = this.attack;
    if (A) {
      const u = A.t / A.dur;
      if (A.type === 'swipeR' || A.type === 'swipeL' || A.type === 'rake') {
        const sides = A.type === 'rake' ? ['L', 'R'] : [A.type === 'swipeR' ? 'R' : 'L'];
        for (const side of sides) {
          const s = side === 'L' ? 1 : -1; const arm = side === 'L' ? armL : armR;
          const off = A.type === 'rake' && side === 'R' ? 0.12 : 0;
          const uu = clamp(u - off, 0, 1);
          arm.x = kf(uu, [[0, arm.x], [0.3, -1.1], [0.5, -1.55], [0.7, -1.2], [1, arm.x]]);
          arm.z = kf(uu, [[0, arm.z], [0.3, s * 1.5], [0.5, s * -0.2], [0.65, s * -0.5], [1, arm.z]]);
          arm.fore = kf(uu, [[0, arm.fore], [0.3, -1.3], [0.5, -0.15], [1, arm.fore]]);
          arm.curl = kf(uu, [[0, 0.3], [0.3, -0.2], [0.5, 0.0], [0.7, 0.7], [1, 0.35]]);
          if (A.type !== 'rake') addT('chest', 0, kf(uu, [[0, 0], [0.3, s * 0.55], [0.55, -s * 0.5], [1, 0]]), 0);
        }
        if (A.type === 'rake') addT('chest', kf(u, [[0, 0], [0.35, -0.3], [0.55, 0.35], [1, 0]]), 0, 0);
        jaw = Math.max(jaw, kf(u, [[0, 0], [0.4, 0.55], [1, 0]]));
      } else if (A.type === 'heavy' || A.type === 'pounce') {
        for (const [arm, s] of [[armL, 1], [armR, -1]]) {
          arm.x = kf(u, [[0, arm.x], [0.4, -2.9], [0.55, -0.7], [0.75, -0.6], [1, arm.x]]);
          arm.z = kf(u, [[0, arm.z], [0.4, s * 0.5], [0.55, s * 0.15], [1, arm.z]]);
          arm.fore = kf(u, [[0, arm.fore], [0.4, -1.0], [0.55, -0.2], [1, arm.fore]]);
          arm.curl = kf(u, [[0, 0.3], [0.4, -0.25], [0.55, 0.8], [1, 0.35]]);
        }
        addT('chest', kf(u, [[0, 0], [0.4, -0.55], [0.55, 0.55], [0.8, 0.3], [1, 0]]), 0, 0);
        addT('spine2', kf(u, [[0, 0], [0.4, -0.3], [0.55, 0.3], [1, 0]]), 0, 0);
        headWorld += kf(u, [[0, 0], [0.4, -0.5], [0.55, 0.3], [1, 0]]);
        jaw = Math.max(jaw, kf(u, [[0, 0], [0.4, 0.9], [0.6, 0.5], [1, 0]]));
      }
    }
    if (this.feeding) {
      const f = this.feeding.blend = Math.min(1, (this.feeding.blend || 0) + dt * 3);
      if (this.game.settings.gore !== 'reduced') {
        // holding someone up in both hands at chest height; yanks on each rip; bites
        const rip = this.ripT > 0 ? Math.sin((1 - this.ripT / 0.4) * Math.PI) : 0; const side = this.ripSide || 1;
        for (const [arm, s] of [[armL, 1], [armR, -1]]) {
          const yank = rip * (s === side ? 1 : 0.25);
          arm.x = lerp(arm.x, -1.25 + yank * 0.5, f); arm.z = lerp(arm.z, s * (-0.15 + yank * 1.3), f);
          arm.fore = lerp(arm.fore, -0.9 + yank * 0.6, f); arm.curl = lerp(arm.curl, 0.95, f);
        }
        addT('chest', (-0.15 + rip * 0.15) * f, rip * side * 0.4 * f, 0); addT('spine2', -0.15 * f, 0, 0);
        headWorld += (0.35 + Math.max(0, Math.sin(t * 6)) * 0.25) * f;
        jaw = Math.max(jaw, f * (0.5 + Math.max(0, Math.sin(t * 6)) * 0.55));
      } else {
        const pulse = Math.sin(t * 7);
        for (const [arm, s] of [[armL, 1], [armR, -1]]) { arm.x = lerp(arm.x, -1.0 + pulse * 0.05, f); arm.fore = lerp(arm.fore, -0.7, f); arm.z = lerp(arm.z, s * 0.35, f); arm.curl = lerp(arm.curl, 0.9, f); }
        addT('chest', 0.35 * f + pulse * 0.06 * f, 0, 0); addT('neck1', 0.25 * f, 0, 0);
        headWorld += 0.55 * f;
        jaw = Math.max(jaw, f * (0.45 + Math.max(0, Math.sin(t * 5)) * 0.45));
      }
    }
    if (this.roarT > 0) {
      const u = 1 - this.roarT / 2.6; const r = kf(u, [[0, 0], [0.12, 1], [0.8, 1], [1, 0]]);
      const trem = Math.sin(t * 40) * 0.03 * r;
      armL.x = lerp(armL.x, -0.6 + trem, r); armR.x = lerp(armR.x, -0.6 - trem, r); armL.z = lerp(armL.z, 1.25, r); armR.z = lerp(armR.z, -1.25, r);
      armL.curl = lerp(armL.curl, -0.3, r); armR.curl = lerp(armR.curl, -0.3, r); armL.fore = lerp(armL.fore, -0.6, r); armR.fore = lerp(armR.fore, -0.6, r);
      addT('chest', -0.55 * r, 0, 0); addT('spine2', -0.25 * r, 0, 0); headWorld -= 0.7 * r; jaw = Math.max(jaw, r * 1.0 + trem);
    }
    if (this.interactT > 0) {
      const r = Math.sin((1 - this.interactT / 0.6) * Math.PI);
      armR.x = lerp(armR.x, -1.4, r); armR.fore = lerp(armR.fore, -0.2, r); armR.curl = lerp(armR.curl, 0.1, r);
    }
    if (this.hurtT > 0) { const r = this.hurtT / 0.6; addT('chest', -0.3 * r, 0, Math.sin(t * 30) * 0.05 * r); }

    // ---- convert arm "world pitch" targets into chest-relative joint angles ----
    const chestCum = T.hips[0] + T.spine1[0] + T.spine2[0] + T.chest[0];
    for (const [side, arm, s] of [['L', armL, 1], ['R', armR, -1]]) {
      set('shoulder' + side, 0, 0, s * 0.05);
      set('upperArm' + side, arm.x - chestCum, 0, arm.z);
      set('foreArm' + side, arm.fore, 0, 0);
      set('hand' + side, arm.hand, 0, 0);
      arm.curlFinal = arm.curl;
    }
    const neckCum = chestCum + T.neck1[0] + T.neck2[0];
    set('head', headWorld - neckCum, this.lookYaw * 0.55, 0);
    set('jaw', clamp(jaw, 0, 1.1), 0, 0);

    // ---- apply with smoothing ----
    const rate = this.attack ? 22 : 12;
    for (const k in T) {
      const b = B[k]; if (!b) continue; const c = this.cur[k] || (this.cur[k] = [0, 0, 0]);
      c[0] = damp(c[0], T[k][0], rate, dt); c[1] = damp(c[1], T[k][1], rate, dt); c[2] = damp(c[2], T[k][2], rate, dt);
      b.rotation.set(c[0], c[1], c[2]);
    }
    // chest breathing scale
    B.chest.scale.set(1 + breath * 0.015, 1, 1 + breath * 0.02);
    // fingers
    for (const [side, arm] of [['L', armL], ['R', armR]]) {
      const fl = B['fingers' + side]; const ck = 'curl' + side;
      this.cur[ck] = damp(this.cur[ck] || 0, arm.curlFinal, 14, dt);
      fl.forEach((segs, i) => segs.forEach((sg, k) => { sg.rotation.x = -this.cur[ck] * (k === 0 ? 0.6 : 1) * (i === 4 ? 0.5 : 1) - Math.sin(t * 0.7 + i) * 0.03; }));
    }

    // ---- hips height + leg IK ----
    const hipsY = 1.62 - crouch * 0.55 - sprint * 0.12 - this.landSquash * 0.35 - Math.abs(Math.cos(ph)) * 0.05 * walkW + air * 0.05 + (sp < 0.2 ? breath * 0.01 : 0);
    B.hips.position.y = damp(B.hips.position.y, hipsY, 14, dt);
    const stanceFrac = lerp(0.62, 0.42, sprint);
    const strideHalf = (cycle * stanceFrac) / 2;
    const cosY = Math.cos(this.yaw), sinY = Math.sin(this.yaw);
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? 'L' : 'R', s = i === 0 ? 1 : -1;
      const lp = (this.phase + (i === 0 ? 0 : 0.5)) % 1;
      let fz, fy = 0;
      const moveAmt = clamp(sp / 1.2 + Math.abs(this.turnRate) * 0.3, 0, 1);
      if (lp < stanceFrac) { const u = lp / stanceFrac; fz = strideHalf * (1 - 2 * u); }
      else { const u = (lp - stanceFrac) / (1 - stanceFrac); fz = -strideHalf + 2 * strideHalf * smooth(u); fy = Math.sin(u * Math.PI) * lerp(0.22, 0.45, sprint) * moveAmt; }
      fz *= moveAmt;
      fz += 0.18 + crouch * 0.1;
      let fx = s * (0.2 + crouch * 0.08);
      // ground under this foot
      const wx = this.pos.x + fx * cosY + fz * sinY, wz = this.pos.z - fx * sinY + fz * cosY;
      let gy = 0;
      if (this.onGround) gy = clamp(w.groundAt(wx, wz, this.pos.y + 0.5, 0.05, 0.6).y - this.pos.y, -0.5, 0.5);
      this.footG[i] = damp(this.footG[i], gy, 15, dt);
      fy += this.footG[i];
      if (air > 0.01) { fy = lerp(fy, 0.55 + (i ? 0.1 : 0), air); fz = lerp(fz, 0.35 + (i ? -0.25 : 0.1), air); }
      if (this.climbing) { fy = 0.6 + Math.sin(t * 9 + i * Math.PI) * 0.25; fz = 0.4; }
      // stance footsteps
      const inStance = lp < stanceFrac;
      if (inStance && !this.prevStance[i] && this.onGround && sp > 0.4) {
        const fp = new THREE.Vector3(wx, this.pos.y, wz);
        const surf = this.game.surfaceAt(fp);
        const heavy = sprint > 0.5 ? 1.6 : crouch > 0.5 ? 0.35 : 1;
        this.game.audio.play('step', fp, { surface: surf, heavy, vol: crouch > 0.5 ? 0.25 : sprint > 0.5 ? 1.1 : 0.75 });
        if (this.noiseLevel > 0) this.game.emitNoise(fp, this.noiseLevel, 'step');
        if (sprint > 0.5) this.camShake = Math.max(this.camShake, 0.06);
        this.game.fx && this.game.fx.footDust(fp, surf, heavy);
      }
      this.prevStance[i] = inStance;
      // IK in the sagittal plane (root space). Hip joint:
      const hy = B.hips.position.y - 0.04, hz = 0;
      const ay = fy + META.y, az = fz - META.z;
      let dy = ay - hy, dz = az - hz; let d = Math.hypot(dy, dz);
      d = Math.min(d, L1 + L2 - 0.005);
      const thHA = Math.atan2(-dz, -dy);
      const alpha = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
      const thThigh = thHA - alpha;
      const ky = hy - Math.cos(thThigh) * L1, kz = hz - Math.sin(thThigh) * L1;
      const thShin = Math.atan2(-(az - kz), -(ay - ky));
      const thMeta = META.ang;
      const hp = this.cur.hips[0];
      B['thigh' + side].rotation.set(thThigh - hp, 0, s * 0.04);
      B['shin' + side].rotation.set(thShin - thThigh, 0, 0);
      B['meta' + side].rotation.set(thMeta - thShin, 0, 0);
      B['foot' + side].rotation.set(-thMeta + (air > 0.5 ? 0.6 : 0), 0, 0);
    }
  }

  // In first person only the arms and hands stay visible (so strikes and feeding read),
  // everything else would fill the screen. Shadows are still cast by the full body.
  applyFirstPersonVisibility() {
    this.fpApplied = this.firstPerson;
    const keep = new Set();
    for (const k of ['foreArmL', 'foreArmR']) this.B[k].traverse((o) => keep.add(o));
    this.root.traverse((o) => {
      if (!o.isMesh) return;
      if (!o.userData.origMat) o.userData.origMat = o.material;
      if (this.firstPerson && !keep.has(o)) o.material = o.userData.fpMat || (o.userData.fpMat = Object.assign(o.userData.origMat.clone(), { colorWrite: false, depthWrite: false }));
      else o.material = o.userData.origMat;
    });
  }

  // ---------------------------------------------------------------- camera
  updateCamera(dt) {
    const cam = this.game.camera, w = this.game.world;
    const p = this.pos;
    const eyeH = lerp(2.75, 1.8, this.crouchW);
    const target = this.camTarget.set(p.x, p.y + eyeH, p.z);
    const cp = Math.cos(this.camPitch), spt = Math.sin(this.camPitch);
    const fwd = new THREE.Vector3(Math.sin(this.camYaw) * cp, -spt, Math.cos(this.camYaw) * cp);
    let camPos;
    if (this.fpApplied !== this.firstPerson) this.applyFirstPersonVisibility();
    if (this.firstPerson) {
      const hp = this.headPos(); camPos = hp.addScaledVector(fwd, 0.25); camPos.y += 0.1;
      this.camPos.copy(camPos);
    } else {
      const right = new THREE.Vector3(-Math.cos(this.camYaw), 0, Math.sin(this.camYaw));
      const dist = this.camDist + this.sprintW * 0.8;
      const desired = target.clone().addScaledVector(fwd, -dist).addScaledVector(right, 0.95);
      // pull in if blocked
      const dir = desired.clone().sub(target); const len = dir.length(); dir.divideScalar(len);
      const hitD = w.raycast(target.x, target.y, target.z, dir.x, dir.y, dir.z, len + 0.3);
      const d = Math.max(0.4, Math.min(len, hitD - 0.3));
      camPos = target.clone().addScaledVector(dir, d);
      const gy = w.terrain(camPos.x, camPos.z) + 0.3; if (camPos.y < gy) camPos.y = gy;
      // smooth only along the arm so look input stays 1:1 responsive
      this.camPos.lerp(camPos, 1 - Math.exp(-dt * 25));
      if (d < this.camPos.distanceTo(target)) this.camPos.copy(camPos);
    }
    cam.position.copy(this.camPos);
    if (this.camShake > 0) {
      const s = this.camShake * 0.12; cam.position.x += (Math.random() - 0.5) * s; cam.position.y += (Math.random() - 0.5) * s; cam.position.z += (Math.random() - 0.5) * s;
      this.camShake = Math.max(0, this.camShake - dt * 1.5);
    }
    const look = this.firstPerson ? cam.position.clone().add(fwd) : this.camPos.clone().add(fwd);
    cam.up.set(0, 1, 0); cam.lookAt(look);
    const baseFov = this.game.settings.fov || 70;
    cam.fov = damp(cam.fov, baseFov + this.sprintW * 8, 5, dt); cam.updateProjectionMatrix();
  }
}
