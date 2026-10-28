import { BOSS, ARENA_RADIUS } from './config.js';
import { buildBossModel } from './models.js';

// The Rift Guardian: a state machine of readable, telegraphed attacks with recovery windows.
export class Boss {
  constructor(scene, game) {
    this.game = game;
    this.model = buildBossModel();
    this.model.group.visible = false;
    scene.add(this.model.group);
    this.active = false;
    this.hazards = [];
    this.radius = BOSS.radius;
    this.contactDamage = BOSS.contactDamage;
  }

  spawn() {
    const g = this.game;
    this.maxHp = BOSS.hp;
    this.e = g.enemies.addBoss(this);
    this.e.x = g.world.riftPos.x; this.e.z = g.world.riftPos.z;
    this.active = true;
    this.phase = 1;
    this.state = 'intro';
    this.stateT = 3.2;
    this.attackT = 0;
    this.lastAttack = '';
    this.rot = 0;
    this.y = 7;
    this.hazards.length = 0;
    this.volleys = 0;
    this.charges = 0;
    this.setPhaseColors(1);
    this.model.group.visible = true;
    g.sound.play('bossRoar');
    g.effects.shake(0.4);
  }

  remove() {
    this.active = false;
    this.model.group.visible = false;
    for (const h of this.hazards) if (h.tele) this.game.effects.hideTele(h.tele);
    this.hazards.length = 0;
    if (this.tele) { this.game.effects.hideTele(this.tele); this.tele = null; }
    this.e = null;
  }

  setPhaseColors(p) {
    const m = this.model;
    m.glowMat.color.set(p === 1 ? '#c06bff' : '#ff3b5c');
    m.coreMat.color.set(p === 1 ? '#f2d9ff' : '#ffe08a');
    m.shellMat.color.set(p === 1 ? '#2a2440' : '#3a1622');
  }

  contactDamageNow() {
    if (this.state === 'intro' || this.state === 'transition') return 0;
    return (this.state === 'charging' ? BOSS.chargeDamage : BOSS.contactDamage) * (this.phase === 2 ? 1.15 : 1);
  }

  get aggression() { return this.phase === 2 ? 0.62 : 1; }

  update(dt, t) {
    if (!this.active || !this.e || this.e.dead) return;
    const g = this.game, e = this.e, pl = g.player, fx = g.effects;
    const dx = pl.x - e.x, dz = pl.z - e.z;
    const dist = Math.hypot(dx, dz) || 0.01;
    const nx = dx / dist, nz = dz / dist;
    this.stateT -= dt;

    this.updateHazards(dt);

    if (this.phase === 1 && e.hp < this.maxHp * 0.5 && this.state !== 'intro' && this.state !== 'transition') {
      this.enter('transition', 2.2);
      e.invuln = true;
      if (this.tele) { fx.hideTele(this.tele); this.tele = null; }
      g.projectiles.clearEnemyNear(e.x, e.z, 100);
      g.sound.play('bossRoar');
      g.effects.shake(0.6);
      g.ui.announce('THE GUARDIAN ENRAGES', 'Phase 2', '#ff4d6d');
    }

    switch (this.state) {
      case 'intro': {
        const f = 1 - Math.max(0, this.stateT) / 3.2;
        const ease = f * f * (3 - 2 * f);
        e.x = g.world.riftPos.x; e.z = g.world.riftPos.z + (-12 - g.world.riftPos.z) * ease;
        this.y = 7 * (1 - ease) + Math.sin(f * Math.PI) * 3;
        if (Math.random() < 0.5) fx.particle(e.x, this.y + 2, e.z, (Math.random() - 0.5) * 4, -2, (Math.random() - 0.5) * 4, 0.6, 0.3, '#c06bff');
        if (this.stateT <= 0) {
          e.invuln = false;
          this.y = 0;
          fx.ring(e.x, e.z, 1, 10, 0.6, '#c06bff');
          fx.shake(0.5);
          g.sound.play('slam');
          this.enter('idle', 0);
          this.attackT = 1.5;
        }
        break;
      }
      case 'transition': {
        this.y = Math.sin((2.2 - this.stateT) * 3) * 0.6 + 0.6;
        if (Math.random() < 0.7) fx.particle(e.x + (Math.random() - 0.5) * 4, 1 + Math.random() * 5, e.z + (Math.random() - 0.5) * 4, 0, 3, 0, 0.6, 0.3, '#ff3b5c');
        if (this.stateT <= 1.1 && this.phase === 1) {
          this.phase = 2;
          this.setPhaseColors(2);
          fx.ring(e.x, e.z, 1, 14, 0.8, '#ff3b5c');
          fx.burst(e.x, 3, e.z, 40, '#ff3b5c', 14, 0.7, 0.35);
        }
        if (this.stateT <= 0) { e.invuln = false; this.y = 0; this.enter('idle', 0); this.attackT = 0.8; }
        break;
      }
      case 'idle': {
        const want = dist > 11 ? 1 : dist < 7 ? -0.7 : 0.15;
        const sp = BOSS.speed * (this.phase === 2 ? 1.3 : 1);
        const side = Math.sin(t * 0.7) * 0.5;
        e.x += (nx * want - nz * side) * sp * dt;
        e.z += (nz * want + nx * side) * sp * dt;
        this.faceTo(nx, nz, dt);
        this.attackT -= dt;
        if (this.attackT <= 0) this.chooseAttack();
        break;
      }
      case 'radialWind': {
        this.faceTo(nx, nz, dt);
        this.y = (1 - Math.max(0, this.stateT) / 0.7) * 1.2;
        if (this.stateT <= 0) { this.enter('radial', 0); this.volleys = this.phase === 2 ? 4 : 2; this.volleyT = 0; }
        break;
      }
      case 'radial': {
        this.volleyT -= dt;
        if (this.volleyT <= 0 && this.volleys > 0) {
          const n = this.phase === 2 ? 22 : 18;
          const off = (this.volleys % 2) * (Math.PI / n) + t * 0.3;
          for (let i = 0; i < n; i++) {
            const a = off + (i / n) * Math.PI * 2;
            g.projectiles.spawnEnemy('boss', e.x + Math.sin(a) * 2.6, e.z + Math.cos(a) * 2.6, Math.sin(a), Math.cos(a), this.phase === 2 ? 10.5 : 9, BOSS.shotDamage, 0.5, 5, this.phase === 2 ? '#ff4d6d' : '#c06bff');
          }
          fx.ring(e.x, e.z, 1, 4, 0.3, this.phase === 2 ? '#ff4d6d' : '#c06bff', 1);
          g.sound.play('bossShot');
          this.volleys--;
          this.volleyT = this.phase === 2 ? 0.42 : 0.55;
        }
        if (this.volleys <= 0 && this.volleyT <= 0) this.recover(1.3);
        break;
      }
      case 'slamWind': {
        this.y = (1 - Math.max(0, this.stateT) / 0.6) * 2.5;
        if (this.stateT <= 0) {
          this.y = 2.5;
          const count = this.phase === 2 ? 7 : 4;
          const warn = this.phase === 2 ? 1.05 : 1.25;
          // One circle on the player, others scattered nearby -- always leaves safe ground.
          this.addHazard(pl.x, pl.z, 3.1, warn);
          for (let i = 1; i < count; i++) {
            const a = Math.random() * Math.PI * 2, d = 4 + Math.random() * 6;
            let hx = pl.x + Math.cos(a) * d, hz = pl.z + Math.sin(a) * d;
            const r = Math.hypot(hx, hz);
            if (r > ARENA_RADIUS - 2) { hx *= (ARENA_RADIUS - 2) / r; hz *= (ARENA_RADIUS - 2) / r; }
            this.addHazard(hx, hz, 2.6 + Math.random() * 0.8, warn + i * 0.08);
          }
          g.sound.play('warning');
          this.enter('slamHold', warn + count * 0.08 + 0.2);
        }
        break;
      }
      case 'slamHold': {
        this.y = Math.max(0, this.y - dt * 5);
        if (this.stateT <= 0) {
          if (this.phase === 2 && !this.secondSlam) { this.secondSlam = true; this.enter('slamWind', 0.4); }
          else { this.secondSlam = false; this.recover(1.1); }
        }
        break;
      }
      case 'chargeWind': {
        this.faceTo(this.cdx, this.cdz, dt * 2);
        if (Math.random() < 0.5) fx.particle(e.x - this.cdx * 2, 0.4, e.z - this.cdz * 2, -this.cdx * 4, 1, -this.cdz * 4, 0.4, 0.3, '#ff9a5a');
        if (this.stateT <= 0) {
          if (this.tele) { fx.hideTele(this.tele); this.tele = null; }
          this.enter('charging', this.chargeLen / 26);
          g.sound.play('dash');
        }
        break;
      }
      case 'charging': {
        e.x += this.cdx * 26 * dt; e.z += this.cdz * 26 * dt;
        if (Math.random() < 0.8) fx.particle(e.x, 0.5, e.z, (Math.random() - 0.5) * 4, 2, (Math.random() - 0.5) * 4, 0.4, 0.35, '#ff7a3a');
        const hitWall = Math.hypot(e.x, e.z) > ARENA_RADIUS - this.radius - 0.2 || g.world.insideObstacle(e.x, e.z, this.radius - 0.8);
        if (this.stateT <= 0 || hitWall) {
          fx.ring(e.x, e.z, 1, 6, 0.4, '#ff7a3a');
          fx.shake(hitWall ? 0.55 : 0.3);
          g.sound.play('slam');
          if (this.phase === 2 && this.charges > 0) { this.charges--; this.startCharge(0.6); }
          else this.recover(hitWall ? 2.0 : 1.6);
        }
        break;
      }
      case 'summon': {
        if (this.stateT <= 0) this.recover(0.8);
        break;
      }
      case 'recover': {
        // Vulnerable breather: slow drift, dazed sparks.
        this.y = Math.max(0, this.y - dt * 4);
        if (Math.random() < 0.3) fx.particle(e.x + (Math.random() - 0.5) * 2, 5.5, e.z + (Math.random() - 0.5) * 2, 0, 1, 0, 0.5, 0.18, '#fff27a');
        if (this.stateT <= 0) { this.enter('idle', 0); this.attackT = (0.9 + Math.random() * 0.6) * this.aggression; }
        break;
      }
    }

    g.world.resolve(e, this.radius);
  }

  enter(state, time) { this.state = state; this.stateT = time; }
  recover(time) { this.enter('recover', time * (this.phase === 2 ? 0.75 : 1)); }

  faceTo(dx, dz, dt) {
    let diff = Math.atan2(dx, dz) - this.rot;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.rot += diff * Math.min(1, dt * 5);
  }

  chooseAttack() {
    const g = this.game;
    const options = ['radial', 'slam', 'charge'];
    if (this.phase === 2) options.push('summon');
    let pick;
    do { pick = options[Math.floor(Math.random() * options.length)]; } while (pick === this.lastAttack);
    this.lastAttack = pick;
    if (pick === 'radial') { this.enter('radialWind', 0.7); g.sound.play('windup'); }
    else if (pick === 'slam') { this.secondSlam = false; this.enter('slamWind', 0.6); }
    else if (pick === 'charge') { this.charges = this.phase === 2 ? 1 : 0; this.startCharge(0.95); }
    else {
      const e = this.e;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const x = e.x + Math.cos(a) * 4.5, z = e.z + Math.sin(a) * 4.5;
        if (!g.world.insideObstacle(x, z, 0.8) && Math.hypot(x, z) < ARENA_RADIUS - 1) {
          g.enemies.spawn(i % 2 ? 'dasher' : 'crawler', x, z, { counts: false, wave: 9 });
        }
      }
      g.effects.ring(e.x, e.z, 1, 7, 0.5, '#ff3b5c');
      g.sound.play('spawnElite');
      this.enter('summon', 0.8);
    }
  }

  // Aim at the player's position *now*; the charge goes there even if the player moves.
  startCharge(wind) {
    const g = this.game, e = this.e, pl = g.player;
    const dx = pl.x - e.x, dz = pl.z - e.z, d = Math.hypot(dx, dz) || 1;
    this.cdx = dx / d; this.cdz = dz / d;
    this.chargeLen = Math.min(d + 5, 34);
    this.tele = g.effects.teleLane(e.x, e.z, this.cdx, this.cdz, this.chargeLen, this.radius * 2.1, wind, '#ff7a3a');
    g.sound.play('warning');
    this.enter('chargeWind', wind);
  }

  addHazard(x, z, r, t) {
    const tele = this.game.effects.teleCircle(x, z, r, t, this.phase === 2 ? '#ff3b5c' : '#d36bff');
    this.hazards.push({ x, z, r, t, tele });
  }

  updateHazards(dt) {
    const g = this.game, pl = g.player;
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];
      h.t -= dt;
      if (h.t > 0) continue;
      if (h.tele) g.effects.hideTele(h.tele);
      g.effects.ring(h.x, h.z, 0.3, h.r, 0.35, '#ff9ad5', 0.2);
      g.effects.burst(h.x, 0.4, h.z, 14, this.phase === 2 ? '#ff3b5c' : '#c06bff', 10, 0.5, 0.25, 10);
      g.sound.play('slam');
      g.effects.shake(0.2);
      if (Math.hypot(pl.x - h.x, pl.z - h.z) < h.r + pl.radius * 0.5) g.damagePlayer(BOSS.slamDamage, h.x, h.z);
      this.hazards.splice(i, 1);
    }
  }

  render(t) {
    if (!this.active || !this.e) return;
    const m = this.model, e = this.e;
    m.group.position.set(e.x, this.y + Math.sin(t * 1.5) * 0.15, e.z);
    m.body.rotation.y = this.rot;
    const flash = e.flash > 0 ? 0.8 : 0;
    m.shellMat.emissive.setRGB(flash + (this.state === 'chargeWind' ? 0.3 : 0), flash * 0.5, flash * 0.8);
    m.core.rotation.y = t * 2;
    const cs = 1 + Math.sin(t * (this.phase === 2 ? 9 : 5)) * 0.15 + (this.state === 'radialWind' ? 0.4 : 0);
    m.core.scale.setScalar(cs);
    m.halo.rotation.z = t * 1.2;
    m.shards.forEach((s, i) => {
      const a = t * (this.phase === 2 ? 2.2 : 1.3) + (i / 4) * Math.PI * 2;
      s.position.set(Math.cos(a) * 3.6, 3.2 + Math.sin(t * 2 + i) * 0.6, Math.sin(a) * 3.6);
      s.rotation.y = t * 3;
    });
  }
}
