// Social events. Conversation events use a short choice-driven scoring loop;
// vehicle events run as in-world minigames in the engine.

export type EventKind = 'convo' | 'bounceoff' | 'showoff' | 'carshow' | 'watchmeet' | 'yachtparty' | 'penthouse' | 'showdown';

export interface ConvoOption {
  text: string;
  score: number; // 0..3
  reply: string;
}
export interface ConvoRound {
  speaker: string;
  prompt: string;
  options: ConvoOption[];
}

export interface EventDef {
  id: string;
  name: string;
  poi: string;
  kind: EventKind;
  minLevel: number;
  requires?: string; // property / yacht / vehicle requirement key
  requiresLabel?: string;
  blurb: string;
  reward: { cash: number; clout: number };
  rounds?: ConvoRound[];
  rival?: string;
}

export const EVENTS: EventDef[] = [
  {
    id: 'bounceoff', name: 'Brickell Bounce-Off', poi: 'carmeet', kind: 'bounceoff', minLevel: 0, requires: 'maybach', requiresLabel: 'Arrive in the Maybach',
    blurb: "Car meet suspension battle. Match the judge's calls with the right bounce style and intensity.", reward: { cash: 6000, clout: 30 },
  },
  {
    id: 'showoff', name: 'Miami Showoff', poi: 'showoff', kind: 'showoff', minLevel: 1,
    blurb: 'A timed vehicle presentation on the Bayfront Promenade. Hit every beat before the clock runs out.', reward: { cash: 9000, clout: 40 },
  },
  {
    id: 'carshow', name: 'Luxury Car Meet', poi: 'carmeet', kind: 'carshow', minLevel: 1,
    blurb: 'Park it, polish it, let the judges stare. Scored on prestige, mods and your clout.', reward: { cash: 5000, clout: 25 },
  },
  {
    id: 'mixer', name: 'Creator Networking Mixer', poi: 'network', kind: 'convo', minLevel: 0,
    blurb: 'Badges, cold brew and everyone pretending to be important. Great for recruiting.', reward: { cash: 3000, clout: 25 },
    rounds: [
      { speaker: 'Founder in a quarter-zip', prompt: '"So what do you do? I am building an app that is like Uber, but for apps."', options: [
        { text: 'I run a creator-management agency. We grow audiences with real campaigns.', score: 3, reply: '"Wow, an actual business. With actual customers?"' },
        { text: 'I am a serial entrepreneur. Mostly cereal.', score: 1, reply: '"...Haha. Okay. Haha."' },
        { text: 'Point silently at your Maybach keys.', score: 0, reply: '"Cool keys. Anyway."' },
      ] },
      { speaker: 'A creator looking for management', prompt: '"How do I know an agency is not going to take 60% and ghost me?"', options: [
        { text: 'Transparent contracts. You see the split and the projections before you sign.', score: 3, reply: '"That is literally all I wanted to hear."' },
        { text: 'Trust me, bro.', score: 0, reply: '"Yeah... no."' },
        { text: 'Our creators grow or we cut our commission next month.', score: 2, reply: '"Bold. I like bold."' },
      ] },
      { speaker: 'Gloria Esteban-Watts (investor)', prompt: '"What is your unit economics story?"', options: [
        { text: 'Recurring commission, low overhead, campaigns that compound.', score: 3, reply: '"Finally, someone who has opened a spreadsheet."' },
        { text: 'Vibes. Mostly vibes.', score: 1, reply: '"I have funded worse. Not much worse."' },
        { text: 'We are post-revenue and pre-yacht.', score: 2, reply: '"Ha! Keep me posted on the yacht."' },
      ] },
    ],
  },
  {
    id: 'rooftop', name: 'Sunset Rooftop Gathering', poi: 'rooftop', kind: 'convo', minLevel: 2,
    blurb: 'Golden hour, rosé and brand managers. Brand deals happen here.', reward: { cash: 12000, clout: 45 },
    rounds: [
      { speaker: 'Brand manager (energy drinks)', prompt: '"We want creators who are authentic. Authentically on-brand."', options: [
        { text: 'My roster has real engagement. I can send you the analytics now.', score: 3, reply: '"Send it. Immediately. Please."' },
        { text: 'Authenticity is my brand. I bought it last week.', score: 1, reply: '"...I respect the honesty?"' },
        { text: 'How many cans do you need us to hold?', score: 2, reply: '"Ideally all of them. At once."' },
      ] },
      { speaker: 'Rooftop DJ', prompt: '"Yo, you want me to shout you out on the mic?"', options: [
        { text: 'Shout out the creators, not me.', score: 3, reply: '"Class act! Making some noise for the roster!"' },
        { text: 'Yes. Say I own the building.', score: 1, reply: '"...I am not legally allowed to say that."' },
        { text: 'Only if you mention the Maybach bounces.', score: 2, reply: '"THE BOUNCE GUY IS IN THE BUILDING!"' },
      ] },
      { speaker: 'Mysterious watch collector', prompt: '"Interesting wrist. What are you wearing?"', options: [
        { text: 'Tell them about your watch with genuine passion.', score: 2, reply: '"A person of taste."' },
        { text: '"It\'s not about the watch, it\'s about the time we share."', score: 3, reply: '"...Oh, that is good. Can I use that?"' },
        { text: 'Lie and say it is a prototype.', score: 0, reply: '"It has a price tag still on it."' },
      ] },
    ],
  },
  {
    id: 'dinner', name: 'Exclusive Business Dinner', poi: 'restaurant', kind: 'convo', minLevel: 4,
    blurb: 'A twelve-course dinner with investors. Each course costs more than your first car.', reward: { cash: 60000, clout: 90 },
    rounds: [
      { speaker: 'Private equity partner', prompt: '"We are looking at the creator economy. Why should we look at you?"', options: [
        { text: 'Diversified roster, rising retention, disciplined spending.', score: 3, reply: '"Discipline. Rare in this zip code."' },
        { text: 'Because I have a Maybach that bounces.', score: 1, reply: '"...We will come back to that."' },
        { text: 'Because everyone else is renting their lifestyle.', score: 2, reply: '"Ha. Accurate."' },
      ] },
      { speaker: 'Sommelier', prompt: '"For the table, the 1982 or the 1996?"', options: [
        { text: 'Whatever pairs with the fish.', score: 3, reply: '"Excellent instinct, sir."' },
        { text: 'The most expensive one. Twice.', score: 1, reply: '"...Very well."' },
        { text: 'Do you have Prime?', score: 0, reply: '(the room goes silent)' },
      ] },
      { speaker: 'Media mogul', prompt: '"Pitch me a show about your agency."', options: [
        { text: '"Larping in Brickell": one SUV, zero chill, one dream.', score: 3, reply: '"Greenlit. In spirit."' },
        { text: 'A documentary about responsible budgeting.', score: 2, reply: '"Niche, but bold."' },
        { text: 'A reality show about my watch collection.', score: 1, reply: '"...Next."' },
      ] },
    ],
  },
  {
    id: 'watchmeet', name: "Watch Collectors' Meetup", poi: 'watch', kind: 'watchmeet', minLevel: 2,
    blurb: 'Collectors compare wrists. Scored by the total value of your collection.', reward: { cash: 4000, clout: 35 },
  },
  {
    id: 'launch', name: 'Marketing Launch Event', poi: 'hq', kind: 'convo', minLevel: 5, requires: 'hq', requiresLabel: 'Own the Agency HQ',
    blurb: 'Launch a roster-wide campaign at HQ. Boosts every creator.', reward: { cash: 0, clout: 120 },
    rounds: [
      { speaker: 'Your Marketing Lead', prompt: '"What is the headline for the launch?"', options: [
        { text: '"Real creators. Real growth. Real contracts."', score: 3, reply: '"Strong. Printing the banners."' },
        { text: '"We bounce, therefore we are."', score: 2, reply: '"Weird. Memorable. Fine."' },
        { text: '"Like, subscribe and believe."', score: 1, reply: '"That is a church slogan."' },
      ] },
      { speaker: 'Press', prompt: '"Is it true your agency started with a single SUV?"', options: [
        { text: 'Yes. And one very loyal valet.', score: 3, reply: '"That is the headline!"' },
        { text: 'No comment. (Smirk.)', score: 2, reply: '"Mysterious. Readers love that."' },
        { text: 'I was born on a yacht.', score: 0, reply: '"You were born in Kendall."' },
      ] },
      { speaker: 'Your roster', prompt: 'Your creators look at you expectantly.', options: [
        { text: 'Give the credit to the creators.', score: 3, reply: 'Applause. Genuine applause.' },
        { text: 'Give a 40-minute speech about yourself.', score: 0, reply: 'Someone fell asleep.' },
        { text: 'Bounce the Maybach outside as a finale.', score: 2, reply: 'The press goes wild.' },
      ] },
    ],
  },
  {
    id: 'yachtparty', name: 'Yacht Party', poi: 'marina', kind: 'yachtparty', minLevel: 4, requires: 'yacht', requiresLabel: 'Own a yacht',
    blurb: 'Host creators, contacts and rivals aboard your yacht. Huge clout.', reward: { cash: 20000, clout: 150 },
  },
  {
    id: 'penthouse', name: 'Penthouse Soirée', poi: 'penthouse', kind: 'penthouse', minLevel: 6, requires: 'penthouse', requiresLabel: 'Own the penthouse',
    blurb: 'Invite the city to the top of Aurum Tower.', reward: { cash: 15000, clout: 140 },
  },
  {
    id: 'showdown_chase', name: 'Showdown: Chase Valentino', poi: 'cafe', kind: 'showdown', minLevel: 2, rival: 'chase',
    blurb: 'Quarterly agency showdown. Compare roster revenue, clout and audience.', reward: { cash: 25000, clout: 60 },
  },
  {
    id: 'showdown_brielle', name: 'Showdown: Brielle Monroe', poi: 'restaurant', kind: 'showdown', minLevel: 4, rival: 'brielle',
    blurb: 'Beat the Monroe Collective on revenue and prestige.', reward: { cash: 120000, clout: 150 },
  },
  {
    id: 'showdown_dmitri', name: "Showdown: Dmitri 'Drip' Kovac", poi: 'marina', kind: 'showdown', minLevel: 6, rival: 'dmitri',
    blurb: 'The final business battle for Brickell.', reward: { cash: 500000, clout: 400 },
  },
];

export const EVENT_BY_ID = Object.fromEntries(EVENTS.map((e) => [e.id, e]));
