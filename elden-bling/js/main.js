// Elden Bling: The Quest for the Last Brain Cell — game bootstrap, loop and gameplay glue.
import * as THREE from 'three';
import { loadSettings, saveSettings, applyPreset, PRESETS, loadGame, saveGame, clearGame } from './settings.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { World, SHRINES, START, ENEMY_SPAWNS, BOSS_SPOTS, zoneAt, ZONES } from './world.js';
import { Player, turnTo } from './player.js';
import { Enemy, Dummy, UnemployedKnight, LordTouchgrass, RegionBoss, NPC, Chicken } from './enemies.js';
import { Effects } from './effects.js';
import { UI } from './ui.js';
import { WEAPONS, ARMOR, CONSUMABLES, DEATH_LINES, TIPS, SOCKS, SOCKRATES, SHOP, SHOP_COUPON, REGION_BOSSES } from './data.js';

const MEDALLIONS_NEEDED = 3;
const DAY_LENGTH = 600; // seconds for a full day/night cycle
import { groundHeight } from './collision.js';
import { makeLoot, makeBrainCell } from './models.js';

const MAX_ACTIVE = 8;
const ACTIVE_RANGE = 48;

class Game {
  constructor() {
    this.settings = loadSettings();
    this.preset = { ...PRESETS[this.settings.preset] };
    this.useShadows = this.settings.shadows;
    this.canvas = document.getElementById('game');
    this.state = 'boot';
    this.needsReload = false;
    if (!this.initRenderer()) return;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, this.preset.viewDist * 1.4 + 10);
    this.audio = new Audio(this.settings);
    this.input = new Input(this.canvas);
    this.input.onKey = (code, e) => this.onKey(code, e);
    this.resetProgress();

    this.world = new World(this);
    this.fx = new Effects(this);
    this.ui = new UI(this);
    this.player = new Player(this);
    this.player.place(START.x, START.z, Math.PI);
    this.loots = [];
    this.coinBag = null;
    this.spawnActors();

    this.camYaw = 0;
    this.camPitch = 0.32;
    this.camDist = 5.2;
    this.camDistCur = 5.2;
    this.shakeAmt = 0;
    this.hitStop = 0;
    this.lockTarget = null;
    this.activeEnemies = [];
    this.activeTimer = 0;
    this.lastT = performance.now();
    this.elapsed = 0;
    this.fpsFrames = 0; this.fpsTime = 0; this.fps = 60;
    this.perfTime = 0; this.perfFrames = 0;
    this.zone = null;

    window.addEventListener('resize', () => this.resize());
    document.addEventListener('pointerlockchange', () => this.onPointerLock());
    this.canvas.addEventListener('click', () => {
      this.audio.init();
      if (this.state === 'playing' && !this.ui.blocking) this.input.requestLock();
    });
    this.resize();
    this.applySettings();
    this.ui.showControlsGuide(this.settings.showControls);
    document.getElementById('loading').classList.add('hidden');
    this.state = 'menu';
    this.ui.showMainMenu(!!loadGame());
    // Any first interaction unlocks audio.
    const unlock = () => { this.audio.init(); this.audio.setMusic(this.state === 'menu' ? 'menu' : this.zoneMusic()); };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    this.renderer.setAnimationLoop(() => this.frame());
  }

  initRenderer() {
    const opts = { canvas: this.canvas, antialias: this.settings.preset === 'medium', powerPreference: 'default', stencil: false };
    try {
      this.renderer = new THREE.WebGLRenderer(opts);
    } catch (e) {
      try {
        // Fallback: no antialiasing, low-power GPU.
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, powerPreference: 'low-power', stencil: false, precision: 'mediump' });
        this.useShadows = false;
      } catch (e2) {
        showFatal('Your browser or device could not start WebGL 2, which this game needs. Try updating your browser (Chrome, Edge or Firefox), turning on "hardware acceleration" in browser settings, or using another computer.');
        return false;
      }
    }
    const r = this.renderer;
    r.outputColorSpace = THREE.SRGBColorSpace;
    // If the GPU is very limited, turn off fancy stuff.
    const caps = r.capabilities;
    if (caps.maxTextureSize < 4096 || caps.maxVertexUniforms < 256) { this.useShadows = false; this.settings.shadows = false; }
    if (this.useShadows) { r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap; }
    this.canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.contextLost = true; this.ui && this.ui.toast('Graphics hiccup! Trying to recover…'); });
    this.canvas.addEventListener('webglcontextrestored', () => { this.contextLost = false; });
    return true;
  }

  resetProgress() {
    this.flags = { shrines: {}, opened: {}, walls: {}, gates: {}, tips: {}, bought: {}, bosses: {}, socks: {}, lastShrine: 's1', socksGiven: 0, medallions: 0, dayT: 0.3 };
    this.stats = { deaths: 0, kills: 0, time: 0, coins: 0 };
  }

  spawnActors() {
    this.enemies = ENEMY_SPAWNS.map(([t, x, z]) => new Enemy(this, t, x, z));
    this.dummy = new Dummy(this, 0, 76);
    this.world.col.addCircle(0, 76, 0.35);
    this.mini = new UnemployedKnight(this, 0, -34);
    this.king = new LordTouchgrass(this, 0, -103.6);
    this.regionBosses = Object.entries(BOSS_SPOTS).map(([id, [x, z]]) => new RegionBoss(this, id, x, z));
    this.allEnemies = [...this.enemies, this.mini, this.king, ...this.regionBosses];
    this.dennis = new NPC(this, 'dennis', -9, 84, 0);
    this.barry = new NPC(this, 'barry', 14, 80.5, 0);
    this.sockrates = new NPC(this, 'sockrates', -8, 66, 0.4);
    this.coupon = new NPC(this, 'coupon', 18, 112, Math.PI);
    this.chicken = new Chicken(this, -51, -38);
    this.npcs = [this.dennis, this.barry, this.sockrates, this.coupon];
    // Lost socks scattered around the world.
    this.sockLoots = SOCKS.map(([x, z], i) => this.spawnLoot({ kind: 'sock', id: i, label: 'Pick up a lost sock', color: [0xff6666, 0x66aaff, 0x66ff88, 0xffdd44, 0xcc77ff][i % 5] }, x, z));

    const W = this.world;
    W.interact({ pos: this.dennis.pos, r: 2.4, label: () => 'Talk to Farmer Dennis', act: () => this.talkDennis() });
    W.interact({ pos: this.barry.pos, r: 2.4, label: () => 'Shop with Bargain Barry', act: () => this.openShop('barry') });
    W.interact({ pos: this.coupon.pos, r: 2.4, label: () => 'Shop with Captain Coupon', act: () => this.openShop('coupon') });
    W.interact({ pos: this.sockrates.pos, r: 2.4, label: () => 'Talk to Sockrates', act: () => this.talkSockrates() });
    W.interact({ pos: this.chicken.pos, r: 1.8, label: () => (this.chicken.carried || this.flags.chickenReturned ? null : 'Pick up the chicken'), act: () => this.pickChicken() });
  }

  // ---------- Settings ----------
  applySettings(key) {
    const s = this.settings;
    if (key === 'shadows') this.needsReload = true;
    if (key === 'muted' || key === 'master' || key === 'music' || key === 'sfx') this.audio.applyVolumes();
    if (key === 'showControls') this.ui.showControlsGuide(s.showControls);
    if (key === 'renderScale' || !key) this.resize();
    if (this.ui) this.ui.syncSettings();
    saveSettings(s);
  }

  setPreset(name) {
    const before = { ...this.preset };
    applyPreset(this.settings, name);
    const p = PRESETS[name];
    this.preset.viewDist = p.viewDist;
    this.preset.pixelCap = p.pixelCap;
    this.camera.far = p.viewDist * 1.4 + 10;
    this.camera.updateProjectionMatrix();
    if (before.deco !== p.deco || before.particles !== p.particles || p.shadows !== this.useShadows || before.grass !== p.grass) this.needsReload = true;
    this.applySettings();
    this.world.atmosphere(this.player.pos.x, this.player.pos.z);
  }

  saveSettingsNow() {
    saveSettings(this.settings);
    if (this.needsReload && this.state === 'menu') location.reload();
  }

  resize() {
    if (!this.renderer) return;
    const w = window.innerWidth, h = window.innerHeight;
    this.viewW = w; this.viewH = h;
    const pr = Math.min(window.devicePixelRatio || 1, this.preset.pixelCap) * this.settings.renderScale;
    this.renderer.setPixelRatio(Math.max(0.35, pr));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ---------- Game flow ----------
  newGame() {
    clearGame();
    this.resetProgress();
    this.startPlaying(true);
  }

  continueGame() {
    const data = loadGame();
    if (!data) return this.newGame();
    this.applySave(data);
    this.startPlaying(false);
  }

  startPlaying(fresh) {
    this.audio.init();
    this.ui.close('main-menu');
    this.ui.showHUD(true);
    this.state = 'playing';
    this.input.enabled = true;
    this.input.requestLock();
    this.zone = null;
    if (fresh) {
      this.player.place(START.x, START.z, Math.PI);
      this.camYaw = 0;
      this.ui.banner('ELDEN BLING', 'The Quest for the Last Brain Cell');
      setTimeout(() => this.showTip('move'), 2500);
    } else {
      const s = this.world.shrines[this.flags.lastShrine] || this.world.shrines.s1;
      this.player.place(s.x, s.z + 2.5, 0);
      this.camYaw = Math.PI;
    }
    this.updateQuest();
  }

  quitToMenu() {
    if (this.state !== 'victory' && this.player.alive) this.save();
    location.reload();
  }

  openMenu(id) {
    this.ui.open(id);
    this.input.clearActions();
    this.input.enabled = false;
    this.releaseLock();
  }

  releaseLock() {
    if (!document.pointerLockElement) return;
    this.releasingLock = true;
    this.input.releaseLock();
  }

  closeMenus() {
    for (const id of ['inventory', 'shrine', 'shop', 'dialogue', 'pause', 'settings', 'controls-screen', 'map']) this.ui.close(id);
    if (this.state === 'paused') this.state = 'playing';
    if (this.state === 'playing') {
      this.input.enabled = true;
      this.input.clearActions();
      this.input.requestLock();
    }
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.openMenu('pause');
  }

  resume() { this.closeMenus(); }

  onPointerLock() {
    if (document.pointerLockElement) return;
    if (this.releasingLock) { this.releasingLock = false; return; }
    // Browser released the lock (usually Escape): pause.
    if (this.state === 'playing' && !this.ui.blocking) this.pause();
  }

  onKey(code, e) {
    if (code === 'KeyK' && !e.repeat) {
      this.settings.muted = !this.settings.muted;
      this.applySettings('muted');
      if (this.state === 'playing') this.ui.toast(this.settings.muted ? 'Sound muted (K)' : 'Sound on (K)');
      return true;
    }
    if (code === 'KeyM' && !e.repeat && this.state === 'playing') {
      if (this.ui.isOpen('map')) this.closeMenus();
      else if (!this.ui.blocking && this.player.alive) { this.ui.renderMap(); this.openMenu('map'); }
      return true;
    }
    if (code === 'Escape') {
      if (this.ui.isOpen('settings')) { this.ui.closeSettings(); return true; }
      if (this.ui.isOpen('controls-screen')) { this.ui.close('controls-screen'); return true; }
      if (this.ui.isOpen('credits')) { this.ui.close('credits'); return true; }
      if (this.state === 'cutscene') { this.skipCutscene(); return true; }
      if (this.state === 'paused') { this.resume(); return true; }
      if (this.state === 'playing') { if (this.ui.blocking) this.closeMenus(); else this.pause(); return true; }
      return true;
    }
    if (code === 'Tab' && !e.repeat) {
      if (this.state === 'playing') {
        if (this.ui.isOpen('inventory')) this.closeMenus();
        else if (!this.ui.blocking && this.player.alive) { this.ui.renderInventory(); this.openMenu('inventory'); }
      }
      return true;
    }
    if (code === 'KeyH' && !e.repeat && this.state === 'playing') {
      this.settings.showControls = !this.settings.showControls;
      this.applySettings('showControls');
      return true;
    }
    if ((code === 'KeyE' || code === 'Space' || code === 'Enter') && this.state === 'cutscene' && !e.repeat) { this.skipCutscene(); return true; }
    if ((code === 'KeyE' || code === 'Enter') && this.ui.isOpen('dialogue') && !e.repeat) {
      const b = document.querySelector('#dlg-choices button');
      if (b && document.querySelectorAll('#dlg-choices button').length === 1) b.click();
      return true;
    }
    return false;
  }

  // ---------- Main loop ----------
  frame() {
    const now = performance.now();
    const dt = Math.min((now - this.lastT) / 1000, 0.05);
    this.lastT = now;
    this.elapsed += dt;
    this.trackFps(dt);
    if (this.contextLost) return;

    if (this.state === 'menu' || this.state === 'boot') {
      this.menuCamera(dt);
      this.world.update(dt, this.elapsed);
      this.renderer.render(this.scene, this.camera);
      return;
    }

    const running = this.state === 'playing' && !this.ui.blocking || this.state === 'dead' || this.state === 'cutscene' || this.state === 'victory';
    if (running) {
      if (this.state === 'playing') { this.stats.time += dt; this.flags.dayT = (this.flags.dayT + dt / DAY_LENGTH) % 1; }
      let gdt = dt;
      if (this.hitStop > 0) { this.hitStop -= dt; gdt = dt * 0.08; }
      this.update(gdt, dt);
    }
    if (this.state !== 'playing' || this.ui.blocking) this.ui.prompt(null);
    this.ui.updateHUD(dt);
    const hint = this.state === 'playing' && !this.ui.blocking && !this.input.locked;
    if (hint !== this.hintShown) { this.hintShown = hint; document.getElementById('click-to-play').classList.toggle('hidden', !hint); }
    this.renderer.render(this.scene, this.camera);
  }

  update(dt, realDt) {
    const p = this.player;
    const playing = this.state === 'playing';
    // Camera input.
    const [mdx, mdy] = this.input.takeMouse();
    if (playing || this.state === 'dead') {
      const sens = 0.0025 * this.settings.sensitivity;
      this.camYaw -= mdx * sens;
      this.camPitch += mdy * sens * 0.8 * (this.settings.invertY ? -1 : 1);
      if (this.input.down('ArrowLeft')) this.camYaw += realDt * 2.2;
      if (this.input.down('ArrowRight')) this.camYaw -= realDt * 2.2;
      if (this.input.down('ArrowUp')) this.camPitch -= realDt * 1.2;
      if (this.input.down('ArrowDown')) this.camPitch += realDt * 1.2;
      this.camPitch = Math.max(-0.3, Math.min(1.15, this.camPitch));
    }

    // Lock-on.
    if (playing && this.input.consume('lock')) this.toggleLock();
    if (this.lockTarget && (this.lockTarget.dead || this.lockTarget.hidden || this.lockTarget.distTo(p.pos) > 26 || !p.alive)) this.lockTarget = null;

    // Pick the nearest enemies to simulate.
    this.activeTimer -= realDt;
    if (this.activeTimer <= 0) { this.activeTimer = 0.25; this.refreshActive(); }

    if (playing && p.alive) {
      p.update(dt, this.input, this.camYaw);
      this.handleInteract();
      if (this.input.consume('item1')) this.useItem('garlic');
      if (this.input.consume('item2')) this.useItem('dignity');
      if (this.input.consume('item3')) this.useItem('pepper');
      if (this.input.consume('item4')) this.useItem('coconut');
      if (this.input.consume('item5')) this.useItem('bomb');
    } else if (!p.alive) p.update(dt, this.input, this.camYaw);
    else { p.stateT += dt; p.animate(dt, 0); }

    for (const e of this.activeEnemies) e.update(dt);
    // Simple separation so enemies don't stack.
    const A = this.activeEnemies;
    for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) {
      const a = A[i], b = A[j];
      if (a.dead || b.dead) continue;
      const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, rr = a.radius + b.radius;
      const d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && d2 > 1e-6) {
        const d = Math.sqrt(d2), push = (rr - d) * 0.5;
        a.pos.x -= (dx / d) * push; a.pos.z -= (dz / d) * push;
        b.pos.x += (dx / d) * push; b.pos.z += (dz / d) * push;
      }
    }
    this.dummy.update(dt);
    for (const n of this.npcs) n.update(dt);
    this.chicken.update(dt);
    this.updateLoots(dt);
    this.world.update(dt, this.elapsed);
    this.fx.update(dt);

    if (playing) this.checkZones();
    if (this.state === 'cutscene') this.cutsceneCamera(realDt);
    else this.updateCamera(realDt);

    // Shadow camera follows the player.
    if (this.useShadows) {
      this.world.sun.target.position.copy(p.pos);
      this.world.sun.position.set(p.pos.x + 22, p.pos.y + 45, p.pos.z + 14);
    }
    // Lock-on reticle.
    if (this.lockTarget) {
      const t = this.lockTarget;
      this.ui.lockReticle(this.fx.project(new THREE.Vector3(t.pos.x, t.pos.y + t.height * 0.6, t.pos.z)));
    } else this.ui.lockReticle(null);
  }

  refreshActive() {
    const p = this.player.pos;
    const vd = this.preset.viewDist;
    this.world.cull(p.x, p.z);
    for (const n of this.npcs) n.root.visible = Math.hypot(n.pos.x - p.x, n.pos.z - p.z) < vd * 0.8;
    const cand = [];
    for (const e of this.allEnemies) {
      const d = e.distTo(p);
      // Render culling for far away enemies.
      if (!e.hidden) { const v = d < vd * 0.75 || e === this.boss; e.root.visible = v; if (e.blob) e.blob.visible = v; }
      if (e.hidden) continue;
      if (e === this.boss || (d < ACTIVE_RANGE && !(e.dead && e.deadT > 3))) cand.push([d, e]);
    }
    cand.sort((a, b) => a[0] - b[0]);
    this.activeEnemies = cand.slice(0, MAX_ACTIVE).map((c) => c[1]);
    if (this.boss && !this.activeEnemies.includes(this.boss)) this.activeEnemies.push(this.boss);
  }

  toggleLock() {
    if (this.lockTarget) { this.lockTarget = null; return; }
    const p = this.player;
    let best = null, bestScore = 1e9;
    const fx = -Math.sin(this.camYaw), fz = -Math.cos(this.camYaw);
    for (const e of this.activeEnemies) {
      if (e.dead || e.hidden || (e === this.king && !e.engaged)) continue;
      const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z, d = Math.hypot(dx, dz);
      if (d > 22) continue;
      const dot = (dx * fx + dz * fz) / (d || 1);
      const score = d * (1.6 - dot);
      if (score < bestScore) { bestScore = score; best = e; }
    }
    this.lockTarget = best;
    if (!best) this.ui.toast('Nothing to lock on to.');
  }

  softTarget(pos, yaw, range) {
    let best = null, bestD = range;
    for (const e of this.activeEnemies) {
      if (e.dead || e.hidden) continue;
      const dx = e.pos.x - pos.x, dz = e.pos.z - pos.z;
      const d = Math.hypot(dx, dz) - e.radius;
      if (d > bestD) continue;
      let a = Math.atan2(dx, dz) - yaw;
      while (a > Math.PI) a -= Math.PI * 2;
      while (a < -Math.PI) a += Math.PI * 2;
      if (Math.abs(a) < 0.9) { best = e; bestD = d; }
    }
    if (!best && Math.hypot(this.dummy.pos.x - pos.x, this.dummy.pos.z - pos.z) < range) {
      const a = Math.atan2(this.dummy.pos.x - pos.x, this.dummy.pos.z - pos.z) - yaw;
      if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.9) best = this.dummy;
    }
    return best;
  }

  // ---------- Camera ----------
  updateCamera(dt) {
    const p = this.player;
    if (this.lockTarget) {
      const t = this.lockTarget;
      const want = Math.atan2(-(t.pos.x - p.pos.x), -(t.pos.z - p.pos.z));
      this.camYaw = turnTo(this.camYaw, want, dt * 6);
      const big = t.height > 3;
      this.camPitch += ((big ? 0.22 : 0.3) - this.camPitch) * Math.min(1, dt * 3);
    }
    const tx = p.pos.x, ty = p.pos.y + 1.55 + (this.lockTarget && this.lockTarget.height > 3 ? 0.6 : 0), tz = p.pos.z;
    const cp = Math.cos(this.camPitch), sp = Math.sin(this.camPitch);
    const want = this.boss === this.king ? 6.4 : this.camDist;
    const ox = Math.sin(this.camYaw) * cp, oy = sp, oz = Math.cos(this.camYaw) * cp;
    const bx = tx + ox * want, by = ty + oy * want, bz = tz + oz * want;
    let hit = this.world.col.cameraCast(tx, ty, tz, bx, by, bz);
    // Don't let big enemies (frogs, bosses) swallow the camera.
    for (const e of this.activeEnemies) {
      if (e.dead || e.radius < 0.8 || (e === this.king && e.sitting)) continue;
      const t = segCircle(tx, tz, bx - tx, bz - tz, e.pos.x, e.pos.z, e.radius + 0.5);
      if (t !== null && t < hit && ty + (by - ty) * t < e.pos.y + e.height) hit = Math.max(0.25, t);
    }
    const target = Math.max(0.9, want * hit - 0.15);
    // Snap in fast when blocked, ease out slowly.
    this.camDistCur += (target - this.camDistCur) * Math.min(1, dt * (target < this.camDistCur ? 18 : 4));
    const d = this.camDistCur;
    let cx = tx + ox * d, cy = ty + oy * d, cz = tz + oz * d;
    const gy = groundHeight(cx, cz) + 0.35;
    if (cy < gy) cy = gy;
    if (this.shakeAmt > 0) {
      this.shakeAmt = Math.max(0, this.shakeAmt - dt * 1.8);
      const s = this.shakeAmt * 0.35;
      cx += (Math.random() - 0.5) * s; cy += (Math.random() - 0.5) * s; cz += (Math.random() - 0.5) * s;
    }
    this.camera.position.set(cx, cy, cz);
    this.camera.lookAt(tx, ty, tz);
  }

  shake(a) { this.shakeAmt = Math.min(1, this.shakeAmt + a); }

  menuCamera() {
    if (!this.menuCulled) { this.menuCulled = true; this.world.cull(0, 66); }
    const t = this.elapsed * 0.05;
    this.camera.position.set(Math.sin(t) * 26, 9 + Math.sin(t * 2) * 1.5, 70 + Math.cos(t) * 26);
    this.camera.lookAt(0, 2, 62);
    this.world.atmosphere(0, 70);
  }

  // ---------- Zones, quests, tips ----------
  zoneMusic() {
    if (this.boss === this.king) return 'boss';
    if (this.boss === this.mini || (this.boss && this.boss.def.optional)) return 'miniboss';
    if (this.boss) return 'regionboss';
    if (this.state === 'victory') return 'victory';
    const z = this.zone || 'grass';
    return z === 'arena' ? 'backyard' : z;
  }

  checkZones() {
    const p = this.player.pos;
    this.world.atmosphere(p.x, p.z, this.nightAmount());
    const z = zoneAt(p.x, p.z);
    if (z !== this.zone) {
      const first = this.zone === null;
      this.zone = z;
      if (z !== 'arena' && !first) this.ui.banner(ZONES[z]);
      if (z === 'swamp' && !this.flags.enteredSwamp) { this.flags.enteredSwamp = true; this.updateQuest(); }
      if ((z === 'desert' || z === 'peaks' || z === 'beach') && !this.flags.exploredOut) { this.flags.exploredOut = true; this.showTip('medallion'); }
      if ((z === 'backyard' || z === 'arena') && !this.flags.enteredYard) { this.flags.enteredYard = true; this.updateQuest(); }
      if (!this.boss) this.audio.setMusic(this.zoneMusic());
    }
    // Proximity tips.
    if (!this.flags.tips.attack && this.dummy.distTo(p) < 9) this.showTip('attack');
    if (!this.flags.tips.shrine && Math.hypot(p.x - SHRINES[0].x, p.z - SHRINES[0].z) < 8 && this.flags.tips.attack) this.showTip('shrine');
    if (!this.flags.tips.heal && this.player.hp < this.player.maxHp * 0.6) this.showTip('heal');
    if (!this.flags.tips.map && this.flags.tips.shrine && p.z < 74) this.showTip('map');
  }

  showTip(key) {
    if (this.flags.tips[key]) return;
    this.flags.tips[key] = true;
    this.ui.tip(TIPS[key]);
  }

  updateQuest() {
    const f = this.flags;
    let main;
    const med = f.medallions || 0;
    const medTxt = `Bling Medallions: <b>${med} / ${MEDALLIONS_NEEDED}</b>`;
    if (!f.rested) main = 'Rest at the glowing <b>Touch Grass Shrine</b> nearby';
    else if (med < MEDALLIONS_NEEDED) {
      const left = [];
      if (!f.miniDead) left.push('the Unemployed Knight (swamp)');
      for (const b of this.regionBosses) if (REGION_BOSSES[b.bossId].medallion && !f.bosses[b.bossId]) left.push(`${REGION_BOSSES[b.bossId].name} (${{ pharaoh: 'desert, west', snowmom: 'peaks, east', sogbeard: 'beach, south' }[b.bossId]})`);
      main = `${medTxt}. Defeat bosses to earn them: ${left.join(', ')}. <span class="dim">(M for map)</span>`;
    }
    else if (!f.miniDead) main = 'Defeat <b>the Unemployed Knight</b> to open the Backyard Gate';
    else if (!f.bossDead) main = `${medTxt}. The fog will part: defeat <b>Lord Touchgrass</b> in the King's Backyard`;
    else if (!f.brainCell) main = 'Claim <b>the Last Brain Cell</b>';
    else main = 'You did it! Now go touch some actual grass.';
    let side = '';
    if (!f.talkedDennis) side = 'Optional: talk to <b>Farmer Dennis</b>';
    else if (!f.chickenReturned) side = f.hasChicken ? 'Return <b>Nugget</b> to Farmer Dennis' : 'Find <b>Nugget the chicken</b> (last seen in the swamp\'s south-west)';
    const found = Object.keys(f.socks || {}).length;
    if (f.metSockrates && f.socksGiven < SOCKS.length) side += `${side ? '<br>' : ''}Lost socks for Sockrates: <b>${found} / ${SOCKS.length}</b>`;
    if (!this.regionBosses.find((b) => b.bossId === 'gary').dead && f.rested && !f.bosses.gary) side += `${side ? '<br>' : ''}<span class="dim">Rumour: a giant goblin cooks in the eastern field</span>`;
    this.ui.quest(main, side);
  }

  // ---------- Interaction ----------
  handleInteract() {
    const p = this.player.pos;
    let best = null, bestD = 1e9;
    for (const it of this.world.interactables) {
      if (!it.enabled) continue;
      const d = Math.hypot(p.x - it.pos.x, p.z - it.pos.z);
      if (d < it.r && d < bestD) {
        const label = it.label();
        if (label) { best = { it, label }; bestD = d; }
      }
    }
    for (const l of this.loots) {
      const d = Math.hypot(p.x - l.x, p.z - l.z);
      if (d < 1.8 && d < bestD) { best = { it: { act: () => this.pickLoot(l) }, label: l.label }; bestD = d; }
    }
    this.ui.prompt(best && this.player.state === 'move' ? best.label : null);
    if (this.input.consume('interact') && best && this.player.state === 'move') best.it.act();
  }

  // ---------- Combat glue ----------
  playerHitCheck(pl, a) {
    const w = pl.weapon;
    const reach = w.reach;
    const half = (w.arc * Math.PI / 180) / 2;
    const fx = Math.sin(pl.yaw), fz = Math.cos(pl.yaw);
    const targets = this.activeEnemies.concat(this.dummy);
    for (const e of targets) {
      if (e.dead || e.hidden || a.hits.has(e)) continue;
      if (e === this.king && !e.engaged) continue;
      const dx = e.pos.x - pl.pos.x, dz = e.pos.z - pl.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > reach + e.radius) continue;
      const ang = Math.acos(Math.max(-1, Math.min(1, (dx * fx + dz * fz) / (d || 1))));
      if (d > e.radius + 0.3 && ang > half) continue;
      a.hits.add(e);
      let dmg = w.dmg * (1 + pl.stats.str * 0.08) * a.mult * (0.92 + Math.random() * 0.16);
      if (pl.buffs.pepper > 0) dmg *= 1.35;
      dmg *= 1 + pl.dmgBonus;
      // Backstab-ish bonus when hitting from behind.
      const toPlayer = Math.atan2(-dx, -dz);
      let rel = toPlayer - e.yaw;
      rel = Math.atan2(Math.sin(rel), Math.cos(rel));
      const behind = Math.abs(rel) > 2.3 && !e.isDummy;
      if (behind) dmg *= 1.25;
      e.takeDamage(dmg, pl.pos.x, pl.pos.z, a.kind === 'heavy', a.stagger);
      if (w.lifesteal && !e.isDummy) pl.hp = Math.min(pl.maxHp, pl.hp + dmg * w.lifesteal);
      if (w.frost && !e.isDummy) { e.slowT = 3; this.fx.burst(e.pos.x, e.pos.y + 1, e.pos.z, 0x99ddff, 6, { speed: 2 }); }
      this.hitStop = a.kind === 'heavy' ? 0.09 : 0.05;
      this.audio.play(w.squeak ? 'squeak' : w.slap ? 'slap' : a.kind === 'heavy' ? 'heavyhit' : 'hit');
      if (this.player.equip.weapon === 'pan') this.audio.play('bonk');
      if (a.kind === 'heavy') this.shake(0.15);
    }
    // Illusory walls.
    for (const wl of this.world.illusory) {
      if (wl.broken || a.hits.has(wl)) continue;
      const b = wl.box;
      const cx = Math.max(b.minX, Math.min(pl.pos.x, b.maxX)), cz = Math.max(b.minZ, Math.min(pl.pos.z, b.maxZ));
      const dx = cx - pl.pos.x, dz = cz - pl.pos.z, d = Math.hypot(dx, dz);
      if (d > reach) continue;
      if (d > 0.3 && (dx * fx + dz * fz) / d < 0.4) continue;
      a.hits.add(wl);
      this.world.breakWall(wl);
      this.flags.walls[wl.id] = true;
    }
  }

  damagePlayer(dmg, fromX, fromZ, opts = {}) {
    const p = this.player;
    if (!p.alive || this.state !== 'playing') return;
    if (p.rolling) {
      if (!p.dodgedThisRoll) {
        p.dodgedThisRoll = true;
        p.sta = Math.min(p.maxSta, p.sta + 15);
        this.stats.dodges = (this.stats.dodges || 0) + 1;
        if (this.stats.dodges <= 3 || Math.random() < 0.25) this.fx.number(new THREE.Vector3(p.pos.x, p.pos.y + 2.2, p.pos.z), 'Nice dodge!', 'dodge');
        this.audio.play('perfect');
      }
      return;
    }
    const amt = Math.max(1, Math.round(dmg * (1 - p.defense)));
    p.hp -= amt;
    if (opts.poison && !p.poisonResist) p.poison = Math.max(p.poison, opts.poison);
    if (opts.chill) p.chill = Math.max(p.chill, opts.chill);
    this.fx.number(new THREE.Vector3(p.pos.x, p.pos.y + 2, p.pos.z), amt, 'player');
    this.fx.burst(p.pos.x, p.pos.y + 1.1, p.pos.z, 0xff5544, 8, { speed: 3 });
    this.ui.flashDamage();
    this.audio.play('hurt');
    this.shake(Math.min(0.5, amt / 60));
    if (p.hp <= 0) { this.killPlayer(); return; }
    const dx = p.pos.x - fromX, dz = p.pos.z - fromZ, d = Math.hypot(dx, dz) || 1;
    p.hurt(dx / d, dz / d, opts.knock ?? 4);
    if (!this.flags.tips.dodge) this.showTip('dodge');
  }

  killPlayer() {
    const p = this.player;
    if (!p.alive) return;
    p.alive = false;
    p.hp = 0;
    p.state = 'dead';
    p.stateT = 0;
    this.stats.deaths++;
    this.lockTarget = null;
    this.audio.play('death');
    // Drop coins where you died.
    if (this.coinBag) { this.removeLoot(this.coinBag); this.coinBag = null; }
    if (p.coins > 0) {
      this.coinBag = this.spawnLoot({ kind: 'bag', amount: p.coins, label: `Recover your coins (${p.coins})`, color: 0xffcc22 }, p.pos.x, p.pos.z);
      p.coins = 0;
    }
    this.state = 'dead';
    setTimeout(() => {
      if (this.state !== 'dead') return;
      this.ui.death(true, DEATH_LINES[Math.floor(Math.random() * DEATH_LINES.length)]);
      this.releaseLock();
    }, 900);
    this.deathTimer = setTimeout(() => { if (this.state === 'dead') this.respawn(); }, 3600);
  }

  respawn() {
    if (this.state !== 'dead') return;
    clearTimeout(this.deathTimer);
    this.ui.death(false);
    if (this.boss) this.endBossFight(this.boss, false);
    if (!this.mini.dead) this.mini.reset();
    if (!this.king.dead) this.king.reset();
    for (const b of this.regionBosses) if (!b.dead) b.reset();
    if (!this.flags.bossDead) this.world.closeFog();
    this.fx.clearHostile();
    this.fx.clearBubbles();
    const s = this.world.shrines[this.flags.lastShrine] || this.world.shrines.s1;
    const p = this.player;
    p.alive = true;
    p.reset();
    p.flasks = p.maxFlasks;
    p.place(s.x, s.z + 2.5, 0);
    this.camYaw = Math.PI;
    this.respawnEnemies();
    this.state = 'playing';
    this.input.enabled = true;
    this.input.clearActions();
    this.input.requestLock();
    this.audio.setMusic(this.zoneMusic());
    if (this.coinBag) this.ui.toast('Your coins are waiting where you fell. Go get them!');
  }

  respawnEnemies() {
    for (const e of this.enemies) e.reset();
    this.refreshActive();
  }

  onEnemyKilled(e) {
    const p = this.player;
    this.stats.kills++;
    if (this.lockTarget === e) this.lockTarget = null;
    const xp = Math.round(e.def.xp * (1 + p.xpBonus));
    p.stats.xp += xp;
    const [lo, hi] = e.def.coins;
    const coins = Math.round((lo + Math.random() * (hi - lo)) * (1 + p.coinBonus));
    p.coins += coins;
    this.stats.coins += coins;
    this.fx.number(new THREE.Vector3(e.pos.x, e.pos.y + e.height + 0.4, e.pos.z), `+${xp} XP`, 'xp');
    this.audio.play('coins');
    if (p.stats.xp >= p.xpNeed && !this.levelHinted) { this.levelHinted = true; this.ui.toast('<b>Level up ready!</b> Rest at a Touch Grass Shrine to spend XP.', 'gold'); }
    const r = e.def.rare;
    if (r && Math.random() < r.chance && !this.owns(r.kind, r.id)) {
      const name = r.kind === 'weapon' ? WEAPONS[r.id].name : ARMOR[r.id].name;
      this.spawnLoot({ kind: r.kind, id: r.id, label: 'Pick up ' + name, color: 0xcc66ff }, e.pos.x, e.pos.z);
      this.ui.toast('A <b>rare item</b> dropped!', 'rare');
    }
  }

  owns(kind, id) {
    const p = this.player;
    if (kind === 'weapon') return p.inv.weapons.includes(id);
    if (kind === 'armor') return p.inv.armor.includes(id);
    return false;
  }

  onPlayerHeal() {
    this.stats.heals = (this.stats.heals || 0) + 1;
    if (this.boss === this.king || (this.boss && this.boss.bossId)) this.boss.onPlayerHeal();
  }

  onDummyHit() {
    this.dummyHits = (this.dummyHits || 0) + 1;
    if (this.dummyHits === 4) this.showTip('dodge');
  }

  // ---------- Bosses ----------
  startBossFight(boss) {
    this.boss = boss;
    this.ui.bossBar(boss);
    this.audio.setMusic(this.zoneMusic());
    this.audio.play('bossIntro');
    this.showTip('lock');
    this.refreshActive();
  }

  endBossFight(boss, won) {
    if (this.boss === boss) { this.boss = null; this.ui.bossBar(null); }
    if (!won) { this.audio.setMusic(this.zoneMusic()); return; }
    if (boss.bossId) {
      const cfg = REGION_BOSSES[boss.bossId];
      this.flags.bosses[boss.bossId] = true;
      this.spawnLoot({ kind: 'weapon', id: cfg.drop, label: 'Pick up ' + WEAPONS[cfg.drop].name, color: 0xcc66ff }, boss.pos.x, boss.pos.z);
      setTimeout(() => {
        this.ui.banner('GREAT ENEMY FELLED', cfg.name);
        if (cfg.medallion) this.gainMedallion();
        this.audio.setMusic(this.zoneMusic());
        this.updateQuest();
        this.save();
      }, 2500);
    } else if (boss === this.mini) {
      this.flags.miniDead = true;
      setTimeout(() => this.gainMedallion(), 3600);
      this.spawnLoot({ kind: 'weapon', id: 'severance', label: 'Pick up Severance Package', color: 0xcc66ff }, boss.pos.x, boss.pos.z);
      setTimeout(() => {
        this.world.openGate('yardgate');
        this.audio.play('gate');
        this.ui.banner('ENEMY FELLED', 'The Unemployed Knight has retired');
        this.ui.toast('The Backyard Gate creaks open.');
        this.audio.setMusic(this.zoneMusic());
        this.updateQuest();
        this.save();
      }, 1800);
    } else if (boss === this.king) {
      this.flags.bossDead = true;
      this.audio.setMusic(null);
      this.ui.banner('LORD TOUCHGRASS DEFEATED', 'He finally went inside');
      this.audio.play('victory');
      setTimeout(() => {
        this.world.openGate('fog');
        this.brain = this.spawnLoot({ kind: 'brain', label: 'Claim the Last Brain Cell', color: 0xff88cc }, this.king.pos.x, this.king.pos.z);
        this.updateQuest();
        this.save();
      }, 4200);
    }
  }

  gainMedallion() {
    this.flags.medallions = (this.flags.medallions || 0) + 1;
    const n = this.flags.medallions;
    this.audio.play('levelup');
    this.ui.toast(`Obtained a <b>Bling Medallion</b>! (${n} / ${MEDALLIONS_NEEDED}${n > MEDALLIONS_NEEDED ? ', extra bling' : ''})`, 'gold');
    if (n === MEDALLIONS_NEEDED) setTimeout(() => this.ui.toast('The fog in the King\'s Backyard is shimmering. Lord Touchgrass awaits.', 'gold'), 1500);
    this.updateQuest();
    this.save();
  }

  enterFog() {
    if (this.flags.bossDead || this.state !== 'playing') return;
    const p = this.player;
    if (p.pos.z < -66.9) { this.ui.toast('The fog won\'t let you leave. Lord Touchgrass insists you stay for dinner.'); return; }
    if ((this.flags.medallions || 0) < MEDALLIONS_NEEDED) {
      this.ui.dialogue('The Fog', `The fog has ${MEDALLIONS_NEEDED} medallion-shaped holes in it. You have <b>${this.flags.medallions || 0}</b> Bling Medallions. Defeat the great enemies of the kingdom to earn more: the Unemployed Knight, Pharaoh Pyramid-Scheme in the desert (west), the Abominable Snowmom in the peaks (east), and Captain Sogbeard on the beach (south).`);
      return;
    }
    this.world.closeFog();
    p.place(0, -70, Math.PI);
    p.state = 'move';
    p.stateT = 0;
    this.camYaw = 0;
    this.lockTarget = null;
    this.king.reset();
    if (!this.flags.kingIntro) this.startCutscene();
    else {
      this.ui.bossTitle(this.king.def.name, this.king.def.title);
      this.king.say('Back again? My lawn remembers you.', 3);
      this.king.begin();
      this.startBossFight(this.king);
    }
  }

  startCutscene() {
    this.state = 'cutscene';
    this.cut = { t: 0, line: -1 };
    this.input.clearActions();
    this.audio.setMusic(null);
    this.audio.play('bossIntro');
    this.ui.prompt(null);
    document.getElementById('skip-hint').classList.remove('hidden');
  }

  cutsceneCamera(dt) {
    const c = this.cut;
    c.t += dt;
    const lines = this.king.def.intro;
    const idx = Math.min(lines.length - 1, Math.floor(c.t / 2.6));
    if (idx !== c.line) {
      c.line = idx;
      this.ui.subtitle(this.king.def.name, lines[idx], 2.7);
      this.king.say(lines[idx], 2.6);
      if (idx === lines.length - 1) { this.ui.bossTitle(this.king.def.name, this.king.def.title); this.shake(0.5); }
    }
    const k = Math.min(1, c.t / 10);
    this.camera.position.set(Math.sin(c.t * 0.15) * 3, 4.5 + k * 1.5, -84 - k * 6);
    this.camera.lookAt(0, 5.5, -103);
    if (c.t > lines.length * 2.6 + 0.8) this.skipCutscene();
  }

  skipCutscene() {
    if (this.state !== 'cutscene') return;
    this.flags.kingIntro = true;
    this.state = 'playing';
    document.getElementById('skip-hint').classList.add('hidden');
    this.king.begin();
    this.startBossFight(this.king);
    this.input.clearActions();
  }

  // ---------- Shrines, chests, loot ----------
  rest(shrine) {
    const p = this.player;
    const first = !this.flags.shrines[shrine.id];
    this.flags.shrines[shrine.id] = true;
    this.flags.lastShrine = shrine.id;
    if (first) this.ui.banner('SHRINE DISCOVERED', shrine.name);
    p.hp = p.maxHp;
    p.flasks = p.maxFlasks;
    p.poison = 0;
    p.sta = p.maxSta;
    this.respawnEnemies();
    this.audio.play('shrine');
    this.fx.rise(shrine.x, groundHeight(shrine.x, shrine.z) + 0.5, shrine.z, 0x88ff88, 30, 1.2);
    if (!this.flags.rested) { this.flags.rested = true; this.updateQuest(); }
    this.save();
    this.ui.renderShrine(shrine);
    this.openMenu('shrine');
  }

  levelUp(stat) {
    const p = this.player;
    if (p.stats.xp < p.xpNeed) return;
    p.stats.xp -= p.xpNeed;
    p.stats.level++;
    p.stats[stat]++;
    p.hp = p.maxHp;
    p.sta = p.maxSta;
    this.levelHinted = false;
    this.audio.play('levelup');
    this.fx.rise(p.pos.x, p.pos.y, p.pos.z, 0xffdd66, 20);
    this.ui.toast(`<b>Level ${p.stats.level}!</b> ${{ vig: 'Vigor', end: 'Endurance', str: 'Strength' }[stat]} increased.`, 'gold');
    this.save();
  }

  travel(s) {
    this.closeMenus();
    this.player.place(s.x, s.z + 2.5, 0);
    this.camYaw = Math.PI;
    this.flags.lastShrine = s.id;
    this.fx.rise(s.x, groundHeight(s.x, s.z), s.z + 2.5, 0x88ff88, 20);
    this.refreshActive();
    this.zone = null;
    this.ui.toast('You travelled to ' + s.name + '. Your legs are confused.');
  }

  openChest(ch) {
    if (ch.opened) return;
    ch.opened = true;
    this.flags.opened[ch.id] = true;
    this.audio.play('chest');
    const lid = ch.mesh.userData.lid;
    let t = 0;
    this.world.animated.push((_, dt) => { t += dt; lid.rotation.x = -Math.min(1, t * 2) * 1.9; return t > 0.6; });
    this.fx.burst(ch.x, groundHeight(ch.x, ch.z) + 0.8, ch.z, 0xffdd55, 20, { speed: 3, up: 4 });
    for (const [kind, id, n] of ch.loot) this.grant(kind, id, n);
  }

  grant(kind, id, n = 1) {
    const p = this.player;
    if (kind === 'coins') { p.coins += id; this.stats.coins += id; this.ui.toast(`+${id} coins`); this.audio.play('coins'); return; }
    if (kind === 'weapon') {
      if (!p.inv.weapons.includes(id)) p.inv.weapons.push(id);
      this.ui.toast(`Obtained <b>${WEAPONS[id].name}</b>! <span class="dim">(Tab to equip)</span>`, 'rare');
    } else if (kind === 'armor') {
      if (!p.inv.armor.includes(id)) p.inv.armor.push(id);
      this.ui.toast(`Obtained <b>${ARMOR[id].name}</b>! <span class="dim">(Tab to equip)</span>`, 'rare');
    } else if (kind === 'consumable') {
      p.inv.items[id] = (p.inv.items[id] || 0) + n;
      this.ui.toast(`Obtained <b>${CONSUMABLES[id].name}</b> ×${n}`);
    } else if (kind === 'flask') {
      p.maxFlasks++; p.flasks++;
      this.ui.toast('Max flasks increased to <b>' + p.maxFlasks + '</b>!', 'gold');
    }
    this.audio.play('pickup');
  }

  spawnLoot(data, x, z) {
    const mesh = data.kind === 'brain' ? makeBrainCell() : makeLoot(data.color);
    mesh.position.set(x, groundHeight(x, z), z);
    this.scene.add(mesh);
    const l = { ...data, x, z, mesh };
    this.loots.push(l);
    return l;
  }

  removeLoot(l) {
    this.scene.remove(l.mesh);
    this.loots = this.loots.filter((o) => o !== l);
  }

  updateLoots(dt) {
    for (const l of this.loots) {
      l.mesh.rotation.y += dt * 1.5;
      l.mesh.children[0].position.y = 0.5 + Math.sin(this.elapsed * 3) * 0.1 + (l.kind === 'brain' ? 0.7 : 0);
      const dx = Math.abs(l.x - this.player.pos.x), dz = Math.abs(l.z - this.player.pos.z);
      const near = dx < 40 && dz < 40;
      l.mesh.visible = dx < 60 && dz < 60;
      if (!l.mesh.visible) continue;
      if (near && Math.random() < dt * 4) this.fx.rise(l.x, groundHeight(l.x, l.z) + 0.3, l.z, l.color || 0xffee66, 1, 0.3);
    }
  }

  pickLoot(l) {
    this.removeLoot(l);
    if (l.kind === 'sock') {
      this.flags.socks[l.id] = true;
      const n = Object.keys(this.flags.socks).length;
      this.audio.play('pickup');
      this.ui.toast(`Found a <b>lost sock</b>! (${n} / ${SOCKS.length})${this.flags.metSockrates ? '' : ' Somebody in the grasslands must be missing these.'}`, 'gold');
      this.updateQuest();
      return;
    }
    if (l.kind === 'bag') {
      this.player.coins += l.amount;
      this.coinBag = null;
      this.ui.toast(`Recovered <b>${l.amount}</b> coins. And roughly 1% of your dignity.`, 'gold');
      this.audio.play('coins');
    } else if (l.kind === 'brain') {
      this.claimBrainCell();
    } else this.grant(l.kind, l.id);
  }

  claimBrainCell() {
    this.flags.brainCell = true;
    this.updateQuest();
    this.save();
    this.state = 'victory';
    this.audio.setMusic('victory');
    this.audio.play('levelup');
    this.input.enabled = false;
    this.releaseLock();
    const s = this.stats, p = this.player;
    const mins = Math.floor(s.time / 60), secs = Math.floor(s.time % 60);
    this.ui.victory(`
      <div class="stat-row"><span>Time</span><b>${mins}m ${String(secs).padStart(2, '0')}s</b></div>
      <div class="stat-row"><span>Level</span><b>${p.stats.level}</b></div>
      <div class="stat-row"><span>Enemies bonked</span><b>${s.kills}</b></div>
      <div class="stat-row"><span>Deaths</span><b>${s.deaths}</b> ${s.deaths === 0 ? '(show-off)' : ''}</div>
      <div class="stat-row"><span>Coins earned</span><b>${s.coins}</b></div>
      <div class="stat-row"><span>Nugget returned</span><b>${this.flags.chickenReturned ? 'Yes, hero' : 'No (Dennis is still crying)'}</b></div>
      <div class="stat-row"><span>Brain cells</span><b>1 (new record)</b></div>`);
  }

  keepExploring() {
    this.ui.close('victory');
    this.state = 'playing';
    this.input.enabled = true;
    this.input.requestLock();
    this.audio.setMusic(this.zoneMusic());
  }

  tryGate(id) {
    const p = this.player.pos;
    const W = this.world;
    if (id === 'shortcut') {
      if (p.z < 30.5) { W.openGate('shortcut'); this.flags.gates.shortcut = true; this.audio.play('gate'); this.ui.toast('Shortcut opened! It was bolted from this side the whole time. Classic.'); this.save(); }
      else this.ui.toast('Locked from the other side. Gates are rude like that.');
    } else if (id === 'doggy') {
      if (p.z < -44.5) { W.openGate('doggy'); this.flags.gates.doggy = true; this.audio.play('gate'); this.ui.toast('You unlatched the doggy door. A shortcut! Nobody saw you crawl through. Probably.'); this.save(); }
      else this.ui.toast('A doggy door, latched from the other side. Woof.');
    } else if (id === 'yardgate') {
      this.ui.toast(this.mini.dead ? 'The gate is open.' : 'Locked. The sad man guarding it holds the only key (and a grudge).');
    }
  }

  useItem(id) {
    const p = this.player;
    if (!p.alive || this.state !== 'playing') return;
    if (!(p.inv.items[id] > 0)) { this.ui.toast(`No ${CONSUMABLES[id].name} left.`); return; }
    if (p.state !== 'move') return;
    p.inv.items[id]--;
    const v = new THREE.Vector3(p.pos.x, p.pos.y + 2.2, p.pos.z);
    if (id === 'garlic') { p.hp = Math.min(p.maxHp, p.hp + 45); this.fx.number(v, '+45', 'heal'); this.fx.rise(p.pos.x, p.pos.y, p.pos.z, 0xffee88, 12); this.onPlayerHeal(); this.audio.play('drink'); }
    if (id === 'dignity') { p.hp = Math.min(p.maxHp, p.hp + 25); p.buffs.dignity = 30; this.ui.toast('Dignity restored to 100%! (It was 2%.)'); this.fx.rise(p.pos.x, p.pos.y, p.pos.z, 0x88ccff, 14); this.onPlayerHeal(); this.audio.play('drink'); }
    if (id === 'coconut') { p.hp = Math.min(p.maxHp, p.hp + 70); p.poison = 0; this.fx.number(v, '+70', 'heal'); this.fx.rise(p.pos.x, p.pos.y, p.pos.z, 0xffffff, 14); this.onPlayerHeal(); this.audio.play('drink'); }
    if (id === 'bomb') {
      // Lob it ahead (at the lock target if there is one).
      const t = this.lockTarget;
      const tx = t ? t.pos.x : p.pos.x + Math.sin(p.yaw) * 7, tz = t ? t.pos.z : p.pos.z + Math.cos(p.yaw) * 7;
      const from = new THREE.Vector3(p.pos.x, p.pos.y + 1.6, p.pos.z);
      const T = 0.8, ty = groundHeight(tx, tz);
      const vel = new THREE.Vector3((tx - from.x) / T, (ty - from.y + 0.5 * 9.8 * T * T) / T, (tz - from.z) / T);
      this.fx.spawnProjectile('bomb', from, vel, { dmg: 70, splash: 3.2, friendly: true, life: 3 });
      this.audio.play('swing');
    }
    if (id === 'pepper') { p.buffs.pepper = 30; this.ui.toast('Your mouth is on fire. So is your sword arm. +35% damage!'); this.fx.rise(p.pos.x, p.pos.y, p.pos.z, 0xff5522, 16); this.audio.play('levelup'); }
    if (this.ui.isOpen('inventory')) this.ui.renderInventory();
  }

  // ---------- NPCs ----------
  talkDennis() {
    const f = this.flags;
    const d = (t, c) => this.ui.dialogue('Farmer Dennis', t, c);
    if (f.chickenReturned) return d('Nugget says thanks. Well, she said "bawk". Same thing. Also: Lord Touchgrass hates it when people heal in front of him. So... heal a lot. Just maybe not right in front of his face.');
    if (f.hasChicken) {
      f.chickenReturned = true;
      this.chicken.carried = false;
      this.chicken.home.set(-12, 0, 84.5);
      this.chicken.pos.set(-12, groundHeight(-12, 84.5), 84.5);
      this.audio.play('chicken');
      d('NUGGET! You found her! She\'s covered in swamp and she has never looked better. Here, take this spare flask, and this... rubber chicken. Nugget doesn\'t need it anymore. She has ME.', [{ label: 'Accept reward', fn: () => { this.grant('flask'); this.grant('weapon', 'chicken'); this.updateQuest(); this.save(); } }]);
      return;
    }
    if (!f.talkedDennis) {
      f.talkedDennis = true;
      this.updateQuest();
      return d('Help? HELP? I can\'t think about helping anyone while Nugget is out there! My chicken! My beautiful, idiot chicken! She ran into the Cursed Swamp, south-west corner, behind the dead trees. Find her and MAYBE I\'ll help you.', [{ label: 'I\'ll find your chicken' }, { label: 'Is the chicken... okay?', fn: () => setTimeout(() => d('She\'s a chicken in a cursed swamp. She\'s THRIVING. That\'s the problem.'), 50) }]);
    }
    d('Still no Nugget? Then I\'m not helping. I\'m busy staring sadly at the horizon. South-west swamp. Dead trees. Go.');
  }

  pickChicken() {
    if (this.chicken.carried || this.flags.chickenReturned) return;
    this.chicken.carried = true;
    this.flags.hasChicken = true;
    this.audio.play('chicken');
    this.ui.toast(this.flags.talkedDennis ? 'You found <b>Nugget</b>! She immediately climbs onto your head. Return her to Dennis.' : 'You found a chicken. She now lives on your head. Someone in the village might want her back.', 'gold');
    this.updateQuest();
  }

  openShop(who = 'barry') {
    if (who === 'barry' && !this.flags.metBarry) { this.flags.metBarry = true; this.ui.toast('Barry: "Welcome to Barry\'s Bargain Bin! Everything is handcrafted. By me. Today. In a hurry."'); }
    if (who === 'coupon' && !this.flags.metCoupon) { this.flags.metCoupon = true; this.ui.toast('Captain Coupon: "Arr! Everything\'s 0% off! That\'s a pirate discount!"'); }
    this.shopWho = who;
    this.ui.renderShop(who === 'coupon' ? SHOP_COUPON : SHOP, who === 'coupon' ? "Captain Coupon's Coconut Cove" : "Barry's Bargain Bin");
    this.openMenu('shop');
  }

  talkSockrates() {
    const f = this.flags;
    const d = (t, c) => this.ui.dialogue('Sockrates', t, c);
    if (!f.metSockrates) { f.metSockrates = true; this.updateQuest(); return d(SOCKRATES.intro); }
    const found = Object.keys(f.socks).length;
    const before = f.socksGiven || 0;
    f.socksGiven = found;
    const rewards = [];
    if (before < 3 && found >= 3) rewards.push(['consumable', 'coconut', 3]);
    if (before < 6 && found >= 6) rewards.push(['flask']);
    if (before < SOCKS.length && found >= SOCKS.length) rewards.push(['weapon', 'sockpuppet']);
    let text = SOCKRATES.progress(found);
    if (found > before) text = `Ah! ${found - before} sock${found - before > 1 ? 's' : ''}! The sock that returns is wiser than the sock that left. ` + text;
    if (rewards.length) text += ' <br><br>For your trouble, take this. Rewards come at 3, 6 and 10 socks.';
    else if (found < SOCKS.length) text += ' <br><br>Rewards come at 3, 6 and 10 socks.';
    else text += ' <br><br>You have found every sock. There is nothing left to teach you. Go, and be warm of foot.';
    d(text, rewards.length ? [{ label: 'Accept reward', fn: () => { for (const r of rewards) this.grant(...r); this.updateQuest(); this.save(); } }] : null);
  }

  explodeAt(x, z, r, dmg) {
    this.audio.play('stomp');
    this.shake(0.25);
    const y = groundHeight(x, z);
    this.fx.burst(x, y + 0.5, z, 0x66ccff, 26, { speed: 7, up: 4 });
    this.fx.burst(x, y + 0.5, z, 0xffffff, 14, { speed: 5, glow: false });
    for (const e of this.activeEnemies) {
      if (e.dead || e.hidden || (e === this.king && !e.engaged)) continue;
      if (Math.hypot(e.pos.x - x, e.pos.z - z) < r + e.radius) e.takeDamage(dmg, x, z, true, true);
    }
    for (const wl of this.world.illusory) {
      if (!wl.broken && Math.hypot(wl.x - x, wl.z - z) < r + wl.r) { this.world.breakWall(wl); this.flags.walls[wl.id] = true; }
    }
  }

  // 0 at midday, 1 at midnight.
  nightAmount() {
    const a = Math.cos(this.flags.dayT * Math.PI * 2); // dayT 0 = midnight, 0.5 = noon
    return Math.max(0, Math.min(1, a * 0.9 + 0.2));
  }

  buy(item) {
    const p = this.player;
    if (p.coins < item.price) return;
    p.coins -= item.price;
    if (item.once) this.flags.bought[item.id] = true;
    this.grant(item.kind, item.id, 1);
    this.audio.play('coins');
    this.save();
  }

  // ---------- Save / load ----------
  save() {
    const p = this.player;
    saveGame({
      v: 1,
      flags: this.flags,
      stats: this.stats,
      player: { stats: p.stats, coins: p.coins, inv: p.inv, equip: p.equip, maxFlasks: p.maxFlasks },
      coinBag: this.coinBag ? { x: this.coinBag.x, z: this.coinBag.z, amount: this.coinBag.amount } : null,
    });
  }

  applySave(d) {
    try {
      this.flags = { ...this.flags, ...d.flags };
      for (const k of ['shrines', 'opened', 'walls', 'gates', 'tips', 'bought', 'bosses', 'socks']) this.flags[k] = this.flags[k] || {};
      if (typeof this.flags.dayT !== 'number') this.flags.dayT = 0.3;
      if (typeof this.flags.medallions !== 'number') this.flags.medallions = this.flags.miniDead ? 1 : 0;
      for (const id in this.flags.socks) { const l = this.sockLoots[id]; if (l) this.removeLoot(l); }
      for (const b of this.regionBosses) if (this.flags.bosses[b.bossId]) { b.dead = true; b.hidden = true; b.root.visible = false; if (b.blob) b.blob.visible = false; }
      this.stats = { ...this.stats, ...d.stats };
      const p = this.player;
      Object.assign(p.stats, d.player.stats);
      p.coins = d.player.coins || 0;
      p.inv = d.player.inv;
      p.inv.items = p.inv.items || {};
      p.equip = d.player.equip;
      p.maxFlasks = d.player.maxFlasks || 3;
      p.flasks = p.maxFlasks;
      p.refreshEquip();
      p.reset();
      const W = this.world;
      for (const id in this.flags.opened) {
        const ch = W.chests[id];
        if (ch) { ch.opened = true; ch.mesh.userData.lid.rotation.x = -1.9; }
      }
      for (const w of W.illusory) if (this.flags.walls[w.id]) W.breakWall(w, true);
      for (const id in this.flags.gates) W.openGate(id, true);
      if (this.flags.miniDead) { this.mini.dead = true; this.mini.hidden = true; this.mini.root.visible = false; if (this.mini.blob) this.mini.blob.visible = false; W.openGate('yardgate', true); }
      if (this.flags.bossDead) {
        this.king.dead = true; this.king.hidden = true; this.king.root.visible = false;
        if (this.king.blob) this.king.blob.visible = false;
        W.openGate('fog', true);
        if (!this.flags.brainCell) this.brain = this.spawnLoot({ kind: 'brain', label: 'Claim the Last Brain Cell', color: 0xff88cc }, 0, -96);
      }
      if (this.flags.hasChicken && !this.flags.chickenReturned) this.chicken.carried = true;
      if (this.flags.chickenReturned) { this.chicken.home.set(-12, 0, 84.5); this.chicken.pos.set(-12, groundHeight(-12, 84.5), 84.5); }
      if (d.coinBag) this.coinBag = this.spawnLoot({ kind: 'bag', amount: d.coinBag.amount, label: `Recover your coins (${d.coinBag.amount})`, color: 0xffcc22 }, d.coinBag.x, d.coinBag.z);
    } catch (e) {
      console.warn('Save data was corrupted; starting fresh.', e);
      clearGame();
    }
  }

  // ---------- Performance ----------
  trackFps(dt) {
    this.fpsFrames++; this.fpsTime += dt;
    if (this.fpsTime >= 0.5) {
      this.fps = Math.round(this.fpsFrames / this.fpsTime);
      this.fpsFrames = 0; this.fpsTime = 0;
      if (this.ui) this.ui.setFps(this.settings.showFps, this.fps);
    }
    // Auto-lower resolution if the game is struggling.
    if (this.state !== 'playing' || !this.settings.autoAdjust || document.hidden) { this.perfTime = 0; this.perfFrames = 0; return; }
    this.perfTime += dt; this.perfFrames++;
    if (this.perfTime > 4) {
      const fps = this.perfFrames / this.perfTime;
      this.perfTime = 0; this.perfFrames = 0;
      if (fps < 24 && this.settings.renderScale > 0.5) {
        this.settings.renderScale = Math.max(0.5, Math.round((this.settings.renderScale - 0.15) * 100) / 100);
        this.applySettings('renderScale');
        this.ui.toast(`Low FPS detected: render resolution lowered to ${Math.round(this.settings.renderScale * 100)}%. Change it in Settings.`);
      }
    }
  }
}

function segCircle(ax, az, dx, dz, cx, cz, r) {
  const fx = ax - cx, fz = az - cz;
  const a = dx * dx + dz * dz;
  if (a < 1e-9) return null;
  const b = 2 * (fx * dx + fz * dz), c = fx * fx + fz * fz - r * r;
  if (c < 0) return null; // player is already inside: ignore
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t >= 0 && t <= 1 ? t : null;
}

function showFatal(msg) {
  document.getElementById('loading').classList.add('hidden');
  const el = document.getElementById('fatal');
  el.querySelector('p').textContent = msg;
  el.classList.remove('hidden');
}

window.addEventListener('error', (e) => console.error('Game error:', e.message));

if (location.protocol === 'file:') {
  showFatal('This game must be opened through a local web server (browsers block JavaScript modules on file:// pages). See README.md: run "python3 -m http.server 8000" in the elden-bling folder, then open http://localhost:8000');
} else {
  try {
    window.game = new Game();
  } catch (e) {
    console.error(e);
    showFatal('Something went wrong while starting the game: ' + e.message);
  }
}
