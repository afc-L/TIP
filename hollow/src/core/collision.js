// Lightweight collision world: axis-aligned boxes + vertical cylinders (tree trunks,
// poles) + a terrain height function, all bucketed in a spatial hash. Actors are
// vertical cylinders. This is what lets the monster climb onto cars, walk up stairs,
// stand on rooftops and squeeze through doors without a physics engine.
import { clamp } from './util.js';

const CELL = 8;

export class CollisionWorld {
  constructor() {
    this.boxes = [];
    this.circles = [];
    this.grid = new Map();
    this.stamp = 1;
    this.terrain = () => 0;
    this.killY = -60;
    this._out = [];
  }
  key(ix, iz) { return ix * 73856093 ^ iz * 19349663; }
  _insert(obj, minx, minz, maxx, maxz) {
    const x0 = Math.floor(minx / CELL), x1 = Math.floor(maxx / CELL), z0 = Math.floor(minz / CELL), z1 = Math.floor(maxz / CELL);
    for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) {
      const k = this.key(ix, iz);
      let c = this.grid.get(k); if (!c) { c = []; this.grid.set(k, c); }
      c.push(obj);
    }
  }
  // Box by min/max. opts: {surface, door, climbable, name}
  addBox(minx, miny, minz, maxx, maxy, maxz, opts = {}) {
    const b = { type: 0, minx, miny, minz, maxx, maxy, maxz, enabled: true, surface: opts.surface || 'concrete', climbable: opts.climbable !== false, ...opts, stamp: 0 };
    this.boxes.push(b);
    this._insert(b, minx, minz, maxx, maxz);
    return b;
  }
  // Centre/size convenience.
  box(cx, cy, cz, sx, sy, sz, opts) {
    return this.addBox(cx - sx / 2, cy - sy / 2, cz - sz / 2, cx + sx / 2, cy + sy / 2, cz + sz / 2, opts);
  }
  addCircle(x, z, r, y0, y1, opts = {}) {
    const c = { type: 1, x, z, r, y0, y1, enabled: true, surface: opts.surface || 'wood', climbable: true, ...opts, stamp: 0 };
    this.circles.push(c);
    this._insert(c, x - r, z - r, x + r, z + r);
    return c;
  }
  query(minx, minz, maxx, maxz) {
    const s = ++this.stamp; const out = this._out; out.length = 0;
    const x0 = Math.floor(minx / CELL), x1 = Math.floor(maxx / CELL), z0 = Math.floor(minz / CELL), z1 = Math.floor(maxz / CELL);
    for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) {
      const c = this.grid.get(this.key(ix, iz)); if (!c) continue;
      for (let i = 0; i < c.length; i++) { const o = c[i]; if (o.stamp !== s && o.enabled) { o.stamp = s; out.push(o); } }
    }
    return out;
  }

  // Highest walkable surface under a circle at (x,z) that is not above feetY+step.
  groundAt(x, z, feetY, r = 0.3, step = 0.55) {
    let g = this.terrain(x, z); let surf = null;
    const list = this.query(x - r, z - r, x + r, z + r);
    for (const o of list) {
      if (o.type === 0) {
        if (o.noFloor) continue;
        if (x + r * 0.6 < o.minx || x - r * 0.6 > o.maxx || z + r * 0.6 < o.minz || z - r * 0.6 > o.maxz) continue;
        if (o.maxy <= feetY + step && o.maxy > g) { g = o.maxy; surf = o.surface; }
      } else {
        const dx = x - o.x, dz = z - o.z;
        if (dx * dx + dz * dz < o.r * o.r && o.y1 <= feetY + step && o.y1 > g) { g = o.y1; surf = o.surface; }
      }
    }
    return { y: g, surface: surf };
  }

  // Resolve a vertical cylinder against horizontal obstacles. Mutates pos. Returns contact info.
  resolve(pos, r, height, step = 0.55) {
    let hitWall = null; const feet = pos.y;
    for (let iter = 0; iter < 3; iter++) {
      const list = this.query(pos.x - r, pos.z - r, pos.x + r, pos.z + r);
      let moved = false;
      for (const o of list) {
        if (o.type === 0) {
          if (o.maxy <= feet + step || o.miny >= feet + height) continue;
          const cx = clamp(pos.x, o.minx, o.maxx), cz = clamp(pos.z, o.minz, o.maxz);
          let dx = pos.x - cx, dz = pos.z - cz; const d2 = dx * dx + dz * dz;
          if (d2 >= r * r) continue;
          if (d2 > 1e-8) {
            const d = Math.sqrt(d2), push = r - d;
            pos.x += dx / d * push; pos.z += dz / d * push;
            hitWall = { nx: dx / d, nz: dz / d, obj: o };
          } else {
            // centre inside box: push along least penetration
            const pl = pos.x - o.minx, pr = o.maxx - pos.x, pb = pos.z - o.minz, pf = o.maxz - pos.z;
            const m = Math.min(pl, pr, pb, pf);
            if (m === pl) { pos.x = o.minx - r; hitWall = { nx: -1, nz: 0, obj: o }; }
            else if (m === pr) { pos.x = o.maxx + r; hitWall = { nx: 1, nz: 0, obj: o }; }
            else if (m === pb) { pos.z = o.minz - r; hitWall = { nx: 0, nz: -1, obj: o }; }
            else { pos.z = o.maxz + r; hitWall = { nx: 0, nz: 1, obj: o }; }
          }
          moved = true;
        } else {
          if (o.y1 <= feet + step || o.y0 >= feet + height) continue;
          const dx = pos.x - o.x, dz = pos.z - o.z, rr = r + o.r, d2 = dx * dx + dz * dz;
          if (d2 >= rr * rr || d2 < 1e-8) continue;
          const d = Math.sqrt(d2); pos.x = o.x + dx / d * rr; pos.z = o.z + dz / d * rr;
          hitWall = { nx: dx / d, nz: dz / d, obj: o }; moved = true;
        }
      }
      if (!moved) break;
    }
    return hitWall;
  }

  // Lowest ceiling above head (for jumps / crouch checks).
  ceilingAt(x, z, y, r = 0.3) {
    let c = Infinity;
    for (const o of this.query(x - r, z - r, x + r, z + r)) {
      if (o.type !== 0) continue;
      if (x + r * 0.5 < o.minx || x - r * 0.5 > o.maxx || z + r * 0.5 < o.minz || z - r * 0.5 > o.maxz) continue;
      if (o.miny >= y && o.miny < c) c = o.miny;
    }
    return c;
  }

  // Ray against boxes, circles and terrain. Returns distance or Infinity.
  raycast(ox, oy, oz, dx, dy, dz, maxD, ignore = null) {
    let best = maxD;
    const ex = ox + dx * maxD, ez = oz + dz * maxD;
    const list = this.query(Math.min(ox, ex), Math.min(oz, ez), Math.max(ox, ex), Math.max(oz, ez));
    for (const o of list) {
      if (o === ignore || o.noRay) continue;
      if (o.type === 0) {
        let tmin = 0, tmax = best;
        // slab test
        const ax = [[ox, dx, o.minx, o.maxx], [oy, dy, o.miny, o.maxy], [oz, dz, o.minz, o.maxz]];
        let ok = true;
        for (const [p, d, mn, mx] of ax) {
          if (Math.abs(d) < 1e-9) { if (p < mn || p > mx) { ok = false; break; } }
          else {
            let t1 = (mn - p) / d, t2 = (mx - p) / d; if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
            if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2;
            if (tmin > tmax) { ok = false; break; }
          }
        }
        if (ok && tmin < best) best = tmin;
      } else {
        // ray vs infinite cylinder in xz, then check y
        const fx = ox - o.x, fz = oz - o.z;
        const a = dx * dx + dz * dz; if (a < 1e-9) continue;
        const b = 2 * (fx * dx + fz * dz), c = fx * fx + fz * fz - o.r * o.r;
        const disc = b * b - 4 * a * c; if (disc < 0) continue;
        const t = (-b - Math.sqrt(disc)) / (2 * a);
        if (t > 0 && t < best) { const y = oy + dy * t; if (y >= o.y0 && y <= o.y1) best = t; }
      }
    }
    // terrain march (coarse)
    if (this.hasTerrain) {
      const steps = Math.ceil(best / 1.5);
      for (let i = 1; i <= steps; i++) {
        const t = (i / steps) * best;
        if (oy + dy * t < this.terrain(ox + dx * t, oz + dz * t)) { best = Math.max(0, t - best / steps * 0.5); break; }
      }
    }
    return best;
  }

  lineOfSight(a, b, ignore) {
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z; const d = Math.hypot(dx, dy, dz);
    if (d < 0.01) return true;
    return this.raycast(a.x, a.y, a.z, dx / d, dy / d, dz / d, d, ignore) >= d - 0.05;
  }
}
