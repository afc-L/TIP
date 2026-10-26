# BONKED BEYOND

A browser-based 3D horde-survival roguelike. Pick a hero, drop into a procedurally decorated
low-poly arena, and survive escalating hordes. Your weapons fire automatically. You collect XP
crystals, choose upgrades, build weapon and item combos, evolve weapons and take down bosses.

Built with **Three.js**, **React**, **Zustand**, **TypeScript** and **Vite**. Every model, effect,
sound and music track is generated procedurally in code. There are no external art or audio assets.

## Running locally

```bash
cd bonked-beyond
npm install
npm run dev        # http://localhost:5180
npm run build      # type-check + production build into dist/ (relative paths, host anywhere)
npm run preview    # serve the production build
```

Use a desktop browser. Audio starts after your first click or key press (autoplay rules).

## Controls

| Input | Action |
| --- | --- |
| W A S D / Arrow keys | Move |
| Mouse | Aim the knives (every other weapon auto-targets) |
| Space / Right-click | Dodge roll (short invulnerability, 1.6 s cooldown) |
| Shift | Sprint (uses stamina) |
| Q / Left-click | **Super Bonk**: huge blast, charged by kills |
| E | Interact: open chests (gold) and use Blood Shrines |
| Esc / P | Pause (resume, restart, inventory, controls, settings, quit) |
| 1–4, R | Pick a level-up card / reroll |
| Gamepad | Left stick move · A dodge · X super · B interact · Start pause · LT sprint |
| Touch | Virtual joystick (left half of the screen) and on-screen buttons |

## What's in the game

- **5 characters** with different HP, speed, starting weapons and passives: Bonker, The Runner,
  Scrap Rat, The Wizard and Iron Moose. Four of them unlock through achievements.
- **3 maps**, all playable: Bonk Forest, Crystal Canyon (faster enemies, more casters) and
  The Forgotten Arena (aggressive spawns, double gold). Each has its own palette, props,
  enemy weighting and modifiers.
- **3 modes**: Standard (beat both bosses, about 13 minutes), Practice (2× timeline,
  about 7 minutes) and Endless (bosses keep returning stronger).
- **6 enemy types**: Slime, Mega Slime (splits when killed), Stab Goblin (flanks you),
  Armored Brute (resists knockback), Hex Shaman (keeps its distance and casts) and Boom Bug
  (telegraphed explosion). Any of them can spawn as an **elite**: golden, bigger, with a
  telegraphed dash or triple shot. Scheduled elites drop golden chests.
- **2 bosses** with telegraphed, avoidable attacks:
  - *The Stump King*: Ground Slam, Root Eruption, Sapling Summon, Trunk Charge.
  - *The Scrap Golem*: Bolt Volley, Piston Charge, lingering Oil Fire, and an Overdrive
    enrage below 40% HP.
- **10 weapons**, each with 8 levels and an evolution: Bonk Hammer → Thunder Bonker,
  Spinning Blades → Vortex Engine, Magic Orb → Black Hole Orb, Boomerang → Infinite Return,
  Lightning Strike → Storm God, Rocket Launcher → Apocalypse Cannon, Poison Cloud →
  Plague Garden, Earthquake → Tectonic Rift, Throwing Knives → Thousand Edges,
  Antler Charge → Juggernaut. A weapon evolves at level 8 once you hold its paired item at
  level 3 or higher. The requirements are listed in the Collection and in the pause-menu inventory.
- **14 passive items** (Power Core, Running Shoes, Iron Heart, Magnet, Lucky Coin,
  Critical Lens, Cooling Fan, Thorns, Regeneration Seed, XP Crystal, Arcane Focus, Long Arm,
  Blast Powder, Iron Shell).
- **Level-up cards** are randomized from valid options only and rolled by rarity (rare or epic
  weapon cards grant +2/+3 levels). You get rerolls and a skip option. When everything is
  maxed, you're offered heal, gold or adrenaline cards instead.
- **Pickups and world objects**: XP gems in 4 tiers, gold, health fruit, Rage Pepper, Frenzy,
  Shield, Magnet Burst, Bomb, gold piles, breakable barrels, gold-cost chests and Blood Shrines.
- **Progression**: Bonk Coins earned every run (even on a loss), 11 permanent upgrades,
  18 achievements (unlocking characters, maps and weapons), lifetime statistics and a
  personal best per map. Everything is saved to LocalStorage.
- **Settings**: master, music and SFX volume and mute; screen shake and hit-stop; damage numbers;
  graphics quality; reduced effects; FPS counter; camera distance and smoothing; mouse aim;
  difficulty; fullscreen; and a controls guide.

## Architecture

```
src/
  app/        App shell, explicit screen state machine (gameState.ts), flow.ts (all screen changes)
  store/      Zustand stores: gameStore (UI/HUD), progressionStore (versioned save), settingsStore
  data/       Pure content: characters, weapons, passives, enemies, maps, achievements, upgrades
  game/
    Engine.ts         Renderer + the single requestAnimationFrame loop, camera, HUD snapshots (10 Hz)
    Run.ts            One run: owns every system, damage pipeline, loot, rewards (finalized once)
    GameConfig.ts     Central balance: director timeline, scaling curves, quality presets
    SpawnDirector.ts  Phased spawning, scripted events, guaranteed elites, boss schedule
    SpatialGrid.ts    Counting-sort uniform grid for O(n) neighbour queries
    player/           Movement/dodge/sprint, pure stat computation (no double-applied upgrades)
    enemies/          Pooled enemies with instanced rendering, AI, hazards, boss state machines
    weapons/          Weapon framework + behaviours + evolutions, pooled instanced projectiles
    items/            XP/gold/power-ups/chests/shrines/barrels, level-up choice generation
    world/            Seeded procedural maps, obstacle collision, occlusion dithering, foliage sway
    effects/          Instanced particles, pooled DOM damage numbers, shake/hit-stop, Web Audio
    models/           Procedural low-poly characters, enemies, bosses and props
  components/ React screens: menus, HUD, level-up, pause, results, upgrades, codex, stats
```

The simulation never runs inside React. React only shows screens and a throttled HUD snapshot.
Enemies, projectiles, particles, gems and foliage use `InstancedMesh` (one draw call per part type).
Effects and entities are pooled, and the enemy cap scales with the quality preset. If the frame
rate stays low, the engine lowers render resolution on its own.

### Testing hook

`window.__bonked` exposes `{ engine, flow, input, store, progression, run }`. The automated browser
tests use it to fast-forward runs.
