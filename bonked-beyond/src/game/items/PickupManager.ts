// XP gems, gold, temporary power-ups and interactive world objects (chests, shrines, barrels).
import * as THREE from 'three';
import { CONFIG } from '../GameConfig';
import { buildBarrel, buildChest, buildPowerup, buildShrine, POWERUP_INFO, type PowerupKind } from '../models/propModels';
import { cyl, octa } from '../models/shapes';
import type { Run } from '../Run';
import { rand } from '../util';

interface Gem { active: boolean; x: number; z: number; value: number; magnet: boolean; speed: number; t: number }
interface Coin { active: boolean; x: number; z: number; value: number; magnet: boolean; speed: number; t: number }
interface Powerup { active: boolean; kind: PowerupKind; x: number; z: number; t: number; group: THREE.Group; life: number }
export interface Chest { x: number; z: number; golden: boolean; cost: number; opened: boolean; openT: number; group: THREE.Group; lid: THREE.Group; rewards: number }
interface Shrine { x: number; z: number; used: boolean; group: THREE.Group; orb: THREE.Mesh }
interface Barrel { x: number; z: number; alive: boolean; group: THREE.Group }

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

const GEM_COLORS = ['#4cc9f0', '#80ff72', '#ff4d6d', '#ffd60a'];

export class PickupManager {
  gems: Gem[] = [];
  coins: Coin[] = [];
  powerups: Powerup[] = [];
  chests: Chest[] = [];
  shrines: Shrine[] = [];
  barrels: Barrel[] = [];
  private gemMeshes: THREE.InstancedMesh[];
  private coinMesh: THREE.InstancedMesh;
  private scene: THREE.Scene;
  private gemCursor = 0;
  private group = new THREE.Group();
  chestsOpened = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    scene.add(this.group);
    const cap = CONFIG.xp.gemCap;
    for (let i = 0; i < cap; i++) this.gems.push({ active: false, x: 0, z: 0, value: 1, magnet: false, speed: 0, t: 0 });
    for (let i = 0; i < 150; i++) this.coins.push({ active: false, x: 0, z: 0, value: 1, magnet: false, speed: 0, t: 0 });
    this.gemMeshes = GEM_COLORS.map((c, i) => {
      const m = new THREE.InstancedMesh(octa(1, { s: [0.75, 1.15, 0.75] }), new THREE.MeshBasicMaterial({ color: c }), cap);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.count = 0;
      m.frustumCulled = false;
      m.userData.size = [0.2, 0.28, 0.38, 0.5][i];
      this.group.add(m);
      return m;
    });
    this.coinMesh = new THREE.InstancedMesh(cyl(0.22, 0.22, 0.07, { r: [Math.PI / 2, 0, 0] }, 10), new THREE.MeshLambertMaterial({ color: '#ffd60a', emissive: '#b8860b', emissiveIntensity: 0.5 }), 150);
    this.coinMesh.count = 0;
    this.coinMesh.frustumCulled = false;
    this.group.add(this.coinMesh);
  }

  dispose() {
    this.group.removeFromParent();
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
    });
  }

  // ---------- spawning ----------
  gem(x: number, z: number, value: number) {
    let g = this.gems.find((q) => !q.active);
    if (!g) {
      // cap reached: merge value into an existing gem far from the action
      g = this.gems[this.gemCursor];
      this.gemCursor = (this.gemCursor + 1) % this.gems.length;
      g.value += value;
      return;
    }
    g.active = true; g.x = x + rand(-0.3, 0.3); g.z = z + rand(-0.3, 0.3); g.value = value; g.magnet = false; g.speed = 0; g.t = Math.random() * 6;
  }

  coin(x: number, z: number, value: number) {
    const c = this.coins.find((q) => !q.active);
    if (!c) return;
    c.active = true; c.x = x + rand(-0.4, 0.4); c.z = z + rand(-0.4, 0.4); c.value = value; c.magnet = false; c.speed = 0; c.t = Math.random() * 6;
  }

  powerup(kind: PowerupKind, x: number, z: number) {
    if (this.powerups.filter((p) => p.active).length > 20) return;
    let p = this.powerups.find((q) => !q.active && q.kind === kind);
    if (!p) {
      const group = buildPowerup(kind);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.65, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: POWERUP_INFO[kind].color, transparent: true, opacity: 0.6, depthWrite: false }));
      ring.name = 'ring';
      group.add(ring);
      this.group.add(group);
      p = { active: false, kind, x, z, t: 0, group, life: 0 };
      this.powerups.push(p);
    }
    p.active = true; p.x = x; p.z = z; p.t = 0; p.life = 40;
    p.group.visible = true;
  }

  addChest(x: number, z: number, golden: boolean, cost: number, rewards = 1) {
    const { group, lid } = buildChest(golden);
    group.position.set(x, 0, z);
    group.rotation.y = Math.random() * Math.PI * 2;
    this.group.add(group);
    const c: Chest = { x, z, golden, cost, opened: false, openT: 0, group, lid, rewards };
    this.chests.push(c);
    return c;
  }

  setupWorld(run: Run) {
    const w = run.world;
    const rnd = Math.random;
    for (let i = 0; i < 4; i++) {
      const p = w.openPoint(14, w.radius - 4, 2, rnd);
      this.addChest(p.x, p.z, false, CONFIG.chest.baseCost + i * CONFIG.chest.costGrowth);
    }
    this.chests.sort((a, b) => a.cost - b.cost);
    for (let i = 0; i < 3; i++) {
      const p = w.openPoint(16, w.radius - 5, 2.5, rnd);
      const { group, orb } = buildShrine();
      group.position.set(p.x, 0, p.z);
      this.group.add(group);
      this.shrines.push({ x: p.x, z: p.z, used: false, group, orb });
      run.world.obstacles.push({ x: p.x, z: p.z, r: 0.01 });
    }
    for (let i = 0; i < 28; i++) {
      const p = w.openPoint(7, w.radius - 3, 1.2, rnd);
      const group = buildBarrel();
      group.position.set(p.x, 0, p.z);
      group.rotation.y = Math.random() * 3;
      this.group.add(group);
      this.barrels.push({ x: p.x, z: p.z, alive: true, group });
    }
  }

  magnetAll() {
    for (const g of this.gems) if (g.active) g.magnet = true;
    for (const c of this.coins) if (c.active) c.magnet = true;
  }

  breakBarrelsIn(x: number, z: number, r: number, run: Run) {
    for (const b of this.barrels) {
      if (!b.alive) continue;
      if ((b.x - x) ** 2 + (b.z - z) ** 2 < (r + 0.5) ** 2) this.breakBarrel(b, run);
    }
  }

  private breakBarrel(b: Barrel, run: Run) {
    b.alive = false;
    b.group.visible = false;
    run.particles.burst(b.x, 0.6, b.z, 14, '#a0522d', 5, 0.2, 0.6);
    run.sfx('hit');
    const r = Math.random();
    if (r < 0.45) for (let i = 0; i < 4; i++) this.coin(b.x, b.z, 1 + Math.floor(run.timelineMinutes / 5));
    else if (r < 0.7) this.powerup('health', b.x, b.z);
    else this.powerup((['damage', 'magnet', 'bomb', 'frenzy', 'shield'] as PowerupKind[])[Math.floor(Math.random() * 5)], b.x, b.z);
  }

  // ---------- per-frame ----------
  update(dt: number, run: Run) {
    const p = run.player;
    if (!p.alive) return;
    const R = run.stats.pickupRadius;
    const R2 = R * R;
    const vac = CONFIG.xp.gemMagnetSpeed;
    const collect = (o: Gem | Coin) => {
      o.t += dt;
      const dx = p.x - o.x, dz = p.z - o.z;
      const d2 = dx * dx + dz * dz;
      if (!o.magnet && d2 < R2) o.magnet = true;
      if (o.magnet) {
        o.speed = Math.min(vac + 10, o.speed + dt * 40);
        const d = Math.sqrt(d2) || 1;
        o.x += (dx / d) * o.speed * dt;
        o.z += (dz / d) * o.speed * dt;
        return d < 0.8;
      }
      return false;
    };
    for (const g of this.gems) {
      if (!g.active) continue;
      if (collect(g)) { g.active = false; run.gainXp(g.value); }
    }
    for (const c of this.coins) {
      if (!c.active) continue;
      if (collect(c)) { c.active = false; run.gainGold(c.value); }
    }
    for (const pu of this.powerups) {
      if (!pu.active) continue;
      pu.t += dt;
      pu.life -= dt;
      if (pu.life <= 0) { pu.active = false; pu.group.visible = false; continue; }
      if ((p.x - pu.x) ** 2 + (p.z - pu.z) ** 2 < 1.4 ** 2) {
        pu.active = false;
        pu.group.visible = false;
        run.applyPowerup(pu.kind, pu.x, pu.z);
      }
    }
    for (const b of this.barrels) {
      if (b.alive && (p.x - b.x) ** 2 + (p.z - b.z) ** 2 < 1.1 ** 2) this.breakBarrel(b, run);
    }
    for (const c of this.chests) {
      if (c.opened) {
        c.openT += dt;
        c.lid.rotation.x = -Math.min(1.9, c.openT * 8);
        if (c.openT > 6) c.group.visible = false;
      }
    }
  }

  /** Nearest interaction and its prompt text. */
  nearestInteractable(run: Run): { text: string; act: () => void } | null {
    const p = run.player;
    let best: { d: number; text: string; act: () => void } | null = null;
    const consider = (x: number, z: number, text: string, act: () => void) => {
      const d = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (d < 2.6 ** 2 && (!best || d < best.d)) best = { d, text, act };
    };
    for (const c of this.chests) {
      if (c.opened) continue;
      consider(c.x, c.z, c.golden ? 'Open Golden Chest' : `Open Chest (${c.cost} gold)`, () => run.openChest(c));
    }
    for (const s of this.shrines) {
      if (s.used) continue;
      consider(s.x, s.z, 'Blood Shrine: sacrifice 25% HP for +12% damage', () => {
        if (run.useShrine()) {
          s.used = true;
          (s.orb.material as THREE.MeshBasicMaterial).color.set('#555555');
        }
      });
    }
    return best;
  }

  clearDrops() {
    for (const g of this.gems) g.active = false;
    for (const c of this.coins) c.active = false;
    for (const pu of this.powerups) { pu.active = false; pu.group.visible = false; }
  }

  render(time: number) {
    const counts = [0, 0, 0, 0];
    for (const g of this.gems) {
      if (!g.active) continue;
      const tier = g.value < 5 ? 0 : g.value < 25 ? 1 : g.value < 120 ? 2 : 3;
      const mesh = this.gemMeshes[tier];
      const s = mesh.userData.size as number;
      _q.setFromEuler(_e.set(0, time * 2 + g.t, 0));
      _m.compose(_p.set(g.x, 0.45 + Math.sin(time * 3 + g.t) * 0.12, g.z), _q, _s.setScalar(s));
      mesh.setMatrixAt(counts[tier]++, _m);
    }
    this.gemMeshes.forEach((m, i) => { m.count = counts[i]; m.instanceMatrix.needsUpdate = true; });
    let cn = 0;
    for (const c of this.coins) {
      if (!c.active) continue;
      _q.setFromEuler(_e.set(0, time * 4 + c.t, 0));
      _m.compose(_p.set(c.x, 0.45 + Math.sin(time * 4 + c.t) * 0.1, c.z), _q, _s.setScalar(1));
      this.coinMesh.setMatrixAt(cn++, _m);
    }
    this.coinMesh.count = cn;
    this.coinMesh.instanceMatrix.needsUpdate = true;
    for (const pu of this.powerups) {
      if (!pu.active) continue;
      pu.group.position.set(pu.x, 0.7 + Math.sin(time * 3 + pu.x) * 0.15, pu.z);
      pu.group.rotation.y = time * 2;
      const ring = pu.group.getObjectByName('ring');
      if (ring) { ring.position.y = -0.6; ring.scale.setScalar(1 + Math.sin(time * 5) * 0.1); }
      pu.group.visible = pu.life > 5 || Math.floor(time * 6) % 2 === 0;
    }
    for (const s of this.shrines) if (!s.used) { s.orb.rotation.y = time * 2; s.orb.position.y = 3.3 + Math.sin(time * 2) * 0.2; }
    for (const c of this.chests) if (c.golden && !c.opened) c.group.rotation.y = time * 0.8;
    void this.scene;
  }
}
