// Tactical AI for enemy (and allied) mechs.
// Each AI has a role (personality) and a difficulty profile. Difficulty changes reaction time,
// aim tracking, prediction, cover usage, coordination and dodging — never raw health.
import * as THREE from 'three';
import { rand, pick, clamp, wrapAngle } from './util.js';

export const AI_DIFF = {
  easy: { react: 0.8, aimErr: 0.075, lead: 0.0, track: 0.35, cover: 0.3, flank: 0.15, dodge: 0.0, tokens: 1, think: 0.75, abil: 0.25, burst: [0.7, 1.4], pause: [1.1, 2.2], adapt: false, coordinate: false, strafe: 0.5, search: 0.3 },
  normal: { react: 0.55, aimErr: 0.055, lead: 0.5, track: 0.6, cover: 0.65, flank: 0.4, dodge: 0.15, tokens: 2, think: 0.5, abil: 0.5, burst: [1.0, 2.0], pause: [0.6, 1.2], adapt: true, coordinate: false, strafe: 0.8, search: 0.6 },
  hard: { react: 0.32, aimErr: 0.032, lead: 0.85, track: 0.85, cover: 0.85, flank: 0.65, dodge: 0.4, tokens: 3, think: 0.35, abil: 0.8, burst: [1.2, 2.4], pause: [0.35, 0.8], adapt: true, coordinate: true, strafe: 1.0, search: 0.9 },
  expert: { react: 0.22, aimErr: 0.024, lead: 1.0, track: 1.0, cover: 1.0, flank: 0.85, dodge: 0.65, tokens: 4, think: 0.25, abil: 1.0, burst: [1.4, 2.8], pause: [0.2, 0.5], adapt: true, coordinate: true, strafe: 1.2, search: 1.0 },
};

export const ROLES = {
  scout: { range: [16, 32], tactics: { orbit: 3, strafe: 1.5, flank: 1 }, retreat: 0.25, aggression: 0.75, jumpy: 0.8 },
  sniper: { range: [65, 115], tactics: { snipe: 4, cover: 1 }, retreat: 0.45, aggression: 0.3, jumpy: 0.1 },
  assault: { range: [22, 42], tactics: { strafe: 2, push: 1, cover: 1.5, flank: 1 }, retreat: 0.3, aggression: 0.8, jumpy: 0.3 },
  tank: { range: [22, 45], tactics: { push: 3, strafe: 1 }, retreat: 0, aggression: 1, jumpy: 0.05 },
  support: { range: [35, 60], tactics: { support: 4, cover: 1 }, retreat: 0.4, aggression: 0.4, jumpy: 0.2, heals: true },
  flanker: { range: [10, 24], tactics: { flank: 4, orbit: 1.5 }, retreat: 0.3, aggression: 0.85, jumpy: 0.5 },
  elite: { range: [20, 45], tactics: { strafe: 1.5, flank: 1.5, cover: 1.5, push: 1, orbit: 1 }, retreat: 0.25, aggression: 0.9, jumpy: 0.5, adaptive: true },
};

const _v = new THREE.Vector3(), _e = new THREE.Vector3(), _t = new THREE.Vector3(), _q = new THREE.Vector3();

// ---------------------------------------------------------------------------
// Squad: per-team coordination (attack tokens, flank slots, player doctrine)
// ---------------------------------------------------------------------------
export class Squad {
  constructor(game, team, diff) {
    this.game = game; this.team = team; this.diff = AI_DIFF[diff] || AI_DIFF.normal;
    this.members = []; this.tokens = new Set(); this.t = 0;
    this.doctrine = { camping: 0, longRange: 0, aggressive: 0 };
    this.playerSamples = []; this.focus = null;
  }
  update(dt) {
    this.t -= dt;
    if (this.t > 0) return;
    this.t = 0.5;
    this.members = this.members.filter((m) => m.mech.alive && !m.mech.removed);
    // analyze player behaviour (for enemies of the player)
    const p = this.game.player;
    if (p && p.alive && p.team !== this.team) {
      this.playerSamples.push({ pos: p.pos.clone(), t: this.game.time });
      while (this.playerSamples.length > 16) this.playerSamples.shift();
      if (this.playerSamples.length >= 10) {
        const a = this.playerSamples[0].pos, b = this.playerSamples[this.playerSamples.length - 1].pos;
        const moved = a.distanceTo(b);
        this.doctrine.camping = clamp(1 - moved / 25, 0, 1);
        let dsum = 0, n = 0;
        for (const m of this.members) if (m.target === p && m.visible) { dsum += m.mech.pos.distanceTo(p.pos); n++; }
        const avg = n ? dsum / n : 40;
        this.doctrine.longRange = clamp((avg - 50) / 50, 0, 1);
        this.doctrine.aggressive = clamp((30 - avg) / 20, 0, 1);
      }
    }
    // attack tokens on the player
    const contenders = this.members.filter((m) => m.target && m.target.isPlayer);
    contenders.sort((a, b) => b.tokenScore() - a.tokenScore());
    this.tokens.clear();
    const n = this.diff.tokens + (this.game.tokenBonus || 0);
    for (let i = 0; i < contenders.length && i < n; i++) this.tokens.add(contenders[i]);
    // flank slot assignment
    if (this.diff.coordinate) {
      const flankers = this.members.filter((m) => m.target);
      flankers.forEach((m, i) => { m.flankSlot = (i / Math.max(1, flankers.length)) * Math.PI * 2 + 0.6; });
    }
  }
  hasToken(ai) { return !ai.target || !ai.target.isPlayer || this.tokens.has(ai) || ai.mech.isBoss || ai.role === ROLES.elite; }
}

// ---------------------------------------------------------------------------
// AI controller
// ---------------------------------------------------------------------------
export class AIController {
  constructor(mech, roleId, diffId, squad) {
    this.mech = mech; this.game = mech.game;
    this.roleId = roleId; this.role = ROLES[roleId] || ROLES.assault;
    this.diffId = diffId; this.diff = AI_DIFF[diffId] || AI_DIFF.normal;
    this.squad = squad; squad.members.push(this);
    this.target = null; this.visible = false; this.lastSeen = new THREE.Vector3(); this.lastSeenVel = new THREE.Vector3(); this.lastSeenT = -99; this.seeTime = 0;
    this.perceiveT = rand(0, 0.2); this.thinkT = rand(0, 0.5);
    this.tactic = 'strafe'; this.tacticT = 0; this.tacticDealt = 0; this.tacticTaken = 0;
    this.goal = mech.pos.clone(); this.path = null; this.pathIdx = 0; this.repathT = 0; this.pathGoal = new THREE.Vector3(1e9, 0, 0);
    this.strafeDir = Math.random() < 0.5 ? -1 : 1; this.strafeT = 0;
    this.burstT = 0; this.pauseT = rand(0.3, 1); this.reactT = 0;
    this.errOff = new THREE.Vector3(); this.errT = 0;
    this.stuckT = 0; this.lastPos = mech.pos.clone(); this.stuckCheck = 0;
    this.dodgeT = 0; this.coverPt = null; this.coverPhase = 'hide'; this.coverPhaseT = 0; this.peekPt = null;
    this.orbitAng = Math.random() * Math.PI * 2;
    this.flankSlot = Math.random() * Math.PI * 2;
    this.objective = null; this.retreatT = 0; this.retreatCd = 0; this.healT = 0; this.snipeShots = 0;
    this.lastHp = mech.hp + mech.shield;
    this.holdFire = false; this.aggroBoost = 0;
    this.chooseTactic();
  }

  tokenScore() {
    if (!this.target) return -1e9;
    const d = this.mech.pos.distanceTo(this.target.pos);
    return (this.visible ? 100 : 0) - d * 0.5 + this.role.aggression * 30 + (this.squad.tokens.has(this) ? 15 : 0);
  }

  // ---------------- perception ----------------
  perceive() {
    const m = this.mech, g = this.game;
    const eye = m.eye(_e);
    const sightRange = g.sightRange || 220;
    let best = null, bestScore = -1e9, bestVisible = false;
    for (const t of g.targets) {
      if (!t.alive || t.team === m.team || t.intangible || !t.isMech && !t.priority) continue;
      const d = t.pos.distanceTo(m.pos);
      if (d > sightRange) continue;
      let vis = false;
      const cloakLimit = t.cloaked ? 12 : sightRange;
      if (d < cloakLimit) vis = g.arena.lineOfSight(eye, t.center(_t));
      let score = -d + (vis ? 60 : 0) + (t === this.target ? 25 : 0) + (t === m.lastHitBy && g.time - m.lastHitTime < 4 ? 40 : 0);
      if (t.isPlayer && this.diff.coordinate) score += 20; // focus fire on the main threat
      if (t.priority) score += t.priority;
      if (!vis && t !== this.target) score -= 80;
      if (score > bestScore) { bestScore = score; best = t; bestVisible = vis; }
    }
    // retaliate against unseen attackers
    if (m.lastHitBy && m.lastHitBy.alive && g.time - m.lastHitTime < 0.5 && m.lastHitBy !== this.target && !bestVisible) {
      best = m.lastHitBy; bestVisible = false;
      this.lastSeen.copy(m.lastHitBy.pos); this.lastSeenT = g.time;
    }
    const wasVisible = this.visible;
    if (best !== this.target) { this.target = best; this.seeTime = 0; }
    this.visible = !!best && bestVisible;
    if (this.visible) {
      this.lastSeen.copy(best.pos); this.lastSeenVel.copy(best.vel || _v.set(0, 0, 0)); this.lastSeenT = g.time;
      if (!wasVisible) this.reactT = this.diff.react * rand(0.8, 1.3);
    }
  }

  // ---------------- tactics ----------------
  chooseTactic(exclude = null) {
    const w = { ...this.role.tactics };
    const d = this.diff, doc = this.squad.doctrine;
    if (w.cover) w.cover *= d.cover * (1 + doc.longRange);
    if (w.flank) w.flank *= (0.5 + d.flank) * (1 + doc.camping * 1.5);
    if (w.push) w.push *= 1 + doc.camping + doc.longRange;
    if (w.orbit) w.orbit *= 1 + doc.aggressive * 0.5;
    if (w.strafe) w.strafe *= 1 + doc.aggressive * 0.5;
    if (exclude && w[exclude] && Object.keys(w).length > 1) delete w[exclude];
    const tot = Object.values(w).reduce((a, b) => a + b, 0);
    let r = Math.random() * tot;
    let pickT = Object.keys(w)[0];
    for (const k in w) { r -= w[k]; if (r <= 0) { pickT = k; break; } }
    this.setTactic(pickT);
  }
  setTactic(t) {
    this.tactic = t; this.tacticT = 0; this.tacticDealt = 0; this.tacticTaken = 0;
    this.coverPt = null; this.peekPt = null; this.snipeShots = 0;
    if (t === 'flank' && !this.diff.coordinate) this.flankSlot = (Math.random() < 0.5 ? 1 : -1) * rand(1.2, 2.2);
  }

  think() {
    const m = this.mech, g = this.game, d = this.diff;
    const hpF = m.hpFrac();
    // adaptation: is the current tactic working?
    if (d.adapt && this.tacticT > 5 && this.tactic !== 'retreat') {
      const perf = this.tacticDealt - this.tacticTaken * 1.2;
      if (perf < -120 || (this.tacticT > 14 && Math.random() < 0.3)) this.chooseTactic(this.tactic);
    }
    // retreat decision
    this.retreatCd -= d.think;
    if (this.role.retreat > 0 && this.tactic !== 'retreat' && this.retreatCd <= 0 && hpF < this.role.retreat && Math.random() < d.cover + 0.2) {
      this.setTactic('retreat'); this.retreatT = 0;
    }
    if (this.tactic === 'retreat') {
      this.retreatT += d.think;
      const healed = m.shield >= m.stats.maxShield * 0.85 || this.retreatT > 7;
      if (healed) { this.retreatCd = 12; this.chooseTactic('retreat'); }
    }
    this.useAbilities();
    this.computeGoal();
  }

  computeGoal() {
    const m = this.mech, g = this.game, arena = g.arena;
    const T = this.target;
    const [rmin, rmax] = this.role.range;
    const rmid = (rmin + rmax) / 2;
    // objective play (domination)
    if (this.objective && (!T || !this.visible || m.pos.distanceTo(T.pos) > 45 || this.objective.urgent)) {
      const o = this.objective;
      if (m.pos.distanceTo(o.pos) > o.radius * 0.6 || this.goal.distanceTo(o.pos) > o.radius) {
        const a = Math.random() * Math.PI * 2;
        this.goal.set(o.pos.x + Math.cos(a) * o.radius * 0.4, 0, o.pos.z + Math.sin(a) * o.radius * 0.4);
      }
      return;
    }
    if (!T) {
      // patrol toward center/random
      if (m.pos.distanceTo(this.goal) < 6) this.goal.copy(arena.randomPointNear(rand(-30, 30), rand(-30, 30), 30));
      return;
    }
    const tp = this.visible ? T.pos : this.lastSeen;
    const since = g.time - this.lastSeenT;
    if (!this.visible && since > 1.5) {
      // search: predicted position (better AIs extrapolate)
      _v.copy(this.lastSeen).addScaledVector(this.lastSeenVel, Math.min(since, 3) * this.diff.search);
      if (since > 10) _v.copy(T.pos); // eventually "hear" the target
      this.goal.copy(arena.randomPointNear(_v.x, _v.z, 8));
      return;
    }
    const toMe = _v.subVectors(m.pos, tp).setY(0);
    const dist = toMe.length();
    if (dist > 0.01) toMe.divideScalar(dist); else toMe.set(1, 0, 0);
    switch (this.tactic) {
      case 'push':
        this.goal.copy(tp).addScaledVector(toMe, rmin);
        break;
      case 'strafe':
        this.goal.copy(tp).addScaledVector(toMe, clamp(dist, rmin, rmax));
        if (dist > rmax || dist < rmin) this.goal.copy(tp).addScaledVector(toMe, rmid);
        break;
      case 'orbit': {
        this.orbitAng += this.strafeDir * 0.6;
        const r = rmid;
        this.goal.set(tp.x + Math.cos(this.orbitAng) * r, 0, tp.z + Math.sin(this.orbitAng) * r);
        if (!arena.nav.walkable(this.goal.x, this.goal.z)) { this.strafeDir *= -1; this.goal.copy(tp).addScaledVector(toMe, r); }
        break;
      }
      case 'flank': {
        const facing = T.yaw !== undefined ? T.yaw : 0;
        const a = facing + Math.PI + (this.diff.coordinate ? this.flankSlot : this.flankSlot * 0.5);
        const fx = tp.x + Math.sin(a) * rmid, fz = tp.z + Math.cos(a) * rmid;
        this.goal.copy(arena.randomPointNear(fx, fz, 5));
        if (this.tacticT > 9) this.chooseTactic('flank');
        break;
      }
      case 'cover': case 'retreat': {
        if (!this.coverPt || this.tacticT > 12) this.coverPt = this.findCover(tp, this.tactic === 'retreat');
        if (!this.coverPt) {
          if (this.tactic === 'retreat') this.goal.copy(arena.randomPointNear(m.pos.x + toMe.x * 25, m.pos.z + toMe.z * 25, 8));
          else this.setTactic('strafe');
          break;
        }
        this.coverPhaseT -= this.diff.think;
        if (this.coverPhaseT <= 0) {
          this.coverPhase = (this.coverPhase === 'hide' && this.tactic !== 'retreat') ? 'peek' : 'hide';
          this.coverPhaseT = this.coverPhase === 'hide' ? rand(1.2, 2.6) : rand(1.6, 3.2);
          if (this.coverPhase === 'peek') this.peekPt = this.findPeek(this.coverPt, tp);
        }
        const c = this.coverPhase === 'peek' && this.peekPt ? this.peekPt : this.coverPt;
        this.goal.set(c.x, 0, c.z);
        break;
      }
      case 'snipe': {
        if (dist < 38) {
          // too close: break away
          this.goal.copy(arena.randomPointNear(tp.x + toMe.x * rmin, tp.z + toMe.z * rmin, 10));
          if (Math.random() < 0.3) this.snipeShots = 99;
          break;
        }
        if (!this.snipePt || this.snipeShots >= 3 || this.tacticT > 15) {
          this.snipePt = this.findSnipe(tp) || this.goal.clone();
          this.snipeShots = 0; this.tacticT = 0;
        }
        this.goal.copy(this.snipePt);
        break;
      }
      case 'support': {
        // stay behind the most threatened ally
        let ally = null, worst = 2;
        for (const o of this.squad.members) if (o !== this && o.mech.alive && o.mech.hpFrac() < worst) { worst = o.mech.hpFrac(); ally = o.mech; }
        if (ally) {
          _q.subVectors(ally.pos, tp).setY(0).normalize();
          this.goal.copy(ally.pos).addScaledVector(_q, 10);
        } else this.goal.copy(tp).addScaledVector(toMe, rmid);
        break;
      }
    }
    if (!arena.nav.walkable(this.goal.x, this.goal.z)) this.goal.copy(arena.randomPointNear(this.goal.x, this.goal.z, 8));
  }

  findCover(threat, away) {
    const m = this.mech, arena = this.game.arena;
    const cands = arena.coverNear(m.pos.x, m.pos.z, away ? 45 : 35);
    let best = null, bestS = -1e9;
    const [rmin, rmax] = this.role.range;
    const tEye = _t.set(threat.x, threat.y + 5, threat.z);
    let checks = 0;
    for (let i = 0; i < cands.length && checks < 22; i++) {
      const c = cands[(i * 7 + Math.floor(Math.random() * 3)) % cands.length];
      const dt = Math.hypot(c.x - threat.x, c.z - threat.z);
      if (!away && (dt < rmin * 0.6 || dt > rmax * 1.3)) continue;
      if (away && dt < 30) continue;
      checks++;
      // must block line of sight at chest height
      _v.set(c.x, 3.5, c.z);
      if (arena.lineOfSight(tEye, _v)) continue;
      const dm = Math.hypot(c.x - m.pos.x, c.z - m.pos.z);
      // prefer covers between me and the threat side, close to me
      const s = -dm + (away ? dt * 0.5 : -Math.abs(dt - (rmin + rmax) / 2) * 0.3) + rand(0, 4);
      if (s > bestS) { bestS = s; best = c; }
    }
    return best;
  }
  findPeek(c, threat) {
    const arena = this.game.arena;
    const nx = c.nz, nz = -c.nx;
    const tEye = _t.set(threat.x, threat.y + 5, threat.z);
    for (const s of [4, -4, 6, -6, 3]) {
      const px = c.x + nx * s + c.nx * 1.5, pz = c.z + nz * s + c.nz * 1.5;
      if (!arena.nav.walkable(px, pz)) continue;
      _v.set(px, 5, pz);
      if (arena.lineOfSight(_v, tEye)) return { x: px, z: pz };
    }
    return { x: c.x + c.nx * 4, z: c.z + c.nz * 4 };
  }
  findSnipe(tp) {
    const m = this.mech, arena = this.game.arena;
    const [rmin, rmax] = this.role.range;
    let best = null, bd = 1e9;
    const tc = _t.set(tp.x, tp.y + 4, tp.z);
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2, r = rand(rmin, rmax);
      const x = tp.x + Math.cos(a) * r, z = tp.z + Math.sin(a) * r;
      if (Math.abs(x) > arena.half - 6 || Math.abs(z) > arena.half - 6 || !arena.nav.walkable(x, z)) continue;
      _v.set(x, 6, z);
      if (!arena.lineOfSight(_v, tc)) continue;
      const d = Math.hypot(x - m.pos.x, z - m.pos.z);
      if (d < bd) { bd = d; best = new THREE.Vector3(x, 0, z); }
    }
    return best;
  }

  useAbilities() {
    const m = this.mech, d = this.diff, T = this.target;
    if (Math.random() > d.abil) return;
    const dist = T ? m.pos.distanceTo(T.pos) : 999;
    const hpF = m.hpFrac();
    const under = m.recentDamage > 25;
    const I = m.intent;
    if (m.ability.cd <= 0 && !m.mods.noAbility) {
      let use = false;
      switch (m.ability.id) {
        case 'barrage': use = this.visible && dist < 120; break;
        case 'overdrive': use = (this.visible && dist < 50) || this.tactic === 'retreat'; break;
        case 'aegis': use = under && (hpF < 0.7 || this.squad.members.some((o) => o !== this && o.mech.recentDamage > 20 && o.mech.pos.distanceTo(m.pos) < 12)); break;
        case 'slam': use = this.visible && dist < 13; break;
        case 'cloak': use = this.tactic === 'retreat' || (this.tactic === 'flank' && dist > 25); break;
        case 'fortify': use = under && (hpF < 0.6 || m.recentDamage > 60); break;
        case 'blink': use = (this.tactic === 'flank' && dist > 20 && dist < 60) || (this.tactic === 'retreat' && under); break;
        case 'overclock': use = this.visible && dist < 60; break;
      }
      if (use) I.ability = true;
    }
    m.equip.forEach((e, i) => {
      if (e.cd > 0 || I.equip >= 0) return;
      let use = false;
      switch (e.id) {
        case 'aegis': use = under && m.shield < m.stats.maxShield * 0.3; break;
        case 'repair': use = m.hp < m.stats.maxHp * 0.55; break;
        case 'boost': use = (this.tactic === 'flank' || this.tactic === 'push') && dist > 30 && dist < 80; break;
        case 'servo': use = m.pos.distanceTo(this.goal) > 35; break;
        case 'target': use = this.visible && dist < 80; break;
        case 'ecm': use = under && m.recentDamage > 40; break;
        case 'capacitor': use = m.shield <= 1 && under; break;
        case 'drone': use = this.visible; break;
      }
      if (use) I.equip = i;
    });
  }

  // ---------------- per-frame ----------------
  update(dt) {
    const m = this.mech, g = this.game, I = m.intent, d = this.diff;
    // bookkeeping for adaptation
    const hpNow = m.hp + m.shield;
    if (hpNow < this.lastHp) this.tacticTaken += this.lastHp - hpNow;
    this.lastHp = hpNow;
    this.tacticT += dt;
    this.perceiveT -= dt;
    if (this.perceiveT <= 0) { this.perceiveT = 0.15 + Math.random() * 0.05; this.perceive(); }
    this.thinkT -= dt;
    if (this.thinkT <= 0) { this.thinkT = d.think * rand(0.8, 1.2); this.think(); }
    if (this.visible) this.seeTime += dt; else this.seeTime = 0;
    if (this.reactT > 0) this.reactT -= dt;

    // support healing aura
    if (this.role.heals) {
      this.healT -= dt;
      if (this.healT <= 0) {
        this.healT = 1.0;
        for (const o of g.mechs) {
          if (o === m || !o.alive || o.team !== m.team || o.isBoss) continue;
          if (o.pos.distanceTo(m.pos) < 28 && o.hp < o.stats.maxHp) {
            o.hp = Math.min(o.stats.maxHp, o.hp + o.stats.maxHp * 0.035);
            g.effects.tracer(m.center(_v).clone(), o.center(_t).clone(), 0x66ff99, 0.25, 0.25);
          }
        }
      }
    }

    this.move(dt);
    this.aimAndFire(dt);
    this.dodge(dt);
  }

  move(dt) {
    const m = this.mech, g = this.game, I = m.intent, arena = g.arena, nav = arena.nav;
    // path following
    this.repathT -= dt;
    const goalMoved = this.pathGoal.distanceTo(this.goal) > 5;
    if ((goalMoved || this.repathT <= 0) && this.repathT < 0.8) {
      this.repathT = 1.2 + Math.random() * 0.5;
      this.pathGoal.copy(this.goal);
      if (nav.clearLine(m.pos.x, m.pos.z, this.goal.x, this.goal.z)) this.path = [{ x: this.goal.x, z: this.goal.z }];
      else this.path = nav.findPath(m.pos.x, m.pos.z, this.goal.x, this.goal.z) || [{ x: this.goal.x, z: this.goal.z }];
      this.pathIdx = 0;
    }
    let dx = 0, dz = 0;
    if (this.path && this.pathIdx < this.path.length) {
      const wp = this.path[this.pathIdx];
      dx = wp.x - m.pos.x; dz = wp.z - m.pos.z;
      const dd = Math.hypot(dx, dz);
      if (dd < 2.5 && this.pathIdx < this.path.length - 1) this.pathIdx++;
      const isLast = this.pathIdx >= this.path.length - 1;
      if (isLast && dd < 2.5) { dx = 0; dz = 0; }
      else if (dd > 0.01) { dx /= dd; dz /= dd; if (isLast && dd < 6) { dx *= dd / 6; dz *= dd / 6; } }
    }
    // strafing while engaged
    const engaged = this.visible && this.target && this.tactic !== 'retreat' && this.tactic !== 'snipe' && !(this.tactic === 'cover' && this.coverPhase === 'hide');
    if (engaged) {
      this.strafeT -= dt;
      if (this.strafeT <= 0) { this.strafeT = rand(0.8, 2.4) / this.diff.strafe; if (Math.random() < 0.6) this.strafeDir *= -1; }
      const tx = this.target.pos.x - m.pos.x, tz = this.target.pos.z - m.pos.z;
      const tl = Math.hypot(tx, tz) || 1;
      const k = (this.tactic === 'push' ? 0.35 : this.tactic === 'orbit' ? 0.4 : 0.75) * this.diff.strafe;
      const sx = -tz / tl * this.strafeDir, sz = tx / tl * this.strafeDir;
      if (nav.walkable(m.pos.x + sx * 5, m.pos.z + sz * 5)) { dx += sx * k; dz += sz * k; }
      else this.strafeDir *= -1;
    }
    // separation from allies
    for (const o of g.mechs) {
      if (o === m || !o.alive || o.team !== m.team) continue;
      const ox = m.pos.x - o.pos.x, oz = m.pos.z - o.pos.z;
      const od = Math.hypot(ox, oz), min = (m.radius + o.radius) * 2.5;
      if (od < min && od > 0.01) { dx += ox / od * (1 - od / min) * 1.2; dz += oz / od * (1 - od / min) * 1.2; }
    }
    // obstacle feelers
    const len = Math.hypot(dx, dz);
    if (len > 0.05) {
      const ax = dx / len, az = dz / len;
      if (!nav.walkable(m.pos.x + ax * 4, m.pos.z + az * 4) || (nav.isHazard(m.pos.x + ax * 4, m.pos.z + az * 4) && !nav.isHazard(m.pos.x, m.pos.z))) {
        let found = false;
        for (const ang of [0.6, -0.6, 1.2, -1.2, 1.8, -1.8]) {
          const c = Math.cos(ang), s = Math.sin(ang);
          const rx = ax * c - az * s, rz = ax * s + az * c;
          if (nav.walkable(m.pos.x + rx * 4, m.pos.z + rz * 4)) { dx = rx * len; dz = rz * len; found = true; break; }
        }
        if (!found) this.repathT = 0;
      }
    }
    I.move.set(dx, dz);
    if (I.move.length() > 1) I.move.normalize();
    // sprint when travelling far without a fight, or retreating
    const far = m.pos.distanceTo(this.goal) > 30;
    I.sprint = (far && !this.visible) || (this.tactic === 'retreat' && far) || (this.tactic === 'flank' && far && m.energy > 50);
    // stuck detection
    this.stuckCheck -= dt;
    if (this.stuckCheck <= 0) {
      this.stuckCheck = 0.8;
      const moved = this.lastPos.distanceTo(m.pos);
      if (I.move.length() > 0.4 && moved < 1.5) {
        this.stuckT++;
        if (m.onGround) I.jump = true;
        if (this.stuckT > 1) { this.repathT = 0; this.strafeDir *= -1; this.goal.copy(arena.randomPointNear(m.pos.x, m.pos.z, 15)); }
      } else this.stuckT = 0;
      this.lastPos.copy(m.pos);
    }
    // jumpy roles hop during fights
    I.jet = !m.onGround && m.vel.y < 2 && m.energy > 40 && Math.random() < 0.5 && this.role.jumpy > 0.3;
    if (engaged && m.onGround && Math.random() < this.role.jumpy * dt * 0.6) I.jump = true;
  }

  aimAndFire(dt) {
    const m = this.mech, g = this.game, I = m.intent, d = this.diff, T = this.target;
    I.fire[0] = I.fire[1] = false;
    I.lock = null;
    if (!T || !T.alive) { I.aim.copy(m.pos).add(_v.set(Math.sin(m.legYaw) * 30, m.height * 0.8, Math.cos(m.legYaw) * 30)); return; }
    const tc = T.center(_t);
    if (!this.visible) {
      // look toward last known position
      I.aim.set(this.lastSeen.x, this.lastSeen.y + T.height * 0.5, this.lastSeen.z);
      return;
    }
    const eye = m.eye(_e);
    const dist = eye.distanceTo(tc);
    // predictive lead using primary projectile speed
    const w0 = m.weapons[0].def;
    const sp = w0.kind === 'hitscan' || w0.kind === 'beam' ? 1e9 : (w0.speed || 120);
    const lead = Math.min(dist / sp, 1.2) * d.lead;
    _q.copy(tc);
    if (T.vel) _q.addScaledVector(T.vel, lead);
    // aim error: drifting offset, larger on fresh acquisition, moving targets, ECM and cloak
    this.errT -= dt;
    if (this.errT <= 0) {
      this.errT = rand(0.25, 0.5);
      const tLat = T.vel ? Math.hypot(T.vel.x, T.vel.z) : 0;
      const track = 1 + 1.4 * Math.exp(-this.seeTime * d.track * 1.6);
      let mag = dist * d.aimErr * track * (1 + tLat / 18 * (1 - d.lead * 0.5));
      if (T.buffs && T.buffs.ecm) mag *= 2.5;
      if (T.cloaked) mag *= 3;
      if (m.sprinting || !m.onGround) mag *= 1.3;
      this.errOff.randomDirection().multiplyScalar(mag);
      this.errOff.y *= 0.6;
    }
    I.aim.copy(_q).add(this.errOff);
    I.lock = T;
    // firing permission
    const token = this.squad.hasToken(this);
    if (this.reactT > 0 || (!token && Math.random() > 0.02)) return;
    if (this.tactic === 'cover' && this.coverPhase === 'hide' && this.coverPt) return;
    // burst / pause rhythm
    if (this.burstT > 0) {
      this.burstT -= dt;
      if (this.burstT <= 0) this.pauseT = rand(...d.pause) * (this.role.aggression > 0.9 ? 0.6 : 1);
    } else {
      this.pauseT -= dt;
      if (this.pauseT <= 0) this.burstT = rand(...d.burst);
      else return;
    }
    // muzzle line of fire (don't waste shots into walls)
    if (!g.arena.lineOfSight(eye, tc)) return;
    const dd = m.pos.distanceTo(T.pos);
    for (let s = 0; s < m.weapons.length; s++) {
      const w = m.weapons[s], wd = w.def;
      if (dd > wd.range * 0.95) continue;
      if (wd.pellets && dd > 38) continue;
      if (wd.kind === 'lob' && dd < 22) continue;
      if (wd.kind === 'missile' && dd < 12) continue;
      if (w.usesHeat && (w.heat > (d === AI_DIFF.easy ? 98 : 82))) continue;
      if (wd.kind === 'hitscan' && this.seeTime < 0.6 / d.track) continue; // line up precision shots
      I.fire[s] = true;
      if (wd.kind === 'hitscan' && w.ready()) this.snipeShots++;
    }
  }

  dodge(dt) {
    const m = this.mech, d = this.diff, I = m.intent;
    this.dodgeT -= dt;
    if (d.dodge <= 0 || this.dodgeT > 0) return;
    this.dodgeT = 0.25;
    const threat = this.game.projectiles.threatsTo(m, 0.55);
    if (!threat || Math.random() > d.dodge) return;
    this.dodgeT = 1.2 / d.dodge;
    const v = threat.vel;
    const side = Math.random() < 0.5 ? 1 : -1;
    I.move.set(-v.z * side, v.x * side).normalize();
    if (m.dashCharges > 0 && m.energy > m.stats.dashCost + 10) I.dash = true;
    else if (m.onGround) I.jump = true;
  }
}
