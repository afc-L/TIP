// Characters: a detailed player figure, plus an instanced crowd renderer for NPCs
// (7 draw calls for every pedestrian, creator, rival, valet and club guest).
import * as THREE from 'three';
import type { OutfitDef, WatchDef } from '../data/catalog';

const SKIN = '#d7a77f';

export class PlayerFigure {
  root = new THREE.Group();
  private legL = new THREE.Group();
  private legR = new THREE.Group();
  private armL = new THREE.Group();
  private armR = new THREE.Group();
  private torso: THREE.Mesh;
  private hips: THREE.Mesh;
  private shoes: THREE.Mesh[] = [];
  private accent: THREE.Mesh;
  private watch = new THREE.Group();
  private watchCase: THREE.MeshStandardMaterial;
  private watchDial: THREE.MeshStandardMaterial;
  private watchStrap: THREE.MeshStandardMaterial;
  private topMat = new THREE.MeshStandardMaterial({ color: '#2f5d8a', roughness: 0.8 });
  private bottomMat = new THREE.MeshStandardMaterial({ color: '#d8cfbd', roughness: 0.85 });
  private shoeMat = new THREE.MeshStandardMaterial({ color: '#eee', roughness: 0.6 });
  private accentMat = new THREE.MeshStandardMaterial({ color: '#fff', roughness: 0.5, metalness: 0.3 });
  phase = 0;

  constructor() {
    const skin = new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.7 });
    const hairMat = new THREE.MeshStandardMaterial({ color: '#1c130c', roughness: 0.9 });
    this.hips = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.2, 0.22), this.bottomMat);
    this.hips.position.y = 0.95;
    this.torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.38, 4, 10), this.topMat);
    this.torso.scale.set(1.1, 1, 0.75);
    this.torso.position.y = 1.32;
    this.accent = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.05), this.accentMat);
    this.accent.position.set(0, 1.56, 0.13);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.12, 8), skin);
    neck.position.y = 1.62;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), skin);
    head.scale.set(0.95, 1.1, 1);
    head.position.y = 1.77;
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.135, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
    hair.position.y = 1.79;
    // sunglasses (it's Miami)
    const shades = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.045, 0.03), new THREE.MeshStandardMaterial({ color: '#050505', metalness: 0.8, roughness: 0.1 }));
    shades.position.set(0, 1.79, 0.12);
    this.root.add(this.hips, this.torso, this.accent, neck, head, hair, shades);
    const mkLeg = (g: THREE.Group, x: number) => {
      g.position.set(x, 0.92, 0);
      const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.38, 4, 8), this.bottomMat);
      thigh.position.y = -0.24;
      const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.36, 4, 8), this.bottomMat);
      shin.position.y = -0.64;
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.26), this.shoeMat);
      shoe.position.set(0, -0.88, 0.05);
      this.shoes.push(shoe);
      g.add(thigh, shin, shoe);
      this.root.add(g);
    };
    mkLeg(this.legL, 0.1);
    mkLeg(this.legR, -0.1);
    const mkArm = (g: THREE.Group, x: number) => {
      g.position.set(x, 1.52, 0);
      const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.26, 4, 8), this.topMat);
      upper.position.y = -0.18;
      const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.052, 0.24, 4, 8), skin);
      fore.position.y = -0.47;
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), skin);
      hand.position.y = -0.66;
      g.add(upper, fore, hand);
      this.root.add(g);
    };
    mkArm(this.armL, 0.26);
    mkArm(this.armR, -0.26);
    // watch on the left wrist
    this.watchCase = new THREE.MeshStandardMaterial({ color: '#ccc', metalness: 1, roughness: 0.15 });
    this.watchDial = new THREE.MeshStandardMaterial({ color: '#fff', roughness: 0.3, emissive: '#000' });
    this.watchStrap = new THREE.MeshStandardMaterial({ color: '#333', roughness: 0.6 });
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.014, 6, 16), this.watchStrap);
    strap.rotation.x = Math.PI / 2;
    const face = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.018, 16), this.watchCase);
    face.rotation.z = Math.PI / 2;
    face.position.x = 0.06;
    const dial = new THREE.Mesh(new THREE.CircleGeometry(0.024, 16), this.watchDial);
    dial.rotation.y = Math.PI / 2;
    dial.position.x = 0.0705;
    this.watch.add(strap, face, dial);
    this.watch.position.y = -0.58;
    this.armL.add(this.watch);
    this.root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true;
    });
  }

  setOutfit(o: OutfitDef) {
    this.topMat.color.set(o.top);
    this.bottomMat.color.set(o.bottom);
    this.shoeMat.color.set(o.shoes);
    this.accentMat.color.set(o.accent);
  }

  setWatch(w: WatchDef | null) {
    this.watch.visible = !!w;
    if (!w) return;
    this.watchCase.color.set(w.caseColor);
    this.watchDial.color.set(w.dialColor);
    this.watchDial.emissive.set(w.diamonds ? '#556' : '#000');
    this.watchStrap.color.set(w.strapColor);
    this.watchStrap.metalness = w.strapColor === w.caseColor ? 1 : 0;
  }

  /** speed in m/s, airborne flag */
  animate(dt: number, speed: number, air: boolean, t: number) {
    const s = Math.min(speed / 4, 1.8);
    this.phase += dt * (3 + speed * 1.6);
    const sw = Math.sin(this.phase) * 0.55 * Math.min(1, s);
    if (air) {
      this.legL.rotation.x = -0.5;
      this.legR.rotation.x = 0.3;
      this.armL.rotation.x = -0.9;
      this.armR.rotation.x = -0.9;
      return;
    }
    this.legL.rotation.x = sw;
    this.legR.rotation.x = -sw;
    this.armL.rotation.x = -sw * 0.8;
    this.armR.rotation.x = sw * 0.8;
    this.armL.rotation.z = 0.06;
    this.armR.rotation.z = -0.06;
    const bob = Math.abs(Math.cos(this.phase)) * 0.04 * Math.min(1, s);
    this.torso.position.y = 1.32 + bob + (speed < 0.1 ? Math.sin(t * 1.5) * 0.008 : 0);
  }

  /** Raise the left wrist to look at the watch (inspection screen). */
  checkWatch() {
    this.armL.rotation.x = -1.35;
    this.armL.rotation.z = -0.5;
  }
}

// ----------------------------------------------------------------------------------------------
// Crowd renderer

export interface CrowdLook {
  skin: string;
  hair: string;
  top: string;
  bottom: string;
  hairStyle: 'long' | 'short' | 'bun' | 'none';
  scale?: number;
}

export interface CrowdAgent {
  x: number;
  y: number;
  z: number;
  yaw: number;
  speed: number; // used for walk cycle
  phase: number;
  dance: number; // 0..1 dancing intensity
  wave: number; // 0..1 arm raise (cheering)
  look: CrowdLook;
  visible: boolean;
}

const PARTS = ['torso', 'head', 'legL', 'legR', 'armL', 'armR', 'hairS', 'hairL'] as const;
type PartName = (typeof PARTS)[number];

export class Crowd {
  meshes: Record<PartName, THREE.InstancedMesh>;
  max: number;
  agents: CrowdAgent[] = [];
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private v = new THREE.Vector3();
  private sc = new THREE.Vector3();
  private local = new THREE.Matrix4();
  private rootM = new THREE.Matrix4();
  private col = new THREE.Color();
  private dirty = true;

  constructor(max: number) {
    this.max = max;
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.75 });
    const geo: Record<PartName, THREE.BufferGeometry> = {
      torso: (() => { const g = new THREE.CapsuleGeometry(0.18, 0.5, 3, 8); g.scale(1.1, 1, 0.75); g.translate(0, 1.25, 0); return g; })(),
      head: (() => { const g = new THREE.SphereGeometry(0.125, 10, 8); g.scale(0.95, 1.1, 1); g.translate(0, 1.74, 0); return g; })(),
      legL: (() => { const g = new THREE.CapsuleGeometry(0.075, 0.74, 3, 6); g.translate(0, -0.45, 0); return g; })(),
      legR: (() => { const g = new THREE.CapsuleGeometry(0.075, 0.74, 3, 6); g.translate(0, -0.45, 0); return g; })(),
      armL: (() => { const g = new THREE.CapsuleGeometry(0.055, 0.55, 3, 6); g.translate(0, -0.33, 0); return g; })(),
      armR: (() => { const g = new THREE.CapsuleGeometry(0.055, 0.55, 3, 6); g.translate(0, -0.33, 0); return g; })(),
      hairS: (() => { const g = new THREE.SphereGeometry(0.135, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55); g.translate(0, 1.76, -0.005); return g; })(),
      hairL: (() => { const g = new THREE.BoxGeometry(0.27, 0.42, 0.12); g.translate(0, 1.62, -0.1); const s = new THREE.SphereGeometry(0.14, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.6); s.translate(0, 1.76, 0); return mergeTwo(g, s); })(),
    };
    this.meshes = {} as Record<PartName, THREE.InstancedMesh>;
    for (const p of PARTS) {
      const im = new THREE.InstancedMesh(geo[p], mat, max);
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.castShadow = p === 'torso' || p === 'legL' || p === 'legR';
      im.frustumCulled = false;
      im.count = 0;
      for (let i = 0; i < max; i++) im.setColorAt(i, this.col.set('#fff'));
      this.meshes[p] = im;
    }
  }

  addTo(scene: THREE.Object3D) {
    for (const p of PARTS) scene.add(this.meshes[p]);
  }

  add(a: CrowdAgent) {
    if (this.agents.length >= this.max) return null;
    this.agents.push(a);
    this.dirty = true;
    return a;
  }

  clear() {
    this.agents.length = 0;
    this.dirty = true;
  }

  recolor() {
    this.dirty = true;
  }

  private visHash = 0;

  update(dt: number, t: number) {
    const n = this.agents.length;
    // instance slots are packed by visibility, so recolour whenever the visible set changes
    let h = n;
    for (let i = 0; i < n; i++) if (this.agents[i].visible) h = (h * 31 + i) | 0;
    if (h !== this.visHash) {
      this.visHash = h;
      this.dirty = true;
    }
    let k = 0;
    for (let i = 0; i < n; i++) {
      const a = this.agents[i];
      if (!a.visible) continue;
      const s = a.look.scale ?? 1;
      a.phase += dt * (2.5 + a.speed * 2.2);
      const sw = Math.sin(a.phase) * 0.6 * Math.min(1, a.speed / 1.5);
      const danceBob = a.dance > 0 ? Math.abs(Math.sin(t * 8 + a.phase)) * 0.08 * a.dance : 0;
      this.e.set(0, a.yaw + (a.dance > 0 ? Math.sin(t * 2 + a.phase) * 0.4 * a.dance : 0), 0);
      this.q.setFromEuler(this.e);
      this.rootM.compose(this.v.set(a.x, a.y + danceBob, a.z), this.q, this.sc.set(s, s, s));
      // torso, head, hair (rigid with root)
      this.setPart('torso', k, this.rootM);
      this.setPart('head', k, this.rootM);
      const hs = a.look.hairStyle;
      this.setPart('hairS', k, this.rootM, hs === 'short' || hs === 'bun' ? 1 : 0);
      this.setPart('hairL', k, this.rootM, hs === 'long' ? 1 : 0);
      // limbs
      const legSw = a.dance > 0 ? Math.sin(t * 8 + a.phase) * 0.25 * a.dance : sw;
      this.limb('legL', k, 0.1, 0.92, legSw, 0);
      this.limb('legR', k, -0.1, 0.92, -legSw, 0);
      const armRaise = a.wave > 0 ? -2.6 * a.wave + Math.sin(t * 9 + a.phase) * 0.3 * a.wave : a.dance > 0 ? -1.2 * a.dance + Math.sin(t * 8 + a.phase) * 0.8 * a.dance : -sw * 0.8;
      this.limb('armL', k, 0.25, 1.5, armRaise, 0.08);
      this.limb('armR', k, -0.25, 1.5, a.wave > 0 ? armRaise * 0.9 : a.dance > 0 ? armRaise : sw * 0.8, -0.08);
      if (this.dirty) {
        const L = a.look;
        this.meshes.torso.setColorAt(k, this.col.set(L.top));
        this.meshes.head.setColorAt(k, this.col.set(L.skin));
        this.meshes.armL.setColorAt(k, this.col.set(L.skin));
        this.meshes.armR.setColorAt(k, this.col.set(L.skin));
        this.meshes.legL.setColorAt(k, this.col.set(L.bottom));
        this.meshes.legR.setColorAt(k, this.col.set(L.bottom));
        this.meshes.hairS.setColorAt(k, this.col.set(L.hair));
        this.meshes.hairL.setColorAt(k, this.col.set(L.hair));
      }
      k++;
    }
    for (const p of PARTS) {
      const im = this.meshes[p];
      im.count = k;
      im.instanceMatrix.needsUpdate = true;
      if (this.dirty && im.instanceColor) im.instanceColor.needsUpdate = true;
    }
    this.dirty = false;
  }

  private setPart(p: PartName, k: number, m: THREE.Matrix4, scale = 1) {
    if (scale === 1) this.meshes[p].setMatrixAt(k, m);
    else {
      this.m.makeScale(0, 0, 0);
      this.meshes[p].setMatrixAt(k, this.m);
    }
  }

  private limb(p: PartName, k: number, x: number, y: number, rotX: number, rotZ: number) {
    this.e.set(rotX, 0, rotZ);
    this.q.setFromEuler(this.e);
    this.local.compose(this.v.set(x, y, 0), this.q, this.sc.set(1, 1, 1));
    this.m.multiplyMatrices(this.rootM, this.local);
    this.meshes[p].setMatrixAt(k, this.m);
  }
}

function mergeTwo(a: THREE.BufferGeometry, b: THREE.BufferGeometry) {
  const an = a.toNonIndexed();
  const bn = b.toNonIndexed();
  const pos = new Float32Array(an.attributes.position.array.length + bn.attributes.position.array.length);
  pos.set(an.attributes.position.array as Float32Array, 0);
  pos.set(bn.attributes.position.array as Float32Array, an.attributes.position.array.length);
  const nor = new Float32Array(pos.length);
  nor.set(an.attributes.normal.array as Float32Array, 0);
  nor.set(bn.attributes.normal.array as Float32Array, an.attributes.normal.array.length);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return g;
}

export const SKINS = ['#f1d0b5', '#e2b48c', '#c68a5e', '#9c6644', '#6b4430', '#4a2c1d', '#f0cfa8', '#d8a982'];
export const HAIRS = ['#111', '#2a1a12', '#5a3a24', '#c96a2b', '#d9b36c', '#888', '#f0e0b0'];
export const TOPS = ['#ffffff', '#f4efe4', '#111111', '#2f5d8a', '#ff7eb6', '#3ddcff', '#d4af6a', '#9be0c9', '#ff6a3d', '#7b2cbf', '#1e3a8a', '#e9e2d0', '#ffd400', '#2e8b57'];
export const BOTTOMS = ['#1d2433', '#d8cfbd', '#111', '#3a4a5a', '#f4efe4', '#6b5a45', '#2b2b2b', '#e9e2d0'];

export function randomLook(r = Math.random): CrowdLook {
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const styles: CrowdLook['hairStyle'][] = ['long', 'short', 'short', 'bun', 'long', 'none'];
  return { skin: pick(SKINS), hair: pick(HAIRS), top: pick(TOPS), bottom: pick(BOTTOMS), hairStyle: pick(styles), scale: 0.92 + r() * 0.14 };
}
