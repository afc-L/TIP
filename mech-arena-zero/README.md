# MECH ARENA ZERO

A browser-based 3D mech combat game: customizable combat frames, tactical AI opponents,
multi-phase boss fights, five game modes, and a long-term progression system.

Built with **Three.js** (WebGL), plain **JavaScript** modules, **HTML/CSS** menus and **Vite**.
It needs no backend: all progress is saved to `localStorage`, and sound and music are synthesized
at runtime with Web Audio, so there are no asset files to download.

## Running

```bash
cd mech-arena-zero
npm install
npm run dev        # http://localhost:5173
```

For a static build that you can host anywhere (it uses relative paths):

```bash
npm run build      # outputs dist/
npm run preview    # serves the production build
```

Use a desktop browser with a mouse. Click the game view to capture the mouse. Esc pauses.

**On a school MacBook:** open *Settings → Graphics* and choose **LOW** if the frame rate drops.
LOW turns off shadows, lowers the render resolution and reduces particles. MEDIUM is the default.
You can also lower *Render scale* on its own.

## Controls

Every action can be rebound to any key or mouse button on the **Keybinds** screen (main menu, pause menu, or Settings → Controls). Click an action, press the new key; Esc cancels, Backspace unbinds, and taking a key that's already in use swaps the two actions.

| Input | Action |
| --- | --- |
| W A S D | Move (relative to the camera) |
| Mouse | Aim / camera |
| Left click | Primary weapon |
| Right click | Secondary weapon |
| Space | Jump. Hold it in the air to fire jump jets (uses energy) |
| Shift | Sprint (uses energy) |
| C | Boost dash (charges + energy) |
| R | Reload. On heat-based weapons it does an emergency vent |
| F | Mech special ability |
| 1–4 | Select an equipment module. Press the same number again to activate it |
| Q | Activate the selected equipment module |
| T | Toggle target lock. Missiles home in on the lock, and aim assist applies |
| V (hold) | Zoom |
| Tab (hold) | Scoreboard |
| Esc | Pause menu |

## What's in the game

### Mechs (8 frames, each with its own silhouette, legs and animation)
| Frame | Class | Legs | Ability |
| --- | --- | --- | --- |
| Striker | Medium | Biped | Missile Barrage |
| Viper | Light | Reverse-joint | Overdrive |
| Bulwark | Heavy | Stocky biped + arm shield | Aegis Dome (shields nearby allies) |
| Titan | Heavy | Massive biped | Leaping Ground Slam |
| Phantom | Light | Tall slender biped | Active Camo |
| Juggernaut | Assault | Four-legged spider tank | Fortify |
| Wraith | Experimental | Hover ring (no legs) | Phase Blink |
| Apex | Experimental | Winged biped | Overclock |

All mech models are built procedurally from low-poly primitives. Parts are merged into one
vertex-colored draw call per rigid part. Animation is procedural: walk and run gaits, jump tuck,
landing crouch, torso twist toward the aim, recoil, hit jolts, thruster flames and a collapse
animation when a mech is destroyed.

### Customization
Each frame has a **capacity**. Weapons, armor, mobility and equipment all have a weight, so you
have to trade some things off to fit others.
- **Weapons (11):** Pulse Cannon, Swarm Pod (homing missiles), Arc Repeater, Scatter Blaster,
  Gauss Autocannon, Plasma Launcher, Rail Lance, Nova Mortar, and the experimental Ion Lance (beam),
  Tempest Array and Photon Rail (piercing). Weapons use either a heat system or magazines with reloads.
- **Damage types:** Energy (+25% vs shields), Impact (+20% vs armor), Explosive (splash, −15% vs
  shields), Precision (×1.6 cockpit crits).
- **Armor (5):** standard, reinforced, lightweight, energy-resistant, adaptive (experimental).
- **Mobility (5):** standard, heavy legs, speed boosters, jump boosters, dash system.
- **Equipment (8):** Aegis Bubble (temporary shield), Repair Nanites, Vector Thruster (boost),
  Overdrive Servos (movement), Target Uplink (targeting assist), Countermeasure Pod (ECM),
  Shield Capacitor and Sentry Drone (both experimental).

### Arenas
Six combat arenas: Industrial Zone, Desert Outpost, Frozen Research Facility (fog), Neon City,
Volcanic Wasteland (lava damages you) and Orbital Station (low gravity). The four bosses each
fight in their own arena. Every arena has cover, raised platforms reached by stairs, several
routes, and explosive fuel cells you can shoot.

### Game modes
1. **Arena Survival.** Endless waves. New enemy types appear as you progress, and every 5th wave
   is a special encounter (Warlord, Ace Squadron, Colossus, Specter Pack, Apex Predator).
2. **Elimination.** Team battles: Duel 1v1, Outnumbered 1v3, Skirmish 2v3, Squad 3v4. If you
   are destroyed while allies are still alive, you spectate them.
3. **Boss Battles.** Each boss is introduced with a camera fly-around and has its own phases:
   - *Iron Giant*: a frontal Bastion shield and a weak point on its back. Jump its shockwaves and
     use its venting windows. Artillery joins in phase 2.
   - *Phantom Zero*: cloaks and makes telegraphed lunges, and is vulnerable for a moment after
     each one. It deploys holographic decoys, which a target lock exposes.
   - *Overlord*: invulnerable while its relay pylons stand. It summons escort squads and calls
     in orbital strikes.
   - *Omega Prime*: phase 1 uses beam sweeps (jump over them or take cover) and shockwaves.
     Phase 2 is a fortress shielded by orbiting cores. Phase 3 is a berserk mode that reads
     your range and changes its attacks to counter it.
4. **Domination.** Three capture points with 3v3 or 4v4 AI teams and respawns. The first team
   to 200 points wins.
5. **Challenge Missions (12).** Missions with special rules: limited equipment, glass cannon,
   elite duel, time limits, survival timers, forced weapons, no shields, zero-G, blizzard fog,
   and a final gauntlet.

**Randomized match conditions** include Night Ops, Ion Storm, Overcharge, Low Gravity,
Supply Drops, Bounty Hunt and Dense Fog. There is also a **Daily Operation** and three
**daily contracts**, all generated locally from the date.

### AI
Enemies have personalities: Scout, Sniper, Assault, Tank, Support (heals allies), Flanker and
Elite (adaptive). They:
- use line of sight and memory, and search a predicted position when they lose sight of you
- path around obstacles on a navigation grid (A* with path smoothing) and get unstuck on their own
- hide behind cover and cycle between hiding and peeking out to shoot
- flank and orbit, keep their preferred range, and retreat to recover their shields when hurt
- coordinate as a squad. Attack tokens limit how many enemies shoot at you at once, and flank
  slots spread them around you.
- read how you play. If you camp they flank more; if you snipe they push in.
- notice when a tactic isn't working (damage dealt vs. taken) and switch to another one
- dodge incoming projectiles on Hard and Expert, and use their abilities and equipment

Difficulty changes how the AI behaves: reaction time, aim tracking, how well it predicts your
movement, how often it uses cover, coordination, dodging and attack tokens. Enemy health is
not scaled up. A modest "threat" scaling follows your upgrade level so the game doesn't
become trivial.

### Progression
- **Credits** buy weapons, gear and standard frames. **Research Points** unlock experimental
  tech, Wraith and Apex. Apex also requires defeating 2 bosses.
- **Pilot levels 1–40.** Leveling up unlocks arenas, modes, gear, challenges and bosses.
  The results screen lists what each level unlocked.
- **Upgrade tree:** 6 branches × 5 tiers (Armor, Movement, Weapon Efficiency, Energy, Shields,
  Special Abilities).
- **23 achievements**, plus career statistics: matches, wins and losses, kills, bosses, damage,
  best wave, favorite mech, most-used weapon, accuracy and time played.
- Progress saves automatically. *Settings → Data* can reset it after a confirmation prompt.

## Code layout

| File | Purpose |
| --- | --- |
| `src/data.js` | All game data: frames, weapons, gear, arenas, modes, bosses, challenges, achievements |
| `src/save.js` | Profile, localStorage persistence, stat computation, purchases, daily ops |
| `src/mechModel.js` | Procedural mech and weapon models with procedural animation |
| `src/arenas.js` | Arena layouts, collision world, spatial grid, nav grid + A*, cover points |
| `src/mech.js` | Mech entity (movement physics, abilities, equipment), drones, destructible structures |
| `src/combat.js` | Weapon runtime (heat, ammo, salvos) and the projectile, missile and hitscan system |
| `src/ai.js` | Tactical AI controller and squad coordinator |
| `src/bosses.js` | The four boss controllers |
| `src/modes.js` | Game mode controllers |
| `src/game.js` | Match orchestration, player controller, camera, damage resolution, rewards |
| `src/effects.js` | GPU point particles, explosions, tracers, telegraphs, damage numbers |
| `src/hud.js` | In-match HUD and minimap |
| `src/menus.js` | All menu screens |
| `src/audio.js` | Synthesized sound effects and generative music |
| `src/main.js` | Renderer, hangar showcase scene, main loop, pause flow |

## Performance notes
- The static arena geometry is merged into about two draw calls using vertex colors.
- Each mech uses roughly 15–20 draw calls. A full 4v3 match renders in about 130–180 draw calls
  and around 20k triangles.
- The game uses a fixed number of dynamic lights, so lighting changes never trigger shader
  recompiles. Shaders are compiled before each match starts.
- Projectiles, effects and damage numbers are pooled. Particles run on one GPU point system.
- Collision and line-of-sight checks use a uniform spatial grid. AI perception and planning run
  on timers rather than every frame.
