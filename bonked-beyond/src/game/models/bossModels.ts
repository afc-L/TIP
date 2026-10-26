import * as THREE from 'three';
import type { BossId } from '../../data/types';
import { box, cone, cyl, dodeca, merge, octa, sphere, torus } from './shapes';

export interface BossRig {
  root: THREE.Group;
  body: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  head: THREE.Group;
  materials: THREE.MeshLambertMaterial[];
  eyeMat: THREE.MeshBasicMaterial;
  spin?: THREE.Object3D[];
}

function addTo(rig: BossRig, parent: THREE.Object3D, geo: THREE.BufferGeometry, color: string) {
  const m = new THREE.MeshLambertMaterial({ color, flatShading: true });
  rig.materials.push(m);
  const mesh = new THREE.Mesh(geo, m);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function stumpKing(): BossRig {
  const g = () => new THREE.Group();
  const rig: BossRig = { root: g(), body: g(), armL: g(), armR: g(), head: g(), materials: [], eyeMat: new THREE.MeshBasicMaterial({ color: '#ffea00' }) };
  rig.root.add(rig.body);
  addTo(rig, rig.body, merge([cyl(1.7, 2.3, 3.2, { p: [0, 1.6, 0] }, 9), cyl(2.3, 2.9, 0.6, { p: [0, 0.3, 0] }, 9)]), '#7f5539');
  addTo(rig, rig.body, merge([
    box(0.5, 2.6, 0.35, { p: [0.9, 1.6, 1.45], r: [0, 0.5, 0.05] }), box(0.4, 2.2, 0.35, { p: [-1.1, 1.5, 1.3], r: [0, -0.6, -0.08] }),
    box(0.45, 2.4, 0.3, { p: [0.2, 1.7, -1.75] }), box(0.4, 2, 0.3, { p: [-1.5, 1.4, -0.9], r: [0, 1.1, 0] }),
  ]), '#5e3a24');
  // rotten face
  addTo(rig, rig.body, merge([box(1.4, 0.35, 0.3, { p: [0, 1.35, 1.75] }), cone(0.12, 0.35, { p: [-0.4, 1.12, 1.82], r: [Math.PI, 0, 0] }), cone(0.12, 0.35, { p: [0.35, 1.12, 1.82], r: [Math.PI, 0, 0] })]), '#2b1a10');
  rig.head.position.set(0, 3.2, 0);
  rig.body.add(rig.head);
  addTo(rig, rig.head, cyl(1.75, 1.75, 0.3, { p: [0, 0.1, 0] }, 9), '#c9a66b'); // tree rings
  addTo(rig, rig.head, torus(1.2, 0.06, { p: [0, 0.27, 0], r: [Math.PI / 2, 0, 0] }), '#a47148');
  const spikes: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    spikes.push(cone(0.3, 1.4 + (i % 2) * 0.6, { p: [Math.cos(a) * 1.35, 0.8, Math.sin(a) * 1.35], r: [Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3] }, 5));
  }
  addTo(rig, rig.head, merge(spikes), '#ffd166');
  addTo(rig, rig.head, merge([sphere(0.7, { p: [1.2, 1.0, 0.3] }), sphere(0.8, { p: [-1.1, 1.1, -0.2] }), sphere(0.6, { p: [0, 1.3, -1] })]), '#386641');
  const eyes = new THREE.Mesh(merge([sphere(0.25, { p: [-0.55, 2.2, 1.78] }), sphere(0.25, { p: [0.55, 2.2, 1.78] })]), rig.eyeMat);
  rig.body.add(eyes);
  for (const [arm, s] of [[rig.armL, -1], [rig.armR, 1]] as const) {
    arm.position.set(2.0 * s, 2.4, 0);
    addTo(rig, arm, merge([
      cyl(0.35, 0.5, 2.4, { p: [0.5 * s, -0.9, 0.3], r: [0.3, 0, 0.5 * s] }, 6),
      cone(0.35, 1, { p: [0.95 * s, -2.3, 0.6], r: [Math.PI + 0.2, 0, 0.3 * s] }, 5),
      cone(0.22, 0.8, { p: [0.4 * s, -2.2, 0.9], r: [Math.PI + 0.4, 0, -0.2 * s] }, 5),
    ]), '#6f4518');
    rig.body.add(arm);
  }
  rig.root.scale.setScalar(1);
  return rig;
}

function scrapGolem(): BossRig {
  const g = () => new THREE.Group();
  const rig: BossRig = { root: g(), body: g(), armL: g(), armR: g(), head: g(), materials: [], eyeMat: new THREE.MeshBasicMaterial({ color: '#4cc9f0' }), spin: [] };
  rig.root.add(rig.body);
  addTo(rig, rig.body, merge([box(2.8, 2.4, 2, { p: [0, 3.2, 0] }), box(2, 1, 1.6, { p: [0, 1.7, 0] })]), '#8d99ae');
  addTo(rig, rig.body, merge([box(0.9, 1.6, 0.9, { p: [-0.8, 0.8, 0] }), box(0.9, 1.6, 0.9, { p: [0.8, 0.8, 0] }), box(1.1, 0.3, 1.3, { p: [-0.8, 0.15, 0.15] }), box(1.1, 0.3, 1.3, { p: [0.8, 0.15, 0.15] })]), '#495057');
  addTo(rig, rig.body, merge([box(2.2, 0.25, 0.2, { p: [0, 3.9, 1.05] }), box(0.25, 1.8, 0.2, { p: [-0.9, 3.1, 1.05] }), box(0.25, 1.8, 0.2, { p: [0.9, 3.1, 1.05] }), box(1, 0.6, 0.3, { p: [0.2, 2.6, 1.05], r: [0, 0, 0.3] })]), '#bc6c25');
  addTo(rig, rig.body, merge([cyl(0.12, 0.12, 0.25, { p: [-0.6, 3.2, 1.12], r: [Math.PI / 2, 0, 0] }, 6), cyl(0.12, 0.12, 0.25, { p: [0.5, 3.6, 1.12], r: [Math.PI / 2, 0, 0] }, 6), cyl(0.12, 0.12, 0.25, { p: [0.1, 2.3, 1.12], r: [Math.PI / 2, 0, 0] }, 6)]), '#ffd166');
  // exhaust pipes
  addTo(rig, rig.body, merge([cyl(0.22, 0.22, 1.4, { p: [-0.8, 4.8, -0.7] }, 7), cyl(0.18, 0.18, 1.1, { p: [0.7, 4.7, -0.8] }, 7)]), '#343a40');
  rig.head.position.set(0, 4.75, 0.2);
  rig.body.add(rig.head);
  addTo(rig, rig.head, box(1.3, 0.9, 1.1, {}), '#adb5bd');
  const eye = new THREE.Mesh(sphere(0.3, { p: [0, 0, 0.55] }), rig.eyeMat);
  rig.head.add(eye);
  addTo(rig, rig.head, merge([torus(0.36, 0.08, { p: [0, 0, 0.56] }), box(0.08, 0.6, 0.08, { p: [0.45, 0.65, 0] })]), '#495057');
  for (const [arm, s] of [[rig.armL, -1], [rig.armR, 1]] as const) {
    arm.position.set(1.8 * s, 3.9, 0);
    const gear = new THREE.Group();
    addTo(rig, gear, merge([cyl(0.7, 0.7, 0.4, { r: [0, 0, Math.PI / 2] }, 10), ...Array.from({ length: 8 }, (_, i) => box(0.3, 0.3, 0.3, { p: [0, Math.cos(i * Math.PI / 4) * 0.8, Math.sin(i * Math.PI / 4) * 0.8] }))]), '#ffb627');
    gear.position.set(0.2 * s, 0, 0);
    arm.add(gear);
    rig.spin!.push(gear);
    addTo(rig, arm, merge([box(0.7, 2.2, 0.7, { p: [0.45 * s, -1.4, 0] }), box(1.1, 1, 1.1, { p: [0.5 * s, -2.9, 0.1] })]), '#6c757d');
    addTo(rig, arm, merge([dodeca(0.35, { p: [0.5 * s, -3.5, 0.5] }), box(0.2, 0.6, 0.2, { p: [0.9 * s, -3.4, 0.4] })]), '#343a40');
    rig.body.add(arm);
  }
  return rig;
}

function voidDevourer(): BossRig {
  const g = () => new THREE.Group();
  const rig: BossRig = { root: g(), body: g(), armL: g(), armR: g(), head: g(), materials: [], eyeMat: new THREE.MeshBasicMaterial({ color: '#ff006e' }), spin: [] };
  rig.root.add(rig.body);
  rig.body.position.y = 3;
  addTo(rig, rig.body, sphere(2.1, {}, 1), '#240046');
  addTo(rig, rig.body, merge([...Array.from({ length: 9 }, (_, i) => { const a = (i / 9) * Math.PI * 2; return cone(0.35, 1.4, { p: [Math.cos(a) * 1.8, 0.6, Math.sin(a) * 1.8], r: [Math.sin(a) * 0.8, 0, -Math.cos(a) * 0.8] }, 5); })]), '#5a189a');
  // gaping maw with teeth
  const maw = new THREE.Mesh(sphere(1.0, { p: [0, -0.2, 1.65], s: [1.2, 0.8, 0.5] }), new THREE.MeshBasicMaterial({ color: '#10002b' }));
  rig.body.add(maw);
  addTo(rig, rig.body, merge(Array.from({ length: 8 }, (_, i) => cone(0.12, 0.45, { p: [-0.9 + i * 0.26, 0.35, 1.9], r: [Math.PI, 0, 0] }, 4))), '#f8f9fa');
  rig.body.add(new THREE.Mesh(sphere(0.35, { p: [0, 1.2, 1.75] }), rig.eyeMat));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3, 0.12, 6, 40), new THREE.MeshBasicMaterial({ color: '#c77dff' }));
  ring.rotation.x = Math.PI / 2.4;
  rig.body.add(ring);
  rig.spin!.push(ring);
  for (const [arm, sd] of [[rig.armL, -1], [rig.armR, 1]] as const) {
    arm.position.set(1.6 * sd, -0.8, 0);
    addTo(rig, arm, merge([cyl(0.3, 0.15, 2.5, { p: [0.2 * sd, -1.2, 0], r: [0, 0, 0.3 * sd] }, 6), sphere(0.3, { p: [0.55 * sd, -2.4, 0] })]), '#3c096c');
    rig.body.add(arm);
  }
  return rig;
}

function goldenExecutioner(): BossRig {
  const g = () => new THREE.Group();
  const rig: BossRig = { root: g(), body: g(), armL: g(), armR: g(), head: g(), materials: [], eyeMat: new THREE.MeshBasicMaterial({ color: '#ffea00' }) };
  rig.root.add(rig.body);
  addTo(rig, rig.body, merge([box(2.0, 2.2, 1.3, { p: [0, 2.9, 0] }), box(1.6, 0.9, 1.1, { p: [0, 1.55, 0] })]), '#ffb703');
  addTo(rig, rig.body, merge([box(0.65, 1.6, 0.65, { p: [-0.55, 0.8, 0] }), box(0.65, 1.6, 0.65, { p: [0.55, 0.8, 0] })]), '#6c4a00');
  addTo(rig, rig.body, merge([sphere(0.6, { p: [-1.25, 3.8, 0], s: [1, 0.7, 1] }), sphere(0.6, { p: [1.25, 3.8, 0], s: [1, 0.7, 1] }), box(2.1, 0.25, 1.4, { p: [0, 2.0, 0] })]), '#fb8500');
  addTo(rig, rig.body, box(1.6, 3.2, 0.1, { p: [0, 2.4, -0.75] }), '#9d0208'); // cape
  rig.head.position.set(0, 4.4, 0.05);
  rig.body.add(rig.head);
  addTo(rig, rig.head, merge([box(0.9, 1.0, 0.9), cone(0.5, 0.6, { p: [0, 0.75, 0] }, 4)]), '#ffd166');
  rig.head.add(new THREE.Mesh(box(0.6, 0.1, 0.05, { p: [0, 0.05, 0.47] }), rig.eyeMat));
  for (const [arm, sd] of [[rig.armL, -1], [rig.armR, 1]] as const) {
    arm.position.set(1.35 * sd, 3.7, 0);
    addTo(rig, arm, merge([box(0.55, 1.9, 0.55, { p: [0.15 * sd, -1.0, 0] }), sphere(0.38, { p: [0.15 * sd, -2.05, 0] })]), '#ffb703');
    rig.body.add(arm);
  }
  // headsman's axe in the right hand
  addTo(rig, rig.armR, merge([cyl(0.1, 0.1, 3.6, { p: [0.2, -2.0, 0.9], r: [Math.PI / 2, 0, 0] }, 6)]), '#4a2c1a');
  addTo(rig, rig.armR, merge([box(0.2, 1.6, 1.2, { p: [0.2, -1.3, 2.6] })]), '#e9ecef');
  return rig;
}

function crystalColossus(): BossRig {
  const g = () => new THREE.Group();
  const rig: BossRig = { root: g(), body: g(), armL: g(), armR: g(), head: g(), materials: [], eyeMat: new THREE.MeshBasicMaterial({ color: '#ff4ecd' }), spin: [] };
  rig.root.add(rig.body);
  addTo(rig, rig.body, merge([dodeca(1.6, { p: [0, 2.6, 0], s: [1, 1.2, 0.9] }), dodeca(0.8, { p: [-0.6, 0.8, 0] }), dodeca(0.8, { p: [0.6, 0.8, 0] })]), '#5e548e');
  const crystalMat = new THREE.MeshLambertMaterial({ color: '#4cc9f0', emissive: '#1b6ca8', emissiveIntensity: 0.6, flatShading: true });
  rig.materials.push(crystalMat);
  const crystals = new THREE.Mesh(merge([
    octa(0.6, { p: [0, 4.1, 0], s: [0.6, 1.8, 0.6] }), octa(0.5, { p: [-1.0, 3.6, -0.2], s: [0.6, 1.6, 0.6], r: [0, 0, 0.5] }), octa(0.5, { p: [1.0, 3.6, -0.2], s: [0.6, 1.6, 0.6], r: [0, 0, -0.5] }),
    octa(0.4, { p: [-0.4, 3.4, -1.0], s: [0.6, 1.5, 0.6], r: [-0.5, 0, 0] }), octa(0.4, { p: [0.5, 3.3, -0.9], s: [0.6, 1.5, 0.6], r: [-0.4, 0, 0] }),
  ]), crystalMat);
  crystals.castShadow = true;
  rig.body.add(crystals);
  rig.head.position.set(0, 3.2, 1.0);
  rig.body.add(rig.head);
  rig.head.add(new THREE.Mesh(octa(0.35, {}), rig.eyeMat));
  for (const [arm, sd] of [[rig.armL, -1], [rig.armR, 1]] as const) {
    arm.position.set(1.7 * sd, 3.0, 0);
    addTo(rig, arm, merge([dodeca(0.6, { p: [0.2 * sd, -0.8, 0] }), dodeca(0.7, { p: [0.3 * sd, -2.0, 0.2] })]), '#5e548e');
    const c = new THREE.Mesh(octa(0.4, { p: [0.4 * sd, -2.4, 0.6], s: [0.6, 1.4, 0.6] }), crystalMat);
    arm.add(c);
    rig.body.add(arm);
  }
  return rig;
}

export function buildBoss(id: BossId): BossRig {
  switch (id) {
    case 'stumpKing': return stumpKing();
    case 'scrapGolem': return scrapGolem();
    case 'voidDevourer': return voidDevourer();
    case 'goldenExecutioner': return goldenExecutioner();
    case 'crystalColossus': return crystalColossus();
  }
}
