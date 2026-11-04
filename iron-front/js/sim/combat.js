// Combat resolution: AI gunfire, damage, death/downed, explosions, projectiles, ray hits.
(function (G) {
  'use strict';
  const IF = G.IF, U = IF.U, ST = IF.ST, R = IF.ROLE;
  const C = (IF.Combat = {});

  // ------------ hitboxes ------------
  // writes hit sphere centres for soldier i into arr: [x,y,z,r, ...] (chest, head, legs)
  C.hitSpheres = function (S, i, arr) {
    const x = S.x[i], y = S.y[i], z = S.z[i], st = S.stance[i];
    const prone = st === 2 || S.st[i] === ST.DOWNED;
    if (prone) {
      const fx = U.dirX(S.yaw[i]), fz = U.dirZ(S.yaw[i]);
      arr[0] = x + fx * 0.1; arr[1] = y + 0.28; arr[2] = z + fz * 0.1; arr[3] = 0.33;
      arr[4] = x + fx * 0.85; arr[5] = y + 0.32; arr[6] = z + fz * 0.85; arr[7] = 0.15;
      arr[8] = x - fx * 0.75; arr[9] = y + 0.22; arr[10] = z - fz * 0.75; arr[11] = 0.27;
    } else {
      const k = st === 1 ? 0.7 : 1;
      const lx = S.lean[i] * 0.35 * Math.cos(S.yaw[i]), lz = -S.lean[i] * 0.35 * Math.sin(S.yaw[i]);
      arr[0] = x + lx * 0.6; arr[1] = y + 1.2 * k; arr[2] = z + lz * 0.6; arr[3] = 0.32;
      arr[4] = x + lx; arr[5] = y + 1.66 * k; arr[6] = z + lz; arr[7] = 0.15;
      arr[8] = x; arr[9] = y + 0.55 * k; arr[10] = z; arr[11] = 0.27;
    }
  };
  C.eyeY = function (S, i) { const st = S.stance[i]; return S.y[i] + (st === 2 ? 0.4 : st === 1 ? 1.1 : 1.6); };
  C.chestY = function (S, i) { const st = S.stance[i]; return S.y[i] + (st === 2 || S.st[i] === ST.DOWNED ? 0.3 : st === 1 ? 0.85 : 1.25); };

  const _hs = new Float32Array(12);
  // Ray against soldiers & vehicles & world. Returns {kind:'soldier'|'vehicle'|'world'|'none', idx, d, x,y,z, head}
  C.rayHit = function (B, ox, oy, oz, dx, dy, dz, maxD, ignoreIdx, ignoreVeh, out) {
    const W = B.W, S = B.S;
    const w = out.w || (out.w = {});
    const wd = W.rayMarch(ox, oy, oz, dx, dy, dz, maxD, w);
    let best = wd, bestKind = w.kind ? 'world' : 'none', bestIdx = -1, head = false, part = 0;
    // soldiers: walk fine grid cells along the ray (step 3m)
    const g = B.gridF;
    const seen = C._seen || (C._seen = new Uint8Array(g.n * g.n));
    const touched = C._touched || (C._touched = []);
    touched.length = 0;
    for (let t = 0; t <= best + 3; t += 3) {
      const px = ox + dx * t, pz = oz + dz * t;
      for (let ox2 = -1; ox2 <= 1; ox2++) for (let oz2 = -1; oz2 <= 1; oz2++) {
        const c = g.cellIndex(px + ox2 * g.cell * 0.5, pz + oz2 * g.cell * 0.5);
        if (seen[c]) continue; seen[c] = 1; touched.push(c);
        for (let k = g.start[c]; k < g.start[c + 1]; k++) {
          const i = g.items[k];
          if (i === ignoreIdx) continue;
          C.hitSpheres(S, i, _hs);
          for (let s = 0; s < 3; s++) {
            const cx = _hs[s * 4] - ox, cy = _hs[s * 4 + 1] - oy, cz = _hs[s * 4 + 2] - oz, r = _hs[s * 4 + 3];
            const tc = cx * dx + cy * dy + cz * dz;
            if (tc < 0 || tc > best) continue;
            const d2 = cx * cx + cy * cy + cz * cz - tc * tc;
            if (d2 < r * r) { const th = tc - Math.sqrt(r * r - d2); if (th < best) { best = th; bestKind = 'soldier'; bestIdx = i; head = s === 1; part = s; } }
          }
        }
      }
      if (t > maxD) break;
    }
    for (const c of touched) seen[c] = 0;
    // vehicles: oriented boxes
    for (const v of B.activeVeh) {
      if (v.id === ignoreVeh) continue;
      const th = C.rayVehicle(v, ox, oy, oz, dx, dy, dz, best);
      if (th >= 0 && th < best) { best = th; bestKind = 'vehicle'; bestIdx = v.id; }
    }
    out.kind = bestKind; out.idx = bestIdx; out.d = best; out.head = head; out.part = part;
    out.x = ox + dx * best; out.y = oy + dy * best; out.z = oz + dz * best; out.surf = w.kind;
    return out;
  };
  C.rayVehicle = function (v, ox, oy, oz, dx, dy, dz, maxT) {
    const T = v.T;
    const cx = ox - v.x, cy = oy - (v.y + T.hgt * 0.5), cz = oz - v.z;
    const c = Math.cos(v.yaw), s = Math.sin(v.yaw);
    // into local frame (inverse yaw rotation). vehicle forward is local -z
    const lox = cx * c - cz * s, loz = cx * s + cz * c, loy = cy;
    const ldx = dx * c - dz * s, ldz = dx * s + dz * c, ldy = dy;
    const hx = T.wid * 0.5, hy = T.hgt * 0.5 + (T.air ? 0.4 : 0), hz = T.len * 0.5;
    let t0 = 0, t1 = maxT;
    const slab = (o, d, h) => {
      if (Math.abs(d) < 1e-8) return o >= -h && o <= h;
      let a = (-h - o) / d, b = (h - o) / d; if (a > b) { const q = a; a = b; b = q; }
      if (a > t0) t0 = a; if (b < t1) t1 = b; return t0 <= t1;
    };
    if (!slab(lox, ldx, hx) || !slab(loy, ldy, hy) || !slab(loz, ldz, hz)) return -1;
    return t0;
  };

  // ------------ AI gunfire ------------
  const tmpOut = {};
  C.aiShoot = function (B, i, t) {
    const S = B.S, W = B.W;
    const role = S.role[i];
    const wp = IF.AI_WEAPON[role];
    const sx = S.x[i], sz = S.z[i], tx = S.x[t], tz = S.z[t];
    const d = Math.sqrt((tx - sx) * (tx - sx) + (tz - sz) * (tz - sz));
    S.lastFire[i] = B.time; S.flash[i] = 0.06;
    let p = wp.acc * S.skill[i] * U.clamp(1.25 - d / wp.range, 0.08, 1.15) * (d < 25 ? 1.6 : 1);
    const stS = S.stance[i];
    p *= stS === 2 ? 1.25 : stS === 1 ? 1.1 : 1.0;
    if (S.spd[i] > 1.5) p *= 0.55;
    p *= 1 - 0.65 * Math.min(1, S.sup[i]);
    const stT = S.stance[t];
    p *= stT === 2 ? 0.42 : stT === 1 ? 0.72 : 1;
    if (S.spd[t] > 4) p *= 0.65;
    if (S.cover[t] >= 0) p *= 1 - W.coverProtection(S.cover[t], sx, sz);
    p *= Math.max(0.2, S.tgtVis[i]);
    p *= B.visMul;
    p *= B.balance;   // global lethality tuning
    const isPlayer = t === B.playerIdx && B.playerAlive;
    if (isPlayer) p *= B.diff.aiVsPlayer * 0.55;
    const hit = Math.random() < p;
    const ey = C.eyeY(S, i) - 0.15;
    const ty = C.chestY(S, t);
    // visual + audio near the camera
    const camD2 = U.dist2(sx, sz, B.camX, B.camZ);
    if (camD2 < 650 * 650) {
      const fx = U.dirX(S.yaw[i]), fz = U.dirZ(S.yaw[i]);
      const mx = sx + fx * 0.7, mz = sz + fz * 0.7;
      let hx = tx, hy = ty, hz = tz;
      if (!hit) {
        const sp = 0.6 + d * 0.025;
        hx += U.gauss() * sp; hy += U.gauss() * sp * 0.6; hz += U.gauss() * sp;
        // extend the miss past the target
        const ext = 1 + 30 / Math.max(10, d);
        hx = sx + (hx - sx) * ext; hz = sz + (hz - sz) * ext; hy = ey + (hy - ey) * ext;
      }
      const tracerEvery = role === R.MG ? 1 : 2;
      if (camD2 < 220 * 220 || (S.burst[i] % tracerEvery) === 0) IF.FX.tracer(mx, ey, mz, hx, hy, hz, S.team[i], role === R.MG);
      IF.FX.muzzle(mx, ey, mz, S.team[i]);
      IF.SFX.shot(sx, ey, sz, wp.snd, S.team[i]);
      if (!hit && camD2 < 400 * 400) {
        // impact puff where it lands
        if (Math.random() < 0.5) IF.FX.impact(hx, Math.max(W.groundAt(hx, hz), hy - 1), hz, 0);
      }
    } else {
      B.distantShots++;
      IF.SFX.shot(sx, ey, sz, wp.snd, S.team[i], true);
    }
    if (isPlayer) {
      // near misses crack past the player
      if (!hit) IF.emit('nearMiss', sx, sz, role === R.MG ? 0.12 : 0.07);
    }
    if (hit) {
      const head = Math.random() < (role === R.RECON ? 0.3 : 0.07);
      const dmg = wp.dmg * U.rr(0.8, 1.2) * (head ? 2.6 : 1) * (d > wp.range ? 0.7 : 1);
      C.damage(B, t, dmg, i, 'bullet', head);
    } else {
      S.sup[t] = Math.min(1.5, S.sup[t] + (role === R.MG ? 0.13 : 0.05));
    }
    S.alertT[t] = B.time;
    if (S.threatX[t] === 0 || Math.random() < 0.3) { S.threatX[t] = sx; S.threatZ[t] = sz; }
  };

  // ------------ damage ------------
  C.damage = function (B, t, dmg, att, kind, head) {
    const S = B.S;
    if (S.st[t] !== ST.ALIVE && S.st[t] !== ST.DOWNED) return;
    if (t === B.playerIdx && B.playerAlive) { IF.emit('playerDamage', dmg, att, kind, head); return; }
    if (S.st[t] === ST.DOWNED) { if (kind !== 'bullet' || Math.random() < 0.5) C.kill(B, t, att, kind, head); return; }
    S.hp[t] -= dmg;
    S.lastAtt[t] = att;
    S.sup[t] = Math.min(1.5, S.sup[t] + 0.35);
    if (U.dist2(S.x[t], S.z[t], B.camX, B.camZ) < 160 * 160) IF.FX.blood(S.x[t], C.chestY(S, t), S.z[t]);
    if (att === B.playerIdx && att >= 0) IF.emit('playerHit', t, head, S.hp[t] <= 0);
    if (S.hp[t] <= 0) {
      const lethal = head || kind === 'crush' || (kind === 'explosion' && dmg > 140) || S.hp[t] < -60;
      if (!lethal && Math.random() < 0.6) C.down(B, t, att, kind);
      else C.kill(B, t, att, kind, head);
    } else if (S.hp[t] < 45 && Math.random() < 0.25) {
      if (U.dist2(S.x[t], S.z[t], B.camX, B.camZ) < 60 * 60) IF.SFX.shout(S.x[t], S.y[t] + 1.5, S.z[t], 'wounded', S.team[t]);
    }
  };
  C.down = function (B, t, att, kind) {
    const S = B.S;
    S.st[t] = ST.DOWNED; S.hp[t] = 0; S.downT[t] = U.rr(32, 55); S.tgt[t] = -1; S.rescuer[t] = -1; S.stance[t] = 2;
    if (S.cover[t] >= 0) { B.W.coverOwner[S.cover[t]] = -1; S.cover[t] = -1; }
    B.downed[S.team[t]].push(t);
    IF.emit('downed', t, att, kind);
    if (att === B.playerIdx && att >= 0) IF.emit('playerKill', t, kind, false, true);
    if (U.dist2(S.x[t], S.z[t], B.camX, B.camZ) < 70 * 70) IF.SFX.shout(S.x[t], S.y[t] + 0.5, S.z[t], 'medic', S.team[t]);
  };
  C.kill = function (B, t, att, kind, head) {
    const S = B.S;
    const wasDowned = S.st[t] === ST.DOWNED;
    if (t === B.playerIdx && B.playerAlive) { IF.emit('playerDamage', 999, att, kind, head); return; }
    if (t === B.playerIdx && B.playerDowned) { IF.emit('playerFinished', att, kind); return; }
    S.st[t] = ST.DEAD; S.hp[t] = 0; S.tgt[t] = -1;
    if (S.cover[t] >= 0) { B.W.coverOwner[S.cover[t]] = -1; S.cover[t] = -1; }
    if (S.veh[t] >= 0) { const v = B.vehicles[S.veh[t]]; if (v) { const k = v.passengers.indexOf(t); if (k >= 0) v.passengers.splice(k, 1); const c = v.crew.indexOf(t); if (c >= 0) v.crew.splice(c, 1); } S.veh[t] = -1; }
    B.deaths[S.team[t]]++;
    B.tickets[S.team[t]] = Math.max(0, B.tickets[S.team[t]] - 1);
    if (att >= 0 && att < S.n && S.st[att] !== ST.DEAD) S.kills[att]++;
    B.corpses.push({ x: S.x[t], y: S.y[t], z: S.z[t], yaw: S.yaw[t] + U.rr(-0.6, 0.6), team: S.team[t], t: B.time, role: S.role[t], roll: Math.random() < 0.5 ? 1 : -1 });
    if (B.corpses.length > 450) B.corpses.shift();
    // squadmates are shaken
    const sq = B.squads[S.squad[t]];
    if (sq) { sq.casualtyT = B.time; sq.casualties++; }
    IF.emit('kill', t, att, kind, head, wasDowned);
    if (att === B.playerIdx && att >= 0 && !wasDowned) IF.emit('playerKill', t, kind, head, false);
  };

  // ------------ explosions ------------
  C.explode = function (B, x, y, z, r, dmg, team, owner, kind) {
    const S = B.S, W = B.W;
    const sr = r * 3.2;
    B.gridF.query(S, x, z, sr, (i, d2) => {
      const d = Math.sqrt(d2);
      if (S.st[i] !== ST.ALIVE && S.st[i] !== ST.DOWNED) return;
      if (d < r) {
        let k = Math.pow(1 - d / r, 1.2);
        if (S.stance[i] === 2) k *= 0.55;
        if (S.cover[i] >= 0 && W.coverProtection(S.cover[i], x, z) > 0.3) k *= 0.45;
        // vertical separation (aircraft bombs hitting a bridge deck etc.)
        if (Math.abs(S.y[i] - y) > r) k *= 0.2;
        if (k > 0.02) C.damage(B, i, dmg * k, owner, 'explosion', false);
      }
      S.sup[i] = Math.min(1.6, S.sup[i] + (1 - d / sr) * 1.1);
      S.alertT[i] = B.time;
    });
    for (const v of B.activeVeh) {
      const d = Math.sqrt(U.dist2(v.x, v.z, x, z) + (v.y + 1 - y) * (v.y + 1 - y));
      const rr = r + Math.max(v.T.len, v.T.wid) * 0.35;
      if (d < rr) C.damageVehicle(B, v, dmg * (1 - d / rr) * 1.2, kind === 'bomb' || kind === 'arty' ? 'shell' : 'he', owner, team);
    }
    if (kind === 'arty' || kind === 'bomb' || kind === 'shell') {
      for (const b of W.buildingsNear(x, z, r * 0.6)) {
        if (W.damageBuilding(b, dmg * (kind === 'bomb' ? 4 : 2.2))) {
          IF.FX.debris(b.x, W.terrainAt(b.x, b.z) + b.h * 0.5, b.z, Math.max(b.w, b.d));
          IF.FX.dust(b.x, W.terrainAt(b.x, b.z) + 2, b.z, Math.max(b.w, b.d) * 1.3);
          IF.SFX.explosion(b.x, W.terrainAt(b.x, b.z), b.z, 'collapse');
        }
      }
      for (const tr of W.trees) {
        if (!tr.alive) continue;
        if (Math.abs(tr.x - x) < r * 0.5 && Math.abs(tr.z - z) < r * 0.5) { tr.alive = false; tr.fallen = B.time; W.treesDirty = true; }
      }
    }
    if (W.hasRiver && y < W.waterY + 1 && W.terrainAt(x, z) < W.waterY) IF.FX.splash(x, W.waterY, z, r);
    else { IF.FX.explosion(x, y, z, r, kind); W.scorch.push([x, z, r * 0.6]); }
    IF.SFX.explosion(x, y, z, kind, r);
    IF.emit('explosion', x, y, z, r, kind);
  };

  // ------------ vehicles ------------
  C.damageVehicle = function (B, v, dmg, kind, att, attTeam) {
    if (v.state !== 'active' && v.state !== 'abandoned') return;
    const mul = (IF.ARMOR_MUL[kind] || IF.ARMOR_MUL.he)[v.T.armor];
    const real = dmg * mul;
    if (real <= 0) return;
    v.hp -= real;
    v.lastAtt = att; v.lastAttTeam = attTeam; v.hitT = B.time;
    if (v.playerIn) IF.emit('playerVehicleHit', real, kind);
    if (att === B.playerIdx && att >= 0 && v.team !== B.playerTeam) IF.emit('playerHitVehicle', v, real);
    if (v.hp <= 0) IF.Vehicles.destroy(B, v, att, attTeam);
    else if (v.state === 'active' && !v.playerIn && v.hp < v.T.hp * 0.18 && !v.T.air && Math.random() < 0.25) IF.Vehicles.abandon(B, v);
  };

  // ------------ projectiles ------------
  const PT = (IF.PT = {
    rocket:  { speed: 140, grav: 2.5, life: 4.5, r: 3.0, dmg: 70, vdmg: 380, vkind: 'rocket', kind: 'he', fx: 'rocket' },
    shell:   { speed: 520, grav: 4, life: 3.5, r: 5.5, dmg: 150, vdmg: 520, vkind: 'shell', kind: 'shell', fx: 'shell' },
    ac:      { speed: 700, grav: 3, life: 1.6, r: 2.6, dmg: 55, vdmg: 70, vkind: 'autocannon', kind: 'he', fx: 'ac' },
    arty:    { speed: 0, grav: 9.8, life: 40, r: 11, dmg: 200, vdmg: 500, vkind: 'shell', kind: 'arty', fx: 'arty' },
    bomb:    { speed: 0, grav: 9.8, life: 30, r: 15, dmg: 260, vdmg: 900, vkind: 'shell', kind: 'bomb', fx: 'bomb' },
    hrocket: { speed: 210, grav: 1.5, life: 4, r: 6, dmg: 140, vdmg: 360, vkind: 'rocket', kind: 'he', fx: 'rocket' },
    grenade: { speed: 0, grav: 9.8, life: 3.4, r: 5.5, dmg: 110, vdmg: 60, vkind: 'he', kind: 'grenade', fx: 'grenade', bounce: true },
    smoke:   { speed: 0, grav: 9.8, life: 2.2, r: 0, dmg: 0, vdmg: 0, vkind: 'he', kind: 'smoke', fx: 'grenade', bounce: true },
  });
  function Proj(n) {
    this.n = n; this.active = new Uint8Array(n);
    this.x = new Float32Array(n); this.y = new Float32Array(n); this.z = new Float32Array(n);
    this.vx = new Float32Array(n); this.vy = new Float32Array(n); this.vz = new Float32Array(n);
    this.life = new Float32Array(n); this.team = new Int8Array(n); this.owner = new Int32Array(n); this.type = new Array(n);
    this.ownerVeh = new Int16Array(n).fill(-1); this.whistled = new Uint8Array(n); this.count = 0;
  }
  IF.Proj = Proj;
  C.spawnProj = function (B, type, x, y, z, vx, vy, vz, team, owner, ownerVeh) {
    const P = B.proj;
    for (let k = 0; k < P.n; k++) {
      const i = (P.cursor = ((P.cursor || 0) + 1) % P.n);
      if (P.active[i]) continue;
      P.active[i] = 1; P.x[i] = x; P.y[i] = y; P.z[i] = z; P.vx[i] = vx; P.vy[i] = vy; P.vz[i] = vz;
      P.type[i] = type; P.life[i] = PT[type].life; P.team[i] = team; P.owner[i] = owner; P.ownerVeh[i] = ownerVeh === undefined ? -1 : ownerVeh; P.whistled[i] = 0;
      return i;
    }
    return -1;
  };
  // ballistic launch velocity to hit (tx,ty,tz) with flight time T
  C.ballistic = function (x, y, z, tx, ty, tz, T, g) {
    return [(tx - x) / T, (ty - y + 0.5 * g * T * T) / T, (tz - z) / T];
  };
  const rm = {};
  C.updateProj = function (B, dt) {
    const P = B.proj, W = B.W;
    let count = 0;
    for (let i = 0; i < P.n; i++) {
      if (!P.active[i]) continue;
      count++;
      const T = PT[P.type[i]];
      P.life[i] -= dt;
      P.vy[i] -= T.grav * dt;
      const ox = P.x[i], oy = P.y[i], oz = P.z[i];
      const nx = ox + P.vx[i] * dt, ny = oy + P.vy[i] * dt, nz = oz + P.vz[i] * dt;
      const seg = Math.sqrt((nx - ox) ** 2 + (ny - oy) ** 2 + (nz - oz) ** 2) || 1e-4;
      const dx = (nx - ox) / seg, dy = (ny - oy) / seg, dz = (nz - oz) / seg;
      let hitT = -1, hitVeh = null;
      if (T.bounce) {
        const g = W.groundAt(nx, nz);
        if (ny < g + 0.08) {
          P.y[i] = g + 0.08; P.vy[i] = Math.abs(P.vy[i]) * 0.3; P.vx[i] *= 0.55; P.vz[i] *= 0.55;
          P.x[i] = nx; P.z[i] = nz;
          if (W.occAt(nx, nz) > 3) { P.vx[i] *= -0.5; P.vz[i] *= -0.5; P.x[i] = ox; P.z[i] = oz; }
        } else {
          if (W.occAt(nx, nz) > 0 && ny < W.terrainAt(nx, nz) + W.obstacleH(nx, nz)) { P.vx[i] *= -0.4; P.vz[i] *= -0.4; P.x[i] = ox; P.z[i] = oz; P.y[i] = ny; }
          else { P.x[i] = nx; P.y[i] = ny; P.z[i] = nz; }
        }
        if (P.life[i] <= 0) {
          P.active[i] = 0;
          if (P.type[i] === 'smoke') { IF.FX.smokeScreen(P.x[i], P.y[i], P.z[i], 9); W.addSmoke(P.x[i], P.y[i], P.z[i], 9, 32); IF.SFX.thump(P.x[i], P.y[i], P.z[i]); }
          else C.explode(B, P.x[i], P.y[i] + 0.3, P.z[i], T.r, T.dmg, P.team[i], P.owner[i], 'grenade');
        }
        continue;
      }
      // world hit along the segment
      const wd = W.rayMarch(ox, oy, oz, dx, dy, dz, seg, rm);
      if (rm.kind) hitT = wd;
      // vehicles
      for (const v of B.activeVeh) {
        if (v.id === P.ownerVeh[i]) continue;
        if (Math.abs(v.x - ox) > seg + 20 || Math.abs(v.z - oz) > seg + 20) continue;
        const th = C.rayVehicle(v, ox, oy, oz, dx, dy, dz, hitT >= 0 ? hitT : seg);
        if (th >= 0) { hitT = th; hitVeh = v; }
      }
      // artillery whistle
      if ((P.type[i] === 'arty' || P.type[i] === 'bomb') && !P.whistled[i] && P.vy[i] < 0) {
        const tg = W.terrainAt(P.x[i], P.z[i]);
        const tImpact = (P.y[i] - tg) / Math.max(1, -P.vy[i]);
        if (tImpact < 2.4) { P.whistled[i] = 1; IF.SFX.whistle(P.x[i] + P.vx[i] * tImpact, tg, P.z[i] + P.vz[i] * tImpact, P.type[i]); }
      }
      if (hitT >= 0) {
        const hx = ox + dx * hitT, hy = oy + dy * hitT, hz = oz + dz * hitT;
        P.active[i] = 0;
        if (hitVeh) C.damageVehicle(B, hitVeh, T.vdmg * U.rr(0.85, 1.15), T.vkind, P.owner[i], P.team[i]);
        C.explode(B, hx - dx * 0.3, hy - dy * 0.3, hz - dz * 0.3, T.r, T.dmg, P.team[i], P.owner[i], T.kind === 'he' && hitVeh ? 'he' : T.kind);
        continue;
      }
      P.x[i] = nx; P.y[i] = ny; P.z[i] = nz;
      if (P.type[i] === 'rocket' || P.type[i] === 'hrocket') { if (U.dist2(nx, nz, B.camX, B.camZ) < 500 * 500) IF.FX.smokePuff(nx, ny, nz, 0.5, true); }
      if (P.life[i] <= 0 || ny < -50) { P.active[i] = 0; if (P.type[i] !== 'ac') C.explode(B, nx, ny, nz, T.r * 0.7, T.dmg * 0.7, P.team[i], P.owner[i], T.kind); }
    }
    P.count = count;
  };
})(typeof window !== 'undefined' ? window : globalThis);
