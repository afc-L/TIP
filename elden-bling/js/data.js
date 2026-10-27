// All the game's content tables: items, enemies, dialogue and jokes.

export const WEAPONS = {
  stick: {
    name: 'Stick of Mild Inconvenience', dmg: 10, speed: 1.1, reach: 2.1, arc: 120,
    desc: 'A stick. It has seen things. Mostly the ground.',
  },
  divorce: {
    name: 'The Divorce Negotiator', dmg: 17, speed: 1.0, reach: 2.5, arc: 125,
    desc: 'A longsword that takes half of everything. Comes with a lawyer\'s business card taped to the hilt.',
  },
  femur: {
    name: 'Femur of a Guy Named Steve', dmg: 15, speed: 1.3, reach: 2.2, arc: 115,
    desc: 'Steve isn\'t using it anymore. Steve has been very understanding about all this.',
  },
  pan: {
    name: 'Frying Pan of Justice', dmg: 24, speed: 0.8, reach: 2.2, arc: 110, stagger: true,
    desc: 'Rarely dropped by goblins who finally learned to cook. Every hit goes BONK. Non-stick, yet everything sticks.',
  },
  severance: {
    name: 'Severance Package', dmg: 33, speed: 0.66, reach: 3.0, arc: 145, stagger: true,
    desc: 'The Unemployed Knight\'s greatsword. Heavy, slow, and it comes with two weeks\' notice.',
  },
  chicken: {
    name: 'Rubber Chicken of Destiny', dmg: 9, speed: 1.65, reach: 2.0, arc: 125, squeak: true,
    desc: 'Squeaks with every hit. Enemies mostly take emotional damage. Farmer Dennis says it was Nugget\'s favourite toy.',
  },
  baguette: {
    name: 'Baguette of Destiny', dmg: 27, speed: 1.0, reach: 2.7, arc: 125,
    desc: 'Hidden in the swamp for centuries. Somehow still fresh. Suspiciously crunchy.',
  },
  umbrella: {
    name: 'Umbrella of Mild Protection', dmg: 14, speed: 1.2, reach: 2.4, arc: 120, def: 0.06,
    desc: 'Blocks rain, sun, and roughly 6% of incoming swords while you carry it.',
  },
  fish: {
    name: 'Wet Fish of Slapping', dmg: 15, speed: 1.5, reach: 2.1, arc: 125, slap: true,
    desc: 'The most disrespectful weapon in the kingdom. Every hit is a personal insult.',
  },
  lance: {
    name: 'Pool Noodle Lance', dmg: 13, speed: 1.2, reach: 3.6, arc: 70,
    desc: 'Incredible reach. Incredibly soft. Enemies are hurt mainly by the implication.',
  },
  spatula: {
    name: 'Spatula of Flipping Out', dmg: 23, speed: 1.2, reach: 2.4, arc: 130, stagger: true,
    desc: 'Gary\'s favourite cooking tool. Flips burgers, pancakes and goblins.',
  },
  cutlass: {
    name: 'Soggy Cutlass', dmg: 26, speed: 1.25, reach: 2.5, arc: 130,
    desc: 'Captain Sogbeard\'s blade. It has been underwater since the Bronze Age and smells like it.',
  },
  scepter: {
    name: 'Scepter of Passive Income', dmg: 29, speed: 0.95, reach: 2.6, arc: 125, lifesteal: 0.12,
    desc: 'Pharaoh Pyramid-Scheme\'s scepter. Every hit pays you back 12% as health. Ask about the referral bonus.',
  },
  icicle: {
    name: 'Icicle of Tough Love', dmg: 31, speed: 0.85, reach: 2.8, arc: 130, frost: true,
    desc: 'The Abominable Snowmom\'s icicle. Hits slow enemies down, like a stern talking-to.',
  },
  sockpuppet: {
    name: 'Sock Puppet of Infinite Wisdom', dmg: 24, speed: 1.4, reach: 2.2, arc: 130,
    desc: 'Sockrates\' finest work. It whispers philosophy while you hit things. Mostly about laundry.',
  },
  hammer: {
    name: 'The Ban Hammer', dmg: 42, speed: 0.55, reach: 2.9, arc: 140, stagger: true,
    desc: 'Removes problems permanently. Found where the moderators hid it, behind a fake wall of ice.',
  },
};

export const ARMOR = {
  pizza: {
    slot: 'body', name: 'Pizza Box Cuirass', def: 0.14,
    desc: 'Armor made from recycled pizza boxes. Grease-resistant. Not really sword-resistant, but it tries its best.',
  },
  bathrobe: {
    slot: 'body', name: 'Bathrobe of Unbothered Comfort', def: 0.07, stamRegen: 0.3,
    desc: 'Fluffy. +30% stamina regeneration, because you refuse to be stressed.',
  },
  colander: {
    slot: 'head', name: 'Colander Helm', def: 0.07,
    desc: 'Lets your brain breathe. Both of your brain cells appreciate the airflow.',
  },
  crown: {
    slot: 'head', name: 'Crown of Participation', def: 0.1, xpBonus: 0.3,
    desc: 'Awarded for showing up. +30% XP, because you deserve it, champ.',
  },
  cone: {
    slot: 'head', name: 'Traffic Cone of Authority', def: 0.09,
    desc: 'Enemies instinctively slow down near you. They don\'t, actually, but you feel important.',
  },
  tricorn: {
    slot: 'head', name: 'Pirate Tricorn', def: 0.08, dmgBonus: 0.1,
    desc: 'Three corners, zero manners. +10% damage. Arr.',
  },
  pyramidhat: {
    slot: 'head', name: 'Pyramid Hat (Not a Scheme)', def: 0.12, coinBonus: 0.3,
    desc: '+30% coins from enemies. Bring two friends and get a free hat. (Do not bring two friends.)',
  },
  wraps: {
    slot: 'body', name: 'Recycled Mummy Wraps', def: 0.13, poisonResist: true,
    desc: 'Lightly used. Makes you immune to poison, since nothing wants to touch you.',
  },
  parka: {
    slot: 'body', name: 'Puffy Parka of Huggability', def: 0.2,
    desc: 'So puffy that swords bounce off. Also people keep hugging you.',
  },
  goldsuit: {
    slot: 'body', name: 'Suit of Pure Bling', def: 0.26, dmgBonus: 0.1,
    desc: 'Solid gold. Blinding in sunlight. +10% damage from sheer confidence.',
  },
};

export const CONSUMABLES = {
  garlic: {
    name: 'Garlic Bread', key: '1',
    desc: 'Heals 45 HP. Repels vampires and also everyone else within six feet.',
  },
  dignity: {
    name: 'Potion of 100% Dignity', key: '2',
    desc: 'Claims to restore 100% of your dignity. Independent lab tests say 2%. Heals 25 HP and doubles stamina regen for 30s.',
  },
  pepper: {
    name: 'Ghost Pepper of Rage', key: '3',
    desc: '+35% damage for 30 seconds. Your tongue files a formal complaint.',
  },
  coconut: {
    name: 'Coconut of Hydration', key: '4',
    desc: 'Heals 70 HP and cures poison. Opening it is the hardest boss in the game.',
  },
  bomb: {
    name: 'Fizzy Soda Bomb', key: '5',
    desc: 'Throw it ahead of you. Explodes for 70 damage in a sticky radius. Shaken, not stirred.',
  },
};

// Lost socks: open-world collectibles for Sockrates.
export const SOCKS = [
  [-30, 95], [52, 34], [-150, 95], [-118, 48], [148, 92], [125, -50], [-90, 136], [95, 134], [-52, -40], [30, -62],
];

export const FLASK = {
  name: 'Flask of Questionable Juice',
  desc: 'Heals a big chunk of HP. Refills at Touch Grass Shrines. Tastes like a dare.',
};

export const SHOP_COUPON = [
  { kind: 'consumable', id: 'coconut', price: 45 },
  { kind: 'consumable', id: 'bomb', price: 70 },
  { kind: 'consumable', id: 'garlic', price: 35 },
  { kind: 'armor', id: 'goldsuit', price: 900, once: true },
  { kind: 'flask', id: 'flask2', price: 450, once: true, name: 'Flask Second Cousin (+1 Flask)', desc: 'The flask family is large and none of them get along.' },
];

export const SHOP = [
  { kind: 'consumable', id: 'garlic', price: 35 },
  { kind: 'consumable', id: 'dignity', price: 55 },
  { kind: 'consumable', id: 'pepper', price: 60 },
  { kind: 'consumable', id: 'bomb', price: 80 },
  { kind: 'armor', id: 'pizza', price: 160, once: true },
  { kind: 'flask', id: 'flask', price: 240, once: true, name: 'Flask Cousin (+1 Flask)', desc: 'Another flask. It\'s the first flask\'s cousin. They don\'t talk.' },
];

// Regular enemy archetypes. Speeds in m/s, times in seconds.
export const ENEMIES = {
  goblin: {
    name: 'Goblin Line Cook', hp: 34, dmg: 11, speed: 3.6, radius: 0.5, height: 1.3,
    detect: 13, lose: 22, leash: 26, range: 1.7, windup: 0.5, active: 0.15, recover: 0.6,
    cooldown: 1.1, xp: 14, coins: [6, 14], rare: { kind: 'weapon', id: 'pan', chance: 0.12 },
    lines: ['BONK TIME!', 'Pan says hello!', 'Order up! It\'s YOU!', 'Me cook you medium-rare!', 'No refunds!'],
  },
  knight: {
    name: 'Angry Knight', hp: 62, dmg: 17, speed: 2.9, radius: 0.55, height: 1.9,
    detect: 14, lose: 24, leash: 28, range: 2.2, windup: 0.7, active: 0.16, recover: 0.75,
    cooldown: 1.3, xp: 26, coins: [12, 24], poise: 1, rare: { kind: 'armor', id: 'bathrobe', chance: 0.1 },
    lines: [
      'Your armor looks like a rental!',
      'Is that a sword or a strongly worded letter?',
      'You walk like a chair with ambitions!',
      'My grandmother hits harder, and she\'s a painting!',
      'Nice roll. Did you trip?',
      'You smell like a participation trophy!',
      'I\'ve seen scarier things in my soup!',
      'Your mother was a hamster! Allegedly!',
    ],
  },
  skeleton: {
    name: 'Clumsy Skeleton', hp: 40, dmg: 13, speed: 3.2, radius: 0.45, height: 1.8,
    detect: 13, lose: 22, leash: 26, range: 1.9, windup: 0.55, active: 0.15, recover: 0.7,
    cooldown: 1.2, xp: 20, coins: [8, 18], trips: true, rare: { kind: 'weapon', id: 'femur', chance: 0.15 },
    lines: ['I have a bone to pick with you!', '*aggressive rattling*', 'Calcium POWER!', 'No body likes me...'],
  },
  frog: {
    name: 'Giant Poison Frog', hp: 52, dmg: 14, speed: 2.4, radius: 0.85, height: 1.4,
    detect: 15, lose: 24, leash: 24, range: 2.0, windup: 0.55, active: 0.15, recover: 0.7,
    cooldown: 1.7, xp: 24, coins: [10, 20], poise: 1, ranged: { min: 4.5, max: 14, windup: 0.75, proj: 'slime', dmg: 12, poison: 3 },
    lines: ['RIBBIT. (threateningly)', 'Croak of DOOM!', 'Ribbit... ribbit... YOU.'],
  },
};

Object.assign(ENEMIES, {
  mummy: {
    name: 'Unwrapped Mummy', hp: 75, dmg: 18, speed: 2.4, radius: 0.5, height: 1.9, poise: 1,
    detect: 13, lose: 24, leash: 28, range: 2.0, windup: 0.75, active: 0.16, recover: 0.8,
    cooldown: 1.3, xp: 30, coins: [14, 26], rare: { kind: 'armor', id: 'pyramidhat', chance: 0.08 }, trips: true,
    lines: ['Mmmmmph!', 'I\'ve been dead for 3000 years and I\'m STILL more fun than you.', 'Hold on, I\'m unravelling...', 'Get out of my sandbox!'],
  },
  cactus: {
    name: 'Hostile Cactus', hp: 55, dmg: 14, speed: 1.6, radius: 0.6, height: 2.0,
    detect: 14, lose: 22, leash: 16, range: 1.9, windup: 0.6, active: 0.15, recover: 0.7,
    cooldown: 1.6, xp: 26, coins: [10, 20], ranged: { min: 3.5, max: 13, windup: 0.7, proj: 'needle', dmg: 9, fan: 3 },
    lines: ['Free hugs!', 'I am a succulent and I WILL succ you.', 'Prick!', 'Water me or FACE ME.'],
  },
  crab: {
    name: 'Crab with a Tiny Knife', hp: 38, dmg: 12, speed: 4.2, radius: 0.6, height: 0.9,
    detect: 12, lose: 22, leash: 24, range: 1.6, windup: 0.4, active: 0.15, recover: 0.55,
    cooldown: 0.9, xp: 18, coins: [8, 18], rare: { kind: 'weapon', id: 'fish', chance: 0.12 },
    lines: ['*aggressive clicking*', 'Snip snip!', 'I\'m not crabby, YOU\'RE crabby!'],
  },
  pirate: {
    name: 'Seasick Pirate', hp: 66, dmg: 17, speed: 3.3, radius: 0.55, height: 1.9, poise: 1,
    detect: 14, lose: 24, leash: 28, range: 2.2, windup: 0.6, active: 0.15, recover: 0.65,
    cooldown: 1.1, xp: 30, coins: [16, 30], rare: { kind: 'armor', id: 'tricorn', chance: 0.1 },
    lines: ['Arr! Ye scurvy... ugh, I think I\'m gonna be sick.', 'Yer mother was a rowboat!', 'Walk the plank! There\'s no plank. Walk anyway!', 'Shiver me... everything. It\'s cold.', 'I\'ve got a hook! Well. A spoon.'],
  },
  snowman: {
    name: 'Snowman with a Grudge', hp: 50, dmg: 12, speed: 2.2, radius: 0.7, height: 1.9,
    detect: 16, lose: 24, leash: 22, range: 1.9, windup: 0.5, active: 0.15, recover: 0.7,
    cooldown: 1.6, xp: 26, coins: [10, 20], ranged: { min: 4, max: 15, windup: 0.65, proj: 'snowball', dmg: 11, chill: 2.5 },
    lines: ['Do you wanna build a... FIGHT?', 'Cold as ice!', 'My nose is a carrot and my heart is VENGEANCE.', 'Snow problem!'],
  },
  yeti: {
    name: 'Yeti Bouncer', hp: 120, dmg: 24, speed: 2.8, radius: 0.9, height: 2.9, poise: 1,
    detect: 14, lose: 24, leash: 26, range: 2.6, windup: 0.9, active: 0.2, recover: 0.95,
    cooldown: 1.5, xp: 48, coins: [22, 40], rare: { kind: 'armor', id: 'parka', chance: 0.08 },
    lines: ['You\'re not on the list.', 'No shoes, no shirt, no SERVICE.', 'RAAAWR. That means "go home".', 'Dress code is: FUR.'],
  },
});

export const UNEMPLOYED = {
  name: 'The Unemployed Knight', title: 'Former Gate Guard, Current Gate Guard (Unpaid)',
  hp: 430, dmg: 22, speed: 3.1, radius: 0.9, height: 2.8, xp: 380, coins: [180, 180],
  intro: 'Oh great. A visitor. Let me guess: you\'re here to take the last thing I have. This gate.',
  lines: [
    'Fifteen years of loyal service! And they replaced me with a SCARECROW!',
    'Do you know how hard it is to put "stood near gate" on a résumé?',
    'I had a pension! A PENSION!',
    'Please hold while I attack you. Your call is important to me.',
    'Nobody\'s hiring knights anymore. It\'s all "remote dungeon work" now.',
    'My landlord is scarier than you!',
    'I have a degree in Applied Swording! It\'s worth NOTHING!',
  ],
  death: 'Finally... early retirement...',
};

export const TOUCHGRASS = {
  name: 'Lord Touchgrass', title: 'Keeper of the Lawn, Holder of the Last Brain Cell',
  hp: 1150, dmg: 28, speed: 2.4, radius: 1.7, height: 6, xp: 1000, coins: [500, 500],
  intro: [
    'WHO DARES WALK UPON MY LAWN?',
    'For FIVE HUNDRED YEARS I have guarded this backyard.',
    'I have not gone inside once. Not for snacks. Not for the bathroom. Do not ask.',
    'I am LORD TOUCHGRASS. And you... you look like you have NEVER touched grass.',
  ],
  taunts: ['GET OFF MY LAWN!', 'This grass has been touched by ME and ME ONLY!', 'You call that mowing?!', 'Respect the petunias!'],
  healRage: ['HEALING?! IN MY BACKYARD?!', 'Oh, you\'re DRINKING now? On MY lawn?!', 'Was that a SNACK? I haven\'t had a snack in 500 YEARS!', 'Stop. Healing. In front of me!'],
  phase2: 'You trampled the petunias. Now... I mow YOU down!',
  death: 'I... I just wanted... someone to visit...',
};

// Open-world bosses. Each uses a mix of shared attack types.
export const REGION_BOSSES = {
  gary: {
    name: 'Gary the Enormous Goblin', title: 'Head Chef of the Grasslands (Self-Appointed)', model: 'gary',
    hp: 520, dmg: 20, speed: 3.3, radius: 1.1, height: 3.0, xp: 300, coins: [220, 220], arena: 15, optional: true,
    drop: 'spatula', proj: 'pan',
    attacks: ['overhead', 'sweep', 'leap', 'barrage'], phase2: ['charge'],
    intro: 'You! You look like you need a SNACK. And by snack I mean a FRYING PAN TO THE FACE.',
    taunts: ['Order up!', 'Who wants seconds?! YOU DO!', 'This is a five-star beating!', 'Kiss the cook! No wait, don\'t.'],
    phase2Line: 'The kitchen is getting HOT! Time for the special!',
    death: 'My... souffle... it fell...',
  },
  pharaoh: {
    name: 'Pharaoh Pyramid-Scheme', title: 'CEO of the Crunchy Desert, Founder of an Exciting Opportunity', model: 'pharaoh',
    hp: 900, dmg: 24, speed: 2.7, radius: 1.3, height: 4.2, xp: 650, coins: [400, 400], arena: 17,
    drop: 'scepter', proj: 'coin', medallion: true,
    attacks: ['sweep', 'fan', 'barrage', 'stomp'], phase2: ['leap', 'charge'],
    intro: 'Have you ever dreamed of being your own boss? Of course you have. Now dream of being DEFEATED by yours!',
    taunts: ['Invest in my FIST!', 'It\'s not a pyramid, it\'s a TRIANGLE of OPPORTUNITY!', 'Act now! Limited-time beating!', 'Your downline is crying!'],
    phase2Line: 'Time for my... EXIT STRATEGY! Everyone gets paid! In PAIN!',
    death: 'I... I should have... diversified...',
  },
  snowmom: {
    name: 'The Abominable Snowmom', title: 'Matriarch of the Slightly Chilly Peaks', model: 'snowmom',
    hp: 1000, dmg: 26, speed: 2.5, radius: 1.6, height: 4.8, xp: 700, coins: [420, 420], arena: 17,
    drop: 'icicle', proj: 'snowball', medallion: true,
    attacks: ['overhead', 'stomp', 'barrage', 'sweep'], phase2: ['charge', 'fan'],
    intro: 'Look at you! No hat! No scarf! In THIS weather?! Sit down, young one. Mom is going to TEACH you.',
    taunts: ['Did you eat today?! You look thin!', 'Put on a COAT!', 'I\'m not angry. I\'m DISAPPOINTED.', 'Don\'t make me count to three!'],
    phase2Line: 'ONE. TWO. ...THREE!',
    death: 'Call me... more often... sweetie...',
    healRage: ['Good, you\'re eating! Now FIGHT!'],
  },
  sogbeard: {
    name: 'Captain Sogbeard', title: 'Terror of the Beach of Regret, Very Damp', model: 'sogbeard',
    hp: 950, dmg: 25, speed: 3.0, radius: 1.3, height: 4.0, xp: 680, coins: [450, 450], arena: 16,
    drop: 'cutlass', proj: 'cannon', medallion: true,
    attacks: ['sweep', 'overhead', 'barrage', 'fan'], phase2: ['charge', 'leap'],
    intro: 'Arrr! Welcome aboard! Well, the ship sank. Welcome a-BEACH! Prepare to be... moisturised!',
    taunts: ['Arr! Taste me cutlass!', 'Me beard has its own ecosystem!', 'Fire the cannons! I only have one! FIRE IT!', 'I\'ve been soggy for 300 years and I\'m DONE being nice!'],
    phase2Line: 'Ye\'ve made me lose me parrot! NOW YE PAY!',
    death: 'Tell me crew... I finally... dried off...',
  },
};

export const SOCKRATES = {
  intro: 'Ah, a traveller. Tell me: if a sock is lost and nobody finds it, is it still a sock? I have lost <b>sixteen socks</b> across the kingdom. Bring them back and I will reward you with wisdom. And actual items. Mostly items.',
  progress: (n) => `You have returned <b>${n} of 16</b> socks. ${n >= 16 ? '' : 'The rest are out there. In the desert, the peaks, the beach, everywhere. Socks are drawn to adventure.'}`,
};

export const DEATH_LINES = [
  'It happens. A lot, actually.',
  'Have you considered not getting hit?',
  'Your coins are sad and alone. Go get them.',
  'The ground was very happy to see you.',
  'Death count increased. Dignity count unchanged (zero).',
  'Pro tip: the spacebar is a friend.',
  'You have died of dysentery. Wait, wrong game.',
];

export const SIGNS = {
  start: 'Welcome to the Kingdom! Population: you, some goblins, and one very lonely king. Please do not feed the frogs.',
  swamp: 'THE CURSED SWAMP. Now with 40% more curse. Purple puddles are poison. Green ones are also poison. Look, just avoid puddles.',
  gate: 'Warning: Gate guarded by a man going through a lot right now. Be gentle. Or don\'t.',
  backyard: 'THE KING\'S BACKYARD. No trespassing. No soliciting. No touching the grass (the King\'s job).',
  hint1: 'Hint: some walls are fake. Like your confidence. Hit suspicious walls.',
  hint2: 'Shortcut gates open from the other side. That\'s how gates work. Gates are rude.',
  shed: 'Property of Lord Touchgrass. Contains: rakes, more rakes, and absolutely no secrets behind the back wall.',
  desert: 'THE CRUNCHY DESERT. Sand gets everywhere. EVERYWHERE. Beware the Pharaoh and his amazing business opportunity.',
  peaks: 'THE SLIGHTLY CHILLY PEAKS. Wear a hat. Snowmen here throw snowballs that slow you down. Mom lives up the mountain.',
  beach: 'THE BEACH OF REGRET. Pirates, crabs, and one very damp captain to the east. No lifeguard on duty, ever.',
  crossroads: 'Crossroads. West: Desert. East: Peaks. South: Beach. North: Swamp, then the King. Three medallions open the King\'s fog.',
  ice: 'Hint: the moderators hid something in the north-east corner of the peaks. Behind ice. Fake ice.',
};

export const TIPS = {
  move: 'WASD to move, Mouse to look. Hold <b>Shift</b> to sprint.',
  attack: 'Hit Dummy Dave! <b>Left Click</b> = light attack, <b>Right Click</b> = heavy attack. Attacks use stamina.',
  dodge: 'Press <b>Space</b> to dodge roll. You are invincible for a moment while rolling. Time it as enemies swing!',
  shrine: 'That glowing grass is a <b>Touch Grass Shrine</b>. Press <b>E</b> to rest: heals you, refills flasks, lets you level up.',
  heal: 'Press <b>Q</b> to drink your Flask of Questionable Juice. <b>Tab</b> opens your inventory and stats.',
  lock: 'Press <b>F</b> (or Middle Mouse) to lock on to an enemy. Very helpful for big angry kings.',
  map: 'Press <b>M</b> to open the world map. The kingdom is bigger than it looks: deserts west, mountains east, a beach south.',
  medallion: 'Bling Medallions open the fog to Lord Touchgrass. You need <b>six</b>. Eight great enemies across the kingdom carry them. Any order you like!',
};

export const CREDITS = `
<h3>Elden Bling: The Quest for the Last Brain Cell</h3>
<p>A silly open-world Soulslike made with HTML, CSS, JavaScript and Three.js.</p>
<p>All models are built from simple shapes in code. All sounds and music are synthesised live with the Web Audio API. No external assets.</p>
<p>Three.js &copy; the three.js authors (MIT License).</p>
<p>Special thanks to Nugget the chicken, who was not harmed and is honestly doing great.</p>
<p>No kings were touched in the making of this game. Only grass.</p>
`;

// ======================================================================
// Expansion 2: the far regions (Haunted Woods, Mount Slightly Hot,
// the Fungal Funhouse and the Candy Kingdom), more bosses and loot.
// ======================================================================

Object.assign(WEAPONS, {
  juicebox: { name: 'Juice Box of Eternal Night', dmg: 30, speed: 1.15, reach: 2.4, arc: 125, lifesteal: 0.2, desc: 'Count Snackula\'s weapon of choice. Every hit drains 20% back as health. Contains no actual juice, only vibes.' },
  jackflail: { name: 'Jack-o\'-Flail', dmg: 38, speed: 0.75, reach: 2.9, arc: 140, stagger: true, dot: { dps: 6, t: 3, color: 0xff8822 }, desc: 'A burning pumpkin on a chain. The Headless Horseman would like it back, but he can\'t see where it went.' },
  gavel: { name: 'Gavel of Hot Takes', dmg: 40, speed: 0.8, reach: 2.6, arc: 130, stagger: true, dot: { dps: 8, t: 3, color: 0xff5511 }, desc: 'The Molten Mayor\'s gavel. Sets enemies on fire. Order in the court! Especially the on-fire part.' },
  dragontooth: { name: 'Dave\'s Tooth (He Wants It Back)', dmg: 34, speed: 1.0, reach: 3.2, arc: 120, dot: { dps: 7, t: 3, color: 0xff6622 }, desc: 'A dragon fang. Still warm. Dave keeps sending you passive-aggressive letters about it.' },
  shroomstaff: { name: 'Mush-Room Service Staff', dmg: 32, speed: 1.05, reach: 2.8, arc: 130, dot: { dps: 9, t: 4, color: 0x88ee44 }, desc: 'The Fun Guy\'s staff. Poisons enemies. Comes with a little "do not disturb" sign.' },
  slimesabre: { name: 'Slimy Sabre', dmg: 30, speed: 1.15, reach: 2.6, arc: 125, frost: true, desc: 'Queen Slugworth\'s sword. Slows enemies down. Also slows down anyone who has to clean it.' },
  candycane: { name: 'Candy Cane of Sugar Rush', dmg: 33, speed: 1.4, reach: 2.6, arc: 130, desc: 'Baron Von Sugarcrash\'s cane. Ridiculously fast. Mint flavoured. Do not lick mid-fight.' },
  gummyfists: { name: 'Gummy Gauntlets', dmg: 20, speed: 1.9, reach: 2.0, arc: 120, stagger: true, desc: 'Big squishy fists. Punch faster than your enemies can process emotionally.' },
  wormwhip: { name: 'Sandworm Whip', dmg: 29, speed: 1.0, reach: 4.0, arc: 90, desc: 'Sandra\'s tail tip. Enormous reach. Sandra says it\'ll grow back. Sandra is lying.' },
  brrsword: { name: 'Brr-oadsword', dmg: 35, speed: 0.95, reach: 2.8, arc: 130, frost: true, desc: 'Sir Shivers\' frozen blade. Slows enemies. Your hands will never be warm again.' },
  tentacle: { name: 'Kevin\'s Spare Tentacle', dmg: 27, speed: 1.35, reach: 3.3, arc: 135, slap: true, desc: 'Kevin had eight. Now he has seven and a grudge. Every hit is a wet slap.' },
  broom: { name: 'Witch\'s Broom (Used)', dmg: 28, speed: 1.2, reach: 2.8, arc: 175, desc: 'Grandma Bog\'s broom. Sweeps in a huge arc. Does not fly. She checked. Many times.' },
  bigspoon: { name: 'The Big Spoon', dmg: 22, speed: 1.1, reach: 2.6, arc: 150, desc: 'For cuddling and for violence. Mostly violence.' },
  airguitar: { name: 'Air Guitar of Shredding', dmg: 26, speed: 1.3, reach: 2.4, arc: 130, desc: 'You can\'t see it. Enemies can\'t see it. Everyone agrees it is absolutely shredding though.' },
  keyboard: { name: 'Gaming Keyboard (RGB)', dmg: 19, speed: 1.7, reach: 2.2, arc: 125, desc: 'Clicky switches. +10 to annoying your roommate. The lights make it hit harder (they don\'t).' },
  flamingospear: { name: 'Lawn Flamingo Spear', dmg: 24, speed: 1.15, reach: 3.4, arc: 80, desc: 'A plastic flamingo on a stick. Lord Touchgrass reported it stolen in 1523.' },
  pizzacutter: { name: 'Pizza Cutter of Destiny', dmg: 25, speed: 1.45, reach: 2.2, arc: 130, desc: 'Cuts through pizza, cheese, enemies and arguments about pineapple.' },
  dadsbelt: { name: 'Dad\'s Belt', dmg: 31, speed: 1.2, reach: 2.9, arc: 140, stagger: true, desc: 'Enemies freeze in fear when you take it off. Simply terrifying.' },
});

Object.assign(ARMOR, {
  pumpkinhead: { slot: 'head', name: 'Pumpkin Head', def: 0.12, desc: 'Carved by a professional. Smells like autumn. You can only see through the triangle eyes.' },
  witchhat: { slot: 'head', name: 'Pointy Witch Hat', def: 0.1, xpBonus: 0.4, desc: '+40% XP. The hat is doing all the thinking now.' },
  shroomcap: { slot: 'head', name: 'Mushroom Cap', def: 0.12, poisonResist: true, desc: 'Immune to poison. Might be growing on you. Literally.' },
  propeller: { slot: 'head', name: 'Propeller Beanie', def: 0.06, speedBonus: 0.12, desc: '+12% movement speed. The propeller is not connected to anything. It is pure belief.' },
  tinfoil: { slot: 'head', name: 'Tin Foil Hat', def: 0.11, chillResist: true, desc: 'Immune to being chilled. Blocks mind control, 5G and snowballs.' },
  dragonhelm: { slot: 'head', name: 'Dragon Skull Helm', def: 0.17, dmgBonus: 0.08, desc: 'Dave\'s cousin. Dave doesn\'t talk about it.' },
  vampcape: { slot: 'body', name: 'Cape of Dramatic Entrances', def: 0.14, lifesteal: 0.05, desc: 'Every hit heals 5% of the damage. Swish it. Swish it often.' },
  lavaplate: { slot: 'body', name: 'Lava Plate Armour', def: 0.28, burnResist: true, desc: 'Immune to burning. Very heavy. Very hot. Do not hug anyone.' },
  gingerplate: { slot: 'body', name: 'Gingerbread Plate', def: 0.2, regen: 1.5, desc: 'Regenerates 1.5 HP per second as you nibble on it. Structurally questionable.' },
  apron: { slot: 'body', name: 'Kiss the Cook Apron', def: 0.12, healBonus: 0.5, desc: 'Flasks and food heal 50% more. Nobody kisses the cook.' },
  hoodie: { slot: 'body', name: 'Comfy Hoodie', def: 0.11, stamRegen: 0.45, desc: '+45% stamina regeneration. Hood up = main character energy.' },
  tuxedo: { slot: 'body', name: 'Tuxedo of Formal Violence', def: 0.18, dmgBonus: 0.15, desc: '+15% damage. You came to this fight dressed for a gala and you will LEAVE like it.' },
});

Object.assign(CONSUMABLES, {
  firebomb: { name: 'Spicy Fire Bomb', key: '6', desc: 'Thrown like a soda bomb, but sets everything on fire. 60 damage plus burning.' },
  mushroom: { name: 'Questionable Mushroom', key: '7', desc: 'Random effect! Could heal you fully, make you super strong, or turn the world upside down emotionally.' },
  candy: { name: 'Rare-ish Candy', key: '8', desc: 'Grants 250 XP instantly. Technically counts as a vegetable in the Candy Kingdom.' },
});

SHOP.push({ kind: 'consumable', id: 'coconut', price: 50 });
export const SHOP_GOURDON = [
  { kind: 'consumable', id: 'firebomb', price: 90 },
  { kind: 'consumable', id: 'mushroom', price: 75 },
  { kind: 'consumable', id: 'coconut', price: 50 },
  { kind: 'armor', id: 'pumpkinhead', price: 400, once: true },
  { kind: 'weapon', id: 'bigspoon', price: 500, once: true },
  { kind: 'flask', id: 'flask3', price: 700, once: true, name: 'Flask Great-Uncle (+1 Flask)', desc: 'Wears suspenders. Tells long stories. Heals you anyway.' },
];
export const SHOP_LOLLIPOP = [
  { kind: 'consumable', id: 'candy', price: 160 },
  { kind: 'consumable', id: 'firebomb', price: 90 },
  { kind: 'consumable', id: 'bomb', price: 70 },
  { kind: 'armor', id: 'propeller', price: 600, once: true },
  { kind: 'armor', id: 'tuxedo', price: 1400, once: true },
  { kind: 'weapon', id: 'keyboard', price: 650, once: true },
  { kind: 'flask', id: 'flask4', price: 1000, once: true, name: 'Flask Long-Lost Twin (+1 Flask)', desc: 'Separated from the first flask at birth. Dramatic reunion pending.' },
];

SOCKS.push([-120, -100], [130, -105], [-235, 10], [-190, -110], [235, 0], [200, 95]);

Object.assign(ENEMIES, {
  ghost: {
    name: 'Mildly Spooky Ghost', hp: 70, dmg: 16, speed: 3.0, radius: 0.6, height: 2.0,
    detect: 16, lose: 26, leash: 26, range: 1.8, windup: 0.55, active: 0.15, recover: 0.6,
    cooldown: 1.4, xp: 40, coins: [16, 30], ranged: { min: 4, max: 15, windup: 0.6, proj: 'orb', dmg: 14 },
    lines: ['Boo. BOO! ...Is this thing on?', 'I\'m not spooky, I\'m just misunderstood!', 'OoooOOooo (rent is due)', 'Haunting is my side hustle.'],
  },
  werepoodle: {
    name: 'Werepoodle', hp: 85, dmg: 18, speed: 4.6, radius: 0.55, height: 1.9, poise: 1,
    detect: 15, lose: 26, leash: 30, range: 1.9, windup: 0.42, active: 0.14, recover: 0.5,
    cooldown: 0.8, xp: 46, coins: [18, 32], rare: { kind: 'weapon', id: 'dadsbelt', chance: 0.06 },
    lines: ['GRRR! Wait, I just got groomed.', 'Awoooo! Respect the pompom!', 'I am a WOLF. A fancy one.'],
  },
  pumpkin: {
    name: 'Pumpkin Brute', hp: 110, dmg: 24, speed: 2.6, radius: 0.6, height: 2.0, poise: 1,
    detect: 13, lose: 24, leash: 26, range: 2.3, windup: 0.8, active: 0.18, recover: 0.85,
    cooldown: 1.4, xp: 52, coins: [20, 36], rare: { kind: 'armor', id: 'pumpkinhead', chance: 0.06 },
    lines: ['SMASH! Then pie.', 'I\'ve got seeds of ANGER.', 'Don\'t carve me, bro.'],
  },
  imp: {
    name: 'Hot-Headed Imp', hp: 60, dmg: 15, speed: 4.2, radius: 0.45, height: 1.3,
    detect: 15, lose: 24, leash: 26, range: 1.7, windup: 0.4, active: 0.14, recover: 0.5,
    cooldown: 1.1, xp: 40, coins: [16, 28], ranged: { min: 4, max: 13, windup: 0.5, proj: 'fireball', dmg: 12, burn: 3, fan: 2 },
    lines: ['Hot hot HOT!', 'I\'m having a meltdown!', 'Fire is my love language!'],
  },
  golem: {
    name: 'Magma Golem', hp: 190, dmg: 30, speed: 2.2, radius: 0.95, height: 3.1, poise: 1,
    detect: 13, lose: 22, leash: 24, range: 2.8, windup: 1.0, active: 0.2, recover: 1.0,
    cooldown: 1.6, xp: 80, coins: [30, 50], rare: { kind: 'armor', id: 'lavaplate', chance: 0.05 },
    lines: ['ROCK. AND. ROLL.', 'I\'m not stoned, I\'m STONE.', 'Lava you. Not like that.'],
  },
  shroom: {
    name: 'Angry Shroomling', hp: 55, dmg: 15, speed: 4.0, radius: 0.5, height: 1.2,
    detect: 13, lose: 22, leash: 24, range: 1.6, windup: 0.4, active: 0.2, recover: 0.5,
    cooldown: 0.9, xp: 34, coins: [14, 26], rare: { kind: 'armor', id: 'shroomcap', chance: 0.07 },
    lines: ['I\'m a fun guy! Fight me!', 'Spore-ts time!', 'There\'s not mush room for you here!'],
  },
  sporeling: {
    name: 'Puffball Sporeling', hp: 75, dmg: 12, speed: 2.0, radius: 0.7, height: 1.4,
    detect: 16, lose: 24, leash: 20, range: 1.8, windup: 0.6, active: 0.15, recover: 0.7,
    cooldown: 1.5, xp: 42, coins: [14, 26], ranged: { min: 3.5, max: 15, windup: 0.7, proj: 'spore', dmg: 12, poison: 4 },
    lines: ['*puff*', '*PUFF* (aggressively)', 'Achoo! That was a spore. You\'re welcome.'],
  },
  ginger: {
    name: 'Gingerbread Guard', hp: 100, dmg: 21, speed: 3.6, radius: 0.55, height: 1.9, poise: 1,
    detect: 14, lose: 26, leash: 28, range: 2.4, windup: 0.55, active: 0.15, recover: 0.6,
    cooldown: 1.0, xp: 54, coins: [22, 38], rare: { kind: 'armor', id: 'gingerplate', chance: 0.05 },
    lines: ['Run run as fast as you can!', 'You can\'t catch me, I\'m— oh, you caught me.', 'I\'m crumbly but I\'m TOUGH!', 'Not the gumdrop buttons!'],
  },
  gummyworm: {
    name: 'Sour Gummy Worm', hp: 80, dmg: 14, speed: 2.8, radius: 0.6, height: 1.3,
    detect: 16, lose: 24, leash: 24, range: 1.8, windup: 0.5, active: 0.15, recover: 0.6,
    cooldown: 1.3, xp: 46, coins: [18, 30], ranged: { min: 4, max: 14, windup: 0.55, proj: 'candy', dmg: 13, fan: 3 },
    lines: ['Sour POWER!', 'I\'m sweet AND sour!', 'Wiggle wiggle ATTACK!'],
  },
  marshmallow: {
    name: 'Marshmallow Bouncer', hp: 170, dmg: 26, speed: 2.6, radius: 0.95, height: 2.4, poise: 1,
    detect: 13, lose: 22, leash: 24, range: 2.4, windup: 0.85, active: 0.25, recover: 0.9,
    cooldown: 1.4, xp: 74, coins: [26, 44], rare: { kind: 'armor', id: 'apron', chance: 0.06 },
    lines: ['Squish!', 'I am SOFT but my RULES are HARD.', 'You\'re toast. S\'more like it.'],
  },
});
// Late-game regular-enemy drops.
ENEMIES.ghost.rare = { kind: 'armor', id: 'witchhat', chance: 0.05 };
ENEMIES.imp.rare = { kind: 'weapon', id: 'pizzacutter', chance: 0.06 };
ENEMIES.sporeling.rare = { kind: 'armor', id: 'hoodie', chance: 0.06 };
ENEMIES.gummyworm.rare = { kind: 'weapon', id: 'airguitar', chance: 0.06 };

Object.assign(REGION_BOSSES, {
  sandworm: {
    name: 'Sandra the Sandworm', title: 'Very Long, Very Grumpy', model: 'sandworm',
    hp: 900, dmg: 26, speed: 3.4, radius: 1.6, height: 3.2, xp: 520, coins: [300, 300], arena: 15, optional: true,
    drop: 'wormwhip', proj: 'sand', attacks: ['sweep', 'charge', 'barrage', 'fan'], phase2: ['leap', 'stomp'],
    intro: 'You walked on my nap spot. My nap spot is the ENTIRE DESERT.',
    taunts: ['Sssssand in your eyes!', 'I am 40 metres of bad mood!', 'Wiggle CRUSH!'],
    phase2Line: 'Now I\'m REALLY going to ssssquish you!', death: 'I\'ll... just... burrow... forever...',
  },
  shivers: {
    name: 'Sir Shivers the Ice Knight', title: 'Has Not Been Warm Since 1302', model: 'shivers',
    hp: 950, dmg: 27, speed: 3.2, radius: 1.1, height: 3.4, xp: 540, coins: [320, 320], arena: 14, optional: true,
    drop: 'brrsword', proj: 'snowball', attacks: ['sweep', 'overhead', 'fan', 'leap'], phase2: ['charge', 'barrage'],
    intro: 'Halt! Have you got a hot chocolate? No? Then you must DIE. Brrr.',
    taunts: ['Ch-ch-ch-charge!', 'My t-t-teeth are chattering with RAGE!', 'Cold steel! Very cold! Ow!'],
    phase2Line: 'I c-c-can\'t feel my FACE! Neither will YOU!', death: 'F-f-finally... warm...',
  },
  kevin: {
    name: 'Kevin, the Kraken\'s Little Brother', title: 'Not a Kraken. Please Stop Asking.', model: 'kraken',
    hp: 980, dmg: 26, speed: 2.4, radius: 1.8, height: 3.4, xp: 560, coins: [340, 340], arena: 15, optional: true,
    drop: 'tentacle', proj: 'ink', attacks: ['sweep', 'fan', 'barrage', 'stomp'], phase2: ['charge', 'leap'],
    intro: 'Everybody always asks about my BROTHER. "Is the Kraken here?" NO! It\'s KEVIN! Fight KEVIN!',
    taunts: ['Eight arms, zero hugs!', 'Ink-redible!', 'My brother would never do THIS!'],
    phase2Line: 'I\'M THE KRAKEN NOW!', death: 'Tell my brother... I was... cool...',
  },
  bog: {
    name: 'Grandma Bog', title: 'Swamp Witch, Retired, Unretired', model: 'bog',
    hp: 900, dmg: 25, speed: 3.0, radius: 1.0, height: 3.2, xp: 500, coins: [300, 300], arena: 13, optional: true,
    drop: 'broom', proj: 'slime', attacks: ['sweep', 'barrage', 'fan', 'leap'], phase2: ['stomp', 'charge'],
    intro: 'Oh, a visitor! Come in, dearie, I\'ve made soup. The soup is a FIGHT.',
    taunts: ['Eat your vegetables! THEY BITE!', 'Back in my day we died with DIGNITY!', 'Hehehe! Another one for the pot!'],
    phase2Line: 'Grandma\'s getting her REAL broom!', death: 'Remember to... wear a jumper...',
  },
  snackula: {
    name: 'Count Snackula', title: 'Lord of the Haunted Woods, Drinker of Juice Boxes', model: 'snackula',
    hp: 2100, dmg: 34, speed: 3.4, radius: 1.3, height: 4.4, xp: 1400, coins: [800, 800], arena: 18,
    drop: 'juicebox', proj: 'bat', medallion: true, attacks: ['sweep', 'overhead', 'fan', 'leap', 'barrage'], phase2: ['charge', 'stomp'],
    intro: 'Welcome to my castle. I vant to... drink your... JUICE BOX. Apple, if you have it.',
    taunts: ['Bleh! Bleh bleh!', 'I am not a morning person. I am a FIGHTING person!', 'I never drink... tap water.', 'Ah-ah-ah! One hit! Two hits!'],
    phase2Line: 'The sun is down, the juice is out, and I am THIRSTY!', death: 'Noooo... the sun... it\'s 3 PM...',
    healRage: ['You DARE drink in front of ME?!'],
  },
  horseless: {
    name: 'The Headless Horseman (Horseless)', title: 'Lost His Head. Then His Horse.', model: 'horseless',
    hp: 1500, dmg: 31, speed: 3.6, radius: 1.1, height: 3.6, xp: 900, coins: [500, 500], arena: 15, optional: true,
    drop: 'jackflail', proj: 'pumpkin', attacks: ['sweep', 'overhead', 'barrage', 'charge'], phase2: ['leap', 'fan'],
    intro: '...(He gestures wildly. He has no head. He seems to be asking if you have seen a horse.)',
    taunts: ['(furious gesturing)', '(points at you, then at the empty saddle)', '(does a sad little shrug)'],
    phase2Line: '(He throws his pumpkin head. Then he grabs another one. He has MANY.)', death: '(He waves goodbye. Probably.)',
  },
  mayor: {
    name: 'The Molten Mayor', title: 'Re-elected Every Year (No One Else Runs)', model: 'mayor',
    hp: 2300, dmg: 36, speed: 2.8, radius: 1.6, height: 5.0, xp: 1500, coins: [850, 850], arena: 18,
    drop: 'gavel', proj: 'fireball', medallion: true, attacks: ['overhead', 'stomp', 'barrage', 'fan', 'sweep'], phase2: ['leap', 'charge'],
    intro: 'Citizens! I promise lower taxes, hotter lava, and the immediate DESTRUCTION of this tourist!',
    taunts: ['Vote for me or BURN!', 'My approval rating is 100%! I approved it!', 'Next item on the agenda: YOU!', 'This meeting is now on FIRE!'],
    phase2Line: 'I am declaring a STATE OF EMERGENCY! The emergency is ME!', death: 'I... concede... the election...',
  },
  dave: {
    name: 'Dave the Mildly Inconvenient Dragon', title: 'Wants His Tooth Back', model: 'dragon',
    hp: 1700, dmg: 33, speed: 3.0, radius: 2.0, height: 4.0, xp: 1000, coins: [600, 600], arena: 17, optional: true,
    drop: 'dragontooth', proj: 'fireball', attacks: ['fan', 'sweep', 'charge', 'stomp'], phase2: ['barrage', 'leap'],
    intro: 'Oh. A knight. Great. Look, I\'m not here to hoard gold, I\'m here because my dentist is up here.',
    taunts: ['Do you know how hard it is to floss with claws?!', 'ROAR. Sorry. That was rude. ROAR.', 'I\'m a dragon, not a DRAG-on!'],
    phase2Line: 'Okay. NOW I\'m inconvenienced!', death: 'Fine. Keep the tooth. I\'m getting a crown anyway.',
  },
  funguy: {
    name: 'The Fun Guy', title: 'Life of Every Party, Ruler of the Fungal Funhouse', model: 'funguy',
    hp: 2200, dmg: 33, speed: 3.3, radius: 1.5, height: 4.8, xp: 1450, coins: [800, 800], arena: 18,
    drop: 'shroomstaff', proj: 'spore', medallion: true, attacks: ['sweep', 'barrage', 'stomp', 'fan', 'overhead'], phase2: ['leap', 'charge'],
    intro: 'Heyyy! Welcome to the party! The theme is: YOU LOSE! Wooo!',
    taunts: ['Party foul!', 'This is my jam! And by jam I mean violence!', 'Is it hot in here or is it just my spores?', 'Woo! Mosh pit!'],
    phase2Line: 'Time for the AFTER-PARTY!', death: 'Party\'s... over... somebody call... a cab...',
  },
  slugworth: {
    name: 'Queen Slugworth', title: 'Slowest Monarch in the Kingdom', model: 'slug',
    hp: 1700, dmg: 32, speed: 2.4, radius: 1.9, height: 2.8, xp: 1000, coins: [600, 600], arena: 15, optional: true,
    drop: 'slimesabre', proj: 'slime', attacks: ['charge', 'barrage', 'stomp', 'fan'], phase2: ['leap', 'sweep'],
    intro: 'You will kneel before your Queen. Take your time. I am also taking mine.',
    taunts: ['Slow and steady wins the FIGHT!', 'My trail is a royal decree!', 'Bow! Bow lower! Lower! Now SLIMIER!'],
    phase2Line: 'Royal guard! ...Oh right, I ate them.', death: 'Long... live... the slime...',
  },
  sugarcrash: {
    name: 'Baron Von Sugarcrash', title: 'Ruler of the Candy Kingdom, Has Never Seen a Vegetable', model: 'sugarcrash',
    hp: 2400, dmg: 37, speed: 3.2, radius: 1.6, height: 5.2, xp: 1600, coins: [900, 900], arena: 18,
    drop: 'candycane', proj: 'candy', medallion: true, attacks: ['overhead', 'sweep', 'barrage', 'stomp', 'fan'], phase2: ['charge', 'leap'],
    intro: 'A HEALTHY person? In MY kingdom? Guards! Bring me... no, I\'ll do it myself. AFTER this cupcake.',
    taunts: ['SUGAR RUSH!', 'Vegetables are a MYTH!', 'Eat cake! Eat it! EAT THE CAKE!', 'I\'m vibrating at a frequency you can\'t comprehend!'],
    phase2Line: 'I\'m... crashing... NO! MORE SUGAR!', death: 'I... should have... eaten... a carrot...',
  },
  gummy: {
    name: 'The Gummy Bear Bruiser', title: 'Chewy. Furious. Bear-shaped.', model: 'gummy',
    hp: 1600, dmg: 31, speed: 3.8, radius: 1.2, height: 3.6, xp: 950, coins: [550, 550], arena: 15, optional: true,
    drop: 'gummyfists', proj: 'candy', attacks: ['sweep', 'overhead', 'leap', 'charge'], phase2: ['fan', 'stomp'],
    intro: 'Hi! I\'m a gummy bear! I\'m gonna squish you into a gummy PANCAKE!',
    taunts: ['Gummy SMASH!', 'I\'m not chewy, I\'m TOUGH!', 'Bear hug! The bad kind!'],
    phase2Line: 'I\'M MELTING... WITH RAGE!', death: 'I... was... the red one... the best one...',
  },
});

// Harder bosses: everything hits harder and has more health than before.
for (const id of ['gary', 'pharaoh', 'snowmom', 'sogbeard']) {
  REGION_BOSSES[id].hp = Math.round(REGION_BOSSES[id].hp * 1.45);
  REGION_BOSSES[id].dmg = Math.round(REGION_BOSSES[id].dmg * 1.2);
}
UNEMPLOYED.hp = 560; UNEMPLOYED.dmg = 23;
for (const id of ['snackula', 'horseless', 'mayor', 'dave', 'funguy', 'slugworth', 'sugarcrash', 'gummy']) {
  REGION_BOSSES[id].hp = Math.round(REGION_BOSSES[id].hp * 1.1);
  REGION_BOSSES[id].dmg = Math.round(REGION_BOSSES[id].dmg * 1.15);
}
for (const id of ['sandworm', 'shivers', 'kevin']) REGION_BOSSES[id].dmg = Math.round(REGION_BOSSES[id].dmg * 1.1);
TOUCHGRASS.hp = 2600; TOUCHGRASS.dmg = 36;

Object.assign(SIGNS, {
  woods: 'THE HAUNTED WOODS. Mildly spooky. Count Snackula\'s castle lies to the north. Ghosts here are mostly harmless, emotionally.',
  volcano: 'MOUNT SLIGHTLY HOT. Lava burns. Golems hit hard. The Molten Mayor holds office at the summit.',
  fungal: 'THE FUNGAL FUNHOUSE. Do not eat anything. Do not lick anything. The Fun Guy is throwing a party. You are not invited.',
  candy: 'THE CANDY KINGDOM. Everything is sweet except the inhabitants. Baron Von Sugarcrash rules from his cake castle.',
  farlands: 'Warning: beyond this point, enemies are MUCH stronger. Make sure you have levelled up. Or don\'t. We\'re a sign, not a cop.',
});
TIPS.far = 'You have entered a <b>far region</b>. Enemies here are much tougher, but drop better loot. Six Bling Medallions are needed for the King now!';
