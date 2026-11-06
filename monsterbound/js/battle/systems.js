'use strict';
// =====================================================================================
// Gameplay systems: Bag, Dex, Collection (party + storage), Battles (orchestration),
// Breeding, Achievements.
// =====================================================================================
MB.Bag = {
  add(id, n = 1) { const S = MB.state; if (MB.ITEMS[id].cat === 'key') { S.keyItems[id] = true; return; } S.bag[id] = (S.bag[id] || 0) + n; },
  remove(id, n = 1) { const S = MB.state; if (!S.bag[id]) return false; S.bag[id] -= n; if (S.bag[id] <= 0) delete S.bag[id]; return true; },
  count(id) { return MB.state.bag[id] || 0; },
  list(cat) {
    const S = MB.state;
    if (cat === 'key') return Object.keys(S.keyItems).filter((k) => S.keyItems[k] && MB.ITEMS[k]).map((id) => ({ id, n: 1 }));
    return Object.keys(S.bag).filter((id) => MB.ITEMS[id] && (MB.ITEMS[id].cat === cat || (cat === 'treasure' && MB.ITEMS[id].cat === 'quest'))).map((id) => ({ id, n: S.bag[id] }));
  },
  CATS: [['heal', 'Healing'], ['capsule', 'Capsules'], ['battle', 'Battle'], ['held', 'Held Items'], ['evo', 'Evolution'], ['mega', 'Aether Stones'], ['treasure', 'Treasures'], ['key', 'Key Items']],
};

MB.Dex = {
  entry(k) { const S = MB.state; return S.dex[k] || (S.dex[k] = {}); },
  seen(k) { const e = MB.Dex.entry(k); if (!e.seen) { e.seen = true; } },
  caught(k) { const e = MB.Dex.entry(k); const first = !e.caught; e.seen = true; e.caught = true; MB.state.flags['caught_' + k] = true; return first; },
  megaSeen(k) { MB.Dex.entry(k).mega = true; },
  countSeen(region) { return MB.SPECIES.filter((s) => (!region || s.region === region) && MB.state.dex[s.key] && MB.state.dex[s.key].seen).length; },
  countCaught(region) { return MB.SPECIES.filter((s) => (!region || s.region === region) && MB.state.dex[s.key] && MB.state.dex[s.key].caught).length; },
  MILESTONES: [[10, 'great_capsule', 5], [25, 'scholar_charm', 1], [50, 'ultra_capsule', 10], [80, 'egg_incubator', 1], [120, 'ancient_capsule', 5], [160, 'tempestrel_stone', 1], [200, 'legendary_capsule', 1], [250, 'radiant_charm', 1], [300, 'master_capsule', 1]],
  async milestoneRewards(speaker) {
    const S = MB.state, c = MB.Dex.countCaught();
    for (const [n, item, q] of MB.Dex.MILESTONES) {
      if (c >= n && !S.flags['dexm_' + n]) {
        S.flags['dexm_' + n] = true;
        await MB.say(`${n} species caught! Here\'s a reward for your research.`, { speaker });
        if (item === 'tempestrel_stone' && (MB.Bag.count(item) || S.flags.got_tempestrel_stone)) await MB.Sc.give('rare_candy', 5);
        else await MB.Sc.give(item, q);
      }
    }
  },
};

MB.Collection = {
  async addCaught(m, opts = {}) {
    const S = MB.state;
    const first = MB.Dex.caught(m.sp);
    S.stats.caught = (S.stats.caught || 0) + 1;
    if (!opts.gift) MB.Achievements.unlock('first_capture');
    if (m.shiny) MB.Achievements.unlock('radiant');
    if (MB.SP[m.sp].legendary) { S.stats.legends = (S.stats.legends || 0) + 1; MB.Achievements.unlock('legend_hunter'); }
    if (first && !opts.silent && !opts.gift) await MB.Screens.dexEntry(m.sp, true);
    if (!opts.gift && !opts.silent) {
      if (await MB.yesno(`Give a nickname to ${m.name}?`)) m.name = await MB.inputText(`Nickname for ${m.name}?`, m.name, 12);
    }
    if (S.party.length < 6) S.party.push(m);
    else {
      const box = MB.Collection.freeBox();
      S.boxes[box].push(m);
      if (!opts.silent) await MB.say(`${m.name} was sent to Storage Box ${box + 1}.`);
    }
    MB.Quests && MB.Quests.onCatch(m);
    MB.Achievements.check();
    return true;
  },
  freeBox() { const S = MB.state; for (let i = 0; i < S.boxes.length; i++) if (S.boxes[i].length < 30) return i; S.boxes.push([]); return S.boxes.length - 1; },
  allMons() { const S = MB.state; return S.party.concat(...S.boxes); },
};

// ---------------- Battles orchestration ----------------
MB.Battles = {
  envForMap(m) {
    if (!m) return 'grass';
    if (MB.Over && MB.Over.surfing) return 'water';
    if (m.dark) return 'dark';
    const e = m.env || 'grass';
    if (e === 'grass' && m.kind === 'forest') return 'forest';
    return e;
  },
  async run(opts) {
    const S = MB.state;
    const map = MB.World.get(S.map);
    opts.env = opts.env || MB.Battles.envForMap(map);
    if (!opts.weather && map && !map.indoor) opts.weather = MB.World.battleWeather(MB.World.weatherFor(map));
    if (opts.weather === null) delete opts.weather;
    MB.audio.sfx('encounter');
    const prevMusic = MB.audio.current;
    const lv = Object.fromEntries(S.party.map((m) => [m.uid, m.lvl]));
    const res = await MB.Game.push(new MB.BattleScene(opts));
    for (const m of S.party) { if (m.hp < 0) m.hp = 0; }
    S.stats.battles = (S.stats.battles || 0) + 1;
    if (res.outcome === 'lose' && !opts.canLose && !opts.facility) await MB.Battles.whiteout();
    else if (res.outcome === 'win' || res.outcome === 'caught' || res.outcome === 'run' || opts.canLose) {
      if (!opts.facility) await MB.Battles.postBattle(lv);
    }
    if (opts.canLose && res.outcome === 'lose') MB.Sc.heal();
    MB.audio.play(opts.resumeMusic || (MB.Over ? MB.Over.musicFor() : prevMusic));
    return res;
  },
  async postBattle(lv) {
    // evolutions (only for creatures that levelled up this battle)
    const S = MB.state;
    for (const m of S.party.slice()) {
      if (m.egg || m.hp <= 0) continue;
      if (lv && lv[m.uid] !== undefined && lv[m.uid] === m.lvl) continue;
      const map = MB.World.get(S.map);
      const to = MB.Mon.checkEvolution(m, { time: MB.World.isNight() ? 'night' : 'day', locTags: map ? [map.id, map.theme] : [], flags: S.flags });
      if (to) await MB.Screens.evolve(m, to);
    }
  },
  async whiteout() {
    const S = MB.state;
    const lost = Math.floor(S.money / 2);
    S.money -= lost;
    await MB.say(`${S.name} blacked out and rushed to safety... (Lost $${lost})`);
    await MB.fadeOut(0.5);
    MB.Sc.heal();
    const c = S.lastCenter || { map: 'willowbrook', door: 'wb_home' };
    await MB.Over.warpTo(c.map, c.x, c.y, 'down', { door: c.door });
    await MB.fadeIn(0.5);
  },
  scaleTeam(team, add) { return team.map(([k, l, e]) => [MB.Teams.stageFor(MB.firstStage(k).key, l + add) === k || MB.SP[k].legendary ? k : MB.Teams.stageFor(MB.firstStage(k).key, l + add), Math.min(100, l + add), e]); },
  async boss(key, opts = {}) {
    const S = MB.state;
    const B = MB.BOSSES[key];
    let team = B.team;
    if (opts.rematch) {
      const order = ['mira', 'voltan', 'brutus', 'marina', 'cinder', 'selene', 'frost', 'darius'];
      const target = key.startsWith('w_') ? 82 : 62 + order.indexOf(key) * 1.5;
      const top = Math.max(...team.map((t) => t[1]));
      team = MB.Battles.scaleTeam(team, Math.max(0, Math.round(target - top)));
      if (team.length < 6) team = team.concat(MB.Teams.auto([B.type], target - 2, 6 - team.length, key + 'rm', S.region || 'A'));
      for (const t of team) if (t[2] && t[2].mega) t[2] = { mega: true };
    }
    const enemy = MB.Teams.build(team, key + (opts.rematch ? 'r' : ''), { ivs: opts.rematch ? 31 : Math.min(31, 8 + Math.floor(team[0][1] / 3)), heldItems: team[0][1] > 40 });
    const app = B.app || (B.type && B.type !== 'Mixed' ? MB.Chars.typedApp(B.type, key) : MB.Chars.randomApp(key, B.title === 'Commander' || B.title === 'Director' ? 'commander' : 'ace'));
    const res = await MB.Battles.run({
      kind: 'trainer', enemy, music: B.music || opts.music || (key.startsWith('elite') || key.startsWith('v_elite') ? 'gymbattle' : 'trainer'), env: opts.env,
      trainer: { name: B.name, title: B.title, app, ai: B.ai || 2, items: (B.items || []).slice(), mega: B.mega && (S.keyItems.aether_gauntlet || true), pay: opts.rematch ? (B.pay || 1000) * 2 : B.pay, intro: B.intro, lose: B.lose, victoryMusic: 'victory' },
      canLose: opts.canLose,
    });
    if (res.outcome === 'win') { S.flags['beat_' + key] = true; MB.Quests && MB.Quests.onDefeat(key); }
    return res.outcome === 'win';
  },
  async rival(stage, opts = {}) {
    const S = MB.state;
    const starter = MB.Sc.rivalStarter();
    const team = MB.rivalTeam(stage, starter);
    const enemy = MB.Teams.build(team, 'rival' + stage, { ivs: 10 + stage * 3, heldItems: stage >= 4 });
    const app = S.rivalApp || { skin: '#f8d8b8', hair: '#c03828', hairStyle: 'spiky', top: '#303038', bottom: '#3050a0', shoes: '#202020' };
    const res = await MB.Battles.run({
      kind: 'trainer', enemy, music: 'rival', canLose: opts.canLose,
      trainer: { name: MB.Sc.rivalName(), title: 'Rival', app, ai: Math.min(5, 2 + Math.floor(stage / 2)), items: stage >= 3 ? ['hyper_potion'] : stage >= 1 ? ['potion'] : [], mega: stage >= 6, pay: 400 + stage * 900 },
    });
    return res.outcome === 'win';
  },
  async grunt(types, n, lvl, opts = {}) {
    const team = MB.Teams.auto(types, lvl, n, 'grunt' + lvl + types.join(), MB.state.region || 'A');
    const enemy = MB.Teams.build(team, 'g' + lvl);
    const res = await MB.Battles.run({ kind: 'trainer', enemy, music: 'evil', trainer: { name: 'Grunt', title: 'Syndicate', app: MB.Chars.randomApp('grunt' + lvl, 'grunt'), ai: 1, pay: lvl * 40, intro: opts.intro } });
    return res.outcome === 'win';
  },
  async custom(def) {
    const enemy = MB.Teams.build(def.team, def.name + def.team.length, { ivs: 15 });
    const res = await MB.Battles.run({ kind: 'trainer', enemy, music: def.music || 'trainer', trainer: { name: def.name, title: def.title, app: def.app || MB.Chars.randomApp(def.name), ai: def.ai || 2, items: def.items || [], pay: def.pay || 500, intro: def.intro, lose: def.lose }, canLose: def.canLose });
    return res.outcome === 'win';
  },
  async trainerNpc(npc, map) {
    const S = MB.state;
    const t = npc.trainer;
    const lvl = t.lvl || ((map.wild && map.wild.lvl ? map.wild.lvl[1] : 5) + 1);
    const seed = npc.id;
    const team = t.team || MB.Teams.auto(t.types || MB.CLASS_TYPES[t.cls], lvl, t.n || 2, seed, map.region);
    const enemy = MB.Teams.build(team, seed, { ivs: Math.min(31, Math.floor(lvl / 3)), heldItems: lvl >= 55 });
    const r = new MB.RNG(seed);
    const name = t.name || r.pick(MB.TRAINER_NAMES[t.cls] || ['Alex']);
    const res = await MB.Battles.run({
      kind: 'trainer', enemy, music: t.cls === 'Grunt' ? 'evil' : 'trainer',
      trainer: { name, title: t.cls === 'Grunt' ? 'Syndicate' : t.cls, app: npc.app, ai: lvl > 45 ? 3 : lvl > 20 ? 2 : 1, items: lvl > 30 ? ['hyper_potion'] : [], pay: Math.floor(lvl * (t.cls === 'Ace Trainer' || t.cls === 'Veteran' ? 60 : 30)), intro: t.pre, lose: t.post },
    });
    if (res.outcome === 'win') { S.flags['tr:' + npc.id] = true; S.stats.trainers = (S.stats.trainers || 0) + 1; MB.Quests && MB.Quests.onTrainer(npc, map); }
    return res.outcome === 'win';
  },
  async legend(key, lvl, opts = {}) {
    const S = MB.state;
    const m = MB.Mon.create(key, lvl, { ivs: { hp: 31, atk: MB.randInt(15, 31), def: 31, spa: MB.randInt(15, 31), spd: 31, spe: MB.randInt(15, 31) } });
    const res = await MB.Battles.run({ kind: 'wild', enemy: [m], legendary: true, music: 'legend', env: opts.env || (MB.Battles.envForMap(MB.World.get(S.map)) === 'grass' ? 'legend' : MB.Battles.envForMap(MB.World.get(S.map))), canLose: true, noRun: !!opts.story });
    if (res.outcome === 'caught') { S.flags['caught_' + key] = true; await MB.say(`You caught the legendary ${MB.SP[key].name}!`); }
    else if (res.outcome === 'win') await MB.say(`${MB.SP[key].name} vanished... It may return someday.`);
    else if (res.outcome === 'run') await MB.say(`${MB.SP[key].name} is still watching you...`);
    MB.Over && MB.Over.refresh();
    return res.outcome;
  },
  async wild(sp, lvl, opts = {}) {
    const S = MB.state;
    const odds = (S.keyItems.radiant_charm ? 3 : 1) / 512;
    const m = MB.Mon.create(sp, lvl, { shinyOdds: odds });
    return MB.Battles.run(Object.assign({ kind: 'wild', enemy: [m] }, opts));
  },
  async championship({ region }) {
    const S = MB.state;
    const seq = region === 'A' ? ['elite1', 'elite2', 'elite3', 'elite4', 'champion'] : ['v_elite1', 'v_elite2', 'v_elite3', 'v_champion'];
    const rematch = region === 'A' ? !!S.flags.champion : !!S.flags.v_champion;
    for (let i = 0; i < seq.length; i++) {
      const key = seq[i], B = MB.BOSSES[key];
      await MB.fadeOut(0.4);
      MB.audio.play('gym');
      await MB.fadeIn(0.4);
      await MB.say(`${i < seq.length - 1 ? 'Elite Room ' + (i + 1) : 'The Champion\'s Chamber'}: ${B.title} ${B.name} awaits.`);
      if (key === 'champion' && !S.flags.champion) await MB.sayAll([`So you made it. I\'m Aurelia — the Champion. And yes... ${MB.Sc.rivalName()}\'s big sister.`, 'He talks about you constantly, you know. "My rival this, my rival that."', 'Let\'s give him something to talk about.'], 'Aurelia');
      const win = await MB.Battles.boss(key, { env: key === 'champion' || key === 'v_champion' ? 'champion' : 'gym', rematch, canLose: true });
      if (!win) { await MB.Battles.whiteout(); return false; }
      if (i < seq.length - 1) {
        const c = await MB.ask('Prepare before the next room?', ['Continue', 'Use items', 'Check party']);
        if (c === 1) await MB.Game.push(new MB.BagScene({ field: true }));
        if (c === 2) await MB.Game.push(new MB.PartyScene({}));
      }
    }
    // victory!
    const first = region === 'A' ? !S.flags.champion : !S.flags.v_champion;
    if (region === 'A') { MB.Sc.set('champion'); MB.Achievements.unlock('champion'); } else { MB.Sc.set('v_champion'); MB.Achievements.unlock('v_champion'); MB.Sc.chapter(13); }
    S.hallOfFame = S.hallOfFame || [];
    S.hallOfFame.push({ region, day: S.day, team: S.party.filter((m) => !m.egg).map((m) => ({ sp: m.sp, name: m.name, lvl: m.lvl, shiny: m.shiny })) });
    await MB.Screens.hallOfFame(region, first);
    if (first && region === 'A') {
      await MB.say(`${MB.Sc.rivalName()} bursts in. "YOU DID IT! You beat my sister! ...Aurelia, are you crying?" "...Shut up, Kael."`);
      await MB.say('Professor Hazel would love to hear the news. Your adventure is far from over...');
      MB.Sc.heal();
      S.flags.roam_voltacrest = true;
      await MB.fadeOut(0.8);
      await MB.Over.warpTo('willowbrook', null, null, 'down', { door: 'wb_home' });
      await MB.fadeIn(0.8);
      await MB.say('POSTGAME UNLOCKED: Battle Frontier, Gym & Champion rematches, legendary hunts, the Forgotten Expanse... and the distant land of Veloria. Visit Professor Hazel!');
    }
    return true;
  },
};

// ---------------- Breeding ----------------
MB.Breeding = {
  compatible(a, b) {
    const sa = MB.SP[a.sp], sb = MB.SP[b.sp];
    if (sa.eggGroup === 'none' || sb.eggGroup === 'none') return 0;
    if (sa.eggGroup === 'universal' && sb.eggGroup === 'universal') return 0;
    if (sa.eggGroup === 'universal' || sb.eggGroup === 'universal') return 0.25;
    if (a.gender && b.gender && a.gender === b.gender) return 0;
    if (!a.gender || !b.gender) return 0;
    if (MB.firstStage(a.sp) === MB.firstStage(b.sp)) return 0.55;
    if (sa.eggGroup === sb.eggGroup) return 0.35;
    return 0;
  },
  babyOf(a, b) {
    let mother = a;
    if (MB.SP[a.sp].eggGroup === 'universal') mother = b; else if (MB.SP[b.sp].eggGroup !== 'universal' && b.gender === 'F') mother = b;
    let base = MB.firstStage(mother.sp).key;
    return { base, mother, father: mother === a ? b : a };
  },
  makeEgg(a, b) {
    const S = MB.state;
    const { base, mother, father } = MB.Breeding.babyOf(a, b);
    const ivs = {};
    const keys = MB.rng.shuffle(MB.STAT_KEYS.slice());
    for (const k of MB.STAT_KEYS) ivs[k] = MB.randInt(0, 31);
    for (const k of keys.slice(0, 3)) ivs[k] = (MB.chance(0.5) ? mother : father).ivs[k];
    const odds = (S.keyItems.radiant_charm ? 3 : 1) * (a.ot !== b.ot ? 2 : 1) / 512;
    const egg = MB.Mon.makeEgg(base, { ivs, shinyOdds: odds, ot: S.trainerId, ability: mother.ability === 2 && MB.chance(0.6) ? 2 : undefined, nature: mother.item === 'stillstone' ? mother.nature : undefined });
    // inherited moves
    const sp = MB.SP[base];
    const canLearn = new Set(sp.eggMoves.concat(sp.learn.map(([, id]) => id)));
    const inh = father.moves.map((m) => m.id).concat(mother.moves.map((m) => m.id)).filter((id) => canLearn.has(id) && !egg.moves.some((x) => x.id === id));
    for (const id of inh.slice(0, 2)) { if (egg.moves.length >= 4) egg.moves.shift(); egg.moves.push({ id, pp: MB.MOVES[id].pp }); }
    egg.met = 'Day Care';
    return egg;
  },
  step(steps) {
    const S = MB.state, D = S.daycare;
    for (const m of D.mons) { m.exp += steps; const sp = MB.SP[m.sp]; while (m.lvl < 100 && m.exp >= MB.Mon.expFor(sp.growth, m.lvl + 1)) { m.lvl++; for (const [l, id] of sp.learn) if (l === m.lvl && !m.moves.some((x) => x.id === id)) { if (m.moves.length >= 4) m.moves.shift(); m.moves.push({ id, pp: MB.MOVES[id].pp }); } } }
    if (D.mons.length === 2 && !D.egg) {
      D.counter = (D.counter || 0) + steps;
      if (D.counter >= 200) { D.counter = 0; const c = MB.Breeding.compatible(D.mons[0], D.mons[1]); if (MB.chance(c)) { D.egg = MB.Breeding.makeEgg(D.mons[0], D.mons[1]); MB.toast('The Day Care has something for you!'); } }
    }
    // hatching
    const mult = S.keyItems.egg_incubator ? 2 : 1;
    for (const m of S.party) if (m.egg) { m.egg.steps -= steps * mult; if (m.egg.steps <= 0 && !MB.Over.hatching) { MB.Over.hatching = true; MB.Over.queue(async () => { await MB.Screens.hatch(m); MB.Over.hatching = false; }); } }
  },
  async talk() {
    const S = MB.state, D = S.daycare;
    const K = 'Day Care Lady';
    if (D.egg) {
      if (await MB.yesno('Your creatures had an Egg! We don\'t know where it came from. Would you like it?')) {
        if (S.party.length >= 6) return MB.say('Your party is full. Come back with space!', { speaker: K });
        S.party.push(D.egg); D.egg = null; MB.audio.sfx('item');
        await MB.say(`${S.name} received the Egg! Walk around with it and it will hatch.`);
        S.stats.eggs = (S.stats.eggs || 0) + 1; MB.Achievements.unlock('first_egg');
        return;
      }
      if (await MB.yesno('Shall we give it away, then?')) D.egg = null;
      return;
    }
    const c = await MB.ask('Welcome to the Day Care! What would you like?', ['Leave a creature', 'Take back a creature', 'Check compatibility', 'Never mind']);
    if (c === 0) {
      if (D.mons.length >= 2) return MB.say('We\'re already looking after two!', { speaker: K });
      const usable = S.party.filter((m) => !m.egg && m.hp > 0);
      if (usable.length <= 1) return MB.say('You can\'t leave your last creature with us!', { speaker: K });
      const i = await MB.Screens.pickPartyMon('Leave which creature?');
      if (i < 0) return;
      const m = S.party[i]; if (m.egg) return;
      S.party.splice(i, 1); D.mons.push(m);
      await MB.say(`We\'ll take good care of ${m.name}. It\'ll gain experience as you walk!`, { speaker: K });
    } else if (c === 1) {
      if (!D.mons.length) return MB.say('We aren\'t looking after anyone for you.', { speaker: K });
      if (S.party.length >= 6) return MB.say('Your party is full!', { speaker: K });
      const j = await MB.ask('Take back which one?', D.mons.map((m) => `${m.name} Lv${m.lvl}`));
      if (j < 0) return;
      const m = D.mons.splice(j, 1)[0]; S.party.push(m);
      MB.Mon.heal(m);
      await MB.say(`Here\'s ${m.name}, all grown up at Lv. ${m.lvl}!`, { speaker: K });
    } else if (c === 2) {
      if (D.mons.length < 2) return MB.say('Leave two creatures and I\'ll tell you how they get along.', { speaker: K });
      const v = MB.Breeding.compatible(D.mons[0], D.mons[1]);
      await MB.say(v >= 0.5 ? 'The two seem to get along very well!' : v >= 0.3 ? 'The two seem to get along.' : v > 0 ? 'The two don\'t seem to like each other much.' : 'The two prefer to play with other creatures.', { speaker: K });
    }
  },
};

// ---------------- Achievements ----------------
MB.ACHIEVEMENTS = [
  ['journey_begins', 'A New Partner', 'Receive your first creature.'], ['first_capture', 'First Capture', 'Catch a wild creature.'], ['first_evolution', 'First Evolution', 'Evolve a creature.'],
  ['first_mega', 'First Mega Evolution', 'Mega Evolve in battle.'], ['first_badge', 'First Gym Badge', 'Earn a Gym Badge.'], ['gauntlet', 'Ancient Inheritance', 'Obtain the Aether Gauntlet.'],
  ['first_stone', 'Stone Seeker', 'Obtain an Aether Stone.'], ['mega_collector', 'Mega Collector', 'Obtain 15 Aether Stones.'], ['mega_master', 'Mega Master', 'Obtain every Aether Stone.'],
  ['badges8', 'Badge Master', 'Earn all 8 Aetherian badges.'], ['syndicate_buster', 'Syndicate Buster', 'Liberate the Aether Tower.'], ['stopped_valen', 'Dawn and Dusk', 'Defeat Valen at Celestial Summit.'],
  ['champion', 'Regional Champion', 'Become Champion of Aetheria.'], ['legend_hunter', 'Legendary Hunter', 'Catch a legendary creature.'], ['legend_master', 'Myth Keeper', 'Catch 10 legendary creatures.'],
  ['dex50', 'Field Researcher', 'Catch 50 species.'], ['dex150', 'Master Researcher', 'Catch 150 species.'], ['complete_aetheria', 'Complete Aetheria', 'Catch every Aetherian species.'],
  ['complete_veloria', 'Complete Veloria', 'Catch every Velorian species.'], ['ultimate', 'Ultimate Collector', 'Catch every species in both regions.'], ['radiant', 'Radiant!', 'Catch a Radiant (shiny) creature.'],
  ['first_egg', 'Family Ties', 'Receive an Egg from the Day Care.'], ['first_hatch', 'Hatchling', 'Hatch an Egg.'], ['fossil', 'Living History', 'Revive a fossil.'],
  ['new_horizon', 'New Horizon', 'Arrive in Veloria.'], ['first_seal', 'Warden\'s Respect', 'Earn a Velorian Seal.'], ['v_champion', 'Sovereign Slayer', 'Become Champion of Veloria.'],
  ['tower10', 'Tower Climber', 'Reach floor 10 of the Battle Tower.'], ['tower50', 'Tower Legend', 'Reach floor 50 of the Battle Tower.'], ['gauntlet_clear', 'Survivor', 'Clear the Survival Gauntlet.'],
  ['arena_all', 'Elemental Master', 'Clear every Elemental Arena type.'], ['quests10', 'Helping Hand', 'Complete 10 side quests.'], ['quests40', 'Hero of the People', 'Complete 40 side quests.'],
  ['shards', 'Starborn', 'Collect all 8 Star Shards.'], ['true_ending', 'Beyond the Eclipse', 'Defeat the secret final boss.'], ['level100', 'Peak Power', 'Raise a creature to Lv. 100.'],
  ['rich', 'Tycoon', 'Hold $500,000.'], ['trainers100', 'Battle Hardened', 'Defeat 100 trainers.'],
];
MB.Achievements = {
  unlock(id) {
    const S = MB.state; if (!S || S.ach[id]) return;
    const a = MB.ACHIEVEMENTS.find((x) => x[0] === id); if (!a) return;
    S.ach[id] = S.day + 1;
    MB.toast('★ Achievement: ' + a[1], '#806010');
    MB.audio.sfx('levelup');
  },
  check() {
    const S = MB.state; if (!S) return;
    const c = MB.Dex.countCaught();
    if (c >= 50) this.unlock('dex50'); if (c >= 150) this.unlock('dex150');
    const A = MB.SPECIES.filter((s) => s.region === 'A'), V = MB.SPECIES.filter((s) => s.region === 'V');
    if (A.every((s) => S.dex[s.key] && S.dex[s.key].caught)) this.unlock('complete_aetheria');
    if (V.every((s) => S.dex[s.key] && S.dex[s.key].caught)) this.unlock('complete_veloria');
    if (MB.SPECIES.every((s) => S.dex[s.key] && S.dex[s.key].caught)) this.unlock('ultimate');
    const stones = MB.MEGA_SPECIES.filter((s) => MB.Bag.count(s.mega.stone) > 0 || MB.Collection.allMons().some((m) => m.item === s.mega.stone)).length;
    if (stones >= 15) this.unlock('mega_collector'); if (stones >= MB.MEGA_SPECIES.length) this.unlock('mega_master');
    if (S.badges.length >= 8) this.unlock('badges8');
    if (MB.SPECIES.filter((s) => s.legendary && S.dex[s.key] && S.dex[s.key].caught).length >= 10) this.unlock('legend_master');
    if ((S.starShards || []).length >= 8) this.unlock('shards');
    if (MB.Collection.allMons().some((m) => m.lvl >= 100)) this.unlock('level100');
    if (S.money >= 500000) this.unlock('rich');
    if ((S.stats.trainers || 0) >= 100) this.unlock('trainers100');
    const qd = Object.values(S.quests).filter((q) => q.done).length;
    if (qd >= 10) this.unlock('quests10'); if (qd >= 40) this.unlock('quests40');
  },
  completion() {
    const S = MB.state;
    const dex = MB.Dex.countCaught() / MB.SPECIES.length;
    const ach = Object.keys(S.ach).length / MB.ACHIEVEMENTS.length;
    const q = Object.values(S.quests).filter((x) => x.done).length / Math.max(1, MB.QUESTS.length);
    const stones = MB.MEGA_SPECIES.filter((s) => MB.Bag.count(s.mega.stone) > 0 || MB.Collection.allMons().some((m) => m.item === s.mega.stone)).length / MB.MEGA_SPECIES.length;
    const badges = (S.badges.length + S.vBadges.length) / 14;
    return Math.round((dex * 0.4 + ach * 0.15 + q * 0.2 + stones * 0.15 + badges * 0.1) * 1000) / 10;
  },
};
