import * as THREE from 'three';
import { clamp, damp, lerp, rand } from './util.js';
import { makeRifle, makeHands, makeBinoculars, makeHandRadio } from './models.js';
import { glowTexture } from './textures.js';

// What the player holds: rifle (scoped, bolt action), binoculars, handheld radio.
// Plus the flashlight, which is always available on F.

export const MAG_SIZE = 5;

export class Equipment {
  constructor(game) {
    this.game = game;
    this.current = 'rifle';
    this.switching = 0;
    this.aiming = false;
    this.aimT = 0;
    this.mag = MAG_SIZE;
    this.boltT = 0;
    this.reloadT = 0;
    this.flashOn = false;
    this.flicker = 0;
    this.holdBreath = false;
    this.swayT = 0;
    this.lookLag = new THREE.Vector2();

    // viewmodel scene rendered on top of the world
    this.vmScene = new THREE.Scene();
    this.vmCam = new THREE.PerspectiveCamera(62, 1, 0.01, 10);
    this.vmHemi = new THREE.HemisphereLight(0xc0ccd8, 0x3e3c2c, 1);
    this.vmLight = new THREE.PointLight(0xfff2d8, 0, 3, 1.5);
    this.vmLight.position.set(0.1, 0.1, -0.4);
    this.vmSun = new THREE.DirectionalLight(0xffffff, 0.5);
    this.vmSun.position.set(0.3, 1, 0.4);
    this.vmScene.add(this.vmHemi, this.vmLight, this.vmSun);

    this.root = new THREE.Group();
    this.vmScene.add(this.root);
    this.rifle = new THREE.Group();
    this.rifle.add(makeRifle(), makeHands());
    this.binos = makeBinoculars();
    this.radio = makeHandRadio();
    this.root.add(this.rifle, this.binos, this.radio);
    this.rifle.scale.setScalar(0.9);
    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,230,170,1)', 'rgba(255,140,40,0)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
    this.flash.scale.setScalar(0.35);
    this.flash.position.set(0, 0.045, -0.82);
    this.rifle.add(this.flash);

    // flashlight in the world
    this.spot = new THREE.SpotLight(0xfff0d8, 0, 65, 0.48, 0.55, 1.15);
    this.spot.castShadow = false;
    this.spot.shadow.mapSize.set(512, 512);
    this.spot.shadow.camera.near = 0.3;
    this.spot.shadow.bias = -0.002;
    game.scene.add(this.spot, this.spot.target);
    // muzzle flash light in the world
    this.muzzleLight = new THREE.PointLight(0xffc070, 0, 25, 1.5);
    game.scene.add(this.muzzleLight);
    this.setShadows(game.settings);
  }

  setShadows(settings) {
    this.spot.castShadow = settings.quality === 'high' && settings.shadows;
  }

  owned(slot) {
    if (slot === 'rifle' || slot === 'binoculars') return true;
    if (slot === 'radio') return this.game.inv.has('radio');
    return false;
  }

  select(slot) {
    if (slot === this.current || !this.owned(slot) || this.reloadT > 0) return;
    this.current = slot;
    this.switching = 0.35;
    this.aiming = false;
    this.game.audio.click(1500, 0.2);
  }

  cycle(dir) {
    const order = ['rifle', 'binoculars', 'radio'].filter((s) => this.owned(s));
    const i = order.indexOf(this.current);
    this.select(order[(i + dir + order.length) % order.length]);
  }

  toggleFlashlight() {
    const st = this.game.player.stats;
    if (!this.flashOn && st.battery <= 0) {
      if (this.game.inv.take('battery')) {
        st.battery = 100;
        this.game.ui.toast('Swapped in fresh batteries');
        this.game.audio.click(1400, 0.4); this.game.audio.click(1900, 0.3, 0.2);
      } else {
        this.game.ui.toast('Flashlight batteries are dead');
        this.game.audio.dryFire();
        return;
      }
    }
    this.flashOn = !this.flashOn;
    this.game.audio.flashlight();
  }

  reload() {
    const inv = this.game.inv;
    if (this.current !== 'rifle' || this.reloadT > 0 || this.mag >= MAG_SIZE) return;
    if (inv.count('ammo') <= 0) { this.game.ui.toast('No spare rounds'); return; }
    this.reloadT = 2.4;
    this.aiming = false;
    this.game.audio.reload();
  }

  update(dt, input, t) {
    const g = this.game;
    const p = g.player;
    const st = p.stats;
    const active = g.state === 'play' && !g.ui.modalOpen && !p.climb;

    if (active) {
      if (input.hit('Digit1')) this.select('rifle');
      if (input.hit('Digit2') || input.hit('KeyB')) this.select(this.current === 'binoculars' && input.hit('KeyB') ? 'rifle' : 'binoculars');
      if (input.hit('Digit3')) this.select('radio');
      if (input.mouse.wheel && !this.aiming) this.cycle(input.mouse.wheel > 0 ? 1 : -1);
      if (input.hit('KeyF')) this.toggleFlashlight();
      if (input.hit('KeyR')) this.reload();
    }

    this.switching = Math.max(0, this.switching - dt);
    const canAim = active && this.switching <= 0 && this.reloadT <= 0 && this.current !== 'radio';
    this.aiming = canAim && input.mouse.rmb;
    this.aimT = damp(this.aimT, this.aiming ? 1 : 0, 14, dt);
    this.holdBreath = this.aiming && input.down('ShiftLeft') && st.stamina > 5;
    if (this.holdBreath) st.stamina = Math.max(0, st.stamina - 14 * dt);

    // bolt & reload timers
    if (this.boltT > 0) this.boltT -= dt;
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) {
        const need = MAG_SIZE - this.mag;
        const got = g.inv.takeUpTo('ammo', need);
        this.mag += got;
      }
    }

    // fire
    if (active && input.mouse.lmbPressed && this.switching <= 0) {
      if (this.current === 'rifle') this.fire();
    }

    // flashlight
    if (this.flashOn) {
      st.battery = Math.max(0, st.battery - dt * 0.2);
      if (st.battery <= 0) { this.flashOn = false; g.ui.toast('Flashlight died — find batteries [F to swap]'); g.audio.click(800, 0.3); }
    }
    this.flicker = Math.max(0, this.flicker - dt);
    let fl = this.flashOn ? 1 : 0;
    if (this.flashOn) {
      if (st.battery < 15) fl *= 0.55 + 0.45 * (Math.sin(t * 40) > -0.85 ? 1 : 0.1) * (st.battery / 15 + 0.3);
      if (this.flicker > 0) fl *= rand() < 0.45 ? 0.05 : 0.8;
    }
    const cam = g.camera;
    this.spot.intensity = fl * 55 * (this.aiming && this.current === 'rifle' ? 1.2 : 1);
    this.spot.angle = this.aiming ? 0.32 : 0.5;
    this.spot.position.copy(cam.position);
    const fwd = p.forward(this._f || (this._f = new THREE.Vector3()));
    // light sits slightly right/below the eye
    const right = new THREE.Vector3(Math.cos(p.yaw), 0, -Math.sin(p.yaw));
    this.spot.position.addScaledVector(right, 0.18).y -= 0.15;
    this.spot.target.position.copy(cam.position).addScaledVector(fwd, 10);
    this.vmLight.intensity = fl * 1.2;

    // muzzle flash decay
    this.flash.material.opacity = Math.max(0, this.flash.material.opacity - dt * 14);
    this.muzzleLight.intensity = Math.max(0, this.muzzleLight.intensity - dt * 400);

    // radio hiss
    if (this.current === 'radio' && active) {
      const s = g.story.radioSignal();
      g.audio.setRadioHiss(true, s);
    } else g.audio.setRadioHiss(false);

    this.updateViewmodel(dt, input, t);
  }

  fire() {
    const g = this.game, p = g.player;
    if (this.reloadT > 0 || this.boltT > 0) return;
    if (this.mag <= 0) {
      g.audio.dryFire();
      if (g.inv.count('ammo') > 0) this.reload();
      else g.ui.toast('Out of ammunition');
      return;
    }
    this.mag--;
    this.boltT = 1.0;
    g.audio.gunshot();
    setTimeout(() => g.audio.bolt(), 420);
    // spread: tiny when scoped & steady, wide from the hip
    const sway = this.currentSway();
    const spread = this.aiming ? 0.0015 : 0.035;
    const dir = p.forward(new THREE.Vector3());
    if (this.aiming) {
      // fire where the (swaying) reticle points
      const yaw = p.yaw + sway.x, pitch = p.pitch + sway.y;
      dir.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
    }
    dir.x += (rand() - 0.5) * spread; dir.y += (rand() - 0.5) * spread; dir.z += (rand() - 0.5) * spread;
    dir.normalize();
    const origin = g.camera.position.clone();
    g.onShot(origin, dir);
    p.recoil += this.aiming ? 0.05 : 0.08;
    p.trauma = Math.min(1, p.trauma + 0.15);
    this.kick = 1;
    this.flash.material.opacity = 1;
    this.flash.material.rotation = rand() * 6;
    this.muzzleLight.position.copy(origin).addScaledVector(dir, 1.2);
    this.muzzleLight.intensity = 60;
  }

  /** Breathing sway while scoped (radians). Holding breath steadies the aim. */
  currentSway() {
    const p = this.game.player;
    const t = this.swayT;
    const fear = p.stats.fear;
    const tired = 1 - p.stats.stamina / 100;
    let amp = (0.006 + tired * 0.012 + fear * 0.01 + (p.stats.health < 30 ? 0.006 : 0)) * (this.current === 'binoculars' ? 0.5 : 1);
    if (this.holdBreath) amp *= 0.15;
    if (p.speed > 0.5) amp *= 2.2;
    return { x: (Math.sin(t * 0.9) + Math.sin(t * 2.1) * 0.4) * amp, y: (Math.sin(t * 1.3 + 1) * 0.8 + Math.sin(t * 2.7) * 0.3) * amp };
  }

  updateViewmodel(dt, input, t) {
    const g = this.game, p = g.player;
    this.swayT += dt;
    const cam = g.camera;
    this.vmCam.aspect = cam.aspect;
    this.vmCam.updateProjectionMatrix();
    // hemi light mirrors the world's, with a floor so the gun is never pitch black
    this.vmHemi.color.copy(g.env.hemi.color);
    this.vmHemi.groundColor.copy(g.env.hemi.groundColor);
    this.vmHemi.intensity = Math.max(0.12, g.env.hemi.intensity * 0.8);
    this.vmSun.intensity = g.env.sun.intensity * 0.5;
    this.vmSun.color.copy(g.env.sun.color);

    this.lookLag.x = damp(this.lookLag.x, clamp(input.mouse.dx * 0.0009, -0.06, 0.06), 10, dt);
    this.lookLag.y = damp(this.lookLag.y, clamp(input.mouse.dy * 0.0009, -0.06, 0.06), 10, dt);
    this.kick = damp(this.kick || 0, 0, 10, dt);
    const bob = p.bob;
    const moveAmt = Math.min(p.speed / 6, 1) * (1 - this.aimT * 0.85);
    const sprinting = p.sinceSprint < 0.1;
    const sw = this.switching > 0 ? Math.sin((this.switching / 0.35) * Math.PI) : 0;
    const rel = this.reloadT > 0 ? Math.sin(Math.min(1, (2.4 - this.reloadT) / 2.4) * Math.PI) : 0;

    this.rifle.visible = this.current === 'rifle';
    this.binos.visible = this.current === 'binoculars';
    this.radio.visible = this.current === 'radio';
    // hide the model entirely when looking through optics
    const scoped = this.aimT > 0.85;
    this.root.visible = !(scoped && this.current !== 'radio') && g.state === 'play' && !p.dead;

    const r = this.root;
    let bx = 0.17, by = -0.2, bz = -0.5;
    if (this.current === 'binoculars') { bx = 0.0; by = -0.2; bz = -0.35; }
    if (this.current === 'radio') { bx = 0.15; by = -0.17; bz = -0.42; }
    // aim pulls the scope to the eye
    const aimX = this.current === 'rifle' ? 0 : 0, aimY = this.current === 'rifle' ? -0.1 : -0.03, aimZ = -0.2;
    r.position.set(
      lerp(bx, aimX, this.aimT) + Math.cos(bob) * 0.012 * moveAmt - this.lookLag.x,
      lerp(by, aimY, this.aimT) - Math.abs(Math.sin(bob)) * 0.016 * moveAmt + this.lookLag.y - sw * 0.25 - rel * 0.08 - (sprinting ? 0.04 : 0),
      lerp(bz, aimZ, this.aimT) + (this.kick || 0) * 0.07,
    );
    r.rotation.set(
      (this.kick || 0) * 0.12 + rel * 0.5 + (sprinting ? -0.3 : 0) + this.lookLag.y * 2,
      (sprinting ? 0.6 : 0) + this.lookLag.x * 2 + rel * 0.3,
      rel * 0.6 + Math.cos(bob) * 0.02 * moveAmt + (sprinting ? 0.25 : 0),
    );
    // idle breathing
    r.position.y += Math.sin(t * 1.6) * 0.003;
  }

  zoomFov(baseFov) {
    if (this.current === 'rifle') return lerp(baseFov, 16, this.aimT);
    if (this.current === 'binoculars') return lerp(baseFov, 11, this.aimT);
    return baseFov;
  }

  render(renderer) {
    renderer.clearDepth();
    this.vmCam.fov = 62;
    renderer.render(this.vmScene, this.vmCam);
  }
}
