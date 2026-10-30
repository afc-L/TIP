// Headless battle balance test: node tools/simtest.js [mapType] [factionA] [factionB] [difficulty]
const path = require('path');
global.window = global;
global.performance = global.performance || { now: () => Date.now() };
const load = (f) => require(path.join(__dirname, '..', 'js', f));
['core/util.js', 'core/data.js', 'core/data2.js', 'core/mods.js', 'battle/terrain.js', 'battle/units.js', 'battle/battle.js', 'battle/abilities.js', 'battle/ai.js'].forEach(load);
const RW = global.RW;
const [mapType = 'grassland', fa = 'valor', fb = 'horde', diff = 'normal', runs = '3'] = process.argv.slice(2);
const BUDGET = +(process.env.BUDGET || 7000);
function army(f) {
  return RW.data.genArmy(f, BUDGET, 3).map((typeId) => ({ typeId }));
}
let wins = [0, 0]; const killsBy = {};
for (let r = 0; r < +runs; r++) {
  const b = new RW.Battle({ mapType, seed: 1000 + r, attackerSide: 0, difficulty: diff, difficulty0: process.env.DIFF0, aiBoth: true,
    sides: [{ faction: fa, units: army(fa), commander: { name: 'A', level: 1 } }, { faction: fb, units: army(fb), commander: { name: 'B', level: 1 } }] });
  b.start();
  const t0 = Date.now(); let steps = 0;
  const routs = [0, 0];
  b.on('rout', (u) => routs[u.side]++);
  while (b.phase === 'battle' && b.time < 1500) { b.step(0.05); steps++; }
  const ms = (Date.now() - t0) / steps;
  const res = b.result;
  for (const u of b.units) killsBy[u.name.length < 3 ? 'General' + u.side : u.name] = (killsBy[u.name.length < 3 ? 'General' + u.side : u.name] || 0) + u.kills;
  wins[res.winner]++;
  console.log(`${mapType} ${fa} vs ${fb}: winner=${res.winner === 0 ? fa : fb} reason=${res.reason} time=${res.duration.toFixed(0)}s lost=${res.lost} start=${res.start} routs=${routs} ${ms.toFixed(2)}ms/step`);
  if (res.reason === 'time') console.log(b.units.filter((u) => u.active).map((u) => `${u.side}:${u.name}:${u.state}:${u.order.type}@${u.x.toFixed(0)},${u.z.toFixed(0)} path=${u.path.length}/${u.pathIdx}`).join('\n'));
  const gate = b.map.gate; if (gate) console.log('gate hp', gate.hp.toFixed(0));
}
console.log('wins', wins);
console.log(Object.entries(killsBy).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ':' + Math.round(v / +runs)).join('  '));
