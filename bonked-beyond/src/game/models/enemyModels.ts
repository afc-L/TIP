// Enemy models as color-grouped geometry parts, rendered with one InstancedMesh per part.
import type * as THREE from 'three';
import type { EnemyKind } from '../../data/types';
import { box, capsule, cone, cyl, merge, sphere, torus } from './shapes';

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
};

export function buildEnemyParts(kind: EnemyKind): EnemyPart[] {
  return BUILD[kind]();
}

/** Visual scale per kind relative to the model above. */
export const ENEMY_MODEL_SCALE: Record<EnemyKind, number> = {
  slime: 0.95, bigSlime: 1.7, goblin: 1, brute: 1, shaman: 1, exploder: 1,
};
