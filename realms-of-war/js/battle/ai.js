// Tactical battle AI. Difficulty changes decision quality (flanking, skirmishing, focus fire,
// ability timing, retreating damaged units) rather than unit stats.
(function () {
  const RW = window.RW;
  const U = RW.util;

  const PROFILES = {
    easy: { tick: 2.2, flank: false, skirmish: false, focus: false, retreat: false, abilityChance: 0.3, cycle: false, matchups: false, protect: false, holdHill: false, wait: false },
    normal: { tick: 1.0, flank: true, skirmish: true, focus: false, retreat: true, abilityChance: 0.75, cycle: true, matchups: true, protect: true, holdHill: true, wait: true },
    hard: { tick: 0.55, flank: true, skirmish: true, focus: true, retreat: true, abilityChance: 1, cycle: true, matchups: true, protect: true, holdHill: true, wait: true, smartSpells: true },
  };

  class BattleAI {
    constructor(battle, side, difficulty) {
      this.b = battle; this.side = side;
      this.p = PROFILES[difficulty] || PROFILES.normal;
      this.diff = difficulty;
      this.timer = 0.5;
      this.posture = 'attack';
      this.anchor = null;
      battle.sides[side].isAIControlled = true;
      this.initAnchor();
    }

    initAnchor() {
      const b = this.b, north = b.sideNorth[this.side];
      const zn = b.map.deployZone(north);
      const ax = 0, az = north ? zn.z1 - 8 : zn.z0 + 8;
      this.anchor = { x: ax, z: az };
      if (this.p.holdHill) {
        // Look for high ground in front of our deployment.
        let best = null, bh = b.map.heightAt(ax, az) + 3;
        for (let dz = 0; dz <= 50; dz += 5) for (let dx = -50; dx <= 50; dx += 5) {
          const x = ax + dx, z = az + (north ? dz : -dz);
          if (b.map.blocked(x, z, this.side)) continue;
          const h = b.map.heightAt(x, z);
          if (h > bh) { bh = h; best = { x, z }; }
        }
        if (best) { this.anchor = best; this.onHill = true; }
      }
      if (b.siege && this.side === b.defenderSide) {
        const g = b.map.gate;
        this.anchor = { x: 0, z: g.z + (north ? -22 : 22) };
      }
      if (b.map.temple && this.p.holdHill) { const t = b.map.temple; this.anchor = { x: t.x, z: t.z + (north ? -10 : 10) }; this.onHill = true; }
    }

    update(dt) {
      if (this.b.phase !== 'battle') return;
      this.timer -= dt;
      if (this.timer > 0) return;
      this.timer = this.p.tick * (0.8 + Math.random() * 0.4);
      try { this.think(); } catch (e) { console.error('AI error', e); }
    }

    // ---------------------------------------------------------------- helpers
    moveTo(u, x, z, facing = null) {
      const o = u.order;
      if (o.type === 'move' && Math.hypot(o.x - x, o.z - z) < 6) return;
      if ((o.type === 'idle') && Math.hypot(u.x - x, u.z - z) < 5) { if (facing != null) u.order.facing = facing; return; }
      u.orderMove(x, z, facing);
    }
    attack(u, e) {
      if (u.order.type === 'attack' && u.order.target === e) return;
      u.orderAttack(e);
    }
    centroid(list) {
      if (!list.length) return null;
      let x = 0, z = 0, w = 0;
      for (const u of list) { const k = u.alive; x += u.x * k; z += u.z * k; w += k; }
      return { x: x / w, z: z / w };
    }
    nearest(u, list, filter) {
      let best = null, bd = Infinity;
      for (const e of list) {
        if (filter && !filter(e)) continue;
        const d = Math.hypot(e.x - u.x, e.z - u.z);
        if (d < bd) { bd = d; best = e; }
      }
      return best ? { e: best, d: bd } : null;
    }
    // How attractive enemy e is for our unit u.
    score(u, e) {
      const d = Math.hypot(e.x - u.x, e.z - u.z);
      let s = 100 / (d + 15);
      if (e.state === 'routing') s *= u.cat === 'cav' ? 0.9 : 0.25;
      if (this.p.matchups) {
        if (u.t.antiLarge > 10 && e.large) s *= 2.2;
        if (u.cat === 'cav' && (e.cat === 'ranged' || e.cat === 'siege')) s *= 2.6;
        if (u.cat === 'cav' && e.t.antiLarge > 10 && e.state !== 'routing') s *= 0.35;
        if ((u.cat === 'cav' || u.cat === 'monster') && e.engaged.size) s *= 1.6;
        if (u.cat === 'monster' && e.cat === 'inf') s *= 1.4;
      }
      if (this.p.focus) {
        s *= 1.5 - e.hpFrac * 0.5;
        if (e.isGeneral) s *= 1.3;
        if (e.engaged.size && u.cat !== 'ranged') s *= 1.3;
      }
      return s;
    }
    best(u, list, filter) {
      let best = null, bs = -1;
      for (const e of list) {
        if (filter && !filter(e)) continue;
        const s = this.score(u, e);
        if (s > bs) { bs = s; best = e; }
      }
      return best;
    }

    // ---------------------------------------------------------------- main decision
    think() {
      const b = this.b, s = this.side;
      const mine = b.units.filter((u) => u.side === s && u.active);
      const foesAll = b.units.filter((u) => u.side !== s && !u.gone);
      const foes = foesAll.filter((u) => !u.hidden || u.engaged.size || u.engagedBy.size);
      if (!mine.length) return;
      const north = b.sideNorth[s];
      const toEnemy = north ? 1 : -1;
      const O = this.centroid(mine);
      const fighting = foes.filter((e) => e.state !== 'routing');
      let E = this.centroid(fighting.length ? fighting : foes);
      if (!E) {
        // Nobody visible: sweep toward the enemy deployment zone.
        const zn = b.map.deployZone(!north);
        E = { x: 0, z: (zn.z0 + zn.z1) / 2 };
      }
      const myP = b.sidePower(s), enP = Math.max(1, b.sidePower(1 - s));
      const ratio = myP / enP;
      const siegeDef = b.siege && s === b.defenderSide;
      const gateUp = b.siege && b.map.gates.every((g) => g.hp > 0) && !b.map.breaches.length;
      const siegeAtt = b.siege && s === b.attackerSide && gateUp;

      // Posture
      const enRanged = foes.filter((e) => e.t.range && e.ammo > 0 && e.cat !== 'general').reduce((a, e) => a + e.base.power * e.hpFrac, 0);
      const myRanged = mine.filter((e) => e.t.range && e.ammo > 0 && e.cat !== 'general').reduce((a, e) => a + e.base.power * e.hpFrac, 0);
      const missileLoss = mine.reduce((a, u) => a + (u.engagedBy.size ? 0 : u.recentLoss), 0);
      if (siegeDef) this.posture = gateUp ? 'defend' : 'gatefight';
      else if (siegeAtt) this.posture = 'siege';
      else if (this.diff === 'easy') this.posture = 'attack';
      else if (s === b.defenderSide && b.time < 240 && myRanged >= enRanged * 0.8 && ratio < 1.25 && missileLoss < 30) this.posture = 'defend';
      else if (ratio < 0.55 && this.onHill && missileLoss < 30 && b.time < 300) this.posture = 'defend';
      else this.posture = 'attack';

      const infantry = mine.filter((u) => u.cat === 'inf' || (u.cat === 'ranged' && u.ammo <= 0));
      const ranged = mine.filter((u) => u.cat === 'ranged' && u.ammo > 0);
      const cav = mine.filter((u) => u.cat === 'cav' || (u.fly && u.cat === 'monster'));
      const monsters = mine.filter((u) => u.cat === 'monster' && !u.fly);
      const siege = mine.filter((u) => u.cat === 'siege' && !u.equip);
      // Siege equipment: rams to the nearest gate, towers to the wall.
      mine.filter((u) => u.equip).forEach((u, i) => {
        if (u.docked || u.engagedBy.size) return;
        if (u.equip === 'ram' && u.order.type !== 'gate') u.orderGate();
        if (u.equip === 'tower' && u.order.type !== 'tower') u.orderTower([-70, 70, 15][i % 3]);
      });
      const general = mine.find((u) => u.isGeneral);
      const assigned = new Set();

      // Retreat badly damaged units.
      if (this.p.retreat) {
        for (const u of mine) {
          if (u.isGeneral || u.cat === 'siege') continue;
          const engaged = u.engaged.size || u.engagedBy.size;
          const bad = u.hpFrac < 0.25 && u.morale < 30;
          const veryBad = this.diff === 'hard' && engaged && u.hpFrac < 0.18 && u.morale < 18 && u.cat !== 'monster';
          if ((bad && !engaged) || veryBad) {
            const rx = U.clamp(O.x, -100, 100), rz = U.clamp(O.z - toEnemy * 35, -105, 105);
            this.moveTo(u, rx, rz);
            assigned.add(u);
          }
        }
      }

      const frontDir = Math.atan2(E.x - O.x, E.z - O.z);
      const lineFacing = this.posture === 'defend' || this.posture === 'siege' ? (north ? 0 : Math.PI) : frontDir;

      // Line anchor: where the infantry line should stand.
      let line;
      if (this.posture === 'defend') line = this.anchor;
      else if (this.posture === 'siege') line = { x: b.map.gate.x, z: b.map.gate.z - toEnemy * 78 };
      else if (this.posture === 'gatefight') line = this.anchor;
      else {
        const dOE = Math.hypot(E.x - O.x, E.z - O.z);
        const step = Math.min(Math.max(0, dOE - 20), 45);
        line = { x: O.x + Math.sin(frontDir) * step, z: O.z + Math.cos(frontDir) * step };
      }
      const lineDirX = Math.cos(lineFacing), lineDirZ = -Math.sin(lineFacing);

      // Protect missile troops from enemies closing in.
      if (this.p.protect) {
        for (const r of ranged) {
          const threat = this.nearest(r, fighting, (e) => e.cat !== 'ranged' && e.cat !== 'siege' && !e.engaged.size);
          if (threat && threat.d < 30) {
            const guard = infantry.concat(monsters).filter((g) => !assigned.has(g) && !g.engaged.size && !g.engagedBy.size)
              .sort((a, c) => Math.hypot(a.x - threat.e.x, a.z - threat.e.z) - Math.hypot(c.x - threat.e.x, c.z - threat.e.z))[0];
            if (guard && Math.hypot(guard.x - threat.e.x, guard.z - threat.e.z) < 70) { this.attack(guard, threat.e); assigned.add(guard); }
          }
        }
      }

      // --- Infantry & monsters
      const lineUnits = infantry.concat(monsters).filter((u) => !assigned.has(u));
      // Sort by lateral position so the line keeps its order.
      lineUnits.sort((a, c) => (a.x * lineDirX + a.z * lineDirZ) - (c.x * lineDirX + c.z * lineDirZ));
      const widths = lineUnits.map((u) => u.hw * 2 + 4);
      const totalW = widths.reduce((a, w) => a + w, 0);
      let off = -totalW / 2;
      lineUnits.forEach((u, i) => {
        const lx = off + widths[i] / 2; off += widths[i];
        if (u.engaged.size || u.engagedBy.size) return;
        const slotX = line.x + lineDirX * lx, slotZ = line.z + lineDirZ * lx;
        if (this.posture === 'siege') {
          // Monsters and one solid infantry unit batter the gate if we lack siege engines.
          if (!siege.length && (u.cat === 'monster' || i === Math.floor(lineUnits.length / 2))) { if (u.order.type !== 'gate') u.orderGate(); return; }
          const near = this.nearest(u, fighting);
          if (near && near.d < 25) { this.attack(u, near.e); return; }
          this.moveTo(u, slotX, slotZ, lineFacing);
          return;
        }
        if (this.posture === 'defend' || this.posture === 'gatefight') {
          const lim = this.posture === 'gatefight' ? 40 : 32;
          const near = this.best(u, fighting, (e) => Math.hypot(e.x - slotX, e.z - slotZ) < lim);
          if (near) { this.attack(u, near); return; }
          this.moveTo(u, slotX, slotZ, lineFacing);
          return;
        }
        // Attack posture: advance in line, then pick fights.
        const close = this.nearest(u, fighting);
        if (close && close.d < 42 + u.radius) {
          let tg = this.best(u, fighting, (e) => Math.hypot(e.x - u.x, e.z - u.z) < 60);
          if (!this.p.matchups) tg = close.e;
          if (tg) { this.attack(u, tg); return; }
        }
        // Easy AI marches straight at the enemy; others wait for the line.
        if (!this.p.wait && close) { this.attack(u, close.e); return; }
        const routers = foes.filter((e) => e.state === 'routing');
        if (!fighting.length && routers.length) { this.attack(u, this.nearest(u, routers).e); return; }
        this.moveTo(u, slotX, slotZ, lineFacing);
      });

      // --- Ranged
      for (const u of ranged) {
        if (assigned.has(u) || u.engaged.size || u.engagedBy.size) continue;
        const threat = this.nearest(u, fighting, (e) => e.cat !== 'ranged' && e.cat !== 'siege' && (!e.engaged.size || e.order.target === u));
        if (this.p.skirmish && threat && threat.d < 24) {
          // Back off toward our own lines (unless the threat is faster cavalry and allies are near).
          const ax = u.x - threat.e.x, az = u.z - threat.e.z, al = Math.hypot(ax, az) || 1;
          const nx = U.clamp(u.x + (ax / al) * 26, -110, 110), nz = U.clamp(u.z + (az / al) * 18 - toEnemy * 14, -110, 110);
          if (!b.map.blocked(nx, nz, s)) { u.orderMove(nx, nz, Math.atan2(-ax, -az)); continue; }
        }
        const inRange = fighting.concat(foes.filter((e) => e.state === 'routing')).filter((e) => Math.hypot(e.x - u.x, e.z - u.z) < b.effRange(u, e) * 0.95);
        if (inRange.length) {
          let tg;
          if (this.p.focus) {
            tg = inRange.slice().sort((a, c) => this.rangedScore(u, c) - this.rangedScore(u, a))[0];
          } else tg = inRange.sort((a, c) => Math.hypot(a.x - u.x, a.z - u.z) - Math.hypot(c.x - u.x, c.z - u.z))[0];
          this.attack(u, tg);
          continue;
        }
        // Defenders of a walled town keep their missile troops on the walls.
        if (siegeDef && b.map.siegeWalls) {
          const k = ranged.indexOf(u), n = ranged.length;
          this.moveTo(u, U.clamp((k - (n - 1) / 2) * 30, -95, 95), b.map.wallZ, north ? 0 : Math.PI);
          continue;
        }
        // Move up behind the infantry line.
        if (this.posture === 'defend' || this.posture === 'gatefight' || this.posture === 'siege') {
          const lx = (ranged.indexOf(u) - (ranged.length - 1) / 2) * 24;
          this.moveTo(u, line.x + lineDirX * lx - Math.sin(lineFacing) * 14, line.z + lineDirZ * lx - Math.cos(lineFacing) * 14, lineFacing);
        } else {
          const tg = this.nearest(u, fighting.length ? fighting : foes);
          if (tg) {
            const want = Math.min(b.effRange(u, tg.e) * 0.85, tg.d);
            const dx = (tg.e.x - u.x) / tg.d, dz = (tg.e.z - u.z) / tg.d;
            this.moveTo(u, tg.e.x - dx * want, tg.e.z - dz * want, Math.atan2(dx, dz));
          }
        }
      }

      // --- Cavalry
      for (const u of cav) {
        if (assigned.has(u)) continue;
        this.cavalry(u, foes, fighting, O, E, toEnemy);
      }

      // --- Siege engines
      for (const u of siege) {
        if (u.engaged.size || u.engagedBy.size) continue;
        if (siegeAtt) {
          const g = b.map.nearestGate(u.x, u.z) || b.map.gate;
          const d = Math.hypot(g.x - u.x, g.z - u.z);
          if (d > u.t.range * 0.9) this.moveTo(u, g.x + (u.x > 0 ? 18 : -18), g.z - toEnemy * (u.t.range * 0.75));
          else if (u.order.type !== 'gate') u.orderGate();
          continue;
        }
        // Pick a target with few of our own men near it (friendly fire).
        let tg = null, bs = 0;
        for (const e of fighting) {
          const d = Math.hypot(e.x - u.x, e.z - u.z);
          if (d > b.effRange(u, e) * 0.95) continue;
          let friendly = 0;
          for (const a of mine) if (Math.hypot(a.x - e.x, a.z - e.z) < a.radius + e.radius + 6) friendly++;
          let sc = (e.alive * (e.large ? 3 : 1)) / (1 + friendly * 4) * (this.p.focus ? (e.engaged.size ? 0.5 : 1.3) : 1);
          if (sc > bs) { bs = sc; tg = e; }
        }
        if (tg && bs > 3) this.attack(u, tg);
        else if (u.order.type === 'attack') u.halt();
      }

      // --- General
      if (general && !assigned.has(general)) {
        const threat = this.nearest(general, fighting);
        if (general.hpFrac < 0.35 && threat && threat.d < 25) {
          this.moveTo(general, O.x, O.z - toEnemy * 30);
        } else if (threat && threat.d < 22) this.attack(general, threat.e);
        else if (this.diff !== 'easy' && ratio > 1.1 && general.hpFrac > 0.6) {
          // Join an engaged fight from a flank.
          const tgt = this.best(general, fighting, (e) => e.engaged.size > 0 && Math.hypot(e.x - general.x, e.z - general.z) < 70);
          if (tgt) this.attack(general, tgt);
          else this.moveTo(general, line.x - Math.sin(lineFacing) * 22, line.z - Math.cos(lineFacing) * 22, lineFacing);
        } else if (!(general.engaged.size || general.engagedBy.size)) {
          this.moveTo(general, line.x - Math.sin(lineFacing) * 24, line.z - Math.cos(lineFacing) * 24, lineFacing);
        }
      }

      // End game: if the regular battle line is gone or nothing is happening, commit everything.
      const anyFight = b.units.some((u) => !u.gone && (u.engaged.size || u.engagedBy.size));
      if (anyFight) this.lastFightT = b.time;
      const stale = b.time - (this.lastFightT || 0) > 35 && this.posture !== 'defend' && this.posture !== 'siege';
      if ((!lineUnits.length && !cav.length) || stale) {
        for (const u of mine) {
          if (u.engaged.size || u.engagedBy.size) continue;
          if (u.cat === 'siege' || (u.t.range && u.ammo > 0)) {
            const n = this.nearest(u, fighting.length ? fighting : foes);
            if (n && n.d > b.effRange(u, n.e) * 0.9) this.moveTo(u, n.e.x + (u.x - n.e.x) * (b.effRange(u, n.e) * 0.7 / n.d), n.e.z + (u.z - n.e.z) * (b.effRange(u, n.e) * 0.7 / n.d));
            else if (n) this.attack(u, n.e);
            continue;
          }
          const tg = this.best(u, fighting.length ? fighting : foes);
          if (tg) this.attack(u, tg);
        }
      }

      if (this.p.matchups) this.pickFormations(mine, fighting);
      this.useAbilities(mine, foes, fighting);
    }

    // Brace against charges, spread out under missile fire.
    pickFormations(mine, fighting) {
      const b = this.b;
      for (const u of mine) {
        if (u.cat === 'monster' || u.cat === 'siege' || u.cat === 'cav' || u.isGeneral) continue;
        const ad = u.aiData;
        if (b.time - (ad.formT || -99) < 6) continue;
        let want = 'line';
        const engaged = u.engaged.size || u.engagedBy.size;
        if (u.cat === 'inf' && !engaged && u.order.type !== 'attack') {
          const chargers = fighting.some((e) => (e.cat === 'cav' || e.cat === 'monster') && e.order.target === u && Math.hypot(e.x - u.x, e.z - u.z) < 50);
          if (chargers) want = 'defensive';
        }
        if (u.cat === 'ranged' && !engaged) {
          const shotAt = u.recentLoss > u.hpEach * 3;
          const enemyMissiles = fighting.some((e) => e.t.range && e.ammo > 0 && e.rangedTarget === u);
          if (shotAt && enemyMissiles) want = 'loose';
        }
        if (want !== u.formation) { b.setFormation([u], want); ad.formT = b.time; }
      }
    }

    rangedScore(u, e) {
      const d = Math.hypot(e.x - u.x, e.z - u.z);
      let s = 60 / (d + 20);
      if (e.t.shield && this.b.attackDir(e, u.x, u.z) === 'front') s *= 1 - e.t.shield;
      s *= 1.4 - e.t.armor / 100;
      if (e.large) s *= 1.3;
      if (e.cat === 'ranged' || e.cat === 'siege') s *= 1.3;
      if (e.state === 'routing') s *= 0.4;
      return s;
    }

    cavalry(u, foes, fighting, O, E, toEnemy) {
      const b = this.b, p = this.p, ad = u.aiData;
      const engaged = u.engaged.size || u.engagedBy.size;
      if (engaged) {
        ad.meleeT = (ad.meleeT || 0) + p.tick;
        // Hit and run: pull out after the charge has spent itself, then charge again.
        const tgt = [...u.engaged.keys()][0];
        if (p.cycle && ad.meleeT > 7 && u.hpFrac > 0.3 && tgt && tgt.state !== 'routing' && !tgt.large && tgt.cat !== 'ranged') {
          const ax = u.x - tgt.x, az = u.z - tgt.z, al = Math.hypot(ax, az) || 1;
          const nx = U.clamp(u.x + (ax / al) * 40, -110, 110), nz = U.clamp(u.z + (az / al) * 40, -110, 110);
          u.orderMove(nx, nz);
          ad.withdrawT = 4; ad.meleeT = 0; ad.lastTarget = tgt;
        }
        return;
      }
      ad.meleeT = 0;
      if (ad.withdrawT > 0) { ad.withdrawT -= p.tick; if (u.order.type === 'move') return; }
      if (b.siege && !u.fly && b.map.gates.every((g) => g.hp > 0) && !b.map.breaches.length && u.side === b.attackerSide) {
        const g = b.map.nearestGate(u.x, u.z);
        this.moveTo(u, g.x + (u.x > g.x ? 30 : -30), g.z - toEnemy * 80);
        return;
      }
      // Wait on the wing until the lines meet or something juicy is exposed.
      const exposed = fighting.filter((e) => (e.cat === 'ranged' || e.cat === 'siege') && !fighting.some((g) => g !== e && (g.cat === 'inf' || g.cat === 'monster') && !g.engaged.size && Math.hypot(g.x - e.x, g.z - e.z) < 18));
      const engagedFoes = fighting.filter((e) => e.engaged.size);
      const routers = foes.filter((e) => e.state === 'routing');
      let tg = null;
      if (!p.matchups) { const n = this.nearest(u, fighting.length ? fighting : routers); tg = n && n.e; }
      else {
        const cands = exposed.concat(engagedFoes);
        tg = this.best(u, cands.length ? cands : (p.wait && fighting.length && b.time < 90 ? [] : fighting.concat(routers)));
        if (!tg && routers.length) tg = this.nearest(u, routers).e;
      }
      if (!tg) {
        // Hold on the flank.
        const side = u.x >= O.x ? 1 : -1;
        this.moveTo(u, U.clamp(O.x + side * 45, -105, 105), U.clamp(O.z + toEnemy * 6, -105, 105));
        return;
      }
      const d = Math.hypot(tg.x - u.x, tg.z - u.z);
      if (p.flank && d > 55 && !ad.flanked) {
        // Swing round a flank: approach from the side/rear of the target.
        const side = Math.sign((u.x - E.x) || 1);
        const bx = tg.x - Math.sin(tg.facing) * 25 + side * 35, bz = tg.z - Math.cos(tg.facing) * 25;
        const wx = U.clamp(bx, -108, 108), wz = U.clamp(bz, -108, 108);
        if (Math.hypot(u.x - wx, u.z - wz) > 15 && !b.map.blocked(wx, wz, u.side)) { this.moveTo(u, wx, wz); return; }
        ad.flanked = true;
      }
      ad.flanked = d < 20 ? false : ad.flanked;
      this.attack(u, tg);
    }

    useAbilities(mine, foes, fighting) {
      const b = this.b, s = this.side, sd = b.sides[s];
      if (!sd.general || sd.general.gone) return;
      for (const ab of sd.abilities) {
        if (ab.cd > 0 || Math.random() > this.p.abilityChance) continue;
        const def = ab.def;
        const id = ab.id;
        const k = def.effect ? def.effect.kind : null;
        if (k === 'enemy_area' || k === 'area_damage') {
          // Best enemy cluster (these never hit our own men).
          let best = null, bs = 0;
          for (const e of fighting) {
            let n = 0;
            for (const u of fighting) if (Math.hypot(u.x - e.x, u.z - e.z) < def.radius + u.radius * 0.5) n += u.alive * (u.large ? 4 : 1);
            if (n > bs) { bs = n; best = e; }
          }
          if (best && bs >= (k === 'area_damage' ? 12 : 20)) { RW.castAbility(b, s, id, best.x, best.z); return; }
          continue;
        }
        if (k === 'ally_area') {
          let best = null, bs = 0;
          for (const a of mine) {
            let sc = 0;
            for (const u of mine) if (Math.hypot(u.x - a.x, u.z - a.z) < def.radius + u.radius * 0.5) sc += (def.effect.heal ? (u.maxPool - u.pool) / u.hpEach : 0) + (u.engaged.size || u.engagedBy.size ? 10 : 0) + (u.morale < 30 ? 8 : 0);
            if (sc > bs) { bs = sc; best = a; }
          }
          if (best && bs >= 18) { RW.castAbility(b, s, id, best.x, best.z); return; }
          continue;
        }
        if (k === 'type_buff') {
          const busy = mine.filter((u) => (u.order.type === 'attack' && u.order.target && Math.hypot(u.order.target.x - u.x, u.order.target.z - u.z) < 55) || u.engaged.size);
          if (busy.length >= 2) { RW.castAbility(b, s, id, 0, 0); return; }
          continue;
        }
        if (id === 'fireball' || id === 'meteor' || id === 'earthshaker') {
          const ff = id !== 'earthshaker';
          let best = null, bs = 0;
          const pts = fighting.map((e) => ({ x: e.x, z: e.z }));
          if (this.p.smartSpells) for (const e of fighting) for (const a of e.engagedBy) pts.push({ x: (e.x + a.x) / 2, z: (e.z + a.z) / 2 });
          for (const pt of pts) {
            let en = 0, fr = 0;
            for (const u of b.units) {
              if (u.gone || Math.hypot(u.x - pt.x, u.z - pt.z) > def.radius + u.radius) continue;
              let n = 0;
              for (let i = 0; i < u.count; i++) if (u.sa[i] && Math.hypot(u.sx[i] - pt.x, u.sz[i] - pt.z) < def.radius) n++;
              if (u.side === s) fr += n * (u.large ? 4 : 1); else en += n * (u.large ? 4 : 1);
            }
            const sc = en - (ff ? fr * (this.p.smartSpells ? 3 : 1.5) : 0);
            if (sc > bs) { bs = sc; best = pt; }
          }
          const need = id === 'fireball' ? 9 : id === 'meteor' ? 20 : 12;
          if (best && bs >= need) { RW.castAbility(b, s, id, best.x, best.z); return; }
        } else if (id === 'rally_cry' || id === 'blood_frenzy') {
          const eng = mine.filter((u) => u.engaged.size || u.engagedBy.size);
          const shaky = mine.filter((u) => u.morale < 30 || u.state === 'routing');
          const pool = eng.length >= 2 ? eng : shaky.length >= 2 ? shaky : null;
          if (pool) { const c = this.centroid(pool); RW.castAbility(b, s, id, c.x, c.z); return; }
        } else if (id === 'healing_light' || id === 'arcane_ward') {
          let best = null, bs = 0;
          for (const a of mine) {
            let lost = 0;
            for (const u of mine) if (Math.hypot(u.x - a.x, u.z - a.z) < def.radius + u.radius * 0.5) lost += (u.maxPool - u.pool) / u.hpEach;
            if (lost > bs) { bs = lost; best = a; }
          }
          if (best && bs >= 16) { RW.castAbility(b, s, id, best.x, best.z); return; }
        } else if (id === 'cavalry_charge' || id === 'savage_charge') {
          const chargers = mine.filter((u) => (u.cat === 'cav' || u.cat === 'monster' || (u.isGeneral && u.t.model.kind === 'mounted')) && u.order.type === 'attack' && u.order.target && Math.hypot(u.order.target.x - u.x, u.order.target.z - u.z) < 55);
          if (chargers.length >= 1) { RW.castAbility(b, s, id, 0, 0); return; }
        }
      }
    }
  }

  RW.BattleAI = BattleAI;
})();
