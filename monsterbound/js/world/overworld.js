'use strict';
// =====================================================================================
// OVERWORLD SCENE — exploration, collisions, NPCs, trainers, encounters, rendering.
// =====================================================================================
class Overworld {
  constructor() {
    this.T = 16;
    this.moving = null; // {fx,fy,tx,ty,t,dur}
    this.busy = false;
    this.frame = 0; this.animT = 0; this.waterT = 0;
    this.banner = null;
    this.queueList = [];
    this.npcTimers = {};
    this.emotes = [];
    this.bike = false;
    MB.Over = this;
  }
  get S() { return MB.state; }
  get map() { return MB.World.get(this.S.map); }
  get surfing() { return !!this.S.surfing; }
  enter() { this.onEnterMap(true); }
  bgUpdate(dt) { this.animT += dt; }
  musicFor() {
    const m = this.map;
    const ev = MB.World.events();
    if (m.kind === 'town' && ev.some((e) => e.type === 'festival') && !m.indoor) return 'festival';
    if (this.surfing && m.kind !== 'cave') return 'sea:surf';
    if (this.bike && !m.indoor) return 'route:bike';
    return m.music || (m.kind === 'cave' ? 'cave' : m.kind === 'town' ? 'town' : 'route');
  }
  queue(fn) { this.queueList.push(fn); }
  async runScript(fn) {
    if (this.busy) return;
    this.busy = true;
    try { await fn(); } catch (e) { console.error(e); MB.toast('Script error: ' + e.message, '#802020'); }
    this.busy = false;
    MB.input.clear();
    this.refresh();
  }
  refresh() { /* npc visibility is evaluated live */ }
  visibleNpcs() { return this.map.npcs.filter((n) => this.npcVisible(n)); }
  npcVisible(n) {
    if (n.trainer && n.cond === undefined && false) return true;
    if (n.cond && !MB.checkCond(n.cond)) return false;
    if (n.legend && this.S.flags['caught_' + n.legend]) return false;
    if (n.schedule) { const tod = MB.World.timeOfDay(); if (n.schedule[tod] === null) return false; }
    if (n.hiddenUntilDay === this.S.day) return false;
    return true;
  }
  npcAt(x, y) { return this.visibleNpcs().find((n) => n.x === x && n.y === y); }

  // ---------------- map entry / warps ----------------
  onEnterMap(first) {
    const S = this.S, m = this.map;
    if (!S.visited[m.id]) { S.visited[m.id] = true; MB.Quests.onVisit(m.id); }
    else MB.Quests.onVisit(m.id);
    if (!m.indoor && m.kind !== 'cave') S.lastOutdoor = { map: m.id, x: S.px, y: S.py };
    if (m.spec.fly && !m.indoor) S.lastTown = m.id;
    MB.audio.play(this.musicFor());
    const name = m.name;
    if (m.indoor) this.banner = null;
    if (!m.indoor && (first || this.lastBannerName !== name)) this.banner = { text: name, sub: m.spec.subtitle || '', t: 2.6 };
    this.lastBannerName = name;
    this.spawnDynamic();
    // auto save
    if (S.settings.autosave !== false && !first && S.slot !== undefined && S.slot !== null && !m.indoor) { this.autosaveT = 0.5; }
    // check triggers / sight on arrival
    this.checkSight();
  }
  spawnDynamic() {
    const S = this.S, m = this.map;
    m.npcs = m.npcs.filter((n) => !n.dynamic);
    m.items = m.items.filter((n) => !n.dynamic);
    const ev = MB.World.events();
    const r = new MB.RNG('dyn' + m.id + S.day);
    const free = () => { for (let i = 0; i < 300; i++) { const x = r.int(2, m.w - 3), y = r.int(2, m.h - 3); const c = m.tiles[y][x]; if ((c === '.' || c === ':' || c === '=' || c === 's') && !this.npcAt(x, y)) return [x, y]; } return null; };
    if (ev.some((e) => e.type === 'merchant' && e.map === m.id)) { const p = free(); if (p) m.npcs.push({ id: 'merchant', x: p[0], y: p[1], dir: 'down', move: 'still', dynamic: true, name: 'Traveling Merchant', app: { skin: '#c08860', hair: '#402010', hairStyle: 'hat', hat: '#806030', top: '#a04060', bottom: '#403020' }, script: 'merchant' }); }
    const gl = ev.find((e) => e.type === 'glitter' && e.map === m.id);
    if (gl) { const p = free(); if (p) m.items.push({ x: p[0], y: p[1], item: gl.item, qty: 1, hidden: true, flag: 'glitter:' + S.day, dynamic: true, glitter: true }); }
    if (S.flags.champion && m.id === 'willowbrook') { const p = [Math.floor(m.w / 2) + 3, Math.floor(m.h / 2) + 2]; if (MB.World.dayOfWeek() >= 5) m.npcs.push({ id: 'rival_rm', x: p[0], y: p[1], dir: 'down', move: 'still', dynamic: true, name: 'Kael', app: S.rivalApp || { skin: '#f8d8b8', hair: '#c03828', hairStyle: 'spiky', top: '#303038', bottom: '#3050a0' }, script: 'rival_rematch' }); }
  }
  async warpTo(mapId, x, y, dir, opts = {}) {
    const S = this.S;
    if (MB.WORLD_SPECS[mapId] && MB.WORLD_SPECS[mapId].region && !MB.WORLD_SPECS[mapId].interior) S.region = MB.WORLD_SPECS[mapId].region;
    S.map = mapId;
    const m = this.map;
    if (opts.door) {
      // find the building door in this map (we arrive outside, one tile below)
      const b = m.buildings.find((bb) => bb.id === opts.door);
      if (b) { x = b.door.x; y = b.door.y + 1; }
    }
    if (x === null || x === undefined) {
      const c = m.buildings.find((b) => b.kind === 'center') || (m.kind === 'town' ? m.buildings.find((b) => b.id === 'wb_home') || m.buildings[0] : null);
      if (c) { x = c.door.x; y = c.door.y + 1; }
      else if (m.entry) { [x, y] = m.entry; }
      else if (m.exits[0]) { [x, y] = m.exits[0].inner; }
      else { x = Math.floor(m.w / 2); y = Math.floor(m.h / 2); }
    }
    // never land inside something solid
    if (!this.isFree(x, y)) { const sp = this.nearestFree(x, y); x = sp[0]; y = sp[1]; }
    S.px = x; S.py = y; S.dir = dir || S.dir;
    this.moving = null;
    if (!this.canSurfTile(m.tiles[y][x])) S.surfing = false;
    this.onEnterMap(false);
  }
  nearestFree(x, y) {
    const m = this.map;
    for (let r = 1; r < 12; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < m.w && ny < m.h && this.isFree(nx, ny)) return [nx, ny]; }
    return [x, y];
  }
  isFree(x, y) { const c = MB.World.tileAt(this.map, x, y); return c && (MB.MapGen.PASS.has(c) && c !== 'L' && c !== 'R' && c !== 'r') && !this.npcAt(x, y); }
  async flyTo(mapId) {
    const go = async () => {
      MB.audio.sfx('rift');
      await MB.fadeOut(0.5, '#fff');
      this.S.surfing = false; this.bike = false;
      await this.warpTo(mapId, null, null, 'down');
      await MB.fadeIn(0.5, '#fff');
    };
    // usually called from the map menu, which already runs inside a script
    if (this.busy) await go(); else await this.runScript(go);
  }
  async escapeRope() {
    const S = this.S;
    const o = S.lastOutdoor || { map: S.lastTown || 'willowbrook' };
    await MB.fadeOut(0.4);
    await this.warpTo(o.map, o.x, o.y, 'down');
    await MB.fadeIn(0.4);
  }
  toggleBike() {
    const m = this.map;
    if (m.indoor) { MB.say('You can\'t ride a bike in here!'); return; }
    if (this.surfing) return;
    this.bike = !this.bike; MB.audio.play(this.musicFor());
    MB.toast(this.bike ? 'You got on the Trail Bike.' : 'You got off the Trail Bike.');
  }

  // ---------------- passability ----------------
  tilePassable(c, dir, x, y) {
    const S = this.S, K = S.keyItems;
    if (c === null) return false;
    if (c === 'L') return dir === 'down';
    if (c === 'R') return (S.riftPhase || 0) === 1;
    if (c === 'r') return (S.riftPhase || 0) === 0;
    if (c === 'v') return !!(S.gates && S.gates[this.map.id + ':' + x + ',' + y]);
    if (c === 'H') return !!K.climb_claws;
    if (c === '~' || c === 'D') return this.surfing;
    if (MB.MapGen.PASS.has(c)) return !this.surfing || c === 'K' || true;
    return false;
  }
  canSurfTile(c) { return c === '~' || c === 'D'; }

  // ---------------- update ----------------
  update(dt) {
    const S = this.S, I = MB.input;
    this.animT += dt; this.waterT += dt;
    if (this.waterT > 0.25) { this.waterT = 0; this.frame = (this.frame + 1) % 4; }
    // clock
    if (S.settings.realTime) { const d = new Date(); S.clock = d.getHours() * 60 + d.getMinutes(); }
    else { S.clock += dt; if (S.clock >= 1440) { S.clock -= 1440; S.day++; MB.toast(`A new day: ${MB.World.DAY_NAMES[MB.World.dayOfWeek()]}`); const ev = MB.World.events(); if (ev[0]) MB.toast(ev[0].text, '#604010'); } }
    S.playTime += dt;
    if (this.banner) { this.banner.t -= dt; if (this.banner.t <= 0) this.banner = null; }
    for (const e of this.emotes) e.t -= dt; this.emotes = this.emotes.filter((e) => e.t > 0);
    if (this.autosaveT !== undefined) { this.autosaveT -= dt; if (this.autosaveT <= 0) { this.autosaveT = undefined; MB.Save.save(S.slot, true); } }
    this.updateNpcs(dt);
    if (this.moving) { this.stepMove(dt); return; }
    if (this.busy) return;
    if (this.queueList.length) { const fn = this.queueList.shift(); this.runScript(fn); return; }
    // menus
    if (I.pressed('b')) { MB.audio.sfx('select'); this.runScript(() => MB.Game.push(new MB.PauseScene())); return; }
    if (I.pressed('inv')) { this.runScript(() => MB.openMenu('bag')); return; }
    if (I.pressed('party')) { this.runScript(() => MB.openMenu('party')); return; }
    if (I.pressed('map') && S.keyItems.town_map) { this.runScript(() => MB.openMenu('map')); return; }
    if (I.pressed('dex') && S.keyItems.aetherdex) { this.runScript(() => MB.openMenu('dex')); return; }
    if (I.pressed('quests')) { this.runScript(() => MB.openMenu('quests')); return; }
    if (I.pressed('rift')) { if (S.keyItems.rift_lens && S.region === 'V') { this.toggleRift(); } else if (S.region === 'V') MB.toast('You need a Rift Lens.'); return; }
    if (I.pressed('a')) { this.interact(); return; }
    // movement
    for (const d of ['up', 'down', 'left', 'right']) {
      if (I.held(d)) {
        if (S.dir !== d && I.pressed(d)) { S.dir = d; this.turnT = 0.09; return; }
        if (this.turnT > 0) { this.turnT -= dt; return; }
        S.dir = d;
        this.tryMove(d);
        return;
      }
    }
    this.turnT = 0;
  }
  toggleRift() {
    const S = this.S;
    const np = (S.riftPhase || 0) ? 0 : 1;
    // can't phase into a solid crystal
    const c = this.map.tiles[S.py][S.px];
    if ((c === 'R' && np === 0) || (c === 'r' && np === 1)) { MB.audio.sfx('error'); MB.toast('A crystal would form where you stand!'); return; }
    S.riftPhase = np; MB.audio.sfx('rift'); this.riftFlash = 0.4;
    MB.toast(np ? 'Shifted to the Gloam phase.' : 'Shifted to the Bright phase.', np ? '#302060' : '#605020');
  }
  speed() { return this.bike ? 0.075 : MB.input.held('run') && this.S.keyItems.running_shoes && !this.surfing ? 0.11 : this.surfing ? 0.14 : 0.19; }
  tryMove(d) {
    const S = this.S, m = this.map;
    const [dx, dy] = MB.dirs[d];
    const nx = S.px + dx, ny = S.py + dy;
    // leaving the map edge via exit
    if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h) { this.tryExit(d); return; }
    // warps (doors)
    const warp = m.warps.find((w) => w.x === nx && w.y === ny && !w.exitTo);
    if (warp) { this.enterWarp(warp); return; }
    // portals into walls (cave entrances)
    const portal = m.portals.find((p) => p.x === nx && p.y === ny);
    const c = m.tiles[ny][nx];
    if (portal && (c === 'E' || c === '#' || c === 'T')) { this.usePortal(portal); return; }
    if (this.npcAt(nx, ny)) { this.bump(); return; }
    // boulders
    if (c === 'B') {
      if (S.keyItems.power_gloves || m.freePush) {
        const bx = nx + dx, by = ny + dy;
        const bc = MB.World.tileAt(m, bx, by);
        if (bc && (bc === '.' || bc === 'G' || bc === ':' || bc === '_' || bc === 'i') && !this.npcAt(bx, by)) {
          m.tiles[by][bx] = 'B'; m.tiles[ny][nx] = m.freePush ? 'G' : '.'; MB.audio.sfx('bump');
        } else this.bump();
      } else { this.bump(); if (!this.pushHint) { this.pushHint = true; MB.toast('A heavy boulder. Power Gloves could push it.'); } }
      return;
    }
    if (c === 'L' && d === 'down') { // ledge hop
      const ly = ny + 1;
      if (this.tilePassable(MB.World.tileAt(m, nx, ly), d, nx, ly) && !this.npcAt(nx, ly)) { MB.audio.sfx('ledge'); this.startMove(nx, ly, this.speed() * 1.6, true); }
      else this.bump();
      return;
    }
    // surfing transitions
    if (this.surfing && !this.canSurfTile(c) && this.tilePassable(c, d, nx, ny)) { S.surfing = false; MB.audio.play(this.musicFor()); this.startMove(nx, ny, this.speed()); return; }
    if (!this.surfing && this.canSurfTile(c)) { this.bump(); return; }
    if (!this.tilePassable(c, d, nx, ny)) { this.bump(); return; }
    this.startMove(nx, ny, this.speed());
  }
  bump() { if (!this.bumpT || this.bumpT < performance.now()) { MB.audio.sfx('bump'); this.bumpT = performance.now() + 350; } }
  startMove(tx, ty, dur, hop) { const S = this.S; this.moving = { fx: S.px, fy: S.py, tx, ty, t: 0, dur, hop }; this.stepParity = !this.stepParity; }
  stepMove(dt) {
    const mv = this.moving, S = this.S;
    mv.t += dt;
    if (mv.t >= mv.dur) {
      S.px = mv.tx; S.py = mv.ty; this.moving = null;
      this.afterStep();
    }
  }
  tryExit(d) {
    const S = this.S, m = this.map;
    const side = { up: 'n', down: 's', left: 'w', right: 'e' }[d];
    const e = m.exits.find((x) => x.side === side && x.cells.some(([a, b]) => a === S.px && b === S.py));
    if (!e) { this.bump(); return; }
    // blocking NPCs (gates)
    const blocker = this.visibleNpcs().find((n) => n.at === 'exit:' + side && (n.script === 'gate_badge' || n.script === 'gate_flag' || n.script === 'wb_guard'));
    if (blocker) { this.runScript(async () => { this.faceNpc(blocker); await this.runNpc(blocker); }); return; }
    if (e.gate && !this.gateOpen(e.gate)) { this.runScript(() => MB.say(e.gateText || 'The way is blocked.')); return; }
    this.runScript(async () => {
      const dest = MB.World.get(e.to);
      const back = dest.exits.find((x) => x.to === m.id && x.side === e.toSide) || dest.exits.find((x) => x.to === m.id);
      if (!back) { await MB.say('This path leads nowhere yet.'); return; }
      // keep relative offset along the edge
      const k = e.cells.findIndex(([a, b]) => a === S.px && b === S.py);
      const [tx, ty] = back.cells[Math.min(k, back.cells.length - 1)];
      const inward = { n: [0, 1], s: [0, -1], w: [1, 0], e: [-1, 0] }[back.side];
      await MB.fadeOut(0.18);
      await this.warpTo(e.to, tx + inward[0], ty + inward[1], d);
      await MB.fadeIn(0.18);
    });
  }
  gateOpen(g) {
    const K = this.S.keyItems;
    if (g === 'shears') return !!K.shears;
    if (g === 'surf') return !!K.aqua_saddle;
    if (g === 'climb') return !!K.climb_claws;
    if (g.startsWith('flag:')) return !!this.S.flags[g.slice(5)];
    return true;
  }
  enterWarp(w) {
    const S = this.S;
    this.runScript(async () => {
      MB.audio.sfx('door');
      await MB.fadeOut(0.2);
      const dest = MB.World.get(w.to);
      // arrive on the interior exit mat, one step above it
      const mat = dest.warps.find((x) => x.exitTo);
      let ax, ay;
      if (dest.entry) [ax, ay] = dest.entry;
      else if (mat) { ax = mat.x; ay = mat.y - 1; }
      else { ax = Math.floor(dest.w / 2); ay = dest.h - 2; }
      S.surfing = false; this.bike = false;
      await this.warpTo(w.to, ax, ay, 'up');
      await MB.fadeIn(0.2);
    });
  }
  usePortal(p) {
    const S = this.S;
    if (p.cond && !MB.checkCond(p.cond)) { this.runScript(() => MB.say(p.lockedText || 'It won\'t open.')); return; }
    this.runScript(async () => {
      MB.audio.sfx('door');
      await MB.fadeOut(0.25);
      const dest = MB.World.get(p.to);
      const back = dest.portals.find((q) => q.id === p.toPortal) || dest.portals.find((q) => q.to === this.map.id);
      let x, y;
      if (back) { x = back.x; y = back.y + 1; if (!this.isFreeIn(dest, x, y)) { const alt = [[0, -1], [1, 0], [-1, 0]].map(([a, b]) => [back.x + a, back.y + b]).find(([a, b]) => this.isFreeIn(dest, a, b)); if (alt) [x, y] = alt; } }
      S.surfing = false; this.bike = false;
      await this.warpTo(p.to, x, y, 'down');
      await MB.fadeIn(0.25);
    });
  }
  isFreeIn(m, x, y) { const c = MB.World.tileAt(m, x, y); return c && MB.MapGen.PASS.has(c) && c !== '>' && c !== 'R' && c !== 'r'; }

  afterStep() {
    const S = this.S, m = this.map;
    const c = m.tiles[S.py][S.px];
    S.steps = (S.steps || 0) + 1;
    // step-based systems
    if (S.repel > 0) { S.repel--; if (S.repel === 0) MB.toast('The Wild Ward wore off.'); }
    if (S.lure > 0) S.lure--;
    if (S.steps % 128 === 0) for (const mon of S.party) if (!mon.egg) mon.friend = Math.min(255, mon.friend + (mon.item === 'comfort_bell' ? 2 : 1));
    MB.Breeding.step(1);
    // exits on mats / ladders / teleporters / switches
    const mat = m.warps.find((w) => w.exitTo && w.x === S.px && w.y === S.py);
    if (mat) {
      this.runScript(async () => {
        MB.audio.sfx('door'); await MB.fadeOut(0.2);
        const parent = MB.World.get(mat.to);
        const b = parent.buildings.find((bb) => bb.id === mat.exitTo);
        await this.warpTo(mat.to, b ? b.door.x : null, b ? b.door.y + 1 : null, 'down');
        await MB.fadeIn(0.2);
      });
      return;
    }
    if (c === '>') { const p = m.portals.find((q) => q.x === S.px && q.y === S.py); if (p) { this.usePortal(p); return; } }
    if (c === 't' && m.teleports) {
      const tp = m.teleports.find(([x, y]) => x === S.px && y === S.py);
      if (tp) { this.runScript(async () => { MB.audio.sfx('rift'); await MB.fadeOut(0.15, '#c0a0ff'); S.px = tp[2]; S.py = tp[3]; await MB.fadeIn(0.15, '#c0a0ff'); }); return; }
    }
    if (c === 'q') {
      S.gates = S.gates || {};
      // toggle the nearest gate row above
      for (let y = S.py - 1; y >= 0; y--) { const gx = m.tiles[y].indexOf('v'); if (gx >= 0) { const k = m.id + ':' + gx + ',' + y; S.gates[k] = !S.gates[k]; MB.audio.sfx('statup'); MB.toast(S.gates[k] ? 'A gate opened somewhere!' : 'A gate closed.'); break; } }
    }
    // ice sliding
    if (c === 'i') { const [dx, dy] = MB.dirs[S.dir]; const nx = S.px + dx, ny = S.py + dy; const nc = MB.World.tileAt(m, nx, ny); if (nc && this.tilePassable(nc, S.dir, nx, ny) && !this.npcAt(nx, ny) && nc !== 'B') { this.startMove(nx, ny, 0.07); return; } }
    // triggers
    for (const t of m.triggers) {
      const [ax, ay, aw, ah] = t.area;
      if (S.px >= ax && S.px < ax + aw && S.py >= ay && S.py < ay + ah && (!t.once || !S.flags['trig:' + m.id + ':' + t.script]) && MB.checkCond(t.cond)) {
        if (t.once) S.flags['trig:' + m.id + ':' + t.script] = true;
        const fn = MB.SCRIPTS[t.script]; if (fn) { this.runScript(() => fn({ map: m })); return; }
      }
    }
    if (this.checkSight()) return;
    // wild encounters
    const kind = c === ',' ? 'grass' : this.surfing ? 'water' : m.kind === 'cave' && m.wild && (c === '.' || c === 'i') ? 'cave' : null;
    if (kind && m.wild) {
      let rate = kind === 'grass' ? (m.wild.rate || 0.1) : kind === 'water' ? 0.08 : 0.06;
      if (S.lure > 0) rate *= 2;
      if (MB.Mon.abilityId(S.party[0] || {}) === 'insomnia') rate *= 1;
      if (Math.random() < rate) {
        const enc = MB.World.rollWild(m, kind === 'water' ? 'water' : 'grass');
        if (enc) {
          const lead = S.party.find((x) => !x.egg && x.hp > 0);
          if (S.repel > 0 && lead && enc.lvl < lead.lvl && !enc.legendary) return;
          this.runScript(async () => {
            if (enc.roam) await MB.Battles.legend(enc.sp, enc.lvl);
            else await MB.Battles.wild(enc.sp, enc.lvl, { env: this.surfing ? 'water' : undefined });
          });
        }
      }
    }
  }

  // ---------------- trainers & sight ----------------
  checkSight() {
    const S = this.S;
    for (const n of this.visibleNpcs()) {
      const isTrainer = n.trainer && !S.flags['tr:' + n.id];
      const isStory = n.sight && n.script && !n.trainer && !(n.script || '').startsWith('gate');
      const isRival = !n.trainer && /^rival(\d|_v)/.test(n.id || '');
      if (!isTrainer && !isStory && !isRival) continue;
      const range = n.sight || 4;
      const [dx, dy] = MB.dirs[n.dir];
      let seen = false;
      for (let k = 1; k <= range; k++) {
        const x = n.x + dx * k, y = n.y + dy * k;
        if (x === S.px && y === S.py) { seen = true; break; }
        const c = MB.World.tileAt(this.map, x, y);
        if (!c || !(MB.MapGen.PASS.has(c)) || this.npcAt(x, y)) break;
      }
      if (isRival && !seen) { // rivals also notice you when adjacent from any side
        if (Math.abs(n.x - S.px) + Math.abs(n.y - S.py) <= 2) seen = true;
      }
      if (!seen) continue;
      this.runScript(async () => {
        MB.audio.sfx('encounter');
        this.emotes.push({ npc: n, t: 0.8, ch: '!' });
        await MB.Game.wait(0.6);
        // walk to player
        await this.walkNpcTo(n, S.px, S.py);
        this.faceNpc(n);
        if (n.trainer) {
          if (n.trainer.pre) await MB.say(n.trainer.pre, { speaker: n.trainer.name || n.trainer.cls });
          const win = await MB.Battles.trainerNpc(n, this.map);
          if (win && n.trainer.post) await MB.say(n.trainer.post, { speaker: n.trainer.name || n.trainer.cls });
        } else await this.runNpc(n);
      });
      return true;
    }
    return false;
  }
  async walkNpcTo(n, px, py) {
    for (let guard = 0; guard < 12; guard++) {
      const dist = Math.abs(n.x - px) + Math.abs(n.y - py);
      if (dist <= 1) break;
      const dx = Math.sign(px - n.x), dy = Math.sign(py - n.y);
      const step = Math.abs(px - n.x) > Math.abs(py - n.y) ? [dx, 0] : [0, dy];
      const nx = n.x + step[0], ny = n.y + step[1];
      const c = MB.World.tileAt(this.map, nx, ny);
      if (!c || !MB.MapGen.PASS.has(c) || (nx === px && ny === py)) break;
      n.dir = step[0] > 0 ? 'right' : step[0] < 0 ? 'left' : step[1] > 0 ? 'down' : 'up';
      n.anim = { fx: n.x, fy: n.y, t: 0 };
      n.x = nx; n.y = ny;
      await MB.Game.wait(0.18);
      n.anim = null;
    }
  }
  faceNpc(n) {
    const S = this.S;
    if (n.x < S.px) { n.dir = 'right'; S.dir = 'left'; } else if (n.x > S.px) { n.dir = 'left'; S.dir = 'right'; } else if (n.y < S.py) { n.dir = 'down'; S.dir = 'up'; } else if (n.y > S.py) { n.dir = 'up'; S.dir = 'down'; }
  }
  updateNpcs(dt) {
    if (this.busy) return;
    for (const n of this.visibleNpcs()) {
      if (n.move !== 'wander' && n.move !== 'look') continue;
      n._t = (n._t || 1 + Math.random() * 2) - dt;
      if (n._t > 0) continue;
      n._t = 1.5 + Math.random() * 2.5;
      const d = MB.pick(['up', 'down', 'left', 'right']);
      n.dir = d;
      if (n.move === 'look') continue;
      const [dx, dy] = MB.dirs[d];
      const nx = n.x + dx, ny = n.y + dy;
      if (Math.abs(nx - n.homeX) > 2 || Math.abs(ny - n.homeY) > 2) continue;
      const c = MB.World.tileAt(this.map, nx, ny);
      if (!c || !(c === '.' || c === ':' || c === '=' || c === '_' || c === 's' || c === 'F') || this.npcAt(nx, ny) || (nx === this.S.px && ny === this.S.py)) continue;
      if (this.moving && this.moving.tx === nx && this.moving.ty === ny) continue;
      n.anim = { fx: n.x, fy: n.y, t: 0 }; n.x = nx; n.y = ny;
      setTimeout(() => { n.anim = null; }, 200);
    }
  }

  // ---------------- interaction ----------------
  interact() {
    const S = this.S, m = this.map;
    const [dx, dy] = MB.dirs[S.dir];
    let fx = S.px + dx, fy = S.py + dy;
    const fc = MB.World.tileAt(m, fx, fy);
    // talk across counters
    let npc = this.npcAt(fx, fy);
    if (!npc && fc === 'k') { npc = this.npcAt(fx + dx, fy + dy); }
    if (npc) { this.runScript(async () => { if (!npc.legend && !npc.counter) this.faceNpc(npc); await this.runNpc(npc); }); return; }
    // items
    const it = MB.World.itemAt(m, fx, fy) || MB.World.itemAt(m, S.px, S.py);
    if (it && (!it.cond || MB.checkCond(it.cond))) {
      this.runScript(async () => {
        S.flags[it.flag] = true;
        MB.audio.sfx('item');
        const I = MB.ITEMS[it.item];
        if (I.cat === 'key') S.keyItems[it.item] = true; else MB.Bag.add(it.item, it.qty);
        await MB.say(`${S.name} found ${it.qty > 1 ? it.qty + ' ' : ''}${I.name}!${it.hidden ? ' (It was hidden!)' : ''}`);
        if (I.cat === 'mega') { MB.Achievements.unlock('first_stone'); MB.Achievements.check(); await MB.say(`An Aether Stone! It resonates with ${MB.SP[I.megaFor].name}.`); }
      });
      return;
    }
    // signs
    const sign = m.signs.find((s) => s.x === fx && s.y === fy);
    if (sign) { this.runScript(() => MB.say(sign.text)); return; }
    // PC / healing machine
    if (fc === 'p') { this.runScript(async () => { MB.audio.sfx('select'); const c = await MB.ask('Storage System booted up.', ['Creature Storage', 'Check Hall of Fame', 'Log off']); if (c === 0) await MB.Game.push(new MB.PCScene()); if (c === 1) await MB.say(S.hallOfFame && S.hallOfFame.length ? `Hall of Fame entries: ${S.hallOfFame.length}. Latest team: ${S.hallOfFame[S.hallOfFame.length - 1].team.map((t) => t.name).join(', ')}` : 'No entries yet.'); }); return; }
    if (fc === 'Q') { this.runScript(() => MB.say(MB.pick(['Rows of books about creature ecology.', '"The Great Becoming: Myth or Science?" by L. Vance.', 'A cookbook titled "101 Berry Recipes".', '"Type Matchups for Beginners". Flame beats Nature, Aqua beats Flame...']))); return; }
    if (fc === 'P') { this.runScript(() => MB.say('An ancient pedestal carved with glowing runes.')); return; }
    // field obstacles
    if (fc === 'b') { if (S.keyItems.shears) this.runScript(async () => { if (await MB.yesno('This bush could be cut with the Garden Shears. Cut it?')) { m.tiles[fy][fx] = '.'; MB.audio.sfx('hit'); } }); else this.runScript(() => MB.say('A thorny bush blocks the way. Sharp shears could cut it.')); return; }
    if (fc === 'C') { if (S.keyItems.pick_hammer) this.runScript(async () => { if (await MB.yesno('This boulder is cracked. Smash it with the Pick Hammer?')) { m.tiles[fy][fx] = m.kind === 'cave' ? '.' : '.'; MB.audio.sfx('super'); if (Math.random() < 0.3 && m.wild) { const enc = MB.World.rollWild(m, 'grass'); if (enc) await MB.Battles.wild(enc.sp, enc.lvl); } else if (Math.random() < 0.3) { const f = MB.pick(['star_dust', 'heart_scale', 'nugget', 'ember_shard', 'frost_shard', 'ancient_coin']); MB.Bag.add(f); await MB.say(`You found a ${MB.ITEMS[f].name} in the rubble!`); } } }); else this.runScript(() => MB.say('A cracked boulder. A Pick Hammer could break it.')); return; }
    if (fc === 'H' && !S.keyItems.climb_claws) { this.runScript(() => MB.say('A rocky wall with handholds. Climbing Claws would let you scale it.')); return; }
    if (this.canSurfTile(fc) && !this.surfing) {
      if (fc === 'D') { const p = m.portals.find((q) => q.x === fx && q.y === fy); if (p && S.keyItems.dive_gear) { this.runScript(async () => { if (await MB.yesno('The water here is deep and dark. Dive down?')) { this.runScript(() => {}); this.busy = false; this.usePortal(p); } }); return; } }
      if (S.keyItems.aqua_saddle) {
        this.runScript(async () => {
          const swimmer = S.party.find((x) => !x.egg && x.hp > 0 && (MB.SP[x.sp].types.includes('Aqua') || MB.SP[x.sp].water));
          if (await MB.yesno(`The water is calm. ${swimmer ? swimmer.name + ' can' : 'Your creatures can'} carry you. Surf?`)) { S.surfing = true; this.bike = false; MB.audio.play(this.musicFor()); this.startMove(fx, fy, 0.25); }
        });
      } else if (S.keyItems.fishing_rod) this.runScript(() => this.fish());
      else this.runScript(() => MB.say('The water is deep blue.'));
      return;
    }
    if (this.surfing && fc === 'D') { const p = m.portals.find((q) => q.x === fx && q.y === fy); if (p && S.keyItems.dive_gear) { this.usePortal(p); return; } }
    if (this.surfing && S.keyItems.fishing_rod && this.canSurfTile(fc)) { this.runScript(() => this.fish()); return; }
    // hidden item hint
    const hid = m.items.find((i) => i.hidden && !S.flags[i.flag] && Math.abs(i.x - S.px) + Math.abs(i.y - S.py) <= 1);
    if (hid) this.runScript(() => MB.say('Something seems to glint nearby...'));
  }
  async fish() {
    const S = this.S, m = this.map;
    const [dx, dy] = MB.dirs[S.dir];
    const fc = MB.World.tileAt(m, S.px + dx, S.py + dy);
    if (!this.canSurfTile(fc)) return MB.say('There\'s no water to fish in here.');
    await MB.say('You cast your line...', { auto: 0.6 });
    await MB.Game.wait(0.5 + Math.random() * 1.2);
    if (Math.random() < 0.65) {
      await MB.say('Oh! A bite!', { auto: 0.4 });
      const enc = MB.World.rollWild(Object.assign({}, m, { wild: Object.assign({ lvl: [5, 10] }, m.wild || {}, { water: (m.wild && m.wild.water) || ['lake'] }) }), 'water');
      if (enc) await MB.Battles.wild(enc.sp, enc.lvl, { env: 'water' });
      else await MB.say('...It got away.');
    } else await MB.say('Not even a nibble...');
  }
  async runNpc(n) {
    const S = this.S;
    if (n.legend && !n.script) return MB.SCRIPTS.legend_generic({ npc: n, map: this.map });
    if (n.trainer) {
      if (S.flags['tr:' + n.id]) return MB.say(n.trainer.post || MB.pick(['That was a great battle!', 'I need to train more...', 'You\'re really strong!', 'Good luck on your journey!']), { speaker: n.trainer.name || n.trainer.cls });
      if (n.trainer.pre) await MB.say(n.trainer.pre, { speaker: n.trainer.name || n.trainer.cls });
      const win = await MB.Battles.trainerNpc(n, this.map);
      if (win && n.trainer.post) await MB.say(n.trainer.post, { speaker: n.trainer.name || n.trainer.cls });
      return;
    }
    if (n.script) {
      const [name, arg] = n.script.split(':');
      if (name === 'q') return MB.Quests.talk(arg);
      if (name === 'qt') return MB.Quests.deliverTalk(arg);
      if (name === 'facility') return MB.Facilities.talk(arg);
      if (name === 'shop') return MB.shopFlow(arg, this.map.name);
      if (name === 'leader') return MB.SCRIPTS.leader({ npc: n, map: this.map }, arg);
      const fn = MB.SCRIPTS[name];
      if (fn) return fn({ npc: n, map: this.map }, arg);
      return MB.say('...');
    }
    if (n.talk) {
      const lines = Array.isArray(n.talk) ? n.talk : [n.talk];
      n._ti = n._ti || 0;
      const line = lines[n._ti % lines.length]; n._ti++;
      return MB.say(line, { speaker: n.name });
    }
    return MB.say(MB.pick(['Nice day, isn\'t it?', 'Have you visited the Healing Center? It\'s free!', 'I wish I had a creature as strong as yours.', 'They say rare creatures appear at night.', 'Have you heard of Mega Evolution? It sounds amazing!']));
  }

  // ---------------- rendering ----------------
  camera() {
    const S = this.S, m = this.map, T = this.T;
    let px = S.px * T, py = S.py * T;
    if (this.moving) { const k = Math.min(1, this.moving.t / this.moving.dur); px = MB.lerp(this.moving.fx, this.moving.tx, k) * T; py = MB.lerp(this.moving.fy, this.moving.ty, k) * T; }
    let cx = px + T / 2 - MB.W / 2, cy = py + T / 2 - MB.H / 2;
    const mw = m.w * T, mh = m.h * T;
    cx = mw <= MB.W ? (mw - MB.W) / 2 : MB.clamp(cx, 0, mw - MB.W);
    cy = mh <= MB.H ? (mh - MB.H) / 2 : MB.clamp(cy, 0, mh - MB.H);
    return { cx: Math.round(cx), cy: Math.round(cy), px, py };
  }
  draw(ctx) {
    const S = this.S, m = this.map, T = this.T;
    const { cx, cy, px, py } = this.camera();
    const season = m.indoor ? 'summer' : MB.World.season();
    const theme = m.theme;
    ctx.fillStyle = m.indoor ? '#101018' : '#000'; ctx.fillRect(0, 0, MB.W, MB.H);
    const x0 = Math.floor(cx / T), y0 = Math.floor(cy / T), x1 = Math.ceil((cx + MB.W) / T), y1 = Math.ceil((cy + MB.H) / T);
    const phase = S.riftPhase || 0;
    for (let y = Math.max(0, y0); y <= Math.min(m.h - 1, y1); y++) {
      const row = m.tiles[y];
      for (let x = Math.max(0, x0); x <= Math.min(m.w - 1, x1); x++) {
        let ch = row[x];
        let variant = (x * 7 + y * 13) % 17;
        if (ch === 'R') variant = phase === 0 ? 1 : 0;
        if (ch === 'r') variant = phase === 1 ? 1 : 0;
        if (ch === 'v') variant = S.gates && S.gates[m.id + ':' + x + ',' + y] ? 1 : 0;
        if (ch === 'X') { ch = m.gym ? 'G' : m.indoor ? '_' : '.'; }
        if (ch === 'G') variant = x + y * 16;
        if (ch === 'q') { variant = 0; }
        if (m.dark && m.gym && row[x] === 'X') ch = 'G';
        const img = MB.Tiles.get(ch, theme === 'forest' ? 'meadow' : theme, season, this.frame, variant);
        ctx.drawImage(img, x * T - cx, y * T - cy);
      }
    }
    // buildings
    for (const b of m.buildings) {
      const img = MB.Tiles.building(b, season);
      const bx = b.x * T - cx, by = b.y * T - cy;
      if (bx > MB.W || by > MB.H || bx + img.width < 0 || by + img.height < 0) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(bx + 3, by + img.height - 2, img.width, 4);
      ctx.drawImage(img, bx, by);
    }
    // items
    for (const it of m.items) {
      if (S.flags[it.flag] || (it.cond && !MB.checkCond(it.cond))) continue;
      const ix = it.x * T - cx, iy = it.y * T - cy;
      if (it.hidden) { if (Math.floor(this.animT * 2 + it.x) % (it.glitter ? 3 : 9) === 0) { ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(ix + 7, iy + 5, 2, 6); ctx.fillRect(ix + 5, iy + 7, 6, 2); } continue; }
      const cat = MB.ITEMS[it.item] ? MB.ITEMS[it.item].cat : 'heal';
      MB.drawCapsuleIcon(ctx, cat === 'mega' ? 'legendary_capsule' : cat === 'key' ? 'ultra_capsule' : 'basic_capsule', ix + 8, iy + 9, 1.1, 0, 0);
    }
    // sprites sorted by y
    const ents = [];
    for (const n of this.visibleNpcs()) ents.push({ y: n.y, n });
    ents.push({ y: py / T, player: true });
    ents.sort((a, b) => a.y - b.y);
    for (const e of ents) {
      if (e.player) this.drawPlayer(ctx, px - cx, py - cy);
      else this.drawNpc(ctx, e.n, cx, cy);
    }
    // grass overlay on player
    const ptile = m.tiles[S.py] && m.tiles[S.py][S.px];
    if (ptile === ',' && !this.moving) { const img = MB.Tiles.get(',', theme, season, this.frame, 0); ctx.drawImage(img, 0, 9, 16, 7, px - cx, py - cy + 9, 16, 7); }
    // emotes
    for (const em of this.emotes) { const n = em.npc; UI_bubble(ctx, n.x * T - cx + 8, n.y * T - cy - 12, em.ch); }
    // weather & lighting
    if (!m.indoor && S.settings.weather !== false) {
      let w = MB.World.weatherFor(m);
      if (MB.World.isNight() && MB.World.events().some((e) => e.type === 'meteor') && w === 'clear') w = 'meteor';
      MB.Weather.draw(ctx, w, 1 / 60);
    }
    this.drawLighting(ctx, px - cx + 8, py - cy + 8);
    if (this.riftFlash > 0) { this.riftFlash -= 1 / 60; ctx.fillStyle = `rgba(180,140,255,${this.riftFlash})`; ctx.fillRect(0, 0, MB.W, MB.H); }
    if (S.region === 'V' && S.keyItems.rift_lens && !m.indoor) { ctx.fillStyle = phase ? 'rgba(40,20,90,0.15)' : 'rgba(255,240,180,0.06)'; ctx.fillRect(0, 0, MB.W, MB.H); }
    this.drawHud(ctx);
  }
  drawPlayer(ctx, x, y) {
    const S = this.S;
    const fr = MB.Chars.get(S.appearance);
    let f = 0;
    if (this.moving) { const k = this.moving.t / this.moving.dur; f = k > 0.25 && k < 0.85 ? (this.stepParity ? 1 : 2) : 0; }
    let hop = 0;
    if (this.moving && this.moving.hop) hop = -Math.sin((this.moving.t / this.moving.dur) * Math.PI) * 8;
    if (this.surfing) {
      const sw = S.party.find((m) => !m.egg && (MB.SP[m.sp].types.includes('Aqua') || MB.SP[m.sp].water)) || S.party.find((m) => !m.egg);
      const bob = Math.sin(this.animT * 4) * 1;
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(x + 8, y + 14, 11, 4, 0, 0, Math.PI * 2); ctx.fill();
      if (sw) { const img = MB.Sprites.get(sw.sp, false, sw.shiny); ctx.drawImage(img, x - 8, y - 6 + bob, 32, 32); }
      ctx.drawImage(fr[S.dir][0], x, y - 12 + bob, 16, 18);
      return;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(x + 8, y + 14, 6, 2.5, 0, 0, Math.PI * 2); ctx.fill();
    if (this.bike) { ctx.fillStyle = '#303038'; ctx.beginPath(); ctx.arc(x + 3, y + 13, 3, 0, Math.PI * 2); ctx.arc(x + 13, y + 13, 3, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#d04040'; ctx.fillRect(x + 3, y + 10, 10, 2); }
    ctx.drawImage(fr[S.dir][f], x, y - 4 + hop + (this.bike ? -2 : 0), 16, 18);
  }
  drawNpc(ctx, n, cx, cy) {
    const T = this.T;
    let x = n.x * T, y = n.y * T;
    if (n.anim) { const k = Math.min(1, (n.anim.t += 1 / 60) / 0.18); x = MB.lerp(n.anim.fx * T, x, k); y = MB.lerp(n.anim.fy * T, y, k); }
    x -= cx; y -= cy;
    if (x < -32 || y < -32 || x > MB.W + 32 || y > MB.H + 32) return;
    if (n.legend) {
      const img = MB.Sprites.get(n.legend);
      const bob = Math.sin(this.animT * 2 + n.x) * 2;
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(x + 8, y + 14, 14, 4, 0, 0, Math.PI * 2); ctx.fill();
      const glow = ctx.createRadialGradient(x + 8, y - 4, 2, x + 8, y - 4, 30); glow.addColorStop(0, 'rgba(255,255,220,0.4)'); glow.addColorStop(1, 'rgba(255,255,220,0)');
      ctx.fillStyle = glow; ctx.fillRect(x - 24, y - 36, 64, 64);
      ctx.drawImage(img, x - 16, y - 30 + bob, 48, 48);
      return;
    }
    const fr = MB.Chars.get(n.app);
    const f = n.anim ? (Math.floor(this.animT * 8) % 2 ? 1 : 2) : 0;
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(x + 8, y + 14, 6, 2.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.drawImage(fr[n.dir][f], x, y - 4, 16, 18);
    if (n.trainer && !this.S.flags['tr:' + n.id] && this.S.settings.showTrainers !== false) { ctx.fillStyle = 'rgba(255,80,80,0.7)'; ctx.fillRect(x + 7, y - 7, 2, 2); }
    if (n.script && n.script.startsWith('q:')) { const st = this.S.quests[n.script.slice(2)]; if (!st) UI_bubble(ctx, x + 8, y - 10, '!', '#f0c030'); else if (!st.done && MB.Quests.met(MB.Quests.get(n.script.slice(2)), st)) UI_bubble(ctx, x + 8, y - 10, '?', '#40c040'); }
  }
  drawLighting(ctx, lx, ly) {
    const S = this.S, m = this.map;
    if (m.dark) {
      const r = S.keyItems.glow_lantern ? 90 : 34;
      const g = ctx.createRadialGradient(lx, ly, r * 0.35, lx, ly, r);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(4,2,10,0.96)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, MB.W, MB.H);
      return;
    }
    if (m.indoor || S.settings.tint === false) return;
    const h = (S.clock / 60) % 24;
    let a = 0, col = '20,30,80';
    if (h >= 20 || h < 5) a = 0.42; else if (h >= 5 && h < 6.5) { a = 0.42 * (1 - (h - 5) / 1.5); } else if (h >= 17 && h < 20) { a = 0.12 + ((h - 17) / 3) * 0.3; col = h < 18.5 ? '200,90,40' : '60,40,100'; }
    if (m.kind === 'cave') a *= 0.3;
    if (a > 0) {
      ctx.fillStyle = `rgba(${col},${a})`; ctx.fillRect(0, 0, MB.W, MB.H);
      if (h >= 19.5 || h < 5.5) { // lamps glow
        const { cx, cy } = this.camera();
        for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.tiles[y][x] === 'l') { const gx = x * 16 - cx + 8, gy = y * 16 - cy + 4; if (gx < -40 || gy < -40 || gx > MB.W + 40 || gy > MB.H + 40) continue; const g = ctx.createRadialGradient(gx, gy, 2, gx, gy, 36); g.addColorStop(0, 'rgba(255,230,150,0.45)'); g.addColorStop(1, 'rgba(255,230,150,0)'); ctx.fillStyle = g; ctx.fillRect(gx - 36, gy - 36, 72, 72); }
      }
    }
  }
  drawHud(ctx) {
    const S = this.S;
    if (this.banner) {
      const t = this.banner.t, a = Math.min(1, t * 2, (2.6 - t) * 4);
      ctx.globalAlpha = a;
      MB.UI.box(ctx, 6, 6, 170, this.banner.sub ? 34 : 22, 'dark');
      MB.UI.text(ctx, this.banner.text, 16, 20, { size: 9, bold: true, color: '#fff' });
      if (this.banner.sub) MB.UI.text(ctx, this.banner.sub, 16, 32, { size: 6, color: '#c0c8e8' });
      ctx.globalAlpha = 1;
    }
    if (S.repel > 0) MB.UI.text(ctx, `Ward ${S.repel}`, MB.W - 6, MB.H - 6, { size: 6, align: 'right', color: '#fff' });
    if (S.region === 'V' && S.keyItems.rift_lens) MB.UI.text(ctx, S.riftPhase ? '◐ GLOAM' : '◑ BRIGHT', MB.W - 6, 12, { size: 6, align: 'right', color: S.riftPhase ? '#c0a0ff' : '#fff0a0', bold: true });
  }
}
function UI_bubble(ctx, x, y, ch, col) {
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#303040'; ctx.lineWidth = 0.8;
  MB.UI.rr(ctx, x - 5, y - 8, 10, 10, 2); ctx.fill(); ctx.stroke();
  MB.UI.text(ctx, ch, x, y, { size: 7, bold: true, align: 'center', color: col || '#e03030', shadow: false });
}
MB.Overworld = Overworld;

// extra service scripts that need the overworld
MB.SCRIPTS.nurse = async (ctx) => {
  const S = MB.state;
  await MB.say('Welcome to the Healing Center! Shall I restore your creatures to full health?', { speaker: 'Nurse' });
  if (!(await MB.yesno('Heal your team?'))) return MB.say('We hope to see you again!', { speaker: 'Nurse' });
  MB.Sc.heal(); MB.audio.sfx('heal');
  await MB.Game.wait(1.2);
  const parent = MB.World.get(MB.World.get(S.map).parent || S.map);
  const b = parent.buildings && parent.buildings.find((bb) => bb.id === S.map);
  S.lastCenter = { map: parent.id, door: b ? b.id : null };
  await MB.say('Your creatures are fighting fit! We hope to see you again!', { speaker: 'Nurse' });
  if (S.slot !== undefined && S.slot !== null) MB.Save.save(S.slot, true);
};
MB.SCRIPTS.merchant = async () => {
  await MB.say('Psst! Rare wares from distant lands. Only here today!', { speaker: 'Merchant' });
  await MB.Game.push(new MB.ShopScene(MB.SHOPS.merchant.map((id) => id), 'Traveling Merchant'));
};
