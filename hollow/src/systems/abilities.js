// Player-activated monster abilities. Each has an animation hook, a sound, a cooldown
// and a visual effect. Nothing here acts without the player pressing a key.
import * as THREE from 'three';
import { clamp, rand } from '../core/util.js';

export const ABILITY_DEFS = {
  senses: { name: 'Enhanced Senses', key: 'Digit1', label: '1', cd: 14, dur: 8, desc: 'Smell and hear the living through walls. Reveals people and points of interest.', start: true },
  predator: { name: 'Predator Vision', key: 'Digit2', label: '2', cd: 18, dur: 10, desc: 'See heat and movement. Living bodies burn bright.', start: true },
  presence: { name: 'Terrifying Presence', key: 'Digit3', label: '3', cd: 30, dur: 12, desc: 'Lights fail and people near you feel watched. Raises fear.', start: false, cost: 120 },
  night: { name: 'Night Vision', key: 'Digit4', label: '4', cd: 2, dur: 25, desc: 'Toggle. Amplifies faint light. Drains while active.', start: true, toggle: true },
  roar: { name: 'Roar', key: 'KeyR', label: 'R', cd: 25, dur: 2.6, desc: 'A sound that freezes the brave and scatters everyone else.', start: false, cost: 150 },
  mimic: { name: 'Mimic', key: 'Digit5', label: '5', cd: 20, dur: 3, desc: 'Throw a human voice where you are looking. Lures the curious.', start: false, cost: 220 },
  stalk: { name: 'Stalk', key: 'Digit6', label: '6', cd: 30, dur: 10, desc: 'Move almost without sound. Crouched movement is far faster.', start: false, cost: 260 },
};

export class Abilities {
  constructor(game) {
    this.game = game;
    this.state = {}; this.active = {};
    for (const k in ABILITY_DEFS) this.state[k] = { cdT: 0, t: 0, energy: 1 };
  }
  reset() { for (const k in this.state) { this.state[k].cdT = 0; this.state[k].t = 0; this.state[k].energy = 1; } this.active = {}; this.clearEffects(); }
  unlocked(k) { return this.game.progress.isUnlocked('ability_' + k) || ABILITY_DEFS[k].start; }
  level(k) { return this.game.progress.upgradeLevel(k); }
  cooldown(k) { return ABILITY_DEFS[k].cd * (1 - 0.25 * this.level(k)); }
  duration(k) { return ABILITY_DEFS[k].dur * (1 + 0.4 * this.level(k)); }

  handleInput(input) {
    for (const k in ABILITY_DEFS) {
      const D = ABILITY_DEFS[k];
      if (!input.hit(D.key)) continue;
      if (!this.unlocked(k)) { this.game.ui.hint(`${D.name} is locked. Unlock it with essence in the Evolution menu.`, 2.5); continue; }
      this.activate(k);
    }
  }

  activate(k) {
    const S = this.state[k], D = ABILITY_DEFS[k], g = this.game, m = g.monster;
    if (D.toggle) {
      if (this.active[k]) { this.end(k); return; }
      if (S.energy < 0.1) { g.ui.hint('Too strained. Wait a moment.', 1.5); return; }
      this.active[k] = true; S.t = 1;
      g.audio.play('whine', null, { vol: 0.25 });
      return;
    }
    if (S.cdT > 0 || this.active[k]) { g.audio.play('ui', null, { vol: 0.15, f: 110 }); return; }
    S.t = this.duration(k); S.cdT = this.cooldown(k) + S.t; this.active[k] = true;
    const hp = m.headPos();
    switch (k) {
      case 'senses': g.audio.play('sniff', null, { vol: 0.6 }); g.audio.play('shimmer', null, { vol: 0.3 }); g.fx.sensesPulse(m.pos); m.interactT = 0; break;
      case 'predator': g.audio.play('shimmer', null, { vol: 0.25, up: false }); g.audio.play('growl', hp, { vol: 0.35, dur: 0.8, pitch: 1.4 }); break;
      case 'presence': g.audio.play('subSwell', hp, { vol: 0.9 }); break;
      case 'roar': {
        m.roarT = 2.6; m.camShake = 0.6;
        g.audio.play('roar', hp, { vol: 1.3 });
        g.fx.roarWave(m.pos);
        g.emitNoise(m.pos, 55 * (1 + 0.3 * this.level(k)), 'roar');
        for (const n of g.npcs.list) {
          if (!n.alive) continue;
          const d = n.pos.distanceTo(m.pos);
          if (d < 22) {
            n.lastKnown.copy(m.pos); n.recognized = true;
            if (n.role === 'searcher' || n.role === 'guard') { n.attackCD += 3; n.flinchT = 1.5; }
            else if (n.P.panicAt < 1 || Math.random() < 0.6) { n.setState('cower'); n.stateDur = rand(2, 4.5) * (1 + 0.3 * this.level(k)); g.stats.cowered++; }
          }
        }
        g.hallucinations.bump(0.05);
        break;
      }
      case 'mimic': {
        const cam = g.camera; const dir = new THREE.Vector3(); cam.getWorldDirection(dir);
        const d = Math.min(30, g.world.raycast(cam.position.x, cam.position.y, cam.position.z, dir.x, dir.y, dir.z, 30));
        const p = cam.position.clone().addScaledVector(dir, Math.max(2, d - 0.5));
        p.y = g.world.groundAt(p.x, p.z, p.y + 1).y + 1.2;
        g.audio.play('help', p, { pitch: Math.random() < 0.5 ? 1.25 : 0.9, vol: 0.9 });
        setTimeout(() => g.audio.play('babble', p, { pitch: 190, dur: 1.4, vol: 0.6 }), 800);
        for (const n of g.npcs.list) {
          if (!n.alive || n.recognized) continue;
          if (n.pos.distanceTo(p) < 28) { n.suspicion = Math.max(n.suspicion, 0.5); n.stimulus.copy(p); n.becomeUneasy(p); n.stateDur = 1; if (Math.random() < 0.5 + n.P.investigate * 0.5) { n.setState('investigate'); const nd = g.nav.nearest(p, 15); if (nd) n.goTo(nd); } }
        }
        g.fx.sparks(p, [0.3, 0.3, 0.5]);
        break;
      }
      case 'stalk': g.audio.play('whisper', hp, { vol: 0.3, dur: 1 }); break;
    }
  }
  end(k) {
    this.active[k] = false; this.state[k].t = 0;
    if (k === 'night') this.game.audio.play('whine', null, { vol: 0.2, up: false });
    if (k === 'predator') this.setHeat(0);
  }
  clearEffects() { this.setHeat(0); for (const n of this.game.npcs.list) n.senseSprite.visible = false; }

  presenceAura(pos) {
    if (!this.active.presence) return 0;
    const d = pos.distanceTo(this.game.monster.pos); const R = 18 * (1 + 0.4 * this.level('presence'));
    return d < R ? 1 - d / R : 0;
  }

  setHeat(v) {
    for (const n of this.game.npcs.list) {
      const m = n.body.material;
      if (v > 0) { const moving = (n.curSpeed || 0) > 1.5 ? 1 : 0.55; m.emissive.setRGB(1 * v * moving, 0.45 * v * moving, 0.1 * v * moving); }
      else m.emissive.setRGB(0, 0, 0);
    }
  }

  update(dt) {
    const g = this.game, post = g.post;
    for (const k in ABILITY_DEFS) {
      const S = this.state[k];
      if (S.cdT > 0) S.cdT -= dt;
      if (k === 'night') {
        if (this.active.night) { S.energy -= dt / this.duration('night'); if (S.energy <= 0) { S.energy = 0; this.end('night'); } }
        else S.energy = Math.min(1, S.energy + dt / 15);
        continue;
      }
      if (this.active[k]) { S.t -= dt; if (S.t <= 0) this.end(k); }
    }
    post.night = this.active.night ? 1 : 0;
    post.predator = this.active.predator ? 1 : 0;
    post.senses = this.active.senses ? 1 : 0;
    post.presence = this.active.presence ? 0.5 : 0;
    if (this.active.predator) this.setHeat(1);
    // senses markers
    const showSenses = !!this.active.senses;
    const R = 60 * (1 + 0.4 * this.level('senses'));
    for (const n of g.npcs.list) {
      const sp = n.senseSprite;
      const d = n.pos.distanceTo(g.monster.pos);
      sp.visible = showSenses && d < R && !n.removed;
      if (sp.visible) {
        const c = n.vulnerable ? [0.9, 0.1, 0.1] : ['flee', 'cower', 'hide', 'call'].includes(n.state) ? [1, 0.35, 0.2] : n.role === 'searcher' || n.role === 'guard' ? [1, 0.9, 0.2] : n.suspicion > 0.3 ? [1, 0.7, 0.3] : [0.75, 0.85, 1];
        sp.material.color.setRGB(c[0], c[1], c[2]);
        sp.material.opacity = (0.35 + Math.sin(performance.now() / 300 + n.id) * 0.1) * Math.min(1, (R - d) / 10);
      }
    }
    g.map.interactables.forEach((it) => { if (it.marker) it.marker.visible = showSenses && !it.taken && it.pos.distanceTo(g.monster.pos) < R; });
    // presence ability: lights near the monster gutter
    if (this.active.presence) for (const L of g.map.lights) { if (L.pos.distanceTo(g.monster.pos) < 16) L.disturb = 1; }
    // stalk modifies monster
    g.monster.stealthMul = this.active.stalk ? 0.6 : 1;
  }
}
