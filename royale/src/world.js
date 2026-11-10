// World container: instanced batches, destructible map objects, and the structure "Builder" API used by map generation.
import * as THREE from 'three';
import { ChunkedInstances } from './batch.js';
import { MAP_HALF } from './config.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _col = new THREE.Color();

export const MAT_COLORS = { wood: 0xb07a45, stone: 0x9a9a9a, metal: 0x8794a0, glass: 0xaee3ff };

export class MapObject {
  constructor(kind, mat, hp) {
    this.kind = kind;           // wall | tree | rock | car | barrel | crate | fence | floor | prop
    this.mat = mat;             // wood | stone | metal | glass
    this.hp = hp; this.maxHp = hp;
    this.parts = [];            // {c: Collider|null, batch, h}
    this.alive = true;
    this.cx = 0; this.cy = 0; this.cz = 0;
    this.explosive = false;
  }
}

function prismGeometry() {
  // triangular prism, base width 1 (x), height 1 (y from 0), depth 1 (z), ridge along z
  const g = new THREE.BufferGeometry();
  const v = [
    // front tri (z=+0.5)
    -0.5, 0, 0.5, 0.5, 0, 0.5, 0, 1, 0.5,
    // back tri
    0.5, 0, -0.5, -0.5, 0, -0.5, 0, 1, -0.5,
    // left slope
    -0.5, 0, -0.5, -0.5, 0, 0.5, 0, 1, 0.5, -0.5, 0, -0.5, 0, 1, 0.5, 0, 1, -0.5,
    // right slope
    0.5, 0, 0.5, 0.5, 0, -0.5, 0, 1, -0.5, 0.5, 0, 0.5, 0, 1, -0.5, 0, 1, 0.5,
    // bottom
    -0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5,
  ];
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}

export class World {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.phys = game.phys;
    this.terrain = game.terrain;
    const lam = new THREE.MeshLambertMaterial({ color: 0xffffff });
    this.matLambert = lam;
    const box = new THREE.BoxGeometry(1, 1, 1);
    this.boxGeo = box;
    this.boxes = new ChunkedInstances(this.scene, box, lam, { name: 'boxes' });
    this.decor = new ChunkedInstances(this.scene, box, lam, { name: 'decor', castShadow: false });
    this.glass = new ChunkedInstances(this.scene, box, new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.38, depthWrite: false }), { name: 'glass', castShadow: false, receiveShadow: false });
    this.prisms = new ChunkedInstances(this.scene, prismGeometry(), lam, { name: 'prisms' });
    const cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);
    this.cyls = new ChunkedInstances(this.scene, cyl, lam, { name: 'cyls' });
    const trunk = new THREE.CylinderGeometry(0.35, 0.5, 1, 6); trunk.translate(0, 0.5, 0);
    this.trunks = new ChunkedInstances(this.scene, trunk, lam, { name: 'trunks' });
    const pine = new THREE.ConeGeometry(0.5, 1, 7); pine.translate(0, 0.5, 0);
    this.pines = new ChunkedInstances(this.scene, pine, lam, { name: 'pines' });
    const round = new THREE.IcosahedronGeometry(0.5, 1);
    this.rounds = new ChunkedInstances(this.scene, round, new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), { name: 'rounds' });
    const rock = new THREE.DodecahedronGeometry(0.5, 0);
    this.rocks = new ChunkedInstances(this.scene, rock, new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), { name: 'rocks' });
    this.batches = [this.boxes, this.decor, this.glass, this.prisms, this.cyls, this.trunks, this.pines, this.rounds, this.rocks];

    this.objects = [];
    this.chestSpots = [];      // {x,y,z, poi, rare}
    this.floorSpots = [];      // {x,y,z, poi}
    this.ammoSpots = [];
    this.footprints = [];      // minimap: {x0,z0,x1,z1,color}
    this.roads = [];           // arrays of {x,z}
    this.landingSpots = [];    // {x,z,y,poi,value}
    this.labels = [];          // map labels
    this.vaultDoors = [];
  }

  newObj(kind, mat, hp) {
    const o = new MapObject(kind, mat, hp);
    this.objects.push(o);
    return o;
  }

  // ---- raw world-space adders ----
  addBoxW(cx, y0, cz, sx, sy, sz, color, opt = {}) {
    const batch = opt.glass ? this.glass : opt.decor ? this.decor : this.boxes;
    _m.makeScale(sx, sy, sz).setPosition(cx, y0 + sy / 2, cz);
    const h = batch.add(_m, _col.set(color));
    let c = null;
    let obj = opt.obj || null;
    if (!obj && opt.destr !== false && !opt.decor) {
      const mat = opt.mat || 'wood';
      obj = this.newObj(opt.kind || 'wall', mat, opt.hp || defaultHp(mat, sx * sy * sz));
      obj.cx = cx; obj.cy = y0 + sy / 2; obj.cz = cz;
    }
    if (opt.solid !== false && !opt.decor) {
      c = this.phys.box(cx - sx / 2, y0, cz - sz / 2, cx + sx / 2, y0 + sy, cz + sz / 2, obj);
      if (opt.glass) c.glass = true;
    }
    if (obj) obj.parts.push({ c, batch, h });
    return obj || h;
  }
  addRotBoxW(cx, cy, cz, sx, sy, sz, rx, ry, rz, color, decor = true) {
    _e.set(rx, ry, rz, 'YXZ');
    _q.setFromEuler(_e);
    _m.compose(_p.set(cx, cy, cz), _q, _s.set(sx, sy, sz));
    return (decor ? this.decor : this.boxes).add(_m, _col.set(color));
  }
  addCylW(cx, y0, cz, r, h, color, opt = {}) {
    _m.makeScale(r * 2, h, r * 2).setPosition(cx, y0 + h / 2, cz);
    const hd = this.cyls.add(_m, _col.set(color));
    let obj = null;
    if (opt.destr !== false) {
      obj = this.newObj(opt.kind || 'prop', opt.mat || 'metal', opt.hp || 400);
      obj.cx = cx; obj.cy = y0 + h / 2; obj.cz = cz;
      obj.explosive = !!opt.explosive;
    }
    if (opt.solid !== false) {
      const s = r * 0.85;
      const c = this.phys.box(cx - s, y0, cz - s, cx + s, y0 + h, cz + s, obj);
      if (obj) obj.parts.push({ c, batch: this.cyls, h: hd });
    } else if (obj) obj.parts.push({ c: null, batch: this.cyls, h: hd });
    return obj;
  }

  addTree(x, z, type, s, force = false) {
    const y = this.terrain.heightAt(x, z);
    if (!force && (y < 1.6 || this.terrain.slopeAt(x, z) > 1.1)) return null;
    const obj = this.newObj('tree', 'wood', Math.round(140 + s * 80));
    obj.cx = x; obj.cy = y + 2; obj.cz = z;
    const trunkH = type === 'pine' ? 2.2 * s : 3 * s;
    _m.makeScale(0.55 * s, trunkH, 0.55 * s).setPosition(x, y - 0.3, z);
    const th = this.trunks.add(_m, _col.set(0x6b4a2e));
    const r = 0.28 * s;
    const c = this.phys.box(x - r, y - 0.3, z - r, x + r, y + trunkH + 1.5 * s, z + r, obj);
    obj.parts.push({ c, batch: this.trunks, h: th });
    const g = this.game.rng();
    if (type === 'pine') {
      const col = _col.setRGB(0.12 + g * 0.06, 0.38 + g * 0.12, 0.2 + g * 0.05).clone();
      _m.makeScale(3.4 * s, 4.2 * s, 3.4 * s).setPosition(x, y + trunkH * 0.6, z);
      obj.parts.push({ c: null, batch: this.pines, h: this.pines.add(_m, col) });
      _m.makeScale(2.5 * s, 3.4 * s, 2.5 * s).setPosition(x, y + trunkH * 0.6 + 2.6 * s, z);
      obj.parts.push({ c: null, batch: this.pines, h: this.pines.add(_m, col.multiplyScalar(1.08)) });
    } else {
      const col = _col.setRGB(0.25 + g * 0.15, 0.55 + g * 0.15, 0.2 + g * 0.06).clone();
      if (type === 'autumn') col.setRGB(0.85, 0.45 + g * 0.2, 0.15);
      if (type === 'dead') col.setRGB(0.45, 0.4, 0.3);
      _m.makeScale(4.2 * s, 3.8 * s, 4.2 * s).setPosition(x, y + trunkH + 1.2 * s, z);
      obj.parts.push({ c: null, batch: this.rounds, h: this.rounds.add(_m, col) });
    }
    return obj;
  }
  addRock(x, z, s, yOff = -0.4) {
    const y = this.terrain.heightAt(x, z);
    if (y < -0.5) return null;
    const obj = this.newObj('rock', 'stone', Math.round(250 + s * 60));
    obj.cx = x; obj.cy = y; obj.cz = z;
    const g = this.game.rng();
    _e.set(g * 3, g * 7, g * 5);
    _q.setFromEuler(_e);
    const sy = s * (0.6 + g * 0.4);
    _m.compose(_p.set(x, y + yOff + sy * 0.3, z), _q, _s.set(s * 1.3, sy, s * 1.1));
    const h = this.rocks.add(_m, _col.setRGB(0.5 + g * 0.1, 0.5 + g * 0.08, 0.5 + g * 0.06));
    const r = s * 0.5;
    const c = this.phys.box(x - r, y - 1, z - r, x + r, y + yOff + sy * 0.75, z + r, obj);
    obj.parts.push({ c, batch: this.rocks, h });
    return obj;
  }

  finalize() {
    for (const b of this.batches) b.finalize();
  }
  updateVisibility(cx, cz, dist) {
    for (const b of this.batches) b.updateVisibility(cx, cz, b === this.decor || b === this.rocks ? dist * 0.6 : dist);
  }
  setShadows(on) { for (const b of this.batches) b.setShadows(on); }

  destroyObject(o) {
    if (!o.alive) return;
    o.alive = false;
    for (const p of o.parts) {
      if (p.c) this.phys.remove(p.c);
      p.batch.hide(p.h);
    }
  }
}

function defaultHp(mat, vol) {
  if (mat === 'glass') return 25;
  const base = mat === 'wood' ? 150 : mat === 'stone' ? 300 : 450;
  return Math.round(base * Math.min(2, Math.max(0.4, vol / 3)));
}

// Builder: local-space structure authoring with quarter-turn rotation.
export class Builder {
  constructor(world, x, y, z, rot = 0) {
    this.w = world; this.x = x; this.y = y; this.z = z; this.rot = ((rot % 4) + 4) % 4;
    this.poi = null;
  }
  tx(lx, lz) {
    switch (this.rot) {
      case 0: return [this.x + lx, this.z + lz];
      case 1: return [this.x + lz, this.z - lx];
      case 2: return [this.x - lx, this.z - lz];
      default: return [this.x - lz, this.z + lx];
    }
  }
  sz(sx, sz) { return this.rot & 1 ? [sz, sx] : [sx, sz]; }
  rotDir(d) {
    // local dir index 0:+x 1:-x 2:+z 3:-z -> world
    const v = [[1, 0], [-1, 0], [0, 1], [0, -1]][d];
    const [wx, wz] = this.tx(v[0], v[1]);
    const dx = Math.round(wx - this.x), dz = Math.round(wz - this.z);
    if (dx === 1) return 0; if (dx === -1) return 1; if (dz === 1) return 2; return 3;
  }
  box(lx, ly, lz, sx, sy, sz, color, opt) {
    const [wx, wz] = this.tx(lx, lz);
    const [ax, az] = this.sz(sx, sz);
    return this.w.addBoxW(wx, this.y + ly, wz, ax, sy, az, color, opt);
  }
  cyl(lx, ly, lz, r, h, color, opt) {
    const [wx, wz] = this.tx(lx, lz);
    return this.w.addCylW(wx, this.y + ly, wz, r, h, color, opt);
  }
  // footprint rect in local coords (x0..x1, z0..z1) rising from y0 to y1 toward local dir
  ramp(x0, z0, x1, z1, y0, y1, dir, color, opt = {}) {
    const [ax, az] = this.tx(x0, z0), [bx, bz] = this.tx(x1, z1);
    const minX = Math.min(ax, bx), maxX = Math.max(ax, bx), minZ = Math.min(az, bz), maxZ = Math.max(az, bz);
    const wd = this.rotDir(dir);
    const obj = opt.obj || (opt.destr === false ? null : this.w.newObj('floor', opt.mat || 'wood', opt.hp || 200));
    const c = this.w.phys.ramp(minX, this.y + y0, minZ, maxX, this.y + y1, maxZ, wd, obj);
    // visual slab
    const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2, rise = y1 - y0;
    const alongX = wd < 2;
    const run = alongX ? maxX - minX : maxZ - minZ;
    const width = alongX ? maxZ - minZ : maxX - minX;
    const len = Math.hypot(run, rise), ang = Math.atan2(rise, run);
    let h;
    const cy = this.y + (y0 + y1) / 2 - 0.12;
    if (alongX) h = this.w.addRotBoxW(cx, cy, cz, len, 0.22, width, 0, 0, wd === 0 ? ang : -ang, color, false);
    else h = this.w.addRotBoxW(cx, cy, cz, width, 0.22, len, wd === 2 ? -ang : ang, 0, 0, color, false);
    if (obj) { obj.parts.push({ c, batch: this.w.boxes, h }); obj.cx = cx; obj.cy = cy; obj.cz = cz; }
    return obj;
  }
  // gable roof over local rect centred (cx,cz) size w x d, base y0, ridge height rh; ridge along local z if alongZ
  gable(cx, y0, cz, w, d, rh, color, alongZ = true) {
    const [wx, wz] = this.tx(cx, cz);
    const ridgeWorldZ = alongZ !== !!(this.rot & 1);
    const [ax, az] = this.sz(w, d);
    _m.makeRotationY(ridgeWorldZ ? 0 : Math.PI / 2);
    _m.scale(_s.set(ridgeWorldZ ? ax : az, rh, ridgeWorldZ ? az : ax));
    _m.setPosition(wx, this.y + y0, wz);
    const h = this.w.prisms.add(_m, _col.set(color));
    const obj = this.w.newObj('wall', 'wood', 300);
    obj.cx = wx; obj.cy = this.y + y0 + rh / 2; obj.cz = wz;
    obj.parts.push({ c: null, batch: this.w.prisms, h });
    const NB = { hide() {}, show() {} };
    const Y0 = this.y + y0, Y1 = this.y + y0 + rh;
    const x0 = wx - ax / 2, x1 = wx + ax / 2, z0 = wz - az / 2, z1 = wz + az / 2;
    if (ridgeWorldZ) {
      obj.parts.push({ c: this.w.phys.ramp(x0, Y0, z0, wx, Y1, z1, 0, obj), batch: NB, h: null });
      obj.parts.push({ c: this.w.phys.ramp(wx, Y0, z0, x1, Y1, z1, 1, obj), batch: NB, h: null });
    } else {
      obj.parts.push({ c: this.w.phys.ramp(x0, Y0, z0, x1, Y1, wz, 2, obj), batch: NB, h: null });
      obj.parts.push({ c: this.w.phys.ramp(x0, Y0, wz, x1, Y1, z1, 3, obj), batch: NB, h: null });
    }
    return obj;
  }
  // straight wall along local X (z fixed) from x0 to x1, with openings [{at,w,sill,h,glass}]
  wallX(x0, x1, z, y0, h, t, color, mat, openings = []) { this._wall(true, x0, x1, z, y0, h, t, color, mat, openings); }
  wallZ(z0, z1, x, y0, h, t, color, mat, openings = []) { this._wall(false, z0, z1, x, y0, h, t, color, mat, openings); }
  _wall(alongX, a0, a1, fixed, y0, h, t, color, mat, openings) {
    const seg = (s0, s1, sy0, sy1, glass) => {
      const len = s1 - s0;
      if (len < 0.05 || sy1 - sy0 < 0.05) return;
      const n = Math.max(1, Math.ceil(len / 4.1));
      const l = len / n;
      for (let i = 0; i < n; i++) {
        if (this.decay && !glass && this.w.game.rng() < this.decay) continue;
        const c = s0 + l * (i + 0.5);
        const opt = glass ? { mat: 'glass', glass: true, hp: 25 } : { mat, hp: undefined };
        const col = glass ? MAT_COLORS.glass : color;
        if (alongX) this.box(c, sy0, fixed, l, sy1 - sy0, t, col, opt);
        else this.box(fixed, sy0, c, t, sy1 - sy0, l, col, opt);
      }
    };
    const ops = openings.slice().sort((p, q) => p.at - q.at);
    let cur = a0;
    for (const o of ops) {
      const s = o.at - o.w / 2, e = o.at + o.w / 2;
      seg(cur, s, y0, y0 + h);
      if (o.sill > 0) seg(s, e, y0, y0 + o.sill);
      if (o.glass && !this.decay) seg(s, e, y0 + o.sill, y0 + o.sill + o.h, true);
      seg(s, e, y0 + o.sill + o.h, y0 + h);
      cur = e;
    }
    seg(cur, a1, y0, y0 + h);
  }
  // floor slab over rect, optional hole rect {x0,x1,z0,z1}
  slab(x0, x1, z0, z1, y, t, color, opt = {}, hole = null) {
    const put = (a0, a1, b0, b1) => {
      if (a1 - a0 < 0.05 || b1 - b0 < 0.05) return;
      this.box((a0 + a1) / 2, y - t, (b0 + b1) / 2, a1 - a0, t, b1 - b0, color, { mat: opt.mat || 'wood', hp: opt.hp || 300, destr: opt.destr, kind: 'floor' });
    };
    if (!hole) return put(x0, x1, z0, z1);
    put(x0, hole.x0, z0, z1);
    put(hole.x1, x1, z0, z1);
    put(hole.x0, hole.x1, z0, hole.z0);
    put(hole.x0, hole.x1, hole.z1, z1);
  }
  // navigation waypoints (world space) that lead up interior ramps to the current floor
  wp(lx, ly, lz) { const [x, z] = this.tx(lx, lz); return { x, y: this.y + ly, z }; }
  chest(lx, ly, lz, rare = false) {
    const [wx, wz] = this.tx(lx, lz);
    this.w.chestSpots.push({ x: wx, y: this.y + ly, z: wz, poi: this.poi, rare, via: ly > 1.5 && this.via ? this.via.slice() : null });
  }
  loot(lx, ly, lz) {
    const [wx, wz] = this.tx(lx, lz);
    this.w.floorSpots.push({ x: wx, y: this.y + ly, z: wz, poi: this.poi, via: ly > 1.5 && this.via ? this.via.slice() : null });
  }
  ammo(lx, ly, lz) {
    const [wx, wz] = this.tx(lx, lz);
    this.w.ammoSpots.push({ x: wx, y: this.y + ly, z: wz, poi: this.poi });
  }
  footprint(w, d, color) {
    const [a, b] = this.tx(-w / 2, -d / 2), [c, e] = this.tx(w / 2, d / 2);
    this.w.footprints.push({ x0: Math.min(a, c), z0: Math.min(b, e), x1: Math.max(a, c), z1: Math.max(b, e), color });
  }
}

export { MAP_HALF };
