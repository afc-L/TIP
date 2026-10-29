import * as THREE from 'three';
import { InstancePool } from './pool.js';

const MAX_PARTICLES = 700;
const MAX_RINGS = 24;
const MAX_TELEGRAPHS = 44;
const MAX_TAGS = 16;
const MAX_BOLT_SEGS = 260;
const MAX_NUMBERS = 48;

const tmpColor = new THREE.Color();

// Visual-only systems: particles, shockwave rings, attack telegraphs, lightning,
// floating damage numbers and camera shake.
export class Effects {
  constructor(scene, layerEl) {
    this.scene = scene;
    this.settings = { shake: true, numbers: true, density: 1, reduceFlash: false };

    // Particles (one instanced draw call)
    this.parts = [];
    for (let i = 0; i < MAX_PARTICLES; i++) this.parts.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, size: 1, r: 1, g: 1, b: 1, grav: 0, rot: 0 });
    this.nParts = 0;
    this.partPool = new InstancePool(
      new THREE.OctahedronGeometry(1, 0),
      new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
      MAX_PARTICLES
    );
    scene.add(this.partPool.mesh);

    // Shockwave rings (each has its own material so opacity can differ; created once)
    const ringGeo = new THREE.RingGeometry(0.82, 1, 40).rotateX(-Math.PI / 2);
    this.rings = [];
    for (let i = 0; i < MAX_RINGS; i++) {
      const mesh = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      mesh.visible = false;
      scene.add(mesh);
      this.rings.push({ mesh, t: 0, dur: 1, r0: 0, r1: 1, active: false });
    }

    // Telegraphs: filled circle that grows + outline, or a rectangle lane for charges.
    const discGeo = new THREE.CircleGeometry(1, 36).rotateX(-Math.PI / 2);
    const outlineGeo = new THREE.RingGeometry(0.94, 1, 48).rotateX(-Math.PI / 2);
    const laneGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5);
    this.teles = [];
    for (let i = 0; i < MAX_TELEGRAPHS; i++) {
      const mk = (geo) => {
        const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#ff3355', transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending }));
        m.visible = false; m.renderOrder = 2; scene.add(m); return m;
      };
      this.teles.push({ fill: mk(discGeo), outline: mk(outlineGeo), lane: mk(laneGeo), active: false });
    }

    // Lightning (line segments with fading vertex colours)
    this.bolts = [];
    const geo = new THREE.BufferGeometry();
    this.boltPos = new Float32Array(MAX_BOLT_SEGS * 6);
    this.boltCol = new Float32Array(MAX_BOLT_SEGS * 6);
    geo.setAttribute('position', new THREE.BufferAttribute(this.boltPos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.boltCol, 3).setUsage(THREE.DynamicDrawUsage));
    this.boltLines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.boltLines.frustumCulled = false;
    scene.add(this.boltLines);

    // Damage numbers (pooled DOM nodes)
    this.layer = layerEl;
    this.numbers = [];
    for (let i = 0; i < MAX_NUMBERS; i++) {
      const el = document.createElement('div');
      el.className = 'dmg-num';
      el.style.display = 'none';
      layerEl.appendChild(el);
      this.numbers.push({ el, x: 0, y: 0, z: 0, t: 0, dur: 0.7, active: false });
    }
    this.numCursor = 0;

    // Elite modifier tags (pooled DOM labels that follow enemies)
    this.tags = [];
    for (let i = 0; i < MAX_TAGS; i++) {
      const el = document.createElement('div');
      el.className = 'elite-tag';
      el.style.display = 'none';
      layerEl.appendChild(el);
      this.tags.push({ el, text: '', on: false });
    }
    this.tagQueue = [];

    this.trauma = 0;
    this.shakeOffset = new THREE.Vector3();
    this.flash = 0;
    this.tmpV = new THREE.Vector3();
  }

  clear() {
    this.nParts = 0;
    for (const r of this.rings) { r.active = false; r.mesh.visible = false; }
    for (const t of this.teles) this.hideTele(t);
    this.bolts.length = 0;
    for (const n of this.numbers) { n.active = false; n.el.style.display = 'none'; }
    for (const t of this.tags) { t.on = false; t.el.style.display = 'none'; }
    this.trauma = 0;
  }

  // --- particles -------------------------------------------------------
  particle(x, y, z, vx, vy, vz, life, size, color, grav = 0) {
    if (this.nParts >= MAX_PARTICLES) return;
    const p = this.parts[this.nParts++];
    tmpColor.set(color);
    p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz;
    p.life = life; p.max = life; p.size = size; p.grav = grav;
    p.r = tmpColor.r; p.g = tmpColor.g; p.b = tmpColor.b; p.rot = Math.random() * 6;
  }

  burst(x, y, z, count, color, speed = 6, life = 0.5, size = 0.18, grav = 0) {
    count = Math.max(1, Math.round(count * this.settings.density));
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const up = Math.random() * 0.8 + 0.2;
      const s = speed * (0.4 + Math.random() * 0.6);
      this.particle(x, y, z, Math.cos(a) * s, up * s * 0.8, Math.sin(a) * s, life * (0.6 + Math.random() * 0.6), size * (0.6 + Math.random() * 0.8), color, grav);
    }
  }

  // --- rings -----------------------------------------------------------
  ring(x, z, r0, r1, dur, color, y = 0.1) {
    const r = this.rings.find((q) => !q.active) || this.rings[0];
    r.active = true; r.t = 0; r.dur = dur; r.r0 = r0; r.r1 = r1;
    r.mesh.material.color.set(color);
    r.mesh.position.set(x, y, z);
    r.mesh.visible = true;
  }

  // --- telegraphs ------------------------------------------------------
  // Circle warning. Returns handle; the game resolves damage itself when time is up.
  teleCircle(x, z, radius, dur, color = '#ff3355') {
    const t = this.teles.find((q) => !q.active);
    if (!t) return null;
    t.active = true; t.kind = 'circle'; t.t = 0; t.dur = dur; t.r = radius;
    t.fill.position.set(x, 0.07, z); t.outline.position.set(x, 0.08, z);
    t.outline.scale.setScalar(radius);
    t.fill.material.color.set(color); t.outline.material.color.set(color);
    t.fill.visible = t.outline.visible = true;
    return t;
  }

  teleLane(x, z, dirX, dirZ, length, width, dur, color = '#ff3355') {
    const t = this.teles.find((q) => !q.active);
    if (!t) return null;
    t.active = true; t.kind = 'lane'; t.t = 0; t.dur = dur; t.length = length; t.width = width;
    t.lane.position.set(x, 0.07, z);
    t.lane.rotation.y = Math.atan2(dirX, dirZ);
    t.lane.scale.set(width, 1, length);
    t.lane.material.color.set(color);
    t.lane.visible = true;
    return t;
  }

  hideTele(t) {
    t.active = false;
    t.fill.visible = t.outline.visible = t.lane.visible = false;
  }

  // --- lightning -------------------------------------------------------
  lightning(x0, y0, z0, x1, y1, z1, color = '#9fe6ff') {
    tmpColor.set(color);
    const segs = 6;
    const pts = [];
    for (let i = 0; i <= segs; i++) {
      const f = i / segs;
      const j = i === 0 || i === segs ? 0 : 0.6;
      pts.push(x0 + (x1 - x0) * f + (Math.random() - 0.5) * j, y0 + (y1 - y0) * f + (Math.random() - 0.5) * j, z0 + (z1 - z0) * f + (Math.random() - 0.5) * j);
    }
    this.bolts.push({ pts, t: 0, dur: 0.22, r: tmpColor.r, g: tmpColor.g, b: tmpColor.b });
    if (this.bolts.length > 40) this.bolts.shift();
  }

  // --- numbers ---------------------------------------------------------
  number(x, y, z, value, kind = 'normal') {
    if (!this.settings.numbers) return;
    const n = this.numbers[this.numCursor];
    this.numCursor = (this.numCursor + 1) % MAX_NUMBERS;
    n.active = true; n.t = 0;
    n.x = x + (Math.random() - 0.5) * 0.6; n.y = y; n.z = z + (Math.random() - 0.5) * 0.6;
    n.dur = kind === 'crit' ? 0.9 : 0.7;
    n.el.textContent = kind === 'heal' ? `+${value}` : String(value);
    n.el.className = `dmg-num ${kind}`;
    n.el.style.display = 'block';
  }

  // --- elite tags --------------------------------------------------------
  beginTags() { this.tagQueue.length = 0; }
  tag(x, y, z, text, color) { if (this.tagQueue.length < MAX_TAGS) this.tagQueue.push({ x, y, z, text, color }); }
  endTags(camera) {
    const w = window.innerWidth, h = window.innerHeight, v = this.tmpV;
    for (let i = 0; i < MAX_TAGS; i++) {
      const slot = this.tags[i], q = this.tagQueue[i];
      if (!q) { if (slot.on) { slot.on = false; slot.el.style.display = 'none'; } continue; }
      v.set(q.x, q.y, q.z).project(camera);
      if (!slot.on) { slot.on = true; slot.el.style.display = 'block'; }
      if (slot.text !== q.text) { slot.text = q.text; slot.el.textContent = q.text; slot.el.style.borderColor = q.color; }
      slot.el.style.transform = `translate(${((v.x * 0.5 + 0.5) * w) | 0}px, ${((-v.y * 0.5 + 0.5) * h) | 0}px) translate(-50%, -100%)`;
    }
  }

  // --- shake -----------------------------------------------------------
  shake(amount) {
    if (!this.settings.shake) return;
    this.trauma = Math.min(1, this.trauma + amount);
  }

  update(dt, camera) {
    // particles
    const pool = this.partPool;
    pool.begin();
    for (let i = 0; i < this.nParts; i++) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) {
        // swap-remove
        const last = this.parts[--this.nParts];
        this.parts[this.nParts] = p;
        this.parts[i] = last;
        i--;
        continue;
      }
      p.vy -= p.grav * dt;
      const drag = Math.exp(-3 * dt);
      p.vx *= drag; p.vz *= drag;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.05) { p.y = 0.05; p.vy *= -0.3; }
      const f = p.life / p.max;
      const s = p.size * (0.4 + 0.6 * f);
      pool.push(p.x, p.y, p.z, p.rot + p.life * 4, s, s, s, p.r * f, p.g * f, p.b * f);
    }
    pool.end();

    // rings
    for (const r of this.rings) {
      if (!r.active) continue;
      r.t += dt;
      const f = r.t / r.dur;
      if (f >= 1) { r.active = false; r.mesh.visible = false; continue; }
      const e = 1 - (1 - f) * (1 - f);
      r.mesh.scale.setScalar(r.r0 + (r.r1 - r.r0) * e);
      r.mesh.material.opacity = 1 - f;
    }

    // telegraphs (timing owned by the gameplay code; here we only animate)
    for (const t of this.teles) {
      if (!t.active) continue;
      t.t += dt;
      const f = Math.min(1, t.t / t.dur);
      const pulse = 0.5 + 0.5 * Math.sin(t.t * 18);
      if (t.kind === 'circle') {
        t.fill.scale.setScalar(Math.max(0.01, t.r * f));
        t.fill.material.opacity = 0.18 + 0.25 * f;
        t.outline.material.opacity = 0.5 + 0.4 * pulse;
      } else {
        t.lane.material.opacity = 0.12 + 0.3 * f + 0.1 * pulse;
      }
    }

    // lightning
    let seg = 0;
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.t += dt;
      if (b.t >= b.dur) { this.bolts.splice(i, 1); continue; }
      const f = 1 - b.t / b.dur;
      for (let k = 0; k < b.pts.length / 3 - 1 && seg < MAX_BOLT_SEGS; k++, seg++) {
        const o = seg * 6;
        for (let c = 0; c < 6; c++) this.boltPos[o + c] = b.pts[k * 3 + c];
        this.boltCol[o] = this.boltCol[o + 3] = b.r * f;
        this.boltCol[o + 1] = this.boltCol[o + 4] = b.g * f;
        this.boltCol[o + 2] = this.boltCol[o + 5] = b.b * f;
      }
    }
    const g = this.boltLines.geometry;
    g.setDrawRange(0, seg * 2);
    g.attributes.position.needsUpdate = true;
    g.attributes.color.needsUpdate = true;

    // damage numbers
    const w = window.innerWidth, h = window.innerHeight;
    const v = this.tmpV;
    for (const n of this.numbers) {
      if (!n.active) continue;
      n.t += dt;
      if (n.t >= n.dur) { n.active = false; n.el.style.display = 'none'; continue; }
      v.set(n.x, n.y + n.t * 2.2, n.z).project(camera);
      const sx = (v.x * 0.5 + 0.5) * w, sy = (-v.y * 0.5 + 0.5) * h;
      const f = n.t / n.dur;
      const sc = f < 0.15 ? 0.6 + f / 0.15 * 0.6 : 1.2 - (f - 0.15) * 0.4;
      n.el.style.transform = `translate(${sx | 0}px, ${sy | 0}px) translate(-50%, -50%) scale(${sc.toFixed(2)})`;
      n.el.style.opacity = f > 0.6 ? (1 - (f - 0.6) / 0.4).toFixed(2) : '1';
    }

    // shake (trauma squared feels better than linear)
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    const s = this.trauma * this.trauma * 1.1;
    this.shakeOffset.set((Math.random() - 0.5) * s, (Math.random() - 0.5) * s * 0.6, (Math.random() - 0.5) * s);
    this.flash = Math.max(0, this.flash - dt * 2.5);
  }
}
