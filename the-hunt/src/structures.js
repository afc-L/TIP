import * as THREE from 'three';
import { LANDMARKS } from './world.js';
import { woodTexture, metalTexture, signTexture, clothTexture, barkTexture, glowTexture } from './textures.js';
import {
  GeoBuilder, mat4, vcMat, vcMatFlat, vcMatDouble, totemGeometry, tentGeometry, campfireGeometry, truckGeometry,
  crateGeometry, boneGeometry,
} from './models.js';
import { makeRng } from './util.js';

// Buildings and set pieces. Each structure merges its boxes per material (one draw call per
// material) and registers wall colliders / walkable floors with the world.

let MATS = null;
function mats() {
  if (MATS) return MATS;
  const wood = woodTexture([96, 74, 52], { weathered: 0.6 });
  const dark = woodTexture([62, 48, 36], { weathered: 0.3 });
  const grey = woodTexture([88, 84, 76], { weathered: 1.2 });
  const metal = metalTexture();
  MATS = {
    wood: new THREE.MeshLambertMaterial({ map: wood }),
    darkWood: new THREE.MeshLambertMaterial({ map: dark }),
    greyWood: new THREE.MeshLambertMaterial({ map: grey }),
    roof: new THREE.MeshLambertMaterial({ map: dark, color: 0x6b6b6b }),
    metal: new THREE.MeshLambertMaterial({ map: metal }),
    paint: new THREE.MeshLambertMaterial({ map: grey, color: 0x8a9a7e }),
    black: new THREE.MeshLambertMaterial({ color: 0x151515 }),
    cloth: new THREE.MeshLambertMaterial({ map: clothTexture('#5a5f48'), side: THREE.DoubleSide }),
    red: new THREE.MeshLambertMaterial({ color: 0x7a1a12 }),
    bark: new THREE.MeshLambertMaterial({ map: barkTexture(), color: 0xc8c0b0 }),
    glass: new THREE.MeshLambertMaterial({ color: 0x1a2a30, transparent: true, opacity: 0.55 }),
    door: new THREE.MeshLambertMaterial({ map: grey, color: 0xc08a64 }),
  };
  return MATS;
}

/** Box geometry whose UVs are in metres so wood planks keep a consistent scale. */
function boxGeo(w, h, d, tile = 2) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      uv.setXY(i, uv.getX(i) * dims[f][0] / tile, uv.getY(i) * dims[f][1] / tile);
    }
  }
  return g;
}

function mergePlain(geoms) {
  let total = 0;
  const parts = geoms.map((g) => (g.index ? g.toNonIndexed() : g));
  for (const p of parts) total += p.attributes.position.count;
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), uv = new Float32Array(total * 2);
  let o = 0;
  for (const p of parts) {
    pos.set(p.attributes.position.array, o * 3);
    nor.set(p.attributes.normal.array, o * 3);
    if (p.attributes.uv) uv.set(p.attributes.uv.array, o * 2);
    o += p.attributes.position.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.computeBoundingSphere();
  return g;
}

export class Builder {
  constructor(world, x, z, rot, baseY = null) {
    this.world = world;
    this.x = x; this.z = z; this.rot = rot;
    this.y = baseY ?? world.heightAt(x, z);
    this.c = Math.cos(rot); this.s = Math.sin(rot);
    this.byMat = new Map();
    this.group = new THREE.Group();
    this.group.position.set(x, this.y, z);
    this.group.rotation.y = rot;
    this.anchors = [];
  }
  /** local (lx, lz) → world {x, z}. Group rotation.y = rot rotates +x toward -z. */
  toWorld(lx, ly, lz) {
    return { x: this.x + lx * this.c + lz * this.s, y: this.y + ly, z: this.z - lx * this.s + lz * this.c };
  }
  box(w, h, d, lx, ly, lz, matName, { collide = true, walk = false, ry = 0, rx = 0, rz = 0, kind = 'wood' } = {}) {
    const g = boxGeo(w, h, d);
    g.applyMatrix4(mat4(lx, ly, lz, rx, ry, rz));
    if (!this.byMat.has(matName)) this.byMat.set(matName, []);
    this.byMat.get(matName).push(g);
    const p = this.toWorld(lx, ly, lz);
    const wr = -(this.rot + ry); // collider rotation uses the opposite sense (see World.collide)
    if (collide && !rx && !rz) this.world.addBox(p.x, p.z, w / 2, d / 2, wr, this.y + ly - h / 2, this.y + ly + h / 2);
    if (walk) this.world.addSurface(p.x, p.z, w / 2, d / 2, wr, this.y + ly + h / 2, kind);
    return this;
  }
  geo(geom, matName, matrix) {
    const g = geom.clone();
    if (matrix) g.applyMatrix4(matrix);
    if (!this.byMat.has(matName)) this.byMat.set(matName, []);
    this.byMat.get(matName).push(g);
  }
  /**
   * Hinged door filling an opening. axis 'x': wall runs along local x at z = at, opening a..b.
   * axis 'z': wall runs along local z at x = at. Swings by `swing` radians when opened.
   */
  door(axis, a, b, at, floorY, h, swing = 1.6) {
    const M = mats();
    const w = b - a - 0.04;
    const pivot = new THREE.Group();
    const leaf = new THREE.Group();
    if (axis === 'x') {
      pivot.position.set(a + 0.02, floorY, at);
      const m = new THREE.Mesh(boxGeo(w, h - 0.03, 0.06, 1), M.door);
      m.position.set(w / 2, h / 2, 0);
      leaf.add(m);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), M.metal);
      knob.position.set(w - 0.1, 1.0, 0.06);
      const knob2 = knob.clone(); knob2.position.z = -0.06;
      leaf.add(knob, knob2);
    } else {
      pivot.position.set(at, floorY, a + 0.02);
      const m = new THREE.Mesh(boxGeo(0.06, h - 0.03, w, 1), M.door);
      m.position.set(0, h / 2, w / 2);
      leaf.add(m);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), M.metal);
      knob.position.set(0.06, 1.0, w - 0.1);
      const knob2 = knob.clone(); knob2.position.x = -0.06;
      leaf.add(knob, knob2);
    }
    leaf.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    pivot.add(leaf);
    this.group.add(pivot);
    const mid = (a + b) / 2;
    const c = axis === 'x' ? this.toWorld(mid, floorY, at) : this.toWorld(at, floorY, mid);
    const box = this.world.addBox(c.x, c.z, axis === 'x' ? (b - a) / 2 : 0.08, axis === 'x' ? 0.08 : (b - a) / 2, -this.rot, this.y + floorY, this.y + floorY + h);
    const d = { pivot, box, open: false, ang: 0, swing, pos: { x: c.x, y: c.y + 1.0, z: c.z } };
    this.world.doors.push(d);
    return d;
  }

  anchor(lx, ly, lz, tag = 'floor') {
    const p = this.toWorld(lx, ly, lz);
    p.tag = tag;
    this.anchors.push(p);
    return p;
  }
  finish(scene, { shadows = true } = {}) {
    const M = mats();
    for (const [name, list] of this.byMat) {
      const mesh = new THREE.Mesh(mergePlain(list), M[name]);
      mesh.castShadow = shadows;
      mesh.receiveShadow = true;
      this.group.add(mesh);
    }
    scene.add(this.group);
    return this;
  }
}

// ---------------------------------------------------------------- pieces

/** Wall along local x from x0..x1 at z, with optional openings [{a, b, y0, y1}] in x-range. */
function wallX(B, x0, x1, z, floorY, h, mat, openings = [], t = 0.16) {
  openings = [...openings].sort((p, q) => p.a - q.a); // cut pieces must go left to right
  const cuts = [x0, ...openings.flatMap((o) => [o.a, o.b]), x1];
  for (let i = 0; i < cuts.length - 1; i += 2) {
    const a = cuts[i], b = cuts[i + 1];
    if (b - a > 0.01) B.box(b - a, h, t, (a + b) / 2, floorY + h / 2, z, mat);
  }
  for (const o of openings) {
    const w = o.b - o.a;
    if (o.y0 > 0.01) B.box(w, o.y0, t, (o.a + o.b) / 2, floorY + o.y0 / 2, z, mat);
    if (o.y1 < h) B.box(w, h - o.y1, t, (o.a + o.b) / 2, floorY + (o.y1 + h) / 2, z, mat);
  }
}
function wallZ(B, z0, z1, x, floorY, h, mat, openings = [], t = 0.16) {
  openings = [...openings].sort((p, q) => p.a - q.a);
  const cuts = [z0, ...openings.flatMap((o) => [o.a, o.b]), z1];
  for (let i = 0; i < cuts.length - 1; i += 2) {
    const a = cuts[i], b = cuts[i + 1];
    if (b - a > 0.01) B.box(t, h, b - a, x, floorY + h / 2, (a + b) / 2, mat);
  }
  for (const o of openings) {
    const w = o.b - o.a;
    if (o.y0 > 0.01) B.box(t, o.y0, w, x, floorY + o.y0 / 2, (o.a + o.b) / 2, mat);
    if (o.y1 < h) B.box(t, h - o.y1, w, x, floorY + (o.y1 + h) / 2, (o.a + o.b) / 2, mat);
  }
}

function gableRoof(B, w, d, wallTop, rise, mat, overhang = 0.4) {
  const hw = d / 2 + overhang;
  const len = Math.hypot(hw, rise);
  const ang = Math.atan2(rise, hw);
  B.box(w + overhang * 2, 0.12, len, 0, wallTop + rise / 2, hw / 2, mat, { collide: false, rx: ang });
  B.box(w + overhang * 2, 0.12, len, 0, wallTop + rise / 2, -hw / 2, mat, { collide: false, rx: -ang });
  // gable triangles
  const tri = new THREE.BufferGeometry();
  const hd = d / 2;
  tri.setAttribute('position', new THREE.Float32BufferAttribute([0, rise, 0, -hd, 0, 0, hd, 0, 0, 0, rise, 0, hd, 0, 0, -hd, 0, 0], 3));
  tri.setAttribute('uv', new THREE.Float32BufferAttribute([0.5, rise / 2, -hd / 2, 0, hd / 2, 0, 0.5, rise / 2, hd / 2, 0, -hd / 2, 0], 2));
  tri.computeVertexNormals();
  B.geo(tri, 'wood', mat4(-w / 2, wallTop, 0, 0, Math.PI / 2, 0));
  B.geo(tri, 'wood', mat4(w / 2, wallTop, 0, 0, Math.PI / 2, 0));
}

function table(B, lx, lz, floorY, ry = 0) {
  B.box(1.4, 0.06, 0.8, lx, floorY + 0.78, lz, 'darkWood', { collide: false, ry });
  for (const [a, b] of [[-0.6, -0.33], [0.6, -0.33], [-0.6, 0.33], [0.6, 0.33]]) {
    const c = Math.cos(ry), s = Math.sin(ry);
    B.box(0.06, 0.76, 0.06, lx + a * c + b * s, floorY + 0.38, lz - a * s + b * c, 'darkWood', { collide: false });
  }
  B.world.addBox(...(() => { const p = B.toWorld(lx, 0, lz); return [p.x, p.z, 0.7, 0.4, -(B.rot + ry), B.y + floorY, B.y + floorY + 0.8]; })());
  return B.anchor(lx, floorY + 0.82, lz, 'table');
}

function bed(B, lx, lz, floorY, ry = 0) {
  B.box(0.95, 0.35, 2.0, lx, floorY + 0.3, lz, 'darkWood', { ry });
  B.box(0.85, 0.12, 1.9, lx, floorY + 0.52, lz, 'cloth', { collide: false, ry });
  return B.anchor(lx, floorY + 0.6, lz, 'bed');
}

function shelf(B, lx, lz, floorY, ry = 0) {
  B.box(1.2, 1.8, 0.35, lx, floorY + 0.9, lz, 'darkWood', { ry });
  const a = [];
  for (const y of [0.5, 1.1]) a.push(B.anchor(lx, floorY + y + 0.9 - 0.9 + 0.02, lz, 'shelf'));
  return a;
}

// ---------------------------------------------------------------- structures

export function buildCabin(world, scene, L, rot, { name = 'cabin', ruined = false } = {}) {
  const B = new Builder(world, L.x, L.z, rot);
  const W = 6.4, D = 5.2, F = 0.45, H = 2.6;
  B.box(W + 0.2, F, D + 0.2, 0, F / 2, 0, 'darkWood', { collide: false, walk: true });
  wallX(B, -W / 2, W / 2, -D / 2, F, H, 'wood', [{ a: -1.8, b: -0.8, y0: 1.0, y1: 1.9 }]);
  wallX(B, -W / 2, W / 2, D / 2, F, H, 'wood', [{ a: 0.6, b: 1.65, y0: 0, y1: 2.15 }, { a: -2.0, b: -1.0, y0: 1.0, y1: 1.9 }]);
  wallZ(B, -D / 2, D / 2, -W / 2, F, H, 'wood');
  wallZ(B, -D / 2, D / 2, W / 2, F, H, 'wood', [{ a: -0.6, b: 0.6, y0: 1.0, y1: 1.9 }]);
  B.door('x', 0.6, 1.65, D / 2, F, 2.15);
  gableRoof(B, W, D, F + H, 1.6, ruined ? 'greyWood' : 'roof');
  // porch
  B.box(W, 0.3, 1.8, 0, 0.15, D / 2 + 0.95, 'greyWood', { collide: false, walk: true });
  B.box(1.0, 0.16, 0.45, 1.1, 0.08, D / 2 + 2.05, 'greyWood', { collide: false, walk: true });
  for (const x of [-W / 2 + 0.2, W / 2 - 0.2]) B.box(0.14, 2.4, 0.14, x, 1.5, D / 2 + 1.7, 'darkWood');
  B.box(W + 0.4, 0.1, 2.0, 0, 2.75, D / 2 + 1.0, 'roof', { collide: false, rx: 0.12 });
  // interior
  const a = [];
  a.push(table(B, -1.5, -1.2, F));
  a.push(bed(B, 2.4, -1.4, F, Math.PI / 2));
  a.push(...shelf(B, -2.95, 1.4, F, Math.PI / 2));
  B.box(0.7, 0.9, 0.6, 2.6, F + 0.45, 1.6, 'black'); // wood stove
  B.box(0.14, 2.6, 0.14, 2.6, F + 2.2, 1.6, 'black', { collide: false });
  a.push(B.anchor(0.2, F + 0.02, 0.3, 'floor'), B.anchor(-2.2, F + 0.02, 1.8, 'floor'), B.anchor(1.2, 0.32, D / 2 + 1.1, 'porch'));
  if (ruined) {
    B.box(1.4, 0.1, 2.4, -1.4, F + 0.3, 0.6, 'greyWood', { collide: false, rx: 0.3, rz: 0.2 });
  }
  B.finish(scene);
  B.doorWorld = B.toWorld(1.1, F, D / 2 + 1.4);
  B.insideWorld = B.toWorld(0, F, 0);
  return B;
}

export function buildTower(world, scene, L, rot) {
  const B = new Builder(world, L.x, L.z, rot);
  const P = 6.2, S = 3.4;
  for (const [x, z] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) {
    B.box(0.18, P + 0.2, 0.18, x * 1.08, (P + 0.2) / 2 - 0.2, z * 1.08, 'darkWood', { rx: 0 });
  }
  // cross braces (visual)
  for (const z of [-1.6, 1.6]) {
    B.box(0.08, 0.08, 4.4, 0, P * 0.45, z, 'darkWood', { collide: false, ry: Math.PI / 2, rx: 0.95 });
  }
  B.box(S, 0.16, S, 0, P, 0, 'greyWood', { collide: false, walk: true });
  // underside blocker so you cannot stand under the platform's collision
  // rails (leave ladder gap on +z)
  wallX(B, -S / 2, S / 2, -S / 2, P + 0.08, 1.0, 'darkWood', [], 0.08);
  wallZ(B, -S / 2, S / 2, -S / 2, P + 0.08, 1.0, 'darkWood', [], 0.08);
  wallZ(B, -S / 2, S / 2, S / 2, P + 0.08, 1.0, 'darkWood', [], 0.08);
  wallX(B, -S / 2, S / 2, S / 2, P + 0.08, 1.0, 'darkWood', [{ a: -0.45, b: 0.45, y0: 0, y1: 1.0 }], 0.08);
  for (const [x, z] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) B.box(0.1, 2.2, 0.1, x, P + 1.1, z, 'darkWood', { collide: false });
  B.box(S + 0.6, 0.1, S + 0.6, 0, P + 2.25, 0, 'roof', { collide: false });
  // ladder
  for (const x of [-0.35, 0.35]) B.box(0.07, P + 1.0, 0.07, x, (P + 1.0) / 2, S / 2 + 0.25, 'darkWood', { collide: false, rx: -0.08 });
  for (let y = 0.4; y < P; y += 0.42) B.box(0.75, 0.05, 0.05, 0, y, S / 2 + 0.25 + (P - y) * 0.08 - 0.5 * 0.08 * 0, 'darkWood', { collide: false });
  B.finish(scene);
  B.ladderBottom = B.toWorld(0, 0, S / 2 + 1.0);
  B.ladderTop = B.toWorld(0, P + 0.1, S / 2 - 0.6);
  B.platformY = B.y + P + 0.08;
  B.anchor(0.9, P + 0.1, -0.9, 'platform');
  return B;
}

export function buildStation(world, scene, L, rot) {
  const B = new Builder(world, L.x, L.z, rot);
  const W = 11, D = 8, F = 0.5, H = 2.9;
  B.box(W + 0.3, F, D + 0.3, 0, F / 2, 0, 'darkWood', { collide: false, walk: true });
  wallX(B, -W / 2, W / 2, -D / 2, F, H, 'paint', [{ a: -3.6, b: -2.2, y0: 1.0, y1: 2.0 }, { a: 2.0, b: 3.4, y0: 1.0, y1: 2.0 }]);
  wallX(B, -W / 2, W / 2, D / 2, F, H, 'paint', [{ a: -0.6, b: 0.6, y0: 0, y1: 2.2 }, { a: -4.0, b: -2.4, y0: 1.0, y1: 2.0 }, { a: 2.4, b: 4.0, y0: 1.0, y1: 2.0 }]);
  wallZ(B, -D / 2, D / 2, -W / 2, F, H, 'paint', [{ a: -1, b: 0.4, y0: 1.0, y1: 2.0 }]);
  wallZ(B, -D / 2, D / 2, W / 2, F, H, 'paint');
  // interior partition: office (front/left) vs back room (right)
  wallZ(B, -D / 2, D / 2, 1.8, F, H, 'wood', [{ a: 0.4, b: 1.4, y0: 0, y1: 2.15 }]);
  B.door('x', -0.6, 0.6, D / 2, F, 2.2);
  B.door('z', 0.4, 1.4, 1.8, F, 2.15, -1.6);
  gableRoof(B, W, D, F + H, 1.8, 'roof');
  // porch + steps + sign
  B.box(W, 0.35, 2.2, 0, 0.17, D / 2 + 1.15, 'greyWood', { collide: false, walk: true });
  B.box(1.6, 0.18, 0.5, 0, 0.09, D / 2 + 2.45, 'greyWood', { collide: false, walk: true });
  for (const x of [-W / 2 + 0.2, -1.2, 1.2, W / 2 - 0.2]) B.box(0.16, 2.6, 0.16, x, 1.6, D / 2 + 2.1, 'darkWood');
  B.box(W + 0.4, 0.1, 2.4, 0, 2.95, D / 2 + 1.2, 'roof', { collide: false, rx: 0.1 });
  // antenna mast on roof
  B.box(0.08, 6, 0.08, -4.5, F + H + 3, -2.5, 'metal', { collide: false });
  B.box(1.2, 0.04, 0.04, -4.5, F + H + 5.6, -2.5, 'metal', { collide: false });
  // office furniture
  const anchors = {};
  B.box(2.2, 0.08, 0.8, -3.6, F + 0.78, -3.4, 'darkWood', { collide: false });
  B.box(2.2, 0.76, 0.75, -3.6, F + 0.38, -3.4, 'darkWood'); // radio desk
  B.box(0.6, 0.35, 0.4, -3.9, F + 1.0, -3.55, 'metal', { collide: false }); // radio set
  B.box(0.3, 0.2, 0.3, -3.1, F + 0.92, -3.5, 'black', { collide: false });
  anchors.radio = B.toWorld(-3.6, F + 1.0, -2.9);
  anchors.desk = B.anchor(-2.8, F + 0.83, -3.3, 'table');
  B.box(0.6, 1.3, 0.55, -5.1, F + 0.65, 1.5, 'metal'); // filing cabinet
  anchors.cabinet = B.anchor(-5.1, F + 1.32, 1.5, 'shelf');
  anchors.table = table(B, -1.6, 0.2, F);
  B.box(1.4, 1.0, 0.04, -0.6, F + 1.6, -3.9, 'paint', { collide: false }); // map board
  anchors.mapBoard = B.toWorld(-0.6, F + 1.4, -3.4);
  // back room
  anchors.bed = bed(B, 4.6, -2.6, F);
  anchors.shelf = shelf(B, 4.9, 2.6, F, Math.PI / 2);
  B.box(1.0, 0.9, 0.6, 3.0, F + 0.45, -3.4, 'darkWood');
  anchors.locker = B.anchor(3.0, F + 0.92, -3.4, 'shelf');
  anchors.floors = [B.anchor(0, F + 0.02, 2.5, 'floor'), B.anchor(3.4, F + 0.02, 1.5, 'floor'), B.anchor(-4.2, F + 0.02, 2.8, 'floor')];
  // generator shed outside (right side)
  B.box(1.8, 1.6, 1.4, W / 2 + 1.8, 0.8, -1.5, 'greyWood');
  B.box(2.2, 0.08, 1.8, W / 2 + 1.8, 1.65, -1.5, 'roof', { collide: false, rz: 0.1 });
  anchors.generator = B.toWorld(W / 2 + 1.8, 0.8, -0.4);
  B.finish(scene);
  // sign
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.7), new THREE.MeshLambertMaterial({ map: signTexture(['BLACKPINE', 'RANGER STATION']) }));
  sign.position.set(0, 3.3, D / 2 + 2.32);
  B.group.add(sign);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: 0x222222 }));
  lamp.position.set(0, F + H - 0.1, 0);
  B.group.add(lamp);
  B.lampMesh = lamp;
  B.lampWorld = B.toWorld(0, F + H - 0.4, 0);
  B.extra = anchors;
  return B;
}

export function buildRelay(world, scene, L, rot) {
  const B = new Builder(world, L.x, L.z, rot);
  const W = 3.6, D = 3.0, F = 0.3, H = 2.4;
  B.box(W + 0.2, F, D + 0.2, 0, F / 2, 0, 'greyWood', { collide: false, walk: true });
  wallX(B, -W / 2, W / 2, -D / 2, F, H, 'metal');
  wallX(B, -W / 2, W / 2, D / 2, F, H, 'metal', [{ a: -0.5, b: 0.5, y0: 0, y1: 2.0 }]);
  B.door('x', -0.5, 0.5, D / 2, F, 2.0);
  wallZ(B, -D / 2, D / 2, -W / 2, F, H, 'metal', [{ a: -0.5, b: 0.4, y0: 1.0, y1: 1.6 }]);
  wallZ(B, -D / 2, D / 2, W / 2, F, H, 'metal');
  B.box(W + 0.5, 0.1, D + 0.6, 0, F + H + 0.05, 0, 'metal', { collide: false, rx: 0.05 });
  B.box(1.6, 0.06, 0.6, -0.8, F + 0.8, -1.1, 'darkWood', { collide: false });
  B.box(1.6, 0.76, 0.5, -0.8, F + 0.38, -1.1, 'metal');
  B.box(0.5, 0.4, 0.35, -1.2, F + 1.0, -1.15, 'black', { collide: false });
  const anchors = { desk: B.anchor(-0.4, F + 0.84, -1.0, 'table'), floor: B.anchor(0.9, F + 0.02, 0.4, 'floor') };
  // lattice tower
  const tx = 4.2, tz = -2.0, TH = 22;
  for (const [x, z] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) {
    B.box(0.07, TH, 0.07, tx + x * (1 - 0.0), TH / 2, tz + z, 'metal', { collide: false });
  }
  world.addBox(...(() => { const p = B.toWorld(tx, 0, tz); return [p.x, p.z, 0.7, 0.7, -rot, B.y, B.y + TH]; })());
  for (let y = 1; y < TH; y += 1.6) {
    B.box(1.2, 0.04, 0.04, tx, y, tz - 0.6, 'metal', { collide: false });
    B.box(1.2, 0.04, 0.04, tx, y, tz + 0.6, 'metal', { collide: false });
    B.box(0.04, 0.04, 1.2, tx - 0.6, y, tz, 'metal', { collide: false });
    B.box(0.04, 0.04, 1.2, tx + 0.6, y, tz, 'metal', { collide: false });
    B.box(1.6, 0.03, 0.03, tx, y + 0.8, tz - 0.6, 'metal', { collide: false, rz: 0.9 });
  }
  B.finish(scene);
  // blinking red beacon
  const beacon = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,40,30,1)', 'rgba(255,0,0,0)'), blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  beacon.scale.setScalar(2.2);
  beacon.position.set(tx, TH + 0.4, tz);
  B.group.add(beacon);
  B.beacon = beacon;
  B.extra = anchors;
  return B;
}

export function buildGate(world, scene, L) {
  const B = new Builder(world, L.x, L.z, 0);
  for (const x of [-3.2, 3.2]) B.box(0.3, 1.6, 0.3, x, 0.8, 0, 'metal');
  B.box(6.2, 0.14, 0.14, 0, 1.05, 0, 'paint');
  for (let i = -3; i <= 3; i++) B.box(0.4, 0.15, 0.16, i * 0.9, 1.05, 0, i % 2 ? 'red' : 'paint', { collide: false });
  // fences running into the trees
  for (const side of [-1, 1]) {
    for (let k = 0; k < 6; k++) {
      const x = side * (4 + k * 3.2);
      B.box(0.15, 1.4, 0.15, x, 0.7, 0, 'darkWood');
      B.box(3.2, 0.1, 0.06, x - side * 1.6, 1.1, 0, 'darkWood', { collide: false });
      B.box(3.2, 0.1, 0.06, x - side * 1.6, 0.6, 0, 'darkWood', { collide: false });
    }
    world.addBox(L.x + side * 12, L.z, 9, 0.2, 0, B.y - 2, B.y + 3);
  }
  B.finish(scene);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.0), new THREE.MeshLambertMaterial({ map: signTexture(['ROAD CLOSED', 'BLACKPINE S.F.', 'NO EXIT'], { bg: '#c9b98a', fg: '#2a1a10', font: 'bold 50px Arial, sans-serif' }), side: THREE.DoubleSide }));
  sign.position.set(0, 1.6, 0.12);
  B.group.add(sign);
  B.interactWorld = B.toWorld(0, 0, 1.5);
  return B;
}

export function buildDock(world, scene, L) {
  const B = new Builder(world, L.x, L.z, -Math.PI / 2, world.waterLevel + 0.55);
  B.box(1.8, 0.12, 14, 0, 0, -4, 'greyWood', { collide: false, walk: true });
  for (let z = 2; z > -11; z -= 2.5) for (const x of [-0.85, 0.85]) B.box(0.12, 2.2, 0.12, x, -1.0, z, 'darkWood', { collide: false });
  // rowboat
  const boat = new GeoBuilder();
  boat.add(new THREE.CylinderGeometry(0.7, 0.5, 3.2, 8, 1, true, 0, Math.PI), '#4a3a2a', mat4(0, 0.15, 0, Math.PI / 2, 0, Math.PI));
  const bm = new THREE.Mesh(boat.build(), vcMatDouble);
  bm.position.set(1.8, -0.4, -7);
  bm.rotation.y = 0.15;
  B.group.add(bm);
  B.finish(scene);
  B.anchor(0, 0.08, -9.5, 'dock');
  return B;
}

export function buildHunterCamp(world, scene, L) {
  const B = new Builder(world, L.x, L.z, 0.3);
  B.finish(scene);
  const group = B.group;
  const fire = new THREE.Mesh(campfireGeometry(), vcMatFlat);
  group.add(fire);
  const logs = new GeoBuilder();
  logs.add(new THREE.CylinderGeometry(0.22, 0.24, 1.8, 7), '#4a3a2a', mat4(0, 0.22, 2.0, 0, 0, Math.PI / 2));
  logs.add(new THREE.CylinderGeometry(0.22, 0.24, 1.8, 7), '#4a3a2a', mat4(-2.0, 0.22, 0.2, Math.PI / 2, 0, Math.PI / 2));
  group.add(new THREE.Mesh(logs.build(), vcMatFlat));
  const tent = new THREE.Mesh(tentGeometry({ color: '#566043' }), vcMatDouble);
  tent.position.set(4.5, 0, -3.5);
  tent.rotation.y = 0.5;
  tent.visible = false; // pitched by the player
  tent.castShadow = true;
  group.add(tent);
  const crate = new THREE.Mesh(crateGeometry(), vcMatFlat);
  crate.position.set(-2.8, 0, -2.6);
  group.add(crate);
  const tentSpot = B.toWorld(4.5, 0, -3.5);
  world.addCircle(tentSpot.x, tentSpot.z, 1.1, 'prop');
  const cr = B.toWorld(-2.8, 0, -2.6);
  world.addCircle(cr.x, cr.z, 0.45, 'prop');
  B.tent = tent;
  B.fireWorld = B.toWorld(0, 0.3, 0);
  B.tentWorld = tentSpot;
  B.crateWorld = B.toWorld(-2.8, 0.6, -2.6);
  B.fireMesh = fire;
  return B;
}

export function buildTrailhead(world, scene, L) {
  const B = new Builder(world, L.x + 3.5, L.z + 2, 0.15);
  B.finish(scene);
  const truck = new THREE.Mesh(truckGeometry(), vcMatFlat);
  truck.castShadow = true;
  B.group.add(truck);
  world.addBox(B.x, B.z, 1.05, 2.6, -0.15, B.y, B.y + 2.3);
  B.truckWorld = B.toWorld(-1.3, 1.2, -0.8);
  // trail sign
  const s = new Builder(world, L.x - 4, L.z - 6, 0);
  s.box(0.12, 2.0, 0.12, -0.8, 1.0, 0, 'darkWood');
  s.box(0.12, 2.0, 0.12, 0.8, 1.0, 0, 'darkWood');
  s.finish(scene);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.0), new THREE.MeshLambertMaterial({ map: signTexture(['BLACKPINE', 'STATE FOREST', 'HUNTING ZONE 7']), side: THREE.DoubleSide }));
  sign.position.set(0, 1.6, 0.08);
  s.group.add(sign);
  return B;
}

export function buildAbandonedCamp(world, scene, L) {
  const B = new Builder(world, L.x, L.z, -0.6);
  B.finish(scene);
  const g = B.group;
  const fire = new THREE.Mesh(campfireGeometry(), vcMatFlat);
  g.add(fire);
  const t1 = new THREE.Mesh(tentGeometry({ torn: true, color: '#7a5a2a' }), vcMatDouble);
  t1.position.set(3.5, 0, -2);
  t1.rotation.y = 0.9;
  const t2 = new THREE.Mesh(tentGeometry({ torn: true, color: '#3a4a5a' }), vcMatDouble);
  t2.position.set(-3, 0, -3);
  t2.rotation.set(0.1, -0.4, 0.25);
  g.add(t1, t2);
  const cooler = new GeoBuilder();
  cooler.add(new THREE.BoxGeometry(0.7, 0.45, 0.45), '#2a5a7a', mat4(0, 0.22, 0));
  cooler.add(new THREE.BoxGeometry(0.72, 0.08, 0.47), '#e6e6e6', mat4(0.1, 0.5, 0.25, 0.9, 0, 0));
  const cm = new THREE.Mesh(cooler.build(), vcMatFlat);
  cm.position.set(1.2, 0, 2.2);
  g.add(cm);
  const chair = new GeoBuilder();
  chair.add(new THREE.BoxGeometry(0.5, 0.05, 0.5), '#2d3d2d', mat4(0, 0.45, 0));
  chair.add(new THREE.BoxGeometry(0.5, 0.5, 0.05), '#2d3d2d', mat4(0, 0.7, 0.25));
  const ch = new THREE.Mesh(chair.build(), vcMatFlat);
  ch.position.set(-1.5, 0.15, 1.5);
  ch.rotation.set(1.4, 0.4, 0.1); // knocked over
  g.add(ch);
  // claw marks: dark streaks on a nearby tree are implied by a broken lantern + blood smear decal
  const smear = new THREE.Mesh(new THREE.CircleGeometry(0.9, 9), new THREE.MeshLambertMaterial({ color: 0x2a0806, transparent: true, opacity: 0.8, depthWrite: false }));
  smear.rotation.x = -Math.PI / 2;
  smear.position.set(2.2, 0.03, -0.4);
  smear.scale.set(1, 0.4, 1);
  g.add(smear);
  for (const [x, z] of [[3.5, -2], [-3, -3]]) { const p = B.toWorld(x, 0, z); world.addCircle(p.x, p.z, 1.0, 'prop'); }
  B.extra = {
    tent: B.anchor(3.2, 0.05, -1.3, 'floor'),
    fire: B.anchor(0.8, 0.05, 0.4, 'floor'),
    cooler: B.anchor(1.2, 0.52, 2.2, 'table'),
    chair: B.anchor(-1.3, 0.05, 1.0, 'floor'),
  };
  return B;
}

export function buildHollow(world, scene, L) {
  const B = new Builder(world, L.x, L.z, 0);
  B.finish(scene);
  const g = B.group;
  const r = makeRng(666);
  // the heart tree: a vast, pale, twisted dead trunk
  const heart = new GeoBuilder();
  heart.add(new THREE.CylinderGeometry(0.6, 1.6, 10, 9, 4), '#b8ad98', mat4(0, 5, 0), { jitter: 0.5, rng: r });
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + r();
    const len = 3 + r() * 4;
    const m = new THREE.Matrix4().makeRotationY(a).multiply(mat4(0, 5 + r() * 5, 0, 0, 0, 0.7 + r() * 0.6)).multiply(mat4(0, len / 2, 0));
    heart.add(new THREE.CylinderGeometry(0.06, 0.32, len, 5), '#a89d88', m, { jitter: 0.2, rng: r });
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    heart.add(new THREE.CylinderGeometry(0.1, 0.4, 3.5, 5), '#9c917c', mat4(Math.cos(a) * 1.6, 0.5, Math.sin(a) * 1.6, Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2));
  }
  const heartMesh = new THREE.Mesh(heart.build(), vcMatFlat);
  heartMesh.castShadow = true;
  g.add(heartMesh);
  world.addCircle(L.x, L.z, 1.7, 'tree');
  // ring of standing stones
  const stones = new GeoBuilder();
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    stones.add(new THREE.BoxGeometry(0.6, 1.6 + r(), 0.4), '#4a4a46', mat4(Math.cos(a) * 9, 0.6, Math.sin(a) * 9, r() * 0.2, -a, r() * 0.15), { jitter: 0.15, rng: r });
    world.addCircle(L.x + Math.cos(a) * 9, L.z + Math.sin(a) * 9, 0.45, 'rock');
  }
  g.add(new THREE.Mesh(stones.build(), vcMatFlat));
  // totems everywhere: on the ground, hanging from cords
  const totems = new GeoBuilder();
  for (let i = 0; i < 26; i++) {
    const a = r() * Math.PI * 2, d = 4 + r() * 18;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    const hang = r() < 0.6;
    const y = hang ? 2 + r() * 2.5 : world.heightAt(L.x + x, L.z + z) - B.y;
    const tg = totemGeometry(i * 7 + 1, 0.6 + r() * 0.9);
    tg.applyMatrix4(mat4(x, y, z, r() * 0.2, r() * 6, r() * 0.3));
    totems.parts.push(tg);
    if (hang) {
      const cord = new THREE.CylinderGeometry(0.006, 0.006, 3, 3);
      cord.applyMatrix4(mat4(x, y + 2.8, z));
      const cg = new GeoBuilder();
      cg.add(cord, '#3a3020');
      totems.parts.push(cg.parts[0]);
    }
  }
  const tm = new THREE.Mesh(totems.build(), vcMatDouble);
  g.add(tm);
  for (let i = 0; i < 6; i++) {
    const bm = new THREE.Mesh(boneGeometry(i + 3), vcMatFlat);
    const a = r() * 6.28, d = 2 + r() * 8;
    bm.position.set(Math.cos(a) * d, world.heightAt(L.x + Math.cos(a) * d, L.z + Math.sin(a) * d) - B.y + 0.02, Math.sin(a) * d);
    bm.rotation.y = r() * 6;
    g.add(bm);
  }
  B.heartWorld = B.toWorld(0, 0, 2.6);
  return B;
}

/** A lone totem planted somewhere in the forest (events spawn these as the hunt goes on). */
export function makeTotemMesh(seed, scale = 1) {
  const m = new THREE.Mesh(totemGeometry(seed, scale), vcMatDouble);
  m.castShadow = true;
  return m;
}

export function buildAll(world, scene) {
  const S = {};
  S.trailhead = buildTrailhead(world, scene, LANDMARKS.trailhead);
  S.camp = buildHunterCamp(world, scene, LANDMARKS.camp);
  S.abandoned = buildAbandonedCamp(world, scene, LANDMARKS.abandoned);
  S.station = buildStation(world, scene, LANDMARKS.station, 0.35);
  S.relay = buildRelay(world, scene, LANDMARKS.relay, -0.5);
  S.harlan = buildCabin(world, scene, LANDMARKS.harlan, 2.4, { name: 'harlan' });
  S.miller = buildCabin(world, scene, LANDMARKS.miller, -0.9, { name: 'miller', ruined: true });
  S.towers = ['towerA', 'towerB', 'towerC', 'towerD'].map((k, i) => buildTower(world, scene, LANDMARKS[k], i * 1.3 + 0.4));
  S.gate = buildGate(world, scene, LANDMARKS.gate);
  S.dock = buildDock(world, scene, LANDMARKS.dock);
  S.hollow = buildHollow(world, scene, LANDMARKS.hollow);
  return S;
}
