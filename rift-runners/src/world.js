import * as THREE from 'three';
import { ARENA_RADIUS } from './config.js';

// Deterministic RNG so each arena layout is the same every visit (fair & learnable).
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const THEMES = {
  temple: {
    bg: '#07050d', fog: '#0a0714', sky: '#9a8ae0', groundLight: '#2a1c40', sun: '#e4d8ff', riftLight: '#a35cff',
    base: '#211b30', hue: [255, 20], sat: [14, 10], light: [20, 9], vein: 'rgba(150,80,255,0.18)', crack: 'rgba(8,4,16,0.7)',
    rune: 'rgba(170,110,255,0.9)', border: '#8a4dff', rock: '#2a2240', cliff: '#1b1428', motes: '#b98cff',
    rift: ['#c37bff', '#4fd0ff', '#ff5fd2'], riftGlow: ['rgba(220,140,255,0.95)', 'rgba(120,50,230,0.6)'],
  },
  garden: {
    bg: '#030a0a', fog: '#06120f', sky: '#8ff0d0', groundLight: '#14302a', sun: '#dfffee', riftLight: '#3dffc0',
    base: '#0f2420', hue: [150, 30], sat: [22, 12], light: [15, 9], vein: 'rgba(90,255,200,0.22)', crack: 'rgba(2,10,8,0.7)',
    rune: 'rgba(110,255,210,0.85)', border: '#3dffc0', rock: '#1f3a30', cliff: '#10221c', motes: '#c8ff7a',
    rift: ['#7dffcf', '#ff7ad8', '#c8ff7a'], riftGlow: ['rgba(160,255,220,0.95)', 'rgba(40,180,140,0.6)'],
  },
  citadel: {
    bg: '#0a0405', fog: '#150708', sky: '#e09a8a', groundLight: '#301010', sun: '#ffe0d0', riftLight: '#ff4d3d',
    base: '#1c1414', hue: [5, 15], sat: [6, 8], light: [15, 8], vein: 'rgba(255,70,40,0.25)', crack: 'rgba(0,0,0,0.75)',
    rune: 'rgba(255,110,80,0.85)', border: '#ff4d3d', rock: '#2a1c1c', cliff: '#1a0e0e', motes: '#ff9a5a',
    rift: ['#ff4d3d', '#ffb547', '#ff7ad8'], riftGlow: ['rgba(255,170,120,0.95)', 'rgba(200,40,30,0.6)'],
  },
};

function groundTexture(th, seed) {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = th.base;
  g.fillRect(0, 0, 512, 512);
  const rnd = mulberry32(seed);
  const rows = 8;
  const h = 512 / rows;
  for (let r = 0; r < rows; r++) {
    let x = r % 2 ? -h / 2 : 0;
    while (x < 512) {
      const w = h * (0.8 + rnd() * 0.7);
      g.fillStyle = `hsl(${th.hue[0] + rnd() * th.hue[1]}, ${th.sat[0] + rnd() * th.sat[1]}%, ${th.light[0] + rnd() * th.light[1]}%)`;
      g.fillRect(x + 3, r * h + 3, w - 6, h - 6);
      g.fillStyle = 'rgba(255,255,255,0.04)';
      g.fillRect(x + 3, r * h + 3, w - 6, 4);
      x += w;
    }
  }
  g.strokeStyle = th.crack;
  g.lineWidth = 2;
  for (let i = 0; i < 26; i++) {
    let x = rnd() * 512, y = rnd() * 512;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 5; k++) { x += (rnd() - 0.5) * 50; y += (rnd() - 0.5) * 50; g.lineTo(x, y); }
    g.stroke();
  }
  g.strokeStyle = th.vein;
  g.lineWidth = 1.5;
  for (let i = 0; i < 9; i++) {
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

function runeTexture(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.translate(256, 256);
  g.strokeStyle = color;
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

function riftTexture(stops) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 4, 128, 128, 128);
  grd.addColorStop(0, 'rgba(255,240,255,1)');
  grd.addColorStop(0.15, stops[0]);
  grd.addColorStop(0.4, stops[1]);
  grd.addColorStop(0.7, 'rgba(40,140,255,0.15)');
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

// Holds the shared lights and one lazily built group per arena theme.
export class World {
  constructor(scene) {
    this.scene = scene;
    this.riftPos = new THREE.Vector3(0, 7, -ARENA_RADIUS - 14);
    this.themes = {};
    this.dot = softDotTexture();

    scene.fog = new THREE.Fog('#0a0714', 38, 95);
    scene.background = new THREE.Color('#07050d');
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

    // Phase-3 safe zone wall (Rift Guardian)
    this.zoneWall = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, 4, 72, 1, true),
      new THREE.MeshBasicMaterial({ color: '#ff3355', transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    );
    this.zoneWall.position.y = 2;
    this.zoneWall.visible = false;
    this.zoneFloor = new THREE.Mesh(
      new THREE.RingGeometry(1, 2.2, 72).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#ff1a3a', transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    this.zoneFloor.position.y = 0.06;
    this.zoneFloor.visible = false;
    scene.add(this.zoneWall, this.zoneFloor);

    this.tint = null;
    this.setTheme('temple');
  }

  setTheme(id) {
    if (!THEMES[id]) id = 'temple';
    for (const k in this.themes) this.themes[k].group.visible = false;
    if (!this.themes[id]) this.themes[id] = this.build(id);
    const t = this.themes[id];
    t.group.visible = true;
    this.cur = t;
    this.themeId = id;
    this.obstacles = t.obstacles;
    this.animated = t.animated;
    this.applyColors();
  }

  applyColors() {
    const th = THEMES[this.themeId];
    const blood = this.tint === 'blood';
    this.scene.background.set(blood ? '#140306' : th.bg);
    this.scene.fog.color.set(blood ? '#2a0508' : th.fog);
    this.hemi.color.set(blood ? '#ff6a6a' : th.sky);
    this.hemi.groundColor.set(th.groundLight);
    this.sun.color.set(blood ? '#ffb0a0' : th.sun);
    this.riftLight.color.set(blood ? '#ff2a3a' : th.riftLight);
  }

  setTint(t) {
    if (this.tint === t) return;
    this.tint = t;
    this.applyColors();
  }

  setSafeZone(r) {
    const on = r < ARENA_RADIUS - 0.5;
    this.zoneWall.visible = on;
    this.zoneFloor.visible = on;
    if (on) {
      this.zoneWall.scale.set(r, 1, r);
      this.zoneFloor.scale.set(r, 1, r);
    }
  }

  build(id) {
    const th = THEMES[id];
    const group = new THREE.Group();
    this.scene.add(group);
    const ctx = { group, th, obstacles: [], animated: [], rnd: mulberry32(id.length * 131 + 7) };

    // Ground, cliff, rune decal
    const ground = new THREE.Mesh(new THREE.CircleGeometry(ARENA_RADIUS + 3, 64).rotateX(-Math.PI / 2),
      new THREE.MeshLambertMaterial({ map: groundTexture(th, id.length * 17) }));
    ground.receiveShadow = true;
    const cliff = new THREE.Mesh(new THREE.CylinderGeometry(ARENA_RADIUS + 3, ARENA_RADIUS - 8, 14, 32, 1, true),
      new THREE.MeshLambertMaterial({ color: th.cliff, flatShading: true, side: THREE.DoubleSide }));
    cliff.position.y = -7;
    const rune = new THREE.Mesh(new THREE.PlaneGeometry(22, 22).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: runeTexture(th.rune), transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
    rune.position.y = 0.03;
    group.add(ground, cliff, rune);
    ctx.rune = rune;

    if (id === 'temple') this.buildTemple(ctx);
    else if (id === 'garden') this.buildGarden(ctx);
    else this.buildCitadel(ctx);

    this.buildBorder(ctx);
    this.buildRift(ctx);
    this.buildFloatingRocks(ctx);
    this.buildMotes(ctx);
    return ctx;
  }

  placer(ctx) {
    const spots = [];
    return (minDist, minR = 9, maxR = ARENA_RADIUS - 5) => {
      for (let tries = 0; tries < 60; tries++) {
        const a = ctx.rnd() * Math.PI * 2;
        const d = minR + ctx.rnd() * (maxR - minR);
        const x = Math.cos(a) * d, z = Math.sin(a) * d;
        if (spots.every((s) => Math.hypot(s.x - x, s.z - z) > minDist)) { spots.push({ x, z }); return { x, z }; }
      }
      return null;
    };
  }

  buildTemple(ctx) {
    const { group, rnd, obstacles } = ctx;
    const stone = new THREE.MeshLambertMaterial({ color: '#3a3352', flatShading: true });
    const stoneDark = new THREE.MeshLambertMaterial({ color: '#2a2440', flatShading: true });
    const crystalMats = ['#7a4dff', '#36d6ff', '#ff4fd8'].map((c) => new THREE.MeshBasicMaterial({ color: c }));
    const place = this.placer(ctx);
    for (let i = 0; i < 6; i++) {
      const p = place(10);
      if (!p) continue;
      const h = 2 + rnd() * 4.5;
      const g = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.6, 2.1), stoneDark);
      base.position.y = 0.3;
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.85, h, 8), stone);
      col.position.y = 0.6 + h / 2;
      g.add(base, col);
      if (rnd() > 0.5) { const cap = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.45, 1.9), stoneDark); cap.position.y = 0.6 + h + 0.2; cap.rotation.y = rnd(); g.add(cap); }
      g.position.set(p.x, 0, p.z);
      g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      group.add(g);
      obstacles.push({ x: p.x, z: p.z, r: 1.15 });
    }
    for (let i = 0; i < 4; i++) {
      const p = place(9);
      if (!p) continue;
      const g = new THREE.Group();
      const mat = crystalMats[i % 3];
      for (let k = 0; k < 4; k++) {
        const h = 1 + rnd() * 2.4;
        const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), mat);
        m.scale.set(1, h, 1);
        m.position.set((rnd() - 0.5) * 1.2, h * 0.35, (rnd() - 0.5) * 1.2);
        m.rotation.set((rnd() - 0.5) * 0.6, rnd() * 3, (rnd() - 0.5) * 0.6);
        g.add(m);
      }
      g.position.set(p.x, 0, p.z);
      group.add(g);
      obstacles.push({ x: p.x, z: p.z, r: 1.2 });
      ctx.animated.push({ obj: g, phase: rnd() * 6 });
    }
    for (let i = 0; i < 3; i++) {
      const p = place(9);
      if (!p) continue;
      const r = 1.1 + rnd() * 0.8;
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), stone);
      m.scale.y = 0.7; m.position.set(p.x, r * 0.45, p.z); m.rotation.set(rnd(), rnd() * 3, rnd());
      m.castShadow = m.receiveShadow = true;
      group.add(m);
      obstacles.push({ x: p.x, z: p.z, r: r * 0.95 });
    }
    // Rune-lit broken archway facing the rift
    const archZ = -ARENA_RADIUS + 6;
    for (const sx of [-3.2, 3.2]) {
      const pil = new THREE.Mesh(new THREE.BoxGeometry(1.2, 6, 1.2), stone);
      pil.position.set(sx, 3, archZ); pil.castShadow = true;
      group.add(pil);
      obstacles.push({ x: sx, z: archZ, r: 0.95 });
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.9, 1.4), stoneDark);
    lintel.position.set(0.3, 6.3, archZ); lintel.rotation.z = -0.06; lintel.castShadow = true;
    group.add(lintel);
  }

  buildGarden(ctx) {
    const { group, rnd, obstacles } = ctx;
    const place = this.placer(ctx);
    const stalk = new THREE.MeshLambertMaterial({ color: '#1f4a3a', flatShading: true });
    const bark = new THREE.MeshLambertMaterial({ color: '#3a2a3a', flatShading: true });
    const moss = new THREE.MeshLambertMaterial({ color: '#2c5a40', flatShading: true });
    const glows = ['#7dffcf', '#ff7ad8', '#c8ff7a', '#7ab8ff'].map((c) => new THREE.MeshBasicMaterial({ color: c }));
    // Luminous plant clusters (decor + small obstacles)
    for (let i = 0; i < 6; i++) {
      const p = place(9);
      if (!p) continue;
      const g = new THREE.Group();
      for (let k = 0; k < 5; k++) {
        const h = 0.8 + rnd() * 2.2;
        const s = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, h, 5), stalk);
        const ox = (rnd() - 0.5) * 1.6, oz = (rnd() - 0.5) * 1.6;
        s.position.set(ox, h / 2, oz); s.rotation.z = (rnd() - 0.5) * 0.4;
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.18 + rnd() * 0.15, 6, 4), glows[(i + k) % 4]);
        bulb.position.set(ox, h, oz);
        g.add(s, bulb);
      }
      g.position.set(p.x, 0, p.z);
      group.add(g);
      obstacles.push({ x: p.x, z: p.z, r: 1.0 });
      ctx.animated.push({ obj: g, phase: rnd() * 6 });
    }
    // Crystal trees
    for (let i = 0; i < 5; i++) {
      const p = place(10);
      if (!p) continue;
      const g = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 3.2, 6), bark);
      trunk.position.y = 1.6; trunk.castShadow = true;
      const crown = new THREE.Mesh(new THREE.OctahedronGeometry(1.5, 0), glows[i % 4]);
      crown.position.y = 3.9; crown.scale.y = 1.3;
      g.add(trunk, crown);
      g.position.set(p.x, 0, p.z);
      group.add(g);
      obstacles.push({ x: p.x, z: p.z, r: 0.85 });
      ctx.animated.push({ obj: crown, phase: rnd() * 6, spin: true });
    }
    for (let i = 0; i < 3; i++) {
      const p = place(9);
      if (!p) continue;
      const r = 1.1 + rnd() * 0.6;
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), moss);
      m.scale.y = 0.6; m.position.set(p.x, r * 0.35, p.z); m.rotation.set(rnd(), rnd() * 3, rnd());
      m.castShadow = m.receiveShadow = true;
      group.add(m);
      obstacles.push({ x: p.x, z: p.z, r: r * 0.95 });
    }
    // Ground glow patches (decor only)
    for (let i = 0; i < 10; i++) {
      const a = rnd() * Math.PI * 2, d = rnd() * (ARENA_RADIUS - 4);
      const m = new THREE.Mesh(new THREE.CircleGeometry(0.8 + rnd() * 1.2, 12).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: '#2aff9a', transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.position.set(Math.cos(a) * d, 0.04, Math.sin(a) * d);
      group.add(m);
    }
  }

  buildCitadel(ctx) {
    const { group, rnd, obstacles } = ctx;
    const place = this.placer(ctx);
    const dark = new THREE.MeshLambertMaterial({ color: '#2e2428', flatShading: true });
    const darker = new THREE.MeshLambertMaterial({ color: '#1e171a', flatShading: true });
    const ember = new THREE.MeshBasicMaterial({ color: '#ff4d3d' });
    // Broken wall segments (collision approximated by circles along their length)
    for (let i = 0; i < 4; i++) {
      const p = place(13, 11);
      if (!p) continue;
      const len = 4 + rnd() * 3, rot = rnd() * Math.PI;
      const wall = new THREE.Mesh(new THREE.BoxGeometry(len, 2.2 + rnd() * 2, 0.9), dark);
      wall.position.set(p.x, 1.4, p.z); wall.rotation.y = rot;
      wall.castShadow = wall.receiveShadow = true;
      const crack = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.4, 0.95), ember);
      crack.position.set(p.x, 1.2, p.z); crack.rotation.y = rot;
      group.add(wall, crack);
      const dx = Math.cos(rot), dz = -Math.sin(rot);
      for (let k = -1; k <= 1; k++) obstacles.push({ x: p.x + dx * k * len * 0.33, z: p.z + dz * k * len * 0.33, r: 0.75 });
    }
    // Dark spires
    for (let i = 0; i < 5; i++) {
      const p = place(9);
      if (!p) continue;
      const h = 4 + rnd() * 4;
      const sp = new THREE.Mesh(new THREE.ConeGeometry(0.9, h, 5), darker);
      sp.position.set(p.x, h / 2, p.z); sp.castShadow = true;
      group.add(sp);
      obstacles.push({ x: p.x, z: p.z, r: 0.9 });
    }
    // Fractured platforms (walkable decor) with glowing seams
    for (let i = 0; i < 6; i++) {
      const a = rnd() * Math.PI * 2, d = 6 + rnd() * (ARENA_RADIUS - 10);
      const slab = new THREE.Mesh(new THREE.BoxGeometry(3 + rnd() * 2, 0.15, 2 + rnd() * 2), darker);
      slab.position.set(Math.cos(a) * d, 0.07, Math.sin(a) * d); slab.rotation.y = rnd() * 3;
      slab.receiveShadow = true;
      group.add(slab);
    }
    // Unstable rift tears hovering near the edge (decor)
    const tearMat = new THREE.MeshBasicMaterial({ color: '#ff3a2a', transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false });
    for (let i = 0; i < 5; i++) {
      const a = rnd() * Math.PI * 2, d = ARENA_RADIUS + 3 + rnd() * 6;
      const tear = new THREE.Mesh(new THREE.CircleGeometry(1, 6), tearMat);
      tear.scale.set(0.5, 2 + rnd() * 2, 1);
      tear.position.set(Math.cos(a) * d, 3 + rnd() * 3, Math.sin(a) * d);
      group.add(tear);
      ctx.animated.push({ obj: tear, phase: rnd() * 6, spin: true });
    }
  }

  buildBorder(ctx) {
    const { group, th } = ctx;
    const ring = new THREE.Mesh(new THREE.RingGeometry(ARENA_RADIUS - 0.2, ARENA_RADIUS + 0.4, 96).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: th.border, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
    ring.position.y = 0.05;
    group.add(ring);
    ctx.borderRing = ring;
    const rnd = mulberry32(99);
    const inst = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshLambertMaterial({ color: th.rock, flatShading: true }), 64);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2 + rnd() * 0.05;
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
    group.add(inst);
  }

  buildRift(ctx) {
    const { th } = ctx;
    const g = new THREE.Group();
    g.position.copy(this.riftPos);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(30, 30),
      new THREE.MeshBasicMaterial({ map: riftTexture(th.riftGlow), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    glow.scale.set(1, 1.5, 1);
    const tear = new THREE.Mesh(new THREE.CircleGeometry(4, 6), new THREE.MeshBasicMaterial({ color: '#05010a', fog: false }));
    tear.scale.set(0.55, 2.4, 1); tear.position.z = 0.1;
    g.add(glow, tear);
    const rings = th.rift.map((c, i) => {
      const r = new THREE.Mesh(new THREE.TorusGeometry(5.5 + i * 1.6, 0.12, 5, 48),
        new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, fog: false }));
      r.scale.y = 1.7;
      g.add(r);
      return r;
    });
    ctx.group.add(g);
    ctx.rift = { rings, glow };
  }

  buildFloatingRocks(ctx) {
    const rnd = mulberry32(4242 + ctx.th.rock.length);
    const garden = ctx.th === THEMES.garden;
    const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshLambertMaterial({ color: garden ? '#2c5a40' : ctx.th.rock, flatShading: true }), 46);
    ctx.rocks = rocks;
    ctx.rockData = [];
    for (let i = 0; i < 46; i++) {
      const a = rnd() * Math.PI * 2;
      const d = ARENA_RADIUS + 8 + rnd() * 40;
      ctx.rockData.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, y: -8 + rnd() * 16, s: (garden ? 1.5 : 0.8) + rnd() * 3.2, phase: rnd() * 6, spin: (rnd() - 0.5) * 0.4, rx: garden ? 0 : rnd() * 3, ry: rnd() * 3, flat: garden ? 0.45 : 0.75 });
    }
    ctx.group.add(rocks);
    this.updateRocks(ctx, 0);
  }

  buildMotes(ctx) {
    const count = 220;
    const pos = new Float32Array(count * 3);
    const rnd = mulberry32(5);
    for (let i = 0; i < count; i++) {
      const a = rnd() * Math.PI * 2, d = rnd() * (ARENA_RADIUS + 20);
      pos[i * 3] = Math.cos(a) * d; pos[i * 3 + 1] = rnd() * 14; pos[i * 3 + 2] = Math.sin(a) * d;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    ctx.motes = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.35, map: this.dot, color: ctx.th.motes, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
    ctx.motes.frustumCulled = false;
    ctx.group.add(ctx.motes);
  }

  updateRocks(ctx, t) {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
    ctx.rockData.forEach((r, i) => {
      p.set(r.x, r.y + Math.sin(t * 0.5 + r.phase) * 0.8, r.z);
      e.set(r.rx, r.ry + t * r.spin, 0);
      q.setFromEuler(e);
      s.set(r.s, r.s * r.flat, r.s);
      m.compose(p, q, s);
      ctx.rocks.setMatrixAt(i, m);
    });
    ctx.rocks.instanceMatrix.needsUpdate = true;
  }

  update(dt, t) {
    const c = this.cur;
    this.updateRocks(c, t);
    const a = c.motes.geometry.attributes.position.array;
    for (let i = 1; i < a.length; i += 3) { a[i] += dt * 0.6; if (a[i] > 14) a[i] = 0; }
    c.motes.geometry.attributes.position.needsUpdate = true;
    c.rift.rings.forEach((r, i) => { r.rotation.z = t * (0.3 + i * 0.25) * (i % 2 ? -1 : 1); });
    c.rift.glow.material.opacity = 0.8 + Math.sin(t * 2) * 0.15;
    c.rune.rotation.y = t * 0.05;
    c.borderRing.material.opacity = 0.45 + Math.sin(t * 1.5) * 0.15;
    for (const an of c.animated) {
      if (an.spin) an.obj.rotation.y = t * 0.4 + an.phase;
      else an.obj.position.y = Math.sin(t * 1.2 + an.phase) * 0.08;
    }
    if (this.zoneWall.visible) this.zoneWall.material.opacity = 0.25 + Math.sin(t * 4) * 0.1;
  }

  setShadows(on) { this.sun.castShadow = on; }

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
