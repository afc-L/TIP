'use strict';
// Items. cat: heal, capsule, evo, mega, battle, held, key, quest, treasure
// use: function keys interpreted by MB.Items.use (in bag.js)
MB.ITEMS = {};
(function () {
  const I = (id, name, cat, price, desc, extra) => (MB.ITEMS[id] = Object.assign({ id, name, cat, price, desc }, extra || {}));
  // ---- healing ----
  I('potion', 'Potion', 'heal', 200, 'Restores 20 HP.', { heal: 20 });
  I('super_potion', 'Super Potion', 'heal', 600, 'Restores 60 HP.', { heal: 60 });
  I('hyper_potion', 'Hyper Potion', 'heal', 1200, 'Restores 150 HP.', { heal: 150 });
  I('max_potion', 'Max Potion', 'heal', 2500, 'Fully restores HP.', { heal: 9999 });
  I('full_restore', 'Full Restore', 'heal', 3000, 'Fully restores HP and cures status.', { heal: 9999, cure: 'all' });
  I('berry_juice', 'Berry Juice', 'heal', 300, 'A sweet drink. Restores 40 HP.', { heal: 40 });
  I('honey_bun', 'Honey Bun', 'heal', 350, 'A treat. Restores 30 HP and raises friendship.', { heal: 30, friend: 6 });
  I('revive', 'Revive', 'heal', 1500, 'Revives a fainted creature with half HP.', { revive: 0.5 });
  I('max_revive', 'Max Revive', 'heal', 4000, 'Revives a fainted creature with full HP.', { revive: 1 });
  I('antidote', 'Antidote', 'heal', 150, 'Cures poison.', { cure: ['psn', 'tox'] });
  I('burn_salve', 'Burn Salve', 'heal', 200, 'Cures burns.', { cure: ['brn'] });
  I('thaw_spray', 'Thaw Spray', 'heal', 200, 'Thaws a frozen creature.', { cure: ['frz'] });
  I('nerve_tonic', 'Nerve Tonic', 'heal', 200, 'Cures paralysis.', { cure: ['par'] });
  I('wake_bell', 'Wake Chime', 'heal', 200, 'Wakes a sleeping creature.', { cure: ['slp'] });
  I('full_heal', 'Full Heal', 'heal', 500, 'Cures any status condition.', { cure: 'all' });
  I('ether', 'Ether', 'heal', 1200, 'Restores 10 PP to all moves.', { pp: 10 });
  I('elixir', 'Elixir', 'heal', 3000, 'Fully restores PP of all moves.', { pp: 99 });
  I('xp_candy_s', 'XP Candy S', 'heal', 300, 'Gives a creature 100 Exp. Points.', { exp: 100 });
  I('xp_candy_m', 'XP Candy M', 'heal', 1000, 'Gives a creature 800 Exp. Points.', { exp: 800 });
  I('xp_candy_l', 'XP Candy L', 'heal', 3000, 'Gives a creature 3,000 Exp. Points.', { exp: 3000 });
  I('xp_candy_xl', 'XP Candy XL', 'heal', 8000, 'Gives a creature 10,000 Exp. Points.', { exp: 10000 });
  I('rare_candy', 'Rare Candy', 'heal', 4800, 'Raises a creature by one level.', { levelUp: 1 });
  I('vigor_tonic', 'Vigor Tonic', 'heal', 9800, 'Raises the potential (IVs) of HP.', { vitamin: 'hp' });
  I('power_tonic', 'Power Tonic', 'heal', 9800, 'Raises the potential of Attack.', { vitamin: 'atk' });
  I('guard_tonic', 'Guard Tonic', 'heal', 9800, 'Raises the potential of Defense.', { vitamin: 'def' });
  I('mind_tonic', 'Mind Tonic', 'heal', 9800, 'Raises the potential of Sp. Atk.', { vitamin: 'spa' });
  I('spirit_tonic', 'Spirit Tonic', 'heal', 9800, 'Raises the potential of Sp. Def.', { vitamin: 'spd' });
  I('swift_tonic', 'Swift Tonic', 'heal', 9800, 'Raises the potential of Speed.', { vitamin: 'spe' });
  I('wild_ward', 'Wild Ward', 'heal', 400, 'Keeps weak wild creatures away for 150 steps.', { repel: 150, field: true });
  I('max_ward', 'Max Ward', 'heal', 900, 'Keeps weak wild creatures away for 300 steps.', { repel: 300, field: true });
  I('dungeon_rope', 'Dungeon Rope', 'heal', 500, 'Escape instantly from a cave or dungeon.', { escape: true, field: true });
  I('lure_incense', 'Lure Incense', 'heal', 1200, 'Doubles wild encounters and rare chances for 120 steps.', { lure: 120, field: true });
  // ---- capsules ----
  I('basic_capsule', 'Basic Capsule', 'capsule', 200, 'A standard capsule for capturing creatures.', { ball: 1 });
  I('great_capsule', 'Great Capsule', 'capsule', 600, 'A higher-quality capsule. 1.5x catch rate.', { ball: 1.5 });
  I('ultra_capsule', 'Ultra Capsule', 'capsule', 1200, 'A superb capsule. 2x catch rate.', { ball: 2 });
  I('night_capsule', 'Night Capsule', 'capsule', 1000, 'Works 3.5x better at night or in caves.', { ball: 'night' });
  I('aqua_capsule', 'Aqua Capsule', 'capsule', 1000, 'Works 3.5x better on Aqua creatures or while surfing.', { ball: 'aqua' });
  I('swift_capsule', 'Swift Capsule', 'capsule', 1000, 'Works 5x better if thrown on the first turn.', { ball: 'swift' });
  I('ancient_capsule', 'Ancient Capsule', 'capsule', 3000, 'An Aether-forged relic. 4x on ancient or rare creatures.', { ball: 'ancient' });
  I('legendary_capsule', 'Legendary Capsule', 'capsule', 0, 'A capsule of pure Aether. 8x on legendaries, 3x otherwise.', { ball: 'legend' });
  I('master_capsule', 'Prime Capsule', 'capsule', 0, 'Never fails. Only one exists in each region.', { ball: 255 });
  // ---- evolution ----
  I('ember_shard', 'Ember Shard', 'evo', 2100, 'A warm stone that evolves certain creatures.', { evoItem: true });
  I('aqua_shard', 'Aqua Shard', 'evo', 2100, 'A cool, wet stone that evolves certain creatures.', { evoItem: true });
  I('frost_shard', 'Frost Shard', 'evo', 2100, 'An icy stone that evolves certain creatures.', { evoItem: true });
  I('volt_shard', 'Volt Shard', 'evo', 2100, 'A crackling stone that evolves certain creatures.', { evoItem: true });
  I('sun_shard', 'Sun Shard', 'evo', 2100, 'A radiant stone that evolves certain creatures.', { evoItem: true });
  I('dusk_shard', 'Dusk Shard', 'evo', 2100, 'A shadowy stone that evolves certain creatures.', { evoItem: true });
  I('bond_cord', 'Bond Cord', 'evo', 3000, 'A cord of shared Aether. Evolves creatures that would evolve through trust.', { evoItem: true });
  // ---- battle (single-use) ----
  for (const [s, n] of [['atk', 'Attack'], ['def', 'Defense'], ['spa', 'Sp. Atk'], ['spd', 'Sp. Def'], ['spe', 'Speed'], ['acc', 'Accuracy']])
    I('x_' + s, 'X ' + n, 'battle', 500, `Sharply raises ${n} during battle.`, { xstat: s });
  I('guard_spec', 'Crit Lens', 'battle', 700, 'Raises the critical-hit ratio during battle.', { critUp: true });
  // ---- held items ----
  I('spring_moss', 'Spring Moss', 'held', 4000, 'Held: restores 1/16 HP each turn.');
  I('power_charm', 'Power Charm', 'held', 6000, 'Held: moves deal 30% more damage but cost 10% HP.');
  I('scholar_charm', 'Scholar Charm', 'held', 5000, 'Held: earns 50% more experience.');
  I('last_stand_band', 'Last Stand Band', 'held', 4000, 'Held: survives a KO hit from full HP with 1 HP.');
  I('quick_feather', 'Quick Feather', 'held', 3000, 'Held: sometimes allows the holder to move first.');
  I('stillstone', 'Stillstone', 'held', 800, 'Held: prevents evolution.');
  I('comfort_bell', 'Comfort Bell', 'held', 2500, 'Held: friendship grows faster.');
  I('fortune_coin', 'Fortune Coin', 'held', 8000, 'Held: doubles prize money from battles.');
  I('focus_lens', 'Focus Lens', 'held', 4000, "Held: raises the holder's critical-hit ratio.");
  I('shell_plate', 'Shell Plate', 'held', 4000, 'Held: reduces super-effective damage by 20%.');
  I('swift_boots', 'Swift Boots', 'held', 4000, 'Held: Speed is raised by 20%.');
  I('ever_glow', 'Ever Glow', 'held', 5000, 'Held by an unevolved creature: raises defenses by 50%.');
  for (const t of MB.TYPES) I(t.toLowerCase() + '_sigil', t + ' Sigil', 'held', 3000, `Held: ${t} moves are 20% stronger.`, { typeBoost: t });
  // ---- key items ----
  I('aetherdex', 'Aetherdex', 'key', 0, 'A device that records data on every creature you encounter.');
  I('town_map', 'Town Map', 'key', 0, 'A map of the region. Press M to view.');
  I('aether_gauntlet', 'Aether Gauntlet', 'key', 0, 'An ancient gauntlet. Lets a creature holding its Aether Stone Mega Evolve once per battle.');
  I('exp_link', 'Exp. Link', 'key', 0, 'Your whole party earns 25% more experience from battles.');
  I('running_shoes', 'Trail Shoes', 'key', 0, 'Hold Shift to run.');
  I('trail_bike', 'Trail Bike', 'key', 0, 'A folding bike. Use it from the bag to ride twice as fast.', { field: true, bike: true });
  I('aqua_saddle', 'Aqua Saddle', 'key', 0, 'Lets your creatures carry you across water. Face water and press Z.');
  I('climb_claws', 'Climbing Claws', 'key', 0, 'Lets you scale rocky cliff faces marked with handholds.');
  I('shears', 'Garden Shears', 'key', 0, 'Clears small thorny bushes that block paths.');
  I('pick_hammer', 'Pick Hammer', 'key', 0, 'Breaks cracked boulders.');
  I('power_gloves', 'Power Gloves', 'key', 0, 'Lets you push heavy boulders.');
  I('glow_lantern', 'Glow Lantern', 'key', 0, 'Lights up pitch-dark caves.');
  I('dive_gear', 'Dive Gear', 'key', 0, 'Lets you dive into deep water (dark blue).');
  I('wing_whistle', 'Wing Whistle', 'key', 0, 'Summons a flying creature to carry you to any visited town. Use from the Map.');
  I('fishing_rod', 'Fishing Rod', 'key', 0, 'Face water and use it to fish for aquatic creatures.', { field: true, rod: true });
  I('rift_lens', 'Rift Lens', 'key', 0, 'Press R to shift between the Bright and Gloam phases of Velorian rifts.');
  I('veloria_pass', 'Veloria Pass', 'key', 0, 'A ship ticket from Stormport to Halcyon Harbor in Veloria.');
  I('star_shard', 'Star Shard', 'quest', 0, 'One of the fragments of the original creature. Collect them all.');
  I('egg_incubator', 'Egg Warmer', 'key', 0, 'Eggs in the party hatch twice as fast.');
  I('radiant_charm', 'Radiant Charm', 'key', 0, 'Triples the chance of meeting Radiant (shiny) creatures.');
  I('syndicate_badge', 'Syndicate Keycard', 'quest', 0, 'An Eclipse Syndicate keycard. Opens their laboratory doors.');
  I('rival_letter', "Rival's Letter", 'quest', 0, 'A letter left by your rival.');
  // ---- fossils ----
  I('fin_fossil', 'Fin Fossil', 'treasure', 0, 'The fossil of an ancient sea creature.', { fossil: 'fossilfin' });
  I('amber_wing', 'Amber Wing', 'treasure', 0, 'An ancient wing preserved in amber.', { fossil: 'ambrawing' });
  I('shell_fossil', 'Trilo Fossil', 'treasure', 0, 'The fossil of an armored ancient creature.', { fossil: 'trilobix' });
  // ---- treasures (sellable) ----
  I('nugget', 'Gold Nugget', 'treasure', 0, 'A nugget of pure gold. Sells for a high price.', { sell: 5000 });
  I('pearl', 'Pearl', 'treasure', 0, 'A lustrous pearl.', { sell: 1400 });
  I('big_pearl', 'Big Pearl', 'treasure', 0, 'A large, shining pearl.', { sell: 3750 });
  I('star_dust', 'Star Dust', 'treasure', 0, 'Sparkling sand from Starfall.', { sell: 1000 });
  I('comet_piece', 'Comet Piece', 'treasure', 0, 'A fragment of a comet.', { sell: 6000 });
  I('ancient_coin', 'Ancient Coin', 'treasure', 0, 'A coin of the lost Aether civilization.', { sell: 2500 });
  I('relic_vase', 'Relic Vase', 'treasure', 0, 'A vase from the ancient kingdom.', { sell: 8000 });
  I('relic_crown', 'Relic Crown', 'treasure', 0, 'The crown of an ancient monarch.', { sell: 30000 });
  I('rift_crystal', 'Rift Crystal', 'treasure', 0, 'A crystal formed inside a Velorian rift.', { sell: 3000 });
  I('obsidian_chip', 'Obsidian Chip', 'treasure', 0, 'Volcanic glass from Veloria.', { sell: 1500 });
  I('mushroom_cap', 'Glow Mushroom', 'treasure', 0, 'A rare glowing mushroom.', { sell: 800 });
  I('heart_scale', 'Heart Scale', 'treasure', 0, 'A pretty scale. A move tutor will accept it.', { sell: 100 });
  // ---- mega stones (one per Mega-capable species) ----
  for (const sp of MB.MEGA_SPECIES) I(sp.mega.stone, sp.name + ' Stone', 'mega', 0, `An Aether Stone attuned to ${sp.name}. Hold it with the Aether Gauntlet to Mega Evolve.`, { megaFor: sp.key });
})();

MB.SHOPS_BASE = {
  t1: ['basic_capsule', 'potion', 'antidote', 'nerve_tonic', 'wild_ward'],
  t2: ['basic_capsule', 'great_capsule', 'potion', 'super_potion', 'antidote', 'burn_salve', 'nerve_tonic', 'wake_bell', 'wild_ward', 'dungeon_rope'],
  t3: ['basic_capsule', 'great_capsule', 'ultra_capsule', 'super_potion', 'hyper_potion', 'revive', 'full_heal', 'thaw_spray', 'max_ward', 'dungeon_rope', 'ether'],
  t4: ['great_capsule', 'ultra_capsule', 'hyper_potion', 'max_potion', 'full_restore', 'revive', 'full_heal', 'max_ward', 'ether', 'elixir', 'lure_incense'],
  capsule: ['night_capsule', 'aqua_capsule', 'swift_capsule', 'great_capsule', 'ultra_capsule'],
  battle: ['x_atk', 'x_def', 'x_spa', 'x_spd', 'x_spe', 'x_acc', 'guard_spec'],
  held: ['spring_moss', 'power_charm', 'scholar_charm', 'last_stand_band', 'quick_feather', 'stillstone', 'comfort_bell', 'focus_lens', 'shell_plate', 'swift_boots'],
  sigil: MB.TYPES.map((t) => t.toLowerCase() + '_sigil'),
  evo: ['ember_shard', 'aqua_shard', 'frost_shard', 'volt_shard', 'sun_shard', 'dusk_shard'],
  tonic: ['vigor_tonic', 'power_tonic', 'guard_tonic', 'mind_tonic', 'spirit_tonic', 'swift_tonic', 'rare_candy'],
  food: ['berry_juice', 'honey_bun', 'potion', 'super_potion'],
  merchant: ['ancient_capsule', 'rare_candy', 'bond_cord', 'ever_glow', 'fortune_coin', 'elixir', 'max_revive', 'lure_incense'],
  frontier: ['rare_candy', 'ever_glow', 'power_charm', 'last_stand_band', 'spring_moss', 'ancient_capsule', 'vigor_tonic', 'power_tonic', 'mind_tonic', 'swift_tonic'],
};

// XP Candy is sold in every shop; bigger candies in later towns and specialty shops.
MB.SHOPS = MB.SHOPS_BASE;
(function () {
  const C = { t1: ['xp_candy_s'], t2: ['xp_candy_s', 'xp_candy_m'], t3: ['xp_candy_s', 'xp_candy_m', 'xp_candy_l'], t4: ['xp_candy_s', 'xp_candy_m', 'xp_candy_l', 'xp_candy_xl'], merchant: ['xp_candy_l', 'xp_candy_xl'], frontier: ['xp_candy_l', 'xp_candy_xl'] };
  for (const k in MB.SHOPS) { const add = C[k] || ['xp_candy_s', 'xp_candy_m']; for (const id of add) if (!MB.SHOPS[k].includes(id)) MB.SHOPS[k].push(id); }
})();
