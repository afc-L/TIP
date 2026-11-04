// Game data: teams, roles, weapons, vehicles, ranks, difficulties, medals.
(function (G) {
  'use strict';
  const IF = G.IF;

  IF.CFG = {
    MAP: 2000, HALF: 1000,
    SOLDIERS_PER_TEAM: 1000,
    MAX_SOLDIERS: 2000,
    WAVE_TIME: 22,            // seconds between reinforcement waves at a spawn
    BLEED_INTERVAL: 10,        // ticket bleed tick
    NEAR_LOD: 75,             // detailed soldier models
    MAX_NEAR: 140,
  };

  IF.TEAMS = [
    { id: 0, name: 'ALLIED COALITION', short: 'COALITION', callsignBase: ['ALPHA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO', 'FOXTROT', 'GOLF', 'HOTEL', 'INDIA', 'JULIET', 'KILO', 'LIMA'],
      uniform: [0.50, 0.46, 0.33], helmet: [0.42, 0.40, 0.28], vehicle: [0.42, 0.42, 0.30], tracer: [1.0, 0.35, 0.15], hud: '#5fb3ff', mapColor: '#4ea6ff' },
    { id: 1, name: 'IRON PACT', short: 'PACT', callsignBase: ['VOLGA', 'KAMA', 'URAL', 'ONEGA', 'NEVA', 'DON', 'LENA', 'OKA', 'TOBOL', 'AMUR', 'ISHIM', 'PECHORA'],
      uniform: [0.24, 0.29, 0.22], helmet: [0.20, 0.24, 0.18], vehicle: [0.27, 0.31, 0.24], tracer: [0.35, 1.0, 0.35], hud: '#ff5a4a', mapColor: '#ff4b3e' },
  ];

  // Soldier roles
  const R = (IF.ROLE = { RIFLE: 0, MG: 1, MEDIC: 2, ENGINEER: 3, RECON: 4, AT: 5, LEADER: 6, CREW: 7 });
  IF.ROLE_NAMES = ['Rifleman', 'Machine Gunner', 'Medic', 'Engineer', 'Recon', 'Anti-Vehicle', 'Squad Leader', 'Crewman'];
  // AI weapon profiles: range m, rof (shots/s), burst, mag, reload, dmg, acc (base hit prob at 50m)
  IF.AI_WEAPON = [
    { range: 260, rof: 5, burst: [2, 4], mag: 30, reload: 2.6, dmg: 34, acc: 0.30, snd: 'rifle', gun: 'rifle' },  // rifle
    { range: 340, rof: 11, burst: [6, 14], mag: 100, reload: 5.5, dmg: 30, acc: 0.17, snd: 'mg', gun: 'mg' },       // MG
    { range: 200, rof: 5, burst: [2, 3], mag: 30, reload: 2.4, dmg: 30, acc: 0.26, snd: 'rifle', gun: 'rifle' },   // medic carbine
    { range: 210, rof: 5, burst: [2, 4], mag: 30, reload: 2.4, dmg: 30, acc: 0.26, snd: 'rifle', gun: 'rifle' },   // engineer
    { range: 480, rof: 0.5, burst: [1, 1], mag: 5, reload: 3.6, dmg: 90, acc: 0.34, snd: 'sniper', gun: 'sniper' }, // recon
    { range: 220, rof: 5, burst: [2, 3], mag: 30, reload: 2.6, dmg: 30, acc: 0.24, snd: 'rifle', gun: 'at' },       // AT (rifle vs inf)
    { range: 260, rof: 5, burst: [2, 4], mag: 30, reload: 2.5, dmg: 34, acc: 0.32, snd: 'rifle', gun: 'rifle' },   // leader
    { range: 150, rof: 6, burst: [3, 5], mag: 30, reload: 2.4, dmg: 26, acc: 0.2, snd: 'smg', gun: 'rifle' },      // crew smg
  ];

  // Player weapons
  IF.WEAPONS = {
    m4:     { name: 'M4A1 Carbine', cat: 'rifle', dmg: 32, rpm: 780, mag: 30, mags: 6, reload: 2.3, hip: 0.035, ads: 0.004, recoil: 0.011, range: 300, auto: true, zoom: 1.35, snd: 'rifle', rank: 0, model: 'rifle' },
    ak:     { name: 'AK-74M', cat: 'rifle', dmg: 35, rpm: 650, mag: 30, mags: 6, reload: 2.6, hip: 0.04, ads: 0.005, recoil: 0.014, range: 320, auto: true, zoom: 1.35, snd: 'rifle', rank: 1, model: 'rifle' },
    g36:    { name: 'G36 Rifle', cat: 'rifle', dmg: 31, rpm: 740, mag: 30, mags: 6, reload: 2.4, hip: 0.034, ads: 0.0035, recoil: 0.010, range: 330, auto: true, zoom: 1.5, snd: 'rifle', rank: 3, model: 'rifle' },
    scar:   { name: 'SCAR-H Battle Rifle', cat: 'rifle', dmg: 48, rpm: 560, mag: 20, mags: 6, reload: 2.7, hip: 0.045, ads: 0.004, recoil: 0.021, range: 420, auto: true, zoom: 1.5, snd: 'rifle', rank: 6, model: 'rifle' },
    m249:   { name: 'M249 SAW', cat: 'mg', dmg: 30, rpm: 820, mag: 100, mags: 3, reload: 5.6, hip: 0.06, ads: 0.009, recoil: 0.012, range: 360, auto: true, zoom: 1.3, snd: 'mg', rank: 0, model: 'mg' },
    pkm:    { name: 'PKM', cat: 'mg', dmg: 40, rpm: 650, mag: 100, mags: 3, reload: 6.2, hip: 0.065, ads: 0.010, recoil: 0.017, range: 420, auto: true, zoom: 1.3, snd: 'mg', rank: 4, model: 'mg' },
    mp5:    { name: 'MP5 SMG', cat: 'smg', dmg: 24, rpm: 850, mag: 30, mags: 7, reload: 2.0, hip: 0.028, ads: 0.006, recoil: 0.008, range: 140, auto: true, zoom: 1.25, snd: 'smg', rank: 0, model: 'smg' },
    m1014:  { name: 'M1014 Shotgun', cat: 'shotgun', dmg: 14, pellets: 9, rpm: 200, mag: 7, mags: 5, reload: 3.8, hip: 0.07, ads: 0.05, recoil: 0.04, range: 45, auto: false, zoom: 1.15, snd: 'shotgun', rank: 2, model: 'smg' },
    m24:    { name: 'M24 Sniper', cat: 'sniper', dmg: 100, rpm: 45, mag: 5, mags: 6, reload: 3.6, hip: 0.08, ads: 0.0004, recoil: 0.06, range: 900, auto: false, zoom: 6, snd: 'sniper', rank: 0, model: 'sniper', scope: true },
    svd:    { name: 'SVD Dragunov', cat: 'sniper', dmg: 78, rpm: 160, mag: 10, mags: 5, reload: 3.0, hip: 0.07, ads: 0.0008, recoil: 0.04, range: 800, auto: false, zoom: 4, snd: 'sniper', rank: 5, model: 'sniper', scope: true },
    m9:     { name: 'M9 Pistol', cat: 'pistol', dmg: 26, rpm: 380, mag: 15, mags: 4, reload: 1.6, hip: 0.03, ads: 0.012, recoil: 0.02, range: 60, auto: false, zoom: 1.15, snd: 'pistol', rank: 0, model: 'pistol' },
    rpg:    { name: 'RPG-7', cat: 'launcher', dmg: 0, rpm: 20, mag: 1, mags: 5, reload: 3.2, hip: 0.02, ads: 0.006, recoil: 0.05, range: 400, auto: false, zoom: 1.4, snd: 'rocket', rank: 0, model: 'at', rocket: true },
    at4:    { name: 'Carl-G Recoilless', cat: 'launcher', dmg: 0, rpm: 20, mag: 1, mags: 6, reload: 3.6, hip: 0.02, ads: 0.004, recoil: 0.05, range: 500, auto: false, zoom: 2, snd: 'rocket', rank: 5, model: 'at', rocket: true },
  };

  IF.ATTACHMENTS = {
    none:     { name: 'Iron Sights', rank: 0 },
    reddot:   { name: 'Red Dot Sight', rank: 1, zoom: 1.25, adsSpread: 0.8 },
    acog:     { name: '4x ACOG', rank: 4, zoom: 2.6, adsSpread: 0.6, scope: true },
    grip:     { name: 'Vertical Foregrip', rank: 2, recoil: 0.7 },
    suppress: { name: 'Suppressor', rank: 3, quiet: true, dmg: 0.9 },
    extmag:   { name: 'Extended Magazine', rank: 5, mag: 1.5, reload: 1.15 },
  };

  // Player classes
  IF.CLASSES = [
    { id: 'rifle', name: 'Rifleman', role: R.RIFLE, desc: 'Backbone of the army. Assault rifle, extra frag grenades.', primary: ['m4', 'ak', 'g36', 'scar', 'mp5', 'm1014'], gadget: 'ammo', grenades: 4, rank: 0 },
    { id: 'mg', name: 'Machine Gunner', role: R.MG, desc: 'Lays down suppressive fire. Huge magazine, steadier when prone.', primary: ['m249', 'pkm'], gadget: 'ammo', grenades: 2, rank: 0 },
    { id: 'medic', name: 'Medic', role: R.MEDIC, desc: 'Revives downed allies (F) and heals with medkits (4).', primary: ['m4', 'mp5', 'g36', 'ak'], gadget: 'medkit', grenades: 1, smoke: 2, rank: 0 },
    { id: 'engineer', name: 'Engineer', role: R.ENGINEER, desc: 'Repairs vehicles (hold 4) and plants anti-tank mines.', primary: ['mp5', 'm4', 'm1014', 'ak'], gadget: 'repair', grenades: 1, mines: 3, rank: 1 },
    { id: 'recon', name: 'Recon', role: R.RECON, desc: 'Long-range marksman. Binoculars (4) call artillery strikes.', primary: ['m24', 'svd'], gadget: 'arty', grenades: 1, rank: 2 },
    { id: 'at', name: 'Anti-Vehicle', role: R.AT, desc: 'Rocket launcher (4) to kill armour and helicopters.', primary: ['mp5', 'm4', 'ak'], gadget: 'launcher', grenades: 1, rank: 0 },
  ];

  IF.RANKS = [
    ['PVT', 'Private', 0], ['PFC', 'Private First Class', 600], ['CPL', 'Corporal', 1600], ['SGT', 'Sergeant', 3200],
    ['SSG', 'Staff Sergeant', 5400], ['SFC', 'Sergeant First Class', 8200], ['MSG', 'Master Sergeant', 12000], ['2LT', 'Second Lieutenant', 17000],
    ['1LT', 'First Lieutenant', 23000], ['CPT', 'Captain', 30000], ['MAJ', 'Major', 39000], ['LTC', 'Lieutenant Colonel', 50000],
    ['COL', 'Colonel', 64000], ['BG', 'Brigadier General', 82000], ['GEN', 'General', 110000],
  ];

  IF.UNIFORMS = [
    { id: 'std', name: 'Standard Issue', rank: 0, tint: null },
    { id: 'wood', name: 'Woodland', rank: 1, tint: [0.30, 0.36, 0.22] },
    { id: 'desert', name: 'Desert Tan', rank: 2, tint: [0.66, 0.58, 0.42] },
    { id: 'urban', name: 'Urban Grey', rank: 4, tint: [0.46, 0.47, 0.49] },
    { id: 'winter', name: 'Winter Pattern', rank: 6, tint: [0.80, 0.82, 0.84] },
    { id: 'night', name: 'Night Ops', rank: 8, tint: [0.12, 0.13, 0.15] },
    { id: 'tiger', name: 'Tiger Stripe', rank: 10, tint: [0.40, 0.32, 0.16] },
    { id: 'officer', name: 'Officer Dress', rank: 13, tint: [0.18, 0.22, 0.30] },
  ];

  IF.DIFFICULTY = {
    recruit:  { name: 'Recruit',  enemySkill: 0.85, friendSkill: 1.05, playerDmg: 0.45, regenTo: 100, aiVsPlayer: 0.55 },
    regular:  { name: 'Regular',  enemySkill: 1.0,  friendSkill: 1.0,  playerDmg: 0.7,  regenTo: 100, aiVsPlayer: 0.8 },
    veteran:  { name: 'Veteran',  enemySkill: 1.1,  friendSkill: 0.95, playerDmg: 1.0,  regenTo: 50,  aiVsPlayer: 1.0 },
    elite:    { name: 'Elite',    enemySkill: 1.2,  friendSkill: 0.92, playerDmg: 1.35, regenTo: 30,  aiVsPlayer: 1.25 },
  };

  // Vehicle types. armor: 0 light, 1 medium, 2 heavy, 3 air
  IF.VEH = {
    mbt:    { name: 'Main Battle Tank', short: 'MBT', hp: 1400, armor: 2, speed: 13, accel: 3.5, turn: 0.55, crew: 2, seats: 0, len: 9.5, wid: 3.7, hgt: 2.4, gun: 'cannon', gunRange: 700, gunCd: 6.5, mg: true, count: 5, respawn: 150, cost: 6 },
    ifv:    { name: 'Infantry Fighting Vehicle', short: 'IFV', hp: 900, armor: 1, speed: 17, accel: 4.5, turn: 0.7, crew: 2, seats: 6, len: 7.2, wid: 3.2, hgt: 2.0, gun: 'autocannon', gunRange: 500, gunCd: 0.28, mg: false, count: 4, respawn: 120, cost: 4 },
    apc:    { name: 'Armored Personnel Carrier', short: 'APC', hp: 750, armor: 1, speed: 19, accel: 5, turn: 0.75, crew: 1, seats: 10, len: 7.6, wid: 2.9, hgt: 2.2, gun: 'hmg', gunRange: 400, gunCd: 0.11, mg: false, count: 4, respawn: 100, cost: 3 },
    truck:  { name: 'Transport Truck', short: 'TRUCK', hp: 380, armor: 0, speed: 22, accel: 5, turn: 0.8, crew: 1, seats: 12, len: 8, wid: 2.6, hgt: 3.0, gun: null, count: 5, respawn: 70, cost: 1 },
    recon:  { name: 'Reconnaissance Vehicle', short: 'RECON', hp: 320, armor: 0, speed: 28, accel: 8, turn: 1.1, crew: 2, seats: 2, len: 4.8, wid: 2.2, hgt: 1.9, gun: 'hmg', gunRange: 350, gunCd: 0.12, count: 4, respawn: 70, cost: 2 },
    arty:   { name: 'Self-Propelled Artillery', short: 'SPG', hp: 800, armor: 1, speed: 11, accel: 2.5, turn: 0.5, crew: 2, seats: 0, len: 9, wid: 3.4, hgt: 2.8, gun: 'howitzer', gunRange: 1800, gunCd: 7, count: 2, respawn: 180, cost: 5 },
    aheli:  { name: 'Attack Helicopter', short: 'AH', hp: 650, armor: 3, speed: 55, accel: 12, turn: 0.9, crew: 2, seats: 0, len: 14, wid: 2.5, hgt: 3.5, gun: 'heligun', gunRange: 600, gunCd: 0.09, air: true, count: 2, respawn: 200, cost: 6 },
    theli:  { name: 'Transport Helicopter', short: 'UH', hp: 550, armor: 3, speed: 60, accel: 12, turn: 0.8, crew: 2, seats: 10, len: 15, wid: 2.7, hgt: 4, gun: null, air: true, count: 2, respawn: 160, cost: 4 },
  };
  IF.VEH_ORDER = ['mbt', 'ifv', 'apc', 'truck', 'recon', 'arty', 'aheli', 'theli'];

  // damage multipliers: weapon class -> armor class [light, medium, heavy, air]
  IF.ARMOR_MUL = {
    bullet: [0.12, 0.015, 0, 0.05],
    hmg: [0.45, 0.08, 0.01, 0.25],
    autocannon: [1.2, 0.5, 0.08, 1.0],
    rocket: [1.4, 1.2, 1.0, 1.6],
    shell: [1.5, 1.2, 1.0, 1.0],
    he: [1.0, 0.5, 0.25, 0.7],
    mine: [1.5, 1.2, 0.9, 0],
  };

  IF.MEDALS = [
    { id: 'marksman', name: 'Marksman Badge', desc: '25 career headshots', check: (s) => s.headshots >= 25 },
    { id: 'tankbuster', name: 'Tank Buster', desc: 'Destroy 5 vehicles', check: (s) => s.vehiclesDestroyed >= 5 },
    { id: 'lifesaver', name: 'Combat Lifesaver', desc: 'Revive 10 allies', check: (s) => s.revives >= 10 },
    { id: 'objective', name: 'Objective Hero', desc: 'Help capture 15 objectives', check: (s) => s.captures >= 15 },
    { id: 'veteran', name: 'Iron Front Veteran', desc: 'Fight in 5 battles', check: (s) => s.battles >= 5 },
    { id: 'victory', name: 'Victory Cross', desc: 'Win a battle on Veteran or Elite', check: (s) => s.hardWins >= 1 },
    { id: 'leader', name: 'Leadership Ribbon', desc: 'Issue 30 squad commands', check: (s) => s.commands >= 30 },
    { id: 'ace', name: 'Air Defense Ace', desc: 'Shoot down a helicopter', check: (s) => s.helisDown >= 1 },
    { id: 'purple', name: 'Purple Heart', desc: 'Be revived after being downed', check: (s) => s.timesRevived >= 1 },
    { id: 'centurion', name: 'Centurion', desc: '100 career kills', check: (s) => s.kills >= 100 },
    { id: 'armor', name: 'Armor Commander', desc: '25 kills from vehicles', check: (s) => s.vehicleKills >= 25 },
    { id: 'distinguished', name: 'Distinguished Service', desc: 'Score 2500 XP in one battle', check: (s) => s.bestBattleXp >= 2500 },
  ];

  IF.ACHIEVEMENTS = [
    { id: 'firstblood', name: 'First Blood', desc: 'Get a kill in this battle', check: (b) => b.kills >= 1 },
    { id: 'spree', name: 'Unstoppable', desc: '8 kills in one life', check: (b) => b.bestLife >= 8 },
    { id: 'survivor', name: 'Survivor', desc: 'Stay alive 6 minutes', check: (b) => b.longestLife >= 360 },
    { id: 'capper', name: 'Flag Raiser', desc: 'Capture 3 objectives', check: (b) => b.captures >= 3 },
    { id: 'medic', name: 'Guardian Angel', desc: '3 revives', check: (b) => b.revives >= 3 },
    { id: 'tanker', name: 'Steel Rain', desc: 'Destroy a vehicle', check: (b) => b.vehiclesDestroyed >= 1 },
    { id: 'squad', name: 'Leading From the Front', desc: 'Issue 5 squad commands', check: (b) => b.commands >= 5 },
    { id: 'long', name: 'Long Shot', desc: 'Kill at 250m+', check: (b) => b.longest >= 250 },
  ];

  IF.LAYOUTS = [
    { id: 'river', name: 'Danube Crossing', desc: 'A river valley with three contested bridges and a ruined town.' },
    { id: 'highland', name: 'Highland Pass', desc: 'Rolling hills and forests around a mountain radio station.' },
    { id: 'industrial', name: 'Steel Plains', desc: 'Open farmland, a factory district and a frontline airfield.' },
  ];
})(typeof window !== 'undefined' ? window : globalThis);
