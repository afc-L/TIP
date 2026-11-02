import * as THREE from 'three';
import { rand, clamp, lerp, damp, wrapAngle } from './util.js';
import { makeTotemMesh } from './structures.js';
import { makeDeer, boneGeometry, vcMatFlat } from './models.js';

// The horror director's small stuff: sounds, silences, things left for you to find.
// Big encounters belong to the creature; this keeps the in-between unsettling.

export class Events {
  constructor(game) {
    this.game = game;
    this.next = 45;
    this.props = [];
    this.wrongDeer = null;
    this.log = [];
  }

  reset() {
    for (const p of this.props) this.game.scene.remove(p);
    this.props = [];
    if (this.wrongDeer) { this.game.scene.remove(this.wrongDeer.group); this.wrongDeer = null; }
    this.next = 45;
  }

  update(dt) {
    const g = this.game;
    if (g.state !== 'play') return;
    this.updateWrongDeer(dt);
    // storms: lightning
    if (g.env.w.rain > 1.2 && rand() < dt * 0.04) { g.env.flash(); g.audio.thunder(); }
    else if (g.env.w.rain > 0.8 && rand() < dt * 0.006) { g.audio.thunder(); }

    this.next -= dt;
    if (this.next > 0) return;
    const a = g.creature.aggression;
    this.next = lerp(80, 28, a) * (0.6 + rand() * 0.8);
    if (g.ui.modalOpen || g.radioBusy) return;
    this.fire(this.pick());
  }

  pick() {
    const g = this.game;
    const s = g.story.stage;
    const night = g.env.nightness;
    const opts = [
      ['snap', 3, s >= 1],
      ['knock', 3, s >= 2],
      ['silence', 2, s >= 2],
      ['totem', 2, s >= 3],
      ['carcass', 1.5, s >= 3 && night < 0.6],
      ['stampede', 1.5, s >= 2 && night < 0.6],
      ['wrongdeer', 1.5, s >= 4 && !this.wrongDeer],
      ['whisper', 1.5, s >= 5 && night > 0.5],
      ['flicker', 2, night > 0.5 && g.equip.flashOn],
      ['scream', 1, s >= 4],
      ['campfire', 1, s >= 6 && night > 0.5 && g.campfire.lit && g.distToCamp() > 90],
      ['crows', 1, night < 0.5],
    ].filter((o) => o[2]);
    if (!opts.length) return null;
    let total = opts.reduce((t, o) => t + o[1], 0);
    let r = rand() * total;
    for (const o of opts) { r -= o[1]; if (r <= 0) return o[0]; }
    return opts[0][0];
  }

  /** A point around the player, optionally out of view (behind). */
  around(rMin, rMax, behind = false, ahead = false) {
    const p = this.game.player;
    let ang;
    if (behind) ang = p.yaw + Math.PI + (rand() - 0.5) * 1.6;
    else if (ahead) ang = p.yaw + (rand() - 0.5) * 0.9;
    else ang = rand() * Math.PI * 2;
    const r = rMin + rand() * (rMax - rMin);
    const x = p.pos.x - Math.sin(ang) * r, z = p.pos.z - Math.cos(ang) * r;
    return { x, y: this.game.world.heightAt(x, z) + 1, z };
  }

  fire(type) {
    const g = this.game, au = g.audio;
    if (!type) return;
    this.log.push(type);
    switch (type) {
      case 'snap': au.branchSnap(this.around(8, 18, true), 1); break;
      case 'knock': au.knock(this.around(50, 120), 2 + Math.floor(rand() * 3)); break;
      case 'silence':
        au.silence = 1;
        g.ui.subtitle('Everything has gone quiet.', 3);
        for (const an of g.animals.list) if (!an.dead) g.animals.startFlee(an, g.player.pos.x, g.player.pos.z, 15);
        break;
      case 'whisper': au.whisper(this.around(1.5, 3, true)); g.player.stats.fear = Math.min(1, g.player.stats.fear + 0.25); break;
      case 'flicker': g.equip.flicker = 1.2 + rand(); break;
      case 'scream': au.shriek(this.around(120, 180), 0.25); break;
      case 'totem': { const p = this.around(25, 40, false, true); this.plantTotemNear(p, 0, 3); break; }
      case 'carcass': if (g.story.stage >= 4 && rand() < 0.5) this.spawnStrung(); else this.spawnCarcass(); break;
      case 'stampede': this.stampede(); break;
      case 'wrongdeer': this.spawnWrongDeer(); break;
      case 'crows': { const p = this.around(30, 60); g.animals.spawnFlock(p.x, p.z); break; }
      case 'campfire':
        g.extinguishCampfire();
        break;
    }
  }

  plantTotemNear(c, rMin, rMax) {
    const g = this.game;
    const a = rand() * Math.PI * 2, r = rMin + rand() * (rMax - rMin);
    const x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
    const m = makeTotemMesh(Math.floor(rand() * 1000), 0.9 + rand() * 0.6);
    m.position.set(x, g.world.heightAt(x, z) - 0.15, z);
    m.rotation.y = Math.atan2(g.player.pos.x - x, g.player.pos.z - z);
    g.scene.add(m);
    this.props.push(m);
    if (this.props.length > 24) g.scene.remove(this.props.shift());
  }

  spawnCarcass() {
    const g = this.game;
    const p = this.around(30, 50, false, true);
    const grp = new THREE.Group();
    const d = makeDeer(rand() < 0.5);
    d.body.rotation.z = 1.5;
    d.body.position.y = 0.3;
    d.neck.rotation.x = 1.2;
    d.group.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.multiplyScalar(0.5); o.material.color.r += 0.12; } });
    grp.add(d.group);
    const bones = new THREE.Mesh(boneGeometry(Math.floor(rand() * 99)), vcMatFlat);
    bones.position.set(0.8, 0, 0.3);
    grp.add(bones);
    grp.position.set(p.x, g.world.heightAt(p.x, p.z), p.z);
    grp.rotation.y = rand() * 6;
    g.scene.add(grp);
    this.props.push(grp);
    for (let i = 0; i < 6; i++) g.animals.blood.add(p.x + (rand() - 0.5) * 3, g.world.heightAt(p.x, p.z), p.z + (rand() - 0.5) * 3, rand() * 6, 1 + rand() * 2);
    // torn open: a wide pool, entrails dragged away, blood smeared toward the trees
    g.gore.pool(p.x, p.z, 2.2 + rand(), 2);
    g.gore.dress({ x: p.x, z: p.z, yaw: grp.rotation.y, kind: 'deer', body: d.body, group: d.group });
    const drag = rand() * Math.PI * 2;
    for (let k = 0; k < 14; k++) g.gore.splash(p.x + Math.cos(drag) * k * 0.9, p.z + Math.sin(drag) * k * 0.9, 2, 0.6, 1.4);
    g.animals.spawnFlock(p.x, p.z, 4);
  }

  /** A deer strung up by its hind legs from a branch, still dripping. */
  spawnStrung() {
    const g = this.game;
    const p = this.around(25, 40, false, true);
    const y0 = g.world.heightAt(p.x, p.z);
    const grp = new THREE.Group();
    grp.position.set(p.x, y0, p.z);
    const d = makeDeer(rand() < 0.5);
    d.group.rotation.x = Math.PI; // upside down
    d.group.position.y = 2.9;
    d.neck.rotation.x = 0.4;
    d.legs.forEach((l) => { l.hip.rotation.x = l.front ? 0.3 : -0.2; });
    d.group.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.lerp(new THREE.Color(0x5a1410), 0.7); } });
    grp.add(d.group);
    // rope and a crossbar between two posts
    const wood = new THREE.MeshLambertMaterial({ color: 0x3a3026 });
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.2, 5), wood);
    bar.rotation.z = Math.PI / 2; bar.position.y = 3.6;
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.2, 3), new THREE.MeshLambertMaterial({ color: 0x8a7a5a }));
    rope.position.set(0, 3.0, 0.4);
    grp.add(bar, rope);
    for (const sx of [-1.5, 1.5]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.8, 5), wood); post.position.set(sx, 1.85, 0); grp.add(post); }
    grp.rotation.y = rand() * 6;
    g.scene.add(grp);
    this.props.push(grp);
    g.gore.pool(p.x, p.z, 1.6, 30);
    g.gore.splash(p.x, p.z, 10, 1.2, 1.3);
    g.gore.dress({ x: p.x, z: p.z, yaw: grp.rotation.y, kind: 'deer', body: d.body, group: d.group });
    g.audio.treeCreak({ x: p.x, y: y0 + 3, z: p.z });
  }

  stampede() {
    const g = this.game, p = g.player.pos;
    const from = this.around(45, 60, true);
    const herd = g.animals.spawnHerd(from.x, from.z, 3 + Math.floor(rand() * 2));
    // they run past you, away from something behind you
    const fx = from.x + (from.x - p.x) * 0.5, fz = from.z + (from.z - p.z) * 0.5;
    herd.forEach((a) => { a.yaw = Math.atan2(-(p.x - a.x), -(p.z - a.z)); g.animals.startFlee(a, fx, fz, 10); a.alert = 1; });
    g.audio.hooves({ x: from.x, y: from.y, z: from.z }, 14);
  }

  // ------------------------------------------------------------ the deer that is not a deer

  spawnWrongDeer() {
    const g = this.game;
    const night = g.env.nightness > 0.5;
    const spot = this.around(night ? 22 : 38, night ? 32 : 60, false, true);
    if (!g.world.lineOfSight(g.player.pos.x, g.player.pos.y + 1.6, g.player.pos.z, spot.x, spot.y + 1, spot.z)) return;
    const d = makeDeer(true);
    d.group.position.set(spot.x, g.world.heightAt(spot.x, spot.z), spot.z);
    d.group.rotation.y = Math.atan2(-(g.player.pos.x - spot.x), -(g.player.pos.z - spot.z));
    // standing upright on its hind legs, front legs hanging, head cocked
    d.body.rotation.x = -1.35;
    d.body.position.y = 1.55;
    d.neck.rotation.x = 1.25;
    d.head.rotation.z = 0.6;
    d.legs.forEach((l) => { if (l.front) { l.hip.rotation.x = 1.3; l.knee.rotation.x = -0.4; } else { l.hip.rotation.x = 1.25; } });
    d.group.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.multiplyScalar(0.7); } });
    g.scene.add(d.group);
    this.wrongDeer = { ...d, t: 0, lookT: 0, x: spot.x, z: spot.z, leaving: 0 };
  }

  updateWrongDeer(dt) {
    const w = this.wrongDeer;
    if (!w) return;
    const g = this.game, p = g.player;
    w.t += dt;
    const dx = w.x - p.pos.x, dz = w.z - p.pos.z;
    const dist = Math.hypot(dx, dz);
    const f = p.forward(new THREE.Vector3());
    const dot = (dx * f.x + dz * f.z) / (dist * Math.hypot(f.x, f.z));
    if (dot > 0.985 && !w.leaving) {
      w.lookT += dt;
      if (w.lookT > 0.4 && !w.seen) { w.seen = true; g.audio.stinger(0.5); p.stats.fear = Math.min(1, p.stats.fear + 0.3); g.ui.subtitle('That deer is standing on its hind legs.', 3); }
    }
    // slow head-tracking: it keeps facing you
    w.group.rotation.y = Math.atan2(dx, dz);
    if (!w.leaving && (dist < 20 || w.lookT > 4 || w.t > 40)) {
      w.leaving = 1;
      g.audio.radioStatic(0.3, 0.12);
    }
    if (w.leaving) {
      w.leaving += dt;
      w.group.visible = Math.floor(w.leaving * 30) % 2 === 0;
      if (w.leaving > 1.4) { g.scene.remove(w.group); this.wrongDeer = null; }
    }
  }
}
