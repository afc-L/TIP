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
};

export const FLASK = {
  name: 'Flask of Questionable Juice',
  desc: 'Heals a big chunk of HP. Refills at Touch Grass Shrines. Tastes like a dare.',
};

export const SHOP = [
  { kind: 'consumable', id: 'garlic', price: 35 },
  { kind: 'consumable', id: 'dignity', price: 55 },
  { kind: 'consumable', id: 'pepper', price: 60 },
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
    cooldown: 1.3, xp: 26, coins: [12, 24], rare: { kind: 'armor', id: 'bathrobe', chance: 0.1 },
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
    cooldown: 1.2, xp: 20, coins: [8, 18], rare: { kind: 'weapon', id: 'femur', chance: 0.15 },
    lines: ['I have a bone to pick with you!', '*aggressive rattling*', 'Calcium POWER!', 'No body likes me...'],
  },
  frog: {
    name: 'Giant Poison Frog', hp: 52, dmg: 14, speed: 2.4, radius: 0.85, height: 1.4,
    detect: 15, lose: 24, leash: 24, range: 2.0, windup: 0.55, active: 0.15, recover: 0.7,
    cooldown: 1.7, xp: 24, coins: [10, 20], ranged: { min: 4.5, max: 14, windup: 0.75 },
    lines: ['RIBBIT. (threateningly)', 'Croak of DOOM!', 'Ribbit... ribbit... YOU.'],
  },
};

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
};

export const TIPS = {
  move: 'WASD to move, Mouse to look. Hold <b>Shift</b> to sprint.',
  attack: 'Hit Dummy Dave! <b>Left Click</b> = light attack, <b>Right Click</b> = heavy attack. Attacks use stamina.',
  dodge: 'Press <b>Space</b> to dodge roll. You are invincible for a moment while rolling. Time it as enemies swing!',
  shrine: 'That glowing grass is a <b>Touch Grass Shrine</b>. Press <b>E</b> to rest: heals you, refills flasks, lets you level up.',
  heal: 'Press <b>Q</b> to drink your Flask of Questionable Juice. <b>Tab</b> opens your inventory and stats.',
  lock: 'Press <b>F</b> (or Middle Mouse) to lock on to an enemy. Very helpful for big angry kings.',
};

export const CREDITS = `
<h3>Elden Bling: The Quest for the Last Brain Cell</h3>
<p>A tiny, silly Soulslike made with HTML, CSS, JavaScript and Three.js.</p>
<p>All models are built from simple shapes in code. All sounds and music are synthesised live with the Web Audio API. No external assets.</p>
<p>Three.js &copy; the three.js authors (MIT License).</p>
<p>Special thanks to Nugget the chicken, who was not harmed and is honestly doing great.</p>
<p>No kings were touched in the making of this game. Only grass.</p>
`;
