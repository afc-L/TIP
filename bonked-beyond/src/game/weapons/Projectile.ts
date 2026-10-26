// Pooled projectiles for both sides with one InstancedMesh per visual type.
import * as THREE from 'three';
import { box, cone, cyl, dodeca, merge, sphere } from '../models/shapes';
import type { Run } from '../Run';
import type { WeaponInstance } from './WeaponManager';

export type ProjType = 'knife' | 'orb' | 'boomerang' | 'rocket' | 'bolt' | 'scrap';

export interface Projectile {
  active: boolean;
  type: ProjType;
  enemy: boolean;
  x: number; y: number; z: number;
  vx: number; vz: number;
  speed: number;
  life: number;
  damage: number;
  pierce: number;
  radius: number;
  hits: number[];
  kb: number;
  crit: number;
  weapon: WeaponInstance | null;
  phase: number;
  traveled: number;
  maxDist: number;
  targetId: number;
  spin: number;
  scale: number;
  evolved: boolean;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

const CAP = 420;

export class ProjectileManager {
  pool: Projectile[] = [];
  private meshes: Record<ProjType, THREE.InstancedMesh>;

  constructor(scene: THREE.Scene) {
    for (let i = 0; i < CAP; i++) this.pool.push(this.blank());
    const lam = (c: string) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
    const basic = (c: string) => new THREE.MeshBasicMaterial({ color: c });
    const mk = (geo: THREE.BufferGeometry, mat: THREE.Material, n: number) => {
      const m = new THREE.InstancedMesh(geo, mat, n);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.count = 0;
      m.frustumCulled = false;
      scene.add(m);
      return m;
    };
    this.meshes = {
      knife: mk(merge([box(0.08, 0.04, 0.6, { p: [0, 0, 0.15] }), box(0.2, 0.06, 0.06, { p: [0, 0, -0.17] }), box(0.06, 0.06, 0.2, { p: [0, 0, -0.3] })]), lam('#e9ecef'), 200),
      orb: mk(sphere(1, {}, 1), basic('#c77dff'), 160),
      boomerang: mk(merge([box(0.85, 0.08, 0.22, { p: [0.3, 0, 0.2], r: [0, 0.6, 0] }), box(0.85, 0.08, 0.22, { p: [-0.3, 0, 0.2], r: [0, -0.6, 0] })]), lam('#f77f00'), 60),
      rocket: mk(merge([cyl(0.14, 0.14, 0.7, { r: [Math.PI / 2, 0, 0] }, 8), cone(0.14, 0.3, { p: [0, 0, 0.5], r: [Math.PI / 2, 0, 0] }, 8), box(0.45, 0.05, 0.15, { p: [0, 0, -0.3] }), box(0.05, 0.45, 0.15, { p: [0, 0, -0.3] })]), lam('#ef233c'), 60),
      bolt: mk(sphere(1, {}, 1), basic('#f72585'), 160),
      scrap: mk(dodeca(1), basic('#ff9f1c'), 160),
    };
  }

  private blank(): Projectile {
    return { active: false, type: 'knife', enemy: false, x: 0, y: 0.8, z: 0, vx: 0, vz: 0, speed: 0, life: 0, damage: 0, pierce: 1, radius: 0.3, hits: [], kb: 0, crit: 0, weapon: null, phase: 0, traveled: 0, maxDist: 0, targetId: -1, spin: 0, scale: 1, evolved: false };
  }

  spawn(type: ProjType, x: number, z: number, dx: number, dz: number, speed: number, init: Partial<Projectile> = {}): Projectile | null {
    const p = this.pool.find((q) => !q.active);
    if (!p) return null;
    const l = Math.hypot(dx, dz) || 1;
    Object.assign(p, this.blank(), { hits: p.hits }, init);
    p.hits.length = 0;
    p.active = true; p.type = type; p.x = x; p.z = z; p.y = init.y ?? 0.9;
    p.vx = (dx / l) * speed; p.vz = (dz / l) * speed; p.speed = speed;
    return p;
  }

  enemyBolt(x: number, z: number, dx: number, dz: number, speed: number, damage: number, type: 'bolt' | 'scrap', scale = 0.28) {
    this.spawn(type, x, z, dx, dz, speed, { enemy: true, damage, life: 4, radius: scale + 0.1, scale, y: 1.1 });
  }

  clear() { for (const p of this.pool) p.active = false; }

  activeCount(type: ProjType, weapon?: WeaponInstance) {
    let n = 0;
    for (const p of this.pool) if (p.active && p.type === type && (!weapon || p.weapon === weapon)) n++;
    return n;
  }

  update(dt: number, run: Run) {
    const pl = run.player;
    for (const p of this.pool) {
      if (!p.active) continue;
      p.life -= dt;
      p.spin += dt;
      if (p.enemy) {
        p.x += p.vx * dt; p.z += p.vz * dt;
        const dx = pl.x - p.x, dz = pl.z - p.z;
        if (dx * dx + dz * dz < (p.radius + pl.radius) ** 2 && pl.alive) {
          if (run.damagePlayer(p.damage, { x: p.x, z: p.z, label: 'projectile', major: p.type === 'scrap' })) {
            p.active = false;
            run.particles.burst(p.x, 1, p.z, 6, p.type === 'scrap' ? '#ff9f1c' : '#f72585', 3, 0.15, 0.3);
            continue;
          }
        }
        if (p.life <= 0 || run.world.blocked(p.x, p.z, 0.1)) p.active = false;
        continue;
      }
      switch (p.type) {
        case 'orb': {
          const t = run.enemies.pool.find((e) => e.id === p.targetId && e.alive);
          if (t) {
            const dx = t.x - p.x, dz = t.z - p.z;
            const l = Math.hypot(dx, dz) || 1;
            const turn = Math.min(1, dt * 6);
            p.vx += ((dx / l) * p.speed - p.vx) * turn;
            p.vz += ((dz / l) * p.speed - p.vz) * turn;
          } else if (Math.random() < 0.1) {
            const n = run.enemies.grid.nearest(p.x, p.z, 10, (e) => !p.hits.includes(e.id));
            p.targetId = n ? n.id : -1;
          }
          break;
        }
        case 'boomerang': {
          if (p.phase === 0 && p.traveled >= p.maxDist) { p.phase = 1; p.hits.length = 0; }
          if (p.phase === 1) {
            const dx = pl.x - p.x, dz = pl.z - p.z;
            const l = Math.hypot(dx, dz) || 1;
            p.vx = (dx / l) * p.speed * 1.15; p.vz = (dz / l) * p.speed * 1.15;
            if (l < 1.2) {
              if (p.evolved) {
                // relaunch in a new direction: never lands
                const a = Math.atan2(p.vz, p.vx) + Math.PI + 2.4;
                p.vx = Math.cos(a) * p.speed; p.vz = Math.sin(a) * p.speed;
                p.phase = 0; p.traveled = 0; p.hits.length = 0;
                if (p.weapon) { p.damage = p.weapon.stats.damage; }
              } else { p.active = false; continue; }
            }
          }
          break;
        }
        case 'rocket':
          if (Math.random() < 0.7) run.particles.emit(p.x - p.vx * 0.03, 0.9, p.z - p.vz * 0.03, (Math.random() - 0.5), 0.5, (Math.random() - 0.5), 0.35, 0.18, Math.random() < 0.5 ? '#ffd166' : '#adb5bd', -1);
          break;
      }
      const stepX = p.vx * dt, stepZ = p.vz * dt;
      p.x += stepX; p.z += stepZ;
      p.traveled += Math.hypot(stepX, stepZ);

      let done = false;
      run.enemies.grid.query(p.x, p.z, p.radius, (e) => {
        if (p.hits.includes(e.id)) return;
        p.hits.push(e.id);
        if (p.type === 'rocket') { done = true; return true; }
        const l = Math.hypot(p.vx, p.vz) || 1;
        run.hitEnemy(e, p.damage, { crit: p.crit, kb: p.kb, dirX: p.vx / l, dirZ: p.vz / l, weapon: p.weapon });
        if (p.type === 'orb' && p.evolved) { done = true; return true; }
        if (--p.pierce <= 0) { done = true; return true; }
      });
      const expired = p.life <= 0 || (p.type !== 'boomerang' && run.world.blocked(p.x, p.z, 0.05));
      if (done || expired) {
        if (p.type === 'boomerang' && !done) { if (p.life <= 0 && !p.evolved) p.active = false; continue; }
        if (p.type === 'boomerang') continue;
        p.active = false;
        if (p.type === 'rocket') run.weapons.rocketExplode(p, run);
        if (p.type === 'orb' && p.evolved) run.weapons.spawnBlackHole(p.x, p.z, p, run);
      }
    }
  }

  render() {
    const counts: Record<ProjType, number> = { knife: 0, orb: 0, boomerang: 0, rocket: 0, bolt: 0, scrap: 0 };
    for (const p of this.pool) {
      if (!p.active) continue;
      const mesh = this.meshes[p.type];
      const i = counts[p.type]++;
      if (i >= mesh.instanceMatrix.count) continue;
      const yaw = Math.PI / 2 - Math.atan2(p.vz, p.vx);
      let s = p.scale;
      switch (p.type) {
        case 'boomerang': _e.set(0, p.spin * 18, 0); break;
        case 'orb': case 'bolt': s *= 1 + Math.sin(p.spin * 25) * 0.12; _e.set(0, 0, 0); break;
        case 'scrap': _e.set(p.spin * 8, p.spin * 6, 0); break;
        default: _e.set(0, yaw, 0);
      }
      _q.setFromEuler(_e);
      _m.compose(_p.set(p.x, p.y, p.z), _q, _s.set(s, s, s));
      mesh.setMatrixAt(i, _m);
    }
    for (const k of Object.keys(this.meshes) as ProjType[]) {
      const m = this.meshes[k];
      m.count = Math.min(counts[k], m.instanceMatrix.count);
      m.instanceMatrix.needsUpdate = true;
    }
  }

  dispose() {
    for (const m of Object.values(this.meshes)) { m.removeFromParent(); m.geometry.dispose(); (m.material as THREE.Material).dispose(); m.dispose(); }
  }
}
