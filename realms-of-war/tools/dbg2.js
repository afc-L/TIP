const path = require('path');
global.window = global;
const load = (f) => require(path.join(__dirname, '..', 'js', f));
['core/util.js', 'core/data.js', 'core/data2.js', 'core/mods.js', 'battle/terrain.js', 'battle/units.js', 'battle/battle.js', 'battle/abilities.js', 'battle/ai.js'].forEach(load);
const RW = global.RW;
const orig = RW.Unit.prototype.damage;
RW.Unit.prototype.damage = function (amt, px, pz, src) {
  const before = this.alive;
  const k = orig.call(this, amt, px, pz, src);
  if (before - this.alive >= 6) console.log(this.battle.time.toFixed(2), 'BIG', this.name, before, '->', this.alive, 'amt', amt.toFixed(0), 'src', src && src.name, new Error().stack.split('\n')[2].trim());
  return k;
};
function army(f) {
  const ids = RW.data.FACTIONS[f].startArmy.concat(Object.values(RW.data.UNITS).filter((u) => u.faction === f && u.recruitable && u.tier === 2).map((u) => u.id));
  return ids.map((typeId) => ({ typeId }));
}
const b = new RW.Battle({ mapType: 'grassland', seed: 1000, attackerSide: 0, difficulty: 'normal', aiBoth: true,
  sides: [{ faction: 'valor', units: army('valor'), commander: { name: 'A', level: 1 } }, { faction: 'horde', units: army('horde'), commander: { name: 'B', level: 1 } }] });
b.start();
while (b.phase === 'battle' && b.time < 40) b.step(0.05);
