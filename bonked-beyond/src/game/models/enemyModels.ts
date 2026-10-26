// Enemy models as color-grouped geometry parts, rendered with one InstancedMesh per part.
import type * as THREE from 'three';
import type { EnemyKind } from '../../data/types';
import { box, capsule, cone, cyl, merge, octa, sphere, torus } from './shapes';

export interface EnemyPart { geo: THREE.BufferGeometry; color: string; glow?: boolean; tintable?: boolean }

function slimeParts(body: string): EnemyPart[] {
  return [
    { geo: sphere(0.6, { p: [0, 0.48, 0], s: [1, 0.8, 1] }, 2), color: body, tintable: true },
    { geo: merge([sphere(0.17, { p: [-0.2, 0.62, 0.42] }), sphere(0.17, { p: [0.2, 0.62, 0.42] })]), color: '#ffffff' },
    { geo: merge([sphere(0.09, { p: [-0.2, 0.62, 0.56] }), sphere(0.09, { p: [0.2, 0.62, 0.56] }), box(0.24, 0.05, 0.05, { p: [0, 0.42, 0.55] })]), color: '#1b1b1b' },
    { geo: sphere(0.13, { p: [-0.22, 0.85, 0.2], s: [1.4, 0.6, 1] }), color: '#ffffff', glow: true },
  ];
}

const BUILD: Record<EnemyKind, () => EnemyPart[]> = {
  slime: () => slimeParts('#7bd84b'),
  bigSlime: () => [
    ...slimeParts('#2f9e44'),
    { geo: merge([cone(0.12, 0.3, { p: [-0.25, 0.95, 0] }), cone(0.14, 0.4, { p: [0, 1.0, 0] }), cone(0.12, 0.3, { p: [0.25, 0.95, 0] }), cyl(0.36, 0.36, 0.12, { p: [0, 0.82, 0] }, 10)]), color: '#ffd166' },
  ],
  goblin: () => [
    { geo: merge([capsule(0.26, 0.35, { p: [0, 0.6, 0] }), sphere(0.3, { p: [0, 1.1, 0.03] })]), color: '#a7c957', tintable: true },
    { geo: merge([cone(0.09, 0.45, { p: [-0.36, 1.18, 0], r: [0, 0, 1.25] }), cone(0.09, 0.45, { p: [0.36, 1.18, 0], r: [0, 0, -1.25] }), cone(0.07, 0.18, { p: [0, 1.06, 0.33], r: [Math.PI / 2, 0, 0] })]), color: '#8ab33f' },
    { geo: box(0.55, 0.22, 0.42, { p: [0, 0.48, 0] }), color: '#6b4226' },
    { geo: merge([sphere(0.07, { p: [-0.11, 1.15, 0.27] }), sphere(0.07, { p: [0.11, 1.15, 0.27] })]), color: '#ff2e2e', glow: true },
    { geo: merge([box(0.06, 0.06, 0.5, { p: [0.32, 0.6, 0.35] }), box(0.16, 0.05, 0.05, { p: [0.32, 0.6, 0.12] })]), color: '#ced4da' },
  ],
  brute: () => [
    { geo: merge([box(1.2, 1.1, 0.8, { p: [0, 1.15, 0] }), capsule(0.24, 0.5, { p: [-0.35, 0.4, 0] }), capsule(0.24, 0.5, { p: [0.35, 0.4, 0] })]), color: '#6d597a', tintable: true },
    { geo: merge([box(0.9, 0.7, 0.2, { p: [0, 1.2, 0.42] }), sphere(0.36, { p: [-0.72, 1.6, 0], s: [1, 0.7, 1] }), sphere(0.36, { p: [0.72, 1.6, 0], s: [1, 0.7, 1] }), box(0.45, 0.4, 0.45, { p: [0, 1.9, 0.1] })]), color: '#8d99ae' },
    { geo: merge([sphere(0.32, { p: [-0.8, 0.85, 0.25] }), sphere(0.32, { p: [0.8, 0.85, 0.25] }), capsule(0.2, 0.5, { p: [-0.78, 1.25, 0.1] }), capsule(0.2, 0.5, { p: [0.78, 1.25, 0.1] })]), color: '#b56576' },
    { geo: merge([cone(0.1, 0.4, { p: [-0.28, 2.25, 0.1], r: [0, 0, 0.5] }), cone(0.1, 0.4, { p: [0.28, 2.25, 0.1], r: [0, 0, -0.5] })]), color: '#f8f0e3' },
    { geo: box(0.32, 0.07, 0.05, { p: [0, 1.95, 0.34] }), color: '#ff9f1c', glow: true },
  ],
  shaman: () => [
    { geo: cone(0.55, 1.4, { p: [0, 0.7, 0] }, 7), color: '#7b2cbf', tintable: true },
    { geo: merge([sphere(0.3, { p: [0, 1.5, 0] }), cone(0.36, 0.4, { p: [0, 1.75, -0.05] }, 7)]), color: '#e9d8a6' },
    { geo: cyl(0.04, 0.05, 1.9, { p: [0.5, 0.95, 0.2] }, 5), color: '#6f4518' },
    { geo: merge([sphere(0.17, { p: [0.5, 1.95, 0.2] }), sphere(0.06, { p: [-0.1, 1.52, 0.27] }), sphere(0.06, { p: [0.1, 1.52, 0.27] })]), color: '#f72585', glow: true },
    { geo: torus(0.42, 0.05, { p: [0, 0.95, 0], r: [Math.PI / 2, 0, 0] }), color: '#ffd60a' },
  ],
  exploder: () => [
    { geo: sphere(0.55, { p: [0, 0.65, 0] }, 1), color: '#d62828', tintable: true },
    { geo: merge([torus(0.5, 0.06, { p: [0, 0.65, 0], r: [Math.PI / 2, 0, 0] }), cyl(0.07, 0.09, 0.3, { p: [0, 1.25, 0] }, 5), capsule(0.07, 0.15, { p: [-0.25, 0.15, 0] }), capsule(0.07, 0.15, { p: [0.25, 0.15, 0] })]), color: '#2b2d42' },
    { geo: sphere(0.12, { p: [0, 1.45, 0] }), color: '#ffd60a', glow: true },
    { geo: merge([box(0.18, 0.12, 0.05, { p: [-0.16, 0.78, 0.5], r: [0, 0, -0.3] }), box(0.18, 0.12, 0.05, { p: [0.16, 0.78, 0.5], r: [0, 0, 0.3] })]), color: '#ffffff', glow: true },
  ],
  swarmBug: () => [
    { geo: merge([sphere(0.32, { p: [0, 0.32, 0], s: [1, 0.7, 1.3] }), sphere(0.2, { p: [0, 0.35, 0.38] })]), color: '#b5179e', tintable: true },
    { geo: merge([box(0.8, 0.04, 0.05, { p: [0, 0.18, 0.1] }), box(0.8, 0.04, 0.05, { p: [0, 0.18, -0.12] }), box(0.7, 0.04, 0.05, { p: [0, 0.18, 0.3], r: [0, 0.3, 0] })]), color: '#2b2d42' },
    { geo: merge([sphere(0.07, { p: [-0.1, 0.42, 0.53] }), sphere(0.07, { p: [0.1, 0.42, 0.53] })]), color: '#ffea00', glow: true },
    { geo: merge([sphere(0.25, { p: [-0.25, 0.55, -0.05], s: [1.2, 0.2, 0.7] }), sphere(0.25, { p: [0.25, 0.55, -0.05], s: [1.2, 0.2, 0.7] })]), color: '#e0aaff', glow: true },
  ],
  bombardier: () => [
    { geo: merge([sphere(0.6, { p: [0, 0.75, 0], s: [1, 0.9, 1] }), cyl(0.25, 0.3, 0.5, { p: [-0.25, 0.25, 0] }, 6), cyl(0.25, 0.3, 0.5, { p: [0.25, 0.25, 0] }, 6)]), color: '#bc6c25', tintable: true },
    { geo: merge([cyl(0.22, 0.28, 1.0, { p: [0, 1.25, -0.1], r: [-0.6, 0, 0] }, 8), torus(0.25, 0.06, { p: [0, 1.62, 0.1], r: [-0.6 + Math.PI / 2, 0, 0] })]), color: '#495057' },
    { geo: merge([sphere(0.2, { p: [0.55, 0.9, 0.15] }), sphere(0.08, { p: [0.55, 1.13, 0.15] })]), color: '#212529' },
    { geo: merge([box(0.5, 0.12, 0.05, { p: [0, 0.95, 0.56] })]), color: '#ffd60a', glow: true },
  ],
  stalker: () => [
    { geo: merge([cone(0.45, 1.5, { p: [0, 0.75, 0] }, 6), sphere(0.3, { p: [0, 1.55, 0] })]), color: '#3c096c', tintable: true },
    { geo: merge([cone(0.08, 0.5, { p: [-0.5, 0.9, 0.2], r: [0, 0, 1.2] }), cone(0.08, 0.5, { p: [0.5, 0.9, 0.2], r: [0, 0, -1.2] }), box(0.04, 0.04, 0.6, { p: [-0.55, 0.8, 0.45] }), box(0.04, 0.04, 0.6, { p: [0.55, 0.8, 0.45] })]), color: '#10002b' },
    { geo: merge([sphere(0.06, { p: [-0.1, 1.58, 0.26], s: [1.6, 0.6, 1] }), sphere(0.06, { p: [0.1, 1.58, 0.26], s: [1.6, 0.6, 1] })]), color: '#ff006e', glow: true },
  ],
  shieldKnight: () => [
    { geo: merge([capsule(0.38, 0.6, { p: [0, 1.0, 0] }), sphere(0.3, { p: [0, 1.75, 0] }), capsule(0.15, 0.4, { p: [-0.2, 0.3, 0] }), capsule(0.15, 0.4, { p: [0.2, 0.3, 0] })]), color: '#adb5bd', tintable: true },
    { geo: merge([box(1.1, 1.3, 0.14, { p: [0, 1.0, 0.55] }), box(0.2, 0.9, 0.16, { p: [0, 1.05, 0.58] })]), color: '#457b9d' },
    { geo: merge([box(0.9, 0.12, 0.17, { p: [0, 1.15, 0.6] }), cone(0.1, 0.35, { p: [0, 2.05, 0] })]), color: '#ffd166' },
    { geo: box(0.3, 0.05, 0.05, { p: [0, 1.78, 0.29] }), color: '#ff9f1c', glow: true },
  ],
  healer: () => [
    { geo: merge([cone(0.5, 1.3, { p: [0, 0.65, 0] }, 8), sphere(0.28, { p: [0, 1.45, 0] })]), color: '#52b788', tintable: true },
    { geo: merge([sphere(0.35, { p: [0, 1.6, -0.05], s: [1, 0.6, 1] }), sphere(0.12, { p: [-0.25, 1.7, 0.1] }), sphere(0.1, { p: [0.22, 1.75, 0.05] })]), color: '#2d6a4f' },
    { geo: cyl(0.04, 0.05, 1.7, { p: [-0.45, 0.9, 0.15] }, 5), color: '#6f4518' },
    { geo: merge([octa(0.18, { p: [-0.45, 1.85, 0.15] }), sphere(0.05, { p: [-0.09, 1.48, 0.25] }), sphere(0.05, { p: [0.09, 1.48, 0.25] })]), color: '#b7ff9e', glow: true },
  ],
  phantom: () => [
    { geo: merge([sphere(0.45, { p: [0, 1.05, 0] }), cone(0.45, 0.9, { p: [0, 0.45, 0], r: [Math.PI, 0, 0] }, 7)]), color: '#caf0f8', tintable: true },
    { geo: merge([sphere(0.1, { p: [-0.15, 1.1, 0.38], s: [1, 1.5, 0.5] }), sphere(0.1, { p: [0.15, 1.1, 0.38], s: [1, 1.5, 0.5] }), sphere(0.08, { p: [0, 0.88, 0.4], s: [1.5, 1, 0.5] })]), color: '#03045e' },
    { geo: merge([cone(0.12, 0.4, { p: [-0.45, 0.85, 0], r: [0, 0, 1.6] }), cone(0.12, 0.4, { p: [0.45, 0.85, 0], r: [0, 0, -1.6] })]), color: '#90e0ef', glow: true },
  ],
  burrower: () => [
    { geo: merge([sphere(0.6, { p: [0, 0.55, 0], s: [1, 0.8, 1.3] }), cone(0.35, 0.6, { p: [0, 0.55, 0.85], r: [Math.PI / 2, 0, 0] }, 6)]), color: '#9c6644', tintable: true },
    { geo: merge([box(0.5, 0.1, 0.3, { p: [-0.55, 0.25, 0.3], r: [0, 0.4, 0.3] }), box(0.5, 0.1, 0.3, { p: [0.55, 0.25, 0.3], r: [0, -0.4, -0.3] })]), color: '#e9edc9' },
    { geo: merge([sphere(0.06, { p: [-0.18, 0.75, 0.6] }), sphere(0.06, { p: [0.18, 0.75, 0.6] })]), color: '#ff4d6d', glow: true },
  ],
  beetle: () => [
    { geo: merge([sphere(1.1, { p: [0, 0.85, -0.1], s: [1, 0.65, 1.25] }), sphere(0.5, { p: [0, 0.75, 1.15] })]), color: '#264653', tintable: true },
    { geo: merge([box(0.06, 0.06, 2.4, { p: [0, 1.5, -0.1] }), cone(0.18, 1.0, { p: [0, 1.2, 1.7], r: [1.1, 0, 0] }, 6)]), color: '#e9c46a' },
    { geo: merge([...[-1, 1].flatMap((sd) => [0.4, 0, -0.5].map((z) => box(0.9, 0.1, 0.12, { p: [0.95 * sd, 0.35, z], r: [0, 0, sd * 0.5] })))]), color: '#1d3557' },
    { geo: merge([sphere(0.09, { p: [-0.25, 0.9, 1.55] }), sphere(0.09, { p: [0.25, 0.9, 1.55] })]), color: '#ff9f1c', glow: true },
  ],
  archer: () => [
    { geo: merge([capsule(0.3, 0.6, { p: [0, 0.95, 0] }), sphere(0.28, { p: [0, 1.6, 0] })]), color: '#6a994e', tintable: true },
    { geo: merge([cone(0.38, 0.6, { p: [0, 1.85, -0.05] }, 6), box(0.6, 0.7, 0.1, { p: [0, 1.0, -0.3] })]), color: '#386641' },
    { geo: merge([torus(0.55, 0.04, { p: [0.45, 1.1, 0.3], r: [0, Math.PI / 2, 0] })]), color: '#7f5539' },
    { geo: merge([sphere(0.05, { p: [-0.1, 1.62, 0.25] }), sphere(0.05, { p: [0.1, 1.62, 0.25] })]), color: '#c77dff', glow: true },
  ],
  ogre: () => [
    { geo: merge([sphere(1.1, { p: [0, 1.6, 0], s: [1, 1.1, 0.85] }), sphere(0.55, { p: [0, 2.75, 0.2] }), capsule(0.32, 0.6, { p: [-0.5, 0.45, 0] }), capsule(0.32, 0.6, { p: [0.5, 0.45, 0] })]), color: '#7f4f24', tintable: true },
    { geo: merge([capsule(0.3, 1.1, { p: [-1.2, 1.5, 0.3], r: [0.3, 0, 0.3] }), capsule(0.3, 1.1, { p: [1.2, 1.5, 0.3], r: [0.3, 0, -0.3] }), cyl(0.25, 0.55, 1.6, { p: [1.35, 0.8, 0.9], r: [0.6, 0, 0] }, 7)]), color: '#582f0e' },
    { geo: merge([box(1.6, 0.4, 0.95, { p: [0, 1.05, 0] }), cone(0.12, 0.35, { p: [-0.25, 3.2, 0.2] }), cone(0.12, 0.35, { p: [0.25, 3.2, 0.2] })]), color: '#e9d8a6' },
    { geo: merge([sphere(0.09, { p: [-0.2, 2.85, 0.68] }), sphere(0.09, { p: [0.2, 2.85, 0.68] })]), color: '#ffea00', glow: true },
  ],
};

export function buildEnemyParts(kind: EnemyKind): EnemyPart[] {
  return BUILD[kind]();
}

/** Visual scale per kind relative to the model above. */
export const ENEMY_MODEL_SCALE: Record<EnemyKind, number> = {
  slime: 0.95, bigSlime: 1.7, goblin: 1, brute: 1, shaman: 1, exploder: 1,
  swarmBug: 1, bombardier: 1, stalker: 1, shieldKnight: 1, healer: 1, phantom: 1,
  burrower: 1, beetle: 1, archer: 1, ogre: 1.15,
};
