// Enemy pool, AI and instanced rendering.
import * as THREE from 'three';
import { ENEMIES } from '../../data/enemies';
import type { EnemyKind } from '../../data/types';
import { CONFIG } from '../GameConfig';
import { buildEnemyParts, ENEMY_MODEL_SCALE } from '../models/enemyModels';
import { SpatialGrid } from '../SpatialGrid';
import { angleDiff, rand } from '../util';
import { createEnemy, newEnemyId, type Enemy } from './Enemy';
import type { Run } from '../Run';

const E = CONFIG.enemies;
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const WHITE = new THREE.Color(1, 1, 1);
const ELITE = new THREE.Color('#ffcf33');
const ALL_KINDS: EnemyKind[] = ['slime', 'bigSlime', 'goblin', 'brute', 'shaman', 'exploder'];

interface PartMesh { mesh: THREE.InstancedMesh; color: THREE.Color; tintable: boolean }

export interface SpawnOpts { chest?: boolean; elite?: boolean; hpMult?: number; dmgMult?: number; speedMult?: number; summoned?: boolean }

export class EnemyManager {
  pool: Enemy[] = [];
  grid: SpatialGrid<Enemy>;
  cap: number;
  aliveCount = 0;
  private parts: Record<EnemyKind, PartMesh[]>;
  private aura: THREE.InstancedMesh;
  private shadows: THREE.InstancedMesh;
  constructor(scene: THREE.Scene, cap: number, worldRadius: number) {
    this.cap = cap;
    this.grid = new SpatialGrid<Enemy>(worldRadius + 12, 2.5);
    for (let i = 0; i < cap + 8; i++) this.pool.push(createEnemy());
    const parts = {} as Record<EnemyKind, PartMesh[]>;
    for (const kind of ALL_KINDS) {
      parts[kind] = buildEnemyParts(kind).map((p) => {
        const material = p.glow ? new THREE.MeshBasicMaterial({ color: 0xffffff }) : new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
        const mesh = new THREE.InstancedMesh(p.geo, material, cap);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.setColorAt(0, WHITE);
        mesh.count = 0;
        mesh.frustumCulled = false;
        scene.add(mesh);
        return { mesh, color: new THREE.Color(p.color), tintable: !!p.tintable };
      });
    }
    this.parts = parts;
    this.aura = new THREE.InstancedMesh(new THREE.RingGeometry(0.75, 1, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffd60a', transparent: true, opacity: 0.8, depthWrite: false }), 64);
    this.aura.count = 0;
    this.aura.frustumCulled = false;
    scene.add(this.aura);
    const sh = new THREE.CircleGeometry(1, 12).rotateX(-Math.PI / 2);
    this.shadows = new THREE.InstancedMesh(sh, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }), cap + 8);
    this.shadows.count = 0;
    this.shadows.frustumCulled = false;
    scene.add(this.shadows);
  }

  dispose() {
    for (const kind of ALL_KINDS) for (const p of this.parts[kind]) { p.mesh.removeFromParent(); p.mesh.geometry.dispose(); (p.mesh.material as THREE.Material).dispose(); p.mesh.dispose(); }
    for (const m of [this.aura, this.shadows]) { m.removeFromParent(); m.geometry.dispose(); (m.material as THREE.Material).dispose(); m.dispose(); }
  }

  get regularCount() { return this.aliveCount; }

  spawn(kind: EnemyKind, x: number, z: number, run: Run, opts: SpawnOpts = {}): Enemy | null {
    if (this.aliveCount >= this.cap && !opts.elite) return null;
    const e = this.pool.find((p) => !p.active);
    if (!e) return null;
    const def = ENEMIES[kind];
    const min = run.timelineMinutes;
    const diff = run.difficulty;
    const map = run.map;
    const elite = !!opts.elite;
    e.id = newEnemyId();
    e.active = true; e.alive = true; e.kind = kind; e.def = def;
    e.x = x; e.z = z; e.vx = 0; e.vz = 0;
    e.facing = Math.atan2(run.player.z - z, run.player.x - x);
    const hp = def.hp * E.hpScale(min) * diff.hp * (opts.hpMult ?? 1) * (elite ? E.eliteHp : 1);
    e.hp = e.maxHp = hp;
    e.speed = def.speed * E.speedScale(min) * map.enemySpeedMult * (opts.speedMult ?? 1) * (elite ? 1.1 : 1) * rand(0.92, 1.08);
    e.damage = def.damage * E.damageScale(min) * diff.damage * map.enemyDamageMult * (opts.dmgMult ?? 1) * (elite ? E.eliteDamage : 1);
    e.scale = ENEMY_MODEL_SCALE[kind] * (elite ? E.eliteScale : 1);
    e.radius = def.radius * (elite ? E.eliteScale : 1);
    e.xp = def.xp * E.xpScale(min) * map.xpMult * (elite ? 12 : 1);
    e.kbResist = elite ? Math.min(0.95, def.knockbackResist + 0.5) : def.knockbackResist;
    e.elite = elite;
    e.flash = 0; e.attackT = rand(0.2, 1); e.state = 'chase'; e.stateT = rand(1, 4);
    e.slowT = 0; e.anim = Math.random() * 10; e.flank = (Math.random() < 0.5 ? -1 : 1) * rand(0.6, 1.2);
    e.dyingT = 0; e.bladeHitT = -1; e.bladeHitT2 = -1; e.chargeHitId = -1; e.poisonT = 0; e.telegraph = null;
    e.goldChance = def.goldChance * (elite ? 10 : 1);
    e.summoned = !!opts.summoned;
    e.dropsChest = !!opts.chest;
    this.aliveCount++;
    return e;
  }

  /** Registers a boss as a targetable entity (rendered by its controller). */
  spawnBoss(x: number, z: number, hp: number, radius: number): Enemy {
    const e = this.pool.find((p) => !p.active) ?? (() => { const n = createEnemy(); this.pool.push(n); return n; })();
    Object.assign(e, createEnemy());
    e.id = newEnemyId();
    e.active = true; e.alive = true; e.kind = 'boss'; e.def = null;
    e.x = x; e.z = z; e.hp = e.maxHp = hp; e.radius = radius; e.kbResist = 1; e.scale = 1;
    return e;
  }

  /** Called by Run when an enemy's hp reaches zero. */
  markDead(e: Enemy) {
    if (!e.alive) return;
    e.alive = false;
    e.dyingT = 0.16;
    if (e.kind !== 'boss') this.aliveCount--;
    if (e.telegraph) { e.telegraph = null; }
  }

  clear(run: Run) {
    for (const e of this.pool) {
      if (e.telegraph) run.vfx.release(e.telegraph);
      e.telegraph = null;
      e.active = false; e.alive = false;
    }
    this.aliveCount = 0;
    this.grid.build(this.pool);
  }

  update(dt: number, run: Run) {
    const p = run.player;
    for (const e of this.pool) {
      if (!e.active) continue;
      if (!e.alive) {
        e.dyingT -= dt;
        if (e.dyingT <= 0) e.active = false;
        continue;
      }
      e.flash = Math.max(0, e.flash - dt * 7);
      if (e.kind === 'boss') continue;
      e.anim += dt;
      e.attackT -= dt;
      if (e.slowT > 0) e.slowT -= dt;

      const dx = p.x - e.x, dz = p.z - e.z;
      const dist = Math.hypot(dx, dz) || 0.001;
      const nx = dx / dist, nz = dz / dist;

      // relocate stragglers so pressure stays on the player
      if (dist > E.despawnDist && !e.elite) {
        const a = Math.atan2(p.vz, p.vx) + rand(-1, 1);
        const moving = Math.hypot(p.vx, p.vz) > 1;
        const ang = moving ? a : Math.random() * Math.PI * 2;
        const pos = run.director.ringPoint(ang);
        e.x = pos.x; e.z = pos.z;
        continue;
      }

      const kbSpeed = Math.hypot(e.vx, e.vz);
      const staggered = kbSpeed > 3.5;
      let speed = e.speed * (e.slowT > 0 ? 0.5 : 1);
      let mvx = 0, mvz = 0;
      const kind = e.kind;
      const def = e.def!;

      if (!staggered) {
        switch (kind) {
          case 'slime':
          case 'bigSlime': {
            const hop = 0.55 + 0.75 * Math.max(0, Math.sin(e.anim * 6));
            mvx = nx * speed * hop; mvz = nz * speed * hop;
            break;
          }
          case 'goblin': {
            if (dist > 5) {
              const side = e.flank * Math.min(0.9, dist / 14);
              const ax = nx * Math.cos(side) - nz * Math.sin(side);
              const az = nx * Math.sin(side) + nz * Math.cos(side);
              mvx = ax * speed; mvz = az * speed;
            } else { mvx = nx * speed; mvz = nz * speed; }
            break;
          }
          case 'brute':
          default:
            mvx = nx * speed; mvz = nz * speed;
            break;
          case 'shaman': {
            if (e.state === 'cast') {
              e.stateT -= dt;
              if (e.stateT <= 0) {
                const lead = 0.45;
                const tx = p.x + p.vx * lead - e.x, tz = p.z + p.vz * lead - e.z;
                const base = Math.atan2(tz, tx);
                const shots = e.elite ? 3 : 1;
                for (let k = 0; k < shots; k++) {
                  const a = base + (k - (shots - 1) / 2) * 0.28;
                  run.projectiles.enemyBolt(e.x, e.z, Math.cos(a), Math.sin(a), 9.5, e.damage, 'bolt');
                }
                run.sfx('enemyShot');
                e.state = 'chase';
                e.attackT = def.attackCooldown * rand(0.85, 1.2);
              }
            } else {
              const pref = 10;
              let fx = 0, fz = 0;
              if (dist > pref + 3) { fx = nx; fz = nz; }
              else if (dist < pref - 3) { fx = -nx; fz = -nz; }
              else { fx = -nz * e.flank; fz = nx * e.flank; }
              mvx = fx * speed; mvz = fz * speed;
              if (e.attackT <= 0 && dist < 17) { e.state = 'cast'; e.stateT = 0.55; }
            }
            break;
          }
          case 'exploder': {
            if (e.state === 'fuse') {
              e.stateT -= dt;
              const r = CONFIG.enemies.exploderRadius * (e.elite ? 1.5 : 1);
              if (e.telegraph) run.vfx.setCircle(e.telegraph, e.x, e.z, r, 1 - e.stateT / CONFIG.enemies.exploderFuse);
              if (e.stateT <= 0) {
                run.exploderDetonate(e, true);
                continue;
              }
            } else {
              mvx = nx * speed; mvz = nz * speed;
              if (dist < 2.4 + e.radius) {
                e.state = 'fuse';
                e.stateT = CONFIG.enemies.exploderFuse;
                e.telegraph = run.vfx.telegraph('circle', '#ff2e2e');
                run.sfx('fuse');
              }
            }
            break;
          }
        }
        // elite dash attack (melee kinds)
        if (e.elite && kind !== 'shaman' && kind !== 'exploder') {
          if (e.state === 'chase') {
            e.stateT -= dt;
            if (e.stateT <= 0 && dist < 13 && dist > 3) {
              e.state = 'windup'; e.stateT = 0.75; e.dirX = nx; e.dirZ = nz;
              e.telegraph = run.vfx.telegraph('rect', '#ff9f1c');
            }
          } else if (e.state === 'windup') {
            e.stateT -= dt;
            mvx = 0; mvz = 0;
            if (e.telegraph) run.vfx.setRect(e.telegraph, e.x, e.z, Math.atan2(e.dirZ, e.dirX), 9, e.radius * 2, 1 - e.stateT / 0.75);
            if (e.stateT <= 0) {
              if (e.telegraph) { run.vfx.release(e.telegraph); e.telegraph = null; }
              e.state = 'dash'; e.stateT = 0.45;
            }
          } else if (e.state === 'dash') {
            e.stateT -= dt;
            mvx = e.dirX * 20; mvz = e.dirZ * 20;
            if (Math.random() < 0.5) run.particles.emit(e.x, 0.3, e.z, 0, 1, 0, 0.3, 0.25, '#ffd166', 2);
            if (e.stateT <= 0) { e.state = 'chase'; e.stateT = rand(3, 5); }
          }
        }
      }

      e.vx *= Math.exp(-7 * dt);
      e.vz *= Math.exp(-7 * dt);
      e.x += (mvx + e.vx) * dt;
      e.z += (mvz + e.vz) * dt;
      if (mvx || mvz) {
        const want = Math.atan2(mvz, mvx);
        e.facing += angleDiff(e.facing, kind === 'shaman' ? Math.atan2(nz, nx) : want) * Math.min(1, dt * 8);
      }

      // separation against neighbours
      let pushes = 0;
      this.grid.query(e.x, e.z, e.radius, (o) => {
        if (o === e || o.kind === 'boss') return;
        const ox = e.x - o.x, oz = e.z - o.z;
        const min = e.radius + o.radius;
        const d2 = ox * ox + oz * oz;
        if (d2 < min * min && d2 > 1e-6) {
          const d = Math.sqrt(d2);
          const push = (min - d) * 0.5;
          e.x += (ox / d) * push; e.z += (oz / d) * push;
        }
        return ++pushes > 6;
      });
      run.world.resolve(e, e.radius * 0.8);

      // contact damage
      const reach = e.radius + p.radius + E.contactPadding;
      if (kind !== 'exploder' && dist < reach && e.attackT <= 0 && p.alive) {
        if (run.damagePlayer(e.damage, { x: e.x, z: e.z, attacker: e, label: e.def!.name })) e.attackT = def.attackCooldown;
        else e.attackT = 0.15;
      }
    }
    this.grid.build(this.pool);
  }

  render(time: number) {
    const counts: Record<EnemyKind, number> = { slime: 0, bigSlime: 0, goblin: 0, brute: 0, shaman: 0, exploder: 0 };
    let auraN = 0, shN = 0;
    for (const e of this.pool) {
      if (!e.active) continue;
      if (e.kind === 'boss') continue;
      const kind = e.kind;
      const i = counts[kind]++;
      let y = 0, sx = 1, sy = 1, tilt = 0, roll = 0;
      const a = e.anim;
      switch (kind) {
        case 'slime': case 'bigSlime': {
          const h = Math.max(0, Math.sin(a * 6));
          y = h * 0.35 * e.scale;
          sy = 1 + h * 0.15 - (1 - h) * 0.12; sx = 1 / Math.sqrt(sy);
          break;
        }
        case 'goblin': y = Math.abs(Math.sin(a * 12)) * 0.12; tilt = 0.25; roll = Math.sin(a * 12) * 0.08; break;
        case 'brute': roll = Math.sin(a * 3.5) * 0.07; y = Math.abs(Math.sin(a * 3.5)) * 0.06; break;
        case 'shaman': y = 0.15 + Math.sin(a * 2.5) * 0.12; if (e.state === 'cast') { sy = 1.1; tilt = -0.2; } break;
        case 'exploder': {
          roll = Math.sin(a * 14) * 0.12; y = Math.abs(Math.sin(a * 14)) * 0.1;
          if (e.state === 'fuse') { const t = 1 - e.stateT / CONFIG.enemies.exploderFuse; sx = sy = 1 + t * 0.45; roll = Math.sin(a * 60) * 0.1; }
          break;
        }
      }
      if (e.state === 'windup') { sy *= 0.85; sx *= 1.12; roll = Math.sin(a * 50) * 0.08; }
      let s = e.scale;
      let dyingPop = 1;
      if (!e.alive) { dyingPop = Math.max(0, e.dyingT / 0.16); s *= 1 + (1 - dyingPop) * 0.5; sy *= dyingPop; }
      if (e.flash > 0) { sx *= 1 + e.flash * 0.15; sy *= 1 - e.flash * 0.1; }
      _e.set(tilt, Math.PI / 2 - e.facing, roll, 'YXZ');
      _q.setFromEuler(_e);
      _m.compose(_p.set(e.x, y, e.z), _q, _s.set(s * sx, s * sy, s * sx));
      const flash = !e.alive ? 1 : e.flash;
      const fusePulse = e.state === 'fuse' ? (Math.sin(time * 40) > 0 ? 0.7 : 0) : 0;
      for (const part of this.parts[kind]) {
        part.mesh.setMatrixAt(i, _m);
        _c.copy(part.color);
        if (e.elite && part.tintable) _c.lerp(ELITE, 0.45);
        if (part.tintable && fusePulse) _c.lerp(WHITE, fusePulse);
        if (flash > 0) _c.lerp(WHITE, Math.min(1, flash));
        part.mesh.setColorAt(i, _c);
      }
      if (e.elite && e.alive && auraN < 64) {
        _m.compose(_p.set(e.x, 0.06, e.z), _q.setFromEuler(_e.set(0, time * 2, 0)), _s.setScalar(e.radius * 1.6 + Math.sin(time * 6) * 0.1));
        this.aura.setMatrixAt(auraN++, _m);
      }
      _m.compose(_p.set(e.x, 0.03, e.z), _q.identity(), _s.setScalar(e.radius * 1.1 * dyingPop));
      this.shadows.setMatrixAt(shN++, _m);
    }
    for (const kind of ALL_KINDS) {
      for (const part of this.parts[kind]) {
        part.mesh.count = counts[kind];
        part.mesh.instanceMatrix.needsUpdate = true;
        if (part.mesh.instanceColor) part.mesh.instanceColor.needsUpdate = true;
      }
    }
    this.aura.count = auraN;
    this.aura.instanceMatrix.needsUpdate = true;
    this.shadows.count = shN;
    this.shadows.instanceMatrix.needsUpdate = true;
  }
}
