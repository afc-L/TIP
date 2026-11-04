// Simulation core: presentation hooks, soldier storage (structure-of-arrays) and spatial grids.
(function (G) {
  'use strict';
  const IF = G.IF, U = IF.U;

  // ---- presentation hooks (overridden by render/audio modules; no-ops when headless) ----
  const noop = function () {};
  IF.FX = IF.FX || {};
  for (const k of ['tracer', 'flash', 'explosion', 'impact', 'blood', 'smokePuff', 'dust', 'debris', 'scorch', 'smokeScreen', 'fireAt', 'muzzle', 'splash', 'flare', 'gore', 'pool'])
    if (!IF.FX[k]) IF.FX[k] = noop;
  IF.SFX = IF.SFX || {};
  for (const k of ['shot', 'explosion', 'whistle', 'crack', 'impact', 'shout', 'radio', 'vehicleFire', 'cannon', 'jet', 'hit', 'reload', 'empty', 'ui', 'thump'])
    if (!IF.SFX[k]) IF.SFX[k] = noop;

  const ST = (IF.ST = { DEAD: 0, ALIVE: 1, DOWNED: 2, MOUNTED: 3 });

  // ---- soldier storage ----
  function Soldiers(n) {
    this.n = n;
    const F = () => new Float32Array(n), I = () => new Int32Array(n).fill(-1), B = () => new Uint8Array(n);
    this.team = B(); this.role = B(); this.squad = new Int16Array(n).fill(-1); this.st = B(); this.slot = B();
    this.x = F(); this.y = F(); this.z = F(); this.yaw = F(); this.vx = F(); this.vz = F(); this.spd = F();
    this.hp = F(); this.stance = B(); this.gx = F(); this.gz = F(); this.mode = B();
    this.tgt = I(); this.tgtV = new Int16Array(n).fill(-1); this.tgtVis = F(); this.tgtT = F();
    this.fireCd = F(); this.burst = new Int16Array(n); this.mag = new Int16Array(n); this.reload = F();
    this.think = F(); this.perc = F(); this.sup = F(); this.cover = I(); this.downT = F();
    this.veh = new Int16Array(n).fill(-1); this.skill = F(); this.lastAtt = I(); this.anim = F();
    this.aimP = F(); this.spotT = F(); this.flash = F(); this.special = F(); this.rockets = B(); this.grenades = B();
    this.task = B(); this.taskTgt = I(); this.rescuer = I(); this.kills = new Uint16Array(n);
    this.sepX = F(); this.sepZ = F(); this.stuck = F(); this.lastFire = F(); this.alertT = F();
    this.threatX = F(); this.threatZ = F(); this.wade = F(); this.lean = F(); this.reloadAnim = F();
    this.uniform = new Int8Array(n).fill(-1);
  }
  IF.Soldiers = Soldiers;

  // ---- spatial grid (counting sort, rebuilt every frame) ----
  function Grid(cell, maxItems) {
    this.cell = cell; this.inv = 1 / cell;
    this.n = Math.ceil(2000 / cell);
    this.start = new Int32Array(this.n * this.n + 1);
    this.fill = new Int32Array(this.n * this.n + 1);
    this.items = new Int32Array(maxItems);
    this.cellOf = new Int32Array(maxItems);
    this.count = 0;
  }
  Grid.prototype.cellIndex = function (x, z) {
    let cx = ((x + 1000) * this.inv) | 0, cz = ((z + 1000) * this.inv) | 0;
    if (cx < 0) cx = 0; else if (cx >= this.n) cx = this.n - 1;
    if (cz < 0) cz = 0; else if (cz >= this.n) cz = this.n - 1;
    return cz * this.n + cx;
  };
  // filterFn(i) -> boolean
  Grid.prototype.build = function (S, accept) {
    const start = this.start, cellOf = this.cellOf, nc = this.n * this.n;
    start.fill(0);
    const N = S.n;
    for (let i = 0; i < N; i++) {
      if (!accept(i)) { cellOf[i] = -1; continue; }
      const c = this.cellIndex(S.x[i], S.z[i]);
      cellOf[i] = c; start[c + 1]++;
    }
    for (let c = 0; c < nc; c++) start[c + 1] += start[c];
    const fill = this.fill; fill.set(start);
    for (let i = 0; i < N; i++) { const c = cellOf[i]; if (c >= 0) this.items[fill[c]++] = i; }
    this.count = start[nc];
  };
  // iterate items within radius: fn(i, d2) ; returns early if fn returns true
  Grid.prototype.query = function (S, x, z, r, fn) {
    const inv = this.inv, n = this.n;
    const cx0 = Math.max(0, ((x - r + 1000) * inv) | 0), cx1 = Math.min(n - 1, ((x + r + 1000) * inv) | 0);
    const cz0 = Math.max(0, ((z - r + 1000) * inv) | 0), cz1 = Math.min(n - 1, ((z + r + 1000) * inv) | 0);
    const r2 = r * r, start = this.start, items = this.items, SX = S.x, SZ = S.z;
    for (let cz = cz0; cz <= cz1; cz++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const c = cz * n + cx;
        for (let k = start[c], e = start[c + 1]; k < e; k++) {
          const i = items[k];
          const dx = SX[i] - x, dz = SZ[i] - z, d2 = dx * dx + dz * dz;
          if (d2 <= r2 && fn(i, d2)) return;
        }
      }
    }
  };
  Grid.prototype.countIn = function (S, x, z, r, teamFilter) {
    let c0 = 0, c1 = 0;
    this.query(S, x, z, r, (i) => { if (S.team[i] === 0) c0++; else c1++; });
    return [c0, c1];
  };
  // ring search for nearest items, writes up to k indices into out (sorted by distance). returns count
  const _cand = new Int32Array(64), _cd = new Float32Array(64);
  Grid.prototype.nearest = function (S, x, z, maxR, k, out, outD, skip) {
    const inv = this.inv, n = this.n, cell = this.cell;
    const ccx = ((x + 1000) * inv) | 0, ccz = ((z + 1000) * inv) | 0;
    const rings = Math.ceil(maxR / cell) + 1;
    let found = 0;
    const maxR2 = maxR * maxR, start = this.start, items = this.items;
    for (let r = 0; r <= rings; r++) {
      for (let dz = -r; dz <= r; dz++) {
        const cz = ccz + dz; if (cz < 0 || cz >= n) continue;
        const edge = dz === -r || dz === r;
        for (let dx = -r; dx <= r; dx += edge ? 1 : 2 * r || 1) {
          const cx = ccx + dx; if (cx < 0 || cx >= n) continue;
          const c = cz * n + cx;
          for (let q = start[c], e = start[c + 1]; q < e; q++) {
            const i = items[q];
            if (skip && skip(i)) continue;
            const ddx = S.x[i] - x, ddz = S.z[i] - z, d2 = ddx * ddx + ddz * ddz;
            if (d2 > maxR2) continue;
            // insertion into sorted candidate list (size k)
            if (found < k) { let p = found++; while (p > 0 && _cd[p - 1] > d2) { _cd[p] = _cd[p - 1]; _cand[p] = _cand[p - 1]; p--; } _cd[p] = d2; _cand[p] = i; }
            else if (d2 < _cd[k - 1]) { let p = k - 1; while (p > 0 && _cd[p - 1] > d2) { _cd[p] = _cd[p - 1]; _cand[p] = _cand[p - 1]; p--; } _cd[p] = d2; _cand[p] = i; }
          }
          if (r === 0) break;
        }
      }
      // done if we have k candidates all closer than the next ring's minimum distance
      if (found >= k && _cd[k - 1] <= (r * cell) * (r * cell)) break;
    }
    for (let q = 0; q < found; q++) { out[q] = _cand[q]; if (outD) outD[q] = Math.sqrt(_cd[q]); }
    return found;
  };
  IF.Grid = Grid;
})(typeof window !== 'undefined' ? window : globalThis);
