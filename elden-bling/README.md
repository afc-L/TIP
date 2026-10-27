# Elden Bling: The Quest for the Last Brain Cell

A silly, low-poly, open-world 3D Soulslike that runs in the browser. Explore a kingdom of ten
regions, bonk ridiculous enemies, loot questionable gear, rescue a chicken, return lost socks to a
philosopher, defeat the great enemies of the realm in any order you like and finally take down
**Lord Touchgrass**, who has guarded his backyard for 500 years.

A first playthrough takes several hours; beating all 18 bosses and finding every secret takes longer.

- Plain HTML, CSS and JavaScript (ES modules), no build step, no backend.
- [Three.js](https://threejs.org) r186 is included in `vendor/` so the game works offline.
- Every model is built from simple shapes in code; every sound and all music are synthesised
  with the Web Audio API. There are no external assets to download.
- Progress auto-saves (in your browser's local storage) when you rest at a shrine, beat a boss
  or quit to the menu.

## Running it

Browsers refuse to load JavaScript modules from a `file://` page, so the game has to be served by
a tiny local web server. Any of these works; run the commands from this `elden-bling` folder.

**Python 3** (preinstalled on macOS / most Linux, available on Windows):

```bash
cd elden-bling
python3 -m http.server 8000
```

On Windows the command may be `py -m http.server 8000` or `python -m http.server 8000`.

**Node.js** (if you prefer it):

```bash
cd elden-bling
npx serve -l 8000 .
```

Then open **http://localhost:8000** in Chrome, Edge or Firefox. Press `Ctrl+C` in the terminal to
stop the server.

You can also put the folder on any static host (GitHub Pages, Netlify, itch.io as an HTML game):
everything uses relative paths.

## Controls

| Input | Action |
| --- | --- |
| `W A S D` | Move |
| Mouse (or arrow keys) | Rotate the camera |
| Left click | Light attack (press again to combo) |
| Right click | Heavy attack (more damage, staggers) |
| `Space` | Dodge roll (invincible mid-roll) |
| `Shift` | Sprint |
| `E` | Interact, open chests, rest at shrines |
| `Q` | Drink a Flask of Questionable Juice (heal) |
| `1` – `8` | Garlic Bread / Potion of 100% Dignity / Ghost Pepper / Coconut / Soda Bomb / Fire Bomb / Questionable Mushroom / Rare-ish Candy |
| `F` or middle click | Lock on to an enemy |
| `M` | World map |
| `Tab` | Inventory, equipment and stats |
| `Esc` | Pause menu |
| `K` / `H` | Mute all sound / toggle the on-screen controls guide |

Click the game once to capture the mouse. `Esc` releases it and pauses.

## How to play

- **Touch Grass Shrines** (glowing green grass) heal you, refill your flasks, respawn regular
  enemies and let you spend XP to level up Vigor (HP), Endurance (stamina) or Strength (damage).
  Discovered shrines can be travelled between.
- **Dying** sends you back to the last shrine and drops your coins where you fell. Walk back and
  press `E` to pick them up. Die again first and they're gone.
- Attacks, rolls and sprinting cost **stamina**. Watch for the white **glint** on an enemy's weapon:
  that's the moment to roll. Rolling through an attack refunds a little stamina.
- Hitting enemies **from behind** does extra damage.
- Some walls are fake. Hit suspicious walls. Some gates only open from one side.
- Coins buy things from **Bargain Barry** in the starting village.

### The open world

The kingdom is open: after the tutorial you can go anywhere, in any order. Press `M` for the map.
The **far regions** (outermost ring) are much harder: enemies there have more health and hit harder.

| Region | Where | Enemies | Medallion boss | Field boss (optional) |
| --- | --- | --- | --- | --- |
| The Grasslands | Centre (start) | Goblins, Angry Knights | — | Gary the Enormous Goblin |
| The Cursed Swamp | North of the start | Poison frogs, clumsy skeletons | The Unemployed Knight | Grandma Bog |
| The Crunchy Desert | West | Mummies, Hostile Cacti | Pharaoh Pyramid-Scheme | Sandra the Sandworm |
| The Slightly Chilly Peaks | East | Snowmen, Yeti Bouncers | The Abominable Snowmom | Sir Shivers the Ice Knight |
| The Beach of Regret | South | Crabs, Seasick Pirates | Captain Sogbeard | Kevin, the Kraken's Little Brother |
| **The Haunted Woods** | Far north-west | Ghosts, Werepoodles, Pumpkin Brutes | Count Snackula | The Headless Horseman (Horseless) |
| **Mount Slightly Hot** | Far north-east (lava!) | Hot-Headed Imps, Magma Golems | The Molten Mayor | Dave the Mildly Inconvenient Dragon |
| **The Fungal Funhouse** | Far west | Shroomlings, Puffball Sporelings | The Fun Guy | Queen Slugworth |
| **The Candy Kingdom** | Far east | Gingerbread Guards, Gummy Worms, Marshmallow Bouncers | Baron Von Sugarcrash | The Gummy Bear Bruiser |
| The King's Backyard | Far north of the centre | Lawn guards | **Lord Touchgrass** (final boss) | — |

- **18 bosses.** The eight medallion bosses each drop a **Bling Medallion**: any **six** open the fog to Lord
  Touchgrass. Every boss drops a unique weapon. Bosses have varying wind-up timings (read the glint, don't
  count beats), a second phase that chains attacks together, and an enrage at low health.
- **Side quests**: find Farmer Dennis's chicken, and collect the **16 lost socks** scattered across the
  world for Sockrates (rewards at 3, 6, 10 and 16).
- **Shops**: Bargain Barry (village), Captain Coupon (beach), Gourd-on (haunted woods), Lady Lollipop (candy kingdom).
- **Secrets**: six fake walls (hit them, or blow them up with a bomb), one-way shortcuts, a hidden thicket.
- **Loot**: 34 weapons (lifesteal, burning, poison, frost, huge reach, very fast fists…), 22 armour pieces
  (poison/burn/chill immunity, regeneration, speed, coin, XP, damage and healing bonuses…), 8 consumables, and
  rare drops from every enemy type.
- Hazards: poison pools in the swamp, lava on the volcano. A gentle **day/night cycle** (10 minutes per day).

## Performance and graphics settings

The game is built for school laptops with integrated graphics:

- Three presets in **Settings → Graphics**: **Medium** (real-time shadows, more props), **Low**
  (the default: blob shadows, fewer props) and **Very Low** (60% render resolution, short view
  distance, minimal props and particles).
- A **render resolution** slider (40–100%). With *Auto-lower resolution* on, the game drops the
  resolution by itself if the frame rate stays below ~24 FPS.
- Turn on **Show FPS counter** to check how it's running.
- Under the hood: low-poly flat-shaded Lambert materials; terrain split into tiles; scenery
  instanced per 64 m cell with each prop type merged into one mesh; characters merged per joint so
  each costs only a few draw calls; distance culling of scenery, props and characters; at most 8
  enemies simulated at once; pooled particles, projectiles and floating text; and simple 2D
  circle/box collision instead of a physics engine.

If the game says WebGL 2 is unavailable, update the browser and make sure hardware acceleration is
enabled in its settings (Chrome: Settings → System → "Use graphics acceleration when available").

## Project layout

```
elden-bling/
  index.html        UI markup (HUD, menus) and the import map for Three.js
  css/style.css     All styling
  js/main.js        Game class: loop, camera, game flow, combat glue, saving
  js/world.js       Map layout, terrain, walls, gates, props, shrines, chests
  js/player.js      Player movement, stamina, attacks, rolling, healing, animation
  js/enemies.js     Enemy AI, the two bosses, NPCs, the chicken
  js/effects.js     Pooled particles, shockwaves, telegraphs, projectiles, damage numbers
  js/models.js      Low-poly model builders (characters, weapons, props)
  js/collision.js   2D collision and the terrain height function
  js/ui.js          HUD and menu rendering
  js/audio.js       Synthesised sound effects and music
  js/data.js        Items, enemies, dialogue and jokes
  js/settings.js    Settings, graphics presets, save data
  vendor/           Three.js (MIT licence)
```

To reset your progress, choose **New Game** on the main menu.
