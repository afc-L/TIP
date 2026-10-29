# Rift Runners 2.0

A top-down 3D roguelike survival game for the browser. Survive waves of rift creatures, build a run out
of upgrades, relics and weapon evolutions, and defeat the **Rift Guardian**. Built with **Three.js** and
**Vite**. There are no external models, textures, sounds or backend: models are low-poly geometry,
textures are drawn on canvases, and sounds are generated with the Web Audio API.

## Running

Requires Node.js 18+.

```bash
cd rift-runners
npm install
npm run dev        # open http://localhost:5174
```

```bash
npm run build      # static site in dist/ (relative paths, host anywhere)
npm run preview    # serve the production build
```

## Controls

| Input | Action |
| --- | --- |
| W A S D / arrow keys | Move |
| Mouse | Aim |
| Hold left click | Fire every equipped weapon (or enable **Auto-fire** in Settings) |
| Space | Dash in the movement direction, invulnerable while dashing |
| Shift / Q | Character ability |
| E | Use a Rift Shrine or Supply Rift |
| Esc / P | Pause / resume |
| M | Mute |
| 1 / 2 / 3 | Pick an upgrade card |

## What's in 2.0

- **Difficulty**: Normal (default), Hard and Nightmare. Hard brings faster attacks, more elites and less healing.
  Nightmare adds modifiers to ordinary enemies and extra boss patterns. Nightmare unlocks after your first win.
- **Campaign**: 10 waves. Waves 1–2 teach the basics, 3–4 add Stalkers, Bombardiers and Leeches, and wave 5
  is a random mid-boss (the Devourer or the Rift Engineer). Waves 6–9 bring Mirror Knights, Void Priests and
  minibosses, and wave 10 is the three-phase Rift Guardian, whose phase 3 shrinks the arena.
- **Endless Mode**: unlocks after defeating the Rift Guardian. Enemy combinations change every 3 waves,
  there is an elite or miniboss every 5 waves, and a boss every 10. Later bosses gain more health and new
  patterns. Your best wave and longest survival time are saved.
- **10 enemy types**: the original four, plus the Rift Stalker, Splitter, Void Priest, Bombardier,
  Mirror Knight and Soul Leech.
- **Elite modifiers**: Swift, Armored, Explosive, Vampiric, Summoner and Volatile. Elites have a coloured
  outline and modifier icons, and they drop gold and sometimes relics.
- **Rift Events** every 2–3 waves: Blood Moon, Crystal Rush, Elite Hunt, Unstable Ground, Supply Rift
  (a shop that takes run gold) and Double Trouble. The next event is shown during the break.
- **Rift Shrines**: optional two-way bargains that list the risk and the reward before you accept.
- **Relics**: 16 relics (12 available from the start, 4 unlockable). You can hold at most 4.
  **Relic synergies** are announced when they activate.
- **7 weapons**: Rift Bolt, Rift Slash, Arc Burst, Void Orb, Chain Lightning, Shadow Blades and Meteor Call.
  You can equip at most 4. **7 weapon evolutions**: a weapon at level 4 plus a matching relic evolves, for
  example Rift Bolt + Storm Core = Tempest Bolt.
- **4 characters**: Rift Runner (free), Spellblade, Stormcaller and Warden. Each has its own health, weapon
  and active ability.
- **Rift Sanctum**: spend Rift Shards on small stat bonuses, characters, alternate starting weapons, relics,
  arenas, starting loadouts and cosmetic cloaks and trails.
- **Run objectives**: two random objectives per run, tracked in the HUD. They reward shards or cosmetics.
- **3 arenas**: Forgotten Temple, Void Garden and Shattered Citadel. Each arena favours different enemies.
- **Collection**: a bestiary, relic and weapon catalogue, evolution recipes, records, and your last 12 runs.
- **Settings**: volume, mute, screen shake, damage numbers, reduce flashing, particle density, graphics
  quality, auto-fire and an FPS counter.

Saves from 1.0 carry over: shards, Sanctum ranks and wins are kept, and an earlier win unlocks Endless and
Nightmare.

## Project structure

```
rift-runners/
├── index.html          # HUD + all menu/modal screens (DOM)
└── src/
    ├── main.js         # renderer, main loop, menu navigation, settings wiring
    ├── game.js         # Game controller: run state, damage, XP, relics, modals, bosses, win/loss
    ├── config.js       # balance: player, weapons, enemies, difficulties, waves, endless generator, bosses
    ├── characters.js   # classes, starting weapons, loadouts, cosmetics, arenas
    ├── relics.js       # relics and weapon evolutions
    ├── upgrades.js     # level-up upgrades, weapon cards, synergies, stat computation
    ├── events.js       # Rift Events, shrines, Supply Rift
    ├── objectives.js   # run objectives
    ├── world.js        # arena themes, obstacles, rift, lights, safe zone
    ├── player.js       # movement, dash, shield, cosmetics
    ├── combat.js       # all weapons, procs, relic hooks, evolutions, class abilities
    ├── enemies.js      # spawning, AI for 10 enemy types + devices, elite modifiers, rendering
    ├── boss.js         # Rift Guardian, Devourer, Rift Engineer
    ├── hazards.js      # telegraphed ground attacks, lobbed shells, meteors, acid pools
    ├── waves.js        # campaign + endless wave director, next-wave preview
    ├── projectiles.js  # pooled projectiles (instanced rendering)
    ├── pickups.js      # XP crystals, gold, healing, relic caches
    ├── effects.js      # particles, rings, telegraphs, lightning, damage numbers, elite tags, shake
    ├── models.js / models2.js  # procedural low-poly models
    ├── pool.js         # InstancedMesh pool + spatial grid
    ├── meta.js         # save data (v2 + v1 migration), unlocks, records, history, settings
    ├── audio.js        # procedural sound effects
    ├── input.js        # keyboard/mouse state
    ├── ui.js           # HUD, menus, modals
    └── style.css
```

## Performance notes

Each enemy type, projectile type, particle system and pickup type is drawn as a single `InstancedMesh`.
Simulation objects are pooled. Neighbour queries use a uniform spatial grid. Active enemies, projectiles,
particles and telegraphs are all capped. **Low** graphics quality and **Low** particle density are meant for
older laptops. Each arena is built once and then reused.

## Debugging

`window.rift` in the browser console provides test helpers, for example `rift.god()`, `rift.wave(10)`,
`rift.boss('engineer')`, `rift.relic('stormcore')`, `rift.give('bolt', 4)`, `rift.spawn('knight', { elite: true })`,
`rift.shrine()`, `rift.supply()` and `rift.gold(100)`.
