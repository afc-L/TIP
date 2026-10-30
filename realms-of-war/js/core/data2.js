// Content update: three new factions, expanded rosters, legendary commanders, equipment, technology,
// the Greater Realm map, new battlefields and weather. Extends RW.data in place.
(function () {
  const RW = window.RW;
  const D = RW.data;
  const U = D.UNITS;

  function unit(id, o) {
    U[id] = Object.assign({ id, range: 0, ammo: 0, rdmg: 0, rap: 0, reload: 0, acc: 0.5, splash: 0, large: false, antiLarge: 0, shield: 0, fear: false, regen: 0, cleave: 1, tier: 1, recruitable: true, arc: 0.6, added: true }, o);
    const u = U[id];
    u.power = D.unitPower(u);
    u.upkeep = Math.round(((u.upkeep || u.cost * 0.16) * 0.45) / 5) * 5;
  }

  // ---------------------------------------------------------------- Factions
  Object.assign(D.FACTIONS, {
    frost: {
      id: 'frost', name: 'The Frostborn Clans', short: 'Frostborn', adjective: 'Frostborn', style: 'longhouse',
      alt: { color: '#b0a050', cloth: '#7a6a2a' },
      color: '#7fb8e0', color2: '#eef6ff', dark: '#1d3a52', metal: '#c9d6e2', cloth: '#3f78a6',
      desc: 'Hardy clans of the frozen north who march with frost giants, wolves and warriors clad in rime-hardened steel.',
      strengths: 'Rock-solid armoured infantry · Frost giants and mammoths · Frozen Ground slows the enemy',
      weaknesses: 'Expensive recruitment · Slow infantry',
      bonus: { name: 'Children of Winter', desc: 'Garrisons are 25% stronger and armies replenish 10% faster. Recruitment costs 15% more.' },
      abilities: ['frozen_ground', 'winters_howl', 'rime_armour'],
      ultimate: 'blizzard',
      general: 'frost_general',
      startArmy: ['frost_huskarls', 'frost_huskarls', 'frost_hunters', 'frost_hunters', 'frost_wolves'],
      starts: [],
    },
    blood: {
      id: 'blood', name: 'The Bloodfang Empire', short: 'Bloodfang', adjective: 'Bloodfang', style: 'gothic',
      alt: { color: '#6a8a9a', cloth: '#3a5a6a' },
      color: '#b3243c', color2: '#e6d3a3', dark: '#3a0a14', metal: '#4a4a56', cloth: '#5e1020',
      desc: 'A vampire aristocracy ruling hosts of the dead. Skeleton legions hold the line while vampire knights ride down the living.',
      strengths: 'Deadly heavy cavalry · Aggressive melee · Fallen soldiers rise again (limited)',
      weaknesses: 'Fragile skeleton infantry · Few good missile troops',
      bonus: { name: 'Eternal Hunger', desc: 'After a victory, the army restores 10% strength to every unit. In battle up to 30 fallen soldiers rise again.' },
      abilities: ['blood_harvest', 'crimson_mist', 'raise_dead'],
      ultimate: 'night_terror',
      general: 'blood_general',
      startArmy: ['blood_skeletons', 'blood_skeletons', 'blood_ghouls', 'blood_archers', 'blood_riders'],
      starts: [],
    },
    sylvan: {
      id: 'sylvan', name: 'The Sylvan Covenant', short: 'Sylvan', adjective: 'Sylvan', style: 'grove',
      alt: { color: '#a07a3a', cloth: '#6a4a1a' },
      color: '#4fae5a', color2: '#ecd27a', dark: '#163a1c', metal: '#c8cfa8', cloth: '#2f6b36',
      desc: 'Elves, forest guardians and ancient treants sworn to the old woods. Unmatched archers and swift riders.',
      strengths: 'Superb archers · Fast cavalry and flyers · Treants and Nature\'s Wrath',
      weaknesses: 'Weak heavy infantry · Low armour',
      bonus: { name: 'Paths of the Wild', desc: 'Armies starting their turn in a forest march one extra territory. Forest territories give +25% income.' },
      abilities: ['natures_wrath', 'swift_wind', 'regrowth'],
      ultimate: 'wild_hunt',
      general: 'sylvan_general',
      startArmy: ['sylvan_spears', 'sylvan_spears', 'sylvan_archers', 'sylvan_archers', 'sylvan_riders'],
      starts: [],
    },
  });
  D.FACTIONS.valor.style = 'stone'; D.FACTIONS.horde.style = 'spiked'; D.FACTIONS.arcane.style = 'spire'; D.FACTIONS.rebels.style = 'stone';
  D.FACTIONS.valor.ultimate = 'divine_shield'; D.FACTIONS.horde.ultimate = 'ash_storm'; D.FACTIONS.arcane.ultimate = 'time_warp';
  D.CLASSIC = ['valor', 'horde', 'arcane'];
  Object.assign(D.ROLE_WEIGHTS, {
    frost: { inf: 0.46, ranged: 0.22, cav: 0.14, monster: 0.12, siege: 0.06 },
    blood: { inf: 0.44, ranged: 0.18, cav: 0.24, monster: 0.1, siege: 0.04 },
    sylvan: { inf: 0.32, ranged: 0.34, cav: 0.18, monster: 0.1, siege: 0.06 },
  });
  D.PLAYABLE.push('frost', 'blood', 'sylvan');

  Object.assign(D.EMBLEMS, {
    frost: (c = '#eef6ff') => `<svg viewBox="0 0 64 64"><path d="M32 4 L58 18 L58 46 L32 60 L6 46 L6 18 Z" fill="#2c5a80" stroke="#cfe6f7" stroke-width="3"/><g stroke="${c}" stroke-width="4" stroke-linecap="round"><path d="M32 14 V50"/><path d="M16 23 L48 41"/><path d="M48 23 L16 41"/></g><path d="M27 17 L32 13 L37 17 M27 47 L32 51 L37 47" stroke="${c}" stroke-width="3" fill="none"/></svg>`,
    blood: (c = '#e6d3a3') => `<svg viewBox="0 0 64 64"><path d="M10 6 L54 6 L54 34 Q54 54 32 60 Q10 54 10 34 Z" fill="#5e1020" stroke="#1a0508" stroke-width="3"/><path d="M14 14 Q32 26 50 14 Q46 30 32 30 Q18 30 14 14 Z" fill="#1a0508"/><path d="M24 26 L27 42 L30 28 M34 28 L37 42 L40 26" fill="${c}"/><circle cx="32" cy="49" r="3.5" fill="#d0233f"/></svg>`,
    sylvan: (c = '#ecd27a') => `<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="27" fill="#1f4a26" stroke="${c}" stroke-width="3"/><path d="M32 10 Q50 26 32 54 Q14 26 32 10 Z" fill="#4fae5a" stroke="${c}" stroke-width="2"/><path d="M32 16 V50 M32 28 L24 22 M32 36 L41 29 M32 44 L25 38" stroke="${c}" stroke-width="2" fill="none"/></svg>`,
  });
  Object.assign(RW.ICON_PATHS, {
    wing: '<path d="M2 18 Q10 6 30 6 Q24 12 26 14 Q18 14 20 18 Q12 18 14 22 Q8 22 2 18 Z" fill="currentColor"/><circle cx="6" cy="24" r="3" fill="currentColor"/>',
    snow: '<path d="M16 2 V30 M3 9 L29 23 M29 9 L3 23" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>',
    drop: '<path d="M16 2 Q28 18 24 24 Q20 30 16 30 Q12 30 8 24 Q4 18 16 2 Z" fill="currentColor"/>',
    leaf: '<path d="M4 28 Q4 6 28 4 Q28 26 6 28 Z" fill="currentColor"/><path d="M4 28 L20 12" stroke="#000" stroke-width="1.5" opacity=".4"/>',
    root: '<path d="M16 2 V14 Q8 18 4 30 M16 14 Q24 18 28 30 M16 14 V30" stroke="currentColor" stroke-width="3" fill="none"/>',
    star: '<path d="M16 2 L20 12 L30 12 L22 18 L25 29 L16 22 L7 29 L10 18 L2 12 L12 12 Z" fill="currentColor"/>',
    bolt: '<path d="M18 2 L6 18 L15 18 L12 30 L26 12 L17 12 Z" fill="currentColor"/>',
    eye: '<path d="M2 16 Q16 2 30 16 Q16 30 2 16 Z" fill="currentColor"/><circle cx="16" cy="16" r="5" fill="#000"/>',
    ram: '<path d="M2 20 L22 20 L22 14 L2 14 Z" fill="currentColor"/><path d="M22 10 L30 17 L22 24 Z" fill="currentColor"/><circle cx="7" cy="26" r="3" fill="currentColor"/><circle cx="17" cy="26" r="3" fill="currentColor"/>',
    tower: '<path d="M8 30 L8 6 L24 6 L24 30 Z" fill="currentColor"/><path d="M6 6 L26 6 M10 12 L22 12 M10 18 L22 18 M10 24 L22 24" stroke="#000" stroke-width="1.5" opacity=".5"/>',
    scroll: '<path d="M6 4 H24 Q28 4 28 8 V28 H10 Q6 28 6 24 Z" fill="currentColor"/><path d="M10 10 H22 M10 15 H22 M10 20 H18" stroke="#000" stroke-width="1.5" opacity=".5"/>',
    gem: '<path d="M8 4 H24 L30 12 L16 30 L2 12 Z" fill="currentColor"/>',
  });

  // ---------------------------------------------------------------- New units for existing factions
  unit('valor_crossbows', { name: 'Royal Arbalests', faction: 'valor', cat: 'ranged', count: 24, hp: 10, atk: 20, def: 20, dmg: 6, ap: 0.2, armor: 35, charge: 4, speed: 4.2, morale: 50, range: 70, ammo: 14, rdmg: 14, rap: 0.6, reload: 7, acc: 0.42, shield: 0.15, tier: 2, cost: 650,
    model: { kind: 'foot', body: 'mail', helm: 'kettle', weapon: 'bow', shield: true }, desc: 'Heavy crossbows that punch through armour. Shorter range than longbows.' });
  unit('valor_pegasus', { name: 'Pegasus Knights', faction: 'valor', cat: 'cav', fly: true, count: 10, hp: 22, atk: 36, def: 28, dmg: 11, ap: 0.3, armor: 45, charge: 34, speed: 14, morale: 66, large: true, tier: 2, cost: 1100,
    model: { kind: 'mounted', mount: 'pegasus', rider: { body: 'plate', helm: 'great', weapon: 'lance' } }, desc: 'Winged knights who fly over walls and rivers to strike archers and engines.' });
  unit('valor_paladins', { name: 'Paladins of the Sun', faction: 'valor', cat: 'inf', count: 30, hp: 15, atk: 54, def: 50, dmg: 12, ap: 0.4, armor: 75, charge: 14, speed: 4.2, morale: 92, shield: 0.4, tier: 3, rare: { tech: 'mil2', wins: 3 }, cost: 1650,
    model: { kind: 'foot', body: 'plate', helm: 'crown', weapon: 'sword', shield: true, scale: 1.08 }, desc: 'Rare: holy warriors in gilded plate. Nearly unbreakable.' });
  unit('valor_guardian', { name: 'Bronze Guardian', faction: 'valor', cat: 'monster', count: 1, hp: 700, atk: 46, def: 40, dmg: 70, ap: 0.5, armor: 70, charge: 50, speed: 4.6, morale: 100, large: true, fear: true, cleave: 4, tier: 3, rare: { tech: 'mil3', wins: 5 }, cost: 1900,
    model: { kind: 'beast', type: 'guardian' }, desc: 'Legendary: a towering bronze statue awakened by the Dawn priests.' });
  unit('horde_firearchers', { name: 'Goblin Fire Archers', faction: 'horde', cat: 'ranged', count: 30, hp: 8, atk: 18, def: 14, dmg: 5, ap: 0.1, armor: 10, charge: 4, speed: 4.8, morale: 38, range: 65, ammo: 12, rdmg: 9, rap: 0.5, reload: 6, acc: 0.34, cost: 400,
    model: { kind: 'foot', body: 'rags', skin: '#7a9a3e', helm: 'hood', hoodCol: '#5a3a1a', weapon: 'bow', scale: 0.85 }, desc: 'Goblins loosing burning arrows. Fragile, but the fire burns through armour.' });
  unit('horde_boars', { name: 'Boar Crushers', faction: 'horde', cat: 'cav', count: 14, hp: 24, atk: 40, def: 28, dmg: 13, ap: 0.35, armor: 45, charge: 44, speed: 11, morale: 62, large: true, tier: 2, cost: 1000,
    model: { kind: 'mounted', mount: 'boar', rider: { body: 'scrap', skin: '#5f7d3a', helm: 'horns', weapon: 'axe' } }, desc: 'Armoured orcs on war-boars. A brutal shock charge.' });
  unit('horde_berserkers', { name: 'Ironjaw Berserkers', faction: 'horde', cat: 'inf', count: 32, hp: 17, atk: 52, def: 26, dmg: 14, ap: 0.35, armor: 30, charge: 20, speed: 5, morale: 70, tier: 2, cost: 950,
    model: { kind: 'foot', body: 'rags', skin: '#4f6a2b', helm: 'horns', weapon: 'axe', scale: 1.22 }, desc: 'Frenzied elite orcs who hit like hammers but wear little armour.' });
  unit('horde_wyverns', { name: 'Wyvern Riders', faction: 'horde', cat: 'cav', fly: true, count: 6, hp: 55, atk: 40, def: 24, dmg: 18, ap: 0.4, armor: 30, charge: 40, speed: 12.5, morale: 60, large: true, fear: true, tier: 2, rare: { tech: 'mil2', wins: 3 }, cost: 1150,
    model: { kind: 'mounted', mount: 'wyvern', rider: { body: 'rags', skin: '#5f7d3a', helm: 'none', weapon: 'spear' } }, desc: 'Rare: goblins on venomous wyverns that swoop on archers.' });
  unit('horde_chosen', { name: "Warlord's Chosen", faction: 'horde', cat: 'inf', count: 24, hp: 24, atk: 58, def: 42, dmg: 16, ap: 0.45, armor: 60, charge: 22, speed: 4.6, morale: 90, shield: 0.25, tier: 3, rare: { tech: 'mil3', wins: 5 }, cost: 1550,
    model: { kind: 'foot', body: 'scrap', skin: '#3f5a22', helm: 'horns', weapon: 'axe', shield: true, scale: 1.4 }, desc: 'Legendary: the biggest, meanest orcs in the Horde, clad in black iron.' });
  unit('arcane_lancers', { name: 'Arcane Lancers', faction: 'arcane', cat: 'cav', count: 14, hp: 22, atk: 40, def: 32, dmg: 13, ap: 0.5, armor: 55, charge: 40, speed: 12, morale: 66, large: true, tier: 2, cost: 1150,
    model: { kind: 'mounted', mount: 'horse', barding: true, coat: '#d8d3ea', rider: { body: 'plate', helm: 'circlet', weapon: 'lance', shield: true } }, desc: 'Knights with rune-charged lances that pierce any armour.' });
  unit('arcane_runeguard', { name: 'Runeguard', faction: 'arcane', cat: 'inf', count: 30, hp: 14, atk: 44, def: 46, dmg: 11, ap: 0.5, armor: 70, charge: 10, speed: 4.2, morale: 85, shield: 0.4, tier: 3, rare: { tech: 'mil2', wins: 3 }, cost: 1050,
    model: { kind: 'foot', body: 'plate', helm: 'great', weapon: 'glaive', shield: true, scale: 1.08 }, desc: 'Rare: elite guardians whose armour drinks in spells.' });
  unit('arcane_drake', { name: 'Storm Drake', faction: 'arcane', cat: 'monster', fly: true, count: 1, hp: 760, atk: 48, def: 30, dmg: 70, ap: 0.6, armor: 45, charge: 60, speed: 12, morale: 90, large: true, fear: true, cleave: 4, tier: 3, rare: { tech: 'mil3', wins: 5 }, cost: 2300,
    model: { kind: 'beast', type: 'drake' }, desc: 'Legendary: a lightning-wreathed drake bound to the archons.' });

  // ---------------------------------------------------------------- Frostborn Clans
  unit('frost_huskarls', { name: 'Shieldbearer Huskarls', faction: 'frost', cat: 'inf', count: 36, hp: 12, atk: 32, def: 40, dmg: 8.5, ap: 0.25, armor: 52, charge: 10, speed: 4.0, morale: 60, shield: 0.4, cost: 530,
    model: { kind: 'foot', body: 'fur', helm: 'nasal', weapon: 'axe', shield: true }, desc: 'Fur-clad shield warriors. They hold the line in any weather.' });
  unit('frost_spears', { name: 'Fjord Spearmen', faction: 'frost', cat: 'inf', count: 36, hp: 11, atk: 26, def: 36, dmg: 7.5, ap: 0.25, armor: 40, charge: 8, speed: 4.0, morale: 52, antiLarge: 14, shield: 0.25, cost: 370,
    model: { kind: 'foot', body: 'fur', helm: 'kettle', weapon: 'spear', shield: true }, desc: 'Long spears against cavalry and beasts.' });
  unit('frost_hunters', { name: 'Glacier Hunters', faction: 'frost', cat: 'ranged', count: 28, hp: 10, atk: 22, def: 18, dmg: 6, ap: 0.2, armor: 25, charge: 6, speed: 4.4, morale: 45, range: 72, ammo: 14, rdmg: 9, rap: 0.3, reload: 5.5, acc: 0.37, cost: 420,
    model: { kind: 'foot', body: 'fur', helm: 'hood', hoodCol: '#dfe8ee', weapon: 'bow' }, desc: 'Hunters with heavy bows of whalebone.' });
  unit('frost_witches', { name: 'Winter Witches', faction: 'frost', cat: 'ranged', count: 16, hp: 10, atk: 16, def: 16, dmg: 5, ap: 0.5, armor: 15, charge: 2, speed: 4.4, morale: 55, range: 80, ammo: 12, rdmg: 14, rap: 0.7, reload: 6, acc: 0.45, slowOnHit: true, tier: 2, cost: 650,
    model: { kind: 'foot', body: 'robe', helm: 'hood', hoodCol: '#eaf4ff', weapon: 'staff' }, desc: 'Ice-shard sorcery that pierces armour and chills the target (slowed).' });
  unit('frost_rimeguard', { name: 'Rimeguard', faction: 'frost', cat: 'inf', count: 32, hp: 14, atk: 42, def: 44, dmg: 11, ap: 0.4, armor: 70, charge: 12, speed: 3.9, morale: 80, shield: 0.3, tier: 2, cost: 1020,
    model: { kind: 'foot', body: 'plate', helm: 'horns', weapon: 'axe', shield: true, scale: 1.08 }, desc: 'Elite infantry in rime-hardened plate. Extremely hard to kill.' });
  unit('frost_wolves', { name: 'Frost Wolf Pack', faction: 'frost', cat: 'cav', count: 14, hp: 18, atk: 34, def: 20, dmg: 10, ap: 0.2, armor: 20, charge: 26, speed: 14, morale: 50, large: true, cost: 620,
    model: { kind: 'mounted', mount: 'wolf', coat: '#cfd8df', rider: null }, desc: 'Great white wolves that hunt archers and stragglers.' });
  unit('frost_bears', { name: 'Ursine Riders', faction: 'frost', cat: 'cav', count: 12, hp: 30, atk: 40, def: 34, dmg: 13, ap: 0.35, armor: 55, charge: 40, speed: 10, morale: 70, large: true, tier: 2, cost: 1080,
    model: { kind: 'mounted', mount: 'bear', rider: { body: 'fur', helm: 'horns', weapon: 'axe' } }, desc: 'Armoured warriors riding war bears. Slow for cavalry, but crushing.' });
  unit('frost_eagles', { name: 'Storm Eagles', faction: 'frost', cat: 'cav', fly: true, count: 10, hp: 20, atk: 32, def: 22, dmg: 9, ap: 0.2, armor: 20, charge: 26, speed: 15, morale: 55, large: true, tier: 2, cost: 820,
    model: { kind: 'mounted', mount: 'eagle', rider: null }, desc: 'Giant eagles of the peaks. They dive on engines and missile troops.' });
  unit('frost_giant', { name: 'Frost Giants', faction: 'frost', cat: 'monster', count: 2, hp: 300, atk: 44, def: 30, dmg: 48, ap: 0.5, armor: 40, charge: 48, speed: 6, morale: 75, large: true, fear: true, cleave: 4, tier: 2, cost: 1220,
    model: { kind: 'beast', type: 'giant' }, desc: 'Towering giants that hurl men aside with each swing.' });
  unit('frost_ballista', { name: 'Ice Ballista', faction: 'frost', cat: 'siege', count: 2, hp: 60, atk: 8, def: 8, dmg: 4, ap: 0, armor: 30, charge: 0, speed: 2.6, morale: 50, range: 150, ammo: 22, rdmg: 50, rap: 0.7, reload: 7.5, acc: 0.6, splash: 2.6, tier: 2, cost: 800,
    model: { kind: 'siege', type: 'ballista', crystal: '#cfeaff' }, desc: 'Fires bolts of enchanted ice with armour-piercing splash.' });
  unit('frost_mammoth', { name: 'Ancient Mammoth', faction: 'frost', cat: 'monster', count: 1, hp: 980, atk: 50, def: 30, dmg: 90, ap: 0.5, armor: 55, charge: 80, speed: 7, morale: 85, large: true, fear: true, cleave: 5, tier: 3, rare: { tech: 'mil3', wins: 5 }, cost: 2300,
    model: { kind: 'beast', type: 'mammoth' }, desc: 'Legendary: a war mammoth with a howdah of hunters. Tramples whole regiments.' });
  unit('frost_general', { name: "Jarl's Hearthguard", faction: 'frost', cat: 'general', count: 8, hp: 46, atk: 54, def: 46, dmg: 15, ap: 0.4, armor: 65, charge: 26, speed: 5, morale: 88, recruitable: false, cost: 0, upkeep: 0,
    model: { kind: 'foot', body: 'plate', helm: 'horns', weapon: 'axe', shield: true, scale: 1.2 }, desc: 'The jarl and his sworn hearthguard. Inspires nearby troops.' });

  // ---------------------------------------------------------------- Bloodfang Empire
  unit('blood_skeletons', { name: 'Skeleton Legion', faction: 'blood', cat: 'inf', count: 40, hp: 9, atk: 26, def: 30, dmg: 7, ap: 0.2, armor: 32, charge: 8, speed: 4.2, morale: 60, shield: 0.25, cost: 290,
    model: { kind: 'foot', body: 'bone', skin: '#e6e0cc', helm: 'none', weapon: 'sword', shield: true }, desc: 'Cheap, numberless dead. They break easily but keep coming.' });
  unit('blood_ghouls', { name: 'Ghoul Packs', faction: 'blood', cat: 'inf', count: 36, hp: 12, atk: 40, def: 18, dmg: 10, ap: 0.3, armor: 10, charge: 16, speed: 5.4, morale: 45, cost: 420,
    model: { kind: 'foot', body: 'rags', skin: '#8a9a8a', helm: 'none', weapon: 'club', scale: 0.95 }, desc: 'Fast, vicious flesh-eaters. Excellent for flanking.' });
  unit('blood_archers', { name: 'Bone Archers', faction: 'blood', cat: 'ranged', count: 30, hp: 9, atk: 16, def: 16, dmg: 5, ap: 0.1, armor: 20, charge: 2, speed: 4.2, morale: 45, range: 72, ammo: 14, rdmg: 8, rap: 0.2, reload: 5.5, acc: 0.35, cost: 360,
    model: { kind: 'foot', body: 'bone', skin: '#e6e0cc', helm: 'hood', weapon: 'bow' }, desc: 'Skeletal archers. Unremarkable, but cheap.' });
  unit('blood_mages', { name: 'Blood Mages', faction: 'blood', cat: 'ranged', count: 16, hp: 11, atk: 18, def: 18, dmg: 6, ap: 0.5, armor: 20, charge: 2, speed: 4.4, morale: 60, range: 75, ammo: 12, rdmg: 16, rap: 0.7, reload: 6, acc: 0.45, tier: 2, cost: 650,
    model: { kind: 'foot', body: 'robe', helm: 'tall', weapon: 'staff' }, desc: 'Vampire sorcerers hurling bolts of boiling blood.' });
  unit('blood_guard', { name: 'Crimson Guard', faction: 'blood', cat: 'inf', count: 30, hp: 14, atk: 48, def: 40, dmg: 12, ap: 0.4, armor: 60, charge: 14, speed: 4.6, morale: 78, tier: 2, cost: 980,
    model: { kind: 'foot', body: 'plate', helm: 'great', weapon: 'halberd', scale: 1.06 }, desc: 'Elite vampire-thralls with great halberds. Bonus against large foes.', antiLarge: 16 });
  unit('blood_riders', { name: 'Dread Riders', faction: 'blood', cat: 'cav', count: 16, hp: 18, atk: 34, def: 22, dmg: 10, ap: 0.25, armor: 30, charge: 30, speed: 13, morale: 55, large: true, cost: 660,
    model: { kind: 'mounted', mount: 'horse', coat: '#2a2226', rider: { body: 'bone', skin: '#e6e0cc', helm: 'none', weapon: 'spear' } }, desc: 'Skeletal horsemen on nightmare steeds.' });
  unit('blood_knights', { name: 'Vampire Knights', faction: 'blood', cat: 'cav', count: 14, hp: 26, atk: 46, def: 34, dmg: 14, ap: 0.4, armor: 60, charge: 46, speed: 12, morale: 80, large: true, fear: true, tier: 2, cost: 1200,
    model: { kind: 'mounted', mount: 'horse', barding: true, coat: '#1e1a1c', rider: { body: 'plate', helm: 'great', weapon: 'lance', shield: true } }, desc: 'Deathless knights. The finest heavy cavalry in the realms.' });
  unit('blood_bats', { name: 'Vampire Bats', faction: 'blood', cat: 'cav', fly: true, count: 16, hp: 12, atk: 30, def: 20, dmg: 7, ap: 0.2, armor: 10, charge: 20, speed: 16, morale: 45, large: true, cost: 520,
    model: { kind: 'mounted', mount: 'bat', rider: null }, desc: 'Swarms of giant bats. Fast fliers that harass missile troops.' });
  unit('blood_horror', { name: 'Flesh Horrors', faction: 'blood', cat: 'monster', count: 2, hp: 280, atk: 44, def: 26, dmg: 44, ap: 0.45, armor: 30, charge: 40, speed: 6, morale: 80, large: true, fear: true, cleave: 3, regen: 1, tier: 2, cost: 1250,
    model: { kind: 'beast', type: 'horror' }, desc: 'Stitched abominations that knit their wounds closed.' });
  unit('blood_catapult', { name: 'Skull Catapult', faction: 'blood', cat: 'siege', count: 2, hp: 60, atk: 8, def: 8, dmg: 4, ap: 0, armor: 20, charge: 0, speed: 2.6, morale: 60, range: 140, ammo: 20, rdmg: 58, rap: 0.4, reload: 9, acc: 0.5, splash: 3, tier: 2, cost: 760,
    model: { kind: 'siege', type: 'catapult' }, desc: 'Hurls screaming skulls that terrify those they strike.' });
  unit('blood_dragon', { name: 'Undead Dragon', faction: 'blood', cat: 'monster', fly: true, count: 1, hp: 900, atk: 50, def: 32, dmg: 78, ap: 0.5, armor: 50, charge: 60, speed: 11, morale: 95, large: true, fear: true, cleave: 4, tier: 3, rare: { tech: 'mil3', wins: 5 }, cost: 2400,
    model: { kind: 'beast', type: 'dragon' }, desc: 'Legendary: a dead dragon raised by blood sorcery.' });
  unit('blood_general', { name: 'Vampire Lord & Thralls', faction: 'blood', cat: 'general', count: 8, hp: 42, atk: 56, def: 44, dmg: 15, ap: 0.4, armor: 60, charge: 42, speed: 11, morale: 90, large: true, recruitable: false, cost: 0, upkeep: 0,
    model: { kind: 'mounted', mount: 'horse', barding: true, coat: '#151214', rider: { body: 'plate', helm: 'crown', weapon: 'sword', shield: true } }, desc: 'An ancient vampire lord and its thralls.' });

  // ---------------------------------------------------------------- Sylvan Covenant
  unit('sylvan_spears', { name: 'Glade Wardens', faction: 'sylvan', cat: 'inf', count: 36, hp: 10, atk: 30, def: 32, dmg: 8, ap: 0.25, armor: 28, charge: 10, speed: 5, morale: 55, antiLarge: 12, shield: 0.2, cost: 440,
    model: { kind: 'foot', body: 'leaf', helm: 'circlet', weapon: 'spear', shield: true }, desc: 'Light elven spears. Quick, but lightly armoured.' });
  unit('sylvan_blades', { name: 'Bladedancers', faction: 'sylvan', cat: 'inf', count: 30, hp: 11, atk: 50, def: 34, dmg: 11, ap: 0.4, armor: 28, charge: 14, speed: 5.4, morale: 68, tier: 2, cost: 940,
    model: { kind: 'foot', body: 'leaf', helm: 'hood', hoodCol: '#2f6b36', weapon: 'sword' }, desc: 'Whirling twin-blade duellists. Lethal, but they hate a long slog.' });
  unit('sylvan_archers', { name: 'Sylvan Longbows', faction: 'sylvan', cat: 'ranged', count: 30, hp: 9, atk: 22, def: 18, dmg: 6, ap: 0.2, armor: 15, charge: 4, speed: 5, morale: 48, range: 95, ammo: 16, rdmg: 9, rap: 0.3, reload: 5.5, acc: 0.38, cost: 560,
    model: { kind: 'foot', body: 'leaf', helm: 'hood', weapon: 'bow' }, desc: 'The best archers in the realms: long range and plenty of arrows.' });
  unit('sylvan_rangers', { name: 'Waystalkers', faction: 'sylvan', cat: 'ranged', count: 20, hp: 10, atk: 28, def: 22, dmg: 7, ap: 0.3, armor: 20, charge: 6, speed: 5.4, morale: 60, range: 100, ammo: 14, rdmg: 12, rap: 0.5, reload: 5.5, acc: 0.48, tier: 2, cost: 900,
    model: { kind: 'foot', body: 'leaf', helm: 'hood', hoodCol: '#1c3a20', weapon: 'bow' }, desc: 'Elite scouts with armour-piercing arrows. Deadly accurate.' });
  unit('sylvan_riders', { name: 'Wild Riders', faction: 'sylvan', cat: 'cav', count: 16, hp: 15, atk: 32, def: 22, dmg: 9, ap: 0.2, armor: 20, charge: 28, speed: 15, morale: 52, large: true, cost: 600,
    model: { kind: 'mounted', mount: 'horse', coat: '#c9b48a', rider: { body: 'leaf', helm: 'circlet', weapon: 'spear' } }, desc: 'The swiftest horsemen alive.' });
  unit('sylvan_stags', { name: 'Great Stag Knights', faction: 'sylvan', cat: 'cav', count: 12, hp: 26, atk: 40, def: 32, dmg: 12, ap: 0.35, armor: 48, charge: 42, speed: 13, morale: 70, large: true, tier: 2, cost: 1150,
    model: { kind: 'mounted', mount: 'stag', rider: { body: 'plate', helm: 'circlet', weapon: 'lance', shield: true } }, desc: 'Noble knights on giant stags. A swift, heavy charge.' });
  unit('sylvan_hawks', { name: 'Hawk Riders', faction: 'sylvan', cat: 'cav', fly: true, count: 10, hp: 18, atk: 32, def: 22, dmg: 10, ap: 0.25, armor: 20, charge: 28, speed: 17, morale: 58, large: true, tier: 2, cost: 820,
    model: { kind: 'mounted', mount: 'eagle', coat: '#8a6a3a', rider: { body: 'leaf', helm: 'circlet', weapon: 'spear' } }, desc: 'Elves on great hawks. The fastest flyers anywhere.' });
  unit('sylvan_treants', { name: 'Treants', faction: 'sylvan', cat: 'monster', count: 2, hp: 300, atk: 40, def: 34, dmg: 40, ap: 0.4, armor: 55, charge: 30, speed: 4.6, morale: 90, large: true, fear: true, cleave: 3, regen: 1.5, tier: 2, cost: 1350,
    model: { kind: 'beast', type: 'treant' }, desc: 'Walking trees. Slow and fearsome, and they slowly regrow.' });
  unit('sylvan_bolt', { name: 'Eagle Bolt Thrower', faction: 'sylvan', cat: 'siege', count: 2, hp: 50, atk: 8, def: 8, dmg: 4, ap: 0, armor: 20, charge: 0, speed: 3, morale: 55, range: 160, ammo: 24, rdmg: 44, rap: 0.8, reload: 7, acc: 0.65, splash: 2.2, tier: 2, cost: 800,
    model: { kind: 'siege', type: 'ballista', crystal: '#b6f0a0' }, desc: 'A precise elven bolt thrower with the longest range of all.' });
  unit('sylvan_treelord', { name: 'Ancient Treelord', faction: 'sylvan', cat: 'monster', count: 1, hp: 1000, atk: 50, def: 36, dmg: 84, ap: 0.5, armor: 60, charge: 40, speed: 5, morale: 100, large: true, fear: true, cleave: 5, regen: 3, tier: 3, rare: { tech: 'mil3', wins: 5 }, cost: 2300,
    model: { kind: 'beast', type: 'treelord' }, desc: 'Legendary: the oldest of the treants, roused from a thousand-year sleep.' });
  unit('sylvan_general', { name: 'Glade Lord & Guard', faction: 'sylvan', cat: 'general', count: 8, hp: 38, atk: 54, def: 42, dmg: 13, ap: 0.4, armor: 45, charge: 40, speed: 13, morale: 85, large: true, recruitable: false, cost: 0, upkeep: 0,
    model: { kind: 'mounted', mount: 'stag', rider: { body: 'plate', helm: 'crown', weapon: 'sword', shield: true } }, desc: 'A glade lord on a white stag with the royal guard.' });

  // Siege equipment (never recruited: provided to attackers in sieges).
  unit('siege_ram', { name: 'Battering Ram', faction: 'rebels', cat: 'siege', equip: 'ram', icon: 'ram', count: 1, hp: 220, atk: 5, def: 20, dmg: 4, ap: 0, armor: 70, charge: 0, speed: 3.2, morale: 100, recruitable: false, cost: 0, upkeep: 0,
    model: { kind: 'siege', type: 'ram' }, desc: 'Order it to a gate to smash it open. Heavily armoured roof.' });
  unit('siege_tower', { name: 'Siege Tower', faction: 'rebels', cat: 'siege', equip: 'tower', icon: 'tower', count: 1, hp: 260, atk: 5, def: 20, dmg: 4, ap: 0, armor: 60, charge: 0, speed: 2.8, morale: 100, recruitable: false, cost: 0, upkeep: 0,
    model: { kind: 'siege', type: 'tower' }, desc: 'Move it against the wall: once docked it opens a new way over the wall.' });

  D.GARRISONS.frost = ['frost_spears', 'frost_hunters', 'frost_huskarls', 'frost_spears', 'frost_hunters', 'frost_huskarls', 'frost_spears', 'frost_hunters'];
  D.GARRISONS.blood = ['blood_skeletons', 'blood_archers', 'blood_skeletons', 'blood_ghouls', 'blood_skeletons', 'blood_archers', 'blood_ghouls', 'blood_skeletons'];
  D.GARRISONS.sylvan = ['sylvan_spears', 'sylvan_archers', 'sylvan_spears', 'sylvan_archers', 'sylvan_spears', 'sylvan_archers', 'sylvan_spears', 'sylvan_archers'];

  D.COMMANDER_NAMES.frost = ['Jarl Eirik Stormhand', 'Hilda Ice-Eye', 'Bjorn the Unbowed', 'Ragna Whitecloak', 'Torvald Rimebeard', 'Sigrun Wolfsister', 'Ulf Greyhammer', 'Astrid Snowveil'];
  D.COMMANDER_NAMES.blood = ['Count Vasil Draugh', 'Baroness Selene Mor', 'Lord Kaszimir', 'Duchess Ilona Vey', 'Count Radu Ashgrave', 'Lady Mirela Thorn', 'Viscount Osmund Black', 'Margravine Sabra'];
  D.COMMANDER_NAMES.sylvan = ['Lord Aerith Dawnleaf', 'Lady Sylwen Brightbough', 'Thalion Swiftarrow', 'Elara Moonglade', 'Faelar Greenmantle', 'Ilythra Starwhisper', 'Caelir Oakenshield', 'Nym Willowshade'];
  D.FACTION_TRAITS.frost = ['shieldwall', 'beastmaster', 'outrider', 'inspiring', 'quartermaster', 'siegebreaker', 'tactician'];
  D.FACTION_TRAITS.blood = ['bloodthirsty', 'outrider', 'beastmaster', 'inspiring', 'spellweaver', 'quartermaster', 'tactician'];
  D.FACTION_TRAITS.sylvan = ['eagleeye', 'outrider', 'beastmaster', 'inspiring', 'spellweaver', 'quartermaster', 'tactician'];
  D.UPGRADES.frost = [
    { id: 'f_rime', name: 'Rime-Forged Steel', desc: 'Infantry +10 armour.', cost: 900, wins: 1, apply: { cats: ['inf', 'general'], armor: 10 } },
    { id: 'f_horns', name: 'Horns of the North', desc: 'All units +10 morale.', cost: 900, wins: 1, apply: { cats: ['all'], morale: 10 } },
    { id: 'f_giants', name: 'Giant Kin', desc: 'Monsters +15% health.', cost: 1200, wins: 2, apply: { cats: ['monster'], hpMul: 1.15 } },
    { id: 'f_bows', name: 'Whalebone Bows', desc: 'Ranged units +10 range.', cost: 900, wins: 2, apply: { cats: ['ranged'], range: 10 } },
  ];
  D.UPGRADES.blood = [
    { id: 'b_fangs', name: 'Sharpened Fangs', desc: 'All units +10% melee damage.', cost: 900, wins: 1, apply: { cats: ['all'], dmgMul: 1.1 } },
    { id: 'b_bone', name: 'Bone Armour', desc: 'Infantry +8 armour.', cost: 800, wins: 1, apply: { cats: ['inf'], armor: 8 } },
    { id: 'b_steeds', name: 'Nightmare Steeds', desc: 'Cavalry +10 charge.', cost: 1100, wins: 2, apply: { cats: ['cav', 'general'], charge: 10 } },
    { id: 'b_dread', name: 'Dread Aura', desc: 'All units +10 morale.', cost: 1300, wins: 3, apply: { cats: ['all'], morale: 10 } },
  ];
  D.UPGRADES.sylvan = [
    { id: 's_heart', name: 'Heartwood Bows', desc: 'Ranged units +15% missile damage.', cost: 1000, wins: 1, apply: { cats: ['ranged', 'siege'], rdmgMul: 1.15 } },
    { id: 's_bark', name: 'Barkskin', desc: 'Infantry and monsters +8 armour.', cost: 900, wins: 1, apply: { cats: ['inf', 'monster'], armor: 8 } },
    { id: 's_wind', name: 'Windrunners', desc: 'Cavalry +10% speed.', cost: 900, wins: 2, apply: { cats: ['cav'], speedMul: 1.1 } },
    { id: 's_song', name: 'Song of the Glade', desc: 'All units +10 morale.', cost: 1200, wins: 3, apply: { cats: ['all'], morale: 10 } },
  ];

  // ---------------------------------------------------------------- Abilities (data-driven via effect specs)
  // kind: area_damage | ally_area | enemy_area | type_buff | self_buff
  const A = D.ABILITIES;
  function ab(id, o) { A[id] = Object.assign({ id, radius: 0, target: 'point' }, o); }
  ab('frozen_ground', { name: 'Frozen Ground', faction: 'frost', icon: 'snow', cd: 50, radius: 16, color: '#bfe8ff',
    desc: 'Ice spreads across the ground: enemies in the area move 50% slower for 14s.', effect: { kind: 'enemy_area', buff: { name: 'Frozen', speedMul: 0.5, t: 14 }, fx: 'frost' } });
  ab('winters_howl', { name: "Winter's Howl", faction: 'frost', icon: 'horn', cd: 60, radius: 24, color: '#9fd8ff',
    desc: 'A freezing gale of howls: enemies in the area lose 20 morale and 6 defence for 15s.', effect: { kind: 'enemy_area', morale: 20, buff: { name: 'Chilled', def: -6, t: 15 }, fx: 'frost' } });
  ab('rime_armour', { name: 'Rime Armour', faction: 'frost', icon: 'shield', cd: 75, radius: 18, color: '#dff2ff',
    desc: 'Allies in the area gain +25 armour and +10 morale for 20s.', effect: { kind: 'ally_area', morale: 10, buff: { name: 'Rime Armour', armor: 25, morale: 10, t: 20 }, fx: 'frost' } });
  ab('blizzard', { name: 'Blizzard', faction: 'frost', icon: 'snow', cd: 110, radius: 20, color: '#ffffff', ultimate: true,
    desc: 'Ultimate: a howling blizzard slows enemies by 60% for 12s and freezes some to death.', effect: { kind: 'enemy_area', dmg: 6, ap: 0.6, buff: { name: 'Blizzard', speedMul: 0.4, t: 12 }, fx: 'frost' } });
  ab('blood_harvest', { name: 'Blood Harvest', faction: 'blood', icon: 'drop', cd: 60, radius: 26, color: '#ff3a55',
    desc: 'For 20s, allies in the area restore health whenever they slay enemies (60% of each kill).', effect: { kind: 'ally_area', buff: { name: 'Blood Harvest', harvest: 0.6, t: 20 }, fx: 'blood' } });
  ab('crimson_mist', { name: 'Crimson Mist', faction: 'blood', icon: 'eye', cd: 65, radius: 22, color: '#c02040',
    desc: 'Allies in the area turn to mist: +25% speed and missiles hit them 40% less for 15s.', effect: { kind: 'ally_area', buff: { name: 'Crimson Mist', speedMul: 1.25, missileMul: 0.6, t: 15 }, fx: 'blood' } });
  ab('raise_dead', { name: 'Raise the Dead', faction: 'blood', icon: 'skull', cd: 90, radius: 16, color: '#b8ff9a',
    desc: 'Fallen soldiers of allied units in the area rise again (restores 30% of losses).', effect: { kind: 'ally_area', heal: 0.3, fx: 'blood' } });
  ab('night_terror', { name: 'Night Terror', faction: 'blood', icon: 'eye', cd: 110, radius: 24, color: '#8a1030', ultimate: true,
    desc: 'Ultimate: enemies in the area lose 30 morale and suffer -15% melee damage for 15s.', effect: { kind: 'enemy_area', morale: 30, buff: { name: 'Terrified', dmgMul: 0.85, t: 15 }, fx: 'blood' } });
  ab('natures_wrath', { name: "Nature's Wrath", faction: 'sylvan', icon: 'root', cd: 55, radius: 12, color: '#7ad860',
    desc: 'Roots burst from the earth, trapping enemies in the area for 8s (cannot move) and wounding a few.', effect: { kind: 'enemy_area', dmg: 3, ap: 0.5, buff: { name: 'Rooted', speedMul: 0.02, t: 8 }, fx: 'roots' } });
  ab('swift_wind', { name: 'Swift Wind', faction: 'sylvan', icon: 'leaf', cd: 60, target: 'self',
    color: '#c8ffb0', desc: 'All your units gain +25% speed for 15s.', effect: { kind: 'type_buff', cats: ['all'], buff: { name: 'Swift Wind', speedMul: 1.25, t: 15 } } });
  ab('regrowth', { name: 'Regrowth', faction: 'sylvan', icon: 'leaf', cd: 85, radius: 16, color: '#9effa0',
    desc: 'Allies in the area restore 25% of lost soldiers.', effect: { kind: 'ally_area', heal: 0.25, fx: 'roots' } });
  ab('wild_hunt', { name: 'The Wild Hunt', faction: 'sylvan', icon: 'horse', cd: 100, target: 'self', color: '#e8ff9a', ultimate: true,
    desc: 'Ultimate: cavalry and flyers gain +30% speed and +80% charge for 15s.', effect: { kind: 'type_buff', cats: ['cav'], buff: { name: 'Wild Hunt', speedMul: 1.3, chargeMul: 1.8, t: 15 } } });
  ab('divine_shield', { name: 'Divine Shield', faction: 'valor', icon: 'sun', cd: 110, radius: 20, color: '#fff3b0', ultimate: true,
    desc: 'Ultimate: allies in the area gain +30 armour and +20 morale for 20s.', effect: { kind: 'ally_area', morale: 20, buff: { name: 'Divine Shield', armor: 30, morale: 20, t: 20 }, fx: 'holy' } });
  ab('ash_storm', { name: 'Ash Storm', faction: 'horde', icon: 'fire', cd: 110, radius: 16, color: '#ff7a3a', ultimate: true,
    desc: 'Ultimate: burning ash rains down: damage and -20 morale to enemies in the area.', effect: { kind: 'enemy_area', dmg: 9, ap: 0.5, morale: 20, fx: 'fire' } });
  ab('time_warp', { name: 'Time Warp', faction: 'arcane', icon: 'star', cd: 110, radius: 24, color: '#b48cff', ultimate: true,
    desc: 'Ultimate: allies in the area move 30% faster and reload twice as fast for 15s.', effect: { kind: 'ally_area', buff: { name: 'Time Warp', speedMul: 1.3, reloadMul: 0.5, t: 15 }, fx: 'arcane' } });

  // ---------------------------------------------------------------- Legendary commanders
  // Each has its own bodyguard unit (appearance), passive, two abilities, a starting bonus, backstory.
  const LEGENDS = {};
  function legend(id, o) {
    LEGENDS[id] = Object.assign({ id }, o);
    const base = U[D.FACTIONS[o.faction].general];
    unit('legend_' + id, Object.assign({}, base, { id: 'legend_' + id, name: o.name, cat: 'general', recruitable: false, cost: 0, upkeep: 0, legend: id,
      hp: Math.round(base.hp * 1.1), atk: base.atk + 4, def: base.def + 4, morale: base.morale + 5, model: o.model, desc: o.title }, o.stats || {}));
    for (const [i, a] of o.abilities.entries()) ab(a.id, Object.assign({ faction: o.faction, legend: id }, a));
    LEGENDS[id].abilityIds = o.abilities.map((a) => a.id);
  }
  legend('aelra', { faction: 'valor', name: 'Queen Aelra the Radiant', title: 'Queen of the Dawn Crown',
    model: { kind: 'mounted', mount: 'horse', barding: true, coat: '#f4f0e6', rider: { body: 'plate', helm: 'crown', weapon: 'sword', shield: true, scale: 1.1 } },
    passive: { name: 'Radiant Aura', desc: 'All units +8 morale; infantry +4 defence.', mods: { morale: 8, infDef: 4 } },
    start: { desc: '+600 gold and a unit of Royal Guard.', gold: 600, units: ['valor_guard'] },
    story: 'Crowned at sixteen after the Burning Winter, Aelra rode at the head of every charge that saved the kingdom. Her people say the dawn follows wherever her banner goes.',
    abilities: [
      { id: 'aelra_smite', name: 'Dawn Smite', icon: 'sun', cd: 45, radius: 7, color: '#fff3b0', desc: 'A lance of sunlight strikes the target area.', effect: { kind: 'area_damage', dmg: 11, ap: 0.8, morale: 10, fx: 'holy' } },
      { id: 'aelra_resolve', name: 'Unbroken Oath', icon: 'shield', cd: 70, radius: 26, color: '#ffe68a', desc: 'Allies in the area gain +35 morale and +10 armour for 15s; routing allies rally.', effect: { kind: 'ally_area', morale: 35, rally: true, buff: { name: 'Unbroken Oath', armor: 10, morale: 15, t: 15 }, fx: 'holy' } },
    ] });
  legend('corwin', { faction: 'valor', name: 'Sir Corwin Lionheart', title: 'Marshal of the Knights of the Dawn',
    model: { kind: 'mounted', mount: 'horse', barding: true, coat: '#6b4a2f', rider: { body: 'plate', helm: 'great', weapon: 'lance', shield: true, scale: 1.1 } },
    passive: { name: 'Lionheart', desc: 'Cavalry +10 charge and +5 attack.', mods: { cavCharge: 10, cavAtk: 5 } },
    start: { desc: 'Starts with a unit of Knights of the Dawn.', units: ['valor_knights'] },
    story: 'The only knight ever to unhorse a frost giant, Corwin has led a hundred charges and never sounded a retreat.',
    abilities: [
      { id: 'corwin_charge', name: 'Lion\'s Charge', icon: 'horse', cd: 50, target: 'self', color: '#ffd76a', desc: 'Corwin\'s bodyguard and all cavalry: +60% charge, +20% speed for 12s.', effect: { kind: 'type_buff', cats: ['cav', 'general'], buff: { name: "Lion's Charge", chargeMul: 1.6, speedMul: 1.2, t: 12 } } },
      { id: 'corwin_challenge', name: 'Challenge', icon: 'horn', cd: 60, radius: 20, color: '#ffb04a', desc: 'Enemies in the area lose 20 morale and 8 defence for 15s.', effect: { kind: 'enemy_area', morale: 20, buff: { name: 'Challenged', def: -8, t: 15 }, fx: 'holy' } },
    ] });
  legend('krug', { faction: 'horde', name: 'Krug Skullcleaver', title: 'Warlord of the Ashen Horde',
    model: { kind: 'foot', body: 'scrap', skin: '#3f5a22', helm: 'horns', weapon: 'axe', shield: true, scale: 1.5 },
    passive: { name: 'Bloody-Minded', desc: 'Infantry +10% melee damage.', mods: { infDmg: 1.1 } },
    start: { desc: 'Starts with two extra units of Grunt Rabble.', units: ['horde_grunts', 'horde_grunts'] },
    story: 'Krug took the Horde by cleaving the old warlord\'s skull in two in front of every chieftain. Nobody has argued with him since.',
    abilities: [
      { id: 'krug_frenzy', name: 'Skull-Taker', icon: 'skull', cd: 55, radius: 22, color: '#ff4a2a', desc: 'Allies in the area: +20% melee damage and +15 morale for 15s.', effect: { kind: 'ally_area', morale: 15, buff: { name: 'Skull-Taker', dmgMul: 1.2, morale: 15, t: 15 }, fx: 'fire' } },
      { id: 'krug_roar', name: 'Terrifying Roar', icon: 'quake', cd: 60, radius: 20, color: '#c48a3a', desc: 'Enemies in the area lose 25 morale.', effect: { kind: 'enemy_area', morale: 25, fx: 'fire' } },
    ] });
  legend('ashka', { faction: 'horde', name: 'Mother Ashka', title: 'The Beastcaller',
    model: { kind: 'mounted', mount: 'wolf', coat: '#3a3532', rider: { body: 'rags', skin: '#5f7d3a', helm: 'horns', weapon: 'staff', scale: 1.2 } },
    passive: { name: 'Beastcaller', desc: 'Monsters +15% health; cavalry +10 charge.', mods: { monHp: 1.15, cavCharge: 10 } },
    start: { desc: 'Starts with a unit of Cinder Trolls.', units: ['horde_trolls'] },
    story: 'Raised by wolves on the slopes of Ashfang, Ashka speaks to every beast of the burning east, and they come when she calls.',
    abilities: [
      { id: 'ashka_stampede', name: 'Stampede', icon: 'claw', cd: 55, target: 'self', color: '#ff8a3a', desc: 'Cavalry and monsters: +30% speed and +50% charge for 12s.', effect: { kind: 'type_buff', cats: ['cav', 'monster'], buff: { name: 'Stampede', speedMul: 1.3, chargeMul: 1.5, t: 12 } } },
      { id: 'ashka_tonic', name: 'Beast Tonic', icon: 'drop', cd: 80, radius: 18, color: '#9bff6a', desc: 'Allies in the area restore 20% of losses.', effect: { kind: 'ally_area', heal: 0.2, fx: 'roots' } },
    ] });
  legend('velithra', { faction: 'arcane', name: 'High Archon Velithra', title: 'First of the Spires',
    model: { kind: 'foot', body: 'robe', helm: 'tall', weapon: 'staff', scale: 1.25 },
    passive: { name: 'Archmage', desc: 'Ability cooldowns -20%; ranged units +10% damage.', mods: { cdMul: 0.8, rdmgMul: 1.1 } },
    start: { desc: '+400 gold and a unit of Apprentice Magi.', gold: 400, units: ['arcane_magi'] },
    story: 'Velithra has ruled the Dominion for three hundred years, outliving every rival and three of her own successors.',
    abilities: [
      { id: 'velithra_lightning', name: 'Chain Lightning', icon: 'bolt', cd: 40, radius: 9, color: '#bfe0ff', desc: 'Lightning arcs through the target area.', effect: { kind: 'area_damage', dmg: 9, ap: 0.8, morale: 8, fx: 'arcane' } },
      { id: 'velithra_barrier', name: 'Mana Barrier', icon: 'shield', cd: 70, radius: 20, color: '#7ae8ff', desc: 'Allies in the area: missiles hit 50% less and +15 armour for 18s.', effect: { kind: 'ally_area', buff: { name: 'Mana Barrier', missileMul: 0.5, armor: 15, t: 18 }, fx: 'arcane' } },
    ] });
  legend('thaddeus', { faction: 'arcane', name: 'Golemwright Thaddeus', title: 'Master of the Forge-Spire',
    model: { kind: 'foot', body: 'plate', helm: 'circlet', weapon: 'glaive', shield: true, scale: 1.3 },
    passive: { name: 'Forge-Master', desc: 'Monsters +20 armour; infantry +5 defence.', mods: { monArmor: 20, infDef: 5 } },
    start: { desc: 'Starts with a unit of Arcane Golems.', units: ['arcane_golems'] },
    story: 'A stonemason\'s son who taught granite to walk, Thaddeus is the only non-mage ever admitted to the Spire council.',
    abilities: [
      { id: 'thaddeus_quake', name: 'Golem Stomp', icon: 'quake', cd: 55, radius: 11, color: '#c4a06a', desc: 'The earth heaves: damage and -15 morale to enemies in the area.', effect: { kind: 'enemy_area', dmg: 6, ap: 0.5, morale: 15, fx: 'quake' } },
      { id: 'thaddeus_bulwark', name: 'Stone Bulwark', icon: 'shield', cd: 70, radius: 22, color: '#d8d3ea', desc: 'Allies in the area: +12 defence and +20 armour for 18s.', effect: { kind: 'ally_area', buff: { name: 'Stone Bulwark', def: 12, armor: 20, t: 18 }, fx: 'arcane' } },
    ] });
  legend('haldor', { faction: 'frost', name: 'Jarl Haldor Frostbeard', title: 'High Jarl of the Clans',
    model: { kind: 'foot', body: 'fur', helm: 'crown', weapon: 'axe', shield: true, scale: 1.35 },
    passive: { name: 'Shield of the North', desc: 'Infantry +6 defence and +8 armour.', mods: { infDef: 6, infArmor: 8 } },
    start: { desc: 'Starts with a unit of Rimeguard.', units: ['frost_rimeguard'] },
    story: 'Haldor united the feuding clans with a single duel on the ice of Wintermere, then forgave every jarl who had opposed him.',
    abilities: [
      { id: 'haldor_nova', name: 'Frost Nova', icon: 'snow', cd: 50, radius: 12, color: '#dff2ff', desc: 'An explosion of cold: damage and 50% slow for 10s.', effect: { kind: 'enemy_area', dmg: 5, ap: 0.5, buff: { name: 'Frost Nova', speedMul: 0.5, t: 10 }, fx: 'frost' } },
      { id: 'haldor_shout', name: 'Clan Shout', icon: 'horn', cd: 60, radius: 28, color: '#9fd8ff', desc: 'Allies in the area gain +30 morale and +6 attack for 15s.', effect: { kind: 'ally_area', morale: 30, rally: true, buff: { name: 'Clan Shout', atk: 6, morale: 10, t: 15 }, fx: 'frost' } },
    ] });
  legend('skadi', { faction: 'frost', name: 'Skadi Wolfmother', title: 'Huntress of the White Wastes',
    model: { kind: 'mounted', mount: 'wolf', coat: '#eef3f6', rider: { body: 'fur', helm: 'hood', hoodCol: '#eef3f6', weapon: 'bow', scale: 1.15 } },
    passive: { name: 'Pack Leader', desc: 'Cavalry +15% speed; ranged units +8% range.', mods: { cavSpeed: 1.15, rangeMul: 1.08 } },
    start: { desc: 'Starts with two Frost Wolf Packs.', units: ['frost_wolves', 'frost_wolves'] },
    story: 'Left to die in a blizzard as a child, Skadi walked out of the storm a week later with a wolf pack at her heels.',
    abilities: [
      { id: 'skadi_hunt', name: 'Call the Pack', icon: 'claw', cd: 55, target: 'self', color: '#eef3f6', desc: 'Cavalry: +25% speed and +60% charge for 12s.', effect: { kind: 'type_buff', cats: ['cav', 'general'], buff: { name: 'Call the Pack', speedMul: 1.25, chargeMul: 1.6, t: 12 } } },
      { id: 'skadi_volley', name: 'Hunter\'s Volley', icon: 'bow', cd: 45, radius: 9, color: '#cfe6f7', desc: 'A storm of arrows strikes the target area.', effect: { kind: 'area_damage', dmg: 7, ap: 0.3, morale: 6, fx: 'arrows' } },
    ] });
  legend('morvaine', { faction: 'blood', name: 'Countess Morvaine', title: 'The Crimson Countess',
    model: { kind: 'mounted', mount: 'horse', barding: true, coat: '#0e0c0d', rider: { body: 'robe', helm: 'crown', weapon: 'sword', scale: 1.1 } },
    passive: { name: 'Thirst', desc: 'Units heal 20% of each kill; all units +5 morale.', mods: { harvest: 0.2, morale: 5 } },
    start: { desc: 'Starts with a unit of Vampire Knights.', units: ['blood_knights'] },
    story: 'Morvaine was a court poet before she was turned. Now she composes elegies for the kingdoms she devours.',
    abilities: [
      { id: 'morvaine_bloodlust', name: 'Bloodlust', icon: 'drop', cd: 55, radius: 20, color: '#ff3a55', desc: 'Allies in the area: +20% melee damage and +10% speed for 15s.', effect: { kind: 'ally_area', buff: { name: 'Bloodlust', dmgMul: 1.2, speedMul: 1.1, t: 15 }, fx: 'blood' } },
      { id: 'morvaine_terror', name: 'Dread Gaze', icon: 'eye', cd: 60, radius: 18, color: '#8a1030', desc: 'Enemies in the area lose 25 morale.', effect: { kind: 'enemy_area', morale: 25, fx: 'blood' } },
    ] });
  legend('vorath', { faction: 'blood', name: 'Lord Vorath the Undying', title: 'Necromancer-King',
    model: { kind: 'foot', body: 'bone', skin: '#d8d2bc', helm: 'crown', weapon: 'staff', scale: 1.3 },
    passive: { name: 'Undying', desc: 'Twice as many fallen soldiers rise during battle.', mods: { resPool: 2 } },
    start: { desc: 'Starts with two extra Skeleton Legions.', units: ['blood_skeletons', 'blood_skeletons'] },
    story: 'Vorath has been killed eleven times. Each time the Empire held a funeral, and each time he attended it.',
    abilities: [
      { id: 'vorath_bolt', name: 'Death Bolt', icon: 'skull', cd: 40, radius: 7, color: '#b8ff9a', desc: 'A bolt of necrotic energy strikes the area.', effect: { kind: 'area_damage', dmg: 10, ap: 0.8, morale: 10, fx: 'blood' } },
      { id: 'vorath_renewal', name: 'Unholy Renewal', icon: 'drop', cd: 75, radius: 20, color: '#9aff8a', desc: 'Allies in the area restore 25% of losses.', effect: { kind: 'ally_area', heal: 0.25, fx: 'blood' } },
    ] });
  legend('elyndra', { faction: 'sylvan', name: 'Elyndra Moonbow', title: 'Warden of the Moonlit Paths',
    model: { kind: 'mounted', mount: 'stag', rider: { body: 'leaf', helm: 'hood', hoodCol: '#dfe8ee', weapon: 'bow', scale: 1.1 } },
    passive: { name: 'Moonbow', desc: 'Ranged units +12% damage and +10% range.', mods: { rdmgMul: 1.12, rangeMul: 1.1 } },
    start: { desc: 'Starts with a unit of Waystalkers.', units: ['sylvan_rangers'] },
    story: 'Elyndra once shot an arrow across the Moonwillow lake at night and split the stem of a falling leaf. The leaf hangs in her hall still.',
    abilities: [
      { id: 'elyndra_volley', name: 'Rain of Arrows', icon: 'bow', cd: 45, radius: 10, color: '#e8ffcf', desc: 'A storm of arrows strikes the target area.', effect: { kind: 'area_damage', dmg: 7, ap: 0.3, morale: 8, fx: 'arrows' } },
      { id: 'elyndra_snare', name: 'Snaring Vines', icon: 'root', cd: 55, radius: 10, color: '#7ad860', desc: 'Vines root enemies in the area for 6s.', effect: { kind: 'enemy_area', buff: { name: 'Snared', speedMul: 0.02, t: 6 }, fx: 'roots' } },
    ] });
  legend('thalgrim', { faction: 'sylvan', name: 'Oakfather Thalgrim', title: 'Eldest of the Grove',
    model: { kind: 'foot', body: 'leaf', helm: 'hood', hoodCol: '#5a4028', weapon: 'staff', scale: 1.35 },
    passive: { name: 'Deep Roots', desc: 'Monsters +20% health; infantry +6 defence.', mods: { monHp: 1.2, infDef: 6 } },
    start: { desc: 'Starts with a unit of Treants.', units: ['sylvan_treants'] },
    story: 'Thalgrim planted the first tree of Eldergrove. Some say he is a tree who learned to walk as a man, not the other way round.',
    abilities: [
      { id: 'thalgrim_song', name: 'Song of Growth', icon: 'leaf', cd: 70, radius: 22, color: '#9effa0', desc: 'Allies in the area restore 20% of losses and gain +8 defence for 15s.', effect: { kind: 'ally_area', heal: 0.2, buff: { name: 'Song of Growth', def: 8, t: 15 }, fx: 'roots' } },
      { id: 'thalgrim_roots', name: 'Grasping Roots', icon: 'root', cd: 55, radius: 12, color: '#7ad860', desc: 'Enemies in the area are rooted for 7s.', effect: { kind: 'enemy_area', dmg: 2, ap: 0.5, buff: { name: 'Rooted', speedMul: 0.02, t: 7 }, fx: 'roots' } },
    ] });
  D.LEGENDS = LEGENDS;

  // ---------------------------------------------------------------- Commander skill tree (all commanders)
  D.SKILLS = [
    { id: 'blade', branch: 'Warfare', name: 'Blademaster', max: 3, desc: 'Bodyguard +4 attack and +4 defence per rank.' },
    { id: 'tactics', branch: 'Warfare', name: 'Battle Tactics', max: 3, desc: 'All units +3% melee damage per rank.' },
    { id: 'siege', branch: 'Warfare', name: 'Siegecraft', max: 2, desc: 'Gates take +50% damage per rank; siege engines +10% damage per rank.' },
    { id: 'inspire', branch: 'Leadership', name: 'Inspiration', max: 3, desc: 'All units +3 morale per rank.' },
    { id: 'drill', branch: 'Leadership', name: 'Drillmaster', max: 3, desc: 'Infantry +2 defence per rank.' },
    { id: 'arcana', branch: 'Leadership', name: 'Battle Arcana', max: 2, desc: 'Ability cooldowns -8% per rank.' },
    { id: 'supply', branch: 'Logistics', name: 'Quartermaster', max: 3, desc: 'Army upkeep -5% per rank.' },
    { id: 'medic', branch: 'Logistics', name: 'Field Surgeons', max: 3, desc: 'Units replenish +5% per turn per rank.' },
    { id: 'scout', branch: 'Logistics', name: 'Pathfinder', max: 2, desc: 'Cavalry and flyers +5% speed per rank.' },
  ];

  // ---------------------------------------------------------------- Equipment
  D.RARITY = {
    common: { name: 'Common', color: '#c8c2b0', weight: 50 },
    uncommon: { name: 'Uncommon', color: '#6fd67a', weight: 28 },
    rare: { name: 'Rare', color: '#5aa8ff', weight: 14 },
    epic: { name: 'Epic', color: '#c07aff', weight: 6 },
    legendary: { name: 'Legendary', color: '#ffb02e', weight: 2 },
  };
  const ITEMS = {};
  function item(id, slot, rarity, name, desc, mods) { ITEMS[id] = { id, slot, rarity, name, desc, mods }; }
  item('sword_steel', 'weapon', 'common', 'Steel Longsword', 'Bodyguard +4 attack.', { genAtk: 4 });
  item('spear_ash', 'weapon', 'common', 'Ash War-Spear', 'Bodyguard +3 attack, +6 charge.', { genAtk: 3, genCharge: 6 });
  item('axe_runed', 'weapon', 'uncommon', 'Runed Axe', 'Bodyguard +6 attack, +10% armour piercing.', { genAtk: 6, genAp: 0.1 });
  item('lance_rider', 'weapon', 'uncommon', "Outrider's Lance", 'Bodyguard +12 charge; cavalry +4 charge.', { genCharge: 12, cavCharge: 4 });
  item('flamebrand', 'weapon', 'rare', 'Flamebrand', 'Bodyguard +8 attack; all units +3% melee damage.', { genAtk: 8, dmgMul: 1.03 });
  item('bow_storm', 'weapon', 'rare', 'Stormstring Bow', 'Ranged units +6% damage.', { rdmgMul: 1.06 });
  item('frostfang', 'weapon', 'epic', 'Frostfang', 'Bodyguard +10 attack; all units +4% melee damage.', { genAtk: 10, dmgMul: 1.04 });
  item('staff_ages', 'weapon', 'epic', 'Staff of Ages', 'Ability cooldowns -12%.', { cdMul: 0.88 });
  item('dawnbreaker', 'weapon', 'legendary', 'Dawnbreaker', 'Bodyguard +14 attack; all units +6% melee damage and +5 morale.', { genAtk: 14, dmgMul: 1.06, morale: 5 });
  item('worldsplitter', 'weapon', 'legendary', 'Worldsplitter', 'Bodyguard +16 attack, +15 charge, +20% armour piercing.', { genAtk: 16, genCharge: 15, genAp: 0.2 });
  item('mail_hauberk', 'armor', 'common', 'Mail Hauberk', 'Bodyguard +8 armour.', { genArmor: 8 });
  item('gambeson', 'armor', 'common', 'Padded Gambeson', 'Bodyguard +5 armour, +2 defence.', { genArmor: 5, genDef: 2 });
  item('plate_cuirass', 'armor', 'uncommon', 'Plate Cuirass', 'Bodyguard +14 armour.', { genArmor: 14 });
  item('warden_cloak', 'armor', 'uncommon', "Warden's Cloak", 'Bodyguard +5 defence; all units +3 morale.', { genDef: 5, morale: 3 });
  item('dragonscale', 'armor', 'rare', 'Dragonscale Mail', 'Bodyguard +18 armour and +10% health.', { genArmor: 18, genHp: 1.1 });
  item('aegis', 'armor', 'epic', 'Aegis of Kings', 'Bodyguard +20 armour; infantry +4 defence.', { genArmor: 20, infDef: 4 });
  item('mantle_undying', 'armor', 'legendary', 'Mantle of the Undying', 'Bodyguard +25 armour and +25% health; all units +5 morale.', { genArmor: 25, genHp: 1.25, morale: 5 });
  item('lucky_charm', 'trinket', 'common', 'Lucky Charm', 'All units +3 morale.', { morale: 3 });
  item('war_horn', 'trinket', 'common', 'War Horn', 'Cavalry +5% speed.', { cavSpeed: 1.05 });
  item('banner_valour', 'trinket', 'uncommon', 'Banner of Valour', 'All units +5 morale.', { morale: 5 });
  item('ledger', 'trinket', 'uncommon', "Quartermaster's Ledger", 'Army upkeep -8%.', { upkeepMul: 0.92 });
  item('eagle_amulet', 'trinket', 'rare', 'Eagle-Eye Amulet', 'Ranged units +8% range.', { rangeMul: 1.08 });
  item('healer_phial', 'trinket', 'rare', "Healer's Phial", 'Army replenishes +10% per turn.', { replenish: 0.1 });
  item('crown_command', 'trinket', 'epic', 'Crown of Command', 'All units +8 morale; ability cooldowns -8%.', { morale: 8, cdMul: 0.92 });
  item('eye_eternity', 'trinket', 'legendary', 'Eye of Eternity', 'Ability cooldowns -20%; ranged units +10% damage.', { cdMul: 0.8, rdmgMul: 1.1 });
  D.ITEMS = ITEMS;

  // Army doctrines (passive bonuses chosen per army).
  D.DOCTRINES = {
    none: { name: 'None', desc: 'No doctrine.', mods: {} },
    aggressive: { name: 'Aggressive', desc: '+5% melee damage, -2 defence.', mods: { dmgMul: 1.05, defAll: -2 } },
    disciplined: { name: 'Disciplined', desc: '+6 morale.', mods: { morale: 6 } },
    swift: { name: 'Swift', desc: '+8% speed.', mods: { speedAll: 1.08 } },
    marksmen: { name: 'Marksmen', desc: 'Ranged units +6% damage.', mods: { rdmgMul: 1.06 } },
    shieldwall: { name: 'Shield Wall', desc: 'Infantry +4 defence, -4% speed.', mods: { infDef: 4, speedAll: 0.96 } },
  };
  D.BANNER_COLORS = ['#3a6fd0', '#c0392b', '#8e5be0', '#7fb8e0', '#b3243c', '#4fae5a', '#e0b84a', '#e8e0d0', '#2a2a30', '#d07a2a'];

  // ---------------------------------------------------------------- Technology (Greater Realm & Conquest)
  const TECH_BASE = [
    { id: 'mil1', cat: 'Military', tier: 1, cost: 600, turns: 2, desc: 'Infantry +3 attack.', effect: { infAtk: 3 } },
    { id: 'mil2', cat: 'Military', tier: 2, req: 'mil1', cost: 1000, turns: 3, desc: 'Unlocks the faction\'s rare unit. Cavalry +5 charge.', effect: { cavCharge: 5 } },
    { id: 'mil3', cat: 'Military', tier: 3, req: 'mil2', cost: 1600, turns: 4, desc: 'Unlocks the faction\'s legendary unit. All units +4 morale.', effect: { morale: 4 } },
    { id: 'eco1', cat: 'Economy', tier: 1, cost: 500, turns: 2, desc: 'Income +8%.', effect: { income: 0.08 } },
    { id: 'eco2', cat: 'Economy', tier: 2, req: 'eco1', cost: 900, turns: 3, desc: 'Income +8%; Markets cost 25% less.', effect: { income: 0.08, marketCost: 0.75 } },
    { id: 'eco3', cat: 'Economy', tier: 3, req: 'eco2', cost: 1400, turns: 4, desc: 'Income +10%; looted gold +50%.', effect: { income: 0.1, loot: 1.5 } },
    { id: 'mag1', cat: 'Magic', tier: 1, cost: 600, turns: 2, desc: 'Ability cooldowns -10%.', effect: { cdMul: 0.9 } },
    { id: 'mag2', cat: 'Magic', tier: 2, req: 'mag1', cost: 1100, turns: 3, desc: 'Unlocks the faction\'s ultimate battle ability.', effect: { ultimate: true } },
    { id: 'mag3', cat: 'Magic', tier: 3, req: 'mag2', cost: 1500, turns: 4, desc: 'Ranged units +8% damage; ability cooldowns -10%.', effect: { rdmgMul: 1.08, cdMul: 0.9 } },
    { id: 'inf1', cat: 'Infrastructure', tier: 1, cost: 500, turns: 2, desc: 'Buildings and settlement upgrades cost 15% less.', effect: { buildCost: 0.85 } },
    { id: 'inf2', cat: 'Infrastructure', tier: 2, req: 'inf1', cost: 900, turns: 3, desc: '+1 recruitment slot in every settlement.', effect: { slots: 1 } },
    { id: 'inf3', cat: 'Infrastructure', tier: 3, req: 'inf2', cost: 1400, turns: 4, desc: '+1 army limit; armies replenish +10% per turn.', effect: { armies: 1, replenish: 0.1 } },
  ];
  const TECH_NAMES = {
    valor: ['Sword Drills', 'Knightly Orders', 'Sacred Relics', 'Royal Mint', 'Guild Charters', 'Golden Age', 'Dawn Prayers', 'Cathedral of Light', 'Sunfire Liturgy', 'Masonry', 'Muster Rolls', 'Great Roads'],
    horde: ['Blood Pits', 'Beast Pens', 'Black Iron', 'Tribute', 'Raider Markets', 'Plunder Lords', 'Shaman Lodges', 'Ash Rites', 'Fire Totems', 'Stockades', 'War Camps', 'Endless Horde'],
    arcane: ['Battle Wards', 'Rune Lances', 'Living Constructs', 'Arcane Trade', 'Spire Banks', 'Philosopher\'s Gold', 'Ley Focusing', 'Chronomancy', 'Star Lenses', 'Floating Stone', 'Portal Gates', 'Ley Roads'],
    frost: ['Shield Drills', 'Beast Riding', 'Giant Pacts', 'Fur Trade', 'Whaling Fleets', 'Sagas of Plenty', 'Rune Carving', 'Call of Winter', 'Frostbound Arrows', 'Longhouses', 'Clan Moots', 'Ice Roads'],
    blood: ['Thrall Drills', 'Nightmare Stables', 'Elder Bloodlines', 'Blood Tithe', 'Crimson Courts', 'Eternal Treasury', 'Hemomancy', 'Night Rites', 'Boiling Blood', 'Ossuaries', 'Grave Levies', 'Roads of Bone'],
    sylvan: ['Blade Dances', 'Stag Bonds', 'Waking the Ancients', 'Forest Bounty', 'Elven Trade', 'Gifts of the Glade', 'Moon Rites', 'Song of the Hunt', 'Star-Fletching', 'Living Halls', 'Glade Musters', 'Hidden Paths'],
  };
  D.techFor = function (f) { return TECH_BASE.map((t, i) => Object.assign({}, t, { name: (TECH_NAMES[f] || TECH_NAMES.valor)[i] })); };

  // ---------------------------------------------------------------- Terrain, battlefields, weather
  Object.assign(D.TERRAIN_INFO, {
    snow: { name: 'Frozen Wastes', income: 50, battle: 'snow', color: '#cfdde6' },
    desert: { name: 'Desert', income: 55, battle: 'desert', color: '#d6bf86' },
    volcanic: { name: 'Volcanic Lands', income: 45, battle: 'volcanic', color: '#5c4a44' },
  });
  Object.assign(D.BATTLE_MAPS, {
    snow: { name: 'Snowbound Mountains', desc: 'Snowfields between icy crags. Deep snow slows everyone a little.' },
    ancientforest: { name: 'Ancient Forest', desc: 'Huge old trees and misty glades: lots of cover and few open lanes.' },
    volcanic: { name: 'Volcanic Wasteland', desc: 'Black rock and impassable lava flows split the field.' },
    desert: { name: 'Desert Ruins', desc: 'Crumbling ruins and broken pillars give cover on open sand.' },
    courtyard: { name: 'Castle Courtyard', desc: 'A walled courtyard with a few wide breaches. Close, brutal fighting.' },
    temple: { name: 'Ancient Temple', desc: 'A raised temple platform dominates the centre. Hold the high ground.' },
  });
  D.WEATHER = {
    clear: { name: 'Clear', desc: 'No effect.', acc: 1, range: 1, speed: 1, morale: 0, vis: 0 },
    rain: { name: 'Rain', desc: 'Missile accuracy -10%, movement -5%.', acc: 0.9, range: 1, speed: 0.95, morale: 0, vis: 0 },
    fog: { name: 'Fog', desc: 'Units further than 70m from an enemy are hidden. Missile accuracy -7%.', acc: 0.93, range: 1, speed: 1, morale: 0, vis: 70 },
    snowstorm: { name: 'Snowstorm', desc: 'Missile accuracy -10%, range -8%, movement -8%.', acc: 0.9, range: 0.92, speed: 0.92, morale: 0, vis: 0 },
    ash: { name: 'Volcanic Ash', desc: 'Missile accuracy -5%; all units -3 morale.', acc: 0.95, range: 1, speed: 1, morale: 3, vis: 0 },
  };
  D.weatherFor = function (mapType, rng = Math.random) {
    const r = rng();
    if (mapType === 'snow') return r < 0.5 ? 'snowstorm' : 'clear';
    if (mapType === 'volcanic') return r < 0.6 ? 'ash' : 'clear';
    if (mapType === 'desert') return 'clear';
    if (mapType === 'forest' || mapType === 'ancientforest') return r < 0.3 ? 'fog' : r < 0.5 ? 'rain' : 'clear';
    return r < 0.2 ? 'rain' : r < 0.32 ? 'fog' : 'clear';
  };

  // ---------------------------------------------------------------- Greater Realm map
  const GT = [
    { id: 0, name: 'Frosthold', x: 14, y: 10, terrain: 'snow' },
    { id: 1, name: 'Wintermere', x: 38, y: 9, terrain: 'snow' },
    { id: 2, name: 'Glacier Gate', x: 58, y: 12, terrain: 'snow', ruins: true },
    { id: 3, name: 'Highcrown', x: 10, y: 36, terrain: 'plains' },
    { id: 4, name: 'Silverbrook', x: 11, y: 60, terrain: 'river' },
    { id: 5, name: 'Dawnford', x: 28, y: 44, terrain: 'river', landmark: 'colossus' },
    { id: 6, name: 'Greymarch', x: 31, y: 25, terrain: 'hills' },
    { id: 7, name: 'Thornwood', x: 30, y: 66, terrain: 'forest', landmark: 'oak' },
    { id: 8, name: 'Oldstone Ruins', x: 50, y: 33, terrain: 'plains', shrine: true, ruins: true },
    { id: 9, name: 'Wolfen Vale', x: 47, y: 53, terrain: 'forest', ruins: true },
    { id: 10, name: 'Ironhold Pass', x: 74, y: 22, terrain: 'pass', landmark: 'forges' },
    { id: 11, name: 'Sunken Shrine', x: 68, y: 44, terrain: 'river', shrine: true },
    { id: 12, name: 'Ashfang Peaks', x: 104, y: 9, terrain: 'volcanic' },
    { id: 13, name: "Gorlak's Maw", x: 127, y: 15, terrain: 'volcanic' },
    { id: 14, name: 'Cinderwaste', x: 88, y: 26, terrain: 'volcanic' },
    { id: 15, name: 'Frostmere', x: 81, y: 6, terrain: 'snow', landmark: 'observatory' },
    { id: 16, name: 'Nightspire', x: 129, y: 40, terrain: 'forest' },
    { id: 17, name: 'Crimson Moor', x: 109, y: 50, terrain: 'plains' },
    { id: 18, name: 'Gravewatch', x: 92, y: 43, terrain: 'hills', ruins: true },
    { id: 19, name: 'Starfall Glade', x: 66, y: 64, terrain: 'forest' },
    { id: 20, name: 'Mistral Spire', x: 126, y: 74, terrain: 'hills' },
    { id: 21, name: 'Azure Oasis', x: 106, y: 91, terrain: 'desert' },
    { id: 22, name: 'Sunscar Dunes', x: 85, y: 82, terrain: 'desert', shrine: true, landmark: 'mines' },
    { id: 23, name: 'Tomb of Kings', x: 63, y: 90, terrain: 'desert', ruins: true },
    { id: 24, name: 'Eldergrove', x: 15, y: 86, terrain: 'forest' },
    { id: 25, name: 'Moonwillow', x: 39, y: 92, terrain: 'forest' },
    { id: 26, name: 'Emberfell', x: 48, y: 75, terrain: 'river' },
    { id: 27, name: "Dragon's Rest", x: 92, y: 63, terrain: 'volcanic', landmark: 'dragon' },
  ];
  D.MAPS = {
    classic: { id: 'classic', name: 'The Three Realms', territories: D.TERRITORIES, W: 54, H: 42, coords: [100, 72], seed: 4242, factions: ['valor', 'horde', 'arcane'],
      starts: { valor: [0, 1], horde: [11, 12], arcane: [14, 15] } },
    greater: { id: 'greater', name: 'The Greater Realm', territories: GT, W: 72, H: 54, coords: [140, 100], seed: 9191, factions: ['valor', 'horde', 'arcane', 'frost', 'blood', 'sylvan'],
      starts: { frost: [0, 1], valor: [3, 4], horde: [12, 13], blood: [16, 17], arcane: [20, 21], sylvan: [24, 25] } },
  };
  D.LANDMARKS = {
    colossus: { name: 'Colossus of Dawn', desc: '+120 gold per turn.', income: 120 },
    oak: { name: 'The Weeping Oak', desc: 'All your armies replenish +10% per turn.', replenish: 0.1 },
    forges: { name: 'Iron Forges', desc: 'Recruitment costs 10% less everywhere.', recruit: 0.9 },
    observatory: { name: 'Star Observatory', desc: 'Research progresses one extra turn every other turn.', research: 0.5 },
    mines: { name: 'Sunscar Gold Mines', desc: '+150 gold per turn.', income: 150 },
    dragon: { name: "Dragon's Rest", desc: 'All your units +4 morale in battle.', morale: 4 },
  };
})();
