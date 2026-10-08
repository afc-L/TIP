import * as THREE from 'three';
import { initPhysics, Physics, FIXED_DT, MAX_STEPS_PER_FRAME, MAX_FIGHTERS } from './physics.js';
import { buildArena, ARENA_HALF } from './arena.js';
import { Fighter } from './fighter.js';
import { Combat } from './combat.js';
import { Gore } from './gore.js';
import { Audio } from './audio.js';
import { AIController } from './ai.js';
import { PlayerInput } from './input.js';
import { UI } from './ui.js';
import { clamp, lerp, rand, v3, q4 } from './util.js';
import { WEAPONS } from './weapons.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const ENEMY_NAMES = ['Konrad the Grim', 'Ulric of Halden', 'Black Wido', 'Sir Mortimer', 'Brother Anselm', 'Gerold Ironside', 'Wolfram', 'Hagen the Red'];
const ARMORS = ['knight', 'manAtArms', 'peasant', 'naked'];

class Game {
  async init() {
    this.settings = { mode: 'duel', difficulty: 'normal', weapon: 'longsword', armor: 'manAtArms', gore: true };
    this.canvas = document.getElementById('game');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, preserveDrawingBuffer: !!window.__TEST__ });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.6;
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.05, 200);
    this.camera.position.set(0, 2.5, -5);
    this.camLook = new THREE.Vector3();
    this.cameraYaw = 0;
    this.shake = 0;
    window.addEventListener('resize', () => this.resize());
    this.resize();

    await initPhysics();
    this.physics = new Physics();
    this.world = this.physics.world;
    buildArena(this);
    this.visuals = new Map();
    this.fighters = [];
    this.combat = new Combat(this);
    this.gore = new Gore(this);
    this.audio = new Audio(this);
    this.input = new PlayerInput(this, this.canvas);
    this.ui = new UI(this);
    this.running = false;
    this.paused = false;
    this.timeScale = 1;
    this.slowmo = false;
    this.accumulator = 0;
    this.last = performance.now();
    this.matchOver = false;
    this.ui.hideLoading();
    this.ui.showMenu();
    // idle background: two AIs sparring behind the menu
    this.startAttract();
    requestAnimationFrame((t) => this.frame(t));
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ------------------------------------------------------------------ visuals
  addVisual(body, obj) {
    const e = { body, obj, pp: new THREE.Vector3(), pq: new THREE.Quaternion(), cp: new THREE.Vector3(), cq: new THREE.Quaternion() };
    v3(body.translation(), e.cp); q4(body.rotation(), e.cq);
    e.pp.copy(e.cp); e.pq.copy(e.cq);
    obj.position.copy(e.cp); obj.quaternion.copy(e.cq);
    this.visuals.set(body.handle, e);
  }
  removeVisual(body) { this.visuals.delete(body.handle); }
  snapshot() {
    for (const e of this.visuals.values()) {
      e.pp.copy(e.cp); e.pq.copy(e.cq);
      v3(e.body.translation(), e.cp); q4(e.body.rotation(), e.cq);
    }
  }
  renderVisuals(alpha) {
    for (const e of this.visuals.values()) {
      e.obj.position.lerpVectors(e.pp, e.cp, alpha);
      e.obj.quaternion.slerpQuaternions(e.pq, e.cq, alpha);
    }
  }

  // ------------------------------------------------------------------ fighters
  freeIndex() {
    for (let i = 0; i < MAX_FIGHTERS; i++) if (!this.fighters.some((f) => f.index === i)) return i;
    return -1;
  }

  spawn(opts) {
    const index = this.freeIndex();
    if (index < 0) return null;
    const f = new Fighter(this, { ...opts, index, colorIndex: opts.colorIndex ?? index });
    this.fighters.push(f);
    return f;
  }

  removeFighter(f) {
    for (const o of this.fighters) {
      if (o.target === f) o.target = null;
      if (o.grabbedPart && o.grabbedPart.fighter === f) o.releaseGrab();
    }
    f.destroy();
    this.fighters = this.fighters.filter((x) => x !== f);
    if (this.player === f) this.player = null;
  }

  clearAll() {
    for (const f of [...this.fighters]) this.removeFighter(f);
    this.gore.clear();
    this.physics.events.clear?.();
    this.player = null;
  }

  startAttract() {
    this.clearAll();
    this.attract = true;
    const a = this.spawn({ name: 'Red', team: 1, position: new THREE.Vector3(-1, 0, 0), yaw: Math.PI / 2, weapon: 'longsword', armor: 'manAtArms', colorIndex: 1 });
    const b = this.spawn({ name: 'Blue', team: 0, position: new THREE.Vector3(1, 0, 0), yaw: -Math.PI / 2, weapon: 'axe', armor: 'peasant', colorIndex: 0 });
    a.controller = new AIController(a, this, 'normal');
    b.controller = new AIController(b, this, 'normal');
    this.running = true;
  }

  start() {
    this.clearAll();
    this.attract = false;
    this.matchOver = false;
    this.ui.message('');
    const s = this.settings;
    this.player = this.spawn({ name: 'You', team: 0, isPlayer: true, position: new THREE.Vector3(0, 0, -1.6), yaw: 0, weapon: s.weapon, armor: s.armor, colorIndex: 0 });
    this.player.controller = this.input;
    this.input.aim.x = 0.2; this.input.aim.y = 0.0; this.input.aim.reach = 0.42;
    this.input.lockOn = true;
    if (s.mode === 'duel') {
      this.spawnEnemy(new THREE.Vector3(0, 0, 1.6), Math.PI);
      this.ui.setSandbox(false);
      this.ui.message('FIGHT!', `${this.player.target?.name || ''}`, false, 2);
    } else {
      const d = this.spawn({ name: 'Training Dummy', team: 2, position: new THREE.Vector3(0, 0, 1.6), yaw: Math.PI, weapon: 'longsword', armor: 'peasant', colorIndex: 3 });
      d.controller = new AIController(d, this, s.difficulty, true);
      this.ui.setSandbox(true);
      this.ui.message('SANDBOX', 'Experiment freely', false, 2);
    }
    this.player.target = this.nearestHostile(this.player);
    this.running = true;
    this.paused = false;
    this.camera.position.set(0, 2.6, -5);
    this.cameraYaw = 0;
    if (!localStorageGet('sb_tutorial_seen')) { this.ui.showTutorial(true); localStorageSet('sb_tutorial_seen', '1'); }
  }

  spawnEnemy(pos, yaw, team = 1, ally = false) {
    const s = this.settings;
    const weapons = Object.keys(WEAPONS);
    const armorPool = s.difficulty === 'hard' ? ['knight', 'manAtArms'] : s.difficulty === 'easy' ? ['peasant', 'naked', 'manAtArms'] : ARMORS;
    const f = this.spawn({
      name: ally ? 'Ally ' + ENEMY_NAMES[Math.floor(Math.random() * ENEMY_NAMES.length)].split(' ')[0] : ENEMY_NAMES[Math.floor(Math.random() * ENEMY_NAMES.length)],
      team, position: pos, yaw,
      weapon: Math.random() < 0.55 ? 'longsword' : weapons[Math.floor(Math.random() * weapons.length)],
      armor: armorPool[Math.floor(Math.random() * armorPool.length)],
    });
    if (f) f.controller = new AIController(f, this, s.difficulty);
    return f;
  }

  nearestHostile(f) {
    let best = null, bd = Infinity;
    for (const o of this.fighters) {
      if (o === f || o.team === f.team || !o.alive) continue;
      const d = o.parts.pelvis.p.distanceTo(f.parts.pelvis.p);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  toMenu() {
    this.paused = false;
    document.exitPointerLock?.();
    this.ui.showMenu();
    this.ui.setSandbox(false);
    this.ui.message('');
    this.startAttract();
  }

  requestLock() {
    if (window.__TEST__) { this.input.locked = true; this.paused = false; this.ui.showPause(false); this.ui.setLockHint(false); return; }
    this.canvas.requestPointerLock?.();
  }

  onUnlock() {
    if (this.attract || this.ui.tutorialOpen) return;
    if (this.running) { this.paused = true; this.ui.showPause(true); }
  }

  onKey(code) {
    if (this.attract) return;
    if (code === 'KeyR') { this.start(); return; }
    if (code === 'KeyM') { this.toMenu(); return; }
    if (code === 'KeyH') { this.ui.showTutorial(!this.ui.tutorialOpen); return; }
    if (code === 'KeyT') { this.slowmo = !this.slowmo; this.ui.feed(this.slowmo ? 'Slow motion' : 'Normal speed'); }
    if (this.settings.mode === 'sandbox') {
      const p = this.player;
      const around = () => {
        const base = p ? p.parts.pelvis.p : new THREE.Vector3();
        const a = rand(0, Math.PI * 2);
        return new THREE.Vector3(clamp(base.x + Math.sin(a) * 3, -ARENA_HALF + 1.5, ARENA_HALF - 1.5), 0, clamp(base.z + Math.cos(a) * 3, -ARENA_HALF + 1.5, ARENA_HALF - 1.5));
      };
      const faceYaw = (pos) => (p ? Math.atan2(p.parts.pelvis.p.x - pos.x, p.parts.pelvis.p.z - pos.z) : 0);
      if (code === 'Digit1') {
        const pos = around();
        const d = this.spawn({ name: 'Training Dummy', team: 2, position: pos, yaw: faceYaw(pos), weapon: 'longsword', armor: ARMORS[Math.floor(Math.random() * 4)] });
        if (d) d.controller = new AIController(d, this, this.settings.difficulty, true); else this.ui.feed('Too many fighters');
      }
      if (code === 'Digit2') { const pos = around(); if (!this.spawnEnemy(pos, faceYaw(pos), 1)) this.ui.feed('Too many fighters'); }
      if (code === 'Digit3') { const pos = around(); if (!this.spawnEnemy(pos, faceYaw(pos) + Math.PI, 0, true)) this.ui.feed('Too many fighters'); }
      if (code === 'Digit4') { for (const f of [...this.fighters]) if (f !== this.player) this.removeFighter(f); this.gore.clear(); }
      if (code === 'Digit5') {
        if (this.player) this.removeFighter(this.player);
        this.player = this.spawn({ name: 'You', team: 0, isPlayer: true, position: around(), yaw: 0, weapon: this.settings.weapon, armor: this.settings.armor, colorIndex: 0 });
        if (this.player) this.player.controller = this.input;
      }
      if (code === 'KeyG' && this.player) { this.player.invulnerable = !this.player.invulnerable; this.ui.feed(this.player.invulnerable ? 'God mode ON' : 'God mode OFF'); }
    }
  }

  // ------------------------------------------------------------------ events
  onHit(attacker, victim, part, dmg, type) {
    if (victim === this.player) { this.shake = Math.max(this.shake, Math.min(0.12, dmg * 0.004)); this.hurtFlash = Math.min(0.8, (this.hurtFlash || 0) + dmg * 0.02); }
    else if (attacker === this.player) this.shake = Math.max(this.shake, Math.min(0.06, dmg * 0.002));
    if (this.attract) return;
    if (dmg > 25 && (attacker === this.player || victim === this.player)) {
      const where = part.region === 'head' ? 'to the head' : part.region === 'torso' ? 'to the body' : `to the ${part.region}`;
      this.ui.feed(`${type === 'thrust' ? 'Deep thrust' : type === 'blunt' ? 'Crushing blow' : 'Savage cut'} ${where}!`, attacker === this.player ? '#f0c890' : '#ff6060');
    }
  }
  onSever(attacker, victim, part) {
    if (this.attract) return;
    const what = part.region === 'head' ? 'DECAPITATED' : `${victim.name}'s ${part.region === 'hand' ? 'hand' : part.region === 'foot' ? 'foot' : part.region === 'leg' ? 'leg' : 'arm'} lopped off!`;
    this.ui.feed(part.region === 'head' ? `${victim.name} ${what}!` : what, '#ff3030');
    this.shake = Math.max(this.shake, 0.08);
  }
  onParry(defender, attacker) {
    if (this.attract) return;
    if (defender === this.player) this.ui.feed('Parried!', '#9fd0ff');
    else if (attacker === this.player) this.ui.feed('Your blow was parried', '#ff9a6a');
  }
  onFighterDown(f) {
    this.audio.thud(f.parts.pelvis.p, 6, true);
  }
  onFighterDeath(f, cause) {
    if (f.lastHitBy) f.lastHitBy.kills++;
    if (this.attract) return;
    this.ui.feed(`${f.name} ${f === this.player ? 'have' : 'has'} fallen${cause === 'blood loss' ? ', bled out' : ''}.`, f === this.player ? '#ff3030' : '#f0c890');
    this.audio.pain(f, 40);
  }

  checkMatch(dt) {
    if (this.attract) {
      // keep the attract-mode fight going forever
      if (this.fighters.some((f) => f.state === 'dead' && f.stateTime > 4)) this.startAttract();
      return;
    }
    if (this.settings.mode !== 'duel' || this.matchOver || !this.player) return;
    const enemies = this.fighters.filter((f) => f.team !== this.player.team);
    const out = (f) => f.state === 'dead' || (f.limb.armL <= 0 && f.limb.armR <= 0) || (f.state === 'down' && f.health < 12 && f.stateTime > 8);
    if (!this.player.alive || out(this.player)) {
      this.matchOver = true;
      this.ui.message('DEFEAT', `${this.player.deathCause === 'decapitated' ? 'Your head rolls in the dirt.' : 'You can fight no more.'}  R — rematch · M — menu`, true);
    } else if (enemies.length && enemies.every(out)) {
      this.matchOver = true;
      const e = enemies[0];
      this.ui.message('VICTORY', `${e.name} ${e.state === 'dead' ? (e.deathCause === 'decapitated' ? 'loses his head' : 'lies dead') : 'yields'}.  R — rematch · M — menu`);
    }
  }

  // ------------------------------------------------------------------ main loop
  frame(now) {
    requestAnimationFrame((t) => this.frame(t));
    const rawDt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    if (this.running && !this.paused && !this.manual) this.tick(rawDt);
    this.updateCamera(rawDt);
    this.ui.update(rawDt);
    this.audio.updateWhoosh(this.fighters);
    this.renderer.render(this.scene, this.camera);
  }

  tick(rawDt) {
    const scale = this.slowmo ? 0.3 : 1;
    const dt = rawDt * scale;
    // targets
    for (const f of this.fighters) if (!f.target || !f.target.alive || f.target.team === f.team) f.target = this.nearestHostile(f);
    if (this.player) this.input.update(this.player, dt);
    for (const f of this.fighters) if (f.controller && f.controller !== this.input) f.controller.update(dt);

    this.accumulator += dt;
    let steps = 0;
    while (this.accumulator >= FIXED_DT && steps < MAX_STEPS_PER_FRAME) {
      this.fixedStep();
      this.accumulator -= FIXED_DT;
      steps++;
    }
    if (steps === MAX_STEPS_PER_FRAME) this.accumulator = 0;
    this.renderVisuals(this.accumulator / FIXED_DT);
    this.gore.update(dt);
    this.safety();
    this.checkMatch(dt);
  }

  /** Test hook: advance the simulation deterministically without rendering. */
  simulate(seconds, onFrame) {
    const n = Math.round(seconds * 60);
    for (let i = 0; i < n; i++) { onFrame?.(i); this.tick(1 / 60); }
  }

  fixedStep() {
    for (const f of this.fighters) f.step(FIXED_DT);
    this.physics.cacheVelocities();
    this.world.step(this.physics.events);
    this.combat.process(FIXED_DT);
    this.snapshot();
  }

  /** Guard against physics blow-ups: clamp absurd velocities, recover lost bodies. */
  safety() {
    for (const f of [...this.fighters]) {
      let bad = false;
      for (const p of f.partList) {
        const v = p.body.linvel();
        const s = Math.hypot(v.x, v.y, v.z);
        if (!Number.isFinite(s)) { bad = true; break; }
        if (s > 35) p.body.setLinvel({ x: v.x * 35 / s, y: v.y * 35 / s, z: v.z * 35 / s }, true);
        const w = p.body.angvel();
        const ws = Math.hypot(w.x, w.y, w.z);
        if (ws > 60) p.body.setAngvel({ x: w.x * 60 / ws, y: w.y * 60 / ws, z: w.z * 60 / ws }, true);
      }
      if (f.parts.pelvis.p.y < -3 || bad) {
        console.warn('fighter lost, respawning', f.name);
        const opts = { name: f.name, team: f.team, isPlayer: f.isPlayer, position: new THREE.Vector3(0, 0, 0), weapon: Object.keys(WEAPONS).find((k) => WEAPONS[k] === f.weaponDef), colorIndex: f.index };
        const ctrl = f.controller;
        this.removeFighter(f);
        const nf = this.spawn(opts);
        if (nf) { nf.controller = ctrl === this.input ? this.input : new AIController(nf, this, this.settings.difficulty); if (opts.isPlayer) this.player = nf; }
      }
    }
  }

  updateCamera(dt) {
    const p = this.player;
    const cam = this.camera;
    let focus, yaw;
    if (p) {
      focus = p.parts.pelvis.visual.position;
      if (p.alive) yaw = p.yaw;
      else yaw = this.cameraYaw + dt * 0.25;
    } else {
      // attract / spectator: orbit the action
      const fs = this.fighters;
      focus = fs.length ? fs.reduce((a, f) => a.add(f.parts.pelvis.visual.position), new THREE.Vector3()).multiplyScalar(1 / fs.length) : new THREE.Vector3();
      yaw = this.cameraYaw + dt * 0.12;
    }
    let dy = yaw - this.cameraYaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.cameraYaw += dy * (1 - Math.exp(-dt * 5));
    const cy = this.cameraYaw;
    const fx = Math.sin(cy), fz = Math.cos(cy);
    const dist = p ? 2.9 : 5, height = p ? 1.25 : 1.6;
    const side = p ? 0.45 : 0; // over the left shoulder
    const want = new THREE.Vector3(focus.x - fx * dist + fz * side, Math.max(focus.y, 0.6) + height, focus.z - fz * dist - fx * side);
    want.x = clamp(want.x, -ARENA_HALF + 0.3, ARENA_HALF - 0.3);
    want.z = clamp(want.z, -ARENA_HALF + 0.3, ARENA_HALF - 0.3);
    cam.position.lerp(want, 1 - Math.exp(-dt * 7));
    const look = new THREE.Vector3(focus.x + fx * 1.6, Math.max(focus.y, 0.5) + 0.35, focus.z + fz * 1.6);
    this.camLook.lerp(look, 1 - Math.exp(-dt * 9));
    cam.lookAt(this.camLook);
    if (this.shake > 0) {
      cam.position.x += (Math.random() - 0.5) * this.shake;
      cam.position.y += (Math.random() - 0.5) * this.shake;
      this.shake = Math.max(0, this.shake - dt * 0.6);
    }
  }
}

function localStorageGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function localStorageSet(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } }

const game = new Game();
window.__game = game;
game.init().catch((e) => {
  console.error(e);
  document.querySelector('#loading h2').textContent = 'Failed to start: ' + e.message;
});
