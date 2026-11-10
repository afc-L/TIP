// Heightfield island: generation, exact triangle height queries and a chunked vertex-coloured mesh.
import * as THREE from 'three';
import { MAP_HALF, WATER_Y } from './config.js';
import { makeNoise2D, smoothstep, clamp, lerp, segDist, mulberry32 } from './util.js';
import { POIS, RIVERS, LAKES, MOUNTAINS, HIDDEN } from './layout.js';

export const TN = 257;                       // vertices per side
const SIZE = MAP_HALF * 2;
export const TSTEP = SIZE / (TN - 1);

export class Terrain {
  constructor(seed = 1337) {
    this.seed = seed;
    this.h = new Float32Array(TN * TN);
    this.holes = new Uint8Array((TN - 1) * (TN - 1));
    this.maxHeight = 0;
    this.noise = makeNoise2D(seed);
    this.noise2 = makeNoise2D(seed + 99);
    this.paint = [];          // {x,z,r,color} ground paint discs
  }

  islandMask(x, z) {
    const n = this.noise;
    const ang = Math.atan2(z, x);
    const R = 790 + n(Math.cos(ang) * 1.3 + 7, Math.sin(ang) * 1.3 + 3) * 70 + n(ang * 2.1, 1.7) * 30;
    const d = Math.hypot(x, z);
    return smoothstep(R + 30, R - 70, d);
  }

  rawHeight(x, z) {
    const n = this.noise, n2 = this.noise2;
    const mask = this.islandMask(x, z);
    let h = 7 + n.fbm(x / 420, z / 420, 4) * 14 + n2.fbm(x / 120, z / 120, 3) * 3;
    for (const m of MOUNTAINS) {
      const d = Math.hypot(x - m.x, z - m.z);
      const f = smoothstep(m.r, m.r * 0.15, d);
      if (f > 0) h += f * m.h * (0.55 + 0.45 * n.ridge(x / 160 + 11, z / 160 + 5, 4)) * 1.15;
    }
    h = lerp(-14, h, mask);
    // beaches: flatten the band near sea level
    if (h > 0 && h < 4) h = h * 0.75 + 0.3;
    return h;
  }

  generate() {
    const h = this.h;
    const flat = [...POIS.map((p) => ({ x: p.x, z: p.z, r: p.r, edge: 40 })), ...HIDDEN.map((p) => ({ x: p.x, z: p.z, r: 14, edge: 18 }))];
    // natural heights at flatten centres
    for (const f of flat) f.y = Math.max(3.5, this.rawHeight(f.x, f.z));
    // farm/beach/docks stay low
    for (let j = 0; j < TN; j++) {
      for (let i = 0; i < TN; i++) {
        const x = -MAP_HALF + i * TSTEP, z = -MAP_HALF + j * TSTEP;
        let y = this.rawHeight(x, z);
        // rivers carve valleys
        for (const r of RIVERS) {
          let best = 1e9;
          for (let k = 0; k < r.pts.length - 1; k++) {
            const a = r.pts[k], b = r.pts[k + 1];
            const s = segDist(x, z, a[0], a[1], b[0], b[1]);
            if (s.d < best) best = s.d;
          }
          if (best < 160) {
            const bank = 1.2 + Math.max(0, best - r.w) * 0.28;
            const bed = -3.2 + smoothstep(0, r.w, best) * 4.4;
            y = Math.min(y, Math.max(best < r.w ? bed : -10, bank));
            if (best < r.w) y = Math.min(y, bed);
          }
        }
        for (const l of LAKES) {
          const d = Math.hypot(x - l.x, z - l.z);
          if (d < l.r + 140) {
            const bank = 1.0 + Math.max(0, d - l.r) * 0.25;
            const bed = -4 + smoothstep(0, l.r, d) * 4.5;
            y = Math.min(y, d < l.r ? bed : bank);
          }
        }
        // POI flattening
        for (const f of flat) {
          const d = Math.hypot(x - f.x, z - f.z);
          if (d < f.r + f.edge) {
            const w = smoothstep(f.r + f.edge, f.r, d);
            y = lerp(y, f.y, w);
          }
        }
        h[j * TN + i] = y;
      }
    }
    this.flatHeights = flat;
    let mx = -1e9;
    for (let k = 0; k < h.length; k++) if (h[k] > mx) mx = h[k];
    this.maxHeight = mx;
  }

  poiHeight(id) {
    const i = POIS.findIndex((p) => p.id === id);
    if (i >= 0) return this.flatHeights[i].y;
    const j = HIDDEN.findIndex((p) => p.id === id);
    return this.flatHeights[POIS.length + j].y;
  }

  // Set a height directly at a grid vertex nearest to (x,z) (used to sink pits etc.)
  cellOf(x, z) {
    const i = Math.floor((x + MAP_HALF) / TSTEP), j = Math.floor((z + MAP_HALF) / TSTEP);
    return { i, j, x0: -MAP_HALF + i * TSTEP, z0: -MAP_HALF + j * TSTEP };
  }
  setHole(i, j) { this.holes[j * (TN - 1) + i] = 1; }

  heightAt(x, z) {
    let fx = (x + MAP_HALF) / TSTEP, fz = (z + MAP_HALF) / TSTEP;
    if (fx < 0 || fz < 0 || fx >= TN - 1 || fz >= TN - 1) return -14;
    const i = fx | 0, j = fz | 0;
    if (this.holes[j * (TN - 1) + i]) return -999;
    fx -= i; fz -= j;
    const h = this.h, k = j * TN + i;
    const a = h[k], b = h[k + 1], c = h[k + TN], d = h[k + TN + 1];
    if (fx + fz <= 1) return a + (b - a) * fx + (c - a) * fz;
    return d + (c - d) * (1 - fx) + (b - d) * (1 - fz);
  }
  slopeAt(x, z) {
    const e = 2;
    const dx = this.heightAt(x + e, z) - this.heightAt(x - e, z);
    const dz = this.heightAt(x, z + e) - this.heightAt(x, z - e);
    return Math.hypot(dx, dz) / (2 * e);
  }

  addPaint(x, z, r, color, soft = 0.3) { this.paint.push({ x, z, r, color: new THREE.Color(color), soft }); }

  colorAt(x, z, y, out) {
    const n = this.noise2;
    const slope = this.slopeAt(x, z);
    const v = n(x / 60, z / 60) * 0.5 + 0.5;
    if (y < -0.5) out.setRGB(0.76, 0.7, 0.5).multiplyScalar(0.85);
    else if (y < 2.3) out.setRGB(0.93, 0.85, 0.6);
    else {
      out.setRGB(lerp(0.33, 0.47, v), lerp(0.62, 0.72, v), lerp(0.22, 0.28, v));
      // dry patches
      const dry = n(x / 230 + 4, z / 230) * 0.5 + 0.5;
      if (dry > 0.62) out.lerp(new THREE.Color(0.62, 0.66, 0.32), (dry - 0.62) * 2.5);
    }
    if (y > 2.3 && slope > 0.7) out.lerp(new THREE.Color(0.48, 0.46, 0.44), clamp((slope - 0.7) * 2, 0, 1));
    if (y > 75) out.lerp(new THREE.Color(0.55, 0.53, 0.52), clamp((y - 75) / 20, 0, 1));
    if (y > 112) out.lerp(new THREE.Color(0.96, 0.97, 1.0), clamp((y - 112) / 10, 0, 1));
    for (const p of this.paint) {
      const d = Math.hypot(x - p.x, z - p.z);
      if (d < p.r) out.lerp(p.color, smoothstep(p.r, p.r * (1 - p.soft), d));
    }
    return out;
  }

  buildMesh(scene) {
    const CH = 16;               // quads per chunk side
    const chunks = (TN - 1) / CH;
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const col = new THREE.Color();
    const rng = mulberry32(this.seed + 5);
    this.meshes = [];
    for (let cj = 0; cj < chunks; cj++) {
      for (let ci = 0; ci < chunks; ci++) {
        const pos = [], colors = [], idx = [];
        const vmap = new Map();
        const vert = (i, j) => {
          const k = j * TN + i;
          let id = vmap.get(k);
          if (id !== undefined) return id;
          id = pos.length / 3;
          const x = -MAP_HALF + i * TSTEP, z = -MAP_HALF + j * TSTEP, y = this.h[k];
          pos.push(x, y, z);
          this.colorAt(x, z, y, col);
          const jit = 0.94 + rng() * 0.1;
          colors.push(col.r * jit, col.g * jit, col.b * jit);
          vmap.set(k, id);
          return id;
        };
        for (let j = cj * CH; j < (cj + 1) * CH; j++) {
          for (let i = ci * CH; i < (ci + 1) * CH; i++) {
            if (this.holes[j * (TN - 1) + i]) continue;
            const a = vert(i, j), b = vert(i + 1, j), c = vert(i, j + 1), d = vert(i + 1, j + 1);
            idx.push(a, c, b, b, c, d);
          }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        g.setIndex(idx);
        g.computeVertexNormals();
        const m = new THREE.Mesh(g, mat);
        m.receiveShadow = true;
        m.castShadow = false;
        g.computeBoundingSphere();
        m.userData.cx = g.boundingSphere.center.x;
        m.userData.cz = g.boundingSphere.center.z;
        scene.add(m);
        this.meshes.push(m);
      }
    }
    // Ocean
    const wg = new THREE.PlaneGeometry(6000, 6000, 1, 1);
    wg.rotateX(-Math.PI / 2);
    this.waterMat = new THREE.MeshLambertMaterial({ color: 0x2e8fd6, transparent: true, opacity: 0.82 });
    const water = new THREE.Mesh(wg, this.waterMat);
    water.position.y = WATER_Y - 0.15;
    water.renderOrder = 1;
    scene.add(water);
    this.water = water;
  }

  updateVisibility(cx, cz, dist) {
    const lim = dist + 120;
    for (const m of this.meshes) {
      const dx = m.userData.cx - cx, dz = m.userData.cz - cz;
      m.visible = dx * dx + dz * dz < lim * lim;
    }
  }
}
