// Vehicles: tanks, IFVs, APCs, trucks, recon cars, self-propelled artillery, attack and
// transport helicopters (AI or player driven), plus jets and recon drones overhead.
(function (G) {
  'use strict';
  const IF = G.IF, U = IF.U, ST = IF.ST, C = IF.Combat;
  const V = (IF.Vehicles = {});
  const tmpOut = new Int32Array(6), tmpD = new Float32Array(6);

  V.create = function (B, type, team, x, z, yaw) {
    const T = IF.VEH[type];
    const v = {
      id: B.vehicles.length, type, T, team, x, z, y: B.W.groundAt(x, z), yaw: yaw || 0, pitch: 0, roll: 0, spd: 0, vx: 0, vz: 0, vy: 0,
      hp: T.hp, state: 'active', crew: [], passengers: [], crewSquad: -1, reservedBy: -1, playerIn: false, playerSeat: -1,
      turretYaw: yaw || 0, gunPitch: 0, fireCd: U.rr(0, 3), mgCd: 0, burst: 0, tgt: -1, tgtV: -1, thinkT: Math.random(),
      order: null, task: 'idle', route: [], routeI: 0, routeKey: '', dest: null, arrived: false, stuckT: 0, revT: 0,
      burning: false, wreckT: 0, hitT: -100, spotT: 0, lastAtt: -1, lastAttTeam: -1, recoil: 0, flash: 0,
      alt: 0, rotor: 0, home: [x, z], orbitA: Math.random() * 6.28, crashT: 0, landed: !T.air, ctl: { th: 0, st: 0, up: 0, fire: false },
      helipad: null, distDriven: 0, lastFireT: -100, rockets: 8, abandonedT: 0, repairT: 0,
    };
    if (T.air) { v.y = B.W.groundAt(x, z); v.alt = 0; }
    B.vehicles.push(v);
    return v;
  };

  V.board = function (B, v, i) {
    const S = B.S;
    if (v.passengers.length >= v.T.seats && v.crew.length > 0) return false;
    if (v.crew.length === 0 && !v.playerIn) { v.crew.push(i); v.team = S.team[i]; v.state = 'active'; }
    else if (v.passengers.length < v.T.seats) v.passengers.push(i);
    else return false;
    S.st[i] = ST.MOUNTED; S.veh[i] = v.id; S.tgt[i] = -1;
    if (S.cover[i] >= 0) { B.W.coverOwner[S.cover[i]] = -1; S.cover[i] = -1; }
    return true;
  };
  V.unload = function (B, v, sq) {
    const S = B.S;
    const out = [];
    for (const i of v.passengers) if ((!sq || S.squad[i] === sq.id) && i !== B.playerIdx) out.push(i);
    for (const i of v.crew) if (sq && S.squad[i] === sq.id && B.squads[S.squad[i]].type !== 'crew') out.push(i);
    let k = 0;
    const back = v.T.air ? 0 : 1;
    for (const i of out) {
      const a = v.yaw + Math.PI * back + (k - out.length / 2) * 0.35 + (v.T.air ? k * 0.6 : 0);
      const r = v.T.len * 0.5 + 1.5 + (k % 3);
      const [px, pz] = B.W.freeSpot(v.x - Math.sin(a) * r, v.z - Math.cos(a) * r);
      S.st[i] = ST.ALIVE; S.veh[i] = -1; S.x[i] = px; S.z[i] = pz; S.y[i] = B.W.groundAt(px, pz);
      S.gx[i] = px; S.gz[i] = pz; S.yaw[i] = v.yaw;
      k++;
    }
    v.passengers = v.passengers.filter((i) => !out.includes(i));
    v.crew = v.crew.filter((i) => !out.includes(i));
    if (v.reservedBy === (sq && sq.id)) v.reservedBy = -1;
    if (v.crew.length === 0 && !v.playerIn) { v.task = 'empty'; v.spd = 0; }
    else if (v.task === 'transport') { v.task = v.T.gun && !v.T.air ? 'support' : 'return'; v.routeKey = ''; v.arrived = false; }
  };
  V.findTransport = function (B, sq, x, z, dest) {
    let best = null, bd = 1e9;
    const need = Math.max(1, sq.alive);
    for (const v of B.activeVeh) {
      if (v.T.seats < Math.min(need, 6) || v.reservedBy >= 0 || v.playerIn) continue;
      const own = v.team === sq.team && v.state === 'active';
      const empty = v.crew.length === 0 && (v.team === sq.team || v.team < 0) && !v.T.air;
      if (!own && !empty) continue;
      if (own && !(v.task === 'idle' || v.task === 'return') && !empty) continue;
      if (v.passengers.length) continue;
      if (v.hp < v.T.hp * 0.35) continue;
      const d = U.dist(x, z, v.x, v.z);
      const lim = empty ? 90 : 220;
      if (d > lim) continue;
      if (U.dist(v.x, v.z, dest.x, dest.z) < 400) continue;
      if (d < bd) { bd = d; best = v; }
    }
    return best;
  };
  V.depart = function (B, v, sq) {
    const W = B.W;
    const dest = sq.dest || AIdest(B, sq);
    const hq = W.objectives[sq.team];
    let dx = hq.x - dest.x, dz = hq.z - dest.z; const L = Math.sqrt(dx * dx + dz * dz) || 1;
    const back = (dest.r || 50) + (v.T.air ? 150 : 95);
    let px = dest.x + dx / L * back + U.rr(-30, 30), pz = dest.z + dz / L * back + U.rr(-30, 30);
    if (dest.obj && dest.obj.owner === sq.team) { px = dest.x + U.rr(-20, 20); pz = dest.z + U.rr(-20, 20); }
    if (v.T.air) { const fs = W.freeSpot(px, pz); px = fs[0]; pz = fs[1]; }
    v.task = 'transport'; v.dest = { x: px, z: pz }; v.routeKey = ''; v.arrived = false; v.reservedBy = sq.id;
  };
  function AIdest(B, sq) { return IF.AI.squadDest(B, sq); }

  V.abandon = function (B, v) {
    // crew bails out
    const S = B.S;
    const all = v.crew.concat(v.passengers).filter((i) => i !== B.playerIdx);
    for (const i of all) {
      const a = Math.random() * 6.28;
      const [px, pz] = B.W.freeSpot(v.x + Math.cos(a) * (v.T.len * 0.5 + 2), v.z + Math.sin(a) * (v.T.len * 0.5 + 2));
      S.st[i] = ST.ALIVE; S.veh[i] = -1; S.x[i] = px; S.z[i] = pz; S.y[i] = B.W.groundAt(px, pz); S.gx[i] = px; S.gz[i] = pz; S.sup[i] = 1;
      const sq = B.squads[S.squad[i]]; if (sq && sq.state === 'mounted') { sq.state = 'move'; sq.veh = -1; sq.routeKey = ''; }
    }
    v.crew = []; v.passengers = v.passengers.filter((i) => i === B.playerIdx); v.task = 'empty'; v.team = -1; v.state = 'abandoned'; v.abandonedT = B.time; v.spd = 0;
    IF.emit('vehicleAbandoned', v);
  };

  V.destroy = function (B, v, att, attTeam) {
    if (v.state === 'wreck' || v.state === 'gone' || v.state === 'crashing') return;
    const S = B.S;
    // occupants: some bail out (the player is handled by the player module)
    const all = v.crew.concat(v.passengers).filter((i) => i !== B.playerIdx);
    if (v.passengers.includes(B.playerIdx)) IF.emit('playerVehicleDestroyed', v);
    for (const i of all) {
      if (!v.T.air && Math.random() < 0.4) {
        const a = Math.random() * 6.28;
        const [px, pz] = B.W.freeSpot(v.x + Math.cos(a) * (v.T.len * 0.5 + 2.5), v.z + Math.sin(a) * (v.T.len * 0.5 + 2.5));
        S.st[i] = ST.ALIVE; S.veh[i] = -1; S.x[i] = px; S.z[i] = pz; S.y[i] = B.W.groundAt(px, pz); S.gx[i] = px; S.gz[i] = pz; S.hp[i] = U.rr(20, 60); S.sup[i] = 1.4;
        const sq = B.squads[S.squad[i]]; if (sq && (sq.state === 'mounted' || sq.state === 'mount')) { sq.state = 'move'; sq.veh = -1; sq.routeKey = ''; }
      } else { S.st[i] = ST.ALIVE; S.veh[i] = -1; C.kill(B, i, att, 'explosion'); }
    }
    for (const i of all) { const sq = B.squads[S.squad[i]]; if (sq && sq.veh === v.id && sq.type !== 'crew') { sq.veh = -1; if (sq.state === 'mounted' || sq.state === 'mount') sq.state = 'move'; } }
    const keepPlayer = v.passengers.includes(B.playerIdx);
    v.crew = []; v.passengers = keepPlayer ? [B.playerIdx] : [];
    const wasTeam = v.team;
    if (v.playerIn) IF.emit('playerVehicleDestroyed', v);
    if (v.T.air && v.alt > 3) { v.state = 'crashing'; v.crashT = 0; v.hp = 0; IF.FX.explosion(v.x, v.y + 2, v.z, 6, 'air'); IF.SFX.explosion(v.x, v.y, v.z, 'air', 8); }
    else V.wreck(B, v);
    B.vehLost[wasTeam >= 0 ? wasTeam : 0]++;
    if (wasTeam >= 0) B.tickets[wasTeam] = Math.max(0, B.tickets[wasTeam] - Math.ceil(v.T.cost / 2));
    IF.emit('vehicleDestroyed', v, att, attTeam, wasTeam);
    // schedule replacement for the original owner
    if (v.origTeam >= 0) B.vehQueue.push({ type: v.type, team: v.origTeam, t: B.time + v.T.respawn * U.rr(0.85, 1.2), crewSquad: v.crewSquad });
    v.origTeam = -1;
  };
  V.wreck = function (B, v) {
    v.state = 'wreck'; v.hp = 0; v.spd = 0; v.burning = true; v.wreckT = B.time; v.team = -1;
    C.explode(B, v.x, v.y + 1.5, v.z, v.T.air ? 9 : 7, 120, -1, v.lastAtt, 'he');
    IF.FX.explosion(v.x, v.y + 1.5, v.z, 10, 'vehicle');
    if (!v.T.air) B.W.stampRect(v.x, v.z, v.T.wid, v.T.len, v.yaw, 2.0);
    else { v.alt = 0; v.y = B.W.groundAt(v.x, v.z); B.W.stampRect(v.x, v.z, 3, 10, v.yaw, 2.2); }
  };

  // ------------------------------------------------------------------
  // physics
  // ------------------------------------------------------------------
  V.drive = function (B, v, th, steer, dt) {
    const W = B.W, T = v.T;
    if (v.hp < T.hp * 0.12) { th *= 0.15; steer *= 0.3; } // tracks/wheels shot out: barely mobile
    const fwdMax = T.speed, revMax = T.speed * 0.35;
    const slope = (W.terrainAt(v.x + U.dirX(v.yaw) * 4, v.z + U.dirZ(v.yaw) * 4) - W.terrainAt(v.x, v.z)) / 4;
    const slopeK = U.clamp(1 - Math.max(0, slope) * 1.8, 0.35, 1.15);
    const target = th >= 0 ? th * fwdMax * slopeK : th * revMax;
    const acc = T.accel * (Math.sign(target - v.spd) !== Math.sign(v.spd) && Math.abs(v.spd) > 0.5 ? 2.2 : 1);
    if (v.spd < target) v.spd = Math.min(target, v.spd + acc * dt); else v.spd = Math.max(target, v.spd - acc * 1.4 * dt);
    const tracked = v.type === 'mbt' || v.type === 'arty' || v.type === 'ifv';
    const turnK = tracked ? 1 : U.clamp(Math.abs(v.spd) / 5, 0, 1) * Math.sign(v.spd || 1);
    v.yaw = U.wrapAng(v.yaw + steer * T.turn * dt * turnK * (Math.abs(v.spd) > T.speed * 0.6 ? 0.75 : 1));
    const fx = U.dirX(v.yaw), fz = U.dirZ(v.yaw);
    const nx = v.x + fx * v.spd * dt, nz = v.z + fz * v.spd * dt;
    // collision: sample front (or rear when reversing) corners
    const sgn = v.spd >= 0 ? 1 : -1;
    const hl = T.len * 0.5, hw = T.wid * 0.45;
    const rx = -fz, rz = fx; // right vector
    let blocked = false;
    for (const s of [-1, 0, 1]) {
      const px = nx + fx * hl * sgn + rx * hw * s, pz = nz + fz * hl * sgn + rz * hw * s;
      const o = W.occAt(px, pz);
      if (o > (tracked ? 14 : 9) || Math.abs(px) > 985 || Math.abs(pz) > 985) { blocked = true; break; }
      const wd = W.waterDepth(px, pz);
      if (wd > (tracked ? 1.4 : 0.9)) { blocked = true; break; }
    }
    for (const w of B.wreckList) {
      if (U.dist2(w.x, w.z, nx + fx * hl * sgn, nz + fz * hl * sgn) < (w.T.len * 0.45) ** 2) { if (!tracked || w.T.armor > 0) { blocked = true; break; } }
    }
    if (blocked) { v.spd *= -0.15; v.stuckT += dt; }
    else {
      const moved = Math.abs(v.spd * dt);
      v.distDriven += moved;
      v.x = nx; v.z = nz;
      if (Math.abs(v.spd) > 0.5) v.stuckT = Math.max(0, v.stuckT - dt * 0.5);
      else if (Math.abs(th) > 0.3) v.stuckT += dt;
    }
    // soft separation from other ground vehicles (slide past instead of deadlocking)
    for (const o of B.activeVeh) {
      if (o === v || o.T.air) continue;
      const dx = v.x - o.x, dz = v.z - o.z, d2 = dx * dx + dz * dz;
      const rr = (o.T.len + T.len) * 0.3 + 0.5;
      if (d2 < rr * rr && d2 > 1e-4) {
        const d = Math.sqrt(d2), push = (rr - d) * 0.5;
        const px = v.x + dx / d * push, pz = v.z + dz / d * push;
        if (W.occAt(px, pz) <= 9) { v.x = px; v.z = pz; }
        if (o.playerIn || o.state === 'abandoned' || o.crew.length === 0) { /* parked vehicles don't get shoved */ }
        else { const qx = o.x - dx / d * push * 0.5, qz = o.z - dz / d * push * 0.5; if (W.occAt(qx, qz) <= 9) { o.x = qx; o.z = qz; } }
        // ahead of us? slow down
        if ((-dx * fx - dz * fz) > 0 && Math.abs(v.spd) > 3) v.spd *= 0.96;
      }
    }
    v.vx = fx * v.spd; v.vz = fz * v.spd;
    // ground alignment
    const yF = W.groundAt(v.x + fx * hl * 0.8, v.z + fz * hl * 0.8), yB = W.groundAt(v.x - fx * hl * 0.8, v.z - fz * hl * 0.8);
    const yR = W.groundAt(v.x + rx * hw, v.z + rz * hw), yL = W.groundAt(v.x - rx * hw, v.z - rz * hw);
    const ty = Math.max((yF + yB + yR + yL) / 4, W.groundAt(v.x, v.z) - 0.2);
    v.y = U.lerp(v.y, ty, Math.min(1, dt * 10));
    v.pitch = U.lerp(v.pitch, Math.atan2(yF - yB, hl * 1.6), Math.min(1, dt * 6));
    v.roll = U.lerp(v.roll, Math.atan2(yR - yL, hw * 2), Math.min(1, dt * 6));
    // crush infantry
    v.crushT = (v.crushT || 0) - dt;
    if (Math.abs(v.spd) > 3 && v.crushT <= 0) {
      v.crushT = 0.2;
      const px = v.x + fx * hl * 0.6 * sgn, pz = v.z + fz * hl * 0.6 * sgn;
      B.gridF.query(B.S, px, pz, T.wid * 0.55, (j) => {
        if (B.S.st[j] !== ST.ALIVE && B.S.st[j] !== ST.DOWNED) return;
        if (B.S.team[j] === v.team || j === B.playerIdx && !v.playerIn && B.S.team[j] === v.team) return;
        // AI soldiers usually dodge; the player driving runs people down
        if (v.playerIn || j === B.playerIdx || Math.random() < 0.12) C.damage(B, j, Math.abs(v.spd) * 18, v.playerIn ? B.playerIdx : (v.crew[0] ?? -1), 'crush');
        else { B.S.sepX[j] += -fz * 3 * (Math.random() < 0.5 ? 1 : -1); B.S.sepZ[j] += fx * 3; }
      });
    }
  };

  V.fly = function (B, v, fwd, strafe, yawIn, up, dt) {
    // arcade helicopter: fwd/strafe -1..1 accelerate in heading frame, yawIn turns, up climbs
    const W = B.W, T = v.T;
    const fx = U.dirX(v.yaw), fz = U.dirZ(v.yaw), rx = -fz, rz = fx;
    const ax = (fx * fwd + rx * strafe * 0.6) * T.accel, az = (fz * fwd + rz * strafe * 0.6) * T.accel;
    v.vx += ax * dt; v.vz += az * dt;
    const drag = Math.pow(0.55, dt);
    v.vx *= drag; v.vz *= drag;
    const hs = Math.sqrt(v.vx * v.vx + v.vz * v.vz);
    if (hs > T.speed) { v.vx *= T.speed / hs; v.vz *= T.speed / hs; }
    v.vy += up * 14 * dt; v.vy *= Math.pow(0.4, dt);
    v.yaw = U.wrapAng(v.yaw + yawIn * T.turn * dt);
    v.x += v.vx * dt; v.z += v.vz * dt; v.y += v.vy * dt;
    v.x = U.clamp(v.x, -990, 990); v.z = U.clamp(v.z, -990, 990);
    const g = W.groundAt(v.x, v.z);
    const top = g + Math.max(W.obstacleH(v.x, v.z), 0);
    if (v.y < top + 0.1) { v.y = top + 0.1; if (v.vy < 0) { if (v.vy < -9) C.damageVehicle(B, v, -v.vy * 25, 'he', -1, -1); v.vy = 0; } }
    if (v.y > g + 260) { v.y = g + 260; v.vy = Math.min(0, v.vy); }
    v.alt = v.y - g;
    v.landed = v.alt < 0.6;
    v.spd = hs;
    // tilt
    const lf = (v.vx * fx + v.vz * fz), ls = (v.vx * rx + v.vz * rz);
    v.pitch = U.lerp(v.pitch, -fwd * 0.22 - lf * 0.002, Math.min(1, dt * 3));
    v.roll = U.lerp(v.roll, -strafe * 0.25 - yawIn * 0.12 + ls * 0.003 * 0, Math.min(1, dt * 3));
    // collide with tall obstacles / trees when low
    if (v.alt < 8 && W.occAt(v.x, v.z) > 40 && hs > 8) { C.damageVehicle(B, v, 60 * dt * hs, 'he', -1, -1); v.vx *= -0.3; v.vz *= -0.3; }
  };

  // ------------------------------------------------------------------
  // AI
  // ------------------------------------------------------------------
  V.update = function (B, dt) {
    const S = B.S;
    B.activeVeh.length = 0; B.wreckList.length = 0;
    for (const v of B.vehicles) {
      if (v.state === 'active' || v.state === 'abandoned') B.activeVeh.push(v);
      else if (v.state === 'wreck') B.wreckList.push(v);
    }
    for (const v of B.vehicles) {
      if (v.state === 'gone') continue;
      if (v.state === 'wreck') {
        if (v.burning && B.time - v.wreckT > 70) v.burning = false;
        continue;
      }
      if (v.state === 'crashing') {
        v.crashT += dt; v.vy -= 9.8 * dt; v.yaw += dt * 3.5; v.y += v.vy * dt; v.x += v.vx * dt; v.z += v.vz * dt;
        v.roll += dt * 0.8;
        if (v.y <= B.W.groundAt(v.x, v.z) + 0.5 || v.crashT > 12) V.wreck(B, v);
        continue;
      }
      if (v.recoil > 0) v.recoil = Math.max(0, v.recoil - dt * 2.5);
      if (v.flash > 0) v.flash -= dt;
      if (v.fireCd > 0) v.fireCd -= dt;
      if (v.mgCd > 0) v.mgCd -= dt;
      v.burning = v.hp < v.T.hp * 0.28;
      if (v.burning && !v.playerIn) v.hp -= dt * 2; // slow burn
      if (v.hp <= 0) { V.destroy(B, v, v.lastAtt, v.lastAttTeam); continue; }
      // occupants follow
      for (const i of v.crew) { S.x[i] = v.x; S.y[i] = v.y + 1; S.z[i] = v.z; }
      for (const i of v.passengers) { S.x[i] = v.x; S.y[i] = v.y + 1; S.z[i] = v.z; }
      if (v.state === 'abandoned') {
        if (v.T.air) { v.alt = 0; }
        continue;
      }
      if (v.playerIn) continue; // player module drives
      if (v.crew.length === 0) { v.spd *= 0.9; if (v.T.air && v.alt > 1) V.fly(B, v, 0, 0, 0, -1, dt); continue; }
      v.thinkT -= dt;
      if (v.thinkT <= 0) { v.thinkT = 0.5 + Math.random() * 0.2; V.think(B, v); }
      if (v.T.air) V.flyAI(B, v, dt); else V.driveAI(B, v, dt);
      V.weapons(B, v, dt);
    }
    // jets & drones
    V.updateJets(B, dt);
    V.updateUAV(B, dt);
    // respawns
    for (let k = B.vehQueue.length - 1; k >= 0; k--) {
      const q = B.vehQueue[k];
      if (B.time < q.t || B.tickets[q.team] <= 0) continue;
      const crew = B.squads[q.crewSquad];
      const hq = B.W.objectives[q.team];
      if (hq.owner !== q.team) continue;
      let ready = [];
      if (crew) for (const m of crew.members) if (S.st[m] === ST.ALIVE && U.dist2(S.x[m], S.z[m], hq.x, hq.z) < 140 * 140) ready.push(m);
      if (!ready.length) { if (crew && crew.alive === 0) continue; else continue; }
      B.vehQueue.splice(k, 1);
      const v = V.spawnAtHQ(B, q.type, q.team);
      if (!v) continue;
      v.crewSquad = q.crewSquad; crew.veh = v.id;
      for (const m of ready.slice(0, v.T.crew)) { v.crew.push(m); S.st[m] = ST.MOUNTED; S.veh[m] = v.id; }
      IF.emit('vehicleSpawned', v);
    }
  };

  V.spawnAtHQ = function (B, type, team) {
    const W = B.W;
    const T = IF.VEH[type];
    const hq = W.objectives[team];
    const face = team === 0 ? 0 : Math.PI;
    if (T.air) {
      const pads = W.helipads[team];
      for (const p of pads) {
        if (B.activeVeh.some((o) => U.dist2(o.x, o.z, p[0], p[1]) < 15 * 15)) continue;
        const v = V.create(B, type, team, p[0], p[1], face); v.helipad = p; v.origTeam = team; return v;
      }
      const v = V.create(B, type, team, hq.x + U.rr(-40, 40), hq.z + (team === 0 ? 60 : -60), face); v.origTeam = team; v.helipad = [v.x, v.z]; return v;
    }
    const spots = W.parking[team];
    for (let k = 0; k < spots.length; k++) {
      const p = spots[(k + B.parkCursor[team]) % spots.length];
      if (B.activeVeh.some((o) => U.dist2(o.x, o.z, p[0], p[1]) < 9 * 9)) continue;
      B.parkCursor[team] = (B.parkCursor[team] + k + 1) % spots.length;
      const v = V.create(B, type, team, p[0], p[1], face); v.origTeam = team; return v;
    }
    const [px, pz] = W.freeSpot(hq.x + U.rr(-50, 50), hq.z + (team === 0 ? -30 : 30));
    const v = V.create(B, type, team, px, pz, face); v.origTeam = team; return v;
  };

  V.think = function (B, v) {
    const W = B.W, S = B.S, T = v.T;
    // targets
    if (T.gun) V.acquire(B, v);
    if (v.type === 'recon' || v.type === 'aheli') {
      // reconnaissance: mark enemies around
      B.gridT[1 - v.team].query(S, v.x, v.z, v.type === 'recon' ? 160 : 220, (j) => { S.spotT[j] = B.time + 6; });
    }
    // repair at HQ
    const hq = W.objectives[v.team];
    if (U.dist2(v.x, v.z, hq.x, hq.z) < 120 * 120 && hq.owner === v.team) { v.hp = Math.min(T.hp, v.hp + T.hp * 0.04); }
    if (v.task === 'transport') {
      if (v.dest && U.dist2(v.x, v.z, v.dest.x, v.dest.z) < (T.air ? 20 * 20 : 14 * 14) && (!T.air || v.alt < 1.5)) v.arrived = true;
      if (v.stuckT > 8 && !T.air) { v.arrived = true; v.stuckT = 0; } // let them walk
      return;
    }
    if (v.task === 'return' || v.task === 'idle') {
      if (U.dist2(v.x, v.z, v.home[0], v.home[1]) < 25 * 25) {
        v.task = (T.seats > 0 && v.type !== 'ifv') || v.type === 'arty' ? 'idle' : (T.gun ? 'support' : 'idle');
        if (v.T.air && v.helipad) v.home = v.helipad;
      }
      if (v.hp > T.hp * 0.85 && T.gun && v.type !== 'apc' && v.type !== 'arty') v.task = 'support';
      if (v.type === 'apc' && v.task === 'idle' && B.time > 300 && Math.random() < 0.01) v.task = 'support';
    }
    if (v.task === 'support' && v.hp < T.hp * 0.3) {
      // damaged: drive to the nearest friendly ammo & repair station (helicopters fly home)
      const st = !T.air && IF.Battle.nearestStation(B, v.team, v.x, v.z);
      if (st) { v.task = 'repair'; v.dest = { x: st.x, z: st.z }; } else { v.task = 'return'; v.dest = null; }
      v.routeKey = '';
      if (v.team === B.playerTeam) IF.Radio.vehicle(B, v, 'damaged');
    }
    if (v.task === 'repair' && (v.hp > T.hp * 0.9 || !v.dest)) { v.task = 'support'; v.dest = null; v.routeKey = ''; }
    if (v.task === 'support') {
      // commander-assigned objective
      const o = v.order !== null && v.order !== undefined ? W.objectives[v.order] : null;
      if (!o) { v.dest = null; return; }
      if (!v.dest || B.time - (v.destT || 0) > 10) {
        v.destT = B.time;
        const own = o.owner === v.team;
        const hq0 = W.objectives[v.team];
        let dx = hq0.x - o.x, dz = hq0.z - o.z; const L = Math.sqrt(dx * dx + dz * dz) || 1; dx /= L; dz /= L;
        const [f] = IF.AI.strengthNear(B, v.team, o.x, o.z, o.r);
        let standoff = T.air ? 0 : own ? -25 : (f >= 6 ? o.r * 0.6 : (v.type === 'mbt' ? 150 : 190));
        if (v.type === 'arty') standoff = 700;
        const side = ((v.id * 7919) % 100) / 100 - 0.5;
        let px = o.x + dx * standoff - dz * side * 80, pz = o.z + dz * standoff + dx * side * 80;
        if (W.hasRiver && !T.air && W.riverSide(px, pz) !== W.riverSide(v.x, v.z) && W.riverSide(o.x, o.z) !== W.riverSide(v.x, v.z)) {
          // stay on our bank unless a bridge is in our hands
          const brOk = W.objectives.some((q) => q.type === 'bridge' && q.owner === v.team);
          if (!brOk) { px = o.x + dx * 90; pz = W.riverZ(px) + Math.sign(v.z - W.riverZ(v.x)) * 80; }
        }
        const fs = W.freeSpot(px, pz);
        v.dest = { x: fs[0], z: fs[1] };
      }
    }
  };

  V.acquire = function (B, v) {
    const S = B.S, W = B.W, T = v.T;
    const ey = v.y + T.hgt + 0.3;
    v.tgt = -1; v.tgtV = -1;
    const range = T.gunRange * (T.air ? 1 : B.visMul);
    // enemy vehicles (cannons, autocannons and helicopters prefer armour)
    if (T.gun === 'howitzer') return;
    if (T.gun === 'cannon' || T.gun === 'autocannon' || T.gun === 'heligun') {
      let bd = range;
      for (const o of B.activeVeh) {
        if (o.team === v.team || o.team < 0 || o.state !== 'active') continue;
        if (o.T.air && T.gun === 'cannon') continue;
        const d = Math.sqrt(U.dist2(o.x, o.z, v.x, v.z));
        if (d < bd && W.los(v.x, ey, v.z, o.x, o.y + o.T.hgt * 0.6, o.z, true) > 0.05) { bd = d; v.tgtV = o.id; }
      }
      if (v.tgtV >= 0) { const o = B.vehicles[v.tgtV]; o.spotT = B.time + 8; if (v.team === B.playerTeam && Math.random() < 0.2) IF.Radio.vehicle(B, v, 'engaging'); return; }
    }
    const n = B.gridT[1 - v.team].nearest(S, v.x, v.z, Math.min(range, 450), 4, tmpOut, tmpD);
    for (let k = 0; k < n; k++) {
      const t = tmpOut[k];
      if (t === B.playerIdx && !B.playerAlive) continue;
      if (W.los(v.x, ey, v.z, S.x[t], C.chestY(S, t), S.z[t]) > 0.1) { v.tgt = t; S.spotT[t] = B.time + 6; return; }
    }
  };

  V.driveAI = function (B, v, dt) {
    const W = B.W, T = v.T;
    let goal = null;
    if (v.task === 'transport' && v.dest && !v.arrived) goal = v.dest;
    else if (v.task === 'support' && v.dest) goal = v.dest;
    else if (v.task === 'return') goal = { x: v.home[0], z: v.home[1] };
    else if (v.task === 'repair' && v.dest) goal = v.dest;
    else if (v.task === 'arty' && v.dest) goal = v.dest;
    let th = 0, st = 0;
    if (goal) {
      const key = Math.round(goal.x / 5) + ',' + Math.round(goal.z / 5);
      if (v.routeKey !== key) { v.routeKey = key; W.route(v.x, v.z, goal.x, goal.z, true, v.route); v.routeI = 0; }
      let wp = v.route[v.routeI] || [goal.x, goal.z];
      const dwp = Math.sqrt(U.dist2(v.x, v.z, wp[0], wp[1]));
      if (dwp < 10 && v.routeI < v.route.length - 1) { v.routeI++; wp = v.route[v.routeI]; }
      const dGoal = Math.sqrt(U.dist2(v.x, v.z, goal.x, goal.z));
      let want = Math.atan2(-(wp[0] - v.x), -(wp[1] - v.z));
      // obstacle feelers
      const look = 7 + Math.abs(v.spd) * 1.1;
      const hw = T.wid * 0.55;
      const free = (a) => {
        const dx = U.dirX(a), dz = U.dirZ(a), rx = -dz, rz = dx;
        for (const f of [0.35, 0.7, 1]) for (const sd of [-1, 0, 1]) {
          const px = v.x + dx * look * f + rx * hw * sd, pz = v.z + dz * look * f + rz * hw * sd;
          if (W.occAt(px, pz) > 9 || W.waterDepth(px, pz) > 0.9) return false;
        }
        return true;
      };
      if (!free(want)) { for (const off of [0.35, -0.35, 0.7, -0.7, 1.1, -1.1, 1.6, -1.6]) if (free(want + off)) { want += off; break; } }
      const diff = U.angDiff(v.yaw, want);
      st = U.clamp(diff * 2.2, -1, 1);
      th = Math.abs(diff) > 1.3 ? 0.2 : Math.abs(diff) > 0.6 ? 0.5 : 1;
      if (dGoal < 8) th = 0;
      else if (dGoal < 30) th = Math.min(th, 0.4);
      // tanks hold position to fight when targets are in range
      if (v.task === 'support' && (v.tgt >= 0 || v.tgtV >= 0) && dGoal < 120) th *= 0.3;
      // let the infantry catch up near the objective
      if (v.reverse > 0) { v.reverse -= dt; th = -0.8; st = v.revSteer; }
      else if (v.stuckT > 2.2) {
        v.reverse = U.rr(1.5, 2.8); v.stuckT = 0; v.revSteer = Math.random() < 0.5 ? 1 : -1;
        v.stuckN = (v.stuckN || 0) + 1;
        if (v.stuckN > 2) {
          // detour sideways
          const sd = Math.random() < 0.5 ? 1 : -1, fx = U.dirX(v.yaw), fz = U.dirZ(v.yaw);
          v.route.splice(v.routeI, 0, [v.x - fz * 18 * sd - fx * 4, v.z + fx * 18 * sd - fz * 4]);
          v.stuckN = 0;
        }
      }
    }
    V.drive(B, v, th, st, dt);
  };

  V.flyAI = function (B, v, dt) {
    const W = B.W, T = v.T;
    let gx = v.x, gz = v.z, alt = 0, hover = false;
    if (v.type === 'aheli' && v.task === 'support' && v.order !== null && v.order !== undefined) {
      const o = W.objectives[v.order];
      v.orbitA += dt * 0.12;
      gx = o.x + Math.cos(v.orbitA) * 260; gz = o.z + Math.sin(v.orbitA) * 260;
      alt = 75;
    } else if (v.task === 'transport' && v.dest && !v.arrived) {
      gx = v.dest.x; gz = v.dest.z; const d = U.dist(v.x, v.z, gx, gz); alt = d > 120 ? 55 : d > 25 ? 25 : 0; hover = d < 60;
    } else if (v.task === 'return' || v.task === 'idle' || (v.task === 'support' && (v.order === null || v.order === undefined))) {
      gx = v.home[0]; gz = v.home[1]; const d = U.dist(v.x, v.z, gx, gz); alt = d > 80 ? 55 : d > 15 ? 18 : 0; hover = d < 60;
    } else if (v.task === 'transport' && v.arrived) { gx = v.x; gz = v.z; alt = 0; hover = true; }
    const dx = gx - v.x, dz = gz - v.z, d = Math.sqrt(dx * dx + dz * dz);
    let want = d > 3 ? Math.atan2(-dx, -dz) : v.yaw;
    // attack helicopter faces its target while firing
    if (v.type === 'aheli' && (v.tgt >= 0 || v.tgtV >= 0)) {
      const tx = v.tgtV >= 0 ? B.vehicles[v.tgtV].x : B.S.x[v.tgt], tz = v.tgtV >= 0 ? B.vehicles[v.tgtV].z : B.S.z[v.tgt];
      want = Math.atan2(-(tx - v.x), -(tz - v.z));
    }
    const diff = U.angDiff(v.yaw, want);
    const fx = U.dirX(v.yaw), fz = U.dirZ(v.yaw);
    const fwdC = (dx * fx + dz * fz) / (d || 1);
    const rightC = (dx * -fz + dz * fx) / (d || 1);
    let fwd = d > 5 ? U.clamp(fwdC * Math.min(1, d / (hover ? 60 : 25)), -1, 1) : -0.2 * Math.sign(v.vx * fx + v.vz * fz);
    let strafe = d > 5 ? U.clamp(rightC * Math.min(1, d / 40), -1, 1) : 0;
    const g = W.groundAt(v.x, v.z);
    // terrain look-ahead
    const ahead = W.groundAt(v.x + v.vx * 3, v.z + v.vz * 3);
    const wantY = Math.max(g, ahead) + alt + (alt > 0 ? Math.max(0, W.obstacleH(v.x, v.z)) : 0);
    const up = U.clamp((wantY - v.y) * 0.2, -1, 1);
    V.fly(B, v, fwd, strafe, U.clamp(diff * 1.5, -1, 1), up, dt);
  };

  V.weapons = function (B, v, dt) {
    const T = v.T, S = B.S;
    if (!T.gun || v.task === 'transport' && T.gun !== 'hmg' && T.gun !== 'autocannon') return;
    let tx, ty, tz, tv = null;
    if (v.tgtV >= 0) { tv = B.vehicles[v.tgtV]; if (tv.state !== 'active') { v.tgtV = -1; return; } tx = tv.x; ty = tv.y + tv.T.hgt * 0.5; tz = tv.z; }
    else if (v.tgt >= 0) { const t = v.tgt; if (S.st[t] !== ST.ALIVE) { v.tgt = -1; return; } tx = S.x[t]; ty = C.chestY(S, t); tz = S.z[t]; }
    else { v.turretYaw = U.turnTo(v.turretYaw, v.yaw, dt * 0.8); return; }
    const want = Math.atan2(-(tx - v.x), -(tz - v.z));
    v.turretYaw = U.turnTo(v.turretYaw, want, dt * (T.air ? 3 : v.type === 'mbt' ? 0.8 : 1.4));
    const d = Math.sqrt(U.dist2(tx, tz, v.x, v.z));
    const my = v.y + T.hgt + 0.2;
    v.gunPitch = Math.atan2(ty - my, d);
    const aligned = Math.abs(U.angDiff(v.turretYaw, want)) < 0.05;
    if (d > T.gunRange) return;
    const mx = v.x + U.dirX(v.turretYaw) * T.len * 0.55, mz = v.z + U.dirZ(v.turretYaw) * T.len * 0.55;
    if (T.gun === 'cannon') {
      if (aligned && v.fireCd <= 0 && (tv || d < 450)) V.fireShell(B, v, mx, my, mz, tx, ty, tz, tv, 'shell', d);
      // coax MG at infantry
      if (!tv && v.tgt >= 0 && v.mgCd <= 0 && aligned && d < 350) V.mgBurst(B, v, mx, my, mz, v.tgt, 0.11);
    } else if (T.gun === 'autocannon' || T.gun === 'heligun') {
      if (aligned && v.fireCd <= 0) {
        V.fireShell(B, v, mx, my - (T.air ? 1.8 : 0), mz, tx, ty, tz, tv, 'ac', d);
        v.burst++;
        if (v.burst >= (T.air ? 8 : 4)) { v.burst = 0; v.fireCd = T.air ? 2.2 : 1.6; } else v.fireCd = T.gunCd;
      }
      if (T.air && tv && v.rockets > 0 && aligned && Math.random() < 0.02) { V.fireShell(B, v, mx, my - 2, mz, tx, ty, tz, tv, 'hrocket', d); v.rockets--; }
    } else if (T.gun === 'hmg') {
      if (v.tgt >= 0 && aligned && v.mgCd <= 0) V.mgBurst(B, v, mx, my, mz, v.tgt, T.gunCd);
      if (tv && tv.T.armor === 0 && aligned && v.mgCd <= 0) { v.mgCd = T.gunCd; C.damageVehicle(B, tv, 18, 'hmg', v.crew[0] ?? -1, v.team); IF.FX.tracer(mx, my, mz, tx, ty, tz, v.team, true); IF.SFX.shot(mx, my, mz, 'hmg', v.team); }
    }
  };
  V.fireShell = function (B, v, mx, my, mz, tx, ty, tz, tv, kind, d) {
    const P = IF.PT[kind];
    const sp = P.speed;
    const tf = d / sp;
    const skill = v.team === B.playerTeam ? B.diff.friendSkill : B.diff.enemySkill;
    const err = (kind === 'shell' ? 0.4 + d * 0.006 : 0.6 + d * 0.012) / skill * (tv ? 1 : 1.4) * (Math.abs(v.spd) > 2 ? 2 : 1) / Math.max(0.5, B.balance * 1.5);
    let ax = tx + (tv ? tv.vx * tf : 0) + U.gauss() * err, az = tz + (tv ? tv.vz * tf : 0) + U.gauss() * err;
    let ay = ty + U.gauss() * err * 0.4 + 0.5 * P.grav * tf * tf;
    if (!tv && kind === 'shell') ay = B.W.groundAt(ax, az) + 0.6 + 0.5 * P.grav * tf * tf;
    const dx = ax - mx, dy = ay - my, dz = az - mz, L = Math.sqrt(dx * dx + dy * dy + dz * dz);
    C.spawnProj(B, kind, mx, my, mz, dx / L * sp, dy / L * sp, dz / L * sp, v.team, v.crew[0] ?? -1, v.id);
    v.fireCd = kind === 'shell' ? v.T.gunCd * U.rr(0.9, 1.3) : v.fireCd;
    v.recoil = kind === 'shell' ? 1 : 0.3; v.flash = 0.08; v.lastFireT = B.time;
    IF.FX.muzzle(mx, my, mz, v.team, kind === 'shell' ? 3 : 1.2);
    if (kind === 'shell') { IF.FX.dust(v.x, v.y + 0.5, v.z, 6); IF.SFX.cannon(mx, my, mz); }
    else IF.SFX.shot(mx, my, mz, kind === 'hrocket' ? 'rocket' : 'autocannon', v.team);
  };
  V.mgBurst = function (B, v, mx, my, mz, t, cd) {
    const S = B.S;
    v.mgCd = cd; v.flash = 0.05; v.lastFireT = B.time;
    const d = Math.sqrt(U.dist2(S.x[t], S.z[t], v.x, v.z));
    let p = 0.16 * U.clamp(1.2 - d / 400, 0.1, 1) * (S.stance[t] === 2 ? 0.45 : S.stance[t] === 1 ? 0.75 : 1) * B.visMul * B.balance;
    if (S.cover[t] >= 0) p *= 1 - B.W.coverProtection(S.cover[t], v.x, v.z);
    if (t === B.playerIdx) p *= B.diff.aiVsPlayer * 0.5;
    const hit = Math.random() < p;
    let hx = S.x[t], hy = C.chestY(S, t), hz = S.z[t];
    if (!hit) { const sp = 0.8 + d * 0.02; hx += U.gauss() * sp; hy += U.gauss() * sp * 0.4; hz += U.gauss() * sp; }
    if (U.dist2(v.x, v.z, B.camX, B.camZ) < 600 * 600) { if (Math.random() < 0.6) IF.FX.tracer(mx, my, mz, hx, hy, hz, v.team, true); IF.SFX.shot(mx, my, mz, 'hmg', v.team); }
    if (hit) C.damage(B, t, 40 * U.rr(0.8, 1.2), v.crew[0] ?? -1, 'bullet', false);
    else { S.sup[t] = Math.min(1.5, S.sup[t] + 0.15); if (t === B.playerIdx) IF.emit('nearMiss', v.x, v.z, 0.12); }
  };

  // ------------------------------------------------------------------
  // jets & drones
  // ------------------------------------------------------------------
  V.airstrike = function (B, team, tx, tz, bombs) {
    const hq = B.W.objectives[team];
    const ang = Math.atan2(tx - hq.x, tz - hq.z) + U.rr(-0.4, 0.4);
    const dist = 1500;
    const sx = tx - Math.sin(ang) * dist, sz = tz - Math.cos(ang) * dist;
    const sp = 170;
    for (let k = 0; k < 2; k++) {
      const off = k * 40;
      B.jets.push({ team, x: sx + Math.cos(ang) * off, y: 160 + k * 15, z: sz - Math.sin(ang) * off, vx: Math.sin(ang) * sp, vz: Math.cos(ang) * sp, yaw: Math.atan2(-Math.sin(ang), -Math.cos(ang)),
        tx: tx + Math.cos(ang) * off * 0.5, tz: tz - Math.sin(ang) * off * 0.5, bombs: bombs !== undefined ? bombs : 2, dropT: 0, life: 25, roll: 0 });
    }
  };
  V.flyover = function (B, team) {
    const a = Math.random() * Math.PI * 2;
    const sx = Math.cos(a) * 1600, sz = Math.sin(a) * 1600;
    const sp = 200;
    const tx = U.rr(-300, 300), tz = U.rr(-300, 300);
    const L = Math.sqrt((tx - sx) ** 2 + (tz - sz) ** 2);
    B.jets.push({ team, x: sx, y: U.rr(220, 420), z: sz, vx: (tx - sx) / L * sp, vz: (tz - sz) / L * sp, yaw: Math.atan2(-(tx - sx), -(tz - sz)), bombs: 0, life: 22, roll: U.rr(-0.4, 0.4) });
  };
  V.updateJets = function (B, dt) {
    for (let k = B.jets.length - 1; k >= 0; k--) {
      const j = B.jets[k];
      j.x += j.vx * dt; j.z += j.vz * dt; j.life -= dt;
      if (j.bombs > 0) {
        const g = B.W.groundAt(j.tx, j.tz);
        const tFall = Math.sqrt(2 * (j.y - g) / 9.8);
        const lead = Math.sqrt(j.vx * j.vx + j.vz * j.vz) * tFall;
        const d = U.dist(j.x, j.z, j.tx, j.tz);
        const ahead = (j.tx - j.x) * j.vx + (j.tz - j.z) * j.vz > 0;
        j.dropT -= dt;
        if (ahead && d < lead + 40 && j.dropT <= 0) {
          C.spawnProj(B, 'bomb', j.x, j.y - 2, j.z, j.vx * 0.95, -2, j.vz * 0.95, j.team, -1);
          j.bombs--; j.dropT = 0.35;
          if (j.bombs === 0) { j.climb = true; }
        }
      }
      if (j.climb) j.y += dt * 40;
      if (j.life <= 0) B.jets.splice(k, 1);
    }
  };
  V.updateUAV = function (B, dt) {
    const S = B.S;
    for (const u of B.uavs) {
      u.a += dt * 0.05;
      u.x = u.cx + Math.cos(u.a) * u.r; u.z = u.cz + Math.sin(u.a) * u.r * 0.7;
      u.yaw = Math.atan2(Math.sin(u.a), -Math.cos(u.a) * 0.7);
      u.scanT -= dt;
      if (u.scanT <= 0) {
        u.scanT = 3;
        B.gridT[1 - u.team].query(S, u.x, u.z, 230, (j) => { S.spotT[j] = Math.max(S.spotT[j], B.time + 5); });
        for (const v of B.activeVeh) if (v.team === 1 - u.team && U.dist2(v.x, v.z, u.x, u.z) < 280 * 280) v.spotT = B.time + 6;
      }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
