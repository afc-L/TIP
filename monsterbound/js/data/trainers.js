'use strict';
// Trainer definitions and team building.
MB.Teams = {
  // evolve a base species key to the right stage for a level
  stageFor(key, lvl, r) {
    let sp = MB.SP[key];
    for (let guard = 0; guard < 4; guard++) {
      if (!sp.evo.length) break;
      const e = r ? r.pick(sp.evo) : sp.evo[0];
      const need = e.m === 'level' ? e.v : 22 + sp.stage * 14 + (e.m === 'item' ? 4 : 0);
      if (lvl >= need) sp = MB.SP[e.to]; else break;
    }
    return sp.key;
  },
  auto(types, lvl, n, seed, region, opts = {}) {
    const r = new MB.RNG('team:' + seed);
    const base = MB.SPECIES.filter((s) => !s.legendary && !s.eggOnly && !s.fossil && !s.starter && s.stage === 0 && (region === 'X' || s.region === region));
    const typeOk = (s) => !types || !types.length || s.types.some((t) => types.includes(t)) || MB.SP[MB.Teams.stageFor(s.key, 99)].types.some((t) => types.includes(t));
    const habOk = (s) => opts.habitats && s.habitats.some((h) => opts.habitats.includes(h)) && (!s.night || !opts.day);
    // prefer creatures that actually live where the trainer stands, then the trainer's favourite types
    let pool = base.filter((s) => habOk(s) && typeOk(s));
    if (pool.length < 2 && opts.habitats) pool = base.filter(habOk);
    if (pool.length < 2) pool = base.filter(typeOk);
    if (!pool.length) pool = base;
    const team = [];
    for (let i = 0; i < n; i++) {
      const pick = r.pick(pool);
      const l = Math.max(2, lvl + r.int(-2, 1) + (i === n - 1 ? 1 : 0));
      team.push([MB.Teams.stageFor(pick.key, l, r), l]);
    }
    return team;
  },
  build(team, seed, opts = {}) {
    const r = new MB.RNG('mons:' + seed);
    return team.map(([k, l, extra], i) => {
      const e = extra || {};
      const m = MB.Mon.create(k, l, { rng: r, shiny: false, ivs: opts.ivs !== undefined ? Object.fromEntries(MB.STAT_KEYS.map((s) => [s, opts.ivs])) : undefined, moves: e.moves, item: e.item, ability: e.ability, nature: e.nature });
      if (e.mega) m.item = MB.SP[k].mega ? MB.SP[k].mega.stone : m.item;
      if (opts.heldItems && !m.item && r.chance(0.5)) m.item = r.pick(['spring_moss', 'shell_plate', 'focus_lens', 'swift_boots', MB.SP[k].types[0].toLowerCase() + '_sigil']);
      void i;
      return m;
    });
  },
};

MB.TRAINER_NAMES = {
  'Youngster': ['Timmy', 'Owen', 'Jace', 'Milo', 'Theo', 'Rory'], 'Lass': ['Nina', 'Ivy', 'Rosa', 'Mae', 'Lena', 'Pia'], 'Bug Catcher': ['Benny', 'Rick', 'Doug', 'Kip'],
  'Hiker': ['Grant', 'Boris', 'Hugo', 'Lyle', 'Otto'], 'Fisher': ['Ned', 'Wade', 'Hal', 'Cody'], 'Swimmer': ['Coral', 'Finn', 'Marisa', 'Tad'], 'Ace Trainer': ['Vera', 'Dorian', 'Selma', 'Rhett', 'Kira', 'Lucan'],
  'Ranger': ['Ash', 'Willa', 'Reed', 'Fern'], 'Psychic': ['Iris', 'Sol', 'Mystra', 'Orin'], 'Sailor': ['Bart', 'Gus', 'Hector', 'Moe'], 'Ruin Maniac': ['Dirk', 'Mack', 'Pete'],
  'Researcher': ['Dr. Quinn', 'Dr. Vale', 'Dr. Holt'], 'Skier': ['Ingrid', 'Sven', 'Olga'], 'Beauty': ['Bella', 'Cassie', 'Daphne'], 'Black Belt': ['Kenji', 'Ryo', 'Tomas'],
  'Hex Maniac': ['Agatha', 'Morwen', 'Lilith'], 'Dragon Tamer': ['Drake', 'Rhiannon', 'Tiamat'], 'Engineer': ['Gil', 'Rivet', 'Volt'], 'Camper': ['Sam', 'Jo', 'Pip'], 'Picnicker': ['Daisy', 'Holly', 'June'],
  'Grunt': ['Grunt', 'Grunt', 'Grunt'], 'Veteran': ['Marcus', 'Helga', 'Sergei'], 'Socialite': ['Margot', 'Reginald'], 'Kindler': ['Ash', 'Blaze'], 'Rift Seeker': ['Nova', 'Echo', 'Zed'],
};
MB.CLASS_TYPES = {
  'Youngster': ['Normal', 'Venom'], 'Lass': ['Normal', 'Light', 'Nature'], 'Bug Catcher': ['Nature', 'Venom'], 'Hiker': ['Earth', 'Metal'], 'Fisher': ['Aqua'], 'Swimmer': ['Aqua', 'Ice'],
  'Ace Trainer': null, 'Ranger': ['Nature', 'Wind'], 'Psychic': ['Psychic'], 'Sailor': ['Aqua', 'Electric'], 'Ruin Maniac': ['Earth', 'Spirit'], 'Researcher': ['Electric', 'Metal', 'Psychic'],
  'Skier': ['Ice'], 'Beauty': ['Light', 'Nature', 'Aqua'], 'Black Belt': ['Normal', 'Earth'], 'Hex Maniac': ['Spirit', 'Shadow'], 'Dragon Tamer': ['Dragon'], 'Engineer': ['Electric', 'Metal'],
  'Camper': ['Normal', 'Flame', 'Earth'], 'Picnicker': ['Nature', 'Normal', 'Light'], 'Grunt': ['Venom', 'Shadow', 'Metal'], 'Veteran': null, 'Socialite': ['Light', 'Psychic'], 'Kindler': ['Flame'], 'Rift Seeker': ['Psychic', 'Spirit', 'Dragon'],
};
MB.CLASS_APP = { 'Hiker': 'hiker', 'Sailor': 'sailor', 'Ranger': 'ranger', 'Researcher': 'researcher', 'Grunt': 'grunt', 'Youngster': 'kid', 'Bug Catcher': 'kid', 'Fisher': 'hiker', 'Ace Trainer': 'ace' };

// ---- Important trainers ----
// team entries: [species, level, {mega, moves, item}]
MB.BOSSES = {
  // Gym leaders
  mira: { name: 'Mira', title: 'Leader', type: 'Nature', badge: 'Sprout Badge', pay: 1400, team: [['hivelet', 11], ['acorny', 12], ['bloomkin', 14]], items: ['potion'], ai: 2,
    intro: 'Welcome to Verdant Gym! My creatures grow strong in the sun. Let\'s see if your bond can bloom!', lose: 'Your team blossomed beautifully. Take the Sprout Badge!',
    reward: 'shears', rewardText: 'These Garden Shears will cut through thorny bushes on the routes.' },
  voltan: { name: 'Voltan', title: 'Leader', type: 'Electric', badge: 'Surge Badge', pay: 2200, team: [['fluffbolt', 17], ['ampig', 17], ['zapeel', 18], ['voltpaw', 20]], items: ['super_potion'], ai: 2,
    intro: 'The Crystalwater dam powers the whole lake! Can you handle a hundred thousand volts?', lose: 'Shocking! You earned the Surge Badge, fair and square.', reward: 'exp_link', rewardText: 'This Exp. Link shares experience with your whole team!' },
  brutus: { name: 'Brutus', title: 'Leader', type: 'Earth', badge: 'Bedrock Badge', pay: 3000, team: [['sandrit', 24], ['molekin', 24], ['bouldrone', 25], ['duneclaw', 27]], items: ['super_potion', 'super_potion'], ai: 2,
    intro: 'HAH! The desert forges strong bodies. I hope you brought more than sand in your boots!', lose: 'You hit like an earthquake! The Bedrock Badge is yours.', reward: 'pick_hammer', rewardText: 'Take this Pick Hammer to smash cracked boulders.' },
  marina: { name: 'Marina', title: 'Leader', type: 'Aqua', badge: 'Tide Badge', pay: 3800, team: [['jellune', 30], ['pinchel', 30], ['croakwell', 31], ['tidesteed', 33]], items: ['hyper_potion'], ai: 3,
    intro: 'The tide waits for no one. Show me you can ride the current!', lose: 'You flow like the sea itself. The Tide Badge is yours.', reward: 'aqua_saddle', rewardText: 'With this Aqua Saddle your creatures can carry you across the water.' },
  cinder: { name: 'Cinder', title: 'Leader', type: 'Flame', badge: 'Blaze Badge', pay: 4400, team: [['furnashell', 35], ['pyroraptor', 36], ['magmolem', 36], ['hearthound', 38, { mega: true }]], items: ['hyper_potion', 'full_heal'], ai: 3, mega: true,
    intro: 'Emberfall burns brightest at night. My flames will test the heat of your spirit!', lose: 'Your fire burned hotter than mine... Take the Blaze Badge.', reward: 'climb_claws', rewardText: 'These Climbing Claws let you scale rocky walls with handholds.' },
  selene: { name: 'Selene', title: 'Leader', type: 'Psychic', badge: 'Mind Badge', pay: 4800, team: [['owlumen', 40], ['hexdoll', 40], ['cerebrix', 41], ['lunarabbit', 41], ['mentalord', 44, { mega: true }]], items: ['hyper_potion', 'hyper_potion'], ai: 3, mega: true,
    intro: 'I foresaw your arrival. I also foresaw... no, I won\'t spoil it.', lose: 'The future was uncertain after all. The Mind Badge is yours.', reward: 'glow_lantern', rewardText: 'This Glow Lantern lights the darkest caves and marshes.' },
  frost: { name: 'Frost', title: 'Leader', type: 'Ice', badge: 'Glacier Badge', pay: 5200, team: [['walroar', 45], ['prismice', 45], ['emperion', 46], ['glacifin', 46], ['avalanchor', 48, { mega: true }]], items: ['hyper_potion', 'full_restore'], ai: 3, mega: true,
    intro: 'The cold reveals what you are made of. Shiver before the north!', lose: 'You thawed my heart. Take the Glacier Badge.', reward: 'dive_gear', rewardText: 'This Dive Gear lets you dive into deep, dark water.' },
  darius: { name: 'Darius', title: 'Leader', type: 'Shadow', badge: 'Eclipse Badge', pay: 6000, team: [['nocturnix', 50], ['mirejaw', 50], ['umbraith', 51], ['nyxeline', 52], ['strayvant', 51], ['umbrawolf', 54, { mega: true }]], items: ['full_restore', 'full_restore'], ai: 4, mega: true,
    intro: 'Every light casts a shadow. I have watched you since Willowbrook. Show me what stands in the dark.', lose: 'Then the shadows will follow you, not lead you. The Eclipse Badge is yours.', reward: 'wing_whistle', rewardText: 'Use this Wing Whistle to fly to any town you have visited.' },
  // Elite championship
  elite1: { name: 'Thorne', title: 'Elite', type: 'Venom', pay: 9000, team: [['mirebuzz', 56], ['stingrave', 56], ['medusalis', 57], ['fumebelch', 57], ['arachnyx', 58], ['venomander', 60, { mega: true }]], items: ['full_restore', 'full_restore'], ai: 4, mega: true,
    intro: 'Poison is patience. Let\'s see how long you last.', lose: 'Antidote... I need an antidote. Go on.' },
  elite2: { name: 'Celestine', title: 'Elite', type: 'Light', pay: 9000, team: [['lumifly', 57], ['prismastar', 57], ['sunbeetle', 58], ['floralisk', 58], ['aurorelle', 59], ['celestag', 61, { mega: true }]], items: ['full_restore', 'full_restore'], ai: 4, mega: true,
    intro: 'Let my radiance guide you... straight back to the start.', lose: 'How dazzling. You may pass.' },
  elite3: { name: 'Gideon', title: 'Elite', type: 'Metal', pay: 9000, team: [['steelmaw', 58], ['chromeraven', 58], ['carapaxon', 59], ['emperion', 59], ['excalith', 60], ['automax', 62, { mega: true }]], items: ['full_restore', 'full_restore'], ai: 4, mega: true,
    intro: 'Steel does not bend. Neither do I.', lose: 'Well forged, challenger. The final door awaits.' },
  elite4: { name: 'Wyn', title: 'Elite', type: 'Dragon', pay: 9000, team: [['wyrmfly', 59], ['scaldrake', 60], ['dunesharq', 60], ['wyrmhound', 60], ['abyssdrake', 61], ['wyvernox', 63, { mega: true }]], items: ['full_restore', 'full_restore', 'full_restore'], ai: 5, mega: true,
    intro: 'Dragons remember every challenger. Few are worth remembering.', lose: 'You... will be remembered.' },
  champion: { name: 'Aurelia', title: 'Champion', type: 'Mixed', pay: 20000, team: [['stormhawk', 62], ['islandon', 62], ['sunmane', 63], ['excalith', 63], ['glacierhorn', 64], ['ptercient', 66, { mega: true }]], items: ['full_restore', 'full_restore', 'full_restore'], ai: 5, mega: true, music: 'champion',
    intro: 'So you\'re the one who stopped the Eclipse Syndicate. I have waited a long time for a battle that matters. Show me everything!', lose: 'Magnificent. Aetheria has a new Champion... and I have a new rival.' },
  // Syndicate
  grunt: { name: 'Grunt', title: 'Syndicate', type: 'Mixed', pay: 600, team: [], ai: 1 },
  vex: { name: 'Vex', title: 'Commander', type: 'Venom', pay: 3400, team: [['sludgekin', 24], ['scorplet', 25], ['webbit', 25], ['hissling', 27]], items: ['super_potion'], ai: 3, music: 'evil',
    intro: 'Another meddling kid. The Syndicate needs what\'s buried in these ruins. Out of my way!', lose: 'Tch. Fine. Keep your shiny trinket. We already know where to look next.' },
  rook: { name: 'Rook', title: 'Commander', type: 'Metal', pay: 4600, team: [['steelmantis', 36], ['cogwheel', 36], ['eelectra', 37], ['ironjaw', 37], ['voltusk', 39]], items: ['hyper_potion'], ai: 3, music: 'evil',
    intro: 'This plant powers our extraction drills. Efficiency demands I remove you.', lose: 'Calculations... incorrect. Withdraw!' },
  nyx: { name: 'Nyx', title: 'Commander', type: 'Spirit', pay: 5200, team: [['phantomb', 41], ['hexdoll', 41], ['mausolith', 42], ['umbraith', 42], ['spectrelle', 44]], items: ['hyper_potion', 'hyper_potion'], ai: 4, music: 'evil',
    intro: 'The stars told us where the Heart sleeps. You can\'t unread the sky.', lose: 'The constellations didn\'t mention you... how curious.' },
  sable: { name: 'Sable', title: 'Commander', type: 'Flame', pay: 6800, team: [['scaldrake', 52], ['pyroraptor', 52], ['calderon', 53], ['wyrmhound', 53], ['cindercoil', 52], ['hearthound', 55, { mega: true }]], items: ['full_restore'], ai: 4, mega: true, music: 'evil',
    intro: 'I am the Syndicate\'s blade. The Director\'s dream ends with an eclipse over all of Aetheria!', lose: 'Impossible... the Director will finish this. Without me if he must.' },
  valen: { name: 'Valen', title: 'Director', type: 'Mixed', pay: 12000, team: [['mirelord', 55], ['steelmaw', 56], ['nocturnix', 56], ['spectrelle', 57], ['drillmole', 56], ['megalodent', 58, { mega: true }]], items: ['full_restore', 'full_restore'], ai: 5, mega: true, music: 'evil',
    intro: 'You\'ve read the murals. You know the ancients split the Aether Heart to stop one person from holding it. I intend to make it whole — and use it properly. Stand aside.', lose: 'So... a child stands where I could not. Perhaps the Heart chose correctly after all.' },
  valen_final: { name: 'Eclipsed Valen', title: '???', type: 'Mixed', pay: 50000, team: [['nihilux', 88], ['noctyrr', 85, { mega: true }], ['abyssdrake', 84], ['excalith', 84], ['megalodent', 84], ['basaltitan', 85]], items: ['full_restore', 'full_restore', 'full_restore', 'full_restore'], ai: 6, mega: true, music: 'final',
    intro: 'The void beyond the Expanse showed me the truth: the Heart was never meant to be split. Now it will be whole — through me!', lose: 'The void... recedes. Thank you... for stopping me again.' },
  // Rival (team chosen at runtime by starter)
  rival: { name: 'Kael', title: 'Rival', type: 'Mixed', ai: 2, music: 'rival' },
  // Veloria wardens & league
  w_bram: { name: 'Bram', title: 'Warden', type: 'Nature', badge: 'Grove Seal', pay: 8000, team: [['lumicap', 62], ['kelpstrider', 62], ['bramblehulk', 63], ['solstiflor', 63], ['wraithstag', 65, { mega: true }]], items: ['full_restore'], ai: 4, mega: true, intro: 'Veloria\'s first Warden welcomes you. The Gloamwood sings of your arrival.', lose: 'The forest approves. Take the Grove Seal.' },
  w_orla: { name: 'Orla', title: 'Warden', type: 'Aqua', badge: 'Current Seal', pay: 8500, team: [['conchord', 64], ['mudhound', 64], ['abyssquid', 65], ['riftshark', 65], ['ghostanchor', 67, { mega: true }]], items: ['full_restore'], ai: 4, mega: true, intro: 'Captain Orla, at your service — and at your throat. Let\'s sail!', lose: 'Ha! Fair winds, champion. The Current Seal is yours.' },
  w_quill: { name: 'Quill', title: 'Warden', type: 'Earth', badge: 'Prism Seal', pay: 9000, team: [['prismolith', 66], ['dunebastion', 66], ['obsilith', 67], ['glasslime', 66], ['miragenix', 68, { mega: true }]], items: ['full_restore'], ai: 5, mega: true, intro: 'Every crystal holds a memory. Let\'s make one worth keeping.', lose: 'Brilliant. Truly brilliant. The Prism Seal.' },
  w_tempest: { name: 'Zara', title: 'Warden', type: 'Wind', badge: 'Gale Seal', pay: 9500, team: [['tempeswift', 68], ['mirageagle', 68], ['typhox', 69], ['galecoil', 69], ['thundertiger', 70, { mega: true }]], items: ['full_restore', 'full_restore'], ai: 5, mega: true, intro: 'Up here the wind decides who stands. Let\'s see if it likes you.', lose: 'The wind changed direction. The Gale Seal is yours.' },
  w_ysolde: { name: 'Ysolde', title: 'Warden', type: 'Ice', badge: 'Aurora Seal', pay: 10000, team: [['blizzelle', 70], ['polarlynx', 70], ['frostowl', 71], ['icespinner', 71], ['glaciotusk', 73, { mega: true }]], items: ['full_restore', 'full_restore'], ai: 5, mega: true, intro: 'The aurora dances for the brave. Dance with me.', lose: 'Beautiful. The Aurora Seal belongs with you.' },
  w_ignatius: { name: 'Ignatius', title: 'Warden', type: 'Flame', badge: 'Forge Seal', pay: 11000, team: [['pyroclaw', 72], ['cinderwing', 72], ['forgehulk', 73], ['verdigear', 72], ['blazesteed', 75, { mega: true }]], items: ['full_restore', 'full_restore'], ai: 5, mega: true, intro: 'The forge of Zenith has burned since before memory. Prove you are worth tempering!', lose: 'Well forged. The final seal.' },
  v_elite1: { name: 'Marrow', title: 'High Warden', type: 'Spirit', pay: 15000, team: [['riftseraph', 76], ['ghostanchor', 76], ['blizzelle', 76], ['nightshroud', 77], ['phaselynx', 77], ['excalith', 78, { mega: true }]], items: ['full_restore', 'full_restore'], ai: 5, mega: true, intro: 'The rifts whisper your name.', lose: 'The whispers fall silent.' },
  v_elite2: { name: 'Corvina', title: 'High Warden', type: 'Shadow', pay: 15000, team: [['voidmantis', 77], ['gloamlynx', 77], ['obsilith', 77], ['cinderwing', 78], ['thundertiger', 78], ['umbrawolf', 79, { mega: true }]], items: ['full_restore', 'full_restore'], ai: 6, mega: true, intro: 'Darkness is not evil. It is merely honest.', lose: 'Honestly... impressive.' },
  v_elite3: { name: 'Solenne', title: 'High Warden', type: 'Dragon', pay: 15000, team: [['galecoil', 78], ['crystalwyrm', 79], ['sparkdrake', 78], ['glacierhorn', 78], ['wyvernox', 79], ['crystalwyrm', 80, { mega: true }]], items: ['full_restore', 'full_restore', 'full_restore'], ai: 6, mega: true, intro: 'Crystal and scale. Witness Veloria\'s pride.', lose: 'Go. The Sovereign awaits.' },
  v_champion: { name: 'Eira', title: 'Sovereign', type: 'Mixed', pay: 40000, team: [['auroramoth', 80], ['glaciotusk', 80], ['blazesteed', 81], ['paladrix', 81], ['riftseraph', 82], ['infernyx', 84, { mega: true }]], items: ['full_restore', 'full_restore', 'full_restore'], ai: 6, mega: true, music: 'champion', intro: 'Two regions. One crown. I am the Sovereign of Veloria — and the last test before the stars.', lose: 'You are the Champion of two worlds. Remarkable.' },
  neo_sable: { name: 'Sable', title: 'Neo Eclipse', type: 'Flame', pay: 12000, team: [['scaldrake', 70], ['pyroclaw', 70], ['forgehulk', 71], ['wyrmhound', 71], ['cinderwing', 70], ['hearthound', 73, { mega: true }]], items: ['full_restore', 'full_restore'], ai: 5, mega: true, music: 'evil', intro: 'The Syndicate is reborn as Neo Eclipse! The Rift Core will give us what the Heart denied.', lose: 'Again?! You haunt me across oceans...' },
  // Postgame secret bosses
  ancient_king: { name: 'King Aldric', title: 'Spectral', type: 'Mixed', pay: 30000, team: [['thalassor', 80, { mega: true }], ['coralith', 78], ['mausolith', 78], ['glyphion', 78], ['aeonray', 78]], items: ['full_restore', 'full_restore'], ai: 6, mega: true, music: 'legend', intro: 'Who disturbs the Sunken throne? Prove thy worth, living one!', lose: 'At last... a worthy heir. Take the crown\'s blessing.' },
};
MB.RIVAL_TEAMS = {
  // index by stage of story; key is the rival's starter
  r1: { lvl: [[0, 5]] },
};
MB.rivalTeam = function (stage, starter) {
  // stage 0..7 ; starter is rival's starter line base key
  const line = { emberfox: ['emberfox', 'blazetail', 'infernyx'], aquaphin: ['aquaphin', 'tidalfin', 'leviaphin'], leafling: ['leafling', 'verdantail', 'arborix'] }[starter];
  const L = [5, 15, 24, 34, 45, 55, 64, 75][stage];
  const st = L >= 36 ? 2 : L >= 16 ? 1 : 0;
  const pool = [['twigeet', 'brisquill', 'tempestrel', 11, 30], ['sparkit', 'voltpaw', 'thundermane', 15, 32], ['dracling', 'drakeon', 'wyvernox', 30, 50], ['shadepup', 'duskhound', 'umbrawolf', 18, 38], ['pebblit', 'bouldrone', 'montagor', 22, 99], ['thinkit', 'cerebrix', 'mentalord', 18, 38]];
  const team = [];
  const n = Math.min(6, 1 + stage);
  for (let i = 0; i < n - 1; i++) {
    const p = pool[i];
    const l = L - 3 + i;
    const s = l >= p[4] ? 2 : l >= p[3] ? 1 : 0;
    team.push([p[s], l]);
  }
  team.push([line[st], stage === 0 ? L : L + 2, stage === 0 ? { moves: ['tackle', 'growl'] } : { mega: stage >= 6 }]);
  return team;
};
