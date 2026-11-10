// Player/AI construction: grid-snapped walls, floors, ramps and roofs with material health,
// build-up time, editing (3x3 wall tiles / 2x2 floor tiles), damage and structural collapse.
import * as THREE from 'three';
import { BW, BH, BUILD_COST, MAT_HP, MAT_BUILD_TIME } from './config.js';
import { DynamicInstances } from './batch.js';
import { T_BOX } from './physics.js';

const WT = 0.28;           // wall thickness
const FT = 0.22;           // floor thickness
const CONE_H = 1.6;
export const FULL_WALL = 0x1ff, FULL_FLOOR = 0xf;
export const EDIT_WINDOW = FULL_WALL & ~(1 << 4);
export const EDIT_DOOR = FULL_WALL & ~((1 << 1) | (1 << 4));
export const EDIT_ARCH = FULL_WALL & ~((1 << 0) | (1 << 1) | (1 << 2) | (1 << 4));
const MAT_COL = { wood: 0xc48a50, stone: 0xa3a3aa, metal: 0x8a9aab };
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const STATIC = { alive: true, isBuild: false };

export const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export function dirFromYaw(yaw) {
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  if (Math.abs(fx) > Math.abs(fz)) return fx > 0 ? 0 : 1;
  return fz > 0 ? 2 : 3;
}

class Piece {
  constructor(spec, owner, mat) {
    this.type = spec.type; this.key = spec.key;
    this.ix = spec.ix; this.iy = spec.iy; this.iz = spec.iz;
    this.axis = spec.axis; this.dir = spec.dir;
    this.mat = mat;
    this.maxHp = MAT_HP[mat];
    this.hp = this.maxHp * 0.12;
    this.buildRate = (this.maxHp * 0.88) / MAT_BUILD_TIME[mat];
    this.building = true;
    this.age = 0;
    this.owner = owner;
    this.mask = spec.type === 'wall' ? FULL_WALL : FULL_FLOOR;
    this.colliders = [];
    this.inst = [];
    this.alive = true;
    this.isBuild = true;
    this.bbox = null;
  }
}

export class BuildSystem {
  constructor(game) {
    this.game = game;
    this.phys = game.phys;
    this.pieces = new Map();
    this.list = [];
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    this.boxes = new DynamicInstances(game.scene, new THREE.BoxGeometry(1, 1, 1), mat, 9000);
    const pyr = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1);
    pyr.rotateY(Math.PI / 4); pyr.translate(0, 0.5, 0);
    this.cones = new DynamicInstances(game.scene, pyr, mat, 1500);
    // preview
    const pm = new THREE.MeshBasicMaterial({ color: 0x55aaff, transparent: true, opacity: 0.35, depthWrite: false });
    this.previewMat = pm;
    this.prevBox = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), pm);
    this.prevCone = new THREE.Mesh(pyr, pm);
    this.prevEdges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial({ color: 0xaaddff }));
    for (const m of [this.prevBox, this.prevCone, this.prevEdges]) { m.visible = false; m.renderOrder = 5; game.scene.add(m); }
    // edit tiles overlay
    this.editTiles = [];
    const tm = new THREE.MeshBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0.45, depthWrite: false });
    for (let i = 0; i < 9; i++) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), tm.clone());
      t.visible = false; t.renderOrder = 6;
      game.scene.add(t);
      this.editTiles.push(t);
    }
    this.collapseQueue = [];
    this.buildingActors = new Set();
  }

  reset() {
    for (const p of this.list) this._removeVisual(p), this._removeColliders(p);
    this.pieces.clear();
    this.list = [];
    this.collapseQueue = [];
    this.boxes.flush(); this.cones.flush();
    this.hidePreview();
  }

  isBuilding(actor) { return actor.buildMode === true; }

  // ---------- spec construction ----------
  wallSpec(ix, iy, iz, axis) { return { type: 'wall', ix, iy, iz, axis, key: `w${ix},${iy},${iz}${axis}` }; }
  floorSpec(ix, iy, iz) { return { type: 'floor', ix, iy, iz, key: `f${ix},${iy},${iz}` }; }
  rampSpec(ix, iy, iz, dir) { return { type: 'ramp', ix, iy, iz, dir, key: `r${ix},${iy},${iz}` }; }
  coneSpec(ix, iy, iz) { return { type: 'cone', ix, iy, iz, key: `r${ix},${iy},${iz}c` }; }

  specBox(s) {
    const x0 = s.ix * BW, z0 = s.iz * BW, y0 = s.iy * BH;
    switch (s.type) {
      case 'wall':
        return s.axis === 'x'
          ? { minX: x0, maxX: x0 + BW, minZ: z0 - WT / 2, maxZ: z0 + WT / 2, minY: y0, maxY: y0 + BH }
          : { minX: x0 - WT / 2, maxX: x0 + WT / 2, minZ: z0, maxZ: z0 + BW, minY: y0, maxY: y0 + BH };
      case 'floor': return { minX: x0, maxX: x0 + BW, minZ: z0, maxZ: z0 + BW, minY: y0 - FT, maxY: y0 };
      case 'ramp': return { minX: x0, maxX: x0 + BW, minZ: z0, maxZ: z0 + BW, minY: y0, maxY: y0 + BH };
      default: return { minX: x0, maxX: x0 + BW, minZ: z0, maxZ: z0 + BW, minY: y0, maxY: y0 + CONE_H };
    }
  }

  levelFor(y) { return Math.floor((y + 0.6) / BH); }
  cellOf(v) { return Math.floor(v / BW); }

  // Fortnite-style targeting from the actor's position and view direction.
  computeTarget(actor, type, yaw, pitch) {
    const p = actor.pos;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const dir = dirFromYaw(yaw);
    const cx = this.cellOf(p.x), cz = this.cellOf(p.z);
    let lvl = this.levelFor(p.y);
    if (type === 'wall') {
      if (pitch > 0.6) lvl += 1;
      if (pitch < -0.85) lvl -= 1;
      // edge of the cell in front; if standing very close to the far edge, still that edge
      switch (dir) {
        case 0: return this.wallSpec(cx + 1, lvl, cz, 'z');
        case 1: return this.wallSpec(cx, lvl, cz, 'z');
        case 2: return this.wallSpec(cx, lvl, cz + 1, 'x');
        default: return this.wallSpec(cx, lvl, cz, 'x');
      }
    }
    if (type === 'floor') {
      if (pitch < -0.95) return this.floorSpec(cx, lvl, cz);
      const tx = this.cellOf(p.x + fx * BW * 0.8), tz = this.cellOf(p.z + fz * BW * 0.8);
      if (pitch > 0.45) return this.floorSpec(cx, lvl + 1, cz);
      return this.floorSpec(tx, lvl, tz);
    }
    if (type === 'ramp') {
      const tx = this.cellOf(p.x + fx * BW * 0.75), tz = this.cellOf(p.z + fz * BW * 0.75);
      let h = p.y;
      const onRamp = this._rampUnder(actor);
      if (onRamp && onRamp.dir === dir) {
        // continue the ramp: extrapolate height to the near edge of the target cell
        const d = DIRS[dir];
        const edge = d[0] ? (d[0] > 0 ? tx * BW : (tx + 1) * BW) : (d[1] > 0 ? tz * BW : (tz + 1) * BW);
        const dist = d[0] ? (edge - p.x) * d[0] : (edge - p.z) * d[1];
        h = p.y + Math.max(0, dist) * (BH / BW);
      }
      return this.rampSpec(tx, this.levelFor(h - 0.25), tz, dir);
    }
    // cone
    if (pitch > 0.15) return this.coneSpec(cx, lvl + 1, cz);
    const tx = this.cellOf(p.x + fx * BW * 0.8), tz = this.cellOf(p.z + fz * BW * 0.8);
    return this.coneSpec(tx, lvl, tz);
  }

  _rampUnder(actor) {
    const list = this.phys.query(actor.pos.x - 0.1, actor.pos.z - 0.1, actor.pos.x + 0.1, actor.pos.z + 0.1, this._tmp || (this._tmp = []));
    for (const c of list) {
      if (c.type === 1 && c.obj && c.obj.isBuild && Math.abs(c.surfaceY(actor.pos.x, actor.pos.z) - actor.pos.y) < 0.4) return c.obj;
    }
    return null;
  }

  canPlace(actor, spec) {
    if (this.pieces.has(spec.key)) return false;
    if (spec.type === 'ramp' && this.pieces.has(spec.key + 'c')) return false;
    if (spec.type === 'cone' && this.pieces.has(spec.key.slice(0, -1))) return false;
    if (actor.mats[actor.buildMat] < BUILD_COST && !this.game.infiniteMats(actor)) return false;
    const b = this.specBox(spec);
    const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
    if (Math.hypot(cx - actor.pos.x, cz - actor.pos.z) > 9) return false;
    if (Math.abs((b.minY + b.maxY) / 2 - actor.pos.y) > 9) return false;
    // fully buried in terrain?
    const T = this.game.terrain;
    const th = Math.max(T.heightAt(b.minX + 0.3, b.minZ + 0.3), T.heightAt(b.maxX - 0.3, b.maxZ - 0.3), T.heightAt(cx, cz));
    if (b.maxY < th - 0.2) return false;
    if (b.maxY < -1) return false;
    return true;
  }

  // Place a piece for an actor. Returns the piece or null.
  place(actor, spec) {
    if (!this.canPlace(actor, spec)) return null;
    if (!this.game.infiniteMats(actor)) actor.mats[actor.buildMat] -= BUILD_COST;
    const p = new Piece(spec, actor, actor.buildMat);
    p.bbox = this.specBox(spec);
    this.pieces.set(spec.key, p);
    this.list.push(p);
    this._addColliders(p);
    this._addVisual(p);
    actor.structuresBuilt++;
    this.game.audio.playAt('build', { x: (p.bbox.minX + p.bbox.maxX) / 2, y: p.bbox.minY + 1, z: (p.bbox.minZ + p.bbox.maxZ) / 2 }, 0.55);
    this.game.soundEvent(actor, actor.pos, 40, 'build');
    this.game.onBuild(actor, p);
    return p;
  }

  _addColliders(p) {
    const b = p.bbox, ph = this.phys;
    if (p.type === 'wall') {
      for (const r of this._wallRects(p)) p.colliders.push(ph.box(r.minX, r.minY, r.minZ, r.maxX, r.maxY, r.maxZ, p));
    } else if (p.type === 'floor') {
      for (const r of this._floorRects(p)) p.colliders.push(ph.box(r.minX, r.minY, r.minZ, r.maxX, r.maxY, r.maxZ, p));
    } else if (p.type === 'ramp') {
      p.colliders.push(ph.ramp(b.minX, b.minY, b.minZ, b.maxX, b.maxY, b.maxZ, p.dir, p));
    } else {
      p.colliders.push(ph.cone(b.minX, b.minY, b.minZ, b.maxX, b.maxY, b.maxZ, p));
    }
  }
  _removeColliders(p) { for (const c of p.colliders) this.phys.remove(c); p.colliders = []; }

  _wallRects(p) {
    const b = p.bbox, out = [];
    const alongX = p.axis === 'x';
    const a0 = alongX ? b.minX : b.minZ;
    const tw = BW / 3, th = BH / 3;
    for (let r = 0; r < 3; r++) {
      let c = 0;
      while (c < 3) {
        if (!(p.mask & (1 << (r * 3 + c)))) { c++; continue; }
        let e = c;
        while (e + 1 < 3 && (p.mask & (1 << (r * 3 + e + 1)))) e++;
        const s0 = a0 + c * tw, s1 = a0 + (e + 1) * tw;
        const y0 = b.minY + r * th, y1 = y0 + th;
        out.push(alongX ? { minX: s0, maxX: s1, minZ: b.minZ, maxZ: b.maxZ, minY: y0, maxY: y1 } : { minX: b.minX, maxX: b.maxX, minZ: s0, maxZ: s1, minY: y0, maxY: y1 });
        c = e + 1;
      }
    }
    // merge full-width rows vertically for fewer colliders
    if (p.mask === FULL_WALL) return [{ ...b }];
    return out;
  }
  _floorRects(p) {
    if (p.mask === FULL_FLOOR) return [{ ...p.bbox }];
    const b = p.bbox, out = [], h = BW / 2;
    for (let i = 0; i < 4; i++) {
      if (!(p.mask & (1 << i))) continue;
      const qx = i & 1, qz = i >> 1;
      out.push({ minX: b.minX + qx * h, maxX: b.minX + (qx + 1) * h, minZ: b.minZ + qz * h, maxZ: b.minZ + (qz + 1) * h, minY: b.minY, maxY: b.maxY });
    }
    return out;
  }

  _color(p) {
    _c.set(MAT_COL[p.mat]);
    if (p.building) _c.lerp(new THREE.Color(0x9fd3ff), 0.45 * (1 - p.hp / p.maxHp));
    const dmg = 1 - p.hp / p.maxHp;
    if (!p.building && dmg > 0.3) _c.multiplyScalar(1 - (dmg - 0.3) * 0.5);
    return _c;
  }

  _addVisual(p) {
    const grow = Math.min(1, 0.2 + p.age * 5);
    const col = this._color(p);
    const b = p.bbox;
    if (p.type === 'wall' || p.type === 'floor') {
      const rects = p.type === 'wall' ? this._wallRects(p) : this._floorRects(p);
      for (const r of rects) {
        const sy = (r.maxY - r.minY) * (p.type === 'wall' ? grow : 1);
        const ry0 = p.type === 'wall' ? b.minY + (r.minY - b.minY) * grow : r.minY;
        _m.makeScale(r.maxX - r.minX - 0.02, sy, r.maxZ - r.minZ - 0.02).setPosition((r.minX + r.maxX) / 2, ry0 + sy / 2, (r.minZ + r.maxZ) / 2);
        p.inst.push({ pool: this.boxes, i: this.boxes.alloc(_m, col) });
      }
    } else if (p.type === 'ramp') {
      const d = p.dir, len = Math.hypot(BW, BH) * grow, ang = Math.atan2(BH, BW);
      const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2, cy = b.minY + (BH / 2) * grow - 0.12;
      if (d < 2) _e.set(0, 0, d === 0 ? ang : -ang, 'YXZ'); else _e.set(d === 2 ? -ang : ang, 0, 0, 'YXZ');
      _q.setFromEuler(_e);
      _m.compose(_p.set(cx, cy, cz), _q, d < 2 ? _s.set(len, 0.22, BW - 0.04) : _s.set(BW - 0.04, 0.22, len));
      p.inst.push({ pool: this.boxes, i: this.boxes.alloc(_m, col) });
    } else {
      _m.makeScale(BW, CONE_H * grow, BW).setPosition((b.minX + b.maxX) / 2, b.minY, (b.minZ + b.maxZ) / 2);
      p.inst.push({ pool: this.cones, i: this.cones.alloc(_m, col) });
    }
  }
  _removeVisual(p) { for (const it of p.inst) it.pool.release(it.i); p.inst = []; }
  _refreshVisual(p) { this._removeVisual(p); this._addVisual(p); }

  // ---------- editing ----------
  setEdit(actor, p, mask) {
    if (!p || !p.alive || p.owner !== actor) return false;
    if (p.type !== 'wall' && p.type !== 'floor') return false;
    const full = p.type === 'wall' ? FULL_WALL : FULL_FLOOR;
    mask &= full;
    if (mask === 0) mask = full;
    if (mask === p.mask) return true;
    p.mask = mask;
    this._removeColliders(p);
    this._addColliders(p);
    this._refreshVisual(p);
    this.game.audio.playAt('edit', { x: p.bbox.minX, y: p.bbox.minY + 1, z: p.bbox.minZ }, 0.5);
    return true;
  }
  pieceFromCollider(c) { return c && c.obj && c.obj.isBuild ? c.obj : null; }

  // tile centres for the edit overlay
  tileBoxes(p) {
    const b = p.bbox, out = [];
    if (p.type === 'wall') {
      const alongX = p.axis === 'x', tw = BW / 3, th = BH / 3;
      for (let i = 0; i < 9; i++) {
        const r = Math.floor(i / 3), c = i % 3;
        const s = (alongX ? b.minX : b.minZ) + (c + 0.5) * tw;
        const y = b.minY + (r + 0.5) * th;
        out.push(alongX ? { x: s, y, z: (b.minZ + b.maxZ) / 2, sx: tw - 0.08, sy: th - 0.08, sz: WT + 0.06 } : { x: (b.minX + b.maxX) / 2, y, z: s, sx: WT + 0.06, sy: th - 0.08, sz: tw - 0.08 });
      }
    } else if (p.type === 'floor') {
      const h = BW / 2;
      for (let i = 0; i < 4; i++) {
        const qx = i & 1, qz = i >> 1;
        out.push({ x: b.minX + (qx + 0.5) * h, y: b.maxY, z: b.minZ + (qz + 0.5) * h, sx: h - 0.08, sy: FT + 0.06, sz: h - 0.08 });
      }
    }
    return out;
  }

  // ---------- damage ----------
  damage(p, amount, attacker) {
    if (!p.alive) return;
    p.hp -= amount;
    if (p.hp <= 0) this.destroy(p, true);
    else p.dirty = true;
  }
  repair(actor, p, dt) {
    if (!p.alive || p.building || p.hp >= p.maxHp) return false;
    const cost = 1;
    if (actor.mats[p.mat] < cost && !this.game.infiniteMats(actor)) return false;
    const amt = p.maxHp * 0.35 * dt;
    p.hp = Math.min(p.maxHp, p.hp + amt);
    p.repairAcc = (p.repairAcc || 0) + amt;
    if (p.repairAcc > p.maxHp * 0.1) { p.repairAcc = 0; if (!this.game.infiniteMats(actor)) actor.mats[p.mat] -= cost; }
    p.dirty = true;
    return true;
  }

  destroy(p, cascade) {
    if (!p.alive) return;
    p.alive = false;
    this._removeColliders(p);
    this._removeVisual(p);
    this.pieces.delete(p.key);
    const i = this.list.indexOf(p);
    if (i >= 0) { this.list[i] = this.list[this.list.length - 1]; this.list.pop(); }
    const b = p.bbox;
    this.game.effects.debris((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, (b.minZ + b.maxZ) / 2, MAT_COL[p.mat], 14);
    this.game.audio.playAt('break_' + p.mat, { x: b.minX, y: b.minY, z: b.minZ }, 0.6);
    if (cascade) this._checkSupport(p);
  }

  _neighbors(p) {
    const b = p.bbox, e = 0.15;
    const list = this.phys.query(b.minX - e, b.minZ - e, b.maxX + e, b.maxZ + e, []);
    const out = new Set();
    for (const c of list) {
      const q = c.obj || STATIC;
      if (q === p) continue;
      if (c.maxY < b.minY - e || c.minY > b.maxY + e) continue;
      out.add(q);
    }
    return out;
  }
  _grounded(p) {
    const b = p.bbox;
    const T = this.game.terrain;
    const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
    const th = Math.max(T.heightAt(cx, cz), T.heightAt(b.minX + 0.2, b.minZ + 0.2), T.heightAt(b.maxX - 0.2, b.maxZ - 0.2), T.heightAt(b.minX + 0.2, b.maxZ - 0.2), T.heightAt(b.maxX - 0.2, b.minZ + 0.2));
    if (b.minY <= th + 0.3) return true;
    if (b.minY < 0.3) return true;  // on water / sea floor
    return false;
  }
  _checkSupport(removed) {
    const start = this._neighbors(removed);
    const visitedGlobal = new Set();
    for (const s of start) {
      if (!s.isBuild || !s.alive || visitedGlobal.has(s)) continue;
      // BFS component
      const comp = [];
      const queue = [s];
      const seen = new Set([s]);
      let supported = false;
      while (queue.length && comp.length < 400) {
        const q = queue.shift();
        comp.push(q);
        if (this._grounded(q)) { supported = true; break; }
        for (const n of this._neighbors(q)) {
          if (!n.alive) continue;
          if (!n.isBuild) { supported = true; break; }   // resting on a map structure
          if (!seen.has(n)) { seen.add(n); queue.push(n); }
        }
        if (supported) break;
      }
      for (const q of seen) visitedGlobal.add(q);
      if (!supported) {
        comp.sort((a, b) => b.bbox.minY - a.bbox.minY);
        for (const q of seen) if (q.alive && !this.collapseQueue.includes(q)) this.collapseQueue.push(q);
      }
    }
  }

  update(dt) {
    // build-up
    for (let i = 0; i < this.list.length; i++) {
      const p = this.list[i];
      if (p.building) {
        p.age += dt;
        p.hp = Math.min(p.maxHp, p.hp + p.buildRate * dt);
        if (p.hp >= p.maxHp) p.building = false;
        if (p.age < 0.3 || Math.random() < dt * 4) p.dirty = true;
        if (!p.building) p.dirty = true;
      }
      if (p.dirty) {
        p.dirty = false;
        if (p.age < 0.35) this._refreshVisual(p);
        else { const col = this._color(p); for (const it of p.inst) it.pool.color(it.i, col); }
      }
    }
    // collapse cascade
    this._collapseT = (this._collapseT || 0) - dt;
    if (this.collapseQueue.length && this._collapseT <= 0) {
      this._collapseT = 0.04;
      for (let k = 0; k < 3 && this.collapseQueue.length; k++) this.destroy(this.collapseQueue.shift(), false);
    }
    this.boxes.flush();
    this.cones.flush();
  }

  // ---------- preview ----------
  showPreview(spec, valid) {
    this.hidePreview();
    if (!spec) return;
    this.previewMat.color.set(valid ? 0x55aaff : 0xff5555);
    const b = this.specBox(spec);
    if (spec.type === 'cone') {
      this.prevCone.visible = true;
      this.prevCone.scale.set(BW, CONE_H, BW);
      this.prevCone.position.set((b.minX + b.maxX) / 2, b.minY, (b.minZ + b.maxZ) / 2);
      return;
    }
    const m = this.prevBox;
    m.visible = true;
    m.rotation.set(0, 0, 0);
    if (spec.type === 'ramp') {
      const d = spec.dir, len = Math.hypot(BW, BH), ang = Math.atan2(BH, BW);
      m.position.set((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, (b.minZ + b.maxZ) / 2);
      if (d < 2) { m.scale.set(len, 0.2, BW); m.rotation.set(0, 0, d === 0 ? ang : -ang); }
      else { m.scale.set(BW, 0.2, len); m.rotation.set(d === 2 ? -ang : ang, 0, 0); }
    } else {
      m.scale.set(b.maxX - b.minX, b.maxY - b.minY, b.maxZ - b.minZ);
      m.position.set((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, (b.minZ + b.maxZ) / 2);
    }
    this.prevEdges.visible = true;
    this.prevEdges.position.copy(m.position);
    this.prevEdges.rotation.copy(m.rotation);
    this.prevEdges.scale.copy(m.scale);
  }
  hidePreview() {
    this.prevBox.visible = false; this.prevCone.visible = false; this.prevEdges.visible = false;
  }
  showEditTiles(p, selected) {
    const tiles = p ? this.tileBoxes(p) : [];
    for (let i = 0; i < 9; i++) {
      const t = this.editTiles[i];
      if (i >= tiles.length) { t.visible = false; continue; }
      const b = tiles[i];
      t.visible = true;
      t.position.set(b.x, b.y, b.z);
      t.scale.set(b.sx, b.sy, b.sz);
      t.material.color.set(selected & (1 << i) ? 0x66ccff : 0x223344);
      t.material.opacity = selected & (1 << i) ? 0.5 : 0.25;
    }
  }

  // helpers for the AI
  findOwnedNear(actor, x, z, r) {
    const out = [];
    for (const p of this.list) {
      if (p.owner !== actor) continue;
      const b = p.bbox;
      if (Math.hypot((b.minX + b.maxX) / 2 - x, (b.minZ + b.maxZ) / 2 - z) < r) out.push(p);
    }
    return out;
  }
}

export { BW, BH, T_BOX };
