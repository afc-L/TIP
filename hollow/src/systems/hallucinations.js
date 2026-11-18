// The psychological horror director. It only ever touches what the player SEES and
// HEARS: figures, shadows, sounds, distortions. It never moves the monster, never turns
// the camera and never blocks input. NPCs cannot hear or see hallucinations — watching
// how real people react is the only (unreliable) way to tell what is real.
import * as THREE from 'three';
import { buildPresence, setPresenceAlpha } from '../actors/presence.js';
import { buildHumanoid } from '../actors/humanoid.js';
import { silhouetteTexture, faceTexture } from '../core/textures.js';
import { windUniforms } from '../maps/builder.js';
import { rand, pick, chance, clamp, weighted, angleDiff, randInt } from '../core/util.js';

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _ndc = new THREE.Vector3();

// Event catalogue: weight per map kind, minimum intensity, cooldown (s), "major" events trigger quiet periods.
const EVENTS = {
  presenceAhead: { w: 3, min: 0.0, cd: 40, major: true },
  presenceWindow: { w: 2.5, min: 0.0, cd: 35, major: true, needs: 'window' },
  presenceTrees: { w: 0, min: 0.0, cd: 35, major: true },
  presenceBehind: { w: 1.5, min: 0.25, cd: 60, major: true },
  presenceImpossible: { w: 1.2, min: 0.2, cd: 60, major: true },
  presenceFlash: { w: 1.5, min: 0.15, cd: 30, major: false },
  presenceMirror: { w: 6, min: 0.0, cd: 25, major: true, needs: 'mirror' },
  presenceApproach: { w: 0.8, min: 0.45, cd: 90, major: true },
  fakeNPC: { w: 2.5, min: 0.0, cd: 30 },
  shadow: { w: 2.5, min: 0.0, cd: 20 },
  objectAppear: { w: 1.5, min: 0.1, cd: 45 },
  abandoned: { w: 1.2, min: 0.2, cd: 70, major: true },
  stretch: { w: 1.5, min: 0.15, cd: 40 },
  treesMove: { w: 0, min: 0.0, cd: 40 },
  runner: { w: 1.2, min: 0.2, cd: 50 },
  anomaly: { w: 2, min: 0.0, cd: 30, needs: 'anomaly' },
  lightsOut: { w: 1.5, min: 0.1, cd: 50 },
  faceFlash: { w: 1.5, min: 0.2, cd: 35, needs: 'window' },
  npcStare: { w: 1.5, min: 0.15, cd: 40 },
  npcHollow: { w: 1, min: 0.3, cd: 60 },
  glitch: { w: 1, min: 0.3, cd: 25 },
  // audio
  fakeSteps: { w: 3, min: 0.0, cd: 20 },
  whisperBehind: { w: 2.5, min: 0.0, cd: 25 },
  nameWhisper: { w: 1.2, min: 0.25, cd: 90 },
  distantConvo: { w: 2, min: 0.0, cd: 30 },
  distantScream: { w: 1.5, min: 0.0, cd: 45 },
  wallVoices: { w: 1.5, min: 0.2, cd: 40 },
  scratching: { w: 1.5, min: 0.1, cd: 30 },
  doorSound: { w: 2, min: 0.0, cd: 25, needs: 'door' },
  breathing: { w: 1.5, min: 0.2, cd: 40 },
  knock: { w: 1.5, min: 0.0, cd: 30, needs: 'door' },
  phone: { w: 1, min: 0.1, cd: 70 },
  cryingStops: { w: 1.2, min: 0.1, cd: 60 },
  laugh: { w: 1.2, min: 0.15, cd: 45 },
  musicBox: { w: 0.8, min: 0.25, cd: 80 },
  clang: { w: 0, min: 0, cd: 25 },
  announce: { w: 0, min: 0, cd: 60 },
};

const KIND_WEIGHTS = {
  suburb: { presenceWindow: 4, fakeNPC: 3, laugh: 1.8, phone: 1.6, doorSound: 2.5, knock: 2 },
  forest: { presenceTrees: 5, presenceWindow: 0.5, treesMove: 3, runner: 2.5, fakeSteps: 4.5, distantScream: 2.2, doorSound: 0.3, knock: 0.2, wallVoices: 0.2, phone: 0.2, presenceAhead: 1.5 },
  city: { fakeNPC: 4, distantConvo: 3, abandoned: 2, presenceWindow: 3, npcStare: 3, npcHollow: 2, presenceImpossible: 2, runner: 1.5 },
  hospital: { presenceAhead: 6, stretch: 3.5, clang: 3, announce: 2, wallVoices: 2.5, scratching: 2.5, doorSound: 3.5, lightsOut: 3, cryingStops: 2, musicBox: 1.5, fakeSteps: 4 },
  other: { presenceAhead: 6, presenceImpossible: 5, presenceFlash: 4, presenceApproach: 3, presenceBehind: 3, stretch: 3, glitch: 2.5, whisperBehind: 4, nameWhisper: 2.5, runner: 2, fakeNPC: 2.5 },
};

export class Hallucinations {
  constructor(game) {
    this.game = game; this.active = []; this.cd = {}; this.pool = { presence: [], npc: [] };
    this.intensity = 0.1; this.base = 0.1; this.nextT = 20; this.quietT = 0; this.timeInMap = 0; this.extra = 0;
    this.reflectOnly = new THREE.Group(); this.reflectOnly.visible = false;
    this.enabled = true; this.log = [];
  }
  reset(base) {
    for (const a of this.active) a.end && a.end();
    this.active = []; this.cd = {}; this.base = base; this.extra = 0; this.timeInMap = 0;
    this.nextT = rand(25, 40); this.quietT = 0;
    this.game.scene.add(this.reflectOnly);
    windUniforms.uDistort.value = 0;
  }
  get nightmare() { return this.game.mode === 'nightmare'; }
  bump(v) { this.extra = Math.min(0.4, this.extra + v); }
  onFeed() { this.bump(0.03); if (chance(0.25 + this.intensity * 0.3)) this.nextT = Math.min(this.nextT, rand(4, 10)); }

  // ---------- view helpers ----------
  inView(p, margin = 0.9) {
    const cam = this.game.camera;
    _ndc.copy(p).project(cam);
    if (_ndc.z > 1 || _ndc.z < -1 || Math.abs(_ndc.x) > margin || Math.abs(_ndc.y) > margin) return false;
    return this.game.world.lineOfSight(cam.position, p);
  }
  lookCentered(p, deg = 8) {
    const cam = this.game.camera; cam.getWorldDirection(_v2);
    _v.copy(p).sub(cam.position).normalize();
    return _v.dot(_v2) > Math.cos(deg * Math.PI / 180);
  }
  camFwd() { const d = new THREE.Vector3(); this.game.camera.getWorldDirection(d); d.y = 0; return d.normalize(); }
  floorAt(x, z, nearY) { return this.game.world.groundAt(x, z, nearY + 1.2, 0.2, 0.3).y; }
  // Point along a direction with clear line, between minD and maxD
  spotAlong(yawOffset, minD, maxD, fromPos = null) {
    const g = this.game, m = g.monster;
    const f = this.camFwd(); const a = Math.atan2(f.x, f.z) + yawOffset;
    const ox = fromPos ? fromPos.x : m.pos.x, oz = fromPos ? fromPos.z : m.pos.z, oy = m.pos.y + 1.5;
    const dx = Math.sin(a), dz = Math.cos(a);
    const free = g.world.raycast(ox, oy, oz, dx, 0, dz, maxD + 2);
    if (free < minD + 1) return null;
    const d = Math.min(free - 1.2, rand(minD, maxD));
    const x = ox + dx * d, z = oz + dz * d;
    const y = this.floorAt(x, z, m.pos.y);
    if (Math.abs(y - m.pos.y) > 4) return null;
    return new THREE.Vector3(x, y, z);
  }
  // Longest open line in front (for "end of the hallway")
  hallEnd(minD = 12, maxD = 45) {
    const g = this.game, m = g.monster, f = this.camFwd(); const base = Math.atan2(f.x, f.z);
    let best = null, bd = 0;
    for (let i = 0; i < 9; i++) {
      const a = base + (i - 4) * 0.09;
      const dx = Math.sin(a), dz = Math.cos(a);
      const d = g.world.raycast(m.pos.x, m.pos.y + 1.4, m.pos.z, dx, 0, dz, maxD);
      if (d > bd && d >= minD) { bd = d; best = [dx, dz, d]; }
    }
    if (!best) return null;
    const d = best[2] - rand(1, 3);
    const p = new THREE.Vector3(m.pos.x + best[0] * d, 0, m.pos.z + best[1] * d);
    p.y = this.floorAt(p.x, p.z, m.pos.y);
    return Math.abs(p.y - m.pos.y) < 3 ? p : null;
  }
  anchor(type, minD, maxD, wantView = null) {
    const list = (this.game.map.anchors[type] || []).filter((a) => { const d = a.pos.distanceTo(this.game.monster.pos); return d > minD && d < maxD; });
    const shuffled = list.sort(() => Math.random() - 0.5);
    for (const a of shuffled) { if (wantView === null || this.inView(a.pos, 0.95) === wantView) return a; }
    return null;
  }

  // ---------- pools ----------
  getPresence(pose = 'stand') {
    let p = this.pool.presence.find((x) => !x.userData.busy && x.userData.pose === pose);
    if (!p) { p = buildPresence(pose); p.userData.pose = pose; this.pool.presence.push(p); }
    p.userData.busy = true; setPresenceAlpha(p, 1); p.visible = true; p.scale.setScalar(1);
    this.game.scene.add(p);
    return p;
  }
  freePresence(p) { p.userData.busy = false; p.visible = false; p.parent && p.parent.remove(p); }
  getFakeNPC(lost = false) {
    let n = this.pool.npc.find((x) => !x.busy && x.lost === lost);
    if (!n) {
      const b = buildHumanoid(randInt(1, 99999), lost ? 'lost' : pick(['casual', 'city', 'hiker', 'patient']), { lost });
      n = { body: b, busy: false, lost }; this.pool.npc.push(n);
      // stiff, unnatural standing pose
      b.bones.head.rotation.x = 0.15;
    }
    n.busy = true; n.body.group.visible = true; this.game.scene.add(n.body.group);
    return n;
  }
  freeNPC(n) { n.busy = false; n.body.group.visible = false; n.body.group.parent && n.body.group.parent.remove(n.body.group); }

  // ---------- main loop ----------
  update(dt) {
    const g = this.game;
    this.timeInMap += dt;
    this.extra = Math.max(0, this.extra - dt * 0.002);
    const ramp = Math.min(0.35, this.timeInMap * 0.0012);
    this.intensity = clamp(this.base + ramp + this.extra + (this.nightmare ? 0.3 : 0), 0, 1);
    // continuous low-level unease scaled by intensity
    g.post.grain = 0.05 + this.intensity * 0.05;
    for (let i = this.active.length - 1; i >= 0; i--) {
      const a = this.active[i];
      if (!a.update(dt)) { a.end && a.end(); this.active.splice(i, 1); }
    }
    for (const k in this.cd) this.cd[k] -= dt;
    if (!this.enabled || g.settings.hallucinations === false) return;
    this.quietT -= dt; this.nextT -= dt;
    if (this.nextT <= 0 && this.quietT <= 0) {
      const I = this.intensity;
      this.nextT = (40 - 31 * I) * rand(0.6, 1.4) * (this.nightmare ? 0.6 : 1);
      if (this.active.length >= (this.nightmare ? 3 : 2)) return;
      // sometimes the world goes unnaturally quiet first
      if (chance(0.18 + I * 0.15)) {
        g.audio.silence(0.04, rand(3, 6), 3);
        setTimeout(() => this.fire(), rand(3000, 5500));
      } else this.fire();
      // combinations: at higher intensity, layer a second effect
      if (chance(I * 0.35 + (this.nightmare ? 0.25 : 0))) setTimeout(() => this.fire(true), rand(800, 2500));
    }
  }

  fire(secondary = false, forced = null) {
    const g = this.game, I = this.intensity, kind = g.map.kind;
    const kw = KIND_WEIGHTS[kind] || {};
    const items = [];
    for (const k in EVENTS) {
      const E = EVENTS[k];
      if (forced && k !== forced) continue;
      if (!forced) {
        if ((this.cd[k] || 0) > 0 || I < E.min) continue;
        if (secondary && E.major) continue;
        if (E.needs === 'window' && !g.map.anchors.window.length) continue;
        if (E.needs === 'mirror' && !this.nearMirror()) continue;
        if (E.needs === 'door' && !g.map.doors.length) continue;
        if (E.needs === 'anomaly' && !(g.map.anomalies || []).some((a) => !a.on)) continue;
      }
      let w = kw[k] !== undefined ? kw[k] : E.w;
      if (this.nightmare) w = Math.max(w, 0.8) * (E.major ? 1.3 : 1);
      if (w > 0) items.push({ k, w });
    }
    if (!items.length) return;
    // try a few times — some events can't find a valid spot
    for (let tries = 0; tries < 4 && items.length; tries++) {
      const it = weighted(items);
      const inst = this['e_' + it.k] && this['e_' + it.k]();
      if (inst) {
        this.active.push(inst); this.cd[it.k] = EVENTS[it.k].cd * (this.nightmare ? 0.6 : 1);
        if (EVENTS[it.k].major) this.quietT = rand(18, 40) * (1 - I * 0.4);
        this.log.push(it.k); if (this.log.length > 20) this.log.shift();
        return it.k;
      }
      items.splice(items.indexOf(it), 1);
    }
  }
  trigger(name) { return this.fire(false, name); }
  nearMirror() { const m = this.game.monster; return (this.game.map.mirrors || []).find((mr) => mr.visible !== false && mr.position.distanceTo(m.pos) < 9); }

  // ======================= events =======================
  // Generic presence instance with vanish rules.
  presenceAt(pos, { pose = 'stand', life = rand(6, 18), vanishDist = rand(7, 12), flash = 0, faceCam = true, approach = 0, onVanish = null } = {}) {
    const g = this.game;
    const fig = this.getPresence(pose);
    fig.position.copy(pos);
    const face = () => { const c = g.camera.position; fig.rotation.y = Math.atan2(c.x - fig.position.x, c.z - fig.position.z); };
    if (faceCam) face(); else fig.rotation.y = rand(0, Math.PI * 2);
    let t = 0, seenT = 0, unseenAfter = 0, everSeen = false, approaches = approach;
    const head = new THREE.Vector3();
    const self = this;
    return {
      update(dt) {
        t += dt; head.copy(fig.position); head.y += 2.4;
        const seen = self.inView(head, 0.95) || self.inView(_v.copy(fig.position).setY(fig.position.y + 1.2), 0.95);
        const d = fig.position.distanceTo(g.monster.pos);
        if (seen) { seenT += dt; everSeen = true; unseenAfter = 0; g.post.presence = Math.max(g.post.presence, clamp(1 - d / 40, 0.15, 0.6)); }
        else if (everSeen) unseenAfter += dt;
        if (flash && everSeen && seenT > flash) { self.vanishFx(fig.position, 'flash'); return false; }
        if (d < vanishDist) { self.vanishFx(fig.position, d < 5 ? 'close' : 'near'); onVanish && onVanish(); return false; }
        if (seenT > 0.6 && self.lookCentered(head, 3.5) && chance(dt * 1.5)) { g.stats.presenceStares++; self.vanishFx(fig.position, 'stare'); return false; }
        if (unseenAfter > 0.35) {
          if (approaches > 0) { // it's closer every time you look away
            approaches--; unseenAfter = 0; everSeen = false; seenT = 0;
            const dir = _v.copy(g.monster.pos).sub(fig.position).setY(0); const len = dir.length();
            if (len > 8) { dir.multiplyScalar(Math.min(len * 0.4, len - 6) / len); fig.position.add(dir); fig.position.y = self.floorAt(fig.position.x, fig.position.z, g.monster.pos.y); face(); g.audio.play('step', fig.position, { surface: g.surfaceAt(fig.position), heavy: 0.4, vol: 0.4 }); }
            return true;
          }
          return false; // looked away: gone
        }
        if (faceCam && seen && pose === 'tilt') face();
        return t < life;
      },
      end() { self.freePresence(fig); },
      fig,
    };
  }
  vanishFx(pos, how) {
    const g = this.game, r = Math.random();
    if (how === 'stare' || how === 'close') {
      if (r < 0.3) g.audio.play('stinger', pos, { vol: 0.5, dur: 1.2 });
      else if (r < 0.6) g.audio.play('whisper', g.camera.position.clone().add(this.camFwd().multiplyScalar(-0.8)), { vol: 0.45, dur: 1 });
      else if (r < 0.75) { g.post.glitch = 1; }
      // else: silence. It's just gone.
    } else if (how === 'flash' && r < 0.35) g.audio.play('static', null, { vol: 0.15, dur: 0.15 });
  }

  e_presenceAhead() {
    const p = this.hallEnd(14, 45) || this.spotAlong(rand(-0.3, 0.3), 15, 40); if (!p) return null;
    return this.presenceAt(p, { pose: pick(['stand', 'tilt', 'stand', 'lean']), vanishDist: rand(8, 14) });
  }
  e_presenceWindow() {
    const a = this.anchor('window', 12, 60, null); if (!a) return null;
    const win = a.win; const wasLit = win.lit; win.lit = true; win.flick = 0.35; this.game.map.refreshWindows();
    const inst = this.presenceAt(a.pos.clone().setY(a.pos.y - 1.4), { pose: 'stand', vanishDist: 9, life: rand(8, 20) });
    if (!inst) return null;
    const end = inst.end;
    inst.end = () => { end(); win.lit = wasLit; win.flick = 0; this.game.map.refreshWindows(); };
    return inst;
  }
  e_presenceTrees() {
    const a = this.anchor('treeGap', 18, 55, null);
    const p = a ? a.pos.clone() : this.spotAlong(rand(-0.9, 0.9), 18, 45); if (!p) return null;
    p.y = this.floorAt(p.x, p.z, p.y);
    return this.presenceAt(p, { pose: pick(['stand', 'lean', 'tilt']), vanishDist: rand(10, 16), life: rand(10, 25) });
  }
  e_presenceBehind() {
    const p = this.spotAlong(Math.PI + rand(-0.4, 0.4), 4, 7); if (!p) return null;
    this.game.audio.play('breath', p.clone().setY(p.y + 2.2), { vol: 0.35, inhale: false, intensity: 0.6 });
    return this.presenceAt(p, { pose: 'stand', flash: 0.18, vanishDist: 2, life: 8 });
  }
  e_presenceImpossible() {
    const a = this.anchor('roof', 15, 90, null) || this.anchor('impossible', 15, 90, null) || this.anchor('far', 25, 120, null); if (!a) return null;
    return this.presenceAt(a.pos.clone(), { pose: pick(['stand', 'tilt']), vanishDist: 8, life: rand(10, 30) });
  }
  e_presenceFlash() {
    const p = this.spotAlong(rand(-0.6, 0.6), 6, 25); if (!p) return null;
    return this.presenceAt(p, { pose: pick(['stand', 'reach', 'tilt']), flash: rand(0.08, 0.25), vanishDist: 3, life: 5 });
  }
  e_presenceApproach() {
    const p = this.hallEnd(20, 50) || this.spotAlong(rand(-0.4, 0.4), 22, 45); if (!p) return null;
    return this.presenceAt(p, { pose: 'stand', approach: 3, vanishDist: 6, life: 40 });
  }
  e_presenceMirror() {
    const mr = this.nearMirror(); if (!mr) return null;
    // a figure only the mirror shows, standing behind the player
    const g = this.game; const fig = buildPresence(pick(['stand', 'tilt']));
    this.reflectOnly.add(fig);
    let t = 0; const life = rand(4, 9);
    const self = this;
    return {
      update(dt) {
        t += dt;
        const m = g.monster; const back = self.camFwd().multiplyScalar(-rand(1.6, 1.8));
        fig.position.set(m.pos.x + back.x, m.pos.y, m.pos.z + back.z);
        fig.rotation.y = Math.atan2(m.pos.x - fig.position.x, m.pos.z - fig.position.z);
        if (mr.position.distanceTo(m.pos) > 10) return false;
        return t < life;
      },
      end() { self.reflectOnly.remove(fig); fig.traverse((o) => o.geometry && o.geometry.dispose()); },
    };
  }
  e_fakeNPC() {
    const g = this.game; const lost = g.map.kind === 'other' || chance(0.25);
    const p = this.hallEnd(12, 40) || this.spotAlong(rand(-0.7, 0.7), 14, 40); if (!p) return null;
    const n = this.getFakeNPC(lost);
    const grp = n.body.group; grp.position.copy(p);
    const towards = chance(0.6);
    const c = g.camera.position; grp.rotation.y = Math.atan2(c.x - p.x, c.z - p.z) + (towards ? 0 : Math.PI);
    if (chance(0.3)) { n.body.bones.upperArmR.rotation.set(-2.6, 0, -0.3); } else n.body.bones.upperArmR.rotation.set(0, 0, 0); // waving / still
    n.body.setExpression('neutral');
    let t = 0, everSeen = false, unseen = 0; const self = this; const life = rand(12, 30);
    return {
      update(dt) {
        t += dt; const d = grp.position.distanceTo(g.monster.pos);
        const seen = self.inView(_v.copy(grp.position).setY(grp.position.y + 1.2));
        if (seen) { everSeen = true; unseen = 0; } else if (everSeen) unseen += dt;
        if (n.body.bones.upperArmR.rotation.x < -1) n.body.bones.foreArmR.rotation.z = Math.sin(t * 5) * 0.4;
        if (d < rand(8, 11)) { if (chance(0.3)) g.audio.play('whisper', grp.position.clone().setY(grp.position.y + 1.6), { vol: 0.3, dur: 0.8 }); return false; }
        if (unseen > 0.8 && chance(0.7)) return false;
        return t < life;
      },
      end() { self.freeNPC(n); },
    };
  }
  e_shadow() {
    const g = this.game, m = g.monster;
    const side = chance(0.5) ? 1 : -1;
    const f = this.camFwd(); const right = new THREE.Vector3(-f.z, 0, f.x);
    const start = m.pos.clone().addScaledVector(f, rand(5, 9)).addScaledVector(right, side * 5);
    const endP = start.clone().addScaledVector(right, -side * 10);
    const mat = new THREE.MeshBasicMaterial({ map: silhouetteTexture('rgba(0,0,0,1)', 10), transparent: true, opacity: 0, depthWrite: false, color: 0x000000 });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 3.6), mat);
    plane.rotation.x = -Math.PI / 2; plane.renderOrder = 2;
    g.scene.add(plane);
    let t = 0; const dur = rand(1.6, 3);
    const yaw = Math.atan2(endP.x - start.x, endP.z - start.z);
    plane.rotation.z = -yaw;
    if (chance(0.5)) g.audio.play('step', start, { surface: g.surfaceAt(start), heavy: 0.3, vol: 0.2 });
    return {
      update(dt) {
        t += dt; const u = t / dur;
        plane.position.lerpVectors(start, endP, u);
        plane.position.y = g.world.groundAt(plane.position.x, plane.position.z, m.pos.y + 1).y + 0.03;
        mat.opacity = Math.sin(Math.min(1, u) * Math.PI) * 0.55;
        return t < dur;
      },
      end() { g.scene.remove(plane); plane.geometry.dispose(); mat.dispose(); },
    };
  }
  e_objectAppear() {
    const g = this.game;
    const p = this.spotAlong(Math.PI + rand(-0.5, 0.5), 5, 12); if (!p) return null;
    const obj = new THREE.Group(); const kind = pick(['chair', 'doll', 'balloon', 'chair']);
    const wood = new THREE.MeshStandardMaterial({ color: 0x5a4030, roughness: 0.8 });
    if (kind === 'chair') {
      const add = (sx, sy, sz, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), wood); b.position.set(x, y, z); b.castShadow = true; obj.add(b); };
      add(0.45, 0.05, 0.45, 0, 0.45, 0); add(0.45, 0.5, 0.05, 0, 0.72, -0.2); for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) add(0.04, 0.45, 0.04, x, 0.22, z);
    } else if (kind === 'doll') {
      const b = buildHumanoid(randInt(1, 999), 'patient', { child: true }); b.group.scale.setScalar(0.35); b.bones.hips.position.y = 0.2; b.bones.hips.rotation.x = 0; b.bones.thighL.rotation.x = -1.5; b.bones.thighR.rotation.x = -1.5; b.bones.head.rotation.z = 0.5; obj.add(b.group);
    } else {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), new THREE.MeshStandardMaterial({ color: 0x9a0a0a, roughness: 0.3 })); s.scale.y = 1.15; s.position.y = 1.7; obj.add(s);
      const str = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 1.5), new THREE.MeshBasicMaterial({ color: 0xdddddd })); str.position.y = 0.75; obj.add(str);
    }
    obj.position.copy(p); const c = g.camera.position; obj.rotation.y = Math.atan2(c.x - p.x, c.z - p.z);
    g.scene.add(obj);
    let t = 0, seen = false, unseen = 0; const self = this;
    return {
      update(dt) {
        t += dt; const s = self.inView(_v.copy(obj.position).setY(obj.position.y + 0.6));
        if (kind === 'balloon') obj.children[0].position.y = 1.7 + Math.sin(t) * 0.05;
        if (s) { seen = true; unseen = 0; } else if (seen) unseen += dt;
        if (seen && unseen > 1.5) return false;
        return t < 60;
      },
      end() { g.scene.remove(obj); },
    };
  }
  e_abandoned() {
    const g = this.game; if (!g.map.setAbandoned) return null;
    let t = 0; const dur = rand(4, 8);
    g.audio.silence(0.02, dur - 1.5, 1.5);
    return {
      update(dt) {
        t += dt; const u = t / dur;
        // flicker in, hold, flicker out
        let f = u < 0.1 ? (Math.random() < u * 10 ? 1 : 0) : u > 0.9 ? (Math.random() < (1 - u) * 10 ? 1 : 0) : 1;
        g.map.setAbandoned(f); g.npcs.list.forEach((n) => { n.group.visible = f < 0.5; });
        g.post.desatExtra = f * 0.6;
        return t < dur;
      },
      end() { g.map.setAbandoned(0); g.post.desatExtra = 0; },
    };
  }
  e_stretch() {
    const g = this.game; let t = 0; const dur = rand(3, 6);
    g.audio.play('stinger', null, { vol: 0.25, dur });
    return { update(dt) { t += dt; g.post.stretch = Math.sin(Math.min(1, t / dur) * Math.PI) * 1; return t < dur; }, end() { g.post.stretch = 0; } };
  }
  e_treesMove() {
    const g = this.game; let t = 0; const dur = rand(5, 9);
    g.audio.silence(0.05, dur - 1, 2);
    return { update(dt) { t += dt; windUniforms.uDistort.value = Math.sin(Math.min(1, t / dur) * Math.PI) * 2.5; return t < dur; }, end() { windUniforms.uDistort.value = 0; } };
  }
  e_runner() {
    const g = this.game, m = g.monster;
    const f = this.camFwd(); const right = new THREE.Vector3(-f.z, 0, f.x); const side = chance(0.5) ? 1 : -1;
    const d = rand(45, 80);
    const start = m.pos.clone().addScaledVector(f, d).addScaledVector(right, side * 25);
    const free = g.world.raycast(m.pos.x, m.pos.y + 1.5, m.pos.z, f.x, 0, f.z, d + 5); if (free < d - 5) return null;
    const fig = this.getPresence('lean'); fig.position.copy(start);
    let t = 0; const dur = rand(2.5, 4); const self = this;
    fig.rotation.y = Math.atan2(-right.x * side, -right.z * side);
    return {
      update(dt) {
        t += dt; fig.position.addScaledVector(right, -side * 16 * dt);
        fig.position.y = self.floorAt(fig.position.x, fig.position.z, m.pos.y) + Math.abs(Math.sin(t * 14)) * 0.15;
        return t < dur;
      },
      end() { self.freePresence(fig); },
    };
  }
  e_anomaly() {
    const g = this.game; const list = (g.map.anomalies || []).filter((a) => !a.on); if (!list.length) return null;
    const a = pick(list); a.on = true; a.apply(); let t = 0, seen = false, unseen = 0; const self = this;
    return {
      update(dt) { t += dt; const s = a.pos ? self.inView(a.pos) : true; if (s) { seen = true; unseen = 0; } else if (seen) unseen += dt; return !(seen && unseen > 2) && t < 90; },
      end() { a.on = false; a.revert(); },
    };
  }
  e_lightsOut() {
    const g = this.game, m = g.monster;
    const ls = g.map.lights.filter((L) => L.on && L.pos.distanceTo(m.pos) < 35).sort((a, b) => b.pos.distanceTo(m.pos) - a.pos.distanceTo(m.pos));
    if (ls.length < 2) return null;
    let t = 0; let i = 0; const dur = rand(7, 12); const off = [];
    return {
      update(dt) {
        t += dt;
        if (i < ls.length && t > i * 0.45) { const L = ls[i++]; L.hallOff = true; off.push(L); g.audio.play('click', L.pos, { vol: 0.5 }); }
        return t < dur;
      },
      end() { off.forEach((L) => { L.hallOff = false; }); },
    };
  }
  e_faceFlash() {
    const g = this.game; const a = this.anchor('window', 5, 25, true); if (!a) return null;
    const mat = new THREE.SpriteMaterial({ map: faceTexture(77, { skin: [200, 195, 190], hollow: true }), transparent: true, opacity: 0.9, depthWrite: false });
    const s = new THREE.Sprite(mat); s.scale.set(0.45, 0.45, 1); s.position.copy(a.pos).add(a.face.clone().multiplyScalar(0.2)); s.position.y += 1.0;
    g.scene.add(s); let t = 0; const dur = rand(0.15, 0.4);
    return { update(dt) { t += dt; return t < dur; }, end() { g.scene.remove(s); mat.dispose(); } };
  }
  e_npcStare() {
    const g = this.game;
    const cand = g.npcs.list.filter((n) => n.alive && !n.recognized && n.pos.distanceTo(g.monster.pos) < 45 && n.pos.distanceTo(g.monster.pos) > 8 && this.inView(n.eye()));
    if (!cand.length) return null;
    const n = pick(cand); n.stareT = rand(4, 8);
    return { update(dt) { return n.stareT > 0 && !n.removed; } };
  }
  e_npcHollow() {
    const g = this.game;
    const cand = g.npcs.list.filter((n) => n.alive && n.pos.distanceTo(g.monster.pos) < 25 && this.inView(n.eye()));
    if (!cand.length) return null;
    const n = pick(cand); const hollow = faceTexture(n.id + 500, { hollow: true, skin: [190, 185, 180] });
    const prev = n.body.faceMat.map; n.body.faceMat.map = hollow; n.body.faceMat.needsUpdate = true;
    let t = 0; const dur = rand(0.6, 1.6);
    return { update(dt) { t += dt; return t < dur; }, end() { n.body.faceMat.map = prev; n.body.faceMat.needsUpdate = true; } };
  }
  e_glitch() { const g = this.game; let t = 0; return { update(dt) { t += dt; g.post.glitch = t < 0.6 ? 1 : 0; return t < 0.6; } }; }

  // ----- audio-only events -----
  behind(dist = 1.2, up = 0.3) { const m = this.game.monster; const f = this.camFwd(); return m.headPos().addScaledVector(f, -dist).add(new THREE.Vector3(rand(-0.3, 0.3), up, rand(-0.3, 0.3))); }
  e_fakeSteps() {
    const g = this.game, m = g.monster; const f = this.camFwd();
    const ang = Math.atan2(f.x, f.z) + Math.PI + rand(-0.8, 0.8);
    let d = rand(10, 16); const n = randInt(5, 10); let i = 0, t = 0; const surf = g.surfaceAt(m.pos); const interval = rand(0.45, 0.65);
    const startYaw = Math.atan2(f.x, f.z);
    return {
      update(dt) {
        t += dt;
        // stop the moment the player turns to look
        const nf = this.self.camFwd(); if (Math.abs(angleDiff(startYaw, Math.atan2(nf.x, nf.z))) > 1.6) return false;
        if (t > i * interval) { d = Math.max(2.5, d - 1.3); const p = new THREE.Vector3(m.pos.x + Math.sin(ang) * d, m.pos.y, m.pos.z + Math.cos(ang) * d); g.audio.play('step', p, { surface: surf, heavy: 0.5, vol: 0.55 }); i++; }
        return i < n;
      },
      self: this,
    };
  }
  e_whisperBehind() { this.game.audio.play('whisper', this.behind(), { vol: 0.55, dur: rand(1.5, 3) }); return this.oneShot(3); }
  e_nameWhisper() {
    const g = this.game; const name = (g.settings.playerName || '').trim();
    g.audio.play('whisper', this.behind(1, 0.2), { vol: 0.5, dur: 1.2 });
    if (name && g.settings.voices !== false && window.speechSynthesis) {
      try {
        const u = new SpeechSynthesisUtterance(name); u.volume = 0.22; u.rate = 0.55; u.pitch = 0.1;
        window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);
      } catch (e) { /* ignore */ }
    }
    return this.oneShot(2);
  }
  e_distantConvo() {
    const g = this.game; const a = this.anchor('window', 10, 45, null) || this.anchor('indoor', 8, 40, null); if (!a) return null;
    const p = a.pos.clone().setY(a.pos.y);
    let t = 0, k = 0; const n = randInt(3, 6);
    return { update(dt) { t += dt; if (t > k * 2.2 && k < n) { g.audio.play('babble', p, { pitch: k % 2 ? 200 : 120, dur: rand(1.2, 2), vol: 0.35, muffle: 0.45 }); k++; } if (g.monster.pos.distanceTo(p) < 6) return false; return k < n || t < n * 2.2; } };
  }
  e_distantScream() {
    const g = this.game, m = g.monster; const a = rand(0, Math.PI * 2);
    g.audio.play('scream', new THREE.Vector3(m.pos.x + Math.sin(a) * 90, m.pos.y + 3, m.pos.z + Math.cos(a) * 90), { far: true, vol: 0.6, pitch: rand(0.8, 1.3) });
    return this.oneShot(2);
  }
  wallPoint() {
    const g = this.game, m = g.monster; const f = this.camFwd();
    for (let i = 0; i < 6; i++) {
      const a = Math.atan2(f.x, f.z) + rand(-Math.PI, Math.PI); const dx = Math.sin(a), dz = Math.cos(a);
      const d = g.world.raycast(m.pos.x, m.pos.y + 1.4, m.pos.z, dx, 0, dz, 6);
      if (d < 6) return new THREE.Vector3(m.pos.x + dx * (d + 0.4), m.pos.y + rand(0.8, 2.2), m.pos.z + dz * (d + 0.4));
    }
    return null;
  }
  e_wallVoices() { const p = this.wallPoint(); if (!p) return null; this.game.audio.play('babble', p, { pitch: rand(90, 160), dur: rand(2, 3.5), vol: 0.35, muffle: 0.6, rate: 4 }); return this.oneShot(3); }
  e_scratching() { const p = this.wallPoint() || this.behind(2, 1.5); this.game.audio.play('scratch', p, { vol: 0.5, dur: rand(1.5, 3.5) }); return this.oneShot(3); }
  e_doorSound() {
    const g = this.game; const d = g.map.doors.filter((x) => !x.broken && x.pos.distanceTo(g.monster.pos) < 25 && x.pos.distanceTo(g.monster.pos) > 4).sort(() => Math.random() - 0.5)[0]; if (!d) return null;
    const nobodyNear = !g.npcs.list.some((n) => n.pos.distanceTo(d.pos) < 6);
    if (nobodyNear && chance(0.35) && !this.inView(d.pos.clone().setY(d.pos.y + 1))) { const wasLocked = d.locked; d.locked = false; d.toggle(null, g, false); d.locked = wasLocked; } // it really moved. Or did it?
    else g.audio.play(chance(0.5) ? 'doorOpen' : 'doorClose', d.pos.clone().setY(d.pos.y + 1), { vol: 0.8 });
    return this.oneShot(2);
  }
  e_breathing() { this.game.audio.play('breathNPC', this.behind(0.9, 0.1), { vol: 0.4 }); setTimeout(() => this.game.audio.play('breathNPC', this.behind(0.9, 0.1), { vol: 0.35 }), 1100); return this.oneShot(3); }
  e_knock() {
    const g = this.game; const d = g.map.doors.filter((x) => x.pos.distanceTo(g.monster.pos) < 20).sort(() => Math.random() - 0.5)[0]; if (!d) return null;
    g.audio.play('knock', d.pos.clone().setY(d.pos.y + 1.2), { vol: 0.8, n: 3 }); return this.oneShot(2);
  }
  loopingSound(name, opts, stopDist = 8, every = 2.5, maxT = 40) {
    const g = this.game; const a = this.anchor('indoor', 12, 45, null) || this.anchor('window', 12, 45, null);
    const p = a ? a.pos.clone() : this.spotAlong(rand(-2, 2), 15, 35); if (!p) return null;
    let t = 0, next = 0;
    return { update(dt) { t += dt; if (g.monster.pos.distanceTo(p) < stopDist) return false; if (t >= next) { g.audio.play(name, p, opts); next = t + every; } return t < maxT; } };
  }
  e_phone() { return this.loopingSound('phone', { vol: 0.5 }, 8, 3, 30); }
  e_cryingStops() { return this.loopingSound('cry', { vol: 0.35 }, 10, 3, 40); }
  e_laugh() { const p = this.spotAlong(rand(-2.5, 2.5), 12, 25) || this.behind(8, 0); this.game.audio.play('laugh', p, { vol: 0.4 }); return this.oneShot(2); }
  e_musicBox() {
    const g = this.game; const notes = [523, 587, 523, 440, 392, 440, 523, 494]; const p = this.spotAlong(rand(-2, 2), 10, 25) || this.behind(10, 0);
    let t = 0, i = 0;
    return { update(dt) { t += dt; if (g.monster.pos.distanceTo(p) < 7) return false; if (t > i * 0.55 && i < notes.length * 2) { g.audio.play('tone', p, { f: notes[i % notes.length] * (i >= notes.length ? 0.985 : 1), vol: 0.25, dur: 1.4, type: 'triangle' }); i++; } return i < notes.length * 2; } };
  }
  e_clang() { const g = this.game; const a = rand(0, Math.PI * 2); g.audio.play('clang', g.monster.pos.clone().add(new THREE.Vector3(Math.sin(a) * 30, rand(-4, 4), Math.cos(a) * 30)), { vol: 0.7 }); return this.oneShot(3); }
  e_announce() { const g = this.game; const s = (g.map.anchors.speaker || []); const p = s.length ? pick(s).pos : g.monster.pos.clone().setY(g.monster.pos.y + 3); g.audio.play('announce', p, { vol: 0.5, dur: rand(3, 5) }); return this.oneShot(6); }
  oneShot(t) { let x = 0; return { update(dt) { x += dt; return x < t; } }; }
}
