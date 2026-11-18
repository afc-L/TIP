// THE HOLLOW — game bootstrap, main loop and mode orchestration.
import * as THREE from 'three';
import { Graphics } from './core/graphics.js';
import { Input } from './core/input.js';
import { setTextureQuality } from './core/textures.js';
import { AudioEngine } from './audio/audio.js';
import { UI, fmtTime } from './ui/ui.js';
import { Monster } from './actors/monster.js';
import { buildMonster } from './actors/monsterModel.js';
import { NPCManager } from './systems/npcManager.js';
import { Combat } from './systems/combat.js';
import { Abilities } from './systems/abilities.js';
import { Hallucinations } from './systems/hallucinations.js';
import { FX } from './systems/fx.js';
import { Story, CHAPTERS, CHALLENGES } from './systems/story.js';
import { Progress } from './systems/progress.js';
import { MAPS, createMap } from './maps/index.js';
import './maps/registerAll.js';
import { rand, pick, clamp, damp, lerp } from './core/util.js';

const DEFAULT_SETTINGS = { quality: (navigator.hardwareConcurrency || 4) <= 4 ? 'low' : 'medium', master: 0.85, sfx: 1, amb: 0.8, voice: 1, music: 0.7, sens: 1, invert: false, fov: 70, subtitles: true, hallucinations: true, playerName: '', voices: true, fps: false };

class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.progress = new Progress();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, this.progress.d.settings);
    setTextureQuality(this.settings.quality);
    this.graphics = new Graphics(this.canvas);
    this.graphics.setQuality(this.settings.quality);
    this.graphics.renderer.info.autoReset = false;
    this.camera = this.graphics.camera;
    this.audio = new AudioEngine();
    this.input = new Input(this.canvas);
    this.ui = new UI(this);
    this.npcs = new NPCManager(this);
    this.combat = new Combat(this);
    this.abilities = new Abilities(this);
    this.hallucinations = new Hallucinations(this);
    this.fx = new FX(this);
    this.story = new Story(this);
    this.post = { night: 0, predator: 0, senses: 0, presence: 0, feed: 0, damage: 0, glitch: 0, stretch: 0, desatExtra: 0, grain: 0.06, flash: 0 };
    this.postS = { ...this.post };
    this.running = false; this.paused = false; this.time = 0; this.wind = 1; this.fps = 60; this.hitStopT = 0;
    this.stats = this.newStats();
    this.flashes = [];
    this.renderH = window.innerHeight;
    addEventListener('resize', () => { this.renderH = window.innerHeight * this.graphics.q.pixelRatio; if (this.fx.smoke) this.fx.setScale(this.renderH); });
    this.applySettings();
    this.input.onLockChange = (locked) => {
      if (!this.running) return;
      if (!locked && !this.paused && !this.ending) this.pause();
      this.ui.clickToPlay(!locked && !this.paused);
    };
    addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.running && this.paused && this.ui.current === 'pauseScreen') this.resume();
      if (e.code === 'KeyP' && this.running && !this.paused) this.pause();
    });
    this.canvas.addEventListener('mousedown', () => { this.audio.init(); });
    this.buildMenuScene();
    this.ui.openMenu();
    this.last = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  newStats() { return { fed: 0, fedInMap: 0, mapDist: 0, mapTime: 0, unseenFeeds: 0, cowered: 0, escaped: 0, armedFed: 0, presenceStares: 0, seen: 0, onSeen: () => { this.stats.seen++; }, onDowned: () => {} }; }

  // ---------------- settings ----------------
  setSetting(k, v) {
    this.settings[k] = v; this.progress.d.settings = this.settings; this.progress.save();
    if (k === 'quality') { setTextureQuality(v); this.graphics.setQuality(v); if (this.running) this.ui.toast('Graphics quality changed. Some changes apply when a map loads.', 3); else this.buildMenuScene(); }
    this.applySettings();
  }
  applySettings() {
    const s = this.settings;
    for (const k of ['master', 'sfx', 'amb', 'voice', 'music']) this.audio.volumes[k] = s[k], this.audio.ready && this.audio.setVolume(k, s[k]);
    this.input.sensitivity = s.sens; this.input.invertY = s.invert;
    this.hallucinations.enabled = s.hallucinations;
  }
  applyUpgrades() {
    const m = this.monster; if (!m) return; const P = this.progress;
    m.speedMul = 1 + 0.08 * P.upgradeLevel('speed'); m.jumpMul = 1 + 0.18 * P.upgradeLevel('jump'); m.attackMul = 1 + 0.2 * P.upgradeLevel('attack');
  }

  // ---------------- menu backdrop ----------------
  buildMenuScene() {
    const s = new THREE.Scene();
    s.background = new THREE.Color(0x030304); s.fog = new THREE.FogExp2(0x050507, 0.09);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.95 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; s.add(ground);
    const mm = buildMonster(this.progress.d.skin); mm.root.position.set(2.6, 0, 0.6); mm.root.rotation.y = -0.35; s.add(mm.root);
    const B = mm.B;
    const pose = { hips: [0.15, 0, 0], spine1: [0.25, 0, 0], spine2: [0.25, 0, 0], chest: [0.2, 0, 0], neck1: [0.45, 0, 0], neck2: [0.1, 0, 0] };
    for (const k in pose) B[k].rotation.set(...pose[k]);
    for (const sd of ['L', 'R']) { B['upperArm' + sd].rotation.set(-0.85, 0, sd === 'L' ? 0.12 : -0.12); B['foreArm' + sd].rotation.x = -0.35; }
    B.head.rotation.x = -1.75; B.neck2.rotation.x = -0.1;
    for (const sd of ['L', 'R']) { B['thigh' + sd].rotation.x = -0.6; B['shin' + sd].rotation.x = 1.15; B['meta' + sd].rotation.x = -0.79; B['foot' + sd].rotation.x = 0.24; }
    s.add(new THREE.HemisphereLight(0x303848, 0x050505, 0.4));
    const spot = new THREE.SpotLight(0xffd0a0, 90, 20, 0.5, 0.6, 1.5); spot.position.set(3.5, 7, 2.5); spot.target = mm.root; spot.castShadow = this.graphics.q.shadows; s.add(spot);
    const rim = new THREE.PointLight(0x8a1010, 10, 8); rim.position.set(0, 2.5, -2.5); s.add(rim);
    this.menu = { scene: s, monster: mm, spot, t: 0 };
    if (!this.running) this.graphics.setScene(s);
  }
  updateMenu(dt) {
    const M = this.menu; M.t += dt;
    const cam = this.camera; const a = Math.sin(M.t * 0.08) * 0.25;
    cam.position.set(Math.sin(a) * 6.2 - 0.5, 2.0, Math.cos(a) * 6.2 + 0.5); cam.lookAt(0.6, 2.0, 0); cam.fov = 50; cam.updateProjectionMatrix();
    const B = M.monster.B;
    const br = Math.sin(M.t * 1.2);
    B.chest.scale.set(1 + br * 0.02, 1, 1 + br * 0.025);
    B.head.rotation.y = Math.sin(M.t * 0.3) * 0.25 - 0.25 + (Math.sin(M.t * 3.1) > 0.995 ? 0.3 : 0); B.head.rotation.z = Math.sin(M.t * 0.21) * 0.15;
    B.jaw.rotation.x = 0.06 + Math.max(0, br) * 0.05;
    M.spot.intensity = (Math.random() < 0.02 ? 5 : 90) * (0.9 + Math.sin(M.t * 13) * 0.05);
    const fx = this.graphics.fx; fx.uTime.value = M.t; fx.uVignette.value = 1; fx.uGrain.value = 0.018; fx.uDesat.value = 0.35; fx.uTint.value.set(1, 0.97, 0.95); fx.uLift.value.set(0, 0, 0);
    fx.uNight.value = 0; fx.uPredator.value = 0; fx.uFeed.value = 0; fx.uPresence.value = 0; fx.uStretch.value = 0; fx.uDistort.value = 0; fx.uGlitch.value = Math.random() < 0.004 ? 1 : 0; fx.uDamage.value = 0; fx.uFlash.value = 0; fx.uDark.value = 0; fx.uExposure.value = 1; fx.uSenses.value = 0; fx.uAberration.value = 0.0015;
  }

  // ---------------- starting a map ----------------
  start(mode, mapKey, opts = {}) {
    this.audio.init();
    this.mode = mode; this.mapKey = mapKey; this.startOpts = opts; this.running = false; this.input.unlock();
    const chap = mode === 'story' ? (opts.chapter || 1) : null;
    this.ui.loading(chap ? CHAPTERS[chap].title : MAPS[mapKey].title);
    this.ui.clearHUD();
    setTimeout(() => this.load(mode, mapKey, opts), 60);
  }
  load(mode, mapKey, opts) {
    // tear down
    this.running = false;
    this.audio.stopAllLoops();
    this.npcs.clear(); this.combat.reset(); this.abilities.reset(); this.fx.clearAll && this.fx.clearAll();
    if (this.map) { this.map.dispose(); this.map = null; }
    try {
      this.map = createMap(this, mapKey);
    } catch (e) { console.error(e); this.ui.endScreen('Something went wrong', String(e.stack || e), false); return; }
    const map = this.map;
    this.scene = map.scene; this.world = map.world; this.nav = map.nav;
    this.graphics.setScene(this.scene);
    this.fx.attach(this.scene, this.graphics.q);
    this.fx.setScale(window.innerHeight * this.graphics.q.pixelRatio);
    this.renderH = window.innerHeight * this.graphics.q.pixelRatio;
    // monster
    this.monster = new Monster(this, this.progress.skinOwned(this.progress.d.skin) ? this.progress.d.skin : 'pale');
    this.scene.add(this.monster.root);
    this.monster.place(map.spawn, map.spawnYaw);
    this.applyUpgrades();
    // temporary light for gunshots etc.
    this.flashLight = new THREE.PointLight(0xffd080, 0, 20, 2); this.scene.add(this.flashLight);
    // population
    const scale = this.graphics.q.npcScale;
    const pop = map.populationDef;
    if (pop) pop.initial.forEach((d, i) => { if (i < Math.ceil(pop.initial.length * scale)) this.npcs.spawn({ ...d, pos: d.pos.clone() }); });
    // audio
    const env = map.env;
    for (const [name, gain] of map.loops || []) this.audio.loop(name, gain);
    this.audio.loop('tension', 0);
    if (env.reverb) this.audio.setReverb(env.reverb[0], env.reverb[1], env.reverb[2]);
    this.audio.setReverbMix(env.reverbMix ?? 0.35);
    this.fx.setupWeather({ rain: env.rain, fogBanks: env.fogBanks, fogColor: env.fogColor2, motes: env.motes, moteColor: env.moteColor, fogBankAlpha: env.fogBankAlpha });
    this.wind = env.wind ?? 1;
    // systems
    const chap = mode === 'story' ? opts.chapter : null;
    const baseH = mode === 'nightmare' ? 0.45 : map.kind === 'other' ? 0.6 : map.kind === 'hospital' ? 0.3 : 0.12 + (map.chapter - 1) * 0.06;
    this.hallucinations.reset(baseH);
    this.stats = this.newStats();
    this.story.reset(chap);
    this.survival = { time: 0, wave: 0, nextWave: 45 };
    this.nightmare = mode === 'nightmare' ? (this.nightmare && opts.continueNightmare ? this.nightmare : { depth: 0 }) : null;
    if (this.nightmare) { this.nightmare.need = 3 + this.nightmare.depth; this.nightmare.rift = null; }
    this.ending = false;
    this.running = true; this.paused = false;
    this.ui.show(null); this.ui.showHUD(true);
    if (mode !== 'story') this.ui.chapterTitle(MAPS[mapKey].title, mode === 'survival' ? 'Survive.' : mode === 'nightmare' ? 'Nothing here is certain.' : 'Hunt.');
    this.input.enabled = true; this.input.lock();
    this.ui.clickToPlay(!this.input.locked);
    this.time = 0;
  }

  pause() { if (!this.running) return; this.paused = true; this.ui.show('pauseScreen'); this.ui.stack = []; this.input.unlock(); }
  resume() { this.paused = false; this.ui.show(null); this.input.lock(); this.ui.clickToPlay(!this.input.locked); }
  quitToMenu() {
    this.running = false; this.paused = false; this.audio.stopAllLoops();
    this.npcs.clear(); if (this.map) { this.map.dispose(); this.map = null; }
    this.input.unlock(); this.input.enabled = false; this.ui.showHUD(false); this.ui.clearHUD();
    this.buildMenuScene(); this.graphics.setScene(this.menu.scene); this.ui.openMenu();
  }
  retry() { this.start(this.mode, this.mapKey, this.startOpts); }

  // ---------------- world queries used by systems ----------------
  emitNoise(pos, radius, type, source) { this.npcs.noise(pos, radius, type, source); }
  surfaceAt(p) { return this.map ? this.map.surfaceAt(p) : 'concrete'; }
  lightLevelAt(p, npc) { return this.map.lightLevelAt(p, npc); }
  hitStop(t) { this.hitStopT = Math.max(this.hitStopT, t); }
  flash(pos, color, intensity, dur) { this.flashLight.position.copy(pos); this.flashLight.color.set(color); this.flashLight.intensity = intensity; this.flashT = dur; }
  callForHelp(pos) { this.npcs.callForHelp(pos); }

  nearestInteractable() {
    if (!this.map || !this.monster) return null;
    const m = this.monster; let best = null, bd = Infinity;
    const fwd = m.camForward;
    for (const it of this.map.interactables) {
      if (it.taken && it.kind !== 'rift') continue; if (it.hidden) continue;
      const d = it.pos.distanceTo(m.pos.clone().setY(m.pos.y + 1)); if (d > it.radius + 0.6) continue;
      const to = it.pos.clone().sub(m.pos).setY(0).normalize(); if (to.dot(fwd) < 0.1 && d > 1.2) continue;
      if (d < bd) { bd = d; best = it; }
    }
    for (const dr of this.map.doors) {
      const d = dr.pos.distanceTo(m.pos); if (d > 2.4 || dr.broken || Math.abs(dr.pos.y - m.pos.y) > 1.5) continue;
      const to = dr.pos.clone().sub(m.pos).setY(0).normalize(); if (to.dot(fwd) < 0.2 && d > 1.0) continue;
      if (d < bd) { bd = d; best = dr; }
    }
    if (!best) return null;
    best.label = best.kind === 'door' ? (best.locked ? 'Locked — a heavy strike could break it' : best.open ? 'Close' : 'Open')
      : best.kind === 'note' ? 'Read' : best.kind === 'recording' ? 'Play tape' : best.kind === 'symbol' ? 'Touch the symbol' : best.kind === 'rift' ? 'Step through' : best.label || 'Use';
    return best;
  }
  interact() {
    if (this.ui.noteOpen) { this.ui.closeNote(); return true; }
    const it = this.nearestInteractable(); if (!it) return false;
    if (it.kind === 'door') { it.toggle(this.monster.pos, this); return true; }
    if (it.onUse) { it.onUse(this); return true; }
    return this.story.onInteract(it);
  }

  // ---------------- rifts / modes ----------------
  enterRift(it) {
    if (this.riftEntering) return;
    this.riftEntering = true;
    this.audio.play('subSwell', null, { vol: 1 }); this.audio.play('stinger', null, { vol: 0.7, dur: 2 });
    let t = 0; const fade = () => { t += 0.016; this.post.dark = Math.min(1, t / 1.5); if (t < 1.6) requestAnimationFrame(fade); else this.afterRift(); };
    fade();
  }
  afterRift() {
    this.riftEntering = false; this.post.dark = 0;
    if (this.mode === 'story') {
      const n = this.story.chapterNum;
      this.progress.addEssence(100);
      this.progress.d.chapter = Math.max(this.progress.d.chapter, n + 1); this.progress.save();
      if (CHAPTERS[n + 1]) this.start('story', CHAPTERS[n + 1].map, { chapter: n + 1 });
    } else if (this.mode === 'nightmare') {
      this.nightmare.depth++;
      const keys = Object.keys(MAPS).filter((k) => k !== this.mapKey && this.progress.mapUnlocked(k, MAPS[k].order));
      this.start('nightmare', keys.length ? pick(keys) : this.mapKey, { continueNightmare: true });
    }
  }
  nightmareObjective() { const n = this.nightmare; if (!n) return ''; return n.rift ? 'The way is open. Find it.' : `Feed to open the way (${Math.min(this.stats.fedInMap, n.need)}/${n.need}) · depth ${n.depth}`; }
  nightmareTarget() { return this.nightmare && this.nightmare.rift ? this.nightmare.rift.pos : null; }
  openNightmareRift() {
    const m = this.monster; const cands = this.nav.nodes.filter((n) => n.pos.distanceTo(m.pos) > 25 && n.pos.distanceTo(m.pos) < 70);
    const node = cands.length ? pick(cands) : this.nav.nodes[0];
    const b = this.map.b; const it = b.item('rift', 'nm_rift', node.pos.x, node.pos.y, node.pos.z, rand(0, 6));
    this.nightmare.rift = it; this.ui.toast('Somewhere, the world has torn open.', 4);
    this.audio.play('stinger', it.pos, { vol: 0.6, dur: 3 });
  }
  onMonsterDeath() {
    this.progress.d.stats.deaths++; this.progress.save();
    setTimeout(() => {
      this.input.unlock(); this.ending = true;
      if (this.mode === 'survival') {
        const key = this.mapKey; const best = this.progress.d.bestSurvival[key];
        const rec = { time: this.survival.time, fed: this.stats.fedInMap };
        const isBest = !best || rec.time > best.time;
        if (isBest) { this.progress.d.bestSurvival[key] = rec; }
        const ess = Math.floor(rec.time / 10) + rec.fed * 5; this.progress.addEssence(ess);
        this.ui.endScreen('The hunt is over', `You lasted ${fmtTime(rec.time)} and fed ${rec.fed} times. Wave ${this.survival.wave}.\n${isBest ? 'A new record.' : `Best: ${fmtTime(best.time)}`}\n+${ess} essence`);
      } else this.ui.endScreen('It retreats into the dark', 'Too much light. Too many of them.\nIt will be hungry when it wakes again.');
      this.running = false;
    }, 1800);
  }
  triggerEnding() {
    if (this.ending) return;
    this.ending = true;
    this.audio.play('subSwell', null, { vol: 1 }); this.audio.play('stinger', null, { vol: 0.8, dur: 4 });
    this.audio.silence(0.0, 8, 4);
    const P = this.progress; P.d.storyComplete = true; P.d.chapter = Math.max(P.d.chapter, 5); P.addEssence(300); P.save();
    let t = 0;
    const fade = () => { t += 0.016; this.post.flash = 0; this.graphics.fx.uFlash.value = Math.max(0, Math.sin(Math.min(1, t / 2) * Math.PI) * 0.6); this.post.dark = Math.max(0, (t - 1.5) / 2); if (t < 4) requestAnimationFrame(fade); else this.showEnding(); };
    fade();
  }
  showEnding() {
    this.running = false; this.input.unlock();
    this.ui.endScreen('THE HOLLOW', [
      'The tall one does not move. It only looks at you, the way it always has — from the end of every hallway.',
      'When you reach it, it kneels.',
      'It is not afraid of you. It never was.',
      'It rests one long hand on your head, almost gently, and for the first time since you woke in the wet grass, the hunger stops.',
      '',
      'Somewhere on Ashgrove Lane a porch light comes on.',
      'A boy in a red raincoat is standing in the middle of the road.',
      'He is very, very tall.',
      '',
      '— Nightmare mode unlocked · +300 essence —',
    ].join('\n'), false);
  }
  checkChallenges() {
    const list = CHALLENGES[this.map.kind] || [];
    for (const c of list) {
      if (this.progress.d.challenges.includes(c.id)) continue;
      if (c.check(this.stats, this)) { this.progress.completeChallenge(c.id); this.progress.addEssence(c.reward); this.ui.toast(`Challenge: ${c.text}  +${c.reward}`, 4, 'essence'); }
    }
  }

  // ---------------- main loop ----------------
  loop(now) {
    requestAnimationFrame((t) => this.loop(t));
    let dt = Math.max(0, Math.min(0.05, (now - this.last) / 1000)); this.last = now;
    if (dt > 0) this.fps = damp(this.fps, 1 / Math.max(dt, 1e-3), 3, dt);
    if (!this.running) {
      if (this.menu && !this.map) { this.updateMenu(dt); this.graphics.render(); }
      this.input.endFrame();
      return;
    }
    if (this.paused) { this.graphics.render(); this.input.endFrame(); return; }
    if (this.hitStopT > 0) { this.hitStopT -= dt; dt *= 0.15; }
    this.time += dt;
    this.update(dt);
    this.graphics.renderer.info.reset();
    this.graphics.render();
    this.input.endFrame();
  }

  update(dt) {
    const g = this, m = this.monster, input = this.input;
    const allow = input.locked && !this.ending;
    const prev = m.pos.clone();
    m.update(dt, input, allow);
    if (allow) {
      this.abilities.handleInput(input);
      if (input.hit('Escape') && this.ui.noteOpen) this.ui.closeNote();
    }
    this.stats.mapDist += m.pos.distanceTo(prev); this.stats.mapTime += dt;
    this.abilities.update(dt);
    this.npcs.update(dt);
    this.combat.update(dt);
    this.hallucinations.update(dt);
    this.story.update(dt);
    this.map.update(dt, this.time);
    this.fx.update(dt, this.camera.position, this.wind, this.map.isInside(m.pos) || this.map.kind === 'hospital');
    if (this.flashT > 0) { this.flashT -= dt; if (this.flashT <= 0) this.flashLight.intensity = 0; }
    this.graphics.updateLights(this.map.lights, m.pos, this.time);
    this.graphics.updateSpots(this.npcs.list, m.pos);
    // modes
    if (this.mode === 'survival') this.updateSurvival(dt);
    if (this.nightmare && !this.nightmare.rift && this.stats.fedInMap >= this.nightmare.need) this.openNightmareRift();
    if ((this.time * 2 | 0) !== ((this.time - dt) * 2 | 0)) this.checkChallenges();
    // dynamic dread: tension rises when people are alarmed nearby / hallucinations are intense
    let alarm = 0;
    for (const n of this.npcs.list) if ((n.state === 'confront' || n.seesMonster) && n.pos.distanceTo(m.pos) < 40) alarm = Math.max(alarm, 1 - n.pos.distanceTo(m.pos) / 40);
    this.audio.loop('tension', 0.02 + alarm * 0.35 + this.post.presence * 0.4);
    this.updatePost(dt);
    // audio listener
    const cam = this.camera; const f = new THREE.Vector3(); cam.getWorldDirection(f);
    this.audio.setListener(cam.position, f, cam.up);
    this.ui.updateHUD(dt);
    this.progress.d.stats.playtime += dt;
  }

  updateSurvival(dt) {
    const S = this.survival; S.time += dt; S.nextWave -= dt;
    if (S.nextWave <= 0) {
      S.wave++; S.nextWave = Math.max(35, 70 - S.wave * 4);
      this.npcs.spawnSearchers(this.monster.pos.clone(), Math.min(6, 1 + S.wave));
      this.ui.toast(`Wave ${S.wave}: they are coming with lights.`, 3);
      this.audio.play('siren', this.monster.pos.clone().add(new THREE.Vector3(80, 5, 0)), { vol: 0.3, dur: 6 });
      this.hallucinations.bump(0.03);
    }
  }

  updatePost(dt) {
    const p = this.post, s = this.postS, fx = this.graphics.fx, env = this.map.env, m = this.monster;
    p.feed = Math.max(0, p.feed - dt * 0.8); p.stretch = Math.max(0, p.stretch - dt * 0.6); p.damage = Math.max(0, p.damage - dt * 1.5); p.glitch = Math.max(0, p.glitch - dt * 2); p.presence = Math.max(0, p.presence - dt * 0.4);
    for (const k of ['night', 'predator', 'senses', 'presence', 'feed', 'damage', 'stretch', 'desatExtra']) s[k] = damp(s[k], p[k], 6, dt);
    fx.uTime.value = this.time;
    fx.uNight.value = s.night; fx.uPredator.value = s.predator; fx.uSenses.value = s.senses; fx.uFeed.value = s.feed;
    fx.uDamage.value = Math.max(s.damage, m.health < 30 ? (0.3 + Math.sin(this.time * 4) * 0.15) * (1 - m.health / 30) : 0);
    fx.uPresence.value = s.presence; fx.uStretch.value = s.stretch; fx.uGlitch.value = p.glitch;
    fx.uGrain.value = (p.grain + s.night * 0.04) * 0.22; fx.uVignette.value = 0.85;
    fx.uDistort.value = s.feed * 0.8 + this.hallucinations.intensity * 0.15 * (0.5 + Math.sin(this.time * 0.3) * 0.5) + s.stretch * 0.5;
    fx.uAberration.value = 0.0012 + this.hallucinations.intensity * 0.0015;
    const gr = env.grade;
    fx.uTint.value.set(...gr.tint); fx.uLift.value.set(...gr.lift);
    fx.uDesat.value = clamp(gr.desat + s.desatExtra + (this.mode === 'nightmare' ? 0.15 : 0), 0, 1);
    fx.uExposure.value = (env.exposure ?? 1) * (this.mode === 'nightmare' ? 0.75 : 1);
    fx.uDark.value = p.dark || 0;
    fx.uFear.value = m.health < 40 ? 0.5 : 0;
    if (!this.ending) fx.uFlash.value = this.flashT > 0 ? 0.04 : p.flash ? 0.08 : 0; p.flash = 0;
  }
}

window.addEventListener('DOMContentLoaded', () => { window.game = new Game(); window.game.raycasterCtor = THREE.Raycaster; });
