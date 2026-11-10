// Human player controller: third-person camera, movement keys, shooting, building, editing, looting.
import * as THREE from 'three';
import { clamp, dirFromYawPitch, lerp } from './util.js';
import { MOVE, BW } from './config.js';
import { FULL_WALL, FULL_FLOOR } from './building.js';
import { raySphere } from './combat.js';

const _v = new THREE.Vector3();
const _d = new THREE.Vector3();
const _hit = {};
const PIECES = ['wall', 'floor', 'ramp', 'cone'];

export class PlayerController {
  constructor(game) {
    this.game = game;
    this.yaw = 0; this.pitch = -0.1;
    this.camPos = new THREE.Vector3();
    this.camDist = 3.6;
    this.kick = 0; this.kickYaw = 0;
    this.shakeAmt = 0;
    this.buildType = 'wall';
    this.editing = null;
    this.interact = null;
    this.chestHold = 0;
    this.lastPlacedKey = null;
    this.spectate = null;
    this.zoom = 1;
    this.aimPoint = new THREE.Vector3();
  }
  reset() {
    this.editing = null; this.interact = null; this.chestHold = 0; this.spectate = null;
    this.kick = 0; this.shakeAmt = 0;
    const a = this.game.player;
    if (a) a.buildMode = false;
  }
  recoil(k) { this.kick += k; this.kickYaw += (Math.random() - 0.5) * k * 0.6; }
  shake(a) { this.shakeAmt = Math.max(this.shakeAmt, a); }

  update(dt) {
    const g = this.game, inp = g.input, a = g.player, S = g.settings;
    if (!a) return;
    const sens = 0.0022 * S.sensitivity * (a.ads ? S.adsSens : 1) / this.zoom;
    if (inp.locked && !g.mapOpen) {
      this.yaw -= inp.mouse.dx * sens;
      this.pitch -= inp.mouse.dy * sens * (S.invertY ? -1 : 1);
    }
    // recoil recovery
    this.pitch += this.kick * 0.5; this.yaw += this.kickYaw * 0.5;
    this.kick *= 0.5; this.kickYaw *= 0.5;
    this.pitch = clamp(this.pitch, -1.45, 1.4);
    if (!a.alive) { this.updateSpectate(dt); return; }
    if (g.mapOpen || g.paused) { a.input.mx = a.input.mz = 0; a.input.fire = false; return; }
    const B = g.binds;
    const k = (id) => inp.actDown(B, id);
    const h = (id) => inp.actHit(B, id);
    // movement keys relative to camera yaw
    let f = 0, r = 0;
    if (k('forward')) f += 1;
    if (k('back')) f -= 1;
    if (k('right')) r += 1;
    if (k('left')) r -= 1;
    if (S.autoRun && this.autoRunOn) f = 1;
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    let mx = fx * f + rx * r, mz = fz * f + rz * r;
    const ml = Math.hypot(mx, mz);
    if (ml > 1) { mx /= ml; mz /= ml; }
    const I = a.input;
    I.mx = mx; I.mz = mz;
    I.sprint = S.toggleSprint ? !k('sprint') : k('sprint');
    I.jump = k('jump');
    I.crouch = k('crouch') || h('crouch');
    I.deploy = h('jump');
    I.dive = 0;
    if (a.mode === 'skydive' && f > 0 && this.pitch < -0.3) I.dive = clamp((-this.pitch - 0.3) * 1.6, 0, 1);
    if (a.mode === 'glide' && this.pitch < -0.6 && f > 0) I.dive = 0.6;
    a.yaw = this.yaw;
    a.pitch = this.pitch;
    if (a.mode === 'bus') {
      if (h('jump') && g.bus.doorsOpen) a.jumpFromBus();
      return;
    }
    // emote
    if (h('emote') && a.mode === 'ground') a.emote = !a.emote;
    if (ml > 0.1 || k('fire')) a.emote = false;
    // slot selection
    let sel = null;
    for (let i = 0; i < 5; i++) if (h('slot' + (i + 1))) sel = i;
    if (h('pickaxe')) sel = -1;
    if (inp.mouse.wheel && !this.editing) {
      const order = [-1, 0, 1, 2, 3, 4].filter((i) => i < 0 || a.slots[i]);
      let idx = order.indexOf(a.sel);
      idx = (idx + (inp.mouse.wheel > 0 ? 1 : -1) + order.length) % order.length;
      sel = order[idx];
    }
    if (sel !== null) {
      this.editing = null;
      if (a.buildMode) { a.buildMode = false; g.build.hidePreview(); }
      if (sel === -1 || a.slots[sel]) a.select(sel);
    }
    // building hotkeys
    const bk = { wall: 'wall', floor: 'floor', ramp: 'ramp', roof: 'cone' };
    for (const id in bk) if (h(id)) { this.editing = null; a.buildMode = true; this.buildType = bk[id]; this.lastPlacedKey = null; }
    if (h('buildMode')) { a.buildMode = !a.buildMode; this.editing = null; }
    if (a.buildMode && h('material')) {
      const order = ['wood', 'stone', 'metal'];
      a.buildMat = order[(order.indexOf(a.buildMat) + 1) % 3];
      g.audio.ui('click');
    }
    // drop held item
    if (h('drop')) {
      if (a.sel >= 0 && a.slots[a.sel]) {
        const it = a.dropSlot(a.sel);
        if (it) { g.loot.dropItem(a, it); g.audio.ui('click'); }
      } else g.hud.notify('Nothing to drop', 'Select an item in slots 1–5 first — the harvesting tool can\'t be dropped', 'small');
    }
    // edit
    if (h('edit')) this.toggleEdit();
    // aim ray from camera
    this.computeAim();
    if (this.editing) this.updateEdit(dt);
    else if (a.buildMode && a.mode === 'ground') this.updateBuild(dt);
    else g.build.hidePreview();
    if (!this.editing) g.build.showEditTiles(null, 0);
    // weapon input
    const busy = a.buildMode || this.editing;
    I.fire = !busy && k('fire') && inp.locked;
    I.ads = !busy && k('aim') && a.mode === 'ground';
    I.reload = !a.buildMode && h('reload');
    // interaction
    this.updateInteract(dt);
    // auto-pickup ammo / materials / healing
    if (S.autoPickup && a.mode === 'ground') this.autoPickup();
    // zoom (ADS)
    const it = a.held;
    const z = a.ads && it && it.kind === 'weapon' ? it.def.zoom : 1;
    this.zoom = lerp(this.zoom, z, Math.min(1, dt * 14));
  }

  computeAim() {
    const g = this.game, a = g.player, cam = g.camera;
    cam.getWorldDirection(_d);
    // start the ray at the player's depth so we don't hit things between the camera and the player
    const toP = _v.set(a.pos.x - cam.position.x, a.eyeY - cam.position.y, a.pos.z - cam.position.z);
    const start = Math.max(0, toP.dot(_d));
    const ox = cam.position.x + _d.x * start, oy = cam.position.y + _d.y * start, oz = cam.position.z + _d.z * start;
    const maxT = 500;
    const wh = g.phys.raycast(ox, oy, oz, _d.x, _d.y, _d.z, maxT, null, _hit);
    let t = wh ? wh.t : maxT;
    const ah = g.combat.rayActors(ox, oy, oz, _d.x, _d.y, _d.z, t, a);
    if (ah) t = ah.t;
    this.aimHit = wh && (!ah) ? { c: wh.c, t: t + start, x: wh.x, y: wh.y, z: wh.z } : null;
    this.aimActor = ah ? ah.actor : null;
    this.aimPoint.set(ox + _d.x * t, oy + _d.y * t, oz + _d.z * t);
    const m = g.combat.muzzle(a);
    a.aimDir.subVectors(this.aimPoint, m);
    if (a.aimDir.lengthSq() < 0.5) a.aimDir.copy(_d);
    a.aimDir.normalize();
  }

  updateBuild(dt) {
    const g = this.game, a = g.player, inp = g.input;
    const spec = g.build.computeTarget(a, this.buildType, this.yaw, this.pitch);
    const ok = g.build.canPlace(a, spec);
    g.build.showPreview(spec, ok);
    // click to place; hold to keep placing as the target changes ("drag building")
    const B = g.binds, fireDown = inp.actDown(B, 'fire');
    if (inp.locked && (inp.actHit(B, 'fire') || (fireDown && spec.key !== this.lastPlacedKey))) {
      if (ok && a.buildCd <= 0) {
        if (g.build.place(a, spec)) { this.lastPlacedKey = spec.key; a.buildCd = 0.08; }
      }
    }
    if (!fireDown) this.lastPlacedKey = null;
    // RMB in build mode: rotate ramp direction preview is automatic (camera); repair with E handled in interact
  }

  toggleEdit() {
    const g = this.game, a = g.player;
    if (this.editing) { this.confirmEdit(); return; }
    // cast from the camera itself so walls right next to the player are found too
    const cam = g.camera;
    cam.getWorldDirection(_d);
    const hit = g.phys.raycast(cam.position.x, cam.position.y, cam.position.z, _d.x, _d.y, _d.z, 12, null, _hit);
    if (!hit || !hit.c) return;
    if (Math.hypot(hit.x - a.pos.x, hit.y - a.eyeY, hit.z - a.pos.z) > 6) return;
    const p = g.build.pieceFromCollider(hit.c);
    if (!p || p.owner !== a || (p.type !== 'wall' && p.type !== 'floor')) return;
    const full = p.type === 'wall' ? FULL_WALL : FULL_FLOOR;
    this.editing = { piece: p, sel: full & ~p.mask, full, painting: null };
    a.buildMode = false;
    g.build.hidePreview();
  }
  confirmEdit() {
    const g = this.game, e = this.editing;
    if (!e) return;
    if (e.piece.alive) g.build.setEdit(g.player, e.piece, e.full & ~e.sel);
    this.editing = null;
    g.build.showEditTiles(null, 0);
  }
  updateEdit(dt) {
    const g = this.game, e = this.editing, inp = g.input;
    if (!e.piece.alive) { this.editing = null; return; }
    const B = g.binds, fireDown = inp.actDown(B, 'fire');
    if (inp.actHit(B, 'aim')) { e.sel = 0; this.confirmEdit(); return; }
    const tiles = g.build.tileBoxes(e.piece);
    // which tile is under the crosshair?
    const cam = g.camera;
    cam.getWorldDirection(_d);
    let best = -1, bestT = 1e9;
    tiles.forEach((b, i) => {
      const t = raySphere(cam.position.x, cam.position.y, cam.position.z, _d.x, _d.y, _d.z, b.x, b.y, b.z, Math.max(b.sx, b.sy, b.sz) * 0.62);
      if (t >= 0 && t < bestT) { bestT = t; best = i; }
    });
    if (fireDown && best >= 0) {
      if (e.painting === null) e.painting = !(e.sel & (1 << best));
      if (e.painting) e.sel |= 1 << best; else e.sel &= ~(1 << best);
    }
    if (!fireDown && e.painting !== null) {
      e.painting = null;
      if (g.settings.editOnRelease) this.confirmEdit();
    }
    if (this.editing) g.build.showEditTiles(e.piece, e.sel);
  }

  updateInteract(dt) {
    const g = this.game, a = g.player, inp = g.input;
    this.interact = null;
    if (a.mode !== 'ground') { this.chestHold = 0; return; }
    // candidates: pickups, chests, supply drops in reach, prefer the one nearest the crosshair
    const near = g.loot.nearby(a.pos.x, a.pos.z, 3, []);
    const cam = g.camera;
    cam.getWorldDirection(_d);
    let best = null, bestS = 1e9;
    const consider = (kind, obj, x, y, z) => {
      const dx = x - a.pos.x, dy = y - a.pos.y, dz = z - a.pos.z;
      const d = Math.hypot(dx, dy * 0.5, dz);
      if (d > 2.8 || Math.abs(dy) > 2.2) return;
      // angle to crosshair
      _v.set(x - cam.position.x, y + 0.2 - cam.position.y, z - cam.position.z).normalize();
      const s = (1 - _v.dot(_d)) * 10 + d * 0.3;
      if (s < bestS) { bestS = s; best = { kind, obj }; }
    };
    for (const p of near) consider('pickup', p, p.x, p.y, p.z);
    for (const c of g.loot.chestsNear(a.pos.x, a.pos.z, 3, [])) if (!c.opened) consider('chest', c, c.x, c.y + 0.4, c.z);
    for (const d of g.loot.drops) if (d.landed && !d.opened) consider('drop', d, d.x, d.groundY - 0.4, d.z);
    // repair own damaged build piece
    if (!best && this.aimHit && this.aimHit.c && this.aimHit.t < 5) {
      const p = g.build.pieceFromCollider(this.aimHit.c);
      if (p && p.owner === a && !p.building && p.hp < p.maxHp) best = { kind: 'repair', obj: p };
    }
    this.interact = best;
    if (!best) { this.chestHold = 0; return; }
    if (best.kind === 'pickup' && inp.actHit(g.binds, 'interact')) {
      g.loot.take(a, best.obj, a.sel);
      if (a.sel === -1 && best.obj.kind === 'item') { const i = a.slots.indexOf(best.obj.data); if (i >= 0 && !g.settings.keepSlot) a.select(i); }
    }
    if (best.kind === 'chest' || best.kind === 'drop') {
      if (inp.actDown(g.binds, 'interact')) {
        this.chestHold += dt;
        const need = best.kind === 'chest' ? 0.4 : 0.8;
        if (this.chestHold >= need) {
          if (best.kind === 'chest') g.loot.openChest(a, best.obj); else g.loot.openDrop(a, best.obj);
          this.chestHold = 0;
        }
      } else this.chestHold = 0;
    }
    if (best.kind === 'repair' && inp.actDown(g.binds, 'interact')) g.build.repair(a, best.obj, dt);
  }

  autoPickup() {
    const g = this.game, a = g.player;
    const near = g.loot.nearby(a.pos.x, a.pos.z, 1.4, []);
    // items you dropped become auto-pickable again once you've moved away from them
    for (const p of g.loot.nearby(a.pos.x, a.pos.z, 6, this._dropNear || (this._dropNear = []))) {
      if (p.droppedBy === a && Math.hypot(p.x - a.pos.x, p.z - a.pos.z) > 3) p.droppedBy = null;
    }
    for (const p of near) {
      if (Math.abs(p.y - a.pos.y) > 1.5) continue;
      if (p.droppedBy === a) continue;
      if (p.kind === 'ammo' || p.kind === 'mats') g.loot.take(a, p);
      else if (p.kind === 'item' && p.data.kind === 'consumable' && (a.freeSlot() >= 0 || a.slots.some((s) => s && s.kind === 'consumable' && s.type === p.data.type && s.count < s.def.stack))) g.loot.take(a, p);
      else if (p.kind === 'item' && p.data.kind === 'weapon' && a.freeSlot() >= 0 && !a.slots.some((s) => s && s.kind === 'weapon' && s.type === p.data.type)) g.loot.take(a, p);
    }
  }

  updateSpectate(dt) {
    const g = this.game;
    if (this.spectate && !this.spectate.alive) {
      const k = this.spectate.lastKiller;
      this.spectate = k && k.alive ? k : null;
    }
    if (!this.spectate) {
      // nearest surviving player
      const me = g.player;
      let best = null, bd = 1e9;
      for (const x of g.actors) {
        if (!x.alive || x === me) continue;
        const d = x.pos.distanceTo(me.pos);
        if (d < bd) { bd = d; best = x; }
      }
      this.spectate = best;
    }
  }

  // ---------- camera ----------
  updateCamera(dt) {
    const g = this.game, a = g.player, cam = g.camera, S = g.settings;
    let target = a;
    if (!a.alive && this.spectate) target = this.spectate;
    // slight FOV kick while sprinting / sliding / diving
    const kickT = target === a && (a.sprinting || a.sliding || (a.mode === 'skydive' && a.input.dive > 0.5)) ? 6 : 0;
    this.fovKick = (this.fovKick || 0) + (kickT - (this.fovKick || 0)) * Math.min(1, dt * 6);
    const fov = S.fov / this.zoom + this.fovKick;
    if (Math.abs(cam.fov - fov) > 0.05) { cam.fov = fov; cam.updateProjectionMatrix(); }
    cam.rotation.order = 'YXZ';
    if (target.mode === 'bus' || (!a.alive && target === a)) {
      const b = g.bus.pos;
      const d = 42;
      const cp = Math.cos(this.pitch);
      cam.position.set(b.x + Math.sin(this.yaw) * d * cp, b.y + 6 - Math.sin(this.pitch) * d, b.z + Math.cos(this.yaw) * d * cp);
      cam.rotation.set(this.pitch, this.yaw, 0);
      if (!a.alive && target === a) { cam.position.set(a.pos.x + Math.sin(this.yaw) * 8, a.pos.y + 4, a.pos.z + Math.cos(this.yaw) * 8); cam.lookAt(a.pos.x, a.pos.y + 1, a.pos.z); }
      return;
    }
    let yaw = this.yaw, pitch = this.pitch;
    if (target !== a) { yaw = target.yaw; pitch = -0.25; }
    const air = target.mode === 'skydive' || target.mode === 'glide';
    let dist = air ? 7.5 : (target.ads ? 1.9 : 3.4);
    if (target.mode === 'ground' && target.held && target.held.def && target.held.def.scope && target.ads) dist = 0.6;
    const side = air ? 0 : (target.ads ? 0.55 : 0.75);
    const up = air ? 1.5 : 0.35;
    const pivot = _v.set(target.pos.x, target.pos.y + (target.crouching || target.sliding ? 1.25 : 1.65), target.pos.z);
    const dir = dirFromYawPitch(yaw, pitch, _d);
    const rx = Math.cos(yaw), rz = -Math.sin(yaw);
    let cx = pivot.x - dir.x * dist + rx * side;
    let cy = pivot.y - dir.y * dist + up;
    let cz = pivot.z - dir.z * dist + rz * side;
    // camera collision
    const ox = pivot.x + rx * side * 0.5, oy = pivot.y + up * 0.5, oz = pivot.z + rz * side * 0.5;
    const vx = cx - ox, vy = cy - oy, vz = cz - oz;
    const vl = Math.hypot(vx, vy, vz);
    if (vl > 0.01) {
      const h = g.phys.raycast(ox, oy, oz, vx / vl, vy / vl, vz / vl, vl + 0.3, null, _hit);
      if (h && h.c && !(h.c.obj && h.c.obj.isBuild === undefined && h.c.obj.kind === 'tree')) {
        const t = Math.max(0.25, h.t - 0.3);
        cx = ox + vx / vl * t; cy = oy + vy / vl * t; cz = oz + vz / vl * t;
      } else if (h && h.terrain) {
        const t = Math.max(0.25, h.t - 0.3);
        cx = ox + vx / vl * t; cy = oy + vy / vl * t; cz = oz + vz / vl * t;
      }
    }
    const th = g.terrain.heightAt(cx, cz);
    if (cy < th + 0.3 && !g.phys.ignoresTerrain(cx, cy, cz)) cy = th + 0.3;
    if (th < 0.4 && !g.phys.ignoresTerrain(cx, cy, cz)) cy = Math.max(cy, 0.45);
    cam.position.set(cx, cy, cz);
    cam.rotation.set(pitch, yaw, 0);
    if (this.shakeAmt > 0.001) {
      cam.rotation.x += (Math.random() - 0.5) * this.shakeAmt * 0.05;
      cam.rotation.y += (Math.random() - 0.5) * this.shakeAmt * 0.05;
      this.shakeAmt *= Math.max(0, 1 - dt * 5);
    }
  }
}
