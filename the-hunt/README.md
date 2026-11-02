# THE HUNT

A first-person survival-horror hunting game that runs in the browser. You came to
Blackpine State Forest for an ordinary hunting trip. You track deer, set up camp and
cook what you shoot. Then the animals start disappearing, the birds go quiet, and
something tall starts standing between the trees, watching you.

Built with **Three.js**. Every model, texture and sound is generated in code, so the
whole game fits in one ~760 KB HTML file.

## Playing it

**Easiest (no install, works offline):** double-click **`TheHunt.html`**. It opens in
your browser and runs with no server.

**From source (for development):**

```bash
npm install
npm run hunt          # dev server, opens the game in your browser
npm run hunt:build    # rebuilds TheHunt.html from src/
```

Use Chrome, Safari, Edge or Firefox on a computer with a mouse. Headphones are
strongly recommended because the sound is directional. Click the game to capture the
mouse. **Esc** releases it and pauses.

### If it runs slowly (school laptops)

Open **Settings** and try, in this order:

1. **Render scale** → 67% (or 50%)
2. **Graphics quality** → Low (turns off shadows and anti-aliasing and shortens the
   detail distance)
3. **View distance** → 100 m

You can tick **Show FPS** in Settings to check the frame rate.

## Controls

| Key | Action |
| --- | --- |
| W A S D | Move |
| Mouse | Look |
| Shift | Sprint · hold while scoped to steady your breathing |
| C / Ctrl | Crouch (quieter; animals notice you less) |
| Space | Jump |
| E | Interact, pick up, read, climb, field-dress a kill |
| F | Flashlight (with no battery left, F swaps in a spare) |
| Right mouse | Aim (rifle scope / binoculars zoom) |
| Left mouse | Fire |
| R | Reload |
| 1 / 2 / 3, wheel, B | Rifle / binoculars / handheld radio |
| Q | Eat the best food you're carrying |
| H | Use a first aid kit |
| Tab | Backpack: supplies, hunting record, documents |
| M | Map: click it to place or remove markers |
| Esc | Pause |

## What's in it

- **Hunting.** Deer herds (bucks and does) and rabbits graze, wander, hear your
  footsteps, see you move, freeze and stare, then bolt. They leave hoof prints you can
  follow. Head and heart shots kill cleanly. A gut shot leaves a wounded animal and a
  blood trail. A bolt-action scoped rifle with a 5-round magazine, breath-holding and
  scope sway, binoculars with a rangefinder and animal ID, and field dressing. Score
  depends on species, clean kills and shot distance.
- **Survival.** Health, hunger, stamina, flashlight battery, ammunition and a backpack
  with carry limits. Supplies are spread through cabins, hunting towers and abandoned
  gear in the woods. Cook venison at your campfire. Sleep in your tent to skip the night
  and save.
- **A big forest.** About 720 × 720 m of pine and spruce, clearings, a lake with an
  old dock, logging roads and trails, four climbable hunting towers, two cabins, an
  abandoned campsite, a radio relay on a hill, the old ranger station, a locked north
  gate, and somewhere in the north-west, a place that isn't on any map.
- **Day/night and weather.** Overcast, mist, heavy fog, rain and storms with
  lightning. One in-game hour takes one real minute. Nights are dark: the flashlight
  matters, wildlife thins out, and the creature is bolder.
- **The Keeper.** Its AI watches from far away, follows you out of sight with footsteps
  that match yours, disappears when you get close or stare too long, turns up where it
  shouldn't, and later in the story hunts you at night. It is never unfair: hold your
  light on it to drive it off, shoot it to stagger it, or stand by a lit campfire,
  which it won't approach. The more animals you kill, the sooner it comes.
- **Horror events.** Branch snaps behind you, wood knocks far away, sudden total
  silence, whispers, flickering flashlight, stick effigies that weren't there before,
  mutilated carcasses, stampedes running from something, and a deer that stands on its
  hind legs and stares.
- **Story.** Objectives lead from setting up camp, through tracking your first deer, a
  distress call, the abandoned campsite and a radio signal, to the ranger station's
  records. Notes and documents tell the valley's history. Random lore notes change from
  one run to the next.
- **Five endings.** These depend on what you discovered, what you chose and how much
  you took from the forest. Dying has its own ending.
- **Replayability.** Supply and key-item locations, animal spawns, lore notes, weather,
  radio chatter and every creature encounter are randomised for each run.
- **Saving.** Progress is saved in your browser when you sleep, at story milestones,
  periodically, and when you quit to the menu. Use **Continue** on the main menu.

## Code layout

```
the-hunt/
  index.html          page + all UI markup
  build.mjs           bundles everything into TheHunt.html
  src/
    main.js           game loop, states, menus, save/load, shooting, world hooks
    world.js          terrain heightfield, roads, lake, vegetation chunks/LOD, collision & raycasts
    structures.js     cabins, towers, ranger station, relay, gate, dock, camps, the Hollow
    models.js         procedural low-poly models (trees, deer, creature, rifle, items…)
    textures.js       canvas-generated textures
    environment.js    day/night cycle, sky, fog, weather, particles
    player.js         first-person controller and survival stats
    equipment.js      rifle, binoculars, radio, flashlight, viewmodel rendering
    animals.js        wildlife AI, tracks and blood trails, harvesting, scoring
    creature.js       the Keeper's encounter director and behaviours
    events.js         ambient horror events
    story.js          objectives, interactables, loot, documents, endings
    content.js        all written text (documents, radio, endings)
    audio.js          procedural WebAudio sound design (HRTF positional)
    effects.js        fire, impact puffs, pooled point lights
    inventory.js      backpack
    ui.js             HUD, compass, map, backpack, document reader
```

Performance: trees are instanced per 60 m chunk with near and far LODs, and
distance-culled behind the fog. Point lights are pooled so shader programs never
recompile. Shadow maps update every other frame (rarely at night). DOM writes are
cached.
