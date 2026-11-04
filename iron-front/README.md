# OPERATION: IRON FRONT

A large-scale browser war game. Two armies of **1,000 soldiers each** — infantry squads,
tanks, IFVs, APCs, trucks, recon cars, self-propelled artillery, attack and transport
helicopters, jets and recon drones — fight over a procedurally generated front. **Every
soldier, squad leader, commander, driver and pilot is AI.** You are one ordinary soldier
in the middle of it. If you die, the battle keeps going and you redeploy, or take over
another friendly soldier.

Built with **Three.js (r158, vendored)**, plain JavaScript, HTML and CSS. No build step.

## Running

Open `index.html` in Chrome, Edge, Safari or Firefox. It works straight from the file
system (`file://`), so it runs on a locked-down school laptop. You can also serve the
folder with any static server:

```bash
cd iron-front
python3 -m http.server 8000     # then open http://localhost:8000
```

Click the battlefield to capture the mouse. **Esc** pauses, **H** shows the controls.
On integrated graphics, use **Graphics → Low**. The game also lowers detail by itself
if the frame rate drops.

## Controls

| Input | Action |
| --- | --- |
| WASD · Mouse | Move · aim |
| LMB / RMB | Fire / aim down sights |
| Shift · C · Z · Q/E · Space | Sprint · crouch · prone · lean · jump |
| R · 1–3 · G · X | Reload · weapons · frag grenade · smoke grenade or AT mine |
| 4 | Class gadget: medkit, ammo box, repair tool (hold), binoculars + artillery |
| F | Enter/exit vehicle, revive a downed ally (hold), resupply from a crate |
| T | Spot an enemy for your whole army |
| B then 1–7 | Squad commands: follow, hold, advance, defend, regroup, enter vehicles, retreat |
| M · Tab | Tactical map · battle status |
| V · N · F3 | 1st/3rd person · night vision · performance stats |
| Vehicles | WASD drive, mouse turret, LMB fire, 1/2 weapons, Space brake |
| Helicopters | W/S pitch, A/D yaw, Q/E strafe, Space/Ctrl altitude, LMB guns, 2 rockets |

## What's simulated

- **2,000 soldiers**, all simulated all the time, organised into squads of 8–12 (leaders,
  riflemen, machine gunners, medics, engineers, recon, anti-vehicle) plus vehicle crews.
- **Soldier AI**: perception with line of sight (terrain, buildings, forests, smoke),
  cover with a facing direction, suppression, stances, burst fire, reloading, grenades,
  rockets against armour and helicopters. Medics revive downed soldiers and engineers
  repair vehicles. Soldiers avoid minefields and their own artillery.
- **Squad AI**: formations, bounding advances, smoke screens, flanking when stalled,
  defending objectives from cover, retreating when broken, regrouping, calling for
  reinforcements, and boarding transports for long trips.
- **Commanders**, one per army: they assess every objective, pick a posture (assault,
  advance, defensive, counter-attack), share out squads and armour, and call artillery
  barrages and air strikes on enemy concentrations.
- **Vehicles**: tracked and wheeled movement over terrain and around obstacles, routes over
  bridges and fords, turrets, cannons, autocannons, HMGs and howitzers. Damaged vehicles
  smoke, burn, are abandoned or destroyed, and leave wrecks that become cover. Crews bail
  out. Lost vehicles respawn at HQ.
- **Battle flow**: conquest-style objectives, reinforcement tickets, ticket bleed,
  reinforcement waves and convoys, six battle phases, locked headquarters, a last stand
  when an army's reserves run out.
- **Random events**: counter-attacks, convoys, helicopter insertions, armour pushes,
  abandoned vehicles, pinned squads asking for help, supply drops, illumination flares and
  weather changes.
- **Atmosphere**: day/night cycle, dynamic weather (rain, fog, storms with lightning),
  tracers, muzzle flashes, explosions, smoke, burning wrecks, collapsing buildings and
  falling trees. Spatial procedural audio: gunfire is delayed by distance and muffled by
  air, plus whistles, engines, rotors, jets, radio squelch and voice chatter.

## Progression

XP, 15 ranks, rank-locked classes, weapons, attachments (red dot, ACOG, foregrip,
suppressor, extended magazine) and uniforms, 12 career medals, per-battle achievements
and career statistics. Progress is saved in `localStorage`.

## Performance design

- Structure-of-arrays soldier storage (typed arrays) with no per-frame allocation in hot loops.
- Spatial hash grids rebuilt every frame with a counting sort: per-team 32 m grids for
  perception, plus a 6 m grid for separation, explosions, capture zones and bullet rays.
- AI updates are staggered: each soldier "thinks" every 0.2–0.6 s and perceives every
  0.35–0.9 s, and soldiers far from the camera update less often.
- Rendering LOD: up to ~140 articulated instanced soldiers near the camera, one merged
  instanced low-poly mesh for everyone else, instanced corpses, buildings and trees.
- Pooled projectiles, billboard particle systems, tracer line pool and a budgeted voice
  pool for distant gunfire.

## Code layout

```
js/core/     util (math, RNG, noise, events), config (all game data), save (profile)
js/world/    world queries (height, obstacles, LOS, cover, routes), procedural map generator
js/sim/      core (soldier arrays, spatial grids), combat, ai (soldiers + squads),
             vehicles, commander, battle (objectives, tickets, phases, events, radio)
js/render/   scene (sky, lights, weather), world, soldiers, vehicles, effects, view model
js/audio/    procedural spatial audio
js/player/   input, player controller
js/ui/       HUD, tactical map, menus
js/main.js   bootstrap and game loop
tools/       headless loader used to run the simulation in Node for testing
```

The simulation (`js/core`, `js/world`, `js/sim`) does not depend on Three.js. It can run
headless in Node:

```js
const IF = require('./tools/load.cjs')(['core/util.js', 'core/config.js', 'core/save.js',
  'world/world.js', 'world/mapgen.js', 'sim/core.js', 'sim/combat.js', 'sim/ai.js',
  'sim/vehicles.js', 'sim/commander.js', 'sim/battle.js']);
const B = IF.Battle.create({ layout: 'river', size: 'standard' });
for (let i = 0; i < 30 * 600; i++) IF.Battle.update(B, 1 / 30); // 10 minutes of war
```
