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
  intro: 'Ah, a traveller. Tell me: if a sock is lost and nobody finds it, is it still a sock? I have lost <b>ten socks</b> across the kingdom. Bring them back and I will reward you with wisdom. And actual items. Mostly items.',
  progress: (n) => `You have returned <b>${n} of 10</b> socks. ${n >= 10 ? '' : 'The rest are out there. In the desert, the peaks, the beach, everywhere. Socks are drawn to adventure.'}`,
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
  medallion: 'Bling Medallions open the fog to Lord Touchgrass. Defeat the region bosses to earn them. Any order you like!',
};

export const CREDITS = `
<h3>Elden Bling: The Quest for the Last Brain Cell</h3>
<p>A silly open-world Soulslike made with HTML, CSS, JavaScript and Three.js.</p>
<p>All models are built from simple shapes in code. All sounds and music are synthesised live with the Web Audio API. No external assets.</p>
<p>Three.js &copy; the three.js authors (MIT License).</p>
<p>Special thanks to Nugget the chicken, who was not harmed and is honestly doing great.</p>
<p>No kings were touched in the making of this game. Only grass.</p>
`;
