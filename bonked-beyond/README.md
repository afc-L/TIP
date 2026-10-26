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
| E | Interact: chests, shrines, springs, altars, totems |
| Tab | Open waiting level-ups (when auto-pause is off) |
| Mouse wheel | Camera zoom |
| Esc / P | Pause (resume, restart, inventory, controls, settings, quit) |
| 1–4, R | Pick a level-up card / reroll |
| Gamepad | Left stick move · A dodge · X super · B interact · Start pause · LT sprint |
| Touch | Virtual joystick (left half of the screen) and on-screen buttons |

## What's in the game

- **11 characters** with their own starting weapon, base stats, passive and playstyle:
  Bonker, The Runner, Scrap Rat, The Wizard, Iron Moose, The Alchemist (stronger damage over time), The Gunslinger
  (+1 projectile), The Engineer (stronger summons), The Berserker (stronger at low health), The Frost Knight (every
  hit slows) and The Gambler (random blessings every 25s). Ten of them unlock through achievements.
- **5 maps**, each with its own palette, props, enemy mix, boss pair and environmental hazard:
  Bonk Forest (healing fruit), Crystal Canyon (crystal eruptions), The Forgotten Arena (fire jets, early bosses),
  Frozen Wasteland (slippery ice, blizzards) and Lava Fields (burning lava pools, eruptions).
- **Modes**: Standard (beat the map's final boss), Practice (2× timeline) and Endless (bosses keep cycling,
  best time recorded). Difficulty: Easy / Normal / Hard.
- **Run modifiers** (optional, rolled before the run, rerollable): Double Trouble, Glass Bonk, Rich Run, Fast Paced,
  Magnetic, Elite Hunt, Chaos Magic, Boss Rush, Low Gravity, Survival Instinct. Rewards scale with the challenge.
- **16 enemy types**: Slime, Mega Slime, Stab Goblin, Armored Brute, Hex Shaman, Boom Bug, Swarm Bug, Bombardier,
  Shadow Stalker, Shield Knight (blocks hits from the front), Moss Healer, Phantom (resists physical, weak to
  elements), Burrower, Giant Beetle, Cursed Archer and the mini-boss Grunk the Ogre. **Elite modifiers** (Enraged,
  Armored, Vampiric, Explosive, Swift, Regenerating, Summoner) each have their own aura colour and health bar.
  Elite camps guard chests out in the world.
- **5 bosses** with telegraphed, multi-phase attacks: The Stump King, The Scrap Golem, The Void Devourer (gravity wells,
  radial barrages, blink strikes, inhale), The Golden Executioner (axe sweeps, Judgment safe zones, summoned elites)
  and The Crystal Colossus (spike fields, resonance waves you dodge through, phases at 60% and 30%).
- **20 weapons**, each mechanically distinct with 8 levels and an evolution. The 10 new ones are Meteor Storm,
  Soul Reaper, Tesla Coil, Gravity Well, Boulder Roller, Drone Swarm, Fire Tornado, Golden Cannon, Mirror Shards
  and Void Rift. Damage elements (physical, fire, lightning, poison, arcane, explosive, frost) bring status
  effects: burn, shock (+20% damage taken), slow and poison.
- **12 build synergies** (data-driven, shown in the inventory and HUD), e.g. Storm Build, Pyromaniac, Glass Cannon,
  Full Metal, Swarm Lord, Treasure Hunter, Survivor.
- **Level-ups**: five rarities (common → legendary) that scale how strong a card is. You also get stat training cards,
  8 run-changing legendary traits (One-Punch Mode, Unstable Core, Last Stand…), rerolls and banishes.
  If you turn off "Pause on level up", level-ups wait until you press Tab.
- **World**: gold chests, golden chests, Blood Shrines, Healing Springs, Risk Altars (summon a champion), Power Totems,
  breakable barrels, power-ups and elite camps.
- **Meta progression**: a four-branch skill tree (Offense, Survival, Utility, Luck) with prerequisites,
  16 challenges with claimable rewards, cosmetics (character colours, trails, titles, UI themes) with a 3D preview,
  30 achievements, lifetime statistics and a codex that tracks discovery of every character, weapon, evolution,
  item, enemy, boss, map, modifier and synergy.
- **Accessibility**: shake intensity, particle intensity, reduced effects, damage numbers, enemy health bars,
  high-contrast enemy outlines, camera zoom (mouse wheel), separate volumes, pause on level up, FPS counter.

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
