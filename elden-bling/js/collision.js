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
export function groundHeight(x, z) {
  let h = 0.45 * Math.sin(x * 0.11) * Math.cos(z * 0.09) + 0.25 * Math.sin(x * 0.23 + z * 0.17);
  // Swamp sits lower.
  const sw = smooth(34, 26, z) * smooth(-50, -42, z);
  h -= 0.6 * sw;
  // Flatten the two boss arenas.
  const d1 = Math.hypot(x, z + 88);
  h *= smooth(16, 22, d1);
  const d2 = Math.hypot(x, z + 32);
  h = h * smooth(10, 15, d2) + (-0.6) * (1 - smooth(10, 15, d2));
  // Mountains rise beyond the playable edge.
  const ex = Math.max(0, Math.abs(x) - 60), ez = Math.max(0, z - 102, -110 - z);
  h += (ex * ex + ez * ez) * 0.08;
  return h;
}

function smooth(e0, e1, x) {
  let t = (x - e0) / (e1 - e0);
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return t * t * (3 - 2 * t);
}
