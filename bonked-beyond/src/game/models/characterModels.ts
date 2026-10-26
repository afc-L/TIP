// Procedural low-poly player characters with simple pivots for animation.
import * as THREE from 'three';
import type { CharacterId } from '../../data/types';
import { box, capsule, cone, cyl, merge, sphere, torus } from './shapes';

export interface CharacterRig {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  prop: THREE.Group;     // held item in right hand
  tail?: THREE.Group;
  extra?: THREE.Object3D; // scarf / cape
  materials: THREE.MeshLambertMaterial[];
  hipY: number;
  height: number;
}

function makeRig(): CharacterRig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const g = () => new THREE.Group();
  return { root, body, head: g(), armL: g(), armR: g(), legL: g(), legR: g(), prop: g(), materials: [], hipY: 0.8, height: 1.8 };
}

function add(rig: CharacterRig, parent: THREE.Object3D, geo: THREE.BufferGeometry, color: THREE.ColorRepresentation, glowing = false): THREE.Mesh {
  let material: THREE.Material;
  if (glowing) material = new THREE.MeshBasicMaterial({ color });
  else {
    const m = new THREE.MeshLambertMaterial({ color, flatShading: true });
    rig.materials.push(m);
    material = m;
  }
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

/** Shared humanoid skeleton: places pivots and attaches them to the body. */
function skeleton(rig: CharacterRig, hipY: number, shoulderY: number, shoulderX: number, hipX: number, headY: number) {
  rig.hipY = hipY;
  rig.legL.position.set(-hipX, hipY, 0);
  rig.legR.position.set(hipX, hipY, 0);
  rig.armL.position.set(-shoulderX, shoulderY, 0);
  rig.armR.position.set(shoulderX, shoulderY, 0);
  rig.head.position.set(0, headY, 0);
  rig.body.add(rig.legL, rig.legR, rig.armL, rig.armR, rig.head);
}

function eyes(rig: CharacterRig, parent: THREE.Object3D, y: number, z: number, spread: number, size: number, pupil = '#1b1b1b') {
  add(rig, parent, merge([sphere(size, { p: [-spread, y, z] }), sphere(size, { p: [spread, y, z] })]), '#ffffff');
  add(rig, parent, merge([sphere(size * 0.55, { p: [-spread, y, z + size * 0.6] }), sphere(size * 0.55, { p: [spread, y, z + size * 0.6] })]), pupil);
}

function bonker(): CharacterRig {
  const r = makeRig();
  skeleton(r, 0.78, 1.38, 0.52, 0.22, 1.62);
  add(r, r.body, capsule(0.44, 0.35, { p: [0, 1.12, 0], s: [1, 1, 0.85] }), '#ff9f1c');
  add(r, r.body, box(0.95, 0.14, 0.7, { p: [0, 0.86, 0] }), '#6b3e1f');           // belt
  add(r, r.body, box(0.22, 0.16, 0.08, { p: [0, 0.86, 0.36] }), '#ffd166');       // buckle
  add(r, r.head, sphere(0.34, { p: [0, 0.1, 0] }), '#ffcc99');
  add(r, r.head, merge([sphere(0.37, { p: [0, 0.2, 0], s: [1, 0.75, 1] }), box(0.8, 0.06, 0.8, { p: [0, 0.1, 0] })]), '#c1121f'); // helmet
  add(r, r.head, merge([cone(0.08, 0.28, { p: [-0.32, 0.4, 0], r: [0, 0, 0.6] }), cone(0.08, 0.28, { p: [0.32, 0.4, 0], r: [0, 0, -0.6] })]), '#fff3d6');
  eyes(r, r.head, 0.08, 0.28, 0.12, 0.07);
  add(r, r.head, box(0.18, 0.05, 0.05, { p: [0, -0.07, 0.31] }), '#7a3b16');      // mustache
  for (const [arm, s] of [[r.armL, -1], [r.armR, 1]] as const) {
    add(r, arm, capsule(0.14, 0.38, { p: [0.05 * s, -0.3, 0] }), '#ffcc99');
    add(r, arm, sphere(0.17, { p: [0.05 * s, -0.62, 0] }), '#8a5a2b');            // glove
  }
  for (const leg of [r.legL, r.legR]) {
    add(r, leg, capsule(0.16, 0.38, { p: [0, -0.32, 0] }), '#3a506b');
    add(r, leg, box(0.3, 0.16, 0.42, { p: [0, -0.72, 0.06] }), '#2b2d42');
  }
  // giant hammer in the right hand
  r.prop.position.set(0.05, -0.62, 0);
  add(r, r.prop, cyl(0.06, 0.06, 1.2, { p: [0, 0.35, 0.15], r: [Math.PI / 2.4, 0, 0] }), '#8a5a2b');
  add(r, r.prop, box(0.5, 0.5, 0.8, { p: [0, 0.6, 0.75], r: [Math.PI / 2.4, 0, 0] }), '#adb5bd');
  add(r, r.prop, box(0.52, 0.12, 0.82, { p: [0, 0.6, 0.75], r: [Math.PI / 2.4, 0, 0] }), '#ffb627');
  r.armR.add(r.prop);
  r.height = 2;
  return r;
}

function runner(): CharacterRig {
  const r = makeRig();
  skeleton(r, 0.85, 1.42, 0.38, 0.16, 1.66);
  add(r, r.body, capsule(0.3, 0.42, { p: [0, 1.15, 0], s: [1, 1, 0.8] }), '#2ec4b6');
  add(r, r.body, box(0.62, 0.08, 0.46, { p: [0, 0.9, 0] }), '#011627');
  add(r, r.body, box(0.36, 0.4, 0.2, { p: [0, 1.2, -0.3] }), '#ff9f1c');             // pouch
  add(r, r.head, sphere(0.28, { p: [0, 0.08, 0] }), '#e0a370');
  add(r, r.head, merge([sphere(0.3, { p: [0, 0.18, -0.04], s: [1, 0.75, 1] })]), '#3d2b1f'); // hair
  add(r, r.head, torus(0.29, 0.05, { p: [0, 0.18, 0], r: [Math.PI / 2, 0, 0] }), '#ffffff');  // headband
  eyes(r, r.head, 0.06, 0.24, 0.1, 0.06);
  const scarf = new THREE.Group();
  scarf.position.set(0, 1.45, -0.15);
  add(r, scarf, box(0.16, 0.05, 0.75, { p: [0, 0, -0.35] }), '#e71d36');
  r.body.add(scarf);
  r.extra = scarf;
  for (const [arm, s] of [[r.armL, -1], [r.armR, 1]] as const) {
    add(r, arm, capsule(0.1, 0.42, { p: [0.03 * s, -0.3, 0] }), '#e0a370');
    add(r, arm, box(0.18, 0.1, 0.18, { p: [0.03 * s, -0.12, 0] }), '#2ec4b6');
  }
  for (const leg of [r.legL, r.legR]) {
    add(r, leg, capsule(0.12, 0.48, { p: [0, -0.36, 0] }), '#011627');
    add(r, leg, box(0.22, 0.14, 0.4, { p: [0, -0.8, 0.07] }), '#ff3366');
    add(r, leg, box(0.24, 0.05, 0.42, { p: [0, -0.86, 0.07] }), '#ffffff');
  }
  r.prop.position.set(0.03, -0.6, 0);
  add(r, r.prop, merge([box(0.05, 0.05, 0.4, { p: [0, 0, 0.25] }), box(0.12, 0.04, 0.04, { p: [0, 0, 0.05] })]), '#e0e1dd');
  r.armR.add(r.prop);
  return r;
}

function scrapRat(): CharacterRig {
  const r = makeRig();
  skeleton(r, 0.6, 1.08, 0.36, 0.16, 1.3);
  add(r, r.body, capsule(0.34, 0.3, { p: [0, 0.88, 0], s: [1, 1, 0.9] }), '#9d8ec4');
  add(r, r.body, box(0.6, 0.12, 0.55, { p: [0, 0.66, 0] }), '#5a4636');
  add(r, r.body, merge([box(0.5, 0.55, 0.3, { p: [0, 0.95, -0.38] }), cyl(0.12, 0.12, 0.6, { p: [0.15, 1.35, -0.4] }, 6)]), '#6c757d'); // backpack + chimney
  add(r, r.body, torus(0.15, 0.05, { p: [-0.15, 1.1, -0.55] }), '#ffd166'); // gear
  add(r, r.head, sphere(0.3, { p: [0, 0.08, 0.02], s: [1, 0.95, 1.1] }), '#b8a9e0');
  add(r, r.head, cone(0.17, 0.32, { p: [0, 0.02, 0.36], r: [Math.PI / 2, 0, 0] }), '#b8a9e0'); // snout
  add(r, r.head, sphere(0.07, { p: [0, 0.02, 0.53] }), '#ff8fab');
  add(r, r.head, merge([sphere(0.2, { p: [-0.26, 0.36, -0.02], s: [1, 1, 0.35] }), sphere(0.2, { p: [0.26, 0.36, -0.02], s: [1, 1, 0.35] })]), '#b8a9e0');
  add(r, r.head, merge([sphere(0.12, { p: [-0.26, 0.36, 0.03], s: [1, 1, 0.3] }), sphere(0.12, { p: [0.26, 0.36, 0.03], s: [1, 1, 0.3] })]), '#ff8fab');
  add(r, r.head, merge([torus(0.08, 0.03, { p: [-0.11, 0.16, 0.25] }), torus(0.08, 0.03, { p: [0.11, 0.16, 0.25] })]), '#4a4e69');
  add(r, r.head, merge([sphere(0.07, { p: [-0.11, 0.16, 0.25] }), sphere(0.07, { p: [0.11, 0.16, 0.25] })]), '#ffd60a', true);
  for (const [arm, s] of [[r.armL, -1], [r.armR, 1]] as const) {
    add(r, arm, capsule(0.09, 0.3, { p: [0.03 * s, -0.22, 0] }), '#b8a9e0');
  }
  for (const leg of [r.legL, r.legR]) {
    add(r, leg, capsule(0.11, 0.3, { p: [0, -0.26, 0] }), '#5a4636');
    add(r, leg, box(0.2, 0.1, 0.32, { p: [0, -0.56, 0.06] }), '#b8a9e0');
  }
  const tail = new THREE.Group();
  tail.position.set(0, 0.7, -0.35);
  add(r, tail, merge([
    cyl(0.05, 0.07, 0.5, { p: [0, 0.05, -0.25], r: [-1.2, 0, 0] }, 5),
    cyl(0.03, 0.05, 0.5, { p: [0, 0.35, -0.55], r: [-0.4, 0, 0] }, 5),
  ]), '#ff8fab');
  r.body.add(tail);
  r.tail = tail;
  r.prop.position.set(0.03, -0.42, 0);
  add(r, r.prop, merge([cyl(0.04, 0.04, 0.5, { p: [0, 0.1, 0.12], r: [1.2, 0, 0] }, 5), torus(0.09, 0.035, { p: [0, 0.2, 0.36], r: [1.2, 0, 0] })]), '#adb5bd');
  r.armR.add(r.prop);
  r.height = 1.6;
  return r;
}

function wizard(): CharacterRig {
  const r = makeRig();
  skeleton(r, 0.7, 1.32, 0.4, 0.16, 1.55);
  add(r, r.body, cone(0.55, 1.35, { p: [0, 0.72, 0] }, 10), '#4361ee');
  add(r, r.body, merge([sphere(0.05, { p: [0.2, 0.7, 0.42] }), sphere(0.04, { p: [-0.25, 0.4, 0.42] }), sphere(0.05, { p: [0.05, 1.0, 0.3] })]), '#ffd60a', true);
  add(r, r.body, box(0.7, 0.08, 0.5, { p: [0, 0.98, 0] }), '#ffd60a');
  add(r, r.head, sphere(0.27, { p: [0, 0.05, 0] }), '#f1c27d');
  add(r, r.head, cone(0.2, 0.5, { p: [0, -0.22, 0.17], r: [Math.PI + 0.35, 0, 0] }, 6), '#f8f9fa'); // beard
  add(r, r.head, merge([cyl(0.5, 0.5, 0.05, { p: [0, 0.22, 0] }, 12), cone(0.32, 0.85, { p: [0, 0.62, -0.08], r: [-0.25, 0, 0] }, 8)]), '#3a0ca3');
  add(r, r.head, merge([sphere(0.06, { p: [0.1, 0.55, 0.12] }), sphere(0.05, { p: [-0.12, 0.4, 0.2] })]), '#ffd60a', true);
  eyes(r, r.head, 0.08, 0.22, 0.09, 0.05);
  add(r, r.head, sphere(0.07, { p: [0, -0.02, 0.27] }), '#e5a36b');
  for (const [arm, s] of [[r.armL, -1], [r.armR, 1]] as const) {
    add(r, arm, cone(0.16, 0.6, { p: [0.04 * s, -0.25, 0], r: [Math.PI, 0, 0] }, 6), '#4361ee');
    add(r, arm, sphere(0.09, { p: [0.04 * s, -0.55, 0] }), '#f1c27d');
  }
  for (const leg of [r.legL, r.legR]) add(r, leg, box(0.2, 0.12, 0.34, { p: [0, -0.64, 0.08] }), '#3a0ca3');
  r.prop.position.set(0.04, -0.55, 0);
  add(r, r.prop, cyl(0.04, 0.05, 1.8, { p: [0, 0.3, 0.05] }, 6), '#7f5539');
  add(r, r.prop, sphere(0.16, { p: [0, 1.25, 0.05] }), '#c77dff', true);
  add(r, r.prop, torus(0.17, 0.03, { p: [0, 1.25, 0.05], r: [Math.PI / 2, 0, 0] }), '#ffd60a');
  r.armR.add(r.prop);
  return r;
}

function moose(): CharacterRig {
  const r = makeRig();
  skeleton(r, 0.85, 1.6, 0.62, 0.28, 1.92);
  add(r, r.body, capsule(0.55, 0.45, { p: [0, 1.25, 0], s: [1, 1, 0.9] }), '#6f4518');
  add(r, r.body, merge([box(1.0, 0.6, 0.25, { p: [0, 1.3, 0.42] }), sphere(0.32, { p: [-0.6, 1.6, 0], s: [1, 0.7, 1] }), sphere(0.32, { p: [0.6, 1.6, 0], s: [1, 0.7, 1] })]), '#8d99ae');
  add(r, r.body, merge([box(0.15, 0.15, 0.05, { p: [-0.3, 1.45, 0.56] }), box(0.15, 0.15, 0.05, { p: [0.3, 1.45, 0.56] })]), '#ffd166');
  add(r, r.head, sphere(0.36, { p: [0, 0.05, 0.05] }), '#7f5539');
  add(r, r.head, box(0.38, 0.32, 0.45, { p: [0, -0.06, 0.42] }), '#9c6644');             // snout
  add(r, r.head, merge([sphere(0.05, { p: [-0.09, -0.02, 0.66] }), sphere(0.05, { p: [0.09, -0.02, 0.66] })]), '#2b2d42');
  add(r, r.head, merge([
    box(0.55, 0.06, 0.28, { p: [-0.5, 0.42, 0], r: [0, 0, 0.35] }), box(0.55, 0.06, 0.28, { p: [0.5, 0.42, 0], r: [0, 0, -0.35] }),
    cone(0.05, 0.3, { p: [-0.75, 0.68, 0.06] }), cone(0.05, 0.3, { p: [-0.55, 0.62, 0.06] }), cone(0.05, 0.3, { p: [-0.35, 0.55, 0.06] }),
    cone(0.05, 0.3, { p: [0.75, 0.68, 0.06] }), cone(0.05, 0.3, { p: [0.55, 0.62, 0.06] }), cone(0.05, 0.3, { p: [0.35, 0.55, 0.06] }),
  ]), '#e9d8a6');
  eyes(r, r.head, 0.16, 0.3, 0.17, 0.07);
  add(r, r.head, box(0.62, 0.12, 0.66, { p: [0, 0.3, 0.05] }), '#8d99ae'); // helmet band
  for (const [arm, s] of [[r.armL, -1], [r.armR, 1]] as const) {
    add(r, arm, capsule(0.2, 0.45, { p: [0.06 * s, -0.36, 0] }), '#6f4518');
    add(r, arm, cyl(0.24, 0.26, 0.25, { p: [0.06 * s, -0.7, 0] }), '#8d99ae');
  }
  for (const leg of [r.legL, r.legR]) {
    add(r, leg, capsule(0.22, 0.38, { p: [0, -0.36, 0] }), '#582f0e');
    add(r, leg, cyl(0.24, 0.27, 0.22, { p: [0, -0.76, 0.02] }), '#2b2d42');
  }
  r.height = 2.4;
  return r;
}

function alchemist(): CharacterRig {
  const r = makeRig();
  skeleton(r, 0.75, 1.36, 0.42, 0.18, 1.62);
  add(r, r.body, capsule(0.36, 0.45, { p: [0, 1.08, 0], s: [1, 1, 0.85] }), '#386641');
  add(r, r.body, box(0.8, 0.9, 0.08, { p: [0, 0.95, 0.33] }), '#f2e8cf'); // apron
  add(r, r.body, merge([cyl(0.08, 0.08, 0.22, { p: [-0.3, 0.85, 0.4] }, 6), cyl(0.08, 0.08, 0.22, { p: [0.3, 0.85, 0.4] }, 6)]), '#80ed99', true);
  add(r, r.head, sphere(0.3, { p: [0, 0.06, 0] }), '#e0ac69');
  add(r, r.head, merge([cyl(0.38, 0.38, 0.05, { p: [0, 0.25, 0] }, 10), cyl(0.22, 0.26, 0.4, { p: [0, 0.45, 0] }, 10)]), '#3a2618');
  add(r, r.head, merge([torus(0.1, 0.03, { p: [-0.11, 0.1, 0.27] }), torus(0.1, 0.03, { p: [0.11, 0.1, 0.27] })]), '#bc6c25');
  add(r, r.head, merge([sphere(0.08, { p: [-0.11, 0.1, 0.27] }), sphere(0.08, { p: [0.11, 0.1, 0.27] })]), '#80ed99', true);
  for (const [arm, sd] of [[r.armL, -1], [r.armR, 1]] as const) add(r, arm, capsule(0.11, 0.4, { p: [0.03 * sd, -0.3, 0] }), '#386641');
  for (const leg of [r.legL, r.legR]) { add(r, leg, capsule(0.13, 0.4, { p: [0, -0.33, 0] }), '#3a2618'); add(r, leg, box(0.24, 0.13, 0.36, { p: [0, -0.7, 0.06] }), '#582f0e'); }
  r.prop.position.set(0.03, -0.58, 0);
  add(r, r.prop, merge([sphere(0.17, { p: [0, 0.1, 0.12] }), cyl(0.05, 0.06, 0.18, { p: [0, 0.3, 0.12] }, 6)]), '#b5e48c', true);
  r.armR.add(r.prop);
  return r;
}

function gunslinger(): CharacterRig {
  const r = makeRig();
  skeleton(r, 0.85, 1.42, 0.4, 0.17, 1.66);
  add(r, r.body, capsule(0.33, 0.45, { p: [0, 1.15, 0], s: [1, 1, 0.8] }), '#9c6644');
  add(r, r.body, box(0.7, 0.6, 0.06, { p: [0, 1.2, 0.3] }), '#e9c46a'); // vest
  add(r, r.body, box(0.68, 0.1, 0.5, { p: [0, 0.9, 0] }), '#3a2618');
  add(r, r.head, sphere(0.28, { p: [0, 0.06, 0] }), '#d4a373');
  add(r, r.head, merge([cyl(0.55, 0.55, 0.04, { p: [0, 0.22, 0] }, 14), cyl(0.25, 0.3, 0.32, { p: [0, 0.38, 0] }, 10)]), '#6f4518');
  add(r, r.head, box(0.42, 0.14, 0.05, { p: [0, -0.07, 0.26] }), '#e63946'); // bandana
  eyes(r, r.head, 0.1, 0.24, 0.1, 0.05);
  for (const [arm, sd] of [[r.armL, -1], [r.armR, 1]] as const) add(r, arm, capsule(0.11, 0.42, { p: [0.03 * sd, -0.3, 0] }), '#9c6644');
  for (const leg of [r.legL, r.legR]) { add(r, leg, capsule(0.13, 0.45, { p: [0, -0.35, 0] }), '#264653'); add(r, leg, box(0.24, 0.2, 0.4, { p: [0, -0.75, 0.07] }), '#3a2618'); }
  r.prop.position.set(0.03, -0.62, 0);
  add(r, r.prop, merge([cyl(0.09, 0.11, 0.7, { p: [0, 0.05, 0.35], r: [Math.PI / 2, 0, 0] }, 8), box(0.12, 0.3, 0.14, { p: [0, -0.1, 0.05] })]), '#ffd60a');
  r.armR.add(r.prop);
  return r;
}

function engineer(): CharacterRig {
  const r = makeRig();
  skeleton(r, 0.8, 1.38, 0.45, 0.2, 1.64);
  add(r, r.body, capsule(0.4, 0.4, { p: [0, 1.1, 0], s: [1, 1, 0.85] }), '#f4a261');
  add(r, r.body, merge([box(0.5, 0.6, 0.35, { p: [0, 1.15, -0.4] }), cyl(0.06, 0.06, 0.6, { p: [0.15, 1.6, -0.45] }, 5)]), '#495057');
  add(r, r.body, sphere(0.07, { p: [0.15, 1.92, -0.45] }), '#ff4d6d', true);
  add(r, r.body, box(0.8, 0.12, 0.6, { p: [0, 0.88, 0] }), '#6c757d');
  add(r, r.head, sphere(0.3, { p: [0, 0.06, 0] }), '#f1c27d');
  add(r, r.head, sphere(0.34, { p: [0, 0.18, 0], s: [1, 0.65, 1] }), '#ffd166'); // hard hat
  add(r, r.head, box(0.75, 0.04, 0.75, { p: [0, 0.12, 0.05] }), '#ffd166');
  add(r, r.head, merge([torus(0.09, 0.03, { p: [-0.11, 0.06, 0.27] }), torus(0.09, 0.03, { p: [0.11, 0.06, 0.27] })]), '#212529');
  add(r, r.head, merge([sphere(0.07, { p: [-0.11, 0.06, 0.27] }), sphere(0.07, { p: [0.11, 0.06, 0.27] })]), '#90e0ef', true);
  for (const [arm, sd] of [[r.armL, -1], [r.armR, 1]] as const) { add(r, arm, capsule(0.12, 0.38, { p: [0.04 * sd, -0.3, 0] }), '#f4a261'); add(r, arm, sphere(0.14, { p: [0.04 * sd, -0.6, 0] }), '#495057'); }
  for (const leg of [r.legL, r.legR]) { add(r, leg, capsule(0.15, 0.4, { p: [0, -0.33, 0] }), '#264653'); add(r, leg, box(0.28, 0.16, 0.42, { p: [0, -0.72, 0.06] }), '#212529'); }
  r.prop.position.set(0.04, -0.6, 0);
  add(r, r.prop, merge([cyl(0.04, 0.04, 0.55, { p: [0, 0.1, 0.15], r: [1.2, 0, 0] }, 5), box(0.22, 0.12, 0.08, { p: [0, 0.2, 0.42] })]), '#adb5bd');
  r.armR.add(r.prop);
  return r;
}

function berserker(): CharacterRig {
  const r = makeRig();
  skeleton(r, 0.85, 1.52, 0.56, 0.24, 1.82);
  add(r, r.body, capsule(0.48, 0.45, { p: [0, 1.2, 0], s: [1.05, 1, 0.85] }), '#e5a36b');
  add(r, r.body, merge([box(1.0, 0.15, 0.1, { p: [0, 1.25, 0.38], r: [0, 0, 0.6] }), box(0.9, 0.2, 0.7, { p: [0, 0.9, 0] })]), '#6a040f');
  add(r, r.body, merge([sphere(0.25, { p: [-0.55, 1.55, 0], s: [1, 0.6, 1] }), sphere(0.25, { p: [0.55, 1.55, 0], s: [1, 0.6, 1] })]), '#5e503f');
  add(r, r.head, sphere(0.32, { p: [0, 0.08, 0] }), '#e5a36b');
  add(r, r.head, merge([sphere(0.34, { p: [0, 0.18, -0.03], s: [1, 0.7, 1] }), cone(0.07, 0.4, { p: [-0.3, 0.4, 0], r: [0, 0, 0.9] }), cone(0.07, 0.4, { p: [0.3, 0.4, 0], r: [0, 0, -0.9] })]), '#5e503f');
  add(r, r.head, cone(0.22, 0.5, { p: [0, -0.24, 0.16], r: [Math.PI + 0.3, 0, 0] }, 6), '#d00000'); // beard
  eyes(r, r.head, 0.1, 0.27, 0.11, 0.06, '#d00000');
  for (const [arm, sd] of [[r.armL, -1], [r.armR, 1]] as const) add(r, arm, capsule(0.17, 0.42, { p: [0.05 * sd, -0.33, 0] }), '#e5a36b');
  for (const leg of [r.legL, r.legR]) { add(r, leg, capsule(0.18, 0.4, { p: [0, -0.34, 0] }), '#3a2618'); add(r, leg, box(0.3, 0.16, 0.42, { p: [0, -0.75, 0.06] }), '#5e503f'); }
  r.prop.position.set(0.05, -0.66, 0);
  add(r, r.prop, cyl(0.04, 0.04, 1.3, { p: [0, 0.4, 0.1] }, 5), '#3a2618');
  add(r, r.prop, cone(0.12, 0.8, { p: [0.3, 1.0, 0.1], r: [0, 0, -1.4] }, 4), '#9bf6ff', true);
  r.armR.add(r.prop);
  r.height = 2.2;
  return r;
}

function frostKnight(): CharacterRig {
  const r = makeRig();
  skeleton(r, 0.85, 1.5, 0.5, 0.22, 1.8);
  add(r, r.body, capsule(0.44, 0.45, { p: [0, 1.18, 0], s: [1, 1, 0.85] }), '#caf0f8');
  add(r, r.body, merge([box(0.85, 0.7, 0.12, { p: [0, 1.25, 0.38] }), sphere(0.3, { p: [-0.55, 1.55, 0], s: [1, 0.7, 1] }), sphere(0.3, { p: [0.55, 1.55, 0], s: [1, 0.7, 1] })]), '#90e0ef');
  add(r, r.body, box(0.12, 0.7, 0.05, { p: [0, 1.25, 0.45] }), '#48cae4', true);
  add(r, r.body, box(0.9, 1.0, 0.06, { p: [0, 1.05, -0.4] }), '#023e8a'); // cape
  add(r, r.head, merge([sphere(0.34, { p: [0, 0.08, 0] }), cone(0.08, 0.45, { p: [-0.18, 0.45, 0], r: [0, 0, 0.3] }), cone(0.08, 0.5, { p: [0, 0.5, 0] }), cone(0.08, 0.45, { p: [0.18, 0.45, 0], r: [0, 0, -0.3] })]), '#90e0ef');
  add(r, r.head, box(0.45, 0.06, 0.05, { p: [0, 0.1, 0.33] }), '#caf0f8', true);
  for (const [arm, sd] of [[r.armL, -1], [r.armR, 1]] as const) { add(r, arm, capsule(0.15, 0.42, { p: [0.05 * sd, -0.33, 0] }), '#ade8f4'); add(r, arm, sphere(0.16, { p: [0.05 * sd, -0.66, 0] }), '#90e0ef'); }
  for (const leg of [r.legL, r.legR]) { add(r, leg, capsule(0.17, 0.4, { p: [0, -0.34, 0] }), '#ade8f4'); add(r, leg, box(0.3, 0.18, 0.44, { p: [0, -0.75, 0.06] }), '#0077b6'); }
  r.prop.position.set(0.05, -0.66, 0);
  add(r, r.prop, merge([box(0.08, 1.2, 0.04, { p: [0, 0.65, 0.12] }), box(0.35, 0.06, 0.06, { p: [0, 0.05, 0.12] })]), '#caf0f8', true);
  r.armR.add(r.prop);
  r.height = 2.2;
  return r;
}

function gambler(): CharacterRig {
  const r = makeRig();
  skeleton(r, 0.85, 1.42, 0.4, 0.17, 1.68);
  add(r, r.body, capsule(0.34, 0.45, { p: [0, 1.15, 0], s: [1, 1, 0.8] }), '#3a0ca3');
  add(r, r.body, merge([box(0.3, 0.6, 0.06, { p: [0, 1.2, 0.29] }), box(0.18, 0.08, 0.06, { p: [0, 1.45, 0.31] })]), '#f8f9fa');
  add(r, r.body, box(0.12, 0.12, 0.07, { p: [0, 1.45, 0.34] }), '#ff006e');
  add(r, r.head, sphere(0.28, { p: [0, 0.06, 0] }), '#f1c27d');
  add(r, r.head, merge([cyl(0.42, 0.42, 0.04, { p: [0, 0.22, 0] }, 12), cyl(0.24, 0.24, 0.3, { p: [0, 0.37, 0] }, 12)]), '#212529');
  add(r, r.head, torus(0.25, 0.03, { p: [0, 0.27, 0], r: [Math.PI / 2, 0, 0] }), '#ff006e');
  eyes(r, r.head, 0.08, 0.24, 0.1, 0.05);
  add(r, r.head, box(0.16, 0.04, 0.04, { p: [0.05, -0.08, 0.27], r: [0, 0, 0.2] }), '#7f5539');
  for (const [arm, sd] of [[r.armL, -1], [r.armR, 1]] as const) add(r, arm, capsule(0.11, 0.42, { p: [0.03 * sd, -0.3, 0] }), '#3a0ca3');
  for (const leg of [r.legL, r.legR]) { add(r, leg, capsule(0.13, 0.45, { p: [0, -0.35, 0] }), '#212529'); add(r, leg, box(0.22, 0.12, 0.4, { p: [0, -0.78, 0.07] }), '#f8f9fa'); }
  r.prop.position.set(0.03, -0.6, 0);
  add(r, r.prop, merge([box(0.2, 0.2, 0.2, { p: [0, 0.05, 0.12], r: [0.5, 0.5, 0] })]), '#f8f9fa');
  add(r, r.prop, merge([sphere(0.03, { p: [0, 0.12, 0.22] }), sphere(0.03, { p: [0.06, 0.02, 0.2] })]), '#ff006e', true);
  r.armR.add(r.prop);
  return r;
}

const BUILDERS: Record<CharacterId, () => CharacterRig> = { bonker, runner, scrapRat, wizard, moose, alchemist, gunslinger, engineer, berserker, frostKnight, gambler };

export function buildCharacter(id: CharacterId, tint?: string): CharacterRig {
  const rig = BUILDERS[id]();
  if (tint) {
    const c = new THREE.Color(tint);
    for (const m of rig.materials) m.color.lerp(c, 0.45);
  }
  return rig;
}

/** Procedural walk / idle / attack animation. */
export function animateRig(rig: CharacterRig, time: number, move: number, attack: number, dodge: number) {
  const stride = Math.sin(time * 11) * 0.8 * move;
  rig.legL.rotation.x = stride;
  rig.legR.rotation.x = -stride;
  rig.armL.rotation.x = -stride * 0.8;
  rig.armR.rotation.x = stride * 0.8 - attack * 2.2;
  rig.armR.rotation.z = attack * 0.4;
  const bob = Math.abs(Math.sin(time * 11)) * 0.08 * move + Math.sin(time * 2.2) * 0.02 * (1 - move);
  rig.body.position.y = bob;
  rig.body.rotation.x = move * 0.12 + dodge * 0.5;
  rig.head.rotation.y = Math.sin(time * 1.3) * 0.15 * (1 - move);
  if (rig.tail) rig.tail.rotation.y = Math.sin(time * 6) * 0.4;
  if (rig.extra) rig.extra.rotation.x = 0.2 + move * 0.9 + Math.sin(time * 14) * 0.15 * move;
}
