// Battle orchestration: setup, objective capture, reinforcement waves, tickets, phases,
// random battlefield events, weather/time of day, radio chatter.
(function (G) {
  'use strict';
  const IF = G.IF, U = IF.U, ST = IF.ST, R = IF.ROLE, AI = IF.AI;

  const PHASES = ['', 'INITIAL DEPLOYMENT', 'FIRST CONTACT', 'MAIN ENGAGEMENT', 'REINFORCEMENT PHASE', 'FINAL ASSAULT', 'BATTLE OVER'];
  IF.PHASES = PHASES;
  const SIZES = { skirmish: 500, standard: 1000, long: 2000, epic: 4000 };
  IF.BATTLE_SIZES = SIZES;
  const WEATHERS = ['clear', 'clear', 'overcast', 'rain', 'fog', 'storm'];

  const Battle = (IF.Battle = {});

  Battle.create = function (opts) {
    const seed = opts.seed || (Math.random() * 1e9) | 0;
    const W = IF.MapGen.generate(seed, opts.layout);
    const N = IF.CFG.MAX_SOLDIERS;
    const tk = SIZES[opts.size] || 1000;
    const B = {
      opts, seed, W, S: new IF.Soldiers(N), squads: [], vehicles: [], activeVeh: [], wreckList: [], jets: [], uavs: [],
      proj: new IF.Proj(500), time: 0, tickets: [tk, tk], startTickets: tk, deaths: [0, 0], vehLost: [0, 0],
      phase: 1, phaseT: 0, playerIdx: -1, playerTeam: opts.playerTeam || 0, playerAlive: false, playerDowned: false, playerInVehicle: false, playerVeh: null,
      diff: IF.DIFFICULTY[opts.difficulty] || IF.DIFFICULTY.regular, cmd: [],
      gridT: [new IF.Grid(32, N), new IF.Grid(32, N)], gridF: new IF.Grid(6, N),
      camX: 0, camY: 0, camZ: 0, visMul: 1, balance: opts.balance || 0.14, corpses: [], downed: [[], []], scheduled: [], vehQueue: [], parkCursor: [0, 0],
      distantShots: 0, firstContact: false, over: false, winner: -1, lastStand: [-1, -1], eventT: U.rr(80, 120), flyT: U.rr(20, 50), bleedT: 0, objT: 0, waveT: [5, 5 + IF.CFG.WAVE_TIME / 2],
      helpMarker: null, supply: [], env: { hour: 8, weather: 'clear', targetWeather: 'clear', rain: 0, fog: 0, cloud: 0.2, wind: U.rr(0, 6.28), lightning: 0, dayLen: 24 * 60 },
      stats: { kills: [0, 0] }, radioT: {},
    };
    IF.B = B;
    // time of day & weather
    const tod = opts.time === 'random' || !opts.time ? U.pick(['dawn', 'day', 'day', 'dusk', 'night']) : opts.time;
    B.env.hour = { dawn: 5.6, day: 10 + Math.random() * 4, dusk: 18.2, night: 22.5 }[tod] || 10;
    const wth = opts.weather === 'random' || !opts.weather ? U.pick(WEATHERS) : opts.weather;
    B.env.weather = B.env.targetWeather = wth;
    Battle.applyWeather(B, 1);

    // ---- vehicles & crews ----
    for (let team = 0; team < 2; team++) {
      for (const type of IF.VEH_ORDER) {
        const T = IF.VEH[type];
        for (let k = 0; k < T.count; k++) IF.Vehicles.spawnAtHQ(B, type, team);
      }
    }
    let next = [0, 1000];
    const S = B.S;
    for (const v of B.vehicles) {
      const sq = AI.makeSquad(B, v.team, 'crew');
      sq.veh = v.id; v.crewSquad = sq.id; sq.state = 'mounted'; sq.callsign = v.T.short + '-' + (v.id + 1);
      for (let c = 0; c < v.T.crew; c++) {
        const i = next[v.team]++;
        AI.initSoldier(B, i, v.team, R.CREW, sq, c);
        AI.resetSoldier(B, i, v.x, v.z);
        S.st[i] = ST.MOUNTED; S.veh[i] = v.id; v.crew.push(i);
      }
    }
    // ---- infantry squads ----
    const rng = U.makeRng(seed + 5);
    for (let team = 0; team < 2; team++) {
      const end = team * 1000 + 1000;
      while (next[team] < end) {
        let size = rng.int(8, 12);
        if (end - next[team] < 8 || size > end - next[team]) size = end - next[team];
        if (end - next[team] - size < 8 && end - next[team] - size > 0) size = end - next[team];
        const sq = AI.makeSquad(B, team, 'inf');
        for (let k = 0; k < size; k++) AI.initSoldier(B, next[team]++, team, k < 12 ? [R.LEADER, R.RIFLE, R.RIFLE, R.MG, R.MEDIC, R.AT, R.RIFLE, R.ENGINEER, R.RECON, R.RIFLE, R.MG, R.AT][k] : R.RIFLE, sq, k);
      }
    }
    // ---- deployment: HQ and owned rear objectives ----
    for (let team = 0; team < 2; team++) {
      const sqs = B.squads.filter((q) => q.team === team && q.type === 'inf');
      const spawns = W.objectives.filter((o) => o.owner === team);
      sqs.forEach((sq, k) => {
        const o = spawns[k % spawns.length];
        const p = o.spawnPts[k % o.spawnPts.length];
        for (const m of sq.members) {
          const [px, pz] = W.freeSpot(p[0] + U.rr(-6, 6), p[1] + U.rr(-6, 6));
          AI.resetSoldier(B, m, px, pz);
        }
        sq.state = 'deploy'; sq.stateT = U.rr(1, 8);
      });
    }
    // ---- commanders & drones ----
    B.cmd = [new IF.Commander(B, 0), new IF.Commander(B, 1)];
    for (let team = 0; team < 2; team++) B.uavs.push({ team, cx: U.rr(-200, 200), cz: team === 0 ? -260 : 260, r: 420, a: Math.random() * 6.28, x: 0, z: 0, y: 380, yaw: 0, scanT: 3 });
    Battle.buildGrids(B);
    IF.Vehicles.update(B, 0.001);
    for (const c of B.cmd) c.plan();
    return B;
  };

  Battle.applyWeather = function (B, k) {
    const e = B.env;
    const t = { clear: [0, 0, 0.15], overcast: [0, 0.15, 0.75], rain: [0.8, 0.3, 0.9], fog: [0, 0.85, 0.6], storm: [1, 0.4, 1] }[e.targetWeather];
    e.rain = U.lerp(e.rain, t[0], k); e.fog = U.lerp(e.fog, t[1], k); e.cloud = U.lerp(e.cloud, t[2], k);
    if (k >= 1 || Math.abs(e.rain - t[0]) + Math.abs(e.fog - t[1]) < 0.02) e.weather = e.targetWeather;
  };
  Battle.daylight = function (B) {
    // sun elevation from hour: noon high, 6/18 horizon
    const h = B.env.hour;
    const el = Math.sin(((h - 6) / 12) * Math.PI);
    return el;
  };

  Battle.buildGrids = function (B) {
    const S = B.S, P = B.playerIdx;
    const okPlayer = B.playerAlive && !B.playerInVehicle;
    B.gridT[0].build(S, (i) => S.st[i] === ST.ALIVE && S.team[i] === 0 && (i !== P || okPlayer));
    B.gridT[1].build(S, (i) => S.st[i] === ST.ALIVE && S.team[i] === 1 && (i !== P || okPlayer));
    B.gridF.build(S, (i) => (S.st[i] === ST.ALIVE || S.st[i] === ST.DOWNED) && (i !== P || okPlayer || B.playerDowned));
  };

  // ------------------------------------------------------------------
  Battle.update = function (B, dt) {
    if (B.over) { B.time += dt; IF.Vehicles.update(B, dt); IF.Combat.updateProj(B, dt); B.W.update(dt); return; }
    B.time += dt;
    // environment
    B.env.hour = (B.env.hour + dt * 24 / B.env.dayLen) % 24;
    if (B.env.weather !== B.env.targetWeather) Battle.applyWeather(B, dt * 0.02);
    const sun = Battle.daylight(B);
    const night = U.clamp(-sun * 4 + 0.3, 0, 1);
    B.night = night;
    B.visMul = (1 - night * 0.42) * (1 - B.env.fog * 0.45) * (1 - B.env.rain * 0.18) * (B.flareT > B.time ? 1.25 : 1);
    if (B.env.weather === 'storm' && Math.random() < dt * 0.08) { B.env.lightning = 1; IF.emit('lightning'); }
    B.env.lightning = Math.max(0, B.env.lightning - dt * 3);

    Battle.buildGrids(B);
    AI.update(B, dt);
    AI.updateSquads(B, dt);
    B.cmd[0].update(dt); B.cmd[1].update(dt);
    IF.Vehicles.update(B, dt);
    IF.Combat.updateProj(B, dt);
    B.W.update(dt);
    // scheduled actions
    for (let k = B.scheduled.length - 1; k >= 0; k--) { const s = B.scheduled[k]; if (B.time >= s.t) { B.scheduled.splice(k, 1); s.fn(); } }
    // downed lists cleanup
    for (let t = 0; t < 2; t++) { const L = B.downed[t]; for (let k = L.length - 1; k >= 0; k--) if (B.S.st[L[k]] !== ST.DOWNED) L.splice(k, 1); }
    B.objT -= dt; if (B.objT <= 0) { Battle.objectives(B, 0.5); B.objT = 0.5; }
    for (let t = 0; t < 2; t++) { B.waveT[t] -= dt; if (B.waveT[t] <= 0) { B.waveT[t] = IF.CFG.WAVE_TIME; Battle.wave(B, t); } }
    B.bleedT -= dt; if (B.bleedT <= 0) { B.bleedT = IF.CFG.BLEED_INTERVAL; Battle.bleed(B); }
    Battle.phases(B, dt);
    Battle.events(B, dt);
    Battle.mines(B, dt);
    Battle.stations(B, dt);
    Battle.checkEnd(B);
  };

  // ------------------------------------------------------------------
  Battle.objectives = function (B, dt) {
    const S = B.S, W = B.W;
    const owned = [0, 0];
    for (const o of W.objectives) if (o.owner >= 0 && o.hq < 0) owned[o.owner]++;
    for (const o of W.objectives) {
      let c0 = 0, c1 = 0;
      B.gridF.query(S, o.x, o.z, o.r, (i) => { if (S.st[i] !== ST.ALIVE) return; if (S.team[i] === 0) c0++; else c1++; });
      for (const v of B.activeVeh) if (v.state === 'active' && v.team >= 0 && !v.T.air && U.dist2(v.x, v.z, o.x, o.z) < o.r * o.r) { if (v.team === 0) c0 += 2; else c1 += 2; }
      o.c0 = c0; o.c1 = c1;
      o.contested = c0 > 0 && c1 > 0;
      let diff = c1 - c0;
      if (o.hq >= 0) {
        const att = 1 - o.hq;
        if (owned[att] < 5) { if (o.owner === o.hq) { o.progress = o.hq === 0 ? -1 : 1; continue; } }
      }
      const rate = 0.0065 * Math.min(Math.abs(diff), 10) * (o.hq >= 0 ? 0.35 : 1);
      if (diff === 0) {
        // drift back to owner when uncontested & empty
        if (c0 === 0 && c1 === 0 && o.owner >= 0) o.progress = U.lerp(o.progress, o.owner === 0 ? -1 : 1, dt * 0.02);
        continue;
      }
      const prev = o.progress, prevOwner = o.owner;
      o.progress = U.clamp(o.progress + Math.sign(diff) * rate * dt, -1, 1);
      if (o.owner === 0 && o.progress > -0.0001 && prev <= -0.0001) { o.owner = -1; IF.emit('objNeutral', o, 0); }
      if (o.owner === 1 && o.progress < 0.0001 && prev >= 0.0001) { o.owner = -1; IF.emit('objNeutral', o, 1); }
      if (o.owner === -1 && o.progress <= -1) { o.owner = 0; }
      if (o.owner === -1 && o.progress >= 1) { o.owner = 1; }
      if (o.owner !== prevOwner && o.owner >= 0) {
        o.capturedT = B.time;
        IF.emit('objCaptured', o, o.owner, prevOwner);
        IF.Radio.objective(B, o, o.owner);
        // the side that lost it may counterattack
        if (prevOwner >= 0 || Math.random() < 0.4) { const loser = 1 - o.owner; if (Math.random() < 0.45) B.cmd[loser].counterattack(o.id); }
        if (o.hq >= 0 && o.owner !== o.hq) Battle.finish(B, o.owner, 'hq');
      }
    }
  };

  Battle.bleed = function (B) {
    const owned = [0, 0];
    for (const o of B.W.objectives) if (o.owner >= 0) owned[o.owner]++;
    for (let t = 0; t < 2; t++) {
      const d = owned[1 - t] - owned[t];
      if (d >= 2) B.tickets[t] = Math.max(0, B.tickets[t] - (d - 1));
    }
  };

  // pick a reinforcement spawn for a squad
  Battle.spawnFor = function (B, sq) {
    const W = B.W, S = B.S;
    const hq = W.objectives[sq.team];
    if (sq.type === 'crew') return hq;
    const target = sq.order && sq.order.obj !== undefined ? W.objectives[sq.order.obj] : hq;
    let best = hq, bd = U.dist(hq.x, hq.z, target.x, target.z);
    for (const o of W.objectives) {
      if (o.owner !== sq.team || o.hq >= 0 || o.contested) continue;
      if (B.time - (o.capturedT || -1000) < 45) continue;
      const [, e] = AI.strengthNear(B, sq.team, o.x, o.z, 220);
      if (e > 0) continue;
      const d = U.dist(o.x, o.z, target.x, target.z);
      if (d < bd) { bd = d; best = o; }
    }
    // reinforcement convoys: many fresh squads start at HQ to use transports
    if (best !== hq && Math.random() < 0.35) best = hq;
    return best;
  };

  Battle.wave = function (B, team) {
    const S = B.S, W = B.W;
    if (B.tickets[team] <= 0) return;
    let spawned = 0;
    for (const sq of B.squads) {
      if (sq.team !== team) continue;
      const dead = sq.members.filter((m) => S.st[m] === ST.DEAD && m !== B.playerIdx);
      if (!dead.length) continue;
      let at = null;
      if (sq.alive === 0) at = Battle.spawnFor(B, sq);
      else if (sq.type === 'inf' && sq.leader >= 0 && B.time - sq.contactT > 20) {
        // refill when the squad is resting at a friendly spawn
        for (const o of W.objectives) {
          if (o.owner !== team || o.contested) continue;
          if (U.dist2(S.x[sq.leader], S.z[sq.leader], o.x, o.z) < (o.r + 30) ** 2) { at = o; break; }
        }
      } else if (sq.type === 'crew' && sq.leader >= 0) {
        const hq = W.objectives[team]; if (U.dist2(S.x[sq.leader], S.z[sq.leader], hq.x, hq.z) < 120 * 120) at = hq;
      }
      if (!at || at.owner !== team) continue;
      for (const m of dead) {
        let px, pz;
        if (sq.alive > 0 && sq.leader >= 0) { px = S.x[sq.leader] + U.rr(-5, 5); pz = S.z[sq.leader] + U.rr(-5, 5); if (U.dist2(px, pz, at.x, at.z) > (at.r + 40) ** 2) { const p = U.pick(at.spawnPts); px = p[0]; pz = p[1]; } }
        else { const p = at.spawnPts[(m * 7) % at.spawnPts.length]; px = p[0] + U.rr(-4, 4); pz = p[1] + U.rr(-4, 4); }
        const [fx, fz] = W.freeSpot(px, pz);
        AI.resetSoldier(B, m, fx, fz);
        spawned++;
      }
      if (sq.alive === 0) { sq.state = sq.type === 'crew' ? 'regroup' : 'move'; sq.stateT = 4; sq.routeKey = ''; sq.flanked = false; sq.contactT = -100; sq.veh = sq.type === 'crew' ? sq.veh : -1; sq.casualties = 0; }
    }
    if (spawned > 0) IF.emit('wave', team, spawned);
  };

  Battle.phases = function (B, dt) {
    const old = B.phase;
    const ratio = Math.min(B.tickets[0], B.tickets[1]) / B.startTickets;
    const owned = [0, 0];
    for (const o of B.W.objectives) if (o.owner >= 0 && o.hq < 0) owned[o.owner]++;
    const dom = Math.max(owned[0], owned[1]);
    if (B.phase === 1 && (B.firstContact || B.time > 100)) B.phase = 2;
    if (B.phase === 2 && (B.deaths[0] + B.deaths[1] > 80 || B.time > 260)) B.phase = 3;
    if (B.phase === 3 && (ratio < 0.62 || B.time > 1500)) B.phase = 4;
    if (B.phase === 4 && (ratio < 0.3 || dom >= 6)) B.phase = 5;
    if (B.phase !== old) {
      IF.emit('phase', B.phase, PHASES[B.phase]);
      if (B.phase === 4) {
        // both armies receive reinforcement convoys
        for (let t = 0; t < 2; t++) { Battle.convoy(B, t); B.cmd[t].aggr = Math.min(0.9, B.cmd[t].aggr + 0.05); }
      }
      if (B.phase === 5) { B.cmd[0].aggr += 0.15; B.cmd[1].aggr += 0.15; IF.Radio.command(B, B.playerTeam, 'final'); }
    }
  };

  Battle.checkEnd = function (B) {
    const S = B.S;
    for (let t = 0; t < 2; t++) {
      if (B.tickets[t] > 0) { B.lastStand[t] = -1; continue; }
      if (B.lastStand[t] < 0) { B.lastStand[t] = B.time; IF.emit('lastStand', t); IF.Radio.command(B, B.playerTeam, t === B.playerTeam ? 'ourLastStand' : 'theirLastStand'); }
      let alive = 0;
      for (const m of B.squads) if (m.team === t) alive += m.alive;
      if (alive < 40 || B.time - B.lastStand[t] > 100) { Battle.finish(B, 1 - t, 'tickets'); return; }
    }
  };
  Battle.finish = function (B, winner, why) {
    if (B.over) return;
    B.over = true; B.winner = winner; B.endReason = why; B.phase = 6;
    IF.emit('phase', 6, PHASES[6]);
    IF.emit('battleOver', winner, why);
  };

  // ------------------------------------------------------------------
  // random battlefield events
  Battle.events = function (B, dt) {
    B.flyT -= dt;
    if (B.flyT <= 0) { B.flyT = U.rr(35, 90); IF.Vehicles.flyover(B, Math.random() < 0.5 ? 0 : 1); }
    if (B.phase < 2) return;
    B.eventT -= dt;
    if (B.helpMarker && B.time > B.helpMarker.until) B.helpMarker = null;
    B.supply = B.supply.filter((s) => B.time < s.until);
    if (B.eventT > 0) return;
    B.eventT = U.rr(60, 130);
    const W = B.W, S = B.S;
    const pick = U.pick(['counter', 'counter', 'convoy', 'abandoned', 'weather', 'heli', 'armor', 'pinned', 'supply', 'flares', 'barrage']);
    const team = Math.random() < 0.5 ? 0 : 1;
    if (pick === 'counter') {
      // the team that holds fewer objectives counterattacks the most recently lost one
      const owned = [0, 0]; for (const o of W.objectives) if (o.owner >= 0) owned[o.owner]++;
      const t = owned[0] < owned[1] ? 0 : owned[1] < owned[0] ? 1 : team;
      const cands = W.objectives.filter((o) => o.owner === 1 - t && o.hq < 0);
      if (!cands.length) return;
      const o = cands.sort((a, b) => (b.capturedT || 0) - (a.capturedT || 0))[0];
      B.cmd[t].counterattack(o.id);
      IF.Radio.command(B, B.playerTeam, t === B.playerTeam ? 'ourCounter' : 'enemyCounter', o);
      IF.emit('event', 'counter', t, o);
    } else if (pick === 'convoy') Battle.convoy(B, team);
    else if (pick === 'abandoned') {
      const type = U.pick(['mbt', 'ifv', 'apc', 'truck', 'recon', 'recon']);
      for (let k = 0; k < 20; k++) {
        const x = U.rr(-700, 700), z = U.rr(-350, 350);
        if (W.blocked(x, z) || W.waterDepth(x, z) > 0 || W.slopeAt(x, z) > 0.3) continue;
        const v = IF.Vehicles.create(B, type, -1, x, z, U.rr(-3, 3));
        v.state = 'abandoned'; v.hp = v.T.hp * U.rr(0.35, 0.7); v.origTeam = -1; v.task = 'empty';
        const near = W.objectives.reduce((a, o) => (!a || U.dist(o.x, o.z, x, z) < U.dist(a.x, a.z, x, z) ? o : a), null);
        IF.Radio.command(B, B.playerTeam, 'abandoned', near, true, v);
        IF.emit('event', 'abandoned', -1, v);
        break;
      }
    } else if (pick === 'weather') {
      const opts = WEATHERS.filter((w) => w !== B.env.weather);
      B.env.targetWeather = U.pick(opts);
      IF.Radio.command(B, B.playerTeam, 'weather_' + B.env.targetWeather);
    } else if (pick === 'heli') {
      const sq = B.squads.find((q) => q.team === team && q.type === 'inf' && q.alive === 0);
      const heli = B.vehicles.find((v) => v.team === team && v.type === 'theli' && v.state === 'active' && v.task === 'idle' && v.reservedBy < 0 && v.crew.length);
      if (sq && heli) {
        const hq = W.objectives[team];
        for (const m of sq.members) { if (m === B.playerIdx) continue; AI.resetSoldier(B, m, heli.x, heli.z); IF.Vehicles.board(B, heli, m); }
        sq.order = { obj: B.cmd[team].focus >= 0 ? B.cmd[team].focus : hq.id, ox: 0, oz: 0 };
        sq.dest = AI.squadDest(B, sq); sq.veh = heli.id; sq.state = 'mounted';
        IF.Vehicles.depart(B, heli, sq);
        if (team === B.playerTeam) IF.Radio.command(B, team, 'heliInsert', W.objectives[sq.order.obj]);
      }
    } else if (pick === 'armor') {
      const f = B.cmd[team].focus;
      if (f < 0) return;
      for (const v of B.vehicles) if (v.team === team && v.state === 'active' && (v.type === 'mbt' || v.type === 'ifv') && !v.playerIn) { v.order = f; v.task = 'support'; v.dest = null; }
      IF.Radio.command(B, B.playerTeam, team === B.playerTeam ? 'ourArmor' : 'enemyArmor', W.objectives[f]);
    } else if (pick === 'pinned') {
      const t = B.playerTeam;
      const cands = B.squads.filter((q) => q.team === t && q.type === 'inf' && q.alive > 0 && B.time - q.contactT < 6 && q.alive / q.size < 0.75);
      if (!cands.length) return;
      const sq = U.pick(cands);
      B.helpMarker = { sq: sq.id, x: S.x[sq.leader], z: S.z[sq.leader], until: B.time + 120 };
      IF.Radio.say(B, sq, 'pinned', null, true);
      IF.emit('event', 'pinned', t, sq);
    } else if (pick === 'supply') {
      const t = B.playerTeam;
      const owned = W.objectives.filter((o) => o.owner === t && o.hq < 0);
      if (!owned.length) return;
      const o = U.pick(owned);
      const [x, z] = W.freeSpot(o.x + U.rr(-20, 20), o.z + U.rr(-20, 20));
      B.supply.push({ x, z, y: W.groundAt(x, z), until: B.time + 180, drop: B.time });
      IF.Radio.command(B, t, 'supply', o);
    } else if (pick === 'flares') {
      if (B.night < 0.5) return;
      const o = W.objectives.filter((q) => q.contested)[0] || U.pick(W.objectives);
      for (let k = 0; k < 4; k++) B.scheduled.push({ t: B.time + k * 8, fn: () => IF.FX.flare(o.x + U.rr(-60, 60), W.groundAt(o.x, o.z) + 160, o.z + U.rr(-60, 60)) });
      B.flareT = B.time + 40;
      IF.Radio.command(B, B.playerTeam, 'flares', o);
    } else if (pick === 'barrage') {
      B.cmd[team].artyT = 0;
    }
  };

  // reinforcement convoy: wiped / weak squads respawn at HQ and ride trucks to the front
  Battle.convoy = function (B, team) {
    const S = B.S, W = B.W;
    const hq = W.objectives[team];
    if (hq.owner !== team || B.tickets[team] <= 0) return;
    const sqs = B.squads.filter((q) => q.team === team && q.type === 'inf' && q.alive === 0).slice(0, 4);
    if (!sqs.length) return;
    const trucks = B.vehicles.filter((v) => v.team === team && v.state === 'active' && (v.type === 'truck' || v.type === 'apc') && v.task === 'idle' && v.reservedBy < 0 && !v.playerIn && v.crew.length);
    const focus = B.cmd[team].focus >= 0 ? B.cmd[team].focus : hq.id;
    let used = 0;
    for (const sq of sqs) {
      for (const m of sq.members) { if (m === B.playerIdx) continue; const p = U.pick(hq.spawnPts); const [fx, fz] = W.freeSpot(p[0], p[1]); AI.resetSoldier(B, m, fx, fz); }
      sq.order = { obj: focus, ox: U.rr(-15, 15), oz: U.rr(-15, 15) };
      sq.state = 'move'; sq.routeKey = ''; sq.contactT = -100;
      const v = trucks[used];
      if (v) {
        used++;
        for (const m of sq.members) if (m !== B.playerIdx) IF.Vehicles.board(B, v, m);
        sq.dest = AI.squadDest(B, sq); sq.veh = v.id; sq.state = 'mounted';
        IF.Vehicles.depart(B, v, sq);
      }
    }
    IF.Radio.command(B, B.playerTeam, team === B.playerTeam ? 'ourConvoy' : 'enemyConvoy', W.objectives[focus]);
    IF.emit('event', 'convoy', team, W.objectives[focus]);
  };

  // ammo & repair stations: whoever holds the objective rearms soldiers and repairs vehicles there
  Battle.STATION_R = 13;
  Battle.stations = function (B, dt) {
    B.stationT = (B.stationT || 0) - dt;
    if (B.stationT > 0) return;
    const step = 1 - B.stationT; B.stationT = 1;
    const S = B.S, R = Battle.STATION_R;
    for (const o of B.W.objectives) {
      const st = o.station; if (!st || o.owner < 0) continue;
      for (const v of B.activeVeh) {
        if (v.team !== o.owner || v.state !== 'active') continue;
        if (v.T.air ? v.alt > 6 : false) continue;
        if (U.dist2(v.x, v.z, st.x, st.z) > R * R) continue;
        const before = v.hp;
        v.hp = Math.min(v.T.hp, v.hp + v.T.hp * 0.07 * step);
        if (v.hp > v.T.hp * 0.3) v.burning = false;
        v.rockets = 8;
        v.atStation = B.time;
        if (v.playerIn && before < v.T.hp) IF.emit('stationRepair', v);
      }
      B.gridT[o.owner].query(S, st.x, st.z, 7, (i) => {
        if (S.role[i] === IF.ROLE.AT) S.rockets[i] = 4;
        S.grenades[i] = 2;
        if (S.hp[i] < 100 && i !== B.playerIdx) S.hp[i] = Math.min(100, S.hp[i] + 8 * step);
      });
    }
  };
  // nearest ammo/repair station held by a team
  Battle.nearestStation = function (B, team, x, z) {
    let best = null, bd = 1e12;
    for (const o of B.W.objectives) {
      if (o.owner !== team || !o.station || o.contested) continue;
      const d = U.dist2(o.station.x, o.station.z, x, z);
      if (d < bd) { bd = d; best = o.station; }
    }
    return best;
  };

  // minefields trigger on soldiers and vehicles
  Battle.mines = function (B, dt) {
    const W = B.W, S = B.S;
    B.mineT = (B.mineT || 0) - dt;
    if (B.mineT > 0) return;
    B.mineT = 0.5;
    for (const m of W.minefields) {
      B.gridF.query(S, m.x, m.z, m.r, (i) => {
        if (S.st[i] !== ST.ALIVE || S.spd[i] < 0.5 && i !== B.playerIdx) return;
        if (Math.random() < (i === B.playerIdx ? 0.25 : 0.12)) IF.Combat.explode(B, S.x[i], S.y[i] + 0.2, S.z[i], 5, 220, -1, -1, 'he');
      });
      for (const v of B.activeVeh) if (!v.T.air && Math.abs(v.spd) > 1 && U.dist2(v.x, v.z, m.x, m.z) < m.r * m.r && Math.random() < 0.2) {
        IF.Combat.explode(B, v.x, v.y + 0.3, v.z, 5, 200, -1, -1, 'he');
        IF.Combat.damageVehicle(B, v, 500, 'mine', -1, -1);
      }
    }
    // player-placed AT mines
    if (B.atMines) for (let k = B.atMines.length - 1; k >= 0; k--) {
      const mn = B.atMines[k];
      for (const v of B.activeVeh) {
        if (v.T.air || v.team === mn.team || U.dist2(v.x, v.z, mn.x, mn.z) > 3 * 3) continue;
        IF.Combat.explode(B, mn.x, mn.y + 0.3, mn.z, 5, 200, mn.team, mn.owner, 'he');
        IF.Combat.damageVehicle(B, v, 950, 'mine', mn.owner, mn.team);
        B.atMines.splice(k, 1); break;
      }
    }
  };

  // ------------------------------------------------------------------
  // radio chatter
  const RADIO = {
    contact: ['Contact front!', 'Enemy spotted!', 'Contact! Enemy infantry!', 'Taking fire!', 'Eyes on hostiles!'],
    vehicle: ['Vehicle approaching!', 'Enemy armor spotted!', 'Tank! Get to cover!', 'Enemy vehicle on our flank!'],
    heli: ['Enemy helicopter overhead!', 'Rotary wing inbound!', 'Helo! Take cover!'],
    fallback: ["We're falling back!", 'Pull back! Pull back!', 'Too many of them, retreating!', 'Falling back to the rally point!'],
    reinforce: ['We need reinforcements at {obj}!', "Requesting support at {obj}, we're outnumbered!", 'Need backup at {obj}, now!'],
    mount: ['Mount up!', "Everyone in the vehicle, let's move!", 'Boarding transport.'],
    dismount: ['Dismount! Go go go!', 'Everybody out!', 'Off the truck, move!'],
    moving: ['Squad moving out!', 'Moving up!', 'Bounding forward!', 'Covering, move!', 'Advancing!'],
    flankL: ['Flanking left!', 'Going around the left side!'],
    flankR: ['Flanking right!', 'Swinging right, cover us!'],
    inposition: ['In position at {obj}.', 'Holding {obj}.', 'Dug in at {obj}.'],
    orders: ['Copy, moving to {obj}.', 'Roger, heading for {obj}.'],
    pinned: ["We're pinned down! Need assistance!", 'Pinned down here, someone help!'],
    captured: ['Objective secured!', '{obj} is ours!', 'We have taken {obj}!'],
    lost: ["We've lost {obj}!", '{obj} has fallen!', 'Enemy has captured {obj}!'],
  };
  const COMMAND = {
    posture_assault: 'All units, general assault! Push them back!', posture_advance: 'All units, advance and secure the objectives.',
    posture_defensive: 'All units, hold your positions and dig in.', posture_counter: 'Counter-attack! Retake the line!',
    arty: 'Fire mission inbound, keep your heads down!', airstrike: 'Air support inbound on {obj}!', enemyJets: 'Enemy jets inbound! Take cover!',
    final: 'This is it! Final assault — everything we have!', ourLastStand: 'We are out of reinforcements! Hold at all costs!', theirLastStand: 'Enemy reinforcements are exhausted! Finish them!',
    ourCounter: 'Launching counter-attack on {obj}!', enemyCounter: 'Enemy counter-attack at {obj}!',
    ourConvoy: 'Reinforcement convoy en route to {obj}.', enemyConvoy: 'Recon reports an enemy convoy moving toward {obj}.',
    abandoned: 'Abandoned {veh} reported near {obj}.', heliInsert: 'Helicopter insertion inbound at {obj}.',
    ourArmor: 'Armored units, push on {obj}!', enemyArmor: 'Enemy armor column advancing on {obj}!',
    supply: 'Supply drop delivered at {obj}.', flares: 'Illumination rounds over {obj}.',
    weather_clear: 'Weather is clearing up.', weather_overcast: 'Clouds rolling in.', weather_rain: 'Rain moving in, visibility dropping.', weather_fog: 'Fog bank incoming, watch your sectors.', weather_storm: 'Storm front incoming!',
  };
  const fill = (s, o, v) => s.replace('{obj}', o ? (o.letter && o.letter !== 'HQ' ? o.letter + ' — ' + o.name : o.name) : 'the line').replace('{veh}', v ? v.T.name.toLowerCase() : 'vehicle');
  IF.Radio = {
    say(B, sq, key, obj, force) {
      if (!sq || sq.team !== B.playerTeam) return;
      const lib = RADIO[key]; if (!lib) return;
      if (!force && B.time - sq.radioT < 9) return;
      // only squads near the player (or the player's own squad) are on our net
      const S = B.S;
      if (!force && !sq.playerSquad) {
        if (B.playerIdx < 0) return;
        const l = sq.leader >= 0 ? sq.leader : sq.members[0];
        const px = B.playerVeh ? B.playerVeh.x : S.x[B.playerIdx], pz = B.playerVeh ? B.playerVeh.z : S.z[B.playerIdx];
        if (U.dist2(S.x[l], S.z[l], px, pz) > 320 * 320) return;
      }
      if (!force && B.time - (B.radioT[key] || -100) < (key === 'contact' || key === 'moving' ? 4 : 7)) return;
      B.radioT[key] = B.time;
      sq.radioT = B.time;
      IF.emit('radio', sq.callsign, fill(U.pick(lib), obj || (sq.dest && sq.dest.obj)), key, sq);
    },
    command(B, team, key, obj, force, v) {
      if (team !== B.playerTeam) return;
      const s = COMMAND[key]; if (!s) return;
      IF.emit('radio', 'COMMAND', fill(s, obj, v), key, null);
    },
    objective(B, o, team) {
      const lib = team === B.playerTeam ? RADIO.captured : RADIO.lost;
      IF.emit('radio', 'COMMAND', fill(U.pick(lib), o), team === B.playerTeam ? 'captured' : 'lost', null);
    },
    vehicle(B, v, key) {
      if (B.time - (v.radioT || -100) < 30) return;
      v.radioT = B.time;
      const txt = { engaging: 'Engaging enemy armor!', damaged: 'We are hit! Pulling back for repairs!' }[key];
      if (txt) IF.emit('radio', v.T.short + '-' + v.id, txt, key, null);
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
