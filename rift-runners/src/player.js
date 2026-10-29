import { PLAYER_BASE } from './config.js';
import { buildPlayerModel } from './models.js';

export class Player {
  constructor(scene) {
    this.scene = scene;
    this.model = buildPlayerModel();
    scene.add(this.model.group);
    this.radius = PLAYER_BASE.radius;
    this.trailColor = '#3be6ff';
    this.lookKey = '';
    this.reset(100);
  }

  // Rebuild the model when class colours or cosmetics change.
  setLook(cloak, trim, trail) {
    this.trailColor = trail;
    const key = `${cloak}|${trim}`;
    if (key === this.lookKey) return;
    this.lookKey = key;
    this.scene.remove(this.model.group);
    this.model.group.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    this.model = buildPlayerModel({ cloak, trim });
    this.scene.add(this.model.group);
  }

  reset(maxHp) {
    this.x = 0; this.z = 6;
    this.vx = 0; this.vz = 0;
    this.aimX = 0; this.aimZ = -1;
    this.moveX = 0; this.moveZ = -1;
    this.maxHp = maxHp; this.hp = maxHp;
    this.shield = 0; this.shieldMax = 0; this.shieldDelay = 0;
    this.invuln = 0;
    this.dashT = 0; this.dashCd = 0; this.dashDirX = 0; this.dashDirZ = 0;
    this.dashHits = new Set();
    this.abilityCd = 0;
    this.overclockT = 0;
    this.bulwarkT = 0;
    this.hurtFlash = 0;
    this.revives = 0;
    this.alive = true;
    this.model.group.visible = true;
    this.model.group.position.set(this.x, 0, this.z);
  }

  get dashing() { return this.dashT > 0; }

  update(dt, game) {
    const { input, stats } = game;
    let mx = 0, mz = 0;
    if (input.isDown('KeyW') || input.isDown('ArrowUp')) mz -= 1;
    if (input.isDown('KeyS') || input.isDown('ArrowDown')) mz += 1;
    if (input.isDown('KeyA') || input.isDown('ArrowLeft')) mx -= 1;
    if (input.isDown('KeyD') || input.isDown('ArrowRight')) mx += 1;
    const len = Math.hypot(mx, mz);
    if (len > 0) { mx /= len; mz /= len; this.moveX = mx; this.moveZ = mz; }

    this.dashCd = Math.max(0, this.dashCd - dt);
    this.abilityCd = Math.max(0, this.abilityCd - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    this.overclockT = Math.max(0, this.overclockT - dt);
    this.bulwarkT = Math.max(0, this.bulwarkT - dt);

    if (input.wasPressed('Space') && this.dashCd <= 0 && !this.dashing) {
      const dx = len > 0 ? mx : this.aimX, dz = len > 0 ? mz : this.aimZ;
      this.dashDirX = dx; this.dashDirZ = dz;
      this.dashT = PLAYER_BASE.dashDuration;
      this.dashCd = PLAYER_BASE.dashCooldown * stats.dashCdMult;
      this.dashHits.clear();
      game.sound.play('dash');
      game.effects.ring(this.x, this.z, 0.4, 2, 0.3, this.trailColor);
      game.onDash();
    }

    if (this.dashing) {
      this.dashT -= dt;
      this.x += this.dashDirX * PLAYER_BASE.dashSpeed * dt;
      this.z += this.dashDirZ * PLAYER_BASE.dashSpeed * dt;
      this.invuln = Math.max(this.invuln, 0.12);
      for (let i = 0; i < 2; i++) {
        game.effects.particle(this.x + (Math.random() - 0.5) * 0.5, 0.4 + Math.random() * 1.1, this.z + (Math.random() - 0.5) * 0.5, 0, 0.5, 0, 0.35, 0.22, this.trailColor);
      }
      if (stats.syn.riftslash) game.dashStrike(this);
      if (stats.relic.chrono) game.dashSlow(this);
    } else {
      let speed = PLAYER_BASE.speed * stats.moveMult;
      if (stats.relic.laststand && this.hp / this.maxHp < (stats.syn.crimson ? 0.5 : 0.35)) speed *= 1.15;
      if (game.run.buffs.fury > 0) speed *= 1.1;
      // Slight acceleration smoothing keeps it responsive but not twitchy.
      const k = 1 - Math.exp(-dt * 18);
      this.vx += (mx * speed - this.vx) * k;
      this.vz += (mz * speed - this.vz) * k;
      this.x += this.vx * dt;
      this.z += this.vz * dt;
      // Faint movement trail (cosmetic)
      if (len > 0 && Math.random() < dt * 12 * game.particleScale) game.effects.particle(this.x, 0.15, this.z, 0, 0.3, 0, 0.35, 0.12, this.trailColor);
    }
    game.world.resolve(this, this.radius);

    // Aim at the cursor's projection on the ground plane.
    const ax = game.aimPoint.x - this.x, az = game.aimPoint.z - this.z;
    const al = Math.hypot(ax, az);
    if (al > 0.2) { this.aimX = ax / al; this.aimZ = az / al; }

    if (stats.regen > 0 && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + stats.regen * dt);

    // Shield recharges after a delay without damage.
    this.shieldMax = stats.shield;
    if (this.shieldMax > 0) {
      this.shieldDelay = Math.max(0, this.shieldDelay - dt);
      if (this.shieldDelay <= 0) this.shield = Math.min(this.shieldMax, this.shield + this.shieldMax * 0.5 * dt);
    } else this.shield = 0;
  }

  render(t) {
    const m = this.model;
    m.group.position.set(this.x, 0, this.z);
    m.group.rotation.y = Math.atan2(this.aimX, this.aimZ);
    const moving = Math.hypot(this.vx, this.vz) > 1;
    m.bodyMesh.position.y = moving ? Math.abs(Math.sin(t * 12)) * 0.08 : Math.sin(t * 2) * 0.03;
    m.bodyMesh.rotation.x = moving ? 0.12 : 0;
    m.shard.position.set(Math.cos(t * 2.5) * 0.85, 1.6 + Math.sin(t * 3) * 0.15, Math.sin(t * 2.5) * 0.85);
    m.shard.rotation.y = t * 3;
    m.ring.scale.setScalar(1 + Math.sin(t * 4) * 0.05);
    // Flicker during i-frames (not while dashing)
    const flicker = this.invuln > 0 && !this.dashing && this.bulwarkT <= 0 && Math.floor(t * 20) % 2 === 0;
    m.bodyMesh.visible = !flicker;
    m.bodyMat.emissive.setRGB(this.hurtFlash * 3 + (this.bulwarkT > 0 ? 0.5 : 0), this.hurtFlash * 0.3 + (this.bulwarkT > 0 ? 0.4 : 0), this.hurtFlash * 0.3 + (this.overclockT > 0 ? 0.3 : 0));
    m.shield.visible = this.shield > 0.5 || this.bulwarkT > 0;
    if (m.shield.visible) {
      m.shield.material.color.set(this.bulwarkT > 0 ? '#ffd36b' : '#59c8ff');
      m.shield.material.opacity = this.bulwarkT > 0 ? 0.45 : 0.1 + 0.25 * (this.shield / Math.max(1, this.shieldMax));
      m.shield.rotation.y = t * 0.8;
    }
  }
}
