import type { CharacterDef, CharacterId } from './types';

export const CHARACTERS: CharacterDef[] = [
  {
    id: 'bonker', name: 'BONKER', title: 'The Original Bonk',
    description: 'A sturdy brawler with an oversized hammer and no plan beyond "hit it harder".',
    color: '#ff9f1c', baseHp: 120, moveSpeed: 6.2, weapon: 'hammer',
    passiveName: 'Heavy Hands', passiveText: '+50% knockback and +5% damage.',
    stats: { knockbackMult: 1.5, damageMult: 1.05 }, difficulty: 1,
  },
  {
    id: 'runner', name: 'THE RUNNER', title: 'Fastest Feet Alive',
    description: 'Never stops moving. Knife-throwing courier who outruns the horde.',
    color: '#2ec4b6', baseHp: 90, moveSpeed: 7.6, weapon: 'knives',
    passiveName: 'Long Reach', passiveText: '+60% pickup radius and +5% move speed.',
    stats: { pickupRadius: 1.6, moveSpeed: 1.05 }, difficulty: 2, unlock: 'level_10',
  },
  {
    id: 'scrapRat', name: 'SCRAP RAT', title: 'Tinkerer of the Dump',
    description: 'Small, fragile and greedy. Her whirling scrap blades keep the crowd at bay.',
    color: '#c77dff', baseHp: 80, moveSpeed: 6.8, weapon: 'blades',
    passiveName: 'Scavenger', passiveText: '+60% gold gained, +15 luck.',
    stats: { goldGain: 1.6, luck: 15 }, difficulty: 2, unlock: 'kills_1000_total',
  },
  {
    id: 'wizard', name: 'THE WIZARD', title: 'Overcaffeinated Archmage',
    description: 'Glass cannon spellcaster. Hurls arcane orbs with alarming frequency.',
    color: '#4361ee', baseHp: 75, moveSpeed: 6.0, weapon: 'orb',
    passiveName: 'Quick Casting', passiveText: '-15% weapon cooldowns, +10% duration.',
    stats: { cooldownMult: 0.85, durationMult: 1.1 }, difficulty: 3, unlock: 'first_boss',
  },
  {
    id: 'moose', name: 'IRON MOOSE', title: 'Armored Avalanche',
    description: 'Huge, slow and wrapped in plate. Lowers his antlers and plows through everything.',
    color: '#8d99ae', baseHp: 170, moveSpeed: 5.2, weapon: 'charge',
    passiveName: 'Plated Hide', passiveText: '+8 armor and +30% knockback resistance.',
    stats: { armor: 8, knockbackResist: 0.3 }, difficulty: 1, unlock: 'survive_10',
  },
];

export const CHARACTER_MAP = Object.fromEntries(CHARACTERS.map((c) => [c.id, c])) as Record<CharacterId, CharacterDef>;
