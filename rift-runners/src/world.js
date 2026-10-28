import * as THREE from 'three';
import { ARENA_RADIUS } from './config.js';

// Deterministic RNG so the arena layout is the same every run (fair & learnable).
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function groundTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#211b30';
  g.fillRect(0, 0, 512, 512);
  const rnd = mulberry32(7);
  // Offset stone slabs
  const rows = 8;
  const h = 512 / rows;
  for (let r = 0; r < rows; r++) {
    let x = r % 2 ? -h / 2 : 0;
    while (x < 512) {
      const w = h * (0.8 + rnd() * 0.7);
      const l = 20 + rnd() * 9;
      g.fillStyle = `hsl(${255 + rnd() * 20}, ${14 + rnd() * 10}%, ${l}%)`;
      g.fillRect(x + 3, r * h + 3, w - 6, h - 6);
      // subtle highlight edge
      g.fillStyle = 'rgba(255,255,255,0.04)';
      g.fillRect(x + 3, r * h + 3, w - 6, 4);
      x += w;
    }
  }
  // Cracks
  g.strokeStyle = 'rgba(8,4,16,0.7)';
  g.lineWidth = 2;
  for (let i = 0; i < 26; i++) {
    let x = rnd() * 512, y = rnd() * 512;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 5; k++) { x += (rnd() - 0.5) * 50; y += (rnd() - 0.5) * 50; g.lineTo(x, y); }
    g.stroke();
  }
  // Faint glowing veins
  g.strokeStyle = 'rgba(150,80,255,0.18)';
  g.lineWidth = 1.5;
  for (let i = 0; i < 8; i++) {
    let x = rnd() * 512, y = rnd() * 512;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 6; k++) { x += (rnd() - 0.5) * 70; y += (rnd() - 0.5) * 70; g.lineTo(x, y); }
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(9, 9);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function runeTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.translate(256, 256);
  g.strokeStyle = 'rgba(170,110,255,0.9)';
  g.lineWidth = 3;
  for (const r of [240, 222, 120, 104]) { g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke(); }
  g.lineWidth = 2;
  for (let i = 0; i < 24; i++) {
    g.save(); g.rotate((i / 24) * Math.PI * 2); g.translate(0, -231);
    g.beginPath();
    g.moveTo(-5, -5); g.lineTo(5, 5); g.moveTo(5, -5); g.lineTo(0, 0);
    if (i % 2) { g.moveTo(-6, 4); g.lineTo(6, 4); }
    g.stroke(); g.restore();
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2, b = ((i + 2) / 6) * Math.PI * 2;
    g.beginPath(); g.moveTo(Math.cos(a) * 222, Math.sin(a) * 222); g.lineTo(Math.cos(b) * 222, Math.sin(b) * 222); g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function riftTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 4, 128, 128, 128);
  grd.addColorStop(0, 'rgba(255,240,255,1)');
  grd.addColorStop(0.15, 'rgba(220,140,255,0.95)');
  grd.addColorStop(0.4, 'rgba(120,50,230,0.6)');
  grd.addColorStop(0.7, 'rgba(40,140,255,0.2)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function softDotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.3, 'rgba(255,255,255,0.6)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.obstacles = []; // { x, z, r }
    this.animated = [];
    this.riftPos = new THREE.Vector3(0, 7, -ARENA_RADIUS - 14);

    scene.background = new THREE.Color('#07050d');
    scene.fog = new THREE.Fog('#0a0714', 38, 95);

    this.hemi = new THREE.HemisphereLight('#9a8ae0', '#2a1c40', 1.7);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#e4d8ff', 2.1);
    this.sun.position.set(-14, 30, 10);
    this.sun.shadow.mapSize.set(1024, 1024);
    const sc = this.sun.shadow.camera;
    sc.left = -26; sc.right = 26; sc.top = 26; sc.bottom = -26; sc.near = 1; sc.far = 80;
    this.sun.shadow.bias = -0.0015;
    scene.add(this.sun, this.sun.target);
    this.riftLight = new THREE.PointLight('#a35cff', 60, 70, 1.6);
    this.riftLight.position.copy(this.riftPos).setY(6);
    scene.add(this.riftLight);

    this.buildGround();
    this.buildObstacles();
    this.buildBorder();
    this.buildRift();
    this.buildFloatingRocks();
    this.buildMotes();
  }

  buildGround() {
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(ARENA_RADIUS + 3, 64).rotateX(-Math.PI / 2),
      new THREE.MeshLambertMaterial({ map: groundTexture() })
    );
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.ground = ground;

    // Arena underside: a rough cliff so the island floats in the void.
    const cliff = new THREE.Mesh(
      new THREE.CylinderGeometry(ARENA_RADIUS + 3, ARENA_RADIUS - 8, 14, 32, 1, true),
      new THREE.MeshLambertMaterial({ color: '#1b1428', flatShading: true, side: THREE.DoubleSide })
    );
    cliff.position.y = -7;
    this.scene.add(cliff);

    const rune = new THREE.Mesh(
      new THREE.PlaneGeometry(22, 22).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: runeTexture(), transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    rune.position.y = 0.03;
    this.scene.add(rune);
    this.rune = rune;
  }

  addObstacle(x, z, r) { this.obstacles.push({ x, z, r }); }

  buildObstacles() {
    const rnd = mulberry32(1337);
    const stone = new THREE.MeshLambertMaterial({ color: '#3a3352', flatShading: true });
    const stoneDark = new THREE.MeshLambertMaterial({ color: '#2a2440', flatShading: true });
    const crystalMats = ['#7a4dff', '#36d6ff', '#ff4fd8'].map((c) => new THREE.MeshBasicMaterial({ color: c }));

    const spots = [];
    const tryPlace = (minDist) => {
      for (let tries = 0; tries < 60; tries++) {
        const a = rnd() * Math.PI * 2;
        const d = 9 + rnd() * (ARENA_RADIUS - 14);
        const x = Math.cos(a) * d, z = Math.sin(a) * d;
        if (spots.every((s) => Math.hypot(s.x - x, s.z - z) > minDist)) { spots.push({ x, z }); return { x, z }; }
      }
      return null;
    };

    // Ruined pillars
    for (let i = 0; i < 7; i++) {
      const p = tryPlace(9);
      if (!p) continue;
      const h = 2 + rnd() * 4.5;
      const g = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.6, 2.1), stoneDark);
      base.position.y = 0.3;
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.85, h, 8), stone);
      col.position.y = 0.6 + h / 2;
      col.rotation.z = (rnd() - 0.5) * 0.08;
      g.add(base, col);
      if (rnd() > 0.5) {
        const cap = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.45, 1.9), stoneDark);
        cap.position.y = 0.6 + h + 0.2; cap.rotation.y = rnd();
        g.add(cap);
      } else {
        const chunk = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6, 0), stone);
        chunk.position.set(1.3, 0.4, 0.4);
        g.add(chunk);
      }
      g.position.set(p.x, 0, p.z);
      g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      this.scene.add(g);
      this.addObstacle(p.x, p.z, 1.15);
    }

    // Crystal clusters (glow, also block movement)
    for (let i = 0; i < 6; i++) {
      const p = tryPlace(8);
      if (!p) continue;
      const g = new THREE.Group();
      const mat = crystalMats[i % 3];
      const n = 3 + Math.floor(rnd() * 3);
      for (let k = 0; k < n; k++) {
        const h = 1 + rnd() * 2.4;
        const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), mat);
        m.scale.set(1, h, 1);
        m.position.set((rnd() - 0.5) * 1.2, h * 0.35, (rnd() - 0.5) * 1.2);
        m.rotation.set((rnd() - 0.5) * 0.6, rnd() * 3, (rnd() - 0.5) * 0.6);
        g.add(m);
      }
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.9, 0), stoneDark);
      rock.scale.y = 0.5; rock.position.y = 0.2;
      g.add(rock);
      g.position.set(p.x, 0, p.z);
      this.scene.add(g);
      this.addObstacle(p.x, p.z, 1.2);
      this.animated.push({ obj: g, kind: 'crystal', phase: rnd() * 6 });
    }

    // Boulders
    for (let i = 0; i < 5; i++) {
      const p = tryPlace(8);
      if (!p) continue;
      const r = 1.1 + rnd() * 0.8;
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), stone);
      m.scale.y = 0.7;
      m.position.set(p.x, r * 0.45, p.z);
      m.rotation.set(rnd(), rnd() * 3, rnd());
      m.castShadow = m.receiveShadow = true;
      this.scene.add(m);
      this.addObstacle(p.x, p.z, r * 0.95);
    }

    // Broken archway near the north edge facing the rift
    const archZ = -ARENA_RADIUS + 6;
    for (const sx of [-3.2, 3.2]) {
      const pil = new THREE.Mesh(new THREE.BoxGeometry(1.2, 6, 1.2), stone);
      pil.position.set(sx, 3, archZ);
      pil.castShadow = true;
      this.scene.add(pil);
      this.addObstacle(sx, archZ, 0.95);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.9, 1.4), stoneDark);
    lintel.position.set(0.3, 6.3, archZ); lintel.rotation.z = -0.06;
    lintel.castShadow = true;
    this.scene.add(lintel);
  }

  buildBorder() {
    // Glowing boundary ring + jagged rocks marking the edge.
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(ARENA_RADIUS - 0.2, ARENA_RADIUS + 0.4, 96).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#8a4dff', transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    ring.position.y = 0.05;
    this.scene.add(ring);
    this.borderRing = ring;

    const rnd = mulberry32(99);
    const geo = new THREE.DodecahedronGeometry(1, 0);
    const mat = new THREE.MeshLambertMaterial({ color: '#2d2545', flatShading: true });
    const count = 64;
    const inst = new THREE.InstancedMesh(geo, mat, count);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + rnd() * 0.05;
      const r = ARENA_RADIUS + 1.6 + rnd() * 1.2;
      const sz = 0.9 + rnd() * 1.4;
      p.set(Math.cos(a) * r, sz * 0.4, Math.sin(a) * r);
      e.set(rnd() * 3, rnd() * 3, rnd() * 3);
      q.setFromEuler(e);
      s.set(sz, sz * (1 + rnd()), sz);
      m.compose(p, q, s);
      inst.setMatrixAt(i, m);
    }
    inst.castShadow = true;
    this.scene.add(inst);
  }

  buildRift() {
    const g = new THREE.Group();
    g.position.copy(this.riftPos);
    const tex = riftTexture();
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 30),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })
    );
    glow.scale.set(1, 1.5, 1);
    g.add(glow);
    const tear = new THREE.Mesh(
      new THREE.CircleGeometry(4, 6),
      new THREE.MeshBasicMaterial({ color: '#05010a', fog: false })
    );
    tear.scale.set(0.55, 2.4, 1);
    tear.position.z = 0.1;
    g.add(tear);
    const rings = [];
    const ringColors = ['#c37bff', '#4fd0ff', '#ff5fd2'];
    for (let i = 0; i < 3; i++) {
      const r = new THREE.Mesh(
        new THREE.TorusGeometry(5.5 + i * 1.6, 0.12, 5, 48),
        new THREE.MeshBasicMaterial({ color: ringColors[i], transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, fog: false })
      );
      r.scale.y = 1.7;
      g.add(r);
      rings.push(r);
    }
    this.scene.add(g);
    this.rift = { group: g, rings, glow, tear };
  }

  buildFloatingRocks() {
    const rnd = mulberry32(4242);
    const geo = new THREE.DodecahedronGeometry(1, 0);
    const mat = new THREE.MeshLambertMaterial({ color: '#2a2240', flatShading: true });
    const count = 46;
    this.rocks = new THREE.InstancedMesh(geo, mat, count);
    this.rockData = [];
    for (let i = 0; i < count; i++) {
      const a = rnd() * Math.PI * 2;
      const d = ARENA_RADIUS + 8 + rnd() * 40;
      this.rockData.push({
        x: Math.cos(a) * d, z: Math.sin(a) * d, y: -8 + rnd() * 16,
        s: 0.8 + rnd() * 3.2, phase: rnd() * 6, spin: (rnd() - 0.5) * 0.4, rx: rnd() * 3, ry: rnd() * 3,
      });
    }
    this.scene.add(this.rocks);
    this.updateRocks(0);
  }

  buildMotes() {
    const count = 220;
    const pos = new Float32Array(count * 3);
    const rnd = mulberry32(5);
    for (let i = 0; i < count; i++) {
      const a = rnd() * Math.PI * 2, d = rnd() * (ARENA_RADIUS + 20);
      pos[i * 3] = Math.cos(a) * d; pos[i * 3 + 1] = rnd() * 14; pos[i * 3 + 2] = Math.sin(a) * d;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.motes = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.35, map: softDotTexture(), color: '#b98cff', transparent: true, opacity: 0.8,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.motes.frustumCulled = false;
    this.scene.add(this.motes);
  }

  updateRocks(t) {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
    this.rockData.forEach((r, i) => {
      p.set(r.x, r.y + Math.sin(t * 0.5 + r.phase) * 0.8, r.z);
      e.set(r.rx, r.ry + t * r.spin, 0);
      q.setFromEuler(e);
      s.set(r.s, r.s * 0.75, r.s);
      m.compose(p, q, s);
      this.rocks.setMatrixAt(i, m);
    });
    this.rocks.instanceMatrix.needsUpdate = true;
  }

  update(dt, t) {
    this.updateRocks(t);
    const pos = this.motes.geometry.attributes.position;
    const a = pos.array;
    for (let i = 1; i < a.length; i += 3) {
      a[i] += dt * 0.6;
      if (a[i] > 14) a[i] = 0;
    }
    pos.needsUpdate = true;
    const { rings, glow } = this.rift;
    rings.forEach((r, i) => { r.rotation.z = t * (0.3 + i * 0.25) * (i % 2 ? -1 : 1); });
    glow.material.opacity = 0.8 + Math.sin(t * 2) * 0.15;
    this.rune.rotation.y = t * 0.05;
    this.borderRing.material.opacity = 0.45 + Math.sin(t * 1.5) * 0.15;
    for (const an of this.animated) {
      an.obj.position.y = Math.sin(t * 1.2 + an.phase) * 0.08;
    }
  }

  setShadows(on) {
    this.sun.castShadow = on;
  }

  // Push a circle out of obstacles and keep it inside the arena. Mutates `o`.
  resolve(o, r) {
    for (const ob of this.obstacles) {
      const dx = o.x - ob.x, dz = o.z - ob.z;
      const min = ob.r + r;
      const d2 = dx * dx + dz * dz;
      if (d2 < min * min) {
        const d = Math.sqrt(d2) || 0.001;
        o.x = ob.x + (dx / d) * min;
        o.z = ob.z + (dz / d) * min;
      }
    }
    const lim = ARENA_RADIUS - r;
    const d = Math.hypot(o.x, o.z);
    if (d > lim) { o.x *= lim / d; o.z *= lim / d; }
  }

  insideObstacle(x, z, pad = 0) {
    for (const ob of this.obstacles) {
      const dx = x - ob.x, dz = z - ob.z, r = ob.r + pad;
      if (dx * dx + dz * dz < r * r) return true;
    }
    return false;
  }
}
