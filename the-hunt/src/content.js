// All written story content: documents, collectible notes, radio transmissions, endings.

export const DOCS = {
  // ---- story documents (fixed locations)
  journal: {
    title: 'Torn Journal Page', style: 'hand', where: 'abandoned',
    text: `Day 3.

Dale bagged a doe this morning. Third one since Friday. He says the limit doesn't apply this far in, nobody checks.

Something walked around the tents last night. Big. Slow. It stopped every few steps like it was listening. Dale said elk. Elk don't stand outside a tent for an hour.

There were stick figures hanging over the trail this morning. Tied with fishing line. OUR fishing line.

Marcy wants to go home. I want to go home.

Dale went to check his stand at first light and his radio has been quiet since nine.`,
  },
  relay_letter: {
    title: 'Survey Letter, 1961', style: 'type', where: 'relay', keeper: true,
    text: `NORTHERN TIMBER & LAND CO.
Field Office — Blackpine Valley
September 14, 1961

Mr. Harlan,

Regarding the cancellation of the western survey: I will put it plainly, since the company will not.

Our crew of six entered the valley on the 2nd. They found the old Ochre Creek people's markers — stick effigies, bones arranged in rings — and on my instruction they cleared them for the line.

Four men came back. They speak of a "keeper" the valley people warned of. A thing that stands where the forest is thin and watches those who take from it. Take a little, it watches. Take too much, and it takes in kind.

The two who did not return were the two who shot the most game.

The company has asked that this letter be destroyed. I am leaving it with the relay instead, in case someone needs it more than the company needs its silence.

— W. Pell, Survey Lead`,
  },
  miller_letter: {
    title: 'Letter Never Sent', style: 'hand', where: 'miller', keeper: true,
    text: `Ruth,

I know now why the deer let me get so close this year. They were never afraid of me. They were afraid of what follows me.

I found where it sleeps. NW corner of the valley, past where the trees go white and die. A hollow in the ground with a great pale tree in the middle, and the effigies hanging from every branch like wind chimes. They don't move in the wind. They turn to face you.

The old Ochre Creek story is that the Keeper's heart is the tree. That fire is the only thing it fears. That the tree grew from the first hunter who could not stop.

I am going to burn it, Ruth. I have the lamp oil.

If I don't come home, don't send anyone. Especially not anyone who hunts.

— Walt`,
  },
  logbook: {
    title: 'Station Logbook — R. Voss', style: 'type', where: 'station', required: true,
    text: `BLACKPINE RANGER STATION — DAILY LOG

Oct 2  Hunting party (3) checked in. Reminded them of bag limits. Big talker, the one named Dale.
Oct 4  No check-out from party. Radio relay working intermittently. Generator low on fuel again.
Oct 5  Found their camp by the lake. Tents torn from inside out. No bodies. No blood but the deer's.
Oct 5  Requested search & rescue. County says road is washed out, 3 days minimum.
Oct 6  Locked the north gate per county order. Spare key left at Harlan's old place, under the bed board as usual.
Oct 7  Something on the roof last night.
Oct 8  I've stopped going out after dark. The generator keeps the lights on and the lights keep it back — mostly.
Oct 9  If the station radio still works and you are reading this: fuel the generator (shed, east side), and call on channel 4. They will come. Hold out until they do.
Oct 9  It is standing in the trees right now. It has been standing there since noon.`,
  },
  missing: {
    title: 'Missing Persons — Blackpine Valley', style: 'type', where: 'station', required: true,
    text: `COUNTY SHERIFF — MISSING PERSONS (BLACKPINE S.F.)

1961  Two members of N.T.&L. survey crew. Not recovered.
1974  Gerald Okafor, 52, hunter. Truck found at trailhead. Rifle found 4 mi. north, all rounds fired.
1987  Hunting party of three (Brandt, Lisowski, Brandt). Camp found intact. 11 deer carcasses.
1995  Walter Miller, 61, hunter, of the Miller cabin. Not recovered. Burned patch found in NW sector.
2003  Ranger Thomas Harlan Jr. Not recovered.
2019  Two campers. One recovered, unable to describe events. Repeats the phrase "it counts".
—     Dale Kessler, Marcy Kessler, Tom Reyes. (Hunting party, this season.)

NOTE: Every party on this list exceeded their tag allowance.`,
  },
  voss_private: {
    title: 'Voss — Private Notes', style: 'hand', where: 'station', keeper: true, required: true,
    text: `What I haven't put in the log:

It isn't hunting at random. It follows the ones who take. The more you kill, the closer it comes. The deer know. That's why the forest goes quiet around it.

Light hurts it. Hold a beam on it long enough and it turns away. A rifle round staggers it but does not stop it. Nothing I own stops it.

Walt Miller tried fire, back in '95. Burned half of the hollow in the NW corner before it got to him. The tree grew back.

He didn't have enough oil. I keep kerosene for the lamps. If I don't come back, somebody braver than me should finish what Walt started.

Whatever you do, don't stay in the dark.`,
  },

  // ---- random collectible notes
  note_counts: { title: 'Carved in a Tree Stand', style: 'hand', text: `IT COUNTS YOUR SHOTS\nIT COUNTS YOUR SHOTS\nIT COUNTS` },
  note_whitedeer: { title: 'Note Pinned to a Tree', style: 'hand', text: `To whoever hunts here next:\n\nIf you see a deer that does not run — that stands and stares and does not breathe — do not shoot it. Do not go near it.\n\nIt is not a deer.` },
  note_kid: { title: 'Child\'s Drawing', style: 'hand', text: `[A crayon drawing: a cabin, a stick-figure family, tall dark trees. Between the trees, a figure taller than the trees, with branches on its head. It is coloured over so hard the paper has torn.]\n\n"the tall man waves at me from the woods. daddy says dont wave back."` },
  note_tally: { title: 'Hunter\'s Tally Card', style: 'type', text: `SEASON TALLY — R.B.\n\nMon  doe  ✓\nTue  buck ✓  doe ✓\nWed  doe  ✓\nThu  —  (no deer anywhere. woods silent.)\nFri  —  (heard knocking all night)\nSat` },
  note_ranger: { title: 'Ranger Patrol Memo', style: 'type', text: `PATROL MEMO — 1988\n\nRemind all staff: knocking sounds in the NW sector are to be logged, not investigated. Do not respond in kind. Under no circumstances knock back.` },
  note_radio: { title: 'Scrap of Paper', style: 'hand', text: `Ch. 4 still works from the station if the genny's running.\n\nThe relay on the east hill bounces it to the county.\n\nTold Dale. He laughed.` },
  note_lights: { title: 'Page from a Field Guide', style: 'type', text: `...the animals of the valley are notably skittish after dusk. Visitors report sudden silences of insects and birdsong, often preceding a smell of wet earth and turned soil.\n\n[Handwritten in the margin:] keep a fire going. it won't come near a fire.` },
  note_marcy: { title: 'Marcy\'s Note', style: 'hand', text: `Dale if you find this I went back to the truck.\n\nI saw it standing behind you this morning while you were dressing the deer. It was RIGHT behind you. It looked at me and put its finger to where its mouth should be.\n\nI'm sorry. I can't stay.` },
  note_old: { title: 'Weathered Hide Scrap', style: 'hand', text: `[Faded marks in red ochre. Someone has added a translation in pencil underneath.]\n\n"Take what you need. Leave the rest. The Keeper stands where the forest is thin. Fire is its ending and its beginning."` },
};

export const RANDOM_NOTES = ['note_counts', 'note_whitedeer', 'note_kid', 'note_tally', 'note_ranger', 'note_radio', 'note_lights', 'note_marcy', 'note_old'];

export const TRANSMISSIONS = {
  first: [
    ['...anyone on this channel... this is Tom Reyes...', 3.5],
    ['...we\'re at the camp by the lake... east of the... *static*', 3.5],
    ['...Dale\'s gone. Something took him off his stand...', 3.5],
    ['...it\'s been walking around us all night. Please. Anyone.', 4],
  ],
  loop: [
    ['...repeat, this is Ranger Voss at Blackpine... *static*...', 3.5],
    ['...relay on the east hill... if you can hear this, follow the signal...', 4],
  ],
  random: [
    [['...it\'s in the trees... it\'s just standing there...', 3]],
    [['...don\'t... don\'t answer it if it knocks...', 3]],
    [['*knock* ... *knock* ... *knock*', 3]],
    [['...count... it can count... how many did you take?', 3.5]],
    [['...this is county dispatch, Blackpine, do you copy... *static*', 3.5]],
    [['...Marcy? Marcy, where are you? Answer me—', 3]],
    [['*breathing* ... *static* ... *breathing*', 3]],
    [['...turn around.', 2.5]],
  ],
  rescue: [
    ['County dispatch, we copy you, Blackpine.', 3],
    ['Helicopter is fueling now. E.T.A. four hours. Stay in the light.', 4],
    ['Whatever you do, stay where we can find you.', 3],
  ],
};

export const ENDINGS = {
  escape_blind: {
    title: 'OUT OF THE WOODS',
    text: `The key turns. The barrier lifts. You walk the north road until the pines thin out and the fog lets you go.

You never find out what it was. The ranger, the hunting party, the stick figures — a story you tell no one, because no one would believe it.

Three nights later, in a motel two hundred miles away, someone knocks on your door.

Three times. Wood on wood.`,
  },
  escape_knowing: {
    title: 'THE ONE WHO LEFT',
    text: `You knew what it was. You knew where its heart was. And you walked away.

The barrier closes behind you and the valley swallows its silence again. Next season there will be another hunting party. They will take too much. It will be waiting.

You tell yourself you had no choice.

Some nights you dream of a pale tree, and of everyone hanging from it, turning to face you.`,
  },
  rescue: {
    title: 'SIGNAL',
    text: `The helicopter's light cuts down through the fog like the hand of God. You run for it. Something runs alongside you, just beyond the beam, and then it stops at the edge of the trees and lets you go.

From the air the valley is a black sea. Somewhere down there a light flickers on in the ranger station, though no one is left inside to switch it on.

You were the first one in thirty years to come back and speak.

Nobody believes a word.`,
  },
  hollow: {
    title: 'THE QUIET',
    text: `The heart tree burns until dawn. The effigies curl and blacken and fall one by one. Somewhere in the fire, something screams with the voice of every hunter it ever took — and then nothing.

At first light the birds begin to sing.

You walk out by the north road. You leave your rifle at the gate. The forest has had enough of taking, and so have you.

Behind you, for the first time in a hundred years, Blackpine is only a forest.`,
  },
  keeper: {
    title: 'THE NEW KEEPER',
    text: `The heart tree burns. The thing in the trees falls silent.

But the hollow does not stay empty. You took too much from this valley — more than the others, more than Walt, more than Dale — and the forest remembers who takes.

You do not leave by the north road. You find you do not want to.

Next season a hunting party checks in at the trailhead. On their third night something tall stands at the edge of their camp and watches them.

It wears your coat.`,
  },
  death: {
    title: 'TAKEN',
    text: `The forest goes quiet again.

Next spring a ranger finds your rifle propped against a tree four miles from the trailhead. Every round has been fired.

Above it, tied with fishing line, a new figure made of sticks turns slowly in a wind that isn't there.`,
  },
};

export const TIPS = [
  'Crouch (C) to move quietly. Deer hear running from far away.',
  'Hold Shift while scoped to steady your breathing.',
  'Head and heart shots kill cleanly. Gut shots leave a blood trail.',
  'Animals vanish and the forest falls silent when something is near.',
  'Hold your flashlight beam on it. It hates the light.',
  'A lit campfire keeps it away. Your lighter can relight one.',
  'Sleep in your tent to skip the night and save your progress.',
  'Climb hunting towers to scan for game and landmarks.',
  'Press M for the map. Click it to place markers.',
];
