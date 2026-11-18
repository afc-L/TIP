// Procedural texture library. Everything is generated on canvases at load time so the
// game ships with no binary assets; each surface gets a colour map and a normal map
// derived from a height field so lighting picks up real surface relief.
import * as THREE from 'three';
import { mulberry32, noise2, fbm, clamp } from './util.js';

const cache = new Map();
let SIZE = 512;
export function setTextureQuality(q) { SIZE = q === 'low' ? 256 : 512; }

function canvas(w, h = w) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return c;
}

// Generic generator: fn(x,y,rand) -> [r,g,b,height]
function generate(name, size, fn, { repeat = 1, normalStrength = 2, anisotropy = 4, srgb = true } = {}) {
  const key = name + size;
  if (cache.has(key)) return cache.get(key);
  const c = canvas(size); const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const hgt = new Float32Array(size * size);
  const r = mulberry32(name.length * 977 + size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const o = fn(x / size, y / size, r);
    const i = (y * size + x) * 4;
    img.data[i] = clamp(o[0], 0, 255); img.data[i + 1] = clamp(o[1], 0, 255); img.data[i + 2] = clamp(o[2], 0, 255); img.data[i + 3] = o[4] !== undefined ? o[4] : 255;
    hgt[y * size + x] = o[3];
  }
  ctx.putImageData(img, 0, 0);
  const map = new THREE.CanvasTexture(c);
  map.wrapS = map.wrapT = THREE.RepeatWrapping; map.anisotropy = anisotropy;
  if (srgb) map.colorSpace = THREE.SRGBColorSpace;
  map.repeat.set(repeat, repeat);
  // normal map from height via Sobel
  const nc = canvas(size); const nctx = nc.getContext('2d');
  const nimg = nctx.createImageData(size, size);
  const H = (x, y) => hgt[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (H(x + 1, y - 1) + 2 * H(x + 1, y) + H(x + 1, y + 1)) - (H(x - 1, y - 1) + 2 * H(x - 1, y) + H(x - 1, y + 1));
    const dy = (H(x - 1, y + 1) + 2 * H(x, y + 1) + H(x + 1, y + 1)) - (H(x - 1, y - 1) + 2 * H(x, y - 1) + H(x + 1, y - 1));
    let nx = -dx * normalStrength, ny = -dy * normalStrength, nz = 1;
    const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const i = (y * size + x) * 4;
    nimg.data[i] = (nx * 0.5 + 0.5) * 255; nimg.data[i + 1] = (-ny * 0.5 + 0.5) * 255; nimg.data[i + 2] = (nz * 0.5 + 0.5) * 255; nimg.data[i + 3] = 255;
  }
  nctx.putImageData(nimg, 0, 0);
  const normalMap = new THREE.CanvasTexture(nc);
  normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping; normalMap.anisotropy = anisotropy;
  const out = { map, normalMap };
  cache.set(key, out);
  return out;
}

const tile = (u, v, f) => [u * f, v * f]; // periodic sampling helper for tileable noise
// Tileable fbm: blend 4 samples so edges wrap.
function tfbm(u, v, scale, oct = 4) {
  const a = fbm(u * scale, v * scale, oct), b = fbm((u - 1) * scale, v * scale, oct);
  const c = fbm(u * scale, (v - 1) * scale, oct), d = fbm((u - 1) * scale, (v - 1) * scale, oct);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

const defs = {
  asphalt: (u, v) => {
    const n = tfbm(u, v, 24, 3), g = tfbm(u, v, 90, 2);
    const crack = Math.abs(tfbm(u, v, 5, 3) - 0.5) < 0.005 ? -10 : 0;
    const c = 38 + n * 30 + g * 20 + crack;
    return [c, c, c + 3, n * 0.6 + g * 0.4 + crack / 60];
  },
  wetAsphalt: (u, v) => {
    const n = tfbm(u, v, 20, 3), g = tfbm(u, v, 80, 2);
    const puddle = tfbm(u, v, 3, 3) > 0.58 ? 1 : 0;
    const c = 26 + n * 22 + g * 12 - puddle * 10;
    return [c, c, c + 4, puddle ? 0.2 : n * 0.5 + g * 0.5];
  },
  concrete: (u, v) => {
    const n = tfbm(u, v, 10, 4), g = tfbm(u, v, 60, 2);
    const seam = (u % 0.5 < 0.006 || v % 0.5 < 0.006) ? -25 : 0;
    const c = 105 + n * 50 + g * 20 + seam;
    return [c, c * 0.98, c * 0.95, n * 0.5 + g * 0.5 + seam / 50];
  },
  brick: (u, v) => {
    const rows = 16, row = Math.floor(v * rows), off = (row % 2) * 0.5;
    const cols = 8, bu = (u * cols + off) % 1, bv = (v * rows) % 1;
    const mortar = bu < 0.06 || bv < 0.12;
    const id = Math.floor(u * cols + off) * 31 + row * 17;
    const tint = (Math.sin(id * 12.9898) * 43758.5453) % 1;
    const n = tfbm(u, v, 40, 2);
    if (mortar) { const c = 70 + n * 30; return [c, c * 0.97, c * 0.92, 0]; }
    return [95 + tint * 40 + n * 30, 42 + tint * 15 + n * 15, 32 + n * 10, 0.7 + n * 0.3];
  },
  siding: (u, v) => {
    const b = (v * 12) % 1, n = tfbm(u, v, 30, 3);
    const h = b < 0.1 ? 0 : 0.5 + b * 0.5;
    const c = 150 + n * 30 - (b < 0.1 ? 50 : 0);
    return [c, c, c * 0.97, h + n * 0.1];
  },
  shingles: (u, v) => {
    const rows = 14, row = Math.floor(v * rows), off = (row % 2) * 0.5;
    const bu = (u * 10 + off) % 1, bv = (v * rows) % 1;
    const n = tfbm(u, v, 50, 2);
    const edge = bu < 0.05 || bv > 0.9;
    const c = 40 + n * 25 - (edge ? 18 : 0);
    return [c, c * 0.95, c * 0.93, edge ? 0 : 0.4 + bv * 0.6];
  },
  grass: (u, v, r) => {
    const n = tfbm(u, v, 12, 4), g = tfbm(u, v, 120, 2), b = tfbm(u, v, 3, 3);
    return [28 + n * 30 + b * 20, 45 + n * 40 + g * 25, 20 + n * 15, g];
  },
  forestFloor: (u, v) => {
    const n = tfbm(u, v, 14, 4), g = tfbm(u, v, 100, 2), m = tfbm(u, v, 4, 3);
    const leaf = g > 0.62;
    return [45 + n * 30 + (leaf ? 30 : 0) + m * 10, 38 + n * 25 + (leaf ? 10 : 0) + m * 20, 25 + n * 12, g + n * 0.5];
  },
  dirt: (u, v) => {
    const n = tfbm(u, v, 16, 4), g = tfbm(u, v, 90, 2);
    return [70 + n * 40, 55 + n * 30, 40 + n * 20, n * 0.7 + g * 0.3];
  },
  rock: (u, v) => {
    const n = tfbm(u, v, 8, 5), g = tfbm(u, v, 50, 3);
    const c = 70 + n * 60 + g * 20;
    return [c, c * 0.98, c * 0.95, n];
  },
  bark: (u, v) => {
    const n = tfbm(u * 4, v * 0.6, 6, 4);
    const ridge = Math.abs(Math.sin(u * 40 + n * 6));
    const c = 35 + ridge * 30 + n * 20;
    return [c, c * 0.8, c * 0.62, ridge * 0.8 + n * 0.2];
  },
  woodFloor: (u, v) => {
    const plank = Math.floor(u * 6), pv = (v * 2 + plank * 0.37) % 1;
    const grain = Math.sin((v + plank) * 60 + tfbm(u, v, 20, 2) * 10) * 0.5 + 0.5;
    const seam = (u * 6) % 1 < 0.03 || pv < 0.01;
    const c = 85 + grain * 30 - (seam ? 40 : 0) + plank * 3;
    return [c, c * 0.68, c * 0.45, seam ? 0 : 0.5 + grain * 0.2];
  },
  planks: (u, v) => {
    const plank = Math.floor(v * 5), grain = Math.sin(u * 80 + tfbm(u, v, 12, 2) * 12) * 0.5 + 0.5;
    const seam = (v * 5) % 1 < 0.04;
    const n = tfbm(u, v, 30, 2);
    const c = 60 + grain * 25 + n * 20 - (seam ? 35 : 0) + plank * 4;
    return [c, c * 0.75, c * 0.55, seam ? 0 : 0.5 + grain * 0.3];
  },
  tile: (u, v) => {
    const t = 8, bu = (u * t) % 1, bv = (v * t) % 1;
    const grout = bu < 0.04 || bv < 0.04;
    const n = tfbm(u, v, 30, 3), stain = tfbm(u, v, 4, 4);
    const c = grout ? 90 : 185 + n * 20 - stain * 60;
    return [c * 0.95, c, c * 0.97, grout ? 0 : 0.6];
  },
  hospitalWall: (u, v) => {
    const n = tfbm(u, v, 8, 4), stain = tfbm(u, v, 3, 4), drip = tfbm(u * 8, v * 0.5, 4, 3);
    const lower = v > 0.62;
    let c = lower ? 120 : 175;
    c += n * 20 - stain * 50 - (drip > 0.6 ? 30 : 0);
    const stripe = Math.abs(v - 0.62) < 0.01 ? -60 : 0;
    return lower ? [c * 0.8 + stripe, c + stripe, c * 0.92 + stripe, n] : [c + stripe, c * 0.98 + stripe, c * 0.88 + stripe, n * 0.4];
  },
  wallpaper: (u, v) => {
    const pat = Math.sin(u * 60) * Math.sin(v * 60 + Math.sin(u * 30) * 2);
    const n = tfbm(u, v, 6, 3), stain = tfbm(u, v, 2.5, 4);
    const c = 120 + pat * 12 + n * 20 - stain * 40;
    return [c * 0.95, c * 0.88, c * 0.72, pat * 0.1];
  },
  plaster: (u, v) => {
    const n = tfbm(u, v, 12, 4), g = tfbm(u, v, 60, 2);
    const c = 160 + n * 30 + g * 10;
    return [c, c * 0.97, c * 0.93, n * 0.3 + g * 0.2];
  },
  carpet: (u, v) => {
    const n = tfbm(u, v, 80, 2), m = tfbm(u, v, 6, 3);
    return [70 + n * 30 + m * 20, 35 + n * 15, 35 + n * 15, n];
  },
  metal: (u, v) => {
    const n = tfbm(u, v, 6, 4), s = tfbm(u * 20, v, 10, 2), rust = tfbm(u, v, 3, 4) > 0.6;
    const c = 110 + n * 30 + s * 20;
    return rust ? [110 + n * 40, 60 + n * 20, 35, n] : [c, c, c * 1.02, s * 0.3];
  },
  cloth: (u, v) => {
    const w = (Math.sin(u * 300) * Math.sin(v * 300)) * 0.5 + 0.5, n = tfbm(u, v, 10, 3);
    const c = 180 + w * 30 + n * 30;
    return [c, c, c, w * 0.4];
  },
  skin: (u, v) => {
    // Monster skin: grey-pale with dark veins, wrinkles and mottling.
    const n = tfbm(u, v, 10, 5), w = tfbm(u * 3, v * 0.7, 20, 3);
    const vein = Math.abs(tfbm(u, v, 5, 4) - 0.5) < 0.012 || Math.abs(tfbm(u + 0.3, v, 9, 3) - 0.5) < 0.008;
    const mottle = tfbm(u, v, 3, 4);
    let r = 175 + n * 50 - mottle * 45, g = 166 + n * 45 - mottle * 48, b = 160 + n * 40 - mottle * 36;
    if (vein) { r -= 55; g -= 50; b -= 25; }
    const wr = Math.abs(Math.sin(v * 160 + w * 18)) < 0.15 ? -0.4 : 0;
    return [r + wr * 30, g + wr * 30, b + wr * 30, n * 0.5 + w * 0.3 + wr + (vein ? 0.4 : 0)];
  },
  bone: (u, v) => {
    const n = tfbm(u, v, 8, 4), s = tfbm(u * 6, v, 14, 2);
    const c = 160 + n * 40 - s * 20;
    return [c, c * 0.93, c * 0.78, n * 0.6 + s * 0.4];
  },
  water: (u, v) => {
    const n = tfbm(u, v, 8, 4), g = tfbm(u, v, 30, 3);
    return [20, 30, 35, n * 0.6 + g * 0.4];
  },
  void: (u, v) => {
    const n = tfbm(u, v, 5, 5), g = tfbm(u, v, 40, 3);
    const vein = Math.abs(tfbm(u, v, 3, 4) - 0.5) < 0.01;
    const c = 20 + n * 25;
    return [c + (vein ? 60 : 0), c * 0.8, c * 1.2 + (vein ? 30 : 0), n + g * 0.3];
  },
  flesh: (u, v) => { // the Other Side's organic walls: dark, glossy, sinewed (non-anatomical)
    const n = tfbm(u, v, 6, 5), s = Math.abs(Math.sin(v * 30 + tfbm(u, v, 4, 3) * 8));
    return [50 + n * 30 + s * 15, 28 + n * 15, 32 + n * 20, s * 0.6 + n * 0.4];
  },
  tarp: (u, v) => {
    const n = tfbm(u, v, 5, 4);
    return [40 + n * 30, 60 + n * 30, 90 + n * 30, n];
  },
};

const texCache = new Map();
export function tex(name, repeat = 1, opts = {}) {
  // Shared per (name, repeat) so identical surfaces reuse one GPU texture.
  const ck = name + '|' + repeat + '|' + (opts.repeatY || repeat) + '|' + (opts.size || SIZE) + (opts.unique ? Math.random() : '');
  if (texCache.has(ck)) return texCache.get(ck);
  const base = generate(name, opts.size || SIZE, defs[name], opts);
  // Clone so each material can have its own repeat while sharing image data.
  const map = base.map.clone(); map.needsUpdate = true; map.repeat.set(repeat, opts.repeatY || repeat);
  const normalMap = base.normalMap.clone(); normalMap.needsUpdate = true; normalMap.repeat.copy(map.repeat);
  const out = { map, normalMap };
  texCache.set(ck, out);
  return out;
}

// Helper to build a standard PBR material from a procedural texture.
export function mat(name, { repeat = 1, repeatY, color = 0xffffff, roughness = 0.85, metalness = 0, normalScale = 1, emissive, emissiveIntensity, side, envMapIntensity = 0.6 } = {}) {
  const t = tex(name, repeat, { repeatY });
  const m = new THREE.MeshStandardMaterial({
    map: t.map, normalMap: t.normalMap, color, roughness, metalness, envMapIntensity,
    normalScale: new THREE.Vector2(normalScale, normalScale),
  });
  if (emissive !== undefined) { m.emissive = new THREE.Color(emissive); m.emissiveIntensity = emissiveIntensity ?? 1; }
  if (side) m.side = side;
  return m;
}

// ---------- Special canvas textures ----------

// Leaf cluster card with alpha (for tree canopies and bushes).
export function leafTexture(hue = 'green') {
  const key = 'leaf' + hue;
  if (cache.has(key)) return cache.get(key);
  const c = canvas(256); const ctx = c.getContext('2d');
  const r = mulberry32(42);
  for (let i = 0; i < 260; i++) {
    const x = 128 + (r() - 0.5) * 220 * Math.sqrt(r()), y = 128 + (r() - 0.5) * 220 * Math.sqrt(r());
    const s = 6 + r() * 12, a = r() * Math.PI;
    const g = hue === 'dead' ? [70 + r() * 40, 50 + r() * 30, 30] : [20 + r() * 30, 45 + r() * 45, 18 + r() * 20];
    ctx.fillStyle = `rgb(${g[0] | 0},${g[1] | 0},${g[2] | 0})`;
    ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.45, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t); return t;
}

export function needleTexture() {
  const key = 'needles';
  if (cache.has(key)) return cache.get(key);
  const c = canvas(256); const ctx = c.getContext('2d');
  const r = mulberry32(7);
  for (let i = 0; i < 900; i++) {
    const x = r() * 256, y = r() * 256, l = 8 + r() * 14, a = -Math.PI / 2 + (r() - 0.5) * 1.6;
    const fade = 1 - Math.abs(x - 128) / 128;
    if (r() > fade + 0.1) continue;
    ctx.strokeStyle = `rgba(${15 + r() * 20 | 0},${35 + r() * 35 | 0},${20 + r() * 15 | 0},1)`;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t); return t;
}

export function grassBladeTexture() {
  const key = 'blade';
  if (cache.has(key)) return cache.get(key);
  const c = canvas(128); const ctx = c.getContext('2d');
  const r = mulberry32(3);
  for (let i = 0; i < 40; i++) {
    const x = 10 + r() * 108, h = 60 + r() * 66, bend = (r() - 0.5) * 30;
    const g = ctx.createLinearGradient(0, 128, 0, 128 - h);
    g.addColorStop(0, 'rgb(20,35,15)'); g.addColorStop(1, `rgb(${50 + r() * 30 | 0},${75 + r() * 40 | 0},35)`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(x - 2, 128); ctx.quadraticCurveTo(x + bend * 0.5, 128 - h * 0.6, x + bend, 128 - h); ctx.quadraticCurveTo(x + bend * 0.5 + 1, 128 - h * 0.6, x + 2, 128); ctx.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t); return t;
}

// Soft radial sprite for fog puffs, glows, particles.
export function radialTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)', size = 128) {
  const key = 'rad' + inner + outer + size;
  if (cache.has(key)) return cache.get(key);
  const c = canvas(size); const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner); g.addColorStop(1, outer);
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t); return t;
}

export function smokeTexture() {
  const key = 'smoke';
  if (cache.has(key)) return cache.get(key);
  const s = 128; const c = canvas(s); const ctx = c.getContext('2d');
  const img = ctx.createImageData(s, s);
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const dx = x / s - 0.5, dy = y / s - 0.5, d = Math.sqrt(dx * dx + dy * dy) * 2;
    const n = fbm(x / 20, y / 20, 4);
    const a = clamp((1 - d) * n * 1.6, 0, 1);
    const i = (y * s + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = a * 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); cache.set(key, t); return t;
}

// Humanoid silhouette (used by Enhanced Senses markers and the moving-shadow hallucination).
export function silhouetteTexture(color = 'rgba(255,255,255,1)', blur = 6) {
  const key = 'sil' + color + blur;
  if (cache.has(key)) return cache.get(key);
  const c = canvas(128, 256); const ctx = c.getContext('2d');
  ctx.filter = `blur(${blur}px)`;
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.ellipse(64, 40, 17, 21, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(30, 70); ctx.lineTo(98, 70); ctx.lineTo(104, 150); ctx.lineTo(90, 150); ctx.lineTo(86, 245); ctx.lineTo(68, 245); ctx.lineTo(64, 160); ctx.lineTo(60, 245); ctx.lineTo(42, 245); ctx.lineTo(38, 150); ctx.lineTo(24, 150); ctx.closePath(); ctx.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t); return t;
}

// Human face texture: painted features with subtle variation (eyes, brows, mouth).
export function faceTexture(seed, { skin = [200, 160, 130], expression = 'neutral', hollow = false } = {}) {
  const key = 'face' + seed + expression + hollow + skin.join();
  if (cache.has(key)) return cache.get(key);
  const r = mulberry32(seed * 101 + 5);
  const c = canvas(128); const ctx = c.getContext('2d');
  const [sr, sg, sb] = skin;
  ctx.beginPath(); ctx.ellipse(64, 66, 58, 62, 0, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = `rgb(${sr},${sg},${sb})`; ctx.fillRect(0, 0, 128, 128);
  // shading
  const g = ctx.createRadialGradient(64, 60, 10, 64, 64, 70);
  g.addColorStop(0, 'rgba(255,255,255,0.08)'); g.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  const eyeY = 56 + r() * 4, eyeX = 20 + r() * 4;
  if (hollow) {
    ctx.fillStyle = 'rgb(5,5,5)';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(64 + s * eyeX, eyeY, 9, 12, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.beginPath(); ctx.ellipse(64, 92, 10, 14, 0, 0, Math.PI * 2); ctx.fill();
  } else {
    const wide = expression === 'fear' ? 1.6 : 1;
    for (const s of [-1, 1]) {
      ctx.fillStyle = 'rgb(235,230,225)'; ctx.beginPath(); ctx.ellipse(64 + s * eyeX, eyeY, 7, 3.5 * wide, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgb(${40 + r() * 60 | 0},${30 + r() * 50 | 0},${20 + r() * 30 | 0})`; ctx.beginPath(); ctx.arc(64 + s * eyeX, eyeY, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgb(10,10,10)'; ctx.beginPath(); ctx.arc(64 + s * eyeX, eyeY, 1.3, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = `rgba(40,25,15,0.85)`; ctx.lineWidth = 2.5; ctx.beginPath();
      const by = eyeY - 8 - (expression === 'fear' ? 3 : 0);
      ctx.moveTo(64 + s * (eyeX - 8), by + (expression === 'fear' ? -s * 0 : 1)); ctx.lineTo(64 + s * (eyeX + 7), by + (expression === 'fear' ? 3 : 0)); ctx.stroke();
    }
    ctx.strokeStyle = `rgba(${sr * 0.6 | 0},${sg * 0.5 | 0},${sb * 0.5 | 0},0.6)`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(64, eyeY + 6); ctx.lineTo(61, eyeY + 20); ctx.lineTo(66, eyeY + 21); ctx.stroke();
    ctx.fillStyle = 'rgb(110,50,50)';
    if (expression === 'fear') { ctx.fillStyle = 'rgb(40,10,10)'; ctx.beginPath(); ctx.ellipse(64, 95, 8, 10, 0, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.beginPath(); ctx.ellipse(64, 92, 11, 2.5, 0, 0, Math.PI * 2); ctx.fill(); }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t); return t;
}

// Text on a canvas (signs, notes on walls, symbols).
export function textTexture(lines, { w = 512, h = 256, bg = '#1a1a1a', fg = '#ddd', font = 'bold 48px Georgia', align = 'center', glow = null } = {}) {
  const c = canvas(w, h); const ctx = c.getContext('2d');
  if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h); }
  ctx.fillStyle = fg; ctx.font = font; ctx.textAlign = align; ctx.textBaseline = 'middle';
  if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 20; }
  const L = Array.isArray(lines) ? lines : [lines];
  L.forEach((s, i) => ctx.fillText(s, align === 'center' ? w / 2 : 20, h / 2 + (i - (L.length - 1) / 2) * (parseInt(font.match(/\d+/)[0]) * 1.2)));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// The recurring symbol: an eye inside a broken spiral.
export function symbolTexture(color = 'rgba(140,10,10,0.9)') {
  const key = 'symbol' + color;
  if (cache.has(key)) return cache.get(key);
  const c = canvas(256); const ctx = c.getContext('2d');
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 9; ctx.lineCap = 'round';
  ctx.beginPath();
  for (let a = 0; a < Math.PI * 5.2; a += 0.05) {
    const rr = 12 + a * 6.5; const x = 128 + Math.cos(a) * rr, y = 128 + Math.sin(a) * rr;
    if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.lineWidth = 7; ctx.beginPath(); ctx.ellipse(128, 128, 40, 18, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(128, 128, 8, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(110 + i * 18, 170); ctx.lineTo(108 + i * 18 + (i - 1) * 4, 220 + i * 6); ctx.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t); return t;
}

// Child's drawing / poster style paper texture.
export function paperTexture(drawFn, w = 256, h = 320) {
  const c = canvas(w, h); const ctx = c.getContext('2d');
  ctx.fillStyle = '#d8d2c0'; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 400; i++) { ctx.fillStyle = `rgba(80,60,30,${Math.random() * 0.05})`; ctx.fillRect(Math.random() * w, Math.random() * h, 3, 3); }
  drawFn && drawFn(ctx, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Night sky with stars and moon, used as equirect background + env lighting source.
export function skyTexture({ top = '#05070c', horizon = '#1a2230', stars = 0.6, moon = true, tint = null } = {}) {
  const w = 1024, h = 512; const c = canvas(w, h); const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, top); g.addColorStop(0.5, horizon); g.addColorStop(0.52, horizon); g.addColorStop(1, '#030303');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const r = mulberry32(99);
  for (let i = 0; i < 900 * stars; i++) {
    const y = r() * h * 0.48; const a = r() * 0.8 * (1 - y / (h * 0.5));
    ctx.fillStyle = `rgba(220,225,255,${a})`; ctx.fillRect(r() * w, y, r() < 0.05 ? 2 : 1, 1);
  }
  // clouds
  for (let i = 0; i < 40; i++) {
    const x = r() * w, y = h * (0.25 + r() * 0.22), rw = 60 + r() * 160;
    const cg = ctx.createRadialGradient(x, y, 0, x, y, rw);
    cg.addColorStop(0, tint ? tint : 'rgba(40,45,55,0.35)'); cg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = cg; ctx.fillRect(x - rw, y - rw, rw * 2, rw * 2);
  }
  if (moon) {
    const mx = w * 0.7, my = h * 0.18;
    const mg = ctx.createRadialGradient(mx, my, 0, mx, my, 60);
    mg.addColorStop(0, 'rgba(230,235,255,1)'); mg.addColorStop(0.15, 'rgba(220,225,240,1)'); mg.addColorStop(0.2, 'rgba(160,170,200,0.25)'); mg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = mg; ctx.fillRect(mx - 60, my - 60, 120, 120);
  }
  const t = new THREE.CanvasTexture(c); t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
