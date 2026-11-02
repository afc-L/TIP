import * as THREE from 'three';
import { World, LANDMARKS } from './world.js';
import { buildAll } from './structures.js';
import { Environment } from './environment.js';
import { AudioEngine } from './audio.js';
import { Input } from './input.js';
import { Player } from './player.js';
import { Equipment, MAG_SIZE } from './equipment.js';
import { Animals } from './animals.js';
import { Creature } from './creature.js';
import { Events } from './events.js';
import { Story } from './story.js';
import { Inventory } from './inventory.js';
import { UI } from './ui.js';
import { ENDINGS, TIPS } from './content.js';
import { Fire, LightPool, Puffs } from './effects.js';
import { clamp, damp, rand } from './util.js';
import { binds, K, ACTIONS, keyName } from './keybinds.js';

const SAVE_KEY = 'thehunt_save_v1';
const SETTINGS_KEY = 'thehunt_settings_v1';
const $ = (id) => document.getElementById(id);

const DEFAULT_SETTINGS = {
  sens: 1, invert: false, fov: 72, master: 0.8, music: 0.7, sfx: 1,
  quality: 'medium', scale: 0.8, shadows: true, viewDistance: 150, voice: true, grain: true, fps: false,
};

function loadSettings() {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; }
  catch (e) { return { ...DEFAULT_SETTINGS }; }
}

class Game {
  constructor() {
    this.settings = loadSettings();
    this.state = 'loading';
    this.time = 0;
    this.playTime = 0;
    this.ended = false;
    this.radioBusy = false;
    this.debug = new URLSearchParams(location.search).has('debug');
    this.godMode = false;

    const canvas = $('game');
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: this.settings.quality !== 'low', powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(this.settings.scale);
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = this.settings.shadows && this.settings.quality !== 'low';
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.autoClear = false;
    if (this.settings.quality === 'low') this.settings.shadows = this.renderer.shadowMap.enabled;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(this.settings.fov, window.innerWidth / window.innerHeight, 0.08, 480);
    this.camera.rotation.order = 'YXZ';
    window.addEventListener('resize', () => this.onResize());

    this.input = new Input(canvas);
    this.audio = new AudioEngine();
    this.ui = new UI(this);
    this.inv = new Inventory(this);
    this.frame = 0;
    this.fpsAcc = 0; this.fpsN = 0;
  }

  onResize() {
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }

  async init() {
    const progress = async (p, text) => { this.ui.setLoading(p, text); await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0))); };
    await progress(0.02, 'Preparing');
    this.env = new Environment(this.scene, this.renderer, this.settings);
    this.world = new World(this.scene, this.settings);
    await this.world.generate(progress);
    await progress(0.7, 'Building cabins');
    this.structures = buildAll(this.world, this.scene);
    await progress(0.8, 'Releasing the deer');
    this.player = new Player(this);
    this.equip = new Equipment(this);
    this.animals = new Animals(this);
    this.creature = new Creature(this);
    this.events = new Events(this);
    this.story = new Story(this);
    this.puffs = new Puffs(this.scene);
    this.lights = new LightPool(this.scene, 2);
    // campfire, station lamp, hollow fire, helicopter light
    this.campfire = new Fire(this.scene, new THREE.Vector3(this.structures.camp.fireWorld.x, this.structures.camp.fireWorld.y - 0.25, this.structures.camp.fireWorld.z), 1);
    this.lights.add(this.campfire.light);
    const lw = this.structures.station.lampWorld;
    this.stationLamp = this.lights.add({ pos: new THREE.Vector3(lw.x, lw.y, lw.z), color: new THREE.Color(0xffd9a0), intensity: 0, range: 16, active: false });
    const hw = this.structures.hollow.heartWorld;
    this.hollowFire = new Fire(this.scene, new THREE.Vector3(hw.x, this.world.heightAt(hw.x, hw.z) + 0.5, hw.z - 2.2), 3.2);
    this.lights.add(this.hollowFire.light);
    this.heliSrc = this.lights.add({ pos: new THREE.Vector3(), color: new THREE.Color(0xe8f0ff), intensity: 0, range: 50, active: false });
    await progress(0.9, 'Compiling shaders');
    // warm up shaders so the first frame of play doesn't hitch
    this.setupMenuScene();
    this.renderer.compile(this.scene, this.camera);
    this.renderer.shadowMap.needsUpdate = true;
    this.renderFrame();
    await progress(1, 'Ready');
    this.bindUI();
    this.ui.show('loading', false);
    this.toMenu();
    this.last = performance.now();
    requestAnimationFrame((t) => this.loop(t));
    if (this.debug) window.game = this;
  }

  // ------------------------------------------------------------ menus

  bindUI() {
    const click = (id, fn) => $(id).addEventListener('click', () => { this.audio.init(); this.audio.uiClick(); fn(); });
    click('btnNew', () => {
      if (this.hasSave()) this.ui.confirm('Start a new hunt? Your saved progress will be lost.', () => this.newGame());
      else this.newGame();
    });
    click('btnContinue', () => this.continueGame());
    click('btnHow', () => this.openSub('howto'));
    click('btnHow2', () => this.openSub('howto'));
    click('btnSettings', () => this.openSub('settings'));
    click('btnSettings2', () => this.openSub('settings'));
    click('btnHowBack', () => this.closeSub('howto'));
    click('btnSetBack', () => this.closeSub('settings'));
    click('btnBindReset', () => { binds.reset(); this.input.capture = null; this.renderBinds(); this.ui.toast('Controls reset to default', 2); });
    click('btnResume', () => this.resume());
    click('btnQuit', () => { this.save(); this.toMenu(); });
    click('btnEndMenu', () => this.toMenu());
    click('btnEndLoad', () => this.continueGame());
    $('clickToPlay').addEventListener('click', () => { this.ui.show('clickToPlay', false); this.input.lock(); });
    this.canvas.addEventListener('click', () => { if (this.state === 'play' && !this.input.locked && !this.ui.modal) this.input.lock(); });
    this.input.onLockChange = (locked) => {
      if (locked) { this.ui.show('clickToPlay', false); return; }
      if (this.state === 'play' && !this.ui.modal) this.pause();
    };
    this.input.onKey = (code) => this.onKey(code);
    this.bindSettings();
  }

  openSub(id) {
    this.subReturn = this.state === 'paused' ? 'pause' : 'menu';
    this.ui.show(this.subReturn, false);
    this.ui.show(id, true);
    if (id === 'settings') { this.syncSettingsUI(); this.renderBinds(); }
    if (id === 'howto') this.renderHowKeys();
  }

  renderBinds() {
    const list = $('bindList');
    let html = '', group = '';
    for (const a of ACTIONS) {
      if (a.group !== group) { group = a.group; html += `<div class="grp">${group}</div>`; }
      const b = binds.map[a.id];
      html += `<span>${a.label}</span>` + [0, 1].map((slot) => `<button type="button" id="bind-${a.id}-${slot}" data-a="${a.id}" data-s="${slot}" class="${b[slot] ? '' : 'empty'}" aria-label="${a.label} ${slot ? 'backup' : 'main'} key">${b[slot] ? keyName(b[slot]) : '—'}</button>`).join('');
    }
    list.innerHTML = html;
    list.querySelectorAll('button').forEach((btn) => btn.addEventListener('click', () => {
      this.audio.uiClick();
      list.querySelectorAll('.listening').forEach((x) => x.classList.remove('listening'));
      btn.classList.add('listening');
      btn.textContent = 'press…';
      this.input.capture = (code) => {
        const action = btn.dataset.a, slot = +btn.dataset.s;
        if (code === 'Escape') { this.renderBinds(); return; }
        if (code === 'Backspace' || code === 'Delete') binds.set(action, slot, null);
        else {
          const prev = ACTIONS.find((x) => x.id !== action && binds.matches(x.id, code));
          binds.set(action, slot, code);
          if (prev) this.ui.toast(`${keyName(code)} moved from "${prev.label}" to "${ACTIONS.find((x) => x.id === action).label}"`, 3);
        }
        this.renderBinds();
      };
    }));
  }

  renderHowKeys() {
    const row = (k, d) => `<tr><td>${k}</td><td>${d}</td></tr>`;
    const two = (id) => binds.codes(id).map(keyName).join(' / ') || '—';
    $('howKeys').innerHTML = [
      row(`${K('forward')} ${K('left')} ${K('back')} ${K('right')}`, 'Move'),
      row('Mouse', 'Look'),
      ...ACTIONS.filter((a) => !['forward', 'back', 'left', 'right'].includes(a.id)).map((a) => row(two(a.id), a.label)),
      row('Wheel', 'Switch rifle / binoculars / radio'),
      row('Esc', 'Pause'),
    ].join('');
  }

  closeSub(id) {
    this.input.capture = null;
    this.ui.show(id, false);
    this.ui.show(this.subReturn, true);
  }

  bindSettings() {
    const s = this.settings;
    const bindRange = (id, key, fmt) => {
      const el = $(id);
      el.addEventListener('input', () => { s[key] = parseFloat(el.value); this.applySettings(); fmt && ($('val' + id.slice(3)).textContent = fmt(s[key])); });
    };
    bindRange('setSens', 'sens', (v) => v.toFixed(2));
    bindRange('setFov', 'fov', (v) => v + '°');
    bindRange('setMaster', 'master', (v) => Math.round(v * 100) + '%');
    bindRange('setMusic', 'music', (v) => Math.round(v * 100) + '%');
    bindRange('setSfx', 'sfx', (v) => Math.round(v * 100) + '%');
    bindRange('setView', 'viewDistance', (v) => v + ' m');
    const bindCheck = (id, key) => $(id).addEventListener('change', () => { s[key] = $(id).checked; this.applySettings(); });
    bindCheck('setInvert', 'invert'); bindCheck('setShadows', 'shadows'); bindCheck('setVoice', 'voice'); bindCheck('setGrain', 'grain'); bindCheck('setFps', 'fps');
    $('setQuality').addEventListener('change', () => { s.quality = $('setQuality').value; this.applySettings(); });
    $('setScale').addEventListener('change', () => { s.scale = parseFloat($('setScale').value); this.applySettings(); });
  }

  syncSettingsUI() {
    const s = this.settings;
    $('setSens').value = s.sens; $('valSens').textContent = s.sens.toFixed(2);
    $('setFov').value = s.fov; $('valFov').textContent = s.fov + '°';
    $('setMaster').value = s.master; $('valMaster').textContent = Math.round(s.master * 100) + '%';
    $('setMusic').value = s.music; $('valMusic').textContent = Math.round(s.music * 100) + '%';
    $('setSfx').value = s.sfx; $('valSfx').textContent = Math.round(s.sfx * 100) + '%';
    $('setView').value = s.viewDistance; $('valView').textContent = s.viewDistance + ' m';
    $('setInvert').checked = s.invert; $('setShadows').checked = s.shadows; $('setVoice').checked = s.voice; $('setGrain').checked = s.grain; $('setFps').checked = s.fps;
    $('setQuality').value = s.quality;
    $('setScale').value = String(s.scale);
    if (!$('setScale').value) $('setScale').value = '0.8';
  }

  applySettings() {
    const s = this.settings;
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) { /* storage blocked */ }
    this.renderer.setPixelRatio(s.scale);
    this.onResize();
    this.audio.vol.master = s.master; this.audio.vol.music = s.music; this.audio.vol.sfx = s.sfx;
    this.audio.applyVolumes();
    this.ui.show('fps', s.fps);
    // shadow toggles at runtime (renderer-level; light-level needs no recompile when map disabled)
    const sh = s.shadows && s.quality !== 'low';
    if (this.renderer.shadowMap.enabled !== sh) {
      this.renderer.shadowMap.enabled = sh;
      this.scene.traverse((o) => { if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.needsUpdate = true; }); } });
    }
    this.env.sun.castShadow = sh;
    this.equip?.setShadows(s);
  }

  setupMenuScene() {
    const c = this.structures.camp.fireWorld;
    this.menuCam = { x: c.x - 9, z: c.z + 11, t: 0 };
    this.env.hours = 20.1;
    this.env.setWeather('mist', true);
    this.campfire.setLit(true);
    this.structures.camp.tent.visible = true;
  }

  toMenu() {
    this.state = 'menu';
    this.input.unlock();
    this.ui.closeModal();
    for (const id of ['hud', 'pause', 'ending', 'settings', 'howto', 'clickToPlay']) this.ui.show(id, false);
    this.ui.show('menu', true);
    $('btnContinue').disabled = !this.hasSave();
    this.setupMenuScene();
    this.creature.hide();
    this.animals?.reset();
    this.events?.reset();
    this.audio.silence = 0;
    // a figure stands far back in the trees behind the camp
    const c = this.structures.camp.fireWorld;
    this.creature.placeAt(c.x + 14, c.z - 24, this.menuCam.x, this.menuCam.z);
    this.creature.pose = 'stand';
    this.creature.state = 'menu';
    this.creature.animate(0.016);
    this.creature.eyeMat.opacity = 0.8;
  }

  newGame() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
    this.resetWorldState();
    const seed = (Math.random() * 1e9) | 0;
    this.inv.reset();
    this.equip.mag = MAG_SIZE;
    this.env.hours = 7.5;
    this.env.day = 1;
    this.env.setWeather(rand() < 0.5 ? 'mist' : 'clear', true);
    const th = LANDMARKS.trailhead;
    this.player.teleport(th.x - 2, th.z - 4, Math.atan2(-(LANDMARKS.camp.x - th.x), -(LANDMARKS.camp.z - th.z)));
    this.story.newGame(seed);
    this.ui.markers = [];
    this.ui.explored.fill(0);
    this.playTime = 0;
    this.startPlay();
    this.tutorial = { step: 0, t: 0 };
    setTimeout(() => this.ui.toast('Blackpine State Forest. Your camp spot is just up the road.', 5), 1200);
    setTimeout(() => this.ui.toast(`${K('forward')}${K('left')}${K('back')}${K('right')} move · Mouse look · ${K('sprint')} sprint · ${K('crouch')} crouch · ${K('interact')} interact`, 6), 4000);
  }

  resetWorldState() {
    this.ended = false;
    this.creature.reset();
    this.animals.reset();
    this.events.reset();
    this.campfire.setLit(false);
    this.structures.camp.tent.visible = false;
    this.setStationPower(false);
    this.setHollowFire(false);
    this.stopHelicopter();
    for (const d of this.world.doors) { d.open = false; d.ang = 0; d.pivot.rotation.y = 0; d.box.off = false; }
    const st = this.player.stats;
    Object.assign(st, { health: 100, hunger: 85, stamina: 100, fear: 0, battery: 100 });
    this.player.dead = false;
    this.player.climb = null;
    this.player.crouch = false;
    this.equip.flashOn = false;
    this.equip.current = 'rifle';
    this.equip.reloadT = 0;
    this.env.darknessBoost = 0;
    this.audio.silence = 0;
  }

  startPlay() {
    for (const id of ['menu', 'pause', 'ending', 'settings', 'howto']) this.ui.show(id, false);
    this.ui.show('hud', true);
    this.state = 'play';
    this.audio.init();
    this.applySettings();
    this.ui.objectiveUpdated();
    this.ui.mapDirty = true;
    this.input.lock();
    setTimeout(() => { if (this.state === 'play' && !this.input.locked && !this.ui.modal) this.ui.show('clickToPlay', true); }, 600);
  }

  pause() {
    if (this.state !== 'play') return;
    this.state = 'paused';
    this.ui.show('pause', true);
    const tip = TIPS[Math.floor(Math.random() * TIPS.length)];
    $('pauseInfo').textContent = `DAY ${this.env.day} · SCORE ${this.animals.score} · TIP: ${tip.toUpperCase()}`;
  }

  resume() {
    this.ui.show('pause', false);
    this.state = 'play';
    this.input.lock();
    setTimeout(() => { if (this.state === 'play' && !this.input.locked && !this.ui.modal) this.ui.show('clickToPlay', true); }, 400);
  }

  confirm(text, fn) { this.ui.confirm(text, fn); }

  onKey(code) {
    if (code === 'Escape') {
      if (this.ui.modal) { this.ui.closeModal(); return; }
      if (this.state === 'paused') { this.resume(); return; }
      if (['settings', 'howto'].some((id) => !$(id).classList.contains('hidden'))) { this.closeSub(!$('settings').classList.contains('hidden') ? 'settings' : 'howto'); return; }
    }
    if (this.state !== 'play') return;
    const is = (a) => binds.matches(a, code);
    if (is('inventory')) { this.ui.openModal('inventory'); return; }
    if (is('map')) { this.ui.openModal('map'); return; }
    if (this.ui.modal === 'doc' && (is('interact') || code === 'Space')) { this.ui.closeModal(); return; }
    if (this.ui.modal) return;
    if (is('interact') && this.focus) { this.focus.action(); return; }
    if (is('interact')) {
      const c = this.animals.nearestCarcass(this.player.pos.x, this.player.pos.z);
      if (c) this.harvest(c);
    }
    if (is('eat')) this.inv.eatBest();
    if (is('medkit')) this.inv.use('medkit');
    if (this.debug) {
      if (code === 'F9') { this.godMode = !this.godMode; this.ui.toast('God mode ' + this.godMode); }
      if (code === 'F8') { this.env.hours = (this.env.hours + 3) % 24; }
      if (code === 'F7') { this.creature.cooldown = 0; }
    }
  }

  harvest(a) {
    this.ui.fade(0.6, () => this.animals.harvest(a));
    this.audio.footstep('mud', 1);
  }

  // ------------------------------------------------------------ world hooks

  isSafeZone(x, z, margin = 0) {
    if (!this.campfire.lit) return false;
    const c = this.structures.camp.fireWorld;
    return Math.hypot(x - c.x, z - c.z) < 13 + margin;
  }

  distToCamp() { const c = this.structures.camp.fireWorld; return Math.hypot(this.player.pos.x - c.x, this.player.pos.z - c.z); }

  isUnderRoof(p) {
    for (const k of ['station', 'harlan', 'miller', 'relay']) {
      const s = this.structures[k];
      if (Math.hypot(p.x - s.x, p.z - s.z) < 5) return true;
    }
    return false;
  }

  lightCampfire() {
    this.campfire.setLit(true);
    this.fireSound?.stop();
    this.fireSound = this.audio.loop('fire', this.structures.camp.fireWorld);
  }

  extinguishCampfire() {
    if (!this.campfire.lit) return;
    this.campfire.setLit(false);
    this.fireSound?.stop();
    this.fireSound = null;
    this.story.flags.fireOut = true;
  }

  setStationPower(on) {
    this.stationLamp.active = on;
    this.stationLamp.intensity = on ? 9 : 0;
    this.structures.station.lampMesh.material.color.set(on ? 0xfff0c0 : 0x222222);
    if (on && !this.genSound) this.genSound = this.audio.loop('generator', this.structures.station.extra.generator);
    if (!on && this.genSound) { this.genSound.stop(); this.genSound = null; }
  }

  setHollowFire(on, burnedOut = false) {
    this.hollowFire.setLit(on);
    if (on) this.hollowSound = this.audio.loop('fire', this.structures.hollow.heartWorld);
    else { this.hollowSound?.stop(); this.hollowSound = null; }
    if (burnedOut) this.structures.hollow.group.children.forEach((m) => { if (m.material?.color) { m.material = m.material.clone(); m.material.color?.multiplyScalar(0.25); } });
  }

  startHelicopter() {
    const st = this.structures.station;
    const p = st.toWorld(0, 0, 18);
    this.heli = { t: 0, x: p.x, z: p.z, y: this.world.heightAt(p.x, p.z) };
    this.heliSound = this.audio.loop('heli', { x: p.x + 200, y: this.heli.y + 60, z: p.z });
    this.heliSound.setGain(0.9);
    this.heliSrc.active = true;
    this.story.addInteract({ id: 'heli', pos: { x: p.x, y: this.heli.y, z: p.z }, r: 9, label: () => 'Signal the helicopter', action: () => this.ending('rescue') });
    this.heliLanded = true;
  }

  stopHelicopter() {
    this.heliSound?.stop(); this.heliSound = null; this.heli = null; this.heliLanded = false;
    if (this.heliSrc) { this.heliSrc.active = false; this.heliSrc.intensity = 0; }
  }

  toggleDoor(d, open = !d.open) {
    if (d.open === open) return;
    d.open = open;
    if (open) d.box.off = true; // walkable as soon as it starts to swing
    this.audio.door(d.pos, open);
  }

  updateDoors(dt) {
    for (const d of this.world.doors) {
      const target = d.open ? d.swing : 0;
      d.ang = damp(d.ang, target, 7, dt);
      if (Math.abs(d.ang - target) < 0.002) d.ang = target;
      d.pivot.rotation.y = d.ang;
      if (!d.open && d.ang === 0) d.box.off = false;
    }
  }

  climb(tower, up) {
    const p = this.player;
    if (up) {
      const from = p.pos.clone();
      const to = new THREE.Vector3(tower.ladderTop.x, tower.platformY, tower.ladderTop.z);
      p.startClimb(from, to);
    } else {
      const from = p.pos.clone();
      const b = tower.ladderBottom;
      p.startClimb(from, new THREE.Vector3(b.x, this.world.heightAt(b.x, b.z), b.z));
    }
  }

  speak(text, tape) {
    if (!this.settings.voice || !window.speechSynthesis) return;
    const clean = text.replace(/\*[^*]*\*/g, ' ').replace(/\.\.\./g, ', ').trim();
    if (clean.length < 3) return;
    try {
      const u = new SpeechSynthesisUtterance(clean);
      u.rate = 0.88; u.pitch = tape ? 0.7 : 0.55; u.volume = 0.55 * this.settings.master * this.settings.sfx;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch (e) { /* no speech available */ }
  }

  /** Hitscan bullet: world geometry, then animals and the creature. */
  onShot(o, d) {
    const max = 450;
    const wall = this.world.raycast(o.x, o.y, o.z, d.x, d.y, d.z, max, { stepLen: 0.6 });
    const ah = this.animals.rayHit(o, d, wall);
    const ch = this.creature.rayHit(o, d, wall);
    if (ch && (!ah || ch.dist < ah.dist)) {
      this.creature.shot();
    } else if (ah) {
      this.animals.hit(ah.animal, ah.zone, ah.dist);
      const hp = o.clone().addScaledVector(d, ah.dist);
      this.puffs.spawn(hp, 0x5a1008, 0.25);
    } else if (wall < max) {
      const hp = o.clone().addScaledVector(d, wall);
      this.puffs.spawn(hp, 0x8a7a60, 0.35);
    }
    this.animals.onGunshot(o.x, o.z);
    this.story.flags.shots = (this.story.flags.shots || 0) + 1;
    // watching creature vanishes at the shot; a bold one answers it
    if (this.creature.state === 'watch' || this.creature.state === 'appear') this.creature.vanish(true);
  }

  onPlayerDeath() {
    this.audio.shriek(this.player.eyePos, 0.6);
    this.input.unlock();
    this.ui.fade(2, () => this.ending('death'));
    this.state = 'dying';
  }

  ending(key) {
    if (this.ended && key !== 'death') return;
    this.ended = true;
    this.state = 'ended';
    this.input.unlock();
    this.ui.closeModal();
    this.ui.show('hud', false);
    const s = this.story;
    const stats = [
      `Days survived: ${this.env.day}`,
      `Animals taken: ${s.kills} · Hunting score: ${this.animals.score}`,
      `Documents read: ${s.docs.size} · Keeper documents: ${s.keeperDocs}/3`,
      `Times it was seen: ${this.creature.sightings} · Encounters: ${this.creature.encounters}`,
      `Time played: ${Math.floor(this.playTime / 60)} min`,
    ];
    if (key !== 'death') {
      stats.push(`Ending: ${ENDINGS[key].title} — one of five. Others remain.`);
      try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
    }
    this.creature.hide();
    this.stopHelicopter();
    this.ui.showEnding(ENDINGS[key], stats, key === 'death');
  }

  // ------------------------------------------------------------ save / load

  hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }

  save(quiet = false) {
    if (this.state !== 'play' && this.state !== 'paused') return;
    if (this.player.dead || this.ended) return;
    const p = this.player;
    const data = {
      v: 1,
      player: { x: p.pos.x, z: p.pos.z, yaw: p.yaw, stats: { ...p.stats } },
      env: { hours: this.env.hours, day: this.env.day, weather: this.env.weatherNext },
      inv: this.inv.serialize(), mag: this.equip.mag,
      story: this.story.serialize(), animals: this.animals.serialize(), creature: this.creature.serialize(),
      ui: this.ui.serialize(), fire: this.campfire.lit, playTime: this.playTime,
    };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { if (!quiet) this.ui.toast('Could not save (storage blocked)'); }
  }

  continueGame() {
    let data;
    try { data = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { data = null; }
    if (!data) { this.newGame(); return; }
    this.resetWorldState();
    this.env.hours = data.env.hours; this.env.day = data.env.day;
    this.env.setWeather(data.env.weather || 'mist', true);
    this.inv.load(data.inv);
    this.equip.mag = data.mag ?? MAG_SIZE;
    this.story.load(data.story);
    this.animals.load(data.animals);
    this.creature.load(data.creature);
    this.ui.load(data.ui);
    Object.assign(this.player.stats, data.player.stats);
    this.player.stats.health = Math.max(this.player.stats.health, 35);
    this.player.stats.fear = 0;
    this.player.teleport(data.player.x, data.player.z, data.player.yaw);
    if (data.fire) this.lightCampfire();
    this.playTime = data.playTime || 0;
    this.creature.cooldown = 60;
    this.startPlay();
    this.ui.toast(`Day ${this.env.day}. Welcome back.`, 3);
  }

  // ------------------------------------------------------------ loop

  loop(now) {
    requestAnimationFrame((t) => this.loop(t));
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (!(dt > 0)) dt = 0.016;
    dt = Math.min(dt, 0.05);
    this.time += dt;
    this.frame++;
    if (this.settings.fps) {
      this.fpsAcc += dt; this.fpsN++;
      if (this.fpsAcc > 0.5) { $('fps').textContent = `${Math.round(this.fpsN / this.fpsAcc)} FPS`; this.fpsAcc = 0; this.fpsN = 0; }
    }
    const tu = performance.now();
    if (this.state === 'play' || this.state === 'dying') this.updatePlay(dt);
    else if (this.state === 'menu') this.updateMenu(dt);
    else if (this.state === 'paused' || this.state === 'ended') {
      // keep audio settling, no simulation
      this.audio.update(dt, this.audioState(true));
    }
    this.perfUpdate = performance.now() - tu;
    this.renderFrame();
    this.input.endFrame();
  }

  updateMenu(dt) {
    const m = this.menuCam;
    m.t += dt;
    const c = this.structures.camp.fireWorld;
    const cam = this.camera;
    cam.position.set(m.x + Math.sin(m.t * 0.05) * 3, this.world.heightAt(m.x, m.z) + 1.7 + Math.sin(m.t * 0.3) * 0.05, m.z + Math.cos(m.t * 0.04) * 2);
    cam.lookAt(c.x + 4, c.y + 1.8, c.z - 8);
    this.env.hours = 20.1;
    this.env.update(dt * 0, cam.position, false, this.time);
    this.campfire.update(dt, this.time);
    this.lights.update(cam.position.x, cam.position.z);
    this.world.updateChunks(cam.position.x, cam.position.z, this.env.effectiveView || 150, cam);
    this.world.update(dt, this.time);
    this.equip.spot.intensity = 0;
    this.creature.eyeMat.opacity = 0.7 + Math.sin(this.time * 0.5) * 0.2;
    this.audio.update(dt, this.audioState(true));
  }

  audioState(menu = false) {
    const p = this.player;
    return {
      night: this.env.nightness, tension: menu ? 0.15 : this.tension || 0, calm: menu ? 0.8 : this.creature.forestCalm,
      wind: this.env.w.wind, rain: this.env.w.rain, indoors: !menu && p.indoors, fear: menu ? 0 : p.stats.fear,
      pos: menu ? this.camera.position : p.pos, menu,
    };
  }

  updatePlay(dt) {
    const p = this.player, input = this.input;
    this.playTime += dt;
    // look
    if (input.locked && !this.ui.modal && !p.dead) {
      const zoomK = this.camera.fov / this.settings.fov;
      p.look(input.mouse.dx, input.mouse.dy, this.settings.sens, this.settings.invert, zoomK);
    }
    p.update(dt, input, this.settings);
    this.equip.update(dt, input, this.time);
    // camera with optics zoom and scope sway
    const fov = this.equip.zoomFov(this.settings.fov);
    p.applyCamera(this.camera, this.time, fov, this.settings.fov);
    if (this.equip.aimT > 0.1) {
      const sw = this.equip.currentSway();
      this.camera.rotation.y += sw.x * this.equip.aimT;
      this.camera.rotation.x += sw.y * this.equip.aimT;
    }
    this.camera.updateMatrixWorld();

    this.env.update(dt, this.camera.position, this.equip.flashOn, this.time);
    if (this.creature.state !== 'hunt' && this.creature.state !== 'retreat') this.env.darknessBoost = damp(this.env.darknessBoost, 0, 0.5, dt);
    this.world.updateChunks(this.camera.position.x, this.camera.position.z, this.env.effectiveView, this.camera);
    this.world.update(dt, this.time);
    this.animals.update(dt);
    this.creature.update(dt);
    this.events.update(dt);
    this.story.update(dt);
    this.campfire.update(dt, this.time);
    this.hollowFire.update(dt, this.time);
    this.puffs.update(dt);
    this.updateDoors(dt);
    this.updateHeli(dt);
    this.lights.update(p.pos.x, p.pos.z);

    // fear: darkness without light, the creature, low health
    const st = p.stats;
    const dark = this.env.nightness * (this.equip.flashOn ? 0.2 : 1) * (this.isSafeZone(p.pos.x, p.pos.z) ? 0 : 1);
    const target = clamp(dark * 0.3 + (1 - this.creature.forestCalm) * 0.4, 0, 1);
    st.fear = st.fear > target ? Math.max(target, st.fear - dt * 0.05) : Math.min(target, st.fear + dt * 0.03);
    this.tension = clamp(st.fear * 0.7 + (this.creature.state === 'hunt' ? 0.5 : 0) + (1 - this.creature.forestCalm) * 0.3, 0, 1);

    // interaction focus
    this.focus = this.findFocus();
    if (!this.focus && !this.ui.modal) {
      const c = this.animals.nearestCarcass(p.pos.x, p.pos.z);
      if (c) this.focus = { label: () => `Field dress ${c.sp.name.toLowerCase()}`, action: () => this.harvest(c) };
    }
    this.ui.update(dt);
    this.ui.refreshObjectiveTick(dt);
    this.updateTutorial(dt);

    // audio
    const fwd = p.forward();
    this.audio.updateListener(this.camera.position, fwd);
    this.audio.update(dt, this.audioState(false));

    // the weather turns now and then
    this.weatherT = (this.weatherT ?? 300 + rand() * 300) - dt;
    if (this.weatherT <= 0) { this.weatherT = 300 + rand() * 400; this.env.randomWeather(rand, this.story.stage); }

    // periodic autosave
    this.autoT = (this.autoT || 0) + dt;
    if (this.autoT > 90 && this.creature.state !== 'hunt' && !this.story.flags.burning && !this.story.flags.called) { this.autoT = 0; this.save(true); }
  }

  findFocus() {
    if (this.ui.modal || this.player.climb) return null;
    const cam = this.camera.position;
    const f = this.player.forward();
    let best = null, bestScore = 0;
    for (const it of this.story.interactables) {
      const dx = it.pos.x - cam.x, dy = it.pos.y + 0.3 - cam.y, dz = it.pos.z - cam.z;
      const d = Math.hypot(dx, dy, dz);
      if (d > it.r + 1.2) continue;
      const hd = Math.hypot(dx, dz);
      if (hd > it.r) continue;
      const dot = (dx * f.x + dy * f.y + dz * f.z) / (d || 1);
      const score = dot - d * 0.05;
      if (dot > 0.55 && score > bestScore && it.label?.()) { best = it; bestScore = score; }
    }
    return best;
  }

  updateHeli(dt) {
    if (!this.heli) return;
    const h = this.heli;
    h.t += dt;
    // swoops in from the east and hovers over the clearing with its searchlight down
    const k = Math.min(1, h.t / 12);
    const x = h.x + (1 - k) * 220, y = h.y + 45 - k * 20, z = h.z + Math.sin(h.t * 0.3) * 4;
    this.heliSrc.pos.set(x, y - 8, z);
    this.heliSrc.intensity = 40 * k;
    if (this.heliSound?.node) { /* positional node is fixed at creation; ramp gain as it approaches */ this.heliSound.setGain(0.4 + k * 0.8); }
  }

  updateTutorial(dt) {
    const tut = this.tutorial;
    if (!tut || this.story.stage > 2) return;
    tut.t += dt;
    const steps = [
      [20, () => this.ui.toast(`${K('flashlight')} toggles your flashlight. Batteries run down — watch the LIGHT bar.`, 5)],
      [45, () => this.ui.toast(`${K('inventory')} opens your backpack. ${K('map')} opens the map — click to drop markers.`, 5)],
      [80, () => this.ui.toast(`${K('aim')} to aim. Head and heart shots are clean kills. Hold ${K('sprint')} while scoped to steady.`, 6)],
      [120, () => this.ui.toast(`${K('eat')} eats, ${K('medkit')} uses a first aid kit. Hunger slowly drains your health if ignored.`, 6)],
    ];
    if (tut.step < steps.length && tut.t > steps[tut.step][0]) { steps[tut.step][1](); tut.step++; }
  }

  renderFrame() {
    const r = this.renderer;
    // shadows: refresh every frame on high, every other frame otherwise; rarely at night
    if (r.shadowMap.enabled) {
      const every = this.env.nightness > 0.8 ? 12 : this.settings.quality === 'high' ? 1 : 2;
      if (this.frame % every === 0) r.shadowMap.needsUpdate = true;
    }
    r.clear();
    r.render(this.scene, this.camera);
    this.perfCalls = r.info.render.calls; this.perfTris = r.info.render.triangles;
    if (this.state === 'play' || this.state === 'dying') this.equip.render(r);
  }
}

const game = new Game();
game.init().catch((e) => {
  console.error(e);
  document.getElementById('loadText').textContent = 'Failed to start: ' + e.message + ' — try another browser (Chrome / Safari / Firefox).';
});
