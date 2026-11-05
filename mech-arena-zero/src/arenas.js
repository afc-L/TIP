// Arena construction, static collision world, navigation grid (A*) and cover points.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { segBox, clamp } from './util.js';

// ---------------------------------------------------------------------------
// seeded RNG for deterministic layouts
// ---------------------------------------------------------------------------
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---------------------------------------------------------------------------
// Geometry builder with vertex colors -> merged meshes
// ---------------------------------------------------------------------------
class Builder {
  constructor(seed) {
    this.solid = []; this.glow = []; this.trans = []; this.boxes = []; this.r = rng(seed);
    this.props = []; this.hazards = []; this.anim = [];
  }
  _push(geo, color, list, jitter = 0.07, matrix = null) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (matrix) g.applyMatrix4(matrix);
    const n = g.attributes.position.count;
    const cols = new Float32Array(n * 3);
    const c = new THREE.Color(color);
    for (let i = 0; i < n; i += 6) {
      const k = 1 + (this.r() - 0.5) * 2 * jitter;
      for (let j = i; j < Math.min(n, i + 6); j++) { cols[j * 3] = c.r * k; cols[j * 3 + 1] = c.g * k; cols[j * 3 + 2] = c.b * k; }
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    if (g.attributes.uv) g.deleteAttribute('uv');
    list.push(g);
    return g;
  }
  /** Axis-aligned box. x,z center; y0 bottom. */
  box(x, z, w, d, h, color, o = {}) {
    const y0 = o.y || 0;
    const m = new THREE.Matrix4().makeTranslation(x, y0 + h / 2, z);
    if (o.rotY) m.multiply(new THREE.Matrix4().makeRotationY(o.rotY));
    this._push(new THREE.BoxGeometry(w, h, d), color, o.glow ? this.glow : this.solid, o.glow ? 0 : (o.jitter ?? 0.07), m);
    if (o.collide !== false) {
      let hw = w / 2, hd = d / 2;
      if (o.rotY) { const c = Math.abs(Math.cos(o.rotY)), s = Math.abs(Math.sin(o.rotY)); [hw, hd] = [hw * c + hd * s, hw * s + hd * c]; }
      const ins = o.inset || 0;
      this.boxes.push({ minX: x - hw + ins, maxX: x + hw - ins, minY: y0, maxY: y0 + h, minZ: z - hd + ins, maxZ: z + hd - ins, cover: h >= 3.5 });
    }
  }
  glowBox(x, z, w, d, h, color, y = 0, rotY = 0) { this.box(x, z, w, d, h, color, { y, glow: true, collide: false, rotY }); }
  cyl(x, z, r, h, color, o = {}) {
    const y0 = o.y || 0;
    const m = new THREE.Matrix4().makeTranslation(x, y0 + h / 2, z);
    this._push(new THREE.CylinderGeometry(o.rt ?? r, r, h, o.seg || 10), color, o.glow ? this.glow : this.solid, o.glow ? 0 : 0.06, m);
    if (o.collide !== false) {
      const rr = r * 0.85;
      this.boxes.push({ minX: x - rr, maxX: x + rr, minY: y0, maxY: y0 + h, minZ: z - rr, maxZ: z + rr, cover: h >= 3.5 });
    }
  }
  rock(x, z, s, h, color, o = {}) {
    const geo = new THREE.IcosahedronGeometry(1, 0);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (0.8 + this.r() * 0.4), p.getY(i) * (0.8 + this.r() * 0.4), p.getZ(i) * (0.8 + this.r() * 0.4));
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, h * 0.42, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, this.r() * 6, 0)), new THREE.Vector3(s, h * 0.55, s));
    this._push(geo, color, this.solid, 0.12, m);
    if (o.collide !== false) this.boxes.push({ minX: x - s * 0.7, maxX: x + s * 0.7, minY: 0, maxY: h * 0.9, minZ: z - s * 0.7, maxZ: z + s * 0.7, cover: h >= 3.5 });
  }
  dome(x, z, r, color, o = {}) {
    const geo = new THREE.SphereGeometry(r, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    this._push(geo, color, this.solid, 0.05, new THREE.Matrix4().makeTranslation(x, o.y || 0, z));
    const k = r * 0.72;
    this.boxes.push({ minX: x - k, maxX: x + k, minY: 0, maxY: (o.y || 0) + r * 0.85, minZ: z - k, maxZ: z + k, cover: true });
  }
  /** Stairs climbing from (x,z) toward dir ('x+','x-','z+','z-') up to height h. */
  stairs(x, z, dir, w, h, color, steps = 4) {
    const sh = h / steps, depth = 2.4;
    for (let i = 0; i < steps; i++) {
      const hh = sh * (i + 1);
      const off = i * depth + depth / 2;
      if (dir === 'x+') this.box(x + off, z, depth, w, hh, color);
      if (dir === 'x-') this.box(x - off, z, depth, w, hh, color);
      if (dir === 'z+') this.box(x, z + off, w, depth, hh, color);
      if (dir === 'z-') this.box(x, z - off, w, depth, hh, color);
    }
  }
  container(x, z, rotated, color, stack = 1) {
    for (let i = 0; i < stack; i++) {
      const w = rotated ? 3.6 : 11, d = rotated ? 11 : 3.6;
      this.box(x, z, w, d, 3.6, color, { y: i * 3.6 });
      this.box(x, z, w * 1.01 - (rotated ? 0 : 0.6), d * 1.01 - (rotated ? 0.6 : 0), 0.3, 0x222222, { y: i * 3.6 + 3.45, collide: false });
    }
  }
  wallRing(half, h, color, thick = 4) {
    this.box(0, half + thick / 2, half * 2 + thick * 2, thick, h, color);
    this.box(0, -half - thick / 2, half * 2 + thick * 2, thick, h, color);
    this.box(half + thick / 2, 0, thick, half * 2, h, color);
    this.box(-half - thick / 2, 0, thick, half * 2, h, color);
  }
  build(theme) {
    const group = new THREE.Group();
    const solidMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, metalness: theme.metal ?? 0.2, roughness: theme.rough ?? 0.8 });
    const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: true });
    if (this.solid.length) {
      const g = mergeGeometries(this.solid, false); this.solid.forEach((x) => x.dispose());
      const m = new THREE.Mesh(g, solidMat); m.receiveShadow = true; m.castShadow = true; group.add(m);
    }
    if (this.glow.length) {
      const g = mergeGeometries(this.glow, false); this.glow.forEach((x) => x.dispose());
      group.add(new THREE.Mesh(g, glowMat));
    }
    group.userData.mats = [solidMat, glowMat];
    return group;
  }
}

// ---------------------------------------------------------------------------
// Themes
// ---------------------------------------------------------------------------
const THEMES = {
  industrial: { skyTop: 0x5d7389, skyBot: 0xc9b9a0, fog: 0xa9a196, fogD: 0.0055, ground: 0x5d5a55, hemiS: 0xc8d4e0, hemiG: 0x4a4038, hemiI: 1.1, sun: 0xffe2c0, sunI: 1.9, sunDir: [0.5, 0.8, 0.3] },
  desert: { skyTop: 0x4a86c8, skyBot: 0xf0d6a8, fog: 0xe6cfa3, fogD: 0.0035, ground: 0xc9a46c, hemiS: 0xd8e8ff, hemiG: 0x9c7a4a, hemiI: 1.2, sun: 0xfff0d0, sunI: 2.3, sunDir: [-0.4, 0.9, 0.2] },
  frozen: { skyTop: 0x8aa3b8, skyBot: 0xdfe8ef, fog: 0xd4dee6, fogD: 0.011, ground: 0xe8eef3, hemiS: 0xe0f0ff, hemiG: 0x8a9aa8, hemiI: 1.3, sun: 0xdde8ff, sunI: 1.2, sunDir: [0.3, 0.7, -0.5], snow: true },
  neon: { skyTop: 0x05040f, skyBot: 0x3a1650, fog: 0x231338, fogD: 0.0065, ground: 0x3a3946, hemiS: 0x9a8ad0, hemiG: 0x40305a, hemiI: 1.6, sun: 0xb0c4ff, sunI: 1.4, sunDir: [0.2, 0.9, 0.4] },
  volcanic: { skyTop: 0x1a0d0a, skyBot: 0x6b2a12, fog: 0x3a1a10, fogD: 0.008, ground: 0x2a2523, hemiS: 0xff9a60, hemiG: 0x301010, hemiI: 0.9, sun: 0xffa070, sunI: 1.3, sunDir: [-0.3, 0.8, 0.5], embers: true },
  orbital: { skyTop: 0x000005, skyBot: 0x0a1028, fog: 0x0a0f20, fogD: 0.003, ground: 0x4a5260, hemiS: 0x9ab8ff, hemiG: 0x30343c, hemiI: 1.0, sun: 0xeaf2ff, sunI: 1.8, sunDir: [0.6, 0.6, -0.4], metal: 0.6, rough: 0.45, space: true },
};

// ---------------------------------------------------------------------------
// Layouts
// ---------------------------------------------------------------------------
const LAYOUTS = {
  industrial(b) {
    const H = 90;
    b.wallRing(H, 16, 0x6e6a64);
    for (let i = -80; i <= 80; i += 20) { b.box(i, H - 2, 4, 3, 22, 0x56524c, { collide: false }); b.box(i, -H + 2, 4, 3, 22, 0x56524c, { collide: false }); }
    const factory = (x, z, w, d, h) => {
      b.box(x, z, w, d, h, 0x7c766c);
      b.box(x, z, w + 0.6, d + 0.6, 1.2, 0x4d4944, { y: h, collide: false });
      for (let i = -w / 2 + 3; i < w / 2 - 2; i += 4) b.glowBox(x + i, z + d / 2 + 0.05, 2.2, 0.1, 1.2, 0xffcf7a, h * 0.6);
      b.box(x, z + d / 2 + 0.2, Math.min(10, w * 0.4), 0.5, h * 0.45, 0x3a3936, { collide: false });
    };
    factory(-52, 48, 34, 22, 15); factory(50, 52, 30, 20, 13); factory(-55, -50, 28, 22, 14); factory(52, -48, 32, 22, 16);
    // smokestacks
    b.cyl(-62, 62, 3, 34, 0x8a4b3a); b.cyl(62, -62, 3, 30, 0x8a4b3a);
    b.glowBox(-62, 62, 6.2, 6.2, 0.6, 0xff6633, 34);
    // catwalk platforms with stairs
    b.box(0, 38, 26, 7, 5, 0x5a6470); b.stairs(-13, 38, 'x-', 6, 5, 0x5a6470, 3);
    b.box(0, -38, 26, 7, 5, 0x5a6470); b.stairs(13, -38, 'x+', 6, 5, 0x5a6470, 3);
    b.glowBox(0, 41.6, 26, 0.2, 0.2, 0xffaa33, 5); b.glowBox(0, -41.6, 26, 0.2, 0.2, 0xffaa33, 5);
    // containers
    const cols = [0xb5462e, 0x2e6fb5, 0x3c8c4a, 0xd1a530, 0x8a8f96];
    const conts = [[-20, 10, false, 2], [-24, 2, true, 1], [22, -8, false, 2], [26, 0, true, 1], [-10, -20, false, 1], [12, 20, false, 1],
      [-75, 10, true, 2], [75, -10, true, 2], [-75, -20, true, 1], [75, 22, true, 1], [-30, 70, false, 1], [32, -72, false, 1], [0, 70, false, 2], [0, -70, false, 2],
      [-38, -18, true, 1], [38, 18, true, 1]];
    conts.forEach(([x, z, r, s], i) => b.container(x, z, r, cols[i % cols.length], s));
    // center yard: low cover
    b.box(0, 0, 8, 2, 2.6, 0x77736c); b.box(-8, 8, 2, 6, 2.6, 0x77736c); b.box(8, -8, 2, 6, 2.6, 0x77736c);
    b.cyl(0, 0, 1.2, 0.3, 0xffcc00, { y: 2.6, collide: false, glow: true });
    // pipes
    b.box(-30, 30, 2, 2, 2, 0x8f7d5a, { y: 6, collide: false }); b.box(-30, 30, 30, 1.6, 1.6, 0x8f7d5a, { y: 7, collide: false });
    b.props.push(...[[-14, 14], [14, -14], [-40, 0], [40, 0], [5, 30], [-5, -30]].map(([x, z]) => ({ type: 'barrel', x, z })));
    return { half: H, playerSpawns: [[0, -78], [-8, -78], [8, -78], [-16, -76]], enemySpawns: [[0, 78], [-30, 80], [30, 80], [-70, 60], [70, 60], [-70, 0], [70, 0]],
      points: [[-62, 0], [0, 0], [62, 0]] };
  },

  desert(b) {
    const H = 95;
    // perimeter cliffs
    for (let i = -H; i <= H; i += 14) {
      b.rock(i, H + 6, 12, 26, 0xa8774a); b.rock(i, -H - 6, 12, 26, 0xa8774a);
      b.rock(H + 6, i, 12, 26, 0xa8774a); b.rock(-H - 6, i, 12, 26, 0xa8774a);
    }
    b.wallRing(H + 2, 20, 0x9a6d42, 2);
    // outpost center
    b.box(0, 0, 16, 16, 7, 0xb59a74); b.box(0, 0, 17, 17, 0.8, 0x7b6a52, { y: 7, collide: false });
    b.glowBox(0, 8.1, 6, 0.2, 0.6, 0x7cf0ff, 4.5);
    b.cyl(0, 0, 0.4, 6, 0x666666, { y: 7, collide: false }); b.dome(0, 0, 2.2, 0xd0d0d0, { y: 13 });
    // sandbag walls / bunkers
    const bunker = (x, z, rot) => { b.box(x, z, rot ? 2.5 : 12, rot ? 12 : 2.5, 3, 0x9c8a66); };
    bunker(-22, 14, false); bunker(22, -14, false); bunker(-14, -22, true); bunker(14, 22, true);
    // watchtowers (platforms) with stairs
    const tower = (x, z, dir) => { b.box(x, z, 8, 8, 6, 0x8a7656); b.stairs(x + (dir === 'x+' ? 4 : dir === 'x-' ? -4 : 0), z + (dir === 'z+' ? 4 : dir === 'z-' ? -4 : 0), dir, 4, 6, 0x8a7656, 3); b.box(x, z, 8.4, 8.4, 0.5, 0x6a5a40, { y: 6, collide: false }); };
    tower(-50, -50, 'x+'); tower(50, 50, 'x-'); tower(-55, 45, 'z-'); tower(55, -45, 'z+');
    // rock formations
    const rocks = [[-30, 40, 8, 10], [35, -35, 9, 11], [-60, 0, 10, 14], [60, 0, 10, 14], [-20, -60, 7, 8], [22, 62, 7, 8], [-70, 70, 9, 12], [72, -70, 9, 12],
      [-38, -12, 5, 6], [40, 10, 5, 6], [0, 45, 6, 7], [0, -45, 6, 7], [-75, -40, 6, 9], [76, 38, 6, 9]];
    rocks.forEach(([x, z, s, h]) => b.rock(x, z, s, h, 0xb07e4c));
    // mesa with ramp-steps
    b.box(-72, -75, 18, 16, 8, 0xa47448); b.stairs(-63, -75, 'x+', 6, 8, 0xa47448, 4);
    b.box(72, 75, 18, 16, 8, 0xa47448); b.stairs(63, 75, 'x-', 6, 8, 0xa47448, 4);
    // radar dish
    b.cyl(30, 30, 0.6, 8, 0x777777, { collide: false }); b.dome(30, 30, 4, 0xdddddd, { y: 8 });
    b.box(30, 30, 3, 3, 8, 0x555555, { inset: 0.5 });
    b.props.push(...[[-8, 12], [8, -12], [-26, 10], [26, -10]].map(([x, z]) => ({ type: 'barrel', x, z })));
    return { half: H, playerSpawns: [[0, -82], [-8, -82], [8, -82], [-16, -80]], enemySpawns: [[0, 82], [-40, 82], [40, 82], [-82, 30], [82, 30], [-82, -20], [82, -20]],
      points: [[-55, 20], [0, 0], [55, -20]] };
  },

  frozen(b) {
    const H = 88;
    b.wallRing(H, 14, 0xc6d4de);
    for (let i = -H; i <= H; i += 16) { b.rock(i, H + 5, 10, 18, 0xdfe9f0, { collide: false }); b.rock(i, -H - 5, 10, 18, 0xdfe9f0, { collide: false }); b.rock(H + 5, i, 10, 18, 0xdfe9f0, { collide: false }); b.rock(-H - 5, i, 10, 18, 0xdfe9f0, { collide: false }); }
    // research labs
    const lab = (x, z, w, d, h) => {
      b.box(x, z, w, d, h, 0x9aa8b4); b.box(x, z, w + 0.8, d + 0.8, 0.8, 0xf2f6f9, { y: h, collide: false });
      for (let i = -w / 2 + 2.5; i < w / 2 - 1; i += 3.5) b.glowBox(x + i, z - d / 2 - 0.05, 1.8, 0.1, 1.2, 0x8fe8ff, h * 0.55);
    };
    lab(-45, 40, 26, 16, 10); lab(48, -40, 26, 16, 10); lab(-50, -45, 18, 18, 8); lab(50, 45, 18, 18, 8);
    b.dome(-20, 65, 10, 0xe8eef4); b.dome(22, -65, 10, 0xe8eef4); b.dome(70, 0, 8, 0xe8eef4); b.dome(-70, 0, 8, 0xe8eef4);
    // frozen lake center: low ice ridges
    b.box(0, 0, 36, 36, 0.15, 0x9fd4ee, { collide: false });
    const ridges = [[-14, 8, 10, 3, 3.2], [14, -8, 10, 3, 3.2], [-6, -16, 3, 9, 3.2], [6, 16, 3, 9, 3.2]];
    ridges.forEach(([x, z, w, d, h]) => b.box(x, z, w, d, h, 0xbfe6f5));
    // comm towers
    for (const [x, z] of [[-25, -10], [25, 10]]) { b.box(x, z, 2.5, 2.5, 22, 0x6a7680); b.glowBox(x, z, 1.2, 1.2, 1.2, 0xff4444, 22); }
    // elevated walkway
    b.box(0, 50, 30, 6, 6, 0x7a8894); b.stairs(15, 50, 'x+', 5, 6, 0x7a8894, 3);
    b.box(0, -50, 30, 6, 6, 0x7a8894); b.stairs(-15, -50, 'x-', 5, 6, 0x7a8894, 3);
    // snow piles / cover
    [[-30, 15], [30, -15], [-35, -20], [35, 22], [0, 30], [0, -30], [-60, 70], [60, -70], [-75, 40], [75, -40]].forEach(([x, z]) => b.rock(x, z, 4.5, 5, 0xf0f5f8));
    b.props.push(...[[-20, 30], [20, -30], [-40, 10], [40, -10]].map(([x, z]) => ({ type: 'barrel', x, z })));
    return { half: H, playerSpawns: [[0, -76], [-8, -76], [8, -76], [-16, -74]], enemySpawns: [[0, 76], [-30, 76], [30, 76], [-76, 30], [76, 30], [-76, -30], [76, -30]],
      points: [[-58, 0], [0, 0], [58, 0]] };
  },

  neon(b) {
    const H = 88;
    b.wallRing(H, 30, 0x1e1d26);
    const neonCols = [0xff2bd6, 0x22f3ff, 0xfff23a, 0x7c4dff, 0xff5a3c];
    const tower = (x, z, w, d, h) => {
      b.box(x, z, w, d, h, 0x3c3b4a);
      const c = neonCols[Math.floor(b.r() * neonCols.length)];
      for (let y = 4; y < h - 2; y += 3.2) {
        if (b.r() < 0.75) b.glowBox(x, z - d / 2 - 0.06, w * 0.8, 0.1, 0.35, 0x9ab6ff, y);
        if (b.r() < 0.75) b.glowBox(x, z + d / 2 + 0.06, w * 0.8, 0.1, 0.35, 0x9ab6ff, y);
      }
      b.glowBox(x - w / 2 - 0.06, z, 0.12, d * 0.9, 0.4, c, h - 1);
      b.glowBox(x + w / 2 + 0.06, z, 0.12, d * 0.9, 0.4, c, h - 1);
      if (b.r() < 0.6) b.glowBox(x, z - d / 2 - 0.3, w * 0.5, 0.2, 3, c, 6 + b.r() * 6);
    };
    // city blocks in a grid with streets
    const blocks = [-60, -24, 24, 60];
    for (const bx of blocks) for (const bz of blocks) {
      if (Math.abs(bx) < 30 && Math.abs(bz) < 30) continue; // central plaza
      const h = 18 + Math.floor(b.r() * 34);
      tower(bx, bz, 18, 18, h);
    }
    // plaza
    b.box(0, 0, 10, 10, 1.2, 0x3a3946);
    b.cyl(0, 0, 2, 6, 0x2c2b36, { y: 1.2 }); b.glowBox(0, 0, 3, 3, 0.4, 0xff2bd6, 7.2);
    // elevated highway
    b.box(0, 42, 70, 8, 7, 0x3b3a44); b.glowBox(0, 46.1, 70, 0.1, 0.3, 0x22f3ff, 7); b.glowBox(0, 37.9, 70, 0.1, 0.3, 0xff2bd6, 7);
    b.stairs(35, 42, 'x+', 6, 7, 0x3b3a44, 4); b.stairs(-35, 42, 'x-', 6, 7, 0x3b3a44, 4);
    // cars & barriers
    const car = (x, z, rot) => { b.box(x, z, rot ? 2.4 : 5, rot ? 5 : 2.4, 1.4, 0x4a4558); b.box(x, z, rot ? 2 : 3, rot ? 3 : 2, 0.9, 0x1b1a22, { y: 1.4, collide: false }); b.glowBox(x + (rot ? 0 : 2.55), z + (rot ? 2.55 : 0), rot ? 1.8 : 0.1, rot ? 0.1 : 1.8, 0.25, 0xfff6c0, 0.7); };
    [[-6, -42, false], [8, -40, false], [-42, -6, true], [42, 6, true], [-42, 20, true], [40, -24, true], [20, -42, false]].forEach(([x, z, r]) => car(x, z, r));
    [[-12, 14], [12, -14], [14, 12], [-14, -12]].forEach(([x, z]) => b.box(x, z, 6, 1.2, 2.4, 0x5e5a6e));
    // holo signs (animated)
    b.props.push(...[[-6, 20], [6, -20], [-20, -4], [20, 4], [-40, -40], [40, 40]].map(([x, z]) => ({ type: 'barrel', x, z })));
    return { half: H, playerSpawns: [[0, -78], [-6, -78], [6, -78], [-12, -76]], enemySpawns: [[0, 78], [-42, 78], [42, 78], [-78, 0], [78, 0], [-78, 42], [78, -42]],
      points: [[-42, -42], [0, 0], [42, 42]] };
  },

  volcanic(b) {
    const H = 92;
    for (let i = -H; i <= H; i += 13) { b.rock(i, H + 6, 12, 30, 0x2b2421); b.rock(i, -H - 6, 12, 30, 0x2b2421); b.rock(H + 6, i, 12, 30, 0x2b2421); b.rock(-H - 6, i, 12, 30, 0x2b2421); }
    b.wallRing(H + 2, 20, 0x221c1a, 2);
    // lava rivers (hazards) with bridges
    const lava = (x, z, w, d) => {
      b.glowBox(x, z, w, d, 0.12, 0xff5a12, 0.02);
      b.hazards.push({ type: 'lava', minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, dps: 70 });
    };
    lava(-30, 0, 10, 150); lava(30, 0, 10, 150); lava(0, 60, 50, 9); lava(0, -60, 50, 9);
    const bridge = (x, z, w, d) => { b.box(x, z, w, d, 1.0, 0x4a3f3a); b.glowBox(x, z - d / 2 - 0.05, w, 0.1, 0.15, 0xffa040, 1.0); };
    bridge(-30, 0, 14, 8); bridge(30, 0, 14, 8); bridge(-30, 50, 14, 8); bridge(30, -50, 14, 8); bridge(-30, -45, 14, 8); bridge(30, 45, 14, 8);
    bridge(0, 60, 8, 13); bridge(0, -60, 8, 13);
    // spires & ridges
    [[-55, 30, 7, 20], [55, -30, 7, 20], [-60, -40, 8, 16], [60, 40, 8, 16], [-12, 25, 5, 9], [12, -25, 5, 9], [-70, 75, 9, 18], [70, -75, 9, 18], [-10, -30, 4, 6], [10, 30, 4, 6]]
      .forEach(([x, z, s, h]) => b.rock(x, z, s, h, 0x3a302b));
    b.box(-62, 0, 6, 26, 4.5, 0x352c28); b.box(62, 0, 6, 26, 4.5, 0x352c28);
    // central altar platform
    b.box(0, 0, 18, 18, 3, 0x3d3430); b.stairs(0, 9, 'z+', 6, 3, 0x3d3430, 2); b.stairs(0, -9, 'z-', 6, 3, 0x3d3430, 2);
    b.glowBox(0, 0, 4, 4, 0.2, 0xff7a20, 3);
    b.box(-6, 6, 2, 2, 3.5, 0x2a2320, { y: 3 }); b.box(6, -6, 2, 2, 3.5, 0x2a2320, { y: 3 });
    // vents
    [[-45, 70], [45, -70], [-75, -10], [75, 10]].forEach(([x, z]) => { b.cyl(x, z, 3, 2.5, 0x2a2320); b.glowBox(x, z, 3.5, 3.5, 0.2, 0xff6a1a, 2.5); });
    return { half: H, playerSpawns: [[0, -80], [-8, -80], [8, -80], [-14, -78]], enemySpawns: [[0, 80], [-50, 80], [50, 80], [-80, 30], [80, 30], [-80, -30], [80, -30]],
      points: [[-60, 0], [0, 0], [60, 0]] };
  },

  orbital(b) {
    const H = 85;
    // glass/metal perimeter
    b.wallRing(H, 12, 0x5a6270);
    for (let i = -H + 10; i < H; i += 20) { b.glowBox(i, H - 0.1, 14, 0.2, 0.3, 0x5ad1ff, 10); b.glowBox(i, -H + 0.1, 14, 0.2, 0.3, 0x5ad1ff, 10); }
    // floor glow lines
    for (let i = -80; i <= 80; i += 20) { b.glowBox(i, 0, 0.3, 170, 0.04, 0x3a7aff, 0.01); b.glowBox(0, i, 170, 0.3, 0.04, 0x3a7aff, 0.01); }
    // reactor core
    b.cyl(0, 0, 6, 4, 0x3a404c); b.cyl(0, 0, 3, 14, 0x7ad0ff, { y: 4, glow: true, collide: false });
    b.boxes.push({ minX: -3, maxX: 3, minY: 0, maxY: 18, minZ: -3, maxZ: 3, cover: true });
    b.anim.push('core');
    // interior halls: wall segments with gaps
    const wall = (x, z, w, d, h = 10) => { b.box(x, z, w, d, h, 0x6c7482); b.glowBox(x, z, w + 0.05, d + 0.05, 0.25, 0x5ad1ff, h - 1); };
    wall(-40, 25, 30, 2); wall(40, -25, 30, 2); wall(-40, -25, 30, 2); wall(40, 25, 30, 2);
    wall(-25, 50, 2, 30); wall(25, -50, 2, 30); wall(25, 55, 2, 20); wall(-25, -55, 2, 20);
    wall(-65, 0, 2, 26); wall(65, 0, 2, 26);
    // elevated platforms with stairs
    const plat = (x, z, dir) => { b.box(x, z, 14, 14, 6, 0x4f5764); b.glowBox(x, z, 14.1, 14.1, 0.15, 0x7af0ff, 6); b.stairs(x + (dir === 'x+' ? 7 : dir === 'x-' ? -7 : 0), z + (dir === 'z+' ? 7 : dir === 'z-' ? -7 : 0), dir, 5, 6, 0x4f5764, 3); };
    plat(-55, 55, 'z-'); plat(55, -55, 'z+'); plat(55, 55, 'x-'); plat(-55, -55, 'x+');
    // crates & pillars
    [[-15, 15], [15, -15], [-15, -15], [15, 15]].forEach(([x, z]) => { b.box(x, z, 4, 4, 4, 0x8a92a0); b.glowBox(x, z, 4.05, 4.05, 0.1, 0xffaa33, 2); });
    [[-40, 0], [40, 0], [0, 40], [0, -40]].forEach(([x, z]) => b.cyl(x, z, 2, 12, 0x707888, { seg: 8 }));
    b.props.push(...[[-10, 30], [10, -30], [30, 10], [-30, -10]].map(([x, z]) => ({ type: 'barrel', x, z })));
    return { half: H, playerSpawns: [[0, -74], [-8, -74], [8, -74], [-14, -72]], enemySpawns: [[0, 74], [-40, 74], [40, 74], [-74, 40], [74, 40], [-74, -40], [74, -40]],
      points: [[-50, 0], [0, 25], [50, 0]], gravity: 0.6 };
  },

  // ---------------- Boss arenas ----------------
  foundry(b) {
    const H = 70;
    b.wallRing(H, 18, 0x5e5850);
    for (let a = 0; a < 8; a++) { const ang = a / 8 * Math.PI * 2; b.cyl(Math.cos(ang) * 40, Math.sin(ang) * 40, 3, 14, 0x6a645a); }
    [[-55, -55], [55, 55], [-55, 55], [55, -55]].forEach(([x, z]) => { b.cyl(x, z, 6, 6, 0x4a4540); b.glowBox(x, z, 9, 9, 0.2, 0xff7a1a, 6); });
    [[-20, 0], [20, 0], [0, 22], [0, -22]].forEach(([x, z]) => b.box(x, z, 6, 2, 3, 0x77736c));
    b.box(-25, -40, 12, 4, 3, 0x77736c); b.box(25, 40, 12, 4, 3, 0x77736c);
    return { half: H, playerSpawns: [[0, -55], [-8, -55], [8, -55]], enemySpawns: [[0, 45], [-40, 50], [40, 50]], points: [[0, 0]] };
  },
  mirage(b) {
    const H = 68;
    b.wallRing(H, 24, 0x15141c);
    for (let i = -60; i <= 60; i += 12) { b.glowBox(i, 0, 0.2, 136, 0.03, 0xff1f4b, 0.01); b.glowBox(0, i, 136, 0.2, 0.03, 0x3a1aff, 0.01); }
    [[-30, -30], [30, 30], [-30, 30], [30, -30], [0, 45], [0, -45], [45, 0], [-45, 0]].forEach(([x, z]) => {
      b.box(x, z, 5, 5, 10, 0x22212c); b.glowBox(x, z, 5.1, 5.1, 0.2, 0xff1f4b, 10); b.glowBox(x, z, 5.1, 5.1, 0.2, 0xff1f4b, 3);
    });
    [[-15, 0], [15, 0], [0, 15], [0, -15]].forEach(([x, z]) => b.box(x, z, 4, 4, 3, 0x3a3946));
    return { half: H, playerSpawns: [[0, -55], [-8, -55], [8, -55]], enemySpawns: [[0, 50], [-40, 40], [40, 40]], points: [[0, 0]] };
  },
  citadel(b) {
    const H = 80;
    b.wallRing(H, 22, 0x2c2522);
    const lava = (x, z, w, d) => { b.glowBox(x, z, w, d, 0.12, 0xff5a12, 0.02); b.hazards.push({ type: 'lava', minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, dps: 60 }); };
    lava(-60, 0, 10, 60); lava(60, 0, 10, 60);
    // fortress walls segments
    [[-30, 30, 20, 3], [30, 30, 20, 3], [-30, -30, 20, 3], [30, -30, 20, 3], [0, 50, 3, 14], [0, -50, 3, 14]].forEach(([x, z, w, d]) => { b.box(x, z, w, d, 6, 0x4a403b); b.glowBox(x, z, w + 0.1, d + 0.1, 0.2, 0xb36bff, 6); });
    [[-50, 50], [50, 50], [-50, -50], [50, -50]].forEach(([x, z]) => b.rock(x, z, 6, 10, 0x3a302b));
    // pylon pads
    [[-45, 20], [45, 20], [0, -45]].forEach(([x, z]) => b.glowBox(x, z, 6, 6, 0.1, 0x7d2bd6, 0.02));
    return { half: H, playerSpawns: [[0, -68], [-8, -68], [8, -68]], enemySpawns: [[0, 55], [-40, 60], [40, 60], [-65, 40], [65, 40]], points: [[0, 0]],
      pylons: [[-45, 20], [45, 20], [0, -45]] };
  },
  singularity(b) {
    const H = 75;
    b.wallRing(H, 10, 0x4a5260);
    for (let i = -70; i <= 70; i += 14) { b.glowBox(i, 0, 0.25, 150, 0.04, 0xff3df2, 0.01); }
    for (let a = 0; a < 12; a++) { const ang = a / 12 * Math.PI * 2; b.glowBox(Math.cos(ang) * 30, Math.sin(ang) * 30, 2, 2, 0.1, 0xff3df2, 0.02); }
    [[-35, 0], [35, 0], [0, 35], [0, -35]].forEach(([x, z]) => { b.box(x, z, 8, 3, 5, 0x6c7482); b.glowBox(x, z, 8.1, 3.1, 0.2, 0xff3df2, 5); });
    [[-50, 50], [50, -50], [50, 50], [-50, -50]].forEach(([x, z]) => { b.box(x, z, 10, 10, 4, 0x4f5764); b.stairs(x, z + (z > 0 ? -5 : 5), z > 0 ? 'z-' : 'z+', 4, 4, 0x4f5764, 2); });
    [[-20, 20], [20, -20], [20, 20], [-20, -20]].forEach(([x, z]) => b.cyl(x, z, 1.8, 8, 0x707888));
    return { half: H, playerSpawns: [[0, -62], [-8, -62], [8, -62]], enemySpawns: [[0, 45], [-45, 30], [45, 30], [-30, -30], [30, -30]], points: [[0, 0]], gravity: 0.8 };
  },
};
const LAYOUT_THEME = { industrial: 'industrial', desert: 'desert', frozen: 'frozen', neon: 'neon', volcanic: 'volcanic', orbital: 'orbital', foundry: 'industrial', mirage: 'neon', citadel: 'volcanic', singularity: 'orbital' };

// ---------------------------------------------------------------------------
// Sky
// ---------------------------------------------------------------------------
function makeSky(theme) {
  const geo = new THREE.SphereGeometry(900, 24, 12);
  const top = new THREE.Color(theme.skyTop), bot = new THREE.Color(theme.skyBot);
  const cols = []; const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const t = clamp(p.getY(i) / 900 * 1.6 + 0.15, 0, 1); const c = bot.clone().lerp(top, t); cols.push(c.r, c.g, c.b); }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  m.renderOrder = -10;
  const g = new THREE.Group(); g.add(m);
  if (theme.space || theme.skyTop < 0x101010) {
    const n = 900, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const v = new THREE.Vector3().randomDirection(); if (v.y < -0.1) v.y = -v.y; v.multiplyScalar(850); pos.set([v.x, v.y, v.z], i * 3); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false })));
  }
  if (theme.space) {
    const planet = new THREE.Mesh(new THREE.SphereGeometry(320, 32, 16), new THREE.MeshStandardMaterial({ color: 0x2a6fb5, roughness: 1, fog: false, emissive: 0x0a1a30 }));
    planet.position.set(-300, -420, 500); g.add(planet);
    const atm = new THREE.Mesh(new THREE.SphereGeometry(335, 32, 16), new THREE.MeshBasicMaterial({ color: 0x5ab0ff, transparent: true, opacity: 0.15, fog: false, side: THREE.BackSide }));
    atm.position.copy(planet.position); g.add(atm);
  }
  return g;
}

function makeGround(theme, half, seed) {
  const size = half * 2 + 260;
  const seg = 48;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg).toNonIndexed();
  geo.rotateX(-Math.PI / 2);
  const r = rng(seed + 7);
  const base = new THREE.Color(theme.ground);
  const n = geo.attributes.position.count;
  const cols = new Float32Array(n * 3);
  const p = geo.attributes.position;
  for (let i = 0; i < n; i += 3) {
    const k = 0.9 + r() * 0.16;
    for (let j = i; j < i + 3; j++) {
      // outside the play area add gentle terrain undulation
      const x = p.getX(j), z = p.getZ(j);
      const out = Math.max(Math.abs(x), Math.abs(z)) - half - 6;
      if (out > 0) p.setY(j, Math.min(out * 0.5, 30) * (0.5 + 0.5 * Math.sin(x * 0.05) * Math.cos(z * 0.05)));
      cols[j * 3] = base.r * k; cols[j * 3 + 1] = base.g * k; cols[j * 3 + 2] = base.b * k;
    }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: theme.space ? 0.5 : 0.05 }));
  m.receiveShadow = true;
  // grid accent for play area
  const grid = new THREE.GridHelper(half * 2, Math.round(half / 5), 0x000000, 0x000000);
  grid.material.transparent = true; grid.material.opacity = theme.space ? 0.25 : 0.07; grid.position.y = 0.02;
  const g = new THREE.Group(); g.add(m, grid);
  return g;
}

// ---------------------------------------------------------------------------
// Arena (world) object
// ---------------------------------------------------------------------------
export class Arena {
  constructor(id, quality = 'medium', condition = null) {
    this.id = id;
    const themeId = LAYOUT_THEME[id];
    this.theme = { ...THEMES[themeId] };
    this.themeId = themeId;
    const seed = [...id].reduce((a, c) => a * 31 + c.charCodeAt(0), 7);
    const b = new Builder(seed);
    const layout = LAYOUTS[id](b);
    this.half = layout.half;
    this.playerSpawns = layout.playerSpawns.map(([x, z]) => new THREE.Vector3(x, 0, z));
    this.enemySpawns = layout.enemySpawns.map(([x, z]) => new THREE.Vector3(x, 0, z));
    this.points = layout.points.map(([x, z]) => new THREE.Vector3(x, 0, z));
    this.pylons = (layout.pylons || []).map(([x, z]) => new THREE.Vector3(x, 0, z));
    this.gravityMul = layout.gravity || 1;
    this.boxes = b.boxes; this.hazards = b.hazards; this.props = b.props;
    this.group = new THREE.Group();
    this.group.add(b.build(this.theme));
    this.ground = makeGround(this.theme, this.half, seed);
    this.group.add(this.ground);
    this.sky = makeSky(this.theme);
    this.group.add(this.sky);
    this.anim = b.anim; this.time = 0;
    this._buildGrid();
    this.nav = new NavGrid(this);
    this._buildCover();
    // weather particles
    this.weather = null;
    if (this.theme.snow || this.theme.embers) {
      const n = quality === 'low' ? 250 : quality === 'high' ? 900 : 500;
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) pos.set([(Math.random() - 0.5) * 120, Math.random() * 40, (Math.random() - 0.5) * 120], i * 3);
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const mat = this.theme.snow
        ? new THREE.PointsMaterial({ color: 0xffffff, size: 0.35, transparent: true, opacity: 0.85, depthWrite: false })
        : new THREE.PointsMaterial({ color: 0xff8a3a, size: 0.3, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
      this.weather = new THREE.Points(g, mat);
      this.weather.frustumCulled = false;
      this.group.add(this.weather);
    }
    if (this.anim.includes('core')) {
      this.coreRing = new THREE.Mesh(new THREE.TorusGeometry(5, 0.3, 6, 24), new THREE.MeshBasicMaterial({ color: 0x7ad0ff }));
      this.coreRing.rotation.x = Math.PI / 2; this.coreRing.position.y = 10; this.group.add(this.coreRing);
    }
  }

  update(dt, focus) {
    this.time += dt;
    if (this.weather && focus) {
      const p = this.weather.geometry.attributes.position;
      const fall = this.theme.snow ? -3 : 2.5;
      for (let i = 0; i < p.count; i++) {
        let y = p.getY(i) + fall * dt * (0.6 + (i % 5) * 0.15);
        let x = p.getX(i) + Math.sin(this.time + i) * dt * 0.8;
        if (y < 0) y += 40; if (y > 40) y -= 40;
        p.setY(i, y); p.setX(i, x);
      }
      p.needsUpdate = true;
      this.weather.position.set(Math.round(focus.x / 60) * 60, 0, Math.round(focus.z / 60) * 60);
    }
    if (this.coreRing) { this.coreRing.position.y = 9 + Math.sin(this.time * 1.3) * 4; this.coreRing.rotation.z += dt; }
  }

  // ---------------- spatial grid for boxes ----------------
  _buildGrid() {
    this.cell = 16;
    this.gn = Math.ceil((this.half * 2 + 40) / this.cell);
    this.grid = new Array(this.gn * this.gn).fill(null).map(() => []);
    this.boxes.forEach((bx, i) => {
      const [x0, z0] = this._gc(bx.minX, bx.minZ), [x1, z1] = this._gc(bx.maxX, bx.maxZ);
      for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) this.grid[z * this.gn + x].push(bx);
    });
  }
  addDynamicBox(bx) {
    this.boxes.push(bx);
    const [x0, z0] = this._gc(bx.minX, bx.minZ), [x1, z1] = this._gc(bx.maxX, bx.maxZ);
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) this.grid[z * this.gn + x].push(bx);
    return bx;
  }
  _gc(x, z) {
    const o = this.half + 20;
    return [clamp(Math.floor((x + o) / this.cell), 0, this.gn - 1), clamp(Math.floor((z + o) / this.cell), 0, this.gn - 1)];
  }
  boxesNear(minX, minZ, maxX, maxZ, out) {
    out.length = 0;
    const [x0, z0] = this._gc(minX, minZ), [x1, z1] = this._gc(maxX, maxZ);
    this._stamp = (this._stamp || 0) + 1;
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      for (const bx of this.grid[z * this.gn + x]) { if (bx._s !== this._stamp && !bx.dead) { bx._s = this._stamp; out.push(bx); } }
    }
    return out;
  }

  /** Height of the walkable surface under (x,z) for a body of radius r whose feet are at y. */
  groundAt(x, z, r, feetY, stepUp = 1.4) {
    let h = 0;
    const near = this.boxesNear(x - r, z - r, x + r, z + r, this._tmp || (this._tmp = []));
    const rr = r * 0.55;
    for (const b of near) {
      if (x + rr > b.minX && x - rr < b.maxX && z + rr > b.minZ && z - rr < b.maxZ && b.maxY <= feetY + stepUp && b.maxY > h) h = b.maxY;
    }
    return h;
  }

  /** Push a vertical cylinder out of boxes. Mutates pos. Returns true if collided. */
  resolve(pos, r, height, stepUp = 1.4) {
    let hit = false;
    const near = this.boxesNear(pos.x - r, pos.z - r, pos.x + r, pos.z + r, this._tmp2 || (this._tmp2 = []));
    for (const b of near) {
      if (b.maxY <= pos.y + stepUp || b.minY >= pos.y + height) continue;
      const cx = clamp(pos.x, b.minX, b.maxX), cz = clamp(pos.z, b.minZ, b.maxZ);
      let dx = pos.x - cx, dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      hit = true;
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2), push = r - d;
        pos.x += dx / d * push; pos.z += dz / d * push;
      } else {
        // center inside box: push out along min penetration axis
        const pen = [pos.x - b.minX + r, b.maxX - pos.x + r, pos.z - b.minZ + r, b.maxZ - pos.z + r];
        const m = Math.min(...pen);
        if (m === pen[0]) pos.x = b.minX - r; else if (m === pen[1]) pos.x = b.maxX + r; else if (m === pen[2]) pos.z = b.minZ - r; else pos.z = b.maxZ + r;
      }
    }
    const lim = this.half - r;
    if (pos.x > lim) { pos.x = lim; hit = true; } if (pos.x < -lim) { pos.x = -lim; hit = true; }
    if (pos.z > lim) { pos.z = lim; hit = true; } if (pos.z < -lim) { pos.z = -lim; hit = true; }
    return hit;
  }

  /** Segment raycast against boxes and ground. Returns t (0..1) or -1. */
  raycast(p0, p1, groundToo = true) {
    let best = -1;
    const near = this.boxesNear(Math.min(p0.x, p1.x), Math.min(p0.z, p1.z), Math.max(p0.x, p1.x), Math.max(p0.z, p1.z), this._tmp3 || (this._tmp3 = []));
    for (const b of near) {
      const t = segBox(p0, p1, b);
      if (t >= 0 && (best < 0 || t < best)) best = t;
    }
    if (groundToo && p1.y < 0 && p0.y >= 0) {
      const t = p0.y / (p0.y - p1.y);
      if (best < 0 || t < best) best = t;
    }
    return best;
  }
  lineOfSight(a, b) { return this.raycast(a, b, false) < 0; }

  hazardAt(x, z, y) {
    if (y > 0.4) return null;
    for (const h of this.hazards) if (x > h.minX && x < h.maxX && z > h.minZ && z < h.maxZ) return h;
    return null;
  }

  // ---------------- cover points ----------------
  _buildCover() {
    const pts = [];
    const n = this.nav;
    for (let gz = 1; gz < n.n - 1; gz++) for (let gx = 1; gx < n.n - 1; gx++) {
      const i = gz * n.n + gx;
      if (n.blocked[i]) continue;
      // adjacent to a blocked cell that is tall cover
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const j = (gz + dz) * n.n + gx + dx;
        if (n.blocked[j] && n.tall[j]) {
          if ((gx + gz) % 2 === 0) {
            const p = n.toWorld(gx, gz);
            pts.push({ x: p.x, z: p.z, nx: -dx, nz: -dz });
          }
          break;
        }
      }
    }
    this.cover = pts;
  }
  coverNear(x, z, radius) {
    const r2 = radius * radius;
    return this.cover.filter((c) => (c.x - x) ** 2 + (c.z - z) ** 2 < r2);
  }

  /** Random walkable point near (x,z). */
  randomPointNear(x, z, radius, tries = 12) {
    for (let i = 0; i < tries; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * radius;
      const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      if (this.nav.walkable(px, pz)) return new THREE.Vector3(px, 0, pz);
    }
    return new THREE.Vector3(x, 0, z);
  }

  dispose() {
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
    });
  }
}

// ---------------------------------------------------------------------------
// Navigation grid + A*
// ---------------------------------------------------------------------------
export class NavGrid {
  constructor(arena) {
    this.arena = arena;
    this.cs = 2.5;
    this.half = arena.half;
    this.n = Math.ceil(arena.half * 2 / this.cs);
    const N = this.n * this.n;
    this.blocked = new Uint8Array(N);
    this.tall = new Uint8Array(N);
    this.cost = new Float32Array(N).fill(1);
    const margin = 2.2;
    for (const b of arena.boxes) {
      if (b.maxY < 1.5 || b.minY > 6) continue;
      const x0 = Math.floor((b.minX - margin + this.half) / this.cs), x1 = Math.floor((b.maxX + margin + this.half) / this.cs);
      const z0 = Math.floor((b.minZ - margin + this.half) / this.cs), z1 = Math.floor((b.maxZ + margin + this.half) / this.cs);
      for (let z = Math.max(0, z0); z <= Math.min(this.n - 1, z1); z++) for (let x = Math.max(0, x0); x <= Math.min(this.n - 1, x1); x++) {
        this.blocked[z * this.n + x] = 1;
        if (b.maxY >= 3.5) this.tall[z * this.n + x] = 1;
      }
    }
    // border
    for (let i = 0; i < this.n; i++) { this.blocked[i] = this.blocked[(this.n - 1) * this.n + i] = this.blocked[i * this.n] = this.blocked[i * this.n + this.n - 1] = 1; }
    for (const h of arena.hazards) {
      const x0 = Math.floor((h.minX + this.half) / this.cs), x1 = Math.floor((h.maxX + this.half) / this.cs);
      const z0 = Math.floor((h.minZ + this.half) / this.cs), z1 = Math.floor((h.maxZ + this.half) / this.cs);
      for (let z = Math.max(0, z0); z <= Math.min(this.n - 1, z1); z++) for (let x = Math.max(0, x0); x <= Math.min(this.n - 1, x1); x++) this.cost[z * this.n + x] = 12;
    }
    this.heap = new Int32Array(N); this.g = new Float32Array(N); this.f = new Float32Array(N); this.parent = new Int32Array(N); this.state = new Uint8Array(N);
  }
  toCell(x, z) { return [clamp(Math.floor((x + this.half) / this.cs), 0, this.n - 1), clamp(Math.floor((z + this.half) / this.cs), 0, this.n - 1)]; }
  toWorld(gx, gz) { return { x: (gx + 0.5) * this.cs - this.half, z: (gz + 0.5) * this.cs - this.half }; }
  walkable(x, z) { const [gx, gz] = this.toCell(x, z); return !this.blocked[gz * this.n + gx]; }
  isHazard(x, z) { const [gx, gz] = this.toCell(x, z); return this.cost[gz * this.n + gx] > 1; }

  /** True if straight line between points crosses no blocked (or hazard if avoid) cells. */
  clearLine(ax, az, bx, bz, avoidHazard = true) {
    const d = Math.hypot(bx - ax, bz - az);
    const steps = Math.ceil(d / (this.cs * 0.5));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const [gx, gz] = this.toCell(ax + (bx - ax) * t, az + (bz - az) * t);
      const k = gz * this.n + gx;
      if (this.blocked[k] || (avoidHazard && this.cost[k] > 1)) return false;
    }
    return true;
  }

  nearestFree(gx, gz) {
    if (!this.blocked[gz * this.n + gx]) return [gx, gz];
    for (let r = 1; r < 8; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      const x = gx + dx, z = gz + dz;
      if (x < 0 || z < 0 || x >= this.n || z >= this.n) continue;
      if (!this.blocked[z * this.n + x]) return [x, z];
    }
    return [gx, gz];
  }

  /** A* path. Returns array of {x,z} world waypoints (smoothed) or null. */
  findPath(ax, az, bx, bz, maxIter = 3500) {
    const n = this.n;
    let [sx, sz] = this.nearestFree(...this.toCell(ax, az));
    let [ex, ez] = this.nearestFree(...this.toCell(bx, bz));
    const start = sz * n + sx, goal = ez * n + ex;
    if (start === goal) return [{ x: bx, z: bz }];
    this.state.fill(0);
    const heap = this.heap; let hn = 0;
    const g = this.g, f = this.f, parent = this.parent, state = this.state;
    const h = (i) => { const x = i % n, z = (i / n) | 0; const dx = Math.abs(x - ex), dz = Math.abs(z - ez); return (dx + dz) + (1.414 - 2) * Math.min(dx, dz); };
    const push = (i) => {
      let k = hn++; heap[k] = i;
      while (k > 0) { const p = (k - 1) >> 1; if (f[heap[p]] <= f[heap[k]]) break; const t = heap[p]; heap[p] = heap[k]; heap[k] = t; k = p; }
    };
    const pop = () => {
      const top = heap[0]; heap[0] = heap[--hn]; let k = 0;
      for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < hn && f[heap[l]] < f[heap[m]]) m = l; if (r < hn && f[heap[r]] < f[heap[m]]) m = r; if (m === k) break; const t = heap[m]; heap[m] = heap[k]; heap[k] = t; k = m; }
      return top;
    };
    g[start] = 0; f[start] = h(start); parent[start] = -1; state[start] = 1; push(start);
    let found = false, iter = 0;
    const dirs = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    while (hn > 0 && iter++ < maxIter) {
      const cur = pop();
      if (cur === goal) { found = true; break; }
      state[cur] = 2;
      const cx = cur % n, cz = (cur / n) | 0;
      for (const [dx, dz, c] of dirs) {
        const x = cx + dx, z = cz + dz;
        if (x < 0 || z < 0 || x >= n || z >= n) continue;
        const ni = z * n + x;
        if (this.blocked[ni] || state[ni] === 2) continue;
        if (dx && dz && (this.blocked[cz * n + x] || this.blocked[z * n + cx])) continue;
        const ng = g[cur] + c * this.cost[ni];
        if (state[ni] === 1 && ng >= g[ni]) continue;
        g[ni] = ng; f[ni] = ng + h(ni); parent[ni] = cur;
        if (state[ni] !== 1) { state[ni] = 1; push(ni); }
        else push(ni);
      }
    }
    if (!found) return null;
    const cells = [];
    for (let c = goal; c !== -1; c = parent[c]) cells.push(c);
    cells.reverse();
    const pts = cells.map((c) => this.toWorld(c % n, (c / n) | 0));
    pts[pts.length - 1] = { x: bx, z: bz };
    // string-pull smoothing
    const out = [];
    let anchor = { x: ax, z: az }, i = 0;
    while (i < pts.length - 1) {
      let j = pts.length - 1;
      while (j > i + 1 && !this.clearLine(anchor.x, anchor.z, pts[j].x, pts[j].z)) j--;
      out.push(pts[j]); anchor = pts[j]; i = j;
    }
    if (!out.length) out.push(pts[pts.length - 1]);
    return out;
  }
}
