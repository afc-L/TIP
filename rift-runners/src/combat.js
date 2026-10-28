import { WEAPONS } from './config.js';

const near = [];

// Player weapons, on-hit effects (crit, burn, poison, explosions, chain lightning) and abilities.
export class Combat {
  constructor(game) {
    this.game = game;
    this.reset();
  }

  reset() {
    this.cd = { bolt: 0, arc: 0, orb: 0 };
  }

  weaponCooldown(id) {
    const s = this.game.stats;
    let base = WEAPONS[id].cooldown;
    if (id === 'arc') base *= Math.pow(0.9, Math.max(0, s.arc - 1));
    return base / s.fireRateMult;
  }

  update(dt, firing) {
    const g = this.game, s = g.stats;
    for (const k in this.cd) this.cd[k] = Math.max(0, this.cd[k] - dt);
    if (!firing || !g.player.alive) return;
    if (this.cd.bolt <= 0) { this.fireBolt(); this.cd.bolt = this.weaponCooldown('bolt'); }
    if (s.arc > 0 && this.cd.arc <= 0) { this.fireArc(); this.cd.arc = this.weaponCooldown('arc'); }
    if (s.orb > 0 && this.cd.orb <= 0) { this.fireOrb(); this.cd.orb = this.weaponCooldown('orb'); }
  }

  fireBolt() {
    const g = this.game, s = g.stats, p = g.player, w = WEAPONS.bolt;
    const n = 1 + s.extraProj;
    const spread = 0.13;
    const base = Math.atan2(p.aimX, p.aimZ);
    const color = s.burn ? '#ffa04a' : s.poison ? '#9dff6a' : s.chain ? '#9fe6ff' : '#b98cff';
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * spread;
      const dx = Math.sin(a), dz = Math.cos(a);
      g.projectiles.spawnPlayer('bolt', p.x + dx * 0.7, p.z + dz * 0.7, dx, dz,
        w.speed * s.projSpeedMult, w.damage * s.damageMult, w.life, w.radius, s.pierce, color);
    }
    g.effects.particle(p.x + p.aimX * 0.9, 1, p.z + p.aimZ * 0.9, p.aimX * 3, 0.5, p.aimZ * 3, 0.15, 0.25, color);
    g.sound.play('shoot');
  }

  fireOrb() {
    const g = this.game, s = g.stats, p = g.player, w = WEAPONS.orb;
    const lvl = s.orb;
    const count = lvl >= 4 ? 2 : 1;
    const pierce = lvl >= 4 ? 999 : lvl >= 2 ? 4 : 0;
    const dmg = w.damage * s.damageMult * (lvl >= 3 ? 1.35 : 1);
    const radius = w.radius * (lvl >= 3 ? 1.3 : 1);
    const base = Math.atan2(p.aimX, p.aimZ);
    for (let i = 0; i < count; i++) {
      const a = base + (i - (count - 1) / 2) * 0.35;
      const dx = Math.sin(a), dz = Math.cos(a);
      g.projectiles.spawnPlayer('orb', p.x + dx, p.z + dz, dx, dz, w.speed * s.projSpeedMult, dmg, w.life, radius, pierce, '#8a3cff');
    }
    g.sound.play('orb');
  }

  fireArc() {
    const g = this.game, s = g.stats, p = g.player, w = WEAPONS.arc;
    const lvl = s.arc;
    const radius = w.radius * (1 + 0.12 * (lvl - 1));
    const dmg = w.damage * s.damageMult * (1 + 0.3 * (lvl - 1));
    g.effects.ring(p.x, p.z, 0.5, radius, 0.35, '#7fe8ff', 0.3);
    g.effects.ring(p.x, p.z, 0.3, radius * 0.7, 0.25, '#ffffff', 0.5);
    g.enemies.grid.query(p.x, p.z, radius + 3, near);
    let hits = 0;
    for (const e of near) {
      if (e.dead) continue;
      const dx = e.x - p.x, dz = e.z - p.z;
      const r = radius + e.radius;
      if (dx * dx + dz * dz > r * r) continue;
      const d = Math.hypot(dx, dz) || 1;
      if (hits < 8) g.effects.lightning(p.x, 1, p.z, e.x, 0.8, e.z, '#9feaff');
      hits++;
      this.hit(e, dmg, { procs: false, status: true, kbX: dx / d, kbZ: dz / d, kb: 9 });
    }
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2, rr = Math.random() * radius;
      g.effects.particle(p.x + Math.cos(a) * rr, 0.4, p.z + Math.sin(a) * rr, 0, 3, 0, 0.3, 0.15, '#bff4ff');
    }
    g.sound.play('arc');
  }

  // Shift ability: knock enemies away, wipe nearby enemy bullets.
  pulse() {
    const g = this.game, p = g.player;
    if (p.pulseCd > 0) return;
    p.pulseCd = 10;
    const radius = 6.5;
    g.effects.ring(p.x, p.z, 0.5, radius, 0.45, '#c08bff', 0.2);
    g.effects.ring(p.x, p.z, 0.5, radius * 0.8, 0.35, '#ffffff', 0.4);
    g.effects.burst(p.x, 0.8, p.z, 24, '#c08bff', 12, 0.5, 0.2);
    g.projectiles.clearEnemyNear(p.x, p.z, radius + 1);
    g.enemies.grid.query(p.x, p.z, radius + 3, near);
    for (const e of near) {
      if (e.dead) continue;
      const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz) || 1;
      if (d > radius + e.radius) continue;
      this.hit(e, 15 * g.stats.damageMult, { procs: false, kbX: dx / d, kbZ: dz / d, kb: 18 });
    }
    g.effects.shake(0.25);
    g.sound.play('pulse');
  }

  projectileHit(p, e) {
    const g = this.game;
    this.hit(e, p.damage, { procs: true, status: true, kbX: p.vx, kbZ: p.vz, kb: p.kind === 'orb' ? 0.35 : 0.12, normKb: false });
    g.effects.burst(p.x, p.y, p.z, p.kind === 'orb' ? 6 : 3, p.kind === 'orb' ? '#b07bff' : '#e9dcff', 5, 0.25, 0.13);
  }

  // Core damage application. Handles crits and status/proc effects.
  hit(e, base, o = {}) {
    const g = this.game, s = g.stats;
    let dmg = base;
    let crit = false;
    if (o.canCrit !== false && Math.random() < s.critChance) {
      crit = true;
      let mult = s.critMult;
      if (s.syn.overload && s.extraProj > 0) mult += 0.75;
      dmg *= mult;
    }
    let kbX = o.kbX || 0, kbZ = o.kbZ || 0;
    if (o.normKb === false) { const l = Math.hypot(kbX, kbZ) || 1; kbX /= l; kbZ /= l; kbX *= (o.kb || 0) * 30; kbZ *= (o.kb || 0) * 30; }
    else { kbX *= o.kb || 0; kbZ *= o.kb || 0; }
    g.enemies.damage(e, dmg, crit ? 'crit' : 'normal', kbX, kbZ);
    if (crit) g.sound.play('crit'); else g.sound.play('hit');

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
      const f = [0.35, 0.5, 0.65][s.explode - 1];
      this.explode(e.x, e.z, r, base * f, false);
    }
    if (s.chain) {
      let chance = [0.2, 0.3, 0.4][s.chain - 1];
      let jumps = 2 + s.chain;
      if (s.syn.storm) { chance += 0.15; jumps += 2; }
      if (Math.random() < chance) this.chainLightning(e, base * 0.6, jumps);
    }
  }

  ignite(e) {
    const s = this.game.stats;
    const dps = [4, 7, 10][s.burn - 1] * s.damageMult * (s.syn.wildfire ? 1.5 : 1);
    e.burnT = 3;
    e.burnDps = Math.max(e.burnDps, dps);
  }

  explode(x, z, r, dmg, big) {
    const g = this.game;
    g.effects.ring(x, z, 0.2, r, 0.3, big ? '#c06bff' : '#ffb347', 0.3);
    g.effects.burst(x, 0.6, z, big ? 26 : 8, big ? '#c06bff' : '#ff9a3c', big ? 12 : 7, 0.4, big ? 0.3 : 0.18);
    g.sound.play('explode');
    if (big) g.effects.shake(0.2);
    g.enemies.grid.query(x, z, r + 3, near);
    const list = near.slice();
    for (const e of list) {
      if (e.dead) continue;
      const rr = r + e.radius;
      if ((e.x - x) ** 2 + (e.z - z) ** 2 > rr * rr) continue;
      g.enemies.damage(e, dmg, 'normal', 0, 0);
    }
  }

  chainLightning(start, dmg, jumps) {
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
      g.effects.lightning(cur.x, 1, cur.z, best.x, 1, best.z, '#a8eaff');
      g.enemies.damage(best, dmg, 'shock', 0, 0);
      cur = best;
    }
    g.sound.play('zap');
  }

  orbExpire(p) {
    const s = this.game.stats;
    if (s.syn.singularity) this.explode(p.x, p.z, 4.2, p.damage * 0.8, true);
  }
}
