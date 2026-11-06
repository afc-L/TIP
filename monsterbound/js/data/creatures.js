'use strict';
// =====================================================================================
// CREATURE DATABASE
// Each LINE is: [names, types per stage, body per stage, evolution methods, archetype,
//                habitats, rarity, flags]
//  names:   "A,B,C"  (a final "C/D" means B branches into C or D)
//  types:   "T1/T2|T1|..." per stage (one entry = shared by all stages)
//  evo:     per transition: 16 (level) | n30/d30 (level at night/day) | f / fn / fd (friendship)
//           | i:item | t (Bond Cord, trade-equivalent) | loc:tag:lvl | q:flag ;  branch "x/y"
//  arch:    stat archetype   rarity: c u r vr anc leg myth sec
//  flags:   start, egg, fossil, n (night only), d (day only), mega[:T1/T2[:ability]], water
// =====================================================================================
MB.LINES_AETHERIA = [
  ['Emberfox,Blazetail,Infernyx', 'Flame|Flame|Flame/Spirit', 'fox', '16,36', 'speed', 'none', 'r', 'start,mega:Flame/Spirit:soulfire'],
  ['Aquaphin,Tidalfin,Leviaphin', 'Aqua|Aqua|Aqua/Light', 'dolphin', '16,36', 'bal', 'none', 'r', 'start,mega:Aqua/Dragon:leviathan'],
  ['Leafling,Verdantail,Arborix', 'Nature|Nature|Nature/Earth', 'deer', '16,36', 'tank', 'none', 'r', 'start,mega:Nature/Earth:world_tree'],
  ['Twigeet,Brisquill,Tempestrel', 'Normal/Wind', 'bird', '11,30', 'speed', 'meadow,forest,mountain', 'c', 'mega:Wind/Metal:sky_lord'],
  ['Nibblet,Gnawster', 'Normal', 'rodent', '18', 'speed', 'meadow,city', 'c', ''],
  ['Buzzlet,Cocoonix,Prismoth/Duskmoth', 'Nature|Nature|Nature/Wind|Venom/Shadow', 'insect|cocoon|moth', '7,d10/n10', 'spec', 'forest,meadow', 'c', ''],
  ['Sproutle,Bloomkin,Floralisk/Thornqueen', 'Nature|Nature|Nature/Light|Nature/Venom', 'plant', '16,i:sun_shard/i:dusk_shard', 'spec', 'meadow,forest', 'u', ''],
  ['Sparkit,Voltpaw,Thundermane', 'Electric', 'cat', '15,32', 'speed', 'meadow,city', 'u', 'mega:Electric/Dragon:storm_heart'],
  ['Pebblit,Bouldrone,Montagor', 'Earth|Earth/Metal|Earth/Metal', 'golem', '22,t', 'tank', 'cave,mountain', 'c', 'mega:Earth/Metal:bedrock'],
  ['Squeakbat,Echowing,Nocturnix', 'Shadow/Wind', 'bat', '20,f', 'speed', 'cave', 'c', 'n'],
  ['Dribblet,Croakwell,Torrentoad', 'Aqua|Aqua|Aqua/Earth', 'frog', '18,36', 'bal', 'lake,marsh', 'c', 'mega:Aqua/Earth:swift_current'],
  ['Minnowisp,Reefin', 'Aqua', 'fish', '20', 'speed', 'lake,sea', 'c', 'water'],
  ['Grubbit,Mosslug', 'Nature/Venom', 'blob', '20', 'wall', 'forest,marsh', 'c', ''],
  ['Pupwick,Hearthound', 'Flame', 'quad', 'i:ember_shard', 'phys', 'meadow,volcano', 'u', 'mega:Flame/Shadow:menace'],
  ['Cubbin,Grizzlord', 'Normal|Normal/Earth', 'bear', '30', 'bulk', 'forest,mountain', 'u', 'mega:Normal/Earth:colossal_might'],
  ['Glowmite,Lumifly', 'Light|Light/Wind', 'insect|moth', 'n18', 'spec', 'forest', 'c', 'n'],
  ['Frostkit,Glacielle', 'Ice', 'fox', 'i:frost_shard', 'spec', 'snow', 'u', 'mega:Ice/Light:snow_call'],
  ['Flurrip,Blizzaroo', 'Ice', 'rodent', '30', 'phys', 'snow,mountain', 'c', ''],
  ['Shiverfin,Glacifin', 'Ice/Aqua', 'fish', '28', 'bal', 'snow,sea', 'u', 'water'],
  ['Sandrit,Duneclaw', 'Earth', 'lizard', '22', 'phys', 'desert', 'c', ''],
  ['Scorplet,Stingrave', 'Venom/Earth', 'crab', '28', 'phys', 'desert', 'u', ''],
  ['Cactling,Saguardian', 'Nature|Nature/Shadow', 'plant', 'n32', 'bulk', 'desert', 'u', ''],
  ['Scarablet,Sunbeetle', 'Light/Earth', 'beetle', '30', 'tank', 'desert,ruins', 'r', 'd'],
  ['Magmite,Magmolem,Calderon', 'Flame/Earth', 'blob|golem|golem', '20,40', 'tank', 'volcano', 'u', 'mega:Flame/Earth:sun_call'],
  ['Emberwren,Pyroraptor', 'Flame/Wind', 'bird', '32', 'speed', 'volcano,mountain', 'u', ''],
  ['Coalsnail,Furnashell', 'Flame', 'turtle', '30', 'wall', 'volcano,cave', 'c', ''],
  ['Gearling,Cogwheel,Automax', 'Metal', 'orb|mech|mech', '25,45', 'tank', 'city,factory', 'u', 'mega:Metal/Electric:iron_will'],
  ['Zapeel,Eelectra', 'Electric/Aqua', 'serpent', '30', 'spec', 'lake,sea', 'u', 'water'],
  ['Ampig,Voltusk', 'Electric|Electric/Normal', 'quad', '26', 'bulk', 'city,meadow', 'c', ''],
  ['Ironmite,Steelmantis', 'Metal/Venom|Metal/Nature', 'insect', '30', 'phys', 'forest,factory', 'u', ''],
  ['Wisplet,Phantomb,Spectrelle', 'Spirit|Spirit|Spirit/Psychic', 'ghost', '25,i:dusk_shard', 'spec', 'ruins,marsh', 'u', 'n,mega:Spirit/Psychic:serene'],
  ['Cryptkin,Mausolith', 'Spirit/Earth', 'golem', '35', 'wall', 'ruins', 'u', ''],
  ['Shadepup,Duskhound,Umbrawolf', 'Shadow', 'quad', '18,38', 'phys', 'marsh,forest', 'u', 'n,mega:Shadow/Spirit:dark_aura'],
  ['Purrshade,Nyxeline', 'Shadow|Shadow/Psychic', 'cat', 'fn', 'speed', 'city,forest', 'r', 'n,mega:Shadow/Psychic:keen_edge'],
  ['Thinkit,Cerebrix,Mentalord', 'Psychic', 'orb|biped|biped', '18,38', 'spec', 'sky,ruins', 'u', 'mega:Psychic/Metal:mega_launcher'],
  ['Lunabun,Lunarabbit', 'Psychic|Psychic/Light', 'rodent', 'f', 'spec', 'sky,meadow', 'u', 'n'],
  ['Starfawn,Celestag', 'Light|Light/Psychic', 'deer', '34', 'bal', 'sky,observatory', 'r', 'mega:Light/Psychic:radiant_aura'],
  ['Oozle,Sludgekin,Mirelord', 'Venom', 'blob', '20,38', 'wall', 'marsh,factory', 'c', 'mega:Venom/Shadow:toxic_skin'],
  ['Hissling,Venomander', 'Venom|Venom/Dragon', 'serpent', '30', 'phys', 'marsh,desert', 'u', 'mega:Venom/Dragon:poison_claws'],
  ['Bogchomp,Mirejaw', 'Aqua/Shadow', 'lizard', '30', 'bulk', 'marsh,lake', 'u', ''],
  ['Marshlight', 'Spirit/Flame', 'ghost', '', 'spec', 'marsh', 'r', 'n'],
  ['Dracling,Drakeon,Wyvernox', 'Dragon|Dragon|Dragon/Wind', 'lizard|dragon|dragon', '30,50', 'phys', 'mountain,caldera', 'vr', 'mega:Dragon/Wind:sky_lord'],
  ['Wyrmlet,Mistserpent,Abyssdrake', 'Dragon/Aqua', 'serpent|serpent|wyrm', '30,52', 'spec', 'sea,lake', 'vr', 'water,mega:Dragon/Aqua:rain_call'],
  ['Ramkin,Crashram', 'Earth/Normal', 'quad', '30', 'phys', 'mountain,meadow', 'c', ''],
  ['Kidcrag,Peakhorn', 'Earth|Earth/Ice', 'deer', 'loc:snow:30', 'bal', 'mountain,snow', 'u', ''],
  ['Galechick,Stormhawk', 'Wind|Wind/Electric', 'bird', '34', 'speed', 'sky,mountain', 'u', 'mega:Wind/Electric:momentum'],
  ['Hootlet,Owlumen', 'Normal/Psychic|Psychic/Wind', 'bird', 'n24', 'spec', 'forest,meadow', 'c', 'n'],
  ['Pinchel,Krabastion', 'Aqua/Metal', 'crab', '28', 'tank', 'beach,sea', 'c', 'mega:Aqua/Metal:tough_claws'],
  ['Glimmerstar,Prismastar', 'Aqua/Light', 'star', 'i:aqua_shard', 'spec', 'beach,sea', 'u', 'water'],
  ['Jellune,Medusalis', 'Aqua/Venom', 'jelly', '30', 'spdef', 'sea', 'c', 'water'],
  ['Terrapod,Islandon', 'Nature/Aqua', 'turtle', '34', 'wall', 'lake,beach', 'u', 'mega:Nature/Aqua:bedrock'],
  ['Flopup,Walroar', 'Ice/Aqua', 'seal', '35', 'bulk', 'snow,sea,beach', 'c', ''],
  ['Chillbill,Emperion', 'Ice|Ice/Metal', 'bird', '36', 'bal', 'snow', 'u', ''],
  ['Yetling,Avalanchor', 'Ice|Ice/Earth', 'ape', '38', 'bulk', 'snow,mountain', 'r', 'mega:Ice/Earth:fur_coat'],
  ['Shardling,Prismice', 'Ice|Ice/Psychic', 'star', 'i:frost_shard', 'spec', 'snow,cave', 'u', ''],
  ['Scrapmonk,Brawlape', 'Normal|Normal/Earth', 'ape', '28', 'phys', 'forest,mountain', 'c', ''],
  ['Salamber,Scaldrake', 'Flame|Flame/Dragon', 'lizard', '40', 'mixed', 'volcano,caldera', 'r', 'mega:Flame/Dragon:sun_dancer'],
  ['Molekin,Drillmole', 'Earth|Earth/Metal', 'rodent', '28', 'phys', 'cave,desert', 'u', ''],
  ['Wormby,Tunnelwyrm', 'Earth', 'serpent', 'loc:cave:30', 'bulk', 'cave,meadow', 'c', ''],
  ['Webbit,Arachnyx', 'Venom/Shadow', 'spider', 'n25', 'phys', 'forest,cave', 'u', 'n'],
  ['Shroomlet,Mycelord', 'Nature/Venom', 'mushroom', '28', 'wall', 'forest,cave', 'c', ''],
  ['Barklet,Elderoot', 'Nature|Nature/Spirit', 'tree', 'q:caught_sylvarch', 'tank', 'forest', 'r', 'mega:Nature/Spirit:regrowth'],
  ['Glimmit,Sparkelle,Aurorelle', 'Light', 'orb|ghost|ghost', '20,i:sun_shard', 'spec', 'meadow,sky', 'r', 'd,mega:Light/Psychic:radiant_aura'],
  ['Petalwing', 'Nature/Wind', 'bird', '', 'speed', 'meadow', 'u', 'd'],
  ['Bristlit,Voltquill', 'Electric|Electric/Earth', 'hedgehog', '26', 'phys', 'meadow,desert', 'u', ''],
  ['Fluffbolt,Stormwool', 'Electric', 'sheep', '28', 'spdef', 'meadow,mountain', 'c', ''],
  ['Chromeraven', 'Metal/Wind', 'bird', '', 'phys', 'mountain,city', 'r', ''],
  ['Bladebeetle', 'Metal/Nature', 'beetle', '', 'phys', 'forest', 'r', ''],
  ['Phantblade,Excalith', 'Metal/Spirit', 'sword', 'i:dusk_shard', 'phys', 'ruins', 'r', 'mega:Metal/Spirit:keen_edge'],
  ['Hexdoll', 'Spirit/Psychic', 'ghost', '', 'spec', 'ruins,city', 'u', 'n'],
  ['Mimichest', 'Spirit/Metal', 'chest', '', 'bulk', 'ruins', 'vr', ''],
  ['Fossilfin,Aeonray', 'Earth/Aqua', 'fish', '40', 'bal', 'none', 'anc', 'fossil'],
  ['Ambrawing,Ptercient', 'Earth/Wind', 'bird', '40', 'speed', 'none', 'anc', 'fossil,mega:Earth/Dragon:tough_claws'],
  ['Trilobix,Carapaxon', 'Earth/Metal', 'crab', '40', 'tank', 'none', 'anc', 'fossil'],
  ['Runeling,Glyphion', 'Psychic/Earth', 'golem', '40', 'spdef', 'ruins', 'anc', ''],
  ['Breezel,Cyclynx', 'Wind', 'cat', '30', 'speed', 'sky,mountain', 'u', ''],
  ['Skimmet,Wyrmfly', 'Nature|Dragon/Nature', 'insect', '34', 'speed', 'lake', 'r', ''],
  ['Puffmist,Cumulord/Thunderhead', 'Wind/Aqua|Wind/Aqua|Wind/Electric', 'cloud', '30/i:volt_shard', 'spdef', 'sky,mountain', 'c', ''],
  ['Gritfin,Dunesharq', 'Earth/Dragon', 'fish', '38', 'phys', 'desert', 'r', 'mega:Earth/Dragon:sand_veil'],
  ['Solcub,Sunmane', 'Light/Flame', 'cat', '36', 'mixed', 'desert', 'r', 'd,mega:Light/Flame:sun_call'],
  ['Refractor', 'Light/Metal', 'star', '', 'spdef', 'city,observatory', 'r', ''],
  ['Smogglet,Fumebelch', 'Venom/Flame', 'blob', '30', 'wall', 'factory,city', 'c', ''],
  ['Rustrat,Scraprat', 'Metal/Normal', 'rodent', '22', 'speed', 'city,factory', 'c', ''],
  ['Plazadove', 'Normal/Wind', 'bird', '', 'bal', 'city', 'c', ''],
  ['Tomkit,Strayvant', 'Normal|Normal/Shadow', 'cat', 'f', 'speed', 'city', 'c', ''],
  ['Seacolt,Tidesteed', 'Aqua', 'seahorse', '34', 'spec', 'sea', 'u', 'water'],
  ['Finbite,Megalodent', 'Aqua/Shadow', 'shark', '30', 'phys', 'sea', 'u', 'water,mega:Aqua/Shadow:moxie'],
  ['Titanwhale', 'Aqua', 'whale', '', 'wall', 'sea', 'vr', 'water'],
  ['Octobit,Octomancer', 'Aqua|Aqua/Psychic', 'jelly', '34', 'spec', 'sea,beach', 'u', 'water'],
  ['Pearlush', 'Aqua/Light', 'shell', '', 'spdef', 'sea,beach', 'r', ''],
  ['Corallyx', 'Aqua/Nature', 'coral', '', 'wall', 'beach,sea', 'c', ''],
  ['Cindercoil', 'Flame/Venom', 'serpent', '', 'mixed', 'volcano', 'u', ''],
  ['Frostmoth', 'Ice/Wind', 'moth', '', 'spec', 'snow', 'r', 'n'],
  ['Tickowl', 'Metal/Psychic', 'bird', '', 'spec', 'observatory,city', 'r', ''],
  ['Cometling,Meteorix', 'Light/Earth', 'star', 'q:shard_starfall', 'mixed', 'observatory,sky', 'r', 'n,mega:Light/Earth:attunement'],
  ['Nebulite', 'Psychic/Spirit', 'orb', '', 'glass', 'observatory', 'vr', 'n'],
  ['Shadewisp,Umbraith', 'Shadow/Spirit', 'ghost', '34', 'spec', 'marsh,ruins', 'u', 'n'],
  ['Bogleap', 'Venom/Aqua', 'frog', '', 'bal', 'marsh', 'c', ''],
  ['Gnatterling,Mirebuzz', 'Venom/Wind', 'insect', '22', 'speed', 'marsh,lake', 'c', ''],
  ['Gemling,Quartzite', 'Earth/Light', 'golem', '34', 'tank', 'cave', 'r', ''],
  ['Drakepup,Wyrmhound', 'Dragon|Dragon/Shadow', 'quad', '40', 'phys', 'caldera,mountain', 'r', ''],
  ['Sparkdrake', 'Dragon/Electric', 'dragon', '', 'spec', 'sky,caldera', 'vr', ''],
  ['Puffluff,Cloudelle', 'Normal|Normal/Light', 'blob|cloud', 'f', 'spdef', 'meadow', 'u', 'egg'],
  ['Candlit,Pyrelamp', 'Spirit/Flame', 'candle', '30', 'spec', 'ruins,city', 'u', 'n'],
  ['Rollidillo,Armadrill', 'Earth|Earth/Metal', 'armadillo', '30', 'tank', 'desert', 'u', ''],
  ['Sandromel', 'Earth/Normal', 'quad', '', 'bulk', 'desert', 'c', ''],
  ['Bergolem', 'Ice/Metal', 'golem', '', 'tank', 'snow', 'r', ''],
  ['Zephlet,Zephyrine', 'Wind/Spirit', 'ghost', 'f', 'speed', 'sky', 'u', ''],
  ['Hivelet,Hiveguard', 'Nature/Venom', 'insect', '28', 'tank', 'meadow,forest', 'c', 'd'],
  ['Dotbug', 'Nature/Light', 'beetle', '', 'bal', 'meadow', 'c', 'd'],
  ['Acorny,Oakskitter', 'Nature/Normal', 'rodent', '20', 'speed', 'forest,meadow', 'c', ''],
  ['Morphling', 'Normal', 'blob', '', 'bal', 'meadow,city,cave', 'r', 'universal'],
  ['Mudpie,Mudslinger', 'Earth', 'blob', '24', 'bal', 'marsh,meadow', 'c', ''],
  ['Lavasprite', 'Flame/Light', 'ghost', '', 'glass', 'caldera,volcano', 'r', ''],
  ['Glacierhorn', 'Ice/Dragon', 'deer', '', 'phys', 'snow,mountain', 'vr', ''],
  ['Ironjaw,Steelmaw', 'Metal|Metal/Shadow', 'shark', '36', 'phys', 'factory,cave', 'u', ''],
];

// ---------------- VELORIA (second region) ----------------
MB.LINES_VELORIA = [
  ['Glintmouse,Prismouse', 'Light/Electric', 'rodent', '24', 'speed', 'v_field,v_city', 'c', ''],
  ['Gloamkit,Gloamlynx', 'Shadow/Nature', 'cat', '30', 'speed', 'v_wood', 'u', 'n'],
  ['Shimmerlarva,Shimmerpupa,Auroramoth', 'Nature|Nature|Light/Wind', 'insect|cocoon|moth', '8,12', 'spec', 'v_field,v_wood', 'c', ''],
  ['Shellbop,Conchord', 'Aqua/Psychic', 'turtle', '30', 'spdef', 'v_beach,v_lake', 'c', ''],
  ['Squallow,Tempeswift', 'Wind/Electric', 'bird', '30', 'speed', 'v_cliff,v_field', 'c', ''],
  ['Kelpling,Kelpstrider', 'Aqua/Nature', 'plant', '30', 'bal', 'v_beach,v_lake', 'c', 'water'],
  ['Mirafox,Miragenix', 'Psychic/Earth', 'fox', '34', 'spec', 'v_dunes', 'u', 'mega:Psychic/Earth:attunement'],
  ['Sandshell,Dunebastion', 'Earth/Metal', 'turtle', '36', 'tank', 'v_dunes', 'u', ''],
  ['Glasslime', 'Light/Earth', 'blob', '', 'wall', 'v_dunes,v_cave', 'u', ''],
  ['Mammite,Tuskarok,Glaciotusk', 'Ice/Earth', 'quad', '24,44', 'bulk', 'v_tundra', 'u', 'mega:Ice/Earth:colossal_might'],
  ['Polarlynx', 'Ice/Light', 'cat', '', 'speed', 'v_tundra', 'r', ''],
  ['Obsidle,Obsilith', 'Earth/Shadow', 'golem', '38', 'tank', 'v_cave,v_volcano', 'u', ''],
  ['Cindercrab,Pyroclaw', 'Flame/Metal', 'crab', '34', 'phys', 'v_volcano,v_beach', 'u', ''],
  ['Cinderfoal,Blazesteed', 'Flame|Flame/Light', 'horse', '40', 'speed', 'v_field,v_volcano', 'r', 'mega:Flame/Light:sun_dancer'],
  ['Coppercog,Verdigear', 'Metal/Venom', 'mech', '32', 'tank', 'v_ruins', 'u', ''],
  ['Riftlet,Riftsprite,Riftseraph', 'Spirit/Psychic', 'orb|ghost|ghost', '20,42', 'spec', 'v_rift,v_ruins', 'u', 'mega:Spirit/Light:pressure_aura'],
  ['Phasekit,Phaselynx', 'Psychic/Shadow', 'cat', 'loc:rift:32', 'speed', 'v_rift', 'r', ''],
  ['Gemlet,Gemdrake,Crystalwyrm', 'Dragon/Light', 'lizard|dragon|dragon', '30,55', 'mixed', 'v_cave,v_rift', 'vr', 'mega:Dragon/Light:radiant_aura'],
  ['Galecoil', 'Wind/Dragon', 'serpent', '', 'speed', 'v_cliff', 'vr', ''],
  ['Ampercub,Thundertiger', 'Electric|Electric/Shadow', 'cat', '36', 'phys', 'v_cliff,v_field', 'u', 'mega:Electric/Shadow:static_fur'],
  ['Glowcap,Lumicap', 'Nature/Light', 'mushroom', '28', 'wall', 'v_wood,v_cave', 'c', ''],
  ['Mudpup,Mudhound', 'Earth/Aqua', 'quad', '30', 'bal', 'v_lake,v_field', 'c', ''],
  ['Driftwisp,Ghostanchor', 'Spirit/Aqua', 'ghost', '34', 'bulk', 'v_beach,v_lake', 'u', 'n,mega:Spirit/Metal:steadfast'],
  ['Dunefinch,Mirageagle', 'Earth/Wind', 'bird', '34', 'speed', 'v_dunes,v_cliff', 'u', ''],
  ['Ionode,Ionarch', 'Electric/Metal', 'orb', '36', 'spec', 'v_city,v_ruins', 'u', ''],
  ['Snowflit,Blizzelle', 'Ice/Spirit', 'ghost', '32', 'spec', 'v_tundra', 'u', 'n'],
  ['Frostowl', 'Ice/Psychic', 'bird', '', 'spec', 'v_tundra', 'u', 'n'],
  ['Mindbloom', 'Psychic/Nature', 'plant', '', 'spec', 'v_field,v_wood', 'r', 'd'],
  ['Quartzlet,Prismolith', 'Earth/Light', 'golem', '34', 'tank', 'v_cave', 'u', ''],
  ['Plumewing', 'Normal/Wind', 'bird', '', 'bal', 'v_city,v_field', 'c', ''],
  ['Toxibloom,Nightshroud', 'Venom/Nature', 'plant', 'n32', 'spec', 'v_wood', 'u', ''],
  ['Monklet,Halomonk', 'Light/Normal', 'ape', '30', 'phys', 'v_ruins,v_cliff', 'u', ''],
  ['Wallowpot,Mirehippo', 'Earth/Aqua', 'hippo', '34', 'bulk', 'v_lake', 'c', ''],
  ['Icespinner', 'Ice/Venom', 'spider', '', 'phys', 'v_tundra,v_cave', 'u', ''],
  ['Pebslug,Bouldersnail', 'Earth', 'blob', '28', 'wall', 'v_cave,v_field', 'c', ''],
  ['Spiritfawn,Wraithstag', 'Spirit/Nature', 'deer', '38', 'mixed', 'v_wood', 'r', 'mega:Spirit/Nature:regrowth'],
  ['Zephfox,Typhox', 'Wind/Normal', 'fox', '30', 'speed', 'v_cliff,v_field', 'c', ''],
  ['Luxbug,Luxscarab', 'Light/Metal', 'beetle', '30', 'tank', 'v_ruins,v_field', 'u', 'd'],
  ['Emberbat,Cinderwing', 'Flame/Shadow', 'bat', '30', 'speed', 'v_volcano,v_cave', 'u', 'n'],
  ['Pageling,Squireon,Paladrix', 'Metal|Metal|Metal/Light', 'biped', '20,40', 'phys', 'v_city,v_ruins', 'u', 'mega:Metal/Light:iron_will'],
  ['Siphonleech', 'Venom/Aqua', 'serpent', '', 'bal', 'v_lake', 'c', 'water'],
  ['Aerowhale', 'Wind/Aqua', 'whale', '', 'wall', 'v_cliff', 'vr', ''],
  ['Riftshark', 'Aqua/Psychic', 'shark', '', 'phys', 'v_rift,v_lake', 'r', 'water'],
  ['Tidelurk,Abyssquid', 'Aqua/Shadow', 'jelly', '36', 'spec', 'v_lake,v_beach', 'u', 'water'],
  ['Thornback,Bramblehulk', 'Nature/Earth', 'armadillo', '36', 'tank', 'v_wood,v_field', 'u', ''],
  ['Voidmite,Voidmantis', 'Shadow|Shadow/Psychic', 'insect', '38', 'phys', 'v_rift,v_cave', 'r', 'n'],
  ['Sunpetal,Solstiflor', 'Light/Nature', 'plant', 'i:sun_shard', 'spec', 'v_field', 'u', 'd'],
  ['Kilnkin,Forgehulk', 'Flame/Metal', 'golem', '40', 'bulk', 'v_volcano', 'u', 'mega:Flame/Metal:ember_hide'],
];

// ---------------- LEGENDARY & MYTHICAL (individual entries) ----------------
// [name, types, body, rarity, base stats [hp,atk,def,spa,spd,spe], ability, signature move, region, lore, flags]
MB.LEGENDS = [
  ['Solarion', 'Light/Dragon', 'dragon', 'leg', [100, 120, 100, 150, 110, 100], 'radiant_aura', 'solar_crown', 'A', 'Said to have lit the first dawn over Aetheria. Its wings scatter light that never fades.', 'mega:Light/Dragon:radiant_aura'],
  ['Noctyrr', 'Shadow/Dragon', 'dragon', 'leg', [100, 150, 100, 120, 100, 110], 'dark_aura', 'eclipse_howl', 'A', 'The twin of the dawn. When it sleeps, the night stretches on for a season.', 'mega:Shadow/Dragon:eclipse_core'],
  ['Aethereon', 'Psychic/Light', 'orb', 'myth', [120, 100, 120, 140, 120, 100], 'aether_guard', 'aether_pulse', 'A', 'The living heart of Aether itself. Every Mega Evolution is a whisper of its power.', ''],
  ['Pyrrhawk', 'Flame/Wind', 'bird', 'leg', [90, 100, 90, 125, 85, 90], 'ember_hide', 'phoenix_dive', 'A', 'Nests in the Ashen Caldera. Its molted feathers burn for a hundred years.', ''],
  ['Glaciwing', 'Ice/Wind', 'bird', 'leg', [90, 85, 100, 95, 125, 85], 'snow_call', 'glacier_wing', 'A', 'Its wingbeats bring blizzards to Frostholm. It guards the frozen spire.', ''],
  ['Voltacrest', 'Electric/Wind', 'bird', 'leg', [90, 90, 85, 125, 90, 100], 'static_fur', 'storm_crest', 'A', 'Rides the storms that batter Stormport. Lightning follows wherever it flies.', ''],
  ['Basaltitan', 'Earth/Metal', 'golem', 'leg', [80, 130, 150, 60, 100, 60], 'bedrock', 'titan_fist', 'A', 'An ancient guardian sealed beneath Ancient Hollow by the first Aether wielders.', ''],
  ['Coralith', 'Aqua/Earth', 'turtle', 'leg', [110, 80, 130, 90, 130, 40], 'rain_call', 'coral_requiem', 'A', 'Its shell is a living reef. It slumbers at the heart of the Sunken Kingdom.', ''],
  ['Sylvarch', 'Nature/Spirit', 'deer', 'leg', [95, 105, 100, 105, 100, 95], 'regrowth', 'grove_anthem', 'A', 'The spirit of Moonveil Forest. Trees bow wherever its hooves touch.', ''],
  ['Lunelle', 'Psychic/Spirit', 'ghost', 'leg', [80, 70, 90, 130, 120, 110], 'serene', 'lunar_chorus', 'A', 'Appears at Starfall Observatory during meteor showers, singing to the stars.', ''],
  ['Thalassor', 'Aqua/Dragon', 'wyrm', 'leg', [105, 130, 100, 110, 90, 95], 'leviathan', 'abyss_maw', 'A', 'The drowned king of the Sunken Kingdom. Its roar shaped the coastline.', 'mega:Aqua/Dragon:leviathan'],
  ['Chronyx', 'Metal/Psychic', 'mech', 'myth', [100, 100, 110, 120, 110, 60], 'iron_will', 'chrono_shift', 'A', 'A clockwork being said to have kept time for the ancient civilization.', ''],
  ['Wispette', 'Light/Spirit', 'ghost', 'myth', [100, 100, 100, 100, 100, 100], 'serene', 'wisp_wish', 'A', 'A tiny mythical spirit that grants a single wish to those with pure hearts.', ''],
  ['Ignivar', 'Flame/Metal', 'quad', 'leg', [95, 125, 110, 85, 85, 100], 'tough_claws', 'magma_rampart', 'A', 'Forged in the first fire. Only the worthy may face it in the Forgotten Expanse.', ''],
  ['Riftwyrm', 'Dragon/Spirit', 'wyrm', 'leg', [100, 120, 95, 140, 95, 120], 'rift_walker', 'rift_rend', 'V', 'It tore the rifts across Veloria while fleeing a war between worlds.', 'mega:Dragon/Spirit:rift_walker'],
  ['Zephyra', 'Wind/Light', 'bird', 'leg', [90, 90, 90, 130, 100, 130], 'sky_lord', 'zephyr_halo', 'V', 'Circles the Tempest Cliffs. Its halo calms even the fiercest gale.', ''],
  ['Magmaul', 'Flame/Earth', 'golem', 'leg', [110, 140, 120, 80, 90, 60], 'sun_call', 'magma_rampart', 'V', 'Slumbers within the Obsidian Citadel. Its heartbeat is Veloria\'s volcanic rhythm.', ''],
  ['Auroryx', 'Ice/Light', 'deer', 'leg', [90, 80, 100, 130, 130, 90], 'snow_call', 'aurora_lance', 'V', 'The auroras of the tundra are said to be its breath frozen in the sky.', ''],
  ['Gloomaw', 'Shadow/Venom', 'serpent', 'leg', [100, 130, 90, 110, 90, 100], 'toxic_skin', 'gloom_plague', 'V', 'A creature of the deep Gloamwood that devours light and leaves only spores.', ''],
  ['Verdigon', 'Metal/Nature', 'mech', 'leg', [100, 125, 125, 80, 110, 80], 'iron_will', 'verdant_engine', 'V', 'A colossal construct of copper and vine from the Verdigris Ruins.', ''],
  ['Nihilux', 'Shadow/Psychic', 'orb', 'sec', [110, 130, 110, 150, 110, 110], 'pressure_aura', 'void_lance', 'A', 'A void left behind when the Aether Heart was first split. It seeks to be whole.', ''],
  ['Omnirift', 'Normal/Dragon', 'dragon', 'sec', [120, 130, 120, 130, 120, 120], 'adaptive', 'omni_genesis', 'V', 'The origin of all creatures. Reassembled only when every Star Shard is found.', ''],
];

// =====================================================================================
// BUILDER
// =====================================================================================
MB.SPECIES = []; // index = dex number - 1
MB.SP = {}; // by key
(function buildSpecies() {
  const ARCH = {
    bal: [1, 1, 1, 1, 1, 1], phys: [1, 1.45, 1, 0.6, 0.8, 1.1], spec: [0.9, 0.6, 0.8, 1.45, 1.1, 1.1], tank: [1.25, 1.1, 1.45, 0.6, 1, 0.6],
    speed: [0.85, 1.15, 0.75, 1, 0.75, 1.55], glass: [0.7, 0.8, 0.6, 1.55, 0.8, 1.55], wall: [1.45, 0.6, 1.3, 0.7, 1.35, 0.55],
    mixed: [1, 1.2, 0.9, 1.2, 0.9, 1.05], bulk: [1.35, 1.35, 1.1, 0.75, 0.9, 0.65], spdef: [1.1, 0.8, 0.95, 1.1, 1.45, 0.75],
  };
  const BST = { 1: [455], 2: [292, 470], 3: [298, 405, 525] };
  const RAR_BST = { c: 0.93, u: 1, r: 1.06, vr: 1.12, anc: 1.06 };
  const CATCH = { c: [200, 120, 45], u: [160, 90, 45], r: [70, 45, 30], vr: [30, 25, 15], anc: [45, 30, 20], leg: [3], myth: [3], sec: [3] };
  const ABIL_BY_TYPE = {
    Normal: ['run_away', 'pickup', 'scrappy', 'grit', 'technique'], Flame: ['ember_hide', 'absorb_flame', 'sun_dancer', 'magma_armor', 'kindle_heart'],
    Aqua: ['swift_current', 'absorb_aqua', 'rain_dish', 'tidal_heart', 'thick_blubber'], Nature: ['regrowth', 'harvest', 'verdant_heart', 'shed_shell', 'calm_spirit'],
    Electric: ['static_fur', 'absorb_volt', 'storm_heart', 'quick_feet', 'overcharge'], Earth: ['sand_veil', 'bedrock', 'steadfast', 'sand_call', 'tough_claws'],
    Wind: ['hover', 'momentum', 'keen_edge', 'sharp_eyes', 'sky_lord'], Ice: ['ice_body', 'snow_call', 'thick_blubber', 'frost_coat', 'insomnia'],
    Shadow: ['menace', 'insomnia', 'moxie', 'dark_aura', 'keen_edge'], Light: ['serene', 'calm_spirit', 'radiant_aura', 'inner_focus', 'magma_armor'],
    Metal: ['iron_will', 'steadfast', 'tough_claws', 'bedrock', 'technique'], Psychic: ['inner_focus', 'sharp_eyes', 'serene', 'mega_launcher', 'insomnia'],
    Venom: ['toxic_skin', 'poison_claws', 'immunity', 'shed_shell', 'quick_feet'], Dragon: ['dragon_scale', 'moxie', 'menace', 'attunement', 'inner_focus'],
    Spirit: ['hover', 'calm_spirit', 'pressure_aura', 'serene', 'insomnia'],
  };
  const EGG_GROUP = {
    fox: 'field', quad: 'field', cat: 'field', deer: 'field', bear: 'field', rodent: 'field', sheep: 'field', hedgehog: 'field', horse: 'field', armadillo: 'field', hippo: 'field', seal: 'water',
    bird: 'flying', bat: 'flying', fish: 'water', dolphin: 'water', shark: 'water', whale: 'water', seahorse: 'water', jelly: 'water', frog: 'water', crab: 'water', turtle: 'water', shell: 'water', star: 'water', coral: 'water',
    insect: 'bug', moth: 'bug', beetle: 'bug', spider: 'bug', cocoon: 'bug', plant: 'grass', mushroom: 'grass', tree: 'grass', golem: 'mineral', mech: 'mineral', sword: 'mineral', chest: 'mineral',
    ghost: 'amorphous', orb: 'amorphous', blob: 'amorphous', cloud: 'amorphous', candle: 'amorphous', dragon: 'dragon', serpent: 'dragon', lizard: 'dragon', wyrm: 'dragon', ape: 'human', biped: 'human',
  };
  const HAB_TEXT = {
    meadow: 'grassy meadows', forest: 'deep forests', mountain: 'rocky mountainsides', cave: 'dark caves', lake: 'calm lakes', sea: 'the open sea', beach: 'sunny beaches',
    marsh: 'murky swamps', desert: 'scorching deserts', snow: 'snowfields', volcano: 'volcanic slopes', ruins: 'ancient ruins', sky: 'high cliffs and clouds', city: 'busy cities',
    factory: 'factories and power plants', observatory: 'starlit plateaus', caldera: 'the deep caldera', none: 'the care of researchers',
    v_field: 'Velorian plains', v_wood: 'the Gloamwood', v_beach: 'Velorian coasts', v_lake: 'Riftwater Lake', v_cliff: 'the Tempest Cliffs', v_dunes: 'the Mirage Dunes',
    v_tundra: 'the Auroral Tundra', v_cave: 'crystal caverns', v_volcano: 'the obsidian wastes', v_ruins: 'the Verdigris Ruins', v_city: 'Velorian towns', v_rift: 'Aether rifts',
  };
  const TYPE_FLAVOR = {
    Normal: ['adapts to almost any environment', 'is fiercely loyal to its friends', 'has boundless curiosity'],
    Flame: ['keeps a fire burning in its belly', 'leaves scorched footprints behind', 'glows brighter when its spirit rises'],
    Aqua: ['can hold its breath for an hour', 'sprays jets of water when startled', 'rides currents for miles'],
    Nature: ['soaks up sunlight through its leaves', 'sprouts flowers when it is happy', 'can speak with the trees'],
    Electric: ['stores static in its fur', 'crackles with sparks when excited', 'feeds on lightning storms'],
    Earth: ['can burrow through solid rock', 'feels tremors from miles away', 'hardens its hide with minerals'],
    Wind: ['rides thermals without flapping', 'whistles when it flies fast', 'can predict storms a day ahead'],
    Ice: ['breathes a freezing mist', 'grows icicles on its back in winter', 'cannot bear warm weather'],
    Shadow: ['hides in shadows to ambush prey', 'becomes active only after dark', 'is said to steal dreams'],
    Light: ['glows softly in the dark', 'gathers sunlight in its body', 'chases away nightmares'],
    Metal: ['has a body hard as steel', 'polishes itself constantly', 'magnetizes nearby metal'],
    Psychic: ['can read the thoughts of others', 'floats when concentrating', 'sees glimpses of the future'],
    Venom: ['oozes a toxic fluid', 'is brightly colored to warn predators', 'brews poisons in its glands'],
    Dragon: ['is said to live for centuries', 'is proud and hard to tame', 'carries ancient power in its scales'],
    Spirit: ['drifts between this world and the next', 'is the lingering will of something ancient', 'can pass through walls'],
  };
  const BODY_TEXT = {
    fox: 'Its bushy tail', quad: 'Its sturdy legs', cat: 'Its silent paws', deer: 'Its antlers', bear: 'Its mighty paws', rodent: 'Its twitching whiskers', bird: 'Its wings', bat: 'Its sonar',
    fish: 'Its fins', dolphin: 'Its powerful tail', shark: 'Its rows of teeth', whale: 'Its enormous body', seahorse: 'Its curled tail', jelly: 'Its tentacles', frog: 'Its springy legs', crab: 'Its pincers',
    turtle: 'Its shell', shell: 'Its pearl', star: 'Its core', coral: 'Its branches', insect: 'Its antennae', moth: 'Its scaled wings', beetle: 'Its carapace', spider: 'Its silk', cocoon: 'Its hard shell',
    plant: 'Its petals', mushroom: 'Its cap', tree: 'Its bark', golem: 'Its stone body', mech: 'Its gears', sword: 'Its blade', chest: 'Its lid', ghost: 'Its wispy form', orb: 'Its glowing core',
    blob: 'Its gooey body', cloud: 'Its fluffy body', candle: 'Its flame', dragon: 'Its scales', serpent: 'Its long body', lizard: 'Its tail', wyrm: 'Its coils', ape: 'Its strong arms', biped: 'Its posture',
    sheep: 'Its wool', hedgehog: 'Its quills', horse: 'Its mane', armadillo: 'Its armored plates', hippo: 'Its huge jaws', seal: 'Its blubber',
  };
  const BODY_TEXT2 = ['can sense danger long before it arrives.', 'is prized by collectors across the region.', 'changes color with its mood.', 'leaves behind a faint trail of Aether.', 'is used to communicate with its herd.', 'grows stronger with every battle.', 'is surprisingly delicate.', 'is a sign of its age.'];

  let dex = 0;
  function evoParse(tok) {
    if (!tok) return null;
    if (/^\d+$/.test(tok)) return { m: 'level', v: +tok };
    if (/^n\d+$/.test(tok)) return { m: 'level', v: +tok.slice(1), time: 'night' };
    if (/^d\d+$/.test(tok)) return { m: 'level', v: +tok.slice(1), time: 'day' };
    if (tok === 'f') return { m: 'friend' };
    if (tok === 'fn') return { m: 'friend', time: 'night' };
    if (tok === 'fd') return { m: 'friend', time: 'day' };
    if (tok.startsWith('i:')) return { m: 'item', v: tok.slice(2) };
    if (tok === 't') return { m: 'item', v: 'bond_cord' };
    if (tok.startsWith('loc:')) { const p = tok.split(':'); return { m: 'loc', v: p[1], lvl: +p[2] || 1 }; }
    if (tok.startsWith('q:')) return { m: 'quest', v: tok.slice(2) };
    return null;
  }
  function makeStats(arch, total, seed) {
    const w = ARCH[arch] || ARCH.bal;
    const r = new MB.RNG(seed);
    const ww = w.map((x) => x * r.range(0.88, 1.12));
    const sum = ww.reduce((a, b) => a + b, 0);
    const s = ww.map((x) => Math.max(15, Math.round((x / sum) * total)));
    return { hp: s[0], atk: s[1], def: s[2], spa: s[3], spd: s[4], spe: s[5] };
  }
  function pickAbilities(types, seed, override) {
    const r = new MB.RNG(seed + 'ab');
    const pool = [...(ABIL_BY_TYPE[types[0]] || []), ...(ABIL_BY_TYPE[types[1]] || [])];
    const a1 = override || r.pick(pool);
    let a2 = r.pick(pool); if (a2 === a1) a2 = r.pick(pool);
    let h = r.pick(pool); let guard = 0; while ((h === a1 || h === a2) && guard++ < 10) h = r.pick(pool);
    return [a1, a2, h];
  }
  function moveValue(m) { return m.cat === 'status' ? 55 : m.power * (m.hits ? (m.hits[0] + m.hits[1]) / 2 : 1) * (m.acc ? m.acc / 100 : 1); }
  function makeLearnset(sp, signature, lineSeed) {
    const r = new MB.RNG(lineSeed + 'learn');
    const types = sp.types;
    let pool = [];
    for (const t of types) pool.push(...MB.movesOfType(t));
    const normals = MB.movesOfType('Normal');
    // coverage type (stable across the evolution line)
    const cover = r.pick(MB.TYPES.filter((t) => !types.includes(t) && t !== 'Normal'));
    const coverMoves = MB.movesOfType(cover).filter((m) => m.cat !== 'status');
    // choose subset
    const own = r.shuffle(pool.slice()).slice(0, 14);
    const extra = [r.pick(normals.filter((m) => m.power > 0 && m.power <= 40)), r.pick(normals.filter((m) => m.cat === 'status')), r.pick(normals.filter((m) => m.power >= 60))];
    const cov = r.shuffle(coverMoves.slice()).slice(0, 2);
    const all = [...new Set([...extra, ...own, ...cov].filter(Boolean))];
    const ls = [];
    const weakestOwn = pool.filter((m) => m.power > 0).sort((a, b) => moveValue(a) - moveValue(b))[0];
    for (const m of all) {
      let lvl;
      if (m.cat === 'status') lvl = r.int(4, 44);
      else lvl = Math.round(MB.clamp((moveValue(m) - 30) / 110, 0, 1) * 58) + r.int(-3, 4);
      lvl = MB.clamp(lvl, 1, 66);
      ls.push([lvl, m.id]);
    }
    if (weakestOwn) ls.push([1, weakestOwn.id]);
    if (signature) ls.push([signature[0], signature[1]]);
    // ensure at least one level-1 damaging Normal move
    ls.push([1, extra[0] ? extra[0].id : 'tackle']);
    // early-level pacing: own-type attacks from Lv6, strong ones later, nasty status from Lv12
    for (const e of ls) {
      const m = MB.MOVES[e[1]];
      if (m.signature) continue;
      if (m.power > 0 && m.type !== 'Normal' && e[0] < 6) e[0] = 6 + (m.power >= 40 ? 2 : 0);
      if (m.power >= 60 && e[0] < 12) e[0] = 12 + Math.floor(m.power / 20);
      if (m.cat === 'status' && m.fx.some((f) => f.t === 'status' && ['slp', 'par', 'tox', 'frz'].includes(f.s)) && e[0] < 12) e[0] = 12 + (e[0] % 5);
      if (m.fx.some((f) => f.t === 'drain' || f.t === 'leech') && e[0] < 9) e[0] = 9;
    }
    // dedupe keep min level
    const best = {};
    for (const [l, id] of ls) if (!(id in best) || best[id] > l) best[id] = l;
    const eggs = r.shuffle(MB.MOVE_LIST.filter((m) => !m.signature && !(m.id in best) && (m.type === cover || m.type === r.pick(MB.TYPES)))).slice(0, 4).map((m) => m.id);
    return { learn: Object.entries(best).map(([id, l]) => [l, id]).sort((a, b) => a[0] - b[0]), eggMoves: eggs, cover };
  }
  function describe(sp, r) {
    const ft = TYPE_FLAVOR[sp.types[0]];
    const f2 = sp.types[1] ? TYPE_FLAVOR[sp.types[1]] : null;
    const a = `It lives in ${HAB_TEXT[sp.habitats[0]] || 'remote places'} and ${r.pick(ft)}.`;
    const b = `${BODY_TEXT[sp.body] || 'Its body'} ${r.pick(BODY_TEXT2)}`;
    const c = f2 ? ` Some say it ${r.pick(f2)}.` : '';
    return a + ' ' + b + c;
  }
  const SIGS = {
    Emberfox: [[17, 'foxfire_waltz'], [36, 'soulfire_nova']], Aquaphin: [[17, 'tidal_leap'], [36, 'leviathan_wave']], Leafling: [[17, 'thicket_lance'], [36, 'world_tree_crash']],
  };
  function addLine(line, region) {
    const [namesS, typesS, bodyS, evoS, arch, habS, rarity, flagsS] = line;
    const flags = (flagsS || '').split(',').filter(Boolean);
    const megaFlag = flags.find((f) => f.startsWith('mega'));
    // expand names into stages with branches
    const stageNames = namesS.split(',').map((s) => s.split('/'));
    const typeParts = typesS.split('|');
    const bodyParts = bodyS.split('|');
    const evoParts = evoS ? evoS.split(',') : [];
    const nStages = stageNames.length;
    const lineKey = stageNames[0][0];
    const lineSpecies = [];
    let typeIdx = 0;
    const habitats = habS.split(',');
    const nightOnly = flags.includes('n'), dayOnly = flags.includes('d');
    for (let st = 0; st < nStages; st++) {
      const branches = stageNames[st];
      for (let bi = 0; bi < branches.length; bi++) {
        const name = branches[bi];
        const tStr = typeParts[Math.min(typeIdx, typeParts.length - 1)];
        typeIdx++;
        const types = tStr.split('/');
        const body = bodyParts[Math.min(st, bodyParts.length - 1)];
        const total = Math.round((BST[nStages] || BST[3])[st] * (RAR_BST[rarity] || 1) * (flags.includes('start') ? 1.08 : 1) * (nStages === 1 && rarity === 'vr' ? 1.12 : 1));
        const sp = {
          id: ++dex, key: name.toLowerCase(), name, types, body, stage: st, nStages, line: lineKey, region,
          base: makeStats(arch, total, name), arch, rarity, habitats, flags, night: nightOnly, day: dayOnly,
          evo: [], prev: null, catchRate: (CATCH[rarity] || CATCH.c)[Math.min(st, (CATCH[rarity] || CATCH.c).length - 1)],
          growth: rarity === 'vr' || rarity === 'anc' ? 'slow' : nStages === 3 ? 'medium' : 'fast', eggGroup: EGG_GROUP[body] || 'field',
          genderRatio: flags.includes('universal') ? -1 : 0.5, seed: MB.hash(name),
        };
        if (flags.includes('universal')) sp.eggGroup = 'universal';
        if (flags.includes('egg') && st === 0) sp.eggOnly = true;
        if (flags.includes('fossil')) sp.fossil = true;
        if (flags.includes('start')) sp.starter = true;
        if (flags.includes('water')) sp.water = true;
        sp.bst = Object.values(sp.base).reduce((a, b) => a + b, 0);
        sp.baseExp = Math.round(sp.bst * (0.18 + 0.06 * st));
        lineSpecies.push({ sp, st, bi });
        MB.SPECIES.push(sp); MB.SP[sp.key] = sp;
      }
    }
    // evolution links
    for (let st = 0; st < nStages - 1; st++) {
      const from = lineSpecies.filter((x) => x.st === st);
      const to = lineSpecies.filter((x) => x.st === st + 1);
      const methods = (evoParts[st] || '').split('/');
      for (const f of from) {
        to.forEach((t, i) => {
          const ev = evoParse(methods[Math.min(i, methods.length - 1)]) || { m: 'level', v: 20 + st * 15 };
          ev.to = t.sp.key;
          f.sp.evo.push(ev);
          t.sp.prev = f.sp.key;
        });
      }
    }
    // learnsets, abilities, descriptions, mega
    const sig = SIGS[lineKey];
    for (const { sp, st } of lineSpecies) {
      let sg = null;
      if (sig) sg = st === 2 ? sig[1] : sig[0];
      const L = makeLearnset(sp, sg, lineKey + sp.types.join());
      sp.learn = L.learn; sp.eggMoves = L.eggMoves;
      const startAb = sp.starter ? { Flame: 'kindle_heart', Aqua: 'tidal_heart', Nature: 'verdant_heart' }[sp.types[0]] : null;
      sp.abilities = pickAbilities(sp.types, lineKey, startAb);
      sp.desc = describe(sp, new MB.RNG(sp.name + 'desc'));
      if (megaFlag && st === nStages - 1 && lineSpecies.filter((x) => x.st === st).indexOf(lineSpecies.find((x) => x.sp === sp)) === 0) {
        const parts = megaFlag.split(':');
        const mTypes = parts[1] ? parts[1].split('/') : sp.types;
        const w = (ARCH[arch === 'wall' ? 'tank' : arch] || ARCH.bal).slice(1);
        const ws = w.reduce((a, b) => a + b, 0);
        const keys = ['atk', 'def', 'spa', 'spd', 'spe'];
        const mb = Object.assign({}, sp.base);
        let left = 100;
        keys.forEach((k, i) => { const add = Math.max(0, Math.min(40, Math.round((w[i] / ws) * 100), 160 - mb[k])); mb[k] += add; left -= add; });
        mb[sp.base.atk >= sp.base.spa ? 'atk' : 'spa'] += left;
        sp.mega = { name: 'Mega ' + sp.name, types: mTypes, ability: parts[2] || sp.abilities[0], base: mb, stone: sp.key + '_stone' };
      }
    }
  }
  for (const l of MB.LINES_AETHERIA) addLine(l, 'A');
  const aetheriaCommonEnd = dex;
  // Aetheria legendaries
  for (const L of MB.LEGENDS.filter((l) => l[7] === 'A')) addLegend(L);
  MB.DEX_AETHERIA_END = dex;
  for (const l of MB.LINES_VELORIA) addLine(l, 'V');
  for (const L of MB.LEGENDS.filter((l) => l[7] === 'V')) addLegend(L);
  MB.DEX_TOTAL = dex;

  function addLegend(L) {
    const [name, typesS, body, rarity, b, abil, sig, region, lore, flagsS] = L;
    const types = typesS.split('/');
    const sp = {
      id: ++dex, key: name.toLowerCase(), name, types, body, stage: 2, nStages: 1, line: name, region, legendary: true,
      base: { hp: b[0], atk: b[1], def: b[2], spa: b[3], spd: b[4], spe: b[5] }, arch: 'bal', rarity, habitats: ['none'], flags: (flagsS || '').split(','),
      evo: [], prev: null, catchRate: 3, growth: 'slow', eggGroup: 'none', genderRatio: -1, seed: MB.hash(name), desc: lore,
    };
    sp.bst = Object.values(sp.base).reduce((a, c) => a + c, 0);
    sp.baseExp = Math.round(sp.bst * 0.5);
    sp.abilities = [abil, abil, abil];
    const Ls = makeLearnset(sp, [50, sig], name);
    sp.learn = Ls.learn.map(([l, id]) => [Math.max(1, Math.round(l * 0.9)), id]);
    sp.eggMoves = [];
    const mf = sp.flags.find((f) => f.startsWith('mega'));
    if (mf) {
      const p = mf.split(':');
      sp.mega = { name: 'Mega ' + name, types: p[1].split('/'), ability: p[2], stone: sp.key + '_stone', base: { hp: b[0], atk: b[1] + 25, def: b[2] + 15, spa: b[3] + 25, spd: b[4] + 15, spe: b[5] + 20 } };
    }
    MB.SPECIES.push(sp); MB.SP[sp.key] = sp;
  }
  MB.MEGA_SPECIES = MB.SPECIES.filter((s) => s.mega);
})();

// Hand-tuned early learnsets for the three starters (levels 1-14), so the opening is fair and fun.
(function () {
  const EARLY = {
    emberfox: [[1, 'scratch'], [1, 'growl'], [4, 'ember'], [8, 'quick_dash'], [11, 'smolder'], [14, 'flame_fang']],
    aquaphin: [[1, 'tackle'], [1, 'tail_wag'], [4, 'bubble_jet'], [8, 'aqua_jet'], [11, 'brine_spray'], [14, 'water_pulse']],
    leafling: [[1, 'tackle'], [1, 'growl'], [4, 'vine_lash'], [8, 'leech_seed'], [11, 'razor_leaf'], [14, 'bark_shield']],
  };
  for (const k in EARLY) {
    const sp = MB.SP[k];
    sp.learn = EARLY[k].concat(sp.learn.filter(([l, id]) => l > 14 && !EARLY[k].some((e) => e[1] === id))).sort((a, b) => a[0] - b[0]);
  }
})();
MB.species = (k) => (typeof k === 'number' ? MB.SPECIES[k - 1] : MB.SP[k]);
MB.firstStage = function (key) { let s = MB.SP[key]; while (s && s.prev) s = MB.SP[s.prev]; return s; };
MB.evoChain = function (key) {
  const root = MB.firstStage(key);
  const out = [];
  (function walk(s, depth) { out.push({ sp: s, depth }); for (const e of s.evo) walk(MB.SP[e.to], depth + 1); })(root, 0);
  return out;
};
MB.evoText = function (e) {
  switch (e.m) {
    case 'level': return `Lv. ${e.v}${e.time ? ' (' + e.time + ')' : ''}`;
    case 'friend': return `High friendship${e.time ? ' (' + e.time + ')' : ''}`;
    case 'item': return `Use ${MB.ITEMS && MB.ITEMS[e.v] ? MB.ITEMS[e.v].name : e.v}`;
    case 'loc': return `Level up in a ${e.v} area (Lv. ${e.lvl}+)`;
    case 'quest': return { caught_sylvarch: 'Level up after befriending Sylvarch', shard_starfall: 'Level up after finding the Starfall shard' }[e.v] || 'Special quest';
  }
  return '?';
};
