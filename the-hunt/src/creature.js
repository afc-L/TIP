import * as THREE from 'three';
import { clamp, damp, lerp, rand, wrapAngle, smoothstep } from './util.js';
import { makeCreature } from './models.js';
import { glowTexture } from './textures.js';

// The Keeper. It mostly does not chase you. It watches, follows, vanishes and turns up
// where it should not be. As the story and the night progress it grows bolder, and
// eventually it hunts — but light, gunfire and distance always give you a way out.

const WATCH = 'watch', STALK = 'stalk', APPEAR = 'appear', HUNT = 'hunt', ABSENT = 'absent', RETREAT = 'retreat', VANISH = 'vanish';

export class Creature {
  constructor(game) {
    this.game = game;
    const m = makeCreature();
    this.m = m;
    this.group = m.group;
    this.group.visible = false;
    game.scene.add(this.group);
    // eyes: two pale points that ignore fog, so at night all you see is them
    const eyeMat = new THREE.SpriteMaterial({ map: glowTexture('rgba(255,250,235,1)', 'rgba(255,240,200,0)'), blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true, opacity: 0.0 });
    this.eyes = [];
    for (const sx of [-1, 1]) {
      const e = new THREE.Sprite(eyeMat);
      e.scale.setScalar(0.13);
      e.position.set(sx * 0.045, 0, -0.02);
      m.eyes.add(e);
      this.eyes.push(e);
    }
    this.eyeMat = eyeMat;
    this.pos = new THREE.Vector3();
    this.yaw = 0;
    this.state = ABSENT;
    this.timer = 0;
    this.cooldown = 70; // seconds until the first possible encounter
    this.lookT = 0; // how long the player has been looking at it
    this.lightT = 0;
    this.visibleT = 0;
    this.phase = 0;
    this.speed = 0;
    this.pose = 'stand';
    this.forestCalm = 1;
    this.encounters = 0;
    this.sightings = 0;
    this.stepAcc = 0;
    this.losT = 0;
    this.los = false;
    this.flickerT = 0;
    this.retreatT = 0;
    this.relentless = 0; // seconds of forced hunting (finales)
    this.stagger = 0;
    this.lastSeenAt = -999;
    this.huntCount = 0;
    this._v = new THREE.Vector3();
    this._f = new THREE.Vector3();
  }

  get visibleInWorld() { return this.group.visible; }

  /** 0 = harmless ... 1 = lethal. Story progress, kills, night and days survived all feed it. */
  get aggression() {
    const g = this.game;
    const stageA = [0, 0.05, 0.15, 0.25, 0.35, 0.42, 0.5, 0.62, 0.7, 0.75][Math.min(g.story.stage, 9)];
    const kills = Math.min(0.2, g.story.kills * 0.03);
    const night = g.env.nightness * 0.25;
    const days = Math.min(0.15, (g.env.day - 1) * 0.05);
    return clamp(stageA + kills + night + days, 0, 1);
  }

  nearPlayer(r) {
    return this.group.visible && this.pos.distanceTo(this.game.player.pos) < r;
  }

  reset() {
    this.hide();
    this.state = ABSENT;
    this.cooldown = 70;
    this.relentless = 0;
  }

  hide() {
    this.group.visible = false;
    this.state = ABSENT;
    this.eyeMat.opacity = 0;
  }

  placeAt(x, z, faceX, faceZ) {
    const w = this.game.world;
    this.pos.set(x, w.groundAt(x, z).y, z);
    this.yaw = Math.atan2(-(faceX - x), -(faceZ - z));
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.yaw;
    this.group.visible = true;
  }

  /** Find a spot at distance [rMin, rMax] at a bearing offset from where the player looks. */
  findSpot(rMin, rMax, angMin, angMax, needLOS = true) {
    const g = this.game, p = g.player, w = g.world;
    for (let i = 0; i < 24; i++) {
      const side = rand() < 0.5 ? -1 : 1;
      const ang = p.yaw + side * (angMin + rand() * (angMax - angMin));
      const r = rMin + rand() * (rMax - rMin);
      const x = p.pos.x - Math.sin(ang) * r, z = p.pos.z - Math.cos(ang) * r;
      if (Math.abs(x) > 325 || Math.abs(z) > 325 || w.lakeEdge(x, z) > -2) continue;
      const y = w.heightAt(x, z);
      if (needLOS && !w.lineOfSight(p.pos.x, p.pos.y + 1.6, p.pos.z, x, y + 2.6, z)) continue;
      if (g.isSafeZone(x, z, 10)) continue;
      return { x, z };
    }
    return null;
  }

  // ------------------------------------------------------------ encounters

  start(type, opts = {}) {
    const g = this.game, p = g.player;
    let spot = null;
    this.lookT = 0; this.lightT = 0; this.visibleT = 0;
    this.pose = 'stand';
    switch (type) {
      case WATCH: {
        const night = g.env.nightness > 0.6;
        spot = opts.spot || this.findSpot(night ? 22 : 40, night ? 38 : 75, 0.3, 0.75);
        if (!spot) return false;
        this.timer = 20 + rand() * 15;
        this.pose = rand() < 0.3 ? 'tilt' : rand() < 0.5 ? 'crouch' : 'stand';
        break;
      }
      case STALK: {
        spot = this.findSpot(22, 32, 2.4, 3.1, false);
        if (!spot) return false;
        this.timer = 25 + rand() * 25;
        break;
      }
      case APPEAR: {
        spot = opts.spot || this.findSpot(30, 55, 0.0, 0.25);
        if (!spot) return false;
        this.timer = 12;
        this.pose = opts.pose || 'stand';
        break;
      }
      case HUNT: {
        spot = this.findSpot(40, 60, 1.2, 3.1, false);
        if (!spot) return false;
        this.timer = 70;
        this.huntCount++;
        g.audio.shriek({ x: spot.x, y: p.pos.y + 3, z: spot.z }, 0.6);
        g.ui.subtitle('Something is coming through the trees.', 4);
        break;
      }
      default: return false;
    }
    this.placeAt(spot.x, spot.z, p.pos.x, p.pos.z);
    this.state = type;
    this.encounters++;
    this.stagger = 0;
    if (type === STALK) this.group.visible = false; // heard, not seen
    return true;
  }

  vanish(withFlicker = true) {
    if (this.state === ABSENT) return;
    if (withFlicker && this.group.visible) {
      this.state = VANISH;
      this.flickerT = 0.45;
      this.game.audio.radioStatic(0.4, 0.15);
    } else this.hide();
    this.cooldown = this.nextCooldown();
  }

  nextCooldown() {
    const a = this.aggression;
    return lerp(150, 35, a) * (0.7 + rand() * 0.6);
  }

  // ------------------------------------------------------------ update

  update(dt) {
    const g = this.game;
    if (g.state !== 'play') return;
    const p = g.player;
    const a = this.aggression;
    const night = g.env.nightness;

    // calm of the forest: wildlife audio and animals drop out near the creature
    const d = this.pos.distanceTo(p.pos);
    const presence = this.state === ABSENT ? 0 : this.state === HUNT ? 1 : smoothstep(90, 25, d) * 0.9;
    this.forestCalm = damp(this.forestCalm, 1 - presence, 0.6, dt);

    if (this.relentless > 0) this.relentless -= dt;

    // director
    if (this.state === ABSENT || this.state === RETREAT) {
      this.cooldown -= dt;
      if (this.state === RETREAT) this.updateRetreat(dt);
      if (this.cooldown <= 0 && this.state === ABSENT && !g.ui.modalOpen) {
        this.chooseEncounter(a, night);
      }
      this.updateLook(dt, d);
      return;
    }
    if (this.state === VANISH) {
      this.flickerT -= dt;
      this.group.visible = Math.floor(this.flickerT * 30) % 2 === 0;
      if (this.flickerT <= 0) this.hide();
      return;
    }

    this.updateLook(dt, d);
    this.timer -= dt;
    switch (this.state) {
      case WATCH: this.updateWatch(dt, d); break;
      case STALK: this.updateStalk(dt, d); break;
      case APPEAR: this.updateAppear(dt, d); break;
      case HUNT: this.updateHunt(dt, d); break;
    }
    this.animate(dt);
  }

  chooseEncounter(a, night) {
    const g = this.game;
    if (a < 0.04) { this.cooldown = 30; return; }
    const safe = g.isSafeZone(g.player.pos.x, g.player.pos.z, 0);
    const r = rand();
    let ok = false;
    // early on it is only ever a distant, doubtful shape in the fog
    if (g.story.stage < 2) {
      const spot = this.findSpot(60, 85, 0.35, 0.8);
      ok = spot ? this.start(WATCH, { spot }) : false;
      this.cooldown = ok ? 240 : 30;
      return;
    }
    const canHunt = (a > 0.6 && night > 0.5) || this.relentless > 0 || (a > 0.82);
    if (canHunt && !safe && r < (this.relentless > 0 ? 1 : 0.45)) ok = this.start(HUNT);
    else if (r < 0.45) ok = this.start(WATCH);
    else if (r < 0.75 && a > 0.2) ok = this.start(STALK);
    else ok = this.start(APPEAR);
    if (!ok) this.cooldown = 8;
  }

  /** Tracks whether the player is looking at / lighting the creature. */
  updateLook(dt, d) {
    const g = this.game, p = g.player;
    if (!this.group.visible) { this.looking = false; return; }
    const cam = g.camera.position;
    const head = this._v.set(this.pos.x, this.pos.y + 2.4, this.pos.z);
    const to = head.clone().sub(cam);
    const dist = to.length();
    to.divideScalar(dist);
    const f = p.forward(this._f);
    const dot = to.dot(f);
    this.losT -= dt;
    if (this.losT <= 0) {
      this.losT = 0.2;
      this.los = g.world.lineOfSight(cam.x, cam.y, cam.z, head.x, head.y - 0.6, head.z) || g.world.lineOfSight(cam.x, cam.y, cam.z, head.x, head.y, head.z);
    }
    const fovCos = Math.cos(THREE.MathUtils.degToRad(g.camera.fov * 0.55));
    this.inView = this.los && dot > fovCos;
    this.looking = this.los && dot > (g.equip.aiming ? 0.997 : 0.985);
    const lit = g.equip.flashOn && this.los && dot > Math.cos(g.equip.spot.angle * 0.8) && dist < 45;
    this.lit = lit;
    if (this.looking) this.lookT += dt; else this.lookT = Math.max(0, this.lookT - dt * 0.5);
    if (lit) this.lightT += dt; else this.lightT = Math.max(0, this.lightT - dt * 0.3);
    if (this.inView) {
      this.visibleT += dt;
      if (this.visibleT > 0.15 && g.time - this.lastSeenAt > 25) {
        this.lastSeenAt = g.time;
        this.sightings++;
        g.audio.stinger(dist < 25 ? 1 : 0.6);
        p.stats.fear = Math.min(1, p.stats.fear + (dist < 25 ? 0.5 : 0.3));
        g.story.onCreatureSeen(this);
      }
    }
    // fear rises while it is in view, more when close
    if (this.inView) p.stats.fear = Math.min(1, p.stats.fear + dt * (0.05 + Math.max(0, 40 - dist) * 0.006));
    // eyes: only visible in the dark
    this.eyeMat.opacity = damp(this.eyeMat.opacity, g.env.nightness * (this.state === HUNT || this.state === WATCH || this.state === APPEAR ? 0.9 : 0), 3, dt);
  }

  updateWatch(dt, d) {
    const p = this.game.player;
    this.faceToward(p.pos.x, p.pos.z, dt, 1.5);
    // stares back. Look at it too long, light it, or get close: it is gone.
    if (this.lookT > 1.4 || this.lightT > 0.5 || d < 24 || this.timer <= 0) {
      if (this.inView) this.vanish(true);
      else this.vanish(false);
      if (d < 24 && this.game.env.nightness > 0.5) this.game.audio.growl(this.pos, 1.5, 0.6);
    }
  }

  updateStalk(dt, d) {
    const g = this.game, p = g.player;
    // keep behind the player at 18–30 m, out of sight
    const behind = p.yaw + Math.PI + Math.sin(g.time * 0.2) * 0.6;
    const want = { x: p.pos.x - Math.sin(behind) * 22, z: p.pos.z - Math.cos(behind) * 22 };
    const dx = want.x - this.pos.x, dz = want.z - this.pos.z;
    const dd = Math.hypot(dx, dz);
    const spd = Math.min(p.speed * 1.05 + 0.5, dd * 0.8, 7);
    if (dd > 0.5) {
      this.pos.x += (dx / dd) * spd * dt;
      this.pos.z += (dz / dd) * spd * dt;
      this.pos.y = g.world.heightAt(this.pos.x, this.pos.z);
      this.faceToward(want.x, want.z, dt, 4);
    }
    // footsteps that match yours — then stop a beat after you stop
    this.stepAcc += spd * dt;
    if (this.stepAcc > 1.2) {
      this.stepAcc = 0;
      if (p.speed > 0.5 || rand() < 0.2) g.audio.creatureStep(this.pos, clamp(1.4 - d / 30, 0.25, 1));
    }
    // brief glimpse: if the player whips around, it is visible for a moment and then gone
    const toC = Math.atan2(-(this.pos.x - p.pos.x), -(this.pos.z - p.pos.z));
    const facing = Math.abs(wrapAngle(toC - p.yaw)) < 0.7;
    if (facing) {
      if (!this.glimpse) {
        this.glimpse = true;
        if (rand() < 0.4 + this.aggression * 0.4 && g.world.lineOfSight(p.pos.x, p.pos.y + 1.6, p.pos.z, this.pos.x, this.pos.y + 2, this.pos.z)) {
          this.group.visible = true;
          setTimeout(() => { if (this.state === STALK) this.vanish(true); }, 260);
        } else {
          g.audio.branchSnap(this.pos, 0.8);
          this.vanish(false);
        }
      }
    } else this.glimpse = false;
    if (this.timer <= 0) {
      if (rand() < 0.5) g.audio.knock(this.pos, 3);
      else g.audio.branchSnap(this.pos, 1);
      this.vanish(false);
    }
  }

  updateAppear(dt, d) {
    const p = this.game.player;
    this.faceToward(p.pos.x, p.pos.z, dt, 2);
    if (this.lookT > 0.9 || this.lightT > 0.35 || d < 18 || this.timer <= 0) this.vanish(this.inView);
  }

  updateHunt(dt, d) {
    const g = this.game, p = g.player;
    if (this.stagger > 0) {
      this.stagger -= dt;
      this.speed = 0;
      this.pose = 'recoil';
      return;
    }
    this.pose = 'hunt';
    // light drives it back: hold the beam on it
    if (this.lightT > 2.4) {
      this.startRetreat('light');
      return;
    }
    // approach: tree to tree. Faster when unseen; slows (but doesn't stop) when watched.
    const dx = p.pos.x - this.pos.x, dz = p.pos.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    let spd = this.inView ? (this.lit ? 0.6 : 2.4) : 6.5;
    if (dist > 40) spd = 8;
    if (g.isSafeZone(p.pos.x, p.pos.z, 0) && dist < 30) { this.startRetreat('fire'); return; }
    const sway = Math.sin(g.time * 0.7) * 0.5 * clamp(dist / 20, 0, 1);
    const ang = Math.atan2(dz, dx) + sway;
    const nx = this.pos.x + Math.cos(ang) * spd * dt;
    const nz = this.pos.z + Math.sin(ang) * spd * dt;
    const np = this._v.set(nx, 0, nz);
    g.world.collide(np, 0.4, this.pos.y, this.pos.y + 3);
    this.pos.x = np.x; this.pos.z = np.z;
    this.pos.y = g.world.heightAt(this.pos.x, this.pos.z);
    this.speed = spd;
    this.faceToward(p.pos.x, p.pos.z, dt, 6);
    this.stepAcc += spd * dt;
    if (this.stepAcc > 1.6) { this.stepAcc = 0; g.audio.creatureStep(this.pos, 1); }
    if (rand() < dt * 0.25) g.audio.growl(this.pos, 1.5, 0.8);
    // fear
    p.stats.fear = Math.min(1, p.stats.fear + dt * clamp((30 - dist) / 30, 0.05, 1) * 0.4);
    g.env.darknessBoost = damp(g.env.darknessBoost, clamp((45 - dist) / 45, 0, 1) * 0.5, 1, dt);
    if (dist < 1.9) this.attack();
    if (this.timer <= 0 && this.relentless <= 0) this.startRetreat('bored');
  }

  attack() {
    const g = this.game, p = g.player;
    g.audio.shriek(this.pos, 1.2);
    g.audio.impact(1);
    const dmg = 34 + rand() * 14 + (this.relentless > 0 ? 6 : 0);
    p.hurt(dmg, this.pos.x, this.pos.z, 9);
    // it tears into you
    g.gore.screen(1);
    g.gore.spray(new THREE.Vector3(p.pos.x, p.pos.y + 1.3, p.pos.z), new THREE.Vector3(p.pos.x - this.pos.x, 0.5, p.pos.z - this.pos.z).normalize(), 30, 5);
    g.gore.pool(p.pos.x, p.pos.z, 1.1, 6);
    p.stats.fear = 1;
    g.ui.jumpscare();
    g.equip.flicker = 1.2;
    this.startRetreat('fed');
  }

  /** Called by the game when a bullet hits it. */
  shot() {
    const g = this.game;
    g.audio.shriek(this.pos, 1);
    if (this.state === HUNT) {
      this.stagger = 1.4;
      this.hits = (this.hits || 0) + 1;
      if (this.hits >= 2 || rand() < 0.5) { this.hits = 0; setTimeout(() => this.startRetreat('shot'), 900); }
    } else this.vanish(true);
    g.story.onCreatureShot();
  }

  startRetreat(reason) {
    const g = this.game;
    if (this.state !== HUNT) return;
    this.state = RETREAT;
    this.retreatT = 4;
    if (reason !== 'bored') g.audio.shriek(this.pos, 0.8);
    this.cooldown = this.relentless > 0 ? 12 + rand() * 8 : reason === 'fed' ? 110 + rand() * 60 : this.nextCooldown() + 30;
    if (reason === 'light') g.ui.subtitle('It recoils from the light.', 3);
    if (reason === 'fire') g.ui.subtitle('It will not come near the fire.', 3);
  }

  updateRetreat(dt) {
    const g = this.game, p = g.player;
    this.retreatT -= dt;
    // run away from the player, then disappear
    const dx = this.pos.x - p.pos.x, dz = this.pos.z - p.pos.z;
    const d = Math.hypot(dx, dz) || 1;
    this.pos.x += (dx / d) * 11 * dt;
    this.pos.z += (dz / d) * 11 * dt;
    this.pos.y = g.world.heightAt(this.pos.x, this.pos.z);
    this.speed = 11;
    this.pose = 'hunt';
    this.faceToward(this.pos.x + dx, this.pos.z + dz, dt, 8);
    this.animate(dt);
    g.env.darknessBoost = damp(g.env.darknessBoost, 0, 1, dt);
    if (this.retreatT <= 0 || (!this.inView && d > 30)) { this.hide(); }
  }

  faceToward(x, z, dt, rate) {
    const want = Math.atan2(-(x - this.pos.x), -(z - this.pos.z));
    this.yaw += wrapAngle(want - this.yaw) * Math.min(1, dt * rate);
  }

  // ------------------------------------------------------------ animation

  animate(dt) {
    const m = this.m;
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.yaw;
    const t = this.game.time;
    const moving = this.speed > 0.3 && this.state !== WATCH && this.state !== APPEAR;
    if (moving) this.phase += dt * (1.2 + this.speed * 0.55);
    const s = Math.sin(this.phase);
    const pose = this.pose;
    // legs
    m.legs.forEach((l, i) => {
      const sp = i ? -s : s;
      l.hip.rotation.x = moving ? sp * 0.6 : pose === 'crouch' ? -1.1 : 0;
      l.knee.rotation.x = moving ? Math.max(0, -sp) * 1.0 + 0.1 : pose === 'crouch' ? 1.9 : 0.05;
    });
    m.hips.position.y = pose === 'crouch' ? 0.95 : 1.75 + (moving ? Math.abs(s) * 0.06 : 0);
    // spine hunched when hunting, upright & still when watching
    const lean = pose === 'hunt' ? 0.45 : pose === 'crouch' ? 0.6 : pose === 'recoil' ? -0.3 : 0.08;
    m.spine.rotation.x = damp(m.spine.rotation.x, -lean, 4, dt);
    m.arms.forEach((a, i) => {
      const sp = i ? s : -s;
      if (pose === 'hunt') { a.shoulder.rotation.x = -0.9 + sp * 0.5; a.elbow.rotation.x = -0.5; }
      else if (pose === 'recoil') { a.shoulder.rotation.x = -2.2; a.elbow.rotation.x = -1.2; }
      else { a.shoulder.rotation.x = moving ? sp * 0.3 : 0.05 * Math.sin(t * 0.5 + i); a.elbow.rotation.x = -0.1; }
      a.shoulder.rotation.z = a.sx * 0.08;
    });
    // head: the tilt
    const tilt = pose === 'tilt' ? 0.75 : pose === 'hunt' ? Math.sin(t * 9) * 0.15 : 0;
    m.head.rotation.z = damp(m.head.rotation.z, tilt, 2, dt);
    m.neck.rotation.x = pose === 'hunt' ? 0.5 : pose === 'crouch' ? 0.4 : 0;
    // occasional unnatural twitch when watching
    if ((this.state === WATCH || this.state === APPEAR) && rand() < dt * 0.4) m.head.rotation.y = (rand() - 0.5) * 0.9;
    m.head.rotation.y = damp(m.head.rotation.y, 0, 0.8, dt);
  }

  /** Ray vs a capsule around the body. */
  rayHit(o, d, maxDist) {
    if (!this.group.visible || this.state === VANISH) return null;
    const cx = this.pos.x, cz = this.pos.z;
    const t = (cx - o.x) * d.x + (this.pos.y + 1.8 - o.y) * d.y + (cz - o.z) * d.z;
    if (t < 0 || t > maxDist) return null;
    const px = o.x + d.x * t, py = o.y + d.y * t, pz = o.z + d.z * t;
    const h = Math.hypot(px - cx, pz - cz);
    if (h < 0.42 && py > this.pos.y + 0.2 && py < this.pos.y + 3.3) return { dist: t };
    return null;
  }

  serialize() { return { encounters: this.encounters, sightings: this.sightings, huntCount: this.huntCount }; }
  load(d) { if (d) Object.assign(this, { encounters: d.encounters || 0, sightings: d.sightings || 0, huntCount: d.huntCount || 0 }); }
}
