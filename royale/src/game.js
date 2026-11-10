// Game orchestration: world construction, match lifecycle, events, per-frame update and rendering.
import * as THREE from 'three';
import { MAP_HALF, AI_NAMES, PROFILE_MIX, WATER_Y, STORM_PHASES } from './config.js';
import { mulberry32, weightedPick, rand, pick, shuffle, chance } from './util.js';
import { CollisionWorld } from './physics.js';
import { Terrain } from './terrain.js';
import { World } from './world.js';
import { generateMap } from './mapgen.js';
import { Actor } from './actor.js';
import { AIBrain } from './ai.js';
import { BuildSystem } from './building.js';
import { Combat } from './combat.js';
import { LootSystem } from './loot.js';
import { Storm } from './storm.js';
import { Bus } from './bus.js';
import { Effects } from './effects.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { PlayerController } from './player.js';
import { CharacterRenderer } from './character.js';
import { HUD } from './hud.js';
import { drawMapImage } from './mapdraw.js';
import { randomAppearance, appearanceFromLoadout } from './cosmetics.js';
import { Progression } from './progression.js';
import { makeWeapon, makeConsumable } from './items.js';
import { RARITY } from './config.js';
import { Emitter } from './util.js';

const QUALITY = {
  low: { pixel: 0.75, shadowMap: 1024, shadows: false },
  medium: { pixel: 1, shadowMap: 1024, shadows: true },
  high: { pixel: 1.5, shadowMap: 2048, shadows: true },
};

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.events = new Emitter();
    this.prog = new Progression();
    this.settings = this.prog.data.settings;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!window.__TEST__ });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1500);
    this.time = 0; this.realDt = 0.016;
    this.timeScale = 1;
    this.state = 'boot';
    this.actors = [];
    this.player = null;
    this.soundEvents = [];
    this.dropCounts = {};
    this.mapOpen = false;
    this.paused = false;
    this.godMode = false;
    this.aliveCount = 0;
    this.input = new Input(canvas);
    this.audio = new Audio(this);
    window.addEventListener('resize', () => this.resize());
  }

  // ---------------- one-time world build ----------------
  async buildWorld(onProgress) {
    const step = async (msg, frac) => { onProgress(msg, frac); await new Promise((r) => setTimeout(r, 16)); };
    this.rng = mulberry32(20261110);
    await step('Raising the island...', 0.05);
    this.setupScene();
    this.phys = new CollisionWorld();
    this.terrain = new Terrain(4242);
    this.terrain.generate();
    this.phys.terrain = this.terrain;
    await step('Building named locations...', 0.25);
    this.world = new World(this);
    generateMap(this.world);
    await step('Planting forests...', 0.5);
    this.terrain.buildMesh(this.scene);
    this.world.finalize();
    await step('Drawing the map...', 0.65);
    this.mapImage = drawMapImage(this.terrain, this.world, 512);
    await step('Preparing systems...', 0.8);
    this.effects = new Effects(this);
    this.build = new BuildSystem(this);
    this.combat = new Combat(this);
    this.loot = new LootSystem(this);
    this.storm = new Storm(this);
    this.bus = new Bus(this);
    this.chars = new CharacterRenderer(this.scene, 104);
    this.playerCtl = new PlayerController(this);
    this.hud = new HUD(this);
    this.applySettings();
    await step('Warming up shaders...', 0.92);
    this.camera.position.set(0, 120, 300);
    this.camera.lookAt(0, 0, 0);
    this.renderer.compile(this.scene, this.camera);
    await step('Ready', 1);
    this.state = 'menu';
  }

  setupScene() {
    const s = this.scene;
    this.sky = new THREE.Color(0x8ccfff);
    s.background = this.sky.clone();
    s.fog = new THREE.Fog(0xb8e0ff, 150, 600);
    this.hemi = new THREE.HemisphereLight(0xdff2ff, 0x5a7a3a, 0.9);
    s.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff1d8, 2.0);
    this.sun.position.set(80, 140, 50);
    this.sun.castShadow = true;
    const sc = this.sun.shadow.camera;
    sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 10; sc.far = 400;
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.6;
    s.add(this.sun);
    s.add(this.sun.target);
    this.ambient = new THREE.AmbientLight(0xffffff, 0.25);
    s.add(this.ambient);
    // sky dome
    const skyGeo = new THREE.SphereGeometry(1300, 24, 12);
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(0x3d8fe0) }, bottom: { value: new THREE.Color(0xcfeaff) }, sunDir: { value: new THREE.Vector3(0.5, 0.7, 0.3).normalize() }, sunCol: { value: new THREE.Color(0xfff2c0) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 bottom; uniform vec3 sunDir; uniform vec3 sunCol; varying vec3 vP; void main(){ float h = clamp(vP.y*1.6+0.1,0.0,1.0); vec3 c = mix(bottom, top, h); float s = max(0.0, dot(vP, sunDir)); c += sunCol*pow(s, 200.0)*1.2 + sunCol*pow(s,8.0)*0.15; gl_FragColor = vec4(c,1.0); }',
    });
    this.skyDome = new THREE.Mesh(skyGeo, this.skyMat);
    this.skyDome.renderOrder = -10;
    s.add(this.skyDome);
    // clouds
    const cg = new THREE.SphereGeometry(1, 8, 6);
    const cm = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, fog: false });
    this.clouds = new THREE.InstancedMesh(cg, cm, 60);
    const m = new THREE.Matrix4();
    const r = mulberry32(7);
    for (let i = 0; i < 60; i++) {
      const x = (r() - 0.5) * 2400, z = (r() - 0.5) * 2400, y = 260 + r() * 80;
      m.makeScale(40 + r() * 60, 10 + r() * 8, 30 + r() * 40).setPosition(x, y, z);
      this.clouds.setMatrixAt(i, m);
    }
    s.add(this.clouds);
  }

  setTimeOfDay(kind) {
    const presets = {
      day: { sky: 0x8ccfff, top: 0x3d8fe0, bottom: 0xcfeaff, fog: 0xb8e0ff, sun: 0xfff1d8, sunI: 2.0, hemi: 0.9, pos: [80, 140, 50] },
      golden: { sky: 0xffc48a, top: 0x5a7fc8, bottom: 0xffd2a0, fog: 0xf5c9a0, sun: 0xffb070, sunI: 1.8, hemi: 0.75, pos: [160, 60, -40] },
      overcast: { sky: 0x9aa6b2, top: 0x6c7a88, bottom: 0xb4bec8, fog: 0xa4aeb8, sun: 0xdde4ec, sunI: 0.9, hemi: 1.1, pos: [40, 160, 30] },
    };
    const p = presets[kind] || presets.day;
    this.todKind = kind;
    this.scene.background.set(p.sky);
    this.scene.fog.color.set(p.fog);
    this.skyMat.uniforms.top.value.set(p.top);
    this.skyMat.uniforms.bottom.value.set(p.bottom);
    this.sun.color.set(p.sun); this.sun.intensity = p.sunI;
    this.hemi.intensity = p.hemi;
    this.sunOffset = new THREE.Vector3(...p.pos);
    this.skyMat.uniforms.sunDir.value.copy(this.sunOffset).normalize();
    this.effects.setRain(kind === 'overcast' && this.settings.weather);
  }

  applySettings() {
    const S = this.settings;
    const q = QUALITY[S.quality] || QUALITY.medium;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pixel) * S.resScale);
    const shadows = S.shadows && q.shadows !== false;
    this.renderer.shadowMap.enabled = shadows;
    this.sun.castShadow = shadows;
    if (this.sun.shadow.mapSize.width !== q.shadowMap) {
      this.sun.shadow.mapSize.set(q.shadowMap, q.shadowMap);
      if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
    }
    this.scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
    this.renderDist = S.renderDist;
    this.scene.fog.far = S.renderDist;
    this.scene.fog.near = S.renderDist * 0.35;
    this.camera.far = Math.max(S.renderDist + 400, 1400);
    this.camera.updateProjectionMatrix();
    this.audio.vol = { master: S.master, sfx: S.sfx, music: S.music };
    this.audio.applyVolume();
    if (this.effects) this.effects.setRain(this.todKind === 'overcast' && S.weather);
    this.resize();
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.lobby) this.lobby.resize(w, h);
  }

  infiniteMats(a) { return this.mode === 'practice' && a.isPlayer; }

  // ---------------- match lifecycle ----------------
  startMatch(mode, difficulty) {
    this.mode = mode;
    this.difficulty = difficulty;
    this.state = 'match';
    this.time = 0;
    this.matchStart = 0;
    this.paused = false;
    this.mapOpen = false;
    this.mapMarker = null;
    this.soundEvents = [];
    this.dropCounts = {};
    this.supplyPlan = [];
    this.results = null;
    this.ended = false;
    this.stats = { kills: 0, damage: 0, chests: 0, built: 0, harvested: 0, headshots: 0, heals: 0 };
    // reset systems
    for (const o of this.world.objects) if (!o.alive) this.respawnObject(o);
    this.build.reset();
    this.combat.reset();
    this.effects.reset();
    this.loot.spawnAll(this.world, mode === 'practice');
    const practice = mode === 'practice';
    this.storm.reset(practice ? 1.6 : 1);
    this.storm.preparePhase0();
    this.bus.start();
    this.setTimeOfDay(weightedPick(['day', 'golden', 'overcast'], (k) => (k === 'day' ? 5 : k === 'golden' ? 2 : 2)));
    // actors
    this.actors = [];
    const loadout = this.prog.data.loadout;
    const p = new Actor(this, this.prog.data.name || 'You', true, appearanceFromLoadout(loadout));
    this.player = p;
    this.actors.push(p);
    const nAI = practice ? 24 : 99;
    const names = shuffle(AI_NAMES.slice());
    for (let i = 0; i < nAI; i++) {
      const prof = practice && i < 12 ? 'balanced' : weightedPick(PROFILE_MIX, (e) => e[1])[0];
      const a = new Actor(this, names[i % names.length] + (i >= names.length ? i : ''), false, randomAppearance());
      new AIBrain(this, a, prof, practice ? 'easy' : difficulty);
      this.actors.push(a);
    }
    if (practice) { p.mats.wood = p.mats.stone = p.mats.metal = 999; }
    for (const a of this.actors) { a.mode = 'bus'; a.pos.copy(this.bus.pos); }
    for (const a of this.actors) if (a.brain) a.brain.planDrop();
    this.aliveCount = this.actors.length;
    this.playerCtl.reset();
    this.playerCtl.yaw = Math.atan2(-this.bus.dir.x, -this.bus.dir.z) + Math.PI * 0.75;
    this.playerCtl.pitch = -0.25;
    this.hud.show(true);
    this.hud.notify('Welcome aboard the Sky Barge', 'Press SPACE to jump when the doors open · M for map');
    this.audio.stopMusic();
    this.audio.setLoop('engine', 0.08);
    this.stormTickT = 0;
    // supply drops during the middle phases
    this.supplyPlan = [{ phase: 1, done: false }, { phase: 2, done: false }, { phase: 3, done: false }, { phase: 4, done: false }];
    this.events.emit('matchStart');
  }

  respawnObject(o) {
    o.alive = true; o.hp = o.maxHp;
    for (const p of o.parts) {
      if (p.c) this.phys.add(p.c);
      if (p.batch && p.batch.show) p.batch.show(p.h);
    }
  }

  endMatch(victory) {
    if (this.ended) return;
    this.ended = true;
    const p = this.player;
    const place = victory ? 1 : p.placement || this.aliveCount + 1;
    const m = {
      place, total: this.actors.length, kills: p.kills, damage: this.stats.damage, timeAlive: (p.alive ? this.time : p.deathTime) - this.landTime0(),
      chests: p.chestsOpened, built: p.structuresBuilt, harvested: p.harvested, distance: p.distance, headshots: this.stats.headshots, heals: this.stats.heals, mode: this.mode,
    };
    m.timeAlive = Math.max(0, m.timeAlive);
    const summary = this.prog.recordMatch(m);
    this.results = { m, summary, victory };
    this.events.emit('matchEnd', this.results);
  }
  landTime0() { return 0; }

  leaveMatch() {
    if (this.state === 'match' && !this.ended && this.player) {
      if (this.player.alive) { this.player.placement = this.aliveCount; }
      this.endMatch(false);
    }
    this.state = 'menu';
    this.hud.show(false);
    this.build.hidePreview();
    this.audio.setLoop('storm', 0); this.audio.setLoop('wind', 0); this.audio.setLoop('engine', 0); this.audio.setLoop('hum', 0);
    this.input.unlock();
  }

  // ---------------- events ----------------
  soundEvent(src, pos, r, kind) {
    this.soundEvents.push({ t: this.time, x: pos.x, y: pos.y || 0, z: pos.z, r, src, kind });
    if (this.soundEvents.length > 400) this.soundEvents.splice(0, 100);
  }

  onDamage(victim, attacker, amount, shieldOnly, opts) {
    if (amount <= 0) return;
    if (victim.brain) victim.brain.onDamaged(attacker, amount);
    if (attacker && attacker.brain) attacker.brain.onDealtDamage(victim, amount);
    if (attacker === this.player && victim !== this.player) {
      this.stats.damage += amount;
      if (opts.headshot) this.stats.headshots++;
      this.hud.hitmarker(opts.headshot);
      this.hud.damageNumber(victim, amount, victim.shield > 0 || shieldOnly, opts.headshot);
      this.audio.ui(opts.headshot ? 'headshot' : victim.shield > 0 ? 'shieldhit' : 'hit', 0.5);
      if (shieldOnly && victim.shield <= 0) this.audio.ui('shieldbreak', 0.5);
    }
    if (victim === this.player) {
      if (attacker && attacker !== victim) this.hud.damageFrom(attacker.pos);
      else if (opts.type !== 'storm') document.getElementById('hurtflash').style.opacity = 0.3;
      if (opts.type !== 'storm' || Math.random() < 0.3) this.audio.ui('hurt', 0.35);
    }
  }

  onEliminated(victim, killer, opts) {
    this.aliveCount = this.actors.filter((a) => a.alive).length;
    victim.placement = this.aliveCount + 1;
    victim.lastKiller = killer;
    if (killer && killer !== victim && killer.alive) killer.kills++;
    this.effects.elimination(victim.pos.x, victim.pos.y, victim.pos.z, victim.ap.outfit.top);
    this.loot.dropInventory(victim);
    // kill feed
    const how = opts && opts.type === 'storm' ? 'was eliminated by the storm' : opts && opts.type === 'fall' ? 'fell to their doom' : null;
    const wname = opts && opts.weapon ? opts.weapon.name : opts && opts.type === 'explosion' ? 'explosion' : opts && opts.type === 'melee' ? 'harvesting tool' : '';
    const mine = killer === this.player || victim === this.player;
    const vn = victim === this.player ? '<b class="me">You</b>' : `<b>${victim.name}</b>`;
    const kn = killer === this.player ? '<b class="me">You</b>' : killer ? `<b>${killer.name}</b>` : '';
    if (how || !killer || killer === victim) this.hud.killFeed(`${vn} ${how || 'was eliminated'}`, mine);
    else this.hud.killFeed(`${kn} <span class="w">[${wname}${opts && opts.headshot ? ' ✦' : ''}]</span> ${vn}`, mine);
    if (killer === this.player && victim !== this.player) {
      this.stats.kills++;
      this.audio.ui('elim', 0.6);
      this.hud.elimBanner(victim.name);
    }
    if (victim === this.player) {
      this.audio.ui('death', 0.6);
      this.playerCtl.spectate = killer && killer !== victim && killer.alive ? killer : null;
      this.playerCtl.editing = null;
      this.player.buildMode = false;
      this.build.hidePreview();
      setTimeout(() => { if (this.state === 'match' && !this.ended) this.endMatch(false); }, 2200);
    }
    if (this.aliveCount <= 1) {
      const w = this.actors.find((a) => a.alive);
      if (w === this.player) {
        this.audio.ui('victory', 0.7);
        this.player.emote = true;
        setTimeout(() => this.endMatch(true), 2500);
      } else if (w) {
        this.hud.notify(`${w.name} won the match`, '');
      }
    } else if (this.aliveCount <= 10 && victim !== this.player && this.player.alive) {
      if (this.aliveCount === 10 || this.aliveCount === 5 || this.aliveCount === 2) this.hud.notify(`${this.aliveCount} players remain`, '', 'small');
    }
  }

  onJump(a) { if (a === this.player) { this.audio.ui('jump', 0.4); this.hud.notify('Skydiving', 'Glider deploys automatically near the ground'); } }
  onGlide(a) { if (a.lod === 0) this.audio.playAt('glider', a.pos, 0.6); }
  onLand(a) {
    if (a === this.player) this.playerLanded = this.time;
  }
  onBuild(a, p) {}
  onHarvest(a, mat, n) {}
  onChestOpened(a, c) {}
  onItemUsed(a, it) { if (a === this.player) this.stats.heals++; }
  onPickup(a, it) {}
  onStormPhase(phase, state) {
    if (!this.player) return;
    const P = STORM_PHASES[phase];
    if (state === 'wait') {
      if (phase === 0) this.hud.notify('The storm eye has formed', `Get to the safe zone · shrinks in ${Math.round(P.wait * this.storm.scale)}s`, 'storm');
      else this.hud.notify('Safe zone revealed', `Storm shrinks in ${Math.round(P.wait * this.storm.scale)}s`, 'storm');
    } else {
      this.hud.notify('The storm is shrinking!', P.moving ? 'Final zone is moving' : `Damage: ${P.dmg} per second`, 'storm');
      this.audio.ui('alert', 0.4);
    }
  }
  onSupplyDrop(d) { this.hud.notify('Supply drop incoming!', 'Marked on your map', 'drop'); }

  // ---------------- per-frame ----------------
  update(rawDt) {
    this.realDt = rawDt;
    if (this.state !== 'match') return;
    const dt = Math.min(0.05, rawDt) * this.timeScale;
    if (this.paused) { this.input.endFrame(); this.render(); return; }
    // integrate in sub-steps when time scale is high (tests)
    const steps = Math.max(1, Math.ceil(dt / 0.05));
    for (let i = 0; i < steps; i++) this.step(dt / steps);
    this.input.endFrame();
    this.playerCtl.updateCamera(rawDt);
    this.hud.update(rawDt);
    this.render();
  }

  step(dt) {
    this.time += dt;
    const p = this.player;
    // player input
    this.playerCtl.update(dt);
    // bus
    this.bus.update(dt);
    if (this.bus.finished) {
      for (const a of this.actors) if (a.mode === 'bus' && a.alive) a.jumpFromBus();
      if (!this.storm.started) this.storm.start();
    }
    // LOD by distance to the camera / focus
    const cam = this.camera.position;
    for (const a of this.actors) {
      if (!a.alive) continue;
      const d = Math.hypot(a.pos.x - cam.x, a.pos.z - cam.z);
      a.lod = d < 130 ? 0 : d < 350 ? 1 : 2;
      a.camDist = d;
    }
    // AI brains then physics
    for (const a of this.actors) if (a.brain && a.alive) a.brain.update(dt);
    for (const a of this.actors) a.update(dt);
    this.build.update(dt);
    this.combat.update(dt);
    this.storm.update(dt);
    // storm damage (1 tick per second)
    this.stormTickT -= dt;
    if (this.stormTickT <= 0 && this.storm.started) {
      this.stormTickT = 1;
      for (const a of this.actors) {
        if (!a.alive || a.mode === 'bus' || a.mode === 'skydive') continue;
        if (this.storm.inStorm(a.pos.x, a.pos.z)) a.takeDamage(this.storm.dmg, null, { bypassShield: true, type: 'storm' });
      }
    }
    // supply drops
    for (const s of this.supplyPlan) {
      if (s.done || this.storm.phase !== s.phase || this.storm.state !== 'wait') continue;
      s.done = true;
      const n = this.storm.next;
      const ang = rand(0, Math.PI * 2), r = rand(0, n.r * 0.7);
      let x = n.x + Math.cos(ang) * r, z = n.z + Math.sin(ang) * r;
      if (this.terrain.heightAt(x, z) < 0.5) { x = n.x; z = n.z; }
      this.loot.spawnSupplyDrop(x, z);
    }
    this.loot.update(dt, p.alive ? p.pos : cam);
    this.effects.update(dt);
    // contrails while skydiving
    if (p.mode === 'skydive' && p.ap.contrail && p.ap.contrail.color) {
      const c = p.ap.contrail.color === 'rainbow' ? new THREE.Color().setHSL((this.time * 0.5) % 1, 1, 0.6) : p.ap.contrail.color;
      const fx = Math.cos(p.yaw) * 0.5, fz = -Math.sin(p.yaw) * 0.5;
      this.effects.trail(p.pos.x + fx, p.pos.y + 0.9, p.pos.z + fz, c);
      this.effects.trail(p.pos.x - fx, p.pos.y + 0.9, p.pos.z - fz, c);
    }
    // trim sound events
    while (this.soundEvents.length && this.time - this.soundEvents[0].t > 3) this.soundEvents.shift();
    // audio loops
    if (this.audio.ctx) {
      const inStorm = p.alive && p.mode !== 'bus' && this.storm.started && this.storm.inStorm(p.pos.x, p.pos.z);
      const nearStorm = this.storm.started ? Math.max(0, 1 - Math.abs(this.storm.distOutside(this.camera.position.x, this.camera.position.z)) / 60) : 0;
      this.audio.setLoop('storm', inStorm ? 0.5 : nearStorm * 0.25, inStorm ? 300 : 160);
      const air = p.alive && (p.mode === 'skydive' || p.mode === 'glide');
      this.audio.setLoop('wind', air ? (p.mode === 'skydive' ? 0.35 : 0.15) : 0, air ? 600 + Math.abs(p.vel.y) * 20 : 400);
      this.audio.setLoop('engine', p.mode === 'bus' ? 0.07 : 0);
      // chest hum when close to an unopened chest
      let hum = 0;
      if (p.alive && p.mode === 'ground') {
        const cs = this.loot.chestsNear(p.pos.x, p.pos.z, 14, this._hc || (this._hc = []));
        for (const c of cs) if (!c.opened) hum = Math.max(hum, 1 - Math.hypot(c.x - p.pos.x, c.y - p.pos.y, c.z - p.pos.z) / 14);
      }
      this.audio.setLoop('hum', hum * 0.06);
    }
  }

  render() {
    const cam = this.camera;
    const focus = cam.position;
    // light follows the camera
    const so = this.sunOffset || new THREE.Vector3(80, 140, 50);
    const sx = Math.round(focus.x / 8) * 8, sz = Math.round(focus.z / 8) * 8;
    this.sun.position.set(sx + so.x, Math.max(0, focus.y - 20) + so.y, sz + so.z);
    this.sun.target.position.set(sx, Math.max(0, focus.y - 20), sz);
    this.skyDome.position.copy(focus);
    // visibility culling by render distance
    this.visT = (this.visT || 0) - 1;
    if (this.visT <= 0) {
      this.visT = 10;
      const rd = this.renderDist;
      this.terrain.updateVisibility(focus.x, focus.z, rd + (focus.y > 100 ? 400 : 0));
      this.world.updateVisibility(focus.x, focus.z, rd + (focus.y > 100 ? 250 : 0));
    }
    // characters
    this.chars.begin();
    const rd2 = (this.renderDist * 0.75) ** 2;
    const scoped = this.player && this.player.ads && this.player.held && this.player.held.def && this.player.held.def.scope;
    for (const a of this.actors) {
      if (!a.alive || a.mode === 'bus') continue;
      if (a === this.player && scoped) continue;
      const dx = a.pos.x - focus.x, dz = a.pos.z - focus.z;
      if (dx * dx + dz * dz > rd2) continue;
      this.chars.draw(this.poseOf(a), a.ap);
    }
    this.chars.end();
    this.renderer.render(this.scene, cam);
  }

  poseOf(a) {
    const P = this._pose || (this._pose = { held: {} });
    P.x = a.pos.x; P.y = a.pos.y; P.z = a.pos.z; P.yaw = a.yaw; P.pitch = a.pitch;
    P.phase = a.phase; P.speed = a.speed; P.crouch = a.crouching; P.grounded = a.grounded;
    P.flash = a.flash; P.dive = a.input.dive || 0; P.bank = a.bank || 0;
    P.swing = a.swingT > 0 ? a.swingT / 0.5 : 0;
    P.using = !!a.useItem;
    let st = 'ground';
    if (a.mode === 'skydive') st = 'skydive';
    else if (a.mode === 'glide') st = 'glide';
    else if (a.swimming) st = 'swim';
    else if (a.sliding) st = 'slide';
    else if (a.mantle) st = 'mantle';
    else if (a.emote) st = 'emote';
    P.state = st;
    const it = a.held;
    if (a.buildMode) P.held = null;
    else if (!it) { P.held = P._pick || (P._pick = { kind: 'pickaxe' }); }
    else if (it.kind === 'weapon') { P._gun = P._gun || { kind: 'gun' }; P._gun.len = it.def.len; P._gun.color = it.def.color; P._gun.rarityColor = RARITY[it.rarity].hex; P.held = P._gun; }
    else { P._item = P._item || { kind: 'item' }; P._item.color = it.def.color; P.held = P._item; }
    return P;
  }
}
