// The game engine: owns the renderer, the world and every runtime system, and runs the main loop.
import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { World } from './world';
import { Input } from './input';
import { Vehicle, type DriveInput } from './vehicle';
import { Crowd, PlayerFigure, randomLook } from './character';
import { Actors, Pedestrians, angleDiff, type Actor } from './npcs';
import { Traffic } from './traffic';
import { ClubInterior, PENTHOUSE, Penthouse } from './interiors';
import { CasinoInterior } from './casino';
import { Yacht } from './yacht';
import { audio } from './audio';
import { BounceOff, Showoff, type Minigame } from './minigames';
import type { CollisionWorld } from './collision';
import { currentMission, useGame } from '../store';
import { useUI, notify } from '../uiStore';
import { useSettings } from '../settings';
import { POIS, POI_BY_ID, START_CAR, START_SPAWN, YACHT_BERTH, valetSpot, SEAWALL_X } from '../data/world';
import { VEHICLE_BY_ID } from '../data/vehicles';
import { OUTFIT_BY_ID, WATCH_BY_ID, levelFor } from '../data/catalog';
import { CREATOR_BY_ID } from '../data/creators';
import { BOUNCE_REACTIONS, CRASH_LINES, FAMOUS_CHATTER, LUXURY_REACTIONS, PED_CHATTER, VALET_LINES } from '../data/dialogue';
import { pick } from '../systems/format';
import { endgameReady } from '../data/missions';
import type { BounceStyle, Poi } from '../types';

type Mode = 'foot' | 'car' | 'boat';
type Interior = null | 'club' | 'casino' | 'penthouse' | 'yacht';

interface Interaction {
  label: string;
  dist: number;
  key?: 'E' | 'F';
  act: () => void;
}

interface Bubble {
  el: HTMLDivElement;
  pos: THREE.Vector3;
  ttl: number;
  room: string; // separate-scene interior the bubble belongs to ('' = city)
  follow?: { x: number; y: number; z: number };
}

const UP = new THREE.Vector3(0, 1, 0);

export let engine: Engine | null = null;

export class Engine {
  renderer!: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera!: THREE.PerspectiveCamera;
  world = new World();
  input!: Input;
  club!: ClubInterior;
  casino!: CasinoInterior;
  penthouse!: Penthouse;
  crowd = new Crowd(140);
  peds!: Pedestrians;
  actors!: Actors;
  traffic!: Traffic;
  player = new PlayerFigure();
  private playerLight = new THREE.PointLight('#ffe6c8', 0, 7, 1.5);
  car: Vehicle | null = null;
  yacht: Yacht | null = null;
  sky!: Sky;
  sun!: THREE.DirectionalLight;
  hemi!: THREE.HemisphereLight;
  ambient!: THREE.AmbientLight;
  stars!: THREE.Points;
  beacon!: THREE.Mesh;
  container!: HTMLElement;
  bubbleLayer!: HTMLElement;
  private unsubs: (() => void)[] = [];

  // runtime state
  mode: Mode = 'foot';
  interior: Interior = null;
  pos = new THREE.Vector3(START_SPAWN.x, 0.14, START_SPAWN.z);
  vel = new THREE.Vector3();
  vy = 0;
  grounded = true;
  yaw = START_SPAWN.yaw;
  camYaw = START_SPAWN.yaw;
  camPitch = 0.25;
  camMode = 0; // foot: 0 normal 1 close ; car: 0 chase 1 far 2 cockpit
  camOrbit = 0;
  orbitIdle = 0;
  camPos = new THREE.Vector3();
  yachtLocal = { x: 0, z: 0 };
  night = 0;
  t = 0;
  private hudT = 0;
  private spawnT = 0;
  private gameMinAcc = 0;
  private fpsAcc = 0;
  private fpsN = 0;
  private fps = 0;
  private bubbles: Bubble[] = [];
  private chatterT = 6;
  private crashT = 0;
  private lastValetPos = { x: 0, z: 0 };
  private valetTravel = 999;
  private maybachDist = 0;
  private interactions: Interaction[] = [];
  private currentPrompt: string | null = null;
  minigame: Minigame | null = null;
  private minigameEvent = '';
  private meetCrowd: { a: ReturnType<Crowd['add']> }[] = [];
  private fireworks: { pts: THREE.Points; vel: Float32Array; life: number }[] = [];
  private fireworksT = 0;
  private prevYaw = 0;
  private headlightsManual = false;
  private running = false;
  private disposed = false;
  private prevSpeedKmh = 0;
  private burnHeld = false;
  /** 0 = sober, 1 = passes out. Not saved: you always wake up sober. */
  drunk = 0;
  private drunkFilter = -1;
  private slurT = 8;

  // ---------------------------------------------------------------------------------- init
  async init(container: HTMLElement, bubbleLayer: HTMLElement, onProgress: (p: number, label: string) => void) {
    engine = this;
    this.container = container;
    this.bubbleLayer = bubbleLayer;
    const settings = useSettings.getState().s;
    const r = new THREE.WebGLRenderer({ antialias: settings.quality !== 'low', powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2) * settings.renderScale);
    r.setSize(container.clientWidth, container.clientHeight);
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 0.6;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.shadowMap.enabled = settings.shadows && settings.quality !== 'low';
    r.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(r.domElement);
    r.domElement.tabIndex = 0;
    this.renderer = r;
    this.camera = new THREE.PerspectiveCamera(settings.fov, container.clientWidth / container.clientHeight, 0.1, 3500);
    const pmrem = new THREE.PMREMGenerator(r);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.7;
    pmrem.dispose();
    this.scene.fog = new THREE.Fog('#cfe3f0', 250, 1400);
    onProgress(0.02, 'Waking up the city');
    await frame();
    this.setupSky();
    const steps = this.world.build(onProgress);
    for (const s of steps) {
      s();
      await frame();
    }
    this.scene.add(this.world.group);
    onProgress(0.9, 'Calling the valets');
    await frame();
    this.crowd.addTo(this.scene);
    this.peds = new Pedestrians(this.crowd, this.world.sidewalkLoops, 70);
    this.club = new ClubInterior();
    this.casino = new CasinoInterior();
    this.penthouse = new Penthouse(this.world.col);
    this.scene.add(this.penthouse.group);
    this.actors = new Actors(this.crowd, this.club.crowd, this.scene, this.club.scene);
    this.setupMeetCrowd();
    this.traffic = new Traffic(Math.round(22 * settings.trafficDensity));
    this.scene.add(this.traffic.group);
    this.scene.add(this.player.root);
    this.playerLight.position.set(0, 3, -2.2); // behind and above, on the camera side
    this.player.root.add(this.playerLight);
    // waypoint beacon
    this.beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 1.2, 300, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: '#ffd36a', transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, blending: THREE.AdditiveBlending }),
    );
    this.beacon.visible = false;
    this.scene.add(this.beacon);
    // game state -> world
    const g = useGame.getState().game;
    this.player.setOutfit(OUTFIT_BY_ID[g.equippedOutfit] ?? OUTFIT_BY_ID.starter);
    this.player.setWatch(g.equippedWatch ? WATCH_BY_ID[g.equippedWatch] : null);
    this.placeAtSpawn();
    this.spawnCar(g.activeVehicle, true);
    if (g.yacht) this.spawnYacht(g.yacht);
    this.actors.refresh(g);
    this.subscribe();
    this.input = new Input(r.domElement);
    this.input.onUIKey = (code) => this.uiKey(code);
    r.domElement.addEventListener('click', () => {
      audio.init();
      if (!useUI.getState().panel) this.input.requestLock();
    });
    window.addEventListener('resize', this.onResize);
    onProgress(1, 'Ready to flex');
    this.updateLighting(true);
    this.renderer.compile(this.scene, this.camera);
  }

  start() {
    if (this.running) return;
    this.running = true;
    let last = performance.now();
    this.renderer.setAnimationLoop(() => {
      const now = performance.now();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      this.tick(dt);
    });
  }

  dispose() {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    window.removeEventListener('resize', this.onResize);
    this.unsubs.forEach((u) => u());
    this.input?.dispose();
    audio.setMusic('none');
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
    this.bubbles.forEach((b) => b.el.remove());
    this.blackoutEl?.remove();
    if (engine === this) engine = null;
  }

  private onResize = () => {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  };

  applySettings() {
    const s = useSettings.getState().s;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2) * s.renderScale);
    this.onResize();
    this.camera.fov = s.fov;
    this.camera.updateProjectionMatrix();
    const shadows = s.shadows && s.quality !== 'low';
    if (this.renderer.shadowMap.enabled !== shadows) {
      this.renderer.shadowMap.enabled = shadows;
      this.sun.castShadow = shadows;
      this.scene.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
        if (!m) return;
        (Array.isArray(m) ? m : [m]).forEach((x) => (x.needsUpdate = true));
      });
    }
    this.sun.shadow.mapSize.setScalar(s.quality === 'high' ? 2048 : 1024);
    this.sun.shadow.map?.dispose();
    (this.sun.shadow as unknown as { map: THREE.WebGLRenderTarget | null }).map = null;
    audio.applyVolumes();
  }

  private setupSky() {
    this.sky = new Sky();
    this.sky.scale.setScalar(10000);
    const u = this.sky.material.uniforms;
    u.turbidity.value = 5;
    u.rayleigh.value = 1.4;
    u.mieCoefficient.value = 0.004;
    u.mieDirectionalG.value = 0.8;
    this.scene.add(this.sky);
    this.hemi = new THREE.HemisphereLight('#cfe8ff', '#6b5a45', 0.7);
    this.scene.add(this.hemi);
    this.ambient = new THREE.AmbientLight('#ffffff', 0.15);
    this.scene.add(this.ambient);
    const s = useSettings.getState().s;
    this.sun = new THREE.DirectionalLight('#fff3dd', 2.6);
    this.sun.castShadow = s.shadows && s.quality !== 'low';
    this.sun.shadow.mapSize.setScalar(s.quality === 'high' ? 2048 : 1024);
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -70;
    sc.right = sc.top = 70;
    sc.near = 1;
    sc.far = 600;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.04;
    this.scene.add(this.sun, this.sun.target);
    // stars
    const n = 1500;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const th = Math.random() * Math.PI * 2, ph = Math.random() * Math.PI * 0.45;
      pos[i * 3] = Math.cos(th) * Math.sin(ph) * 3000;
      pos[i * 3 + 1] = Math.cos(ph) * 3000;
      pos[i * 3 + 2] = Math.sin(th) * Math.sin(ph) * 3000;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(geo, new THREE.PointsMaterial({ color: '#fff', size: 3, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    this.scene.add(this.stars);
  }

  private setupMeetCrowd() {
    const p = POI_BY_ID.carmeet;
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const rr = 13 + (i % 3);
      const ag = this.crowd.add({ x: p.x + Math.cos(a) * rr, y: 0.15, z: p.z + Math.sin(a) * rr, yaw: Math.atan2(-Math.cos(a), -Math.sin(a)), speed: 0, phase: i, dance: 0, wave: 0, look: randomLook(), visible: true });
      this.meetCrowd.push({ a: ag });
    }
    const s = POI_BY_ID.showoff;
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const ag = this.crowd.add({ x: s.x + Math.cos(a) * 20, y: 0.15, z: s.z + Math.sin(a) * 20, yaw: Math.atan2(-Math.cos(a), -Math.sin(a)), speed: 0, phase: i, dance: 0, wave: 0, look: randomLook(), visible: true });
      this.meetCrowd.push({ a: ag });
    }
  }

  private subscribe() {
    this.unsubs.push(
      useGame.subscribe((s, prev) => {
        const g = s.game, p = prev.game;
        if (g.activeVehicle !== p.activeVehicle) this.spawnCar(g.activeVehicle, false);
        else if (g.mods[g.activeVehicle] !== p.mods[p.activeVehicle] && this.car) {
          const ok = this.car.applyMods(g.mods[g.activeVehicle]);
          if (!ok) this.spawnCar(g.activeVehicle, false);
        }
        if (g.equippedOutfit !== p.equippedOutfit) this.player.setOutfit(OUTFIT_BY_ID[g.equippedOutfit] ?? OUTFIT_BY_ID.starter);
        if (g.equippedWatch !== p.equippedWatch) this.player.setWatch(g.equippedWatch ? WATCH_BY_ID[g.equippedWatch] : null);
        if (g.yacht !== p.yacht || (g.yacht && g.yachtHull !== p.yachtHull)) {
          if (g.yacht) this.spawnYacht(g.yacht);
          else this.yacht?.dispose();
        }
        if (g.creators !== p.creators || g.cooldowns !== p.cooldowns || g.lostToRival !== p.lostToRival || g.day !== p.day || g.clout !== p.clout || g.contacts !== p.contacts)
          this.actors.refresh(g);
      }),
      useUI.subscribe((s, prev) => {
        if (s.panel !== prev.panel) {
          if (s.panel) this.input?.releaseLock();
          this.input?.setEnabled(!s.panel);
          audio.ui(s.panel ? 'open' : 'click');
        }
      }),
      useSettings.subscribe(() => audio.applyVolumes()),
    );
  }

  private uiKey(code: string): boolean {
    const ui = useUI.getState();
    if (ui.screen !== 'game') return false;
    const panel = ui.panel;
    if (code === 'Escape') {
      if (panel === 'finale') return true;
      if (panel) ui.close();
      else ui.open('pause');
      return true;
    }
    if (panel && panel !== 'phone' && panel !== 'map' && panel !== 'maybach') return false;
    if (code === 'Tab') {
      if (panel === 'phone') ui.close();
      else ui.open('phone');
      return true;
    }
    if (code === 'KeyM') {
      if (panel === 'map') ui.close();
      else ui.open('map');
      return true;
    }
    if (code === 'KeyV' && (this.car?.isMaybach || panel === 'maybach')) {
      if (panel === 'maybach') ui.close();
      else ui.open('maybach');
      return true;
    }
    return false;
  }

  // ---------------------------------------------------------------------------------- spawning
  private placeAtSpawn() {
    const g = useGame.getState().game;
    let { x, z, yaw } = g.spawn;
    const p = { x, z };
    const res = this.world.col.resolveCircle(p, 0.4, 0.14, 1.8);
    if (res.depth > 0.3 || !Number.isFinite(x) || !Number.isFinite(z) || x > SEAWALL_X || Math.abs(z) > 340 || x < -340) {
      x = START_SPAWN.x;
      z = START_SPAWN.z;
      yaw = START_SPAWN.yaw;
    } else {
      x = p.x;
      z = p.z;
    }
    this.pos.set(x, this.world.groundAt(x, z), z);
    this.yaw = yaw;
    this.camYaw = yaw;
  }

  spawnCar(id: string, initial: boolean) {
    const g = useGame.getState().game;
    const mods = g.mods[id] ?? VEHICLE_BY_ID[id].defaultMods;
    let x = START_CAR.x, z = START_CAR.z, yaw = START_CAR.yaw;
    const wasDriving = this.mode === 'car';
    if (this.car) {
      x = this.car.x;
      z = this.car.z;
      yaw = this.car.yaw;
      this.car.dispose();
    } else if (initial && (Math.hypot(this.pos.x - START_SPAWN.x, this.pos.z - START_SPAWN.z) > 2)) {
      // continue: park the car near the saved spawn
      const spot = this.findParking(this.pos.x, this.pos.z);
      x = spot.x;
      z = spot.z;
      yaw = spot.yaw;
    }
    const v = new Vehicle(id, mods);
    v.x = x;
    v.z = z;
    v.yaw = yaw;
    v.y = this.world.groundAt(x, z);
    v.occupied = wasDriving;
    this.car = v;
    this.scene.add(v.root);
    v.update(0.016, { throttle: 0, brake: 0, steer: 0, handbrake: false }, g.bounce, this.world.col, (a, b) => this.world.groundAt(a, b));
    if (wasDriving) v.root.visible = true;
  }

  private findParking(x: number, z: number) {
    const tries = [[4, 0], [-4, 0], [0, 4], [0, -4], [6, 3], [-6, 3], [6, -3], [-6, -3], [9, 0], [-9, 0], [0, 9], [0, -9]];
    for (const [dx, dz] of tries) {
      const p = { x: x + dx, z: z + dz };
      const r = this.world.col.resolveCircle(p, 2.8, 0.4, 1.4);
      if (!r.hit) return { x: p.x, z: p.z, yaw: Math.abs(dx) > Math.abs(dz) ? 0 : Math.PI / 2 };
    }
    return { x: START_CAR.x, z: START_CAR.z, yaw: START_CAR.yaw };
  }

  /** Valet delivery: brings the active vehicle next to the player. */
  deliverCar(): boolean {
    if (this.mode !== 'foot' || this.interior) return false;
    if (!this.car) return false;
    const spot = this.findParking(this.pos.x, this.pos.z);
    this.car.x = spot.x;
    this.car.z = spot.z;
    this.car.yaw = spot.yaw;
    this.car.speed = 0;
    return true;
  }

  private spawnYacht(id: string) {
    const wasOnBoard = this.interior === 'yacht' || this.mode === 'boat';
    let state: { x: number; z: number; yaw: number; docked: boolean } | null = null;
    if (this.yacht) {
      state = { x: this.yacht.x, z: this.yacht.z, yaw: this.yacht.yaw, docked: this.yacht.docked };
      this.yacht.dispose();
    }
    this.yacht = new Yacht(id, useGame.getState().game.yachtHull);
    if (state && !state.docked) {
      this.yacht.x = state.x;
      this.yacht.z = state.z;
      this.yacht.yaw = state.yaw;
      this.yacht.docked = false;
    }
    this.scene.add(this.yacht.root);
    if (wasOnBoard) this.yachtLocal = { x: 0, z: -this.yacht.layout.len * 0.3 };
  }

  // ---------------------------------------------------------------------------------- helpers
  say(text: string, x: number, y: number, z: number, ttl = 3.2, follow?: { x: number; y: number; z: number }) {
    let b = this.bubbles.find((bb) => bb.ttl <= 0);
    if (!b) {
      if (this.bubbles.length >= 5) b = this.bubbles.reduce((a, c) => (a.ttl < c.ttl ? a : c));
      else {
        const el = document.createElement('div');
        el.className = 'speech';
        this.bubbleLayer.appendChild(el);
        b = { el, pos: new THREE.Vector3(), ttl: 0, room: '' };
        this.bubbles.push(b);
      }
    }
    b.el.textContent = text;
    b.pos.set(x, y, z);
    b.ttl = ttl;
    b.room = this.sceneRoom();
    b.follow = follow;
  }

  /** Interiors rendered as their own scene ('' when the player is in the city scene). */
  sceneRoom(): '' | 'club' | 'casino' {
    return this.interior === 'club' || this.interior === 'casino' ? this.interior : '';
  }

  playerWorld() {
    if (this.mode === 'car' && this.car) return { x: this.car.x, z: this.car.z };
    if (this.mode === 'boat' && this.yacht) return { x: this.yacht.x, z: this.yacht.z };
    const room = this.sceneRoom();
    if (room) {
      const p = POI_BY_ID[room];
      return { x: p.x, z: p.z };
    }
    return { x: this.pos.x, z: this.pos.z };
  }

  nearPoi(id: string, r = 30) {
    const p = POI_BY_ID[id];
    if (!p) return false;
    const w = this.playerWorld();
    if (this.sceneRoom()) return id === this.sceneRoom();
    if (this.interior === 'penthouse') return id === 'penthouse';
    if (this.interior === 'yacht' || this.mode === 'boat') return id === 'marina' && !!this.yacht && this.yacht.docked;
    return Math.hypot(w.x - p.x, w.z - p.z) < Math.max(r, p.radius);
  }

  context() {
    const g = useGame.getState().game;
    return {
      mode: this.mode,
      interior: this.interior,
      vehicleId: this.car?.def.id ?? g.activeVehicle,
      inCar: this.mode === 'car',
      bounceOn: !!(this.car?.isMaybach && g.bounce.enabled),
    };
  }

  setWaypoint(x: number, z: number, label: string) {
    useUI.getState().setWaypoint({ x, z, label });
  }

  // ---------------------------------------------------------------------------------- main loop
  private tick(dt: number) {
    if (this.disposed) return;
    const ui = useUI.getState();
    const paused = ui.panel === 'pause' || ui.panel === 'settings';
    this.input.pollGamepad();
    // fps
    this.fpsAcc += dt;
    this.fpsN++;
    if (this.fpsAcc > 0.5) {
      this.fps = Math.round(this.fpsN / this.fpsAcc);
      this.fpsAcc = 0;
      this.fpsN = 0;
    }
    if (paused) {
      audio.update({ driving: false, rpm: 0, throttle: 0, skid: 0, night: this.night, nearWater: 0, boat: 0, interior: this.interior, prestige: 0 });
      this.render();
      this.input.endFrame();
      return;
    }
    this.t += dt;
    const g = useGame.getState().game;
    // --- time of day (paused while menus are open so players never wait on real time)
    if (!ui.panel) {
      const s = useSettings.getState().s;
      this.gameMinAcc += dt * (1440 / (Math.max(2, s.dayLengthMinutes) * 60));
      if (this.gameMinAcc >= 2) {
        useGame.getState().advance(this.gameMinAcc);
        this.gameMinAcc = 0;
      }
    }
    this.updateLighting(false);
    this.updateDrunk(dt);

    // --- player / vehicle
    if (this.mode === 'foot') this.updateFoot(dt);
    else if (this.mode === 'car') this.updateCar(dt);
    else this.updateBoat(dt);
    if (this.car && this.mode !== 'car') {
      this.car.occupied = false;
      this.car.update(dt, { throttle: 0, brake: 0, steer: 0, handbrake: true }, g.bounce, this.world.col, (a, b) => this.world.groundAt(a, b));
    }
    if (this.yacht && this.mode !== 'boat') this.yacht.update(dt, this.t, null);

    // --- world systems
    const pw = this.playerWorld();
    const inCity = !this.sceneRoom();
    if (inCity) {
      const obstacles: { x: number; z: number; r: number }[] = [];
      if (this.car) obstacles.push({ x: this.car.x, z: this.car.z, r: 1.2 });
      if (this.mode === 'foot' && !this.interior) obstacles.push({ x: this.pos.x, z: this.pos.z, r: 0.5 });
      this.traffic.update(dt, obstacles);
      const carInfo = this.car && this.mode === 'car' ? { x: this.car.x, z: this.car.z, speed: this.car.speed, active: true, bounce: this.car.isMaybach && g.bounce.enabled && this.car.susp.blend > 0.5, style: g.bounce.style, prestige: this.car.def.prestige } : null;
      const ev = this.peds.update(dt, pw.x, pw.z, carInfo, this.interior === 'penthouse');
      if (ev) this.pedReaction(ev.ped.agent, ev.kind, g.bounce.style);
      this.actors.update(dt, this.t, pw.x, pw.z, null);
      this.updateMeetCrowd(dt);
      this.ambientChatter(dt, pw);
      this.world.update(dt, this.t);
      this.crowd.update(dt, this.t);
    } else if (this.interior === 'casino') {
      this.casino.update(dt, this.t);
    } else {
      this.club.update(dt, this.t);
      this.actors.update(dt, this.t, this.pos.x, this.pos.z, 'club');
      this.club.setAttendance(g.properties.includes('club') ? Math.min(1, 0.4 + g.club.upgrades.length * 0.1) : 0.6);
    }
    this.updateMinigame(dt);
    this.updateFireworks(dt);
    this.updateStats(dt, g);
    this.updateCamera(dt);
    this.updateBeacon();
    this.updateBubbles(dt);
    // audio
    const car = this.car;
    const driving = this.mode === 'car' && !!car;
    const rpm = driving && car ? Math.min(1, Math.abs(car.speed) / car.def.topSpeed) : 0;
    const thr = driving ? (this.input.down_('KeyW') ? 1 : this.input.gp.rt) : 0;
    const skid = driving && car ? Math.min(1, Math.abs(car.lat) / 6 + (car.braking && Math.abs(car.speed) > 12 ? 0.4 : 0)) : 0;
    const nearWater = Math.max(0, 1 - Math.abs(pw.x - SEAWALL_X) / 60);
    audio.update({ driving, rpm, throttle: thr, skid, night: this.night, nearWater: this.sceneRoom() ? 0 : nearWater, boat: this.mode === 'boat' && this.yacht ? 0.3 + Math.min(1, Math.abs(this.yacht.speed) / 10) : 0, interior: this.interior, prestige: car?.def.prestige ?? 5 });
    const nearClub = Math.hypot(pw.x - POI_BY_ID.club.x, pw.z - POI_BY_ID.club.z) < 45;
    if (this.interior === 'club') audio.setMusic('club');
    else if (this.interior === 'casino') audio.setMusic('lounge');
    else if (nearClub && this.interior === null) audio.setMusic('club', true);
    else if (this.interior === 'yacht' || this.interior === 'penthouse') audio.setMusic('party');
    else audio.setMusic(useSettings.getState().s.musicVolume > 0 ? 'lounge' : 'none');
    // car bounce sound effects
    if (car && driving && car.bounceEvents.length) {
      const vol = g.bounce.sfxVolume;
      for (const e of car.bounceEvents) audio.hydraulic(e.kind, e.strength, vol);
    }
    this.render();
    // HUD push (10 Hz)
    this.hudT -= dt;
    if (this.hudT <= 0) {
      this.hudT = 0.1;
      this.pushHud();
    }
    this.input.endFrame();
  }

  private render() {
    const scene = this.interior === 'club' ? this.club.scene : this.interior === 'casino' ? this.casino.scene : this.scene;
    // the player figure belongs to whichever scene is being drawn (VOLT and the casino are separate scenes)
    if (this.player.root.parent !== scene) scene.add(this.player.root);
    // dark rooms: a soft light that follows the player so they don't vanish into the dancefloor
    this.playerLight.intensity = this.interior === 'club' ? 30 : this.interior === 'casino' ? 8 : 0;
    this.renderer.render(scene, this.camera);
  }

  // ---------------------------------------------------------------------------------- lighting
  updateLighting(force: boolean) {
    const m = useGame.getState().game.minute;
    const rise = 6.5 * 60, set = 19.75 * 60;
    let sunY: number, sx: number;
    if (m >= rise && m <= set) {
      const p = (m - rise) / (set - rise);
      sunY = Math.sin(p * Math.PI);
      sx = Math.cos(p * Math.PI);
    } else {
      const nm = m > set ? m - set : m + 1440 - set;
      const p = nm / (1440 - (set - rise));
      sunY = -Math.sin(p * Math.PI) * 0.6;
      sx = -Math.cos(p * Math.PI);
    }
    const dir = new THREE.Vector3(sx, Math.max(-0.4, sunY), 0.35).normalize();
    const n = THREE.MathUtils.clamp(1 - (sunY + 0.06) / 0.28, 0, 1);
    if (!force && Math.abs(n - this.night) < 0.002 && this.t % 1 > 0.05) {
      this.followShadow(dir);
      return;
    }
    this.night = n;
    const u = this.sky.material.uniforms;
    u.sunPosition.value.copy(dir).multiplyScalar(1000);
    u.rayleigh.value = 1.2 + n * 1.5;
    const warm = THREE.MathUtils.clamp(1 - sunY / 0.35, 0, 1) * (1 - n);
    this.sun.color.setRGB(1, 0.95 - warm * 0.3, 0.88 - warm * 0.5);
    this.sun.intensity = Math.max(0, sunY) > 0 ? 0.6 + Math.sqrt(Math.max(0, sunY)) * 2.4 : 0;
    this.hemi.intensity = 0.25 + (1 - n) * 0.55;
    this.hemi.color.set(n > 0.5 ? '#5470a8' : '#cfe8ff');
    this.ambient.intensity = 0.12 + n * 0.32;
    this.ambient.color.set(n > 0.5 ? '#8a9bd8' : '#ffffff');
    const fog = this.scene.fog as THREE.Fog;
    fog.color.setRGB(0.81 - n * 0.75 + warm * 0.1, 0.89 - n * 0.83 - warm * 0.05, 0.94 - n * 0.82 - warm * 0.2);
    this.scene.environmentIntensity = 0.25 + (1 - n) * 0.5;
    (this.stars.material as THREE.PointsMaterial).opacity = n * 0.9;
    this.renderer.toneMappingExposure = 0.55 + n * 0.25;
    this.world.setNight(n);
    const wm = this.world.water.mat.uniforms;
    wm.uSunDir.value.copy(dir);
    wm.uNight.value = n;
    wm.uSky.value.set(n > 0.5 ? '#0d1a33' : '#9fd3ff');
    if (this.yacht) this.yacht.lights.color.setScalar(0.5 + n * 0.5);
    this.penthouse.light.intensity = n * 40 + 8;
    this.followShadow(dir);
  }

  private followShadow(dir: THREE.Vector3) {
    const pw = this.playerWorld();
    const y = this.interior === 'penthouse' ? PENTHOUSE.y : 0;
    this.sun.target.position.set(pw.x, y, pw.z);
    this.sun.position.set(pw.x + dir.x * 250, y + Math.max(30, dir.y * 250), pw.z + dir.z * 250);
  }

  // ---------------------------------------------------------------------------------- on foot
  private colWorld(): CollisionWorld {
    return this.interior === 'club' ? this.club.col : this.interior === 'casino' ? this.casino.col : this.world.col;
  }

  private floorAt(x: number, z: number) {
    if (this.sceneRoom()) return 0;
    if (this.interior === 'penthouse') return PENTHOUSE.y;
    return this.world.groundAt(x, z);
  }

  private updateFoot(dt: number) {
    const inp = this.input;
    const m = inp.consumeMouse();
    this.camYaw -= m.dx;
    this.camPitch = THREE.MathUtils.clamp(this.camPitch + m.dy, -0.45, 1.15);
    if (inp.hit('KeyC')) this.camMode = (this.camMode + 1) % 2;
    const ax = inp.axes();
    if (this.drunk > 0.05 && (ax.x || ax.y)) {
      // drunk stagger: drift sideways and wander
      ax.x += Math.sin(this.t * 1.7) * 0.7 * this.drunk + Math.sin(this.t * 4.3) * 0.25 * this.drunk;
      ax.y *= 1 - 0.3 * this.drunk;
    }
    const fx = Math.sin(this.camYaw), fz = Math.cos(this.camYaw);
    const rx = -fz, rz = fx;
    let mx = fx * ax.y + rx * ax.x, mz = fz * ax.y + rz * ax.x;
    const ml = Math.hypot(mx, mz);
    if (ml > 1) {
      mx /= ml;
      mz /= ml;
    }
    const sprint = inp.down_('ShiftLeft') || inp.down_('ShiftRight') || inp.gp.lb;
    const maxSp = sprint ? 6.8 : 3.3;
    const ease = this.grounded ? 10 : 2;
    this.vel.x += (mx * maxSp - this.vel.x) * Math.min(1, dt * ease);
    this.vel.z += (mz * maxSp - this.vel.z) * Math.min(1, dt * ease);
    if (this.grounded && inp.hit('Space')) {
      this.vy = 5.4;
      this.grounded = false;
    }
    const hsp = Math.hypot(this.vel.x, this.vel.z);
    if (hsp > 0.3) this.yaw += angleDiff(Math.atan2(this.vel.x, this.vel.z), this.yaw) * Math.min(1, dt * 12);

    if (this.interior === 'yacht' && this.yacht) {
      // move in yacht-local coordinates
      const c = Math.cos(-this.yacht.yaw), s = Math.sin(-this.yacht.yaw);
      const lvx = this.vel.x * c + this.vel.z * s;
      const lvz = -this.vel.x * s + this.vel.z * c;
      this.yachtLocal.x += lvx * dt;
      this.yachtLocal.z += lvz * dt;
      this.yacht.clampDeck(this.yachtLocal);
      const w = this.yacht.localToWorld(this.yachtLocal.x, this.yachtLocal.z);
      const deck = this.yacht.root.position.y + this.yacht.layout.deckY + 0.06;
      this.pos.x = w.x;
      this.pos.z = w.z;
      this.vy -= 15 * dt;
      this.pos.y += this.vy * dt;
      if (this.pos.y <= deck) {
        this.pos.y = deck;
        this.vy = 0;
        this.grounded = true;
      }
    } else {
      this.pos.x += this.vel.x * dt;
      this.pos.z += this.vel.z * dt;
      const p = { x: this.pos.x, z: this.pos.z };
      this.colWorld().resolveCircle(p, 0.35, this.pos.y + 0.3, 1.5);
      this.pos.x = p.x;
      this.pos.z = p.z;
      if (this.interior === 'penthouse') {
        const h = PENTHOUSE.size / 2 - 0.4;
        this.pos.x = THREE.MathUtils.clamp(this.pos.x, PENTHOUSE.cx - h, PENTHOUSE.cx + h);
        this.pos.z = THREE.MathUtils.clamp(this.pos.z, PENTHOUSE.cz - h, PENTHOUSE.cz + h);
      }
      const floor = this.floorAt(this.pos.x, this.pos.z);
      this.vy -= 15 * dt;
      this.pos.y += this.vy * dt;
      if (this.pos.y <= floor) {
        this.pos.y = floor;
        this.vy = 0;
        this.grounded = true;
      } else if (this.pos.y > floor + 0.05) this.grounded = this.vy === 0 && this.pos.y - floor < 0.2;
      if (this.grounded && this.pos.y - floor < 0.25 && this.vy <= 0) this.pos.y += (floor - this.pos.y) * Math.min(1, dt * 15);
    }
    this.player.root.visible = true;
    this.player.root.position.copy(this.pos);
    this.player.root.rotation.y = this.yaw;
    this.player.animate(dt, hsp, !this.grounded, this.t);
    this.player.root.rotation.z = Math.sin(this.t * 1.9) * 0.14 * this.drunk;
    this.player.root.rotation.x = Math.sin(this.t * 1.3 + 1) * 0.06 * this.drunk;
    // interactions
    this.collectFootInteractions();
    this.handleInteractions();
  }

  private collectFootInteractions() {
    const list: Interaction[] = [];
    const g = useGame.getState().game;
    const px = this.pos.x, pz = this.pos.z;
    const ui = useUI.getState();
    const near = (x: number, z: number) => Math.hypot(px - x, pz - z);
    if (this.interior === 'club') {
      for (const p of this.club.points) {
        const d = near(p.x, p.z);
        if (d < 2.6) list.push({ label: p.label, dist: d, act: () => this.clubPoint(p.id) });
      }
      for (const a of this.actors.list) if (a.interior === 'club') this.actorInteraction(a, list, near(a.agent.x, a.agent.z));
    } else if (this.interior === 'casino') {
      for (const p of this.casino.points) {
        const d = near(p.x, p.z);
        if (d < 2.6) list.push({ label: p.label, dist: d, act: () => this.casinoPoint(p.id) });
      }
    } else if (this.interior === 'penthouse') {
      for (const p of this.penthouse.points) {
        const d = near(p.x, p.z);
        if (d < 2.8) list.push({ label: p.label, dist: d, act: () => this.penthousePoint(p.id) });
      }
    } else if (this.interior === 'yacht' && this.yacht) {
      const L = this.yacht.layout;
      const lp = this.yachtLocal;
      const d = (x: number, z: number) => Math.hypot(lp.x - x, lp.z - z);
      if (d(L.helm.x, L.helm.z) < 2.2) list.push({ label: 'Take the helm', dist: d(L.helm.x, L.helm.z), act: () => this.takeHelm() });
      if (d(L.suite.x, L.suite.z) < 2.2) list.push({ label: 'Master suite: sleep & save', dist: d(L.suite.x, L.suite.z), act: () => this.sleepHere() });
      if (d(L.suite.x, L.salon.maxZ - 1) < 2.2) list.push({ label: 'Pop champagne ($300)', dist: d(L.suite.x, L.salon.maxZ - 1), act: () => this.drink('Yacht champagne', 300, 0.2, 1) });
      // leaving is always possible: walk off when docked, or take the tender back from anywhere on deck
      if (this.yacht.docked) list.push({ label: 'Leave the yacht', dist: 0, key: 'F', act: () => this.disembark() });
      else list.push({ label: 'Tender back to the marina', dist: 0, key: 'F', act: () => { this.yacht!.dock(); this.disembark(); } });
      if (d(L.party.x, L.party.z) < 3.5) {
        if (endgameReady(g) && !g.endgameCelebrated) list.push({ label: '👑 Throw the King of Brickell party', dist: 0.1, act: () => ui.open('finale') });
        else list.push({ label: 'Host a Yacht Party', dist: d(L.party.x, L.party.z), act: () => ui.startEvent('yachtparty') });
      }
    } else {
      // city
      for (const a of this.actors.list) {
        if (a.interior) continue;
        if (!a.agent.visible) continue;
        this.actorInteraction(a, list, near(a.agent.x, a.agent.z));
      }
      if (this.car) {
        const d = near(this.car.x, this.car.z);
        if (d < 3.6) list.push({ label: `Enter ${this.car.def.name}`, dist: d - 0.5, act: () => this.enterCar() });
      }
      for (const p of POIS) {
        const d = near(p.x, p.z);
        if (d < p.radius && p.kind !== 'carmeet' && p.kind !== 'showoff') list.push({ label: this.poiLabel(p), dist: d + 0.4, act: () => this.usePoi(p) });
        if ((p.kind === 'carmeet' || p.kind === 'showoff') && d < p.radius) list.push({ label: `${p.name}: events`, dist: d + 2, act: () => ui.open('venue', p.id) });
      }
    }
    this.interactions = list.sort((a, b) => a.dist - b.dist);
  }

  private actorInteraction(a: Actor, list: Interaction[], d: number) {
    if (d > 2.6) return;
    const g = useGame.getState().game;
    const ui = useUI.getState();
    let label = `Talk to ${a.name}`;
    if (a.kind === 'creator') {
      const def = CREATOR_BY_ID[a.id];
      label = g.creators[a.id] ? `Check in with ${def.name} (your client)` : `Talk to ${def.name} · ${def.niche}`;
    }
    if (a.kind === 'rival') label = `Talk to ${a.name} (rival)`;
    list.push({
      label,
      dist: a.kind === 'valet' || a.kind === 'bouncer' ? d + 3 : d, // doors beat staff small talk
      act: () => {
        a.talkT = 2;
        if (a.kind === 'creator') ui.startDialogue({ kind: 'creator', id: a.id });
        else if (a.kind === 'rival') ui.startDialogue({ kind: 'rival', id: a.id });
        else if (a.kind === 'contact') {
          useGame.getState().meetContact(a.id);
          ui.startDialogue({ kind: 'contact', id: a.id });
        } else if (a.kind === 'valet') {
          const tier = this.valetTier();
          this.say(pick(VALET_LINES[tier]).replace('{nick}', g.nickname), a.agent.x, a.agent.y + 2.1, a.agent.z);
        } else if (a.kind === 'bouncer') {
          const ok = g.properties.includes('club') || levelFor(g.clout) >= 2;
          this.say(ok ? (g.properties.includes('club') ? 'Evening, boss. Your club is packed.' : "You're on the list. Go on in.") : "Not on the list. Come back when you're a Brickell Regular.", a.agent.x, a.agent.y + 2.2, a.agent.z);
        }
      },
    });
  }

  private valetTier() {
    const lvl = levelFor(useGame.getState().game.clout);
    return lvl >= 6 ? 3 : lvl >= 3 ? 2 : lvl >= 1 ? 1 : 0;
  }

  private poiLabel(p: Poi) {
    const g = useGame.getState().game;
    switch (p.kind) {
      case 'home': return `Home · ${g.home === 'studio' ? 'Studio' : 'Residence'} (sleep, save, wardrobe)`;
      case 'dealer': return 'Browse Brickell Prestige Motors';
      case 'watch': return "Browse Tempo d'Oro watches";
      case 'clothes': return 'Shop Drip District';
      case 'garage': return 'Garage: swap & customize vehicles';
      case 'club': return g.properties.includes('club') ? 'Enter VOLT (you own it)' : 'Enter VOLT Nightclub';
      case 'penthouse': return g.properties.includes('penthouse') ? 'Elevator to your penthouse' : 'Aurum Tower lobby';
      case 'agency': return g.properties.includes('office') ? 'Your office: AlwaysFans Manager' : 'Suite 404 (for lease)';
      case 'hq': return g.properties.includes('hq') ? 'Agency HQ' : 'Brickell Agency HQ (for sale)';
      case 'marina': return 'Bayside Marina';
      case 'casino': return 'Enter The Gilded Flamingo Casino';
      default: return `${p.name}`;
    }
  }

  private usePoi(p: Poi) {
    const ui = useUI.getState();
    const g = useGame.getState().game;
    switch (p.kind) {
      case 'home': ui.open('home'); break;
      case 'dealer': ui.open('dealer'); break;
      case 'watch': ui.open('watch'); break;
      case 'clothes': ui.open('clothes'); break;
      case 'garage': ui.open('garage'); break;
      case 'marina': ui.open('marina'); break;
      case 'casino': this.enterCasino(); break;
      case 'club': {
        if (g.properties.includes('club') || levelFor(g.clout) >= 2) this.enterClub();
        else {
          const b = this.actors.list.find((a) => a.kind === 'bouncer');
          if (b) this.say("Not on the list. Come back when you're a Brickell Regular.", b.agent.x, b.agent.y + 2.2, b.agent.z);
          notify('VOLT requires the Brickell Regular clout level (or owning the club).', 'warn');
        }
        break;
      }
      case 'penthouse':
        if (g.properties.includes('penthouse')) this.enterPenthouse();
        else ui.open('property', 'penthouse');
        break;
      case 'agency':
        if (g.properties.includes('office')) {
          ui.setPhoneApp('alwaysfans');
          ui.open('phone');
        } else ui.open('property', 'office');
        break;
      case 'hq':
        ui.open(g.properties.includes('hq') ? 'venue' : 'property', g.properties.includes('hq') ? 'hq' : 'hq');
        break;
      default:
        ui.open('venue', p.id);
    }
  }

  private handleInteractions() {
    const top = this.interactions.find((i) => (i.key ?? 'E') === 'E');
    const f = this.interactions.find((i) => i.key === 'F');
    this.currentPrompt = [top ? `E · ${top.label}` : null, f ? `F · ${f.label}` : null].filter(Boolean).join('   ') || null;
    if (top && this.input.hit('KeyE')) {
      audio.ui('click');
      top.act();
    } else if (f && this.input.hit('KeyF')) {
      audio.ui('click');
      f.act();
    }
  }

  // --- interiors
  enterClub() {
    audio.door();
    this.interior = 'club';
    this.pos.set(this.club.spawn.x, 0, this.club.spawn.z);
    this.yaw = this.club.spawn.yaw;
    this.camYaw = this.yaw;
    this.vel.set(0, 0, 0);
    useGame.getState().stat('visit_club_inside');
    notify('Welcome to VOLT. ⚡', 'info');
  }

  exitClub() {
    audio.door();
    const p = POI_BY_ID.club;
    this.interior = null;
    this.pos.set(p.x + Math.sin(p.face) * 2, 0.14, p.z + Math.cos(p.face) * 2);
    this.yaw = p.face;
    this.camYaw = p.face;
  }

  enterCasino() {
    audio.door();
    this.interior = 'casino';
    this.pos.set(this.casino.spawn.x, 0, this.casino.spawn.z);
    this.yaw = this.casino.spawn.yaw;
    this.camYaw = this.yaw;
    this.vel.set(0, 0, 0);
    useGame.getState().stat('visit_casino_inside');
    notify('Welcome to The Gilded Flamingo. The house thanks you in advance. 🦩', 'info');
  }

  exitCasino() {
    audio.door();
    const p = POI_BY_ID.casino;
    this.interior = null;
    this.pos.set(p.x + Math.sin(p.face) * 2, 0.14, p.z + Math.cos(p.face) * 2);
    this.yaw = p.face;
    this.camYaw = p.face;
  }

  private casinoPoint(id: string) {
    const ui = useUI.getState();
    if (id === 'casino_exit') this.exitCasino();
    else if (id === 'casino_bar') ui.open('bar', 'casino');
    else if (id.startsWith('game_')) ui.open('casino', id.slice(5));
  }

  private clubPoint(id: string) {
    const g = useGame.getState();
    if (id === 'club_exit') this.exitClub();
    else if (id === 'club_office') {
      if (g.game.properties.includes('club')) useUI.getState().open('club');
      else {
        notify('Manager office. Private. (Buy VOLT to own the place.)', 'warn');
        useUI.getState().open('property', 'club');
      }
    } else if (id === 'club_bar') {
      useUI.getState().open('bar', 'volt');
    }
  }

  enterPenthouse() {
    audio.door();
    this.interior = 'penthouse';
    this.pos.set(PENTHOUSE.cx - 17, PENTHOUSE.y, PENTHOUSE.cz);
    this.yaw = Math.PI / 2;
    this.camYaw = this.yaw;
    this.vel.set(0, 0, 0);
    notify('Aurum Tower Penthouse. The whole bay is yours.', 'info');
  }

  private penthousePoint(id: string) {
    const ui = useUI.getState();
    if (id === 'ph_elevator') {
      audio.door();
      const p = POI_BY_ID.penthouse;
      this.interior = null;
      this.pos.set(p.x + Math.sin(p.face) * 2, 0.14, p.z + Math.cos(p.face) * 2);
      this.yaw = p.face;
      this.camYaw = p.face;
    } else if (id === 'ph_bed') {
      this.sleepHere();
    } else if (id === 'ph_wardrobe') ui.open('inspect');
    else if (id === 'ph_party') ui.startEvent('penthouse');
    else if (id === 'ph_bar') this.drink('Penthouse whiskey (the good one)', 0, 0.15);
  }

  boardYacht() {
    if (!this.yacht) return false;
    if (this.mode === 'car') return false;
    if (!this.yacht.docked) {
      notify('Your yacht is out on the bay. Bring it back to the berth first.', 'warn');
      return false;
    }
    audio.door();
    this.interior = 'yacht';
    this.yachtLocal = { x: this.yacht.layout.gangway.x - 1, z: this.yacht.layout.gangway.z };
    this.vel.set(0, 0, 0);
    this.camYaw = this.yacht.yaw + Math.PI / 2;
    useUI.getState().close();
    notify('Welcome aboard, Captain. Press F anytime to leave the yacht.', 'info');
    return true;
  }

  private disembark() {
    audio.door();
    this.interior = null;
    const p = POI_BY_ID.marina;
    this.pos.set(p.x - 2, 0.14, p.z);
    this.yaw = -Math.PI / 2;
    this.camYaw = this.yaw;
  }

  private takeHelm() {
    this.drunkDriveWarning('captain a yacht');
    this.mode = 'boat';
    this.player.root.visible = false;
    notify('At the helm. W/S throttle, A/D steer, E to leave the helm, F to dock near the berth.', 'info');
  }

  // ---------------------------------------------------------------------------------- drinking
  /** Have a drink. Returns false if the player couldn't pay. */
  drink(label: string, price: number, amount: number, clout = 0): boolean {
    const g = useGame.getState();
    if (price > 0 && !g.spend(price, label, 'purchases')) return false;
    this.drunk = Math.min(1.05, this.drunk + amount);
    g.stat('drinks');
    if (clout) g.addClout(clout, label);
    audio.ui('cash');
    const lvl = drunkLevel(this.drunk);
    notify(`${label} 🥂 · You feel ${lvl.toLowerCase()}.`, this.drunk > 0.7 ? 'warn' : 'info');
    if (this.interior === 'club' && this.drunk >= 0.75) g.stat('wastedAtVolt');
    if (this.blackedOut) {
      this.drunk = 1.05;
      notify("You blacked out. Your vision keeps cutting to black, and it won't wear off. Get to a bed and sleep it off.", 'bad');
      g.stat('blackouts');
    }
    return true;
  }

  /** Coffee helps a little. Time helps more. */
  soberUp(amount: number): boolean {
    if (this.blackedOut) {
      notify('Nothing helps now. You need to sleep it off.', 'warn');
      return false;
    }
    this.drunk = Math.max(0, this.drunk - amount);
    return true;
  }

  /** Fully blacked out: the drunkenness stops wearing off and only sleep fixes it. */
  get blackedOut() {
    return this.drunk >= 1;
  }

  /** Sleep in any bed (home, penthouse, yacht suite). Blacked out, you can crash at any hour. Always wakes you sober. */
  sleepHere(): boolean {
    const g = useGame.getState();
    if (!g.sleep(this.blackedOut)) return false;
    const wasOut = this.blackedOut;
    this.drunk = 0;
    g.save();
    if (wasOut) notify('You slept it off. Head pounding, wallet lighter, but you are sober.', 'info');
    return true;
  }

  /** Driving drunk is allowed; it just gets messy. A heads-up when you set off impaired. */
  private drunkDriveWarning(what: string) {
    if (this.drunk < 0.35) return;
    notify(`You're ${drunkLevel(this.drunk).toLowerCase()} and about to ${what}. Steering will wander and every crash costs clout.`, 'warn');
    this.say(pick(["I'm fine. I'm totally fine.", 'Hold my champagne.', 'The Maybach drives itself, basically.']), this.pos.x, this.pos.y + 2.1, this.pos.z);
  }

  /** Drunk steering: a slow wander, sudden lurches and sloppy throttle. */
  private drunkSteer(steer: number, throttle: number) {
    const d = this.drunk;
    if (d < 0.05) return { steer, throttle };
    const wander = Math.sin(this.t * 0.8) * 0.35 + Math.sin(this.t * 2.3 + 1) * 0.2;
    const lurch = Math.sin(this.t * 0.37) > 0.92 ? Math.sign(Math.sin(this.t * 5)) * 0.6 : 0;
    return {
      steer: Math.max(-1, Math.min(1, steer + (wander + lurch) * d)),
      throttle: throttle > 0 ? Math.max(0, Math.min(1, throttle + Math.sin(this.t * 1.6) * 0.35 * d)) : 0,
    };
  }

  private drunkCrashT = 0;

  /** Crashing while drunk: clout hit and the gossip accounts find out (rate-limited). */
  private drunkCrash() {
    if (this.drunk < 0.35 || this.t - this.drunkCrashT < 8) return;
    this.drunkCrashT = this.t;
    const g = useGame.getState();
    g.addClout(-8, 'Someone filmed that crash');
    g.stat('drunkCrashes');
    g.post('Brickell Tea', '@brickelltea', pick([
      `Was that ${g.game.nickname}'s car bouncing off a palm tree? 👀`,
      `${g.game.nickname} just parallel parked into a lamp post. Respectfully: call an Uber.`,
      `BREAKING: ${g.game.nickname} vs. Brickell Ave. Brickell Ave won.`,
    ]), 'npc');
  }

  /** Rideshare home: always available, ends any trip. */
  rideHome() {
    if (this.mode !== 'foot') return false;
    const g = useGame.getState();
    if (!g.spend(85, 'Rideshare home', 'other')) return false;
    if (this.yacht && !this.yacht.docked) this.yacht.dock();
    this.interior = null;
    const h = POI_BY_ID.home_modest;
    this.pos.set(h.x, this.world.groundAt(h.x, h.z), h.z - 1);
    this.yaw = Math.PI / 2;
    this.camYaw = this.yaw;
    this.vel.set(0, 0, 0);
    notify('Your driver had opinions about your playlist. You are home.', 'info');
    return true;
  }

  private blackoutEl: HTMLDivElement | null = null;
  private blackoutT = 0;

  private updateDrunk(dt: number) {
    // sobers up over roughly 90 seconds from fully drunk, unless blacked out (then only sleep helps)
    if (this.drunk > 0 && !this.blackedOut) this.drunk = Math.max(0, this.drunk - dt * 0.011);
    // blackout: 7 seconds of (blurry) vision, then ~3 seconds of black, on repeat
    if (!this.blackoutEl) {
      const el = document.createElement('div');
      el.style.cssText = 'position:absolute;inset:0;background:#000;opacity:0;pointer-events:none;z-index:30;transition:opacity .35s ease';
      (this.container.parentElement ?? this.container).appendChild(el);
      this.blackoutEl = el;
    }
    if (this.blackedOut) {
      this.blackoutT += dt;
      const black = this.blackoutT % 10 >= 7;
      this.blackoutEl.style.opacity = black ? '1' : '0';
    } else {
      this.blackoutT = 0;
      this.blackoutEl.style.opacity = '0';
    }
    const want = Math.round(this.drunk * 20) / 20;
    if (want !== this.drunkFilter) {
      this.drunkFilter = want;
      this.renderer.domElement.style.filter = want > 0.05 ? `blur(${(want * 2.4).toFixed(2)}px) saturate(${(1 + want * 0.7).toFixed(2)}) hue-rotate(${Math.round(want * 25)}deg)` : '';
    }
    if (this.drunk > 0.4 && this.mode === 'foot') {
      this.slurT -= dt;
      if (this.slurT <= 0) {
        this.slurT = 7 + Math.random() * 6;
        this.say(pick(SLURRED), this.pos.x, this.pos.y + 2.1, this.pos.z, 3, this.pos);
      }
    }
  }

  // ---------------------------------------------------------------------------------- car
  enterCar() {
    if (!this.car) return;
    this.drunkDriveWarning('drive');
    audio.init();
    audio.door();
    this.mode = 'car';
    this.car.occupied = true;
    this.player.root.visible = false;
    this.camMode = 0;
    this.camYaw = this.car.yaw;
    this.camOrbit = 0;
    const g = useGame.getState();
    if (!g.game.stats.maybachEntered) notify('W/S drive & brake · A/D steer · Space handbrake · B bounce · 1/2/3 style · C camera · E exit', 'info');
    if (this.car.isMaybach) g.stat('maybachEntered');
    this.valetTravel = 0;
    this.lastValetPos = { x: this.car.x, z: this.car.z };
  }

  private exitCar() {
    if (!this.car) return;
    if (Math.abs(this.car.speed) > 3) {
      notify('Slow down before getting out.', 'warn');
      return;
    }
    audio.door();
    const c = this.car;
    const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
    // driver door on the left (+x local)
    const lx = fz, lz = -fx;
    let placed = false;
    for (const side of [1, -1]) {
      const p = { x: c.x + lx * side * (c.def.width / 2 + 0.8), z: c.z + lz * side * (c.def.width / 2 + 0.8) };
      const r = this.world.col.resolveCircle({ ...p }, 0.35, 0.3, 1.5);
      if (!r.hit) {
        this.pos.set(p.x, this.world.groundAt(p.x, p.z), p.z);
        placed = true;
        break;
      }
    }
    if (!placed) this.pos.set(c.x - fx * (c.def.length / 2 + 1), this.world.groundAt(c.x, c.z), c.z - fz * (c.def.length / 2 + 1));
    this.mode = 'foot';
    c.occupied = false;
    this.yaw = c.yaw;
    this.camYaw = c.yaw;
    this.vel.set(0, 0, 0);
    this.player.root.visible = true;
    if (this.minigame) this.endMinigame(true);
  }

  private updateCar(dt: number) {
    const c = this.car;
    if (!c) {
      this.mode = 'foot';
      return;
    }
    const inp = this.input;
    const g = useGame.getState();
    const game = g.game;
    const m = inp.consumeMouse();
    if (Math.abs(m.dx) + Math.abs(m.dy) > 0.0005) {
      this.camOrbit -= m.dx;
      this.camPitch = THREE.MathUtils.clamp(this.camPitch + m.dy, -0.3, 1.0);
      this.orbitIdle = 0;
    } else this.orbitIdle += dt;
    if (inp.hit('KeyC')) this.camMode = (this.camMode + 1) % 3;
    const ax = inp.axes();
    const di: DriveInput = {
      throttle: Math.max(ax.y > 0 ? ax.y : 0, inp.gp.rt),
      brake: Math.max(ax.y < 0 ? -ax.y : 0, inp.gp.lt),
      steer: ax.x,
      handbrake: inp.down_('Space') || inp.gp.x,
    };
    const ds = this.drunkSteer(di.steer, di.throttle);
    di.steer = ds.steer;
    di.throttle = ds.throttle;
    this.burnHeld = inp.down_('KeyW') && inp.down_('KeyS');
    if (this.burnHeld) {
      di.throttle = 0;
      di.brake = 0;
      c.speed *= 0.9;
    }
    // Maybach controls
    if (c.isMaybach) {
      if (inp.hit('KeyB')) this.toggleBounce();
      const styles: [string, BounceStyle][] = [['Digit1', 'executive'], ['Digit2', 'brickell'], ['Digit3', 'miami']];
      for (const [k, st] of styles) if (inp.hit(k)) this.setBounceStyle(st);
      if (inp.hit('KeyZ')) g.setBounce({ intensity: Math.max(0, Math.round((game.bounce.intensity - 0.1) * 10) / 10) });
      if (inp.hit('KeyX')) g.setBounce({ intensity: Math.min(1, Math.round((game.bounce.intensity + 0.1) * 10) / 10) });
    } else if (inp.hit('KeyB')) notify('Hydraulic bounce is a Maybach exclusive. Swap to the Maybach at a garage.', 'warn');
    if (inp.hit('KeyH')) {
      audio.horn();
      this.honkReact();
    }
    if (inp.hit('KeyL')) this.headlightsManual = !this.headlightsManual;
    c.headlights = this.headlightsManual || this.night > 0.4;
    c.enableHeadlight(this.scene, c.headlights);
    c.bounceActive = game.bounce.enabled;
    const prevYaw = c.yaw;
    c.update(dt, di, game.bounce, this.world.col, (a, b) => this.world.groundAt(a, b));
    this.prevYaw = c.yaw - prevYaw;
    if (c.impact > 4) {
      audio.crash(c.impact);
      this.crashT = 0.5;
      this.drunkCrash();
    }
    // traffic collisions
    for (const tc of this.traffic.cars) {
      const dx = c.x - tc.x, dz = c.z - tc.z;
      const d = Math.hypot(dx, dz);
      const minD = c.def.width / 2 + 1.4;
      if (d < minD && d > 0.01) {
        const push = (minD - d) / d;
        c.x += dx * push;
        c.z += dz * push;
        if (Math.abs(c.speed) > 4) {
          audio.crash(Math.abs(c.speed));
          if (tc.honk <= 0) {
            tc.honk = 3;
            audio.horn();
            this.say(pick(CRASH_LINES), tc.x, 2.2, tc.z);
          }
        }
        if (Math.abs(c.speed) > 4) this.drunkCrash();
        c.speed *= 0.6;
        tc.speed = 0;
      }
    }
    // camera-relative waypoint distance & valet logic
    this.valetTravel += Math.hypot(c.x - this.lastValetPos.x, c.z - this.lastValetPos.z);
    this.lastValetPos = { x: c.x, z: c.z };
    if (c.isMaybach) {
      this.maybachDist += Math.abs(c.speed) * dt;
      if (this.maybachDist > 50 && !(game.stats.maybachDriven > 0)) g.stat('maybachDriven');
    }
    this.checkValet();
    // interactions in car
    const list: Interaction[] = [];
    if (Math.abs(c.speed) < 3) list.push({ label: 'Exit vehicle', dist: 5, key: 'E', act: () => this.exitCar() });
    for (const id of ['carmeet', 'showoff']) {
      const p = POI_BY_ID[id];
      if (Math.hypot(c.x - p.x, c.z - p.z) < p.radius + 4 && !this.minigame) list.push({ label: `${p.name}: events`, dist: 1, key: 'F', act: () => useUI.getState().open('venue', id) });
    }
    if (this.minigame) list.push({ label: 'Quit challenge', dist: 2, key: 'F', act: () => this.endMinigame(true) });
    this.interactions = list.sort((a, b) => a.dist - b.dist);
    const e = list.find((i) => i.key === 'E');
    const f = list.find((i) => i.key === 'F');
    this.currentPrompt = [f ? `F · ${f.label}` : null, e && Math.abs(c.speed) < 1 ? `E · ${e.label}` : null].filter(Boolean).join('   ') || null;
    if (e && inp.hit('KeyE')) e.act();
    if (f && inp.hit('KeyF')) f.act();
    this.pos.set(c.x, c.y, c.z);
  }

  toggleBounce() {
    const g = useGame.getState();
    const on = !g.game.bounce.enabled;
    g.setBounce({ enabled: on });
    if (on) {
      g.stat('bounceActivations');
      g.stat(`style_${g.game.bounce.style}`);
      audio.hydraulic('hop', 0.6, g.game.bounce.sfxVolume);
      notify(`Bounce mode ON · ${styleName(g.game.bounce.style)}`, 'info');
    } else notify('Bounce mode OFF · returning to ride height', 'info');
  }

  setBounceStyle(st: BounceStyle) {
    const g = useGame.getState();
    g.setBounce({ style: st });
    if (g.game.bounce.enabled) g.stat(`style_${st}`);
    notify(`Bounce style: ${styleName(st)}`, 'info');
  }

  private honkReact() {
    if (!this.car) return;
    for (const p of this.peds.peds) {
      if (Math.hypot(p.agent.x - this.car.x, p.agent.z - this.car.z) < 12 && Math.random() < 0.3) {
        p.react = 1.5;
        break;
      }
    }
  }

  private checkValet() {
    const c = this.car;
    if (!c || Math.abs(c.speed) > 1) return;
    const g = useGame.getState();
    const game = g.game;
    for (const p of POIS) {
      if (!p.valet) continue;
      const s = valetSpot(p);
      if (Math.hypot(c.x - s.x, c.z - s.z) > 7) continue;
      if (game.valetDone[p.id] === game.day) return;
      if (this.valetTravel < 120) return;
      this.valetTravel = 0;
      const lvl = levelFor(game.clout);
      const mods = game.mods[c.def.id];
      const bounce = c.isMaybach && game.bounce.enabled;
      const score = Math.min(100, Math.round(c.def.prestige * 5.5 + lvl * 4 + (bounce ? 16 : 0) + (mods?.underglow ? 4 : 0) + (mods && mods.engine + mods.handling > 0 ? 4 : 0) + (game.equippedWatch ? 5 : 0) + Math.random() * 8));
      let tier = this.valetTier();
      if (bounce && tier < 3 && score > 70) tier = Math.min(3, tier + 1);
      const valet = this.actors.list.find((a) => a.kind === 'valet' && a.poi === p.id);
      const line = bounce && Math.random() < 0.5 ? pick(BOUNCE_REACTIONS[game.bounce.style]) : pick(VALET_LINES[tier]).replace('{nick}', game.nickname);
      if (valet) this.say(line, valet.agent.x, valet.agent.y + 2.1, valet.agent.z, 4);
      g.valetFlex(p.id, score, tier);
      audio.crowdCheer(0.4);
      return;
    }
  }

  // ---------------------------------------------------------------------------------- boat
  private updateBoat(dt: number) {
    const y = this.yacht;
    if (!y) {
      this.mode = 'foot';
      this.interior = null;
      return;
    }
    const inp = this.input;
    const m = inp.consumeMouse();
    this.camOrbit -= m.dx;
    this.camPitch = THREE.MathUtils.clamp(this.camPitch + m.dy, -0.2, 1.0);
    const ax = inp.axes();
    const bs = this.drunkSteer(ax.x, Math.max(0, ax.y));
    y.update(dt, this.t, { throttle: bs.throttle, brake: Math.max(0, -ax.y), steer: bs.steer });
    this.yachtLocal = { x: y.layout.helm.x, z: y.layout.helm.z - 0.5 };
    const w = y.localToWorld(this.yachtLocal.x, this.yachtLocal.z);
    this.pos.set(w.x, y.root.position.y + y.layout.deckY, w.z);
    const list: Interaction[] = [{ label: 'Leave the helm', dist: 2, key: 'E', act: () => this.leaveHelm() }];
    if (!y.docked && y.nearBerth()) list.push({ label: 'Dock at the berth', dist: 1, key: 'F', act: () => { y.dock(); notify('Docked at Bayside Marina.', 'info'); } });
    else if (!y.docked) list.push({ label: 'Autopilot back to the berth', dist: 1, key: 'F', act: () => { y.dock(); notify('Autopilot engaged. Docked at Bayside Marina.', 'info'); } });
    this.interactions = list;
    this.currentPrompt = list.map((i) => `${i.key} · ${i.label}`).join('   ');
    for (const i of list) if (inp.hit(i.key === 'F' ? 'KeyF' : 'KeyE')) i.act();
  }

  private leaveHelm() {
    this.mode = 'foot';
    this.interior = 'yacht';
    this.player.root.visible = true;
    if (this.yacht) this.yacht.speed *= 0.5;
  }

  // ---------------------------------------------------------------------------------- minigames
  startMinigame(eventId: 'bounceoff' | 'showoff'): string | null {
    if (this.mode !== 'car' || !this.car) return 'You need to be driving to start this challenge.';
    const p = POI_BY_ID[eventId === 'bounceoff' ? 'carmeet' : 'showoff'];
    if (Math.hypot(this.car.x - p.x, this.car.z - p.z) > p.radius + 10) return `Drive to ${p.name} first.`;
    if (eventId === 'bounceoff' && !this.car.isMaybach) return 'The Bounce-Off is for the Maybach only. Hydraulics required.';
    this.minigame = eventId === 'bounceoff' ? new BounceOff() : new Showoff(this.car.isMaybach);
    this.minigameEvent = eventId;
    audio.crowdCheer(1);
    notify(eventId === 'bounceoff' ? 'BOUNCE-OFF STARTED! Follow the judge.' : 'MIAMI SHOWOFF STARTED! Complete each beat.', 'info');
    return null;
  }

  private updateMinigame(dt: number) {
    const mg = this.minigame;
    if (!mg || !this.car) return;
    const g = useGame.getState().game;
    const p = POI_BY_ID[mg.id === 'bounceoff' ? 'carmeet' : 'showoff'];
    const d = Math.hypot(this.car.x - p.x, this.car.z - p.z);
    mg.update({
      dt,
      inZone: d < 10,
      speed: Math.abs(this.car.speed),
      isMaybach: this.car.isMaybach,
      bounceOn: this.car.isMaybach && g.bounce.enabled,
      style: g.bounce.style,
      intensity: g.bounce.intensity,
      pressed: (code) => (code === '__burn' ? this.burnHeld : this.input.hit(code)),
      handbrake: this.input.down_('Space'),
      yawDelta: this.prevYaw,
      prestige: this.car.def.prestige,
      distCenter: d,
    });
    if (mg.done) this.endMinigame(false);
  }

  private endMinigame(quit: boolean) {
    const mg = this.minigame;
    if (!mg) return;
    this.minigame = null;
    if (quit) {
      notify('Challenge abandoned.', 'warn');
      return;
    }
    const res = useGame.getState().completeEvent(this.minigameEvent, mg.score);
    audio.crowdCheer(res.win ? 1.2 : 0.4);
    audio.ui(res.win ? 'achieve' : 'error');
    useUI.setState({
      panel: 'event',
      event: { eventId: this.minigameEvent },
      eventResult: { title: mg.id === 'bounceoff' ? 'Brickell Bounce-Off' : 'Miami Showoff', score: res.score, cash: res.cash, clout: res.clout, win: res.win, text: res.text },
    });
  }

  private updateMeetCrowd(dt: number) {
    const hype = this.minigame ? this.minigame.hype() : 0;
    const bounce = this.car && this.mode === 'car' && this.car.isMaybach && useGame.getState().game.bounce.enabled ? 0.5 : 0;
    const carPos = this.car;
    this.meetCrowd.forEach(({ a }, i) => {
      if (!a) return;
      const near = carPos ? Math.hypot(carPos.x - a.x, carPos.z - a.z) < 30 : false;
      const h = near ? Math.max(hype, bounce) : 0;
      a.wave = h > 0.6 ? 1 : 0;
      a.dance = h > 0.3 ? h * 0.8 : 0;
      if (near && carPos) a.yaw += angleDiff(Math.atan2(carPos.x - a.x, carPos.z - a.z), a.yaw) * Math.min(1, dt * 3);
      void i;
    });
  }

  // ---------------------------------------------------------------------------------- reactions & chatter
  private pedReaction(agent: { x: number; y: number; z: number }, kind: 'bounce' | 'luxury' | 'dodge' | 'fan', style: string) {
    const g = useGame.getState().game;
    let text = '';
    if (kind === 'bounce') {
      text = pick(BOUNCE_REACTIONS[style] ?? BOUNCE_REACTIONS.brickell);
      if (style !== 'executive') audio.crowdCheer(0.3);
      // reputation bonus for showing off near venues (rate-limited by ped cooldowns)
      const nearVenue = POIS.some((p) => (p.valet || p.kind === 'carmeet' || p.kind === 'showoff' || p.kind === 'cafe') && this.nearPoi(p.id, 40));
      if (nearVenue && Math.random() < 0.35) useGame.getState().addClout(1, 'The bounce went viral (a little)');
    } else if (kind === 'luxury') text = pick(LUXURY_REACTIONS).replace('{car}', this.car?.def.name ?? 'car');
    else if (kind === 'dodge') text = pick(CRASH_LINES);
    else if (kind === 'fan') {
      if (levelFor(g.clout) < 3) return;
      text = pick(FAMOUS_CHATTER).replace('{nick}', g.nickname);
    }
    this.say(text, agent.x, agent.y + 2.1, agent.z, 3, agent);
  }

  private ambientChatter(dt: number, pw: { x: number; z: number }) {
    this.chatterT -= dt;
    if (this.chatterT > 0 || this.mode !== 'foot' || this.interior) return;
    this.chatterT = 9 + Math.random() * 10;
    let best: { x: number; y: number; z: number } | null = null;
    let bd = 12;
    for (const p of this.peds.peds) {
      const d = Math.hypot(p.agent.x - pw.x, p.agent.z - pw.z);
      if (d < bd && p.agent.visible) {
        bd = d;
        best = p.agent;
      }
    }
    if (best) this.say(pick(PED_CHATTER), best.x, best.y + 2.1, best.z, 3.5, best);
  }

  private updateBubbles(dt: number) {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    const v = new THREE.Vector3();
    for (const b of this.bubbles) {
      if (b.ttl <= 0) {
        b.el.style.display = 'none';
        continue;
      }
      b.ttl -= dt;
      if (b.follow) b.pos.set(b.follow.x, b.follow.y + 2.1, b.follow.z);
      v.copy(b.pos).project(this.camera);
      const dist = this.camera.position.distanceTo(b.pos);
      if (v.z > 1 || dist > 60 || b.room !== this.sceneRoom()) {
        b.el.style.display = 'none';
        continue;
      }
      b.el.style.display = 'block';
      b.el.style.opacity = String(Math.min(1, b.ttl * 2));
      b.el.style.transform = `translate(-50%, -100%) translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px)`;
    }
  }

  // ---------------------------------------------------------------------------------- camera
  private updateCamera(dt: number) {
    const cam = this.camera;
    let target: THREE.Vector3;
    let desired: THREE.Vector3;
    const fovBase = useSettings.getState().s.fov;
    if (this.mode === 'car' && this.car) {
      const c = this.car;
      if (this.orbitIdle > 1.6 && Math.abs(c.speed) > 2) this.camOrbit *= Math.exp(-dt * 2.5);
      if (this.camMode === 2) {
        // cockpit: eye attached to the bouncing chassis
        const eye = c.parts.eye.clone();
        c.parts.chassis.updateMatrixWorld(true);
        eye.applyMatrix4(c.parts.chassis.matrixWorld);
        cam.position.copy(eye);
        const look = new THREE.Vector3(0, -0.6 - this.camPitch * 2.5, 10);
        look.applyAxisAngle(UP, THREE.MathUtils.clamp(this.camOrbit, -2.2, 2.2));
        look.add(c.parts.eye);
        look.applyMatrix4(c.parts.chassis.matrixWorld);
        cam.lookAt(look);
        cam.fov += (fovBase + 5 - cam.fov) * Math.min(1, dt * 4);
        cam.updateProjectionMatrix();
        this.camPos.copy(cam.position);
        return;
      }
      const dist = (this.camMode === 1 ? 11 : 7.2) + c.def.length * 0.25;
      const yaw = c.yaw + this.camOrbit;
      this.camYaw = yaw;
      const hgt = 2.2 + this.camPitch * 4 + (this.camMode === 1 ? 1.5 : 0);
      target = new THREE.Vector3(c.x, c.y + 1.3 + c.parts.chassis.position.y * 0.5, c.z);
      desired = new THREE.Vector3(c.x - Math.sin(yaw) * dist, c.y + hgt, c.z - Math.cos(yaw) * dist);
      const spd = Math.abs(c.speed);
      cam.fov += (fovBase + Math.min(14, spd * 0.25) - cam.fov) * Math.min(1, dt * 2);
    } else if (this.mode === 'boat' && this.yacht) {
      const y = this.yacht;
      const dist = y.layout.len * 1.1 + 12;
      const yaw = y.yaw + this.camOrbit;
      target = new THREE.Vector3(y.x, 4, y.z);
      desired = new THREE.Vector3(y.x - Math.sin(yaw) * dist, 6 + y.layout.len * 0.3 + this.camPitch * 10, y.z - Math.cos(yaw) * dist);
      cam.fov += (fovBase - cam.fov) * Math.min(1, dt * 2);
    } else {
      const close = this.camMode === 1;
      const dist = close ? 2.4 : 4.6;
      const yaw = this.camYaw;
      target = new THREE.Vector3(this.pos.x, this.pos.y + (close ? 1.65 : 1.55), this.pos.z);
      const cp = Math.cos(this.camPitch), sp = Math.sin(this.camPitch);
      desired = new THREE.Vector3(
        this.pos.x - Math.sin(yaw) * dist * cp + (close ? Math.cos(yaw) * -0.5 : 0),
        target.y + sp * dist + 0.2,
        this.pos.z - Math.cos(yaw) * dist * cp + (close ? Math.sin(yaw) * 0.5 : 0),
      );
      cam.fov += (fovBase - cam.fov) * Math.min(1, dt * 3);
    }
    cam.updateProjectionMatrix();
    // collision: pull the camera in front of walls
    if (this.interior !== 'yacht' && this.mode !== 'boat') {
      const col = this.colWorld();
      const t = col.raycast(target.x, target.y, target.z, desired.x, desired.y, desired.z);
      if (t < 1) desired.lerpVectors(target, desired, Math.max(0.05, t - 0.06));
    }
    const minY = (this.interior === 'penthouse' ? PENTHOUSE.y : this.sceneRoom() ? 0 : this.world.groundAt(desired.x, desired.z)) + 0.3;
    if (desired.y < minY) desired.y = minY;
    if (this.interior === 'club') desired.y = Math.min(desired.y, 7.5);
    if (this.interior === 'casino') desired.y = Math.min(desired.y, 6.4);
    if (this.interior === 'penthouse') desired.y = Math.min(desired.y, PENTHOUSE.y + 3.9);
    if (this.interior === 'yacht' && this.yacht && this.mode === 'foot') {
      // keep the camera under the salon roof while inside it
      const sl = this.yacht.layout.salon;
      const lp = this.yachtLocal;
      if (lp.x > sl.minX && lp.x < sl.maxX && lp.z > sl.minZ - 1 && lp.z < sl.maxZ) {
        desired.y = Math.min(desired.y, this.yacht.root.position.y + this.yacht.layout.deckY + 2.3);
        desired.lerpVectors(target, desired, 0.6);
      }
    }
    const k = this.mode === 'car' ? 1 - Math.exp(-dt * 9) : 1 - Math.exp(-dt * 14);
    if (this.camPos.lengthSq() === 0 || this.camPos.distanceTo(desired) > 60) this.camPos.copy(desired);
    else this.camPos.lerp(desired, k);
    if (this.crashT > 0) {
      this.crashT -= dt;
      this.camPos.x += (Math.random() - 0.5) * this.crashT * 0.4;
      this.camPos.y += (Math.random() - 0.5) * this.crashT * 0.4;
    }
    cam.position.copy(this.camPos);
    cam.lookAt(target);
    if (this.drunk > 0.02) {
      const d = this.drunk;
      cam.rotateZ(Math.sin(this.t * 0.9) * 0.09 * d);
      cam.rotateY(Math.sin(this.t * 0.63 + 2) * 0.05 * d);
      cam.rotateX(Math.sin(this.t * 0.77 + 1) * 0.035 * d);
      cam.fov += Math.sin(this.t * 1.2) * 5 * d;
      cam.updateProjectionMatrix();
    }
  }

  /** Gold beacon for the manual waypoint; green beacon for the current objective's location otherwise. */
  private updateBeacon() {
    const wp = useUI.getState().waypoint;
    const mat = this.beacon.material as THREE.MeshBasicMaterial;
    if (this.sceneRoom()) {
      this.beacon.visible = false;
      return;
    }
    const pw = this.playerWorld();
    if (wp) {
      this.beacon.visible = true;
      mat.color.set('#ffd36a');
      this.beacon.position.set(wp.x, 150, wp.z);
      if (Math.hypot(pw.x - wp.x, pw.z - wp.z) < 12) {
        useUI.getState().setWaypoint(null);
        notify(`Arrived: ${wp.label}`, 'info');
      }
      return;
    }
    const m = currentMission(useGame.getState().game);
    const target = m?.target ? POI_BY_ID[m.target] : null;
    if (target && Math.hypot(pw.x - target.x, pw.z - target.z) > 25) {
      this.beacon.visible = true;
      mat.color.set('#3dffb0');
      this.beacon.position.set(target.x, 150, target.z);
    } else this.beacon.visible = false;
  }

  // ---------------------------------------------------------------------------------- stats
  private updateStats(dt: number, g: ReturnType<typeof useGame.getState>['game']) {
    this.spawnT -= dt;
    const store = useGame.getState();
    const pw = this.playerWorld();
    if (this.spawnT <= 0) {
      this.spawnT = 1;
      // POI visits
      for (const p of POIS) {
        const key = `visit_${p.id}`;
        if (!g.stats[key] && Math.hypot(pw.x - p.x, pw.z - p.z) < Math.max(14, p.radius + 6) && !this.interior) store.stat(key);
      }
      if (!g.stats.sunsetMarina && g.minute >= 18 * 60 && g.minute <= 20 * 60 && Math.hypot(pw.x - POI_BY_ID.marina.x, pw.z - POI_BY_ID.marina.z) < 40) store.stat('sunsetMarina');
      if (this.mode === 'foot' && !this.interior && this.grounded) store.setSpawn(this.pos.x, this.pos.z, this.yaw);
      else if (this.mode === 'car' && this.car) store.setSpawn(this.car.x, this.car.z, this.car.yaw);
    }
    if (this.mode === 'car' && this.car) {
      const kmh = Math.round(this.car.kmh());
      if (kmh > (g.stats.maxSpeed || 0) + 4 || (kmh >= 150 && !(g.stats.maxSpeed >= 150))) {
        if (kmh > this.prevSpeedKmh) store.maxStat('maxSpeed', kmh);
      }
      this.prevSpeedKmh = kmh;
    }
  }

  // ---------------------------------------------------------------------------------- fireworks (finale)
  launchFireworks(seconds = 25) {
    this.fireworksT = seconds;
  }

  private updateFireworks(dt: number) {
    if (this.fireworksT > 0) {
      this.fireworksT -= dt;
      if (Math.random() < dt * 3) this.burst();
    }
    for (let i = this.fireworks.length - 1; i >= 0; i--) {
      const f = this.fireworks[i];
      f.life -= dt;
      const pos = f.pts.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let k = 0; k < pos.count; k++) {
        f.vel[k * 3 + 1] -= 9 * dt;
        pos.setXYZ(k, pos.getX(k) + f.vel[k * 3] * dt, pos.getY(k) + f.vel[k * 3 + 1] * dt, pos.getZ(k) + f.vel[k * 3 + 2] * dt);
      }
      pos.needsUpdate = true;
      (f.pts.material as THREE.PointsMaterial).opacity = Math.max(0, f.life / 2);
      if (f.life <= 0) {
        f.pts.removeFromParent();
        f.pts.geometry.dispose();
        (f.pts.material as THREE.Material).dispose();
        this.fireworks.splice(i, 1);
      }
    }
  }

  private burst() {
    const n = 180;
    const pos = new Float32Array(n * 3);
    const vel = new Float32Array(n * 3);
    const cx = YACHT_BERTH.x + 40 + Math.random() * 160, cy = 60 + Math.random() * 60, cz = YACHT_BERTH.z - 120 + Math.random() * 240;
    for (let i = 0; i < n; i++) {
      pos[i * 3] = cx;
      pos[i * 3 + 1] = cy;
      pos[i * 3 + 2] = cz;
      const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1), sp = 18 + Math.random() * 10;
      vel[i * 3] = Math.sin(ph) * Math.cos(th) * sp;
      vel[i * 3 + 1] = Math.cos(ph) * sp;
      vel[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * sp;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const color = new THREE.Color().setHSL(Math.random(), 1, 0.6);
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color, size: 4, sizeAttenuation: false, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    this.scene.add(pts);
    this.fireworks.push({ pts, vel, life: 2.2 });
    audio.crash(2);
  }

  // ---------------------------------------------------------------------------------- HUD
  private pushHud() {
    const c = this.car;
    const g = useGame.getState().game;
    const mode: 'foot' | 'car' | 'boat' = this.mode;
    const pw = this.playerWorld();
    const heading = mode === 'car' && c ? c.yaw : mode === 'boat' && this.yacht ? this.yacht.yaw : this.yaw;
    useUI.getState().setRt({
      mode,
      speed: mode === 'car' && c ? c.kmh() : mode === 'boat' && this.yacht ? Math.abs(this.yacht.speed) * 3.6 : 0,
      gear: c && mode === 'car' ? (c.speed < -0.5 ? 'R' : Math.abs(c.speed) < 0.3 ? 'P' : 'D') : 'P',
      x: pw.x,
      z: pw.z,
      heading,
      camHeading: this.camYaw,
      interior: this.interior,
      prompt: useUI.getState().panel ? null : this.currentPrompt,
      bounceActive: !!(c && c.isMaybach && g.bounce.enabled && mode === 'car'),
      bounceLimited: !!(c && c.bounceLimit < 0.99),
      bounceLevel: c ? c.susp.out.level : 0,
      vehicleId: c?.def.id ?? g.activeVehicle,
      fps: this.fps,
      drunk: this.drunk,
      minigame: this.minigame ? this.minigame.hud() : null,
    });
  }
}

const SLURRED = [
  'I love this city. I love YOU, palm tree.',
  "Who's got the aux? I've got the aux.",
  "I'm not drunk, I'm networking.",
  'Is the ground... bouncing? Did someone press B?',
  'One more bottle. For the brand.',
  "Brickell! BRICKELL! ...where's my car?",
];

export function drunkLevel(d: number) {
  return d < 0.05 ? 'Sober' : d < 0.3 ? 'Tipsy' : d < 0.6 ? 'Buzzed' : d < 0.85 ? 'Drunk' : 'Wasted';
}

function styleName(s: BounceStyle) {
  return s === 'executive' ? 'Executive Bounce' : s === 'brickell' ? 'Brickell Bounce' : 'Miami Mode';
}

function frame() {
  return new Promise<void>((r) => requestAnimationFrame(() => r()));
}
