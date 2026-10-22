// Ambient, valet and reaction dialogue. Picked contextually by the engine.

export const VALET_LINES: string[][] = [
  // by valet respect tier 0..3
  [
    'Keys, please. Ticket number 4,017. We will... find it.',
    'Self-park is around the block, but okay, I can take it.',
    'Nice SUV. Is it yours? Just asking for the form.',
  ],
  [
    'Welcome back. Front row, as usual?',
    'Oh, the Maybach! Good to see you again, boss.',
    'I will keep it right out front where people can see it.',
  ],
  [
    'The Maybach is back. Should I clear the front entrance?',
    '{nick}! The manager said to give you the VIP spot.',
    "Everyone's been asking when you'd show up, {nick}.",
  ],
  [
    'Clear the entrance! The King of Brickell has arrived!',
    '{nick}, your table is ready and the photographers are waiting.',
    'We named a parking spot after you, {nick}. It is gold.',
  ],
];

export const BOUNCE_REACTIONS: Record<string, string[]> = {
  executive: [
    'Is that car... breathing?',
    'Very subtle. Very expensive.',
    'Oh, executive suspension. Classy.',
    'The car is nodding at me. I nod back.',
  ],
  brickell: [
    'Bro, did your suspension just start dancing?',
    'THE MAYBACH IS BOUNCING!',
    'Okay that is actually hard.',
    'Somebody get this on camera!',
    'A bouncing Maybach in Brickell. I have seen everything.',
  ],
  miami: [
    'MIAMI MODE!! LET IT FLY!',
    'That SUV is having the best night of its life!',
    'Sir, the car is trying to escape!',
    'I came to Brickell for this exact moment.',
    'This is the most Miami thing that has ever happened.',
    'My hairline is bouncing with it!',
  ],
};

export const LUXURY_REACTIONS = [
  'Whoa, is that a {car}?',
  'Bet it is leased.',
  'Somebody is doing well. Or pretending.',
  'Okay, nice ride.',
  'Look at the wheels on that thing!',
  'Can I get a picture with the car?',
];

export const PED_CHATTER = [
  "I'm basically a founder. Pre-revenue, pre-product, pre-idea.",
  'My rent is due but my watch is not.',
  'Have you tried the gold-leaf croissant?',
  'He says he is in "private equity". He means his roommate.',
  'Sorry, I only date people with a slip at the marina.',
  'Can you believe the valet asked for my keys AND a tip?',
  'I am launching a podcast about launching podcasts.',
  "That's not a real Rolex. It is a Rolecks.",
  'Brickell is the Manhattan of the south. I read that on a tote bag.',
  'Wait, is that the Maybach guy?',
  'I heard someone bought VOLT. Rich or reckless?',
];

export const FAMOUS_CHATTER = [
  'OMG it is {nick}!',
  '{nick}! Can I get a selfie?',
  'That is {nick} from AlwaysFans management!',
  'I follow you! Big fan of the bounce!',
];

export const CRASH_LINES = [
  'HEY! Watch it!',
  'That is going to come out of your clout.',
  'Do you even have insurance?!',
  'My smoothie!',
];

export const SOCIAL_AMBIENT = [
  { author: 'Brickell Daily', handle: '@brickelldaily', text: 'Traffic report: everyone is double-parked, as usual. ☀️' },
  { author: 'Miami Rent Watch', handle: '@rentwatchmia', text: 'Studio apartments in Brickell now cost one (1) kidney per month.' },
  { author: 'Gold Leaf Foodie', handle: '@goldleafbites', text: "Salt & Status's new $400 steak comes with a certificate of authenticity. 🥩✨" },
  { author: 'Car Spotter MIA', handle: '@carspottermia', text: 'Spotted: 14 matte green supercars on Brickell Ave. 13 are leased. One is a wrap.' },
  { author: 'Founder Mode', handle: '@foundermode305', text: 'Woke up at 4am. Cold plunge. Gratitude journal. Still pre-revenue. 💪' },
  { author: 'Yacht Gossip', handle: '@yachtgossip', text: 'Someone just asked if the marina takes Afterpay.' },
  { author: 'VOLT Nightclub', handle: '@voltmiami', text: 'Tonight: bass, lasers, and bottle sparklers. Dress code: expensive.' },
  { author: 'Brickell Weather', handle: '@brickellwx', text: 'Forecast: 90°F, 100% humidity, 0% chance anyone admits they are renting.' },
];
