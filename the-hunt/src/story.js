import * as THREE from 'three';
import { LANDMARKS } from './world.js';
import { DOCS, RANDOM_NOTES, TRANSMISSIONS } from './content.js';
import { itemMesh } from './models.js';
import { makeRng, rand, clamp } from './util.js';
import { ITEMS } from './inventory.js';
import { K } from './keybinds.js';

// Objectives, interactables, loot, documents, radio transmissions and endings.

export const STAGES = [
  'Walk to the camp clearing and pitch your tent',
  'Find fresh deer tracks near camp',
  'Return to camp',
  'Investigate the campsite by the lake (east)',
  'Track the radio signal to its source',
  'Find the old Ranger Station (west)',
  'Search the Ranger Station for records',
  'Something is following you. Find a way out',
  'Survive',
  'The end',
];

export class Story {
  constructor(game) {
    this.game = game;
    this.stage = 0;
    this.flags = {};
    this.docs = new Set(); // read document ids
    this.taken = new Set(); // picked-up loot ids
    this.kills = 0;
    this.interactables = [];
    this.lootMeshes = [];
    this.seed = 1;
    this.discovered = new Set(['trailhead', 'camp']);
    this.radioQueue = [];
    this.radioT = 0;
    this.nextRandomRadio = 200;
  }

  get keeperDocs() { return ['relay_letter', 'miller_letter', 'voss_private'].filter((d) => this.docs.has(d)).length; }
  get stationDocs() { return ['logbook', 'missing', 'voss_private'].filter((d) => this.docs.has(d)).length; }

  newGame(seed) {
    this.seed = seed;
    this.stage = 0;
    this.flags = {};
    this.docs = new Set();
    this.taken = new Set();
    this.kills = 0;
    this.discovered = new Set(['trailhead', 'camp']);
    this.nextRandomRadio = 240;
    this.setup();
  }

  // ------------------------------------------------------------ world population

  setup() {
    const g = this.game, S = g.structures;
    for (const m of this.lootMeshes) g.scene.remove(m);
    this.lootMeshes = [];
    this.interactables = [];
    const rng = makeRng(this.seed);
    this.rng = rng;

    // fixed-but-randomised placement of key items
    const fuelAt = rng() < 0.5 ? 'abandoned' : 'harlan';
    const keroAt = rng() < 0.5 ? 'miller' : 'harlan';
    this.flags.fuelAt = this.flags.fuelAt || fuelAt;
    this.flags.keroAt = this.flags.keroAt || keroAt;

    // ---- camp: pitch tent, campfire, sleep
    const camp = S.camp;
    this.addInteract({
      id: 'tent', pos: camp.tentWorld, r: 2.6,
      label: () => (!this.flags.tent ? 'Pitch tent' : this.canSleep() ? (this.isNightish() ? 'Sleep until morning' : 'Rest for 2 hours') : null),
      action: () => { if (!this.flags.tent) this.pitchTent(); else this.sleep(); },
    });
    this.addInteract({
      id: 'fire', pos: camp.fireWorld, r: 2.4,
      label: () => {
        if (!this.flags.tent) return null;
        if (!g.campfire.lit) return g.inv.has('lighter') ? 'Light the campfire' : null;
        return g.inv.has('meat') ? `Cook venison (${g.inv.count('meat')})` : null;
      },
      action: () => {
        if (!g.campfire.lit) { g.lightCampfire(); g.ui.toast('The fire catches. For now, the dark keeps its distance.'); return; }
        const n = g.inv.count('meat');
        g.inv.take('meat', n);
        g.inv.add('cooked', n);
        g.ui.toast(`Cooked ${n} venison`);
        g.audio.click(900, 0.3);
        this.flags.cooked = true;
      },
    });
    this.addInteract({ id: 'crate', pos: camp.crateWorld, r: 2, label: () => (this.flags.crate ? null : 'Search supply crate'), action: () => {
      this.flags.crate = true;
      const a = g.inv.add('ammo', 10), b = g.inv.add('battery', 1), c = g.inv.add('food', 2);
      g.ui.toast(`Found ${a} rounds, ${b} batteries, ${c} cans of food`);
      g.audio.pickup();
    } });
    this.addInteract({ id: 'truck', pos: S.trailhead.truckWorld, r: 2.6, label: () => 'Check the truck', action: () => {
      if (this.stage >= 7) g.ui.toast('The engine turns over once and dies. The road south is flooded anyway.');
      else g.ui.toast('Your truck. The road out is washed out until the county clears it.');
    } });

    // ---- abandoned campsite
    const ab = S.abandoned.extra;
    this.addDoc('journal', ab.tent);
    this.addPickup('radio_item', 'radio', ab.chair, () => this.onRadioFound());
    if (this.flags.fuelAt === 'abandoned') this.addPickup('fuel', 'jerrycan', ab.fire);
    this.addPickup('ab_gear', 'gear', ab.cooler, () => { const a = g.inv.add('ammo', 6); g.inv.add('food', 1); g.ui.toast(`Dale's pack: ${a} rounds and a can of food`); }, 'Search abandoned pack');

    // ---- relay
    const rl = S.relay.extra;
    this.addInteract({ id: 'recorder', pos: rl.desk, r: 2, mesh: this.placeMesh('recorder', rl.desk), label: () => 'Play tape recorder', action: () => this.playRecorder() });
    this.addDoc('relay_letter', rl.floor);

    // ---- miller cabin
    const ma = S.miller.anchors;
    this.addDoc('miller_letter', ma.find((a) => a.tag === 'bed') || ma[0]);
    if (this.flags.keroAt === 'miller') this.addPickup('kero', 'kerosene', ma.find((a) => a.tag === 'floor'));

    // ---- harlan cabin
    const ha = S.harlan.anchors;
    this.addPickup('gatekey', 'key', ha.find((a) => a.tag === 'bed'), null, 'Lift the loose bed board');
    if (this.flags.fuelAt === 'harlan') this.addPickup('fuel', 'jerrycan', ha.find((a) => a.tag === 'floor'));
    if (this.flags.keroAt === 'harlan') this.addPickup('kero', 'kerosene', ha.filter((a) => a.tag === 'floor')[1] || ha[0]);

    // ---- station
    const st = S.station.extra;
    this.addDoc('logbook', st.desk);
    this.addDoc('missing', st.cabinet);
    this.addDoc('voss_private', st.locker);
    this.addInteract({ id: 'generator', pos: st.generator, r: 2.4, label: () => {
      if (this.flags.generator) return null;
      return g.inv.has('jerrycan') ? 'Fuel and start the generator' : 'Generator (no fuel)';
    }, action: () => {
      if (!g.inv.has('jerrycan')) { g.ui.toast('The tank is dry. There must be fuel somewhere.'); return; }
      g.inv.take('jerrycan');
      this.flags.generator = true;
      g.setStationPower(true);
      g.ui.toast('The generator coughs, then roars. Lights flicker on inside the station.');
      this.checkpoint();
    } });
    this.addInteract({ id: 'radio_station', pos: st.radio, r: 2.2, label: () => {
      if (this.flags.called) return null;
      return this.flags.generator ? 'Call for help on channel 4' : 'Station radio (no power)';
    }, action: () => {
      if (!this.flags.generator) { g.ui.toast('Dead. The station has no power.'); return; }
      this.callRescue();
    } });

    // ---- gate
    this.addInteract({ id: 'gate', pos: S.gate.interactWorld, r: 3, label: () => (g.inv.has('gatekey') ? 'Unlock the gate and leave Blackpine' : 'Locked gate'), action: () => {
      if (!g.inv.has('gatekey')) { g.ui.toast('Padlocked. The ranger log mentioned a spare key.'); this.flags.sawGate = true; return; }
      g.confirm('Leave the forest? This ends the game.', () => g.ending(this.keeperDocs >= 3 ? 'escape_knowing' : 'escape_blind'));
    } });

    // ---- hollow
    const ho = S.hollow;
    this.addInteract({ id: 'heart', pos: ho.heartWorld, r: 3.2, label: () => {
      if (this.flags.burning || this.flags.burned) return null;
      if (!this.flags.doused) return g.inv.has('kerosene') ? 'Douse the heart tree with kerosene' : 'The heart tree';
      return 'Set it alight';
    }, action: () => {
      if (!this.flags.doused) {
        if (!g.inv.has('kerosene')) { g.ui.toast('You would need something to burn it with. Lamp oil, maybe.'); return; }
        g.inv.take('kerosene');
        this.flags.doused = true;
        g.ui.toast('The bark drinks the kerosene. The effigies turn toward you.');
        g.audio.whisper(ho.heartWorld);
        return;
      }
      this.startBurning();
    } });

    // ---- towers: climbing
    S.towers.forEach((t, i) => {
      this.addInteract({ id: 'tower_up_' + i, pos: t.ladderBottom, r: 1.8, label: () => 'Climb tower', action: () => g.climb(t, true) });
      this.addInteract({ id: 'tower_dn_' + i, pos: { x: t.ladderTop.x, y: t.platformY, z: t.ladderTop.z }, r: 1.4, label: () => 'Climb down', action: () => g.climb(t, false) });
    });

    // ---- loot spread across every anchor
    const anchors = [];
    for (const k of ['harlan', 'miller']) S[k].anchors.forEach((a) => anchors.push(a));
    S.towers.forEach((t) => t.anchors.forEach((a) => anchors.push(a)));
    anchors.push(st.table, st.bed, ...(Array.isArray(st.shelf) ? st.shelf : [st.shelf]), ...st.floors);
    anchors.push(S.dock.anchors[0]);
    // abandoned gear sites in the forest
    const gearSites = [];
    for (let i = 0; i < 10; i++) {
      const p = g.world.randomForestPoint(rng, 0, 0, 30, 300);
      p.y = g.world.heightAt(p.x, p.z);
      p.tag = 'forest';
      gearSites.push(p);
    }
    const notes = RANDOM_NOTES.slice().sort(() => rng() - 0.5).slice(0, 6);
    const noteSpots = [...gearSites.slice(0, 4), ...anchors.filter(() => rng() < 0.3)].sort(() => rng() - 0.5);
    notes.forEach((n, i) => { if (noteSpots[i]) this.addDoc(n, noteSpots[i], 'note'); });
    gearSites.forEach((p, i) => {
      this.addPickup('gearsite_' + i, 'gear', p, () => {
        const ammo = g.inv.add('ammo', 2 + Math.floor(rand() * 5));
        const bat = rand() < 0.4 ? g.inv.add('battery', 1) : 0;
        const food = rand() < 0.5 ? g.inv.add('food', 1) : 0;
        const bits = [ammo && `${ammo} rounds`, bat && 'batteries', food && 'food'].filter(Boolean);
        g.ui.toast(bits.length ? `Abandoned gear: ${bits.join(', ')}` : 'Abandoned gear: nothing you can carry');
      }, 'Search abandoned hunting gear');
    });
    const table = [['ammo', 5], ['ammo', 4], ['battery', 1], ['food', 1], ['food', 1], ['medkit', 1], ['battery', 1], ['ammo', 6]];
    anchors.forEach((a, i) => {
      if (!a || rng() > 0.55) return;
      const [item, n] = table[Math.floor(rng() * table.length)];
      this.addPickup('loot_' + i, item, a, null, null, n);
    });

    this.applyFlags();
  }

  placeMesh(type, p) {
    const m = itemMesh(type);
    m.position.set(p.x, p.y, p.z);
    m.rotation.y = rand() * 6.28;
    this.game.scene.add(m);
    this.lootMeshes.push(m);
    return m;
  }

  addInteract(it) {
    it.pos = new THREE.Vector3(it.pos.x, it.pos.y ?? this.game.world.heightAt(it.pos.x, it.pos.z), it.pos.z);
    this.interactables.push(it);
    return it;
  }

  addPickup(id, item, p, onTake = null, label = null, n = 1) {
    if (!p || this.taken.has(id)) return;
    const meshType = item === 'jerrycan' ? 'jerrycan' : item === 'kerosene' ? 'kerosene' : item === 'key' ? 'key' : item === 'radio' ? 'radio' : item;
    const mesh = this.placeMesh(meshType, p);
    const invId = item === 'key' ? 'gatekey' : item;
    const name = item === 'gear' ? 'gear' : ITEMS[invId]?.name || item;
    this.addInteract({
      id, pos: p, r: 2.0, mesh,
      label: () => label || `Pick up ${name}${n > 1 ? ` (${n})` : ''}`,
      action: () => {
        if (item !== 'gear') {
          const got = this.game.inv.add(invId, n);
          if (got <= 0) { this.game.ui.toast('Your backpack can\'t hold any more of that'); return; }
          this.game.ui.toast(`Picked up ${name}${got > 1 ? ` ×${got}` : ''}`);
        }
        this.game.audio.pickup();
        this.taken.add(id);
        this.removeInteract(id);
        onTake?.();
        if (invId === 'gatekey') { this.flags.gotKey = true; this.game.ui.toast('The spare gate key. The north road is open to you.', 4); this.checkpoint(); }
        if (invId === 'jerrycan' || invId === 'kerosene') this.checkpoint();
      },
    });
  }

  addDoc(docId, p, kind = 'document') {
    if (!p) return;
    const id = 'doc_' + docId;
    const mesh = this.docs.has(docId) ? null : this.placeMesh(kind === 'note' ? 'note' : 'document', p);
    this.addInteract({
      id, pos: p, r: 1.9, mesh, doc: docId,
      label: () => (this.docs.has(docId) ? `Re-read: ${DOCS[docId].title}` : `Read: ${DOCS[docId].title}`),
      action: () => this.readDoc(docId),
    });
  }

  removeInteract(id) {
    const i = this.interactables.findIndex((x) => x.id === id);
    if (i >= 0) {
      const it = this.interactables[i];
      if (it.mesh) this.game.scene.remove(it.mesh);
      this.interactables.splice(i, 1);
    }
  }

  applyFlags() {
    const g = this.game;
    g.structures.camp.tent.visible = !!this.flags.tent;
    if (this.flags.generator) g.setStationPower(true);
    if (this.flags.burned) g.setHollowFire(false, true);
  }

  // ------------------------------------------------------------ stage flow

  setStage(s, quiet = false) {
    if (s <= this.stage && !quiet) return;
    this.stage = s;
    const g = this.game;
    if (!quiet) {
      g.ui.objectiveUpdated();
      g.audio.click(700, 0.25);
    }
    if (s === 1) this.startTracks();
    if (s === 3) this.discover('abandoned');
    if (s === 5) this.discover('station');
    if (!quiet) this.checkpoint();
  }

  /** Text lines for the objective tracker. */
  objectives() {
    const g = this.game, f = this.flags;
    const s = this.stage;
    const out = [];
    switch (s) {
      case 0: out.push({ t: STAGES[0] }); break;
      case 1:
        if (!f.tracksFound) out.push({ t: 'Find fresh deer tracks near camp' });
        else if (!f.killed) out.push({ t: 'Follow the tracks and take a deer' });
        else out.push({ t: `Harvest the deer [${K('interact')}]` });
        break;
      case 2: out.push({ t: 'Return to camp' }, { t: 'Optional: cook venison at the campfire', sub: true, done: f.cooked }); break;
      case 3: out.push({ t: STAGES[3] }); break;
      case 4: out.push({ t: 'Track the radio signal to its source' }, { t: `Equip the radio [${K('radio')}] and follow the beeping`, sub: true }); break;
      case 5: out.push({ t: STAGES[5] }); break;
      case 6: out.push({ t: `Search the Ranger Station for records (${this.stationDocs}/3)` }); break;
      case 7: case 8: {
        if (f.burning) { out.push({ t: `Survive while it burns (${Math.ceil(f.burnLeft || 0)}s)` }); break; }
        if (f.called && !f.heli) { out.push({ t: `Survive until rescue arrives (${Math.ceil((f.rescueAt - (g.env.day * 24 + g.env.hours)) * 60)}s)` }, { t: 'Stay near the station. Keep your light ready.', sub: true }); break; }
        if (f.heli) { out.push({ t: 'Signal the helicopter in front of the station' }); break; }
        out.push({ t: 'Something is following you. Find a way out' });
        out.push({ t: f.gotKey ? 'ESCAPE: Unlock the North Gate' : 'ESCAPE: Find the gate key (Harlan Cabin)', sub: true });
        out.push({ t: f.generator ? 'RESCUE: Radio for help at the station' : `RESCUE: Fuel the station generator${g.inv.has('jerrycan') ? ' ✓ fuel' : ''}`, sub: true });
        const kd = this.keeperDocs;
        if (kd < 3) out.push({ t: `TRUTH: Learn what it is — Keeper documents (${kd}/3)`, sub: true });
        else out.push({ t: g.inv.has('kerosene') || f.doused ? 'TRUTH: Burn the heart tree in The Hollow' : 'TRUTH: Find kerosene, then go to The Hollow', sub: true });
        break;
      }
      default: break;
    }
    return out;
  }

  /** Waypoint for the compass. */
  target() {
    const g = this.game, S = g.structures, f = this.flags;
    switch (this.stage) {
      case 0: return S.camp.tentWorld;
      case 1: {
        if (!f.tracksFound) return this.trackStart;
        if (f.killedAt) return f.killedAt;
        const herd = g.animals.list.find((a) => a.tracked && !a.dead);
        return herd ? { x: herd.x, z: herd.z } : this.trackEnd || null;
      }
      case 2: return S.camp.fireWorld;
      case 3: return this.discovered.has('abandoned') ? LANDMARKS.abandoned : null;
      case 5: return LANDMARKS.station;
      case 6: return LANDMARKS.station;
      default:
        if (f.heli || f.called) return LANDMARKS.station;
        return null;
    }
  }

  update(dt) {
    const g = this.game, p = g.player.pos, f = this.flags;
    // discovery of landmarks
    for (const k in LANDMARKS) {
      const L = LANDMARKS[k];
      if (!L.name || this.discovered.has(k)) continue;
      if (k === 'hollow' && this.keeperDocs < 3) continue;
      if (Math.hypot(p.x - L.x, p.z - L.z) < 45) {
        this.discover(k);
        g.ui.locationBanner(L.name);
      }
    }
    // stage triggers
    if (this.stage === 1 && !f.tracksFound && this.trackStart && Math.hypot(p.x - this.trackStart.x, p.z - this.trackStart.z) < 6) {
      f.tracksFound = true;
      g.ui.toast(`Fresh tracks. Follow them — scan ahead with binoculars [${K('binoculars')}], crouch [${K('crouch')}] to stay quiet.`, 6);
      g.ui.objectiveUpdated();
    }
    if (this.stage === 2 && Math.hypot(p.x - g.structures.camp.fireWorld.x, p.z - g.structures.camp.fireWorld.z) < 9 && !f.firstCall) {
      f.firstCall = true;
      g.ui.toast('Your CB radio crackles to life...', 3);
      this.transmit(TRANSMISSIONS.first, () => { this.setStage(3); g.ui.toast(`The campsite by the lake is marked on your map [${K('map')}].`, 4); });
    }
    if (this.stage === 3 && Math.hypot(p.x - LANDMARKS.abandoned.x, p.z - LANDMARKS.abandoned.z) < 14 && !f.sawAbandoned) {
      f.sawAbandoned = true;
      g.audio.stinger(0.5);
      g.ui.subtitle('The tents are torn open. From the inside.', 4);
    }
    if (this.stage === 4 && Math.hypot(p.x - LANDMARKS.relay.x, p.z - LANDMARKS.relay.z) < 16 && !f.atRelay) {
      f.atRelay = true;
      g.ui.toast('The signal is coming from inside the shack.', 3);
    }
    if (this.stage === 5 && Math.hypot(p.x - LANDMARKS.station.x, p.z - LANDMARKS.station.z) < 24) this.setStage(6);
    if (this.stage === 6 && this.stationDocs >= 3 && !f.stationEnc && !g.ui.modalOpen) this.triggerStationEncounter();
    // the hollow is only findable once you know about it
    if (this.keeperDocs >= 3 && !f.hollowKnown) {
      f.hollowKnown = true;
      this.discover('hollow');
      g.ui.toast('You know where its heart is: The Hollow, NW corner. Marked on your map.', 5);
      g.ui.objectiveUpdated();
    }
    // rescue countdown
    if (f.called && !f.heli) {
      const now = g.env.day * 24 + g.env.hours;
      if (now >= f.rescueAt) {
        f.heli = true;
        g.startHelicopter();
        g.ui.toast('Rotor blades. The helicopter is here — get to the clearing in front of the station!', 6);
        g.ui.objectiveUpdated();
      }
    }
    if (f.heli && !g.ended && Math.hypot(p.x - g.structures.station.x, p.z - g.structures.station.z) < 26 && g.heliLanded) {
      if (!f.heliPrompt) { f.heliPrompt = true; }
    }
    if (f.burning) {
      f.burnLeft -= dt;
      g.creature.relentless = Math.max(g.creature.relentless, 2);
      if (f.burnLeft <= 0) {
        f.burning = false;
        f.burned = true;
        g.setHollowFire(false, true);
        g.creature.hide();
        g.creature.relentless = 0;
        g.audio.shriek(g.structures.hollow.heartWorld, 1.5);
        setTimeout(() => g.ending(this.kills > 3 ? 'keeper' : 'hollow'), 2500);
      }
    }
    // radio transmissions
    this.updateRadio(dt);
  }

  discover(k) {
    if (this.discovered.has(k)) return;
    this.discovered.add(k);
    this.game.ui.mapDirty = true;
  }

  // ------------------------------------------------------------ actions

  pitchTent() {
    const g = this.game;
    this.flags.tent = true;
    g.structures.camp.tent.visible = true;
    g.audio.page();
    g.lightCampfire();
    g.ui.toast('Camp set. The fire is lit. Sleep in the tent to save and skip the night.', 5);
    this.setStage(1);
  }

  startTracks() {
    const g = this.game;
    const c = g.structures.camp;
    // start the trail 35 m from camp in a random direction that is not the lake
    const a = rand() * Math.PI * 2;
    const sx = c.fireWorld.x + Math.cos(a) * 35, sz = c.fireWorld.z + Math.sin(a) * 35;
    const res = g.animals.spawnTrackTrail(sx, sz);
    this.trackStart = { x: sx, z: sz };
    this.trackEnd = res;
  }

  onAnimalKilled(a) {
    this.kills++;
    const f = this.flags;
    if (this.stage === 1 && a.kind !== 'rabbit') {
      f.killed = true;
      f.killedAt = { x: a.x, z: a.z };
      this.game.ui.objectiveUpdated();
    }
    if (this.kills === 4) this.game.ui.subtitle('The woods have gone very quiet.', 4);
  }

  onHarvest(a) {
    if (this.stage === 1 && a.kind !== 'rabbit') {
      this.setStage(2);
      this.game.ui.toast('Head back to camp before dark. Cook the meat at your fire.', 5);
    }
  }

  onRadioFound() {
    const g = this.game;
    g.equip.select('radio');
    g.ui.toast('A handheld radio. It is picking something up, faint, from the east...', 5);
    this.setStage(4);
    this.discover('lake');
  }

  /** Signal strength toward the relay (only meaningful until it is found). */
  radioSignal() {
    const p = this.game.player.pos;
    const L = LANDMARKS.relay;
    const d = Math.hypot(p.x - L.x, p.z - L.z);
    // directional: stronger when facing it
    const pl = this.game.player;
    const dirTo = Math.atan2(-(L.x - p.x), -(L.z - p.z));
    let diff = Math.abs(((dirTo - pl.yaw) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
    const facing = 1 - diff / Math.PI;
    return clamp((1 - d / 450) * (0.35 + 0.65 * facing * facing), 0, 1);
  }

  playRecorder() {
    const g = this.game;
    if (g.radioBusy) return;
    g.ui.toast('*click* The tape hisses...', 2);
    const lines = [
      ['This is Ranger Voss. If you found this, you followed the relay signal. Good.', 4],
      ['The station is due west of here, across the valley. Take the north road, then the west fork.', 4.5],
      ['Everything I know is in the logbook. Don\'t stay out after dark.', 3.5],
      ['And whatever you hear out there... don\'t knock back.', 3.5],
    ];
    this.transmit(lines, () => {
      if (this.stage <= 5) { this.setStage(5); g.ui.toast('Ranger Station marked on your map.', 4); }
    }, true);
  }

  readDoc(id) {
    const g = this.game;
    if (this.stage === 5 && DOCS[id].where === 'station') this.setStage(6);
    const first = !this.docs.has(id);
    this.docs.add(id);
    const it = this.interactables.find((x) => x.doc === id);
    if (it?.mesh) { g.scene.remove(it.mesh); it.mesh = null; }
    g.ui.showDocument(DOCS[id], () => {
      if (!first) return;
      if (DOCS[id].keeper) g.ui.toast(`Keeper documents: ${this.keeperDocs}/3`, 3);
      if (id === 'logbook') { this.discover('harlan'); this.discover('gate'); g.ui.toast('Harlan Cabin and the North Gate added to your map.', 4); }
      g.ui.objectiveUpdated();
      this.checkpoint();
    });
  }

  triggerStationEncounter() {
    const g = this.game;
    this.flags.stationEnc = true;
    this.setStage(7, true);
    g.ui.objectiveUpdated();
    // lights die, the forest goes silent, something is in the doorway
    g.audio.silence = 1;
    g.equip.flicker = 2.5;
    g.setStationPower(false);
    setTimeout(() => {
      g.audio.knock(g.structures.station.toWorld(0, 2, 6), 3);
    }, 1500);
    setTimeout(() => {
      const door = g.structures.station.toWorld(0, 0, 7.5);
      g.creature.start('appear', { spot: door, pose: 'tilt' });
      g.creature.timer = 6;
      g.ui.subtitle('Behind you.', 3);
      g.audio.whisper(g.player.eyePos);
    }, 5200);
    setTimeout(() => {
      g.ui.toast('You need to get out of this forest.', 4);
      if (this.flags.generator) g.setStationPower(true);
      this.checkpoint();
    }, 12000);
  }

  callRescue() {
    const g = this.game;
    this.flags.called = true;
    this.setStage(8, true);
    const now = g.env.day * 24 + g.env.hours;
    this.flags.rescueAt = now + 4; // four game hours
    this.transmit(TRANSMISSIONS.rescue, () => {
      g.ui.toast('Four hours. Hold out at the station.', 4);
      g.ui.objectiveUpdated();
      // it heard you call
      setTimeout(() => {
        g.audio.shriek(g.structures.station.toWorld(30, 4, -20), 1);
        g.ui.subtitle('It heard that.', 3);
        g.creature.relentless = 240;
        g.creature.cooldown = Math.min(g.creature.cooldown, 15);
        g.setStationPower(false);
        g.ui.toast('The generator dies. You are in the dark.', 4);
      }, 9000);
    }, true);
    this.checkpoint();
  }

  startBurning() {
    const g = this.game;
    this.flags.burning = true;
    this.flags.burnLeft = 50;
    this.setStage(8, true);
    g.setHollowFire(true);
    g.ui.toast('The heart tree goes up like a torch. Something in the forest SCREAMS.', 5);
    g.audio.shriek(g.player.eyePos.clone().add(new THREE.Vector3(30, 5, 0)), 1.4);
    g.creature.relentless = 60;
    g.creature.cooldown = 4;
    g.ui.objectiveUpdated();
  }

  onCreatureSeen(c) {
    const f = this.flags;
    if (!f.firstSighting) {
      f.firstSighting = true;
      this.game.ui.subtitle('There is someone standing in the trees.', 4);
    }
  }

  onCreatureShot() { this.flags.shotIt = (this.flags.shotIt || 0) + 1; }

  // ------------------------------------------------------------ sleep

  isNightish() { const h = this.game.env.hours; return h >= 19 || h < 5; }
  canSleep() {
    const c = this.game.creature;
    return this.flags.tent && c.state !== 'hunt' && !this.flags.burning && !this.flags.called;
  }

  sleep() {
    const g = this.game;
    if (!this.canSleep()) { g.ui.toast('You can\'t sleep now.'); return; }
    g.ui.fade(1.2, () => {
      const env = g.env;
      if (this.isNightish()) {
        if (env.hours >= 19) env.day++;
        env.hours = 7;
        env.randomWeather(rand, this.stage);
        g.player.stats.hunger = Math.max(0, g.player.stats.hunger - 18);
        g.player.stats.health = Math.min(100, g.player.stats.health + 30);
      } else {
        env.hours += 2;
        g.player.stats.hunger = Math.max(0, g.player.stats.hunger - 5);
        g.player.stats.health = Math.min(100, g.player.stats.health + 10);
      }
      g.player.stats.stamina = 100;
      g.player.stats.fear = 0;
      g.creature.hide();
      g.creature.cooldown = 60;
      // sometimes the morning brings a new totem at the edge of camp
      if (this.stage >= 4 && rand() < 0.6) g.events.plantTotemNear(g.structures.camp.fireWorld, 9, 14);
      g.save();
      g.ui.toast(`Day ${env.day}. Progress saved.`, 3);
    });
  }

  checkpoint() { this.game.save(true); }

  // ------------------------------------------------------------ radio transmissions

  /** Queue lines with static and (optionally) a synthesized voice; subtitles always. */
  transmit(lines, onDone, tape = false) {
    const g = this.game;
    g.radioBusy = true;
    let i = 0;
    const next = () => {
      if (i >= lines.length) { g.radioBusy = false; g.audio.radioStatic(0.3, 0.2); onDone?.(); return; }
      const [text, dur] = lines[i++];
      g.audio.radioStatic(dur, tape ? 0.08 : 0.16);
      g.ui.subtitle(text, dur, tape ? 'tape' : 'radio');
      g.speak(text, tape);
      setTimeout(next, dur * 1000 + 250);
    };
    g.audio.radioStatic(0.6, 0.25);
    setTimeout(next, 600);
  }

  updateRadio(dt) {
    const g = this.game;
    if (!g.inv.has('radio') || g.radioBusy) return;
    this.nextRandomRadio -= dt;
    if (this.nextRandomRadio <= 0) {
      this.nextRandomRadio = 150 + rand() * 200;
      const pool = TRANSMISSIONS.random;
      const pick = pool[Math.floor(rand() * pool.length)];
      if (this.stage === 4 && rand() < 0.6) this.transmit(TRANSMISSIONS.loop);
      else this.transmit(pick);
    }
  }

  // ------------------------------------------------------------ save

  serialize() {
    return {
      stage: this.stage, flags: this.flags, docs: [...this.docs], taken: [...this.taken], kills: this.kills,
      seed: this.seed, discovered: [...this.discovered], trackStart: this.trackStart, nextRandomRadio: this.nextRandomRadio,
    };
  }

  load(d) {
    this.stage = d.stage;
    this.flags = d.flags || {};
    this.docs = new Set(d.docs || []);
    this.taken = new Set(d.taken || []);
    this.kills = d.kills || 0;
    this.seed = d.seed || 1;
    this.discovered = new Set(d.discovered || ['trailhead', 'camp']);
    this.trackStart = d.trackStart;
    this.nextRandomRadio = d.nextRandomRadio || 200;
    // transient sequences resume in a safe state
    if (this.flags.burning) { this.flags.burning = false; this.flags.doused = true; }
    this.setup();
    if (this.stage === 1 && !this.flags.killed) { this.flags.tracksFound = false; this.startTracks(); }
  }
}
