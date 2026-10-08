# Steel & Blood

A browser-based, physics-driven medieval sword fighting game inspired by *Half Sword*.
Nothing in combat is a canned animation: fighters are active ragdolls, weapons are rigid
bodies held in the hand by a joint, and damage comes from how hard and with what part of
the weapon you actually hit. It's gory.

Built with **Three.js**, **Rapier 3D** (`@dimforge/rapier3d-compat`) and **Vite**.

## Running

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/ — deploy anywhere (uses relative paths)
npm run preview    # serve the production build
```

Use a desktop browser with a mouse. Click the arena to lock the cursor; Esc releases it and pauses.

## Controls

| Input | Action |
| --- | --- |
| Mouse | Moves your **sword hand** around in front of your body (not the camera) |
| Hold LMB | **Grip** — full arm strength. Wind up, then sweep the mouse hard through the target |
| Hold RMB | **Guard** — blade raised across the body; the mouse moves the guard |
| Wheel / ↑ ↓ | Reach (pull the hand in / extend it) |
| F | Thrust |
| Q | Parry — snaps your blade across the incoming weapon |
| W A S D | Move (relative to the opponent when locked on) · Shift: run |
| Space | Hold to **brace** (recover balance) · tap while moving: dodge step · when down: **get up** |
| E | Grab the opponent with your free hand (again to release) · pick up a dropped weapon |
| Tab | Toggle lock-on · ← → / hold C + mouse: turn manually |
| T | Slow motion · H: help · R: restart · M: menu |
| Sandbox | 1 dummy · 2 hostile · 3 ally · 4 clear · 5 respawn yourself · G god mode |

## How it works

- **Active ragdoll** (`src/fighter.js`): 15 rigid bodies (pelvis, torso, head, upper arms,
  forearms, hands, thighs, shins, feet) connected by spherical joints. Every joint carries
  implicit Rapier motors; each physics step the joint's frame is rotated so that the motor's
  zero is the desired pose (two-bone IK for the arms, procedural gait for the legs). Muscle
  stiffness and maximum torque scale with state, stamina, injuries and being stunned —
  when knocked down the muscles go almost limp.
- **Balance rig**: a kinematic body tied to the pelvis and chest by free generic joints whose
  motors provide support, locomotion and an upright "hand of god" torque — all force-limited
  and scaled by a balance meter. Balance drains with body tilt, the centre of mass leaving the
  feet, being shoved off your intended motion, violent swings and impacts, and recovers
  (faster when bracing). At zero you fall, and can get back up.
- **Weapons** (`src/weapons.js`): rigid bodies with real mass distribution, colliders tagged
  as edge / tip / blunt / haft, continuous collision detection, attached to the hand with a
  fixed joint. The mouse sets a hand target; a force-limited reach drive + arm muscles pull
  the hand there and the wrist turns the blade so the edge leads the motion. Fast mouse =
  big, momentum-heavy swing that's hard to stop.
- **Combat** (`src/combat.js`): collision start events → contact point → relative velocity
  measured from pre-solve velocities → classified as slash / thrust / blunt → energy-based
  damage above a threshold (slow pushes do nothing), scaled by body region and armor
  (plate / mail / gambeson with coverage). Per-pair cooldowns stop per-frame re-damage.
  Weapon-on-weapon contact makes sparks and a clang, jars the weaker arm, and a timed
  parry punishes the attacker.
- **Injuries & gore** (`src/gore.js`): wounds bleed (health is blood), soak clothing, leave
  decals; damaged arms weaken, damaged legs slow you, head blows daze or knock out, and clean
  unarmored cuts sever limbs or heads at the joint, with arterial spurts and blood pools.
- **AI** (`src/ai.js`): drives a fighter through exactly the same input interface as the player
  (hand target, grip, guard, thrust, parry...). It perceives you through a delayed memory
  (reaction time), approaches, circles, winds up, sweeps through a re-aimed strike, defends by
  placing its blade in the path of yours, recovers, grapples, picks up dropped weapons, and
  makes mistakes (aim noise, over-commitment). Easy / Normal / Hard change reaction time,
  aggression, defense and accuracy.
- **Stability**: fixed 120 Hz physics step with interpolated rendering, implicit (solver-side)
  motors instead of explicit PD torques, force caps everywhere, velocity clamps and a
  respawn safety net.
