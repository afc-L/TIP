# LARPING IN BRICKELL

A browser-based 3D open-world luxury lifestyle simulator, business tycoon and driving game set in a
fictional, recognisable Brickell (Miami). You start with one Mercedes-Maybach GLS 600, a rented studio and
$25,000, and try to become the **King of Brickell** by building an AlwaysFans creator-management agency,
collecting cars and watches, buying a nightclub, a penthouse and a superyacht, while keeping the monthly
bills from eating the dream.

It's satirical: it makes fun of fake wealth, influencer culture and clout chasing. The business gameplay is
management only (negotiation, marketing, growth). There is no explicit content, every creator is a fictional
adult (18+), and every creator is free to say no.

Built with **React 19 + TypeScript + Vite 8 + Three.js**. Every model, texture, sound and music loop is
generated in code, so the game ships with no external assets.

## Running

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-checks, then builds a static site into dist/ (relative paths, deploy anywhere)
npm run preview    # serve the production build
```

Use a desktop browser with WebGL2 and a keyboard and mouse. Click the game view to capture the mouse; Esc
releases it and pauses. A gamepad also works: left stick to move, right stick to look, triggers to drive,
A to interact, Y to bounce, Start to pause, Back for the phone.

## Controls

| Key | Action |
| --- | --- |
| W A S D | Move / drive (S brakes, then reverses) |
| Mouse | Look around / orbit the camera |
| Shift | Sprint |
| Space | Jump · handbrake while driving |
| E | Interact · enter / exit vehicle |
| F | Vehicle actions (start events at the car meet / promenade, dock the yacht) |
| C | Camera: on foot normal/close · driving chase/far/cockpit |
| **B** | **Toggle Maybach hydraulic bounce mode** |
| 1 · 2 · 3 | Bounce style: Executive · Brickell · Miami Mode |
| Z · X | Bounce intensity − / + |
| V | Maybach settings (infotainment panel) |
| H · L | Horn · headlights |
| Tab | Smartphone |
| M | City map (click to set a waypoint) |
| Esc | Pause / close menu |

## What's in the game

- **The city**: a 6×6 grid of Brickell blocks with glass towers, condo towers, Brickell Ave, Bayshore Dr,
  a waterfront promenade, Biscayne Bay, a marina with piers, a parking garage, a car meet under an
  overpass, parks, palms, street lamps, street signs and a skyline beyond the playable area. There is
  ambient traffic that yields to you, pedestrians who dodge, stare and comment, and a full day/night cycle
  with lit windows, neon and glowing tower crowns.
- **The Maybach GLS 600**: an arcade driving model with a heavy SUV feel, a two-tone obsidian/Kalahari-gold
  body, a chrome vertical-bar grille, a white leather interior with ambient lighting, rear executive seats,
  a working dash screen, brake lights and headlights, plus chase, far and cockpit cameras.
- **Hydraulic bounce mode** (`src/game/engine/bounce.ts`): four independent hydraulic corners (spring and
  damper, sub-stepped) chase a target pattern. The pattern moves a separate chassis transform (heave, pitch,
  roll) while the wheels stay planted. Chrome struts stretch, and the wheels hop when the body exceeds
  suspension travel. The physics root never moves vertically, so the car can't launch or clip. There are
  three distinct styles:
  - *Executive*: slow, synchronised breathing.
  - *Brickell*: punchy alternating nose-to-tail hops.
  - *Miami Mode*: fast heave, side-to-side roll, random front hops and pump whine.
  Intensity runs from 0 to 100%, plus ride height, stiffness and a separate SFX volume. The effect is
  limited automatically at speed, and Miami Mode drops to Brickell above about 25 km/h. NPCs react, valets
  notice, and it's scored in the **Brickell Bounce-Off** and the **Miami Showoff**.
- **AlwaysFans agency**: 14 fictional adult creators at venues around the city. Pitches move a visible
  interest meter, and contracts set a commission split, a duration and an optional growth stipend, with the
  projected commission and acceptance odds shown before you commit. Creators can decline, which puts them on
  a cooldown. Signed creators generate daily revenue from audience × popularity, grow with campaigns,
  staff and upgrades, have a satisfaction score, and need renewing.
- **Business**: 7 marketing campaigns with transparent flop/solid/viral odds, 7 agency upgrades, 5 staff
  roles, and account-manager capacity.
- **Money**: commissions are paid at midnight. Bills (vehicles, property, staff, operations, club, yacht and
  lifestyle) arrive at the end of every 7-day month with a full **monthly report**. If you go into the red
  you can recover by selling cars or watches, winning events and running brand deals. No single mistake
  ends the game.
- **Brickell Clout**: 8 levels from *Unknown* to *King of Brickell*, each unlocking creators, cars,
  properties, watches and events.
- **Purchases**: 10 vehicles (fictional makes, rotating 3D showroom) with paint, two-tone, wheels, tint,
  interior, underglow, engine and handling upgrades. Also 8 original watches (shown on your character's
  wrist), 6 outfits, homes up to a walkable penthouse on top of Aurum Tower, an office and an HQ, the walkable
  **VOLT nightclub** (renovations, themed events, nightly revenue), and three **yachts** with a walkable deck
  that you can sail on the bay.
- **Missions**: a 28-step main story plus 9 side jobs and 17 achievements. There are also 3 rival managers
  with showdowns who poach prospects, 4 business contacts, 13 events (car meet, showoff, networking
  mixer, rooftop, business dinner, watch meetup, launch, yacht party, penthouse soirée, showdowns), social
  media posts, and a fireworks finale.
- **Nightlife**: VOLT and The Gilded Flamingo casino both have walkable interiors with full bar menus.
  The casino offers blackjack, European roulette, slots and Jacks or Better video poker. Drinks make you
  tipsy, then drunk, then you black out (blur, sway, stagger, sloppy steering); coffee and water sober you up.
- **Smartphone**: AlwaysFans Manager (overview, sortable roster, creator detail with charts, prospects,
  campaigns, agency), Bank, Contacts, Clout (social), Map, Properties, Vehicles, Events and Tasks.
- **Saving**: autosaves after every meaningful change and at midnight. You can also save manually from the
  pause menu or home. Continue, New Game and Reset Save (with confirmation) are on the main menu. Saves are
  validated and merged over defaults, with a backup copy, so a missing or corrupted save never crashes the
  game.

## Architecture

```
src/
  game/
    types.ts            persistent state & content types
    store.ts            zustand game store: all actions (economy, purchases, missions, saving)
    uiStore.ts          transient UI/runtime state (panels, toasts, HUD runtime, waypoint)
    settings.ts         persisted settings
    data/               content: world layout & POIs, creators, vehicles, catalog, events, missions, rivals, dialogue
    systems/            economy rules, recruitment math, save/load, formatting
    engine/
      Engine.ts         renderer, main loop, player/vehicle/boat modes, interactions, camera, lighting, HUD feed
      world.ts          procedural city (merged geometry per facade style, instanced palms/lamps)
      carModel.ts       procedural vehicles (extruded bodies, rims, interior); static parts merged per material
      vehicle.ts        arcade vehicle controller (fixed sub-steps) + visual integration
      bounce.ts         Maybach hydraulic suspension system
      character.ts      player figure + instanced crowd renderer (8 draw calls for every NPC)
      npcs.ts           pedestrians, reactions, named actors (creators, rivals, contacts, valets)
      traffic.ts        lane-following traffic with yielding
      interiors.ts      VOLT club (own scene) and the penthouse
      yacht.ts          yachts: model, deck walking, boat handling
      minigames.ts      Bounce-Off and Miami Showoff
      audio.ts          Web Audio synth: engine, tires, hydraulics, ambience, music sequencer
      collision.ts      grid-hashed AABB world (circle push-out, camera raycast)
  ui/                   React HUD, minimap, map, phone apps, shops, dialogue, events, reports, menus
```

Notes on technical choices:

- **Collision** uses a small custom arcade collision system (grid-hashed AABBs with vertical ranges and
  circle push-out) instead of Rapier. Vehicles never need rigid-body dynamics here, and a deterministic
  arcade model keeps the bounce effect, the camera and driving from fighting each other.
- The VOLT interior is rendered as its own scene. The penthouse sits on the real tower roof, so the view is
  the actual city.
- The NPC crowd is fully instanced, and the city's buildings are merged per material, which keeps the draw
  count to roughly 300 on desktop.
- Game time pauses while menus are open, and nothing requires waiting in real time: sleep at home after
  6 PM to skip to morning, and events can be started directly.
- Open the game with `?debug` in the URL to expose `window.__LIB` (engine and stores) for testing.
