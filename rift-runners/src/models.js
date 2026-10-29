import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Low-poly models are built from primitives, baked with vertex colours and merged so each
// model is a single geometry (one draw call per enemy type via instancing).

function part(geo, color, t = {}) {
  let g = geo.index ? geo.toNonIndexed() : geo;
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
const ico = (r, d = 0) => new THREE.IcosahedronGeometry(r, d);
const oct = (r) => new THREE.OctahedronGeometry(r, 0);

// All models face +Z.
export function buildEnemyModels() {
  const models = {};

  // Crawler: hunched violet beetle with spines.
  {
    const body = [part(sphere(0.6), '#4a2370', { sy: 0.62, sz: 1.2, y: 0.48 })];
    body.push(part(sphere(0.38), '#5d2d8c', { y: 0.55, z: 0.62, sy: 0.8 }));
    for (let i = 0; i < 3; i++) body.push(part(cone(0.14, 0.5, 4), '#a347e6', { y: 0.86, z: -0.35 + i * 0.32, rx: -0.4 }));
    for (let s = -1; s <= 1; s += 2) {
      for (let i = 0; i < 3; i++) {
        body.push(part(box(0.7, 0.08, 0.08), '#22102f', { x: s * 0.6, y: 0.28, z: -0.35 + i * 0.35, rz: s * 0.5, ry: s * (i - 1) * 0.35 }));
      }
    }
    const glow = [
      part(sphere(0.09, 5, 3), '#ff4fd8', { x: -0.16, y: 0.66, z: 0.94 }),
      part(sphere(0.09, 5, 3), '#ff4fd8', { x: 0.16, y: 0.66, z: 0.94 }),
      part(box(0.08, 0.04, 0.9), '#d07bff', { y: 0.84, z: -0.05 }),
    ];
    models.crawler = { body: merge(body), glow: merge(glow) };
  }

  // Dasher: sleek teal arrowhead with fins and a thruster.
  {
    const body = [
      part(cone(0.48, 1.7, 5), '#155f6b', { rx: Math.PI / 2, y: 0.6, z: 0.1 }),
      part(box(1.4, 0.08, 0.5), '#2bb7b5', { y: 0.58, z: -0.3 }),
      part(box(0.08, 0.5, 0.6), '#2bb7b5', { y: 0.9, z: -0.45 }),
    ];
    const glow = [
      part(oct(0.13), '#fff47a', { y: 0.72, z: 0.55 }),
      part(cone(0.22, 0.6, 5), '#ffb22e', { rx: -Math.PI / 2, y: 0.6, z: -0.95 }),
    ];
    models.dasher = { body: merge(body), glow: merge(glow) };
  }

  // Spitter: bulbous green spore pod on a stalk.
  {
    const body = [
      part(cyl(0.2, 0.45, 0.6, 6), '#264d1a', { y: 0.3 }),
      part(sphere(0.62, 8, 6), '#3f7d2a', { y: 0.95 }),
      part(cyl(0.22, 0.17, 0.5, 6), '#2e5e1e', { rx: Math.PI / 2, y: 0.95, z: 0.6 }),
    ];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      body.push(part(cone(0.1, 0.35, 4), '#86c94a', { x: Math.cos(a) * 0.5, z: Math.sin(a) * 0.5 - 0.1, y: 1.3, rz: Math.cos(a) * 0.6, rx: -Math.sin(a) * 0.6 }));
    }
    const glow = [
      part(new THREE.TorusGeometry(0.18, 0.06, 4, 8), '#c4ff4a', { y: 0.95, z: 0.86 }),
      part(sphere(0.12, 5, 3), '#c4ff4a', { x: 0.35, y: 1.2, z: 0.35 }),
      part(sphere(0.1, 5, 3), '#c4ff4a', { x: -0.4, y: 1.05, z: 0.3 }),
    ];
    models.spitter = { body: merge(body), glow: merge(glow) };
  }

  // Brute: hulking rock golem with horns and magma cracks.
  {
    const body = [
      part(box(1.5, 1.2, 1.0), '#6b3519', { y: 1.35 }),
      part(box(1.1, 0.5, 0.8), '#5a2a14', { y: 0.65 }),
      part(box(0.7, 0.55, 0.65), '#7d4020', { y: 2.15, z: 0.2 }),
      part(box(0.42, 0.75, 0.42), '#4a220f', { x: -0.4, y: 0.35 }),
      part(box(0.42, 0.75, 0.42), '#4a220f', { x: 0.4, y: 0.35 }),
      part(box(0.55, 0.55, 0.55), '#4a220f', { x: -1.05, y: 0.9, z: 0.25 }),
      part(box(0.55, 0.55, 0.55), '#4a220f', { x: 1.05, y: 0.9, z: 0.25 }),
      part(box(0.38, 0.8, 0.38), '#6b3519', { x: -0.95, y: 1.5 }),
      part(box(0.38, 0.8, 0.38), '#6b3519', { x: 0.95, y: 1.5 }),
      part(cone(0.13, 0.6, 4), '#e6d3a8', { x: -0.38, y: 2.55, z: 0.15, rz: 0.5 }),
      part(cone(0.13, 0.6, 4), '#e6d3a8', { x: 0.38, y: 2.55, z: 0.15, rz: -0.5 }),
    ];
    const glow = [
      part(box(0.14, 0.08, 0.05), '#ff8a1f', { x: -0.16, y: 2.2, z: 0.53 }),
      part(box(0.14, 0.08, 0.05), '#ff8a1f', { x: 0.16, y: 2.2, z: 0.53 }),
      part(box(0.5, 0.12, 0.05), '#ff5a00', { y: 1.5, z: 0.51, rz: 0.3 }),
      part(box(0.3, 0.1, 0.05), '#ff5a00', { x: 0.2, y: 1.2, z: 0.51, rz: -0.5 }),
    ];
    models.brute = { body: merge(body), glow: merge(glow) };
  }

  return models;
}

export function buildPlayerModel(look = {}) {
  const cloak = look.cloak || '#2f5aa8', trim = look.trim || '#3be6ff';
  const hood = new THREE.Color(cloak).offsetHSL(0, 0, 0.05).getStyle();
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const body = [
    part(cone(0.5, 1.15, 7), cloak, { y: 0.6 }),
    part(cyl(0.52, 0.56, 0.1, 7), trim, { y: 0.06 }),
    part(sphere(0.27, 7, 5), '#d9c2a5', { y: 1.28 }),
    part(cone(0.34, 0.55, 7), hood, { y: 1.5, z: -0.05, rx: -0.25 }),
    part(box(0.2, 0.2, 0.55), '#2b3f6b', { x: 0.36, y: 0.85, z: 0.3 }),
    part(box(0.6, 0.06, 0.2), trim, { y: 0.95 }),
  ];
  const bodyMesh = new THREE.Mesh(merge(body), bodyMat);
  bodyMesh.castShadow = true;
  group.add(bodyMesh);

  const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const glow = [
    part(box(0.3, 0.06, 0.06), '#7ff6ff', { y: 1.3, z: 0.24 }),
    part(oct(0.12), '#7ff6ff', { x: 0.36, y: 0.85, z: 0.62 }),
  ];
  group.add(new THREE.Mesh(merge(glow), glowMat));

  // Floating rift shard that orbits the runner.
  const shard = new THREE.Mesh(oct(0.16), new THREE.MeshBasicMaterial({ color: '#b48cff' }));
  shard.scale.y = 1.8;
  group.add(shard);

  // Ground ring helps the player find themself in the chaos.
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.75, 0.9, 28).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: trim, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  ring.position.y = 0.04;
  group.add(ring);

  const shield = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.15, 1),
    new THREE.MeshBasicMaterial({ color: '#59c8ff', transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, wireframe: true })
  );
  shield.position.y = 0.8;
  group.add(shield);

  group.scale.setScalar(1.3);
  return { group, bodyMesh, shard, ring, shield, glowMat, bodyMat };
}

export function buildBossModel() {
  const group = new THREE.Group();
  const shellMat = new THREE.MeshLambertMaterial({ color: '#2a2440', flatShading: true });
  const trimMat = new THREE.MeshLambertMaterial({ color: '#4d3f73', flatShading: true });
  const glowMat = new THREE.MeshBasicMaterial({ color: '#c06bff' });
  const coreMat = new THREE.MeshBasicMaterial({ color: '#f2d9ff' });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.4, 1.6, 8), shellMat);
  base.position.y = 1.2;
  const torso = new THREE.Mesh(new THREE.DodecahedronGeometry(1.9, 0), trimMat);
  torso.position.y = 3.1; torso.scale.set(1, 0.9, 0.85);
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.75, 0), coreMat);
  core.position.set(0, 3.2, 1.35);
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.6, 6), shellMat);
  head.position.y = 5.0;
  const eyes = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.16, 0.2), glowMat);
  eyes.position.set(0, 4.7, 0.62);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.09, 6, 28), glowMat);
  halo.position.y = 5.3; halo.rotation.x = Math.PI / 2.4;

  const body = new THREE.Group();
  body.add(base, torso, core, head, eyes, halo);
  for (let i = 0; i < 6; i++) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.3, 4), trimMat);
    const a = (i / 6) * Math.PI * 2;
    spike.position.set(Math.cos(a) * 1.5, 4.2, Math.sin(a) * 1.3);
    spike.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6);
    body.add(spike);
  }
  for (let s = -1; s <= 1; s += 2) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2.2, 0.7), shellMat);
    arm.position.set(s * 2.4, 2.8, 0.3); arm.rotation.z = s * 0.25;
    const fist = new THREE.Mesh(new THREE.DodecahedronGeometry(0.65, 0), trimMat);
    fist.position.set(s * 2.75, 1.6, 0.5);
    body.add(arm, fist);
  }
  body.traverse((o) => { if (o.isMesh && o.material !== glowMat && o.material !== coreMat) o.castShadow = true; });
  group.add(body);

  const shards = [];
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.4, 0), glowMat);
    s.scale.y = 2;
    group.add(s);
    shards.push(s);
  }
  return { group, body, core, halo, shards, glowMat, coreMat, shellMat };
}
