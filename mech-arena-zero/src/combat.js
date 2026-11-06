// Weapon runtime state and projectile simulation.
import * as THREE from 'three';
import { WEAPONS } from './data.js';
import { segSphere, rand, clamp } from './util.js';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _m = new THREE.Vector3();

// ---------------------------------------------------------------------------
// WeaponInstance
// ---------------------------------------------------------------------------
export class WeaponInstance {
  constructor(id, owner, slot) {
    this.id = id; this.def = WEAPONS[id]; this.owner = owner; this.slot = slot;
    this.ammo = this.def.mag || 0;
    this.heat = 0; this.overheated = false; this.reloadT = 0; this.cd = 0; this.salvoLeft = 0; this.salvoT = 0;
    this.salvoAim = new THREE.Vector3(); this.salvoTarget = null; this.coolDelay = 0;
    this.shots = 0;
  }
  get usesHeat() { return !!this.def.heat; }
  get usesAmmo() { return !!this.def.mag; }
  reload() {
    const o = this.owner;
    if (this.usesAmmo && this.ammo < this.def.mag && this.reloadT <= 0) { this.reloadT = this.def.reload * o.stats.reloadMul; return true; }
    if (this.usesHeat && this.heat > 15 && !this.overheated) { // emergency vent
      this.overheated = true; this.ventT = 0.9; this.heat = Math.max(this.heat, 60); return 'vent';
    }
    return false;
  }
  update(dt, game) {
    const o = this.owner;
    this.cd -= dt;
    if (this.reloadT > 0) { this.reloadT -= dt; if (this.reloadT <= 0) { this.ammo = this.def.mag; } }
    if (this.usesHeat) {
      this.coolDelay -= dt;
      if (this.ventT > 0) { this.ventT -= dt; this.heat = Math.max(0, this.heat - 110 * dt); if (this.ventT <= 0) { this.overheated = false; this.heat = 0; } }
      else if (this.coolDelay <= 0) this.heat = Math.max(0, this.heat - (this.overheated ? 34 : 42) * dt);
      if (this.overheated && this.heat <= 20 && !(this.ventT > 0)) this.overheated = false;
    }
    if (this.salvoLeft > 0) {
      this.salvoT -= dt;
      while (this.salvoLeft > 0 && this.salvoT <= 0) {
        this._emit(game, this.salvoAim, this.salvoTarget);
        this.salvoLeft--; this.salvoT += this.def.salvoDelay;
      }
    }
  }
  ready() {
    if (this.cd > 0 || this.salvoLeft > 0) return false;
    if (this.usesAmmo && (this.ammo <= 0 || this.reloadT > 0)) return false;
    if (this.usesHeat && this.overheated) return false;
    return true;
  }
  /** Attempt to fire toward aim point. Returns true if fired. */
  tryFire(game, aim, lockTarget) {
    if (!this.ready()) {
      if (this.usesAmmo && this.ammo <= 0 && this.reloadT <= 0) this.reloadT = this.def.reload * this.owner.stats.reloadMul;
      return false;
    }
    const o = this.owner, d = this.def;
    const rateMul = o.fireRateMul();
    this.cd = 1 / (d.rate * rateMul);
    if (this.usesAmmo) { this.ammo--; if (this.ammo <= 0) this.reloadT = d.reload * o.stats.reloadMul; }
    if (this.usesHeat && !o.buffs.overclock) {
      this.heat += d.heat * o.stats.heatMul; this.coolDelay = 0.25;
      if (this.heat >= 100) { this.heat = 100; this.overheated = true; if (o.isPlayer) game.sound('overheat', o.pos, 0.8); }
    }
    this.shots++;
    if (d.kind === 'missile') {
      this.salvoLeft = d.salvo; this.salvoT = 0; this.salvoAim.copy(aim); this.salvoTarget = lockTarget;
      this.update(0, game);
    } else this._emit(game, aim, lockTarget);
    o.model.fire(this.slot);
    return true;
  }
  _emit(game, aim, lockTarget) {
    const o = this.owner, d = this.def;
    const muzzle = o.muzzlePos(this.slot, _m);
    const dmgMul = o.damageMul();
    game.stats_shot(o, this.id);
    const spreadMul = o.spreadMul();
    if (d.kind === 'hitscan' || d.kind === 'beam') {
      _d.subVectors(aim, muzzle).normalize();
      if (d.spread) jitter(_d, d.spread * spreadMul);
      game.projectiles.hitscan(o, muzzle, _d, d, d.dmg * dmgMul);
    } else if (d.kind === 'missile') {
      _d.subVectors(aim, muzzle).normalize();
      jitter(_d, d.spread);
      _d.y += 0.25; _d.normalize();
      game.projectiles.spawn(o, muzzle, _d, d, d.dmg * dmgMul, lockTarget && lockTarget.alive ? lockTarget : null, aim);
    } else if (d.kind === 'lob') {
      game.projectiles.lob(o, muzzle, aim, d, d.dmg * dmgMul);
    } else {
      const n = d.pellets || 1;
      for (let i = 0; i < n; i++) {
        _d.subVectors(aim, muzzle).normalize();
        jitter(_d, (d.spread || 0) * (n > 1 ? 1 : spreadMul));
        game.projectiles.spawn(o, muzzle, _d, d, d.dmg * dmgMul, null, null);
      }
    }
    game.effects.muzzle(muzzle, d.color, d.kind === 'hitscan' ? 1.6 : d.pellets ? 1.4 : 1);
    game.sound(d.sound, muzzle, o.isPlayer ? 0.7 : 0.55);
  }
  status() {
    const d = this.def;
    if (this.reloadT > 0) return { label: 'RELOADING', frac: 1 - this.reloadT / (d.reload * this.owner.stats.reloadMul), warn: true };
    if (this.usesHeat) return { label: this.overheated ? 'OVERHEAT' : `${Math.round(this.heat)}%`, frac: this.heat / 100, heat: true, warn: this.overheated };
    if (this.usesAmmo) return { label: d.kind === 'missile' ? (this.salvoLeft > 0 ? 'FIRING' : 'READY') : `${this.ammo}/${d.mag}`, frac: this.ammo / d.mag, ammo: true };
    return { label: 'READY', frac: 1 };
  }
}

function jitter(v, amt) {
  if (!amt) return v;
  v.x += rand(-amt, amt); v.y += rand(-amt, amt) * 0.7; v.z += rand(-amt, amt);
  return v.normalize();
}

// ---------------------------------------------------------------------------
// Projectile system
// ---------------------------------------------------------------------------
export class ProjectileSystem {
  constructor(game) {
    this.game = game; this.list = []; this.pools = new Map();
    this.boltGeo = new THREE.BoxGeometry(1, 1, 1);
    this.ballGeo = new THREE.SphereGeometry(1, 8, 6);
    this.missileGeo = new THREE.CylinderGeometry(0.18, 0.25, 1.4, 6); this.missileGeo.rotateX(Math.PI / 2);
    this.mats = new Map();
  }
  _mat(color) {
    let m = this.mats.get(color);
    if (!m) { m = new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }); this.mats.set(color, m); }
    return m;
  }
  _mesh(shape, color) {
    const key = shape + color;
    let pool = this.pools.get(key);
    if (!pool) { pool = []; this.pools.set(key, pool); }
    let m = pool.pop();
    if (!m) {
      const geo = shape === 'bolt' ? this.boltGeo : shape === 'missile' ? this.missileGeo : this.ballGeo;
      const mat = shape === 'missile' ? (this._mmat || (this._mmat = new THREE.MeshStandardMaterial({ color: 0xcfd3d8, metalness: 0.6, roughness: 0.4 }))) : this._mat(color);
      m = new THREE.Mesh(geo, mat); m.userData.key = key; m.frustumCulled = false;
    }
    this.game.scene.add(m); m.visible = true;
    return m;
  }
  _release(p) {
    if (p.mesh) { this.game.scene.remove(p.mesh); this.pools.get(p.mesh.userData.key).push(p.mesh); p.mesh = null; }
  }

  spawn(owner, pos, dir, def, dmg, target, aimPoint) {
    const shape = def.kind === 'missile' ? 'missile' : (def.size >= 0.8 ? 'ball' : 'bolt');
    const p = {
      owner, team: owner.team, def, dmg, pos: pos.clone(), prev: pos.clone(),
      vel: dir.clone().multiplyScalar(def.speed * (def.launchSpeed || 1)), life: def.range / def.speed * 1.15 + (def.kind === 'missile' ? 1.2 : 0),
      target, aimPoint: aimPoint ? aimPoint.clone() : null, gravity: def.gravity || 0, mesh: this._mesh(shape, def.color), shape, age: 0,
    };
    const s = def.size;
    if (shape === 'bolt') p.mesh.scale.set(s * 0.5, s * 0.5, s * 6 + def.speed * 0.012);
    else if (shape === 'ball') p.mesh.scale.setScalar(s * 0.6);
    else p.mesh.scale.setScalar(1);
    p.mesh.position.copy(pos);
    this._orient(p);
    this.list.push(p);
    return p;
  }

  lob(owner, pos, aim, def, dmg) {
    const T = clamp(def.flight * (pos.distanceTo(aim) / 80), 0.8, def.flight * 1.6);
    const g = 30 * this.game.gravityMul;
    const vel = new THREE.Vector3((aim.x - pos.x) / T, (aim.y - pos.y) / T + 0.5 * g * T, (aim.z - pos.z) / T);
    const p = {
      owner, team: owner.team, def, dmg, pos: pos.clone(), prev: pos.clone(), vel, life: T + 2, target: null, gravity: g / (this.game.gravityMul || 1), lobbed: true,
      mesh: this._mesh('ball', def.color), shape: 'ball', age: 0,
    };
    p.mesh.scale.setScalar(def.size * 0.6);
    this.list.push(p);
    if (!this.game.player || owner.team !== this.game.player.team) this.game.effects.telegraph(aim.x, aim.z, def.splash, 0xff6020, T);
  }

  _orient(p) {
    if (p.shape === 'ball') return;
    _d.copy(p.vel).normalize();
    p.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), _d);
  }

  /** Instant hit along a ray. Handles pierce, crits and beam visuals. */
  hitscan(owner, origin, dir, def, dmg) {
    const game = this.game;
    const end = _b.copy(origin).addScaledVector(dir, def.range);
    let tWall = game.arena.raycast(origin, end, true);
    if (tWall < 0) tWall = 1;
    const hits = [];
    for (const t of game.targets) {
      if (!t.alive || t.team === owner.team || t.intangible) continue;
      const res = hitTest(t, origin, end);
      if (res && res.t <= tWall) hits.push({ t: res.t, target: res.target || t, crit: res.crit, weak: res.weak });
    }
    hits.sort((a, b) => a.t - b.t);
    const used = def.pierce ? hits : hits.slice(0, 1);
    let tEnd = tWall;
    if (!def.pierce && used.length) tEnd = used[0].t;
    const hitPos = _a.copy(origin).lerp(end, tEnd);
    for (const h of used) {
      const pt = origin.clone().lerp(end, h.t);
      game.applyDamage(h.target, dmg * (h.crit && def.dmgType === 'precision' ? 1.6 : 1), def.dmgType, owner, pt, { crit: h.crit && def.dmgType === 'precision', weapon: def.id, weak: h.weak });
    }
    if (def.kind === 'beam') {
      game.effects.tracer(origin, hitPos, def.color, 0.35, 0.07);
      if (Math.random() < 0.5) game.effects.impact(hitPos, def.color, 'energy', 0.5);
    } else {
      game.effects.tracer(origin, hitPos, def.color, 0.5, 0.3);
      game.effects.tracer(origin, hitPos, 0xffffff, 0.15, 0.18);
      game.effects.impact(hitPos, def.color, 'precision', 1.5);
      if (game.quality !== 'low') for (let i = 0; i < 8; i++) game.effects.trail(_d.copy(origin).lerp(hitPos, Math.random()), def.color, 0.8, 0.5);
    }
    return hitPos;
  }

  update(dt) {
    const game = this.game;
    const list = this.list;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.age += dt; p.life -= dt;
      p.prev.copy(p.pos);
      if (p.def.kind === 'missile') {
        // guidance: accelerate from launch speed, steer toward a predicted intercept with a
        // turn rate (rad/s) that tightens as the missile ages and when it is close
        const speed = Math.min(p.def.speed, p.vel.length() + p.def.speed * 1.6 * dt);
        let goal = null, tracking = false;
        if (p.target && p.target.alive && !p.target.cloaked && !p.target.removed) {
          goal = p.target.center ? p.target.center(_a) : _a.copy(p.target.pos);
          const tgo = Math.min(goal.distanceTo(p.pos) / speed, 1.5);
          if (p.target.vel) goal.addScaledVector(p.target.vel, tgo * 0.9);
          tracking = true;
        } else if (p.aimPoint) goal = p.aimPoint;
        _m.copy(p.vel).normalize();
        if (goal && p.age > 0.1) {
          _d.subVectors(goal, p.pos);
          const dist = _d.length();
          _d.divideScalar(dist || 1);
          let rate = p.def.turn * (1 + p.age * 1.2) * (tracking ? 1 : 0.8);
          if (dist < 20) rate *= 2.5;
          const ang = Math.acos(clamp(_m.dot(_d), -1, 1));
          const maxA = rate * dt;
          if (ang <= maxA || ang < 1e-4) _m.copy(_d);
          else {
            _b.crossVectors(_m, _d);
            if (_b.lengthSq() < 1e-8) _b.set(0, 1, 0);
            _m.applyAxisAngle(_b.normalize(), maxA);
          }
          // proximity fuse: burst next to the target instead of grazing past it
          if (tracking && dist < p.target.radius + 1.6) {
            this._impact(p, p.pos.clone(), p.target, false, false);
            this._release(p); list.splice(i, 1); continue;
          }
        }
        p.vel.copy(_m).multiplyScalar(speed);
        if (Math.random() < 0.7) game.effects.smokePuff(p.pos, 0.8, 0.6, 0.55, 0.5);
        game.effects.trail(p.pos, 0xffaa55, 0.9, 0.12);
      } else if (p.gravity) {
        p.vel.y -= p.gravity * game.gravityMul * dt;
        if (p.lobbed && Math.random() < 0.6) game.effects.trail(p.pos, p.def.color, 1.2, 0.3);
        else if (Math.random() < 0.4) game.effects.trail(p.pos, p.def.color, 0.8, 0.2);
      }
      p.pos.addScaledVector(p.vel, dt);
      // collisions
      let bestT = 2, bestTarget = null, crit = false, weak = false;
      const tw = game.arena.raycast(p.prev, p.pos, true);
      if (tw >= 0) bestT = tw;
      for (const t of game.targets) {
        if (!t.alive || t.team === p.team || t.intangible) continue;
        const dx = t.pos.x - p.pos.x, dz = t.pos.z - p.pos.z;
        const reach = t.radius * 2 + t.height + 10;
        if (dx * dx + dz * dz > reach * reach) continue;
        const r = hitTest(t, p.prev, p.pos);
        if (r && r.t < bestT) { bestT = r.t; bestTarget = r.target || t; crit = r.crit; weak = r.weak; }
      }
      if (bestT <= 1) {
        const hit = p.prev.clone().lerp(p.pos, bestT);
        this._impact(p, hit, bestTarget, crit, weak);
        this._release(p); list.splice(i, 1); continue;
      }
      if (p.life <= 0 || p.pos.y < -5 || Math.abs(p.pos.x) > 400 || Math.abs(p.pos.z) > 400) {
        if (p.def.splash && p.life <= 0) this._impact(p, p.pos.clone(), null, false);
        this._release(p); list.splice(i, 1); continue;
      }
      p.mesh.position.copy(p.pos);
      this._orient(p);
    }
  }

  _impact(p, pos, target, crit, weak) {
    const game = this.game, d = p.def;
    if (d.splash) {
      game.explode(pos, d.splash, p.dmg, d.dmgType, p.owner, { weapon: d.id, direct: target, color: d.color, weak });
    } else {
      if (target) {
        const mult = crit && d.dmgType === 'precision' ? 1.6 : 1;
        // scatter falloff
        let falloff = 1;
        if (d.pellets) { const dist = p.age * d.speed; falloff = clamp(1.25 - dist / d.range, 0.25, 1); }
        game.applyDamage(target, p.dmg * mult * falloff, d.dmgType, p.owner, pos, { crit: crit && d.dmgType === 'precision', weapon: d.id, weak });
      }
      game.effects.impact(pos, d.color, d.dmgType, d.pellets ? 0.6 : 1);
    }
  }

  /** Remove enemy missiles near pos (ECM). */
  destroyMissilesNear(pos, radius, team) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      if (p.team !== team && (p.def.kind === 'missile' || p.lobbed) && p.pos.distanceTo(pos) < radius) {
        this.game.effects.explosion(p.pos, 1.5, 0x88ccff, 0);
        this._release(p); this.list.splice(i, 1);
      }
    }
  }

  /** Incoming threats for AI dodging: projectiles heading toward target within time window. */
  threatsTo(target, window = 0.6) {
    let best = null;
    for (const p of this.list) {
      if (p.team === target.team) continue;
      _a.copy(target.pos); _a.y += target.height * 0.5;
      _d.subVectors(_a, p.pos);
      const sp = p.vel.length();
      const along = _d.dot(p.vel) / sp;
      if (along < 0 || along / sp > window) continue;
      const perp = Math.sqrt(Math.max(0, _d.lengthSq() - along * along));
      if (perp < target.radius * 2 + (p.def.splash || 0)) { best = p; break; }
    }
    return best;
  }

  clear() { for (const p of this.list) this._release(p); this.list.length = 0; }
  dispose() {
    this.clear();
    for (const m of this.mats.values()) m.dispose();
    this.boltGeo.dispose(); this.ballGeo.dispose(); this.missileGeo.dispose();
  }
}

/** Test segment vs target hit spheres. Returns {t, crit, target} or null. */
export function hitTest(t, p0, p1) {
  const spheres = t.hitSpheres();
  let best = null;
  for (const s of spheres) {
    const tt = segSphere(p0, p1, s.c, s.r);
    if (tt >= 0 && (!best || tt < best.t)) best = { t: tt, crit: !!s.crit, weak: !!s.weak, target: s.target || null };
  }
  return best;
}
