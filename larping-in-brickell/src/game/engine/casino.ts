// The Gilded Flamingo casino: its own scene with blackjack, roulette, slots, video poker and a bar.
import * as THREE from 'three';
import { CollisionWorld } from './collision';
import { Crowd, randomLook } from './character';
import { signTexture } from './textures';
import type { InteriorPoint } from './interiors';

function carpetTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d')!;
  x.fillStyle = '#5a0f1e';
  x.fillRect(0, 0, 256, 256);
  // classic loud casino carpet: gold diamonds and teal swirls
  for (let i = 0; i < 8; i++)
    for (let j = 0; j < 8; j++) {
      const cx = i * 32 + 16, cy = j * 32 + 16;
      x.fillStyle = (i + j) % 2 ? '#c99a3a' : '#1f6b73';
      x.beginPath();
      x.moveTo(cx, cy - 9);
      x.lineTo(cx + 9, cy);
      x.lineTo(cx, cy + 9);
      x.lineTo(cx - 9, cy);
      x.closePath();
      x.fill();
      x.strokeStyle = 'rgba(255,210,120,0.35)';
      x.beginPath();
      x.arc(cx, cy, 14, 0, Math.PI * 2);
      x.stroke();
    }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(10, 7);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class CasinoInterior {
  scene = new THREE.Scene();
  col = new CollisionWorld();
  crowd = new Crowd(60);
  points: InteriorPoint[] = [];
  spawn = { x: 0, z: 15, yaw: Math.PI };
  W = 50;
  D = 36;
  private wheels: THREE.Object3D[] = [];
  private slotScreens: THREE.MeshBasicMaterial[] = [];
  private chandeliers: THREE.Mesh[] = [];

  constructor() {
    const s = this.scene;
    const W = this.W, D = this.D;
    s.background = new THREE.Color('#120806');
    s.fog = new THREE.Fog('#1a0c08', 25, 80);
    s.add(new THREE.AmbientLight('#ffd9a0', 0.55));
    s.add(new THREE.HemisphereLight('#ffe7b8', '#3a1010', 0.7));
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: carpetTexture(), roughness: 0.95 }));
    floor.rotation.x = -Math.PI / 2;
    s.add(floor);
    const wallMat = new THREE.MeshStandardMaterial({ color: '#2a1410', roughness: 0.7 });
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ color: '#1c0e0a', roughness: 0.9 }));
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = 7;
    s.add(ceil);
    const wall = (x: number, z: number, w: number, d: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 7, d), wallMat);
      m.position.set(x, 3.5, z);
      s.add(m);
      this.col.addRect(x, z, w, d, 0, 7);
    };
    wall(0, -D / 2 - 0.5, W + 2, 1);
    wall(0, D / 2 + 0.5, W + 2, 1);
    wall(-W / 2 - 0.5, 0, 1, D + 2);
    wall(W / 2 + 0.5, 0, 1, D + 2);
    const gold = new THREE.MeshStandardMaterial({ color: '#d4af37', metalness: 1, roughness: 0.25 });
    const glow = (c: string) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
    // gold trim around the room
    for (const [x, z, w, d] of [[0, -D / 2 + 0.05, W, 0.1], [0, D / 2 - 0.05, W, 0.1], [-W / 2 + 0.05, 0, 0.1, D], [W / 2 - 0.05, 0, 0.1, D]] as number[][]) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(w, 0.15, d), glow('#ffcf6a'));
      t.position.set(x, 6.6, z);
      s.add(t);
    }
    // chandeliers
    for (const [x, z] of [[-12, 0], [0, 0], [12, 0]]) {
      const ch = new THREE.Mesh(new THREE.OctahedronGeometry(1.1, 1), new THREE.MeshStandardMaterial({ color: '#fff4d6', emissive: '#ffd27a', emissiveIntensity: 1.4, metalness: 0.8, roughness: 0.1, flatShading: true }));
      ch.position.set(x, 5.6, z);
      s.add(ch);
      this.chandeliers.push(ch);
      const pl = new THREE.PointLight('#ffd9a0', 60, 26, 1.6);
      pl.position.set(x, 5, z);
      s.add(pl);
    }
    // casino sign over the entrance (inside)
    const sign = signTexture('THE GILDED FLAMINGO', { color: '#ffcf6a', glow: true });
    const sm = new THREE.Mesh(new THREE.PlaneGeometry(10, 10 / sign.aspect), new THREE.MeshBasicMaterial({ map: sign.tex, transparent: true, toneMapped: false }));
    sm.position.set(0, 5.2, -D / 2 + 0.1);
    s.add(sm);

    // --- blackjack tables (semicircles of green felt), west half
    const felt = new THREE.MeshStandardMaterial({ color: '#0f5a32', roughness: 0.9 });
    const rail = new THREE.MeshStandardMaterial({ color: '#3a1f10', roughness: 0.4 });
    for (const x of [-15, -7]) {
      const z = -1;
      const top = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.12, 32, 1, false, -Math.PI / 2, Math.PI), felt);
      top.position.set(x, 0.95, z);
      s.add(top);
      const edge = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.12, 8, 32, Math.PI), rail);
      edge.rotation.x = Math.PI / 2;
      edge.position.set(x, 1.0, z);
      s.add(edge);
      const base = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 1.2), rail);
      base.position.set(x, 0.45, z + 0.6);
      s.add(base);
      this.col.addRect(x, z + 1.2, 4.8, 2.4, 0, 1.1);
      // dealer
      this.crowd.add({ x, y: 0, z: z - 0.7, yaw: 0, speed: 0, phase: x, dance: 0, wave: 0, look: { skin: '#c68a5e', hair: '#111', top: '#ffffff', bottom: '#111', hairStyle: 'short' }, visible: true });
      this.points.push({ id: 'game_blackjack', x, z: z + 3.2, label: 'Play Blackjack' });
    }
    // --- roulette tables, east half
    for (const x of [7, 15]) {
      const z = -1;
      const table = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.9, 1.8), rail);
      table.position.set(x, 0.45, z);
      s.add(table);
      const layout = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.05, 1.6), felt);
      layout.position.set(x + 0.2, 0.92, z);
      s.add(layout);
      const wheelGroup = new THREE.Group();
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.5, 0.18, 37), new THREE.MeshStandardMaterial({ color: '#2a140a', roughness: 0.3 }));
      wheelGroup.add(bowl);
      // red/black pockets as a spinning ring of little boxes
      for (let i = 0; i < 37; i++) {
        const a = (i / 37) * Math.PI * 2;
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.03, 0.12), new THREE.MeshStandardMaterial({ color: i === 0 ? '#0a8a3a' : i % 2 ? '#b0121c' : '#111' }));
        p.position.set(Math.cos(a) * 0.48, 0.1, Math.sin(a) * 0.48);
        p.rotation.y = -a;
        wheelGroup.add(p);
      }
      const hub = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.25, 12), gold);
      hub.position.y = 0.18;
      wheelGroup.add(hub);
      wheelGroup.position.set(x - 1.3, 1.0, z);
      s.add(wheelGroup);
      this.wheels.push(wheelGroup);
      this.col.addRect(x, z, 3.6, 2, 0, 1.1);
      this.crowd.add({ x: x - 1.3, y: 0, z: z - 1.4, yaw: 0, speed: 0, phase: x, dance: 0, wave: 0, look: { skin: '#e2b48c', hair: '#3a2a1a', top: '#ffffff', bottom: '#111', hairStyle: 'bun' }, visible: true });
      this.points.push({ id: 'game_roulette', x, z: z + 2.2, label: 'Play Roulette' });
    }
    // --- slot machines along the west wall, video poker along the east wall
    const cabinet = new THREE.MeshStandardMaterial({ color: '#1a1a22', metalness: 0.6, roughness: 0.3 });
    const machine = (x: number, z: number, face: number, color: string) => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(1, 1.9, 0.8), cabinet);
      body.position.y = 0.95;
      g.add(body);
      const scrMat = new THREE.MeshBasicMaterial({ color, toneMapped: false });
      this.slotScreens.push(scrMat);
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.55), scrMat);
      scr.position.set(0, 1.35, 0.41);
      g.add(scr);
      const topper = new THREE.Mesh(new THREE.BoxGeometry(1, 0.35, 0.8), glow(color));
      topper.position.y = 2.05;
      g.add(topper);
      g.position.set(x, 0, z);
      g.rotation.y = face;
      s.add(g);
      this.col.addRect(x, z, 1.1, 1.1, 0, 2.2);
    };
    for (let i = 0; i < 9; i++) {
      const z = -12 + i * 2.6;
      machine(-W / 2 + 1, z, Math.PI / 2, ['#ff2fd0', '#ffcf3a', '#36c9ff'][i % 3]);
      this.points.push({ id: 'game_slots', x: -W / 2 + 2.6, z, label: 'Play the slots' });
      machine(W / 2 - 1, z, -Math.PI / 2, ['#3dff6e', '#36c9ff', '#ffcf3a'][i % 3]);
      this.points.push({ id: 'game_poker', x: W / 2 - 2.6, z, label: 'Play Video Poker (Jacks or Better)' });
    }
    // --- the bar (north wall)
    const barMat = new THREE.MeshStandardMaterial({ color: '#2a1206', metalness: 0.4, roughness: 0.25 });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(14, 1.15, 1.6), barMat);
    bar.position.set(0, 0.58, -13);
    s.add(bar);
    const barTop = new THREE.Mesh(new THREE.BoxGeometry(14.2, 0.06, 1.8), gold);
    barTop.position.set(0, 1.18, -13);
    s.add(barTop);
    this.col.addRect(0, -13, 14, 1.6, 0, 1.2);
    for (let k = 0; k < 3; k++) {
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(13, 0.05, 0.4), glow('#ffb347'));
      shelf.position.set(0, 1.9 + k * 0.85, -17.6);
      s.add(shelf);
      for (let b = 0; b < 26; b++) {
        const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.4, 6), new THREE.MeshStandardMaterial({ color: ['#ffd54f', '#6d4c41', '#2e7d32', '#e0e0e0'][b % 4], roughness: 0.1, transparent: true, opacity: 0.85 }));
        bottle.position.set(-6.25 + b * 0.5, 2.15 + k * 0.85, -17.6);
        s.add(bottle);
      }
    }
    for (let i = 0; i < 6; i++) {
      const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.2, 0.8, 12), gold);
      stool.position.set(-5 + i * 2, 0.4, -11.6);
      s.add(stool);
    }
    this.crowd.add({ x: 0, y: 0, z: -14.3, yaw: 0, speed: 0, phase: 1, dance: 0, wave: 0, look: { skin: '#9c6644', hair: '#111', top: '#111', bottom: '#111', hairStyle: 'short' }, visible: true });
    this.points.push({ id: 'casino_bar', x: -3, z: -11.4, label: 'Casino bar (drinks menu)' });
    this.points.push({ id: 'casino_bar', x: 3, z: -11.4, label: 'Casino bar (drinks menu)' });
    // --- exit
    const door = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), glow('#ffcf8a'));
    door.position.set(0, 1.7, D / 2 - 0.02);
    door.rotation.y = Math.PI;
    s.add(door);
    this.points.push({ id: 'casino_exit', x: 0, z: D / 2 - 1.5, label: 'Exit to Brickell' });
    // --- gamblers
    this.crowd.addTo(s);
    let seed = 99;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const spots: [number, number, number][] = [];
    for (const x of [-15, -7]) for (const a of [-0.9, -0.3, 0.3, 0.9]) spots.push([x + Math.sin(a) * 3.1, -1 + Math.cos(a) * 3.1, Math.PI + a]);
    for (const x of [7, 15]) for (const dx of [-1, 0, 1]) spots.push([x + dx, 1.3, Math.PI]);
    for (let i = 0; i < 9; i += 2) spots.push([-W / 2 + 2.1, -12 + i * 2.6, -Math.PI / 2], [W / 2 - 2.1, -12 + (i + 1) * 2.6, Math.PI / 2]);
    for (const [x, z, yaw] of spots) this.crowd.add({ x, y: 0, z, yaw, speed: 0, phase: r() * 10, dance: 0, wave: 0, look: randomLook(r), visible: true });
    for (let i = 0; i < 8; i++) this.crowd.add({ x: (r() - 0.5) * 30, y: 0, z: 6 + r() * 8, yaw: r() * 6, speed: 0, phase: r() * 10, dance: 0.1, wave: 0, look: randomLook(r), visible: true });
  }

  update(dt: number, t: number) {
    this.wheels.forEach((w, i) => (w.rotation.y += dt * (1.5 + i * 0.4)));
    this.slotScreens.forEach((m, i) => m.color.setHSL((t * 0.2 + i * 0.13) % 1, 0.9, 0.55 + Math.sin(t * 6 + i) * 0.1));
    this.chandeliers.forEach((c) => (c.rotation.y += dt * 0.2));
    // the occasional big winner throws their hands up
    for (const a of this.crowd.agents) a.wave = Math.sin(t * 0.7 + a.phase * 3) > 0.985 ? 1 : 0;
    this.crowd.update(dt, t);
  }
}
