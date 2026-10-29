import { ARENA_RADIUS } from './config.js';
import { buildShrineModel, buildPortalModel } from './models2.js';

export const EVENTS = {
  bloodmoon:   { name: 'Blood Moon', icon: '🌑', color: '#ff3355', kind: 'risk',
                 desc: 'Enemies move and attack faster and hit 15% harder, but drop 60% more XP.' },
  crystalrush: { name: 'Crystal Rush', icon: '💎', color: '#5ad1ff', kind: 'boon',
                 desc: 'XP crystals rain from the rift for 25 seconds.' },
  elitehunt:   { name: 'Elite Hunt', icon: '🎯', color: '#ffb547', kind: 'hunt',
                 desc: 'A powerful two-modifier elite appears. Slay it for a relic and 40 gold.' },
  unstable:    { name: 'Unstable Ground', icon: '🌋', color: '#ff8a2a', kind: 'risk',
                 desc: 'Marked ground erupts every few seconds. Survive the wave for +20 Rift Shards.' },
  supply:      { name: 'Supply Rift', icon: '🛒', color: '#7dffcf', kind: 'boon',
                 desc: 'A merchant portal opens before the wave. Walk in and press E to spend gold.' },
  double:      { name: 'Double Trouble', icon: '⚔️', color: '#ff5ff0', kind: 'hunt',
                 desc: 'Two elites attack together. Defeat both for 50 gold and bonus XP.' },
};

export const SUPPLY_ITEMS = [
  { id: 'heal', name: 'Healing Draught', icon: '🧪', cost: 15, desc: 'Restore 35% of your max health.' },
  { id: 'tome', name: 'Rift Tome', icon: '📖', cost: 35, desc: 'Choose one upgrade right now.' },
  { id: 'relic', name: 'Relic Cache', icon: '🔮', cost: 60, desc: 'Choose one of three relics.' },
  { id: 'heart', name: 'Reinforced Heart', icon: '💗', cost: 25, desc: '+12 max health for this run (up to 3 times).', limit: 3 },
];

// Shrine bargains. Each lists its risk/cost and reward plainly so the choice is informed.
export const SHRINE_OPTIONS = {
  bloodpact: { name: 'Blood Pact', icon: '🩸', risk: 'Lose 15% max health for this run.', reward: '+15% damage for this run.' },
  trial:     { name: 'Trial of Champions', icon: '⚔️', risk: 'A two-modifier elite attacks you now.', reward: 'It drops a guaranteed Rare or Legendary relic.' },
  mend:      { name: 'Golden Mending', icon: '🪙', risk: 'Costs 30 gold.', reward: 'Restore 50% of your max health.', gold: 30 },
  wisdom:    { name: 'Draught of Wisdom', icon: '📘', risk: 'None.', reward: 'Gain a level immediately.', pair: 'fury' },
  fury:      { name: 'Draught of Fury', icon: '🔥', risk: 'None.', reward: '+30% damage, +35% attack speed and +10% speed for 60 seconds.', pair: 'wisdom' },
  gamble:    { name: "Gambler's Altar", icon: '🎲', risk: 'Costs 25 gold.', reward: 'Receive a random relic.', gold: 25 },
  ironvow:   { name: 'Iron Vow', icon: '⛓️', risk: 'Lose 8% movement speed for this run.', reward: '+30 max health for this run.' },
};

// Schedules events every 2-3 waves, runs active effects, and owns the shrine/portal interactables.
export class RiftEvents {
  constructor(scene, game) {
    this.game = game;
    this.shrine = buildShrineModel();
    this.portal = buildPortalModel();
    this.shrine.group.visible = false;
    this.portal.group.visible = false;
    scene.add(this.shrine.group, this.portal.group);
    this.reset();
  }

  reset() {
    this.nextEventWave = 2 + Math.floor(Math.random() * 2);
    this.planned = null;       // { wave, id }
    this.active = null;        // id
    this.timer = 0;
    this.shrineOn = false;
    this.portalOn = false;
    this.shrine.group.visible = false;
    this.portal.group.visible = false;
    this.huntIds = [];
  }

  isBossWave(n) {
    const w = this.game.waves;
    return w.defFor(n).boss;
  }

  // Called when a break begins before wave `n`. Picks an event and maybe places a shrine.
  planFor(n) {
    const g = this.game;
    this.planned = null;
    if (n >= this.nextEventWave && !this.isBossWave(n)) {
      const hasMini = (this.game.waves.defFor(n).elites || []).some((e) => e.miniboss);
      const ids = Object.keys(EVENTS).filter((id) => id !== this.lastId && !(hasMini && (id === 'double' || id === 'elitehunt')));
      const id = ids[Math.floor(Math.random() * ids.length)];
      this.lastId = id;
      this.planned = { wave: n, id };
      this.nextEventWave = n + 2 + Math.floor(Math.random() * 2);
      if (id === 'supply') this.openPortal();
    } else if (n >= 3 && !this.shrineOn && Math.random() < 0.4) {
      this.placeShrine();
    }
    return this.planned;
  }

  spot(minD, maxD) {
    const g = this.game, pl = g.player;
    for (let i = 0; i < 30; i++) {
      const a = Math.random() * Math.PI * 2, d = minD + Math.random() * (maxD - minD);
      const x = pl.x + Math.cos(a) * d, z = pl.z + Math.sin(a) * d;
      if (Math.hypot(x, z) < ARENA_RADIUS - 4 && !g.world.insideObstacle(x, z, 2)) return [x, z];
    }
    return [0, 0];
  }

  placeShrine() {
    const [x, z] = this.spot(7, 12);
    this.shrineOn = true;
    this.shrineX = x; this.shrineZ = z;
    this.shrineWave = this.game.waves.wave + 1;
    this.shrine.group.position.set(x, 0, z);
    this.shrine.group.visible = true;
    this.game.ui.toast('A Rift Shrine appeared', '#ffd36b', 'Walk to it and press E to see its bargain.');
  }

  openPortal() {
    const [x, z] = this.spot(6, 10);
    this.portalOn = true;
    this.portalX = x; this.portalZ = z;
    this.portal.group.position.set(x, 0, z);
    this.portal.group.visible = true;
    this.game.waves.breakT += 10; // extra time to shop
  }

  closePortal() { this.portalOn = false; this.portal.group.visible = false; }
  closeShrine() { this.shrineOn = false; this.shrine.group.visible = false; }

  // Called when wave n actually starts.
  startWave(n) {
    const g = this.game;
    this.active = null;
    g.mods.enemySpeed = 1; g.mods.enemyCd = 1; g.mods.enemyDmg = 1; g.mods.xp = 1;
    g.world.setTint(null);
    if (this.portalOn) this.closePortal();
    if (!this.planned || this.planned.wave !== n) return;
    const id = this.planned.id, ev = EVENTS[id];
    this.active = id;
    this.timer = 0;
    g.run.eventsSeen++;
    g.ui.toast(`${ev.icon} Rift Event: ${ev.name}`, ev.color, ev.desc);
    if (id === 'bloodmoon') { g.mods.enemySpeed = 1.15; g.mods.enemyCd = 0.85; g.mods.enemyDmg = 1.15; g.mods.xp = 1.6; g.world.setTint('blood'); }
    if (id === 'elitehunt') this.huntT = 6;
    if (id === 'double') this.huntT = 8;
    if (id === 'unstable') this.eruptT = 4;
    if (id === 'supply') this.active = null; // shopping happened during the break
  }

  endWave() {
    const g = this.game;
    if (this.active === 'unstable') { g.run.shards += 20; g.ui.toast('Survived Unstable Ground', '#ff8a2a', '+20 Rift Shards'); }
    if (this.shrineOn && g.waves.wave >= this.shrineWave) this.closeShrine();
    this.active = null;
    g.mods.enemySpeed = 1; g.mods.enemyCd = 1; g.mods.enemyDmg = 1; g.mods.xp = 1;
    g.world.setTint(null);
  }

  update(dt) {
    const g = this.game, pl = g.player;
    // Interactables
    g.interactHint = '';
    if (this.shrineOn && Math.hypot(pl.x - this.shrineX, pl.z - this.shrineZ) < 2.6) {
      g.interactHint = 'Press E to commune with the Rift Shrine';
      if (g.input.wasPressed('KeyE')) g.openShrine();
    }
    if (this.portalOn && Math.hypot(pl.x - this.portalX, pl.z - this.portalZ) < 2.6) {
      g.interactHint = 'Press E to trade at the Supply Rift';
      if (g.input.wasPressed('KeyE')) g.openSupply();
    }

    if (!this.active || g.waves.state === 'break') return;
    this.timer += dt;
    const id = this.active;
    if (id === 'crystalrush' && this.timer < 25) {
      this.rainT = (this.rainT || 0) - dt;
      if (this.rainT <= 0) {
        this.rainT = 0.3;
        const [x, z] = this.spot(2, 13);
        g.pickups.drop(x, z, 1 + Math.floor(Math.random() * 3));
        g.effects.particle(x, 6, z, 0, -10, 0, 0.5, 0.25, '#5ad1ff');
      }
    }
    if (id === 'unstable') {
      this.eruptT -= dt;
      if (this.eruptT <= 0) {
        this.eruptT = 3.6;
        const pts = [[pl.x + (Math.random() - 0.5) * 3, pl.z + (Math.random() - 0.5) * 3]];
        for (let i = 0; i < 3; i++) pts.push(this.spot(4, 12));
        for (const [x, z] of pts) g.hazards.add({ x, z, r: 2.6, delay: 1.4, damage: 14 * g.diff.enemyDmg, color: '#ff8a2a' });
        g.sound.play('warning');
      }
    }
    if ((id === 'elitehunt' || id === 'double') && this.huntT !== null) {
      this.huntT -= dt;
      if (this.huntT <= 0) {
        this.huntT = null;
        const types = Object.keys(g.waves.def.mix || { crawler: 1 }).filter((t) => t !== 'crawler');
        const pickType = () => types[Math.floor(Math.random() * types.length)] || 'brute';
        if (id === 'elitehunt') {
          const [x, z] = this.spot(14, 18);
          const e = g.enemies.spawn(pickType(), x, z, { elite: true, mods: g.enemies.rollMods(2), hpScale: 1.5, special: 'hunt' });
          g.waves.addQuota(1);
          this.huntIds = [e.id];
        } else {
          this.huntIds = [];
          for (let i = 0; i < 2; i++) {
            const [x, z] = this.spot(13, 18);
            const e = g.enemies.spawn(pickType(), x, z, { elite: true, mods: g.enemies.rollMods(1), special: 'double' });
            g.waves.addQuota(1);
            this.huntIds.push(e.id);
          }
        }
        g.sound.play('spawnElite');
        g.ui.toast(id === 'elitehunt' ? 'The hunted elite has arrived!' : 'Two elites have arrived!', EVENTS[id].color);
      }
    }
  }

  onKill(e) {
    const g = this.game;
    if (e.special === 'double') {
      this.huntIds = this.huntIds.filter((i) => i !== e.id);
      g.addGold(25);
      if (this.huntIds.length === 0) { g.gainXp(30); g.ui.toast('Double Trouble cleared!', '#ff5ff0', '+50 gold and bonus XP'); }
    }
    if (e.special === 'hunt') {
      g.addGold(40);
      g.pickups.drop(e.x, e.z, 1, 'chest', { bias: 4 });
      g.ui.toast('Elite Hunt complete!', '#ffb547', 'A relic cache dropped.');
    }
    if (e.special === 'trial') {
      g.pickups.drop(e.x, e.z, 1, 'chest', { bias: 10, minRare: true });
      g.ui.toast('Trial complete!', '#ffd36b', 'Claim your relic.');
    }
  }

  render(t) {
    if (this.shrineOn) {
      this.shrine.gem.rotation.y = t * 1.5;
      this.shrine.gem.position.y = 3.3 + Math.sin(t * 2) * 0.15;
      this.shrine.ring.scale.setScalar(1 + Math.sin(t * 3) * 0.05);
    }
    if (this.portalOn) {
      this.portal.frame.rotation.z = t;
      this.portal.fill.material.opacity = 0.35 + Math.sin(t * 3) * 0.1;
      this.portal.group.rotation.y = Math.atan2(this.game.camera.position.x - this.portalX, this.game.camera.position.z - this.portalZ);
    }
  }
}

// Pick two distinct shrine options (Wisdom/Fury always come as a pair).
export function rollShrine() {
  const ids = ['bloodpact', 'trial', 'mend', 'wisdom', 'gamble', 'ironvow'];
  const a = ids[Math.floor(Math.random() * ids.length)];
  if (a === 'wisdom') return ['wisdom', 'fury'];
  let b;
  do { b = ids[Math.floor(Math.random() * ids.length)]; } while (b === a || b === 'wisdom');
  return [a, b];
}
