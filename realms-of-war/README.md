# Realms of War

A small, fast fantasy grand-strategy game for the browser: a turn-based campaign map plus
real-time battles in the spirit of Total War, built with plain JavaScript and Three.js.
Everything is original: models are generated from code, sounds and music come from the Web Audio API,
and no external assets are downloaded.

## Running

Open `index.html` in Chrome, Edge or Firefox. It works straight from the file system: no server,
no build step and no install. Three.js (r158) is included in `lib/`. Campaign progress and settings
are kept in the browser's `localStorage`.

If your browser blocks local files, serve the folder with any static server instead
(for example `python3 -m http.server` inside this folder, then open http://localhost:8000).

## The game

**Factions**

| | Kingdom of Valor | The Ashen Horde | The Arcane Dominion |
| --- | --- | --- | --- |
| Style | Balanced humans | Orcs and monsters | Mages and constructs |
| Strengths | Shield infantry, longbows, knights, catapults | Cheap brutal infantry, trolls, behemoth | Armour-piercing magic, golems, griffons |
| Campaign bonus | +15% income, cheaper settlement upgrades | Cheaper recruits, plunder on capture | Cheaper upgrades, faster ability cooldowns, faster healing |
| Abilities | Rally Cry, Cavalry Charge, Healing Light | Blood Frenzy, Earthshaker, Savage Charge | Fireball, Meteor Strike, Arcane Ward |

**Campaign**: 16 territories on a hex continent, plus independent Free Cities. Move armies between
neighbouring territories, capture settlements, recruit (limited slots per settlement per turn), upgrade
settlements (Village → Town → City), build Markets, Barracks and Walls, buy permanent Armoury
upgrades unlocked by victories, and manage upkeep. Commanders have passive traits and level up; units
gain veterancy ranks and recover strength between battles. Random events offer choices and rewards.
Win by **Conquest** (12 territories), **Decapitation** (both rival capitals), **Ancient Shrines** (hold all
three for 5 turns) or **Golden Age** (12,000 gold). You lose if all your territories fall.

**Battles**: up to 12 regiments plus a general per side, each made of individual soldiers. Units have
health, morale, melee attack/defence, weapon damage and armour piercing, armour, charge, speed, and
range/ammunition. Flanking and rear attacks, charges, being surrounded, fear-causing monsters, routing
allies and the general's death all matter. Terrain matters too: forests slow, hide and shelter troops,
hills extend missile range and help melee, rivers and passes make chokepoints, sieges need a broken gate.

**Quick Battle** lets you build an army with a budget and fight a randomised enemy on any battlefield.

### Content update

**Three more factions** (all playable in the Greater Realm, Conquest and every battle mode):

| | Frostborn Clans | Bloodfang Empire | Sylvan Covenant |
| --- | --- | --- | --- |
| Style | Defensive northmen, giants and beasts | Vampires and the undead | Elves, beasts and treants |
| Strengths | Armoured infantry, giants, mammoth; expensive | Heavy cavalry, resurrection, flyers | Archers, fast cavalry, flyers; weak heavy infantry |
| Campaign bonus | Stronger garrisons, faster healing, +15% recruit cost | 10% heal after victories | +1 move from forests, +25% forest income |
| Signature ability | Frozen Ground (slow) | Blood Harvest (heal on kill) + limited resurrection | Nature's Wrath (roots) |

**Legendary commanders**: two per faction (12), each with a model on the battlefield, a passive, two
battle abilities, a starting bonus and a story. All commanders have a skill tree (one point per level).

**Rosters**: every faction gains crossbows/specialist ranged troops, flyers (pegasi, wyverns, drakes,
eagles, bats, hawks), monsters, siege engines and rare units (unlocked by research in the Greater Realm,
or a City plus victories in the classic campaign).

**Campaign modes**: *Classic* (the original 16-territory campaign, rules unchanged), *The Greater Realm*
(28 territories with frozen, desert and volcanic lands, six factions, landmarks, explorable ruins,
diplomacy, a 12-technology tree, more events) and *Conquest* (start with one village, conquer the world).
Multiple save slots, campaign statistics, notification history, minimap, an encyclopedia, army
inspection and a fast-animation option.

**Diplomacy**: peace, non-aggression pacts, alliances, gifts, gold requests, military aid. Factions
remember what you did. Allies send up to three units to your battles near their armies.

**Equipment & army management**: 25 items in five rarities for commanders, doctrines, per-unit-type
drill, banner colours.

**Battles**: new battlefields (snowy mountains, ancient forest, volcanic waste, desert ruins, castle
courtyard, ancient temple), weather (rain, fog, snowstorm, volcanic ash; small effects), sieges with two
destructible gates, wall towers, battering rams, siege towers and a plaza capture point, flyers,
veterancy ranks in battle, popups and an aftermath screen with rewards and a strength graph/timeline.

**Custom Battle** (pick both armies, factions, battlefield, weather, legendary commanders) and
**Survival** (endless waves with gold between waves, records your best wave).

**Difficulty is unchanged**: the AI gets no legendary commanders, equipment, skills, research or siege
towers; the classic campaign AI keeps its original rosters; new unit costs were balanced with
`tools/simtest.js` matrices.

### Battle controls

| Input | Action |
| --- | --- |
| Left-click / drag a box | Select units (Shift adds) |
| Right-click ground / enemy | Move / attack |
| Right-drag | Move into a line with a chosen facing |
| WASD, arrows, screen edge | Pan · Q/E rotate · wheel or R/F zoom · middle-drag or Alt+drag orbit |
| Space · 1/2/3 | Pause · game speed |
| T / Y / U | Line / Defensive / Loose formation |
| G · H | Hold position · Halt |
| Z / X / C | Commander abilities |
| Ctrl+A · Esc | Select all · deselect / menu |

During deployment, right-click inside the gold zone to place units, then press **Start Battle**.

## Difficulty

Difficulty changes how the AI thinks rather than inflating enemy stats. Easy enemies react slowly,
march straight in and rarely use spells. Normal enemies flank with cavalry, keep archers out of melee,
protect their missile troops, hold good ground when defending and use abilities sensibly. Hard enemies
also focus fire on weak and high-value targets, pick favourable matchups (spears against cavalry,
cavalry against archers), cycle-charge, pull back broken units and time area spells to avoid their own
men. On the campaign map Hard makes the AI more aggressive and slightly richer; Easy makes it more
cautious and poorer.

## Code layout

```
index.html            entry point (plain <script> tags so it runs from file://)
css/style.css         UI theme
lib/three.min.js      Three.js r158 (MIT)
js/core/              util, settings, data (factions/units/abilities/map), audio, models, camera, ui
js/battle/            terrain + A* pathfinding, units, battle simulation, abilities, AI, renderer, scene/HUD
js/core/data2.js      content update: new factions, units, legends, items, techs, weather, Greater Realm
js/core/mods.js       combines commander/equipment/doctrine/tech bonuses into battle modifiers
js/campaign/          hex map generation, campaign state, diplomacy, AI, 3D view, scene/HUD, extra screens
js/menus.js           main menu, new campaign, quick battle, settings, help
js/main.js            app shell, main loop, scene switching
tools/                headless tests (see below)
```

The battle simulation (`js/battle/terrain.js`, `units.js`, `battle.js`, `abilities.js`, `ai.js`) does not
touch the DOM or Three.js, so it also runs in Node.

## Tests

```bash
node tools/simtest.js grassland valor horde normal 6     # AI vs AI battles: win counts and kills per unit type
node tools/campaigntest.js normal 40 grand frost           # all-AI campaign (classic|grand|conquest) with auto-resolve
node tools/update.js <outDir>                             # browser test of the new modes and campaign screens
node tools/smoke.js <outDir>                              # browser smoke test with screenshots (needs Playwright)
node tools/maps.js <outDir>                               # screenshot every battlefield type
node tools/flow.js <outDir>                               # campaign -> battle -> campaign, save/load, resize
node tools/mouse.js <outDir>                              # box select, right-drag formation, attack, hotkeys, minimap
node tools/siegeend.js <outDir>                           # full AI-vs-AI siege to the results screen
node tools/soak.js <outDir> 15                            # 15 campaign turns in the browser, all dialogs auto-answered
node tools/dialogs.js <outDir>                            # screenshots of help/settings/objectives/armoury/events
```

The browser tests use the Playwright Chromium build with software WebGL, so they run slower than the game does
on real hardware.
