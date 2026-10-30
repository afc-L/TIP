// Campaign AI: builds, recruits, raises armies, defends its capital, expands and hunts weak armies.
(function () {
  const RW = window.RW;
  const U = RW.util;
  const D = RW.data;

  // BFS distances over the territory graph.
  function distances(c, from, passable) {
    const dist = new Map([[from, 0]]);
    const q = [from];
    while (q.length) {
      const cur = q.shift();
      for (const n of c.adj(cur)) {
        if (dist.has(n)) continue;
        dist.set(n, dist.get(cur) + 1);
        if (!passable || passable(n)) q.push(n);
      }
    }
    return dist;
  }
  // First step on a shortest path from a to b.
  function firstStep(c, a, b, passable) {
    const prev = new Map([[a, null]]);
    const q = [a];
    while (q.length) {
      const cur = q.shift();
      if (cur === b) break;
      for (const n of c.adj(cur)) {
        if (prev.has(n)) continue;
        if (n !== b && passable && !passable(n)) continue;
        prev.set(n, cur); q.push(n);
      }
    }
    if (!prev.has(b)) return null;
    let s = b;
    while (prev.get(s) !== a && prev.get(s) != null) s = prev.get(s);
    return s;
  }

  async function runFaction(c, f, hooks) {
    const fs = c.factions[f];
    if (!fs.alive) return;
    const diff = c.difficulty;
    const P = c.diff;
    const smart = diff !== 'easy';
    const player = c.player;
    const reserve = diff === 'hard' ? 250 : 400;

    // ---- Construction
    const mine = c.owned(f);
    const cap = c.terr(fs.capital);
    const threatened = (t) => c.adj(t.id).some((n) => { const a = c.armyAt(n); return a && a.faction !== f && a.faction !== 'rebels' && c.atWar(f, a.faction); });
    if (cap && cap.owner === f) {
      if (smart && threatened(cap) && !cap.buildings.walls && fs.gold > c.buildingCost(cap, 'walls') + 200) c.build(cap, 'walls');
      if (cap.level < 3 && fs.gold > c.upgradeCost(cap) + 1200) c.upgradeSettlement(cap);
    }
    for (const t of mine.slice().sort((a, b) => c.territoryIncome(b) - c.territoryIncome(a))) {
      if (fs.gold > 2200 && !t.buildings.market) c.build(t, 'market');
      if (fs.gold > 2600 && t.level < 2) c.upgradeSettlement(t);
    }
    // ---- Unit upgrades
    if (smart) for (const up of D.UPGRADES[f] || []) if (fs.gold > c.techCost(f, up) + 1500 && fs.wins >= up.wins) c.buyUpgrade(f, up.id);

    // ---- New armies
    const myArmies = () => c.armiesOf(f);
    const n = myArmies().length;
    const allFull = myArmies().every((a) => a.units.length >= 8);
    if (n < c.maxArmies(f) && ((n === 0 && fs.gold >= 900) || (allFull && fs.gold > 1500 + reserve))) {
      const spots = mine.filter((t) => !c.armyAt(t.id));
      spots.sort((a, b) => (threatened(b) ? 2 : 0) + (b.id === fs.capital ? 1 : 0) - ((threatened(a) ? 2 : 0) + (a.id === fs.capital ? 1 : 0)) || b.level - a.level);
      if (spots.length) {
        const cmd = RW.randomCommander(f, myArmies().map((a) => a.commander.name));
        c.raiseArmy(f, spots[0].id, cmd);
      }
    }

    // ---- Recruitment (armies in own settlements)
    for (const a of myArmies()) {
      const t = c.terr(a.tid);
      if (t.owner !== f) continue;
      const slots = c.recruitSlots(t);
      if (slots <= 0 || a.units.length >= RW.MAX_UNITS) continue;
      const budget = fs.gold - reserve;
      if (budget < 250) continue;
      // Classic campaign: the AI keeps its original rosters so the challenge is unchanged.
      const filter = (u) => (c.grand || !u.added) && c.rareOk(f, u, t);
      const want = D.genArmy(f, budget, t.level, Math.min(RW.MAX_UNITS, a.units.length + slots), Math.random, a.units.map((u) => u.typeId), filter);
      for (const id of want) if (c.recruit(a, id)) break;
    }

    // ---- Movement
    const armies = myArmies().slice().sort((a, b) => c.armyPower(b) - c.armyPower(a));
    for (const a of armies) {
      let guard = 0;
      while (a.moves > 0 && c.armies.includes(a) && guard++ < 3) {
        const acted = await decideMove(c, f, a, hooks, { smart, P, player, diff });
        if (!acted) break;
        if (c.over) return;
      }
    }
  }

  async function decideMove(c, f, a, hooks, ctx) {
    const fs = c.factions[f];
    const S = c.armyPower(a);
    const avgHp = a.units.length ? a.units.reduce((s, u) => s + u.hp, 0) / a.units.length : 0;
    const here = c.terr(a.tid);
    const need = ctx.P.need;
    const capT = c.terr(fs.capital);

    // Empty or very weak armies stay home to recruit.
    if (a.units.length < 3 && here.owner === f) return false;

    // Defend the capital if an enemy army stronger than its garrison is next to it.
    if (ctx.smart && capT && capT.owner === f && a.tid !== capT.id) {
      const threat = c.adj(capT.id).map((n) => c.armyAt(n)).filter((x) => x && x.faction !== f && x.faction !== 'rebels' && c.atWar(f, x.faction));
      const tp = threat.reduce((s, x) => s + c.armyPower(x), 0);
      if (tp > c.garrisonPower(capT) * 1.1 && !c.armyAt(capT.id)) {
        const step = firstStep(c, a.tid, capT.id, (n) => { const o = c.armyAt(n); return !o; });
        if (step != null && c.canMoveTo(a, step) && c.moveKind(a, step) === 'move') { await doMove(c, a, step, hooks); return true; }
      }
    }
    // Stay to defend the capital when it's threatened.
    if (ctx.smart && capT && a.tid === capT.id) {
      const threat = c.adj(capT.id).map((n) => c.armyAt(n)).filter((x) => x && x.faction !== f && x.faction !== 'rebels' && c.atWar(f, x.faction));
      if (threat.length) {
        // Strike first if clearly stronger, otherwise hold.
        const weakest = threat.sort((x, y) => c.armyPower(x) - c.armyPower(y))[0];
        if (S > c.defensePower(weakest.tid, f) * (need + 0.15)) { await hooks.attack(a, weakest.tid); return true; }
        return false;
      }
    }
    // Damaged armies go home to replenish.
    if (avgHp < 0.45) {
      if (here.owner === f) return false;
      const homes = c.owned(f).filter((t) => !c.armyAt(t.id));
      if (homes.length) {
        const dist = distances(c, a.tid);
        homes.sort((x, y) => (dist.get(x.id) || 99) - (dist.get(y.id) || 99));
        const step = firstStep(c, a.tid, homes[0].id, (n) => !c.armyAt(n));
        if (step != null && c.canMoveTo(a, step) && c.moveKind(a, step) === 'move') { await doMove(c, a, step, hooks); return true; }
      }
      return false;
    }

    // Evaluate adjacent targets.
    let best = null, bestScore = 0;
    for (const n of c.adj(a.tid)) {
      if (!c.canMoveTo(a, n)) continue;
      const kind = c.moveKind(a, n);
      if (kind === 'move') continue;
      const t = c.terr(n);
      const other = c.armyAt(n);
      const Dp = c.defensePower(n, f) * (c.isSiege(n, other ? other.faction : t.owner) && !a.units.some((u) => D.UNITS[u.typeId].cat === 'siege') ? 1.15 : 1);
      if (S < Dp * need) continue;
      let value = 1 + t.level * 0.5 + (t.shrine ? 1 : 0) + (c.majors.some((g) => c.factions[g].startCapital === n && g !== f) ? 2 : 0);
      const owner = other ? other.faction : t.owner;
      value *= warBias(c, f, owner);
      if (owner === ctx.player) value *= 1 + 0.4 * ctx.P.aggression;
      if (other && owner !== 'rebels') value += 1.5; // hunt weak armies
      if (owner === 'rebels') value *= 0.85;
      // Hard: prefer fights we win cheaply.
      const score = value * (ctx.diff === 'hard' ? Math.min(3, S / Math.max(1, Dp)) : 1) + Math.random() * 0.5;
      if (score > bestScore) { bestScore = score; best = n; }
    }
    if (best != null) { await hooks.attack(a, best); return true; }

    // Otherwise march toward the most attractive reachable target.
    const dist = distances(c, a.tid, (n) => { const o = c.armyAt(n); return (!o || o.faction === f) && (c.terr(n).owner === f || n === a.tid); });
    let goal = null, gs = 0;
    for (const t of c.territories) {
      if (t.owner === f || !c.atWar(f, t.owner)) continue;
      const d = dist.get(t.id);
      if (d == null || d > 6) continue;
      const Dp = c.defensePower(t.id, f);
      if (S < Dp * (need - 0.1)) continue;
      let v = (1 + t.level * 0.5 + (t.shrine ? 1 : 0)) * (t.owner === ctx.player ? 1 + 0.3 * ctx.P.aggression : 1) * warBias(c, f, t.owner);
      const sc = v / (d + 0.5);
      if (sc > gs) { gs = sc; goal = t.id; }
    }
    if (goal != null) {
      const step = firstStep(c, a.tid, goal, (n) => { const o = c.armyAt(n); return !o && c.terr(n).owner === f; });
      if (step != null && c.canMoveTo(a, step)) {
        const kind = c.moveKind(a, step);
        if (kind === 'move') { await doMove(c, a, step, hooks); return true; }
        if (S >= c.defensePower(step, f) * need) { await hooks.attack(a, step); return true; }
      }
    }
    return false;
  }

  // Diplomacy shapes targets: an ally's request focuses the army, and shared enemies of allies are preferred.
  function warBias(c, f, owner) {
    if (!c.grand || owner === 'rebels') return 1;
    let m = 1;
    const fs = c.factions[f];
    if (fs.focus && fs.focus.target === owner) m *= 2.2;
    if (c.majors.some((x) => x !== f && x !== owner && c.rel(f, x).state === 'alliance' && c.atWar(x, owner))) m *= 1.35;
    return m;
  }

  async function doMove(c, a, to, hooks) {
    const from = a.tid;
    a.tid = to; a.moves--;
    if (hooks.moved) await hooks.moved(a, from, to);
  }

  RW.campaignAI = { runFaction, distances, firstStep };
})();
