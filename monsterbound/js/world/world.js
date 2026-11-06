'use strict';
// World runtime: builds maps from specs, resolves exits/portals/buildings, manages time, seasons,
// weather, world events and wild encounter tables.
MB.World = (function () {
  const maps = {};
  const SPEC = () => MB.WORLD_SPECS;

  // ---------------- clock / season / weather ----------------
  function clock() { return MB.state ? MB.state.clock : 600; }
  function timeOfDay() {
    const h = Math.floor(clock() / 60) % 24;
    if (h >= 6 && h < 10) return 'morning';
    if (h >= 10 && h < 17) return 'day';
    if (h >= 17 && h < 20) return 'evening';
    return 'night';
  }
  const isNight = () => timeOfDay() === 'night';
  const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
  function season() { return MB.state ? SEASONS[Math.floor(MB.state.day / 7) % 4] : 'spring'; }
  function dayOfWeek() { return MB.state ? MB.state.day % 7 : 0; }
  const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  function weatherFor(map) {
    if (!map || map.indoor || map.kind === 'cave') return map && map.forceWeather ? map.forceWeather : 'clear';
    if (map.forceWeather) return map.forceWeather;
    const r = new MB.RNG('wx:' + map.id + ':' + (MB.state ? MB.state.day : 0) + ':' + Math.floor(clock() / 360));
    const s = season();
    const th = map.theme;
    if (th === 'desert') return r.chance(0.35) ? 'sand' : r.chance(0.3) ? 'sun' : 'clear';
    if (th === 'snow') return r.chance(0.5) ? 'snow' : r.chance(0.15) ? 'blizzard' : r.chance(0.15) ? 'fog' : 'clear';
    if (th === 'volcano') return r.chance(0.6) ? 'ash' : 'clear';
    if (th === 'marsh') return r.chance(0.45) ? 'fog' : r.chance(0.25) ? 'rain' : 'clear';
    if (th === 'rift') return 'motes';
    if (s === 'winter' && r.chance(0.45)) return 'snow';
    if (s === 'autumn' && r.chance(0.35)) return 'leaves';
    if (s === 'spring' && r.chance(0.3)) return 'petals';
    if (th === 'beach' || th === 'sea' || map.stormy) return r.chance(0.25) ? 'storm' : r.chance(0.25) ? 'rain' : 'clear';
    if (r.chance(0.18)) return 'rain';
    if (s === 'summer' && r.chance(0.2)) return 'sun';
    if (r.chance(0.05)) return 'fog';
    return 'clear';
  }
  // battle weather from overworld weather
  function battleWeather(w) { return { rain: 'rain', storm: 'rain', snow: 'snow', blizzard: 'snow', sand: 'sand', sun: 'sun' }[w] || null; }

  // ---------------- world events (rolled daily) ----------------
  function events() {
    const S = MB.state; if (!S) return [];
    if (S._evDay === S.day && S._ev) return S._ev;
    const r = new MB.RNG('events:' + S.day + ':' + S.trainerId);
    const ev = [];
    const outdoor = Object.values(SPEC()).filter((s) => (s.type === 'route' || s.type === 'forest') && s.region === (S.region || 'A') && s.wild && s.wild.habitats && !s.postgame);
    const visited = outdoor.filter((s) => S.visited[s.id]);
    const pool = visited.length ? visited : outdoor.slice(0, 3);
    if (pool.length) {
      const m = r.pick(pool);
      const cands = MB.SPECIES.filter((sp) => !sp.legendary && !sp.eggOnly && !sp.fossil && sp.stage === 0 && sp.region === m.region && (sp.rarity === 'r' || sp.rarity === 'u'));
      if (cands.length) ev.push({ type: 'outbreak', map: m.id, sp: r.pick(cands).key, text: '' });
    }
    const towns = Object.values(SPEC()).filter((s) => (s.type === 'town') && s.region === (S.region || 'A') && S.visited[s.id]);
    if (towns.length && r.chance(0.6)) ev.push({ type: 'merchant', map: r.pick(towns).id });
    if (S.day % 4 === 2) ev.push({ type: 'meteor' });
    if (S.day % 7 === 0) ev.push({ type: 'festival', season: season() });
    if (dayOfWeek() >= 5) ev.push({ type: 'tournament' });
    if (pool.length && r.chance(0.5)) ev.push({ type: 'glitter', map: r.pick(pool).id, item: r.pick(['rare_candy', 'nugget', 'big_pearl', 'comet_piece', 'ancient_coin', 'ultra_capsule', 'max_revive', 'heart_scale']) });
    if (S.flags.champion && pool.length) {
      const roam = ['pyrrhawk', 'glaciwing', 'voltacrest'].filter((k) => S.flags['roam_' + k] && !S.flags['caught_' + k]);
      if (roam.length) ev.push({ type: 'legend', map: r.pick(pool).id, sp: r.pick(roam) });
    }
    for (const e of ev) {
      const mapName = e.map && SPEC()[e.map] ? SPEC()[e.map].name : '';
      e.text = e.type === 'outbreak' ? `Mass outbreak of ${MB.SP[e.sp].name} on ${mapName}!` : e.type === 'merchant' ? `A traveling merchant is visiting ${mapName}.` : e.type === 'meteor' ? 'A meteor shower is forecast tonight!' : e.type === 'festival' ? `The ${MB.cap(e.season)} Festival is on in every town!` : e.type === 'tournament' ? 'Weekend tournament at the Battle Frontier!' : e.type === 'glitter' ? `Something glitters on ${mapName}...` : e.type === 'legend' ? `A legendary ${MB.SP[e.sp].name} was sighted on ${mapName}!` : '';
    }
    S._ev = ev; S._evDay = S.day;
    return ev;
  }

  // ---------------- encounter tables ----------------
  const tcache = {};
  const RW = { c: 40, u: 16, r: 5, vr: 1.6, anc: 2 };
  function table(map, kind) {
    const tod = timeOfDay(), night = tod === 'night';
    const S = MB.state;
    const k = map.id + kind + (night ? 'n' : 'd') + season() + (S && S.flags.champion ? 'pg' : '');
    if (tcache[k]) return tcache[k];
    const W = map.wild || {};
    let habs = kind === 'water' ? W.water || ['lake'] : W.habitats || [];
    const [lo, hi] = W.lvl || [3, 6];
    const region = map.region;
    const list = [];
    for (const sp of MB.SPECIES) {
      if (sp.legendary || sp.eggOnly || sp.fossil) continue;
      if (sp.region !== region && !(S && S.flags.champion && W.mixed)) continue;
      if (!sp.habitats.some((h) => habs.includes(h))) continue;
      if (kind === 'water' && !sp.water && !sp.types.includes('Aqua')) continue;
      if (kind !== 'water' && sp.water) continue;
      if (sp.night && !night) continue;
      if (sp.day && night) continue;
      // stage appropriateness
      const evoLvl = (() => { if (!sp.prev) return 0; const p = MB.SP[sp.prev]; const e = p.evo.find((x) => x.to === sp.key); return e && e.m === 'level' ? e.v : 30 + sp.stage * 8; })();
      if (sp.stage > 0 && hi < evoLvl - 2) continue;
      if (sp.stage === 0 && sp.nStages > 1 && lo > 45) continue;
      let w = RW[sp.rarity] || 10;
      if (sp.stage > 0) w *= 0.45;
      if (season() === 'winter' && sp.types.includes('Ice')) w *= 1.8;
      if (season() === 'summer' && (sp.types.includes('Flame') || sp.types.includes('Nature'))) w *= 1.4;
      if (season() === 'autumn' && (sp.types.includes('Spirit') || sp.types.includes('Shadow'))) w *= 1.5;
      if (season() === 'spring' && (sp.types.includes('Light') || sp.types.includes('Nature'))) w *= 1.4;
      list.push({ sp: sp.key, w, lo: Math.max(lo, sp.stage > 0 ? evoLvl : 1), hi: Math.max(hi, sp.stage > 0 ? evoLvl : 1) });
    }
    for (const ex of W.extra || []) if (!ex.night || night) list.push({ sp: ex.sp, w: ex.w || 5, lo: ex.lo || lo, hi: ex.hi || hi });
    tcache[k] = list;
    return list;
  }
  function rollWild(map, kind) {
    const S = MB.state;
    let list = table(map, kind);
    const ev = events();
    const ob = ev.find((e) => e.type === 'outbreak' && e.map === map.id);
    if (ob && kind === 'grass' && Math.random() < 0.4) { const [lo, hi] = map.wild.lvl; return { sp: ob.sp, lvl: MB.randInt(lo, hi) }; }
    const lg = ev.find((e) => e.type === 'legend' && e.map === map.id);
    if (lg && kind === 'grass' && Math.random() < 0.06) return { sp: lg.sp, lvl: 55, legendary: true, roam: true };
    if (ev.some((e) => e.type === 'meteor') && isNight() && (map.theme === 'sky' || map.id === 'starfall') && Math.random() < 0.15) return { sp: MB.pick(['cometling', 'nebulite', 'starfawn']), lvl: MB.randInt(map.wild.lvl[0], map.wild.lvl[1] + 3) };
    if (!list.length) return null;
    const lure = S.lure > 0;
    const pick = MB.rng.weighted(list, (e) => e.w * (lure && MB.SP[e.sp].rarity !== 'c' ? 2 : 1));
    return { sp: pick.sp, lvl: MB.randInt(pick.lo, pick.hi) };
  }

  // ---------------- map building ----------------
  function get(id) {
    if (maps[id]) return maps[id];
    let spec = SPEC()[id];
    if (!spec) {
      // interiors are registered when their parent map is built
      const parent = Object.values(SPEC()).find((sp) => (sp.buildings || []).some((b) => b.id === id) || (id.startsWith(sp.id + '_')));
      if (parent) { get(parent.id); spec = SPEC()[id]; }
    }
    if (!spec) throw new Error('No map spec: ' + id);
    // clone exits since generator mutates
    const s = Object.assign({}, spec, { exits: (spec.exits || []).map((e) => Object.assign({}, e)) });
    let m;
    if (spec.type === 'town') m = MB.MapGen.town(s);
    else if (spec.type === 'route' || spec.type === 'forest') m = MB.MapGen.route(Object.assign({ trees: spec.type === 'forest' ? 1.6 : undefined, grass: spec.type === 'forest' ? 0.9 : undefined }, s));
    else if (spec.type === 'cave') m = MB.MapGen.cave(Object.assign({ ladders: (spec.portals || []).map((p) => Object.assign({}, p)) }, s));
    else if (spec.type === 'interior') m = MB.MapGen.interior(s);
    else if (spec.type === 'gym') m = MB.MapGen.gym(s);
    else if (spec.type === 'custom') m = spec.build(s);
    Object.assign(m, {
      name: spec.name, region: spec.region, theme: spec.theme || 'meadow', music: spec.music, env: spec.env || 'grass', kind: spec.type === 'cave' ? 'cave' : spec.type,
      wild: spec.wild, dark: spec.dark || s.dark, spec, parent: spec.parent, npcs: [], items: [], signs: [], portals: [], warps: [], triggers: [], buildings: m.buildings || [],
      teleports: s.teleports || spec.teleports, switches: s.switches, freePush: spec.type === 'gym', forceWeather: spec.weather, stormy: spec.stormy,
    });
    injectStandard(spec, m);
    if (spec.type === 'cave' && m.ladders) m.portals = m.ladders.map((l) => ({ id: l.id, to: l.to, toPortal: l.toPortal, x: l.x, y: l.y }));
    decorate(m, s);
    maps[id] = m;
    return m;
  }
  function injectStandard(spec, m) {
    if (spec._injected) return;
    spec._injected = true;
    spec.npcs = (spec.npcs || []).slice();
    if (spec.kind === 'center') spec.npcs.unshift({ id: spec.id + ':nurse', at: 'counter', kind: 'nurse', script: 'nurse', name: 'Nurse' });
    if (spec.kind === 'shop') spec.npcs.unshift({ id: spec.id + ':clerk', at: 'counter', kind: 'clerk', script: 'shop:' + (spec.shop || 't1'), name: 'Clerk' });
    if (spec.type === 'gym' && spec.gymData) {
      const G = spec.gymData, L = MB.BOSSES[G.leader];
      const app = MB.Chars.typedApp(L.type === 'Mixed' ? 'Normal' : L.type, G.leader, { hairStyle: ['long', 'spiky', 'short', 'bun'][G.leader.length % 4] });
      (G.trainers || []).forEach(([cls, types, n, lvl], i) => spec.npcs.push({ id: spec.id + ':t' + i, at: 'trainerSpot', kind: MB.CLASS_APP[cls], trainer: { cls, types, n, lvl, pre: 'You\'ll have to get past me to reach ' + L.name + '!' }, sight: 3, dir: i % 2 ? 'left' : 'right' }));
      spec.npcs.push({ id: spec.id + ':leader', at: 'leader', name: L.name, app, script: 'leader:' + G.leader, dir: 'down' });
      spec.npcs.push({ id: spec.id + ':guide', at: [8, m.h - 3], kind: 'ace', name: 'Gym Guide', talk: [`This is the ${spec.name}! Leader ${L.name} uses ${L.type}-type creatures.`, `${L.type} types are weak to ${MB.TYPES.filter((t) => MB.typeEff(t, [L.type]) > 1).join(', ') || 'clever strategy'}.`, MB.GYM_TIPS[spec.puzzle] || 'Good luck!'] });
    }
  }
  function freeSpot(m, r, pred) {
    const cands = [];
    for (let y = 2; y < m.h - 2; y++) for (let x = 2; x < m.w - 2; x++) {
      const c = m.tiles[y][x];
      if (!(c === '.' || c === ':' || c === '=' || c === 'G' || c === '_' || c === 's' || c === 'F' || c === ',' && pred && pred.grassOk)) continue;
      if (m.npcs.some((n) => n.x === x && n.y === y) || m.items.some((n) => n.x === x && n.y === y)) continue;
      if (m.exits.some((e) => Math.abs(e.inner[0] - x) + Math.abs(e.inner[1] - y) < 3)) continue;
      if (pred && pred.fn && !pred.fn(x, y, c)) continue;
      cands.push([x, y]);
    }
    return cands.length ? r.pick(cands) : null;
  }
  function decorate(m, s) {
    const r = new MB.RNG('deco:' + m.id);
    const spec = m.spec;
    // building interiors / warps
    for (const b of m.buildings) {
      if (!b.id) b.id = m.id + '_' + b.kind + '_' + m.buildings.indexOf(b);
      m.warps.push({ x: b.door.x, y: b.door.y, to: b.id, building: b });
      if (!SPEC()[b.id]) {
        const iSpec = { id: b.id, type: b.kind === 'gym' ? 'gym' : 'interior', kind: b.kind, name: b.name || (b.kind === 'center' ? 'Healing Center' : b.kind === 'shop' ? 'Supply Shop' : b.kind === 'gym' ? m.name + ' Gym' : b.label || m.name), region: m.region, parent: m.id, music: b.kind === 'center' ? 'center' : b.kind === 'gym' ? 'gym' : b.kind === 'lab' ? 'lab' : b.kind === 'hq' ? 'syndicate' : m.spec.music, theme: b.kind === 'gym' ? 'gym' : b.kind === 'lab' ? 'lab' : 'interior', env: b.kind === 'gym' ? 'gym' : 'city', npcs: b.npcs || [], items: b.items || [], puzzle: b.puzzle, gymData: b.gym, shop: b.shop, interior: true };
        SPEC()[b.id] = iSpec;
      }
    }
    // portals (cave entrances placed into walls next to walkable tiles)
    for (const p of spec.portals || []) {
      if (m.kind === 'cave') continue;
      let spot = null;
      const prefer = p.near || null;
      for (let t = 0; t < 500 && !spot; t++) {
        const x = r.int(3, m.w - 4), y = r.int(3, m.h - 5);
        const c = m.tiles[y][x];
        if (!(c === 'T' || c === '#')) continue;
        const below = m.tiles[y + 1][x];
        if (!(below === '.' || below === ':' || below === '=' || below === ',')) continue;
        if (prefer === 'n' && y > m.h / 3) continue;
        if (prefer === 's' && y < (m.h * 2) / 3) continue;
        spot = [x, y];
      }
      if (!spot) { spot = [Math.floor(m.w / 2), 3]; m.tiles[4][spot[0]] = '.'; }
      m.tiles[spot[1]][spot[0]] = p.tile || 'E';
      m.portals.push({ id: p.id, to: p.to, toPortal: p.toPortal, x: spot[0], y: spot[1], cond: p.cond, lockedText: p.lockedText });
    }
    // interior exit mat
    if (m.indoor || spec.interior) {
      for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.tiles[y][x] === 'e') m.warps.push({ x, y, to: spec.parent, exitTo: spec.id });
    }
    // NPCs
    (spec.npcs || []).forEach((n, i) => {
      const npc = Object.assign({ id: n.id || m.id + ':npc' + i, dir: n.dir || 'down', move: n.move || 'still' }, n);
      let pos = null;
      if (Array.isArray(n.at)) pos = n.at.slice();
      else if (n.at === 'counter') {
        let row = -1, xs = [];
        for (let y = 0; y < m.h && row < 0; y++) { xs = []; for (let x = 0; x < m.w; x++) if (m.tiles[y][x] === 'k') xs.push(x); if (xs.length) row = y; }
        if (row >= 0) { const used = m.npcs.filter((q) => q.counter).length; const x = xs[Math.min(xs.length - 1, Math.floor(xs.length / 2) + used * 2)]; pos = [x, Math.max(0, row - 1)]; }
        npc.counter = true;
      } else if (n.at === 'leader' && m.leaderSpot) pos = m.leaderSpot.slice();
      else if (typeof n.at === 'string' && n.at.startsWith('exit:')) {
        const side = n.at.split(':')[1]; const e = m.exits.find((x) => x.side === side);
        if (e) { pos = [e.inner[0], e.inner[1]]; }
      } else if (typeof n.at === 'string' && n.at.startsWith('door:')) {
        const b = m.buildings.find((bb) => bb.id === n.at.slice(5) || bb.kind === n.at.slice(5));
        if (b) pos = (n.script || '').startsWith('gate') ? [b.door.x, b.door.y + 1] : [b.door.x + 1, b.door.y + 1];
      } else if (n.at === 'path' && m.pathCells) {
        for (let t = 0; t < 300 && !pos; t++) {
          const c = r.pick(m.pathCells); const side = r.pick([[-2, 0, 'right'], [2, 0, 'left'], [0, -2, 'down'], [0, 2, 'up'], [-1, 0, 'right'], [1, 0, 'left']]);
          const x = c[0] + side[0], y = c[1] + side[1];
          if (x < 2 || y < 2 || x >= m.w - 2 || y >= m.h - 2) continue;
          const ch = m.tiles[y][x];
          if (!(ch === '.' || ch === ',' || ch === 'F' || ch === ':')) continue;
          if (m.npcs.some((q) => Math.abs(q.x - x) + Math.abs(q.y - y) < 4)) continue;
          if (m.exits.some((e) => Math.abs(e.inner[0] - x) + Math.abs(e.inner[1] - y) < 5)) continue;
          pos = [x, y]; if (!n.dir) npc.dir = side[2];
        }
      } else if (n.at === 'trainerSpot' && m.trainerSpots) { pos = m.trainerSpots[i % m.trainerSpots.length]; }
      if (!pos) pos = freeSpot(m, r, { grassOk: true }) || [Math.floor(m.w / 2), Math.floor(m.h / 2)];
      npc.x = pos[0]; npc.y = pos[1]; npc.homeX = npc.x; npc.homeY = npc.y;
      if (m.tiles[npc.y] && m.tiles[npc.y][npc.x] === ',' && !npc.trainer) m.tiles[npc.y][npc.x] = '.';
      if (!npc.app) npc.app = MB.Chars.randomApp(npc.id, npc.kind);
      m.npcs.push(npc);
    });
    // items
    (spec.items || []).forEach((it, i) => {
      const flag = 'item:' + m.id + ':' + i;
      let pos = Array.isArray(it.at) ? it.at : null;
      if (!pos) pos = freeSpot(m, r, { grassOk: true, fn: (x, y) => !it.hidden || r.chance(0.5) });
      if (!pos) return;
      m.items.push({ x: pos[0], y: pos[1], item: it.item, qty: it.qty || 1, hidden: !!it.hidden, flag, cond: it.cond });
    });
    // alcove items (behind shears / hammer / climb gates)
    (m.alcoves || []).forEach((a, i) => {
      if (!a.gate.item) return;
      m.items.push({ x: a.x, y: a.y, item: a.gate.item, qty: 1, hidden: false, flag: 'alc:' + m.id + ':' + i });
    });
    // signs
    if (m.kind === 'town' || m.kind === 'route' || m.kind === 'forest') {
      const e = m.exits[0];
      if (e) {
        const [x, y] = e.inner;
        const cand = [[x + 2, y], [x - 2, y], [x, y + 2], [x + 2, y + 1]].find(([a, b]) => m.tiles[b] && m.tiles[b][a] === '.');
        if (cand) { m.tiles[cand[1]][cand[0]] = 'S'; m.signs.push({ x: cand[0], y: cand[1], text: spec.sign || `${spec.name}${spec.subtitle ? ' — ' + spec.subtitle : ''}` }); }
      }
    }
    // step triggers
    for (const t of spec.triggers || []) {
      let area = t.area;
      if (t.exit) { const e = m.exits.find((x) => x.side === t.exit); if (e) area = [Math.min(...e.cells.map((c) => c[0])) - 1, Math.min(...e.cells.map((c) => c[1])) - 1, 5, 5]; }
      if (t.portal) { const p = m.portals.find((x) => x.id === t.portal); if (p) area = [p.x - 1, p.y + 1, 3, 2]; }
      if (t.near === 'leader' && m.leaderSpot) area = [m.leaderSpot[0] - 2, m.leaderSpot[1] + 1, 5, 2];
      if (area) m.triggers.push(Object.assign({}, t, { area }));
    }
  }
  function reset() { for (const k in maps) delete maps[k]; for (const k in tcache) delete tcache[k]; }

  // ---------------- queries ----------------
  function tileAt(m, x, y) { if (y < 0 || y >= m.h || x < 0 || x >= m.w) return null; return m.tiles[y][x]; }
  function npcAt(m, x, y) { return m.npcs.find((n) => n.visible !== false && n.x === x && n.y === y); }
  function itemAt(m, x, y) { const S = MB.state; return m.items.find((it) => it.x === x && it.y === y && !S.flags[it.flag]); }
  function mapName() { return MB.state && MB.state.map ? (get(MB.state.map).name || '?') : '?'; }
  function exitFor(m, x, y) { return m.exits.find((e) => e.cells.some(([a, b]) => a === x && b === y)); }

  return { get, reset, maps, tileAt, npcAt, itemAt, timeOfDay, isNight, season, dayOfWeek, DAY_NAMES, weatherFor, battleWeather, events, table, rollWild, mapName, exitFor, SEASONS };
})();
