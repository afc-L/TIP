// Procedural environment generation for every map, plus static obstacle collision.
import * as THREE from 'three';
import type { MapDef } from '../../data/maps';
import { seededRandom } from '../util';
import { box, cone, cyl, dodeca, merge, octa, sphere } from '../models/shapes';
import { occludable, swaying, timeUniform } from './occlusion';

export interface Obstacle { x: number; z: number; r: number }

const CELL = 4;
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

function hash(x: number, z: number, seed: number) {
  const s = Math.sin(x * 127.1 + z * 311.7 + seed * 74.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x: number, z: number, seed: number) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi, seed), b = hash(xi + 1, zi, seed), c = hash(xi, zi + 1, seed), d = hash(xi + 1, zi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x: number, z: number, seed: number) {
  return vnoise(x, z, seed) * 0.6 + vnoise(x * 2.1, z * 2.1, seed + 1) * 0.3 + vnoise(x * 4.3, z * 4.3, seed + 2) * 0.1;
}

export interface WorldQuality { grassMult: number; propMult: number; shadows: boolean }

export class World {
  group = new THREE.Group();
  obstacles: Obstacle[] = [];
  radius: number;
  def: MapDef;
  private grid = new Map<number, Obstacle[]>();
  private animated: ((t: number, dt: number) => void)[] = [];
  private disposables: { dispose(): void }[] = [];
  private rng: () => number;

  constructor(def: MapDef, q: WorldQuality) {
    this.def = def;
    this.radius = def.radius;
    this.rng = seededRandom(def.seed);
    this.buildGround();
    if (def.id === 'arena') this.buildArenaWalls(); else this.buildBoundaryRocks();
    this.buildMountains();
    this.buildRuins(def.props.ruins);
    this.buildPillars(Math.round(def.props.pillars));
    this.buildMesas(def.props.mesas);
    this.buildTrees(Math.round(def.props.trees * q.propMult), q.shadows);
    this.buildRocks(Math.round(def.props.rocks * q.propMult), q.shadows);
    this.buildCrystals(Math.round(def.props.crystals * q.propMult));
    this.buildGrass(Math.round(7000 * q.grassMult * def.props.grass));
    if (def.props.flowers) this.buildFlowers(Math.round(500 * q.propMult));
    this.buildLavaPools(def.props.lavaPools);
    this.buildSpikes(Math.round(def.props.spikes * q.propMult));
    this.buildMotes();
    this.buildCloudShadows();
    for (const o of this.obstacles) this.insert(o);
  }

  // ---------- collision ----------
  private key(cx: number, cz: number) { return (cx + 500) * 1000 + (cz + 500); }

  private insert(o: Obstacle) {
    const r = o.r;
    for (let cx = Math.floor((o.x - r) / CELL); cx <= Math.floor((o.x + r) / CELL); cx++)
      for (let cz = Math.floor((o.z - r) / CELL); cz <= Math.floor((o.z + r) / CELL); cz++) {
        const k = this.key(cx, cz);
        let list = this.grid.get(k);
        if (!list) { list = []; this.grid.set(k, list); }
        list.push(o);
      }
  }

  /** Pushes a circle out of solid obstacles and back inside the arena boundary. */
  resolve(p: { x: number; z: number }, r: number, boundary = true): boolean {
    let hit = false;
    const cx0 = Math.floor((p.x - r) / CELL), cx1 = Math.floor((p.x + r) / CELL);
    const cz0 = Math.floor((p.z - r) / CELL), cz1 = Math.floor((p.z + r) / CELL);
    for (let cx = cx0; cx <= cx1; cx++)
      for (let cz = cz0; cz <= cz1; cz++) {
        const list = this.grid.get(this.key(cx, cz));
        if (!list) continue;
        for (const o of list) {
          const dx = p.x - o.x, dz = p.z - o.z;
          const min = o.r + r;
          const d2 = dx * dx + dz * dz;
          if (d2 < min * min) {
            const d = Math.sqrt(d2) || 0.001;
            p.x = o.x + (dx / d) * min;
            p.z = o.z + (dz / d) * min;
            hit = true;
          }
        }
      }
    if (boundary) {
      const lim = this.radius - r;
      const d2 = p.x * p.x + p.z * p.z;
      if (d2 > lim * lim) {
        const d = Math.sqrt(d2);
        p.x *= lim / d; p.z *= lim / d;
        hit = true;
      }
    }
    return hit;
  }

  blocked(x: number, z: number, r: number): boolean {
    if (x * x + z * z > (this.radius - r) ** 2) return true;
    const list = this.grid.get(this.key(Math.floor(x / CELL), Math.floor(z / CELL)));
    if (list) for (const o of list) if ((x - o.x) ** 2 + (z - o.z) ** 2 < (o.r + r) ** 2) return true;
    // neighbours (obstacles may overlap cell edges; they're inserted into every covered cell)
    return false;
  }

  /** Random walkable point (used for chests, shrines, barrels). */
  openPoint(minR: number, maxR: number, clearance = 1.5, rnd: () => number = Math.random): { x: number; z: number } {
    for (let i = 0; i < 60; i++) {
      const a = rnd() * Math.PI * 2;
      const r = minR + (maxR - minR) * Math.sqrt(rnd());
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      let ok = x * x + z * z < (this.radius - clearance) ** 2;
      if (ok) for (const o of this.obstacles) if ((x - o.x) ** 2 + (z - o.z) ** 2 < (o.r + clearance) ** 2) { ok = false; break; }
      if (ok) return { x, z };
    }
    return { x: 0, z: minR };
  }

  private canPlace(x: number, z: number, r: number, gap: number) {
    if (x * x + z * z < 10 * 10) return false; // keep the spawn clearing open
    for (const o of this.obstacles) if ((x - o.x) ** 2 + (z - o.z) ** 2 < (o.r + r + gap) ** 2) return false;
    return true;
  }

  private placeSolid(r: number, gap: number, minR: number, maxR: number): { x: number; z: number } | null {
    for (let i = 0; i < 30; i++) {
      const a = this.rng() * Math.PI * 2;
      const d = minR + (maxR - minR) * Math.sqrt(this.rng());
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (this.canPlace(x, z, r, gap)) return { x, z };
    }
    return null;
  }

  // ---------- builders ----------
  private add(obj: THREE.Object3D) {
    this.group.add(obj);
    obj.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) this.disposables.push(mesh.geometry);
      if (mesh.material) this.disposables.push(...(Array.isArray(mesh.material) ? mesh.material : [mesh.material]));
    });
  }

  private instanced(geo: THREE.BufferGeometry, material: THREE.Material, n: number, fn: (i: number, m: THREE.Matrix4, c: THREE.Color) => void, shadows = false) {
    const mesh = new THREE.InstancedMesh(geo, material, Math.max(1, n));
    mesh.setColorAt(0, _c.set(1, 1, 1));
    for (let i = 0; i < n; i++) {
      _c.set(1, 1, 1);
      fn(i, _m, _c);
      mesh.setMatrixAt(i, _m);
      mesh.setColorAt(i, _c);
    }
    mesh.count = n;
    mesh.castShadow = shadows;
    mesh.receiveShadow = false;
    mesh.computeBoundingSphere();
    this.add(mesh);
    return mesh;
  }

  private buildGround() {
    const { palette, radius, seed, id } = this.def;
    const size = (radius + 70) * 2;
    const geo = new THREE.PlaneGeometry(size, size, 140, 140);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.getAttribute('position');
    const colors = new Float32Array(pos.count * 3);
    const g1 = new THREE.Color(palette.ground), g2 = new THREE.Color(palette.groundAlt), pc = new THREE.Color(palette.path);
    const rock = new THREE.Color(palette.rock);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const d = Math.hypot(x, z);
      const n = fbm(x * 0.06, z * 0.06, seed);
      _c.copy(g1).lerp(g2, n);
      if (id === 'arena') {
        const ring = Math.floor(d / 5) % 2 === 0;
        const seg = Math.floor(((Math.atan2(z, x) + Math.PI) / (Math.PI * 2)) * (8 + Math.floor(d / 5) * 4)) % 2 === 0;
        _c.copy(ring !== seg ? g1 : g2).multiplyScalar(0.92 + n * 0.16);
        if (d < 6) _c.lerp(new THREE.Color(palette.accent), d < 4.5 && d > 3.5 ? 0.6 : 0.15);
      } else {
        // winding paths that cross near the middle
        const p1 = Math.abs(z - Math.sin(x * 0.08 + seed) * 7);
        const p2 = Math.abs(x - Math.sin(z * 0.07 + seed * 2) * 9);
        const pathD = Math.min(p1, p2) + (n - 0.5) * 2;
        if (pathD < 2.2 && d < radius) _c.lerp(pc, Math.min(1, (2.2 - pathD) / 1.2) * 0.85);
      }
      let h = 0;
      if (d > radius + 1) {
        const t = Math.min(1, (d - radius - 1) / 14);
        h = t * t * (3 + fbm(x * 0.05, z * 0.05, seed + 7) * 12);
        if (id === 'arena') h = 0;
        _c.lerp(rock, t * 0.5);
      }
      pos.setY(i, h);
      colors[i * 3] = _c.r; colors[i * 3 + 1] = _c.g; colors[i * 3 + 2] = _c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const ground = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
    ground.receiveShadow = true;
    ground.name = 'ground';
    this.add(ground);
  }

  private buildBoundaryRocks() {
    const R = this.radius;
    const n = Math.round(R * 1.6);
    const rockMat = occludable(new THREE.MeshLambertMaterial({ flatShading: true }));
    const base = new THREE.Color(this.def.palette.rock);
    this.instanced(dodeca(1), rockMat, n, (i, m, c) => {
      const a = (i / n) * Math.PI * 2 + this.rng() * 0.05;
      const d = R + 1.2 + this.rng() * 2.5;
      const s = 1.6 + this.rng() * 2;
      _e.set(this.rng() * 3, this.rng() * 3, this.rng() * 3);
      m.compose(_p.set(Math.cos(a) * d, s * 0.35, Math.sin(a) * d), _q.setFromEuler(_e), _s.set(s, s * (0.8 + this.rng() * 0.6), s));
      c.copy(base).multiplyScalar(0.8 + this.rng() * 0.4);
    });
  }

  private buildArenaWalls() {
    const R = this.radius;
    const pal = this.def.palette;
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.6, R + 0.6, 3.2, 64, 1, true), occludable(new THREE.MeshLambertMaterial({ color: pal.ruin, side: THREE.DoubleSide, flatShading: true })));
    wall.position.y = 1.6;
    this.add(wall);
    const trim = new THREE.Mesh(new THREE.TorusGeometry(R + 0.6, 0.25, 4, 64), new THREE.MeshLambertMaterial({ color: pal.accent }));
    trim.rotation.x = Math.PI / 2;
    trim.position.y = 3.2;
    this.add(trim);
    // stands
    for (let k = 0; k < 4; k++) {
      const r0 = R + 2 + k * 3;
      const st = new THREE.Mesh(new THREE.CylinderGeometry(r0 + 3, r0 + 3, 3.4 + k * 2.2, 48, 1, true), new THREE.MeshLambertMaterial({ color: k % 2 ? '#7d6e5d' : '#8f7f6c', side: THREE.BackSide }));
      st.position.y = (3.4 + k * 2.2) / 2;
      this.add(st);
      const top = new THREE.Mesh(new THREE.RingGeometry(r0, r0 + 3, 48), new THREE.MeshLambertMaterial({ color: k % 2 ? '#9c8c7a' : '#b5a48e', side: THREE.DoubleSide }));
      top.rotation.x = -Math.PI / 2;
      top.position.y = 3.4 + k * 2.2;
      this.add(top);
    }
    // cheering crowd
    const crowdN = 900;
    const crowdColors = ['#e63946', '#f1faee', '#a8dadc', '#457b9d', '#ffb703', '#8338ec', '#fb5607'];
    const crowd = this.instanced(box(0.6, 1, 0.6), new THREE.MeshLambertMaterial(), crowdN, (_i, m, c) => {
      const k = Math.floor(this.rng() * 4);
      const a = this.rng() * Math.PI * 2;
      const d = R + 3.5 + k * 3 + this.rng() * 1.5;
      m.compose(_p.set(Math.cos(a) * d, 3.4 + k * 2.2 + 0.5, Math.sin(a) * d), _q.identity(), _s.set(1, 1, 1));
      c.set(crowdColors[Math.floor(this.rng() * crowdColors.length)]);
    });
    const basePos = new Float32Array(crowdN * 3);
    for (let i = 0; i < crowdN; i++) { crowd.getMatrixAt(i, _m); _p.setFromMatrixPosition(_m); basePos.set([_p.x, _p.y, _p.z], i * 3); }
    let acc = 0;
    this.animated.push((t, dt) => {
      acc += dt;
      if (acc < 0.1) return;
      acc = 0;
      for (let i = 0; i < crowdN; i++) {
        const jump = Math.max(0, Math.sin(t * 6 + i * 1.7)) * 0.35;
        _m.makeTranslation(basePos[i * 3], basePos[i * 3 + 1] + jump, basePos[i * 3 + 2]);
        crowd.setMatrixAt(i, _m);
      }
      crowd.instanceMatrix.needsUpdate = true;
    });
    // braziers
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const d = R - 2;
      const g = new THREE.Group();
      g.add(new THREE.Mesh(merge([cyl(0.25, 0.35, 1.4, { p: [0, 0.7, 0] }, 6), cyl(0.7, 0.4, 0.4, { p: [0, 1.5, 0] }, 8)]), new THREE.MeshLambertMaterial({ color: '#495057', flatShading: true })));
      const fire = new THREE.Mesh(cone(0.5, 1, { p: [0, 2.1, 0] }, 6), new THREE.MeshBasicMaterial({ color: '#ff9f1c' }));
      g.add(fire);
      g.position.set(Math.cos(a) * d, 0, Math.sin(a) * d);
      this.add(g);
      this.obstacles.push({ x: g.position.x, z: g.position.z, r: 0.7 });
      this.animated.push((t) => { fire.scale.set(1, 0.8 + Math.sin(t * 13 + i) * 0.25, 1); fire.rotation.y = t * 3; });
    }
  }

  private buildMountains() {
    const R = this.radius;
    const pal = this.def.palette;
    const n = 26;
    const colA = new THREE.Color(pal.rock).lerp(new THREE.Color(pal.fog), 0.45);
    const geo = this.def.id === 'canyon' ? cyl(0.7, 1, 1, { p: [0, 0.5, 0] }, 7) : cone(1, 1, { p: [0, 0.5, 0] }, 6);
    this.instanced(geo, new THREE.MeshLambertMaterial({ flatShading: true }), n, (i, m, c) => {
      const a = (i / n) * Math.PI * 2 + this.rng() * 0.2;
      const d = R + 38 + this.rng() * 22;
      const w = 14 + this.rng() * 14;
      const h = (this.def.id === 'arena' ? 6 : 16) + this.rng() * 18;
      m.compose(_p.set(Math.cos(a) * d, -1, Math.sin(a) * d), _q.setFromEuler(_e.set(0, this.rng() * 3, 0)), _s.set(w, h, w));
      c.copy(colA).multiplyScalar(0.85 + this.rng() * 0.3);
    });
    if (this.def.id !== 'arena') {
      const snow = new THREE.Color(this.def.id === 'canyon' ? '#f4d6b0' : '#f8f9fa');
      // snowy/sandy caps reuse the same placement seed for a cohesive skyline
      const rng2 = seededRandom(this.def.seed + 3);
      this.instanced(cone(1, 1, { p: [0, 0.5, 0] }, 6), new THREE.MeshLambertMaterial({ flatShading: true }), this.def.id === 'canyon' ? 0 : n, (i, m, c) => {
        const a = (i / n) * Math.PI * 2 + rng2() * 0.2;
        const d = R + 38 + rng2() * 22;
        m.compose(_p.set(Math.cos(a) * d, 8 + rng2() * 6, Math.sin(a) * d), _q.identity(), _s.set(5, 5, 5));
        c.copy(snow);
      });
    }
  }

  private buildTrees(n: number, shadows: boolean) {
    if (n <= 0) return;
    const pal = this.def.palette;
    const R = this.radius;
    const trunkGeo = cyl(0.22, 0.32, 1.6, { p: [0, 0.8, 0] }, 6);
    const pineGeo = merge([cone(1.3, 1.8, { p: [0, 2.1, 0] }, 7), cone(1.05, 1.6, { p: [0, 2.9, 0] }, 7), cone(0.75, 1.4, { p: [0, 3.6, 0] }, 7)]);
    const roundGeo = merge([sphere(1.2, { p: [0, 2.5, 0] }, 0), sphere(0.9, { p: [0.7, 2.1, 0.3] }, 0), sphere(0.85, { p: [-0.6, 2.9, -0.2] }, 0)]);
    const trunkMat = occludable(new THREE.MeshLambertMaterial({ flatShading: true }));
    const leafMat = occludable(new THREE.MeshLambertMaterial({ flatShading: true }));
    const spots: { x: number; z: number; s: number; pine: boolean }[] = [];
    for (let i = 0; i < n; i++) {
      const s = 0.8 + this.rng() * 0.8;
      const inside = this.rng() < 0.55;
      const p = inside ? this.placeSolid(0.45 * s, 3.2, 12, R - 3) : this.placeSolid(0.45 * s, 0.5, R + 1, R + 14);
      if (!p) continue;
      spots.push({ ...p, s, pine: this.rng() < 0.55 });
      this.obstacles.push({ x: p.x, z: p.z, r: 0.45 * s });
    }
    const trunkCol = new THREE.Color(pal.trunk);
    this.instanced(trunkGeo, trunkMat, spots.length, (i, m, c) => {
      const t = spots[i];
      m.compose(_p.set(t.x, 0, t.z), _q.setFromEuler(_e.set(0, i, 0)), _s.set(t.s, t.s, t.s));
      c.copy(trunkCol);
    }, shadows);
    const pines = spots.filter((t) => t.pine), rounds = spots.filter((t) => !t.pine);
    const leafCols = pal.foliage.map((f) => new THREE.Color(f));
    const leafSet = (arr: typeof spots, geo: THREE.BufferGeometry) =>
      this.instanced(geo, leafMat, arr.length, (i, m, c) => {
        const t = arr[i];
        m.compose(_p.set(t.x, 0, t.z), _q.setFromEuler(_e.set(0, i * 1.3, 0)), _s.set(t.s, t.s * (0.9 + (i % 5) * 0.06), t.s));
        c.copy(leafCols[i % leafCols.length]);
      }, shadows);
    leafSet(pines, pineGeo);
    leafSet(rounds, roundGeo);
  }

  private buildRocks(n: number, shadows: boolean) {
    if (n <= 0) return;
    const R = this.radius;
    const base = new THREE.Color(this.def.palette.rock);
    const items: { x: number; z: number; s: number }[] = [];
    for (let i = 0; i < n; i++) {
      const s = this.rng() < 0.3 ? 1.2 + this.rng() * 1.2 : 0.3 + this.rng() * 0.6;
      const solid = s > 0.9;
      const p = this.placeSolid(solid ? s * 0.85 : 0.1, solid ? 3 : 0.2, 11, R - 2);
      if (!p) continue;
      items.push({ ...p, s });
      if (solid) this.obstacles.push({ x: p.x, z: p.z, r: s * 0.85 });
    }
    this.instanced(dodeca(1), occludable(new THREE.MeshLambertMaterial({ flatShading: true })), items.length, (i, m, c) => {
      const r = items[i];
      _e.set(this.rng() * 3, this.rng() * 3, this.rng() * 3);
      m.compose(_p.set(r.x, r.s * 0.3, r.z), _q.setFromEuler(_e), _s.set(r.s, r.s * 0.75, r.s));
      c.copy(base).multiplyScalar(0.8 + this.rng() * 0.35);
    }, shadows);
  }

  private buildRuins(n: number) {
    const R = this.radius;
    const stone = occludable(new THREE.MeshLambertMaterial({ color: this.def.palette.ruin, flatShading: true }));
    const moss = new THREE.MeshLambertMaterial({ color: this.def.id === 'forest' ? '#588157' : this.def.palette.rock, flatShading: true });
    for (let i = 0; i < n; i++) {
      const p = this.placeSolid(3.5, 4, 16, R - 6);
      if (!p) continue;
      const g = new THREE.Group();
      g.position.set(p.x, 0, p.z);
      const rot = this.rng() * Math.PI;
      g.rotation.y = rot;
      const parts: THREE.BufferGeometry[] = [];
      const mossParts: THREE.BufferGeometry[] = [];
      const kind = i % 3;
      const local: { x: number; z: number; r: number }[] = [];
      if (kind === 0) {
        // broken wall
        const segs = 3 + Math.floor(this.rng() * 3);
        for (let k = 0; k < segs; k++) {
          const h = 0.8 + this.rng() * 2.2;
          parts.push(box(1.4, h, 0.8, { p: [(k - segs / 2) * 1.45, h / 2, 0] }));
          mossParts.push(box(1.45, 0.15, 0.85, { p: [(k - segs / 2) * 1.45, h, 0] }));
          local.push({ x: (k - segs / 2) * 1.45, z: 0, r: 0.75 });
        }
      } else if (kind === 1) {
        // arch
        parts.push(box(0.8, 3.4, 0.8, { p: [-1.6, 1.7, 0] }), box(0.8, 3.4, 0.8, { p: [1.6, 1.7, 0] }), box(4.2, 0.7, 0.9, { p: [0, 3.6, 0] }));
        mossParts.push(box(4.3, 0.15, 1, { p: [0, 4.0, 0] }));
        local.push({ x: -1.6, z: 0, r: 0.6 }, { x: 1.6, z: 0, r: 0.6 });
      } else {
        // circle of standing stones
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2;
          const h = 1 + this.rng() * 2;
          parts.push(box(0.7, h, 0.5, { p: [Math.cos(a) * 3, h / 2, Math.sin(a) * 3], r: [0, -a, (this.rng() - 0.5) * 0.2] }));
          local.push({ x: Math.cos(a) * 3, z: Math.sin(a) * 3, r: 0.5 });
        }
        parts.push(cyl(1, 1.2, 0.4, { p: [0, 0.2, 0] }, 8));
      }
      const mesh = new THREE.Mesh(merge(parts), stone);
      mesh.castShadow = true;
      g.add(mesh);
      if (mossParts.length) g.add(new THREE.Mesh(merge(mossParts), moss));
      this.add(g);
      const c = Math.cos(-rot), s = Math.sin(-rot);
      for (const l of local) this.obstacles.push({ x: p.x + l.x * c - l.z * s, z: p.z + l.x * s + l.z * c, r: l.r });
      // reserve the footprint so trees don't spawn inside
      this.obstacles.push({ x: p.x, z: p.z, r: 0.01 });
    }
  }

  private buildPillars(n: number) {
    if (n <= 0) return;
    const stone = occludable(new THREE.MeshLambertMaterial({ color: this.def.palette.ruin, flatShading: true }));
    const geoFull = merge([cyl(0.6, 0.7, 4.5, { p: [0, 2.25, 0] }, 8), box(1.6, 0.4, 1.6, { p: [0, 4.6, 0] }), box(1.6, 0.4, 1.6, { p: [0, 0.2, 0] })]);
    const geoBroken = merge([cyl(0.6, 0.7, 1.6, { p: [0, 0.8, 0], r: [0.05, 0, 0.08] }, 8), box(1.6, 0.4, 1.6, { p: [0, 0.2, 0] })]);
    const full: THREE.Vector3[] = [], broken: THREE.Vector3[] = [];
    for (let i = 0; i < n; i++) {
      let x: number, z: number;
      if (this.def.id === 'arena') {
        const ringR = i % 2 ? 18 : 30;
        const a = (i / n) * Math.PI * 2 + (i % 2) * 0.2;
        x = Math.cos(a) * ringR; z = Math.sin(a) * ringR;
      } else {
        const p = this.placeSolid(0.8, 4, 14, this.radius - 4);
        if (!p) continue;
        x = p.x; z = p.z;
      }
      (this.rng() < 0.35 ? broken : full).push(new THREE.Vector3(x, 0, z));
      this.obstacles.push({ x, z, r: 0.8 });
    }
    const put = (arr: THREE.Vector3[], geo: THREE.BufferGeometry) =>
      this.instanced(geo, stone, arr.length, (i, m, c) => { m.compose(arr[i], _q.setFromEuler(_e.set(0, i, 0)), _s.set(1, 1, 1)); c.set(1, 1, 1); }, true);
    put(full, geoFull);
    put(broken, geoBroken);
  }

  private buildMesas(n: number) {
    if (n <= 0) return;
    const mats = [new THREE.MeshLambertMaterial({ color: '#b5562c', flatShading: true }), new THREE.MeshLambertMaterial({ color: '#e07a4f', flatShading: true })];
    for (let i = 0; i < n; i++) {
      const r = 2.2 + this.rng() * 3;
      const inside = i < n * 0.4;
      const p = inside ? this.placeSolid(r, 5, 18, this.radius - r - 3) : this.placeSolid(r, 1, this.radius + 3, this.radius + 20);
      if (!p) continue;
      const g = new THREE.Group();
      const layers = 3 + Math.floor(this.rng() * 3);
      let y = 0;
      for (let k = 0; k < layers; k++) {
        const h = 1 + this.rng() * 1.6;
        const rr = r * (1 - k * 0.06);
        const m = new THREE.Mesh(new THREE.CylinderGeometry(rr * 0.95, rr, h, 9), occludable(mats[k % 2].clone()));
        m.position.y = y + h / 2;
        y += h;
        g.add(m);
      }
      g.position.set(p.x, 0, p.z);
      g.rotation.y = this.rng() * 3;
      this.add(g);
      this.obstacles.push({ x: p.x, z: p.z, r: r * 0.98 });
    }
  }

  private buildCrystals(n: number) {
    if (n <= 0) return;
    const cols = this.def.palette.crystals.map((c) => new THREE.Color(c));
    const items: { x: number; z: number; s: number; a: number; tilt: number; cluster: number }[] = [];
    for (let i = 0; i < n; i++) {
      const s = 0.8 + this.rng() * 1.2;
      const p = this.placeSolid(0.9 * s, 3, 12, this.radius + 6);
      if (!p) continue;
      const shards = 3 + Math.floor(this.rng() * 3);
      for (let k = 0; k < shards; k++) items.push({ x: p.x + (this.rng() - 0.5) * s, z: p.z + (this.rng() - 0.5) * s, s: s * (0.5 + this.rng() * 0.7), a: this.rng() * 3, tilt: (this.rng() - 0.5) * 0.8, cluster: i });
      if (Math.hypot(p.x, p.z) < this.radius) this.obstacles.push({ x: p.x, z: p.z, r: 0.9 * s });
    }
    const m = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.88 });
    this.instanced(octa(1, { p: [0, 1, 0], s: [0.45, 1.6, 0.45] }), m, items.length, (i, mm, c) => {
      const it = items[i];
      mm.compose(_p.set(it.x, 0, it.z), _q.setFromEuler(_e.set(it.tilt, it.a, it.tilt * 0.5)), _s.set(it.s, it.s, it.s));
      c.copy(cols[it.cluster % cols.length]);
    });
    this.animated.push((t) => { m.opacity = 0.75 + Math.sin(t * 2) * 0.12; });
  }

  private buildGrass(n: number) {
    if (n <= 0) return;
    const R = this.radius;
    const blades = merge([
      cone(0.07, 0.55, { p: [0, 0.27, 0], r: [0.15, 0, 0.1] }, 3),
      cone(0.06, 0.45, { p: [0.12, 0.22, 0.05], r: [0, 0, -0.3] }, 3),
      cone(0.06, 0.5, { p: [-0.1, 0.25, -0.05], r: [0.2, 0, 0.35] }, 3),
    ]);
    const base = new THREE.Color(this.def.palette.grass);
    const m = swaying(new THREE.MeshLambertMaterial({ flatShading: true }), 0.22);
    this.instanced(blades, m, n, (_i, mm, c) => {
      const a = this.rng() * Math.PI * 2;
      const d = Math.sqrt(this.rng()) * (R + 6);
      const s = 0.7 + this.rng() * 0.9;
      mm.compose(_p.set(Math.cos(a) * d, 0, Math.sin(a) * d), _q.setFromEuler(_e.set(0, this.rng() * 6, 0)), _s.set(s, s * (0.8 + this.rng() * 0.6), s));
      c.copy(base).multiplyScalar(0.75 + this.rng() * 0.45);
    });
  }

  private buildFlowers(n: number) {
    const cols = ['#ff70a6', '#ffd670', '#e9ff70', '#ffffff', '#ff9770', '#a2d2ff'].map((c) => new THREE.Color(c));
    const geo = merge([cyl(0.02, 0.02, 0.35, { p: [0, 0.17, 0] }, 3), sphere(0.11, { p: [0, 0.38, 0] }, 0)]);
    this.instanced(geo, swaying(new THREE.MeshLambertMaterial({ flatShading: true }), 0.15), n, (_i, mm, c) => {
      const a = this.rng() * Math.PI * 2;
      const d = 6 + Math.sqrt(this.rng()) * (this.radius - 6);
      mm.compose(_p.set(Math.cos(a) * d, 0, Math.sin(a) * d), _q.identity(), _s.setScalar(0.8 + this.rng() * 0.6));
      c.copy(cols[Math.floor(this.rng() * cols.length)]);
    });
  }

  /** Lava pools: walkable but burning hazards (Lava Fields). */
  lavaPools: { x: number; z: number; r: number }[] = [];
  blizzard = false;
  setBlizzard(on: boolean) { this.blizzard = on; }

  private buildLavaPools(n: number) {
    if (n <= 0) return;
    const lavaMat = new THREE.MeshBasicMaterial({ color: '#ff5400' });
    const crustMat = new THREE.MeshLambertMaterial({ color: '#1a0f0d', flatShading: true });
    for (let i = 0; i < n; i++) {
      const r = 2.2 + this.rng() * 2.8;
      let p: { x: number; z: number } | null = null;
      for (let k = 0; k < 30 && !p; k++) {
        const a = this.rng() * Math.PI * 2, d = 14 + this.rng() * (this.radius - 18);
        const x = Math.cos(a) * d, z = Math.sin(a) * d;
        if (this.canPlace(x, z, r, 2.5) && this.lavaPools.every((l) => (l.x - x) ** 2 + (l.z - z) ** 2 > (l.r + r + 3) ** 2)) p = { x, z };
      }
      if (!p) continue;
      const g = new THREE.Group();
      const pool = new THREE.Mesh(new THREE.CircleGeometry(r, 18).rotateX(-Math.PI / 2), lavaMat);
      pool.position.y = 0.05;
      const crust = new THREE.Mesh(new THREE.RingGeometry(r * 0.95, r * 1.15, 18).rotateX(-Math.PI / 2), crustMat);
      crust.position.y = 0.06;
      g.add(pool, crust);
      g.position.set(p.x, 0, p.z);
      this.add(g);
      this.lavaPools.push({ x: p.x, z: p.z, r });
    }
    this.animated.push((t) => { lavaMat.color.setHSL(0.05 + Math.sin(t * 1.5) * 0.015, 1, 0.5 + Math.sin(t * 2.3) * 0.06); });
  }

  /** Ice spikes (Frozen Wasteland) or obsidian spires (Lava Fields). */
  private buildSpikes(n: number) {
    if (n <= 0) return;
    const ice = this.def.id === 'frozen';
    const items: { x: number; z: number; s: number; a: number; tilt: number }[] = [];
    for (let i = 0; i < n; i++) {
      const s = 0.7 + this.rng() * 1.6;
      const solid = s > 1.2;
      const p = this.placeSolid(solid ? 0.5 * s : 0.1, solid ? 3 : 0.5, 11, this.radius + 8);
      if (!p) continue;
      items.push({ ...p, s, a: this.rng() * 6, tilt: (this.rng() - 0.5) * 0.4 });
      if (solid && Math.hypot(p.x, p.z) < this.radius) this.obstacles.push({ x: p.x, z: p.z, r: 0.5 * s });
    }
    const mat = ice
      ? occludable(new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#5fa8d3', emissiveIntensity: 0.25, flatShading: true, transparent: true, opacity: 0.9 }))
      : occludable(new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true }));
    const base = new THREE.Color(ice ? '#caf0f8' : '#2b2120');
    this.instanced(cone(0.6, 2.6, { p: [0, 1.3, 0] }, 5), mat, items.length, (i, m, c) => {
      const it = items[i];
      m.compose(_p.set(it.x, 0, it.z), _q.setFromEuler(_e.set(it.tilt, it.a, it.tilt * 0.6)), _s.set(it.s, it.s * (1 + (i % 3) * 0.25), it.s));
      c.copy(base).multiplyScalar(0.85 + this.rng() * 0.3);
    }, true);
  }

  private buildMotes() {
    if (this.def.snow) { this.buildSnow(); return; }
    const n = 220;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3);
    const seeds = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (this.rng() - 0.5) * 70;
      pos[i * 3 + 1] = 0.5 + this.rng() * 5;
      pos[i * 3 + 2] = (this.rng() - 0.5) * 70;
      seeds[i] = this.rng() * 100;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const color = this.def.id === 'forest' ? '#fff3b0' : this.def.id === 'canyon' ? '#ff9de2' : this.def.id === 'lava' ? '#ff7b00' : '#ffb347';
    const mat = new THREE.PointsMaterial({ color, size: 0.22, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    this.add(pts);
    const attr = geo.getAttribute('position') as THREE.BufferAttribute;
    const base = pos.slice();
    const wrap = (v: number, c: number) => c + ((((v - c) % 70) + 105) % 70) - 35;
    this.animated.push((t) => {
      const c = this.center;
      for (let i = 0; i < n; i++) {
        const s = seeds[i];
        attr.setXYZ(i,
          wrap(base[i * 3] + Math.sin(t * 0.3 + s) * 2, c.x),
          base[i * 3 + 1] + Math.sin(t * 0.7 + s * 2) * 0.6,
          wrap(base[i * 3 + 2] + Math.cos(t * 0.25 + s) * 2, c.z));
      }
      attr.needsUpdate = true;
    });
  }
  private center = { x: 0, z: 0 };

  private buildSnow() {
    const n = 900;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3);
    const seeds = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (this.rng() - 0.5) * 60;
      pos[i * 3 + 1] = this.rng() * 14;
      pos[i * 3 + 2] = (this.rng() - 0.5) * 60;
      seeds[i] = this.rng() * 100;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: '#ffffff', size: 0.2, transparent: true, opacity: 0.9, depthWrite: false });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    this.add(pts);
    const attr = geo.getAttribute('position') as THREE.BufferAttribute;
    const wrap = (v: number, c: number) => c + ((((v - c) % 60) + 90) % 60) - 30;
    let wind = 0;
    this.animated.push((_t, dt) => {
      const c = this.center;
      wind += ((this.blizzard ? 9 : 1.2) - wind) * Math.min(1, dt);
      mat.size = this.blizzard ? 0.28 : 0.2;
      for (let i = 0; i < n; i++) {
        let y = attr.getY(i) - dt * (1.5 + (seeds[i] % 1) * 1.5 + wind * 0.3);
        if (y < 0) y += 14;
        attr.setXYZ(i, wrap(attr.getX(i) + dt * wind, c.x), y, wrap(attr.getZ(i) + Math.sin(seeds[i] + y) * dt * 0.5, c.z));
      }
      attr.needsUpdate = true;
    });
  }

  private buildCloudShadows() {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const ctx = cv.getContext('2d')!;
    const grd = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(0,0,0,0.5)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(cv);
    this.disposables.push(tex);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: this.def.id === 'arena' ? 0.15 : 0.28, depthWrite: false });
    const shadows: THREE.Mesh[] = [];
    for (let i = 0; i < 7; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
      m.rotation.x = -Math.PI / 2;
      m.scale.set(14 + this.rng() * 14, 10 + this.rng() * 10, 1);
      m.position.set((this.rng() - 0.5) * 2 * this.radius, 0.06, (this.rng() - 0.5) * 2 * this.radius);
      m.renderOrder = 0;
      this.add(m);
      shadows.push(m);
    }
    const R = this.radius + 20;
    this.animated.push((_t, dt) => {
      for (const s of shadows) {
        s.position.x += dt * 1.6;
        s.position.z += dt * 0.6;
        if (s.position.x > R) s.position.x = -R;
        if (s.position.z > R) s.position.z = -R;
      }
    });
  }

  update(t: number, dt: number, center?: { x: number; z: number }) {
    timeUniform.value = t;
    for (const fn of this.animated) fn(t, dt);
    if (center) { this.center.x = center.x; this.center.z = center.z; }
  }

  dispose() {
    for (const d of this.disposables) d.dispose();
    this.disposables.length = 0;
    this.group.removeFromParent();
  }
}
