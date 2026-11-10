// Shooting, projectiles, explosions, harvesting and all damage routing.
import * as THREE from 'three';
import { clamp, rand } from './util.js';
import { CONSUMABLES } from './items.js';

const _d = new THREE.Vector3();
const _o = new THREE.Vector3();
const _hit = {};
const SOUND_RADIUS = { ar: 160, burst: 160, heavy: 170, pump: 120, tac: 110, smg: 110, sniper: 300, dmr: 220, pistol: 100, revolver: 150, rocket: 220, gl: 160, minigun: 170, rail: 200 };
const HARVEST = { tree: ['wood', 9], crate: ['wood', 6], fence: ['wood', 4], rock: ['stone', 11], car: ['metal', 13], barrel: ['metal', 4], prop: ['metal', 6] };

export class Combat {
  constructor(game) {
    this.game = game;
    this.projectiles = [];
    // projectile visuals pool
    this.pool = [];
    const geo = new THREE.BoxGeometry(1, 1, 1);
    for (let i = 0; i < 48; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffaa }));
      m.visible = false;
      game.scene.add(m);
      this.pool.push(m);
    }
  }
  reset() {
    for (const p of this.projectiles) if (p.mesh) { p.mesh.visible = false; this.pool.push(p.mesh); }
    this.projectiles = [];
  }

  // Ray against all actor hitboxes
  rayActors(ox, oy, oz, dx, dy, dz, maxT, ignore) {
    let best = maxT, bestA = null, head = false;
    for (const a of this.game.actors) {
      if (!a.alive || a === ignore || a.mode === 'bus') continue;
      const cx = a.pos.x - ox, cz = a.pos.z - oz, cy = a.pos.y + 0.9 - oy;
      const tc = cx * dx + cy * dy + cz * dz;
      if (tc < -1 || tc > best + 1) continue;
      const px = cx - dx * tc, py = cy - dy * tc, pz = cz - dz * tc;
      if (px * px + py * py + pz * pz > 2.0 * 2.0) continue;
      if (a.mode === 'skydive') {
        const t = raySphere(ox, oy, oz, dx, dy, dz, a.pos.x, a.pos.y + 0.9, a.pos.z, 0.9);
        if (t >= 0 && t < best) { best = t; bestA = a; head = false; }
        continue;
      }
      const h = a.height;
      // head sphere
      const th = raySphere(ox, oy, oz, dx, dy, dz, a.pos.x, a.pos.y + h - 0.2, a.pos.z, 0.24);
      if (th >= 0 && th < best) { best = th; bestA = a; head = true; }
      // body cylinder
      const tb = rayCylinder(ox, oy, oz, dx, dy, dz, a.pos.x, a.pos.z, 0.42, a.pos.y, a.pos.y + h - 0.42);
      if (tb >= 0 && tb < best) { best = tb; bestA = a; head = false; }
    }
    return bestA ? { actor: bestA, t: best, head } : null;
  }

  muzzle(actor) {
    const eye = actor.eyeY;
    // offset to the right shoulder
    const rx = Math.cos(actor.yaw) * 0.25, rz = -Math.sin(actor.yaw) * 0.25;
    return _o.set(actor.pos.x + rx, eye - 0.1, actor.pos.z + rz);
  }

  spreadFor(actor, it) {
    let s = actor.ads ? it.adsSpread : it.hip;
    s += actor.bloom;
    const sp = actor.speed;
    if (sp > 0.5) s += Math.min(1, sp / 6) * (actor.ads ? 0.008 : 0.02);
    if (!actor.grounded) s += 0.035;
    if (actor.crouching) s *= 0.75;
    if (actor.def && actor.def.cat === 'shotgun') s = it.hip;
    return s;
  }

  fireWeapon(actor, it) {
    const g = this.game, def = it.def;
    const o = this.muzzle(actor).clone();
    const dir = actor.aimDir;
    const spread = this.spreadFor(actor, it);
    g.effects.muzzle(o.x + dir.x * 0.7, o.y + dir.y * 0.7, o.z + dir.z * 0.7, def.cat === 'explosive' ? 0xffaa55 : 0xfff2aa);
    g.audio.shot(def.snd, actor.pos, actor === g.player);
    g.soundEvent(actor, actor.pos, SOUND_RADIUS[def.snd] || 150, 'shot');
    if (actor === g.player) g.playerCtl.recoil(def.recoil * (actor.ads ? 0.6 : 1));
    else actor.recoilKick = (actor.recoilKick || 0) + def.recoil;

    if (def.projSpeed) {
      this.spawnProjectile(actor, it, o, jitter(dir, spread));
      return;
    }
    const pellets = def.pellets || 1;
    const hits = new Map();
    for (let i = 0; i < pellets; i++) {
      const d = jitter(dir, spread * (pellets > 1 ? 1 : 1));
      this.hitscan(actor, it, o, d, def.maxRange, hits);
    }
    // aggregate pellet damage per target for one damage event
    for (const info of hits.values()) {
      if (info.isActor && info.a.alive) info.a.takeDamage(info.dmg, actor, { headshot: info.head, weapon: it, type: 'bullet' });
    }
  }

  hitscan(actor, it, o, d, range, hits) {
    const g = this.game, def = it.def;
    const wh = g.phys.raycast(o.x, o.y, o.z, d.x, d.y, d.z, range, null, _hit);
    const wt = wh ? wh.t : range;
    const ah = this.rayActors(o.x, o.y, o.z, d.x, d.y, d.z, wt, actor);
    let endT = wt;
    if (ah) {
      endT = ah.t;
      const fall = falloff(def, ah.t);
      let dmg = it.dmg * fall * (ah.head ? def.head : 1);
      const key = ah.actor;
      const prev = hits.get(key) || { isActor: true, a: ah.actor, dmg: 0, head: false };
      prev.dmg += dmg; prev.head = prev.head || ah.head;
      hits.set(key, prev);
      g.effects.impact(o.x + d.x * ah.t, o.y + d.y * ah.t, o.z + d.z * ah.t, ah.actor.shield > 0 ? 0x66ccff : 0xffffff, 4);
    } else if (wh) {
      this.damageCollider(wh.c, it.dmg * (def.buildMult || 1) * (def.pellets ? 0.9 : 1), actor, false);
      g.effects.impact(wh.x, wh.y, wh.z, 0xccbb99, 3);
      if (def.pierce && wh.c) {
        // rail pierces structures: continue the ray
        const o2 = new THREE.Vector3(wh.x + d.x * 0.3, wh.y + d.y * 0.3, wh.z + d.z * 0.3);
        const rem = range - wh.t;
        if (rem > 1) this.hitscan(actor, it, o2, d, rem, hits);
      }
    }
    g.effects.tracer(o.x, o.y, o.z, o.x + d.x * endT, o.y + d.y * endT, o.z + d.z * endT, def.pierce ? 0x66e0ff : 0xffe9a0);
    this.nearMiss(actor, o, d, endT);
  }

  nearMiss(shooter, o, d, len) {
    for (const a of this.game.actors) {
      if (!a.alive || a === shooter || a.isPlayer || a.mode !== 'ground' || !a.brain) continue;
      const cx = a.pos.x - o.x, cy = a.pos.y + 1 - o.y, cz = a.pos.z - o.z;
      const t = clamp(cx * d.x + cy * d.y + cz * d.z, 0, len);
      const px = cx - d.x * t, py = cy - d.y * t, pz = cz - d.z * t;
      if (px * px + py * py + pz * pz < 16) a.brain.onShotAt(shooter);
    }
  }

  damageCollider(c, dmg, attacker, harvest) {
    if (!c || !c.obj) return;
    const o = c.obj;
    if (o.isBuild) { this.game.build.damage(o, dmg, attacker); return; }
    this.damageObject(o, dmg, attacker, harvest);
  }

  damageObject(o, dmg, attacker, harvest) {
    if (!o.alive) return 0;
    o.hp -= dmg;
    let gained = 0;
    if (harvest && attacker) {
      const hv = HARVEST[o.kind];
      let mat = hv ? hv[0] : o.mat;
      let amt = hv ? hv[1] : 7;
      if (mat === 'glass') amt = 0;
      if (mat !== 'wood' && mat !== 'stone' && mat !== 'metal') amt = 0;
      if (amt) gained = attacker.addMats(mat, Math.round(amt * rand(0.8, 1.2)));
      attacker.harvested += gained;
      if (gained) this.game.onHarvest(attacker, mat, gained);
    }
    if (o.hp <= 0) {
      this.game.world.destroyObject(o);
      const col = o.kind === 'tree' ? 0x5a8a3a : o.mat === 'stone' ? 0x9a9a9a : o.mat === 'metal' ? 0x8a96a2 : o.mat === 'glass' ? 0xbfe8ff : 0xa87a4a;
      this.game.effects.debris(o.cx, o.cy, o.cz, col, o.kind === 'tree' ? 18 : 10);
      this.game.audio.playAt(o.mat === 'glass' ? 'glass' : 'break_' + (o.mat === 'glass' ? 'wood' : o.mat), { x: o.cx, y: o.cy, z: o.cz }, 0.7);
      if (o.explosive) this.explode(o.cx, o.cy + 0.5, o.cz, 6, 75, attacker, 300);
    }
    return gained;
  }

  swingPickaxe(actor) {
    const g = this.game;
    const o = this.muzzle(actor);
    const d = actor.aimDir;
    g.audio.playAt('swing', actor.pos, 0.3);
    const range = 2.9;
    const ah = this.rayActors(o.x, o.y, o.z, d.x, d.y, d.z, range, actor);
    if (ah) {
      ah.actor.takeDamage(20, actor, { weapon: null, type: 'melee' });
      return;
    }
    // generous melee: try the aim ray, then a flattened ray
    let wh = g.phys.raycast(o.x, o.y, o.z, d.x, d.y, d.z, range, null, _hit);
    if (!wh || !wh.c) {
      const l = Math.hypot(d.x, d.z) || 1;
      wh = g.phys.raycast(o.x, o.y - 0.3, o.z, d.x / l, 0, d.z / l, range, null, _hit);
    }
    if (wh && wh.c && wh.c.obj) {
      const obj = wh.c.obj;
      g.effects.impact(wh.x, wh.y, wh.z, 0xd8c8a0, 6);
      g.audio.playAt('harvest_' + (obj.mat || 'wood'), { x: wh.x, y: wh.y, z: wh.z }, 0.6);
      g.soundEvent(actor, actor.pos, 30, 'harvest');
      if (obj.isBuild) g.build.damage(obj, 50, actor);
      else this.damageObject(obj, 50, actor, true);
      actor.lastHarvestHit = g.time;
      if (actor === g.player) g.hud.hitmarker(false, true);
    }
  }

  throwGrenade(actor, it) {
    const o = this.muzzle(actor).clone();
    const d = actor.aimDir.clone();
    d.y += 0.25; d.normalize();
    this.projectiles.push(this._proj(actor, null, o, d.multiplyScalar(26), { gravity: 22, bounce: true, fuse: 2.4, explosive: 5, dmg: CONSUMABLES.grenade.dmg, buildDmg: 350, kind: 'grenade' }));
    this.game.audio.playAt('throw', actor.pos, 0.4);
  }

  spawnProjectile(actor, it, o, d) {
    const def = it.def;
    const opts = {
      gravity: def.drop || 0,
      explosive: def.explosive || 0,
      dmg: it.dmg,
      buildDmg: def.buildDmg || it.dmg,
      bounce: !!def.bounce,
      fuse: def.bounce ? 3 : 0,
      kind: def.cat === 'explosive' ? (def.bounce ? 'grenade' : 'rocket') : 'bullet',
      head: def.head,
      maxRange: def.maxRange,
    };
    this.projectiles.push(this._proj(actor, it, o.clone(), d.clone().multiplyScalar(def.projSpeed), opts));
  }

  _proj(owner, it, pos, vel, opts) {
    const mesh = this.pool.pop() || null;
    if (mesh) {
      mesh.visible = true;
      if (opts.kind === 'rocket') { mesh.scale.set(0.18, 0.18, 0.7); mesh.material.color.set(0x556b2f); }
      else if (opts.kind === 'grenade') { mesh.scale.set(0.2, 0.2, 0.2); mesh.material.color.set(0x3d5a2a); }
      else { mesh.scale.set(0.06, 0.06, 1.4); mesh.material.color.set(0xfff0a0); }
      mesh.position.copy(pos);
    }
    return { owner, it, pos, vel, opts, mesh, life: 0, travelled: 0 };
  }

  update(dt) {
    const g = this.game;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life += dt;
      const steps = Math.ceil(Math.max(1, (p.vel.length() * dt) / 6));
      const sdt = dt / steps;
      let done = false;
      for (let s = 0; s < steps && !done; s++) {
        p.vel.y -= p.opts.gravity * sdt;
        const len = p.vel.length() * sdt;
        if (len < 1e-5) continue;
        _d.copy(p.vel).normalize();
        const wh = g.phys.raycast(p.pos.x, p.pos.y, p.pos.z, _d.x, _d.y, _d.z, len, null, _hit);
        const wt = wh ? wh.t : len;
        const ah = this.rayActors(p.pos.x, p.pos.y, p.pos.z, _d.x, _d.y, _d.z, wt, p.life < 0.15 ? p.owner : null);
        if (ah) {
          p.pos.addScaledVector(_d, ah.t);
          if (p.opts.explosive) { this.explode(p.pos.x, p.pos.y, p.pos.z, p.opts.explosive, p.opts.dmg, p.owner, p.opts.buildDmg); }
          else {
            const dmg = p.opts.dmg * (ah.head ? p.opts.head : 1);
            ah.actor.takeDamage(dmg, p.owner, { headshot: ah.head, weapon: p.it, type: 'bullet' });
            g.effects.impact(p.pos.x, p.pos.y, p.pos.z, 0xffffff, 5);
          }
          done = true; break;
        }
        if (wh) {
          if (p.opts.bounce && p.opts.fuse > 0 && p.life < p.opts.fuse) {
            p.pos.addScaledVector(_d, Math.max(0, wh.t - 0.05));
            // reflect
            const nx = wh.nx, ny = wh.ny, nz = wh.nz;
            const vn = p.vel.x * nx + p.vel.y * ny + p.vel.z * nz;
            p.vel.x -= 2 * vn * nx; p.vel.y -= 2 * vn * ny; p.vel.z -= 2 * vn * nz;
            p.vel.multiplyScalar(0.42);
            if (p.vel.length() < 1.5) p.vel.set(0, 0, 0);
            g.audio.playAt('bounce', p.pos, 0.25);
            continue;
          }
          p.pos.addScaledVector(_d, wh.t);
          if (p.opts.explosive) this.explode(p.pos.x, p.pos.y + 0.2, p.pos.z, p.opts.explosive, p.opts.dmg, p.owner, p.opts.buildDmg, wh.c);
          else {
            this.damageCollider(wh.c, p.opts.dmg, p.owner, false);
            g.effects.impact(p.pos.x, p.pos.y, p.pos.z, 0xccbb99, 4);
          }
          done = true; break;
        }
        p.pos.addScaledVector(_d, len);
        p.travelled += len;
      }
      if (!done && p.opts.fuse && p.life >= p.opts.fuse) {
        this.explode(p.pos.x, p.pos.y + 0.2, p.pos.z, p.opts.explosive, p.opts.dmg, p.owner, p.opts.buildDmg);
        done = true;
      }
      if (!done && (p.life > 8 || p.pos.y < -20 || (p.opts.maxRange && p.travelled > p.opts.maxRange))) done = true;
      if (p.opts.kind === 'rocket' && !done && Math.random() < 0.7) g.effects.smoke(p.pos.x, p.pos.y, p.pos.z);
      if (done) {
        if (p.mesh) { p.mesh.visible = false; this.pool.push(p.mesh); }
        this.projectiles.splice(i, 1);
      } else if (p.mesh) {
        p.mesh.position.copy(p.pos);
        if (p.vel.lengthSq() > 0.01) p.mesh.lookAt(p.pos.x + p.vel.x, p.pos.y + p.vel.y, p.pos.z + p.vel.z);
      }
    }
  }

  explode(x, y, z, radius, dmg, attacker, buildDmg, directCollider) {
    const g = this.game;
    g.effects.explosion(x, y, z, radius);
    g.audio.playAt('explosion', { x, y, z }, 1.0);
    g.soundEvent(attacker, { x, y, z }, 220, 'explosion');
    if (g.player && g.player.alive) {
      const d = Math.hypot(g.player.pos.x - x, g.player.pos.y - y, g.player.pos.z - z);
      g.playerCtl.shake(Math.max(0, 1 - d / 40) * 0.8);
    }
    // actors
    for (const a of g.actors) {
      if (!a.alive || a.mode === 'bus') continue;
      const d = Math.hypot(a.pos.x - x, a.pos.y + 0.9 - y, a.pos.z - z);
      if (d > radius) continue;
      if (!g.phys.lineOfSight(x, y + 0.3, z, a.pos.x, a.pos.y + 1.0, a.pos.z) && d > 1.2) continue;
      const k = 1 - (d / radius) * 0.7;
      a.takeDamage(dmg * k, attacker, { type: 'explosion' });
      if (a.mode === 'ground') { a.vel.y += 6 * k; a.vel.x += (a.pos.x - x) / (d + 0.1) * 6 * k; a.vel.z += (a.pos.z - z) / (d + 0.1) * 6 * k; a.grounded = false; }
    }
    // structures
    const list = g.phys.query(x - radius, z - radius, x + radius, z + radius, []);
    const seen = new Set();
    for (const c of list) {
      const o = c.obj;
      if (!o || seen.has(o)) continue;
      const cx = clamp(x, c.minX, c.maxX), cy = clamp(y, c.minY, c.maxY), cz = clamp(z, c.minZ, c.maxZ);
      const d = Math.hypot(cx - x, cy - y, cz - z);
      if (d > radius) continue;
      seen.add(o);
      const k = 1 - (d / radius) * 0.6;
      if (o.isBuild) g.build.damage(o, buildDmg * k, attacker);
      else this.damageObject(o, buildDmg * k * 0.7, attacker, false);
    }
  }
}

function falloff(def, t) {
  if (t <= def.range) return 1;
  return Math.max(0.5, 1 - ((t - def.range) / Math.max(1, def.maxRange - def.range)) * 0.5);
}

function jitter(dir, s) {
  if (s <= 0) return dir.clone();
  // random point in cone
  const r = Math.sqrt(Math.random()) * s;
  const a = Math.random() * Math.PI * 2;
  const up = Math.abs(dir.y) < 0.95 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const u = new THREE.Vector3().crossVectors(dir, up).normalize();
  const v = new THREE.Vector3().crossVectors(u, dir).normalize();
  return dir.clone().addScaledVector(u, Math.cos(a) * r).addScaledVector(v, Math.sin(a) * r).normalize();
}

export function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
  const lx = ox - cx, ly = oy - cy, lz = oz - cz;
  const b = lx * dx + ly * dy + lz * dz;
  const c = lx * lx + ly * ly + lz * lz - r * r;
  const disc = b * b - c;
  if (disc < 0) return -1;
  const s = Math.sqrt(disc);
  let t = -b - s;
  if (t < 0) t = -b + s;
  return t;
}
export function rayCylinder(ox, oy, oz, dx, dy, dz, cx, cz, r, y0, y1) {
  const lx = ox - cx, lz = oz - cz;
  const a = dx * dx + dz * dz;
  if (a < 1e-8) {
    if (lx * lx + lz * lz > r * r) return -1;
    const t = dy > 0 ? (y0 - oy) / dy : (y1 - oy) / dy;
    return t >= 0 ? t : -1;
  }
  const b = lx * dx + lz * dz;
  const c = lx * lx + lz * lz - r * r;
  const disc = b * b - a * c;
  if (disc < 0) return -1;
  const s = Math.sqrt(disc);
  const t0 = (-b - s) / a, t1 = (-b + s) / a;
  for (const t of [t0, t1]) {
    if (t < 0) continue;
    const y = oy + dy * t;
    if (y >= y0 && y <= y1) return t;
  }
  // caps
  if (Math.abs(dy) > 1e-6) {
    for (const yc of [y1, y0]) {
      const t = (yc - oy) / dy;
      if (t < 0) continue;
      const x = lx + dx * t, z = lz + dz * t;
      if (x * x + z * z <= r * r) return t;
    }
  }
  return -1;
}
