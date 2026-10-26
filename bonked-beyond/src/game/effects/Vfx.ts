// Pooled one-shot visual effects: shockwave rings, swing arcs, lightning, ground telegraphs.
import * as THREE from 'three';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();
const _c = new THREE.Color();

interface RingFx { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; life: number; max: number; r0: number; r1: number; active: boolean; opacity: number }
interface ArcFx { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; life: number; max: number; active: boolean }
interface BoltSeg { ax: number; ay: number; az: number; bx: number; by: number; bz: number; life: number; max: number; width: number; r: number; g: number; b: number }

export interface Telegraph {
  group: THREE.Group;
  fill: THREE.Mesh;
  outline: THREE.Mesh;
  fillMat: THREE.MeshBasicMaterial;
  outlineMat: THREE.MeshBasicMaterial;
  shape: 'circle' | 'rect';
  active: boolean;
}

export class Vfx {
  private scene: THREE.Scene;
  private rings: RingFx[] = [];
  private arcs: ArcFx[] = [];
  private arcGeo: THREE.RingGeometry;
  private ringGeo = new THREE.RingGeometry(0.86, 1, 48, 1);
  private bolts: BoltSeg[] = [];
  private boltMesh: THREE.InstancedMesh;
  private telegraphs: Telegraph[] = [];
  private circleGeo = new THREE.CircleGeometry(1, 40);
  private planeGeo = new THREE.PlaneGeometry(1, 1);
  private rectOutlineGeo: THREE.BufferGeometry;
  reduced = false;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.arcGeo = new THREE.RingGeometry(0.35, 1, 24, 1, -1.2, 2.4);
    this.boltMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), 600);
    this.boltMesh.setColorAt(0, _c.set(1, 1, 1));
    this.boltMesh.count = 0;
    this.boltMesh.frustumCulled = false;
    scene.add(this.boltMesh);
    // rectangle outline: a thin frame built from 4 boxes merged into one geometry
    const frame: THREE.BufferGeometry[] = [];
    const t = 0.06;
    const mk = (w: number, h: number, x: number, y: number) => { const g = new THREE.PlaneGeometry(w, h); g.translate(x, y, 0); frame.push(g); };
    mk(1, t, 0, 0.5 - t / 2); mk(1, t, 0, -0.5 + t / 2); mk(t, 1, 0.5 - t / 2, 0); mk(t, 1, -0.5 + t / 2, 0);
    this.rectOutlineGeo = mergeSimple(frame);
  }

  ring(x: number, z: number, r0: number, r1: number, color: THREE.ColorRepresentation, life = 0.45, opacity = 0.8, y = 0.08) {
    let fx = this.rings.find((r) => !r.active);
    if (!fx) {
      if (this.rings.length > 40) return;
      const mat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
      const mesh = new THREE.Mesh(this.ringGeo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.renderOrder = 2;
      this.scene.add(mesh);
      fx = { mesh, mat, life: 0, max: 1, r0: 0, r1: 1, active: false, opacity: 1 };
      this.rings.push(fx);
    }
    fx.active = true; fx.life = life; fx.max = life; fx.r0 = r0; fx.r1 = r1; fx.opacity = opacity;
    fx.mat.color.set(color);
    fx.mesh.position.set(x, y, z);
    fx.mesh.visible = true;
  }

  arc(x: number, z: number, angle: number, radius: number, color: THREE.ColorRepresentation, full = false) {
    let fx = this.arcs.find((a) => !a.active);
    if (!fx) {
      if (this.arcs.length > 16) return;
      const mat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
      const mesh = new THREE.Mesh(this.arcGeo, mat);
      mesh.renderOrder = 3;
      this.scene.add(mesh);
      fx = { mesh, mat, life: 0, max: 1, active: false };
      this.arcs.push(fx);
    }
    fx.mesh.geometry = full ? this.ringGeo : this.arcGeo;
    fx.active = true; fx.life = 0.22; fx.max = 0.22;
    fx.mat.color.set(color);
    fx.mesh.position.set(x, 0.7, z);
    fx.mesh.rotation.set(-Math.PI / 2, 0, -angle);
    fx.mesh.scale.setScalar(radius);
    fx.mesh.visible = true;
  }

  /** Jagged lightning between two points. */
  lightning(ax: number, ay: number, az: number, bx: number, by: number, bz: number, color: THREE.ColorRepresentation = '#9ff8ff', width = 0.14) {
    _c.set(color);
    const segs = 5;
    let px = ax, py = ay, pz = az;
    for (let i = 1; i <= segs; i++) {
      const t = i / segs;
      const j = i === segs ? 0 : 0.6;
      const nx = ax + (bx - ax) * t + (Math.random() - 0.5) * j;
      const ny = ay + (by - ay) * t + (Math.random() - 0.5) * j * 0.6;
      const nz = az + (bz - az) * t + (Math.random() - 0.5) * j;
      if (this.bolts.length < 600) this.bolts.push({ ax: px, ay: py, az: pz, bx: nx, by: ny, bz: nz, life: 0.18, max: 0.18, width, r: _c.r, g: _c.g, b: _c.b });
      px = nx; py = ny; pz = nz;
    }
  }

  telegraph(shape: 'circle' | 'rect', color: THREE.ColorRepresentation = '#ff2e2e'): Telegraph {
    let tg = this.telegraphs.find((t) => !t.active && t.shape === shape);
    if (!tg) {
      const group = new THREE.Group();
      const fillMat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, opacity: 0.35 });
      const outlineMat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, opacity: 0.9 });
      const fill = new THREE.Mesh(shape === 'circle' ? this.circleGeo : this.planeGeo, fillMat);
      const outline = new THREE.Mesh(shape === 'circle' ? this.ringGeo : this.rectOutlineGeo, outlineMat);
      const base = new THREE.Mesh(shape === 'circle' ? this.circleGeo : this.planeGeo, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, opacity: 0.12, color: 0xff0000 }));
      for (const m of [base, fill, outline]) { m.rotation.x = -Math.PI / 2; m.renderOrder = 1; group.add(m); }
      base.position.y = 0.03; fill.position.y = 0.04; outline.position.y = 0.05;
      this.scene.add(group);
      tg = { group, fill, outline, fillMat, outlineMat, shape, active: false };
      this.telegraphs.push(tg);
    }
    tg.active = true;
    tg.group.visible = true;
    tg.fillMat.color.set(color);
    tg.outlineMat.color.set(color);
    (tg.group.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>).material.color.set(color);
    return tg;
  }

  /** Circle: radius r, progress 0..1. */
  setCircle(tg: Telegraph, x: number, z: number, r: number, progress: number) {
    tg.group.position.set(x, 0, z);
    tg.group.rotation.y = 0;
    tg.group.children[0].scale.set(r, r, 1);
    tg.outline.scale.set(r, r, 1);
    const f = Math.max(0.01, progress) * r;
    tg.fill.scale.set(f, f, 1);
    tg.outlineMat.opacity = 0.6 + Math.sin(performance.now() * 0.02) * 0.3;
  }

  /** Rect: from (x,z) along angle, length L, width W; fill grows along length. */
  setRect(tg: Telegraph, x: number, z: number, angle: number, length: number, width: number, progress: number) {
    tg.group.position.set(x, 0, z);
    tg.group.rotation.y = -angle;
    const base = tg.group.children[0];
    // planes are XY then rotated to XZ: local x = forward, local y = -z (side)
    base.scale.set(length, width, 1); base.position.x = length / 2;
    tg.outline.scale.set(length, width, 1); tg.outline.position.x = length / 2;
    const l = Math.max(0.01, progress) * length;
    tg.fill.scale.set(l, width, 1); tg.fill.position.x = l / 2;
    tg.outlineMat.opacity = 0.6 + Math.sin(performance.now() * 0.02) * 0.3;
  }

  release(tg: Telegraph) {
    tg.active = false;
    tg.group.visible = false;
  }

  clear() {
    for (const r of this.rings) { r.active = false; r.mesh.visible = false; }
    for (const a of this.arcs) { a.active = false; a.mesh.visible = false; }
    for (const t of this.telegraphs) this.release(t);
    this.bolts.length = 0;
    this.boltMesh.count = 0;
  }

  update(dt: number) {
    for (const r of this.rings) {
      if (!r.active) continue;
      r.life -= dt;
      if (r.life <= 0) { r.active = false; r.mesh.visible = false; continue; }
      const t = 1 - r.life / r.max;
      const e = 1 - Math.pow(1 - t, 3);
      const rad = r.r0 + (r.r1 - r.r0) * e;
      r.mesh.scale.set(rad, rad, 1);
      r.mat.opacity = r.opacity * (1 - t);
    }
    for (const a of this.arcs) {
      if (!a.active) continue;
      a.life -= dt;
      if (a.life <= 0) { a.active = false; a.mesh.visible = false; continue; }
      a.mat.opacity = (a.life / a.max) * 0.85;
    }
    let n = 0;
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.life -= dt;
      if (b.life <= 0) { this.bolts[i] = this.bolts[this.bolts.length - 1]; this.bolts.pop(); continue; }
    }
    for (const b of this.bolts) {
      const w = b.width * (b.life / b.max) * (this.reduced ? 0.6 : 1);
      _dir.set(b.bx - b.ax, b.by - b.ay, b.bz - b.az);
      const len = _dir.length();
      if (len < 1e-4) continue;
      _dir.divideScalar(len);
      _q.setFromUnitVectors(_up, _dir);
      _p.set((b.ax + b.bx) / 2, (b.ay + b.by) / 2, (b.az + b.bz) / 2);
      _s.set(w, len, w);
      _m.compose(_p, _q, _s);
      this.boltMesh.setMatrixAt(n, _m);
      _c.setRGB(b.r, b.g, b.b);
      this.boltMesh.setColorAt(n, _c);
      n++;
    }
    this.boltMesh.count = n;
    this.boltMesh.instanceMatrix.needsUpdate = true;
    if (this.boltMesh.instanceColor) this.boltMesh.instanceColor.needsUpdate = true;
  }
}

/** Merge non-indexed-compatible geometries (position/normal/uv) into one. */
export function mergeSimple(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const parts = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  const attrs = ['position', 'normal', 'uv'] as const;
  const out = new THREE.BufferGeometry();
  for (const a of attrs) {
    if (!parts.every((p) => p.getAttribute(a))) continue;
    const size = parts[0].getAttribute(a).itemSize;
    let total = 0;
    for (const p of parts) total += p.getAttribute(a).count;
    const arr = new Float32Array(total * size);
    let off = 0;
    for (const p of parts) {
      const src = p.getAttribute(a).array as Float32Array;
      arr.set(src, off);
      off += src.length;
    }
    out.setAttribute(a, new THREE.BufferAttribute(arr, size));
  }
  return out;
}
