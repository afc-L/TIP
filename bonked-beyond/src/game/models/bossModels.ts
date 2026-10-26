import * as THREE from 'three';
import type { BossId } from '../../data/types';
import { box, cone, cyl, dodeca, merge, sphere, torus } from './shapes';

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

export function buildBoss(id: BossId): BossRig {
  return id === 'stumpKing' ? stumpKing() : scrapGolem();
}
