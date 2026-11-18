// THE HOLLOW's body: a tall, emaciated, digitigrade creature with arms that hang past
// its knees, a ridge of bone along its spine, two backswept horns and a pale, almost
// human face set into an elongated skull. Built procedurally as a bone hierarchy.
import * as THREE from 'three';
import { limbGeo, blob, hornGeo, torsoGeo } from './anatomy.js';
import { tex } from '../core/textures.js';

export const SKINS = {
  pale: { name: 'Pallid', skin: 0xf0e8e0, bone: 0xe8dcc0, eye: 0xffe8c0, emissive: 0x0c0a09, rough: 0.55, desc: 'The shape it woke up in.' },
  charred: { name: 'Charred', skin: 0x5a4a44, bone: 0x2a2420, eye: 0xff6020, emissive: 0x401000, rough: 0.8, desc: 'Burned, but it did not stop.' },
  abyssal: { name: 'Abyssal', skin: 0x6a7a90, bone: 0x9aa8b8, eye: 0x60c0ff, emissive: 0x000810, rough: 0.3, desc: 'Something from deep water.' },
  ossuary: { name: 'Ossuary', skin: 0xc0ae98, bone: 0xf0e6d0, eye: 0xff2020, emissive: 0x000000, rough: 0.6, desc: 'More bone than skin.' },
  hollow: { name: 'The Hollow', skin: 0x101014, bone: 0x202024, eye: 0xffffff, emissive: 0x050510, rough: 0.2, desc: 'What it really looks like.' },
};

function faceTex() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  const g = x.createRadialGradient(128, 110, 10, 128, 128, 140);
  g.addColorStop(0, '#d8d0c4'); g.addColorStop(0.6, '#a89e92'); g.addColorStop(1, '#4a4038');
  x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  // stretched, too-smooth human features
  x.fillStyle = 'rgba(60,40,35,0.35)';
  for (const s of [-1, 1]) {
    // deep sockets
    const eg = x.createRadialGradient(128 + s * 42, 100, 2, 128 + s * 42, 100, 30);
    eg.addColorStop(0, 'rgba(0,0,0,1)'); eg.addColorStop(0.55, 'rgba(10,5,5,0.95)'); eg.addColorStop(1, 'rgba(40,30,25,0)');
    x.fillStyle = eg; x.beginPath(); x.ellipse(128 + s * 42, 102, 30, 22, s * 0.25, 0, Math.PI * 2); x.fill();
    // tear streaks
    x.strokeStyle = 'rgba(20,10,10,0.5)'; x.lineWidth = 3;
    x.beginPath(); x.moveTo(128 + s * 40, 120); x.bezierCurveTo(128 + s * 44, 150, 128 + s * 38, 175, 128 + s * 42, 205); x.stroke();
  }
  // nose slits
  x.fillStyle = 'rgba(0,0,0,0.85)';
  for (const s of [-1, 1]) { x.beginPath(); x.ellipse(128 + s * 7, 150, 3, 9, s * 0.3, 0, Math.PI * 2); x.fill(); }
  // stitched seam that becomes the mouth split
  x.strokeStyle = 'rgba(30,10,10,0.9)'; x.lineWidth = 4; x.beginPath(); x.moveTo(70, 196); x.quadraticCurveTo(128, 210, 186, 196); x.stroke();
  x.lineWidth = 2;
  for (let i = 0; i < 12; i++) { const px = 76 + i * 9.5; const py = 197 + Math.sin((i / 11) * Math.PI) * 9; x.beginPath(); x.moveTo(px, py - 7); x.lineTo(px + 2, py + 7); x.stroke(); }
  // veins
  x.strokeStyle = 'rgba(70,40,60,0.35)'; x.lineWidth = 1.5;
  for (let i = 0; i < 14; i++) { x.beginPath(); let px = Math.random() * 256, py = Math.random() * 60; x.moveTo(px, py); for (let k = 0; k < 5; k++) { px += (Math.random() - 0.5) * 30; py += 15; x.lineTo(px, py); } x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function curvedPlane(w, h, curve = 0.5) {
  const g = new THREE.PlaneGeometry(w, h, 12, 12);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i) / (w / 2), y = p.getY(i) / (h / 2); p.setZ(i, -(x * x) * curve * w * 0.5 - (y * y) * curve * h * 0.2); }
  g.computeVertexNormals(); return g;
}

export function buildMonster(skinKey = 'pale') {
  const S = SKINS[skinKey] || SKINS.pale;
  const st = tex('skin', 3);
  const skin = new THREE.MeshStandardMaterial({ map: st.map, normalMap: st.normalMap, normalScale: new THREE.Vector2(1.4, 1.4), color: S.skin, roughness: S.rough, metalness: 0.05, emissive: S.emissive, emissiveIntensity: 1 });
  const bt = tex('bone', 2);
  const bone = new THREE.MeshStandardMaterial({ map: bt.map, normalMap: bt.normalMap, color: S.bone, roughness: 0.45 });
  const face = new THREE.MeshStandardMaterial({ map: faceTex(), roughness: 0.4, color: skinKey === 'hollow' ? 0x202020 : skinKey === 'charred' ? 0x605048 : 0xffffff, side: THREE.DoubleSide });
  const mouth = new THREE.MeshStandardMaterial({ color: 0x120404, roughness: 0.3 });
  const eye = new THREE.MeshBasicMaterial({ color: S.eye, toneMapped: false });
  const mats = { skin, bone, face, mouth, eye };

  const root = new THREE.Group(); root.name = 'monster';
  const B = {};
  const mk = (name, parent, x, y, z) => { const o = new THREE.Group(); o.name = name; o.position.set(x, y, z); parent.add(o); B[name] = o; return o; };
  const add = (parent, geo, material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  };

  const hips = mk('hips', root, 0, 1.62, 0);
  add(hips, blob(0.27, 0.18, 0.2, { noise: 0.15, seed: 1 }), skin, 0, 0, -0.02);
  // pelvis bone protrusions
  for (const s of [-1, 1]) add(hips, hornGeo(0.16, 0.035, 0.6), bone, s * 0.17, 0.05, -0.08, -2.2, 0, s * 0.4);

  const spine1 = mk('spine1', hips, 0, 0.08, 0);
  add(spine1, torsoGeo([[0, 0.23], [0.12, 0.18], [0.25, 0.17], [0.34, 0.19]], { sx: 1.1, sz: 0.78, noise: 0.08, seed: 2 }), skin);
  const spine2 = mk('spine2', spine1, 0, 0.3, 0);
  add(spine2, torsoGeo([[0, 0.19], [0.12, 0.23], [0.3, 0.28]], { sx: 1.12, sz: 0.74, ribs: 4, ribRange: [0.2, 1], noise: 0.05, seed: 3 }), skin);
  const chest = mk('chest', spine2, 0, 0.27, 0);
  add(chest, torsoGeo([[0, 0.28], [0.15, 0.34], [0.32, 0.36], [0.46, 0.3], [0.56, 0.14]], { sx: 1.3, sz: 0.66, ribs: 7, ribRange: [0, 0.8], noise: 0.05, seed: 4 }), skin);
  // collarbones
  for (const s of [-1, 1]) add(chest, limbGeo(0.3, 0.03, 0.025, { seg: 6, rings: 4 }), bone, s * 0.04, 0.47, 0.1, 0, 0, s * 1.35);

  // spinal ridge: a line of curved bone spines from pelvis to neck — key silhouette element
  const ridge = (parent, n, y0, y1, z, size) => {
    for (let i = 0; i < n; i++) {
      const t = i / Math.max(1, n - 1);
      add(parent, hornGeo(size * (0.7 + Math.sin(t * Math.PI) * 0.6), 0.025 + size * 0.06, -0.9), bone, 0, y0 + (y1 - y0) * t, z, -1.1, 0, 0);
    }
  };
  ridge(spine1, 3, 0.05, 0.3, -0.13, 0.12);
  ridge(spine2, 3, 0.02, 0.28, -0.17, 0.16);
  ridge(chest, 4, 0.05, 0.5, -0.19, 0.24);
  // shoulder blade spikes (the tall shape seen from far away)
  for (const s of [-1, 1]) {
    add(chest, hornGeo(0.55, 0.05, -0.7), bone, s * 0.2, 0.42, -0.14, -0.5, 0, s * -0.35);
    add(chest, hornGeo(0.32, 0.035, -0.6), bone, s * 0.27, 0.32, -0.12, -0.7, 0, s * -0.6);
  }

  // neck: long and forward-thrust
  const neck1 = mk('neck1', chest, 0, 0.52, 0.04);
  add(neck1, limbGeo(0.22, 0.1, 0.085, { bulge: 0.05, noise: 0.01, seed: 5 }), skin, 0, 0.22, 0, Math.PI, 0, 0);
  const neck2 = mk('neck2', neck1, 0, 0.2, 0);
  add(neck2, limbGeo(0.2, 0.085, 0.08, { bulge: 0.05, seed: 6 }), skin, 0, 0.2, 0, Math.PI, 0, 0);
  ridge(neck1, 2, 0.02, 0.18, -0.07, 0.08);

  // head
  const head = mk('head', neck2, 0, 0.2, 0.02);
  add(head, blob(0.15, 0.16, 0.27, { noise: 0.12, seed: 7 }), skin, 0, 0.1, -0.06, 0.2, 0, 0); // elongated cranium
  add(head, blob(0.12, 0.08, 0.2, { noise: 0.1, seed: 8 }), skin, 0, 0.21, -0.18, 0.5, 0, 0);
  // horns sweeping back
  for (const s of [-1, 1]) {
    add(head, hornGeo(0.62, 0.05, 0.7, 8, 10), bone, s * 0.1, 0.2, -0.05, -1.35, 0, s * -0.3);
    add(head, hornGeo(0.22, 0.03, -0.5), bone, s * 0.13, 0.12, 0.02, -1.6, 0, s * -0.7);
  }
  // pale face mask
  const faceMesh = add(head, curvedPlane(0.24, 0.28, 0.6), face, 0, 0.05, 0.17, -0.08, 0, 0);
  // eye pinpoints in the sockets
  const eyes = [];
  for (const s of [-1, 1]) { const e = add(head, new THREE.SphereGeometry(0.009, 6, 4), eye, s * 0.04, 0.095, 0.14); e.castShadow = false; eyes.push(e); }
  // mouth cavity + upper teeth
  add(head, blob(0.09, 0.03, 0.09), mouth, 0, -0.05, 0.08);
  const teethU = new THREE.Group(); head.add(teethU); teethU.position.set(0, -0.05, 0.08);
  for (let i = 0; i < 16; i++) {
    const a = (i / 15 - 0.5) * 2.4; const r = 0.085;
    const t = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.05 + Math.random() * 0.03, 4), bone);
    t.position.set(Math.sin(a) * r, -0.02, Math.cos(a) * r * 0.9); t.rotation.x = Math.PI; teethU.add(t);
  }
  // jaw (opens when feeding/roaring/attacking)
  const jaw = mk('jaw', head, 0, -0.04, -0.04);
  add(jaw, blob(0.1, 0.045, 0.16, { noise: 0.15, seed: 9 }), skin, 0, -0.035, 0.11);
  add(jaw, blob(0.08, 0.02, 0.1), mouth, 0, -0.01, 0.12);
  for (let i = 0; i < 14; i++) {
    const a = (i / 13 - 0.5) * 2.2; const r = 0.08;
    const t = new THREE.Mesh(new THREE.ConeGeometry(0.007, 0.045 + Math.random() * 0.025, 4), bone);
    t.position.set(Math.sin(a) * r, 0.01, 0.12 + Math.cos(a) * r * 0.6 - 0.05); jaw.add(t);
  }
  for (const s of [-1, 1]) add(jaw, hornGeo(0.1, 0.02, 0.4), bone, s * 0.08, -0.03, 0.12, 2.6, 0, s * 0.3); // mandible spurs

  // arms
  for (const [side, s] of [['L', 1], ['R', -1]]) {
    const sh = mk('shoulder' + side, chest, s * 0.33, 0.44, 0.02);
    add(sh, blob(0.14, 0.13, 0.14, { noise: 0.2, seed: 10 + s }), skin);
    const ua = mk('upperArm' + side, sh, s * 0.04, -0.02, 0);
    add(ua, limbGeo(0.86, 0.11, 0.07, { bulge: 0.3, bulgeAt: 0.3, noise: 0.025, seed: 11 + s, seg: 12 }), skin);
    add(ua, hornGeo(0.12, 0.025, -0.4), bone, 0, -0.84, -0.04, Math.PI * 0.9, 0, 0); // elbow spur
    const fa = mk('foreArm' + side, ua, 0, -0.86, 0);
    add(fa, limbGeo(0.84, 0.078, 0.05, { bulge: 0.35, bulgeAt: 0.25, noise: 0.02, seed: 13 + s, seg: 10 }), skin);
    const hd = mk('hand' + side, fa, 0, -0.84, 0);
    add(hd, blob(0.08, 0.12, 0.04, { noise: 0.2, seed: 15 }), skin, 0, -0.08, 0);
    // four long fingers + thumb, three segments each, claw tips
    const fingers = [];
    for (let f = 0; f < 5; f++) {
      const thumb = f === 4;
      const base = new THREE.Group();
      base.position.set(thumb ? s * 0.055 : (f - 1.5) * 0.032 * s, thumb ? -0.08 : -0.17, thumb ? 0.03 : 0);
      if (thumb) base.rotation.set(0.4, 0, s * 0.6);
      else base.rotation.z = (f - 1.5) * 0.08 * s;
      hd.add(base);
      let parent = base; const segs = [];
      const lens = thumb ? [0.1, 0.08, 0.07] : [0.17 + (f === 1 || f === 2 ? 0.04 : 0), 0.14, 0.11];
      for (let k = 0; k < 3; k++) {
        const seg = new THREE.Group(); parent.add(seg);
        if (k > 0) seg.position.y = -lens[k - 1];
        const r0 = 0.02 - k * 0.0035;
        add(seg, limbGeo(lens[k], r0, r0 * 0.8, { seg: 6, rings: 4, bulge: 0.1 }), skin);
        segs.push(seg); parent = seg;
      }
      add(parent, hornGeo(0.09, 0.012, 0.6, 5, 4), bone, 0, -lens[2], 0, Math.PI, 0, 0);
      fingers.push(segs);
    }
    B['fingers' + side] = fingers;
  }

  // legs (digitigrade)
  for (const [side, s] of [['L', 1], ['R', -1]]) {
    const th = mk('thigh' + side, hips, s * 0.17, -0.04, 0);
    add(th, limbGeo(0.75, 0.155, 0.095, { bulge: 0.3, bulgeAt: 0.25, noise: 0.03, seed: 20 + s, seg: 12 }), skin);
    const sn = mk('shin' + side, th, 0, -0.75, 0);
    add(sn, limbGeo(0.7, 0.095, 0.055, { bulge: 0.4, bulgeAt: 0.2, noise: 0.02, seed: 22 + s }), skin);
    add(sn, hornGeo(0.14, 0.03, 0.5), bone, 0, -0.02, 0.05, -0.3, 0, 0); // knee spike
    const mt = mk('meta' + side, sn, 0, -0.7, 0);
    add(mt, limbGeo(0.42, 0.058, 0.042, { bulge: 0.1, seed: 24 + s, seg: 8 }), skin);
    add(mt, hornGeo(0.12, 0.025, -0.5), bone, 0, 0, -0.03, Math.PI * 0.75, 0, 0); // heel spur
    const ft = mk('foot' + side, mt, 0, -0.42, 0);
    for (let k = 0; k < 3; k++) {
      const toe = new THREE.Group(); toe.position.set((k - 1) * 0.04, 0, 0); toe.rotation.set(0, (k - 1) * 0.25, 0); ft.add(toe);
      add(toe, limbGeo(0.16, 0.025, 0.018, { seg: 6, rings: 4 }), skin, 0, 0, 0, -Math.PI / 2 + 0.15, 0, 0);
      add(toe, hornGeo(0.07, 0.014, 0.5, 5, 4), bone, 0, -0.03, 0.17, Math.PI / 2 + 0.3, 0, 0);
    }
  }

  return { root, B, mats, faceMesh, eyes, skinKey };
}
