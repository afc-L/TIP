// MAP 2 — BLACKPINE FOREST. Hills, trails, a lake, cabins, campsites, deep fog.
import * as THREE from 'three';
import { plantTrees, plantBushes, plantGrass, rock, car, Frame, gableGeo, table, bed, chair, shelf, lamp } from './props.js';
import { fbm, mulberry32, clamp, lerp, smooth } from '../core/util.js';
import { tex } from '../core/textures.js';

const SIZE = 230;
const LAKE = { x: 70, z: -50, r: 48 };
const WATER_Y = 0.0;

export function buildForest(game, b) {
  const R = mulberry32(2002); const rr = (a, c) => a + R() * (c - a);
  b.defaultSurface = 'leaves';
  // ---------------- trails (polylines) ----------------
  const trails = [
    [[-200, 10], [-150, 0], [-100, 20], [-60, 15], [-20, 30], [10, 20], [30, -5], [40, -20]], // main trail to the lake
    [[-20, 30], [-30, 70], [-10, 110], [30, 140], [80, 150]], // north trail
    [[10, 20], [60, 40], [110, 30], [150, 0], [200, -10]], // east trail
    [[-100, 20], [-120, -40], [-90, -100], [-40, -130], [10, -150]], // south loop
    [[40, -20], [20, -60], [10, -110], [10, -150]], // lake west shore down south
    [[110, 30], [125, -30], [125, -90], [80, -110], [40, -105]], // east lake shore
  ];
  const segs = [];
  for (const t of trails) for (let i = 1; i < t.length; i++) segs.push([t[i - 1], t[i]]);
  const distToTrail = (x, z) => {
    let best = 1e9;
    for (const [a, c] of segs) {
      const dx = c[0] - a[0], dz = c[1] - a[1]; const l2 = dx * dx + dz * dz;
      const t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / l2, 0, 1);
      const d = Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t); if (d < best) best = d;
    }
    return best;
  };
  // flattened clearings
  const clearings = [
    { x: -20, z: 30, r: 16 }, // trailhead / campsite (occupied)
    { x: 32, z: 132, r: 14 }, // abandoned camp
    { x: -130, z: -45, r: 14 }, // ranger station
    { x: 150, z: 8, r: 12 }, // old cabin east
    { x: -60, z: -120, r: 12 }, // logging site
    { x: -150, z: 90, r: 12 }, // cabin NW
    { x: 120, z: 120, r: 14 }, // stone ring + old oak
  ];
  // ---------------- terrain ----------------
  const base = (x, z) => (fbm(x * 0.008 + 3, z * 0.008 - 7, 4) - 0.45) * 30 + (fbm(x * 0.03, z * 0.03, 3) - 0.5) * 4;
  const height = (x, z) => {
    let h = base(x, z) + 3;
    // lake bowl
    const dl = Math.hypot(x - LAKE.x, z - LAKE.z) / LAKE.r;
    if (dl < 1.6) { const k = smooth(clamp((1.6 - dl) / 0.75, 0, 1)); h = lerp(h, -1.6 + dl * 1.2, k); }
    // creek running into the lake from the north-east
    const cz = 60 + Math.sin(x * 0.03) * 15;
    if (x > 60) { const dc = Math.abs(z - cz); if (dc < 9) h = lerp(h, Math.min(h, -0.6), smooth(1 - dc / 9)); }
    // trails and clearings are smoothed toward a gentle base
    const dt = distToTrail(x, z);
    if (dt < 6) h = lerp(h, base(x, z) * 0.6 + 3, smooth(1 - dt / 6) * 0.6);
    for (const c of clearings) { const d = Math.hypot(x - c.x, z - c.z); if (d < c.r * 1.4) h = lerp(h, c.h ?? (c.h = base(c.x, c.z) * 0.6 + 3), smooth(clamp((c.r * 1.4 - d) / (c.r * 0.6), 0, 1))); }
    return h;
  };
  // cache heights on a grid for speed (collision queries are frequent)
  const G = 2, N = Math.ceil((SIZE * 2 + 40) / G) + 1, OFF = SIZE + 20;
  const hgrid = new Float32Array(N * N);
  for (let iz = 0; iz < N; iz++) for (let ix = 0; ix < N; ix++) hgrid[iz * N + ix] = height(ix * G - OFF, iz * G - OFF);
  const terrain = (x, z) => {
    const fx = (x + OFF) / G, fz = (z + OFF) / G; const ix = clamp(Math.floor(fx), 0, N - 2), iz = clamp(Math.floor(fz), 0, N - 2);
    const tx = clamp(fx - ix, 0, 1), tz = clamp(fz - iz, 0, 1);
    const a = hgrid[iz * N + ix], c = hgrid[iz * N + ix + 1], d = hgrid[(iz + 1) * N + ix], e = hgrid[(iz + 1) * N + ix + 1];
    // match the triangulation of PlaneGeometry roughly with bilinear
    return lerp(lerp(a, c, tx), lerp(d, e, tx), tz);
  };
  // the lake floor is wadeable: the monster stands no deeper than ~1.4 m
  b.world.terrain = (x, z) => Math.max(terrain(x, z), WATER_Y - 1.4);
  b.world.hasTerrain = true;
  // terrain mesh with vertex colours (trails darker / muddier)
  {
    const S = SIZE * 2 + 40, seg = b.quality.drawDist > 200 ? 200 : 140;
    const g = new THREE.PlaneGeometry(S, S, seg, seg); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position; const col = new Float32Array(p.count * 3); const uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i); const y = terrain(x, z); p.setY(i, y);
      const dt = distToTrail(x, z); const trail = smooth(clamp(1 - dt / 3.5, 0, 1));
      const wet = y < 0.4 ? 1 : 0; const n = fbm(x * 0.05, z * 0.05, 2);
      col[i * 3] = lerp(0.85 + n * 0.3, 1.15, trail) * (wet ? 0.6 : 1); col[i * 3 + 1] = lerp(0.9 + n * 0.25, 0.95, trail) * (wet ? 0.65 : 1); col[i * 3 + 2] = lerp(0.8, 0.8, trail) * (wet ? 0.6 : 1);
      uv.setXY(i, x / 5, z / 5);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    const t = tex('forestFloor', 1);
    const m = new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, vertexColors: true, roughness: 0.95 });
    const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true; b.root.add(mesh);
  }
  // water
  const waterT = tex('water', 1, { unique: true });
  waterT.normalMap.repeat.set(40, 40);
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x0b1418, roughness: 0.08, metalness: 0.3, normalMap: waterT.normalMap, normalScale: new THREE.Vector2(0.4, 0.4), envMapIntensity: 1.6, transparent: true, opacity: 0.92 });
  { const g = new THREE.CircleGeometry(LAKE.r * 1.7, 64); g.rotateX(-Math.PI / 2); g.translate(LAKE.x, WATER_Y, LAKE.z); const w = new THREE.Mesh(g, waterMat); b.root.add(w); }
  { const g = new THREE.PlaneGeometry(200, 22); g.rotateX(-Math.PI / 2); const w = new THREE.Mesh(g, waterMat); w.position.set(160, WATER_Y - 0.2, 60); b.root.add(w); }
  b.surfaceFn = (p) => (terrain(p.x, p.z) < WATER_Y - 0.05 ? 'water' : distToTrail(p.x, p.z) < 2.5 ? 'dirt' : 'leaves');

  // ---------------- nav: trails ----------------
  const trailNodes = [];
  const nodeAt = (x, z, tags = []) => b.node(x, z, terrain(x, z), tags);
  for (const t of trails) {
    let prev = null;
    for (let i = 1; i < t.length; i++) {
      const [a, c] = [t[i - 1], t[i]]; const L = Math.hypot(c[0] - a[0], c[1] - a[1]); const n = Math.max(1, Math.round(L / 10));
      for (let k = (i === 1 ? 0 : 1); k <= n; k++) {
        const x = a[0] + (c[0] - a[0]) * k / n, z = a[1] + (c[1] - a[1]) * k / n;
        let node = trailNodes.find((q) => Math.hypot(q.pos.x - x, q.pos.z - z) < 3);
        if (!node) { node = nodeAt(x, z, ['activity']); trailNodes.push(node); }
        if (prev) b.link(prev, node); prev = node;
      }
    }
  }
  // exits at trail ends at the map edge
  for (const t of trails) for (const end of [t[0], t[t.length - 1]]) if (Math.abs(end[0]) > 180 || Math.abs(end[1]) > 140) { const n = trailNodes.find((q) => Math.hypot(q.pos.x - end[0], q.pos.z - end[1]) < 3); if (n) { n.tags.add('exit'); n.tags.add('spawn'); } }
  const nearestTrail = (x, z) => trailNodes.reduce((a, n) => (Math.hypot(n.pos.x - x, n.pos.z - z) < Math.hypot(a.pos.x - x, a.pos.z - z) ? n : a), trailNodes[0]);
  // off-trail grid so people can scatter into the woods
  const offNodes = [];
  for (let x = -200; x <= 200; x += 22) for (let z = -170; z <= 170; z += 22) {
    const px = x + rr(-6, 6), pz = z + rr(-6, 6);
    if (Math.hypot(px - LAKE.x, pz - LAKE.z) < LAKE.r * 1.15) continue;
    if (terrain(px, pz) < 0.3) continue;
    const n = nodeAt(px, pz, R() < 0.35 ? ['hide'] : []); offNodes.push(n);
  }
  for (const n of offNodes) {
    for (const o of offNodes) if (o !== n && n.pos.distanceTo(o.pos) < 33 && Math.abs(n.pos.y - o.pos.y) < 6) b.link(n, o);
    const t = nearestTrail(n.pos.x, n.pos.z); if (t.pos.distanceTo(n.pos) < 30) b.link(n, t);
  }
  const clearingNodes = {};

  // ---------------- structures ----------------
  const cabin = (cx, cz, rot, opts = {}) => {
    const y = terrain(cx, cz) - 0.1;
    const f = new Frame(b, cx, cz, rot, y);
    const W = opts.w || 7, D = opts.d || 6, H = 2.6;
    f.box(0, 0.25, 0, W + 0.6, 0.5, D + 0.6, 'darkWood', { surface: 'wood' });
    f.wall(-W / 2, D / 2, W / 2, D / 2, 0.5, H, 0.2, 'wood', [{ at: W / 2 - 1, w: 1.0, y0: 0, y1: 2.05 }, { at: W - 1.5, w: 1.0, y0: 0.9, y1: 1.8 }]);
    f.wall(-W / 2, -D / 2, W / 2, -D / 2, 0.5, H, 0.2, 'wood', [{ at: W / 2, w: 1.0, y0: 0.9, y1: 1.8 }]);
    f.wall(-W / 2, -D / 2, -W / 2, D / 2, 0.5, H, 0.2, 'wood', [{ at: D / 2, w: 1.0, y0: 0.9, y1: 1.8 }]);
    f.wall(W / 2, -D / 2, W / 2, D / 2, 0.5, H, 0.2, 'wood', []);
    f.box(0, H + 0.55, 0, W, 0.1, D, 'darkWood', { surface: 'wood' });
    const rg = gableGeo(W, D, 1.8, 0.5); f.geo(rg, 'roof', 0, H + 0.6, 0, 0);
    f.collider(0, H + 1.3, 0, W, 1.4, D * 0.6, { surface: 'wood' });
    f.window(W / 2 - 1.5, 1.85, D / 2 + 0.11, 0.9, 0.85, 0, 1, !!opts.lit, { color: 0xffb060 });
    f.window(0, 1.85, -D / 2 - 0.11, 0.9, 0.85, 0, -1, !!opts.lit, { color: 0xffb060 });
    const door = f.door(-1 + 0, 0.5, D / 2, 1.0, 2.05, 'x', 'darkWood', { locked: !!opts.locked });
    // interior
    bed(f, W / 2 - 1, -D / 2 + 1.3, 0, 'fabricGreen'); table(f, -W / 2 + 1.4, -D / 2 + 1.3, 1.2, 0.8, 0.75 + 0.5, 'wood', false);
    f.box(-W / 2 + 0.6, 0.5 + 0.6, 1.3, 0.8, 1.2, 0.7, 'blackMetal'); // stove
    shelf(new Frame(b, ...f.p(0, -D / 2 + 0.3), rot, y + 0.5), 0, 0, 0, 1.6);
    const out = f.node(-1, D / 2 + 2, 0.4, ['activity']); const dn = f.node(-1, D / 2, 0.5, ['indoor']); dn.door = door;
    const inN = f.node(-1, 0.5, 0.5, ['indoor', 'hide']); const in2 = f.node(W / 2 - 1.5, 0.2, 0.5, ['indoor', 'hide']);
    b.chain([out, dn, inN, in2]);
    b.link(out, nearestTrail(out.pos.x, out.pos.z));
    if (opts.lit) b.light(...(() => { const v = f.v(0, 2.3, 0); return [v.x, v.y, v.z]; })(), 0xffb060, 5, 8, { flicker: 0.15, glowSize: 0.4 });
    b.anchors.indoor.push({ pos: f.v(0, 1.4, 0) });
    return { f, door, inN, y };
  };
  const ranger = cabin(-130, -45, 1, { w: 9, d: 7, lit: true });
  const cabinE = cabin(150, 8, 3, { lit: false, locked: true });
  const cabinNW = cabin(-150, 90, 0, { lit: false });
  // ranger desk with radio + tape
  { const f = ranger.f; f.box(2.5, 0.5 + 0.38, 2.2, 1.6, 0.76, 0.7, 'wood', { surface: 'wood' }); const p = f.v(2.5, 0.5 + 0.8, 2.2); b.item('recording', 'for_ranger', p.x, p.y, p.z, f.yaw(0)); const p2 = f.v(1.6, 0.5 + 0.8, 2.3); b.item('note', 'for_band', p2.x, p2.y, p2.z, 0, { flat: true }); }
  b.emitters.push({ pos: ranger.f.v(2.5, 1.4, 2.2), sound: 'static', interval: [6, 14], vol: 0.12, opts: { dur: 1.2 } });

  // campsite with campers (trailhead clearing)
  const tent = (x, z, rot, mat = 'tarp', torn = false) => {
    const y = terrain(x, z);
    const g = new THREE.CylinderGeometry(0.01, 1.6, 1.6, 4, 1, true); g.rotateY(Math.PI / 4); g.scale(1, 1, 1.4); g.rotateY(rot); g.translate(x, y + 0.8, z);
    b.geo(g, mat); b.world.addCircle(x, z, 1.2, y, y + 1.5, { surface: 'cloth' });
    if (torn) { const g2 = new THREE.PlaneGeometry(1.2, 0.8); g2.rotateX(-1.2); g2.rotateY(rot); g2.translate(x + 1.5, y + 0.2, z); b.geo(g2, mat); }
    const n = b.node(x + Math.sin(rot) * 2.2, z + Math.cos(rot) * 2.2, y, ['hide']); return n;
  };
  const camp = { x: -20, z: 30 };
  const cy = terrain(camp.x, camp.z);
  const campNodes = [tent(-26, 34, 0.4, 'tarp'), tent(-14, 37, -0.6, 'fabricRed'), tent(-24, 22, 2.6, 'fabricGreen')];
  // fire
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; rock(b, camp.x + Math.cos(a) * 0.9, camp.z + Math.sin(a) * 0.9, 0.22, cy); }
  const fireLight = b.light(camp.x, cy + 0.8, camp.z, 0xff7a30, 14, 14, { flicker: 0.3, glowSize: 1.2, abandon: false });
  for (const [x, z, r] of [[-17, 30, 0], [-20, 33.5, Math.PI / 2], [-23, 30, 0]]) { b.cyl(x, cy, z, 0.22, 0.22, 1.8, 'bark', { rotZ: Math.PI / 2, rotX: 0 }); const sn = b.node(x, z + 0.6, cy, ['activity']); sn.activity = 'sit'; sn.faceYaw = Math.atan2(camp.x - x, camp.z - z); campNodes.push(sn); }
  campNodes.forEach((n) => b.link(n, nearestTrail(n.pos.x, n.pos.z)));
  b.emitters.push({ pos: new THREE.Vector3(camp.x, cy + 0.5, camp.z), sound: 'crackle', interval: [0.3, 1.2], vol: 0.6 });
  car(b, -45, 12, 0.3, 'carPaintGreen', { y: terrain(-45, 12) });

  // abandoned camp (objective 1)
  const acamp = { x: 32, z: 132 }; const ay = terrain(acamp.x, acamp.z);
  tent(28, 136, 0.3, 'tarp', true); tent(37, 128, 1.9, 'fabricBlue', true); tent(26, 126, -2.2, 'fabricRed', true);
  for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; rock(b, acamp.x + Math.cos(a) * 0.9, acamp.z + Math.sin(a) * 0.9, 0.2, ay); }
  { const p = new THREE.Vector3(30, ay + 0.15, 131); b.item('note', 'for_journal', p.x, p.y + 0.02, p.z, 0.4, { flat: true }); }
  // Ben's flashlight, still on, pointing at the trees
  const flash = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.25, 8), b.m('blackMetal')); flash.rotation.z = Math.PI / 2; flash.position.set(44, terrain(44, 120) + 0.05, 120); b.root.add(flash);
  b.light(46, terrain(46, 120) + 0.4, 120, 0xfff0d0, 6, 12, { glowSize: 0.8, flicker: 0.02 });
  b.anchors.treeGap.push({ pos: new THREE.Vector3(52, terrain(52, 118), 118) });

  // stone rings + old oak with the symbol
  const ring = (x, z, r, n) => { const y = terrain(x, z); for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; rock(b, x + Math.cos(a) * r, z + Math.sin(a) * r, rr(0.4, 0.7), y); } b.anchors.impossible.push({ pos: new THREE.Vector3(x, y, z) }); };
  ring(120, 120, 5, 9); ring(-160, -110, 4, 7); ring(-70, 140, 4.5, 8);
  plantTrees(b, [{ x: 112, z: 128, y: terrain(112, 128), s: 2.4, rot: 0.3, type: 'oak' }]);
  b.item('symbol', 'sym_2', 112, terrain(112, 128) + 2.0, 128 - 0.85, Math.PI);
  // trail camera + photo
  b.box(-60, terrain(-60, 21) + 1.6, 21.5, 0.12, 0.18, 0.1, 'paintedMetal', { collide: false });
  b.item('note', 'for_photo', -59.6, terrain(-59.6, 21.6) + 1.2, 21.7, 0);

  // logging site: rusted truck, logs, barrels
  const lg = { x: -60, z: -120 }; const ly = terrain(lg.x, lg.z);
  car(b, lg.x + 4, lg.z, 1.2, 'rust', { y: ly });
  for (let i = 0; i < 6; i++) b.cyl(lg.x - 6 + (i % 3) * 0.7, ly + Math.floor(i / 3) * 0.6, lg.z + 5, 0.32, 0.32, 7, 'bark', { rotX: Math.PI / 2, collide: false, seg: 8 });
  b.world.box(lg.x - 5.3, ly + 0.6, lg.z + 5, 2.4, 1.2, 7, { surface: 'wood' });
  for (let i = 0; i < 5; i++) b.cyl(lg.x + rr(-8, 8), ly, lg.z + rr(-8, -3), 0.3, 0.3, 0.9, i % 2 ? 'rust' : 'redMetal', { collide: true, seg: 10 });
  const logN = b.node(lg.x, lg.z - 2, ly, ['hide', 'activity']); b.link(logN, nearestTrail(lg.x, lg.z));

  // dock out onto the lake (rift at the end)
  const dock = { x: 40, z: -30 };
  const dockDir = new THREE.Vector3(LAKE.x - dock.x, 0, LAKE.z - dock.z).normalize();
  const dockYaw = Math.atan2(dockDir.x, dockDir.z);
  const dockLen = 30;
  for (let i = 0; i < dockLen; i += 1.5) {
    const x = dock.x + dockDir.x * i, z = dock.z + dockDir.z * i;
    const g = new THREE.BoxGeometry(2.4, 0.12, 1.4); g.rotateY(dockYaw); g.translate(x, WATER_Y + 0.5, z); b.geo(g, 'wood');
    if (i % 4.5 < 1.5) for (const s of [-1, 1]) b.cyl(x + Math.cos(dockYaw) * s * 1.1, -2, z - Math.sin(dockYaw) * s * 1.1, 0.1, 0.1, 2.6, 'darkWood', { seg: 6 });
    b.world.box(x, WATER_Y + 0.25, z, 1.8, 0.5, 1.8, { surface: 'wood', climbable: false });
  }
  const dockEnd = new THREE.Vector3(dock.x + dockDir.x * (dockLen - 1), WATER_Y + 0.56, dock.z + dockDir.z * (dockLen - 1));
  { const it = b.item('rift', 'rift_2', dockEnd.x, dockEnd.y, dockEnd.z, dockYaw); it.mesh.visible = false; it.hidden = true; }
  b.anchors.impossible.push({ pos: new THREE.Vector3(LAKE.x + 10, WATER_Y, LAKE.z + 5) }, { pos: new THREE.Vector3(LAKE.x - 5, WATER_Y, LAKE.z - 15) });
  const dockN = b.node(dock.x - dockDir.x * 2, dock.z - dockDir.z * 2, terrain(dock.x - dockDir.x * 2, dock.z - dockDir.z * 2), ['activity']); dockN.activity = 'look'; b.link(dockN, nearestTrail(dock.x, dock.z));
  b.loopsPositional = [{ name: 'water#lake', pos: new THREE.Vector3(dock.x, 0.5, dock.z), gain: 0.5 }];

  // wooden bridge over the creek on the east trail
  { const bx = 110, z0 = 40, z1 = 82; for (let z = z0; z < z1; z += 1) { b.box(bx, 1.4, z, 2.4, 0.12, 0.95, 'wood', { collide: false }); } b.world.box(bx, 1.2, (z0 + z1) / 2, 2.4, 0.5, z1 - z0, { surface: 'wood', climbable: false }); for (const s of [-1.15, 1.15]) b.box(bx + s, 2.0, (z0 + z1) / 2, 0.08, 0.08, z1 - z0, 'darkWood', { collide: false }); const un = b.node(bx + 4, 55, terrain(bx + 4, 55), ['hide']); b.link(un, nearestTrail(bx, 30)); }

  // ---------------- vegetation ----------------
  const trees = [];
  const blocked = (x, z, pad = 0) => {
    if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r * 1.12 + pad) return true;
    if (terrain(x, z) < 0.2) return true;
    if (distToTrail(x, z) < 3.2 + pad) return true;
    for (const c of clearings) if (Math.hypot(x - c.x, z - c.z) < c.r + pad) return true;
    if (Math.abs(x - 110) < 4 && z > 35 && z < 87) return true;
    return false;
  };
  const target = b.quality.drawDist > 200 ? 2600 : 1700;
  let tries = 0;
  while (trees.length < target && tries++ < target * 6) {
    const x = rr(-SIZE - 15, SIZE + 15), z = rr(-SIZE * 0.8 - 15, SIZE * 0.8 + 15);
    if (blocked(x, z)) continue;
    const dense = fbm(x * 0.02 + 9, z * 0.02, 2);
    if (R() > dense * 1.6) continue;
    const t = R(); trees.push({ x, z, y: terrain(x, z) - 0.2, s: rr(0.9, 1.6), rot: R() * 6, type: t < 0.72 ? 'pine' : t < 0.92 ? 'oak' : 'dead' });
  }
  plantTrees(b, trees);
  trees.forEach((t, i) => { if (i % 9 === 0) b.anchors.treeGap.push({ pos: new THREE.Vector3(t.x + 1.5, t.y + 0.2, t.z + 0.5) }); });
  const bushes = []; for (let i = 0; i < 700; i++) { const x = rr(-SIZE, SIZE), z = rr(-SIZE * 0.8, SIZE * 0.8); if (blocked(x, z, -1)) continue; bushes.push({ x, z, y: terrain(x, z), s: rr(0.8, 1.5), rot: R() * 6 }); } plantBushes(b, bushes);
  for (let i = 0; i < 90; i++) { const x = rr(-SIZE, SIZE), z = rr(-SIZE * 0.8, SIZE * 0.8); if (blocked(x, z, 1)) continue; rock(b, x, z, rr(0.6, 2.2), terrain(x, z) - 0.3); }
  // fallen logs
  for (let i = 0; i < 40; i++) { const x = rr(-SIZE, SIZE), z = rr(-SIZE * 0.8, SIZE * 0.8); if (blocked(x, z, 2)) continue; const y = terrain(x, z); const a = R() * Math.PI; const g = new THREE.CylinderGeometry(0.3, 0.38, 6, 8); g.rotateZ(Math.PI / 2); g.rotateY(a); g.translate(x, y + 0.25, z); b.geo(g, 'bark'); for (let k = -2; k <= 2; k++) b.world.addCircle(x + Math.cos(a) * k * 1.2, z - Math.sin(a) * k * 1.2, 0.4, y - 0.5, y + 0.6, { surface: 'wood' }); }
  const tufts = []; for (let i = 0; i < 2600; i++) { const x = rr(-SIZE, SIZE), z = rr(-SIZE * 0.8, SIZE * 0.8); if (terrain(x, z) < 0.3) continue; tufts.push({ x, z, y: terrain(x, z) }); } plantGrass(b, tufts, b.quality);
  for (const [x, z] of [[-210, 0], [210, 30], [0, -175], [-40, 175], [180, -150], [-180, 150]]) b.anchors.far.push({ pos: new THREE.Vector3(x, terrain(x, z), z) });

  // spawn: the road at the west trailhead
  b.spawns.player.set(-196, terrain(-196, 8), 8); b.spawns.playerYaw = Math.PI / 2;
  b.ground(-230, 2, -150, 14, 'asphalt', 'asphalt', terrain(-200, 8) - 0.15, 4); // old access road end

  // ---------------- population ----------------
  const initial = [];
  const campers = [[-22, 30], [-18, 31], [-20, 27.5], [-25, 30]];
  campers.forEach(([x, z], i) => initial.push({ pos: new THREE.Vector3(x, cy, z), outfit: 'hiker', home: new THREE.Vector3(camp.x, cy, camp.z), roam: 25, activity: i < 2 ? 'sit' : 'stand', flashlight: i % 2 === 0 }));
  for (let i = 0; i < 9; i++) { const n = trailNodes[Math.floor(R() * trailNodes.length)]; initial.push({ pos: n.pos.clone(), outfit: R() < 0.7 ? 'hiker' : 'explorer', home: n.pos.clone(), roam: 80, flashlight: R() < 0.75 }); }
  initial.push({ pos: ranger.inN.pos.clone(), outfit: 'guard', role: 'guard', personality: 'brave', home: ranger.inN.pos.clone(), roam: 40, flashlight: true });

  const lakeRefs = { camp: new THREE.Vector3(acamp.x, ay, acamp.z), cabin: ranger.inN.pos.clone(), dockEnd };
  b.anomalies = [
    { pos: new THREE.Vector3(camp.x, cy + 1, camp.z), apply: () => { fireLight.base = fireLight.intensity; fireLight.intensity = 0; }, revert: () => { fireLight.intensity = fireLight.base || 14; } },
    { pos: ranger.f.v(0, 1.8, 3.6), apply: () => { ranger.door.locked = false; if (!ranger.door.open) ranger.door.target = 1.3; }, revert: () => { if (!ranger.door.open) ranger.door.target = 0; } },
  ];
  let waterOff = 0;
  return {
    kind: 'forest', name: 'Blackpine', chapter: 2,
    env: {
      sky: { top: '#020405', horizon: '#0e1612', stars: 0.35, tint: 'rgba(20,30,25,0.4)' }, fogColor: 0x10161a, fogDensity: 0.022,
      ambient: { sky: 0x6a7a80, ground: 0x1a1c14, intensity: 2.2 }, moon: { color: 0xa8bcd0, intensity: 1.6, dir: [-0.4, 1, 0.5] },
      exposure: 1.2, grade: { tint: [0.92, 1.02, 0.98], lift: [0.006, 0.01, 0.009], desat: 0.32 }, wind: 1.4, fogBanks: 1.6, fogColor2: 0x5a6a64, fogBankAlpha: 1.2, motes: true, moteColor: 0x9a9a80, reverb: [3.2, 2.5], reverbMix: 0.4, visibility: 0.2,
      dusk: { duration: 360, sky: 2.5, fogColor: 0x2a2a2a, sunColor: 0xd08050, light: 0.6 }, rainLater: 420,
    },
    loops: [['wind', 0.45], ['crickets', 0.12], ['drone', 0.1]],
    emitters: b.emitters, terrain,
    bounds: { minX: -SIZE, maxX: SIZE, minZ: -SIZE * 0.8, maxZ: SIZE * 0.8 },
    populationDef: { initial, max: 15, respawnMin: 40, respawnMax: 90 },
    randomNPCDef: (pos) => ({ pos, outfit: R() < 0.6 ? 'hiker' : 'explorer', home: pos.clone(), roam: 80, flashlight: R() < 0.8 }),
    searcherOutfit: 'searcher', allowCalls: true, npcsCanLeave: true,
    ambientEvents: [
      { every: [25, 60], fn: (g) => g.audio.play('owl', g.monster.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 120, 12, (Math.random() - 0.5) * 120)), { vol: 0.45 }) },
      { every: [40, 100], fn: (g) => g.audio.play('howl', g.monster.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 300, 10, (Math.random() - 0.5) * 300)), { vol: 0.35 }) },
      { every: [20, 50], fn: (g) => g.audio.play('crow', g.monster.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 80, 14, (Math.random() - 0.5) * 80)), { vol: 0.35 }) },
      { every: [15, 40], fn: (g) => g.audio.play('branch', g.monster.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 50, 1, (Math.random() - 0.5) * 50)), { vol: 0.5 }) },
    ],
    update: (dt, t) => {
      waterOff += dt * 0.01; waterT.normalMap.offset.set(waterOff, waterOff * 0.7);
      if (Math.random() < dt * 8) game.fx.embers(new THREE.Vector3(camp.x, cy + 0.4, camp.z));
      if (Math.random() < dt * 3) game.fx.campSmoke(new THREE.Vector3(camp.x, cy + 0.3, camp.z));
    },
    refs: { ...lakeRefs, rift: dockEnd },
  };
}
