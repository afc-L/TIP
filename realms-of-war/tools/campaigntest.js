// Headless campaign: every faction AI-driven, auto-resolve battles.
// node tools/campaigntest.js [difficulty] [turns] [mode classic|grand|conquest] [playerFaction]
const path = require('path');
global.window = global;
const store = {};
global.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
const load = (f) => require(path.join(__dirname, '..', 'js', f));
['core/util.js', 'core/data.js', 'core/data2.js', 'core/mods.js', 'campaign/mapgen.js', 'campaign/state.js', 'campaign/ai.js'].forEach(load);
const RW = global.RW;
const D = RW.data;
const [diff = 'normal', turns = '40', mode = 'classic', pf = 'valor'] = process.argv.slice(2);
(async () => {
  const c = RW.Campaign.create(pf, diff, null, { mode });
  const m = c.map;
  console.log(`map ${c.mapId}: ${m.territories.length} territories, isolated: ${m.adj.map((a, i) => (a.length ? null : i)).filter((x) => x != null)}; capitals`, c.majors.map((f) => f + '@' + c.factions[f].capital).join(' '));
  c.factions[pf].isPlayer = false; // let AI drive the player too
  let battles = 0;
  const hooks = {
    attack: async (a, tid) => { const s = c.battleSetup(a, tid); const r = c.autoResolve(s); c.applyBattle(a, s, r); battles++; },
    moved: async () => {},
  };
  for (let t = 1; t <= +turns; t++) {
    for (const f of c.majors) await RW.campaignAI.runFaction(c, f, hooks);
    c.turn++; c.beginRound(); c.checkElimination();
    if (c.grand && t % 3 === 0) { c.rollEvent(); const r = c.research(pf, D.techFor(pf).find((x) => !c.factions[pf].techs.includes(x.id) && (!x.req || c.factions[pf].techs.includes(x.req))) ? D.techFor(pf).find((x) => !c.factions[pf].techs.includes(x.id) && (!x.req || c.factions[pf].techs.includes(x.req))).id : 'mil1'); }
    if (t % 5 === 0) console.log(`turn ${c.turn}: ` + c.majors.concat(['rebels']).map((f) => `${f}=${c.owned(f).length}t/${c.armiesOf(f).length}a/${c.factions[f].gold}g`).join(' ') + ` battles=${battles}`);
  }
  const rels = Object.entries(c.relations).filter(([, r]) => r.state !== 'war').map(([k, r]) => k + ':' + r.state);
  console.log('non-war relations:', rels.join(' ') || 'none', '| techs', c.factions[pf].techs.join(','));
  c.save('1');
  const c2 = RW.Campaign.load('1');
  console.log('save/load ok:', c2.turn === c.turn && c2.territories.length === c.territories.length, 'saves:', RW.Campaign.listSaves().map((s) => s.slot).join(','));
  console.log(c.log.slice(-6).map((l) => l.turn + ': ' + l.text).join('\n'));
})().catch((e) => { console.error(e); process.exit(1); });
