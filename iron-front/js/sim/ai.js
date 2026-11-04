// Soldier and squad AI. Soldiers perceive, take cover, fire, heal, repair and follow squad
// leaders; squads move, bound, flank, defend, retreat, regroup and ride vehicles.
(function (G) {
  'use strict';
  const IF = G.IF, U = IF.U, ST = IF.ST, R = IF.ROLE, C = IF.Combat;
  const AI = (IF.AI = {});

  const COMPOSITION = [R.LEADER, R.RIFLE, R.RIFLE, R.MG, R.MEDIC, R.AT, R.RIFLE, R.ENGINEER, R.RECON, R.RIFLE, R.MG, R.AT];

  // ---------------- setup ----------------
  AI.makeSquad = function (B, team, type) {
    const id = B.squads.length;
    const teamSquads = B.squads.filter((q) => q.team === team && q.type === 'inf').length;
    const base = IF.TEAMS[team].callsignBase;
    const sq = {
      id, team, type: type || 'inf', members: [], callsign: type === 'crew' ? 'CREW' : base[teamSquads % base.length] + '-' + (Math.floor(teamSquads / base.length) + 1),
      order: null, override: null, state: 'deploy', stateT: U.rr(0, 6), thinkT: Math.random(), leader: -1,
      contactX: 0, contactZ: 0, contactT: -100, contactN: 0, anchorX: 0, anchorZ: 0, boundT: 0, combatT: 0, flanked: false,
      route: [], routeI: 0, routeKey: '', heading: 0, veh: -1, alive: 0, size: 0, casualties: 0, casualtyT: -100,
      radioT: -100, reinfT: -100, smokeT: -100, postsKey: '', vehWarnT: -100, mountT: 0, waitT: 0, playerSquad: false,
    };
    B.squads.push(sq);
    return sq;
  };

  AI.initSoldier = function (B, i, team, role, sq, slot) {
    const S = B.S;
    S.team[i] = team; S.role[i] = role; S.squad[i] = sq.id; S.slot[i] = slot;
    const sk = team === B.playerTeam ? B.diff.friendSkill : B.diff.enemySkill;
    S.skill[i] = sk * U.rr(0.8, 1.2) * (role === R.LEADER ? 1.1 : 1);
    sq.members.push(i);
  };

  AI.resetSoldier = function (B, i, x, z) {
    const S = B.S, wp = IF.AI_WEAPON[S.role[i]];
    S.st[i] = ST.ALIVE; S.hp[i] = 100; S.x[i] = x; S.z[i] = z; S.y[i] = B.W.groundAt(x, z);
    S.gx[i] = x; S.gz[i] = z; S.tgt[i] = -1; S.tgtV[i] = -1; S.sup[i] = 0; S.cover[i] = -1; S.veh[i] = -1;
    S.mag[i] = wp.mag; S.reload[i] = 0; S.fireCd[i] = U.rr(0, 1); S.burst[i] = U.ri(wp.burst[0], wp.burst[1]);
    S.stance[i] = 0; S.task[i] = 0; S.taskTgt[i] = -1; S.rescuer[i] = -1; S.downT[i] = 0; S.spd[i] = 0;
    S.rockets[i] = S.role[i] === R.AT ? 4 : 0; S.grenades[i] = 2; S.special[i] = U.rr(2, 10);
    S.think[i] = Math.random() * 0.5; S.perc[i] = Math.random() * 0.6; S.stuck[i] = 0; S.lean[i] = 0;
    S.lastAtt[i] = -1; S.threatX[i] = 0; S.threatZ[i] = 0; S.yaw[i] = S.team[i] === 0 ? 0 : Math.PI;
  };

  // ---------------- per-frame soldier update ----------------
  const SPEED = [[2.1, 4.3, 5.8], [1.5, 2.4, 2.8], [0.6, 0.75, 0.8]]; // stance x mode
  const tmpOut = new Int32Array(6), tmpD = new Float32Array(6);

  AI.update = function (B, dt) {
    const S = B.S, W = B.W, N = S.n, P = B.playerIdx;
    const camX = B.camX, camZ = B.camZ;
    for (let i = 0; i < N; i++) {
      const st = S.st[i];
      if (st === ST.DEAD || st === ST.MOUNTED) continue;
      if (st === ST.DOWNED) {
        if (i === P && B.playerAlive === false && B.playerDowned) { S.downT[i] -= dt * 0; continue; }
        S.downT[i] -= dt;
        if (S.downT[i] <= 0) C.kill(B, i, S.lastAtt[i], 'bleed');
        continue;
      }
      if (i === P) continue;
      // decay
      if (S.sup[i] > 0) S.sup[i] = Math.max(0, S.sup[i] - dt * (S.cover[i] >= 0 ? 0.22 : 0.14));
      if (S.flash[i] > 0) S.flash[i] -= dt;
      if (S.special[i] > 0) S.special[i] -= dt;
      // thinking
      S.think[i] -= dt;
      if (S.think[i] <= 0) {
        const near = U.dist2(S.x[i], S.z[i], camX, camZ) < 260 * 260;
        S.think[i] = (near ? 0.22 : 0.45) + Math.random() * 0.15;
        AI.think(B, i, near);
      }
      // ---- movement ----
      AI.move(B, i, dt);
      // ---- firing ----
      if (S.reload[i] > 0) {
        S.reload[i] -= dt;
        if (S.reload[i] <= 0) { S.mag[i] = IF.AI_WEAPON[S.role[i]].mag; S.reloadAnim[i] = 0; }
        else S.reloadAnim[i] = 1;
        continue;
      }
      S.reloadAnim[i] = 0;
      const t = S.tgt[i];
      if (t >= 0) {
        if (S.st[t] !== ST.ALIVE || (t === P && !B.playerAlive) || (t === P && B.playerInVehicle)) { S.tgt[i] = -1; continue; }
        S.tgtT[i] += dt;
        S.fireCd[i] -= dt;
        if (S.fireCd[i] <= 0 && S.mode[i] < 2 && S.tgtT[i] > 0.45 / S.skill[i]) {
          const wp = IF.AI_WEAPON[S.role[i]];
          const dx = S.x[t] - S.x[i], dz = S.z[t] - S.z[i];
          if (dx * dx + dz * dz > wp.range * wp.range * 1.3) { S.tgt[i] = -1; continue; }
          // must be roughly facing
          const want = Math.atan2(-dx, -dz);
          if (Math.abs(U.angDiff(S.yaw[i], want)) < 0.5) {
            C.aiShoot(B, i, t);
            S.mag[i]--; S.burst[i]--;
            if (S.mag[i] <= 0) { S.reload[i] = wp.reload * U.rr(0.9, 1.2); S.burst[i] = U.ri(wp.burst[0], wp.burst[1]); IF.emit('aiReload', i); }
            else if (S.burst[i] <= 0) { S.burst[i] = U.ri(wp.burst[0], wp.burst[1]); S.fireCd[i] = U.rr(0.5, 1.6) * (S.role[i] === R.MG ? 0.7 : 1); }
            else S.fireCd[i] = (1 / wp.rof) * U.rr(0.85, 1.25);
          }
        }
      } else if (S.tgtV[i] >= 0 && S.role[i] === R.AT) {
        AI.fireRocket(B, i);
      }
    }
  };

  AI.move = function (B, i, dt) {
    const S = B.S, W = B.W;
    const x = S.x[i], z = S.z[i];
    let dx = S.gx[i] - x, dz = S.gz[i] - z;
    const d = Math.sqrt(dx * dx + dz * dz);
    let sp = 0;
    const stance = S.stance[i];
    if (d > 0.5) {
      sp = SPEED[stance][S.mode[i] > 2 ? 2 : S.mode[i]];
      if (d < 2) sp *= d / 2 + 0.2;
      dx /= d; dz /= d;
    } else { dx = 0; dz = 0; }
    const wd = S.wade[i];
    if (wd > 0.3) sp *= wd > 0.9 ? 0.4 : 0.6;
    let vx = dx * sp + S.sepX[i], vz = dz * sp + S.sepZ[i];
    S.sepX[i] *= 0.9; S.sepZ[i] *= 0.9;
    const vmag = Math.sqrt(vx * vx + vz * vz);
    if (vmag > 0.05) {
      let nx = x + vx * dt, nz = z + vz * dt;
      const o = W.occAt(nx, nz);
      let ok = o <= 12 && !W.blocked(nx, nz, true) && W.waterDepth(nx, nz) < 1.5;
      if (!ok) {
        // slide
        if (W.occAt(nx, z) <= 12 && !W.blocked(nx, z, true) && W.waterDepth(nx, z) < 1.5) { nz = z; ok = true; }
        else if (W.occAt(x, nz) <= 12 && !W.blocked(x, nz, true) && W.waterDepth(x, nz) < 1.5) { nx = x; ok = true; }
      }
      if (ok) {
        if (o > 3) { nx = x + (nx - x) * 0.45; nz = z + (nz - z) * 0.45; } // vaulting low cover
        S.x[i] = nx; S.z[i] = nz;
        S.stuck[i] = Math.max(0, S.stuck[i] - dt);
      } else {
        S.stuck[i] += dt;
        if (S.stuck[i] > 1.2) {
          // sidestep around the obstacle
          const side = Math.random() < 0.5 ? 1 : -1;
          S.gx[i] = x - dz * 6 * side - dx * 2; S.gz[i] = z + dx * 6 * side - dz * 2;
          S.stuck[i] = -1.5;
        }
      }
      S.spd[i] = vmag; S.vx[i] = vx; S.vz[i] = vz;
      S.anim[i] += vmag * dt * 1.9;
    } else { S.spd[i] = 0; S.vx[i] = 0; S.vz[i] = 0; }
    const gy = W.groundAt(S.x[i], S.z[i]);
    S.y[i] = gy;
    S.wade[i] = W.hasRiver ? W.waterDepth(S.x[i], S.z[i]) : 0;
    // facing
    const t = S.tgt[i];
    let want;
    if (t >= 0) want = Math.atan2(-(S.x[t] - S.x[i]), -(S.z[t] - S.z[i]));
    else if (S.tgtV[i] >= 0) { const v = B.vehicles[S.tgtV[i]]; want = Math.atan2(-(v.x - S.x[i]), -(v.z - S.z[i])); }
    else if (vmag > 0.3) want = Math.atan2(-vx, -vz);
    else if (S.threatX[i] !== 0) want = Math.atan2(-(S.threatX[i] - S.x[i]), -(S.threatZ[i] - S.z[i]));
    else want = S.yaw[i];
    S.yaw[i] = U.turnTo(S.yaw[i], want, dt * (t >= 0 ? 5 : 3.5));
    // aim pitch for rendering
    if (t >= 0) { const dd = Math.sqrt(U.dist2(S.x[t], S.z[t], S.x[i], S.z[i])) || 1; S.aimP[i] = Math.atan2(S.y[t] - S.y[i], dd); } else S.aimP[i] *= 0.9;
  };

  // ---------------- perception ----------------
  AI.perceive = function (B, i) {
    const S = B.S, W = B.W;
    const team = S.team[i], et = 1 - team;
    const wp = IF.AI_WEAPON[S.role[i]];
    const range = Math.max(70, wp.range * B.visMul * (S.role[i] === R.RECON ? 1.15 : 1));
    const ex = S.x[i], ey = C.eyeY(S, i), ez = S.z[i];
    const cur = S.tgt[i];
    // keep current target if still visible
    if (cur >= 0 && S.st[cur] === ST.ALIVE && !(cur === B.playerIdx && (!B.playerAlive || B.playerInVehicle))) {
      const dd = U.dist2(S.x[cur], S.z[cur], ex, ez);
      if (dd < range * range * 1.2) {
        const vis = W.los(ex, ey, ez, S.x[cur], C.chestY(S, cur), S.z[cur]);
        if (vis > 0.1) { S.tgtVis[i] = vis; S.spotT[cur] = B.time + 6; AI.reportContact(B, i, cur); return; }
      }
    }
    S.tgt[i] = -1;
    const n = B.gridT[et].nearest(S, ex, ez, range, 4, tmpOut, tmpD);
    for (let k = 0; k < n; k++) {
      const t = tmpOut[k];
      if (t === B.playerIdx && (!B.playerAlive || B.playerInVehicle)) continue;
      const d = tmpD[k];
      const vis = W.los(ex, ey, ez, S.x[t], C.chestY(S, t), S.z[t]);
      if (vis <= 0.05) continue;
      let chance = vis * (1.05 - (d / range) * 0.6);
      const ts = S.stance[t];
      chance *= ts === 2 ? 0.4 : ts === 1 ? 0.75 : 1;
      if (B.time - S.lastFire[t] < 2.5) chance *= 2.2;
      if (S.spd[t] > 2.5) chance *= 1.3;
      if (B.time - S.alertT[i] < 6) chance *= 1.4;
      if (d < 35) chance = 1;
      if (Math.random() < chance) {
        S.tgt[i] = t; S.tgtVis[i] = vis; S.tgtT[i] = 0;
        S.spotT[t] = B.time + (S.role[i] === R.RECON ? 14 : 7);
        AI.reportContact(B, i, t);
        return;
      }
    }
  };
  AI.reportContact = function (B, i, t) {
    const S = B.S, sq = B.squads[S.squad[i]];
    if (!sq) return;
    const first = B.time - sq.contactT > 25;
    sq.contactX = sq.contactX * 0.6 + S.x[t] * 0.4; sq.contactZ = sq.contactZ * 0.6 + S.z[t] * 0.4;
    if (first) { sq.contactX = S.x[t]; sq.contactZ = S.z[t]; }
    sq.contactT = B.time;
    sq.contactN = Math.min(30, sq.contactN + 0.25);
    S.threatX[i] = S.x[t]; S.threatZ[i] = S.z[t];
    if (first) {
      IF.Radio.say(B, sq, 'contact');
      if (!B.firstContact) { B.firstContact = true; IF.emit('firstContact', S.x[t], S.z[t]); }
    }
  };
  AI.perceiveVehicles = function (B, i) {
    const S = B.S, team = S.team[i];
    const isAT = S.role[i] === R.AT && S.rockets[i] > 0;
    let best = -1, bd = isAT ? 380 : 220;
    for (const v of B.activeVeh) {
      if (v.state !== 'active' || v.team === team || v.team < 0) continue;
      if (v.T.air && !isAT) continue;
      const d = Math.sqrt(U.dist2(v.x, v.z, S.x[i], S.z[i]));
      if (d < bd) {
        const vis = B.W.los(S.x[i], C.eyeY(B.S, i), S.z[i], v.x, v.y + v.T.hgt * 0.6 + (v.T.air ? 0 : 0), v.z, true);
        if (vis > 0.05) { bd = d; best = v.id; }
      }
    }
    if (best >= 0) {
      const v = B.vehicles[best];
      v.spotT = B.time + 8;
      const sq = B.squads[S.squad[i]];
      if (sq && B.time - sq.vehWarnT > 30) { sq.vehWarnT = B.time; IF.Radio.say(B, sq, v.T.air ? 'heli' : 'vehicle'); }
      if (isAT) { S.tgtV[i] = best; if (S.tgt[i] >= 0 && bd < 300) S.tgt[i] = -1; }
      else { S.tgtV[i] = -1; S.sup[i] = Math.min(1.2, S.sup[i] + (bd < 80 ? 0.25 : 0.08)); S.threatX[i] = v.x; S.threatZ[i] = v.z; }
    } else S.tgtV[i] = -1;
  };

  AI.fireRocket = function (B, i) {
    const S = B.S;
    const v = B.vehicles[S.tgtV[i]];
    if (!v || v.state !== 'active') { S.tgtV[i] = -1; return; }
    if (S.special[i] > 0 || S.rockets[i] <= 0) return;
    const d = Math.sqrt(U.dist2(v.x, v.z, S.x[i], S.z[i]));
    if (d < 20 || d > 390) return;
    const want = Math.atan2(-(v.x - S.x[i]), -(v.z - S.z[i]));
    if (Math.abs(U.angDiff(S.yaw[i], want)) > 0.25) return;
    const sp = IF.PT.rocket.speed;
    const tf = d / sp;
    if (v.T.air && d > 260) return;
    const err = (0.6 + d * 0.012) * (1.3 - Math.min(1, S.skill[i]) * 0.6) * (1 + S.sup[i]) / Math.max(0.6, B.balance * 1.6) * (v.T.air ? 2.6 + v.spd * 0.06 : 1);
    const tx = v.x + v.vx * tf + U.gauss() * err, tz = v.z + v.vz * tf + U.gauss() * err;
    const ty = v.y + v.T.hgt * 0.5 + (v.vy || 0) * tf + U.gauss() * err * 0.5 + 0.5 * IF.PT.rocket.grav * tf * tf;
    const ox = S.x[i] + U.dirX(S.yaw[i]) * 0.8, oy = S.y[i] + (S.stance[i] === 1 ? 1.1 : S.stance[i] === 2 ? 0.5 : 1.55), oz = S.z[i] + U.dirZ(S.yaw[i]) * 0.8;
    let ddx = tx - ox, ddy = ty - oy, ddz = tz - oz; const L = Math.sqrt(ddx * ddx + ddy * ddy + ddz * ddz);
    C.spawnProj(B, 'rocket', ox, oy, oz, ddx / L * sp, ddy / L * sp, ddz / L * sp, S.team[i], i);
    S.rockets[i]--; S.special[i] = U.rr(7, 11); S.lastFire[i] = B.time; S.flash[i] = 0.1;
    IF.SFX.shot(ox, oy, oz, 'rocket', S.team[i]);
    IF.FX.smokePuff(ox - U.dirX(S.yaw[i]) * 1.5, oy, oz - U.dirZ(S.yaw[i]) * 1.5, 2.5);
    if (U.dist2(S.x[i], S.z[i], B.camX, B.camZ) < 120 * 120) IF.SFX.shout(S.x[i], S.y[i] + 1.5, S.z[i], 'rpg', S.team[i]);
  };

  AI.throwGrenade = function (B, i, t, smoke) {
    const S = B.S;
    const tx = S.x[t] !== undefined && !smoke ? S.x[t] : t.x, tz = !smoke ? S.z[t] : t.z;
    const d = Math.sqrt(U.dist2(tx, tz, S.x[i], S.z[i]));
    const T = 0.9 + d / 28;
    const err = d * 0.13 + 1;
    const [vx, vy, vz] = C.ballistic(S.x[i], S.y[i] + 1.6, S.z[i], tx + U.gauss() * err, B.W.groundAt(tx, tz), tz + U.gauss() * err, T, 9.8);
    C.spawnProj(B, smoke ? 'smoke' : 'grenade', S.x[i], S.y[i] + 1.6, S.z[i], vx, vy, vz, S.team[i], i);
    if (!smoke) { S.grenades[i]--; if (U.dist2(S.x[i], S.z[i], B.camX, B.camZ) < 80 * 80) IF.SFX.shout(S.x[i], S.y[i] + 1.5, S.z[i], 'grenade', S.team[i]); }
    S.special[i] = U.rr(8, 14);
  };

  // ---------------- think ----------------
  const FORM = [];
  for (let k = 0; k < 16; k++) { const rank = Math.ceil(k / 2), side = k % 2 ? 1 : -1; FORM.push([k === 0 ? 0 : side * 3.4 * rank, k === 0 ? 0 : 2.6 * rank]); }

  AI.think = function (B, i, near) {
    const S = B.S, W = B.W;
    const sq = B.squads[S.squad[i]];
    if (!sq) return;
    // perception
    S.perc[i] -= near ? 0.22 : 0.45;
    if (S.perc[i] <= 0) {
      S.perc[i] = (near ? 0.35 : 0.75) * U.rr(0.8, 1.3);
      AI.perceive(B, i);
      if ((S.role[i] === R.AT || Math.random() < 0.25)) AI.perceiveVehicles(B, i);
    }
    // separation from squadmates & others, avoid vehicles
    let sx = 0, sz = 0;
    B.gridF.query(S, S.x[i], S.z[i], 1.3, (j, d2) => {
      if (j === i) return;
      const d = Math.sqrt(d2) || 0.01;
      const k = (1.3 - d) / d * 1.2;
      sx += (S.x[i] - S.x[j]) * k; sz += (S.z[i] - S.z[j]) * k;
    });
    for (let k = 0; k < B.activeVeh.length; k++) {
      const v = B.activeVeh[k];
      if (v.T.air && v.y - S.y[i] > 4) continue;
      const dx = S.x[i] - v.x, dz = S.z[i] - v.z, d2 = dx * dx + dz * dz;
      const rr = v.T.len * 0.6 + 2;
      if (d2 < rr * rr) { const d = Math.sqrt(d2) || 0.1; const f = (rr - d) / d * 1.6 * (v.spd > 2 ? 2 : 0.6); sx += dx * f; sz += dz * f; }
    }
    S.sepX[i] = U.clamp(sx, -3, 3); S.sepZ[i] = U.clamp(sz, -3, 3);

    // role tasks
    if (S.role[i] === R.MEDIC && AI.medicTask(B, i, sq)) return;
    if (S.role[i] === R.ENGINEER && AI.engineerTask(B, i, sq)) return;
    S.task[i] = 0;

    const leader = sq.leader;
    const state = sq.state;
    const sup = S.sup[i];
    const inCombat = B.time - sq.contactT < 8;
    let gx = S.gx[i], gz = S.gz[i];
    let mode = 1, stance = 0;
    const slot = S.slot[i] % 16;

    if (state === 'mount') {
      const v = B.vehicles[sq.veh];
      if (v && v.state === 'active') {
        gx = v.x; gz = v.z; mode = 1;
        if (U.dist2(v.x, v.z, S.x[i], S.z[i]) < (v.T.len * 0.5 + 3) ** 2 && Math.abs(v.spd) < 1.5) { IF.Vehicles.board(B, v, i); return; }
      }
    } else if (state === 'move' || state === 'flank' || state === 'retreat' || state === 'deploy' || state === 'follow') {
      if (i === leader || leader < 0) {
        const wpnt = sq.route[sq.routeI];
        if (wpnt) { gx = wpnt[0]; gz = wpnt[1]; }
        mode = state === 'retreat' || state === 'flank' ? 2 : sq.travel || 1;
        if (state === 'deploy') { gx = S.x[i]; gz = S.z[i]; }
      } else {
        const lx = S.x[leader], lz = S.z[leader];
        const hd = sq.heading;
        const c = Math.cos(hd), s = Math.sin(hd);
        const ox = FORM[slot][0], oz = FORM[slot][1];
        // rotate local (ox, oz behind) into world; forward = (-sin, -cos)
        gx = lx + ox * c + oz * s; gz = lz - ox * s + oz * c;
        if (sq.state !== 'deploy') { gx += S.vx[leader] * 1.5; gz += S.vz[leader] * 1.5; }
        const dd = U.dist2(gx, gz, S.x[i], S.z[i]);
        mode = dd > 100 ? 2 : dd > 16 ? 1 : (sq.travel || 1);
        if (state === 'retreat') mode = 2;
        if (state === 'deploy') mode = 0;
      }
      if (inCombat && state !== 'retreat') stance = sup > 0.9 ? 1 : 0;
      if (S.cover[i] >= 0) { W.coverOwner[S.cover[i]] = -1; S.cover[i] = -1; }
    } else if (state === 'combat' || state === 'defend' || state === 'hold') {
      // cover near anchor
      const ax = sq.anchorX, az = sq.anchorZ;
      let px = ax + FORM[slot][0] * 1.6 * Math.cos(sq.heading) + FORM[slot][1] * 0.8 * Math.sin(sq.heading);
      let pz = az - FORM[slot][0] * 1.6 * Math.sin(sq.heading) + FORM[slot][1] * 0.8 * Math.cos(sq.heading);
      if (S.role[i] === R.RECON && inCombat) { const dx = ax - sq.contactX, dz = az - sq.contactZ, L = Math.sqrt(dx * dx + dz * dz) || 1; px += dx / L * 25; pz += dz / L * 25; }
      if (state === 'defend' && sq.posts && sq.posts.length) {
        const ci = sq.posts[slot % sq.posts.length];
        px = W.coverX[ci]; pz = W.coverZ[ci];
      }
      let ci = S.cover[i];
      if (ci >= 0 && U.dist2(W.coverX[ci], W.coverZ[ci], px, pz) > 22 * 22) { W.coverOwner[ci] = -1; ci = -1; S.cover[i] = -1; }
      if (ci < 0 && (inCombat || state === 'defend' || Math.random() < 0.3)) {
        const thx = inCombat ? sq.contactX : (S.threatX[i] || undefined), thz = inCombat ? sq.contactZ : S.threatZ[i];
        ci = W.findCover(px, pz, state === 'defend' ? 14 : 18, thx || undefined, thz, i);
        if (ci >= 0) { W.coverOwner[ci] = i; S.cover[i] = ci; }
      }
      if (ci >= 0) { gx = W.coverX[ci]; gz = W.coverZ[ci]; } else { gx = px; gz = pz; }
      const dd = U.dist2(gx, gz, S.x[i], S.z[i]);
      mode = dd > 64 ? (inCombat ? 2 : 1) : 1;
      const atGoal = dd < 4;
      if (inCombat) {
        if (atGoal) stance = (S.role[i] === R.MG || S.role[i] === R.RECON || sup > 0.6 || ci < 0) ? 2 : 1;
        else stance = sup > 1.0 ? 2 : sup > 0.4 ? 1 : 0;
      } else stance = atGoal ? (state === 'defend' ? 1 : (slot % 3 === 0 ? 0 : 1)) : 0;
      // grenade at close enemies
      const t = S.tgt[i];
      if (t >= 0 && S.grenades[i] > 0 && S.special[i] <= 0) {
        const d2 = U.dist2(S.x[t], S.z[t], S.x[i], S.z[i]);
        if (d2 > 12 * 12 && d2 < 32 * 32 && Math.random() < 0.03) AI.throwGrenade(B, i, t);
      }
    } else if (state === 'regroup') {
      const lx = leader >= 0 ? S.x[leader] : S.x[i], lz = leader >= 0 ? S.z[leader] : S.z[i];
      gx = lx + FORM[slot][0] * 0.8; gz = lz + FORM[slot][1] * 0.8; mode = 1;
      stance = U.dist2(gx, gz, S.x[i], S.z[i]) < 4 ? 1 : 0;
    }
    // hazards: leave minefields, keep out of friendly barrages
    if (W.minefields.length && W.inMinefield(gx, gz) && !W.inMinefield(S.x[i], S.z[i])) { gx = S.x[i]; gz = S.z[i]; }
    if (W.dangerAt(gx, gz, S.team[i]) && !W.dangerAt(S.x[i], S.z[i], S.team[i])) { gx = S.x[i]; gz = S.z[i]; stance = 1; }
    if (sup > 1.15 && state !== 'retreat') { stance = 2; if (S.cover[i] < 0) mode = 0; }
    if (S.wade[i] > 0.6) stance = 0;
    if (S.stuck[i] < 0) { gx = S.gx[i]; gz = S.gz[i]; }
    S.gx[i] = gx; S.gz[i] = gz; S.mode[i] = mode;
    if (mode === 2 && stance > 0) stance = 0;
    S.stance[i] = stance;
  };

  AI.medicTask = function (B, i, sq) {
    const S = B.S;
    let t = S.taskTgt[i];
    if (S.task[i] === 1 && (t < 0 || S.st[t] !== ST.DOWNED || (S.rescuer[t] !== i && S.rescuer[t] >= 0))) { S.task[i] = 0; S.taskTgt[i] = -1; t = -1; }
    if (S.task[i] !== 1) {
      if (S.sup[i] > 1.2) return false;
      const list = B.downed[S.team[i]];
      let best = -1, bd = 48 * 48;
      for (let k = 0; k < list.length; k++) {
        const j = list[k];
        if (S.st[j] !== ST.DOWNED) continue;
        if (S.rescuer[j] >= 0 && S.rescuer[j] !== i && S.st[S.rescuer[j]] === ST.ALIVE) continue;
        const d2 = U.dist2(S.x[j], S.z[j], S.x[i], S.z[i]);
        if (d2 < bd) { bd = d2; best = j; }
      }
      if (best < 0) {
        // heal wounded nearby squadmates
        if (S.special[i] <= 0) {
          for (const m of sq.members) {
            if (m === i || S.st[m] !== ST.ALIVE || S.hp[m] > 65) continue;
            if (U.dist2(S.x[m], S.z[m], S.x[i], S.z[i]) < 15 * 15) { S.hp[m] = Math.min(100, S.hp[m] + 35); S.special[i] = 7; if (m === B.playerIdx) IF.emit('playerHealed', 35); break; }
          }
        }
        return false;
      }
      S.task[i] = 1; S.taskTgt[i] = best; S.rescuer[best] = i; S.alertT[i] = 0; t = best;
      if (U.dist2(S.x[i], S.z[i], B.camX, B.camZ) < 80 * 80) IF.SFX.shout(S.x[i], S.y[i] + 1.5, S.z[i], 'coming', S.team[i]);
    }
    S.gx[i] = S.x[t]; S.gz[i] = S.z[t];
    const d2 = U.dist2(S.x[t], S.z[t], S.x[i], S.z[i]);
    S.mode[i] = d2 > 25 ? 2 : 1;
    S.stance[i] = d2 < 4 ? 1 : 0;
    if (d2 < 2.6 * 2.6) {
      S.tgtT[i] += 0.3;
      S.mode[i] = 0; S.gx[i] = S.x[i]; S.gz[i] = S.z[i];
      if (S.tgtT[i] > 2.4) AI.revive(B, t, i);
    } else S.tgtT[i] = 0;
    return true;
  };
  AI.revive = function (B, t, by) {
    const S = B.S;
    S.st[t] = ST.ALIVE; S.hp[t] = 45; S.stance[t] = 1; S.rescuer[t] = -1; S.sup[t] = 0.5; S.downT[t] = 0;
    if (by >= 0) { S.task[by] = 0; S.taskTgt[by] = -1; S.tgtT[by] = 0; }
    IF.emit('revived', t, by);
  };
  AI.engineerTask = function (B, i, sq) {
    const S = B.S;
    if (S.sup[i] > 1) return false;
    let best = null, bd = 50 * 50;
    for (const v of B.activeVeh) {
      if (v.team !== S.team[i] || v.state !== 'active' || v.T.air || v.hp > v.T.hp * 0.85 || Math.abs(v.spd) > 2) continue;
      const d2 = U.dist2(v.x, v.z, S.x[i], S.z[i]);
      if (d2 < bd) { bd = d2; best = v; }
    }
    if (!best) return false;
    const ang = Math.atan2(S.x[i] - best.x, S.z[i] - best.z);
    const rr = best.T.len * 0.5 + 1.2;
    S.gx[i] = best.x + Math.sin(ang) * rr; S.gz[i] = best.z + Math.cos(ang) * rr;
    S.mode[i] = bd > 100 ? 2 : 1; S.stance[i] = 1; S.task[i] = 3;
    if (bd < (rr + 1.5) * (rr + 1.5)) { best.hp = Math.min(best.T.hp, best.hp + 14); if (best.hp > best.T.hp * 0.5) best.burning = false; }
    return true;
  };

  // ---------------- squads ----------------
  AI.updateSquads = function (B, dt) {
    for (const sq of B.squads) {
      sq.thinkT -= dt;
      if (sq.state === 'deploy') sq.stateT -= dt;
      if (sq.thinkT > 0) continue;
      sq.thinkT = 1 + Math.random() * 0.3;
      AI.squadThink(B, sq);
    }
  };

  AI.squadDest = function (B, sq) {
    const S = B.S, W = B.W;
    const ov = sq.override;
    if (ov && B.time < ov.until) {
      if (ov.cmd === 'follow') {
        const p = B.playerIdx;
        if (B.playerAlive) { const px = B.playerVeh ? B.playerVeh.x : S.x[p], pz = B.playerVeh ? B.playerVeh.z : S.z[p]; return { x: px, z: pz, r: 10, kind: 'follow' }; }
      } else if (ov.cmd === 'hold') return { x: ov.x, z: ov.z, r: 14, kind: 'hold' };
      else if (ov.cmd === 'advance' || ov.cmd === 'defend' || ov.cmd === 'retreat') { const o = W.objectives[ov.obj]; if (o) return { x: o.x, z: o.z, r: o.r, kind: ov.cmd === 'advance' ? 'attack' : ov.cmd === 'defend' ? 'defend' : 'retreat', obj: o }; }
    } else if (ov) sq.override = null;
    const od = sq.order;
    if (od && od.obj !== undefined) { const o = W.objectives[od.obj]; return { x: o.x + (od.ox || 0), z: o.z + (od.oz || 0), r: o.r, kind: o.owner === sq.team ? 'defend' : 'attack', obj: o }; }
    if (od) return { x: od.x, z: od.z, r: 20, kind: od.kind || 'move' };
    const hq = W.objectives[sq.team];
    return { x: hq.x, z: hq.z, r: hq.r, kind: 'defend', obj: hq };
  };

  AI.squadThink = function (B, sq) {
    const S = B.S, W = B.W;
    let alive = 0, mounted = 0, sumSup = 0, lead = -1, first = -1;
    for (const m of sq.members) {
      const st = S.st[m];
      if (st === ST.ALIVE) { alive++; sumSup += S.sup[m]; if (first < 0) first = m; if (S.role[m] === R.LEADER && lead < 0) lead = m; }
      else if (st === ST.MOUNTED) mounted++;
    }
    sq.alive = alive + mounted; sq.size = sq.members.length;
    if (sq.type === 'crew') { AI.crewThink(B, sq, alive, first); return; }
    if (alive + mounted === 0) { sq.state = 'dead'; sq.leader = -1; return; }
    if (sq.state === 'dead') { sq.state = 'move'; sq.routeKey = ''; }
    // the player can be the de-facto leader only for "follow"; AI leader otherwise
    if (lead < 0 || lead === B.playerIdx) lead = first === B.playerIdx ? sq.members.find((m) => m !== B.playerIdx && S.st[m] === ST.ALIVE) ?? first : first;
    sq.leader = lead;
    const avgSup = alive ? sumSup / alive : 0;
    const ratio = sq.alive / Math.max(1, sq.size);

    if (sq.state === 'mounted') { AI.mountedThink(B, sq); return; }
    if (sq.state === 'mount') {
      const v = B.vehicles[sq.veh];
      sq.mountT += 1;
      if (!v || v.state !== 'active' || sq.mountT > 40) { AI.releaseVehicle(B, sq); sq.state = 'move'; }
      else if (alive === 0 || (sq.mountT > 25 && mounted > 0)) { sq.state = 'mounted'; IF.Vehicles.depart(B, v, sq); }
      return;
    }
    if (lead < 0) return;
    const dest = AI.squadDest(B, sq);
    sq.dest = dest;
    const lx = S.x[lead], lz = S.z[lead];
    const dDest = Math.sqrt(U.dist2(lx, lz, dest.x, dest.z));
    const inCombat = B.time - sq.contactT < 8;
    sq.contactN *= 0.85;

    if (sq.state === 'deploy') { if (sq.stateT <= 0) sq.state = 'move'; else return; }

    // ---- transitions ----
    if (dest.kind === 'retreat' && sq.state !== 'retreat' && sq.state !== 'regroup') { sq.state = 'retreat'; sq.routeKey = ''; IF.Radio.say(B, sq, 'fallback'); }
    if (sq.state === 'retreat') {
      const fb = sq.fallback || AI.fallbackPoint(B, sq);
      sq.fallback = fb;
      AI.followRoute(B, sq, lx, lz, fb.x, fb.z, 'r' + fb.id);
      if (U.dist(lx, lz, fb.x, fb.z) < fb.r * 0.6) { sq.state = 'regroup'; sq.stateT = 15; sq.fallback = null; if (sq.override && sq.override.cmd === 'retreat') sq.override = null; }
      return;
    }
    if (sq.state === 'regroup') {
      sq.stateT -= 1;
      if (sq.stateT <= 0) { sq.state = 'move'; sq.routeKey = ''; }
      return;
    }
    if (dest.kind === 'follow') {
      sq.state = 'follow';
      sq.route = [[dest.x, dest.z]]; sq.routeI = 0; sq.travel = 1;
      sq.heading = Math.atan2(-(dest.x - lx), -(dest.z - lz));
      if (inCombat && dDest < 30) { sq.state = 'combat'; sq.anchorX = dest.x; sq.anchorZ = dest.z; }
      return;
    }
    // retreat when broken
    if (inCombat && ratio < 0.34 && sq.state !== 'defend') {
      const [f, e] = AI.strengthNear(B, sq.team, lx, lz, 90);
      if (e > f * 1.5 + 2) { sq.state = 'retreat'; sq.fallback = null; sq.routeKey = ''; IF.Radio.say(B, sq, 'fallback'); return; }
    }
    if (inCombat && ratio < 0.6 && B.time - sq.reinfT > 70) {
      const [f, e] = AI.strengthNear(B, sq.team, lx, lz, 120);
      if (e > f) { sq.reinfT = B.time; IF.Radio.say(B, sq, 'reinforce', dest.obj); B.cmd[sq.team].requestHelp(dest.obj, sq); }
    }
    // board a transport for long trips
    if ((sq.state === 'move') && dDest > 420 && !inCombat && sq.veh < 0 && B.time - (sq.lastMountTry || -100) > 20) {
      sq.lastMountTry = B.time;
      const v = IF.Vehicles.findTransport(B, sq, lx, lz, dest);
      if (v) { sq.veh = v.id; v.reservedBy = sq.id; sq.state = 'mount'; sq.mountT = 0; IF.Radio.say(B, sq, 'mount'); return; }
    }
    if (sq.state === 'move' || sq.state === 'flank' || sq.state === 'combat' || sq.state === 'hold' || sq.state === 'follow') {
      if (sq.state === 'follow') { sq.state = 'move'; sq.routeKey = ''; }
      if (dest.kind === 'hold') {
        if (sq.state !== 'combat' || !inCombat) { sq.state = dDest < 15 ? 'hold' : 'move'; }
        if (sq.state === 'hold') { sq.anchorX = dest.x; sq.anchorZ = dest.z; return; }
      }
      if (sq.state === 'move') {
        if (inCombat && dDest > dest.r * 0.5) { sq.state = 'combat'; sq.anchorX = lx; sq.anchorZ = lz; sq.combatT = 0; sq.boundT = 4; }
        else {
          AI.followRoute(B, sq, lx, lz, dest.x, dest.z, 'd' + Math.round(dest.x) + ',' + Math.round(dest.z));
          sq.travel = dDest > 160 ? 1 : (inCombat ? 1 : 0);
          if (dDest < dest.r * 0.6) {
            sq.state = 'defend'; sq.postsKey = ''; AI.assignPosts(B, sq, dest);
            if (dest.kind === 'defend' && dest.obj && B.time - sq.radioT > 60) IF.Radio.say(B, sq, 'inposition', dest.obj);
          }
          // avoid our own artillery
          if (W.dangerAt(dest.x, dest.z, sq.team) && dDest < 140) { sq.state = 'hold'; sq.anchorX = lx; sq.anchorZ = lz; }
        }
        return;
      }
      if (sq.state === 'flank') {
        AI.followRoute(B, sq, lx, lz, sq.flankX, sq.flankZ, 'f' + Math.round(sq.flankX));
        if (U.dist(lx, lz, sq.flankX, sq.flankZ) < 15) { sq.state = 'combat'; sq.anchorX = lx; sq.anchorZ = lz; sq.boundT = 3; }
        return;
      }
      if (sq.state === 'combat') {
        sq.combatT += 1;
        if (!inCombat) { sq.state = 'move'; sq.routeKey = ''; sq.flanked = false; return; }
        if (dDest < dest.r * 0.55) { sq.state = 'defend'; AI.assignPosts(B, sq, dest); return; }
        const cdx = sq.contactX - sq.anchorX, cdz = sq.contactZ - sq.anchorZ;
        const cd = Math.sqrt(cdx * cdx + cdz * cdz) || 1;
        sq.heading = Math.atan2(-cdx, -cdz);
        // bounding advance toward the objective
        sq.boundT -= 1;
        const attack = dest.kind === 'attack' || dest.kind === 'move' || dest.kind === 'defend';
        if (attack && sq.boundT <= 0) {
          sq.boundT = U.rr(6, 11);
          if (avgSup < 0.7 && ratio > 0.4) {
            // advance anchor along route toward destination (but not straight into the enemy if very close)
            const wp = sq.route[sq.routeI] || [dest.x, dest.z];
            let adx = wp[0] - sq.anchorX, adz = wp[1] - sq.anchorZ; const al = Math.sqrt(adx * adx + adz * adz) || 1;
            const step = cd < 40 ? 10 : U.rr(16, 28);
            sq.anchorX += adx / al * Math.min(step, al); sq.anchorZ += adz / al * Math.min(step, al);
            if (Math.sqrt(U.dist2(sq.anchorX, sq.anchorZ, wp[0], wp[1])) < 12 && sq.routeI < sq.route.length - 1) sq.routeI++;
            // smoke to cover the bound over open ground
            if (B.time - sq.smokeT > 75 && cd > 40 && cd < 180 && Math.random() < 0.35) {
              sq.smokeT = B.time;
              const thrower = sq.members.find((m) => S.st[m] === ST.ALIVE && m !== B.playerIdx);
              if (thrower !== undefined) AI.throwGrenade(B, thrower, { x: sq.anchorX + cdx / cd * 18, z: sq.anchorZ + cdz / cd * 18 }, true);
            }
            if (Math.random() < 0.3) IF.Radio.say(B, sq, 'moving');
          }
        }
        // flank when stalled
        if (attack && !sq.flanked && sq.combatT > U.rr(28, 45) && ratio > 0.55 && cd > 45) {
          sq.flanked = true;
          const px = -cdz / cd, pz = cdx / cd;
          const [, eL] = AI.strengthNear(B, sq.team, sq.contactX + px * 70, sq.contactZ + pz * 70, 50);
          const [, eR] = AI.strengthNear(B, sq.team, sq.contactX - px * 70, sq.contactZ - pz * 70, 50);
          const side = eL <= eR ? 1 : -1;
          sq.flankX = sq.contactX + px * side * 75 - cdx / cd * 25; sq.flankZ = sq.contactZ + pz * side * 75 - cdz / cd * 25;
          if (!W.blocked(sq.flankX, sq.flankZ) && W.waterDepth(sq.flankX, sq.flankZ) < 0.5 && Math.abs(sq.flankX) < 940 && Math.abs(sq.flankZ) < 940) {
            sq.state = 'flank'; sq.routeKey = '';
            IF.Radio.say(B, sq, side > 0 ? 'flankL' : 'flankR');
          }
        }
        return;
      }
      if (sq.state === 'hold') return;
    }
    if (sq.state === 'defend') {
      if (dDest > dest.r * 1.3) { sq.state = 'move'; sq.routeKey = ''; return; }
      if (inCombat) { const cdx = sq.contactX - dest.x, cdz = sq.contactZ - dest.z; sq.heading = Math.atan2(-cdx, -cdz); }
      AI.assignPosts(B, sq, dest);
      sq.anchorX = dest.x; sq.anchorZ = dest.z;
      // a defending squad with nobody to fight pushes forward if the objective is ours and calm
      return;
    }
  };

  AI.strengthNear = function (B, team, x, z, r) {
    let f = 0, e = 0;
    const S = B.S;
    B.gridT[team].query(S, x, z, r, () => { f++; });
    B.gridT[1 - team].query(S, x, z, r, () => { e++; });
    return [f, e];
  };
  AI.fallbackPoint = function (B, sq) {
    const W = B.W, S = B.S;
    const lx = S.x[sq.leader], lz = S.z[sq.leader];
    const hq = W.objectives[sq.team];
    let best = hq, bd = 1e9;
    for (const o of W.objectives) {
      if (o.owner !== sq.team) continue;
      const toHq = U.dist(o.x, o.z, hq.x, hq.z), meToHq = U.dist(lx, lz, hq.x, hq.z);
      if (toHq > meToHq - 30 && o !== hq) continue; // must be behind us
      const d = U.dist(lx, lz, o.x, o.z);
      if (d < 60) continue;
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  };
  AI.followRoute = function (B, sq, lx, lz, tx, tz, key) {
    if (sq.routeKey !== key) {
      sq.routeKey = key;
      B.W.route(lx, lz, tx, tz, false, sq.route);
      sq.routeI = 0;
    }
    let wp = sq.route[sq.routeI];
    if (!wp) { sq.route = [[tx, tz]]; sq.routeI = 0; wp = sq.route[0]; }
    if (U.dist(lx, lz, wp[0], wp[1]) < 10 && sq.routeI < sq.route.length - 1) { sq.routeI++; wp = sq.route[sq.routeI]; }
    sq.heading = Math.atan2(-(wp[0] - lx), -(wp[1] - lz));
  };
  AI.assignPosts = function (B, sq, dest) {
    const W = B.W;
    const key = (dest.obj ? dest.obj.id : Math.round(dest.x)) + ':' + Math.round(sq.heading * 2);
    if (sq.postsKey === key && sq.posts && sq.posts.length) return;
    sq.postsKey = key;
    const o = dest.obj;
    const pts = o ? o.defPts : [];
    // prefer cover facing the threat; spread squads around the objective by squad id
    const fx = U.dirX(sq.heading), fz = U.dirZ(sq.heading);
    const off = ((sq.id * 2.399) % (Math.PI * 2));
    const scored = [];
    for (const ci of pts) {
      const dx = W.coverX[ci] - dest.x, dz = W.coverZ[ci] - dest.z;
      const ang = Math.atan2(dz, dx);
      let s = W.coverQ[ci] * 3 + Math.cos(ang - off) * 2;
      const nx = W.coverNX[ci], nz = W.coverNZ[ci];
      if (B.time - sq.contactT < 20 && (nx || nz)) s += -(nx * fx + nz * fz) * 3;
      scored.push([s + Math.random() * 1.5, ci]);
    }
    scored.sort((a, b) => b[0] - a[0]);
    sq.posts = scored.slice(0, 12).map((q) => q[1]);
    if (!sq.posts.length) sq.posts = null;
  };

  AI.mountedThink = function (B, sq) {
    const v = B.vehicles[sq.veh];
    if (!v || v.state !== 'active') { AI.releaseVehicle(B, sq); sq.state = 'move'; sq.routeKey = ''; return; }
    if (v.arrived) { IF.Vehicles.unload(B, v, sq); sq.state = 'move'; sq.routeKey = ''; IF.Radio.say(B, sq, 'dismount'); }
  };
  AI.releaseVehicle = function (B, sq) {
    const v = B.vehicles[sq.veh];
    if (v) { if (v.reservedBy === sq.id) v.reservedBy = -1; IF.Vehicles.unload(B, v, sq); }
    sq.veh = -1;
  };

  // vehicle crews: either mounted in their vehicle, waiting at HQ, or fighting as infantry after bailing out
  AI.crewThink = function (B, sq, alive, first) {
    const S = B.S, W = B.W;
    const v = B.vehicles[sq.veh];
    sq.leader = first;
    if (!v) return;
    if (v.state === 'active' && v.crew.length) { sq.state = 'mounted'; return; }
    // dismounted crew: go to HQ & wait for a new vehicle
    const hq = W.objectives[sq.team];
    if (alive === 0) { sq.state = 'dead'; return; }
    const d = U.dist(S.x[first], S.z[first], hq.x, hq.z);
    if (d > 60) { sq.state = 'retreat'; sq.fallback = hq; AI.followRoute(B, sq, S.x[first], S.z[first], hq.x, hq.z, 'hq'); }
    else { sq.state = 'regroup'; sq.stateT = 5; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
