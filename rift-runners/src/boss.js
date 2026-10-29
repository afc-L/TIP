import { BOSSES, ARENA_RADIUS } from './config.js';
import { buildBossModel } from './models.js';
import { buildDevourerModel, buildEngineerModel } from './models2.js';

// Shared plumbing for all bosses: health registration, phases, facing, lane attacks.
class BossBase {
  constructor(game, key) {
    this.game = game;
    this.key = key;
    this.cfg = BOSSES[key];
    this.name = this.cfg.name;
    this.radius = this.cfg.radius;
    this.contactDamage = this.cfg.contactDamage;
    this.active = false;
    this.lanes = [];
    this.phase = 1;
    this.phaseCount = 2;
    this.status = '';
  }

  get g() { return this.game; }
  get nightmare() { return this.game.diff.bossExtra; }

  baseSpawn(tier, hpScale) {
    const g = this.game;
    this.tier = tier;
    // Endless bosses grow with their tier; mid-bosses get extra bulk there since players are stronger.
    const endless = g.waves.endless;
    const tierMult = endless ? 1 + 1.1 * (tier - 1) : 1;
    const base = endless && this.key !== 'guardian' ? 1.6 : 1;
    this.maxHp = Math.round(this.cfg.hp * g.diff.bossHp * hpScale * tierMult * base);
    this.e = g.enemies.addBoss(this);
    this.active = true;
    this.phase = 1;
    this.rot = 0;
    this.y = 0;
    this.lanes.length = 0;
    this.lastAttack = '';
    this.status = '';
    g.discover(this.key);
  }

  remove() {
    this.active = false;
    if (this.model) this.model.group.visible = false;
    for (const l of this.lanes) if (l.tele) this.game.effects.hideTele(l.tele);
    this.lanes.length = 0;
    if (this.tele) { this.game.effects.hideTele(this.tele); this.tele = null; }
    this.e = null;
  }

  enter(state, time) { this.state = state; this.stateT = time; }
  // Recovery windows shrink with aggression but never vanish.
  recover(time) { this.enter('recover', Math.max(0.8, time * this.recoverScale())); }
  recoverScale() { return (this.phase >= 3 ? 0.7 : this.phase === 2 ? 0.82 : 1) * (this.nightmare ? 0.85 : 1); }
  get aggression() { return (this.phase >= 3 ? 0.5 : this.phase === 2 ? 0.65 : 1) * (this.nightmare ? 0.8 : 1) / (1 + 0.15 * (this.tier - 1)); }

  faceTo(dx, dz, dt, rate = 5) {
    let diff = Math.atan2(dx, dz) - this.rot;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.rot += diff * Math.min(1, dt * rate);
  }

  pick(options) {
    let pick;
    let n = 0;
    do { pick = options[Math.floor(Math.random() * options.length)]; } while (pick === this.lastAttack && n++ < 10);
    this.lastAttack = pick;
    return pick;
  }

  // Straight-line telegraphed damage lanes.
  addLane(x, z, dx, dz, len, w, delay, dmg, color) {
    const d = delay * this.game.diff.telegraph;
    const tele = this.game.effects.teleLane(x, z, dx, dz, len, w, d, color);
    this.lanes.push({ x, z, dx, dz, len, w, t: d, dmg, tele, color });
  }

  updateLanes(dt) {
    const g = this.game, pl = g.player;
    for (let i = this.lanes.length - 1; i >= 0; i--) {
      const l = this.lanes[i];
      l.t -= dt;
      if (l.t > 0) continue;
      if (l.tele) g.effects.hideTele(l.tele);
      this.lanes.splice(i, 1);
      for (let k = 0; k < 8; k++) {
        const f = k / 7 * l.len;
        g.effects.burst(l.x + l.dx * f, 0.6, l.z + l.dz * f, 3, l.color, 5, 0.4, 0.22);
      }
      g.sound.play('zap');
      const px = pl.x - l.x, pz = pl.z - l.z;
      const along = px * l.dx + pz * l.dz, side = Math.abs(px * l.dz - pz * l.dx);
      if (along > -0.5 && along < l.len && side < l.w / 2 + pl.radius * 0.6) g.damagePlayer(l.dmg, pl.x - l.dz, pl.z + l.dx);
    }
  }

  // Phase change at the given health fractions. Returns true while transitioning.
  checkPhase(thresholds) {
    const e = this.e;
    const next = this.phase;
    if (next - 1 < thresholds.length && e.hp < this.maxHp * thresholds[next - 1] && this.state !== 'intro' && this.state !== 'transition') {
      this.enter('transition', 2.2);
      this.pendingPhase = next + 1;
      e.invuln = true;
      if (this.tele) { this.game.effects.hideTele(this.tele); this.tele = null; }
      this.game.projectiles.clearEnemyNear(e.x, e.z, 200);
      this.game.sound.play('bossRoar');
      this.game.effects.shake(0.6);
      this.onPhaseStart(this.pendingPhase);
      return true;
    }
    return false;
  }

  onPhaseStart() {}

  contactDamageNow() {
    if (this.state === 'intro' || this.state === 'transition') return 0;
    return this.contactDamage * (this.state === 'charging' ? 1.4 : 1) * this.game.diff.enemyDmg * (1 + 0.15 * (this.tier - 1));
  }

  shotDmg(base) { return base * this.game.diff.enemyDmg * (1 + 0.12 * (this.tier - 1)); }
}

// ---------------------------------------------------------------------------------------------
export class Guardian extends BossBase {
  constructor(scene, game) {
    super(game, 'guardian');
    this.model = buildBossModel();
    this.model.group.visible = false;
    scene.add(this.model.group);
    this.phaseCount = 3;
  }

  spawn(tier = 1, hpScale = 1) {
    const g = this.game;
    this.baseSpawn(tier, hpScale);
    this.e.x = g.world.riftPos.x; this.e.z = g.world.riftPos.z;
    this.enter('intro', 3.2);
    this.y = 7;
    this.volleys = 0;
    this.charges = 0;
    this.setPhaseColors(1);
    this.model.group.visible = true;
    g.sound.play('bossRoar');
    g.effects.shake(0.4);
  }

  setPhaseColors(p) {
    const m = this.model;
    m.glowMat.color.set(p === 1 ? '#c06bff' : p === 2 ? '#ff3b5c' : '#ffb547');
    m.coreMat.color.set(p === 1 ? '#f2d9ff' : p === 2 ? '#ffe08a' : '#ffffff');
    m.shellMat.color.set(p === 1 ? '#2a2440' : p === 2 ? '#3a1622' : '#1a1206');
  }

  onPhaseStart(p) {
    const names = { 2: ['THE GUARDIAN ENRAGES', 'Phase 2 — summons and combos', '#ff4d6d'], 3: ['THE RIFT COLLAPSES', 'Phase 3 — the safe zone shrinks', '#ffb547'] };
    const [a, b, c] = names[p];
    this.game.ui.announce(a, b, c);
  }

  update(dt, t) {
    if (!this.active || !this.e || this.e.dead) return;
    const g = this.game, e = this.e, pl = g.player, fx = g.effects;
    const dx = pl.x - e.x, dz = pl.z - e.z;
    const dist = Math.hypot(dx, dz) || 0.01;
    const nx = dx / dist, nz = dz / dist;
    this.stateT -= dt;
    this.updateLanes(dt);
    this.checkPhase([2 / 3, 1 / 3]);
    this.status = this.state === 'recover' ? 'Recovering — strike now!' : this.state === 'transition' ? 'Invulnerable' : '';

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
        return;
      }
      case 'transition': {
        this.y = Math.sin((2.2 - this.stateT) * 3) * 0.6 + 0.6;
        const col = this.pendingPhase === 3 ? '#ffb547' : '#ff3b5c';
        if (Math.random() < 0.7) fx.particle(e.x + (Math.random() - 0.5) * 4, 1 + Math.random() * 5, e.z + (Math.random() - 0.5) * 4, 0, 3, 0, 0.6, 0.3, col);
        if (this.stateT <= 1.1 && this.phase < this.pendingPhase) {
          this.phase = this.pendingPhase;
          this.setPhaseColors(this.phase);
          fx.ring(e.x, e.z, 1, 14, 0.8, col);
          fx.burst(e.x, 3, e.z, 40, col, 14, 0.7, 0.35);
          if (this.phase === 3) g.setSafeZone(21);
        }
        if (this.stateT <= 0) { e.invuln = false; this.y = 0; this.enter('idle', 0); this.attackT = 1.0; }
        break;
      }
      case 'idle': {
        const near = this.phase === 3 ? 6 : 7, far = this.phase === 3 ? 8 : 11;
        const want = dist > far ? 1 : dist < near ? -0.7 : 0.15;
        const sp = this.cfg.speed * (this.phase === 3 ? 1.55 : this.phase === 2 ? 1.3 : 1);
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
        if (this.stateT <= 0) { this.enter('radial', 0); this.volleys = (this.phase >= 2 ? 4 : 2) + (this.nightmare ? 1 : 0); this.volleyT = 0; }
        break;
      }
      case 'radial': {
        this.volleyT -= dt;
        if (this.volleyT <= 0 && this.volleys > 0) {
          this.ring(this.phase >= 2 ? 22 : 18, (this.volleys % 2) * Math.PI / 20 + t * 0.3, this.phase >= 2 ? 10.5 : 9);
          this.volleys--;
          this.volleyT = this.phase >= 2 ? 0.42 : 0.55;
        }
        if (this.volleys <= 0 && this.volleyT <= 0) this.recover(1.3);
        break;
      }
      case 'slamWind': {
        this.y = (1 - Math.max(0, this.stateT) / 0.6) * 2.5;
        if (this.stateT <= 0) {
          this.y = 2.5;
          const count = (this.phase >= 2 ? 6 : 4) + (this.nightmare ? 2 : 0);
          const warn = this.phase >= 2 ? 1.05 : 1.25;
          this.slamCircles(count, warn);
          if (this.combo) this.ring(16, Math.random(), 8.5);
          this.enter('slamHold', warn * g.diff.telegraph + count * 0.08 + 0.2);
        }
        break;
      }
      case 'slamHold': {
        this.y = Math.max(0, this.y - dt * 5);
        if (this.stateT <= 0) {
          if (this.phase >= 2 && !this.secondSlam) { this.secondSlam = true; this.enter('slamWind', 0.4); }
          else { this.secondSlam = false; this.combo = false; this.recover(1.1); }
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
        const hitWall = Math.hypot(e.x, e.z) > g.safeRadius() - this.radius - 0.2 || g.world.insideObstacle(e.x, e.z, this.radius - 0.8);
        if (this.stateT <= 0 || hitWall) {
          fx.ring(e.x, e.z, 1, 6, 0.4, '#ff7a3a');
          fx.shake(hitWall ? 0.55 : 0.3);
          g.sound.play('slam');
          if (this.charges > 0) { this.charges--; this.startCharge(0.65); }
          else this.recover(hitWall ? 2.0 : 1.6);
        }
        break;
      }
      case 'spiral': {
        this.faceTo(nx, nz, dt);
        this.spiralT -= dt;
        if (this.spiralT <= 0) {
          this.spiralT = 0.11;
          const arms = this.nightmare ? 4 : 3;
          this.spinA += 0.23;
          for (let i = 0; i < arms; i++) {
            const a = this.spinA + (i / arms) * Math.PI * 2;
            g.projectiles.spawnEnemy('boss', e.x + Math.sin(a) * 2.6, e.z + Math.cos(a) * 2.6, Math.sin(a), Math.cos(a), 8.5, this.shotDmg(this.cfg.shotDamage), 0.45, 5, '#ffb547');
          }
          if (Math.random() < 0.3) g.sound.play('bossShot');
        }
        if (this.stateT <= 0) this.recover(1.4);
        break;
      }
      case 'lances': {
        if (this.stateT <= 0) this.recover(1.3);
        break;
      }
      case 'summon': {
        if (this.stateT <= 0) this.recover(0.9);
        break;
      }
      case 'recover': {
        this.y = Math.max(0, this.y - dt * 4);
        if (Math.random() < 0.3) fx.particle(e.x + (Math.random() - 0.5) * 2, 5.5, e.z + (Math.random() - 0.5) * 2, 0, 1, 0, 0.5, 0.18, '#fff27a');
        if (this.stateT <= 0) { this.enter('idle', 0); this.attackT = (0.9 + Math.random() * 0.6) * this.aggression; }
        break;
      }
    }
    g.world.resolve(e, this.radius);
    g.clampToSafe(e, this.radius);
  }

  ring(n, off, speed) {
    const g = this.game, e = this.e;
    const color = this.phase === 3 ? '#ffb547' : this.phase === 2 ? '#ff4d6d' : '#c06bff';
    for (let i = 0; i < n; i++) {
      const a = off + (i / n) * Math.PI * 2;
      g.projectiles.spawnEnemy('boss', e.x + Math.sin(a) * 2.6, e.z + Math.cos(a) * 2.6, Math.sin(a), Math.cos(a), speed, this.shotDmg(this.cfg.shotDamage), 0.5, 5, color);
    }
    g.effects.ring(e.x, e.z, 1, 4, 0.3, color, 1);
    g.sound.play('bossShot');
  }

  slamCircles(count, warn) {
    const g = this.game, pl = g.player;
    const color = this.phase === 3 ? '#ffb547' : this.phase === 2 ? '#ff3b5c' : '#d36bff';
    const dmg = this.shotDmg(this.cfg.slamDamage);
    // One circle on the player, the rest scattered nearby -- always leaves safe ground.
    g.hazards.add({ x: pl.x, z: pl.z, r: 3.1, delay: warn, damage: dmg, color });
    const lim = g.safeRadius() - 2;
    for (let i = 1; i < count; i++) {
      const a = Math.random() * Math.PI * 2, d = 4.5 + Math.random() * 6;
      let hx = pl.x + Math.cos(a) * d, hz = pl.z + Math.sin(a) * d;
      const r = Math.hypot(hx, hz);
      if (r > lim) { hx *= lim / r; hz *= lim / r; }
      g.hazards.add({ x: hx, z: hz, r: 2.5 + Math.random() * 0.7, delay: warn + i * 0.08, damage: dmg, color });
    }
    g.sound.play('warning');
  }

  chooseAttack() {
    const g = this.game, e = this.e;
    const options = ['radial', 'slam', 'charge'];
    if (this.phase >= 2) options.push('summon', 'combo');
    if (this.phase >= 3) options.push('spiral', 'lances', 'lances');
    // Higher endless tiers unlock late-fight patterns earlier.
    else if (this.tier >= 2 && this.phase >= 2) options.push('lances');
    if (this.tier >= 3 && this.phase === 1) options.push('spiral');
    const pick = this.pick(options);
    if (pick === 'radial') { this.enter('radialWind', 0.7 * g.diff.telegraph); g.sound.play('windup'); }
    else if (pick === 'slam') { this.secondSlam = false; this.enter('slamWind', 0.6); }
    else if (pick === 'combo') { this.secondSlam = true; this.combo = true; this.enter('slamWind', 0.6); }
    else if (pick === 'charge') { this.charges = this.phase >= 2 ? 1 : 0; this.startCharge(0.95); }
    else if (pick === 'spiral') { this.enter('spiral', 2.6); this.spiralT = 0.5; this.spinA = Math.random() * 6; g.sound.play('windup'); }
    else if (pick === 'lances') {
      const n = this.nightmare ? 8 : 6;
      const off = Math.random() * Math.PI;
      for (let i = 0; i < n; i++) {
        const a = off + (i / n) * Math.PI * 2;
        this.addLane(e.x, e.z, Math.sin(a), Math.cos(a), 30, 1.8, 1.15, this.shotDmg(22), '#ffb547');
      }
      g.sound.play('warning');
      this.enter('lances', 1.15 * g.diff.telegraph + 0.2);
    } else {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const x = e.x + Math.cos(a) * 4.5, z = e.z + Math.sin(a) * 4.5;
        if (!g.world.insideObstacle(x, z, 0.8) && Math.hypot(x, z) < g.safeRadius() - 1) {
          g.enemies.spawn(['dasher', 'crawler', 'stalker', 'leech'][i % 4], x, z, { counts: false, wave: 8, xp: 1 });
        }
      }
      g.effects.ring(e.x, e.z, 1, 7, 0.5, '#ff3b5c');
      g.sound.play('spawnElite');
      this.enter('summon', 0.8);
    }
  }

  // Aims at the player's position *now*; the charge goes there even if the player moves.
  startCharge(wind) {
    const g = this.game, e = this.e, pl = g.player;
    const dx = pl.x - e.x, dz = pl.z - e.z, d = Math.hypot(dx, dz) || 1;
    this.cdx = dx / d; this.cdz = dz / d;
    this.chargeLen = Math.min(d + 5, 34);
    const w = wind * g.diff.telegraph;
    this.tele = g.effects.teleLane(e.x, e.z, this.cdx, this.cdz, this.chargeLen, this.radius * 2.1, w, '#ff7a3a');
    g.sound.play('warning');
    this.enter('chargeWind', w);
  }

  render(t) {
    if (!this.active || !this.e) return;
    const m = this.model, e = this.e;
    m.group.position.set(e.x, this.y + Math.sin(t * 1.5) * 0.15, e.z);
    m.body.rotation.y = this.rot;
    const flash = e.flash > 0 && !this.game.meta.settings.reduceFlash ? 0.8 : 0;
    m.shellMat.emissive.setRGB(flash + (this.state === 'chargeWind' ? 0.3 : 0), flash * 0.5, flash * 0.8);
    m.core.rotation.y = t * 2;
    m.core.scale.setScalar(1 + Math.sin(t * (this.phase >= 2 ? 9 : 5)) * 0.15 + (this.state === 'radialWind' ? 0.4 : 0));
    m.halo.rotation.z = t * 1.2;
    m.shards.forEach((s, i) => {
      const a = t * (this.phase >= 2 ? 2.2 : 1.3) + (i / 4) * Math.PI * 2;
      s.position.set(Math.cos(a) * 3.6, 3.2 + Math.sin(t * 2 + i) * 0.6, Math.sin(a) * 3.6);
      s.rotation.y = t * 3;
    });
  }
}

// ---------------------------------------------------------------------------------------------
// The Devourer: charges across the arena leaving acid, then is stunned at the wall.
export class Devourer extends BossBase {
  constructor(scene, game) {
    super(game, 'devourer');
    this.model = buildDevourerModel();
    this.model.group.visible = false;
    scene.add(this.model.group);
    for (const s of this.model.segments) { s.visible = false; scene.add(s); }
    this.trail = [];
  }

  spawn(tier = 1, hpScale = 1) {
    const g = this.game;
    this.baseSpawn(tier, hpScale);
    const a = Math.atan2(-g.player.z, -g.player.x);
    this.e.x = Math.cos(a) * 18; this.e.z = Math.sin(a) * 18;
    this.trail = Array.from({ length: 40 }, () => [this.e.x, this.e.z]);
    this.enter('intro', 2.2);
    this.e.invuln = true;
    this.model.group.visible = true;
    this.model.segments.forEach((s) => (s.visible = true));
    this.model.glowMat.color.set('#9dff3a');
    g.sound.play('bossRoar');
    g.effects.shake(0.5);
  }

  remove() {
    super.remove();
    this.model.segments.forEach((s) => (s.visible = false));
  }

  onPhaseStart() { this.game.ui.announce('THE DEVOURER FRENZIES', 'Double charges, bigger acid pools', '#9dff3a'); }

  update(dt, t) {
    if (!this.active || !this.e || this.e.dead) return;
    const g = this.game, e = this.e, pl = g.player, fx = g.effects;
    const dx = pl.x - e.x, dz = pl.z - e.z;
    const dist = Math.hypot(dx, dz) || 0.01;
    const nx = dx / dist, nz = dz / dist;
    this.stateT -= dt;
    this.updateLanes(dt);
    this.checkPhase([0.5]);
    e.dmgTakenMult = this.state === 'stunned' ? 1.6 : 1;
    this.status = this.state === 'stunned' ? 'STUNNED — +60% damage taken!' : '';

    switch (this.state) {
      case 'intro':
        this.y = -3 * Math.max(0, this.stateT) / 2.2;
        if (Math.random() < 0.6) fx.particle(e.x + (Math.random() - 0.5) * 4, 0.3, e.z + (Math.random() - 0.5) * 4, 0, 4, 0, 0.6, 0.3, '#6a4228');
        if (this.stateT <= 0) { e.invuln = false; this.y = 0; this.enter('idle', 0); this.attackT = 1.2; }
        break;
      case 'transition':
        if (Math.random() < 0.6) fx.particle(e.x, 2, e.z, (Math.random() - 0.5) * 6, 4, (Math.random() - 0.5) * 6, 0.6, 0.3, '#9dff3a');
        if (this.stateT <= 1.1 && this.phase < this.pendingPhase) { this.phase = this.pendingPhase; this.model.glowMat.color.set('#ff5a2a'); fx.ring(e.x, e.z, 1, 12, 0.8, '#ff5a2a'); }
        if (this.stateT <= 0) { e.invuln = false; this.enter('idle', 0); this.attackT = 0.8; }
        break;
      case 'idle': {
        const side = Math.sin(t * 0.9 + 1) * 0.8;
        const sp = this.cfg.speed * (this.phase === 2 ? 1.25 : 1);
        e.x += (nx * 0.6 - nz * side) * sp * dt; e.z += (nz * 0.6 + nx * side) * sp * dt;
        this.faceTo(nx - nz * side, nz + nx * side, dt, 3);
        this.attackT -= dt;
        if (this.attackT <= 0) {
          const pick = this.pick(['charge', 'charge', 'spray', 'summon']);
          if (pick === 'charge') { this.charges = (this.phase === 2 ? 1 : 0) + (this.nightmare ? 1 : 0) + (this.tier >= 2 ? 1 : 0); this.startCharge(1.0); }
          else if (pick === 'spray') { this.enter('sprayWind', 0.6 * g.diff.telegraph); g.sound.play('windup'); }
          else { this.summon(); this.enter('summon', 1.0); }
        }
        break;
      }
      case 'chargeWind':
        this.faceTo(this.cdx, this.cdz, dt, 6);
        e.x -= this.cdx * dt * 1.5; e.z -= this.cdz * dt * 1.5;
        if (this.stateT <= 0) {
          if (this.tele) { fx.hideTele(this.tele); this.tele = null; }
          this.enter('charging', 2.5); this.poolAcc = 0;
          g.sound.play('dash');
        }
        break;
      case 'charging': {
        const sp = 29;
        e.x += this.cdx * sp * dt; e.z += this.cdz * sp * dt;
        this.poolAcc += sp * dt;
        if (this.poolAcc > 3) {
          this.poolAcc = 0;
          g.hazards.addPool(e.x - this.cdx * 1.5, e.z - this.cdz * 1.5, this.phase === 2 ? 2.0 : 1.6, 5, this.shotDmg(this.cfg.acidDps), '#9dff3a');
        }
        if (Math.random() < 0.8) fx.particle(e.x, 0.5, e.z, (Math.random() - 0.5) * 5, 2, (Math.random() - 0.5) * 5, 0.4, 0.3, '#8a6a3a');
        const hitWall = Math.hypot(e.x, e.z) > ARENA_RADIUS - this.radius - 0.3 || g.world.insideObstacle(e.x, e.z, this.radius - 0.6);
        if (hitWall || this.stateT <= 0) {
          fx.ring(e.x, e.z, 1, 7, 0.5, '#9dff3a');
          fx.shake(0.5);
          g.sound.play('slam');
          if (this.charges > 0) { this.charges--; this.startCharge(0.75); }
          else { this.enter('stunned', (this.phase === 2 ? 2.0 : 2.4) * this.recoverScale() / 0.82 * 0.82 + 0.3); }
        }
        break;
      }
      case 'stunned':
        if (Math.random() < 0.3) fx.particle(e.x + (Math.random() - 0.5) * 2, 4, e.z + (Math.random() - 0.5) * 2, 0, 1, 0, 0.5, 0.2, '#fff27a');
        if (this.stateT <= 0) { this.enter('idle', 0); this.attackT = (1 + Math.random() * 0.6) * this.aggression; }
        break;
      case 'sprayWind':
        this.faceTo(nx, nz, dt, 6);
        if (this.stateT <= 0) {
          const base = Math.atan2(nx, nz);
          const n = this.phase === 2 ? 11 : 7;
          for (let i = 0; i < n; i++) {
            const a = base + (i - (n - 1) / 2) * 0.13;
            g.projectiles.spawnEnemy('spit', e.x + Math.sin(a) * 2, e.z + Math.cos(a) * 2, Math.sin(a), Math.cos(a), 9 + Math.random() * 2, this.shotDmg(12), 0.5, 4, '#9dff3a');
          }
          g.sound.play('enemyShot');
          this.recover(1.0);
        }
        break;
      case 'summon':
      case 'recover':
        if (this.stateT <= 0) { this.enter('idle', 0); this.attackT = (1 + Math.random() * 0.5) * this.aggression; }
        break;
    }
    g.world.resolve(e, this.radius);
    const last = this.trail[0];
    if ((last[0] - e.x) ** 2 + (last[1] - e.z) ** 2 > 0.25) { this.trail.unshift([e.x, e.z]); this.trail.length = 40; }
  }

  summon() {
    const g = this.game, e = this.e;
    const n = this.phase === 2 ? 5 : 3;
    for (let i = 0; i < n; i++) {
      const a = this.rot + (i - (n - 1) / 2) * 0.5;
      const x = e.x + Math.sin(a) * 3, z = e.z + Math.cos(a) * 3;
      if (!g.world.insideObstacle(x, z, 0.8)) g.enemies.spawn(i % 2 ? 'splitter' : 'crawler', x, z, { counts: false, xp: 1 });
    }
    g.sound.play('spawnElite');
  }

  startCharge(wind) {
    const g = this.game, e = this.e, pl = g.player;
    const dx = pl.x - e.x, dz = pl.z - e.z, d = Math.hypot(dx, dz) || 1;
    this.cdx = dx / d; this.cdz = dz / d;
    const w = wind * g.diff.telegraph;
    this.tele = g.effects.teleLane(e.x, e.z, this.cdx, this.cdz, 60, this.radius * 2.2, w, '#9dff3a');
    g.sound.play('warning');
    this.enter('chargeWind', w);
  }

  render(t) {
    if (!this.active || !this.e) return;
    const m = this.model, e = this.e;
    const y = this.y + (this.state === 'stunned' ? -0.3 : 0);
    m.group.position.set(e.x, y, e.z);
    m.group.rotation.y = this.rot;
    m.head.rotation.z = this.state === 'stunned' ? Math.sin(t * 8) * 0.15 : 0;
    m.plate.emissive.setRGB(e.flash > 0 ? 0.6 : this.state === 'chargeWind' ? 0.3 : 0, e.flash > 0 ? 0.4 : 0.05, 0);
    m.segments.forEach((s, i) => {
      const p = this.trail[Math.min(this.trail.length - 1, (i + 1) * 5)];
      s.position.set(p[0], y + 1.2 - i * 0.1 + Math.sin(t * 4 + i) * 0.15, p[1]);
      s.rotation.y = t * 0.5 + i;
    });
  }
}

// ---------------------------------------------------------------------------------------------
// The Rift Engineer: shielded by pylons, deploys turrets and mines, overheats after barrages.
export class Engineer extends BossBase {
  constructor(scene, game) {
    super(game, 'engineer');
    this.model = buildEngineerModel();
    this.model.group.visible = false;
    scene.add(this.model.group);
  }

  spawn(tier = 1, hpScale = 1) {
    const g = this.game;
    this.baseSpawn(tier, hpScale);
    const a = Math.atan2(-g.player.z, -g.player.x);
    this.e.x = Math.cos(a) * 16; this.e.z = Math.sin(a) * 16;
    this.e.invuln = true;
    this.enter('intro', 1.8);
    this.devices = [];
    this.shieldDownT = 0;
    this.model.group.visible = true;
    g.sound.play('bossRoar');
  }

  remove() {
    // Devices vanish with their maker (no drops).
    if (this.devices) for (const d of this.devices) d.dead = true;
    this.devices = [];
    super.remove();
  }

  onPhaseStart() { this.game.ui.announce('ENGINEER OVERDRIVE', 'Upgraded turrets and more mines', '#ffd166'); }

  get pylons() { return this.devices.filter((d) => !d.dead && d.type === 'pylon'); }

  deploy(type, x, z) {
    const g = this.game;
    const r = Math.hypot(x, z);
    if (r > ARENA_RADIUS - 2) { x *= (ARENA_RADIUS - 2) / r; z *= (ARENA_RADIUS - 2) / r; }
    if (g.world.insideObstacle(x, z, 1)) return;
    const hpMult = (1 + 0.5 * (this.tier - 1)) * g.diff.bossHp;
    const d = g.enemies.spawn(type, x, z, { counts: false, bossDevice: this, hpMult, xp: type === 'mine' ? 0 : 2 });
    d.cd = 1 + Math.random();
    this.devices.push(d);
    this.game.effects.ring(x, z, 0.3, 2, 0.4, '#ffd166');
    this.game.effects.lightning(this.e.x, 2, this.e.z, x, 1, z, '#ffd166');
  }

  update(dt, t) {
    if (!this.active || !this.e || this.e.dead) return;
    const g = this.game, e = this.e, pl = g.player, fx = g.effects;
    this.devices = this.devices.filter((d) => !d.dead);
    const dx = pl.x - e.x, dz = pl.z - e.z;
    const dist = Math.hypot(dx, dz) || 0.01;
    const nx = dx / dist, nz = dz / dist;
    this.stateT -= dt;
    this.updateLanes(dt);
    this.checkPhase([0.5]);
    const shielded = this.pylons.length > 0 && this.state !== 'overheat';
    e.dmgTakenMult = this.state === 'overheat' ? 1.6 : shielded ? 0.12 : 1;
    this.status = this.state === 'overheat' ? 'OVERHEATED — shields down, +60% damage!' : shielded ? 'Shielded — destroy the pylons' : '';
    if (!shielded) this.shieldDownT += dt; else this.shieldDownT = 0;

    switch (this.state) {
      case 'intro':
        if (this.stateT <= 0) {
          e.invuln = false;
          this.deploy('pylon', e.x + 7, e.z); this.deploy('pylon', e.x - 7, e.z);
          this.deploy('turret', e.x, e.z + 6);
          if (this.tier >= 2 || this.nightmare) this.deploy('pylon', e.x, e.z - 7);
          this.enter('idle', 0); this.attackT = 2;
        }
        break;
      case 'transition':
        if (this.stateT <= 1.1 && this.phase < this.pendingPhase) { this.phase = this.pendingPhase; this.model.glowMat.color.set('#ff7a3a'); for (const d of this.devices) if (d.type === 'turret') d.bossDevice = { tier: 2 }; }
        if (this.stateT <= 0) { e.invuln = false; this.enter('idle', 0); this.attackT = 0.6; }
        break;
      case 'idle': {
        const want = dist > 14 ? 1 : dist < 9 ? -1 : 0;
        const side = Math.sin(t * 0.6) > 0 ? 1 : -1;
        const sp = this.cfg.speed;
        e.x += (nx * want - nz * side * 0.7) * sp * dt; e.z += (nz * want + nx * side * 0.7) * sp * dt;
        const r = Math.hypot(e.x, e.z);
        if (r > ARENA_RADIUS - 4) { e.x -= e.x / r * sp * dt; e.z -= e.z / r * sp * dt; }
        this.faceTo(nx, nz, dt);
        this.attackT -= dt;
        if (this.attackT <= 0) this.chooseAttack();
        break;
      }
      case 'burst':
        this.faceTo(nx, nz, dt, 8);
        this.burstT -= dt;
        if (this.burstT <= 0 && this.shots > 0) {
          this.burstT = 0.16; this.shots--;
          const a = Math.atan2(nx, nz) + (Math.random() - 0.5) * 0.08;
          g.projectiles.spawnEnemy('turret', e.x + Math.sin(a) * 1.5, e.z + Math.cos(a) * 1.5, Math.sin(a), Math.cos(a), 15, this.shotDmg(this.cfg.shotDamage), 0.35, 3, '#ffd166');
          g.sound.play('enemyShot');
        }
        if (this.shots <= 0) this.recover(0.9);
        break;
      case 'barrageWind':
        if (Math.random() < 0.5) fx.particle(e.x, 2 + Math.random() * 2, e.z, (Math.random() - 0.5) * 3, 2, (Math.random() - 0.5) * 3, 0.4, 0.2, '#ffd166');
        if (this.stateT <= 0) { this.enter('barrage', 0); this.volleys = this.phase === 2 ? 4 : 3; this.volleyT = 0; this.mortars(); }
        break;
      case 'barrage':
        this.volleyT -= dt;
        if (this.volleyT <= 0 && this.volleys > 0) {
          const n = 16, off = this.volleys * 0.2;
          for (let i = 0; i < n; i++) {
            const a = off + (i / n) * Math.PI * 2;
            g.projectiles.spawnEnemy('turret', e.x + Math.sin(a) * 1.6, e.z + Math.cos(a) * 1.6, Math.sin(a), Math.cos(a), 9, this.shotDmg(this.cfg.shotDamage), 0.4, 5, '#ffd166');
          }
          g.sound.play('bossShot');
          this.volleys--; this.volleyT = 0.5;
        }
        if (this.volleys <= 0 && this.volleyT <= 0) {
          this.enter('overheat', 3.6 * (this.nightmare ? 0.85 : 1));
          g.ui.toast('Engineer overheated!', '#ffd166', 'Its shields are down — attack now.');
        }
        break;
      case 'overheat':
        if (Math.random() < 0.6) fx.particle(e.x + (Math.random() - 0.5) * 1.5, 3, e.z + (Math.random() - 0.5) * 1.5, 0, 3, 0, 0.8, 0.3, '#e0e0e0');
        if (this.stateT <= 0) { this.enter('idle', 0); this.attackT = 1.2 * this.aggression; }
        break;
      case 'recover':
        if (this.stateT <= 0) { this.enter('idle', 0); this.attackT = (1.1 + Math.random() * 0.6) * this.aggression; }
        break;
    }
    g.world.resolve(e, this.radius);
  }

  chooseAttack() {
    const g = this.game, e = this.e, pl = g.player;
    const turrets = this.devices.filter((d) => d.type === 'turret').length;
    const mines = this.devices.filter((d) => d.type === 'mine').length;
    const options = ['burst', 'barrage'];
    if (turrets < (this.phase === 2 ? 3 : 2)) options.push('turret', 'turret');
    if (mines < 8) options.push('mines');
    if (this.pylons.length === 0 && this.shieldDownT > 9) options.push('pylons', 'pylons', 'pylons');
    const pick = this.pick(options);
    if (pick === 'burst') { this.enter('burst', 0); this.shots = 6 + this.phase * 2; this.burstT = 0.3; }
    else if (pick === 'barrage') { this.enter('barrageWind', 1.4 * g.diff.telegraph); this.tele = null; g.effects.ring(e.x, e.z, 0.5, 3, 1.4, '#ffd166'); g.sound.play('windup'); }
    else if (pick === 'turret') {
      const a = Math.random() * Math.PI * 2;
      this.deploy('turret', e.x + Math.cos(a) * 5, e.z + Math.sin(a) * 5);
      this.recover(0.7);
    } else if (pick === 'mines') {
      const n = this.phase === 2 ? 6 : 4;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, d = 4 + Math.random() * 7;
        this.deploy('mine', pl.x + Math.cos(a) * d, pl.z + Math.sin(a) * d);
      }
      g.sound.play('click');
      this.recover(0.8);
    } else {
      for (let i = 0; i < 2; i++) { const a = Math.random() * Math.PI * 2; this.deploy('pylon', e.x + Math.cos(a) * 7, e.z + Math.sin(a) * 7); }
      g.ui.toast('Shield pylons deployed', '#5ad1ff', 'Destroy them to damage the Engineer.');
      this.recover(0.8);
    }
  }

  mortars() {
    const g = this.game, pl = g.player;
    for (let i = 0; i < 4; i++) {
      const a = Math.random() * Math.PI * 2, d = i === 0 ? 0 : 3.5 + Math.random() * 4;
      g.hazards.add({ x: pl.x + Math.cos(a) * d, z: pl.z + Math.sin(a) * d, r: 2.4, delay: 1.3 + i * 0.15, damage: this.shotDmg(16), color: '#ffd166', shell: { x: this.e.x, z: this.e.z, h: 7 } });
    }
  }

  render(t) {
    if (!this.active || !this.e) return;
    const m = this.model, e = this.e;
    m.group.position.set(e.x, Math.sin(t * 3) * 0.05, e.z);
    m.body.rotation.y = this.rot;
    const shielded = this.pylons.length > 0 && this.state !== 'overheat';
    m.bubble.visible = shielded;
    m.bubble.rotation.y = t;
    m.metal.emissive.setRGB(this.state === 'overheat' ? 0.6 + Math.sin(t * 10) * 0.2 : e.flash > 0 ? 0.5 : 0, this.state === 'overheat' ? 0.2 : e.flash > 0 ? 0.4 : 0, 0);
  }
}

export function createBosses(scene, game) {
  return { guardian: new Guardian(scene, game), devourer: new Devourer(scene, game), engineer: new Engineer(scene, game) };
}

