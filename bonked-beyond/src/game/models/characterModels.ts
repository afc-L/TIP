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

const BUILDERS: Record<CharacterId, () => CharacterRig> = { bonker, runner, scrapRat, wizard, moose };

export function buildCharacter(id: CharacterId): CharacterRig {
  return BUILDERS[id]();
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
