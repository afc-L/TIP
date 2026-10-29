import * as THREE from 'three';
import { WEAPONS } from './config.js';
import { CLASSES } from './characters.js';
import { InstancePool } from './pool.js';

const near = [];
const tmpC = new THREE.Color();

// Player weapons, on-hit effects (crit, burn, poison, explosions, lightning), relic hooks,
// weapon evolutions and class abilities.
export class Combat {
  constructor(game) {
    this.game = game;
    const scene = game.scene;
    this.bladePool = new InstancePool(new THREE.OctahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), 12);
    scene.add(this.bladePool.mesh);
    // Slash arcs: a few pooled sector meshes with their own materials (created once).
    this.slashes = [];
    for (let i = 0; i < 6; i++) {
      const mesh = new THREE.Mesh(new THREE.RingGeometry(0.5, 1, 24, 1, -0.95, 1.9).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: '#ff7ab0', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      mesh.visible = false;
      scene.add(mesh);
      this.slashes.push({ mesh, t: 0, active: false });
    }
    this.reset();
  }

  reset() {
    this.cd = { bolt: 0, slash: 0, arc: 0, orb: 0, zap: 0, meteor: 0 };
    this.queue = [];
    this.attackCount = 0;
    this.bladeAngle = 0;
    this.gravityT = 7;
    this.glassBudget = 8;
    this.bloodBudget = 8; this.bloodT = 5;
    this.blockMsgT = 0;
    for (const s of this.slashes) { s.active = false; s.mesh.visible = false; }
  }

  // ---------------------------------------------------------------- multipliers
  rateMult() {
    const g = this.game, p = g.player;
    let r = g.stats.fireRateMult;
    if (p.overclockT > 0) r *= 1.6;
    if (g.run.buffs.fury > 0) r *= 1.35;
    return r;
  }

  // Damage multiplier that changes moment to moment (Last Stand, shrine buffs).
  dynDmg() {
    const g = this.game, p = g.player, s = g.stats;
    let m = 1;
    const thr = s.syn.crimson ? 0.5 : 0.35;
    if (s.relic.laststand && p.hp / p.maxHp < thr) m *= 1.4;
    if (g.run.buffs.fury > 0) m *= 1.3;
    return m;
  }

  weaponCooldown(id) {
    const s = this.game.stats, l = s.weapons[id] || 1;
    let base = WEAPONS[id].cooldown;
    if (id === 'bolt') base *= Math.pow(0.94, (l >= 2) + (l >= 4));
    if (id === 'slash' && l >= 4) base *= 0.9;
    if (id === 'arc') base *= Math.pow(0.9, l - 1);
    if (id === 'zap') base *= Math.pow(0.94, (l >= 3) + (l >= 5));
    return base / this.rateMult();
  }

  update(dt, firing) {
    const g = this.game, s = g.stats, p = g.player;
    for (const k in this.cd) this.cd[k] = Math.max(0, this.cd[k] - dt);
    for (let i = this.queue.length - 1; i >= 0; i--) {
      const q = this.queue[i];
      q.t -= dt;
      if (q.t <= 0) { this.queue.splice(i, 1); q.fn(); }
    }
    this.glassBudget = Math.min(8, this.glassBudget + dt * 8);
    this.bloodT -= dt;
    if (this.bloodT <= 0) { this.bloodT = 5; this.bloodBudget = 8; }
    this.blockMsgT -= dt;
    this.updateSlashes(dt);
    if (!p.alive) return;

    if (s.weapons.blades) this.updateBlades(dt);
    if (s.evolved.orb === 'horizon') this.horizonPull(dt);
    if (s.relic.gravity) {
      this.gravityT -= dt;
      if (this.gravityT <= 0) { this.gravityT = 7; this.gravityWell(); }
    }

    if (!firing) return;
    for (const id of ['bolt', 'slash', 'arc', 'orb', 'zap', 'meteor']) {
      if (!s.weapons[id] || this.cd[id] > 0) continue;
      this.fire(id, 1);
      this.cd[id] = this.weaponCooldown(id);
      if (s.relic.echo && ++this.attackCount % 5 === 0) {
        this.queue.push({ t: 0.15, fn: () => this.fire(id, 0.5) });
      }
    }
  }

  fire(id, scale) {
    switch (id) {
      case 'bolt': return this.fireBolt(scale);
      case 'slash': return this.fireSlash(scale);
      case 'arc': return this.fireArc(scale);
      case 'orb': return this.fireOrb(scale);
      case 'zap': return this.fireZap(scale);
      case 'meteor': return this.fireMeteor(scale);
    }
  }

  // ---------------------------------------------------------------- weapons
  fireBolt(scale = 1) {
    const g = this.game, s = g.stats, p = g.player, w = WEAPONS.bolt;
    const l = s.weapons.bolt;
    const n = 1 + s.extraProj;
    const spread = 0.13;
    const base = Math.atan2(p.aimX, p.aimZ);
    const dmg = w.damage * s.damageMult * s.projMult * (1 + 0.2 * (l - 1)) * scale;
    const pierce = s.pierce + (l >= 3) + (l >= 5);
    const color = s.evolved.bolt ? '#9fe6ff' : s.burn ? '#ffa04a' : s.poison ? '#9dff6a' : s.chain ? '#9fe6ff' : '#b98cff';
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * spread;
      const dx = Math.sin(a), dz = Math.cos(a);
      g.projectiles.spawnPlayer('bolt', p.x + dx * 0.7, p.z + dz * 0.7, dx, dz, w.speed * s.projSpeedMult, dmg, w.life, w.radius, pierce, color);
    }
    g.effects.particle(p.x + p.aimX * 0.9, 1, p.z + p.aimZ * 0.9, p.aimX * 3, 0.5, p.aimZ * 3, 0.15, 0.25, color);
    g.sound.play('shoot');
  }

  fireSlash(scale = 1, back = false) {
    const g = this.game, s = g.stats, p = g.player, w = WEAPONS.slash;
    const l = s.weapons.slash;
    const crimson = s.evolved.slash === 'crimsonarc';
    const range = w.range * (1 + 0.08 * Math.min(l - 1, 2));
    const half = (w.arc / 2) * (crimson ? 1.4 : 1);
    const dmg = w.damage * s.damageMult * (1 + 0.25 * Math.min(l - 1, 2)) * scale;
    const ax = back ? -p.aimX : p.aimX, az = back ? -p.aimZ : p.aimZ;
    const slot = this.slashes.find((q) => !q.active) || this.slashes[0];
    slot.active = true; slot.t = 0;
    slot.mesh.position.set(p.x, 0.9, p.z);
    slot.mesh.rotation.y = Math.atan2(ax, az) - Math.PI / 2;
    slot.mesh.scale.set(range * (crimson ? 1.15 : 1), 1, range * (crimson ? 1.15 : 1));
    slot.mesh.material.color.set(crimson ? '#ff2a4a' : g.player.trailColor || '#ff7ab0');
    slot.mesh.visible = true;
    g.enemies.grid.query(p.x, p.z, range + 3, near);
    const list = near.slice();
    let healed = 0;
    for (const e of list) {
      if (e.dead) continue;
      const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz) || 0.01;
      if (d > range + e.radius) continue;
      const cos = (dx * ax + dz * az) / d;
      if (cos < Math.cos(half) && d > e.radius + 0.6) continue;
      this.hit(e, dmg, { procs: true, status: true, kbX: dx / d, kbZ: dz / d, kb: 6, srcX: p.x, srcZ: p.z });
      if (crimson && healed < 3) { healed++; g.heal(1, true); }
    }
    g.sound.play('slash');
    if (l >= 5 && !back) this.queue.push({ t: 0.16, fn: () => this.fireSlash(scale * 0.7, true) });
  }

  updateSlashes(dt) {
    for (const s of this.slashes) {
      if (!s.active) continue;
      s.t += dt;
      const f = s.t / 0.18;
      if (f >= 1) { s.active = false; s.mesh.visible = false; continue; }
      s.mesh.material.opacity = 1 - f;
      s.mesh.rotation.y += dt * 4;
    }
  }

  fireOrb(scale = 1) {
    const g = this.game, s = g.stats, p = g.player, w = WEAPONS.orb;
    const lvl = s.weapons.orb;
    const count = lvl >= 4 ? 2 : 1;
    const pierce = lvl >= 4 ? 999 : lvl >= 2 ? 4 : 0;
    const dmg = w.damage * s.damageMult * s.projMult * (lvl >= 3 ? 1.35 : 1) * (lvl >= 5 ? 1.3 : 1) * scale;
    const radius = w.radius * (lvl >= 3 ? 1.3 : 1);
    const base = Math.atan2(p.aimX, p.aimZ);
    for (let i = 0; i < count; i++) {
      const a = base + (i - (count - 1) / 2) * 0.35;
      const dx = Math.sin(a), dz = Math.cos(a);
      g.projectiles.spawnPlayer('orb', p.x + dx, p.z + dz, dx, dz, w.speed * s.projSpeedMult, dmg, w.life, radius, pierce, '#8a3cff');
    }
    g.sound.play('orb');
  }

  fireArc(scale = 1) {
    const g = this.game, s = g.stats, p = g.player, w = WEAPONS.arc;
    const lvl = s.weapons.arc;
    const radius = w.radius * (1 + 0.12 * (lvl - 1)) * (s.evolved.arc ? 1.5 : 1);
    const dmg = w.damage * s.damageMult * (1 + 0.3 * (lvl - 1)) * scale;
    g.effects.ring(p.x, p.z, 0.5, radius, 0.35, '#7fe8ff', 0.3);
    g.effects.ring(p.x, p.z, 0.3, radius * 0.7, 0.25, '#ffffff', 0.5);
    g.enemies.grid.query(p.x, p.z, radius + 3, near);
    const list = near.slice();
    let hits = 0;
    for (const e of list) {
      if (e.dead) continue;
      const dx = e.x - p.x, dz = e.z - p.z;
      const r = radius + e.radius;
      if (dx * dx + dz * dz > r * r) continue;
      const d = Math.hypot(dx, dz) || 1;
      if (hits < 8) g.effects.lightning(p.x, 1, p.z, e.x, 0.8, e.z, '#9feaff');
      hits++;
      this.hit(e, dmg, { procs: false, status: true, kbX: dx / d, kbZ: dz / d, kb: 9, srcX: p.x, srcZ: p.z });
    }
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2, rr = Math.random() * radius;
      g.effects.particle(p.x + Math.cos(a) * rr, 0.4, p.z + Math.sin(a) * rr, 0, 3, 0, 0.3, 0.15, '#bff4ff');
    }
    g.sound.play('arc');
  }

  fireZap(scale = 1, second = false) {
    const g = this.game, s = g.stats, p = g.player, w = WEAPONS.zap;
    const lvl = s.weapons.zap;
    const thunder = s.evolved.zap === 'thunder';
    // Prefer the enemy nearest the cursor, otherwise the one nearest the player.
    let target = null, bd = 36;
    g.enemies.grid.query(g.aimPoint.x, g.aimPoint.z, 6, near);
    for (const e of near) {
      if (e.dead) continue;
      const d = (e.x - g.aimPoint.x) ** 2 + (e.z - g.aimPoint.z) ** 2;
      if (d < bd && (e.x - p.x) ** 2 + (e.z - p.z) ** 2 < w.range * w.range * 1.6) { bd = d; target = e; }
    }
    if (!target) {
      bd = w.range * w.range;
      g.enemies.grid.query(p.x, p.z, w.range + 2, near);
      for (const e of near) {
        if (e.dead) continue;
        const d = (e.x - p.x) ** 2 + (e.z - p.z) ** 2;
        if (d < bd) { bd = d; target = e; }
      }
    }
    if (!target) return;
    const dmg = w.damage * s.damageMult * s.projMult * (1 + 0.2 * (lvl - 1)) * scale * (s.relic.stormcore ? 1.2 : 1);
    const jumps = 3 + (lvl - 1) + s.chainBonus + (s.relic.stormcore ? 2 : 0) + (thunder ? 3 : 0);
    g.effects.lightning(p.x, 1.2, p.z, target.x, 1, target.z, '#c8f2ff');
    this.hit(target, dmg, { procs: true, status: true, srcX: p.x, srcZ: p.z, noChain: true });
    this.chainLightning(target, dmg * 0.85, jumps, '#c8f2ff');
    if (thunder && !second) this.queue.push({ t: 0.22, fn: () => this.fireZap(scale, true) });
  }

  fireMeteor(scale = 1) {
    const g = this.game, s = g.stats, p = g.player, w = WEAPONS.meteor;
    const lvl = s.weapons.meteor;
    const radius = w.radius * (1 + 0.08 * (lvl >= 5 ? 3 : Math.min(lvl - 1, 2)));
    const dmg = w.damage * s.damageMult * s.projMult * (1 + 0.25 * (lvl >= 5 ? 3 : Math.min(lvl - 1, 2))) * scale;
    let tx = g.aimPoint.x, tz = g.aimPoint.z;
    const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
    if (d > 15) { tx = p.x + dx / d * 15; tz = p.z + dz / d * 15; }
    const shatter = s.evolved.meteor === 'shatterfall';
    const drop = (x, z) => g.hazards.add({
      x, z, r: radius, delay: w.delay, damage: dmg, owner: 'player', meteor: true, color: '#5ad1ff',
      onDone: shatter ? (h) => {
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 + Math.random() * 0.3;
          this.queue.push({ t: 0.12 + i * 0.05, fn: () => this.explode(h.x + Math.cos(a) * radius * 1.1, h.z + Math.sin(a) * radius * 1.1, 1.8, dmg * 0.35, false, '#9fe6ff') });
        }
      } : null,
    });
    drop(tx, tz);
    if (lvl >= 4) {
      const a = Math.random() * Math.PI * 2;
      drop(tx + Math.cos(a) * radius * 1.6, tz + Math.sin(a) * radius * 1.6);
    }
    g.sound.play('windup');
  }

  updateBlades(dt) {
    const g = this.game, s = g.stats, p = g.player, w = WEAPONS.blades;
    const lvl = s.weapons.blades;
    const bramble = s.evolved.blades === 'bramble';
    const n = 1 + lvl + (bramble ? 2 : 0);
    const radius = w.radius * (bramble ? 1.3 : 1);
    const dmg = w.damage * s.damageMult * (1 + 0.15 * (lvl - 1));
    this.bladeAngle += dt * 3.3 * Math.min(1.5, this.rateMult());
    for (let i = 0; i < n; i++) {
      const a = this.bladeAngle + (i / n) * Math.PI * 2;
      const bx = p.x + Math.cos(a) * radius, bz = p.z + Math.sin(a) * radius;
      g.enemies.grid.query(bx, bz, 3, near);
      for (const e of near) {
        if (e.dead) continue;
        const r = e.radius + 0.7;
        if ((e.x - bx) ** 2 + (e.z - bz) ** 2 > r * r) continue;
        if (g.t - (e.bladeT || -9) < 0.35) continue;
        e.bladeT = g.t;
        this.hit(e, dmg, { procs: false, status: true, kbX: Math.cos(a), kbZ: Math.sin(a), kb: 4, srcX: bx, srcZ: bz });
      }
      if (bramble) g.projectiles.clearEnemyNear(bx, bz, 0.8);
    }
  }

  renderBlades(t) {
    const g = this.game, s = g.stats, p = g.player;
    this.bladePool.begin();
    if (s.weapons.blades && p.alive && (g.state === 'playing' || g.state === 'paused' || g.state === 'levelup' || g.state === 'modal')) {
      const bramble = s.evolved.blades === 'bramble';
      const n = 1 + s.weapons.blades + (bramble ? 2 : 0);
      const radius = WEAPONS.blades.radius * (bramble ? 1.3 : 1);
      tmpC.set(bramble ? '#7dff8a' : '#c08bff');
      for (let i = 0; i < n; i++) {
        const a = this.bladeAngle + (i / n) * Math.PI * 2;
        this.bladePool.push(p.x + Math.cos(a) * radius, 1, p.z + Math.sin(a) * radius, -a, 0.18, 0.12, 0.7, tmpC.r, tmpC.g, tmpC.b);
      }
    }
    this.bladePool.end();
  }

  horizonPull(dt) {
    const g = this.game;
    for (const p of g.projectiles.player) {
      if (p.kind !== 'orb') continue;
      g.enemies.grid.query(p.x, p.z, 5, near);
      for (const e of near) {
        if (e.dead || e.type === 'boss' || e.def?.device) continue;
        const dx = p.x - e.x, dz = p.z - e.z, d = Math.hypot(dx, dz) || 1;
        if (d > 4) continue;
        e.x += (dx / d) * 6 * dt; e.z += (dz / d) * 6 * dt;
      }
    }
  }

  gravityWell() {
    const g = this.game, p = g.player, s = g.stats;
    const px = p.x + p.aimX * 4.5, pz = p.z + p.aimZ * 4.5;
    g.effects.ring(px, pz, 8, 0.5, 0.5, '#b06bff', 0.3);
    g.effects.ring(px, pz, 6, 0.3, 0.4, '#ffffff', 0.4);
    g.sound.play('pulse');
    g.enemies.grid.query(px, pz, 11, near);
    for (const e of near.slice()) {
      if (e.dead || e.type === 'boss' || e.def?.device) continue;
      const dx = px - e.x, dz = pz - e.z, d = Math.hypot(dx, dz) || 1;
      if (d > 9) continue;
      const pull = Math.min(d, 6);
      e.x += dx / d * pull * 0.8; e.z += dz / d * pull * 0.8;
      this.hit(e, 10 * s.damageMult, { procs: false, canCrit: false });
    }
    if (s.syn.collapse) this.queue.push({ t: 0.45, fn: () => this.explode(px, pz, 3.2, 45 * s.damageMult, true) });
  }

  // ---------------------------------------------------------------- abilities
  ability() {
    const g = this.game, p = g.player;
    if (p.abilityCd > 0 || !p.alive) return;
    const cls = CLASSES[g.run.cls];
    p.abilityCd = cls.ability.cd;
    if (cls.ability.id === 'pulse') this.pulse();
    else if (cls.ability.id === 'phase') this.phaseStrike();
    else if (cls.ability.id === 'storm') this.thunderstorm();
    else if (cls.ability.id === 'bulwark') this.bulwark();
  }

  pulse() {
    const g = this.game, p = g.player;
    const radius = 6.5;
    g.effects.ring(p.x, p.z, 0.5, radius, 0.45, '#c08bff', 0.2);
    g.effects.ring(p.x, p.z, 0.5, radius * 0.8, 0.35, '#ffffff', 0.4);
    g.effects.burst(p.x, 0.8, p.z, 24, '#c08bff', 12, 0.5, 0.2);
    g.projectiles.clearEnemyNear(p.x, p.z, radius + 1);
    g.enemies.grid.query(p.x, p.z, radius + 3, near);
    for (const e of near.slice()) {
      if (e.dead) continue;
      const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz) || 1;
      if (d > radius + e.radius) continue;
      this.hit(e, 15 * g.stats.damageMult, { procs: false, kbX: dx / d, kbZ: dz / d, kb: 18 });
    }
    g.effects.shake(0.25);
    g.sound.play('pulse');
  }

  phaseStrike() {
    const g = this.game, p = g.player, s = g.stats;
    const sx = p.x, sz = p.z;
    let ex = sx, ez = sz;
    for (let d = 0.5; d <= 7; d += 0.5) {
      const x = sx + p.aimX * d, z = sz + p.aimZ * d;
      if (g.world.insideObstacle(x, z, p.radius) || Math.hypot(x, z) > g.safeRadius() - p.radius) break;
      ex = x; ez = z;
    }
    p.x = ex; p.z = ez;
    p.invuln = Math.max(p.invuln, 0.35);
    const len = Math.hypot(ex - sx, ez - sz) || 0.01;
    const dx = (ex - sx) / len, dz = (ez - sz) / len;
    g.enemies.grid.query((sx + ex) / 2, (sz + ez) / 2, len / 2 + 3, near);
    for (const e of near.slice()) {
      if (e.dead) continue;
      const px = e.x - sx, pz = e.z - sz;
      const along = Math.max(0, Math.min(len, px * dx + pz * dz));
      const cx = sx + dx * along, cz = sz + dz * along;
      if ((e.x - cx) ** 2 + (e.z - cz) ** 2 > (e.radius + 1.6) ** 2) continue;
      this.hit(e, 45 * s.damageMult, { procs: true, status: true, kbX: dz, kbZ: -dx, kb: 6 });
    }
    for (let i = 0; i < 16; i++) {
      const f = i / 15;
      g.effects.particle(sx + (ex - sx) * f, 1, sz + (ez - sz) * f, 0, 1, 0, 0.4, 0.3, '#ff7ab0');
    }
    g.effects.ring(ex, ez, 0.3, 2.5, 0.3, '#ff7ab0');
    g.sound.play('slash');
    g.sound.play('dash');
  }

  thunderstorm() {
    const g = this.game, p = g.player, s = g.stats;
    g.enemies.grid.query(p.x, p.z, 16, near);
    const targets = near.filter((e) => !e.dead).sort((a, b) => ((a.x - p.x) ** 2 + (a.z - p.z) ** 2) - ((b.x - p.x) ** 2 + (b.z - p.z) ** 2)).slice(0, 7);
    const dmg = 35 * s.damageMult * s.projMult;
    for (let i = 0; i < 7; i++) {
      const tgt = targets[i % Math.max(1, targets.length)];
      const a = Math.random() * Math.PI * 2;
      const x = tgt ? tgt.x : p.x + Math.cos(a) * 6, z = tgt ? tgt.z : p.z + Math.sin(a) * 6;
      this.queue.push({ t: i * 0.09, fn: () => {
        g.effects.lightning(x + 1, 14, z - 1, x, 0.2, z, '#c8f2ff');
        this.explode(x, z, 1.8, dmg, false, '#9fe6ff');
        g.sound.play('zap');
      } });
    }
  }

  bulwark() {
    const g = this.game, p = g.player;
    p.bulwarkT = 2.5;
    g.effects.ring(p.x, p.z, 0.5, 5, 0.5, '#ffd36b', 0.3);
    g.projectiles.clearEnemyNear(p.x, p.z, 4);
    g.enemies.grid.query(p.x, p.z, 8, near);
    for (const e of near.slice()) {
      if (e.dead) continue;
      const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz) || 1;
      if (d > 5 + e.radius) continue;
      this.hit(e, 12 * g.stats.damageMult, { procs: false, kbX: dx / d, kbZ: dz / d, kb: 16 });
    }
    g.sound.play('shield');
    g.sound.play('pulse');
  }

  onDash() {
    const g = this.game, s = g.stats, p = g.player;
    if (s.relic.overclock) p.overclockT = 2.5;
    if (s.evolved.arc === 'stormnova') this.fireArc(0.8);
  }

  // ---------------------------------------------------------------- hits
  projectileHit(p, e) {
    const g = this.game;
    const res = this.hit(e, p.damage, { procs: true, status: true, kbX: p.vx, kbZ: p.vz, kb: p.kind === 'orb' ? 0.35 : 0.12, normKb: false, srcX: p.x - p.vx * 0.06, srcZ: p.z - p.vz * 0.06 });
    if (res === 'blocked') { p.pierce = 0; return; }
    g.effects.burst(p.x, p.y, p.z, p.kind === 'orb' ? 6 : 3, p.kind === 'orb' ? '#b07bff' : '#e9dcff', 5, 0.25, 0.13);
    if (p.kind === 'bolt' && g.stats.evolved.bolt === 'tempest') this.chainLightning(e, p.damage * 0.6, 2, '#9fe6ff');
  }

  // Core damage application. Handles blocking, crits, status and proc effects.
  hit(e, base, o = {}) {
    const g = this.game, s = g.stats;
    if (e.dead) return;
    if (o.srcX !== undefined && g.enemies.blocks(e, o.srcX, o.srcZ)) {
      g.enemies.damage(e, base * 0.08, 'normal', 0, 0);
      if (this.blockMsgT <= 0) {
        this.blockMsgT = 0.4;
        g.effects.number(e.x, e.height + 0.9, e.z, 'BLOCKED', 'block');
        g.sound.play('clank');
      }
      g.effects.burst(e.x + Math.sin(e.rot) * 0.8, 1.2, e.z + Math.cos(e.rot) * 0.8, 3, '#cfe6ff', 6, 0.2, 0.12);
      return 'blocked';
    }
    let dmg = base * this.dynDmg();
    if (s.relic.hunter && (e.elite || e.miniboss || e.type === 'boss')) dmg *= 1.3;
    let crit = false;
    if (o.canCrit !== false && Math.random() < s.critChance) {
      crit = true;
      let mult = s.critMult;
      if (s.syn.overload && s.extraProj > 0) mult += 0.75;
      dmg *= mult;
    }
    let kbX = o.kbX || 0, kbZ = o.kbZ || 0;
    if (o.normKb === false) { const l = Math.hypot(kbX, kbZ) || 1; kbX = kbX / l * (o.kb || 0) * 30; kbZ = kbZ / l * (o.kb || 0) * 30; }
    else { kbX *= o.kb || 0; kbZ *= o.kb || 0; }
    g.enemies.damage(e, dmg, crit ? 'crit' : 'normal', kbX, kbZ);
    if (crit) g.sound.play('crit'); else g.sound.play('hit');
    if (crit && s.relic.glassstorm && this.glassBudget >= 1) {
      this.glassBudget -= 1;
      this.explode(e.x, e.z, 1.6, dmg * 0.4, false, '#bfe9ff');
    }

    if (o.status) {
      if (s.burn) this.ignite(e);
      if (s.poison) {
        e.poisonStacks = Math.min(5, e.poisonStacks + 1);
        e.poisonT = 4;
        e.poisonDps = [1.5, 2.5, 3.5][s.poison - 1] * s.damageMult;
      }
    }
    if (!o.procs) return;
    if (s.syn.wildfire && s.burn) {
      g.enemies.grid.query(e.x, e.z, 5, near);
      for (const n of near) if (n !== e && !n.dead && (n.x - e.x) ** 2 + (n.z - e.z) ** 2 < 6.25) this.ignite(n);
      g.effects.burst(e.x, 0.8, e.z, 5, '#ff8a2a', 4, 0.35, 0.16);
    }
    if (s.explode) {
      const r = [1.8, 2.3, 2.8][s.explode - 1];
      const f = [0.3, 0.45, 0.6][s.explode - 1];
      this.explode(e.x, e.z, r, base * f, false);
    }
    if (s.chain && !o.noChain) {
      let chance = [0.2, 0.3, 0.4][s.chain - 1];
      let jumps = 2 + s.chain + s.chainBonus + (s.relic.stormcore ? 2 : 0);
      if (s.syn.storm) { chance += 0.15; jumps += 2; }
      if (s.syn.superconductor) chance += 0.15;
      const mult = (s.relic.stormcore ? 1.2 : 1) * (s.syn.superconductor ? 1.3 : 1);
      if (Math.random() < chance) this.chainLightning(e, base * 0.6 * mult, jumps);
    }
  }

  ignite(e) {
    const s = this.game.stats;
    const lvl = Math.max(1, s.burn);
    const dps = [4, 7, 10][lvl - 1] * s.damageMult * (s.syn.wildfire ? 1.5 : 1) * (s.relic.ember ? 1.4 : 1);
    e.burnT = 3;
    e.burnDps = Math.max(e.burnDps, dps);
  }

  explode(x, z, r, dmg, big, color) {
    const g = this.game;
    g.effects.ring(x, z, 0.2, r, 0.3, color || (big ? '#c06bff' : '#ffb347'), 0.3);
    g.effects.burst(x, 0.6, z, big ? 26 : 8, color || (big ? '#c06bff' : '#ff9a3c'), big ? 12 : 7, 0.4, big ? 0.3 : 0.18);
    g.sound.play('explode');
    if (big) g.effects.shake(0.2);
    g.enemies.grid.query(x, z, r + 3, near);
    const list = near.slice();
    for (const e of list) {
      if (e.dead) continue;
      const rr = r + e.radius;
      if ((e.x - x) ** 2 + (e.z - z) ** 2 > rr * rr) continue;
      g.enemies.damage(e, dmg * this.dynDmg(), 'normal', 0, 0);
    }
  }

  chainLightning(start, dmg, jumps, color = '#a8eaff') {
    const g = this.game;
    const visited = new Set([start.id]);
    let cur = start;
    for (let j = 0; j < jumps; j++) {
      g.enemies.grid.query(cur.x, cur.z, 8, near);
      let best = null, bd = 64;
      for (const e of near) {
        if (e.dead || visited.has(e.id)) continue;
        const d = (e.x - cur.x) ** 2 + (e.z - cur.z) ** 2;
        if (d < bd) { bd = d; best = e; }
      }
      if (!best) break;
      visited.add(best.id);
      g.effects.lightning(cur.x, 1, cur.z, best.x, 1, best.z, color);
      g.enemies.damage(best, dmg * this.dynDmg(), 'shock', 0, 0);
      cur = best;
    }
    g.sound.play('zap');
  }

  orbExpire(p) {
    const s = this.game.stats;
    if (s.syn.singularity) this.explode(p.x, p.z, 4.2, p.damage * 0.8, true);
  }

  // Thorn Armor reflects part of melee damage back at the attacker.
  onContactHit(e, taken) {
    const g = this.game, s = g.stats, p = g.player;
    if (!s.relic.thorn || e.dead) return;
    const mult = s.syn.spiked && p.shield > 0 ? 1.5 : 0.6;
    g.enemies.damage(e, Math.max(8, taken * mult), 'normal', 0, 0);
    g.effects.burst(e.x, 1, e.z, 5, '#7dff8a', 5, 0.3, 0.14);
  }

  onKill() {
    const g = this.game, s = g.stats;
    if (s.relic.blood && this.bloodBudget > 0) {
      const amt = s.syn.crimson && g.player.hp / g.player.maxHp < 0.5 ? 2 : 1;
      this.bloodBudget -= amt;
      g.heal(amt, true);
    }
  }
}
