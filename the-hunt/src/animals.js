import * as THREE from 'three';
import { clamp, damp, lerp, rand, wrapAngle, makeRng } from './util.js';
import { makeDeer, makeRabbit, makeCrow } from './models.js';

// Wildlife: deer herds, rabbits and crows that wander, graze, hear and see the player,
// bolt at gunshots, and leave tracks / blood trails you can follow.

const SPECIES = {
  buck: { name: 'Whitetail Buck', speed: 1.3, run: 10.5, score: 150, meat: 3, hearing: 0.8, sight: 48 },
  doe: { name: 'Whitetail Doe', speed: 1.2, run: 10, score: 100, meat: 2, hearing: 0.9, sight: 48 },
  rabbit: { name: 'Cottontail Rabbit', speed: 0, run: 7.5, score: 30, meat: 1, hearing: 1.3, sight: 25 },
};

class Decals {
  constructor(scene, color, size, max, opacity, wet = false) {
    const g = new THREE.CircleGeometry(size, 6);
    g.rotateX(-Math.PI / 2);
    g.scale(0.7, 1, 1.25);
    const opts = { color, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 };
    const mat = wet ? new THREE.MeshPhongMaterial({ ...opts, specular: 0x703030, shininess: 80 }) : new THREE.MeshLambertMaterial(opts);
    this.mesh = new THREE.InstancedMesh(g, mat, max);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    scene.add(this.mesh);
    this.max = max; this.i = 0;
    this.list = [];
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); this.v = new THREE.Vector3(); this.s = new THREE.Vector3(1, 1, 1);
  }
  add(x, y, z, yaw, scale = 1, tag = null) {
    this.m.compose(this.v.set(x, y + 0.03, z), this.q.setFromEuler(this.e.set(0, yaw, 0)), this.s.set(scale, 1, scale));
    this.mesh.setMatrixAt(this.i, this.m);
    this.list[this.i] = { x, z, tag };
    this.i = (this.i + 1) % this.max;
    this.mesh.count = Math.min(this.max, this.mesh.count + 1);
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  clear() { this.mesh.count = 0; this.i = 0; this.list = []; }
  nearest(x, z, maxD) {
    let best = null, bd = maxD;
    for (let k = 0; k < this.mesh.count; k++) {
      const it = this.list[k];
      if (!it) continue;
      const d = Math.hypot(it.x - x, it.z - z);
      if (d < bd) { bd = d; best = it; }
    }
    return best;
  }
}

export class Animals {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.flocks = [];
    this.prints = new Decals(game.scene, 0x120d09, 0.085, 600, 0.9);
    this.blood = new Decals(game.scene, 0x420504, 0.08, 800, 0.9, true);
    this.spawnT = 0;
    this.herdId = 0;
    this.kills = [];
    this.score = 0;
    this._f = new THREE.Vector3(); this._w = new THREE.Vector3();
  }

  reset() {
    for (const a of this.list) this.game.scene.remove(a.group);
    for (const f of this.flocks) for (const c of f.crows) this.game.scene.remove(c.group);
    this.list = []; this.flocks = [];
    this.prints.clear(); this.blood.clear();
  }

  // ------------------------------------------------------------ spawning

  spawn(kind, x, z, herd = null) {
    const g = this.game;
    let model;
    if (kind === 'rabbit') model = makeRabbit();
    else model = makeDeer(kind === 'buck');
    const y = g.world.heightAt(x, z);
    model.group.position.set(x, y, z);
    g.scene.add(model.group);
    const a = {
      kind, sp: SPECIES[kind], ...model, x, z, y, yaw: rand() * Math.PI * 2,
      state: 'graze', timer: 2 + rand() * 6, alert: 0, vx: 0, vz: 0, speed: 0, phase: rand() * 6,
      herd, health: 1, wounded: false, bleedT: 0, printD: 0, dead: false, harvested: false, deathT: 0,
      fleeFrom: null, target: null, neckX: 0, despawn: false, seenT: 0, hopT: 0,
    };
    model.group.rotation.y = a.yaw;
    this.list.push(a);
    return a;
  }

  spawnHerd(x, z, size = 2 + Math.floor(rand() * 3)) {
    const herd = { id: ++this.herdId, tx: x, tz: z, retarget: 0 };
    const out = [];
    for (let i = 0; i < size; i++) {
      const kind = i === 0 && rand() < 0.6 ? 'buck' : 'doe';
      out.push(this.spawn(kind, x + (rand() - 0.5) * 10, z + (rand() - 0.5) * 10, herd));
    }
    return out;
  }

  /** Objective helper: lays a hoof-print trail from (x,z) to a freshly spawned herd. */
  spawnTrackTrail(x, z) {
    const w = this.game.world;
    const ang = rand() * Math.PI * 2;
    let px = x, pz = z;
    const len = 90 + rand() * 30;
    let heading = ang;
    for (let d = 0; d < len; d += 1.4) {
      heading += (rand() - 0.5) * 0.25;
      px += Math.cos(heading) * 1.4;
      pz += Math.sin(heading) * 1.4;
      const side = (Math.floor(d / 1.4) % 2 ? 1 : -1) * 0.18;
      const yaw = -heading + Math.PI / 2;
      const ox = -Math.sin(heading) * side, oz = Math.cos(heading) * side;
      if (w.lakeEdge(px, pz) > -2) break;
      this.prints.add(px + ox, w.heightAt(px + ox, pz + oz), pz + oz, yaw, 1.5, 'trail');
    }
    const herd = this.spawnHerd(px, pz, 3);
    herd.forEach((a) => { a.state = 'graze'; a.timer = 30; a.tracked = true; });
    return { x: px, z: pz, herd };
  }

  /**
   * Somewhere 55-130 m away that the player isn't staring straight at (or is far enough
   * that the fog hides the pop-in). Deer prefer open ground: clearings and meadows.
   */
  pickSpawn(p, fwd, rMin = 55, rMax = 130) {
    const w = this.game.world;
    let best = null, bestScore = -1;
    for (let i = 0; i < 8; i++) {
      const pt = w.randomForestPoint(rand, p.x, p.z, rMin, rMax);
      const dx = pt.x - p.x, dz = pt.z - p.z, d = Math.hypot(dx, dz);
      const inView = (dx * fwd.x + dz * fwd.z) / (d * Math.hypot(fwd.x, fwd.z) || 1) > 0.55;
      if (inView && d < 95) continue;
      const score = w.openness(pt.x, pt.z) + rand() * 0.6;
      if (score > bestScore) { bestScore = score; best = pt; }
    }
    return best;
  }

  /** Fill the woods around the player right away (new game / continue / after sleeping). */
  populate() {
    const p = this.game.player.pos, fwd = this.game.player.forward(this._f);
    for (let i = 0; i < 4; i++) { const pt = this.pickSpawn(p, fwd, 45, 140); if (pt) this.spawnHerd(pt.x, pt.z, 2 + Math.floor(rand() * 3)); }
    for (let i = 0; i < 3; i++) { const pt = this.pickSpawn(p, fwd, 30, 100); if (pt) this.spawn('rabbit', pt.x, pt.z); }
  }

  maxCounts() {
    const g = this.game;
    const night = g.env.nightness;
    const calm = g.creature.forestCalm;
    const late = g.story.stage >= 6 ? 0.7 : g.story.stage >= 4 ? 0.85 : 1;
    const c = Math.max(calm, 0.3);
    return {
      deer: Math.round(lerp(14, 6, night) * c * late),
      rabbit: Math.round(lerp(6, 3, night) * c * late),
    };
  }

  // ------------------------------------------------------------ events from the player

  onGunshot(x, z) {
    for (const a of this.list) {
      if (a.dead) continue;
      const d = Math.hypot(a.x - x, a.z - z);
      if (d < 260) this.startFlee(a, x, z, 8 + rand() * 6);
    }
    for (const f of this.flocks) if (Math.hypot(f.x - x, f.z - z) < 200) this.scatterFlock(f);
  }

  startFlee(a, fx, fz, time) {
    if (a.dead) return;
    if (a.state !== 'flee' && a.kind !== 'rabbit' && rand() < 0.6) this.game.audio.deerSnort(a.group.position);
    a.state = 'flee';
    a.timer = time;
    a.fleeFrom = { x: fx, z: fz };
    a.alert = 1;
    // herd mates bolt too
    if (a.herd) for (const b of this.list) if (b.herd === a.herd && b !== a && !b.dead && b.state !== 'flee') this.startFlee(b, fx, fz, time);
  }

  /** Ray vs animal hit zones. Returns {animal, zone, dist} or null. */
  rayHit(o, d, maxDist) {
    let best = null;
    const tmp = this._w;
    for (const a of this.list) {
      if (a.harvested) continue;
      const dx = a.x - o.x, dz = a.z - o.z;
      const along = dx * d.x + dz * d.z;
      if (along < 0 || along > maxDist + 2) continue;
      const zones = a.kind === 'rabbit'
        ? [['vitals', a.body, 0.2, 0, 0.15, 0]]
        : [['head', a.head, 0.2, 0, 0, -0.12], ['vitals', a.body, 0.32, 0, -0.05, -0.32], ['body', a.body, 0.34, 0, 0, 0.1], ['body', a.body, 0.3, 0, 0, 0.55]];
      for (const [zone, obj, r, lx, ly, lz] of zones) {
        tmp.set(lx, ly, lz);
        obj.localToWorld(tmp);
        const t = (tmp.x - o.x) * d.x + (tmp.y - o.y) * d.y + (tmp.z - o.z) * d.z;
        if (t < 0 || t > maxDist) continue;
        const cx = o.x + d.x * t - tmp.x, cy = o.y + d.y * t - tmp.y, cz = o.z + d.z * t - tmp.z;
        if (cx * cx + cy * cy + cz * cz < r * r && (!best || t < best.dist)) best = { animal: a, zone, dist: t };
      }
    }
    return best;
  }

  hit(a, zone, dist) {
    const g = this.game;
    if (a.dead) return;
    const clean = zone === 'head' || zone === 'vitals' || a.kind === 'rabbit';
    if (clean) {
      this.kill(a, dist, true);
    } else if (a.wounded) {
      this.kill(a, dist, false);
    } else {
      a.wounded = true;
      a.bleedT = 25 + rand() * 25;
      a.shotDist = dist;
      this.startFlee(a, g.player.pos.x, g.player.pos.z, 999);
      g.ui.hitMarker('Wounded — follow the blood trail');
    }
  }

  kill(a, dist, clean) {
    const g = this.game;
    a.dead = true;
    a.state = 'dead';
    a.deathT = 0;
    a.killDist = dist ?? a.shotDist ?? 50;
    a.clean = clean;
    if (a.kind !== 'rabbit') g.audio.deerBleat(a.group.position);
    setTimeout(() => g.gore.pool(a.x, a.z, a.kind === 'rabbit' ? 0.45 : 1.3 + rand() * 0.6, 14), 500);
    if (dist !== undefined) g.ui.hitMarker(clean ? (a.kind === 'rabbit' ? 'Kill' : 'Clean kill') : 'Kill');
    g.story.onAnimalKilled(a);
  }

  harvest(a) {
    const g = this.game;
    if (!a.dead || a.harvested) return;
    a.harvested = true;
    const sp = a.sp;
    let pts = sp.score;
    const distBonus = Math.max(0, Math.round((a.killDist - 40) * 1.2));
    if (!a.clean) pts = Math.round(pts * 0.6);
    pts += distBonus;
    this.score += pts;
    const got = g.inv.add('meat', sp.meat);
    this.kills.push({ species: sp.name, dist: Math.round(a.killDist), clean: a.clean, pts, day: g.env.day });
    g.ui.toast(`${sp.name} — ${Math.round(a.killDist)} m${a.clean ? ' · clean kill' : ''} · +${pts} pts${got < sp.meat ? ' (backpack full)' : ''}`, 4);
    g.story.onHarvest(a);
    // remains: gutted and skinned (or just darkened with gore switched off)
    if (g.gore.on) g.gore.dress(a);
    else a.group.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.multiplyScalar(0.45); o.material.color.r += 0.08; } });
    a.removeT = 240;
  }

  nearestCarcass(x, z, r = 2.4) {
    let best = null, bd = r;
    for (const a of this.list) {
      if (!a.dead || a.harvested) continue;
      const d = Math.hypot(a.x - x, a.z - z);
      if (d < bd) { bd = d; best = a; }
    }
    return best;
  }

  // ------------------------------------------------------------ flocks

  spawnFlock(x, z, n = 5 + Math.floor(rand() * 5), perched = true) {
    const g = this.game;
    const f = { x, z, crows: [], state: perched ? 'perched' : 'flying', t: 0, dir: rand() * 6.28 };
    for (let i = 0; i < n; i++) {
      const c = makeCrow();
      const cx = x + (rand() - 0.5) * 8, cz = z + (rand() - 0.5) * 8;
      c.group.position.set(cx, g.world.heightAt(cx, cz) + 0.1, cz);
      c.group.rotation.y = rand() * 6.28;
      c.v = new THREE.Vector3();
      c.ph = rand() * 6;
      g.scene.add(c.group);
      f.crows.push(c);
    }
    if (!perched) this.scatterFlock(f, true);
    this.flocks.push(f);
    return f;
  }

  scatterFlock(f, silent = false) {
    if (f.state === 'flying') return;
    f.state = 'flying';
    f.t = 0;
    const p = this.game.player.pos;
    f.dir = Math.atan2(f.z - p.z, f.x - p.x) + (rand() - 0.5);
    for (const c of f.crows) c.v.set(Math.cos(f.dir) * (5 + rand() * 3), 3 + rand() * 3, Math.sin(f.dir) * (5 + rand() * 3));
    if (!silent) this.game.audio.wingFlaps({ x: f.x, y: this.game.world.heightAt(f.x, f.z) + 1, z: f.z });
  }

  // ------------------------------------------------------------ update

  update(dt) {
    const g = this.game;
    const p = g.player.pos;
    const w = g.world;
    // spawn / despawn
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = 2;
      const max = this.maxCounts();
      const deer = this.list.filter((a) => a.kind !== 'rabbit' && !a.dead).length;
      const rabbits = this.list.filter((a) => a.kind === 'rabbit' && !a.dead).length;
      const fwd = g.player.forward(this._f);
      const pickBehind = () => this.pickSpawn(p, fwd);
      if (deer < max.deer && rand() < 0.85) { const pt = pickBehind(); if (pt) this.spawnHerd(pt.x, pt.z, 2 + Math.floor(rand() * Math.min(3, Math.max(1, max.deer - deer - 1)))); }
      if (rabbits < max.rabbit && rand() < 0.6) { const pt = pickBehind(); if (pt) this.spawn('rabbit', pt.x, pt.z); }
      if (this.flocks.length < 2 && rand() < 0.2 && g.env.nightness < 0.5 && g.creature.forestCalm > 0.5) {
        const pt = w.randomForestPoint(rand, p.x, p.z, 40, 90);
        this.spawnFlock(pt.x, pt.z);
      }
    }

    const creature = g.creature;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const a = this.list[i];
      const d = Math.hypot(a.x - p.x, a.z - p.z);
      const keep = a.tracked || a.wounded || (a.dead && !a.harvested);
      if ((d > 230 && !keep) || a.despawn || (a.removeT !== undefined && (a.removeT -= dt) <= 0 && d > 40)) {
        g.scene.remove(a.group);
        this.list.splice(i, 1);
        continue;
      }
      this.updateAnimal(a, dt, d, creature);
    }

    for (let i = this.flocks.length - 1; i >= 0; i--) {
      const f = this.flocks[i];
      const d = Math.hypot(f.x - p.x, f.z - p.z);
      f.t += dt;
      if (f.state === 'perched') {
        if (d < 16 + g.player.noise * 0.4 || creature.nearPlayer(40)) this.scatterFlock(f);
        for (const c of f.crows) {
          c.ph += dt;
          c.wings.forEach((wg, k) => { wg.rotation.z = (k ? -1 : 1) * 0.1; });
          if (rand() < dt * 0.5) c.group.rotation.y += (rand() - 0.5) * 1.5;
          c.group.position.y = w.heightAt(c.group.position.x, c.group.position.z) + 0.1 + Math.max(0, Math.sin(c.ph * 3)) * 0.02;
        }
        if (d > 200) f.dead = true;
      } else {
        for (const c of f.crows) {
          c.ph += dt * 14;
          c.v.y = damp(c.v.y, 1.5, 0.5, dt);
          c.group.position.addScaledVector(c.v, dt);
          c.group.rotation.y = Math.atan2(-c.v.x, -c.v.z);
          c.wings.forEach((wg, k) => { wg.rotation.z = (k ? -1 : 1) * Math.sin(c.ph) * 0.9; });
        }
        if (f.t > 14) f.dead = true;
      }
      if (f.dead) {
        for (const c of f.crows) g.scene.remove(c.group);
        this.flocks.splice(i, 1);
      }
    }
  }

  updateAnimal(a, dt, distToPlayer, creature) {
    const g = this.game;
    const w = g.world;
    const pl = g.player;
    const sp = a.sp;

    if (a.dead) {
      a.deathT += dt;
      const k = Math.min(1, a.deathT * 2.5);
      if (a.kind === 'rabbit') a.body.rotation.z = k * Math.PI / 2;
      else {
        a.body.rotation.z = k * 1.45;
        a.body.position.y = lerp(1.0, 0.32, k);
        a.legs.forEach((l, i) => { l.hip.rotation.x = (i < 2 ? -0.3 : 0.3) * k; l.knee.rotation.x = 0.4 * k; });
        a.neck.rotation.x = lerp(a.neck.rotation.x, 0.6, k);
      }
      return;
    }

    // --- perception
    if (a.state !== 'flee') {
      const heard = pl.noise * sp.hearing > distToPlayer;
      const daySight = sp.sight * lerp(1, 0.45, g.env.nightness) * (pl.crouch ? 0.55 : 1);
      let seen = false;
      if (distToPlayer < daySight) {
        a.seenT -= dt;
        if (a.seenT <= 0) {
          a.seenT = 0.5;
          const fx = Math.sin(a.yaw), fz = Math.cos(a.yaw); // deer look along -forward; approximate wide FOV
          const dx = pl.pos.x - a.x, dz = pl.pos.z - a.z;
          const facing = -(dx * fx + dz * fz) / (distToPlayer || 1);
          a.canSee = facing > -0.3 && w.lineOfSight(a.x, a.y + 1.2, a.z, pl.pos.x, pl.pos.y + 1.2, pl.pos.z);
        }
        seen = a.canSee && (pl.speed > 2.2 || distToPlayer < daySight * 0.3) && !(pl.crouch && pl.speed < 0.6 && distToPlayer > 10);
      }
      const flash = g.equip.flashOn && distToPlayer < 35 && g.env.nightness > 0.5;
      if (heard || seen || flash) a.alert += dt * (heard ? 0.8 : 0.5) * (distToPlayer < 18 ? 1.8 : 1);
      else a.alert = Math.max(0, a.alert - dt * 0.35);
      if (a.alert > 0.4 && a.state !== 'alert') { a.state = 'alert'; a.timer = 3 + rand() * 4; }
      if (a.alert > 1.8) this.startFlee(a, pl.pos.x, pl.pos.z, 6 + rand() * 6);
      // the forest empties when the Keeper is close
      if (creature.visibleInWorld && Math.hypot(creature.pos.x - a.x, creature.pos.z - a.z) < 45) this.startFlee(a, creature.pos.x, creature.pos.z, 20);
    }

    // --- behaviour
    let tx = 0, tz = 0, spd = 0;
    a.timer -= dt;
    switch (a.state) {
      case 'graze':
        if (a.timer <= 0) {
          a.state = 'walk';
          a.timer = 3 + rand() * 6;
          const h = a.herd;
          if (h && (h.retarget -= 1) <= 0) { h.tx = a.x + (rand() - 0.5) * 40; h.tz = a.z + (rand() - 0.5) * 40; h.retarget = 3; }
          a.target = h ? { x: h.tx + (rand() - 0.5) * 8, z: h.tz + (rand() - 0.5) * 8 } : { x: a.x + (rand() - 0.5) * 20, z: a.z + (rand() - 0.5) * 20 };
        }
        break;
      case 'walk':
        if (a.target) {
          tx = a.target.x - a.x; tz = a.target.z - a.z;
          const dd = Math.hypot(tx, tz);
          if (dd < 1 || a.timer <= 0) { a.state = 'graze'; a.timer = 4 + rand() * 8; }
          spd = sp.speed;
        }
        if (a.kind === 'rabbit') spd = 0;
        break;
      case 'alert':
        // freeze and stare at the player
        tx = pl.pos.x - a.x; tz = pl.pos.z - a.z;
        spd = 0;
        if (a.timer <= 0) { a.state = 'graze'; a.timer = 3 + rand() * 4; a.alert *= 0.5; }
        break;
      case 'flee': {
        const f = a.fleeFrom || pl.pos;
        tx = a.x - f.x; tz = a.z - f.z;
        // swerve a little
        const ang = Math.atan2(tz, tx) + Math.sin(a.phase * 0.3) * 0.4;
        tx = Math.cos(ang); tz = Math.sin(ang);
        spd = a.wounded ? sp.run * 0.55 : sp.run;
        if (a.timer <= 0 && !a.wounded) { a.state = 'walk'; a.timer = 4; a.alert = 0.3; a.target = { x: a.x + tx * 30, z: a.z + tz * 30 }; }
        if (a.wounded && Math.hypot(a.x - pl.pos.x, a.z - pl.pos.z) > 70) spd *= 0.4; // tiring
        break;
      }
    }
    if (a.wounded) {
      a.bleedT -= dt;
      if (a.bleedT <= 0) { this.kill(a, undefined, false); return; }
    }
    if (a.kind === 'rabbit' && a.state === 'graze' && rand() < dt * 0.2) { a.hopT = 0.6; a.yaw += (rand() - 0.5) * 2; }

    // --- steering
    if (tx || tz) {
      const want = Math.atan2(-tx, -tz); // model faces -z
      a.yaw += wrapAngle(want - a.yaw) * Math.min(1, dt * (a.state === 'flee' ? 5 : 2));
    }
    if (a.kind === 'rabbit' && a.hopT > 0) { a.hopT -= dt; spd = Math.max(spd, 2.2); }
    a.speed = damp(a.speed, spd, a.state === 'flee' ? 4 : 3, dt);
    const fx = -Math.sin(a.yaw), fz = -Math.cos(a.yaw);
    const ox = a.x, oz = a.z;
    const nx = a.x + fx * a.speed * dt, nz = a.z + fz * a.speed * dt;
    const pos = this._w.set(nx, 0, nz);
    w.collide(pos, a.kind === 'rabbit' ? 0.15 : 0.45, a.y, a.y + 1.5);
    if (w.lakeEdge(pos.x, pos.z) > -1) { pos.x = ox; pos.z = oz; a.yaw += 1.2; }
    // stuck against something while fleeing → turn
    if (a.speed > 2 && Math.hypot(pos.x - nx, pos.z - nz) > a.speed * dt * 0.5) a.yaw += (rand() < 0.5 ? 1 : -1) * dt * 6;
    a.x = pos.x; a.z = pos.z;
    a.y = w.heightAt(a.x, a.z);
    a.group.position.set(a.x, a.y, a.z);
    a.group.rotation.y = a.yaw;

    // tracks & blood
    const moved = Math.hypot(a.x - ox, a.z - oz);
    a.printD += moved;
    if (a.kind !== 'rabbit' && a.printD > (a.state === 'flee' ? 2.2 : 1.3)) {
      a.printD = 0;
      a.side = -(a.side || 1);
      const sx = Math.cos(a.yaw) * 0.16 * a.side, sz = -Math.sin(a.yaw) * 0.16 * a.side;
      this.prints.add(a.x + sx, a.y, a.z + sz, a.yaw, a.state === 'flee' ? 1.5 : 1.2, 'deer');
      if (a.wounded) {
        if (rand() < 0.25) g.gore.spray(new THREE.Vector3(a.x, a.y + 0.9, a.z), new THREE.Vector3(-Math.sin(a.yaw), 0.3, -Math.cos(a.yaw)), 4, 2);
        for (let k = 0; k < 4; k++) {
          const bx = a.x + (rand() - 0.5) * 0.6, bz = a.z + (rand() - 0.5) * 0.6;
          this.blood.add(bx, w.heightAt(bx, bz), bz, rand() * 6, 0.8 + rand() * 1.2, 'blood');
        }
      }
    }

    // --- animation
    if (a.kind === 'rabbit') {
      a.phase += dt * a.speed * 4;
      a.body.position.y = Math.abs(Math.sin(a.phase)) * 0.12 * Math.min(1, a.speed);
      return;
    }
    const run = a.speed > 4;
    a.phase += dt * (run ? a.speed * 1.15 : a.speed * 3.6);
    const amp = run ? 0.75 : Math.min(1, a.speed) * 0.45;
    a.legs.forEach((l, i) => {
      // walk: diagonal pairs; run: gallop (front pair vs back pair)
      const off = run ? (l.front ? 0 : Math.PI * 0.8) + (i % 2) * 0.3 : (i === 0 || i === 3 ? 0 : Math.PI);
      const s = Math.sin(a.phase + off);
      l.hip.rotation.x = s * amp;
      l.knee.rotation.x = (l.front ? -1 : 1) * Math.max(0, -s) * amp * 0.9;
    });
    a.body.position.y = 1.0 + (run ? Math.abs(Math.sin(a.phase)) * 0.12 : 0);
    a.body.rotation.x = run ? Math.sin(a.phase) * 0.08 : 0;
    const neckTarget = a.state === 'graze' && a.speed < 0.2 ? 1.05 : a.state === 'alert' ? -0.25 : run ? 0.25 : 0.15;
    a.neck.rotation.x = damp(a.neck.rotation.x, neckTarget, 3, dt);
    if (a.state === 'alert') {
      const dx = pl.pos.x - a.x, dz = pl.pos.z - a.z;
      a.neck.rotation.y = clamp(wrapAngle(Math.atan2(-dx, -dz) - a.yaw), -1, 1);
    } else a.neck.rotation.y = damp(a.neck.rotation.y, 0, 3, dt);
    if (a.state === 'graze' && a.speed < 0.2) a.head.rotation.x = Math.sin(performance.now() / 300 + a.phase) * 0.1;
  }

  /** For the binoculars: the animal nearest the view ray. */
  identify(o, d, maxDist) {
    let best = null, bestScore = 0.012;
    for (const a of this.list) {
      if (a.harvested) continue;
      const dx = a.x - o.x, dy = a.y + 0.9 - o.y, dz = a.z - o.z;
      const dist = Math.hypot(dx, dy, dz);
      if (dist > maxDist) continue;
      const dot = (dx * d.x + dy * d.y + dz * d.z) / dist;
      const off = 1 - dot;
      if (off < bestScore) { bestScore = off; best = { a, dist }; }
    }
    return best;
  }

  serialize() { return { kills: this.kills, score: this.score }; }
  load(d) { if (d) { this.kills = d.kills || []; this.score = d.score || 0; } }
}
