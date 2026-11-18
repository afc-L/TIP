// Owns the population: spawning from map definitions, distance LOD, noise propagation,
// respawning replacements out of the player's sight and calling in searchers.
import * as THREE from 'three';
import { NPC } from '../actors/npc.js';
import { rand, pick, chance } from '../core/util.js';

export class NPCManager {
  constructor(game) {
    this.game = game; this.list = []; this.grid = new Map(); this.respawnQ = [];
    this.searchersCalled = 0; this.helpCooldown = 0;
  }
  clear() { for (const n of this.list) n.remove(); this.list = []; this.respawnQ = []; this.searchersCalled = 0; }

  spawn(def) {
    const n = new NPC(this.game, def);
    this.game.scene.add(n.group);
    this.list.push(n);
    return n;
  }

  near(p, r) {
    const out = [];
    for (const n of this.list) if (Math.abs(n.pos.x - p.x) < r && Math.abs(n.pos.z - p.z) < r) out.push(n);
    return out;
  }

  noise(pos, radius, type, source) {
    for (const n of this.list) if (n !== source) n.hear(pos, radius, type);
  }

  alertArmed(from, pos) {
    for (const n of this.list) {
      if (n === from || !n.alive || (n.role !== 'searcher' && n.role !== 'guard')) continue;
      if (n.pos.distanceTo(from.pos) < 60) { n.lastKnown.copy(pos); n.recognized = true; n.alerted = true; if (n.state !== 'confront') { n.setState('confront'); } }
    }
  }

  onRemoved(n, reason) {
    const def = this.game.map.populationDef;
    if (!def || this.game.mode === 'story' && this.game.story && this.game.story.noRespawn) return;
    this.respawnQ.push({ t: rand(def.respawnMin || 25, def.respawnMax || 60), role: n.role === 'searcher' ? null : n.role });
  }
  onEscaped(n) {
    this.game.stats.escaped++;
    this.game.ui.toast('Someone got away.', 2.5);
    this.onRemoved(n, 'escaped');
  }

  // Someone called for help: searchers arrive later with lights.
  callForHelp(pos) {
    const m = this.game.map;
    if (!m.searcherOutfit || this.helpCooldown > 0) return;
    this.helpCooldown = 60;
    const delay = rand(25, 45);
    setTimeout(() => {
      if (!this.game.running || this.game.map !== m) return;
      this.spawnSearchers(pos, this.game.mode === 'survival' ? 3 : 2);
      this.game.ui.toast('Lights are moving between the trees. Someone answered the call.', 4);
    }, delay * 1000);
  }
  spawnSearchers(pos, count) {
    const nav = this.game.nav; const mp = this.game.monster.pos;
    const spawns = (nav.exits.length ? nav.exits : nav.nodes).filter((n) => n.pos.distanceTo(mp) > 35);
    if (!spawns.length) return;
    const s = pick(spawns);
    for (let i = 0; i < count; i++) {
      const p = s.pos.clone().add(new THREE.Vector3(rand(-2, 2), 0, rand(-2, 2)));
      const n = this.spawn({ pos: p, role: 'searcher', outfit: this.game.map.searcherOutfit || 'searcher', personality: 'brave', flashlight: true, flashOn: true });
      n.lastKnown.copy(pos); n.recognized = true; n.alerted = true; n.setState('confront');
      this.searchersCalled++;
    }
  }

  update(dt) {
    const g = this.game, cam = g.camera.position, q = g.graphics.q;
    this.helpCooldown -= dt;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const n = this.list[i];
      if (n.removed) { this.list.splice(i, 1); continue; }
      const d = n.pos.distanceTo(cam);
      const lod = d < 30 ? 1 : d < 70 ? 2 : 3;
      n.group.visible = d < q.drawDist * 0.8;
      n.update(dt, lod);
      if (n.removed) { this.list.splice(i, 1); }
    }
    // respawn replacements away from the player
    for (let i = this.respawnQ.length - 1; i >= 0; i--) {
      const r = this.respawnQ[i]; r.t -= dt;
      if (r.t > 0) continue;
      this.respawnQ.splice(i, 1);
      const def = g.map.populationDef; if (!def) continue;
      const civ = this.list.filter((n) => n.role !== 'searcher').length;
      if (civ >= def.max) continue;
      const mp = g.monster.pos;
      const cands = g.nav.nodes.filter((nd) => (nd.tags.has('spawn') || nd.tags.has('exit') || nd.tags.has('indoor')) && nd.pos.distanceTo(mp) > 40);
      if (!cands.length) continue;
      const nd = pick(cands);
      this.spawn(g.map.randomNPCDef(nd.pos.clone()));
    }
  }
}
