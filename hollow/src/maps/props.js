// Reusable world props: houses with furnished interiors, vehicles, street furniture,
// vegetation, playground equipment. All build through a MapBuilder (merged geometry +
// colliders + nav nodes) using a LocalFrame so they can be placed at 90° rotations.
import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { worldBox, addWind } from './builder.js';
import { rand, pick, chance, mulberry32 } from '../core/util.js';
import { leafTexture, needleTexture, tex, textTexture } from '../core/textures.js';

// Local coordinate frame (origin + rotation in quarter turns) over a MapBuilder.
export class Frame {
  constructor(b, ox, oz, rot = 0, oy = 0) { this.b = b; this.ox = ox; this.oz = oz; this.r = ((rot % 4) + 4) % 4; this.oy = oy; }
  p(x, z) { const r = this.r; const c = [1, 0, -1, 0][r], s = [0, 1, 0, -1][r]; return [this.ox + x * c + z * s, this.oz - x * s + z * c]; }
  v(x, y, z) { const [wx, wz] = this.p(x, z); return new THREE.Vector3(wx, y + this.oy, wz); }
  d(nx, nz) { const r = this.r; const c = [1, 0, -1, 0][r], s = [0, 1, 0, -1][r]; return [nx * c + nz * s, -nx * s + nz * c]; }
  yaw(a = 0) { return a + this.r * Math.PI / 2; }
  box(cx, cy, cz, sx, sy, sz, mat, opts = {}) {
    const [x, z] = this.p(cx, cz); const odd = this.r % 2 === 1;
    this.b.box(x, cy + this.oy, z, odd ? sz : sx, sy, odd ? sx : sz, mat, opts);
  }
  wall(x0, z0, x1, z1, yb, h, t, mat, openings, opts) {
    const [a, b] = this.p(x0, z0), [c, d] = this.p(x1, z1);
    // openings measured from (x0,z0) toward (x1,z1); if the transform flips the order, mirror them
    const len = Math.hypot(x1 - x0, z1 - z0);
    const alongX = Math.abs(c - a) > Math.abs(d - b);
    const flipped = alongX ? c < a : d < b;
    const ops = (openings || []).map((o) => ({ ...o, at: flipped ? len - o.at : o.at }));
    this.b.wall(Math.min(a, c), Math.min(b, d), Math.max(a, c), Math.max(b, d), yb + this.oy, h, t, mat, ops, opts);
  }
  door(x, y, z, w, h, axis, mat, opts) {
    const [wx, wz] = this.p(x, z); const ax = this.r % 2 === 1 ? (axis === 'x' ? 'z' : 'x') : axis;
    return this.b.door(wx, y + this.oy, wz, w, h, ax, mat, opts);
  }
  node(x, z, y = 0, tags = []) { const [wx, wz] = this.p(x, z); return this.b.node(wx, wz, y + this.oy, tags); }
  light(x, y, z, color, intensity, dist, opts) { const [wx, wz] = this.p(x, z); return this.b.light(wx, y + this.oy, wz, color, intensity, dist, opts); }
  window(x, y, z, w, h, nx, nz, lit, opts) { const [wx, wz] = this.p(x, z); const [dx, dz] = this.d(nx, nz); return this.b.window(wx, y + this.oy, wz, w, h, dx, dz, lit, opts); }
  geo(g, mat, x = 0, y = 0, z = 0, rotY = 0, opts) { g.rotateY(this.yaw(rotY)); const [wx, wz] = this.p(x, z); g.translate(wx, y + this.oy, wz); this.b.geo(g, mat, opts); }
  collider(cx, cy, cz, sx, sy, sz, opts) { const [x, z] = this.p(cx, cz); const odd = this.r % 2 === 1; this.b.world.box(x, cy + this.oy, z, odd ? sz : sx, sy, odd ? sx : sz, opts); }
}

// Triangular prism roof along local x.
export function gableGeo(w, d, h, over = 0.4) {
  const W = w / 2 + over, D = d / 2 + over;
  const v = [];
  const uv = [];
  const quad = (a, b, c, e, uw, uh) => { v.push(...a, ...b, ...c, ...a, ...c, ...e); uv.push(0, 0, uw, 0, uw, uh, 0, 0, uw, uh, 0, uh); };
  const slope = Math.hypot(D, h);
  quad([-W, 0, D], [W, 0, D], [W, h, 0], [-W, h, 0], W, slope / 2);
  quad([W, 0, -D], [-W, 0, -D], [-W, h, 0], [W, h, 0], W, slope / 2);
  // gable ends
  v.push(-W + over, 0, -D + over, -W + over, 0, D - over, -W + over, h, 0); uv.push(0, 0, 1, 0, 0.5, 0.5);
  v.push(W - over, 0, D - over, W - over, 0, -D + over, W - over, h, 0); uv.push(0, 0, 1, 0, 0.5, 0.5);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------- furniture
export function couch(f, x, z, rot, mat = 'fabricBlue') {
  const L = new Frame(f.b, ...f.p(x, z), f.r + rot, f.oy);
  L.box(0, 0.25, 0, 2, 0.5, 0.9, mat); L.box(0, 0.65, -0.35, 2, 0.6, 0.2, mat, { collide: false });
  L.box(-0.95, 0.45, 0, 0.15, 0.4, 0.9, mat, { collide: false }); L.box(0.95, 0.45, 0, 0.15, 0.4, 0.9, mat, { collide: false });
}
export function table(f, x, z, sx = 1.4, sz = 0.9, h = 0.75, mat = 'darkWood', chairs = true) {
  f.box(x, h - 0.03, z, sx, 0.06, sz, mat, { collide: false });
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) f.box(x + dx * (sx / 2 - 0.06), (h - 0.06) / 2, z + dz * (sz / 2 - 0.06), 0.06, h - 0.06, 0.06, mat, { collide: false });
  f.collider(x, h / 2, z, sx, h, sz, { surface: 'wood' });
  if (chairs) for (const [dx, dz] of [[0, -1], [0, 1]]) chair(f, x + dx, z + dz * (sz / 2 + 0.35), dz > 0 ? 2 : 0, mat);
}
export function chair(f, x, z, rot = 0, mat = 'darkWood') {
  const L = new Frame(f.b, ...f.p(x, z), f.r + rot, f.oy);
  L.box(0, 0.45, 0, 0.45, 0.05, 0.45, mat, { collide: false }); L.box(0, 0.75, -0.2, 0.45, 0.55, 0.05, mat, { collide: false });
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) L.box(dx * 0.19, 0.22, dz * 0.19, 0.04, 0.45, 0.04, mat, { collide: false });
}
export function bed(f, x, z, rot = 0, sheet = 'sheet') {
  const L = new Frame(f.b, ...f.p(x, z), f.r + rot, f.oy);
  L.box(0, 0.2, 0, 1.5, 0.4, 2.1, 'darkWood', { surface: 'wood' });
  L.box(0, 0.48, 0.05, 1.42, 0.18, 1.95, 'mattress', { collide: false });
  L.box(0, 0.6, 0.25, 1.44, 0.08, 1.5, sheet, { collide: false });
  L.box(0, 0.62, -0.75, 1.0, 0.12, 0.35, 'sheet', { collide: false });
  L.box(0, 0.7, -1.06, 1.5, 1.0, 0.08, 'darkWood', { collide: false });
}
export function counter(f, x, z, len, rot = 0) {
  const L = new Frame(f.b, ...f.p(x, z), f.r + rot, f.oy);
  L.box(0, 0.45, 0, len, 0.9, 0.6, 'whiteMetal', { surface: 'wood' });
  L.box(0, 0.92, 0, len + 0.04, 0.04, 0.64, 'darkConcrete', { collide: false });
  L.box(0, 1.8, -0.15, len, 0.7, 0.35, 'wood', { collide: false });
}
export function fridge(f, x, z, rot = 0) { const L = new Frame(f.b, ...f.p(x, z), f.r + rot, f.oy); L.box(0, 0.9, 0, 0.8, 1.8, 0.7, 'whiteMetal'); L.box(0.3, 1.1, 0.36, 0.04, 0.4, 0.04, 'chrome', { collide: false }); }
export function wardrobe(f, x, z, rot = 0) { const L = new Frame(f.b, ...f.p(x, z), f.r + rot, f.oy); L.box(0, 1.0, 0, 1.2, 2.0, 0.6, 'darkWood'); L.box(0, 1.0, 0.31, 0.02, 1.9, 0.02, 'black', { collide: false }); }
export function shelf(f, x, z, rot = 0, len = 1.2) {
  const L = new Frame(f.b, ...f.p(x, z), f.r + rot, f.oy);
  for (const y of [0.05, 0.6, 1.15, 1.7]) L.box(0, y, 0, len, 0.04, 0.4, 'wood', { collide: false });
  L.box(-len / 2, 0.9, 0, 0.04, 1.8, 0.4, 'wood', { collide: false }); L.box(len / 2, 0.9, 0, 0.04, 1.8, 0.4, 'wood', { collide: false });
  L.collider(0, 0.9, 0, len, 1.8, 0.4, { surface: 'wood' });
  const r = mulberry32(Math.floor(x * 13 + z * 7));
  for (const y of [0.07, 0.62, 1.17]) for (let i = 0; i < 4; i++) if (r() < 0.7) L.box(-len / 2 + 0.15 + i * (len / 4), y + 0.12, 0, 0.12 + r() * 0.1, 0.22, 0.25, pick(['fabricRed', 'fabricBlue', 'fabricGreen', 'fabricBrown']), { collide: false });
}
export function tv(f, x, z, rot = 0, on = true) {
  const L = new Frame(f.b, ...f.p(x, z), f.r + rot, f.oy);
  L.box(0, 0.25, 0, 1.2, 0.5, 0.45, 'darkWood');
  L.box(0, 0.8, 0, 1.0, 0.6, 0.12, 'blackMetal', { collide: false });
  L.box(0, 0.8, 0.065, 0.9, 0.52, 0.01, on ? 'screen' : 'black', { collide: false });
  if (on) { const [wx, wz] = L.p(0, 0.8); return f.b.light(wx, 0.9 + f.oy, wz, 0x7090ff, 3, 6, { flicker: 0.6, bulb: false }); }
  return null;
}
export function lamp(f, x, z, color = 0xffc890, intensity = 5, dist = 7) {
  f.box(x, 0.02, z, 0.3, 0.04, 0.3, 'blackMetal', { collide: false });
  f.box(x, 0.7, z, 0.03, 1.4, 0.03, 'blackMetal', { collide: false });
  const g = new THREE.CylinderGeometry(0.15, 0.25, 0.3, 12, 1, true); f.geo(g, 'lampOn', x, 1.4, z, 0, { cast: false });
  return f.light(x, 1.5, z, color, intensity, dist, { glowSize: 0.6 });
}
export function toilet(f, x, z, rot) { const L = new Frame(f.b, ...f.p(x, z), f.r + rot, f.oy); L.box(0, 0.2, 0.1, 0.4, 0.4, 0.55, 'whiteMetal', { collide: false }); L.box(0, 0.6, -0.2, 0.45, 0.45, 0.2, 'whiteMetal', { collide: false }); L.collider(0, 0.4, 0, 0.45, 0.8, 0.7, { surface: 'tile' }); }
export function tub(f, x, z, rot) { const L = new Frame(f.b, ...f.p(x, z), f.r + rot, f.oy); L.box(0, 0.08, 0, 0.8, 0.16, 1.7, 'whiteMetal', { surface: 'tile' }); L.box(-0.37, 0.3, 0, 0.06, 0.6, 1.7, 'whiteMetal'); L.box(0.37, 0.3, 0, 0.06, 0.6, 1.7, 'whiteMetal'); L.box(0, 0.3, -0.82, 0.8, 0.6, 0.06, 'whiteMetal'); L.box(0, 0.3, 0.82, 0.8, 0.6, 0.06, 'whiteMetal'); }
export function sinkUnit(f, x, z, rot) { const L = new Frame(f.b, ...f.p(x, z), f.r + rot, f.oy); L.box(0, 0.42, 0, 0.6, 0.84, 0.45, 'whiteMetal'); L.box(0, 0.86, 0.02, 0.45, 0.04, 0.32, 'chrome', { collide: false }); }

// Mirror: a real reflector (medium/high quality) — the hallucination system uses it.
export function mirror(b, x, y, z, w, h, faceYaw, quality) {
  if (!quality.mirrors) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ color: 0x8a9098, roughness: 0.05, metalness: 1, envMapIntensity: 1.3 }));
    m.position.set(x, y, z); m.rotation.y = faceYaw; b.root.add(m);
    return null;
  }
  const r = new Reflector(new THREE.PlaneGeometry(w, h), { textureWidth: 512, textureHeight: 512, color: 0x8a8e94, clipBias: 0.003 });
  r.position.set(x, y, z); r.rotation.y = faceYaw;
  b.root.add(r); b.mirrors.push(r);
  b.anchors.mirror.push({ pos: new THREE.Vector3(x, y, z), mirror: r });
  return r;
}

// ---------------------------------------------------------------- house
// A single-storey furnished house. Front door faces local +z. Returns info incl. nav nodes.
export function house(b, ox, oz, rot, opts = {}) {
  const f = new Frame(b, ox, oz, rot, opts.y || 0);
  const w = opts.w || 11, d = opts.d || 9, H = 2.9, T = 0.18;
  const siding = opts.siding || pick(['siding', 'sidingBlue', 'sidingGreen', 'sidingRed']);
  const lit = opts.lit !== undefined ? opts.lit : chance(0.6);
  const doorX = opts.doorX ?? -1.6;
  const r = mulberry32(Math.floor(ox * 31 + oz * 17));
  const info = { frame: f, nodes: {}, lights: [], doors: {} };
  // floor slab + porch
  f.box(0, 0.075, 0, w, 0.15, d, 'woodFloor', { surface: 'wood', tex: 3 });
  f.box(doorX, 0.08, d / 2 + 0.9, 2.6, 0.16, 1.8, 'concrete');
  // exterior walls with openings
  const winH = { y0: 0.9, y1: 2.1 };
  f.wall(-w / 2, d / 2, w / 2, d / 2, 0.15, H, T, siding, [{ at: doorX + w / 2, w: 1.0, y0: 0, y1: 2.15 }, { at: w / 2 + 2.6, w: 1.4, ...winH }, { at: w / 2 - 3.6 + (doorX > 0 ? 6 : 0), w: 1.2, ...winH }]);
  f.wall(-w / 2, -d / 2, w / 2, -d / 2, 0.15, H, T, siding, [{ at: 2.2, w: 1.0, y0: 0, y1: 2.15 }, { at: w - 2.5, w: 1.0, ...winH }]);
  f.wall(-w / 2, -d / 2, -w / 2, d / 2, 0.15, H, T, siding, [{ at: d / 2 + 1.5, w: 1.2, ...winH }]);
  f.wall(w / 2, -d / 2, w / 2, d / 2, 0.15, H, T, siding, [{ at: d / 2 - 2, w: 1.0, ...winH }]);
  // windows (glow panes), front/back/sides
  const wl = (x, z, nx, nz, ww) => f.window(x, 1.5 + 0.15, z, ww, 1.15, nx, nz, lit && r() < 0.8);
  wl(2.6, d / 2 + T / 2 + 0.01, 0, 1, 1.4); wl(-w / 2 + (w / 2 - 3.6 + (doorX > 0 ? 6 : 0)), d / 2 + T / 2 + 0.01, 0, 1, 1.2);
  wl(-w / 2 + w - 2.5, -d / 2 - T / 2 - 0.01, 0, -1, 1.0);
  wl(-w / 2 - T / 2 - 0.01, 1.5, -1, 0, 1.2); wl(w / 2 + T / 2 + 0.01, -d / 2 + d / 2 - 2, 1, 0, 1.0);
  // interior walls: x = 1 splits left (living/kitchen) from right (bed/bath)
  const ix = 1.0;
  f.wall(ix, -d / 2, ix, d / 2, 0.15, H, 0.12, 'wallpaper', [{ at: d / 2 + 1.4, w: 1.1, y0: 0, y1: 2.15 }, { at: d / 2 - 2.2, w: 1.0, y0: 0, y1: 2.15 }]);
  f.wall(ix, 0, w / 2, 0, 0.15, H, 0.12, 'wallpaper', []);
  // ceiling + roof
  f.box(0, H + 0.15 + 0.06, 0, w, 0.12, d, 'plaster', { surface: 'wood' });
  const roofH = 2.2;
  const rg = gableGeo(w, d, roofH, 0.5); f.geo(rg, 'roof', 0, H + 0.27, 0, 0);
  f.collider(0, H + 0.27 + roofH * 0.45, 0, w, roofH * 0.9, d * 0.6, { surface: 'wood' });
  b.anchors.roof.push({ pos: f.v(r() * w * 0.6 - w * 0.3, H + 0.27 + roofH, 0) });
  // doors
  info.doors.front = f.door(doorX, 0.15, d / 2, 1.0, 2.15, 'x', opts.doorMat || 'door', { locked: !!opts.locked });
  info.doors.back = f.door(-w / 2 + 2.2, 0.15, -d / 2, 1.0, 2.15, 'x', 'door', {});
  info.doors.bed = f.door(ix, 0.15, -d / 2 + (d / 2 - 2.2), 1.0, 2.15, 'z', 'doorWhite', {});
  // furniture
  const furnished = opts.furnished !== false;
  if (furnished) {
    couch(f, -w / 2 + 2.2, 1.6, 2, pick(['fabricBlue', 'fabricRed', 'fabricGreen', 'fabricBrown']));
    const tvL = tv(f, -w / 2 + 2.2, d / 2 - 0.5, 2, lit && r() < 0.5); if (tvL) info.lights.push(tvL);
    f.box(-w / 2 + 2.2, 0.2, 2.9, 1.0, 0.4, 0.6, 'darkWood', { collide: false });
    counter(f, -w / 2 + 0.45, -d / 2 + 2.2, 2.6, 1);
    fridge(f, -w / 2 + 0.5, -d / 2 + 0.5, 1);
    table(f, -w / 2 + 2.8, -d / 2 + 2.1, 1.3, 0.9);
    bed(f, w / 2 - 1.1, -d / 2 + 1.4, 0, pick(['sheet', 'fabricBlue', 'fabricRed']));
    wardrobe(f, ix + 0.4, -d / 2 + 0.6, 3);
    tub(f, w / 2 - 0.55, d / 2 - 1.1, 0); toilet(f, ix + 0.5, d / 2 - 0.6, 2); sinkUnit(f, ix + 1.6, 0.4, 0);
    shelf(f, -w / 2 + 0.3, -0.2, 1, 1.4);
    if (opts.mirror) { const mp = f.v(ix + 1.6, 1.6, 0.08); mirror(b, mp.x, mp.y + 0.15, mp.z, 0.6, 0.8, f.yaw(0), b.quality); }
    if (lit) {
      info.lights.push(lamp(f, -w / 2 + 0.6, 2.9));
      info.lights.push(f.light(-w / 2 + 2.5, H - 0.2, -d / 2 + 2, 0xffe2b0, 6, 8, { glowSize: 0.5 }));
      if (r() < 0.6) info.lights.push(f.light(w / 2 - 2, H - 0.2, -d / 2 + 2, 0xffd8a0, 4, 7, { glowSize: 0.4 }));
    }
  }
  // porch light
  info.lights.push(f.light(doorX + 0.8, 2.4, d / 2 + 0.3, 0xffd090, lit ? 5 : 0, 8, { flicker: 0.05, on: lit || r() < 0.4 }));
  // nav
  const N = info.nodes;
  N.out = f.node(doorX, d / 2 + 2.4, 0, ['activity', 'spawn']);
  N.porch = f.node(doorX, d / 2 + 0.9, 0.16, ['activity']);
  N.door = f.node(doorX, d / 2, 0.15, ['indoor']); N.door.door = info.doors.front;
  N.living = f.node(-w / 2 + 2.6, 2.4, 0.15, ['indoor', 'activity']); N.living.activity = 'sit';
  N.livingIn = f.node(doorX, d / 2 - 1.2, 0.15, ['indoor']);
  N.kitchen = f.node(-w / 2 + 1.7, -d / 2 + 2.0, 0.15, ['indoor', 'activity']); N.kitchen.activity = 'work';
  N.hallR = f.node(ix - 0.7, -1.0, 0.15, ['indoor']);
  N.bedDoor = f.node(ix, -d / 2 + (d / 2 - 2.2), 0.15, ['indoor']); N.bedDoor.door = info.doors.bed;
  N.bed = f.node(ix + 1.2, -d / 2 + 1.6, 0.15, ['indoor', 'hide']); N.bed.faceYaw = f.yaw(Math.PI / 2);
  N.bath = f.node(ix + 1.3, 1.7, 0.15, ['indoor', 'hide']);
  N.hallBath = f.node(ix - 0.7, 1.4, 0.15, ['indoor']);
  N.backDoor = f.node(-w / 2 + 2.2, -d / 2, 0.15, ['indoor']); N.backDoor.door = info.doors.back;
  N.backIn = f.node(-w / 2 + 2.2, -d / 2 + 1.0, 0.15, ['indoor']);
  N.back = f.node(-w / 2 + 2.2, -d / 2 - 2.2, 0, ['activity', 'hide']);
  b.chain([N.out, N.porch, N.door, N.livingIn, N.living]);
  b.link(N.livingIn, N.kitchen); b.link(N.living, N.kitchen); b.link(N.livingIn, N.hallR);
  b.link(N.hallR, N.bedDoor); b.link(N.bedDoor, N.bed); b.link(N.livingIn, N.hallBath);
  // bathroom opening (x=ix, around z = d/2-1.4) -> bath
  b.link(N.hallBath, N.bath); b.link(N.hallBath, N.hallR);
  b.chain([N.kitchen, N.backIn, N.backDoor, N.back]);
  b.anchors.indoor.push({ pos: f.v(-w / 2 + 2.5, 1.2, 0) }, { pos: f.v(w / 2 - 2, 1.2, -d / 4) });
  info.w = w; info.d = d;
  return info;
}

// ---------------------------------------------------------------- vehicles & street
export function car(b, x, z, yaw, paint = pick(['carPaint', 'carPaintRed', 'carPaintWhite', 'carPaintBlack', 'carPaintGreen']), opts = {}) {
  const g = new THREE.Group();
  const P = (geo, m, px, py, pz) => { const mesh = new THREE.Mesh(geo, b.m(m)); mesh.position.set(px, py, pz); mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh); };
  // body: lower slab with rounded-ish profile via extrude
  const sh = new THREE.Shape();
  sh.moveTo(-2.2, 0.35); sh.lineTo(2.15, 0.35); sh.quadraticCurveTo(2.3, 0.4, 2.3, 0.75); sh.lineTo(2.2, 0.9); sh.lineTo(1.0, 0.98); sh.lineTo(0.5, 1.45); sh.lineTo(-1.2, 1.48); sh.lineTo(-1.8, 1.0); sh.lineTo(-2.2, 0.95); sh.lineTo(-2.25, 0.5); sh.closePath();
  const body = new THREE.ExtrudeGeometry(sh, { depth: 1.7, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 2 });
  body.translate(0, 0, -0.85); body.rotateY(Math.PI / 2);
  P(body, paint, 0, 0, 0);
  // windows (dark glass slightly inset outward)
  const ws = new THREE.Shape(); ws.moveTo(0.95, 1.0); ws.lineTo(0.48, 1.42); ws.lineTo(-1.15, 1.44); ws.lineTo(-1.7, 1.02); ws.closePath();
  const wg = new THREE.ExtrudeGeometry(ws, { depth: 1.78, bevelEnabled: false }); wg.translate(0, 0, -0.89); wg.rotateY(Math.PI / 2);
  P(wg, 'glass', 0, 0.005, 0);
  for (const [wx, wz] of [[-0.85, 1.45], [0.85, 1.45], [-0.85, -1.4], [0.85, -1.4]]) { const wh = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 16); wh.rotateZ(Math.PI / 2); P(wh, 'tire', wx, 0.34, wz); const hub = new THREE.CylinderGeometry(0.18, 0.18, 0.26, 10); hub.rotateZ(Math.PI / 2); P(hub, 'chrome', wx, 0.34, wz); }
  // lights
  for (const s of [-1, 1]) { P(new THREE.BoxGeometry(0.3, 0.12, 0.05), opts.lightsOn ? 'lampCold' : 'chrome', s * 0.6, 0.78, 2.32); P(new THREE.BoxGeometry(0.3, 0.1, 0.05), 'neonRed', s * 0.6, 0.85, -2.27); }
  g.position.set(x, opts.y || 0, z); g.rotation.y = yaw;
  b.root.add(g);
  // collider (approx — axis aligned on the larger extent)
  const along = Math.abs(Math.cos(yaw)) > 0.7;
  const sx = along ? 1.9 : 4.6, sz = along ? 4.6 : 1.9;
  b.world.box(x, (opts.y || 0) + 0.7, z, sx, 1.4, sz, { surface: 'metal' });
  return g;
}

export function streetLight(b, x, z, yaw, opts = {}) {
  const y0 = opts.y || 0;
  b.cyl(x, y0, z, 0.08, 0.12, 6.2, 'blackMetal', { collide: true, seg: 8 });
  const arm = new THREE.BoxGeometry(0.08, 0.08, 1.4); arm.translate(0, 0, 0.7); arm.rotateY(yaw); arm.translate(x, y0 + 6.1, z); b.geo(arm, 'blackMetal');
  const hx = x + Math.sin(yaw) * 1.4, hz = z + Math.cos(yaw) * 1.4;
  const head = new THREE.BoxGeometry(0.35, 0.12, 0.6); head.rotateY(yaw); head.translate(hx, y0 + 6.0, hz); b.geo(head, 'blackMetal');
  const bulb = new THREE.BoxGeometry(0.28, 0.03, 0.5); bulb.rotateY(yaw); bulb.translate(hx, y0 + 5.93, hz); b.geo(bulb, opts.cold ? 'lampCold' : 'lampOn', { cast: false });
  return b.light(hx, y0 + 5.8, hz, opts.color || (opts.cold ? 0xc8dcff : 0xffb870), opts.intensity || 60, opts.dist || 22, { flicker: opts.flicker || 0, broken: opts.broken || 0, glowSize: 2.2 });
}

export function fence(b, x0, z0, x1, z1, h = 1.2, mat = 'wood', opts = {}) {
  const len = Math.hypot(x1 - x0, z1 - z0); const n = Math.max(1, Math.floor(len / 2.4));
  const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
  for (let i = 0; i <= n; i++) { const t = i / n; b.box(x0 + (x1 - x0) * t, h / 2, z0 + (z1 - z0) * t, 0.12, h, 0.12, mat, { collide: false }); }
  if (opts.picket) {
    const cnt = Math.floor(len / 0.18);
    for (let i = 0; i < cnt; i++) { const t = (i + 0.5) / cnt; if (opts.gap && Math.abs(t - opts.gap) < 0.06) continue; b.box(x0 + (x1 - x0) * t, h * 0.45, z0 + (z1 - z0) * t, alongX ? 0.08 : 0.03, h * 0.9, alongX ? 0.03 : 0.08, mat, { collide: false, cast: false }); }
  }
  for (const y of [h * 0.3, h * 0.8]) b.box((x0 + x1) / 2, y, (z0 + z1) / 2, alongX ? len : 0.06, 0.08, alongX ? 0.06 : len, mat, { collide: false });
  if (opts.gap === undefined) b.world.box((x0 + x1) / 2, h / 2, (z0 + z1) / 2, alongX ? len : 0.2, h, alongX ? 0.2 : len, { surface: 'wood' });
  else {
    const g = opts.gap, gw = 1.2 / len;
    const seg = (a, c) => { if (c - a <= 0) return; const ax = x0 + (x1 - x0) * a, az = z0 + (z1 - z0) * a, cx = x0 + (x1 - x0) * c, cz = z0 + (z1 - z0) * c; b.world.box((ax + cx) / 2, h / 2, (az + cz) / 2, alongX ? Math.abs(cx - ax) : 0.2, h, alongX ? 0.2 : Math.abs(cz - az), { surface: 'wood' }); };
    seg(0, g - gw); seg(g + gw, 1);
  }
}

export function bench(b, x, z, rot = 0) {
  const f = new Frame(b, x, z, rot);
  f.box(0, 0.45, 0, 1.8, 0.06, 0.45, 'wood', { collide: false }); f.box(0, 0.75, -0.22, 1.8, 0.35, 0.05, 'wood', { collide: false });
  for (const s of [-0.75, 0.75]) f.box(s, 0.22, 0, 0.06, 0.45, 0.4, 'blackMetal', { collide: false });
  f.collider(0, 0.4, 0, 1.8, 0.8, 0.5, { surface: 'wood' });
}

export function trashCan(b, game, x, z) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.27, 0.95, 14), b.m('paintedMetal')); body.position.y = 0.475; body.castShadow = true; g.add(body);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.06, 14), b.m('paintedMetal')); lid.position.y = 0.97; g.add(lid);
  g.position.set(x, 0, z); b.root.add(g);
  const col = b.world.addCircle(x, z, 0.32, 0, 1, { surface: 'metal' });
  game.combat.registerBreakable({ pos: new THREE.Vector3(x, 0.5, z), r: 0.4, mesh: g, collider: col, sound: 'clang' });
}

export function hydrant(b, x, z) { b.cyl(x, 0, z, 0.12, 0.14, 0.7, 'redMetal', { seg: 10, collide: true }); b.cyl(x, 0.7, z, 0.06, 0.12, 0.12, 'redMetal', { seg: 10 }); }
export function mailbox(b, x, z, yaw) { b.cyl(x, 0, z, 0.04, 0.04, 1.0, 'wood', { seg: 6 }); const g = new THREE.BoxGeometry(0.22, 0.25, 0.5); g.rotateY(yaw); g.translate(x, 1.1, z); b.geo(g, 'blackMetal'); }

// ---------------------------------------------------------------- vegetation (instanced)
let treeGeoCache = null;
function treeGeos() {
  if (treeGeoCache) return treeGeoCache;
  const trunk = new THREE.CylinderGeometry(0.18, 0.32, 6, 8, 3); trunk.translate(0, 3, 0);
  // gnarl trunk
  const p = trunk.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) + Math.sin(y * 0.9) * 0.08); p.setZ(i, p.getZ(i) + Math.cos(y * 0.7) * 0.06); }
  trunk.computeVertexNormals();
  // deciduous canopy: crossed leaf cards in a cluster
  const cards = [];
  const r = mulberry32(9);
  for (let i = 0; i < 9; i++) {
    const pg = new THREE.PlaneGeometry(3.6, 3.2);
    pg.rotateY(r() * Math.PI); pg.rotateX((r() - 0.5) * 0.6);
    pg.translate((r() - 0.5) * 2.4, 5.4 + r() * 2.4, (r() - 0.5) * 2.4);
    cards.push(pg);
  }
  const canopy = mergeG(cards);
  // pine: stacked cone shells with needle texture
  const pineParts = [];
  for (let i = 0; i < 6; i++) { const c = new THREE.ConeGeometry(2.6 - i * 0.38, 2.6, 10, 1, true); c.translate(0, 2.2 + i * 1.55, 0); pineParts.push(c); }
  const pine = mergeG(pineParts);
  const pineTrunk = new THREE.CylinderGeometry(0.12, 0.3, 11, 7); pineTrunk.translate(0, 5.5, 0);
  const deadBranches = [];
  for (let i = 0; i < 8; i++) { const c = new THREE.CylinderGeometry(0.03, 0.07, 2.2, 5); c.translate(0, 1.1, 0); c.rotateZ(0.9 + r() * 0.5); c.rotateY(r() * Math.PI * 2); c.translate(0, 3 + r() * 3.5, 0); deadBranches.push(c); }
  const dead = mergeG(deadBranches);
  const bush = []; for (let i = 0; i < 5; i++) { const pg = new THREE.PlaneGeometry(1.6, 1.2); pg.rotateY(i * 0.7); pg.translate(0, 0.55, 0); bush.push(pg); }
  treeGeoCache = { trunk, canopy, pine, pineTrunk, dead, bush: mergeG(bush) };
  return treeGeoCache;
}
function mergeG(list) {
  let pos = [], nor = [], uv = [];
  for (const g of list) {
    const ng = g.index ? g.toNonIndexed() : g;
    pos.push(...ng.attributes.position.array); nor.push(...ng.attributes.normal.array); uv.push(...ng.attributes.uv.array);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return out;
}

const vegMats = {};
function vegMat(key, b) {
  if (vegMats[key]) return vegMats[key];
  let m;
  if (key === 'leaves' || key === 'deadLeaves') m = addWind(new THREE.MeshStandardMaterial({ map: leafTexture(key === 'deadLeaves' ? 'dead' : 'green'), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 }), 1.2, 4);
  else if (key === 'needles') m = addWind(new THREE.MeshStandardMaterial({ map: needleTexture(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.95, color: 0xa0a8a0 }), 0.6, 2);
  else if (key === 'bark') { const t = tex('bark', 1, { repeatY: 3 }); m = addWind(new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, roughness: 0.95 }), 0.15, 3); }
  else if (key === 'bush') m = addWind(new THREE.MeshStandardMaterial({ map: leafTexture('green'), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9, color: 0x9ab090 }), 1.5, 0.2);
  vegMats[key] = m; return m;
}
export function resetVegMats() { for (const k in vegMats) delete vegMats[k]; }

// trees: [{x,z,y,s,rot,type:'oak'|'pine'|'dead'}]
export function plantTrees(b, trees, { collide = true } = {}) {
  const G = treeGeos();
  const groups = { oak: [], pine: [], dead: [] };
  const m4 = (t, extraY = 0, sy = 1) => new THREE.Matrix4().compose(new THREE.Vector3(t.x, (t.y || 0) + extraY, t.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.rot || 0), new THREE.Vector3(t.s, t.s * sy, t.s));
  for (const t of trees) {
    groups[t.type || 'oak'].push(t);
    if (collide) b.world.addCircle(t.x, t.z, 0.35 * t.s, t.y || 0, (t.y || 0) + 8 * t.s, { surface: 'wood' });
  }
  if (groups.oak.length) { b.instanced(G.trunk, vegMat('bark'), groups.oak.map((t) => m4(t))); b.instanced(G.canopy, vegMat(b.deadLeaves ? 'deadLeaves' : 'leaves'), groups.oak.map((t) => m4(t)), { cast: true }); }
  if (groups.pine.length) { b.instanced(G.pineTrunk, vegMat('bark'), groups.pine.map((t) => m4(t))); b.instanced(G.pine, vegMat('needles'), groups.pine.map((t) => m4(t))); }
  if (groups.dead.length) { b.instanced(G.trunk, vegMat('bark'), groups.dead.map((t) => m4(t))); b.instanced(G.dead, vegMat('bark'), groups.dead.map((t) => m4(t))); }
}
export function plantBushes(b, list) {
  const G = treeGeos();
  b.instanced(G.bush, vegMat('bush'), list.map((t) => new THREE.Matrix4().compose(new THREE.Vector3(t.x, t.y || 0, t.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.rot || 0), new THREE.Vector3(t.s, t.s, t.s))), { cast: false });
}

// Grass tufts (instanced crossed cards) — skipped on low quality.
export function plantGrass(b, positions, quality) {
  if (!quality.grass || !positions.length) return;
  const g = new THREE.PlaneGeometry(0.9, 0.5); g.translate(0, 0.25, 0);
  const g2 = g.clone().rotateY(Math.PI / 2); const merged = mergeG([g, g2]);
  const t = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); for (let i = 0; i < 26; i++) { const px = Math.random() * 64, h = 20 + Math.random() * 44; x.strokeStyle = `rgb(${30 + Math.random() * 30 | 0},${50 + Math.random() * 40 | 0},25)`; x.lineWidth = 2; x.beginPath(); x.moveTo(px, 64); x.quadraticCurveTo(px + (Math.random() - 0.5) * 10, 64 - h / 2, px + (Math.random() - 0.5) * 16, 64 - h); x.stroke(); } const tt = new THREE.CanvasTexture(c); tt.colorSpace = THREE.SRGBColorSpace; return tt; })();
  const m = addWind(new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 1, color: 0xa0a090 }), 2.5, 0);
  const n = Math.floor(positions.length * quality.grass);
  b.instanced(merged, m, positions.slice(0, n).map((p) => new THREE.Matrix4().compose(new THREE.Vector3(p.x, p.y || 0, p.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 3), new THREE.Vector3(1, 0.7 + Math.random() * 0.8, 1))), { cast: false, chunk: 40 });
}

export function rock(b, x, z, s = 1, y = 0) {
  const g = new THREE.DodecahedronGeometry(1, 1);
  const p = g.attributes.position; const r = mulberry32(Math.floor(x * 7 + z * 13));
  for (let i = 0; i < p.count; i++) { const k = 0.75 + r() * 0.45; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.65, p.getZ(i) * k); }
  g.computeVertexNormals(); g.scale(s, s, s); g.translate(x, y + s * 0.25, z);
  b.geo(g, 'rock');
  b.world.addCircle(x, z, s * 0.85, y - 1, y + s * 0.8, { surface: 'rock' });
}

// Paper note / tape recorder / symbol interactables (registered by the story system)
export function paperMesh(b) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.3), new THREE.MeshStandardMaterial({ color: 0xe8e0c8, roughness: 0.9, emissive: 0x302820, emissiveIntensity: 0.4, side: THREE.DoubleSide }));
  m.castShadow = false; return m;
}
export function recorderMesh() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.07, 0.14), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4, metalness: 0.3 })); g.add(body);
  const reel = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.005, 0.07), new THREE.MeshStandardMaterial({ color: 0x3a3a3a })); reel.position.y = 0.037; g.add(reel);
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 4), new THREE.MeshBasicMaterial({ color: 0xff2020, toneMapped: false })); led.position.set(0.08, 0.04, 0.05); g.add(led);
  return g;
}
