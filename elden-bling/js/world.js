// The open world: terrain, walls, gates, props, shrines, chests, NPCs and triggers.
import * as THREE from 'three';
import { Colliders, groundHeight, wDesert, wPeaks, wBeach, wWoods, wVolcano, wFungal, wCandy, smooth, WATER_LEVEL, edgeDistance, ARENAS } from './collision.js';
import * as M from './models.js';
import { SIGNS, SOCKS } from './data.js';

export const ZONES = { grass: 'The Grasslands', swamp: 'The Cursed Swamp', backyard: "The King's Backyard", arena: 'The Lawn of Lord Touchgrass', desert: 'The Crunchy Desert', peaks: 'The Slightly Chilly Peaks', beach: 'The Beach of Regret', woods: 'The Haunted Woods', volcano: 'Mount Slightly Hot', fungal: 'The Fungal Funhouse', candy: 'The Candy Kingdom' };

// Region bosses: [id, x, z] (the arena centre is the boss's home).
export const BOSS_SPOTS = {
  gary: [45, 42], pharaoh: [-122, 10], snowmom: [120, 8], sogbeard: [55, 132],
  sandworm: [-125, 60], shivers: [140, 62], kevin: [-40, 134], bog: [30, -15],
  snackula: [-110, -160], horseless: [-130, -100], mayor: [110, -140], dave: [135, -95],
  funguy: [-210, -40], slugworth: [-230, -95], sugarcrash: [210, -40], gummy: [230, -95],
};

export const SHRINES = [
  { id: 's1', name: 'Shrine of First Steps', x: 6, z: 84 },
  { id: 's2', name: 'Shrine of Damp Socks', x: -38, z: 4 },
  { id: 's3', name: 'Shrine of the Freshly Mowed', x: 10, z: -52 },
  { id: 's4', name: 'Shrine of Sandy Sandwiches', x: -80, z: 52 },
  { id: 's5', name: 'Shrine of the Pyramid Steps', x: -100, z: 34 },
  { id: 's6', name: 'Shrine of Frozen Toes', x: 82, z: 48 },
  { id: 's7', name: 'Shrine of the Brain Freeze', x: 100, z: 30 },
  { id: 's8', name: 'Shrine of Salty Tears', x: -22, z: 112 },
  { id: 's9', name: 'Shrine of the Soggy Plank', x: 34, z: 118 },
  { id: 's10', name: 'Shrine of Spooky Snacks', x: -88, z: -78 },
  { id: 's11', name: 'Shrine of the Creaky Coffin', x: -128, z: -134 },
  { id: 's12', name: 'Shrine of Toasty Toes', x: 88, z: -78 },
  { id: 's13', name: 'Shrine of the Burnt Marshmallow', x: 132, z: -122 },
  { id: 's14', name: 'Shrine of Fungal Friendship', x: -182, z: -12 },
  { id: 's15', name: 'Shrine of the Spore Bore', x: -214, z: 72 },
  { id: 's16', name: 'Shrine of the Sugar High', x: 182, z: -12 },
  { id: 's17', name: 'Shrine of Cavities', x: 214, z: 72 },
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
  // Desert
  ['mummy', -78, 72], ['cactus', -96, 86], ['mummy', -112, 62], ['cactus', -132, 76], ['mummy', -142, 42], ['cactus', -84, 18],
  ['mummy', -98, -6], ['cactus', -142, -22], ['mummy', -78, -34], ['skeleton', -122, 92], ['mummy', -150, 12], ['cactus', -118, -48],
  ['goblin', -70, 92], ['mummy', -142, -36],
  // Peaks
  ['snowman', 80, 72], ['yeti', 100, 86], ['snowman', 122, 62], ['snowman', 142, 82], ['yeti', 136, 40], ['snowman', 88, 18],
  ['yeti', 96, -14], ['snowman', 142, -24], ['knight', 76, -36], ['yeti', 150, 14], ['snowman', 110, -40], ['skeleton', 70, 90],
  ['snowman', 130, -2],
  // Beach
  ['crab', -70, 116], ['pirate', -50, 130], ['crab', -32, 138], ['pirate', -12, 128], ['crab', 18, 134], ['pirate', 48, 106],
  ['crab', 84, 118], ['pirate', 90, 134], ['crab', -86, 136], ['pirate', -88, 108], ['crab', 70, 110],
];

// Extra spawns are scattered procedurally (seeded, so every game is the same).
const SPAWN_REGIONS = [
  // [types, count, minX, maxX, minZ, maxZ, tier]
  [['mummy', 'cactus', 'skeleton'], 8, -150, -70, -55, 95, 2],
  [['snowman', 'yeti', 'knight'], 8, 70, 150, -55, 95, 2],
  [['crab', 'pirate'], 6, -95, 95, 106, 138, 2],
  [['ghost', 'werepoodle', 'pumpkin', 'skeleton'], 22, -152, -68, -184, -68, 3],
  [['imp', 'golem', 'imp', 'skeleton'], 22, 68, 152, -184, -68, 3],
  [['shroom', 'sporeling', 'frog', 'shroom'], 24, -254, -166, -114, 95, 3],
  [['ginger', 'gummyworm', 'marshmallow', 'ginger'], 24, 166, 254, -114, 95, 3],
];
const KEEP_OUT = [[-122, -26, 16], [120, -22, 12], [84, 146, 9], [-80, 138, 4], [96, 64, 5], [-110, -178, 14], [118, -180, 18], [205, -62, 12], [-94, 12, 6]];
function tierFor(x, z) {
  if (x < -159 || x > 159 || (z < -63 && Math.abs(x) > 61)) return 3;
  if (x < -61 || x > 61 || z > 101) return 2;
  return 1;
}
export { tierFor };
(function scatterSpawns() {
  const R = rng(4242);
  for (const [types, count, x0, x1, z0, z1] of SPAWN_REGIONS) {
    let n = 0, tries = 0;
    while (n < count && tries < count * 60) {
      tries++;
      const x = x0 + R() * (x1 - x0), z = z0 + R() * (z1 - z0);
      if (edgeDistance(x, z) > 0 || groundHeight(x, z) < WATER_LEVEL + 0.4) continue;
      if (Object.values(BOSS_SPOTS).some(([bx, bz]) => Math.hypot(x - bx, z - bz) < 24)) continue;
      if (SHRINES.some((s) => Math.hypot(x - s.x, z - s.z) < 14)) continue;
      if (KEEP_OUT.some(([kx, kz, kr]) => Math.hypot(x - kx, z - kz) < kr + 2)) continue;
      if (ENEMY_SPAWNS.some((e) => Math.hypot(x - e[1], z - e[2]) < 7)) continue;
      ENEMY_SPAWNS.push([types[n % types.length], Math.round(x), Math.round(z)]);
      n++;
    }
  }
  // Regular enemies never stand inside a boss arena.
  for (let i = ENEMY_SPAWNS.length - 1; i >= 0; i--) {
    const [, x, z] = ENEMY_SPAWNS[i];
    if (Object.values(BOSS_SPOTS).some(([bx, bz]) => Math.hypot(x - bx, z - bz) < 18)) ENEMY_SPAWNS.splice(i, 1);
  }
})();

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
  // Desert
  { id: 'c_umbrella', x: -132, z: 94, loot: [['weapon', 'umbrella'], ['coins', 60]] },
  { id: 'c_oasis', x: -88, z: 4, loot: [['consumable', 'coconut', 2], ['consumable', 'bomb', 1], ['coins', 90]] },
  { id: 'c_wraps', x: -152, z: -54, fancy: true, loot: [['armor', 'wraps'], ['coins', 120]] },
  { id: 'c_dune', x: -150, z: 60, loot: [['consumable', 'pepper', 1], ['coins', 140]] },
  // Peaks
  { id: 'c_lance', x: 132, z: 94, loot: [['weapon', 'lance'], ['coins', 50]] },
  { id: 'c_parka', x: 84, z: -48, loot: [['armor', 'parka']] },
  { id: 'c_peak', x: 152, z: 62, loot: [['consumable', 'coconut', 2], ['consumable', 'dignity', 1], ['coins', 120]] },
  { id: 'c_hammer', x: 152, z: -56, fancy: true, loot: [['weapon', 'hammer']] },
  // Beach
  { id: 'c_fish', x: -62, z: 133, loot: [['weapon', 'fish'], ['coins', 70]] },
  { id: 'c_cone', x: 96, z: 112, loot: [['armor', 'cone'], ['coins', 60]] },
  { id: 'c_coconuts', x: -96, z: 124, loot: [['consumable', 'coconut', 3]] },
  { id: 'c_wreck', x: 72, z: 136, fancy: true, loot: [['consumable', 'bomb', 3], ['coins', 250]] },
  // Grasslands extras
  { id: 'c_field', x: 54, z: 50, loot: [['consumable', 'bomb', 2], ['coins', 80]] },
  // Haunted Woods
  { id: 'c_crypt', x: -150, z: -182, fancy: true, loot: [['armor', 'witchhat'], ['coins', 300]] },
  { id: 'c_grave', x: -76, z: -120, loot: [['consumable', 'firebomb', 2], ['coins', 200]] },
  { id: 'c_woods', x: -146, z: -76, loot: [['weapon', 'flamingospear'], ['coins', 150]] },
  { id: 'c_cape', x: -86, z: -176, fancy: true, loot: [['armor', 'vampcape']] },
  // Mount Slightly Hot
  { id: 'c_lava', x: 150, z: -150, fancy: true, loot: [['armor', 'dragonhelm'], ['coins', 300]] },
  { id: 'c_ash', x: 74, z: -110, loot: [['consumable', 'coconut', 3], ['consumable', 'candy', 1]] },
  { id: 'c_vent', x: 148, z: -72, loot: [['armor', 'tinfoil'], ['coins', 180]] },
  { id: 'c_forge', x: 80, z: -176, fancy: true, loot: [['weapon', 'dadsbelt'], ['coins', 220]] },
  // Fungal Funhouse
  { id: 'c_spore', x: -250, z: -110, fancy: true, loot: [['armor', 'shroomcap'], ['coins', 250]] },
  { id: 'c_ring', x: -172, z: 92, loot: [['consumable', 'mushroom', 3], ['coins', 160]] },
  { id: 'c_glow', x: -250, z: 30, loot: [['weapon', 'pizzacutter'], ['coins', 140]] },
  { id: 'c_hoodie', x: -176, z: -104, loot: [['armor', 'hoodie']] },
  // Candy Kingdom
  { id: 'c_cake', x: 250, z: -110, fancy: true, loot: [['armor', 'gingerplate'], ['coins', 300]] },
  { id: 'c_sprinkle', x: 172, z: 92, loot: [['consumable', 'candy', 2], ['coins', 200]] },
  { id: 'c_fudge', x: 252, z: 30, loot: [['weapon', 'airguitar'], ['coins', 160]] },
  { id: 'c_toffee', x: 176, z: -104, loot: [['consumable', 'firebomb', 2], ['armor', 'apron']] },
];

// Lava pools burn instead of poisoning.
const LAVA = [[100, -100, 5], [128, -150, 4], [80, -150, 4.5], [145, -120, 3.5], [96, -178, 4], [70, -130, 3.5]];
const POOLS = [[-20, 20, 5], [6, 14, 3.5], [20, 0, 6], [-10, -12, 5], [30, -32, 4], [-34, -30, 4], [46, 12, 5], [-50, -15, 3.5], [-140, 70, 4], [-104, 80, 3]];

const PATH = [[0, 93], [0, 72], [-24, 56], [-50, 38], [-50, 28], [-44, 12], [-38, 4], [-20, -10], [0, -24], [0, -46], [0, -66], [0, -88]];
const PATH2 = [[0, 72], [26, 60], [38, 63]];
const PATH3 = [[0, 29], [0, 10], [-10, -2], [-20, -10]];
// Open-world roads between the regions.
const ROADS = [
  [[0, 72], [-30, 64], [-62, 64], [-80, 56], [-100, 36], [-112, 22]],
  [[30, 60], [62, 54], [82, 50], [100, 32], [112, 18]],
  [[0, 93], [0, 104], [-20, 114], [-40, 120]],
  [[0, 104], [30, 116], [48, 126]],
  [[-62, -7], [-80, -8], [-100, 0]],
  [[62, 3], [84, 4], [104, 6]],
  [[-106, -62], [-100, -90], [-110, -138]],
  [[106, -62], [100, -90], [110, -120]],
  [[-158, 25], [-180, 20], [-200, -20]],
  [[158, 35], [180, 30], [200, -20]],
];
const ALL_PATHS = [PATH, PATH2, PATH3, ...ROADS];
function nearPath(x, z, w) {
  for (const p of ALL_PATHS) if (distToPath(x, z, p) < w) return true;
  return false;
}

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
  if (x < -159) return 'fungal';
  if (x > 159) return 'candy';
  if (z < -63 && x < -61) return 'woods';
  if (z < -63 && x > 61) return 'volcano';
  if (z > 101) return 'beach';
  if (x < -61) return 'desert';
  if (x > 61) return 'peaks';
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
    this.collectCullables();
  }

  // Static scenery is hidden beyond the view distance (fog hides the pop-in).
  collectCullables() {
    const box = new THREE.Box3(), sph = new THREE.Sphere();
    this.cullables = [];
    for (const o of this.scene.children) if (o.isGroup) M.optimize(o);
    for (const o of this.scene.children) {
      if (o.isLight || o === this.sea || o.userData.noCull || !(o.isMesh || o.isGroup || o.isInstancedMesh)) continue;
      if (o.isInstancedMesh) { o.computeBoundingSphere(); sph.copy(o.boundingSphere); }
      else { box.setFromObject(o); box.getBoundingSphere(sph); }
      if (!isFinite(sph.radius)) continue;
      this.cullables.push({ o, x: sph.center.x, z: sph.center.z, r: sph.radius });
    }
  }

  cull(px, pz) {
    const vd = this.game.preset.viewDist * 1.25;
    for (const c of this.cullables) {
      const d = Math.hypot(c.x - px, c.z - pz) - c.r;
      c.o.visible = d < vd;
    }
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

  // Terrain is split into tiles so the camera can cull the ones out of view.
  buildTerrain() {
    const x0 = -290, x1 = 290, z0 = -226, z1 = 190, tile = 64, seg = 2.5;
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    const c = new THREE.Color();
    const r = rng(7);
    this.terrainTiles = [];
    for (let tz = z0; tz < z1; tz += tile) {
      for (let tx = x0; tx < x1; tx += tile) {
        const w = Math.min(tile, x1 - tx), d = Math.min(tile, z1 - tz);
        let g = new THREE.PlaneGeometry(w, d, Math.round(w / seg), Math.round(d / seg));
        g.rotateX(-Math.PI / 2);
        g.translate(tx + w / 2, 0, tz + d / 2);
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) p.setY(i, groundHeight(p.getX(i), p.getZ(i)));
        g = g.toNonIndexed();
        const pos = g.attributes.position;
        const colors = new Float32Array(pos.count * 3);
        for (let i = 0; i < pos.count; i += 3) {
          const x = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
          const y = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
          const z = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
          this.groundColor(x, y, z, c, r());
          for (let k = 0; k < 3; k++) { colors[(i + k) * 3] = c.r; colors[(i + k) * 3 + 1] = c.g; colors[(i + k) * 3 + 2] = c.b; }
        }
        g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        g.computeVertexNormals();
        g.computeBoundingSphere();
        const m = new THREE.Mesh(g, mat);
        m.receiveShadow = true;
        this.scene.add(m);
        this.terrainTiles.push(m);
      }
    }
    // The sea.
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(620, 90).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x2a8ac8, transparent: true, opacity: 0.85 }));
    sea.position.set(0, WATER_LEVEL, 180);
    this.scene.add(sea);
    this.sea = sea;
    this.animated.push((t) => { sea.position.y = WATER_LEVEL + Math.sin(t * 0.8) * 0.06; });
  }

  groundColor(x, y, z, c, n) {
    const v = (n - 0.5) * 0.06;
    const edge = edgeDistance(x, z);
    if (edge > 4 && !(z > 120 && Math.abs(x) < 100)) {
      const snowy = (wPeaks(x) > 0.5 && wCandy(x) < 0.5 && z > -64 && z < 101) || y > 14;
      let rock = wDesert(x) > 0.5 || z > 101 ? 0xc0925a : 0x7d7a6a;
      if (z < -64 && x < -61) rock = 0x4a4458;
      if (z < -64 && x > 61) rock = 0x3a3434;
      if (x < -160) rock = 0x6a5a7a;
      if (x > 160) rock = 0xd8a8c8;
      c.setHex(snowy ? (y > 6 ? 0xf2f6ff : 0xb8c0c8) : rock);
      c.offsetHSL(0, 0, v);
      return;
    }
    const zone = zoneAt(x, z);
    const onPath = nearPath(x, z, 2.0);
    if (zone === 'beach') {
      if (y < WATER_LEVEL + 0.15) c.setHex(0xc8b888);
      else c.setHex(onPath ? 0xd8c090 : n > 0.85 ? 0xf0e0b0 : 0xeedc9e);
      // Blend into neighbouring regions near the border.
      if (z < 108 && (x < -60 || x > 60)) c.lerp(new THREE.Color(x < 0 ? 0xe0b86a : 0xe8eef6), 0.5);
    } else if (zone === 'woods') {
      c.setHex(onPath ? 0x5a4a3a : n > 0.8 ? 0x3a4a38 : n > 0.4 ? 0x34442f : 0x2e3d2c);
    } else if (zone === 'volcano') {
      c.setHex(onPath ? 0x6a5a50 : n > 0.85 ? 0x8a3a1a : n > 0.5 ? 0x3a3232 : 0x2a2626);
    } else if (zone === 'fungal') {
      c.setHex(onPath ? 0x8a7a6a : n > 0.8 ? 0x7a5aa0 : n > 0.4 ? 0x5a8a7a : 0x6a4a8a);
    } else if (zone === 'candy') {
      c.setHex(onPath ? 0xfff0f8 : n > 0.75 ? 0xffd0e8 : n > 0.4 ? 0xc8f0e0 : 0xffe4a8);
    } else if (zone === 'desert') {
      c.setHex(onPath ? 0xc89a5a : n > 0.75 ? 0xe8c47a : 0xe0b86a);
    } else if (zone === 'peaks') {
      c.setHex(onPath ? 0xa8a8a0 : n > 0.8 ? 0xd8e4f0 : 0xe8eef6);
    } else if (zone === 'grass') {
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
    else if (style === 'sand') m = M.mesh(M.box(w, hh, d), M.mat(0xc8a060), x, y0 + hh / 2, z);
    else if (style === 'ice') m = M.mesh(M.box(w, hh, d), M.mat(0xbfe0ff), x, y0 + hh / 2, z);
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
        (this.boulders ||= []).push([x, groundHeight(x, z) + h - 0.2, z, 1.1 + this.rand() * 0.6, this.rand() * 3, this.rand() * 3]);
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
    m.userData.noCull = true;
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
    m.userData.noCull = true;
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
    // Outer boundary (invisible; mountains and the sea sell it).
    const B = (a, b, c, d) => this.col.addBox(a, b, c, d, { cam: false });
    B(-280, -240, -260.5, 200); B(260.5, -240, 280, 200);
    B(-60, -240, 60, -108.5); B(-280, -240, 280, -190.5);
    B(-280, -240, -158.5, -120.5); B(158.5, -240, 280, -120.5);
    B(-280, 146, 280, 200); B(-280, 101.5, -100.5, 200); B(100.5, 101.5, 280, 200);
    // Borders into the far regions: rock walls with passes.
    for (const s of [-1, 1]) {
      const f = (a) => (s < 0 ? a : -a);
      // North edge of desert / peaks (passes into the woods and the volcano).
      const nx0 = s < 0 ? -158.5 : 61, nx1 = s < 0 ? -61 : 158.5;
      const gap = s < 0 ? [-112, -100] : [100, 112];
      this.wall(nx0, -63.5, gap[0], -61.5, s < 0 ? 'rock' : 'rock');
      this.wall(gap[1], -63.5, nx1, -61.5, 'rock');
      // Outer edge (passes into the fungal funhouse and the candy kingdom).
      const ex0 = s < 0 ? -160 : 158, ex1 = ex0 + 2;
      this.wall(ex0, -190.5, ex1, -100, 'rock');
      this.wall(ex0, -88, ex1, 18, 'rock');
      this.wall(ex0, 32, ex1, 101.5, 'rock');
      void f;
    }

    // Region borders: rock ridges with passes into the desert (west) and peaks (east).
    for (const s of [-1, 1]) {
      const x0 = s < 0 ? -61 : 59, x1 = x0 + 2;
      this.wall(x0, -108.5, x1, -43, 'hedge', 3.4);
      const swampGap = s < 0 ? [-10, -4] : [0, 6];
      const grassGap = s < 0 ? [60, 68] : [50, 58];
      this.wall(x0, -43, x1, swampGap[0], 'rock');
      this.wall(x0, swampGap[1], x1, grassGap[0], 'rock');
      this.wall(x0, grassGap[1], x1, 101, 'rock');
    }
    // Southern edge of the grasslands, with a path down to the beach.
    this.wall(-59, 100, -6, 102, 'rock', 2.6);
    this.wall(6, 100, 59, 102, 'rock', 2.6);

    // Grasslands / swamp divider: entry at the west, shortcut gate in the middle.
    this.wall(-59, 29, -54, 32, 'rock');
    this.wall(-46, 29, -3, 32, 'rock');
    this.wall(3, 29, 59, 32, 'rock');
    this.gate('shortcut', -3, 29.6, 3, 31.4, 'wood');

    // Hidden pocket in the grasslands (west).
    this.wall(-58, 68.5, -49, 70, 'rock');
    this.wall(-58, 80, -49, 81.5, 'rock');
    this.illusoryWall('w_pocket', -50.5, 70, -49, 80, 'rock');

    // Swamp / backyard hedge with the boss gate and a doggy door.
    this.wall(-59, -46, -32, -43, 'hedge', 3.4);
    this.wall(-29, -46, -3, -43, 'hedge', 3.4);
    this.wall(3, -46, 59, -43, 'hedge', 3.4);
    this.gate('yardgate', -3, -45.4, 3, -43.6, 'iron');
    this.gate('doggy', -32, -45.2, -29, -43.8, 'doggy');

    // Backyard / boss lawn hedge with the fog wall.
    this.wall(-59, -68, -3, -66, 'hedge', 3.4);
    this.wall(3, -68, 59, -66, 'hedge', 3.4);
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

    // Secret corner pockets in the desert (north-west) and peaks (north-east).
    this.wall(-158.5, -50, -146, -49, 'sand');
    this.illusoryWall('w_tomb', -147, -62.5, -146, -50, 'sand');
    this.wall(146, -50, 158.5, -49, 'ice');
    this.illusoryWall('w_ice', 145, -62.5, 146, -50, 'ice');

    this.buildLandmarks();
    this.buildFarLandmarks();
    // All wall-top boulders in one instanced draw call.
    const bl = this.boulders || [];
    const im = new THREE.InstancedMesh(M.ico(1, 0), M.mat(0x9a9488), bl.length);
    const dm = new THREE.Object3D();
    bl.forEach(([x, y, z, sc, rx, ry], i) => { dm.position.set(x, y, z); dm.rotation.set(rx, ry, 0); dm.scale.setScalar(sc); dm.updateMatrix(); im.setMatrixAt(i, dm.matrix); });
    im.computeBoundingSphere();
    this.scene.add(im);
  }

  buildLandmarks() {
    const sc = this.scene;
    const add = (o, x, z, y = 0) => { o.position.set(x, groundHeight(x, z) + y, z); sc.add(o); return o; };
    // The Pyramid (definitely not a scheme).
    const pyr = M.mesh(M.cone(17, 20, 4), M.mat(0xd8b070), 0, 10, 0);
    pyr.rotation.y = Math.PI / 4;
    const pg = new THREE.Group(); pg.add(pyr);
    M.mesh(M.cone(2.2, 2.6, 4), M.mat(0xffd040, { emissive: 0x553300 }), 0, 19.6, 0, pg).rotation.y = Math.PI / 4;
    add(pg, -122, -26, -0.5);
    this.col.addBox(-134, -38, -110, -14, { h: 12 });
    for (const sx of [-8, 8]) { add(M.mesh(M.box(2, 6, 2), M.mat(0xc8a060), 0, 3, 0), -122 + sx, -10); this.col.addCircle(-122 + sx, -10, 1.3, { h: 6, cam: true }); }
    // Oasis with palm trees.
    const pond = M.mesh(M.cyl(5, 5, 0.1, 14), M.mat(0x3aa8d8), 0, 0, 0);
    add(pond, -94, 12, 0.05);
    for (const [x, z] of [[-99, 9], [-90, 16], [-97, 17], [-89, 8]]) this.palm(x, z, 1.1);
    // Desert ruins.
    for (const [x, z] of [[-70, 30], [-110, 76], [-146, 26], [-90, -40], [-138, 56]]) {
      const h = 2 + this.rand() * 3;
      add(M.mesh(M.cyl(0.7, 0.8, h, 6), M.mat(0xd0b080), 0, h / 2, 0), x, z);
      this.col.addCircle(x, z, 0.8, { h, cam: true });
    }

    // Snowmom's ice palace and a giant snowman statue.
    const dome = new THREE.Mesh(new THREE.SphereGeometry(10, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), M.mat(0xcfe8ff));
    add(dome, 120, -22, -0.3);
    add(M.mesh(M.box(4, 4, 6), M.mat(0x9ec8f0), 0, 2, 0), 120, -12.5);
    this.col.addCircle(120, -22, 10, { h: 9, cam: true });
    const sm = new THREE.Group();
    M.mesh(M.sph(3, 10, 8), M.mat(0xffffff), 0, 3, 0, sm);
    M.mesh(M.sph(2.2, 10, 8), M.mat(0xffffff), 0, 7.2, 0, sm);
    M.mesh(M.sph(1.5, 10, 8), M.mat(0xffffff), 0, 10.4, 0, sm);
    M.mesh(M.cone(0.3, 2, 5), M.mat(0xff8822), 0, 10.4, 1.9, sm).rotation.x = 1.57;
    M.mesh(M.cyl(1.1, 1.1, 1.6, 8), M.mat(0x222222), 0, 12.2, 0, sm);
    for (const sx of [-0.5, 0.5]) M.mesh(M.box(0.3, 0.3, 0.1), M.mat(0x111111), sx, 10.9, 1.4, sm);
    add(sm, 96, 64);
    this.col.addCircle(96, 64, 3, { h: 12, cam: true });

    // Beach: shipwreck and lighthouse.
    const ship = new THREE.Group();
    M.mesh(M.box(14, 4, 6), M.mat(0x6a4024), 0, 1.5, 0, ship);
    M.mesh(M.box(12, 0.3, 5.4), M.mat(0x8a5a34), 0, 3.6, 0, ship);
    M.mesh(M.cyl(0.3, 0.35, 10, 6), M.mat(0x5a3a1a), 1, 8, 0, ship).rotation.z = 0.25;
    M.mesh(M.box(5, 3.5, 0.1), M.mat(0xeeeedd), 2.2, 9, 0, ship).rotation.z = 0.25;
    const ft = M.textPlane('SS SOGGY', 3, 0.8, '#fff', '#6a4024'); ft.position.set(-3, 2, 3.02); ship.add(ft);
    ship.rotation.z = -0.12;
    add(ship, 84, 146, -0.6);
    this.col.addBox(77, 143, 91, 149, { h: 5 });
    const lh = new THREE.Group();
    for (let i = 0; i < 6; i++) M.mesh(M.cyl(1.6 - i * 0.1, 1.7 - i * 0.1, 2.2, 10), M.mat(i % 2 ? 0xffffff : 0xdd3333), 0, 1.1 + i * 2.2, 0, lh);
    M.mesh(M.cyl(1.2, 1.2, 1.4, 8), M.mat(0xffee88, { emissive: 0xaa8822 }), 0, 14, 0, lh);
    M.mesh(M.cone(1.5, 1.4, 8), M.mat(0x333333), 0, 15.4, 0, lh);
    add(lh, -80, 138);
    this.col.addCircle(-80, 138, 1.8, { h: 14, cam: true });
    for (const [x, z] of [[-40, 144], [12, 143], [40, 104], [-60, 104], [-94, 112], [92, 104], [64, 116]]) this.palm(x, z, 1 + this.rand() * 0.4);
    // Beach umbrellas.
    for (const [x, z, col] of [[-6, 136, 0xff5544], [26, 140, 0x44aaff], [-48, 112, 0xffcc22]]) {
      const u = new THREE.Group();
      M.mesh(M.cyl(0.05, 0.05, 2.4, 4), M.mat(0xffffff), 0, 1.2, 0, u);
      M.mesh(M.cone(1.6, 0.6, 8), M.mat(col), 0, 2.4, 0, u);
      add(u, x, z);
    }
  }

  buildFarLandmarks() {
    const sc = this.scene;
    const add = (o, x, z, y = 0) => { o.position.set(x, groundHeight(x, z) + y, z); sc.add(o); return o; };
    // Count Snackula's castle.
    const castle = new THREE.Group();
    const stone = M.mat(0x4a4458), roof = M.mat(0x6a2a4a);
    M.mesh(M.box(22, 10, 8), stone, 0, 5, 0, castle);
    for (const tx of [-11, 11, -4, 4]) {
      const h = tx === -4 || tx === 4 ? 16 : 13;
      M.mesh(M.cyl(2.2, 2.4, h, 8), stone, tx, h / 2, tx === -4 || tx === 4 ? -2 : 0, castle);
      M.mesh(M.cone(2.8, 4, 8), roof, tx, h + 2, tx === -4 || tx === 4 ? -2 : 0, castle);
    }
    for (let i = 0; i < 6; i++) M.mesh(M.box(1.2, 2, 0.3), M.mat(0xffdd66, { emissive: 0x664400 }), -8 + i * 3.2, 6, 4.05, castle);
    add(castle, -110, -182);
    this.col.addBox(-122, -187, -98, -177, { h: 10 });
    // The volcano.
    const vol = new THREE.Group();
    M.mesh(M.cone(26, 34, 9), M.mat(0x3a3030), 0, 17, 0, vol);
    M.mesh(M.cyl(6.5, 7, 1, 9), new THREE.MeshBasicMaterial({ color: 0xff5a10 }), 0, 30.6, 0, vol);
    add(vol, 118, -200, -4);
    this.col.addCircle(118, -200, 22, { h: 30, cam: true });
    // The Fun Guy's giant party mushroom.
    const shroom = new THREE.Group();
    M.mesh(M.cyl(3, 4, 14, 10), M.mat(0xf0e8d8), 0, 7, 0, shroom);
    M.mesh(M.sph(11, 12, 6), M.mat(0xdd3366), 0, 14, 0, shroom).scale.set(1, 0.45, 1);
    for (let i = 0; i < 8; i++) { const a = i * 0.8; M.mesh(M.sph(1.6, 6, 4), M.mat(0xffffff), Math.cos(a) * 7, 17.5, Math.sin(a) * 7, shroom); }
    add(shroom, -210, -68);
    this.col.addCircle(-210, -68, 4.5, { h: 14, cam: true });
    // Baron Von Sugarcrash's cake castle.
    const cake = new THREE.Group();
    const tiers = [[14, 6, 0xffd0e8], [10, 5, 0xfff0f8], [6, 5, 0xc8f0e0]];
    let y = 0;
    for (const [r, h, c] of tiers) { M.mesh(M.cyl(r, r, h, 14), M.mat(c), 0, y + h / 2, 0, cake); M.mesh(M.cyl(r + 0.3, r + 0.3, 0.6, 14), M.mat(0xff88bb), 0, y + h, 0, cake); y += h; }
    M.mesh(M.sph(2, 8, 6), M.mat(0xdd2233), 0, y + 1.6, 0, cake);
    add(cake, 205, -72);
    this.col.addCircle(205, -72, 14.3, { h: 16, cam: true });
    // Gingerbread houses.
    for (const [x, z] of [[180, 60], [240, 10], [190, -95], [245, 80]]) {
      const h = new THREE.Group();
      M.mesh(M.box(5, 3.4, 4), M.mat(0xb8743a), 0, 1.7, 0, h);
      const rf = M.mesh(M.cone(4, 2.4, 4), M.mat(0xfff4fa), 0, 4.6, 0, h); rf.rotation.y = Math.PI / 4;
      M.mesh(M.box(1.2, 2, 0.1), M.mat(0x8a3a1a), 0, 1, 2.02, h);
      add(h, x, z);
      this.col.addBox(x - 2.5, z - 2, x + 2.5, z + 2, { h: 4 });
    }
    // Gravestones and a crypt in the woods.
    for (let i = 0; i < 24; i++) {
      const x = -96 - (i % 6) * 3, z = -112 - Math.floor(i / 6) * 3.5;
      const gs = M.mesh(M.box(1, 1.4, 0.3), M.mat(0x7a7a88), 0, 0.7, 0);
      gs.rotation.z = (this.rand() - 0.5) * 0.3;
      add(gs, x, z);
      this.col.addCircle(x, z, 0.5);
    }
    // Hidden crypt pocket (north-west corner of the woods).
    this.wall(-158.5, -178, -144, -176.5, 'rock');
    this.illusoryWall('w_crypt', -145, -190.5, -143.5, -178, 'rock');
    // Volcano forge pocket (north-west corner of the volcano).
    this.wall(61, -170, 92, -168.5, 'rock');
    this.illusoryWall('w_forge', 90.5, -190.5, 92, -170, 'rock');
  }

  palm(x, z, s = 1) {
    const g = new THREE.Group();
    for (let i = 0; i < 5; i++) M.mesh(M.cyl(0.18, 0.22, 1.1, 5), M.mat(0x9a7444), i * 0.12, 0.55 + i * 1.0, 0, g).rotation.z = -0.08;
    for (let i = 0; i < 6; i++) {
      const leaf = M.mesh(M.box(0.5, 0.06, 2.6), M.mat(0x3a9a3a), 0.6, 5.2, 0, g);
      leaf.rotation.y = (i / 6) * Math.PI * 2;
      leaf.rotation.x = 0.35;
      leaf.translateZ(1.1);
    }
    M.mesh(M.sph(0.25, 5, 4), M.mat(0x6a4a2a), 0.7, 5, 0.2, g);
    g.scale.setScalar(s);
    g.position.set(x, groundHeight(x, z), z);
    g.traverse((o) => { if (o.isMesh) o.castShadow = this.game.useShadows; });
    this.scene.add(g);
    this.col.addCircle(x, z, 0.35);
  }

  buildLava() {
    const lavaM = new THREE.MeshBasicMaterial({ color: 0xff6a1a });
    const crustM = M.mat(0x2a1a14);
    for (const [x, z, r] of LAVA) {
      const y = groundHeight(x, z);
      const m = new THREE.Mesh(new THREE.CircleGeometry(r, 16).rotateX(-Math.PI / 2), lavaM);
      m.position.set(x, y + 0.07, z);
      this.scene.add(m);
      const ring = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.6, 16).rotateX(-Math.PI / 2), crustM);
      ring.position.set(x, y + 0.06, z);
      this.scene.add(ring);
    }
    this.animated.push((t) => { lavaM.color.setHSL(0.05 + Math.sin(t * 2) * 0.01, 1, 0.5 + Math.sin(t * 3) * 0.05); });
  }

  // 'poison' | 'lava' | null for a point on the ground.
  hazardAt(x, z) {
    for (const [lx, lz, r] of LAVA) if ((x - lx) ** 2 + (z - lz) ** 2 < (r - 0.2) ** 2) return 'lava';
    return this.inPoison(x, z) ? 'poison' : null;
  }

  buildPools() {
    this.buildLava();
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
      m.visible = false; m.renderOrder = 1; m.userData.noCull = true;
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
    if (nearPath(x, z, 3 + r)) return false;
    for (const p of this.pools) if (Math.hypot(x - p.x, z - p.z) < p.r + r + 0.5) return false;
    for (const b of this.col.boxes) if (x > b.minX - r - 1 && x < b.maxX + r + 1 && z > b.minZ - r - 1 && z < b.maxZ + r + 1) return false;
    for (const s of SHRINES) if (Math.hypot(x - s.x, z - s.z) < 6) return false;
    for (const c of CHESTS) if (Math.hypot(x - c.x, z - c.z) < 4) return false;
    for (const e of ENEMY_SPAWNS) if (Math.hypot(x - e[1], z - e[2]) < 3) return false;
    if (edgeDistance(x, z) > 0 || groundHeight(x, z) < WATER_LEVEL + 0.3) return false;
    for (const a of ARENAS) if (Math.hypot(x - a[0], z - a[1]) < a[3] - 2) return false;
    for (const c of this.col.circles) if (c.r > 0.9 && Math.hypot(x - c.x, z - c.z) < c.r + r + 1) return false;
    for (const [sx, sz] of SOCKS) if (Math.hypot(x - sx, z - sz) < 2) return false;
    if (Math.hypot(x - 0, z - 82) < 10 || Math.hypot(x - 14, z - 81) < 4) return false; // starting village
    return true;
  }

  buildDecorations() {
    const R = this.rand;
    const lists = {}; // key -> [{x,y,z,s,ry}]
    const add = (key, x, z, s = 1, collide = 0) => {
      (lists[key] ||= []).push({ x, y: groundHeight(x, z), z, s, ry: R() * 6.28 });
      if (collide && edgeDistance(x, z) === 0) this.col.addCircle(x, z, collide * s, { cam: false });
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
    // Desert: cacti, sandstone, dry shrubs, bones.
    scatter(Math.round(70 * d), -157, -63, -61, 100, (x, z) => { if (!this.clearSpot(x, z, 1)) return false; add('cactus_deco', x, z, 0.8 + R() * 0.7, 0.4); return true; });
    scatter(Math.round(40 * d), -157, -63, -61, 100, (x, z) => { if (!this.clearSpot(x, z, 1.2)) return false; add('rock_desert', x, z, 0.7 + R() * 1.2, 0.8); return true; });
    scatter(Math.round(120 * d), -157, -63, -61, 100, (x, z) => { add('tuft_dry', x, z, 0.8 + R() * 0.6); return true; });
    scatter(Math.round(20 * d), -157, -63, -61, 100, (x, z) => { add('bones', x, z, 0.8 + R() * 0.5); return true; });
    // Peaks: snowy pines, ice rocks.
    scatter(Math.round(90 * d), 63, 157, -61, 100, (x, z) => { if (!this.clearSpot(x, z, 1.2)) return false; add('tree_snow', x, z, 0.8 + R() * 0.7, 0.45); return true; });
    scatter(Math.round(40 * d), 63, 157, -61, 100, (x, z) => { if (!this.clearSpot(x, z, 1.2)) return false; add('rock_ice', x, z, 0.7 + R() * 1.0, 0.8); return true; });
    scatter(Math.round(80 * d), 63, 157, -61, 100, (x, z) => { add('tuft_snow', x, z, 0.8 + R() * 0.6); return true; });
    // Beach: shells, grass, driftwood, rocks.
    scatter(Math.round(80 * d), -99, 99, 103, 140, (x, z) => { add('shell', x, z, 0.7 + R() * 0.8); return true; });
    scatter(Math.round(90 * d), -99, 99, 103, 128, (x, z) => { add('tuft_beach', x, z, 0.8 + R() * 0.6); return true; });
    scatter(Math.round(25 * d), -99, 99, 104, 144, (x, z) => { if (!this.clearSpot(x, z, 1)) return false; add('rock_grass', x, z, 0.6 + R() * 1.0, 0.8); return true; });
    scatter(Math.round(15 * d), -99, 99, 110, 142, (x, z) => { if (!this.clearSpot(x, z, 1)) return false; add('driftwood', x, z, 0.8 + R() * 0.6); return true; });
    // Haunted woods: spooky trees, pumpkins.
    scatter(Math.round(150 * d), -157, -63, -189, -64, (x, z) => { if (!this.clearSpot(x, z, 1.2)) return false; add('tree_spooky', x, z, 0.9 + R() * 0.8, 0.45); return true; });
    scatter(Math.round(40 * d), -157, -63, -189, -64, (x, z) => { if (!this.clearSpot(x, z, 0.6)) return false; add('pumpkin_deco', x, z, 0.7 + R() * 0.6); return true; });
    scatter(Math.round(120 * d), -157, -63, -189, -64, (x, z) => { add('mushroom', x, z, 0.6 + R() * 0.6); return true; });
    // Volcano: black rocks, dead stumps.
    scatter(Math.round(90 * d), 63, 157, -189, -64, (x, z) => { if (!this.clearSpot(x, z, 1.2)) return false; add('rock_volcanic', x, z, 0.8 + R() * 1.4, 0.8); return true; });
    scatter(Math.round(40 * d), 63, 157, -189, -64, (x, z) => { if (!this.clearSpot(x, z, 1)) return false; add('deadtree', x, z, 0.8 + R() * 0.6, 0.35); return true; });
    // Fungal funhouse: giant and small glowing mushrooms.
    scatter(Math.round(70 * d), -259, -161, -119, 100, (x, z) => { if (!this.clearSpot(x, z, 2)) return false; add('giantshroom', x, z, 0.8 + R() * 1.0, 0.6); return true; });
    scatter(Math.round(180 * d), -259, -161, -119, 100, (x, z) => { add('mushroom', x, z, 0.8 + R() * 1.2); return true; });
    // Candy kingdom: candy canes, lollipops, gumdrops.
    scatter(Math.round(60 * d), 161, 259, -119, 100, (x, z) => { if (!this.clearSpot(x, z, 1)) return false; add('candycane', x, z, 0.8 + R() * 0.8, 0.3); return true; });
    scatter(Math.round(60 * d), 161, 259, -119, 100, (x, z) => { if (!this.clearSpot(x, z, 1)) return false; add('lollipop', x, z, 0.8 + R() * 0.8, 0.3); return true; });
    scatter(Math.round(120 * d), 161, 259, -119, 100, (x, z) => { add('gumdrop', x, z, 0.7 + R() * 0.8); return true; });

    // Tree lines and rocks on the mountains just beyond the playable border.
    let placed = 0, tries = 0;
    const want = Math.round(520 * Math.max(0.5, d));
    while (placed < want && tries < want * 30) {
      tries++;
      const x = -285 + R() * 570, z = -220 + R() * 385;
      const e = edgeDistance(x, z);
      if (e < 2 || e > 26 || (z > 120 && Math.abs(x) < 100)) continue;
      let key = x > 60 ? 'tree_snow' : x < -60 ? (R() < 0.6 ? 'rock_desert' : 'cactus_deco') : z > -45 && z < 30 ? 'deadtree' : 'tree_grass';
      if (z < -62 && x < -60) key = 'tree_spooky';
      if (z < -62 && x > 60) key = 'rock_volcanic';
      if (x < -159) key = 'giantshroom';
      if (x > 159) key = R() < 0.5 ? 'lollipop' : 'candycane';
      add(key, x, z, 1.3 + R() * 1.1);
      placed++;
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
      cactus_deco: [[M.cyl(0.28, 0.32, 2.6, 6), M.mat(0x4f9a4a), 1.3], [M.cyl(0.16, 0.16, 1.0, 5), M.mat(0x4f9a4a), 1.7]],
      rock_desert: [[M.ico(0.9, 0), M.mat(0xc8946a), 0.4]],
      tuft_dry: [[M.cone(0.14, 0.4, 3), M.mat(0xa89050), 0.2]],
      bones: [[M.box(0.7, 0.08, 0.08), M.mat(0xeeeadd), 0.05], [M.sph(0.14, 5, 4), M.mat(0xeeeadd), 0.12]],
      tree_snow: [[M.cyl(0.18, 0.26, 1.6, 5), M.mat(0x6a4a2a), 0.8], [M.cone(1.3, 2.6, 6), M.mat(0x3a6a4a), 2.6], [M.cone(1.0, 2.0, 6), M.mat(0xf4f8ff), 3.6]],
      rock_ice: [[M.ico(0.9, 0), M.mat(0xa8c8e8), 0.4]],
      tuft_snow: [[M.ico(0.25, 0), M.mat(0xffffff), 0.05]],
      shell: [[M.cone(0.12, 0.08, 5), M.mat(0xffc8b0), 0.04]],
      tuft_beach: [[M.cone(0.1, 0.6, 3), M.mat(0x9aa850), 0.3]],
      driftwood: [[M.box(2.2, 0.25, 0.3), M.mat(0x9a8a70), 0.12]],
      tree_spooky: [[M.cyl(0.2, 0.32, 2.4, 5), M.mat(0x2a2028), 1.2], [M.cone(1.3, 2.6, 5), M.mat(0x3a2a4a), 3.0], [M.cone(0.9, 2.0, 5), M.mat(0x4a3a5a), 4.2]],
      pumpkin_deco: [[M.sph(0.45, 7, 5), M.mat(0xff8a22), 0.35], [M.cyl(0.05, 0.05, 0.2, 4), M.mat(0x3a6a2a), 0.8]],
      rock_volcanic: [[M.ico(0.9, 0), M.mat(0x2a2424), 0.4]],
      giantshroom: [[M.cyl(0.35, 0.45, 3, 6), M.mat(0xf0e8d8), 1.5], [M.cone(2.2, 1.4, 8), M.mat(0x8a4ad8), 3.4]],
      candycane: [[M.cyl(0.14, 0.14, 2.6, 6), M.mat(0xffffff), 1.3], [M.cyl(0.15, 0.15, 0.3, 6), M.mat(0xee2233), 0.6], [M.cyl(0.15, 0.15, 0.3, 6), M.mat(0xee2233), 1.4], [M.cyl(0.15, 0.15, 0.3, 6), M.mat(0xee2233), 2.2]],
      lollipop: [[M.cyl(0.06, 0.06, 2.4, 4), M.mat(0xffffff), 1.2], [M.cyl(0.9, 0.9, 0.2, 10), M.mat(0xff55aa), 2.6]],
      gumdrop: [[M.cone(0.35, 0.5, 6), M.mat(0x55dd88), 0.25]],
    };
    // Each prop type's parts are merged into one vertex-coloured geometry: one draw call per type per cell.
    const merged = {};
    const decoMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    const mergeParts = (key) => {
      const pos = [], nor = [], colr = [];
      const c = new THREE.Color();
      for (const [g0, m, yOff] of parts[key]) {
        const g = g0.index ? g0.toNonIndexed() : g0.clone();
        if (key === 'deadtree' && yOff > 2) g.rotateZ(0.8).translate(0.4, 0, 0);
        if (key === 'cactus_deco' && yOff > 1.5) g.rotateZ(1.2).translate(0.5, 0, 0);
        if (key === 'bones' && yOff > 0.1) g.translate(0.35, 0, 0);
        if (key === 'lollipop' && yOff > 2) g.rotateX(Math.PI / 2);
        g.translate(0, yOff, 0);
        g.computeVertexNormals();
        c.copy((key === 'flower' && yOff > 0.3) || key === 'gumdrop' || (key === 'lollipop' && yOff > 2) ? new THREE.Color(0xffffff) : m.color);
        const pa = g.attributes.position, na = g.attributes.normal;
        for (let i = 0; i < pa.count; i++) {
          pos.push(pa.getX(i), pa.getY(i), pa.getZ(i));
          nor.push(na.getX(i), na.getY(i), na.getZ(i));
          colr.push(c.r, c.g, c.b);
        }
      }
      const out = new THREE.BufferGeometry();
      out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      out.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
      return out;
    };
    const dummy = new THREE.Object3D();
    const flowerColors = [0xffdd44, 0xff66aa, 0xffffff, 0xaa66ff, 0xff7744];
    const col = new THREE.Color();
    for (const key in lists) {
      const items = lists[key];
      const geo = merged[key] ||= mergeParts(key);
      const chunks = {};
      for (const it of items) (chunks[Math.floor(it.x / 64) + ',' + Math.floor(it.z / 64)] ||= []).push(it);
      for (const ck in chunks) {
        const arr = chunks[ck];
        const im = new THREE.InstancedMesh(geo, decoMat, arr.length);
        arr.forEach((it, i) => {
          dummy.position.set(it.x, it.y, it.z);
          dummy.rotation.set(0, it.ry, 0);
          if (key.startsWith('rock') || key === 'bush') dummy.scale.set(it.s, it.s * 0.7, it.s);
          else dummy.scale.setScalar(it.s);
          dummy.updateMatrix();
          im.setMatrixAt(i, dummy.matrix);
          if (key === 'flower') im.setColorAt(i, col.setHex(flowerColors[i % flowerColors.length]));
          if (key === 'gumdrop' || key === 'lollipop') im.setColorAt(i, col.setHex([0xff7799, 0x77ddff, 0xffee66, 0xaa88ff, 0x88ff99][i % 5]));
        });
        im.castShadow = this.game.useShadows && (key.startsWith('tree') || key === 'deadtree' || key.startsWith('rock') || key === 'cactus_deco');
        im.receiveShadow = false;
        im.computeBoundingSphere();
        this.scene.add(im);
      }
    }
  }

  // ---------- Places: shrines, chests, NPCs, signs, props ----------

  sign(text, x, z, ry = 0, title = 'Sign') {
    const s = M.makeSign(title);
    s.position.set(x, groundHeight(x, z), z);
    s.rotation.y = ry;
    this.scene.add(s);
    this.col.addCircle(x, z, 0.25);
    this.interact({ pos: { x, z }, r: 2.2, label: () => 'Read sign', act: () => this.game.ui.dialogue(title, text) });
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

    this.sign(SIGNS.start, 3, 89, -0.3, 'Welcome!');
    this.sign(SIGNS.hint1, -44, 74, 1.2, 'Hint');
    this.sign(SIGNS.hint2, 6, 34, 0, 'Hint');
    this.sign(SIGNS.swamp, -45, 25, 0.6, 'Cursed Swamp');
    this.sign(SIGNS.gate, 7, -39, 0, 'Warning');
    this.sign(SIGNS.backyard, -6, -50, Math.PI, 'No Trespassing');
    this.sign(SIGNS.crossroads, 5, 70, 0, 'Crossroads');
    this.sign(SIGNS.desert, -66, 70, -1.2, 'Desert');
    this.sign(SIGNS.peaks, 66, 60, 1.2, 'Peaks');
    this.sign(SIGNS.beach, 5, 106, 0, 'Beach');
    this.sign(SIGNS.ice, 138, -42, 0.4, 'Hint');
    this.sign(SIGNS.shed, 35, -54, Math.PI, 'Shed');

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
  // Blend sky, fog and light colours by region and time of day.
  atmosphere(x, z, night = 0) {
    const t1 = smooth(34, 24, z), t2 = smooth(-40, -50, z);
    const mix3 = (a, b, c) => lerpColor(lerpColor(a, b, t1), c, t2);
    const wd = smooth(-56, -68, x), wp = smooth(56, 68, x), wb = smooth(98, 110, z);
    // [sky, fog, hemi sky, hemi ground, sun]
    const centre = [mix3(0x9fd4ff, 0x6f8a6a, 0xffbe8a), mix3(0xbfe3ff, 0x5f7d5a, 0xffd2a8), mix3(0xffffff, 0xb8d8a8, 0xffe0c0), mix3(0x557a3a, 0x3a4a2a, 0x7a6a3a), mix3(0xfff1cc, 0xbfd8a0, 0xffb070)];
    const desert = [0xf2d49a, 0xf6deb0, 0xfff0d8, 0x8a6a3a, 0xffe0a0];
    const peaks = [0xc8dcf0, 0xe4eef8, 0xf0f6ff, 0x8a96a8, 0xf0f4ff];
    const beach = [0x8fd8ff, 0xc8f0ff, 0xffffff, 0x9a8a5a, 0xfff6d8];
    const night_ = [0x1a2244, 0x1e2a48, 0x6070a8, 0x202838, 0x8898d0];
    const far = [
      [wWoods(x, z), [0x5a5078, 0x4a4466, 0xa8a0c8, 0x2a2a3a, 0xc8b8e8]],
      [wVolcano(x, z), [0xa8584a, 0x8a4a3a, 0xffb090, 0x3a1a14, 0xffa070]],
      [wFungal(x), [0x9a7ac8, 0xb898d8, 0xe0d0ff, 0x4a6a5a, 0xe8d0ff]],
      [wCandy(x), [0xffc8e8, 0xffe0f0, 0xffffff, 0xc89ab0, 0xfff0f8]],
    ];
    const out = [];
    for (let k = 0; k < 5; k++) {
      let c = centre[k];
      c = lerpColor(c, desert[k], wd);
      c = lerpColor(c, peaks[k], wp);
      c = lerpColor(c, beach[k], wb * (1 - Math.max(wd, wp) * 0.5));
      for (const [w, pal] of far) if (w > 0) c = lerpColor(c, pal[k], w);
      out.push(lerpColor(c, night_[k], night * 0.75));
    }
    this.scene.background.setHex(out[0]);
    this.scene.fog.color.setHex(out[1]);
    this.hemi.color.setHex(out[2]);
    this.hemi.groundColor.setHex(out[3]);
    this.sun.color.setHex(out[4]);
    this.hemi.intensity = 1.6 * (1 - night * 0.35);
    this.sun.intensity = 1.9 * (1 - night * 0.6);
    const vd = this.game.preset.viewDist;
    const swamp = Math.max(t1 * (1 - t2) * (1 - Math.max(wd, wp, wb)), wWoods(x, z) * 0.8, wFungal(x) * 0.4);
    this.scene.fog.near = 18 - swamp * 10 + t2 * 10;
    this.scene.fog.far = vd * (1 - swamp * 0.35 + t2 * 0.35 + Math.max(wd, wb) * 0.15) * (1 - night * 0.2);
  }
}

function lerpColor(a, b, t) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
}
