// Rival creator-management agencies. All characters are original and fictional.

export interface RivalDef {
  id: string;
  name: string;
  agency: string;
  handle: string;
  personality: string;
  strategy: string;
  vehicle: string;
  venue: string; // where they hang out
  startClout: number;
  startRoster: number;
  startRevenue: number;
  growth: number; // daily clout growth
  minLevel: number; // showdown availability
  color: string;
  look: { skin: string; hair: string; outfit: string };
  lines: string[];
  loseLine: string;
  winLine: string;
}

export const RIVALS: RivalDef[] = [
  {
    id: 'chase', name: 'Chase Valentino', agency: 'Valentino Talent Group', handle: '@chasethebag', personality: 'Loud, rented-lambo energy, calls everyone "king".',
    strategy: 'Volume: signs everyone, keeps nobody.', vehicle: 'A matte green supercar (leased)', venue: 'cafe',
    startClout: 150, startRoster: 4, startRevenue: 6000, growth: 6, minLevel: 2, color: '#3f6',
    look: { skin: '#e2b48c', hair: '#3a2a1a', outfit: '#3f6' },
    lines: [
      "You have a lot of clout for someone whose business expenses are doing that much damage.",
      "King! Love the Maybach. Is that the one you're paying off until 2031?",
      'My creators get 40% more engagement because I say so on my podcast.',
      "I'd offer you a job but my interns are overqualified.",
    ],
    loseLine: "Okay okay. You win this one, king. I'm still taking the photo though.",
    winLine: 'Better luck next quarter. Maybe sell a watch.',
  },
  {
    id: 'brielle', name: 'Brielle Monroe', agency: 'Monroe Collective', handle: '@briellemonroe', personality: 'Icy, strategic, color-codes her enemies.',
    strategy: 'Prestige: only signs established creators.', vehicle: 'A white ultra-luxury sedan with a driver', venue: 'restaurant',
    startClout: 500, startRoster: 5, startRevenue: 30000, growth: 12, minLevel: 4, color: '#fff',
    look: { skin: '#f1d3bd', hair: '#efe3c2', outfit: '#f5f5f5' },
    lines: [
      'I respect the hustle. I also respect a positive cash flow.',
      "Your roster is cute. Like a starter Pokémon.",
      'I saw your car bounce outside. Bold choice. Wrong, but bold.',
      'We should collaborate. By which I mean you should give me your creators.',
    ],
    loseLine: "Fine. Well played. I'll be adding you to a color-coded list.",
    winLine: "Don't feel bad. Very few people beat me. Actually nobody.",
  },
  {
    id: 'dmitri', name: "Dmitri 'Drip' Kovac", agency: 'DRIP Syndicate', handle: '@dripkovac', personality: 'Old money cosplay, new money reality, owns a yacht he never takes out.',
    strategy: 'Celebrity: courts the biggest names with yacht parties.', vehicle: 'A gold-wrapped hypercar', venue: 'marina',
    startClout: 1600, startRoster: 6, startRevenue: 120000, growth: 22, minLevel: 6, color: '#d4af37',
    look: { skin: '#dcb592', hair: '#111', outfit: '#d4af37' },
    lines: [
      'You know what they call a yacht that never leaves the dock? Mine. And it is still bigger than yours.',
      'Your watch is nice. I have it in three colors.',
      'Brickell has room for only one king. And I already bought the crown on credit.',
      'Come to my yacht party. Oh wait, you are not on the list.',
    ],
    loseLine: 'Unbelievable. The bounce guy beat me. Write that down nowhere.',
    winLine: 'Come back when your yacht has a helipad.',
  },
];

export const RIVAL_BY_ID = Object.fromEntries(RIVALS.map((r) => [r.id, r]));

// Business contacts: NPCs that give tips, referrals and missions.
export interface ContactDef {
  id: string;
  name: string;
  role: string;
  venue: string;
  look: { skin: string; hair: string; outfit: string };
  lines: string[];
}

export const CONTACTS: ContactDef[] = [
  {
    id: 'marco', name: 'Marco "Valet King" Ruiz', role: 'Head valet, knows everyone', venue: 'restaurant',
    look: { skin: '#b9825a', hair: '#111', outfit: '#111' },
    lines: [
      'Valet tip: arrive slow, stop in the zone, and let the car speak. Bounce mode speaks louder.',
      'I park cars for half the agency managers in Brickell. Most of them are leased.',
      "You want respect from valets? Show up in something expensive and don't scratch the curb.",
    ],
  },
  {
    id: 'gloria', name: 'Gloria Esteban-Watts', role: 'Angel investor', venue: 'network',
    look: { skin: '#e9c3a0', hair: '#5a3a24', outfit: '#264653' },
    lines: [
      'I respect the hustle. I also respect a positive cash flow.',
      'Every founder in this room says they are pre-revenue. Be post-revenue.',
      'Marketing campaigns compound. Watches do not. Mostly.',
    ],
  },
  {
    id: 'palmetto', name: 'DJ Palmetto', role: 'Nightlife legend', venue: 'club',
    look: { skin: '#6b4430', hair: '#ffcc00', outfit: '#7b2cbf' },
    lines: [
      'If you ever buy VOLT, I am your resident DJ. My rate is "yes".',
      'Club events print money if the room is full. Empty rooms print regret.',
      'Lighting rig first, sound second, ego third.',
    ],
  },
  {
    id: 'yuki', name: 'Captain Yuki Tanaka', role: 'Yacht broker', venue: 'marina',
    look: { skin: '#f0cfa8', hair: '#222', outfit: '#ffffff' },
    lines: [
      'First you need a slip. Then you need a boat. Then you need therapy for the upkeep.',
      'The Leviathan Gold 180 is the endgame. Helipad. Beach club. Ego.',
      'A yacht is a hole in the water you throw money into. A beautiful hole.',
    ],
  },
];
export const CONTACT_BY_ID = Object.fromEntries(CONTACTS.map((c) => [c.id, c]));
