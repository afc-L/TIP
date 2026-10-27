// Low-poly models built from primitives. Geometry and materials are cached and shared.
import * as THREE from 'three';

const matCache = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  let m = matCache.get(key);
  if (!m) {
    if (opts.basic) m = new THREE.MeshBasicMaterial({ color, transparent: !!opts.transparent, opacity: opts.opacity ?? 1, depthWrite: !opts.transparent, side: opts.side ?? THREE.FrontSide, blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending, fog: opts.fog !== false });
    else m = new THREE.MeshLambertMaterial({ color, flatShading: true, emissive: opts.emissive ?? 0x000000, transparent: !!opts.transparent, opacity: opts.opacity ?? 1 });
    matCache.set(key, m);
  }
  return m;
}

const geoCache = new Map();
function geo(key, make) {
  let g = geoCache.get(key);
  if (!g) { g = make(); geoCache.set(key, g); }
  return g;
}
export const box = (w, h, d) => geo(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
export const cyl = (rt, rb, h, s = 6) => geo(`c${rt},${rb},${h},${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s));
export const cone = (r, h, s = 6) => geo(`k${r},${h},${s}`, () => new THREE.ConeGeometry(r, h, s));
export const ico = (r, d = 0) => geo(`i${r},${d}`, () => new THREE.IcosahedronGeometry(r, d));
export const sph = (r, w = 8, h = 6) => geo(`s${r},${w},${h}`, () => new THREE.SphereGeometry(r, w, h));

export function mesh(g, m, x = 0, y = 0, z = 0, parent) {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  if (parent) parent.add(o);
  return o;
}

function shadowAll(obj, cast = true) {
  obj.traverse((o) => { if (o.isMesh) { o.castShadow = cast; } });
}

// ---------- Characters ----------

// A jointed humanoid. Faces +Z. Pivots: legs at hips, torso at hips, arms at shoulders, head on torso.
export function humanoid(o = {}) {
  const legH = o.legH ?? 0.8, torsoH = o.torsoH ?? 0.72, w = o.width ?? 0.52, armL = o.armLen ?? 0.68;
  const skin = mat(o.skin ?? 0xf0c090);
  const bodyM = mat(o.body ?? 0x4466aa);
  const legM = mat(o.legs ?? 0x553322);
  const armM = mat(o.arms ?? o.body ?? 0x4466aa);
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const legs = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(s * w * 0.24, legH, 0);
    mesh(box(o.legW ?? 0.18, legH, 0.2), legM, 0, -legH / 2, 0, leg);
    if (o.boots) mesh(box(0.22, 0.16, 0.3), mat(o.boots), 0, -legH + 0.08, 0.04, leg);
    body.add(leg);
    legs.push(leg);
  }
  const torso = new THREE.Group();
  torso.position.y = legH;
  body.add(torso);
  mesh(box(w, torsoH, w * 0.6), bodyM, 0, torsoH / 2, 0, torso);
  if (o.belly) mesh(ico(w * 0.55, 1), bodyM, 0, torsoH * 0.35, w * 0.12, torso).scale.set(1, 0.9, 0.85);
  if (o.belt) mesh(box(w + 0.02, 0.08, w * 0.62), mat(o.belt), 0, 0.06, 0, torso);

  const head = new THREE.Group();
  head.position.y = torsoH;
  torso.add(head);

  const arms = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(s * (w / 2 + 0.08), torsoH - 0.08, 0);
    mesh(box(0.14, armL, 0.14), armM, 0, -armL / 2, 0, arm);
    mesh(box(0.13, 0.13, 0.13), skin, 0, -armL, 0, arm);
    if (o.pauldrons) mesh(box(0.26, 0.14, 0.26), mat(o.pauldrons), 0, 0.02, 0, arm);
    const hand = new THREE.Group();
    hand.position.y = -armL;
    arm.add(hand);
    arm.userData.hand = hand;
    torso.add(arm);
    arms.push(arm);
  }
  // Right hand is on -X (character faces +Z).
  const rig = { root, body, torso, head, legL: legs[1], legR: legs[0], armL: arms[1], armR: arms[0], handR: arms[0].userData.hand, handL: arms[1].userData.hand, legH, torsoH };
  buildHead(rig, o);
  return rig;
}

function buildHead(rig, o) {
  const h = rig.head;
  const skin = mat(o.skin ?? 0xf0c090);
  const type = o.head ?? 'plain';
  if (type === 'helmet') {
    const metal = mat(o.helmet ?? 0x9aa0a8);
    mesh(box(0.42, 0.44, 0.42), metal, 0, 0.24, 0, h);
    mesh(box(0.3, 0.05, 0.05), mat(0x111111), 0, 0.27, 0.21, h);
    if (o.plume) mesh(box(0.06, 0.22, 0.36), mat(o.plume), 0, 0.54, -0.02, h);
  } else if (type === 'goblin') {
    mesh(ico(0.24, 0), skin, 0, 0.22, 0, h).scale.set(1.1, 0.95, 1);
    for (const s of [-1, 1]) { const e = mesh(cone(0.07, 0.34, 4), skin, s * 0.3, 0.28, 0, h); e.rotation.z = -s * 1.2; }
    mesh(cone(0.06, 0.18, 4), skin, 0, 0.18, 0.26, h).rotation.x = 1.5;
    for (const s of [-1, 1]) mesh(box(0.06, 0.06, 0.02), mat(0xffee33, { emissive: 0x554400 }), s * 0.09, 0.27, 0.22, h);
    mesh(cyl(0.18, 0.2, 0.18, 6), mat(0xffffff), 0, 0.46, 0, h); // chef hat
    mesh(sph(0.16, 6, 4), mat(0xffffff), 0, 0.6, 0, h);
  } else if (type === 'skull') {
    mesh(box(0.34, 0.34, 0.36), mat(0xeeeadd), 0, 0.2, 0, h);
    for (const s of [-1, 1]) mesh(box(0.09, 0.09, 0.02), mat(0x111111), s * 0.08, 0.24, 0.18, h);
    mesh(box(0.24, 0.08, 0.3), mat(0xddd8c8), 0, 0.02, 0.04, h);
  } else if (type === 'king') {
    mesh(box(0.48, 0.5, 0.46), skin, 0, 0.26, 0, h);
    for (const s of [-1, 1]) mesh(box(0.08, 0.08, 0.02), mat(0x221100), s * 0.11, 0.32, 0.24, h);
    mesh(box(0.18, 0.06, 0.02), mat(0x441100), 0, 0.16, 0.24, h);
    const beard = mesh(cone(0.3, 0.6, 5), mat(0x55bb33), 0, -0.05, 0.16, h);
    beard.rotation.x = Math.PI;
    const gold = mat(0xffcc22, { emissive: 0x332200 });
    mesh(cyl(0.28, 0.26, 0.14, 8), gold, 0, 0.56, 0, h);
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; mesh(cone(0.06, 0.18, 4), gold, Math.sin(a) * 0.24, 0.7, Math.cos(a) * 0.24, h); }
  } else if (type === 'farmer') {
    mesh(box(0.36, 0.38, 0.36), skin, 0, 0.2, 0, h);
    for (const s of [-1, 1]) mesh(box(0.06, 0.06, 0.02), mat(0x111111), s * 0.08, 0.25, 0.18, h);
    mesh(cyl(0.42, 0.42, 0.04, 8), mat(0xe8cc66), 0, 0.42, 0, h);
    mesh(cone(0.22, 0.26, 8), mat(0xe8cc66), 0, 0.56, 0, h);
    mesh(box(0.24, 0.08, 0.04), mat(0x8a5a2a), 0, 0.1, 0.18, h); // moustache
  } else if (type === 'mummy') {
    mesh(box(0.36, 0.4, 0.36), mat(0xe0d8b8), 0, 0.2, 0, h);
    for (let i = 0; i < 3; i++) mesh(box(0.38, 0.05, 0.38), mat(0xc8bf98), 0, 0.08 + i * 0.12, 0, h).rotation.z = (i - 1) * 0.15;
    for (const s of [-1, 1]) mesh(box(0.06, 0.04, 0.02), mat(0xffdd33, { emissive: 0x886600 }), s * 0.08, 0.26, 0.19, h);
  } else if (type === 'pirate' || type === 'captain') {
    mesh(box(0.36, 0.38, 0.36), skin, 0, 0.2, 0, h);
    mesh(box(0.06, 0.06, 0.02), mat(0x111111), 0.08, 0.24, 0.18, h);
    mesh(box(0.1, 0.08, 0.02), mat(0x111111), -0.08, 0.24, 0.19, h); // eyepatch
    mesh(box(0.37, 0.02, 0.02), mat(0x111111), 0, 0.27, 0.185, h).rotation.z = 0.3;
    if (type === 'captain') {
      const beard = mesh(cone(0.28, 0.7, 6), mat(0x3a7a4a), 0, -0.12, 0.14, h); beard.rotation.x = Math.PI;
      mesh(box(0.7, 0.1, 0.45), mat(0x222222), 0, 0.44, 0, h);
      mesh(cone(0.3, 0.3, 3), mat(0x222222), 0, 0.6, 0, h).rotation.y = Math.PI;
      mesh(box(0.1, 0.1, 0.02), mat(0xffffff), 0, 0.55, 0.24, h);
    } else {
      mesh(box(0.39, 0.12, 0.39), mat(o.bandana ?? 0xcc2222), 0, 0.38, 0, h);
      mesh(box(0.08, 0.2, 0.06), mat(o.bandana ?? 0xcc2222), 0.0, 0.3, -0.22, h);
    }
  } else if (type === 'yeti') {
    mesh(box(0.5, 0.48, 0.48), mat(o.fur ?? 0xf4f4f8), 0, 0.24, 0, h);
    mesh(box(0.32, 0.26, 0.04), mat(0x7a9ac8), 0, 0.22, 0.24, h);
    for (const s of [-1, 1]) mesh(box(0.06, 0.06, 0.02), mat(0x111111), s * 0.08, 0.27, 0.265, h);
    mesh(box(0.16, 0.05, 0.02), mat(0xffffff), 0, 0.13, 0.265, h);
    if (o.curlers) for (let i = 0; i < 4; i++) mesh(cyl(0.06, 0.06, 0.2, 6), mat([0xff66aa, 0x66ccff, 0xffdd44, 0x88ee66][i]), -0.18 + i * 0.12, 0.52, 0, h).rotation.z = 1.57;
  } else if (type === 'pharaoh') {
    mesh(box(0.38, 0.4, 0.36), mat(0xc89060), 0, 0.2, 0, h);
    for (const s of [-1, 1]) mesh(box(0.08, 0.04, 0.02), mat(0x111111), s * 0.08, 0.26, 0.185, h);
    const gold = mat(0xffcc22, { emissive: 0x332200 }), blue = mat(0x2244aa);
    mesh(box(0.5, 0.2, 0.42), gold, 0, 0.42, -0.02, h);
    for (const s of [-1, 1]) { mesh(box(0.12, 0.5, 0.2), gold, s * 0.26, 0.12, 0.02, h); mesh(box(0.125, 0.05, 0.205), blue, s * 0.26, 0.2, 0.02, h); mesh(box(0.125, 0.05, 0.205), blue, s * 0.26, 0.02, 0.02, h); }
    mesh(box(0.08, 0.3, 0.06), gold, 0, -0.05, 0.18, h); // beard
    mesh(cone(0.06, 0.16, 4), gold, 0, 0.6, 0.15, h);
  } else if (type === 'philosopher') {
    mesh(box(0.36, 0.38, 0.36), skin, 0, 0.2, 0, h);
    for (const s of [-1, 1]) mesh(box(0.06, 0.06, 0.02), mat(0x111111), s * 0.08, 0.24, 0.18, h);
    const beard = mesh(cone(0.22, 0.5, 6), mat(0xf4f4f4), 0, -0.08, 0.12, h); beard.rotation.x = Math.PI;
    mesh(box(0.39, 0.08, 0.39), mat(0x88cc66), 0, 0.4, 0, h); // laurel
  } else {
    mesh(box(0.36, 0.38, 0.36), skin, 0, 0.2, 0, h);
    for (const s of [-1, 1]) mesh(box(0.06, 0.06, 0.02), mat(0x111111), s * 0.08, 0.24, 0.18, h);
    if (o.hair) mesh(box(0.39, 0.12, 0.39), mat(o.hair), 0, 0.38, -0.01, h);
  }
}

// ---------- Weapons (handle at origin, blade along +Y) ----------

export function weaponModel(id, scale = 1) {
  const g = new THREE.Group();
  const wood = mat(0x7a4a22), steel = mat(0xc8ccd4), dark = mat(0x333333), gold = mat(0xddaa33);
  switch (id) {
    case 'stick':
      mesh(cyl(0.035, 0.05, 1.1, 5), wood, 0, 0.45, 0, g).rotation.z = 0.05;
      mesh(cyl(0.02, 0.02, 0.25, 4), wood, 0.06, 0.7, 0, g).rotation.z = -0.8;
      break;
    case 'divorce':
    case 'sword':
      mesh(box(0.06, 0.25, 0.06), dark, 0, 0, 0, g);
      mesh(box(0.34, 0.06, 0.08), gold, 0, 0.14, 0, g);
      mesh(box(0.1, 0.95, 0.03), steel, 0, 0.65, 0, g);
      if (id === 'divorce') mesh(box(0.12, 0.08, 0.005), mat(0xffffff), 0, 0.4, 0.02, g); // business card
      break;
    case 'rusty':
      mesh(box(0.05, 0.2, 0.05), dark, 0, 0, 0, g);
      mesh(box(0.24, 0.05, 0.06), mat(0x6b4a2a), 0, 0.12, 0, g);
      mesh(box(0.09, 0.8, 0.03), mat(0x9a7a5a), 0, 0.55, 0, g);
      break;
    case 'pan':
      mesh(cyl(0.035, 0.035, 0.55, 5), dark, 0, 0.2, 0, g);
      { const p = mesh(cyl(0.32, 0.28, 0.06, 10), mat(0x2a2a2a), 0, 0.72, 0, g); p.rotation.x = Math.PI / 2; }
      break;
    case 'femur':
      mesh(cyl(0.05, 0.05, 0.85, 5), mat(0xeeeadd), 0, 0.4, 0, g);
      mesh(sph(0.09, 6, 4), mat(0xeeeadd), 0.04, 0.85, 0, g);
      mesh(sph(0.09, 6, 4), mat(0xeeeadd), -0.04, 0.85, 0, g);
      break;
    case 'severance':
      mesh(box(0.08, 0.4, 0.08), dark, 0, 0, 0, g);
      mesh(box(0.5, 0.08, 0.1), mat(0x775533), 0, 0.22, 0, g);
      mesh(box(0.2, 1.6, 0.05), mat(0xa8a8b0), 0, 1.05, 0, g);
      mesh(box(0.16, 0.12, 0.06), mat(0xffffff), 0, 0.7, 0.03, g); // pink slip
      break;
    case 'chicken':
      mesh(cyl(0.04, 0.03, 0.35, 5), mat(0xffcc33), 0, 0.15, 0, g);
      mesh(sph(0.13, 7, 5), mat(0xffdd33), 0, 0.45, 0, g).scale.set(0.8, 1.4, 0.8);
      mesh(sph(0.08, 6, 4), mat(0xffdd33), 0, 0.68, 0.04, g);
      mesh(cone(0.04, 0.1, 4), mat(0xff7711), 0, 0.68, 0.14, g).rotation.x = 1.5;
      mesh(box(0.03, 0.08, 0.08), mat(0xee2222), 0, 0.77, 0.02, g);
      break;
    case 'baguette':
      mesh(cyl(0.08, 0.08, 1.2, 6), mat(0xd9a05a), 0, 0.5, 0, g);
      for (let i = 0; i < 4; i++) mesh(box(0.1, 0.03, 0.06), mat(0xb87a3a), 0, 0.1 + i * 0.28, 0.06, g).rotation.x = 0.4;
      break;
    case 'umbrella':
      mesh(cyl(0.03, 0.03, 1.2, 5), dark, 0, 0.55, 0, g);
      mesh(cone(0.45, 0.35, 8), mat(0x3a7ad8), 0, 1.0, 0, g);
      break;
    case 'fish':
      mesh(sph(0.16, 7, 5), mat(0x6a9ab8), 0, 0.45, 0, g).scale.set(0.5, 2.4, 1);
      mesh(cone(0.16, 0.25, 4), mat(0x5a8aa8), 0, 0.04, 0, g).rotation.x = Math.PI;
      mesh(box(0.03, 0.03, 0.02), mat(0x000000), 0.06, 0.75, 0.08, g);
      break;
    case 'lance':
      mesh(cyl(0.07, 0.07, 1.9, 7), mat(0xff66cc), 0, 0.85, 0, g);
      break;
    case 'spatula':
      mesh(cyl(0.03, 0.03, 0.7, 5), dark, 0, 0.3, 0, g);
      mesh(box(0.34, 0.42, 0.03), mat(0xc8ccd4), 0, 0.82, 0, g);
      break;
    case 'cutlass':
      mesh(box(0.06, 0.22, 0.06), dark, 0, 0, 0, g);
      mesh(box(0.22, 0.05, 0.12), gold, 0, 0.12, 0, g);
      mesh(box(0.14, 0.85, 0.03), mat(0x8aa0a0), 0.03, 0.58, 0, g).rotation.z = -0.12;
      mesh(box(0.12, 0.08, 0.035), mat(0x4a8a5a), 0.08, 0.7, 0, g); // seaweed
      break;
    case 'scepter':
      mesh(cyl(0.04, 0.04, 1.3, 6), gold, 0, 0.55, 0, g);
      mesh(sph(0.14, 7, 5), mat(0x33aaff, { emissive: 0x113355 }), 0, 1.25, 0, g);
      mesh(cyl(0.18, 0.06, 0.12, 6), gold, 0, 1.12, 0, g);
      break;
    case 'icicle':
      mesh(cyl(0.05, 0.05, 0.3, 5), mat(0x5a7aa8), 0, 0.05, 0, g);
      mesh(cone(0.13, 1.4, 6), mat(0xbfe8ff, { emissive: 0x224466 }), 0, 0.9, 0, g);
      break;
    case 'rollingpin':
      mesh(cyl(0.04, 0.04, 0.5, 5), wood, 0, 0.1, 0, g);
      mesh(cyl(0.14, 0.14, 0.9, 8), mat(0xd8b080), 0, 0.75, 0, g);
      mesh(cyl(0.04, 0.04, 0.3, 5), wood, 0, 1.3, 0, g);
      break;
    case 'sockpuppet':
      mesh(cyl(0.11, 0.1, 0.9, 7), mat(0xee5555), 0, 0.4, 0, g);
      for (let i = 0; i < 3; i++) mesh(cyl(0.115, 0.115, 0.06, 7), mat(0xffffff), 0, 0.15 + i * 0.25, 0, g);
      for (const s of [-1, 1]) mesh(sph(0.04, 5, 4), mat(0xffffff), s * 0.05, 0.8, 0.09, g);
      break;
    case 'hammer':
      mesh(cyl(0.05, 0.05, 1.4, 5), wood, 0, 0.6, 0, g);
      mesh(box(0.7, 0.4, 0.4), mat(0x555a66), 0, 1.35, 0, g);
      mesh(box(0.72, 0.1, 0.42), mat(0xdd2222), 0, 1.35, 0, g);
      break;
    case 'rake':
      mesh(cyl(0.05, 0.05, 2.4, 5), wood, 0, 1.0, 0, g);
      mesh(box(0.9, 0.08, 0.08), dark, 0, 2.2, 0, g);
      for (let i = 0; i < 7; i++) mesh(box(0.04, 0.3, 0.04), dark, -0.42 + i * 0.14, 2.06, 0.04, g);
      break;
  }
  g.scale.setScalar(scale);
  return optimize(g);
}

// Attach a weapon to the right hand so it points forward when the arm hangs down.
export function holdWeapon(rig, weaponObj) {
  const hand = rig.handR;
  while (hand.children.length) hand.remove(hand.children[0]);
  weaponObj.rotation.x = 1.75;
  hand.add(weaponObj);
  rig.weapon = weaponObj;
  return weaponObj;
}

export function makeHero() {
  const rig = humanoid({ skin: 0xf2c49b, body: 0x3a6ea5, arms: 0x3a6ea5, legs: 0x4a3a2a, boots: 0x2a1a10, hair: 0x6a3a1a, belt: 0x8a5a2a });
  // Equipment cosmetics, toggled by the player.
  const h = rig.head;
  rig.cos = {
    colander: (() => { const g = new THREE.Group(); mesh(sph(0.24, 8, 4), mat(0xc0c4cc), 0, 0.36, 0, g).scale.set(1, 0.7, 1); mesh(cyl(0.28, 0.28, 0.03, 8), mat(0xc0c4cc), 0, 0.33, 0, g); mesh(box(0.1, 0.04, 0.06), mat(0xc0c4cc), 0.3, 0.33, 0, g); h.add(g); return g; })(),
    crown: (() => { const g = new THREE.Group(); const gold = mat(0xffcc22, { emissive: 0x332200 }); mesh(cyl(0.21, 0.2, 0.1, 8), gold, 0, 0.47, 0, g); for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; mesh(cone(0.04, 0.12, 4), gold, Math.sin(a) * 0.18, 0.57, Math.cos(a) * 0.18, g); } h.add(g); return g; })(),
    pizza: (() => { const g = new THREE.Group(); mesh(box(0.6, 0.6, 0.4), mat(0xc79a5a), 0, 0.38, 0, g); mesh(box(0.42, 0.18, 0.01), mat(0xcc2222), 0, 0.45, 0.205, g); rig.torso.add(g); return g; })(),
    cone: (() => { const g = new THREE.Group(); mesh(cone(0.2, 0.5, 8), mat(0xff7a22), 0, 0.62, 0, g); mesh(cyl(0.2, 0.2, 0.06, 8), mat(0xffffff), 0, 0.55, 0, g); mesh(box(0.42, 0.04, 0.42), mat(0xff7a22), 0, 0.39, 0, g); h.add(g); return g; })(),
    tricorn: (() => { const g = new THREE.Group(); mesh(box(0.6, 0.08, 0.4), mat(0x222222), 0, 0.42, 0, g); mesh(cone(0.26, 0.24, 3), mat(0x222222), 0, 0.56, 0, g).rotation.y = Math.PI; mesh(box(0.08, 0.08, 0.02), mat(0xffffff), 0, 0.5, 0.21, g); h.add(g); return g; })(),
    pyramidhat: (() => { const g = new THREE.Group(); const p = mesh(cone(0.32, 0.45, 4), mat(0xffcc22, { emissive: 0x332200 }), 0, 0.6, 0, g); p.rotation.y = Math.PI / 4; h.add(g); return g; })(),
    wraps: (() => { const g = new THREE.Group(); for (let i = 0; i < 5; i++) mesh(box(0.58, 0.07, 0.36), mat(i % 2 ? 0xe0d8b8 : 0xc8bf98), 0, 0.08 + i * 0.15, 0, g).rotation.z = (i % 2 ? 0.1 : -0.1); rig.torso.add(g); return g; })(),
    parka: (() => { const g = new THREE.Group(); mesh(box(0.7, 0.8, 0.48), mat(0x3a8ad8), 0, 0.36, 0, g); mesh(box(0.72, 0.16, 0.5), mat(0xf4f4f4), 0, 0.72, 0, g); for (let i = 0; i < 3; i++) mesh(box(0.71, 0.03, 0.49), mat(0x2a6ab8), 0, 0.15 + i * 0.2, 0, g); rig.torso.add(g); return g; })(),
    goldsuit: (() => { const g = new THREE.Group(); mesh(box(0.62, 0.78, 0.4), mat(0xffcc22, { emissive: 0x443300 }), 0, 0.36, 0, g); mesh(box(0.1, 0.5, 0.01), mat(0x222222), 0, 0.45, 0.205, g); rig.torso.add(g); return g; })(),
    bathrobe: (() => { const g = new THREE.Group(); mesh(box(0.6, 0.85, 0.38), mat(0xf4b6c8), 0, 0.3, 0, g); mesh(box(0.08, 0.6, 0.01), mat(0xffffff), 0, 0.4, 0.195, g); rig.torso.add(g); return g; })(),
  };
  for (const k in rig.cos) rig.cos[k].visible = false;
  shadowAll(rig.root);
  optimize(rig.root);
  return rig;
}

export function makeEnemyModel(type) {
  let rig;
  if (type === 'goblin') {
    rig = humanoid({ skin: 0x66aa44, body: 0xeeeeee, arms: 0x66aa44, legs: 0x5a4632, head: 'goblin', legH: 0.5, torsoH: 0.5, width: 0.46, armLen: 0.55 });
    holdWeapon(rig, weaponModel('pan', 1.5));
  } else if (type === 'knight') {
    rig = humanoid({ skin: 0xddb08a, body: 0x8a9098, arms: 0x8a9098, legs: 0x6a7078, head: 'helmet', plume: 0xdd2222, pauldrons: 0xaab0b8, boots: 0x444444, belt: 0x6a3a1a });
    holdWeapon(rig, weaponModel('sword', 1.05));
  } else if (type === 'skeleton') {
    const bone = 0xeeeadd;
    rig = humanoid({ skin: bone, body: bone, arms: bone, legs: bone, head: 'skull', width: 0.4, legW: 0.1 });
    rig.torso.children[0].scale.set(0.7, 1, 0.6);
    for (let i = 0; i < 3; i++) mesh(box(0.42, 0.05, 0.28), mat(0xd6d0c0), 0, 0.25 + i * 0.15, 0, rig.torso);
    for (const a of [rig.armL, rig.armR]) a.children[0].scale.set(0.6, 1, 0.6);
    holdWeapon(rig, weaponModel('rusty', 1));
  } else if (type === 'unemployed') {
    rig = humanoid({ skin: 0xddb08a, body: 0x6a5a4a, arms: 0x7a6a5a, legs: 0x4a4038, head: 'helmet', helmet: 0x7a6a5a, plume: 0x777777, pauldrons: 0x8a7a6a, boots: 0x333333, belt: 0x3a2a1a, width: 0.62 });
    // A cardboard sign on his back.
    const sign = mesh(box(0.6, 0.45, 0.03), mat(0xc8a070), 0, 0.42, -0.24, rig.torso);
    sign.add(textPlane('WILL FIGHT\nFOR FOOD', 0.56, 0.4, '#3a2a1a', '#c8a070'));
    sign.children[0].position.z = -0.02;
    sign.children[0].rotation.y = Math.PI;
    holdWeapon(rig, weaponModel('severance', 1));
    rig.root.scale.setScalar(1.45);
  } else if (type === 'mummy') {
    const wrap = 0xe0d8b8;
    rig = humanoid({ skin: wrap, body: wrap, arms: wrap, legs: 0xd0c8a4, head: 'mummy', width: 0.46 });
    for (let i = 0; i < 4; i++) mesh(box(0.48, 0.05, 0.3), mat(0xc8bf98), 0, 0.12 + i * 0.17, 0, rig.torso).rotation.z = (i % 2 ? 0.12 : -0.12);
    mesh(box(0.08, 0.5, 0.02), mat(0xe8e0c0), 0.15, 0.2, 0.16, rig.torso); // loose wrap
  } else if (type === 'pirate') {
    rig = humanoid({ skin: 0xd8a880, body: 0xeeeeee, arms: 0xcc3333, legs: 0x2a3a6a, head: 'pirate', boots: 0x2a1a10, belt: 0x6a3a1a });
    for (let i = 0; i < 3; i++) mesh(box(0.53, 0.06, 0.32), mat(0xcc3333), 0, 0.15 + i * 0.22, 0, rig.torso);
    holdWeapon(rig, weaponModel('cutlass', 1));
  } else if (type === 'yeti') {
    rig = humanoid({ skin: 0xf4f4f8, body: 0xf4f4f8, arms: 0xf4f4f8, legs: 0xe8e8f0, head: 'yeti', width: 0.75, armLen: 0.85, belly: true });
    rig.root.scale.setScalar(1.45);
  } else if (type === 'gary') {
    rig = humanoid({ skin: 0x66aa44, body: 0xeeeeee, arms: 0x66aa44, legs: 0x5a4632, head: 'goblin', legH: 0.55, torsoH: 0.6, width: 0.6, armLen: 0.6, belly: true });
    mesh(box(0.5, 0.5, 0.02), mat(0xdd4444), 0, 0.3, 0.2, rig.torso); // apron
    holdWeapon(rig, weaponModel('spatula', 1.4));
    rig.root.scale.setScalar(2.4);
  } else if (type === 'pharaoh') {
    rig = humanoid({ skin: 0xc89060, body: 0xf4f0e0, arms: 0xc89060, legs: 0xf4f0e0, head: 'pharaoh', belt: 0xffcc22, pauldrons: 0x2244aa, boots: 0xffcc22 });
    mesh(box(0.6, 0.18, 0.36), mat(0xffcc22, { emissive: 0x221100 }), 0, 0.62, 0, rig.torso); // collar
    holdWeapon(rig, weaponModel('scepter', 1.3));
    rig.root.scale.setScalar(2.4);
  } else if (type === 'snowmom') {
    rig = humanoid({ skin: 0xf4f0f4, body: 0xf4f0f4, arms: 0xf4f0f4, legs: 0xe8e4ec, head: 'yeti', curlers: true, width: 0.8, armLen: 0.85, belly: true });
    mesh(box(0.62, 0.7, 0.02), mat(0xff88bb), 0, 0.3, 0.3, rig.torso); // apron
    mesh(box(0.3, 0.2, 0.01), mat(0xffffff), 0, 0.25, 0.315, rig.torso);
    holdWeapon(rig, weaponModel('rollingpin', 1.2));
    rig.root.scale.setScalar(2.4);
  } else if (type === 'sogbeard') {
    rig = humanoid({ skin: 0xc8a888, body: 0x2a3a5a, arms: 0x2a3a5a, legs: 0x3a2a1a, head: 'captain', belt: 0xffcc22, pauldrons: 0xffcc22, boots: 0x1a1a1a, belly: true });
    mesh(cyl(0.05, 0.05, 0.5, 5), mat(0x8a5a2a), 0, -0.6, 0, rig.legL); // peg leg
    const parrot = new THREE.Group();
    mesh(sph(0.1, 6, 5), mat(0x33cc44), 0, 0, 0, parrot).scale.set(0.8, 1.2, 0.8);
    mesh(cone(0.04, 0.08, 4), mat(0xffaa22), 0, 0.05, 0.1, parrot).rotation.x = 1.57;
    parrot.position.set(0.32, 0.8, 0);
    rig.torso.add(parrot);
    holdWeapon(rig, weaponModel('cutlass', 1.5));
    rig.root.scale.setScalar(2.3);
  } else if (type === 'king') {
    rig = humanoid({ skin: 0xf0c8a0, body: 0x6a2a8a, arms: 0x6a2a8a, legs: 0x4a1a5a, head: 'king', belly: true, width: 0.7, boots: 0x332211, belt: 0xffcc22, pauldrons: 0xffffff });
    // Royal cape.
    mesh(box(0.74, 1.2, 0.05), mat(0xbb1133), 0, 0.15, -0.28, rig.torso).rotation.x = 0.12;
    holdWeapon(rig, weaponModel('rake', 1));
    rig.root.scale.setScalar(3.0);
  }
  shadowAll(rig.root);
  optimize(rig.root);
  return rig;
}

export function makeFrog() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const green = mat(0x55bb55), belly = mat(0xddee88), spot = mat(0x9944cc);
  mesh(sph(0.75, 8, 6), green, 0, 0.62, 0, body).scale.set(1, 0.75, 1.15);
  mesh(sph(0.55, 8, 6), belly, 0, 0.5, 0.25, body).scale.set(0.9, 0.6, 1);
  for (const [x, z] of [[0.35, -0.2], [-0.3, 0.1], [0.1, -0.5]]) mesh(sph(0.14, 5, 4), spot, x, 1.0, z, body);
  const throat = mesh(sph(0.35, 8, 5), mat(0xeedd66), 0, 0.42, 0.62, body);
  throat.scale.set(1, 0.6, 0.6);
  for (const s of [-1, 1]) {
    mesh(sph(0.2, 6, 5), green, s * 0.32, 1.05, 0.45, body);
    mesh(sph(0.11, 6, 4), mat(0xffee22, { emissive: 0x333300 }), s * 0.35, 1.1, 0.6, body);
    mesh(box(0.03, 0.12, 0.02), mat(0x000000), s * 0.35, 1.1, 0.71, body);
    const leg = mesh(sph(0.32, 6, 4), green, s * 0.68, 0.32, -0.4, body); leg.scale.set(0.6, 0.7, 1.3);
    mesh(box(0.3, 0.06, 0.4), green, s * 0.7, 0.04, -0.1, body);
    mesh(box(0.14, 0.4, 0.14), green, s * 0.45, 0.2, 0.5, body);
  }
  // Tiny crown of shame for comedic effect.
  mesh(cone(0.12, 0.2, 4), mat(0xffcc22), 0, 1.2, 0.2, body).rotation.x = -0.2;
  shadowAll(root);
  optimize(root, [throat]);
  return { root, body, throat, isFrog: true };
}

export function makeCactus() {
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const green = mat(0x4f9a4a);
  mesh(cyl(0.45, 0.5, 1.8, 7), green, 0, 0.9, 0, body);
  mesh(sph(0.45, 7, 5), green, 0, 1.8, 0, body);
  const arms = [];
  for (const s of [-1, 1]) {
    const a = new THREE.Group();
    a.position.set(s * 0.45, 1.1, 0);
    mesh(cyl(0.16, 0.16, 0.5, 5), green, s * 0.25, 0, 0, a).rotation.z = 1.57;
    mesh(cyl(0.16, 0.16, 0.6, 5), green, s * 0.5, 0.3, 0, a);
    body.add(a);
    arms.push(a);
  }
  for (const s of [-1, 1]) { mesh(sph(0.11, 6, 4), mat(0xffffff), s * 0.16, 1.55, 0.4, body); mesh(sph(0.05, 5, 4), mat(0x000000), s * 0.16, 1.55, 0.5, body); }
  mesh(box(0.22, 0.05, 0.02), mat(0x223311), 0, 1.32, 0.46, body);
  mesh(ico(0.16, 0), mat(0xff66aa), 0, 2.25, 0, body);
  shadowAll(root);
  optimize(root);
  return { root, body, arms, isSimple: true, kind: 'cactus' };
}

export function makeCrab() {
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const red = mat(0xdd4a2a);
  mesh(sph(0.55, 8, 5), red, 0, 0.45, 0, body).scale.set(1.2, 0.55, 0.9);
  for (const s of [-1, 1]) {
    mesh(cyl(0.03, 0.03, 0.3, 4), red, s * 0.18, 0.75, 0.3, body);
    mesh(sph(0.08, 5, 4), mat(0xffffff), s * 0.18, 0.92, 0.3, body);
    mesh(sph(0.04, 4, 3), mat(0x000000), s * 0.18, 0.93, 0.37, body);
    for (let i = 0; i < 3; i++) { const l = mesh(box(0.5, 0.06, 0.06), red, s * 0.7, 0.25, -0.25 + i * 0.22, body); l.rotation.z = s * -0.5; }
  }
  const arms = [];
  for (const s of [-1, 1]) {
    const a = new THREE.Group();
    a.position.set(s * 0.5, 0.5, 0.35);
    mesh(box(0.12, 0.12, 0.4), red, 0, 0, 0.2, a);
    mesh(box(0.25, 0.18, 0.28), red, 0, 0.05, 0.5, a);
    if (s > 0) mesh(box(0.03, 0.03, 0.3), mat(0xc8ccd4), 0, 0.15, 0.6, a); // tiny knife
    body.add(a);
    arms.push(a);
  }
  shadowAll(root);
  optimize(root);
  return { root, body, arms, isSimple: true, kind: 'crab' };
}

export function makeSnowman() {
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const snow = mat(0xffffff);
  mesh(sph(0.6, 8, 6), snow, 0, 0.55, 0, body);
  mesh(sph(0.45, 8, 6), snow, 0, 1.3, 0, body);
  mesh(sph(0.33, 8, 6), snow, 0, 1.85, 0, body);
  mesh(cone(0.06, 0.35, 5), mat(0xff8822), 0, 1.85, 0.45, body).rotation.x = 1.57;
  for (const s of [-1, 1]) mesh(box(0.06, 0.06, 0.02), mat(0x111111), s * 0.1, 1.95, 0.3, body);
  for (const s of [-1, 1]) mesh(box(0.2, 0.04, 0.02), mat(0x111111), s * 0.1, 2.03, 0.3, body).rotation.z = s * -0.4; // angry brows
  mesh(cyl(0.22, 0.22, 0.32, 8), mat(0x222222), 0, 2.27, 0, body);
  mesh(cyl(0.32, 0.32, 0.04, 8), mat(0x222222), 0, 2.12, 0, body);
  mesh(box(0.7, 0.1, 0.1), mat(0xcc3333), 0, 1.6, 0.05, body); // scarf
  const arms = [];
  for (const s of [-1, 1]) {
    const a = new THREE.Group();
    a.position.set(s * 0.4, 1.4, 0);
    mesh(cyl(0.03, 0.03, 0.8, 4), mat(0x6a4a2a), s * 0.35, 0.2, 0, a).rotation.z = s * -1.1;
    body.add(a);
    arms.push(a);
  }
  shadowAll(root);
  optimize(root);
  return { root, body, arms, isSimple: true, kind: 'snowman' };
}

export function makeChicken() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const white = mat(0xffffff);
  mesh(sph(0.22, 7, 5), white, 0, 0.32, 0, body).scale.set(0.9, 0.85, 1.2);
  mesh(sph(0.13, 6, 5), white, 0, 0.55, 0.18, body);
  mesh(cone(0.05, 0.12, 4), mat(0xff9911), 0, 0.54, 0.33, body).rotation.x = 1.57;
  mesh(box(0.04, 0.1, 0.1), mat(0xee2222), 0, 0.68, 0.18, body);
  mesh(cone(0.12, 0.2, 4), white, 0, 0.42, -0.28, body).rotation.x = -1.0;
  for (const s of [-1, 1]) mesh(box(0.03, 0.18, 0.03), mat(0xff9911), s * 0.07, 0.09, 0, body);
  shadowAll(root);
  return { root, body };
}

export function makeDummy() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  mesh(cyl(0.06, 0.06, 1.0, 5), mat(0x7a4a22), 0, 0.5, 0, body);
  mesh(cyl(0.28, 0.3, 0.8, 7), mat(0xc8aa6a), 0, 1.3, 0, body);
  mesh(sph(0.22, 7, 5), mat(0xc8aa6a), 0, 1.9, 0, body);
  mesh(box(0.9, 0.08, 0.08), mat(0x7a4a22), 0, 1.45, 0, body);
  for (const s of [-1, 1]) mesh(box(0.05, 0.05, 0.02), mat(0x222222), s * 0.08, 1.95, 0.21, body);
  mesh(box(0.14, 0.03, 0.02), mat(0x222222), 0, 1.82, 0.21, body);
  shadowAll(root);
  return { root, body };
}

// ---------- Props ----------

export function textPlane(text, w, h, fg = '#2a1a0a', bg = '#e8d2a0') {
  const c = document.createElement('canvas');
  c.width = 256; c.height = Math.round(256 * h / w);
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = fg;
  const lines = text.split('\n');
  const fs = Math.min(c.height / (lines.length + 0.6), 54);
  g.font = `bold ${fs}px Georgia, serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  lines.forEach((l, i) => g.fillText(l, c.width / 2, c.height / 2 + (i - (lines.length - 1) / 2) * fs * 1.05));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
}

export function makeSign(text) {
  const g = new THREE.Group();
  mesh(box(0.1, 1.3, 0.1), mat(0x6a4020), 0, 0.65, 0, g);
  const board = mesh(box(1.2, 0.6, 0.06), mat(0x8a5a2a), 0, 1.25, 0, g);
  const t = textPlane(text, 1.1, 0.5);
  t.position.set(0, 1.25, 0.035);
  g.add(t);
  void board;
  shadowAll(g);
  return g;
}

export function makeShrine() {
  const g = new THREE.Group();
  const stone = mat(0x9a9488);
  mesh(cyl(1.3, 1.5, 0.3, 8), stone, 0, 0.15, 0, g);
  mesh(cyl(0.9, 1.1, 0.25, 8), mat(0x7f7a70), 0, 0.42, 0, g);
  const glowGrass = mat(0x66ff66, { emissive: 0x22aa22 });
  const tuft = new THREE.Group();
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const b = mesh(cone(0.09, 0.7 + (i % 3) * 0.2, 4), glowGrass, Math.sin(a) * 0.25, 0.9, Math.cos(a) * 0.25, tuft);
    b.rotation.z = Math.sin(a) * 0.3; b.rotation.x = Math.cos(a) * 0.3;
  }
  g.add(tuft);
  const beam = mesh(cyl(0.5, 0.8, 7, 8, true), mat(0x88ff88, { basic: true, transparent: true, opacity: 0.12, additive: true, side: THREE.DoubleSide }), 0, 4, 0, g);
  beam.renderOrder = 2;
  g.userData.tuft = tuft;
  g.userData.beam = beam;
  return g;
}

export function makeChest(fancy = false) {
  const g = new THREE.Group();
  const wood = mat(fancy ? 0x5a2a6a : 0x8a5a2a), trim = mat(0xddaa33);
  mesh(box(1.0, 0.55, 0.65), wood, 0, 0.28, 0, g);
  mesh(box(1.04, 0.08, 0.69), trim, 0, 0.5, 0, g);
  const lid = new THREE.Group();
  lid.position.set(0, 0.55, -0.32);
  mesh(box(1.0, 0.25, 0.65), wood, 0, 0.12, 0.32, lid);
  mesh(box(0.16, 0.2, 0.05), trim, 0, 0.05, 0.66, lid);
  g.add(lid);
  g.userData.lid = lid;
  shadowAll(g);
  return g;
}

export function makeGnome(scale = 1) {
  const g = new THREE.Group();
  mesh(cyl(0.18, 0.22, 0.35, 6), mat(0x3355cc), 0, 0.18, 0, g);
  mesh(sph(0.14, 6, 5), mat(0xf0c8a0), 0, 0.45, 0, g);
  mesh(cone(0.15, 0.35, 6), mat(0xdd2222), 0, 0.7, 0, g);
  mesh(cone(0.12, 0.25, 5), mat(0xffffff), 0, 0.35, 0.1, g).rotation.x = Math.PI;
  g.scale.setScalar(scale);
  shadowAll(g);
  return g;
}

export function makeFlamingo() {
  const g = new THREE.Group();
  const pink = mat(0xff66aa);
  mesh(cyl(0.015, 0.015, 0.7, 4), mat(0x222222), 0, 0.35, 0, g);
  mesh(sph(0.2, 6, 5), pink, 0, 0.8, 0, g).scale.set(0.8, 0.7, 1.3);
  mesh(cyl(0.035, 0.035, 0.5, 4), pink, 0, 1.1, 0.18, g).rotation.x = 0.3;
  mesh(sph(0.08, 6, 4), pink, 0, 1.35, 0.25, g);
  mesh(cone(0.03, 0.12, 4), mat(0x222222), 0, 1.32, 0.35, g).rotation.x = 2;
  return g;
}

export function makeBBQ() {
  const g = new THREE.Group();
  for (const [x, z] of [[-0.3, -0.2], [0.3, -0.2], [0, 0.3]]) mesh(cyl(0.03, 0.03, 0.8, 4), mat(0x222222), x, 0.4, z, g);
  mesh(sph(0.5, 8, 4), mat(0x2a2a2a), 0, 0.95, 0, g).scale.set(1, 0.5, 1);
  for (let i = 0; i < 3; i++) mesh(cyl(0.06, 0.06, 0.4, 5), mat(0xaa4422), -0.2 + i * 0.2, 1.2, 0, g).rotation.z = 1.57;
  shadowAll(g);
  return g;
}

export function makeCart() {
  const g = new THREE.Group();
  mesh(box(1.8, 0.5, 1.1), mat(0x8a5a2a), 0, 0.75, 0, g);
  for (const s of [-1, 1]) { const w = mesh(cyl(0.4, 0.4, 0.1, 8), mat(0x5a3a1a), s * 0.6, 0.4, 0.6, g); w.rotation.x = 1.57; const w2 = mesh(cyl(0.4, 0.4, 0.1, 8), mat(0x5a3a1a), s * 0.6, 0.4, -0.6, g); w2.rotation.x = 1.57; }
  mesh(box(0.08, 1.6, 0.08), mat(0x6a4020), -0.85, 1.6, -0.5, g);
  mesh(box(0.08, 1.6, 0.08), mat(0x6a4020), 0.85, 1.6, -0.5, g);
  mesh(box(2.0, 0.08, 1.4), mat(0xcc3344), 0, 2.4, 0, g).rotation.x = 0.1;
  for (let i = 0; i < 4; i++) mesh(box(0.3, 0.3, 0.3), mat([0xddaa33, 0x55aa55, 0x4466cc, 0xcc5533][i]), -0.6 + i * 0.4, 1.15, 0.1, g);
  const t = textPlane("BARRY'S\nBARGAIN BIN", 1.6, 0.5, '#fff', '#aa2233');
  t.position.set(0, 2.15, 0.71);
  g.add(t);
  shadowAll(g);
  return g;
}

export function makeShed() {
  const g = new THREE.Group();
  mesh(box(5, 3, 4), mat(0xb04a3a), 0, 1.5, 0, g);
  const roof = mesh(cone(4.0, 1.6, 4), mat(0x5a3a2a), 0, 3.8, 0, g);
  roof.rotation.y = Math.PI / 4; roof.scale.set(1, 1, 0.8);
  mesh(box(1.4, 2.2, 0.05), mat(0x6a3020), 0, 1.1, 2.03, g);
  shadowAll(g);
  return g;
}

export function makeCoop() {
  const g = new THREE.Group();
  mesh(box(1.6, 1.0, 1.2), mat(0xcc8844), 0, 0.9, 0, g);
  const roof = mesh(cone(1.3, 0.6, 4), mat(0x884422), 0, 1.7, 0, g);
  roof.rotation.y = Math.PI / 4;
  for (const [x, z] of [[-0.7, -0.5], [0.7, -0.5], [-0.7, 0.5], [0.7, 0.5]]) mesh(box(0.1, 0.5, 0.1), mat(0x6a4020), x, 0.25, z, g);
  mesh(box(0.4, 0.4, 0.05), mat(0x222222), 0, 0.9, 0.61, g);
  const t = textPlane('NUGGET', 0.7, 0.2, '#fff', '#884422');
  t.position.set(0, 1.25, 0.61);
  g.add(t);
  shadowAll(g);
  return g;
}

export function makeLoot(color = 0xffee66) {
  const g = new THREE.Group();
  mesh(ico(0.22, 0), mat(color, { emissive: color }), 0, 0.5, 0, g);
  const beam = mesh(cyl(0.12, 0.25, 2.5, 6, true), mat(color, { basic: true, transparent: true, opacity: 0.25, additive: true, side: THREE.DoubleSide }), 0, 1.4, 0, g);
  beam.renderOrder = 2;
  return g;
}

export function makeBrainCell() {
  const g = new THREE.Group();
  const pink = mat(0xff88bb, { emissive: 0x883355 });
  mesh(ico(0.45, 1), pink, 0, 1.2, 0, g);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; const d = mesh(cyl(0.03, 0.06, 0.6, 4), pink, Math.cos(a) * 0.5, 1.2, Math.sin(a) * 0.5, g); d.rotation.z = Math.PI / 2; d.rotation.y = -a; }
  const beam = mesh(cyl(0.3, 0.6, 8, 8, true), mat(0xff88cc, { basic: true, transparent: true, opacity: 0.25, additive: true, side: THREE.DoubleSide }), 0, 4, 0, g);
  beam.renderOrder = 2;
  return g;
}

// Soft round "blob" shadow used when real shadows are disabled.
let blobTex = null, blobMat = null;
export function blobShadow(r) {
  if (!blobTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 2, 32, 32, 31);
    grd.addColorStop(0, 'rgba(0,0,0,0.55)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
    blobTex = new THREE.CanvasTexture(c);
    blobMat = new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false });
  }
  const m = new THREE.Mesh(geo('blob', () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)), blobMat);
  m.scale.set(r * 2.4, 1, r * 2.4);
  m.renderOrder = 1;
  return m;
}

// Projectile models (handle the 'kind' names used by effects.js).
export function projectileModel(kind) {
  const g = new THREE.Group();
  if (kind === 'slime') mesh(sph(0.28, 6, 5), mat(0x66ff44, { emissive: 0x228811 }), 0, 0, 0, g);
  else if (kind === 'snowball') mesh(sph(0.3, 6, 5), mat(0xffffff, { emissive: 0x334455 }), 0, 0, 0, g);
  else if (kind === 'needle') { const n = mesh(cone(0.06, 0.6, 4), mat(0xd8e890, { emissive: 0x334400 }), 0, 0, 0, g); n.rotation.x = Math.PI / 2; }
  else if (kind === 'coin') { const c = mesh(cyl(0.3, 0.3, 0.08, 10), mat(0xffcc22, { emissive: 0x664400 }), 0, 0, 0, g); c.rotation.x = Math.PI / 2; }
  else if (kind === 'cannon') mesh(sph(0.45, 8, 6), mat(0x222222), 0, 0, 0, g);
  else if (kind === 'pan') { mesh(cyl(0.45, 0.4, 0.08, 10), mat(0x2a2a2a), 0, 0, 0, g); mesh(box(0.08, 0.06, 0.6), mat(0x333333), 0, 0, 0.7, g); }
  else if (kind === 'bomb') { mesh(cyl(0.14, 0.16, 0.45, 7), mat(0x3aa8ff, { emissive: 0x113355 }), 0, 0, 0, g); mesh(cyl(0.05, 0.08, 0.15, 5), mat(0x3aa8ff), 0, 0.3, 0, g); }
  else if (kind === 'resume') mesh(box(0.5, 0.02, 0.65), mat(0xffffff), 0, 0, 0, g);
  else if (kind === 'gnome') g.add(makeGnome(1.6));
  return g;
}

// Merge each group's plain child meshes into one vertex-coloured mesh. Pivot groups stay,
// so procedural animation still works, but a character costs a handful of draw calls.
let mergedMat = null;
export function optimize(root, keep = []) {
  if (!mergedMat) mergedMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const groups = [];
  root.traverse((o) => { if (o.isGroup || o === root) groups.push(o); });
  for (const g of groups) {
    const meshes = g.children.filter((c) => c.isMesh && !c.isInstancedMesh && !c.children.length && !keep.includes(c)
      && c.material && c.material.isMeshLambertMaterial && !c.material.transparent && c.material.emissive.getHex() === 0 && !c.material.vertexColors);
    if (meshes.length < 2) continue;
    const pos = [], nor = [], col = [];
    let shadow = false;
    for (const m of meshes) {
      m.updateMatrix();
      const geo = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrix);
      if (!geo.attributes.normal) geo.computeVertexNormals();
      const pa = geo.attributes.position, na = geo.attributes.normal, c = m.material.color;
      for (let i = 0; i < pa.count; i++) { pos.push(pa.getX(i), pa.getY(i), pa.getZ(i)); nor.push(na.getX(i), na.getY(i), na.getZ(i)); col.push(c.r, c.g, c.b); }
      shadow = shadow || m.castShadow;
      g.remove(m);
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const mm = new THREE.Mesh(out, mergedMat);
    mm.castShadow = shadow;
    g.add(mm);
  }
  return root;
}
