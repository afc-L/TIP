// NPC bodies: one skinned mesh per person (rigidly-skinned sculpted parts merged into a
// single draw call) plus a face card with painted, swappable expressions.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { limbGeo, blob, torsoGeo } from './anatomy.js';
import { faceTexture, tex } from '../core/textures.js';
import { mulberry32 } from '../core/util.js';

const SKIN_TONES = [[232, 196, 170], [214, 170, 140], [190, 145, 110], [160, 115, 85], [120, 85, 60], [90, 62, 45], [240, 210, 190]];
const HAIR = [0x1a1410, 0x3a2a1a, 0x5a4028, 0x8a6a40, 0xb09060, 0x222222, 0x777068, 0xa04020];
export const OUTFITS = {
  casual: { tops: [0x3a4a6a, 0x6a2a2a, 0x2a4a3a, 0x8a8a80, 0x202020, 0xa08060, 0x4a3a5a, 0xc0b8a8], bottoms: [0x2a3040, 0x3a3a3a, 0x504030, 0x1a1a22, 0x6a6050], jacket: 0.3 },
  hiker: { tops: [0xb03020, 0x2050a0, 0x308040, 0xd0a020, 0x704090, 0x206060], bottoms: [0x404030, 0x303438, 0x5a4a3a], jacket: 0.8, backpack: 0.8, hat: 0.4 },
  city: { tops: [0x202228, 0x3a3a40, 0x5a1a1a, 0x1a2a3a, 0x8a7a6a, 0x2a2a2a, 0x6a5a4a], bottoms: [0x1a1a1e, 0x2a2a30, 0x3a3020], jacket: 0.7, coat: 0.4 },
  explorer: { tops: [0x2a2a2a, 0x3a4030, 0x4a3a2a, 0x1a1a1a], bottoms: [0x2a2a2a, 0x303428], jacket: 0.9, backpack: 0.6, hat: 0.3 },
  guard: { tops: [0x1a2238], bottoms: [0x15181f], jacket: 1, hat: 1, vest: 1 },
  searcher: { tops: [0x2a3020], bottoms: [0x2a2a20], jacket: 1, vest: 1, hat: 0.5 },
  lost: { tops: [0x5a5a5a, 0x4a4a4e, 0x6a6660], bottoms: [0x3a3a3a, 0x444444], jacket: 0, gown: 0.6 },
  patient: { tops: [0x8aa0a8], bottoms: [0x8aa0a8], gown: 1 },
};

const BONES = ['hips', 'spine', 'chest', 'neck', 'head', 'shoulderL', 'upperArmL', 'foreArmL', 'handL', 'shoulderR', 'upperArmR', 'foreArmR', 'handR', 'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR'];
const BI = Object.fromEntries(BONES.map((b, i) => [b, i]));

export function buildHumanoid(seed, outfitKey = 'casual', opts = {}) {
  const r = mulberry32(seed * 7919 + 13);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const O = OUTFITS[outfitKey] || OUTFITS.casual;
  const female = r() < 0.5;
  const child = opts.child || false;
  const H = child ? 0.62 + r() * 0.1 : (female ? 0.93 : 1.0) + (r() - 0.5) * 0.1; // height scale
  const build = 0.85 + r() * 0.35; // girth
  const skin = opts.lost ? [150, 150, 155] : pick(SKIN_TONES);
  const skinCol = new THREE.Color(`rgb(${skin[0]},${skin[1]},${skin[2]})`);
  const hairCol = new THREE.Color(opts.lost ? 0x222222 : pick(HAIR));
  const top = new THREE.Color(pick(O.tops)), bottom = new THREE.Color(pick(O.bottoms));
  const shoe = new THREE.Color(r() < 0.5 ? 0x151515 : pick([0x3a2a1a, 0xdddddd, 0x5a5a5a]));
  const hasJacket = r() < (O.jacket || 0), hasPack = r() < (O.backpack || 0), hasHat = r() < (O.hat || 0), gown = r() < (O.gown || 0), coat = r() < (O.coat || 0);
  const jacketCol = top.clone().multiplyScalar(0.7);
  const vest = O.vest ? new THREE.Color(outfitKey === 'guard' ? 0x111418 : 0xc8a020) : null;

  // ---- skeleton in rest pose ----
  const bones = {}; const boneList = [];
  const mkBone = (name, parent, x, y, z) => { const b = new THREE.Bone(); b.name = name; b.position.set(x, y, z); if (parent) bones[parent].add(b); bones[name] = b; boneList[BI[name]] = b; return b; };
  const hipY = 0.95 * H;
  mkBone('hips', null, 0, hipY, 0);
  mkBone('spine', 'hips', 0, 0.1 * H, 0);
  mkBone('chest', 'spine', 0, 0.22 * H, 0);
  mkBone('neck', 'chest', 0, 0.26 * H, 0);
  mkBone('head', 'neck', 0, 0.09 * H, 0.01);
  const shW = (female ? 0.165 : 0.19) * H * (0.9 + build * 0.1);
  for (const [s, sd] of [[1, 'L'], [-1, 'R']]) {
    mkBone('shoulder' + sd, 'chest', s * shW, 0.21 * H, 0);
    mkBone('upperArm' + sd, 'shoulder' + sd, s * 0.02, 0, 0);
    mkBone('foreArm' + sd, 'upperArm' + sd, 0, -0.29 * H, 0);
    mkBone('hand' + sd, 'foreArm' + sd, 0, -0.26 * H, 0);
    mkBone('thigh' + sd, 'hips', s * 0.095 * H * (female ? 1.08 : 1), -0.05 * H, 0);
    mkBone('shin' + sd, 'thigh' + sd, 0, -0.44 * H, 0);
    mkBone('foot' + sd, 'shin' + sd, 0, -0.43 * H, 0);
  }
  bones.hips.updateMatrixWorld(true);
  const restPos = (name) => new THREE.Vector3().setFromMatrixPosition(bones[name].matrixWorld);

  // ---- parts ----
  const parts = [];
  const part = (bone, geo, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1));
    geo.applyMatrix4(m);
    geo.translate(...restPos(bone).toArray());
    parts.push({ geo, bone, color });
  };
  const bw = build;
  // torso
  const torsoCol = gown ? top : top;
  part('hips', torsoGeo([[-0.08, 0.12 * bw], [0.0, 0.155 * bw * (female ? 1.08 : 1)], [0.1, 0.14 * bw]].map(([y, rr]) => [y * H, rr * H]), { sx: 1, sz: 0.68, seg: 14 }), gown ? top : bottom);
  part('spine', torsoGeo([[0, 0.135 * bw], [0.12, 0.13 * bw], [0.23, 0.145 * bw]].map(([y, rr]) => [y * H, rr * H]), { sx: 1, sz: 0.66, seg: 14 }), torsoCol);
  part('chest', torsoGeo([[0, 0.145 * bw], [0.1, (female ? 0.155 : 0.165) * bw], [0.2, 0.17 * bw], [0.25, 0.1], [0.28, 0.05]].map(([y, rr]) => [y * H, rr * H]), { sx: 1.08, sz: 0.62, seg: 14 }), torsoCol);
  if (female && !child) for (const s of [-1, 1]) part('chest', blob(0.055 * H, 0.05 * H, 0.05 * H, { seg: 8 }), torsoCol, s * 0.065 * H, 0.1 * H, 0.075 * H);
  if (hasJacket || coat) {
    part('chest', torsoGeo([[0, 0.155 * bw], [0.12, 0.18 * bw], [0.24, 0.18 * bw], [0.28, 0.08]].map(([y, rr]) => [y * H, rr * H]), { sx: 1.1, sz: 0.64, seg: 14 }), jacketCol);
    part('spine', torsoGeo([[0, 0.15 * bw], [0.23, 0.155 * bw]].map(([y, rr]) => [y * H, rr * H]), { sx: 1.05, sz: 0.68, seg: 14 }), jacketCol);
  }
  if (coat || gown) part('hips', torsoGeo([[-0.42, 0.2 * bw], [-0.1, 0.17 * bw], [0.1, 0.15 * bw]].map(([y, rr]) => [y * H, rr * H]), { sx: 1, sz: 0.75, seg: 14 }), gown ? top : jacketCol);
  if (vest) part('chest', torsoGeo([[0.02, 0.165 * bw], [0.2, 0.175 * bw], [0.24, 0.12]].map(([y, rr]) => [y * H, rr * H]), { sx: 1.1, sz: 0.66, seg: 12 }), vest);
  if (hasPack) part('chest', new THREE.BoxGeometry(0.28 * H, 0.38 * H, 0.16 * H), new THREE.Color(pick([0x303030, 0x6a2020, 0x204060, 0x3a4a2a])), 0, 0.08 * H, -0.17 * H);
  // neck + head
  part('neck', limbGeo(0.09 * H, 0.05 * H, 0.055 * H, { seg: 8, rings: 3, bulge: 0 }), skinCol, 0, 0.08 * H, 0);
  part('head', blob(0.085 * H, 0.11 * H, 0.1 * H, { seg: 14 }), skinCol, 0, 0.1 * H, 0);
  part('head', blob(0.06 * H, 0.04 * H, 0.06 * H, { seg: 8 }), skinCol, 0, 0.03 * H, 0.03 * H); // jaw
  for (const s of [-1, 1]) part('head', blob(0.014 * H, 0.025 * H, 0.012 * H, { seg: 6 }), skinCol, s * 0.085 * H, 0.1 * H, 0); // ears
  part('head', blob(0.016 * H, 0.025 * H, 0.02 * H, { seg: 6 }), skinCol, 0, 0.09 * H, 0.1 * H); // nose
  // hair styles
  const style = opts.lost ? 0 : Math.floor(r() * 5);
  if (style !== 4 || female) part('head', blob(0.092 * H, 0.08 * H, 0.105 * H, { seg: 12 }), hairCol, 0, 0.15 * H, -0.012 * H);
  if (female && style < 3) part('head', blob(0.08 * H, 0.14 * H, 0.05 * H, { seg: 10 }), hairCol, 0, 0.06 * H, -0.07 * H);
  if (female && style === 3) part('head', limbGeo(0.18 * H, 0.025 * H, 0.012 * H, { seg: 6, rings: 4 }), hairCol, 0, 0.13 * H, -0.1 * H, 0.4, 0, 0);
  if (hasHat) {
    const hc = new THREE.Color(outfitKey === 'guard' ? 0x15181f : pick([0x202020, 0x6a1a1a, 0x2a3a5a, 0x4a4a3a]));
    part('head', blob(0.096 * H, 0.06 * H, 0.108 * H, { seg: 12 }), hc, 0, 0.17 * H, 0);
    part('head', new THREE.CylinderGeometry(0.1 * H, 0.1 * H, 0.012 * H, 12).scale(0.9, 1, 0.9).translate(0, 0, 0.06 * H), hc, 0, 0.15 * H, 0.0);
  }
  // arms
  const sleeve = hasJacket || coat ? jacketCol : top;
  const shortSleeve = !hasJacket && !coat && r() < 0.4;
  for (const sd of ['L', 'R']) {
    part('shoulder' + sd, blob(0.06 * H * bw, 0.06 * H, 0.06 * H, { seg: 8 }), sleeve);
    part('upperArm' + sd, limbGeo(0.29 * H, 0.05 * H * bw, 0.04 * H * bw, { seg: 8, rings: 5, bulge: 0.12 }), shortSleeve ? skinCol : sleeve);
    if (shortSleeve) part('upperArm' + sd, limbGeo(0.12 * H, 0.056 * H * bw, 0.05 * H * bw, { seg: 8, rings: 3, bulge: 0 }), top);
    part('foreArm' + sd, limbGeo(0.26 * H, 0.038 * H * bw, 0.03 * H, { seg: 8, rings: 5, bulge: 0.1 }), shortSleeve || gown ? skinCol : sleeve);
    part('hand' + sd, blob(0.03 * H, 0.06 * H, 0.016 * H, { seg: 8 }), skinCol, 0, -0.05 * H, 0);
    part('hand' + sd, limbGeo(0.05 * H, 0.012 * H, 0.008 * H, { seg: 5, rings: 3 }), skinCol, 0.025 * H * (sd === 'L' ? 1 : -1), -0.03 * H, 0.015 * H, 0.4, 0, 0);
  }
  // legs
  for (const sd of ['L', 'R']) {
    const legCol = gown ? skinCol : bottom;
    part('thigh' + sd, limbGeo(0.44 * H, 0.075 * H * bw, 0.052 * H * bw, { seg: 10, rings: 5, bulge: 0.08 }), legCol);
    part('shin' + sd, limbGeo(0.43 * H, 0.052 * H * bw, 0.038 * H, { seg: 8, rings: 5, bulge: 0.15, bulgeAt: 0.25 }), legCol);
    part('foot' + sd, blob(0.042 * H, 0.035 * H, 0.11 * H, { seg: 8 }), shoe, 0, -0.025 * H, 0.05 * H);
  }

  // ---- merge into one skinned geometry ----
  const geos = parts.map(({ geo, bone, color }) => {
    let g = geo.index ? geo.toNonIndexed() : geo;
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    const n = g.attributes.position.count;
    const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { si[i * 4] = BI[bone]; sw[i * 4] = 1; col[i * 3] = color.r; col[i * 3 + 1] = color.g; col[i * 3 + 2] = color.b; }
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return g;
  });
  const merged = mergeGeometries(geos, false);
  geos.forEach((g) => g.dispose());
  const clothTex = tex('cloth', 6);
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, normalMap: clothTex.normalMap, normalScale: new THREE.Vector2(0.4, 0.4) });
  const mesh = new THREE.SkinnedMesh(merged, material);
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.add(bones.hips);
  mesh.bind(new THREE.Skeleton(boneList));
  mesh.frustumCulled = false; // skinned bounds don't follow bones; we cull by distance instead

  // face card on the head bone
  const faceSeed = seed;
  const faces = {
    neutral: faceTexture(faceSeed, { skin, expression: 'neutral', hollow: !!opts.lost }),
    fear: faceTexture(faceSeed, { skin, expression: 'fear', hollow: !!opts.lost }),
  };
  const fg = new THREE.PlaneGeometry(0.15 * H, 0.17 * H, 6, 6);
  { const p = fg.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i) / (0.075 * H); p.setZ(i, -x * x * 0.035 * H); } fg.computeVertexNormals(); }
  const faceMat = new THREE.MeshStandardMaterial({ map: faces.neutral, roughness: 0.7, transparent: true, alphaTest: 0.1 });
  const faceMesh = new THREE.Mesh(fg, faceMat);
  faceMesh.position.set(0, 0.1 * H, 0.104 * H);
  bones.head.add(faceMesh);

  const group = new THREE.Group();
  group.add(mesh);
  return {
    group, mesh, bones, faceMesh, faceMat, faces, H, female, child, material,
    setExpression(e) { if (faces[e] && faceMat.map !== faces[e]) { faceMat.map = faces[e]; faceMat.needsUpdate = true; } },
    hipY,
  };
}
