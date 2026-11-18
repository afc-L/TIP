// THE PRESENCE: a very tall, very thin figure. Near-black, with a faint rim of light
// so it reads in the dark, and a pale smooth oval where a face should be.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { limbGeo, blob, torsoGeo } from './anatomy.js';

function rimMaterial(color = 0x040405, rim = 0x7a8090, power = 2.2, strength = 1.1) {
  // Near-black body with a faint fresnel rim so it reads in the dark — fog still applies.
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0, transparent: false, opacity: 1 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRim = { value: new THREE.Color(rim) };
    sh.fragmentShader = 'uniform vec3 uRim;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      float fres = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition))), ${power.toFixed(2)});
      totalEmissiveRadiance += uRim * fres * ${strength.toFixed(2)};`);
  };
  m.customProgramCacheKey = () => 'presenceRim';
  return m;
}

export function buildPresence(pose = 'stand') {
  const parts = [];
  const P = (g, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1))); parts.push(g); };
  const hipY = 1.45;
  // legs: long, thin, slightly bent inward
  for (const s of [-1, 1]) {
    P(limbGeo(0.75, 0.07, 0.045, { seg: 8, rings: 6, bulge: 0.05 }), s * 0.09, hipY, 0, 0, 0, s * -0.03);
    P(limbGeo(0.72, 0.045, 0.03, { seg: 8, rings: 6 }), s * 0.065, hipY - 0.74, 0.0, 0.02, 0, 0);
    P(blob(0.035, 0.03, 0.09, { seg: 6 }), s * 0.06, 0.03, 0.04);
  }
  P(torsoGeo([[0, 0.12], [0.2, 0.1], [0.45, 0.13], [0.7, 0.15], [0.8, 0.07]], { sx: 1.2, sz: 0.55, seg: 12 }), 0, hipY - 0.05, 0);
  // neck + head (head tilted for 'tilt' pose)
  const tilt = pose === 'tilt' ? 0.5 : pose === 'lean' ? 0.25 : 0.05;
  const neckTop = new THREE.Vector3(Math.sin(tilt) * 0.12, hipY + 0.75 + 0.22, 0.02);
  P(limbGeo(0.24, 0.035, 0.035, { seg: 6, rings: 3, bulge: 0 }), 0, hipY + 0.98, 0.02, Math.PI, 0, -tilt * 0.4);
  const head = blob(0.085, 0.13, 0.095, { seg: 12 });
  P(head, neckTop.x, neckTop.y + 0.1, neckTop.z, 0.1, 0, -tilt);
  // arms that hang past the knees (built in an arm frame, then rotated as one piece)
  for (const s of [-1, 1]) {
    const reach = pose === 'reach' && s === 1;
    const armM = new THREE.Matrix4().compose(new THREE.Vector3(s * 0.2, hipY + 0.7, 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(reach ? -1.35 : 0.04, 0, s * 0.07)), new THREE.Vector3(1, 1, 1));
    const AP = (g, x, y, z, rx = 0, rz = 0) => { g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, rz)), new THREE.Vector3(1, 1, 1))); g.applyMatrix4(armM); parts.push(g); };
    AP(limbGeo(0.62, 0.04, 0.03, { seg: 6, rings: 5 }), 0, 0, 0);
    AP(limbGeo(0.6, 0.03, 0.022, { seg: 6, rings: 5 }), 0, -0.62, 0, -0.06);
    for (let f = 0; f < 4; f++) AP(limbGeo(0.2, 0.01, 0.006, { seg: 4, rings: 3 }), (f - 1.5) * 0.015, -1.2, 0.03, -0.1, (f - 1.5) * 0.06);
  }
  const geo = mergeGeometries(parts.map((g) => { let n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (!['position', 'normal'].includes(k)) n.deleteAttribute(k); return n; }), false);
  geo.computeVertexNormals();
  const body = new THREE.Mesh(geo, rimMaterial());
  const group = new THREE.Group(); group.add(body);
  // face: pale smooth oval, no features — just two faint dark hollows
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const gr = x.createRadialGradient(32, 30, 4, 32, 32, 30); gr.addColorStop(0, '#c8c4bc'); gr.addColorStop(0.75, '#8a8680'); gr.addColorStop(1, 'rgba(40,40,40,0)');
  x.fillStyle = gr; x.beginPath(); x.ellipse(32, 32, 24, 30, 0, 0, Math.PI * 2); x.fill();
  x.fillStyle = 'rgba(0,0,0,0.55)'; x.beginPath(); x.ellipse(24, 28, 4, 6, 0, 0, Math.PI * 2); x.fill(); x.beginPath(); x.ellipse(40, 28, 4, 6, 0, 0, Math.PI * 2); x.fill();
  const ft = new THREE.CanvasTexture(c); ft.colorSpace = THREE.SRGBColorSpace;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.2), new THREE.MeshBasicMaterial({ map: ft, transparent: true, depthWrite: false }));
  face.position.set(neckTop.x + Math.sin(tilt) * 0.02, neckTop.y + 0.1, 0.1); face.rotation.z = -tilt;
  group.add(face);
  group.userData.mats = [body.material, face.material];
  group.traverse((o) => { o.castShadow = false; });
  return group;
}

export function setPresenceAlpha(group, a) {
  const [bm, fm] = group.userData.mats;
  bm.opacity = a; fm.opacity = a;
  bm.depthWrite = a > 0.95; if (bm.transparent !== a < 0.99) { bm.transparent = a < 0.99; bm.needsUpdate = true; }
}
