// MAP 1 — ASHGROVE LANE. A foggy suburb at night. Starts almost normal.
import * as THREE from 'three';
import { house, car, streetLight, fence, bench, trashCan, hydrant, mailbox, plantTrees, plantBushes, plantGrass, Frame, gableGeo, couch, table, bed, shelf, chair, wardrobe, mirror } from './props.js';
import { rand, pick, chance, mulberry32 } from '../core/util.js';
import { textTexture, paperTexture } from '../core/textures.js';

export function buildSuburb(game, b) {
  const R = mulberry32(1001);
  const rr = (a, c) => a + R() * (c - a);
  b.defaultSurface = 'grass';
  const BX = 130, BZ0 = -110, BZ1 = 105;
  // ---------------- ground ----------------
  // lawn everywhere except over the basement of 13 Ashgrove (x -46..-34, z 83..93)
  b.ground(-BX - 40, BZ0 - 40, BX + 40, 83, 'grass', 'grass', 0, 6);
  b.ground(-BX - 40, 93, BX + 40, BZ1 + 40, 'grass', 'grass', 0, 6);
  b.ground(-BX - 40, 83, -46, 93, 'grass', 'grass', 0, 6);
  b.ground(-34, 83, BX + 40, 93, 'grass', 'grass', 0, 6);
  const roads = [
    { x0: -BX - 40, z0: -4.5, x1: BX + 40, z1: 4.5 }, // Ashgrove Lane (E-W)
    { x0: -BX - 40, z0: -74.5, x1: BX + 40, z1: -65.5 }, // Birch St
    { x0: -44.5, z0: BZ0 - 40, x1: -35.5, z1: 62 }, // Willow Rd (N-S) to cul-de-sac
    { x0: 45.5, z0: BZ0 - 40, x1: 54.5, z1: 4.5 }, // Elm Rd
  ];
  for (const r of roads) b.ground(r.x0, r.z0, r.x1, r.z1, 'asphalt', 'asphalt', 0.012, 5);
  // cul-de-sac
  { const g = new THREE.CircleGeometry(11, 24); g.rotateX(-Math.PI / 2); g.translate(-40, 0.013, 64); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 4, uv.getY(i) * 4); b.geo(g, 'asphalt', { cast: false }); b.region(-51, 53, -29, 75, 'asphalt'); }
  // road markings
  for (let x = -BX; x < BX; x += 6) b.box(x, 0.016, 0, 2.6, 0.01, 0.15, 'paint', { collide: false, cast: false });
  // sidewalks (raised curbs) along roads
  const sidewalk = (x0, z0, x1, z1) => b.box((x0 + x1) / 2, 0.06, (z0 + z1) / 2, Math.abs(x1 - x0), 0.12, Math.abs(z1 - z0), 'sidewalk', { surface: 'concrete', cast: false, tex: 2, climbable: false });
  const gapsX = [[-46, -34], [44, 56]];
  const swRow = (z0, z1) => { let cur = -BX - 10; for (const [a, c] of gapsX) { sidewalk(cur, z0, a, z1); cur = c; } sidewalk(cur, z0, BX + 10, z1); };
  swRow(4.5, 7); swRow(-7, -4.5); swRow(-65.5, -63); swRow(-77, -74.5);
  sidewalk(-47, -63, -44.5, -7); sidewalk(-35.5, -63, -33, -7); sidewalk(-47, 7, -44.5, 52); sidewalk(-35.5, 7, -33, 52);
  sidewalk(43, -63, 45.5, -7); sidewalk(54.5, -63, 57, -7);
  sidewalk(-47, -105, -44.5, -77); sidewalk(-35.5, -105, -33, -77); sidewalk(43, -105, 45.5, -77); sidewalk(54.5, -105, 57, -77);

  // ---------------- nav: sidewalk network ----------------
  const sw = {}; // key -> node
  const swNode = (x, z) => { const k = Math.round(x) + ',' + Math.round(z); if (!sw[k]) sw[k] = b.node(x, z, 0.12, ['activity']); return sw[k]; };
  const lineNodes = (x0, z0, x1, z1, step = 11) => { const n = Math.max(1, Math.round(Math.hypot(x1 - x0, z1 - z0) / step)); const out = []; for (let i = 0; i <= n; i++) out.push(swNode(x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n)); b.chain(out); return out; };
  const rows = {};
  rows.lnN = lineNodes(-125, 5.8, 125, 5.8); rows.lnS = lineNodes(-125, -5.8, 125, -5.8);
  rows.bN = lineNodes(-125, -64.2, 125, -64.2); rows.bS = lineNodes(-125, -75.8, 125, -75.8);
  rows.wW = lineNodes(-45.8, -64.2, -45.8, -5.8); rows.wE = lineNodes(-34.2, -64.2, -34.2, -5.8);
  rows.wW2 = lineNodes(-45.8, 5.8, -45.8, 52); rows.wE2 = lineNodes(-34.2, 5.8, -34.2, 52);
  rows.eW = lineNodes(44.2, -64.2, 44.2, -5.8); rows.eE = lineNodes(55.8, -64.2, 55.8, -5.8);
  rows.wWs = lineNodes(-45.8, -104, -45.8, -75.8); rows.wEs = lineNodes(-34.2, -104, -34.2, -75.8);
  rows.eWs = lineNodes(44.2, -104, 44.2, -75.8); rows.eEs = lineNodes(55.8, -104, 55.8, -75.8);
  // crossings: link nodes across roads at intervals
  const nearestIn = (list, x, z) => list.reduce((a, n) => (Math.hypot(n.pos.x - x, n.pos.z - z) < Math.hypot(a.pos.x - x, a.pos.z - z) ? n : a), list[0]);
  for (let x = -120; x <= 120; x += 30) { b.link(nearestIn(rows.lnN, x, 5.8), nearestIn(rows.lnS, x, -5.8)); b.link(nearestIn(rows.bN, x, -64), nearestIn(rows.bS, x, -76)); }
  for (const [a, c] of [['wW', 'wE'], ['eW', 'eE'], ['wW2', 'wE2'], ['wWs', 'wEs'], ['eWs', 'eEs']]) for (let i = 0; i < rows[a].length; i += 2) b.link(rows[a][i], nearestIn(rows[c], rows[a][i].pos.x, rows[a][i].pos.z));
  // intersections
  for (const [list, x, z] of [[rows.lnS, -45.8, -5.8], [rows.lnS, -34.2, -5.8], [rows.lnN, -45.8, 5.8], [rows.lnN, -34.2, 5.8], [rows.lnS, 44.2, -5.8], [rows.lnS, 55.8, -5.8], [rows.bN, -45.8, -64.2], [rows.bN, -34.2, -64.2], [rows.bN, 44.2, -64.2], [rows.bN, 55.8, -64.2], [rows.bS, -45.8, -75.8], [rows.bS, -34.2, -75.8], [rows.bS, 44.2, -75.8], [rows.bS, 55.8, -75.8]]) {
    const n = swNode(x, z); const m = nearestIn(list, x, z); if (m !== n) b.link(n, m);
  }
  // exits at map edges
  for (const n of [rows.lnN[0], rows.lnS[0], rows.lnN[rows.lnN.length - 1], rows.lnS[rows.lnS.length - 1], rows.bN[0], rows.bS[rows.bS.length - 1], rows.wWs[0], rows.eEs[0]]) { n.tags.add('exit'); n.tags.add('spawn'); }
  const allSw = Object.values(sw);

  // ---------------- houses ----------------
  const houses = [];
  const lots = [];
  for (const x of [-110, -86, -62, -14, 10, 32, 76, 100, 122]) lots.push({ x, z: -17, rot: 0 });
  for (const x of [-110, -86, -62, 76, 100, 122]) lots.push({ x, z: 17, rot: 2 });
  for (const x of [-110, -86, -62, -14, 10, 32, 76, 100]) lots.push({ x, z: -53, rot: 2 });
  for (const x of [-110, -86, -62, -14, 10, 32, 76, 100]) lots.push({ x, z: -88, rot: 0 });
  lots.forEach((L, i) => {
    const lit = R() < 0.62;
    const h = house(b, L.x, L.z, L.rot, { lit, w: 10 + Math.floor(R() * 3), d: 9, mirror: i % 4 === 1, locked: R() < 0.35, doorX: -1.6 });
    houses.push(h);
    // driveway + car
    const f = h.frame; const dwX = h.w / 2 + 2.2;
    f.box(dwX, 0.02, 4.5 + 4, 3.2, 0.04, 9.5, 'concrete', { collide: false, cast: false });
    const [cx, cz] = f.p(dwX, 7.5);
    b.region(cx - 2, cz - 2, cx + 2, cz + 2, 'concrete');
    if (R() < 0.6) car(b, cx, cz, f.yaw(R() < 0.5 ? 0 : Math.PI));
    // walkway, mailbox, garden
    f.box(h.nodes ? (L.rot === 0 ? -1.6 : -1.6) : 0, 0.015, 7, 1.2, 0.03, 5, 'sidewalk', { collide: false, cast: false });
    const [mx, mz] = f.p(dwX - 2.3, 11); mailbox(b, mx, mz, f.yaw(0));
    // backyard fence with gate gap
    const [ax, az] = f.p(-h.w / 2 - 2, -h.d / 2 - 1), [bx, bz] = f.p(h.w / 2 + 4, -h.d / 2 - 9);
    const fx0 = Math.min(ax, bx), fx1 = Math.max(ax, bx), fz0 = Math.min(az, bz), fz1 = Math.max(az, bz);
    if (L.rot === 0 || L.rot === 2) {
      const backZ = L.rot === 0 ? fz0 : fz1;
      fence(b, fx0, backZ, fx1, backZ, 1.6, 'wood', { picket: false });
      fence(b, fx0, Math.min(az, backZ), fx0, Math.max(az, backZ), 1.6, 'wood');
      fence(b, fx1, Math.min(az, backZ), fx1, Math.max(az, backZ), 1.6, 'wood');
    }
    // link house to sidewalk
    const out = h.nodes.out; const row = L.z > 0 ? rows.lnN : L.z > -35 ? rows.lnS : L.z > -70 ? rows.bN : rows.bS;
    b.link(out, nearestIn(row, out.pos.x, out.pos.z));
    // trees & bushes in yard
    const [tx, tz] = f.p(-h.w / 2 - 1.5, 6); 
    if (R() < 0.7) plantTrees(b, [{ x: tx, z: tz, s: rr(0.8, 1.2), rot: R() * 6, type: 'oak' }]);
    const bushes = []; for (let k = 0; k < 4; k++) { const [px, pz] = f.p(-h.w / 2 + 1 + k * 2.2, h.d / 2 + 0.7); bushes.push({ x: px, z: pz, s: rr(0.7, 1.1), rot: R() * 6 }); } plantBushes(b, bushes);
    // backyard extras: shed / trash / dog sound
    const [sx, sz] = f.p(h.w / 2 + 1.5, -h.d / 2 - 6);
    if (R() < 0.5) { b.box(sx, 1.1, sz, 2.4, 2.2, 2.0, 'sidingRot', { surface: 'wood' }); }
    else trashCan(b, game, sx, sz);
    if (R() < 0.25) b.emitters.push({ pos: new THREE.Vector3(sx, 0.6, sz), sound: 'bark', interval: [25, 70], vol: 0.6 });
  });

  // ---------------- park + playground (north of Ashgrove, between Willow and Elm) ----------------
  const PX0 = -28, PX1 = 42, PZ0 = 9, PZ1 = 70;
  fence(b, PX0, PZ1, PX1, PZ1, 1.2, 'blackMetal');
  fence(b, PX0, PZ0 + 1, PX0, PZ1, 1.2, 'blackMetal', { gap: 0.2 });
  fence(b, PX1, PZ0 + 1, PX1, PZ1, 1.2, 'blackMetal', { gap: 0.7 });
  // paths
  b.ground(4, PZ0, 7, PZ1 - 4, 'dirt', 'dirt', 0.01, 3); b.ground(PX0, 38, PX1, 41, 'dirt', 'dirt', 0.011, 3);
  const parkNodes = [];
  for (let z = 12; z <= 62; z += 10) for (let x = -20; x <= 36; x += 14) parkNodes.push(b.node(x, z, 0, ['activity']));
  for (let i = 0; i < parkNodes.length; i++) for (let j = i + 1; j < parkNodes.length; j++) if (parkNodes[i].pos.distanceTo(parkNodes[j].pos) < 15) b.link(parkNodes[i], parkNodes[j]);
  for (const pn of parkNodes) if (pn.pos.z < 14) b.link(pn, nearestIn(rows.lnN, pn.pos.x, 5.8));
  b.link(nearestIn(parkNodes, -20, 12), nearestIn(rows.wE2, -34.2, 20));
  // benches with sit spots
  for (const [x, z, r] of [[-10, 39.5, 0], [18, 39.5, 0], [8, 25, 1], [8, 55, 3], [30, 39.5, 2]]) { bench(b, x, z, r); const n = b.node(x + (r === 1 ? 0.6 : r === 3 ? -0.6 : 0), z + (r === 0 ? 0.6 : r === 2 ? -0.6 : 0), 0, ['activity']); n.activity = 'sit'; b.link(n, nearestIn(parkNodes, x, z)); }
  // trees in park
  const parkTrees = [];
  for (let i = 0; i < 26; i++) { const x = rr(PX0 + 3, PX1 - 3), z = rr(PZ0 + 6, PZ1 - 3); if (Math.abs(x - 5.5) < 3 || Math.abs(z - 39.5) < 3 || (x > 14 && x < 36 && z > 46 && z < 66)) continue; parkTrees.push({ x, z, s: rr(0.9, 1.5), rot: R() * 6, type: R() < 0.2 ? 'dead' : 'oak' }); }
  plantTrees(b, parkTrees);
  parkTrees.forEach((t) => b.anchors.treeGap.push({ pos: new THREE.Vector3(t.x + 1.2, 0, t.z) }));
  // playground (rubber ground)
  b.ground(14, 46, 36, 66, 'darkConcrete', 'concrete', 0.02, 2);
  // swing set
  const swingFrame = (x, z) => {
    for (const s of [-1.6, 1.6]) { b.cyl(x + s, 0, z - 0.8, 0.05, 0.05, 2.6, 'rust', { seg: 6, rotX: 0.32 }); b.cyl(x + s, 0, z + 0.8, 0.05, 0.05, 2.6, 'rust', { seg: 6, rotX: -0.32 }); }
    const top = new THREE.CylinderGeometry(0.05, 0.05, 3.4, 6); top.rotateZ(Math.PI / 2); top.translate(x, 2.45, z); b.geo(top, 'rust');
    b.world.box(x, 1.2, z, 3.6, 2.5, 0.3, { surface: 'metal' });
  };
  swingFrame(20, 52);
  const swings = [];
  for (const s of [-0.7, 0.7]) {
    const pivot = new THREE.Group(); pivot.position.set(20 + s, 2.42, 52);
    const ch = new THREE.Mesh(new THREE.BoxGeometry(0.02, 1.9, 0.02), b.m('blackMetal')); ch.position.set(-0.22, -0.95, 0); pivot.add(ch);
    const ch2 = ch.clone(); ch2.position.x = 0.22; pivot.add(ch2);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.2), b.m('blackMetal')); seat.position.y = -1.9; seat.castShadow = true; pivot.add(seat);
    b.root.add(pivot); swings.push(pivot);
  }
  // slide
  { const f = new Frame(b, 30, 58, 1); f.box(0, 1.0, -1.6, 1.2, 0.08, 1.2, 'redMetal'); for (const [x, z] of [[-0.55, -2.15], [0.55, -2.15], [-0.55, -1.05], [0.55, -1.05]]) f.box(x, 0.5, z, 0.08, 1.0, 0.08, 'rust', { collide: false }); const sl = new THREE.BoxGeometry(0.7, 0.05, 3.0); sl.rotateX(0.38); f.geo(sl, 'yellowMetal', 0, 0.55, 0.3); for (let i = 0; i < 4; i++) f.box(0, 0.2 + i * 0.25, -2.4 - i * 0.05, 0.6, 0.05, 0.12, 'rust', { collide: false }); }
  // merry-go-round + sandbox
  b.cyl(24, 0, 60, 1.4, 1.4, 0.15, 'rust', { seg: 16, collide: true });
  b.box(17, 0.15, 61, 4, 0.3, 4, 'wood', { collide: true, surface: 'wood' }); b.ground(15.2, 59.2, 18.8, 62.8, 'dirt', 'dirt', 0.31, 2);
  const swingNode = b.node(20, 50, 0, ['activity']); swingNode.activity = 'look'; b.link(swingNode, nearestIn(parkNodes, 20, 50));
  b.emitters.push({ pos: new THREE.Vector3(20, 1.4, 52), sound: 'swing', interval: [12, 35], vol: 0.35, cond: () => swingState.on });
  const swingState = { on: false };

  // ---------------- 13 ASHGROVE: the abandoned house at the cul-de-sac ----------------
  const ah = { x: -40, z: 88 };
  const af = new Frame(b, ah.x, ah.z, 2); // front faces world -z (toward cul-de-sac)
  const AW = 14, AD = 12, AH = 3.1, T = 0.22;
  // basement terrain hole
  const BS = { x0: ah.x - 6, x1: ah.x + 6, z0: ah.z - 5, z1: ah.z + 5 };
  b.terrainHoles = [{ ...BS, y: -3.2 }];
  b.world.terrain = (x, z) => (x > BS.x0 && x < BS.x1 && z > BS.z0 && z < BS.z1 ? -3.2 : 0);
  // ground floor slab with stair hole (local x -5.5..-3.5, z -1..3)
  const floorPieces = [[-AW / 2, -AD / 2, AW / 2, -1.2], [-AW / 2, 3.2, AW / 2, AD / 2], [-AW / 2, -1.2, -5.6, 3.2], [-3.4, -1.2, AW / 2, 3.2]];
  for (const [x0, z0, x1, z1] of floorPieces) af.box((x0 + x1) / 2, 0.075, (z0 + z1) / 2, x1 - x0, 0.15, z1 - z0, 'woodFloor', { surface: 'wood', tex: 3 });
  const winA = { y0: 0.9, y1: 2.2 };
  af.wall(-AW / 2, AD / 2, AW / 2, AD / 2, 0.15, AH, T, 'sidingRot', [{ at: AW / 2 - 1, w: 1.1, y0: 0, y1: 2.2 }, { at: 2.5, w: 1.3, ...winA }, { at: AW - 2.5, w: 1.3, ...winA }]);
  af.wall(-AW / 2, -AD / 2, AW / 2, -AD / 2, 0.15, AH, T, 'sidingRot', [{ at: AW / 2 + 3, w: 1.0, y0: 0, y1: 2.2 }, { at: 3, w: 1.2, ...winA }]);
  af.wall(-AW / 2, -AD / 2, -AW / 2, AD / 2, 0.15, AH, T, 'sidingRot', [{ at: AD / 2 + 2, w: 1.2, ...winA }]);
  af.wall(AW / 2, -AD / 2, AW / 2, AD / 2, 0.15, AH, T, 'sidingRot', [{ at: AD / 2 - 2, w: 1.2, ...winA }]);
  // boards over windows
  for (const [x, z, ry] of [[-AW / 2 + 2.5, AD / 2 + 0.15, 0], [AW / 2 - 2.5, AD / 2 + 0.15, 0], [-AW / 2 + 3, -AD / 2 - 0.15, 0]]) for (let k = 0; k < 3; k++) { const g = new THREE.BoxGeometry(1.6, 0.18, 0.04); g.rotateZ((k - 1) * 0.35 + 0.1); af.geo(g, 'darkWood', x, 1.3 + k * 0.35, z, ry); }
  // interior walls
  af.wall(0, -AD / 2, 0, AD / 2, 0.15, AH, 0.14, 'wallpaper', [{ at: AD / 2 + 2.5, w: 1.1, y0: 0, y1: 2.2 }, { at: AD / 2 - 3, w: 1.1, y0: 0, y1: 2.2 }]);
  af.wall(-AW / 2, -2, -5.6, -2, 0.15, AH, 0.14, 'wallpaper', []);
  // ceiling, upper storey (exterior only) and roof
  af.box(0, AH + 0.2, 0, AW, 0.15, AD, 'plaster', { surface: 'wood' });
  af.box(0, AH + 0.27 + 1.6, 0, AW, 3.2, AD, 'sidingRot', { surface: 'wood' });
  for (const x of [-4, 0, 4]) af.window(x, AH + 2, AD / 2 + 0.12, 1.1, 1.3, 0, 1, false);
  for (const x of [-4, 4]) af.window(x, AH + 2, -AD / 2 - 0.12, 1.1, 1.3, 0, -1, false);
  const rg = gableGeo(AW, AD, 3.2, 0.6); af.geo(rg, 'roof', 0, AH + 0.27 + 3.2, 0, 0);
  af.collider(0, AH + 3.5 + 1.4, 0, AW, 2.8, AD * 0.6, { surface: 'wood' });
  b.anchors.roof.push({ pos: af.v(0, AH + 6.5, 0) });
  b.anchors.window.push({ pos: af.v(0, AH + 1.2, AD / 2 - 0.6), face: new THREE.Vector3(0, 0, -1), win: b.windows[b.windows.length - 3] });
  // porch + door
  af.box(AW / 2 - 1, 0.1, AD / 2 + 1.2, 3, 0.2, 2.4, 'darkWood', { surface: 'wood' });
  for (const s of [-1, 1]) af.box(AW / 2 - 1 + s * 1.3, 1.6, AD / 2 + 2.2, 0.15, 3, 0.15, 'darkWood');
  af.box(AW / 2 - 1, 3.1, AD / 2 + 1.2, 3.2, 0.12, 2.6, 'darkWood', { collide: false });
  const ahDoor = af.door(AW / 2 - 1, 0.15, AD / 2, 1.1, 2.2, 'x', 'darkWood', { locked: true });
  const ahBack = af.door(-AW / 2 + 3, 0.15, -AD / 2, 1.0, 2.2, 'x', 'darkWood', {});
  // trashed interior
  const fi = af;
  couch(fi, -AW / 2 + 3, 3.8, 0, 'fabricBrown'); table(fi, 3.5, 3.5, 1.6, 1.0, 0.75, 'darkWood', true);
  shelf(fi, AW / 2 - 0.3, -3, 3, 1.6); bed(fi, 4.5, -3.8, 1, 'mattress'); wardrobe(fi, 1.0, -AD / 2 + 0.5, 0);
  chair(fi, -2.5, 0.5, 1); chair(fi, 2, 1.5, 3);
  for (let i = 0; i < 14; i++) { const g = new THREE.BoxGeometry(rr(0.2, 0.8), rr(0.02, 0.15), rr(0.2, 0.6)); g.rotateY(R() * 3); fi.geo(g, pick(['darkWood', 'wood', 'cloth']), rr(-AW / 2 + 1, AW / 2 - 1), 0.17, rr(-AD / 2 + 1, AD / 2 - 1), 0); }
  { const mp = af.v(-AW / 2 + 0.12, 1.65, 0.6); mirror(b, mp.x, mp.y, mp.z, 0.7, 1.0, af.yaw(Math.PI / 2), b.quality); }
  // a single bare bulb, buzzing
  const ahBulb = af.light(2, AH - 0.3, 0, 0xffd0a0, 3, 8, { flicker: 0.5, broken: 0.25, glowSize: 0.5 });
  b.emitters.push({ pos: af.v(2, AH - 0.3, 0), sound: 'static', interval: [8, 20], vol: 0.06, opts: { dur: 0.4 } });
  // stairs down (local x -5.5..-3.5, descending toward -z from z=3 to z=-1 ... into basement)
  const steps = 12, rise = 3.35 / steps, run = 4.2 / steps;
  for (let i = 0; i < steps; i++) {
    const top = 0.15 - (i + 1) * rise;
    af.box(-4.5, (top + -3.2) / 2, 3.1 - (i + 0.5) * run, 2.0, top + 3.2, run, 'darkWood', { surface: 'wood', tex: 1 });
  }
  // basement (y -3.2): slab, walls, ceiling is the floor above
  const BY = -3.2;
  af.box(0, BY - 0.1, 0, 12, 0.2, 10, 'darkConcrete', { surface: 'concrete', tex: 3 });
  af.wall(-6, -5, 6, -5, BY, 3.3, 0.3, 'darkConcrete', []); af.wall(-6, 5, 6, 5, BY, 3.3, 0.3, 'darkConcrete', []);
  af.wall(-6, -5, -6, 5, BY, 3.3, 0.3, 'darkConcrete', []); af.wall(6, -5, 6, 5, BY, 3.3, 0.3, 'darkConcrete', []);
  // stair walls
  af.box(-3.45, -1.5, 1.0, 0.1, 3.4, 4.4, 'darkConcrete');
  af.box(1.5, BY + 0.45, -3.8, 3, 0.9, 1, 'darkWood'); af.box(4.5, BY + 1.0, 3.5, 2, 2, 1.2, 'rust');
  shelf(fi, -2, -4.5, 0, 2); shelf(new Frame(b, ah.x, ah.z, 2, BY), 2.5, -4.5, 0, 2);
  const basementLight = af.light(0, BY + 2.8, 0, 0xffb070, 2.5, 9, { flicker: 0.7, broken: 0.4, glowSize: 0.4 });
  // symbols painted in the basement: a ring
  b.anomalies = [];
  // nav for the abandoned house
  const AN = {};
  AN.out = af.node(AW / 2 - 1, AD / 2 + 3.5, 0, []); AN.porch = af.node(AW / 2 - 1, AD / 2 + 1, 0.2, []);
  AN.door = af.node(AW / 2 - 1, AD / 2, 0.15, ['indoor']); AN.door.door = ahDoor;
  AN.front = af.node(AW / 2 - 2, 3.5, 0.15, ['indoor', 'hide']); AN.mid = af.node(-2.5, 4.5, 0.15, ['indoor']);
  AN.back = af.node(3, -4, 0.15, ['indoor', 'hide']);
  AN.left = af.node(-3, -3, 0.15, ['indoor', 'hide']);
  b.chain([AN.out, AN.porch, AN.door, AN.front, AN.mid]); b.link(AN.front, AN.back); b.link(AN.mid, AN.left);
  b.link(AN.out, nearestIn(rows.wW2.concat(rows.wE2), AN.out.pos.x, AN.out.pos.z));
  b.anchors.hallEnd.push({ pos: af.v(-AW / 2 + 1, 0.15, 1) });
  // overgrown yard: dead trees, tall grass
  plantTrees(b, [{ x: ah.x - 10, z: ah.z + 2, s: 1.3, rot: 1, type: 'dead' }, { x: ah.x + 11, z: ah.z - 4, s: 1.1, rot: 2, type: 'dead' }, { x: ah.x + 9, z: ah.z + 9, s: 1.4, rot: 3, type: 'dead' }]);
  fence(b, ah.x - 14, ah.z - 9, ah.x - 1.5, ah.z - 9, 1.0, 'darkWood', { picket: true });
  fence(b, ah.x + 1.5, ah.z - 9, ah.x + 14, ah.z - 9, 1.0, 'darkWood', { picket: true });

  // ---------------- street furniture ----------------
  const lights = [];
  for (let x = -120; x <= 120; x += 32) {
    lights.push(streetLight(b, x, 7.6, Math.PI, { flicker: R() < 0.2 ? 0.6 : 0, broken: R() < 0.12 ? 0.6 : 0 }));
    lights.push(streetLight(b, x + 16, -7.6, 0, { flicker: R() < 0.15 ? 0.6 : 0 }));
    lights.push(streetLight(b, x + 8, -62.6, Math.PI, {}));
    lights.push(streetLight(b, x + 24, -77.6, 0, { broken: R() < 0.2 ? 0.5 : 0 }));
  }
  for (let z = -50; z <= 50; z += 30) { lights.push(streetLight(b, -47.6, z, Math.PI / 2, { flicker: z > 20 ? 0.7 : 0, broken: z > 40 ? 0.8 : 0 })); if (z < 0) lights.push(streetLight(b, 57.6, z, -Math.PI / 2, {})); }
  for (let i = 0; i < 18; i++) { const x = rr(-120, 120), z = R() < 0.5 ? rr(-3.2, -2.8) : rr(2.8, 3.2); if (Math.abs(x + 40) < 8 || Math.abs(x - 50) < 8) continue; car(b, x, z, z > 0 ? -Math.PI / 2 : Math.PI / 2); const hn = b.node(x, z > 0 ? 6.5 : -6.5, 0.12, ['hide']); hn.faceYaw = z > 0 ? Math.PI : 0; b.link(hn, nearestIn(z > 0 ? rows.lnN : rows.lnS, x, z)); }
  for (let i = 0; i < 10; i++) hydrant(b, rr(-120, 120), R() < 0.5 ? 7.4 : -7.4);
  for (let i = 0; i < 8; i++) trashCan(b, game, rr(-120, 120), R() < 0.5 ? 7.2 : -7.2);
  // street trees along sidewalks
  const st = [];
  for (let x = -124; x < 124; x += 13) { if (Math.abs(x + 40) < 9 || Math.abs(x - 50) < 9) continue; if (R() < 0.7) st.push({ x: x + rr(-2, 2), z: 9.5, s: rr(0.8, 1.2), rot: R() * 6, type: R() < 0.1 ? 'dead' : 'oak' }); if (R() < 0.7) st.push({ x: x + rr(-2, 2), z: -9.5, s: rr(0.8, 1.2), rot: R() * 6 }); }
  plantTrees(b, st);
  // boundary woods (fog hides the end of the world)
  const edge = [];
  for (let i = 0; i < 160; i++) {
    const side = i % 4; const t = R();
    const x = side === 0 ? -BX - rr(2, 14) : side === 1 ? BX + rr(2, 14) : -BX + t * BX * 2;
    const z = side === 2 ? BZ0 - rr(2, 14) : side === 3 ? BZ1 + rr(2, 14) : BZ0 + t * (BZ1 - BZ0);
    if ((side < 2 && (Math.abs(z) < 8 || Math.abs(z + 70) < 8)) || (side === 2 && (Math.abs(x + 40) < 8 || Math.abs(x - 50) < 8))) continue;
    edge.push({ x, z, s: rr(1, 1.6), rot: R() * 6, type: R() < 0.6 ? 'pine' : 'oak' });
  }
  plantTrees(b, edge);
  edge.forEach((t, i) => { if (i % 3 === 0) b.anchors.treeGap.push({ pos: new THREE.Vector3(t.x, 0, t.z) }); });
  // grass tufts
  const tufts = []; for (let i = 0; i < 1600; i++) { const x = rr(-BX, BX), z = rr(BZ0, BZ1); if (Math.abs(z) < 9 || Math.abs(z + 70) < 9 || Math.abs(x + 40) < 8 || Math.abs(x - 50) < 8) continue; tufts.push({ x, z }); } plantGrass(b, tufts, b.quality);
  // far anchors (for distant figures)
  for (const [x, z] of [[0, -105], [-125, 40], [125, -40], [60, 95], [-90, -100], [110, 60]]) b.anchors.far.push({ pos: new THREE.Vector3(x, 0, z) });
  b.anchors.impossible.push({ pos: new THREE.Vector3(24, 0.16, 60) }, { pos: new THREE.Vector3(-40, 0, 64) });

  // ---------------- notes & story items ----------------
  b.box(5.6, 1.0, 9.35, 0.1, 2.0, 0.1, 'wood'); b.item('note', 'sub_poster', 5.6, 1.4, 9.28, Math.PI);
  b.item('note', 'sub_watch', lights[1].pos.x, 1.5, -7.47, 0);
  const h3 = houses[10]; { const p = h3.frame.v(h3.w / 2 - 1.5, 0.68, -h3.d / 2 + 1.6); b.item('note', 'sub_drawing', p.x, p.y, p.z, 0, { flat: true }); }
  { const p = af.v(3.5, 0.82, 3.5); b.item('note', 'sub_letter', p.x, p.y, p.z, 0, { flat: true }); }
  { const p = af.v(1.5, BY + 0.95, -3.8); b.item('recording', 'sub_tape', p.x, p.y, p.z, af.yaw(0)); }
  { const p = af.v(0, BY, 4.4); const it = b.item('rift', 'rift_1', p.x, p.y, p.z, af.yaw(Math.PI)); it.mesh.visible = false; it.hidden = true; }
  // secret symbol: painted on the back of the last shed in Birch St
  b.item('symbol', 'sym_1', 100, 0.9, -101.3, 0);
  // anomalies (familiar places, subtly wrong)
  b.anomalies.push({ pos: new THREE.Vector3(20, 1.4, 52), apply: () => { swingState.on = true; }, revert: () => { swingState.on = false; } });
  b.anomalies.push({ pos: ahDoor.pos.clone().setY(1), apply: () => { ahDoor.target = 1.2; }, revert: () => { if (!ahDoor.open) ahDoor.target = 0; } });
  const porchLights = b.lights.filter((L) => L.pos.y < 3 && L.pos.y > 2);
  b.anomalies.push({ pos: null, apply: () => porchLights.forEach((L) => { L.hallOff = true; }), revert: () => porchLights.forEach((L) => { L.hallOff = false; }) });

  // spawn: backyard of the abandoned house, at the edge of the woods
  b.spawns.player.set(ah.x + 4, 0, ah.z + 12);
  b.spawns.playerYaw = Math.PI;

  // ---------------- population ----------------
  const outfits = ['casual'];
  const initial = [];
  const activityNodes = b.nodes.filter((n) => n.tags.has('activity'));
  for (let i = 0; i < 16; i++) {
    const n = activityNodes[Math.floor(R() * activityNodes.length)];
    initial.push({ pos: n.pos.clone(), outfit: 'casual', home: n.pos.clone(), roam: 50 });
  }
  // a dog walker, a pair chatting in the park, someone on a porch
  initial.push({ pos: new THREE.Vector3(-12, 0, 39.5), outfit: 'casual', activity: 'phone', home: new THREE.Vector3(0, 0, 40), roam: 25 });
  initial.push({ pos: new THREE.Vector3(10, 0, 30), outfit: 'casual', personality: 'observant', home: new THREE.Vector3(10, 0, 30), roam: 30 });
  initial.push({ pos: new THREE.Vector3(11, 0, 31), outfit: 'casual', personality: 'calm', home: new THREE.Vector3(10, 0, 30), roam: 30 });

  const update = (dt, t) => {
    // swings: still by default; the anomaly makes one swing on its own
    swings.forEach((s, i) => { const target = swingState.on && i === 0 ? Math.sin(t * 1.6) * 0.6 : Math.sin(t * 0.7 + i) * 0.02 * game.wind; s.rotation.x += (target - s.rotation.x) * 0.1; });
    // occasionally a house light turns on/off
    if (Math.random() < dt * 0.05) { const W = b.windows[Math.floor(Math.random() * b.windows.length)]; if (W && W.baseLit !== undefined && W.pos.y < 3) { W.lit = !W.lit; b.refreshWindows(1 - (game.map.abandonF || 0)); } }
  };

  return {
    kind: 'suburb', name: 'Ashgrove Lane', chapter: 1,
    env: {
      sky: { top: '#04060a', horizon: '#1a1f2a', stars: 0.5 }, fogColor: 0x10141c, fogDensity: 0.022, ambient: { sky: 0x5a6a8a, ground: 0x1a1612, intensity: 1.6 },
      moon: { color: 0xa8b8e0, intensity: 1.3, dir: [0.5, 1, 0.3] }, exposure: 1.15, grade: { tint: [0.95, 1.0, 1.08], lift: [0.005, 0.006, 0.012], desat: 0.3 },
      wind: 1, fogBanks: 1, fogColor2: 0x6a7080, reverb: [1.6, 3], visibility: 0.25,
      dusk: { duration: 420, sky: 3.5, fogColor: 0x3a3238, sunColor: 0xff9a60, light: 0.8 }, rainLater: 600,
    },
    loops: [['wind', 0.35], ['crickets', 0.25], ['drone', 0.08]],
    emitters: b.emitters,
    bounds: { minX: -BX - 10, maxX: BX + 10, minZ: BZ0 - 10, maxZ: BZ1 + 10 },
    populationDef: { initial, max: 18, respawnMin: 30, respawnMax: 70 },
    randomNPCDef: (pos) => ({ pos, outfit: 'casual', home: pos.clone(), roam: 50 }),
    searcherOutfit: 'searcher', allowCalls: true, npcsCanLeave: true,
    ambientEvents: [
      { every: [40, 90], fn: (g) => g.audio.play('carPass', new THREE.Vector3(rand(-150, 150), 1, rand(-150, 150)), { vol: 0.25, dur: 5 }) },
      { every: [30, 80], fn: (g) => g.audio.play('bark', new THREE.Vector3(rand(-150, 150), 1, rand(-150, 150)), { vol: 0.35 }) },
      { every: [90, 200], fn: (g) => g.audio.play('siren', new THREE.Vector3(rand(-300, 300), 5, -300), { vol: 0.15, dur: 8 }) },
      { every: [50, 120], fn: (g) => g.audio.play('owl', new THREE.Vector3(rand(-150, 150), 8, rand(-150, 150)), { vol: 0.3 }) },
    ],
    update,
    refs: { ahDoor, ahBack, basementLight, ahBulb, swingState },
  };
}
