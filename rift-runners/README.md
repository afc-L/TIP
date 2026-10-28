# Rift Runners

A top-down 3D roguelike survival game for the browser. Survive 10 waves of rift creatures, collect
experience crystals, build a run out of randomized upgrades and synergies, then defeat the
**Rift Guardian**. Built with **Three.js** and **Vite**. There are no external models, textures, sounds or
backend: every model is low-poly geometry, textures are drawn on canvases, and sounds are
generated with the Web Audio API.

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
| Shift | Rift Pulse: knockback blast that erases nearby enemy bullets (10s cooldown) |
| Esc / P | Pause / resume |
| M | Mute |
| 1 / 2 / 3 | Pick an upgrade card |

## Features

- **3 weapons**: Rift Bolt (starting weapon), Arc Burst and Void Orb. The last two unlock through upgrades.
- **4 enemy types**: Crawler, Dasher (telegraphed charge), Spitter (ranged) and Brute (telegraphed slam).
  There are also elites and two minibosses (Brute Warlord on wave 6, Plague Matriarch on wave 8).
- **10-wave run** with breaks between waves. Wave 10 is the Rift Guardian, a two-phase boss with a
  radial burst, telegraphed ground slams, a charge at your last position, and summons in phase 2.
- **21 upgrades** in Common, Rare and Legendary tiers, each with a level cap. **6 synergies**:
  Wildfire, Storm Conduit, Rift Slash, Overload, Toxic Blaze and Singularity.
- **Rift Shards**, a permanent currency, buy bonuses in the Rift Sanctum: health, damage, XP, speed,
  pickup radius and shard gain. Progress is saved in `localStorage`.
- Settings: volume, mute, screen shake, damage numbers, auto-fire, FPS counter and graphics quality.

## Project structure

```
rift-runners/
├── index.html          # HUD + all menu screens (DOM)
├── public/favicon.svg
└── src/
    ├── main.js         # renderer, main loop, menu navigation, settings wiring
    ├── game.js         # Game controller: run state, damage, XP/levels, win/loss, camera
    ├── config.js       # balance tables: player, weapons, enemies, waves, boss, XP curve
    ├── world.js        # arena, obstacles, rift, floating rocks, lights, collision helpers
    ├── player.js       # movement, dash, shield, regen, player model animation
    ├── combat.js       # weapons, crits, burn/poison, explosions, chain lightning, pulse
    ├── projectiles.js  # pooled player/enemy projectiles (instanced rendering)
    ├── enemies.js      # enemy spawning, AI, steering, separation, DoTs, rendering
    ├── boss.js         # Rift Guardian state machine
    ├── waves.js        # wave director (spawning, elites, breaks)
    ├── upgrades.js     # upgrade + synergy definitions, stat computation, rolling
    ├── pickups.js      # XP crystals and healing drops
    ├── effects.js      # particles, rings, telegraphs, lightning, damage numbers, shake
    ├── models.js       # procedural low-poly models (merged, vertex-coloured)
    ├── pool.js         # InstancedMesh pool + spatial grid
    ├── meta.js         # save data, permanent shop, settings persistence
    ├── audio.js        # procedural Web Audio sound effects
    ├── input.js        # keyboard/mouse state
    ├── ui.js           # HUD updates, cards, end screen, toasts
    └── style.css
```

Most balance changes are made in `src/config.js` and `src/upgrades.js`.

## Performance notes

Each enemy type, projectile type, particle system and pickup type is drawn as a single `InstancedMesh`.
Simulation objects are pooled and reused. Neighbour queries use a uniform spatial grid, and frame time
is clamped. Active enemies are capped at 95. **Low** graphics quality turns off shadows and renders at
1× pixel ratio. The game pauses itself when the tab loses focus.

## Debugging

`window.rift` in the browser console provides test helpers, for example `rift.god()`, `rift.wave(10)`,
`rift.give('chain', 3)`, `rift.xp(50)` and `rift.killAll()`.
