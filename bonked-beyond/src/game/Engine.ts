// Owns the renderer and the single requestAnimationFrame loop. Runs are created/destroyed here.
import * as THREE from 'three';
import { IN_RUN } from '../app/gameState';
import { MAP_MAP } from '../data/maps';
import { PASSIVE_MAP } from '../data/passives';
import type { PassiveId } from '../data/types';
import { WEAPON_MAX_LEVEL } from '../data/weapons';
import { useGame, type HudSnapshot } from '../store/gameStore';
import { getSettings, useSettings } from '../store/settingsStore';
import { CONFIG } from './GameConfig';
import { input } from './Input';
import { DamageNumbers } from './effects/DamageNumbers';
import { ParticleManager } from './effects/ParticleManager';
import { ScreenEffects } from './effects/ScreenEffects';
import { Vfx } from './effects/Vfx';
import { Run, type RunHooks, type RunOptions } from './Run';
import { Showcase } from './Showcase';
import { damp } from './util';
import { occlusionUniforms } from './world/occlusion';

const _ray = new THREE.Raycaster();
const _plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _hit = new THREE.Vector3();
const _v2 = new THREE.Vector2();

class Engine {
  renderer!: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(42, 1, 0.5, 400);
  showcase!: Showcase;
  particles!: ParticleManager;
  vfx!: Vfx;
  numbers!: DamageNumbers;
  screen!: ScreenEffects;
  run: Run | null = null;
  private hemi = new THREE.HemisphereLight('#ffffff', '#444444', 1.3);
  private sun = new THREE.DirectionalLight('#ffffff', 2.4);
  private host!: HTMLElement;
  private started = false;
  private last = 0;
  private hudT = 0;
  private camTarget = new THREE.Vector3();
  private fpsAcc = 0;
  private fpsFrames = 0;
  fps = 60;
  private slowFor = 0;
  private resScale = 1;
  private realTime = 0;
  frameCount = 0;
  loopCount = 0; // number of loops ever started (should always be 1)

  init(host: HTMLElement) {
    if (this.started) return;
    this.started = true;
    this.host = host;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.className = 'game-canvas';
    host.appendChild(this.renderer.domElement);
    this.scene.add(this.hemi, this.sun, this.sun.target);
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -30; sc.right = 30; sc.top = 30; sc.bottom = -30; sc.near = 1; sc.far = 80;
    this.sun.shadow.bias = -0.0008;
    const q = CONFIG.quality[getSettings().quality];
    this.particles = new ParticleManager(this.scene, CONFIG.quality.high.particles);
    this.vfx = new Vfx(this.scene);
    this.numbers = new DamageNumbers(host);
    this.screen = new ScreenEffects(host);
    this.showcase = new Showcase();
    this.applySettings();
    void q;
    useSettings.subscribe(() => this.applySettings());
    window.addEventListener('resize', () => this.resize());
    input.attach(host);
    this.resize();
    this.last = performance.now();
    this.loopCount++;
    const loop = (now: number) => {
      requestAnimationFrame(loop);
      this.frame(now);
    };
    requestAnimationFrame(loop);
  }

  private applySettings() {
    const s = getSettings();
    const q = CONFIG.quality[s.quality];
    this.sun.castShadow = q.shadows;
    this.particles.scale = s.reducedEffects ? 0.4 : s.quality === 'low' ? 0.6 : 1;
    this.vfx.reduced = s.reducedEffects;
    this.numbers.enabled = s.damageNumbers;
    this.resScale = 1;
    this.resize();
  }

  private resize() {
    if (!this.renderer) return;
    const w = window.innerWidth, h = window.innerHeight;
    const q = CONFIG.quality[getSettings().quality];
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pixelRatio) * this.resScale);
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  startRun(opts: RunOptions, hooks: RunHooks) {
    this.endRun();
    const map = MAP_MAP[opts.map];
    const pal = map.palette;
    this.scene.background = new THREE.Color(pal.sky);
    this.scene.fog = new THREE.Fog(pal.fog, 48, 115);
    this.hemi.color.set(pal.ambient);
    this.hemi.groundColor.set(pal.ground);
    this.hemi.intensity = opts.map === 'arena' ? 1.6 : 1.35;
    this.sun.color.set(pal.sun);
    this.sun.intensity = opts.map === 'arena' ? 2.0 : 2.5;
    const s = getSettings();
    const q = CONFIG.quality[s.quality];
    this.particles.clear();
    this.vfx.clear();
    this.numbers.clear();
    this.screen.reset();
    input.clearPresses();
    this.run = new Run(
      { scene: this.scene, particles: this.particles, vfx: this.vfx, numbers: this.numbers, screen: this.screen, quality: q },
      opts,
      hooks,
    );
    this.camTarget.set(0, 0, 0);
    this.updateCamera(1, true);
    this.hudT = 0;
  }

  endRun() {
    if (this.run) {
      this.run.dispose();
      this.run = null;
    }
    useGame.setState({ hud: null, boss: null, interact: null });
  }

  private updateCamera(dt: number, snap = false) {
    const run = this.run;
    if (!run) return;
    const s = getSettings();
    const p = run.player;
    const rate = snap ? 1000 : 3 + (1 - s.cameraSmoothing) * 12;
    const k = snap ? 1 : damp(rate, dt);
    this.camTarget.x += (p.x - this.camTarget.x) * k;
    this.camTarget.z += (p.z - this.camTarget.z) * k;
    const dist = 17 + s.cameraDistance * 14;
    const elev = THREE.MathUtils.degToRad(50);
    const shake = this.screen.shakeAmount;
    const sx = shake ? (Math.random() - 0.5) * shake * 1.6 : 0;
    const sz = shake ? (Math.random() - 0.5) * shake * 1.6 : 0;
    this.camera.position.set(this.camTarget.x + sx, Math.sin(elev) * dist, this.camTarget.z + Math.cos(elev) * dist + sz);
    this.camera.lookAt(this.camTarget.x + sx * 0.5, 0.5, this.camTarget.z + sz * 0.5);
    occlusionUniforms.uPlayer.value.set(p.x, 0, p.z);
    occlusionUniforms.uCam.value.copy(this.camera.position);
    this.sun.position.set(p.x + 14, 30, p.z + 10);
    this.sun.target.position.set(p.x, 0, p.z);
  }

  private frame(now: number) {
    this.frameCount++;
    const rawDt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.realTime += rawDt;
    // fps + adaptive resolution fallback
    this.fpsAcc += rawDt;
    this.fpsFrames++;
    if (this.fpsAcc >= 0.5) {
      this.fps = this.fpsFrames / this.fpsAcc;
      this.fpsAcc = 0;
      this.fpsFrames = 0;
      if (this.run && this.fps < 42) this.slowFor += 0.5; else this.slowFor = Math.max(0, this.slowFor - 0.5);
      if (this.slowFor >= 4 && this.resScale > 0.6) {
        this.resScale = Math.max(0.6, this.resScale - 0.15);
        this.slowFor = 0;
        this.resize();
      }
    }

    const screen = useGame.getState().screen;
    const run = this.run;
    if (run && IN_RUN.has(screen)) {
      if (screen === 'PLAYING') {
        input.update();
        const ts = this.screen.update(rawDt);
        const dt = rawDt * ts * (run.dead ? 0.45 : 1);
        this.updateAim();
        // two substeps when frames are long keep collisions stable
        if (dt > 1 / 40) { run.update(dt / 2); run.update(dt / 2); } else run.update(dt);
        this.particles.update(dt);
        this.vfx.update(dt);
        this.numbers.update(dt, this.camera);
        run.world.update(run.time, dt, run.player);
      } else if (screen === 'BOSS_INTRO') {
        run.updateIntro(rawDt);
        this.particles.update(rawDt);
        this.screen.update(rawDt);
        this.numbers.update(0, this.camera);
      } else {
        this.numbers.update(0, this.camera);
      }
      run.render(this.realTime);
      this.updateCamera(rawDt);
      this.renderer.render(this.scene, this.camera);
      this.hudT -= rawDt;
      if (this.hudT <= 0) { this.hudT = 0.1; this.pushHud(run); }
    } else if (run && (screen === 'GAME_OVER' || screen === 'VICTORY')) {
      // keep the final frame of the run visible behind the results
      this.particles.update(rawDt * 0.3);
      this.vfx.update(rawDt * 0.3);
      run.render(this.realTime);
      this.renderer.render(this.scene, this.camera);
    } else {
      this.showcase.update(rawDt, window.innerWidth / window.innerHeight);
      this.renderer.render(this.showcase.scene, this.showcase.camera);
    }
  }

  private updateAim() {
    const run = this.run!;
    if (!getSettings().mouseAim) { run.aimPoint = null; return; }
    _v2.set(input.state.mouseX, input.state.mouseY);
    _ray.setFromCamera(_v2, this.camera);
    if (_ray.ray.intersectPlane(_plane, _hit)) {
      run.aimPoint = run.aimPoint ?? { x: 0, z: 0 };
      run.aimPoint.x = _hit.x; run.aimPoint.z = _hit.z;
    }
    if (!input.mouseRecentlyActive()) run.aimPoint = null;
  }

  private pushHud(run: Run) {
    const p = run.player;
    const hud: HudSnapshot = {
      hp: p.hp, maxHp: run.stats.maxHp, shield: run.buffs.shield,
      xp: run.xp, xpNext: run.xpNext, level: run.level, time: run.time, kills: run.kills, gold: run.gold,
      weapons: run.weapons.list.map((w) => ({ id: w.id, icon: w.evolved ? w.def.evolution.icon : w.def.icon, level: w.level, max: WEAPON_MAX_LEVEL, color: w.def.color, evolved: w.evolved })),
      passives: (Object.entries(run.passives) as [PassiveId, number][]).filter(([, l]) => l > 0).map(([id, l]) => ({ id, icon: PASSIVE_MAP[id].icon, level: l, max: PASSIVE_MAP[id].maxLevel, color: PASSIVE_MAP[id].color })),
      dodgeReady: 1 - p.dodgeCd / CONFIG.player.dodgeCooldown,
      superCharge: run.superCharge,
      stamina: p.stamina / CONFIG.player.staminaMax,
      buffs: [
        ...(run.buffs.damage > 0 ? [{ id: 'damage', icon: '🌶️', left: run.buffs.damage }] : []),
        ...(run.buffs.frenzy > 0 ? [{ id: 'frenzy', icon: '⚡', left: run.buffs.frenzy }] : []),
        ...(run.buffs.shield > 0 ? [{ id: 'shield', icon: '🛡️', left: run.buffs.shield }] : []),
        ...(run.shrineStacks > 0 ? [{ id: 'shrine', icon: '🩸', left: -run.shrineStacks }] : []),
      ],
      fps: Math.round(this.fps),
      enemies: run.enemies.aliveCount,
    };
    const b = run.boss;
    const boss = b && b.state !== 'dying' ? { name: b.def.name, title: b.def.title, hp: Math.max(0, b.entity.hp), maxHp: b.entity.maxHp, enraged: b.enraged } : null;
    useGame.setState({ hud, boss, interact: run.interactText });
  }
}

export const engine = new Engine();
