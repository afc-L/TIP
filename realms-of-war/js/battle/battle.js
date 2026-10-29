// Battle simulation: engagement detection, melee & missile combat, morale, routing, victory.
// Rendering-agnostic so the same code can run headless.
(function () {
  const RW = window.RW;
  const U = RW.util;
  const D = RW.data;

  const MELEE_RATE = 0.22;

  class Battle {
    // cfg: { mapType, seed, attackerSide, difficulty, timeLimit, sides: [{faction, units:[spec], commander, upgrades, isPlayer}] }
    constructor(cfg) {
      this.cfg = cfg;
      this.time = 0;
      this.phase = 'deploy';
      this.speed = 1;
      this.siege = cfg.mapType === 'siege';
      this.attackerSide = cfg.attackerSide == null ? 0 : cfg.attackerSide;
      this.defenderSide = 1 - this.attackerSide;
      this.map = new RW.BattleMap(cfg.mapType, cfg.seed || Math.floor(Math.random() * 1e9), { attackerSide: this.attackerSide });
      // Player normally deploys in the south; in sieges the defender holds the walled north.
      this.sideNorth = this.siege ? [this.attackerSide !== 0, this.attackerSide === 0] : [false, true];
      this.timeLimit = cfg.timeLimit || (this.siege ? 22 * 60 : 20 * 60);
      this.units = [];
      this.projectiles = [];
      this.pending = [];
      this.fx = [];
      this.messages = [];
      this.result = null;
      this.listeners = {};
      this.visTimer = 0; this.endTimer = 0;
      this.sides = cfg.sides.map((s, idx) => {
        const fac = D.FACTIONS[s.faction];
        const upgrades = (s.upgrades || []).map((id) => (D.UPGRADES[s.faction] || []).find((u) => u.id === id)).filter(Boolean);
        let cdMul = 1;
        if (s.faction === 'arcane') cdMul *= 0.85;
        if (s.commander && s.commander.trait === 'spellweaver') cdMul *= 0.75;
        for (const up of upgrades) if (up.apply.cdMul) cdMul *= up.apply.cdMul;
        return {
          idx, faction: s.faction, fac, isPlayer: !!s.isPlayer, commander: s.commander || { name: 'Commander', trait: null, level: 1 },
          upgrades, general: null, generalDead: false, generalDeadT: 0,
          abilities: fac.abilities.map((id) => ({ id, def: D.ABILITIES[id], cd: s.isPlayer ? 0 : 6, cdMax: D.ABILITIES[id].cd * cdMul })),
          startPower: 0, kills: 0, isAIControlled: !s.isPlayer,
        };
      });
      for (let s = 0; s < 2; s++) this.createArmy(s);
      for (let s = 0; s < 2; s++) this.autoDeploy(s);
      for (const sd of this.sides) sd.startPower = this.sidePower(sd.idx);
      this.updateVisibility();
      this.ai = [null, new RW.BattleAI(this, 1, cfg.difficulty || 'normal')];
      if (cfg.aiBoth) this.ai[0] = new RW.BattleAI(this, 0, cfg.difficulty0 || cfg.difficulty || 'normal');
    }

    on(ev, fn) { (this.listeners[ev] = this.listeners[ev] || []).push(fn); }
    emit(ev, a, b) { for (const fn of this.listeners[ev] || []) fn(a, b); }
    msg(text, side = 0, kind = 'info') { this.messages.push({ text, side, kind, t: this.time }); this.emit('message', { text, side, kind }); }

    createArmy(s) {
      const sd = this.sides[s];
      const c = this.cfg.sides[s];
      const mods = { upgrades: sd.upgrades, trait: sd.commander.trait, cmdLevel: sd.commander.level || 1 };
      const gen = new RW.Unit(this, s, { typeId: sd.fac.general, faction: sd.faction, hpFrac: c.generalHp == null ? 1 : Math.max(0.25, c.generalHp), rank: Math.min(3, Math.floor((sd.commander.level || 1) / 3)) }, mods);
      gen.name = sd.commander.name;
      sd.general = gen;
      this.units.push(gen);
      for (const spec of c.units) {
        const u = new RW.Unit(this, s, Object.assign({ faction: sd.faction }, spec), mods);
        this.units.push(u);
      }
    }

    // Arrange an army in its deployment zone: infantry front, missiles behind, cavalry on the wings.
    autoDeploy(s) {
      const north = this.sideNorth[s];
      const z0 = this.map.deployZone(north);
      const dir = north ? 1 : -1; // toward the enemy along z
      const facing = north ? 0 : Math.PI;
      const front = north ? z0.z1 - 8 : z0.z0 + 8;
      const mine = this.units.filter((u) => u.side === s);
      const rows = { front: [], second: [], wings: [], back: [] };
      for (const u of mine) {
        if (u.cat === 'inf' || u.cat === 'monster') rows.front.push(u);
        else if (u.cat === 'ranged') rows.second.push(u);
        else if (u.cat === 'cav') rows.wings.push(u);
        else rows.back.push(u);
      }
      const layRow = (list, zRow, xCenter = 0) => {
        const widths = list.map((u) => u.hw * 2 + 4);
        let total = widths.reduce((a, b) => a + b, 0);
        let x = xCenter - total / 2;
        list.forEach((u, i) => {
          const cx = U.clamp(x + widths[i] / 2, z0.x0 + 4, z0.x1 - 4);
          u.placeAt(cx, zRow, facing);
          x += widths[i];
        });
      };
      // Interleave so the strongest infantry sits in the centre.
      rows.front.sort((a, b) => b.base.power - a.base.power);
      const centred = [];
      rows.front.forEach((u, i) => (i % 2 ? centred.push(u) : centred.unshift(u)));
      layRow(centred, front);
      layRow(rows.second, front - dir * 16);
      const frontW = centred.reduce((a, u) => a + u.hw * 2 + 4, 0);
      rows.wings.forEach((u, i) => {
        const side = i % 2 ? 1 : -1;
        const k = Math.floor(i / 2);
        const x = U.clamp(side * (frontW / 2 + 14 + k * 22), z0.x0 + 6, z0.x1 - 6);
        u.placeAt(x, front - dir * 6, facing);
      });
      layRow(rows.back, front - dir * 32);
    }

    // ---------------------------------------------------------------- queries
    sidePower(s) {
      let p = 0;
      for (const u of this.units) if (u.side === s && u.active) p += u.base.power * u.hpFrac;
      return p;
    }
    enemiesOf(s) { return this.units.filter((u) => u.side !== s && !u.gone); }
    isVisible(u, toSide = 0) {
      if (u.side === toSide) return true;
      return !u.hidden;
    }
    unitAtPoint(x, z, pred) {
      let best = null, bd = Infinity;
      for (const u of this.units) {
        if (u.gone || (pred && !pred(u))) continue;
        if (Math.hypot(u.x - x, u.z - z) > u.radius + 8) continue;
        for (let i = 0; i < u.count; i++) {
          if (!u.sa[i]) continue;
          const d = (u.sx[i] - x) ** 2 + (u.sz[i] - z) ** 2;
          if (d < bd) { bd = d; best = u; }
        }
      }
      const thr = best && best.large ? 4.5 : 3;
      return bd < thr * thr ? best : null;
    }
    // Which side of b is a attacking from: 'front' | 'flank' | 'rear'.
    attackDir(b, ax, az) {
      const ang = Math.atan2(ax - b.x, az - b.z);
      const d = Math.abs(U.wrapAngle(ang - b.facing));
      return d < 1.0 ? 'front' : d > 2.2 ? 'rear' : 'flank';
    }

    // ---------------------------------------------------------------- orders (used by UI & AI)
    // Work out where each unit of a group should stand. width != null means "single line across a drag".
    planGroupMove(units, x, z, facing = null, width = null) {
      units = units.filter((u) => !u.gone && u.state !== 'routing');
      if (!units.length) return [];
      const cx = units.reduce((a, u) => a + u.x, 0) / units.length;
      const cz = units.reduce((a, u) => a + u.z, 0) / units.length;
      if (facing == null) facing = (Math.hypot(x - cx, z - cz) > 3) ? Math.atan2(x - cx, z - cz) : units[0].facing;
      const c = Math.cos(facing), s = Math.sin(facing);
      const plan = [];
      if (width != null || units.length === 1) {
        const sorted = units.slice().sort((a, b) => (a.x * c - a.z * s) - (b.x * c - b.z * s));
        const widths = sorted.map((u) => u.hw * 2 + 3);
        const total = Math.max(width || 0, widths.reduce((a, b) => a + b, 0));
        const scale = total / widths.reduce((a, b) => a + b, 0);
        let off = -total / 2;
        sorted.forEach((u, i) => {
          const w = widths[i] * scale;
          const lx = off + w / 2; off += w;
          plan.push({ u, x: x + lx * c, z: z - lx * s, facing });
        });
        return plan;
      }
      // Keep the group's current shape, rotated to the new facing.
      let sx = 0, sy = 0;
      for (const u of units) { sx += Math.sin(u.facing); sy += Math.cos(u.facing); }
      const gf = Math.atan2(sx, sy);
      const gc = Math.cos(gf), gs = Math.sin(gf);
      for (const u of units) {
        let lx = (u.x - cx) * gc - (u.z - cz) * gs;
        let lz = (u.x - cx) * gs + (u.z - cz) * gc;
        const m = Math.hypot(lx, lz);
        if (m > 70) { lx *= 70 / m; lz *= 70 / m; }
        plan.push({ u, x: x + lx * c + lz * s, z: z - lx * s + lz * c, facing });
      }
      return plan;
    }
    orderGroupMove(units, x, z, facing = null, width = null) {
      const plan = this.planGroupMove(units, x, z, facing, width);
      for (const p of plan) this.issueMove(p.u, p.x, p.z, p.facing);
      return plan;
    }
    issueMove(u, x, z, facing) {
      if (this.phase === 'deploy' && this.sides[u.side].isPlayer) {
        const zn = this.map.deployZone(this.sideNorth[u.side]);
        u.placeAt(U.clamp(x, zn.x0, zn.x1), U.clamp(z, zn.z0, zn.z1), facing);
      } else u.orderMove(x, z, facing);
    }
    orderAttack(units, target) {
      for (const u of units) {
        if (this.phase === 'deploy') continue;
        u.orderAttack(target);
      }
    }
    setFormation(units, f) {
      for (const u of units) {
        if (u.gone || u.state === 'routing') continue;
        if (u.cat === 'monster' || u.cat === 'siege') continue;
        u.formation = f; u.reslot();
        if (this.phase === 'deploy') u.placeAt(u.x, u.z, u.facing);
      }
    }

    start() {
      if (this.phase !== 'deploy') return;
      this.phase = 'battle';
      this.emit('start');
      this.msg('The battle has begun!', 0, 'big');
    }

    // ---------------------------------------------------------------- main step
    step(dt) {
      if (this.phase !== 'battle') return;
      this.time += dt;
      for (const u of this.units) {
        if (u.buffs.length) { for (const b of u.buffs) b.t -= dt; u.buffs = u.buffs.filter((b) => b.t > 0); }
        u.recentLoss *= Math.exp(-dt / 6);
      }
      for (const sd of this.sides) for (const a of sd.abilities) a.cd = Math.max(0, a.cd - dt);
      for (const ai of this.ai) if (ai) ai.update(dt);
      this.computeEngagements();
      for (const u of this.units) if (!u.gone) this.updateUnit(u, dt);
      this.resolveMelee(dt);
      for (const u of this.units) if (!u.gone) this.updateRanged(u, dt);
      if (this.siege) this.updateTowers(dt);
      this.updatePending(dt);
      this.updateProjectiles(dt);
      for (const u of this.units) if (!u.gone) this.updateMorale(u, dt);
      for (const u of this.units) if (!u.gone) u.updateSoldiers(dt, this.time);
      this.visTimer -= dt;
      if (this.visTimer <= 0) { this.visTimer = 0.4; this.updateVisibility(); }
      this.checkEnd(dt);
    }

    updateVisibility() {
      // Units in forests are hidden from the enemy unless an enemy is close or they recently fired.
      for (const u of this.units) {
        if (u.gone) continue;
        let hidden = false;
        if (this.map.inForest(u.x, u.z) && !u.engaged.size && !u.engagedBy.size && this.time - u.lastShotT > 4 && u.state !== 'routing') {
          hidden = true;
          for (const e of this.units) {
            if (e.side === u.side || e.gone) continue;
            if (Math.hypot(e.x - u.x, e.z - u.z) < 42) { hidden = false; break; }
          }
        }
        u.hidden = hidden;
      }
    }

    // Contacts between opposing regiments, measured soldier to soldier.
    computeEngagements() {
      const units = this.units;
      for (const u of units) {
        u.prevEngaged = new Set(u.engaged.keys());
        u.engaged.clear(); u.engagedBy.clear();
      }
      for (let i = 0; i < units.length; i++) {
        const a = units[i];
        if (a.gone) continue;
        for (let j = i + 1; j < units.length; j++) {
          const b = units[j];
          if (b.gone || b.side === a.side) continue;
          const dc = Math.hypot(a.x - b.x, a.z - b.z);
          if (dc > a.radius + b.radius + 6) continue;
          const ra = 1.7 + (a.large ? 1.3 : 0) + (b.large ? 1.0 : 0);
          const rb = 1.7 + (b.large ? 1.3 : 0) + (a.large ? 1.0 : 0);
          const ca = this.contactCount(a, b, ra);
          const cb = this.contactCount(b, a, rb);
          if (ca > 0 && a.state !== 'routing') { a.engaged.set(b, ca); b.engagedBy.add(a); }
          if (cb > 0 && b.state !== 'routing') { b.engaged.set(a, cb); a.engagedBy.add(b); }
        }
      }
    }
    contactCount(a, b, reach) {
      const r2 = reach * reach;
      const lim = b.radius + reach + 1;
      let n = 0;
      for (let i = 0; i < a.count; i++) {
        if (!a.sa[i]) continue;
        const x = a.sx[i], z = a.sz[i];
        if (Math.abs(x - b.x) > lim || Math.abs(z - b.z) > lim) continue;
        for (let k = 0; k < b.count; k++) {
          if (!b.sa[k]) continue;
          if ((b.sx[k] - x) ** 2 + (b.sz[k] - z) ** 2 < r2) { n++; break; }
        }
      }
      return n;
    }

    // ---------------------------------------------------------------- unit behaviour
    updateUnit(u, dt) {
      if (u.state === 'routing') { this.updateRouting(u, dt); return; }
      u.disengageT = Math.max(0, u.disengageT - dt);
      // New contacts: resolve charges.
      for (const b of u.engaged.keys()) if (!u.prevEngaged.has(b)) this.onContact(u, b);
      for (const [id, c] of u.chargeT) { c.t -= dt; if (c.t <= 0) u.chargeT.delete(id); }

      if (u.engaged.size > 0 || u.engagedBy.size > 0) u.lastMeleeT = this.time;
      // Small hysteresis so flickering contacts don't toggle the regiment in and out of melee.
      const inMelee = (u.engaged.size > 0 || u.engagedBy.size > 0 || this.time - u.lastMeleeT < 0.6) && u.disengageT <= 0;
      if (inMelee) {
        u.state = 'fighting';
        // Keep fighting what we were told to attack if it's in contact; otherwise the strongest contact.
        let tgt = u.meleeTarget && u.engaged.has(u.meleeTarget) ? u.meleeTarget : null;
        if (!tgt) { let bc = 0; for (const [e, c] of u.engaged) if (c > bc) { bc = c; tgt = e; } }
        if (!tgt) for (const e of u.engagedBy) { tgt = e; break; }
        if (tgt) {
          if (u.cat === 'monster' || u.alive <= 4) u.facing = U.turnToward(u.facing, Math.atan2(tgt.x - u.x, tgt.z - u.z), dt);
          // Drift the centre toward the fight so rear ranks push in.
          const dx = tgt.x - u.x, dz = tgt.z - u.z, d = Math.hypot(dx, dz);
          const want = u.hd + tgt.hd + 0.5;
          if (d > want) {
            const nx = u.x + (dx / d) * dt * 0.8, nz = u.z + (dz / d) * dt * 0.8;
            if (!this.map.blocked(nx, nz, u.side)) { u.x = nx; u.z = nz; }
          }
        }
        u.foeTimer -= dt;
        if (u.foeTimer <= 0) { u.foeTimer = 0.35; u.pickFoes(); }
        u.speedSmooth *= Math.exp(-dt * 3);
        return;
      }
      for (let i = 0; i < u.count; i++) u.sfoe[i] = -1;

      const o = u.order;
      if (o.type === 'move') {
        const moving = u.moveCenter(dt);
        u.state = moving ? 'moving' : 'idle';
        if (!moving) {
          if (o.facing != null) {
            u.facing = U.turnToward(u.facing, o.facing, 1.6 * dt);
            if (Math.abs(U.wrapAngle(u.facing - o.facing)) < 0.02) u.order = { type: 'idle', facing: o.facing };
          } else u.order = { type: 'idle' };
        }
        return;
      }
      if (o.type === 'attack') {
        const tg = o.target;
        if (!tg || tg.gone || (tg.hidden && u.side === 0 && false)) { u.order = { type: 'idle' }; u.state = 'idle'; return; }
        const d = Math.hypot(tg.x - u.x, tg.z - u.z);
        if (u.t.range && u.ammo > 0 && u.rangedTarget === tg) {
          const rng = this.effRange(u, tg);
          if (d <= rng * 0.95) {
            u.path = [];
            u.state = 'shooting';
            u.facing = U.turnToward(u.facing, Math.atan2(tg.x - u.x, tg.z - u.z), 1.5 * dt);
            return;
          }
        }
        u.repathT -= dt;
        const gx = tg.x, gz = tg.z;
        if (u.repathT <= 0 || u.pathIdx >= u.path.length || (u.pathGoal && Math.hypot(u.pathGoal.x - gx, u.pathGoal.z - gz) > 6)) {
          // Aim slightly in front of the target so we close to contact distance.
          u.computePath(gx, gz);
        }
        const moving = u.moveCenter(dt);
        u.state = moving ? 'moving' : 'idle';
        // Siege attackers stuck at the gate automatically batter it.
        if (this.siege && this.map.gate && this.map.gate.hp > 0 && u.side === this.attackerSide && u.path.partial && Math.hypot(u.x - this.map.gate.x, u.z - this.map.gate.z) < 12) u.orderGate();
        return;
      }
      if (o.type === 'gate') {
        const g = this.map.gate;
        if (!g || g.hp <= 0) { u.order = { type: 'idle' }; u.state = 'idle'; return; }
        if (o.ranged) {
          const dg = Math.hypot(g.x - u.x, g.z - u.z);
          if (dg <= u.t.range * 0.95 || u.pathIdx >= u.path.length) {
            u.path = []; u.state = 'shooting';
            u.facing = U.turnToward(u.facing, Math.atan2(g.x - u.x, g.z - u.z), 1.2 * dt);
          } else { u.moveCenter(dt); u.state = 'moving'; }
          return;
        }
        const d = Math.hypot(u.x - o.x, u.z - o.z);
        if (d > 3 && u.pathIdx < u.path.length) { u.moveCenter(dt); u.state = 'moving'; }
        else {
          u.state = 'gate';
          u.facing = U.turnToward(u.facing, Math.atan2(g.x - u.x, g.z - u.z), 2 * dt);
          if (u.pathIdx >= u.path.length && d > 6) u.computePath(o.x, o.z);
        }
        return;
      }
      // Idle
      u.state = 'idle';
      if (o.facing != null) u.facing = U.turnToward(u.facing, o.facing, 1.6 * dt);
      if (!u.hold && !this.sides[u.side].isAIControlled && this.phase === 'battle') this.autoEngage(u);
    }

    // Idle player units react to nearby enemies (pursuing routers, defending themselves).
    autoEngage(u) {
      if (u.t.range && u.ammo > 0) return; // missile units auto-fire instead
      if (u.cat === 'siege') return;
      let best = null, bd = Infinity;
      for (const e of this.units) {
        if (e.side === u.side || e.gone || e.hidden) continue;
        const d = Math.hypot(e.x - u.x, e.z - u.z) - e.radius;
        const lim = e.state === 'routing' ? 28 : 14;
        if (d < lim && d < bd) { bd = d; best = e; }
      }
      if (best) { u.orderAttack(best); u.order.auto = true; }
    }

    updateRouting(u, dt) {
      u.routT += dt;
      const north = this.sideNorth[u.side];
      const edgeZ = north ? -this.map.half + 3 : this.map.half - 3;
      if (!u.path.length || u.pathIdx >= u.path.length || u.repathT <= 0) {
        // Flee away from the nearest enemy, toward our own edge.
        u.computePath(U.clamp(u.x + (Math.random() - 0.5) * 30, -100, 100), edgeZ);
        u.repathT = 3;
      }
      u.repathT -= dt;
      u.moveCenter(dt);
      if (Math.abs(u.z - edgeZ) < 6 || (u.pathIdx >= u.path.length && Math.abs(u.z - edgeZ) < 14)) {
        u.state = 'escaped';
        this.emit('escaped', u);
        return;
      }
      // Rally?
      if (!u.shattered && u.routT > 10) {
        let near = false;
        for (const e of this.units) if (e.side !== u.side && !e.gone && e.active && Math.hypot(e.x - u.x, e.z - u.z) < 30) { near = true; break; }
        if (!near && u.moraleTarget > 25) this.rally(u);
      }
    }
    rally(u, morale = 32) {
      u.state = 'idle'; u.morale = morale; u.order = { type: 'idle' }; u.path = [];
      this.msg(`${u.name} ${u.side === 0 ? 'have' : '(enemy) have'} rallied!`, u.side);
      this.fx.push({ type: 'rally', unit: u });
    }

    onContact(a, b) {
      // Charges: fast-moving units smash into the enemy.
      if (a.t.charge < 8 || a.state === 'routing') return;
      const fast = a.speedSmooth > a.t.speed * 0.55;
      if (!fast) return;
      // One impact per target, and only when coming in fresh (not already brawling).
      const last = a.chargeHist.get(b.id);
      if (last != null && this.time - last < 12) return;
      if (this.time - a.lastMeleeT < 1.2 && a.prevEngaged.size) return;
      a.chargeHist.set(b.id, this.time);
      const dir = this.attackDir(b, a.x, a.z);
      let mult = a.buffMul('chargeMul');
      if (dir === 'front') {
        mult *= b.form.chargeTaken;
        if (a.large && b.t.antiLarge > 0 && b.state !== 'routing') {
          mult *= 0.45;
          a.damage(b.t.antiLarge * Math.min(b.alive, 12) * 0.9, b.x, b.z, b);
        }
      } else mult *= dir === 'rear' ? 1.35 : 1.2;
      const contact = Math.max(3, Math.min(a.alive, a.engaged.get(b) || 3));
      a.chargeT.set(b.id, { t: 4, mult });
      const burst = contact * a.t.charge * 0.18 * mult * (b.large ? 0.6 : 1) * (1 - b.t.armor / 250);
      b.damage(burst, a.x, a.z, a);
      b.morale -= a.t.charge * 0.35 * mult;
      // Knock the struck soldiers back.
      const fx = Math.sin(a.facing), fz = Math.cos(a.facing);
      for (let k = 0; k < b.count; k++) {
        if (!b.sa[k]) continue;
        if (Math.hypot(b.sx[k] - a.x, b.sz[k] - a.z) > a.radius + 3) continue;
        const push = 1.5 * Math.min(1.5, mult);
        const nx = b.sx[k] + fx * push, nz = b.sz[k] + fz * push;
        if (!this.map.blocked(nx, nz, b.side)) { b.sx[k] = nx; b.sz[k] = nz; }
      }
      this.fx.push({ type: 'charge', x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, side: a.side });
      this.emit('charge', a, b);
    }

    heightAdv(a, b) {
      const dh = this.map.heightAt(a.x, a.z) - this.map.heightAt(b.x, b.z);
      return U.clamp(dh / 8, -0.15, 0.25);
    }

    resolveMelee(dt) {
      for (const a of this.units) {
        if (a.gone || a.state === 'routing') continue;
        for (const [b, contact] of a.engaged) {
          if (b.gone) continue;
          const dir = this.attackDir(b, a.x, a.z);
          const hAdv = this.heightAdv(a, b);
          let atk = a.t.atk + a.buffVal('atk') + hAdv * 30 + (b.large ? a.t.antiLarge * 0.5 : 0);
          let def = b.t.def + b.form.def + b.buffVal('def') + a.form.def * 0 - (dir === 'flank' ? 12 : dir === 'rear' ? 24 : 0);
          if (b.state === 'routing') def = 0;
          if (a.form === RW.FORMATIONS.loose) atk -= 4;
          let hit = U.clamp(0.35 + (atk - def) / 110, 0.08, 0.92);
          let dmg = a.t.dmg * a.buffMul('dmgMul') * (1 + hAdv);
          const ch = a.chargeT.get(b.id);
          if (ch) { dmg += a.t.charge * 0.16 * ch.mult; hit = Math.min(0.95, hit + 0.12); }
          const armor = Math.min(95, b.t.armor + b.buffVal('armor'));
          let eff = dmg * a.t.ap + dmg * (1 - a.t.ap) * (1 - armor / 150);
          if (b.large) eff += a.t.antiLarge * 0.35; else eff = Math.min(eff, b.hpEach) * a.t.cleave;
          const rate = a.cat === 'monster' ? 0.32 : MELEE_RATE;
          const total = contact * rate * hit * eff * dt * (b.state === 'routing' ? 1.6 : 1);
          b.damage(total, a.x, a.z, a);
          a.dealt += total;
          // Swing animations for some soldiers in contact.
          if (Math.random() < contact * dt * 0.8) {
            const i = Math.floor(Math.random() * a.count);
            if (a.sa[i] && a.sfoe[i] >= 0) a.satk[i] = 0.45;
          }
          if (Math.random() < dt * 2.5) this.emit('clash', a, b);
        }
        // Gate battering.
        if (a.state === 'gate' && this.map.gate && this.map.gate.hp > 0) {
          const g = this.map.gate;
          const mul = this.sides[a.side].commander.trait === 'siegebreaker' ? 3 : 1;
          const n = Math.min(a.alive, a.cat === 'monster' ? a.alive : 14);
          g.hp -= n * a.t.dmg * (a.cat === 'monster' ? 1.6 : 0.35) * mul * dt;
          if (Math.random() < dt * 3) { this.emit('gatehit', g); for (let i = 0; i < a.count; i++) if (a.sa[i] && Math.random() < 0.2) a.satk[i] = 0.45; }
          if (g.hp <= 0) this.destroyGate();
        }
      }
    }

    destroyGate() {
      const g = this.map.gate;
      g.hp = 0;
      this.fx.push({ type: 'explosion', x: g.x, z: g.z, r: 8, color: '#c8a070' });
      this.msg('The gate has been breached!', this.attackerSide, 'big');
      this.emit('gate');
      for (const u of this.units) if (u.order.type === 'gate') u.order = { type: 'idle' };
    }

    // ---------------------------------------------------------------- missiles
    effRange(u, tg) {
      const dh = this.map.heightAt(u.x, u.z) - this.map.heightAt(tg.x, tg.z);
      return u.t.range * (1 + U.clamp(dh / 40, -0.1, 0.25));
    }
    updateRanged(u, dt) {
      if (!u.t.range || u.ammo <= 0 || u.state === 'routing' || u.state === 'fighting' || u.state === 'moving') return;
      if (this.phase !== 'battle') return;
      let tg = u.rangedTarget;
      const o = u.order;
      if (o.type === 'gate' && o.ranged) {
        const g = this.map.gate;
        const d = Math.hypot(g.x - u.x, g.z - u.z);
        if (g.hp <= 0 || d > u.t.range) return;
        u.reloadT -= dt;
        if (u.reloadT > 0) return;
        u.reloadT = u.t.reload * (0.9 + Math.random() * 0.2);
        u.ammo--; u.lastShotT = this.time;
        const flight = d / 42 + 0.3;
        const kind = u.faction === 'arcane' ? 'bolt' : 'boulder';
        for (let s = 0; s < u.alive; s++) {
          const i = this.randomAlive(u);
          const ix = g.x + (Math.random() - 0.5) * 6, iz = g.z + (Math.random() - 0.5) * 3;
          this.projectiles.push({ kind, x0: u.sx[i], y0: u.sy[i] + 1.5, z0: u.sz[i], x1: ix, y1: this.map.heightAt(ix, iz) + 3, z1: iz, t: 0, dur: flight, arc: kind === 'boulder' ? d * 0.35 : d * 0.05, side: u.side });
          this.pending.push({ at: this.time + flight, kind: 'splash', x: ix, z: iz, r: u.t.splash, dmg: u.t.rdmg, ap: u.t.rap, src: u, explode: kind });
        }
        this.emit('volley', u, kind);
        return;
      }
      if (o.type === 'attack' && o.target && !o.target.gone) tg = o.target;
      if (!tg || tg.gone || tg.hidden && tg.side !== u.side || tg.state === 'escaped') {
        tg = null;
        if (o.type === 'idle' || o.type === 'attack') {
          // Fire at will: nearest enemy in range.
          let bd = Infinity;
          for (const e of this.units) {
            if (e.side === u.side || e.gone || e.hidden) continue;
            const d = Math.hypot(e.x - u.x, e.z - u.z);
            if (d < this.effRange(u, e) && d < bd) { bd = d; tg = e; }
          }
        }
        u.rangedTarget = tg;
      }
      if (!tg) return;
      const d = Math.hypot(tg.x - u.x, tg.z - u.z);
      if (d > this.effRange(u, tg)) return;
      if (u.state === 'idle' || u.state === 'shooting') u.facing = U.turnToward(u.facing, Math.atan2(tg.x - u.x, tg.z - u.z), 1.2 * dt);
      u.reloadT -= dt;
      if (u.reloadT > 0) return;
      u.reloadT = u.t.reload * (0.9 + Math.random() * 0.2);
      this.fireVolley(u, tg, d);
    }

    fireVolley(u, tg, d) {
      u.ammo--;
      u.lastShotT = this.time;
      const t = u.t;
      const shooters = u.cat === 'siege' ? u.alive : Math.min(u.alive, 40);
      const kind = u.cat === 'siege' ? (u.faction === 'arcane' ? 'bolt' : 'boulder') : (u.t.model.weapon === 'staff' ? 'magic' : u.t.model.weapon === 'javelin' ? 'javelin' : 'arrow');
      const speed = kind === 'boulder' ? 42 : kind === 'magic' || kind === 'bolt' ? 55 : 60;
      const flight = d / speed + 0.3;
      const hs = this.map.heightAt(u.x, u.z), ht = this.map.heightAt(tg.x, tg.z);
      // Visual projectiles.
      const nVis = Math.min(shooters, kind === 'arrow' ? 12 : 8);
      for (let k = 0; k < nVis; k++) {
        const i = this.randomAlive(u), j = this.randomAlive(tg);
        if (i < 0 || j < 0) break;
        const scatter = t.splash ? 3 : 1.5;
        this.projectiles.push({ kind, x0: u.sx[i], y0: u.sy[i] + 1.4, z0: u.sz[i], x1: tg.sx[j] + (Math.random() - 0.5) * scatter, y1: tg.sy[j] + 0.6, z1: tg.sz[j] + (Math.random() - 0.5) * scatter,
          t: -Math.random() * 0.25, dur: flight * (0.92 + Math.random() * 0.16), arc: kind === 'boulder' ? d * 0.35 : kind === 'magic' || kind === 'bolt' ? d * 0.05 : d * 0.16, side: u.side });
      }
      this.emit('volley', u, kind);
      if (t.splash) {
        // Each engine/caster lands a splash at a scattered point near the target.
        for (let s = 0; s < shooters; s++) {
          const spread = (1 - t.acc) * d * 0.12 + 1.5;
          const ix = tg.x + (Math.random() - 0.5) * 2 * spread, iz = tg.z + (Math.random() - 0.5) * 2 * spread;
          this.pending.push({ at: this.time + flight, kind: 'splash', x: ix, z: iz, r: t.splash, dmg: t.rdmg, ap: t.rap, src: u, explode: kind });
        }
        return;
      }
      let acc = t.acc * U.clamp(1.15 - 0.55 * d / t.range, 0.35, 1.15);
      if (tg.large) acc *= 1.35;
      acc *= tg.form.missile;
      if (this.map.inForest(tg.x, tg.z)) acc *= 0.6;
      if (hs - ht > 3) acc *= 1.12;
      if (tg.t.shield && this.attackDir(tg, u.x, u.z) === 'front') acc *= 1 - tg.t.shield;
      const armor = Math.min(95, tg.t.armor + tg.buffVal('armor'));
      const per = Math.min(tg.hpEach, t.rdmg * t.rap + t.rdmg * (1 - t.rap) * (1 - armor / 150));
      const hits = shooters * acc;
      const amount = hits * per * (tg.state === 'routing' ? 1.3 : 1);
      this.pending.push({ at: this.time + flight, kind: 'hit', target: tg, amount, src: u });
    }


    randomAlive(u) {
      if (u.alive <= 0) return -1;
      for (let tries = 0; tries < 8; tries++) { const i = Math.floor(Math.random() * u.count); if (u.sa[i]) return i; }
      for (let i = 0; i < u.count; i++) if (u.sa[i]) return i;
      return -1;
    }

    updateTowers(dt) {
      const def = this.defenderSide;
      for (const tw of this.map.towers) {
        tw.cd -= dt;
        if (tw.cd > 0) continue;
        let tg = null, bd = tw.range;
        for (const e of this.units) {
          if (e.side === def || e.gone) continue;
          const d = Math.hypot(e.x - tw.x, e.z - tw.z);
          if (d < bd) { bd = d; tg = e; }
        }
        if (!tg) { tw.cd = 1; continue; }
        tw.cd = 4.5;
        const flight = bd / 60 + 0.2;
        for (let k = 0; k < 5; k++) {
          const j = this.randomAlive(tg); if (j < 0) break;
          this.projectiles.push({ kind: 'arrow', x0: tw.x, y0: this.map.heightAt(tw.x, tw.z) + 11, z0: tw.z, x1: tg.sx[j], y1: tg.sy[j] + 0.6, z1: tg.sz[j], t: -Math.random() * 0.2, dur: flight, arc: bd * 0.08, side: def });
        }
        const armor = tg.t.armor;
        const per = 11 * 0.4 + 11 * 0.6 * (1 - armor / 150);
        let acc = 0.33 * (tg.large ? 1.3 : 1) * tg.form.missile;
        if (tg.t.shield && this.attackDir(tg, tw.x, tw.z) === 'front') acc *= 1 - tg.t.shield;
        this.pending.push({ at: this.time + flight, kind: 'hit', target: tg, amount: 10 * acc * per, src: null });
      }
    }

    updatePending() {
      if (!this.pending.length) return;
      const keep = [];
      for (const p of this.pending) {
        if (p.at > this.time) { keep.push(p); continue; }
        if (p.kind === 'hit') {
          if (!p.target.gone) {
            let amt = p.amount;
            const frac = amt / p.target.hpEach;
            amt = Math.floor(frac) * p.target.hpEach + (Math.random() < frac - Math.floor(frac) ? p.target.hpEach : 0) * 0.999;
            p.target.damage(Math.max(0, amt), null, null, p.src);
            if (p.src) p.src.dealt += amt;
          }
        } else if (p.kind === 'splash') {
          this.areaDamage(p.x, p.z, p.r, p.dmg, p.ap, p.src, true, 4);
          if (this.siege && this.map.gate && this.map.gate.hp > 0 && p.src && p.src.side === this.attackerSide && Math.hypot(p.x - this.map.gate.x, p.z - this.map.gate.z) < p.r + 6) {
            const mul = this.sides[p.src.side].commander.trait === 'siegebreaker' ? 3 : 1;
            this.map.gate.hp -= p.dmg * 2.2 * mul;
            this.emit('gatehit', this.map.gate);
            if (this.map.gate.hp <= 0) this.destroyGate();
          }
          this.fx.push({ type: p.explode === 'bolt' ? 'magicburst' : 'impact', x: p.x, z: p.z, r: p.r });
          this.emit('impact', p);
        } else if (p.kind === 'fn') {
          p.fn();
        }
      }
      this.pending = keep;
    }

    updateProjectiles(dt) {
      for (const p of this.projectiles) p.t += dt;
      this.projectiles = this.projectiles.filter((p) => p.t < p.dur);
    }

    // Damage every soldier within r of (x,z). Returns soldiers killed.
    areaDamage(x, z, r, perSoldier, ap, src, friendly, moraleHit = 0, onlyEnemiesOf = null) {
      let killed = 0;
      for (const u of this.units) {
        if (u.gone) continue;
        if (onlyEnemiesOf != null && u.side === onlyEnemiesOf) continue;
        if (!friendly && src && u.side === src.side) continue;
        if (Math.hypot(u.x - x, u.z - z) > r + u.radius + 2) continue;
        const armor = Math.min(95, u.t.armor + u.buffVal('armor'));
        let total = 0, hitN = 0;
        for (let i = 0; i < u.count; i++) {
          if (!u.sa[i]) continue;
          const d = Math.hypot(u.sx[i] - x, u.sz[i] - z);
          if (d > r + (u.large ? 1.5 : 0)) continue;
          // Not everyone in the blast is struck; chances fall off toward the edge. Loose formations suffer less.
          const pHit = (0.9 - 0.55 * (d / r)) * (u.formation === 'loose' ? 0.65 : 1);
          if (Math.random() > pHit) continue;
          total += Math.min(u.hpEach, perSoldier * (ap + (1 - ap) * (1 - armor / 150)));
          hitN++;
        }
        if (hitN) {
          // Large creatures absorb blasts better (one big body, not many men).
          if (u.large && u.count <= 4) total = Math.min(total, perSoldier * 2.5);
          killed += u.damage(total, x, z, src);
          if (moraleHit) u.morale -= moraleHit * Math.min(1, hitN / 6);
        }
      }
      return killed;
    }

    // ---------------------------------------------------------------- morale
    updateMorale(u, dt) {
      const sd = this.sides[u.side];
      let m = u.t.morale + u.form.morale + u.buffVal('morale');
      m -= 55 * (1 - u.alive / u.startAlive);
      const recent = u.recentLoss / (u.startAlive * u.hpEach);
      m -= Math.min(40, recent * 170);
      let flank = 0;
      const dirs = new Set();
      let fear = false;
      for (const e of u.engagedBy) {
        const dir = this.attackDir(u, e.x, e.z);
        dirs.add(dir);
        if (dir === 'flank') flank = Math.max(flank, 8); else if (dir === 'rear') flank = Math.max(flank, 16);
        if (e.t.fear) fear = true;
      }
      m -= flank;
      if (u.engagedBy.size >= 3 || dirs.size >= 2) m -= 14;
      if (fear && !u.t.fear) m -= 10;
      let routers = 0, genNear = false;
      for (const a of this.units) {
        if (a === u || a.side !== u.side || a.gone) continue;
        const d = Math.hypot(a.x - u.x, a.z - u.z);
        if (a.state === 'routing' && d < 30) routers++;
        if (a.isGeneral && a.active && d < 45) genNear = true;
      }
      m -= Math.min(18, routers * 6);
      if (genNear && !u.isGeneral) m += 10;
      if (sd.generalDead) m -= this.time - sd.generalDeadT < 25 ? 22 : 10;
      if (u.engaged.size && u.dealt > u.taken * 1.3) m += 6;
      const ratio = this.sidePower(u.side) / Math.max(1, this.sidePower(1 - u.side));
      if (ratio < 0.35) m -= 12; else if (ratio > 2.5) m += 8;
      if (u.engaged.size) {
        for (const e of u.engaged.keys()) { if (this.heightAdv(u, e) > 0.1) { m += 4; break; } }
      }
      u.moraleTarget = m;
      if (u.state === 'routing') { u.morale += ((Math.min(m, 40)) - u.morale) * Math.min(1, dt * 0.2); return; }
      const rate = m < u.morale ? 9 : 3.5;
      u.morale += U.clamp(m - u.morale, -rate * dt, rate * dt);
      u.morale = Math.min(u.morale, 120);
      if (u.t.morale >= 100) { u.morale = Math.max(u.morale, 10); return; } // constructs never break
      if (u.morale < 4) this.rout(u);
    }
    rout(u) {
      u.state = 'routing';
      u.routCount++;
      u.routT = 0;
      u.path = []; u.repathT = 0;
      u.order = { type: 'idle' };
      u.chargeT.clear();
      if (u.routCount >= 3 || u.alive < u.count * 0.15) u.shattered = true;
      this.msg(`${u.side === 0 ? 'Your' : 'Enemy'} ${u.name} ${u.shattered ? 'are shattered' : 'are routing'}!`, u.side, u.side === 0 ? 'bad' : 'good');
      this.emit('rout', u);
    }

    onCasualties(u, n) { this.emit('casualties', u, n); }
    onUnitDestroyed(u) {
      this.msg(`${u.side === 0 ? 'Your' : 'Enemy'} ${u.name} ${u.isGeneral ? 'has fallen' : 'have been destroyed'}!`, u.side, u.side === 0 ? 'bad' : 'good');
      if (u.isGeneral) {
        const sd = this.sides[u.side];
        sd.generalDead = true; sd.generalDeadT = this.time;
        this.msg(u.side === 0 ? 'Your general is dead! Your army despairs.' : 'The enemy general is dead!', u.side, 'big');
      }
      this.emit('destroyed', u);
    }

    // ---------------------------------------------------------------- end of battle
    checkEnd(dt) {
      const active = [0, 0];
      for (const u of this.units) if (u.active) active[u.side]++;
      if (!active[0] || !active[1]) {
        this.endTimer += dt;
        if (this.endTimer > 1.5) this.finish(active[1] ? 1 : 0, active[0] || active[1] ? 'rout' : 'mutual');
        return;
      }
      this.endTimer = 0;
      if (this.time >= this.timeLimit) {
        this.msg('Time has run out. The attackers withdraw.', 0, 'big');
        this.finish(this.defenderSide, 'time');
      }
    }
    retreat(side = 0) {
      if (this.phase === 'over') return;
      // Retreating troops lose some men in the withdrawal.
      for (const u of this.units) {
        if (u.side !== side || u.gone) continue;
        const loss = u.engagedBy.size ? 0.35 : 0.1;
        u.damage(u.pool * loss, null, null, null);
      }
      this.finish(1 - side, 'retreat');
    }
    finish(winner, reason) {
      if (this.phase === 'over') return;
      this.phase = 'over';
      const units = this.units.map((u) => ({
        side: u.side, ref: u.spec.ref, typeId: u.typeId, name: u.name, isGeneral: u.isGeneral,
        alive: u.gone && u.state === 'dead' ? 0 : u.alive, count: u.count, start: u.startAlive, kills: u.kills,
        hpFrac: u.state === 'dead' ? 0 : u.pool / u.maxPool,
      }));
      const lost = [0, 0], start = [0, 0], kills = [0, 0];
      for (const u of this.units) { lost[u.side] += u.startAlive - (u.state === 'dead' ? 0 : u.alive); start[u.side] += u.startAlive; kills[u.side] += u.kills; }
      this.result = {
        winner, reason, playerWon: winner === 0, duration: this.time, units, lost, start, kills,
        generalDead: [this.sides[0].generalDead, this.sides[1].generalDead],
        mapType: this.cfg.mapType,
      };
      this.emit('end', this.result);
    }
  }

  RW.Battle = Battle;
})();
