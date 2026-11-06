'use strict';
// =====================================================================================
// SIDE QUESTS — data + engine. Types:
//  show:{sp}  showType:{type,lvl}  catchN:{type|sp,n}  item:{id,qty}  deliver:{item,target:{map,name}}
//  trainers:{map,n}  boss:{key}  visit:{map}  dex:{n}  stages:[...]  (multi-stage)
// reward: {items:[[id,qty]], money, mon:[sp,lvl], flag}
// =====================================================================================
MB.QUESTS = [];
(function () {
  const Q = (id, name, o) => MB.QUESTS.push(Object.assign({ id, name }, o));
  // ---------- quests whose givers are placed in the world specs ----------
  Q('verdant_garden', 'The Wilting Garden', { giver: 'Gardener Rosa', type: 'catchN', p: { type: 'Nature', n: 3 }, reward: { items: [['sun_shard', 1], ['honey_bun', 3]] }, intro: 'My garden is wilting! Nature creatures help plants grow. Could you catch three Nature-type creatures to prove they still thrive around here?', done: 'Wonderful! The garden spirits will be pleased. A strange glowing stone appeared in the Moonveil Grove — maybe it\'s meant for you.' });
  Q('verdant_lost_twigeet', 'Where\'s Pip?', { giver: 'Little Tom', type: 'show', p: { sp: 'twigeet' }, reward: { items: [['great_capsule', 5]] }, intro: 'My Twigeet Pip flew away! Can you show me a Twigeet so I know it\'s okay?', done: 'That\'s... not Pip. But it looks happy! Thanks for showing me.' });
  Q('crystal_dam', 'Power Surge', { giver: 'Dam Engineer', type: 'catchN', p: { type: 'Electric', n: 4 }, reward: { items: [['volt_shard', 1], ['thundermane_stone', 1]] }, intro: 'The dam\'s turbines need Electric creatures to jump-start them. Catch four Electric-types and I\'ll reward you with something special Voltan found inside the dam.', done: 'The turbines are spinning! Here — Voltan found this stone humming inside Turbine 3.' });
  Q('fishing_master', 'The One That Got Away', { giver: 'Old Fisher Hal', type: 'catchN', p: { type: 'Aqua', n: 5 }, reward: { items: [['aqua_capsule', 10], ['big_pearl', 1]] }, intro: 'Fifty years I\'ve fished this lake. Catch five Aqua-types and prove you\'ve got the knack!', done: 'You\'ve got the touch! Take my lucky capsules.' });
  Q('sunspire_relic', 'Buried Treasure', { giver: 'Curator Imani', type: 'item', p: { id: 'ancient_coin', qty: 2 }, reward: { items: [['ancient_capsule', 3]], money: 5000 }, intro: 'Ancient Coins are scattered through the desert and the Hollow. Bring me two for the museum!', done: 'Marvelous! These complete our exhibit.' });
  Q('sunmane_trial', 'Trial of the Sun', { giver: 'Sun Priest', type: 'stages', stages: [{ type: 'showType', p: { type: 'Flame', lvl: 30 }, text: 'First, show me a Flame creature of at least level 30.' }, { type: 'showType', p: { type: 'Light', lvl: 30 }, text: 'Now show me a Light creature of at least level 30.' }], reward: { items: [['sunmane_stone', 1]] }, intro: 'The sun lion\'s stone is given only to those who carry both fire and light.', done: 'The sun shines on you. Take the Sunmane Stone.' });
  Q('ptercient_fossil', 'Wings of Amber', { giver: 'Paleontologist', type: 'show', p: { sp: 'ptercient' }, reward: { items: [['ptercient_stone', 1]] }, intro: 'If you ever revive the Amber Wing and evolve it into Ptercient, show me! I\'ve got something that reacts to it.', done: 'Incredible! It\'s alive and grown! The Ptercient Stone is yours.' });
  Q('excalith_sword', 'The Sword in the Stone', { giver: 'Old Knight', type: 'stages', stages: [{ type: 'trainers', p: { map: 'route6', n: 5 }, text: 'Defeat five trainers on Route 6 to prove your strength.' }, { type: 'show', p: { sp: 'phantblade' }, text: 'Now show me a Phantblade — the haunted blade of the ruins.' }], reward: { items: [['excalith_stone', 1], ['dusk_shard', 1]] }, intro: 'A legendary blade lies in these ruins. Prove yourself worthy, young one.', done: 'The blade answers. Take its stone, and a shard of dusk to awaken it.' });
  Q('megalodent_hunt', 'Terror of the Deep', { giver: 'Captain Bart', type: 'show', p: { sp: 'megalodent' }, reward: { items: [['megalodent_stone', 1]], money: 8000 }, intro: 'A monster shark sank my boat! Catch a Finbite and raise it into a Megalodent. Show me, and I\'ll know the seas are safe.', done: 'That\'s the beast! ...It\'s actually kind of cute. Take this stone I fished up.' });
  Q('lighthouse_storm', 'Storm Watcher', { giver: 'Lighthouse Keeper', type: 'catchN', p: { type: 'Wind', n: 4 }, reward: { items: [['wind_sigil', 1], ['ultra_capsule', 5]] }, intro: 'During storms, a lightning bird circles the lighthouse. To study it I need data on Wind creatures. Catch four?', done: 'Excellent data! The legendary Voltacrest is said to roam after a Champion is crowned.' });
  Q('krabastion_shell', 'Shell Collector', { giver: 'Beachcomber Grandma', type: 'item', p: { id: 'pearl', qty: 3 }, reward: { items: [['big_pearl', 2]], flag: 'krab_stone_unlocked' }, intro: 'I collect pearls! Bring me three and I\'ll tell you where I saw a glowing stone on the beach.', done: 'Lovely! I saw the glowing stone buried on this very island. Check the sand!' });
  Q('islandon_turtle', 'Island on Its Back', { giver: 'Sailor Gus', type: 'show', p: { sp: 'islandon' }, reward: { items: [['islandon_stone', 1]] }, intro: 'Sailors tell of a turtle so big it has a forest on its shell. Show me an Islandon!', done: 'It\'s real! Here, this stone washed up years ago. It must be for it.' });
  Q('cinder_pup', 'Lost Little Flame', { giver: 'Kid Ash', type: 'show', p: { sp: 'pupwick' }, reward: { items: [['ember_shard', 2]] }, intro: 'My Pupwick ran away into the hills! Can you show me a Pupwick so I can draw it for the "missing" poster?', done: 'Perfect! Thanks! Take these Ember Shards — they evolve Pupwick into Hearthound!' });
  Q('forge_ore', 'Forge Fuel', { giver: 'Smith Gil', type: 'item', p: { id: 'star_dust', qty: 2 }, reward: { items: [['metal_sigil', 1], ['flame_sigil', 1]] }, intro: 'Star Dust makes the hottest forge fires. Bring me two and I\'ll craft you sigils.', done: 'Hot off the anvil! Two sigils for you.' });
  Q('mentalord_mind', 'A Meeting of Minds', { giver: 'Sage Orin', type: 'show', p: { sp: 'mentalord' }, reward: { items: [['mind_tonic', 2]] }, intro: 'I wish to converse with a Mentalord, the greatest mind among creatures. Show me one?', done: 'Fascinating... it says you are kind. Take these.' });
  Q('stormhawk_feather', 'Feather in the Wind', { giver: 'Ornithologist', type: 'catchN', p: { sp: 'galechick', n: 2 }, reward: { flag: 'stormhawk_hint', items: [['swift_tonic', 1]] }, intro: 'I study Galechick migration. Catch two for my research?', done: 'Thank you! I spotted a glowing stone along Route 11 when a Stormhawk flew over. Search the ridge!' });
  Q('celestag_meteor', 'Starlit Antlers', { giver: 'Astronomer', type: 'stages', stages: [{ type: 'show', p: { sp: 'starfawn' }, text: 'First, show me a Starfawn.' }, { type: 'show', p: { sp: 'celestag' }, text: 'Now evolve it and show me a Celestag!' }], reward: { items: [['celestag_stone', 1]] }, intro: 'Starfawn are born where meteors land. I\'d love to see one — and its evolution!', done: 'The stars smile on you. Here is the Celestag Stone.' });
  Q('glacielle_snow', 'Snow Fox Story', { giver: 'Grandpa Sven', type: 'show', p: { sp: 'glacielle' }, reward: { items: [['frost_shard', 2], ['ice_sigil', 1]] }, intro: 'When I was a boy, a snow fox saved me in a blizzard. Show me a Glacielle, so I can thank one?', done: 'Thank you, little one... Take these. A stone that resonates with them sleeps on Frostholm Peak.' });
  Q('yeti_sighting', 'Footprints in the Snow', { giver: 'Yeti Hunter', type: 'show', p: { sp: 'yetling' }, reward: { items: [['avalanchor_stone', 1]] }, intro: 'Everyone laughs at me! Show me a Yetling and prove the Yeti is real!', done: 'I KNEW IT! Here — I found this stone in a giant footprint.' });
  Q('museum_relics', 'Relics of the Ancients', { giver: 'Capital Curator', type: 'stages', stages: [{ type: 'item', p: { id: 'relic_vase', qty: 1 }, text: 'Bring a Relic Vase.' }, { type: 'item', p: { id: 'relic_crown', qty: 1 }, text: 'Now, a Relic Crown — the rarest of all.' }], reward: { items: [['ancient_capsule', 5], ['comet_piece', 2]], money: 30000 }, intro: 'The Capital Museum seeks the lost royal relics of the Aetherians.', done: 'History restored! The museum is in your debt.' });
  Q('nyxeline_cat', 'The Midnight Cat', { giver: 'Girl Luna', type: 'show', p: { sp: 'purrshade' }, reward: { flag: 'nyx_stone_hint', items: [['dusk_shard', 1]] }, intro: 'There\'s a shadow cat that visits my window at night. Show me a Purrshade? I want to know it\'s real!', done: 'It IS real! Its friend left a sparkly stone in the city square... maybe you can find it.' });
  // Veloria
  Q('v_lost_ring', 'The Lost Ring', { giver: 'Old Mariner', type: 'visit', p: { map: 'tidecrest' }, reward: { items: [['big_pearl', 3]], money: 10000 }, intro: 'I lost my wedding ring in Tidecrest years ago. Would you visit and look for any sign of it?', done: 'You went all that way? Even if you didn\'t find it, thank you. Take these.' });
  Q('v_lantern', 'Lantern Lighting', { giver: 'Lamplighter Kid', type: 'catchN', p: { type: 'Light', n: 4 }, reward: { items: [['light_sigil', 1], ['full_restore', 2]] }, intro: 'The lanterns need Light creatures to stay lit! Catch four Light types?', done: 'Brightmoor shines again!' });
  Q('v_paladrix', 'Oath of the Paladin', { giver: 'Retired Knight', type: 'show', p: { sp: 'paladrix' }, reward: { items: [['paladrix_stone', 1]] }, intro: 'Raise a Pageling into a Paladrix and show me. I shall pass on my order\'s stone.', done: 'A true paladin. The stone is yours.' });
  Q('v_wreck', 'The Ghost Ship', { giver: 'First Mate Moe', type: 'show', p: { sp: 'driftwisp' }, reward: { flag: 'ghost_stone_hint', items: [['spirit_sigil', 1]] }, intro: 'The ghost ship\'s spirits are Driftwisps. Show me one and I\'ll tell you a secret.', done: 'The captain\'s stone is buried here in Tidecrest. Search near the water!' });
  Q('v_crystal_research', 'Crystal Resonance', { giver: 'Dr. Prism', type: 'item', p: { id: 'rift_crystal', qty: 3 }, reward: { items: [['ancient_capsule', 3], ['rare_candy', 3]] }, intro: 'Rift Crystals hold echoes of other worlds. Bring me three?', done: 'The resonance is astounding!' });
  Q('v_sundial', 'The Endless Dusk', { giver: 'Timekeeper', type: 'dex', p: { n: 200 }, reward: { items: [['legendary_capsule', 1]] }, intro: 'Catch 200 species and I\'ll give you a capsule forged from pure Aether.', done: 'Two hundred! You are a true researcher.' });
  Q('v_zenith_research', 'The Origin Theory', { giver: 'Dr. Ines\'s Rival', type: 'stages', stages: [{ type: 'visit', p: { map: 'verdigris' }, text: 'Visit the Verdigris Ruins.' }, { type: 'visit', p: { map: 'rift_core' }, text: 'Now the Rift Core itself.' }], reward: { items: [['master_capsule', 1]] }, intro: 'I believe all creatures came from one origin. Help me gather field observations?', done: 'My theory lives! Take this.' });

  // ---------- auto-placed quests (giver NPC is spawned in the given map) ----------
  const A = (id, name, map, o) => Q(id, name, Object.assign({ map }, o));
  A('r1_bug', 'Bug Collection', 'route1', { giver: 'Bug Kid', type: 'catchN', p: { sp: 'buzzlet', n: 2 }, reward: { items: [['potion', 3]] }, intro: 'I\'m making a bug collection! Catch two Buzzlets for me?' });
  A('r2_berry', 'Berry Picker', 'route2', { giver: 'Picnicker May', type: 'item', p: { id: 'honey_bun', qty: 1 }, reward: { items: [['berry_juice', 5]] }, intro: 'I forgot my lunch... do you have a Honey Bun?' });
  A('mv_lost', 'Lost in the Woods', 'moonveil', { giver: 'Lost Camper', type: 'deliver', p: { item: 'rival_letter', target: { map: 'route2', name: 'Worried Mom' } }, reward: { items: [['great_capsule', 5]] }, intro: 'I\'m lost! Can you take this note to my mom on Route 2 so she knows I\'m okay?' });
  A('r3_swim', 'Lake Lifeguard', 'route3', { giver: 'Lifeguard', type: 'trainers', p: { map: 'route3', n: 4 }, reward: { items: [['aqua_sigil', 1]] }, intro: 'Rowdy trainers keep scaring the swimmers. Defeat four trainers on this route?' });
  A('r4_hiker', 'Rockslide Rescue', 'route4', { giver: 'Hiker Boris', type: 'catchN', p: { type: 'Earth', n: 3 }, reward: { items: [['earth_sigil', 1], ['super_potion', 3]] }, intro: 'A rockslide blocked my camp! Earth creatures could help dig. Catch three?' });
  A('ip_miner', 'Ore and More', 'ironpeak_1', { giver: 'Miner', type: 'item', p: { id: 'star_dust', qty: 1 }, reward: { items: [['pick_hammer', 1]] }, intro: 'Bring me a sample of Star Dust from the mountain and I\'ll lend you my spare Pick Hammer!' });
  A('ip_summit', 'Peak Performance', 'ironpeak_summit', { giver: 'Mountaineer', type: 'trainers', p: { map: 'ironpeak_summit', n: 3 }, reward: { items: [['rare_candy', 1]] }, intro: 'Beat every trainer on the summit. Climbers respect strength!' });
  A('r5_mirage', 'Desert Mirage', 'route5', { giver: 'Traveler', type: 'show', p: { sp: 'cactling' }, reward: { items: [['nature_sigil', 1]] }, intro: 'I keep seeing a walking cactus. Am I hallucinating? Show me a Cactling!' });
  A('r6_ruin', 'Pillar Puzzles', 'route6', { giver: 'Ruin Scholar', type: 'catchN', p: { type: 'Spirit', n: 2 }, reward: { items: [['spirit_sigil', 1], ['ancient_coin', 1]] }, intro: 'The pillars react to Spirit creatures. Catch two and I\'ll share my findings.' });
  A('ah_scribe', 'The Scribe\'s Request', 'ancient_hollow', { giver: 'Scribe', type: 'dex', p: { n: 40 }, reward: { items: [['scholar_charm', 1]] }, intro: 'Register 40 caught species. The ancients would be proud.' });
  A('r7_sailor', 'Sea Legs', 'route7', { giver: 'Sailor Hector', type: 'catchN', p: { type: 'Aqua', n: 3 }, reward: { items: [['ultra_capsule', 3]] }, intro: 'Catch three Aqua types — real sailors befriend the sea!' });
  A('sp_dock', 'Dock Work', 'stormport', { giver: 'Dockhand', type: 'trainers', p: { map: 'route8', n: 5 }, reward: { money: 6000 }, intro: 'Trainers on Route 8 keep blocking deliveries. Defeat five of them?' });
  A('cw_reef', 'Reef Restoration', 'coralwind', { giver: 'Marine Biologist', type: 'show', p: { sp: 'corallyx' }, reward: { items: [['big_pearl', 2], ['aqua_capsule', 5]] }, intro: 'Show me a healthy Corallyx so I can study reef health!' });
  A('r8_sun', 'Sunbathers', 'route8', { giver: 'Beauty Cassie', type: 'showType', p: { type: 'Light', lvl: 25 }, reward: { items: [['light_sigil', 1]] }, intro: 'Light creatures love the beach. Show me one at level 25 or higher!' });
  A('ef_furnace', 'Furnace Fire', 'emberfall', { giver: 'Furnace Worker', type: 'catchN', p: { type: 'Flame', n: 4 }, reward: { items: [['ember_shard', 1], ['flame_sigil', 1]] }, intro: 'The furnaces need Flame creatures. Catch four?' });
  A('r9_ash', 'Ash Collector', 'route9', { giver: 'Ash Artist', type: 'item', p: { id: 'nugget', qty: 1 }, reward: { items: [['hyper_potion', 5]] }, intro: 'I paint with volcanic ash. A Gold Nugget would make the perfect frame...' });
  A('cl_lab', 'Lab Notes', 'caldera_1', { giver: 'Escaped Researcher', type: 'boss', p: { key: 'rook' }, reward: { items: [['full_heal', 3]] }, intro: 'The Syndicate forced me to work for them. Did someone defeat Commander Rook yet? If so I can finally go home.' });
  A('r10_cloud', 'Head in the Clouds', 'route10', { giver: 'Cloud Watcher', type: 'show', p: { sp: 'cumulord' }, reward: { items: [['wind_sigil', 1]] }, intro: 'Puffmist evolves into different forms! Show me a Cumulord?' });
  A('r10_thunder', 'Thunderhead', 'route10', { giver: 'Storm Chaser', type: 'show', p: { sp: 'thunderhead' }, reward: { items: [['volt_shard', 2]] }, intro: 'Give a Puffmist a Volt Shard and it becomes a Thunderhead! Show me one!' });
  A('sk_wind', 'Kite Festival', 'skyreach', { giver: 'Festival Host', type: 'catchN', p: { type: 'Wind', n: 5 }, reward: { items: [['ultra_capsule', 5], ['swift_boots', 1]] }, intro: 'For the Kite Festival, catch five Wind creatures!' });
  A('r11_star', 'Stargazing', 'route11', { giver: 'Young Astronomer', type: 'item', p: { id: 'star_dust', qty: 3 }, reward: { items: [['comet_piece', 1]] }, intro: 'Star Dust helps me calibrate my telescope. Three, please?' });
  A('sf_chart', 'Missing Star Chart', 'starfall', { giver: 'Junior Researcher', type: 'boss', p: { key: 'nyx' }, reward: { items: [['psychic_sigil', 1]] }, intro: 'Commander Nyx stole our chart! Please defeat her!' });
  A('r12_ski', 'Downhill Race', 'route12', { giver: 'Ski Instructor', type: 'trainers', p: { map: 'route12', n: 5 }, reward: { items: [['ice_sigil', 1], ['max_ward', 3]] }, intro: 'Beat five skiers on this route and I\'ll call you a pro!' });
  A('fh_cocoa', 'Warm Cocoa', 'frostholm', { giver: 'Cafe Owner', type: 'item', p: { id: 'honey_bun', qty: 2 }, reward: { items: [['full_restore', 2]] }, intro: 'I\'m out of Honey Buns for my cocoa! Bring me two?' });
  A('r13_fog', 'Fog Lights', 'route13', { giver: 'Fog Warden', type: 'catchN', p: { type: 'Light', n: 2 }, reward: { items: [['night_capsule', 5]] }, intro: 'Light creatures guide travelers through the fog. Catch two?' });
  A('sf_bog', 'Bog Monster', 'shadowfen', { giver: 'Marsh Ranger', type: 'show', p: { sp: 'mirejaw' }, reward: { items: [['shadow_sigil', 1], ['full_restore', 1]] }, intro: 'Show me a Mirejaw — the "bog monster" everyone fears — so I can calm the villagers.' });
  A('sf_hex', 'Hex Breaker', 'shadowfen', { giver: 'Cursed Hiker', type: 'catchN', p: { type: 'Spirit', n: 3 }, reward: { items: [['dusk_shard', 1], ['umbrawolf_stone', 1]] }, intro: 'A spirit cursed me! Only catching three Spirit creatures will lift it!' });
  A('r14_royal', 'Royal Escort', 'route14', { giver: 'Royal Guard', type: 'trainers', p: { map: 'route14', n: 6 }, reward: { money: 15000, items: [['ultra_capsule', 5]] }, intro: 'Clear the Royal Road of six troublesome trainers.' });
  A('cap_dex', 'Capital Census', 'aether_capital', { giver: 'Census Taker', type: 'dex', p: { n: 100 }, reward: { items: [['ancient_capsule', 5], ['radiant_charm', 1]] }, intro: 'The Capital is counting creatures! Register 100 caught species.' });
  A('cap_mega', 'Mega Exhibition', 'aether_capital', { giver: 'Mega Fan', type: 'stages', stages: [{ type: 'item', p: { id: 'infernyx_stone', qty: 1 }, text: 'Show me any starter\'s Aether Stone (Infernyx, Leviaphin or Arborix).', alt: ['leviaphin_stone', 'arborix_stone'] }, { type: 'dex', p: { n: 60 }, text: 'Now register 60 species caught.' }], reward: { items: [['scaldrake_stone', 1]] }, intro: 'I\'m Mega Evolution\'s biggest fan! Show me what you\'ve got!' });
  A('cp_climb', 'Champion\'s Training', 'champions_path', { giver: 'Veteran Coach', type: 'trainers', p: { map: 'champions_path', n: 8 }, reward: { items: [['rare_candy', 3]] }, intro: 'Defeat eight trainers in this cave. That\'s how champions train!' });
  A('ci_legend', 'Legends Never Die', 'champions_island', { giver: 'Legend Scholar', type: 'stages', stages: [{ type: 'dex', p: { n: 150 }, text: 'Catch 150 species.' }, { type: 'show', p: { sp: 'solarion' }, text: 'Show me Solarion, the dragon of Dawn.', alt: ['noctyrr'] }], reward: { items: [['legendary_capsule', 2]] }, intro: 'Legendary creatures are my life\'s study. Help me document them?', cond: 'champion' });
  A('wb_hazel', 'Research Assistant', 'willowbrook', { giver: 'Lab Assistant Pat', type: 'dex', p: { n: 20 }, reward: { items: [['egg_incubator', 1]] }, intro: 'The Professor needs data! Catch 20 species and I\'ll give you our prototype Egg Warmer.' });
  A('wb_egg', 'Eggs-pert', 'willowbrook', { giver: 'Breeder Jo', type: 'show', p: { sp: 'puffluff' }, reward: { items: [['honey_bun', 5], ['comfort_bell', 1]] }, intro: 'Puffluff only hatch from eggs! Breed a Cloudelle at the Day Care and show me the baby?' });
  A('vd_daycare', 'Proud Parent', 'verdant', { giver: 'Day Care Man', type: 'boss', p: { key: 'mira' }, reward: { items: [['stillstone', 1], ['ever_glow', 1]] }, intro: 'Earn Mira\'s badge and I\'ll give you some tools every breeder needs!' });
  A('ss_tonic', 'Desert Training', 'sunspire', { giver: 'Fitness Guru', type: 'trainers', p: { map: 'route5', n: 6 }, reward: { items: [['power_tonic', 1], ['guard_tonic', 1]] }, intro: 'Train in the heat! Defeat six trainers on Route 5.' });
  A('hh_welcome', 'Velorian Welcome', 'halcyon', { giver: 'Welcome Committee', type: 'catchN', p: { region: 'V', n: 5 }, reward: { items: [['ultra_capsule', 10]] }, intro: 'Welcome! Catch five creatures native to Veloria to get your starter kit!' });
  A('gw_rift', 'Between Phases', 'gloamwood', { giver: 'Rift Seeker Echo', type: 'show', p: { sp: 'phasekit' }, reward: { items: [['rift_crystal', 3]] }, intro: 'Phasekits slip between Bright and Gloam. Show me one?' });
  A('qv_gem', 'Gem Hunter', 'quartz_caverns', { giver: 'Gem Hunter', type: 'show', p: { sp: 'gemlet' }, reward: { items: [['dragon_sigil', 1]] }, intro: 'Gemlets hide in these caverns. Show me one and I\'ll share my best find.' });
  A('tc_storm', 'Eye of the Storm', 'tempest_cliffs', { giver: 'Storm Scholar', type: 'trainers', p: { map: 'tempest_cliffs', n: 5 }, reward: { items: [['electric_sigil', 1], ['full_restore', 2]] }, intro: 'Battle five trainers in the storm and you\'ll understand the wind.' });
  A('md_sand', 'Sand Sculptor', 'mirage_dunes', { giver: 'Sculptor', type: 'show', p: { sp: 'dunebastion' }, reward: { items: [['earth_sigil', 1], ['relic_vase', 1]] }, intro: 'I sculpt Dunebastions! Show me a real one for reference.' });
  A('at_aurora', 'Aurora Chaser', 'auroral_tundra', { giver: 'Aurora Photographer', type: 'catchN', p: { type: 'Ice', n: 5 }, reward: { items: [['frost_shard', 2], ['ultra_capsule', 5]] }, intro: 'Ice creatures make the best photos under the aurora. Catch five?' });
  A('oc_forge', 'Citadel Forge', 'obsidian_1', { giver: 'Neo Defector', type: 'boss', p: { key: 'neo_sable' }, reward: { items: [['obsidian_chip', 5], ['full_restore', 3]] }, intro: 'I left Neo Eclipse. Please — stop Sable before she reaches the Rift Core!' });
  A('zn_tour', 'Grand Tour', 'zenith', { giver: 'Tour Guide', type: 'stages', stages: [{ type: 'visit', p: { map: 'duskhaven' }, text: 'Visit Duskhaven.' }, { type: 'visit', p: { map: 'frostgate' }, text: 'Visit Frostgate Outpost.' }, { type: 'visit', p: { map: 'tidecrest' }, text: 'Visit Tidecrest.' }], reward: { items: [['fortune_coin', 1]], money: 20000 }, intro: 'See the great cities of Veloria and report back!' });
  A('zn_breed', 'Radiant Dreams', 'zenith', { giver: 'Radiant Collector', type: 'showRadiant', p: {}, reward: { items: [['master_capsule', 1]] }, intro: 'I\'ve dreamed of seeing a Radiant creature. If you ever find one, show me!' });
  A('rw_lake', 'Lake Reflections', 'riftwater', { giver: 'Lake Poet', type: 'catchN', p: { type: 'Psychic', n: 3 }, reward: { items: [['psychic_sigil', 1], ['mind_tonic', 1]] }, intro: 'Psychic creatures see other skies in the lake. Catch three?' });
  A('fg_outpost', 'Supply Run', 'frostgate', { giver: 'Quartermaster', type: 'item', p: { id: 'full_restore', qty: 2 }, reward: { items: [['glaciotusk_stone', 1]] }, intro: 'The outpost is low on medicine. Two Full Restores and I\'ll give you what we found in the ice.' });
  A('bm_gloom', 'Into the Gloam', 'brightmoor', { giver: 'Worried Mayor', type: 'trainers', p: { map: 'gloamwood', n: 6 }, reward: { items: [['wraithstag_stone', 1]] }, intro: 'Rift Seekers have overrun the Gloamwood. Defeat six of them?' });
  A('qv_ward', 'Warden Watcher', 'quartzvale', { giver: 'Warden Fan', type: 'boss', p: { key: 'w_quill' }, reward: { items: [['prism_lens_placeholder', 0]] }, intro: 'Beat Warden Quill and I\'ll be your biggest fan!' });
})();
// sanitize placeholder reward
for (const q of MB.QUESTS) if (q.reward && q.reward.items) q.reward.items = q.reward.items.filter(([id]) => MB.ITEMS[id]);
for (const q of MB.QUESTS) if (q.id === 'qv_ward') q.reward.items = [['rare_candy', 5]];

// inject auto-placed quest givers into map specs
MB.injectQuestNpcs = function () {
  for (const q of MB.QUESTS) {
    if (q.map && MB.WORLD_SPECS[q.map]) {
      MB.WORLD_SPECS[q.map].npcs.push({ id: 'qg_' + q.id, name: q.giver, at: MB.WORLD_SPECS[q.map].type === 'cave' ? 'random' : 'path', script: 'q:' + q.id, cond: q.cond, kind: MB.pick(['old', 'kid', 'researcher', 'hiker', 'ranger', 'ace', undefined]) });
    }
    if (q.type === 'deliver' && q.p.target) MB.WORLD_SPECS[q.p.target.map].npcs.push({ id: 'qt_' + q.id, name: q.p.target.name, at: 'path', script: 'qt:' + q.id, kind: 'old' });
  }
};

MB.Quests = {
  get(id) { return MB.QUESTS.find((q) => q.id === id); },
  st(id) { const S = MB.state; return S.quests[id]; },
  stageDef(q, st) { return q.type === 'stages' ? q.stages[st.stage || 0] : { type: q.type, p: q.p }; },
  progressText(q, st) {
    const d = MB.Quests.stageDef(q, st);
    if (!d) return '';
    const p = d.p;
    switch (d.type) {
      case 'show': return `Show a ${MB.SP[p.sp].name}${d.alt ? ' (or similar)' : ''}.`;
      case 'showType': return `Show a ${p.type}-type creature of Lv. ${p.lvl}+.`;
      case 'catchN': return `Catch ${p.n} ${p.sp ? MB.SP[p.sp].name : p.region === 'V' ? 'Velorian' : p.type + '-type'} creatures (${Math.min(p.n, st.count || 0)}/${p.n}).`;
      case 'item': return `Bring ${p.qty} ${MB.ITEMS[p.id].name}${p.qty > 1 ? 's' : ''} (have ${MB.Bag.count(p.id)}).`;
      case 'deliver': return `Deliver the letter to ${p.target.name} on ${MB.WORLD_SPECS[p.target.map].name}.`;
      case 'trainers': return `Defeat ${p.n} trainers on ${MB.WORLD_SPECS[p.map].name} (${Math.min(p.n, st.count || 0)}/${p.n}).`;
      case 'boss': return `Defeat ${MB.BOSSES[p.key].title} ${MB.BOSSES[p.key].name}.`;
      case 'visit': return `Visit ${MB.WORLD_SPECS[p.map].name}.`;
      case 'dex': return `Register ${p.n} caught species (${MB.Dex.countCaught()}/${p.n}).`;
      case 'showRadiant': return 'Show a Radiant (shiny) creature.';
    }
    return '';
  },
  met(q, st) {
    const S = MB.state;
    const d = MB.Quests.stageDef(q, st); const p = d.p;
    switch (d.type) {
      case 'show': return S.party.some((m) => !m.egg && (m.sp === p.sp || (d.alt || []).includes(m.sp)));
      case 'showType': return S.party.some((m) => !m.egg && MB.SP[m.sp].types.includes(p.type) && m.lvl >= p.lvl);
      case 'catchN': return (st.count || 0) >= p.n;
      case 'item': return MB.Bag.count(p.id) >= p.qty || (d.alt || []).some((a) => MB.Bag.count(a) > 0) || MB.state.party.some((m) => m.item === p.id || (d.alt || []).includes(m.item));
      case 'deliver': return !!st.delivered;
      case 'trainers': return (st.count || 0) >= p.n;
      case 'boss': return !!S.flags['beat_' + p.key];
      case 'visit': return !!st.visited || (S.visitedAfter && S.visitedAfter[q.id + ':' + p.map]);
      case 'dex': return MB.Dex.countCaught() >= p.n;
      case 'showRadiant': return S.party.some((m) => m.shiny && !m.egg);
    }
    return false;
  },
  consume(q, st) {
    const d = MB.Quests.stageDef(q, st);
    if (d.type === 'item' && d.p.qty > 0 && !q.id.startsWith('cap_mega')) { if (MB.Bag.count(d.p.id) >= d.p.qty) MB.Bag.remove(d.p.id, d.p.qty); }
  },
  async talk(id) {
    const S = MB.state;
    const q = MB.Quests.get(id); if (!q) return;
    const who = q.giver;
    let st = S.quests[id];
    if (st && st.done) return MB.say(q.after || 'Thanks again for your help!', { speaker: who });
    if (!st) {
      await MB.say(q.intro, { speaker: who });
      if (!(await MB.yesno(`Accept "${q.name}"?`))) return MB.say('Oh... maybe later, then.', { speaker: who });
      st = S.quests[id] = { stage: 0, count: 0, started: S.day };
      MB.toast('New quest: ' + q.name, '#305090');
      if (q.type === 'deliver') await MB.Sc.give(q.p.item);
      const d0 = MB.Quests.stageDef(q, st);
      if (q.type === 'stages') await MB.say(d0.text, { speaker: who });
      if (!MB.Quests.met(q, st)) return;
    }
    if (!MB.Quests.met(q, st)) {
      const d = MB.Quests.stageDef(q, st);
      return MB.say((d.text ? d.text + ' ' : '') + MB.Quests.progressText(q, st), { speaker: who });
    }
    MB.Quests.consume(q, st);
    if (q.type === 'stages' && st.stage < q.stages.length - 1) {
      st.stage++; st.count = 0; st.visited = false;
      await MB.say('Excellent! Next: ' + q.stages[st.stage].text, { speaker: who });
      return;
    }
    await MB.Quests.complete(q, st);
  },
  async complete(q, st) {
    const S = MB.state;
    st.done = true;
    MB.audio.sfx('badge');
    await MB.say(q.done || 'Thank you so much! Please take this.', { speaker: q.giver });
    const R = q.reward || {};
    for (const [id, n] of R.items || []) if (n > 0) await MB.Sc.give(id, n);
    if (R.money) { S.money += R.money; await MB.say(`${S.name} received $${R.money}!`); }
    if (R.mon) await MB.Sc.giveMon(R.mon[0], R.mon[1]);
    if (R.flag) MB.Sc.set(R.flag);
    MB.toast('Quest complete: ' + q.name, '#307040');
    MB.Achievements.check();
  },
  async deliverTalk(id) {
    const S = MB.state;
    const q = MB.Quests.get(id); const st = S.quests[id];
    if (!st || st.done || st.delivered) return MB.say('Oh, hello there.', { speaker: q.p.target.name });
    if (!MB.Bag.count(q.p.item)) return MB.say('Hello?', { speaker: q.p.target.name });
    MB.Bag.remove(q.p.item, 1); st.delivered = true;
    await MB.say('A note from my child? Oh, thank goodness they\'re safe! Please tell them to come home soon.', { speaker: q.p.target.name });
    await MB.say('(Return to the quest giver to finish the quest.)');
  },
  onCatch(m) {
    const S = MB.state;
    for (const q of MB.QUESTS) {
      const st = S.quests[q.id]; if (!st || st.done) continue;
      const d = MB.Quests.stageDef(q, st); if (!d || d.type !== 'catchN') continue;
      const sp = MB.SP[m.sp];
      if ((d.p.sp && d.p.sp === m.sp) || (d.p.type && sp.types.includes(d.p.type)) || (d.p.region && sp.region === d.p.region)) { st.count = (st.count || 0) + 1; if (st.count === d.p.n) MB.toast('Quest updated: ' + q.name, '#305090'); }
    }
  },
  onTrainer(npc, map) {
    const S = MB.state;
    for (const q of MB.QUESTS) {
      const st = S.quests[q.id]; if (!st || st.done) continue;
      const d = MB.Quests.stageDef(q, st); if (!d || d.type !== 'trainers') continue;
      if (d.p.map === map.id) st.count = (st.count || 0) + 1;
    }
  },
  onDefeat() {},
  onVisit(mapId) {
    const S = MB.state;
    for (const q of MB.QUESTS) {
      const st = S.quests[q.id]; if (!st || st.done) continue;
      const d = MB.Quests.stageDef(q, st); if (d && d.type === 'visit' && d.p.map === mapId) { if (!st.visited) MB.toast('Quest updated: ' + q.name, '#305090'); st.visited = true; }
    }
  },
  onFlag() {},
};
MB.SCRIPTS = MB.SCRIPTS || {};
