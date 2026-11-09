'use strict';
// =====================================================================================
// AETHERIA — region world spec. Generators in mapgen.js turn these into maps.
// =====================================================================================
MB.WORLD_SPECS = MB.WORLD_SPECS || {};
MB.WorldDSL = (function () {
  const W = MB.WORLD_SPECS;
  let REG = 'A';
  const base = (o) => Object.assign({ exits: [], npcs: [], items: [], portals: [], triggers: [] }, o);
  const D = {
    region(r) { REG = r; },
    T: (id, name, o) => (W[id] = base(Object.assign({ id, name, type: 'town', region: REG }, o))),
    R: (id, name, o) => (W[id] = base(Object.assign({ id, name, type: 'route', region: REG, music: 'route', env: 'grass' }, o))),
    F: (id, name, o) => (W[id] = base(Object.assign({ id, name, type: 'forest', region: REG, music: 'forest', env: 'forest', theme: 'forest' }, o))),
    C: (id, name, o) => (W[id] = base(Object.assign({ id, name, type: 'cave', region: REG, theme: 'cave', env: 'cave', music: 'cave' }, o))),
    link(a, sa, b, sb, o = {}) { W[a].exits.push(Object.assign({ side: sa, to: b, toSide: sb }, o.a || {})); W[b].exits.push(Object.assign({ side: sb, to: a, toSide: sa }, o.b || {})); },
    portal(a, b, o = {}) {
      const id = a + '>' + b;
      W[a].portals.push({ id, to: b, toPortal: b + '>' + a, near: o.nearA, cond: o.cond, lockedText: o.locked, tile: o.tileA });
      W[b].portals.push({ id: b + '>' + a, to: a, toPortal: id, near: o.nearB, tile: o.tileB });
    },
    tr: (cls, o = {}) => ({ at: o.at || 'path', kind: MB.CLASS_APP[cls] || o.kind, trainer: Object.assign({ cls }, o), sight: o.sight || 4, cond: o.cond }),
    npc: (talk, o = {}) => Object.assign({ talk }, o),
    STD: (shop, extra) => [{ kind: 'center' }, { kind: 'shop', shop: shop || 't1' }].concat(extra || []),
    house: (npcs, o = {}) => Object.assign({ kind: 'house', npcs }, o),
  };
  return D;
})();

(function () {
  const { T, R, F, C, link, portal, tr, npc, STD, house } = MB.WorldDSL;
  MB.WorldDSL.region('A');
  // ------------------------------------------------------------------ WILLOWBROOK
  T('willowbrook', 'Willowbrook Village', {
    w: 28, h: 24, theme: 'meadow', music: 'village', env: 'grass', mapXY: [4, 28], subtitle: 'A quiet village where journeys begin', fly: true, pond: true,
    buildings: [
      { kind: 'lab', id: 'wb_lab', label: 'LAB', name: 'Thorne Research Lab', npcs: [{ id: 'prof', at: [6, 2], kind: 'prof', name: 'Prof. Hazel', script: 'prof_talk', dir: 'down' }, { at: [2, 5], kind: 'researcher', talk: ['Professor Hazel studies the bonds between people and creatures.', 'Did you know some creatures only evolve when they truly trust you?'] }, { at: [9, 6], kind: 'researcher', script: 'lab_aide' }] },
      house([{ id: 'mom', at: [5, 3], kind: 'old', app: { skin: '#f8d8b8', hair: '#8a5030', hairStyle: 'bun', top: '#e07090', bottom: '#504070', dress: true }, script: 'mom_talk' }], { id: 'wb_home', label: '', name: 'Your House' }),
      house([{ id: 'rival_mom', at: [4, 2], kind: 'old', talk: ['Kael left in such a hurry! That kid has been dreaming of being Champion since forever.', 'Look after each other out there, okay?'] }], { id: 'wb_rival', name: "Kael's House" }),
      house([{ at: [2, 3], kind: 'old', talk: ['When I was young, we called the ruins in the east "the Hollow." Strange lights came from there at night...', 'They say the ancients could make their creatures transform with stones that sang.'] }], { id: 'wb_h1' }),
    ],
    npcs: [
      { id: 'wb_guard', at: 'exit:n', kind: 'kid', script: 'wb_guard', cond: '!got_starter' },
      npc(['The tall grass is full of wild creatures. Never go in without a partner!', 'Prof. Hazel\'s lab is the building with the grey roof.'], { move: 'wander' }),
      npc(['I love fishing in the pond, but the creatures here are tiny.', 'Big things live in the sea near Stormport, I hear.'], { kind: 'hiker', move: 'wander' }),
      { kind: 'old', script: 'wish_shrine', at: [3, 4], dir: 'down', name: 'Shrine Keeper' },
    ],
    items: [{ item: 'potion' }, { item: 'heart_scale', hidden: true }],
  });
  R('route1', 'Route 1', { w: 24, h: 44, theme: 'meadow', mapXY: [4, 24], wild: { habitats: ['meadow'], lvl: [2, 4], water: ['lake'] }, grass: 0.8, ledges: 2, subtitle: 'Willowbrook ↔ Verdant City',
    npcs: [tr('Youngster', { n: 1, lvl: 4, pre: 'My Nibblet is the toughest in the village!', post: 'Aw, man...' }), tr('Lass', { n: 2, lvl: 3, pre: 'Ooh, a new trainer! Battle me!' }), npc(['Wild creatures appear more often at night. Some only come out after dark!'], { move: 'wander' }), npc(['Try throwing capsules after you weaken a creature. Sleep and paralysis help too!'])],
    items: [{ item: 'basic_capsule', qty: 3 }, { item: 'potion' }, { item: 'berry_juice', hidden: true }, { item: 'wild_ward', hidden: true }] });
  link('willowbrook', 'n', 'route1', 's');
  // ------------------------------------------------------------------ VERDANT CITY
  T('verdant', 'Verdant City', {
    w: 34, h: 28, theme: 'meadow', music: 'town', mapXY: [4, 20], subtitle: 'The city of evergreen gardens', fly: true, grass: 0,
    buildings: STD('t1', [
      { kind: 'gym', id: 'gym_mira', puzzle: 'hedge', emblem: 'Nature', gym: { leader: 'mira', trainers: [['Picnicker', ['Nature'], 2, 10], ['Bug Catcher', ['Nature'], 2, 11]] } },
      house([{ at: [3, 3], script: 'q:verdant_garden' }], { id: 'vd_h1' }),
      house([{ at: [2, 2], kind: 'kid', talk: ['Mira\'s gym is a hedge maze! Look for gaps in the bushes.', 'Nature types are weak to Flame and Wind.'] }], { id: 'vd_h2' }),
      { kind: 'daycare', id: 'vd_daycare', label: 'CARE', npcs: [{ at: 'counter', kind: 'old', script: 'daycare' }] },
    ]),
    npcs: [
      npc(['Verdant City grows the best berries in Aetheria. The juice heals your creatures!'], { move: 'wander' }),
      npc(['The Day Care here raises creatures for you. Leave two together and you might find an Egg!'], { move: 'wander', kind: 'old' }),
      { at: 'exit:e', kind: 'hiker', script: 'gate_badge', gate: 1, cond: '!badge_mira', talk: ['The forest east of here is crawling with strong creatures. Come back with Mira\'s badge!'] },
      { script: 'q:verdant_lost_twigeet', kind: 'kid', at: [6, 20] },
      { id: 'cyclist', name: 'Cyclist Bea', kind: 'ranger', at: 'path', script: 'trail_bike' },
    ],
    items: [{ item: 'great_capsule', hidden: true }],
  });
  link('route1', 'n', 'verdant', 's');
  R('route2', 'Route 2', { w: 46, h: 22, theme: 'meadow', mapXY: [8, 20], wild: { habitats: ['meadow', 'forest'], lvl: [5, 8], water: ['lake'] }, water: 1, gates: [{ kind: 'shears', item: 'sun_shard' }],
    npcs: [tr('Bug Catcher', { n: 2, lvl: 7 }), tr('Camper', { n: 2, lvl: 8 }), tr('Lass', { n: 1, lvl: 9 }), tr('Youngster', { n: 3, lvl: 7 }), npc(['Some creatures evolve by holding special stones. Use them from the Bag!'])],
    items: [{ item: 'potion', qty: 2 }, { item: 'antidote' }, { item: 'great_capsule' }, { item: 'x_atk', hidden: true }, { item: 'honey_bun', hidden: true }] });
  link('verdant', 'e', 'route2', 'w');
  F('moonveil', 'Moonveil Forest', { w: 44, h: 40, mapXY: [12, 20], wild: { habitats: ['forest'], lvl: [7, 11] }, trees: 1.9, grass: 1.0, subtitle: 'Moonlight filters through ancient boughs', gates: [{ kind: 'shears', item: 'grizzlord_stone' }, { kind: 'shears', item: 'dusk_shard' }],
    npcs: [tr('Bug Catcher', { n: 3, lvl: 10 }), tr('Ranger', { n: 2, lvl: 11 }), tr('Picnicker', { n: 2, lvl: 10 }), { id: 'lyra_forest', name: 'Dr. Lyra', kind: 'researcher', app: { skin: '#e8b890', hair: '#4a2a6a', hairStyle: 'long', top: '#f0f0f0', bottom: '#3a3a5a', coat: true }, at: 'path', script: 'moonveil_event', cond: '!moonveil_done' },
      { id: 'mv_g1', kind: 'grunt', at: 'path', script: 'moonveil_event', cond: '!moonveil_done', name: 'Grunt', sight: 5 }, npc(['Deep in this forest there\'s a grove where a great spirit sleeps...', 'Thorny bushes block the way. You\'d need Garden Shears.'], { kind: 'ranger' }),
      { kind: 'old', at: 'path', script: 'grove_hint', cond: 'moonveil_done' }],
    items: [{ item: 'super_potion' }, { item: 'great_capsule', qty: 2 }, { item: 'mushroom_cap', hidden: true }, { item: 'night_capsule' }, { item: 'heart_scale', hidden: true }, { item: 'rare_candy', hidden: true }] });
  link('route2', 'e', 'moonveil', 'w');
  R('moonveil_grove', 'Moonveil Grove', { w: 24, h: 20, theme: 'forest', env: 'forest', music: 'ruins', mapXY: [12, 17], grass: 0.3, trees: 0.6, flowers: 14, wild: { habitats: ['forest'], lvl: [20, 26] }, subtitle: 'An ancient, hallowed clearing', weather: 'motes',
    npcs: [{ legend: 'sylvarch', lvl: 50, at: [12, 6], cond: 'badge_selene&!caught_sylvarch', script: 'legend_sylvarch' }, { at: [16, 10], script: 'star_shard_grove', kind: 'old', name: 'Grove Spirit', app: { skin: '#c0e8c0', hair: '#80c080', hairStyle: 'long', top: '#a0d0a0', bottom: '#609060', dress: true }, cond: 'caught_sylvarch&!shard_grove' }],
    items: [{ item: 'elderoot_stone', hidden: true }, { item: 'aurorelle_stone', cond: 'q_done:verdant_garden' }] });
  link('moonveil', 'n', 'moonveil_grove', 's', { a: { gate: 'shears', gateText: 'Thorny bushes block the path to the grove. Garden Shears could cut them.' } });
  R('route3', 'Route 3', { w: 44, h: 24, theme: 'meadow', mapXY: [16, 20], wild: { habitats: ['lake', 'meadow'], lvl: [10, 14], water: ['lake'] }, water: 3, subtitle: 'Lakeside trail', river: true,
    npcs: [tr('Fisher', { n: 2, lvl: 13 }), tr('Swimmer', { n: 2, lvl: 13, cond: 'badge_marina' }), tr('Picnicker', { n: 2, lvl: 12 }), tr('Camper', { n: 3, lvl: 12 }), { id: 'rival2', at: 'exit:e', kind: 'ace', script: 'rival_2', cond: 'moonveil_done&!rival2_done', name: 'Kael' }, npc(['The lake is so clear you can see creatures swimming below.'], { move: 'wander' })],
    items: [{ item: 'super_potion' }, { item: 'aqua_capsule' }, { item: 'fishing_rod', cond: '' }, { item: 'pearl', hidden: true }] });
  link('moonveil', 'e', 'route3', 'w', { a: { gate: 'flag:moonveil_done', gateText: 'A Syndicate barricade blocks the eastern trail. Someone in the forest is shouting for help...' } });
  // ------------------------------------------------------------------ CRYSTALWATER
  T('crystalwater', 'Crystalwater Town', {
    w: 36, h: 30, theme: 'meadow', music: 'town', mapXY: [20, 20], subtitle: 'Lakeside town of the great dam', fly: true, pond: true,
    buildings: STD('t2', [
      { kind: 'gym', id: 'gym_voltan', puzzle: 'switch', emblem: 'Electric', gym: { leader: 'voltan', trainers: [['Engineer', ['Electric'], 2, 15], ['Researcher', ['Electric', 'Metal'], 3, 15], ['Engineer', ['Electric'], 3, 16]] } },
      house([{ at: [2, 2], script: 'q:crystal_dam' }], { id: 'cw_h1' }),
      house([{ at: [3, 3], kind: 'old', talk: ['The great dam powers half of Aetheria. Leader Voltan built it with his own two hands!', 'Electric moves can\'t hurt Earth-type creatures.'] }], { id: 'cw_h2' }),
      house([{ at: [2, 3], kind: 'hiker', script: 'q:fishing_master' }], { id: 'cw_h3' }),
    ]),
    npcs: [npc(['Fishing is great here! Face the water and use a Fishing Rod.'], { move: 'wander' }), { at: 'exit:n', kind: 'hiker', script: 'gate_badge', gate: 2, cond: '!badge_voltan', talk: ['Ironpeak Mountain is dangerous. Leader Voltan won\'t let anyone through without his badge.'] }, npc(['I saw people in black uniforms heading toward the mountain...'], { kind: 'old' })],
    items: [{ item: 'torrentoad_stone', hidden: true, cond: 'badge_marina' }, { item: 'volt_shard', hidden: true }],
  });
  link('route3', 'e', 'crystalwater', 'w');
  R('route4', 'Route 4', { w: 26, h: 44, theme: 'mountain', mapXY: [20, 16], wild: { habitats: ['mountain', 'meadow'], lvl: [14, 17] }, ledges: 3, boulders: 4, subtitle: 'The foothills of Ironpeak', gates: [{ kind: 'hammer', item: 'ember_shard' }],
    npcs: [tr('Hiker', { n: 2, lvl: 16 }), tr('Camper', { n: 3, lvl: 15 }), tr('Black Belt', { n: 2, lvl: 16 }), tr('Lass', { n: 2, lvl: 15 })],
    items: [{ item: 'super_potion' }, { item: 'great_capsule', qty: 2 }, { item: 'nerve_tonic' }, { item: 'nugget', hidden: true }] });
  link('crystalwater', 'n', 'route4', 's');
  C('ironpeak_1', 'Ironpeak Mountain 1F', { w: 40, h: 32, mapXY: [20, 12], wild: { habitats: ['cave', 'mountain'], lvl: [15, 19] }, boulders: 4, water: 1, subtitle: 'A labyrinth of iron-rich tunnels',
    npcs: [tr('Hiker', { n: 2, lvl: 17, at: 'random' }), tr('Black Belt', { n: 2, lvl: 18, at: 'random' }), { kind: 'grunt', name: 'Grunt', at: 'random', trainer: { cls: 'Grunt', name: 'Grunt', types: ['Venom', 'Shadow'], n: 2, lvl: 17, pre: 'The Syndicate is mining Aether ore here. Scram!', post: 'We\'ll get what we came for anyway!' }, sight: 4 }],
    items: [{ item: 'super_potion' }, { item: 'dungeon_rope' }, { item: 'great_capsule' }, { item: 'star_dust', hidden: true }, { item: 'rare_candy', hidden: true }] });
  link('route4', 'n', 'ironpeak_1', 's');
  C('ironpeak_2', 'Ironpeak Mountain 2F', { w: 36, h: 30, mapXY: [20, 11], wild: { habitats: ['cave', 'mountain'], lvl: [17, 21] }, boulders: 6, dark: false,
    npcs: [tr('Hiker', { n: 3, lvl: 19, at: 'random' }), tr('Ruin Maniac', { n: 2, lvl: 19, at: 'random' }), { kind: 'grunt', at: 'random', trainer: { cls: 'Grunt', name: 'Grunt', types: ['Metal', 'Venom'], n: 2, lvl: 19, pre: 'You again?! Our drills will crack this mountain open!' }, sight: 3 }],
    items: [{ item: 'hyper_potion' }, { item: 'montagor_stone', hidden: true }, { item: 'revive' }, { item: 'pick_hammer', cond: 'never' }, { item: 'heart_scale', hidden: true }] });
  portal('ironpeak_1', 'ironpeak_2');
  R('ironpeak_summit', 'Ironpeak Summit', { w: 30, h: 26, theme: 'snow', env: 'snow', music: 'snow', mapXY: [20, 9], wall: '#', wild: { habitats: ['mountain', 'snow'], lvl: [18, 22] }, grass: 0.5, trees: 0.3, subtitle: 'Above the clouds',
    npcs: [tr('Skier', { n: 2, lvl: 20 }), tr('Hiker', { n: 3, lvl: 20 }), npc(['On clear days you can see the whole region from here!', 'Look east — the desert city Sunspire shines like gold.'])],
    items: [{ item: 'frost_shard' }, { item: 'max_ward', hidden: true }] });
  portal('ironpeak_2', 'ironpeak_summit', { nearB: 'n' });
  R('route5', 'Route 5', { w: 46, h: 22, theme: 'desert', env: 'desert', music: 'desert', mapXY: [25, 10], wall: 'T', wild: { habitats: ['desert'], lvl: [20, 24] }, grass: 0.5, trees: 0.25, flowers: 0, subtitle: 'The Scorching Road',
    npcs: [tr('Hiker', { n: 2, lvl: 22 }), tr('Camper', { n: 3, lvl: 22 }), tr('Ruin Maniac', { n: 2, lvl: 23 }), tr('Kindler', { n: 2, lvl: 22 }), npc(['Sandstorms here sting! Earth, Metal and... was it Venom? No — Earth and Metal types don\'t mind them.'])],
    items: [{ item: 'super_potion', qty: 2 }, { item: 'dunesharq_stone', hidden: true, cond: 'champion' }, { item: 'burn_salve' }, { item: 'sun_shard', hidden: true }] });
  link('ironpeak_summit', 'e', 'route5', 'w');
  // ------------------------------------------------------------------ SUNSPIRE
  T('sunspire', 'Sunspire City', {
    w: 36, h: 30, theme: 'desert', env: 'desert', music: 'desert', mapXY: [30, 10], wall: 'T', road: '=', city: true, subtitle: 'The golden city beneath the sun', fly: true, flowers: 0,
    buildings: STD('t2', [
      { kind: 'gym', id: 'gym_brutus', puzzle: 'boulder', emblem: 'Earth', gym: { leader: 'brutus', trainers: [['Hiker', ['Earth'], 3, 22], ['Black Belt', ['Earth', 'Normal'], 3, 23], ['Hiker', ['Earth', 'Metal'], 3, 23]] } },
      { kind: 'museum', id: 'ss_museum', label: 'MUSEUM', npcs: [{ at: [5, 4], kind: 'researcher', talk: ['These murals show the ancient Aetherians. They held glowing stones up to their creatures...', 'The creatures changed shape! The ancients called it the "Great Becoming." We call it Mega Evolution.'] }, { at: [2, 2], script: 'q:sunspire_relic' }] },
      house([{ at: [3, 2], script: 'q:sunmane_trial' }], { id: 'ss_h1' }),
      { kind: 'shop', id: 'ss_shop2', label: 'TONIC', shop: 'tonic' },
    ]),
    npcs: [{ id: 'strongman', name: 'Strongman Rocco', kind: 'hiker', at: 'path', script: 'power_gloves' }, npc(['Sunspire was built on the ruins of an ancient Aetherian city. Dig anywhere and you\'ll find relics!'], { move: 'wander' }), npc(['Brutus\'s gym is full of boulders. Push them out of your way!'], { kind: 'hiker' }), { at: 'exit:s', kind: 'hiker', script: 'gate_badge', gate: 3, cond: '!badge_brutus', talk: ['The road to Ancient Hollow is closed to all but those with the Bedrock Badge.'] }],
    items: [{ item: 'ancient_coin', hidden: true }, { item: 'hyper_potion' }],
  });
  link('route5', 'e', 'sunspire', 'w');
  R('route6', 'Route 6', { w: 26, h: 44, theme: 'ruins', env: 'ruins', music: 'route', mapXY: [30, 14], wild: { habitats: ['desert', 'ruins'], lvl: [24, 28] }, grass: 0.6, trees: 0.3, subtitle: 'Road of Fallen Pillars', ledges: 2,
    npcs: [tr('Ruin Maniac', { n: 3, lvl: 26 }), tr('Psychic', { n: 2, lvl: 26 }), tr('Hex Maniac', { n: 2, lvl: 27 }), tr('Ace Trainer', { n: 3, lvl: 28 })],
    items: [{ item: 'ancient_coin' }, { item: 'hyper_potion' }, { item: 'relic_vase', hidden: true }, { item: 'ancient_capsule' }] });
  link('sunspire', 's', 'route6', 'n');
  T('ancient_hollow', 'Ancient Hollow', {
    w: 34, h: 30, theme: 'ruins', env: 'ruins', music: 'ruins', mapXY: [30, 18], road: '=', subtitle: 'Ruins of the first Aether wielders', fly: true, lamps: false, trees: 10,
    buildings: [{ kind: 'center' }, { kind: 'temple', id: 'hollow_temple', label: '', name: 'Hollow Temple', npcs: [{ at: [6, 2], script: 'hollow_mural', kind: 'researcher', name: 'Mural' }] }, { kind: 'hut', id: 'hollow_camp', label: '', name: 'Research Camp', npcs: [{ at: [2, 1], script: 'fossil_revive', kind: 'researcher', name: 'Fossil Expert' }] }],
    npcs: [{ id: 'lyra_hollow', name: 'Dr. Lyra', at: 'door:hollow_temple', kind: 'researcher', app: { skin: '#e8b890', hair: '#4a2a6a', hairStyle: 'long', top: '#f0f0f0', bottom: '#3a3a5a', coat: true }, script: 'hollow_event', cond: '!hollow_done' },
      { id: 'vex', name: 'Commander Vex', kind: 'commander', at: 'path', script: 'hollow_event', cond: '!hollow_done', sight: 4, app: { skin: '#f8d8b8', hair: '#40d080', hairStyle: 'spiky', top: '#402858', bottom: '#201828', emblem: true, hat: '#40d080' } },
      { kind: 'researcher', script: 'q:ptercient_fossil', at: 'path' }, { kind: 'old', script: 'q:excalith_sword', at: 'path' }, { at: 'exit:s', kind: 'ranger', script: 'gate_flag', flag: 'hollow_done', cond: '!hollow_done', talk: ['There\'s a commotion at the temple! Nobody leaves until it\'s settled.'] }],
    portals: [], items: [{ item: 'ancient_capsule' }, { item: 'relic_crown', hidden: true, cond: 'champion' }],
  });
  link('route6', 's', 'ancient_hollow', 'n');
  C('hollow_depths', 'Hollow Depths', { w: 38, h: 32, theme: 'ruins', env: 'ruins', music: 'ruins', mapXY: [31, 19], dark: true, wild: { habitats: ['ruins', 'cave'], lvl: [28, 34] }, subtitle: 'Where the ancients sealed their secrets',
    npcs: [tr('Hex Maniac', { n: 3, lvl: 31, at: 'random' }), tr('Ruin Maniac', { n: 3, lvl: 31, at: 'random' }), { legend: 'basaltitan', lvl: 60, at: 'random', cond: 'champion&!caught_basaltitan', script: 'legend_generic' }],
    items: [{ item: 'spectrelle_stone', hidden: true }, { item: 'relic_vase' }, { item: 'ancient_capsule', qty: 2 }, { item: 'fin_fossil', hidden: true }, { item: 'shell_fossil', hidden: true }] });
  portal('ancient_hollow', 'hollow_depths', { nearA: 'n', cond: 'hollow_done', locked: 'A heavy stone door. It won\'t budge yet.' });
  C('forgotten_1', 'Forgotten Expanse', { w: 44, h: 36, theme: 'rift', env: 'legend', music: 'rift', mapXY: [45, 4], wild: { habitats: ['ruins', 'sky', 'caldera', 'observatory', 'cave'], lvl: [60, 68], mixed: true }, grassy: 6, subtitle: 'A place outside of time', weather: 'motes', postgame: true,
    npcs: [tr('Veteran', { n: 6, lvl: 70, at: 'random' }), tr('Dragon Tamer', { n: 6, lvl: 70, at: 'random' }), { legend: 'chronyx', lvl: 70, at: 'random', cond: '!caught_chronyx', script: 'legend_generic' }],
    items: [{ item: 'ancient_capsule', qty: 3 }, { item: 'max_revive' }, { item: 'comet_piece', hidden: true }, { item: 'rare_candy', hidden: true }] });
  portal('hollow_depths', 'forgotten_1', { cond: 'champion', locked: 'An ancient seal glows faintly. Only a Champion\'s presence might break it.' });
  C('forgotten_2', 'Forgotten Core', { w: 30, h: 26, theme: 'rift', env: 'space', music: 'legend', mapXY: [46, 3], open: 0.62, subtitle: 'The heart of the void', weather: 'motes', postgame: true,
    npcs: [{ legend: 'ignivar', lvl: 75, at: 'random', cond: '!caught_ignivar', script: 'legend_generic' }, { legend: 'aethereon', lvl: 80, at: 'random', cond: 'v_champion&!caught_aethereon', script: 'legend_generic' }, { id: 'eclipsed', name: 'Eclipsed Valen', kind: 'commander', at: 'random', script: 'final_boss', cond: 'v_champion&!final_boss_done', app: { skin: '#c0b0d0', hair: '#202030', hairStyle: 'short', top: '#100818', bottom: '#100818', emblem: true, hat: '#ff40c0' } }, { legend: 'nihilux', lvl: 85, at: 'random', cond: 'final_boss_done&!caught_nihilux', script: 'legend_generic' }],
    items: [{ item: 'master_capsule', hidden: true, cond: 'v_champion' }, { item: 'legendary_capsule', qty: 2 }] });
  portal('forgotten_1', 'forgotten_2');
  R('route7', 'Route 7', { w: 24, h: 46, theme: 'meadow', mapXY: [30, 23], wild: { habitats: ['meadow', 'beach'], lvl: [28, 32], water: ['sea'] }, water: 2, ledges: 2, gates: [{ kind: 'climb', item: 'swift_tonic' }],
    npcs: [tr('Sailor', { n: 3, lvl: 30 }), tr('Beauty', { n: 2, lvl: 31 }), tr('Ace Trainer', { n: 3, lvl: 32 }), tr('Fisher', { n: 3, lvl: 30 })],
    items: [{ item: 'hyper_potion' }, { item: 'revive' }, { item: 'ultra_capsule' }, { item: 'big_pearl', hidden: true }] });
  link('ancient_hollow', 's', 'route7', 'n');
  // ------------------------------------------------------------------ STORMPORT
  T('stormport', 'Stormport City', {
    w: 38, h: 30, theme: 'beach', env: 'beach', music: 'sea', mapXY: [30, 27], road: '=', city: true, stormy: true, subtitle: 'Gateway to the seas', fly: true,
    buildings: STD('t3', [
      { kind: 'gym', id: 'gym_marina', puzzle: 'slide', emblem: 'Aqua', gym: { leader: 'marina', trainers: [['Swimmer', ['Aqua'], 3, 28], ['Sailor', ['Aqua', 'Electric'], 3, 29], ['Swimmer', ['Aqua', 'Ice'], 3, 29]] } },
      { kind: 'port', id: 'sp_port', label: 'PORT', npcs: [{ at: [2, 0], kind: 'sailor', script: 'ship_veloria' }] },
      { kind: 'shop', id: 'sp_capsule', label: 'CAPS', shop: 'capsule' },
      house([{ at: [3, 2], kind: 'sailor', script: 'q:megalodent_hunt' }], { id: 'sp_h1' }),
      house([{ at: [2, 2], script: 'q:lighthouse_storm' }], { id: 'sp_h2' }),
      { kind: 'shop', id: 'sp_held', label: 'GEAR', shop: 'held' },
    ]),
    npcs: [{ id: 'rival3', at: 'door:gym_marina', kind: 'ace', name: 'Kael', script: 'rival_3', cond: 'hollow_done&!rival3_done' }, npc(['Ships to the far land of Veloria sail from here — but only for Champions.'], { kind: 'sailor', move: 'wander' }), npc(['East over the water lie the Coralwind Islands. You\'ll need to surf!']), { at: 'exit:w', kind: 'sailor', script: 'gate_badge', gate: 4, cond: '!badge_marina', talk: ['The western road to Emberfall is flooded until Marina says otherwise. Beat her!'] }],
    items: [{ item: 'pearl', hidden: true }, { item: 'aqua_capsule', qty: 2 }],
  });
  link('route7', 's', 'stormport', 'n');
  R('sea_route', 'Coralwind Strait', { w: 44, h: 28, theme: 'beach', env: 'water', music: 'sea', mapXY: [34, 29], wild: { habitats: ['sea', 'beach'], lvl: [30, 36], water: ['sea'] }, water: 9, grass: 0.2, trees: 0.2, path: 's', subtitle: 'Surf the warm currents', surfRiver: true, river: true,
    npcs: [tr('Swimmer', { n: 3, lvl: 34 }), tr('Swimmer', { n: 3, lvl: 34 }), tr('Fisher', { n: 3, lvl: 34 })], items: [{ item: 'big_pearl', hidden: true }, { item: 'ultra_capsule' }] });
  link('stormport', 'e', 'sea_route', 'w', { a: { gate: 'surf', gateText: 'The sea stretches east. With an Aqua Saddle you could surf across.' } });
  T('coralwind', 'Coralwind Islands', { w: 34, h: 28, theme: 'beach', env: 'beach', music: 'sea', mapXY: [37, 30], road: 's', subtitle: 'Sun, sand and secrets', fly: true, pond: true, grass: 3,
    buildings: STD('t3', [house([{ at: [2, 2], kind: 'old', script: 'q:krabastion_shell' }], { id: 'cr_h1' }), house([{ at: [3, 2], kind: 'sailor', script: 'q:islandon_turtle' }], { id: 'cr_h2' }), { kind: 'hut', id: 'cr_hut', label: '', npcs: [{ at: [2, 1], kind: 'old', script: 'move_tutor' }] }]),
    npcs: [npc(['The Sunken Kingdom lies beneath the eastern reef. Only divers can reach it.'], { kind: 'sailor' }), npc(['Coral creatures love warm water. Try surfing around the islands!'])],
    items: [{ item: 'krabastion_stone', hidden: true, cond: 'q_done:krabastion_shell' }, { item: 'big_pearl' }, { item: 'star_dust', hidden: true }] });
  link('sea_route', 'e', 'coralwind', 'w');
  C('sunken_1', 'Sunken Kingdom', { w: 40, h: 34, theme: 'rift', env: 'water', music: 'ruins', mapXY: [41, 30], water: 4, deep: false, wild: { habitats: ['sea', 'ruins'], lvl: [40, 46], water: ['sea'] }, subtitle: 'A drowned civilization', dark: true,
    npcs: [tr('Swimmer', { n: 4, lvl: 44, at: 'random' }), tr('Ruin Maniac', { n: 4, lvl: 44, at: 'random' }), { legend: 'coralith', lvl: 55, at: 'random', cond: '!caught_coralith', script: 'legend_generic' }],
    items: [{ item: 'abyssdrake_stone', hidden: true }, { item: 'relic_crown' }, { item: 'ancient_capsule', qty: 2 }, { item: 'big_pearl', hidden: true }] });
  portal('coralwind', 'sunken_1', { cond: 'badge_frost', locked: 'Deep blue water swirls here. Dive Gear could take you down.', tileA: 'D' });
  C('sunken_throne', 'Sunken Throne', { w: 26, h: 22, theme: 'rift', env: 'legend', music: 'legend', mapXY: [43, 31], open: 0.66, subtitle: 'The throne of the drowned king',
    npcs: [{ id: 'aldric', name: 'King Aldric', kind: 'commander', at: 'random', script: 'aldric', cond: '!aldric_done', app: { skin: '#a0d8e0', hair: '#e0e8f0', hairStyle: 'hat', hat: '#e0c040', top: '#4060a0', bottom: '#203060' } }, { legend: 'thalassor', lvl: 70, at: 'random', cond: 'aldric_done&!caught_thalassor', script: 'legend_generic' }, { at: 'random', script: 'star_shard_throne', kind: 'old', name: 'Throne Echo', cond: 'aldric_done&!shard_throne' }],
    items: [{ item: 'thalassor_stone', cond: 'caught_thalassor' }] });
  portal('sunken_1', 'sunken_throne');
  R('route8', 'Route 8', { w: 46, h: 24, theme: 'beach', env: 'beach', music: 'route', mapXY: [34, 24], wild: { habitats: ['beach', 'meadow', 'volcano'], lvl: [32, 36], water: ['sea'] }, water: 2, path: 's', subtitle: 'The Ember Coast',
    npcs: [tr('Kindler', { n: 3, lvl: 34 }), tr('Beauty', { n: 3, lvl: 34 }), tr('Sailor', { n: 3, lvl: 35 }), tr('Ace Trainer', { n: 3, lvl: 36 })],
    items: [{ item: 'hyper_potion' }, { item: 'ember_shard' }, { item: 'full_heal' }, { item: 'nugget', hidden: true }] });
  link('stormport', 'w', 'route8', 'e');
  // ------------------------------------------------------------------ EMBERFALL
  T('emberfall', 'Emberfall City', {
    w: 38, h: 30, theme: 'volcano', env: 'city', music: 'city', mapXY: [38, 21], road: '=', city: true, subtitle: 'City of forges and furnaces', fly: true, trees: 2, flowers: 0,
    buildings: STD('t3', [
      { kind: 'gym', id: 'gym_cinder', puzzle: 'lava', emblem: 'Flame', gym: { leader: 'cinder', trainers: [['Kindler', ['Flame'], 3, 33], ['Kindler', ['Flame'], 4, 34], ['Ace Trainer', ['Flame', 'Earth'], 4, 35]] } },
      { kind: 'hq', id: 'ember_plant', label: 'POWER', name: 'Emberfall Power Plant', npcs: [{ id: 'rook', name: 'Commander Rook', kind: 'commander', at: [6, 2], script: 'plant_rook', cond: '!plant_done', app: { skin: '#e8b890', hair: '#808890', hairStyle: 'short', top: '#402858', bottom: '#201828', emblem: true, hat: '#a0a8b0' } }, { kind: 'grunt', at: [3, 3], trainer: { cls: 'Grunt', name: 'Grunt', types: ['Metal', 'Electric'], n: 3, lvl: 33, pre: 'Intruder in the plant!' }, sight: 3, cond: '!plant_done' }, { kind: 'grunt', at: [9, 4], trainer: { cls: 'Grunt', name: 'Grunt', types: ['Venom', 'Electric'], n: 3, lvl: 33, pre: 'You won\'t reach the Commander!' }, sight: 3, cond: '!plant_done' }, { kind: 'researcher', at: [9, 2], script: 'plant_engineer', cond: 'plant_done' }] },
      house([{ at: [3, 2], kind: 'kid', script: 'q:cinder_pup' }], { id: 'ef_h1' }),
      { kind: 'shop', id: 'ef_battle', label: 'BATTLE', shop: 'battle' },
      house([{ at: [2, 2], kind: 'hiker', script: 'q:forge_ore' }], { id: 'ef_h2' }),
    ]),
    npcs: [{ at: 'door:gym_cinder', kind: 'kid', script: 'gate_flag', flag: 'plant_done', cond: '!plant_done', talk: ['Leader Cinder ran to the power plant! Something weird is going on there...'] }, npc(['The Power Plant feeds the furnaces. Lately there are strange people in black around it.'], { move: 'wander' }), { at: 'exit:n', kind: 'hiker', script: 'gate_badge', gate: 5, cond: '!badge_cinder', talk: ['Only Blaze Badge holders may enter the Ashen Caldera.'] }],
    items: [{ item: 'flame_sigil', hidden: true }, { item: 'hyper_potion' }],
  });
  link('route8', 'w', 'emberfall', 'e');
  R('route9', 'Route 9', { w: 26, h: 42, theme: 'volcano', env: 'volcano', music: 'volcano', mapXY: [40, 17], wall: '#', wild: { habitats: ['volcano', 'mountain'], lvl: [36, 40] }, grass: 0.6, trees: 0.2, flowers: 0, subtitle: 'Cinder Slopes', gates: [{ kind: 'hammer', item: 'hearthound_stone', cond: 'never' }],
    npcs: [tr('Kindler', { n: 3, lvl: 38 }), tr('Hiker', { n: 3, lvl: 38 }), tr('Ace Trainer', { n: 3, lvl: 39 }), tr('Black Belt', { n: 3, lvl: 38 })],
    items: [{ item: 'hyper_potion' }, { item: 'burn_salve', qty: 2 }, { item: 'max_revive', hidden: true }] });
  link('emberfall', 'n', 'route9', 's');
  C('caldera_1', 'Ashen Caldera', { w: 40, h: 32, theme: 'volcano', env: 'volcano', music: 'volcano', mapXY: [41, 14], lava: 6, wild: { habitats: ['volcano', 'caldera'], lvl: [38, 42] }, subtitle: 'Smoldering heart of the mountain',
    npcs: [tr('Kindler', { n: 4, lvl: 40, at: 'random' }), { kind: 'grunt', at: 'random', trainer: { cls: 'Grunt', name: 'Grunt', types: ['Flame', 'Venom'], n: 3, lvl: 40, pre: 'This lab is classified!' }, sight: 4, cond: '!caldera_done' }, { kind: 'grunt', at: 'random', trainer: { cls: 'Grunt', name: 'Grunt', types: ['Flame', 'Shadow'], n: 3, lvl: 40 }, sight: 4, cond: '!caldera_done' }, { id: 'mara', name: 'Lt. Mara', kind: 'commander', at: 'random', script: 'caldera_lab', cond: '!caldera_done', app: { skin: '#c08860', hair: '#e04040', hairStyle: 'long', top: '#402858', bottom: '#201828', emblem: true } }],
    items: [{ item: 'calderon_stone', hidden: true }, { item: 'flame_sigil' }, { item: 'full_heal' }, { item: 'revive' }] });
  link('route9', 'n', 'caldera_1', 's');
  R('caldera_peak', 'Caldera Peak', { w: 26, h: 24, theme: 'volcano', env: 'volcano', music: 'legend', mapXY: [42, 13], wall: '#', grass: 0.2, trees: 0.2, flowers: 0, wild: { habitats: ['caldera'], lvl: [45, 50] }, weather: 'ash',
    npcs: [{ legend: 'pyrrhawk', lvl: 55, at: [13, 6], cond: 'champion&!caught_pyrrhawk', script: 'legend_generic' }], items: [{ item: 'scaldrake_stone', hidden: true }, { item: 'max_revive' }] });
  portal('caldera_1', 'caldera_peak', { tileA: '>', nearB: 's', cond: 'champion', locked: 'A sheer rock wall rises toward the peak. A powerful presence lies above... (Postgame)' });
  R('route10', 'Route 10', { w: 26, h: 44, theme: 'mountain', env: 'sky', music: 'sky', mapXY: [41, 10], wall: '#', wild: { habitats: ['mountain', 'sky'], lvl: [40, 44] }, ledges: 3, gates: [{ kind: 'climb', item: 'tempestrel_stone' }, { kind: 'climb', item: 'ultra_capsule' }], subtitle: 'Cloudstep Pass',
    npcs: [tr('Hiker', { n: 3, lvl: 42 }), tr('Ace Trainer', { n: 4, lvl: 43 }), tr('Psychic', { n: 3, lvl: 42 }), tr('Ranger', { n: 3, lvl: 42 })],
    items: [{ item: 'hyper_potion', qty: 2 }, { item: 'max_ward' }, { item: 'comet_piece', hidden: true }] });
  link('caldera_1', 'n', 'route10', 's', { a: { gate: 'flag:caldera_done', gateText: 'Syndicate barricades block the northern tunnel. Defeat their lieutenant first!' } });
  // ------------------------------------------------------------------ SKYREACH
  T('skyreach', 'Skyreach City', {
    w: 36, h: 30, theme: 'sky', env: 'sky', music: 'sky', mapXY: [41, 6], road: '=', city: true, subtitle: 'The city above the clouds', fly: true, flowers: 12,
    buildings: STD('t4', [
      { kind: 'gym', id: 'gym_selene', puzzle: 'teleport', emblem: 'Psychic', gym: { leader: 'selene', trainers: [['Psychic', ['Psychic'], 4, 39], ['Psychic', ['Psychic', 'Spirit'], 4, 40], ['Socialite', ['Psychic', 'Light'], 4, 40]] } },
      house([{ at: [3, 2], kind: 'old', script: 'q:mentalord_mind' }], { id: 'sk_h1' }),
      house([{ at: [2, 2], kind: 'researcher', script: 'q:stormhawk_feather' }], { id: 'sk_h2' }),
      { kind: 'shop', id: 'sk_evo', label: 'STONES', shop: 'evo' },
      house([{ at: [2, 3], kind: 'old', script: 'move_reminder' }], { id: 'sk_h3' }),
    ]),
    npcs: [{ id: 'rival4', at: 'exit:w', kind: 'ace', name: 'Kael', script: 'rival_4', cond: 'badge_selene&!rival4_done' }, npc(['The wind up here never stops. Wind creatures love it!'], { move: 'wander' }), { at: 'exit:w', kind: 'psychic', script: 'gate_badge', gate: 6, cond: '!badge_selene', talk: ['Leader Selene foresaw that you would try to pass. She also foresaw that I would stop you.'] }],
    items: [{ item: 'psychic_sigil', hidden: true }],
  });
  link('route10', 'n', 'skyreach', 's');
  R('route11', 'Route 11', { w: 44, h: 22, theme: 'sky', env: 'sky', music: 'sky', mapXY: [37, 4], wild: { habitats: ['sky', 'observatory'], lvl: [43, 46] }, subtitle: 'Starwind Ridge',
    npcs: [tr('Psychic', { n: 3, lvl: 45 }), tr('Ace Trainer', { n: 4, lvl: 45 }), tr('Socialite', { n: 3, lvl: 44 })], items: [{ item: 'stormhawk_stone', hidden: true, cond: 'q_done:stormhawk_feather' }, { item: 'ultra_capsule', qty: 2 }, { item: 'star_dust' }] });
  link('skyreach', 'w', 'route11', 'e');
  T('starfall', 'Starfall Observatory', {
    w: 30, h: 26, theme: 'sky', env: 'sky', music: 'ruins', mapXY: [32, 3], road: '=', subtitle: 'Where the ancients read the stars', fly: true, trees: 4,
    buildings: [{ kind: 'center' }, { kind: 'observatory', id: 'obs_main', label: 'STARS', name: 'Starfall Observatory', npcs: [{ id: 'nyx', name: 'Commander Nyx', kind: 'commander', at: [6, 2], script: 'obs_nyx', cond: '!obs_done', app: { skin: '#e0d8f0', hair: '#c080ff', hairStyle: 'long', top: '#402858', bottom: '#201828', emblem: true, dress: true } }, { id: 'lyra_obs', name: 'Dr. Lyra', kind: 'researcher', at: [3, 3], script: 'obs_lyra', app: { skin: '#e8b890', hair: '#4a2a6a', hairStyle: 'long', top: '#f0f0f0', bottom: '#3a3a5a', coat: true } }, { kind: 'researcher', at: [9, 3], script: 'q:celestag_meteor' }] }],
    npcs: [npc(['During meteor showers, a legendary creature is said to sing on the observatory roof.'], { move: 'wander' }), { legend: 'lunelle', lvl: 50, at: [15, 6], cond: 'champion&!caught_lunelle&time=night', script: 'legend_lunelle' }, { at: 'exit:w', kind: 'researcher', script: 'gate_flag', flag: 'obs_done', cond: '!obs_done', talk: ['Something\'s wrong inside the observatory! Please help!'] }, { at: [6, 6], kind: 'old', name: 'Stargazer', script: 'star_shard_starfall', cond: 'champion&!shard_starfall' }],
    items: [{ item: 'meteorix_stone', hidden: true, cond: 'time=night' }, { item: 'comet_piece', hidden: true }],
  });
  link('route11', 'w', 'starfall', 'e');
  R('route12', 'Route 12', { w: 46, h: 24, theme: 'snow', env: 'snow', music: 'snow', mapXY: [27, 4], wild: { habitats: ['snow', 'mountain'], lvl: [45, 48] }, trees: 0.6, subtitle: 'The Frozen Mile',
    npcs: [tr('Skier', { n: 4, lvl: 47 }), tr('Hiker', { n: 4, lvl: 47 }), tr('Ace Trainer', { n: 4, lvl: 48 })], items: [{ item: 'frost_shard' }, { item: 'max_revive', hidden: true }, { item: 'thaw_spray', qty: 2 }] });
  link('starfall', 'w', 'route12', 'e');
  T('frostholm', 'Frostholm Village', {
    w: 30, h: 26, theme: 'snow', env: 'snow', music: 'snow', mapXY: [22, 4], subtitle: 'A village of eternal winter', fly: true,
    buildings: STD('t4', [
      { kind: 'gym', id: 'gym_frost', puzzle: 'ice', emblem: 'Ice', gym: { leader: 'frost', trainers: [['Skier', ['Ice'], 4, 44], ['Skier', ['Ice', 'Aqua'], 4, 45], ['Ace Trainer', ['Ice'], 5, 46]] } },
      { kind: 'igloo', id: 'fh_igloo1', npcs: [{ at: [2, 1], kind: 'old', script: 'q:glacielle_snow' }] },
      { kind: 'igloo', id: 'fh_igloo2', npcs: [{ at: [3, 1], kind: 'kid', talk: ['Grandpa says a great ice bird lives on the peak north of the village.', 'It only shows itself to Champions!'] }] },
      house([{ at: [2, 2], kind: 'old', script: 'q:yeti_sighting' }], { id: 'fh_h1' }),
    ]),
    npcs: [npc(['Brr! Ice creatures get stronger in winter. And there are more of them!'], { move: 'wander' }), { at: 'exit:w', kind: 'hiker', script: 'gate_badge', gate: 7, cond: '!badge_frost', talk: ['The marsh beyond is deadly. Leader Frost decides who may go.'] }, { kind: 'kid', at: [5, 5], script: 'wispette_girl', cond: 'champion&time=night&!caught_wispette', name: 'Pale Girl', app: { skin: '#e8f0ff', hair: '#ffffff', hairStyle: 'long', top: '#c0d0ff', bottom: '#a0b0e0', dress: true } }],
    items: [{ item: 'ice_sigil', hidden: true }],
  });
  link('route12', 'w', 'frostholm', 'e');
  R('frostholm_peak', 'Frostholm Peak', { w: 24, h: 30, theme: 'snow', env: 'snow', music: 'legend', mapXY: [22, 1], wall: '#', wild: { habitats: ['snow'], lvl: [50, 54] }, weather: 'blizzard', subtitle: 'The frozen spire',
    npcs: [{ legend: 'glaciwing', lvl: 55, at: [12, 5], cond: 'champion&!caught_glaciwing', script: 'legend_generic' }], items: [{ item: 'glacielle_stone', hidden: true }, { item: 'avalanchor_stone', cond: 'champion' }] });
  link('frostholm', 'n', 'frostholm_peak', 's', { a: { gate: 'climb', gateText: 'An icy cliff blocks the way up. Climbing Claws could help.' } });
  R('route13', 'Route 13', { w: 44, h: 24, theme: 'marsh', env: 'marsh', music: 'marsh', mapXY: [17, 5], wild: { habitats: ['marsh', 'snow'], lvl: [47, 50], water: ['lake'] }, water: 3, subtitle: 'Thawing Fens',
    npcs: [tr('Hex Maniac', { n: 4, lvl: 49 }), tr('Fisher', { n: 4, lvl: 48 }), tr('Ace Trainer', { n: 4, lvl: 50 })], items: [{ item: 'venomander_stone', hidden: true, cond: 'champion' }, { item: 'full_restore' }, { item: 'night_capsule', qty: 2 }] });
  link('frostholm', 'w', 'route13', 'e');
  F('shadowfen', 'Shadowfen Marsh', { w: 48, h: 40, theme: 'marsh', env: 'marsh', music: 'marsh', mapXY: [13, 6], wild: { habitats: ['marsh'], lvl: [49, 53], water: ['lake'] }, water: 6, trees: 1.0, dark: true, subtitle: 'Where light goes to drown',
    npcs: [tr('Hex Maniac', { n: 4, lvl: 51 }), tr('Ranger', { n: 4, lvl: 51 }), tr('Ace Trainer', { n: 4, lvl: 52 }), { id: 'rival5', at: 'path', kind: 'ace', name: 'Kael', script: 'rival_5', cond: 'badge_frost&!rival5_done' }, { kind: 'grunt', at: 'path', trainer: { cls: 'Grunt', name: 'Grunt', types: ['Shadow', 'Venom'], n: 4, lvl: 51, pre: 'The Director\'s plan is almost complete!' }, sight: 4, cond: '!capital_done' }],
    items: [{ item: 'mirelord_stone', hidden: true }, { item: 'full_restore' }, { item: 'dusk_shard' }, { item: 'max_revive', hidden: true }] });
  link('route13', 'w', 'shadowfen', 'e');
  R('route14', 'Route 14', { w: 26, h: 40, theme: 'meadow', mapXY: [11, 9], wild: { habitats: ['meadow', 'city', 'forest'], lvl: [50, 54] }, subtitle: 'The Royal Road',
    npcs: [tr('Veteran', { n: 4, lvl: 53 }), tr('Ace Trainer', { n: 5, lvl: 53 }), tr('Socialite', { n: 4, lvl: 52 })], items: [{ item: 'full_restore' }, { item: 'ultra_capsule', qty: 3 }] });
  link('shadowfen', 's', 'route14', 'n');
  // ------------------------------------------------------------------ AETHER CAPITAL
  T('aether_capital', 'Aether Capital', {
    w: 44, h: 36, theme: 'city', env: 'city', music: 'city', mapXY: [10, 13], road: '=', city: true, subtitle: 'The heart of Aetheria', fly: true, flowers: 10, pond: true,
    buildings: STD('t4', [
      { kind: 'gym', id: 'gym_darius', puzzle: 'dark', emblem: 'Shadow', gym: { leader: 'darius', trainers: [['Hex Maniac', ['Shadow', 'Spirit'], 5, 50], ['Ace Trainer', ['Shadow'], 5, 51], ['Veteran', ['Shadow', 'Venom'], 5, 51]] } },
      { kind: 'tower', id: 'aether_tower', label: 'AETHER', name: 'Aether Foundation Tower', npcs: [{ id: 'sable', name: 'Commander Sable', kind: 'commander', at: [6, 4], script: 'capital_sable', cond: 'badge_frost&!capital_done', app: { skin: '#c08860', hair: '#f08020', hairStyle: 'spiky', top: '#402858', bottom: '#201828', emblem: true, hat: '#f08020' } }, { kind: 'grunt', at: [2, 4], trainer: { cls: 'Grunt', name: 'Grunt', types: ['Shadow', 'Metal'], n: 4, lvl: 52, pre: 'The Foundation belongs to the Syndicate now!' }, sight: 3, cond: 'badge_frost&!capital_done' }, { kind: 'grunt', at: [10, 4], trainer: { cls: 'Grunt', name: 'Grunt', types: ['Flame', 'Venom'], n: 4, lvl: 52 }, sight: 3, cond: 'badge_frost&!capital_done' }, { kind: 'researcher', at: [5, 2], talk: ['Welcome to the Aether Foundation. Director Valen funds research all across Aetheria.'], cond: '!badge_frost' }, { kind: 'researcher', at: [5, 2], talk: ['The Director... was the Syndicate\'s leader all along. We never knew.'], cond: 'capital_done' }] },
      { kind: 'museum', id: 'cap_museum', label: 'MUSEUM', npcs: [{ at: [2, 2], kind: 'researcher', script: 'q:museum_relics' }, { at: [9, 3], kind: 'old', talk: ['The Aetherians split the Aether Heart into three — Dawn, Dusk and Core.', 'Dawn and Dusk took the forms of great dragons. The Core... nobody knows.'] }] },
      house([{ at: [3, 2], kind: 'kid', script: 'q:nyxeline_cat' }], { id: 'cap_h1' }),
      { kind: 'shop', id: 'cap_dept', label: 'DEPT', shop: 'held' },
      { kind: 'shop', id: 'cap_sigil', label: 'SIGILS', shop: 'sigil' },
      house([{ at: [2, 2], kind: 'old', script: 'name_rater' }], { id: 'cap_h2' }),
      house([{ at: [3, 2], kind: 'researcher', script: 'ability_swap' }], { id: 'cap_h3' }),
    ]),
    npcs: [{ at: 'door:gym_darius', kind: 'ace', script: 'gate_flag', flag: 'capital_done', cond: '!capital_done', talk: ['Darius locked his gym. He says the Syndicate is in the Aether Tower!'] }, npc(['The Capital has the biggest department store in Aetheria!'], { move: 'wander' }), npc(['North of the city is the path to Celestial Summit. It\'s been sealed for centuries.'], { kind: 'old' }), { at: 'exit:e', kind: 'ace', script: 'gate_badge', gate: 8, cond: '!summit_done', talk: ['Champion\'s Path lies ahead. Only those who have calmed the Summit may pass.'] }],
    items: [{ item: 'nyxeline_stone', hidden: true, cond: 'q_done:nyxeline_cat' }, { item: 'rare_candy', hidden: true }],
  });
  link('route14', 's', 'aether_capital', 'n');
  R('celestial_path', 'Celestial Path', { w: 26, h: 44, theme: 'sky', env: 'sky', music: 'sky', mapXY: [7, 9], wall: '#', wild: { habitats: ['sky', 'mountain'], lvl: [52, 56] }, subtitle: 'Stairway to the heavens', ledges: 2,
    npcs: [tr('Veteran', { n: 5, lvl: 55 }), tr('Dragon Tamer', { n: 5, lvl: 55 }), tr('Psychic', { n: 5, lvl: 55 })], items: [{ item: 'full_restore', qty: 2 }, { item: 'max_revive' }] });
  link('aether_capital', 'w', 'celestial_path', 's', { a: { gate: 'flag:badge_darius', gateText: 'An ancient barrier seals the way to Celestial Summit. Perhaps after the eighth badge...' } });
  R('celestial_summit', 'Celestial Summit', { w: 26, h: 22, theme: 'sky', env: 'legend', music: 'legend', mapXY: [5, 5], wall: '#', grass: 0.1, trees: 0.1, flowers: 4, weather: 'motes', subtitle: 'Where Dawn and Dusk were born',
    npcs: [{ id: 'valen', name: 'Director Valen', kind: 'commander', at: [13, 8], script: 'summit_valen', cond: '!summit_done', app: { skin: '#e8c8a8', hair: '#d0d0d8', hairStyle: 'short', top: '#202030', bottom: '#202030', coat: true, emblem: true, hat: '#a060e0' } },
      { legend: 'solarion', lvl: 60, at: [13, 4], cond: 'summit_done&!caught_solarion&!(time=night)', script: 'legend_generic', postSummit: true }, { legend: 'noctyrr', lvl: 60, at: [13, 4], cond: 'summit_done&!caught_noctyrr&time=night', script: 'legend_generic', postSummit: true },
      { at: [6, 10], kind: 'old', name: 'Summit Echo', script: 'star_shard_summit', cond: 'caught_solarion&caught_noctyrr&!shard_summit' }],
    items: [{ item: 'solarion_stone', cond: 'caught_solarion&champion' }, { item: 'noctyrr_stone', cond: 'caught_noctyrr&champion' }] });
  link('celestial_path', 'n', 'celestial_summit', 's');
  C('champions_path', "Champion's Path", { w: 44, h: 36, mapXY: [14, 15], wild: { habitats: ['cave', 'mountain', 'caldera'], lvl: [54, 58] }, boulders: 8, water: 2, subtitle: 'The final trial before the League',
    npcs: [tr('Veteran', { n: 5, lvl: 57, at: 'random' }), tr('Ace Trainer', { n: 5, lvl: 57, at: 'random' }), tr('Dragon Tamer', { n: 5, lvl: 57, at: 'random' }), tr('Black Belt', { n: 5, lvl: 56, at: 'random' }), { id: 'rival6', at: 'random', kind: 'ace', name: 'Kael', script: 'rival_6', cond: '!rival6_done' }],
    items: [{ item: 'wyvernox_stone', hidden: true }, { item: 'full_restore', qty: 2 }, { item: 'max_revive' }, { item: 'ultra_capsule', qty: 3 }, { item: 'rare_candy', hidden: true }] });
  link('aether_capital', 'e', 'champions_path', 'w');
  T('champions_island', "Champion's Island", {
    w: 48, h: 36, theme: 'city', env: 'champion', music: 'title', mapXY: [17, 14], road: '=', city: true, subtitle: 'Home of the Elite Championship', fly: true,
    buildings: [{ kind: 'center' }, { kind: 'shop', shop: 't4' }, { kind: 'league', id: 'league_hall', label: 'LEAGUE', npcs: [{ at: [4, 2], kind: 'ace', script: 'league_gate' }] },
      { kind: 'facility', id: 'frontier_tower', label: 'TOWER', name: 'Battle Tower', npcs: [{ at: [3, 1], kind: 'clerk', script: 'facility:tower' }, { at: [8, 1], kind: 'clerk', script: 'facility:shop' }] },
      { kind: 'facility', id: 'frontier_arena', label: 'ARENA', name: 'Elemental Arena', npcs: [{ at: [3, 1], kind: 'clerk', script: 'facility:arena' }] },
      { kind: 'facility', id: 'frontier_gauntlet', label: 'GAUNTLET', name: 'Survival Gauntlet', npcs: [{ at: [3, 1], kind: 'clerk', script: 'facility:gauntlet' }] },
      { kind: 'facility', id: 'frontier_challenge', label: 'CHAMPS', name: "Champion's Challenge", npcs: [{ at: [3, 1], kind: 'clerk', script: 'facility:challenge' }] },
      { kind: 'temple', id: 'frontier_trial', label: 'TRIAL', name: 'Legendary Trial', npcs: [{ at: [6, 1], kind: 'old', script: 'facility:trial' }] }],
    npcs: [npc(['The Battle Frontier opens to Champions only. Win and earn Battle Points!'], { move: 'wander' }), npc(['Elite Thorne loves poison. Bring something that can stand it.']), { at: 'door:frontier_tower', kind: 'ace', script: 'gate_flag', flag: 'champion', cond: '!champion', talk: ['The Battle Frontier is reserved for the Champion.'] }],
    items: [{ item: 'full_restore', hidden: true }],
  });
  link('champions_path', 'e', 'champions_island', 'w');

  // ------------------------------------------------------------------ NPC schedules: every town gets
  // townsfolk who only appear at certain times of day, so places feel lived-in.
  const NIGHT = [['Night Owl', 'Shadow and Spirit creatures come out after dark. Have you been to the routes at night?'], ['Stargazer', 'On nights with meteor showers, rare creatures appear near Starfall.'], ['Insomniac', 'Can\'t sleep... the creatures are so noisy at night!'], ['Night Guard', 'I patrol the town every night. Stay safe out there.']];
  const DAY = [['Jogger', 'Morning jogs with my creature keep us both fit!'], ['Gardener', 'Flowers bloom brightest in spring. Nature creatures love it.'], ['Vendor', 'Fresh berries! ...Oh, I\'m all sold out today.'], ['Schoolkid', 'At school we learned that Flame beats Ice and Metal!']];
  const MORN = [['Early Bird', 'In the morning, some creatures evolve differently than at night!']];
  let k = 0;
  for (const id of Object.keys(MB.WORLD_SPECS)) {
    const sp = MB.WORLD_SPECS[id];
    if (sp.type !== 'town') continue;
    const n = NIGHT[k % NIGHT.length], d = DAY[k % DAY.length];
    sp.npcs.push({ name: n[0], talk: [n[1]], cond: 'time=night', move: 'wander', kind: 'old' });
    sp.npcs.push({ name: d[0], talk: [d[1]], cond: '!(time=night)', move: 'wander', kind: 'kid' });
    if (k % 3 === 0) sp.npcs.push({ name: MORN[0][0], talk: [MORN[0][1]], cond: 'time=morning', move: 'wander' });
    k++;
  }
  // ------------------------------------------------------------------ triggers
  MB.WORLD_SPECS.route1.triggers.push({ exit: 'n', script: 'r1_hint', once: true });
})();
