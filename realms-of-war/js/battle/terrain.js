// Battlefield generation: heightmap, navigation grid (cells with movement flags), scenery and siege walls.
(function () {
  const RW = window.RW;
  const U = RW.util;

  const F = { BLOCK: 1, FOREST: 2, WATER: 4, WALL: 8, GATE: 16, ROAD: 32, DEEP: 64, LAVA: 128 };

  function smooth(e0, e1, x) { const t = U.clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); }
  function gauss(x, z, cx, cz, r, h) { const d2 = ((x - cx) ** 2 + (z - cz) ** 2) / (r * r); return h * Math.exp(-d2 * 2); }

  class BattleMap {
    constructor(type, seed, opts = {}) {
      this.type = type;
      this.seed = seed;
      this.size = 240; this.half = 120; this.cell = 2; this.n = 120; this.vn = 121;
      this.h = new Float32Array(this.vn * this.vn);
      this.flags = new Uint8Array(this.n * this.n);
      this.rng = U.makeRng(seed);
      this.noise = U.makeNoise(seed);
      this.noise2 = U.makeNoise(seed + 77);
      this.trees = []; this.rocks = []; this.houses = []; this.walls = []; this.towers = []; this.pillars = [];
      this.gates = []; this.gateOf = new Int8Array(this.n * this.n).fill(-1); this.breaches = [];
      this.capture = null; this.temple = null; this.bridge = null; this.waterLevel = null;
      this.attackerSide = opts.attackerSide == null ? 1 : opts.attackerSide;
      this.defenderSide = 1 - this.attackerSide;
      this.deploy = {
        south: { x0: -70, x1: 70, z0: 58, z1: 104 },
        north: { x0: -70, x1: 70, z0: -104, z1: -58 },
      };
      this.generate();
    }

    // ------------------------------------------------------------ queries
    vi(i, j) { return j * this.vn + i; }
    heightAt(x, z) {
      const fx = U.clamp((x + this.half) / this.cell, 0, this.n - 0.001);
      const fz = U.clamp((z + this.half) / this.cell, 0, this.n - 0.001);
      const i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j;
      const h = this.h, vn = this.vn;
      const a = h[j * vn + i], b = h[j * vn + i + 1], c = h[(j + 1) * vn + i], d = h[(j + 1) * vn + i + 1];
      return a + (b - a) * tx + (c - a) * tz + (a - b - c + d) * tx * tz;
    }
    cellX(x) { return U.clamp(Math.floor((x + this.half) / this.cell), 0, this.n - 1); }
    cellZ(z) { return U.clamp(Math.floor((z + this.half) / this.cell), 0, this.n - 1); }
    cellIdx(x, z) { return this.cellZ(z) * this.n + this.cellX(x); }
    cellCenter(idx) { const i = idx % this.n, j = (idx / this.n) | 0; return { x: -this.half + (i + 0.5) * this.cell, z: -this.half + (j + 0.5) * this.cell }; }
    // First intact gate (compatibility helper) and nearest intact gate.
    get gate() { return this.gates.find((g) => g.hp > 0) || this.gates[0] || null; }
    nearestGate(x, z) {
      let best = null, bd = Infinity;
      for (const g of this.gates) { if (g.hp <= 0) continue; const d = Math.hypot(g.x - x, g.z - z); if (d < bd) { bd = d; best = g; } }
      return best;
    }
    blockedIdx(idx, side) {
      const f = this.flags[idx];
      if (f & (F.BLOCK | F.DEEP | F.LAVA)) return true;
      // Defenders can walk the wall tops; nobody else can cross a wall except through a breach.
      if (f & F.WALL) return side !== this.defenderSide || !this.siegeWalls;
      if (f & F.GATE) { const g = this.gates[this.gateOf[idx]]; if (g && g.hp > 0 && side === this.attackerSide) return true; }
      return false;
    }
    onWall(x, z) { return this.siegeWalls && (this.flags[this.cellIdx(x, z)] & F.WALL) !== 0; }
    // A docked siege tower opens the wall at x for everyone.
    breach(x) {
      if (!this.siegeWalls) return;
      for (let j = 0; j < this.n; j++) for (let i = 0; i < this.n; i++) {
        const idx = j * this.n + i;
        if (!(this.flags[idx] & F.WALL)) continue;
        const cx = -this.half + (i + 0.5) * this.cell;
        if (Math.abs(cx - x) <= 3.5) this.flags[idx] = F.ROAD;
      }
      this.breaches.push(x);
    }
    blocked(x, z, side) {
      if (x < -this.half + 1 || x > this.half - 1 || z < -this.half + 1 || z > this.half - 1) return true;
      return this.blockedIdx(this.cellIdx(x, z), side);
    }
    flagAt(x, z) { return this.flags[this.cellIdx(x, z)]; }
    inForest(x, z) { return (this.flags[this.cellIdx(x, z)] & F.FOREST) !== 0; }
    // Movement multiplier for a unit category at a position.
    speedMul(x, z, cat) {
      const f = this.flags[this.cellIdx(x, z)];
      let m = 1;
      if (f & F.ROAD) return 1.05;
      if (f & F.FOREST) m *= cat === 'cav' || cat === 'monster' || cat === 'siege' ? 0.55 : 0.75;
      if (f & F.WATER) m *= 0.5;
      if (this.type === 'snow' || this.type === 'desert') m *= 0.93;
      return m;
    }
    // Straight-line walkability test sampled along the segment.
    lineClear(x0, z0, x1, z1, side) {
      const d = Math.hypot(x1 - x0, z1 - z0);
      const steps = Math.ceil(d / (this.cell * 0.5));
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        if (this.blocked(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, side)) return false;
      }
      return true;
    }
    // Nearest walkable point (spiral search over cells).
    nearestFree(x, z, side) {
      if (!this.blocked(x, z, side)) return { x, z };
      const ci = this.cellX(x), cj = this.cellZ(z);
      for (let r = 1; r < 40; r++) {
        let best = null, bd = Infinity;
        for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
          if (Math.abs(di) !== r && Math.abs(dj) !== r) continue;
          const i = ci + di, j = cj + dj;
          if (i < 1 || j < 1 || i >= this.n - 1 || j >= this.n - 1) continue;
          if (this.blockedIdx(j * this.n + i, side)) continue;
          const c = this.cellCenter(j * this.n + i);
          const dd = (c.x - x) ** 2 + (c.z - z) ** 2;
          if (dd < bd) { bd = dd; best = c; }
        }
        if (best) return best;
      }
      return { x, z };
    }
    deployZone(isNorth) { return isNorth ? this.deploy.north : this.deploy.south; }

    // ------------------------------------------------------------ generation
    generate() {
      const t = this.type, n = this.n, vn = this.vn, half = this.half, cell = this.cell;
      const rng = this.rng, noise = this.noise, noise2 = this.noise2;
      const base = (x, z) => (noise(x * 0.012 + 10, z * 0.012 + 10, 3) - 0.5) * 7 + (noise2(x * 0.06, z * 0.06, 2) - 0.5) * 1.2;

      // River geometry
      const rPhase = rng() * 6;
      const riverZ = (x) => 10 * Math.sin(x * 0.025 + rPhase) + 5 * Math.sin(x * 0.061 + rPhase * 2);
      const fords = [-70 + rng() * 20, 50 + rng() * 25];
      const bridgeX = -15 + rng() * 30;
      // Pass geometry
      const passPhase = rng() * 6;
      const passCx = (z) => 14 * Math.sin(z * 0.035 + passPhase);
      const passW = (z) => 13 + Math.max(0, Math.abs(z) - 38) * 1.4;
      const sidePathX = rng() < 0.5 ? -84 : 84;
      // Hills
      const hillA = { x: -40 + rng() * 80, z: 40 + rng() * 15 };
      const hillB = { x: -40 + rng() * 80, z: -40 - rng() * 15 };
      const hillC = { x: rng() < 0.5 ? -75 : 75, z: -15 + rng() * 30 };
      // Volcanic lava flows with crossings
      const lavas = [];
      for (const zc of [-22, 24]) { const ph = rng() * 6, gaps = [-70 + rng() * 25, -10 + rng() * 20, 50 + rng() * 25]; lavas.push({ z: (x) => zc + 7 * Math.sin(x * 0.03 + ph), gaps }); }
      this.lavas = lavas;
      const bumps = [];
      for (let i = 0; i < 4; i++) bumps.push({ x: -100 + rng() * 200, z: -60 + rng() * 120, r: 18 + rng() * 20, h: 2 + rng() * 3.5 });

      const H = (x, z) => {
        let h = base(x, z);
        if (t === 'grassland') { for (const b of bumps) h += gauss(x, z, b.x, b.z, b.r, b.h); }
        else if (t === 'forest') { h *= 0.8; for (const b of bumps) h += gauss(x, z, b.x, b.z, b.r, b.h * 0.6); }
        else if (t === 'hills') {
          h += gauss(x, z, hillA.x, hillA.z, 38, 13) + gauss(x, z, hillB.x, hillB.z, 38, 13) + gauss(x, z, hillC.x, hillC.z, 30, 10);
        } else if (t === 'river') {
          h = 1.4 + h * 0.45;
          const d = Math.abs(z - riverZ(x));
          const bank = smooth(16, 5, d);
          h = U.lerp(h, -2.8, bank);
          for (const fx of fords) if (Math.abs(x - fx) < 8) h = Math.max(h, U.lerp(h, -1.45, smooth(9, 5, Math.abs(x - fx))));
          if (Math.abs(x - bridgeX) < 5 && d < 16) h = Math.max(h, 0.15);
        } else if (t === 'pass') {
          const open = smooth(78, 58, Math.abs(z));
          const m1 = Math.abs(x - passCx(z)) - passW(z);
          const m2 = Math.abs(x - sidePathX) - 4.5;
          const m = Math.min(m1, Math.abs(z) < 72 ? m2 : 99);
          if (m > 0) h += Math.min(30, m * 1.7) * open + noise(x * 0.1, z * 0.1) * 4 * open;
        } else if (t === 'siege') {
          h *= 0.45;
          if (z < -30) h = U.lerp(h, 1.5, smooth(-30, -45, z));
        } else if (t === 'snow') {
          h = h * 1.2 + gauss(x, z, hillA.x, hillA.z, 30, 8) + gauss(x, z, hillB.x, hillB.z, 30, 8);
          const side = Math.abs(x) - 70;
          if (side > 0) h += Math.min(26, side * 1.4) * smooth(-90, -60, -Math.abs(z) - 10) + noise(x * 0.1, z * 0.1) * 3;
        } else if (t === 'ancientforest') { h *= 0.7; for (const b of bumps) h += gauss(x, z, b.x, b.z, b.r, b.h * 0.5); }
        else if (t === 'volcanic') {
          h = h * 1.1 + gauss(x, z, hillC.x, hillC.z, 26, 9);
          for (const L of lavas) { const d = Math.abs(z - L.z(x)); if (d < 7 && !L.gaps.some((g) => Math.abs(x - g) < 9)) h -= (7 - d) * 0.25; }
        } else if (t === 'desert') {
          h = h * 0.5 + Math.sin(x * 0.05 + z * 0.02) * 2.2 + Math.sin(z * 0.07 - x * 0.03) * 1.2;
        } else if (t === 'courtyard') {
          h = h * 0.15 + 1;
        } else if (t === 'temple') {
          h *= 0.5;
          const d = Math.max(Math.abs(x), Math.abs(z) * 1.25);
          h = U.lerp(h, 5.5, smooth(30, 22, d));
        }
        // Flatten the edges of deployment zones a little.
        return h;
      };
      for (let j = 0; j < vn; j++) for (let i = 0; i < vn; i++) this.h[j * vn + i] = H(-half + i * cell, -half + j * cell);

      // Cell flags
      const forestNoise = U.makeNoise(this.seed + 5);
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const idx = j * n + i;
        const x = -half + (i + 0.5) * cell, z = -half + (j + 0.5) * cell;
        let f = 0;
        // Cliffs: steep cells are impassable.
        const a = this.h[j * vn + i], b = this.h[j * vn + i + 1], c = this.h[(j + 1) * vn + i], d = this.h[(j + 1) * vn + i + 1];
        const slope = Math.max(a, b, c, d) - Math.min(a, b, c, d);
        if (slope > 2.6) f |= F.BLOCK;
        // Forests
        const inDeploy = Math.abs(z) > 56 && Math.abs(x) < 72;
        const fv = forestNoise(x * 0.025, z * 0.025, 3);
        let thr = 1;
        if (t === 'forest') thr = inDeploy ? 0.62 : 0.44;
        else if (t === 'ancientforest') thr = inDeploy ? 0.6 : 0.36;
        else if (t === 'snow') thr = inDeploy ? 0.82 : 0.68;
        else if (t === 'temple') thr = Math.abs(x) < 40 && Math.abs(z) < 40 ? 1 : 0.7;
        else if (t === 'volcanic' || t === 'desert' || t === 'courtyard') thr = 1;
        else if (t === 'grassland') thr = inDeploy ? 0.8 : 0.67;
        else if (t === 'hills') thr = inDeploy ? 0.8 : 0.7;
        else if (t === 'river') thr = 0.72;
        else if (t === 'pass') thr = 0.7;
        else if (t === 'siege') thr = z > -30 ? 0.72 : 1;
        if (fv > thr && !(f & F.BLOCK)) f |= F.FOREST;
        if (t === 'volcanic') {
          for (const L of lavas) { const d = Math.abs(z - L.z(x)); if (d < 4.5 && !L.gaps.some((g) => Math.abs(x - g) < 7)) f = F.LAVA; }
        }
        if (t === 'river') {
          const dz = Math.abs(z - riverZ(x));
          if (dz < 6.5) {
            let crossing = false;
            for (const fx of fords) if (Math.abs(x - fx) < 6.5) crossing = true;
            if (Math.abs(x - bridgeX) < 4) { f = F.ROAD; }
            else if (crossing) { f = (f & ~F.FOREST) | F.WATER; }
            else f = F.DEEP;
          } else if (dz < 10) f &= ~F.FOREST;
        }
        this.flags[idx] = f;
      }
      this.riverZ = t === 'river' ? riverZ : null;
      if (t === 'river') {
        this.waterLevel = -1.0;
        this.bridge = { x: bridgeX, z0: riverZ(bridgeX) - 9, z1: riverZ(bridgeX) + 9 };
        this.fords = fords.map((fx) => ({ x: fx, z: riverZ(fx) }));
      }
      if (t === 'pass') {
        // The open ends of the pass map are wide; deploy zones stay there.
        this.deploy.south = { x0: -60, x1: 60, z0: 70, z1: 106 };
        this.deploy.north = { x0: -60, x1: 60, z0: -106, z1: -70 };
      }

      // Rock outcrops (obstacles) on open maps.
      const rockCount = { grassland: 10, hills: 12, forest: 6, pass: 14, snow: 14, volcanic: 16, ancientforest: 5, desert: 4, courtyard: 0, temple: 4 }[t] ?? 4;
      for (let k = 0; k < rockCount; k++) {
        const x = -100 + rng() * 200, z = -50 + rng() * 100;
        if (t === 'siege' && z < -20) continue;
        const idx = this.cellIdx(x, z);
        if (this.flags[idx] & (F.DEEP | F.ROAD | F.WATER | F.LAVA)) continue;
        if (t === 'temple' && Math.abs(x) < 45 && Math.abs(z) < 40) continue;
        const s = 1 + rng() * 1.4;
        this.rocks.push({ x, z, s, r: rng() * 6 });
        const rad = Math.ceil(s * 1.2);
        for (let dj = -rad; dj <= rad; dj++) for (let di = -rad; di <= rad; di++) {
          const cx = x + di * cell * 0.7, cz = z + dj * cell * 0.7;
          if (Math.hypot(cx - x, cz - z) <= s * 1.7) this.flags[this.cellIdx(cx, cz)] |= F.BLOCK;
        }
      }

      if (t === 'siege') this.buildTown();
      if (t === 'desert') this.buildRuins();
      if (t === 'courtyard') this.buildCourtyard();
      if (t === 'temple') this.buildTemple();

      // Keep the map edges impassable so nothing leaves the board except routers (handled separately).
      for (let i = 0; i < n; i++) {
        this.flags[i] |= F.BLOCK; this.flags[(n - 1) * n + i] |= F.BLOCK;
        this.flags[i * n] |= F.BLOCK; this.flags[i * n + n - 1] |= F.BLOCK;
      }

      // Trees in forest cells.
      const q = RW.quality ? RW.quality() : { trees: 1 };
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const f = this.flags[j * n + i];
        if (!(f & F.FOREST) || (f & F.BLOCK)) continue;
        const ancient = t === 'ancientforest';
        if (rng() < (ancient ? 0.16 : 0.22) * q.trees) {
          const x = -half + (i + rng()) * cell, z = -half + (j + rng()) * cell;
          this.trees.push({ x, z, s: ancient ? 1.5 + rng() * 0.9 : 0.8 + rng() * 0.6, kind: t === 'snow' || rng() < (ancient ? 0.3 : 0.6) ? 'pine' : 'oak', r: rng() * 6 });
        }
      }
      // Forest units must still be able to stand there: trees are decorative, the cell only slows and hides.

      // Make sure both deployment zones have a guaranteed walkable spine.
      this.reachableFix();
    }

    // Wall line across the map with two gates, four towers, a plaza capture point and houses.
    buildTown() {
      const n = this.n, cell = this.cell;
      const wallZ0 = -38, wallZ1 = -33;
      this.wallZ = (wallZ0 + wallZ1) / 2;
      this.siegeWalls = true;
      const gateXs = [-40, 40];
      gateXs.forEach((gx) => this.gates.push({ x: gx, z: this.wallZ, hp: 1800, maxHp: 1800, w: 10 }));
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const x = -this.half + (i + 0.5) * cell, z = -this.half + (j + 0.5) * cell;
        if (z >= wallZ0 && z <= wallZ1) {
          const idx = j * n + i;
          const gi = gateXs.findIndex((gx) => Math.abs(x - gx) <= 5);
          if (gi >= 0) { this.flags[idx] = F.GATE | F.ROAD; this.gateOf[idx] = gi; }
          else this.flags[idx] = F.WALL;
        }
      }
      let x0 = -this.half;
      for (const gx of gateXs) { this.walls.push({ x0, x1: gx - 5.5, z: this.wallZ }); x0 = gx + 5.5; }
      this.walls.push({ x0, x1: this.half, z: this.wallZ });
      for (const x of [-80, 0, 80]) this.towers.push({ x, z: this.wallZ, cd: 0, range: 58 });
      this.capture = { x: 0, z: -80, r: 13, progress: 0, need: 60 };
      // Houses inside the walls, leaving streets from both gates to the plaza.
      const rng = this.rng;
      for (let k = 0; k < 70 && this.houses.length < 24; k++) {
        const x = -100 + rng() * 200, z = -108 + rng() * 54;
        if (z > -47) continue;
        if (gateXs.some((gx) => Math.abs(x - gx) < 12) || Math.abs(x) < 8) continue;
        if (Math.hypot(x - this.capture.x, z - this.capture.z) < 24) continue;
        if (this.houses.some((h) => Math.abs(h.x - x) < 9 && Math.abs(h.z - z) < 8)) continue;
        const rot = rng() < 0.5 ? 0 : Math.PI / 2;
        this.houses.push({ x, z, rot });
        const hw = rot ? 2.2 : 2.7, hd = rot ? 2.7 : 2.2;
        for (let dz = -hd; dz <= hd; dz += 1) for (let dx = -hw; dx <= hw; dx += 1) this.flags[this.cellIdx(x + dx, z + dz)] |= F.BLOCK;
      }
      this.deploy.north = { x0: -70, x1: 70, z0: -98, z1: -44 };
      // Attackers may deploy anywhere along the southern approach.
      this.deploy.south = { x0: -100, x1: 100, z0: 55, z1: 106 };
    }

    // Desert ruins: broken pillars and wall fragments scattered over the sand.
    buildRuins() {
      const rng = this.rng;
      for (let k = 0; k < 22; k++) {
        const x = -95 + rng() * 190, z = -45 + rng() * 90;
        const kind = rng() < 0.6 ? 'pillar' : 'wall';
        const rot = rng() * Math.PI;
        this.pillars.push({ x, z, kind, rot, h: 3 + rng() * 5 });
        if (kind === 'pillar') { for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) this.flags[this.cellIdx(x + dx - 0.5, z + dz - 0.5)] |= F.BLOCK; }
        else for (let t = -5; t <= 5; t += 1) this.flags[this.cellIdx(x + Math.cos(rot) * t, z + Math.sin(rot) * t)] |= F.BLOCK;
      }
    }

    // Castle courtyard: outer curtain walls and an inner wall with three wide breaches.
    buildCourtyard() {
      const seg = (x0, z0, x1, z1) => {
        this.walls.push({ x0, z0, x1, z1 });
        const len = Math.hypot(x1 - x0, z1 - z0);
        for (let t = 0; t <= len; t += 1) {
          const x = x0 + (x1 - x0) * (t / len), z = z0 + (z1 - z0) * (t / len);
          for (let w = -2; w <= 2; w += 1) this.flags[this.cellIdx(x + (z1 !== z0 ? w : 0), z + (x1 !== x0 ? w : 0))] |= F.BLOCK;
        }
      };
      seg(-96, -112, -96, 112); seg(96, -112, 96, 112);
      let x0 = -96;
      for (const gx of [-50, 0, 50]) { seg(x0, 0, gx - 9, 0); x0 = gx + 9; }
      seg(x0, 0, 96, 0);
      for (const x of [-96, 96]) for (const z of [-112, 0, 112]) this.towers.push({ x, z, cd: 0, range: 0, decor: true });
      this.houses.push({ x: -75, z: -40, rot: 0 }, { x: 75, z: 40, rot: 0 }, { x: -75, z: 40, rot: Math.PI / 2 }, { x: 75, z: -40, rot: Math.PI / 2 });
      for (const h of this.houses) for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) this.flags[this.cellIdx(h.x + dx, h.z + dz)] |= F.BLOCK;
      this.deploy.south = { x0: -80, x1: 80, z0: 50, z1: 104 };
      this.deploy.north = { x0: -80, x1: 80, z0: -104, z1: -50 };
    }

    // Ancient temple: raised platform with a ring of pillars (gaps on every side).
    buildTemple() {
      this.temple = { x: 0, z: 0, r: 26 };
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        if (k % 4 === 0) continue; // openings N/E/S/W
        const x = Math.cos(a) * 30, z = Math.sin(a) * 26;
        this.pillars.push({ x, z, kind: 'pillar', rot: 0, h: 9 });
        for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) this.flags[this.cellIdx(x + dx - 0.5, z + dz - 0.5)] |= F.BLOCK;
      }
    }

    // Clear any isolated blocked pockets inside deployment zones.
    reachableFix() {
      for (const zn of [this.deploy.north, this.deploy.south]) {
        for (let z = zn.z0; z <= zn.z1; z += this.cell) for (let x = zn.x0; x <= zn.x1; x += this.cell) {
          const idx = this.cellIdx(x, z);
          if (this.flags[idx] & F.DEEP) continue;
          if (this.flags[idx] & (F.WALL | F.LAVA)) continue;
          if ((this.type === 'courtyard' || this.type === 'desert' || this.type === 'temple') && (this.flags[idx] & F.BLOCK)) continue;
          // Steep but not wall cells inside deploy zones are softened.
          if ((this.flags[idx] & F.BLOCK) && !this.rocks.some((r) => Math.hypot(r.x - x, r.z - z) < 5) && !this.houses.some((h) => Math.hypot(h.x - x, h.z - z) < 5)) this.flags[idx] &= ~F.BLOCK;
        }
      }
    }
  }

  // ------------------------------------------------------------ A* pathfinding
  const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.4142], [1, -1, 1.4142], [-1, 1, 1.4142], [-1, -1, 1.4142]];
  let gScore = null, came = null, closedStamp = null, openStamp = null, stamp = 0;

  function findPath(map, sx, sz, gx, gz, side, maxNodes = 9000) {
    const n = map.n;
    const N = n * n;
    if (!gScore || gScore.length !== N) { gScore = new Float32Array(N); came = new Int32Array(N); closedStamp = new Uint32Array(N); openStamp = new Uint32Array(N); }
    stamp++;
    let s = map.nearestFree(sx, sz, side);
    const g = map.nearestFree(gx, gz, side);
    if (map.lineClear(sx, sz, g.x, g.z, side)) return [{ x: g.x, z: g.z }];
    const start = map.cellIdx(s.x, s.z), goal = map.cellIdx(g.x, g.z);
    const gi = goal % n, gj = (goal / n) | 0;
    const heap = new U.Heap();
    gScore[start] = 0; came[start] = -1; openStamp[start] = stamp;
    heap.push(start, 0);
    let best = start, bestH = Infinity, expanded = 0, found = false;
    while (heap.size) {
      const cur = heap.pop();
      if (closedStamp[cur] === stamp) continue;
      closedStamp[cur] = stamp;
      if (cur === goal) { found = true; break; }
      const ci = cur % n, cj = (cur / n) | 0;
      const hcur = Math.hypot(ci - gi, cj - gj);
      if (hcur < bestH) { bestH = hcur; best = cur; }
      if (++expanded > maxNodes) break;
      for (let d = 0; d < 8; d++) {
        const ni = ci + DIRS[d][0], nj = cj + DIRS[d][1];
        if (ni < 0 || nj < 0 || ni >= n || nj >= n) continue;
        const nidx = nj * n + ni;
        if (closedStamp[nidx] === stamp || map.blockedIdx(nidx, side)) continue;
        if (d >= 4 && (map.blockedIdx(cj * n + ni, side) || map.blockedIdx(nj * n + ci, side))) continue;
        const fl = map.flags[nidx];
        const cost = DIRS[d][2] * ((fl & 2) ? 1.5 : 1) * ((fl & 4) ? 2.2 : 1);
        const ng = gScore[cur] + cost;
        if (openStamp[nidx] === stamp && ng >= gScore[nidx]) continue;
        openStamp[nidx] = stamp; gScore[nidx] = ng; came[nidx] = cur;
        const hh = Math.hypot(ni - gi, nj - gj);
        heap.push(nidx, ng + hh * 1.05);
      }
    }
    const end = found ? goal : best;
    const cells = [];
    for (let c = end; c !== -1 && cells.length < 4000; c = came[c]) cells.push(c);
    cells.reverse();
    const pts = cells.map((c) => map.cellCenter(c));
    if (found) pts[pts.length - 1] = { x: g.x, z: g.z };
    // String-pull smoothing using line-of-sight checks.
    const out = [];
    let ax = sx, az = sz, i = 0;
    while (i < pts.length - 1) {
      let j = pts.length - 1;
      while (j > i + 1 && !map.lineClear(ax, az, pts[j].x, pts[j].z, side)) j--;
      out.push(pts[j]); ax = pts[j].x; az = pts[j].z; i = j;
    }
    if (!out.length && pts.length) out.push(pts[pts.length - 1]);
    out.partial = !found;
    return out;
  }

  RW.BattleMap = BattleMap;
  RW.findPath = findPath;
  RW.MAPF = F;
})();
