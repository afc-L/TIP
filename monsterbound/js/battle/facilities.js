'use strict';
// =====================================================================================
// BATTLE FRONTIER — Battle Tower, Elemental Arena, Survival Gauntlet, Champion's
// Challenge, Legendary Trial, and the BP exchange.
// =====================================================================================
MB.Facilities = {
  clone(m, lvl) {
    const c = MB.deepCopy(m);
    if (lvl) { c.lvl = lvl; c.exp = MB.Mon.expFor(MB.SP[c.sp].growth, lvl); }
    MB.Mon.heal(c);
    return c;
  },
  async pickTeam(n, lvl) {
    const S = MB.state;
    const pool = S.party.filter((m) => !m.egg);
    if (pool.length < n) { await MB.say(`You need at least ${n} creatures in your party.`); return null; }
    const chosen = [];
    while (chosen.length < n) {
      const opts = pool.filter((m) => !chosen.includes(m)).map((m) => m);
      const c = await MB.ask(`Choose creature ${chosen.length + 1} of ${n}`, opts.map((m) => `${m.name} Lv${m.lvl}`));
      if (c < 0) return null;
      chosen.push(opts[c]);
    }
    return chosen.map((m) => MB.Facilities.clone(m, lvl));
  },
  enemyTeam(seed, lvl, n, types) {
    const r = new MB.RNG(seed);
    const pool = MB.SPECIES.filter((s) => !s.legendary && !s.evo.length && s.bst >= 420 && (!types || s.types.some((t) => types.includes(t))));
    const team = [];
    for (let i = 0; i < n; i++) { const s = r.pick(pool); team.push([s.key, lvl, s.mega && r.chance(0.15) ? { mega: true } : undefined]); }
    return MB.Teams.build(team, seed, { ivs: Math.min(31, 10 + Math.floor(lvl / 4)), heldItems: true });
  },
  async battleWith(team, enemy, trainer, opts = {}) {
    const S = MB.state;
    const real = S.party;
    S.party = team;
    let res;
    try {
      res = await MB.Battles.run(Object.assign({ kind: 'trainer', enemy, trainer, facility: true, noExp: true, canLose: true, env: 'champion', music: 'gymbattle' }, opts));
    } finally { S.party = real; }
    return res.outcome === 'win';
  },
  trainer(seed, title) {
    const r = new MB.RNG(seed);
    const cls = r.pick(['Ace Trainer', 'Veteran', 'Dragon Tamer', 'Psychic', 'Black Belt', 'Socialite', 'Hex Maniac']);
    return { name: r.pick(MB.TRAINER_NAMES[cls]), title: title || cls, app: MB.Chars.randomApp(seed, 'ace'), ai: 4, items: [], mega: true, pay: 0 };
  },
  async talk(id) {
    const S = MB.state;
    S.frontier = S.frontier || { bp: 0, tower: 0, towerBest: 0, arena: {}, gauntlet: 0, challenge: 0, trial: 0 };
    const F = S.frontier;
    if (!S.flags.champion) return MB.say('The Battle Frontier is open only to the Champion.');
    if (id === 'shop') return MB.Facilities.shop();
    if (id === 'tower') {
      await MB.say(`Welcome to the Battle Tower! Bring three creatures; all battle at Lv. 50. Best streak: ${F.towerBest}. You have ${F.bp} BP.`, { speaker: 'Tower Clerk' });
      if (!(await MB.yesno('Begin a challenge?'))) return;
      const team = await MB.Facilities.pickTeam(3, 50); if (!team) return;
      let streak = 0;
      while (true) {
        const floor = streak + 1;
        const lvl = 50;
        const enemy = MB.Facilities.enemyTeam('tower' + S.day + floor, lvl + Math.min(5, Math.floor(floor / 10)), 3);
        const tr = floor % 7 === 0 ? { name: 'Tower Tycoon Vale', title: 'Frontier Brain', app: { skin: '#e8b890', hair: '#202020', hairStyle: 'short', top: '#a07020', bottom: '#202020' }, ai: 6, items: ['full_restore'], mega: true, pay: 0 } : MB.Facilities.trainer('tw' + S.day + floor);
        await MB.say(`Floor ${floor}! ${tr.title} ${tr.name} approaches.`);
        const win = await MB.Facilities.battleWith(team, enemy, tr);
        if (!win) break;
        streak++;
        for (const m of team) MB.Mon.heal(m);
        const bp = floor % 7 === 0 ? 10 : 2;
        F.bp += bp; MB.toast(`+${bp} BP`, '#603090');
        if (streak >= 10) MB.Achievements.unlock('tower10'); if (streak >= 50) MB.Achievements.unlock('tower50');
        if (!(await MB.yesno(`Streak: ${streak}. Continue to floor ${floor + 1}?`))) break;
      }
      F.towerBest = Math.max(F.towerBest, streak);
      await MB.say(`Your streak ended at ${streak}. Total BP: ${F.bp}.`, { speaker: 'Tower Clerk' });
      return;
    }
    if (id === 'arena') {
      await MB.say('The Elemental Arena! Pick a type and defeat five specialists of that type. Your own creatures battle at Lv. 60.', { speaker: 'Arena Host' });
      const types = MB.TYPES;
      const c = await MB.ask('Which element?', types.map((t) => t + (F.arena[t] ? ' ★' : '')), { maxVis: 7 });
      if (c < 0) return;
      const type = types[c];
      const team = await MB.Facilities.pickTeam(3, 60); if (!team) return;
      for (let i = 1; i <= 5; i++) {
        const enemy = MB.Facilities.enemyTeam('arena' + type + i + S.day, 60 + i, 3, [type]);
        const tr = Object.assign(MB.Facilities.trainer('ar' + type + i), { title: type + ' Specialist' });
        tr.app = MB.Chars.typedApp(type, 'ar' + i);
        await MB.say(`Round ${i} of 5!`);
        if (!(await MB.Facilities.battleWith(team, enemy, tr))) { await MB.say('Defeated! Try again anytime.', { speaker: 'Arena Host' }); return; }
        for (const m of team) MB.Mon.heal(m);
      }
      const first = !F.arena[type];
      F.arena[type] = true; F.bp += first ? 20 : 8;
      await MB.say(`You mastered the ${type} Arena! (+${first ? 20 : 8} BP)`, { speaker: 'Arena Host' });
      if (first) await MB.Sc.give(type.toLowerCase() + '_sigil');
      if (MB.TYPES.every((t) => F.arena[t])) MB.Achievements.unlock('arena_all');
      return;
    }
    if (id === 'gauntlet') {
      await MB.say('The Survival Gauntlet: 10 trainers in a row with your real team and levels. No healing between battles — only 3 Potions provided!', { speaker: 'Gauntlet Warden' });
      if (!(await MB.yesno('Enter the Gauntlet?'))) return;
      const team = S.party.filter((m) => !m.egg).map((m) => MB.Facilities.clone(m));
      const top = Math.max(...team.map((m) => m.lvl));
      const realBag = S.bag; S.bag = { hyper_potion: 3 };
      try {
        for (let i = 1; i <= 10; i++) {
          const enemy = MB.Facilities.enemyTeam('gaunt' + S.day + i, Math.min(100, top - 4 + Math.floor(i / 2)), i < 10 ? 3 : 6);
          const tr = i === 10 ? { name: 'Warden Krom', title: 'Gauntlet Master', app: MB.Chars.randomApp('krom', 'hiker'), ai: 6, items: ['full_restore'], mega: true, pay: 0 } : MB.Facilities.trainer('gt' + i + S.day);
          await MB.say(`Battle ${i} of 10.`);
          if (!(await MB.Facilities.battleWith(team, enemy, tr, { noItems: false }))) { await MB.say(`You fell at battle ${i}.`); return; }
          for (const m of team) { m.status = m.status; }
        }
      } finally { S.bag = realBag; }
      F.gauntlet++; F.bp += 30;
      MB.Achievements.unlock('gauntlet_clear');
      await MB.say('You survived the Gauntlet! (+30 BP)', { speaker: 'Gauntlet Warden' });
      if (F.gauntlet === 1) await MB.Sc.give('last_stand_band');
      return;
    }
    if (id === 'challenge') {
      await MB.say('The Champion\'s Challenge: battle four legendary trainers of the past with full teams at Lv. 70.', { speaker: 'Challenge Herald' });
      if (!(await MB.yesno('Accept the Challenge?'))) return;
      const team = S.party.filter((m) => !m.egg).map((m) => MB.Facilities.clone(m, 70));
      const foes = ['darius', 'elite4', 'champion', 'w_ignatius'];
      for (let i = 0; i < foes.length; i++) {
        const B = MB.BOSSES[foes[i]];
        const enemy = MB.Teams.build(MB.Battles.scaleTeam(B.team, 70 - Math.max(...B.team.map((t) => t[1]))).concat(B.team.length < 6 ? MB.Teams.auto([B.type], 68, 6 - B.team.length, foes[i] + 'cc', 'X') : []), foes[i] + 'cc', { ivs: 31, heldItems: true });
        const tr = { name: B.name, title: 'Legend', app: B.type === 'Mixed' ? MB.Chars.randomApp(foes[i], 'ace') : MB.Chars.typedApp(B.type, foes[i]), ai: 6, items: ['full_restore', 'full_restore'], mega: true, pay: 0 };
        if (!(await MB.Facilities.battleWith(team, enemy, tr, { music: 'champion' }))) { await MB.say('The Challenge ends here.'); return; }
        for (const m of team) MB.Mon.heal(m);
      }
      F.challenge++; F.bp += 40;
      await MB.say('Incredible! You conquered the Champion\'s Challenge! (+40 BP)', { speaker: 'Challenge Herald' });
      if (F.challenge === 1) await MB.Sc.give('fortune_coin');
      return;
    }
    if (id === 'trial') {
      await MB.say('Ah... the Legendary Trial. Face three empowered legendary creatures in succession. They cannot be caught here.', { speaker: 'Trial Elder' });
      if (!(await MB.yesno('Do you dare?'))) return;
      const legends = MB.SPECIES.filter((s) => s.legendary && s.rarity === 'leg');
      const r = new MB.RNG('trial' + S.day);
      const team = S.party.filter((m) => !m.egg).map((m) => MB.Facilities.clone(m));
      for (let i = 0; i < 3; i++) {
        const L = r.pick(legends);
        const foe = MB.Mon.create(L.key, Math.max(70, Math.max(...team.map((m) => m.lvl)) + 3), { ivs: Object.fromEntries(MB.STAT_KEYS.map((k) => [k, 31])) });
        const real = S.party; S.party = team;
        let res;
        try { res = await MB.Battles.run({ kind: 'wild', enemy: [foe], legendary: true, noCatch: true, noRun: true, facility: true, noExp: true, canLose: true, env: 'legend', music: 'legend' }); } finally { S.party = real; }
        if (res.outcome !== 'win') { await MB.say('The trial is over for now.', { speaker: 'Trial Elder' }); return; }
      }
      F.trial++; F.bp += 35;
      await MB.say('You stood before legends and endured. (+35 BP)', { speaker: 'Trial Elder' });
      await MB.Sc.give(F.trial === 1 ? 'legendary_capsule' : 'ancient_capsule', F.trial === 1 ? 1 : 3);
    }
  },
  shopList() {
    const S = MB.state;
    const items = MB.SHOPS.frontier.map((id) => [id, MB.ITEMS[id].price ? Math.max(4, Math.round(MB.ITEMS[id].price / 400)) : 48]);
    // Any Aether Stone not yet owned becomes purchasable here as a fallback (guarantees every Mega is obtainable)
    const owned = (st) => MB.Bag.count(st) > 0 || MB.Collection.allMons().some((m) => m.item === st);
    for (const sp of MB.MEGA_SPECIES) if (!sp.legendary && !owned(sp.mega.stone)) items.push([sp.mega.stone, 64]);
    return items.filter(([id]) => MB.ITEMS[id]);
  },
  async shop() {
    const S = MB.state;
    while (true) {
      const list = MB.Facilities.shopList();
      const c = await MB.ask(`Exchange Battle Points (You have ${S.frontier.bp} BP)`, list.map(([id, p]) => `${MB.ITEMS[id].name} - ${p} BP`), { maxVis: 7 });
      if (c < 0) return;
      const [id, p] = list[c];
      if (S.frontier.bp < p) { await MB.say('Not enough BP.'); continue; }
      S.frontier.bp -= p; MB.Bag.add(id, 1); MB.audio.sfx('item');
      await MB.say(`You got ${MB.ITEMS[id].name}!`);
    }
  },
};
