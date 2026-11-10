// Blocky stylised characters, all drawn through one InstancedMesh with procedural animation.
import * as THREE from 'three';

const PARTS_PER = 16;
const _root = new THREE.Matrix4();
const _a = new THREE.Matrix4();
const _b = new THREE.Matrix4();
const _t = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const ONE = new THREE.Vector3(1, 1, 1);

export class CharacterRenderer {
  constructor(scene, capacity = 110) {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    this.mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    this.mesh = new THREE.InstancedMesh(geo, this.mat, capacity * PARTS_PER);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.setColorAt(0, _c.set(0xffffff));
    this.mesh.count = 0;
    scene.add(this.mesh);
    this.i = 0;
    this.cap = capacity * PARTS_PER;
    // temp mats for hierarchy
    this.m = [new THREE.Matrix4(), new THREE.Matrix4(), new THREE.Matrix4(), new THREE.Matrix4()];
  }
  begin() { this.i = 0; }
  end() {
    this.mesh.count = this.i;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
  // local transform: translate(p) * rot(r)
  _local(out, px, py, pz, rx, ry, rz) {
    _e.set(rx, ry, rz, 'YXZ');
    _q.setFromEuler(_e);
    return out.compose(_v.set(px, py, pz), _q, ONE);
  }
  _emit(world, ox, oy, oz, sx, sy, sz, color) {
    if (this.i >= this.cap) return;
    _t.makeScale(sx, sy, sz).setPosition(ox, oy, oz);
    _b.multiplyMatrices(world, _t);
    this.mesh.setMatrixAt(this.i, _b);
    this.mesh.setColorAt(this.i, _c.set(color));
    this.i++;
  }

  // p: pose; ap: appearance {outfit, backpack, glider}
  draw(p, ap) {
    const o = ap.outfit;
    const st = p.state;
    const t = p.phase;
    const flash = p.flash > 0;
    // ----- root -----
    _root.makeRotationY(p.yaw);
    _root.setPosition(p.x, p.y, p.z);
    let bodyPitch = 0, legSwing = 0, armSwing = 0, crouch = 0, lean = 0;
    let armLx = 0, armRx = 0, armLz = 0.08, armRz = -0.08;
    let legLz = 0, legRz = 0;
    const moving = p.speed > 0.6;
    if (st === 'skydive') {
      bodyPitch = -1.25 - p.dive * 0.3;
      armLx = 2.6; armRx = 2.6; armLz = 0.9; armRz = -0.9;
      legLz = 0.3; legRz = -0.3; legSwing = Math.sin(t * 3) * 0.15;
    } else if (st === 'glide') {
      armLx = Math.PI; armRx = Math.PI; armLz = 0.25; armRz = -0.25;
      legSwing = Math.sin(t * 2) * 0.2; bodyPitch = -0.15;
    } else if (st === 'swim') {
      bodyPitch = -1.1;
      armSwing = Math.sin(t * 5) * 1.2; legSwing = Math.sin(t * 7) * 0.4;
      armLx = 1.6 + armSwing; armRx = 1.6 - armSwing;
    } else if (st === 'slide') {
      bodyPitch = 0.35; crouch = 0.45; legSwing = 0; armLx = 0.6; armRx = 0.6;
      legLz = 0; legRz = 0;
    } else if (st === 'mantle') {
      armLx = 2.8; armRx = 2.8; crouch = 0.25;
    } else if (st === 'emote') {
      armLx = Math.PI + Math.sin(t * 6) * 0.6; armRx = Math.PI - Math.sin(t * 6 + 1) * 0.6;
      armLz = 0.5 + Math.sin(t * 3) * 0.3; armRz = -0.5 - Math.sin(t * 3) * 0.3;
      legSwing = Math.sin(t * 6) * 0.25; crouch = Math.abs(Math.sin(t * 6)) * 0.12;
    } else {
      if (p.crouch) { crouch = 0.42; lean = 0.25; }
      if (moving) {
        const amp = Math.min(1, p.speed / 6.5) * (p.crouch ? 0.6 : 0.85);
        legSwing = Math.sin(t) * amp;
        armSwing = -Math.sin(t) * amp * 0.8;
        lean += p.speed > 6 ? 0.18 : 0.06;
      }
      if (!p.grounded) { legSwing = 0.5; armLz = 0.5; armRz = -0.5; }
      armLx = armSwing; armRx = -armSwing;
    }
    if (bodyPitch !== 0) {
      _a.makeTranslation(0, 0.9, 0);
      _root.multiply(_a);
      _a.makeRotationX(bodyPitch);
      _root.multiply(_a);
      _a.makeTranslation(0, -0.9, 0);
      _root.multiply(_a);
    }
    const hipY = 0.92 - crouch;
    // legs
    const legL = this._local(this.m[0], -0.12, hipY, 0, legSwing - (crouch > 0.3 ? -0.9 : 0) * 0, 0, legLz);
    _a.multiplyMatrices(_root, legL);
    const kneeBend = crouch > 0.3 ? 1 : 0;
    this._emit(_a, 0, -0.45 + crouch * 0.5, -kneeBend * 0.15, 0.19, 0.9 - crouch, 0.22, o.bottom);
    this._emit(_a, 0, -0.88 + crouch * 0.9, -0.05, 0.2, 0.12, 0.3, o.shoes);
    const legR = this._local(this.m[0], 0.12, hipY, 0, -legSwing, 0, legRz);
    _a.multiplyMatrices(_root, legR);
    this._emit(_a, 0, -0.45 + crouch * 0.5, -kneeBend * 0.15, 0.19, 0.9 - crouch, 0.22, o.bottom);
    this._emit(_a, 0, -0.88 + crouch * 0.9, -0.05, 0.2, 0.12, 0.3, o.shoes);
    // torso
    const torsoM = this.m[1];
    torsoM.multiplyMatrices(_root, this._local(this.m[0], 0, hipY, 0, -lean, 0, 0));
    this._emit(torsoM, 0, 0.3, 0, 0.48, 0.6, 0.28, flash ? 0xffffff : o.top);
    this._emit(torsoM, 0, 0.0, 0, 0.5, 0.12, 0.3, o.bottom);   // belt / hips
    this._emit(torsoM, 0, 0.42, -0.145, 0.2, 0.14, 0.02, o.accent);   // chest emblem
    // head
    const headM = this.m[2];
    const headPitch = st === 'ground' || st === 'mantle' ? (p.pitch || 0) * 0.5 + lean : 0;
    headM.multiplyMatrices(torsoM, this._local(this.m[0], 0, 0.62, 0, headPitch, 0, 0));
    this._emit(headM, 0, 0.17, 0, 0.34, 0.34, 0.34, flash ? 0xffffff : o.skin);
    this._emit(headM, 0, 0.2, -0.172, 0.26, 0.08, 0.02, 0x1a1a1a);   // eyes band
    this._hat(headM, o);
    // backpack
    const bp = ap.backpack;
    if (bp && bp.style !== 'none') {
      if (bp.style === 'pack') this._emit(torsoM, 0, 0.3, 0.21, 0.36, 0.42, 0.16, bp.color);
      else if (bp.style === 'tank') {
        this._emit(torsoM, -0.1, 0.32, 0.2, 0.14, 0.5, 0.14, bp.color);
        this._emit(torsoM, 0.1, 0.32, 0.2, 0.14, 0.5, 0.14, bp.color);
      } else if (bp.style === 'wings') {
        _a.multiplyMatrices(torsoM, this._local(this.m[3], -0.12, 0.4, 0.2, 0, 0.5, 0.5));
        this._emit(_a, -0.3, 0, 0, 0.6, 0.35, 0.04, bp.color);
        _a.multiplyMatrices(torsoM, this._local(this.m[3], 0.12, 0.4, 0.2, 0, -0.5, -0.5));
        this._emit(_a, 0.3, 0, 0, 0.6, 0.35, 0.04, bp.color);
      }
    }
    // arms
    const held = p.held;
    const aimPose = held && (held.kind === 'gun') && (st === 'ground' || st === 'slide') ;
    const pitch = p.pitch || 0;
    if (aimPose) {
      const ap2 = Math.PI / 2 + pitch + lean;
      armRx = ap2; armLx = ap2 - 0.1; armRz = 0.05; armLz = -0.55;
    } else if (held && held.kind === 'pickaxe' && st === 'ground') {
      const sw = p.swing > 0 ? Math.sin((1 - p.swing) * Math.PI) * 2.2 : 0;
      armRx = 0.9 + sw + pitch * 0.5; armRz = -0.1;
    } else if (held && held.kind === 'item' && st === 'ground') {
      armRx = 1.0; armLx = 1.0 + (p.using ? Math.sin(t * 4) * 0.3 : 0); armLz = -0.4; armRz = 0.4;
    }
    const armLM = this.m[3];
    armLM.multiplyMatrices(torsoM, this._local(this.m[0], -0.31, 0.55, 0, armLx, 0, armLz));
    this._emit(armLM, 0, -0.27, 0, 0.15, 0.6, 0.15, o.top);
    this._emit(armLM, 0, -0.6, 0, 0.13, 0.12, 0.13, o.skin);
    const armRM = this.m[0];
    _a.copy(this._local(_t, 0.31, 0.55, 0, armRx, 0, armRz));
    armRM.multiplyMatrices(torsoM, _a);
    this._emit(armRM, 0, -0.27, 0, 0.15, 0.6, 0.15, o.top);
    this._emit(armRM, 0, -0.6, 0, 0.13, 0.12, 0.13, o.skin);
    // held item in right hand: local arm space points down -Y
    if (held && st !== 'skydive' && st !== 'glide' && st !== 'swim') {
      if (held.kind === 'gun') {
        const len = held.len;
        // gun along -Y of the arm (which points forward when aiming)
        this._emit(armRM, -0.05, -0.62 - len * 0.35, -0.04, 0.09, len, 0.15, held.color);
        this._emit(armRM, -0.05, -0.62 - len * 0.2, -0.13, 0.05, len * 0.25, 0.09, held.rarityColor);
      } else if (held.kind === 'pickaxe') {
        this._emit(armRM, 0, -0.66, -0.3, 0.06, 0.06, 0.8, 0x6b4a2e);
        this._emit(armRM, 0, -0.66, -0.68, 0.5, 0.1, 0.12, held.color || 0x9aa4b0);
      } else if (held.kind === 'item') {
        this._emit(armRM, 0, -0.7, -0.05, 0.16, 0.22, 0.16, held.color);
      }
    }
    // glider
    if (st === 'glide' && ap.glider) {
      _a.copy(_root);
      _t.makeTranslation(0, 2.55, 0.1);
      _a.multiply(_t);
      _t.makeRotationZ(p.bank || 0);
      _a.multiply(_t);
      this._emit(_a, 0, 0, 0, 2.6, 0.08, 1.1, ap.glider.color);
      this._emit(_a, 0, 0.05, 0.1, 2.0, 0.06, 0.4, ap.glider.color2);
      this._emit(_a, 0, -0.45, 0, 0.05, 0.9, 0.05, 0x333333);
    }
  }

  _hat(headM, o) {
    const c = o.hatColor || 0x333333;
    switch (o.hat) {
      case 'cap': this._emit(headM, 0, 0.37, 0.02, 0.36, 0.1, 0.36, c); this._emit(headM, 0, 0.33, -0.22, 0.3, 0.04, 0.16, c); break;
      case 'beanie': this._emit(headM, 0, 0.38, 0, 0.37, 0.14, 0.37, c); break;
      case 'hood': this._emit(headM, 0, 0.2, 0.03, 0.4, 0.42, 0.36, c); break;
      case 'helmet': this._emit(headM, 0, 0.24, 0.01, 0.39, 0.32, 0.38, c); this._emit(headM, 0, 0.18, -0.19, 0.3, 0.12, 0.02, o.accent); break;
      case 'crown': this._emit(headM, 0, 0.4, 0, 0.36, 0.14, 0.36, c); this._emit(headM, 0, 0.5, 0, 0.12, 0.1, 0.12, o.accent); break;
      case 'tophat': this._emit(headM, 0, 0.36, 0, 0.44, 0.04, 0.44, c); this._emit(headM, 0, 0.52, 0, 0.28, 0.3, 0.28, c); break;
      default: break;
    }
  }
}
