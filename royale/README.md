# DROPZONE 100

A complete 3D battle royale that runs in the browser: you against **99 AI opponents** on a
procedurally built island, from the airship drop to the last player standing.
Built with **Three.js** and **Vite** (no physics engine — collision is a lightweight custom grid,
which keeps 100 characters cheap enough for a school laptop).

## Running

**Easiest (no install):** open [`standalone/DROPZONE100.html`](standalone/DROPZONE100.html) in Chrome, Edge,
Firefox or Safari — download it and double-click. Everything (code, styles) is inside that one file and
progress is saved in the browser.

From source:

```bash
npm install
npm run dev            # then open http://localhost:5173/royale/
npm run build          # static site in dist/ (serve dist/ with any web server; open /royale/)
npm run build:single   # regenerate standalone/DROPZONE100.html
```

On slower laptops pick **Settings → Quality preset → Low** (no shadows, shorter render distance,
lower resolution). The game also suggests this if the frame rate stays low.

Use a desktop browser with a mouse. Click the game to capture the mouse; `Esc` pauses.

## Controls

| Input | Action |
| --- | --- |
| `W A S D` · `Shift` · `Space` | Move · sprint · jump / mantle onto ledges / deploy glider |
| `Q` or `Ctrl` | Crouch — while sprinting: slide |
| Mouse · `LMB` · `RMB` | Look · fire / place / use item · aim down sights (scopes on snipers) |
| `1`–`5`, wheel · `F` | Inventory slots · harvesting tool (pickaxe) |
| `R` | Reload (in build mode: cycle wood / stone / metal) |
| `Z` `X` `C` `V` · `B` | Build wall / floor / ramp / roof · toggle build mode. Hold `LMB` to drag-build |
| `G` | Edit your own wall/floor: click or drag tiles, `G` confirm, `RMB` reset |
| `E` | Pick up · hold to open chests and supply drops · hold on your damaged build to repair |
| `K` · `T` · `M`/`Tab` | Drop held item · emote · full map (click to place a marker) |

## What's in it

- **Match flow**: lobby → Sky Barge flight across the island (route shown on the map) → jump, skydive
  (look down + `W` to dive), glider auto-deploys → loot, fight, build → shrinking storm with 7 phases
  (moving final zone) → victory or elimination screen with XP, then play again instantly.
- **Island** (1.8 km): Neon Heights (city with enterable mid-rises and towers), Maple Grove (suburb),
  Rustworks (factory, containers, explosive barrels), Site Zero (research facility with an
  underground mythic vault), Haybale Acres (farm), Sunspray Shores (beach), Ghost Hollow (abandoned),
  Pinecrest Lodge, Summit Outpost, two gas stations, Dockside, plus hidden spots (Smuggler's Cove,
  Hermit's Hut, Treehouse, Old Bunker, Cliff Ruin). Mountains, forests, rivers, lakes, roads, bridges,
  parked vehicles. Nearly everything — walls, floors, trees, rocks, cars — is destructible and harvestable.
- **Movement**: walk, sprint, crouch, slide, jump, mantle/ledge climb, swim, fall damage, skydive, glide.
- **Weapons**: assault rifles, shotguns, SMGs, snipers/DMR (bullet travel and drop), pistols, rocket and
  grenade launchers, grenades, minigun and a piercing railgun — each with damage, fire rate, reload,
  magazine, spread, bloom, recoil, range falloff, headshots, and Common → Legendary rarities plus
  unique **Mythic** weapons (vaults, rare chests, supply drops).
- **Building**: walls, floors, ramps, roofs in wood/stone/metal (different HP and build-up time),
  previews, drag building, 3×3 wall / 2×2 floor tile editing (doors, windows, any shape), repair,
  damage and structural collapse.
- **Loot**: 5-slot inventory, ammo types, materials, healing and shield items, chests, floor loot,
  ammo boxes, supply drops, rarity beams, auto-pickup, dropping and swapping.
- **AI**: every bot is an enemy of everyone. Five personalities — Aggressive, Balanced, Strategic,
  Defensive, Highly Skilled — × four difficulty levels change aggression, accuracy, reaction time,
  awareness, building/editing skill and decision quality. Bots choose landing spots (hot vs quiet
  drops), loot (following interior stairs, digging through roofs, harvesting), pick weapons by range,
  perceive enemies only through a vision cone with line of sight and detection time or by hearing
  gunshots/footsteps/building, react to being shot, take cover, build walls / ramp-rush / box up,
  edit windows to peek, heal when safe, disengage, third-party fights, rotate with the storm and hold
  high ground in the endgame. Distant bots think less often (simulation LOD) but still play the match.
- **Progression** (saved in `localStorage`): XP, levels, career stats, match history, daily objectives,
  season challenges and level-gated cosmetics (outfits, backpacks, gliders, contrails) in the Locker.
- **Settings**: quality preset, render distance, resolution scale, shadows, weather, FOV, sensitivity,
  ADS sensitivity, invert Y, audio volumes, auto-pickup and more.

## Code map (`royale/src`)

`game.js` match lifecycle & loop · `terrain.js` heightfield island · `mapgen.js` / `world.js` locations,
structures, instanced rendering · `physics.js` collision grid, character movement, ray casts ·
`actor.js` shared player/AI rules · `player.js` controls & camera · `ai.js` AI brains ·
`building.js` construction & editing · `combat.js` shooting, projectiles, explosions, harvesting ·
`loot.js` chests, pickups, supply drops · `storm.js` · `bus.js` · `hud.js` / `mapdraw.js` interface ·
`menu.js` lobby · `progression.js` save data · `audio.js` synthesised sound · `effects.js` particles.
