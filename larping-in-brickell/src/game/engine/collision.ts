// Lightweight arcade collision: axis-aligned boxes (with a vertical range) in a uniform grid.
// Circles (player, cars) are pushed out of boxes; rays are used by the camera.

export interface Box {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  minY: number;
  maxY: number;
  tag?: string;
}

const CELL = 40;

export class CollisionWorld {
  boxes: Box[] = [];
  private grid = new Map<string, number[]>();

  clear() {
    this.boxes = [];
    this.grid.clear();
  }

  add(b: Box) {
    const idx = this.boxes.length;
    this.boxes.push(b);
    const x0 = Math.floor(b.minX / CELL), x1 = Math.floor(b.maxX / CELL);
    const z0 = Math.floor(b.minZ / CELL), z1 = Math.floor(b.maxZ / CELL);
    for (let i = x0; i <= x1; i++)
      for (let j = z0; j <= z1; j++) {
        const k = `${i},${j}`;
        let arr = this.grid.get(k);
        if (!arr) this.grid.set(k, (arr = []));
        arr.push(idx);
      }
    return idx;
  }

  addRect(cx: number, cz: number, w: number, d: number, minY = 0, maxY = 100, tag?: string) {
    return this.add({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, minY, maxY, tag });
  }

  private seen = new Set<number>();
  query(minX: number, minZ: number, maxX: number, maxZ: number, out: Box[]) {
    out.length = 0;
    this.seen.clear();
    const x0 = Math.floor(minX / CELL), x1 = Math.floor(maxX / CELL);
    const z0 = Math.floor(minZ / CELL), z1 = Math.floor(maxZ / CELL);
    for (let i = x0; i <= x1; i++)
      for (let j = z0; j <= z1; j++) {
        const arr = this.grid.get(`${i},${j}`);
        if (!arr) continue;
        for (const idx of arr) {
          if (this.seen.has(idx)) continue;
          this.seen.add(idx);
          out.push(this.boxes[idx]);
        }
      }
    return out;
  }

  private tmp: Box[] = [];
  /** Push a circle out of all boxes overlapping its vertical span. Returns collision normal info. */
  resolveCircle(p: { x: number; z: number }, r: number, y: number, h: number): { hit: boolean; nx: number; nz: number; depth: number } {
    const res = { hit: false, nx: 0, nz: 0, depth: 0 };
    const list = this.query(p.x - r, p.z - r, p.x + r, p.z + r, this.tmp);
    for (let iter = 0; iter < 2; iter++) {
      for (const b of list) {
        if (y >= b.maxY - 0.05 || y + h <= b.minY) continue;
        const cx = Math.max(b.minX, Math.min(p.x, b.maxX));
        const cz = Math.max(b.minZ, Math.min(p.z, b.maxZ));
        let dx = p.x - cx, dz = p.z - cz;
        let d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        let d = Math.sqrt(d2);
        if (d < 1e-5) {
          // centre inside the box: push out along the smallest axis
          const l = p.x - b.minX, rr = b.maxX - p.x, t = p.z - b.minZ, bb = b.maxZ - p.z;
          const m = Math.min(l, rr, t, bb);
          if (m === l) { dx = -1; dz = 0; d = 0; p.x = b.minX - r; }
          else if (m === rr) { dx = 1; dz = 0; d = 0; p.x = b.maxX + r; }
          else if (m === t) { dx = 0; dz = -1; d = 0; p.z = b.minZ - r; }
          else { dx = 0; dz = 1; d = 0; p.z = b.maxZ + r; }
          res.hit = true; res.nx = dx; res.nz = dz; res.depth = r;
          continue;
        }
        const push = r - d;
        dx /= d; dz /= d;
        p.x += dx * push;
        p.z += dz * push;
        res.hit = true;
        res.nx = dx; res.nz = dz; res.depth = Math.max(res.depth, push);
      }
    }
    return res;
  }

  /** Ray (segment) from a to b at height range; returns fraction [0,1] of first hit. */
  raycast(ax: number, ay: number, az: number, bx: number, by: number, bz: number): number {
    const list = this.query(Math.min(ax, bx) - 1, Math.min(az, bz) - 1, Math.max(ax, bx) + 1, Math.max(az, bz) + 1, this.tmp);
    let best = 1;
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    for (const b of list) {
      let t0 = 0, t1 = 1;
      const axes: [number, number, number, number][] = [
        [ax, dx, b.minX, b.maxX],
        [ay, dy, b.minY, b.maxY],
        [az, dz, b.minZ, b.maxZ],
      ];
      let ok = true;
      for (const [o, d, mn, mx] of axes) {
        if (Math.abs(d) < 1e-8) {
          if (o < mn || o > mx) { ok = false; break; }
        } else {
          let ta = (mn - o) / d, tb = (mx - o) / d;
          if (ta > tb) [ta, tb] = [tb, ta];
          t0 = Math.max(t0, ta);
          t1 = Math.min(t1, tb);
          if (t0 > t1) { ok = false; break; }
        }
      }
      if (ok && t0 < best) best = t0;
    }
    return best;
  }
}
