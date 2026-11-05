// Game mode controllers: Survival, Elimination, Boss, Domination, Challenge.
import * as THREE from 'three';
import { ELIM_SIZES, BOSSES, CHALLENGES, ENEMY_TYPES } from './data.js';
import { rand, pick, shuffle, fmtTime } from './util.js';

class ModeBase {
  constructor(game, cfg) { this.game = game; this.cfg = cfg; this.result = null; this.time = 0; this.respawns = false; }
  start() {}
  update(dt) { this.time += dt; }
  onKill() {}
  onPlayerDeath() { this.end(false, 'Your mech was destroyed'); }
  end(win, reason) { if (!this.result) this.result = { win, reason }; }
  hud() { return { title: '', obj: '', score: '' }; }
  baseRewards() { return { credits: 0, xp: 0, rp: 0 }; }
  get enemiesAlive() { return this.game.mechs.filter((m) => m.alive && m.team === 1).length; }
}

// ---------------------------------------------------------------------------
const TYPE_COST = { scout: 1, assault: 1.2, flanker: 1.2, sniper: 1.4, support: 1.5, tank: 2, wraith: 2, heavy: 2.5, elite: 3 };
function typesForWave(w) {
  const t = ['scout', 'assault'];
  if (w >= 3) t.push('flanker');
  if (w >= 4) t.push('sniper');
  if (w >= 6) t.push('tank', 'support');
  if (w >= 8) t.push('heavy');
  if (w >= 11) t.push('wraith');
  if (w >= 13) t.push('elite');
  return t;
}
const SPECIALS = [
  { name: 'WARLORD', sub: 'A heavily armored Juggernaut warlord leads the assault.', spawn: [['heavy', { scale: 1.3, hpMul: 3.2, palette: 'elite', name: 'WARLORD', miniboss: true }], ['support', {}], ['assault', {}]] },
  { name: 'ACE SQUADRON', sub: 'Three elite pilots fighting as a team.', spawn: [['elite', { name: 'ACE' }], ['elite', { name: 'ACE' }], ['elite', { name: 'ACE' }]] },
  { name: 'COLOSSUS', sub: 'A titan-class war machine with escort.', spawn: [['tank', { scale: 1.45, hpMul: 4, palette: 'elite', name: 'COLOSSUS', miniboss: true }], ['support', {}], ['sniper', {}], ['flanker', {}]] },
  { name: 'SPECTER PACK', sub: 'Phase-shifting hunters close in from all sides.', spawn: [['wraith', { palette: 'elite' }], ['wraith', { palette: 'elite' }], ['wraith', { palette: 'elite' }], ['flanker', {}]] },
  { name: 'APEX PREDATOR', sub: 'An enhanced Apex hunts you personally.', spawn: [['elite', { scale: 1.35, hpMul: 3.5, name: 'APEX PREDATOR', miniboss: true }], ['scout', {}], ['scout', {}], ['support', {}]] },
];

export class SurvivalMode extends ModeBase {
  constructor(game, cfg) {
    super(game, cfg);
    this.wave = 0; this.queue = []; this.intermission = 3; this.maxAlive = 6; this.cleared = 0; this.special = null;
  }
  start() { this.game.announce('ARENA SURVIVAL', 'Survive as many waves as you can.', 2.5); }
  nextWave() {
    this.wave++;
    const w = this.wave;
    this.queue = [];
    const hpMul = 1 + Math.max(0, w - 4) * 0.045;
    if (w % 5 === 0) {
      const s = SPECIALS[(w / 5 - 1) % SPECIALS.length];
      this.special = s;
      for (const [type, o] of s.spawn) this.queue.push([type, { hpMul: (o.hpMul || 1) * hpMul, ...o, hpMul: (o.hpMul || 1) * hpMul }]);
      this.game.announce(`WAVE ${w} — ${s.name}`, s.sub, 3);
      this.game.sound('alarm', null, 0.8);
    } else {
      this.special = null;
      let budget = 0.5 + w * 1.15;
      const types = typesForWave(w);
      const newest = types[types.length - 1];
      if ((w === 3 || w === 4 || w === 6 || w === 8 || w === 11 || w === 13)) { this.queue.push([newest, { hpMul }]); budget -= TYPE_COST[newest]; }
      while (budget > 0.8) {
        const t = pick(types);
        this.queue.push([t, { hpMul }]); budget -= TYPE_COST[t];
      }
      this.game.announce(`WAVE ${w}`, `${this.queue.length} hostiles inbound`, 2);
      this.game.sound('wave', null, 1);
    }
    this.maxAlive = Math.min(3 + Math.floor(w / 3), 7);
  }
  update(dt) {
    super.update(dt);
    const g = this.game;
    if (this.intermission > 0) {
      this.intermission -= dt;
      if (this.intermission <= 0) this.nextWave();
      return;
    }
    const alive = this.enemiesAlive;
    if (this.queue.length && alive < this.maxAlive) {
      this.spawnT = (this.spawnT || 0) - dt;
      if (this.spawnT <= 0) {
        this.spawnT = Math.max(0.8, 5 - this.wave * 0.5);
        const [type, o] = this.queue.shift();
        g.spawnEnemy(type, g.farSpawn(), o);
      }
    }
    if (!this.queue.length && this.enemiesAlive === 0) {
      this.cleared = this.wave;
      g.contract('waves', 1);
      const p = g.player;
      p.hp = Math.min(p.stats.maxHp, p.hp + p.stats.maxHp * (this.wave < 5 ? 0.6 : 0.35)); p.shield = p.stats.maxShield;
      for (const e of p.equip) e.cd = Math.min(e.cd, 2);
      for (const w of p.weapons) { if (w.usesAmmo) { w.ammo = w.def.mag; w.reloadT = 0; } }
      g.announce(`WAVE ${this.wave} CLEARED`, 'Armor repaired, modules recharged. Next wave in 6s.', 2.5);
      g.spawnPickup();
      this.intermission = 6;
    }
  }
  onPlayerDeath() { this.end(this.cleared >= 5, `Survived ${this.cleared} wave${this.cleared === 1 ? '' : 's'}`); }
  hud() {
    return {
      title: 'ARENA SURVIVAL',
      obj: this.intermission > 0 ? `Next wave in ${Math.ceil(this.intermission)}` : (this.special ? `SPECIAL: ${this.special.name} — ` : '') + `${this.enemiesAlive + this.queue.length} hostiles remaining`,
      score: `WAVE ${Math.max(1, this.wave)}`,
    };
  }
  baseRewards() {
    const w = this.cleared;
    return { credits: 150 * w + 25 * w * w, xp: 90 * w + 60, rp: Math.floor(w / 5) * 6 };
  }
}

// ---------------------------------------------------------------------------
const ELIM_POOL_BY_LEVEL = (lvl) => {
  const t = ['assault', 'scout', 'assault'];
  if (lvl >= 3) t.push('flanker', 'sniper');
  if (lvl >= 5) t.push('support', 'tank');
  if (lvl >= 9) t.push('heavy', 'wraith');
  if (lvl >= 13) t.push('elite');
  return t;
};
export class EliminationMode extends ModeBase {
  constructor(game, cfg) { super(game, cfg); this.size = ELIM_SIZES[cfg.size || 'skirmish']; }
  start() {
    const g = this.game;
    const pool = ELIM_POOL_BY_LEVEL(g.pilotLevel);
    const sp = shuffle(g.arena.enemySpawns.slice());
    for (let i = 0; i < this.size.enemies; i++) g.spawnEnemy(i === 0 && this.size.enemies >= 3 ? 'support' : pick(pool), sp[i % sp.length]);
    const allyRoles = ['assault', 'sniper', 'support', 'tank'];
    for (let i = 0; i < this.size.allies; i++) g.spawnAlly(allyRoles[i % allyRoles.length], g.arena.playerSpawns[(i + 1) % g.arena.playerSpawns.length]);
    g.announce('ELIMINATION', `${this.size.name}: destroy the enemy team.`, 2.5);
  }
  update(dt) {
    super.update(dt);
    const g = this.game;
    if (this.enemiesAlive === 0) this.end(true, 'Enemy team eliminated');
    const friends = g.mechs.filter((m) => m.alive && m.team === 0).length;
    if (friends === 0) this.end(false, 'Your team was eliminated');
  }
  onPlayerDeath() {
    const g = this.game;
    const allies = g.mechs.filter((m) => m.alive && m.team === 0 && !m.isPlayer).length;
    if (allies === 0) this.end(false, 'Your team was eliminated');
    else { g.announce('MECH DESTROYED', 'Spectating allies — they can still win the match.', 3); g.spectate = true; }
  }
  hud() {
    const g = this.game;
    const allies = g.mechs.filter((m) => m.alive && m.team === 0).length;
    return { title: 'ELIMINATION · ' + this.size.name.toUpperCase(), obj: 'Destroy all enemy mechs', score: `${allies} vs ${this.enemiesAlive}` };
  }
  baseRewards() {
    const k = this.game.matchStats.kills;
    return { credits: Math.round((500 + k * 180) * this.size.reward), xp: Math.round((220 + k * 70) * this.size.reward), rp: 0 };
  }
}

// ---------------------------------------------------------------------------
export class BossMode extends ModeBase {
  constructor(game, cfg) { super(game, cfg); this.bossId = cfg.boss; this.def = BOSSES[cfg.boss]; }
  start() {
    const g = this.game;
    this.boss = g.spawnBoss(this.bossId, g.arena.enemySpawns[0]);
    g.startIntro(this.boss, this.def);
  }
  update(dt) {
    super.update(dt);
    if (this.boss && !this.boss.alive) this.end(true, `${this.def.name} destroyed`);
  }
  hud() {
    const b = this.boss;
    const ctrl = b && b.bossCtrl;
    let obj = 'Destroy the boss';
    if (this.bossId === 'overlord' && ctrl) obj = ctrl.shieldDownT > 0 ? `AEGIS DOWN: ${Math.ceil(ctrl.shieldDownT)}s — ATTACK!` : `Destroy relay pylons (${ctrl.pylons.filter((p) => p.alive).length} remaining)`;
    if (this.bossId === 'irongiant' && ctrl) obj = ctrl.venting > 0 ? 'BASTION VENTING — ATTACK!' : 'Flank it: shoot the glowing back reactor';
    if (this.bossId === 'omega' && ctrl && ctrl.fortress) obj = `Destroy energy cores (${ctrl.cores.filter((c) => c.alive).length} remaining)`;
    if (this.bossId === 'phantomzero' && ctrl) obj = ctrl.state === 'stunned' ? 'VULNERABLE — PUNISH IT!' : 'Dodge the lunge, then strike';
    return { title: 'BOSS BATTLE', obj, score: fmtTime(this.time) };
  }
  baseRewards() {
    if (!this.result || !this.result.win) return { credits: 400, xp: 250, rp: 2 };
    const first = !this.game.profile.bosses[this.bossId];
    const r = this.def.reward;
    return { credits: first ? r.credits : Math.round(r.credits * 0.5), xp: r.xp, rp: first ? r.rp : Math.round(r.rp * 0.4) };
  }
}

// ---------------------------------------------------------------------------
export class DominationMode extends ModeBase {
  constructor(game, cfg) {
    super(game, cfg);
    this.respawns = true; this.target = 200; this.scores = [0, 0]; this.limit = 480; this.tickT = 1;
    this.points = []; this.assignT = 0; this.respawnQ = [];
  }
  start() {
    const g = this.game;
    const names = ['A', 'B', 'C'];
    this.points = g.arena.points.slice(0, 3).map((p, i) => ({ name: names[i], pos: p.clone(), radius: 11, owner: -1, prog: 0, mesh: g.makePointMarker(p, 11) }));
    const pool = ELIM_POOL_BY_LEVEL(g.pilotLevel).filter((t) => t !== 'sniper');
    const n = g.difficulty === 'expert' || g.difficulty === 'hard' ? 4 : 3;
    const sp = g.arena.enemySpawns;
    for (let i = 0; i < n; i++) g.spawnEnemy(pick(pool), sp[i % sp.length]);
    g.spawnAlly('assault', g.arena.playerSpawns[1]); g.spawnAlly('support', g.arena.playerSpawns[2]);
    if (n === 4) g.spawnAlly('tank', g.arena.playerSpawns[3]);
    g.announce('DOMINATION', `Capture and hold the points. First to ${this.target}.`, 2.5);
  }
  update(dt) {
    super.update(dt);
    const g = this.game;
    // capture logic
    for (const p of this.points) {
      let c0 = 0, c1 = 0;
      for (const m of g.mechs) {
        if (!m.alive) continue;
        if (Math.hypot(m.pos.x - p.pos.x, m.pos.z - p.pos.z) < p.radius && m.pos.y < 6) { if (m.team === 0) c0++; else c1++; }
      }
      p.contested = c0 > 0 && c1 > 0;
      if (!p.contested && (c0 || c1)) {
        const dir = c0 ? 1 : -1, n = Math.min(3, c0 + c1);
        const before = p.prog;
        p.prog = Math.max(-1, Math.min(1, p.prog + dir * (0.22 + 0.08 * n) * dt));
        if (p.prog >= 1 && p.owner !== 0) { p.owner = 0; g.announceSmall(`POINT ${p.name} CAPTURED`); g.sound('capture', null, 1); if (c0 && g.player.alive && g.player.pos.distanceTo(p.pos) < p.radius) g.contract('captures', 1); g.matchStats.captures++; }
        if (p.prog <= -1 && p.owner !== 1) { p.owner = 1; g.announceSmall(`ENEMY CAPTURED POINT ${p.name}`); g.sound('alarm', null, 0.6); }
        if (before > 0 && p.prog <= 0 && p.owner === 0) p.owner = -1;
        if (before < 0 && p.prog >= 0 && p.owner === 1) p.owner = -1;
      }
      g.updatePointMarker(p);
    }
    // scoring
    this.tickT -= dt;
    if (this.tickT <= 0) {
      this.tickT = 1;
      for (const p of this.points) if (p.owner >= 0) this.scores[p.owner] += 1;
    }
    if (this.scores[0] >= this.target) this.end(true, 'Score limit reached');
    else if (this.scores[1] >= this.target) this.end(false, 'Enemy reached the score limit');
    else if (this.time >= this.limit) this.end(this.scores[0] > this.scores[1], 'Time limit reached');
    // AI objective assignment
    this.assignT -= dt;
    if (this.assignT <= 0) { this.assignT = 4; this.assign(0); this.assign(1); }
    // respawns
    for (let i = this.respawnQ.length - 1; i >= 0; i--) {
      const r = this.respawnQ[i];
      r.t -= dt;
      if (r.t <= 0) {
        this.respawnQ.splice(i, 1);
        if (r.player) g.respawnPlayer();
        else if (r.team === 1) g.spawnEnemy(r.type, g.farSpawn());
        else g.spawnAlly(r.type, pick(g.arena.playerSpawns));
      }
    }
  }
  assign(team) {
    const g = this.game;
    const ais = g.mechs.filter((m) => m.alive && m.team === team && m.controller && m.controller.squad);
    const mine = this.points.filter((p) => p.owner === team);
    const others = this.points.filter((p) => p.owner !== team);
    ais.forEach((m, i) => {
      let p;
      const threatened = mine.find((pt) => pt.contested || (team === 0 ? pt.prog < 0.9 : pt.prog > -0.9));
      if (threatened && i % 3 === 0) p = threatened;
      else if (others.length) p = others.sort((a, b) => a.pos.distanceTo(m.pos) - b.pos.distanceTo(m.pos))[i % Math.min(2, others.length)];
      else p = mine[i % mine.length];
      if (p) m.controller.objective = { pos: p.pos, radius: p.radius * 0.8 };
    });
  }
  onKill(victim) {
    if (victim.isPlayer) return;
    this.respawnQ.push({ t: 7, team: victim.team, type: victim.enemyType || victim.role || 'assault' });
  }
  onPlayerDeath() {
    this.game.announce('MECH DESTROYED', 'Redeploying in 6 seconds...', 2.5);
    this.respawnQ.push({ t: 6, player: true });
    this.game.respawnAt = this.game.time + 6;
  }
  hud() {
    return {
      title: 'DOMINATION', obj: this.points.map((p) => p.name).join(' · '),
      score: `${this.scores[0]} — ${this.scores[1]}`, points: this.points, timeLeft: this.limit - this.time,
    };
  }
  baseRewards() {
    const win = this.result && this.result.win;
    return { credits: 700 + this.scores[0] * 6 + (win ? 600 : 0), xp: 300 + this.scores[0] * 2 + (win ? 250 : 0), rp: win ? 3 : 0 };
  }
  dispose() { for (const p of this.points) this.game.scene.remove(p.mesh); }
}

// ---------------------------------------------------------------------------
export class ChallengeMode extends ModeBase {
  constructor(game, cfg) {
    super(game, cfg);
    this.def = CHALLENGES.find((c) => c.id === cfg.challenge);
    this.queue = this.def.enemies === 'endless' ? [] : this.def.enemies.slice();
    this.killed = 0; this.total = this.def.enemies === 'endless' ? 0 : this.def.enemies.length;
  }
  start() { this.game.announce(this.def.name.toUpperCase(), this.def.desc, 3.5); }
  update(dt) {
    super.update(dt);
    const g = this.game, d = this.def, mods = d.mods;
    const alive = this.enemiesAlive;
    if (d.enemies === 'endless') {
      if (alive < d.maxAlive) {
        this.spawnT = (this.spawnT || 1) - dt;
        if (this.spawnT <= 0) { this.spawnT = 3.5; g.spawnEnemy(pick(['assault', 'flanker', 'scout', 'tank', 'sniper']), g.farSpawn()); }
      }
    } else if (this.queue.length && alive < d.maxAlive) {
      this.spawnT = (this.spawnT || 0) - dt;
      if (this.spawnT <= 0) { this.spawnT = 1.2; g.spawnEnemy(this.queue.shift(), g.farSpawn()); }
    }
    if (mods.surviveTime && this.time >= mods.surviveTime) this.end(true, 'Survived!');
    if (mods.timeLimit && this.time >= mods.timeLimit) this.end(false, 'Time limit exceeded');
    if (d.enemies !== 'endless' && !this.queue.length && this.enemiesAlive === 0 && this.time > 1) this.end(true, 'All targets destroyed');
  }
  onKill(victim) { if (victim.team === 1) this.killed++; }
  hud() {
    const d = this.def, mods = d.mods;
    let obj = d.enemies === 'endless' ? `Survive: ${fmtTime(mods.surviveTime - this.time)}` : `Destroyed ${this.killed}/${this.total}`;
    if (mods.timeLimit) obj += ` · Time left ${fmtTime(mods.timeLimit - this.time)}`;
    return { title: 'CHALLENGE · ' + d.name.toUpperCase(), obj, score: fmtTime(this.time) };
  }
  baseRewards() {
    const win = this.result && this.result.win;
    const first = win && !this.game.profile.challenges[this.def.id];
    const r = this.def.reward;
    if (!win) return { credits: 200 + this.killed * 100, xp: 150 + this.killed * 40, rp: 0 };
    return { credits: first ? r.credits : Math.round(r.credits * 0.35), xp: first ? r.xp : Math.round(r.xp * 0.5), rp: first ? r.rp : 2 };
  }
}

export function createMode(game, cfg) {
  switch (cfg.mode) {
    case 'survival': return new SurvivalMode(game, cfg);
    case 'elimination': return new EliminationMode(game, cfg);
    case 'boss': return new BossMode(game, cfg);
    case 'domination': return new DominationMode(game, cfg);
    case 'challenge': return new ChallengeMode(game, cfg);
  }
  throw new Error('Unknown mode ' + cfg.mode);
}
