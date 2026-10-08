import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RAPIER, bodyGroups, GROUP_DEBRIS } from './physics.js';
import { createWeapon, WEAPONS } from './weapons.js';
import {
  UP, clamp, lerp, smooth, yawQuat, wrapAngle, rotationError, basisQuat, basisQuatXY, v3, q4, rand,
} from './util.js';

// ---------------------------------------------------------------------------
// Skeleton definition. Rest pose faces +Z, the fighter's right side is -X.
// ---------------------------------------------------------------------------
function partDefs() {
  const d = [
    { name: 'pelvis', shape: 'box', hx: 0.16, hy: 0.09, hz: 0.1, pos: [0, 0.98, 0], mass: 12, region: 'pelvis', dmg: 0.9 },
    { name: 'torso', shape: 'box', hx: 0.17, hy: 0.2, hz: 0.11, pos: [0, 1.3, 0], mass: 26, parent: 'pelvis', anchor: [0, 1.085, 0], region: 'torso', dmg: 1.0, omega: 13, cap: 420 },
    { name: 'head', shape: 'ball', r: 0.11, pos: [0, 1.65, 0], mass: 5, parent: 'torso', anchor: [0, 1.53, 0], region: 'head', dmg: 1.6, omega: 15, cap: 70 },
  ];
  for (const [s, side] of [[-1, 'R'], [1, 'L']]) {
    d.push(
      { name: 'upperArm' + side, shape: 'capsule', hh: 0.1, r: 0.05, pos: [s * 0.235, 1.3, 0], mass: 2.5, parent: 'torso', anchor: [s * 0.235, 1.45, 0], region: 'arm', side, dmg: 0.6, omega: 16, cap: 170 },
      { name: 'forearm' + side, shape: 'capsule', hh: 0.09, r: 0.042, pos: [s * 0.235, 1.0, 0], mass: 1.6, parent: 'upperArm' + side, anchor: [s * 0.235, 1.14, 0], region: 'arm', side, dmg: 0.5, omega: 16, cap: 120 },
      { name: 'hand' + side, shape: 'box', hx: 0.035, hy: 0.05, hz: 0.045, pos: [s * 0.235, 0.81, 0], mass: 0.5, parent: 'forearm' + side, anchor: [s * 0.235, 0.87, 0], region: 'hand', side, dmg: 0.4, omega: 14, cap: s < 0 ? 60 : 30 },
      { name: 'thigh' + side, shape: 'capsule', hh: 0.14, r: 0.07, pos: [s * 0.095, 0.7, 0], mass: 8, parent: 'pelvis', anchor: [s * 0.095, 0.9, 0], region: 'leg', side, dmg: 0.7, omega: 15, cap: 380 },
      { name: 'shin' + side, shape: 'capsule', hh: 0.14, r: 0.055, pos: [s * 0.095, 0.3, 0], mass: 3.8, parent: 'thigh' + side, anchor: [s * 0.095, 0.495, 0], region: 'leg', side, dmg: 0.5, omega: 15, cap: 300 },
      { name: 'foot' + side, shape: 'box', hx: 0.05, hy: 0.035, hz: 0.12, pos: [s * 0.095, 0.035, 0.05], mass: 1.1, parent: 'shin' + side, anchor: [s * 0.095, 0.1, 0], region: 'foot', side, dmg: 0.3, omega: 13, cap: 90 },
    );
  }
  return d;
}

export const ARMOR_SETS = {
  knight: { label: 'Knight (plate)', head: ['plate', 0.95], torso: ['plate', 0.95], pelvis: ['mail', 0.9], arm: ['mail', 0.85], hand: ['plate', 0.7], leg: ['mail', 0.8], foot: ['plate', 0.6] },
  manAtArms: { label: 'Man-at-arms (mail)', head: ['plate', 0.6], torso: ['mail', 0.9], pelvis: ['gambeson', 0.8], arm: ['gambeson', 0.7], hand: null, leg: null, foot: null },
  peasant: { label: 'Peasant (gambeson)', head: null, torso: ['gambeson', 0.85], pelvis: null, arm: null, hand: null, leg: null, foot: null },
  naked: { label: 'Bare-chested', head: null, torso: null, pelvis: null, arm: null, hand: null, leg: null, foot: null },
};

// Rotation of the weapon frame relative to the hand: weapon +Y -> hand +Z (forward),
// weapon +X (edge) -> hand +Y, weapon +Z (flat) -> hand +X.
const GRIP_ROT = new THREE.Quaternion().setFromRotationMatrix(
  new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0)),
);
const GRIP_OFFSET = new THREE.Vector3(0, -0.01, 0.0);

const STAND_HEIGHT = 0.985;
const G = 9.81;

// scratch
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3();
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();
const _err = new THREE.Vector3(), _tau = new THREE.Vector3(), _w = new THREE.Vector3();
const _imp = { x: 0, y: 0, z: 0 };
const _rx = new THREE.Quaternion(), _rz = new THREE.Quaternion();
const AX = new THREE.Vector3(1, 0, 0), AZ = new THREE.Vector3(0, 0, 1);

function impulse(body, v, scale) {
  _imp.x = v.x * scale; _imp.y = v.y * scale; _imp.z = v.z * scale;
  body.applyImpulse(_imp, true);
}
function torqueImpulse(body, v, scale) {
  _imp.x = v.x * scale; _imp.y = v.y * scale; _imp.z = v.z * scale;
  body.applyTorqueImpulse(_imp, true);
}

export const TEAM_COLORS = [0x2c4f9a, 0x9a2222, 0x2f7a3a, 0x6b3a8f, 0xa86a1c, 0x2a8a8a];

export function emptyInput() {
  return {
    moveX: 0, moveZ: 0, run: false, turn: 0,
    aim: { x: 0.15, y: -0.05, reach: 0.4 },
    power: 0.4, guard: false, brace: false,
    thrust: false, parry: false, grab: false, getUp: false, dodge: false,
    faceTarget: null, // THREE.Vector3 or null
  };
}

export class Fighter {
  constructor(game, opts) {
    this.game = game;
    this.physics = game.physics;
    this.index = opts.index;
    this.name = opts.name || `Fighter ${opts.index + 1}`;
    this.team = opts.team ?? opts.index;
    this.color = TEAM_COLORS[opts.colorIndex ?? opts.index % TEAM_COLORS.length];
    this.armorSet = ARMOR_SETS[opts.armor || 'manAtArms'];
    this.weaponDef = WEAPONS[opts.weapon || 'longsword'];
    this.isPlayer = !!opts.isPlayer;
    this.invulnerable = false;

    this.yaw = opts.yaw || 0;
    this.input = emptyInput();
    this.controller = null; // AI or player, sets this.input every frame
    this.target = null; // opponent fighter

    this.state = 'stand'; // stand | down | rising | dead
    this.stateTime = 0;
    this.health = 100; // blood
    this.stamina = 100;
    this.balance = 1;
    this.muscle = 1;
    this.koTime = 0; // unconscious
    this.dazed = 0;
    this.jarred = 0; // arm shock after weapon collisions
    this.thrustT = -1; this.parryT = -1; this.dodgeCd = 0;
    this.limb = { armR: 1, armL: 1, legR: 1, legL: 1 };
    this.partDamage = {};
    this.bleedRate = 0;
    this.severed = new Set();
    this.decapitated = false;
    this.gaitPhase = 0;
    this.edgeDir = new THREE.Vector3(0, 1, 0);
    this.edgeSign = 1;
    this.riseFrom = 0.4;
    this.grabJoint = null; this.grabbing = 0; this.grabTarget = null;
    this.lastHitBy = null;
    this.kills = 0;
    this.prevPower = 0;
    this.handForce = 0;
    this.swingSpeed = 0;

    this.parts = {};
    this.partList = [];
    this.joints = [];
    this.build(opts.position || new THREE.Vector3());
  }

  // -------------------------------------------------------------------------
  // Construction
  // -------------------------------------------------------------------------
  build(origin) {
    const world = this.physics.world;
    const yq = yawQuat(this.yaw);
    const defs = partDefs();
    this.root = new THREE.Group();
    this.game.scene.add(this.root);
    this.mats = this.makeMaterials();

    for (const d of defs) {
      const p = new THREE.Vector3(...d.pos).applyQuaternion(yq).add(origin);
      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(p.x, p.y, p.z)
          .setRotation({ x: yq.x, y: yq.y, z: yq.z, w: yq.w })
          .setLinearDamping(0.05)
          .setAngularDamping(0.6)
          .setCcdEnabled(d.region === 'hand' || d.region === 'arm'),
      );
      let cd;
      if (d.shape === 'box') cd = RAPIER.ColliderDesc.cuboid(d.hx, d.hy, d.hz);
      else if (d.shape === 'ball') cd = RAPIER.ColliderDesc.ball(d.r);
      else cd = RAPIER.ColliderDesc.capsule(d.hh, d.r);
      cd.setMass(d.mass).setFriction(d.region === 'foot' ? 1.0 : 0.6).setRestitution(0.02)
        .setCollisionGroups(bodyGroups(this.index));
      const collider = world.createCollider(cd, body);
      const part = {
        ...d, body, collider, fighter: this,
        restPos: new THREE.Vector3(...d.pos),
        p: new THREE.Vector3(), q: new THREE.Quaternion(), v: new THREE.Vector3(), w: new THREE.Vector3(),
        wounds: 0, armor: this.armorSet[d.region] || null,
      };
      this.physics.register(collider, { type: 'body', part, owner: this });
      this.physics.track(body);
      this.parts[d.name] = part;
      this.partList.push(part);
      part.visual = this.buildPartVisual(part);
      this.game.addVisual(body, part.visual);
    }

    // Joints
    for (const part of this.partList) {
      if (!part.parent) continue;
      const parent = this.parts[part.parent];
      const a = new THREE.Vector3(...part.anchor);
      const a1 = a.clone().sub(parent.restPos);
      const a2 = a.clone().sub(part.restPos);
      const jd = RAPIER.JointData.spherical({ x: a1.x, y: a1.y, z: a1.z }, { x: a2.x, y: a2.y, z: a2.z });
      const joint = world.createImpulseJoint(jd, parent.body, part.body, true);
      part.joint = joint;
      part.parentPart = parent;
      part.anchorLocalParent = a1;
      part.anchorLocalChild = a2;
      this.joints.push(part);
    }

    // Weapon in right hand
    const hand = this.parts.handR;
    const hp = hand.restPos.clone().add(GRIP_OFFSET).applyQuaternion(yq).add(origin);
    const wq = yq.clone().multiply(GRIP_ROT);
    this.weapon = createWeapon(this.physics, this.weaponDef, this.index, hp, wq, this);
    const gr = GRIP_ROT;
    const jd = RAPIER.JointData.fixed(
      { x: GRIP_OFFSET.x, y: GRIP_OFFSET.y, z: GRIP_OFFSET.z }, { x: gr.x, y: gr.y, z: gr.z, w: gr.w },
      { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0, w: 1 },
    );
    this.weapon.joint = world.createImpulseJoint(jd, hand.body, this.weapon.body, true);
    this.game.addVisual(this.weapon.body, this.weapon.mesh);
    this.root.add(this.weapon.mesh);
    // Weapon inertia about the grip (for the wrist controller)
    this.weaponInertia = this.weaponDef.parts.reduce((s, p) => s + p.mass * (p.y * p.y + (p.x || 0) ** 2), 0) + 0.02;

    // Balance rig: a kinematic body tied to the pelvis/chest by free generic joints whose
    // implicit motors provide support, locomotion and an upright "hand of god" torque.
    this.jointRaw = world.impulseJoints.raw;
    const pp = this.parts.pelvis.body.translation();
    this.rig = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(pp.x, pp.y, pp.z).setRotation({ x: yq.x, y: yq.y, z: yq.z, w: yq.w }));
    this.rigJoint = world.createImpulseJoint(RAPIER.JointData.generic({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 0), this.rig, this.parts.pelvis.body, true);
    this.rigJoint2 = world.createImpulseJoint(RAPIER.JointData.generic({ x: 0, y: 0.32, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 0), this.rig, this.parts.torso.body, true);
    for (let a = 0; a < 6; a++) {
      this.jointRaw.jointConfigureMotorModel(this.rigJoint.handle, a, RAPIER.MotorModel.ForceBased);
      this.jointRaw.jointConfigureMotorModel(this.rigJoint2.handle, a, RAPIER.MotorModel.ForceBased);
    }
    for (const part of this.joints) for (let a = 3; a <= 5; a++) this.jointRaw.jointConfigureMotorModel(part.joint.handle, a, RAPIER.MotorModel.ForceBased);
    this.carrot = new THREE.Vector3(pp.x, 0, pp.z);
    this.handTarget = new THREE.Vector3();
    this.bladeTarget = new THREE.Vector3();

    this.totalMass = this.partList.reduce((s, p) => s + p.mass, 0) + this.weapon.mass;
    // Subtree inertia about each joint anchor (scalar approximation for PD scaling).
    for (const part of this.joints) {
      const anchor = new THREE.Vector3(...part.anchor);
      let I = 0;
      const visit = (pp) => {
        I += pp.mass * (pp.restPos.distanceToSquared(anchor) + 0.01);
        if (pp.name === 'handR') I += this.weaponInertia + this.weapon.mass * pp.restPos.distanceToSquared(anchor);
        for (const c of this.partList) if (c.parent === pp.name) visit(c);
      };
      visit(part);
      part.inertia = I;
    }
    this.readState();
  }

  makeMaterials() {
    const skinTones = [0xd9a47c, 0xc58b62, 0xa86b47, 0xe6bb94, 0x8d5a3b];
    return {
      skin: new THREE.MeshStandardMaterial({ color: skinTones[Math.floor(Math.random() * skinTones.length)], roughness: 0.75 }),
      cloth: new THREE.MeshStandardMaterial({ color: this.color, roughness: 0.9 }),
      trousers: new THREE.MeshStandardMaterial({ color: 0x3b3328, roughness: 0.95 }),
      boots: new THREE.MeshStandardMaterial({ color: 0x3a2516, roughness: 0.8 }),
      plate: new THREE.MeshStandardMaterial({ color: 0xaab0b8, metalness: 0.85, roughness: 0.32 }),
      mail: new THREE.MeshStandardMaterial({ color: 0x7c8088, metalness: 0.7, roughness: 0.6 }),
      gambeson: new THREE.MeshStandardMaterial({ color: 0xb8a77f, roughness: 1 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 1 }),
    };
  }

  buildPartVisual(part) {
    const g = new THREE.Group();
    const m = this.mats;
    // Each part gets its own material clones so it can be soaked with blood independently.
    const own = (mat) => { const c = mat.clone(); part.tintMats = part.tintMats || []; part.tintMats.push({ mat: c, base: c.color.clone() }); return c; };
    const add = (geo, mat, pos, scale) => {
      const mesh = new THREE.Mesh(geo, mat);
      if (pos) mesh.position.set(...pos);
      if (scale) mesh.scale.set(...scale);
      mesh.castShadow = true; mesh.receiveShadow = true;
      g.add(mesh);
      return mesh;
    };
    const armor = part.armor ? part.armor[0] : null;
    const armorMat = armor ? m[armor] : null;
    switch (part.name) {
      case 'pelvis':
        add(new RoundedBoxGeometry(0.33, 0.19, 0.21, 2, 0.05), own(m.trousers));
        add(new THREE.BoxGeometry(0.35, 0.16, 0.225), own(m.cloth), [0, -0.05, 0]);
        if (armorMat) add(new RoundedBoxGeometry(0.355, 0.12, 0.235, 2, 0.04), armorMat, [0, 0.02, 0]);
        break;
      case 'torso': {
        add(new RoundedBoxGeometry(0.34, 0.41, 0.22, 3, 0.07), own(armor === 'gambeson' ? m.gambeson : m.cloth));
        if (armor === 'plate') {
          add(new RoundedBoxGeometry(0.36, 0.36, 0.245, 3, 0.09), armorMat, [0, 0.02, 0.005]);
          add(new THREE.BoxGeometry(0.2, 0.24, 0.02), own(m.cloth), [0, -0.02, 0.125]); // tabard
        } else if (armor === 'mail') {
          add(new RoundedBoxGeometry(0.355, 0.42, 0.235, 3, 0.07), armorMat);
          add(new THREE.BoxGeometry(0.24, 0.34, 0.02), own(m.cloth), [0, -0.02, 0.118]);
        } else if (armor === 'gambeson') {
          add(new THREE.BoxGeometry(0.03, 0.35, 0.01), m.trousers, [0, 0, 0.112]);
        }
        // shoulders
        for (const s of [-1, 1]) add(new THREE.SphereGeometry(0.06, 10, 8), armor === 'plate' ? armorMat : own(m.skin), [s * 0.2, 0.15, 0], [1.1, 0.9, 1.1]);
        break;
      }
      case 'head': {
        add(new THREE.SphereGeometry(0.1, 16, 12), own(m.skin), null, [0.95, 1.1, 1]);
        add(new THREE.SphereGeometry(0.014, 6, 6), m.dark, [0.035, 0.02, 0.09]);
        add(new THREE.SphereGeometry(0.014, 6, 6), m.dark, [-0.035, 0.02, 0.09]);
        add(new THREE.BoxGeometry(0.02, 0.03, 0.03), own(m.skin), [0, -0.01, 0.1]);
        if (armor === 'plate' && part.armor[1] > 0.8) {
          add(new THREE.CylinderGeometry(0.125, 0.13, 0.27, 16), armorMat, [0, 0.01, 0]);
          add(new THREE.BoxGeometry(0.16, 0.012, 0.03), m.dark, [0, 0.03, 0.12]);
          add(new THREE.SphereGeometry(0.125, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), armorMat, [0, 0.14, 0], [1, 0.5, 1]);
        } else if (armor === 'plate') {
          add(new THREE.SphereGeometry(0.122, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), armorMat, [0, 0.03, 0]);
          add(new THREE.CylinderGeometry(0.2, 0.2, 0.012, 20), armorMat, [0, 0.04, 0]);
        } else {
          add(new THREE.SphereGeometry(0.104, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2.2), m.boots, [0, 0.02, -0.005], [0.97, 1.05, 1.02]);
        }
        break;
      }
      default: {
        if (part.shape === 'capsule') {
          const isLeg = part.region === 'leg';
          const baseMat = isLeg ? (part.name.startsWith('shin') ? m.boots : m.trousers) : m.skin;
          const sleeve = part.region === 'arm' && part.name.startsWith('upper') ? m.cloth : null;
          add(new THREE.CapsuleGeometry(part.r, part.hh * 2, 4, 10), own(sleeve || baseMat));
          if (armorMat) add(new THREE.CapsuleGeometry(part.r + 0.008, part.hh * 2 * 0.85, 4, 10), armorMat);
        } else {
          const isFoot = part.region === 'foot';
          add(new RoundedBoxGeometry(part.hx * 2, part.hy * 2, part.hz * 2, 2, 0.015), own(isFoot ? m.boots : (armor ? m.plate : m.skin)));
        }
      }
    }
    this.root.add(g);
    return g;
  }

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------
  readState() {
    let mx = 0, my = 0, mz = 0, vx = 0, vy = 0, vz = 0, M = 0;
    for (const part of this.partList) {
      const b = part.body;
      v3(b.translation(), part.p); q4(b.rotation(), part.q);
      v3(b.linvel(), part.v); v3(b.angvel(), part.w);
      if (this.severed.has(part.name)) continue;
      mx += part.p.x * part.mass; my += part.p.y * part.mass; mz += part.p.z * part.mass;
      vx += part.v.x * part.mass; vy += part.v.y * part.mass; vz += part.v.z * part.mass;
      M += part.mass;
    }
    this.com = (this.com || new THREE.Vector3()).set(mx / M, my / M, mz / M);
    this.comVel = (this.comVel || new THREE.Vector3()).set(vx / M, vy / M, vz / M);
    this.liveMass = M;
  }

  get alive() { return this.state !== 'dead'; }
  get hasWeapon() { return this.weapon && !this.weapon.dropped; }
  get position() { return this.parts.pelvis.p; }
  get fwd() { return _fwd(this.yaw, this._fwd || (this._fwd = new THREE.Vector3())); }
  get right() { return _right(this.yaw, this._right || (this._right = new THREE.Vector3())); }

  weaponPoint(t, out = new THREE.Vector3()) {
    const b = this.weapon.body;
    out.set(0, this.weaponDef.tipY * t, 0).applyQuaternion(q4(b.rotation(), _q3)).add(v3(b.translation(), _v4));
    return out;
  }
  weaponAxis(out = new THREE.Vector3()) {
    return out.set(0, 1, 0).applyQuaternion(q4(this.weapon.body.rotation(), _q3));
  }

  // -------------------------------------------------------------------------
  // Fixed-step control
  // -------------------------------------------------------------------------
  step(dt) {
    const DD = this.game.dbg || {};
    this.readState();
    this.stateTime += dt;
    const inp = this.input;
    this.updateTimers(dt);
    this.updateFacing(dt);
    this.updateState(dt);

    const yq = yawQuat(this.yaw, _yq);
    const fwd = this.fwd, right = this.right;

    // Global muscle tone target by state
    let muscleTarget = 1;
    if (this.state === 'down') muscleTarget = this.koTime > 0 ? 0.02 : 0.08;
    else if (this.state === 'dead') muscleTarget = 0.0;
    else if (this.state === 'rising') muscleTarget = lerp(0.3, 1, smooth(this.stateTime / 1.2));
    if (this.dazed > 0) muscleTarget *= 0.55;
    this.muscle += (muscleTarget - this.muscle) * Math.min(1, dt * (muscleTarget < this.muscle ? 12 : 4));
    const staminaF = 0.5 + 0.5 * clamp(this.stamina / 40, 0, 1);
    this.strength = this.muscle * staminaF;
    const legF = Math.min(this.limb.legL, this.limb.legR);
    const upright = this.state === 'stand' || this.state === 'rising';
    const pelvis = this.parts.pelvis, torso = this.parts.torso;

    // ---------------- Balance rig: support, locomotion and upright assist ----------------
    let support = 0, assist = 0, heightTarget = STAND_HEIGHT;
    const braced = upright && inp.brace && this.stamina > 2;
    if (this.state === 'stand') {
      support = 1;
      assist = 0.12 + 0.88 * smooth(this.balance / 0.55);
      if (braced) heightTarget = 0.93;
    } else if (this.state === 'rising') {
      const t = this.stateTime;
      support = smooth(t / 0.9);
      assist = smooth(t / 1.1);
      heightTarget = lerp(this.riseFrom, STAND_HEIGHT, smooth(t / 1.3));
    }
    const legSupport = legF > 0 ? 0.55 + 0.45 * legF : 0;
    support *= legSupport * Math.max(0.25, this.muscle);
    assist *= this.muscle;
    if (DD.noAssist) assist = 0;
    if (DD.noDrive) support = 0;

    const M = this.liveMass + (this.hasWeapon ? this.weapon.mass : 0);
    // desired ground velocity
    const desired = _v2.set(0, 0, 0);
    let mx = inp.moveX, mz = inp.moveZ;
    const ml = Math.hypot(mx, mz);
    if (ml > 1) { mx /= ml; mz /= ml; }
    let speed = inp.run && this.stamina > 5 ? 3.3 : 1.7;
    if (mz < 0) speed *= 0.65;
    if (braced) speed *= 0.4;
    speed *= (0.35 + 0.65 * legF) * (0.45 + 0.55 * smooth(this.balance / 0.5));
    if (this.state !== 'stand') speed = 0;
    desired.addScaledVector(fwd, mz * speed).addScaledVector(right, mx * speed);
    if (this.thrustT >= 0 && this.thrustT < 0.35) desired.addScaledVector(fwd, 1.2);
    if (inp.run && ml > 0.1 && this.state === 'stand') this.stamina -= dt * 7;

    // The carrot leads the pelvis at the desired velocity, but can't run away from it.
    const carrot = this.carrot;
    if (support > 0) {
      carrot.addScaledVector(desired, dt);
      _v3.set(carrot.x - pelvis.p.x, 0, carrot.z - pelvis.p.z);
      if (_v3.length() > 0.3) { _v3.setLength(0.3); carrot.set(pelvis.p.x + _v3.x, 0, pelvis.p.z + _v3.z); }
    } else carrot.set(pelvis.p.x, 0, pelvis.p.z);
    const rig = this.rig;
    _p.x = carrot.x; _p.y = heightTarget; _p.z = carrot.z;
    rig.setNextKinematicTranslation(_p);
    _r.x = yq.x; _r.y = yq.y; _r.z = yq.z; _r.w = yq.w;
    rig.setNextKinematicRotation(_r);

    const balF = 0.3 + 0.7 * smooth(this.balance / 0.5);
    const hMax = 1200 * support * balF * (braced ? 1.4 : 1);
    this.rigMotor(this.rigJoint, 0, M * 49, 2 * M * 7, hMax);
    this.rigMotor(this.rigJoint, 2, M * 49, 2 * M * 7, hMax);
    this.rigMotor(this.rigJoint, 1, M * 100, 2 * M * 10 * 0.9, support * 1.6 * M * G);
    const tiltMax = 1500 * assist;
    this.rigMotor(this.rigJoint, 3, 2400, 400, tiltMax);
    this.rigMotor(this.rigJoint, 5, 2400, 400, tiltMax);
    this.rigMotor(this.rigJoint, 4, 1500, 300, tiltMax * 0.8);
    const chestMax = 420 * assist;
    this.rigMotor(this.rigJoint2, 3, 700, 120, chestMax);
    this.rigMotor(this.rigJoint2, 5, 700, 120, chestMax);
    // gravity compensation (feed-forward) so the support spring doesn't sag
    if (support > 0 && heightTarget - pelvis.p.y > -0.12) {
      _p.x = 0; _p.y = M * G * support * dt; _p.z = 0;
      pelvis.body.applyImpulse(_p, true);
    }

    // ---------------- Joint muscles (active ragdoll) ----------------
    const m = this.muscle;
    const kMul = m, capMul = Math.max(m * staminaF, 0.015);
    const dMul = 0.25 + 0.75 * m;

    // Waist: twist into the swing
    const twist = upright ? clamp(-inp.aim.x * 0.45, -0.5, 0.5) : 0;
    _q1.copy(yq).multiply(_q2.setFromAxisAngle(UP, twist)).multiply(_rx.setFromAxisAngle(AX, 0.08 + (braced ? 0.15 : 0)));
    if (!upright) _q1.copy(pelvis.q);
    this.muscleJoint(torso, _q1, kMul, dMul, capMul);

    // Neck: look at the opponent
    const head = this.parts.head;
    if (upright && this.target) {
      _v1.copy(this.target.parts.head.p).sub(head.p).normalize();
      basisQuat(UP, _v1, _q1);
    } else _q1.copy(torso.q);
    this.muscleJoint(head, _q1, kMul, dMul, capMul);

    if (!DD.noLegs) this.legControl(dt, upright, braced, kMul, dMul, capMul, yq);
    if (!DD.noArms) this.armControl(dt, upright, kMul, dMul, capMul, fwd, right, yq);

    // Stamina regen
    const busy = inp.power > 0.6 || braced || (inp.run && (inp.moveX || inp.moveZ));
    if (this.state !== 'dead') this.stamina = clamp(this.stamina + dt * (busy ? 4 : 15), 0, 100);
  }

  rigMotor(joint, axis, k, c, maxF) {
    const raw = this.jointRaw;
    if (maxF <= 0.01) { k = 0; c = 0; maxF = 0; }
    raw.jointConfigureMotorPosition(joint.handle, axis, 0, k, c);
    raw.jointSetMotorMaxForce(joint.handle, axis, maxF);
  }

  /**
   * Muscle between `part` and its parent: an implicit Rapier joint motor. Each step we rotate
   * the child's joint frame so that "zero" on the motor = the desired world rotation qDes.
   */
  muscleJoint(part, qDes, kMul, dMul, capMul, omegaMul = 1, capScale = 1) {
    if (!part.joint || this.severed.has(part.name)) return;
    const parent = part.parentPart;
    // frame2 = qDes^-1 * parentRot  (so that childRot * frame2 == parentRot at the target)
    _qf.copy(qDes).invert().multiply(parent.q);
    _r.x = _qf.x; _r.y = _qf.y; _r.z = _qf.z; _r.w = _qf.w;
    part.joint.setFrameX2(_r);
    const omega = part.omega * omegaMul;
    const I = part.inertia;
    const k = I * omega * omega * kMul;
    const c = 2 * I * omega * dMul;
    const cap = part.cap * capMul * capScale;
    const raw = this.jointRaw, h = part.joint.handle;
    for (let a = 3; a <= 5; a++) {
      raw.jointConfigureMotorPosition(h, a, 0, k, c);
      raw.jointSetMotorMaxForce(h, a, cap);
    }
  }

  legControl(dt, upright, braced, kMul, dMul, capMul, yq) {
    const fwd = this.fwd, right = this.right;
    const v = this.comVel;
    const vf = v.x * fwd.x + v.z * fwd.z;
    const vs = -(v.x * right.x + v.z * right.z); // +left
    const speed = Math.hypot(vf, vs);
    if (upright) this.gaitPhase += dt * (speed / 0.55) * Math.PI;
    const amp = upright ? clamp(speed / 2.4, 0, 1) : 0;
    const fwdShare = speed > 0.05 ? vf / speed : 0;
    const sideShare = speed > 0.05 ? vs / speed : 0;
    const pelvisQ = this.parts.pelvis.q;
    for (const [side, ph, s] of [['L', 0, 1], ['R', Math.PI, -1]]) {
      const thigh = this.parts['thigh' + side], shin = this.parts['shin' + side], foot = this.parts['foot' + side];
      const phase = this.gaitPhase + ph;
      let hipPitch, hipRoll, knee;
      if (upright) {
        hipPitch = 0.6 * amp * fwdShare * Math.sin(phase) + (braced ? 0.25 : 0.04);
        hipRoll = 0.32 * amp * sideShare * Math.sin(phase) + s * (braced ? 0.12 : 0.05);
        knee = (braced ? 0.45 : 0.1) + 1.0 * amp * Math.max(0, Math.cos(phase));
        if (this.state === 'rising') { hipPitch = 0.5 * (1 - smooth(this.stateTime / 1.3)); knee = 0.9 * (1 - smooth(this.stateTime / 1.3)) + 0.1; }
        // stumbling: legs splay when off-balance
        if (this.balance < 0.35) hipRoll += s * 0.12 * Math.sin(this.stateTime * 9 + ph);
      } else {
        hipPitch = 0.15; hipRoll = s * 0.08; knee = 0.35;
      }
      const legStr = 0.4 + 0.6 * this.limb['leg' + side];
      _q1.copy(pelvisQ).multiply(_rx.setFromAxisAngle(AX, -hipPitch)).multiply(_rz.setFromAxisAngle(AZ, hipRoll));
      this.muscleJoint(thigh, _q1, kMul, dMul, capMul * legStr);
      _q1.copy(thigh.q).multiply(_rx.setFromAxisAngle(AX, knee));
      this.muscleJoint(shin, _q1, kMul, dMul, capMul * legStr);
      if (upright) _q1.copy(yq); else _q1.copy(shin.q).multiply(_rx.setFromAxisAngle(AX, -0.2));
      this.muscleJoint(foot, _q1, kMul, dMul, capMul);
    }
  }

  armControl(dt, upright, kMul, dMul, capMul, fwd, right, yq) {
    const inp = this.input;
    const torso = this.parts.torso;
    // Chest reference point (shoulder height) in the facing frame
    const C = _chest.copy(UP).multiplyScalar(0.15).applyQuaternion(torso.q).add(torso.p);

    // ---------------- Weapon (right) arm ----------------
    const armOk = !this.severed.has('handR') && !this.severed.has('forearmR') && !this.severed.has('upperArmR');
    let power = clamp(inp.power, 0, 1.25);
    let aimX = inp.aim.x, aimY = inp.aim.y, reach = inp.aim.reach;
    const T = _target.copy(C);
    const bladeDir = _blade;
    let edgeOverride = null;
    let guard = inp.guard;
    if (!upright) { aimX = 0.25; aimY = -0.45; reach = 0.2; power = 0.1; guard = false; }

    if (this.thrustT >= 0 && upright) {
      const t = this.thrustT;
      reach = t < 0.12 ? lerp(reach, 0.15, t / 0.12) : lerp(0.15, 0.78, smooth((t - 0.12) / 0.16));
      aimY = lerp(aimY, -0.08, 0.7); aimX = lerp(aimX, 0.05, 0.7);
      power = 1.25;
    }
    T.addScaledVector(right, aimX).addScaledVector(UP, aimY).addScaledVector(fwd, reach);

    if (this.thrustT >= 0 && upright) {
      if (this.target) bladeDir.copy(this.target.parts.torso.p).sub(T).normalize();
      else bladeDir.copy(fwd);
      bladeDir.lerp(fwd, 0.35).normalize();
    } else if (this.parryT >= 0 && upright && this.target && this.target.hasWeapon) {
      // Drive the blade across the line of the incoming weapon.
      const mid = this.target.weaponPoint(0.65, _v3);
      const toMid = _v4.copy(mid).sub(C);
      const dist = toMid.length();
      toMid.normalize();
      T.copy(C).addScaledVector(toMid, Math.min(0.55, dist * 0.6)).addScaledVector(UP, 0.05);
      const enemyAxis = this.target.weaponAxis(_v1);
      bladeDir.crossVectors(enemyAxis, toMid);
      if (bladeDir.lengthSq() < 1e-4) bladeDir.copy(UP);
      bladeDir.normalize();
      if (bladeDir.dot(UP) < 0) bladeDir.negate();
      bladeDir.addScaledVector(UP, 0.4).addScaledVector(fwd, 0.2).normalize();
      edgeOverride = _edgeO.copy(toMid);
      power = 1.25;
    } else if (guard) {
      if (aimY > 0.32) {
        // high horizontal guard against overhead blows
        bladeDir.copy(right).multiplyScalar(aimX > 0 ? -1 : 1).addScaledVector(UP, 0.25).addScaledVector(fwd, 0.35).normalize();
      } else {
        bladeDir.copy(UP).multiplyScalar(1.2).addScaledVector(fwd, 0.45).addScaledVector(right, -aimX * 0.9).normalize();
      }
      edgeOverride = _edgeO.copy(fwd);
      power = Math.max(power, 0.9);
      T.addScaledVector(fwd, Math.max(0, 0.35 - reach));
    } else {
      // Blade points away from a pivot below/behind the chest: high hands = raised blade.
      const pivot = _v3.copy(C).addScaledVector(UP, -0.3).addScaledVector(fwd, -0.15);
      bladeDir.copy(T).sub(pivot).addScaledVector(fwd, 0.1 + reach * 0.4).normalize();
    }

    // clamp target within reach of shoulder
    const shoulderR = this.jointWorld(this.parts.upperArmR, _sh);
    _v1.copy(T).sub(shoulderR);
    if (_v1.length() > 0.62) T.copy(shoulderR).addScaledVector(_v1.normalize(), 0.62);

    this.handTarget.copy(T);
    this.bladeTarget.copy(bladeDir);

    const armStr = this.limb.armR * (this.jarred > 0 ? 0.35 : 1) * (this.dazed > 0 ? 0.6 : 1);
    if (armOk) {
      this.solveArm('R', shoulderR, T, right, fwd, kMul, dMul, capMul * (0.35 + 0.65 * armStr), power);
      if (this.hasWeapon) {
        this.driveHand(this.parts.handR, T, power, armStr, dt, true);
        this.driveWeapon(bladeDir, edgeOverride, power, armStr, kMul, dMul);
      } else this.muscleJoint(this.parts.handR, this.parts.forearmR.q, kMul, dMul, capMul);
    }

    // ---------------- Off hand (left): guard or grab ----------------
    const armLOk = !this.severed.has('handL') && !this.severed.has('forearmL') && !this.severed.has('upperArmL');
    if (armLOk) {
      const TL = _targetL.copy(C);
      let lPow = 0.5;
      if (this.grabbing > 0 && this.grabTarget && upright) {
        TL.copy(this.grabTarget.p);
        lPow = 1;
      } else if (this.grabJoint) {
        TL.copy(this.parts.handL.p);
        lPow = 0.3;
      } else if (upright) {
        TL.addScaledVector(right, -0.12).addScaledVector(UP, -0.2).addScaledVector(fwd, 0.3);
      } else {
        TL.addScaledVector(right, -0.3).addScaledVector(UP, -0.4).addScaledVector(fwd, 0.1);
      }
      const shoulderL = this.jointWorld(this.parts.upperArmL, _shL);
      _v1.copy(TL).sub(shoulderL);
      if (_v1.length() > 0.62) TL.copy(shoulderL).addScaledVector(_v1.normalize(), 0.62);
      this.solveArm('L', shoulderL, TL, right, fwd, kMul, dMul, capMul * (0.35 + 0.65 * this.limb.armL), lPow);
      if (upright) this.driveHand(this.parts.handL, TL, lPow, this.limb.armL, dt, false);
    }
  }

  jointWorld(part, out) {
    return out.copy(part.anchorLocalParent).applyQuaternion(part.parentPart.q).add(part.parentPart.p);
  }

  /** Two-bone IK for an arm; muscles then drive the segments toward the solution. */
  solveArm(side, S, T, right, fwd, kMul, dMul, capMul, power) {
    const upper = this.parts['upperArm' + side], fore = this.parts['forearm' + side], hand = this.parts['hand' + side];
    const L1 = 0.31, L2 = 0.33;
    const u = _v1.copy(T).sub(S);
    const D = clamp(u.length(), 0.12, L1 + L2 - 0.005);
    u.normalize();
    const sgn = side === 'R' ? 1 : -1;
    const pole = _v2.set(0, -1, 0).addScaledVector(right, 0.7 * sgn).addScaledVector(fwd, -0.25);
    pole.addScaledVector(u, -pole.dot(u));
    if (pole.lengthSq() < 1e-5) pole.copy(right).multiplyScalar(sgn);
    pole.normalize();
    const a = (L1 * L1 - L2 * L2 + D * D) / (2 * D);
    const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
    const E = _v3.copy(S).addScaledVector(u, a).addScaledVector(pole, h);
    const zRef = _v4.copy(pole).negate();
    const omegaMul = 0.75 + 0.35 * clamp(power, 0, 1.25);
    const capP = 0.55 + 0.45 * clamp(power, 0, 1.25);
    // upper arm: local +Y points from elbow to shoulder
    _w.copy(S).sub(E);
    basisQuat(_w, zRef, _q1);
    this.muscleJoint(upper, _q1, kMul, dMul, capMul, omegaMul, capP);
    _w.copy(E).sub(T);
    basisQuat(_w, zRef, _q2);
    this.muscleJoint(fore, _q2, kMul, dMul, capMul, omegaMul, capP);
    if (side === 'L') this.muscleJoint(hand, _q2, kMul, dMul, capMul);
  }

  /** Cartesian "reach" force pulling the hand to the target; reaction goes into the torso. */
  driveHand(hand, T, power, armStr, dt, weaponHand) {
    const torso = this.parts.torso;
    const omega = 6 + 6 * clamp(power, 0, 1.25);
    const mEff = weaponHand ? 0.6 + this.weapon.mass : 0.5;
    _v1.copy(T).sub(hand.p).multiplyScalar(omega * omega);
    _v2.copy(hand.v).sub(torso.v).multiplyScalar(2 * omega * 0.9);
    const F = _v1.sub(_v2).multiplyScalar(mEff);
    const cap = (weaponHand ? 60 + 160 * clamp(power, 0, 1.25) : 60 + 60 * power) * armStr * this.strength;
    const mag = F.length();
    if (mag > cap) F.multiplyScalar(cap / mag);
    if (weaponHand) this.handForce = Math.min(mag, cap) / Math.max(cap, 1);
    // gravity compensation of forearm + hand + weapon
    F.y += (weaponHand ? 1.4 + this.weapon.mass : 1.2) * G * this.muscle * armStr;
    impulse(hand.body, F, dt);
    impulse(torso.body, F, -dt);
    if (weaponHand && power > 0.6) this.stamina -= dt * 6 * this.handForce * power;
  }

  /** Wrist muscle orienting the weapon toward bladeDir with the edge leading the motion. */
  driveWeapon(bladeDir, edgeOverride, power, armStr, kMul, dMul) {
    const wb = this.weapon.body;
    const wq = q4(wb.rotation(), _q1);
    const tip = this.weaponPoint(0.7, _v2);
    const vt = v3(wb.velocityAtPoint(tip), _v3).sub(this.parts.torso.v);
    this.swingSpeed = vt.length();
    const ed = _v4;
    if (edgeOverride) ed.copy(edgeOverride);
    else {
      vt.addScaledVector(bladeDir, -vt.dot(bladeDir));
      if (vt.length() > 1.4) ed.copy(vt).normalize();
      else ed.copy(this.fwd).multiplyScalar(0.6).addScaledVector(UP, 0.8);
    }
    ed.addScaledVector(bladeDir, -ed.dot(bladeDir));
    if (ed.lengthSq() < 1e-6) ed.copy(UP).addScaledVector(bladeDir, -bladeDir.y);
    ed.normalize();
    // Pick whichever edge is closest (double-edged weapons), then smooth.
    const curEdge = _w.set(1, 0, 0).applyQuaternion(wq);
    this.edgeSign = this.weaponDef.edges.length > 1 && curEdge.dot(ed) < 0 ? -1 : 1;
    ed.multiplyScalar(this.edgeSign);
    this.edgeDir.lerp(ed, 0.25).normalize();
    basisQuatXY(this.edgeDir, bladeDir, _q2);
    // desired hand rotation = desired weapon rotation * grip^-1
    _q2.multiply(GRIP_INV);
    const hand = this.parts.handR;
    const omegaMul = (0.7 + 0.5 * clamp(power, 0, 1.25)) * (hand.omega ? 1 : 1);
    const capScale = (0.45 + 0.75 * clamp(power, 0, 1.25)) * armStr;
    this.muscleJoint(hand, _q2, kMul, dMul, this.strength, omegaMul, capScale);
  }

  // -------------------------------------------------------------------------
  // State machine, facing, timers
  // -------------------------------------------------------------------------
  updateTimers(dt) {
    const inp = this.input;
    this.koTime = Math.max(0, this.koTime - dt);
    this.dazed = Math.max(0, this.dazed - dt);
    this.jarred = Math.max(0, this.jarred - dt);
    this.dodgeCd = Math.max(0, this.dodgeCd - dt);
    if (this.thrustT >= 0) { this.thrustT += dt; if (this.thrustT > 0.55) this.thrustT = -1; }
    if (this.parryT >= 0) { this.parryT += dt; if (this.parryT > 0.38) this.parryT = -1; }
    const upright = this.state === 'stand';
    if (inp.thrust) { inp.thrust = false; if (upright && this.thrustT < 0 && this.stamina > 10 && this.hasWeapon) { this.thrustT = 0; this.stamina -= 9; } }
    if (inp.parry) { inp.parry = false; if (upright && this.parryT < 0 && this.stamina > 8 && this.hasWeapon) { this.parryT = 0; this.stamina -= 7; } }
    if (inp.dodge) {
      inp.dodge = false;
      if (upright && this.dodgeCd <= 0 && this.stamina > 20 && (inp.moveX || inp.moveZ)) {
        _v1.set(0, 0, 0).addScaledVector(this.fwd, inp.moveZ).addScaledVector(this.right, inp.moveX).normalize();
        for (const p of this.partList) if (!this.severed.has(p.name)) impulse(p.body, _v1, p.mass * 3.2);
        this.stamina -= 22; this.balance -= 0.12; this.dodgeCd = 0.8;
      }
    }
    if (inp.grab) {
      inp.grab = false;
      if (this.grabJoint) this.releaseGrab();
      else if (upright && this.stamina > 10 && this.target && !this.severed.has('handL')) {
        this.grabbing = 0.6;
        this.grabTarget = this.nearestPartOf(this.target, this.parts.handL.p);
      }
    }
    if (this.grabbing > 0) {
      this.grabbing -= dt;
      const t = this.grabTarget;
      if (t && t.p.distanceTo(this.parts.handL.p) < 0.17 && !t.fighter.severed.has(t.name)) this.makeGrab(t);
      if (this.grabbing <= 0) this.grabTarget = null;
    }
    if (this.grabJoint) {
      this.stamina -= dt * 7;
      if (this.stamina < 3 || this.state !== 'stand' || this.severed.has('handL')) this.releaseGrab();
    }
  }

  nearestPartOf(f, p) {
    let best = null, bd = Infinity;
    for (const part of f.partList) {
      if (f.severed.has(part.name) || part.region === 'foot') continue;
      const d = part.p.distanceTo(p);
      if (d < bd) { bd = d; best = part; }
    }
    return bd < 1.0 ? best : null;
  }

  makeGrab(part) {
    const hand = this.parts.handL;
    const hp = hand.p;
    const local = _v1.copy(hp).sub(part.p).applyQuaternion(_q1.copy(part.q).invert());
    local.clampLength(0, 0.12);
    const jd = RAPIER.JointData.spherical({ x: 0, y: -0.04, z: 0 }, { x: local.x, y: local.y, z: local.z });
    this.grabJoint = this.physics.world.createImpulseJoint(jd, hand.body, part.body, true);
    this.grabbedPart = part;
    this.grabbing = 0; this.grabTarget = null;
    this.game.audio?.grab(hp);
  }

  releaseGrab() {
    if (this.grabJoint) {
      if (this.physics.world.getImpulseJoint(this.grabJoint.handle)) this.physics.world.removeImpulseJoint(this.grabJoint, true);
      this.grabJoint = null; this.grabbedPart = null;
    }
  }

  updateFacing(dt) {
    const inp = this.input;
    if (this.state === 'dead' || this.state === 'down') return;
    if (inp.faceTarget) {
      const p = this.parts.pelvis.p;
      const desired = Math.atan2(inp.faceTarget.x - p.x, inp.faceTarget.z - p.z);
      const diff = wrapAngle(desired - this.yaw);
      const rate = (this.state === 'rising' ? 1.5 : 4.5) * (0.4 + 0.6 * this.balance);
      this.yaw = wrapAngle(this.yaw + clamp(diff, -rate * dt, rate * dt));
    } else if (inp.turn) {
      this.yaw = wrapAngle(this.yaw + inp.turn * dt * 2.6);
    }
  }

  updateState(dt) {
    const inp = this.input;
    const torso = this.parts.torso, pelvis = this.parts.pelvis;
    const tilt = Math.acos(clamp(_v1.set(0, 1, 0).applyQuaternion(torso.q).y, -1, 1));
    const pelvisTilt = Math.acos(clamp(_v1.set(0, 1, 0).applyQuaternion(pelvis.q).y, -1, 1));
    this.tilt = tilt;

    if (this.state !== 'dead' && this.health <= 0) this.die('blood loss');
    if (this.state === 'dead') return;
    const legsGone = this.limb.legL <= 0 && this.limb.legR <= 0;

    if (this.state === 'stand') {
      const legF = Math.min(this.limb.legL, this.limb.legR);
      let rec = (0.2 + (this.input.brace ? 0.35 : 0)) * (0.3 + 0.7 * legF) * (this.stamina > 10 ? 1 : 0.4);
      this.balance += dt * rec;
      this.balance -= dt * Math.max(0, tilt - 0.3) * 1.6;
      // centre of mass outside the feet
      const fl = this.parts.footL.p, fr = this.parts.footR.p;
      const mx = (fl.x + fr.x) / 2, mz = (fl.z + fr.z) / 2;
      const off = Math.hypot(this.com.x - mx, this.com.z - mz);
      this.balance -= dt * Math.max(0, off - 0.3) * 2.5;
      // a violent, uncontrolled swing pulls you around
      if (this.handForce > 0.95 && this.swingSpeed > 9) this.balance -= dt * 0.25;
      this.balance = clamp(this.balance, -1, 1);
      if (this.balance <= 0) this.goDown('balance');
      else if (tilt > 1.15) this.goDown('tilt');
      else if (pelvisTilt > 1.2) this.goDown('pelvisTilt');
      else if (pelvis.p.y < 0.55) this.goDown('height');
      else if (legsGone) this.goDown('legs');
      else if (this.koTime > 0) this.goDown('ko');
    } else if (this.state === 'down') {
      this.balance = 0;
      const canRise = !legsGone && this.koTime <= 0 && this.stateTime > 1.4 && this.stamina > 15;
      if (canRise && inp.getUp) {
        this.state = 'rising'; this.stateTime = 0;
        this.riseFrom = clamp(pelvis.p.y, 0.25, 0.8);
        this.stamina -= 15;
      }
    } else if (this.state === 'rising') {
      if (this.stateTime > 1.5) {
        if (tilt < 0.6 && pelvis.p.y > 0.8) { this.state = 'stand'; this.stateTime = 0; this.balance = 0.55; }
        else if (this.stateTime > 2.6) this.goDown('riseFail');
      }
      if (legsGone) this.goDown('legs');
    }
    inp.getUp = false;
  }

  goDown(reason = '') {
    if (this.state === 'dead') return;
    this.downReason = reason;
    this.state = 'down'; this.stateTime = 0; this.balance = 0;
    this.thrustT = -1; this.parryT = -1;
    this.releaseGrab();
    this.game.onFighterDown?.(this);
  }

  die(cause) {
    if (this.state === 'dead') return;
    this.state = 'dead'; this.stateTime = 0;
    this.deathCause = cause;
    this.releaseGrab();
    this.game.onFighterDeath?.(this, cause);
  }

  /** Remove the joint above `partName`, turning that limb (and everything below it) into debris. */
  sever(partName) {
    const part = this.parts[partName];
    if (!part || !part.joint || this.severed.has(partName)) return null;
    this.physics.world.removeImpulseJoint(part.joint, true);
    part.joint = null;
    const lost = [];
    const visit = (pp) => {
      this.severed.add(pp.name); lost.push(pp);
      pp.collider.setCollisionGroups(GROUP_DEBRIS);
      for (const c of this.partList) if (c.parent === pp.name) visit(c);
    };
    visit(part);
    if (this.severed.has('handR') && this.weapon && !this.weapon.dropped) this.dropWeapon(false);
    if (this.grabJoint && this.severed.has('handL')) this.releaseGrab();
    for (const pp of lost) {
      if (pp.region === 'arm' || pp.region === 'hand') this.limb['arm' + pp.side] = 0;
      if (pp.region === 'leg' || pp.region === 'foot') this.limb['leg' + pp.side] = pp.region === 'foot' ? Math.min(this.limb['leg' + pp.side], 0.35) : 0;
    }
    if (partName === 'head') { this.decapitated = true; this.die('decapitated'); }
    return lost;
  }

  dropWeapon(detach = true) {
    if (!this.weapon || this.weapon.dropped) return;
    this.weapon.dropped = true;
    if (detach && this.weapon.joint) this.physics.world.removeImpulseJoint(this.weapon.joint, true);
    for (const c of this.weapon.colliders) c.setCollisionGroups(GROUP_DEBRIS);
  }

  destroy() {
    this.releaseGrab();
    for (const p of this.partList) { this.game.removeVisual(p.body); this.physics.removeBody(p.body); }
    this.physics.world.removeRigidBody(this.rig);
    if (this.weapon) { this.game.removeVisual(this.weapon.body); this.physics.removeBody(this.weapon.body); }
    this.game.scene.remove(this.root);
    this.root.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); } });
  }
}

const _yq = new THREE.Quaternion(), _qf = new THREE.Quaternion();
const _p = { x: 0, y: 0, z: 0 }, _r = { x: 0, y: 0, z: 0, w: 1 };
const _edgeO = new THREE.Vector3();
const GRIP_INV = GRIP_ROT.clone().invert();
const _chest = new THREE.Vector3(), _target = new THREE.Vector3(), _targetL = new THREE.Vector3(), _blade = new THREE.Vector3();
const _sh = new THREE.Vector3(), _shL = new THREE.Vector3();
function _fwd(yaw, out) { return out.set(Math.sin(yaw), 0, Math.cos(yaw)); }
function _right(yaw, out) { return out.set(-Math.cos(yaw), 0, Math.sin(yaw)); }
export { GRIP_ROT, rand };
