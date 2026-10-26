// Player movement, dodge, sprint and model animation.
import * as THREE from 'three';
import type { CharacterId, StatBlock } from '../../data/types';
import { CONFIG } from '../GameConfig';
import { input } from '../Input';
import { animateRig, buildCharacter, type CharacterRig } from '../models/characterModels';
import { damp } from '../util';
import type { World } from '../world/World';

const P = CONFIG.player;

export class Player {
  x = 0;
  z = 0;
  vx = 0;
  vz = 0;
  radius = P.radius;
  alive = true;
  hp: number;
  facing = 0;            // radians, direction (cos, sin)
  aimAngle = 0;
  moveAmount = 0;
  invuln = 0;            // generic invulnerability timer
  hurtFlash = 0;
  dodgeT = 0;
  dodgeCd = 0;
  dodgeDx = 0;
  dodgeDz = 0;
  stamina: number = P.staminaMax;
  attackAnim = 0;
  lunge: { dx: number; dz: number; speed: number; t: number; onEnd?: () => void } | null = null;
  friction = 1;          // < 1 on ice: slower acceleration and braking
  dashMult = 1;
  dodgeCooldownMult = 1;
  knockX = 0;
  knockZ = 0;
  deathT = 0;
  rig: CharacterRig;
  shadow: THREE.Mesh;
  shieldMesh: THREE.Mesh;
  private animTime = 0;

  constructor(scene: THREE.Scene, character: CharacterId, maxHp: number, tint?: string) {
    this.hp = maxHp;
    this.rig = buildCharacter(character, tint);
    scene.add(this.rig.root);
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.75, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.04;
    scene.add(this.shadow);
    this.shieldMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4, 1), new THREE.MeshBasicMaterial({ color: '#90e0ef', transparent: true, opacity: 0.25, depthWrite: false, wireframe: true }));
    this.shieldMesh.visible = false;
    scene.add(this.shieldMesh);
  }

  get dodging() { return this.dodgeT > 0; }
  get invulnerable() { return this.invuln > 0 || this.dodgeT > 0 || this.deathT > 0; }

  tryDodge(): boolean {
    if (this.dodgeCd > 0 || this.lunge || !this.alive) return false;
    let dx = input.state.moveX, dz = input.state.moveZ;
    if (Math.hypot(dx, dz) < 0.1) { dx = Math.cos(this.facing); dz = Math.sin(this.facing); }
    const l = Math.hypot(dx, dz) || 1;
    this.dodgeDx = dx / l; this.dodgeDz = dz / l;
    this.dodgeT = P.dodgeDuration * this.dashMult;
    this.dodgeCd = P.dodgeCooldown * this.dodgeCooldownMult;
    this.invuln = Math.max(this.invuln, P.dodgeInvulnerability);
    return true;
  }

  update(dt: number, stats: StatBlock, world: World, aim: { x: number; z: number } | null) {
    this.dodgeCd = Math.max(0, this.dodgeCd - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 4);
    this.attackAnim = Math.max(0, this.attackAnim - dt * 4);

    if (!this.alive) {
      this.deathT += dt;
      const t = Math.min(1, this.deathT / 0.6);
      this.rig.root.rotation.z = t * (Math.PI / 2);
      this.rig.root.position.y = 0.3 * t;
      return;
    }

    let mx = input.state.moveX, mz = input.state.moveZ;
    const moving = Math.hypot(mx, mz) > 0.05;
    let speed = stats.moveSpeed;
    if (input.state.sprint && moving && this.stamina > 0) {
      speed *= P.sprintMult;
      this.stamina = Math.max(0, this.stamina - dt);
    } else {
      this.stamina = Math.min(P.staminaMax, this.stamina + dt * P.staminaRegen * (moving ? 0.6 : 1));
    }

    if (this.lunge) {
      const l = this.lunge;
      this.vx = l.dx * l.speed; this.vz = l.dz * l.speed;
      l.t -= dt;
      this.facing = Math.atan2(l.dz, l.dx);
      if (l.t <= 0) { this.lunge = null; l.onEnd?.(); }
    } else if (this.dodgeT > 0) {
      this.dodgeT -= dt;
      this.vx = this.dodgeDx * P.dodgeSpeed; this.vz = this.dodgeDz * P.dodgeSpeed;
    } else {
      const k = damp((moving ? 16 : 12) * this.friction, dt);
      this.vx += (mx * speed - this.vx) * k;
      this.vz += (mz * speed - this.vz) * k;
      if (moving) this.facing = Math.atan2(mz, mx);
      else if (aim) this.facing = Math.atan2(aim.z - this.z, aim.x - this.x);
    }
    // knockback from big hits decays quickly
    this.knockX *= Math.exp(-8 * dt);
    this.knockZ *= Math.exp(-8 * dt);

    this.x += (this.vx + this.knockX) * dt;
    this.z += (this.vz + this.knockZ) * dt;
    world.resolve(this, this.radius);

    this.aimAngle = aim ? Math.atan2(aim.z - this.z, aim.x - this.x) : this.facing;
    mx = this.vx; mz = this.vz;
    const sp = Math.hypot(mx, mz);
    this.moveAmount += (Math.min(1, sp / 5) - this.moveAmount) * damp(10, dt);
    this.animTime += dt * (0.6 + Math.min(1.4, sp / 6));
  }

  render(time: number, shield: boolean) {
    const r = this.rig;
    r.root.position.set(this.x, this.alive ? 0 : r.root.position.y, this.z);
    // models face +Z; facing angle is measured in the XZ plane from +X
    const target = Math.PI / 2 - this.facing;
    let d = target - r.root.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    r.root.rotation.y += d * 0.35;
    if (this.alive) {
      const dodge = this.dodgeT > 0 ? 1 : 0;
      animateRig(r, this.animTime, this.moveAmount, this.attackAnim, dodge);
      if (dodge) r.body.rotation.x = (1 - this.dodgeT / P.dodgeDuration) * Math.PI * 2;
    }
    const flash = this.hurtFlash > 0 ? this.hurtFlash : 0;
    const blink = this.invuln > 0 && this.dodgeT <= 0 && Math.floor(time * 20) % 2 === 0;
    for (const m of r.materials) {
      m.emissive.setRGB(flash, flash * 0.15, flash * 0.1);
      if (this.dodgeT > 0) m.emissive.setRGB(0.25, 0.4, 0.5);
    }
    r.root.visible = !blink || !this.alive;
    this.shadow.position.set(this.x, 0.04, this.z);
    this.shieldMesh.visible = shield;
    if (shield) {
      this.shieldMesh.position.set(this.x, 1.1, this.z);
      this.shieldMesh.rotation.y = time * 1.5;
      this.shieldMesh.rotation.x = time * 0.7;
    }
  }

  dispose() {
    this.rig.root.removeFromParent();
    this.shadow.removeFromParent();
    this.shieldMesh.removeFromParent();
    this.rig.root.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => x.dispose());
    });
  }
}
