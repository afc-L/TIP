// Pooled visual effects: particles (single Points draw call), tracers (single LineSegments), muzzle flashes,
// explosions and weather.
import * as THREE from 'three';

const MAXP = 2500;
const MAXT = 120;

export class Effects {
  constructor(game) {
    this.game = game;
    const scene = game.scene;
    // ---- particles ----
    this.pPos = new Float32Array(MAXP * 3);
    this.pCol = new Float32Array(MAXP * 3);
    this.pSize = new Float32Array(MAXP);
    this.pAlpha = new Float32Array(MAXP);
    this.pVel = new Float32Array(MAXP * 3);
    this.pLife = new Float32Array(MAXP);
    this.pMax = new Float32Array(MAXP);
    this.pGrav = new Float32Array(MAXP);
    this.pGrow = new Float32Array(MAXP);
    this.pNext = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.pCol, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.pSize, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.pAlpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.pMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uScale: { value: 400 } },
      vertexShader: `attribute float size; attribute float alpha; attribute vec3 color; varying vec3 vC; varying float vA; uniform float uScale;
        void main(){ vC=color; vA=alpha; vec4 mv = modelViewMatrix*vec4(position,1.0); gl_PointSize = size * uScale / max(0.1, -mv.z); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `varying vec3 vC; varying float vA; void main(){ vec2 d = gl_PointCoord-0.5; if(dot(d,d)>0.25) discard; gl_FragColor = vec4(vC, vA); }`,
    });
    this.points = new THREE.Points(g, this.pMat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 3;
    scene.add(this.points);
    this.pGeo = g;
    // ---- tracers ----
    this.tPos = new Float32Array(MAXT * 6);
    this.tCol = new Float32Array(MAXT * 6);
    this.tLife = new Float32Array(MAXT);
    this.tBase = new Float32Array(MAXT * 3);
    this.tNext = 0;
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(this.tPos, 3).setUsage(THREE.DynamicDrawUsage));
    tg.setAttribute('color', new THREE.BufferAttribute(this.tCol, 3).setUsage(THREE.DynamicDrawUsage));
    this.tracers = new THREE.LineSegments(tg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.tracers.frustumCulled = false;
    scene.add(this.tracers);
    this.tGeo = tg;
    // ---- muzzle flashes ----
    this.flashes = [];
    const fm = new THREE.SpriteMaterial({ color: 0xffeeaa, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, map: radialTexture() });
    for (let i = 0; i < 24; i++) {
      const s = new THREE.Sprite(fm.clone());
      s.visible = false; s.scale.setScalar(0.8);
      scene.add(s);
      this.flashes.push({ s, life: 0 });
    }
    // ---- explosions ----
    this.booms = [];
    const bg = new THREE.SphereGeometry(1, 16, 12);
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ color: 0xffaa33, transparent: true, opacity: 0.8, depthWrite: false }));
      m.visible = false;
      scene.add(m);
      this.booms.push({ m, life: 0, r: 1 });
    }
    // ---- rain ----
    this.rainOn = false;
    const RN = 1400;
    this.rainPos = new Float32Array(RN * 6);
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(this.rainPos, 3).setUsage(THREE.DynamicDrawUsage));
    this.rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0xaabbdd, transparent: true, opacity: 0.45 }));
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    scene.add(this.rain);
    this.rainN = RN;
    this.rainSeed = [];
    for (let i = 0; i < RN; i++) this.rainSeed.push([Math.random() * 60 - 30, Math.random() * 40, Math.random() * 60 - 30]);
  }

  reset() {
    this.pLife.fill(0);
    this.pAlpha.fill(0);
    this.tLife.fill(0);
  }

  spawn(x, y, z, vx, vy, vz, color, size, life, grav = 9.8, grow = 0) {
    const i = this.pNext;
    this.pNext = (this.pNext + 1) % MAXP;
    this.pPos[i * 3] = x; this.pPos[i * 3 + 1] = y; this.pPos[i * 3 + 2] = z;
    this.pVel[i * 3] = vx; this.pVel[i * 3 + 1] = vy; this.pVel[i * 3 + 2] = vz;
    const c = typeof color === 'number' ? _col.set(color) : color;
    this.pCol[i * 3] = c.r; this.pCol[i * 3 + 1] = c.g; this.pCol[i * 3 + 2] = c.b;
    this.pSize[i] = size; this.pLife[i] = life; this.pMax[i] = life; this.pGrav[i] = grav; this.pGrow[i] = grow;
    this.pAlpha[i] = 1;
  }

  near(x, z, d = 160) {
    const c = this.game.camera.position;
    return (x - c.x) ** 2 + (z - c.z) ** 2 < d * d;
  }

  impact(x, y, z, color, n = 4) {
    if (!this.near(x, z, 120)) return;
    for (let i = 0; i < n; i++) this.spawn(x, y, z, rs(3), Math.random() * 3, rs(3), color, 0.08, 0.35, 9.8);
  }
  debris(x, y, z, color, n = 10) {
    if (!this.near(x, z)) return;
    for (let i = 0; i < n; i++) this.spawn(x + rs(1), y + rs(1), z + rs(1), rs(5), Math.random() * 6, rs(5), color, 0.22, 0.9, 14);
  }
  smoke(x, y, z) {
    if (!this.near(x, z)) return;
    this.spawn(x, y, z, rs(0.3), 0.5, rs(0.3), 0xbbbbbb, 0.5, 1.2, -0.5, 1.2);
  }
  muzzle(x, y, z, color) {
    if (!this.near(x, z, 140)) return;
    const f = this.flashes.find((q) => q.life <= 0) || this.flashes[0];
    f.life = 0.05;
    f.s.visible = true;
    f.s.position.set(x, y, z);
    f.s.material.color.set(color);
    f.s.scale.setScalar(0.6 + Math.random() * 0.4);
  }
  tracer(x0, y0, z0, x1, y1, z1, color) {
    if (!this.near(x0, z0, 220) && !this.near(x1, z1, 220)) return;
    const i = this.tNext;
    this.tNext = (this.tNext + 1) % MAXT;
    // draw a short streak that travels along the shot
    this.tBase[i * 3] = x1 - x0; this.tBase[i * 3 + 1] = y1 - y0; this.tBase[i * 3 + 2] = z1 - z0;
    this.tPos.set([x0, y0, z0, x1, y1, z1], i * 6);
    _col.set(color);
    this.tCol.set([_col.r * 0.3, _col.g * 0.3, _col.b * 0.3, _col.r, _col.g, _col.b], i * 6);
    this.tLife[i] = 0.07;
  }
  explosion(x, y, z, r) {
    if (!this.near(x, z, 260)) return;
    const b = this.booms.find((q) => q.life <= 0) || this.booms[0];
    b.life = 0.45; b.r = r;
    b.m.visible = true; b.m.position.set(x, y, z);
    for (let i = 0; i < 40; i++) this.spawn(x, y, z, rs(14), Math.random() * 12, rs(14), i % 3 ? 0xff9a2a : 0xffe08a, 0.35, 0.7, 6);
    for (let i = 0; i < 14; i++) this.spawn(x + rs(2), y + rs(1), z + rs(2), rs(2), 2 + Math.random() * 2, rs(2), 0x555555, 1.2, 2.2, -0.3, 1.5);
  }
  elimination(x, y, z, color) {
    for (let i = 0; i < 40; i++) this.spawn(x + rs(0.4), y + Math.random() * 1.8, z + rs(0.4), rs(1.5), 2 + Math.random() * 3, rs(1.5), i % 2 ? color : 0x88eaff, 0.16, 1.2, -1);
  }
  trail(x, y, z, color) {
    this.spawn(x, y, z, 0, 0, 0, color, 0.35, 1.0, 0, 0.6);
  }

  setRain(on) { this.rainOn = on; this.rain.visible = on; }

  update(dt) {
    // particles
    const P = this.pPos, V = this.pVel;
    for (let i = 0; i < MAXP; i++) {
      if (this.pLife[i] <= 0) { if (this.pAlpha[i] !== 0) this.pAlpha[i] = 0; continue; }
      this.pLife[i] -= dt;
      V[i * 3 + 1] -= this.pGrav[i] * dt;
      P[i * 3] += V[i * 3] * dt; P[i * 3 + 1] += V[i * 3 + 1] * dt; P[i * 3 + 2] += V[i * 3 + 2] * dt;
      this.pSize[i] += this.pGrow[i] * dt;
      this.pAlpha[i] = Math.max(0, this.pLife[i] / this.pMax[i]);
    }
    this.pGeo.attributes.position.needsUpdate = true;
    this.pGeo.attributes.alpha.needsUpdate = true;
    this.pGeo.attributes.size.needsUpdate = true;
    this.pGeo.attributes.color.needsUpdate = true;
    this.pMat.uniforms.uScale.value = window.innerHeight * 0.5;
    // tracers
    for (let i = 0; i < MAXT; i++) {
      if (this.tLife[i] <= 0) continue;
      this.tLife[i] -= dt;
      if (this.tLife[i] <= 0) { for (let k = 0; k < 6; k++) this.tPos[i * 6 + k] = 0; continue; }
      // move the tail forward to make a streak
      const k = dt / 0.07;
      this.tPos[i * 6] += this.tBase[i * 3] * k;
      this.tPos[i * 6 + 1] += this.tBase[i * 3 + 1] * k;
      this.tPos[i * 6 + 2] += this.tBase[i * 3 + 2] * k;
    }
    this.tGeo.attributes.position.needsUpdate = true;
    this.tGeo.attributes.color.needsUpdate = true;
    // flashes
    for (const f of this.flashes) {
      if (f.life > 0) { f.life -= dt; if (f.life <= 0) f.s.visible = false; }
    }
    for (const b of this.booms) {
      if (b.life <= 0) continue;
      b.life -= dt;
      const k = 1 - b.life / 0.45;
      b.m.scale.setScalar(b.r * (0.3 + k * 0.9));
      b.m.material.opacity = 0.85 * (1 - k);
      b.m.material.color.setHSL(0.08 - k * 0.05, 1, 0.6 - k * 0.3);
      if (b.life <= 0) b.m.visible = false;
    }
    // rain around camera
    if (this.rainOn) {
      const c = this.game.camera.position;
      const t = this.game.time;
      for (let i = 0; i < this.rainN; i++) {
        const s = this.rainSeed[i];
        const y = c.y + 20 - ((s[1] + t * 28) % 40);
        const x = c.x + s[0], z = c.z + s[2];
        this.rainPos[i * 6] = x; this.rainPos[i * 6 + 1] = y; this.rainPos[i * 6 + 2] = z;
        this.rainPos[i * 6 + 3] = x + 0.1; this.rainPos[i * 6 + 4] = y - 0.9; this.rainPos[i * 6 + 5] = z;
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
    }
  }
}

const _col = new THREE.Color();
const rs = (s) => (Math.random() * 2 - 1) * s;

function radialTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(255,230,150,0.8)');
  g.addColorStop(1, 'rgba(255,200,80,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  return t;
}
