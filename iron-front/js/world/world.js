// World data container and spatial queries (terrain height, obstacles, line of sight, cover).
// Pure data — no rendering — so the battle simulation can run headless.
(function (G) {
  'use strict';
  const IF = G.IF, U = IF.U;

  const GRID = 321;                 // terrain vertices per side
  const SIZE = 2000, HALF = 1000;
  const CELL = SIZE / (GRID - 1);   // 6.25 m
  const OCC = 2000;                 // 1 m obstacle grid
  const FOL = 250, FOLC = 8;        // foliage density grid (8 m)
  const CVC = 16, CVN = 125;        // cover point grid

  function World() {
    this.GRID = GRID; this.CELL = CELL; this.SIZE = SIZE; this.HALF = HALF;
    this.h = new Float32Array(GRID * GRID);
    this.ground = new Uint8Array(GRID * GRID);       // ground type per vertex
    this.occ = new Uint8Array(OCC * OCC);            // obstacle height in decimetres
    this.fol = new Uint8Array(FOL * FOL);            // foliage density 0..255
    this.waterY = -100; this.hasRiver = false; this.riverPts = null;
    this.boxes = []; this.buildings = []; this.trees = []; this.roads = []; this.bridges = []; this.crossings = [];
    this.objectives = []; this.minefields = []; this.signs = []; this.parking = [[], []]; this.helipads = [[], []];
    this.coverX = null; this.coverZ = null; this.coverNX = null; this.coverNZ = null; this.coverQ = null; this.coverCount = 0;
    this.coverCellStart = null; this.coverCellItems = null; this.coverOwner = null;
    this.smokes = [];           // active smoke screens {x,y,z,r,t}
    this.dangerZones = [];      // {x,z,r,t,team} barrage zones / fires
    this.scorch = [];           // queued scorch marks for the renderer
    this.dirtyBoxes = false;
    this.layout = 'river';
  }
  IF.World = World;
  World.prototype.GRIDSZ = GRID;

  // ---------- terrain ----------
  World.prototype.terrainAt = function (x, z) {
    let fx = (x + HALF) / CELL, fz = (z + HALF) / CELL;
    if (fx < 0) fx = 0; else if (fx > GRID - 1.001) fx = GRID - 1.001;
    if (fz < 0) fz = 0; else if (fz > GRID - 1.001) fz = GRID - 1.001;
    const ix = fx | 0, iz = fz | 0, tx = fx - ix, tz = fz - iz;
    const h = this.h, i = iz * GRID + ix;
    const a = h[i], b = h[i + 1], c = h[i + GRID], d = h[i + GRID + 1];
    // match the triangle split used by PlaneGeometry (a-c-b, c-d-b)
    if (tx + tz < 1) return a + (b - a) * tx + (c - a) * tz;
    return d + (c - d) * (1 - tx) + (b - d) * (1 - tz);
  };
  // walkable surface (bridge decks override terrain)
  World.prototype.groundAt = function (x, z) {
    let y = this.terrainAt(x, z);
    const br = this.bridges;
    for (let k = 0; k < br.length; k++) {
      const b = br[k];
      const dx = x - b.x, dz = z - b.z;
      const lx = dx * b.cos - dz * b.sin, lz = dx * b.sin + dz * b.cos;
      if (lx > -b.w * 0.5 && lx < b.w * 0.5 && lz > -b.len * 0.5 && lz < b.len * 0.5) { if (b.y > y) y = b.y; }
    }
    return y;
  };
  World.prototype.onBridge = function (x, z) {
    const br = this.bridges;
    for (let k = 0; k < br.length; k++) {
      const b = br[k];
      const dx = x - b.x, dz = z - b.z;
      const lx = dx * b.cos - dz * b.sin, lz = dx * b.sin + dz * b.cos;
      if (lx > -b.w * 0.5 && lx < b.w * 0.5 && lz > -b.len * 0.5 && lz < b.len * 0.5) return true;
    }
    return false;
  };
  World.prototype.waterDepth = function (x, z) {
    if (!this.hasRiver) return 0;
    const t = this.terrainAt(x, z);
    if (t >= this.waterY) return 0;
    if (this.onBridge(x, z)) return 0;
    return this.waterY - t;
  };
  World.prototype.slopeAt = function (x, z) {
    const e = 2;
    const dx = this.terrainAt(x + e, z) - this.terrainAt(x - e, z);
    const dz = this.terrainAt(x, z + e) - this.terrainAt(x, z - e);
    return Math.sqrt(dx * dx + dz * dz) / (2 * e);
  };
  World.prototype.groundTypeAt = function (x, z) {
    const ix = U.clamp(Math.round((x + HALF) / CELL), 0, GRID - 1), iz = U.clamp(Math.round((z + HALF) / CELL), 0, GRID - 1);
    return this.ground[iz * GRID + ix];
  };

  // ---------- obstacles ----------
  World.prototype.occAt = function (x, z) {
    const ix = (x + HALF) | 0, iz = (z + HALF) | 0;
    if (ix < 0 || iz < 0 || ix >= OCC || iz >= OCC) return 255;
    return this.occ[iz * OCC + ix];
  };
  // obstacle top above ground (metres)
  World.prototype.obstacleH = function (x, z) { return this.occAt(x, z) * 0.1; };
  World.prototype.blocked = function (x, z, vault) {
    if (x < -HALF + 15 || x > HALF - 15 || z < -HALF + 15 || z > HALF - 15) return true;
    const o = this.occAt(x, z);
    return o > (vault ? 12 : 4);
  };
  World.prototype.stampRect = function (cx, cz, w, d, rot, hgt, mode) {
    // mode: undefined -> max, 'clear' -> 0
    const c = Math.cos(rot), s = Math.sin(rot);
    const ex = (Math.abs(c) * w + Math.abs(s) * d) * 0.5 + 1, ez = (Math.abs(s) * w + Math.abs(c) * d) * 0.5 + 1;
    const x0 = Math.max(0, Math.floor(cx - ex + HALF)), x1 = Math.min(OCC - 1, Math.ceil(cx + ex + HALF));
    const z0 = Math.max(0, Math.floor(cz - ez + HALF)), z1 = Math.min(OCC - 1, Math.ceil(cz + ez + HALF));
    const v = Math.min(255, Math.max(0, Math.round(hgt * 10)));
    const hw = w * 0.5 + 0.01, hd = d * 0.5 + 0.01;
    for (let iz = z0; iz <= z1; iz++) {
      const pz = iz - HALF + 0.5 - cz;
      for (let ix = x0; ix <= x1; ix++) {
        const px = ix - HALF + 0.5 - cx;
        // rotate into local frame (rotation about Y: local = R(-rot) * p)
        const lx = px * c - pz * s, lz = px * s + pz * c;
        if (lx >= -hw && lx <= hw && lz >= -hd && lz <= hd) {
          const k = iz * OCC + ix;
          if (mode === 'clear') this.occ[k] = 0; else if (v > this.occ[k]) this.occ[k] = v;
        }
      }
    }
  };
  World.prototype.folAt = function (x, z) {
    const ix = ((x + HALF) / FOLC) | 0, iz = ((z + HALF) / FOLC) | 0;
    if (ix < 0 || iz < 0 || ix >= FOL || iz >= FOL) return 0;
    return this.fol[iz * FOL + ix];
  };

  // Line of sight between two eye points. Returns 0 (blocked) .. 1 (clear) visibility.
  World.prototype.los = function (x1, y1, z1, x2, y2, z2, ignoreSmoke) {
    const dx = x2 - x1, dy = y2 - y1, dz = z2 - z1;
    const L = Math.sqrt(dx * dx + dz * dz);
    if (L < 1) return 1;
    const steps = Math.min(140, Math.ceil(L / 3));
    let foliage = 0, vis = 1;
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      const x = x1 + dx * t, z = z1 + dz * t, y = y1 + dy * t;
      const g = this.terrainAt(x, z);
      if (y < g + 0.15) return 0;
      const o = this.occAt(x, z);
      if (o > 0 && y < g + o * 0.1) return 0;
      const f = this.fol[(((z + HALF) / FOLC) | 0) * FOL + (((x + HALF) / FOLC) | 0)] || 0;
      if (f > 0 && y < g + 14) { foliage += f * (L / steps) / 255; if (foliage > 22) return 0; }
    }
    if (foliage > 0) vis = Math.max(0.15, 1 - foliage / 26);
    if (!ignoreSmoke) {
      const sm = this.smokes;
      for (let k = 0; k < sm.length; k++) {
        const c = sm[k];
        const d = U.segDist(c.x, c.z, x1, z1, x2, z2);
        if (d < c.r) { vis *= 0.12 + 0.88 * (d / c.r); if (vis < 0.15) return 0; }
      }
    }
    return vis;
  };

  // Ray march for bullets. Returns distance to first solid hit (terrain/obstacle) or maxD.
  // out.kind: 0 none, 1 terrain, 2 obstacle, 3 water
  World.prototype.rayMarch = function (ox, oy, oz, dx, dy, dz, maxD, out) {
    let step = 0.5, t = 0.25;
    while (t < maxD) {
      const x = ox + dx * t, y = oy + dy * t, z = oz + dz * t;
      if (x < -HALF || x > HALF || z < -HALF || z > HALF) break;
      const g = this.groundAt(x, z);
      if (y < g) { out.kind = 1; out.d = t; out.x = x; out.y = g; out.z = z; return t; }
      if (this.hasRiver && y < this.waterY && g < this.waterY) { out.kind = 3; out.d = t; out.x = x; out.y = this.waterY; out.z = z; return t; }
      const o = this.occAt(x, z);
      if (o > 0 && y < this.terrainAt(x, z) + o * 0.1) { out.kind = 2; out.d = t; out.x = x; out.y = y; out.z = z; return t; }
      t += step;
      if (t > 60) step = 1.0;
      if (t > 250) step = 2.0;
    }
    out.kind = 0; out.d = maxD; return maxD;
  };

  // ---------- cover ----------
  World.prototype.buildCoverIndex = function (pts) {
    const n = pts.length;
    this.coverCount = n;
    this.coverX = new Float32Array(n); this.coverZ = new Float32Array(n);
    this.coverNX = new Float32Array(n); this.coverNZ = new Float32Array(n); this.coverQ = new Float32Array(n);
    this.coverOwner = new Int32Array(n).fill(-1);
    const cnt = new Int32Array(CVN * CVN + 1);
    const cellOf = new Int32Array(n);
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      this.coverX[i] = p[0]; this.coverZ[i] = p[1]; this.coverNX[i] = p[2]; this.coverNZ[i] = p[3]; this.coverQ[i] = p[4];
      const cx = U.clamp(((p[0] + HALF) / CVC) | 0, 0, CVN - 1), cz = U.clamp(((p[1] + HALF) / CVC) | 0, 0, CVN - 1);
      cellOf[i] = cz * CVN + cx; cnt[cellOf[i] + 1]++;
    }
    for (let c = 0; c < CVN * CVN; c++) cnt[c + 1] += cnt[c];
    const start = cnt.slice(); const items = new Int32Array(n); const fill = cnt.slice();
    for (let i = 0; i < n; i++) items[fill[cellOf[i]]++] = i;
    this.coverCellStart = start; this.coverCellItems = items;
  };
  // best free cover point near (x,z) within r that protects against threat direction (tx,tz). Returns index or -1.
  World.prototype.findCover = function (x, z, r, tx, tz, owner, prefX, prefZ) {
    if (!this.coverCount) return -1;
    const cx0 = U.clamp(((x - r + HALF) / CVC) | 0, 0, CVN - 1), cx1 = U.clamp(((x + r + HALF) / CVC) | 0, 0, CVN - 1);
    const cz0 = U.clamp(((z - r + HALF) / CVC) | 0, 0, CVN - 1), cz1 = U.clamp(((z + r + HALF) / CVC) | 0, 0, CVN - 1);
    let best = -1, bestS = -1e9;
    const hasT = tx !== undefined && tx !== null;
    const r2 = r * r;
    for (let cz = cz0; cz <= cz1; cz++) for (let cx = cx0; cx <= cx1; cx++) {
      const c = cz * CVN + cx;
      for (let k = this.coverCellStart[c]; k < this.coverCellStart[c + 1]; k++) {
        const i = this.coverCellItems[k];
        const own = this.coverOwner[i];
        if (own >= 0 && own !== owner) continue;
        const px = this.coverX[i], pz = this.coverZ[i];
        const d2 = U.dist2(px, pz, x, z);
        if (d2 > r2) continue;
        let s = this.coverQ[i] * 10 - Math.sqrt(d2) * 0.35;
        if (prefX !== undefined) s -= Math.sqrt(U.dist2(px, pz, prefX, prefZ)) * 0.25;
        if (hasT) {
          const nx = this.coverNX[i], nz = this.coverNZ[i];
          if (nx !== 0 || nz !== 0) {
            let ddx = tx - px, ddz = tz - pz; const L = Math.sqrt(ddx * ddx + ddz * ddz) || 1; ddx /= L; ddz /= L;
            const dot = ddx * nx + ddz * nz; // want threat on the far side: dot < 0
            s += -dot * 8;
          } else s += 5;
        }
        if (s > bestS) { bestS = s; best = i; }
      }
    }
    return best;
  };
  // protection factor (0 = none .. ~0.8) a cover point gives against shooter at sx,sz
  World.prototype.coverProtection = function (ci, sx, sz) {
    if (ci < 0) return 0;
    const px = this.coverX[ci], pz = this.coverZ[ci];
    let dx = sx - px, dz = sz - pz; const L = Math.sqrt(dx * dx + dz * dz) || 1;
    if (L < 6) return 0.1;
    dx /= L; dz /= L;
    const nx = this.coverNX[ci], nz = this.coverNZ[ci], q = this.coverQ[ci];
    if (nx === 0 && nz === 0) return 0.65 * q;
    const dot = dx * nx + dz * nz;
    if (dot < -0.2) return 0.78 * q;
    if (dot < 0.3) return 0.35 * q;
    return 0;
  };

  // River side: -1 north, +1 south, 0 no river
  World.prototype.riverSide = function (x, z) {
    if (!this.hasRiver) return 0;
    return z > this.riverZ(x) ? 1 : -1;
  };
  World.prototype.riverZ = function (x) {
    const p = this.riverPts; // sampled every 10m from -1000
    const f = U.clamp((x + HALF) / 10, 0, p.length - 1.001);
    const i = f | 0;
    return p[i] + (p[i + 1] - p[i]) * (f - i);
  };

  // Plan a coarse route for ground units: crossings over the river, detours around danger.
  // vehicle: only bridges allowed (fords are fine for infantry and tracked vehicles).
  World.prototype.route = function (x1, z1, x2, z2, vehicle, out) {
    out.length = 0;
    // leave / enter headquarters through the main gate
    for (let h = 0; h < 2; h++) {
      const o = this.objectives[h];
      if (!o || !o.gate) continue;
      const in1 = U.dist2(x1, z1, o.x, o.z) < 112 * 112, in2 = U.dist2(x2, z2, o.x, o.z) < 112 * 112;
      if (in1 && !in2) { out.push([o.x + (o.gate[1] < o.z ? 0 : 0), o.z + (o.gate[1] - o.z) * 0.55]); out.push(o.gate.slice()); x1 = o.gate[0]; z1 = o.gate[1]; }
    }
    const enterHQ = this.objectives.slice(0, 2).find((o) => o && o.gate && U.dist2(x2, z2, o.x, o.z) < 112 * 112 && U.dist2(x1, z1, o.x, o.z) >= 112 * 112);
    if (enterHQ) { var _final = [x2, z2]; x2 = enterHQ.gate[0]; z2 = enterHQ.gate[1]; }
    const s1 = this.riverSide(x1, z1), s2 = this.riverSide(x2, z2);
    if (s1 !== 0 && s1 !== s2) {
      let best = null, bd = 1e9;
      for (const c of this.crossings) {
        if (vehicle && c.kind !== 'bridge') continue;
        const d = U.dist(x1, z1, c.x, c.z) + U.dist(c.x, c.z, x2, z2);
        if (d < bd) { bd = d; best = c; }
      }
      if (best) {
        // approach along the crossing axis
        out.push([best.x + best.ax * s1 * best.reach, best.z + best.az * s1 * best.reach]);
        out.push([best.x - best.ax * s1 * best.reach, best.z - best.az * s1 * best.reach]);
      }
    }
    out.push([x2, z2]);
    if (enterHQ) { out.push([enterHQ.x, enterHQ.z + (enterHQ.gate[1] - enterHQ.z) * 0.55]); out.push(_final); }
    // detour around minefields (at most one detour per minefield)
    if (this.minefields.length) {
      const used = new Set();
      let px = x1, pz = z1;
      const tmp = {};
      for (let i = 0; i < out.length && out.length < 12; i++) {
        const q = out[i];
        for (let k = 0; k < this.minefields.length; k++) {
          if (used.has(k)) continue;
          const m = this.minefields[k];
          const d = U.segDist(m.x, m.z, px, pz, q[0], q[1], tmp);
          if (d < m.r + 6 && U.dist(q[0], q[1], m.x, m.z) > m.r + 2 && U.dist(px, pz, m.x, m.z) > m.r + 2) {
            used.add(k);
            let nx = tmp.x - m.x, nz = tmp.z - m.z;
            if (nx * nx + nz * nz < 0.25) { nx = -(q[1] - pz); nz = q[0] - px; }
            const L2 = Math.sqrt(nx * nx + nz * nz) || 1;
            out.splice(i, 0, [m.x + (nx / L2) * (m.r + 16), m.z + (nz / L2) * (m.r + 16)]);
            break;
          }
        }
        px = out[i][0]; pz = out[i][1];
      }
    }
    return out;
  };

  World.prototype.inMinefield = function (x, z) {
    for (const m of this.minefields) if (U.dist2(x, z, m.x, m.z) < m.r * m.r) return m;
    return null;
  };
  World.prototype.dangerAt = function (x, z, team) {
    let d = 0;
    for (const zn of this.dangerZones) {
      if (zn.team !== team && zn.team !== -1) continue; // own-team barrages and neutral hazards
      const r = zn.r; if (U.dist2(x, z, zn.x, zn.z) < r * r) d = Math.max(d, zn.level || 1);
    }
    return d;
  };

  // nearest free (walkable, dry) spot near x,z
  World.prototype.freeSpot = function (x, z, rng) {
    const R = rng || Math.random;
    for (let k = 0; k < 30; k++) {
      const a = R() * Math.PI * 2, r = k * 1.5;
      const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      if (!this.blocked(px, pz) && this.waterDepth(px, pz) < 0.3) return [px, pz];
    }
    return [x, z];
  };

  World.prototype.addSmoke = function (x, y, z, r, t) { this.smokes.push({ x, y, z, r, t, max: t }); };
  World.prototype.update = function (dt) {
    for (let i = this.smokes.length - 1; i >= 0; i--) { const s = this.smokes[i]; s.t -= dt; if (s.t <= 0) this.smokes.splice(i, 1); }
    for (let i = this.dangerZones.length - 1; i >= 0; i--) { const s = this.dangerZones[i]; s.t -= dt; if (s.t <= 0) this.dangerZones.splice(i, 1); }
  };

  // Destroy a building: swap intact boxes for ruins and update obstacles
  World.prototype.damageBuilding = function (b, dmg) {
    if (b.ruined || !b.destructible) return false;
    b.hp -= dmg;
    if (b.hp > 0) return false;
    b.ruined = true;
    for (const i of b.intact) this.boxes[i].hidden = true;
    for (const i of b.ruin) this.boxes[i].hidden = false;
    this.stampRect(b.x, b.z, b.w + 0.2, b.d + 0.2, b.rot, 0, 'clear');
    for (const i of b.ruin) { const bx = this.boxes[i]; if (bx.solid) this.stampRect(bx.x, bx.z, bx.sx, bx.sz, bx.rot, bx.y + bx.sy / 2 - this.terrainAt(bx.x, bx.z)); }
    this.dirtyBoxes = true;
    IF.emit('buildingDestroyed', b);
    return true;
  };
  World.prototype.buildingsNear = function (x, z, r) {
    const out = [];
    for (const b of this.buildings) {
      if (b.ruined || !b.destructible) continue;
      const rr = r + Math.max(b.w, b.d) * 0.6;
      if (U.dist2(x, z, b.x, b.z) < rr * rr) out.push(b);
    }
    return out;
  };
})(typeof window !== 'undefined' ? window : globalThis);
