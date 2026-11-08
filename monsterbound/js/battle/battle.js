'use strict';
// =====================================================================================
// BATTLE SCENE — turn-based engine + presentation.
// opts: { kind:'wild'|'trainer', enemy:[mons], trainer:{name,title,app,ai,items,mega,pay,lines}, env, music,
//         legendary, noRun, noCatch, noItems, noExp, facility, canLose, onMega }
// result: { outcome:'win'|'lose'|'run'|'caught', caught:mon }
// =====================================================================================
const STAGE_MUL = (s) => (s >= 0 ? (2 + s) / 2 : 2 / (2 - s));
const ACC_MUL = (s) => (s >= 0 ? (3 + s) / 3 : 3 / (3 - s));

class BattleScene {
  constructor(opts) {
    this.opts = opts;
    this.kind = opts.kind || 'wild';
    this.env = opts.env || 'grass';
    this.time = MB.World ? MB.World.timeOfDay() : 'day';
    const S = MB.state;
    this.p = this.makeSide(S.party, 'p');
    this.e = this.makeSide(opts.enemy, 'e');
    this.weather = opts.weather ? { type: opts.weather, turns: 999 } : null;
    this.msg = ''; this.msgChars = 0;
    this.particles = [];
    this.fx = { p: this.fxState(), e: this.fxState() };
    this.flashT = 0; this.shakeT = 0; this.darken = 0; this.ringT = -1;
    this.menu = null; // current input menu
    this.turn = 0;
    this.tweens = [];
    this.result = null;
    this.capsule = null;
    this.trainerSlide = { p: 1, e: 1 };
    this.escapeTries = 0;
    this.usedItems = 0;
  }
  fxState() { return { dx: 0, dy: 0, alpha: 1, scale: 1, visible: false, flash: 0, glow: 0, white: 0 }; }
  makeSide(party, id) {
    const s = { id, party, idx: 0, st: this.freshStages(), vol: {}, mega: false, megaUsed: false, participants: new Set() };
    s.idx = party.findIndex((m) => m.hp > 0 && !m.egg);
    if (s.idx < 0) s.idx = 0;
    return s;
  }
  freshStages() { return { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, acc: 0, eva: 0 }; }
  mon(side) { return side.party[side.idx]; }
  other(side) { return side === this.p ? this.e : this.p; }
  spOf(side) { return MB.SP[this.mon(side).sp]; }
  typesOf(side) { const sp = this.spOf(side); if (side.vol.adaptType) return [side.vol.adaptType]; return side.mega && sp.mega ? sp.mega.types : sp.types; }
  abilityOf(side) { const sp = this.spOf(side); return side.mega && sp.mega ? sp.mega.ability : MB.Mon.abilityId(this.mon(side)); }
  nameOf(side) { const m = this.mon(side); const n = side.mega ? 'Mega ' + m.name : m.name; return side === this.e ? (this.kind === 'wild' ? 'The wild ' + n : 'The foe\'s ' + n) : n; }
  shortName(side) { const m = this.mon(side); return side.mega ? 'Mega ' + m.name : m.name; }
  statsOf(side) { const sp = this.spOf(side); return MB.Mon.stats(this.mon(side), side.mega && sp.mega ? sp.mega.base : null); }
  maxHp(side) { return MB.Mon.stats(this.mon(side)).hp; }
  stat(side, k) {
    let v = this.statsOf(side)[k] * STAGE_MUL(side.st[k]);
    const m = this.mon(side), ab = this.abilityOf(side);
    if (k === 'spe') {
      if (m.status === 'par') v *= 0.5;
      if (ab === 'quick_feet' && m.status) v *= 1.5;
      if (ab === 'swift_current' && this.weather && this.weather.type === 'rain') v *= 2;
      if (ab === 'sun_dancer' && this.weather && this.weather.type === 'sun') v *= 2;
      if (m.item === 'swift_boots') v *= 1.2;
    }
    if (k === 'atk') { if (ab === 'colossal_might') v *= 2; if (ab === 'grit' && m.status) v *= 1.5; }
    if ((k === 'def' || k === 'spd') && m.item === 'ever_glow' && MB.SP[m.sp].evo.length) v *= 1.5;
    if (k === 'spd' && this.weather && this.weather.type === 'sand' && this.typesOf(side).includes('Earth')) v *= 1.5;
    if (k === 'def' && this.weather && this.weather.type === 'snow' && this.typesOf(side).includes('Ice')) v *= 1.5;
    return Math.max(1, Math.floor(v));
  }

  // ---------------- async presentation helpers ----------------
  say(text, hold) {
    this.msg = text; this.msgChars = 0; this.msgDone = false;
    return new Promise((res) => { this.msgRes = res; this.msgHold = hold !== undefined ? hold : 0.55; this.msgT = 0; });
  }
  tween(dur, fn) { return new Promise((res) => this.tweens.push({ t: 0, dur, fn, res })); }
  wait(s) { return this.tween(s, () => {}); }
  async animHp(side, to) {
    const m = this.mon(side); const from = m.hp; to = MB.clamp(Math.round(to), 0, this.maxHp(side));
    const dur = Math.min(0.9, 0.25 + Math.abs(to - from) / this.maxHp(side));
    await this.tween(dur, (t) => { m.hp = Math.round(from + (to - from) * t); });
    m.hp = to;
  }
  burst(x, y, color, n, spread, opts = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = (opts.speed || 40) * (0.4 + Math.random());
      this.particles.push({ x, y, vx: Math.cos(a) * sp * (spread || 1), vy: Math.sin(a) * sp - (opts.up || 0), life: opts.life || 0.6, max: opts.life || 0.6, c: color, s: opts.size || 2, g: opts.grav || 0 });
    }
  }
  pos(side) { return side === this.p ? { x: 72, y: 128 } : { x: 236, y: 62 }; }

  // ---------------- lifecycle ----------------
  enter() {
    MB.audio.play(this.opts.music || (this.kind === 'wild' ? (this.opts.legendary ? 'legend' : 'wild') : 'trainer'));
    this.run().catch((e) => { console.error(e); MB.toast && MB.toast('Battle error: ' + e.message, '#802020'); this.close(this.result || { outcome: 'run' }); });
  }
  async run() {
    const S = MB.state;
    // intro
    this.introT = 0;
    await this.tween(0.6, (t) => { this.introT = t; });
    if (this.kind === 'wild') {
      this.fx.e.visible = true;
      this.registerSeen(this.mon(this.e));
      MB.audio.cry(this.mon(this.e).sp);
      if (this.mon(this.e).shiny) { this.burst(236, 50, '#fff8a0', 20, 1, { speed: 50 }); MB.audio.sfx('levelup'); }
      await this.say(this.opts.legendary ? `The legendary ${this.mon(this.e).name} appeared!` : `A wild ${this.mon(this.e).name}${this.mon(this.e).shiny ? ' (Radiant!)' : ''} appeared!`, 0.8);
    } else {
      const tr = this.opts.trainer;
      await this.say(`${tr.title ? tr.title + ' ' : ''}${tr.name} wants to battle!`, 0.6);
      if (tr.intro) await this.say(tr.intro, 1.0);
      await this.tween(0.4, (t) => { this.trainerSlide.e = 1 - t; });
      await this.sendOut(this.e, true);
    }
    await this.tween(0.35, (t) => { this.trainerSlide.p = 1 - t; });
    await this.sendOut(this.p, true);
    await this.entryAbilities();
    // main loop
    while (!this.result) {
      this.turn++;
      const pAct = await this.choosePlayerAction();
      if (this.result) break;
      const eAct = this.chooseEnemyAction();
      await this.resolveTurn(pAct, eAct);
      if (this.result) break;
      await this.endOfTurn();
      if (this.result) break;
      await this.handleFaints();
    }
    // cleanup
    for (const side of [this.p, this.e]) side.mega = false;
    for (const m of S.party) { if (m.vol) delete m.vol; }
    if (this.result.outcome === 'lose' && !this.opts.canLose && !this.opts.facility) {
      await this.say(`${S.name} is out of usable creatures!`, 0.8);
    }
    await this.tween(0.4, (t) => { this.fadeOutT = t; });
    this.close(this.result);
  }
  registerSeen(mon) { if (MB.Dex) MB.Dex.seen(mon.sp); }

  async sendOut(side, first) {
    const m = this.mon(side);
    side.st = this.freshStages(); side.vol = {};
    side.participants.add(m.uid);
    if (side === this.p) this.e.participants = this.e.participants || new Set();
    if (side === this.e) { this.registerSeen(m); this.p.participants = new Set([this.mon(this.p).uid]); }
    const fx = this.fx[side.id];
    fx.visible = true; fx.scale = 0.1; fx.white = 1;
    const { x, y } = this.pos(side);
    await this.say(side === this.p ? (first ? `Go! ${m.name}!` : `Your turn, ${m.name}!`) : `${this.opts.trainer.name} sent out ${m.name}!`, 0.15);
    MB.audio.sfx('throw');
    this.burst(x, y - 20, '#ffffff', 14, 1, { speed: 60 });
    await this.tween(0.3, (t) => { fx.scale = 0.1 + 0.9 * t; fx.white = 1 - t; });
    MB.audio.cry(m.sp);
    if (m.shiny) { this.burst(x, y - 25, '#fff8a0', 16, 1, { speed: 45 }); await this.wait(0.3); }
    // trainer AI mega on entry for its ace
    if (side === this.e && this.opts.trainer && this.opts.trainer.mega && !side.megaUsed && MB.SP[m.sp].mega && m.item === MB.SP[m.sp].mega.stone) {
      await this.doMega(side);
    }
    if (!first) await this.entryAbility(side);
  }
  async entryAbilities() { for (const s of this.speedOrder()) await this.entryAbility(s); }
  async entryAbility(side) {
    const ab = this.abilityOf(side), foe = this.other(side);
    const W = { sun_call: 'sun', rain_call: 'rain', sand_call: 'sand', snow_call: 'snow', leviathan: 'rain' };
    if (W[ab]) await this.setWeather(W[ab], `${this.nameOf(side)}'s ${MB.ABILITIES[ab].name}`);
    if (ab === 'menace' && this.mon(foe).hp > 0) { await this.say(`${this.nameOf(side)}'s Menace cowed the opponent!`); await this.changeStage(foe, 'atk', -1, side); }
    if (ab === 'pressure_aura') await this.say(`${this.nameOf(side)} is exerting its pressure!`);
  }
  speedOrder() { return this.stat(this.p, 'spe') >= this.stat(this.e, 'spe') ? [this.p, this.e] : [this.e, this.p]; }
  async setWeather(w, src) {
    const N = { sun: 'The sunlight turned harsh!', rain: 'It started to rain!', sand: 'A sandstorm kicked up!', snow: 'It started to snow!' };
    if (this.weather && this.weather.type === w) return;
    this.weather = { type: w, turns: 5 };
    await this.say((src ? src + ': ' : '') + N[w]);
  }

  // ---------------- player input ----------------
  choosePlayerAction() {
    return new Promise((res) => { this.menu = { mode: 'main', idx: this.lastMain || 0, res, megaOn: false }; this.msg = `What will ${this.mon(this.p).name} do?`; this.msgChars = 999; });
  }
  canMega(side) {
    const m = this.mon(side), sp = MB.SP[m.sp];
    return !side.megaUsed && !side.mega && sp.mega && m.item === sp.mega.stone && (side !== this.p || MB.state.keyItems.aether_gauntlet);
  }
  updateMenu() {
    const M = this.menu, I = MB.input;
    if (M.mode === 'main') {
      const prev = M.idx;
      if (I.pressed('right') && M.idx % 2 === 0) M.idx++;
      if (I.pressed('left') && M.idx % 2 === 1) M.idx--;
      if (I.pressed('down') && M.idx < 2) M.idx += 2;
      if (I.pressed('up') && M.idx >= 2) M.idx -= 2;
      if (prev !== M.idx) MB.audio.sfx('move');
      if (I.pressed('a')) {
        MB.audio.sfx('select'); this.lastMain = M.idx;
        if (M.idx === 0) { M.mode = 'fight'; M.midx = this.lastMove || 0; }
        else if (M.idx === 1) this.openBag();
        else if (M.idx === 2) this.openParty(false);
        else if (M.idx === 3) { if (this.kind !== 'wild' || this.opts.noRun) { this.menu = null; this.say(this.kind === 'wild' ? 'You can\'t escape!' : 'There\'s no running from a trainer battle!').then(() => this.reopen(M)); } else this.finishMenu({ type: 'run' }); }
      }
    } else if (M.mode === 'fight') {
      const mon = this.mon(this.p);
      const n = mon.moves.length;
      const hasMega = this.canMega(this.p);
      const total = n + (hasMega ? 1 : 0);
      const prev = M.midx;
      if (I.pressed('right') && M.midx % 2 === 0 && M.midx + 1 < n) M.midx++;
      if (I.pressed('left') && M.midx % 2 === 1 && M.midx < n) M.midx--;
      if (I.pressed('down')) { if (M.midx + 2 < n) M.midx += 2; else if (hasMega && M.midx < n) M.midx = n; }
      if (I.pressed('up')) { if (M.midx === n) M.midx = Math.max(0, n - 1 - ((n - 1) % 2)); else if (M.midx >= 2) M.midx -= 2; }
      if (prev !== M.midx) MB.audio.sfx('move');
      if (I.pressed('b')) { M.mode = 'main'; MB.audio.sfx('back'); return; }
      if (I.pressed('a')) {
        if (M.midx === n && hasMega) { M.megaOn = !M.megaOn; MB.audio.sfx(M.megaOn ? 'statup' : 'back'); return; }
        const mv = mon.moves[M.midx];
        if (mon.moves.every((m) => m.pp <= 0)) { this.finishMenu({ type: 'move', id: 'struggle', mega: M.megaOn }); return; }
        if (mv.pp <= 0) { MB.audio.sfx('error'); return; }
        if (this.p.vol.taunt && MB.MOVES[mv.id].cat === 'status') { MB.audio.sfx('error'); return; }
        this.lastMove = M.midx; MB.audio.sfx('select');
        this.finishMenu({ type: 'move', idx: M.midx, id: mv.id, mega: M.megaOn });
      }
      void total;
    }
  }
  reopen(M) { this.menu = M; M.mode = 'main'; this.msg = `What will ${this.mon(this.p).name} do?`; this.msgChars = 999; }
  finishMenu(act) { const M = this.menu; this.menu = null; M.res(act); }
  async openBag() {
    const M = this.menu; this.menu = null;
    if (this.opts.noItems) { await this.say('Items can\'t be used here!'); return this.reopen(M); }
    const res = await MB.Game.push(new MB.BagScene({ battle: this }));
    if (!res) return this.reopen(M);
    M.res(res);
  }
  async openParty(forced) {
    const M = this.menu; this.menu = null;
    const res = await MB.Game.push(new MB.PartyScene({ battle: this, forced, current: this.p.idx }));
    if (res === null || res === undefined || res < 0) {
      if (forced) return this.openParty(true);
      // opened mid-turn (e.g. the "switch?" prompt after a knockout): cancelling just keeps the current creature
      if (!M) return -1;
      return this.reopen(M);
    }
    if (M) M.res({ type: 'switch', to: res }); else return res;
  }

  // ---------------- AI ----------------
  chooseEnemyAction() {
    const side = this.e, mon = this.mon(side), foe = this.p;
    const ai = this.kind === 'wild' ? 0 : (this.opts.trainer.ai || 1);
    const usable = mon.moves.filter((m) => m.pp > 0);
    if (!usable.length) return { type: 'move', id: 'struggle' };
    // item use for trainers
    const tr = this.opts.trainer;
    if (tr && tr.items && tr.items.length && mon.hp > 0 && mon.hp / this.maxHp(side) < 0.25 && Math.random() < 0.6 + ai * 0.1) {
      return { type: 'item', id: tr.items.shift(), side: 'e' };
    }
    // switching
    if (ai >= 2 && Math.random() < 0.15 + ai * 0.1) {
      const threat = this.bestMoveVs(foe, side);
      if (threat.eff >= 2 && !side.vol.justSwitched) {
        let best = -1, bestScore = 0;
        side.party.forEach((m, i) => {
          if (i === side.idx || m.hp <= 0) return;
          const tps = MB.SP[m.sp].types;
          const inc = this.movesOf(this.mon(foe)).reduce((mx, mv) => Math.max(mx, mv.power ? MB.typeEff(mv.type, tps) : 0), 0);
          const score = (2 - inc) + m.hp / MB.Mon.maxHp(m);
          if (inc <= 1 && score > bestScore) { bestScore = score; best = i; }
        });
        if (best >= 0) return { type: 'switch', to: best };
      }
    }
    side.vol.justSwitched = false;
    if (ai === 0) {
      const dmg = usable.filter((m) => MB.MOVES[m.id].power > 0);
      const pick = Math.random() < 0.75 && dmg.length ? MB.pick(dmg) : MB.pick(usable);
      return { type: 'move', id: pick.id };
    }
    // score each move
    let best = null, bestS = -1;
    const foeMon = this.mon(foe);
    const hpFrac = mon.hp / this.maxHp(side);
    for (const mv of usable) {
      const M = MB.MOVES[mv.id];
      let s = 0;
      if (M.power > 0 || M.fixed) {
        const d = this.estimateDamage(side, foe, M);
        s = (d / Math.max(1, foeMon.hp)) * 100 * ((M.acc || 100) / 100);
        if (d >= foeMon.hp) s += 60 + (M.priority || 0) * 20;
      } else {
        for (const f of M.fx) {
          if (f.t === 'status' && !foeMon.status && !f.self) s += f.s === 'slp' ? 55 : f.s === 'tox' || f.s === 'brn' || f.s === 'par' ? 40 : f.s === 'cnf' && !foe.vol.cnf ? 25 : 0;
          if (f.t === 'stage' && f.self && side.st[f.stat] < 2 && hpFrac > 0.6) s += 30 * f.n;
          if (f.t === 'stage' && !f.self && foe.st[f.stat] > -2) s += 18;
          if (f.t === 'heal' && hpFrac < 0.45) s += 70;
          if (f.t === 'weather' && (!this.weather || this.weather.type !== f.w)) s += 15;
          if (f.t === 'leech' && !foe.vol.leech) s += 30;
        }
        if (M.protect) s = side.vol.lastProtect ? 0 : 15;
        s *= (M.acc || 100) / 100;
      }
      s += Math.random() * (ai >= 3 ? 8 : 25);
      if (s > bestS) { bestS = s; best = mv; }
    }
    const act = { type: 'move', id: best.id };
    if (tr && tr.mega && this.canMega(side)) act.mega = true;
    return act;
  }
  movesOf(mon) { return mon.moves.map((m) => MB.MOVES[m.id]); }
  bestMoveVs(atkSide, defSide) {
    let eff = 0, mv = null;
    for (const M of this.movesOf(this.mon(atkSide))) if (M.power) { const e = MB.typeEff(M.type, this.typesOf(defSide)); if (e > eff) { eff = e; mv = M; } }
    return { eff, mv };
  }
  estimateDamage(a, d, M) { return this.calcDamage(a, d, M, { noRandom: true, noCrit: true }).dmg; }

  // ---------------- turn resolution ----------------
  async resolveTurn(pAct, eAct) {
    // run
    if (pAct.type === 'run') {
      this.escapeTries++;
      const ps = this.stat(this.p, 'spe'), es = this.stat(this.e, 'spe');
      const chance = this.abilityOf(this.p) === 'run_away' || this.abilityOf(this.e) === 'levitate_aura' && false ? 256 : (ps * 128) / Math.max(1, es) + 30 * this.escapeTries;
      if (this.abilityOf(this.e) === 'levitate_aura') { await this.say(`${this.nameOf(this.e)}'s gravity prevents escape!`); }
      else if (chance >= 255 || Math.random() * 256 < chance) { MB.audio.sfx('escape'); await this.say('Got away safely!'); this.result = { outcome: 'run' }; return; }
      else await this.say('Couldn\'t get away!');
      pAct = null;
    }
    // capsule
    if (pAct && pAct.type === 'ball') { await this.throwCapsule(pAct.id); if (this.result) return; pAct = null; }
    // items
    for (const [act, side] of [[pAct, this.p], [eAct, this.e]]) {
      if (act && act.type === 'item') { await this.useItem(side, act); }
    }
    // switches
    for (const [act, side] of [[pAct, this.p], [eAct, this.e]]) {
      if (act && act.type === 'switch') await this.doSwitch(side, act.to);
    }
    // mega evolution before moves
    for (const [act, side] of [[pAct, this.p], [eAct, this.e]]) {
      if (act && act.type === 'move' && act.mega && this.canMega(side)) await this.doMega(side);
    }
    // moves
    const acts = [];
    if (pAct && pAct.type === 'move') acts.push([this.p, pAct]);
    if (eAct && eAct.type === 'move') acts.push([this.e, eAct]);
    acts.sort((A, B) => {
      const pa = (MB.MOVES[A[1].id].priority || 0) + (this.abilityOf(A[0]) === 'sky_lord' && MB.MOVES[A[1].id].type === 'Wind' && this.mon(A[0]).hp === this.maxHp(A[0]) ? 1 : 0);
      const pb = (MB.MOVES[B[1].id].priority || 0) + (this.abilityOf(B[0]) === 'sky_lord' && MB.MOVES[B[1].id].type === 'Wind' && this.mon(B[0]).hp === this.maxHp(B[0]) ? 1 : 0);
      if (pa !== pb) return pb - pa;
      const qa = this.mon(A[0]).item === 'quick_feather' && Math.random() < 0.2 ? 1 : 0, qb = this.mon(B[0]).item === 'quick_feather' && Math.random() < 0.2 ? 1 : 0;
      if (qa !== qb) return qb - qa;
      const sa = this.stat(A[0], 'spe'), sb = this.stat(B[0], 'spe');
      return sb === sa ? Math.random() - 0.5 : sb - sa;
    });
    for (const [side, act] of acts) {
      if (this.result) return;
      if (this.mon(side).hp <= 0 || this.mon(this.other(side)).hp <= 0 && MB.MOVES[act.id].power > 0) { if (this.mon(side).hp <= 0) continue; }
      if (act.slotUid && act.slotUid !== this.mon(side).uid) continue;
      await this.useMove(side, act.id);
      if (this.mon(this.p).hp <= 0 || this.mon(this.e).hp <= 0) {
        // the remaining actor still acts if alive and target alive -> handled by loop check
      }
    }
    for (const s of [this.p, this.e]) { s.vol.protect = false; s.vol.flinch = false; }
  }
  async doSwitch(side, to) {
    const old = this.mon(side);
    const ab = this.abilityOf(side);
    if (ab === 'calm_spirit') old.status = null;
    if (ab === 'regrowth' && old.hp > 0) old.hp = Math.min(MB.Mon.maxHp(old), old.hp + Math.floor(MB.Mon.maxHp(old) / 3));
    if (side.mega) { /* mega persists for that creature only while active; reverting is visual */ side.megaMon = old.uid; }
    side.mega = false;
    if (old.hp > 0) await this.say(side === this.p ? `${old.name}, come back!` : `${this.opts.trainer.name} withdrew ${old.name}!`, 0.2);
    const fx = this.fx[side.id];
    await this.tween(0.25, (t) => { fx.scale = 1 - t * 0.9; fx.white = t; });
    fx.visible = false;
    side.idx = to;
    side.vol = {}; side.vol.justSwitched = true;
    if (side.megaMon === this.mon(side).uid) side.mega = true;
    await this.sendOut(side, false);
  }
  async doMega(side) {
    const m = this.mon(side), sp = MB.SP[m.sp];
    const fx = this.fx[side.id];
    const owner = side === this.p ? MB.state.name : this.opts.trainer.name;
    await this.say(`${m.name}'s ${MB.ITEMS[sp.mega.stone].name} is reacting to ${side === this.p ? 'your' : owner + '\'s'} Aether Gauntlet!`, 0.5);
    MB.audio.sfx('mega');
    const { x, y } = this.pos(side);
    this.ringCenter = { x, y: y - 24 };
    await this.tween(0.5, (t) => { this.darken = t * 0.75; });
    this.ringT = 0;
    await this.tween(1.1, (t) => {
      this.ringT = t; fx.glow = t; fx.dx = Math.sin(t * 60) * 1.5;
      if (Math.random() < 0.6) { const a = Math.random() * Math.PI * 2, r = 50 * (1 - t) + 6; this.particles.push({ x: x + Math.cos(a) * r, y: y - 24 + Math.sin(a) * r, vx: -Math.cos(a) * 30, vy: -Math.sin(a) * 30, life: 0.4, max: 0.4, c: MB.pick(['#ff60d0', '#60f0ff', '#fff070', '#ffffff']), s: 2, g: 0 }); }
    });
    fx.white = 1; this.flashT = 0.5;
    side.mega = true; side.megaUsed = true; fx.dx = 0;
    this.burst(x, y - 24, '#ffffff', 40, 1.2, { speed: 90, life: 0.8, size: 3 });
    this.burst(x, y - 24, '#ff80e0', 30, 1.2, { speed: 70, life: 0.9, size: 2 });
    await this.tween(0.5, (t) => { fx.white = 1 - t; this.darken = 0.75 * (1 - t); fx.scale = 1 + Math.sin(t * Math.PI) * 0.2; });
    this.ringT = -1; this.darken = 0; fx.glow = 0.5;
    MB.audio.cry(m.sp, true);
    this.megaBanner = { name: 'MEGA ' + m.name.toUpperCase(), t: 1.6 };
    await this.say(`${m.name} has Mega Evolved into Mega ${sp.name}!`, 0.9);
    if (side === this.p) { MB.state.stats.megas = (MB.state.stats.megas || 0) + 1; MB.Achievements && MB.Achievements.unlock('first_mega'); if (MB.Dex) MB.Dex.megaSeen(sp.key); }
    await this.entryAbility(side);
  }

  // ---------------- move execution ----------------
  async useMove(side, id) {
    const atk = this.mon(side), tside = this.other(side), def = this.mon(tside);
    let M = MB.MOVES[id];
    const name = this.nameOf(side);
    // can act?
    if (atk.status === 'slp') {
      side.vol.slp = (side.vol.slp === undefined ? (atk.slpTurns || MB.randInt(1, 3)) : side.vol.slp) - 1;
      if (side.vol.slp <= 0) { atk.status = null; delete side.vol.slp; await this.say(`${name} woke up!`); }
      else { await this.say(`${name} is fast asleep.`); this.statusFx(side, 'slp'); return; }
    }
    if (atk.status === 'frz') {
      if (Math.random() < 0.2 || M.type === 'Flame') { atk.status = null; await this.say(`${name} thawed out!`); }
      else { await this.say(`${name} is frozen solid!`); return; }
    }
    if (side.vol.flinch) { await this.say(`${name} flinched and couldn't move!`); return; }
    if (side.vol.cnf) {
      side.vol.cnf--;
      if (side.vol.cnf <= 0) { await this.say(`${name} snapped out of confusion!`); delete side.vol.cnf; }
      else {
        await this.say(`${name} is confused!`, 0.25);
        if (Math.random() < 0.33) {
          const st = this.statsOf(side);
          const dmg = Math.floor((((2 * atk.lvl) / 5 + 2) * 40 * (st.atk / st.def)) / 50 + 2);
          await this.say('It hurt itself in its confusion!', 0.2);
          this.fx[side.id].flash = 0.4; MB.audio.sfx('hit');
          await this.animHp(side, atk.hp - dmg);
          return;
        }
      }
    }
    if (atk.status === 'par' && Math.random() < 0.25) { await this.say(`${name} is paralyzed! It can't move!`); this.statusFx(side, 'par'); return; }
    // PP
    const slot = atk.moves.find((m) => m.id === id);
    if (slot) { slot.pp = Math.max(0, slot.pp - (this.abilityOf(tside) === 'pressure_aura' ? 2 : 1)); }
    if (this.abilityOf(side) === 'adaptive' && M.power > 0) side.vol.adaptType = M.type;
    await this.say(`${name} used ${M.name}!`, 0.15);
    side.vol.lastMove = id;
    // protect
    if (M.protect) {
      if (side.vol.lastProtect && Math.random() < 0.5) { side.vol.lastProtect = false; await this.say('But it failed!'); return; }
      side.vol.protect = true; side.vol.lastProtect = true; this.burst(this.pos(side).x, this.pos(side).y - 24, '#a0e0ff', 20, 1, { speed: 30 }); MB.audio.sfx('statup');
      await this.say(`${name} protected itself!`); return;
    }
    side.vol.lastProtect = false;
    const targetsFoe = M.power > 0 || M.fixed || M.fx.some((f) => !f.self && (f.t === 'status' || f.t === 'stage' || f.t === 'leech'));
    if (targetsFoe && tside.vol.protect) { await this.say(`${this.nameOf(tside)} protected itself!`); return; }
    if (targetsFoe && def.hp <= 0) { await this.say('But there was no target...'); return; }
    // accuracy
    if (targetsFoe && !M.neverMiss && M.acc > 0) {
      let acc = M.acc * ACC_MUL(side.st.acc - tside.st.eva);
      if (this.abilityOf(side) === 'sharp_eyes') acc *= 1.1;
      if (this.weather && this.weather.type === 'sand' && this.abilityOf(tside) === 'sand_veil') acc *= 0.8;
      if (M.id === 'blizzard' && this.weather && this.weather.type === 'snow') acc = 100;
      if ((M.id === 'thunderstrike' || M.id === 'hurricane') && this.weather && this.weather.type === 'rain') acc = 100;
      if (Math.random() * 100 >= acc) { await this.say(`${name}'s attack missed!`); return; }
    }
    await this.animateMove(side, M);
    if (M.power > 0 || M.fixed) {
      // immunities via abilities
      const dab = this.abilityOf(tside);
      const absorb = { absorb_aqua: 'Aqua', absorb_volt: 'Electric', absorb_flame: 'Flame' };
      if (absorb[dab] === M.type) { await this.say(`${this.nameOf(tside)}'s ${MB.ABILITIES[dab].name} absorbed the attack!`); await this.animHp(tside, def.hp + this.maxHp(tside) / 4); return; }
      if ((dab === 'hover' || dab === 'levitate_aura') && M.type === 'Earth') { await this.say(`${this.nameOf(tside)} is floating out of reach!`); return; }
      if (dab === 'rift_walker' && M.type === 'Dragon') { await this.say(`It doesn't affect ${this.nameOf(tside)}...`); return; }
      const hits = M.hits ? MB.randInt(M.hits[0], M.hits[1]) : 1;
      let total = 0, hitCount = 0, lastEff = 1, crits = 0;
      for (let h = 0; h < hits; h++) {
        if (def.hp <= 0) break;
        const r = this.calcDamage(side, tside, M);
        if (r.eff === 0) { await this.say(`It doesn't affect ${this.nameOf(tside)}...`); return; }
        let dmg = r.dmg;
        // survival effects
        if (dmg >= def.hp && def.hp === this.maxHp(tside) && (dab === 'steadfast' || def.item === 'last_stand_band')) { dmg = def.hp - 1; this.endured = true; }
        this.fx[tside.id].flash = 0.45; this.shakeT = r.eff > 1 ? 0.35 : 0.15;
        MB.audio.sfx(r.eff > 1 ? 'super' : r.eff < 1 ? 'weak' : 'hit');
        await this.animHp(tside, def.hp - dmg);
        if (side === this.p) { this.dmgDone = this.dmgDone || {}; this.dmgDone[atk.uid] = (this.dmgDone[atk.uid] || 0) + dmg; }
        total += dmg; hitCount++; lastEff = r.eff; if (r.crit) crits++;
        if (r.crit && hits === 1) await this.say('A critical hit!', 0.3);
        // contact abilities
        if (M.contact && def.hp >= 0) await this.contactEffects(side, tside);
        if (atk.hp <= 0) break;
      }
      if (hits > 1) { if (crits) await this.say(`${crits} critical hit${crits > 1 ? 's' : ''}!`, 0.2); await this.say(`Hit ${hitCount} time(s)!`, 0.3); }
      if (lastEff > 1) await this.say('It\'s super effective!', 0.35); else if (lastEff < 1) await this.say('It\'s not very effective...', 0.35);
      if (this.endured) { this.endured = false; await this.say(`${this.nameOf(tside)} endured the hit!`); }
      // drain / recoil
      for (const f of M.fx) {
        if (f.t === 'drain' && total > 0 && atk.hp > 0) { await this.animHp(side, atk.hp + Math.max(1, Math.floor((total * f.v) / 100))); await this.say(`${this.nameOf(tside)} had its energy drained!`, 0.25); }
        if (f.t === 'recoil' && total > 0 && this.abilityOf(side) !== 'aether_guard') { await this.animHp(side, atk.hp - Math.max(1, Math.floor((total * f.v) / 100))); await this.say(`${name} is damaged by recoil!`, 0.25); }
      }
      if (atk.item === 'power_charm' && total > 0 && atk.hp > 0 && this.abilityOf(side) !== 'aether_guard') await this.animHp(side, atk.hp - Math.floor(this.maxHp(side) / 10));
      // secondary effects
      if (def.hp > 0) await this.applySecondary(side, tside, M, true);
      else await this.applySecondary(side, tside, M, false);
      if (def.hp <= 0) await this.faintFx(tside);
      if (atk.hp <= 0) await this.faintFx(side);
      if (def.hp <= 0 && atk.hp > 0) {
        const ab = this.abilityOf(side);
        if (ab === 'moxie') await this.changeStage(side, 'atk', 1);
        if (ab === 'overcharge') await this.changeStage(side, 'spa', 1);
      }
      if (M.pivot && atk.hp > 0 && side.party.some((m, i) => i !== side.idx && m.hp > 0 && !m.egg)) {
        if (side === this.p) { const to = await this.openParty(true); if (to !== undefined && to !== null && to >= 0) await this.doSwitch(side, to); }
        else if (def.hp > 0) { const to = side.party.findIndex((m, i) => i !== side.idx && m.hp > 0); if (to >= 0) await this.doSwitch(side, to); }
      }
    } else {
      await this.applySecondary(side, tside, M, true);
    }
  }
  async contactEffects(aSide, dSide) {
    const ab = this.abilityOf(dSide), atk = this.mon(aSide);
    if (atk.hp <= 0 || atk.status) return;
    const C = { static_fur: 'par', ember_hide: 'brn', toxic_skin: 'psn' };
    if (C[ab] && Math.random() < 0.3) await this.inflict(aSide, C[ab], `${this.nameOf(dSide)}'s ${MB.ABILITIES[ab].name}`);
    if (this.abilityOf(aSide) === 'poison_claws' && Math.random() < 0.3 && !this.mon(dSide).status) await this.inflict(dSide, 'psn');
  }
  calcDamage(aSide, dSide, M, o = {}) {
    const a = this.mon(aSide), d = this.mon(dSide);
    const types = this.typesOf(dSide);
    let mtype = M.type;
    const aAb = this.abilityOf(aSide), dAb = this.abilityOf(dSide);
    if (M.fixed) return { dmg: a.lvl, eff: types.includes('Normal') ? 0 : 1, crit: false };
    let eff = MB.typeEff(mtype, types);
    if (eff === 0 && aAb === 'scrappy' && mtype === 'Normal') eff = 1;
    if (eff === 0) return { dmg: 0, eff: 0, crit: false };
    const phys = M.cat === 'phys';
    let critStage = (M.highCrit ? 1 : 0) + (aAb === 'keen_edge' ? 1 : 0) + (a.item === 'focus_lens' ? 1 : 0) + (aSide.vol.critUp ? 2 : 0);
    const critChance = [1 / 16, 1 / 8, 1 / 2, 1][Math.min(3, critStage)];
    const crit = !o.noCrit && Math.random() < critChance;
    let A = phys ? this.stat(aSide, 'atk') : this.stat(aSide, 'spa');
    let D = phys ? this.stat(dSide, 'def') : this.stat(dSide, 'spd');
    if (crit) { if ((phys ? aSide.st.atk : aSide.st.spa) < 0) A = this.statsOf(aSide)[phys ? 'atk' : 'spa']; if ((phys ? dSide.st.def : dSide.st.spd) > 0) D = this.statsOf(dSide)[phys ? 'def' : 'spd']; }
    let power = M.power;
    if (aAb === 'technique' && power <= 60) power *= 1.5;
    if (aAb === 'tough_claws' && M.contact) power *= 1.3;
    if (aAb === 'mega_launcher' && /Pulse|Beam|Ray|Cannon|Blast/.test(M.name)) power *= 1.5;
    const lowHp = a.hp <= this.maxHp(aSide) / 3;
    const HEART = { kindle_heart: 'Flame', tidal_heart: 'Aqua', verdant_heart: 'Nature', storm_heart: 'Electric' };
    if (HEART[aAb] === mtype && lowHp) power *= 1.5;
    if (aAb === 'sky_lord' && mtype === 'Wind') power *= 1.3;
    if (aAb === 'soulfire' && mtype === 'Flame') power *= 1.3;
    if (aAb === 'leviathan' && mtype === 'Aqua') power *= 1.3;
    if (aAb === 'world_tree' && mtype === 'Nature') power *= 1.2;
    if (aAb === 'dark_aura' && mtype === 'Shadow') power *= 1.33;
    if (aAb === 'radiant_aura' && mtype === 'Light') power *= 1.33;
    if (aAb === 'eclipse_core' && (mtype === 'Shadow' || mtype === 'Light')) power *= 1.3;
    if (a.item && MB.ITEMS[a.item] && MB.ITEMS[a.item].typeBoost === mtype) power *= 1.2;
    if (a.item === 'power_charm') power *= 1.3;
    let dmg = Math.floor(Math.floor((Math.floor((2 * a.lvl) / 5 + 2) * power * A) / D) / 50) + 2;
    // modifiers
    if (this.weather) {
      if (this.weather.type === 'sun') { if (mtype === 'Flame') dmg *= 1.5; if (mtype === 'Aqua') dmg *= 0.5; }
      if (this.weather.type === 'rain') { if (mtype === 'Aqua') dmg *= 1.5; if (mtype === 'Flame') dmg *= 0.5; }
    }
    if (crit) dmg *= 1.5;
    if (!o.noRandom) dmg *= 0.85 + Math.random() * 0.15; else dmg *= 0.92;
    const myTypes = this.typesOf(aSide);
    if (myTypes.includes(mtype)) dmg *= aAb === 'attunement' ? 2 : 1.5;
    dmg *= eff;
    if (eff > 1 && aAb === 'rift_walker') dmg *= 1.25;
    if (phys && a.status === 'brn' && aAb !== 'grit') dmg *= 0.5;
    if (dAb === 'thick_blubber' && (mtype === 'Flame' || mtype === 'Ice')) dmg *= 0.5;
    if (dAb === 'bedrock' && eff > 1) dmg *= 0.75;
    if (d.item === 'shell_plate' && eff > 1) dmg *= 0.8;
    if (dAb === 'frost_coat' && !phys) dmg *= 0.5;
    if (dAb === 'fur_coat' && phys) dmg *= 0.5;
    if (dAb === 'dragon_scale' && d.hp === this.maxHp(dSide)) dmg *= 0.5;
    dmg = Math.max(1, Math.floor(dmg));
    return { dmg, eff, crit };
  }
  async applySecondary(aSide, dSide, M, targetAlive) {
    const serene = this.abilityOf(aSide) === 'serene' ? 2 : 1;
    const dmgMove = M.power > 0;
    for (const f of M.fx) {
      const tgt = f.self ? aSide : dSide;
      if (!f.self && !targetAlive) continue;
      if (this.mon(tgt).hp <= 0) continue;
      const ch = Math.min(100, (f.ch || 100) * (dmgMove ? serene : 1));
      if (Math.random() * 100 >= ch) continue;
      if (f.t === 'status') {
        if (f.s === 'stn') { if (!f.self && this.abilityOf(dSide) !== 'inner_focus') dSide.vol.flinch = true; continue; }
        if (f.s === 'cnf') { if (this.abilityOf(tgt) === 'inner_focus') continue; if (!tgt.vol.cnf) { tgt.vol.cnf = MB.randInt(2, 5); MB.audio.sfx('status'); await this.say(`${this.nameOf(tgt)} became confused!`); } else if (!dmgMove) await this.say('But it failed!'); continue; }
        const ok = await this.inflict(tgt, f.s);
        if (!ok && !dmgMove) await this.say('But it failed!');
      } else if (f.t === 'stage') {
        if (!f.self && this.abilityOf(dSide) === 'iron_will' && f.n < 0) { await this.say(`${this.nameOf(dSide)}'s Iron Will prevents stat loss!`); continue; }
        await this.changeStage(tgt, f.stat, f.n);
      } else if (f.t === 'heal') {
        const s = aSide, m = this.mon(s);
        if (m.hp >= this.maxHp(s)) { if (!dmgMove) await this.say('But its HP is already full!'); continue; }
        this.burst(this.pos(s).x, this.pos(s).y - 20, '#a0ffb0', 16, 0.8, { speed: 25, up: 20 }); MB.audio.sfx('heal');
        await this.animHp(s, m.hp + (this.maxHp(s) * f.v) / 100);
        await this.say(`${this.nameOf(s)} regained health!`, 0.3);
      } else if (f.t === 'weather') await this.setWeather(f.w);
      else if (f.t === 'rest') { const m = this.mon(aSide); m.status = 'slp'; aSide.vol.slp = 3; await this.animHp(aSide, this.maxHp(aSide)); await this.say(`${this.nameOf(aSide)} slept and became healthy!`); }
      else if (f.t === 'cure') { const m = this.mon(aSide); if (m.status) { m.status = null; await this.say(`${this.nameOf(aSide)}'s status was cured!`); } }
      else if (f.t === 'clear') { aSide.st = this.freshStages(); dSide.st = this.freshStages(); await this.say('All stat changes were eliminated!'); }
      else if (f.t === 'leech') { if (this.typesOf(dSide).includes('Nature') && M.type === 'Nature') { await this.say('It doesn\'t affect it...'); continue; } if (!dSide.vol.leech) { dSide.vol.leech = true; await this.say(`${this.nameOf(dSide)} was seeded!`); } }
    }
  }
  async inflict(side, st, src) {
    const m = this.mon(side), types = this.typesOf(side), ab = this.abilityOf(side);
    if (m.status || m.hp <= 0) return false;
    if ((st === 'brn' && types.includes('Flame')) || ((st === 'psn' || st === 'tox') && (types.includes('Venom') || types.includes('Metal') || ab === 'immunity')) ||
      (st === 'par' && (types.includes('Electric') || ab === 'limber')) || (st === 'frz' && (types.includes('Ice') || ab === 'magma_armor' || (this.weather && this.weather.type === 'sun'))) || (st === 'slp' && ab === 'insomnia')) return false;
    m.status = st;
    if (st === 'slp') side.vol.slp = MB.randInt(1, 3);
    if (st === 'tox') side.vol.tox = 1;
    const T = { brn: 'was burned', psn: 'was poisoned', tox: 'was badly poisoned', par: 'is paralyzed! It may be unable to move', slp: 'fell asleep', frz: 'was frozen solid' };
    this.statusFx(side, st); MB.audio.sfx('status');
    await this.say(`${src ? src + ': ' : ''}${this.nameOf(side)} ${T[st]}!`);
    return true;
  }
  statusFx(side, st) {
    const C = { brn: '#ff7030', psn: '#c060e0', tox: '#a040c0', par: '#ffe040', slp: '#c0c8e0', frz: '#a0f0ff' };
    const { x, y } = this.pos(side);
    this.burst(x, y - 24, C[st] || '#fff', 14, 1, { speed: 30, up: 10 });
  }
  async changeStage(side, stat, n, src) {
    void src;
    const cur = side.st[stat];
    const nv = MB.clamp(cur + n, -6, 6);
    const name = this.nameOf(side);
    if (nv === cur) { await this.say(`${name}'s ${MB.STAT_NAMES[stat]} won't go any ${n > 0 ? 'higher' : 'lower'}!`, 0.3); return; }
    side.st[stat] = nv;
    const { x, y } = this.pos(side);
    for (let i = 0; i < 12; i++) this.particles.push({ x: x - 20 + Math.random() * 40, y: y - (n > 0 ? 0 : 50) + Math.random() * 10, vx: 0, vy: n > 0 ? -50 : 50, life: 0.6, max: 0.6, c: n > 0 ? '#ff9050' : '#5090ff', s: 2, g: 0 });
    MB.audio.sfx(n > 0 ? 'statup' : 'statdown');
    const amt = Math.abs(nv - cur);
    await this.say(`${name}'s ${MB.STAT_NAMES[stat]} ${n > 0 ? 'rose' : 'fell'}${amt >= 3 ? ' drastically' : amt === 2 ? ' sharply' : ''}!`, 0.3);
  }
  async faintFx(side) {
    if (side.fainting) return;
    side.fainting = true;
    const m = this.mon(side);
    MB.audio.cry(m.sp); MB.audio.sfx('faint');
    const fx = this.fx[side.id];
    await this.tween(0.45, (t) => { fx.dy = t * 40; fx.alpha = 1 - t; });
    fx.visible = false; fx.dy = 0; fx.alpha = 1;
    m.status = null;
    side.fainting = false;
    await this.say(`${this.nameOf(side)} fainted!`, 0.4);
    if (side === this.e) await this.awardExp();
    if (side === this.p) { m.friend = Math.max(0, m.friend - 1); }
  }
  async awardExp() {
    if (this.opts.noExp) return;
    const S = MB.state;
    const foe = this.mon(this.e), fsp = MB.SP[foe.sp];
    // Experience goes to the whole party (fainted members too), weighted by the damage
    // each creature dealt this battle. Everyone gets at least a small share.
    const members = S.party.filter((m) => !m.egg);
    const dmg = this.dmgDone || {};
    const totalDmg = members.reduce((a, m) => a + (dmg[m.uid] || 0), 0);
    const weight = (m) => (totalDmg > 0 ? (dmg[m.uid] || 0) / totalDmg : (m === this.mon(this.p) ? 1 : 0));
    const base = fsp.baseExp * foe.lvl / 5 * (this.kind === 'trainer' ? 1.5 : 1);
    const give = async (m, frac) => {
      const L = m.lvl;
      let exp = Math.floor(base * Math.pow((2 * foe.lvl + 10) / (foe.lvl + L + 10), 2.5) * frac) + 1;
      if (m.item === 'scholar_charm') exp = Math.floor(exp * 1.5);
      if (m.ot && m.ot !== S.trainerId) exp = Math.floor(exp * 1.5);
      if (S.bonusExp) exp = Math.floor(exp * S.bonusExp);
      if (S.keyItems.exp_link) exp = Math.floor(exp * 1.25);
      // effort
      const top = MB.STAT_KEYS.reduce((a, k) => (fsp.base[k] > fsp.base[a] ? k : a), 'hp');
      m.bonus = m.bonus || {};
      const tot = MB.STAT_KEYS.reduce((a, k) => a + (m.bonus['e' + k] || 0), 0);
      if (tot < 127 && (m.bonus['e' + top] || 0) < 63) m.bonus['e' + top] = (m.bonus['e' + top] || 0) + 1;
      if (m.lvl >= 100) return;
      await this.say(`${m.name} gained ${exp} Exp. Points!`, 0.25);
      const isActive = m === this.mon(this.p) && m.hp > 0;
      const sp = MB.SP[m.sp];
      const evs = [];
      // animate exp bar for active
      if (isActive) {
        let remaining = exp;
        while (remaining > 0 && m.lvl < 100) {
          const need = MB.Mon.expFor(sp.growth, m.lvl + 1) - m.exp;
          const step = Math.min(need, remaining);
          const from = m.exp;
          await this.tween(0.5 * Math.min(1, step / Math.max(1, MB.Mon.expFor(sp.growth, m.lvl + 1) - MB.Mon.expFor(sp.growth, m.lvl))), (t) => { m.exp = Math.floor(from + step * t); });
          m.exp = from;
          const ev = MB.Mon.gainExp(m, step);
          evs.push(...ev);
          remaining -= step;
          if (ev.some((e) => e.type === 'level')) { MB.audio.sfx('levelup'); this.burst(this.pos(this.p).x, this.pos(this.p).y - 20, '#fff070', 16, 1, { speed: 40 }); }
          if (step === need) {
            const lv = ev.find((e) => e.type === 'level');
            if (lv) { await this.say(`${m.name} grew to Lv. ${m.lvl}!`, 0.4); await this.showLevelStats(lv); }
            for (const e of ev.filter((e) => e.type === 'move')) await this.learnPrompt(m, e.id);
            evs.length = 0;
          }
        }
      } else {
        const ev = MB.Mon.gainExp(m, exp);
        for (const e of ev) {
          if (e.type === 'level') await this.say(`${m.name} grew to Lv. ${e.lvl}!`, 0.3);
          if (e.type === 'move') await this.learnPrompt(m, e.id);
        }
      }
    };
    for (const m of members) await give(m, 0.15 + 0.85 * weight(m));
  }
  async showLevelStats(ev) {
    this.lvlPanel = ev;
    await this.say('', 0.01);
    await new Promise((res) => { this.lvlPanelRes = res; });
    this.lvlPanel = null;
  }
  async learnPrompt(m, id) {
    const mv = MB.MOVES[id];
    if (m.moves.some((x) => x.id === id)) return;
    if (m.moves.length < 4) { MB.Mon.learnMove(m, id); MB.audio.sfx('levelup'); await this.say(`${m.name} learned ${mv.name}!`, 0.5); return; }
    await this.say(`${m.name} wants to learn ${mv.name}, but it already knows four moves.`, 0.5);
    const choice = await MB.ask(`Forget a move to learn ${mv.name}?`, [...m.moves.map((x) => MB.MOVES[x.id].name), `Don't learn ${mv.name}`], { cancelValue: 4 });
    if (choice >= 0 && choice < 4) {
      const old = MB.MOVES[m.moves[choice].id].name;
      MB.Mon.learnMove(m, id, choice);
      await this.say(`1, 2, and... Poof! ${m.name} forgot ${old} and learned ${mv.name}!`, 0.6);
    } else await this.say(`${m.name} did not learn ${mv.name}.`, 0.4);
  }

  // ---------------- end of turn ----------------
  async endOfTurn() {
    if (this.weather) {
      const w = this.weather;
      if (w.type === 'sand' || w.type === 'snow') {
        for (const s of this.speedOrder()) {
          const m = this.mon(s); if (m.hp <= 0) continue;
          const t = this.typesOf(s), ab = this.abilityOf(s);
          if (w.type === 'sand' && !(t.includes('Earth') || t.includes('Metal') || ab === 'sand_veil' || ab === 'aether_guard')) { await this.animHp(s, m.hp - Math.max(1, this.maxHp(s) / 16)); await this.say(`${this.nameOf(s)} is buffeted by the sandstorm!`, 0.2); }
          if (w.type === 'snow' && ab === 'ice_body') await this.animHp(s, m.hp + this.maxHp(s) / 16);
        }
      }
      for (const s of this.speedOrder()) {
        const m = this.mon(s), ab = this.abilityOf(s); if (m.hp <= 0) continue;
        if ((w.type === 'sun' && ab === 'harvest') || (w.type === 'rain' && ab === 'rain_dish')) await this.animHp(s, m.hp + this.maxHp(s) / 16);
      }
      w.turns--;
      if (w.turns <= 0) { const E = { sun: 'The sunlight faded.', rain: 'The rain stopped.', sand: 'The sandstorm subsided.', snow: 'The snow stopped.' }; await this.say(E[w.type]); this.weather = null; }
    }
    for (const s of this.speedOrder()) {
      const m = this.mon(s); if (m.hp <= 0) continue;
      const ab = this.abilityOf(s), max = this.maxHp(s);
      if (ab === 'aether_guard') { /* immune to indirect damage */ }
      else {
        if (m.status === 'brn') { await this.animHp(s, m.hp - Math.max(1, max / 16)); await this.say(`${this.nameOf(s)} is hurt by its burn!`, 0.2); }
        if (m.status === 'psn') { await this.animHp(s, m.hp - Math.max(1, max / 8)); await this.say(`${this.nameOf(s)} is hurt by poison!`, 0.2); }
        if (m.status === 'tox') { s.vol.tox = (s.vol.tox || 1); await this.animHp(s, m.hp - Math.max(1, (max * s.vol.tox) / 16)); s.vol.tox = Math.min(15, s.vol.tox + 1); await this.say(`${this.nameOf(s)} is hurt by poison!`, 0.2); }
        if (s.vol.leech && m.hp > 0) { const o = this.other(s); const d = Math.max(1, Math.floor(max / 8)); await this.animHp(s, m.hp - d); if (this.mon(o).hp > 0) await this.animHp(o, this.mon(o).hp + d); await this.say(`${this.nameOf(s)}'s health is sapped!`, 0.2); }
      }
      if (m.hp > 0) {
        if (m.item === 'spring_moss' && m.hp < max) { await this.animHp(s, m.hp + max / 16); await this.say(`${this.nameOf(s)} restored a little HP with its Spring Moss.`, 0.15); }
        if (ab === 'world_tree' && m.hp < max) await this.animHp(s, m.hp + max / 8);
        if (ab === 'momentum' && s.st.spe < 6) await this.changeStage(s, 'spe', 1);
        if (ab === 'shed_shell' && m.status && Math.random() < 0.33) { m.status = null; await this.say(`${this.nameOf(s)} shed its condition!`); }
      }
      if (m.hp <= 0) await this.faintFx(s);
    }
  }
  async handleFaints() {
    const S = MB.state;
    // enemy
    if (this.mon(this.e).hp <= 0) {
      const next = this.e.party.findIndex((m) => m.hp > 0);
      if (next < 0) { await this.win(); return; }
      // AI picks the best counter
      let pick = next;
      if (this.kind === 'trainer' && (this.opts.trainer.ai || 1) >= 2) {
        let best = -99;
        this.e.party.forEach((m, i) => {
          if (m.hp <= 0) return;
          const tps = MB.SP[m.sp].types;
          const off = m.moves.reduce((mx, x) => Math.max(mx, MB.MOVES[x.id].power ? MB.typeEff(MB.MOVES[x.id].type, this.typesOf(this.p)) : 0), 0);
          const deff = this.movesOf(this.mon(this.p)).reduce((mx, mv) => Math.max(mx, mv.power ? MB.typeEff(mv.type, tps) : 0), 0);
          const sc = off - deff + (i === this.e.party.length - 1 ? -0.5 : 0) + m.lvl * 0.01;
          if (sc > best) { best = sc; pick = i; }
        });
      }
      if (this.mon(this.p).hp > 0 && S.settings.battleStyle !== 'set' && this.kind === 'trainer' && S.party.filter((m) => m.hp > 0 && !m.egg).length > 1) {
        const sw = await MB.yesno(`${this.opts.trainer.name} is about to send in ${this.e.party[pick].name}. Will you switch creatures?`);
        if (sw) { const to = await this.openParty(false); if (to !== null && to !== undefined && to >= 0 && to !== this.p.idx) await this.doSwitch(this.p, to); }
      }
      this.e.idx = pick;
      await this.sendOut(this.e, false);
    }
    if (this.mon(this.p).hp <= 0) {
      const alive = S.party.filter((m) => m.hp > 0 && !m.egg);
      if (!alive.length) { this.result = { outcome: 'lose' }; return; }
      const to = await this.openParty(true);
      this.fx.p.visible = false;
      this.p.idx = to;
      this.p.vol = {}; this.p.st = this.freshStages();
      if (this.p.megaMon === this.mon(this.p).uid) this.p.mega = true; else this.p.mega = false;
      await this.sendOut(this.p, false);
    }
  }
  async win() {
    const S = MB.state;
    if (this.kind === 'trainer') {
      const tr = this.opts.trainer;
      MB.audio.play(tr.victoryMusic || 'victory');
      await this.tween(0.4, (t) => { this.trainerSlide.e = 1 - t; });
      this.trainerSlide.e = 0; this.showTrainer = true;
      await this.say(`You defeated ${tr.title ? tr.title + ' ' : ''}${tr.name}!`, 0.6);
      if (tr.lose) await this.say(tr.lose, 1.2);
      if (tr.pay && !this.opts.facility) {
        let pay = tr.pay;
        if (S.party.some((m) => m.item === 'fortune_coin')) pay *= 2;
        S.money += pay;
        await this.say(`You got $${pay} for winning!`, 0.6);
      }
    } else if (!this.opts.facility) {
      // forager
      for (const m of S.party) if (MB.Mon.abilityId(m) === 'pickup' && !m.item && Math.random() < 0.1) { const it = MB.pick(['potion', 'great_capsule', 'super_potion', 'ether', 'nugget', 'rare_candy', 'full_heal']); m.item = it; }
    }
    this.result = { outcome: 'win' };
  }

  // ---------------- items & capture ----------------
  async useItem(side, act) {
    const it = MB.ITEMS[act.id];
    const S = MB.state;
    if (side === this.e) {
      const m = this.mon(side);
      await this.say(`${this.opts.trainer.name} used a ${it.name}!`, 0.3);
      MB.audio.sfx('heal');
      if (it.heal) await this.animHp(side, m.hp + it.heal);
      if (it.cure) m.status = null;
      return;
    }
    const m = S.party[act.target !== undefined ? act.target : this.p.idx];
    MB.Bag.remove(act.id, 1);
    this.usedItems++;
    if (it.xstat) { await this.say(`You used ${it.name}!`, 0.2); await this.changeStage(this.p, it.xstat, 2); return; }
    if (it.critUp) { this.p.vol.critUp = true; await this.say(`You used ${it.name}! ${this.nameOf(this.p)} is getting pumped!`); return; }
    await this.say(`You used ${it.name} on ${m.name}.`, 0.2);
    const active = m === this.mon(this.p);
    if (it.revive) { m.hp = Math.floor(MB.Mon.maxHp(m) * it.revive); m.status = null; MB.audio.sfx('heal'); await this.say(`${m.name} was revived!`); return; }
    if (it.heal) { MB.audio.sfx('heal'); const before = m.hp; if (active) await this.animHp(this.p, m.hp + it.heal); else m.hp = Math.min(MB.Mon.maxHp(m), m.hp + it.heal); await this.say(`${m.name} recovered ${m.hp - before} HP.`, 0.3); }
    if (it.cure) { const ok = it.cure === 'all' || it.cure.includes(m.status); if (ok && m.status) { m.status = null; if (active) delete this.p.vol.cnf; await this.say(`${m.name} was cured!`, 0.3); } }
    if (it.pp) { for (const mv of m.moves) mv.pp = Math.min(MB.MOVES[mv.id].pp, mv.pp + it.pp); await this.say(`${m.name}'s PP was restored.`, 0.3); }
  }
  async throwCapsule(id) {
    const S = MB.state;
    const it = MB.ITEMS[id];
    MB.Bag.remove(id, 1);
    if (this.kind === 'trainer') { await this.say('The trainer blocked the capsule! Don\'t be a thief!'); return; }
    if (this.opts.noCatch) { await this.say('It dodged the capsule! It can\'t be caught here.'); return; }
    const m = this.mon(this.e), sp = MB.SP[m.sp];
    await this.say(`${S.name} threw a ${it.name}!`, 0.1);
    MB.audio.sfx('throw');
    const from = { x: 40, y: 150 }, to = { x: 236, y: 38 };
    this.capsule = { x: from.x, y: from.y, open: 0, id, shake: 0 };
    await this.tween(0.55, (t) => { this.capsule.x = from.x + (to.x - from.x) * t; this.capsule.y = from.y + (to.y - from.y) * t - Math.sin(t * Math.PI) * 50; this.capsule.rot = t * 12; });
    this.capsule.rot = 0;
    this.capsule.open = 1; this.burst(to.x, to.y, '#ffffff', 20, 1, { speed: 50 });
    const fx = this.fx.e;
    await this.tween(0.3, (t) => { fx.scale = 1 - t; fx.white = t; });
    fx.visible = false; this.capsule.open = 0;
    await this.tween(0.35, (t) => { this.capsule.y = to.y + Math.min(1, t * 1.5) * 34 - Math.abs(Math.sin(t * Math.PI * 2)) * 8 * (1 - t); });
    // compute
    const max = MB.Mon.maxHp(m);
    let ball = it.ball;
    const night = this.time === 'night' || ['cave', 'dark'].includes(this.env);
    if (ball === 'night') ball = night ? 3.5 : 1;
    if (ball === 'aqua') ball = sp.types.includes('Aqua') || this.env === 'water' ? 3.5 : 1;
    if (ball === 'swift') ball = this.turn <= 1 ? 5 : 1;
    if (ball === 'ancient') ball = ['anc', 'r', 'vr'].includes(sp.rarity) || this.env === 'ruins' ? 4 : 1.5;
    if (ball === 'legend') ball = sp.legendary ? 8 : 3;
    let rate = sp.catchRate;
    const stMul = m.status === 'slp' || m.status === 'frz' ? 2.5 : m.status ? 1.5 : 1;
    let a = (((3 * max - 2 * m.hp) * rate * ball) / (3 * max)) * stMul;
    if (S.dexCaughtCount && S.dexCaughtCount() < 30 && !sp.legendary) a *= 1.2;
    let shakes = 0, caught = false;
    if (it.ball === 255 || a >= 255) { shakes = 3; caught = true; }
    else {
      const b = 1048560 / Math.sqrt(Math.sqrt(16711680 / Math.max(1, a)));
      for (shakes = 0; shakes < 4; shakes++) if (Math.random() * 65536 >= b) break;
      caught = shakes >= 4; shakes = Math.min(3, shakes);
    }
    for (let i = 0; i < shakes; i++) {
      await this.wait(0.35);
      MB.audio.sfx('shake');
      await this.tween(0.4, (t) => { this.capsule.rot = Math.sin(t * Math.PI * 2) * 0.5; });
    }
    await this.wait(0.3);
    if (caught) {
      MB.audio.sfx('catch');
      this.capsule.caught = true;
      for (let i = 0; i < 3; i++) this.particles.push({ x: this.capsule.x, y: this.capsule.y, vx: (i - 1) * 25, vy: -40, life: 0.8, max: 0.8, c: '#fff070', s: 3, g: 60, star: true });
      await this.say(`Gotcha! ${m.name} was caught!`, 1.0);
      m.ball = id; m.ot = S.trainerId; m.met = MB.World ? MB.World.mapName() : '?'; m.friend = id === 'legendary_capsule' ? 120 : m.friend; m.status = m.status;
      delete m.vol;
      const res = await MB.Collection.addCaught(m, { inBattle: true });
      void res;
      this.result = { outcome: 'caught', caught: m };
      this.capsule = null;
      return;
    }
    MB.audio.sfx('escape');
    this.capsule = null; fx.visible = true;
    this.burst(to.x, to.y + 20, '#ffffff', 16, 1, { speed: 50 });
    await this.tween(0.25, (t) => { fx.scale = t; fx.white = 1 - t; });
    await this.say(['Oh no! It broke free!', 'Aww! It appeared to be caught!', 'Argh! Almost had it!', 'Shoot! It was so close, too!'][shakes], 0.5);
  }

  // ---------------- animation of moves ----------------
  async animateMove(side, M) {
    const a = this.pos(side), d = this.pos(this.other(side));
    const col = MB.TYPE_COLORS[M.type];
    const fx = this.fx[side.id];
    const dir = side === this.p ? 1 : -1;
    if (M.cat === 'status') {
      const selfT = M.fx.some((f) => f.self || f.t === 'heal' || f.t === 'weather');
      const c = selfT ? a : d;
      for (let i = 0; i < 18; i++) this.particles.push({ x: c.x - 24 + Math.random() * 48, y: c.y - Math.random() * 10, vx: 0, vy: -30 - Math.random() * 30, life: 0.7, max: 0.7, c: col, s: 2, g: 0 });
      MB.audio.sfx('status');
      await this.wait(0.45);
      return;
    }
    if (M.cat === 'phys') {
      await this.tween(0.18, (t) => { fx.dx = dir * t * 26; fx.dy = -dir * t * 10; });
      this.burst(d.x, d.y - 24, col, 16, 1, { speed: 70, life: 0.4 });
      this.burst(d.x, d.y - 24, '#ffffff', 6, 1, { speed: 90, life: 0.25 });
      await this.tween(0.18, (t) => { fx.dx = dir * (1 - t) * 26; fx.dy = -dir * (1 - t) * 10; });
      fx.dx = 0; fx.dy = 0;
    } else {
      // projectile stream / beam by type
      const n = 14;
      await this.tween(0.45, (t) => {
        const k = Math.floor(t * n);
        if (this._lastK !== k) {
          this._lastK = k;
          const px = a.x + (d.x - a.x) * t, py = a.y - 24 + (d.y - a.y) * t;
          const wob = M.type === 'Electric' ? (Math.random() - 0.5) * 16 : M.type === 'Psychic' || M.type === 'Spirit' ? Math.sin(t * 20) * 8 : 0;
          this.particles.push({ x: px, y: py + wob, vx: (Math.random() - 0.5) * 10, vy: (Math.random() - 0.5) * 10, life: 0.35, max: 0.35, c: col, s: M.power > 90 ? 4 : 3, g: M.type === 'Aqua' ? 30 : 0 });
          this.particles.push({ x: px, y: py + wob, vx: 0, vy: 0, life: 0.2, max: 0.2, c: '#ffffff', s: 1.5, g: 0 });
        }
      });
      this._lastK = -1;
      this.burst(d.x, d.y - 24, col, 22, 1.2, { speed: 60, life: 0.5, size: 3 });
      if (M.power >= 100) this.flashT = 0.25;
    }
  }

  // ---------------- update / draw ----------------
  update(dt) {
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i]; tw.t += dt;
      const p = Math.min(1, tw.t / tw.dur); tw.fn(p);
      if (p >= 1) { this.tweens.splice(i, 1); tw.res(); }
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]; p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.g || 0) * dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
    for (const k of ['p', 'e']) { const f = this.fx[k]; if (f.flash > 0) f.flash -= dt; }
    if (this.flashT > 0) this.flashT -= dt;
    if (this.shakeT > 0) this.shakeT -= dt;
    if (this.megaBanner) { this.megaBanner.t -= dt; if (this.megaBanner.t <= 0) this.megaBanner = null; }
    // message typing
    if (this.msgRes) {
      const fast = MB.input.held('a') || MB.input.held('b');
      this.msgChars += dt * (fast ? 240 : 90);
      if (this.msgChars >= this.msg.length) {
        this.msgT += dt * (fast ? 3 : 1);
        if (this.msgT >= this.msgHold || MB.input.pressed('a')) { const r = this.msgRes; this.msgRes = null; r(); }
      }
    } else if (this.lvlPanel && this.lvlPanelRes && (MB.input.pressed('a') || MB.input.pressed('b'))) { const r = this.lvlPanelRes; this.lvlPanelRes = null; r(); }
    else if (this.menu) this.updateMenu();
  }

  drawBg(ctx) {
    MB.BattleBG.draw(ctx, this.env, this.time, this.opts.bgType);
  }
  drawMon(ctx, side) {
    const fx = this.fx[side.id];
    if (!fx.visible) return;
    const m = this.mon(side);
    const isP = side === this.p;
    const img = isP ? MB.Sprites.getBack(m.sp, side.mega, m.shiny) : MB.Sprites.get(m.sp, side.mega, m.shiny);
    const { x, y } = this.pos(side);
    const size = 96 * fx.scale * (isP ? 1.05 : 1);
    const bob = Math.sin(performance.now() / (side.mega ? 180 : 350) + (isP ? 1 : 0)) * (side.mega ? 1.5 : 1);
    const dx = x - size / 2 + fx.dx + (this.shakeT > 0 && !isP === true && side === this.e ? (Math.random() - 0.5) * 4 : 0);
    const dy = y - size + 8 + fx.dy + bob * (fx.scale >= 1 ? 1 : 0);
    ctx.globalAlpha = fx.alpha * (fx.flash > 0 && Math.floor(fx.flash * 20) % 2 ? 0.25 : 1);
    if (side.mega || fx.glow > 0) {
      const g = side.mega ? 0.35 + Math.sin(performance.now() / 200) * 0.15 : fx.glow;
      ctx.save(); ctx.globalAlpha *= g;
      const grd = ctx.createRadialGradient(x, y - size / 2, 4, x, y - size / 2, size * 0.6);
      grd.addColorStop(0, '#ff80f0'); grd.addColorStop(0.5, 'rgba(96,240,255,0.5)'); grd.addColorStop(1, 'rgba(96,240,255,0)');
      ctx.fillStyle = grd; ctx.fillRect(x - size, y - size * 1.2, size * 2, size * 1.4); ctx.restore();
    }
    ctx.drawImage(img, dx, dy, size, size);
    if (fx.white > 0) {
      ctx.save(); ctx.globalAlpha = fx.white;
      const wc = BattleScene.whiteOf(img); ctx.drawImage(wc, dx, dy, size, size); ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
  static whiteOf(img) {
    if (img._white) return img._white;
    const c = MB.makeCanvas(img.width, img.height), x = c.getContext('2d');
    x.drawImage(img, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
    img._white = c; return c;
  }
  drawHud(ctx, side) {
    const fx = this.fx[side.id];
    if (!fx.visible && side.party[side.idx].hp > 0 && !this.capsule) return;
    if (!fx.visible && !this.capsule) return;
    const m = this.mon(side);
    const isP = side === this.p;
    const x = isP ? 172 : 8, y = isP ? 116 : 10, w = 140, h = isP ? 44 : 32;
    MB.UI.box(ctx, x, y, w, h, side.mega ? 'mega' : undefined);
    const dark = side.mega;
    const tc = dark ? '#fff' : '#303040';
    MB.UI.text(ctx, (side.mega ? '◆' : '') + m.name, x + 8, y + 13, { size: 8, bold: true, color: tc });
    if (m.gender) MB.UI.text(ctx, m.gender === 'M' ? '♂' : '♀', x + 8 + Math.min(80, (m.name.length + (side.mega ? 1 : 0)) * 5.2), y + 13, { size: 8, color: m.gender === 'M' ? '#4070e0' : '#e04080' });
    MB.UI.text(ctx, 'Lv' + m.lvl, x + w - 8, y + 13, { size: 7, align: 'right', color: tc });
    if (!isP && this.kind === 'wild' && MB.state.dex[m.sp] && MB.state.dex[m.sp].caught) { ctx.fillStyle = '#e04040'; ctx.beginPath(); ctx.arc(x + w - 44, y + 10, 2.5, 0, Math.PI * 2); ctx.fill(); }
    const max = MB.Mon.maxHp(m), f = m.hp / max;
    MB.UI.text(ctx, 'HP', x + 10, y + 24, { size: 6, bold: true, color: '#e8a020' });
    MB.UI.bar(ctx, x + 24, y + 19, w - 34, 5, f, MB.UI.hpColor(f));
    MB.UI.statusBadge(ctx, m.status, x + w - 30, y + 26 - (isP ? 0 : 0));
    if (isP) {
      MB.UI.text(ctx, `${Math.max(0, m.hp)}/${max}`, x + w - 36, y + 34, { size: 7, align: 'right', color: tc });
      const sp = MB.SP[m.sp];
      const lo = MB.Mon.expFor(sp.growth, m.lvl), hi = MB.Mon.expFor(sp.growth, m.lvl + 1);
      MB.UI.bar(ctx, x + 10, y + 38, w - 20, 3, m.lvl >= 100 ? 1 : (m.exp - lo) / Math.max(1, hi - lo), '#40a0f0', '#303848');
    }
  }
  drawCapsule(ctx, c) {
    MB.drawCapsuleIcon(ctx, c.id, c.x, c.y, 1.4, c.rot || 0, c.open);
    if (c.caught && Math.floor(performance.now() / 300) % 2) { ctx.fillStyle = '#fff'; }
  }
  drawTrainer(ctx, sideId) {
    const slide = this.trainerSlide[sideId];
    if (sideId === 'e' && (this.kind !== 'trainer')) return;
    if (slide <= 0 && !(sideId === 'e' && this.showTrainer)) return;
    const app = sideId === 'p' ? MB.state.appearance : this.opts.trainer.app;
    if (!app) return;
    const fr = MB.Chars.get(app)[sideId === 'p' ? 'up' : 'down'][0];
    const sc = 5;
    if (sideId === 'p') ctx.drawImage(fr, 40 - 40 * (1 - slide) - 8, 176 - 18 * sc + 6, 16 * sc, 18 * sc);
    else { const xo = this.showTrainer ? 0 : (1 - slide) * 120; ctx.globalAlpha = this.showTrainer ? 1 : slide; ctx.drawImage(fr, 236 - 40 + xo, 100 - 18 * sc + 10, 16 * sc, 18 * sc); ctx.globalAlpha = 1; }
  }
  draw(ctx) {
    ctx.save();
    if (this.shakeT > 0) ctx.translate((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3);
    this.drawBg(ctx);
    // intro wipe
    if (this.introT !== undefined && this.introT < 1) { /* platforms slide */ }
    this.drawTrainer(ctx, 'e');
    if (!this.showTrainer) this.drawMon(ctx, this.e);
    this.drawMon(ctx, this.p);
    this.drawTrainer(ctx, 'p');
    if (this.capsule) this.drawCapsule(ctx, this.capsule);
    for (const p of this.particles) {
      ctx.globalAlpha = MB.clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = p.c;
      if (p.star) { MB.UI.text(ctx, '★', p.x, p.y, { size: 8, color: p.c, align: 'center', shadow: false }); }
      else ctx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s);
    }
    ctx.globalAlpha = 1;
    if (this.darken > 0) { ctx.fillStyle = `rgba(10,0,20,${this.darken})`; ctx.fillRect(0, 0, MB.W, 176); this.drawMon(ctx, this.fx.p.glow > 0 ? this.p : this.e); }
    if (this.ringT >= 0 && this.ringCenter) {
      const c = this.ringCenter;
      for (let i = 0; i < 4; i++) {
        const rr = (1 - ((this.ringT * 2 + i * 0.25) % 1)) * 60;
        ctx.strokeStyle = ['#ff60d0', '#60f0ff', '#fff070', '#ffffff'][i]; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(c.x, c.y, rr, rr * 0.9, 0, 0, Math.PI * 2); ctx.stroke();
      }
    }
    this.drawHud(ctx, this.e);
    this.drawHud(ctx, this.p);
    if (this.flashT > 0) { ctx.fillStyle = `rgba(255,255,255,${MB.clamp(this.flashT * 2, 0, 1)})`; ctx.fillRect(0, 0, MB.W, MB.H); }
    if (this.weather) MB.Weather.drawBattle(ctx, this.weather.type);
    ctx.restore();
    if (this.megaBanner) {
      const t = this.megaBanner.t;
      ctx.globalAlpha = MB.clamp(t, 0, 1);
      ctx.fillStyle = 'rgba(30,10,40,0.85)'; ctx.fillRect(0, 74, MB.W, 26);
      const grd = ctx.createLinearGradient(0, 0, MB.W, 0); grd.addColorStop(0, '#ff60d0'); grd.addColorStop(0.5, '#fff070'); grd.addColorStop(1, '#60f0ff');
      ctx.fillStyle = grd; ctx.fillRect(0, 74, MB.W, 2); ctx.fillRect(0, 98, MB.W, 2);
      MB.UI.text(ctx, '◆ ' + this.megaBanner.name + ' ◆', MB.W / 2 + (1.6 - t) * 20 - 10, 92, { size: 12, bold: true, color: '#fff', align: 'center', shadowColor: '#ff40c0' });
      ctx.globalAlpha = 1;
    }
    // bottom panel
    const by = 176;
    MB.UI.box(ctx, 0, by, MB.W, MB.H - by, 'dark');
    if (this.menu && this.menu.mode === 'fight') this.drawFight(ctx, by);
    else {
      const showMain = this.menu && this.menu.mode === 'main';
      const tw = showMain ? 170 : MB.W - 24;
      const lines = MB.UI.wrapLines(ctx, this.msg, tw, 8);
      let left = Math.floor(this.msgChars);
      lines.slice(0, 3).forEach((ln, i) => { MB.UI.text(ctx, ln.slice(0, Math.max(0, left)), 12, by + 20 + i * 14, { color: '#fff', size: 8, shadowColor: 'rgba(0,0,0,0.6)' }); left -= ln.length; });
      if (showMain) {
        MB.UI.box(ctx, 186, by + 4, 130, 56);
        const opts = ['FIGHT', 'BAG', 'PARTY', 'RUN'];
        opts.forEach((o, i) => { const ox = 204 + (i % 2) * 58, oy = by + 24 + Math.floor(i / 2) * 22; MB.UI.text(ctx, o, ox, oy, { size: 8, bold: true }); if (this.menu.idx === i) MB.UI.cursor(ctx, ox - 9, oy - 3); });
      }
    }
    if (this.lvlPanel) this.drawLevelPanel(ctx);
    if (this.fadeOutT) { ctx.fillStyle = `rgba(0,0,0,${this.fadeOutT})`; ctx.fillRect(0, 0, MB.W, MB.H); }
    if (this.introT !== undefined && this.introT < 1) {
      // classic encounter shutter
      const t = this.introT;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, MB.W, MB.H / 2 * (1 - t)); ctx.fillRect(0, MB.H - MB.H / 2 * (1 - t), MB.W, MB.H / 2);
    }
  }
  drawFight(ctx, by) {
    const M = this.menu, mon = this.mon(this.p);
    MB.UI.box(ctx, 4, by + 4, 212, 56);
    mon.moves.forEach((mv, i) => {
      const x = 20 + (i % 2) * 100, y = by + 22 + Math.floor(i / 2) * 18;
      const mm = MB.MOVES[mv.id];
      ctx.fillStyle = MB.TYPE_COLORS[mm.type]; ctx.globalAlpha = 0.25; ctx.fillRect(x - 6, y - 10, 94, 14); ctx.globalAlpha = 1;
      MB.UI.text(ctx, mm.name, x, y, { size: 7, bold: true, color: mv.pp > 0 ? '#303040' : '#a04040' });
      if (M.midx === i) MB.UI.cursor(ctx, x - 9, y - 3);
    });
    const hasMega = this.canMega(this.p);
    if (hasMega) {
      const sel = M.midx === mon.moves.length;
      const y = by + 58;
      ctx.fillStyle = M.megaOn ? '#ff60d0' : '#504060'; MB.UI.rr(ctx, 60, y - 9, 104, 11, 3); ctx.fill();
      MB.UI.text(ctx, (M.megaOn ? '◆ MEGA EVOLVE: ON' : '◇ MEGA EVOLVE: OFF'), 112, y - 1, { size: 6.5, bold: true, color: '#fff', align: 'center' });
      if (sel) MB.UI.cursor(ctx, 52, y - 4, '#fff070');
    }
    MB.UI.box(ctx, 220, by + 4, 96, 56);
    const cur = mon.moves[Math.min(M.midx, mon.moves.length - 1)];
    if (cur && M.midx < mon.moves.length) {
      const mm = MB.MOVES[cur.id];
      MB.UI.typeBadge(ctx, mm.type, 228, by + 11, 40);
      MB.UI.text(ctx, mm.cat === 'phys' ? 'PHYS' : mm.cat === 'spec' ? 'SPEC' : 'STAT', 300, by + 18, { size: 6, align: 'right', bold: true, color: mm.cat === 'phys' ? '#c04020' : mm.cat === 'spec' ? '#3050c0' : '#707070' });
      MB.UI.text(ctx, `PP ${cur.pp}/${mm.pp}`, 230, by + 32, { size: 7 });
      MB.UI.text(ctx, `Pow ${mm.power || '-'}  Acc ${mm.acc || '-'}`, 230, by + 44, { size: 6 });
      const eff = mm.power ? MB.typeEff(mm.type, this.typesOf(this.e)) : 1;
      if (mm.power && MB.state.dex[this.mon(this.e).sp] && MB.state.dex[this.mon(this.e).sp].caught) MB.UI.text(ctx, eff > 1 ? 'Super effective' : eff === 0 ? 'No effect' : eff < 1 ? 'Not very eff.' : 'Effective', 230, by + 55, { size: 6, color: eff > 1 ? '#c02020' : eff < 1 ? '#606060' : '#305030' });
    } else if (hasMega) {
      MB.UI.text(ctx, 'Transform for', 228, by + 22, { size: 6 }); MB.UI.text(ctx, 'the rest of', 228, by + 32, { size: 6 }); MB.UI.text(ctx, 'this battle!', 228, by + 42, { size: 6 });
    }
  }
  drawLevelPanel(ctx) {
    const ev = this.lvlPanel;
    MB.UI.box(ctx, 180, 40, 134, 112);
    let y = 58;
    for (const k of MB.STAT_KEYS) {
      MB.UI.text(ctx, MB.STAT_NAMES[k], 190, y, { size: 7 });
      MB.UI.text(ctx, String(ev.after[k]), 270, y, { size: 7, align: 'right', bold: true });
      MB.UI.text(ctx, '+' + (ev.after[k] - ev.before[k]), 300, y, { size: 7, align: 'right', color: '#c03030' });
      y += 15;
    }
  }
}
MB.BattleScene = BattleScene;

// capsule icon drawing (used in battle and bag)
MB.drawCapsuleIcon = function (ctx, id, x, y, scale, rot, open) {
  // Aether Capsule: a horizontal pill with a crystal band — each grade has its own colours
  const C = { basic_capsule: ['#d85a3a', '#e8e4d8', '#80e0ff'], great_capsule: ['#3a78d8', '#e8e4d8', '#ffe070'], ultra_capsule: ['#282830', '#e8c040', '#ff70c0'], night_capsule: ['#28305a', '#50e0a0', '#c0a0ff'], aqua_capsule: ['#30a8d8', '#e0f4ff', '#ffffff'], swift_capsule: ['#e8b020', '#3058b8', '#ffffff'], ancient_capsule: ['#8a6a38', '#d8c8a0', '#60f0c0'], legendary_capsule: ['#8a38d8', '#f0e070', '#ffffff'], master_capsule: ['#6030b0', '#ff60c0', '#fff070'] };
  const c = C[id] || C.basic_capsule;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); ctx.scale(scale || 1, scale || 1);
  const o = open ? 3 : 0;
  ctx.fillStyle = '#1a1a24';
  MB.UI.rr(ctx, -7 - o, -4, 14 + o * 2, 8, 4); ctx.fill();
  ctx.fillStyle = c[0]; MB.UI.rr(ctx, -6 - o, -3, 6.5, 6, 3); ctx.fill();
  ctx.fillStyle = c[1]; MB.UI.rr(ctx, -0.5 + o, -3, 6.5, 6, 3); ctx.fill();
  ctx.fillStyle = '#1a1a24'; ctx.fillRect(-1, -4, 2, 8);
  ctx.fillStyle = c[2]; ctx.beginPath(); ctx.moveTo(0, -2.2); ctx.lineTo(1.4, 0); ctx.lineTo(0, 2.2); ctx.lineTo(-1.4, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(-5 - o, -2.2, 3, 1);
  ctx.restore();
};
