// Ambient traffic: low-poly cars following lanes on the road grid with simple yielding.
import * as THREE from 'three';
import { LANE, ROADS_X, ROADS_Z, ROAD_W } from '../data/world';
import { buildTrafficCar } from './carModel';

interface TCar {
  mesh: THREE.Mesh;
  i: number; // target node index x
  j: number; // target node index z
  dx: number; // current direction
  dz: number;
  x: number;
  z: number;
  yaw: number;
  speed: number;
  max: number;
  queue: { x: number; z: number }[];
  honk: number;
  stuck: number;
}

const COLORS = ['#f4f4f4', '#111111', '#7d8187', '#1b3b7a', '#6b0f1a', '#c9ccd1', '#0f4d3a', '#d7c49e', '#ff5fa2', '#e6b422', '#2b2b2b', '#ffffff'];
const TURN = ROAD_W / 2 + 2;

export class Traffic {
  cars: TCar[] = [];
  group = new THREE.Group();

  constructor(count: number) {
    let seed = 42;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let n = 0; n < count; n++) {
      const mesh = buildTrafficCar(COLORS[n % COLORS.length], n % 3);
      this.group.add(mesh);
      // start on a random edge
      const horizontal = r() < 0.5;
      let i = Math.floor(r() * ROADS_X.length), j = Math.floor(r() * ROADS_Z.length);
      let dx = 0, dz = 0;
      if (horizontal) {
        dx = r() < 0.5 ? 1 : -1;
        if (i + dx < 0 || i + dx >= ROADS_X.length) dx = -dx;
      } else {
        dz = r() < 0.5 ? 1 : -1;
        if (j + dz < 0 || j + dz >= ROADS_Z.length) dz = -dz;
      }
      const sx = ROADS_X[i], sz = ROADS_Z[j];
      i += dx;
      j += dz;
      const rx = -dz, rz = dx;
      const c: TCar = {
        mesh, i, j, dx, dz, x: sx + dx * TURN + rx * LANE, z: sz + dz * TURN + rz * LANE, yaw: Math.atan2(dx, dz), speed: 8, max: 9 + r() * 5, queue: [], honk: 0, stuck: 0,
      };
      this.planSegment(c);
      this.cars.push(c);
    }
  }

  private planSegment(c: TCar) {
    const nx = ROADS_X[c.i], nz = ROADS_Z[c.j];
    const rx = -c.dz, rz = c.dx;
    c.queue.push({ x: nx - c.dx * TURN + rx * LANE, z: nz - c.dz * TURN + rz * LANE });
    // choose next direction at the node
    const opts: [number, number][] = [];
    const dirs: [number, number][] = [[c.dx, c.dz], [-c.dz, c.dx], [c.dz, -c.dx]];
    for (const [ddx, ddz] of dirs) {
      const ni = c.i + ddx, nj = c.j + ddz;
      if (ni < 0 || ni >= ROADS_X.length || nj < 0 || nj >= ROADS_Z.length) continue;
      opts.push([ddx, ddz]);
    }
    let nd: [number, number];
    if (!opts.length) nd = [-c.dx, -c.dz];
    else {
      const straight = opts.find(([a, b]) => a === c.dx && b === c.dz);
      nd = straight && Math.random() < 0.55 ? straight : opts[Math.floor(Math.random() * opts.length)];
    }
    const [ndx, ndz] = nd;
    const r2x = -ndz, r2z = ndx;
    const p0 = c.queue[c.queue.length - 1];
    const p2 = { x: nx + ndx * TURN + r2x * LANE, z: nz + ndz * TURN + r2z * LANE };
    let ctrl: { x: number; z: number };
    if (ndx === c.dx && ndz === c.dz) ctrl = { x: nx + rx * LANE, z: nz + rz * LANE };
    else if (ndx === -c.dx && ndz === -c.dz) ctrl = { x: nx + c.dx * 6, z: nz + c.dz * 6 };
    else ctrl = { x: nx + rx * LANE + r2x * LANE, z: nz + rz * LANE + r2z * LANE };
    for (let k = 1; k <= 5; k++) {
      const t = k / 5;
      const a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, d = t * t;
      c.queue.push({ x: a * p0.x + b * ctrl.x + d * p2.x, z: a * p0.z + b * ctrl.z + d * p2.z });
    }
    c.dx = ndx;
    c.dz = ndz;
    c.i += ndx;
    c.j += ndz;
  }

  /** obstacles: list of {x,z} the cars must yield to */
  update(dt: number, obstacles: { x: number; z: number; r: number }[]) {
    for (const c of this.cars) {
      if (!c.queue.length) this.planSegment(c);
      const tgt = c.queue[0];
      const ddx = tgt.x - c.x, ddz = tgt.z - c.z;
      const dist = Math.hypot(ddx, ddz);
      if (dist < 1.2) {
        c.queue.shift();
        if (c.queue.length < 2) this.planSegment(c);
        continue;
      }
      const desiredYaw = Math.atan2(ddx, ddz);
      let dy = desiredYaw - c.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      c.yaw += dy * Math.min(1, dt * 6);
      // yield to obstacles ahead
      const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
      let block = false;
      for (const o of obstacles) {
        const ox = o.x - c.x, oz = o.z - c.z;
        const along = ox * fx + oz * fz;
        if (along < 0 || along > 11 + o.r) continue;
        const side = Math.abs(ox * fz - oz * fx);
        if (side < 1.6 + o.r) {
          block = true;
          break;
        }
      }
      if (!block)
        for (const o of this.cars) {
          if (o === c) continue;
          const ox = o.x - c.x, oz = o.z - c.z;
          const along = ox * fx + oz * fz;
          if (along < 0 || along > 9) continue;
          if (Math.abs(ox * fz - oz * fx) < 1.8) {
            block = true;
            break;
          }
        }
      const turning = Math.abs(dy) > 0.3;
      const target = block ? 0 : turning ? Math.min(c.max, 7) : c.max;
      if (block) c.stuck += dt;
      else c.stuck = 0;
      // anti-deadlock: after waiting a while, creep forward
      const tgtSpeed = c.stuck > 6 ? 2 : target;
      c.speed += (tgtSpeed - c.speed) * Math.min(1, dt * (tgtSpeed < c.speed ? 4 : 1.2));
      c.x += fx * c.speed * dt;
      c.z += fz * c.speed * dt;
      c.honk = Math.max(0, c.honk - dt);
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.yaw;
    }
  }

  setVisibleCount(n: number) {
    this.cars.forEach((c, i) => (c.mesh.visible = i < n));
  }
}
