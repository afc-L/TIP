// App bootstrap: renderer, menu hangar scene, game lifecycle and main loop.
import * as THREE from 'three';
import './style.css';
import { profile, save } from './save.js';
import { Input } from './input.js';
import { initAudio, playMusic, sfx } from './audio.js';
import { Menus } from './menus.js';
import { Game } from './game.js';
import { MechModel, makePalette } from './mechModel.js';
import { FRAMES } from './data.js';
import { damp } from './util.js';
import { AIController } from './ai.js';
import { profile as _profile } from './save.js';

class App {
  constructor() {
    this.canvas = document.getElementById('c');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: profile.settings.quality !== 'low', powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.camera = new THREE.PerspectiveCamera(profile.settings.fov, innerWidth / innerHeight, 0.3, 1500);
    this.game = null;
    Input.init(this.canvas);
    this.buildHangar();
    this.menus = new Menus(this);
    this.applyGraphics();
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('pointerlockchange', () => this.onLockChange());
    window.addEventListener('keydown', (e) => {
      if (e.code !== 'Escape' || !this.game || this.game.ended) return;
      if (!this.game.paused) this.pause();
      else if (this.menus.screen === 'pause' && performance.now() - this.pausedAt > 350) this.resume();
    });
    // first interaction unlocks audio
    const unlock = () => { initAudio(); playMusic(this.game ? 'combat' : 'menu'); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
    window.addEventListener('pointerdown', unlock); window.addEventListener('keydown', unlock);
    // garage preview drag-rotate
    let drag = false, lx = 0;
    this.canvas.addEventListener('pointerdown', (e) => { if (!this.game) { drag = true; lx = e.clientX; } });
    window.addEventListener('pointerup', () => { drag = false; });
    window.addEventListener('pointermove', (e) => { if (drag && !this.game) { this.previewSpin += (e.clientX - lx) * 0.01; lx = e.clientX; } });
    this.canvas.addEventListener('wheel', (e) => { if (!this.game) this.previewZoom = Math.min(1.6, Math.max(0.7, this.previewZoom + Math.sign(e.deltaY) * 0.08)); }, { passive: true });
    document.getElementById('lockprompt').addEventListener('click', () => { if (this.game && !this.game.paused) Input.lock(); });
    this.canvas.addEventListener('click', () => { if (this.game && !this.game.paused && !this.game.ended && !Input.locked()) Input.lock(); });
    this.clock = new THREE.Clock();
    this.menus.show('main');
    document.getElementById('loading').remove();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  // ---------------- hangar (menu) scene ----------------
  buildHangar() {
    const s = this.hangar = new THREE.Scene();
    s.background = new THREE.Color(0x05080d);
    s.fog = new THREE.Fog(0x05080d, 30, 90);
    s.add(new THREE.HemisphereLight(0x8fb8ff, 0x101418, 0.9));
    const key = new THREE.SpotLight(0xffffff, 600, 80, 0.55, 0.5, 1.6);
    key.position.set(12, 22, 14); key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
    s.add(key, key.target);
    const rim = new THREE.SpotLight(0x29b6ff, 400, 60, 0.6, 0.6, 1.6); rim.position.set(-14, 10, -12); s.add(rim, rim.target);
    const warm = new THREE.PointLight(0xff8a3d, 60, 40, 2); warm.position.set(10, 3, -8); s.add(warm);
    // floor
    const floor = new THREE.Mesh(new THREE.CircleGeometry(60, 48), new THREE.MeshStandardMaterial({ color: 0x0d1117, metalness: 0.6, roughness: 0.5 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; s.add(floor);
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(7, 7.4, 0.4, 48), new THREE.MeshStandardMaterial({ color: 0x1b2330, metalness: 0.7, roughness: 0.35 }));
    pad.position.y = 0.2; pad.receiveShadow = true; s.add(pad);
    this.padRing = new THREE.Mesh(new THREE.TorusGeometry(7.2, 0.07, 6, 64), new THREE.MeshBasicMaterial({ color: 0x29d3ff }));
    this.padRing.rotation.x = Math.PI / 2; this.padRing.position.y = 0.42; s.add(this.padRing);
    const grid = new THREE.GridHelper(120, 60, 0x0f3550, 0x0b2233); grid.position.y = 0.01; s.add(grid);
    // backdrop: hangar pillars and gantries
    const pm = new THREE.MeshStandardMaterial({ color: 0x1a1f27, metalness: 0.6, roughness: 0.5, flatShading: true });
    const glow = new THREE.MeshBasicMaterial({ color: 0x1fa8ff });
    const warn = new THREE.MeshBasicMaterial({ color: 0xff7a1a });
    for (let i = 0; i < 10; i++) {
      const a = Math.PI * 0.15 + (i / 9) * Math.PI * 1.7;
      const x = Math.cos(a) * 30, z = Math.sin(a) * 30 - 6;
      const p = new THREE.Mesh(new THREE.BoxGeometry(2, 26, 2), pm); p.position.set(x, 13, z); s.add(p);
      const g = new THREE.Mesh(new THREE.BoxGeometry(0.15, 20, 0.15), i % 3 === 0 ? warn : glow); g.position.set(x, 12, z + 1.1); s.add(g);
    }
    const gant = new THREE.Mesh(new THREE.BoxGeometry(50, 1.2, 2), pm); gant.position.set(0, 18, -14); s.add(gant);
    const gl = new THREE.Mesh(new THREE.BoxGeometry(46, 0.15, 0.15), glow); gl.position.set(0, 17.3, -12.9); s.add(gl);
    // floating dust
    const n = 300, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) pos.set([(Math.random() - 0.5) * 60, Math.random() * 25, (Math.random() - 0.5) * 60], i * 3);
    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0x6fd6ff, size: 0.12, transparent: true, opacity: 0.6 }));
    s.add(this.dust);
    this.previewSpin = 0.6; this.previewZoom = 1; this.previewModel = null; this.previewKey = '';
    this.menuView = 'main'; this.camOff = new THREE.Vector3(); this.camT = 0;
  }
  setPreview(lo) {
    if (!lo) return;
    const key = JSON.stringify([lo.frame, lo.weapons]);
    if (key === this.previewKey) return;
    this.previewKey = key;
    if (this.previewModel) { this.hangar.remove(this.previewModel.root); this.previewModel.dispose(); }
    const m = new MechModel(FRAMES[lo.frame].model, makePalette('player', lo.frame), lo.weapons, { shadows: true, height: FRAMES[lo.frame].height });
    m.root.position.y = 0.4;
    this.hangar.add(m.root);
    this.previewModel = m;
  }
  setMenuView(v) { this.menuView = v; }

  // ---------------- settings ----------------
  applyGraphics() {
    const s = profile.settings;
    const pr = Math.min(window.devicePixelRatio || 1, 2) * s.renderScale * (s.quality === 'low' ? 0.85 : 1);
    this.renderer.setPixelRatio(Math.max(0.4, Math.min(pr, 2)));
    this.resize();
    if (this.game) this.game.effects.setScale(this.renderer.domElement.height * 0.5);
  }
  settingsChanged(k) {
    if (k === 'showFps' && this.game) this.game.hud.el.fps.style.display = profile.settings.showFps ? 'block' : 'none';
    if (k === 'damageNumbers' && this.game) this.game.effects.showNumbers = profile.settings.damageNumbers;
  }
  resize() {
    this.renderer.setSize(innerWidth, innerHeight, false);
    this.canvas.style.width = innerWidth + 'px'; this.canvas.style.height = innerHeight + 'px';
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    if (this.game) this.game.effects.setScale(this.renderer.domElement.height * 0.5);
  }

  // ---------------- game lifecycle ----------------
  startGame(cfg) {
    initAudio();
    if (this.game) this.endGame();
    this.lastCfg = cfg;
    this.camera.fov = profile.settings.fov; this.camera.updateProjectionMatrix();
    this.renderer.shadowMap.enabled = profile.settings.shadows && profile.settings.quality !== 'low';
    try {
      this.game = new Game(this, cfg);
    } catch (e) {
      console.error(e);
      this.game = null;
      this.menus.show('main');
      this.menus.toast('Failed to start match: ' + e.message);
      return;
    }
    this.game.effects.setScale(this.renderer.domElement.height * 0.5);
    // compile shaders up-front to avoid hitches
    try { this.renderer.compile(this.game.scene, this.camera); } catch (e) { /* ignore */ }
    Input.clearAll();
    document.body.classList.add('ingame');
    document.getElementById('lockprompt').classList.remove('hidden');
    Input.lock();
    this.clock.getDelta();
  }
  endGame() {
    if (!this.game) return;
    Input.unlock();
    this.game.dispose();
    this.game = null;
    this.renderer.shadowMap.enabled = true;
    document.body.classList.remove('ingame');
    document.getElementById('lockprompt').classList.add('hidden');
    this.menus.returnTo = 'main';
    playMusic('menu');
  }
  restart() {
    const cfg = this.lastCfg;
    this.endGame();
    this.menus.hide();
    this.startGame(cfg);
  }
  pause() {
    if (!this.game || this.game.ended) return;
    if (this.game.paused) return;
    this.game.paused = true;
    this.pausedAt = performance.now();
    Input.unlock();
    Input.clearAll();
    this.menus.show('pause');
  }
  resume() {
    if (!this.game) return;
    this.menus.hide();
    this.menus.returnTo = 'main';
    this.game.paused = false;
    this.applyGraphics();
    this.camera.fov = profile.settings.fov; this.camera.updateProjectionMatrix();
    Input.clearAll();
    Input.lock();
    this.clock.getDelta();
  }
  onLockChange() {
    const locked = Input.locked();
    document.getElementById('lockprompt').classList.toggle('hidden', locked || !this.game || this.game.paused || this.game.ended);
    if (!locked && this.game && !this.game.paused && !this.game.ended) this.pause();
  }
  showResults(r) {
    this.endGame();
    this.menus.showResults(r);
  }

  // ---------------- loop ----------------
  loop() {
    requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.1);
    if (this.game) {
      try { this.game.update(dt); } catch (e) { console.error(e); }
      if (this.game) this.renderer.render(this.game.scene, this.camera);
    } else {
      this.updateHangar(dt);
      this.renderer.render(this.hangar, this.camera);
    }
    Input.endFrame();
  }
  updateHangar(dt) {
    this.camT += dt;
    if (this.previewModel) {
      this.previewSpin += dt * 0.25;
      const m = this.previewModel;
      m.root.rotation.y = this.previewSpin;
      m.update(dt, { fwdSpeed: 0, sideSpeed: 0, maxSpeed: 10, onGround: true, vy: 0, aimPitch: Math.sin(this.camT * 0.5) * 0.08, torsoYaw: Math.sin(this.camT * 0.4) * 0.25, jet: 0 });
    }
    this.padRing.material.color.setHSL(0.55, 1, 0.45 + Math.sin(this.camT * 2) * 0.1);
    this.dust.rotation.y += dt * 0.02;
    const views = { main: [-5.5, 7, 19, -3, 4.5], garage: [0, 6.5, 18, 0, 4.2], side: [9, 7, 20, 6, 4.5], dim: [0, 9, 26, 0, 4] };
    const v = views[this.menuView] || views.main;
    const z = this.previewZoom;
    const tgt = new THREE.Vector3(v[0] * 0.6, v[1], v[2] * z);
    this.camOff.x = damp(this.camOff.x, tgt.x, 3, dt); this.camOff.y = damp(this.camOff.y, tgt.y, 3, dt); this.camOff.z = damp(this.camOff.z, tgt.z, 3, dt);
    this.camera.position.set(this.camOff.x + Math.sin(this.camT * 0.15) * 0.8, this.camOff.y, this.camOff.z);
    this.camera.lookAt(v[3], v[4], 0);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  try { window.app = new App(); window.__MAZ = { THREE, MechModel, makePalette, FRAMES, AIController, profile: _profile }; }
  catch (e) {
    console.error(e);
    const l = document.getElementById('loading');
    if (l) l.innerHTML = `<div style="color:#ff6a6a">Failed to start: ${e.message}<br>Your browser may not support WebGL.</div>`;
  }
});
