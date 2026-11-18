// MAP 3 — HARROW CITY. Rain, wet streets, neon, traffic, crowds, a parking structure
// that goes underground, an apartment building with a fire escape, climbable towers.
import * as THREE from 'three';
import { car, streetLight, bench, trashCan, hydrant, plantTrees, Frame, table, chair, shelf, bed, couch, lamp, counter } from './props.js';
import { mulberry32, rand, pick, clamp } from '../core/util.js';
import { textTexture } from '../core/textures.js';

const AV = [-135, -75, -15, 45, 105]; // road centre lines (both axes)
const ROAD = 6, WALK = 10;

function facadeMaterial(kind, seed) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const rc = document.createElement('canvas'); rc.width = rc.height = 64; const rx = rc.getContext('2d');
  const R = mulberry32(seed);
  const wall = kind === 'brick' ? '#5a3428' : kind === 'stone' ? '#7a7264' : kind === 'glass' ? '#1a2028' : '#5c5a56';
  x.fillStyle = wall; x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 500; i++) { x.fillStyle = `rgba(${R() < 0.5 ? 0 : 255},${R() < 0.5 ? 0 : 255},${R() < 0.5 ? 0 : 255},${R() * 0.05})`; x.fillRect(R() * 128, R() * 128, 3, 3); }
  if (kind === 'brick') for (let y = 0; y < 128; y += 8) { x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(0, y, 128, 1); for (let xx = (y / 8) % 2 * 8; xx < 128; xx += 16) x.fillRect(xx, y, 1, 8); }
  rx.fillStyle = '#e8e8e8'; rx.fillRect(0, 0, 64, 64);
  // window
  const gx = kind === 'glass' ? 6 : 26, gy = kind === 'glass' ? 6 : 24, gw = 128 - gx * 2, gh = kind === 'glass' ? 116 : 70;
  const glass = x.createLinearGradient(0, gy, 0, gy + gh); glass.addColorStop(0, '#1c2430'); glass.addColorStop(1, '#0a0e14');
  x.fillStyle = '#222'; x.fillRect(gx - 3, gy - 3, gw + 6, gh + 6);
  x.fillStyle = glass; x.fillRect(gx, gy, gw, gh);
  x.fillStyle = 'rgba(160,180,200,0.06)'; x.beginPath(); x.moveTo(gx, gy + gh); x.lineTo(gx + gw * 0.5, gy); x.lineTo(gx + gw * 0.7, gy); x.lineTo(gx + gw * 0.2, gy + gh); x.fill();
  if (kind !== 'glass') { x.fillStyle = '#2a2826'; x.fillRect(gx - 4, gy + gh + 2, gw + 8, 5); }
  rx.fillStyle = '#262626'; rx.fillRect(gx / 2, gy / 2, gw / 2, gh / 2);
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace; map.wrapS = map.wrapT = THREE.RepeatWrapping; map.anisotropy = 4;
  const rough = new THREE.CanvasTexture(rc); rough.wrapS = rough.wrapT = THREE.RepeatWrapping;
  // worldBox UVs are metres/3 → one cell = 3 m wide; floors are 3.5 m tall
  map.repeat.set(1, 3 / 3.5); rough.repeat.copy(map.repeat);
  return new THREE.MeshStandardMaterial({ map, roughnessMap: rough, roughness: 1, metalness: kind === 'glass' ? 0.4 : 0.1, envMapIntensity: 1.2 });
}

export function buildCity(game, b) {
  const R = mulberry32(3003); const rr = (a, c) => a + R() * (c - a);
  b.defaultSurface = 'concrete';
  const facades = ['brick', 'stone', 'concrete', 'glass', 'brick', 'stone'].map((k, i) => { const key = 'facade_' + k + i; b.setMat(key, facadeMaterial(k, i + 1)); return key; });
  // ---------------- ground: wet asphalt + sidewalks ----------------
  const L = AV[0] - 20, H = AV[AV.length - 1] + 20;
  b.ground(L, L, H, H, 'wetAsphalt', 'asphalt', 0, 6);
  const GAR = { x0: -35, x1: 5, z0: 25, z1: 65 };
  b.world.terrain = (x, z) => (x > GAR.x0 && x < GAR.x1 && z > GAR.z0 && z < GAR.z1 ? -7 : 0);
  // blocks (raised sidewalks around each)
  const blocks = [];
  for (let i = 0; i < AV.length - 1; i++) for (let j = 0; j < AV.length - 1; j++) {
    const x0 = AV[i] + ROAD, x1 = AV[i + 1] - ROAD, z0 = AV[j] + ROAD, z1 = AV[j + 1] - ROAD;
    blocks.push({ i, j, x0, x1, z0, z1, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2 });
  }
  const isGarage = (B) => B.cx === -15 && B.cz === 45;
  for (const B of blocks) {
    if (isGarage(B)) { // sidewalk ring only (garage has its own floors)
      for (const [a, c, d, e] of [[B.x0, B.z0, B.x1, B.z0 + 4], [B.x0, B.z1 - 4, B.x1, B.z1], [B.x0, B.z0 + 4, B.x0 + 4, B.z1 - 4], [B.x1 - 4, B.z0 + 4, B.x1, B.z1 - 4]]) b.box((a + c) / 2, 0.075, (d + e) / 2, c - a, 0.15, e - d, 'wetSidewalk', { surface: 'concrete', cast: false, climbable: false });
      continue;
    }
    b.box(B.cx, 0.075, B.cz, B.x1 - B.x0, 0.15, B.z1 - B.z0, 'wetSidewalk', { surface: 'concrete', cast: false, climbable: false, tex: 3 });
  }
  // lane markings + crosswalks
  for (const a of AV) for (let t = L; t < H; t += 8) { b.box(a, 0.012, t, 0.15, 0.01, 3, 'paint', { collide: false, cast: false }); b.box(t, 0.012, a, 3, 0.01, 0.15, 'paint', { collide: false, cast: false }); }
  for (const a of AV) for (const c of AV) for (let k = -4; k <= 4; k++) { b.box(a + k * 1.2, 0.013, c + ROAD + 1.5, 0.6, 0.01, 2.5, 'paint', { collide: false, cast: false }); }

  // ---------------- nav: sidewalk rings around blocks ----------------
  const nodes = [];
  const nodeAt = (x, z, tags = [], y = 0.15) => { const n = b.node(x, z, y, tags); nodes.push(n); return n; };
  const rings = new Map();
  for (const B of blocks) {
    const inset = 2.5; const pts = [];
    const x0 = B.x0 + inset, x1 = B.x1 - inset, z0 = B.z0 + inset, z1 = B.z1 - inset;
    const step = 11;
    const edge = (ax, az, cx, cz) => { const n = Math.max(1, Math.round(Math.hypot(cx - ax, cz - az) / step)); for (let k = 0; k < n; k++) pts.push(nodeAt(ax + (cx - ax) * k / n, az + (cz - az) * k / n, ['activity'])); };
    edge(x0, z0, x1, z0); edge(x1, z0, x1, z1); edge(x1, z1, x0, z1); edge(x0, z1, x0, z0);
    for (let k = 0; k < pts.length; k++) b.link(pts[k], pts[(k + 1) % pts.length]);
    rings.set(B, pts);
  }
  // crossings between adjacent blocks
  const nearestIn = (list, x, z) => list.reduce((a, n) => (Math.hypot(n.pos.x - x, n.pos.z - z) < Math.hypot(a.pos.x - x, a.pos.z - z) ? n : a), list[0]);
  for (const A of blocks) for (const B of blocks) {
    if (A === B) continue;
    if (B.i === A.i + 1 && B.j === A.j) for (const t of [0.25, 0.75]) { const z = A.z0 + (A.z1 - A.z0) * t; b.link(nearestIn(rings.get(A), A.x1, z), nearestIn(rings.get(B), B.x0, z)); }
    if (B.j === A.j + 1 && B.i === A.i) for (const t of [0.25, 0.75]) { const x = A.x0 + (A.x1 - A.x0) * t; b.link(nearestIn(rings.get(A), x, A.z1), nearestIn(rings.get(B), x, B.z0)); }
  }
  // exits: outer ring corners
  for (const B of blocks) if ((B.i === 0 || B.i === 3) && (B.j === 0 || B.j === 3)) { const n = nearestIn(rings.get(B), B.i === 0 ? B.x0 : B.x1, B.j === 0 ? B.z0 : B.z1); n.tags.add('exit'); n.tags.add('spawn'); }

  // ---------------- buildings ----------------
  const winColors = [0xffd8a0, 0xffc890, 0xb8d0ff, 0xfff0d0, 0xffe0b0];
  const tower = (x0, z0, x1, z1, h, facade, opts = {}) => {
    const y0 = opts.y0 || 0;
    b.boxMM(x0, y0, z0, x1, h, z1, facade, { surface: 'concrete', tex: 3 });
    // roof
    b.boxMM(x0 - 0.3, h, z0 - 0.3, x1 + 0.3, h + 0.6, z1 + 0.3, 'darkConcrete', { surface: 'concrete' });
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    if (R() < 0.7) b.box(cx + rr(-3, 3), h + 1.6, cz + rr(-3, 3), 3, 2, 2, 'metal', { surface: 'metal' });
    b.anchors.roof.push({ pos: new THREE.Vector3(cx + rr(-(x1 - x0) / 3, (x1 - x0) / 3), h + 0.6, cz + rr(-(z1 - z0) / 3, (z1 - z0) / 3)) });
    // lit windows overlay: sparse, per 3 m cell, floors every 3.5 m
    const lit = opts.litFrac ?? 0.22;
    for (const [fx0, fz0, fx1, fz1, nx, nz] of [[x0, z0, x1, z0, 0, -1], [x0, z1, x1, z1, 0, 1], [x0, z0, x0, z1, -1, 0], [x1, z0, x1, z1, 1, 0]]) {
      const len = Math.hypot(fx1 - fx0, fz1 - fz0); const cols = Math.floor(len / 3);
      for (let fl = Math.max(1, Math.ceil((y0 + 4) / 3.5)); fl * 3.5 + 2.4 < h; fl++) for (let c = 0; c < cols; c++) {
        if (R() > lit) continue;
        const t = (c + 0.5) * 3 / len; const wx = fx0 + (fx1 - fx0) * t + nx * 0.03, wz = fz0 + (fz1 - fz0) * t + nz * 0.03;
        const W = b.window(wx, fl * 3.5 + 1.75 - 0.4, wz, 2.0, 1.6, nx, nz, true, { color: pick(winColors) });
        if (fl * 3.5 > 18) b.anchors.window.pop(); // keep anchors to the lower floors
      }
    }
    return { cx, cz, h };
  };
  const storefront = (B, side, x0, x1, opts) => {
    // a ground floor shop along the south edge (z0) of a block. Returns nav node inside.
    const z = B.z0 + 2.5 + 4; // facade line (behind the sidewalk)
    const depth = 11, Hh = 4.5;
    const cx = (x0 + x1) / 2;
    // side + back walls, ceiling slab is the tower above
    b.boxMM(x0, 0.15, z, x0 + 0.3, Hh, z + depth, 'darkConcrete');
    b.boxMM(x1 - 0.3, 0.15, z, x1, Hh, z + depth, 'darkConcrete');
    b.boxMM(x0, 0.15, z + depth - 0.3, x1, Hh, z + depth, opts.wall || 'plaster');
    b.boxMM(x0 + 0.3, 0.15, z + 0.2, x1 - 0.3, 0.17, z + depth - 0.3, opts.floor || 'tile', { surface: 'tile', collide: false, cast: false });
    // glass front with a door opening
    const glassMat = 'shopGlass';
    const dx = cx; const dw = 2;
    b.boxMM(x0, 0.15, z - 0.1, dx - dw / 2, 0.8, z + 0.1, 'blackMetal');
    b.boxMM(dx + dw / 2, 0.15, z - 0.1, x1, 0.8, z + 0.1, 'blackMetal');
    for (const [a, c] of [[x0, dx - dw / 2], [dx + dw / 2, x1]]) { const g = new THREE.BoxGeometry(c - a, 2.6, 0.04); g.translate((a + c) / 2, 2.1, z); b.geo(g, glassMat, { cast: false }); b.world.addBox(a, 0.8, z - 0.1, c, 3.4, z + 0.1, { surface: 'glass', climbable: false }); }
    b.boxMM(x0, 3.4, z - 0.1, x1, Hh, z + 0.1, 'blackMetal');
    // sign
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(8, x1 - x0 - 1), 1.1), new THREE.MeshBasicMaterial({ map: textTexture(opts.name, { w: 512, h: 72, bg: '#0a0a0a', fg: opts.neon, font: 'bold 52px Georgia', glow: opts.neon }), toneMapped: false }));
    sign.position.set(cx, 3.95, z - 0.15); sign.rotation.y = Math.PI; b.root.add(sign);
    b.light(cx, 3.6, z - 1.2, new THREE.Color(opts.neon).getHex(), 10, 9, { flicker: opts.flicker || 0, glowSize: 0.1, bulb: false });
    b.light(cx, Hh - 0.4, z + depth / 2, 0xfff0e0, 12, 12, { glowSize: 0.6 });
    // interior & nav
    const outN = nearestIn(rings.get(B), cx, B.z0 + 2.5);
    const doorN = nodeAt(cx, z - 0.6, []); const inN = nodeAt(cx, z + 3, ['indoor']); const backN = nodeAt(cx + (x1 - x0) / 3, z + depth - 2, ['indoor', 'hide']); const sideN = nodeAt(cx - (x1 - x0) / 3, z + depth - 2.5, ['indoor', 'activity']);
    b.chain([outN, doorN, inN, backN]); b.link(inN, sideN);
    opts.interior && opts.interior(cx, z, x0, x1, depth, inN, backN, sideN);
    b.anchors.indoor.push({ pos: new THREE.Vector3(cx, 1.5, z + depth / 2) });
    return { inN, backN, sideN };
  };
  b.setMat('shopGlass', new THREE.MeshStandardMaterial({ color: 0x223040, roughness: 0.05, metalness: 0.6, transparent: true, opacity: 0.25, envMapIntensity: 1.5, depthWrite: false }));

  const refs = {};
  for (const B of blocks) {
    const w = B.x1 - B.x0, d = B.z1 - B.z0; const k = B.cx * 7 + B.cz;
    const fac = facades[Math.abs(k) % facades.length];
    const inner = 2.5 + 4; // sidewalk inset
    const bx0 = B.x0 + inner, bx1 = B.x1 - inner, bz0 = B.z0 + inner, bz1 = B.z1 - inner;
    // ---- plaza ----
    if (B.cx === -15 && B.cz === -15) {
      b.ground(B.x0 + 2, B.z0 + 2, B.x1 - 2, B.z1 - 2, 'concrete', 'concrete', 0.16, 3);
      b.cyl(B.cx, 0.15, B.cz, 5, 5.3, 0.7, 'concrete', { seg: 24, collide: true });
      { const g = new THREE.CircleGeometry(4.7, 24); g.rotateX(-Math.PI / 2); g.translate(B.cx, 0.82, B.cz); b.geo(g, 'water'); }
      b.cyl(B.cx, 0.8, B.cz, 0.5, 0.7, 2.2, 'concrete', { seg: 12, collide: true });
      b.emitters.push({ pos: new THREE.Vector3(B.cx, 1, B.cz), sound: 'drip', interval: [0.2, 0.6], vol: 0.25 });
      const tr = []; for (let a = 0; a < 8; a++) tr.push({ x: B.cx + Math.cos(a / 8 * 6.28) * 14, z: B.cz + Math.sin(a / 8 * 6.28) * 14, y: 0.15, s: 0.9, rot: a, type: 'oak' }); plantTrees(b, tr);
      const pn = [];
      for (let a = 0; a < 8; a++) { const ang = a / 8 * 6.28 + 0.4; const x = B.cx + Math.cos(ang) * 9, z = B.cz + Math.sin(ang) * 9; bench(b, x, z, 0); const n = nodeAt(x, z + 0.7, ['activity']); n.activity = R() < 0.5 ? 'sit' : 'phone'; pn.push(n); }
      for (let a = 0; a < pn.length; a++) { b.link(pn[a], pn[(a + 1) % pn.length]); b.link(pn[a], nearestIn(rings.get(B), pn[a].pos.x, pn[a].pos.z)); }
      // bus stop with the newspaper
      const bsx = B.cx + 8, bsz = B.z0 + 3.2;
      b.box(bsx, 1.3, bsz + 0.9, 4, 2.6, 0.08, 'shopGlass', { collide: true, surface: 'glass' }); b.box(bsx, 2.65, bsz, 4.2, 0.1, 2, 'blackMetal', { collide: false });
      const ad = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.8), new THREE.MeshBasicMaterial({ map: textTexture(['ST. ALDRIC\'S', 'DEMOLITION', 'DELAYED'], { w: 256, h: 384, bg: '#d8d0c0', fg: '#3a1010', font: 'bold 34px Georgia' }), toneMapped: false }));
      ad.position.set(bsx - 1.4, 1.4, bsz + 0.85); ad.rotation.y = Math.PI; b.root.add(ad); b.light(bsx - 1.4, 1.4, bsz + 0.4, 0xfff0e0, 3, 4, { bulb: false });
      bench(b, bsx + 0.6, bsz + 0.4, 2);
      b.item('note', 'city_paper', bsx + 0.6, 0.55, bsz + 0.35, 0, { flat: true });
      refs.paper = new THREE.Vector3(bsx, 0, bsz);
      continue;
    }
    // ---- parking structure ----
    if (isGarage(B)) { buildGarage(b, game, GAR, rings.get(B), nearestIn, nodeAt, refs, rr); continue; }
    // ---- Grand St Apartments (fire escape + 4C) ----
    if (B.cx === 45 && B.cz === -15) { buildApartments(b, bx0, bz0, bx1, bz1, fac, rings.get(B), nearestIn, nodeAt, refs); continue; }
    // ---- shops block ----
    if (B.cx === 45 && B.cz === 45) {
      tower(bx0, bz0 + 11, bx1, bz1, 34, fac);
      b.boxMM(bx0, 4.5, bz0, bx1, 34, bz0 + 11, fac, { surface: 'concrete', tex: 3 });
      const third = (bx1 - bx0) / 3;
      storefront(B, 's', bx0, bx0 + third, { name: 'HARROW DINER', neon: '#ff3040', flicker: 0.2, interior: (cx, z, x0, x1, dep, inN, backN, sideN) => { for (let i = 0; i < 3; i++) table(new Frame(b, 0, 0, 0), x0 + 2 + i * 3, z + 4, 1.2, 0.8); counter(new Frame(b, cx, z + dep - 1.2, 2), 0, 0, x1 - x0 - 2, 0); sideN.activity = 'sit'; backN.activity = 'work'; } });
      storefront(B, 's', bx0 + third, bx0 + 2 * third, { name: '24H PHARMACY', neon: '#30ff80', interior: (cx, z, x0, x1, dep, inN, backN) => { for (let i = 0; i < 3; i++) shelf(new Frame(b, 0, 0, 0), x0 + 2.5 + i * 3, z + 5, 1, 2.2); backN.activity = 'work'; } });
      storefront(B, 's', bx0 + 2 * third, bx1, { name: 'THE LANTERN', neon: '#ff40c0', flicker: 0.1, wall: 'darkBrick', floor: 'woodFloor', interior: (cx, z, x0, x1, dep, inN, backN, sideN) => { counter(new Frame(b, cx, z + dep - 1.4, 2), 0, 0, x1 - x0 - 3, 0); for (let i = 0; i < 4; i++) b.cyl(x0 + 2 + i * 2, 0.15, z + dep - 3, 0.25, 0.2, 0.75, 'darkWood', { seg: 10 }); sideN.activity = 'lean'; backN.activity = 'work'; } });
      refs.shops = new THREE.Vector3(B.cx, 0, bz0);
      continue;
    }
    // ---- the tallest tower: setbacks you can rest on while climbing ----
    if (B.cx === -75 && B.cz === -75) {
      tower(bx0, bz0, bx1, bz1, 22, fac);
      tower(bx0 + 4, bz0 + 4, bx1 - 4, bz1 - 4, 44, facades[3], { y0: 22.6 });
      tower(bx0 + 8, bz0 + 8, bx1 - 8, bz1 - 8, 66, facades[3], { y0: 44.6 });
      b.cyl(B.cx, 66.6, B.cz, 0.15, 0.3, 14, 'blackMetal', { seg: 6, collide: true });
      b.light(B.cx, 80.8, B.cz, 0xff2020, 20, 30, { flicker: 0.5, glowSize: 2 });
      b.item('symbol', 'sym_3', B.cx, 67.8, B.cz - 2, Math.PI);
      b.box(B.cx, 67.2, B.cz - 2.2, 3, 1.2, 0.3, 'metal', { surface: 'metal' });
      b.anchors.impossible.push({ pos: new THREE.Vector3(B.cx + 2, 66.6, B.cz + 2) });
      continue;
    }
    // ---- generic: one or two towers with an alley between ----
    if (R() < 0.55) {
      const mid = (bx0 + bx1) / 2; const al = 3.5;
      const t1 = tower(bx0, bz0, mid - al, bz1, rr(14, 45), fac);
      const t2 = tower(mid + al, bz0, bx1, bz1, rr(12, 38), facades[(Math.abs(k) + 2) % facades.length]);
      // alley: dumpster, steam, a bulb over a back door, nav
      b.box(mid, 0.8, bz0 + 8, 1.6, 1.6, 3, 'paintedMetal', { surface: 'metal' });
      trashCan(b, game, mid + 1.5, bz1 - 6);
      b.light(mid - al + 0.2, 3.2, (bz0 + bz1) / 2, 0xffc080, 6, 9, { flicker: 0.4, broken: 0.2, glowSize: 0.4 });
      const a0 = nodeAt(mid, B.z0 + 2.5, []), a1 = nodeAt(mid, (bz0 + bz1) / 2, ['hide', 'activity']), a2 = nodeAt(mid, B.z1 - 2.5, []);
      a1.activity = 'smoke';
      b.chain([nearestIn(rings.get(B), mid, B.z0 + 2.5), a0, a1, a2, nearestIn(rings.get(B), mid, B.z1 - 2.5)]);
      b.anchors.hallEnd.push({ pos: new THREE.Vector3(mid, 0.15, (bz0 + bz1) / 2) });
      b.steam = b.steam || []; b.steam.push(new THREE.Vector3(mid + 1, 0.2, (bz0 + bz1) / 2 + 6));
    } else tower(bx0, bz0, bx1, bz1, rr(16, 52), fac);
  }

  // ---------------- street furniture ----------------
  for (const a of AV) for (const c of AV) {
    streetLight(b, a + ROAD + 1.2, c + ROAD + 6, -Math.PI / 2, { cold: R() < 0.5, intensity: 70, dist: 24, flicker: R() < 0.1 ? 0.5 : 0 });
    if (R() < 0.6) streetLight(b, a - ROAD - 1.2, c - ROAD - 12, Math.PI / 2, { intensity: 70, dist: 24 });
    // traffic light post
    b.cyl(a - ROAD - 0.8, 0, c - ROAD - 0.8, 0.08, 0.1, 4.2, 'blackMetal', { seg: 6, collide: true });
    b.box(a - ROAD - 0.8, 4.4, c - ROAD - 0.8, 0.35, 1, 0.3, 'blackMetal', { collide: false });
    b.box(a - ROAD - 0.8, 4.6, c - ROAD - 0.62, 0.18, 0.18, 0.04, R() < 0.5 ? 'neonRed' : 'neonGreen', { collide: false, cast: false });
  }
  for (let i = 0; i < 26; i++) { const a = pick(AV), along = rr(L + 10, H - 10); const s = R() < 0.5 ? 1 : -1; if (R() < 0.5) car(b, a + s * 4.2, along, s > 0 ? 0 : Math.PI); else car(b, along, a + s * 4.2, s > 0 ? Math.PI / 2 : -Math.PI / 2); }
  for (let i = 0; i < 16; i++) { const a = pick(AV); hydrant(b, a + ROAD + 0.8, rr(L, H)); trashCan(b, game, rr(L, H), a + ROAD + 0.9); }

  // ---------------- traffic ----------------
  const traffic = [];
  const loops = [[[-135 + 3, -135 + 3], [105 - 3, -135 + 3], [105 - 3, 105 - 3], [-135 + 3, 105 - 3]], [[-75 - 3, -75 + 3], [45 - 3, -75 + 3], [45 - 3, 45 + 3], [-75 - 3, 45 + 3]].reverse()];
  for (let i = 0; i < (b.quality.drawDist > 200 ? 8 : 5); i++) {
    const loop = loops[i % 2]; const g = car(b, 0, 0, 0, pick(['carPaint', 'carPaintRed', 'carPaintWhite', 'carPaintBlack']), { lightsOn: true });
    b.world.boxes.pop(); // moving cars handle their own collision
    const light = b.light(0, 1, 0, 0xdde8ff, 14, 16, { bulb: false, abandon: false });
    traffic.push({ g, loop, seg: Math.floor(R() * 4), t: R(), speed: rr(8, 12), cur: 0, light, honkT: 0 });
  }

  // ---------------- rain puddle sheen + steam ----------------
  // spawn & refs
  b.spawns.player.set(-15 + 8, 0.16, -15 + 22); b.spawns.playerYaw = Math.PI;
  refs.rift = refs.rift || new THREE.Vector3();
  for (const [x, z] of [[-140, 0], [110, -140], [0, 130], [130, 60]]) b.anchors.far.push({ pos: new THREE.Vector3(x, 0, z) });

  // ---------------- population ----------------
  const act = b.nodes.filter((n) => n.tags.has('activity'));
  const initial = [];
  for (let i = 0; i < 30; i++) { const n = act[Math.floor(R() * act.length)]; initial.push({ pos: n.pos.clone(), outfit: 'city', home: n.pos.clone(), roam: 70, flashlight: false }); }
  for (let i = 0; i < 3; i++) { const n = act[Math.floor(R() * act.length)]; initial.push({ pos: n.pos.clone(), outfit: 'guard', role: 'guard', personality: 'brave', home: n.pos.clone(), roam: 120, flashlight: true }); }
  b.anomalies = [
    { pos: refs.paper, apply: () => { traffic.forEach((c) => { c.stopped = true; }); }, revert: () => { traffic.forEach((c) => { c.stopped = false; }); } },
  ];

  let lightningT = rand(20, 40), flashT = 0;
  const _v = new THREE.Vector3();
  return {
    kind: 'city', name: 'Harrow City', chapter: 3,
    env: {
      sky: { top: '#06070c', horizon: '#2a2228', stars: 0.05, moon: false, tint: 'rgba(60,40,45,0.5)' }, fogColor: 0x14121a, fogDensity: 0.016,
      ambient: { sky: 0x606478, ground: 0x2a2220, intensity: 1.5 }, moon: { color: 0x8890b0, intensity: 0.7, dir: [0.3, 1, -0.4] },
      exposure: 1.1, grade: { tint: [1.02, 0.98, 1.04], lift: [0.008, 0.006, 0.01], desat: 0.2 }, wind: 1.1, rain: 1, reverb: [2.2, 3], reverbMix: 0.3, visibility: 0.35, envIntensity: 0.6,
    },
    loops: [['rain', 0.5], ['cityHum', 0.4], ['crowd', 0.08], ['drone', 0.05]],
    emitters: b.emitters,
    bounds: { minX: L + 5, maxX: H - 5, minZ: L + 5, maxZ: H - 5 },
    populationDef: { initial, max: 34, respawnMin: 15, respawnMax: 40 },
    randomNPCDef: (pos) => ({ pos, outfit: 'city', home: pos.clone(), roam: 70 }),
    searcherOutfit: 'guard', allowCalls: true, npcsCanLeave: true,
    ambientEvents: [
      { every: [30, 70], fn: (g) => g.audio.play('siren', g.monster.pos.clone().add(new THREE.Vector3(rand(-250, 250), 10, rand(-250, 250))), { vol: 0.25, dur: 7 }) },
      { every: [20, 50], fn: (g) => g.audio.play('horn', g.monster.pos.clone().add(new THREE.Vector3(rand(-80, 80), 1, rand(-80, 80))), { vol: 0.3 }) },
      { every: [25, 60], fn: (g) => g.audio.play('bark', g.monster.pos.clone().add(new THREE.Vector3(rand(-100, 100), 8, rand(-100, 100))), { vol: 0.2 }) },
    ],
    isInside: (p) => p.y < -1 || (p.x > GAR.x0 && p.x < GAR.x1 && p.z > GAR.z0 && p.z < GAR.z1 && p.y < 3),
    update: (dt, t) => {
      const m = game.monster;
      for (const c of traffic) {
        const a = c.loop[c.seg], nx = c.loop[(c.seg + 1) % c.loop.length];
        const len = Math.hypot(nx[0] - a[0], nx[1] - a[1]);
        const x = a[0] + (nx[0] - a[0]) * c.t, z = a[1] + (nx[1] - a[1]) * c.t;
        const dirx = (nx[0] - a[0]) / len, dirz = (nx[1] - a[1]) / len;
        // brake for the monster or people in front
        const ahead = (m.pos.x - x) * dirx + (m.pos.z - z) * dirz, side = Math.abs((m.pos.x - x) * dirz - (m.pos.z - z) * dirx);
        const blocked = ahead > 0 && ahead < 12 && side < 2.5 && m.pos.y < 3;
        let target = c.stopped || blocked ? 0 : c.speed;
        if (c.t > 0.85 || c.t < 0.05) target = Math.min(target, 5);
        c.cur += (target - c.cur) * Math.min(1, dt * (blocked ? 4 : 1.2));
        if (blocked && c.honkT <= 0 && c.cur < 3) { game.audio.play('horn', _v.set(x, 1, z), { vol: 0.6 }); game.emitNoise(_v, 25, 'door'); c.honkT = rand(3, 6); }
        c.honkT -= dt;
        c.t += c.cur * dt / len;
        if (c.t >= 1) { c.t = 0; c.seg = (c.seg + 1) % c.loop.length; }
        c.g.position.set(x, 0, z); c.g.rotation.y = Math.atan2(dirx, dirz);
        c.light.pos.set(x + dirx * 4, 1.2, z + dirz * 4);
        // push the monster out of a moving car
        const dx = m.pos.x - x, dz = m.pos.z - z; const along = dx * dirx + dz * dirz, lat = dx * dirz - dz * dirx;
        if (Math.abs(along) < 2.6 && Math.abs(lat) < 1.4 && m.pos.y < 1.5) { const push = (1.4 - Math.abs(lat)) * Math.sign(lat || 1); m.pos.x += dirz * push; m.pos.z -= dirx * push; if (c.cur > 6) { m.damage(4); c.cur = 0; game.audio.play('impact', _v.set(x, 1, z), { vol: 1, heavy: 1.5 }); } }
        // occasional passing sound near the player
        if (Math.random() < dt * 0.2 && c.g.position.distanceTo(m.pos) < 30 && c.cur > 5) game.audio.play('carPass', _v.set(x, 0.8, z), { vol: 0.35, dur: 3 });
      }
      // lightning
      lightningT -= dt;
      if (lightningT <= 0) { lightningT = rand(25, 60); flashT = 0.35; game.audio.play('thunder', null, { vol: 0.9, delay: rand(0.6, 2.5) }); }
      if (flashT > 0) { flashT -= dt; game.map.hemi.intensity = game.map.hemiBase * (Math.random() < 0.5 ? 4 : 1.5); game.post.flash = 1; }
      if (b.steam && Math.random() < dt * 4) { const s = pick(b.steam); game.fx.campSmoke(s); }
    },
    refs,
  };
}

function buildGarage(b, game, G, ring, nearestIn, nodeAt, refs, rr) {
  const levels = [0, -3.5, -7];
  const pillarsX = [], pillarsZ = [];
  for (let x = G.x0 + 4; x < G.x1; x += 8) pillarsX.push(x); for (let z = G.z0 + 4; z < G.z1; z += 8) pillarsZ.push(z);
  // floors with ramp openings
  const slab = (y, hole) => {
    const pieces = hole ? [[G.x0, G.z0, hole.x0, G.z1], [hole.x1, G.z0, G.x1, G.z1], [hole.x0, G.z0, hole.x1, hole.z0], [hole.x0, hole.z1, hole.x1, G.z1]] : [[G.x0, G.z0, G.x1, G.z1]];
    for (const [a, c, d, e] of pieces) if (d - a > 0.1 && e - c > 0.1) b.boxMM(a, y - 0.3, c, d, y, e, 'darkConcrete', { surface: 'concrete', tex: 4 });
  };
  const h1 = { x0: G.x0 + 1, x1: G.x0 + 7, z0: G.z0 + 5, z1: G.z0 + 29 };
  const h2 = { x0: G.x1 - 7, x1: G.x1 - 1, z0: G.z0 + 5, z1: G.z0 + 29 };
  slab(0.15, h1); slab(-3.5, h2); slab(-7, null);
  // ceiling of the top level (roof deck) at +3.6 — the open top level
  b.boxMM(G.x0, 3.6, G.z0, G.x1, 3.9, G.z1, 'darkConcrete', { surface: 'concrete', tex: 4 });
  // pillars through all levels
  for (const x of pillarsX) for (const z of pillarsZ) { if (x > h1.x0 - 1 && x < h1.x1 + 1 && z > h1.z0 - 1 && z < h1.z1 + 1) continue; if (x > h2.x0 - 1 && x < h2.x1 + 1 && z > h2.z0 - 1 && z < h2.z1 + 1) continue; b.boxMM(x - 0.35, -7, z - 0.35, x + 0.35, 3.6, z + 0.35, 'concrete', { surface: 'concrete' }); }
  // stepped ramps
  const ramp = (h, yTop, yBot, dirUpZ) => {
    const n = 26; const L = h.z1 - h.z0;
    for (let i = 0; i < n; i++) {
      const z0 = h.z0 + i * L / n, z1 = z0 + L / n;
      const t = (i + 0.5) / n; const top = dirUpZ ? yBot + (yTop - yBot) * t : yTop - (yTop - yBot) * t;
      b.boxMM(h.x0, yBot - 0.3, z0, h.x1, top, z1, 'darkConcrete', { surface: 'concrete', climbable: false, tex: 4 });
    }
  };
  ramp(h1, 0.15, -3.5, true); ramp(h2, -3.5, -7, false);
  // underground perimeter walls
  for (const y of [-7, -3.5]) {
    b.boxMM(G.x0 - 0.3, y, G.z0 - 0.3, G.x1 + 0.3, y + 3.5, G.z0, 'concrete'); b.boxMM(G.x0 - 0.3, y, G.z1, G.x1 + 0.3, y + 3.5, G.z1 + 0.3, 'concrete');
    b.boxMM(G.x0 - 0.3, y, G.z0, G.x0, y + 3.5, G.z1, 'concrete'); b.boxMM(G.x1, y, G.z0, G.x1 + 0.3, y + 3.5, G.z1, 'concrete');
  }
  // ground level low walls with an entrance on the south side
  b.boxMM(G.x0, 0.15, G.z1 - 0.3, G.x1, 1.2, G.z1, 'concrete'); b.boxMM(G.x0, 0.15, G.z0, G.x0 + 0.3, 1.2, G.z1, 'concrete'); b.boxMM(G.x1 - 0.3, 0.15, G.z0, G.x1, 1.2, G.z1, 'concrete');
  b.boxMM(G.x0, 0.15, G.z0, G.x0 + 14, 1.2, G.z0 + 0.3, 'concrete'); b.boxMM(G.x0 + 22, 0.15, G.z0, G.x1, 1.2, G.z0 + 0.3, 'concrete');
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(6, 1), new THREE.MeshBasicMaterial({ map: textTexture('PARKING  P', { w: 512, h: 86, bg: '#0a1a3a', fg: '#e0e8ff', font: 'bold 60px Arial' }), toneMapped: false }));
  sign.position.set(G.x0 + 18, 4.5, G.z0 - 0.05); sign.rotation.y = Math.PI; b.root.add(sign);
  // fluorescent lights per level
  for (const y of [3.4, -0.2, -3.7]) for (let x = G.x0 + 8; x < G.x1; x += 12) for (let z = G.z0 + 8; z < G.z1; z += 12) {
    b.box(x, y, z, 1.6, 0.08, 0.2, 'lampCold', { collide: false, cast: false });
    b.light(x, y - 0.2, z, 0xd8e8ff, y < 0 ? 7 : 9, 11, { flicker: Math.random() < 0.35 ? 0.6 : 0.02, broken: y < -3 && Math.random() < 0.4 ? 0.5 : 0, glowSize: 0.5 });
  }
  b.emitters.push({ pos: new THREE.Vector3((G.x0 + G.x1) / 2, -5, (G.z0 + G.z1) / 2), sound: 'drip', interval: [1, 4], vol: 0.4 });
  b.emitters.push({ pos: new THREE.Vector3(G.x0 + 10, -5, G.z1 - 6), sound: 'clang', interval: [30, 70], vol: 0.3 });
  // parked cars on each level
  const R = Math.random;
  for (const y of [0.15, -3.5, -7]) for (let i = 0; i < 7; i++) { const x = G.x0 + 11 + (i % 4) * 6.5, z = G.z0 + 8 + Math.floor(i / 4) * 22; car(b, x, z, Math.PI * (i % 2), undefined, { y }); }
  // nav: entrance -> level 0 -> ramp -> B1 -> ramp -> B2
  const ent = nodeAt(G.x0 + 18, G.z0 - 1.5, []); b.link(ent, nearestIn(ring, G.x0 + 18, G.z0 - 2));
  const l0 = [nodeAt(G.x0 + 18, G.z0 + 4, ['indoor'], 0.15), nodeAt(G.x0 + 18, G.z0 + 20, ['indoor', 'hide'], 0.15), nodeAt(G.x0 + 4, G.z1 - 6, ['indoor'], 0.15)];
  const rampTop = nodeAt((h1.x0 + h1.x1) / 2, h1.z1 + 1.5, ['indoor'], 0.15), rampBot = nodeAt((h1.x0 + h1.x1) / 2, h1.z0 - 1.5, ['indoor'], -3.5);
  const b1 = [nodeAt(G.x0 + 18, G.z0 + 3, ['indoor'], -3.5), nodeAt(G.x0 + 18, G.z0 + 20, ['indoor', 'hide'], -3.5), nodeAt(G.x1 - 4, G.z0 + 2.5, ['indoor'], -3.5)];
  const r2Top = nodeAt((h2.x0 + h2.x1) / 2, h2.z0 - 1.5, ['indoor'], -3.5), r2Bot = nodeAt((h2.x0 + h2.x1) / 2, h2.z1 + 1.5, ['indoor'], -7);
  const b2 = [nodeAt(G.x0 + 18, G.z1 - 4, ['indoor', 'hide'], -7), nodeAt(G.x0 + 10, G.z0 + 10, ['indoor', 'hide'], -7)];
  b.chain([ent, l0[0], l0[1], l0[2], rampTop, rampBot, b1[0], b1[1]]); b.link(b1[0], b1[2]); b.chain([b1[2], r2Top, r2Bot, b2[0], b2[1]]);
  b.link(l0[0], rampTop);
  b.item('note', 'city_cctv', G.x0 + 10, -7 + 1.3, G.z0 + 0.35, 0);
  b.box(G.x0 + 10, -7 + 2.8, G.z0 + 0.5, 0.3, 0.2, 0.4, 'blackMetal', { collide: false });
  b.anchors.hallEnd.push({ pos: new THREE.Vector3(G.x1 - 4, -7, G.z1 - 4) }, { pos: new THREE.Vector3(G.x0 + 4, -3.5, G.z1 - 4) });
  b.anchors.indoor.push({ pos: new THREE.Vector3(G.x0 + 20, -5.5, G.z0 + 20) });
  refs.garage = new THREE.Vector3(G.x0 + 18, 0, G.z0);
}

function buildApartments(b, x0, z0, x1, z1, fac, ring, nearestIn, nodeAt, refs) {
  // 5 floors. Floor 4 has apartment 4C open at the north (street) side, reached by the fire escape.
  const FH = 3.4, top = FH * 5;
  const front = z1; // street-facing facade (north)
  const ax0 = x1 - 14, ax1 = x1 - 4, az0 = front - 7; // 4C footprint
  b.boxMM(x0, 0, z0, x1, FH * 3, z1, fac, { surface: 'concrete', tex: 3 });
  b.boxMM(x0, FH * 4, z0, x1, top, z1, fac, { surface: 'concrete', tex: 3 });
  // floor 4 shell around 4C
  b.boxMM(x0, FH * 3, z0, ax0, FH * 4, z1, fac, { tex: 3 }); b.boxMM(ax1, FH * 3, z0, x1, FH * 4, z1, fac, { tex: 3 }); b.boxMM(ax0, FH * 3, z0, ax1, FH * 4, az0, fac, { tex: 3 });
  // 4C front wall with a window you can climb through
  const wx = ax0 + 3;
  b.boxMM(ax0, FH * 3, front - 0.25, wx - 0.8, FH * 4, front, fac, { tex: 3 }); b.boxMM(wx + 0.8, FH * 3, front - 0.25, ax1, FH * 4, front, fac, { tex: 3 });
  b.boxMM(wx - 0.8, FH * 3, front - 0.25, wx + 0.8, FH * 3 + 0.5, front, fac, { tex: 3 }); b.boxMM(wx - 0.8, FH * 3 + 2.7, front - 0.25, wx + 0.8, FH * 4, front, fac, { tex: 3 });
  b.boxMM(ax0, FH * 3, az0, ax1, FH * 3 + 0.05, front - 0.25, 'carpet', { surface: 'carpet', collide: false });
  // interior
  const fy = FH * 3;
  const f = new Frame(b, 0, 0, 0, fy);
  bed(f, ax1 - 1.2, az0 + 1.3, 0, 'mattress'); table(f, ax0 + 2.2, az0 + 2.0, 1.2, 0.8, 0.75, 'darkWood', true); shelf(f, ax1 - 0.3, front - 3, 3, 1.4); couch(f, ax0 + 6, front - 1.5, 2, 'fabricBrown');
  lamp(f, ax0 + 0.6, az0 + 0.6, 0xffb070, 4, 7);
  // scratch marks covering one wall
  const sc = document.createElement('canvas'); sc.width = 256; sc.height = 128; const x = sc.getContext('2d'); x.strokeStyle = 'rgba(20,10,8,0.8)'; x.lineWidth = 2;
  for (let i = 0; i < 120; i++) { const px = Math.random() * 256, py = Math.random() * 100; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (Math.random() - 0.5) * 10, py + 15 + Math.random() * 25); x.stroke(); }
  const st = new THREE.CanvasTexture(sc); st.colorSpace = THREE.SRGBColorSpace;
  const scratch = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.8), new THREE.MeshBasicMaterial({ map: st, transparent: true, depthWrite: false }));
  scratch.position.set((ax0 + ax1) / 2, fy + 1.5, az0 + 0.02); b.root.add(scratch);
  b.item('recording', 'city_tape', ax0 + 2.2, fy + 0.82, az0 + 2.0, 0);
  b.item('note', 'city_eviction', ax0 + 0.3, fy + 1.4, front - 4, Math.PI / 2);
  refs.apt = new THREE.Vector3(wx, fy, front + 1.5);
  b.window(wx, fy + 1.6, front + 0.02, 1.4, 2.0, 0, 1, true, { color: 0xffa060 });
  // fire escape: landings + stair flights on the facade
  const fx0 = ax0 - 2, fx1 = ax1 + 1;
  for (let k = 1; k <= 5; k++) {
    const y = FH * k - 0.1;
    b.boxMM(fx0, y - 0.1, front, fx1, y, front + 1.6, 'rust', { surface: 'metal', climbable: false });
    b.boxMM(fx0, y, front + 1.55, fx1, y + 1.0, front + 1.6, 'rust', { collide: false, cast: false });
    // stairs from this landing down to the previous one (alternating direction)
    const dir = k % 2 ? 1 : -1; const n = 10;
    if (k > 1) for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; const sx = dir > 0 ? fx0 + 1 + t * 7 : fx1 - 1 - t * 7; const sy = y - FH + FH * (dir > 0 ? t : t); b.boxMM(sx - 0.4, sy - 0.08, front + 1.65, sx + 0.4, sy, front + 2.6, 'rust', { surface: 'metal', climbable: false }); }
  }
  // ground ladder (climb) — and the roof
  b.boxMM(fx0 + 0.2, 0, front + 1.7, fx0 + 0.8, 3.2, front + 1.8, 'rust', { surface: 'metal' });
  b.boxMM(x0 - 0.3, top, z0 - 0.3, x1 + 0.3, top + 0.8, z1 + 0.3, 'darkConcrete', { surface: 'concrete' });
  // rooftop water tank + rift
  const tx = (x0 + x1) / 2 - 6, tz = (z0 + z1) / 2;
  for (const [dx, dz] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) b.box(tx + dx, top + 2.2, tz + dz, 0.25, 2.8, 0.25, 'rust', { collide: false });
  b.cyl(tx, top + 3.6, tz, 2.4, 2.4, 4, 'darkWood', { seg: 16, collide: true }); b.cyl(tx, top + 7.6, tz, 0.2, 2.6, 1.6, 'darkWood', { seg: 16 });
  const rift = b.item('rift', 'rift_3', (x0 + x1) / 2 + 6, top + 0.8, (z0 + z1) / 2, Math.PI / 2); rift.mesh.visible = false; rift.hidden = true;
  refs.rift = rift.pos;
  b.anchors.roof.push({ pos: new THREE.Vector3(tx + 4, top + 0.8, tz + 3) });
  // ground floor: lobby door node only (exterior)
  const lobby = nodeAt((x0 + x1) / 2, front + 1.5, ['activity']); lobby.activity = 'smoke'; b.link(lobby, nearestIn(ring, (x0 + x1) / 2, front + 3));
  b.light((x0 + x1) / 2, 3.2, front + 0.6, 0xffc080, 6, 9, { flicker: 0.3, glowSize: 0.5 });
  for (let fl = 1; fl < 5; fl++) for (let c = 0; c < 8; c++) if (Math.random() < 0.3 && fl !== 3) b.window(x0 + 3 + c * 3.5, fl * FH + 1.6, front + 0.03, 1.4, 1.6, 0, 1, true);
}
