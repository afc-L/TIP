// Map registry + runtime wrapper (scene, lighting, sky, fog, flicker, surfaces...).
import * as THREE from 'three';
import { MapBuilder, windUniforms, riftUniforms } from './builder.js';
import { NavGraph } from '../systems/nav.js';
import { skyTexture, radialTexture } from '../core/textures.js';
import { noise2, rand, clamp } from '../core/util.js';
import { resetVegMats } from './props.js';
import { buildSuburb } from './suburb.js';

export const MAPS = {
  suburb: { order: 1, title: 'Ashgrove Lane', sub: 'Abandoned Suburb', desc: 'Fog, porch lights and quiet streets. It looks normal. At first.', build: buildSuburb },
};
export function registerMap(key, def) { MAPS[key] = def; }

export function createMap(game, key) {
  resetVegMats();
  const b = new MapBuilder(game, game.graphics.q);
  const cfg = MAPS[key].build(game, b);
  b.finish();
  return new GameMap(game, b, cfg, key);
}

export class GameMap {
  constructor(game, b, cfg, key) {
    this.game = game; this.key = key; this.b = b;
    { const { update, isInside, ...rest } = cfg; Object.assign(this, rest); }
    this.cfg = cfg;
    this.world = b.world; this.lights = b.lights; this.windows = b.windows; this.doors = b.doors;
    this.interactables = b.interactables; this.anchors = b.anchors; this.mirrors = b.mirrors; this.anomalies = b.anomalies || [];
    this.spawn = b.spawns.player.clone(); this.spawnYaw = b.spawns.playerYaw;
    this.nav = new NavGraph(b.nodes);
    this.abandonF = 0; this.stains = []; this.ambientT = (cfg.ambientEvents || []).map((e) => rand(e.every[0], e.every[1]) * 0.5);
    this.emitT = (cfg.emitters || []).map((e) => rand(e.interval[0], e.interval[1]) * 0.5);
    const env = cfg.env;
    const scene = this.scene = new THREE.Scene();
    scene.add(b.root);
    // sky + environment lighting
    const sky = skyTexture(env.sky || {});
    scene.background = sky;
    if (!env.noEnv) scene.environment = game.graphics.pmrem.fromEquirectangular(sky).texture;
    scene.environmentIntensity = env.envIntensity ?? 0.35;
    scene.backgroundIntensity = env.bgIntensity ?? 1;
    this.fogBase = env.fogDensity * game.graphics.q.fogBoost;
    scene.fog = new THREE.FogExp2(env.fogColor, this.fogBase);
    const a = env.ambient;
    this.hemi = new THREE.HemisphereLight(a.sky, a.ground, a.intensity); scene.add(this.hemi);
    this.hemiBase = a.intensity;
    const mo = env.moon;
    this.moon = new THREE.DirectionalLight(mo.color, mo.intensity); this.moonBase = mo.intensity;
    this.moonDir = new THREE.Vector3(...mo.dir).normalize();
    if (game.graphics.q.shadows && !env.noShadow) {
      this.moon.castShadow = true; const s = game.graphics.q.shadowSize; this.moon.shadow.mapSize.set(s, s);
      const c = this.moon.shadow.camera; c.left = -40; c.right = 40; c.top = 40; c.bottom = -40; c.near = 1; c.far = 160;
      this.moon.shadow.bias = -0.0006; this.moon.shadow.normalBias = 0.04;
    }
    scene.add(this.moon); scene.add(this.moon.target);
    // stain decals
    this.stainMat = new THREE.MeshBasicMaterial({ map: radialTexture('rgba(10,4,6,0.85)', 'rgba(0,0,0,0)'), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
  }

  clampBounds(p) { const B = this.bounds; if (!B) return; p.x = clamp(p.x, B.minX, B.maxX); p.z = clamp(p.z, B.minZ, B.maxZ); }
  surfaceAt(p) {
    const gr = this.world.groundAt(p.x, p.z, p.y + 0.1, 0.1, 0.3);
    if (gr.surface && gr.y > this.world.terrain(p.x, p.z) - 0.01) return gr.surface;
    const R = this.b.surfaceRegions;
    for (let i = R.length - 1; i >= 0; i--) { const r = R[i]; if (p.x >= r.x0 && p.x <= r.x1 && p.z >= r.z0 && p.z <= r.z1) return r.surface; }
    return this.cfg.surfaceFn ? this.cfg.surfaceFn(p) : this.b.defaultSurface;
  }
  // How lit is a position, 0..1 (used by NPC vision)
  lightLevelAt(p, npc) {
    let l = this.env.visibility ?? 0.25;
    for (const L of this.lights) {
      if (!L.on || L.cur <= 0.05) continue;
      const d = L.pos.distanceTo(p); if (d > L.distance) continue;
      l += (1 - d / L.distance) * Math.min(1, L.intensity / 20) * L.cur * L.factor * 0.8;
    }
    if (npc && npc.flashlight && npc.flashOn && npc.beamDir) {
      const to = new THREE.Vector3().subVectors(p, npc.eye()); const d = to.length();
      if (d < 26 && to.normalize().dot(npc.beamDir) > 0.88) l += 1;
    }
    if (this.game.flashLight && this.game.flashLight.intensity > 0 && this.game.flashLight.position.distanceTo(p) < 15) l += 0.8;
    return clamp(l, 0, 1);
  }
  setAbandoned(f) {
    if (Math.abs(f - this.abandonF) < 0.01) return;
    this.abandonF = f;
    this.b.refreshWindows(1 - f);
    for (const L of this.lights) L.factor = L.abandon ? 1 - f : 1;
  }
  refreshWindows() { this.b.refreshWindows(1 - this.abandonF); }
  addStain(p) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(rand(0.7, 1.1), 16), this.stainMat);
    m.rotation.x = -Math.PI / 2; m.position.set(p.x, this.world.groundAt(p.x, p.z, p.y + 0.5).y + 0.02, p.z);
    this.scene.add(m); this.stains.push(m);
    if (this.stains.length > 30) { const s = this.stains.shift(); this.scene.remove(s); s.geometry.dispose(); }
  }

  update(dt, t) {
    const g = this.game, mp = g.monster.pos;
    windUniforms.uTime.value = t; windUniforms.uWind.value = g.wind; riftUniforms.uTime.value = t;
    // moon shadow follows the player
    this.moon.position.copy(mp).addScaledVector(this.moonDir, 60); this.moon.target.position.copy(mp);
    // light flicker / failures
    for (const L of this.lights) {
      let c = 1;
      if (L.flicker) { const n = noise2(t * 8 + L.phase, L.phase); c *= n < L.flicker * 0.5 ? 0.15 + n : 1; }
      if (L.broken) { const n = noise2(t * 0.7 + L.phase * 3, 7); if (n < L.broken * 0.6) c *= Math.random() < 0.15 ? 1 : 0.02; }
      if (L.disturb > 0) { c *= Math.random() < 0.5 ? 0.05 : 1; L.disturb = Math.max(0, L.disturb - dt * 0.5); }
      if (L.hallOff) c = 0;
      if (!L.on) c = 0;
      L.cur = c;
      if (L.glow) { L.glow.material.opacity = 0.8 * c * L.factor * (L.intensity > 0 ? 1 : 0); L.glow.visible = L.glow.material.opacity > 0.01; }
    }
    // doors animate
    for (const d of this.doors) d.update(dt);
    // positional ambient emitters (real sounds in the world)
    (this.cfg.emitters || []).forEach((e, i) => {
      this.emitT[i] -= dt;
      if (this.emitT[i] <= 0) { this.emitT[i] = rand(e.interval[0], e.interval[1]); if ((!e.cond || e.cond()) && e.pos.distanceTo(mp) < 80) g.audio.play(e.sound, e.pos, { vol: e.vol || 0.5, ...(e.opts || {}) }); }
    });
    (this.cfg.ambientEvents || []).forEach((e, i) => { this.ambientT[i] -= dt; if (this.ambientT[i] <= 0) { this.ambientT[i] = rand(e.every[0], e.every[1]); e.fn(g); } });
    // abandoned/fog modulation
    const f = this.abandonF;
    this.scene.fog.density = this.fogBase * (1 + f * 1.5) * (g.mode === 'nightmare' ? 1.35 : 1) * (this.fogMul || 1);
    this.hemi.intensity = this.hemiBase * (1 - f * 0.6) * (g.mode === 'nightmare' ? 0.6 : 1);
    if (this.cfg.update) this.cfg.update(dt, t);
  }
  isInside(p) { return this.cfg.isInside ? this.cfg.isInside(p) : false; }

  dispose() {
    this.scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => { if (m.map && !m.map.isCanvasTexture) m.map.dispose(); m.dispose(); }); } });
    for (const m of this.mirrors) m.dispose && m.dispose();
    if (this.scene.environment) this.scene.environment.dispose();
  }
}
