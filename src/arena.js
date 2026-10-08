import * as THREE from 'three';
import { RAPIER, GROUP_WORLD } from './physics.js';
import { rand } from './util.js';

export const ARENA_HALF = 9;

function noiseTexture(base, vary, size = 256, speckle = 0) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const n = (Math.random() - 0.5) * vary;
    img.data[i * 4] = base[0] + n;
    img.data[i * 4 + 1] = base[1] + n * 0.9;
    img.data[i * 4 + 2] = base[2] + n * 0.8;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  for (let i = 0; i < speckle; i++) {
    g.fillStyle = `rgba(${base[0] - 40},${base[1] - 40},${base[2] - 40},${rand(0.1, 0.35)})`;
    g.beginPath();
    g.arc(rand(0, size), rand(0, size), rand(2, 14), 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function stoneTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#4d4842';
  g.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 8; row++) {
    const off = row % 2 ? 32 : 0;
    for (let col = -1; col < 5; col++) {
      const v = 80 + Math.floor(rand(-14, 14));
      g.fillStyle = `rgb(${v + 10},${v + 4},${v - 4})`;
      g.fillRect(col * 64 + off + 2, row * 32 + 2, 60, 28);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildArena(game) {
  const { scene, physics } = game;
  const world = physics.world;

  // Lighting
  scene.background = new THREE.Color(0x8c9aa8);
  scene.fog = new THREE.Fog(0x8c9aa8, 18, 45);
  scene.add(new THREE.HemisphereLight(0xcfd8e6, 0x4a3b2a, 1.1));
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.2);
  sun.position.set(6, 12, 4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -11; sc.right = 11; sc.top = 11; sc.bottom = -11; sc.near = 1; sc.far = 40;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);

  // Floor: packed dirt
  const dirt = noiseTexture([118, 96, 70], 38, 256, 120);
  dirt.repeat.set(8, 8);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ARENA_HALF * 2 + 6, ARENA_HALF * 2 + 6).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ map: dirt, roughness: 0.95 }),
  );
  floor.receiveShadow = true;
  scene.add(floor);
  const ground = world.createCollider(
    RAPIER.ColliderDesc.cuboid(40, 0.5, 40).setTranslation(0, -0.5, 0).setFriction(0.9).setCollisionGroups(GROUP_WORLD),
  );
  physics.register(ground, { type: 'world', kind: 'ground' });

  // Stone walls
  const stone = stoneTexture();
  const wallMat = new THREE.MeshStandardMaterial({ map: stone, roughness: 0.9 });
  const H = 2.2, T = 0.5, L = ARENA_HALF * 2 + T * 2;
  for (const [x, z, sx, sz] of [
    [0, ARENA_HALF + T / 2, L, T], [0, -ARENA_HALF - T / 2, L, T],
    [ARENA_HALF + T / 2, 0, T, L], [-ARENA_HALF - T / 2, 0, T, L],
  ]) {
    const tex = stone.clone();
    tex.repeat.set(Math.max(sx, sz) / 2, H / 1);
    tex.needsUpdate = true;
    const m = new THREE.Mesh(new THREE.BoxGeometry(sx, H, sz), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
    m.position.set(x, H / 2, z);
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
    const c = world.createCollider(
      RAPIER.ColliderDesc.cuboid(sx / 2, H / 2, sz / 2).setTranslation(x, H / 2, z).setFriction(0.6).setCollisionGroups(GROUP_WORLD),
    );
    physics.register(c, { type: 'world', kind: 'wall' });
  }

  // Wooden posts & a weapon rack along the walls (decor)
  const wood = new THREE.MeshStandardMaterial({ color: 0x5b3b22, roughness: 0.85 });
  for (let i = -2; i <= 2; i++) {
    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 3.2, 8), wood);
      post.position.set(i * 4, 1.6, s * (ARENA_HALF + 0.05));
      post.castShadow = true;
      scene.add(post);
    }
  }
  const banner = (x, z, rotY, color) => {
    const b = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.6), new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 1 }));
    b.position.set(x, 2.0, z);
    b.rotation.y = rotY;
    scene.add(b);
  };
  banner(-2, ARENA_HALF - 0.01, Math.PI, 0x7a1c1c);
  banner(2, ARENA_HALF - 0.01, Math.PI, 0x1c3a7a);
  banner(-2, -ARENA_HALF + 0.01, 0, 0x7a1c1c);
  banner(2, -ARENA_HALF + 0.01, 0, 0x1c3a7a);

  // Distant ground outside the walls
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(200, 200).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x55603f, roughness: 1 }));
  outer.position.y = -0.02;
  scene.add(outer);
}
