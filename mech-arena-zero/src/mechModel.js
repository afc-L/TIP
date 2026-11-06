// Procedural low-poly mech models with procedural animation rigs.
// Forward is +Z in local space. Each design has its own silhouette and leg type.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { clamp, lerp, damp } from './util.js';

// ---------------------------------------------------------------------------
// geometry cache
// ---------------------------------------------------------------------------
const GC = new Map();
function cache(key, fn) { let g = GC.get(key); if (!g) { g = fn(); GC.set(key, g); } return g; }
const boxG = (w, h, d) => cache(`b${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d));
const cylG = (rt, rb, h, s = 8) => cache(`c${rt}|${rb}|${h}|${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s));
const sphG = (r, w = 8, h = 6) => cache(`s${r}|${w}|${h}`, () => new THREE.SphereGeometry(r, w, h));
const coneG = (r, h, s = 8) => cache(`k${r}|${h}|${s}`, () => new THREE.ConeGeometry(r, h, s));
const octG = (r) => cache(`o${r}`, () => new THREE.OctahedronGeometry(r, 0));
const torG = (r, t, rs = 6, ts = 16) => cache(`t${r}|${t}|${rs}|${ts}`, () => new THREE.TorusGeometry(r, t, rs, ts));
const hemiG = (r) => cache(`h${r}`, () => new THREE.SphereGeometry(r, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2));

function add(parent, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.scale.set(sx, sy, sz);
  parent.add(m);
  return m;
}
function grp(parent, x = 0, y = 0, z = 0) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }

// ---------------------------------------------------------------------------
// palettes
// ---------------------------------------------------------------------------
const TEAM_COLORS = {
  player: { hull: 0xd5dbe2, dark: 0x2a2f37, accent: 0x1fa8ff, glow: 0x5ce8ff },
  ally: { hull: 0xa9b7c4, dark: 0x262c35, accent: 0x3a6dff, glow: 0x6aa8ff },
  enemy: { hull: 0x6a6e74, dark: 0x1c1d21, accent: 0xff7a1a, glow: 0xff5a1f },
  elite: { hull: 0x3a3d44, dark: 0x111216, accent: 0xd4a017, glow: 0xff3b3b },
  irongiant: { hull: 0x5b5f55, dark: 0x1e201c, accent: 0xb5651d, glow: 0xff8c1a },
  phantomzero: { hull: 0x1b1c22, dark: 0x0b0b0e, accent: 0x8a1022, glow: 0xff1f4b },
  overlord: { hull: 0x4d4a5c, dark: 0x17161d, accent: 0x7d2bd6, glow: 0xb36bff },
  omega: { hull: 0xe9e4d8, dark: 0x22242c, accent: 0xc9a227, glow: 0xff3df2 },
};
const FRAME_TINT = {
  striker: 0xffffff, viper: 0xfff1c4, bulwark: 0xd8e6ff, titan: 0xd9dfc9,
  phantom: 0x8a919c, juggernaut: 0xe0d6c8, wraith: 0xc9c2ff, apex: 0xfff8e8,
};

export function makePalette(team, frameId) {
  const base = TEAM_COLORS[team] || TEAM_COLORS.enemy;
  const hull = new THREE.Color(base.hull);
  if (team === 'player' || team === 'ally') hull.multiply(new THREE.Color(FRAME_TINT[frameId] || 0xffffff));
  const std = (c, metal = 0.5, rough = 0.5) => new THREE.MeshStandardMaterial({ color: c, metalness: metal, roughness: rough, flatShading: true });
  return {
    hull: std(hull, 0.55, 0.45),
    dark: std(new THREE.Color(base.dark), 0.7, 0.55),
    accent: std(new THREE.Color(base.accent), 0.4, 0.4),
    glow: new THREE.MeshBasicMaterial({ color: base.glow }),
    glass: std(new THREE.Color(0x111820), 0.9, 0.15),
    body: new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, metalness: 0.55, roughness: 0.45, flatShading: true }),
    glowColor: new THREE.Color(base.glow),
  };
}

// ---------------------------------------------------------------------------
// weapons
// ---------------------------------------------------------------------------
const Z90 = Math.PI / 2;
export function buildWeapon(id, P) {
  const g = new THREE.Group();
  const muzzle = new THREE.Object3D();
  let len = 1.6;
  switch (id) {
    case 'pulse':
      add(g, boxG(0.6, 0.6, 1.2), P.dark, 0, 0, 0.3);
      add(g, cylG(0.17, 0.2, 1.4, 8), P.hull, 0, 0.05, 1.3, Z90);
      add(g, torG(0.24, 0.06, 4, 10), P.glow, 0, 0.05, 1.6);
      add(g, boxG(0.25, 0.2, 0.8), P.accent, 0, 0.38, 0.3);
      len = 2.1; break;
    case 'arc':
      add(g, boxG(0.55, 0.55, 1.0), P.dark, 0, 0, 0.2);
      for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; add(g, cylG(0.07, 0.07, 1.3, 5), P.hull, Math.cos(a) * 0.15, Math.sin(a) * 0.15, 1.2, Z90); }
      add(g, cylG(0.22, 0.22, 0.12, 8), P.glow, 0, 0, 0.75, Z90);
      len = 1.9; break;
    case 'scatter':
      add(g, boxG(0.8, 0.55, 1.1), P.dark, 0, 0, 0.3);
      add(g, cylG(0.2, 0.24, 0.7, 6), P.hull, -0.2, 0, 1.15, Z90);
      add(g, cylG(0.2, 0.24, 0.7, 6), P.hull, 0.2, 0, 1.15, Z90);
      add(g, boxG(0.9, 0.08, 0.5), P.glow, 0, 0.3, 0.4);
      len = 1.5; break;
    case 'gauss':
      add(g, boxG(0.5, 0.55, 1.6), P.dark, 0, 0, 0.5);
      add(g, boxG(0.1, 0.12, 1.8), P.hull, -0.17, 0, 1.5);
      add(g, boxG(0.1, 0.12, 1.8), P.hull, 0.17, 0, 1.5);
      for (let i = 0; i < 3; i++) add(g, torG(0.24, 0.05, 4, 8), P.accent, 0, 0, 0.9 + i * 0.45);
      len = 2.4; break;
    case 'plasma':
      add(g, boxG(0.6, 0.6, 0.8), P.dark, 0, 0, 0.1);
      add(g, sphG(0.42, 8, 6), P.glow, 0, 0.05, 0.7);
      add(g, cylG(0.3, 0.38, 0.6, 8), P.hull, 0, 0.05, 1.25, Z90);
      add(g, torG(0.33, 0.07, 4, 10), P.accent, 0, 0.05, 1.55);
      len = 1.7; break;
    case 'missile': case 'tempest': {
      const cols = id === 'tempest' ? 5 : 3;
      const w = cols * 0.3 + 0.2;
      add(g, boxG(w, 0.75, 1.2), P.accent, 0, 0.1, 0.3);
      add(g, boxG(w + 0.08, 0.1, 1.25), P.dark, 0, 0.5, 0.3);
      for (let r = 0; r < 2; r++) for (let c = 0; c < cols; c++) add(g, cylG(0.1, 0.1, 0.1, 6), P.glow, (c - (cols - 1) / 2) * 0.3, -0.05 + r * 0.3, 0.92, Z90);
      len = 1.0; break;
    }
    case 'rail': case 'photon':
      add(g, boxG(0.5, 0.6, 1.4), P.dark, 0, 0, 0.3);
      add(g, boxG(0.1, 0.18, 2.6), P.hull, -0.15, 0, 2.0);
      add(g, boxG(0.1, 0.18, 2.6), P.hull, 0.15, 0, 2.0);
      add(g, boxG(0.08, 0.08, 2.4), P.glow, 0, 0, 2.0);
      add(g, boxG(0.3, 0.2, 0.5), P.accent, 0, 0.38, 0.3);
      len = 3.3; break;
    case 'mortar':
      add(g, boxG(0.8, 0.5, 0.9), P.dark, 0, 0, 0);
      add(g, cylG(0.38, 0.42, 1.3, 8), P.hull, 0, 0.4, 0.5, Z90 - 0.45);
      add(g, torG(0.4, 0.07, 4, 10), P.glow, 0, 0.66, 1.08, Z90 - 0.45 - Math.PI / 2);
      len = 1.2; break;
    case 'ion':
      add(g, boxG(0.55, 0.55, 1.0), P.dark, 0, 0, 0.2);
      add(g, cylG(0.12, 0.12, 1.4, 6), P.hull, 0, 0, 1.2, Z90);
      for (let i = 0; i < 3; i++) add(g, torG(0.28 - i * 0.05, 0.05, 4, 10), P.glow, 0, 0, 1.0 + i * 0.35);
      len = 1.9; break;
    case 'blade':
      add(g, boxG(0.45, 0.5, 0.9), P.dark, 0, 0, 0.1);
      add(g, boxG(1.1, 0.25, 0.3), P.accent, 0, 0, 0.6);
      add(g, boxG(0.16, 0.6, 4.4), P.glow, 0, 0, 2.9);
      add(g, boxG(0.08, 0.2, 4.6), P.hull, 0, 0.34, 2.9);
      add(g, coneG(0.32, 0.8, 4), P.glow, 0, 0, 5.4, Z90, Math.PI / 4);
      len = 5.6; break;
    case 'claws':
      add(g, boxG(0.75, 0.6, 0.8), P.dark, 0, 0, 0.2);
      for (let i = -1; i <= 1; i++) {
        add(g, boxG(0.1, 0.22, 1.6), P.hull, i * 0.26, 0.05, 1.3, -0.15, i * 0.12);
        add(g, coneG(0.1, 0.6, 4), P.glow, i * 0.32, 0.12, 2.35, Z90 - 0.3, 0, -i * 0.12);
      }
      add(g, boxG(0.8, 0.12, 0.5), P.glow, 0, 0.36, 0.2);
      len = 2.5; break;
    case 'hammer':
      add(g, cylG(0.13, 0.15, 3.2, 6), P.dark, 0, 0, 1.4, Z90);
      add(g, boxG(1.9, 1.3, 1.2), P.hull, 0, 0, 3.3);
      add(g, boxG(2.0, 0.25, 1.25), P.accent, 0, 0.4, 3.3);
      add(g, boxG(2.0, 0.25, 1.25), P.accent, 0, -0.4, 3.3);
      add(g, boxG(0.25, 1.0, 1.3), P.glow, 0.95, 0, 3.3);
      add(g, boxG(0.25, 1.0, 1.3), P.glow, -0.95, 0, 3.3);
      len = 3.6; break;
    case 'lance':
      add(g, boxG(0.6, 0.6, 1.0), P.dark, 0, 0, 0.2);
      add(g, cylG(0.12, 0.3, 4.6, 6), P.hull, 0, 0, 3.0, Z90);
      add(g, coneG(0.3, 1.4, 6), P.glow, 0, 0, 5.9, Z90);
      for (let i = 0; i < 3; i++) add(g, torG(0.4 - i * 0.07, 0.05, 4, 10), P.glow, 0, 0, 1.3 + i * 1.2);
      len = 6.6; break;
    default:
      add(g, boxG(0.5, 0.5, 1.5), P.dark, 0, 0, 0.5);
  }
  muzzle.position.set(0, 0.05, len);
  g.add(muzzle);
  g.userData.muzzle = muzzle;
  return g;
}

// ---------------------------------------------------------------------------
// limb builders
// ---------------------------------------------------------------------------
function buildArm(torso, side, o, P) {
  const sh = grp(torso, side * o.sx, o.sy, o.sz || 0);
  add(sh, sphG(o.joint || 0.45, 8, 6), P.dark);
  const [uw, ul, ud] = o.upper;
  if (!o.floating) add(sh, boxG(uw, ul, ud), P.hull, 0, -ul / 2, 0);
  const elbow = grp(sh, 0, -ul, 0);
  if (!o.floating) add(elbow, sphG((o.joint || 0.45) * 0.8, 8, 6), P.dark);
  const [fw, fh, fl] = o.fore;
  add(elbow, boxG(fw, fh, fl), P.hull, 0, 0, fl / 2 - 0.2);
  add(elbow, boxG(fw * 1.06, fh * 0.35, fl * 0.6), P.accent, 0, fh * 0.45, fl * 0.35);
  const mount = grp(elbow, side * (fw * 0.5 + 0.25), -0.1, fl * 0.35);
  return { shoulder: sh, elbow, mount, side };
}

// Biped leg (knee bends backward). Returns leg info with chain height.
function buildBipedLeg(pelvis, side, o, P) {
  const hip = grp(pelvis, side * o.hx, 0, 0);
  add(hip, sphG(o.joint, 8, 6), P.dark);
  const [tw, tl, td] = o.thigh;
  add(hip, boxG(tw, tl, td), P.hull, 0, -tl / 2, 0);
  if (o.thighPlate) add(hip, boxG(tw * 1.05, tl * 0.6, 0.18), P.accent, 0, -tl * 0.45, td / 2 + 0.05);
  const knee = grp(hip, 0, -tl, 0);
  add(knee, sphG(o.joint * 0.85, 8, 6), P.dark);
  add(knee, boxG(tw * 0.9, 0.5, 0.35), P.accent, 0, 0.05, td / 2 + 0.1, -0.2);
  const [sw, sl, sd] = o.shin;
  add(knee, boxG(sw, sl, sd), P.hull, 0, -sl / 2, -0.05);
  add(knee, boxG(sw * 0.7, sl * 0.7, 0.15), P.dark, 0, -sl * 0.5, sd / 2 + 0.03);
  const ankle = grp(knee, 0, -sl, 0);
  const [fw, fh, fl] = o.foot;
  add(ankle, boxG(fw, fh, fl), P.dark, 0, -fh / 2, fl * 0.15);
  add(ankle, boxG(fw * 0.8, fh * 0.6, 0.4), P.hull, 0, -fh * 0.3, fl * 0.15 + fl / 2);
  return { type: 'biped', hip, knee, ankle, side, height: tl + sl + fh };
}

// Reverse-joint (digitigrade) leg.
function buildReverseLeg(pelvis, side, o, P) {
  const a1 = -0.55, a2 = 1.1, a3 = -0.55;
  const hip = grp(pelvis, side * o.hx, 0, 0);
  hip.userData.base = a1;
  add(hip, sphG(o.joint, 8, 6), P.dark);
  add(hip, boxG(o.tw, o.tl, o.tw * 1.2), P.hull, 0, -o.tl / 2, 0);
  add(hip, boxG(o.tw * 1.1, o.tl * 0.5, 0.15), P.accent, 0, -o.tl * 0.4, o.tw * 0.6 + 0.05);
  const knee = grp(hip, 0, -o.tl, 0);
  knee.userData.base = a2;
  add(knee, sphG(o.joint * 0.8, 8, 6), P.dark);
  add(knee, boxG(o.tw * 0.8, o.sl, o.tw * 0.8), P.hull, 0, -o.sl / 2, 0);
  add(knee, cylG(0.08, 0.08, o.sl * 0.9, 5), P.glow, 0, -o.sl / 2, -o.tw * 0.5);
  const ankle = grp(knee, 0, -o.sl, 0);
  ankle.userData.base = a3;
  add(ankle, sphG(o.joint * 0.6, 6, 5), P.dark);
  add(ankle, boxG(o.tw * 0.6, o.ml, o.tw * 0.6), P.dark, 0, -o.ml / 2, 0);
  const toe = grp(ankle, 0, -o.ml, 0);
  add(toe, boxG(o.tw * 1.4, 0.25, 1.3), P.dark, 0, -0.12, 0.35);
  add(toe, boxG(0.25, 0.2, 0.6), P.hull, 0, -0.1, -0.35);
  const c1 = Math.cos(a1), c2 = Math.cos(a1 + a2), c3 = Math.cos(a1 + a2 + a3);
  return { type: 'reverse', hip, knee, ankle, toe, side, height: o.tl * c1 + o.sl * c2 + o.ml * c3 + 0.25 };
}

// Spider/quad leg: sweeps horizontally, lifts on swing.
function buildQuadLeg(pelvis, x, z, yaw, o, P) {
  const hip = grp(pelvis, x, 0, z);
  hip.rotation.y = yaw;
  hip.userData.baseYaw = yaw;
  add(hip, sphG(o.joint, 8, 6), P.dark);
  const lift = grp(hip);
  const el = 0.5;
  // thigh rises outward (+Z local)
  add(lift, boxG(o.tw, o.tw, o.tl), P.hull, 0, Math.sin(el) * o.tl / 2, Math.cos(el) * o.tl / 2, -el);
  add(lift, boxG(o.tw * 1.1, 0.2, o.tl * 0.6), P.accent, 0, Math.sin(el) * o.tl / 2 + o.tw / 2, Math.cos(el) * o.tl / 2, -el);
  const knee = grp(lift, 0, Math.sin(el) * o.tl, Math.cos(el) * o.tl);
  add(knee, sphG(o.joint * 0.85, 8, 6), P.dark);
  const sa = 0.15;
  add(knee, boxG(o.tw * 0.85, o.sl, o.tw * 0.85), P.hull, 0, -Math.cos(sa) * o.sl / 2, Math.sin(sa) * o.sl / 2, sa);
  add(knee, cylG(0.5, 0.65, 0.35, 6), P.dark, 0, -Math.cos(sa) * o.sl, Math.sin(sa) * o.sl);
  return { type: 'quad', hip, lift, knee, height: Math.cos(sa) * o.sl - Math.sin(el) * o.tl + 0.17 };
}

// ---------------------------------------------------------------------------
// Merge static child meshes of each group by material for fewer draw calls
// ---------------------------------------------------------------------------
function optimize(root, P) {
  const solid = new Set([P.hull, P.dark, P.accent, P.glass]);
  const groups = [];
  root.traverse((o) => { if (o.isGroup || o === root) groups.push(o); });
  for (const g of groups) {
    const buckets = new Map();
    for (const c of g.children) {
      if (c.isMesh && !c.userData.keep && c.children.length === 0) {
        // all opaque hull parts share one vertex-colored material -> one draw call per rigid part
        const key = solid.has(c.material) ? P.body : c.material;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(c);
      }
    }
    for (const [mat, meshes] of buckets) {
      const baked = mat === P.body;
      if (meshes.length < 2 && !baked) continue;
      const geos = meshes.map((m) => {
        m.updateMatrix();
        let geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
        geo.applyMatrix4(m.matrix);
        if (baked) {
          const n = geo.attributes.position.count, c = m.material.color;
          const col = new Float32Array(n * 3);
          for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
          geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        }
        return geo;
      });
      const merged = mergeGeometries(geos, false);
      geos.forEach((x) => x.dispose());
      if (!merged) continue;
      meshes.forEach((m) => g.remove(m));
      const mm = new THREE.Mesh(merged, mat);
      mm.userData.owned = true;
      g.add(mm);
    }
  }
}

// ---------------------------------------------------------------------------
// MechModel
// ---------------------------------------------------------------------------
export class MechModel {
  /**
   * @param {string} design  frame/model id
   * @param {object} P palette
   * @param {string[]} weapons weapon ids for slot 0 (right) and 1 (left)
   * @param {object} opts { scale, extras, shadows }
   */
  constructor(design, P, weapons = ['pulse', 'missile'], opts = {}) {
    this.design = design; this.P = P;
    this.scale = opts.scale || 1;
    this.root = new THREE.Group();
    this.body = grp(this.root);
    this.pelvis = grp(this.body);
    this.torso = grp(this.pelvis);
    this.legs = []; this.arms = []; this.spin = []; this.thrusters = [];
    this.hover = false; this.headGroup = null;
    this.phase = 0; this.bob = 0; this.landDip = 0; this.recoil = [0, 0]; this.hitJolt = 0;
    this.deadT = -1; this.flashT = 0; this.time = Math.random() * 10;
    this.legHeight = 3;
    const B = DESIGNS[design] || DESIGNS.striker;
    B.call(this, P, opts);
    // weapons
    this.weaponModels = [];
    this.muzzles = [];
    this.setWeapons(weapons);
    // thruster flames
    this.flameMat = new THREE.MeshBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    for (const t of this.thrusters) {
      const f = add(t, coneG(0.28, 1.6, 6), this.flameMat, 0, -0.8, 0, Math.PI);
      f.userData.keep = true; f.visible = false; t.userData.flame = f;
    }
    optimize(this.root, P);
    this._built = true;
    this.pelvis.position.y = this.legHeight;
    this.baseHeight = this.legHeight;
    this.root.scale.setScalar(this.scale);
    this.allMats = [P.body, P.hull, P.dark, P.accent, P.glow, P.glass];
    this.root.traverse((o) => { if (o.isMesh) { o.castShadow = !!opts.shadows; o.receiveShadow = false; } });
    // shield bubble
    const sh = this.shieldMat = new THREE.MeshBasicMaterial({ color: 0x66ddff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, wireframe: false, side: THREE.DoubleSide });
    this.shieldMesh = new THREE.Mesh(sphG(1, 12, 8), sh);
    const h = (opts.height || 7) / this.scale;
    this.shieldMesh.scale.set(h * 0.45, h * 0.62, h * 0.45);
    this.shieldMesh.position.y = h * 0.52;
    this.shieldMesh.visible = false;
    this.root.add(this.shieldMesh);
    this.shieldFlash = 0; this.overshield = 0;
  }

  setWeapons(weapons) {
    for (const w of this.weaponModels) w.parent && w.parent.remove(w);
    this.weaponModels = []; this.muzzles = [];
    weapons.forEach((id, i) => {
      const arm = this.arms[i] || this.arms[0];
      if (!arm) return;
      const wm = buildWeapon(id, this.P);
      wm.scale.setScalar((this.weaponScale || 1) * 1.2);
      if (this._built) optimize(wm, this.P);
      arm.mount.add(wm);
      wm.traverse((o) => { if (o.isMesh) o.castShadow = this.root.children.length > 0 && !!this._shadows; });
      this.weaponModels.push(wm);
      this.muzzles.push(wm.userData.muzzle);
    });
  }

  flash(amount = 1) { this.flashT = Math.max(this.flashT, 0.12 * amount); this.hitJolt = Math.min(1, this.hitJolt + 0.5 * amount); }
  hitShield(overshield = false) { this.shieldFlash = 1; this.shieldMat.color.set(overshield ? 0xffd166 : 0x66ddff); }
  fire(slot) { this.recoil[slot] = 1; }
  meleeSwing(slot, style, w, a, r, combo) { (this.melee || (this.melee = []))[slot] = { style, t: 0, w, a, r, combo }; }
  land(impact) { this.landDip = Math.min(1.2, this.landDip + impact); }

  setCloak(alpha) {
    const cloaked = alpha < 0.99;
    for (const m of this.allMats) {
      if (m.transparent !== cloaked) { m.transparent = cloaked; m.needsUpdate = true; }
      m.opacity = alpha;
      m.depthWrite = !cloaked;
    }
  }

  kill() {
    if (this.deadT >= 0) return;
    this.deadT = 0;
    for (const m of [this.P.body, this.P.hull, this.P.accent, this.P.dark]) { m.color.multiplyScalar(0.3); m.emissive && m.emissive.setRGB(0, 0, 0); }
    this.P.glow.color.setRGB(0.15, 0.08, 0.05);
    this.shieldMesh.visible = false;
    this.root.traverse((o) => { if (o.userData.flame) o.userData.flame.visible = false; });
  }

  /**
   * s: { fwdSpeed, sideSpeed, maxSpeed, onGround, vy, aimPitch, torsoYaw, jet, stepLen, sprint }
   * returns 'step' event when a foot lands
   */
  update(dt, s) {
    this.time += dt;
    let stepEvt = false;
    // flash
    if (this.flashT > 0) {
      this.flashT -= dt;
      const k = Math.max(0, this.flashT / 0.12);
      this.P.body.emissive.setRGB(k * 0.9, k * 0.6, k * 0.5);
    } else if (this.P.body.emissive.r !== 0 && this.deadT < 0) this.P.body.emissive.setRGB(0, 0, 0);
    // shield bubble
    if (this.shieldFlash > 0 || this.overshield > 0) {
      this.shieldFlash = Math.max(0, this.shieldFlash - dt * 3.5);
      const o = Math.max(this.shieldFlash * 0.35, this.overshield > 0 ? 0.12 + Math.sin(this.time * 8) * 0.03 : 0);
      this.shieldMat.opacity = o;
      if (this.overshield > 0 && this.shieldFlash <= 0) this.shieldMat.color.set(0xffd166);
      this.shieldMesh.visible = o > 0.01;
    } else this.shieldMesh.visible = false;

    // death animation
    if (this.deadT >= 0) {
      this.deadT += dt;
      const k = clamp(this.deadT / 1.1, 0, 1);
      const e = k * k;
      this.torso.rotation.x = lerp(this.torso.rotation.x, 0.55, e);
      this.torso.rotation.z = lerp(this.torso.rotation.z, 0.25, e);
      this.pelvis.position.y = lerp(this.baseHeight, this.baseHeight * 0.35, e);
      for (const a of this.arms) a.shoulder.rotation.x = lerp(a.shoulder.rotation.x, 0.9, e);
      for (const l of this.legs) {
        if (l.type === 'biped') { l.hip.rotation.x = lerp(l.hip.rotation.x, -1.0, e); l.knee.rotation.x = lerp(l.knee.rotation.x, 1.9, e); }
        if (l.type === 'quad') l.lift.rotation.x = lerp(l.lift.rotation.x, 0.4, e);
      }
      if (this.deadT > 3) this.root.position.y -= dt * 1.2;
      return false;
    }

    const speed = Math.hypot(s.fwdSpeed, s.sideSpeed);
    const moveK = clamp(speed / Math.max(1, s.maxSpeed), 0, 1.6);
    const grounded = s.onGround;
    const stepLen = (s.stepLen || 3.4) / this.scale;
    const prevPhase = this.phase;
    if (grounded && speed > 0.4) {
      const dir = s.fwdSpeed < -0.3 ? -1 : 1;
      this.phase += dir * (speed / this.scale) / stepLen * Math.PI * dt;
    } else {
      // settle feet
      const target = Math.round(this.phase / Math.PI) * Math.PI;
      this.phase = damp(this.phase, target, 6, dt);
    }
    if (grounded && speed > 0.4 && Math.floor(prevPhase / Math.PI) !== Math.floor(this.phase / Math.PI)) stepEvt = true;

    this.landDip = damp(this.landDip, 0, 5, dt);
    this.hitJolt = damp(this.hitJolt, 0, 8, dt);
    const amp = grounded ? moveK : 0;
    const sideLean = clamp(s.sideSpeed / Math.max(1, s.maxSpeed), -1, 1);

    // body bob + landing crouch
    if (this.hover) {
      this.pelvis.position.y = this.baseHeight + Math.sin(this.time * 2.2) * 0.15 - this.landDip * 0.5;
      this.pelvis.rotation.x = damp(this.pelvis.rotation.x, clamp(s.fwdSpeed / s.maxSpeed, -1, 1.5) * 0.18, 5, dt);
      this.pelvis.rotation.z = damp(this.pelvis.rotation.z, -sideLean * 0.2, 5, dt);
    } else {
      const bob = Math.abs(Math.sin(this.phase)) * 0.18 * amp;
      this.pelvis.position.y = this.baseHeight - bob * 0.8 - this.landDip * 0.45 + (grounded ? 0 : 0.1);
      this.pelvis.rotation.z = damp(this.pelvis.rotation.z, Math.sin(this.phase) * 0.04 * amp - sideLean * 0.06, 8, dt);
      this.pelvis.rotation.x = 0;
    }

    // legs
    const airTuck = grounded ? 0 : clamp(0.3 + s.vy * -0.02, 0.1, 0.6);
    for (const l of this.legs) {
      const ph = this.phase + (l.side < 0 ? Math.PI : 0) + (l.phaseOff || 0);
      if (l.type === 'biped') {
        const sw = -Math.sin(ph) * 0.5 * amp;
        const bend = Math.max(0, Math.cos(ph)) * 0.8 * amp + 0.12 + this.landDip * 0.5;
        l.hip.rotation.x = damp(l.hip.rotation.x, sw - airTuck - this.landDip * 0.35, 14, dt);
        l.knee.rotation.x = damp(l.knee.rotation.x, bend + airTuck * 1.6 + this.landDip * 0.3, 14, dt);
        l.ankle.rotation.x = -(l.hip.rotation.x + l.knee.rotation.x);
        l.hip.rotation.z = damp(l.hip.rotation.z, sideLean * 0.15, 6, dt);
      } else if (l.type === 'reverse') {
        const sw = -Math.sin(ph) * 0.45 * amp;
        const lift = Math.max(0, Math.cos(ph)) * 0.55 * amp;
        l.hip.rotation.x = damp(l.hip.rotation.x, l.hip.userData.base + sw - lift * 0.6 - airTuck * 0.5 - this.landDip * 0.3, 14, dt);
        l.knee.rotation.x = damp(l.knee.rotation.x, l.knee.userData.base + lift * 0.9 + airTuck + this.landDip * 0.5, 14, dt);
        l.ankle.rotation.x = damp(l.ankle.rotation.x, l.ankle.userData.base - lift * 0.4 - this.landDip * 0.2, 14, dt);
        l.toe.rotation.x = -(l.hip.rotation.x + l.knee.rotation.x + l.ankle.rotation.x);
      } else if (l.type === 'quad') {
        const qph = this.phase + l.phaseOff;
        l.hip.rotation.y = l.hip.userData.baseYaw + Math.sin(qph) * 0.3 * amp * l.sweepSign;
        l.lift.rotation.x = damp(l.lift.rotation.x, -Math.max(0, Math.cos(qph)) * 0.35 * amp - airTuck * 0.4 + this.landDip * 0.15, 14, dt);
      }
    }
    if (this.legs.length && this.legs[0].type === 'quad' && grounded && speed > 0.4 && Math.floor(prevPhase / (Math.PI / 2)) !== Math.floor(this.phase / (Math.PI / 2))) stepEvt = true;

    // torso aim & lean
    const sprintLean = s.sprint && grounded ? 0.12 : 0;
    this.torso.rotation.y = s.torsoYaw;
    this.torso.rotation.x = damp(this.torso.rotation.x, clamp(s.fwdSpeed / Math.max(1, s.maxSpeed), -1, 1.5) * 0.07 + sprintLean - this.hitJolt * 0.15, 8, dt);
    this.torso.rotation.z = this.hitJolt * 0.08 * Math.sin(this.time * 40);
    if (this.headGroup) this.headGroup.rotation.x = -clamp(s.aimPitch, -0.5, 0.5) * 0.5;
    // arms aim
    for (let i = 0; i < this.arms.length; i++) {
      const a = this.arms[i];
      this.recoil[i] = damp(this.recoil[i] || 0, 0, 12, dt);
      const swing = (s.sprint && grounded) ? Math.sin(this.phase + (a.side > 0 ? 0 : Math.PI)) * 0.25 * amp : 0;
      a.shoulder.rotation.x = -s.aimPitch - (this.recoil[i] || 0) * 0.25 + swing;
      a.shoulder.rotation.y = 0; a.shoulder.rotation.z = 0;
      a.elbow.position.z = -(this.recoil[i] || 0) * 0.25;
    }
    // melee swing poses override the aim pose
    let twist = 0;
    if (this.melee) for (let i = 0; i < this.melee.length; i++) {
      const m = this.melee[i], a = this.arms[i];
      if (!m || !a) continue;
      m.t += dt;
      const total = m.w + m.a + m.r;
      if (m.t >= total) { this.melee[i] = null; continue; }
      const ease = (x) => x * x * (3 - 2 * x);
      // k: 0..1 windup, 1..2 strike, 2..3 recover
      const k = m.t < m.w ? m.t / m.w : m.t < m.w + m.a ? 1 + (m.t - m.w) / m.a : 2 + (m.t - m.w - m.a) / m.r;
      const side = a.side * (m.combo ? -1 : 1);
      const aim = -s.aimPitch;
      const seg = (from, mid, to) => k < 1 ? from + (mid - from) * ease(k) : k < 2 ? mid + (to - mid) * ease(k - 1) : to + (from - to) * ease(k - 2);
      if (m.style === 'slash' || m.style === 'claw') {
        const amp = m.style === 'claw' ? 0.75 : 1.15;
        a.shoulder.rotation.y = seg(0, side * amp, -side * amp * 1.1);
        a.shoulder.rotation.x = seg(aim, aim - 0.55, aim - 0.25);
        a.shoulder.rotation.z = seg(0, side * 0.35, -side * 0.2);
        twist += seg(0, side * 0.35, -side * 0.45);
      } else if (m.style === 'smash') {
        a.shoulder.rotation.x = seg(aim, -2.4, 0.55);
        twist += seg(0, 0.15 * a.side, -0.1 * a.side);
      } else if (m.style === 'thrust') {
        a.shoulder.rotation.x = aim;
        a.elbow.position.z = seg(0, -1.1, 2.4);
        twist += seg(0, a.side * 0.3, -a.side * 0.25);
      }
    }
    this.torso.rotation.y = s.torsoYaw + twist;
    // spinning bits
    for (const sp of this.spin) sp.obj.rotation[sp.axis] += sp.speed * dt;
    // thrusters
    for (const t of this.thrusters) {
      const f = t.userData.flame;
      f.visible = s.jet > 0.05;
      if (f.visible) { f.scale.set(1, 0.6 + s.jet * 0.8 + Math.random() * 0.3, 1); }
    }
    return stepEvt;
  }

  dispose() {
    this.root.traverse((o) => { if (o.isMesh && o.userData.owned) o.geometry.dispose(); });
    for (const m of this.allMats) m.dispose();
    this.flameMat.dispose(); this.shieldMat.dispose();
  }
}

// ---------------------------------------------------------------------------
// DESIGNS — each called with `this` = MechModel
// ---------------------------------------------------------------------------
const DESIGNS = {
  striker(P) {
    const pel = this.pelvis, T = this.torso;
    add(pel, boxG(1.7, 0.6, 1.1), P.dark);
    add(pel, boxG(1.2, 0.35, 0.3), P.accent, 0, -0.1, 0.6);
    const lo = { hx: 0.75, joint: 0.42, thigh: [0.7, 1.6, 0.85], shin: [0.62, 1.6, 0.75], foot: [0.95, 0.35, 1.6], thighPlate: true };
    this.legs.push(buildBipedLeg(pel, 1, lo, P), buildBipedLeg(pel, -1, lo, P));
    this.legHeight = this.legs[0].height;
    add(T, cylG(0.55, 0.65, 0.6, 8), P.dark, 0, 0.35, 0);
    add(T, boxG(2.5, 1.5, 1.7), P.hull, 0, 1.3, 0);
    add(T, boxG(2.1, 0.9, 0.35), P.accent, 0, 1.35, 0.92, -0.2);
    add(T, boxG(1.4, 0.12, 0.05), P.glow, 0, 1.75, 0.88);
    add(T, boxG(0.4, 1.0, 1.3), P.dark, 1.35, 1.2, 0);
    add(T, boxG(0.4, 1.0, 1.3), P.dark, -1.35, 1.2, 0);
    add(T, boxG(1.7, 1.3, 0.8), P.dark, 0, 1.45, -1.1);
    add(T, boxG(1.75, 0.15, 0.85), P.accent, 0, 2.15, -1.1);
    const th1 = grp(T, 0.5, 0.75, -1.35), th2 = grp(T, -0.5, 0.75, -1.35);
    add(th1, cylG(0.25, 0.32, 0.4, 6), P.dark); add(th2, cylG(0.25, 0.32, 0.4, 6), P.dark);
    this.thrusters.push(th1, th2);
    const head = this.headGroup = grp(T, 0, 2.25, 0.25);
    add(head, boxG(0.95, 0.6, 1.0), P.hull, 0, 0.1, 0);
    add(head, boxG(0.8, 0.14, 0.1), P.glow, 0, 0.12, 0.52);
    add(head, boxG(0.7, 0.2, 0.5), P.accent, 0, 0.45, -0.1);
    add(head, boxG(0.06, 0.9, 0.06), P.dark, 0.35, 0.7, -0.3);
    add(T, boxG(1.15, 0.5, 1.3), P.accent, 1.75, 2.1, 0, 0, 0, -0.25);
    add(T, boxG(1.15, 0.5, 1.3), P.accent, -1.75, 2.1, 0, 0, 0, 0.25);
    const ao = { sx: 1.8, sy: 1.75, joint: 0.42, upper: [0.55, 1.0, 0.6], fore: [0.7, 0.75, 1.4] };
    this.arms.push(buildArm(T, 1, ao, P), buildArm(T, -1, ao, P));
  },

  viper(P) {
    const pel = this.pelvis, T = this.torso;
    add(pel, boxG(1.3, 0.5, 0.9), P.dark);
    const lo = { hx: 0.7, joint: 0.32, tw: 0.42, tl: 1.5, sl: 1.7, ml: 0.75 };
    this.legs.push(buildReverseLeg(pel, 1, lo, P), buildReverseLeg(pel, -1, lo, P));
    this.legHeight = this.legs[0].height;
    add(T, boxG(1.5, 0.9, 2.3), P.hull, 0, 0.75, 0.25, 0.12);
    add(T, boxG(1.2, 0.5, 1.4), P.accent, 0, 1.25, 0.1, 0.1);
    add(T, coneG(0.6, 1.4, 6), P.hull, 0, 0.7, 1.9, Math.PI / 2 + 0.12);
    add(T, hemiG(0.55), P.glass, 0, 1.15, 0.85, 0.3, 0, 0, 1, 0.8, 1.4);
    add(T, sphG(0.22, 8, 6), P.glow, 0, 0.75, 2.45);
    add(T, boxG(0.08, 0.9, 1.0), P.accent, 0, 1.5, -0.9, -0.4);
    add(T, boxG(1.8, 0.08, 0.6), P.dark, 0, 1.1, -0.9);
    add(T, boxG(0.1, 0.1, 1.8), P.glow, 0.76, 0.75, 0.3, 0.12);
    add(T, boxG(0.1, 0.1, 1.8), P.glow, -0.76, 0.75, 0.3, 0.12);
    const th = grp(T, 0, 0.6, -1.05);
    add(th, cylG(0.3, 0.35, 0.4, 6), P.dark, 0, 0, 0, Math.PI / 2);
    this.thrusters.push(th);
    this.headGroup = grp(T, 0, 1.1, 1.4);
    const ao = { sx: 1.05, sy: 0.75, joint: 0.3, upper: [0.32, 0.5, 0.35], fore: [0.45, 0.45, 1.1] };
    this.arms.push(buildArm(T, 1, ao, P), buildArm(T, -1, ao, P));
    this.weaponScale = 0.8;
  },

  phantom(P) {
    const pel = this.pelvis, T = this.torso;
    add(pel, boxG(1.3, 0.5, 0.8), P.dark);
    const lo = { hx: 0.6, joint: 0.32, thigh: [0.48, 1.9, 0.55], shin: [0.42, 2.0, 0.5], foot: [0.6, 0.3, 1.3] };
    this.legs.push(buildBipedLeg(pel, 1, lo, P), buildBipedLeg(pel, -1, lo, P));
    this.legHeight = this.legs[0].height;
    add(T, cylG(0.35, 0.45, 0.6, 6), P.dark, 0, 0.3, 0);
    add(T, octG(1), P.hull, 0, 1.3, 0, 0, Math.PI / 4, 0, 1.15, 1.0, 0.8);
    add(T, boxG(1.6, 0.25, 0.9), P.dark, 0, 1.75, 0);
    add(T, boxG(0.12, 0.7, 0.1), P.glow, 0.25, 1.3, 0.62, 0.3);
    add(T, boxG(0.12, 0.7, 0.1), P.glow, -0.25, 1.3, 0.62, 0.3);
    for (const sx of [-1, 1]) {
      add(T, boxG(0.08, 2.6, 0.9), P.accent, sx * 0.55, 0.9, -0.85, 0.35, 0, sx * 0.18);
      add(T, boxG(0.06, 2.2, 0.6), P.dark, sx * 0.95, 1.0, -0.7, 0.3, 0, sx * 0.35);
    }
    const head = this.headGroup = grp(T, 0, 2.15, 0.15);
    add(head, boxG(0.55, 0.45, 1.0), P.hull, 0, 0.1, 0.1);
    add(head, boxG(0.08, 0.7, 1.1), P.accent, 0, 0.5, -0.15, -0.3);
    add(head, boxG(0.5, 0.08, 0.08), P.glow, 0, 0.12, 0.62);
    add(T, boxG(0.8, 0.3, 0.9), P.dark, 1.15, 1.85, 0, 0, 0, -0.5);
    add(T, boxG(0.8, 0.3, 0.9), P.dark, -1.15, 1.85, 0, 0, 0, 0.5);
    const ao = { sx: 1.2, sy: 1.6, joint: 0.3, upper: [0.38, 1.2, 0.4], fore: [0.45, 0.5, 1.5] };
    this.arms.push(buildArm(T, 1, ao, P), buildArm(T, -1, ao, P));
    for (const a of this.arms) add(a.elbow, boxG(0.06, 0.35, 1.6), P.glow, -a.side * 0.26, 0.1, 0.6);
    this.weaponScale = 0.85;
    const th = grp(T, 0, 1.0, -0.6); this.thrusters.push(th);
  },

  bulwark(P) {
    const pel = this.pelvis, T = this.torso;
    add(pel, boxG(2.1, 0.7, 1.3), P.dark);
    const lo = { hx: 0.95, joint: 0.5, thigh: [0.95, 1.3, 1.05], shin: [1.0, 1.35, 1.1], foot: [1.4, 0.45, 1.9], thighPlate: true };
    this.legs.push(buildBipedLeg(pel, 1, lo, P), buildBipedLeg(pel, -1, lo, P));
    this.legHeight = this.legs[0].height;
    add(T, cylG(1.45, 1.25, 1.8, 8), P.hull, 0, 1.25, 0);
    add(T, hemiG(1.45), P.dark, 0, 2.15, 0, 0, 0, 0, 1, 0.55, 1);
    add(T, boxG(2.0, 1.2, 0.35), P.accent, 0, 1.2, 1.3, -0.1);
    add(T, boxG(1.2, 0.12, 0.05), P.glow, 0, 1.65, 1.45);
    add(T, boxG(1.8, 1.4, 0.8), P.dark, 0, 1.4, -1.3);
    const head = this.headGroup = grp(T, 0, 2.6, 0.45);
    add(head, sphG(0.55, 10, 6), P.hull, 0, 0, 0, 0, 0, 0, 1, 0.8, 1);
    add(head, torG(0.52, 0.07, 4, 14), P.glow, 0, 0, 0.0, Math.PI / 2, 0, 0, 1, 1, 1);
    for (const sx of [-1, 1]) {
      const gen = grp(T, sx * 1.9, 2.15, 0);
      add(gen, cylG(0.5, 0.6, 0.6, 8), P.dark);
      const ring = add(gen, torG(0.7, 0.08, 4, 14), P.glow, 0, 0.35, 0, Math.PI / 2);
      ring.userData.keep = true;
      this.spin.push({ obj: ring, axis: 'z', speed: sx * 1.5 });
    }
    const ao = { sx: 1.95, sy: 1.6, joint: 0.5, upper: [0.7, 1.0, 0.75], fore: [0.85, 0.85, 1.4] };
    this.arms.push(buildArm(T, 1, ao, P), buildArm(T, -1, ao, P));
    const sh = this.arms[1].elbow;
    add(sh, boxG(0.25, 2.8, 2.0), P.accent, -0.75, 0.1, 0.6);
    add(sh, boxG(0.1, 2.4, 0.08), P.glow, -0.9, 0.1, 1.55);
    add(sh, boxG(0.1, 0.08, 1.6), P.glow, -0.9, 1.4, 0.6);
    const th1 = grp(T, 0.6, 0.8, -1.75), th2 = grp(T, -0.6, 0.8, -1.75);
    this.thrusters.push(th1, th2);
  },

  titan(P) {
    const pel = this.pelvis, T = this.torso;
    add(pel, boxG(2.4, 0.8, 1.5), P.dark);
    add(pel, boxG(1.8, 0.6, 0.35), P.accent, 0, -0.2, 0.8);
    const lo = { hx: 1.15, joint: 0.6, thigh: [1.25, 1.9, 1.35], shin: [1.15, 1.9, 1.25], foot: [1.7, 0.5, 2.3], thighPlate: true };
    this.legs.push(buildBipedLeg(pel, 1, lo, P), buildBipedLeg(pel, -1, lo, P));
    this.legHeight = this.legs[0].height;
    add(T, cylG(0.8, 1.0, 0.8, 8), P.dark, 0, 0.45, 0);
    add(T, boxG(3.6, 2.3, 2.4), P.hull, 0, 1.9, 0);
    add(T, boxG(3.0, 1.3, 0.4), P.accent, 0, 2.2, 1.3, -0.25);
    add(T, boxG(2.4, 0.8, 0.4), P.dark, 0, 1.15, 1.25, 0.2);
    add(T, boxG(2.6, 1.8, 1.0), P.dark, 0, 2.0, -1.6);
    for (const sx of [-0.8, 0.8]) {
      add(T, cylG(0.3, 0.35, 1.6, 6), P.dark, sx, 3.4, -1.6);
      add(T, cylG(0.33, 0.33, 0.1, 6), P.glow, sx, 4.2, -1.6);
    }
    const head = this.headGroup = grp(T, 0, 3.0, 0.9);
    add(head, boxG(1.0, 0.55, 0.8), P.hull, 0, 0.1, 0);
    add(head, boxG(0.85, 0.12, 0.1), P.glow, 0, 0.12, 0.42);
    for (const sx of [-1, 1]) {
      add(T, boxG(1.9, 1.2, 2.2), P.accent, sx * 2.45, 3.0, 0, 0, 0, sx * -0.18);
      add(T, boxG(1.6, 0.25, 1.9), P.dark, sx * 2.45, 3.65, 0, 0, 0, sx * -0.18);
    }
    const ao = { sx: 2.5, sy: 2.4, joint: 0.6, upper: [1.0, 1.5, 1.0], fore: [1.2, 1.2, 1.9] };
    this.arms.push(buildArm(T, 1, ao, P), buildArm(T, -1, ao, P));
    this.weaponScale = 1.3;
    const th1 = grp(T, 0.8, 1.0, -2.1), th2 = grp(T, -0.8, 1.0, -2.1);
    this.thrusters.push(th1, th2);
  },

  juggernaut(P) {
    const pel = this.pelvis, T = this.torso;
    add(pel, boxG(3.4, 1.3, 3.8), P.dark);
    add(pel, boxG(3.0, 0.4, 3.4), P.hull, 0, 0.75, 0);
    add(pel, boxG(2.4, 0.5, 0.3), P.glow, 0, 0, 1.92);
    const lo = { joint: 0.55, tw: 0.8, tl: 2.2, sl: 3.0 };
    const corners = [[1.5, 1.6, Math.PI / 4, 0, 1], [-1.5, 1.6, -Math.PI / 4, Math.PI, 1], [1.5, -1.6, Math.PI * 3 / 4, Math.PI, -1], [-1.5, -1.6, -Math.PI * 3 / 4, 0, -1]];
    for (const [x, z, yaw, off, sweep] of corners) {
      const l = buildQuadLeg(pel, x, z, yaw, lo, P);
      l.phaseOff = off; l.sweepSign = sweep * (x > 0 ? 1 : -1);
      this.legs.push(l);
    }
    this.legHeight = this.legs[0].height + 0.6;
    T.position.y = 0.9;
    add(T, cylG(1.4, 1.6, 0.5, 8), P.dark, 0, 0.2, 0);
    add(T, boxG(2.8, 1.5, 2.6), P.hull, 0, 1.15, -0.1);
    add(T, boxG(2.4, 0.9, 0.6), P.accent, 0, 1.25, 1.35, -0.3);
    add(T, boxG(1.6, 0.14, 0.06), P.glow, 0, 1.45, 1.55);
    add(T, boxG(2.2, 0.4, 2.0), P.dark, 0, 2.05, -0.3);
    add(T, boxG(1.4, 1.2, 1.0), P.dark, 0, 1.3, -1.8);
    const head = this.headGroup = grp(T, 0, 2.3, 0.7);
    add(head, boxG(0.9, 0.5, 0.9), P.accent);
    add(head, boxG(0.7, 0.1, 0.06), P.glow, 0, 0, 0.47);
    add(head, boxG(0.06, 1.0, 0.06), P.dark, 0.3, 0.6, -0.2);
    const ao = { sx: 1.85, sy: 1.3, joint: 0.5, upper: [0.6, 0.5, 0.6], fore: [0.9, 0.9, 1.6] };
    this.arms.push(buildArm(T, 1, ao, P), buildArm(T, -1, ao, P));
    this.weaponScale = 1.2;
    const th1 = grp(T, 0.5, 0.9, -2.3), th2 = grp(T, -0.5, 0.9, -2.3);
    this.thrusters.push(th1, th2);
  },

  wraith(P) {
    const pel = this.pelvis, T = this.torso;
    this.hover = true;
    this.legHeight = 3.0;
    add(pel, coneG(1.0, 2.0, 8), P.hull, 0, -1.0, 0, Math.PI);
    add(pel, cylG(1.15, 1.0, 0.4, 8), P.dark, 0, 0.05, 0);
    const ring = add(pel, torG(1.45, 0.12, 4, 18), P.glow, 0, -1.2, 0, Math.PI / 2);
    ring.userData.keep = true;
    this.spin.push({ obj: ring, axis: 'z', speed: 2.5 });
    const ring2 = add(pel, torG(1.0, 0.08, 4, 14), P.glow, 0, -2.0, 0, Math.PI / 2);
    ring2.userData.keep = true;
    this.spin.push({ obj: ring2, axis: 'z', speed: -3.5 });
    add(T, cylG(0.95, 0.55, 2.3, 6), P.hull, 0, 1.3, 0);
    add(T, cylG(0.7, 0.95, 0.5, 6), P.dark, 0, 2.6, 0);
    add(T, sphG(0.38, 8, 6), P.glow, 0, 1.6, 0.7);
    add(T, boxG(1.6, 0.25, 0.4), P.accent, 0, 2.35, 0.55, -0.2);
    const head = this.headGroup = grp(T, 0, 3.1, 0.1);
    add(head, octG(0.5), P.hull, 0, 0.1, 0.1, 0, 0, 0, 0.9, 0.8, 1.4);
    add(head, boxG(0.5, 0.06, 0.06), P.glow, 0, 0.12, 0.72);
    add(head, boxG(0.06, 0.9, 0.06), P.accent, 0.3, 0.6, -0.3, -0.5, 0, -0.3);
    add(head, boxG(0.06, 0.9, 0.06), P.accent, -0.3, 0.6, -0.3, -0.5, 0, 0.3);
    for (const sx of [-1, 1]) {
      const shard = grp(T, sx * 1.1, 2.4, -1.0);
      const s = add(shard, octG(0.45), P.glow, 0, 0, 0, 0, 0, 0, 0.5, 1.6, 0.5);
      s.userData.keep = true;
      this.spin.push({ obj: shard, axis: 'y', speed: sx * 1.8 });
    }
    const ao = { sx: 1.55, sy: 2.0, joint: 0.38, upper: [0.4, 0.7, 0.4], fore: [0.6, 0.6, 1.4], floating: true };
    this.arms.push(buildArm(T, 1, ao, P), buildArm(T, -1, ao, P));
    for (const a of this.arms) add(a.elbow, torG(0.42, 0.06, 4, 10), P.glow, 0, 0, -0.1);
    const th = grp(pel, 0, -2.0, 0); this.thrusters.push(th);
  },

  apex(P, opts) {
    const pel = this.pelvis, T = this.torso;
    add(pel, boxG(1.8, 0.6, 1.1), P.dark);
    add(pel, boxG(0.8, 0.5, 0.3), P.accent, 0, -0.15, 0.6, -0.2);
    const lo = { hx: 0.8, joint: 0.42, thigh: [0.75, 2.0, 0.85], shin: [0.65, 2.0, 0.8], foot: [0.9, 0.35, 1.7], thighPlate: true };
    this.legs.push(buildBipedLeg(pel, 1, lo, P), buildBipedLeg(pel, -1, lo, P));
    for (const l of this.legs) add(l.knee, coneG(0.25, 0.9, 4), P.accent, 0, 0.25, 0.55, -1.2);
    this.legHeight = this.legs[0].height;
    add(T, cylG(0.5, 0.6, 0.6, 8), P.dark, 0, 0.35, 0);
    add(T, boxG(1.4, 1.6, 1.6), P.hull, 0.6, 1.4, 0, 0, 0, -0.2);
    add(T, boxG(1.4, 1.6, 1.6), P.hull, -0.6, 1.4, 0, 0, 0, 0.2);
    add(T, octG(0.42), P.glow, 0, 1.3, 0.85);
    add(T, boxG(2.0, 0.3, 1.2), P.accent, 0, 2.2, 0.1);
    add(T, boxG(1.4, 1.2, 0.8), P.dark, 0, 1.5, -1.0);
    for (const sx of [-1, 1]) {
      const w = grp(T, sx * 0.7, 1.9, -1.2);
      w.rotation.set(0.2, sx * -0.5, sx * -0.6);
      add(w, boxG(0.18, 3.0, 0.9), P.hull, 0, 1.4, 0);
      add(w, boxG(0.2, 2.8, 0.12), P.glow, 0, 1.4, 0.45);
      add(w, boxG(0.16, 2.2, 0.7), P.accent, 0, 1.1, -0.6);
      this.thrusters.push(grp(w, 0, 0, 0));
    }
    const head = this.headGroup = grp(T, 0, 2.55, 0.2);
    add(head, boxG(0.75, 0.6, 0.9), P.hull, 0, 0.1, 0);
    add(head, boxG(0.65, 0.1, 0.1), P.glow, 0, 0.15, 0.47);
    add(head, coneG(0.12, 0.8, 4), P.accent, 0, 0.75, -0.1);
    add(head, coneG(0.1, 0.6, 4), P.accent, 0.3, 0.6, -0.15, 0, 0, -0.4);
    add(head, coneG(0.1, 0.6, 4), P.accent, -0.3, 0.6, -0.15, 0, 0, 0.4);
    const halo = add(T, torG(0.9, 0.06, 4, 20), P.glow, 0, 2.9, -0.7, 0.2);
    halo.userData.keep = true;
    if (opts && opts.extras === 'omega') {
      const big = add(T, torG(2.0, 0.12, 4, 28), P.glow, 0, 3.0, -1.0, 0.25);
      big.userData.keep = true;
      this.spin.push({ obj: big, axis: 'z', speed: 0.8 });
    }
    add(T, boxG(1.0, 0.45, 1.3), P.accent, 1.55, 2.05, 0, 0, 0, -0.35);
    add(T, boxG(1.0, 0.45, 1.3), P.accent, -1.55, 2.05, 0, 0, 0, 0.35);
    const ao = { sx: 1.7, sy: 1.75, joint: 0.42, upper: [0.55, 1.1, 0.6], fore: [0.7, 0.75, 1.5] };
    this.arms.push(buildArm(T, 1, ao, P), buildArm(T, -1, ao, P));
  },
};

// Boss extras layered on base designs
export function addBossExtras(model, kind) {
  const P = model.P, T = model.torso;
  if (kind === 'irongiant') {
    // Bastion shield emitter plate (toggled by boss logic)
    const mat = new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(6, 5, 1, 1), mat);
    plate.position.set(0, 1.8, 3.2);
    T.add(plate);
    model.bastion = plate;
    const reactor = new THREE.Mesh(sphG(0.75, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffdd55 }));
    reactor.position.set(0, 2.1, -2.2);
    T.add(reactor);
    model.weakPoint = reactor;
    add(T, torG(0.9, 0.12, 4, 14), P.dark, 0, 2.1, -2.15);
  } else if (kind === 'phantomzero') {
    for (const a of model.arms) {
      const b = add(a.elbow, boxG(0.12, 0.22, 3.2), P.glow, -a.side * 0.35, 0, 1.6);
      b.userData.keep = true;
    }
  } else if (kind === 'overlord') {
    const pel = model.pelvis;
    for (const [x, z] of [[1.2, -1.2], [-1.2, -1.2], [0, -1.6]]) {
      add(T, cylG(0.08, 0.15, 3.5, 5), P.dark, x, 3.5, z);
      add(T, sphG(0.22, 6, 5), P.glow, x, 5.3, z);
    }
    const dome = add(T, hemiG(1.2), P.glass, 0, 2.25, 0.2);
    dome.userData.keep = true;
    add(pel, boxG(3.6, 0.2, 0.2), P.glow, 0, 0.7, -1.95);
  }
}
