import * as THREE from 'three';
import { box, cone, cyl, dodeca, merge, octa, sphere, torus } from './shapes';
import { glow, mat } from './materials';

export function buildChest(golden: boolean): { group: THREE.Group; lid: THREE.Group } {
  const group = new THREE.Group();
  const wood = mat(golden ? '#9c27b0' : '#8a5a2b');
  const trim = mat(golden ? '#ffd60a' : '#adb5bd');
  group.add(new THREE.Mesh(box(1.3, 0.75, 0.9, { p: [0, 0.38, 0] }), wood));
  group.add(new THREE.Mesh(merge([box(1.36, 0.12, 0.96, { p: [0, 0.1, 0] }), box(0.14, 0.8, 0.96, { p: [-0.5, 0.4, 0] }), box(0.14, 0.8, 0.96, { p: [0.5, 0.4, 0] })]), trim));
  const lid = new THREE.Group();
  lid.position.set(0, 0.75, -0.45);
  lid.add(new THREE.Mesh(merge([cyl(0.45, 0.45, 1.3, { p: [0, 0, 0.45], r: [0, 0, Math.PI / 2] }, 8)]), wood));
  lid.add(new THREE.Mesh(box(0.25, 0.3, 0.12, { p: [0, 0, 0.92] }), trim));
  group.add(lid);
  for (const m of group.children) m.castShadow = true;
  return { group, lid };
}

export function buildShrine(): { group: THREE.Group; orb: THREE.Mesh } {
  const group = new THREE.Group();
  group.add(new THREE.Mesh(merge([cyl(1.2, 1.4, 0.4, { p: [0, 0.2, 0] }, 8), cyl(0.5, 0.6, 2, { p: [0, 1.4, 0] }, 6), cyl(0.8, 0.6, 0.3, { p: [0, 2.5, 0] }, 6)]), mat('#6c757d')));
  group.add(new THREE.Mesh(merge([box(0.15, 1.6, 0.1, { p: [0, 1.4, 0.55] })]), glow('#ff006e')));
  const orb = new THREE.Mesh(octa(0.45, { p: [0, 0, 0] }), glow('#ff4d6d'));
  orb.position.y = 3.3;
  group.add(orb);
  return { group, orb };
}

export function buildBarrel(): THREE.Group {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(cyl(0.45, 0.4, 1.0, { p: [0, 0.5, 0] }, 9), mat('#a0522d')));
  g.add(new THREE.Mesh(merge([torus(0.46, 0.04, { p: [0, 0.25, 0], r: [Math.PI / 2, 0, 0] }), torus(0.46, 0.04, { p: [0, 0.75, 0], r: [Math.PI / 2, 0, 0] })]), mat('#495057')));
  for (const m of g.children) m.castShadow = true;
  return g;
}

export type PowerupKind = 'health' | 'damage' | 'magnet' | 'bomb' | 'frenzy' | 'shield' | 'bigGold';

export const POWERUP_INFO: Record<PowerupKind, { name: string; color: string; icon: string }> = {
  health: { name: 'Health Fruit', color: '#ff4d6d', icon: '🍎' },
  damage: { name: 'Rage Pepper', color: '#ff6b35', icon: '🌶️' },
  magnet: { name: 'Magnet Burst', color: '#4cc9f0', icon: '🧲' },
  bomb: { name: 'Bomb', color: '#343a40', icon: '💣' },
  frenzy: { name: 'Frenzy Token', color: '#ffd60a', icon: '⚡' },
  shield: { name: 'Shield Orb', color: '#90e0ef', icon: '🛡️' },
  bigGold: { name: 'Gold Pile', color: '#ffd60a', icon: '💰' },
};

export function buildPowerup(kind: PowerupKind): THREE.Group {
  const g = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, m: THREE.Material) => { const mesh = new THREE.Mesh(geo, m); g.add(mesh); return mesh; };
  switch (kind) {
    case 'health':
      add(sphere(0.38, {}, 1), mat('#e63946'));
      add(cyl(0.04, 0.04, 0.25, { p: [0, 0.4, 0] }, 4), mat('#6f4518'));
      add(sphere(0.14, { p: [0.14, 0.45, 0], s: [1.5, 0.4, 0.8] }), mat('#70e000'));
      break;
    case 'damage':
      add(cone(0.22, 0.8, { r: [0, 0, Math.PI * 0.9] }, 6), mat('#ff3d00', '#ff3d00', 0.4));
      add(cyl(0.05, 0.05, 0.2, { p: [0.08, 0.42, 0] }, 4), mat('#2d6a4f'));
      break;
    case 'magnet':
      add(merge([box(0.18, 0.55, 0.18, { p: [-0.22, 0, 0] }), box(0.18, 0.55, 0.18, { p: [0.22, 0, 0] }), box(0.62, 0.18, 0.18, { p: [0, -0.25, 0] })]), mat('#e63946'));
      add(merge([box(0.19, 0.14, 0.19, { p: [-0.22, 0.28, 0] }), box(0.19, 0.14, 0.19, { p: [0.22, 0.28, 0] })]), mat('#e9ecef'));
      break;
    case 'bomb':
      add(sphere(0.38, {}, 1), mat('#212529'));
      add(cyl(0.06, 0.06, 0.2, { p: [0, 0.42, 0] }, 5), mat('#6c757d'));
      add(sphere(0.09, { p: [0, 0.56, 0] }), glow('#ffd60a'));
      break;
    case 'frenzy':
      add(octa(0.42, { s: [0.7, 1.2, 0.7] }), glow('#ffd60a'));
      break;
    case 'shield':
      add(sphere(0.4, {}, 1), new THREE.MeshLambertMaterial({ color: '#90e0ef', transparent: true, opacity: 0.6 }));
      add(sphere(0.18, {}, 0), glow('#ffffff'));
      break;
    case 'bigGold':
      add(merge([cyl(0.3, 0.3, 0.1, { p: [0, -0.1, 0] }, 10), cyl(0.3, 0.3, 0.1, { p: [0.1, 0.02, 0.05] }, 10), cyl(0.3, 0.3, 0.1, { p: [-0.05, 0.14, -0.05] }, 10), dodeca(0.2, { p: [0, 0.3, 0] })]), mat('#ffd60a', '#ffb703', 0.3));
      break;
  }
  return g;
}
