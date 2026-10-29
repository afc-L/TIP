// Headless campaign: every faction AI-driven, auto-resolve battles. node tools/campaigntest.js [difficulty] [turns]
const path = require('path');
global.window = global;
global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const load = (f) => require(path.join(__dirname, '..', 'js', f));
['core/util.js', 'core/data.js', 'campaign/mapgen.js', 'campaign/state.js', 'campaign/ai.js'].forEach(load);
const RW = global.RW;
const [diff = 'normal', turns = '40'] = process.argv.slice(2);
(async () => {
  const c = RW.Campaign.create('valor', diff);
  c.factions.valor.isPlayer = false; // let AI drive the player too
  let battles = 0;
  const hooks = {
    attack: async (a, tid) => { const s = c.battleSetup(a, tid); const r = c.autoResolve(s); c.applyBattle(a, s, r); battles++; },
    moved: async () => {},
  };
  for (let t = 1; t <= +turns; t++) {
    for (const f of RW.data.PLAYABLE) await RW.campaignAI.runFaction(c, f, hooks);
    c.turn++; c.beginRound();
    if (t % 5 === 0) console.log(`turn ${c.turn}: ` + ['valor', 'horde', 'arcane', 'rebels'].map((f) => `${f}=${c.owned(f).length}t/${c.armiesOf(f).length}a/${c.factions[f].gold}g${c.armiesOf(f).map(a=>a.units.length).join(',')}`).join('  ') + ` battles=${battles}`);
  }
  console.log(c.log.slice(-8).map((l) => l.turn + ': ' + l.text).join('\n'));
})().catch((e) => { console.error(e); process.exit(1); });
