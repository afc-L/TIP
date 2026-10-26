// Modular weapon framework: each weapon is a definition (data/weapons.ts) plus a behaviour here.
import * as THREE from 'three';
import type { StatBlock, WeaponDef, WeaponId, WeaponStats } from '../../data/types';
import { WEAPON_MAP, WEAPON_MAX_LEVEL, weaponStatsAt } from '../../data/weapons';
import { input } from '../Input';
import { box, cone, cyl, dodeca, merge, sphere, torus } from '../models/shapes';
import type { SynergyFlag } from '../../data/synergies';
import type { Run } from '../Run';
import { angleDiff, rand } from '../util';
import type { Enemy } from '../enemies/Enemy';
import type { Projectile } from './Projectile';

export interface WeaponInstance {
  id: WeaponId;
  def: WeaponDef;
  level: number;
  evolved: boolean;
  stats: WeaponStats;
  timer: number;
  angle: number;
  lungeId: number;
}

interface Cloud { x: number; z: number; r: number; life: number; max: number; tick: number; damage: number; follow: boolean; weapon: WeaponInstance; kind: 'poison' | 'fire' }
interface BlackHole { x: number; z: number; r: number; life: number; max: number; tick: number; damage: number; weapon: WeaponInstance; kind: 'orb' | 'well'; swallowed: number }
interface Strike { x: number; z: number; r: number; dmg: number; t: number; warn: number; big: boolean; tg: import('../effects/Vfx').Telegraph; weapon: WeaponInstance }
interface Turret { x: number; z: number; life: number; tick: number; weapon: WeaponInstance; group: THREE.Group }
interface Tornado { x: number; z: number; vx: number; vz: number; life: number; max: number; tick: number; trail: number; weapon: WeaponInstance; group: THREE.Group }
interface Rift { x: number; z: number; angle: number; len: number; width: number; life: number; max: number; tick: number; weapon: WeaponInstance; mesh: THREE.Mesh; spin: number }

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

export const MAX_WEAPONS = 6;
const FIRE_A = new THREE.Color('#ff5400');
const FIRE_B = new THREE.Color('#ffb703');
const POISON = new THREE.Color('#80ff72');

export class WeaponManager {
  list: WeaponInstance[] = [];
  private clouds: Cloud[] = [];
  private holes: BlackHole[] = [];
  private bladeMesh: THREE.InstancedMesh;
  private puffMesh: THREE.InstancedMesh;
  private holeMeshes: THREE.Group[] = [];
  private storm: THREE.Group;
  private lungeSeq = 1;
  private strikes: Strike[] = [];
  private turrets: Turret[] = [];
  private tornados: Tornado[] = [];
  private rifts: Rift[] = [];
  private meteorMesh: THREE.InstancedMesh;
  private droneMesh: THREE.InstancedMesh;
  private turretPool: THREE.Group[] = [];
  private tornadoPool: THREE.Group[] = [];
  private riftPool: THREE.Mesh[] = [];
  private scene: THREE.Scene;
  private meteorVolley = 0;
  /** Active synergy flags and character trait, set by the run. */
  flags = new Set<SynergyFlag>();
  trait: string | undefined;

  constructor(scene: THREE.Scene) {
    const blade = merge([box(0.9, 0.06, 0.18), box(0.18, 0.06, 0.9), box(0.6, 0.07, 0.6, { r: [0, Math.PI / 4, 0] })]);
    this.bladeMesh = new THREE.InstancedMesh(blade, new THREE.MeshLambertMaterial({ color: '#d8f3ff', emissive: '#3a86ff', emissiveIntensity: 0.35, flatShading: true }), 40);
    this.bladeMesh.count = 0;
    this.bladeMesh.frustumCulled = false;
    scene.add(this.bladeMesh);
    this.puffMesh = new THREE.InstancedMesh(sphere(1, {}, 1), new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#222222', transparent: true, opacity: 0.45, depthWrite: false, flatShading: true }), 260);
    this.puffMesh.setColorAt(0, new THREE.Color(1, 1, 1));
    this.puffMesh.count = 0;
    this.puffMesh.frustumCulled = false;
    scene.add(this.puffMesh);
    this.scene = scene;
    for (let i = 0; i < 8; i++) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(sphere(0.6, {}, 2), new THREE.MeshBasicMaterial({ color: '#10002b' })));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.12, 6, 32), new THREE.MeshBasicMaterial({ color: '#c77dff', transparent: true, opacity: 0.8 }));
      ring.rotation.x = Math.PI / 2;
      g.add(ring);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#7b2cbf', transparent: true, opacity: 0.25, depthWrite: false }));
      disc.position.y = -0.8;
      g.add(disc);
      g.visible = false;
      scene.add(g);
      this.holeMeshes.push(g);
    }
    this.storm = new THREE.Group();
    const cloudMat = new THREE.MeshLambertMaterial({ color: '#495057', flatShading: true, transparent: true, opacity: 0.85 });
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(sphere(1.2 + Math.random() * 0.6, {}, 0), cloudMat);
      m.position.set(Math.cos(i) * 1.6, Math.random() * 0.4, Math.sin(i * 1.7) * 1.2);
      this.storm.add(m);
    }
    this.storm.visible = false;
    scene.add(this.storm);
    const inst = (geo: THREE.BufferGeometry, mat: THREE.Material, n: number) => {
      const m = new THREE.InstancedMesh(geo, mat, n);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.count = 0;
      m.frustumCulled = false;
      scene.add(m);
      return m;
    };
    this.meteorMesh = inst(dodeca(1), new THREE.MeshBasicMaterial({ color: '#ff7b00' }), 48);
    this.droneMesh = inst(merge([box(0.5, 0.18, 0.5), box(1.1, 0.05, 0.12), box(0.12, 0.05, 1.1), sphere(0.13, { p: [0, -0.14, 0.18] })]), new THREE.MeshLambertMaterial({ color: '#90e0ef', emissive: '#0077b6', emissiveIntensity: 0.4, flatShading: true }), 20);
  }

  private turretGroup(): THREE.Group {
    let g = this.turretPool.find((t) => !t.visible);
    if (!g) {
      g = new THREE.Group();
      g.add(new THREE.Mesh(merge([cyl(0.5, 0.7, 0.4, { p: [0, 0.2, 0] }, 8), cyl(0.15, 0.2, 1.8, { p: [0, 1.2, 0] }, 6)]), new THREE.MeshLambertMaterial({ color: '#495057', flatShading: true })));
      g.add(new THREE.Mesh(merge([torus(0.35, 0.07, { p: [0, 1.0, 0], r: [Math.PI / 2, 0, 0] }), torus(0.3, 0.07, { p: [0, 1.4, 0], r: [Math.PI / 2, 0, 0] }), torus(0.25, 0.07, { p: [0, 1.8, 0], r: [Math.PI / 2, 0, 0] })]), new THREE.MeshLambertMaterial({ color: '#b87333', flatShading: true })));
      g.add(new THREE.Mesh(sphere(0.32, { p: [0, 2.3, 0] }), new THREE.MeshBasicMaterial({ color: '#7df9ff' })));
      this.scene.add(g);
      this.turretPool.push(g);
    }
    g.visible = true;
    return g;
  }

  private tornadoGroup(): THREE.Group {
    let g = this.tornadoPool.find((t) => !t.visible);
    if (!g) {
      g = new THREE.Group();
      const mats = ['#ff5400', '#ff9e00', '#ffd60a'].map((c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      for (let i = 0; i < 3; i++) {
        const m = new THREE.Mesh(cone(1 - i * 0.18, 2.6 - i * 0.4, { p: [0, 1.3 + i * 0.25, 0], r: [Math.PI, 0, 0] }, 9), mats[i]);
        g.add(m);
      }
      this.scene.add(g);
      this.tornadoPool.push(g);
    }
    g.visible = true;
    return g;
  }

  private riftMesh(): THREE.Mesh {
    let m = this.riftPool.find((t) => !t.visible);
    if (!m) {
      const geo = new THREE.PlaneGeometry(1, 1).translate(0.5, 0, 0).rotateX(-Math.PI / 2);
      m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#c77dff', transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      m.position.y = 0.08;
      m.renderOrder = 3;
      this.scene.add(m);
      this.riftPool.push(m);
    }
    m.visible = true;
    return m;
  }

  dispose() {
    for (const o of [this.bladeMesh, this.puffMesh, this.storm, this.meteorMesh, this.droneMesh, ...this.holeMeshes, ...this.turretPool, ...this.tornadoPool, ...this.riftPool]) o.removeFromParent();
    for (const s of this.strikes) s.tg.group.visible = false;
    this.bladeMesh.dispose();
    this.puffMesh.dispose();
    this.meteorMesh.dispose();
    this.droneMesh.dispose();
  }

  get(id: WeaponId) { return this.list.find((w) => w.id === id); }
  has(id: WeaponId) { return !!this.get(id); }

  add(id: WeaponId, stats: StatBlock): WeaponInstance | null {
    if (this.has(id) || this.list.length >= MAX_WEAPONS) return null;
    const w: WeaponInstance = { id, def: WEAPON_MAP[id], level: 1, evolved: false, stats: { ...WEAPON_MAP[id].base }, timer: 0.4, angle: 0, lungeId: 0 };
    this.list.push(w);
    this.recompute(stats);
    return w;
  }

  levelUp(id: WeaponId, n: number, stats: StatBlock) {
    const w = this.get(id);
    if (!w) return;
    w.level = Math.min(WEAPON_MAX_LEVEL, w.level + n);
    this.recompute(stats);
  }

  evolve(id: WeaponId, stats: StatBlock) {
    const w = this.get(id);
    if (!w || w.evolved) return;
    w.evolved = true;
    w.timer = 0;
    this.recompute(stats);
  }

  /** Rebuild every weapon's effective stats from level + player stats (never incremental). */
  recompute(s: StatBlock) {
    for (const w of this.list) {
      const b = weaponStatsAt(w.def, w.level);
      const evo = w.evolved;
      const tags = w.def.tags;
      const projectile = tags.includes('projectile') || w.id === 'poison' || w.id === 'meteor' || w.id === 'fireTornado' || w.id === 'voidRift';
      const summon = tags.includes('summon');
      const dot = w.id === 'poison' || w.id === 'fireTornado';
      const engineer = this.trait === 'engineer' && summon;
      const chain = this.flags.has('chainRange') && (w.id === 'lightning' || w.id === 'tesla');
      w.stats = {
        damage: b.damage * s.damageMult * (w.def.explosive ? s.explosiveMult : 1) * (summon ? s.summonMult : 1) * (dot ? s.dotMult : 1) * (evo ? 1.6 : 1),
        cooldown: Math.max(0.12, b.cooldown * s.cooldownMult),
        area: b.area * (w.id === 'boulder' ? 1 : s.areaMult) * (evo && (w.id === 'boomerang' || w.id === 'blades') ? 1.25 : 1) * (chain ? 1.4 : 1),
        count: b.count + (projectile ? s.extraProjectiles : 0) + (w.id === 'lightning' && evo ? 4 : 0) + (engineer ? 1 : 0)
          + (w.id === 'drones' && this.flags.has('extraDrone') ? 1 : 0) + (w.id === 'drones' && evo ? 2 : 0),
        pierce: b.pierce + (w.id === 'lightning' || w.id === 'tesla' ? s.extraProjectiles : 0),
        speed: b.speed * (w.id === 'blades' || w.id === 'drones' ? 1 : s.projectileSpeedMult),
        duration: b.duration * s.durationMult * (engineer && w.id === 'tesla' ? 1.3 : 1),
        knockback: b.knockback * s.knockbackMult,
        crit: b.crit,
      };
      if (evo && w.id === 'lightning') w.stats.cooldown *= 0.5;
      if (evo && w.id === 'charge') w.stats.cooldown *= 0.7;
      if (evo && w.id === 'goldenCannon') w.stats.cooldown *= 0.8;
    }
  }

  clear() {
    this.clouds.length = 0;
    this.holes.length = 0;
    for (const g of this.holeMeshes) g.visible = false;
    this.storm.visible = false;
    this.strikes.length = 0;
    this.turrets.length = 0;
    this.tornados.length = 0;
    this.rifts.length = 0;
    for (const g of [...this.turretPool, ...this.tornadoPool, ...this.riftPool]) g.visible = false;
  }

  get plagueGarden() { return !!this.list.find((w) => w.id === 'poison' && w.evolved); }

  /** Mouse aim when the player is actively aiming, otherwise the nearest enemy, otherwise facing. */
  aimDir(run: Run): { x: number; z: number } {
    const p = run.player;
    if (run.aimPoint && input.mouseRecentlyActive()) {
      const dx = run.aimPoint.x - p.x, dz = run.aimPoint.z - p.z;
      const l = Math.hypot(dx, dz);
      if (l > 0.5) return { x: dx / l, z: dz / l };
    }
    const t = this.bossInRange(run, 12) ?? run.enemies.priorityTarget(p.x, p.z, 12) ?? run.enemies.grid.nearest(p.x, p.z, 14);
    if (t) {
      const dx = t.x - p.x, dz = t.z - p.z, l = Math.hypot(dx, dz) || 1;
      return { x: dx / l, z: dz / l };
    }
    return { x: Math.cos(p.facing), z: Math.sin(p.facing) };
  }

  update(dt: number, run: Run) {
    const p = run.player;
    if (!p.alive) return;
    for (const w of this.list) {
      w.timer -= dt;
      switch (w.id) {
        case 'hammer': this.hammer(w, run); break;
        case 'blades': this.blades(w, run, dt); break;
        case 'orb': this.orb(w, run); break;
        case 'boomerang': this.boomerang(w, run); break;
        case 'lightning': this.lightning(w, run); break;
        case 'rocket': this.rocket(w, run); break;
        case 'poison': this.poison(w, run); break;
        case 'quake': this.quake(w, run); break;
        case 'knives': this.knives(w, run); break;
        case 'charge': this.charge(w, run); break;
        case 'meteor': this.meteor(w, run); break;
        case 'soulReaper': this.soulReaper(w, run); break;
        case 'tesla': this.tesla(w, run); break;
        case 'gravityWell': this.gravityWell(w, run); break;
        case 'boulder': this.boulder(w, run); break;
        case 'drones': this.drones(w, run, dt); break;
        case 'fireTornado': this.fireTornado(w, run); break;
        case 'goldenCannon': this.goldenCannon(w, run); break;
        case 'mirrorShards': this.mirrorShards(w, run); break;
        case 'voidRift': this.voidRift(w, run); break;
      }
    }
    this.updateClouds(dt, run);
    this.updateHoles(dt, run);
    this.updateStrikes(dt, run);
    this.updateTurrets(dt, run);
    this.updateTornados(dt, run);
    this.updateRifts(dt, run);
  }

  /** Bosses get priority from targeting weapons when they're close enough to matter. */
  private bossInRange(run: Run, range: number): Enemy | null {
    const b = run.boss;
    if (!b || !b.entity.alive || b.state === 'intro') return null;
    const p = run.player;
    const d = Math.hypot(b.entity.x - p.x, b.entity.z - p.z) - b.entity.radius;
    return d <= range ? b.entity : null;
  }

  // ---------------- behaviours ----------------
  private hammer(w: WeaponInstance, run: Run) {
    if (w.timer > 0) return;
    const p = run.player;
    const st = w.stats;
    const target = this.bossInRange(run, st.area * 0.95) ?? run.enemies.grid.nearest(p.x, p.z, st.area + 0.6);
    if (!target) { w.timer = 0; return; }
    w.timer = st.cooldown;
    const base = Math.atan2(target.z - p.z, target.x - p.x);
    const angles = w.evolved ? [base] : st.count >= 2 ? [base, base + Math.PI] : [base];
    const half = w.evolved ? Math.PI : 1.35;
    let hitAny = false;
    let bolts = 0;
    for (const ang of angles) {
      run.vfx.arc(p.x, p.z, ang, st.area, w.evolved ? '#7df9ff' : '#ffd166', w.evolved);
      run.enemies.grid.query(p.x, p.z, st.area, (e) => {
        const a = Math.atan2(e.z - p.z, e.x - p.x);
        if (Math.abs(angleDiff(ang, a)) > half) return;
        const d = Math.hypot(e.x - p.x, e.z - p.z) || 1;
        run.hitEnemy(e, st.damage, { crit: st.crit, kb: st.knockback, dirX: (e.x - p.x) / d, dirZ: (e.z - p.z) / d, weapon: w, heavy: true });
        hitAny = true;
        if (w.evolved && bolts < 10 && e.alive) {
          bolts++;
          run.vfx.lightning(e.x + rand(-1, 1), 9, e.z + rand(-1, 1), e.x, 0.5, e.z);
          run.hitEnemy(e, st.damage * 0.5, { crit: st.crit, kb: 0, weapon: w, noNumber: false });
        }
      });
    }
    p.attackAnim = 1;
    run.sfx('swing');
    if (w.evolved) { run.sfx('zap'); run.vfx.ring(p.x, p.z, 0.5, st.area * 1.1, '#7df9ff', 0.35); }
    if (hitAny) { run.sfx('hit'); run.screen.shake(0.12); run.screen.stop(0.03); }
  }

  private bladePositions(w: WeaponInstance, run: Run): { x: number; z: number; ring: number }[] {
    const p = run.player;
    const out: { x: number; z: number; ring: number }[] = [];
    const n = Math.round(w.stats.count);
    if (w.evolved) {
      const breathe = 1 + Math.sin(run.time * 1.6) * 0.3;
      for (let i = 0; i < n; i++) {
        const a = w.angle + (i / n) * Math.PI * 2;
        out.push({ x: p.x + Math.cos(a) * w.stats.area * 0.7, z: p.z + Math.sin(a) * w.stats.area * 0.7, ring: 0 });
        const b = -w.angle * 0.8 + (i / n) * Math.PI * 2;
        out.push({ x: p.x + Math.cos(b) * w.stats.area * 1.45 * breathe, z: p.z + Math.sin(b) * w.stats.area * 1.45 * breathe, ring: 1 });
      }
    } else {
      for (let i = 0; i < n; i++) {
        const a = w.angle + (i / n) * Math.PI * 2;
        out.push({ x: p.x + Math.cos(a) * w.stats.area, z: p.z + Math.sin(a) * w.stats.area, ring: 0 });
      }
    }
    return out;
  }

  private blades(w: WeaponInstance, run: Run, dt: number) {
    const st = w.stats;
    w.angle += st.speed * dt * (w.evolved ? 1.4 : 1);
    const p = run.player;
    const t = run.time;
    for (const b of this.bladePositions(w, run)) {
      run.enemies.grid.query(b.x, b.z, 0.55, (e) => {
        const last = b.ring === 0 ? e.bladeHitT : e.bladeHitT2;
        if (t - last < st.cooldown) return;
        if (b.ring === 0) e.bladeHitT = t; else e.bladeHitT2 = t;
        const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz) || 1;
        run.hitEnemy(e, st.damage, { crit: st.crit, kb: st.knockback, dirX: dx / d, dirZ: dz / d, weapon: w, quiet: true });
      });
    }
    if (w.evolved) {
      // vortex pull
      const R = st.area * 2.6;
      run.enemies.grid.query(p.x, p.z, R, (e) => {
        if (e.kind === 'boss') return;
        const dx = p.x - e.x, dz = p.z - e.z, d = Math.hypot(dx, dz) || 1;
        if (d < st.area * 0.6) return;
        const pull = 7 * (1 - e.kbResist) * dt;
        e.x += (dx / d) * pull + (-dz / d) * pull * 0.6;
        e.z += (dz / d) * pull + (dx / d) * pull * 0.6;
      });
    }
  }

  private orb(w: WeaponInstance, run: Run) {
    if (w.timer > 0) return;
    const p = run.player;
    const st = w.stats;
    const targets: Enemy[] = [];
    run.enemies.grid.query(p.x, p.z, 15, (e) => { targets.push(e); });
    if (!targets.length) { w.timer = 0; return; }
    targets.sort((a, b) => ((a.x - p.x) ** 2 + (a.z - p.z) ** 2) - ((b.x - p.x) ** 2 + (b.z - p.z) ** 2));
    w.timer = st.cooldown;
    const n = Math.round(st.count);
    const boss = this.bossInRange(run, 15);
    for (let i = 0; i < n; i++) {
      const t = boss && i % 2 === 0 ? boss : targets[i % targets.length];
      const a = Math.atan2(t.z - p.z, t.x - p.x) + (i - (n - 1) / 2) * 0.25;
      run.projectiles.spawn('orb', p.x, p.z, Math.cos(a), Math.sin(a), st.speed, {
        damage: st.damage, pierce: Math.round(st.pierce), radius: st.area * (w.evolved ? 1.4 : 1), scale: st.area * (w.evolved ? 0.75 : 0.55),
        life: st.duration, kb: st.knockback, crit: st.crit, weapon: w, targetId: t.id, evolved: w.evolved, y: 1.1,
      });
    }
    run.sfx('shoot');
  }

  private boomerang(w: WeaponInstance, run: Run) {
    const st = w.stats;
    const p = run.player;
    if (w.evolved) {
      const want = Math.round(st.count) + 1;
      if (w.timer > 0 || run.projectiles.activeCount('boomerang', w) >= want) return;
      w.timer = 0.35;
      const a = Math.random() * Math.PI * 2;
      run.projectiles.spawn('boomerang', p.x, p.z, Math.cos(a), Math.sin(a), st.speed * 1.2, {
        damage: st.damage, pierce: 999, radius: 1.2, scale: 1.9, life: Infinity, maxDist: st.area * 1.2, kb: st.knockback, crit: st.crit, weapon: w, evolved: true,
      });
      return;
    }
    if (w.timer > 0) return;
    const t = this.bossInRange(run, st.area * 1.2) ?? run.enemies.grid.nearest(p.x, p.z, st.area * 1.6);
    if (!t) { w.timer = 0; return; }
    w.timer = st.cooldown;
    const base = Math.atan2(t.z - p.z, t.x - p.x);
    const n = Math.round(st.count);
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * 0.5;
      run.projectiles.spawn('boomerang', p.x, p.z, Math.cos(a), Math.sin(a), st.speed, {
        damage: st.damage, pierce: 999, radius: 0.8, scale: 1.1, life: 5, maxDist: st.area, kb: st.knockback, crit: st.crit, weapon: w,
      });
    }
    run.sfx('boomerang');
  }

  private lightning(w: WeaponInstance, run: Run) {
    const st = w.stats;
    const p = run.player;
    if (w.evolved) {
      this.storm.visible = true;
      this.storm.position.set(p.x, 7, p.z);
      this.storm.rotation.y = run.time * 0.4;
    }
    if (w.timer > 0) return;
    const pool: Enemy[] = [];
    run.enemies.grid.query(p.x, p.z, 14, (e) => { pool.push(e); });
    if (!pool.length) { w.timer = 0; return; }
    w.timer = st.cooldown;
    const strikes = Math.round(st.pierce);
    let forks = 0;
    const chain = (start: Enemy, jumps: number, hit: Set<number>, dmg: number) => {
      let cur = start;
      for (let j = 0; j < jumps; j++) {
        const next = run.enemies.grid.nearest(cur.x, cur.z, st.area, (e) => !hit.has(e.id));
        if (!next) break;
        hit.add(next.id);
        run.vfx.lightning(cur.x, 1, cur.z, next.x, 1, next.z);
        dmg *= 0.92;
        const r = run.hitEnemy(next, dmg, { crit: st.crit, kb: st.knockback, weapon: w });
        if (w.evolved && r.crit && forks < 6) { forks++; chain(next, 3, hit, dmg); }
        cur = next;
      }
    };
    const boss = this.bossInRange(run, 14);
    for (let s = 0; s < strikes; s++) {
      const t = boss && s === 0 ? boss : pool[Math.floor(Math.random() * pool.length)];
      if (!t.alive) continue;
      const hit = new Set<number>([t.id]);
      const sx = w.evolved ? p.x + rand(-2, 2) : t.x + rand(-1.5, 1.5);
      const sz = w.evolved ? p.z + rand(-2, 2) : t.z + rand(-1.5, 1.5);
      run.vfx.lightning(sx, w.evolved ? 7 : 10, sz, t.x, 0.6, t.z, '#bdf9ff', 0.2);
      run.particles.burst(t.x, 0.5, t.z, 6, '#7df9ff', 4, 0.12, 0.3);
      const r = run.hitEnemy(t, st.damage, { crit: st.crit, kb: st.knockback, weapon: w });
      if (w.evolved && r.crit) forks++;
      chain(t, Math.round(st.count), hit, st.damage);
    }
    run.sfx('zap');
  }

  private rocket(w: WeaponInstance, run: Run) {
    if (w.timer > 0) return;
    const p = run.player;
    const st = w.stats;
    const targets: Enemy[] = [];
    run.enemies.grid.query(p.x, p.z, 18, (e) => { targets.push(e); });
    if (!targets.length) { w.timer = 0; return; }
    w.timer = st.cooldown;
    // prefer the densest targets: sample a few and pick ones with most neighbours
    const n = Math.round(st.count);
    const boss = this.bossInRange(run, 18);
    for (let i = 0; i < n; i++) {
      let best = targets[Math.floor(Math.random() * targets.length)];
      if (boss && i === 0) {
        const a = Math.atan2(boss.z - p.z, boss.x - p.x);
        run.projectiles.spawn('rocket', p.x, p.z, Math.cos(a), Math.sin(a), st.speed, {
          damage: st.damage, pierce: 1, radius: 0.45, scale: w.evolved ? 1.6 : 1.1, life: 2.4, kb: st.knockback, crit: st.crit, weapon: w, evolved: w.evolved, y: 1.0,
        });
        continue;
      }
      let bestN = -1;
      for (let k = 0; k < 4; k++) {
        const c = targets[Math.floor(Math.random() * targets.length)];
        let cnt = 0;
        run.enemies.grid.query(c.x, c.z, 3, () => { cnt++; });
        if (cnt > bestN) { bestN = cnt; best = c; }
      }
      const a = Math.atan2(best.z - p.z, best.x - p.x) + rand(-0.08, 0.08);
      run.projectiles.spawn('rocket', p.x, p.z, Math.cos(a), Math.sin(a), st.speed, {
        damage: st.damage, pierce: 1, radius: 0.45, scale: w.evolved ? 1.6 : 1.1, life: 2.4, kb: st.knockback, crit: st.crit, weapon: w, evolved: w.evolved, y: 1.0,
      });
    }
    run.sfx('shoot');
  }

  rocketExplode(pr: Projectile, run: Run) {
    const w = pr.weapon;
    if (!w) return;
    const st = w.stats;
    const r = st.area * (pr.evolved ? 1.3 : 1);
    run.explode(pr.x, pr.z, r, pr.damage, { kb: st.knockback, crit: st.crit, weapon: w, color: '#ff9f1c' });
    if (pr.evolved) {
      for (let i = 0; i < 6; i++) {
        const a = Math.random() * Math.PI * 2, d = rand(1.5, st.area * 2);
        const bx = pr.x + Math.cos(a) * d, bz = pr.z + Math.sin(a) * d;
        run.particles.emit(pr.x, 1, pr.z, Math.cos(a) * d * 2.2, 6, Math.sin(a) * d * 2.2, 0.4, 0.2, '#343a40', 25);
        run.schedule(0.2 + Math.random() * 0.35, () => run.explode(bx, bz, st.area * 0.65, pr.damage * 0.5, { kb: st.knockback * 0.5, crit: st.crit, weapon: w, color: '#ff595e', quiet: true }));
      }
    }
  }

  private poison(w: WeaponInstance, run: Run) {
    const st = w.stats;
    const p = run.player;
    if (w.evolved && !this.clouds.some((c) => c.follow)) {
      this.clouds.push({ x: p.x, z: p.z, r: st.area * 1.4, life: Infinity, max: Infinity, tick: 0, damage: st.damage * 0.8, follow: true, weapon: w, kind: 'poison' });
    }
    for (const c of this.clouds) if (c.follow) { c.damage = st.damage * 0.8; c.r = st.area * 1.4; }
    if (w.timer > 0) return;
    const pool: Enemy[] = [];
    run.enemies.grid.query(p.x, p.z, 12, (e) => { pool.push(e); });
    w.timer = st.cooldown;
    const n = Math.round(st.count);
    for (let i = 0; i < n; i++) {
      const t = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
      const x = t ? t.x : p.x + rand(-4, 4), z = t ? t.z : p.z + rand(-4, 4);
      this.addCloud(x, z, st.area, st.duration, st.damage, w);
    }
    run.sfx('poison');
  }

  addCloud(x: number, z: number, r: number, life: number, damage: number, w: WeaponInstance, kind: 'poison' | 'fire' = 'poison') {
    if (this.clouds.length >= 30) return;
    this.clouds.push({ x, z, r, life, max: life, tick: 0, damage, follow: false, weapon: w, kind });
  }

  private updateClouds(dt: number, run: Run) {
    const p = run.player;
    for (let i = this.clouds.length - 1; i >= 0; i--) {
      const c = this.clouds[i];
      if (c.follow) { c.x = p.x; c.z = p.z; }
      c.life -= dt;
      c.tick -= dt;
      if (c.tick <= 0) {
        c.tick = 0.5;
        run.enemies.grid.query(c.x, c.z, c.r, (e) => {
          if (c.kind === 'poison') { e.slowT = 0.7 * run.stats.statusDuration; e.slowFactor = 0.55; e.poisonT = 0.8; }
          else run.burn(e, c.damage * 1.2);
          run.hitEnemy(e, c.damage, { crit: 0, kb: 0, weapon: c.weapon, quiet: true, dot: true, element: c.kind === 'poison' ? 'poison' : 'fire' });
        });
      }
      if (c.life <= 0) this.clouds.splice(i, 1);
    }
  }

  spawnBlackHole(x: number, z: number, pr: Projectile, run: Run) {
    const w = pr.weapon;
    if (!w || this.holes.length >= this.holeMeshes.length) {
      if (w) run.explode(x, z, 1.8, pr.damage * 0.5, { kb: 2, crit: 0, weapon: w, color: '#c77dff', quiet: true });
      return;
    }
    const life = 2 * w.stats.duration;
    this.holes.push({ x, z, r: 3.6 * Math.max(1, w.stats.area / 0.45) ** 0.5, life, max: life, tick: 0, damage: w.stats.damage * 0.35, weapon: w, kind: 'orb', swallowed: 0 });
    run.sfx('zap');
  }

  private updateHoles(dt: number, run: Run) {
    for (let i = this.holes.length - 1; i >= 0; i--) {
      const h = this.holes[i];
      h.life -= dt;
      h.tick -= dt;
      const doTick = h.tick <= 0;
      if (doTick) h.tick = 0.25;
      run.enemies.grid.query(h.x, h.z, h.r, (e) => {
        if (e.kind !== 'boss') {
          const heavy = e.def?.heavy ? 0.25 : 1;
          const dx = h.x - e.x, dz = h.z - e.z, d = Math.hypot(dx, dz) || 1;
          const pull = Math.min(d, (h.kind === 'well' ? 7 : 9) * dt * (1 - e.kbResist * 0.7) * heavy);
          e.x += (dx / d) * pull; e.z += (dz / d) * pull;
        }
        if (doTick) {
          const r = run.hitEnemy(e, h.damage, { crit: h.weapon.stats.crit, kb: 0, weapon: h.weapon, quiet: true });
          if (r.killed) h.swallowed++;
        }
      });
      if (Math.random() < 0.6) {
        const a = Math.random() * Math.PI * 2;
        run.particles.emit(h.x + Math.cos(a) * h.r, 0.5, h.z + Math.sin(a) * h.r, -Math.cos(a) * h.r * 2, 0.5, -Math.sin(a) * h.r * 2, 0.45, 0.12, '#c77dff', 0);
      }
      if (h.life <= 0) {
        this.holes.splice(i, 1);
        if (h.kind === 'orb') run.explode(h.x, h.z, h.r * 0.8, h.damage * 4, { kb: 10, crit: 0, weapon: h.weapon, color: '#c77dff' });
        else if (h.weapon.evolved) {
          // EVENT HORIZON: supernova scales with everything the well swallowed
          run.explode(h.x, h.z, h.r * 1.4, h.weapon.stats.damage * (6 + h.swallowed * 1.5), { kb: 14, crit: h.weapon.stats.crit, weapon: h.weapon, color: '#e0aaff' });
          run.screen.shake(0.4);
        } else {
          run.vfx.ring(h.x, h.z, h.r, 0.2, '#7b2cbf', 0.35);
        }
      }
    }
  }

  private quake(w: WeaponInstance, run: Run) {
    if (w.timer > 0) return;
    const p = run.player;
    const st = w.stats;
    const any = run.enemies.grid.nearest(p.x, p.z, st.area);
    if (!any) { w.timer = 0; return; }
    w.timer = st.cooldown;
    const fire = () => {
      if (!run.player.alive) return;
      const px = run.player.x, pz = run.player.z;
      const dmg = st.damage + (w.evolved ? run.stats.maxHp * 0.15 : 0);
      run.vfx.ring(px, pz, 0.5, st.area, '#e9c46a', 0.5, 0.9);
      run.vfx.ring(px, pz, 0.3, st.area * 0.7, '#ffffff', 0.35, 0.6);
      run.particles.ring(px, pz, st.area * 0.6, 24, '#c9a227', 5, 0.25);
      run.enemies.grid.query(px, pz, st.area, (e) => {
        const dx = e.x - px, dz = e.z - pz, d = Math.hypot(dx, dz) || 1;
        run.hitEnemy(e, dmg, { crit: st.crit, kb: st.knockback, dirX: dx / d, dirZ: dz / d, weapon: w, heavy: true });
      });
      run.sfx('quake');
      run.screen.shake(0.25);
      if (w.evolved) {
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2 + run.time;
          for (let j = 1; j <= 6; j++) {
            const fx = px + Math.cos(a) * j * 2.2, fz = pz + Math.sin(a) * j * 2.2;
            run.schedule(j * 0.07, () => {
              run.particles.burst(fx, 0.2, fz, 5, '#ff6b35', 3, 0.25, 0.5, 7);
              run.vfx.ring(fx, fz, 0.2, 1.5, '#ff6b35', 0.3, 0.8);
              run.enemies.grid.query(fx, fz, 1.5, (e) => { run.hitEnemy(e, dmg * 0.6, { crit: st.crit, kb: 4, weapon: w, quiet: true }); });
            });
          }
        }
      }
    };
    fire();
    if (st.count >= 2) run.schedule(0.4, fire);
  }

  private knives(w: WeaponInstance, run: Run) {
    if (w.timer > 0) return;
    const p = run.player;
    const st = w.stats;
    w.timer = st.cooldown;
    const dir = this.aimDir(run);
    const base = Math.atan2(dir.z, dir.x);
    const n = Math.round(st.count);
    const speedBonus = w.evolved ? 1 + (run.stats.moveSpeed / 6 - 1) * 1.2 + 0.3 : 1;
    const dmg = st.damage * speedBonus;
    const shoot = (a: number) => run.projectiles.spawn('knife', p.x, p.z, Math.cos(a), Math.sin(a), st.speed, {
      damage: dmg, pierce: w.evolved ? 999 : Math.round(st.pierce), radius: 0.35, scale: w.evolved ? 1.3 : 1, life: st.duration, kb: st.knockback, crit: st.crit, weapon: w,
    });
    for (let i = 0; i < n; i++) shoot(base + (i - (n - 1) / 2) * 0.13);
    if (w.evolved) {
      const ring = n * 2;
      for (let i = 0; i < ring; i++) shoot(base + Math.PI / ring + (i / ring) * Math.PI * 2);
    }
    run.sfx('knife');
  }

  private charge(w: WeaponInstance, run: Run) {
    const p = run.player;
    const st = w.stats;
    if (p.lunge && w.lungeId) {
      // damage along the path
      run.enemies.grid.query(p.x, p.z, 1.7, (e) => {
        if (e.chargeHitId === w.lungeId) return;
        e.chargeHitId = w.lungeId;
        const side = Math.sign((e.x - p.x) * -p.lunge!.dz + (e.z - p.z) * p.lunge!.dx) || 1;
        run.hitEnemy(e, st.damage, { crit: st.crit, kb: st.knockback, dirX: p.lunge!.dx * 0.6 - p.lunge!.dz * side * 0.8, dirZ: p.lunge!.dz * 0.6 + p.lunge!.dx * side * 0.8, weapon: w, heavy: true });
      });
      if (w.evolved) p.invuln = Math.max(p.invuln, 0.1);
      if (Math.random() < 0.8) run.particles.emit(p.x, 0.2, p.z, rand(-1, 1), 1.5, rand(-1, 1), 0.4, 0.3, '#ced4da', 3);
      return;
    }
    if (w.timer > 0) return;
    const near = run.enemies.grid.nearest(p.x, p.z, st.area + 2);
    if (!near) { w.timer = 0; return; }
    w.timer = st.cooldown;
    w.lungeId = this.lungeSeq++;
    if (p.moveAmount > 0.35) {
      const dx = Math.cos(p.facing), dz = Math.sin(p.facing);
      p.lunge = {
        dx, dz, speed: st.speed, t: st.area / st.speed,
        onEnd: () => {
          w.lungeId = 0;
          if (w.evolved) {
            run.vfx.ring(p.x, p.z, 0.5, 5.5, '#adb5bd', 0.4);
            run.enemies.grid.query(p.x, p.z, 5.5, (e) => {
              const ex = e.x - p.x, ez = e.z - p.z, d = Math.hypot(ex, ez) || 1;
              run.hitEnemy(e, st.damage, { crit: st.crit, kb: st.knockback, dirX: ex / d, dirZ: ez / d, weapon: w, heavy: true });
            });
            run.screen.shake(0.2);
            run.sfx('quake');
          }
        },
      };
      if (w.evolved) p.invuln = Math.max(p.invuln, st.area / st.speed + 0.1);
      run.sfx('dodge');
    } else {
      // stomp
      w.lungeId = 0;
      const R = 3.6 * (st.area / 6);
      run.vfx.ring(p.x, p.z, 0.4, R, '#ced4da', 0.35);
      run.particles.ring(p.x, p.z, R * 0.6, 14, '#adb5bd', 4, 0.22);
      run.enemies.grid.query(p.x, p.z, R, (e) => {
        const ex = e.x - p.x, ez = e.z - p.z, d = Math.hypot(ex, ez) || 1;
        run.hitEnemy(e, st.damage * 0.75, { crit: st.crit, kb: st.knockback, dirX: ex / d, dirZ: ez / d, weapon: w, heavy: true });
      });
      p.attackAnim = 1;
      run.sfx('quake');
      run.screen.shake(0.12);
    }
  }

  // ---------------- phase 2 weapons ----------------
  /** Picks up to n target enemies, nearest first, preferring healers and the boss. */
  private targets(run: Run, range: number, n: number): Enemy[] {
    const p = run.player;
    const list: Enemy[] = [];
    run.enemies.grid.query(p.x, p.z, range, (e) => { list.push(e); });
    list.sort((a, b) => ((a.x - p.x) ** 2 + (a.z - p.z) ** 2) - ((b.x - p.x) ** 2 + (b.z - p.z) ** 2));
    const pri = this.bossInRange(run, range) ?? run.enemies.priorityTarget(p.x, p.z, range);
    if (pri) { const i = list.indexOf(pri); if (i > 0) list.splice(i, 1); if (i !== 0) list.unshift(pri); }
    return list.slice(0, Math.max(n, 1));
  }

  /** Densest spot among a few sampled enemies near the player. */
  private densest(run: Run, range: number): { x: number; z: number } | null {
    const p = run.player;
    const pool: Enemy[] = [];
    run.enemies.grid.query(p.x, p.z, range, (e) => { pool.push(e); });
    if (!pool.length) return null;
    let best = pool[0], bestN = -1;
    for (let k = 0; k < 6; k++) {
      const c = pool[Math.floor(Math.random() * pool.length)];
      let cnt = 0;
      run.enemies.grid.query(c.x, c.z, 3.5, () => { cnt++; });
      if (cnt > bestN) { bestN = cnt; best = c; }
    }
    return { x: best.x, z: best.z };
  }

  private meteor(w: WeaponInstance, run: Run) {
    if (w.timer > 0) return;
    const p = run.player;
    const st = w.stats;
    const pool: Enemy[] = [];
    run.enemies.grid.query(p.x, p.z, 13, (e) => { pool.push(e); });
    if (!pool.length) { w.timer = 0; return; }
    w.timer = st.cooldown;
    this.meteorVolley++;
    const n = Math.round(st.count);
    for (let i = 0; i < n; i++) {
      const t = pool[Math.floor(Math.random() * pool.length)];
      this.addStrike(t.x + rand(-1, 1), t.z + rand(-1, 1), st.area, st.damage, 0.75 + i * 0.12, false, w, run);
    }
    if (w.evolved && this.meteorVolley % 3 === 0) {
      const d = this.densest(run, 14);
      if (d) this.addStrike(d.x, d.z, st.area * 2.6, st.damage * 5, 1.4, true, w, run);
    }
  }

  private addStrike(x: number, z: number, r: number, dmg: number, warn: number, big: boolean, w: WeaponInstance, run: Run) {
    if (this.strikes.length >= 40) return;
    const tg = run.vfx.telegraph('circle', big ? '#ff006e' : '#ffb627');
    this.strikes.push({ x, z, r, dmg, t: 0, warn, big, tg, weapon: w });
  }

  private updateStrikes(dt: number, run: Run) {
    for (let i = this.strikes.length - 1; i >= 0; i--) {
      const s = this.strikes[i];
      s.t += dt;
      run.vfx.setCircle(s.tg, s.x, s.z, s.r, Math.min(1, s.t / s.warn));
      if (s.t >= s.warn) {
        run.vfx.release(s.tg);
        this.strikes.splice(i, 1);
        run.explode(s.x, s.z, s.r, s.dmg, { kb: s.weapon.stats.knockback, crit: s.weapon.stats.crit, weapon: s.weapon, color: '#ff7b00', quiet: !s.big, element: 'fire' });
        run.sfx('meteor');
        if (s.big) {
          run.screen.shake(0.5);
          run.screen.stop(0.06);
          for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; this.addCloud(s.x + Math.cos(a) * s.r * 0.6, s.z + Math.sin(a) * s.r * 0.6, 1.6, 4, s.weapon.stats.damage * 0.25, s.weapon, 'fire'); }
        }
        run.enemies.grid.query(s.x, s.z, s.r, (e) => run.burn(e, s.weapon.stats.damage * 0.3));
      }
    }
  }

  private soulReaper(w: WeaponInstance, run: Run) {
    if (w.timer > 0) return;
    const st = w.stats;
    const p = run.player;
    const ts = this.targets(run, 14, Math.round(st.count));
    if (!ts.length) { w.timer = 0; return; }
    w.timer = st.cooldown;
    const n = Math.round(st.count);
    for (let i = 0; i < n; i++) {
      const t = ts[i % ts.length];
      const a = Math.atan2(t.z - p.z, t.x - p.x) + (i - (n - 1) / 2) * 0.5;
      run.projectiles.spawn('scythe', p.x, p.z, Math.cos(a), Math.sin(a), st.speed, {
        damage: st.damage, pierce: Math.round(st.pierce), radius: st.area, scale: st.area * (w.evolved ? 1.3 : 1),
        life: st.duration, kb: st.knockback, crit: st.crit, weapon: w, targetId: t.id, evolved: w.evolved, y: 1,
      });
    }
    run.sfx('reaper');
  }

  /** Kill hook: Soul Reaper healing and Death's Collection souls. */
  onKill(e: Enemy, killer: WeaponInstance | null | undefined, run: Run) {
    const reaper = this.get('soulReaper');
    if (!reaper) return;
    if (killer === reaper && Math.random() < (reaper.evolved ? 0.35 : 0.12)) {
      run.heal(1 + reaper.level * 0.25, false);
      run.particles.emit(e.x, 1, e.z, 0, 3, 0, 0.6, 0.2, '#9bf6ff', -2);
    }
    if (reaper.evolved && Math.random() < 0.5 && run.projectiles.activeCount('wisp') < 40) {
      const t = run.enemies.grid.nearest(e.x, e.z, 10);
      if (t) run.projectiles.spawn('wisp', e.x, e.z, t.x - e.x, t.z - e.z, 11, {
        damage: reaper.stats.damage * 0.6, pierce: 1, radius: 0.5, scale: 0.25, life: 3, kb: 1, crit: reaper.stats.crit, weapon: reaper, targetId: t.id, y: 1.2,
      });
    }
  }

  private tesla(w: WeaponInstance, run: Run) {
    const st = w.stats;
    const p = run.player;
    const max = Math.round(st.count) + (w.evolved ? 1 : 0);
    if (w.timer > 0) return;
    if (!run.enemies.grid.nearest(p.x, p.z, st.area + 3)) { w.timer = 0; return; }
    w.timer = st.cooldown * (w.evolved ? 0.6 : 1);
    const mine = this.turrets.filter((t) => t.weapon === w);
    if (mine.length >= max) {
      // relocate the oldest coil
      const old = mine[0];
      old.group.visible = false;
      this.turrets.splice(this.turrets.indexOf(old), 1);
    }
    const pos = { x: p.x + rand(-1, 1), z: p.z + rand(-1, 1) };
    run.world.resolve(pos, 0.6);
    const group = this.turretGroup();
    group.position.set(pos.x, 0, pos.z);
    this.turrets.push({ x: pos.x, z: pos.z, life: w.evolved ? Infinity : st.duration, tick: 0.2, weapon: w, group });
    run.vfx.ring(pos.x, pos.z, 0.3, 2, '#7df9ff', 0.35);
    run.sfx('tesla');
  }

  private updateTurrets(dt: number, run: Run) {
    for (let i = this.turrets.length - 1; i >= 0; i--) {
      const t = this.turrets[i];
      const w = t.weapon;
      const st = w.stats;
      t.life -= dt;
      t.tick -= dt;
      if (t.tick <= 0) {
        t.tick = 0.55;
        const first = run.enemies.grid.nearest(t.x, t.z, st.area);
        if (first) {
          const hit = new Set<number>([first.id]);
          run.vfx.lightning(t.x, 2.3, t.z, first.x, 1, first.z, '#7df9ff', 0.12);
          run.hitEnemy(first, st.damage, { crit: st.crit, kb: st.knockback, weapon: w, quiet: true });
          let cur = first;
          for (let j = 0; j < Math.round(st.pierce); j++) {
            const next = run.enemies.grid.nearest(cur.x, cur.z, 4.5 * (this.flags.has('chainRange') ? 1.4 : 1), (e) => !hit.has(e.id));
            if (!next) break;
            hit.add(next.id);
            run.vfx.lightning(cur.x, 1, cur.z, next.x, 1, next.z, '#7df9ff', 0.1);
            run.hitEnemy(next, st.damage * 0.85, { crit: st.crit, kb: 0, weapon: w, quiet: true });
            cur = next;
          }
          run.sfx('tesla');
        }
      }
      if (t.life <= 0) { t.group.visible = false; this.turrets.splice(i, 1); }
    }
    // INFINITE CIRCUIT: electric fences between linked coils
    for (let a = 0; a < this.turrets.length; a++) {
      const ta = this.turrets[a];
      if (!ta.weapon.evolved) continue;
      for (let b = a + 1; b < this.turrets.length; b++) {
        const tb = this.turrets[b];
        const len = Math.hypot(tb.x - ta.x, tb.z - ta.z);
        if (len > 16 || len < 0.5) continue;
        if (Math.random() < 0.25) run.vfx.lightning(ta.x, 1.6, ta.z, tb.x, 1.6, tb.z, '#bdf9ff', 0.08);
        const mx = (ta.x + tb.x) / 2, mz = (ta.z + tb.z) / 2;
        const dx = (tb.x - ta.x) / len, dz = (tb.z - ta.z) / len;
        run.enemies.grid.query(mx, mz, len / 2 + 0.5, (e) => {
          const rx = e.x - ta.x, rz = e.z - ta.z;
          const along = rx * dx + rz * dz;
          const side = Math.abs(-rx * dz + rz * dx);
          if (along < 0 || along > len || side > 0.8 + e.radius) return;
          if (run.time - e.bladeHitT2 < 0.4) return;
          e.bladeHitT2 = run.time;
          run.hitEnemy(e, ta.weapon.stats.damage * 0.8, { crit: ta.weapon.stats.crit, kb: 1, weapon: ta.weapon, quiet: true });
        });
      }
    }
  }

  private gravityWell(w: WeaponInstance, run: Run) {
    if (w.timer > 0) return;
    const st = w.stats;
    const n = Math.round(st.count) + (w.evolved ? 1 : 0);
    const spot = this.densest(run, 14);
    if (!spot) { w.timer = 0; return; }
    w.timer = st.cooldown;
    for (let i = 0; i < n; i++) {
      if (this.holes.length >= this.holeMeshes.length) break;
      const x = spot.x + (i ? rand(-5, 5) : 0), z = spot.z + (i ? rand(-5, 5) : 0);
      const life = st.duration * (w.evolved ? 1.4 : 1);
      this.holes.push({ x, z, r: st.area * (w.evolved ? 1.3 : 1), life, max: life, tick: 0, damage: st.damage, weapon: w, kind: 'well', swallowed: 0 });
    }
    run.sfx('rift');
  }

  private boulder(w: WeaponInstance, run: Run) {
    if (w.timer > 0) return;
    const st = w.stats;
    const p = run.player;
    const t = this.targets(run, 16, 1)[0];
    if (!t) { w.timer = 0; return; }
    w.timer = st.cooldown;
    const n = Math.round(st.count) + (w.evolved ? 2 : 0);
    const base = Math.atan2(t.z - p.z, t.x - p.x);
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * 0.35;
      const size = w.evolved ? 1.6 : 1.15;
      run.projectiles.spawn('boulder', p.x + Math.cos(a) * 1.2, p.z + Math.sin(a) * 1.2, Math.cos(a), Math.sin(a), st.speed, {
        damage: st.damage, pierce: 999, radius: size, scale: size, life: 6, maxDist: st.area, kb: st.knockback, crit: st.crit, weapon: w, evolved: w.evolved, phase: 0,
      });
    }
    run.sfx('boulder');
  }

  boulderEnd(pr: Projectile, run: Run) {
    run.particles.burst(pr.x, 0.6, pr.z, 14, '#a98467', 5, 0.3, 0.6);
    if (!pr.evolved || pr.phase > 0 || !pr.weapon) return;
    // AVALANCHE: shatter into a rockslide
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + Math.random() * 0.4;
      run.projectiles.spawn('boulder', pr.x, pr.z, Math.cos(a), Math.sin(a), pr.speed * 1.2, {
        damage: pr.damage * 0.55, pierce: 999, radius: 0.7, scale: 0.65, life: 3, maxDist: 7, kb: pr.kb * 0.6, crit: pr.crit, weapon: pr.weapon, evolved: true, phase: 1,
      });
    }
    run.screen.shake(0.15);
    run.sfx('boulder');
  }

  private dronePositions(w: WeaponInstance, run: Run): { x: number; y: number; z: number }[] {
    const p = run.player;
    const n = Math.round(w.stats.count);
    const out: { x: number; y: number; z: number }[] = [];
    for (let i = 0; i < n; i++) {
      const a = w.angle + (i / n) * Math.PI * 2;
      out.push({ x: p.x + Math.cos(a) * 2.3, y: 2.2 + Math.sin(run.time * 3 + i) * 0.2, z: p.z + Math.sin(a) * 2.3 });
    }
    return out;
  }

  private drones(w: WeaponInstance, run: Run, dt: number) {
    const st = w.stats;
    w.angle += dt * st.speed;
    if (w.timer > 0) return;
    w.timer = st.cooldown;
    let fired = false;
    for (const d of this.dronePositions(w, run)) {
      const t = run.enemies.priorityTarget(d.x, d.z, st.area) ?? run.enemies.grid.nearest(d.x, d.z, st.area);
      if (!t) continue;
      fired = true;
      if (w.evolved) {
        run.projectiles.spawn('missile', d.x, d.z, t.x - d.x, t.z - d.z, 16, {
          damage: st.damage * 1.3, pierce: 1, radius: 0.4, scale: 1, life: 2.5, kb: 2, crit: st.crit, weapon: w, targetId: t.id, y: d.y * 0.6,
        });
      } else {
        run.vfx.beam(d.x, d.y, d.z, t.x, 0.9, t.z, '#90e0ef', 0.08);
        run.hitEnemy(t, st.damage, { crit: st.crit, kb: 1, weapon: w, quiet: true });
      }
    }
    if (fired) run.sfx('drone'); else w.timer = 0.1;
  }

  private fireTornado(w: WeaponInstance, run: Run) {
    if (w.timer > 0) return;
    const st = w.stats;
    const p = run.player;
    const ts = this.targets(run, 14, 1);
    if (!ts.length) { w.timer = 0; return; }
    w.timer = st.cooldown;
    const n = Math.round(st.count);
    for (let i = 0; i < n; i++) {
      if (this.tornados.filter((t) => t.weapon === w).length >= n + 1) break;
      const a = Math.atan2(ts[0].z - p.z, ts[0].x - p.x) + (i - (n - 1) / 2) * 0.8;
      const life = st.duration * (w.evolved ? 1.4 : 1);
      this.tornados.push({ x: p.x, z: p.z, vx: Math.cos(a) * st.speed, vz: Math.sin(a) * st.speed, life, max: life, tick: 0, trail: 0, weapon: w, group: this.tornadoGroup() });
    }
    run.sfx('tornado');
  }

  private updateTornados(dt: number, run: Run) {
    for (let i = this.tornados.length - 1; i >= 0; i--) {
      const t = this.tornados[i];
      const w = t.weapon;
      const st = w.stats;
      const R = st.area * (w.evolved ? 1.8 : 1);
      t.life -= dt;
      // meander, and the evolved cyclone hunts the nearest crowd
      const steer = w.evolved ? run.enemies.grid.nearest(t.x, t.z, 12) : null;
      if (steer) {
        const dx = steer.x - t.x, dz = steer.z - t.z, l = Math.hypot(dx, dz) || 1;
        t.vx += ((dx / l) * st.speed - t.vx) * Math.min(1, dt * 1.5);
        t.vz += ((dz / l) * st.speed - t.vz) * Math.min(1, dt * 1.5);
      } else {
        const a = Math.atan2(t.vz, t.vx) + Math.sin(run.time * 2 + i) * dt * 1.5;
        const sp = Math.hypot(t.vx, t.vz);
        t.vx = Math.cos(a) * sp; t.vz = Math.sin(a) * sp;
      }
      t.x += t.vx * dt; t.z += t.vz * dt;
      if (run.world.resolve(t, R * 0.5)) { t.vx *= -1; t.vz *= -1; }
      t.tick -= dt;
      if (t.tick <= 0) {
        t.tick = 0.35;
        run.enemies.grid.query(t.x, t.z, R, (e) => {
          if (w.evolved && e.kind !== 'boss' && !e.def?.heavy) {
            const dx = t.x - e.x, dz = t.z - e.z, d = Math.hypot(dx, dz) || 1;
            e.x += (dx / d) * Math.min(d, 0.6); e.z += (dz / d) * Math.min(d, 0.6);
          }
          run.burn(e, st.damage * 1.5);
          run.hitEnemy(e, st.damage, { crit: st.crit, kb: st.knockback, weapon: w, quiet: true });
        });
      }
      t.trail -= dt;
      if (t.trail <= 0) {
        t.trail = w.evolved ? 0.25 : 0.45;
        this.addCloud(t.x, t.z, R * 0.6, w.evolved ? 3 : 1.8, st.damage * 0.5, w, 'fire');
      }
      if (Math.random() < 0.8) run.particles.emit(t.x + rand(-R, R) * 0.5, rand(0.3, 2.5), t.z + rand(-R, R) * 0.5, rand(-1, 1), 3, rand(-1, 1), 0.5, 0.18, Math.random() < 0.5 ? '#ff5400' : '#ffd60a', -2);
      t.group.position.set(t.x, 0, t.z);
      const grow = Math.min(1, (t.max - t.life) / 0.3) * Math.min(1, t.life / 0.3 + 0.2);
      t.group.scale.set(R * 0.8 * grow, (w.evolved ? 1.5 : 1) * grow, R * 0.8 * grow);
      t.group.rotation.y = run.time * 8;
      if (t.life <= 0) { t.group.visible = false; this.tornados.splice(i, 1); }
    }
  }

  private goldenCannon(w: WeaponInstance, run: Run) {
    if (w.timer > 0) return;
    const st = w.stats;
    const ts = this.targets(run, 18, Math.round(st.count));
    if (!ts.length) { w.timer = 0; return; }
    w.timer = st.cooldown;
    const shots = Math.round(st.count) + (w.evolved ? 4 : 0);
    const goldBonus = w.evolved ? 1 + Math.min(1, run.gold / 1000) : 1;
    for (let i = 0; i < shots; i++) {
      run.schedule(i * (w.evolved ? 0.12 : 0.25), () => {
        const p = run.player;
        const t = ts[i % ts.length];
        const a = Math.atan2(t.z - p.z, t.x - p.x) + (w.evolved ? rand(-0.15, 0.15) : 0);
        run.projectiles.spawn('cannon', p.x, p.z, Math.cos(a), Math.sin(a), st.speed, {
          damage: st.damage * goldBonus, pierce: Math.round(st.pierce), radius: st.area, scale: st.area * 0.8, life: st.duration, maxDist: 30, kb: st.knockback, crit: st.crit + 0.05, weapon: w, y: 1,
        });
        run.particles.burst(p.x + Math.cos(a), 1, p.z + Math.sin(a), 6, '#ffd60a', 4, 0.15, 0.3);
        run.sfx('cannon');
      });
    }
  }

  private mirrorShards(w: WeaponInstance, run: Run) {
    if (w.timer > 0) return;
    const st = w.stats;
    const p = run.player;
    const dir = this.aimDir(run);
    const base = Math.atan2(dir.z, dir.x);
    if (!run.enemies.grid.nearest(p.x, p.z, 16)) { w.timer = 0; return; }
    w.timer = st.cooldown;
    const n = Math.round(st.count);
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * 0.18;
      run.projectiles.spawn('shard', p.x, p.z, Math.cos(a), Math.sin(a), st.speed, {
        damage: st.damage, pierce: 1, radius: 0.4, scale: 0.4, life: st.duration, kb: st.knockback, crit: st.crit, weapon: w, evolved: w.evolved, phase: 0,
      });
    }
    run.sfx('shard');
  }

  /** Mirror shard hit: split into smaller shards that ignore the enemy that was just hit. */
  shardSplit(pr: Projectile, e: Enemy, run: Run) {
    const w = pr.weapon;
    if (!w) return;
    const maxDepth = w.evolved ? 3 : w.level >= 5 ? 2 : 1;
    if (pr.phase >= maxDepth) return;
    const pieces = w.evolved ? 5 : 2 + Math.round(w.stats.pierce);
    const base = Math.atan2(pr.vz, pr.vx);
    for (let k = 0; k < pieces; k++) {
      const a = base + (k - (pieces - 1) / 2) * (1.6 / pieces) + rand(-0.1, 0.1);
      const c = run.projectiles.spawn('shard', e.x + Math.cos(a) * 0.6, e.z + Math.sin(a) * 0.6, Math.cos(a), Math.sin(a), pr.speed * 0.9, {
        damage: pr.damage * 0.55, pierce: 1, radius: 0.3, scale: pr.scale * 0.7, life: 0.5, kb: pr.kb * 0.5, crit: pr.crit, weapon: w, evolved: pr.evolved, phase: pr.phase + 1,
      });
      if (c) c.hits.push(e.id);
    }
    run.particles.burst(e.x, 1, e.z, 6, '#a0e7ff', 4, 0.12, 0.3);
    run.sfx('shard');
  }

  private voidRift(w: WeaponInstance, run: Run) {
    const st = w.stats;
    const p = run.player;
    if (w.evolved) {
      // ABYSSAL GATE: four rotating spokes
      if (!this.rifts.some((r) => r.weapon === w)) {
        for (let k = 0; k < 4; k++) this.rifts.push({ x: p.x, z: p.z, angle: (k / 4) * Math.PI * 2, len: st.area * 1.2, width: 1.6, life: Infinity, max: Infinity, tick: 0, weapon: w, mesh: this.riftMesh(), spin: 1 });
      }
      return;
    }
    if (w.timer > 0) return;
    const ts = this.targets(run, st.area + 2, Math.round(st.count));
    if (!ts.length) { w.timer = 0; return; }
    w.timer = st.cooldown;
    for (let i = 0; i < Math.round(st.count); i++) {
      const t = ts[i % ts.length];
      const a = Math.atan2(t.z - p.z, t.x - p.x) + (i ? rand(-0.6, 0.6) : 0);
      this.rifts.push({ x: p.x, z: p.z, angle: a, len: st.area, width: 1.5, life: st.duration, max: st.duration, tick: 0, weapon: w, mesh: this.riftMesh(), spin: 0 });
    }
    run.sfx('rift');
  }

  private updateRifts(dt: number, run: Run) {
    const p = run.player;
    for (let i = this.rifts.length - 1; i >= 0; i--) {
      const r = this.rifts[i];
      const w = r.weapon;
      r.life -= dt;
      if (r.spin) { r.x = p.x; r.z = p.z; r.angle += dt * 1.6; r.len = w.stats.area * 1.2; }
      r.tick -= dt;
      const dx = Math.cos(r.angle), dz = Math.sin(r.angle);
      if (r.tick <= 0) {
        r.tick = 0.25;
        const mx = r.x + dx * r.len / 2, mz = r.z + dz * r.len / 2;
        run.enemies.grid.query(mx, mz, r.len / 2 + r.width, (e) => {
          const rx = e.x - r.x, rz = e.z - r.z;
          const along = rx * dx + rz * dz;
          const side = -rx * dz + rz * dx;
          if (along < 0 || along > r.len || Math.abs(side) > r.width / 2 + e.radius) return;
          e.slowT = 0.5 * run.stats.statusDuration; e.slowFactor = 0.45;
          if (r.spin && e.kind !== 'boss' && !e.def?.heavy) { e.x -= -dz * Math.sign(side) * 0.3; e.z -= dx * Math.sign(side) * 0.3; }
          run.hitEnemy(e, w.stats.damage, { crit: w.stats.crit, kb: 0, weapon: w, quiet: true });
        });
      }
      const fade = r.life === Infinity ? 1 : Math.min(1, r.life / 0.3, (r.max - r.life) / 0.15);
      r.mesh.position.set(r.x, 0.08, r.z);
      r.mesh.rotation.y = -r.angle;
      r.mesh.scale.set(r.len, 1, r.width * fade * (0.85 + Math.sin(run.time * 30 + i) * 0.15));
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = 0.75 * fade;
      if (Math.random() < 0.5) {
        const t = Math.random() * r.len;
        run.particles.emit(r.x + dx * t, 0.2, r.z + dz * t, 0, 2.5, 0, 0.4, 0.14, Math.random() < 0.5 ? '#c77dff' : '#240046', -1);
      }
      if (r.life <= 0) { r.mesh.visible = false; this.rifts.splice(i, 1); }
    }
  }

  render(run: Run) {
    // blades
    let bn = 0;
    for (const w of this.list) {
      if (w.id !== 'blades') continue;
      for (const b of this.bladePositions(w, run)) {
        if (bn >= 40) break;
        _q.setFromEuler(_e.set(0, run.time * 14 + bn, 0));
        _m.compose(_p.set(b.x, 0.9, b.z), _q, _s.setScalar(w.evolved ? 1.15 : 0.9));
        this.bladeMesh.setMatrixAt(bn++, _m);
      }
    }
    this.bladeMesh.count = bn;
    this.bladeMesh.instanceMatrix.needsUpdate = true;
    // clouds
    let pn = 0;
    for (const c of this.clouds) {
      const fade = c.follow ? 0.75 : Math.min(1, c.life / 0.5, (c.max - c.life) / 0.3 + 0.2);
      const puffs = c.follow ? 10 : 7;
      for (let k = c.follow ? 1 : 0; k < puffs && pn < 160; k++) {
        const a = (k / puffs) * Math.PI * 2 + run.time * (c.follow ? 0.8 : 0.4);
        const rr = k === 0 ? 0 : c.r * (c.follow ? 0.92 : 0.6);
        const s = c.r * (k === 0 ? 0.65 : c.follow ? 0.24 : 0.45) * fade * (1 + Math.sin(run.time * 3 + k) * 0.08);
        _m.compose(_p.set(c.x + Math.cos(a) * rr, 0.4 + Math.sin(run.time * 2 + k) * 0.15, c.z + Math.sin(a) * rr), _q.identity(), _s.set(s, s * (c.kind === 'fire' ? 0.45 : 0.6), s));
        this.puffMesh.setColorAt(pn, c.kind === 'fire' ? (k % 2 ? FIRE_A : FIRE_B) : POISON);
        this.puffMesh.setMatrixAt(pn++, _m);
      }
    }
    this.puffMesh.count = pn;
    this.puffMesh.instanceMatrix.needsUpdate = true;
    if (this.puffMesh.instanceColor) this.puffMesh.instanceColor.needsUpdate = true;
    // falling meteors above their markers
    let mn = 0;
    for (const s of this.strikes) {
      if (mn >= 48) break;
      const t = Math.min(1, s.t / s.warn);
      const size = s.big ? 2.2 : 0.7;
      _q.setFromEuler(_e.set(run.time * 5, run.time * 3, 0));
      _m.compose(_p.set(s.x - (1 - t) * 6, 0.5 + (1 - t) * 22, s.z - (1 - t) * 3), _q, _s.setScalar(size));
      this.meteorMesh.setMatrixAt(mn++, _m);
      if (Math.random() < 0.6) run.particles.emit(s.x - (1 - t) * 6, 0.5 + (1 - t) * 22, s.z - (1 - t) * 3, 0, 1, 0, 0.35, size * 0.4, Math.random() < 0.5 ? '#ff7b00' : '#ffd60a', 0);
    }
    this.meteorMesh.count = mn;
    this.meteorMesh.instanceMatrix.needsUpdate = true;
    // drones
    let dn = 0;
    for (const w of this.list) {
      if (w.id !== 'drones') continue;
      for (const d of this.dronePositions(w, run)) {
        if (dn >= 20) break;
        _q.setFromEuler(_e.set(0.15, run.time * 6 + dn, 0));
        _m.compose(_p.set(d.x, d.y, d.z), _q, _s.setScalar(w.evolved ? 1.15 : 0.9));
        this.droneMesh.setMatrixAt(dn++, _m);
      }
    }
    this.droneMesh.count = dn;
    this.droneMesh.instanceMatrix.needsUpdate = true;
    for (const t of this.turrets) { t.group.children[2].scale.setScalar(1 + Math.sin(run.time * 12) * 0.2); t.group.children[1].rotation.y = run.time * 3; }
    // black holes
    this.holeMeshes.forEach((g, i) => {
      const h = this.holes[i];
      g.visible = !!h;
      if (!h) return;
      const grow = Math.min(1, (h.max - h.life) / 0.25) * Math.min(1, h.life / 0.2 + 0.3);
      g.position.set(h.x, 1, h.z);
      g.scale.setScalar(h.r * 0.45 * grow);
      g.rotation.y = run.time * (h.kind === 'well' ? -3 : 4);
      g.children[2].scale.setScalar(2.2);
      ((g.children[1] as THREE.Mesh).material as THREE.MeshBasicMaterial).color.set(h.kind === 'well' ? '#48bfe3' : '#c77dff');
      if (h.kind === 'well') g.scale.setScalar(h.r * 0.38 * grow);
    });
    if (!this.list.some((w) => w.id === 'lightning' && w.evolved)) this.storm.visible = false;
  }
}
