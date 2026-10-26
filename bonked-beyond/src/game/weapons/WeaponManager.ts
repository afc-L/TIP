// Modular weapon framework: each weapon is a definition (data/weapons.ts) plus a behaviour here.
import * as THREE from 'three';
import type { StatBlock, WeaponDef, WeaponId, WeaponStats } from '../../data/types';
import { WEAPON_MAP, WEAPON_MAX_LEVEL, weaponStatsAt } from '../../data/weapons';
import { input } from '../Input';
import { box, merge, sphere } from '../models/shapes';
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

interface Cloud { x: number; z: number; r: number; life: number; max: number; tick: number; damage: number; follow: boolean; weapon: WeaponInstance }
interface BlackHole { x: number; z: number; r: number; life: number; max: number; tick: number; damage: number; weapon: WeaponInstance }

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

export const MAX_WEAPONS = 6;

export class WeaponManager {
  list: WeaponInstance[] = [];
  private clouds: Cloud[] = [];
  private holes: BlackHole[] = [];
  private bladeMesh: THREE.InstancedMesh;
  private puffMesh: THREE.InstancedMesh;
  private holeMeshes: THREE.Group[] = [];
  private storm: THREE.Group;
  private lungeSeq = 1;
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    const blade = merge([box(0.9, 0.06, 0.18), box(0.18, 0.06, 0.9), box(0.6, 0.07, 0.6, { r: [0, Math.PI / 4, 0] })]);
    this.bladeMesh = new THREE.InstancedMesh(blade, new THREE.MeshLambertMaterial({ color: '#d8f3ff', emissive: '#3a86ff', emissiveIntensity: 0.35, flatShading: true }), 40);
    this.bladeMesh.count = 0;
    this.bladeMesh.frustumCulled = false;
    scene.add(this.bladeMesh);
    this.puffMesh = new THREE.InstancedMesh(sphere(1, {}, 1), new THREE.MeshLambertMaterial({ color: '#80ff72', emissive: '#2d6a4f', transparent: true, opacity: 0.42, depthWrite: false, flatShading: true }), 160);
    this.puffMesh.count = 0;
    this.puffMesh.frustumCulled = false;
    scene.add(this.puffMesh);
    for (let i = 0; i < 5; i++) {
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
  }

  dispose() {
    for (const o of [this.bladeMesh, this.puffMesh, this.storm, ...this.holeMeshes]) o.removeFromParent();
    this.bladeMesh.dispose();
    this.puffMesh.dispose();
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
      const projectile = ['orb', 'knives', 'boomerang', 'rocket', 'poison', 'blades'].includes(w.id);
      w.stats = {
        damage: b.damage * s.damageMult * (w.def.explosive ? s.explosiveMult : 1) * (evo ? 1.6 : 1),
        cooldown: Math.max(0.12, b.cooldown * s.cooldownMult),
        area: b.area * s.areaMult * (evo && (w.id === 'boomerang' || w.id === 'blades') ? 1.25 : 1),
        count: b.count + (projectile ? s.extraProjectiles : 0) + (w.id === 'lightning' && evo ? 4 : 0),
        pierce: b.pierce + (w.id === 'lightning' ? s.extraProjectiles : 0),
        speed: b.speed * (w.id === 'blades' ? 1 : s.projectileSpeedMult),
        duration: b.duration * s.durationMult,
        knockback: b.knockback * s.knockbackMult,
        crit: b.crit,
      };
      if (evo && w.id === 'lightning') w.stats.cooldown *= 0.5;
      if (evo && w.id === 'charge') w.stats.cooldown *= 0.7;
    }
  }

  clear() {
    this.clouds.length = 0;
    this.holes.length = 0;
    for (const g of this.holeMeshes) g.visible = false;
    this.storm.visible = false;
  }

  get plagueGarden() { return !!this.list.find((w) => w.id === 'poison' && w.evolved); }

  aimDir(run: Run): { x: number; z: number } {
    const p = run.player;
    if (run.aimPoint && input.mouseRecentlyActive()) {
      const dx = run.aimPoint.x - p.x, dz = run.aimPoint.z - p.z;
      const l = Math.hypot(dx, dz);
      if (l > 0.5) return { x: dx / l, z: dz / l };
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
        case 'charge': this.charge(w, run, dt); break;
      }
    }
    this.updateClouds(dt, run);
    this.updateHoles(dt, run);
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
      this.clouds.push({ x: p.x, z: p.z, r: st.area * 1.4, life: Infinity, max: Infinity, tick: 0, damage: st.damage * 0.8, follow: true, weapon: w });
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

  addCloud(x: number, z: number, r: number, life: number, damage: number, w: WeaponInstance) {
    if (this.clouds.length >= 18) return;
    this.clouds.push({ x, z, r, life, max: life, tick: 0, damage, follow: false, weapon: w });
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
          e.slowT = 0.7;
          e.poisonT = 0.8;
          run.hitEnemy(e, c.damage, { crit: 0, kb: 0, weapon: c.weapon, quiet: true, poison: true });
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
    this.holes.push({ x, z, r: 3.6 * Math.max(1, w.stats.area / 0.45) ** 0.5, life, max: life, tick: 0, damage: w.stats.damage * 0.35, weapon: w });
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
          const dx = h.x - e.x, dz = h.z - e.z, d = Math.hypot(dx, dz) || 1;
          const pull = Math.min(d, 9 * dt * (1 - e.kbResist * 0.7));
          e.x += (dx / d) * pull; e.z += (dz / d) * pull;
        }
        if (doTick) run.hitEnemy(e, h.damage, { crit: h.weapon.stats.crit, kb: 0, weapon: h.weapon, quiet: true });
      });
      if (Math.random() < 0.6) {
        const a = Math.random() * Math.PI * 2;
        run.particles.emit(h.x + Math.cos(a) * h.r, 0.5, h.z + Math.sin(a) * h.r, -Math.cos(a) * h.r * 2, 0.5, -Math.sin(a) * h.r * 2, 0.45, 0.12, '#c77dff', 0);
      }
      if (h.life <= 0) {
        this.holes.splice(i, 1);
        run.explode(h.x, h.z, h.r * 0.8, h.damage * 4, { kb: 10, crit: 0, weapon: h.weapon, color: '#c77dff' });
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

  private charge(w: WeaponInstance, run: Run, dt: number) {
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
      void dt;
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
        _m.compose(_p.set(c.x + Math.cos(a) * rr, 0.4 + Math.sin(run.time * 2 + k) * 0.15, c.z + Math.sin(a) * rr), _q.identity(), _s.set(s, s * 0.6, s));
        this.puffMesh.setMatrixAt(pn++, _m);
      }
    }
    this.puffMesh.count = pn;
    this.puffMesh.instanceMatrix.needsUpdate = true;
    // black holes
    this.holeMeshes.forEach((g, i) => {
      const h = this.holes[i];
      g.visible = !!h;
      if (!h) return;
      const grow = Math.min(1, (h.max - h.life) / 0.25) * Math.min(1, h.life / 0.2 + 0.3);
      g.position.set(h.x, 1, h.z);
      g.scale.setScalar(h.r * 0.45 * grow);
      g.rotation.y = run.time * 4;
      g.children[2].scale.setScalar(2.2);
    });
    if (!this.list.some((w) => w.id === 'lightning' && w.evolved)) this.storm.visible = false;
    void this.scene;
  }
}
