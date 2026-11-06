'use strict';
// Creature instances: creation, stats, experience, moves, evolution and friendship.
MB.NATURES = [
  ['Hardy'], ['Brave', 'atk', 'spe'], ['Bold', 'def', 'atk'], ['Modest', 'spa', 'atk'], ['Calm', 'spd', 'atk'], ['Timid', 'spe', 'atk'],
  ['Lonely', 'atk', 'def'], ['Adamant', 'atk', 'spa'], ['Jolly', 'spe', 'spa'], ['Careful', 'spd', 'spa'], ['Impish', 'def', 'spa'],
  ['Mild', 'spa', 'def'], ['Rash', 'spa', 'spd'], ['Gentle', 'spd', 'def'], ['Hasty', 'spe', 'def'], ['Naive', 'spe', 'spd'],
  ['Quiet', 'spa', 'spe'], ['Relaxed', 'def', 'spe'], ['Sassy', 'spd', 'spe'], ['Lax', 'def', 'spd'], ['Docile'], ['Quirky'], ['Serious'], ['Bashful'], ['Naughty', 'atk', 'spd'],
];
MB.STAT_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
MB.STAT_NAMES = { hp: 'HP', atk: 'Attack', def: 'Defense', spa: 'Sp. Atk', spd: 'Sp. Def', spe: 'Speed', acc: 'Accuracy', eva: 'Evasion' };

MB.Mon = {
  expFor(growth, lvl) {
    const n3 = lvl * lvl * lvl;
    if (lvl <= 1) return 0;
    return Math.floor(growth === 'fast' ? n3 * 0.8 : growth === 'slow' ? n3 * 1.25 : n3);
  },
  create(spKey, lvl, opts = {}) {
    const sp = MB.species(spKey);
    if (!sp) throw new Error('unknown species ' + spKey);
    const r = opts.rng || MB.rng;
    const ivs = {};
    for (const k of MB.STAT_KEYS) ivs[k] = opts.ivs && opts.ivs[k] !== undefined ? opts.ivs[k] : r.int(0, 31);
    const shinyOdds = opts.shinyOdds || 1 / 512;
    const mon = {
      uid: MB.uid(), sp: sp.key, name: opts.name || sp.name, lvl, exp: MB.Mon.expFor(sp.growth, lvl), ivs,
      nature: opts.nature !== undefined ? opts.nature : r.int(0, MB.NATURES.length - 1),
      ability: opts.ability !== undefined ? opts.ability : r.chance(0.08) ? 2 : r.int(0, 1),
      moves: [], hp: 1, status: null, friend: sp.legendary ? 0 : opts.friend || 70, shiny: opts.shiny !== undefined ? opts.shiny : r.chance(shinyOdds),
      gender: sp.genderRatio < 0 ? null : r.chance(sp.genderRatio) ? 'F' : 'M', item: opts.item || null, ball: opts.ball || 'basic_capsule',
      ot: opts.ot || null, met: opts.met || null, metLvl: lvl, bonus: {},
    };
    if (opts.moves) mon.moves = opts.moves.filter((m) => MB.MOVES[m]).map((id) => ({ id, pp: MB.MOVES[id].pp }));
    else MB.Mon.defaultMoves(mon);
    mon.hp = MB.Mon.stats(mon).hp;
    return mon;
  },
  defaultMoves(mon) {
    const sp = MB.SP[mon.sp];
    const learn = sp.learn.filter(([l]) => l <= mon.lvl).map(([, id]) => id);
    const last = learn.slice(-4);
    // make sure at least one damaging move
    if (!last.some((id) => MB.MOVES[id].power > 0)) { const dmg = learn.find((id) => MB.MOVES[id].power > 0) || 'tackle'; last[0] = dmg; }
    mon.moves = [...new Set(last)].map((id) => ({ id, pp: MB.MOVES[id].pp }));
  },
  stats(mon, megaBase) {
    const sp = MB.SP[mon.sp];
    const base = megaBase || sp.base;
    const nat = MB.NATURES[mon.nature] || MB.NATURES[0];
    const out = {};
    for (const k of MB.STAT_KEYS) {
      const iv = Math.min(31, mon.ivs[k] + (mon.bonus && mon.bonus[k] ? mon.bonus[k] : 0));
      const effort = (mon.bonus && mon.bonus['e' + k]) || 0;
      if (k === 'hp') out.hp = Math.floor(((2 * base.hp + iv + effort) * mon.lvl) / 100) + mon.lvl + 10;
      else {
        let v = Math.floor(((2 * base[k] + iv + effort) * mon.lvl) / 100) + 5;
        if (nat[1] === k) v = Math.floor(v * 1.1);
        if (nat[2] === k) v = Math.floor(v * 0.9);
        out[k] = v;
      }
    }
    return out;
  },
  maxHp(mon) { return MB.Mon.stats(mon).hp; },
  abilityId(mon) { const sp = MB.SP[mon.sp]; return sp.abilities[mon.ability] || sp.abilities[0]; },
  heal(mon) { mon.hp = MB.Mon.maxHp(mon); mon.status = null; for (const m of mon.moves) m.pp = MB.MOVES[m.id].pp + (m.ppUp || 0); },
  isEgg(mon) { return !!mon.egg; },
  // Gains exp; returns array of events [{type:'level', lvl}, {type:'move', id}, ...]
  gainExp(mon, amount) {
    const sp = MB.SP[mon.sp];
    const ev = [];
    if (mon.lvl >= 100) return ev;
    mon.exp += amount;
    while (mon.lvl < 100 && mon.exp >= MB.Mon.expFor(sp.growth, mon.lvl + 1)) {
      const before = MB.Mon.stats(mon);
      mon.lvl++;
      const after = MB.Mon.stats(mon);
      mon.hp += after.hp - before.hp;
      mon.friend = Math.min(255, mon.friend + 2);
      ev.push({ type: 'level', lvl: mon.lvl, before, after });
      for (const [l, id] of sp.learn) if (l === mon.lvl && !mon.moves.some((m) => m.id === id)) ev.push({ type: 'move', id });
    }
    return ev;
  },
  learnMove(mon, id, replaceIdx) {
    if (mon.moves.some((m) => m.id === id)) return false;
    if (mon.moves.length < 4) mon.moves.push({ id, pp: MB.MOVES[id].pp });
    else if (replaceIdx !== undefined && replaceIdx >= 0) mon.moves[replaceIdx] = { id, pp: MB.MOVES[id].pp };
    else return false;
    return true;
  },
  // check evolution triggered by level/friendship/location after level-up
  checkEvolution(mon, ctx = {}) {
    const sp = MB.SP[mon.sp];
    if (mon.item === 'stillstone') return null;
    for (const e of sp.evo) {
      if (e.time && e.time !== ctx.time) continue;
      if (e.m === 'level' && mon.lvl >= e.v) return e.to;
      if (e.m === 'friend' && mon.friend >= 220) return e.to;
      if (e.m === 'loc' && ctx.locTags && ctx.locTags.includes(e.v) && mon.lvl >= e.lvl) return e.to;
      if (e.m === 'quest' && ctx.flags && ctx.flags[e.v]) return e.to;
    }
    return null;
  },
  itemEvolution(mon, item, ctx = {}) {
    const sp = MB.SP[mon.sp];
    for (const e of sp.evo) if (e.m === 'item' && e.v === item && (!e.time || e.time === ctx.time)) return e.to;
    return null;
  },
  evolve(mon, toKey) {
    const old = MB.SP[mon.sp];
    const before = MB.Mon.stats(mon);
    const wasNick = mon.name !== old.name;
    mon.sp = toKey;
    const after = MB.Mon.stats(mon);
    mon.hp = Math.max(1, mon.hp + after.hp - before.hp);
    if (!wasNick) mon.name = MB.SP[toKey].name;
    // learn evolution-level moves
    const nsp = MB.SP[toKey];
    const news = nsp.learn.filter(([l]) => l === mon.lvl || l === 1).map(([, id]) => id).filter((id) => !mon.moves.some((m) => m.id === id));
    return news;
  },
  summaryTypes(mon, mega) { const sp = MB.SP[mon.sp]; return mega && sp.mega ? sp.mega.types : sp.types; },
  // egg creation
  makeEgg(spKey, opts = {}) {
    const sp = MB.SP[spKey];
    const mon = MB.Mon.create(spKey, 1, opts);
    mon.egg = { steps: Math.round(sp.bst * 6 + (sp.rarity === 'r' || sp.rarity === 'vr' ? 1500 : 0)) };
    mon.name = 'Egg';
    return mon;
  },
};
