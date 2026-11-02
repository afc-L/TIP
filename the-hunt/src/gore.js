import * as THREE from 'three';
import { rand, clamp } from './util.js';
import { GeoBuilder, mat4 } from './models.js';

// Blood and gore: flying droplets that splash into wet decals, spreading pools under
// carcasses, gut piles from field dressing, and blood on the screen when you get hurt.
// Everything here is skipped when the "Blood & gore" setting is off.

const WET = () => new THREE.MeshPhongMaterial({ color: 0x4a0503, specular: 0x6a3030, shininess: 70 });

function gutGeometry(seed) {
  const r = (() => { let s = seed * 9301 + 49297; return () => ((s = (s * 9301 + 49297) % 233280) / 233280); })();
  const b = new GeoBuilder();
  for (let i = 0; i < 9; i++) {
    const s = 0.08 + r() * 0.12;
    const c = new THREE.Color().setHSL(0.98 + r() * 0.04, 0.6, 0.12 + r() * 0.1);
    b.add(new THREE.SphereGeometry(s, 6, 4), c, mat4(r() * 0.6 - 0.3, s * 0.6, r() * 0.6 - 0.3, r(), r(), r(), 1.4, 0.6, 1), { jitter: 0.04, rng: r });
  }
  // looped intestine
  for (let i = 0; i < 3; i++) {
    b.add(new THREE.TorusGeometry(0.12 + r() * 0.06, 0.035, 4, 10), '#5a1a1e', mat4(r() * 0.4 - 0.2, 0.05, r() * 0.4 - 0.2, Math.PI / 2 + r() * 0.4, r() * 6, 0));
  }
  return b.build();
}

function ribsGeometry() {
  const b = new GeoBuilder();
  for (let i = 0; i < 6; i++) {
    b.add(new THREE.TorusGeometry(0.2, 0.018, 3, 8, Math.PI), '#d8cbb4', mat4(0, 0, -0.35 + i * 0.13, 0, 0, Math.PI));
  }
  b.add(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 5), '#cfc2aa', mat4(0, -0.2, -0.05, Math.PI / 2, 0, 0));
  return b.build();
}

export class Gore {
  constructor(game) {
    this.game = game;
    const scene = game.scene;
    // flying droplets
    this.maxDrops = 220;
    this.drops = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.05, 0), WET(), this.maxDrops);
    this.drops.count = 0;
    this.drops.frustumCulled = false;
    scene.add(this.drops);
    this.dropList = [];
    // spreading pools (grow over time)
    const pg = new THREE.CircleGeometry(1, 14);
    pg.rotateX(-Math.PI / 2);
    // ragged edge
    const pp = pg.attributes.position;
    for (let i = 1; i < pp.count; i++) { const k = 0.75 + Math.random() * 0.4; pp.setX(i, pp.getX(i) * k); pp.setZ(i, pp.getZ(i) * k); }
    this.poolMat = new THREE.MeshPhongMaterial({ color: 0x3a0402, specular: 0x804040, shininess: 90, transparent: true, opacity: 0.92, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 });
    this.maxPools = 40;
    this.pools = new THREE.InstancedMesh(pg, this.poolMat, this.maxPools);
    this.pools.count = 0;
    this.pools.frustumCulled = false;
    this.pools.renderOrder = 3;
    scene.add(this.pools);
    this.poolList = [];
    this.props = [];
    this.gutGeos = [gutGeometry(1), gutGeometry(2), gutGeometry(3)];
    this.ribs = ribsGeometry();
    this.gutMat = new THREE.MeshPhongMaterial({ vertexColors: true, specular: 0x804848, shininess: 80, flatShading: true });
    this.boneMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._s = new THREE.Vector3(); this._v = new THREE.Vector3();
    this.bleedAcc = 0;
  }

  get on() { return this.game.settings.gore !== false; }

  reset() {
    this.dropList = []; this.drops.count = 0;
    this.poolList = []; this.pools.count = 0;
    for (const p of this.props) this.game.scene.remove(p);
    this.props = [];
  }

  /** Burst of droplets from pos, thrown mostly along dir (the bullet's path). */
  spray(pos, dir, amount = 20, force = 4) {
    if (!this.on) return;
    for (let i = 0; i < amount; i++) {
      if (this.dropList.length >= this.maxDrops) this.dropList.shift();
      const v = new THREE.Vector3(
        dir.x * force * (0.4 + rand()) + (rand() - 0.5) * force * 0.9,
        dir.y * force * 0.5 + rand() * force * 0.6,
        dir.z * force * (0.4 + rand()) + (rand() - 0.5) * force * 0.9,
      );
      this.dropList.push({ p: pos.clone(), v, s: 0.6 + rand() * 1.8 });
    }
    // red mist
    this.game.puffs.spawn(pos, 0x7a0806, 0.5);
    this.game.puffs.spawn(pos.clone().addScaledVector(dir, 0.6), 0x6a0605, 0.8);
  }

  /** A pool of blood that spreads out to `size` metres over `secs`. */
  pool(x, z, size = 1.5, secs = 12) {
    if (!this.on) return;
    if (this.poolList.length >= this.maxPools) this.poolList.shift();
    const y = this.game.world.heightAt(x, z);
    this.poolList.push({ x, y, z, size, secs, t: 0, rot: rand() * 6, sx: 0.7 + rand() * 0.5 });
  }

  splash(x, z, n = 1, spread = 0.4, scale = 1) {
    if (!this.on) return;
    const w = this.game.world;
    for (let i = 0; i < n; i++) {
      const bx = x + (rand() - 0.5) * spread, bz = z + (rand() - 0.5) * spread;
      this.game.animals.blood.add(bx, w.heightAt(bx, bz), bz, rand() * 6, (0.8 + rand() * 1.6) * scale, 'blood');
    }
  }

  /** Field dressing leftovers: gut pile, pool, raw red carcass with ribs showing. */
  dress(a) {
    if (!this.on) return;
    const g = this.game;
    const side = a.yaw + Math.PI / 2;
    const gx = a.x + Math.cos(side) * 0.7, gz = a.z - Math.sin(side) * 0.7;
    const guts = new THREE.Mesh(this.gutGeos[Math.floor(rand() * 3)], this.gutMat);
    const sc = a.kind === 'rabbit' ? 0.35 : 1;
    guts.scale.setScalar(sc);
    guts.position.set(gx, g.world.heightAt(gx, gz), gz);
    guts.rotation.y = rand() * 6;
    g.scene.add(guts);
    this.props.push(guts);
    this.pool(gx, gz, a.kind === 'rabbit' ? 0.5 : 1.4, 6);
    this.splash(a.x, a.z, a.kind === 'rabbit' ? 3 : 10, 1.6, 1.2);
    if (a.kind !== 'rabbit') {
      const ribs = new THREE.Mesh(this.ribs, this.boneMat);
      ribs.position.set(0, 0.05, 0);
      ribs.rotation.z = -Math.PI / 2;
      a.body.add(ribs);
    }
    // skinned, raw flesh
    a.group.traverse((o) => {
      if (!o.isMesh || o.material === this.boneMat) return;
      o.material = o.material.clone();
      o.material.color.lerp(new THREE.Color(0x5a1410), 0.75);
    });
    if (this.props.length > 30) g.scene.remove(this.props.shift());
    const d = Math.hypot(g.player.pos.x - a.x, g.player.pos.z - a.z);
    if (d < 3) this.screen(0.35);
  }

  /** Blood on the camera lens (0..1). */
  screen(amount) {
    if (!this.on) return;
    this.game.ui.bloodSplatter(amount);
  }

  update(dt) {
    const g = this.game, w = g.world;
    // droplets
    const m = this._m, q = this._q, s = this._s;
    let n = 0;
    for (let i = this.dropList.length - 1; i >= 0; i--) {
      const d = this.dropList[i];
      d.v.y -= 14 * dt;
      d.p.addScaledVector(d.v, dt);
      const gy = w.heightAt(d.p.x, d.p.z);
      if (d.p.y <= gy) {
        g.animals.blood.add(d.p.x, gy, d.p.z, rand() * 6, 0.6 + d.s * 0.9, 'blood');
        this.dropList.splice(i, 1);
      }
    }
    for (const d of this.dropList) {
      const sp = d.v.length();
      s.set(d.s, d.s * (1 + sp * 0.12), d.s);
      q.setFromUnitVectors(this._up || (this._up = new THREE.Vector3(0, 1, 0)), this._v.copy(d.v).normalize());
      m.compose(d.p, q, s);
      this.drops.setMatrixAt(n++, m);
    }
    this.drops.count = n;
    if (n) this.drops.instanceMatrix.needsUpdate = true;
    // pools
    let k = 0;
    for (const p of this.poolList) {
      p.t = Math.min(p.secs, p.t + dt);
      const e = 1 - Math.pow(1 - p.t / p.secs, 2);
      const r = Math.max(0.05, p.size * e);
      m.compose(this._v.set(p.x, p.y + 0.035, p.z), q.setFromAxisAngle(this._v2 || (this._v2 = new THREE.Vector3(0, 1, 0)), p.rot), s.set(r * p.sx, 1, r));
      this.pools.setMatrixAt(k++, m);
    }
    this.pools.count = k;
    if (k) this.pools.instanceMatrix.needsUpdate = true;
    // the player bleeds when badly hurt
    const pl = g.player;
    if (this.on && pl.stats.health < 35 && pl.speed > 0.5 && !pl.dead) {
      this.bleedAcc += pl.speed * dt;
      if (this.bleedAcc > 1.4) { this.bleedAcc = 0; this.splash(pl.pos.x, pl.pos.z, 1 + Math.floor(rand() * 2), 0.5, 0.8); }
    }
  }
}
