// Enemy pool, AI and instanced rendering (models, elite auras, health bars, outlines).
import * as THREE from 'three';
import { ELITE_MODS, ENEMIES } from '../../data/enemies';
import type { EliteMod, EnemyKind } from '../../data/types';
import { getSettings } from '../../store/settingsStore';
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
const _cam = new THREE.Quaternion();
const WHITE = new THREE.Color(1, 1, 1);
const ELITE = new THREE.Color('#ffcf33');
const ALL_KINDS = Object.keys(ENEMIES) as EnemyKind[];
const MOD_COLORS = Object.fromEntries(Object.values(ELITE_MODS).map((m) => [m.id, new THREE.Color(m.color)])) as Record<EliteMod, THREE.Color>;
const ALL_MODS = Object.keys(ELITE_MODS) as EliteMod[];
const BAR_CAP = 90;

interface PartMesh { mesh: THREE.InstancedMesh; color: THREE.Color; tintable: boolean }

export interface SpawnOpts { chest?: boolean; elite?: boolean; mods?: EliteMod[]; hpMult?: number; dmgMult?: number; speedMult?: number; summoned?: boolean; dormant?: boolean }

export class EnemyManager {
  pool: Enemy[] = [];
  grid: SpatialGrid<Enemy>;
  cap: number;
  aliveCount = 0;
  /** Kinds encountered this run (for the codex). */
  seen = new Set<string>();
  private parts: Record<EnemyKind, PartMesh[]>;
  private outlines: Record<EnemyKind, THREE.InstancedMesh>;
  private aura: THREE.InstancedMesh;
  private shadows: THREE.InstancedMesh;
  private barBg: THREE.InstancedMesh;
  private barFill: THREE.InstancedMesh;

  constructor(scene: THREE.Scene, cap: number, worldRadius: number) {
    this.cap = cap;
    this.grid = new SpatialGrid<Enemy>(worldRadius + 12, 2.5);
    for (let i = 0; i < cap + 24; i++) this.pool.push(createEnemy());
    const parts = {} as Record<EnemyKind, PartMesh[]>;
    const outlines = {} as Record<EnemyKind, THREE.InstancedMesh>;
    const outlineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.BackSide });
    for (const kind of ALL_KINDS) {
      const defs = buildEnemyParts(kind);
      parts[kind] = defs.map((p) => {
        const material = p.glow ? new THREE.MeshBasicMaterial({ color: 0xffffff }) : new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
        const mesh = this.instanced(scene, p.geo, material, cap);
        return { mesh, color: new THREE.Color(p.color), tintable: !!p.tintable };
      });
      // high-contrast outline: the main body part, inflated around its centre and drawn back-faced
      const body = (defs.find((d) => d.tintable) ?? defs[0]).geo.clone();
      body.computeBoundingSphere();
      const c = body.boundingSphere!.center.clone();
      body.translate(-c.x, -c.y, -c.z);
      body.scale(1.13, 1.13, 1.13);
      body.translate(c.x, c.y, c.z);
      outlines[kind] = this.instanced(scene, body, outlineMat, cap);
    }
    this.parts = parts;
    this.outlines = outlines;
    this.aura = this.instanced(scene, new THREE.RingGeometry(0.75, 1, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false }), 128);
    this.shadows = this.instanced(scene, new THREE.CircleGeometry(1, 12).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }), cap + 24);
    this.barBg = this.instanced(scene, new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.75, depthTest: false }), BAR_CAP);
    const fillGeo = new THREE.PlaneGeometry(1, 1).translate(0.5, 0, 0);
    this.barFill = this.instanced(scene, fillGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false }), BAR_CAP);
    this.barBg.renderOrder = 9;
    this.barFill.renderOrder = 10;
  }

  private instanced(scene: THREE.Scene, geo: THREE.BufferGeometry, mat: THREE.Material, n: number) {
    const mesh = new THREE.InstancedMesh(geo, mat, n);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.setColorAt(0, WHITE);
    mesh.count = 0;
    mesh.frustumCulled = false;
    scene.add(mesh);
    return mesh;
  }

  dispose() {
    const all: THREE.InstancedMesh[] = [this.aura, this.shadows, this.barBg, this.barFill];
    for (const kind of ALL_KINDS) { all.push(this.outlines[kind]); for (const p of this.parts[kind]) all.push(p.mesh); }
    for (const m of all) { m.removeFromParent(); m.geometry.dispose(); (m.material as THREE.Material).dispose(); m.dispose(); }
  }

  spawn(kind: EnemyKind, x: number, z: number, run: Run, opts: SpawnOpts = {}): Enemy | null {
    if (this.aliveCount >= this.cap && !opts.elite && kind !== 'ogre') return null;
    const e = this.pool.find((p) => !p.active);
    if (!e) return null;
    const def = ENEMIES[kind];
    const min = run.timelineMinutes;
    const elite = !!opts.elite;
    let mods: EliteMod[] = [];
    if (elite) {
      mods = opts.mods ?? [];
      if (!opts.mods) {
        const n = min >= 10 ? 2 : 1;
        const pool = ALL_MODS.filter((m) => !(m === 'summoner' && kind === 'swarmBug') && !(m === 'explosive' && kind === 'exploder'));
        for (let i = 0; i < n && pool.length; i++) mods.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
      }
    }
    const rm = run.rm;
    e.id = newEnemyId();
    e.active = true; e.alive = true; e.hidden = false; e.kind = kind; e.def = def;
    e.x = x; e.z = z; e.vx = 0; e.vz = 0;
    e.facing = Math.atan2(run.player.z - z, run.player.x - x);
    let hp = def.hp * E.hpScale(min) * run.difficulty.hp * rm.enemyHp * (opts.hpMult ?? 1) * (elite ? E.eliteHp : 1);
    if (kind === 'ogre') hp = def.hp * (1 + min * 0.35) * run.difficulty.hp * rm.enemyHp * (opts.hpMult ?? 1);
    if (mods.includes('swift')) hp *= 0.7;
    e.hp = e.maxHp = hp;
    let speed = def.speed * E.speedScale(min) * run.map.enemySpeedMult * rm.enemySpeed * (opts.speedMult ?? 1) * (elite ? 1.1 : 1) * rand(0.92, 1.08);
    if (mods.includes('enraged')) speed *= 1.35;
    if (mods.includes('swift')) speed *= 1.6;
    e.speed = speed;
    e.damage = def.damage * E.damageScale(min) * run.difficulty.damage * run.map.enemyDamageMult * rm.enemyDamage * (opts.dmgMult ?? 1) * (elite ? E.eliteDamage : 1);
    e.scale = ENEMY_MODEL_SCALE[kind] * (elite ? E.eliteScale : 1);
    e.radius = def.radius * (elite ? E.eliteScale : 1);
    e.xp = def.xp * E.xpScale(min) * run.map.xpMult * (elite ? 12 : 1);
    e.kbResist = elite ? Math.min(0.95, def.knockbackResist + 0.5) : def.knockbackResist;
    e.elite = elite;
    e.mods = mods;
    e.flash = 0; e.attackT = rand(0.4, 1.2); e.state = 'chase'; e.stateT = rand(2, 4); e.specialT = rand(2, 5);
    e.slowT = 0; e.slowFactor = 0.5; e.burnT = 0; e.burnDps = 0; e.burnTick = 0; e.shockT = 0;
    e.anim = Math.random() * 10; e.flank = (Math.random() < 0.5 ? -1 : 1) * rand(0.6, 1.2);
    e.dyingT = 0; e.bladeHitT = -1; e.bladeHitT2 = -1; e.chargeHitId = -1; e.poisonT = 0; e.telegraph = null;
    e.goldChance = def.goldChance * (elite ? 10 : 1);
    e.summoned = !!opts.summoned;
    e.dropsChest = !!opts.chest || kind === 'ogre';
    e.dormant = !!opts.dormant;
    e.lastElement = 'physical';
    if (kind === 'burrower') { e.state = 'burrow'; e.hidden = true; }
    this.seen.add(kind);
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

  /** Called by Run when an enemy's hp reaches zero. Rewards are handled by the caller exactly once. */
  markDead(e: Enemy) {
    if (!e.alive) return;
    e.alive = false;
    e.hidden = false;
    e.dyingT = 0.32;
    if (e.kind !== 'boss') this.aliveCount--;
    e.telegraph = null;
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

  private release(e: Enemy, run: Run) {
    if (e.telegraph) { run.vfx.release(e.telegraph); e.telegraph = null; }
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
      if (e.shockT > 0) e.shockT -= dt;
      if (e.poisonT > 0) e.poisonT -= dt;
      // burning
      if (e.burnT > 0) {
        e.burnT -= dt;
        e.burnTick -= dt;
        if (e.burnTick <= 0) {
          e.burnTick = 0.5;
          run.hitEnemy(e, e.burnDps * 0.5, { element: 'fire', dot: true, quiet: true, noCrit: true });
          if (!e.alive) continue;
        }
        if (Math.random() < 0.3) run.particles.emit(e.x + rand(-0.3, 0.3), 0.6 * e.scale, e.z + rand(-0.3, 0.3), 0, 2.2, 0, 0.45, 0.13, Math.random() < 0.5 ? '#ff7b00' : '#ffd60a', -2);
      }
      // elite mods over time
      if (e.mods.length) {
        if (e.mods.includes('regenerating')) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.03 * dt);
        if (e.mods.includes('summoner')) {
          e.specialT -= dt;
          if (e.specialT <= 0 && this.aliveCount < this.cap) {
            e.specialT = 5;
            for (let i = 0; i < 3; i++) this.spawn('swarmBug', e.x + rand(-1, 1), e.z + rand(-1, 1), run, { summoned: true });
            run.particles.burst(e.x, 1, e.z, 10, '#c77dff', 3, 0.15, 0.5);
          }
        }
      }

      const dx = p.x - e.x, dz = p.z - e.z;
      const dist = Math.hypot(dx, dz) || 0.001;
      const nx = dx / dist, nz = dz / dist;

      if (e.dormant) {
        if (dist < 11) { e.dormant = false; run.particles.burst(e.x, 1, e.z, 12, '#ff3b30', 4, 0.2, 0.5); }
        else { e.facing += dt * 0.5; continue; }
      }

      // relocate stragglers so pressure stays on the player
      if (dist > E.despawnDist && !e.elite && e.kind !== 'ogre') {
        const moving = Math.hypot(p.vx, p.vz) > 1;
        const ang = moving ? Math.atan2(p.vz, p.vx) + rand(-1, 1) : Math.random() * Math.PI * 2;
        const pos = run.director.ringPoint(ang);
        e.x = pos.x; e.z = pos.z;
        continue;
      }

      const kbSpeed = Math.hypot(e.vx, e.vz);
      const staggered = kbSpeed > 3.5;
      const speed = e.speed * (e.slowT > 0 ? e.slowFactor : 1) * run.blizzardSlow;
      let mvx = 0, mvz = 0;
      const kind = e.kind;
      const def = e.def!;
      let faceTarget = false;

      if (!staggered) {
        switch (kind) {
          case 'slime':
          case 'bigSlime': {
            const hop = 0.55 + 0.75 * Math.max(0, Math.sin(e.anim * 6));
            mvx = nx * speed * hop; mvz = nz * speed * hop;
            break;
          }
          case 'goblin':
          case 'swarmBug': {
            const wob = kind === 'swarmBug' ? Math.sin(e.anim * 9 + e.flank * 3) * 0.6 : 0;
            if (dist > 5) {
              const side = e.flank * Math.min(0.9, dist / 14) + wob;
              const ax = nx * Math.cos(side) - nz * Math.sin(side);
              const az = nx * Math.sin(side) + nz * Math.cos(side);
              mvx = ax * speed; mvz = az * speed;
            } else { mvx = nx * speed; mvz = nz * speed; }
            break;
          }
          case 'phantom': {
            const a = Math.sin(e.anim * 1.8 + e.flank * 4) * 1.25;
            const ax = nx * Math.cos(a) - nz * Math.sin(a), az = nx * Math.sin(a) + nz * Math.cos(a);
            const surge = 0.6 + 0.8 * Math.max(0, Math.sin(e.anim * 2.7));
            mvx = ax * speed * surge; mvz = az * speed * surge;
            break;
          }
          case 'shaman':
          case 'archer':
          case 'bombardier':
          case 'healer': {
            faceTarget = true;
            if (e.state === 'cast') {
              e.stateT -= dt;
              if (e.stateT <= 0) { this.rangedAttack(e, run); e.state = 'chase'; e.attackT = def.attackCooldown * rand(0.85, 1.2); }
            } else {
              const pref = kind === 'bombardier' ? 13 : kind === 'healer' ? 11 : kind === 'archer' ? 11 : 10;
              let fx = 0, fz = 0;
              if (dist > pref + 3) { fx = nx; fz = nz; }
              else if (dist < pref - 3) { fx = -nx; fz = -nz; }
              else { fx = -nz * e.flank; fz = nx * e.flank; }
              mvx = fx * speed; mvz = fz * speed;
              const range = kind === 'bombardier' ? 19 : kind === 'healer' ? 30 : 17;
              if (e.attackT <= 0 && dist < range) { e.state = 'cast'; e.stateT = kind === 'healer' ? 0.6 : 0.65; }
            }
            break;
          }
          case 'exploder': {
            if (e.state === 'fuse') {
              e.stateT -= dt;
              const r = CONFIG.enemies.exploderRadius * (e.elite ? 1.5 : 1);
              if (e.telegraph) run.vfx.setCircle(e.telegraph, e.x, e.z, r, 1 - e.stateT / CONFIG.enemies.exploderFuse);
              if (e.stateT <= 0) { run.exploderDetonate(e, true); continue; }
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
          case 'stalker': {
            if (e.state === 'blink') {
              e.stateT -= dt;
              if (e.stateT <= 0) {
                // reappear behind the player
                const mv = Math.hypot(p.vx, p.vz) > 1 ? Math.atan2(-p.vz, -p.vx) : Math.random() * Math.PI * 2;
                const pos = { x: p.x + Math.cos(mv) * 3.6, z: p.z + Math.sin(mv) * 3.6 };
                run.world.resolve(pos, e.radius);
                e.x = pos.x; e.z = pos.z;
                e.hidden = false;
                e.state = 'chase';
                e.stateT = rand(4, 6);
                e.attackT = 0.45; // brief grace before it can hit
                run.particles.burst(e.x, 1, e.z, 14, '#7b2cbf', 4, 0.2, 0.5);
                run.sfx('blink');
              }
            } else {
              mvx = nx * speed; mvz = nz * speed;
              e.stateT -= dt;
              if (e.stateT <= 0 && dist > 5 && dist < 22) {
                e.state = 'blink'; e.stateT = 0.6; e.hidden = true;
                run.particles.burst(e.x, 1, e.z, 14, '#3c096c', 3, 0.2, 0.5);
              }
            }
            break;
          }
          case 'burrower': {
            if (e.state === 'burrow') {
              mvx = nx * speed; mvz = nz * speed;
              if (Math.random() < 0.6) run.particles.emit(e.x + rand(-0.4, 0.4), 0.1, e.z + rand(-0.4, 0.4), rand(-1, 1), 2, rand(-1, 1), 0.4, 0.18, '#9c6644', 10);
              if (dist < 2.8) {
                e.state = 'emerge'; e.stateT = 0.85;
                e.telegraph = run.vfx.telegraph('circle', '#ff7b00');
                run.sfx('rumble');
              }
            } else if (e.state === 'emerge') {
              e.stateT -= dt;
              if (e.telegraph) run.vfx.setCircle(e.telegraph, e.x, e.z, 2.2, 1 - e.stateT / 0.85);
              if (e.stateT <= 0) {
                this.release(e, run);
                e.hidden = false; e.state = 'chase'; e.speed *= 0.4;
                run.particles.burst(e.x, 0.4, e.z, 18, '#9c6644', 6, 0.25, 0.6);
                run.screen.shake(0.15);
                if ((p.x - e.x) ** 2 + (p.z - e.z) ** 2 < (2.2 + p.radius * 0.5) ** 2) run.damagePlayer(e.damage, { x: e.x, z: e.z, label: def.name, attacker: e });
              }
            } else { mvx = nx * speed; mvz = nz * speed; }
            break;
          }
          case 'ogre': {
            if (e.state === 'slam') {
              e.stateT -= dt;
              if (e.stateT <= 0) { e.state = 'chase'; e.specialT = rand(3.5, 5); }
            } else {
              mvx = nx * speed; mvz = nz * speed;
              e.specialT -= dt;
              if (e.specialT <= 0 && dist < 7) {
                e.state = 'slam'; e.stateT = 1.5;
                const x = e.x, z = e.z, dmg = e.damage * 1.3;
                run.hazards.add({ shape: 'circle', x, z, r: 4.6, warn: 1.1, damage: dmg, label: def.name, onTrigger: (rr) => {
                  rr.vfx.ring(x, z, 0.5, 4.6, '#ffd166', 0.45); rr.particles.ring(x, z, 2.5, 22, '#7f4f24', 6, 0.28); rr.screen.shake(0.35); rr.sfx('bossSlam');
                } }, run);
              }
            }
            break;
          }
          case 'shieldKnight':
            faceTarget = true;
            mvx = nx * speed; mvz = nz * speed;
            break;
          case 'brute':
          case 'beetle':
          default:
            mvx = nx * speed; mvz = nz * speed;
            break;
        }
        // telegraphed charge: elites of melee kinds and every giant beetle
        const charger = kind === 'beetle' || (e.elite && ['slime', 'bigSlime', 'goblin', 'brute', 'swarmBug', 'shieldKnight', 'phantom'].includes(kind));
        if (charger) {
          if (e.state === 'chase') {
            e.stateT -= dt;
            if (e.stateT <= 0 && dist < 13 && dist > 3) {
              e.state = 'windup'; e.stateT = 0.8; e.dirX = nx; e.dirZ = nz;
              e.telegraph = run.vfx.telegraph('rect', '#ff9f1c');
            }
          } else if (e.state === 'windup') {
            e.stateT -= dt;
            mvx = 0; mvz = 0;
            if (e.telegraph) run.vfx.setRect(e.telegraph, e.x, e.z, Math.atan2(e.dirZ, e.dirX), 10, e.radius * 2, 1 - e.stateT / 0.8);
            if (e.stateT <= 0) { this.release(e, run); e.state = 'dash'; e.stateT = 0.5; }
          } else if (e.state === 'dash') {
            e.stateT -= dt;
            mvx = e.dirX * 20; mvz = e.dirZ * 20;
            if (Math.random() < 0.5) run.particles.emit(e.x, 0.3, e.z, 0, 1, 0, 0.3, 0.25, '#ffd166', 2);
            if (e.stateT <= 0) { e.state = 'chase'; e.stateT = rand(3.5, 5.5); }
          }
        }
      }

      e.vx *= Math.exp(-7 * dt);
      e.vz *= Math.exp(-7 * dt);
      e.x += (mvx + e.vx) * dt;
      e.z += (mvz + e.vz) * dt;
      if (faceTarget) e.facing += angleDiff(e.facing, Math.atan2(nz, nx)) * Math.min(1, dt * 6);
      else if (mvx || mvz) e.facing += angleDiff(e.facing, Math.atan2(mvz, mvx)) * Math.min(1, dt * 8);

      if (!e.hidden) {
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
        // bodies don't overlap the player: enemies are shoved aside so skilled movement can slip through
        const pd = Math.hypot(e.x - p.x, e.z - p.z);
        const minP = e.radius + p.radius * 0.85;
        if (pd < minP && pd > 1e-4 && p.alive) {
          e.x = p.x + ((e.x - p.x) / pd) * minP;
          e.z = p.z + ((e.z - p.z) / pd) * minP;
        }
      }
      run.world.resolve(e, e.radius * 0.8);

      // contact damage
      const reach = e.radius + p.radius + E.contactPadding;
      if (kind !== 'exploder' && !e.hidden && dist < reach && e.attackT <= 0 && p.alive) {
        const dmg = e.state === 'dash' ? e.damage * 1.4 : e.damage;
        if (run.damagePlayer(dmg, { x: e.x, z: e.z, attacker: e, label: def.name })) e.attackT = def.attackCooldown;
        else e.attackT = 0.15;
      }
    }
    this.grid.build(this.pool);
  }

  private rangedAttack(e: Enemy, run: Run) {
    const p = run.player;
    const lead = 0.45;
    const tx = p.x + p.vx * lead - e.x, tz = p.z + p.vz * lead - e.z;
    const base = Math.atan2(tz, tx);
    switch (e.kind) {
      case 'shaman': {
        const shots = e.elite ? 3 : 1;
        for (let k = 0; k < shots; k++) {
          const a = base + (k - (shots - 1) / 2) * 0.28;
          run.projectiles.enemyBolt(e.x, e.z, Math.cos(a), Math.sin(a), 9.5, e.damage, 'bolt');
        }
        run.sfx('enemyShot');
        break;
      }
      case 'archer': {
        const shots = e.elite ? 9 : 5;
        for (let k = 0; k < shots; k++) {
          const a = base + (k - (shots - 1) / 2) * 0.16;
          run.projectiles.enemyBolt(e.x, e.z, Math.cos(a), Math.sin(a), 13, e.damage, 'arrow', 0.22);
        }
        run.sfx('arrow');
        break;
      }
      case 'bombardier': {
        const T = 1.3;
        const bx = p.x + p.vx * 0.7, bz = p.z + p.vz * 0.7;
        const n = e.elite ? 3 : 1;
        for (let k = 0; k < n; k++) {
          const ox = k ? rand(-3, 3) : 0, oz = k ? rand(-3, 3) : 0;
          const x = bx + ox, z = bz + oz;
          run.particles.emit(e.x, 1.8, e.z, (x - e.x) / T, 14 * T / 2, (z - e.z) / T, T, 0.38, '#212529', 14);
          run.hazards.add({ shape: 'circle', x, z, r: 2.3, warn: T, damage: e.damage, label: 'Bombardier', onTrigger: (rr) => {
            rr.vfx.ring(x, z, 0.3, 2.4, '#ff9f1c', 0.4); rr.particles.burst(x, 0.5, z, 16, '#ff9f1c', 6, 0.25, 0.5); rr.sfx('explode'); rr.screen.shake(0.12);
          } }, run);
        }
        run.sfx('enemyShot');
        break;
      }
      case 'healer': {
        const R = 6.5;
        run.vfx.ring(e.x, e.z, 0.5, R, '#70e000', 0.6, 0.8);
        let healed = 0;
        this.grid.query(e.x, e.z, R, (o) => {
          if (o.kind === 'boss' || o.hp >= o.maxHp) return;
          o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.22);
          if (healed++ < 6) run.vfx.lightning(e.x, 1.6, e.z, o.x, 1, o.z, '#b7ff9e', 0.08);
          run.particles.emit(o.x, 1.2, o.z, 0, 2, 0, 0.6, 0.18, '#70e000', -1);
        });
        if (healed) run.sfx('enemyHeal');
        break;
      }
    }
  }

  /** Living healers near a point (for target prioritisation). */
  priorityTarget(x: number, z: number, range: number): Enemy | null {
    let best: Enemy | null = null;
    let bd = range * range;
    for (const e of this.pool) {
      if (!e.alive || e.hidden || (e.kind !== 'healer' && e.kind !== 'ogre')) continue;
      const d = (e.x - x) ** 2 + (e.z - z) ** 2;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  render(time: number, camera: THREE.Camera) {
    const counts = {} as Record<EnemyKind, number>;
    for (const k of ALL_KINDS) counts[k] = 0;
    const st = getSettings();
    const outline = st.highContrast;
    let auraN = 0, shN = 0, barN = 0;
    camera.getWorldQuaternion(_cam);
    for (const e of this.pool) {
      if (!e.active) continue;
      if (e.kind === 'boss') continue;
      const kind = e.kind;
      let y = 0, sx = 1, sy = 1, tilt = 0, roll = 0;
      const a = e.anim;
      switch (kind) {
        case 'slime': case 'bigSlime': {
          const h = Math.max(0, Math.sin(a * 6));
          y = h * 0.35 * e.scale;
          sy = 1 + h * 0.15 - (1 - h) * 0.12; sx = 1 / Math.sqrt(sy);
          break;
        }
        case 'goblin': case 'archer': y = Math.abs(Math.sin(a * 12)) * 0.12; tilt = kind === 'goblin' ? 0.25 : 0; roll = Math.sin(a * 12) * 0.08; break;
        case 'swarmBug': y = 0.15 + Math.abs(Math.sin(a * 25)) * 0.1; roll = Math.sin(a * 30) * 0.1; break;
        case 'brute': case 'shieldKnight': case 'ogre': roll = Math.sin(a * 3.5) * 0.07; y = Math.abs(Math.sin(a * 3.5)) * 0.06; break;
        case 'beetle': y = Math.abs(Math.sin(a * 8)) * 0.04; roll = Math.sin(a * 8) * 0.03; break;
        case 'shaman': case 'healer': y = 0.15 + Math.sin(a * 2.5) * 0.12; if (e.state === 'cast') { sy = 1.1; tilt = -0.2; } break;
        case 'phantom': y = 0.4 + Math.sin(a * 3) * 0.25; roll = Math.sin(a * 2) * 0.2; break;
        case 'stalker': y = Math.sin(a * 4) * 0.05; tilt = 0.15; break;
        case 'bombardier': roll = Math.sin(a * 5) * 0.06; if (e.state === 'cast') sy = 0.9; break;
        case 'burrower': if (e.state === 'emerge') { y = -0.8 + (1 - e.stateT / 0.85) * 0.8; } break;
        case 'exploder': {
          roll = Math.sin(a * 14) * 0.12; y = Math.abs(Math.sin(a * 14)) * 0.1;
          if (e.state === 'fuse') { const t = 1 - e.stateT / CONFIG.enemies.exploderFuse; sx = sy = 1 + t * 0.45; roll = Math.sin(a * 60) * 0.1; }
          break;
        }
      }
      if (e.state === 'windup' || (kind === 'ogre' && e.state === 'slam')) { sy *= 0.85; sx *= 1.12; roll = Math.sin(a * 50) * 0.08; }
      if (e.hidden) {
        // underground or mid-blink: only a dirt mound / shadow shows
        if (kind === 'stalker') { sx = sy = Math.max(0.01, e.stateT / 0.6); }
        else { _m.compose(_p.set(e.x, 0.04, e.z), _q.identity(), _s.setScalar(0.9 + Math.sin(a * 20) * 0.1)); this.shadows.setMatrixAt(shN++, _m); continue; }
      }
      let s = e.scale;
      let alive = 1;
      if (!e.alive) {
        const t = 1 - Math.max(0, e.dyingT / 0.32);
        alive = 1 - t;
        switch (e.def!.deathFx) {
          case 'splat': sy *= Math.max(0.08, 1 - t * 1.2); sx *= 1 + t * 0.7; break;
          case 'poof': case 'spirit': s *= Math.max(0.01, 1 - t); y += t * (e.def!.deathFx === 'spirit' ? 2 : 0.4); break;
          case 'debris': roll = t * 1.5; y -= t * 0.6; break;
          case 'burst': s *= t < 0.3 ? 1 + t * 1.5 : Math.max(0.01, 1.45 - (t - 0.3) * 2.1); break;
          case 'bugs': s *= Math.max(0.01, 1 - t); roll = t * 6; break;
        }
      }
      if (e.flash > 0) { sx *= 1 + e.flash * 0.15; sy *= 1 - e.flash * 0.1; }
      const i = counts[kind]++;
      _e.set(tilt, Math.PI / 2 - e.facing, roll, 'YXZ');
      _q.setFromEuler(_e);
      _m.compose(_p.set(e.x, y, e.z), _q, _s.set(s * sx, s * sy, s * sx));
      const flash = !e.alive ? Math.min(1, alive * 1.5) : e.flash;
      const fusePulse = e.state === 'fuse' ? (Math.sin(time * 40) > 0 ? 0.7 : 0) : 0;
      const burning = e.burnT > 0 ? 0.25 + Math.sin(time * 20) * 0.1 : 0;
      const frozen = e.slowT > 0 && e.lastElement === 'frost';
      for (const part of this.parts[kind]) {
        part.mesh.setMatrixAt(i, _m);
        _c.copy(part.color);
        if (part.tintable) {
          if (e.elite) _c.lerp(e.mods.length ? MOD_COLORS[e.mods[0]] : ELITE, 0.45);
          if (burning) _c.lerp(_tmpFire, burning);
          if (frozen) _c.lerp(_tmpIce, 0.45);
          if (e.shockT > 0 && Math.sin(time * 50) > 0) _c.lerp(_tmpShock, 0.5);
          if (fusePulse) _c.lerp(WHITE, fusePulse);
        }
        if (flash > 0) _c.lerp(WHITE, Math.min(1, flash));
        part.mesh.setColorAt(i, _c);
      }
      if (outline) {
        this.outlines[kind].setMatrixAt(i, _m);
        this.outlines[kind].setColorAt(i, e.elite ? (e.mods.length ? MOD_COLORS[e.mods[0]] : ELITE) : WHITE);
      }
      if (e.elite && e.alive && auraN < 128) {
        const c = e.mods.length ? MOD_COLORS[e.mods[(Math.floor(time * 1.5)) % e.mods.length]] : ELITE;
        _m.compose(_p.set(e.x, 0.06, e.z), _q.setFromEuler(_e.set(0, time * 2, 0)), _s.setScalar(e.radius * 1.6 + Math.sin(time * 6) * 0.1));
        this.aura.setMatrixAt(auraN, _m);
        this.aura.setColorAt(auraN++, c);
      }
      _m.compose(_p.set(e.x, 0.03, e.z), _q.identity(), _s.setScalar(e.radius * 1.1 * alive));
      this.shadows.setMatrixAt(shN++, _m);
      // health bars for elites, mini-bosses and damaged heavies
      const wantBar = st.enemyHealthBars && e.alive && barN < BAR_CAP && (e.elite || kind === 'ogre' || (e.hp < e.maxHp && e.def!.hp >= 60) || kind === 'healer');
      if (wantBar) {
        const h = (e.def!.height + 0.5) * e.scale + 0.3;
        const w = Math.max(1, e.radius * 2.2);
        _p.set(e.x, h, e.z);
        _m.compose(_p, _cam, _s.set(w + 0.12, 0.2, 1));
        this.barBg.setMatrixAt(barN, _m);
        const ratio = Math.max(0, e.hp / e.maxHp);
        _s.set(w * ratio, 0.13, 1);
        // shift fill to the bar's left edge in camera space
        _v.set(-w / 2, 0, 0.01).applyQuaternion(_cam);
        _m.compose(_p.add(_v), _cam, _s);
        this.barFill.setMatrixAt(barN, _m);
        this.barFill.setColorAt(barN, e.elite ? (e.mods.length ? MOD_COLORS[e.mods[0]] : ELITE) : kind === 'healer' ? _tmpHeal : _tmpHp);
        barN++;
      }
    }
    for (const kind of ALL_KINDS) {
      for (const part of this.parts[kind]) {
        part.mesh.count = counts[kind];
        part.mesh.instanceMatrix.needsUpdate = true;
        if (part.mesh.instanceColor) part.mesh.instanceColor.needsUpdate = true;
      }
      const o = this.outlines[kind];
      o.count = outline ? counts[kind] : 0;
      o.instanceMatrix.needsUpdate = true;
      if (o.instanceColor) o.instanceColor.needsUpdate = true;
    }
    this.aura.count = auraN;
    this.aura.instanceMatrix.needsUpdate = true;
    if (this.aura.instanceColor) this.aura.instanceColor.needsUpdate = true;
    this.shadows.count = shN;
    this.shadows.instanceMatrix.needsUpdate = true;
    this.barBg.count = barN;
    this.barFill.count = barN;
    this.barBg.instanceMatrix.needsUpdate = true;
    this.barFill.instanceMatrix.needsUpdate = true;
    if (this.barFill.instanceColor) this.barFill.instanceColor.needsUpdate = true;
  }
}

const _v = new THREE.Vector3();
const _tmpFire = new THREE.Color('#ff5400');
const _tmpIce = new THREE.Color('#a0e7ff');
const _tmpShock = new THREE.Color('#7df9ff');
const _tmpHp = new THREE.Color('#ff4d6d');
const _tmpHeal = new THREE.Color('#70e000');
