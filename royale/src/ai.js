// AI opponents. Every AI is hostile to everyone. Personalities (aggressive, balanced, strategic, defensive,
// highly-skilled) and difficulty change how they perceive, decide, aim and build — not who they fight.
// They only know what they can see (vision cone + line of sight + detection time) or hear (gunshots,
// footsteps, building, chests), plus what anyone knows: the map and the storm.
import * as THREE from 'three';
import { PROFILES, DIFFICULTY, BW, BH, MOVE } from './config.js';
import { clamp, rand, chance, yawTo, angleDiff, dirFromYawPitch, pick, lerp } from './util.js';
import { weaponRating, WEAPONS } from './items.js';
import { POIS, HIDDEN } from './layout.js';
import { dirFromYaw, DIRS, EDIT_WINDOW, EDIT_DOOR, FULL_WALL } from './building.js';

const DIR_YAW = [-Math.PI / 2, Math.PI / 2, Math.PI, 0];
const _v = new THREE.Vector3();
const _hit = {};
let ROUND = 0;

export class AIBrain {
  constructor(game, actor, profileName, diffName) {
    this.game = game;
    this.a = actor;
    actor.brain = this;
    this.profileName = profileName;
    const P = PROFILES[profileName], D = DIFFICULTY[diffName];
    const j = () => rand(0.88, 1.12);       // individual variation
    this.p = {
      aggression: clamp(P.aggression * D.aggr * j(), 0, 1.3),
      caution: clamp(P.caution * j(), 0, 1),
      aim: clamp(P.aim * D.aim * j(), 0.2, 1.25),
      react: P.react * D.react * j(),
      build: clamp(P.build * D.build * j(), 0, 1.3),
      edit: clamp(P.edit * D.build, 0, 1.2),
      awareness: P.awareness * D.aware * j(),
      greed: P.greed * j(),
      thirdParty: P.thirdParty,
      range: P.range,
      hotDrop: P.hotDrop,
      harvest: P.harvest,
      patience: P.patience,
      retreatAt: P.retreatAt,
      decision: D.decision,
    };
    this.known = new Map();
    this.fightNoises = [];
    this.goal = 'loot';
    this.goalScore = 0;
    this.target = null;
    this.dest = null;
    this.lootTarget = null;
    this.chestMemory = new Set();    // chests seen opened
    this.badTargets = new Map();     // unreachable loot -> expiry
    this.thinkT = rand(0, 0.5);
    this.percT = rand(0, 0.3);
    this.strafeT = 0; this.strafeDir = 1;
    this.aimErr = new THREE.Vector3(); this.aimErrT = 0; this.aimErrTarget = new THREE.Vector3();
    this.stuckT = 0; this.lastPos = new THREE.Vector3(); this.progressT = 0;
    this.detour = null;
    this.harvestTarget = null;
    this.underFireT = -99;
    this.spottedT = -99;
    this.buildSeq = null;
    this.boxed = null;
    this.editPiece = null; this.editT = 0;
    this.interactT = 0;
    this.switchCd = 0;
    this.jumpT = rand(1, 3);
    this.crouchT = 0;
    this.drop = null;
    this.holdSpot = null;
    this.fortBuilt = false;
    this.investigate = null;
    this.healDelay = 0;
    this.lastSeenEnemyT = -99;
    this.wantReload = false;
    this.tapT = 0;
  }

  get lodRate() { return this.a.lod === 0 ? 1 : this.a.lod === 1 ? 2.2 : 4.5; }

  // ===================== bus / landing =====================
  planDrop() {
    const g = this.game, bus = g.bus, storm = g.storm;
    const cands = [];
    for (const p of POIS) cands.push({ id: p.id, x: p.x, z: p.z, loot: p.loot, hot: p.hot, r: p.r });
    for (const h of HIDDEN) cands.push({ id: h.id, x: h.x, z: h.z, loot: 0.7, hot: 0.2, r: 15 });
    // lone buildings: grouped chest spots with no poi
    const lone = g.world.chestSpots.filter((c) => !c.poi);
    for (let i = 0; i < lone.length; i += 2) cands.push({ id: 'lone' + i, x: lone[i].x, z: lone[i].z, loot: 0.3, hot: 0.05, r: 10 });
    const p = this.p;
    let best = null, bestW = -1;
    for (const c of cands) {
      const s = bus.closestAlong(c.x, c.z);
      const px = bus.start_.x + bus.dir.x * s, pz = bus.start_.z + bus.dir.z * s;
      const perp = Math.hypot(c.x - px, c.z - pz);
      if (s < 0 || s > bus.length) continue;
      let w = Math.pow(c.loot, 1.4);
      w *= lerp(1, 0.4 + c.hot * 3, p.hotDrop);
      w *= Math.max(0.03, 1 - perp / 520);
      const crowd = g.dropCounts[c.id] || 0;
      // how many players this place can realistically feed
      if (!g.dropCapacity) g.dropCapacity = {};
      if (g.dropCapacity[c.id] === undefined) g.dropCapacity[c.id] = Math.max(2, g.world.chestSpots.filter((s) => s.poi === c.id).length * 0.9);
      if (crowd >= g.dropCapacity[c.id]) w *= 0.08;
      w *= p.hotDrop > 0.6 ? 1 + Math.min(crowd, 10) * 0.03 : 1 / (1 + crowd * (0.35 + p.caution * 0.7));
      if (crowd > 16) w *= 0.3;
      if (!storm.inNext(c.x, c.z, -200)) w *= 0.4;
      w *= rand(0.4, 1.6);
      if (w > bestW) { bestW = w; best = { ...c, s, perp }; }
    }
    if (!best) best = { id: 'any', x: g.bus.pos.x, z: g.bus.pos.z, s: g.bus.length * 0.5, perp: 0, r: 50 };
    g.dropCounts[best.id] = (g.dropCounts[best.id] || 0) + 1;
    // choose a specific chest spot / building in that area
    const spots = g.world.chestSpots.filter((c) => Math.hypot(c.x - best.x, c.z - best.z) < (best.r || 30) + 10 && c.y - g.terrain.heightAt(c.x, c.z) < 12);
    const spot = spots.length ? pick(spots) : { x: best.x + rand(-20, 20), y: 0, z: best.z + rand(-20, 20) };
    const jitter = (best.r || 20) > 20 ? 4 : 1;
    this.drop = { x: spot.x + rand(-jitter, jitter), z: spot.z + rand(-jitter, jitter), y: spot.y, poi: best.id, s: best.s, perp: best.perp };
    // jump moment along the route (distance travelled), leaving glide distance for the perpendicular offset
    const lead = Math.max(0, best.perp < 150 ? rand(0, 60) : rand(-30, 40));
    this.drop.jumpAt = clamp(best.s - lead - (best.perp < 120 ? rand(40, 120) : 0), bus.doorsOpenAt * bus.speed + 10, bus.length - 50);
  }

  updateBus() {
    const bus = this.game.bus;
    if (!bus.doorsOpen) return;
    const travelled = bus.t * bus.speed;
    if (travelled >= this.drop.jumpAt || bus.progress > 0.96) this.a.jumpFromBus();
  }

  updateAir(dt) {
    const a = this.a, d = this.drop, inp = a.input;
    const dx = d.x - a.pos.x, dz = d.z - a.pos.z;
    const hd = Math.hypot(dx, dz);
    const h = a.pos.y - (d.y || 0);
    if (hd > 2) { inp.mx = dx / hd; inp.mz = dz / hd; } else { inp.mx = inp.mz = 0; }
    if (a.mode === 'skydive') {
      // dive when the target is closer than our glide reach, otherwise glide far
      const reach = h * (MOVE.skydiveH / MOVE.skydiveV) * 0.9;
      inp.dive = hd < reach * 0.55 ? 1 : hd < reach ? 0.4 : 0;
      if (hd < 30) inp.dive = 1;
      inp.deploy = false;
    } else {
      inp.dive = hd < 12 ? 1 : 0;
      if (hd < 3) { inp.mx = inp.mz = 0; }
    }
  }

  // ===================== perception =====================
  know(t) {
    let k = this.known.get(t);
    if (!k) {
      k = { actor: t, pos: t.pos.clone(), vel: new THREE.Vector3(), seenT: -99, heardT: -99, aw: 0, visible: false, dmgDealt: 0, dmgTaken: 0, firstSeenT: -99, estHp: 175 };
      this.known.set(t, k);
    }
    return k;
  }

  perceive(dtp) {
    const g = this.game, a = this.a;
    const now = g.time;
    const eyeY = a.eyeY;
    const range = 100 * this.p.awareness;
    const fovCos = Math.cos((150 * Math.PI / 180) / 2);
    // occasional shoulder checks: perception looks around even while the body faces its path
    this.glanceT = (this.glanceT ?? rand(1, 4)) - dtp;
    if (this.glanceT <= 0) {
      this.glanceT = rand(2.5, 6) / this.p.awareness;
      this.glanceOff = (chance(0.5) ? 1 : -1) * rand(1.6, 3.14);
      this.glanceUntil = now + rand(0.5, 1.0);
    }
    const lookYaw = a.yaw + (now < (this.glanceUntil || 0) ? this.glanceOff : 0);
    const fx = -Math.sin(lookYaw), fz = -Math.cos(lookYaw);
    // candidate list sorted by distance (cap LOS checks)
    const cands = this._cands || (this._cands = []);
    cands.length = 0;
    for (const t of g.actors) {
      if (t === a || !t.alive || t.mode === 'bus') continue;
      const dx = t.pos.x - a.pos.x, dz = t.pos.z - a.pos.z;
      const d2 = dx * dx + dz * dz;
      const rr = t.airborne ? range * 1.6 : range;
      if (d2 > rr * rr) continue;
      cands.push({ t, d2, dx, dz });
    }
    cands.sort((p, q) => p.d2 - q.d2);
    for (const k of this.known.values()) k.visible = false;
    const maxChecks = a.lod === 0 ? 5 : 3;
    for (let i = 0; i < cands.length && i < maxChecks; i++) {
      const { t, d2, dx, dz } = cands[i];
      const d = Math.sqrt(d2);
      const dot = (dx * fx + dz * fz) / (d || 1);
      const peripheral = d < 14;
      if (dot < fovCos && !peripheral && !t.airborne) continue;
      const ty = t.pos.y + (t.crouching ? 0.8 : 1.2);
      if (!g.phys.lineOfSight(a.pos.x, eyeY, a.pos.z, t.pos.x, ty, t.pos.z)) continue;
      const k = this.know(t);
      let rate = (1.3 / (1 + d / 35)) * this.p.awareness;
      if (t.speed > 1) rate *= 1.5;
      if (t.crouching && t.speed < 1) rate *= 0.45;
      if (now - (t.lastShotT || -9) < 1) rate *= 3;
      if (t.airborne) rate *= 2;
      if (dot < fovCos) rate *= 0.5;
      k.aw = Math.min(1.5, k.aw + rate * dtp * 2.2);
      if (k.aw >= 1) {
        if (!k.visible && now - k.seenT > 3) { k.firstSeenT = now; this.thinkT = Math.min(this.thinkT, 0.05); }
        if (now - k.seenT > 0.05 && k.seenT > 0) k.vel.subVectors(t.pos, k.pos).divideScalar(Math.max(0.05, now - k.seenT));
        k.visible = true;
        k.pos.copy(t.pos);
        k.seenT = now;
        this.lastSeenEnemyT = now;
        // visual cues of health (shield breaks, being hit) — skilled AIs read these better
        const cue = this.p.aim > 0.9 || this.profileName === 'skilled';
        if (cue && now - t.lastHitTime < 4) k.estHp = clamp(t.totalHp + rand(-20, 20), 5, 200);
        else k.estHp = clamp(175 - k.dmgDealt, 15, 200);
      }
    }
    // hearing
    const evs = g.soundEvents;
    const since = this.lastHearT || 0;
    for (let i = evs.length - 1; i >= 0; i--) {
      const e = evs[i];
      if (e.t <= since) break;
      if (!e.src || e.src === a || !e.src.alive) continue;
      const d = Math.hypot(e.x - a.pos.x, e.z - a.pos.z);
      if (d > e.r * (0.7 + this.p.awareness * 0.3)) continue;
      const k = this.know(e.src);
      k.heardT = now;
      if (!k.visible) {
        const err = d * 0.12;
        k.pos.set(e.x + rand(-err, err), e.y, e.z + rand(-err, err));
        k.aw = Math.max(k.aw, 0.6);
      }
      if (e.kind === 'shot' || e.kind === 'explosion') this.fightNoises.push({ x: e.x, z: e.z, t: now, src: e.src });
    }
    this.lastHearT = now;
    if (this.fightNoises.length > 30) this.fightNoises.splice(0, this.fightNoises.length - 30);
    // forget
    for (const [t, k] of this.known) {
      if (!t.alive || (now - Math.max(k.seenT, k.heardT) > 25)) this.known.delete(t);
      else if (!k.visible) k.aw = Math.max(0, k.aw - dtp * 0.15);
    }
  }

  onDamaged(attacker, amount) {
    if (!attacker || attacker === this.a) return;
    const k = this.know(attacker);
    k.dmgTaken += amount;
    k.aw = 1.2;
    const err = 3;
    if (!k.visible) k.pos.set(attacker.pos.x + rand(-err, err), attacker.pos.y, attacker.pos.z + rand(-err, err));
    k.heardT = this.game.time;
    this.underFireT = this.game.time;
    this.thinkT = Math.min(this.thinkT, 0.1);
  }
  onShotAt(shooter) {
    if (!shooter) return;
    const k = this.know(shooter);
    k.aw = Math.max(k.aw, 0.8);
    if (!k.visible) k.pos.copy(shooter.pos);
    k.heardT = this.game.time;
    this.underFireT = this.game.time;
  }
  onDealtDamage(target, amount) {
    const k = this.know(target);
    k.dmgDealt += amount;
    k.estHp = Math.max(5, k.estHp - amount);
  }

  // ===================== evaluation helpers =====================
  loadout() {
    const a = this.a;
    let close = 0, mid = 0, long = 0, heals = 0;
    for (const s of a.slots) {
      if (!s) continue;
      if (s.kind === 'weapon') {
        const ammoOk = s.ammoIn > 0 || a.ammo[s.def.ammo] > 0;
        if (!ammoOk) continue;
        close = Math.max(close, weaponRating(s, 'close'));
        mid = Math.max(mid, weaponRating(s, 'mid'));
        long = Math.max(long, weaponRating(s, 'long'));
      } else if (!s.def.throwable) heals += s.count * (s.def.heal || s.def.shield || 50) / 25;
    }
    const w = clamp((close / 420 + mid / 260 + long / 200) / 3, 0, 1);
    return { score: clamp(w * 0.8 + Math.min(heals, 6) / 6 * 0.2, 0, 1), close, mid, long, heals, armed: close + mid + long > 0 };
  }

  power() {
    const a = this.a;
    const lo = this.lo || this.loadout();
    return (a.totalHp / 200) * 0.55 + lo.score * 0.45;
  }

  effRange() {
    const it = this.a.held;
    if (!it || it.kind !== 'weapon') return 3;
    return it.def.range;
  }

  // urgency of moving to safety (0..1.5)
  stormUrgency() {
    const g = this.game, a = this.a, s = g.storm;
    if (!s.started) return 0;
    const outsideNow = s.distOutside(a.pos.x, a.pos.z);
    if (outsideNow > 0) return 1.0 + Math.min(0.5, s.dmg / 10) + (a.totalHp < 60 ? 0.3 : 0);
    if (s.state === 'done') return 0;
    const dNext = Math.hypot(a.pos.x - s.next.x, a.pos.z - s.next.z) - s.next.r;
    if (dNext <= -8) return 0;
    const tCover = s.timeUntilCovered(a.pos.x, a.pos.z);
    const runT = Math.max(0, dNext + 15) / 6.0;
    const margin = 12 + this.p.caution * 25;
    return clamp((runT + margin) / Math.max(1, tCover), 0, 1.2);
  }

  safePoint() {
    const s = this.game.storm;
    const T = this.game.terrain;
    if (this._safeFor === s.phase && this._safe) return this._safe;
    const n = s.next;
    let best = null, bestS = -1e9;
    for (let i = 0; i < 8; i++) {
      const ang = rand(0, Math.PI * 2);
      const rr = n.r * (this.p.patience > 0.6 ? rand(0.45, 0.8) : rand(0, 0.6));
      const x = n.x + Math.cos(ang) * rr, z = n.z + Math.sin(ang) * rr;
      const h = T.heightAt(x, z);
      if (h < 0.5) continue;
      const dist = Math.hypot(x - this.a.pos.x, z - this.a.pos.z);
      const score = h * (this.p.patience * 0.8) - dist * 0.15 + rand(0, 10);
      if (score > bestS) { bestS = score; best = { x, y: h, z }; }
    }
    if (!best) best = { x: n.x, y: T.heightAt(n.x, n.z), z: n.z };
    this._safe = best; this._safeFor = s.phase;
    return best;
  }

  pickTarget() {
    const now = this.game.time, a = this.a;
    let best = null, bestS = 0;
    for (const k of this.known.values()) {
      const t = k.actor;
      if (!t.alive) continue;
      const age = now - Math.max(k.seenT, k.heardT);
      if (age > 12 || k.aw < 0.55) continue;
      const d = Math.hypot(t.pos.x - a.pos.x, t.pos.z - a.pos.z);
      let s = (k.visible ? 1 : 0.45) / (1 + d / 60);
      if (now - this.underFireT < 3 && this.a.lastHitBy === t) s += 0.9;
      if (k.estHp < 90) s += 0.4 * this.p.aggression * (this.profileName === 'skilled' ? 1.5 : 1);
      if (t.airborne) s += 0.2;
      s *= 1 - Math.min(0.7, age / 15);
      if (s > bestS) { bestS = s; best = k; }
    }
    return best;
  }

  outnumbered() {
    const now = this.game.time, a = this.a;
    let n = 0;
    for (const k of this.known.values()) {
      if (now - Math.max(k.seenT, k.heardT) < 5 && k.pos.distanceTo(a.pos) < 50) n++;
    }
    return n >= 2;
  }

  // ===================== decision making =====================
  think() {
    const g = this.game, a = this.a, p = this.p, now = g.time;
    this.lo = this.loadout();
    const lo = this.lo;
    const tk = this.pickTarget();
    this.target = tk;
    const hpFrac = a.totalHp / 200;
    const underFire = now - this.underFireT < 2.5;
    const storm = this.stormUrgency();
    const scores = {};
    // fight
    if (tk) {
      const d = tk.pos.distanceTo(a.pos);
      const enemyPow = tk.estHp / 200 * 0.55 + 0.25;
      const adv = this.power() - enemyPow;
      const seenRecently = tk.visible || now - tk.seenT < 2.5;
      let f = p.aggression * 0.5 + 0.36 + adv * 0.5;
      if (underFire && a.lastHitBy === tk.actor) f += 0.35;
      if (tk.estHp < 80) f += 0.3 * (this.profileName === 'skilled' ? 1.4 : 0.8);
      if (!lo.armed) f = d < 4 ? 0.6 : 0.05;
      if (!seenRecently) f *= p.aggression > 0.7 ? 0.9 : 0.6;
      if (seenRecently && d < 12 && lo.armed) f = Math.max(f, 0.75);
      if (d > 90 && p.aggression < 0.5) f *= 0.75;
      if (d > 55 && p.aggression < 0.7 && !(underFire && a.lastHitBy === tk.actor)) f *= 0.75;
      // just landed: most players loot up before taking optional fights
      const attackedByIt = underFire && a.lastHitBy === tk.actor;
      if (now - (this.landT ?? now) < 35 && !attackedByIt && d > 6) f *= p.aggression > 0.8 ? 0.85 : 0.5;
      // under-geared: gear up first unless we're attacked or it's point-blank
      if (lo.score < 0.35 && d > 15 && !(underFire && a.lastHitBy === tk.actor)) f *= 0.65;
      if (d > 150 && lo.long < 50) f *= 0.4;
      if (this.outnumbered() && p.aggression < 0.8) f -= 0.25;
      // third-party bonus: enemy is busy fighting someone else
      if (this.fightNoises.some((n) => n.src !== tk.actor && now - n.t < 5 && Math.hypot(n.x - tk.pos.x, n.z - tk.pos.z) < 35)) f += p.thirdParty * 0.35;
      scores.fight = f;
      // retreat
      if (lo.armed && hpFrac < p.retreatAt && tk.estHp > a.totalHp + 20 && !(d < 6)) scores.retreat = 0.65 + p.caution * 0.5;
      if (this.outnumbered() && p.caution > 0.6 && hpFrac < 0.6) scores.retreat = Math.max(scores.retreat || 0, 0.8);
      // unarmed vs an armed enemy we can see: get away and find a weapon
      if (!lo.armed && seenRecently && d > 4 && d < 35 && tk.actor.held && tk.actor.held.kind === 'weapon') scores.retreat = Math.max(scores.retreat || 0, 0.7);
    }
    // heal
    const heal = a.bestHealItem();
    if (heal >= 0) {
      const missing = 1 - hpFrac;
      let h = missing * (0.7 + p.caution) * 1.3;
      if (a.shield < 50 && a.slots[heal].def.shield && !(tk && tk.visible)) h += 0.25;
      if (underFire && !this.boxed) h *= 0.35;
      if (tk && tk.visible && tk.pos.distanceTo(a.pos) < 25) h *= 0.4;
      scores.heal = h;
    }
    // storm
    scores.rotate = storm * 1.1;
    // loot
    const lt = this.findLoot();
    this.lootCand = lt;
    if (lt) scores.loot = (1 - lo.score) * p.greed * 1.1 + (lo.armed ? 0 : 0.5) + lt.value * 0.2;
    // supply drops
    const sd = this.findSupplyDrop();
    if (sd) scores.supply = p.greed * 0.55 + p.aggression * 0.25;
    // harvest
    const mats = a.mats.wood + a.mats.stone + a.mats.metal;
    if (mats < 250 && !(tk && tk.visible)) scores.harvest = (1 - mats / 300) * p.harvest * 0.55 * (lo.armed ? 1 : 0.3);
    // third party: go to a heard fight
    const fight = this.heardFight();
    if (fight && lo.armed && lo.score > 0.3) scores.thirdparty = p.thirdParty * 0.45 * this.power() + p.aggression * 0.12;
    // investigate a heard enemy
    if (tk && !tk.visible && lo.armed) scores.investigate = p.aggression * 0.42;
    // hold position late game
    if (g.storm.phase >= 2 && g.storm.inNext(a.pos.x, a.pos.z, 20)) scores.hold = p.patience * 0.55;
    scores.wander = 0.12;
    // pick with hysteresis
    let best = 'wander', bestS = -1;
    for (const k in scores) {
      let s = scores[k] + (k === this.goal ? 0.1 : 0) + rand(0, 0.08 * (1.2 - p.decision));
      if (s > bestS) { bestS = s; best = k; }
    }
    // hard rule: never sit in a deadly storm
    if (storm > 1.0 && best !== 'fight') best = 'rotate';
    if (storm > 1.25 && best === 'fight' && tk && tk.pos.distanceTo(a.pos) > 10) best = 'rotate';
    if (best !== this.goal) {
      this.goal = best;
      this.detour = null;
      this.stuckT = 0;
      if (best !== 'loot') this.lootTarget = null;
      if (best !== 'harvest') this.harvestTarget = null;
    }
    this.goalScore = bestS;
    if (best === 'loot') this.lootTarget = lt;
    if (best === 'supply') this.supplyTarget = sd;
    if (best === 'thirdparty') this.investigate = fight;
    if (best === 'investigate') this.investigate = { x: tk.pos.x, y: tk.pos.y, z: tk.pos.z };
  }

  heardFight() {
    const now = this.game.time;
    const recent = this.fightNoises.filter((n) => now - n.t < 6);
    if (recent.length < 3) return null;
    // two distinct shooters near each other = an ongoing fight
    for (let i = 0; i < recent.length; i++) for (let j = i + 1; j < recent.length; j++) {
      const a = recent[i], b = recent[j];
      if (a.src !== b.src && Math.hypot(a.x - b.x, a.z - b.z) < 60) {
        const x = (a.x + b.x) / 2, z = (a.z + b.z) / 2;
        const d = Math.hypot(x - this.a.pos.x, z - this.a.pos.z);
        if (d < 180 && d > 15) return { x, y: this.game.terrain.heightAt(x, z), z };
      }
    }
    return null;
  }

  findSupplyDrop() {
    for (const d of this.game.loot.drops) {
      if (d.opened) continue;
      const dist = Math.hypot(d.x - this.a.pos.x, d.z - this.a.pos.z);
      if (dist < 260 && this.game.storm.inNext(d.x, d.z, -30)) return d;
    }
    return null;
  }

  // Evaluate nearby loot and pick the most valuable reachable item / chest
  findLoot() {
    const g = this.game, a = this.a, now = g.time;
    const lo = this.lo;
    let best = null, bestS = 0;
    const near = g.loot.nearby(a.pos.x, a.pos.z, 45, this._ln || (this._ln = []));
    for (const p of near) {
      if (this.badTargets.get(p) > now) continue;
      const v = this.pickupValue(p);
      if (v <= 0) continue;
      const d = Math.hypot(p.x - a.pos.x, p.z - a.pos.z) + Math.abs(p.y - a.pos.y) * 2;
      const s = v / (1 + d / 15);
      if (s > bestS) { bestS = s; best = { kind: 'pickup', p, x: p.x, y: p.y, z: p.z, value: v }; }
    }
    const chests = g.loot.chestsNear(a.pos.x, a.pos.z, 60, this._lc || (this._lc = []));
    for (const c of chests) {
      if (c.opened || this.badTargets.get(c) > now) continue;
      const d = Math.hypot(c.x - a.pos.x, c.z - a.pos.z) + Math.abs(c.y - a.pos.y) * 2;
      const v = (1.1 - lo.score) * (c.rare ? 1.6 : 1) * (c.mythic ? 2 : 1);
      const s = v / (1 + d / 20);
      if (s > bestS) { bestS = s; best = { kind: 'chest', c, x: c.x, y: c.y, z: c.z, value: v }; }
    }
    return best;
  }

  pickupValue(p) {
    const a = this.a;
    if (p.kind === 'ammo') {
      const uses = a.slots.some((s) => s && s.kind === 'weapon' && s.def.ammo === p.data.type);
      return uses && a.ammo[p.data.type] < 120 ? 0.5 : 0.05;
    }
    if (p.kind === 'mats') return a.mats[p.data.mat] < 500 ? 0.4 : 0;
    const it = p.data;
    if (it.kind === 'weapon') {
      const worst = this.worstSlot();
      const roleVal = Math.max(weaponRating(it, 'close') / 420, weaponRating(it, 'mid') / 260, weaponRating(it, 'long') / 200);
      const free = a.freeSlot() >= 0;
      // duplicate category? prefer upgrading
      const same = a.slots.find((s) => s && s.kind === 'weapon' && s.def.cat === it.def.cat);
      if (same) {
        const cur = Math.max(weaponRating(same, 'close') / 420, weaponRating(same, 'mid') / 260, weaponRating(same, 'long') / 200);
        return roleVal > cur * 1.12 ? (roleVal - cur) * 2 + 0.3 : 0;
      }
      if (free) return 0.5 + roleVal;
      return worst && worst.v < roleVal * 0.9 ? roleVal - worst.v + 0.2 : 0;
    }
    // consumable
    const heals = a.slots.filter((s) => s && s.kind === 'consumable').length;
    if (a.freeSlot() >= 0 || a.slots.some((s) => s && s.kind === 'consumable' && s.type === it.type && s.count < s.def.stack)) return heals < 2 ? 0.7 : 0.35;
    return 0;
  }

  worstSlot() {
    const a = this.a;
    let worst = null;
    a.slots.forEach((s, i) => {
      if (!s) return;
      let v;
      if (s.kind === 'weapon') v = Math.max(weaponRating(s, 'close') / 420, weaponRating(s, 'mid') / 260, weaponRating(s, 'long') / 200);
      else v = s.def.throwable ? 0.25 : 0.3 + (s.def.rarity || 0) * 0.1;
      if (!worst || v < worst.v) worst = { i, v };
    });
    return worst;
  }

  // ===================== per-frame =====================
  update(dt) {
    const a = this.a;
    if (!a.alive) return;
    if (a.mode === 'bus') { this.updateBus(); return; }
    if (a.mode === 'skydive' || a.mode === 'glide') { this.updateAir(dt); this.landT = undefined; return; }
    if (this.landT === undefined) this.landT = this.game.time;
    const inp = a.input;
    inp.fire = false; inp.jump = false; inp.reload = false; inp.ads = false; inp.sprint = false; inp.deploy = false;
    inp.crouch = false;
    this.noWhiskers = false;
    this.switchCd -= dt;
    this.percT -= dt;
    if (this.percT <= 0) {
      const iv = 0.18 * this.lodRate;
      this.perceive(iv);
      this.percT = iv * rand(0.85, 1.15);
    }
    this.thinkT -= dt;
    if (this.thinkT <= 0) {
      this.think();
      this.thinkT = 0.4 * this.lodRate * rand(0.8, 1.2) / this.p.decision;
    }
    this.act(dt);
    this.updateStuck(dt);
  }

  act(dt) {
    const a = this.a, g = this.game;
    this.moveX = 0; this.moveZ = 0; this.faceYaw = null; this.facePitch = 0;
    this.wantSprint = false;
    // continuing a build sequence takes precedence (ramp rush, box-up, fort)
    if (this.buildSeq) this.runBuildSeq(dt);
    switch (this.goal) {
      case 'fight': this.doFight(dt); break;
      case 'retreat': this.doRetreat(dt); break;
      case 'heal': this.doHeal(dt); break;
      case 'rotate': this.doRotate(dt); break;
      case 'loot': this.doLoot(dt); break;
      case 'supply': this.doSupply(dt); break;
      case 'harvest': this.doHarvest(dt); break;
      case 'thirdparty': case 'investigate': this.doInvestigate(dt); break;
      case 'hold': this.doHold(dt); break;
      default: this.doWander(dt); break;
    }
    // housekeeping reload when safe
    const it = a.held;
    if (it && it.kind === 'weapon' && it.ammoIn < it.mag * 0.5 && g.time - this.lastSeenEnemyT > 1.5 && !a.input.fire) a.input.reload = true;
    // apply movement intent (with a final ledge guard so strafing never walks us off a roof)
    const inp = a.input;
    let ml = Math.hypot(this.moveX, this.moveZ);
    if (ml > 0.01 && a.grounded && !a.swimming && a.mode === 'ground') {
      const ux = this.moveX / ml, uz = this.moveZ / ml;
      const ahead = g.phys.groundAt(a.pos.x + ux * 1.0, a.pos.z + uz * 1.0, a.pos.y + 0.6, 0.2);
      if (a.pos.y - Math.max(ahead, -1.2) > 7.5) { this.moveX = 0; this.moveZ = 0; ml = 0; }
    }
    if (ml > 0.01) { inp.mx = this.moveX / ml * Math.min(1, ml); inp.mz = this.moveZ / ml * Math.min(1, ml); }
    else { inp.mx = 0; inp.mz = 0; }
    inp.sprint = this.wantSprint;
    // facing
    let fy = this.faceYaw;
    if (fy === null && ml > 0.1) fy = yawTo(inp.mx, inp.mz);
    if (fy !== null) {
      const turn = (4 + this.p.aim * 10) * dt;
      const dd = angleDiff(a.yaw, fy);
      a.yaw += clamp(dd, -turn, turn);
    }
    const kick = a.recoilKick || 0;
    a.recoilKick = kick * Math.max(0, 1 - dt * (4 + this.p.aim * 8));
    const tp = this.facePitch + kick * (1.25 - this.p.aim) * 2.5;
    a.pitch += (tp - a.pitch) * Math.min(1, dt * (5 + this.p.aim * 6));
    a.pitch = clamp(a.pitch, -1.45, 1.4);
    dirFromYawPitch(a.yaw, a.pitch, a.aimDir);
  }

  // ---------- movement ----------
  moveTo(x, z, opts = {}) {
    const a = this.a;
    let dx = x - a.pos.x, dz = z - a.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < (opts.stop ?? 0.6)) return true;
    dx /= d; dz /= d;
    if (this.detour && this.game.time < this.detour.until) {
      dx = this.detour.x; dz = this.detour.z;
    } else if (a.lod < 2 && d > 3 && !this.noWhiskers) {
      // whisker steering around obstacles
      const dir = this.clearDir(dx, dz);
      dx = dir[0]; dz = dir[1];
    }
    // ledge awareness: never walk off a big drop — build a ramp down instead, or turn away
    if (a.grounded && !a.swimming) {
      const phys = this.game.phys;
      const ahead = phys.groundAt(a.pos.x + dx * 1.1, a.pos.z + dz * 1.1, a.pos.y + 0.6, 0.2);
      const drop = a.pos.y - Math.max(ahead, -1.2);
      if (drop > 7.5) {
        if (this.canBuild() && a.buildCd <= 0) this.buildDown(dx, dz);
        else if (!this.canBuild()) {
          // no materials: look for another way down (or harvest something to get materials)
          if (!this.harvestAdjacent()) { const s2 = this.strafeDir, ndx = -dz * s2, ndz = dx * s2; dx = ndx; dz = ndz; }
          else { this.moveX = 0; this.moveZ = 0; return false; }
        }
      }
    }
    const slow = opts.slow ?? 1;
    this.moveX = dx * slow; this.moveZ = dz * slow;
    this.wantSprint = opts.sprint ?? d > 12;
    this.navTarget = { x, z, y: opts.y };
    return false;
  }

  buildDown(dx, dz) {
    const a = this.a, B = this.game.build;
    const dir = dirFromYaw(yawTo(dx, dz));
    const opp = [1, 0, 3, 2][dir];
    const cx = Math.floor((a.pos.x + DIRS[dir][0] * BW * 0.75) / BW), cz = Math.floor((a.pos.z + DIRS[dir][1] * BW * 0.75) / BW);
    const lvl = B.levelFor(a.pos.y) - 1;
    this.chooseMat();
    const spec = B.rampSpec(cx, lvl, cz, opp);
    if (!B.pieces.has(spec.key)) B.place(a, spec);
    a.buildCd = this.buildInterval();
  }

  clearDir(dx, dz) {
    const a = this.a, phys = this.game.phys;
    const y = a.pos.y + 0.9;
    const L = 3.2;
    const tryDir = (ang) => {
      const c = Math.cos(ang), s = Math.sin(ang);
      const rx = dx * c - dz * s, rz = dx * s + dz * c;
      const h = phys.raycast(a.pos.x, y, a.pos.z, rx, 0, rz, L, null, _hit);
      if (h && h.c && h.c.maxY - a.pos.y > 1.4) return null;
      return [rx, rz];
    };
    if ((this._cdT = (this._cdT || 0) - 1) > 0 && this._cd) return this._cd;
    this._cdT = 3;
    const order = [0, 0.5, -0.5, 1.0, -1.0, 1.5, -1.5];
    if (this.strafeDir < 0) for (let i = 1; i < order.length; i += 2) [order[i], order[i + 1]] = [order[i + 1], order[i]];
    for (const ang of order) {
      const r = tryDir(ang);
      if (r) { this._cd = r; return r; }
    }
    this._cd = [dx, dz];
    return this._cd;
  }

  updateStuck(dt) {
    const a = this.a, g = this.game;
    this.progressT -= dt;
    if (this.progressT <= 0) {
      this.progressT = 0.8;
      const moved = Math.hypot(a.pos.x - this.lastPos.x, a.pos.z - this.lastPos.z);
      const wanted = Math.hypot(a.input.mx, a.input.mz) > 0.3;
      if (wanted && moved < 0.8 && a.grounded) this.stuckT += 0.8; else this.stuckT = Math.max(0, this.stuckT - 0.8);
      this.lastPos.copy(a.pos);
    }
    if (this.stuckT > 0) {
      const w = a.wallHit;
      if (w && w.top - a.pos.y < 2.5 && a.grounded) a.input.jump = true;
      if (this.stuckT >= 1.6 && this.stuckT < 3.2 && w && w.c && w.c.obj && w.c.obj.alive !== undefined && this.navTarget) {
        // harvest our way through destructible walls (gives materials too)
        this.breakThrough(w.c);
      } else if (this.stuckT >= 3.2 && !this.detour) {
        const s = chance(0.5) ? 1 : -1;
        const fx = a.input.mx, fz = a.input.mz;
        this.detour = { x: -fz * s * 0.8 + fx * 0.2, z: fx * s * 0.8 + fz * 0.2, until: g.time + rand(1.2, 2.2) };
        this.strafeDir = -this.strafeDir;
      }
      if (this.stuckT > 6) {
        // give up on this objective
        if (this.lootTarget) this.badTargets.set(this.lootTarget.p || this.lootTarget.c, g.time + 30);
        this.lootTarget = null;
        this.harvestTarget = null;
        this.stuckT = 0;
        this.detour = null;
        this.thinkT = 0;
      }
    }
    if (this.detour && g.time > this.detour.until) this.detour = null;
  }

  breakThrough(c) {
    const a = this.a;
    if (a.sel !== -1) a.select(-1);
    const cx = (c.minX + c.maxX) / 2, cz = (c.minZ + c.maxZ) / 2;
    this.faceYaw = yawTo(cx - a.pos.x, cz - a.pos.z);
    this.facePitch = -0.1;
    a.input.fire = true;
  }

  // vertical access: build a ramp toward an elevated target
  climbToward(x, y, z) {
    const a = this.a;
    if (y - a.pos.y < 2.2) return false;
    if (Math.hypot(x - a.pos.x, z - a.pos.z) > 10) return false;
    if (!this.canBuild()) return false;
    const yaw = yawTo(x - a.pos.x, z - a.pos.z);
    if (a.buildCd <= 0 && a.grounded) {
      this.chooseMat();
      const spec = this.game.build.computeTarget(a, 'ramp', yaw, 0);
      if (this.game.build.place(a, spec)) a.buildCd = this.buildInterval();
    }
    return true;
  }

  // ---------- goals ----------
  doLoot(dt) {
    const a = this.a, g = this.game;
    const t = this.lootTarget;
    if (!t) { this.thinkT = 0; this.doWander(dt); return; }
    if (t.kind === 'pickup' && !t.p.alive) { this.lootTarget = null; this.thinkT = 0; return; }
    if (t.kind === 'chest' && t.c.opened) { this.lootTarget = null; this.thinkT = 0; return; }
    const obj = t.p || t.c;
    if (this.lootObj !== obj) { this.lootObj = obj; this.lootT = 0; this.viaIdx = -1; }
    this.lootT += dt;
    if (this.lootT > 16) { this.badTargets.set(obj, g.time + 40); this.lootTarget = null; this.thinkT = 0; return; }
    const d = Math.hypot(t.x - a.pos.x, t.z - a.pos.z);
    const dy = t.y - a.pos.y;
    this.equipBest(25);
    if (d < 2.0 && Math.abs(dy) < 2.0) {
      this.faceYaw = yawTo(t.x - a.pos.x, t.z - a.pos.z);
      this.interactT += dt;
      const need = t.kind === 'chest' ? 0.45 / Math.max(0.6, this.p.decision) : 0.15;
      if (this.interactT >= need) {
        this.interactT = 0;
        if (t.kind === 'chest') g.loot.openChest(a, t.c);
        else this.takePickup(t.p);
        this.lootTarget = null;
        this.thinkT = Math.min(this.thinkT, 0.15);
      }
      return;
    }
    this.interactT = 0;
    // standing on a roof / upper floor right above the loot: dig down with the harvesting tool
    if (dy < -1.8 && d < 4 && !obj.via && this.canDigDown()) { this.digDown(); return; }
    // loot on an upper floor: follow the interior stair waypoints
    const via = obj.via;
    if (via && Math.abs(dy) > 1.5) {
      if (this.viaIdx < 0) {
        // start from the first waypoint on our current level
        this.viaIdx = 0;
        for (let i = 0; i < via.length; i++) {
          if (Math.abs(via[i].y - a.pos.y) < 1.2) { this.viaIdx = i; break; }
        }
      }
      if (this.viaIdx < via.length) {
        const w = via[this.viaIdx];
        if (Math.hypot(w.x - a.pos.x, w.z - a.pos.z) < 0.8 && Math.abs(w.y - a.pos.y) < 1.4) this.viaIdx++;
        else { this.moveTo(w.x, w.z, { stop: 0.2, sprint: false, slow: 0.8 }); this.noWhiskers = true; return; }
      }
    }
    if (dy > 2.2 && d < 10 && !via) {
      if (this.climbToward(t.x, t.y, t.z)) { this.moveTo(t.x, t.z, { sprint: false, stop: 0.3 }); return; }
      // no materials: harvest something nearby so we can build up
      if (this.lootT > 2 && this.harvestAdjacent()) return;
    }
    this.moveTo(t.x, t.z, { stop: 0.3 });
  }

  canDigDown() {
    const a = this.a;
    const h = this.game.phys.raycast(a.pos.x, a.pos.y + 0.5, a.pos.z, 0, -1, 0, 1.2, null, _hit);
    return !!(h && h.c && h.c.obj && h.c.obj.alive !== false && h.c.obj.hp !== undefined);
  }

  digDown() {
    const a = this.a;
    if (a.sel !== -1) a.select(-1);
    this.facePitch = -1.4;
    this.faceYaw = a.yaw;
    this.moveX = 0; this.moveZ = 0;
    a.input.fire = true;
  }

  harvestAdjacent() {
    const a = this.a;
    const list = this.game.phys.query(a.pos.x - 3, a.pos.z - 3, a.pos.x + 3, a.pos.z + 3, []);
    for (const c of list) {
      const o = c.obj;
      if (!o || o.isBuild || !o.alive || o.mat === 'glass') continue;
      if (c.maxY < a.pos.y + 0.5 || c.minY > a.pos.y + 1.6) continue;
      const x = Math.max(c.minX, Math.min(a.pos.x, c.maxX)), z = Math.max(c.minZ, Math.min(a.pos.z, c.maxZ));
      const d = Math.hypot(x - a.pos.x, z - a.pos.z);
      if (d > 2.2) continue;
      if (a.sel !== -1) a.select(-1);
      this.faceYaw = yawTo(x - a.pos.x, z - a.pos.z);
      this.facePitch = -0.05;
      a.input.fire = true;
      return true;
    }
    return false;
  }

  takePickup(p) {
    const a = this.a, g = this.game;
    if (p.kind !== 'item') { g.loot.take(a, p); return; }
    const it = p.data;
    if (a.freeSlot() >= 0 || (it.kind === 'consumable' && a.slots.some((s) => s && s.kind === 'consumable' && s.type === it.type && s.count < s.def.stack))) { g.loot.take(a, p); this.equipBest(30); return; }
    // swap: same-category weapon first, else worst slot
    let slot = -1;
    if (it.kind === 'weapon') slot = a.slots.findIndex((s) => s && s.kind === 'weapon' && s.def.cat === it.def.cat);
    if (slot < 0) { const w = this.worstSlot(); slot = w ? w.i : 0; }
    g.loot.take(a, p, slot);
    this.equipBest(30);
  }

  doSupply(dt) {
    const d = this.supplyTarget;
    if (!d || d.opened) { this.thinkT = 0; return; }
    const a = this.a;
    const dist = Math.hypot(d.x - a.pos.x, d.z - a.pos.z);
    this.equipBest(30);
    if (d.landed && dist < 2.2) {
      this.interactT += dt;
      if (this.interactT > 0.6) { this.game.loot.openDrop(a, d); this.interactT = 0; this.thinkT = 0; }
      return;
    }
    this.moveTo(d.x, d.z, { stop: 1.5 });
  }

  doRotate(dt) {
    const a = this.a;
    const sp = this.safePoint();
    this.equipBest(30);
    const d = Math.hypot(sp.x - a.pos.x, sp.z - a.pos.z);
    if (d < 6) { this.goal = 'hold'; this.holdSpot = sp; return; }
    this.moveTo(sp.x, sp.z, { sprint: true, stop: 3 });
    // engage visible threats while rotating
    this.opportunisticFire();
  }

  doWander(dt) {
    const a = this.a, g = this.game;
    if (!this.wanderPt || Math.hypot(this.wanderPt.x - a.pos.x, this.wanderPt.z - a.pos.z) < 5 || g.time > this.wanderUntil) {
      // head for a nearby chest area or inward toward the safe zone
      const s = g.storm;
      let x, z;
      const chests = g.loot.chestsNear(a.pos.x, a.pos.z, 180, []).filter((c) => !c.opened && s.inNext(c.x, c.z, -20));
      if (chests.length && chance(0.7)) { const c = pick(chests); x = c.x; z = c.z; }
      else {
        const ang = rand(0, Math.PI * 2), r = rand(0, s.next.r * 0.7);
        x = s.next.x + Math.cos(ang) * r; z = s.next.z + Math.sin(ang) * r;
      }
      this.wanderPt = { x, z };
      this.wanderUntil = g.time + 40;
    }
    this.equipBest(30);
    this.moveTo(this.wanderPt.x, this.wanderPt.z, { stop: 3 });
    this.opportunisticFire();
  }

  doHarvest(dt) {
    const a = this.a, g = this.game;
    let t = this.harvestTarget;
    if (!t || !t.obj.alive) {
      t = this.harvestTarget = this.findHarvest();
      if (!t) { this.thinkT = 0; this.doWander(dt); return; }
    }
    const d = Math.hypot(t.x - a.pos.x, t.z - a.pos.z);
    if (d < 2.2 + t.r) {
      if (a.sel !== -1) a.select(-1);
      this.faceYaw = yawTo(t.x - a.pos.x, t.z - a.pos.z);
      this.facePitch = clamp(Math.atan2(t.y - a.eyeY, d), -0.6, 0.4);
      a.input.fire = true;
      const mats = a.mats.wood + a.mats.stone + a.mats.metal;
      if (mats > 300) this.thinkT = 0;
    } else this.moveTo(t.x, t.z, { stop: 1.4 + t.r, sprint: d > 15 });
    this.opportunisticFire();
  }

  findHarvest() {
    const a = this.a;
    const list = this.game.phys.query(a.pos.x - 30, a.pos.z - 30, a.pos.x + 30, a.pos.z + 30, []);
    let best = null, bestD = 1e9;
    for (const c of list) {
      const o = c.obj;
      if (!o || o.isBuild || !o.alive) continue;
      if (o.kind !== 'tree' && o.kind !== 'rock' && o.kind !== 'car' && o.kind !== 'crate') continue;
      if (c.minY > a.pos.y + 1.5 || c.maxY < a.pos.y) continue;
      const x = (c.minX + c.maxX) / 2, z = (c.minZ + c.maxZ) / 2;
      const d = Math.hypot(x - a.pos.x, z - a.pos.z) * (o.kind === 'car' ? 0.8 : 1);
      if (d < bestD) { bestD = d; best = { obj: o, x, z, y: Math.min(c.maxY, a.pos.y + 1.2), r: Math.max(c.maxX - c.minX, c.maxZ - c.minZ) / 2 }; }
    }
    return best;
  }

  doInvestigate(dt) {
    const a = this.a;
    const t = this.investigate;
    if (!t) { this.thinkT = 0; return; }
    this.equipBest(40);
    const d = Math.hypot(t.x - a.pos.x, t.z - a.pos.z);
    if (d < 8) { this.investigate = null; this.thinkT = 0; return; }
    const sneaky = this.p.caution > 0.6 || this.profileName === 'strategic';
    this.moveTo(t.x, t.z, { sprint: d > 40 && !sneaky, slow: sneaky && d < 40 ? 0.6 : 1 });
    a.input.crouch = sneaky && d < 30;
    this.faceYaw = yawTo(t.x - a.pos.x, t.z - a.pos.z);
    this.opportunisticFire();
  }

  doHold(dt) {
    const a = this.a, g = this.game;
    if (!this.holdSpot || !g.storm.inNext(this.holdSpot.x, this.holdSpot.z, 5)) this.holdSpot = this.safePoint();
    const hs = this.holdSpot;
    const d = Math.hypot(hs.x - a.pos.x, hs.z - a.pos.z);
    this.equipBest(60);
    if (d > 4) { this.moveTo(hs.x, hs.z, { stop: 2 }); this.opportunisticFire(); return; }
    // defensive / strategic players build a small fort and wait
    if (!this.fortBuilt && this.canBuild(30) && this.p.build > 0.4 && (this.p.patience > 0.6 || chance(0.01))) {
      this.fortBuilt = true;
      this.startBox(true);
    }
    // repair our structures
    this.repairNearby(dt);
    // scan around
    this.scanT = (this.scanT || 0) - dt;
    if (this.scanT <= 0) { this.scanYaw = rand(-Math.PI, Math.PI); this.scanT = rand(1.5, 3); }
    this.faceYaw = this.scanYaw;
    a.input.crouch = this.p.caution > 0.6;
    this.opportunisticFire();
    // top up healing while waiting
    if (a.totalHp < 170 && a.hasHealing() && g.time - this.underFireT > 4) this.doHeal(dt);
  }

  repairNearby(dt) {
    const a = this.a, g = this.game;
    if (g.time - this.underFireT < 2) return;
    const mine = g.build.findOwnedNear(a, a.pos.x, a.pos.z, 6);
    for (const p of mine) {
      if (!p.building && p.hp < p.maxHp * 0.6) {
        const b = p.bbox;
        this.faceYaw = yawTo((b.minX + b.maxX) / 2 - a.pos.x, (b.minZ + b.maxZ) / 2 - a.pos.z);
        g.build.repair(a, p, dt);
        return true;
      }
    }
    return false;
  }

  doHeal(dt) {
    const a = this.a, g = this.game;
    const i = a.bestHealItem();
    if (i < 0) { this.thinkT = 0; return; }
    // box up first if enemies are around
    const threat = this.target && g.time - Math.max(this.target.seenT, this.target.heardT) < 6;
    if (threat && !this.boxed && this.canBuild(40) && this.p.build > 0.35 && !this.buildSeq) { this.startBox(false); }
    if (threat && this.target) {
      // put something between us and the threat while healing
      const tp = this.target.pos;
      this.moveX = -(tp.x - a.pos.x) * 0.02; this.moveZ = -(tp.z - a.pos.z) * 0.02;
    }
    if (this.buildSeq) return;
    if (threat && this.boxed && !a.useItem) this.patchBox();
    if (a.sel !== i) { a.select(i); return; }
    a.input.fire = true;
  }

  // rebuild missing walls of our box
  patchBox() {
    const a = this.a, B = this.game.build;
    if (a.buildCd > 0 || !this.canBuild()) return;
    const cx = Math.floor(a.pos.x / BW), cz = Math.floor(a.pos.z / BW);
    if (!this.boxed || this.boxed.cx !== cx || this.boxed.cz !== cz) return;
    for (let dIdx = 0; dIdx < 4; dIdx++) {
      const spec = B.computeTarget(a, 'wall', DIR_YAW[dIdx], 0);
      if (!B.pieces.has(spec.key)) {
        this.chooseMat();
        if (B.place(a, spec)) { a.buildCd = this.buildInterval(); return; }
      }
    }
  }

  doRetreat(dt) {
    const a = this.a, g = this.game;
    const t = this.target;
    if (!t) { this.thinkT = 0; return; }
    const sp = this.safePoint();
    let ax = a.pos.x - t.pos.x, az = a.pos.z - t.pos.z;
    const l = Math.hypot(ax, az) || 1;
    ax /= l; az /= l;
    let sx = sp.x - a.pos.x, sz = sp.z - a.pos.z;
    const sl = Math.hypot(sx, sz) || 1;
    sx /= sl; sz /= sl;
    const tx = a.pos.x + (ax * 0.7 + sx * 0.3) * 20, tz = a.pos.z + (az * 0.7 + sz * 0.3) * 20;
    this.moveTo(tx, tz, { sprint: true });
    // cover our back with walls
    if (g.time - this.underFireT < 1 && this.canBuild() && chance(this.p.build * dt * 3) && a.buildCd <= 0) {
      this.placeWallToward(t.pos.x, t.pos.z);
    }
    if (l > 70 || g.time - Math.max(t.seenT, t.heardT) > 5) this.thinkT = 0;
  }

  // ---------- combat ----------
  doFight(dt) {
    const a = this.a, g = this.game, p = this.p;
    const k = this.target;
    if (!k || !k.actor.alive) { this.thinkT = 0; this.target = null; return; }
    const t = k.actor;
    const now = g.time;
    const d = Math.hypot(k.pos.x - a.pos.x, k.pos.z - a.pos.z);
    const visible = k.visible && now - k.seenT < 0.6;
    this.equipBest(d);
    const it = a.held;
    const cat = it && it.kind === 'weapon' ? it.def.cat : 'melee';
    // preferred distance
    let pref = { shotgun: 5, smg: 10, ar: 24, pistol: 14, sniper: 70, explosive: 30, special: 20, melee: 1.5 }[cat] || 20;
    if (p.range === 'close') pref *= 0.7;
    if (p.range === 'long') pref *= 1.3;
    if (this.profileName === 'defensive') pref *= 1.2;
    // movement: approach / keep distance / strafe
    const toX = (k.pos.x - a.pos.x) / (d || 1), toZ = (k.pos.z - a.pos.z) / (d || 1);
    this.strafeT -= dt;
    if (this.strafeT <= 0) { this.strafeT = rand(0.35, 1.2) / (0.6 + p.aim * 0.5); this.strafeDir = chance(0.5) ? 1 : -1; }
    let mx = 0, mz = 0;
    if (!visible) {
      // push last known position (aggressive) or hold the angle
      if (p.aggression > 0.55 || now - k.seenT > 3) {
        this.moveTo(k.pos.x, k.pos.z, { sprint: d > 15, stop: 2 });
        mx = this.moveX; mz = this.moveZ;
      }
      // break enemy cover: shoot builds blocking us
      if (d < 45 && p.aggression > 0.5 && it && it.kind === 'weapon') this.shootBlockingBuild(k);
    } else {
      if (d > pref * 1.35) { mx = toX; mz = toZ; }
      else if (d < pref * 0.6 && !(p.aggression > 0.8 && cat === 'shotgun')) { mx = -toX; mz = -toZ; }
      const sf = cat === 'sniper' ? 0.3 : 0.9;
      mx += -toZ * this.strafeDir * sf; mz += toX * this.strafeDir * sf;
      this.moveX = mx; this.moveZ = mz;
      this.wantSprint = d > pref * 2 && !visible;
      // jump spam for aggressive / skilled at close range
      this.jumpT -= dt;
      if (this.jumpT <= 0) {
        this.jumpT = rand(0.8, 2.5);
        if ((p.aggression > 0.7 || this.profileName === 'skilled') && d < 30 && chance(0.6)) a.input.jump = true;
      }
      // crouch-peeking for strategic players
      if (this.profileName === 'strategic' && cat !== 'shotgun' && d > 25) { if (chance(dt * 0.8)) this.crouchPeek = !this.crouchPeek; a.input.crouch = !!this.crouchPeek; }
    }
    // lull in the fight: repair our walls (defensive minds) / advanced movement while closing in
    if (!visible && now - this.underFireT > 1.5 && (this.profileName === 'defensive' || this.profileName === 'strategic' || this.profileName === 'skilled')) this.repairNearby(dt);
    if (this.profileName === 'skilled' || p.aggression > 0.85) {
      this.slideT = (this.slideT || 0) - dt;
      if (this.slideT <= 0 && a.sprinting && a.speed > 6 && d > 12 && chance(0.5)) { a.input.crouch = true; this.slideT = rand(2, 4); }
    }
    // react to incoming fire: cover or building
    const hurt = now - this.underFireT < 0.7;
    if (hurt && this.canBuild() && a.buildCd <= 0 && !this.buildSeq && d > 6) {
      const pBuild = p.build * (this.profileName === 'aggressive' ? 0.6 : 1);
      if (chance(pBuild * 0.9)) {
        if ((this.profileName === 'skilled' || p.build > 0.85) && chance(0.5) && t.pos.y > a.pos.y - 1) this.startRampRush(t.pos.x, t.pos.z);
        else this.placeWallToward(t.pos.x, t.pos.z);
      }
    }
    // take high ground when the enemy is above us
    if (visible && t.pos.y > a.pos.y + 3 && d < 25 && this.canBuild(30) && !this.buildSeq && p.build > 0.6 && chance(dt * 1.5)) this.startRampRush(t.pos.x, t.pos.z);
    // grenades: flush enemies out of cover / builds at mid range
    this.nadeT = (this.nadeT ?? rand(2, 6)) - dt;
    const gi = a.slots.findIndex((x) => x && x.kind === 'consumable' && x.def.throwable);
    if (gi >= 0 && this.nadeT <= 0 && d > 8 && d < 28 && (this.targetInBuilds() || (!visible && now - k.seenT < 3) || chance(0.3))) {
      this.nadeT = rand(6, 14);
      this.nadeThrow = { slot: gi, t: 0.45 };
    }
    if (this.nadeThrow) {
      const nt = this.nadeThrow;
      nt.t -= dt;
      if (a.sel !== nt.slot) a.select(nt.slot);
      this.faceYaw = yawTo(k.pos.x - a.pos.x, k.pos.z - a.pos.z);
      this.facePitch = 0.12 + d * 0.004;
      if (nt.t <= 0 && a.equipT <= 0) { a.input.fire = true; this.nadeThrow = null; this.switchCd = 0.4; }
      if (!a.slots[nt.slot]) this.nadeThrow = null;
      return;
    }
    // editing: peek through our own wall
    this.handleEdits(dt, k, d);
    // aim & fire
    if (it && (visible || now - k.seenT < 0.35)) this.aimAndFire(dt, k, d, it);
    else if (!it || it.kind !== 'weapon') {
      // melee
      this.faceYaw = yawTo(k.pos.x - a.pos.x, k.pos.z - a.pos.z);
      if (d < 2.5) a.input.fire = true;
      else { this.moveTo(k.pos.x, k.pos.z, { stop: 1.2 }); }
    } else if (!visible) {
      this.faceYaw = yawTo(k.pos.x - a.pos.x, k.pos.z - a.pos.z);
    }
    // reload behind cover / when nothing is visible
    if (it && it.kind === 'weapon' && it.ammoIn === 0 && a.ammo[it.def.ammo] > 0) a.input.reload = true;
    if (it && it.kind === 'weapon' && !visible && it.ammoIn < it.mag * 0.7) a.input.reload = true;
  }

  opportunisticFire() {
    const k = this.pickTarget();
    if (!k || !k.visible) return;
    const d = k.pos.distanceTo(this.a.pos);
    if (d < 60 || this.p.aggression > 0.6) { this.target = k; if (d < 35) { this.goal = 'fight'; } }
    const it = this.a.held;
    if (it && it.kind === 'weapon' && d < it.def.maxRange * 0.6) this.aimAndFire(0.016, k, d, it);
  }

  aimAndFire(dt, k, d, it) {
    const a = this.a, g = this.game, p = this.p;
    const t = k.actor;
    const now = g.time;
    // reaction time before first shot
    const react = 0.3 + 0.5 * p.react;
    // perceived position + prediction (lead)
    const since = now - k.seenT;
    const lead = this.profileName === 'skilled' || p.aim > 0.95 ? 1 : 0.4;
    const def = it.def;
    const travel = def.projSpeed ? d / def.projSpeed : 0;
    const tx = k.pos.x + k.vel.x * (since + travel) * lead;
    const tz = k.pos.z + k.vel.z * (since + travel) * lead;
    let ty = k.pos.y + (t.crouching ? 0.75 : 1.15);
    if ((this.profileName === 'skilled' && chance(0.3)) || (def.cat === 'sniper' && p.aim > 0.9)) ty = k.pos.y + t.height - 0.2;
    if (def.drop) ty += 0.5 * def.drop * travel * travel;
    if (def.cat === 'explosive') ty = k.pos.y + 0.3;
    // aim error, re-rolled periodically
    this.aimErrT -= dt;
    if (this.aimErrT <= 0) {
      this.aimErrT = rand(0.25, 0.6);
      const r = (1.35 - p.aim) * 1.1 * (0.6 + d * 0.026) + t.speed * 0.14 * (1.3 - p.aim);
      this.aimErrTarget.set(rand(-r, r), rand(-r, r) * 0.7, rand(-r, r));
    }
    this.aimErr.lerp(this.aimErrTarget, Math.min(1, dt * 6));
    const ax = tx + this.aimErr.x - a.pos.x, ay = ty + this.aimErr.y - a.eyeY, az = tz + this.aimErr.z - a.pos.z;
    const hd = Math.hypot(ax, az);
    this.faceYaw = yawTo(ax, az);
    this.facePitch = Math.atan2(ay, hd);
    const yawErr = Math.abs(angleDiff(a.yaw, this.faceYaw));
    const tol = Math.atan2(1.4, Math.max(1, d)) + 0.03;
    const inRange = d < def.maxRange * (def.cat === 'shotgun' ? 1.0 : 0.9);
    a.input.ads = d > 12 && def.cat !== 'shotgun';
    if (now - k.firstSeenT < react) return;
    if (yawErr > tol || !inRange) return;
    // conserve ammo: strategic AIs tap-fire at range
    if (this.profileName === 'strategic' && def.auto && d > 40) {
      this.tapT -= dt;
      if (this.tapT < -0.35) this.tapT = 0.25;
      if (this.tapT < 0) return;
    }
    // don't waste sniper shots at moving targets far away unless skilled
    if (def.cat === 'sniper' && d > 120 && t.speed > 3 && p.aim < 0.9 && chance(0.7)) return;
    // semi-auto: toggle trigger
    if (!def.auto) a.input.fire = !a.prevFire;
    else a.input.fire = true;
    a.lastShotT = now;
  }

  shootBlockingBuild(k) {
    const a = this.a, g = this.game;
    const ey = a.eyeY;
    const dx = k.pos.x - a.pos.x, dy = k.pos.y + 1 - ey, dz = k.pos.z - a.pos.z;
    const d = Math.hypot(dx, dy, dz);
    const h = g.phys.raycast(a.pos.x, ey, a.pos.z, dx / d, dy / d, dz / d, d, null, _hit);
    if (!h || !h.c || !h.c.obj || !h.c.obj.isBuild || h.c.obj.owner === a) return;
    this.faceYaw = yawTo(h.x - a.pos.x, h.z - a.pos.z);
    this.facePitch = Math.atan2(h.y - ey, Math.hypot(h.x - a.pos.x, h.z - a.pos.z));
    const it = a.held;
    if (h.t < 2.5) { if (a.sel !== -1) a.select(-1); a.input.fire = true; return; }
    if (it && it.kind === 'weapon' && Math.abs(angleDiff(a.yaw, this.faceYaw)) < 0.15) a.input.fire = it.def.auto ? true : !a.prevFire;
  }

  // Choose the right weapon for the distance
  equipBest(d) {
    const a = this.a;
    if (this.switchCd > 0 || a.useItem) return;
    const role = d < 11 ? 'close' : d < 55 ? 'mid' : 'long';
    let best = -1, bestR = 0;
    a.slots.forEach((s, i) => {
      if (!s || s.kind !== 'weapon') return;
      if (s.ammoIn <= 0 && a.ammo[s.def.ammo] <= 0) return;
      let r = weaponRating(s, role);
      if (s.ammoIn <= 0) r *= 0.5;
      if (s.def.cat === 'explosive') r *= this.targetInBuilds() ? 2.2 : d < 8 ? 0.05 : 0.7;
      // less skilled AIs are slower to adapt
      if (i === a.sel) r *= this.profileName === 'skilled' ? 1.05 : 1.3;
      if (r > bestR) { bestR = r; best = i; }
    });
    if (best >= 0 && best !== a.sel) {
      a.select(best);
      this.switchCd = this.profileName === 'skilled' ? 0.35 : rand(0.8, 1.6);
    } else if (best < 0 && a.sel >= 0 && a.held && a.held.kind === 'weapon') a.select(-1);
  }
  targetInBuilds() {
    const k = this.target;
    if (!k) return false;
    return this.game.build.list.some((p) => p.owner === k.actor && Math.abs(p.bbox.minX - k.pos.x) < 6 && Math.abs(p.bbox.minZ - k.pos.z) < 6);
  }

  // ---------- building ----------
  canBuild(n = 10) {
    const m = this.a.mats;
    return m.wood >= n || m.stone >= n || m.metal >= n || this.game.infiniteMats(this.a);
  }
  chooseMat() {
    const m = this.a.mats;
    const urgent = this.game.time - this.underFireT < 1.5;
    let best = 'wood';
    if (!urgent && m.metal >= 20) best = 'metal';
    else if (!urgent && m.stone >= 20) best = 'stone';
    if (m[best] < 10) best = ['wood', 'stone', 'metal'].sort((x, y) => m[y] - m[x])[0];
    this.a.buildMat = best;
  }
  buildInterval() { return 0.12 + (1.25 - Math.min(1.2, this.p.build)) * 0.5; }

  placeWallToward(x, z) {
    const a = this.a;
    this.chooseMat();
    const yaw = yawTo(x - a.pos.x, z - a.pos.z);
    const spec = this.game.build.computeTarget(a, 'wall', yaw, 0);
    const p = this.game.build.place(a, spec);
    a.buildCd = this.buildInterval();
    return p;
  }

  startRampRush(x, z) {
    this.buildSeq = { kind: 'ramp', x, z, n: 0, max: 3 + Math.floor(this.p.build * 3), t: 0 };
  }
  startBox(withCone) {
    this.buildSeq = { kind: 'box', n: 0, cone: withCone, t: 0 };
  }
  runBuildSeq(dt) {
    const a = this.a, g = this.game, s = this.buildSeq;
    s.t += dt;
    if (!this.canBuild() || s.t > 8 || !a.alive || a.mode !== 'ground') { this.buildSeq = null; return; }
    if (a.buildCd > 0) return;
    this.chooseMat();
    const B = g.build;
    if (s.kind === 'box') {
      const order = [0, 1, 2, 3];
      if (s.n < 4) {
        const spec = B.computeTarget(a, 'wall', DIR_YAW[order[s.n]], 0);
        B.place(a, spec);
        s.n++;
        a.buildCd = this.buildInterval() * 0.8;
        return;
      }
      if (s.n === 4 && s.cone) { B.place(a, B.computeTarget(a, 'cone', a.yaw, 0.5)); }
      const cx = Math.floor(a.pos.x / BW), cz = Math.floor(a.pos.z / BW), lvl = B.levelFor(a.pos.y);
      this.boxed = { cx, cz, lvl, t: g.time };
      this.buildSeq = null;
      return;
    }
    if (s.kind === 'ramp') {
      if (s.n >= s.max) { this.buildSeq = null; return; }
      const yaw = yawTo(s.x - a.pos.x, s.z - a.pos.z);
      this.faceYaw = yaw;
      // wall in front then ramp, moving forward
      const dir = dirFromYaw(yaw);
      const rs = B.computeTarget(a, 'ramp', yaw, 0);
      const wall = B.wallSpec(rs.ix + (dir === 0 ? 1 : 0), rs.iy, rs.iz + (dir === 2 ? 1 : 0), dir < 2 ? 'z' : 'x');
      if (s.n % 2 === 0 && this.p.build > 0.7) B.place(a, wall);
      B.place(a, rs);
      s.n++;
      a.buildCd = this.buildInterval();
      this.moveX = DIRS[dir][0]; this.moveZ = DIRS[dir][1];
      a.input.jump = chance(0.3);
    }
  }

  handleEdits(dt, k, d) {
    const a = this.a, g = this.game, p = this.p;
    if (p.edit < 0.4) return;
    this.editT -= dt;
    // reset a previous edit after peeking
    if (this.editPiece && this.editT <= 0) {
      g.build.setEdit(a, this.editPiece, FULL_WALL);
      this.editPiece = null;
      return;
    }
    if (this.editPiece) return;
    // is one of our walls between us and the target?
    const ey = a.eyeY;
    const dx = k.pos.x - a.pos.x, dz = k.pos.z - a.pos.z;
    const l = Math.hypot(dx, dz) || 1;
    const h = g.phys.raycast(a.pos.x, ey - 0.3, a.pos.z, dx / l, 0, dz / l, Math.min(l, 4), null, _hit);
    if (!h || !h.c) return;
    const piece = g.build.pieceFromCollider(h.c);
    if (!piece || piece.owner !== a || piece.type !== 'wall' || piece.mask !== FULL_WALL) return;
    if (!chance(p.edit * dt * 4)) return;
    const it = a.held;
    const mask = it && it.def && it.def.cat === 'shotgun' && d < 8 ? EDIT_DOOR : EDIT_WINDOW;
    if (g.build.setEdit(a, piece, mask)) {
      this.editPiece = piece;
      this.editT = rand(0.9, 1.8);
    }
  }
}
