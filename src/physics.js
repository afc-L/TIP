import RAPIER from '@dimforge/rapier3d-compat';

export { RAPIER };

export const FIXED_DT = 1 / 120;
export const MAX_STEPS_PER_FRAME = 6;

// Collision groups: bit 0 = world, bit 15 = debris (severed limbs, dropped weapons),
// fighter i owns bit (1 + 2i) for its body and bit (2 + 2i) for its weapon.
export const MAX_FIGHTERS = 6;
const WORLD_BIT = 1 << 0;
const DEBRIS_BIT = 1 << 15;
const ALL_BITS = 0xffff;

export const bodyBit = (i) => 1 << (1 + 2 * i);
export const weaponBit = (i) => 1 << (2 + 2 * i);
const groups = (member, filter) => ((member & 0xffff) << 16) | (filter & 0xffff);

export const GROUP_WORLD = groups(WORLD_BIT, ALL_BITS);
export const GROUP_DEBRIS = groups(DEBRIS_BIT, ALL_BITS);
/** A fighter's body collides with everything except its own body and weapon. */
export const bodyGroups = (i) => groups(bodyBit(i), ALL_BITS & ~bodyBit(i) & ~weaponBit(i));
export const weaponGroups = (i) => groups(weaponBit(i), ALL_BITS & ~bodyBit(i) & ~weaponBit(i));

export async function initPhysics() {
  await RAPIER.init();
}

/**
 * Owns the Rapier world, the fixed-timestep accumulator and a per-step cache of
 * pre-solve velocities (used to measure true impact speeds of collisions).
 */
export class Physics {
  constructor() {
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = FIXED_DT;
    const ip = this.world.integrationParameters;
    ip.numSolverIterations = 8;
    ip.maxCcdSubsteps = 2;
    this.events = new RAPIER.EventQueue(true);
    this.accumulator = 0;
    this.colliderInfo = new Map(); // collider handle -> info object
    this.velCache = new Map(); // body handle -> {lin, ang, com}
    this.tracked = new Set(); // bodies whose pre-step velocity we cache
  }

  register(collider, info) { this.colliderInfo.set(collider.handle, info); }
  unregister(collider) { this.colliderInfo.delete(collider.handle); }
  info(handle) { return this.colliderInfo.get(handle); }

  track(body) { this.tracked.add(body); }
  untrack(body) { this.tracked.delete(body); this.velCache.delete(body.handle); }

  cacheVelocities() {
    for (const b of this.tracked) {
      let c = this.velCache.get(b.handle);
      if (!c) { c = { lin: { x: 0, y: 0, z: 0 }, ang: { x: 0, y: 0, z: 0 }, com: { x: 0, y: 0, z: 0 } }; this.velCache.set(b.handle, c); }
      const l = b.linvel(), a = b.angvel(), m = b.worldCom();
      c.lin.x = l.x; c.lin.y = l.y; c.lin.z = l.z;
      c.ang.x = a.x; c.ang.y = a.y; c.ang.z = a.z;
      c.com.x = m.x; c.com.y = m.y; c.com.z = m.z;
    }
  }

  /** Velocity of `body` at world point p, measured before the last solver step. */
  preVelocityAt(body, p, out) {
    const c = this.velCache.get(body.handle);
    if (!c) { const v = body.velocityAtPoint(p); out.x = v.x; out.y = v.y; out.z = v.z; return out; }
    const rx = p.x - c.com.x, ry = p.y - c.com.y, rz = p.z - c.com.z;
    out.x = c.lin.x + c.ang.y * rz - c.ang.z * ry;
    out.y = c.lin.y + c.ang.z * rx - c.ang.x * rz;
    out.z = c.lin.z + c.ang.x * ry - c.ang.y * rx;
    return out;
  }

  removeBody(body) {
    if (!body) return;
    for (let i = 0; i < body.numColliders(); i++) this.unregister(body.collider(i));
    this.untrack(body);
    this.world.removeRigidBody(body);
  }
}
