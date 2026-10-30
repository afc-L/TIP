const path = require('path');
global.window = global;
const load = (f) => require(path.join(__dirname, '..', 'js', f));
['core/util.js', 'core/data.js', 'core/data2.js', 'core/mods.js', 'battle/terrain.js', 'battle/units.js', 'battle/battle.js', 'battle/abilities.js', 'battle/ai.js'].forEach(load);
const RW = global.RW;
const [mapType = 'grassland', fa = 'valor', fb = 'horde', seed = '1000'] = process.argv.slice(2);
function army(f) {
  const ids = RW.data.FACTIONS[f].startArmy.concat(Object.values(RW.data.UNITS).filter((u) => u.faction === f && u.recruitable && u.tier === 2).map((u) => u.id));
  return ids.map((typeId) => ({ typeId }));
}
const b = new RW.Battle({ mapType, seed: +seed, attackerSide: 0, difficulty: 'normal', aiBoth: true,
  sides: [{ faction: fa, units: army(fa), commander: { name: 'A', level: 1 } }, { faction: fb, units: army(fb), commander: { name: 'B', level: 1 } }] });
b.start();
b.on('message', (m) => console.log(b.time.toFixed(1), m.text));
b.on('charge', (a, c) => console.log(b.time.toFixed(1), 'CHARGE', a.name, '->', c.name));
let next = 0;
while (b.phase === 'battle' && b.time < 600) {
  b.step(0.05);
  if (b.time >= next) { next += 5;
    console.log('t=' + b.time.toFixed(0), b.units.map((u) => `${u.side}:${u.name.slice(0, 8)}:${u.alive}/${u.state.slice(0, 4)}:${u.morale.toFixed(0)}@${u.x.toFixed(0)},${u.z.toFixed(0)}`).join(' | '));
  }
}
console.log(b.result && b.result.winner);
