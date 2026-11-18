# THE HOLLOW

A browser-based 3D psychological monster horror game built with **Three.js** (WebGL).
You play the creature. You hunt people across five places. The game will never move
your body, turn your camera or attack for you. It will, however, lie to your eyes and ears.

Everything (models, textures, animation, sound, voices) is generated procedurally at
runtime. There are no binary assets.

## Running

From the repository root:

```bash
npm install
npm run hollow       # opens http://localhost:5173/hollow/
npm run build        # builds both games into dist/ (THE HOLLOW is dist/hollow/index.html)
```

Use a desktop browser with keyboard and mouse. Headphones make a large difference: all
sound is positional (HRTF). Click the game to take control; Esc pauses.

## Controls

| Input | Action |
| --- | --- |
| W A S D / Mouse | Move / look |
| Shift | Sprint (a loping gallop on all fours — loud) |
| C / hold Ctrl | Crouch / creep (quiet, hard to see) |
| Space | Jump · hold while moving into a wall to climb it (uses stamina) |
| Left mouse | Strike (combo: right, left, two-handed rake) |
| Right mouse | Heavy strike (breaks locked doors) · while sprinting: pounce |
| F (hold) | Feed on someone who is down: lift them and tear them apart limb by limb. Let go of F to drop them |
| E | Interact: doors, notes, tapes, symbols, switches, rifts |
| 1 2 3 4 R 5 6 | Enhanced Senses · Predator Vision · Terrifying Presence · Night Vision · Roar · Mimic · Stalk |
| V | First / third person · Mouse wheel: camera distance |
| Esc / P | Pause |

## What is in the game

**The monster** (`src/actors/monsterModel.js`, `monster.js`) — a 3 m tall digitigrade creature
with a spinal ridge, backswept horns, arms that hang past its knees and a pale, almost human
face set into an elongated skull. Procedural animation: foot-planting two-bone leg IK on uneven
ground and stairs, gait blending (creep, walk, gallop with the arms), jumping, climbing,
three strike variations plus heavy strike and pounce, feeding, roaring, head-look that follows
the camera, breathing. Five appearances (one secret).

**People** (`src/actors/humanoid.js`, `npc.js`) — each NPC is a single skinned mesh (one draw call)
with randomised build, height, skin, hair and clothing, and a painted face with expressions.
Six personalities (calm, nervous, observant, brave, aggressive, panicked) change how they see,
hear and react. They follow routines (walk, chat in pairs, sit, smoke, take phone calls, work,
enter buildings), become uneasy, investigate with flashlights, recognise the monster, scream,
spread panic to others who can see them, flee along a navigation graph that avoids you, hide in
wardrobes/bathrooms/behind cars and close doors behind them, call for help (searchers with
lights arrive later), or confront you — throwing things, swinging at you, or (searchers/guards)
shooting. Downed people crawl away and eventually get up again if you don't feed.

**Hallucinations** (`src/systems/hallucinations.js`) — a director with ~37 event types:
The Presence at the end of hallways, between trees, in windows, on rooftops, behind you in
mirrors, flashing for a fraction of a second, or appearing closer every time you look away;
fake people who vanish; shadows with no source; objects that appear; the world briefly going
abandoned; hallways stretching; trees moving with no wind; a real person turning to stare or
their face going hollow; familiar places subtly changed; and audio-only events (footsteps that
stop when you turn, whispers behind your head, your name if you entered one, voices in walls,
doors, knocking, a phone that stops when you approach, crying, a music box...). Intensity rises
over time and with feeding; quiet periods and sudden unnatural silences are deliberate. NPCs
cannot perceive hallucinations — watching them is your only (unreliable) way to check.

**Maps** (`src/maps/`) — Ashgrove Lane (suburb, furnished houses, a park and playground, the
abandoned 13 Ashgrove with its basement), Blackpine (forest on a heightfield with trails, a lake
and dock, cabins, campsites, a creek bridge, logging site), Harrow City (rain, traffic that
brakes and honks, neon shops you can enter, alleys, a three-level parking structure going
underground, an apartment with a fire escape, a stepped tower you can climb), St. Aldric's
(two floors and a basement, patient rooms, operating rooms, records, a working breaker and
elevator, Theatre B), and The Other Side (floating fragments of every other place, an endless
hallway, a house that should not be there).

**Modes** — Story (5 chapters with objectives, notes, tapes and an ending), Free Hunt, Survival
(waves of searchers, faster hunger, records per map), Nightmare (darker, more hallucinations,
feed to open a rift to somewhere else, endless).

**Gore** — feeding is a hold-to-feed sequence: the monster lifts the victim, rips the limbs off one at a
time (arms and head are eaten, legs are thrown), then drops what is left. Blood sprays, drips, pools on
the ground and splatters the screen; severed limbs and corpses stay in the world and frighten anyone
who sees them. Brutal hits can sever limbs. Settings → Gore → *Reduced* swaps all of this for the
original stylised "drain into ash" presentation.

**Progression** — essence from feeding, notes, symbols, objectives and challenges; spend it in
Evolution on new abilities, ability upgrades, movement/attack upgrades and appearances.

## Performance

Graphics presets (Settings → Graphics):

- **Low** — no shadows, no bloom, 0.7 render scale, 4 dynamic lights, fewer people, shorter view distance. Meant for school laptops / integrated GPUs.
- **Medium** — shadows (1024), bloom, mirrors, 6 lights.
- **High** — 2048 shadows, 9 lights, more grass and particles.

Techniques: static geometry merged per material per spatial chunk (frustum culled), instanced
trees/bushes/grass/windows per chunk, a fixed pool of point lights reassigned each frame to the
nearest of hundreds of "virtual" lights (so shaders never recompile), skinned NPCs as one draw
call each with distance-based update LOD, pooled particles in two draw calls, a spatial-hash
collision world (boxes, cylinders, terrain function), cached terrain heights.

## Code map

```
hollow/
  index.html            menus + HUD markup
  src/main.js           Game: loop, modes, loading, interaction, post-processing parameters
  src/core/             renderer + post FX, input, collision, procedural textures, utils
  src/audio/audio.js    procedural WebAudio engine (all sounds/voices synthesised, HRTF)
  src/actors/           monster model/controller, NPC body + AI, The Presence
  src/systems/          abilities, combat/feeding, hallucinations, NPC manager, nav graph, fx, story, progress
  src/maps/             map builder, props, the five maps, runtime map wrapper
  src/ui/               DOM UI + CSS
```
