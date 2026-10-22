// Brickell-inspired city generation: roads, blocks, towers, landmarks, palms, lights, marina, bay.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  MAP_MAX_Z, MAP_MIN_X, MAP_MIN_Z, PIER_Z, POI_BY_ID, ROADS_X, ROADS_Z, ROAD_W, SEAWALL_X, SIDEWALK, STREET_NAMES_X, STREET_NAMES_Z,
  blocks, type Block,
} from '../data/world';
import { CollisionWorld } from './collision';
import {
  concreteTexture, facadeTextures, grassTexture, intersectionTexture, roadTexture, signTexture, streetSignTexture, woodTexture, type FacadeStyle,
} from './textures';
import { createWater } from './water';
import { buildCar, buildTrafficCar, glowTexture } from './carModel';

export interface MapRect {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  color: string;
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const STYLE_COLORS: Record<FacadeStyle, string> = { glass: '#6f8fae', teal: '#5aa7a5', condo: '#c9c6bd', dark: '#3c434d', gold: '#c9a96a' };

export class World {
  group = new THREE.Group();
  col = new CollisionWorld();
  mapRects: MapRect[] = [];
  parks: MapRect[] = [];
  private buckets: Record<FacadeStyle, THREE.BufferGeometry[]> = { glass: [], teal: [], condo: [], dark: [], gold: [] };
  buildingMats: THREE.MeshStandardMaterial[] = [];
  crownGeos: THREE.BufferGeometry[] = [];
  crownMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  lampMat = new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#ffd9a0', emissiveIntensity: 0.2 });
  neonMats: THREE.MeshBasicMaterial[] = [];
  signMats: THREE.MeshStandardMaterial[] = [];
  water!: ReturnType<typeof createWater>;
  turntables: THREE.Object3D[] = [];
  blockList: Block[] = blocks();
  private r = rng(1337);
  private signCache = new Map<string, THREE.Texture>();
  palms: { x: number; z: number; s: number }[] = [];
  lamps: { x: number; z: number; ry: number }[] = [];
  sidewalkLoops: { cx: number; cz: number; hw: number; hd: number }[] = [];
  groundRects: { minX: number; maxX: number; minZ: number; maxZ: number; y: number }[] = [];
  beacons: Record<string, THREE.Mesh> = {};

  build(onProgress: (p: number, label: string) => void) {
    const steps: [string, () => void][] = [
      ['Paving Brickell Avenue', () => this.buildGround()],
      ['Pouring sidewalks', () => this.buildBlocks()],
      ['Raising glass towers', () => this.buildBuildings()],
      ['Planting palm trees', () => this.buildPalmsAndLamps()],
      ['Filling Biscayne Bay', () => this.buildWaterfront()],
      ['Hanging neon signs', () => this.buildLandmarks()],
      ['Polishing the skyline', () => this.finalize()],
    ];
    return steps.map(([label, fn], i) => () => {
      onProgress((i + 1) / steps.length, label);
      fn();
    });
  }

  groundAt(x: number, z: number) {
    for (const g of this.groundRects) if (x >= g.minX && x <= g.maxX && z >= g.minZ && z <= g.maxZ) return g.y;
    return 0;
  }

  // ------------------------------------------------------------------------------------------
  private buildGround() {
    const grass = grassTexture();
    grass.repeat.set(200, 200);
    // land stops at the seawall; Biscayne Bay is east of it
    const landW = SEAWALL_X + 3500;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(landW, 4000), new THREE.MeshStandardMaterial({ map: grass, roughness: 1, color: '#9fb08a' }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(SEAWALL_X - landW / 2, -0.05, 0);
    ground.receiveShadow = true;
    this.group.add(ground);
    // city base (land under the grid)
    const base = new THREE.Mesh(new THREE.PlaneGeometry(SEAWALL_X - MAP_MIN_X + 40, MAP_MAX_Z - MAP_MIN_Z + 60), new THREE.MeshStandardMaterial({ color: '#55575a', roughness: 0.95 }));
    base.rotation.x = -Math.PI / 2;
    base.position.set((SEAWALL_X + MAP_MIN_X - 40) / 2, -0.03, 0);
    base.receiveShadow = true;
    this.group.add(base);

    // roads
    const rt = roadTexture();
    const roadMatNS = new THREE.MeshStandardMaterial({ map: rt, roughness: 0.9 });
    const rt2 = rt.clone();
    rt2.needsUpdate = true;
    const roadMatEW = new THREE.MeshStandardMaterial({ map: rt2, roughness: 0.9 });
    const zLen = ROADS_Z[ROADS_Z.length - 1] - ROADS_Z[0] + ROAD_W;
    const xLen = ROADS_X[ROADS_X.length - 1] - ROADS_X[0] + ROAD_W;
    rt.repeat.set(1, zLen / 16);
    rt2.repeat.set(1, xLen / 16);
    const ns: THREE.BufferGeometry[] = [];
    for (const x of ROADS_X) {
      const g = new THREE.PlaneGeometry(ROAD_W, zLen);
      g.rotateX(-Math.PI / 2);
      g.translate(x, 0, (ROADS_Z[0] + ROADS_Z[ROADS_Z.length - 1]) / 2);
      ns.push(g);
    }
    const nsMesh = new THREE.Mesh(mergeGeometries(ns), roadMatNS);
    nsMesh.receiveShadow = true;
    this.group.add(nsMesh);
    const ew: THREE.BufferGeometry[] = [];
    for (const z of ROADS_Z) {
      const g = new THREE.PlaneGeometry(ROAD_W, xLen);
      g.rotateX(-Math.PI / 2);
      g.rotateY(Math.PI / 2);
      g.translate((ROADS_X[0] + ROADS_X[ROADS_X.length - 1]) / 2, 0.005, z);
      ew.push(g);
    }
    const ewMesh = new THREE.Mesh(mergeGeometries(ew), roadMatEW);
    ewMesh.receiveShadow = true;
    this.group.add(ewMesh);
    // intersections
    const it = intersectionTexture();
    const ints: THREE.BufferGeometry[] = [];
    for (const x of ROADS_X)
      for (const z of ROADS_Z) {
        const g = new THREE.PlaneGeometry(ROAD_W, ROAD_W);
        g.rotateX(-Math.PI / 2);
        g.translate(x, 0.01, z);
        ints.push(g);
      }
    const intMesh = new THREE.Mesh(mergeGeometries(ints), new THREE.MeshStandardMaterial({ map: it, roughness: 0.9 }));
    intMesh.receiveShadow = true;
    this.group.add(intMesh);

    // boundaries (invisible walls) + seawall
    const t = 20;
    this.col.addRect(MAP_MIN_X - t / 2 - 2, 0, t, 2000, 0, 50, 'edge');
    this.col.addRect(0, MAP_MIN_Z - t / 2 - 2, 2000, t, 0, 50, 'edge');
    this.col.addRect(0, MAP_MAX_Z + t / 2 + 2, 2000, t, 0, 50, 'edge');
    this.col.addRect(SEAWALL_X + 2, 0, 4, 2000, -5, 50, 'seawall');
  }

  private buildBlocks() {
    const conc = concreteTexture();
    const slabGeos: THREE.BufferGeometry[] = [];
    for (const b of this.blockList) {
      const w = b.w + SIDEWALK * 2, d = b.d + SIDEWALK * 2;
      const g = new THREE.BoxGeometry(w, 0.14, d);
      // world-scaled UVs
      const uv = g.getAttribute('uv') as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (w / 8), uv.getY(i) * (d / 8));
      g.translate(b.cx, 0.07, b.cz);
      slabGeos.push(g);
      this.groundRects.push({ minX: b.cx - w / 2, maxX: b.cx + w / 2, minZ: b.cz - d / 2, maxZ: b.cz + d / 2, y: 0.14 });
      this.sidewalkLoops.push({ cx: b.cx, cz: b.cz, hw: b.w / 2 + SIDEWALK / 2, hd: b.d / 2 + SIDEWALK / 2 });
    }
    // waterfront promenade (between Bayshore Dr and the seawall)
    {
      const x0 = ROADS_X[ROADS_X.length - 1] + ROAD_W / 2, x1 = SEAWALL_X;
      const w = x1 - x0, d = MAP_MAX_Z - MAP_MIN_Z;
      const g = new THREE.BoxGeometry(w, 0.14, d);
      const uv = g.getAttribute('uv') as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (w / 8), uv.getY(i) * (d / 8));
      g.translate((x0 + x1) / 2, 0.07, 0);
      slabGeos.push(g);
      this.groundRects.push({ minX: x0, maxX: x1, minZ: MAP_MIN_Z, maxZ: MAP_MAX_Z, y: 0.14 });
    }
    conc.repeat.set(1, 1);
    const slab = new THREE.Mesh(mergeGeometries(slabGeos), new THREE.MeshStandardMaterial({ map: conc, roughness: 0.92, color: '#d8d3c8' }));
    slab.receiveShadow = true;
    this.group.add(slab);
  }

  private addBuilding(x: number, z: number, w: number, d: number, h: number, style: FacadeStyle, opts: { crown?: string; collide?: boolean; y0?: number } = {}) {
    const y0 = opts.y0 ?? 0.14;
    const g = new THREE.BoxGeometry(w, h, d);
    const uv = g.getAttribute('uv') as THREE.BufferAttribute;
    // faces: +x, -x, +y, -y, +z, -z (4 verts each)
    for (let f = 0; f < 6; f++) {
      for (let k = 0; k < 4; k++) {
        const i = f * 4 + k;
        const u = uv.getX(i), v = uv.getY(i);
        if (f === 2 || f === 3) uv.setXY(i, 0.005 + u * 0.01, 0.005 + v * 0.01);
        else {
          const fw = f < 2 ? d : w;
          uv.setXY(i, u * (fw / 32), v * (h / 32) + (x * 0.013 + z * 0.007) % 1);
        }
      }
    }
    g.translate(x, y0 + h / 2, z);
    this.buckets[style].push(g);
    if (opts.collide !== false) this.col.addRect(x, z, w, d, 0, y0 + h);
    this.mapRects.push({ x, z, w, d, h, color: STYLE_COLORS[style] });
    if (opts.crown) {
      const c = new THREE.Color(opts.crown);
      const band = new THREE.BoxGeometry(w + 0.3, 1.2, d + 0.3);
      band.translate(x, y0 + h - 1.5, z);
      const n = band.getAttribute('position').count;
      const arr = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        arr[i * 3] = c.r;
        arr[i * 3 + 1] = c.g;
        arr[i * 3 + 2] = c.b;
      }
      band.setAttribute('color', new THREE.BufferAttribute(arr, 3));
      band.deleteAttribute('uv');
      this.crownGeos.push(band);
      // rooftop parapet (skipped on Aurum Tower: the penthouse sits there)
      if (h > 190) return;
      const top = new THREE.BoxGeometry(w * 0.6, 4, d * 0.6);
      top.translate(x, y0 + h + 2, z);
      const uv2 = top.getAttribute('uv') as THREE.BufferAttribute;
      for (let i = 0; i < uv2.count; i++) uv2.setXY(i, 0.005, 0.005);
      this.buckets[style].push(top);
    }
  }

  private sign(text: string, x: number, y: number, z: number, face: number, height: number, opts: { color?: string; bg?: string; glow?: boolean; sub?: string; neon?: boolean } = {}) {
    const key = JSON.stringify([text, opts]);
    let t = this.signCache.get(key);
    let aspect = 4;
    const made = signTexture(text, opts);
    aspect = made.aspect;
    if (!t) {
      t = made.tex;
      this.signCache.set(key, t);
    } else made.tex.dispose();
    let mat: THREE.Material;
    if (opts.neon) {
      const m = new THREE.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false, depthWrite: false });
      this.neonMats.push(m);
      mat = m;
    } else {
      const m = new THREE.MeshStandardMaterial({ map: t, transparent: !opts.bg, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 0.3, roughness: 0.5, depthWrite: !!opts.bg });
      this.signMats.push(m);
      mat = m;
    }
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(height * aspect, height), mat);
    mesh.position.set(x, y, z);
    mesh.rotation.y = face;
    this.group.add(mesh);
    return mesh;
  }

  /** Building with its entrance on the face side; returns facade anchor. */
  private poiBuilding(poiId: string, w: number, d: number, h: number, style: FacadeStyle, sign: { text: string; color?: string; bg?: string; neon?: boolean; sub?: string }, crown?: string) {
    const p = POI_BY_ID[poiId];
    const fx = Math.sin(p.face), fz = Math.cos(p.face);
    // building centre: set back from the trigger point (which is on the sidewalk)
    const setback = 2 + (Math.abs(fx) > 0.5 ? w : d) / 2;
    const cx = p.x - fx * setback, cz = p.z - fz * setback;
    this.addBuilding(cx, cz, w, d, h, style, { crown });
    const facadeDist = Math.abs(fx) > 0.5 ? w / 2 : d / 2;
    const sx = cx + fx * (facadeDist + 0.12), sz = cz + fz * (facadeDist + 0.12);
    this.sign(sign.text, sx, Math.min(h - 1.2, 6.5), sz, p.face, 1.6, { color: sign.color, bg: sign.bg, glow: true, neon: sign.neon, sub: sign.sub });
    // awning + entrance glow
    const aw = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(fx) > 0.5 ? 2.2 : 7, 0.2, Math.abs(fx) > 0.5 ? 7 : 2.2), new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.5, metalness: 0.4 }));
    aw.position.set(cx + fx * (facadeDist + 1.1), 3.6, cz + fz * (facadeDist + 1.1));
    aw.castShadow = true;
    this.group.add(aw);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(3, 3.2), new THREE.MeshStandardMaterial({ color: '#1c242e', emissive: '#c99a5a', emissiveIntensity: 0.6, metalness: 0.6, roughness: 0.15 }));
    door.position.set(cx + fx * (facadeDist + 0.06), 1.75, cz + fz * (facadeDist + 0.06));
    door.rotation.y = p.face;
    this.group.add(door);
    this.signMats.push(door.material as THREE.MeshStandardMaterial);
    return { cx, cz };
  }

  private buildBuildings() {
    const r = this.r;
    const poiBlocks = new Set<string>();
    const key = (x: number, z: number) => `${Math.round(x)},${Math.round(z)}`;
    const findBlock = (x: number, z: number) => this.blockList.find((b) => Math.abs(b.cx - x) < 2 && Math.abs(b.cz - z) < 2)!;
    // --- POI buildings
    const mark = (x: number, z: number) => poiBlocks.add(key(x, z));
    mark(-250, 250); this.poiBuilding('home_modest', 34, 26, 48, 'condo', { text: 'THE MODEST TOWER', color: '#fff', bg: '#2a2f38' }, '#9ad8ff');
    this.addBuilding(-250, 278, 60, 14, 22, 'condo');
    mark(-50, 50); this.poiBuilding('cafe', 14, 30, 7, 'condo', { text: 'CAFÉ CLOUT', color: '#ffcf8a', bg: '#3b2414' });
    this.addBuilding(-62, 40, 36, 30, 120, 'glass', { crown: '#7fd9ff' });
    this.addBuilding(-62, 76, 40, 20, 34, 'condo');
    mark(-250, 50); this.poiBuilding('brunch', 14, 26, 8, 'condo', { text: 'BRUNCH THEORY', color: '#ff9fb5', bg: '#2b1220' });
    this.addBuilding(-262, 40, 30, 40, 70, 'teal');
    this.addBuilding(-262, 80, 40, 14, 30, 'condo');
    mark(-150, 150); this.poiBuilding('agency', 22, 34, 58, 'dark', { text: 'SUITE 404', color: '#d4af6a', bg: '#111', sub: 'ALWAYSFANS MANAGEMENT' }, '#d4af6a');
    this.addBuilding(-168, 130, 30, 24, 40, 'glass');
    this.addBuilding(-170, 172, 28, 22, 26, 'condo');
    mark(150, 250); {
      // dealership: glass showroom + lot
      const p = POI_BY_ID.dealer;
      this.addBuilding(150, 236, 46, 20, 9, 'glass', { collide: true });
      this.sign('BRICKELL PRESTIGE MOTORS', 150, 11.2, 225.7, Math.PI, 1.8, { color: '#bfe8ff', glow: true, neon: true });
      // showroom cars on turntables (in front lot)
      const show = [
        { id: 'tempesta', color: '#ff8c00', x: 132 }, { id: 'phantasm', color: '#2b0f3a', x: 150 }, { id: 'monaco', color: '#b3122e', x: 168 },
      ];
      for (const s of show) {
        const t = new THREE.Group();
        const base = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 0.25, 32), new THREE.MeshStandardMaterial({ color: '#ddd', metalness: 0.8, roughness: 0.2 }));
        base.position.y = 0.12;
        base.receiveShadow = true;
        this.group.add(base);
        base.position.set(s.x, 0.26, 218.5 + 4.5);
        const shape = s.id === 'tempesta' ? 'supercar' : s.id === 'monaco' ? 'convertible' : 'sedan';
        const dims = s.id === 'tempesta' ? { length: 4.7, width: 2.05, height: 1.15 } : s.id === 'monaco' ? { length: 4.8, width: 1.95, height: 1.3 } : { length: 5.8, width: 2.05, height: 1.6 };
        const car = buildCar(shape, dims, { paint: s.color, accent: s.id === 'phantasm' ? '#d4af6a' : '', wheels: 'forged', tint: 2, interior: '#ddd', underglow: '', engine: 0, handling: 0, chrome: true }, false);
        t.add(car.root);
        t.position.set(s.x, 0.38, 223);
        this.group.add(t);
        this.turntables.push(t);
        this.col.addRect(s.x, 223, 6, 6, 0, 2);
      }
      void p;
      this.addBuilding(170, 268, 30, 40, 64, 'teal', { crown: '#7fffd4' });
      this.addBuilding(125, 270, 26, 36, 38, 'glass');
    }
    mark(50, -50); this.poiBuilding('watch', 12, 24, 9, 'gold', { text: "TEMPO D'ORO", color: '#ffd27a', bg: '#1a1408', sub: 'FINE TIMEPIECES' });
    this.addBuilding(64, -50, 40, 60, 150, 'dark', { crown: '#ffd27a' });
    mark(-50, -150); this.poiBuilding('clothes', 12, 26, 8, 'condo', { text: 'DRIP DISTRICT', color: '#d9a6ff', bg: '#1b0f24' });
    this.addBuilding(-62, -150, 38, 60, 96, 'teal', { crown: '#d9a6ff' });
    mark(150, -150); {
      const { cx, cz } = this.poiBuilding('club', 30, 40, 16, 'dark', { text: 'VOLT', color: '#ff2fd0', neon: true });
      // neon trims
      for (const [yy, c] of [[15.5, '#ff2fd0'], [12, '#36c9ff']] as [number, string][]) {
        const m = new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
        this.neonMats.push(m);
        const strip = new THREE.Mesh(new THREE.BoxGeometry(30.4, 0.25, 40.4), m);
        strip.position.set(cx, yy, cz);
        this.group.add(strip);
      }
      this.sign('NIGHTCLUB', cx - 15.2, 9.2, cz, -Math.PI / 2, 1.1, { color: '#36c9ff', neon: true });
      this.addBuilding(176, -150, 20, 56, 54, 'glass');
    }
    mark(50, 150); {
      this.poiBuilding('rooftop', 34, 34, 140, 'glass', { text: 'SKY LOUNGE 88', color: '#7ff', bg: '#062026' }, '#7ffff0');
      this.addBuilding(70, 178, 30, 18, 30, 'condo');
    }
    mark(150, 50); this.poiBuilding('restaurant', 16, 30, 10, 'condo', { text: 'SALT & STATUS', color: '#ffb48a', bg: '#1c0f08', sub: 'STEAKHOUSE · VALET' });
    this.addBuilding(170, 50, 30, 64, 132, 'glass', { crown: '#ffb48a' });
    mark(245, -50); {
      this.poiBuilding('penthouse', 40, 40, 200, 'gold', { text: 'AURUM TOWER', color: '#ffd27a', bg: '#171208', sub: 'RESIDENCES · PENTHOUSE' }, '#ffcf6a');
    }
    mark(-150, -50); {
      // parking garage: open decks
      const p = POI_BY_ID.garage;
      const cx = p.x - 2 - 25, cz = p.z;
      const deckMat = new THREE.MeshStandardMaterial({ map: concreteTexture('#a9a59c'), roughness: 0.9 });
      for (let i = 0; i < 6; i++) {
        const deck = new THREE.Mesh(new THREE.BoxGeometry(50, 0.6, 70), deckMat);
        deck.position.set(cx, 3.2 * i + 0.4 + (i ? 0.2 : 0), cz);
        deck.castShadow = deck.receiveShadow = true;
        if (i > 0) this.group.add(deck);
      }
      for (let i = -2; i <= 2; i++)
        for (let j = -3; j <= 3; j++) {
          const col = new THREE.Mesh(new THREE.BoxGeometry(0.8, 16.5, 0.8), deckMat);
          col.position.set(cx + i * 12, 8.3, cz + j * 11);
          this.group.add(col);
        }
      this.col.addRect(cx, cz, 50, 70, 0, 18);
      this.mapRects.push({ x: cx, z: cz, w: 50, d: 70, h: 18, color: '#8a8a8a' });
      this.sign('P  CENTRAL GARAGE', cx + 25.3, 5.5, cz, Math.PI / 2, 1.6, { color: '#fff', bg: '#1d4ed8' });
    }
    mark(-250, -150); this.carMeetLot();
    mark(-150, -250); {
      this.poiBuilding('network', 28, 40, 44, 'teal', { text: 'THE HUSTLE HUB', color: '#a6ffb0', bg: '#0b1f12', sub: 'CO-WORKING · EVENTS' }, '#a6ffb0');
      this.addBuilding(-175, -250, 20, 60, 26, 'condo');
    }
    mark(50, -250); this.poiBuilding('hq', 40, 50, 165, 'dark', { text: 'BRICKELL AGENCY HQ', color: '#d4af6a', bg: '#0e0e10' }, '#d4af6a');
    mark(150, 150); {
      const { cx, cz } = this.poiBuilding('casino', 30, 50, 26, 'gold', { text: 'THE GILDED FLAMINGO', color: '#ff7ab8', neon: true, sub: 'CASINO · BAR · VALET' }, '#ff7ab8');
      for (const [yy, c] of [[25.5, '#ffcf6a'], [20, '#ff7ab8'], [14.5, '#ffcf6a']] as [number, string][]) {
        const m = new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
        this.neonMats.push(m);
        const strip = new THREE.Mesh(new THREE.BoxGeometry(30.4, 0.3, 50.4), m);
        strip.position.set(cx, yy, cz);
        this.group.add(strip);
      }
      this.sign('CASINO', cx - 15.25, 17.2, cz, -Math.PI / 2, 2.4, { color: '#ffcf6a', neon: true });
      this.addBuilding(172, 150, 24, 60, 118, 'glass', { crown: '#ff7ab8' });
    }
    mark(245, 250); this.promenadePlaza(findBlock(245, 250));
    mark(245, 150); this.park(findBlock(245, 150), 'BAYFRONT PARK');
    mark(-50, 250); this.park(findBlock(-50, 250), 'BRICKELL PARK');

    // --- generic blocks
    for (const b of this.blockList) {
      if (poiBlocks.has(key(b.cx, b.cz))) continue;
      const east = b.cx > 100;
      const central = Math.abs(b.cx) < 110;
      const tall = (east ? 90 : central ? 70 : 30) + r() * (east ? 110 : central ? 100 : 60);
      const styles: FacadeStyle[] = east ? ['glass', 'teal', 'condo', 'dark'] : ['glass', 'condo', 'teal', 'condo', 'dark'];
      const st = () => styles[Math.floor(r() * styles.length)];
      const pattern = r();
      const crown = r() < 0.5 ? ['#7fd9ff', '#ff7ad9', '#ffd27a', '#a6ffb0', '#ffffff'][Math.floor(r() * 5)] : undefined;
      if (pattern < 0.4) {
        // podium + tower
        this.addBuilding(b.cx, b.cz, b.w - 4, b.d - 4, 8 + r() * 6, 'condo');
        const tw = 26 + r() * 16, td = 26 + r() * 16;
        this.addBuilding(b.cx + (r() - 0.5) * 10, b.cz + (r() - 0.5) * 10, tw, td, tall, st(), { crown, y0: 0.14 });
      } else if (pattern < 0.75) {
        const w2 = (b.w - 6) / 2;
        this.addBuilding(b.cx - w2 / 2 - 1.5, b.cz, w2, b.d - 8, tall, st(), { crown });
        this.addBuilding(b.cx + w2 / 2 + 1.5, b.cz, w2, b.d - 8, tall * (0.4 + r() * 0.5), st());
      } else {
        const w4 = (b.w - 6) / 2, d4 = (b.d - 6) / 2;
        for (const sx of [-1, 1])
          for (const sz of [-1, 1]) this.addBuilding(b.cx + sx * (w4 / 2 + 1.5), b.cz + sz * (d4 / 2 + 1.5), w4, d4, 14 + r() * tall * 0.5, st());
      }
    }

    // --- distant skyline (no collision) to make Miami feel bigger
    const far = rng(99);
    const ring = (x0: number, x1: number, z0: number, z1: number, n: number, hMax: number) => {
      for (let i = 0; i < n; i++) {
        const x = x0 + far() * (x1 - x0), z = z0 + far() * (z1 - z0);
        const w = 20 + far() * 30, d = 20 + far() * 30;
        const style = (['glass', 'condo', 'teal', 'dark'] as FacadeStyle[])[Math.floor(far() * 4)];
        this.addBuilding(x, z, w, d, 20 + far() * hMax, style, { collide: false, y0: 0 });
        this.mapRects.pop();
      }
    };
    ring(-900, -380, -700, 700, 70, 90);
    ring(-380, 300, -900, -380, 40, 120);
    ring(-380, 300, 380, 800, 35, 70);
    // Brickell Key-style island across the water
    const island = new THREE.Mesh(new THREE.CylinderGeometry(70, 76, 2, 32), new THREE.MeshStandardMaterial({ color: '#6c8a55', roughness: 1 }));
    island.position.set(560, -0.5, -240);
    this.group.add(island);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      this.addBuilding(560 + Math.cos(a) * 35, -240 + Math.sin(a) * 35, 18, 18, 50 + (i % 3) * 30, i % 2 ? 'glass' : 'condo', { collide: false, y0: 0, crown: i % 2 ? '#7fd9ff' : undefined });
      this.mapRects.pop();
    }
  }

  private carMeetLot() {
    const p = POI_BY_ID.carmeet;
    const lot = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), new THREE.MeshStandardMaterial({ color: '#2b2c30', roughness: 0.95 }));
    lot.rotation.x = -Math.PI / 2;
    lot.position.set(p.x, 0.15, p.z);
    lot.receiveShadow = true;
    this.group.add(lot);
    // parking lines
    const lines: THREE.BufferGeometry[] = [];
    for (let i = -6; i <= 6; i++) {
      for (const sz of [-1, 1]) {
        const g = new THREE.PlaneGeometry(0.15, 5);
        g.rotateX(-Math.PI / 2);
        g.translate(p.x + i * 3, 0.16, p.z + sz * 28);
        lines.push(g);
      }
    }
    // centre showoff ring
    const ring = new THREE.RingGeometry(9, 9.5, 48);
    ring.rotateX(-Math.PI / 2);
    ring.translate(p.x, 0.16, p.z);
    lines.push(ring);
    this.group.add(new THREE.Mesh(mergeGeometries(lines), new THREE.MeshBasicMaterial({ color: '#f5d061' })));
    // overpass (the "underpass" in Underpass Car Meet)
    const deckMat = new THREE.MeshStandardMaterial({ map: concreteTexture('#9a968e'), roughness: 0.9 });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(76, 1.4, 14), deckMat);
    deck.position.set(p.x, 9, p.z - 20);
    deck.castShadow = deck.receiveShadow = true;
    this.group.add(deck);
    for (const sx of [-30, -10, 10, 30]) {
      const pil = new THREE.Mesh(new THREE.BoxGeometry(1.6, 9, 1.6), deckMat);
      pil.position.set(p.x + sx, 4.5, p.z - 20);
      this.group.add(pil);
      this.col.addRect(p.x + sx, p.z - 20, 1.6, 1.6, 0, 9);
    }
    // parked cars
    const colors = ['#ff3b30', '#ffcc00', '#0a84ff', '#30d158', '#ffffff', '#111111', '#bf5af2', '#ff9f0a'];
    for (let i = 0; i < 9; i++) {
      const car = buildTrafficCar(colors[i % colors.length], i % 3);
      car.position.set(p.x - 24 + i * 6, 0.15, p.z + 28);
      car.rotation.y = Math.PI;
      this.group.add(car);
      this.col.addRect(car.position.x, car.position.z, 2.2, 4.8, 0, 2);
    }
    // stage lights
    for (const [sx, c] of [[-1, '#ff2fd0'], [1, '#36c9ff']] as [number, string][]) {
      const m = new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
      this.neonMats.push(m);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 7, 8), new THREE.MeshStandardMaterial({ color: '#222' }));
      pole.position.set(p.x + sx * 16, 3.5, p.z + 12);
      this.group.add(pole);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 8), m);
      head.position.set(p.x + sx * 16, 7.2, p.z + 12);
      this.group.add(head);
    }
    this.sign('UNDERPASS CAR MEET', p.x, 11.2, p.z - 12.9, 0, 1.8, { color: '#ff6a3d', neon: true });
    this.groundRects.unshift({ minX: p.x - 35, maxX: p.x + 35, minZ: p.z - 35, maxZ: p.z + 35, y: 0.15 });
    this.mapRects.push({ x: p.x, z: p.z - 20, w: 76, d: 14, h: 10, color: '#77736b' });
  }

  private promenadePlaza(b: Block) {
    const tile = new THREE.Mesh(new THREE.PlaneGeometry(b.w, b.d), new THREE.MeshStandardMaterial({ map: (() => { const t = concreteTexture('#e3d6bd'); t.repeat.set(b.w / 6, b.d / 6); return t; })(), roughness: 0.8 }));
    tile.rotation.x = -Math.PI / 2;
    tile.position.set(b.cx, 0.15, b.cz);
    tile.receiveShadow = true;
    this.group.add(tile);
    const star = new THREE.RingGeometry(10, 10.6, 5);
    star.rotateX(-Math.PI / 2);
    const m = new THREE.MeshBasicMaterial({ color: '#ffd700', toneMapped: false });
    this.neonMats.push(m);
    const s = new THREE.Mesh(star, m);
    s.position.set(b.cx, 0.17, b.cz);
    this.group.add(s);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      this.palms.push({ x: b.cx + Math.cos(a) * 28, z: b.cz + Math.sin(a) * 28, s: 1 + (i % 3) * 0.1 });
    }
    this.sign('BAYFRONT PROMENADE', b.cx, 6, b.cz - b.d / 2 + 1, Math.PI, 1.5, { color: '#ffd700', neon: true });
    this.parks.push({ x: b.cx, z: b.cz, w: b.w, d: b.d, h: 0, color: '#d9c9a5' });
  }

  private park(b: Block, name: string) {
    const g = grassTexture();
    g.repeat.set(b.w / 8, b.d / 8);
    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(b.w, b.d), new THREE.MeshStandardMaterial({ map: g, roughness: 1 }));
    lawn.rotation.x = -Math.PI / 2;
    lawn.position.set(b.cx, 0.15, b.cz);
    lawn.receiveShadow = true;
    this.group.add(lawn);
    const r = rng(Math.round(b.cx * 7 + b.cz));
    for (let i = 0; i < 16; i++) this.palms.push({ x: b.cx + (r() - 0.5) * (b.w - 8), z: b.cz + (r() - 0.5) * (b.d - 8), s: 0.9 + r() * 0.4 });
    this.sign(name, b.cx, 2.2, b.cz + b.d / 2 - 1, 0, 0.9, { color: '#fff', bg: '#0d5c32' });
    this.parks.push({ x: b.cx, z: b.cz, w: b.w, d: b.d, h: 0, color: '#4f7d3a' });
    // fountain
    const f = new THREE.Mesh(new THREE.CylinderGeometry(4, 4.4, 0.8, 24), new THREE.MeshStandardMaterial({ color: '#ddd', roughness: 0.6 }));
    f.position.set(b.cx, 0.55, b.cz);
    this.group.add(f);
    const w = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 0.1, 24), new THREE.MeshStandardMaterial({ color: '#2aa7c9', roughness: 0.1, metalness: 0.3 }));
    w.position.set(b.cx, 0.9, b.cz);
    this.group.add(w);
    this.col.addRect(b.cx, b.cz, 8, 8, 0, 1.2);
  }

  private buildPalmsAndLamps() {
    // palms along Brickell Ave median & sidewalks
    for (let z = ROADS_Z[0] + 20; z < ROADS_Z[ROADS_Z.length - 1]; z += 22) {
      if (ROADS_Z.some((rz) => Math.abs(rz - z) < 12)) continue;
      this.palms.push({ x: -ROAD_W / 2 - 1.5, z, s: 1 });
      this.palms.push({ x: ROAD_W / 2 + 1.5, z: z + 11, s: 1.05 });
      this.palms.push({ x: ROADS_X[ROADS_X.length - 1] + ROAD_W / 2 + 6, z: z + 5, s: 1.1 });
    }
    for (let x = ROADS_X[0] + 20; x < ROADS_X[ROADS_X.length - 1]; x += 26) {
      if (ROADS_X.some((rx) => Math.abs(rx - x) < 12)) continue;
      this.palms.push({ x, z: ROADS_Z[ROADS_Z.length - 1] - ROAD_W / 2 - 1.5, s: 1 });
    }
    // palm meshes (instanced)
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.3, 9, 7);
    trunkGeo.translate(0, 4.5, 0);
    const frondGeo = (() => {
      const parts: THREE.BufferGeometry[] = [];
      for (let i = 0; i < 8; i++) {
        const g = new THREE.ConeGeometry(0.6, 4.2, 4, 1);
        g.scale(1, 1, 0.15);
        g.translate(0, 2.1, 0);
        g.rotateX(Math.PI / 2 + 0.55);
        g.rotateY((i / 8) * Math.PI * 2);
        g.translate(0, 9, 0);
        parts.push(g.toNonIndexed());
      }
      return mergeGeometries(parts)!;
    })();
    const n = this.palms.length;
    const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: '#8b6b4a', roughness: 1 }), n);
    const fronds = new THREE.InstancedMesh(frondGeo, new THREE.MeshStandardMaterial({ color: '#2f7a3a', roughness: 0.9, side: THREE.DoubleSide }), n);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    this.palms.forEach((p, i) => {
      e.set((Math.sin(i * 1.7) * 0.06), i * 0.9, Math.cos(i * 1.3) * 0.06);
      q.setFromEuler(e);
      m.compose(new THREE.Vector3(p.x, this.groundAt(p.x, p.z), p.z), q, new THREE.Vector3(p.s, p.s, p.s));
      trunks.setMatrixAt(i, m);
      fronds.setMatrixAt(i, m);
      this.col.addRect(p.x, p.z, 0.6, 0.6, 0, 9);
    });
    trunks.castShadow = fronds.castShadow = true;
    this.group.add(trunks, fronds);

    // street lamps at intersection corners
    for (const x of ROADS_X)
      for (const z of ROADS_Z) {
        const o = ROAD_W / 2 + 1;
        this.lamps.push({ x: x + o, z: z + o, ry: Math.PI * 1.25 });
        this.lamps.push({ x: x - o, z: z - o, ry: Math.PI * 0.25 });
      }
    const poleGeo = new THREE.CylinderGeometry(0.1, 0.14, 7.5, 6);
    poleGeo.translate(0, 3.75, 0);
    const armGeo = new THREE.BoxGeometry(0.12, 0.12, 2.4);
    armGeo.translate(0, 7.4, 1.1);
    const pole = mergeGeometries([poleGeo.toNonIndexed(), armGeo.toNonIndexed()])!;
    const head = new THREE.BoxGeometry(0.5, 0.18, 0.9);
    head.translate(0, 7.3, 2.2);
    const nl = this.lamps.length;
    const poles = new THREE.InstancedMesh(pole, new THREE.MeshStandardMaterial({ color: '#2a2d33', metalness: 0.6, roughness: 0.4 }), nl);
    const heads = new THREE.InstancedMesh(head, this.lampMat, nl);
    this.lamps.forEach((l, i) => {
      e.set(0, l.ry, 0);
      q.setFromEuler(e);
      m.compose(new THREE.Vector3(l.x, 0.14, l.z), q, new THREE.Vector3(1, 1, 1));
      poles.setMatrixAt(i, m);
      heads.setMatrixAt(i, m);
      this.col.addRect(l.x, l.z, 0.4, 0.4, 0, 7);
    });
    poles.castShadow = true;
    this.group.add(poles, heads);
    // lamp glow pools on the ground (cheap fake lighting)
    const poolMat = new THREE.MeshBasicMaterial({ map: glowTexture(), color: '#ffcf8a', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    this.neonMats.push(poolMat);
    (poolMat as THREE.MeshBasicMaterial & { userData: { night?: boolean } }).userData.night = true;
    const poolGeo = new THREE.PlaneGeometry(9, 9);
    poolGeo.rotateX(-Math.PI / 2);
    const pools = new THREE.InstancedMesh(poolGeo, poolMat, nl);
    this.lamps.forEach((l, i) => {
      const fx = Math.sin(l.ry) * 2.2, fz = Math.cos(l.ry) * 2.2;
      m.makeTranslation(l.x + fx, 0.2, l.z + fz);
      pools.setMatrixAt(i, m);
    });
    this.group.add(pools);

    // street name signs
    for (const x of ROADS_X)
      for (const z of ROADS_Z) {
        if ((Math.abs(x) + Math.abs(z)) % 200 !== 0 && x !== 0) continue;
        const o = ROAD_W / 2 + 1;
        const tn = streetSignTexture(STREET_NAMES_X[x]);
        const te = streetSignTexture(STREET_NAMES_Z[z]);
        const sm1 = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 0.52), new THREE.MeshBasicMaterial({ map: tn, side: THREE.DoubleSide }));
        sm1.position.set(x + o, 3.4, z + o);
        sm1.rotation.y = Math.PI / 2;
        const sm2 = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 0.52), new THREE.MeshBasicMaterial({ map: te, side: THREE.DoubleSide }));
        sm2.position.set(x + o, 2.85, z + o);
        this.group.add(sm1, sm2);
      }
  }

  private buildWaterfront() {
    this.water = createWater(3000, 1);
    this.water.mesh.position.set(SEAWALL_X + 1500 - 2, -0.6, 0);
    this.group.add(this.water.mesh);
    // seawall
    const wall = new THREE.Mesh(new THREE.BoxGeometry(2, 1.4, MAP_MAX_Z - MAP_MIN_Z + 400), new THREE.MeshStandardMaterial({ map: concreteTexture('#cfc8b8'), roughness: 0.9 }));
    wall.position.set(SEAWALL_X + 0.5, -0.1, 0);
    this.group.add(wall);
    // railing
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, MAP_MAX_Z - MAP_MIN_Z), new THREE.MeshStandardMaterial({ color: '#ddd', metalness: 0.8, roughness: 0.2 }));
    rail.position.set(SEAWALL_X - 0.4, 1.15, 0);
    this.group.add(rail);
    // marina piers
    const wood = woodTexture();
    wood.repeat.set(4, 30);
    const pierMat = new THREE.MeshStandardMaterial({ map: wood, roughness: 0.85 });
    const pier = new THREE.Mesh(new THREE.BoxGeometry(130, 0.4, 4), pierMat);
    pier.position.set(SEAWALL_X + 65, 0.1, PIER_Z);
    pier.receiveShadow = true;
    this.group.add(pier);
    for (let i = 0; i < 5; i++) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(2, 0.35, 18), pierMat);
      f.position.set(SEAWALL_X + 20 + i * 24, 0.08, PIER_Z + 11);
      this.group.add(f);
      // moored boats (other people's yachts)
      if (i < 4) {
        const boat = this.simpleBoat(9 + (i % 2) * 4, ['#ffffff', '#f0f0f0', '#1e3a8a', '#ffffff'][i]);
        boat.position.set(SEAWALL_X + 32 + i * 24, 0, PIER_Z + 12);
        this.group.add(boat);
      }
    }
    // causeway bridge in the distance
    const deck = new THREE.Mesh(new THREE.BoxGeometry(900, 1.5, 14), new THREE.MeshStandardMaterial({ color: '#c9c3b6', roughness: 0.9 }));
    deck.position.set(SEAWALL_X + 460, 8, 420);
    this.group.add(deck);
    for (let i = 0; i < 18; i++) {
      const pil = new THREE.Mesh(new THREE.BoxGeometry(3, 10, 3), deck.material);
      pil.position.set(SEAWALL_X + 40 + i * 50, 3, 420);
      this.group.add(pil);
    }
    this.sign('BAYSIDE MARINA', SEAWALL_X - 1, 4.2, 200, Math.PI / 2, 1.3, { color: '#4cf', bg: '#04121c' });
  }

  simpleBoat(len: number, color: string) {
    const g = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(len * 0.3, 1.4, len), new THREE.MeshStandardMaterial({ color, roughness: 0.3 }));
    hull.position.y = 0.3;
    const bow = new THREE.Mesh(new THREE.ConeGeometry(len * 0.15, len * 0.3, 4), hull.material);
    bow.rotation.x = Math.PI / 2;
    bow.rotation.y = Math.PI / 4;
    bow.scale.set(1.4, 1, 0.6);
    bow.position.set(0, 0.3, len / 2 + len * 0.12);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(len * 0.24, 1.1, len * 0.4), new THREE.MeshStandardMaterial({ color: '#f5f5f5', roughness: 0.4 }));
    cabin.position.set(0, 1.5, -len * 0.05);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(len * 0.245, 0.4, len * 0.3), new THREE.MeshStandardMaterial({ color: '#111a22', roughness: 0.1, metalness: 0.5 }));
    glass.position.set(0, 1.7, 0);
    g.add(hull, bow, cabin, glass);
    return g;
  }

  private buildLandmarks() {
    // Valet podiums at valet POIs
    for (const p of Object.values(POI_BY_ID)) {
      if (!p.valet) continue;
      const fx = Math.sin(p.face), fz = Math.cos(p.face);
      const podium = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.1, 0.6), new THREE.MeshStandardMaterial({ color: '#7b0d1e', roughness: 0.5 }));
      podium.position.set(p.x + fx * 1.2 + fz * 3, 0.7, p.z + fz * 1.2 - fx * 3);
      this.group.add(podium);
      const sgn = this.sign('VALET', podium.position.x, 1.6, podium.position.z, p.face, 0.35, { color: '#fff', bg: '#7b0d1e' });
      void sgn;
      // red carpet / valet zone marking on the road
      const zone = new THREE.Mesh(new THREE.PlaneGeometry(Math.abs(fx) > 0.5 ? 6 : 12, Math.abs(fx) > 0.5 ? 12 : 6), new THREE.MeshStandardMaterial({ color: '#8a1020', roughness: 0.9, transparent: true, opacity: 0.55 }));
      zone.rotation.x = -Math.PI / 2;
      zone.position.set(p.x + fx * 7, 0.03, p.z + fz * 7);
      this.group.add(zone);
    }
    // POI ground rings (entrance markers)
    const ringMat = new THREE.MeshBasicMaterial({ color: '#d4af6a', transparent: true, opacity: 0.55, toneMapped: false, depthWrite: false });
    for (const p of Object.values(POI_BY_ID)) {
      if (p.kind === 'carmeet' || p.kind === 'showoff') continue;
      const ring = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.35, 32), ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(p.x, this.groundAt(p.x, p.z) + 0.03, p.z);
      this.group.add(ring);
    }
  }

  private finalize() {
    for (const style of Object.keys(this.buckets) as FacadeStyle[]) {
      const list = this.buckets[style];
      if (!list.length) continue;
      const { map, emissive } = facadeTextures(style, style.length * 31);
      const mat = new THREE.MeshStandardMaterial({
        map, emissiveMap: emissive, emissive: '#ffffff', emissiveIntensity: 0.1,
        metalness: style === 'condo' ? 0.1 : 0.55, roughness: style === 'condo' ? 0.6 : 0.18,
      });
      this.buildingMats.push(mat);
      const geo = mergeGeometries(list, false)!;
      list.forEach((g) => g.dispose());
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
    }
    if (this.crownGeos.length) {
      const g = mergeGeometries(this.crownGeos, false)!;
      this.group.add(new THREE.Mesh(g, this.crownMat));
    }
  }

  /** Night factor 0..1 */
  setNight(n: number) {
    for (const m of this.buildingMats) m.emissiveIntensity = 0.08 + n * 1.5;
    this.lampMat.emissiveIntensity = 0.2 + n * 3.5;
    this.crownMat.color.setScalar(0.35 + n * 0.65);
    for (const m of this.signMats) m.emissiveIntensity = 0.3 + n * 1.2;
    for (const m of this.neonMats) if ((m.userData as { night?: boolean }).night) m.opacity = n * 0.55;
  }

  update(dt: number, t: number) {
    for (const tt of this.turntables) tt.rotation.y += dt * 0.35;
    this.water.mat.uniforms.uTime.value = t;
  }
}
