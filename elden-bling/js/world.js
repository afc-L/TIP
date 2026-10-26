// The compact map: terrain, walls, gates, props, shrines, chests, NPCs and triggers.
import * as THREE from 'three';
import { Colliders, groundHeight } from './collision.js';
import * as M from './models.js';
import { SIGNS } from './data.js';

export const ZONES = { grass: 'The Grasslands', swamp: 'The Cursed Swamp', backyard: "The King's Backyard", arena: 'The Lawn of Lord Touchgrass' };

export const SHRINES = [
  { id: 's1', name: 'Shrine of First Steps', x: 6, z: 84 },
  { id: 's2', name: 'Shrine of Damp Socks', x: -38, z: 4 },
  { id: 's3', name: 'Shrine of the Freshly Mowed', x: 10, z: -52 },
];

export const START = { x: 0, z: 93 };

export const ENEMY_SPAWNS = [
  // Grasslands
  ['goblin', -18, 66], ['goblin', -26, 58], ['goblin', 28, 48], ['goblin', -38, 50], ['knight', 24, 62], ['knight', -46, 40], ['goblin', 40, 78],
  // Swamp
  ['skeleton', -42, 14], ['frog', -26, 12], ['skeleton', -28, -6], ['frog', -8, 12], ['skeleton', 12, 6], ['frog', 26, 18], ['knight', 36, -6],
  ['frog', 16, -20], ['skeleton', 40, -26], ['skeleton', -20, -24], ['frog', -46, -28], ['goblin', 48, 2], ['skeleton', 2, 22],
  // Backyard
  ['knight', -14, -55], ['knight', 22, -58], ['goblin', -32, -57], ['goblin', 34, -52], ['skeleton', -46, -60], ['frog', 50, -60],
];

export const CHESTS = [
  { id: 'c_garlic', x: -34, z: 88, loot: [['consumable', 'garlic', 2], ['coins', 40]] },
  { id: 'c_divorce', x: 38, z: 63, loot: [['weapon', 'divorce']] },
  { id: 'c_colander', x: 50, z: 94, loot: [['armor', 'colander'], ['coins', 30]] },
  { id: 'c_crown', x: -54, z: 75, fancy: true, loot: [['armor', 'crown'], ['coins', 60]] },
  { id: 'c_swamp1', x: 30, z: 24, loot: [['consumable', 'dignity', 2], ['coins', 80]] },
  { id: 'c_bathrobe', x: -53, z: 0, loot: [['armor', 'bathrobe'], ['consumable', 'garlic', 1]] },
  { id: 'c_baguette', x: 50, z: -36, fancy: true, loot: [['weapon', 'baguette']] },
  { id: 'c_shed', x: 40, z: -63.5, fancy: true, loot: [['coins', 220], ['consumable', 'pepper', 2]] },
  { id: 'c_yard', x: -50, z: -52, loot: [['consumable', 'garlic', 2], ['coins', 60]] },
];

const POOLS = [[-20, 20, 5], [6, 14, 3.5], [20, 0, 6], [-10, -12, 5], [30, -32, 4], [-34, -30, 4], [46, 12, 5], [-50, -15, 3.5]];

const PATH = [[0, 93], [0, 72], [-24, 56], [-50, 38], [-50, 28], [-44, 12], [-38, 4], [-20, -10], [0, -24], [0, -46], [0, -66], [0, -88]];
const PATH2 = [[0, 72], [26, 60], [38, 63]];
const PATH3 = [[0, 29], [0, 10], [-10, -2], [-20, -10]];

function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function distToPath(x, z, path) {
  let best = 1e9;
  for (let i = 0; i < path.length - 1; i++) {
    const [ax, az] = path[i], [bx, bz] = path[i + 1];
    const dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
  }
  return best;
}

export function zoneAt(x, z) {
  if (z > 30) return 'grass';
  if (z > -45) return 'swamp';
  if (z > -67 || Math.abs(x) > 23) return 'backyard';
  return 'arena';
}

export class World {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.col = new Colliders();
    this.interactables = [];
    this.illusory = [];
    this.gates = {};
    this.chests = {};
    this.shrines = {};
    this.triggers = [];
    this.animated = [];
    this.pools = POOLS.map(([x, z, r]) => ({ x, z, r }));
    this.puddles = [];
    this.rand = rng(1337);
    this.deco = game.preset.deco;
    this.build();
  }

  build() {
    this.buildSkyAndLights();
    this.buildTerrain();
    this.buildWalls();
    this.buildPools();
    this.buildDecorations();
    this.buildPlaces();
  }

  buildSkyAndLights() {
    const s = this.scene;
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x557a3a, 1.6);
    s.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff1cc, 1.9);
    this.sun.position.set(30, 60, 20);
    s.add(this.sun, this.sun.target);
    if (this.game.useShadows) {
      this.sun.castShadow = true;
      this.sun.shadow.mapSize.set(1024, 1024);
      const c = this.sun.shadow.camera;
      c.left = -26; c.right = 26; c.top = 26; c.bottom = -26; c.near = 1; c.far = 140;
      this.sun.shadow.bias = -0.0015;
    }
    s.fog = new THREE.Fog(0xbfe3ff, 20, this.game.preset.viewDist);
    s.background = new THREE.Color(0x9fd4ff);
  }

  buildTerrain() {
    const W = 170, D = 260, cx = 0, cz = -4;
    let g = new THREE.PlaneGeometry(W, D, 68, 104);
    g.rotateX(-Math.PI / 2);
    g.translate(cx, 0, cz);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      p.setY(i, groundHeight(x, z));
    }
    g = g.toNonIndexed();
    const pos = g.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    const r = rng(7);
    for (let i = 0; i < pos.count; i += 3) {
      const x = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
      const y = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
      const z = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
      this.groundColor(x, y, z, c, r());
      for (let k = 0; k < 3; k++) { colors[(i + k) * 3] = c.r; colors[(i + k) * 3 + 1] = c.g; colors[(i + k) * 3 + 2] = c.b; }
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    m.receiveShadow = true;
    this.scene.add(m);
    this.terrain = m;
  }

  groundColor(x, y, z, c, n) {
    const v = (n - 0.5) * 0.06;
    if (y > 2.2) { c.setHex(y > 9 ? 0xeeeeff : 0x7d7a6a); c.offsetHSL(0, 0, v); return; }
    const zone = zoneAt(x, z);
    const onPath = distToPath(x, z, PATH) < 2.2 || distToPath(x, z, PATH2) < 1.6 || distToPath(x, z, PATH3) < 1.6;
    if (zone === 'grass') {
      if (onPath) c.setHex(0xb59a62); else c.setHex(0x6fbf4a);
    } else if (zone === 'swamp') {
      if (onPath) c.setHex(0x6a5f40); else c.setHex(n > 0.7 ? 0x5a5a34 : 0x4f6b3a);
    } else {
      // Mowed lawn stripes.
      if (onPath && zone === 'backyard') c.setHex(0xd8c8a0);
      else c.setHex(Math.floor((x + 200) / 4) % 2 ? 0x82d65a : 0x6cc048);
    }
    c.offsetHSL(0, 0, v);
  }

  // ---------- Walls, gates, illusory walls ----------

  wallMesh(minX, minZ, maxX, maxZ, h, style) {
    const w = maxX - minX, d = maxZ - minZ;
    const x = (minX + maxX) / 2, z = (minZ + maxZ) / 2;
    const y0 = Math.min(groundHeight(minX, minZ), groundHeight(maxX, maxZ), groundHeight(x, z)) - 0.5;
    const hh = h + 0.5;
    let m;
    if (style === 'hedge') m = M.mesh(M.box(w, hh, d), M.mat(0x2f7a2a), x, y0 + hh / 2, z);
    else if (style === 'rock') m = M.mesh(M.box(w, hh, d), M.mat(0x8a8478), x, y0 + hh / 2, z);
    else m = M.mesh(M.box(w, hh, d), M.mat(0x8a5a2a), x, y0 + hh / 2, z);
    m.castShadow = this.game.useShadows; m.receiveShadow = true;
    this.scene.add(m);
    return m;
  }

  wall(minX, minZ, maxX, maxZ, style = 'rock', h = 3.6) {
    this.col.addBox(minX, minZ, maxX, maxZ, { h });
    const m = this.wallMesh(minX, minZ, maxX, maxZ, h, style);
    if (style === 'rock') {
      // Lumpy boulders along the top so it doesn't look like a box.
      const len = Math.max(maxX - minX, maxZ - minZ);
      const n = Math.floor(len / 3);
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        const x = minX + (maxX - minX) * t, z = minZ + (maxZ - minZ) * t;
        const rk = M.mesh(M.ico(1.1 + this.rand() * 0.6, 0), M.mat(0x9a9488), x, groundHeight(x, z) + h - 0.2, z);
        rk.rotation.set(this.rand() * 3, this.rand() * 3, 0);
        this.scene.add(rk);
      }
    }
    return m;
  }

  gate(id, minX, minZ, maxX, maxZ, style) {
    const box = this.col.addBox(minX, minZ, maxX, maxZ, { h: 3.4 });
    let m;
    if (style === 'fog') {
      const w = maxX - minX;
      m = M.mesh(M.box(w, 4.2, 0.4), new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.45, depthWrite: false }), (minX + maxX) / 2, groundHeight(0, minZ) + 2.1, (minZ + maxZ) / 2);
      m.renderOrder = 2;
      this.scene.add(m);
      this.animated.push((t) => { m.material.opacity = 0.35 + Math.sin(t * 2) * 0.1; });
    } else {
      m = new THREE.Group();
      const x = (minX + maxX) / 2, z = (minZ + maxZ) / 2;
      m.position.set(x, groundHeight(x, z), z);
      const w = maxX - minX;
      const iron = style === 'iron';
      for (let i = 0; i < Math.round(w / 0.5); i++) M.mesh(M.box(0.18, 3.2, 0.18), M.mat(iron ? 0x333333 : 0x7a4a22), -w / 2 + 0.25 + i * 0.5, 1.6, 0, m);
      M.mesh(M.box(w, 0.25, 0.25), M.mat(iron ? 0x555555 : 0x5a3a1a), 0, 2.6, 0, m);
      M.mesh(M.box(w, 0.25, 0.25), M.mat(iron ? 0x555555 : 0x5a3a1a), 0, 0.8, 0, m);
      if (style === 'doggy') {
        m.scale.y = 0.85;
        M.mesh(M.box(0.9, 0.7, 0.3), M.mat(0x3a2a1a), 0, 0.4, 0, m);
      }
      this.scene.add(m);
    }
    const g = { id, box, mesh: m, open: false, style };
    this.gates[id] = g;
    return g;
  }

  openGate(id, instant = false) {
    const g = this.gates[id];
    if (!g || g.open) return;
    g.open = true;
    g.box.enabled = false;
    if (g.style === 'fog' || instant) { g.mesh.visible = false; return; }
    // Slide into the ground.
    const start = g.mesh.position.y;
    let t = 0;
    const anim = (_, dt) => {
      t += dt;
      g.mesh.position.y = start - Math.min(1, t / 1.2) * 3.4;
      if (t > 1.2) { g.mesh.visible = false; return true; }
      return false;
    };
    this.animated.push(anim);
  }

  closeFog() {
    const g = this.gates.fog;
    g.open = false; g.box.enabled = true; g.mesh.visible = true;
  }

  illusoryWall(id, minX, minZ, maxX, maxZ, style) {
    const box = this.col.addBox(minX, minZ, maxX, maxZ, { h: 3.6 });
    const m = this.wallMesh(minX, minZ, maxX, maxZ, 3.6, style);
    const w = { id, box, mesh: m, broken: false, x: (minX + maxX) / 2, z: (minZ + maxZ) / 2, r: Math.max(maxX - minX, maxZ - minZ) / 2 };
    this.illusory.push(w);
    return w;
  }

  breakWall(w, silent = false) {
    if (w.broken) return;
    w.broken = true;
    w.box.enabled = false;
    w.mesh.visible = false;
    if (!silent) {
      const fx = this.game.fx;
      fx.burst(w.x, groundHeight(w.x, w.z) + 1.5, w.z, 0x9a9488, 30, { glow: false, speed: 6, up: 4 });
      fx.burst(w.x, groundHeight(w.x, w.z) + 1.5, w.z, 0xffffff, 14, { speed: 4 });
      this.game.audio.play('wallbreak');
      this.game.ui.toast('Illusory wall! (It was drywall the whole time.)');
    }
  }

  buildWalls() {
    // Outer boundary (invisible; mountains and trees sell it).
    this.col.addBox(-70, -120, -58, 112, { cam: false });
    this.col.addBox(58, -120, 70, 112, { cam: false });
    this.col.addBox(-70, 101, 70, 112, { cam: false });
    this.col.addBox(-70, -120, 70, -108.5, { cam: false });

    // Grasslands / swamp divider: entry at the west, shortcut gate in the middle.
    this.wall(-58, 29, -54, 32, 'rock');
    this.wall(-46, 29, -3, 32, 'rock');
    this.wall(3, 29, 58, 32, 'rock');
    this.gate('shortcut', -3, 29.6, 3, 31.4, 'wood');

    // Hidden pocket in the grasslands (west).
    this.wall(-58, 68.5, -49, 70, 'rock');
    this.wall(-58, 80, -49, 81.5, 'rock');
    this.illusoryWall('w_pocket', -50.5, 70, -49, 80, 'rock');

    // Swamp / backyard hedge with the boss gate and a doggy door.
    this.wall(-58, -46, -32, -43, 'hedge', 3.4);
    this.wall(-29, -46, -3, -43, 'hedge', 3.4);
    this.wall(3, -46, 58, -43, 'hedge', 3.4);
    this.gate('yardgate', -3, -45.4, 3, -43.6, 'iron');
    this.gate('doggy', -32, -45.2, -29, -43.8, 'doggy');

    // Backyard / boss lawn hedge with the fog wall.
    this.wall(-58, -68, -3, -66, 'hedge', 3.4);
    this.wall(3, -68, 58, -66, 'hedge', 3.4);
    this.gate('fog', -3, -67.6, 3, -66.4, 'fog');
    // Boss lawn sides and back.
    this.wall(-24, -108.5, -22, -68, 'hedge', 3.4);
    this.wall(22, -108.5, 24, -68, 'hedge', 3.4);
    this.wall(-24, -110, 24, -108, 'hedge', 3.4);

    // Shed with a secret pocket behind it.
    const shed = M.makeShed();
    shed.position.set(40, groundHeight(40, -58), -58);
    this.scene.add(shed);
    this.col.addBox(37.5, -60, 42.5, -56, { h: 3.5 });
    this.wall(36.5, -66, 37.5, -60, 'hedge', 3.0);
    this.illusoryWall('w_shed', 42.5, -66, 43.5, -60, 'hedge');
  }

  buildPools() {
    const poolM = new THREE.MeshLambertMaterial({ color: 0x7a3a9a, emissive: 0x2a0a3a, transparent: true, opacity: 0.85 });
    const padM = M.mat(0x3a8a3a);
    for (const p of this.pools) {
      const m = new THREE.Mesh(new THREE.CircleGeometry(p.r, 18).rotateX(-Math.PI / 2), poolM);
      m.position.set(p.x, groundHeight(p.x, p.z) + 0.06, p.z);
      m.receiveShadow = true;
      this.scene.add(m);
      for (let i = 0; i < 3; i++) {
        const a = this.rand() * 6.28, r = this.rand() * p.r * 0.7;
        const lp = M.mesh(M.cyl(0.4, 0.4, 0.03, 7), padM, p.x + Math.cos(a) * r, m.position.y + 0.03, p.z + Math.sin(a) * r);
        this.scene.add(lp);
      }
    }
    const pudM = new THREE.MeshBasicMaterial({ color: 0x55dd33, transparent: true, opacity: 0.7, depthWrite: false });
    const pudG = new THREE.CircleGeometry(0.9, 10).rotateX(-Math.PI / 2);
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(pudG, pudM);
      m.visible = false; m.renderOrder = 1;
      this.scene.add(m);
      this.puddles.push({ mesh: m, t: 0, x: 0, z: 0 });
    }
  }

  addSlimePuddle(x, z) {
    const p = this.puddles.find((o) => o.t <= 0) || this.puddles[0];
    p.t = 4; p.x = x; p.z = z;
    p.mesh.position.set(x, groundHeight(x, z) + 0.07, z);
    p.mesh.visible = true;
  }

  // Returns true if (x,z) is in poison (pool or slime puddle).
  inPoison(x, z) {
    for (const p of this.pools) if ((x - p.x) ** 2 + (z - p.z) ** 2 < (p.r - 0.3) ** 2) return true;
    for (const p of this.puddles) if (p.t > 0 && (x - p.x) ** 2 + (z - p.z) ** 2 < 0.8) return true;
    return false;
  }

  // ---------- Decorations (instanced per zone so far zones get culled) ----------

  clearSpot(x, z, r) {
    if (distToPath(x, z, PATH) < 3.5 + r || distToPath(x, z, PATH2) < 2.5 + r || distToPath(x, z, PATH3) < 2.5 + r) return false;
    for (const p of this.pools) if (Math.hypot(x - p.x, z - p.z) < p.r + r + 0.5) return false;
    for (const b of this.col.boxes) if (x > b.minX - r - 1 && x < b.maxX + r + 1 && z > b.minZ - r - 1 && z < b.maxZ + r + 1) return false;
    for (const s of SHRINES) if (Math.hypot(x - s.x, z - s.z) < 6) return false;
    for (const c of CHESTS) if (Math.hypot(x - c.x, z - c.z) < 4) return false;
    for (const e of ENEMY_SPAWNS) if (Math.hypot(x - e[1], z - e[2]) < 3) return false;
    if (Math.hypot(x, z + 32) < 15) return false; // mini-boss arena
    if (Math.hypot(x - 0, z - 82) < 10 || Math.hypot(x - 14, z - 81) < 4) return false; // starting village
    return true;
  }

  buildDecorations() {
    const R = this.rand;
    const lists = {}; // key -> [{x,y,z,s,ry}]
    const add = (key, x, z, s = 1, collide = 0) => {
      (lists[key] ||= []).push({ x, y: groundHeight(x, z), z, s, ry: R() * 6.28 });
      if (collide && Math.abs(x) < 58 && z < 101 && z > -108) this.col.addCircle(x, z, collide * s, { cam: false });
    };
    const scatter = (count, minX, maxX, minZ, maxZ, fn) => {
      let n = 0, tries = 0;
      while (n < count && tries < count * 20) {
        tries++;
        const x = minX + R() * (maxX - minX), z = minZ + R() * (maxZ - minZ);
        if (fn(x, z)) n++;
      }
    };
    const d = this.deco;

    // Grasslands trees, rocks, flowers.
    scatter(Math.round(60 * d), -56, 56, 33, 100, (x, z) => { if (!this.clearSpot(x, z, 1.2)) return false; add('tree_grass', x, z, 0.8 + R() * 0.6, 0.45); return true; });
    scatter(Math.round(25 * d), -56, 56, 33, 100, (x, z) => { if (!this.clearSpot(x, z, 1)) return false; add('rock_grass', x, z, 0.6 + R() * 0.8, 0.8); return true; });
    if (this.game.preset.grass) scatter(Math.round(300 * d), -57, 57, 33, 100, (x, z) => { add('tuft_grass', x, z, 0.7 + R() * 0.6); return true; });
    scatter(Math.round(80 * d), -57, 57, 33, 100, (x, z) => { add('flower', x, z, 0.8 + R() * 0.5); return true; });

    // Swamp dead trees, reeds, mushrooms.
    scatter(Math.round(50 * d), -56, 56, -42, 27, (x, z) => { if (!this.clearSpot(x, z, 1.2)) return false; add('deadtree', x, z, 0.8 + R() * 0.7, 0.35); return true; });
    scatter(Math.round(140 * d), -57, 57, -42, 27, (x, z) => { add('reed', x, z, 0.8 + R() * 0.8); return true; });
    scatter(Math.round(40 * d), -57, 57, -42, 27, (x, z) => { if (!this.clearSpot(x, z, 0.5)) return false; add('mushroom', x, z, 0.6 + R() * 0.8); return true; });
    // The baguette thicket: a ring of dead trees with one gap facing the map edge.
    for (let i = 0; i < 10; i++) {
      const a = (i / 11) * Math.PI * 2 + 0.3;
      add('deadtree', 50 + Math.cos(a) * 3.6, -36 + Math.sin(a) * 3.6, 1.1, 0.5);
    }
    // Chicken hideout behind dead trees.
    for (let i = 0; i < 6; i++) add('deadtree', -48 + i * 0.6, -33 - i * 1.1, 1.0, 0.45);

    // Backyard bushes and flower beds.
    scatter(Math.round(26 * d), -56, 56, -65, -48, (x, z) => { if (!this.clearSpot(x, z, 1)) return false; add('bush', x, z, 0.8 + R() * 0.5, 0.7); return true; });
    scatter(Math.round(120 * d), -56, 56, -65, -47, (x, z) => { add('flower', x, z, 0.8 + R() * 0.5); return true; });
    // Trees visible beyond the hedges around the boss lawn.
    for (let i = 0; i < 40 * d + 10; i++) {
      const side = R() < 0.5 ? -1 : 1;
      add('tree_grass', side * (28 + R() * 30), -72 - R() * 36, 1 + R() * 0.8);
    }
    // A tree line beyond the playable border.
    for (let i = 0; i < 70; i++) {
      const t = i / 70;
      const per = t * 4;
      let x, z;
      if (per < 1) { x = -62 - R() * 8; z = -110 + per * 212; }
      else if (per < 2) { x = 62 + R() * 8; z = -110 + (per - 1) * 212; }
      else if (per < 3) { x = -60 + (per - 2) * 120; z = 104 + R() * 8; }
      else { x = -60 + (per - 3) * 120; z = -112 - R() * 6; }
      add(z < 30 && z > -45 ? 'deadtree' : 'tree_grass', x, z, 1.4 + R());
    }

    // Build instanced meshes, chunked by zone so distant ones are culled.
    const parts = {
      tree_grass: [[M.cyl(0.18, 0.26, 1.6, 5), M.mat(0x7a4a22), 0.8], [M.cone(1.3, 2.6, 6), M.mat(0x3f8f3a), 2.6], [M.cone(1.0, 2.0, 6), M.mat(0x4fa046), 3.6]],
      rock_grass: [[M.ico(0.9, 0), M.mat(0x8f8a80), 0.4]],
      tuft_grass: [[M.cone(0.12, 0.45, 3), M.mat(0x5aa83a), 0.2]],
      flower: [[M.cyl(0.02, 0.02, 0.3, 3), M.mat(0x3a8a2a), 0.15], [M.ico(0.09, 0), M.mat(0xffdd44), 0.33]],
      deadtree: [[M.cyl(0.14, 0.3, 3.4, 5), M.mat(0x4a3a2a), 1.7], [M.cone(0.08, 1.6, 4), M.mat(0x4a3a2a), 3.0]],
      reed: [[M.cone(0.05, 1.2, 3), M.mat(0x6a7a3a), 0.6]],
      mushroom: [[M.cyl(0.05, 0.07, 0.3, 5), M.mat(0xeeeecc), 0.15], [M.cone(0.22, 0.2, 6), M.mat(0xcc4488, { emissive: 0x330a22 }), 0.35]],
      bush: [[M.ico(0.9, 0), M.mat(0x3f8a3a), 0.6]],
    };
    const dummy = new THREE.Object3D();
    const flowerColors = [0xffdd44, 0xff66aa, 0xffffff, 0xaa66ff, 0xff7744];
    const col = new THREE.Color();
    for (const key in lists) {
      const items = lists[key];
      const chunks = { a: [], b: [], c: [] };
      for (const it of items) chunks[it.z > 30 ? 'a' : it.z > -45 ? 'b' : 'c'].push(it);
      for (const ck in chunks) {
        const arr = chunks[ck];
        if (!arr.length) continue;
        for (const [g, m, yOff] of parts[key]) {
          const im = new THREE.InstancedMesh(g, m, arr.length);
          arr.forEach((it, i) => {
            dummy.position.set(it.x, it.y + yOff * it.s, it.z);
            dummy.rotation.set(0, it.ry, 0);
            if (key === 'deadtree' && yOff > 2) { dummy.rotation.z = 0.8; dummy.position.x += 0.4 * it.s; }
            if (key === 'rock_grass' || key === 'bush') dummy.scale.set(it.s, it.s * 0.7, it.s);
            else dummy.scale.setScalar(it.s);
            dummy.updateMatrix();
            im.setMatrixAt(i, dummy.matrix);
            if (key === 'flower' && yOff > 0.3) im.setColorAt(i, col.setHex(flowerColors[i % flowerColors.length]));
          });
          im.castShadow = this.game.useShadows && (key === 'tree_grass' || key === 'deadtree' || key === 'rock_grass');
          im.receiveShadow = false;
          im.computeBoundingSphere();
          this.scene.add(im);
        }
      }
    }

    // Mountains ring (simple cones) far outside.
    const mtnM = M.mat(0x8a8f80);
    const snowM = M.mat(0xf0f4ff);
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const x = Math.cos(a) * 112, z = Math.sin(a) * 150 - 4;
      const h = 28 + R() * 22;
      const r = 20 + R() * 8;
      const mt = M.mesh(M.cone(r, h, 5), mtnM, x, h / 2 - 2, z);
      const sn = M.mesh(M.cone(r * 0.3, h * 0.3, 5), snowM, x, h * 0.85 - 2, z);
      mt.rotation.y = sn.rotation.y = R() * 3;
      this.scene.add(mt, sn);
    }
  }

  // ---------- Places: shrines, chests, NPCs, signs, props ----------

  sign(text, x, z, ry = 0) {
    const s = M.makeSign(text.split(':')[0].slice(0, 22));
    s.position.set(x, groundHeight(x, z), z);
    s.rotation.y = ry;
    this.scene.add(s);
    this.col.addCircle(x, z, 0.25);
    this.interact({ pos: { x, z }, r: 2.2, label: () => 'Read sign', act: () => this.game.ui.dialogue('Sign', text) });
  }

  interact(o) {
    o.enabled = o.enabled !== false;
    this.interactables.push(o);
    return o;
  }

  buildPlaces() {
    const G = this.game;
    const sc = this.scene;

    for (const s of SHRINES) {
      const m = M.makeShrine();
      m.position.set(s.x, groundHeight(s.x, s.z), s.z);
      sc.add(m);
      this.col.addCircle(s.x, s.z, 1.2, { h: 0.5 });
      const sh = { ...s, mesh: m };
      this.shrines[s.id] = sh;
      this.interact({ pos: { x: s.x, z: s.z }, r: 2.8, label: () => 'Rest at ' + s.name, act: () => G.rest(sh) });
      this.animated.push((t) => { m.userData.tuft.rotation.y = t * 0.6; m.userData.beam.material.opacity = 0.1 + Math.sin(t * 2 + s.x) * 0.04; });
    }

    for (const c of CHESTS) {
      const m = M.makeChest(c.fancy);
      m.position.set(c.x, groundHeight(c.x, c.z), c.z);
      m.rotation.y = Math.atan2(-c.x * 0.02, 1);
      sc.add(m);
      this.col.addBox(c.x - 0.5, c.z - 0.35, c.x + 0.5, c.z + 0.35, { h: 0.8, cam: false });
      const ch = { ...c, mesh: m, opened: false };
      this.chests[c.id] = ch;
      ch.inter = this.interact({ pos: { x: c.x, z: c.z }, r: 2.0, label: () => (ch.opened ? null : 'Open chest'), act: () => G.openChest(ch) });
    }

    // Starting village.
    const coop = M.makeCoop();
    coop.position.set(-13, groundHeight(-13, 87), 87);
    sc.add(coop);
    this.col.addBox(-14, 86.2, -12, 87.8, { h: 2 });
    const cart = M.makeCart();
    cart.position.set(16, groundHeight(16, 83), 83);
    sc.add(cart);
    this.col.addBox(15, 82.3, 17, 83.7, { h: 2.5 });

    // Village fence.
    for (let i = 0; i < 12; i++) {
      const x = -20 + i * 3.6;
      if (Math.abs(x) < 3) continue;
      const f = M.mesh(M.box(3.4, 0.12, 0.1), M.mat(0x8a5a2a), x, groundHeight(x, 98) + 0.8, 98);
      const p = M.mesh(M.box(0.14, 1.1, 0.14), M.mat(0x6a4020), x - 1.7, groundHeight(x, 98) + 0.55, 98);
      sc.add(f, p);
    }

    this.sign(SIGNS.start, 3, 89, -0.3);
    this.sign(SIGNS.hint1, -44, 74, 1.2);
    this.sign(SIGNS.hint2, 6, 34, 0);
    this.sign(SIGNS.swamp, -45, 25, 0.6);
    this.sign(SIGNS.gate, 7, -39, 0);
    this.sign(SIGNS.backyard, -6, -50, Math.PI);
    this.sign(SIGNS.shed, 35, -54, Math.PI);

    // Gate interactions.
    this.interact({ pos: { x: 0, z: 30.5 }, r: 3.6, label: () => (this.gates.shortcut.open ? null : G.player.pos.z < 30.5 ? 'Unbolt the gate' : 'Try the gate'), act: () => G.tryGate('shortcut') });
    this.interact({ pos: { x: 0, z: -44.5 }, r: 3.6, label: () => (this.gates.yardgate.open ? null : 'Try the gate'), act: () => G.tryGate('yardgate') });
    this.interact({ pos: { x: -30.5, z: -44.5 }, r: 2.6, label: () => (this.gates.doggy.open ? null : G.player.pos.z < -44.5 ? 'Unlatch the doggy door' : 'Inspect doggy door'), act: () => G.tryGate('doggy') });
    this.interact({ pos: { x: 0, z: -66 }, r: 3, label: () => (this.gates.fog.open || G.flags.bossDead ? null : 'Enter the fog'), act: () => G.enterFog() });

    // Backyard props.
    const bbq = M.makeBBQ();
    bbq.position.set(-22, groundHeight(-22, -52), -52);
    sc.add(bbq);
    this.col.addCircle(-22, -52, 0.6);
    for (const [x, z] of [[-8, -60], [14, -62], [-40, -50], [28, -48], [46, -50], [-26, -63]]) {
      const f = M.makeFlamingo();
      f.position.set(x, groundHeight(x, z), z);
      f.rotation.y = this.rand() * 6;
      sc.add(f);
    }
    for (const [x, z] of [[-5, -56], [5, -60], [18, -50], [-36, -64], [30, -64], [-18, -100], [18, -100], [-19, -75], [19, -75]]) {
      const gn = M.makeGnome(1.2);
      gn.position.set(x, groundHeight(x, z), z);
      gn.rotation.y = Math.atan2(-x, -z - 60);
      sc.add(gn);
    }
    // Picnic table.
    const pt = new THREE.Group();
    M.mesh(M.box(2.4, 0.1, 1.0), M.mat(0xaa7744), 0, 0.8, 0, pt);
    for (const s of [-1, 1]) { M.mesh(M.box(2.4, 0.08, 0.35), M.mat(0x996633), 0, 0.45, s * 0.8, pt); M.mesh(M.box(0.1, 0.8, 0.8), M.mat(0x996633), s * 1.0, 0.4, 0, pt); }
    M.mesh(M.box(0.6, 0.02, 0.6), M.mat(0xdd3333), 0.3, 0.86, 0, pt);
    pt.position.set(-30, groundHeight(-30, -53), -53);
    sc.add(pt);
    this.col.addBox(-31.3, -54, -28.7, -52, { h: 1 });

    // Boss lawn: a giant plastic lawn-chair throne.
    const throne = new THREE.Group();
    const white = M.mat(0xf4f4f4);
    M.mesh(M.box(4, 0.3, 3), white, 0, 2, 0, throne);
    M.mesh(M.box(4, 4, 0.3), white, 0, 4, -1.4, throne);
    for (const [x, z] of [[-1.8, 1.3], [1.8, 1.3], [-1.8, -1.3], [1.8, -1.3]]) M.mesh(M.box(0.25, 2, 0.25), white, x, 1, z, throne);
    for (const s of [-1, 1]) M.mesh(M.box(0.3, 0.2, 3), white, s * 1.9, 3, 0, throne);
    throne.position.set(0, 0, -104);
    sc.add(throne);
    this.col.addBox(-2.2, -106, 2.2, -102.5, { h: 4 });
    // Sprinklers around the arena.
    for (const [x, z] of [[-14, -80], [14, -80], [-14, -98], [14, -98]]) {
      sc.add(M.mesh(M.cyl(0.15, 0.2, 0.3, 6), M.mat(0x2255aa), x, groundHeight(x, z) + 0.15, z));
    }
    // Rubber duck pool in the yard.
    const pool = M.mesh(M.cyl(2.2, 2.2, 0.6, 12), M.mat(0x44aaee), 24, groundHeight(24, -53) + 0.3, -53);
    sc.add(pool);
    sc.add(M.mesh(M.sph(0.3, 6, 4), M.mat(0xffdd22), 24.5, groundHeight(24, -53) + 0.75, -53.4));
    this.col.addCircle(24, -53, 2.2, { h: 0.6 });

    // Swamp ruins: some broken pillars for flavour.
    for (const [x, z] of [[-30, 2], [-26, 6], [8, -2], [34, 8], [-12, -32], [12, -32]]) {
      const h = 1.5 + this.rand() * 2.5;
      sc.add(M.mesh(M.cyl(0.5, 0.6, h, 6), M.mat(0x8a8a7a), x, groundHeight(x, z) + h / 2, z));
      this.col.addCircle(x, z, 0.6, { h, cam: true });
    }
  }

  // Per-frame: animated props, slime puddles.
  update(dt, t) {
    for (let i = this.animated.length - 1; i >= 0; i--) {
      if (this.animated[i](t, dt) === true) this.animated.splice(i, 1);
    }
    for (const p of this.puddles) {
      if (p.t > 0) { p.t -= dt; if (p.t <= 0) p.mesh.visible = false; else p.mesh.material.opacity = Math.min(0.7, p.t * 0.4); }
    }
  }

  // Blend sky, fog and light colours by where the player is.
  atmosphere(x, z) {
    const t1 = smooth(34, 24, z), t2 = smooth(-40, -50, z);
    const mix = (a, b, c) => lerpColor(lerpColor(a, b, t1), c, t2);
    const sky = mix(0x9fd4ff, 0x6f8a6a, 0xffbe8a);
    this.scene.background.setHex(sky);
    this.scene.fog.color.setHex(mix(0xbfe3ff, 0x5f7d5a, 0xffd2a8));
    this.hemi.color.setHex(mix(0xffffff, 0xb8d8a8, 0xffe0c0));
    this.hemi.groundColor.setHex(mix(0x557a3a, 0x3a4a2a, 0x7a6a3a));
    this.sun.color.setHex(mix(0xfff1cc, 0xbfd8a0, 0xffb070));
    const vd = this.game.preset.viewDist;
    this.scene.fog.near = 18 - t1 * 10 + t2 * 10;
    this.scene.fog.far = vd * (1 - t1 * 0.35 + t2 * 0.35);
  }
}

function smooth(e0, e1, x) {
  let t = (x - e0) / (e1 - e0);
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return t * t * (3 - 2 * t);
}

function lerpColor(a, b, t) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
}
