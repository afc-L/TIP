// Animated 3D background for menus: floating island, rotating character preview, bouncing slimes.
import * as THREE from 'three';
import { MAP_MAP } from '../data/maps';
import type { CharacterId, MapId } from '../data/types';
import { animateRig, buildCharacter, type CharacterRig } from './models/characterModels';
import { buildEnemyParts } from './models/enemyModels';
import { cone, cyl, dodeca, merge, octa, sphere } from './models/shapes';

export class Showcase {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(40, 1, 0.1, 300);
  private rig: CharacterRig | null = null;
  private charId: CharacterId | null = null;
  private island: THREE.Group;
  private top: THREE.Mesh;
  private floaters: { obj: THREE.Object3D; base: THREE.Vector3; speed: number; phase: number }[] = [];
  private slimes: { obj: THREE.Group; angle: number; r: number; phase: number }[] = [];
  private hemi: THREE.HemisphereLight;
  private sun: THREE.DirectionalLight;
  private t = 0;
  focusRight = true;

  constructor() {
    this.scene.background = new THREE.Color('#1a1033');
    this.scene.fog = new THREE.Fog('#1a1033', 30, 90);
    this.hemi = new THREE.HemisphereLight('#b8c0ff', '#3d2b56', 1.4);
    this.sun = new THREE.DirectionalLight('#fff1d0', 2.2);
    this.sun.position.set(6, 12, 8);
    this.scene.add(this.hemi, this.sun);
    this.island = new THREE.Group();
    this.top = new THREE.Mesh(cyl(7, 6.4, 1, { p: [0, -0.5, 0] }, 12), new THREE.MeshLambertMaterial({ color: '#5a9e4b', flatShading: true }));
    this.island.add(this.top);
    this.island.add(new THREE.Mesh(cone(6.4, 7, { p: [0, -4.5, 0], r: [Math.PI, 0, 0] }, 10), new THREE.MeshLambertMaterial({ color: '#7f5539', flatShading: true })));
    const treeLeaf = new THREE.MeshLambertMaterial({ color: '#40916c', flatShading: true });
    const trunk = new THREE.MeshLambertMaterial({ color: '#7f5539', flatShading: true });
    for (const [x, z, s] of [[-4.5, -2.5, 1.1], [4.8, -3, 0.9], [-5, 2.5, 0.8], [3.5, -4.6, 0.7]]) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(cyl(0.2, 0.3, 1.5, { p: [0, 0.75, 0] }, 6), trunk));
      g.add(new THREE.Mesh(merge([cone(1.2, 1.8, { p: [0, 2, 0] }, 7), cone(0.9, 1.5, { p: [0, 2.8, 0] }, 7)]), treeLeaf));
      g.position.set(x, 0, z);
      g.scale.setScalar(s);
      this.island.add(g);
    }
    const rock = new THREE.MeshLambertMaterial({ color: '#8d99ae', flatShading: true });
    for (const [x, z, s] of [[2.8, 3, 0.6], [-2.4, -4.4, 0.8], [5.5, 1, 0.5]]) {
      const m = new THREE.Mesh(dodeca(s), rock);
      m.position.set(x, s * 0.3, z);
      this.island.add(m);
    }
    this.scene.add(this.island);
    // floating crystals and rocks
    const cols = ['#ff4ecd', '#4cc9f0', '#ffd60a', '#80ff72', '#b388ff'];
    for (let i = 0; i < 26; i++) {
      const crystal = i % 2 === 0;
      const m = new THREE.Mesh(crystal ? octa(0.5, { s: [0.6, 1.3, 0.6] }) : dodeca(0.6 + Math.random() * 0.8), crystal ? new THREE.MeshBasicMaterial({ color: cols[i % cols.length] }) : rock);
      const a = Math.random() * Math.PI * 2;
      const r = 10 + Math.random() * 18;
      const base = new THREE.Vector3(Math.cos(a) * r, -4 + Math.random() * 14, Math.sin(a) * r - 6);
      m.position.copy(base);
      this.scene.add(m);
      this.floaters.push({ obj: m, base, speed: 0.4 + Math.random() * 0.6, phase: Math.random() * 6 });
    }
    // slimes hopping around the island
    for (let i = 0; i < 4; i++) {
      const g = new THREE.Group();
      const kind = i === 3 ? 'exploder' : i === 2 ? 'goblin' : 'slime';
      for (const part of buildEnemyParts(kind)) {
        g.add(new THREE.Mesh(part.geo, part.glow ? new THREE.MeshBasicMaterial({ color: part.color }) : new THREE.MeshLambertMaterial({ color: part.color, flatShading: true })));
      }
      g.scale.setScalar(0.8);
      this.scene.add(g);
      this.slimes.push({ obj: g, angle: (i / 4) * Math.PI * 2, r: 4.6, phase: i });
    }
    // stars
    const sg = new THREE.BufferGeometry();
    const sp = new Float32Array(600 * 3);
    for (let i = 0; i < 600; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(80 + Math.random() * 40);
      v.y = Math.abs(v.y) * 0.8 - 10;
      sp.set([v.x, v.y, v.z], i * 3);
    }
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffffff', size: 0.5, sizeAttenuation: true })));
    this.scene.add(new THREE.Mesh(sphere(0.01), new THREE.MeshBasicMaterial()));
    this.setCharacter('bonker');
  }

  setCharacter(id: CharacterId) {
    if (this.charId === id) return;
    this.charId = id;
    if (this.rig) {
      this.rig.root.removeFromParent();
      this.rig.root.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose(); });
    }
    this.rig = buildCharacter(id);
    this.rig.root.scale.setScalar(1.5);
    this.scene.add(this.rig.root);
  }

  setMap(id: MapId) {
    const m = MAP_MAP[id];
    (this.top.material as THREE.MeshLambertMaterial).color.set(m.palette.ground);
    const bg = new THREE.Color(m.palette.sky).lerp(new THREE.Color('#120d1f'), 0.65);
    this.scene.background = bg;
    (this.scene.fog as THREE.Fog).color.copy(bg);
    this.hemi.color.set(m.palette.ambient);
  }

  resetTheme() {
    (this.top.material as THREE.MeshLambertMaterial).color.set('#5a9e4b');
    this.scene.background = new THREE.Color('#1a1033');
    (this.scene.fog as THREE.Fog).color.set('#1a1033');
    this.hemi.color.set('#b8c0ff');
  }

  update(dt: number, aspect: number) {
    this.t += dt;
    const t = this.t;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    // put the island to the right of the menu on wide screens
    const offset = this.focusRight && aspect > 1.2 ? -5.5 : 0;
    const camR = 17;
    const ca = Math.sin(t * 0.1) * 0.25;
    this.camera.position.set(Math.sin(ca) * camR + offset * 0.3, 6.5, Math.cos(ca) * camR);
    this.camera.lookAt(offset, 1.6, 0);
    this.island.rotation.y = t * 0.05;
    this.island.position.y = Math.sin(t * 0.6) * 0.15;
    if (this.rig) {
      this.rig.root.position.set(0, this.island.position.y, 0);
      this.rig.root.rotation.y = t * 0.6;
      animateRig(this.rig, t, 0, Math.max(0, Math.sin(t * 1.5)) ** 8, 0);
    }
    for (const f of this.floaters) {
      f.obj.position.set(f.base.x, f.base.y + Math.sin(t * f.speed + f.phase) * 1.2, f.base.z);
      f.obj.rotation.y = t * f.speed;
      f.obj.rotation.x = t * f.speed * 0.5;
    }
    for (const s of this.slimes) {
      const a = s.angle + t * 0.35;
      const hop = Math.abs(Math.sin(t * 5 + s.phase));
      s.obj.position.set(Math.cos(a) * s.r, this.island.position.y + hop * 0.6, Math.sin(a) * s.r);
      s.obj.rotation.y = -a;
      s.obj.scale.set(0.8, 0.8 * (0.85 + hop * 0.3), 0.8);
    }
  }
}
