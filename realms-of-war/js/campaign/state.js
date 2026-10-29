// Campaign model: factions, territories, armies, economy, battles (auto-resolve), events, objectives, saving.
// No DOM here - the campaign scene drives it and supplies interactive hooks (battles, event choices).
(function () {
  const RW = window.RW;
  const U = RW.util;
  const D = RW.data;
  const SAVE_KEY = 'realmsOfWar.campaign.v1';
  const MAX_UNITS = 12;

  const DIFF = {
    easy: { aiIncome: 0.85, playerIncome: 1.15, aggression: 0.6, need: 1.6 },
    normal: { aiIncome: 1.0, playerIncome: 1.0, aggression: 1.0, need: 1.25 },
    hard: { aiIncome: 1.1, playerIncome: 1.0, aggression: 1.35, need: 1.12 },
  };

  function randomCommander(faction, exclude = []) {
    const names = D.COMMANDER_NAMES[faction].filter((n) => !exclude.includes(n));
    const name = U.pick(names.length ? names : D.COMMANDER_NAMES[faction]);
    const trait = U.pick(D.FACTION_TRAITS[faction]);
    return { name, trait, level: 1, xp: 0 };
  }

  class Campaign {
    constructor(data) {
      Object.assign(this, data);
      this.map = RW.campaignMap();
      this.hooks = {};
    }

    // ---------------------------------------------------------------- creation
    static create(playerFaction, difficulty, commander) {
      const T = D.TERRITORIES;
      // Starting capitals: each faction picks one of its two options, never adjacent to another capital.
      const map = RW.campaignMap();
      let caps;
      for (let tries = 0; tries < 50; tries++) {
        caps = {};
        for (const f of D.PLAYABLE) caps[f] = U.pick(D.FACTIONS[f].starts);
        const ids = Object.values(caps);
        if (!ids.some((a) => ids.some((b) => a !== b && map.adj[a].includes(b)))) break;
      }
      const territories = T.map((t) => ({
        id: t.id, owner: 'rebels', level: Math.random() < 0.35 ? 2 : 1,
        buildings: { market: false, barracks: false, walls: false }, garrisonHp: 1, recruited: 0, shrine: !!t.shrine,
      }));
      // Shrines and a couple of strongholds are walled rebel towns.
      for (const tr of territories) if (tr.shrine) { tr.level = 2; tr.buildings.walls = Math.random() < 0.5; }
      const factions = {};
      for (const f of ['valor', 'horde', 'arcane', 'rebels']) {
        factions[f] = { id: f, gold: f === 'rebels' ? 0 : 1500, alive: true, capital: caps[f] == null ? -1 : caps[f], startCapital: caps[f] == null ? -1 : caps[f], upgrades: [], wins: 0, losses: 0, isPlayer: f === playerFaction };
      }
      const armies = [];
      const c = new Campaign({ version: 1, turn: 1, player: playerFaction, difficulty, territories, factions, armies, log: [], shrineHold: 0, stats: { won: 0, lost: 0, captured: 0, events: 0 }, over: null, nextArmyId: 1 });
      for (const f of D.PLAYABLE) {
        const t = territories[caps[f]];
        t.owner = f; t.level = 2; t.buildings.walls = true;
        const cmd = f === playerFaction && commander ? commander : randomCommander(f);
        c.addArmy(f, caps[f], cmd, D.FACTIONS[f].startArmy.slice());
      }
      // A second player army-free start: give each AI a neighbouring village to make them grow faster on Hard.
      if (difficulty === 'hard') {
        for (const f of D.PLAYABLE) {
          if (f === playerFaction) continue;
          const nb = map.adj[caps[f]].find((n) => territories[n].owner === 'rebels' && !Object.values(caps).includes(n));
          if (nb != null) territories[nb].owner = f;
        }
      }
      c.addLog(`Turn 1. ${D.FACTIONS[playerFaction].name} marches to war from ${T[caps[playerFaction]].name}.`);
      return c;
    }

    static load() {
      try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (!data || data.version !== 1) return null;
        return new Campaign(data);
      } catch (e) { return null; }
    }
    static hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }
    static deleteSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } }
    save() {
      const data = {};
      for (const k of ['version', 'turn', 'player', 'difficulty', 'territories', 'factions', 'armies', 'log', 'shrineHold', 'stats', 'over', 'nextArmyId']) data[k] = this[k];
      try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); return true; } catch (e) { return false; }
    }

    // ---------------------------------------------------------------- queries
    get diff() { return DIFF[this.difficulty] || DIFF.normal; }
    terr(id) { return this.territories[id]; }
    tdef(id) { return D.TERRITORIES[id]; }
    adj(id) { return this.map.adj[id]; }
    armyAt(tid) { return this.armies.find((a) => a.tid === tid); }
    armyById(id) { return this.armies.find((a) => a.id === id); }
    armiesOf(f) { return this.armies.filter((a) => a.faction === f); }
    owned(f) { return this.territories.filter((t) => t.owner === f); }
    addLog(text) { this.log.push({ turn: this.turn, text }); if (this.log.length > 60) this.log.shift(); }

    territoryIncome(t) {
      const ti = D.TERRAIN_INFO[this.tdef(t.id).terrain];
      let inc = ti.income + D.SETTLEMENT.levels[t.level].income + (t.buildings.market ? 70 : 0) + (t.shrine ? 40 : 0);
      if (this.factions[t.owner] && this.factions[t.owner].capital === t.id) inc += 120;
      if (t.owner === 'valor') inc *= 1.15;
      return Math.round(inc);
    }
    income(f) {
      let total = 0;
      for (const t of this.owned(f)) total += this.territoryIncome(t);
      const mul = this.factions[f].isPlayer ? this.diff.playerIncome : this.diff.aiIncome;
      return Math.round(total * mul);
    }
    armyUpkeep(a) {
      let up = 0;
      for (const u of a.units) up += D.UNITS[u.typeId].upkeep;
      if (a.commander.trait === 'quartermaster') up *= 0.75;
      return Math.round(up);
    }
    upkeep(f) { return this.armiesOf(f).reduce((s, a) => s + this.armyUpkeep(a), 0); }
    net(f) { return this.income(f) - this.upkeep(f); }
    maxArmies(f) { return Math.min(5, 1 + Math.floor(this.owned(f).length / 3)); }
    unitCost(f, typeId, t) {
      let c = D.UNITS[typeId].cost;
      if (f === 'horde') c *= 0.8;
      if (t && t.buildings.barracks) c *= 0.85;
      return Math.round(c);
    }
    recruitSlots(t) { return t.level + 1 - (t.recruited || 0); }
    recruitable(f, t) {
      return Object.values(D.UNITS).filter((u) => u.faction === f && u.recruitable && u.tier <= t.level);
    }
    upgradeCost(t) {
      let c = D.SETTLEMENT.upgradeCost[t.level + 1] || 0;
      if (t.owner === 'valor') c *= 0.8;
      return Math.round(c);
    }
    buildingCost(t, key) {
      let c = D.SETTLEMENT.buildings[key].cost;
      if (t.owner === 'valor') c *= 0.8;
      return Math.round(c);
    }
    techCost(f, up) { return Math.round(up.cost * (f === 'arcane' ? 0.65 : 1)); }
    armyMoves(a) { return a.commander.trait === 'tactician' ? 2 : 1; }

    unitPower(u) { return D.UNITS[u.typeId].power * Math.max(0.05, u.hp) * (1 + (u.rank || 0) * 0.08); }
    armyPower(a) {
      if (!a) return 0;
      const gen = D.UNITS[D.FACTIONS[a.faction].general];
      let p = gen.power * (a.generalHp == null ? 1 : a.generalHp) * (1 + a.commander.level * 0.05);
      for (const u of a.units) p += this.unitPower(u);
      const ups = this.factions[a.faction].upgrades.length;
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
      return p * (t.buildings.walls ? 1.3 : 1);
    }
    // Total defensive power if `tid` is attacked.
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

    // ---------------------------------------------------------------- armies
    addArmy(faction, tid, commander, typeIds = []) {
      const a = { id: this.nextArmyId++, faction, tid, commander, units: typeIds.map((typeId) => ({ typeId, hp: 1, rank: 0, xp: 0 })), moves: 0, generalHp: 1 };
      a.moves = this.armyMoves(a);
      this.armies.push(a);
      return a;
    }
    removeArmy(a) { this.armies = this.armies.filter((x) => x !== a); }
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
      if (!ut || ut.faction !== f || ut.tier > t.level) return 'Not available here.';
      const cost = this.unitCost(f, typeId, t);
      if (this.factions[f].gold < cost) return 'Not enough gold.';
      this.factions[f].gold -= cost;
      t.recruited = (t.recruited || 0) + 1;
      a.units.push({ typeId, hp: 1, rank: t.buildings.barracks ? 1 : 0, xp: 0 });
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

    // Where can this army go?
    canMoveTo(a, tid) {
      if (a.moves <= 0) return false;
      if (!this.adj(a.tid).includes(tid)) return false;
      const other = this.armyAt(tid);
      if (other && other.faction === a.faction) return false;
      return true;
    }
    // Is moving into tid a hostile action (battle)?
    moveKind(a, tid) {
      const t = this.terr(tid);
      const other = this.armyAt(tid);
      if (other && other.faction !== a.faction) return 'battle';
      if (t.owner !== a.faction) return this.garrisonUnits(t).length ? 'battle' : 'capture';
      return 'move';
    }

    // ---------------------------------------------------------------- battles
    // Build both sides for a battle at tid. Returns {att, def, siege, mapType}.
    battleSetup(attacker, tid) {
      const t = this.terr(tid);
      const defArmy = this.armyAt(tid);
      const defFaction = defArmy && defArmy.faction !== attacker.faction ? defArmy.faction : t.owner;
      const siege = this.isSiege(tid, defFaction);
      const defUnits = [];
      let defCommander, generalHp = 1;
      if (defArmy && defArmy.faction !== attacker.faction) {
        defArmy.units.forEach((u, i) => defUnits.push({ typeId: u.typeId, hpFrac: u.hp, rank: u.rank, ref: { army: defArmy.id, idx: i } }));
        defCommander = defArmy.commander; generalHp = defArmy.generalHp == null ? 1 : defArmy.generalHp;
        if (t.owner === defArmy.faction) {
          const extra = this.garrisonUnits(t).slice(0, Math.max(0, MAX_UNITS - defUnits.length)).slice(0, 3);
          extra.forEach((u) => defUnits.push({ typeId: u.typeId, hpFrac: u.hp, rank: 0, ref: { garrison: t.id } }));
        }
      } else {
        for (const u of this.garrisonUnits(t)) defUnits.push({ typeId: u.typeId, hpFrac: u.hp, rank: 0, ref: { garrison: t.id } });
        defCommander = { name: `Captain of ${this.tdef(tid).name}`, trait: null, level: 1 + Math.floor(this.turn / 8) };
      }
      const attUnits = attacker.units.map((u, i) => ({ typeId: u.typeId, hpFrac: u.hp, rank: u.rank, ref: { army: attacker.id, idx: i } }));
      const mapType = siege ? 'siege' : D.TERRAIN_INFO[this.tdef(tid).terrain].battle;
      return {
        tid, siege, mapType, defFaction, defArmy: defArmy && defArmy.faction !== attacker.faction ? defArmy : null,
        att: { faction: attacker.faction, units: attUnits, commander: attacker.commander, upgrades: this.factions[attacker.faction].upgrades, generalHp: attacker.generalHp },
        def: { faction: defFaction, units: defUnits, commander: defCommander, upgrades: this.factions[defFaction] ? this.factions[defFaction].upgrades : [], generalHp },
      };
    }

    sidePower(side, siegeDef) {
      let p = 0;
      const gen = D.UNITS[D.FACTIONS[side.faction].general];
      p += gen.power * (side.generalHp == null ? 1 : side.generalHp) * (1 + (side.commander.level || 1) * 0.05);
      for (const u of side.units) p += D.UNITS[u.typeId].power * Math.max(0.05, u.hpFrac) * (1 + (u.rank || 0) * 0.08);
      p *= 1 + (side.upgrades || []).length * 0.04;
      if (siegeDef && !side.units.some((u) => D.UNITS[u.typeId].cat === 'siege')) p *= 1.3;
      return p;
    }
    // Probability (0..1) that the attacker wins an auto-resolve.
    odds(setup) {
      const A = this.sidePower(setup.att, false), Dp = this.sidePower(setup.def, setup.siege && !setup.att.units.some((u) => D.UNITS[u.typeId].cat === 'siege'));
      const r = A / (A + Dp);
      return 1 / (1 + Math.exp(-(r - 0.5) * 12));
    }
    // Simulate a result in the same shape the real-time battle produces.
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
    // `flip` is true when the real-time battle had the player as side 0 but the player was the defender.
    applyBattle(attacker, setup, res, flip = false) {
      const attSide = flip ? 1 : 0;
      const attWon = res.winner === attSide;
      const t = this.terr(setup.tid);
      const defArmy = setup.defArmy;
      const touched = new Set();
      let attKills = 0, defKills = 0;
      for (const ru of res.units) {
        const isAtt = ru.side === attSide;
        if (isAtt) attKills += ru.kills || 0; else defKills += ru.kills || 0;
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
          while ((cu.rank || 0) < 3 && cu.xp >= ((cu.rank || 0) + 1) * 30) cu.rank = (cu.rank || 0) + 1;
          touched.add(army);
        } else if (ru.ref.garrison != null) {
          const gt = this.terr(ru.ref.garrison);
          gt._gSum = (gt._gSum || 0) + (ru.alive ? ru.hpFrac : 0); gt._gN = (gt._gN || 0) + 1;
        }
      }
      if (t._gN) { t.garrisonHp = U.clamp(t._gSum / t._gN, 0.15, 1); delete t._gSum; delete t._gN; }
      for (const army of touched) army.units = army.units.filter((u) => u.hp > 0);
      // Commander experience
      const award = (army, kills, won) => {
        if (!army) return;
        const c = army.commander;
        c.xp += 25 + Math.round(kills / 6) + (won ? 40 : 0);
        while (c.level < 10 && c.xp >= c.level * 100) { c.xp -= c.level * 100; c.level++; if (this.factions[army.faction].isPlayer) this.addLog(`${c.name} reached level ${c.level}!`); }
      };
      award(attacker, attKills, attWon);
      award(defArmy, defKills, !attWon);
      const attF = this.factions[attacker.faction], defF = this.factions[setup.defFaction];
      if (attWon) { attF.wins++; if (defF) defF.losses++; } else { if (defF) defF.wins++; attF.losses++; }
      const genDead = res.generalDead || [false, false];
      const attGenDead = genDead[attSide], defGenDead = genDead[1 - attSide];
      let text;
      const tname = this.tdef(setup.tid).name;
      if (attWon) {
        // Defender army retreats or is destroyed.
        if (defArmy) {
          if (defArmy.units.length === 0 || defGenDead || !this.retreat(defArmy)) { this.removeArmy(defArmy); text = `${defArmy.commander.name}'s army was destroyed at ${tname}.`; }
          else text = `${defArmy.commander.name}'s army retreated from ${tname}.`;
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
      const playerInvolved = this.factions[attacker.faction].isPlayer || (this.factions[setup.defFaction] && this.factions[setup.defFaction].isPlayer);
      if (!text) text = attWon ? `${attacker.commander.name} won the battle at ${tname}.` : `${attacker.commander.name}'s attack on ${tname} was repulsed.`;
      if (playerInvolved || /destroyed/.test(text)) this.addLog(text);
      // Loot
      if (attWon && attF) attF.gold += 80 + Math.round(this.sidePower(setup.def) * 0.05);
      return { attWon, text };
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
      this.stats.captured += this.factions[f].isPlayer ? 1 : 0;
      if (f === 'horde') this.factions.horde.gold += 300;
      if (prev && prev !== 'rebels') {
        const pf = this.factions[prev];
        if (pf.capital === t.id) {
          // Move the capital to the best remaining settlement.
          const rest = this.owned(prev).sort((a, b) => b.level - a.level);
          pf.capital = rest.length ? rest[0].id : -1;
        }
      }
      this.addLog(`${D.FACTIONS[f].name} captured ${this.tdef(t.id).name}${prev !== 'rebels' ? ' from ' + D.FACTIONS[prev].name : ''}.`);
      this.checkElimination();
    }

    checkElimination() {
      for (const f of D.PLAYABLE) {
        const fs = this.factions[f];
        if (!fs.alive) continue;
        if (!this.owned(f).length && !this.armiesOf(f).length) {
          fs.alive = false;
          this.addLog(`${D.FACTIONS[f].name} has been destroyed!`);
          if (this.hooks.onEliminated) this.hooks.onEliminated(f);
        } else if (!this.owned(f).length && !fs.isPlayer) {
          // Homeless AI armies disband.
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
      const rivals = D.PLAYABLE.filter((f) => f !== p);
      const capsHeld = rivals.filter((f) => this.terr(this.factions[f].startCapital).owner === p).length;
      const shrines = this.territories.filter((t) => t.shrine);
      const shrinesHeld = shrines.filter((t) => t.owner === p).length;
      const owned = this.owned(p).length;
      return [
        { id: 'conquest', name: 'Conquest', desc: 'Control 12 of the 16 territories.', progress: `${owned}/12`, frac: owned / 12, done: owned >= 12 },
        { id: 'capitals', name: 'Decapitation', desc: "Capture both rival factions' starting capitals.", progress: `${capsHeld}/2`, frac: capsHeld / 2, done: capsHeld >= 2 },
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
      else if (D.PLAYABLE.filter((f) => f !== p).every((f) => !this.factions[f].alive)) this.over = { result: 'victory', objective: 'Total Domination' };
      return this.over;
    }

    // ---------------------------------------------------------------- turn processing
    // Start-of-round economy for every faction.
    beginRound() {
      for (const f of D.PLAYABLE) {
        const fs = this.factions[f];
        if (!fs.alive) continue;
        const net = this.net(f);
        fs.gold += net;
        if (fs.gold < 0) {
          // Unpaid troops desert.
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
      }
      for (const a of this.armies) {
        a.moves = this.armyMoves(a);
        const t = this.terr(a.tid);
        let rate = t.owner === a.faction ? 0.2 : 0.06;
        if (t.owner === a.faction && t.level >= 2) rate += 0.05;
        if (a.commander.trait === 'quartermaster') rate += 0.1;
        if (a.faction === 'arcane') rate += 0.1;
        for (const u of a.units) u.hp = Math.min(1, u.hp + rate);
        a.generalHp = Math.min(1, (a.generalHp == null ? 1 : a.generalHp) + 0.25);
      }
      for (const t of this.territories) { t.garrisonHp = Math.min(1, t.garrisonHp + 0.25); t.recruited = 0; }
      // Shrine objective
      const shrines = this.territories.filter((t) => t.shrine);
      if (shrines.every((t) => t.owner === this.player)) this.shrineHold++; else this.shrineHold = 0;
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
        const pool = Object.values(D.UNITS).filter((u) => u.faction === p && u.recruitable && u.tier <= 2);
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
          { label: 'Accept (+100 commander experience)', apply: () => { a.commander.xp += 100; while (a.commander.level < 10 && a.commander.xp >= a.commander.level * 100) { a.commander.xp -= a.commander.level * 100; a.commander.level++; } } },
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
      const e = U.pick(ev)();
      this.stats.events++;
      return e;
    }

    // Spawn a rebel army at a territory (revolt event). Returns the army.
    spawnRebels(tid) {
      const budget = 1200 + this.turn * 80;
      const ids = D.genArmy('rebels', budget, 3, 6);
      const a = this.addArmy('rebels', tid, { name: U.pick(D.COMMANDER_NAMES.rebels), trait: 'inspiring', level: 1 + Math.floor(this.turn / 6), xp: 0 }, ids);
      return a;
    }
  }

  RW.Campaign = Campaign;
  RW.CAMPAIGN_DIFF = DIFF;
  RW.randomCommander = randomCommander;
  RW.MAX_UNITS = MAX_UNITS;
})();
