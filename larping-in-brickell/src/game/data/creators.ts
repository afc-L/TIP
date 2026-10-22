// Fictional, original adult creators (all 18+) on the fictional AlwaysFans platform.
// Gameplay is strictly business management: negotiation, marketing and growth.

export type Preference = 'money' | 'growth' | 'prestige' | 'respect';

export interface CreatorDef {
  id: string;
  name: string;
  age: number;
  handle: string;
  niche: string;
  venue: string; // POI id where they can be found
  minLevel: number; // clout level needed before they'll take the meeting
  audience: number; // starting subscribers
  growth: number; // base daily growth rate
  professionalism: number; // 1..10
  marketing: number; // 1..10 marketing compatibility
  popularity: number; // 1..10
  preference: Preference;
  maxCommission: number; // highest agency share they consider fair
  personality: string;
  tier: 'Newcomer' | 'Rising' | 'Established' | 'Famous' | 'Celebrity';
  look: { skin: string; hair: string; outfit: string; hairStyle: 'long' | 'short' | 'bun' };
  lines: { greet: string; intrigued: string; accept: string; decline: string; flex: string };
}

export const CREATORS: CreatorDef[] = [
  {
    id: 'kaylee', name: 'Kaylee Brooks', age: 23, handle: '@kayleelifts', niche: 'Fitness & wellness', venue: 'cafe', minLevel: 0,
    audience: 3800, growth: 0.035, professionalism: 7, marketing: 8, popularity: 3, preference: 'respect', maxCommission: 0.35,
    personality: 'Upbeat, disciplined, posts her macros before her coffee.', tier: 'Newcomer',
    look: { skin: '#e8b892', hair: '#d9b36c', outfit: '#ff7eb6', hairStyle: 'long' },
    lines: {
      greet: "Oh hey! Are you the guy with the giant SUV parked across two spots?",
      intrigued: 'Okay, an actual plan with numbers? That is refreshing.',
      accept: "Let's do it. If you can get my growth up, I'm in.",
      decline: "I appreciate it, but I'm not feeling it today. Maybe tomorrow?",
      flex: 'Cool keys. Do they come with a business plan?',
    },
  },
  {
    id: 'mateo', name: 'Mateo Santos', age: 25, handle: '@mateomoves', niche: 'Dance & fitness', venue: 'brunch', minLevel: 1,
    audience: 6200, growth: 0.03, professionalism: 6, marketing: 7, popularity: 4, preference: 'growth', maxCommission: 0.33,
    personality: 'Charismatic, choreographs his life in 15-second segments.', tier: 'Newcomer',
    look: { skin: '#b07a52', hair: '#1a1a1a', outfit: '#3ddcff', hairStyle: 'short' },
    lines: {
      greet: 'Bro, I was literally about to post a story. What do you need?',
      intrigued: 'Growth strategy? Say less. Actually, say more.',
      accept: 'Bet. Send the contract. I read contracts. I have a lawyer cousin.',
      decline: 'Nah, not right now fam. No hard feelings.',
      flex: 'Your car is bigger than my apartment. Respect.',
    },
  },
  {
    id: 'tiana', name: 'Tiana Royale', age: 24, handle: '@tianaroyale', niche: 'Glam & beauty', venue: 'cafe', minLevel: 1,
    audience: 9000, growth: 0.028, professionalism: 8, marketing: 9, popularity: 5, preference: 'prestige', maxCommission: 0.3,
    personality: 'Polished, ruthless about lighting, owns 40 ring lights.', tier: 'Rising',
    look: { skin: '#7a4a33', hair: '#2b1408', outfit: '#d4af6a', hairStyle: 'long' },
    lines: {
      greet: 'You have ninety seconds. I timed my latte.',
      intrigued: 'Hm. You might actually be legit.',
      accept: "Fine. But the brand photoshoots better be in Wynwood with good light.",
      decline: 'Not impressed yet. Come back when your clout matches your car.',
      flex: 'A Maybach? Now we are talking.',
    },
  },
  {
    id: 'marisol', name: 'Marisol Vega', age: 26, handle: '@marisolplays', niche: 'Cosplay & gaming', venue: 'brunch', minLevel: 1,
    audience: 7400, growth: 0.032, professionalism: 7, marketing: 6, popularity: 4, preference: 'money', maxCommission: 0.28,
    personality: 'Speedruns everything, including negotiations.', tier: 'Newcomer',
    look: { skin: '#d9a07a', hair: '#8a2be2', outfit: '#222', hairStyle: 'bun' },
    lines: {
      greet: 'If this is about crypto, I will leave immediately.',
      intrigued: 'Okay, numbers. I like numbers. Keep going.',
      accept: 'Deal. Commission locked. GG.',
      decline: "Bad offer. Skill issue. Try again tomorrow.",
      flex: 'Nice. Does the Maybach have RGB?',
    },
  },
  {
    id: 'dante', name: 'Dante Rivers', age: 28, handle: '@danteriverscoach', niche: 'Fitness coaching', venue: 'network', minLevel: 2,
    audience: 15000, growth: 0.025, professionalism: 9, marketing: 7, popularity: 5, preference: 'respect', maxCommission: 0.3,
    personality: 'Calm, structured, has a spreadsheet for his spreadsheets.', tier: 'Rising',
    look: { skin: '#5a3825', hair: '#111', outfit: '#2e8b57', hairStyle: 'short' },
    lines: {
      greet: 'Good afternoon. I have a hard stop in twelve minutes.',
      intrigued: 'Structured onboarding. Clear KPIs. I respect that.',
      accept: 'Agreed. Send it over and I will sign tonight.',
      decline: "I don't think the timing is right. Let's revisit.",
      flex: 'Cars depreciate. Systems compound.',
    },
  },
  {
    id: 'jade', name: 'Jade Nakamura', age: 27, handle: '@jadeafterdark', niche: 'Fitness & yoga', venue: 'network', minLevel: 2,
    audience: 18000, growth: 0.026, professionalism: 8, marketing: 8, popularity: 6, preference: 'growth', maxCommission: 0.3,
    personality: 'Zen until analytics drop, then extremely not zen.', tier: 'Rising',
    look: { skin: '#f0cfa8', hair: '#0d0d0d', outfit: '#9be0c9', hairStyle: 'long' },
    lines: {
      greet: 'Namaste. Are you here to sell me a course?',
      intrigued: 'A real growth plan. My chakras are interested.',
      accept: "Okay. Let's grow. Mindfully. And fast.",
      decline: "My intuition says no. Today, anyway.",
      flex: 'Attachment to material things is... honestly a nice car though.',
    },
  },
  {
    id: 'sienna', name: 'Sienna Hart', age: 25, handle: '@siennaabroad', niche: 'Swimwear & travel', venue: 'rooftop', minLevel: 2,
    audience: 24000, growth: 0.024, professionalism: 6, marketing: 9, popularity: 6, preference: 'prestige', maxCommission: 0.3,
    personality: 'Has been to Tulum eleven times. Mentions it twelve.', tier: 'Rising',
    look: { skin: '#e9c09a', hair: '#c96a2b', outfit: '#ffffff', hairStyle: 'long' },
    lines: {
      greet: "Oh, you're on the list? I didn't think you'd be on the list.",
      intrigued: 'Brand trips? Okay, you have my attention.',
      accept: 'Yes! Our first agency trip better be somewhere with a cenote.',
      decline: 'Mmm, not this time, babe.',
      flex: 'Is that the Maybach? Can I post it? Tag me.',
    },
  },
  {
    id: 'bianca', name: 'Bianca Ferraro', age: 29, handle: '@biancaonboard', niche: 'Yacht lifestyle', venue: 'marina', minLevel: 3,
    audience: 42000, growth: 0.022, professionalism: 7, marketing: 8, popularity: 7, preference: 'prestige', maxCommission: 0.28,
    personality: 'Only travels by water. Refers to land as "the mainland".', tier: 'Established',
    look: { skin: '#f2d2b6', hair: '#f5e1a4', outfit: '#1e3a8a', hairStyle: 'bun' },
    lines: {
      greet: 'Are you a boat person or a car person? Choose carefully.',
      intrigued: 'You talk like someone with a slip at the marina. Do you?',
      accept: 'Welcome aboard. Literally, eventually, I hope.',
      decline: "You're a car person. I can tell. Not today.",
      flex: 'Cute car. Does it float?',
    },
  },
  {
    id: 'destiny', name: 'Destiny Cole', age: 22, handle: '@destinyunlocked', niche: 'Dance & nightlife', venue: 'club', minLevel: 3,
    audience: 52000, growth: 0.03, professionalism: 5, marketing: 9, popularity: 7, preference: 'money', maxCommission: 0.27,
    personality: 'Chaotic, beloved, unstoppable after midnight.', tier: 'Established',
    look: { skin: '#8a5a3c', hair: '#ff4fa3', outfit: '#111', hairStyle: 'long' },
    lines: {
      greet: 'WHAT? I CAN NOT HEAR YOU. ...Oh, a contract? Talk to me outside.',
      intrigued: 'Wait, you actually pay out on time? That never happens.',
      accept: "Okay let's GO. First check better hit before the weekend.",
      decline: 'Not feeling the vibe. Buy me a water and ask again tomorrow.',
      flex: 'BOUNCE IT. BOUNCE THE CAR. Please.',
    },
  },
  {
    id: 'valentina', name: 'Valentina Cruz', age: 28, handle: '@valentinacruz', niche: 'Fashion modeling', venue: 'restaurant', minLevel: 4,
    audience: 95000, growth: 0.02, professionalism: 9, marketing: 8, popularity: 8, preference: 'respect', maxCommission: 0.25,
    personality: 'Elegant, multilingual, does not do "vibes".', tier: 'Famous',
    look: { skin: '#d8a982', hair: '#2a1a12', outfit: '#8b0000', hairStyle: 'bun' },
    lines: {
      greet: 'I was told someone from an agency would be here. Please, sit.',
      intrigued: 'You are better prepared than the last three managers.',
      accept: 'Very well. We have an agreement.',
      decline: 'Thank you for your time. The answer is no, for now.',
      flex: 'Cars are not a strategy.',
    },
  },
  {
    id: 'amara', name: 'Amara Okafor', age: 26, handle: '@amarasays', niche: 'ASMR & comedy', venue: 'network', minLevel: 4,
    audience: 110000, growth: 0.024, professionalism: 8, marketing: 9, popularity: 8, preference: 'growth', maxCommission: 0.27,
    personality: 'Whispers punchlines. Somehow it works.', tier: 'Famous',
    look: { skin: '#4a2c1d', hair: '#120a06', outfit: '#ffb300', hairStyle: 'short' },
    lines: {
      greet: '(whispering) hi. why are you standing so close to my microphone.',
      intrigued: '(whispering) okay this is actually a good pitch.',
      accept: '(whispering) deal. (normal voice) DEAL.',
      decline: '(whispering) no. (still whispering) but nicely.',
      flex: '(whispering) the car is very loud. even when parked.',
    },
  },
  {
    id: 'luna', name: 'Luna Sterling', age: 30, handle: '@lunasterling', niche: 'Reality TV star', venue: 'rooftop', minLevel: 5,
    audience: 380000, growth: 0.018, professionalism: 7, marketing: 10, popularity: 9, preference: 'prestige', maxCommission: 0.24,
    personality: 'Season 4 villain. Season 5 redemption arc. Season 6 is you.', tier: 'Celebrity',
    look: { skin: '#f3d0b0', hair: '#f0f0f0', outfit: '#c0c0c0', hairStyle: 'long' },
    lines: {
      greet: "Oh my god. You're the Maybach person everyone keeps posting.",
      intrigued: 'Okay, this could be a storyline. I love a storyline.',
      accept: 'Contract signed. Cue dramatic music.',
      decline: "This isn't giving main character. Maybe next season.",
      flex: 'The bounce thing? Iconic. Unhinged. Iconic.',
    },
  },
  {
    id: 'coco', name: 'Coco Delacroix', age: 31, handle: '@cocodelacroix', niche: 'Luxury lifestyle', venue: 'club', minLevel: 6,
    audience: 720000, growth: 0.016, professionalism: 8, marketing: 9, popularity: 10, preference: 'money', maxCommission: 0.22,
    personality: 'Paris-born, Brickell-based, owns more watches than you.', tier: 'Celebrity',
    look: { skin: '#e5b998', hair: '#111', outfit: '#ffd700', hairStyle: 'bun' },
    lines: {
      greet: 'Darling. I have three managers already. Convince me I need a fourth.',
      intrigued: 'Hm. Your numbers do not embarrass me. Continue.',
      accept: "Bon. We are partners. Don't make me regret it.",
      decline: 'Non. Come back with a better yacht.',
      flex: 'I had that car. In 2019. In gold.',
    },
  },
  {
    id: 'rory', name: 'Aurora "Rory" Blaze', age: 27, handle: '@roryblaze', niche: 'Global superstar creator', venue: 'marina', minLevel: 7,
    audience: 1600000, growth: 0.014, professionalism: 9, marketing: 10, popularity: 10, preference: 'prestige', maxCommission: 0.2,
    personality: 'The most-followed creator in Miami. Arrives by helicopter, leaves by yacht.', tier: 'Celebrity',
    look: { skin: '#c68a5e', hair: '#ff8c00', outfit: '#f5f5f5', hairStyle: 'long' },
    lines: {
      greet: 'People wait months for this meeting. You have five minutes.',
      intrigued: "You built all this from one SUV? That's actually a great story.",
      accept: "Let's make Miami history. Draft the press release.",
      decline: 'Not yet. Come find me when you run this city.',
      flex: 'I heard about the bounce. Everyone has heard about the bounce.',
    },
  },
];

export const CREATOR_BY_ID: Record<string, CreatorDef> = Object.fromEntries(CREATORS.map((c) => [c.id, c]));

// Revenue per subscriber per day at popularity 5 (in-game dollars)
export const ARPU = 0.5;
