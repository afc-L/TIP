// Procedural vehicle models. The car faces +Z, origin at ground level between the axles.
// Hierarchy:  root (position/yaw)  ->  chassis (bounce heave/pitch/roll)  ->  body, interior
//             root -> wheelMounts[i] (suspension travel, steer) -> wheel (spin)
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BodyShape } from '../data/vehicles';
import type { VehicleMods } from '../types';
import { ScreenTexture, grilleTexture, signTexture } from './textures';

type P = [number, number];

interface Profile {
  length: number;
  width: number;
  wheelR: number;
  wheelFront: number;
  wheelRear: number;
  track: number;
  bottom: number;
  split: number; // two-tone split height
  top: P[]; // metal top profile from front to rear (z, y)
  cabin: P[] | null; // greenhouse polygon (z, y), closed
  roof: { z0: number; z1: number; y: number } | null;
  belt: number;
  seatZ: number;
  eye: [number, number, number];
  dashZ: number;
  windshield: [P, P]; // base, top
  rearGlass: [P, P];
  grille: { w: number; h: number; y: number } ;
  lights: { y: number; x: number; w: number };
}

function profile(shape: BodyShape, L: number, W: number, H: number): Profile {
  const f = L / 2;
  switch (shape) {
    case 'suv':
      return {
        length: L, width: W, wheelR: 0.43, wheelFront: f - 1.05, wheelRear: -f + 1.05, track: W / 2 - 0.17, bottom: 0.3, split: 0.98,
        top: [[f, 0.42], [f + 0.06, 0.62], [f + 0.04, 0.98], [f - 0.12, 1.12], [f - 1.35, 1.2], [-f + 0.3, 1.22], [-f + 0.05, 1.12], [-f, 0.9], [-f + 0.02, 0.42]],
        cabin: [[f - 1.35, 1.2], [f - 2.1, H], [-f + 0.38, H - 0.02], [-f + 0.18, 1.22]],
        roof: { z0: -f + 0.3, z1: f - 2.08, y: H },
        belt: 1.2, seatZ: 0.25, eye: [0.42, 1.6, 0.05], dashZ: f - 1.55,
        windshield: [[f - 1.35, 1.2], [f - 2.1, H]], rearGlass: [[-f + 0.18, 1.22], [-f + 0.38, H - 0.02]],
        grille: { w: 0.96, h: 0.5, y: 0.74 }, lights: { y: 0.93, x: W / 2 - 0.3, w: 0.42 },
      };
    case 'sedan':
      return {
        length: L, width: W, wheelR: 0.38, wheelFront: f - 1.0, wheelRear: -f + 1.15, track: W / 2 - 0.17, bottom: 0.25, split: 0.82,
        top: [[f, 0.36], [f + 0.05, 0.62], [f - 0.05, 0.86], [f - 1.45, 0.95], [-f + 0.85, 0.98], [-f + 0.15, 0.96], [-f, 0.75], [-f + 0.03, 0.36]],
        cabin: [[f - 1.45, 0.95], [f - 2.35, H], [-f + 1.6, H - 0.02], [-f + 0.85, 0.98]],
        roof: { z0: -f + 1.55, z1: f - 2.32, y: H },
        belt: 0.96, seatZ: 0.15, eye: [0.42, 1.22, 0.0], dashZ: f - 1.7,
        windshield: [[f - 1.45, 0.95], [f - 2.35, H]], rearGlass: [[-f + 0.85, 0.98], [-f + 1.6, H - 0.02]],
        grille: { w: 0.78, h: 0.42, y: 0.6 }, lights: { y: 0.78, x: W / 2 - 0.3, w: 0.4 },
      };
    case 'gt':
      return {
        length: L, width: W, wheelR: 0.37, wheelFront: f - 0.95, wheelRear: -f + 1.0, track: W / 2 - 0.18, bottom: 0.2, split: 0.75,
        top: [[f, 0.34], [f + 0.04, 0.55], [f - 0.15, 0.78], [f - 1.9, 0.9], [-f + 0.5, 0.92], [-f + 0.08, 0.86], [-f, 0.6], [-f + 0.05, 0.34]],
        cabin: [[f - 1.9, 0.9], [f - 2.7, H], [-f + 1.3, H - 0.04], [-f + 0.5, 0.92]],
        roof: { z0: -f + 1.25, z1: f - 2.68, y: H },
        belt: 0.9, seatZ: -0.25, eye: [0.4, 1.12, -0.4], dashZ: f - 2.1,
        windshield: [[f - 1.9, 0.9], [f - 2.7, H]], rearGlass: [[-f + 0.5, 0.92], [-f + 1.3, H - 0.04]],
        grille: { w: 0.7, h: 0.3, y: 0.5 }, lights: { y: 0.7, x: W / 2 - 0.32, w: 0.42 },
      };
    case 'sports':
    case 'supercar':
      return {
        length: L, width: W, wheelR: 0.36, wheelFront: f - 0.95, wheelRear: -f + 1.0, track: W / 2 - 0.18, bottom: 0.16, split: 0.62,
        top: [[f, 0.3], [f + 0.06, 0.42], [f - 0.6, 0.66], [f - 1.5, 0.8], [-f + 0.6, 0.86], [-f + 0.05, 0.82], [-f, 0.5], [-f + 0.05, 0.3]],
        cabin: [[f - 1.5, 0.8], [f - 2.25, H], [-f + 1.6, H - 0.03], [-f + 0.6, 0.86]],
        roof: { z0: -f + 1.55, z1: f - 2.22, y: H },
        belt: 0.82, seatZ: -0.15, eye: [0.38, 1.0, -0.3], dashZ: f - 1.75,
        windshield: [[f - 1.5, 0.8], [f - 2.25, H]], rearGlass: [[-f + 0.6, 0.86], [-f + 1.6, H - 0.03]],
        grille: { w: 0.9, h: 0.2, y: 0.36 }, lights: { y: 0.62, x: W / 2 - 0.3, w: 0.45 },
      };
    case 'convertible':
      return {
        length: L, width: W, wheelR: 0.37, wheelFront: f - 0.95, wheelRear: -f + 1.05, track: W / 2 - 0.18, bottom: 0.2, split: 0.72,
        top: [[f, 0.34], [f + 0.05, 0.56], [f - 0.15, 0.78], [f - 1.6, 0.88], [-f + 0.3, 0.9], [-f + 0.05, 0.84], [-f, 0.58], [-f + 0.05, 0.34]],
        cabin: null, roof: null,
        belt: 0.88, seatZ: -0.2, eye: [0.4, 1.15, -0.35], dashZ: f - 1.85,
        windshield: [[f - 1.6, 0.88], [f - 2.05, 1.22]], rearGlass: [[0, 0], [0, 0]],
        grille: { w: 0.7, h: 0.32, y: 0.52 }, lights: { y: 0.72, x: W / 2 - 0.3, w: 0.42 },
      };
    case 'show':
    default:
      return {
        length: L, width: W, wheelR: 0.37, wheelFront: f - 1.0, wheelRear: -f + 1.2, track: W / 2 - 0.12, bottom: 0.14, split: 0.7,
        top: [[f, 0.3], [f + 0.06, 0.55], [f - 0.1, 0.72], [f - 1.7, 0.84], [-f + 0.9, 0.86], [-f + 0.1, 0.8], [-f, 0.55], [-f + 0.05, 0.3]],
        cabin: [[f - 1.7, 0.84], [f - 2.5, H], [-f + 1.7, H - 0.02], [-f + 0.9, 0.86]],
        roof: { z0: -f + 1.65, z1: f - 2.48, y: H },
        belt: 0.85, seatZ: 0.0, eye: [0.42, 1.12, -0.1], dashZ: f - 1.95,
        windshield: [[f - 1.7, 0.84], [f - 2.5, H]], rearGlass: [[-f + 0.9, 0.86], [-f + 1.7, H - 0.02]],
        grille: { w: 1.0, h: 0.34, y: 0.5 }, lights: { y: 0.66, x: W / 2 - 0.3, w: 0.45 },
      };
  }
}

function extrudeSide(points: P[], width: number, bevel = 0.05, archs?: { z: number; r: number }[], bottom?: number) {
  const s = new THREE.Shape();
  if (archs && bottom !== undefined) {
    // bottom edge with wheel arches, rear -> front, then top profile front -> rear
    const rear = points[points.length - 1];
    const front = points[0];
    s.moveTo(rear[0], bottom);
    const sorted = [...archs].sort((a, b) => a.z - b.z);
    for (const a of sorted) {
      const R = a.r + 0.07;
      const cy = a.r;
      s.lineTo(a.z - R, bottom);
      s.lineTo(a.z - R, cy);
      s.absarc(a.z, cy, R, Math.PI, 0, true);
      s.lineTo(a.z + R, bottom);
    }
    s.lineTo(front[0], bottom);
    for (const p of points) s.lineTo(p[0], p[1]);
    s.lineTo(rear[0], bottom);
  } else {
    s.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) s.lineTo(points[i][0], points[i][1]);
    s.closePath();
  }
  const depth = Math.max(0.01, width - bevel * 2);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 14 });
  g.rotateY(-Math.PI / 2); // shape x -> car z, extrusion -> car -x
  g.translate(depth / 2, 0, 0);
  g.computeVertexNormals();
  return g;
}

function boxAt(w: number, h: number, d: number, x: number, y: number, z: number) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
}

function beam(a: THREE.Vector3, b: THREE.Vector3, w: number, t: number) {
  const len = a.distanceTo(b);
  const g = new THREE.BoxGeometry(w, t, len);
  const m = new THREE.Matrix4().lookAt(a, b, new THREE.Vector3(0, 1, 0));
  g.applyMatrix4(m);
  const mid = a.clone().add(b).multiplyScalar(0.5);
  g.translate(mid.x, mid.y, mid.z);
  return g;
}

// Shared materials
const matCache = new Map<string, THREE.Material>();
function shared(key: string, make: () => THREE.Material) {
  let m = matCache.get(key);
  if (!m) matCache.set(key, (m = make()));
  return m;
}
export const chromeMat = () => shared('chrome', () => new THREE.MeshStandardMaterial({ color: '#f2f2f2', metalness: 1, roughness: 0.08 }));
const goldChromeMat = () => shared('goldchrome', () => new THREE.MeshStandardMaterial({ color: '#e0b24a', metalness: 1, roughness: 0.15 }));
const blackTrim = () => shared('blacktrim', () => new THREE.MeshStandardMaterial({ color: '#0b0b0c', metalness: 0.3, roughness: 0.5 }));
const tireMat = () => shared('tire', () => new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.92 }));
const plasticMat = () => shared('plastic', () => new THREE.MeshStandardMaterial({ color: '#1a1a1c', roughness: 0.65 }));
const woodMat = () => shared('wood', () => new THREE.MeshStandardMaterial({ color: '#3a2112', roughness: 0.25, metalness: 0.1 }));
const brakeDiscMat = () => shared('disc', () => new THREE.MeshStandardMaterial({ color: '#555', metalness: 0.8, roughness: 0.35 }));
const ambientMat = () => shared('ambient', () => new THREE.MeshBasicMaterial({ color: '#36c9ff' }));

function rimGeometry(style: string, r: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const rimR = r * 0.74;
  const barrel = new THREE.CylinderGeometry(rimR, rimR, 0.04, 28, 1, true);
  barrel.rotateZ(Math.PI / 2);
  barrel.translate(0.12, 0, 0);
  parts.push(barrel);
  const lip = new THREE.TorusGeometry(rimR, 0.022, 6, 32);
  lip.rotateY(Math.PI / 2);
  lip.translate(0.14, 0, 0);
  parts.push(lip);
  const hub = new THREE.CylinderGeometry(0.075, 0.09, 0.05, 16);
  hub.rotateZ(Math.PI / 2);
  hub.translate(0.13, 0, 0);
  parts.push(hub);
  const spoke = (count: number, w: number, depth: number, twist = 0, len = rimR - 0.07, offset = 0) => {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + offset;
      const g = new THREE.BoxGeometry(depth, len, w);
      g.translate(0, len / 2 + 0.06, 0);
      g.rotateY(twist);
      g.rotateX(a);
      g.translate(0.125, 0, 0);
      parts.push(g);
    }
  };
  switch (style) {
    case 'maybach':
      spoke(20, 0.022, 0.035);
      { const disc = new THREE.CylinderGeometry(rimR * 0.98, rimR * 0.98, 0.012, 32); disc.rotateZ(Math.PI / 2); disc.translate(0.105, 0, 0); parts.push(disc); }
      break;
    case 'forged':
      spoke(10, 0.05, 0.04);
      break;
    case 'monoblock': {
      const disc = new THREE.CylinderGeometry(rimR - 0.01, rimR - 0.01, 0.03, 32);
      disc.rotateZ(Math.PI / 2);
      disc.translate(0.125, 0, 0);
      parts.push(disc);
      break;
    }
    case 'turbine':
      spoke(14, 0.07, 0.03, 0.6);
      break;
    case 'split':
      spoke(5, 0.03, 0.04, 0, rimR - 0.07, 0.07);
      spoke(5, 0.03, 0.04, 0, rimR - 0.07, -0.07);
      break;
    case 'wire':
      spoke(36, 0.008, 0.012, 0.25);
      spoke(36, 0.008, 0.012, -0.25);
      break;
    default:
      spoke(8, 0.05, 0.04);
  }
  const merged = mergeGeometries(parts.map((p) => p.toNonIndexed()), false)!;
  parts.forEach((p) => p.dispose());
  return merged;
}

export interface CarParts {
  root: THREE.Group;
  chassis: THREE.Group; // receives bounce transform
  body: THREE.Group;
  wheelMounts: THREE.Group[]; // FL, FR, RL, RR
  wheels: THREE.Group[];
  struts: THREE.Mesh[];
  wheelR: number;
  wheelPos: { x: number; z: number }[];
  paintMat: THREE.MeshPhysicalMaterial;
  accentMat: THREE.MeshPhysicalMaterial;
  glassMat: THREE.MeshPhysicalMaterial;
  interiorMat: THREE.MeshStandardMaterial;
  brakeMat: THREE.MeshStandardMaterial;
  headMat: THREE.MeshStandardMaterial;
  underglow: THREE.Mesh;
  underglowMat: THREE.MeshBasicMaterial;
  rimMat: THREE.MeshStandardMaterial;
  screen: ScreenTexture | null;
  eye: THREE.Vector3;
  steering: THREE.Object3D | null;
  rideHeight: number;
  shape: BodyShape;
  length: number;
  width: number;
  height: number;
  dispose: () => void;
}

let glowTex: THREE.Texture | null = null;
function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}
export { glowTexture };

export function buildCar(shape: BodyShape, dims: { length: number; width: number; height: number }, mods: VehicleMods, detailed = true, isMaybach = false): CarParts {
  const pr = profile(shape, dims.length, dims.width, dims.height);
  const root = new THREE.Group();
  const chassis = new THREE.Group();
  const body = new THREE.Group();
  root.add(chassis);
  chassis.add(body);
  const geos: THREE.BufferGeometry[] = [];
  const track = (g: THREE.BufferGeometry) => (geos.push(g), g);

  const paintMat = new THREE.MeshPhysicalMaterial({ color: mods.paint, metalness: 0.6, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.06 });
  const accentMat = new THREE.MeshPhysicalMaterial({ color: mods.accent || mods.paint, metalness: 0.7, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.06 });
  const tintOpacity = [0.35, 0.55, 0.75, 0.9][mods.tint] ?? 0.75;
  const glassMat = new THREE.MeshPhysicalMaterial({ color: '#0d1218', metalness: 0.2, roughness: 0.05, transparent: true, opacity: tintOpacity, side: THREE.DoubleSide, depthWrite: false });
  const interiorMat = new THREE.MeshStandardMaterial({ color: mods.interior, roughness: 0.6, emissive: mods.interior, emissiveIntensity: 0.12 });
  const brakeMat = new THREE.MeshStandardMaterial({ color: '#5a0000', emissive: '#ff1a1a', emissiveIntensity: 0.6, roughness: 0.4 });
  const headMat = new THREE.MeshStandardMaterial({ color: '#dfe8ff', emissive: '#e8f0ff', emissiveIntensity: 0.6, roughness: 0.2, metalness: 0.4 });
  const rimMat = (mods.wheels === 'wire' ? goldChromeMat() : chromeMat()) as THREE.MeshStandardMaterial;
  const chrome = chromeMat();

  // --- Body shell (lower paint) with wheel arches
  const archs = [{ z: pr.wheelFront, r: pr.wheelR }, { z: pr.wheelRear, r: pr.wheelR }];
  const shell = new THREE.Mesh(track(extrudeSide(pr.top, pr.width, 0.06, archs, pr.bottom)), paintMat);
  shell.castShadow = true;
  body.add(shell);
  // Two-tone upper band
  if (mods.accent) {
    const upperTop = pr.top.map(([z, y]) => [z, y + 0.006] as P);
    const front = upperTop[0][0], rear = upperTop[upperTop.length - 1][0];
    // clip the profile to above split height
    const pts: P[] = [];
    pts.push([front + 0.07, pr.split]);
    for (const p of upperTop) if (p[1] > pr.split) pts.push(p);
    pts.push([rear - 0.02, pr.split]);
    const band = new THREE.Mesh(track(extrudeSide(pts, pr.width + 0.016, 0.06)), accentMat);
    band.castShadow = true;
    body.add(band);
  }
  // Chrome beltline + split strips
  const z0 = pr.wheelRear - 0.6, z1 = pr.wheelFront + 0.3;
  for (const sx of [-1, 1]) {
    const belt = new THREE.Mesh(track(boxAt(0.025, 0.03, z1 - z0 + 0.6, sx * (pr.width / 2 + 0.012), pr.belt - 0.02, (z0 + z1) / 2 - 0.2)), chrome);
    body.add(belt);
    if (shape === 'suv' || shape === 'sedan' || shape === 'show') {
      const sp = new THREE.Mesh(track(boxAt(0.02, 0.025, pr.wheelFront - pr.wheelRear - 1.1, sx * (pr.width / 2 + 0.018), pr.split, (pr.wheelFront + pr.wheelRear) / 2)), chrome);
      body.add(sp);
      // door handles
      for (const dz of [0.25, -0.85]) body.add(new THREE.Mesh(track(boxAt(0.04, 0.035, 0.2, sx * (pr.width / 2 + 0.03), pr.belt - 0.14, dz)), chrome));
    }
    // side skirt / running board
    const skirt = new THREE.Mesh(track(boxAt(0.12, 0.08, pr.wheelFront - pr.wheelRear - 1.05, sx * (pr.width / 2 - 0.02), pr.bottom + 0.02, (pr.wheelFront + pr.wheelRear) / 2)), shape === 'suv' ? chrome : blackTrim());
    body.add(skirt);
  }

  // --- Greenhouse
  if (pr.cabin) {
    const glass = new THREE.Mesh(track(extrudeSide(pr.cabin, pr.width - 0.2, 0.04)), glassMat);
    glass.renderOrder = 2;
    body.add(glass);
    // pillars
    const hw = (pr.width - 0.2) / 2 + 0.02;
    const [wsB, wsT] = pr.windshield;
    const [rgB, rgT] = pr.rearGlass;
    for (const sx of [-1, 1]) {
      body.add(new THREE.Mesh(track(beam(new THREE.Vector3(sx * hw, wsB[1], wsB[0]), new THREE.Vector3(sx * (hw - 0.04), wsT[1], wsT[0]), 0.07, 0.07)), mods.accent ? accentMat : paintMat));
      body.add(new THREE.Mesh(track(beam(new THREE.Vector3(sx * hw, rgB[1], rgB[0]), new THREE.Vector3(sx * (hw - 0.04), rgT[1], rgT[0]), 0.12, 0.08)), mods.accent ? accentMat : paintMat));
      const bz = (wsT[0] + rgT[0]) / 2 + 0.3;
      body.add(new THREE.Mesh(track(boxAt(0.06, (pr.roof?.y ?? 1.4) - pr.belt, 0.1, sx * hw, (pr.belt + (pr.roof?.y ?? 1.4)) / 2, bz)), blackTrim()));
      if (shape === 'suv') {
        const cz = (bz + rgT[0]) / 2;
        body.add(new THREE.Mesh(track(boxAt(0.06, (pr.roof?.y ?? 1.4) - pr.belt, 0.1, sx * hw, (pr.belt + (pr.roof?.y ?? 1.4)) / 2, cz)), blackTrim()));
      }
      // mirrors
      const mirror = new THREE.Mesh(track(boxAt(0.22, 0.13, 0.12, sx * (pr.width / 2 + 0.1), pr.belt + 0.1, wsB[0] - 0.15)), mods.accent ? accentMat : paintMat);
      body.add(mirror);
    }
    if (pr.roof) {
      const r = pr.roof;
      const roof = new THREE.Mesh(track(boxAt(pr.width - 0.16, 0.05, r.z1 - r.z0, 0, r.y + 0.005, (r.z0 + r.z1) / 2)), mods.accent && shape !== 'suv' ? accentMat : paintMat);
      roof.castShadow = true;
      body.add(roof);
      // panoramic sunroof
      body.add(new THREE.Mesh(track(boxAt(pr.width - 0.6, 0.01, (r.z1 - r.z0) * 0.7, 0, r.y + 0.035, (r.z0 + r.z1) / 2 + 0.05)), blackTrim()));
      if (shape === 'suv') {
        for (const sx of [-1, 1]) body.add(new THREE.Mesh(track(boxAt(0.04, 0.05, (r.z1 - r.z0) * 0.9, sx * (pr.width / 2 - 0.25), r.y + 0.06, (r.z0 + r.z1) / 2)), chrome));
      }
      // headliner (visible from first person)
      const head = new THREE.Mesh(track(boxAt(pr.width - 0.3, 0.02, r.z1 - r.z0 - 0.1, 0, r.y - 0.04, (r.z0 + r.z1) / 2)), interiorMat);
      body.add(head);
    }
  } else {
    // convertible windshield only
    const [b, t] = pr.windshield;
    const ws = new THREE.Mesh(track(beam(new THREE.Vector3(0, b[1], b[0]), new THREE.Vector3(0, t[1], t[0]), pr.width - 0.25, 0.02)), glassMat);
    body.add(ws);
    body.add(new THREE.Mesh(track(beam(new THREE.Vector3(0, t[1], t[0]), new THREE.Vector3(0, t[1] + 0.01, t[0] - 0.02), pr.width - 0.2, 0.05)), chrome));
  }

  // --- Front: grille, lights, bumper (placed on the actual bevelled body surface)
  const BEV = 0.06;
  const zAt = (y: number, front: boolean) => {
    const pts = front ? pr.top : [...pr.top].reverse();
    for (let i = 0; i < pts.length - 1; i++) {
      const [z0, y0] = pts[i], [z1, y1] = pts[i + 1];
      if ((y >= y0 && y <= y1) || (y <= y0 && y >= y1)) {
        const t = Math.abs(y1 - y0) < 1e-6 ? 0 : (y - y0) / (y1 - y0);
        return z0 + (z1 - z0) * t + (front ? BEV : -BEV);
      }
    }
    return front ? pr.length / 2 + BEV : -pr.length / 2 - BEV;
  };
  const gr = pr.grille;
  if (shape === 'suv' || shape === 'sedan' || shape === 'show') {
    const gtex = grilleTexture();
    const grille = new THREE.Mesh(track(new THREE.PlaneGeometry(gr.w, gr.h)), new THREE.MeshStandardMaterial({ map: gtex, metalness: 0.9, roughness: 0.2 }));
    const gz = zAt(gr.y, true) + 0.012;
    grille.position.set(0, gr.y, gz);
    body.add(grille);
    // frame
    const t = 0.04;
    body.add(new THREE.Mesh(track(boxAt(gr.w + t * 2, t, 0.06, 0, gr.y + gr.h / 2, gz)), chrome));
    body.add(new THREE.Mesh(track(boxAt(gr.w + t * 2, t, 0.06, 0, gr.y - gr.h / 2, gz)), chrome));
    body.add(new THREE.Mesh(track(boxAt(t, gr.h, 0.06, -gr.w / 2 - t / 2, gr.y, gz)), chrome));
    body.add(new THREE.Mesh(track(boxAt(t, gr.h, 0.06, gr.w / 2 + t / 2, gr.y, gz)), chrome));
    // emblem / hood star
    const emb = new THREE.Mesh(track(new THREE.TorusGeometry(0.07, 0.012, 8, 24)), chrome);
    emb.position.set(0, gr.y + 0.05, gz + 0.03);
    body.add(emb);
    if (isMaybach) {
      const hood = new THREE.Mesh(track(new THREE.CylinderGeometry(0.004, 0.004, 0.09, 6)), chrome);
      hood.position.set(0, pr.top[3][1] + 0.05, pr.top[3][0] - 0.05);
      body.add(hood);
      const ring = new THREE.Mesh(track(new THREE.TorusGeometry(0.035, 0.006, 6, 18)), chrome);
      ring.position.set(0, pr.top[3][1] + 0.1, pr.top[3][0] - 0.05);
      body.add(ring);
    }
  } else {
    // sporty intake
    body.add(new THREE.Mesh(track(boxAt(gr.w, gr.h, 0.05, 0, gr.y, zAt(gr.y, true))), blackTrim()));
    for (const sx of [-1, 1]) body.add(new THREE.Mesh(track(boxAt(0.35, 0.18, 0.05, sx * (pr.width / 2 - 0.35), gr.y - 0.02, zAt(gr.y - 0.02, true))), blackTrim()));
  }
  // lower intakes (Maybach diamond pattern approximated with chrome-dotted dark panels)
  if (shape === 'suv') {
    for (const sx of [-1, 1]) {
      const iz = zAt(0.52, true);
      body.add(new THREE.Mesh(track(boxAt(0.36, 0.24, 0.04, sx * (pr.width / 2 - 0.32), 0.52, iz)), blackTrim()));
      for (let i = 0; i < 3; i++)
        for (let j = 0; j < 2; j++)
          body.add(new THREE.Mesh(track(boxAt(0.05, 0.05, 0.03, sx * (pr.width / 2 - 0.44 + i * 0.12), 0.47 + j * 0.1, iz + 0.025)), chrome));
    }
    body.add(new THREE.Mesh(track(boxAt(pr.width - 0.5, 0.05, 0.06, 0, 0.36, zAt(0.36, true))), chrome));
  }
  // headlights + DRL
  const L = pr.lights;
  const hz = zAt(L.y, true);
  for (const sx of [-1, 1]) {
    const hl = new THREE.Mesh(track(boxAt(L.w, 0.13, 0.08, sx * L.x, L.y, hz - 0.02)), headMat);
    body.add(hl);
    body.add(new THREE.Mesh(track(boxAt(L.w * 0.95, 0.025, 0.08, sx * L.x, L.y - 0.085, zAt(L.y - 0.085, true) - 0.015)), headMat));
    // chrome headlight surround
    body.add(new THREE.Mesh(track(boxAt(L.w + 0.04, 0.02, 0.07, sx * L.x, L.y + 0.075, hz - 0.025)), chrome));
  }
  // taillights
  const tz = zAt(L.y + 0.02, false);
  for (const sx of [-1, 1]) {
    body.add(new THREE.Mesh(track(boxAt(L.w + 0.05, 0.14, 0.08, sx * (L.x + 0.02), L.y + 0.02, tz + 0.02)), brakeMat));
  }
  body.add(new THREE.Mesh(track(boxAt(pr.width - 0.9, 0.03, 0.06, 0, L.y + 0.02, tz + 0.01)), chrome));
  body.add(new THREE.Mesh(track(boxAt(pr.width - 0.4, 0.05, 0.06, 0, pr.bottom + 0.22, zAt(pr.bottom + 0.22, false) + 0.01)), chrome));
  // exhaust
  for (const sx of [-1, 1]) {
    const ex = new THREE.Mesh(track(new THREE.CylinderGeometry(0.045, 0.045, 0.12, 12)), chrome);
    ex.rotation.x = Math.PI / 2;
    ex.position.set(sx * (pr.width / 2 - 0.45), pr.bottom + 0.08, zAt(pr.bottom + 0.1, false) - 0.02);
    body.add(ex);
  }
  // plates
  const plate = signTexture('LARP 305', { color: '#111', bg: '#f4f4f0', font: '700 56px Arial, sans-serif' });
  const plateMat = new THREE.MeshStandardMaterial({ map: plate.tex, roughness: 0.5 });
  const plateY = shape === 'suv' ? 0.46 : 0.36;
  for (const [z, ry] of [[zAt(plateY, true) + 0.01, 0], [zAt(plateY, false) - 0.01, Math.PI]] as [number, number][]) {
    const p = new THREE.Mesh(track(new THREE.PlaneGeometry(0.52, 0.12)), plateMat);
    p.position.set(0, plateY, z);
    p.rotation.y = ry;
    body.add(p);
  }
  // underbody dark plate
  const under = new THREE.Mesh(track(boxAt(pr.width - 0.25, 0.05, pr.length - 0.3, 0, pr.bottom + 0.02, 0)), plasticMat());
  body.add(under);

  // --- Interior (detailed only)
  let screen: ScreenTexture | null = null;
  let steering: THREE.Object3D | null = null;
  if (detailed) {
    const ix = pr.width / 2 - 0.13;
    // door trims with ambient lighting strip
    for (const sx of [-1, 1]) {
      const trim = new THREE.Mesh(track(boxAt(0.05, pr.belt - pr.bottom - 0.25, pr.wheelFront - pr.wheelRear - 0.6, sx * ix, (pr.belt + pr.bottom + 0.2) / 2, (pr.wheelFront + pr.wheelRear) / 2)), interiorMat);
      body.add(trim);
      const amb = new THREE.Mesh(track(boxAt(0.02, 0.015, pr.wheelFront - pr.wheelRear - 0.7, sx * (ix - 0.03), pr.belt - 0.12, (pr.wheelFront + pr.wheelRear) / 2)), ambientMat());
      body.add(amb);
      body.add(new THREE.Mesh(track(boxAt(0.03, 0.06, pr.wheelFront - pr.wheelRear - 0.7, sx * (ix - 0.02), pr.belt - 0.04, (pr.wheelFront + pr.wheelRear) / 2)), woodMat()));
    }
    // floor
    body.add(new THREE.Mesh(track(boxAt(pr.width - 0.3, 0.04, pr.length - 1.5, 0, pr.bottom + 0.16, -0.2)), plasticMat()));
    // dashboard
    const dz = pr.dashZ;
    const dashH = pr.belt - 0.08;
    body.add(new THREE.Mesh(track(boxAt(pr.width - 0.28, 0.32, 0.5, 0, dashH - 0.1, dz + 0.1)), interiorMat));
    body.add(new THREE.Mesh(track(boxAt(pr.width - 0.3, 0.05, 0.12, 0, dashH - 0.18, dz - 0.16)), woodMat()));
    body.add(new THREE.Mesh(track(boxAt(pr.width - 0.32, 0.015, 0.02, 0, dashH - 0.24, dz - 0.21)), ambientMat()));
    // twin widescreen display
    screen = new ScreenTexture(768, 192);
    const scr = new THREE.Mesh(track(new THREE.PlaneGeometry(1.15, 0.29)), new THREE.MeshBasicMaterial({ map: screen.texture, toneMapped: false }));
    scr.position.set(0.12, dashH + 0.06, dz - 0.02);
    scr.rotation.x = -0.25;
    scr.rotation.y = Math.PI;
    body.add(scr);
    body.add(new THREE.Mesh(track(boxAt(1.2, 0.33, 0.03, 0.12, dashH + 0.06, dz + 0.0)), blackTrim()));
    // vents
    for (let i = 0; i < 4; i++) body.add(new THREE.Mesh(track(new THREE.TorusGeometry(0.045, 0.012, 6, 16)), chrome).translateX(-0.28 + i * 0.19).translateY(dashH - 0.08).translateZ(dz - 0.17));
    // centre console
    body.add(new THREE.Mesh(track(boxAt(0.28, 0.32, 1.3, 0, pr.bottom + 0.42, pr.seatZ - 0.1)), interiorMat));
    body.add(new THREE.Mesh(track(boxAt(0.22, 0.02, 0.9, 0, pr.bottom + 0.59, pr.seatZ)), woodMat()));
    // steering wheel
    const sw = new THREE.Group();
    const rim = new THREE.Mesh(track(new THREE.TorusGeometry(0.19, 0.022, 8, 28)), plasticMat());
    sw.add(rim);
    const hub = new THREE.Mesh(track(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 16)), plasticMat());
    hub.rotation.x = Math.PI / 2;
    sw.add(hub);
    for (const a of [0, 2.1, -2.1]) {
      const sp = new THREE.Mesh(track(boxAt(0.02, 0.17, 0.02, 0, 0.09, 0)), chrome);
      sp.rotation.z = a;
      sw.add(sp);
    }
    const star = new THREE.Mesh(track(new THREE.TorusGeometry(0.03, 0.006, 6, 16)), chrome);
    star.position.z = -0.03;
    sw.add(star);
    const steerHolder = new THREE.Group();
    steerHolder.position.set(pr.eye[0], pr.eye[1] - 0.33, dz - 0.38);
    steerHolder.rotation.x = 0.35;
    steerHolder.add(sw);
    body.add(steerHolder);
    steering = sw;
    // gauge cluster glow
    body.add(new THREE.Mesh(track(boxAt(0.36, 0.12, 0.02, pr.eye[0], dashH + 0.08, dz - 0.03)), new THREE.MeshBasicMaterial({ color: '#0e2333' })));
    // seats
    const seat = (x: number, z: number, exec: boolean) => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(track(boxAt(0.52, 0.16, 0.55, 0, 0.0, 0)), interiorMat));
      const back = new THREE.Mesh(track(boxAt(0.52, 0.7, 0.14, 0, 0.38, -0.25)), interiorMat);
      back.rotation.x = exec ? -0.35 : -0.15;
      g.add(back);
      const hr = new THREE.Mesh(track(boxAt(0.3, 0.2, 0.12, 0, 0.82, exec ? -0.42 : -0.33)), interiorMat);
      g.add(hr);
      if (exec) {
        // pillow + leg rest
        g.add(new THREE.Mesh(track(boxAt(0.3, 0.15, 0.08, 0, 0.72, -0.28)), new THREE.MeshStandardMaterial({ color: '#f8f6f0', roughness: 0.9 })));
        const rest = new THREE.Mesh(track(boxAt(0.46, 0.08, 0.4, 0, -0.08, 0.38)), interiorMat);
        rest.rotation.x = 0.6;
        g.add(rest);
      } else {
        // rear-seat entertainment screen on the back of the front seat (Maybach style)
        const tv = new THREE.Mesh(track(boxAt(0.32, 0.2, 0.02, 0, 0.55, -0.34)), blackTrim());
        g.add(tv);
        const tvs = new THREE.Mesh(track(new THREE.PlaneGeometry(0.29, 0.17)), new THREE.MeshBasicMaterial({ color: '#1d3b5c' }));
        tvs.position.set(0, 0.55, -0.352);
        tvs.rotation.y = Math.PI;
        g.add(tvs);
      }
      g.position.set(x, pr.bottom + 0.42, z);
      body.add(g);
    };
    seat(0.42, pr.seatZ, false);
    seat(-0.42, pr.seatZ, false);
    if (shape === 'suv' || shape === 'sedan' || shape === 'show') {
      seat(0.42, pr.seatZ - 1.2, isMaybach);
      seat(-0.42, pr.seatZ - 1.2, isMaybach);
      if (isMaybach) {
        // executive rear console with champagne flutes
        body.add(new THREE.Mesh(track(boxAt(0.3, 0.42, 0.9, 0, pr.bottom + 0.5, pr.seatZ - 1.2)), interiorMat));
        body.add(new THREE.Mesh(track(boxAt(0.32, 0.02, 0.92, 0, pr.bottom + 0.72, pr.seatZ - 1.2)), woodMat()));
        for (const sx of [-0.07, 0.07]) {
          const flute = new THREE.Mesh(track(new THREE.CylinderGeometry(0.02, 0.012, 0.16, 10)), chrome);
          flute.position.set(sx, pr.bottom + 0.81, pr.seatZ - 1.45);
          body.add(flute);
        }
      }
    }
  }

  // --- Underglow
  const underglowMat = new THREE.MeshBasicMaterial({ map: glowTexture(), color: mods.underglow || '#000', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: mods.underglow ? 0.9 : 0 });
  const underglow = new THREE.Mesh(new THREE.PlaneGeometry(pr.width + 1.6, pr.length + 1.6), underglowMat);
  underglow.rotation.x = -Math.PI / 2;
  underglow.position.y = 0.03;
  underglow.visible = !!mods.underglow;
  root.add(underglow);

  // --- Wheels
  const wheelMounts: THREE.Group[] = [];
  const wheels: THREE.Group[] = [];
  const struts: THREE.Mesh[] = [];
  const wheelPos = [
    { x: pr.track, z: pr.wheelFront },
    { x: -pr.track, z: pr.wheelFront },
    { x: pr.track, z: pr.wheelRear },
    { x: -pr.track, z: pr.wheelRear },
  ];
  const tireGeo = track(new THREE.CylinderGeometry(pr.wheelR, pr.wheelR, 0.3, 28));
  tireGeo.rotateZ(Math.PI / 2);
  const rimGeo = track(rimGeometry(mods.wheels, pr.wheelR));
  const discGeo = track(new THREE.CylinderGeometry(pr.wheelR * 0.55, pr.wheelR * 0.55, 0.03, 20));
  discGeo.rotateZ(Math.PI / 2);
  const strutGeo = track(new THREE.CylinderGeometry(0.035, 0.035, 1, 8));
  strutGeo.translate(0, 0.5, 0);
  for (let i = 0; i < 4; i++) {
    const mount = new THREE.Group();
    mount.position.set(wheelPos[i].x, pr.wheelR, wheelPos[i].z);
    const w = new THREE.Group();
    const tire = new THREE.Mesh(tireGeo, tireMat());
    tire.castShadow = true;
    w.add(tire);
    const rim = new THREE.Mesh(rimGeo, rimMat);
    if (wheelPos[i].x < 0) rim.rotation.y = Math.PI;
    w.add(rim);
    const disc = new THREE.Mesh(discGeo, brakeDiscMat());
    disc.position.x = wheelPos[i].x > 0 ? 0.05 : -0.05;
    mount.add(disc);
    mount.add(w);
    // hydraulic strut (visible when the body lifts)
    const strut = new THREE.Mesh(strutGeo, chrome);
    strut.position.set(wheelPos[i].x > 0 ? -0.12 : 0.12, 0, 0);
    strut.scale.y = 0.2;
    mount.add(strut);
    struts.push(strut);
    root.add(mount);
    wheelMounts.push(mount);
    wheels.push(w);
  }

  mergeByMaterial(body, steering);
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && o !== underglow) (o as THREE.Mesh).castShadow = true;
  });

  const eye = new THREE.Vector3(pr.eye[0], pr.eye[1], pr.eye[2]);
  return {
    root, chassis, body, wheelMounts, wheels, struts, wheelR: pr.wheelR, wheelPos, paintMat, accentMat, glassMat, interiorMat, brakeMat, headMat,
    underglow, underglowMat, rimMat, screen, eye, steering, rideHeight: 0, shape, length: pr.length, width: pr.width, height: dims.height,
    dispose: () => {
      geos.forEach((g) => g.dispose());
      paintMat.dispose();
      accentMat.dispose();
      glassMat.dispose();
      interiorMat.dispose();
      brakeMat.dispose();
      headMat.dispose();
      plateMat.dispose();
      underglowMat.dispose();
      screen?.texture.dispose();
    },
  };
}

/**
 * Collapse all static meshes under `group` that share a material into a single mesh
 * (cuts the player car from ~150 draw calls to ~15). Subtrees in `keep` stay separate.
 */
function mergeByMaterial(group: THREE.Group, keep: THREE.Object3D | null) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const remove: THREE.Mesh[] = [];
  const keepSet = new Set<THREE.Object3D>();
  keep?.traverse((o) => keepSet.add(o));
  if (keep?.parent) keepSet.add(keep.parent);
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || keepSet.has(m) || Array.isArray(m.material)) return;
    const g = m.geometry.clone();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
    const ng = g.index ? g.toNonIndexed() : g;
    for (const name of Object.keys(ng.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') ng.deleteAttribute(name);
    if (!ng.getAttribute('uv')) ng.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(ng.getAttribute('position').count * 2), 2));
    const list = byMat.get(m.material) ?? [];
    list.push(ng);
    byMat.set(m.material, list);
    remove.push(m);
  });
  for (const m of remove) m.removeFromParent();
  for (const [mat, geos] of byMat) {
    const merged = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = true;
    if ((mat as THREE.Material).transparent) mesh.renderOrder = 2;
    group.add(mesh);
  }
}

/** Low-detail single-mesh car for traffic (one draw call, vertex colours). */
export function buildTrafficCar(color: string, kind: number): THREE.Mesh {
  const parts: THREE.BufferGeometry[] = [];
  const col = new THREE.Color(color);
  const dark = new THREE.Color('#111418');
  const glass = new THREE.Color('#1c2733');
  const light = new THREE.Color('#fff4d6');
  const red = new THREE.Color('#c01010');
  const add = (g: THREE.BufferGeometry, c: THREE.Color) => {
    const n = g.getAttribute('position').count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = c.r;
      arr[i * 3 + 1] = c.g;
      arr[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    parts.push(g.toNonIndexed());
  };
  const tall = kind === 0 ? 1.0 : kind === 1 ? 0.75 : 0.6; // suv / sedan / sports
  const len = kind === 0 ? 4.9 : kind === 1 ? 4.7 : 4.4;
  add(boxAt(1.9, 0.6 * tall + 0.25, len, 0, 0.35 + (0.6 * tall + 0.25) / 2, 0), col);
  add(boxAt(1.7, 0.5 * tall + 0.05, len * 0.5, 0, 0.6 + 0.6 * tall + 0.25 / 2 + 0.05, -0.2), glass);
  add(boxAt(1.72, 0.04, len * 0.46, 0, 0.62 + 0.6 * tall + 0.25 / 2 + 0.3 * tall + 0.08, -0.2), col);
  for (const sx of [-1, 1]) {
    add(boxAt(0.35, 0.1, 0.05, sx * 0.65, 0.75, len / 2), light);
    add(boxAt(0.35, 0.1, 0.05, sx * 0.65, 0.8, -len / 2), red);
    for (const sz of [-1, 1]) {
      const w = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12);
      w.rotateZ(Math.PI / 2);
      w.translate(sx * 0.82, 0.36, sz * (len / 2 - 0.85));
      add(w, dark);
    }
  }
  const geo = mergeGeometries(parts, false)!;
  parts.forEach((p) => p.dispose());
  const mesh = new THREE.Mesh(geo, trafficMat());
  mesh.castShadow = true;
  return mesh;
}

const trafficMat = () => shared('traffic', () => new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.4, roughness: 0.4 }));
