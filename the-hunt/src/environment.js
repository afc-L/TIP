import * as THREE from 'three';
import { clamp, lerp, smoothstep, makeRng, rand } from './util.js';
import { glowTexture } from './textures.js';

// Day / night cycle, sky, fog, weather and ambient particles.

const KEYS = [
  // hour, skyTop, horizon(=fog), hemiSky, hemiGround, hemiI, sunColor, sunI
  [0, '#030509', '#080b10', '#3a4a66', '#0a0a08', 0.3, '#7d8fb8', 0.2],
  [4.5, '#04060a', '#090c11', '#3a4a66', '#0a0a08', 0.3, '#7d8fb8', 0.17],
  [5.6, '#141a26', '#2c3038', '#5a6070', '#1a1810', 0.57, '#c08a6a', 0.26],
  [6.6, '#3a4658', '#7a7a7a', '#8a96a8', '#4a463a', 1.14, '#e8b890', 0.94],
  [9, '#5c6c7c', '#959ea6', '#b8c4d0', '#5a5a48', 1.61, '#f0e6d0', 1.87],
  [13, '#64748a', '#9ea6ae', '#c0ccd8', '#5e5c4a', 1.71, '#fff4e0', 2.12],
  [17, '#58647a', '#8e9298', '#b0b8c4', '#5a5644', 1.52, '#f0d8b0', 1.61],
  [19, '#30344a', '#6a5c5c', '#8a8090', '#3e3828', 0.95, '#e09060', 0.77],
  [20.3, '#121522', '#262830', '#4a5068', '#14120c', 0.49, '#8a7a90', 0.26],
  [21.5, '#04060b', '#0a0d12', '#3a4a66', '#0a0a08', 0.3, '#7d8fb8', 0.2],
  [24, '#030509', '#080b10', '#3a4a66', '#0a0a08', 0.3, '#7d8fb8', 0.2],
].map((k) => ({ h: k[0], top: new THREE.Color(k[1]), hor: new THREE.Color(k[2]), hs: new THREE.Color(k[3]), hg: new THREE.Color(k[4]), hi: k[5], sc: new THREE.Color(k[6]), si: k[7] }));

export const WEATHERS = {
  clear: { name: 'Overcast', fog: 1.0, dark: 1.0, rain: 0, wind: 0.35 },
  mist: { name: 'Mist', fog: 1.7, dark: 0.92, rain: 0, wind: 0.2 },
  fog: { name: 'Heavy Fog', fog: 2.7, dark: 0.82, rain: 0, wind: 0.1 },
  rain: { name: 'Rain', fog: 1.6, dark: 0.72, rain: 1, wind: 0.7 },
  storm: { name: 'Storm', fog: 2.0, dark: 0.6, rain: 1.6, wind: 1.0 },
};

export class Environment {
  constructor(scene, renderer, settings) {
    this.scene = scene;
    this.renderer = renderer;
    this.settings = settings;
    this.hours = 7.0;
    this.day = 1;
    this.timeScale = 1 / 60; // game hours per real second (1 real min = 1 game hour)
    this.weather = 'mist';
    this.weatherNext = 'mist';
    this.weatherBlend = 1;
    this.w = { ...WEATHERS.mist };
    this.darknessBoost = 0; // creature can make the night darker
    this.fogBoost = 0;

    this.fog = new THREE.FogExp2(0x9ea6ae, 0.012);
    scene.fog = this.fog;
    scene.background = new THREE.Color(0x9ea6ae);

    this.hemi = new THREE.HemisphereLight(0xc0ccd8, 0x3e3c2c, 0.9);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff4e0, 1.2);
    this.sun.castShadow = settings.shadows;
    this.sun.shadow.mapSize.set(settings.quality === 'high' ? 2048 : 1024, settings.quality === 'high' ? 2048 : 1024);
    const sc = this.sun.shadow.camera;
    sc.left = -60; sc.right = 60; sc.top = 60; sc.bottom = -60; sc.near = 1; sc.far = 260;
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.04;
    scene.add(this.sun, this.sun.target);

    this.buildSky();
    this.buildParticles();
    this.lightning = 0;
  }

  buildSky() {
    const geo = new THREE.SphereGeometry(420, 24, 12);
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 hor; varying vec3 vP; void main(){ float t = clamp(vP.y*1.6, 0.0, 1.0); t = pow(t, 0.7); gl_FragColor = vec4(mix(hor, top, t), 1.0);\n#include <colorspace_fragment>\n}',
    });
    this.sky = new THREE.Mesh(geo, this.skyMat);
    this.sky.renderOrder = -10;
    this.sky.frustumCulled = false;
    this.scene.add(this.sky);
    // stars
    const r = makeRng(5);
    const pos = [];
    for (let i = 0; i < 900; i++) {
      const a = r() * Math.PI * 2, y = 0.12 + r() * 0.88;
      const rr = Math.sqrt(1 - y * y);
      pos.push(Math.cos(a) * rr * 400, y * 400, Math.sin(a) * rr * 400);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    this.starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
    this.stars = new THREE.Points(sg, this.starMat);
    this.stars.frustumCulled = false;
    this.stars.renderOrder = -9;
    this.scene.add(this.stars);
    this.moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(230,235,255,1)', 'rgba(200,210,255,0)'), fog: false, transparent: true, depthWrite: false }));
    this.moon.scale.setScalar(40);
    this.moon.renderOrder = -8;
    this.scene.add(this.moon);
  }

  buildParticles() {
    // drifting dust / spores (catch the flashlight beam)
    const n = 380;
    const p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { p[i * 3] = (rand() - 0.5) * 40; p[i * 3 + 1] = rand() * 8; p[i * 3 + 2] = (rand() - 0.5) * 40; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    this.dustMat = new THREE.PointsMaterial({ color: 0xd8dcd0, size: 0.06, transparent: true, opacity: 0.45, depthWrite: false, map: glowTexture() });
    this.dust = new THREE.Points(g, this.dustMat);
    this.dust.frustumCulled = false;
    this.scene.add(this.dust);
    // fireflies
    const nf = 60;
    const fp = new Float32Array(nf * 3);
    this.ffSeed = [];
    for (let i = 0; i < nf; i++) { this.ffSeed.push([rand() * 100, (rand() - 0.5) * 50, (rand() - 0.5) * 50, 0.4 + rand() * 1.8]); }
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.BufferAttribute(fp, 3));
    this.ffMat = new THREE.PointsMaterial({ color: 0x9cff70, size: 0.18, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, map: glowTexture() });
    this.fireflies = new THREE.Points(fg, this.ffMat);
    this.fireflies.frustumCulled = false;
    this.scene.add(this.fireflies);
    // rain streaks
    const nr = 1600;
    const rp = new Float32Array(nr * 6);
    this.rainVel = new Float32Array(nr);
    for (let i = 0; i < nr; i++) {
      const x = (rand() - 0.5) * 40, y = rand() * 22, z = (rand() - 0.5) * 40;
      rp.set([x, y, z, x, y - 0.5, z], i * 6);
      this.rainVel[i] = 14 + rand() * 6;
    }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
    this.rainMat = new THREE.LineBasicMaterial({ color: 0x9aa4ae, transparent: true, opacity: 0, depthWrite: false });
    this.rain = new THREE.LineSegments(rg, this.rainMat);
    this.rain.frustumCulled = false;
    this.scene.add(this.rain);
  }

  setWeather(name, instant = false) {
    this.weatherNext = name;
    if (instant) { this.weather = name; this.weatherBlend = 1; this.w = { ...WEATHERS[name] }; }
    else this.weatherBlend = 0;
  }

  randomWeather(rng = rand, stage = 0) {
    const r = rng();
    let w;
    if (r < 0.3) w = 'clear';
    else if (r < 0.58) w = 'mist';
    else if (r < 0.78) w = 'fog';
    else if (r < 0.93) w = 'rain';
    else w = 'storm';
    if (stage < 1 && (w === 'storm' || w === 'fog')) w = 'mist';
    this.setWeather(w);
  }

  get isNight() { return this.hours >= 20.5 || this.hours < 5.5; }
  /** 0 at noon, 1 at deep night. */
  get nightness() {
    const h = this.hours;
    if (h >= 21.5 || h < 4.5) return 1;
    if (h < 6.6) return 1 - smoothstep(4.5, 6.6, h);
    if (h > 19) return smoothstep(19, 21.5, h);
    return 0;
  }

  sample(h) {
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1].h <= h) i++;
    const a = KEYS[i], b = KEYS[i + 1];
    const t = clamp((h - a.h) / (b.h - a.h), 0, 1);
    return { a, b, t };
  }

  update(dt, camPos, flashlightOn, t) {
    this.hours += dt * this.timeScale;
    if (this.hours >= 24) { this.hours -= 24; this.day++; }
    // weather blend
    if (this.weatherBlend < 1) {
      this.weatherBlend = Math.min(1, this.weatherBlend + dt / 40);
      const A = WEATHERS[this.weather], B = WEATHERS[this.weatherNext];
      for (const k of ['fog', 'dark', 'rain', 'wind']) this.w[k] = lerp(A[k], B[k], this.weatherBlend);
      if (this.weatherBlend >= 1) this.weather = this.weatherNext;
    }
    const { a, b, t: k } = this.sample(this.hours);
    const top = a.top.clone().lerp(b.top, k);
    const hor = a.hor.clone().lerp(b.hor, k);
    const dark = this.w.dark * (1 - this.darknessBoost * 0.6);
    // weather greys the sky toward the horizon colour and darkens
    const grey = clamp((this.w.fog - 1) * 0.35, 0, 0.6);
    top.lerp(hor, grey).multiplyScalar(dark);
    hor.multiplyScalar(lerp(1, dark, 0.8));
    if (this.lightning > 0) {
      const f = this.lightning;
      top.lerp(new THREE.Color(0xc8d0e0), f * 0.8);
      hor.lerp(new THREE.Color(0xa0a8b8), f * 0.8);
      this.lightning = Math.max(0, this.lightning - dt * 4);
    }
    this.skyMat.uniforms.top.value.copy(top);
    this.skyMat.uniforms.hor.value.copy(hor);
    this.fog.color.copy(hor);
    this.scene.background.copy(hor);

    this.hemi.color.copy(a.hs).lerp(b.hs, k);
    this.hemi.groundColor.copy(a.hg).lerp(b.hg, k);
    const night = this.nightness;
    this.hemi.intensity = lerp(a.hi, b.hi, k) * dark * (1 - this.darknessBoost * 0.5) + this.lightning * 1.5;
    this.sun.color.copy(a.sc).lerp(b.sc, k);
    this.sun.intensity = lerp(a.si, b.si, k) * lerp(1, dark, 1.2) * (1 - this.darknessBoost * 0.7);

    // sun / moon position
    const ang = ((this.hours - 6) / 24) * Math.PI * 2;
    const isSun = this.hours > 5.2 && this.hours < 20.8;
    const elev = isSun ? Math.max(0.18, Math.sin(ang)) : Math.max(0.3, Math.sin(ang + Math.PI));
    const az = isSun ? ang : ang + Math.PI;
    const dir = new THREE.Vector3(Math.cos(az) * 0.8, elev, 0.45).normalize();
    this.sun.position.set(camPos.x + dir.x * 120, camPos.y + dir.y * 120, camPos.z + dir.z * 120);
    this.sun.target.position.set(camPos.x, camPos.y, camPos.z);
    this.sky.position.copy(camPos);
    this.stars.position.copy(camPos);
    this.moon.position.set(camPos.x - dir.x * 0 + (isSun ? -dir.x : dir.x) * 380, camPos.y + Math.max(0.35, isSun ? 0.4 : dir.y) * 300, camPos.z + 160);
    const clearSky = clamp(1.6 - this.w.fog, 0, 1);
    this.starMat.opacity = night * clearSky * 0.85;
    this.moon.material.opacity = night * clamp(1.9 - this.w.fog, 0.05, 1) * 0.9;

    // fog density: weather × time; never thinner than what the view distance can hide
    const viewDist = this.settings.viewDistance;
    let dens = lerp(0.0105, 0.02, night) * this.w.fog * (1 + this.fogBoost);
    dens = Math.max(dens, 2.1 / viewDist);
    this.fog.density = dens;
    this.effectiveView = Math.min(viewDist, 2.3 / dens);

    // particles follow the camera
    this.updateParticles(dt, camPos, flashlightOn, night, t);
  }

  updateParticles(dt, cam, flashOn, night, t) {
    const dp = this.dust.geometry.attributes.position;
    const arr = dp.array;
    const wind = this.w.wind;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i] += (wind * 0.6 + Math.sin(t * 0.3 + i) * 0.1) * dt;
      arr[i + 1] += Math.sin(t * 0.5 + i * 0.7) * 0.05 * dt;
      arr[i + 2] += Math.cos(t * 0.2 + i) * 0.1 * dt;
      // wrap around camera
      for (let k = 0; k < 3; k += 2) {
        const c = k === 0 ? cam.x : cam.z;
        if (arr[i + k] - c > 20) arr[i + k] -= 40;
        if (arr[i + k] - c < -20) arr[i + k] += 40;
      }
      if (arr[i + 1] - cam.y > 6) arr[i + 1] -= 9;
      if (arr[i + 1] - cam.y < -3) arr[i + 1] += 9;
    }
    dp.needsUpdate = true;
    this.dustMat.opacity = lerp(0.35, flashOn ? 0.7 : 0.15, night);
    this.dustMat.color.setScalar(lerp(0.85, flashOn ? 0.9 : 0.4, night));

    // fireflies: summer nights, calm weather, not when the creature smothers the forest
    const ffTarget = night * (this.w.rain > 0.2 ? 0 : 1) * (1 - this.darknessBoost);
    this.ffMat.opacity = lerp(this.ffMat.opacity, ffTarget * 0.9, dt);
    if (this.ffMat.opacity > 0.01) {
      const fp = this.fireflies.geometry.attributes.position;
      this.ffSeed.forEach((s, i) => {
        const ph = t * 0.3 * s[3] + s[0];
        fp.setXYZ(i, cam.x + s[1] + Math.sin(ph) * 2, cam.y - 1 + Math.sin(ph * 1.7) * 0.8 + 0.6, cam.z + s[2] + Math.cos(ph * 0.8) * 2);
      });
      fp.needsUpdate = true;
    }

    // rain
    const rain = this.w.rain;
    this.rainMat.opacity = clamp(rain, 0, 1) * lerp(0.35, 0.18, night);
    if (rain > 0.02) {
      const rp = this.rain.geometry.attributes.position;
      const ra = rp.array;
      const n = this.rainVel.length;
      const slant = 1.5 * wind;
      for (let i = 0; i < n; i++) {
        const o = i * 6;
        const v = this.rainVel[i] * dt;
        ra[o + 1] -= v; ra[o + 4] -= v;
        ra[o] += slant * dt; ra[o + 3] += slant * dt;
        if (ra[o + 1] < cam.y - 4) {
          const x = cam.x + (rand() - 0.5) * 40, z = cam.z + (rand() - 0.5) * 40, y = cam.y + 14 + rand() * 6;
          ra[o] = x; ra[o + 1] = y; ra[o + 2] = z;
          ra[o + 3] = x - slant * 0.03; ra[o + 4] = y - 0.55; ra[o + 5] = z;
        }
      }
      rp.needsUpdate = true;
    }
  }

  flash() { this.lightning = 1; }
}
