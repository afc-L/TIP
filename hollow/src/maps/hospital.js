// MAP 4 — ST. ALDRIC'S HOSPITAL. Abandoned since 1994. Long corridors, patient rooms,
// operating theatres, records, a stairwell up to a hallway that never seems to end,
// and a basement with Theatre B. Power can be restored from the maintenance room.
import * as THREE from 'three';
import { Frame, table, chair, shelf, couch, toilet, sinkUnit, mirror, car, plantTrees, fence, streetLight } from './props.js';
import { mulberry32, rand, pick } from '../core/util.js';
import { textTexture } from '../core/textures.js';

const FH = 4.2; // floor height
const BX0 = -56, BX1 = 56, BZ0 = -16, BZ1 = 20;
const BASE = { x0: -10, x1: 56, z0: -2, z1: 20, y: -4.5 };

export function buildHospital(game, b) {
  const R = mulberry32(4004); const rr = (a, c) => a + R() * (c - a);
  b.defaultSurface = 'tile';
  b.world.terrain = (x, z) => (x > BASE.x0 && x < BASE.x1 && z > BASE.z0 && z < BASE.z1 ? BASE.y : 0);
  const refs = { powered: false };
  const mainsLights = [];
  const W = 'hospitalWall', T = 0.2;
  // ---------------- grounds ----------------
  b.ground(-120, -110, 120, -32, 'asphalt', 'asphalt', 0, 5);
  b.ground(-120, -32, -16, 70, 'grass', 'grass', 0, 6); b.ground(16, -32, 120, -16, 'grass', 'grass', 0, 6);
  b.ground(-16, 20, 120, 70, 'grass', 'grass', 0, 6); b.ground(56, -16, 120, 20, 'grass', 'grass', 0, 6);
  for (let x = -80; x <= 80; x += 6) b.box(x, 0.01, -70, 0.15, 0.01, 5, 'paint', { collide: false, cast: false });
  car(b, -30, -64, 0.1, 'carPaintWhite'); car(b, 24, -72, 3.0, 'rust'); car(b, -60, -80, 1.6, 'carPaintBlack');
  // ambulance under the canopy
  { const g = car(b, 9, -40, Math.PI / 2, 'carPaintWhite'); g.scale.set(1.15, 1.35, 1.25); const stripe = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.2, 2.0), b.m('neonRed')); stripe.position.set(0, 1.1, 0); stripe.rotation.y = 0; g.add(stripe); }
  b.box(0, 4.6, -36, 18, 0.4, 8, 'darkConcrete', { surface: 'concrete' });
  for (const x of [-8, 8]) b.box(x, 2.3, -39.5, 0.4, 4.6, 0.4, 'concrete');
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(14, 1.6), new THREE.MeshStandardMaterial({ map: textTexture("ST. ALDRIC'S HOSPITAL", { w: 1024, h: 120, bg: '#1a1a18', fg: '#b0a890', font: 'bold 72px Georgia' }), roughness: 0.8 }));
  sign.position.set(0, 5.4, -40.05); sign.rotation.y = Math.PI; b.root.add(sign);
  fence(b, -110, -105, 110, -105, 2.2, 'rust'); fence(b, -110, -105, -110, 65, 2.2, 'rust'); fence(b, 110, -105, 110, 65, 2.2, 'rust'); fence(b, -110, 65, 110, 65, 2.2, 'rust');
  const dead = []; for (let i = 0; i < 40; i++) { const x = rr(-105, 105), z = rr(-100, 60); if (x > -60 && x < 60 && z > -45 && z < 24) continue; dead.push({ x, z, s: rr(0.9, 1.5), rot: R() * 6, type: R() < 0.7 ? 'dead' : 'pine' }); } plantTrees(b, dead);
  dead.forEach((t) => b.anchors.treeGap.push({ pos: new THREE.Vector3(t.x + 1, 0, t.z) }));
  streetLight(b, -20, -50, 0, { broken: 0.7 }); streetLight(b, 20, -50, 0, { flicker: 0.6 }); streetLight(b, 0, -85, Math.PI, { broken: 0.3 });

  // ---------------- shell ----------------
  // ground floor slab (hole for the stair down + elevator shaft)
  const holes = [{ x0: 39.5, x1: 45.5, z0: 4, z1: 17.5 }, { x0: 47, x1: 55, z0: 6, z1: 18 }];
  const slabXs = [BX0, 39.5, 45.5, 47, 55, BX1];
  for (let i = 0; i < slabXs.length - 1; i++) {
    const x0 = slabXs[i], x1 = slabXs[i + 1]; const h = holes.find((q) => q.x0 === x0);
    if (!h) b.boxMM(x0, -0.3, BZ0, x1, 0, BZ1, 'dirtyTile', { surface: 'tile', tex: 2.4 });
    else { b.boxMM(x0, -0.3, BZ0, x1, 0, h.z0, 'dirtyTile', { surface: 'tile', tex: 2.4 }); b.boxMM(x0, -0.3, h.z1, x1, 0, BZ1, 'dirtyTile', { surface: 'tile', tex: 2.4 }); }
  }
  b.boxMM(-16, -0.3, -32, 16, 0, BZ0, 'dirtyTile', { surface: 'tile', tex: 2.4 }); // lobby floor
  // upper slab (ceiling of ground floor) with stair-up hole
  b.boxMM(BX0, FH, BZ0, -55.8, FH + 0.3, BZ1, 'plaster', { surface: 'concrete' });
  b.boxMM(-55.8, FH, BZ0, -46.2, FH + 0.3, 4, 'plaster', { surface: 'concrete' }); b.boxMM(-55.8, FH, 17.5, -46.2, FH + 0.3, BZ1, 'plaster', { surface: 'concrete' });
  b.boxMM(-46.2, FH, BZ0, BX1, FH + 0.3, BZ1, 'plaster', { surface: 'concrete' });
  b.boxMM(-16, FH, -32, 16, FH + 0.3, BZ0, 'plaster', { surface: 'concrete' });
  // exterior walls (ground floor) with windows
  const winOps = (x0, x1, skip = []) => { const out = []; for (let x = x0 + 5; x < x1 - 2; x += 10) if (!skip.some(([a, c]) => x > a && x < c)) out.push({ at: x - x0, w: 2.2, y0: 1.2, y1: 3.0 }); return out; };
  b.wall(BX0, BZ1, BX1, BZ1, 0, FH, T, W, winOps(BX0, BX1));
  b.wall(BX0, BZ0, -16, BZ0, 0, FH, T, W, winOps(BX0, -16)); b.wall(16, BZ0, BX1, BZ0, 0, FH, T, W, winOps(16, BX1));
  b.wall(BX0, BZ0, BX0, BZ1, 0, FH, T, W, [{ at: 18, w: 2, y0: 0, y1: 2.4 }]); b.wall(BX1, BZ0, BX1, BZ1, 0, FH, T, W, [{ at: 8, w: 2.2, y0: 1.2, y1: 3 }]);
  b.wall(-16, -32, 16, -32, 0, FH, T, W, [{ at: 16, w: 3.2, y0: 0, y1: 2.8 }, { at: 6, w: 3, y0: 1.2, y1: 3 }, { at: 26, w: 3, y0: 1.2, y1: 3 }]);
  b.wall(-16, -32, -16, BZ0, 0, FH, T, W, [{ at: 8, w: 2.4, y0: 1.2, y1: 3 }]); b.wall(16, -32, 16, BZ0, 0, FH, T, W, [{ at: 8, w: 2.4, y0: 1.2, y1: 3 }]);
  const frontDoorL = b.door(-0.8, 0, -32, 1.6, 2.8, 'x', 'doorMetal', {}); const frontDoorR = b.door(0.8, 0, -32, 1.6, 2.8, 'x', 'doorMetal', { locked: true });
  // the upper storey exterior + roof
  b.boxMM(BX0, FH + 0.3, BZ0, BX1, FH * 2 + 0.3, -2.2, W, { tex: 2.5 }); b.boxMM(-46, FH + 0.3, 2.2, BX1, FH * 2 + 0.3, BZ1, W, { tex: 2.5 });
  // upper stair landing room (west)
  b.wall(BX0, 2.2, BX0, BZ1, FH + 0.3, FH, T, W, [{ at: 9, w: 2, y0: 1.2, y1: 2.8 }]); b.wall(BX0, BZ1, -46, BZ1, FH + 0.3, FH, T, W, []);
  b.boxMM(-16, FH + 0.3, -32, 16, FH * 2 + 0.3, BZ0, W, { tex: 2.5 });
  b.boxMM(BX0, FH * 2 + 0.3, BZ0, BX1, FH * 2 + 0.8, BZ1, 'darkConcrete', { surface: 'concrete' });
  b.boxMM(-16, FH * 2 + 0.3, -32, 16, FH * 2 + 0.8, BZ0, 'darkConcrete', { surface: 'concrete' });
  // upper corridor end caps
  b.boxMM(BX0 - 0.2, FH + 0.3, -2.2, BX0, FH * 2 + 0.3, 2.2, W); b.boxMM(BX1, FH + 0.3, -2.2, BX1 + 0.2, FH * 2 + 0.3, 2.2, W);
  for (let x = BX0 + 5; x < BX1; x += 10) { b.window(x, FH + 2.6, BZ1 + 0.11, 2, 1.6, 0, 1, R() < 0.06, { color: 0xc0d0ff }); b.window(x, FH + 2.6, BZ0 - 0.11, 2, 1.6, 0, -1, R() < 0.06, { color: 0xc0d0ff }); }
  for (let x = -12; x < 16; x += 8) b.window(x, FH + 2.6, -32.11, 2, 1.6, 0, -1, R() < 0.1, { color: 0xffe0b0 });
  b.anchors.roof.push({ pos: new THREE.Vector3(-30, FH * 2 + 0.8, 0) }, { pos: new THREE.Vector3(30, FH * 2 + 0.8, 10) });

  // ---------------- main corridor + rooms ----------------
  const corrN = [], corrS = [];
  const north = [[-56, -46, 'stairsUp'], [-46, -36, 'patient'], [-36, -26, 'bath'], [-26, -16, 'office'], [-16, -6, 'records'], [-6, 6, 'staff'], [6, 16, 'patient'], [16, 26, 'storage'], [26, 36, 'maintenance'], [36, 46, 'stairsDown'], [46, 56, 'elevator']];
  const south = [[-56, -46, 'patient'], [-46, -36, 'patient'], [-36, -26, 'or'], [-26, -16, 'patient'], [16, 26, 'patient'], [26, 36, 'storage'], [36, 46, 'patient'], [46, 56, 'or']];
  const doorXOf = (x0, x1, t) => (t === 'stairsUp' ? -48 : t === 'stairsDown' ? 37.7 : t === 'elevator' ? (x0 + x1) / 2 : (x0 + x1) / 2 - 2);
  const nOps = north.map(([x0, x1, t]) => ({ at: doorXOf(x0, x1, t) - BX0, w: t === 'elevator' ? 6 : t.startsWith('stairs') ? 2.6 : 1.4, y0: 0, y1: 2.4 }));
  b.wall(BX0, 2, BX1, 2, 0, FH, 0.18, W, nOps);
  const sOps = south.map(([x0, x1]) => ({ at: (x0 + x1) / 2 - BX0 - 2, w: 1.4, y0: 0, y1: 2.4 }));
  b.wall(BX0, -2, -16, -2, 0, FH, 0.18, W, sOps.slice(0, 4)); b.wall(16, -2, BX1, -2, 0, FH, 0.18, W, sOps.slice(4).map((o) => ({ ...o, at: o.at - 72 })));
  for (const [x0] of north.slice(1)) b.wall(x0, 2, x0, BZ1, 0, FH, 0.16, W, []);
  for (const [x0] of south.slice(1)) if (x0 !== 16) b.wall(x0, BZ0, x0, -2, 0, FH, 0.16, W, []);
  b.wall(-16, BZ0, -16, -2, 0, FH, 0.16, W, []); b.wall(16, BZ0, 16, -2, 0, FH, 0.16, W, []);
  // corridor nav spine
  const spine = []; for (let x = -53; x <= 53; x += 6) spine.push(b.node(x, 0, 0, x % 12 === 1 ? ['activity'] : []));
  b.chain(spine);
  const nearestSpine = (x) => spine.reduce((a, n) => (Math.abs(n.pos.x - x) < Math.abs(a.pos.x - x) ? n : a), spine[0]);
  // corridor lights: mains (off until power) + a few emergency lights
  for (let x = -53; x <= 53; x += 6) {
    b.box(x, FH - 0.05, 0, 1.4, 0.08, 0.35, 'lampCold', { collide: false, cast: false });
    const L = b.light(x, FH - 0.3, 0, 0xd8e8ff, 9, 10, { on: false, flicker: R() < 0.4 ? 0.7 : 0.05, broken: R() < 0.25 ? 0.5 : 0, glowSize: 0.6 }); mainsLights.push(L);
    if (x % 18 === 1) b.light(x, FH - 0.5, 1.7, 0xff2010, 2.5, 7, { glowSize: 0.3, flicker: 0.05 });
  }
  b.anchors.hallEnd.push({ pos: new THREE.Vector3(-54, 0, 0) }, { pos: new THREE.Vector3(54, 0, 0) });
  b.anchors.speaker = [{ pos: new THREE.Vector3(-30, FH - 0.4, 0) }, { pos: new THREE.Vector3(30, FH - 0.4, 0) }, { pos: new THREE.Vector3(0, FH - 0.4, -20) }];
  for (const s of b.anchors.speaker) b.box(s.pos.x, s.pos.y + 0.2, s.pos.z + 1.7, 0.5, 0.3, 0.2, 'darkConcrete', { collide: false });

  const hospBed = (f, x, z, rot) => {
    const L = new Frame(b, ...f.p(x, z), f.r + rot, f.oy);
    L.box(0, 0.55, 0, 0.95, 0.08, 2.0, 'whiteMetal', { surface: 'metal' }); L.box(0, 0.68, 0.05, 0.9, 0.18, 1.9, 'mattress', { collide: false });
    for (const [dx, dz] of [[-0.42, -0.9], [0.42, -0.9], [-0.42, 0.9], [0.42, 0.9]]) L.box(dx, 0.27, dz, 0.05, 0.55, 0.05, 'chrome', { collide: false });
    L.box(0, 0.9, -1.0, 0.95, 0.7, 0.05, 'whiteMetal', { collide: false });
    L.box(0.7, 0.9, -0.9, 0.04, 1.8, 0.04, 'chrome', { collide: false }); L.box(0.7, 1.8, -0.9, 0.3, 0.3, 0.04, 'cloth', { collide: false });
  };
  const roomNode = (x, z, tags) => b.node(x, z, 0, ['indoor', ...tags]);
  const doors = {};
  const buildRoom = (x0, x1, z0, z1, type, side) => {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2; const doorX = side === 'n' ? doorXOf(x0, x1, type) : cx - 2; const dz = side === 'n' ? 2 : -2;
    const f = new Frame(b, 0, 0, 0, 0);
    // door (most rooms)
    if (!['elevator', 'stairsUp', 'stairsDown'].includes(type)) {
      const locked = type === 'records' || (type === 'patient' && R() < 0.3);
      doors[type + cx] = b.door(doorX, 0, dz, 1.4, 2.4, 'x', 'doorWhite', { locked });
    }
    const inner = roomNode(doorX, dz + (side === 'n' ? 2 : -2), []);
    const doorN = b.node(doorX, dz, 0, ['indoor']); doorN.door = doors[type + cx] || null;
    b.chain([nearestSpine(doorX), doorN, inner]);
    const deep = roomNode(type === 'stairsDown' ? 37.7 : cx + 2, side === 'n' ? z1 - 3 : z0 + 3, type.startsWith('stairs') || type === 'elevator' ? [] : ['hide']); if (!type.startsWith('stairs')) b.link(inner, deep);
    b.anchors.indoor.push({ pos: new THREE.Vector3(cx, 1.5, cz) });
    const floorMat = type === 'or' ? 'tile' : 'dirtyTile';
    if (type === 'patient') { hospBed(f, cx - 2.5, side === 'n' ? z1 - 2.2 : z0 + 2.2, side === 'n' ? 0 : 2); hospBed(f, cx + 2.5, side === 'n' ? z1 - 2.2 : z0 + 2.2, side === 'n' ? 0 : 2); f.box(cx + 4.2, 0.5, cz, 0.6, 1.0, 0.5, 'whiteMetal'); if (R() < 0.5) b.light(cx, FH - 0.3, cz, 0xc8d8ff, 4, 8, { on: false, flicker: 0.5, glowSize: 0.4 }) && mainsLights.push(b.lights[b.lights.length - 1]); }
    if (type === 'or') { const oy = 0; f.box(cx, 0.5, cz, 0.9, 1.0, 2.1, 'chrome', { surface: 'metal' }); f.box(cx, 0.9, cz, 0.7, 0.05, 1.9, 'whiteMetal', { collide: false }); b.cyl(cx, FH - 1.2, cz, 0.7, 0.4, 0.3, 'whiteMetal', { seg: 14 }); b.box(cx, FH - 0.5, cz, 0.06, 1, 0.06, 'chrome', { collide: false }); const L = b.light(cx, FH - 1.4, cz, 0xe8f0ff, 14, 9, { on: false, flicker: 0.3, glowSize: 0.8 }); mainsLights.push(L); for (let i = 0; i < 3; i++) f.box(cx - 3 + i * 3, 1.0, side === 'n' ? z1 - 0.4 : z0 + 0.4, 1.6, 2.0, 0.5, 'whiteMetal'); f.box(cx + 1.6, 0.6, cz + 0.8, 0.6, 0.06, 0.4, 'chrome', { collide: false }); }
    if (type === 'storage') { for (let i = 0; i < 3; i++) shelf(f, cx - 3 + i * 3, side === 'n' ? z1 - 2 - i * 3.5 : z0 + 2 + i * 3.5, 0, 2.4); }
    if (type === 'records') { for (let i = 0; i < 4; i++) for (let k = 0; k < 3; k++) f.box(cx - 3.5 + k * 2.6, 0.75, 7 + i * 3, 1.8, 1.5, 0.6, 'paintedMetal'); table(f, cx + 3, 16, 1.6, 0.9, 0.78, 'darkWood', true); b.item('note', 'hos_file', cx + 3, 0.81, 16, 0.3, { flat: true }); refs.records = new THREE.Vector3(doorX, 0, dz); b.light(cx + 3, 1.3, 16, 0xffd8a0, 3, 5, { flicker: 0.1, glowSize: 0.3 }); }
    if (type === 'staff') { table(f, cx, 10, 2.4, 1.2, 0.76, 'darkWood', true); couch(f, cx - 3.5, 17.6, 2, 'fabricGreen'); for (let i = 0; i < 6; i++) f.box(cx + 1 + i * 0.8, 1.0, 19.5, 0.75, 2.0, 0.5, 'paintedMetal'); b.item('note', 'hos_memo', cx - 1.5, 1.6, 2.3, 0); }
    if (type === 'office') { table(f, cx, 12, 1.8, 0.9, 0.76, 'darkWood', false); chair(f, cx, 13, 2); shelf(f, x0 + 0.4, 12, 1, 2); b.item('note', 'hos_chart', cx, 1.7, BZ1 - 0.25, Math.PI); }
    if (type === 'bath') { for (let i = 0; i < 3; i++) toilet(f, x0 + 1.5 + i * 2.5, BZ1 - 0.6, 2); for (let i = 0; i < 3; i++) sinkUnit(f, x1 - 0.5, 5 + i * 2, 3); mirror(b, x1 - 0.1, 1.7, 7, 1.8, 1.1, -Math.PI / 2, b.quality); }
    if (type === 'maintenance') {
      f.box(cx - 2.5, 1.0, 14, 3, 2, 2.4, 'paintedMetal', { surface: 'metal' }); f.box(cx + 2.5, 0.8, 16, 2, 1.6, 2, 'yellowMetal', { surface: 'metal' });
      for (let i = 0; i < 4; i++) b.cyl(x0 + 0.5, 0, 4 + i * 4, 0.15, 0.15, FH, 'rust', { seg: 8 });
      const sw = b.item('switch', 'power', cx + 3.5, 1.4, 19.75, Math.PI, {});
      sw.label = 'Restore power';
      sw.onUse = (g) => {
        if (refs.powered) { g.ui.hint('The power is already on.', 2); return; }
        refs.powered = true; sw.label = 'Breaker (on)';
        g.audio.play('clang', sw.pos, { vol: 0.8 }); g.audio.play('impact', sw.pos, { vol: 0.7 });
        mainsLights.forEach((L, i) => setTimeout(() => { L.on = true; if (i % 5 === 0) g.audio.play('click', L.pos, { vol: 0.4 }); }, 200 + i * 60));
        g.audio.loop('buzz', 0.35); g.audio.loop('hum', 0.25);
        g.emitNoise(sw.pos, 60, 'slam');
        setTimeout(() => g.audio.play('announce', b.anchors.speaker[0].pos, { vol: 0.6, dur: 4 }), 3000);
        g.hallucinations.bump(0.08);
      };
      refs.power = sw.pos.clone();
    }
    if (type === 'stairsUp') {
      // steps rising toward -z from z=17.5 (y≈0) to z=4 (y=FH+0.3); a walking lane runs along the east side
      const n = 18, rise = (FH + 0.3) / n, run = 13.5 / n;
      for (let i = 0; i < n; i++) { const top = (i + 1) * rise; const z1s = 17.5 - i * run; b.boxMM(-55.5, 0, z1s - run, -50, top, z1s, 'darkConcrete', { surface: 'concrete', tex: 1, climbable: false }); }
      const lane = roomNode(-48, 18.8, []); const sb = roomNode(-52.7, 18.8, []); const st = b.node(-52.7, 3.2, FH + 0.3, ['indoor']);
      b.chain([inner, lane, sb, st]);
      upStair = { bottom: sb, top: st };
    }
    if (type === 'stairsDown') {
      const n = 16, drop = 4.5 / n, run = 13.5 / n;
      for (let i = 0; i < n; i++) { const top = -(i + 1) * drop; const zA = 17.5 - (i + 1) * run; b.boxMM(39.6, BASE.y - 0.3, zA, 45.4, top, zA + run, 'darkConcrete', { surface: 'concrete', tex: 1, climbable: false }); }
      b.boxMM(39.3, -0.3, 4, 39.6, 1.0, 17.5, 'rust', { surface: 'metal' }); // railing between lane and stairwell
      const lane = roomNode(37.7, 18.8, []); const top = roomNode(42.5, 18.8, []); const bot = b.node(42.5, 3.2, BASE.y, ['indoor']);
      b.chain([inner, lane, top, bot]);
      downStair = { top, bottom: bot };
    }
    return { inner, deep, doorN };
  };
  let upStair, downStair;
  for (const [x0, x1, t] of north) buildRoom(x0, x1, 2, BZ1, t, 'n');
  for (const [x0, x1, t] of south) buildRoom(x0, x1, BZ0, -2, t, 's');
  // lobby + waiting hall
  { const f = new Frame(b, 0, 0, 0, 0);
    f.box(0, 0.55, -24, 6, 1.1, 1.2, 'darkWood', { surface: 'wood' }); f.box(0, 1.15, -24, 6.2, 0.06, 1.4, 'darkConcrete', { collide: false });
    for (let r = 0; r < 3; r++) for (let i = 0; i < 6; i++) chair(f, -12 + i * 1.0, -10 + r * 2.4, 2, 'fabricBlue');
    for (let r = 0; r < 3; r++) for (let i = 0; i < 6; i++) chair(f, 7 + i * 1.0, -10 + r * 2.4, 2, 'fabricBlue');
    const dirInfo = new THREE.Mesh(new THREE.PlaneGeometry(4, 2.2), new THREE.MeshStandardMaterial({ map: textTexture(['WARD A  ←', 'RECORDS  ↑', 'THEATRE B  ↓'], { w: 512, h: 280, bg: '#2a3a3a', fg: '#c0d0c8', font: 'bold 44px Arial' }), roughness: 0.7 }));
    dirInfo.position.set(0, 2.6, -16.12); dirInfo.rotation.y = Math.PI; b.root.add(dirInfo);
    b.light(0, FH - 0.4, -24, 0xffe0c0, 6, 10, { flicker: 0.6, broken: 0.4, glowSize: 0.5 });
    const L2 = b.light(0, FH - 0.3, -9, 0xd8e8ff, 10, 14, { on: false, flicker: 0.2, glowSize: 0.6 }); mainsLights.push(L2);
  }
  const lobbyNodes = [b.node(0, -34, 0, ['spawn', 'exit']), b.node(0, -29, 0, ['indoor']), b.node(-6, -20, 0, ['indoor', 'activity']), b.node(6, -20, 0, ['indoor', 'activity']), b.node(-8, -6, 0, ['indoor', 'activity']), b.node(8, -6, 0, ['indoor', 'hide']), b.node(0, -12, 0, ['indoor'])];
  lobbyNodes[0].door = frontDoorL; lobbyNodes[4].activity = 'sit';
  b.chain([lobbyNodes[0], lobbyNodes[1], lobbyNodes[6], spine[Math.floor(spine.length / 2)]]); b.link(lobbyNodes[1], lobbyNodes[2]); b.link(lobbyNodes[1], lobbyNodes[3]); b.link(lobbyNodes[6], lobbyNodes[4]); b.link(lobbyNodes[6], lobbyNodes[5]);
  const outside = [b.node(0, -48, 0, ['activity', 'exit', 'spawn']), b.node(-30, -58, 0, ['activity', 'hide']), b.node(30, -60, 0, ['activity']), b.node(0, -90, 0, ['exit', 'spawn']), b.node(-58, 18, 0, ['activity'])];
  b.chain([outside[3], outside[0], lobbyNodes[0]]); b.link(outside[0], outside[1]); b.link(outside[0], outside[2]); b.link(outside[1], outside[3]);
  // west side door
  const sideDoor = b.door(BX0, 0, BZ0 + 18, 2, 2.4, 'z', 'doorMetal', {}); const sdn = b.node(BX0, BZ0 + 18, 0, ['indoor']); sdn.door = sideDoor; b.chain([outside[4], sdn, b.node(-53, 2.5, 0, ['indoor'])]);

  // ---------------- upper floor: the long hallway ----------------
  const UY = FH + 0.3;
  b.wall(-46, -2, BX1, -2, UY, FH, 0.18, W, []); b.wall(-46, 2, BX1, 2, UY, FH, 0.18, W, [{ at: 20, w: 1.4, y0: 0, y1: 2.4 }, { at: 60, w: 1.4, y0: 0, y1: 2.4 }]);
  b.boxMM(-56, UY + FH, -2, BX1, UY + FH + 0.3, 2, 'plaster');
  for (let x = -40; x <= 52; x += 8) { b.box(x, UY + FH - 0.05, 0, 1.4, 0.08, 0.35, 'lampCold', { collide: false, cast: false }); const L = b.light(x, UY + FH - 0.3, 0, 0xd8e8ff, 7, 10, { on: false, flicker: 0.4, broken: 0.35, glowSize: 0.5 }); mainsLights.push(L); }
  b.door(-26, UY, 2, 1.4, 2.4, 'x', 'doorWhite', { locked: true }); b.door(14, UY, 2, 1.4, 2.4, 'x', 'doorWhite', { locked: true });
  const up = []; for (let x = -50; x <= 52; x += 8) up.push(b.node(x, 0, UY, ['indoor'])); b.chain(up);
  if (upStair) b.link(upStair.top, up[0]);
  b.anchors.hallEnd.push({ pos: new THREE.Vector3(54, UY, 0) });
  b.light(54, UY + 2, 0, 0xff3020, 1.5, 6, { glowSize: 0.2 });

  // ---------------- basement ----------------
  const BY = BASE.y;
  b.boxMM(BASE.x0, BY - 0.3, BASE.z0, BASE.x1, BY, BASE.z1, 'darkConcrete', { surface: 'concrete', tex: 3 });
  b.wall(BASE.x0, BASE.z0, BASE.x1, BASE.z0, BY, 4.5, 0.3, 'darkConcrete', []);
  b.wall(BASE.x0, BASE.z1, BASE.x1, BASE.z1, BY, 4.5, 0.3, 'darkConcrete', []);
  b.wall(BASE.x0, BASE.z0, BASE.x0, BASE.z1, BY, 4.5, 0.3, 'darkConcrete', []); b.wall(BASE.x1, BASE.z0, BASE.x1, BASE.z1, BY, 4.5, 0.3, 'darkConcrete', []);
  // basement corridor wall (north side) with openings
  b.wall(BASE.x0, 2.5, BASE.x1, 2.5, BY, 4.5, 0.25, 'hospitalWall', [{ at: 8, w: 1.6, y0: 0, y1: 2.4 }, { at: 23, w: 1.6, y0: 0, y1: 2.4 }, { at: 38, w: 2.4, y0: 0, y1: 2.6 }, { at: 51, w: 8.4, y0: 0, y1: 3 }, { at: 61, w: 6, y0: 0, y1: 3 }]);
  for (const x of [6, 20, 36, 46]) b.wall(x, 2.5, x, BASE.z1, BY, 4.5, 0.25, 'hospitalWall', []);
  for (let x = -6; x < 56; x += 7) { const L = b.light(x, BY + 3.9, 0.2, 0xffd0a0, 5, 9, { flicker: 0.5, broken: 0.45, glowSize: 0.4 }); if (x > 30) mainsLights.push(L), L.on = false; }
  // boiler room: pipes and tanks
  for (let i = 0; i < 3; i++) b.cyl(-6 + i * 4, BY, 12, 1.2, 1.2, 3.2, 'rust', { seg: 14, collide: true });
  for (let z = 3; z < 20; z += 3) b.cyl(-9.5, BY, z, 0.12, 0.12, 4.5, 'rust', { seg: 6 });
  b.emitters.push({ pos: new THREE.Vector3(-2, BY + 1.5, 12), sound: 'clang', interval: [14, 35], vol: 0.5 });
  // morgue: drawer wall
  for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) b.box(7.2 + c * 2.1, BY + 0.6 + r * 1.1, BASE.z1 - 0.5, 1.9, 1.0, 0.8, 'chrome', { collide: false });
  b.world.addBox(6.2, BY, BASE.z1 - 1, 20, BY + 3.4, BASE.z1, { surface: 'metal' });
  { const f = new Frame(b, 0, 0, 0, BY); hospBed(f, 12, 8, 1); }
  // Theatre B
  { const cx = 28, cz = 11;
    b.box(cx, BY + 0.5, cz, 1.0, 1.0, 2.2, 'rust', { surface: 'metal' });
    b.cyl(cx, BY + 3.2, cz, 0.8, 0.45, 0.3, 'rust', { seg: 14 });
    b.item('symbol', 'sym_4', cx, BY + 1.02, cz, 0, {}).mesh.rotation.x = -Math.PI / 2;
    b.item('recording', 'hos_tape', cx + 3.5, BY + 0.95, cz + 5, 0);
    b.box(cx + 3.5, BY + 0.45, cz + 5, 1.2, 0.9, 0.6, 'whiteMetal');
    const L = b.light(cx, BY + 3.0, cz, 0xc0d8ff, 8, 9, { flicker: 0.8, broken: 0.3, glowSize: 0.7 });
    b.emitters.push({ pos: new THREE.Vector3(cx, BY + 1, cz), sound: 'whisper', interval: [20, 50], vol: 0.25, opts: { dur: 2 } });
    refs.theatre = new THREE.Vector3(cx - 7, BY, 1);
    const rift = b.item('rift', 'rift_4', cx, BY, cz - 6, 0); rift.mesh.visible = false; rift.hidden = true; refs.rift = rift.pos;
    b.anchors.hallEnd.push({ pos: new THREE.Vector3(BASE.x0 + 1, BY, 0) });
  }
  const bnodes = []; for (let x = -7; x <= 53; x += 6) bnodes.push(b.node(x, 0.3, BY, ['indoor'])); b.chain(bnodes);
  const nb = (x) => bnodes.reduce((a, n) => (Math.abs(n.pos.x - x) < Math.abs(a.pos.x - x) ? n : a), bnodes[0]);
  for (const [x, z] of [[-2, 8], [13, 10], [28, 7], [52, 12]]) { const n = b.node(x, z, BY, ['indoor', 'hide']); b.link(n, nb(x)); }
  if (downStair) b.link(downStair.bottom, nb(41));
  // elevator: a platform that moves between basement and ground when powered
  const elev = { y: BY, target: BY, box: b.world.addBox(47.2, BY - 0.3, 6.2, 54.8, BY, 17.8, { surface: 'metal', climbable: false }) };
  const platform = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.3, 11.6), b.m('metal')); platform.receiveShadow = true; b.root.add(platform);
  for (const [x0, z0, x1, z1] of [[46.8, 5.8, 47.2, 18.2], [54.8, 5.8, 55.2, 18.2], [47.2, 17.8, 54.8, 18.2]]) b.boxMM(x0, BY, z0, x1, FH, z1, 'metal', { surface: 'metal' });
  const call = (y, z) => { const it = b.item('switch', 'elev' + y, 49, y + 1.3, z, 0, {}); it.label = 'Call the elevator'; it.onUse = (g) => { if (!refs.powered) { g.audio.play('click', it.pos, { vol: 0.6 }); g.ui.hint('Nothing. No power.', 2); return; } elev.target = elev.target > BY + 1 ? BY : 0; g.audio.play('ding', it.pos, { vol: 0.5 }); g.audio.loop('hum#elev', 0.3, it.pos); }; };
  call(BY, 5.4); call(0, 5.4);

  // ---------------- spawn + population ----------------
  b.spawns.player.set(-6, 0, -70); b.spawns.playerYaw = 0;
  const initial = [];
  const explorerSpots = [lobbyNodes[2], lobbyNodes[3], spine[3], spine[12], spine[16], outside[1], outside[2], lobbyNodes[4]];
  explorerSpots.forEach((n, i) => initial.push({ pos: n.pos.clone(), outfit: 'explorer', home: n.pos.clone(), roam: 60, flashlight: true, personality: i === 0 ? 'brave' : undefined }));
  initial.push({ pos: spine[8].pos.clone(), outfit: 'guard', role: 'guard', personality: 'brave', flashlight: true, home: spine[8].pos.clone(), roam: 100, patrol: [spine[1], spine[spine.length - 2], lobbyNodes[1], spine[9]] });
  initial.push({ pos: bnodes[3].pos.clone(), outfit: 'patient', role: 'lost', personality: 'panicked', home: bnodes[3].pos.clone(), roam: 30, lost: true });
  initial.push({ pos: up[5].pos.clone(), outfit: 'patient', role: 'lost', personality: 'nervous', home: up[5].pos.clone(), roam: 40, lost: true });

  b.anomalies = [
    { pos: new THREE.Vector3(0, 2.6, -16), apply: () => { mainsLights.forEach((L) => { L.hallOff = true; }); }, revert: () => { mainsLights.forEach((L) => { L.hallOff = false; }); } },
    { pos: frontDoorL.pos.clone().setY(1.4), apply: () => { if (!frontDoorL.open) frontDoorL.target = 1.4; }, revert: () => { if (!frontDoorL.open) frontDoorL.target = 0; } },
  ];
  refs.entrance = new THREE.Vector3(0, 0, -33);
  const inside = (p) => (p.x > BX0 && p.x < BX1 && p.z > BZ0 && p.z < BZ1) || (p.x > -16 && p.x < 16 && p.z > -32 && p.z < BZ0) || p.y < -1;
  return {
    kind: 'hospital', name: "St. Aldric's", chapter: 4,
    env: {
      sky: { top: '#030405', horizon: '#14181c', stars: 0.4 }, fogColor: 0x0c0e10, fogDensity: 0.028,
      ambient: { sky: 0x4a5258, ground: 0x141210, intensity: 1.1 }, moon: { color: 0x9aa8c0, intensity: 1.0, dir: [0.4, 1, -0.6] },
      exposure: 1.05, grade: { tint: [0.95, 1.02, 1.0], lift: [0.004, 0.006, 0.006], desat: 0.45 }, wind: 0.8, motes: true, moteColor: 0xa0a090, reverb: [3.5, 2], reverbMix: 0.5, visibility: 0.15,
    },
    loops: [['wind', 0.2], ['drone', 0.14]],
    emitters: b.emitters,
    bounds: { minX: -108, maxX: 108, minZ: -103, maxZ: 63 },
    populationDef: { initial, max: 13, respawnMin: 40, respawnMax: 90 },
    randomNPCDef: (pos) => ({ pos, outfit: 'explorer', home: pos.clone(), roam: 60, flashlight: true }),
    searcherOutfit: 'searcher', allowCalls: true, npcsCanLeave: true,
    lines: { chat: ['This place gives me the creeps.', 'Are you still recording?', 'That door was closed a minute ago.', 'Say something for the audio... anything.', 'They say a kid went missing in here.', 'Why is it colder in this corridor?', 'Did you hear the PA? It\'s been dead for thirty years.', 'Stay where I can see your light.'] },
    ambientEvents: [
      { every: [18, 45], fn: (g) => g.audio.play('clang', g.monster.pos.clone().add(new THREE.Vector3(rand(-40, 40), rand(-4, 4), rand(-20, 20))), { vol: 0.5 }) },
      { every: [40, 90], fn: (g) => g.audio.play('announce', pick(b.anchors.speaker).pos, { vol: 0.35, dur: rand(2, 4) }) },
      { every: [25, 60], fn: (g) => g.audio.play('drip', g.monster.pos.clone().add(new THREE.Vector3(rand(-6, 6), 2, rand(-6, 6))), { vol: 0.4 }) },
    ],
    isInside: inside,
    update: (dt) => {
      // elevator
      elev.y += Math.sign(elev.target - elev.y) * Math.min(Math.abs(elev.target - elev.y), dt * 1.2);
      elev.box.miny = elev.y - 0.3; elev.box.maxy = elev.y; platform.position.set(51, elev.y - 0.15, 12);
      if (Math.abs(elev.target - elev.y) < 0.01) game.audio.loop('hum#elev', 0);
      // dampen the moon indoors
      const inn = inside(game.monster.pos);
      game.map.moon.intensity += ((inn ? 0.35 : 1.0) - game.map.moon.intensity) * Math.min(1, dt * 2);
    },
    refs,
  };
}
