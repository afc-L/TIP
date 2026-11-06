'use strict';
// =====================================================================================
// VELORIA — the second region, unlocked after becoming Champion. Unique mechanic: Aether
// rifts. With the Rift Lens (press R) you shift between the Bright and Gloam phases, which
// swaps which crystal tiles (R / r) are solid.
// =====================================================================================
(function () {
  const { T, R, F, C, link, portal, tr, npc, STD, house } = MB.WorldDSL;
  MB.WorldDSL.region('V');
  const W = MB.WORLD_SPECS;
  T('halcyon', 'Halcyon Harbor', {
    w: 34, h: 28, theme: 'beach', env: 'beach', music: 'sea:v', mapXY: [6, 26], road: '=', city: true, subtitle: 'First port of Veloria', fly: true,
    buildings: STD('t4', [{ kind: 'port', id: 'hh_port', label: 'PORT', npcs: [{ at: [2, 0], kind: 'sailor', script: 'ship_aetheria' }] }, house([{ at: [3, 2], kind: 'researcher', script: 'veloria_prof' }], { id: 'hh_lab', name: 'Rift Research Station' }), house([{ at: [2, 2], kind: 'old', script: 'q:v_lost_ring' }], { id: 'hh_h1' })]),
    npcs: [npc(['Welcome to Veloria! The creatures here are unlike anything in Aetheria.'], { kind: 'sailor', move: 'wander' }), npc(['Strange crystal walls appear and vanish across Veloria. The researchers call them rifts.']), { at: 'exit:n', kind: 'researcher', script: 'gate_flag', flag: 'got_rift_lens', cond: '!got_rift_lens', talk: ['Please visit the Rift Research Station before heading out! You\'ll need a Rift Lens.'] }],
    items: [{ item: 'ultra_capsule', qty: 2 }],
  });
  R('v_route1', 'Velorian Way', { w: 26, h: 44, theme: 'meadow', mapXY: [6, 21], wild: { habitats: ['v_field'], lvl: [58, 62] }, subtitle: 'Fields of shimmering grass',
    npcs: [tr('Rift Seeker', { n: 4, lvl: 60 }), tr('Picnicker', { n: 4, lvl: 60 }), tr('Ace Trainer', { n: 4, lvl: 61 }), tr('Ranger', { n: 4, lvl: 60 })], items: [{ item: 'full_restore' }, { item: 'rift_crystal', hidden: true }] });
  link('halcyon', 'n', 'v_route1', 's');
  T('brightmoor', 'Brightmoor Town', {
    w: 30, h: 26, theme: 'meadow', music: 'village:v', mapXY: [6, 16], subtitle: 'Town of lanterns', fly: true,
    buildings: STD('t4', [{ kind: 'gym', id: 'ward_bram', puzzle: 'hedge', emblem: 'Nature', name: 'Brightmoor Ward', gym: { leader: 'w_bram', trainers: [['Ranger', ['Nature', 'Light'], 4, 60], ['Picnicker', ['Nature'], 4, 61], ['Ace Trainer', ['Nature'], 5, 61]] } }, house([{ at: [3, 2], kind: 'kid', script: 'q:v_lantern' }], { id: 'bm_h1' }), house([{ at: [2, 2], kind: 'old', script: 'q:v_paladrix' }], { id: 'bm_h2' })]),
    npcs: [npc(['Every night we light lanterns to keep the Gloamwood\'s darkness away.'], { move: 'wander' })],
  });
  link('v_route1', 'n', 'brightmoor', 's');
  F('gloamwood', 'Gloamwood', { w: 46, h: 40, theme: 'rift', env: 'forest', music: 'forest:v', mapXY: [11, 15], wild: { habitats: ['v_wood', 'v_rift'], lvl: [61, 65] }, trees: 1.6, rift: 18, subtitle: 'A forest phased between worlds',
    npcs: [tr('Rift Seeker', { n: 5, lvl: 63 }), tr('Hex Maniac', { n: 5, lvl: 63 }), tr('Ranger', { n: 5, lvl: 63 }), { legend: 'gloomaw', lvl: 70, at: 'random', cond: 'v_badge3&!caught_gloomaw&time=night', script: 'legend_generic' }, { at: 'random', kind: 'old', name: 'Rift Hermit', script: 'star_shard_gloam', cond: '!shard_gloam' }],
    items: [{ item: 'wraithstag_stone', hidden: true }, { item: 'rift_crystal', qty: 2 }, { item: 'dusk_shard' }, { item: 'max_revive', hidden: true }] });
  link('brightmoor', 'e', 'gloamwood', 'w');
  R('v_route2', 'Riftwater Shore', { w: 44, h: 24, theme: 'beach', env: 'beach', music: 'sea:v', mapXY: [16, 15], wild: { habitats: ['v_beach', 'v_lake'], lvl: [62, 66], water: ['v_lake', 'v_beach'] }, water: 4, path: 's', rift: 8,
    npcs: [tr('Swimmer', { n: 5, lvl: 64 }), tr('Fisher', { n: 5, lvl: 64 }), tr('Sailor', { n: 5, lvl: 64 })], items: [{ item: 'big_pearl', hidden: true }, { item: 'full_restore' }] });
  link('gloamwood', 'e', 'v_route2', 'w');
  T('tidecrest', 'Tidecrest Town', {
    w: 32, h: 28, theme: 'beach', env: 'beach', music: 'sea:v2', mapXY: [21, 15], road: 's', subtitle: 'Town of the shipwrecks', fly: true, pond: true,
    buildings: STD('t4', [{ kind: 'gym', id: 'ward_orla', puzzle: 'slide', emblem: 'Aqua', name: 'Tidecrest Ward', gym: { leader: 'w_orla', trainers: [['Sailor', ['Aqua'], 5, 63], ['Swimmer', ['Aqua'], 5, 63], ['Ace Trainer', ['Aqua', 'Spirit'], 5, 64]] } }, house([{ at: [2, 2], kind: 'sailor', script: 'q:v_wreck' }], { id: 'tc_h1' })]),
    npcs: [npc(['A ghost ship haunts the shore on foggy nights. Captain Orla isn\'t scared of it, though!'], { kind: 'sailor', move: 'wander' })],
    items: [{ item: 'ghostanchor_stone', hidden: true, cond: 'q_done:v_wreck' }],
  });
  link('v_route2', 'e', 'tidecrest', 'w');
  R('riftwater', 'Riftwater Lake', { w: 44, h: 34, theme: 'rift', env: 'water', music: 'rift', mapXY: [21, 10], wild: { habitats: ['v_lake', 'v_rift'], lvl: [64, 67], water: ['v_lake', 'v_rift'] }, water: 10, river: true, surfRiver: false, rift: 10, subtitle: 'A lake that reflects other skies',
    npcs: [tr('Rift Seeker', { n: 5, lvl: 66 }), tr('Swimmer', { n: 5, lvl: 66 })], items: [{ item: 'rift_crystal', qty: 2 }, { item: 'riftseraph_stone', hidden: true, cond: 'v_badge4' }] });
  link('tidecrest', 'n', 'riftwater', 's');
  T('quartzvale', 'Quartzvale City', {
    w: 36, h: 30, theme: 'rift', env: 'city', music: 'city:v', mapXY: [27, 10], road: '=', city: true, subtitle: 'The crystal city', fly: true,
    buildings: STD('t4', [{ kind: 'gym', id: 'ward_quill', puzzle: 'boulder', emblem: 'Earth', name: 'Quartzvale Ward', gym: { leader: 'w_quill', trainers: [['Hiker', ['Earth'], 5, 65], ['Researcher', ['Earth', 'Light'], 5, 65], ['Ace Trainer', ['Earth', 'Psychic'], 5, 66]] } }, { kind: 'museum', id: 'qv_museum', npcs: [{ at: [3, 2], kind: 'researcher', script: 'q:v_crystal_research' }] }, { kind: 'shop', id: 'qv_evo', label: 'STONES', shop: 'evo' }]),
    npcs: [npc(['The Quartz Caverns under the city glow day and night.'], { move: 'wander' })],
  });
  link('riftwater', 'e', 'quartzvale', 'w');
  C('quartz_caverns', 'Quartz Caverns', { w: 40, h: 34, theme: 'rift', env: 'cave', music: 'cave:v', mapXY: [28, 13], wild: { habitats: ['v_cave'], lvl: [66, 69] }, boulders: 6, subtitle: 'Glittering depths',
    npcs: [tr('Hiker', { n: 5, lvl: 67, at: 'random' }), tr('Rift Seeker', { n: 5, lvl: 67, at: 'random' }), tr('Dragon Tamer', { n: 5, lvl: 68, at: 'random' })], items: [{ item: 'crystalwyrm_stone', hidden: true }, { item: 'rift_crystal', qty: 3 }, { item: 'max_revive' }] });
  portal('quartzvale', 'quartz_caverns');
  R('tempest_cliffs', 'Tempest Cliffs', { w: 26, h: 46, theme: 'sky', env: 'sky', music: 'sky:v', mapXY: [32, 6], wall: '#', wild: { habitats: ['v_cliff'], lvl: [67, 70] }, ledges: 4, gates: [{ kind: 'climb', item: 'thundertiger_stone' }], stormy: true, subtitle: 'Where storms are born',
    npcs: [tr('Ace Trainer', { n: 5, lvl: 69 }), tr('Ranger', { n: 5, lvl: 69 }), { legend: 'zephyra', lvl: 72, at: 'random', cond: 'v_badge4&!caught_zephyra', script: 'legend_generic' }], items: [{ item: 'full_restore', qty: 2 }] });
  link('quartzvale', 'n', 'tempest_cliffs', 's');
  T('duskhaven', 'Duskhaven', {
    w: 32, h: 28, theme: 'sky', env: 'sky', music: 'town:v', mapXY: [32, 2], road: '=', subtitle: 'The city where the sun never fully sets', fly: true,
    buildings: STD('t4', [{ kind: 'gym', id: 'ward_zara', puzzle: 'teleport', emblem: 'Wind', name: 'Duskhaven Ward', gym: { leader: 'w_tempest', trainers: [['Ace Trainer', ['Wind'], 5, 68], ['Psychic', ['Wind', 'Psychic'], 5, 68], ['Ranger', ['Wind'], 5, 69]] } }, house([{ at: [2, 2], kind: 'old', script: 'q:v_sundial' }], { id: 'dh_h1' })]),
    npcs: [npc(['West lie the Mirage Dunes. The sands play tricks on travelers.'], { move: 'wander' })],
  });
  link('tempest_cliffs', 'n', 'duskhaven', 's');
  R('mirage_dunes', 'Mirage Dunes', { w: 46, h: 30, theme: 'desert', env: 'desert', music: 'desert:v', mapXY: [24, 3], wild: { habitats: ['v_dunes'], lvl: [68, 71] }, rift: 10, subtitle: 'Shifting sands and shimmering rifts',
    npcs: [tr('Ruin Maniac', { n: 5, lvl: 70 }), tr('Rift Seeker', { n: 5, lvl: 70 }), { at: 'random', kind: 'old', name: 'Sand Seer', script: 'star_shard_dunes', cond: '!shard_dunes' }], items: [{ item: 'miragenix_stone', hidden: true }, { item: 'relic_vase', hidden: true }] });
  link('duskhaven', 'w', 'mirage_dunes', 'e');
  R('auroral_tundra', 'Auroral Tundra', { w: 46, h: 30, theme: 'snow', env: 'snow', music: 'snow:v', mapXY: [15, 3], wild: { habitats: ['v_tundra'], lvl: [70, 73] }, subtitle: 'Beneath the endless aurora',
    npcs: [tr('Skier', { n: 5, lvl: 72 }), tr('Veteran', { n: 5, lvl: 72 }), { legend: 'auroryx', lvl: 74, at: 'random', cond: 'v_badge5&!caught_auroryx&time=night', script: 'legend_generic' }, { at: 'random', kind: 'old', name: 'Aurora Watcher', script: 'star_shard_tundra', cond: '!shard_tundra' }],
    items: [{ item: 'glaciotusk_stone', hidden: true }, { item: 'frost_shard' }] });
  link('mirage_dunes', 'w', 'auroral_tundra', 'e');
  T('frostgate', 'Frostgate Outpost', { w: 28, h: 24, theme: 'snow', env: 'snow', music: 'snow:v2', mapXY: [9, 4], subtitle: 'Last outpost before the north', fly: true,
    buildings: STD('t4', [{ kind: 'gym', id: 'ward_ysolde', puzzle: 'ice', emblem: 'Ice', name: 'Frostgate Ward', gym: { leader: 'w_ysolde', trainers: [['Skier', ['Ice'], 5, 70], ['Ace Trainer', ['Ice', 'Light'], 5, 71], ['Veteran', ['Ice'], 5, 71]] } }]),
    npcs: [npc(['The Obsidian Citadel lies south. Even the snow melts near it.'])] });
  link('auroral_tundra', 'w', 'frostgate', 'e');
  C('obsidian_1', 'Obsidian Citadel', { w: 40, h: 34, theme: 'obsidian', env: 'volcano', music: 'volcano:v', mapXY: [9, 9], lava: 8, wild: { habitats: ['v_volcano'], lvl: [72, 75] }, subtitle: 'A fortress of black glass',
    npcs: [tr('Kindler', { n: 5, lvl: 73, at: 'random' }), tr('Veteran', { n: 5, lvl: 74, at: 'random' }), { kind: 'grunt', at: 'random', trainer: { cls: 'Grunt', name: 'Neo Grunt', types: ['Flame', 'Shadow'], n: 5, lvl: 73, pre: 'Neo Eclipse will rise from these ashes!' }, sight: 4, cond: '!neo_done' }],
    items: [{ item: 'blazesteed_stone', hidden: true }, { item: 'obsidian_chip', qty: 3 }, { item: 'full_restore' }] });
  link('frostgate', 's', 'obsidian_1', 'n');
  C('obsidian_2', 'Citadel Depths', { w: 34, h: 28, theme: 'obsidian', env: 'volcano', music: 'legend', mapXY: [8, 11], lava: 6, wild: { habitats: ['v_volcano'], lvl: [74, 77] },
    npcs: [{ legend: 'magmaul', lvl: 75, at: 'random', cond: 'v_badge6&!caught_magmaul', script: 'legend_generic' }], items: [{ item: 'forgehulk_stone', hidden: true }, { item: 'max_revive' }] });
  portal('obsidian_1', 'obsidian_2');
  R('verdigris', 'Verdigris Ruins', { w: 40, h: 34, theme: 'ruins', env: 'ruins', music: 'ruins:v', mapXY: [14, 10], wall: '#', wild: { habitats: ['v_ruins'], lvl: [72, 75] }, rift: 12, subtitle: 'Copper towers of a vanished age',
    npcs: [tr('Ruin Maniac', { n: 5, lvl: 74 }), tr('Engineer', { n: 5, lvl: 74 }), { legend: 'verdigon', lvl: 75, at: 'random', cond: 'v_badge6&!caught_verdigon', script: 'legend_generic' }, { at: 'random', kind: 'old', name: 'Copper Sentinel', script: 'star_shard_verdigris', cond: '!shard_verdigris' }],
    items: [{ item: 'ancient_capsule', qty: 2 }, { item: 'relic_crown', hidden: true }] });
  link('obsidian_1', 'e', 'verdigris', 'w');
  T('zenith', 'Zenith City', {
    w: 44, h: 36, theme: 'city', env: 'city', music: 'city:v2', mapXY: [17, 18], road: '=', city: true, subtitle: 'Crown city of Veloria', fly: true,
    buildings: STD('t4', [{ kind: 'gym', id: 'ward_ignatius', puzzle: 'lava', emblem: 'Flame', name: 'Zenith Forge Ward', gym: { leader: 'w_ignatius', trainers: [['Kindler', ['Flame'], 5, 73], ['Engineer', ['Flame', 'Metal'], 5, 74], ['Ace Trainer', ['Flame'], 6, 74]] } }, { kind: 'league', id: 'v_league', label: 'LEAGUE', name: 'Veloria League', npcs: [{ at: [4, 2], kind: 'ace', script: 'v_league_gate' }] }, { kind: 'shop', id: 'zn_held', label: 'GEAR', shop: 'held' }, house([{ at: [2, 2], kind: 'researcher', script: 'q:v_zenith_research' }], { id: 'zn_h1' })]),
    npcs: [npc(['The Sovereign of Veloria has never lost a battle.'], { move: 'wander' }), { id: 'neo_sable', name: 'Sable', kind: 'commander', at: 'path', script: 'neo_sable', cond: 'v_badge5&!neo_done', app: { skin: '#c08860', hair: '#f08020', hairStyle: 'spiky', top: '#402858', bottom: '#201828', emblem: true, hat: '#f08020' } }],
  });
  link('verdigris', 'e', 'zenith', 'w');
  link('zenith', 's', 'v_route2', 'n');
  C('rift_core', 'Rift Core', { w: 34, h: 30, theme: 'rift', env: 'legend', music: 'legend:v', mapXY: [22, 22], open: 0.6, subtitle: 'The wound between worlds', weather: 'motes',
    npcs: [{ legend: 'riftwyrm', lvl: 80, at: 'random', cond: 'neo_done&!caught_riftwyrm', script: 'legend_generic' }, { at: 'random', kind: 'old', name: 'Star Altar', script: 'omnirift_altar', cond: '!caught_omnirift' }],
    items: [{ item: 'riftwyrm_stone', cond: 'caught_riftwyrm' }, { item: 'master_capsule', hidden: true }] });
  portal('zenith', 'rift_core', { cond: 'neo_done', locked: 'A swirling rift. It is too unstable to enter... for now.' });

  // Rival encounters in Veloria
  W.quartzvale.npcs.push({ id: 'rival_v1', name: 'Kael', kind: 'ace', at: 'exit:n', script: 'rival_v1', cond: 'v_badge2&!rival_v1_done' });
  W.zenith.npcs.push({ id: 'rival_v2', name: 'Kael', kind: 'ace', at: 'door:v_league', script: 'rival_v2', cond: 'v_badge6&!rival_v2_done' });
  // rift crystal placement flag for generator
  for (const id of ['gloamwood', 'v_route2', 'riftwater', 'mirage_dunes', 'verdigris']) W[id].riftTiles = W[id].rift;
})();
