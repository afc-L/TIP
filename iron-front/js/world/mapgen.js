// Procedural battlefield generator: terrain, rivers & bridges, roads, villages, bases,
// industrial zones, airfields, trenches, forests, minefields and cover points.
(function (G) {
  'use strict';
  const IF = G.IF, U = IF.U;

  const GT = (IF.GROUND = { GRASS: 0, DIRT: 1, CONCRETE: 2, MUD: 3, SAND: 4, ROCK: 5, FIELD: 6, FIELD2: 7, DRYGRASS: 8 });

  const COL = {
    plaster: [[0.74, 0.70, 0.62], [0.66, 0.62, 0.55], [0.78, 0.74, 0.66], [0.60, 0.56, 0.50], [0.70, 0.64, 0.52]],
    brick: [[0.55, 0.33, 0.26], [0.48, 0.30, 0.24]],
    roof: [[0.55, 0.25, 0.18], [0.40, 0.22, 0.18], [0.32, 0.32, 0.34], [0.46, 0.30, 0.22]],
    concrete: [0.58, 0.58, 0.56], darkConcrete: [0.42, 0.42, 0.41], window: [0.10, 0.11, 0.13],
    sandbag: [0.62, 0.55, 0.40], hesco: [0.60, 0.53, 0.38], berm: [0.38, 0.31, 0.22], rubble: [0.50, 0.47, 0.43],
    metal: [0.45, 0.47, 0.48], rust: [0.48, 0.30, 0.20], container: [[0.55, 0.20, 0.16], [0.20, 0.32, 0.50], [0.30, 0.42, 0.28], [0.60, 0.48, 0.22], [0.45, 0.45, 0.45]],
    wreck: [0.16, 0.15, 0.14], hedge: [0.20, 0.30, 0.14], stone: [0.52, 0.51, 0.48], wood: [0.42, 0.31, 0.20], tent: [0.38, 0.40, 0.28],
    red: [0.75, 0.12, 0.10], white: [0.88, 0.88, 0.86], hay: [0.78, 0.66, 0.36], glass: [0.18, 0.26, 0.34],
  };

  const NAMES = {
    village: ['Stary Brod', 'Kalinovka', 'Vesnice', 'Hollin', 'Marovo', 'Dubrava', 'Lesnoy', 'Brezno', 'Orlov'],
    base: ['FOB Granite', 'Camp Bastion', 'Fort Kessel', 'FOB Thunder', 'Outpost Valor', 'Camp Steel'],
    bridge: ['Old Bridge', 'Rail Bridge', 'Stone Bridge', 'Mill Bridge', 'Iron Bridge'],
    radio: ['Radio Hill', 'Signal Tower', 'Relay Station', 'Antenna Ridge'],
    depot: ['Supply Depot', 'Fuel Dump', 'Ammo Yard', 'Logistics Hub'],
    airfield: ['Airfield', 'Air Strip', 'Military Airbase'],
    factory: ['Tractor Works', 'Steel Mill', 'Chemical Plant', 'Power Station'],
    trench: ['Hill 214', 'Hill 307', 'Bunker Line', 'Redoubt', 'Hill 182'],
    crossroads: ['Crossroads', 'Farmstead', 'Collective Farm', 'Grain Silos'],
  };
  const TYPE_LABEL = { village: 'Destroyed Village', base: 'Military Base', bridge: 'Bridge', radio: 'Radio Tower', depot: 'Supply Depot', airfield: 'Airfield', factory: 'Industrial Zone', trench: 'Trench Line', crossroads: 'Crossroads', hq: 'Headquarters' };
  IF.OBJ_TYPE_LABEL = TYPE_LABEL;

  IF.MapGen = {};

  IF.MapGen.generate = function (seed, layoutId) {
    const rng = U.makeRng(seed);
    const noise = U.makeNoise(seed * 7 + 13), noise2 = U.makeNoise(seed * 3 + 101);
    const W = new IF.World();
    const GRID = W.GRID, CELL = W.CELL, HALF = W.HALF;
    if (layoutId === 'random' || !layoutId) layoutId = rng.pick(['river', 'highland', 'industrial']);
    W.layout = layoutId;
    W.seed = seed;
    const L = layoutId;
    const coverPts = [];
    const usedNames = new Set();

    // ---------------- base terrain ----------------
    const amp = L === 'highland' ? 48 : L === 'river' ? 20 : 9;
    const h = W.h;
    for (let iz = 0; iz < GRID; iz++) for (let ix = 0; ix < GRID; ix++) {
      const x = ix * CELL - HALF, z = iz * CELL - HALF;
      let v = noise.fbm(x / 520, z / 520, 5) * amp;
      if (L === 'highland') v += (noise2.ridge(x / 700, z / 700, 3) - 0.5) * 50;
      v += noise2.fbm(x / 90, z / 90, 2) * 2.2;
      // raise map edges slightly: natural bowl
      const e = Math.max(Math.abs(x), Math.abs(z)) / HALF;
      v += Math.max(0, e - 0.82) * 120;
      h[iz * GRID + ix] = 22 + v;
    }
    const idx = (x, z) => { const ix = U.clamp(Math.round((x + HALF) / CELL), 0, GRID - 1), iz = U.clamp(Math.round((z + HALF) / CELL), 0, GRID - 1); return iz * GRID + ix; };
    function forVerts(x, z, r, fn) {
      const i0 = U.clamp(Math.floor((x - r + HALF) / CELL), 0, GRID - 1), i1 = U.clamp(Math.ceil((x + r + HALF) / CELL), 0, GRID - 1);
      const k0 = U.clamp(Math.floor((z - r + HALF) / CELL), 0, GRID - 1), k1 = U.clamp(Math.ceil((z + r + HALF) / CELL), 0, GRID - 1);
      for (let iz = k0; iz <= k1; iz++) for (let ix = i0; ix <= i1; ix++) {
        const vx = ix * CELL - HALF, vz = iz * CELL - HALF;
        const d = Math.sqrt((vx - x) * (vx - x) + (vz - z) * (vz - z));
        if (d <= r) fn(iz * GRID + ix, d, vx, vz);
      }
    }
    function avgH(x, z, r) { let s = 0, n = 0; forVerts(x, z, r, (i) => { s += h[i]; n++; }); return n ? s / n : W.terrainAt(x, z); }
    function flatten(x, z, r, target, soft) {
      const R = r * (soft || 1.7);
      forVerts(x, z, R, (i, d) => { const w = d < r ? 1 : 1 - U.smooth((d - r) / (R - r)); h[i] = U.lerp(h[i], target, w); });
    }
    function raise(x, z, r, amt) { forVerts(x, z, r, (i, d) => { h[i] += amt * U.smooth(1 - d / r); }); }
    function paint(x, z, r, type, prob) { forVerts(x, z, r, (i, d) => { if (!prob || rng() < prob * (1 - d / r) + 0.3) W.ground[i] = type; }); }
    function paintRect(cx, cz, w, d, rot, type) {
      const c = Math.cos(rot), s = Math.sin(rot);
      forVerts(cx, cz, Math.max(w, d), (i, dd, vx, vz) => { const px = vx - cx, pz = vz - cz; const lx = px * c - pz * s, lz = px * s + pz * c; if (Math.abs(lx) <= w / 2 + 2 && Math.abs(lz) <= d / 2 + 2) W.ground[i] = type; });
    }

    // ground type base: fields & meadows
    for (let iz = 0; iz < GRID; iz++) for (let ix = 0; ix < GRID; ix++) {
      const x = ix * CELL - HALF, z = iz * CELL - HALF;
      const n = noise2.fbm(x / 160 + 40, z / 160, 3);
      let t = GT.GRASS;
      if (n > 0.18) t = GT.FIELD; else if (n < -0.25) t = GT.DRYGRASS;
      // patchwork of fields
      const fx = Math.floor((x + 3000) / 140), fz = Math.floor((z + 3000) / 110);
      const hsh = ((fx * 73856093) ^ (fz * 19349663)) >>> 0;
      if ((hsh % 7) === 0 && L !== 'highland') t = GT.FIELD2;
      if ((hsh % 11) === 1) t = GT.FIELD;
      W.ground[iz * GRID + ix] = t;
    }

    // ---------------- objectives layout ----------------
    const slots = [];
    const J = () => rng.range(-70, 70);
    slots.push({ x: J() * 0.5, z: 860, hq: 0 });
    slots.push({ x: J() * 0.5, z: -860, hq: 1 });
    const rowZ = [500 + J() * 0.5, 0, -500 + J() * 0.5];
    // rear rows
    slots.push({ x: -420 + J(), z: rowZ[0] + J() * 0.4, own: 0 });
    slots.push({ x: 400 + J(), z: rowZ[0] + J() * 0.4, own: 0 });
    slots.push({ x: -400 + J(), z: rowZ[2] + J() * 0.4, own: 1 });
    slots.push({ x: 420 + J(), z: rowZ[2] + J() * 0.4, own: 1 });
    // centre row (neutral)
    const cxs = [-600 + J() * 0.6, J() * 0.8, 600 + J() * 0.6];
    for (const cx of cxs) slots.push({ x: cx, z: rowZ[1] + J() * (L === 'river' ? 0 : 1), own: -1, center: true });

    // river
    if (L === 'river') {
      W.hasRiver = true;
      const pts = [];
      const ph = rng() * 6.28;
      for (let i = 0; i <= 200; i++) { const x = i * 10 - HALF; pts.push(Math.sin(x / 260 + ph) * 45 + noise.fbm(x / 200, 3, 2) * 30); }
      // make river pass exactly through centre slots
      W.riverPts = pts;
      for (const s of slots) if (s.center) s.z = W.riverZ(s.x);
      W.waterY = 9;
      const RW = 36;
      // valley
      for (let iz = 0; iz < GRID; iz++) for (let ix = 0; ix < GRID; ix++) {
        const x = ix * CELL - HALF, z = iz * CELL - HALF;
        const d = Math.abs(z - W.riverZ(x));
        const i = iz * GRID + ix;
        const valley = U.smooth(U.clamp(1 - d / 380, 0, 1));
        h[i] = U.lerp(h[i], 12 + (h[i] - 22) * 0.4, valley);
        if (d < RW / 2) { h[i] = W.waterY - 3.2 * (1 - (d / (RW / 2)) ** 2) - 0.6; W.ground[i] = GT.MUD; }
        else if (d < RW / 2 + 26) { const t = U.smooth((d - RW / 2) / 26); h[i] = U.lerp(W.waterY - 0.4, h[i], t); if (t < 0.5) W.ground[i] = GT.SAND; }
      }
    }

    // objective type selection
    const typePools = {
      river: { hq: ['base'], rear: ['village', 'depot', 'factory', 'crossroads', 'radio', 'airfield', 'trench'], center: ['bridge', 'village', 'bridge'] },
      highland: { hq: ['base'], rear: ['village', 'depot', 'trench', 'crossroads', 'radio', 'base'], center: ['radio', 'village', 'trench', 'depot', 'crossroads'] },
      industrial: { hq: ['base'], rear: ['airfield', 'depot', 'factory', 'village', 'crossroads'], center: ['factory', 'village', 'depot', 'crossroads', 'trench'] },
    }[L];
    let airfieldUsed = false, radioUsed = false;
    const objs = [];
    const letters = 'ABCDEFG';
    let li = 0;
    for (const s of slots) {
      let type;
      if (s.hq !== undefined) type = 'hq';
      else if (s.center) {
        if (L === 'river') type = s.x === slots.filter((q) => q.center)[1].x ? rng.pick(['village', 'bridge']) : 'bridge';
        else { do { type = rng.pick(typePools.center); } while ((type === 'radio' && radioUsed)); }
      } else {
        do { type = rng.pick(typePools.rear); } while ((type === 'airfield' && airfieldUsed) || (type === 'radio' && radioUsed));
      }
      if (type === 'airfield') airfieldUsed = true;
      if (type === 'radio') radioUsed = true;
      const o = { id: objs.length, type, x: s.x, z: s.z, r: type === 'hq' ? 75 : type === 'airfield' ? 70 : 55, owner: s.hq !== undefined ? s.hq : s.own, progress: 0, hq: s.hq !== undefined ? s.hq : -1,
        center: !!s.center, contested: false, spawnPts: [], defPts: [] };
      o.progress = o.owner === 0 ? -1 : o.owner === 1 ? 1 : 0; // -1 = team0 fully, +1 = team1 fully
      if (type === 'hq') { o.name = o.hq === 0 ? 'Coalition HQ' : 'Pact HQ'; o.letter = 'HQ'; }
      else {
        let nm; const pool = NAMES[type]; let tries = 0;
        do { nm = rng.pick(pool); tries++; } while (usedNames.has(nm) && tries < 20);
        usedNames.add(nm); o.name = nm;
      }
      objs.push(o);
    }
    // letters ordered by z (south to north) then x
    const lettered = objs.filter((o) => o.hq < 0).sort((a, b) => (Math.round(b.z / 250) - Math.round(a.z / 250)) || (a.x - b.x));
    for (const o of lettered) o.letter = letters[li++];
    W.objectives = objs;

    // terrain shaping around objectives
    for (const o of objs) {
      if (o.type === 'radio' && L !== 'river') raise(o.x, o.z, 160, 24);
      if (o.type === 'trench') raise(o.x, o.z, 180, 10);
      if (o.type === 'bridge') continue;
      const target = avgH(o.x, o.z, o.r);
      flatten(o.x, o.z, o.type === 'airfield' ? 110 : o.r + 20, target, o.type === 'radio' ? 1.3 : 1.8);
    }

    // ---------------- roads ----------------
    function chaikin(pts, it) {
      for (let k = 0; k < it; k++) {
        const o = [pts[0]];
        for (let i = 0; i < pts.length - 1; i++) {
          const a = pts[i], b = pts[i + 1];
          o.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
        }
        o.push(pts[pts.length - 1]); pts = o;
      }
      return pts;
    }
    function makeRoad(points, width, kind) {
      // subdivide with jitter
      const pts = [];
      for (let i = 0; i < points.length - 1; i++) {
        const a = points[i], b = points[i + 1];
        const n = Math.max(1, Math.round(U.dist(a[0], a[1], b[0], b[1]) / 120));
        for (let k = 0; k < n; k++) {
          const t = k / n; let px = U.lerp(a[0], b[0], t), pz = U.lerp(a[1], b[1], t);
          if (k > 0) { px += rng.range(-25, 25); pz += rng.range(-15, 15); }
          pts.push([px, pz]);
        }
      }
      pts.push(points[points.length - 1]);
      const sm = chaikin(pts, 3);
      // resample at 6m
      const res = [sm[0]];
      let acc = 0;
      for (let i = 1; i < sm.length; i++) {
        const d = U.dist(sm[i - 1][0], sm[i - 1][1], sm[i][0], sm[i][1]);
        acc += d;
        if (acc >= 6) { res.push(sm[i]); acc = 0; }
      }
      if (res[res.length - 1] !== sm[sm.length - 1]) res.push(sm[sm.length - 1]);
      const road = { pts: res, w: width, kind };
      W.roads.push(road);
      return road;
    }
    const hq0 = objs[0], hq1 = objs[1];
    const centers = objs.filter((o) => o.center).sort((a, b) => a.x - b.x);
    const rear0 = objs.filter((o) => o.owner === 0 && o.hq < 0).sort((a, b) => a.x - b.x);
    const rear1 = objs.filter((o) => o.owner === 1 && o.hq < 0).sort((a, b) => a.x - b.x);
    // highway through the middle objective
    makeRoad([[hq0.x, hq0.z + 140], [hq0.x, hq0.z], [U.lerp(hq0.x, centers[1].x, 0.5) + rng.range(-60, 60), 430], [centers[1].x, centers[1].z], [U.lerp(hq1.x, centers[1].x, 0.5) + rng.range(-60, 60), -430], [hq1.x, hq1.z], [hq1.x, hq1.z - 140]], 11, 'highway');
    // secondary roads
    const links = [[hq0, rear0[0]], [hq0, rear0[1]], [hq1, rear1[0]], [hq1, rear1[1]], [rear0[0], centers[0]], [rear0[1], centers[2]], [rear1[0], centers[0]], [rear1[1], centers[2]],
      [rear0[0], rear0[1]], [rear1[0], rear1[1]]];
    if (L !== 'river') links.push([centers[0], centers[1]], [centers[1], centers[2]]);
    for (const [a, b] of links) makeRoad([[a.x, a.z], [b.x, b.z]], 6.5, 'dirt');
    // road mask (4 m cells) for fast "near road" tests
    const RM = 500, roadMask = new Uint8Array(RM * RM);
    function rasterRoad(rd) {
      const rr = Math.ceil((rd.w * 0.5 + 2) / 4);
      const pts = rd.pts.length > 2 ? rd.pts : (() => { const a = rd.pts[0], b = rd.pts[1]; const n = Math.ceil(U.dist(a[0], a[1], b[0], b[1]) / 4); const o = []; for (let i = 0; i <= n; i++) o.push([U.lerp(a[0], b[0], i / n), U.lerp(a[1], b[1], i / n)]); return o; })();
      for (const p of pts) {
        const cx = ((p[0] + HALF) / 4) | 0, cz = ((p[1] + HALF) / 4) | 0;
        for (let dz = -rr; dz <= rr; dz++) for (let dx = -rr; dx <= rr; dx++) { const x2 = cx + dx, z2 = cz + dz; if (x2 >= 0 && z2 >= 0 && x2 < RM && z2 < RM) roadMask[z2 * RM + x2] = 1; }
      }
    }
    const nearRoad = (x, z, r) => {
      const rr = Math.ceil(r / 4), cx = ((x + HALF) / 4) | 0, cz = ((z + HALF) / 4) | 0;
      for (let dz = -rr; dz <= rr; dz++) for (let dx = -rr; dx <= rr; dx++) { const x2 = cx + dx, z2 = cz + dz; if (x2 >= 0 && z2 >= 0 && x2 < RM && z2 < RM && roadMask[z2 * RM + x2]) return true; }
      return false;
    };
    for (const rd of W.roads) rasterRoad(rd);
    // flatten roads
    for (const rd of W.roads) {
      const hs = rd.pts.map((p) => W.terrainAt(p[0], p[1]));
      // smooth heights along road
      for (let it = 0; it < 6; it++) for (let i = 1; i < hs.length - 1; i++) hs[i] = (hs[i - 1] + hs[i] * 2 + hs[i + 1]) / 4;
      rd.hs = hs;
      for (let i = 0; i < rd.pts.length; i += 1) {
        const p = rd.pts[i];
        let th = hs[i];
        if (W.hasRiver) th = Math.max(th, W.waterY + 0.6);
        forVerts(p[0], p[1], rd.w * 0.5 + 9, (vi, d) => {
          const w = d < rd.w * 0.5 + 2 ? 0.92 : 1 - U.smooth((d - rd.w * 0.5 - 2) / 7);
          if (W.hasRiver && Math.abs((vi / GRID | 0) * CELL - HALF - W.riverZ((vi % GRID) * CELL - HALF)) < 30) return; // don't fill river
          h[vi] = U.lerp(h[vi], th, w * 0.85);
          if (d < rd.w * 0.5 + 1.5) W.ground[vi] = GT.DIRT;
        });
      }
    }

    // ---------------- bridges & fords ----------------
    if (W.hasRiver) {
      for (const rd of W.roads) {
        for (let i = 0; i < rd.pts.length - 1; i++) {
          const a = rd.pts[i], b = rd.pts[i + 1];
          const sa = Math.sign(a[1] - W.riverZ(a[0])), sb = Math.sign(b[1] - W.riverZ(b[0]));
          if (sa !== sb) {
            const mx = (a[0] + b[0]) / 2, mz = W.riverZ(mx);
            if (W.bridges.some((q) => U.dist(q.x, q.z, mx, mz) < 80)) continue;
            // direction across river: use road direction
            const i0 = Math.max(0, i - 4), i1 = Math.min(rd.pts.length - 1, i + 5);
            let dx = rd.pts[i1][0] - rd.pts[i0][0], dz = rd.pts[i1][1] - rd.pts[i0][1];
            const Ld = Math.sqrt(dx * dx + dz * dz); dx /= Ld; dz /= Ld;
            const rot = Math.atan2(dx, dz); // local z along road
            const len = 84, wdt = rd.w + 3;
            const deckY = W.waterY + 4.2;
            const br = { x: mx, z: mz, len, w: wdt, rot, cos: Math.cos(rot), sin: Math.sin(rot), y: deckY, road: rd };
            W.bridges.push(br);
            W.crossings.push({ x: mx, z: mz, ax: dx * Math.sign(-sa || 1) * -1, az: dz * Math.sign(-sa || 1) * -1, reach: 52, kind: 'bridge' });
            // ramp the road ends up to the deck
            for (const sgn of [-1, 1]) {
              const ex = mx + dx * sgn * len * 0.5, ez = mz + dz * sgn * len * 0.5;
              flatten(ex, ez, wdt * 0.6 + 2, deckY - 0.05, 4.5);
            }
          }
        }
      }
      // crossing approach directions: make ax/az point from south(+1 side) to north. route uses +-side*reach
      for (const c of W.crossings) {
        // ensure (ax,az) points toward the south (+z) side
        if (c.az < 0) { c.ax = -c.ax; c.az = -c.az; }
      }
      // fords
      const fordXs = [(centers[0].x + centers[1].x) / 2 + rng.range(-60, 60), (centers[1].x + centers[2].x) / 2 + rng.range(-60, 60)];
      for (const fx of fordXs) {
        const fz = W.riverZ(fx);
        forVerts(fx, fz, 34, (vi, d, vx, vz) => { if (Math.abs(vx - fx) < 14) { h[vi] = Math.max(h[vi], W.waterY - 0.7); W.ground[vi] = GT.SAND; } });
        W.crossings.push({ x: fx, z: fz, ax: 0, az: 1, reach: 40, kind: 'ford' });
      }
    }

    // ---------------- structure helpers ----------------
    const boxes = W.boxes;
    function box(x, y, z, sx, sy, sz, rot, col, kind, solid) {
      const b = { x, y, z, sx, sy, sz, rot: rot || 0, r: col[0], g: col[1], b: col[2], kind: kind || 'box', hidden: false, solid: solid !== false };
      boxes.push(b);
      return boxes.length - 1;
    }
    const gy = (x, z) => W.terrainAt(x, z);
    // place a box resting on the ground; returns index, stamps obstacle
    function solidBox(x, z, sx, sy, sz, rot, col, kind, stamp, lift) {
      const y0 = minGround(x, z, sx, sz, rot) - 0.3 + (lift || 0);
      const i = box(x, y0 + (sy + 0.3) / 2, z, sx, sy + 0.3, sz, rot, col, kind);
      if (stamp !== false) W.stampRect(x, z, sx, sz, rot, sy + (lift || 0) + (y0 + 0.3 - gy(x, z)));
      return i;
    }
    function minGround(x, z, sx, sz, rot) {
      const c = Math.cos(rot || 0), s = Math.sin(rot || 0);
      let m = 1e9;
      for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]]) {
        const lx = a * sx / 2, lz = b * sz / 2;
        const wx = x + lx * c + lz * s, wz = z - lx * s + lz * c;
        m = Math.min(m, gy(wx, wz));
      }
      return m;
    }
    const loc = (cx, cz, rot, lx, lz) => { const c = Math.cos(rot), s = Math.sin(rot); return [cx + lx * c + lz * s, cz - lx * s + lz * c]; };
    function addCoverAlong(x, z, len, rot, offset, q, both) {
      const n = Math.max(1, Math.floor(len / 3));
      const c = Math.cos(rot), s = Math.sin(rot);
      // local x along length; normal = local z
      for (let i = 0; i < n; i++) {
        const lx = -len / 2 + (i + 0.5) * (len / n);
        for (const side of both === false ? [1] : [1, -1]) {
          const lz = side * offset;
          const wx = x + lx * c + lz * s, wz = z - lx * s + lz * c;
          const nx = side * s, nz = side * c;
          coverPts.push([wx, wz, nx, nz, q]);
        }
      }
    }
    function wall(x, z, len, hgt, thick, rot, col, q) {
      solidBox(x, z, len, hgt, thick, rot, col);
      if (hgt < 2.5) addCoverAlong(x, z, len, rot, thick / 2 + 0.7, q || (hgt < 1.3 ? 0.85 : 1));
      else addCoverAlong(x, z, len, rot, thick / 2 + 0.8, 1);
    }
    function sandbags(x, z, len, rot) { wall(x, z, len, 1.0, 1.0, rot, COL.sandbag, 0.95); }
    function sandRing(x, z, r, gap) {
      const n = 8;
      for (let i = 0; i < n; i++) {
        if (gap !== undefined && i === gap) continue;
        const a = (i / n) * Math.PI * 2;
        const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
        const segLen = 2 * Math.PI * r / n;
        solidBox(px, pz, segLen, 1.0, 0.9, Math.PI / 2 - a, COL.sandbag);
        coverPts.push([x + Math.cos(a) * (r - 1.2), z + Math.sin(a) * (r - 1.2), -Math.cos(a), -Math.sin(a), 0.95]);
      }
    }
    function newBuilding(x, z, w, d, rot, hgt, destructible) {
      const b = { x, z, w, d, rot, h: hgt, hp: 900 + w * d * 8, destructible: destructible !== false, ruined: false, intact: [], ruin: [] };
      W.buildings.push(b);
      return b;
    }
    function house(x, z, rot, opts) {
      opts = opts || {};
      const w = opts.w || rng.range(7, 11), d = opts.d || rng.range(6, 9), floors = opts.floors || (rng() < 0.35 ? 2 : 1);
      const hgt = floors * 3.1 + 0.4;
      const wallCol = opts.col || rng.pick(rng() < 0.25 ? COL.brick : COL.plaster);
      const roofCol = rng.pick(COL.roof);
      const b = newBuilding(x, z, w, d, rot, hgt);
      const base = minGround(x, z, w, d, rot) - 0.4;
      // ----- intact
      b.intact.push(box(x, base + (hgt + 0.4) / 2, z, w, hgt + 0.4, d, rot, wallCol));
      b.intact.push(box(x, base + hgt + 0.4 + 1.4, z, w + 0.6, 2.8, d + 0.6, rot, roofCol, 'prism'));
      // windows (front/back)
      for (let f = 0; f < floors; f++) for (const side of [-1, 1]) {
        const nw = Math.max(1, Math.floor(w / 3));
        for (let k = 0; k < nw; k++) {
          const lx = -w / 2 + (k + 0.5) * (w / nw);
          const [wx, wz] = loc(x, z, rot, lx, side * (d / 2 + 0.03));
          b.intact.push(box(wx, base + 0.4 + f * 3.1 + 1.8, wz, 1.1, 1.3, 0.12, rot, COL.window, 'box', false));
        }
      }
      W.stampRect(x, z, w, d, rot, hgt + 1);
      addCoverAlong(x, z, w, rot, d / 2 + 0.9, 0.9, true);
      addCoverAlong(x, z, d, rot + Math.PI / 2, w / 2 + 0.9, 0.9, true);
      // ----- ruin version (hidden until destroyed, unless born ruined)
      const ruinH = () => rng.range(0.8, hgt * 0.8);
      const walls = [[0, -d / 2, w, rot], [0, d / 2, w, rot], [-w / 2, 0, d, rot + Math.PI / 2], [w / 2, 0, d, rot + Math.PI / 2]];
      for (const [lx, lz, len, r] of walls) {
        const segs = rng.int(1, 3);
        for (let sgi = 0; sgi < segs; sgi++) {
          if (rng() < 0.3) continue;
          const sl = len / segs * rng.range(0.55, 0.95);
          const off = -len / 2 + (sgi + 0.5) * (len / segs);
          const ax = r === rot ? lx + off : lx, az = r === rot ? lz : lz + off;
          const [wx, wz] = loc(x, z, rot, ax, az);
          const rh = ruinH();
          const bi = box(wx, base + (rh + 0.4) / 2, wz, sl, rh + 0.4, 0.45, r, U_shade(wallCol, 0.85));
          boxes[bi].hidden = true; b.ruin.push(bi);
        }
      }
      for (let k = 0; k < 3; k++) {
        const [rx, rz] = loc(x, z, rot, rng.range(-w / 3, w / 3), rng.range(-d / 3, d / 3));
        const bi = box(rx, base + 0.5, rz, rng.range(1.5, 3.5), rng.range(0.6, 1.3), rng.range(1.5, 3), rot + rng.range(-1, 1), COL.rubble, 'box', false);
        boxes[bi].hidden = true; b.ruin.push(bi);
      }
      if (opts.ruined) { // born ruined
        b.ruined = true;
        for (const i of b.intact) boxes[i].hidden = true;
        for (const i of b.ruin) boxes[i].hidden = false;
        W.stampRect(x, z, w + 0.2, d + 0.2, rot, 0, 'clear');
        for (const i of b.ruin) { const bx = boxes[i]; if (bx.solid) W.stampRect(bx.x, bx.z, bx.sx, bx.sz, bx.rot, bx.sy - 0.4); }
        // interior cover
        coverPts.push([x, z, 0, 0, 0.6]);
      }
      return b;
    }
    function U_shade(c, k) { return [c[0] * k, c[1] * k, c[2] * k]; }
    function bigHall(x, z, w, d, hgt, rot, col, sawtooth) {
      const b = newBuilding(x, z, w, d, rot, hgt, true);
      b.hp = 4000;
      const base = minGround(x, z, w, d, rot) - 0.4;
      b.intact.push(box(x, base + (hgt + 0.4) / 2, z, w, hgt + 0.4, d, rot, col));
      if (sawtooth) {
        const n = Math.max(2, Math.round(w / 8));
        for (let k = 0; k < n; k++) {
          const [px, pz] = loc(x, z, rot, -w / 2 + (k + 0.5) * (w / n), 0);
          b.intact.push(box(px, base + hgt + 0.4 + 1.5, pz, w / n, 3, d, rot + Math.PI / 2 * 0, COL.metal, 'prism'));
        }
      }
      // big doors
      const [dx, dz] = loc(x, z, rot, 0, d / 2 + 0.05);
      b.intact.push(box(dx, base + 3, dz, Math.min(8, w * 0.4), 5.4, 0.15, rot, COL.darkConcrete, 'box', false));
      W.stampRect(x, z, w, d, rot, hgt + 1);
      addCoverAlong(x, z, w, rot, d / 2 + 0.9, 0.9);
      addCoverAlong(x, z, d, rot + Math.PI / 2, w / 2 + 0.9, 0.9);
      // ruin
      for (let k = 0; k < 6; k++) {
        const [rx, rz] = loc(x, z, rot, rng.range(-w / 2, w / 2), rng.range(-d / 2, d / 2));
        const rh = rng.range(1, hgt * 0.6);
        const bi = box(rx, base + rh / 2, rz, rng.range(3, 8), rh, rng.range(0.5, 4), rot, U_shade(col, 0.8));
        boxes[bi].hidden = true; b.ruin.push(bi);
      }
      return b;
    }
    function container(x, z, rot, stack) {
      const col = rng.pick(COL.container);
      const base = minGround(x, z, 6, 2.5, rot) - 0.2;
      box(x, base + 1.35, z, 6.1, 2.7, 2.45, rot, col);
      if (stack) box(x, base + 4.05, z, 6.1, 2.7, 2.45, rot + rng.range(-0.08, 0.08), rng.pick(COL.container));
      W.stampRect(x, z, 6.1, 2.45, rot, stack ? 5.4 : 2.6);
      addCoverAlong(x, z, 6, rot, 2, 1);
    }
    function crates(x, z) {
      const n = rng.int(2, 5);
      for (let k = 0; k < n; k++) {
        const px = x + rng.range(-2, 2), pz = z + rng.range(-2, 2), s = rng.range(0.9, 1.4);
        solidBox(px, pz, s, s * rng.range(0.8, 1.6), s, rng.range(0, 3), COL.wood);
      }
      coverPts.push([x + 2.2, z, 1, 0, 0.8], [x - 2.2, z, -1, 0, 0.8], [x, z + 2.2, 0, 1, 0.8], [x, z - 2.2, 0, -1, 0.8]);
    }
    function wreck(x, z, rot, big) {
      const L2 = big ? 7 : 4.3, Wd = big ? 3 : 1.9;
      const base = gy(x, z);
      box(x, base + 0.75, z, L2, 1.1, Wd, rot, COL.wreck);
      const [cx2, cz2] = loc(x, z, rot, big ? 1.5 : 0, 0);
      box(cx2, base + 1.65, cz2, L2 * 0.45, 0.8, Wd * 0.85, rot, U_shade(COL.wreck, 1.3));
      W.stampRect(x, z, L2, Wd, rot, 1.6);
      addCoverAlong(x, z, L2, rot, Wd / 2 + 0.7, 0.9);
    }
    function rock(x, z, s) {
      const y = gy(x, z);
      box(x, y + s * 0.3, z, s * 1.4, s, s * 1.2, rng() * 6, COL.stone, 'rock');
      W.stampRect(x, z, s * 1.2, s * 1.0, 0, s * 0.9);
      if (s > 1.1) coverPts.push([x + s, z, 1, 0, 0.7], [x - s, z, -1, 0, 0.7], [x, z + s, 0, 1, 0.7], [x, z - s, 0, -1, 0.7]);
    }
    function bunker(x, z, rot) {
      const b = newBuilding(x, z, 7, 6, rot, 2.6, true); b.hp = 2600;
      const base = minGround(x, z, 7, 6, rot) - 0.8;
      b.intact.push(box(x, base + 1.7, z, 7, 3.4, 6, rot, COL.darkConcrete));
      const [sx2, sz2] = loc(x, z, rot, 0, -3.02);
      b.intact.push(box(sx2, base + 2.4, sz2, 4.5, 0.4, 0.1, rot, COL.window, 'box', false));
      W.stampRect(x, z, 7, 6, rot, 2.6);
      addCoverAlong(x, z, 7, rot, 3.8, 1);
      addCoverAlong(x, z, 6, rot + Math.PI / 2, 4.3, 1);
      const bi = box(x, base + 1.2, z, 7, 2.4, 6, rot, COL.rubble); boxes[bi].hidden = true; b.ruin.push(bi);
    }
    function tower(x, z, rot) { // watchtower
      const y = gy(x, z);
      for (const [a, b] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) { const [px, pz] = loc(x, z, rot, a, b); box(px, y + 3, pz, 0.25, 6, 0.25, rot, COL.wood, 'box', false); }
      box(x, y + 6.2, z, 3.4, 0.3, 3.4, rot, COL.wood); box(x, y + 6.9, z, 3.4, 1.0, 3.4, rot, COL.sandbag);
      box(x, y + 8.4, z, 3.8, 0.2, 3.8, rot, COL.metal);
      W.stampRect(x, z, 0.6, 0.6, 0, 6);
    }
    function trenchLine(pts, withBunkers) {
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        const len = U.dist(a[0], a[1], b[0], b[1]);
        const rot = Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
        const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
        for (const side of [-1, 1]) {
          const [px, pz] = loc(mx, mz, rot, 0, side * 1.6);
          solidBox(px, pz, len + 1.2, 0.95, 1.1, rot, side < 0 ? COL.sandbag : COL.berm);
        }
        // trench floor: mud, cover points (omni)
        const n = Math.max(1, Math.floor(len / 3.5));
        for (let k = 0; k < n; k++) {
          const t = (k + 0.5) / n;
          coverPts.push([U.lerp(a[0], b[0], t), U.lerp(a[1], b[1], t), 0, 0, 1]);
        }
        forVerts(mx, mz, len / 2 + 3, (vi, d, vx, vz) => { if (U.segDist(vx, vz, a[0], a[1], b[0], b[1]) < 3.5) W.ground[vi] = GT.MUD; });
        if (withBunkers && i % 3 === 1) { const [bx2, bz2] = loc(mx, mz, rot, 0, -6); bunker(bx2, bz2, rot); }
      }
    }
    function zigzag(cx, cz, len, rot, amp2) {
      const pts = []; const n = Math.max(3, Math.round(len / 14));
      for (let i = 0; i <= n; i++) { const lx = -len / 2 + (i / n) * len, lz = (i % 2 ? amp2 : -amp2) + rng.range(-1.5, 1.5); pts.push(loc(cx, cz, rot, lx, lz)); }
      return pts;
    }
    function hedge(x, z, len, rot) {
      solidBox(x, z, len, 1.7, 1.4, rot, U_shade(COL.hedge, rng.range(0.85, 1.15)), 'box');
      addCoverAlong(x, z, len, rot, 1.4, 0.75);
    }
    function stoneWall(x, z, len, rot) { wall(x, z, len, 1.05, 0.7, rot, U_shade(COL.stone, rng.range(0.85, 1.1)), 0.9); }
    function fuelTank(x, z, r, hgt) {
      const y = gy(x, z);
      box(x, y + hgt / 2, z, r * 2, hgt, r * 2, 0, COL.white, 'cyl');
      W.stampRect(x, z, r * 1.8, r * 1.8, 0, hgt);
      coverPts.push([x + r + 1, z, 1, 0, 1], [x - r - 1, z, -1, 0, 1], [x, z + r + 1, 0, 1, 1], [x, z - r - 1, 0, -1, 1]);
    }
    function tent(x, z, rot) {
      const base = minGround(x, z, 5, 4, rot);
      box(x, base + 1.2, z, 5, 2.4, 4.5, rot, COL.tent, 'prism');
      W.stampRect(x, z, 5, 4.5, rot, 2.4);
    }
    const okSpot = (x, z, r) => {
      if (Math.abs(x) > 940 || Math.abs(z) > 940) return false;
      if (W.hasRiver && Math.abs(z - W.riverZ(x)) < 42) return false;
      if (nearRoad(x, z, r)) return false;
      for (let k = -1; k <= 1; k++) for (let m = -1; m <= 1; m++) if (W.occAt(x + k * r, z + m * r) > 0) return false;
      return true;
    };

    // ---------------- objective builders ----------------
    function buildObjective(o) {
      const { x, z } = o;
      const T = o.type;
      const rot0 = rng.range(0, Math.PI);
      if (T === 'hq') {
        paint(x, z, 95, GT.CONCRETE);
        // HESCO perimeter with gates toward the front
        const R = 108;
        const n = 28;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          const front = o.hq === 0 ? -Math.PI / 2 : Math.PI / 2; // direction to enemy
          const ad = Math.abs(U.angDiff(a, front)), back = Math.abs(U.angDiff(a, front + Math.PI));
          if (ad < 0.35 || Math.abs(U.angDiff(a, front + 1.3)) < 0.15 || Math.abs(U.angDiff(a, front - 1.3)) < 0.15 || back < 0.15) continue;
          const px = x + Math.cos(a) * R, pz = z + Math.sin(a) * R;
          wall(px, pz, 2 * Math.PI * R / n, 2.2, 1.2, Math.PI / 2 - a, COL.hesco);
        }
        const back = o.hq === 0 ? 1 : -1; // away from the enemy
        for (let k = 0; k < 4; k++) bigHall(x - 60 + k * 26, z + back * 45, 20, 8, 4, 0, COL.tent, false);
        bigHall(x + 55, z + back * 10, 26, 18, 9, Math.PI / 2, COL.metal, true);
        house(x - 20, z + back * 8, 0, { w: 12, d: 9, floors: 2, col: COL.concrete });
        tower(x - 85, z - 72, 0); tower(x + 85, z - 72, 0); tower(x - 85, z + 72, 0); tower(x + 85, z + 72, 0);
        o.gate = [x, z - back * 128];
        for (let k = 0; k < 6; k++) sandRing(x + (k % 2 ? 1 : -1) * rng.range(48, 78), z - back * rng.range(60, 95), 3.2, rng.int(0, 7));
        for (let k = 0; k < 5; k++) crates(x + rng.range(-95, -70), z + rng.range(-30, 30));
        for (let k = 0; k < 4; k++) tent(x + rng.range(-95, -72), z + back * rng.range(20, 40), rng.range(0, 3));
        for (let row = 0; row < 4; row++) for (let col = 0; col < 10; col++) W.parking[o.hq].push([x - 55 + col * 12, z - back * (16 + row * 13), 0]);
        for (let k = 0; k < 3; k++) { const hx = x + 40 + k * 25, hz = z + back * 75; W.helipads[o.hq].push([hx, hz]); paint(hx, hz, 9, GT.CONCRETE); }
        // flatten parking zone
        return;
      }
      if (T === 'village') {
        paint(x, z, 25, GT.DIRT);
        const n = rng.int(12, 18);
        for (let k = 0; k < n; k++) {
          for (let t = 0; t < 12; t++) {
            const a = rng() * Math.PI * 2, r = rng.range(14, o.r + 15);
            const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
            if (!okSpot(px, pz, 7)) continue;
            house(px, pz, rot0 + rng.int(0, 3) * Math.PI / 2 + rng.range(-0.1, 0.1), { ruined: rng() < 0.55 });
            break;
          }
        }
        // church
        for (let t = 0; t < 10; t++) {
          const px = x + rng.range(-20, 20), pz = z + rng.range(-20, 20);
          if (!okSpot(px, pz, 10)) continue;
          const b = house(px, pz, rot0, { w: 14, d: 9, floors: 2, col: COL.plaster[2] });
          const [tx, tz] = loc(px, pz, rot0, -9, 0);
          const tb = newBuilding(tx, tz, 4.5, 4.5, rot0, 18);
          const base = gy(tx, tz) - 0.3;
          tb.intact.push(box(tx, base + 9, tz, 4.5, 18, 4.5, rot0, COL.plaster[0]));
          tb.intact.push(box(tx, base + 20, tz, 5, 4, 5, rot0, COL.roof[2], 'prism'));
          const ri = box(tx, base + 3, tz, 4.5, 6, 4.5, rot0, COL.rubble); boxes[ri].hidden = true; tb.ruin.push(ri);
          W.stampRect(tx, tz, 4.5, 4.5, rot0, 18);
          o.landmark = [tx, tz];
          break;
        }
        for (let k = 0; k < 6; k++) { const a = rng() * 6.28, r = rng.range(5, o.r); const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; if (okSpot(px, pz, 3)) wreck(px, pz, rng() * 3, false); }
        for (let k = 0; k < 8; k++) { const a = rng() * 6.28, r = rng.range(o.r * 0.6, o.r + 30); const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; if (okSpot(px, pz, 4)) stoneWall(px, pz, rng.range(8, 20), rng() * 3); }
        for (let k = 0; k < 4; k++) sandRing(x + rng.range(-25, 25), z + rng.range(-25, 25), 3, rng.int(0, 7));
        return;
      }
      if (T === 'bridge') {
        // checkpoints on both ends
        const br = W.bridges.reduce((best, b) => (!best || U.dist(b.x, b.z, x, z) < U.dist(best.x, best.z, x, z) ? b : best), null);
        if (br) { o.x = br.x; o.z = br.z; }
        for (const sgn of [-1, 1]) {
          const ex = o.x + br.sin * 0 + Math.sin(br.rot) * sgn * 58, ez = o.z + Math.cos(br.rot) * sgn * 58;
          for (const side of [-1, 1]) {
            const [px, pz] = loc(ex, ez, br.rot, side * 9, 0);
            sandbags(px, pz, 6, br.rot + Math.PI / 2 * 0);
            sandRing(px + side * 4, pz + sgn * 6, 3, rng.int(0, 7));
          }
          for (let k = 0; k < 3; k++) { const px = ex + rng.range(-35, 35), pz = ez + sgn * rng.range(8, 35); if (okSpot(px, pz, 6)) house(px, pz, br.rot + rng.int(0, 1) * Math.PI / 2, { ruined: rng() < 0.6 }); }
          for (let k = 0; k < 2; k++) { const px = ex + rng.range(-25, 25), pz = ez + sgn * rng.range(5, 20); if (okSpot(px, pz, 3)) wreck(px, pz, rng() * 3, rng() < 0.3); }
        }
        // wrecks on the bridge deck for cover
        const [wx, wz] = loc(br.x, br.z, br.rot, rng.range(-2, 2), rng.range(-20, 20));
        const base = br.y; box(wx, base + 0.75, wz, 4.3, 1.1, 1.9, br.rot + 0.4, COL.wreck); W.stampRect(wx, wz, 4.3, 1.9, br.rot + 0.4, 1.6);
        coverPts.push([wx + 2, wz, 1, 0, 0.8], [wx - 2, wz, -1, 0, 0.8]);
        return;
      }
      if (T === 'base') {
        paint(x, z, o.r, GT.CONCRETE);
        const R = o.r - 5;
        for (let i = 0; i < 20; i++) {
          if (i % 5 === 0) continue;
          const a = (i / 20) * Math.PI * 2;
          wall(x + Math.cos(a) * R, z + Math.sin(a) * R, 2 * Math.PI * R / 20, 2.2, 1.2, Math.PI / 2 - a, COL.hesco);
        }
        bigHall(x - 15, z - 12, 22, 9, 4, rot0, COL.tent, false);
        bigHall(x + 18, z + 10, 18, 12, 6, rot0 + Math.PI / 2, COL.metal, true);
        house(x + 10, z - 22, rot0, { w: 10, d: 8, floors: 2, col: COL.concrete });
        tower(x - R + 4, z, 0); tower(x + R - 4, z, 0);
        for (let k = 0; k < 5; k++) sandRing(x + rng.range(-R + 8, R - 8), z + rng.range(-R + 8, R - 8), 3, rng.int(0, 7));
        for (let k = 0; k < 4; k++) crates(x + rng.range(-25, 25), z + rng.range(-25, 25));
        bunker(x - 25, z + 25, rot0);
        return;
      }
      if (T === 'radio') {
        paint(x, z, 30, GT.ROCK, 0.6);
        // lattice tower
        const y = gy(x, z) - 0.5, H = 52;
        for (let s = 0; s < 4; s++) for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          const sc = 1 - s * 0.2;
          box(x + a * 2.2 * sc, y + s * H / 4 + H / 8, z + b * 2.2 * sc, 0.35, H / 4, 0.35, 0, s % 2 ? COL.red : COL.white, 'box', false);
        }
        for (let k = 1; k < 8; k++) { const sc = 1 - k * 0.1; box(x, y + k * H / 8, z, 4.6 * sc, 0.25, 4.6 * sc, 0, COL.metal, 'box', false); }
        box(x, y + H + 3, z, 0.3, 6, 0.3, 0, COL.red, 'box', false);
        box(x + 1.5, y + H * 0.7, z, 2.2, 2.2, 0.6, 0, COL.white, 'cyl', false);
        W.stampRect(x, z, 5, 5, 0, 3);
        o.landmark = [x, z]; o.towerTop = y + H + 6;
        house(x + 14, z + 8, rot0, { w: 9, d: 7, floors: 1, col: COL.concrete });
        bunker(x - 16, z - 10, rot0); bunker(x + 6, z - 22, rot0 + 1.2);
        trenchLine(zigzag(x, z + 28, 60, 0, 3), false);
        trenchLine(zigzag(x, z - 30, 60, 0, 3), false);
        for (let k = 0; k < 6; k++) rock(x + rng.range(-o.r, o.r), z + rng.range(-o.r, o.r), rng.range(0.8, 2.2));
        return;
      }
      if (T === 'depot') {
        paint(x, z, o.r, GT.DIRT);
        for (let k = 0; k < 16; k++) {
          const px = x + rng.range(-o.r + 6, o.r - 6), pz = z + rng.range(-o.r + 6, o.r - 6);
          if (okSpot(px, pz, 5)) container(px, pz, rot0 + rng.int(0, 1) * Math.PI / 2 + rng.range(-0.05, 0.05), rng() < 0.3);
        }
        bigHall(x + rng.range(-10, 10), z + rng.range(-10, 10), 28, 14, 7, rot0, COL.metal, true);
        for (let k = 0; k < 3; k++) fuelTank(x + rng.range(-o.r, o.r) * 0.7, z + rng.range(-o.r, o.r) * 0.7, 3.5, 6);
        for (let k = 0; k < 8; k++) crates(x + rng.range(-o.r, o.r) * 0.8, z + rng.range(-o.r, o.r) * 0.8);
        for (let k = 0; k < 4; k++) tent(x + rng.range(-o.r, o.r) * 0.8, z + rng.range(-o.r, o.r) * 0.8, rng() * 3);
        for (let k = 0; k < 10; k++) { const a = k / 10 * 6.28; sandbags(x + Math.cos(a) * (o.r + 4), z + Math.sin(a) * (o.r + 4), 7, Math.PI / 2 - a); }
        return;
      }
      if (T === 'airfield') {
        const rot = Math.PI / 2 + rng.range(-0.15, 0.15); // runway runs east-west
        o.runway = { x, z: z + 40 * (o.owner === 0 ? 1 : -1), len: 420, w: 30, rot };
        paintRect(o.runway.x, o.runway.z, 30, 420, rot, GT.CONCRETE);
        flatten(o.runway.x, o.runway.z, 60, gy(x, z), 1.8);
        const rwy = { pts: [loc(o.runway.x, o.runway.z, rot, 0, -210), loc(o.runway.x, o.runway.z, rot, 0, 210)], w: 30, kind: 'runway' };
        W.roads.push(rwy); rasterRoad(rwy);
        for (let k = 0; k < 3; k++) bigHall(x - 50 + k * 45, z - 25 * (o.owner === 0 ? 1 : -1), 32, 24, 11, 0, COL.metal, true);
        // control tower
        const tb = newBuilding(x + 90, z, 7, 7, 0, 18); const base = gy(x + 90, z) - 0.3;
        tb.intact.push(box(x + 90, base + 7, z, 6, 14, 6, 0, COL.concrete)); tb.intact.push(box(x + 90, base + 15.5, z, 8, 3, 8, 0, COL.glass));
        const ri = box(x + 90, base + 2.5, z, 7, 5, 7, 0, COL.rubble); boxes[ri].hidden = true; tb.ruin.push(ri);
        W.stampRect(x + 90, z, 8, 8, 0, 18);
        o.landmark = [x + 90, z];
        for (let k = 0; k < 8; k++) sandRing(x + rng.range(-80, 80), z + rng.range(-40, 40), 3, rng.int(0, 7));
        for (let k = 0; k < 4; k++) { const [px, pz] = loc(o.runway.x, o.runway.z, rot, rng.range(-25, 25), rng.range(-180, 180)); wreck(px, pz, rng() * 3, true); }
        for (let k = 0; k < 2; k++) fuelTank(x - 90 + k * 10, z, 4, 7);
        return;
      }
      if (T === 'factory') {
        paint(x, z, o.r + 10, GT.CONCRETE);
        const halls = rng.int(3, 4);
        for (let k = 0; k < halls; k++) {
          for (let t = 0; t < 12; t++) {
            const px = x + rng.range(-o.r + 15, o.r - 15), pz = z + rng.range(-o.r + 15, o.r - 15);
            if (!okSpot(px, pz, 14)) continue;
            bigHall(px, pz, rng.range(24, 40), rng.range(16, 24), rng.range(8, 14), rot0, rng() < 0.5 ? COL.brick[0] : COL.concrete, true);
            break;
          }
        }
        for (let k = 0; k < 2; k++) { const px = x + rng.range(-30, 30), pz = z + rng.range(-30, 30); if (okSpot(px, pz, 3)) { const y = gy(px, pz); box(px, y + 17, pz, 3.2, 34, 3.2, 0, COL.brick[1], 'cyl'); W.stampRect(px, pz, 3, 3, 0, 34); o.landmark = [px, pz]; } }
        for (let k = 0; k < 3; k++) fuelTank(x + rng.range(-o.r, o.r), z + rng.range(-o.r, o.r), rng.range(3, 6), rng.range(5, 10));
        for (let k = 0; k < 8; k++) { const px = x + rng.range(-o.r, o.r), pz = z + rng.range(-o.r, o.r); if (okSpot(px, pz, 4)) container(px, pz, rot0, rng() < 0.2); }
        for (let k = 0; k < 4; k++) { const px = x + rng.range(-o.r, o.r), pz = z + rng.range(-o.r, o.r); if (okSpot(px, pz, 4)) wreck(px, pz, rng() * 3, true); }
        return;
      }
      if (T === 'trench') {
        paint(x, z, o.r, GT.MUD, 0.5);
        const face = o.owner === 1 ? 0 : o.owner === 0 ? Math.PI : (rng() < 0.5 ? 0 : Math.PI);
        trenchLine(zigzag(x, z - 18, 110, 0, 4), true);
        trenchLine(zigzag(x, z + 18, 90, 0, 4), true);
        trenchLine([[x - 6, z - 16], [x + 3, z], [x - 4, z + 16]], false);
        bunker(x + 30, z, face); bunker(x - 30, z, face);
        for (let k = 0; k < 10; k++) rock(x + rng.range(-o.r - 20, o.r + 20), z + rng.range(-o.r - 20, o.r + 20), rng.range(0.7, 1.8));
        return;
      }
      if (T === 'crossroads') {
        paint(x, z, 20, GT.DIRT);
        for (let k = 0; k < 6; k++) {
          for (let t = 0; t < 10; t++) {
            const a = rng() * 6.28, r = rng.range(15, o.r);
            const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
            if (!okSpot(px, pz, 8)) continue;
            if (k < 2) bigHall(px, pz, rng.range(14, 20), rng.range(9, 12), 7, rot0, COL.wood, false);
            else house(px, pz, rot0 + rng.int(0, 1) * Math.PI / 2, { ruined: rng() < 0.4 });
            break;
          }
        }
        // grain silos
        for (let k = 0; k < 3; k++) fuelTank(x + 20 + k * 8, z - 20, 3.2, 14);
        for (let k = 0; k < 10; k++) { const px = x + rng.range(-o.r, o.r), pz = z + rng.range(-o.r, o.r); if (okSpot(px, pz, 2)) { solidBox(px, pz, 2.4, 1.4, 1.4, rng() * 3, COL.hay); coverPts.push([px + 1.6, pz, 1, 0, 0.75], [px - 1.6, pz, -1, 0, 0.75]); } }
        for (let k = 0; k < 8; k++) { const a = rng() * 6.28, r = rng.range(o.r * 0.7, o.r + 40); const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; if (okSpot(px, pz, 5)) hedge(px, pz, rng.range(15, 35), rng() * 3); }
        return;
      }
    }
    for (const o of objs) buildObjective(o);

    // bridge geometry (deck, rails, piers) as boxes
    for (const br of W.bridges) {
      const by = br.y;
      box(br.x, by - 0.45, br.z, br.w, 0.9, br.len, br.rot, COL.darkConcrete, 'box', false);
      for (const side of [-1, 1]) {
        const [rx, rz] = loc(br.x, br.z, br.rot, side * (br.w / 2 - 0.2), 0);
        box(rx, by + 0.5, rz, 0.35, 1.0, br.len, br.rot, COL.concrete, 'box', false);
        // rail obstacle (thin)
        W.stampRect(rx, rz, 0.4, br.len, br.rot, (by + 1.0) - W.terrainAt(rx, rz));
      }
      for (let k = -2; k <= 2; k++) {
        const [px, pz] = loc(br.x, br.z, br.rot, 0, k * br.len / 5.5);
        const bot = W.terrainAt(px, pz) - 1;
        box(px, (by - 0.9 + bot) / 2, pz, br.w * 0.6, by - 0.9 - bot, 2.2, br.rot, COL.concrete, 'box', false);
      }
    }

    // ---------------- frontline trenches and minefields ----------------
    const lines = L === 'river' ? [] : [U.lerp(rowZ[0], rowZ[1], 0.45), U.lerp(rowZ[2], rowZ[1], 0.45)];
    if (L === 'river') { lines.push(rowZ[1] + 140, rowZ[1] - 140); }
    for (const lz of lines) {
      for (let seg = 0; seg < 5; seg++) {
        const cx = -700 + seg * 350 + rng.range(-60, 60);
        let czz = lz + rng.range(-40, 40);
        if (W.hasRiver) czz = W.riverZ(cx) + Math.sign(lz - rowZ[1]) * 140;
        if (objs.some((o) => U.dist(o.x, o.z, cx, czz) < o.r + 60)) continue;
        if (!okSpot(cx, czz, 4)) continue;
        trenchLine(zigzag(cx, czz, rng.range(70, 140), rng.range(-0.25, 0.25), 3.5), rng() < 0.6);
        if (rng() < 0.55) {
          const mz = czz + (lz < rowZ[1] ? 1 : -1) * rng.range(40, 70) * (W.hasRiver ? 1 : 1);
          const mf = { x: cx + rng.range(-40, 40), z: mz, r: rng.range(22, 34) };
          if (!objs.some((o) => U.dist(o.x, o.z, mf.x, mf.z) < o.r + mf.r + 30) && !nearRoad(mf.x, mf.z, mf.r + 4)) {
            W.minefields.push(mf);
            for (let k = 0; k < 6; k++) { const a = k / 6 * 6.28; W.signs.push([mf.x + Math.cos(a) * mf.r, mf.z + Math.sin(a) * mf.r]); }
          }
        }
      }
    }
    // signs as boxes
    for (const [sx, sz] of W.signs) { const y = gy(sx, sz); box(sx, y + 0.6, sz, 0.08, 1.2, 0.08, 0, COL.wood, 'box', false); box(sx, y + 1.15, sz, 0.6, 0.45, 0.05, rng() * 3, COL.red, 'box', false); }

    // ---------------- highway wrecks, farms, abandoned buildings ----------------
    for (const rd of W.roads) {
      if (rd.kind === 'runway') continue;
      for (let i = 4; i < rd.pts.length - 4; i += rng.int(10, 30)) {
        if (rng() < 0.45) continue;
        const p = rd.pts[i];
        if (objs.some((o) => U.dist(o.x, o.z, p[0], p[1]) < o.r + 10)) continue;
        if (W.onBridge(p[0], p[1]) || (W.hasRiver && Math.abs(p[1] - W.riverZ(p[0])) < 50)) continue;
        const q = rd.pts[i + 1];
        const rot = Math.atan2(-(q[1] - p[1]), q[0] - p[0]) + rng.range(-0.6, 0.6);
        const off = rng.range(-rd.w * 0.3, rd.w * 0.3);
        wreck(p[0] + off, p[1] + rng.range(-2, 2), rot, rng() < 0.25);
      }
    }
    for (let k = 0; k < 26; k++) {
      for (let t = 0; t < 15; t++) {
        const px = rng.range(-880, 880), pz = rng.range(-760, 760);
        if (objs.some((o) => U.dist(o.x, o.z, px, pz) < o.r + 80)) continue;
        if (!okSpot(px, pz, 14) || W.slopeAt(px, pz) > 0.25) continue;
        const rot = rng() * 3;
        if (rng() < 0.5) { house(px, pz, rot, { ruined: rng() < 0.6 }); if (rng() < 0.6) house(px + 14, pz + rng.range(-6, 6), rot, { ruined: rng() < 0.5 }); }
        else { bigHall(px, pz, rng.range(12, 18), rng.range(8, 11), 6, rot, COL.wood, false); fuelTank(px + 12, pz + 8, 2.5, 9); }
        for (let m = 0; m < 3; m++) { const [hx, hz] = loc(px, pz, rot, rng.range(-40, 40), rng.range(-40, 40)); if (okSpot(hx, hz, 4)) (L === 'highland' ? stoneWall : hedge)(hx, hz, rng.range(14, 30), rot + rng.int(0, 1) * Math.PI / 2); }
        break;
      }
    }
    // field walls & hedgerows for open-ground cover
    for (let k = 0; k < 70; k++) {
      const px = rng.range(-900, 900), pz = rng.range(-780, 780);
      if (objs.some((o) => U.dist(o.x, o.z, px, pz) < o.r + 20)) continue;
      if (!okSpot(px, pz, 6)) continue;
      const rot = rng() * Math.PI;
      if (rng() < 0.5) hedge(px, pz, rng.range(18, 45), rot); else stoneWall(px, pz, rng.range(10, 28), rot);
    }
    for (let k = 0; k < 140; k++) { const px = rng.range(-950, 950), pz = rng.range(-950, 950); if (okSpot(px, pz, 3)) rock(px, pz, rng.range(0.6, L === 'highland' ? 3 : 1.8)); }
    // shell craters (ground paint + small berms)
    for (let k = 0; k < 90; k++) {
      const px = rng.range(-850, 850), pz = rng.range(-650, 650);
      if (W.hasRiver && Math.abs(pz - W.riverZ(px)) < 45) continue;
      forVerts(px, pz, rng.range(5, 10), (vi, d) => { h[vi] -= 1.2 * (1 - d / 10); W.ground[vi] = GT.MUD; });
    }

    // ---------------- forests ----------------
    const treeNoise = U.makeNoise(seed + 999);
    let tries = 0;
    const maxTrees = 5200;
    while (W.trees.length < maxTrees && tries < 60000) {
      tries++;
      const px = rng.range(-990, 990), pz = rng.range(-990, 990);
      const n = treeNoise.fbm(px / 260, pz / 260, 4) + (L === 'highland' ? 0.12 : L === 'industrial' ? -0.08 : 0);
      const edge = Math.max(Math.abs(px), Math.abs(pz)) > 930;
      if (n < 0.12 && !edge && rng() > 0.004) continue;
      if (objs.some((o) => U.dist(o.x, o.z, px, pz) < o.r + (o.type === 'hq' ? 70 : 25))) continue;
      if (W.hasRiver && Math.abs(pz - W.riverZ(px)) < 30) continue;
      if (W.occAt(px, pz) > 0) continue;
      if (nearRoad(px, pz, 3)) continue;
      if (W.minefields.some((m) => U.dist(m.x, m.z, px, pz) < m.r)) continue;
      const kind = (L === 'highland' || gy(px, pz) > 40) ? (rng() < 0.75 ? 0 : 1) : (rng() < 0.35 ? 0 : 1);
      const s = rng.range(0.75, 1.35);
      W.trees.push({ x: px, z: pz, s, kind, y: gy(px, pz), alive: true });
      W.stampRect(px, pz, 0.8, 0.8, 0, 6 * s);
      const fi = (((pz + HALF) / 8) | 0) * 250 + (((px + HALF) / 8) | 0);
      W.fol[fi] = Math.min(255, W.fol[fi] + 55);
      if (rng() < 0.18) coverPts.push([px + 0.9, pz, 0, 0, 0.45]);
      // forest floor
      const vi = idx(px, pz); if (W.ground[vi] !== GT.DIRT && W.ground[vi] !== GT.CONCRETE) W.ground[vi] = GT.DRYGRASS;
    }
    // generic cover in objectives (rubble piles) & defensive positions
    for (const o of objs) {
      if (o.type === 'hq') continue;
      for (let k = 0; k < 6; k++) {
        const a = rng() * 6.28, r = rng.range(o.r * 0.3, o.r * 0.95);
        const px = o.x + Math.cos(a) * r, pz = o.z + Math.sin(a) * r;
        if (okSpot(px, pz, 2) && !W.onBridge(px, pz)) sandbags(px, pz, rng.range(4, 7), Math.PI / 2 - a);
      }
    }

    // spawn points per objective
    for (const o of objs) {
      for (let k = 0; k < 40; k++) {
        const a = rng() * 6.28, r = o.type === 'hq' ? rng.range(10, 70) : rng.range(5, o.r * 0.75);
        const px = o.x + Math.cos(a) * r, pz = o.z + Math.sin(a) * r;
        if (!W.blocked(px, pz) && W.waterDepth(px, pz) < 0.2) o.spawnPts.push([px, pz]);
      }
      if (!o.spawnPts.length) o.spawnPts.push([o.x, o.z]);
    }
    // vehicle parking fallback for HQ (free spots)
    for (let t = 0; t < 2; t++) W.parking[t] = W.parking[t].filter((p) => !W.blocked(p[0], p[1]) && !W.blocked(p[0] + 3, p[1]) && !W.blocked(p[0] - 3, p[1]));

    W.buildCoverIndex(coverPts);
    // objective defensive cover lists
    for (const o of objs) {
      const rr = o.r + 10;
      for (let i = 0; i < W.coverCount; i++) if (U.dist2(W.coverX[i], W.coverZ[i], o.x, o.z) < rr * rr) o.defPts.push(i);
    }
    W.bounds = 960;
    return W;
  };
})(typeof window !== 'undefined' ? window : globalThis);
