// Static game data: factions, units, abilities, commanders, territories, upgrades.
(function () {
  const RW = window.RW;

  // ---------------------------------------------------------------- Factions
  const FACTIONS = {
    valor: {
      id: 'valor', name: 'Kingdom of Valor', short: 'Valor', adjective: 'Valorian',
      color: '#3a6fd0', color2: '#e9dcae', dark: '#1b2f5c', metal: '#b9c1cc', cloth: '#2f5fb3',
      desc: 'Disciplined human kingdoms sworn to the Dawn Crown. Reliable infantry, deadly longbows, and knights whose charge breaks any line.',
      strengths: 'Balanced roster · Elite cavalry charges · Strong shield infantry',
      weaknesses: 'No monsters · Little magic',
      bonus: { name: 'Chivalric Order', desc: '+15% income from all territories. Settlement upgrades cost 20% less.' },
      abilities: ['rally_cry', 'cavalry_charge', 'healing_light'],
      general: 'valor_general',
      startArmy: ['valor_swords', 'valor_swords', 'valor_levy', 'valor_bows', 'valor_bows', 'valor_squires'],
      starts: [0, 1],
    },
    horde: {
      id: 'horde', name: 'The Ashen Horde', short: 'Horde', adjective: 'Ashen',
      color: '#c0392b', color2: '#2a2522', dark: '#4a120c', metal: '#6c625a', cloth: '#9e2a1c',
      desc: 'Orc warbands and monstrous beasts boiling out of the burning east. Cheap, brutal and overwhelming in melee.',
      strengths: 'Cheap aggressive infantry · Huge monsters · Excellent melee damage',
      weaknesses: 'Poor ranged units · Low armour · Fickle morale',
      bonus: { name: 'Plunder & Muster', desc: 'Units cost 20% less to recruit. Capturing a settlement plunders 300 gold.' },
      abilities: ['blood_frenzy', 'earthshaker', 'savage_charge'],
      general: 'horde_general',
      startArmy: ['horde_grunts', 'horde_grunts', 'horde_grunts', 'horde_bruisers', 'horde_chuckers', 'horde_wargs'],
      starts: [11, 12],
    },
    arcane: {
      id: 'arcane', name: 'The Arcane Dominion', short: 'Dominion', adjective: 'Arcane',
      color: '#8e5be0', color2: '#4fd6e3', dark: '#2c1652', metal: '#d8d3ea', cloth: '#6b3fb5',
      desc: 'A magocracy of spire-cities ruled by archmages. Devastating spells and ranged magic, guarded by enchanted constructs.',
      strengths: 'Powerful ranged magic · Battlefield spells · Unbreakable golems',
      weaknesses: 'Expensive units · Fragile soldiers · Small armies',
      bonus: { name: 'Ley Mastery', desc: 'Unit upgrades cost 35% less. Battle ability cooldowns -15%. Units replenish 10% faster.' },
      abilities: ['fireball', 'meteor', 'arcane_ward'],
      general: 'arcane_general',
      startArmy: ['arcane_wardens', 'arcane_wardens', 'arcane_magi', 'arcane_magi', 'arcane_spellblades'],
      starts: [14, 15],
    },
    rebels: {
      id: 'rebels', name: 'Free Cities', short: 'Free Cities', adjective: 'Rebel',
      color: '#8a8270', color2: '#4b463c', dark: '#3a362e', metal: '#8f8a80', cloth: '#6f6758',
      desc: 'Independent towns, bandit lords and mercenaries.',
      bonus: { name: '-', desc: '' }, abilities: ['rally_cry'], general: 'rebel_general', startArmy: [], starts: [],
    },
  };
  const PLAYABLE = ['valor', 'horde', 'arcane'];

  // SVG emblems (original designs).
  const EMBLEMS = {
    valor: (c = '#e9dcae') => `<svg viewBox="0 0 64 64"><path d="M32 4 L56 12 L54 36 Q50 52 32 60 Q14 52 10 36 L8 12 Z" fill="#2f5fb3" stroke="${c}" stroke-width="3"/><path d="M20 22 L26 30 L32 18 L38 30 L44 22 L42 38 L22 38 Z" fill="${c}"/><rect x="22" y="40" width="20" height="4" fill="${c}"/><path d="M32 46 L32 54" stroke="${c}" stroke-width="3"/></svg>`,
    horde: (c = '#d8c9a0') => `<svg viewBox="0 0 64 64"><path d="M8 8 L56 8 L50 46 L32 60 L14 46 Z" fill="#9e2a1c" stroke="#2a2522" stroke-width="3"/><path d="M16 14 L26 34 M48 14 L38 34" stroke="${c}" stroke-width="5" stroke-linecap="round"/><circle cx="32" cy="34" r="10" fill="${c}"/><circle cx="28" cy="32" r="2.6" fill="#2a2522"/><circle cx="36" cy="32" r="2.6" fill="#2a2522"/><path d="M27 40 L29 44 L31 40 L33 44 L35 40 L37 44" stroke="#2a2522" stroke-width="1.6" fill="none"/></svg>`,
    arcane: (c = '#4fd6e3') => `<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="27" fill="#2c1652" stroke="#8e5be0" stroke-width="3"/><path d="M32 8 L37 27 L56 32 L37 37 L32 56 L27 37 L8 32 L27 27 Z" fill="${c}"/><circle cx="32" cy="32" r="7" fill="#2c1652" stroke="${c}" stroke-width="2"/><circle cx="32" cy="32" r="3" fill="#fff"/></svg>`,
    rebels: () => `<svg viewBox="0 0 64 64"><path d="M32 4 L56 14 L52 40 L32 60 L12 40 L8 14 Z" fill="#6f6758" stroke="#3a362e" stroke-width="3"/><path d="M22 18 L42 46 M42 18 L22 46" stroke="#cfc6b0" stroke-width="5"/></svg>`,
  };

  // ---------------------------------------------------------------- Units
  // Stats are per soldier. dmg is weapon damage per hit, ap is the armour-piercing fraction.
  // atk / def are melee skill (hit chance), armor reduces non-AP damage, charge is bonus on impact.
  const U = {};
  function unit(id, o) { U[id] = Object.assign({ id, range: 0, ammo: 0, rdmg: 0, rap: 0, reload: 0, acc: 0.5, splash: 0, large: false, antiLarge: 0, shield: 0, fear: false, regen: 0, cleave: 1, tier: 1, recruitable: true, arc: 0.6 }, o); }

  // Kingdom of Valor
  unit('valor_levy', { name: 'Levy Spearmen', faction: 'valor', cat: 'inf', count: 40, hp: 10, atk: 24, def: 36, dmg: 7, ap: 0.2, armor: 30, charge: 8, speed: 4.2, morale: 45, antiLarge: 10, cost: 300, upkeep: 50,
    model: { kind: 'foot', body: 'tunic', helm: 'kettle', weapon: 'spear', shield: true }, desc: 'Cheap spear levies. Hold the line and blunt cavalry charges, but break under pressure.' });
  unit('valor_swords', { name: 'Swordsmen of Valor', faction: 'valor', cat: 'inf', count: 40, hp: 11, atk: 38, def: 34, dmg: 9, ap: 0.25, armor: 45, charge: 10, speed: 4.4, morale: 60, shield: 0.35, cost: 550, upkeep: 90,
    model: { kind: 'foot', body: 'mail', helm: 'nasal', weapon: 'sword', shield: true }, desc: 'Reliable mailed infantry with large shields. Solid in melee and resistant to arrows from the front.' });
  unit('valor_bows', { name: 'Longbowmen', faction: 'valor', cat: 'ranged', count: 30, hp: 9, atk: 18, def: 14, dmg: 5, ap: 0.1, armor: 15, charge: 4, speed: 4.4, morale: 40, range: 80, ammo: 14, rdmg: 9, rap: 0.25, reload: 5.5, acc: 0.36, cost: 420, upkeep: 75,
    model: { kind: 'foot', body: 'tunic', helm: 'hood', weapon: 'bow' }, desc: 'Long-ranged archers. Keep them behind your infantry; they fold quickly in melee.' });
  unit('valor_squires', { name: 'Mounted Squires', faction: 'valor', cat: 'cav', count: 16, hp: 16, atk: 30, def: 22, dmg: 8, ap: 0.2, armor: 30, charge: 26, speed: 13, morale: 50, large: true, cost: 600, upkeep: 100,
    model: { kind: 'mounted', mount: 'horse', barding: false, rider: { body: 'tunic', helm: 'kettle', weapon: 'spear' } }, desc: 'Fast light cavalry. Ideal for running down archers and chasing routers.' });
  unit('valor_halberds', { name: 'Halberdiers', faction: 'valor', cat: 'inf', count: 36, hp: 11, atk: 30, def: 30, dmg: 9, ap: 0.4, armor: 45, charge: 8, speed: 4.2, morale: 55, antiLarge: 26, tier: 2, cost: 600, upkeep: 95,
    model: { kind: 'foot', body: 'mail', helm: 'kettle', weapon: 'halberd' }, desc: 'Heavy polearms that cut down knights and monsters. Bonus versus large targets.' });
  unit('valor_knights', { name: 'Knights of the Dawn', faction: 'valor', cat: 'cav', count: 16, hp: 22, atk: 40, def: 32, dmg: 13, ap: 0.35, armor: 65, charge: 48, speed: 11, morale: 70, large: true, tier: 2, cost: 1100, upkeep: 170,
    model: { kind: 'mounted', mount: 'horse', barding: true, rider: { body: 'plate', helm: 'great', weapon: 'lance', shield: true } }, desc: 'Heavily armoured shock cavalry. A charge into a flank or the rear is devastating.' });
  unit('valor_catapult', { name: 'Catapult', faction: 'valor', cat: 'siege', count: 2, hp: 60, atk: 8, def: 8, dmg: 4, ap: 0, armor: 20, charge: 0, speed: 2.6, morale: 40, range: 160, ammo: 22, rdmg: 70, rap: 0.4, reload: 9, acc: 0.55, splash: 3, tier: 2, cost: 800, upkeep: 120,
    model: { kind: 'siege', type: 'catapult' }, desc: 'Hurls boulders at long range with splash damage. Smashes gates and dense formations.' });
  unit('valor_guard', { name: 'Royal Guard', faction: 'valor', cat: 'inf', count: 36, hp: 13, atk: 50, def: 44, dmg: 11, ap: 0.35, armor: 70, charge: 14, speed: 4.2, morale: 82, shield: 0.4, tier: 3, cost: 1050, upkeep: 160,
    model: { kind: 'foot', body: 'plate', helm: 'great', weapon: 'sword', shield: true, scale: 1.05 }, desc: 'Elite plate-armoured household troops. They almost never break.' });
  unit('valor_general', { name: "Lord's Retinue", faction: 'valor', cat: 'general', count: 8, hp: 42, atk: 55, def: 46, dmg: 15, ap: 0.4, armor: 70, charge: 42, speed: 11, morale: 90, large: true, recruitable: false, cost: 0, upkeep: 0,
    model: { kind: 'mounted', mount: 'horse', barding: true, rider: { body: 'plate', helm: 'crown', weapon: 'sword', shield: true } }, desc: 'The commander and bodyguard. Inspires nearby troops; if they fall, the army despairs.' });

  // Ashen Horde
  unit('horde_grunts', { name: 'Grunt Rabble', faction: 'horde', cat: 'inf', count: 40, hp: 13, atk: 34, def: 22, dmg: 9.5, ap: 0.2, armor: 18, charge: 14, speed: 4.6, morale: 48, cost: 280, upkeep: 45,
    model: { kind: 'foot', body: 'rags', skin: '#5f7d3a', helm: 'none', weapon: 'club', shield: false, scale: 1.08 }, desc: 'Cheap, angry orcs. Hit hard, but poorly armoured and quick to panic.' });
  unit('horde_bruisers', { name: 'Ashen Bruisers', faction: 'horde', cat: 'inf', count: 36, hp: 16, atk: 46, def: 30, dmg: 13, ap: 0.3, armor: 38, charge: 18, speed: 4.4, morale: 64, shield: 0.2, cost: 560, upkeep: 85,
    model: { kind: 'foot', body: 'scrap', skin: '#55702f', helm: 'horns', weapon: 'axe', shield: true, scale: 1.15 }, desc: 'Big orcs in scrap armour. Brutal frontline fighters.' });
  unit('horde_chuckers', { name: 'Spear Chuckers', faction: 'horde', cat: 'ranged', count: 30, hp: 11, atk: 26, def: 18, dmg: 8, ap: 0.2, armor: 15, charge: 8, speed: 4.8, morale: 40, range: 45, ammo: 9, rdmg: 12, rap: 0.4, reload: 6, acc: 0.38, cost: 360, upkeep: 55,
    model: { kind: 'foot', body: 'rags', skin: '#6a8a3e', helm: 'none', weapon: 'javelin', scale: 1.0 }, desc: 'Short-ranged javelin throwers. Few shots, but they can brawl when needed.' });
  unit('horde_wargs', { name: 'Warg Riders', faction: 'horde', cat: 'cav', count: 16, hp: 18, atk: 35, def: 20, dmg: 11, ap: 0.25, armor: 20, charge: 30, speed: 13.5, morale: 50, large: true, cost: 650, upkeep: 100,
    model: { kind: 'mounted', mount: 'wolf', rider: { body: 'rags', skin: '#5f7d3a', helm: 'none', weapon: 'axe' } }, desc: 'Goblins on huge wolves. Fast flankers that savage archers and fleeing troops.' });
  unit('horde_trolls', { name: 'Cinder Trolls', faction: 'horde', cat: 'monster', count: 4, hp: 130, atk: 45, def: 24, dmg: 32, ap: 0.5, armor: 30, charge: 40, speed: 6.5, morale: 55, large: true, fear: true, regen: 1.2, cleave: 3, tier: 2, cost: 1150, upkeep: 170,
    model: { kind: 'beast', type: 'troll' }, desc: 'Regenerating brutes that cleave through infantry and cause fear.' });
  unit('horde_lobber', { name: 'Rock Lobber', faction: 'horde', cat: 'siege', count: 2, hp: 70, atk: 10, def: 8, dmg: 5, ap: 0, armor: 15, charge: 0, speed: 2.6, morale: 40, range: 140, ammo: 20, rdmg: 65, rap: 0.4, reload: 10, acc: 0.45, splash: 3.2, tier: 2, cost: 700, upkeep: 100,
    model: { kind: 'siege', type: 'lobber' }, desc: 'Crude stone-throwing engine. Inaccurate but punishing.' });
  unit('horde_behemoth', { name: 'Ash Behemoth', faction: 'horde', cat: 'monster', count: 1, hp: 950, atk: 55, def: 30, dmg: 110, ap: 0.6, armor: 45, charge: 70, speed: 6, morale: 70, large: true, fear: true, cleave: 5, regen: 2, tier: 3, cost: 2100, upkeep: 300,
    model: { kind: 'beast', type: 'behemoth' }, desc: 'A towering ash-giant. Scatters whole regiments, but spears can bring it down.' });
  unit('horde_general', { name: 'Warboss & Guard', faction: 'horde', cat: 'general', count: 8, hp: 48, atk: 58, def: 40, dmg: 17, ap: 0.4, armor: 50, charge: 30, speed: 5.4, morale: 85, recruitable: false, cost: 0, upkeep: 0,
    model: { kind: 'foot', body: 'scrap', skin: '#4f6a2b', helm: 'horns', weapon: 'axe', shield: true, scale: 1.35 }, desc: 'The warboss and his biggest lads. Inspires nearby troops.' });

  // Arcane Dominion
  unit('arcane_wardens', { name: 'Sentinel Wardens', faction: 'arcane', cat: 'inf', count: 30, hp: 12, atk: 30, def: 40, dmg: 8, ap: 0.3, armor: 55, charge: 8, speed: 4.2, morale: 55, shield: 0.4, cost: 560, upkeep: 95,
    model: { kind: 'foot', body: 'plate', helm: 'great', weapon: 'glaive', shield: true }, desc: 'Enchanted-armour guardians who protect the mages. Defensive, not deadly.' });
  unit('arcane_magi', { name: 'Apprentice Magi', faction: 'arcane', cat: 'ranged', count: 24, hp: 8, atk: 16, def: 14, dmg: 5, ap: 0.5, armor: 10, charge: 2, speed: 4.4, morale: 45, range: 85, ammo: 12, rdmg: 11, rap: 0.65, reload: 6, acc: 0.4, cost: 620, upkeep: 105,
    model: { kind: 'foot', body: 'robe', helm: 'hood', weapon: 'staff' }, desc: 'Fire arcane bolts that pierce armour. Very fragile.' });
  unit('arcane_spellblades', { name: 'Spellblades', faction: 'arcane', cat: 'inf', count: 30, hp: 11, atk: 46, def: 30, dmg: 10, ap: 0.55, armor: 35, charge: 14, speed: 4.8, morale: 60, tier: 1, cost: 720, upkeep: 115,
    model: { kind: 'foot', body: 'mail', helm: 'circlet', weapon: 'sword', shield: false }, desc: 'Duellists with rune-etched blades. High damage that ignores armour.' });
  unit('arcane_griffons', { name: 'Griffon Riders', faction: 'arcane', cat: 'cav', count: 12, hp: 26, atk: 38, def: 28, dmg: 13, ap: 0.35, armor: 35, charge: 38, speed: 14, morale: 65, large: true, fear: true, tier: 2, cost: 1100, upkeep: 170,
    model: { kind: 'mounted', mount: 'griffon', rider: { body: 'plate', helm: 'circlet', weapon: 'lance' } }, desc: 'Magical beasts that strike exposed flanks at blinding speed.' });
  unit('arcane_golems', { name: 'Arcane Golems', faction: 'arcane', cat: 'monster', count: 3, hp: 170, atk: 34, def: 42, dmg: 30, ap: 0.4, armor: 75, charge: 30, speed: 4.6, morale: 100, large: true, fear: true, cleave: 3, tier: 2, cost: 1250, upkeep: 180,
    model: { kind: 'beast', type: 'golem' }, desc: 'Animated stone constructs. Slow, unbreakable and extremely tough.' });
  unit('arcane_battery', { name: 'Starfire Battery', faction: 'arcane', cat: 'siege', count: 2, hp: 55, atk: 8, def: 8, dmg: 4, ap: 0, armor: 30, charge: 0, speed: 2.8, morale: 50, range: 150, ammo: 24, rdmg: 48, rap: 0.8, reload: 7, acc: 0.6, splash: 2.6, tier: 2, cost: 900, upkeep: 130,
    model: { kind: 'siege', type: 'ballista' }, desc: 'Crystal ballistae firing bolts of starfire. Accurate with armour-piercing splash.' });
  unit('arcane_archmagi', { name: 'Archmagi Circle', faction: 'arcane', cat: 'ranged', count: 12, hp: 14, atk: 22, def: 20, dmg: 7, ap: 0.6, armor: 25, charge: 2, speed: 4.2, morale: 70, range: 100, ammo: 12, rdmg: 22, rap: 0.8, reload: 6.5, acc: 0.6, splash: 1.8, tier: 3, cost: 1300, upkeep: 190,
    model: { kind: 'foot', body: 'robe', helm: 'tall', weapon: 'staff', scale: 1.08 }, desc: 'Masters of battle magic whose bolts burst on impact.' });
  unit('arcane_general', { name: 'Archon & Honour Guard', faction: 'arcane', cat: 'general', count: 8, hp: 36, atk: 46, def: 44, dmg: 13, ap: 0.6, armor: 60, charge: 12, speed: 5, morale: 85, range: 60, ammo: 10, rdmg: 12, rap: 0.7, reload: 6, acc: 0.45, recruitable: false, cost: 0, upkeep: 0,
    model: { kind: 'foot', body: 'robe', helm: 'tall', weapon: 'staff', shield: false, scale: 1.12 }, desc: 'The ruling archon. Hurls bolts and inspires nearby troops.' });

  // Free Cities (rebels) - garrisons and rebel armies only.
  unit('rebel_militia', { name: 'Town Militia', faction: 'rebels', cat: 'inf', count: 36, hp: 10, atk: 24, def: 30, dmg: 7, ap: 0.2, armor: 25, charge: 8, speed: 4.2, morale: 40, antiLarge: 8, shield: 0.25, recruitable: false, cost: 250, upkeep: 40,
    model: { kind: 'foot', body: 'tunic', helm: 'kettle', weapon: 'spear', shield: true }, desc: 'Townsfolk defending their homes.' });
  unit('rebel_crossbows', { name: 'Crossbow Militia', faction: 'rebels', cat: 'ranged', count: 24, hp: 9, atk: 16, def: 14, dmg: 5, ap: 0.1, armor: 20, charge: 2, speed: 4.2, morale: 38, range: 65, ammo: 12, rdmg: 11, rap: 0.45, reload: 7, acc: 0.45, recruitable: false, cost: 350, upkeep: 60,
    model: { kind: 'foot', body: 'tunic', helm: 'kettle', weapon: 'bow' }, desc: 'Crossbowmen of the free towns.' });
  unit('rebel_sellswords', { name: 'Sellswords', faction: 'rebels', cat: 'inf', count: 32, hp: 12, atk: 36, def: 28, dmg: 9, ap: 0.3, armor: 40, charge: 10, speed: 4.4, morale: 50, recruitable: false, cost: 500, upkeep: 80,
    model: { kind: 'foot', body: 'mail', helm: 'nasal', weapon: 'axe', shield: true }, desc: 'Mercenary veterans.' });
  unit('rebel_riders', { name: 'Free Riders', faction: 'rebels', cat: 'cav', count: 14, hp: 16, atk: 30, def: 22, dmg: 8, ap: 0.2, armor: 25, charge: 24, speed: 13, morale: 45, large: true, recruitable: false, cost: 550, upkeep: 90,
    model: { kind: 'mounted', mount: 'horse', rider: { body: 'tunic', helm: 'hood', weapon: 'spear' } }, desc: 'Bandit horsemen.' });
  unit('rebel_general', { name: 'Free Lord', faction: 'rebels', cat: 'general', count: 8, hp: 34, atk: 44, def: 38, dmg: 12, ap: 0.3, armor: 50, charge: 30, speed: 10.5, morale: 75, large: true, recruitable: false, cost: 0, upkeep: 0,
    model: { kind: 'mounted', mount: 'horse', barding: false, rider: { body: 'mail', helm: 'nasal', weapon: 'sword', shield: true } }, desc: 'A local warlord.' });

  const GARRISONS = {
    valor: ['valor_levy', 'valor_bows', 'valor_swords', 'valor_levy', 'valor_bows', 'valor_halberds', 'valor_swords', 'valor_bows'],
    horde: ['horde_grunts', 'horde_chuckers', 'horde_grunts', 'horde_bruisers', 'horde_grunts', 'horde_chuckers', 'horde_bruisers', 'horde_grunts'],
    arcane: ['arcane_wardens', 'arcane_magi', 'arcane_wardens', 'arcane_magi', 'arcane_spellblades', 'arcane_wardens', 'arcane_magi', 'arcane_wardens'],
    rebels: ['rebel_militia', 'rebel_crossbows', 'rebel_militia', 'rebel_sellswords', 'rebel_crossbows', 'rebel_riders', 'rebel_militia', 'rebel_sellswords'],
  };

  // Rough battle value of one full-strength unit, used by auto-resolve and the AI.
  function unitPower(t) {
    const melee = t.atk * 0.6 + t.def * 0.5 + t.dmg * (1 + t.ap) * 1.6 * t.cleave + t.charge * 0.3;
    const tough = t.hp * t.count * (1 + t.armor / 120) / 12;
    const ranged = t.range ? (t.rdmg * (1 + t.rap) * t.ammo * t.acc * Math.min(t.count, 30) / 18 + t.range * 0.4 + t.splash * 12) : 0;
    return Math.round((melee * 0.9 + tough * 0.9 + ranged + t.morale * 0.4) * (t.cat === 'general' ? 1.2 : 1));
  }
  for (const k in U) {
    U[k].power = unitPower(U[k]);
    // Upkeep per campaign turn is a modest fraction of the recruitment cost.
    U[k].upkeep = Math.round((U[k].upkeep * 0.45) / 5) * 5;
  }

  // ---------------------------------------------------------------- Abilities
  const ABILITIES = {
    rally_cry: { id: 'rally_cry', name: 'Rally Cry', faction: 'valor', icon: 'horn', cd: 55, target: 'point', radius: 32, color: '#ffd76a',
      desc: 'Allies in a wide area gain +30 morale and +8 defence for 20s. Routing units nearby rally.' },
    cavalry_charge: { id: 'cavalry_charge', name: 'Cavalry Charge', faction: 'valor', icon: 'horse', cd: 70, target: 'self', radius: 0, color: '#9fd0ff',
      desc: 'All allied cavalry gain +100% charge bonus and +25% speed for 15s.' },
    healing_light: { id: 'healing_light', name: 'Healing Light', faction: 'valor', icon: 'sun', cd: 90, target: 'point', radius: 16, color: '#fff1a8',
      desc: 'Restores 30% of lost soldiers to allied units in the area (fallen men rise again).' },
    blood_frenzy: { id: 'blood_frenzy', name: 'Blood Frenzy', faction: 'horde', icon: 'skull', cd: 65, target: 'point', radius: 34, color: '#ff4a2a',
      desc: 'Allies in a wide area gain +25% melee damage and +20 morale for 20s.' },
    earthshaker: { id: 'earthshaker', name: 'Earthshaker', faction: 'horde', icon: 'quake', cd: 60, target: 'point', radius: 11, color: '#c48a3a',
      desc: 'The ground erupts: heavy damage in a small area and a big morale shock to enemies.' },
    savage_charge: { id: 'savage_charge', name: 'Savage Charge', faction: 'horde', icon: 'claw', cd: 70, target: 'self', radius: 0, color: '#ff8a3a',
      desc: 'All cavalry and monsters gain +30% speed and +60% charge bonus for 15s.' },
    fireball: { id: 'fireball', name: 'Fireball', faction: 'arcane', icon: 'fire', cd: 32, target: 'point', radius: 7, color: '#ff7a1a',
      desc: 'A blazing orb streaks from the archon and explodes, burning a small area.' },
    meteor: { id: 'meteor', name: 'Meteor Strike', faction: 'arcane', icon: 'meteor', cd: 120, target: 'point', radius: 11, color: '#ff5a2a',
      desc: 'After 2.5s a meteor crashes down: massive damage in a wide area. Hits friend and foe.' },
    arcane_ward: { id: 'arcane_ward', name: 'Arcane Ward', faction: 'arcane', icon: 'shield', cd: 80, target: 'point', radius: 18, color: '#7ae8ff',
      desc: 'Allies in the area restore 20% of lost soldiers and gain +25 armour for 25s.' },
  };

  // ---------------------------------------------------------------- Commanders
  const TRAITS = {
    shieldwall: { name: 'Shieldwall Master', desc: 'Infantry +8 defence and +10 armour.' },
    outrider: { name: 'Outrider', desc: 'Cavalry +15% speed and +12 charge.' },
    quartermaster: { name: 'Quartermaster', desc: 'Army upkeep -25%. Units replenish 10% faster.' },
    inspiring: { name: 'Inspiring Presence', desc: 'All units +12 morale.' },
    bloodthirsty: { name: 'Bloodthirsty', desc: 'All units +12% melee damage.' },
    spellweaver: { name: 'Spellweaver', desc: 'Battle ability cooldowns -25%.' },
    eagleeye: { name: 'Eagle Eye', desc: 'Ranged units +15% damage and +10% range.' },
    siegebreaker: { name: 'Siegebreaker', desc: 'Siege engines +30% damage; all units deal triple damage to gates.' },
    beastmaster: { name: 'Beastmaster', desc: 'Monsters +20% health and +10 attack.' },
    tactician: { name: 'Swift Marcher', desc: 'This army can move two territories per turn.' },
  };
  const COMMANDER_NAMES = {
    valor: ['Lord Aldric Vane', 'Dame Elowen Hart', 'Sir Garrick Stone', 'Baron Tomas Reed', 'Lady Isolde Marr', 'Sir Bennet Ash', 'Duke Roderic Penn', 'Dame Wynn Calder', 'Sir Osric Fell', 'Lady Maren Dusk'],
    horde: ['Grukk Ironjaw', 'Skarza the Burnt', 'Morgash Bonecrack', 'Uzgul Ashmaw', 'Vrak Redtusk', 'Brakka Skullsplit', 'Gorza Emberfist', 'Krull the Hungry', 'Zugrat Blacktooth', 'Durga Cinderhide'],
    arcane: ['Archon Seliane', 'Magister Orlen Vey', 'Sorceress Ytha', 'Archmage Corvane', 'Lady Ilyra Moonward', 'Magister Thessaly', 'Arch-Warden Kael', 'Seer Nymara', 'Magus Dorian Shale', 'Archon Veyra Lux'],
    rebels: ['Free Lord Bram', 'Captain Halvard', 'Warden Odo', 'Lady Sefa of the Hills', 'Mayor Pell'],
  };
  const FACTION_TRAITS = {
    valor: ['shieldwall', 'outrider', 'quartermaster', 'inspiring', 'eagleeye', 'siegebreaker', 'tactician'],
    horde: ['bloodthirsty', 'beastmaster', 'outrider', 'inspiring', 'quartermaster', 'siegebreaker', 'tactician'],
    arcane: ['spellweaver', 'eagleeye', 'shieldwall', 'inspiring', 'beastmaster', 'quartermaster', 'tactician'],
    rebels: ['inspiring', 'shieldwall'],
  };

  // ---------------------------------------------------------------- Unit upgrades (unlockable)
  const UPGRADES = {
    valor: [
      { id: 'v_steel', name: 'Tempered Steel', desc: 'Infantry +6 attack and +10 armour.', cost: 900, wins: 1, apply: { cats: ['inf', 'general'], atk: 6, armor: 10 } },
      { id: 'v_yew', name: 'Yew Longbows', desc: 'Ranged units +15 range and +2 missile damage.', cost: 800, wins: 1, apply: { cats: ['ranged'], range: 15, rdmg: 2 } },
      { id: 'v_barding', name: 'Barded Warhorses', desc: 'Cavalry +15 armour and +10 charge.', cost: 1200, wins: 2, apply: { cats: ['cav', 'general'], armor: 15, charge: 10 } },
      { id: 'v_banners', name: 'Blessed Banners', desc: 'All units +10 morale.', cost: 1500, wins: 3, apply: { cats: ['all'], morale: 10 } },
    ],
    horde: [
      { id: 'h_iron', name: 'Jagged Iron', desc: 'All units +15% melee damage.', cost: 800, wins: 1, apply: { cats: ['all'], dmgMul: 1.15 } },
      { id: 'h_paint', name: 'War Paint', desc: 'All units +12 morale.', cost: 900, wins: 1, apply: { cats: ['all'], morale: 12 } },
      { id: 'h_tamers', name: 'Beast Tamers', desc: 'Monsters and cavalry +20% health.', cost: 1300, wins: 2, apply: { cats: ['monster', 'cav'], hpMul: 1.2 } },
      { id: 'h_heavy', name: 'Heavy Chuckers', desc: 'Ranged units +4 missile damage and +4 ammo.', cost: 700, wins: 2, apply: { cats: ['ranged', 'siege'], rdmg: 4, ammo: 4 } },
    ],
    arcane: [
      { id: 'a_focus', name: 'Runic Focus', desc: 'Ranged units +20% missile damage.', cost: 1000, wins: 1, apply: { cats: ['ranged', 'siege'], rdmgMul: 1.2 } },
      { id: 'a_stone', name: 'Living Stone', desc: 'Infantry and monsters +15 armour.', cost: 1000, wins: 1, apply: { cats: ['inf', 'monster'], armor: 15 } },
      { id: 'a_ley', name: 'Ley Conduits', desc: 'Battle ability cooldowns -20%.', cost: 1100, wins: 2, apply: { cdMul: 0.8 } },
      { id: 'a_aether', name: 'Aether Wings', desc: 'Cavalry +20% speed and +10 attack.', cost: 1200, wins: 3, apply: { cats: ['cav'], speedMul: 1.2, atk: 10 } },
    ],
  };

  // ---------------------------------------------------------------- Campaign map
  // x/y are map coordinates (0..100 x 0..72). Adjacency is derived from the generated hex map.
  const TERRITORIES = [
    { id: 0, name: 'Highcrown', x: 12, y: 18, terrain: 'plains' },
    { id: 1, name: 'Silverbrook', x: 10, y: 52, terrain: 'river' },
    { id: 2, name: 'Dawnford', x: 25, y: 35, terrain: 'river' },
    { id: 3, name: 'Greymarch', x: 30, y: 10, terrain: 'hills' },
    { id: 4, name: 'Thornwood', x: 26, y: 60, terrain: 'forest' },
    { id: 5, name: 'Oldstone Ruins', x: 43, y: 24, terrain: 'plains', shrine: true },
    { id: 6, name: 'Wolfen Vale', x: 42, y: 46, terrain: 'forest' },
    { id: 7, name: 'Ironhold Pass', x: 57, y: 9, terrain: 'pass' },
    { id: 8, name: 'Sunken Shrine', x: 58, y: 34, terrain: 'river', shrine: true },
    { id: 9, name: 'Emberfell', x: 44, y: 65, terrain: 'river' },
    { id: 10, name: 'Cinderwaste', x: 73, y: 20, terrain: 'plains' },
    { id: 11, name: 'Ashfang Peaks', x: 89, y: 9, terrain: 'pass' },
    { id: 12, name: "Gorlak's Maw", x: 90, y: 30, terrain: 'hills' },
    { id: 13, name: 'Frostmere', x: 74, y: 47, terrain: 'hills', shrine: true },
    { id: 14, name: 'Starfall Glade', x: 61, y: 63, terrain: 'forest' },
    { id: 15, name: 'Mistral Spire', x: 89, y: 60, terrain: 'hills' },
  ];
  const TERRAIN_INFO = {
    plains: { name: 'Grassland', income: 70, battle: 'grassland', color: '#7fa64a' },
    river: { name: 'River Valley', income: 80, battle: 'river', color: '#6f9f58' },
    forest: { name: 'Forest', income: 50, battle: 'forest', color: '#3f6b33' },
    hills: { name: 'Highlands', income: 55, battle: 'hills', color: '#8c8a55' },
    pass: { name: 'Mountain Pass', income: 45, battle: 'pass', color: '#8a8478' },
  };
  const SETTLEMENT = {
    levels: [null, { name: 'Village', income: 70, garrison: 2 }, { name: 'Town', income: 140, garrison: 4 }, { name: 'City', income: 220, garrison: 6 }],
    upgradeCost: [0, 0, 900, 1800],
    buildings: {
      market: { name: 'Market', cost: 600, desc: '+70 gold per turn.' },
      barracks: { name: 'Barracks', cost: 700, desc: 'Recruitment here costs 15% less and recruits start as veterans (rank 1).' },
      walls: { name: 'Walls', cost: 800, desc: 'Attacks here become siege battles. +2 garrison units.' },
    },
  };
  const BATTLE_MAPS = {
    grassland: { name: 'Open Grassland', desc: 'Rolling fields with a few groves. Room for cavalry to manoeuvre.' },
    forest: { name: 'Deep Forest', desc: 'Woods slow movement, hide troops and shelter them from missiles.' },
    hills: { name: 'Highlands', desc: 'Hills give ranged units extra range and melee units an edge when fighting downhill.' },
    river: { name: 'River Crossing', desc: 'A river split by a few fords and a bridge. Hold the crossings!' },
    pass: { name: 'Mountain Pass', desc: 'Cliffs funnel both armies into a narrow pass.' },
    siege: { name: 'Settlement Siege', desc: 'Walls and a gate protect the defenders. Break the gate to storm the town.' },
  };

  // Random army composition within a gold budget (used for AI armies, garrisons and quick battles).
  const ROLE_WEIGHTS = {
    valor: { inf: 0.42, ranged: 0.24, cav: 0.2, monster: 0, siege: 0.08 },
    horde: { inf: 0.5, ranged: 0.14, cav: 0.14, monster: 0.18, siege: 0.06 },
    arcane: { inf: 0.36, ranged: 0.32, cav: 0.12, monster: 0.14, siege: 0.08 },
    rebels: { inf: 0.55, ranged: 0.3, cav: 0.15, monster: 0, siege: 0 },
  };
  function genArmy(faction, budget, maxTier = 3, maxUnits = 12, rng = Math.random, existing = []) {
    const pool = Object.values(U).filter((u) => u.faction === faction && (u.recruitable || faction === 'rebels') && u.cat !== 'general' && u.tier <= maxTier);
    const w = ROLE_WEIGHTS[faction];
    const out = [];
    const counts = { inf: 0, ranged: 0, cav: 0, monster: 0, siege: 0 };
    for (const id of existing) counts[U[id].cat] = (counts[U[id].cat] || 0) + 1;
    let guard = 0;
    while (out.length + existing.length < maxUnits && guard++ < 60) {
      const affordable = pool.filter((u) => u.cost <= budget);
      if (!affordable.length) break;
      // Pick the role that is furthest below its target share.
      const total = out.length + existing.length + 1;
      let role = null, bestGap = -Infinity;
      for (const r in w) {
        if (!w[r] || !affordable.some((u) => u.cat === r)) continue;
        const gap = w[r] - counts[r] / total + rng() * 0.15;
        if (gap > bestGap) { bestGap = gap; role = r; }
      }
      if (!role) break;
      const opts = affordable.filter((u) => u.cat === role);
      // Prefer stronger units when rich.
      opts.sort((a, b) => a.cost - b.cost);
      const rich = budget > 3000 ? 0.65 : 0.35;
      const pick = rng() < rich ? opts[opts.length - 1 - Math.floor(rng() * Math.min(2, opts.length))] : opts[Math.floor(rng() * opts.length)];
      out.push(pick.id); counts[role]++; budget -= pick.cost;
    }
    return out;
  }

  RW.data = { genArmy, FACTIONS, PLAYABLE, EMBLEMS, UNITS: U, GARRISONS, ABILITIES, TRAITS, COMMANDER_NAMES, FACTION_TRAITS, UPGRADES, TERRITORIES, TERRAIN_INFO, SETTLEMENT, BATTLE_MAPS, unitPower };

  // ---------------------------------------------------------------- Icons
  const ICON_PATHS = {
    sword: '<path d="M6 26 L22 10 L26 6 L24 12 L10 28 Z" fill="currentColor"/><path d="M6 20 L14 28" stroke="currentColor" stroke-width="3"/><circle cx="5" cy="29" r="2.5" fill="currentColor"/>',
    spear: '<path d="M4 30 L24 10" stroke="currentColor" stroke-width="3"/><path d="M22 6 L30 2 L26 10 Z" fill="currentColor"/><path d="M8 18 Q4 26 12 28 Q14 20 8 18Z" fill="currentColor" opacity=".7"/>',
    bow: '<path d="M8 4 Q30 16 8 30" stroke="currentColor" stroke-width="3" fill="none"/><path d="M8 4 L8 30" stroke="currentColor" stroke-width="1.2"/><path d="M4 17 L28 17 M24 13 L28 17 L24 21" stroke="currentColor" stroke-width="2" fill="none"/>',
    horse: '<path d="M6 30 L8 18 Q8 8 18 6 L22 2 L23 7 Q30 10 28 16 L24 15 L20 14 L20 22 L22 30 L18 30 L16 22 L12 24 L11 30 Z" fill="currentColor"/>',
    monster: '<path d="M4 28 Q6 10 16 6 Q26 10 28 28 L22 22 L20 28 L16 20 L12 28 L10 22 Z" fill="currentColor"/><circle cx="12" cy="14" r="2" fill="#000"/><circle cx="20" cy="14" r="2" fill="#000"/>',
    siege: '<path d="M4 28 L28 28 L24 20 L8 20 Z" fill="currentColor"/><path d="M10 20 L24 6" stroke="currentColor" stroke-width="3"/><circle cx="25" cy="5" r="3.5" fill="currentColor"/><circle cx="9" cy="29" r="3" fill="#222" stroke="currentColor"/><circle cx="23" cy="29" r="3" fill="#222" stroke="currentColor"/>',
    staff: '<path d="M8 30 L22 10" stroke="currentColor" stroke-width="3"/><circle cx="24" cy="7" r="5" fill="currentColor"/><path d="M24 0 L24 14 M17 7 L31 7" stroke="currentColor" stroke-width="1" opacity=".6"/>',
    crown: '<path d="M4 24 L6 8 L12 16 L16 6 L20 16 L26 8 L28 24 Z" fill="currentColor"/><rect x="4" y="25" width="24" height="4" fill="currentColor"/>',
    axe: '<path d="M8 30 L22 8" stroke="currentColor" stroke-width="3"/><path d="M16 6 Q28 2 30 14 Q22 12 19 14 Z" fill="currentColor"/>',
    horn: '<path d="M4 20 Q14 22 26 6 L30 10 Q20 28 4 26 Z" fill="currentColor"/>',
    sun: '<circle cx="16" cy="16" r="7" fill="currentColor"/><path d="M16 1 V7 M16 25 V31 M1 16 H7 M25 16 H31 M5 5 L9 9 M23 23 L27 27 M27 5 L23 9 M9 23 L5 27" stroke="currentColor" stroke-width="2.5"/>',
    skull: '<path d="M6 16 Q6 4 16 4 Q26 4 26 16 L24 22 L22 22 L22 28 L10 28 L10 22 L8 22 Z" fill="currentColor"/><circle cx="12" cy="15" r="3" fill="#000"/><circle cx="20" cy="15" r="3" fill="#000"/>',
    quake: '<path d="M2 24 L10 18 L14 22 L20 12 L24 18 L30 14" stroke="currentColor" stroke-width="3" fill="none"/><path d="M4 30 L28 30" stroke="currentColor" stroke-width="3"/><path d="M8 8 L10 4 M16 6 L16 2 M24 8 L22 4" stroke="currentColor" stroke-width="2"/>',
    claw: '<path d="M6 28 Q8 12 4 4 Q14 12 12 28 Z M14 28 Q16 10 14 2 Q22 12 20 28 Z M22 28 Q24 14 24 6 Q30 14 28 28 Z" fill="currentColor"/>',
    fire: '<path d="M16 30 Q4 26 8 14 Q10 20 13 18 Q10 8 18 2 Q18 10 24 14 Q28 26 16 30 Z" fill="currentColor"/>',
    meteor: '<circle cx="21" cy="21" r="8" fill="currentColor"/><path d="M2 2 L16 16 M8 2 L18 12 M2 8 L12 18" stroke="currentColor" stroke-width="2.5"/>',
    shield: '<path d="M16 2 L28 7 Q28 22 16 30 Q4 22 4 7 Z" fill="currentColor"/><path d="M16 8 L16 24 M10 14 L22 14" stroke="#000" stroke-width="2" opacity=".5"/>',
    gold: '<circle cx="16" cy="16" r="12" fill="currentColor"/><circle cx="16" cy="16" r="8" fill="none" stroke="#000" stroke-width="1.5" opacity=".4"/>',
    flag: '<path d="M6 30 L6 2" stroke="currentColor" stroke-width="3"/><path d="M7 3 L28 8 L7 14 Z" fill="currentColor"/>',
  };
  function unitIconKey(t) {
    if (t.cat === 'general') return 'crown';
    if (t.cat === 'cav') return 'horse';
    if (t.cat === 'monster') return 'monster';
    if (t.cat === 'siege') return 'siege';
    if (t.cat === 'ranged') return t.model.weapon === 'staff' ? 'staff' : t.model.weapon === 'javelin' ? 'spear' : 'bow';
    const w = t.model.weapon;
    if (w === 'spear' || w === 'halberd' || w === 'glaive') return 'spear';
    if (w === 'axe' || w === 'club') return 'axe';
    return 'sword';
  }
  RW.icon = function (key, cls = '') {
    return `<svg class="ico ${cls}" viewBox="0 0 32 32">${ICON_PATHS[key] || ICON_PATHS.flag}</svg>`;
  };
  RW.unitIcon = function (typeId, cls = '') { return RW.icon(unitIconKey(U[typeId]), cls); };
  RW.catName = { inf: 'Infantry', ranged: 'Ranged', cav: 'Cavalry', monster: 'Monster', siege: 'Siege', general: 'Commander' };
})();
