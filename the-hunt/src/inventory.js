// Backpack: stackable items with carry limits. Key items have a limit of 1.

export const ITEMS = {
  ammo: { name: '.308 Rounds', max: 30, desc: 'Rifle ammunition. Five fit in the magazine.' },
  battery: { name: 'D-Cell Batteries', max: 4, desc: 'A fresh set for the flashlight. Swapped in automatically when the light dies and you press the flashlight key.' },
  food: { name: 'Canned Beans', max: 6, desc: 'Restores 30 hunger and a little health.', use: 'eat' },
  meat: { name: 'Raw Venison', max: 6, desc: 'Edible raw in a pinch (risky). Cook it at a campfire.', use: 'eat' },
  cooked: { name: 'Cooked Venison', max: 6, desc: 'Restores 45 hunger and 12 health.', use: 'eat' },
  medkit: { name: 'First Aid Kit', max: 3, desc: 'Restores 50 health.', use: 'heal' },
  lighter: { name: 'Zippo Lighter', max: 1, key: true, desc: 'Your father\'s. Lights campfires.' },
  radio: { name: 'Handheld Radio', max: 1, key: true, desc: 'Picks up a looping transmission. Equip it to track the signal.' },
  gatekey: { name: 'Gate Key', max: 1, key: true, desc: 'Tagged "N. GATE — SPARE". Opens the barrier on the north road.' },
  jerrycan: { name: 'Fuel Can', max: 1, key: true, desc: 'Half full of gasoline. Enough to run a generator for a night.' },
  kerosene: { name: 'Kerosene', max: 1, key: true, desc: 'Lamp oil. Burns hot and slow.' },
};

export class Inventory {
  constructor(game) {
    this.game = game;
    this.items = {};
  }

  reset() {
    this.items = { ammo: 10, battery: 1, food: 2, medkit: 1, lighter: 1 };
  }

  count(id) { return this.items[id] || 0; }
  has(id) { return this.count(id) > 0; }

  /** Adds up to the carry limit; returns how many were actually added. */
  add(id, n = 1) {
    const max = ITEMS[id]?.max ?? 99;
    const cur = this.count(id);
    const got = Math.max(0, Math.min(n, max - cur));
    this.items[id] = cur + got;
    this.game.ui?.refreshInventory?.();
    return got;
  }

  take(id, n = 1) {
    if (this.count(id) < n) return false;
    this.items[id] -= n;
    if (this.items[id] <= 0) delete this.items[id];
    this.game.ui?.refreshInventory?.();
    return true;
  }

  takeUpTo(id, n) {
    const got = Math.min(n, this.count(id));
    if (got > 0) this.take(id, got);
    return got;
  }

  use(id) {
    const g = this.game, st = g.player.stats;
    const def = ITEMS[id];
    if (!def?.use || !this.has(id)) return false;
    if (def.use === 'eat') {
      if (st.hunger > 95) { g.ui.toast('You are not hungry'); return false; }
      this.take(id);
      if (id === 'food') { st.hunger = Math.min(100, st.hunger + 30); st.health = Math.min(100, st.health + 4); }
      if (id === 'cooked') { st.hunger = Math.min(100, st.hunger + 45); st.health = Math.min(100, st.health + 12); }
      if (id === 'meat') {
        st.hunger = Math.min(100, st.hunger + 14);
        if (Math.random() < 0.5) { st.health = Math.max(1, st.health - 8); g.ui.toast('That was a mistake. Your stomach turns.'); }
      }
      g.audio.eat();
      g.ui.toast(`Ate ${def.name.toLowerCase()}`);
      return true;
    }
    if (def.use === 'heal') {
      if (st.health >= 100) { g.ui.toast('You are not hurt'); return false; }
      this.take(id);
      st.health = Math.min(100, st.health + 50);
      g.audio.page();
      g.ui.toast('Patched yourself up');
      return true;
    }
    return false;
  }

  eatBest() {
    for (const id of ['cooked', 'food', 'meat']) if (this.has(id)) return this.use(id);
    this.game.ui.toast('Nothing to eat');
    return false;
  }

  serialize() { return { ...this.items }; }
  load(d) { this.items = { ...d }; }
}
