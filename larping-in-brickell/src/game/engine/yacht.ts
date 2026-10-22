// Procedural yachts (three tiers). Walkable main deck in local coordinates; drivable on the bay.
import * as THREE from 'three';
import { YACHT_BY_ID } from '../data/catalog';
import { BAY_BOUNDS, YACHT_BERTH } from '../data/world';
import { woodTexture } from './textures';

export interface YachtLayout {
  len: number;
  beam: number;
  deckY: number;
  helm: { x: number; z: number };
  gangway: { x: number; z: number };
  party: { x: number; z: number };
  suite: { x: number; z: number };
  salon: { minX: number; maxX: number; minZ: number; maxZ: number };
}

export class Yacht {
  root = new THREE.Group();
  id: string;
  layout: YachtLayout;
  x = YACHT_BERTH.x;
  z = YACHT_BERTH.z;
  yaw = YACHT_BERTH.yaw;
  speed = 0;
  docked = true;
  private bob = 0;
  lights: THREE.MeshBasicMaterial;
  maxSpeed: number;

  constructor(id: string, hull = '') {
    this.id = id;
    const def = YACHT_BY_ID[id];
    this.maxSpeed = def.speed;
    const L = def.length;
    const B = Math.max(4.5, L * 0.2);
    const deckY = 1.6 + L * 0.02;
    this.layout = {
      len: L, beam: B, deckY,
      helm: { x: 0, z: L * 0.18 },
      gangway: { x: B / 2 - 0.8, z: -L * 0.3 },
      party: { x: 0, z: -L * 0.32 },
      suite: { x: 0, z: L * 0.02 },
      salon: { minX: -B * 0.32, maxX: B * 0.32, minZ: -L * 0.08, maxZ: L * 0.12 },
    };
    this.lights = new THREE.MeshBasicMaterial({ color: '#7fd9ff', toneMapped: false });
    this.build(L, B, deckY, def.rank, hull);
    this.root.position.set(this.x, 0, this.z);
    this.root.rotation.y = this.yaw;
  }

  private build(L: number, B: number, deckY: number, rank: number, hullColor: string) {
    const white = new THREE.MeshStandardMaterial({ color: '#f7f7f5', roughness: 0.25, metalness: 0.1 });
    const hullMat = new THREE.MeshStandardMaterial({ color: hullColor || (rank >= 3 ? '#0e1a2b' : '#f4f4f2'), roughness: 0.2, metalness: 0.3 });
    const glass = new THREE.MeshStandardMaterial({ color: '#0d1620', roughness: 0.05, metalness: 0.8 });
    const gold = new THREE.MeshStandardMaterial({ color: '#d4af37', metalness: 1, roughness: 0.2 });
    const wt = woodTexture();
    wt.repeat.set(0.3, 0.3);
    const teak = new THREE.MeshStandardMaterial({ map: wt, roughness: 0.7 });
    // hull: extruded plan shape with pointed bow
    const s = new THREE.Shape();
    s.moveTo(-B / 2, -L / 2);
    s.lineTo(B / 2, -L / 2);
    s.lineTo(B / 2, L * 0.18);
    s.quadraticCurveTo(B / 2, L * 0.42, 0, L / 2);
    s.quadraticCurveTo(-B / 2, L * 0.42, -B / 2, L * 0.18);
    s.closePath();
    const hullGeo = new THREE.ExtrudeGeometry(s, { depth: deckY + 0.8, bevelEnabled: true, bevelThickness: 0.3, bevelSize: 0.3, bevelSegments: 3 });
    hullGeo.rotateX(Math.PI / 2);
    hullGeo.translate(0, deckY, 0);
    hullGeo.computeVertexNormals();
    const hull = new THREE.Mesh(hullGeo, hullMat);
    hull.castShadow = true;
    this.root.add(hull);
    // gold/white stripe
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(B + 0.65, 0.18, L * 0.7), rank >= 3 ? gold : new THREE.MeshStandardMaterial({ color: '#1e3a8a' }));
    stripe.position.set(0, deckY - 0.5, -L * 0.1);
    this.root.add(stripe);
    // deck
    // teak deck: same orientation as the hull, a thin slab whose top face sits just above the hull
    const deckGeo = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: false });
    deckGeo.rotateX(Math.PI / 2);
    deckGeo.scale(0.96, 1, 0.96);
    const deck = new THREE.Mesh(deckGeo, teak);
    deck.position.y = deckY + 0.06;
    deck.receiveShadow = true;
    this.root.add(deck);
    // railings
    const railMat = new THREE.MeshStandardMaterial({ color: '#e8e8e8', metalness: 1, roughness: 0.15 });
    for (const sx of [-1, 1]) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, L * 0.68), railMat);
      r.position.set(sx * (B / 2 - 0.1), deckY + 1.0, -L * 0.14);
      this.root.add(r);
    }
    const back = new THREE.Mesh(new THREE.BoxGeometry(B - 0.2, 0.06, 0.06), railMat);
    back.position.set(0, deckY + 1.0, -L / 2 + 0.1);
    this.root.add(back);
    // salon superstructure (open-backed so you can walk in)
    const sl = this.layout.salon;
    const sw = sl.maxX - sl.minX, sd = sl.maxZ - sl.minZ;
    const roofY = deckY + 2.6;
    const roof = new THREE.Mesh(new THREE.BoxGeometry(sw + 1, 0.25, sd + 1.5), white);
    roof.position.set(0, roofY, (sl.minZ + sl.maxZ) / 2);
    roof.castShadow = true;
    this.root.add(roof);
    for (const sx of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.6, sd), glass);
      wall.position.set(sx * (sw / 2), deckY + 1.3, (sl.minZ + sl.maxZ) / 2);
      this.root.add(wall);
    }
    const front = new THREE.Mesh(new THREE.BoxGeometry(sw, 2.6, 0.15), glass);
    front.position.set(0, deckY + 1.3, sl.maxZ);
    this.root.add(front);
    // salon sofas
    const sofaMat = new THREE.MeshStandardMaterial({ color: '#f1ece2', roughness: 0.9 });
    for (const sx of [-1, 1]) {
      const sofa = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, sd * 0.6), sofaMat);
      sofa.position.set(sx * (sw / 2 - 0.6), deckY + 0.25, (sl.minZ + sl.maxZ) / 2);
      this.root.add(sofa);
    }
    // upper decks (visual, stacked tiers)
    const tiers = rank;
    for (let i = 0; i < tiers; i++) {
      const tw = sw * (0.95 - i * 0.12), td = sd * (1.3 - i * 0.25);
      const tier = new THREE.Mesh(new THREE.BoxGeometry(tw, 2.2, td), white);
      tier.position.set(0, roofY + 1.15 + i * 2.4, (sl.minZ + sl.maxZ) / 2 + L * 0.05);
      tier.castShadow = true;
      this.root.add(tier);
      const win = new THREE.Mesh(new THREE.BoxGeometry(tw + 0.05, 0.8, td * 0.8), glass);
      win.position.copy(tier.position);
      win.position.y += 0.2;
      this.root.add(win);
      const led = new THREE.Mesh(new THREE.BoxGeometry(tw + 0.08, 0.06, td + 0.08), this.lights);
      led.position.copy(tier.position);
      led.position.y -= 1.08;
      this.root.add(led);
    }
    // radar arch / mast
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 4, 8), railMat);
    mast.position.set(0, roofY + tiers * 2.4 + 2, (sl.minZ + sl.maxZ) / 2 + L * 0.05);
    this.root.add(mast);
    // helm console
    const helm = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.1, 0.6), new THREE.MeshStandardMaterial({ color: '#222', roughness: 0.3 }));
    helm.position.set(this.layout.helm.x, deckY + 0.55, this.layout.helm.z + 0.8);
    this.root.add(helm);
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.04, 8, 20), gold);
    wheel.position.set(this.layout.helm.x, deckY + 1.15, this.layout.helm.z + 0.45);
    wheel.rotation.x = -0.4;
    this.root.add(wheel);
    // aft deck: jacuzzi + loungers + party lights
    const jac = new THREE.Mesh(new THREE.CylinderGeometry(Math.min(1.6, B * 0.18), Math.min(1.6, B * 0.18), 0.5, 20), new THREE.MeshStandardMaterial({ color: '#2fb7d6', roughness: 0.1, metalness: 0.3, emissive: '#0a4a5a' }));
    jac.position.set(-B * 0.2, deckY + 0.25, -L * 0.4);
    this.root.add(jac);
    for (let i = 0; i < 2; i++) {
      const lounger = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.3, 1.9), sofaMat);
      lounger.position.set(B * 0.2 + i * 0.9 - 0.45, deckY + 0.15, -L * 0.38);
      this.root.add(lounger);
    }
    if (rank >= 3) {
      // helipad on the bow
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(B * 0.35, B * 0.35, 0.1, 32), new THREE.MeshStandardMaterial({ color: '#2a2a2a' }));
      pad.position.set(0, deckY + 0.08, L * 0.32);
      this.root.add(pad);
      const H = new THREE.Mesh(new THREE.RingGeometry(B * 0.25, B * 0.28, 32), new THREE.MeshBasicMaterial({ color: '#ffd700', toneMapped: false }));
      H.rotation.x = -Math.PI / 2;
      H.position.set(0, deckY + 0.15, L * 0.32);
      this.root.add(H);
      const name = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 6), gold);
      name.position.set(B / 2 + 0.31, deckY - 1, -L * 0.3);
      this.root.add(name);
    }
    // underwater lights
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(B * 2.4, L * 1.3), new THREE.MeshBasicMaterial({ color: '#36c9ff', transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = -0.5;
    this.root.add(glow);
    this.root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true;
    });
  }

  /** Is a local deck point walkable? */
  clampDeck(p: { x: number; z: number }) {
    const { len: L, beam: B, salon } = this.layout;
    p.z = Math.max(-L / 2 + 0.6, Math.min(L * 0.42, p.z));
    // taper toward the bow
    const halfW = p.z > L * 0.18 ? (B / 2 - 0.5) * Math.max(0.15, 1 - (p.z - L * 0.18) / (L * 0.32)) : B / 2 - 0.5;
    p.x = Math.max(-halfW, Math.min(halfW, p.x));
    // salon side walls (enter from the aft opening)
    const inZ = p.z > salon.minZ && p.z < salon.maxZ + 0.3;
    if (inZ) {
      const wallX = (salon.maxX - salon.minX) / 2;
      // keep inside or outside the side walls
      if (Math.abs(p.x) > wallX - 0.3 && Math.abs(p.x) < wallX + 0.3) p.x = Math.sign(p.x) * (Math.abs(p.x) < wallX ? wallX - 0.3 : wallX + 0.3);
      if (p.z > salon.maxZ - 0.3 && Math.abs(p.x) < wallX) p.z = salon.maxZ - 0.3;
    }
  }

  localToWorld(lx: number, lz: number) {
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    return { x: this.x + lx * c + lz * s, z: this.z - lx * s + lz * c };
  }

  update(dt: number, t: number, inp: { throttle: number; brake: number; steer: number } | null) {
    if (inp) {
      this.docked = false;
      if (inp.throttle > 0) this.speed += 3 * inp.throttle * dt;
      if (inp.brake > 0) this.speed -= 4 * inp.brake * dt;
      this.speed = Math.max(-3, Math.min(this.maxSpeed, this.speed));
      this.speed *= Math.exp(-dt * 0.15);
      this.yaw -= inp.steer * dt * (0.25 + Math.min(1, Math.abs(this.speed) / 6) * 0.35) * Math.sign(this.speed || 1);
    } else if (!this.docked) {
      this.speed *= Math.exp(-dt * 0.5);
    }
    if (!this.docked) {
      this.x += Math.sin(this.yaw) * this.speed * dt;
      this.z += Math.cos(this.yaw) * this.speed * dt;
      const L = this.layout.len;
      const minX = BAY_BOUNDS.minX + L * 0.25;
      if (this.x < minX) {
        this.x = minX;
        this.speed *= 0.5;
      }
      this.x = Math.min(BAY_BOUNDS.maxX, this.x);
      this.z = Math.max(BAY_BOUNDS.minZ, Math.min(BAY_BOUNDS.maxZ, this.z));
      // pier avoidance & island
      const dI = Math.hypot(this.x - 560, this.z + 240);
      if (dI < 90 + L / 2) {
        const k = (90 + L / 2) / dI;
        this.x = 560 + (this.x - 560) * k;
        this.z = -240 + (this.z + 240) * k;
        this.speed *= 0.5;
      }
    }
    this.bob += dt;
    this.root.position.set(this.x, Math.sin(t * 0.9) * 0.08 - 0.15, this.z);
    this.root.rotation.set(Math.sin(t * 0.7) * 0.012, this.yaw, Math.sin(t * 0.8 + 1) * 0.015 + (inp ? -inp.steer * 0.02 * Math.min(1, Math.abs(this.speed) / 8) : 0));
  }

  nearBerth() {
    return Math.hypot(this.x - YACHT_BERTH.x, this.z - YACHT_BERTH.z) < 30 && Math.abs(this.speed) < 4;
  }

  dock() {
    this.x = YACHT_BERTH.x;
    this.z = YACHT_BERTH.z;
    this.yaw = YACHT_BERTH.yaw;
    this.speed = 0;
    this.docked = true;
  }

  dispose() {
    this.root.removeFromParent();
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.geometry.dispose();
    });
  }
}
