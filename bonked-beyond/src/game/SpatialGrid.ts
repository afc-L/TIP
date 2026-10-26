// Uniform grid rebuilt every frame with a counting sort. O(n) build, cheap neighbour queries.

export interface GridItem { x: number; z: number; radius: number; alive: boolean; hidden?: boolean }

export class SpatialGrid<T extends GridItem> {
  readonly cell: number;
  private half: number;
  private cols: number;
  private cellStart: Int32Array;
  private cellCount: Int32Array;
  private items: T[] = [];
  private sorted: T[] = [];
  private cellOf: Int32Array = new Int32Array(0);

  constructor(halfSize: number, cell = 2.5) {
    this.cell = cell;
    this.half = halfSize;
    this.cols = Math.ceil((halfSize * 2) / cell);
    this.cellStart = new Int32Array(this.cols * this.cols + 1);
    this.cellCount = new Int32Array(this.cols * this.cols);
  }

  private index(x: number, z: number): number {
    let cx = Math.floor((x + this.half) / this.cell);
    let cz = Math.floor((z + this.half) / this.cell);
    if (cx < 0) cx = 0; else if (cx >= this.cols) cx = this.cols - 1;
    if (cz < 0) cz = 0; else if (cz >= this.cols) cz = this.cols - 1;
    return cz * this.cols + cx;
  }

  build(list: readonly T[]) {
    this.items.length = 0;
    for (const it of list) if (it.alive && !it.hidden) this.items.push(it);
    const n = this.items.length;
    if (this.cellOf.length < n) this.cellOf = new Int32Array(Math.max(n, this.cellOf.length * 2, 64));
    this.cellCount.fill(0);
    for (let i = 0; i < n; i++) {
      const c = this.index(this.items[i].x, this.items[i].z);
      this.cellOf[i] = c;
      this.cellCount[c]++;
    }
    let acc = 0;
    for (let c = 0; c < this.cellCount.length; c++) {
      this.cellStart[c] = acc;
      acc += this.cellCount[c];
    }
    this.cellStart[this.cellCount.length] = acc;
    this.sorted.length = n;
    const fill = this.cellCount; // reuse as cursor
    fill.fill(0);
    for (let i = 0; i < n; i++) {
      const c = this.cellOf[i];
      this.sorted[this.cellStart[c] + fill[c]++] = this.items[i];
    }
  }

  /** Calls fn for every item whose circle may overlap (x,z,r). Return true from fn to stop. */
  query(x: number, z: number, r: number, fn: (it: T) => boolean | void) {
    const pad = r + 1.5; // largest common enemy radius
    const cx0 = Math.max(0, Math.floor((x - pad + this.half) / this.cell));
    const cx1 = Math.min(this.cols - 1, Math.floor((x + pad + this.half) / this.cell));
    const cz0 = Math.max(0, Math.floor((z - pad + this.half) / this.cell));
    const cz1 = Math.min(this.cols - 1, Math.floor((z + pad + this.half) / this.cell));
    for (let cz = cz0; cz <= cz1; cz++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const c = cz * this.cols + cx;
        const end = this.cellStart[c + 1];
        for (let i = this.cellStart[c]; i < end; i++) {
          const it = this.sorted[i];
          if (!it.alive) continue;
          const dx = it.x - x, dz = it.z - z, rr = r + it.radius;
          if (dx * dx + dz * dz <= rr * rr && fn(it)) return;
        }
      }
    }
  }

  /** Nearest item within maxDist (centre distance). */
  nearest(x: number, z: number, maxDist: number, filter?: (it: T) => boolean): T | null {
    let best: T | null = null;
    let bestD = maxDist * maxDist;
    // expanding search: query progressively larger radii
    for (let r = Math.min(6, maxDist); ; r = Math.min(maxDist, r * 2)) {
      this.query(x, z, r, (it) => {
        if (filter && !filter(it)) return;
        const d = (it.x - x) ** 2 + (it.z - z) ** 2;
        if (d < bestD) { bestD = d; best = it; }
      });
      if (best || r >= maxDist) break;
    }
    return best;
  }

  get all(): readonly T[] { return this.items; }
}
