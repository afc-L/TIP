'use strict';
// Move database. Format: "Name|power|accuracy|category(P/S/X)|pp|effects"
// effects (comma separated): status:chance (brn psn tox par slp frz cnf stn), st:stat+n (self),
// ts:stat-n[@chance] (target), heal:%, drain:%, recoil:%, pri:n, hits:a-b, crit, protect,
// weather:x, fixed, rest, cure, clear, leech, pivot, ohko-proof etc.
MB.MOVE_TEXT = {
  Normal: [
    'Tackle|40|100|P|35|', 'Scratch|40|100|P|35|', 'Quick Dash|40|100|P|30|pri:1', 'Headbutt Rush|70|100|P|15|stn:30',
    'Body Slam|85|100|P|15|par:30', 'Fury Swipes|18|80|P|15|hits:2-5', 'Crushing Blow|120|100|P|10|recoil:33', 'Hyper Roar|150|90|S|5|recoil:25',
    'Echo Shout|90|100|S|10|', 'Tri Beam|80|100|S|10|brn:7,par:7,frz:7', 'Growl|0|100|X|40|ts:atk-1', 'Tail Wag|0|100|X|30|ts:def-1',
    'Battle Focus|0|0|X|20|st:atk+2', 'Recover|0|0|X|10|heal:50', 'Guard Up|0|0|X|10|protect', 'Lullaby|0|55|X|15|slp:100',
    'Supersonic Hum|0|55|X|20|cnf:100', 'Rest|0|0|X|10|rest', 'Swift Star|60|0|S|20|', 'Slam Dunk|80|75|P|20|',
    'Gigaton Press|100|90|P|10|ts:def-1@30', 'Rally Cry|0|0|X|15|st:atk+1,st:spe+1', 'Last Stand|0|0|X|5|clear,heal:25',
  ],
  Flame: [
    'Ember|40|100|S|25|brn:10', 'Flame Fang|65|95|P|15|brn:10,stn:10', 'Fire Spin|35|85|S|15|brn:30', 'Flamethrower|90|100|S|15|brn:10',
    'Inferno Blast|110|85|S|5|brn:30', 'Blaze Kick|85|90|P|10|crit,brn:10', 'Flare Rush|120|100|P|15|recoil:33,brn:10', 'Heat Wave|95|90|S|10|brn:10',
    'Kindle|0|0|X|20|st:spa+1,st:spe+1', 'Sunny Rite|0|0|X|5|weather:sun', 'Will-o-Flame|0|85|X|15|brn:100', 'Ember Shower|25|100|S|20|hits:2-4',
    'Magma Surge|100|90|S|10|ts:spd-1@20', 'Cinder Claw|75|100|P|15|crit', 'Phoenix Pyre|130|90|S|5|st:spa-2', 'Smolder|60|100|S|20|ts:atk-1@50',
    'Flame Charge|50|100|P|20|st:spe+1', 'Solar Flare|150|90|S|5|recoil:40', 'Hearth Glow|0|0|X|10|heal:50', 'Searing Coil|80|100|P|10|brn:20',
  ],
  Aqua: [
    'Bubble Jet|40|100|S|30|ts:spe-1@10', 'Aqua Jet|40|100|P|20|pri:1', 'Water Pulse|60|100|S|20|cnf:20', 'Tidal Crash|90|100|P|10|stn:20',
    'Hydro Cannon|110|80|S|5|', 'Surf Wave|90|100|S|15|', 'Riptide Fang|80|95|P|15|crit', 'Whirlpool|35|85|S|15|hits:2-3',
    'Rain Dance|0|0|X|5|weather:rain', 'Soak Shield|0|0|X|20|st:def+1,st:spd+1', 'Aqua Ring|0|0|X|20|heal:30', 'Brine Spray|65|100|S|10|',
    'Abyssal Drop|100|90|P|10|ts:def-1@30', 'Geyser|120|85|S|5|', 'Mist Veil|0|0|X|20|st:spd+2', 'Torrent Lance|85|100|P|10|',
    'Tsunami Fury|150|90|S|5|st:spa-2', 'Splash Flip|0|0|X|40|st:eva+1', 'Coral Spikes|70|100|P|15|ts:def-1@20', 'Siphon|70|100|S|15|drain:50',
  ],
  Nature: [
    'Vine Lash|45|100|P|25|', 'Leaf Blade|90|100|P|15|crit', 'Razor Leaf|55|95|P|25|crit', 'Seed Volley|25|100|P|30|hits:2-5',
    'Mega Drain|40|100|S|15|drain:50', 'Giga Drain|75|100|S|10|drain:50', 'Petal Storm|120|100|S|10|cnf:30', 'Solar Beam|130|100|S|5|',
    'Sleep Spores|0|75|X|15|slp:100', 'Stun Pollen|0|75|X|30|par:100', 'Leech Seed|0|90|X|10|leech', 'Growth|0|0|X|20|st:atk+1,st:spa+1',
    'Bark Shield|0|0|X|15|st:def+2', 'Synthesis|0|0|X|10|heal:50', 'Wood Hammer|120|100|P|15|recoil:33', 'Thorn Whip|70|100|P|15|ts:spe-1@30',
    'Bloom Burst|95|100|S|10|ts:spd-1@20', 'Root Crush|85|100|P|10|', 'Verdant Wrath|110|90|S|5|heal:15', 'Pollen Haze|60|100|S|20|cnf:20',
  ],
  Electric: [
    'Spark|40|100|S|30|par:10', 'Shock Fang|65|95|P|15|par:10,stn:10', 'Volt Bolt|90|100|S|15|par:10', 'Thunderstrike|110|70|S|10|par:30',
    'Wild Current|90|100|P|15|recoil:25', 'Static Web|0|90|X|20|par:100', 'Charge Up|0|0|X|20|st:spd+1,st:spa+1', 'Arc Pivot|70|100|S|20|pivot',
    'Discharge Nova|80|100|S|15|par:30', 'Volt Tackle Rush|120|100|P|15|recoil:33,par:10', 'Ion Lance|85|100|P|10|crit', 'Zap Cannon|120|60|S|5|par:100',
    'Overload|0|0|X|10|st:spa+2', 'Storm Coil|100|90|S|10|ts:spe-1@30', 'Static Claw|75|100|P|15|par:20', 'Thunder Fang Barrage|20|100|P|20|hits:2-5',
    'Plasma Burst|130|90|S|5|st:spa-2', 'Magnet Lift|0|0|X|10|st:eva+1,st:spe+1', 'Jolt|30|100|S|30|pri:1',
  ],
  Earth: [
    'Mud Slap|20|100|S|10|ts:acc-1', 'Rock Toss|50|90|P|15|stn:10', 'Earthshaker|100|100|P|10|', 'Mud Bomb|65|85|S|10|ts:acc-1@30',
    'Sand Tomb|35|85|P|15|hits:2-3', 'Stone Edge|100|80|P|5|crit', 'Rock Slide|75|90|P|10|stn:30', 'Dig Strike|80|100|P|10|',
    'Earth Power|90|100|S|10|ts:spd-1@10', 'Sandstorm|0|0|X|10|weather:sand', 'Stealth Rocks|0|0|X|20|st:def+1', 'Bulk Up|0|0|X|20|st:atk+1,st:def+1',
    'Head Smash|150|80|P|5|recoil:50', 'Bone Club|65|85|P|20|stn:10', 'Tectonic Slam|120|85|P|5|ts:spe-1@50', 'Quicksand|0|100|X|20|ts:spe-2',
    'Ancient Power|60|100|S|5|st:atk+1@10,st:def+1@10,st:spa+1@10,st:spd+1@10,st:spe+1@10', 'Boulder Roll|30|90|P|20|hits:2-5', 'Fissure Burst|110|90|S|5|',
  ],
  Wind: [
    'Gust|40|100|S|35|', 'Wing Slash|60|100|P|35|', 'Air Cutter|60|95|S|25|crit', 'Air Slash|75|95|S|15|stn:30',
    'Sky Dive|90|95|P|15|', 'Hurricane|110|70|S|10|cnf:30', 'Brave Talon|120|100|P|15|recoil:33', 'Tailwind|0|0|X|15|st:spe+2',
    'Feather Dance|0|100|X|15|ts:atk-2', 'Cyclone|80|100|S|15|', 'Roost|0|0|X|10|heal:50', 'Gale Lance|85|100|P|10|crit',
    'Zephyr Pivot|70|100|P|20|pivot', 'Sonic Gale|100|90|S|10|ts:spe-1@30', 'Wind Blades|25|100|P|20|hits:2-5', 'Peck|35|100|P|35|',
    'Tempest Fury|140|90|S|5|st:spa-2', 'Updraft|0|0|X|20|st:spa+1,st:spe+1',
  ],
  Ice: [
    'Powder Snow|40|100|S|25|frz:10', 'Ice Shard|40|100|P|30|pri:1', 'Ice Fang|65|95|P|15|frz:10,stn:10', 'Frost Beam|90|100|S|10|frz:10',
    'Blizzard|110|70|S|5|frz:20', 'Icicle Crash|85|90|P|10|stn:30', 'Hail Rite|0|0|X|10|weather:snow', 'Frozen Mist|0|0|X|20|st:def+1,st:spd+1',
    'Aurora Ray|65|100|S|20|ts:atk-1@30', 'Glacial Lance|120|100|P|5|', 'Icicle Spear|25|100|P|30|hits:2-5', 'Freeze Dry|70|100|S|20|frz:10',
    'Cold Snap|0|90|X|15|ts:spe-2', 'Permafrost|100|90|P|10|ts:spe-1@50', 'Snowball Barrage|20|100|S|20|hits:2-5', 'Absolute Zero|130|85|S|5|frz:30',
    'Glacier Shell|0|0|X|10|st:def+2',
  ],
  Shadow: [
    'Bite|60|100|P|25|stn:30', 'Shadow Claw|70|100|P|15|crit', 'Night Slash|70|100|P|15|crit', 'Dark Pulse|80|100|S|15|stn:20',
    'Crunch|80|100|P|15|ts:def-1@20', 'Foul Play|95|100|P|15|', 'Nasty Plot|0|0|X|20|st:spa+2', 'Snarl|55|95|S|15|ts:spa-1',
    'Sucker Strike|70|100|P|5|pri:1', 'Umbral Wave|110|85|S|5|ts:spd-1@30', 'Eclipse Fang|100|95|P|10|stn:20', 'Taunting Gaze|0|100|X|20|ts:spd-2',
    'Hex Shroud|0|0|X|15|st:eva+1', 'Night Terror|0|80|X|10|slp:100', 'Dread Rush|120|100|P|10|recoil:33', 'Gloom Drain|75|100|S|10|drain:50',
    'Void Lance|130|90|S|5|st:spa-2', 'Pickpocket Jab|40|100|P|20|pri:1', 'Shadow Feint|35|100|P|25|ts:def-1@50',
  ],
  Light: [
    'Flash|40|100|S|30|ts:acc-1@20', 'Prism Ray|80|100|S|15|cnf:20', 'Radiant Strike|70|100|P|15|', 'Holy Lance|90|100|P|10|crit',
    'Sunbeam|90|100|S|15|', 'Dazzle|0|90|X|20|ts:acc-2', 'Halo|0|0|X|10|heal:50', 'Luster Burst|100|90|S|10|ts:spd-1@40',
    'Moonblast|95|100|S|15|ts:spa-1@30', 'Glimmer Dust|25|100|S|20|hits:2-5', 'Blessing|0|0|X|10|cure,heal:25', 'Aurora Veil|0|0|X|10|st:def+1,st:spd+1',
    'Celestial Ray|120|90|S|5|', 'Gleam Kick|85|95|P|10|par:10', 'Daybreak|140|90|S|5|st:spa-2', 'Shine Charge|0|0|X|20|st:spa+1,st:spd+1',
    'Sparkle Tap|40|100|P|30|pri:1', 'Dawn Burst|70|100|S|15|drain:30',
  ],
  Metal: [
    'Iron Head|80|100|P|15|stn:30', 'Metal Claw|50|95|P|35|st:atk+1@10', 'Steel Beam|140|95|S|5|recoil:50', 'Flash Cannon|80|100|S|10|ts:spd-1@10',
    'Iron Defense|0|0|X|15|st:def+2', 'Bullet Punch|40|100|P|30|pri:1', 'Gear Grind|50|85|P|15|hits:2', 'Meteor Mash|90|90|P|10|st:atk+1@20',
    'Mirror Shot|65|85|S|10|ts:acc-1@30', 'Autotomize|0|0|X|15|st:spe+2', 'Smart Strike|70|0|P|10|', 'Heavy Slam|100|90|P|10|',
    'Shift Gear|0|0|X|10|st:atk+1,st:spe+1', 'Chrome Lance|120|85|P|5|crit', 'Magnet Bomb|60|0|S|20|', 'Alloy Storm|100|90|S|10|ts:def-1@30',
    'Iron Wall|0|0|X|5|protect',
  ],
  Psychic: [
    'Confusion|50|100|S|25|cnf:10', 'Psybeam|65|100|S|20|cnf:10', 'Psychic Blast|90|100|S|10|ts:spd-1@10', 'Mind Crush|120|90|S|5|',
    'Zen Strike|80|90|P|15|stn:20', 'Psycho Cut|70|100|P|20|crit', 'Calm Mind|0|0|X|20|st:spa+1,st:spd+1', 'Hypnosis|0|60|X|20|slp:100',
    'Barrier|0|0|X|20|st:def+2', 'Amnesia|0|0|X|20|st:spd+2', 'Dream Eater|100|100|S|15|drain:50', 'Future Sight|120|100|S|10|',
    'Mind Lance|85|100|P|10|', 'Agility|0|0|X|30|st:spe+2', 'Teleport Strike|40|100|S|20|pri:1', 'Psystorm|130|90|S|5|st:spa-2',
    'Mind Reader|0|0|X|10|st:acc+2,st:spa+1', 'Rest Trance|0|0|X|10|heal:50',
  ],
  Venom: [
    'Poison Sting|15|100|P|35|psn:30', 'Acid Spray|40|100|S|20|ts:spd-2', 'Sludge Bomb|90|100|S|10|psn:30', 'Poison Jab|80|100|P|20|psn:30',
    'Toxic|0|90|X|10|tox:100', 'Venoshock|65|100|S|10|', 'Gunk Shot|120|80|P|5|psn:30', 'Acid Armor|0|0|X|20|st:def+2',
    'Smog Cloud|30|70|S|20|psn:40', 'Cross Poison|70|100|P|20|crit,psn:10', 'Toxic Fang|65|95|P|15|tox:20', 'Miasma|100|90|S|10|psn:20',
    'Coil Up|0|0|X|20|st:atk+1,st:def+1,st:acc+1', 'Corrode|80|100|S|15|ts:def-1@30', 'Stinger Barrage|25|100|P|20|hits:2-5', 'Plague Wave|130|90|S|5|tox:30',
    'Noxious Drain|70|100|S|10|drain:50',
  ],
  Dragon: [
    'Dragon Breath|60|100|S|20|par:30', 'Dragon Claw|80|100|P|15|', 'Dragon Pulse|85|100|S|10|', 'Draco Meteor|130|90|S|5|st:spa-2',
    'Outrage|120|100|P|10|cnf:100self', 'Dragon Dance|0|0|X|20|st:atk+1,st:spe+1', 'Dragon Rush|100|80|P|10|stn:20', 'Twin Scales|40|90|P|20|hits:2',
    'Wyrm Tail|60|90|P|10|', 'Scale Shot|25|90|P|20|hits:2-5', 'Dual Wingbeat|40|90|P|10|hits:2', 'Roar of Ages|100|100|S|10|ts:atk-1@30',
    'Ancient Fang|90|100|P|10|crit', 'Dragon Ascent|120|100|P|5|st:def-1', 'Wyrmfire|95|95|S|10|brn:20', 'Scale Armor|0|0|X|10|st:def+1,st:spd+1',
  ],
  Spirit: [
    'Astonish|30|100|P|15|stn:30', 'Shadow Ball|80|100|S|15|ts:spd-1@20', 'Spirit Claw|70|100|P|15|crit', 'Phantom Strike|90|100|P|10|',
    'Curse Mark|0|100|X|10|leech', 'Hex|65|100|S|10|', 'Soul Drain|75|100|S|10|drain:50', 'Wisp Fire|0|85|X|15|brn:100',
    'Ectoplasm|100|90|S|10|psn:20', 'Spectral Veil|0|0|X|20|st:eva+1,st:spd+1', 'Poltergeist|110|90|P|5|', 'Ghostly Wail|90|100|S|10|cnf:20',
    'Night Shade|0|100|S|15|fixed', 'Grave Rise|0|0|X|10|heal:50', 'Spirit Lance|130|90|S|5|st:spa-2', 'Ethereal Tap|40|100|P|30|pri:1',
    'Soulbind|85|100|S|10|stn:20',
  ],
};

// Signature moves for starters, legendaries, megas and bosses
MB.SIGNATURE_MOVES = [
  'Foxfire Waltz|Flame|95|100|S|10|brn:30,st:spe+1@30', 'Tidal Leap|Aqua|95|100|P|10|st:atk+1@30', 'Thicket Lance|Nature|95|100|P|10|crit,leechhit',
  'Soulfire Nova|Flame|130|95|S|5|brn:50', 'Leviathan Wave|Aqua|130|95|S|5|', 'World Tree Crash|Nature|130|95|P|5|heal:25',
  'Solar Crown|Light|140|95|S|5|', 'Eclipse Howl|Shadow|140|95|S|5|ts:spd-1@50', 'Aether Pulse|Psychic|150|100|S|5|',
  'Phoenix Dive|Flame|120|95|P|5|brn:30', 'Glacier Wing|Ice|120|95|S|5|frz:30', 'Storm Crest|Electric|120|95|S|5|par:30',
  'Titan Fist|Earth|130|90|P|5|stn:30', 'Coral Requiem|Aqua|120|100|S|5|heal:25', 'Grove Anthem|Nature|120|100|S|5|cure,heal:25',
  'Lunar Chorus|Psychic|110|100|S|5|slp:20', 'Chrono Shift|Metal|120|100|S|5|st:spe+1', 'Wisp Wish|Light|0|0|X|5|heal:100',
  'Abyss Maw|Aqua|140|90|P|5|stn:30', 'Rift Rend|Dragon|150|90|S|5|', 'Zephyr Halo|Wind|120|100|S|5|st:spe+1',
  'Magma Rampart|Flame|120|95|P|5|st:def+1', 'Aurora Lance|Ice|125|95|S|5|frz:20', 'Gloom Plague|Venom|125|95|S|5|tox:50',
  'Verdant Engine|Metal|125|95|P|5|st:atk+1', 'Omni Genesis|Normal|160|100|S|5|', 'Mega Flare|Flame|150|90|S|5|brn:50',
  'Mega Torrent|Aqua|150|90|S|5|', 'Mega Bloom|Nature|150|90|S|5|drain:30', 'Syndicate Ray|Shadow|120|100|S|5|ts:spd-1@40',
];

MB.MOVES = {}; MB.MOVE_LIST = [];
(function build() {
  function parse(name, type, pow, acc, cat, pp, eff) {
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const m = { id, name, type, power: +pow, acc: +acc, cat: { P: 'phys', S: 'spec', X: 'status' }[cat], pp: +pp, fx: [] , contact: cat === 'P' };
    if (eff) for (const e of eff.split(',')) {
      if (!e) continue;
      const [k, v] = e.split(':');
      if (['brn', 'psn', 'tox', 'par', 'slp', 'frz', 'cnf', 'stn'].includes(k)) {
        const self = (v || '').endsWith('self');
        m.fx.push({ t: 'status', s: k, ch: parseInt(v) || 100, self });
      } else if (k === 'st' || k === 'ts') {
        const mm = v.match(/([a-z]+)([+-]\d)(?:@(\d+))?/);
        m.fx.push({ t: 'stage', self: k === 'st', stat: mm[1], n: +mm[2], ch: mm[3] ? +mm[3] : 100 });
      } else if (k === 'heal') m.fx.push({ t: 'heal', v: +v });
      else if (k === 'drain') m.fx.push({ t: 'drain', v: +v });
      else if (k === 'recoil') m.fx.push({ t: 'recoil', v: +v });
      else if (k === 'pri') m.priority = +v;
      else if (k === 'hits') { const [a, b] = v.split('-').map(Number); m.hits = [a, b || a]; }
      else if (k === 'crit') m.highCrit = true;
      else if (k === 'protect') m.protect = true;
      else if (k === 'weather') m.fx.push({ t: 'weather', w: v });
      else if (k === 'fixed') m.fixed = true;
      else if (k === 'rest') m.fx.push({ t: 'rest' });
      else if (k === 'cure') m.fx.push({ t: 'cure' });
      else if (k === 'clear') m.fx.push({ t: 'clear' });
      else if (k === 'leech') m.fx.push({ t: 'leech' });
      else if (k === 'leechhit') m.fx.push({ t: 'leech', ch: 30 });
      else if (k === 'pivot') m.pivot = true;
    }
    if (m.acc === 0) m.neverMiss = true;
    MB.MOVES[id] = m; MB.MOVE_LIST.push(m);
    return m;
  }
  for (const type in MB.MOVE_TEXT) for (const line of MB.MOVE_TEXT[type]) {
    const [name, pow, acc, cat, pp, eff] = line.split('|');
    parse(name, type, pow, acc, cat, pp, eff);
  }
  for (const line of MB.SIGNATURE_MOVES) {
    const [name, type, pow, acc, cat, pp, eff] = line.split('|');
    parse(name, type, pow, acc, cat, pp, eff).signature = true;
  }
  MB.MOVES.struggle = { id: 'struggle', name: 'Struggle', type: 'Normal', power: 50, acc: 0, neverMiss: true, cat: 'phys', pp: 1, fx: [{ t: 'recoil', v: 25 }], contact: true };
})();
MB.movesOfType = (t) => MB.MOVE_LIST.filter((m) => m.type === t && !m.signature);
