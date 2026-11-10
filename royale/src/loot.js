// Chests, floor loot, ammo boxes, supply drops and dropped items — with pooled visuals near the camera.
import * as THREE from 'three';
import { RARITY } from './config.js';
import { rollWeapon, rollConsumable, rollMythic, ammoFor, ammoDrop, randomAmmoType, AMMO, makeConsumable, CONSUMABLES, WEAPONS } from './items.js';
import { rand, chance, pick } from './util.js';

const _m = new THREE.Matrix4();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

let PICK_ID = 1;
export class Pickup {
  constructor(kind, data, x, y, z) {
    this.id = PICK_ID++;
    this.kind = kind;      // item | ammo | mats
    this.data = data;      // item object | {type, n} | {mat, n}
    this.x = x; this.y = y; this.z = z;
    this.alive = true;
    this.mesh = null;
    this.spawnT = 0;
    this.vy = 0;
  }
  get rarity() { return this.kind === 'item' ? this.data.rarity : 0; }
  label() {
    if (this.kind === 'item') {
      const it = this.data;
      return `${it.name}${it.kind === 'consumable' && it.count > 1 ? ' x' + it.count : ''}`;
    }
    if (this.kind === 'ammo') return `${AMMO[this.data.type].name} x${this.data.n}`;
    return `${this.data.mat[0].toUpperCase() + this.data.mat.slice(1)} x${this.data.n}`;
  }
}

export class LootSystem {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.pickups = [];
    this.chests = [];
    this.drops = [];
    this.grid = new Map();
    // chest instanced meshes
    const box = new THREE.BoxGeometry(1, 1, 1);
    const lam = new THREE.MeshLambertMaterial({ color: 0xffffff });
    this.chestBody = new THREE.InstancedMesh(box, lam, 700);
    this.chestLid = new THREE.InstancedMesh(box, lam, 700);
    for (const m of [this.chestBody, this.chestLid]) { m.castShadow = true; m.frustumCulled = false; m.count = 0; m.setColorAt(0, new THREE.Color()); this.scene.add(m); }
    // glow sprites for chests near the camera
    // pickup visual pool
    this.pool = [];
    this.geos = {
      gun: new THREE.BoxGeometry(0.16, 0.22, 1),
      item: new THREE.BoxGeometry(0.4, 0.5, 0.4),
      ammo: new THREE.BoxGeometry(0.45, 0.3, 0.3),
      mats: new THREE.BoxGeometry(0.6, 0.35, 0.6),
    };
    const beamGeo = new THREE.CylinderGeometry(0.06, 0.25, 3, 6, 1, true);
    beamGeo.translate(0, 1.5, 0);
    for (let i = 0; i < 110; i++) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(this.geos.gun, new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x222222 }));
      const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide }));
      g.add(body); g.add(beam);
      g.visible = false;
      g.userData = { body, beam, used: null };
      this.scene.add(g);
      this.pool.push(g);
    }
    this.assignT = 0;
    // supply drop meshes
    this.dropMeshes = [];
  }

  reset() {
    for (const p of this.pickups) if (p.mesh) this.releaseMesh(p);
    this.pickups = [];
    this.grid.clear();
    this.chests = [];
    for (const d of this.drops) { this.scene.remove(d.group); }
    this.drops = [];
  }

  // ----- per-match spawn -----
  spawnAll(world, practice) {
    this.reset();
    for (const s of world.chestSpots) {
      const p = s.mythic ? 1 : s.rare ? 0.9 : 0.72;
      if (!chance(p)) continue;
      this.chests.push({ x: s.x, y: s.y, z: s.z, rare: !!s.rare, mythic: !!s.mythic, opened: false, poi: s.poi, via: s.via, idx: this.chests.length, yaw: Math.floor(Math.random() * 4) * Math.PI / 2 });
    }
    for (const s of world.floorSpots) {
      if (!chance(0.55)) continue;
      this.spawnFloorLoot(s.x, s.y, s.z, s.via);
    }
    for (const s of world.ammoSpots) {
      if (!chance(0.8)) continue;
      const t = randomAmmoType();
      this.addPickup('ammo', { type: t, n: ammoDrop(t, 1.5) }, s.x, s.y + 0.2, s.z);
    }
    this.chestGrid = new Map();
    for (const c of this.chests) {
      const k = gk(c.x, c.z);
      let a = this.chestGrid.get(k); if (!a) this.chestGrid.set(k, a = []);
      a.push(c);
    }
    this.rebuildChestMeshes();
  }

  rebuildChestMeshes() {
    const col = new THREE.Color();
    let i = 0;
    for (const c of this.chests) {
      const base = c.mythic ? 0x7a5cff : c.rare ? 0xd8a020 : 0x9a6a2e;
      const trim = c.mythic ? 0xffe14a : 0xf2d16b;
      _m.makeRotationY(c.yaw);
      _m.scale(new THREE.Vector3(1.1, 0.55, 0.65));
      _m.setPosition(c.x, c.y + 0.28, c.z);
      if (c.opened) _m.copy(ZERO);
      this.chestBody.setMatrixAt(i, _m);
      this.chestBody.setColorAt(i, col.set(base));
      _m.makeRotationY(c.yaw);
      _m.scale(new THREE.Vector3(1.14, 0.18, 0.69));
      _m.setPosition(c.x, c.y + 0.64, c.z);
      if (c.opened) _m.copy(ZERO);
      this.chestLid.setMatrixAt(i, _m);
      this.chestLid.setColorAt(i, col.set(trim));
      i++;
    }
    this.chestBody.count = this.chestLid.count = i;
    for (const m of [this.chestBody, this.chestLid]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
  }

  spawnFloorLoot(x, y, z, via) {
    if (chance(0.62)) {
      const w = rollWeapon('floor');
      this.addPickup('item', w, x, y + 0.25, z).via = via;
      const at = ammoFor(w.type);
      this.addPickup('ammo', { type: at, n: ammoDrop(at, 1.2) }, x + 0.7, y + 0.2, z + 0.3).via = via;
    } else {
      this.addPickup('item', rollConsumable(), x, y + 0.25, z).via = via;
    }
  }

  addPickup(kind, data, x, y, z, vy = 0) {
    const p = new Pickup(kind, data, x, y, z);
    p.vy = vy;
    p.groundY = y;
    this.pickups.push(p);
    this._gridAdd(p);
    return p;
  }
  _gridAdd(p) {
    const k = gk(p.x, p.z);
    p.gk = k;
    let a = this.grid.get(k); if (!a) this.grid.set(k, a = []);
    a.push(p);
  }
  _gridRemove(p) {
    const a = this.grid.get(p.gk);
    if (a) { const i = a.indexOf(p); if (i >= 0) a.splice(i, 1); }
  }

  // Spill out items from an opened chest / eliminated actor
  spill(x, y, z, entries, via) {
    const n = entries.length;
    entries.forEach((e, i) => {
      const a = (i / Math.max(1, n)) * Math.PI * 2 + rand(-0.3, 0.3);
      const r = rand(0.8, 1.7);
      const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      const gy = this.game.phys.groundAt(px, pz, y + 1.2, 0.1);
      this.addPickup(e.kind, e.data, px, Math.max(gy, y - 0.5) + 0.25, pz).via = via;
    });
  }

  openChest(actor, c) {
    if (c.opened) return;
    c.opened = true;
    actor.chestsOpened++;
    const entries = [];
    let w;
    if (c.mythic) w = rollMythic();
    else w = rollWeapon(c.rare ? 'rare' : 'chest');
    entries.push({ kind: 'item', data: w });
    const at = ammoFor(w.type);
    entries.push({ kind: 'ammo', data: { type: at, n: ammoDrop(at, 2) } });
    entries.push({ kind: 'item', data: rollConsumable(c.rare ? 0.5 : 0) });
    if (c.rare || chance(0.35)) {
      const w2 = rollWeapon(c.rare ? 'rare' : 'chest');
      entries.push({ kind: 'item', data: w2 });
    }
    entries.push({ kind: 'mats', data: { mat: 'wood', n: 30 } });
    if (chance(0.5)) { const t = randomAmmoType(); entries.push({ kind: 'ammo', data: { type: t, n: ammoDrop(t, 1.5) } }); }
    this.spill(c.x, c.y, c.z, entries, c.via);
    this.rebuildChestMeshes();
    this.game.audio.playAt('chestOpen', c, 0.8);
    this.game.soundEvent(actor, c, 25, 'chest');
    this.game.onChestOpened(actor, c);
  }

  // Everything an eliminated actor carried
  dropInventory(a) {
    const entries = [];
    for (let i = 0; i < 5; i++) {
      const it = a.slots[i];
      if (it) entries.push({ kind: 'item', data: it });
      a.slots[i] = null;
    }
    for (const t in a.ammo) if (a.ammo[t] > 0) entries.push({ kind: 'ammo', data: { type: t, n: a.ammo[t] } });
    for (const m in a.mats) if (a.mats[m] > 0) entries.push({ kind: 'mats', data: { mat: m, n: Math.min(a.mats[m], 999) } });
    if (entries.length) this.spill(a.pos.x, a.pos.y + 0.3, a.pos.z, entries);
  }

  dropItem(actor, item) {
    const fx = -Math.sin(actor.yaw), fz = -Math.cos(actor.yaw);
    const x = actor.pos.x + fx * 1.2, z = actor.pos.z + fz * 1.2;
    const gy = this.game.phys.groundAt(x, z, actor.pos.y + 1, 0.1);
    this.addPickup('item', item, x, Math.max(gy, actor.pos.y - 1) + 0.25, z);
  }

  // Apply a pickup to an actor. Returns true if consumed.
  take(actor, p, swapSlot = -1) {
    if (!p.alive) return false;
    if (p.kind === 'ammo') { actor.addAmmo(p.data.type, p.data.n); this._consume(p); this.game.audio.playAt('pickup', p, 0.35); return true; }
    if (p.kind === 'mats') {
      const got = actor.addMats(p.data.mat, p.data.n);
      p.data.n -= got;
      if (p.data.n <= 0) this._consume(p);
      this.game.audio.playAt('pickup', p, 0.35);
      return got > 0;
    }
    const it = p.data;
    if (actor.giveItem(it)) {
      this._consume(p);
      this.game.audio.playAt('pickup', p, 0.45);
      this.game.onPickup(actor, it);
      return true;
    }
    // inventory full: swap with the given/current slot
    let s = swapSlot >= 0 ? swapSlot : actor.sel;
    if (s < 0) return false;
    const old = actor.dropSlot(s);
    actor.slots[s] = it;
    actor.select(-2); actor.sel = -1; actor.select(s);
    this._consume(p);
    if (old) this.addPickup('item', old, p.x, p.y, p.z);
    this.game.audio.playAt('pickup', p, 0.45);
    this.game.onPickup(actor, it);
    return true;
  }
  _consume(p) {
    p.alive = false;
    this._gridRemove(p);
    if (p.mesh) this.releaseMesh(p);
    const i = this.pickups.indexOf(p);
    if (i >= 0) { this.pickups[i] = this.pickups[this.pickups.length - 1]; this.pickups.pop(); }
  }

  // ----- queries -----
  nearby(x, z, r, out = []) {
    out.length = 0;
    const r2 = r * r;
    const x0 = Math.floor((x - r) / 16), x1 = Math.floor((x + r) / 16), z0 = Math.floor((z - r) / 16), z1 = Math.floor((z + r) / 16);
    for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) {
      const a = this.grid.get(i * 1000 + j);
      if (!a) continue;
      for (const p of a) {
        const dx = p.x - x, dz = p.z - z;
        if (dx * dx + dz * dz <= r2) out.push(p);
      }
    }
    return out;
  }
  chestsNear(x, z, r, out = []) {
    out.length = 0;
    const r2 = r * r;
    const x0 = Math.floor((x - r) / 16), x1 = Math.floor((x + r) / 16), z0 = Math.floor((z - r) / 16), z1 = Math.floor((z + r) / 16);
    for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) {
      const a = this.chestGrid.get(i * 1000 + j);
      if (!a) continue;
      for (const c of a) {
        const dx = c.x - x, dz = c.z - z;
        if (dx * dx + dz * dz <= r2) out.push(c);
      }
    }
    return out;
  }

  // ----- supply drops -----
  spawnSupplyDrop(x, z) {
    const g = this.game;
    const group = new THREE.Group();
    const crate = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 1.6), new THREE.MeshLambertMaterial({ color: 0x2a6fd6, emissive: 0x0a1f40 }));
    crate.castShadow = true;
    const band = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.3, 1.7), new THREE.MeshLambertMaterial({ color: 0xffd23f }));
    const balloon = new THREE.Mesh(new THREE.SphereGeometry(1.8, 12, 10), new THREE.MeshLambertMaterial({ color: 0xff4f6d }));
    balloon.position.y = 5;
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 3.5), new THREE.MeshBasicMaterial({ color: 0x333333 }));
    rope.position.y = 2.4;
    group.add(crate, band, balloon, rope);
    const gy = g.phys.groundAt(x, z, 400, 0.5);
    group.position.set(x, 220, z);
    g.scene.add(group);
    const d = { x, z, y: 220, groundY: Math.max(gy, 0.6) + 0.8, group, balloon, landed: false, opened: false };
    this.drops.push(d);
    g.onSupplyDrop(d);
    return d;
  }
  openDrop(actor, d) {
    if (d.opened || !d.landed) return;
    d.opened = true;
    this.game.scene.remove(d.group);
    const entries = [];
    entries.push({ kind: 'item', data: chance(0.15) ? rollMythic() : rollWeapon('drop') });
    const w2 = rollWeapon('drop');
    entries.push({ kind: 'item', data: w2 });
    entries.push({ kind: 'ammo', data: { type: ammoFor(w2.type), n: ammoDrop(ammoFor(w2.type), 3) } });
    entries.push({ kind: 'item', data: makeConsumable(pick(['bigshield', 'medkit', 'fizz', 'elixir']), 2) });
    entries.push({ kind: 'mats', data: { mat: 'metal', n: 100 } });
    entries.push({ kind: 'mats', data: { mat: 'stone', n: 100 } });
    this.spill(d.x, d.groundY - 0.8, d.z, entries);
    this.game.audio.playAt('chestOpen', { x: d.x, y: d.groundY, z: d.z }, 0.9);
    actor.chestsOpened++;
    this.game.onChestOpened(actor, d);
  }

  // ----- per-frame -----
  releaseMesh(p) {
    const m = p.mesh;
    m.visible = false;
    m.userData.used = null;
    this.pool.push(m);
    p.mesh = null;
  }
  update(dt, cam) {
    const g = this.game;
    // falling items settle
    for (const p of this.pickups) {
      if (p.vy !== 0) {
        p.vy -= 20 * dt; p.y += p.vy * dt;
        if (p.y <= p.groundY) { p.y = p.groundY; p.vy = 0; }
      }
    }
    // supply drops descend
    for (const d of this.drops) {
      if (d.opened) continue;
      if (!d.landed) {
        d.y -= 7 * dt;
        if (d.y <= d.groundY) { d.y = d.groundY; d.landed = true; d.balloon.visible = false; g.audio.playAt('land', d, 0.8); }
        d.group.position.y = d.y;
        d.group.rotation.y += dt * 0.4;
      }
    }
    // assign pooled meshes to the nearest pickups
    this.assignT -= dt;
    if (this.assignT <= 0) {
      this.assignT = 0.25;
      const near = this.nearby(cam.x, cam.z, 70, this._near || (this._near = []));
      near.sort((a, b) => ((a.x - cam.x) ** 2 + (a.z - cam.z) ** 2) - ((b.x - cam.x) ** 2 + (b.z - cam.z) ** 2));
      const keep = new Set(near.slice(0, this.pool.length + 60));
      for (const p of this.pickups) if (p.mesh && !keep.has(p)) this.releaseMesh(p);
      for (const p of keep) {
        if (p.mesh) continue;
        const m = this.pool.pop();
        if (!m) break;
        p.mesh = m;
        m.userData.used = p;
        const body = m.userData.body, beam = m.userData.beam;
        let color, geo;
        if (p.kind === 'item') {
          geo = p.data.kind === 'weapon' ? this.geos.gun : this.geos.item;
          color = p.data.kind === 'weapon' ? p.data.def.color : p.data.def.color;
          beam.material.color.set(RARITY[p.data.rarity].hex);
          beam.visible = true;
          body.scale.set(1, 1, p.data.kind === 'weapon' ? p.data.def.len : 1);
        } else if (p.kind === 'ammo') {
          geo = this.geos.ammo; color = AMMO[p.data.type].color; beam.visible = false; body.scale.set(1, 1, 1);
        } else {
          geo = this.geos.mats; color = p.data.mat === 'wood' ? 0xb07a45 : p.data.mat === 'stone' ? 0x9a9a9a : 0x8794a0; beam.visible = false; body.scale.set(1, 1, 1);
        }
        body.geometry = geo;
        body.material.color.set(color);
        body.material.emissive.set(p.kind === 'item' ? RARITY[p.data.rarity].hex : 0x000000).multiplyScalar(0.25);
        m.visible = true;
      }
    }
    const t = g.time;
    for (const m of this.pool) m.visible = false;
    for (const p of this.pickups) {
      if (!p.mesh) continue;
      const m = p.mesh;
      m.visible = true;
      m.position.set(p.x, p.y + 0.15 + Math.sin(t * 2 + p.id) * 0.06, p.z);
      m.userData.body.rotation.y = t * 1.2 + p.id;
    }
  }
}

function gk(x, z) { return Math.floor(x / 16) * 1000 + Math.floor(z / 16); }
export { WEAPONS, CONSUMABLES };
