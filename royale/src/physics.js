// Lightweight collision world: axis-aligned boxes + sloped surfaces (ramps / roofs) in a uniform spatial grid,
// plus the terrain heightfield. Characters are vertical cylinders resolved against this kinematically —
// no rigid-body physics engine, which keeps 100 characters cheap.
import { STEP_H, WATER_Y } from './config.js';

const CS = 8;          // grid cell size (m)
const OFF = 200;       // cell index offset
const ROW = 512;
const key = (ix, iz) => (ix + OFF) * ROW + (iz + OFF);

export const T_BOX = 0, T_RAMP = 1, T_CONE = 2;

let NEXT_ID = 1;
export class Collider {
  constructor(type, minX, minY, minZ, maxX, maxY, maxZ, obj) {
    this.id = NEXT_ID++;
    this.type = type;
    this.minX = minX; this.minY = minY; this.minZ = minZ;
    this.maxX = maxX; this.maxY = maxY; this.maxZ = maxZ;
    this.obj = obj || null;       // owning destructible object / build piece
    this.dir = 0;                 // ramp rising direction 0:+x 1:-x 2:+z 3:-z
    this.cells = null;
    this._q = 0;
    this.walkable = true;
    this.glass = false;
  }
  surfaceY(x, z) {
    if (this.type === T_BOX) return this.maxY;
    const h = this.maxY - this.minY;
    if (this.type === T_RAMP) {
      let t;
      switch (this.dir) {
        case 0: t = (x - this.minX) / (this.maxX - this.minX); break;
        case 1: t = (this.maxX - x) / (this.maxX - this.minX); break;
        case 2: t = (z - this.minZ) / (this.maxZ - this.minZ); break;
        default: t = (this.maxZ - z) / (this.maxZ - this.minZ);
      }
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      return this.minY + t * h;
    }
    const cx = (this.minX + this.maxX) / 2, cz = (this.minZ + this.maxZ) / 2;
    const hw = (this.maxX - this.minX) / 2, hd = (this.maxZ - this.minZ) / 2;
    let u = Math.max(Math.abs(x - cx) / hw, Math.abs(z - cz) / hd);
    u = u > 1 ? 1 : u;
    return this.minY + (1 - u) * h;
  }
}

export class CollisionWorld {
  constructor() {
    this.cells = new Map();
    this.stamp = 1;
    this.terrain = null;
    this.underground = [];   // volumes where the terrain is ignored
    this.count = 0;
  }

  add(c) {
    const x0 = Math.floor(c.minX / CS), x1 = Math.floor(c.maxX / CS);
    const z0 = Math.floor(c.minZ / CS), z1 = Math.floor(c.maxZ / CS);
    c.cells = [];
    for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) {
      const k = key(ix, iz);
      let arr = this.cells.get(k);
      if (!arr) { arr = []; this.cells.set(k, arr); }
      arr.push(c);
      c.cells.push(k);
    }
    this.count++;
    return c;
  }
  remove(c) {
    if (!c.cells) return;
    for (const k of c.cells) {
      const arr = this.cells.get(k);
      if (!arr) continue;
      const i = arr.indexOf(c);
      if (i >= 0) { arr[i] = arr[arr.length - 1]; arr.pop(); }
    }
    c.cells = null;
    this.count--;
  }
  box(minX, minY, minZ, maxX, maxY, maxZ, obj) {
    return this.add(new Collider(T_BOX, minX, minY, minZ, maxX, maxY, maxZ, obj));
  }
  ramp(minX, minY, minZ, maxX, maxY, maxZ, dir, obj) {
    const c = new Collider(T_RAMP, minX, minY, minZ, maxX, maxY, maxZ, obj);
    c.dir = dir;
    return this.add(c);
  }
  cone(minX, minY, minZ, maxX, maxY, maxZ, obj) {
    return this.add(new Collider(T_CONE, minX, minY, minZ, maxX, maxY, maxZ, obj));
  }

  query(minX, minZ, maxX, maxZ, out) {
    out.length = 0;
    const s = ++this.stamp;
    const x0 = Math.floor(minX / CS), x1 = Math.floor(maxX / CS);
    const z0 = Math.floor(minZ / CS), z1 = Math.floor(maxZ / CS);
    for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) {
      const arr = this.cells.get(key(ix, iz));
      if (!arr) continue;
      for (let i = 0; i < arr.length; i++) {
        const c = arr[i];
        if (c._q === s) continue;
        c._q = s;
        if (c.maxX < minX || c.minX > maxX || c.maxZ < minZ || c.minZ > maxZ) continue;
        out.push(c);
      }
    }
    return out;
  }

  ignoresTerrain(x, y, z) {
    for (const u of this.underground) {
      if (x > u.minX && x < u.maxX && z > u.minZ && z < u.maxZ && y < u.maxY) return true;
    }
    return false;
  }

  terrainY(x, z) { return this.terrain ? this.terrain.heightAt(x, z) : 0; }

  // Highest walkable support at (x,z) not above maxY.
  groundAt(x, z, maxY, r, tmp) {
    let g = -1e9;
    if (!this.ignoresTerrain(x, maxY - 0.6, z)) g = this.terrainY(x, z);
    const list = this.query(x - r, z - r, x + r, z + r, tmp || []);
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      if (c.minY > maxY) continue;
      let y;
      if (c.type === T_BOX) {
        if (x + r < c.minX || x - r > c.maxX || z + r < c.minZ || z - r > c.maxZ) continue;
        y = c.maxY;
      } else {
        if (x < c.minX || x > c.maxX || z < c.minZ || z > c.maxZ) continue;
        y = c.surfaceY(x, z);
      }
      if (y <= maxY && y > g) g = y;
    }
    return g;
  }

  // Move a vertical-cylinder body (pos = feet). Mutates body.pos/vel/grounded; returns info about walls.
  moveBody(b, dt) {
    const r = b.radius, h = b.height;
    const tmp = this._tmp || (this._tmp = []);
    const p = b.pos;
    let nx = p.x + b.vel.x * dt, nz = p.z + b.vel.z * dt;
    let wallHit = null;
    const stepTop = p.y + (b.grounded ? STEP_H : 0.25);
    // horizontal resolve (2 passes)
    for (let pass = 0; pass < 2; pass++) {
      const list = this.query(nx - r - 0.1, nz - r - 0.1, nx + r + 0.1, nz + r + 0.1, tmp);
      for (let i = 0; i < list.length; i++) {
        const c = list[i];
        if (c.type !== T_BOX) continue;
        if (c.maxY <= stepTop || c.minY >= p.y + h) continue;
        const cx = nx < c.minX ? c.minX : nx > c.maxX ? c.maxX : nx;
        const cz = nz < c.minZ ? c.minZ : nz > c.maxZ ? c.maxZ : nz;
        let dx = nx - cx, dz = nz - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        let px, pz;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          px = dx / d; pz = dz / d;
          nx = cx + px * r; nz = cz + pz * r;
        } else {
          // centre inside the box: push out along the smallest penetration axis
          const l = nx - c.minX + r, rr = c.maxX - nx + r, f = nz - c.minZ + r, bk = c.maxZ - nz + r;
          const m = Math.min(l, rr, f, bk);
          px = 0; pz = 0;
          if (m === l) { nx = c.minX - r; px = -1; } else if (m === rr) { nx = c.maxX + r; px = 1; }
          else if (m === f) { nz = c.minZ - r; pz = -1; } else { nz = c.maxZ + r; pz = 1; }
        }
        if (!wallHit || c.maxY > wallHit.top) wallHit = { nx: px, nz: pz, top: c.maxY, c };
        // remove velocity into the wall
        const vn = b.vel.x * px + b.vel.z * pz;
        if (vn < 0) { b.vel.x -= vn * px; b.vel.z -= vn * pz; }
      }
    }
    // world bounds
    const lim = 1200;
    if (nx < -lim) nx = -lim; if (nx > lim) nx = lim;
    if (nz < -lim) nz = -lim; if (nz > lim) nz = lim;
    p.x = nx; p.z = nz;

    // vertical
    let ny = p.y + b.vel.y * dt;
    // ceiling
    if (b.vel.y > 0) {
      const list = this.query(nx - r * 0.7, nz - r * 0.7, nx + r * 0.7, nz + r * 0.7, tmp);
      for (let i = 0; i < list.length; i++) {
        const c = list[i];
        let bottom;
        if (c.type === T_BOX) bottom = c.minY;
        else { if (nx < c.minX || nx > c.maxX || nz < c.minZ || nz > c.maxZ) continue; bottom = c.surfaceY(nx, nz) - 0.15; }
        if (bottom >= p.y + h - 0.05 && ny + h > bottom) { ny = bottom - h; b.vel.y = 0; }
      }
    }
    const ground = this.groundAt(nx, nz, Math.max(p.y, ny) + (b.grounded ? STEP_H : 0.3), r * 0.75, tmp);
    const wasGrounded = b.grounded;
    b.landSpeed = 0;
    if (ny <= ground) {
      if (!wasGrounded) b.landSpeed = -b.vel.y;
      ny = ground; b.grounded = true; if (b.vel.y < 0) b.vel.y = 0;
    } else if (wasGrounded && b.vel.y <= 0.01 && ny - ground < 0.45) {
      ny = ground; b.grounded = true; b.vel.y = 0;
    } else {
      b.grounded = false;
    }
    b.groundY = ground;
    p.y = ny;
    return wallHit;
  }

  // Is there free space for a body standing at (x,y,z)?
  fits(x, y, z, r, h) {
    const list = this.query(x - r, z - r, x + r, z + r, this._tmp2 || (this._tmp2 = []));
    for (const c of list) {
      if (c.type !== T_BOX) continue;
      if (c.maxY <= y + 0.05 || c.minY >= y + h) continue;
      if (x + r <= c.minX || x - r >= c.maxX || z + r <= c.minZ || z - r >= c.maxZ) continue;
      return false;
    }
    return true;
  }

  // Ray cast against boxes, slopes and terrain. Returns {t, c (collider|null), terrain, nx,ny,nz} or null.
  raycast(ox, oy, oz, dx, dy, dz, maxT, ignoreObj, out) {
    out = out || {};
    let best = maxT, bestC = null, bnx = 0, bny = 0, bnz = 0;
    const s = ++this.stamp;
    // DDA through grid cells in XZ
    let ix = Math.floor(ox / CS), iz = Math.floor(oz / CS);
    const stepX = dx > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
    const tdx = Math.abs(dx) > 1e-9 ? CS / Math.abs(dx) : 1e9;
    const tdz = Math.abs(dz) > 1e-9 ? CS / Math.abs(dz) : 1e9;
    let tmx = Math.abs(dx) > 1e-9 ? ((dx > 0 ? (ix + 1) * CS - ox : ox - ix * CS) / Math.abs(dx)) : 1e9;
    let tmz = Math.abs(dz) > 1e-9 ? ((dz > 0 ? (iz + 1) * CS - oz : oz - iz * CS) / Math.abs(dz)) : 1e9;
    let tCell = 0;
    for (let guard = 0; guard < 400; guard++) {
      const arr = this.cells.get(key(ix, iz));
      if (arr) {
        for (let i = 0; i < arr.length; i++) {
          const c = arr[i];
          if (c._q === s) continue;
          c._q = s;
          if (ignoreObj && c.obj === ignoreObj) continue;
          if (this.skipGlass && c.glass) continue;
          if (c.type === T_BOX) {
            // slab test
            let t0 = 0, t1 = best, n = 0;
            let inv, ta, tb;
            if (Math.abs(dx) < 1e-9) { if (ox < c.minX || ox > c.maxX) continue; }
            else {
              inv = 1 / dx; ta = (c.minX - ox) * inv; tb = (c.maxX - ox) * inv;
              if (ta > tb) { const q = ta; ta = tb; tb = q; }
              if (ta > t0) { t0 = ta; n = 1; } if (tb < t1) t1 = tb; if (t0 > t1) continue;
            }
            if (Math.abs(dy) < 1e-9) { if (oy < c.minY || oy > c.maxY) continue; }
            else {
              inv = 1 / dy; ta = (c.minY - oy) * inv; tb = (c.maxY - oy) * inv;
              if (ta > tb) { const q = ta; ta = tb; tb = q; }
              if (ta > t0) { t0 = ta; n = 2; } if (tb < t1) t1 = tb; if (t0 > t1) continue;
            }
            if (Math.abs(dz) < 1e-9) { if (oz < c.minZ || oz > c.maxZ) continue; }
            else {
              inv = 1 / dz; ta = (c.minZ - oz) * inv; tb = (c.maxZ - oz) * inv;
              if (ta > tb) { const q = ta; ta = tb; tb = q; }
              if (ta > t0) { t0 = ta; n = 3; } if (tb < t1) t1 = tb; if (t0 > t1) continue;
            }
            if (t0 < best) {
              best = t0; bestC = c;
              bnx = n === 1 ? -Math.sign(dx) : 0; bny = n === 2 ? -Math.sign(dy) : 0; bnz = n === 3 ? -Math.sign(dz) : 0;
            }
          } else {
            const t = this._raySlope(c, ox, oy, oz, dx, dy, dz, best);
            if (t >= 0 && t < best) { best = t; bestC = c; bnx = 0; bny = 1; bnz = 0; }
          }
        }
      }
      // next cell
      const tNext = Math.min(tmx, tmz);
      if (best <= tNext || tNext > maxT) break;
      tCell = tNext;
      if (tmx < tmz) { tmx += tdx; ix += stepX; } else { tmz += tdz; iz += stepZ; }
    }
    // terrain march
    let terrainHit = false;
    if (this.terrain) {
      const tt = this._rayTerrain(ox, oy, oz, dx, dy, dz, best);
      if (tt >= 0 && tt < best) { best = tt; bestC = null; terrainHit = true; bnx = 0; bny = 1; bnz = 0; }
    }
    if (!bestC && !terrainHit) return null;
    out.t = best; out.c = bestC; out.terrain = terrainHit;
    out.x = ox + dx * best; out.y = oy + dy * best; out.z = oz + dz * best;
    out.nx = bnx; out.ny = bny; out.nz = bnz;
    return out;
  }

  _raySlope(c, ox, oy, oz, dx, dy, dz, maxT) {
    const h = c.maxY - c.minY;
    let best = -1;
    const test = (t) => {
      if (t < 0 || t > maxT) return;
      const x = ox + dx * t, z = oz + dz * t;
      if (x < c.minX - 1e-4 || x > c.maxX + 1e-4 || z < c.minZ - 1e-4 || z > c.maxZ + 1e-4) return false;
      return true;
    };
    if (c.type === T_RAMP) {
      // plane: y = minY + k*(coord - base)
      let k, t;
      const w = c.maxX - c.minX, d = c.maxZ - c.minZ;
      switch (c.dir) {
        case 0: k = h / w; t = (c.minY + k * (ox - c.minX) - oy) / (dy - k * dx); break;
        case 1: k = h / w; t = (c.minY + k * (c.maxX - ox) - oy) / (dy + k * dx); break;
        case 2: k = h / d; t = (c.minY + k * (oz - c.minZ) - oy) / (dy - k * dz); break;
        default: k = h / d; t = (c.minY + k * (c.maxZ - oz) - oy) / (dy + k * dz);
      }
      if (isFinite(t) && test(t)) best = t;
      return best;
    }
    // cone: four planes
    const cx = (c.minX + c.maxX) / 2, cz = (c.minZ + c.maxZ) / 2;
    const hw = (c.maxX - c.minX) / 2, hd = (c.maxZ - c.minZ) / 2;
    for (let f = 0; f < 4; f++) {
      const sgn = f & 1 ? -1 : 1;
      let t;
      if (f < 2) { const k = h / hw; t = (c.minY + h - sgn * k * (ox - cx) - oy) / (dy + sgn * k * dx); }
      else { const k = h / hd; t = (c.minY + h - sgn * k * (oz - cz) - oy) / (dy + sgn * k * dz); }
      if (!isFinite(t) || t < 0 || t > maxT) continue;
      const x = ox + dx * t, z = oz + dz * t;
      if (x < c.minX || x > c.maxX || z < c.minZ || z > c.maxZ) continue;
      const ux = (x - cx) / hw, uz = (z - cz) / hd;
      if (f < 2 ? (Math.abs(ux) >= Math.abs(uz) && Math.sign(ux) === sgn) : (Math.abs(uz) >= Math.abs(ux) && Math.sign(uz) === sgn)) {
        if (best < 0 || t < best) best = t;
      }
    }
    return best;
  }

  _rayTerrain(ox, oy, oz, dx, dy, dz, maxT) {
    const T = this.terrain;
    const maxH = T.maxHeight + 1;
    let t = 0;
    // skip the part of the ray that is above all terrain
    if (oy > maxH) {
      if (dy >= 0) return -1;
      t = (oy - maxH) / -dy;
      if (t > maxT) return -1;
    }
    let prevT = t;
    let prevAbove = oy + dy * t >= T.heightAt(ox + dx * t, oz + dz * t);
    const step = 1.5;
    while (t < maxT) {
      t = Math.min(maxT, t + step);
      const x = ox + dx * t, y = oy + dy * t, z = oz + dz * t;
      if (y > maxH && dy >= 0) return -1;
      const above = y >= T.heightAt(x, z);
      if (prevAbove && !above) {
        // bisection refine
        let a = prevT, b = t;
        for (let i = 0; i < 6; i++) {
          const m = (a + b) / 2;
          if (oy + dy * m >= T.heightAt(ox + dx * m, oz + dz * m)) a = m; else b = m;
        }
        return a;
      }
      prevAbove = above; prevT = t;
      if (t >= maxT) break;
    }
    return -1;
  }

  lineOfSight(ax, ay, az, bx, by, bz, ignoreObj) {
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d < 0.01) return true;
    this.skipGlass = true;
    const hit = this.raycast(ax, ay, az, dx / d, dy / d, dz / d, d - 0.3, ignoreObj, this._losOut || (this._losOut = {}));
    this.skipGlass = false;
    return !hit;
  }

  isDeepWater(x, z) { return this.terrainY(x, z) < WATER_Y - 1.3; }
}
