import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Same baking approach as models.js: primitives -> vertex coloured -> merged geometry.
function part(geo, color, t = {}) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute('uv');
  g.scale(t.sx ?? 1, t.sy ?? 1, t.sz ?? 1);
  if (t.rx) g.rotateX(t.rx);
  if (t.rz) g.rotateZ(t.rz);
  if (t.ry) g.rotateY(t.ry);
  g.translate(t.x ?? 0, t.y ?? 0, t.z ?? 0);
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}
function merge(parts) {
  const g = mergeGeometries(parts);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}
const sphere = (r, w = 7, h = 5) => new THREE.SphereGeometry(r, w, h);
const box = (x, y, z) => new THREE.BoxGeometry(x, y, z);
const cone = (r, h, s = 6) => new THREE.ConeGeometry(r, h, s);
const cyl = (rt, rb, h, s = 6) => new THREE.CylinderGeometry(rt, rb, h, s);
const oct = (r) => new THREE.OctahedronGeometry(r, 0);
const torus = (r, t, a = 4, b = 10) => new THREE.TorusGeometry(r, t, a, b);

export function buildExtraEnemyModels() {
  const m = {};

  // Rift Stalker: thin, hunched shade with long blade arms.
  m.stalker = {
    body: merge([
      part(cone(0.42, 1.4, 5), '#2a1748', { y: 0.75 }),
      part(sphere(0.26, 6, 4), '#3b2160', { y: 1.5, z: 0.12 }),
      part(box(0.08, 0.08, 1.0), '#1a0e30', { x: -0.42, y: 0.9, z: 0.45, ry: 0.3 }),
      part(box(0.08, 0.08, 1.0), '#1a0e30', { x: 0.42, y: 0.9, z: 0.45, ry: -0.3 }),
    ]),
    glow: merge([
      part(box(0.05, 0.05, 0.9), '#c99bff', { x: -0.48, y: 0.98, z: 0.5, ry: 0.3 }),
      part(box(0.05, 0.05, 0.9), '#c99bff', { x: 0.48, y: 0.98, z: 0.5, ry: -0.3 }),
      part(box(0.28, 0.05, 0.05), '#f0d6ff', { y: 1.55, z: 0.36 }),
    ]),
  };

  // Splitter: lumpy pink blob made of two halves with a glowing seam.
  m.splitter = {
    body: merge([
      part(sphere(0.55, 7, 5), '#9a2a63', { x: -0.3, y: 0.6 }),
      part(sphere(0.55, 7, 5), '#b03474', { x: 0.3, y: 0.6 }),
      part(sphere(0.3, 6, 4), '#7c1f50', { y: 1.05, z: 0.1 }),
    ]),
    glow: merge([
      part(box(0.08, 0.9, 0.9), '#ff8ac5', { y: 0.65 }),
      part(sphere(0.08, 4, 3), '#ffe0f0', { x: -0.18, y: 0.8, z: 0.5 }),
      part(sphere(0.08, 4, 3), '#ffe0f0', { x: 0.18, y: 0.8, z: 0.5 }),
    ]),
  };

  // Void Priest: robed figure with a floating halo and staff.
  m.priest = {
    body: merge([
      part(cone(0.6, 1.6, 7), '#241a52', { y: 0.8 }),
      part(sphere(0.25, 6, 4), '#1a1340', { y: 1.75 }),
      part(cone(0.3, 0.5, 6), '#2e2266', { y: 2.0 }),
      part(cyl(0.04, 0.04, 2.2, 4), '#5a4a8a', { x: 0.55, y: 1.1 }),
    ]),
    glow: merge([
      part(torus(0.34, 0.04, 4, 14), '#a58cff', { y: 2.3, rx: Math.PI / 2 }),
      part(oct(0.17), '#d8c8ff', { x: 0.55, y: 2.3 }),
      part(box(0.22, 0.05, 0.05), '#d8c8ff', { y: 1.76, z: 0.22 }),
    ]),
  };

  // Bombardier: squat mortar beetle with a big barrel on its back.
  m.bombardier = {
    body: merge([
      part(sphere(0.65, 7, 5), '#6a4a12', { sy: 0.6, y: 0.5 }),
      part(cyl(0.3, 0.38, 0.9, 7), '#3a2a0e', { y: 1.0, z: -0.15, rx: -0.5 }),
      part(box(0.9, 0.12, 0.2), '#2a1e0a', { y: 0.3, z: 0.3 }),
      part(box(0.9, 0.12, 0.2), '#2a1e0a', { y: 0.3, z: -0.3 }),
    ]),
    glow: merge([
      part(torus(0.3, 0.06, 4, 10), '#ffb02e', { y: 1.38, z: 0.05, rx: Math.PI / 2 - 0.5 }),
      part(sphere(0.07, 4, 3), '#ffe28a', { x: -0.2, y: 0.62, z: 0.6 }),
      part(sphere(0.07, 4, 3), '#ffe28a', { x: 0.2, y: 0.62, z: 0.6 }),
    ]),
  };

  // Mirror Knight: armoured humanoid; the mirror shield is the glow part so it can dim.
  m.knight = {
    body: merge([
      part(box(0.8, 0.9, 0.5), '#4a5670', { y: 1.25 }),
      part(box(0.5, 0.7, 0.4), '#39445a', { y: 0.45 }),
      part(box(0.42, 0.45, 0.42), '#5a6886', { y: 1.95 }),
      part(cone(0.1, 0.4, 4), '#9aa8c4', { y: 2.35 }),
      part(box(0.08, 0.08, 1.3), '#c9d2e4', { x: 0.55, y: 1.1, z: 0.4 }),
    ]),
    glow: merge([
      part(box(1.05, 1.2, 0.08), '#cfe6ff', { y: 1.2, z: 0.48 }),
      part(box(0.3, 0.05, 0.05), '#7fe8ff', { y: 1.98, z: 0.22 }),
    ]),
  };

  // Soul Leech: floating lamprey with a ring of teeth.
  m.leech = {
    body: merge([
      part(sphere(0.38, 7, 5), '#4a0f1e', { sz: 1.6, y: 0.9 }),
      part(cone(0.22, 0.6, 5), '#33091a', { rx: -Math.PI / 2, y: 0.9, z: -0.75 }),
    ]),
    glow: merge([
      part(torus(0.2, 0.06, 4, 10), '#ff3355', { y: 0.9, z: 0.58 }),
      part(sphere(0.06, 4, 3), '#ff9ab0', { y: 1.15, z: 0.35 }),
    ]),
  };

  // Engineer devices
  m.turret = {
    body: merge([
      part(cyl(0.6, 0.75, 0.5, 8), '#3a3f4a', { y: 0.25 }),
      part(sphere(0.45, 7, 5), '#566070', { y: 0.75 }),
      part(cyl(0.1, 0.12, 0.8, 6), '#2a2e36', { rx: Math.PI / 2, y: 0.8, z: 0.5 }),
    ]),
    glow: merge([part(sphere(0.12, 5, 3), '#ffd166', { y: 0.95, z: 0.32 }), part(torus(0.62, 0.05, 4, 16), '#ffd166', { y: 0.5, rx: Math.PI / 2 })]),
  };
  m.pylon = {
    body: merge([
      part(cyl(0.5, 0.6, 0.4, 6), '#2e3a48', { y: 0.2 }),
      part(cyl(0.12, 0.2, 1.8, 6), '#3e4c5e', { y: 1.2 }),
    ]),
    glow: merge([part(oct(0.35), '#5ad1ff', { y: 2.35, sy: 1.4 }), part(torus(0.4, 0.05, 4, 12), '#5ad1ff', { y: 1.4, rx: Math.PI / 2 })]),
  };
  m.mine = {
    body: merge([part(cyl(0.38, 0.45, 0.2, 8), '#2a2a30', { y: 0.1 })]),
    glow: merge([part(sphere(0.14, 5, 3), '#ff4d6d', { y: 0.25 }), part(torus(0.34, 0.03, 3, 12), '#ff4d6d', { y: 0.2, rx: Math.PI / 2 })]),
  };
  return m;
}

export function buildDevourerModel() {
  const group = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: '#3d2a1c', flatShading: true });
  const plate = new THREE.MeshLambertMaterial({ color: '#6a4228', flatShading: true });
  const glowMat = new THREE.MeshBasicMaterial({ color: '#9dff3a' });
  const head = new THREE.Group();
  const skull = new THREE.Mesh(new THREE.DodecahedronGeometry(1.7, 0), plate);
  skull.scale.set(1.1, 0.85, 1.3); skull.position.y = 1.7;
  const jaw = new THREE.Mesh(new THREE.ConeGeometry(1.1, 1.6, 6), skin);
  jaw.rotation.x = Math.PI / 2; jaw.position.set(0, 1.3, 1.7);
  head.add(skull, jaw);
  for (let i = 0; i < 6; i++) {
    const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.5, 4), new THREE.MeshLambertMaterial({ color: '#e8dcc0' }));
    const a = (i / 6) * Math.PI * 2;
    tooth.position.set(Math.cos(a) * 0.6, 1.3 + Math.sin(a) * 0.6, 2.3);
    tooth.rotation.x = Math.PI / 2;
    head.add(tooth);
  }
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 4), glowMat);
    eye.position.set(s * 0.7, 2.2, 1.2);
    head.add(eye);
  }
  head.traverse((o) => { if (o.isMesh && o.material !== glowMat) o.castShadow = true; });
  group.add(head);
  const segments = [];
  for (let i = 0; i < 6; i++) {
    const r = 1.4 - i * 0.16;
    const seg = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), i % 2 ? skin : plate);
    seg.castShadow = true;
    const spine = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.8, 4), glowMat);
    spine.position.y = r * 0.9;
    seg.add(spine);
    segments.push(seg);
  }
  return { group, head, segments, glowMat, plate };
}

export function buildEngineerModel() {
  const group = new THREE.Group();
  const metal = new THREE.MeshLambertMaterial({ color: '#4a4f5c', flatShading: true });
  const dark = new THREE.MeshLambertMaterial({ color: '#2a2d36', flatShading: true });
  const glowMat = new THREE.MeshBasicMaterial({ color: '#ffd166' });
  const body = new THREE.Group();
  const legs = [-1, 1].map((s) => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.4, 0.5), dark); l.position.set(s * 0.5, 0.7, 0); return l; });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.2, 1.0), metal); torso.position.y = 1.9;
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 0.6, 6), dark); head.position.y = 2.8;
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.14, 0.1), glowMat); visor.position.set(0, 2.85, 0.48);
  const pack = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 0.6), dark); pack.position.set(0, 2.0, -0.75);
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 4), metal); antenna.position.set(0.35, 3.0, -0.8);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.1, 5, 3), glowMat); tip.position.set(0.35, 3.6, -0.8);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 1.3), metal); arm.position.set(0.95, 1.9, 0.4);
  const wrench = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.08, 4, 8, Math.PI * 1.5), glowMat); wrench.position.set(-0.95, 1.6, 0.5);
  body.add(...legs, torso, head, visor, pack, antenna, tip, arm, wrench);
  body.traverse((o) => { if (o.isMesh && o.material !== glowMat) o.castShadow = true; });
  group.add(body);
  const bubble = new THREE.Mesh(new THREE.IcosahedronGeometry(2.2, 1), new THREE.MeshBasicMaterial({ color: '#5ad1ff', transparent: true, opacity: 0.25, wireframe: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  bubble.position.y = 1.8;
  group.add(bubble);
  return { group, body, glowMat, metal, bubble };
}

// Interactables: shrine pillar and supply portal.
export function buildShrineModel() {
  const g = new THREE.Group();
  const stone = new THREE.MeshLambertMaterial({ color: '#4a3f66', flatShading: true });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 0.4, 8), stone); base.position.y = 0.2;
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 2.4, 6), stone); pillar.position.y = 1.6;
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), new THREE.MeshBasicMaterial({ color: '#ffd36b' }));
  gem.position.y = 3.3; gem.scale.y = 1.5;
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.6, 1.8, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffd36b', transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
  ring.position.y = 0.06;
  g.add(base, pillar, gem, ring);
  return { group: g, gem, ring };
}

export function buildPortalModel() {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.14, 6, 24), new THREE.MeshBasicMaterial({ color: '#7dffcf' }));
  frame.position.y = 1.7;
  const fill = new THREE.Mesh(new THREE.CircleGeometry(1.3, 24), new THREE.MeshBasicMaterial({ color: '#1fb38a', transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }));
  fill.position.y = 1.7;
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.6, 1.8, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#7dffcf', transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
  ring.position.y = 0.06;
  g.add(frame, fill, ring);
  return { group: g, frame, fill, ring };
}
