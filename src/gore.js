import * as THREE from 'three';
import { clamp, rand, v3, q4 } from './util.js';

const MAX_DROPS = 4000;
const MAX_SPLATS = 1400;
const MAX_SPARKS = 400;

function bloodTexture(kind) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 128, 128);
  const blob = (x, y, r, a) => {
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, `rgba(120,0,0,${a})`);
    grd.addColorStop(0.7, `rgba(95,0,0,${a * 0.95})`);
    grd.addColorStop(1, 'rgba(70,0,0,0)');
    g.fillStyle = grd;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  };
  if (kind === 'gash') {
    // elongated wound: dark core, ragged edges
    for (let i = 0; i < 26; i++) {
      const t = i / 25;
      blob(14 + t * 100, 64 + Math.sin(t * 9) * 4 + rand(-3, 3), 10 + Math.sin(t * Math.PI) * 14 + rand(-3, 3), 0.9);
    }
    g.fillStyle = 'rgba(30,0,0,0.95)';
    g.beginPath(); g.ellipse(64, 64, 48, 5, 0, 0, Math.PI * 2); g.fill();
  } else {
    blob(64, 64, 40, 0.95);
    for (let i = 0; i < 14; i++) {
      const a = rand(0, Math.PI * 2), d = rand(20, 50);
      blob(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, rand(4, 16), 0.9);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
const _v = new THREE.Vector3(), _d = new THREE.Vector3(), _z = new THREE.Vector3(0, 0, 1), _y = new THREE.Vector3(0, 1, 0);
const _bq = new THREE.Quaternion(), _bp = new THREE.Vector3();
const _col = new THREE.Color();

export class Gore {
  constructor(game) {
    this.game = game;
    const scene = game.scene;
    // Blood droplets
    this.drops = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 0),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25, metalness: 0.1 }),
      MAX_DROPS,
    );
    this.drops.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.drops.frustumCulled = false;
    this.drops.count = 0;
    this.drops.setColorAt(0, _col.set(0x7a0000));
    scene.add(this.drops);
    this.dp = new Float32Array(MAX_DROPS * 3);
    this.dv = new Float32Array(MAX_DROPS * 3);
    this.dl = new Float32Array(MAX_DROPS);
    this.ds = new Float32Array(MAX_DROPS);
    this.nDrops = 0;

    // Floor splats
    this.splatTex = bloodTexture('splat');
    this.gashTex = bloodTexture('gash');
    const sg = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.splats = new THREE.InstancedMesh(sg, new THREE.MeshStandardMaterial({
      map: this.splatTex, transparent: true, depthWrite: false, roughness: 0.15, metalness: 0.1,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }), MAX_SPLATS);
    this.splats.count = 0;
    this.splats.frustumCulled = false;
    this.splats.receiveShadow = true;
    scene.add(this.splats);
    this.splatIndex = 0;

    // Sparks
    this.sparkMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.006, 0.006, 0.05),
      new THREE.MeshBasicMaterial({ color: 0xffd890, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }),
      MAX_SPARKS,
    );
    this.sparkMesh.frustumCulled = false;
    this.sparkMesh.count = 0;
    scene.add(this.sparkMesh);
    this.sp = new Float32Array(MAX_SPARKS * 3);
    this.sv = new Float32Array(MAX_SPARKS * 3);
    this.sl = new Float32Array(MAX_SPARKS);
    this.nSparks = 0;

    this.bleeders = [];
    this.woundMat = new THREE.MeshStandardMaterial({
      map: this.gashTex, transparent: true, depthWrite: false, roughness: 0.2,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    });
    this.splatMat = new THREE.MeshStandardMaterial({
      map: this.splatTex, transparent: true, depthWrite: false, roughness: 0.2,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    });
    this.capMat = new THREE.MeshStandardMaterial({ color: 0x6e0505, roughness: 0.4 });
    this.boneMat = new THREE.MeshStandardMaterial({ color: 0xe8e0c8, roughness: 0.6 });
    this.decals = [];
  }

  get enabled() { return this.game.settings.gore; }

  // ---------------------------------------------------------------- particles
  spray(pos, dir, count, speed, spread = 0.5, size = 1) {
    if (!this.enabled) return;
    for (let i = 0; i < count; i++) {
      if (this.nDrops >= MAX_DROPS) this.killDrop(Math.floor(Math.random() * this.nDrops));
      const k = this.nDrops++;
      const sp = speed * rand(0.4, 1.1);
      this.dp[k * 3] = pos.x + rand(-0.01, 0.01);
      this.dp[k * 3 + 1] = pos.y + rand(-0.01, 0.01);
      this.dp[k * 3 + 2] = pos.z + rand(-0.01, 0.01);
      this.dv[k * 3] = (dir.x + rand(-spread, spread)) * sp;
      this.dv[k * 3 + 1] = (dir.y + rand(-spread, spread)) * sp;
      this.dv[k * 3 + 2] = (dir.z + rand(-spread, spread)) * sp;
      this.dl[k] = rand(1.5, 3);
      this.ds[k] = rand(0.006, 0.02) * size;
      this.drops.setColorAt(k, _col.setRGB(rand(0.35, 0.55), 0, rand(0, 0.02)));
    }
    this.drops.instanceColor.needsUpdate = true;
  }

  killDrop(k) {
    const last = --this.nDrops;
    if (k !== last) {
      for (let j = 0; j < 3; j++) { this.dp[k * 3 + j] = this.dp[last * 3 + j]; this.dv[k * 3 + j] = this.dv[last * 3 + j]; }
      this.dl[k] = this.dl[last]; this.ds[k] = this.ds[last];
      this.drops.getColorAt(last, _col); this.drops.setColorAt(k, _col);
    }
  }

  floorSplat(x, z, size) {
    if (!this.enabled) return;
    const i = this.splatIndex;
    this.splatIndex = (this.splatIndex + 1) % MAX_SPLATS;
    this.splats.count = Math.max(this.splats.count, i + 1);
    _q.setFromAxisAngle(_y, Math.random() * Math.PI * 2);
    _s.set(size, 1, size * rand(0.7, 1.3));
    _p.set(x, 0.003 + (i % 50) * 0.00005, z);
    _m.compose(_p, _q, _s);
    this.splats.setMatrixAt(i, _m);
    this.splats.instanceMatrix.needsUpdate = true;
  }

  sparks(pos, normal, count) {
    for (let i = 0; i < count; i++) {
      if (this.nSparks >= MAX_SPARKS) break;
      const k = this.nSparks++;
      this.sp[k * 3] = pos.x; this.sp[k * 3 + 1] = pos.y; this.sp[k * 3 + 2] = pos.z;
      const s = rand(2, 7);
      this.sv[k * 3] = (normal.x * 0.5 + rand(-1, 1)) * s;
      this.sv[k * 3 + 1] = (normal.y * 0.5 + rand(-0.4, 1.2)) * s;
      this.sv[k * 3 + 2] = (normal.z * 0.5 + rand(-1, 1)) * s;
      this.sl[k] = rand(0.15, 0.45);
    }
  }

  // ---------------------------------------------------------------- wounds
  /** Wound decal stuck to a body part + a burst of blood + a bleeder. */
  wound(part, p, rel, type, dmg, bleed) {
    const fighter = part.fighter;
    // soak the part's clothing/skin
    part.wounds++;
    const soak = clamp((fighter.partDamage[part.name] || 0) / 60 + part.wounds * 0.06, 0, 0.8);
    if (this.enabled && part.tintMats) for (const t of part.tintMats) t.mat.color.copy(t.base).lerp(_col.setRGB(0.3, 0.01, 0.01), soak);
    if (!this.enabled) { this.addBleeder(part, p, null, bleed, 30, false, false); return; }

    const dir = _d.copy(rel).normalize();
    const n = Math.floor(clamp(dmg * 3, 6, 120));
    this.spray(p, dir, Math.floor(n * 0.6), clamp(rel.length() * 0.35, 1.5, 5), 0.6);
    this.spray(p, _v.copy(dir).negate().add(_y), Math.floor(n * 0.4), 1.8, 0.8);

    if (type !== 'blunt' || dmg > 12) this.addDecal(part, p, rel, type === 'slash' ? 'gash' : 'splat', clamp(0.03 + dmg * 0.003, 0.03, 0.14));
    this.addBleeder(part, p, rel, bleed, 40, false, true);
  }

  addDecal(part, p, rel, kind, size) {
    const body = part.body;
    v3(body.translation(), _bp); q4(body.rotation(), _bq);
    const inv = _q.copy(_bq).invert();
    const local = _p.copy(p).sub(_bp).applyQuaternion(inv);
    // outward normal ~ from the part's center toward the hit point (good for capsules/boxes)
    const nrm = _v.copy(local);
    if (part.shape === 'capsule') nrm.y = 0;
    if (nrm.lengthSq() < 1e-6) nrm.set(0, 0, 1);
    nrm.normalize();
    const mesh = new THREE.Mesh(this.decalGeo || (this.decalGeo = new THREE.PlaneGeometry(1, 1)), kind === 'gash' ? this.woundMat : this.splatMat);
    mesh.position.copy(local).addScaledVector(nrm, 0.006);
    // orient: plane normal = nrm, long axis along the cut direction projected on the surface
    const cut = _d.copy(rel).applyQuaternion(inv);
    cut.addScaledVector(nrm, -cut.dot(nrm));
    if (cut.lengthSq() < 1e-6) cut.set(1, 0, 0).addScaledVector(nrm, -nrm.x);
    cut.normalize();
    const yv = new THREE.Vector3().crossVectors(nrm, cut);
    _m.makeBasis(cut, yv, nrm);
    mesh.quaternion.setFromRotationMatrix(_m);
    if (kind === 'gash') mesh.scale.set(size * 2.4, size * 0.9, 1);
    else mesh.scale.set(size, size, 1);
    part.visual.add(mesh);
    this.decals.push(mesh);
  }

  addBleeder(part, p, dir, rate, life, pulse, emit) {
    const body = part.body;
    v3(body.translation(), _bp); q4(body.rotation(), _bq);
    const inv = _q.copy(_bq).invert();
    const local = p.clone().sub(_bp).applyQuaternion(inv);
    const ldir = dir ? dir.clone().normalize().applyQuaternion(inv) : new THREE.Vector3(0, 1, 0);
    this.bleeders.push({ part, body, fighter: part.fighter, local, ldir, rate, life, t: 0, pulse, emit, acc: 0 });
  }

  /** Blood fountains from both sides of a severed joint. */
  severed(fighter, part, rel) {
    const parent = part.parentPart;
    this.addCap(parent, part.anchorLocalParent, part.anchorLocalParent.clone().normalize());
    this.addCap(part, part.anchorLocalChild, part.anchorLocalChild.clone().normalize());
    if (!this.enabled) return;
    const pw = part.anchorLocalParent.clone().applyQuaternion(q4(parent.body.rotation(), _bq)).add(v3(parent.body.translation(), _bp));
    this.spray(pw, _d.copy(rel).normalize(), 160, 4, 0.7, 1.4);
    this.bleeders.push({ part: parent, body: parent.body, fighter, local: part.anchorLocalParent.clone(), ldir: part.anchorLocalParent.clone().normalize(), rate: part.region === 'head' ? 6 : 2.5, life: 14, t: 0, pulse: true, emit: true, acc: 0, stump: true });
    this.bleeders.push({ part, body: part.body, fighter: null, local: part.anchorLocalChild.clone(), ldir: part.anchorLocalChild.clone().normalize(), rate: 1, life: 5, t: 0, pulse: true, emit: true, acc: 0, stump: true });
  }

  addCap(part, localAnchor, outward) {
    const r = part.shape === 'capsule' ? part.r : part.shape === 'ball' ? 0.06 : 0.07;
    const cap = new THREE.Mesh(new THREE.CircleGeometry(r * 1.05, 14), this.capMat);
    cap.position.copy(localAnchor);
    cap.quaternion.setFromUnitVectors(_z, outward);
    part.visual.add(cap);
    const bone = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.3, r * 0.3, 0.025, 8), this.boneMat);
    bone.position.copy(localAnchor).addScaledVector(outward, 0.008);
    bone.quaternion.setFromUnitVectors(_y, outward);
    part.visual.add(bone);
    this.decals.push(cap, bone);
  }

  gut(part, p, rel) {
    if (!this.enabled) return;
    this.spray(p, _d.copy(rel).normalize(), 140, 3, 0.9, 1.6);
    this.addDecal(part, p, rel, 'gash', 0.2);
    this.addBleeder(part, p, rel, 1.5, 30, true, true);
  }

  // ---------------------------------------------------------------- update
  update(dt) {
    // bleeders
    for (let i = this.bleeders.length - 1; i >= 0; i--) {
      const b = this.bleeders[i];
      b.t += dt;
      const decay = Math.exp(-b.t / (b.stump ? 18 : 12));
      const rate = b.rate * decay;
      if (b.fighter && !b.fighter.invulnerable) b.fighter.health -= rate * dt;
      if (!this.game.world.getRigidBody(b.body.handle) || b.t > b.life + 30) { this.bleeders.splice(i, 1); continue; }
      if (!b.emit || !this.enabled || b.t > b.life) continue;
      const beat = b.pulse ? Math.pow(Math.max(0, Math.sin(b.t * 7.5)), 3) : 0.5;
      b.acc += dt * (b.stump ? 90 : 14 + rate * 25) * (b.pulse ? beat * 2 : 1) * decay;
      if (b.acc >= 1) {
        const n = Math.floor(b.acc); b.acc -= n;
        q4(b.body.rotation(), _bq);
        _p.copy(b.local).applyQuaternion(_bq).add(v3(b.body.translation(), _bp));
        _d.copy(b.ldir).applyQuaternion(_bq);
        const sp = b.stump ? 1.2 + beat * 3.5 : 0.4;
        this.spray(_p, _d, n, sp, b.stump ? 0.18 : 0.6, b.stump ? 1.2 : 0.7);
      }
    }

    // drops
    const g = 9.81;
    for (let k = this.nDrops - 1; k >= 0; k--) {
      this.dl[k] -= dt;
      const i3 = k * 3;
      this.dv[i3 + 1] -= g * dt;
      this.dp[i3] += this.dv[i3] * dt;
      this.dp[i3 + 1] += this.dv[i3 + 1] * dt;
      this.dp[i3 + 2] += this.dv[i3 + 2] * dt;
      if (this.dp[i3 + 1] <= 0.002) {
        if (Math.random() < 0.55) this.floorSplat(this.dp[i3], this.dp[i3 + 2], this.ds[k] * rand(5, 14));
        this.killDrop(k);
        continue;
      }
      if (this.dl[k] <= 0) this.killDrop(k);
    }
    for (let k = 0; k < this.nDrops; k++) {
      const i3 = k * 3, s = this.ds[k];
      _p.set(this.dp[i3], this.dp[i3 + 1], this.dp[i3 + 2]);
      _v.set(this.dv[i3], this.dv[i3 + 1], this.dv[i3 + 2]);
      const sp = _v.length();
      _q.setFromUnitVectors(_y, sp > 1e-3 ? _v.multiplyScalar(1 / sp) : _y);
      _s.set(s, s * (1 + Math.min(sp * 0.4, 2.5)), s);
      _m.compose(_p, _q, _s);
      this.drops.setMatrixAt(k, _m);
    }
    this.drops.count = this.nDrops;
    this.drops.instanceMatrix.needsUpdate = true;
    if (this.drops.instanceColor) this.drops.instanceColor.needsUpdate = true;

    // sparks
    for (let k = this.nSparks - 1; k >= 0; k--) {
      this.sl[k] -= dt;
      if (this.sl[k] <= 0) {
        const last = --this.nSparks;
        for (let j = 0; j < 3; j++) { this.sp[k * 3 + j] = this.sp[last * 3 + j]; this.sv[k * 3 + j] = this.sv[last * 3 + j]; }
        this.sl[k] = this.sl[last];
        continue;
      }
      const i3 = k * 3;
      this.sv[i3 + 1] -= g * dt;
      for (let j = 0; j < 3; j++) this.sp[i3 + j] += this.sv[i3 + j] * dt;
      if (this.sp[i3 + 1] < 0) { this.sp[i3 + 1] = 0; this.sv[i3 + 1] *= -0.3; }
    }
    for (let k = 0; k < this.nSparks; k++) {
      const i3 = k * 3;
      _p.set(this.sp[i3], this.sp[i3 + 1], this.sp[i3 + 2]);
      _v.set(this.sv[i3], this.sv[i3 + 1], this.sv[i3 + 2]);
      const l = _v.length();
      _q.setFromUnitVectors(_z, l > 1e-3 ? _v.multiplyScalar(1 / l) : _z);
      _s.set(1, 1, clamp(l * 0.3, 0.3, 2) * (this.sl[k] * 3));
      _m.compose(_p, _q, _s);
      this.sparkMesh.setMatrixAt(k, _m);
    }
    this.sparkMesh.count = this.nSparks;
    this.sparkMesh.instanceMatrix.needsUpdate = true;
  }

  clear() {
    this.nDrops = 0; this.drops.count = 0;
    this.nSparks = 0; this.sparkMesh.count = 0;
    this.splats.count = 0; this.splatIndex = 0;
    this.bleeders.length = 0;
    for (const d of this.decals) { d.parent?.remove(d); if (d.geometry !== this.decalGeo) d.geometry.dispose(); }
    this.decals.length = 0;
  }
}
