import * as THREE from 'three';
import { RAPIER, weaponGroups } from './physics.js';

// Weapon local frame: the grip sits at the origin, the weapon extends along +Y,
// cutting edges face +/-X and the flats face +/-Z.
// Collider kinds: 'edge' (cuts), 'tip' (thrusts), 'blunt' (crushes), 'haft' (weak blunt).

export const WEAPONS = {
  longsword: {
    label: 'Longsword',
    edges: [1, -1],
    reach: 1.05,
    tipY: 1.07,
    parts: [
      { kind: 'blunt', shape: 'ball', r: 0.032, y: -0.13, mass: 0.3 },
      { kind: 'haft', shape: 'capsule', hh: 0.09, r: 0.017, y: 0.0, mass: 0.15 },
      { kind: 'blunt', shape: 'cuboid', hx: 0.11, hy: 0.013, hz: 0.02, y: 0.115, mass: 0.2, guard: true },
      { kind: 'edge', shape: 'cuboid', hx: 0.024, hy: 0.145, hz: 0.007, y: 0.275, mass: 0.27 },
      { kind: 'edge', shape: 'cuboid', hx: 0.021, hy: 0.145, hz: 0.007, y: 0.565, mass: 0.24 },
      { kind: 'edge', shape: 'cuboid', hx: 0.017, hy: 0.145, hz: 0.006, y: 0.855, mass: 0.2 },
      { kind: 'tip', shape: 'cuboid', hx: 0.011, hy: 0.04, hz: 0.006, y: 1.035, mass: 0.05 },
    ],
    visual: buildSwordVisual,
  },
  axe: {
    label: 'Bearded Axe',
    edges: [1],
    reach: 0.72,
    tipY: 0.66,
    parts: [
      { kind: 'haft', shape: 'capsule', hh: 0.36, r: 0.019, y: 0.2, mass: 0.75 },
      { kind: 'edge', shape: 'cuboid', hx: 0.06, hy: 0.085, hz: 0.01, x: 0.075, y: 0.5, mass: 0.85 },
      { kind: 'blunt', shape: 'cuboid', hx: 0.03, hy: 0.03, hz: 0.022, x: -0.03, y: 0.52, mass: 0.35 },
      { kind: 'tip', shape: 'cuboid', hx: 0.012, hy: 0.03, hz: 0.012, y: 0.6, mass: 0.05 },
    ],
    visual: buildAxeVisual,
  },
  mace: {
    label: 'Flanged Mace',
    edges: [1, -1],
    reach: 0.66,
    tipY: 0.62,
    parts: [
      { kind: 'haft', shape: 'capsule', hh: 0.3, r: 0.018, y: 0.16, mass: 0.6 },
      { kind: 'blunt', shape: 'ball', r: 0.06, y: 0.52, mass: 1.15 },
      { kind: 'blunt', shape: 'cuboid', hx: 0.012, hy: 0.03, hz: 0.012, y: 0.6, mass: 0.05 },
    ],
    visual: buildMaceVisual,
  },
};

export function weaponMass(def) {
  return def.parts.reduce((s, p) => s + p.mass, 0);
}

/** Create the weapon rigid body + colliders + visual. */
export function createWeapon(physics, def, fighterIndex, position, rotation, owner) {
  const desc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(position.x, position.y, position.z)
    .setRotation({ x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w })
    .setCcdEnabled(true)
    .setSoftCcdPrediction(0.15)
    .setAngularDamping(0.4)
    .setLinearDamping(0.05);
  const body = physics.world.createRigidBody(desc);
  const colliders = [];
  const weapon = { body, colliders, def, mass: weaponMass(def), blood: 0, holder: owner, dropped: false, joint: null };
  for (const p of def.parts) {
    let cd;
    if (p.shape === 'ball') cd = RAPIER.ColliderDesc.ball(p.r);
    else if (p.shape === 'capsule') cd = RAPIER.ColliderDesc.capsule(p.hh, p.r);
    else cd = RAPIER.ColliderDesc.cuboid(p.hx, p.hy, p.hz);
    cd.setTranslation(p.x || 0, p.y, 0)
      .setMass(p.mass)
      .setFriction(0.35)
      .setRestitution(0.15)
      .setCollisionGroups(weaponGroups(fighterIndex))
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    const c = physics.world.createCollider(cd, body);
    physics.register(c, { type: 'weapon', kind: p.kind, weapon, part: p });
    colliders.push(c);
  }
  physics.track(body);

  const bladeMat = new THREE.MeshStandardMaterial({ color: 0xc9ced6, metalness: 0.9, roughness: 0.28 });
  const mesh = def.visual(bladeMat);
  mesh.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  weapon.mesh = mesh;
  weapon.bladeMat = bladeMat;
  return weapon;
}

const darkMetal = () => new THREE.MeshStandardMaterial({ color: 0x55555d, metalness: 0.8, roughness: 0.4 });
const leather = () => new THREE.MeshStandardMaterial({ color: 0x4a2c18, roughness: 0.9 });
const wood = () => new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.8 });

function buildSwordVisual(bladeMat) {
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(-0.024, 0.13);
  shape.lineTo(-0.022, 0.6);
  shape.lineTo(-0.016, 0.95);
  shape.lineTo(0, 1.075);
  shape.lineTo(0.016, 0.95);
  shape.lineTo(0.022, 0.6);
  shape.lineTo(0.024, 0.13);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.0035, bevelSize: 0.0035, bevelSegments: 1 });
  geo.translate(0, 0, -0.002);
  geo.computeVertexNormals();
  g.add(new THREE.Mesh(geo, bladeMat));
  // fuller
  const fuller = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.6, 0.0125), darkMetal());
  fuller.position.y = 0.45;
  g.add(fuller);
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.026, 0.035), darkMetal());
  guard.position.y = 0.115;
  g.add(guard);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.22, 10), leather());
  g.add(grip);
  const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.032, 12, 10), darkMetal());
  pommel.position.y = -0.13;
  pommel.scale.set(1, 0.8, 0.7);
  g.add(pommel);
  return g;
}

function buildAxeVisual(bladeMat) {
  const g = new THREE.Group();
  const haft = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.02, 0.78, 10), wood());
  haft.position.y = 0.2;
  g.add(haft);
  const shape = new THREE.Shape();
  shape.moveTo(0.0, 0.47);
  shape.lineTo(0.05, 0.47);
  shape.quadraticCurveTo(0.09, 0.42, 0.14, 0.38);
  shape.lineTo(0.15, 0.6);
  shape.quadraticCurveTo(0.08, 0.57, 0.04, 0.56);
  shape.lineTo(0.0, 0.56);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.004, bevelSegments: 1 });
  geo.translate(0, 0, -0.004);
  g.add(new THREE.Mesh(geo, bladeMat));
  const poll = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.045), darkMetal());
  poll.position.set(-0.03, 0.52, 0);
  g.add(poll);
  return g;
}

function buildMaceVisual(bladeMat) {
  const g = new THREE.Group();
  const haft = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.019, 0.64, 10), wood());
  haft.position.y = 0.16;
  g.add(haft);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 12), bladeMat);
  head.position.y = 0.52;
  g.add(head);
  for (let i = 0; i < 7; i++) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.11, 0.05), bladeMat);
    const a = (i / 7) * Math.PI * 2;
    f.position.set(Math.cos(a) * 0.045, 0.52, Math.sin(a) * 0.045);
    f.rotation.y = Math.PI / 2 - a;
    g.add(f);
  }
  const top = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.05, 8), darkMetal());
  top.position.y = 0.6;
  g.add(top);
  return g;
}
