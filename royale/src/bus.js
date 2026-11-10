// The "Sky Barge": a flying airship that carries all 100 players across the island at the start of a match.
import * as THREE from 'three';
import { MAP_HALF } from './config.js';
import { rand } from './util.js';

export class Bus {
  constructor(game) {
    this.game = game;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.group = new THREE.Group();
    const lam = (c) => new THREE.MeshLambertMaterial({ color: c });
    const env = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), lam(0x3fa9f5));
    env.scale.set(7, 5, 18);
    env.position.y = 9;
    const stripe = new THREE.Mesh(new THREE.SphereGeometry(1.01, 20, 14), lam(0xffd23f));
    stripe.scale.set(7.05, 1.2, 18.1);
    stripe.position.y = 9;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 11), lam(0xf4f4f4));
    cabin.position.y = 2;
    const win = new THREE.Mesh(new THREE.BoxGeometry(5.1, 1, 9), lam(0x22313f));
    win.position.y = 2.6;
    const fins = [];
    for (const [x, y, rz] of [[0, 14, 0], [0, 4, 0], [5, 9, Math.PI / 2], [-5, 9, Math.PI / 2]]) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4, 4), lam(0xff4f6d));
      f.position.set(x, y, 16); f.rotation.z = rz;
      fins.push(f);
    }
    this.props = [];
    for (const x of [-4, 4]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4, 0.5), lam(0x333333));
      p.position.set(x, 3, 5);
      this.props.push(p);
    }
    for (const r of [-1.8, 1.8]) {
      const rope = new THREE.Mesh(new THREE.BoxGeometry(0.1, 4, 0.1), lam(0x555555));
      rope.position.set(r, 5, 0);
      this.group.add(rope);
    }
    this.group.add(env, stripe, cabin, win, ...fins, ...this.props);
    this.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    game.scene.add(this.group);
    this.group.visible = false;
    this.active = false;
  }

  start() {
    const a = rand(0, Math.PI * 2);
    const off = rand(-260, 260);
    const L = MAP_HALF + 250;
    const dx = Math.cos(a), dz = Math.sin(a);
    const px = -dz * off, pz = dx * off;
    this.start_ = new THREE.Vector3(px - dx * L, 0, pz - dz * L);
    this.end_ = new THREE.Vector3(px + dx * L, 0, pz + dz * L);
    this.dir = new THREE.Vector3(dx, 0, dz);
    this.height = 210;
    this.speed = 46;
    this.length = this.start_.distanceTo(this.end_);
    this.t = 0;
    this.doorsOpenAt = 5;
    this.pos.set(this.start_.x, this.height, this.start_.z);
    this.vel.set(dx * this.speed, 0, dz * this.speed);
    this.active = true;
    this.group.visible = true;
    this.group.rotation.y = Math.atan2(-dx, -dz) + Math.PI;
    this.group.position.copy(this.pos);
  }

  get doorsOpen() { return this.active && this.t >= this.doorsOpenAt; }
  get progress() { return (this.t * this.speed) / this.length; }
  get finished() { return this.t * this.speed >= this.length; }
  // world position at time offset (s) from now
  posAt(t) {
    const d = Math.min(this.length, (this.t + t) * this.speed);
    return new THREE.Vector3(this.start_.x + this.dir.x * d, this.height, this.start_.z + this.dir.z * d);
  }
  // distance along the route of the point closest to (x,z)
  closestAlong(x, z) {
    return (x - this.start_.x) * this.dir.x + (z - this.start_.z) * this.dir.z;
  }

  update(dt) {
    if (!this.active) return;
    this.t += dt;
    const d = Math.min(this.length, this.t * this.speed);
    this.pos.set(this.start_.x + this.dir.x * d, this.height + Math.sin(this.t * 0.8) * 1.5, this.start_.z + this.dir.z * d);
    this.group.position.copy(this.pos);
    for (const p of this.props) p.rotation.x += dt * 20;
    if (this.t * this.speed > this.length + 600) { this.active = false; this.group.visible = false; }
  }
}
