// The one human soldier: movement, stances, weapons, gadgets, vehicles, squad commands,
// damage, downed state, respawning as another friendly soldier, camera and progression.
(function (G) {
  'use strict';
  const IF = G.IF, U = IF.U, ST = IF.ST, C = IF.Combat, I = IF.Input;
  const P = (IF.Player = {});

  const XP = { kill: 100, head: 50, assist: 40, revive: 80, capture: 300, neutral: 120, vehicle: 400, heli: 600, command: 5, spot: 10, heal: 20, repair: 30, defend: 25, help: 150, supply: 20 };

  P.reset = function (B, opts) {
    P.B = B;
    P.cls = IF.CLASSES.find((c) => c.id === opts.cls) || IF.CLASSES[0];
    P.loadout = IF.loadoutFor(P.cls.id);
    const uni = IF.UNIFORMS.find((u) => u.id === P.loadout.uniform);
    P.uniformTint = uni && uni.tint ? new THREE.Color(uni.tint[0], uni.tint[1], uni.tint[2]) : null;
    P.idx = -1; P.alive = false; P.state = 'deploy'; P.deathT = 0; P.deployT = 0;
    P.yaw = B.playerTeam === 0 ? 0 : Math.PI; P.pitch = 0; P.vy = 0; P.vx = 0; P.vz = 0; P.onGround = true;
    P.stance = 0; P.stanceT = 0; P.lean = 0; P.ads = 0; P.sprint = false; P.firstPerson = false; P.nvg = false;
    P.shake = 0; P.recoilP = 0; P.recoilY = 0; P.heat = 0; P.dmgDirs = []; P.hitMarker = 0; P.hitKind = '';
    P.veh = null; P.seat = null; P.camDist = 3.4; P.binoc = false; P.artyCd = 0; P.gadgetCd = 0;
    P.downT = 0; P.reviveT = 0; P.reviveTgt = -1; P.spotCd = 0; P.cmdMenu = false; P.cooldownMsg = 0; P.suppress = 0;
    P.bs = { kills: 0, deaths: 0, headshots: 0, xp: 0, captures: 0, revives: 0, vehiclesDestroyed: 0, helisDown: 0, vehicleKills: 0, commands: 0, shots: 0, hits: 0, life: 0, bestLife: 0, lifeKills: 0, longestLife: 0, longest: 0, timesRevived: 0, distanceDriven: 0, assists: 0 };
    P.messages = [];
    P.lastDamageT = -100;
    P.timeAlive = 0;
    P.buildWeapons();
  };

  P.buildWeapons = function () {
    const L = P.loadout, cls = P.cls;
    const opt = IF.ATTACHMENTS[L.optic] || IF.ATTACHMENTS.none, brl = IF.ATTACHMENTS[L.barrel] || IF.ATTACHMENTS.none;
    const mk = (id, atts) => {
      const d = IF.WEAPONS[id];
      const magMul = atts.some((a) => a.mag) ? 1.5 : 1;
      const mag = Math.round(d.mag * (d.cat === 'launcher' || d.cat === 'sniper' || d.cat === 'shotgun' ? 1 : magMul));
      return { id, d, atts, mag, magMax: mag, reserve: mag * (d.mags - 1), fireCd: 0, zoom: Math.max(d.zoom, ...atts.map((a) => a.zoom || 0)), scope: d.scope || atts.some((a) => a.scope),
        recoilMul: atts.reduce((k, a) => k * (a.recoil || 1), 1), adsMul: atts.reduce((k, a) => k * (a.adsSpread || 1), 1), quiet: atts.some((a) => a.quiet), dmgMul: atts.reduce((k, a) => k * (a.dmg || 1), 1),
        reloadMul: atts.reduce((k, a) => k * (a.reload || 1), 1) };
    };
    const prim = IF.WEAPONS[L.primary];
    const pAtts = prim.cat === 'sniper' || prim.cat === 'launcher' ? [] : [opt, brl].filter((a) => a && a.name !== 'Iron Sights');
    P.weapons = [mk(L.primary, pAtts), mk('m9', [])];
    P.grenades = cls.grenades; P.smokes = cls.smoke || 0; P.mines = cls.mines || 0; P.medkits = cls.gadget === 'medkit' ? 4 : 0;
    if (cls.gadget === 'launcher') P.weapons.push(mk(IF.Profile.xp >= IF.RANKS[5][2] ? 'at4' : 'rpg', []));
    P.slot = 0; P.switchT = 0; P.reloadT = 0;
  };
  P.weapon = () => P.weapons[P.slot];
  P.tpGun = function () { const w = P.weapon(); if (!w) return 'rifle'; const m = w.d.model; return m === 'mg' ? 'mg' : m === 'sniper' ? 'sniper' : m === 'at' ? 'at' : 'rifle'; };

  // ------------------------------------------------------------------ deploy / respawn
  P.spawnOptions = function () {
    const B = P.B, W = B.W, S = B.S, team = B.playerTeam;
    const out = [];
    for (const o of W.objectives) {
      if (o.owner !== team) continue;
      const [, e] = IF.AI.strengthNear(B, team, o.x, o.z, 150);
      if (o.hq < 0 && (o.contested || e > 0)) { out.push({ kind: 'obj', obj: o, label: (o.letter === 'HQ' ? '' : o.letter + ' — ') + o.name, blocked: 'CONTESTED' }); continue; }
      out.push({ kind: 'obj', obj: o, label: (o.letter === 'HQ' ? '' : o.letter + ' — ') + o.name });
    }
    // take over a soldier of a nearby squad
    const squads = B.squads.filter((q) => q.team === team && q.type === 'inf' && q.alive > 0);
    const mySq = P.squadId !== undefined ? B.squads[P.squadId] : null;
    squads.sort((a, b) => (b === mySq) - (a === mySq) || b.alive - a.alive);
    for (const sq of squads.slice(0, 5)) {
      const m = sq.members.find((i) => S.st[i] === ST.ALIVE && i !== P.idx && B.time - S.alertT[i] > 4);
      if (m === undefined) continue;
      out.push({ kind: 'soldier', idx: m, sq, label: 'Take over ' + IF.ROLE_NAMES[S.role[m]] + ' · ' + sq.callsign + (sq === mySq ? ' (your squad)' : ''), x: S.x[m], z: S.z[m] });
    }
    return out;
  };

  P.deploy = function (opt) {
    const B = P.B, S = B.S, W = B.W, team = B.playerTeam;
    let idx = -1;
    if (opt.kind === 'soldier') {
      idx = opt.idx;
      if (S.st[idx] !== ST.ALIVE) return false;
    } else {
      const o = opt.obj;
      if (B.tickets[team] <= 0) { P.message('No reinforcements left — take over a soldier instead'); return false; }
      // reuse a dead slot from a squad (prefer the previous squad)
      const prefer = P.squadId !== undefined ? B.squads[P.squadId] : null;
      const pools = prefer ? [prefer].concat(B.squads) : B.squads;
      for (const sq of pools) {
        if (sq.team !== team || sq.type !== 'inf') continue;
        const d = sq.members.find((i) => S.st[i] === ST.DEAD);
        if (d !== undefined) { idx = d; break; }
      }
      if (idx < 0) {
        // everyone alive: replace the nearest soldier at that spawn
        let bd = 1e9;
        for (let i = team * 1000; i < team * 1000 + 1000; i++) if (S.st[i] === ST.ALIVE && S.role[i] !== IF.ROLE.CREW) { const d = U.dist2(S.x[i], S.z[i], o.x, o.z); if (d < bd) { bd = d; idx = i; } }
      }
      if (idx < 0) return false;
      const p = U.pick(o.spawnPts);
      const [fx, fz] = W.freeSpot(p[0], p[1]);
      IF.AI.resetSoldier(B, idx, fx, fz);
      // a freshly arriving soldier: its squad gathers here
      const sq = B.squads[S.squad[idx]];
      if (sq && sq.alive === 0) { for (const m of sq.members) if (m !== idx && S.st[m] === ST.DEAD && B.tickets[team] > 0) { const q = U.pick(o.spawnPts); const [ax, az] = W.freeSpot(q[0], q[1]); IF.AI.resetSoldier(B, m, ax, az); } sq.state = 'move'; sq.routeKey = ''; }
    }
    P.possess(idx);
    return true;
  };

  P.possess = function (idx) {
    const B = P.B, S = B.S;
    if (P.idx >= 0 && P.idx !== idx && B.squads[S.squad[P.idx]]) B.squads[S.squad[P.idx]].playerSquad = false;
    P.idx = idx; B.playerIdx = idx;
    S.role[idx] = P.cls.role;
    S.hp[idx] = 100; S.tgt[idx] = -1; S.task[idx] = 0;
    if (S.cover[idx] >= 0) { B.W.coverOwner[S.cover[idx]] = -1; S.cover[idx] = -1; }
    P.squadId = S.squad[idx];
    const sq = B.squads[P.squadId];
    if (sq) sq.playerSquad = true;
    P.alive = true; P.state = 'alive'; B.playerAlive = true; B.playerDowned = false; B.playerInVehicle = false; B.playerVeh = null;
    P.yaw = S.yaw[idx]; P.pitch = 0; P.stance = 0; P.vy = 0; P.veh = null;
    P.hp = 100; P.timeAlive = 0; P.bs.lifeKills = 0;
    P.buildWeapons();
    P.message('Deployed — ' + P.cls.name + (sq ? ' · ' + sq.callsign : ''));
    IF.emit('playerDeployed', idx);
  };

  // ------------------------------------------------------------------ damage
  IF.on('playerDamage', (dmg, att, kind, head) => {
    const B = P.B; if (!B || !P.alive) return;
    const S = B.S;
    if (P.veh) return;
    let d = dmg * B.diff.playerDmg * (head ? 1.6 : 1);
    if (kind === 'explosion' && dmg > 900) d = 999;
    P.hp -= d; S.hp[P.idx] = P.hp;
    P.lastDamageT = B.time;
    P.shake = Math.min(1.2, P.shake + 0.25 + d / 80);
    if (att >= 0 && att < S.n) P.dmgDirs.push({ x: S.x[att], z: S.z[att], t: 1.4 });
    else if (kind === 'explosion') P.dmgDirs.push({ x: S.x[P.idx] + U.rr(-5, 5), z: S.z[P.idx] + U.rr(-5, 5), t: 1.4 });
    IF.SFX.hit && P.hp > 0 && IF.Audio.on && IF.SFX.thump(S.x[P.idx], S.y[P.idx] + 1, S.z[P.idx]);
    if (P.hp <= 0) {
      const lethal = head || d > 140 || kind === 'crush';
      P.killer = att;
      if (!lethal && Math.random() < 0.65) P.goDown(att, kind);
      else P.die(att, kind, head);
    }
  });
  P.goDown = function (att, kind) {
    const B = P.B, S = B.S;
    P.alive = false; P.state = 'downed'; B.playerAlive = false; B.playerDowned = true;
    S.st[P.idx] = ST.DOWNED; S.hp[P.idx] = 0; S.rescuer[P.idx] = -1; S.downT[P.idx] = 999;
    B.downed[B.playerTeam].push(P.idx);
    P.downT = 30; P.hp = 0;
    P.message('You are down! Wait for a medic or press ' + I.label('jump') + ' to give up');
    IF.SFX.shout(S.x[P.idx], S.y[P.idx], S.z[P.idx], 'medic', B.playerTeam);
  };
  P.die = function (att, kind, head) {
    const B = P.B, S = B.S;
    if (P.veh) P.exitVehicle(true);
    P.alive = false; B.playerAlive = false; B.playerDowned = false;
    if (S.st[P.idx] === ST.DOWNED || S.st[P.idx] === ST.ALIVE || S.st[P.idx] === ST.MOUNTED) { S.st[P.idx] = ST.ALIVE; C.kill(B, P.idx, att, kind, head); }
    P.state = 'dead'; P.deathT = B.time; P.deathPos = [S.x[P.idx], S.y[P.idx], S.z[P.idx]];
    P.bs.deaths++;
    P.bs.longestLife = Math.max(P.bs.longestLife, P.timeAlive);
    P.killer = att;
    IF.emit('playerDied', att, kind);
  };
  IF.on('playerFinished', (att, kind) => { if (P.B && P.state === 'downed') P.die(att, kind, false); });
  IF.on('revived', (t, by) => {
    const B = P.B; if (!B) return;
    if (t === P.idx && P.state === 'downed') {
      P.alive = true; P.state = 'alive'; B.playerAlive = true; B.playerDowned = false; P.hp = 45; B.S.hp[P.idx] = 45; P.stance = 1;
      P.bs.timesRevived++;
      P.message('Revived by a medic!');
    } else if (by === P.idx) { P.bs.revives++; P.addXP(XP.revive, 'Revive'); }
  });
  IF.on('playerHealed', (amt) => { if (P.B && P.alive) { P.hp = Math.min(100, P.hp + amt); P.B.S.hp[P.idx] = P.hp; P.message('Patched up by a medic (+' + amt + ')'); } });

  // ------------------------------------------------------------------ XP, kills, events
  P.addXP = function (n, why) {
    P.bs.xp += n;
    P.xpPops = P.xpPops || [];
    P.xpPops.push({ n, why, t: 2.2 });
    if (P.xpPops.length > 5) P.xpPops.shift();
  };
  IF.on('playerKill', (t, kind, head, downed) => {
    const B = P.B, S = B.S;
    if (S.team[t] === B.playerTeam) return;
    if (downed) { P.addXP(60, 'Enemy down'); return; }
    P.bs.kills++; P.bs.lifeKills++; P.bs.bestLife = Math.max(P.bs.bestLife, P.bs.lifeKills);
    if (head) P.bs.headshots++;
    if (P.veh) P.bs.vehicleKills++;
    const d = Math.sqrt(U.dist2(S.x[t], S.z[t], S.x[P.idx], S.z[P.idx]));
    P.bs.longest = Math.max(P.bs.longest, d);
    let xp = XP.kill + (head ? XP.head : 0);
    if (B.helpMarker && U.dist2(S.x[t], S.z[t], B.helpMarker.x, B.helpMarker.z) < 90 * 90) xp += 60;
    P.addXP(xp, head ? 'Headshot kill' : 'Kill');
    P.hitMarker = 0.35; P.hitKind = 'kill';
    IF.SFX.hit('kill');
  });
  IF.on('playerHit', (t, head, lethal) => { P.hitMarker = 0.22; P.hitKind = head ? 'head' : 'hit'; if (!lethal) IF.SFX.hit(head ? 'head' : 'hit'); P.bs.hits++; });
  IF.on('playerHitVehicle', (v) => { P.hitMarker = 0.25; P.hitKind = 'veh'; IF.SFX.hit('hit'); });
  IF.on('vehicleDestroyed', (v, att, attTeam, wasTeam) => {
    const B = P.B; if (!B) return;
    if (att === P.idx && wasTeam === 1 - B.playerTeam) { P.bs.vehiclesDestroyed++; if (v.T.air) P.bs.helisDown++; P.addXP(v.T.air ? XP.heli : XP.vehicle, v.T.name + ' destroyed'); }
  });
  IF.on('objCaptured', (o, team) => {
    const B = P.B; if (!B || !P.alive) return;
    const S = B.S;
    const px = P.veh ? P.veh.x : S.x[P.idx], pz = P.veh ? P.veh.z : S.z[P.idx];
    if (team === B.playerTeam && U.dist2(px, pz, o.x, o.z) < (o.r + 10) ** 2) { P.bs.captures++; P.addXP(XP.capture, 'Objective captured'); }
  });
  IF.on('objNeutral', (o, team) => {
    const B = P.B; if (!B || !P.alive) return;
    const S = B.S;
    const px = P.veh ? P.veh.x : S.x[P.idx], pz = P.veh ? P.veh.z : S.z[P.idx];
    if (team !== B.playerTeam && U.dist2(px, pz, o.x, o.z) < (o.r + 10) ** 2) P.addXP(XP.neutral, 'Objective neutralized');
  });
  IF.on('nearMiss', (sx, sz, k) => { P.suppress = Math.min(1, P.suppress + k * 2); if (Math.random() < 0.6) IF.SFX.crack(sx, sz, k); });
  IF.on('shake', (k) => { P.shake = Math.min(1.5, P.shake + k); });

  IF.on('playerVehicleDestroyed', (v) => {
    const B = P.B; if (!B || P.veh !== v) return;
    P.exitVehicle(true);
    const S = B.S;
    S.st[P.idx] = ST.ALIVE;
    if (Math.random() < 0.45) { P.hp = 25; S.hp[P.idx] = 25; P.shake = 1.5; P.message('Vehicle destroyed — you bailed out!'); }
    else P.die(v.lastAtt, 'explosion', false);
  });
  P.message = function (t) { P.messages.push({ t, life: 4 }); if (P.messages.length > 4) P.messages.shift(); };

  // ------------------------------------------------------------------ main update
  P.update = function (B, dt) {
    const S = B.S;
    P.hitMarker = Math.max(0, P.hitMarker - dt);
    P.shake = Math.max(0, P.shake - dt * 1.4);
    P.suppress = Math.max(0, P.suppress - dt * 0.6);
    for (const d of P.dmgDirs) d.t -= dt;
    P.dmgDirs = P.dmgDirs.filter((d) => d.t > 0);
    for (const m of P.messages) m.life -= dt;
    P.messages = P.messages.filter((m) => m.life > 0);
    if (P.xpPops) { for (const x of P.xpPops) x.t -= dt; P.xpPops = P.xpPops.filter((x) => x.t > 0); }
    P.gadgetCd = Math.max(0, P.gadgetCd - dt); P.artyCd = Math.max(0, P.artyCd - dt); P.spotCd = Math.max(0, P.spotCd - dt);

    if (I.hitA('camera')) P.firstPerson = !P.firstPerson;
    if (I.hitA('nvg')) { P.nvg = !P.nvg; P.message(P.nvg ? 'Night vision ON' : 'Night vision OFF'); }
    if (I.hitA('commands')) { P.cmdMenu = !P.cmdMenu; IF.SFX.ui(P.cmdMenu ? 'open' : 'back'); }

    if (P.state === 'downed') {
      P.downT -= dt;
      S.yaw[P.idx] += 0; P.stance = 2;
      P.look(dt, 0.4);
      if (I.hitA('jump') || P.downT <= 0) { P.die(S.lastAtt[P.idx], 'bleed'); }
      P.cameraFollowSoldier(B, dt);
      return;
    }
    if (P.state === 'dead' || P.state === 'deploy') { P.deathCam(B, dt); return; }
    // alive
    P.timeAlive += dt;
    P.bs.life = P.timeAlive;
    if (P.cmdMenu) P.handleCommands(B);
    if (P.veh) { P.vehicleUpdate(B, dt); return; }
    P.infantry(B, dt);
  };

  P.look = function (dt, k) {
    const s = 0.0022 * IF.Profile.settings.sens * (k || 1) / (1 + (P.ads > 0.5 ? (P.weapon().zoom - 1) * 0.8 : 0) + (P.binoc ? 4 : 0));
    P.yaw -= I.mx * s;
    P.pitch -= I.my * s * (IF.Profile.settings.invertY ? -1 : 1);
    P.pitch = U.clamp(P.pitch, -1.45, 1.45);
  };

  // ------------------------------------------------------------------ infantry
  P.infantry = function (B, dt) {
    const S = B.S, W = B.W, i = P.idx;
    P.look(dt);
    // regen
    if (B.time - P.lastDamageT > 9 && P.hp < B.diff.regenTo) { P.hp = Math.min(B.diff.regenTo, P.hp + dt * 6); S.hp[i] = P.hp; }
    // stance
    if (I.hitA('crouch')) { P.stance = P.stance === 1 ? 0 : 1; P.stanceT = 0.25; }
    if (I.hitA('prone')) { P.stance = P.stance === 2 ? 0 : 2; P.stanceT = 0.6; }
    P.stanceT = Math.max(0, P.stanceT - dt);
    const fwdIn = (I.downA('forward') ? 1 : 0) - (I.downA('back') ? 1 : 0), sideIn = (I.downA('right') ? 1 : 0) - (I.downA('left') ? 1 : 0);
    P.sprint = I.downA('sprint') && fwdIn > 0 && P.ads < 0.3 && P.reloadT <= 0.01 && !I.lmb;
    if (P.sprint && P.stance !== 0) P.stance = 0;
    // lean
    const leanIn = (I.downA('leanR') ? 1 : 0) - (I.downA('leanL') ? 1 : 0);
    P.lean = U.lerp(P.lean, P.sprint ? 0 : leanIn, Math.min(1, dt * 10));
    S.lean[i] = P.lean;
    // movement
    const wade = W.waterDepth(S.x[i], S.z[i]);
    let speed = P.sprint ? 6.4 : P.stance === 1 ? 2.1 : P.stance === 2 ? 0.85 : 3.7;
    if (P.ads > 0.5) speed *= 0.6;
    if (wade > 0.4) speed *= wade > 0.9 ? 0.45 : 0.65;
    if (P.stanceT > 0) speed *= 0.3;
    const fx = U.dirX(P.yaw), fz = U.dirZ(P.yaw), rx = -fz, rz = fx;
    let wx = fx * fwdIn + rx * sideIn, wz = fz * fwdIn + rz * sideIn;
    const wl = Math.sqrt(wx * wx + wz * wz);
    if (wl > 0) { wx /= wl; wz /= wl; }
    const acc = P.onGround ? 12 : 2;
    P.vx = U.lerp(P.vx, wx * speed, Math.min(1, dt * acc)); P.vz = U.lerp(P.vz, wz * speed, Math.min(1, dt * acc));
    let nx = S.x[i] + P.vx * dt, nz = S.z[i] + P.vz * dt;
    const can = (x, z) => !W.blocked(x, z, true) && W.waterDepth(x, z) < 1.6;
    const vehBlock = (x, z) => { for (const v of B.activeVeh) { if (v.T.air && v.alt > 2) continue; if (pointInVeh(v, x, z)) return true; } return false; };
    if (!can(nx, nz) || vehBlock(nx, nz)) {
      if (can(nx, S.z[i]) && !vehBlock(nx, S.z[i])) nz = S.z[i];
      else if (can(S.x[i], nz) && !vehBlock(S.x[i], nz)) nx = S.x[i];
      else { nx = S.x[i]; nz = S.z[i]; }
    }
    // vaulting low obstacles slows you
    const o = W.occAt(nx, nz);
    if (o > 3 && o <= 12) { nx = S.x[i] + (nx - S.x[i]) * 0.55; nz = S.z[i] + (nz - S.z[i]) * 0.55; }
    S.x[i] = nx; S.z[i] = nz;
    // vertical
    const g = W.groundAt(nx, nz);
    const top = g + Math.min(o, 12) * 0.1 * (o > 3 ? 1 : 0);
    if (I.hitA('jump') && P.onGround && P.stance === 0) { P.vy = 4.6; P.onGround = false; }
    P.vy -= 18 * dt;
    let y = S.y[i] + P.vy * dt;
    const floor = Math.max(g, o > 3 && o <= 12 ? top : g);
    if (y <= floor) { if (P.vy < -14) IF.emit('playerDamage', (-P.vy - 14) * 12, -1, 'fall', false); y = floor; P.vy = 0; P.onGround = true; }
    else if (y - floor > 0.3) P.onGround = false;
    if (P.onGround && y < floor + 0.6) y = U.lerp(y, floor, Math.min(1, dt * 18));
    S.y[i] = y;
    S.yaw[i] = P.yaw; S.stance[i] = P.stance;
    const sp = Math.sqrt(P.vx * P.vx + P.vz * P.vz);
    S.spd[i] = sp; S.anim[i] += sp * dt * 1.9; S.vx[i] = P.vx; S.vz[i] = P.vz;
    S.aimP[i] = P.pitch;
    S.mode[i] = P.sprint ? 2 : 1;
    // interactions
    P.interactPrompt = null;
    P.findInteract(B);
    if (I.hitA('interact')) P.interact(B);
    if (P.reviveTgt >= 0) {
      if (!I.downA('interact') || S.st[P.reviveTgt] !== ST.DOWNED || U.dist2(S.x[P.reviveTgt], S.z[P.reviveTgt], S.x[i], S.z[i]) > 9) { P.reviveTgt = -1; P.reviveT = 0; }
      else { P.reviveT += dt; const need = P.cls.id === 'medic' ? 1.8 : 4.5; P.reviveProg = P.reviveT / need; if (P.reviveT >= need) { IF.AI.revive(B, P.reviveTgt, P.idx); P.reviveTgt = -1; P.reviveT = 0; } }
    }
    if (I.hitA('spot')) P.spot(B);
    // supply crates & ammo near HQ / supply trucks
    P.resupplyCheck(B, dt);
    P.weaponsUpdate(B, dt);
    P.cameraInfantry(B, dt);
  };
  function pointInVeh(v, x, z) {
    const dx = x - v.x, dz = z - v.z, c = Math.cos(v.yaw), s = Math.sin(v.yaw);
    const lx = dx * c - dz * s, lz = dx * s + dz * c;
    return Math.abs(lx) < v.T.wid * 0.5 + 0.2 && Math.abs(lz) < v.T.len * 0.5 + 0.2;
  }

  P.findInteract = function (B) {
    const S = B.S, i = P.idx;
    const x = S.x[i], z = S.z[i];
    // downed friendlies
    for (const j of B.downed[B.playerTeam]) {
      if (j === i || S.st[j] !== ST.DOWNED) continue;
      if (U.dist2(S.x[j], S.z[j], x, z) < 2.6 * 2.6) { P.interactPrompt = { kind: 'revive', j, text: 'Hold ' + I.label('interact') + ' to revive' }; return; }
    }
    let best = null, bd = 1e9;
    for (const v of B.activeVeh) {
      const d = Math.sqrt(U.dist2(v.x, v.z, x, z)) - Math.max(v.T.len, v.T.wid) * 0.5;
      if (d > 3 || d > bd) continue;
      if (v.T.air && v.alt > 3) continue;
      const friendly = v.team === B.playerTeam, empty = v.crew.length === 0 && !v.playerIn;
      if (!(friendly || (empty && (v.team < 0 || v.state === 'abandoned')))) continue;
      if (!empty && v.passengers.length >= v.T.seats) continue;
      bd = d; best = v;
    }
    if (best) {
      const empty = best.crew.length === 0;
      P.interactPrompt = { kind: 'vehicle', v: best, text: I.label('interact') + ' — ' + (empty ? 'Drive ' : 'Board ') + best.T.name + (best.team < 0 ? ' (abandoned)' : '') };
      return;
    }
    for (const s of B.supply) if (U.dist2(s.x, s.z, x, z) < 3 * 3) { P.interactPrompt = { kind: 'supply', s, text: I.label('interact') + ' — Resupply from crate' }; return; }
  };
  P.interact = function (B) {
    const ip = P.interactPrompt;
    if (!ip) return;
    if (ip.kind === 'revive') { P.reviveTgt = ip.j; P.reviveT = 0; }
    else if (ip.kind === 'vehicle') P.enterVehicle(B, ip.v);
    else if (ip.kind === 'supply') { P.refill(); P.addXP(XP.supply, 'Resupplied'); }
  };
  P.refill = function () {
    for (const w of P.weapons) w.reserve = w.magMax * (w.d.mags - 1);
    P.grenades = P.cls.grenades; P.smokes = P.cls.smoke || 0; P.mines = P.cls.mines || 0; if (P.cls.gadget === 'medkit') P.medkits = 4;
    P.message('Ammunition replenished');
  };
  P.resupplyCheck = function (B, dt) {
    P.resupT = (P.resupT || 0) - dt;
    if (P.resupT > 0) return;
    P.resupT = 2;
    const S = B.S, x = S.x[P.idx], z = S.z[P.idx];
    const hq = B.W.objectives[B.playerTeam];
    let near = U.dist2(x, z, hq.x, hq.z) < 110 * 110;
    for (const v of B.activeVeh) if (v.team === B.playerTeam && (v.type === 'truck' || v.type === 'apc') && U.dist2(v.x, v.z, x, z) < 10 * 10) near = true;
    // AI engineers / gunners in your squad share ammo occasionally
    const w = P.weapon();
    if (near && w && w.reserve < w.magMax * (w.d.mags - 1)) { for (const q of P.weapons) q.reserve = Math.min(q.magMax * (q.d.mags - 1), q.reserve + q.magMax); if (P.grenades < P.cls.grenades) P.grenades++; }
  };

  P.spot = function (B) {
    if (P.spotCd > 0) return;
    const S = B.S, cam = IF.R.camera;
    const f = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    let best = -1, bs = P.cls.id === 'recon' ? 0.985 : 0.993;
    const ex = cam.position.x, ey = cam.position.y, ez = cam.position.z;
    B.gridT[1 - B.playerTeam].query(S, ex, ez, 700, (j) => {
      const dx = S.x[j] - ex, dy = S.y[j] + 1 - ey, dz = S.z[j] - ez, L = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const dot = (dx * f.x + dy * f.y + dz * f.z) / L;
      if (dot > bs && B.W.los(ex, ey, ez, S.x[j], S.y[j] + 1.1, S.z[j], true) > 0.05) { bs = dot; best = j; }
    });
    let vbest = null;
    for (const v of B.activeVeh) {
      if (v.team !== 1 - B.playerTeam) continue;
      const dx = v.x - ex, dy = v.y + 1.5 - ey, dz = v.z - ez, L = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if ((dx * f.x + dy * f.y + dz * f.z) / L > 0.99 && L < 900) vbest = v;
    }
    P.spotCd = 1.2;
    if (vbest) { vbest.spotT = B.time + 20; IF.emit('radio', 'YOU', 'Enemy ' + vbest.T.name.toLowerCase() + ' spotted!', 'spot', null); P.addXP(XP.spot, 'Spotted'); return; }
    if (best >= 0) {
      // spotting reveals the enemy and nearby squadmates of theirs
      const sq = B.squads[S.squad[best]];
      if (sq) for (const m of sq.members) if (S.st[m] === ST.ALIVE && U.dist2(S.x[m], S.z[m], S.x[best], S.z[best]) < 30 * 30) S.spotT[m] = B.time + 15;
      S.spotT[best] = B.time + 15;
      IF.emit('radio', 'YOU', 'Enemy spotted!', 'spot', null);
      P.addXP(XP.spot, 'Spotted');
    }
  };

  // ------------------------------------------------------------------ weapons
  P.weaponsUpdate = function (B, dt) {
    const S = B.S, W = B.W;
    // slot switching
    for (let k = 0; k < P.weapons.length; k++) if (I.hitA('weapon' + (k + 1)) && k !== P.slot) { P.slot = k; P.switchT = 0.55; P.reloadT = 0; P.binoc = false; IF.SFX.reload(1); }
    if (I.wheel) { P.slot = (P.slot + (I.wheel > 0 ? 1 : P.weapons.length - 1)) % P.weapons.length; P.switchT = 0.55; P.reloadT = 0; }
    const w = P.weapon();
    // ADS
    const wantAds = I.rmb && !P.sprint && P.switchT <= 0;
    P.ads = U.lerp(P.ads, wantAds ? 1 : 0, Math.min(1, dt * 12));
    P.switchT = Math.max(0, P.switchT - dt);
    w.fireCd = Math.max(0, w.fireCd - dt);
    P.heat = Math.max(0, P.heat - dt * 2.5);
    P.recoilP *= Math.pow(0.0005, dt); P.recoilY *= Math.pow(0.0005, dt);
    // reload
    if (P.reloadT > 0) {
      P.reloadT -= dt;
      if (P.reloadT <= 0) { const need = w.magMax - w.mag, take = Math.min(need, w.reserve); w.mag += take; w.reserve -= take; IF.SFX.reload(2); }
    } else if ((I.hitA('reload') || (w.mag === 0 && I.lmbPressed)) && w.mag < w.magMax && w.reserve > 0) { P.reloadT = w.d.reload * w.reloadMul; IF.SFX.reload(1); }
    // gadgets & throwables
    if (I.hitA('grenade')) P.throwGrenade(B, false);
    if (I.hitA('secondary')) P.useSecondaryGadget(B);
    const gadgetKey = P.cls.gadget === 'launcher' ? null : I.code('gadget');
    if (gadgetKey && I.down(gadgetKey)) P.gadget(B, dt, I.hit(gadgetKey)); else { if (P.binoc && !I.downA('gadget')) P.binoc = false; P.repairing = false; }
    if (P.binoc) { if (I.lmbPressed) P.callArtillery(B); return; }
    // firing
    if (P.switchT > 0 || P.reloadT > 0) return;
    const trigger = w.d.auto ? I.lmb : I.lmbPressed;
    if (!trigger || w.fireCd > 0) return;
    if (w.mag <= 0) { if (I.lmbPressed) IF.SFX.empty(); return; }
    P.sprint = false;
    w.fireCd = 60 / w.d.rpm;
    w.mag--;
    P.bs.shots++;
    P.fire(B, w);
  };

  const _rh = {};
  P.aimPoint = function (B) {
    // camera ray -> world point under the crosshair
    const cam = IF.R.camera;
    const f = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    const out = C.rayHit(B, cam.position.x, cam.position.y, cam.position.z, f.x, f.y, f.z, 1200, P.idx, P.veh ? P.veh.id : -1, _rh);
    return [out.x, out.y, out.z, out];
  };
  P.muzzle = function (B) {
    const S = B.S, i = P.idx;
    const eye = P.eyePos(B);
    const fx = U.dirX(P.yaw), fz = U.dirZ(P.yaw);
    return [eye[0] + fx * 0.5 + (-fz) * 0.15, eye[1] - 0.12, eye[2] + fz * 0.5 + fx * 0.15];
  };
  P.eyePos = function (B) {
    const S = B.S, i = P.idx;
    const h = P.stance === 2 ? 0.42 : P.stance === 1 ? 1.12 : 1.62;
    const lx = P.lean * 0.38 * Math.cos(P.yaw), lz = -P.lean * 0.38 * Math.sin(P.yaw);
    return [S.x[i] + lx, S.y[i] + h - Math.abs(P.lean) * 0.08, S.z[i] + lz];
  };
  P.fire = function (B, w) {
    const S = B.S, d = w.d;
    const [ax, ay, az] = P.aimPoint(B);
    const [mx, my, mz] = P.firstPerson ? P.eyePos(B) : P.muzzle(B);
    let dx = ax - mx, dy = ay - my, dz = az - mz; let L = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1; dx /= L; dy /= L; dz /= L;
    // spread
    const moving = Math.sqrt(P.vx * P.vx + P.vz * P.vz);
    let spread = U.lerp(d.hip, d.ads * w.adsMul, P.ads);
    spread *= 1 + moving * 0.35 * (P.ads > 0.5 ? 0.5 : 1);
    spread *= P.stance === 2 ? (d.cat === 'mg' ? 0.35 : 0.5) : P.stance === 1 ? 0.75 : 1;
    if (!P.onGround) spread *= 3;
    spread *= 1 + P.heat * (d.cat === 'sniper' ? 0.1 : 0.6);
    spread *= 1 + P.suppress * 0.8;
    const pellets = d.pellets || 1;
    const vfx = new THREE.Vector3();
    if (d.rocket) {
      const sp = IF.PT.rocket.speed;
      C.spawnProj(B, 'rocket', mx + dx, my + dy, mz + dz, dx * sp, dy * sp + 0.5, dz * sp, B.playerTeam, P.idx);
      IF.SFX.playerShot('rocket');
      IF.FX.smokePuff(mx - dx * 1.5, my, mz - dz * 1.5, 2.5);
      IF.FX.muzzle(mx + dx, my + dy, mz + dz, B.playerTeam, 1.5);
    } else {
      for (let p = 0; p < pellets; p++) {
        let rx = dx + U.gauss() * spread, ry = dy + U.gauss() * spread, rz = dz + U.gauss() * spread;
        const l2 = Math.sqrt(rx * rx + ry * ry + rz * rz); rx /= l2; ry /= l2; rz /= l2;
        const hit = C.rayHit(B, mx, my, mz, rx, ry, rz, d.range * 2.2, P.idx, P.veh ? P.veh.id : -1, _rh);
        P.resolveHit(B, w, hit, mx, my, mz);
        if (p === 0 && (d.cat === 'mg' || Math.random() < 0.45)) IF.FX.tracer(mx + rx * 1.2, my + ry * 1.2, mz + rz * 1.2, hit.x, hit.y, hit.z, B.playerTeam, d.cat === 'mg');
      }
      IF.SFX.playerShot(d.snd, w.quiet);
      if (!w.quiet) IF.FX.muzzle(mx + dx * 0.6, my + dy * 0.6, mz + dz * 0.6, B.playerTeam, d.cat === 'mg' ? 0.9 : 0.7);
    }
    S.lastFire[P.idx] = w.quiet ? S.lastFire[P.idx] : B.time;
    S.flash[P.idx] = w.quiet ? 0 : 0.05;
    // recoil
    const rk = d.recoil * w.recoilMul * (P.stance === 2 ? 0.55 : P.stance === 1 ? 0.8 : 1) * (P.ads > 0.5 ? 0.8 : 1);
    P.recoilP += rk * U.rr(0.8, 1.2); P.recoilY += rk * U.rr(-0.5, 0.5);
    P.pitch += rk * 0.55; P.yaw += rk * U.rr(-0.25, 0.25);
    P.heat = Math.min(2, P.heat + 0.18);
    P.kick = 1;
    P.shake = Math.min(1, P.shake + (d.cat === 'sniper' || d.rocket ? 0.25 : 0.04));
  };
  P.resolveHit = function (B, w, hit, ox, oy, oz) {
    const S = B.S, d = w.d;
    if (hit.kind === 'soldier') {
      const t = hit.idx;
      // AI nearby feel the shot
      S.sup[t] = Math.min(1.5, S.sup[t] + 0.4);
      if (S.team[t] === B.playerTeam) { P.message('Friendly — hold fire!'); return; }
      const dist = Math.sqrt((hit.x - ox) ** 2 + (hit.z - oz) ** 2);
      let dmg = d.dmg * w.dmgMul * (dist > d.range ? U.clamp(1 - (dist - d.range) / d.range, 0.35, 1) : 1);
      if (hit.part === 1) dmg *= d.cat === 'sniper' ? 3 : 2.2; else if (hit.part === 2) dmg *= 0.75;
      if (S.lastAtt) S.threatX[t] = ox, S.threatZ[t] = oz;
      C.damage(B, t, dmg, P.idx, 'bullet', hit.part === 1);
    } else if (hit.kind === 'vehicle') {
      const v = B.vehicles[hit.idx];
      if (v.team !== B.playerTeam) C.damageVehicle(B, v, d.dmg * (d.cat === 'sniper' ? 1.5 : 1), d.cat === 'mg' ? 'hmg' : 'bullet', P.idx, B.playerTeam);
      IF.FX.impact(hit.x, hit.y, hit.z, 1);
    } else if (hit.kind === 'world') {
      IF.FX.impact(hit.x, hit.y, hit.z, hit.surf === 2 ? 1 : 0);
      if (hit.surf === 3) IF.FX.splash(hit.x, hit.y, hit.z, 1.2);
    }
    // suppress enemies around the impact point
    if (hit.kind !== 'none') B.gridT[1 - B.playerTeam].query(S, hit.x, hit.z, 4, (j) => { S.sup[j] = Math.min(1.5, S.sup[j] + (d.cat === 'mg' ? 0.25 : 0.12)); S.threatX[j] = ox; S.threatZ[j] = oz; S.alertT[j] = B.time; });
  };

  P.throwGrenade = function (B, smoke) {
    const S = B.S;
    if (smoke ? P.smokes <= 0 : P.grenades <= 0) { P.message(smoke ? 'No smoke grenades' : 'No grenades left'); return; }
    if (smoke) P.smokes--; else P.grenades--;
    const cam = IF.R.camera;
    const f = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    const [ex, ey, ez] = P.eyePos(B);
    C.spawnProj(B, smoke ? 'smoke' : 'grenade', ex + f.x * 0.6, ey + 0.1, ez + f.z * 0.6, f.x * 17 + P.vx, f.y * 17 + 4, f.z * 17 + P.vz, B.playerTeam, P.idx);
    P.throwAnim = 0.5;
  };
  P.useSecondaryGadget = function (B) {
    const S = B.S;
    if (P.cls.gadget === 'repair' && P.mines > 0) {
      P.mines--; B.atMines = B.atMines || [];
      const fx = U.dirX(P.yaw), fz = U.dirZ(P.yaw);
      const x = S.x[P.idx] + fx * 1.5, z = S.z[P.idx] + fz * 1.5;
      B.atMines.push({ x, z, y: B.W.groundAt(x, z), team: B.playerTeam, owner: P.idx });
      P.message('Anti-tank mine placed (' + P.mines + ' left)');
    } else if (P.smokes > 0) P.throwGrenade(B, true);
  };
  P.gadget = function (B, dt, pressed) {
    const S = B.S, g = P.cls.gadget;
    if (g === 'medkit' && pressed) {
      if (P.medkits <= 0) { P.message('Out of medkits'); return; }
      // heal the nearest wounded friendly, else yourself
      let best = -1, bd = 6 * 6;
      B.gridT[B.playerTeam].query(S, S.x[P.idx], S.z[P.idx], 6, (j, d2) => { if (j !== P.idx && S.hp[j] < 70 && d2 < bd) { bd = d2; best = j; } });
      if (best >= 0) { S.hp[best] = Math.min(100, S.hp[best] + 50); P.medkits--; P.addXP(XP.heal, 'Heal'); }
      else if (P.hp < 100) { P.hp = Math.min(100, P.hp + 50); S.hp[P.idx] = P.hp; P.medkits--; P.message('Medkit applied'); }
    } else if (g === 'ammo' && pressed) {
      if (P.gadgetCd > 0) { P.message('Ammo box ready in ' + Math.ceil(P.gadgetCd) + 's'); return; }
      P.gadgetCd = 45; P.refill();
      let n = 0; B.gridT[B.playerTeam].query(S, S.x[P.idx], S.z[P.idx], 12, (j) => { if (j !== P.idx) { S.rockets[j] = S.role[j] === IF.ROLE.AT ? 4 : 0; S.grenades[j] = 2; n++; } });
      if (n) P.addXP(XP.supply, 'Resupplied ' + n + ' soldiers');
    } else if (g === 'repair') {
      let best = null;
      for (const v of B.activeVeh) if (v.team === B.playerTeam || v.team < 0) { if (Math.sqrt(U.dist2(v.x, v.z, S.x[P.idx], S.z[P.idx])) < Math.max(v.T.len, v.T.wid) * 0.5 + 2.5 && v.hp < v.T.hp) best = v; }
      P.repairing = !!best;
      if (best) { best.hp = Math.min(best.T.hp, best.hp + best.T.hp * 0.08 * dt); P.repairXP = (P.repairXP || 0) + dt; if (P.repairXP > 3) { P.repairXP = 0; P.addXP(XP.repair, 'Repair'); } if (best.hp > best.T.hp * 0.3) best.burning = false; }
    } else if (g === 'arty') {
      P.binoc = true;
    }
  };
  P.callArtillery = function (B) {
    if (P.artyCd > 0) { P.message('Artillery available in ' + Math.ceil(P.artyCd) + 's'); return; }
    const [x, y, z] = P.aimPoint(B);
    const S = B.S;
    const d = Math.sqrt(U.dist2(x, z, S.x[P.idx], S.z[P.idx]));
    if (d > 900) { P.message('Target out of range'); return; }
    // warn about friendlies
    const [f] = IF.AI.strengthNear(B, B.playerTeam, x, z, 35);
    P.artyCd = 150;
    B.cmd[B.playerTeam].barrage(x, z, 7, 22);
    P.message(f > 0 ? 'Fire mission called — friendlies in the area!' : 'Fire mission called — splash in ~12 seconds');
    B.artyMarker = { x, z, until: B.time + 25 };
  };

  // ------------------------------------------------------------------ vehicles
  P.enterVehicle = function (B, v) {
    const S = B.S;
    const empty = v.crew.length === 0;
    if (empty) {
      v.playerIn = true; v.team = B.playerTeam; v.state = 'active'; v.task = 'player'; P.seat = 'driver';
      v.turretYaw = v.yaw;
      if (v.reservedBy >= 0) v.reservedBy = -1;
    } else {
      if (v.passengers.length >= v.T.seats) return;
      v.passengers.push(P.idx); P.seat = 'passenger';
    }
    P.veh = v; B.playerInVehicle = true; B.playerVeh = v;
    S.st[P.idx] = ST.MOUNTED; S.veh[P.idx] = v.id;
    P.yaw = v.yaw; P.pitch = -0.1; P.ads = 0;
    P.vehWeapon = 0;
    P.message((P.seat === 'driver' ? 'Driving ' : 'Riding in ') + v.T.name + ' — ' + I.label('interact') + ' to exit' + (v.T.air ? ', ' + I.label('jump') + '/' + I.label('descend') + ' altitude' : ''));
  };
  P.exitVehicle = function (force) {
    const B = P.B, S = B.S, v = P.veh;
    if (!v) return;
    if (!force && v.T.air && v.alt > 6) { P.message('Too high to bail out — land first'); return; }
    if (!force && Math.abs(v.spd) > 6 && !v.T.air) { P.message('Slow down to exit'); return; }
    if (P.seat === 'driver') {
      v.playerIn = false; v.task = 'empty';
      v.spd = Math.min(v.spd, 3);
      // passengers (your squad) dismount with you
      const sqs = new Set(v.passengers.map((i) => S.squad[i]));
      for (const id of sqs) { const sq = B.squads[id]; if (sq && sq.veh === v.id) { IF.Vehicles.unload(B, v, sq); sq.veh = -1; sq.state = 'move'; sq.routeKey = ''; } }
    } else { const k = v.passengers.indexOf(P.idx); if (k >= 0) v.passengers.splice(k, 1); }
    const a = v.yaw + Math.PI / 2;
    const [px, pz] = B.W.freeSpot(v.x + Math.sin(a) * -(v.T.wid * 0.5 + 1.4), v.z + Math.cos(a) * -(v.T.wid * 0.5 + 1.4));
    S.x[P.idx] = px; S.z[P.idx] = pz; S.y[P.idx] = B.W.groundAt(px, pz); S.veh[P.idx] = -1;
    if (!force) S.st[P.idx] = ST.ALIVE;
    P.veh = null; P.seat = null; B.playerInVehicle = false; B.playerVeh = null;
    P.vy = 0;
  };
  P.vehicleUpdate = function (B, dt) {
    const v = P.veh, S = B.S;
    if (v.state !== 'active' && v.state !== 'abandoned') { P.exitVehicle(true); return; }
    P.look(dt, 0.9);
    if (I.hitA('interact')) { P.exitVehicle(false); return; }
    S.x[P.idx] = v.x; S.y[P.idx] = v.y + 1; S.z[P.idx] = v.z;
    P.hp = 100; S.hp[P.idx] = 100;
    if (P.seat === 'driver') {
      const th = (I.downA('forward') ? 1 : 0) - (I.downA('back') ? 1 : 0);
      const st = (I.downA('left') ? 1 : 0) - (I.downA('right') ? 1 : 0);
      if (v.T.air) {
        const up = (I.downA('jump') ? 1 : 0) - (I.downA('descend') ? 1 : 0);
        const strafe = (I.downA('leanR') ? 1 : 0) - (I.downA('leanL') ? 1 : 0);
        IF.Vehicles.fly(B, v, th, strafe, st, up + 0.02, dt);
      } else {
        const brake = I.downA('jump');
        IF.Vehicles.drive(B, v, brake ? 0 : th, st, dt);
        if (brake) v.spd *= Math.pow(0.1, dt);
      }
      P.bs.distanceDriven += Math.abs(v.spd) * dt;
      // turret follows the camera
      v.turretYaw = U.turnTo(v.turretYaw, P.yaw, dt * (v.type === 'mbt' ? 1.2 : 2.5));
      v.gunPitch = P.pitch;
      P.vehWeapons(B, v, dt);
      for (const i of v.passengers) { S.x[i] = v.x; S.y[i] = v.y + 1; S.z[i] = v.z; }
    }
    P.cameraVehicle(B, v, dt);
  };
  P.vehWeapons = function (B, v, dt) {
    const T = v.T;
    if (I.hitA('weapon1')) P.vehWeapon = 0;
    if (I.hitA('weapon2') && (T.mg || T.gun === 'heligun')) P.vehWeapon = 1;
    if (!T.gun || T.gun === 'howitzer' && false) return;
    const aligned = Math.abs(U.angDiff(v.turretYaw, P.yaw)) < 0.06 || T.air;
    if (T.gun === 'howitzer') {
      if (I.lmbPressed && v.fireCd <= 0) {
        const [ax, ay, az] = P.aimPoint(B);
        const dd = U.dist(v.x, v.z, ax, az);
        const Tt = 4 + dd / 160;
        const mx = v.x + U.dirX(v.turretYaw) * 6, my = v.y + 3.5, mz = v.z + U.dirZ(v.turretYaw) * 6;
        const [vx, vy, vz] = C.ballistic(mx, my, mz, ax, ay, az, Tt, 9.8);
        C.spawnProj(B, 'arty', mx, my, mz, vx, vy, vz, B.playerTeam, P.idx, v.id);
        v.fireCd = T.gunCd; v.recoil = 1; IF.SFX.cannon(mx, my, mz, true); IF.FX.muzzle(mx, my, mz, B.playerTeam, 4); P.shake += 0.5;
      }
      return;
    }
    if (!I.lmb || !aligned) return;
    const [ax, ay, az] = P.aimPoint(B);
    const mx = v.x + U.dirX(v.turretYaw) * T.len * 0.55, my = v.y + T.hgt + 0.2 - (T.air ? 1.8 : 0), mz = v.z + U.dirZ(v.turretYaw) * T.len * 0.55;
    let dx = ax - mx, dy = ay - my, dz = az - mz; const L = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1; dx /= L; dy /= L; dz /= L;
    const useMG = P.vehWeapon === 1;
    if (T.gun === 'cannon' && !useMG) {
      if (v.fireCd > 0 || !I.lmbPressed) return;
      const sp = IF.PT.shell.speed;
      C.spawnProj(B, 'shell', mx, my, mz, dx * sp, dy * sp + 0.5 * IF.PT.shell.grav * L / sp, dz * sp, B.playerTeam, P.idx, v.id);
      v.fireCd = T.gunCd * 0.8; v.recoil = 1; v.flash = 0.08;
      IF.SFX.cannon(mx, my, mz); IF.FX.muzzle(mx, my, mz, B.playerTeam, 3); IF.FX.dust(v.x, v.y + 0.5, v.z, 6); P.shake += 0.6;
    } else if ((T.gun === 'autocannon' || T.gun === 'heligun') && !useMG) {
      if (v.fireCd > 0) return;
      const sp = IF.PT.ac.speed;
      C.spawnProj(B, 'ac', mx, my, mz, dx * sp + U.gauss() * 6, dy * sp + U.gauss() * 6, dz * sp + U.gauss() * 6, B.playerTeam, P.idx, v.id);
      v.fireCd = T.gunCd * 0.9; IF.SFX.shot(mx, my, mz, 'autocannon', B.playerTeam); IF.FX.muzzle(mx, my, mz, B.playerTeam, 1.2); P.shake += 0.08;
    } else if (T.gun === 'heligun' && useMG) {
      if (v.fireCd > 0 || v.rockets <= 0 || !I.lmbPressed) return;
      const sp = IF.PT.hrocket.speed;
      C.spawnProj(B, 'hrocket', mx, my - 0.5, mz, dx * sp, dy * sp, dz * sp, B.playerTeam, P.idx, v.id);
      v.rockets--; v.fireCd = 0.4; IF.SFX.shot(mx, my, mz, 'rocket', B.playerTeam);
      if (v.rockets <= 0) P.message('Rockets depleted — return to a helipad');
    } else {
      // machine guns: hitscan
      if (v.mgCd > 0) return;
      v.mgCd = 0.1;
      const sp = 0.012;
      const hit = C.rayHit(B, mx, my, mz, dx + U.gauss() * sp, dy + U.gauss() * sp, dz + U.gauss() * sp, 600, P.idx, v.id, _rh);
      P.resolveHit(B, { d: { dmg: 42, range: 450, cat: 'mg' }, dmgMul: 1 }, hit, mx, my, mz);
      IF.FX.tracer(mx, my, mz, hit.x, hit.y, hit.z, B.playerTeam, true);
      IF.SFX.shot(mx, my, mz, 'hmg', B.playerTeam); IF.FX.muzzle(mx, my, mz, B.playerTeam, 0.9);
    }
  };

  // ------------------------------------------------------------------ squad commands
  P.COMMANDS = [['follow', 'Follow me'], ['hold', 'Hold position'], ['advance', 'Advance'], ['defend', 'Defend objective'], ['regroup', 'Regroup'], ['vehicles', 'Enter vehicles'], ['retreat', 'Retreat']];
  P.handleCommands = function (B) {
    for (let k = 0; k < P.COMMANDS.length; k++) if (I.hit('Digit' + (k + 1))) { P.issue(B, P.COMMANDS[k][0]); P.cmdMenu = false; }
    if (I.hit('Escape')) P.cmdMenu = false;
  };
  P.issue = function (B, cmd) {
    const S = B.S, W = B.W;
    const px = P.veh ? P.veh.x : S.x[P.idx], pz = P.veh ? P.veh.z : S.z[P.idx];
    const rank = IF.rankIndex(IF.Profile.xp + P.bs.xp);
    const radius = 70 + rank * 6;
    const squads = B.squads.filter((sq) => sq.team === B.playerTeam && sq.type === 'inf' && sq.alive > 0 && (sq.playerSquad || (sq.leader >= 0 && U.dist2(S.x[sq.leader], S.z[sq.leader], px, pz) < radius * radius)));
    if (!squads.length) { P.message('No friendly squads within ' + radius + 'm'); return; }
    // objective helpers
    const hq = W.objectives[B.playerTeam];
    const nearestObj = (filter) => { let best = null, bd = 1e9; for (const o of W.objectives) { if (!filter(o)) continue; const d = U.dist(px, pz, o.x, o.z); if (d < bd) { bd = d; best = o; } } return best; };
    const fwd = nearestObj((o) => o.owner !== B.playerTeam && !(o.hq >= 0 && o.hq !== B.playerTeam && W.objectives.filter((q) => q.owner === B.playerTeam && q.hq < 0).length < 5));
    const own = nearestObj((o) => o.owner === B.playerTeam);
    const back = nearestObj((o) => o.owner === B.playerTeam && U.dist(o.x, o.z, hq.x, hq.z) < U.dist(px, pz, hq.x, hq.z) - 40) || hq;
    const until = B.time + 150;
    let names = [];
    for (const sq of squads) {
      names.push(sq.callsign);
      if (cmd === 'follow') sq.override = { cmd, until };
      else if (cmd === 'hold') sq.override = { cmd, until, x: px, z: pz };
      else if (cmd === 'advance' && fwd) { sq.override = { cmd, until, obj: fwd.id }; if (sq.state === 'mounted' && P.veh && sq.veh === P.veh.id) { IF.Vehicles.unload(B, P.veh, sq); sq.veh = -1; } sq.state = 'move'; sq.routeKey = ''; }
      else if (cmd === 'defend' && own) { sq.override = { cmd, until, obj: own.id }; if (sq.state !== 'mounted') { sq.state = 'move'; sq.routeKey = ''; } }
      else if (cmd === 'regroup') { sq.override = null; if (sq.state !== 'mounted') { sq.state = 'regroup'; sq.stateT = 12; } }
      else if (cmd === 'retreat') { sq.override = { cmd, until: B.time + 60, obj: back.id }; sq.state = 'retreat'; sq.fallback = back; sq.routeKey = ''; }
      else if (cmd === 'vehicles') {
        let best = null, bd = 160;
        for (const v of B.activeVeh) {
          if (v.T.seats < 2 || (v.team !== B.playerTeam && !(v.team < 0 && v.crew.length === 0))) continue;
          if (v.passengers.length + 2 > v.T.seats || v.reservedBy >= 0 && v.reservedBy !== sq.id) continue;
          const d = Math.sqrt(U.dist2(v.x, v.z, S.x[sq.leader], S.z[sq.leader]));
          if (P.veh === v) { best = v; break; }
          if (d < bd) { bd = d; best = v; }
        }
        if (best) { sq.veh = best.id; best.reservedBy = sq.id; sq.state = 'mount'; sq.mountT = 0; sq.dest = IF.AI.squadDest(B, sq); }
      }
    }
    P.bs.commands++;
    P.addXP(XP.command, 'Command');
    const reply = { follow: 'Copy, on you!', hold: 'Holding this position.', advance: 'Moving up to ' + (fwd ? fwd.letter + ' — ' + fwd.name : 'the front') + '!', defend: 'Defending ' + (own ? own.name : 'here') + '.', regroup: 'Regrouping!', vehicles: 'Mounting up!', retreat: 'Falling back!' }[cmd];
    IF.emit('radio', names.slice(0, 3).join(', ') + (names.length > 3 ? ' +' + (names.length - 3) : ''), reply, 'cmd', null);
    IF.SFX.radio(reply, true);
  };

  // ------------------------------------------------------------------ cameras
  const _v = new THREE.Vector3(), _t = new THREE.Vector3();
  P.applyShake = function (cam, dt) {
    const s = P.shake * P.shake;
    if (s > 0.0005) { cam.rotation.x += U.gauss() * 0.02 * s; cam.rotation.y += U.gauss() * 0.02 * s; cam.position.x += U.gauss() * 0.06 * s; cam.position.y += U.gauss() * 0.06 * s; }
  };
  P.setFov = function (target, dt) {
    const cam = IF.R.camera;
    cam.fov = U.lerp(cam.fov, target, Math.min(1, dt * 12));
    cam.updateProjectionMatrix();
  };
  P.cameraInfantry = function (B, dt) {
    const cam = IF.R.camera, S = B.S, W = B.W;
    const base = IF.Profile.settings.fov || 75;
    const w = P.weapon();
    const zoom = P.binoc ? 6 : P.ads > 0.5 ? w.zoom : 1;
    P.setFov(base / U.lerp(1, zoom, P.ads > 0.5 || P.binoc ? 1 : 0) + (P.sprint ? 6 : 0), dt);
    const [ex, ey, ez] = P.eyePos(B);
    const pitch = P.pitch + P.recoilP * 0.3;
    cam.rotation.set(pitch, P.yaw + P.recoilY * 0.2, -P.lean * 0.12, 'YXZ');
    const fp = P.firstPerson || P.binoc || (P.ads > 0.6 && w.scope);
    P.viewFP = fp;
    if (fp) { cam.position.set(ex, ey, ez); }
    else {
      const dist = U.lerp(3.3, 1.5, P.ads) + (P.stance === 2 ? -0.6 : 0);
      const side = U.lerp(0.75, 0.55, P.ads);
      const fx = U.dirX(P.yaw), fz = U.dirZ(P.yaw);
      _v.set(0, 0, 1).applyEuler(cam.rotation);
      const sx = Math.cos(P.yaw) * side, sz = -Math.sin(P.yaw) * side;
      const hx = ex + sx, hy = ey + 0.25, hz = ez + sz;
      // pull the camera in if something is in the way
      let d = dist;
      for (let t = 0.4; t <= dist; t += 0.3) {
        const x = hx + _v.x * t, y = hy + _v.y * t, z = hz + _v.z * t;
        if (y < W.groundAt(x, z) + 0.25 || (W.occAt(x, z) > 0 && y < W.terrainAt(x, z) + W.obstacleH(x, z))) { d = Math.max(0.3, t - 0.3); break; }
      }
      cam.position.set(hx + _v.x * d, hy + _v.y * d, hz + _v.z * d);
      void fx; void fz;
    }
    P.applyShake(cam, dt);
  };
  P.cameraVehicle = function (B, v, dt) {
    const cam = IF.R.camera, W = B.W;
    const base = IF.Profile.settings.fov || 75;
    const zoom = I.rmb && P.seat === 'driver' ? 2.5 : 1;
    P.setFov(base / zoom, dt);
    cam.rotation.set(P.pitch, P.yaw, 0, 'YXZ');
    P.viewFP = P.firstPerson;
    if (P.firstPerson) {
      const h = v.T.air ? 1.8 : v.T.hgt + 0.6;
      cam.position.set(v.x + U.dirX(v.yaw) * (v.T.air ? v.T.len * 0.3 : 0), v.y + h, v.z + U.dirZ(v.yaw) * (v.T.air ? v.T.len * 0.3 : 0));
    } else {
      const dist = Math.max(v.T.len, 6) * 1.25 + 3;
      _v.set(0, 0, 1).applyEuler(cam.rotation);
      const hx = v.x, hy = v.y + v.T.hgt + 1.6, hz = v.z;
      let x = hx + _v.x * dist, y = hy + _v.y * dist, z = hz + _v.z * dist;
      y = Math.max(y, W.groundAt(x, z) + 0.8);
      cam.position.set(x, y, z);
    }
    P.applyShake(cam, dt);
  };
  P.cameraFollowSoldier = function (B, dt) {
    const cam = IF.R.camera, S = B.S, i = P.idx;
    cam.rotation.set(-0.5 + P.pitch * 0.3, P.yaw, 0, 'YXZ');
    _v.set(0, 0, 1).applyEuler(cam.rotation);
    cam.position.set(S.x[i] + _v.x * 3.2, S.y[i] + 0.6 + _v.y * 3.2 + 1.2, S.z[i] + _v.z * 3.2);
    P.viewFP = false;
  };
  P.deathCam = function (B, dt) {
    const cam = IF.R.camera, S = B.S;
    const p = P.deathPos || [B.W.objectives[B.playerTeam].x, 30, B.W.objectives[B.playerTeam].z];
    P.orbit = (P.orbit || 0) + dt * 0.12;
    const k = P.killer;
    let tx = p[0], ty = p[1] + 1, tz = p[2];
    if (P.state === 'dead' && k >= 0 && k < S.n && S.st[k] === ST.ALIVE && B.time - P.deathT < 4) { tx = S.x[k]; ty = S.y[k] + 1.2; tz = S.z[k]; }
    const r = P.state === 'deploy' ? 160 : 14 + Math.min(30, (B.time - P.deathT) * 6);
    const h = P.state === 'deploy' ? 90 : 8 + Math.min(25, (B.time - P.deathT) * 4);
    _t.set(tx, ty, tz);
    cam.position.lerp(_v.set(p[0] + Math.cos(P.orbit) * r, p[1] + h, p[2] + Math.sin(P.orbit) * r), Math.min(1, dt * 2));
    cam.lookAt(_t);
    P.setFov(IF.Profile.settings.fov || 75, dt);
    P.viewFP = false;
  };
})(typeof window !== 'undefined' ? window : globalThis);
