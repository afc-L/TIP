// Campaign model: factions, territories, armies, economy, battles (auto-resolve), events, objectives, saving.
// Modes: 'classic' (the original three-realm campaign, rules unchanged), 'grand' (Greater Realm, six factions,
// diplomacy, technology, landmarks and ruins) and 'conquest' (Greater Realm, small start, conquer everything).
// No DOM here - the campaign scene drives it and supplies interactive hooks (battles, event choices).
(function () {
  const RW = window.RW;
  const U = RW.util;
  const D = RW.data;
  const LEGACY_KEY = 'realmsOfWar.campaign.v1';
  const SLOT_PREFIX = 'realmsOfWar.save.';
  const SLOTS = ['auto', '1', '2', '3', '4', '5'];
  const MAX_UNITS = 12;

  const DIFF = {
    easy: { aiIncome: 0.85, playerIncome: 1.15, aggression: 0.6, need: 1.6 },
    normal: { aiIncome: 1.0, playerIncome: 1.0, aggression: 1.0, need: 1.25 },
    hard: { aiIncome: 1.1, playerIncome: 1.0, aggression: 1.35, need: 1.12 },
  };
  const STATES = { war: 'War', peace: 'Peace', nap: 'Non-aggression pact', alliance: 'Alliance' };

  function randomCommander(faction, exclude = []) {
    const names = D.COMMANDER_NAMES[faction].filter((n) => !exclude.includes(n));
    const name = U.pick(names.length ? names : D.COMMANDER_NAMES[faction]);
    const trait = U.pick(D.FACTION_TRAITS[faction]);
    return { name, trait, level: 1, xp: 0, skills: {}, items: {} };
  }
  function rollRarity(bonus = 0) {
    const r = D.RARITY;
    const keys = Object.keys(r);
    const w = keys.map((k, i) => r[k].weight * (1 + bonus * i * 0.6));
    let x = Math.random() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < keys.length; i++) { x -= w[i]; if (x <= 0) return keys[i]; }
    return 'common';
  }
  function randomItem(bonus = 0, minRarity = null) {
    let rar = rollRarity(bonus);
    const order = Object.keys(D.RARITY);
    if (minRarity && order.indexOf(rar) < order.indexOf(minRarity)) rar = minRarity;
    const pool = Object.values(D.ITEMS).filter((i) => i.rarity === rar);
    return U.pick(pool).id;
  }

  class Campaign {
    constructor(data) {
      Object.assign(this, data);
      Campaign.migrate(this);
      this.map = RW.campaignMap(this.mapId);
      this.hooks = {};
    }

    // Older saves (version 1) were always the classic map.
    static migrate(c) {
      c.mode = c.mode || 'classic';
      c.mapId = c.mapId || 'classic';
      c.majors = c.majors || D.MAPS[c.mapId].factions.slice();
      c.relations = c.relations || {};
      c.explored = c.explored || [];
      c.notifications = c.notifications || [];
      c.stats = Object.assign({ won: 0, lost: 0, captured: 0, events: 0, goldEarned: 0, recruited: 0, fought: 0, history: [] }, c.stats || {});
      for (const f in c.factions) {
        const fs = c.factions[f];
        fs.techs = fs.techs || []; fs.research = fs.research || null; fs.items = fs.items || []; fs.drill = fs.drill || {}; fs.focus = fs.focus || null;
      }
      for (const a of c.armies || []) { a.commander.skills = a.commander.skills || {}; a.commander.items = a.commander.items || {}; a.doctrine = a.doctrine || 'none'; }
      for (const t of c.territories || []) { t.buildings = t.buildings || { market: false, barracks: false, walls: false }; }
      c.slot = c.slot || 'auto';
      c.version = 2;
      return c;
    }

    // ---------------------------------------------------------------- creation
    // opts: { mode: 'classic'|'grand'|'conquest', legend: legendId }
    static create(playerFaction, difficulty, commander, opts = {}) {
      const mode = opts.mode || 'classic';
      const mapId = mode === 'classic' ? 'classic' : 'greater';
      const MD = D.MAPS[mapId];
      const T = MD.territories;
      const majors = MD.factions.slice();
      const map = RW.campaignMap(mapId);
      // Starting capitals: one of each faction's options, never adjacent to another capital.
      let caps;
      for (let tries = 0; tries < 80; tries++) {
        caps = {};
        for (const f of majors) caps[f] = U.pick(MD.starts[f]);
        const ids = Object.values(caps);
        if (!ids.some((a) => ids.some((b) => a !== b && map.adj[a].includes(b)))) break;
      }
      const territories = T.map((t) => ({
        id: t.id, owner: 'rebels', level: Math.random() < 0.35 ? 2 : 1,
        buildings: { market: false, barracks: false, walls: false }, garrisonHp: 1, recruited: 0, shrine: !!t.shrine,
      }));
      for (const tr of territories) if (tr.shrine) { tr.level = 2; tr.buildings.walls = Math.random() < 0.5; }
      const factions = {};
      for (const f of majors.concat(['rebels'])) {
        factions[f] = { id: f, gold: f === 'rebels' ? 0 : 1500, alive: true, capital: caps[f] == null ? -1 : caps[f], startCapital: caps[f] == null ? -1 : caps[f], upgrades: [], wins: 0, losses: 0, isPlayer: f === playerFaction, techs: [], research: null, items: [], drill: {} };
      }
      const c = new Campaign({ version: 2, mode, mapId, majors, turn: 1, player: playerFaction, difficulty, territories, factions, armies: [], log: [], shrineHold: 0, stats: {}, over: null, nextArmyId: 1, relations: {}, explored: [], notifications: [] });
      for (const f of majors) {
        const t = territories[caps[f]];
        t.owner = f; t.level = 2; t.buildings.walls = true;
        let cmd = f === playerFaction && commander ? commander : randomCommander(f);
        const army = D.FACTIONS[f].startArmy.slice();
        if (f === playerFaction && opts.legend && D.LEGENDS[opts.legend]) {
          const L = D.LEGENDS[opts.legend];
          cmd = { name: L.name, trait: null, legend: L.id, level: 1, xp: 0, skills: {}, items: {} };
          army.push(...(L.start.units || []));
          factions[f].gold += L.start.gold || 0;
        }
        if (f === playerFaction && mode === 'conquest') {
          // Conquest: a lone village and a small warband - but a bigger war chest.
          t.level = 1; t.buildings.walls = false;
          army.splice(3);
          factions[f].gold += 600;
        }
        c.addArmy(f, caps[f], cmd, army);
      }
      if (difficulty === 'hard') {
        for (const f of majors) {
          if (f === playerFaction) continue;
          const nb = map.adj[caps[f]].find((n) => territories[n].owner === 'rebels' && !Object.values(caps).includes(n));
          if (nb != null) territories[nb].owner = f;
        }
      }
      for (const a of majors) for (const b of majors) if (a < b) c.relations[a + '|' + b] = { state: 'war', opinion: 0, since: 1, memory: [] };
      c.addLog(`Turn 1. ${D.FACTIONS[playerFaction].name} marches to war from ${T[caps[playerFaction]].name}.`);
      c.recordHistory();
      return c;
    }

    // ---------------------------------------------------------------- saving (multiple slots)
    static slotKey(slot) { return SLOT_PREFIX + slot; }
    static readRaw(slot) {
      try {
        const raw = localStorage.getItem(slot === 'legacy' ? LEGACY_KEY : Campaign.slotKey(slot));
        return raw ? JSON.parse(raw) : null;
      } catch (e) { return null; }
    }
    static listSaves() {
      const out = [];
      for (const slot of SLOTS.concat(['legacy'])) {
        const d = Campaign.readRaw(slot);
        if (!d || !d.factions) continue;
        out.push({ slot, turn: d.turn, player: d.player, mode: d.mode || 'classic', difficulty: d.difficulty, savedAt: d.savedAt || 0, over: d.over });
      }
      return out.sort((a, b) => b.savedAt - a.savedAt);
    }
    static load(slot) {
      if (slot == null) { const s = Campaign.listSaves().find((x) => !x.over); if (!s) return null; slot = s.slot; }
      const d = Campaign.readRaw(slot);
      if (!d || !d.factions) return null;
      try {
        const c = new Campaign(d);
        // Older single-slot saves move into the autosave slot.
        if (slot === 'legacy') { c.slot = 'auto'; if (c.save()) Campaign.deleteSave('legacy'); }
        return c;
      } catch (e) { console.error(e); return null; }
    }
    static hasSave() { return Campaign.listSaves().some((s) => !s.over); }
    static deleteSave(slot) { try { localStorage.removeItem(slot === 'legacy' ? LEGACY_KEY : Campaign.slotKey(slot)); } catch (e) { /* ignore */ } }
    save(slot) {
      if (slot) this.slot = slot;
      const data = { savedAt: Date.now() };
      for (const k of ['version', 'mode', 'mapId', 'majors', 'turn', 'player', 'difficulty', 'territories', 'factions', 'armies', 'log', 'shrineHold', 'stats', 'over', 'nextArmyId', 'relations', 'explored', 'notifications', 'slot']) data[k] = this[k];
      try { localStorage.setItem(Campaign.slotKey(this.slot), JSON.stringify(data)); return true; } catch (e) { return false; }
    }

    // ---------------------------------------------------------------- queries
    get diff() { return DIFF[this.difficulty] || DIFF.normal; }
    get grand() { return this.mode !== 'classic'; }
    terr(id) { return this.territories[id]; }
    tdef(id) { return this.map.territories[id]; }
    adj(id) { return this.map.adj[id]; }
    armyAt(tid) { return this.armies.find((a) => a.tid === tid); }
    armyById(id) { return this.armies.find((a) => a.id === id); }
    armiesOf(f) { return this.armies.filter((a) => a.faction === f); }
    owned(f) { return this.territories.filter((t) => t.owner === f); }
    addLog(text) { this.log.push({ turn: this.turn, text }); if (this.log.length > 80) this.log.shift(); }
    notify(text, kind = 'info') { this.notifications.push({ turn: this.turn, text, kind }); if (this.notifications.length > 150) this.notifications.shift(); }
    hasTech(f, id) { return this.factions[f] && this.factions[f].techs.includes(id); }
    techEffect(f, key, def = 0, mul = false) {
      let v = mul ? 1 : def;
      if (!this.grand) return mul ? 1 : def;
      for (const t of D.techFor(f)) if (this.hasTech(f, t.id) && t.effect[key] != null) v = mul ? v * t.effect[key] : v + t.effect[key];
      return v;
    }
    landmarksOf(f) { return this.territories.filter((t) => t.owner === f && this.tdef(t.id).landmark).map((t) => this.tdef(t.id).landmark); }
    landmarkSum(f, key) { return this.landmarksOf(f).reduce((s, k) => s + (D.LANDMARKS[k][key] || 0), 0); }

    territoryIncome(t) {
      const td = this.tdef(t.id);
      const ti = D.TERRAIN_INFO[td.terrain];
      let inc = ti.income + D.SETTLEMENT.levels[t.level].income + (t.buildings.market ? 70 : 0) + (t.shrine ? 40 : 0);
      if (this.factions[t.owner] && this.factions[t.owner].capital === t.id) inc += 120;
      if (t.owner === 'valor') inc *= 1.15;
      if (t.owner === 'sylvan' && td.terrain === 'forest') inc *= 1.25;
      if (td.landmark && D.LANDMARKS[td.landmark].income) inc += D.LANDMARKS[td.landmark].income;
      return Math.round(inc);
    }
    income(f) {
      let total = 0;
      for (const t of this.owned(f)) total += this.territoryIncome(t);
      const mul = this.factions[f].isPlayer ? this.diff.playerIncome : this.diff.aiIncome;
      return Math.round(total * mul * (1 + this.techEffect(f, 'income')));
    }
    // Every bonus that applies to one army in battle and on the map.
    armyMods(a) {
      const fs = this.factions[a.faction];
      return RW.compileArmyMods({ commander: a.commander, doctrine: a.doctrine, techs: this.grand ? fs.techs : [], faction: a.faction, landmarks: this.landmarksOf(a.faction) });
    }
    armyUpkeep(a) {
      let up = 0;
      for (const u of a.units) up += D.UNITS[u.typeId].upkeep;
      if (a.commander.trait === 'quartermaster') up *= 0.75;
      const m = this.armyMods(a);
      if (m.upkeepMul) up *= m.upkeepMul;
      return Math.round(up);
    }
    upkeep(f) { return this.armiesOf(f).reduce((s, a) => s + this.armyUpkeep(a), 0); }
    net(f) { return this.income(f) - this.upkeep(f); }
    maxArmies(f) { return Math.min(5 + this.techEffect(f, 'armies'), 1 + Math.floor(this.owned(f).length / 3) + this.techEffect(f, 'armies')); }
    unitCost(f, typeId, t) {
      let c = D.UNITS[typeId].cost;
      if (f === 'horde') c *= 0.8;
      if (f === 'frost') c *= 1.15;
      if (t && t.buildings.barracks) c *= 0.85;
      if (this.landmarksOf(f).includes('forges')) c *= 0.9;
      return Math.round(c);
    }
    recruitSlots(t) { return t.level + 1 + this.techEffect(t.owner, 'slots') - (t.recruited || 0); }
    // Rare units need technology (Greater Realm) or a City plus victories (classic).
    rareOk(f, ut, t) {
      if (!ut.rare) return true;
      if (this.grand) return this.hasTech(f, ut.rare.tech);
      return (!t || t.level >= 3) && this.factions[f].wins >= ut.rare.wins;
    }
    recruitable(f, t) {
      return Object.values(D.UNITS).filter((u) => u.faction === f && u.recruitable && u.tier <= t.level && this.rareOk(f, u, t));
    }
    upgradeCost(t) {
      let c = D.SETTLEMENT.upgradeCost[t.level + 1] || 0;
      if (t.owner === 'valor') c *= 0.8;
      c *= this.techEffect(t.owner, 'buildCost', 1, true);
      return Math.round(c);
    }
    buildingCost(t, key) {
      let c = D.SETTLEMENT.buildings[key].cost;
      if (t.owner === 'valor') c *= 0.8;
      c *= this.techEffect(t.owner, 'buildCost', 1, true);
      if (key === 'market') c *= this.techEffect(t.owner, 'marketCost', 1, true);
      return Math.round(c);
    }
    techCost(f, up) { return Math.round(up.cost * (f === 'arcane' ? 0.65 : 1)); }
    armyMoves(a) { return (a.commander.trait === 'tactician' ? 2 : 1) + (a.faction === 'sylvan' && this.tdef(a.tid).terrain === 'forest' ? 1 : 0); }

    unitPower(u) { return D.UNITS[u.typeId].power * Math.max(0.05, u.hp) * (1 + (u.rank || 0) * 0.08); }
    generalType(a) { return a.commander.legend ? 'legend_' + a.commander.legend : D.FACTIONS[a.faction].general; }
    armyPower(a) {
      if (!a) return 0;
      const gen = D.UNITS[this.generalType(a)] || D.UNITS[D.FACTIONS[a.faction].general];
      let p = gen.power * (a.generalHp == null ? 1 : a.generalHp) * (1 + a.commander.level * 0.05);
      for (const u of a.units) p += this.unitPower(u);
      const ups = this.factions[a.faction].upgrades.length + (this.grand ? this.factions[a.faction].techs.length * 0.3 : 0);
      return p * (1 + ups * 0.04) * (1 + a.commander.level * 0.02);
    }
    garrisonUnits(t) {
      if (!t || t.owner == null) return [];
      const n = Math.min(8, D.SETTLEMENT.levels[t.level].garrison + (t.buildings.walls ? 2 : 0));
      const list = D.GARRISONS[t.owner] || D.GARRISONS.rebels;
      const hp = U.clamp(t.garrisonHp, 0.2, 1);
      return list.slice(0, n).map((typeId) => ({ typeId, hp, rank: 0 }));
    }
    garrisonPower(t) {
      let p = 0;
      for (const u of this.garrisonUnits(t)) p += this.unitPower(u);
      return p * (t.buildings.walls ? 1.3 : 1) * (t.owner === 'frost' ? 1.25 : 1);
    }
    defensePower(tid, attackerFaction) {
      const t = this.terr(tid);
      const a = this.armyAt(tid);
      let p = 0;
      if (a && a.faction !== attackerFaction) {
        p += this.armyPower(a);
        if (a.faction === t.owner) p += this.garrisonPower(t) * 0.5;
      } else if (t.owner !== attackerFaction) p += this.garrisonPower(t);
      return p;
    }
    isSiege(tid, defenderFaction) {
      const t = this.terr(tid);
      return t.owner === defenderFaction && (t.buildings.walls || t.level >= 3);
    }

    // ---------------------------------------------------------------- diplomacy
    rel(a, b) {
      if (a === b) return { state: 'alliance', opinion: 100, memory: [] };
      const key = a < b ? a + '|' + b : b + '|' + a;
      if (!this.relations[key]) this.relations[key] = { state: 'war', opinion: 0, since: this.turn, memory: [] };
      return this.relations[key];
    }
    atWar(a, b) {
      if (a === b) return false;
      if (a === 'rebels' || b === 'rebels') return true;
      if (!this.majors.includes(a) || !this.majors.includes(b)) return true;
      return this.rel(a, b).state === 'war';
    }
    remember(a, b, text, delta) {
      const r = this.rel(a, b);
      r.opinion = U.clamp(r.opinion + delta, -100, 100);
      r.memory.push({ turn: this.turn, text, delta });
      if (r.memory.length > 12) r.memory.shift();
    }
    setState(a, b, state) {
      const r = this.rel(a, b);
      if (r.state === state) return;
      r.state = state; r.since = this.turn;
      this.addLog(`${D.FACTIONS[a].short} and ${D.FACTIONS[b].short}: ${STATES[state]}.`);
    }
    // How willing AI faction f is to deal with g (memory + shared enemies + strength).
    dealScore(f, g) {
      const r = this.rel(f, g);
      let s = r.opinion;
      const common = this.majors.filter((x) => x !== f && x !== g && this.factions[x].alive && this.atWar(f, x) && this.atWar(g, x)).length;
      s += common * 12;
      const pf = this.armiesOf(f).reduce((a, x) => a + this.armyPower(x), 0) + 1, pg = this.armiesOf(g).reduce((a, x) => a + this.armyPower(x), 0) + 1;
      if (r.state === 'war') s += U.clamp((pg / pf - 1) * 25, -20, 30) + Math.min(20, (this.turn - r.since) * 2);
      if (this.factions[g].treacherous) s -= 20;
      return s;
    }
    diploPropose(g, kind) {
      const p = this.player, fs = this.factions[p];
      if (!this.grand) return { ok: false, text: 'Diplomacy is only available in the Greater Realm.' };
      if (!this.factions[g].alive) return { ok: false, text: 'That faction is gone.' };
      const r = this.rel(p, g);
      const score = this.dealScore(g, p);
      const name = D.FACTIONS[g].name;
      if (kind === 'war') {
        if (r.state === 'war') return { ok: false, text: 'You are already at war.' };
        const broke = r.state !== 'peace' || this.turn - r.since < 5;
        this.setState(p, g, 'war');
        this.remember(p, g, 'Declared war on us', -40);
        if (r.state !== 'war' && broke) {
          fs.treacherous = this.turn;
          for (const x of this.majors) if (x !== p && x !== g) this.remember(p, x, 'Broke a treaty', -10);
        }
        for (const x of this.majors) if (x !== p && x !== g && this.rel(g, x).state === 'alliance') { this.setState(p, x, 'war'); this.remember(p, x, 'Attacked our ally', -25); }
        return { ok: true, text: `You declared war on ${name}.` };
      }
      if (kind === 'peace') {
        if (r.state !== 'war') return { ok: false, text: 'You are not at war.' };
        if (score > 8) { this.setState(p, g, 'peace'); this.remember(p, g, 'Made peace', 10); return { ok: true, text: `${name} accepts peace.` }; }
        this.remember(p, g, 'Asked for peace', -2);
        return { ok: false, text: `${name} refuses peace (they think they can still win).` };
      }
      if (kind === 'nap') {
        if (r.state === 'war') return { ok: false, text: 'Make peace first.' };
        if (r.state === 'nap' || r.state === 'alliance') return { ok: false, text: 'You already have a pact.' };
        if (score > 12) { this.setState(p, g, 'nap'); this.remember(p, g, 'Signed a pact', 10); return { ok: true, text: `${name} signs a non-aggression pact.` }; }
        return { ok: false, text: `${name} does not trust you enough for a pact.` };
      }
      if (kind === 'alliance') {
        if (r.state === 'war') return { ok: false, text: 'Make peace first.' };
        if (r.state === 'alliance') return { ok: false, text: 'You are already allies.' };
        const common = this.majors.some((x) => x !== p && x !== g && this.factions[x].alive && this.atWar(p, x) && this.atWar(g, x));
        if (score > 30 && common) { this.setState(p, g, 'alliance'); this.remember(p, g, 'Allied with us', 15); return { ok: true, text: `${name} joins you in alliance!` }; }
        return { ok: false, text: common ? `${name} wants better relations first.` : `${name} sees no common enemy to ally against.` };
      }
      return { ok: false, text: 'Unknown proposal.' };
    }
    diploGift(g, amount) {
      const fs = this.factions[this.player];
      if (fs.gold < amount) return { ok: false, text: 'Not enough gold.' };
      fs.gold -= amount; this.factions[g].gold += amount;
      this.remember(this.player, g, `Gift of ${amount} gold`, Math.min(25, Math.round(amount / 40)));
      return { ok: true, text: `${D.FACTIONS[g].name} gratefully accepts ${amount} gold.` };
    }
    diploRequestGold(g) {
      const r = this.rel(this.player, g), gs = this.factions[g];
      if (r.state !== 'alliance') return { ok: false, text: 'Only allies will lend gold.' };
      if (r.opinion < 30 || gs.gold < 1200) return { ok: false, text: `${D.FACTIONS[g].name} cannot spare gold right now.` };
      gs.gold -= 400; this.factions[this.player].gold += 400;
      this.remember(this.player, g, 'Asked for gold', -12);
      return { ok: true, text: `${D.FACTIONS[g].name} sends 400 gold.` };
    }
    diploRequestAid(g, target) {
      const p = this.player, r = this.rel(p, g);
      if (r.state !== 'alliance') return { ok: false, text: 'Only allies send military help.' };
      if (!this.atWar(p, target)) return { ok: false, text: 'You are not at war with them.' };
      if (this.rel(g, target).state !== 'war') {
        if (this.dealScore(g, p) < 45) return { ok: false, text: `${D.FACTIONS[g].name} will not go to war for you yet.` };
        this.setState(g, target, 'war');
      }
      this.factions[g].focus = { target, until: this.turn + 6 };
      this.remember(p, g, 'Asked for military aid', -5);
      return { ok: true, text: `${D.FACTIONS[g].name} marches against ${D.FACTIONS[target].name}!` };
    }
    // Once a turn: memory decays, treaties build trust, AIs make or break deals among themselves.
    diplomacyTurn() {
      if (!this.grand) return;
      for (const a of this.majors) for (const b of this.majors) {
        if (a >= b || !this.factions[a].alive || !this.factions[b].alive) continue;
        const r = this.rel(a, b);
        r.opinion *= 0.97;
        if (r.state !== 'war') r.opinion = Math.min(100, r.opinion + 1.5);
        if (this.factions[a].isPlayer || this.factions[b].isPlayer) {
          // The AI reacts to the player: a strong, distrusted player provokes war; a long war wears down.
          const ai = this.factions[a].isPlayer ? b : a, p = this.player;
          if (r.state !== 'war' && r.state !== 'alliance' && r.opinion < -40 && Math.random() < 0.25) {
            this.setState(ai, p, 'war');
            this.notify(`${D.FACTIONS[ai].name} has declared war on you!`, 'bad');
          }
          continue;
        }
        // AI to AI: peace after long stalemates, occasional new wars.
        if (r.state === 'war' && this.turn - r.since > 10 && Math.random() < 0.08) this.setState(a, b, 'peace');
        else if (r.state === 'peace' && this.turn - r.since > 8 && Math.random() < 0.06) this.setState(a, b, 'war');
      }
    }

    // ---------------------------------------------------------------- armies
    addArmy(faction, tid, commander, typeIds = []) {
      commander.skills = commander.skills || {}; commander.items = commander.items || {};
      const a = { id: this.nextArmyId++, faction, tid, commander, units: typeIds.map((typeId) => ({ typeId, hp: 1, rank: 0, xp: 0 })), moves: 0, generalHp: 1, doctrine: 'none' };
      a.moves = this.armyMoves(a);
      this.armies.push(a);
      return a;
    }
    removeArmy(a) {
      // Equipment returns to the treasury when a commander falls.
      if (this.factions[a.faction].isPlayer) for (const id of Object.values(a.commander.items || {})) if (id) this.factions[a.faction].items.push(id);
      this.armies = this.armies.filter((x) => x !== a);
    }
    canRaiseArmy(f, tid) {
      const t = this.terr(tid);
      return t.owner === f && !this.armyAt(tid) && this.armiesOf(f).length < this.maxArmies(f) && this.factions[f].gold >= 500;
    }
    raiseArmy(f, tid, commander) {
      if (!this.canRaiseArmy(f, tid)) return null;
      this.factions[f].gold -= 500;
      const a = this.addArmy(f, tid, commander, []);
      a.moves = 0;
      return a;
    }
    recruit(a, typeId) {
      const t = this.terr(a.tid);
      const f = a.faction;
      if (t.owner !== f) return 'You can only recruit in your own settlements.';
      if (a.units.length >= MAX_UNITS) return 'This army is full (12 units).';
      if (this.recruitSlots(t) <= 0) return 'No recruitment slots left here this turn.';
      const ut = D.UNITS[typeId];
      if (!ut || ut.faction !== f || ut.tier > t.level || !ut.recruitable) return 'Not available here.';
      if (!this.rareOk(f, ut, t)) return this.grand ? 'Research the required technology first.' : 'Rare unit: needs a City and more victories.';
      const cost = this.unitCost(f, typeId, t);
      if (this.factions[f].gold < cost) return 'Not enough gold.';
      this.factions[f].gold -= cost;
      t.recruited = (t.recruited || 0) + 1;
      a.units.push({ typeId, hp: 1, rank: t.buildings.barracks ? 1 : 0, xp: t.buildings.barracks ? 30 : 0 });
      if (this.factions[f].isPlayer) this.stats.recruited++;
      return null;
    }
    disband(a, i) { a.units.splice(i, 1); }
    upgradeSettlement(t) {
      if (t.level >= 3) return 'Already a city.';
      const cost = this.upgradeCost(t);
      if (this.factions[t.owner].gold < cost) return 'Not enough gold.';
      this.factions[t.owner].gold -= cost;
      t.level++;
      return null;
    }
    build(t, key) {
      if (t.buildings[key]) return 'Already built.';
      const cost = this.buildingCost(t, key);
      if (this.factions[t.owner].gold < cost) return 'Not enough gold.';
      this.factions[t.owner].gold -= cost;
      t.buildings[key] = true;
      return null;
    }
    buyUpgrade(f, upId) {
      const up = D.UPGRADES[f].find((u) => u.id === upId);
      const fs = this.factions[f];
      if (!up || fs.upgrades.includes(upId)) return 'Unavailable.';
      if (fs.wins < up.wins) return `Requires ${up.wins} victories.`;
      const cost = this.techCost(f, up);
      if (fs.gold < cost) return 'Not enough gold.';
      fs.gold -= cost;
      fs.upgrades.push(upId);
      return null;
    }

    // ---------------------------------------------------------------- technology
    techList(f) { return D.techFor(f); }
    canResearch(f, id) {
      const t = this.techList(f).find((x) => x.id === id), fs = this.factions[f];
      if (!t || fs.techs.includes(id)) return 'Already known.';
      if (fs.research) return 'Already researching.';
      if (t.req && !fs.techs.includes(t.req)) return 'Requires the previous technology.';
      if (fs.gold < t.cost) return 'Not enough gold.';
      return null;
    }
    research(f, id) {
      const err = this.canResearch(f, id);
      if (err) return err;
      const t = this.techList(f).find((x) => x.id === id);
      this.factions[f].gold -= t.cost;
      this.factions[f].research = { id, progress: 0 };
      return null;
    }
    advanceResearch(f) {
      const fs = this.factions[f];
      if (!fs.research) return;
      const t = this.techList(f).find((x) => x.id === fs.research.id);
      fs.research.progress += 1 + this.landmarkSum(f, 'research');
      if (fs.research.progress >= t.turns) {
        fs.techs.push(t.id);
        fs.research = null;
        if (fs.isPlayer) { this.addLog(`Research complete: ${t.name}.`); this.notify(`Research complete: ${t.name}`, 'good'); }
      }
    }

    // ---------------------------------------------------------------- equipment, skills, drill, doctrine
    skillPoints(a) { const spent = Object.values(a.commander.skills || {}).reduce((s, v) => s + v, 0); return Math.max(0, a.commander.level - 1 - spent); }
    learnSkill(a, id) {
      const sk = D.SKILLS.find((s) => s.id === id);
      const cur = a.commander.skills[id] || 0;
      if (!sk || cur >= sk.max) return 'Maxed out.';
      if (this.skillPoints(a) <= 0) return 'No skill points. Commanders gain one per level.';
      a.commander.skills[id] = cur + 1;
      return null;
    }
    equip(a, idx) {
      const fs = this.factions[a.faction];
      const id = fs.items[idx];
      if (!id) return 'No such item.';
      const it = D.ITEMS[id];
      const old = a.commander.items[it.slot];
      fs.items.splice(idx, 1);
      if (old) fs.items.push(old);
      a.commander.items[it.slot] = id;
      return null;
    }
    unequip(a, slot) {
      const id = a.commander.items[slot];
      if (!id) return;
      this.factions[a.faction].items.push(id);
      a.commander.items[slot] = null;
    }
    drillCost(f, typeId) { const lvl = this.factions[f].drill[typeId] || 0; return Math.round(D.UNITS[typeId].cost * 0.6 * (lvl + 1)); }
    drill(f, typeId) {
      const fs = this.factions[f];
      const lvl = fs.drill[typeId] || 0;
      if (lvl >= 2) return 'Fully drilled.';
      const cost = this.drillCost(f, typeId);
      if (fs.gold < cost) return 'Not enough gold.';
      fs.gold -= cost; fs.drill[typeId] = lvl + 1;
      return null;
    }
    setDoctrine(a, key) {
      if (!D.DOCTRINES[key]) return 'Unknown doctrine.';
      if (this.terr(a.tid).owner !== a.faction) return 'Change doctrine while in one of your settlements.';
      a.doctrine = key;
      return null;
    }

    // ---------------------------------------------------------------- moving
    canMoveTo(a, tid) {
      if (a.moves <= 0) return false;
      if (!this.adj(a.tid).includes(tid)) return false;
      const other = this.armyAt(tid);
      if (other && other.faction === a.faction) return false;
      // Treaties: you can't march into the lands of factions you're not at war with.
      if (other && !this.atWar(a.faction, other.faction)) return false;
      const owner = this.terr(tid).owner;
      if (owner !== a.faction && !this.atWar(a.faction, owner)) return false;
      return true;
    }
    moveKind(a, tid) {
      const t = this.terr(tid);
      const other = this.armyAt(tid);
      if (other && other.faction !== a.faction) return 'battle';
      if (t.owner !== a.faction) return this.garrisonUnits(t).length ? 'battle' : 'capture';
      return 'move';
    }
    // Ruins can be explored once by an army standing in that territory.
    canExplore(a) {
      const td = this.tdef(a.tid);
      return this.grand && td.ruins && !this.explored.includes(a.tid) && a.moves > 0;
    }
    explore(a) {
      if (!this.canExplore(a)) return null;
      this.explored.push(a.tid);
      a.moves = 0;
      const fs = this.factions[a.faction];
      const r = Math.random();
      let out;
      if (r < 0.35) { const g = 300 + Math.floor(Math.random() * 400); fs.gold += g; this.stats.goldEarned += g; out = { text: `The ruins hide a forgotten treasury: +${g} gold.`, gold: g }; }
      else if (r < 0.7) { const id = randomItem(1.2, 'uncommon'); fs.items.push(id); out = { text: `Deep in the ruins you find ${D.ITEMS[id].name} (${D.RARITY[D.ITEMS[id].rarity].name}).`, item: id }; }
      else if (r < 0.85 && a.units.length < MAX_UNITS) {
        const pool = Object.values(D.UNITS).filter((u) => u.faction === a.faction && u.recruitable && u.tier <= 2 && !u.rare);
        const ut = U.pick(pool);
        a.units.push({ typeId: ut.id, hp: 1, rank: 2, xp: 60 });
        out = { text: `Survivors of an old war swear fealty: a veteran unit of ${ut.name} joins the army.` };
      } else { a.commander.xp += 150; this.levelUp(a); out = { text: `Ancient inscriptions teach ${a.commander.name} the strategies of old kings (+150 XP).` }; }
      this.addLog(`${a.commander.name} explored ${this.tdef(a.tid).name}.`);
      return out;
    }
    levelUp(a) {
      const c = a.commander;
      let lv = 0;
      while (c.level < 10 && c.xp >= c.level * 100) { c.xp -= c.level * 100; c.level++; lv = c.level; if (this.factions[a.faction].isPlayer) this.addLog(`${c.name} reached level ${c.level}!`); }
      return lv;
    }

    // ---------------------------------------------------------------- battles
    battleMapType(tid, siege) {
      if (siege) return 'siege';
      const td = this.tdef(tid), t = this.terr(tid);
      const base = D.TERRAIN_INFO[td.terrain].battle;
      if (!this.grand) return base;
      if (td.shrine) return 'temple';
      if (t.level >= 3) return 'courtyard';
      if (td.terrain === 'forest' && (td.landmark || t.owner === 'sylvan')) return 'ancientforest';
      return base;
    }
    // Allied armies next to a battle send up to three units.
    alliedAid(playerFaction, tid) {
      if (!this.grand) return [];
      const out = [];
      for (const a of this.armies) {
        if (a.faction === playerFaction || this.rel(playerFaction, a.faction).state !== 'alliance') continue;
        if (a.tid !== tid && !this.adj(tid).includes(a.tid)) continue;
        a.units.forEach((u, i) => { if (out.length < 3 && u.hp > 0.5) out.push({ typeId: u.typeId, hpFrac: u.hp, rank: u.rank, xp: u.xp, faction: a.faction, ref: { army: a.id, idx: i }, ally: true }); });
      }
      return out;
    }
    battleSetup(attacker, tid) {
      const t = this.terr(tid);
      const defArmy = this.armyAt(tid);
      const defFaction = defArmy && defArmy.faction !== attacker.faction ? defArmy.faction : t.owner;
      const siege = this.isSiege(tid, defFaction);
      const defUnits = [];
      let defCommander, generalHp = 1;
      if (defArmy && defArmy.faction !== attacker.faction) {
        defArmy.units.forEach((u, i) => defUnits.push({ typeId: u.typeId, hpFrac: u.hp, rank: u.rank, xp: u.xp, ref: { army: defArmy.id, idx: i } }));
        defCommander = defArmy.commander; generalHp = defArmy.generalHp == null ? 1 : defArmy.generalHp;
        if (t.owner === defArmy.faction) {
          const extra = this.garrisonUnits(t).slice(0, Math.max(0, MAX_UNITS - defUnits.length)).slice(0, 3);
          extra.forEach((u) => defUnits.push({ typeId: u.typeId, hpFrac: u.hp, rank: 0, ref: { garrison: t.id } }));
        }
      } else {
        for (const u of this.garrisonUnits(t)) defUnits.push({ typeId: u.typeId, hpFrac: u.hp, rank: 0, ref: { garrison: t.id } });
        defCommander = { name: `Captain of ${this.tdef(tid).name}`, trait: null, level: 1 + Math.floor(this.turn / 8) };
      }
      const attUnits = attacker.units.map((u, i) => ({ typeId: u.typeId, hpFrac: u.hp, rank: u.rank, xp: u.xp, ref: { army: attacker.id, idx: i } }));
      // Allies help the player's side.
      const p = this.player;
      if (attacker.faction === p) attUnits.push(...this.alliedAid(p, tid));
      else if (defFaction === p) defUnits.push(...this.alliedAid(p, tid));
      const sideCfg = (f, army) => {
        const fs = this.factions[f];
        const isP = fs && fs.isPlayer;
        return {
          upgrades: fs ? fs.upgrades : [],
          army: army && isP ? this.armyMods(army) : (fs && this.grand ? RW.compileArmyMods({ techs: fs.techs, faction: f, landmarks: this.landmarksOf(f) }) : {}),
          ultimate: !!(fs && this.grand && fs.techs.includes('mag2')),
          drill: isP ? fs.drill : null,
        };
      };
      return {
        tid, siege, mapType: this.battleMapType(tid, siege), defFaction, defArmy: defArmy && defArmy.faction !== attacker.faction ? defArmy : null,
        att: Object.assign({ faction: attacker.faction, units: attUnits, commander: attacker.commander, generalHp: attacker.generalHp, generalType: this.generalType(attacker) }, sideCfg(attacker.faction, attacker)),
        def: Object.assign({ faction: defFaction, units: defUnits, commander: defCommander, generalHp, generalType: defArmy && defArmy.faction !== attacker.faction ? this.generalType(defArmy) : null }, sideCfg(defFaction, defArmy && defArmy.faction !== attacker.faction ? defArmy : null)),
        weather: D.weatherFor(this.battleMapType(tid, siege)),
      };
    }

    sidePower(side, siegeDef) {
      let p = 0;
      const gen = D.UNITS[side.generalType || D.FACTIONS[side.faction].general] || D.UNITS[D.FACTIONS[side.faction].general];
      p += gen.power * (side.generalHp == null ? 1 : side.generalHp) * (1 + (side.commander.level || 1) * 0.05);
      for (const u of side.units) p += D.UNITS[u.typeId].power * Math.max(0.05, u.hpFrac) * (1 + (u.rank || 0) * 0.08);
      p *= 1 + (side.upgrades || []).length * 0.04;
      if (siegeDef && !side.units.some((u) => D.UNITS[u.typeId].cat === 'siege')) p *= 1.3;
      return p;
    }
    odds(setup) {
      const A = this.sidePower(setup.att, false), Dp = this.sidePower(setup.def, setup.siege && !setup.att.units.some((u) => D.UNITS[u.typeId].cat === 'siege'));
      const r = A / (A + Dp);
      return 1 / (1 + Math.exp(-(r - 0.5) * 12));
    }
    autoResolve(setup) {
      const p = this.odds(setup);
      const attWins = Math.random() < p;
      const dom = Math.abs(p - 0.5) * 2;
      const loserLoss = 0.45 + 0.4 * dom + Math.random() * 0.15;
      const winnerLoss = 0.1 + 0.45 * (1 - dom) * Math.random() + 0.05;
      const units = [];
      const doSide = (side, sideIdx, loss) => {
        units.push({ side: sideIdx, isGeneral: true, alive: 1, count: 1, hpFrac: Math.max(0.1, (side.generalHp || 1) * (1 - loss * 0.5)), kills: 0 });
        for (const u of side.units) {
          const l = U.clamp(loss * (0.6 + Math.random() * 0.8), 0, 1);
          const hpFrac = u.hpFrac * (1 - l);
          units.push({ side: sideIdx, ref: u.ref, typeId: u.typeId, hpFrac: hpFrac < 0.08 ? 0 : hpFrac, alive: hpFrac < 0.08 ? 0 : 1, count: 1, kills: Math.round(Math.random() * 20 * (1 - l)) });
        }
      };
      doSide(setup.att, 0, attWins ? winnerLoss : loserLoss);
      doSide(setup.def, 1, attWins ? loserLoss : winnerLoss);
      const genDeadLoser = Math.random() < 0.2;
      return { winner: attWins ? 0 : 1, reason: 'auto', units, auto: true, generalDead: [!attWins && genDeadLoser, attWins && genDeadLoser], odds: p };
    }

    // Apply a battle result (side 0 = attacker, side 1 = defender in `setup` terms).
    // Returns { attWon, text, rewards } where rewards describe what the player gained.
    applyBattle(attacker, setup, res, flip = false) {
      const attSide = flip ? 1 : 0;
      const attWon = res.winner === attSide;
      const t = this.terr(setup.tid);
      const defArmy = setup.defArmy;
      const touched = new Set();
      const rankUps = [];
      let attKills = 0, defKills = 0;
      for (const ru of res.units) {
        const isAtt = ru.side === attSide;
        if (isAtt) attKills += ru.kills || 0; else defKills += ru.kills || 0;
        if (ru.equip) continue;
        if (ru.isGeneral) {
          const army = isAtt ? attacker : defArmy;
          if (army) army.generalHp = U.clamp(ru.alive ? ru.hpFrac : 0, 0, 1);
          continue;
        }
        if (!ru.ref) continue;
        if (ru.ref.army != null) {
          const army = this.armyById(ru.ref.army);
          const cu = army && army.units[ru.ref.idx];
          if (!cu) continue;
          cu.hp = ru.alive ? Math.max(0.05, ru.hpFrac) : 0;
          cu.xp = (cu.xp || 0) + (ru.kills || 0);
          const before = cu.rank || 0;
          while ((cu.rank || 0) < 3 && cu.xp >= ((cu.rank || 0) + 1) * 30) cu.rank = (cu.rank || 0) + 1;
          if (cu.rank > before && army.faction === this.player && cu.hp > 0) rankUps.push(D.UNITS[cu.typeId].name);
          touched.add(army);
        } else if (ru.ref.garrison != null) {
          const gt = this.terr(ru.ref.garrison);
          gt._gSum = (gt._gSum || 0) + (ru.alive ? ru.hpFrac : 0); gt._gN = (gt._gN || 0) + 1;
        }
      }
      if (t._gN) { t.garrisonHp = U.clamp(t._gSum / t._gN, 0.15, 1); delete t._gSum; delete t._gN; }
      for (const army of touched) army.units = army.units.filter((u) => u.hp > 0);
      const rewards = { gold: 0, items: [], cmdXp: 0, levelUp: 0, cmdName: null, extra: [] };
      const award = (army, kills, won) => {
        if (!army) return;
        const c = army.commander;
        const xp = 25 + Math.round(kills / 6) + (won ? 40 : 0);
        c.xp += xp;
        const lv = this.levelUp(army);
        if (army.faction === this.player) { rewards.cmdXp = xp; rewards.levelUp = lv; rewards.cmdName = c.name; }
      };
      award(attacker, attKills, attWon);
      award(defArmy, defKills, !attWon);
      const attF = this.factions[attacker.faction], defF = this.factions[setup.defFaction];
      if (attWon) { attF.wins++; if (defF) defF.losses++; } else { if (defF) defF.wins++; attF.losses++; }
      const playerAtt = attF.isPlayer, playerDef = defF && defF.isPlayer;
      if (playerAtt || playerDef) { this.stats.fought++; if ((playerAtt && attWon) || (playerDef && !attWon)) this.stats.won++; else this.stats.lost++; }
      // Battles sour relations between the two sides.
      if (this.grand && this.majors.includes(attacker.faction) && this.majors.includes(setup.defFaction)) this.remember(attacker.faction, setup.defFaction, 'Attacked us', -8);
      const genDead = res.generalDead || [false, false];
      const attGenDead = genDead[attSide], defGenDead = genDead[1 - attSide];
      let text;
      const tname = this.tdef(setup.tid).name;
      if (attWon) {
        if (defArmy) {
          if (defArmy.units.length === 0 || defGenDead || !this.retreat(defArmy)) {
            if (defArmy.bounty && playerAtt) { attF.gold += defArmy.bounty; rewards.gold += defArmy.bounty; rewards.extra.push(`Bounty collected: ${defArmy.bounty} gold`); }
            this.removeArmy(defArmy); text = `${defArmy.commander.name}'s army was destroyed at ${tname}.`;
          } else text = `${defArmy.commander.name}'s army retreated from ${tname}.`;
        }
        if (attacker.units.length || attacker.generalHp > 0) {
          const prevOwner = t.owner;
          attacker.tid = setup.tid;
          if (prevOwner !== attacker.faction) this.capture(attacker.faction, t);
        }
        if (attGenDead) attacker.generalHp = 0.3;
      } else {
        if (attacker.units.length === 0 || attGenDead || attacker.faction === 'rebels') { this.removeArmy(attacker); text = `${attacker.commander.name}'s army was destroyed attacking ${tname}.`; }
        else text = `${attacker.commander.name}'s attack on ${tname} was repulsed.`;
        if (defArmy && defGenDead) defArmy.generalHp = 0.3;
      }
      attacker.moves = 0;
      // Bloodfang: a victory restores 10% strength to the winning army.
      const winArmy = attWon ? attacker : defArmy;
      if (winArmy && winArmy.faction === 'blood' && this.armies.includes(winArmy)) for (const u of winArmy.units) u.hp = Math.min(1, u.hp + 0.1);
      const playerInvolved = playerAtt || playerDef;
      if (!text) text = attWon ? `${attacker.commander.name} won the battle at ${tname}.` : `${attacker.commander.name}'s attack on ${tname} was repulsed.`;
      if (playerInvolved || /destroyed/.test(text)) this.addLog(text);
      // Loot (attacker victories) and equipment finds for the player.
      if (attWon && attF) {
        const loot = Math.round((80 + Math.round(this.sidePower(setup.def) * 0.05)) * (this.grand ? this.techEffect(attacker.faction, 'loot', 1, true) : 1));
        attF.gold += loot;
        if (playerAtt) { rewards.gold += loot; this.stats.goldEarned += loot; }
      }
      const playerWon = (playerAtt && attWon) || (playerDef && !attWon);
      if (playerWon && Math.random() < 0.35) {
        const id = randomItem(0);
        this.factions[this.player].items.push(id);
        rewards.items.push(D.ITEMS[id]);
        this.notify(`Found ${D.ITEMS[id].name} (${D.RARITY[D.ITEMS[id].rarity].name})`, 'good');
      }
      if (rankUps.length) rewards.extra.push(`Promoted: ${rankUps.join(', ')}`);
      rewards.text = text;
      return { attWon, text, rewards: playerInvolved ? rewards : null };
    }

    retreat(army) {
      const opts = this.adj(army.tid).filter((n) => !this.armyAt(n) && this.terr(n).owner === army.faction);
      const opts2 = opts.length ? opts : this.adj(army.tid).filter((n) => !this.armyAt(n) && this.terr(n).owner !== 'rebels' && !this.garrisonUnits(this.terr(n)).length);
      if (!opts2.length) return false;
      army.tid = U.pick(opts2);
      army.moves = 0;
      return true;
    }

    capture(f, t) {
      const prev = t.owner;
      t.owner = f;
      t.garrisonHp = 0.5;
      this.stats.captured += this.factions[f] && this.factions[f].isPlayer ? 1 : 0;
      if (f === 'horde') this.factions.horde.gold += 300;
      if (prev && prev !== 'rebels' && this.factions[prev]) {
        const pf = this.factions[prev];
        if (pf.capital === t.id) {
          const rest = this.owned(prev).sort((a, b) => b.level - a.level);
          pf.capital = rest.length ? rest[0].id : -1;
        }
      }
      const fname = this.factions[f] ? D.FACTIONS[f].name : 'Rebels';
      this.addLog(`${fname} captured ${this.tdef(t.id).name}${prev !== 'rebels' && D.FACTIONS[prev] ? ' from ' + D.FACTIONS[prev].name : ''}.`);
      const lm = this.tdef(t.id).landmark;
      if (lm && this.factions[f] && this.factions[f].isPlayer) this.notify(`Landmark secured: ${D.LANDMARKS[lm].name} — ${D.LANDMARKS[lm].desc}`, 'good');
      this.checkElimination();
    }

    checkElimination() {
      for (const f of this.majors) {
        const fs = this.factions[f];
        if (!fs.alive) continue;
        if (!this.owned(f).length && !this.armiesOf(f).length) {
          fs.alive = false;
          this.addLog(`${D.FACTIONS[f].name} has been destroyed!`);
          if (this.hooks.onEliminated) this.hooks.onEliminated(f);
        } else if (!this.owned(f).length && !fs.isPlayer) {
          for (const a of this.armiesOf(f)) this.removeArmy(a);
          fs.alive = false;
          this.addLog(`${D.FACTIONS[f].name} has been destroyed!`);
          if (this.hooks.onEliminated) this.hooks.onEliminated(f);
        }
      }
    }

    // ---------------------------------------------------------------- objectives
    objectives() {
      const p = this.player;
      const rivals = this.majors.filter((f) => f !== p);
      const capsHeld = rivals.filter((f) => this.terr(this.factions[f].startCapital).owner === p).length;
      const shrines = this.territories.filter((t) => t.shrine);
      const shrinesHeld = shrines.filter((t) => t.owner === p).length;
      const owned = this.owned(p).length;
      const total = this.territories.length;
      if (this.mode === 'conquest') {
        const aliveRivals = rivals.filter((f) => this.factions[f].alive).length;
        return [
          { id: 'world', name: 'World Conquest', desc: `Control all ${total} territories.`, progress: `${owned}/${total}`, frac: owned / total, done: owned >= total },
          { id: 'domination', name: 'Last Realm Standing', desc: 'Destroy every rival faction.', progress: `${rivals.length - aliveRivals}/${rivals.length} destroyed`, frac: (rivals.length - aliveRivals) / rivals.length, done: aliveRivals === 0 },
        ];
      }
      const needT = this.grand ? 20 : 12, needC = this.grand ? 3 : 2;
      return [
        { id: 'conquest', name: 'Conquest', desc: `Control ${needT} of the ${total} territories.`, progress: `${owned}/${needT}`, frac: owned / needT, done: owned >= needT },
        { id: 'capitals', name: 'Decapitation', desc: this.grand ? 'Capture three rival starting capitals.' : "Capture both rival factions' starting capitals.", progress: `${capsHeld}/${needC}`, frac: capsHeld / needC, done: capsHeld >= needC },
        { id: 'shrines', name: 'Ancient Shrines', desc: 'Hold all three shrines at the end of 5 consecutive turns.', progress: `${shrinesHeld}/3 shrines · ${this.shrineHold}/5 turns`, frac: (shrinesHeld / 3) * 0.5 + (this.shrineHold / 5) * 0.5, done: this.shrineHold >= 5 },
        { id: 'treasury', name: 'Golden Age', desc: 'Amass a treasury of 12,000 gold.', progress: `${U.fmt(this.factions[p].gold)}/12,000`, frac: this.factions[p].gold / 12000, done: this.factions[p].gold >= 12000 },
      ];
    }
    checkEnd() {
      if (this.over) return this.over;
      const p = this.player;
      const done = this.objectives().find((o) => o.done);
      if (done) this.over = { result: 'victory', objective: done.name };
      else if (!this.owned(p).length) this.over = { result: 'defeat', reason: 'Your last territory has fallen.' };
      else if (this.majors.filter((f) => f !== p).every((f) => !this.factions[f].alive)) this.over = { result: 'victory', objective: 'Total Domination' };
      return this.over;
    }

    // ---------------------------------------------------------------- turn processing
    beginRound() {
      for (const f of this.majors) {
        const fs = this.factions[f];
        if (!fs.alive) continue;
        const net = this.net(f);
        fs.gold += net;
        if (fs.isPlayer && net > 0) this.stats.goldEarned += net;
        if (fs.gold < 0) {
          fs.gold = 0;
          const armies = this.armiesOf(f).filter((a) => a.units.length);
          if (armies.length) {
            const a = U.pick(armies);
            const u = U.pick(a.units);
            u.hp -= 0.35;
            if (u.hp <= 0.05) a.units.splice(a.units.indexOf(u), 1);
            if (fs.isPlayer) this.addLog(`Unpaid soldiers deserted ${a.commander.name}'s army!`);
          }
        }
        if (this.grand) this.advanceResearch(f);
        if (fs.focus && fs.focus.until < this.turn) fs.focus = null;
      }
      for (const a of this.armies) {
        a.moves = this.armyMoves(a);
        const t = this.terr(a.tid);
        let rate = t.owner === a.faction ? 0.2 : 0.06;
        if (t.owner === a.faction && t.level >= 2) rate += 0.05;
        if (a.commander.trait === 'quartermaster') rate += 0.1;
        if (a.faction === 'arcane' || a.faction === 'frost') rate += 0.1;
        if (this.factions[a.faction]) {
          rate += this.landmarkSum(a.faction, 'replenish') + this.techEffect(a.faction, 'replenish');
          if (this.factions[a.faction].isPlayer) rate += this.armyMods(a).replenish || 0;
        }
        for (const u of a.units) u.hp = Math.min(1, u.hp + rate);
        a.generalHp = Math.min(1, (a.generalHp == null ? 1 : a.generalHp) + 0.25);
      }
      for (const t of this.territories) { t.garrisonHp = Math.min(1, t.garrisonHp + 0.25); t.recruited = 0; }
      const shrines = this.territories.filter((t) => t.shrine);
      if (shrines.every((t) => t.owner === this.player)) this.shrineHold++; else this.shrineHold = 0;
      this.diplomacyTurn();
      this.recordHistory();
    }
    recordHistory() {
      const row = { turn: this.turn };
      for (const f of this.majors) row[f] = this.owned(f).length;
      row.gold = this.factions[this.player].gold;
      this.stats.history.push(row);
      if (this.stats.history.length > 200) this.stats.history.shift();
    }

    // Random campaign events for the player. Returns an event object or null.
    rollEvent() {
      if (this.turn < 2 || Math.random() > 0.4) return null;
      const p = this.player, fs = this.factions[p];
      const myArmies = this.armiesOf(p);
      const mine = this.owned(p);
      const ev = [];
      ev.push(() => {
        const g = 150 + mine.length * 30;
        return { title: 'Bountiful Harvest', text: `The granaries overflow across your lands. Your treasury gains ${g} gold.`, options: [{ label: `Collect ${g} gold`, apply: () => { fs.gold += g; } }] };
      });
      if (myArmies.some((a) => a.units.length)) ev.push(() => {
        const a = U.pick(myArmies.filter((x) => x.units.length));
        return { title: 'Camp Fever', text: `Sickness spreads through ${a.commander.name}'s army.`, options: [
          { label: 'Pay healers (300 gold)', disabled: fs.gold < 300, apply: () => { fs.gold -= 300; } },
          { label: 'Endure it (units lose 20% strength)', apply: () => { for (const u of a.units) u.hp = Math.max(0.1, u.hp - 0.2); } },
        ] };
      });
      const homeArmy = myArmies.find((a) => this.terr(a.tid).owner === p && a.units.length < MAX_UNITS);
      if (homeArmy) ev.push(() => {
        const pool = Object.values(D.UNITS).filter((u) => u.faction === p && u.recruitable && u.tier <= 2 && !u.rare);
        const ut = U.pick(pool);
        const cost = Math.round(ut.cost * 0.5);
        return { title: 'Mercenary Company', text: `A veteran company of ${ut.name} offers its swords to ${homeArmy.commander.name} for ${cost} gold. They arrive as veterans.`, options: [
          { label: `Hire them (${cost} gold)`, disabled: fs.gold < cost, apply: () => { fs.gold -= cost; homeArmy.units.push({ typeId: ut.id, hp: 1, rank: 2, xp: 60 }); } },
          { label: 'Send them away', apply: () => {} },
        ] };
      });
      ev.push(() => ({ title: 'Ancient Relic', text: 'Scouts unearth a relic of the old kings. Your scholars study it and your armies take heart.', options: [
        { label: 'Study it (+1 victory toward unlocking upgrades, +150 gold)', apply: () => { fs.wins++; fs.gold += 150; } },
      ] }));
      if (myArmies.length) ev.push(() => {
        const a = U.pick(myArmies);
        return { title: 'Wandering Sage', text: `A sage offers to tutor ${a.commander.name} in the arts of war.`, options: [
          { label: 'Accept (+100 commander experience)', apply: () => { a.commander.xp += 100; this.levelUp(a); } },
        ] };
      });
      const unguarded = mine.filter((t) => t.id !== fs.capital && !this.armyAt(t.id));
      if (unguarded.length) ev.push(() => {
        const t = U.pick(unguarded);
        return { title: 'Peasant Revolt', text: `Unrest boils over in ${this.tdef(t.id).name}! Rebels gather to seize the town.`, options: [
          { label: 'Appease them (400 gold)', disabled: fs.gold < 400, apply: () => { fs.gold -= 400; } },
          { label: 'Crush them by force', apply: () => ({ revolt: t.id }) },
        ] };
      });
      if (mine.some((t) => t.buildings.market)) ev.push(() => {
        const g = 120 * mine.filter((t) => t.buildings.market).length + 100;
        return { title: 'Trade Caravan', text: `Merchants flock to your markets. +${g} gold.`, options: [{ label: 'Excellent', apply: () => { fs.gold += g; } }] };
      });
      if (this.grand) this.grandEvents(ev, fs, myArmies, mine, homeArmy);
      const e = U.pick(ev)();
      this.stats.events++;
      return e;
    }

    // Extra events for the Greater Realm. Negative ones always have an affordable way out.
    grandEvents(ev, fs, myArmies, mine, homeArmy) {
      const p = this.player;
      if (homeArmy) ev.push(() => {
        const pool = Object.values(D.UNITS).filter((u) => u.faction === p && u.recruitable && u.tier >= 2);
        const ut = U.pick(pool);
        const cost = Math.round(ut.cost * 0.8);
        return { title: 'The Wandering Merchant', text: `A merchant prince offers a company of ${ut.name}${ut.rare ? ' (a rare unit you could not normally recruit yet)' : ''} for ${cost} gold, delivered to ${homeArmy.commander.name}.`, options: [
          { label: `Buy them (${cost} gold)`, disabled: fs.gold < cost, apply: () => { fs.gold -= cost; homeArmy.units.push({ typeId: ut.id, hp: 1, rank: 1, xp: 30 }); } },
          { label: 'No thank you', apply: () => {} },
        ] };
      });
      ev.push(() => {
        const g = 400 + Math.floor(Math.random() * 300);
        return { title: 'Ancient Treasure', text: 'Farmers ploughing a field strike a sealed vault of the old empire.', options: [
          { label: `Melt it down (+${g} gold)`, apply: () => { fs.gold += g; } },
          { label: 'Keep the finest piece (an item)', apply: () => { const id = randomItem(1, 'uncommon'); fs.items.push(id); this.notify(`Gained ${D.ITEMS[id].name}`, 'good'); } },
        ] };
      });
      const towns = mine.filter((t) => t.level < 3);
      if (towns.length) ev.push(() => {
        const t = U.pick(towns);
        return { title: 'Economic Boom', text: `Trade booms in ${this.tdef(t.id).name}. The guilds offer to fund growth.`, options: [
          { label: t.buildings.market ? 'Expand the town (+1 settlement level)' : 'Build a free Market', apply: () => { if (t.buildings.market) t.level++; else t.buildings.market = true; } },
          { label: 'Take a tithe (+350 gold)', apply: () => { fs.gold += 350; } },
        ] };
      });
      const suitors = this.majors.filter((f) => f !== p && this.factions[f].alive && this.rel(p, f).state !== 'alliance');
      if (suitors.length) ev.push(() => {
        const f = U.pick(suitors), r = this.rel(p, f);
        const offer = r.state === 'war' ? 'peace' : r.state === 'peace' ? 'nap' : 'alliance';
        const name = D.FACTIONS[f].name;
        return { title: `Envoys from ${D.FACTIONS[f].short}`, text: `${name} sends envoys proposing ${offer === 'peace' ? 'an end to the war' : offer === 'nap' ? 'a non-aggression pact' : 'an alliance'}.`, options: [
          { label: 'Accept', apply: () => { this.setState(p, f, offer); this.remember(p, f, 'Accepted our envoys', 15); this.notify(`${name}: ${STATES[offer]}`, 'good'); } },
          { label: 'Refuse', apply: () => { this.remember(p, f, 'Refused our envoys', -10); } },
        ] };
      });
      const lairs = this.territories.filter((t) => t.owner === 'rebels' && !this.armyAt(t.id) && this.adj(t.id).some((n) => this.terr(n).owner === p));
      if (lairs.length) ev.push(() => {
        const t = U.pick(lairs);
        const monster = U.pick(['horde_trolls', 'frost_giant', 'blood_horror', 'sylvan_treants', 'arcane_golems']);
        return { title: 'A Monster Stirs', text: `A ${D.UNITS[monster].name} has made its lair in ${this.tdef(t.id).name}, terrorising the roads. The guilds offer a bounty.`, options: [
          { label: 'Post a bounty (600 gold reward when slain)', apply: () => { const a = this.addArmy('rebels', t.id, { name: `The ${D.UNITS[monster].name} of ${this.tdef(t.id).name}`, trait: null, level: 1 + Math.floor(this.turn / 8), xp: 0 }, [monster, 'rebel_militia']); a.bounty = 600; a.moves = 0; } },
          { label: 'Leave it be', apply: () => {} },
        ] };
      });
      if (myArmies.length) ev.push(() => {
        const id = randomItem(2, 'epic');
        return { title: 'A Legendary Weapon', text: `Pilgrims speak of ${D.ITEMS[id].name}, resting in a hermit's shrine. The hermit asks a donation for its keeping.`, options: [
          { label: 'Donate 600 gold and claim it', disabled: fs.gold < 600, apply: () => { fs.gold -= 600; fs.items.push(id); this.notify(`Gained ${D.ITEMS[id].name}!`, 'good'); } },
          { label: 'Let it rest', apply: () => {} },
        ] };
      });
    }

    spawnRebels(tid) {
      const budget = 1200 + this.turn * 80;
      const ids = D.genArmy('rebels', budget, 3, 6);
      return this.addArmy('rebels', tid, { name: U.pick(D.COMMANDER_NAMES.rebels), trait: 'inspiring', level: 1 + Math.floor(this.turn / 6), xp: 0 }, ids);
    }
  }

  Campaign.STATES = STATES;
  Campaign.SLOTS = SLOTS;
  RW.Campaign = Campaign;
  RW.CAMPAIGN_DIFF = DIFF;
  RW.randomCommander = randomCommander;
  RW.randomItem = randomItem;
  RW.MAX_UNITS = MAX_UNITS;
})();
