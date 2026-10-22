// Interiors: VOLT nightclub (own scene) and the Aurum Tower penthouse (on the real rooftop).
import * as THREE from 'three';
import { CollisionWorld } from './collision';
import { Crowd, randomLook } from './character';
import { danceFloorTexture, signTexture } from './textures';

export interface InteriorPoint {
  id: string;
  x: number;
  z: number;
  label: string;
}

// ----------------------------------------------------------------------------------------------
export class ClubInterior {
  scene = new THREE.Scene();
  col = new CollisionWorld();
  crowd = new Crowd(70);
  points: InteriorPoint[] = [];
  spawn = { x: 0, z: 14, yaw: Math.PI };
  private tiles: THREE.InstancedMesh;
  private spots: THREE.SpotLight[] = [];
  private lasers: THREE.Mesh[] = [];
  private ledMat: THREE.MeshBasicMaterial;
  private tileColor = new THREE.Color();
  upgradesVisible: Record<string, THREE.Object3D[]> = {};
  W = 44;
  D = 34;

  constructor() {
    const s = this.scene;
    s.background = new THREE.Color('#05030a');
    s.fog = new THREE.Fog('#0a0412', 20, 70);
    s.add(new THREE.AmbientLight('#4a2a6a', 0.9));
    s.add(new THREE.HemisphereLight('#6a3aa0', '#120818', 0.6));
    const W = this.W, D = this.D;
    const floorMat = new THREE.MeshStandardMaterial({ color: '#111015', roughness: 0.25, metalness: 0.6 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), floorMat);
    floor.rotation.x = -Math.PI / 2;
    s.add(floor);
    const wallMat = new THREE.MeshStandardMaterial({ color: '#16121e', roughness: 0.8 });
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), wallMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = 8;
    s.add(ceil);
    const wall = (x: number, z: number, w: number, d: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 8, d), wallMat);
      m.position.set(x, 4, z);
      s.add(m);
      this.col.addRect(x, z, w, d, 0, 8);
    };
    wall(0, -D / 2 - 0.5, W + 2, 1);
    wall(0, D / 2 + 0.5, W + 2, 1);
    wall(-W / 2 - 0.5, 0, 1, D + 2);
    wall(W / 2 + 0.5, 0, 1, D + 2);
    // neon strips around the walls
    const neon = (c: string) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
    for (const [y, c] of [[7.5, '#ff2fd0'], [2.6, '#36c9ff']] as [number, string][]) {
      const m = neon(c);
      for (const [x, z, w, d] of [[0, -D / 2 + 0.05, W, 0.1], [0, D / 2 - 0.05, W, 0.1], [-W / 2 + 0.05, 0, 0.1, D], [W / 2 - 0.05, 0, 0.1, D]] as number[][]) {
        const strip = new THREE.Mesh(new THREE.BoxGeometry(w || 0.1, 0.12, d || 0.1), m);
        strip.position.set(x, y, z);
        s.add(strip);
      }
    }
    // dance floor (instanced light tiles)
    const n = 8;
    const tileGeo = new THREE.BoxGeometry(1.6, 0.08, 1.6);
    this.tiles = new THREE.InstancedMesh(tileGeo, new THREE.MeshBasicMaterial({ toneMapped: false }), n * n);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        m4.makeTranslation((i - n / 2 + 0.5) * 1.7, 0.04, -3 + (j - n / 2 + 0.5) * 1.7);
        this.tiles.setMatrixAt(i * n + j, m4);
        this.tiles.setColorAt(i * n + j, this.tileColor.set('#ff00aa'));
      }
    s.add(this.tiles);
    void danceFloorTexture;
    // DJ booth
    const booth = new THREE.Mesh(new THREE.BoxGeometry(8, 1.3, 2), new THREE.MeshStandardMaterial({ color: '#0d0d12', metalness: 0.7, roughness: 0.3 }));
    booth.position.set(0, 0.65, -13.5);
    s.add(booth);
    this.col.addRect(0, -13.5, 8, 2, 0, 1.3);
    this.ledMat = new THREE.MeshBasicMaterial({ color: '#36c9ff', toneMapped: false });
    const led = new THREE.Mesh(new THREE.PlaneGeometry(7.8, 1.1), this.ledMat);
    led.position.set(0, 0.65, -12.49);
    s.add(led);
    const djSign = signTexture('VOLT', { color: '#ff2fd0', glow: true, font: '900 120px Arial' });
    const djs = new THREE.Mesh(new THREE.PlaneGeometry(6 * (djSign.aspect / 3), 2), new THREE.MeshBasicMaterial({ map: djSign.tex, transparent: true, toneMapped: false }));
    djs.position.set(0, 5, -16.9);
    s.add(djs);
    // LED wall behind DJ
    const wallLed = new THREE.Mesh(new THREE.PlaneGeometry(16, 5), new THREE.MeshBasicMaterial({ color: '#1a0a2a', toneMapped: false }));
    wallLed.position.set(0, 4.5, -16.95);
    s.add(wallLed);
    // bar (west)
    const barMat = new THREE.MeshStandardMaterial({ color: '#1b1b22', metalness: 0.8, roughness: 0.2 });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(2, 1.2, 18), barMat);
    bar.position.set(-17, 0.6, 2);
    s.add(bar);
    this.col.addRect(-17, 2, 2, 18, 0, 1.2);
    const barLed = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 18), neon('#ffcc00'));
    barLed.position.set(-15.98, 1.1, 2);
    s.add(barLed);
    // backlit shelves with bottles
    const shelfMat = neon('#ff9a3d');
    for (let k = 0; k < 3; k++) {
      const sh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 16), shelfMat);
      sh.position.set(-21.6, 1.8 + k * 0.9, 2);
      s.add(sh);
      for (let b = 0; b < 22; b++) {
        const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.4, 6), new THREE.MeshStandardMaterial({ color: ['#2e7d32', '#ffd54f', '#e0e0e0', '#6d4c41'][b % 4], roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.85 }));
        bottle.position.set(-21.6, 2.05 + k * 0.9, -5.5 + b * 0.7);
        s.add(bottle);
      }
    }
    // VIP mezzanine (east)
    const vip = new THREE.Mesh(new THREE.BoxGeometry(8, 0.5, 22), new THREE.MeshStandardMaterial({ color: '#2a0d1e', roughness: 0.6 }));
    vip.position.set(18, 0.25, 0);
    s.add(vip);
    const ropeMat = neon('#d4af37');
    const rope = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 22), ropeMat);
    rope.position.set(13.9, 1.0, 0);
    s.add(rope);
    for (let k = 0; k < 4; k++) {
      const sofa = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.8, 3.5), new THREE.MeshStandardMaterial({ color: '#f5f0e6', roughness: 0.9 }));
      sofa.position.set(20.5, 0.9, -8 + k * 5.4);
      s.add(sofa);
      this.col.addRect(20.5, -8 + k * 5.4, 2.2, 3.5, 0, 1.3);
      const table = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.5, 16), new THREE.MeshStandardMaterial({ color: '#111', metalness: 0.9, roughness: 0.1 }));
      table.position.set(17.8, 0.75, -8 + k * 5.4);
      s.add(table);
      const sparkler = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 6), neon('#fff6c2'));
      sparkler.position.set(17.8, 1.3, -8 + k * 5.4);
      s.add(sparkler);
    }
    this.upgradesVisible.vip = [vip, rope];
    // moving spotlights
    const colors = ['#ff2fd0', '#36c9ff', '#ffcc00', '#7a3dff'];
    for (let k = 0; k < 4; k++) {
      const sp = new THREE.SpotLight(colors[k], 140, 40, 0.35, 0.4, 1.2);
      sp.position.set(-9 + k * 6, 7.6, -3);
      sp.target.position.set(0, 0, -3);
      s.add(sp, sp.target);
      this.spots.push(sp);
    }
    // lasers (visible beams)
    for (let k = 0; k < 6; k++) {
      const laser = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 30, 4), new THREE.MeshBasicMaterial({ color: k % 2 ? '#3dff6e' : '#ff2f5a', transparent: true, opacity: 0.6, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false }));
      laser.position.set(0, 6, -15);
      laser.geometry.translate(0, 15, 0);
      s.add(laser);
      this.lasers.push(laser);
    }
    // disco ball
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 12), new THREE.MeshStandardMaterial({ color: '#fff', metalness: 1, roughness: 0.05, flatShading: true }));
    ball.position.set(0, 6.6, -3);
    s.add(ball);
    this.lasers.push(ball);
    // entrance + office doors
    const doorMat = new THREE.MeshBasicMaterial({ color: '#ffcf8a', toneMapped: false });
    const door = new THREE.Mesh(new THREE.PlaneGeometry(3, 3.4), doorMat);
    door.position.set(0, 1.7, D / 2 - 0.02);
    door.rotation.y = Math.PI;
    s.add(door);
    const exitSign = signTexture('EXIT', { color: '#3dff6e', glow: true });
    const es = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.5), new THREE.MeshBasicMaterial({ map: exitSign.tex, transparent: true, toneMapped: false }));
    es.position.set(0, 3.8, D / 2 - 0.05);
    es.rotation.y = Math.PI;
    s.add(es);
    const off = new THREE.Mesh(new THREE.PlaneGeometry(2, 3), new THREE.MeshBasicMaterial({ color: '#d4af37', toneMapped: false }));
    off.position.set(W / 2 - 0.05, 1.5, -14);
    off.rotation.y = -Math.PI / 2;
    s.add(off);
    const offSign = signTexture('MANAGER', { color: '#d4af37', glow: true });
    const os = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.45), new THREE.MeshBasicMaterial({ map: offSign.tex, transparent: true, toneMapped: false }));
    os.position.set(W / 2 - 0.06, 3.4, -14);
    os.rotation.y = -Math.PI / 2;
    s.add(os);
    this.points.push({ id: 'club_exit', x: 0, z: D / 2 - 1.5, label: 'Exit to Brickell' });
    this.points.push({ id: 'club_office', x: W / 2 - 2, z: -14, label: 'Club manager office' });
    this.points.push({ id: 'club_bar', x: -15, z: 2, label: 'Order bottle service ($2,500, +clout)' });
    this.points.push({ id: 'club_shot', x: -15, z: -5, label: 'Take a tequila shot ($40)' });
    // dancers
    this.crowd.addTo(s);
    const r = (() => { let x = 7; return () => ((x = (x * 16807) % 2147483647) / 2147483647); })();
    for (let k = 0; k < 40; k++) {
      const look = randomLook(r);
      const onFloor = k < 28;
      this.crowd.add({
        x: onFloor ? (r() - 0.5) * 12 : -14 + r() * 2, y: 0.08, z: onFloor ? -3 + (r() - 0.5) * 11 : -6 + r() * 16, yaw: r() * Math.PI * 2,
        speed: 0, phase: r() * 10, dance: onFloor ? 0.6 + r() * 0.4 : 0.15, wave: 0, look, visible: true,
      });
    }
    // DJ
    this.crowd.add({ x: 0, y: 0, z: -15, yaw: 0, speed: 0, phase: 0, dance: 0.4, wave: 0, look: { skin: '#6b4430', hair: '#ffcc00', top: '#7b2cbf', bottom: '#111', hairStyle: 'short' }, visible: true });
  }

  setAttendance(level: number) {
    // 0..1 — how many dancers are visible
    const n = Math.round(14 + level * 26);
    this.crowd.agents.forEach((a, i) => (a.visible = i >= 40 || i < n));
  }

  update(dt: number, t: number) {
    const beat = (t * 124) / 60;
    const n = 8;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const h = (Math.sin(i * 0.9 + Math.floor(beat) * 1.3) + Math.cos(j * 1.1 + Math.floor(beat / 2))) * 0.25 + 0.5;
        const pulse = 1 - (beat % 1) * 0.6;
        this.tileColor.setHSL((h + t * 0.05) % 1, 1, 0.35 * pulse + 0.1);
        this.tiles.setColorAt(i * n + j, this.tileColor);
      }
    if (this.tiles.instanceColor) this.tiles.instanceColor.needsUpdate = true;
    this.spots.forEach((sp, k) => {
      sp.target.position.set(Math.sin(t * (0.7 + k * 0.2) + k) * 9, 0, -3 + Math.cos(t * (0.5 + k * 0.15) + k * 2) * 8);
    });
    this.lasers.forEach((l, k) => {
      if (k === this.lasers.length - 1) {
        l.rotation.y += dt * 0.8;
        return;
      }
      l.rotation.set(Math.sin(t * 1.3 + k) * 0.9 - 1.0, 0, Math.cos(t * 0.9 + k * 1.7) * 0.8);
    });
    this.ledMat.color.setHSL((t * 0.1) % 1, 1, 0.5);
    this.crowd.update(dt, t);
  }
}

// ----------------------------------------------------------------------------------------------
export const PENTHOUSE = { cx: 232, cz: -50, y: 200.14 + 0.3, size: 40 };

export class Penthouse {
  group = new THREE.Group();
  points: InteriorPoint[] = [];
  light: THREE.PointLight;

  constructor(col: CollisionWorld) {
    const { cx, cz, y, size } = PENTHOUSE;
    const g = this.group;
    const half = size / 2;
    const marble = new THREE.MeshStandardMaterial({ color: '#f1eee8', roughness: 0.15, metalness: 0.1 });
    const floor = new THREE.Mesh(new THREE.BoxGeometry(size, 0.3, size), marble);
    floor.position.set(cx, y - 0.15, cz);
    floor.receiveShadow = true;
    g.add(floor);
    const glassMat = new THREE.MeshPhysicalMaterial({ color: '#a8d8ff', transparent: true, opacity: 0.18, roughness: 0.02, metalness: 0.1, side: THREE.DoubleSide, depthWrite: false });
    const H = 4.2;
    // interior zone: x in [-half, 6] (local), terrace x in [6, half]
    const ix1 = 6;
    const wall = (lx: number, lz: number, w: number, d: number, mat: THREE.Material, h = H, collide = true) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(cx + lx, y + h / 2, cz + lz);
      g.add(m);
      if (collide) col.addRect(cx + lx, cz + lz, w, d, y - 0.5, y + h);
      return m;
    };
    // outer glass walls of the interior
    wall(-half + 0.1, 0, 0.2, size, glassMat);
    wall((-half + ix1) / 2, -half + 0.1, ix1 + half, 0.2, glassMat);
    wall((-half + ix1) / 2, half - 0.1, ix1 + half, 0.2, glassMat);
    // glass wall to terrace with door gap
    wall(ix1, -11, 0.2, 18, glassMat);
    wall(ix1, 11, 0.2, 18, glassMat);
    // terrace railing (glass, low)
    wall(half - 0.1, 0, 0.2, size, glassMat, 1.2);
    wall((ix1 + half) / 2, -half + 0.1, half - ix1, 0.2, glassMat, 1.2);
    wall((ix1 + half) / 2, half - 0.1, half - ix1, 0.2, glassMat, 1.2);
    // ceiling
    const ceil = new THREE.Mesh(new THREE.BoxGeometry(ix1 + half, 0.3, size), new THREE.MeshStandardMaterial({ color: '#fafafa', roughness: 0.8 }));
    ceil.position.set(cx + (-half + ix1) / 2, y + H + 0.15, cz);
    g.add(ceil);
    // gold ceiling light strip
    const strip = new THREE.Mesh(new THREE.BoxGeometry(ix1 + half - 2, 0.05, 0.4), new THREE.MeshBasicMaterial({ color: '#ffd27a', toneMapped: false }));
    strip.position.set(cx + (-half + ix1) / 2, y + H - 0.02, cz);
    g.add(strip);
    // furniture
    const sofaMat = new THREE.MeshStandardMaterial({ color: '#e8e2d6', roughness: 0.9 });
    const dark = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.3, metalness: 0.6 });
    const gold = new THREE.MeshStandardMaterial({ color: '#d4af37', metalness: 1, roughness: 0.2 });
    wall(-2, 0, 1.2, 7, sofaMat, 0.9); // sofa facing the bay
    wall(1.5, 0, 1.6, 3, dark, 0.45); // coffee table
    wall(-9, -12, 4.5, 5, sofaMat, 0.7); // bed
    wall(-11.4, -12, 0.4, 5, gold, 1.6); // headboard
    wall(-12, 10, 2, 6, dark, 1.1); // kitchen island
    wall(-19.4, 12, 0.8, 6, new THREE.MeshStandardMaterial({ color: '#3a2112', roughness: 0.4 }), 3); // wardrobe
    // elevator
    const elev = wall(-19.6, 0, 0.6, 3.2, gold, 3.4, false);
    void elev;
    // art: giant "LARP" sculpture
    const art = signTexture('KING OF BRICKELL', { color: '#d4af37', glow: true });
    const am = new THREE.Mesh(new THREE.PlaneGeometry(6, 6 / art.aspect), new THREE.MeshBasicMaterial({ map: art.tex, transparent: true, toneMapped: false }));
    am.position.set(cx - 2, y + 3, cz + half - 0.25);
    am.rotation.y = Math.PI;
    g.add(am);
    // infinity pool on the terrace
    const pool = new THREE.Mesh(new THREE.BoxGeometry(8, 0.5, 22), new THREE.MeshStandardMaterial({ color: '#29b6d6', roughness: 0.05, metalness: 0.2, emissive: '#0a5a6a', emissiveIntensity: 0.6 }));
    pool.position.set(cx + 14.5, y + 0.05, cz);
    g.add(pool);
    col.addRect(cx + 14.5, cz, 8, 22, y - 0.5, y + 1);
    for (let k = 0; k < 3; k++) wall(9, -14 + k * 3.2, 0.9, 2, sofaMat, 0.35);
    this.light = new THREE.PointLight('#ffe2b0', 0, 40, 1.5);
    this.light.position.set(cx - 6, y + 3.6, cz);
    g.add(this.light);
    this.points.push({ id: 'ph_elevator', x: cx - 18.5, z: cz, label: 'Elevator to lobby' });
    this.points.push({ id: 'ph_bed', x: cx - 6.2, z: cz - 12, label: 'Sleep / save' });
    this.points.push({ id: 'ph_wardrobe', x: cx - 18.2, z: cz + 12, label: 'Walk-in wardrobe' });
    this.points.push({ id: 'ph_party', x: cx + 8.5, z: cz - 3, label: 'Host a Penthouse Soirée' });
    this.points.push({ id: 'ph_bar', x: cx - 10.2, z: cz + 10, label: 'Pour a whiskey' });
  }
}
