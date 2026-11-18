// MAP 5 — THE OTHER SIDE. Fragments of every place it has fed, adrift in a void.
// Impossible stairs, an endless hallway, objects hanging in the air, a house that
// shouldn't be here, and at the end of the last bridge: The Presence, waiting.
import * as THREE from 'three';
import { house, streetLight, car, plantTrees, Frame, bed, chair, gableGeo } from './props.js';
import { buildPresence } from '../actors/presence.js';
import { mulberry32, rand, pick } from '../core/util.js';
import { textTexture } from '../core/textures.js';

export function buildOther(game, b) {
  const R = mulberry32(5005); const rr = (a, c) => a + R() * (c - a);
  b.defaultSurface = 'void';
  b.world.terrain = () => -400; b.world.killY = -45;
  const refs = {};
  const plat = (x, y, z, sx, sz, mat = 'void', surf = 'void') => { b.box(x, y - 1.5, z, sx, 3, sz, mat, { surface: surf, tex: 4 }); // underside "roots"
    for (let i = 0; i < 4; i++) { const g = new THREE.ConeGeometry(rr(1, 3), rr(4, 12), 6); g.rotateX(Math.PI); g.translate(x + rr(-sx / 3, sx / 3), y - 3 - rr(2, 5), z + rr(-sz / 3, sz / 3)); b.geo(g, 'flesh', { cast: false }); } };
  const bridge = (a, c, y0, y1, w = 2.4, mat = 'bone') => {
    const dx = c[0] - a[0], dz = c[1] - a[1]; const L = Math.hypot(dx, dz); const n = Math.ceil(L / 1.2); const yaw = Math.atan2(dx, dz);
    for (let i = 0; i <= n; i++) { const t = i / n; const x = a[0] + dx * t, z = a[1] + dz * t, y = y0 + (y1 - y0) * t; const g = new THREE.BoxGeometry(w, 0.25, 1.3); g.rotateY(yaw); g.translate(x, y - 0.12, z); b.geo(g, mat); b.world.box(x, y - 0.15, z, Math.abs(Math.cos(yaw)) > 0.7 ? w : 1.4, 0.3, Math.abs(Math.cos(yaw)) > 0.7 ? 1.4 : w, { surface: 'flesh', climbable: false }); }
    const nodes = []; for (let i = 0; i <= Math.ceil(L / 10); i++) { const t = i / Math.ceil(L / 10); nodes.push(b.node(a[0] + dx * t, a[1] + dz * t, y0 + (y1 - y0) * t, [])); } b.chain(nodes); return nodes;
  };
  // ---------------- spawn platform ----------------
  plat(0, 0, 0, 22, 22, 'void');
  const pA = b.node(0, 0, 0, ['activity', 'spawn']);
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; b.box(Math.cos(a) * 9, 3, Math.sin(a) * 9, 0.6, 6, 0.6, 'bone', { surface: 'void' }); }
  b.item('symbol', 'sym_5', 0, 0.02, 0, 0).mesh.rotation.x = -Math.PI / 2;

  // ---------------- suburb fragment (north) ----------------
  const nB = bridge([0, 11], [0, 48], 0, 0);
  b.link(pA, nB[0]);
  plat(0, 0, 62, 30, 26, 'asphalt', 'asphalt');
  b.box(0, 0.06, 62, 30, 0.1, 4, 'sidewalk', { collide: false, cast: false });
  streetLight(b, -12, 56, 0.3, { flicker: 0.6 }); streetLight(b, 12, 68, Math.PI + 0.2, { broken: 0.5 });
  // a swing set with the raincoat (echo 1)
  b.box(-8, 1.3, 66, 3.4, 0.08, 0.08, 'rust', { collide: false }); for (const s of [-1.7, 1.7]) b.box(-8 + s, 0.65, 66, 0.08, 1.3, 0.08, 'rust', { collide: false });
  b.item('note', 'oth_echo1', -8, 1.1, 66, 0, {});
  const coat = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.8, 10), b.m('neonRed')); coat.position.set(-8, 1.6, 66.3); b.root.add(coat);
  const pB = b.node(0, 0, 60, ['activity']); b.link(nB[nB.length - 1], pB); const pB2 = b.node(-8, 0, 64, ['activity']); b.link(pB, pB2);

  // ---------------- forest fragment (north-east, up an impossible stair) ----------------
  const st = []; for (let i = 0; i < 26; i++) { const t = i / 25; const x = 14 + t * 18, z = 70 + t * 14, y = t * 9; b.box(x, y - 0.15, z, 2.6, 0.3, 1.4, 'bone', { surface: 'flesh', climbable: false }); }
  plat(44, 9, 94, 24, 22, 'forestFloor', 'leaves');
  plantTrees(b, [{ x: 38, z: 90, y: 9, s: 1.2, type: 'pine' }, { x: 50, z: 98, y: 9, s: 1.0, type: 'dead' }, { x: 48, z: 86, y: 9, s: 1.3, type: 'pine' }]);
  // upside-down trees hanging beneath
  { const trees = [{ x: 44, z: 94, y: 6, s: 1.2, rot: 0, type: 'pine' }]; plantTrees(b, trees, { collide: false }); }
  { const g = new THREE.CylinderGeometry(0.01, 1.6, 1.6, 4, 1, true); g.scale(1, 1, 1.4); g.translate(42, 9.8, 100); b.geo(g, 'tarp'); }
  b.item('note', 'oth_echo2', 42, 9.3, 98.2, 0, { flat: true });
  const sN = bridge([14, 70], [32, 84], 0, 9, 2.6); b.link(pB, sN[0]); const pC = b.node(44, 94, 9, ['activity']); b.link(sN[sN.length - 1], pC);

  // ---------------- city fragment (west) ----------------
  const wB = bridge([-11, 0], [-48, 6], 0, 0);
  b.link(pA, wB[0]);
  plat(-62, 0, 8, 26, 22, 'wetSidewalk', 'concrete');
  { const fr = new THREE.Group(); const door = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.2, 0.08), b.m('darkWood')); door.position.y = 1.1; fr.add(door); const num = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.15), new THREE.MeshBasicMaterial({ map: textTexture('4C', { w: 128, h: 64, bg: '#222', fg: '#c8b080', font: 'bold 44px Georgia' }) })); num.position.set(0, 1.8, 0.05); fr.add(num); fr.position.set(-62, 0, 12); b.root.add(fr); b.world.box(-62, 1.1, 12, 1.2, 2.2, 0.2, { surface: 'wood' }); }
  b.item('note', 'oth_echo3', -62, 1.4, 12.2, 0, {});
  streetLight(b, -70, 4, 1, { cold: true, flicker: 0.3 });
  const floatCar = car(b, -60, 0, 0.4, 'carPaintBlack', { y: 6, dynamic: true, noCollide: true });
  const pD = b.node(-62, 0, 6, ['activity']); b.link(wB[wB.length - 1], pD);

  // ---------------- the endless hallway (south) ----------------
  const HZ0 = -11, HZ1 = -111;
  b.box(0, -0.15, (HZ0 + HZ1) / 2, 5, 0.3, HZ0 - HZ1, 'dirtyTile', { surface: 'tile', tex: 2.4 });
  b.box(0, 3.6, (HZ0 + HZ1) / 2, 5, 0.3, HZ0 - HZ1, 'plaster', { collide: true });
  for (const s of [-1, 1]) {
    const ops = []; for (let z = 5; z < 100; z += 10) ops.push({ at: z, w: 1.4, y0: 0, y1: 2.4 });
    b.wall(s * 2.5, HZ1, s * 2.5, HZ0, 0, 3.6, 0.2, 'hospitalWall', ops);
    for (let z = HZ0 - 5; z > HZ1; z -= 10) { const d = b.door(s * 2.5, 0, z, 1.4, 2.4, 'z', 'doorWhite', { locked: true }); }
  }
  const hallLights = [];
  for (let z = HZ0 - 5; z > HZ1; z -= 10) { b.box(0, 3.4, z, 1.4, 0.08, 0.35, 'lampCold', { collide: false, cast: false }); hallLights.push(b.light(0, 3.2, z, 0xd8e8ff, 6, 10, { flicker: 0.2, broken: 0.2, glowSize: 0.5 })); }
  const hall = []; for (let z = HZ0; z >= HZ1; z -= 10) hall.push(b.node(0, z, 0, [])); b.chain(hall); b.link(pA, hall[0]);
  b.anchors.hallEnd.push({ pos: new THREE.Vector3(0, 0, HZ1 + 2) });
  plat(0, 0, -124, 20, 20, 'dirtyTile', 'tile');
  { const f = new Frame(b, 0, -124, 0, 0); f.box(0, 0.5, 0, 0.95, 0.08, 2.0, 'whiteMetal', { surface: 'metal' }); f.box(0, 0.65, 0.05, 0.9, 0.18, 1.9, 'sheet', { collide: false }); }
  b.item('note', 'oth_echo4', 0, 0.8, -124, 0.3, { flat: true });
  const pE = b.node(0, -120, 0, ['activity']); b.link(hall[hall.length - 1], pE);

  // ---------------- home: 13 Ashgrove, floating, tilted ----------------
  const hB = bridge([44, 105], [20, 150], 9, 18, 2.2);
  b.link(pC, hB[0]);
  plat(10, 18, 165, 30, 26, 'grass', 'grass');
  const h = house(b, 10, 165, 2, { lit: true, siding: 'sidingRot', w: 11, d: 9, y: 18 });
  refs.house = new THREE.Vector3(10, 18, 165);
  b.link(hB[hB.length - 1], h.nodes.out);
  // ---------------- the last bridge to The Presence ----------------
  const fB = bridge([10, 178], [10, 250], 18, 18, 1.6, 'bone');
  b.link(h.nodes.back, fB[0]);
  plat(10, 18, 262, 14, 14, 'void');
  const presence = buildPresence('stand'); presence.scale.setScalar(1.35); presence.position.set(10, 18, 262); presence.rotation.y = Math.PI; b.root.add(presence);
  refs.presence = presence.position;
  b.light(10, 26, 262, 0xb0a0ff, 12, 18, { glowSize: 0.2, flicker: 0.05 });

  // ---------------- floating debris ----------------
  const floaters = [];
  const mats = ['darkWood', 'whiteMetal', 'fabricRed', 'sidingRot', 'rust', 'bone'];
  for (let i = 0; i < 70; i++) {
    const g = new THREE.Group(); const kind = i % 5;
    if (kind === 0) { const f = new Frame({ ...b, root: g, geo: () => {}, box: (cx, cy, cz, sx, sy, sz, m) => { const mm = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), b.m(m)); mm.position.set(cx, cy, cz); g.add(mm); }, world: { box() {} } }, 0, 0, 0, 0); chair(f, 0, 0, 0); }
    else if (kind === 1) { const m = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.1, 0.08), b.m('doorWhite')); g.add(m); }
    else if (kind === 2) { const m = new THREE.Mesh(new THREE.BoxGeometry(rr(1, 4), rr(1, 4), rr(1, 4)), b.m(pick(mats))); g.add(m); }
    else if (kind === 3) { const m = new THREE.Mesh(new THREE.SphereGeometry(rr(0.4, 1.2), 10, 8), b.m('flesh')); g.add(m); }
    else { const m = new THREE.Mesh(gableGeo(4, 3, 1.5, 0.2), b.m('roof')); g.add(m); }
    const r = rr(30, 160), a = R() * Math.PI * 2;
    g.position.set(Math.cos(a) * r, rr(-20, 45), Math.sin(a) * r + 60); g.rotation.set(R() * 6, R() * 6, R() * 6);
    g.traverse((o) => { o.castShadow = false; });
    b.root.add(g); floaters.push({ g, spin: new THREE.Vector3(rr(-0.2, 0.2), rr(-0.2, 0.2), rr(-0.2, 0.2)), bob: R() * 6 });
  }
  // a hanging staircase going nowhere, and an upside-down room
  for (let i = 0; i < 20; i++) b.box(-30 + i * 0.4, 12 + i * 0.35, 40, 1.6, 0.25, 0.9, 'darkWood', { collide: false });
  { const g = new THREE.Group(); const fl = new THREE.Mesh(new THREE.BoxGeometry(8, 0.2, 8), b.m('woodFloor')); g.add(fl); const w1 = new THREE.Mesh(new THREE.BoxGeometry(8, 3, 0.2), b.m('wallpaper')); w1.position.set(0, -1.5, -4); g.add(w1); const bedm = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 2), b.m('sheet')); bedm.position.set(2, -0.35, -1.5); g.add(bedm); g.position.set(30, 30, 20); b.root.add(g); }
  for (const p of [[40, 20, 30], [-40, 25, 80], [60, 15, 160], [-20, 35, -60], [0, 40, 120]]) b.anchors.impossible.push({ pos: new THREE.Vector3(...p) });
  for (const p of [[0, 0, 60], [44, 9, 94], [-62, 0, 8], [10, 18, 165]]) b.anchors.far.push({ pos: new THREE.Vector3(p[0] + 8, p[1], p[2] + 8) });

  b.spawns.player.set(0, 0, 4); b.spawns.playerYaw = 0;
  // the lost: grey echoes of people
  const initial = [];
  for (const n of [pB, pB2, pC, pD, pE, hall[4]]) initial.push({ pos: n.pos.clone(), outfit: 'lost', role: 'lost', lost: true, home: n.pos.clone(), roam: 30, personality: 'calm', walkSpeed: 0.8 });

  b.anomalies = [{ pos: new THREE.Vector3(0, 1, 60), apply: () => { coat.visible = false; }, revert: () => { coat.visible = true; } }];
  let loopsWarned = false; const _v = new THREE.Vector3();
  return {
    kind: 'other', name: 'The Other Side', chapter: 5,
    env: {
      sky: { top: '#0a0210', horizon: '#3a0a1a', stars: 1.2, tint: 'rgba(120,20,60,0.35)' }, fogColor: 0x1a0612, fogDensity: 0.016,
      ambient: { sky: 0x6a3a6a, ground: 0x200810, intensity: 1.3 }, moon: { color: 0xc080a0, intensity: 1.2, dir: [-0.2, 1, 0.6] },
      exposure: 1.1, grade: { tint: [1.08, 0.92, 1.05], lift: [0.012, 0.0, 0.012], desat: 0.15 }, wind: 0.4, motes: true, moteColor: 0xb070c0, fogBanks: 0.8, fogColor2: 0x5a2040, reverb: [5, 1.5, true], reverbMix: 0.65, visibility: 0.3, envIntensity: 0.5,
    },
    loops: [['void', 0.7], ['drone', 0.18]],
    emitters: [{ pos: new THREE.Vector3(10, 19, 262), sound: 'whisper', interval: [8, 20], vol: 0.4, opts: { dur: 2.5 } }, { pos: new THREE.Vector3(0, 1, -60), sound: 'knock', interval: [10, 25], vol: 0.5 }],
    bounds: { minX: -200, maxX: 200, minZ: -200, maxZ: 320 },
    populationDef: { initial, max: 6, respawnMin: 60, respawnMax: 120 },
    randomNPCDef: (pos) => ({ pos, outfit: 'lost', role: 'lost', lost: true, home: pos.clone(), roam: 30, walkSpeed: 0.8 }),
    searcherOutfit: null, allowCalls: false, npcsCanLeave: false,
    lines: { chat: ['...is this the way home?', 'I was waiting for the bus.', 'Mum? Mum, is that you?', 'I can\'t remember my name.', 'It\'s always night here.', 'He said he\'s sorry.'], recognize: ['Oh. It\'s you.', 'You came back.', 'Not again. Not again.'], flee: ['...', 'Please don\'t.', 'Run. Run.'] },
    ambientEvents: [
      { every: [20, 45], fn: (g) => g.audio.play('heartbeat', null, { vol: 0.35 }) },
      { every: [25, 60], fn: (g) => g.audio.play('tone', g.monster.pos.clone().add(new THREE.Vector3(rand(-30, 30), 10, rand(-30, 30))), { f: pick([220, 233, 277, 311]), vol: 0.25, dur: 3 }) },
    ],
    update: (dt, t) => {
      const m = game.monster;
      for (const f of floaters) { f.g.rotation.x += f.spin.x * dt; f.g.rotation.y += f.spin.y * dt; f.g.rotation.z += f.spin.z * dt; f.g.position.y += Math.sin(t * 0.3 + f.bob) * 0.01; }
      floatCar.rotation.y += dt * 0.05; floatCar.position.y = 6 + Math.sin(t * 0.4) * 0.5;
      if (Math.random() < dt * 3) game.fx.voidMotes(m.pos, 1);
      // the hallway looks far longer than it is: the image stretches the deeper you go and the
      // lights ahead die one by one. (Only what you see changes — your body is never moved.)
      const inHall = Math.abs(m.pos.x) < 2.6 && m.pos.z < HZ0 && m.pos.z > HZ1;
      const depth = inHall ? (HZ0 - m.pos.z) / (HZ0 - HZ1) : 0;
      game.post.stretch = Math.max(game.post.stretch, Math.sin(Math.min(1, depth * 1.2) * Math.PI) * 0.9);
      for (const L of hallLights) L.hallOff = inHall && L.pos.z < m.pos.z - 12 - Math.sin(t * 0.7) * 6;
      if (inHall && !loopsWarned && depth > 0.35) { loopsWarned = true; game.audio.play('whisper', m.headPos().add(_v.set(0, 0, 1)), { vol: 0.4, dur: 1.5 }); }
      // the Presence: it does not vanish here. It waits.
      const c = game.camera.position; presence.rotation.y = Math.atan2(c.x - presence.position.x, c.z - presence.position.z);
      const d = m.pos.distanceTo(presence.position);
      if (d < 30) game.post.presence = Math.max(game.post.presence, (1 - d / 30) * 0.9);
      const S = game.story;
      if (game.mode === 'story' && S.current && S.current.id === 'presence' && d < 4.5 && !game.ending) game.triggerEnding();
      const allowed = game.mode === 'story' && S.current && S.current.id === 'presence';
      if (!allowed && presence.visible && d < 18) { presence.visible = false; game.post.glitch = 1; game.audio.play('static', null, { vol: 0.2, dur: 0.2 }); }
      else if (!presence.visible && (d > 40 || allowed)) presence.visible = true;
    },
    refs,
  };
}
