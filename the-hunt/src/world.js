import * as THREE from 'three';
import { makeNoise2D, makeRng, clamp, lerp, smoothstep, distToSegment } from './util.js';
import {
  pineGeometry, spruceGeometry, deadTreeGeometry, farTreeGeometry, saplingGeometry, bushGeometry,
  rockGeometry, logGeometry, fernGeometry, vcMat, vcMatFlat,
} from './models.js';
import { groundTexture, waterTexture } from './textures.js';

// ---------------------------------------------------------------- layout
// The forest layout is fixed so landmarks are learnable; contents are randomised per run.

export const WORLD = { size: 720, half: 360, limit: 334, cell: 4 };

export const LANDMARKS = {
  trailhead: { x: 4, z: 318, r: 14, name: 'Trailhead', icon: 'truck' },
  camp: { x: 34, z: 272, r: 17, name: 'Hunting Camp', icon: 'camp' },
  abandoned: { x: 152, z: 132, r: 15, name: 'Abandoned Campsite', icon: 'tent' },
  lake: { x: 192, z: 22, r: 0, name: 'Blackwater Lake', icon: 'lake' },
  dock: { x: 128, z: 30, r: 8, name: 'Old Dock', icon: 'dock' },
  relay: { x: 252, z: -188, r: 13, name: 'Radio Relay', icon: 'radio' },
  station: { x: -205, z: -55, r: 22, name: 'Ranger Station', icon: 'station' },
  harlan: { x: -252, z: 205, r: 14, name: 'Harlan Cabin', icon: 'cabin' },
  miller: { x: 96, z: -122, r: 13, name: 'Miller Cabin', icon: 'cabin' },
  towerA: { x: -72, z: 150, r: 9, name: 'Hunting Tower', icon: 'tower' },
  towerB: { x: 100, z: 78, r: 9, name: 'Hunting Tower', icon: 'tower' },
  towerC: { x: -128, z: -212, r: 9, name: 'Hunting Tower', icon: 'tower' },
  towerD: { x: 58, z: -238, r: 9, name: 'Hunting Tower', icon: 'tower' },
  gate: { x: 18, z: -318, r: 12, name: 'North Gate', icon: 'gate' },
  hollow: { x: -268, z: -268, r: 24, name: 'The Hollow', icon: 'hollow' },
  clearing1: { x: -40, z: 60, r: 26, name: 'Meadow', icon: null },
  clearing2: { x: 210, z: 200, r: 22, name: null, icon: null },
  clearing3: { x: -150, z: 70, r: 22, name: null, icon: null },
  clearing4: { x: 160, z: -60, r: 20, name: null, icon: null },
  clearing5: { x: -60, z: -150, r: 24, name: null, icon: null },
};

export const ROADS = [
  { w: 3.4, pts: [[4, 370], [4, 318], [22, 272], [12, 205], [-12, 128], [0, 44], [18, -40], [8, -120], [30, -200], [18, -282], [18, -370]] },
  { w: 3.0, pts: [[2, 30], [-70, 12], [-140, -30], [-205, -55]] },
  { w: 2.2, pts: [[11, 190], [80, 168], [152, 132]] },
  { w: 2.0, pts: [[14, -92], [96, -122], [180, -160], [252, -188]] },
  { w: 1.6, pts: [[-12, 128], [-120, 172], [-252, 205]] },
  { w: 1.5, pts: [[152, 132], [138, 80], [128, 32]] },
];

export const LAKE = { x: 192, z: 22, r: 56 };

// ---------------------------------------------------------------- world

export class World {
  constructor(scene, settings) {
    this.scene = scene;
    this.settings = settings;
    this.noise = makeNoise2D(1337);
    this.noise2 = makeNoise2D(4242);
    this.circles = new Map(); // spatial hash of round colliders (trees, rocks)
    this.boxes = []; // oriented box colliders {cx, cz, hx, hz, c, s, y0, y1}
    this.surfaces = []; // walkable tops {cx, cz, hx, hz, c, s, top, kind}
    this.chunks = [];
    this.chunkSize = 60;
    this.waterLevel = 0;
    this.treeCount = 0;
  }

  // ---------------------------------------------------------- height function

  rawHeight(x, z) {
    const n = this.noise;
    let h = 10 * n(x / 240, z / 240) + 4.5 * n(x / 85 + 10, z / 85) + 1.1 * n(x / 22, z / 22 + 5) + 0.3 * n(x / 6, z / 6);
    const d = Math.max(Math.abs(x), Math.abs(z));
    if (d > 290) h += ((d - 290) / 28) ** 2 * 10; // ridges ringing the valley
    const relay = LANDMARKS.relay;
    h += 15 * Math.exp(-((x - relay.x) ** 2 + (z - relay.z) ** 2) / 70 ** 2);
    const hol = LANDMARKS.hollow;
    h -= 7 * Math.exp(-((x - hol.x) ** 2 + (z - hol.z) ** 2) / 34 ** 2);
    return h;
  }

  lowHeight(x, z) {
    return 10 * this.noise(x / 240, z / 240) + 4.5 * this.noise(x / 85 + 10, z / 85);
  }

  roadDistance(x, z) {
    let best = 1e9, w = 0;
    for (const r of ROADS) {
      for (let i = 0; i < r.pts.length - 1; i++) {
        const a = r.pts[i], b = r.pts[i + 1];
        const d = distToSegment(x, z, a[0], a[1], b[0], b[1]) - r.w;
        if (d < best) { best = d; w = r.w; }
      }
    }
    return [best, w];
  }

  lakeEdge(x, z) {
    // >0 inside the lake, value = metres from shore
    const dx = x - LAKE.x, dz = z - LAKE.z;
    const a = Math.atan2(dz, dx);
    const rr = LAKE.r + 9 * Math.sin(a * 3 + 1) + 5 * Math.sin(a * 5 + 2) + 4 * this.noise2(Math.cos(a) * 2, Math.sin(a) * 2);
    return rr - Math.hypot(dx, dz);
  }

  computeHeight(x, z) {
    let h = this.rawHeight(x, z);
    for (const k in LANDMARKS) {
      const L = LANDMARKS[k];
      if (!L.r) continue;
      const d = Math.hypot(x - L.x, z - L.z);
      if (d < L.r * 1.8) {
        const f = 1 - smoothstep(L.r * 0.65, L.r * 1.8, d);
        h = lerp(h, L.flatH, f);
      }
    }
    const [rd] = this.roadDistance(x, z);
    if (rd < 8) {
      const f = 1 - smoothstep(0, 8, rd);
      h = lerp(h, this.lowHeight(x, z) + (this._roadBias(x, z)), f * 0.85) - (rd < 0 ? 0.12 : 0);
    }
    const t = this.lakeEdge(x, z);
    if (t > -16) {
      const f = smoothstep(-16, 0, t);
      h = lerp(h, this.waterLevel + 0.7 - clamp(t * 0.16, 0, 3.8), f);
    }
    return h;
  }

  _roadBias(x, z) {
    // keep roads close to the raw terrain average so cuts are shallow
    return (this.rawHeight(x, z) - this.lowHeight(x, z)) * 0.5;
  }

  // ---------------------------------------------------------- generation

  async generate(progress) {
    for (const k in LANDMARKS) {
      const L = LANDMARKS[k];
      L.flatH = this.rawHeight(L.x, L.z);
    }
    this.waterLevel = this.rawHeight(LAKE.x, LAKE.z) - 1.2;
    LANDMARKS.dock.flatH = this.waterLevel + 0.25;
    await progress(0.05, 'Shaping the valley');
    this.buildTerrain();
    await progress(0.25, 'Mapping old logging roads');
    this.buildWater();
    await progress(0.32, 'Growing the pines');
    this.buildVegetation();
    await progress(0.6, 'Planting undergrowth');
  }

  buildTerrain() {
    const N = Math.round(WORLD.size / WORLD.cell) + 1;
    this.gridN = N;
    const H = WORLD.half, s = WORLD.cell;
    const heights = new Float32Array(N * N);
    const road = new Float32Array(N * N);
    const pos = new Float32Array(N * N * 3);
    const col = new Float32Array(N * N * 3);
    const uv = new Float32Array(N * N * 2);
    const cForest = new THREE.Color('#5a5840'), cMoss = new THREE.Color('#566a3c'), cNeedle = new THREE.Color('#6a5640');
    const cGrass = new THREE.Color('#72804a'), cRoad = new THREE.Color('#8a765a'), cMud = new THREE.Color('#4e4234');
    const cRock = new THREE.Color('#77776e'), cBed = new THREE.Color('#2e2b24');
    const tmp = new THREE.Color();
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const x = -H + i * s, z = -H + j * s;
        const h = this.computeHeight(x, z);
        const idx = j * N + i;
        heights[idx] = h;
        const [rd] = this.roadDistance(x, z);
        road[idx] = rd;
        pos[idx * 3] = x; pos[idx * 3 + 1] = h; pos[idx * 3 + 2] = z;
        uv[idx * 2] = x / 5; uv[idx * 2 + 1] = z / 5;
        // colour
        const n1 = this.noise2(x / 30, z / 30) * 0.5 + 0.5;
        const n2 = this.noise2(x / 9 + 50, z / 9) * 0.5 + 0.5;
        tmp.copy(cForest).lerp(cMoss, n1 * 0.8).lerp(cNeedle, n2 * 0.5);
        const open = this.openness(x, z);
        tmp.lerp(cGrass, open * 0.75);
        if (rd < 2) tmp.lerp(cRoad, clamp(1 - rd / 2, 0, 1) * (0.75 + 0.25 * n2));
        const lt = this.lakeEdge(x, z);
        if (lt > -8) tmp.lerp(cMud, smoothstep(-8, -1, lt));
        if (lt > 0.5) tmp.lerp(cBed, smoothstep(0.5, 6, lt));
        col[idx * 3] = tmp.r; col[idx * 3 + 1] = tmp.g; col[idx * 3 + 2] = tmp.b;
      }
    }
    // slope tint (needs heights)
    for (let j = 1; j < N - 1; j++) {
      for (let i = 1; i < N - 1; i++) {
        const idx = j * N + i;
        const gx = (heights[idx + 1] - heights[idx - 1]) / (2 * s);
        const gz = (heights[idx + N] - heights[idx - N]) / (2 * s);
        const slope = Math.hypot(gx, gz);
        if (slope > 0.45) {
          const f = smoothstep(0.45, 1.0, slope);
          col[idx * 3] = lerp(col[idx * 3], cRock.r, f);
          col[idx * 3 + 1] = lerp(col[idx * 3 + 1], cRock.g, f);
          col[idx * 3 + 2] = lerp(col[idx * 3 + 2], cRock.b, f);
        }
      }
    }
    this.heights = heights;
    this.roadGrid = road;
    const index = new Uint32Array((N - 1) * (N - 1) * 6);
    let k = 0;
    for (let j = 0; j < N - 1; j++) {
      for (let i = 0; i < N - 1; i++) {
        const a = j * N + i, b = (j + 1) * N + i, c = j * N + i + 1, d = (j + 1) * N + i + 1;
        index[k++] = a; index[k++] = b; index[k++] = c;
        index[k++] = c; index[k++] = b; index[k++] = d;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(new THREE.BufferAttribute(index, 1));
    g.computeVertexNormals();
    const tex = groundTexture();
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, map: tex });
    this.terrain = new THREE.Mesh(g, mat);
    this.terrain.receiveShadow = true;
    this.terrain.matrixAutoUpdate = false;
    this.scene.add(this.terrain);
  }

  /** 0 = dense forest, 1 = open (clearings, lakeshore, landmarks). */
  openness(x, z) {
    let o = 0;
    for (const k in LANDMARKS) {
      const L = LANDMARKS[k];
      if (!L.r) continue;
      const d = Math.hypot(x - L.x, z - L.z);
      o = Math.max(o, 1 - smoothstep(L.r * 0.8, L.r * 1.25, d));
    }
    const lt = this.lakeEdge(x, z);
    o = Math.max(o, smoothstep(-14, -4, lt));
    return o;
  }

  buildWater() {
    const tex = waterTexture();
    tex.repeat.set(8, 8);
    const g = new THREE.CircleGeometry(LAKE.r + 30, 40);
    g.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshPhongMaterial({
      color: 0x1b2328, specular: 0x8899aa, shininess: 90, map: tex, transparent: true, opacity: 0.92, depthWrite: true,
    });
    this.water = new THREE.Mesh(g, mat);
    this.water.position.set(LAKE.x, this.waterLevel, LAKE.z);
    this.water.renderOrder = 1;
    this.scene.add(this.water);
    this.waterTex = tex;
  }

  buildVegetation() {
    const rng = makeRng(98765);
    const C = this.chunkSize;
    const nC = Math.ceil(WORLD.size / C);
    this.nChunks = nC;
    const kinds = {
      pine0: pineGeometry(1), pine1: pineGeometry(2), pine2: pineGeometry(3),
      spruce0: spruceGeometry(4), spruce1: spruceGeometry(5),
      dead0: deadTreeGeometry(6), dead1: deadTreeGeometry(7),
      far: farTreeGeometry(),
      sapling0: saplingGeometry(8), sapling1: saplingGeometry(9),
      bush0: bushGeometry(10), bush1: bushGeometry(11),
      rock0: rockGeometry(12), rock1: rockGeometry(13),
      log0: logGeometry(14),
      fern: fernGeometry(),
    };
    const fernMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    const buckets = [];
    for (let i = 0; i < nC * nC; i++) buckets.push({});
    const put = (kind, x, y, z, ry, sc, shade) => {
      const ci = clamp(Math.floor((x + WORLD.half) / C), 0, nC - 1);
      const cj = clamp(Math.floor((z + WORLD.half) / C), 0, nC - 1);
      const b = buckets[cj * nC + ci];
      (b[kind] ||= []).push([x, y, z, ry, sc, shade]);
    };
    const H = WORLD.half;
    const step = 5.2;
    const hol = LANDMARKS.hollow;
    for (let z = -H + 2; z < H - 2; z += step) {
      for (let x = -H + 2; x < H - 2; x += step) {
        const px = x + (rng() - 0.5) * step * 0.95;
        const pz = z + (rng() - 0.5) * step * 0.95;
        const open = this.openness(px, pz);
        const [rd] = this.roadDistance(px, pz);
        if (rd < 1.5 || this.lakeEdge(px, pz) > -3) continue;
        const dens = 0.42 + 0.38 * this.noise2(px / 70, pz / 70) + 0.2 * this.noise(px / 25 + 9, pz / 25);
        let p = clamp(dens, 0.05, 0.95) * (1 - open) * smoothstep(1.5, 7, rd);
        if (Math.max(Math.abs(px), Math.abs(pz)) > 300) p = Math.max(p, 0.85); // walls of trees at the edges
        if (rng() > p) continue;
        const y = this.heightAt(px, pz);
        const dh = Math.hypot(px - hol.x, pz - hol.z);
        const deadBias = dh < 70 ? 0.6 : 0.07;
        const t = rng();
        let kind;
        if (t < deadBias) kind = rng() < 0.5 ? 'dead0' : 'dead1';
        else if (rng() < 0.58) kind = 'pine' + Math.floor(rng() * 3);
        else kind = 'spruce' + Math.floor(rng() * 2);
        const sc = 0.75 + rng() * 0.6;
        put(kind, px, y - 0.2, pz, rng() * 6.28, sc, 0.8 + rng() * 0.35);
        this.addCircle(px, pz, 0.32 * sc + 0.08, 'tree');
        this.treeCount++;
      }
    }
    // undergrowth & rocks
    for (let i = 0; i < 26000; i++) {
      const px = (rng() - 0.5) * 2 * (H - 10);
      const pz = (rng() - 0.5) * 2 * (H - 10);
      const [rd] = this.roadDistance(px, pz);
      if (rd < 0.8 || this.lakeEdge(px, pz) > -1) continue;
      const open = this.openness(px, pz);
      const y = this.heightAt(px, pz);
      const r = rng();
      if (r < 0.40) {
        if (open > 0.6 && rng() < 0.6) continue;
        put('fern', px, y, pz, rng() * 6.28, 0.7 + rng() * 0.7, 0.8 + rng() * 0.4);
      } else if (r < 0.62) {
        if (open > 0.5 && rng() < 0.7) continue;
        put('sapling' + (rng() < 0.5 ? 0 : 1), px, y, pz, rng() * 6.28, 0.7 + rng() * 0.8, 0.8 + rng() * 0.4);
      } else if (r < 0.86) {
        put('bush' + (rng() < 0.5 ? 0 : 1), px, y, pz, rng() * 6.28, 0.6 + rng() * 0.7, 0.75 + rng() * 0.4);
      } else if (r < 0.95) {
        const sc = 0.4 + rng() * 1.2;
        put('rock' + (rng() < 0.5 ? 0 : 1), px, y, pz, rng() * 6.28, sc, 0.8 + rng() * 0.3);
        if (sc > 0.8) this.addCircle(px, pz, sc * 0.85, 'rock');
      } else if (open < 0.5) {
        put('log0', px, y, pz, rng() * 6.28, 0.8 + rng() * 0.4, 0.9);
      }
    }
    // build instanced meshes per chunk
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3();
    const col = new THREE.Color();
    const treeKinds = ['pine0', 'pine1', 'pine2', 'spruce0', 'spruce1', 'dead0', 'dead1'];
    for (let cj = 0; cj < nC; cj++) {
      for (let ci = 0; ci < nC; ci++) {
        const b = buckets[cj * nC + ci];
        const near = new THREE.Group(), far = new THREE.Group(), under = new THREE.Group();
        const cx = -H + (ci + 0.5) * C, cz = -H + (cj + 0.5) * C;
        const farList = [];
        const make = (kind, list, geom, mat, group, shadow) => {
          const im = new THREE.InstancedMesh(geom, mat, list.length);
          list.forEach((it, idx) => {
            m4.compose(v.set(it[0], it[1], it[2]), q.setFromEuler(e.set(0, it[3], 0)), s.set(it[4], it[4] * (kind.startsWith('pine') ? 1.05 : 1), it[4]));
            im.setMatrixAt(idx, m4);
            col.setScalar(it[5]);
            im.setColorAt(idx, col);
          });
          im.castShadow = shadow;
          im.receiveShadow = false;
          im.computeBoundingSphere();
          group.add(im);
        };
        for (const k in b) {
          const list = b[k];
          if (treeKinds.includes(k)) {
            make(k, list, kinds[k], vcMatFlat, near, true);
            farList.push(...list);
          } else if (k === 'fern') make(k, list, kinds.fern, fernMat, under, false);
          else make(k, list, kinds[k], k.startsWith('rock') ? vcMatFlat : vcMat, under, k.startsWith('rock') || k.startsWith('log'));
        }
        if (farList.length) make('far', farList, kinds.far, vcMatFlat, far, false);
        near.visible = far.visible = under.visible = false;
        this.scene.add(near, far, under);
        this.chunks.push({ cx, cz, near, far, under });
      }
    }
  }

  /** Show / hide chunks by distance to the camera and swap tree LODs. */
  updateChunks(px, pz, viewDist, camera) {
    const lodDist = this.settings.quality === 'low' ? 70 : this.settings.quality === 'high' ? 140 : 100;
    const underDist = this.settings.quality === 'low' ? 45 : this.settings.quality === 'high' ? 95 : 70;
    const half = this.chunkSize * 0.72;
    for (const c of this.chunks) {
      const d = Math.max(0, Math.hypot(c.cx - px, c.cz - pz) - half);
      const inView = d < viewDist;
      c.near.visible = inView && d < lodDist;
      c.far.visible = inView && d >= lodDist;
      c.under.visible = d < underDist;
    }
  }

  // ---------------------------------------------------------- queries

  heightAt(x, z) {
    const N = this.gridN, s = WORLD.cell, H = WORLD.half;
    const fx = clamp((x + H) / s, 0, N - 1.001), fz = clamp((z + H) / s, 0, N - 1.001);
    const i = Math.floor(fx), j = Math.floor(fz);
    const u = fx - i, v = fz - j;
    const h = this.heights;
    const h00 = h[j * N + i], h10 = h[j * N + i + 1], h01 = h[(j + 1) * N + i], h11 = h[(j + 1) * N + i + 1];
    if (u + v <= 1) return h00 + (h10 - h00) * u + (h01 - h00) * v;
    return h11 + (h01 - h11) * (1 - u) + (h10 - h11) * (1 - v);
  }

  roadAt(x, z) {
    const N = this.gridN, s = WORLD.cell, H = WORLD.half;
    const i = clamp(Math.round((x + H) / s), 0, N - 1), j = clamp(Math.round((z + H) / s), 0, N - 1);
    return this.roadGrid[j * N + i];
  }

  /** Ground height for something standing at feetY: terrain or any walkable surface below the step limit. */
  groundAt(x, z, feetY = 1e9, step = 0.55) {
    let g = this.heightAt(x, z);
    let kind = null;
    for (const sf of this.surfaces) {
      const dx = x - sf.cx, dz = z - sf.cz;
      const lx = dx * sf.c + dz * sf.s, lz = -dx * sf.s + dz * sf.c;
      if (Math.abs(lx) <= sf.hx && Math.abs(lz) <= sf.hz && sf.top <= feetY + step && sf.top > g) { g = sf.top; kind = sf.kind; }
    }
    return { y: g, kind };
  }

  surfaceKind(x, z, onSurface) {
    if (onSurface) return onSurface;
    if (this.lakeEdge(x, z) > -3) return 'mud';
    const rd = this.roadAt(x, z);
    if (rd < 0.6) return 'gravel';
    return 'grass';
  }

  inWater(x, z) { return this.heightAt(x, z) < this.waterLevel - 0.05; }

  addCircle(x, z, r, kind) {
    const key = ((Math.floor(x / 8) + 100) << 8) | (Math.floor(z / 8) + 100);
    let a = this.circles.get(key);
    if (!a) this.circles.set(key, a = []);
    a.push({ x, z, r, kind });
  }

  circlesNear(x, z, out) {
    out.length = 0;
    const ci = Math.floor(x / 8), cj = Math.floor(z / 8);
    for (let j = cj - 1; j <= cj + 1; j++) {
      for (let i = ci - 1; i <= ci + 1; i++) {
        const a = this.circles.get(((i + 100) << 8) | (j + 100));
        if (a) for (const c of a) out.push(c);
      }
    }
    return out;
  }

  addBox(cx, cz, hx, hz, rot, y0, y1) {
    this.boxes.push({ cx, cz, hx, hz, c: Math.cos(rot), s: Math.sin(rot), y0, y1, br: Math.hypot(hx, hz) });
  }

  addSurface(cx, cz, hx, hz, rot, top, kind = 'wood') {
    this.surfaces.push({ cx, cz, hx, hz, c: Math.cos(rot), s: Math.sin(rot), top, kind });
  }

  /** Push a vertical cylinder (x,z,radius, feet..head) out of colliders. Mutates pos. */
  collide(pos, radius, feetY, headY) {
    const near = this.circlesNear(pos.x, pos.z, this._tmp || (this._tmp = []));
    for (const c of near) {
      const dx = pos.x - c.x, dz = pos.z - c.z;
      const d = Math.hypot(dx, dz), min = c.r + radius;
      if (d < min && d > 1e-5) {
        pos.x = c.x + (dx / d) * min;
        pos.z = c.z + (dz / d) * min;
      }
    }
    for (const b of this.boxes) {
      if (b.y1 <= feetY + 0.5 || b.y0 >= headY) continue;
      const dx = pos.x - b.cx, dz = pos.z - b.cz;
      if (dx * dx + dz * dz > (b.br + radius + 0.5) ** 2) continue;
      // into box space
      const lx = dx * b.c + dz * b.s, lz = -dx * b.s + dz * b.c;
      const qx = clamp(lx, -b.hx, b.hx), qz = clamp(lz, -b.hz, b.hz);
      let ox = lx - qx, oz = lz - qz;
      const d = Math.hypot(ox, oz);
      let nlx = lx, nlz = lz;
      if (d < radius) {
        if (d > 1e-5) {
          nlx = qx + (ox / d) * radius;
          nlz = qz + (oz / d) * radius;
        } else {
          // centre inside the box: push out along the shallowest axis
          const px = b.hx - Math.abs(lx), pz = b.hz - Math.abs(lz);
          if (px < pz) nlx = Math.sign(lx || 1) * (b.hx + radius);
          else nlz = Math.sign(lz || 1) * (b.hz + radius);
        }
        pos.x = b.cx + nlx * b.c - nlz * b.s;
        pos.z = b.cz + nlx * b.s + nlz * b.c;
      }
    }
    const L = WORLD.limit;
    pos.x = clamp(pos.x, -L, L);
    pos.z = clamp(pos.z, -L, L);
  }

  /**
   * Ray test against terrain, trees and boxes. Returns distance to first hit (or maxDist).
   * Cheap fixed-step march; good enough for bullets and line-of-sight.
   */
  raycast(ox, oy, oz, dx, dy, dz, maxDist, { trees = true, boxes = true, stepLen = 0.5 } = {}) {
    let best = maxDist;
    // boxes (analytic slab test in box space, ignoring rotation of y)
    if (boxes) {
      for (const b of this.boxes) {
        const rx = ox - b.cx, rz = oz - b.cz;
        const lox = rx * b.c + rz * b.s, loz = -rx * b.s + rz * b.c;
        const ldx = dx * b.c + dz * b.s, ldz = -dx * b.s + dz * b.c;
        let t0 = 0, t1 = best;
        const slab = (o, d, lo, hi) => {
          if (Math.abs(d) < 1e-8) return o >= lo && o <= hi;
          let a = (lo - o) / d, c = (hi - o) / d;
          if (a > c) { const t = a; a = c; c = t; }
          t0 = Math.max(t0, a); t1 = Math.min(t1, c);
          return t0 <= t1;
        };
        if (slab(lox, ldx, -b.hx, b.hx) && slab(loz, ldz, -b.hz, b.hz) && slab(oy, dy, b.y0, b.y1)) best = Math.min(best, t0);
      }
    }
    const tmp = this._rt || (this._rt = []);
    let lastKey = -1;
    for (let t = 0; t < best; t += stepLen) {
      const x = ox + dx * t, y = oy + dy * t, z = oz + dz * t;
      if (y < this.heightAt(x, z)) { best = Math.min(best, t); break; }
      if (trees) {
        const key = (Math.floor(x / 8) << 10) ^ Math.floor(z / 8);
        if (key !== lastKey) {
          lastKey = key;
          this.circlesNear(x, z, tmp);
          for (const c of tmp) {
            if (c.kind === 'rock' && y > this.heightAt(c.x, c.z) + c.r * 0.7) continue;
            // ray (xz) vs circle
            const fx = ox - c.x, fz = oz - c.z;
            const a = dx * dx + dz * dz;
            if (a < 1e-8) continue;
            const bq = 2 * (fx * dx + fz * dz);
            const cq = fx * fx + fz * fz - c.r * c.r;
            const disc = bq * bq - 4 * a * cq;
            if (disc < 0) continue;
            const th = (-bq - Math.sqrt(disc)) / (2 * a);
            if (th > 0 && th < best) {
              const hy = oy + dy * th;
              if (c.kind === 'tree' && hy > this.heightAt(c.x, c.z) + 14) continue;
              best = th;
            }
          }
        }
      }
    }
    return best;
  }

  lineOfSight(ax, ay, az, bx, by, bz) {
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const d = Math.hypot(dx, dy, dz);
    if (d < 0.01) return true;
    return this.raycast(ax, ay, az, dx / d, dy / d, dz / d, d, { stepLen: 1.5 }) >= d - 0.6;
  }

  /** Random walkable point in the forest away from water & landmarks. */
  randomForestPoint(rng, nearX = 0, nearZ = 0, minR = 0, maxR = 400) {
    for (let i = 0; i < 40; i++) {
      const a = rng() * Math.PI * 2;
      const r = minR + rng() * (maxR - minR);
      const x = nearX + Math.cos(a) * r, z = nearZ + Math.sin(a) * r;
      if (Math.abs(x) > WORLD.limit - 15 || Math.abs(z) > WORLD.limit - 15) continue;
      if (this.lakeEdge(x, z) > -4) continue;
      return { x, z, y: this.heightAt(x, z) };
    }
    return { x: nearX, z: nearZ, y: this.heightAt(nearX, nearZ) };
  }

  update(dt, t) {
    if (this.waterTex) { this.waterTex.offset.x = t * 0.004; this.waterTex.offset.y = t * 0.002; }
  }
}
