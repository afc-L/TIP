// Simple 2D (XZ-plane) collision: axis-aligned boxes and circles.

export class Colliders {
  constructor() {
    this.boxes = [];
    this.circles = [];
  }

  addBox(minX, minZ, maxX, maxZ, opts = {}) {
    const b = { minX, minZ, maxX, maxZ, h: opts.h ?? 4, enabled: true, tag: opts.tag || null, cam: opts.cam !== false };
    this.boxes.push(b);
    return b;
  }

  addCircle(x, z, r, opts = {}) {
    const c = { x, z, r, h: opts.h ?? 3, enabled: true, cam: !!opts.cam };
    this.circles.push(c);
    return c;
  }

  // Push a circle (pos.x, pos.z, radius) out of all colliders. Mutates pos.
  resolve(pos, radius) {
    for (let i = 0; i < this.boxes.length; i++) {
      const b = this.boxes[i];
      if (!b.enabled) continue;
      if (pos.x < b.minX - radius || pos.x > b.maxX + radius || pos.z < b.minZ - radius || pos.z > b.maxZ + radius) continue;
      const cx = Math.max(b.minX, Math.min(pos.x, b.maxX));
      const cz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
      let dx = pos.x - cx, dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 > 1e-8) {
        if (d2 < radius * radius) {
          const d = Math.sqrt(d2);
          pos.x = cx + (dx / d) * radius;
          pos.z = cz + (dz / d) * radius;
        }
      } else {
        // Centre is inside the box: push out along the smallest overlap.
        const l = pos.x - b.minX, r = b.maxX - pos.x, t = pos.z - b.minZ, bt = b.maxZ - pos.z;
        const m = Math.min(l, r, t, bt);
        if (m === l) pos.x = b.minX - radius;
        else if (m === r) pos.x = b.maxX + radius;
        else if (m === t) pos.z = b.minZ - radius;
        else pos.z = b.maxZ + radius;
      }
    }
    for (let i = 0; i < this.circles.length; i++) {
      const c = this.circles[i];
      if (!c.enabled) continue;
      const dx = pos.x - c.x, dz = pos.z - c.z;
      const rr = radius + c.r;
      const d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && d2 > 1e-8) {
        const d = Math.sqrt(d2);
        pos.x = c.x + (dx / d) * rr;
        pos.z = c.z + (dz / d) * rr;
      }
    }
  }

  // Fraction [0..1] along segment a->b (3D, y used for wall height) where the camera is first blocked.
  cameraCast(ax, ay, az, bx, by, bz, pad = 0.3) {
    let best = 1;
    const dx = bx - ax, dz = bz - az;
    for (let i = 0; i < this.boxes.length; i++) {
      const b = this.boxes[i];
      if (!b.enabled || !b.cam) continue;
      const t = segBox(ax, az, dx, dz, b.minX - pad, b.minZ - pad, b.maxX + pad, b.maxZ + pad);
      if (t !== null && t < best) {
        const y = ay + (by - ay) * t;
        if (y < b.h + 0.3) best = t;
      }
    }
    for (let i = 0; i < this.circles.length; i++) {
      const c = this.circles[i];
      if (!c.enabled || !c.cam) continue;
      const t = segCircle(ax, az, dx, dz, c.x, c.z, c.r + pad);
      if (t !== null && t < best) {
        const y = ay + (by - ay) * t;
        if (y < c.h) best = t;
      }
    }
    return best;
  }
}

function segBox(ax, az, dx, dz, minX, minZ, maxX, maxZ) {
  let t0 = 0, t1 = 1;
  if (Math.abs(dx) < 1e-9) { if (ax < minX || ax > maxX) return null; }
  else {
    let ta = (minX - ax) / dx, tb = (maxX - ax) / dx;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
  }
  if (Math.abs(dz) < 1e-9) { if (az < minZ || az > maxZ) return null; }
  else {
    let ta = (minZ - az) / dz, tb = (maxZ - az) / dz;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
  }
  if (t0 > t1) return null;
  return t0;
}

function segCircle(ax, az, dx, dz, cx, cz, r) {
  const fx = ax - cx, fz = az - cz;
  const a = dx * dx + dz * dz;
  if (a < 1e-9) return null;
  const b = 2 * (fx * dx + fz * dz);
  const c = fx * fx + fz * fz - r * r;
  if (c < 0) return 0;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t >= 0 && t <= 1 ? t : null;
}

// Rolling hills, a damp swamp dip and flattened arenas. Used by terrain AND characters.
// Arenas that get flattened: [x, z, inner radius, outer radius, height].
export const ARENAS = [
  [0, -88, 16, 22, 0], [0, -32, 10, 15, -0.6], [-122, 10, 18, 25, 0.6], [120, 8, 18, 25, 1.2], [55, 132, 16, 22, 0.2], [45, 42, 10, 15, 0.1],
  // Field bosses in the old regions.
  [-125, 60, 15, 21, 0.8], [140, 62, 14, 20, 1.2], [-40, 134, 15, 21, 0.2], [30, -15, 13, 18, -0.4],
  // The far regions.
  [-110, -160, 19, 26, 0.4], [-130, -100, 16, 22, 0.3], [110, -140, 19, 26, 1.0], [135, -95, 18, 24, 1.0],
  [-210, -40, 19, 26, 0.3], [-230, -95, 16, 22, 0.2], [210, -40, 19, 26, 0.8], [230, -95, 16, 22, 0.8],
];
export const WATER_LEVEL = -0.9;

// Region blend weights (0..1).
export const wDesert = (x) => smooth(-58, -68, x);
export const wPeaks = (x) => smooth(58, 68, x);
export const wBeach = (z) => smooth(100, 108, z);
export const wWoods = (x, z) => smooth(-60, -70, z) * smooth(-58, -68, x);
export const wVolcano = (x, z) => smooth(-60, -70, z) * smooth(58, 68, x);
export const wFungal = (x) => smooth(-157, -167, x);
export const wCandy = (x) => smooth(157, 167, x);

// Rolling hills, desert dunes, snowy hills, a beach sloping into the sea, flattened arenas
// and mountains beyond the playable edge. Used by terrain AND characters.
export function groundHeight(x, z) {
  let h = 0.45 * Math.sin(x * 0.11) * Math.cos(z * 0.09) + 0.25 * Math.sin(x * 0.23 + z * 0.17);
  const wd = wDesert(x), wp = wPeaks(x), wb = wBeach(z);
  const ww = wWoods(x, z), wv = wVolcano(x, z), wf = wFungal(x), wc = wCandy(x);
  const desertOnly = (1 - ww) * (1 - wf), peaksOnly = (1 - wv) * (1 - wc);
  const side = 1 - Math.max(wd, wp);
  // Swamp sits lower.
  const sw = smooth(34, 26, z) * smooth(-50, -42, z) * side;
  h -= 0.6 * sw;
  // Desert dunes and snowy hills.
  h += desertOnly * wd * (1 - wb) * (1.4 * (Math.sin(x * 0.06 + z * 0.025) * 0.5 + 0.5) + 0.5 * Math.sin(z * 0.11));
  h += peaksOnly * wp * (1 - wb) * (2.6 * (Math.sin(x * 0.045 + 1) * Math.cos(z * 0.05) * 0.5 + 0.5) + 0.4 * Math.sin(x * 0.2) * Math.sin(z * 0.17));
  // Far regions: spooky hills, rugged volcanic ridges, bumpy fungus, rolling candy hills.
  h += ww * 0.9 * Math.sin(x * 0.09) * Math.cos(z * 0.08);
  h += wv * (2.2 * Math.abs(Math.sin(x * 0.07 + z * 0.05)) + 0.6 * Math.sin(z * 0.2));
  h += wf * 0.9 * Math.sin(x * 0.13) * Math.sin(z * 0.11);
  h += wc * 1.6 * (Math.sin(x * 0.05) * Math.cos(z * 0.04) * 0.5 + 0.5);
  // The beach slopes into the sea.
  if (z > 128) h -= (z - 128) * 0.07;
  // Flatten arenas.
  for (let i = 0; i < ARENAS.length; i++) {
    const a = ARENAS[i];
    const dx = x - a[0], dz = z - a[1];
    const d2 = dx * dx + dz * dz;
    if (d2 > a[3] * a[3]) continue;
    const t = smooth(a[2], a[3], Math.sqrt(d2));
    h = h * t + a[4] * (1 - t);
  }
  // Mountains rise beyond the playable edge (union of the centre, the side regions and the beach).
  const d = edgeDistance(x, z);
  if (d > 0) h += d * d * 0.08;
  return h;
}

// How far (m) a point lies outside the playable area (0 inside).
export function edgeDistance(x, z) {
  const dA = rectDist(x, z, -60, -108, 60, 101);
  const dB = rectDist(x, z, -158, -62, 158, 101);
  const dC = Math.hypot(Math.max(0, Math.abs(x) - 100), Math.max(0, 101 - z));
  const ax = Math.abs(x);
  const dN = rectDist(ax, z, 62, -190, 158, -62); // woods + volcano (mirrored)
  const dF = rectDist(ax, z, 160, -120, 260, 101); // fungal + candy (mirrored)
  return Math.min(dA, dB, dC, dN, dF);
}

function rectDist(x, z, x0, z0, x1, z1) {
  const dx = Math.max(x0 - x, 0, x - x1), dz = Math.max(z0 - z, 0, z - z1);
  return Math.hypot(dx, dz);
}

export function smooth(e0, e1, x) {
  let t = (x - e0) / (e1 - e0);
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return t * t * (3 - 2 * t);
}
