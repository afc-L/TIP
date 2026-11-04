// AI army commanders: read the battlefield, set posture, assign squads, vehicles and
// helicopters to objectives, call artillery and air strikes, launch counterattacks.
(function (G) {
  'use strict';
  const IF = G.IF, U = IF.U, ST = IF.ST;

  function Commander(B, team) {
    this.B = B; this.team = team;
    this.aggr = U.rr(0.45, 0.8);
    this.posture = 'advance';
    this.t = U.rr(1, 3);
    this.artyT = U.rr(110, 170); this.airT = U.rr(220, 320); this.heliT = 0;
    this.help = []; // reinforcement requests {obj, t}
    this.focus = -1; this.focusT = 0; this.counterT = -1000; this.counterObj = -1;
    this.lastPosture = '';
    this.intel = [];
  }
  IF.Commander = Commander;

  Commander.prototype.requestHelp = function (obj, sq) { if (obj) this.help.push({ obj: obj.id, t: this.B.time }); };

  Commander.prototype.update = function (dt) {
    this.t -= dt; this.artyT -= dt; this.airT -= dt;
    if (this.t > 0) return;
    this.t = U.rr(9, 13);
    this.plan();
  };

  Commander.prototype.assess = function () {
    const B = this.B, W = B.W, S = B.S, team = this.team;
    const objs = W.objectives;
    const info = objs.map((o) => {
      const [f, e] = IF.AI.strengthNear(B, team, o.x, o.z, o.r + 90);
      return { o, f, e, own: o.owner === team, enemy: o.owner === 1 - team, neutral: o.owner < 0 };
    });
    this.intel = info;
    return info;
  };

  Commander.prototype.plan = function () {
    const B = this.B, W = B.W, S = B.S, team = this.team;
    const info = this.assess();
    const hq = W.objectives[team], ehq = W.objectives[1 - team];
    const owned = info.filter((q) => q.own).length, eOwned = info.filter((q) => q.enemy).length;
    const tk = B.tickets[team] / Math.max(1, B.tickets[1 - team]);
    // posture
    let aggr = this.aggr + (owned < eOwned ? 0.2 : owned > eOwned + 1 ? -0.1 : 0) + (tk > 1.2 ? 0.1 : tk < 0.8 ? -0.12 : 0);
    if (B.phase >= 4) aggr += 0.25;
    let posture = aggr > 0.62 ? 'assault' : aggr > 0.42 ? 'advance' : 'defensive';
    if (B.time - this.counterT < 90) posture = 'counter';
    this.posture = posture;
    if (posture !== this.lastPosture && team === B.playerTeam && B.time > 20) IF.Radio.command(B, team, 'posture_' + posture);
    this.lastPosture = posture;

    // distance to front from our HQ (used to rank attack targets)
    const ownedObjs = info.filter((q) => q.own).map((q) => q.o);
    const scoreAttack = (q) => {
      const o = q.o;
      if (o.hq >= 0) { // enemy HQ only when we dominate
        if (o.hq === team) return -1;
        if (owned < 5) return -1;
      }
      let dmin = 1e9;
      for (const p of ownedObjs) dmin = Math.min(dmin, U.dist(p.x, p.z, o.x, o.z));
      let s = 2.2 - dmin / 450;
      if (q.neutral) s += 0.6;
      if (o.center) s += 0.4;
      s -= q.e * 0.012;              // heavily defended points are less attractive
      s += q.f * 0.01;               // follow up where we already fight
      if (this.counterObj === o.id && B.time - this.counterT < 120) s += 2;
      for (const h of this.help) if (h.obj === o.id && B.time - h.t < 60) s += 0.5;
      return s;
    };
    const scoreDefend = (q) => {
      const o = q.o;
      let s = 0.3 + q.e * 0.05;
      if (o.hq === team) s += q.e > 0 ? 3 : 0.15;
      // frontline objectives (close to enemy-held ones)
      let dmin = 1e9;
      for (const p of info) if (p.enemy || p.neutral) dmin = Math.min(dmin, U.dist(p.o.x, p.o.z, o.x, o.z));
      s += dmin < 650 ? 0.6 : -0.1;
      if (o.contested) s += 1.2;
      for (const h of this.help) if (h.obj === o.id && B.time - h.t < 60) s += 0.8;
      return s;
    };
    const atk = info.filter((q) => !q.own).map((q) => ({ q, s: scoreAttack(q) })).filter((a) => a.s > -0.5).sort((a, b) => b.s - a.s);
    const def = info.filter((q) => q.own).map((q) => ({ q, s: scoreDefend(q) })).sort((a, b) => b.s - a.s);
    this.help = this.help.filter((h) => B.time - h.t < 90);

    // squad pool
    const squads = B.squads.filter((sq) => sq.team === team && sq.type === 'inf' && sq.alive > 0);
    const N = squads.length;
    const defShare = posture === 'defensive' ? 0.5 : posture === 'advance' ? 0.33 : posture === 'counter' ? 0.25 : 0.22;
    let nDef = Math.round(N * defShare), nAtk = N - nDef;
    const want = new Map();
    // defense distribution proportional to score (HQ always gets a token garrison)
    const dSum = def.reduce((a, d) => a + Math.max(0.05, d.s), 0) || 1;
    for (const d of def) want.set(d.q.o.id, Math.max(d.q.o.hq === team ? 1 : 0, Math.round(nDef * Math.max(0.05, d.s) / dSum)));
    // attack: concentrate on top targets
    const tops = atk.slice(0, posture === 'assault' ? 3 : 2);
    const weights = tops.length === 3 ? [0.45, 0.33, 0.22] : tops.length === 2 ? [0.6, 0.4] : [1];
    tops.forEach((a, k) => want.set(a.q.o.id, (want.get(a.q.o.id) || 0) + Math.round(nAtk * weights[k])));
    if (!tops.length) for (const d of def) want.set(d.q.o.id, (want.get(d.q.o.id) || 0) + Math.round(nAtk / Math.max(1, def.length)));
    this.focus = tops.length ? tops[0].q.o.id : -1;

    // current allocation
    const have = new Map();
    for (const sq of squads) if (sq.order && sq.order.obj !== undefined) have.set(sq.order.obj, (have.get(sq.order.obj) || 0) + 1);
    // release squads from over-allocated objectives (prefer those not in combat, then farthest)
    const free = [];
    for (const sq of squads) {
      if (!sq.order || sq.order.obj === undefined) { free.push(sq); continue; }
      const id = sq.order.obj;
      const w = want.get(id) || 0, h = have.get(id) || 0;
      if (h > w) {
        const busy = B.time - sq.contactT < 15 || sq.state === 'mounted' || sq.state === 'mount';
        if (!busy || h > w + 2) { free.push(sq); have.set(id, h - 1); }
      }
    }
    // fill under-allocated objectives with the nearest free squads
    const needs = [];
    for (const [id, w] of want) { const h = have.get(id) || 0; for (let k = h; k < w; k++) needs.push(id); }
    U_shuffle(needs);
    for (const id of needs) {
      if (!free.length) break;
      const o = W.objectives[id];
      let bi = 0, bd = 1e9;
      for (let k = 0; k < free.length; k++) {
        const sq = free[k];
        const l = sq.leader >= 0 ? sq.leader : sq.members[0];
        const d = U.dist(S.x[l], S.z[l], o.x, o.z);
        if (d < bd) { bd = d; bi = k; }
      }
      const sq = free.splice(bi, 1)[0];
      const prev = sq.order && sq.order.obj;
      const a = Math.random() * 6.28, r = Math.random() * o.r * 0.35;
      sq.order = { obj: id, ox: Math.cos(a) * r, oz: Math.sin(a) * r };
      if (prev !== id) { if (sq.state === 'defend' || sq.state === 'hold' || sq.state === 'regroup') sq.state = 'move'; sq.routeKey = ''; sq.flanked = false; if (team === B.playerTeam && sq.playerSquad) IF.Radio.say(B, sq, 'orders', o); }
    }
    // anything left keeps its order or reinforces the focus
    for (const sq of free) if (!sq.order) sq.order = { obj: this.focus >= 0 ? this.focus : hq.id, ox: 0, oz: 0 };

    // vehicles
    const vehs = B.vehicles.filter((v) => v.team === team && v.state === 'active' && !v.playerIn && v.crew.length);
    const supportTargets = tops.length ? tops.map((a) => a.q.o.id) : def.slice(0, 2).map((d) => d.q.o.id);
    const threatened = def.filter((d) => d.q.e > 6).map((d) => d.q.o.id);
    let k = 0;
    for (const v of vehs) {
      if (v.type === 'arty' || v.task === 'transport' || v.task === 'return') continue;
      if (v.type === 'truck' || v.type === 'theli' || (v.type === 'apc' && v.task === 'idle')) continue;
      const pool = threatened.length && (k % 3 === 0) ? threatened : supportTargets;
      const id = pool[(v.id + k) % pool.length];
      if (v.order !== id) { v.order = id; v.dest = null; }
      if (v.task === 'idle' && v.hp > v.T.hp * 0.6) v.task = 'support';
      k++;
    }

    // artillery barrage on the enemy concentration at our focus
    if (this.artyT <= 0) {
      const target = this.pickBarrage(info);
      if (target) {
        this.artyT = U.rr(110, 170) * (B.phase >= 4 ? 0.75 : 1);
        this.barrage(target.x, target.z, U.ri(6, 10), target.r);
      } else this.artyT = 20;
    }
    if (this.airT <= 0) {
      const target = this.pickBarrage(info, true);
      if (target) {
        this.airT = U.rr(220, 320);
        IF.Vehicles.airstrike(B, team, target.x, target.z);
        IF.Radio.command(B, team, 'airstrike', target.o, team === B.playerTeam);
        if (team !== B.playerTeam) IF.Radio.command(B, 1 - team, 'enemyJets', target.o, true);
      } else this.airT = 30;
    }
  };
  function U_shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } }

  Commander.prototype.pickBarrage = function (info, air) {
    const B = this.B, S = B.S, team = this.team;
    let best = null, bs = 0;
    for (const q of info) {
      if (q.e < 8 || q.o.hq >= 0) continue; // never shell headquarters (spawn areas)
      // centroid of enemies near the objective
      let cx = 0, cz = 0, n = 0;
      B.gridT[1 - team].query(S, q.o.x, q.o.z, q.o.r + 60, (j) => { cx += S.x[j]; cz += S.z[j]; n++; });
      if (!n) continue;
      cx /= n; cz /= n;
      const [f] = IF.AI.strengthNear(B, team, cx, cz, air ? 90 : 70);
      if (f > 2) continue; // never shell our own people
      const s = n - f * 5 + (q.o.id === this.focus ? 6 : 0);
      if (s > bs) { bs = s; best = { x: cx, z: cz, r: 35, o: q.o }; }
    }
    return best;
  };

  Commander.prototype.barrage = function (x, z, n, r) {
    const B = this.B, team = this.team;
    B.W.dangerZones.push({ x, z, r: r + 40, t: 40, team, level: 1 });
    const spgs = B.vehicles.filter((v) => v.team === team && v.type === 'arty' && v.state === 'active' && v.crew.length);
    for (let k = 0; k < n; k++) {
      B.scheduled.push({ t: B.time + 2 + k * U.rr(0.6, 1.6), fn: () => {
        const tx = x + U.gauss() * r, tz = z + U.gauss() * r;
        const ty = B.W.groundAt(tx, tz);
        const gun = spgs.length ? spgs[k % spgs.length] : null;
        if (gun && gun.state === 'active') {
          const T = 9 + U.dist(gun.x, gun.z, tx, tz) / 160;
          const mx = gun.x + U.dirX(gun.yaw) * 5, my = gun.y + 3.5, mz = gun.z + U.dirZ(gun.yaw) * 5;
          const [vx, vy, vz] = IF.Combat.ballistic(mx, my, mz, tx, ty, tz, T, 9.8);
          IF.Combat.spawnProj(B, 'arty', mx, my, mz, vx, vy, vz, team, -1, gun.id);
          gun.recoil = 1; gun.flash = 0.1; gun.turretYaw = Math.atan2(-(tx - gun.x), -(tz - gun.z)); gun.gunPitch = 0.7;
          IF.FX.muzzle(mx, my, mz, team, 4); IF.SFX.cannon(mx, my, mz, true);
        } else {
          // off-map battery
          const hq = B.W.objectives[team];
          const sx = hq.x + U.rr(-200, 200), sz = hq.z + (team === 0 ? 400 : -400), sy = 900;
          const T = 14;
          const [vx, vy, vz] = IF.Combat.ballistic(sx, sy, sz, tx, ty, tz, T, 9.8);
          IF.Combat.spawnProj(B, 'arty', sx, sy, sz, vx, vy, vz, team, -1);
        }
      } });
    }
    IF.Radio.command(B, team, 'arty', null, team === B.playerTeam);
    IF.emit('barrage', team, x, z);
  };

  // forced counter-attack (random event)
  Commander.prototype.counterattack = function (objId) {
    this.counterT = this.B.time; this.counterObj = objId; this.t = 0.1;
  };
})(typeof window !== 'undefined' ? window : globalThis);
