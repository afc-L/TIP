'use strict';
// Save system (localStorage, 3 slots + settings). Everything in MB.state is plain JSON.
MB.Save = {
  KEY: 'monsterbound_slot_',
  storage() { try { const k = '__mbtest'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return localStorage; } catch (e) { return null; } },
  save(slot, quiet) {
    const st = this.storage();
    if (!st || !MB.state) return false;
    try {
      const S = MB.state;
      S.savedAt = Date.now();
      const data = JSON.stringify(S, (k, v) => (k.startsWith('_') ? undefined : v));
      st.setItem(this.KEY + slot, data);
      st.setItem(this.KEY + slot + '_info', JSON.stringify(this.makeInfo(S)));
      if (quiet) MB.toast && MB.toast('Saved', '#305030');
      return true;
    } catch (e) { console.error('save failed', e); return false; }
  },
  load(slot) {
    const st = this.storage(); if (!st) return null;
    try {
      const raw = st.getItem(this.KEY + slot); if (!raw) return null;
      const S = JSON.parse(raw);
      return MB.migrateState(S);
    } catch (e) { console.error('load failed', e); return null; }
  },
  del(slot) { const st = this.storage(); if (!st) return; st.removeItem(this.KEY + slot); st.removeItem(this.KEY + slot + '_info'); },
  info(slot) { const st = this.storage(); if (!st) return null; try { const r = st.getItem(this.KEY + slot + '_info'); return r ? JSON.parse(r) : null; } catch (e) { return null; } },
  any() { return [0, 1, 2].some((i) => this.info(i)); },
  fmtTime(sec) { const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60); return `${h}:${MB.pad(m, 2)}`; },
  makeInfo(S) {
    const spec = MB.WORLD_SPECS[S.map];
    return { name: S.name, location: spec ? spec.name : S.map, badges: S.badges.length + (S.vBadges.length ? '+' + S.vBadges.length : ''), dex: MB.Dex.countCaught(), time: this.fmtTime(S.playTime), money: S.money, saved: new Date(S.savedAt).toLocaleString(), party: S.party.filter((m) => !m.egg).map((m) => ({ sp: m.sp, shiny: m.shiny })) };
  },
  saveSettings() { const st = this.storage(); if (!st) return; const s = MB.state ? MB.state.settings : MB.settings; try { st.setItem('monsterbound_settings', JSON.stringify(s)); } catch (e) { void e; } MB.settings = s; },
  loadSettings() { const st = this.storage(); try { const r = st && st.getItem('monsterbound_settings'); if (r) return JSON.parse(r); } catch (e) { void e; } return null; },
};
MB.defaultSettings = () => ({ music: 0.5, sfx: 0.7, textSpeed: 60, textSpeedIdx: 1, battleStyle: 'switch', realTime: false, tint: true, weather: true, pixelPerfect: false, autosave: true });
MB.newState = function (o) {
  return Object.assign({
    version: 1, name: 'Alex', trainerId: MB.pad(Math.floor(Math.random() * 99999), 5), appearance: null, rivalName: 'Kael', rivalApp: null, starter: null,
    map: 'wb_home', px: 3, py: 2, dir: 'down', region: 'A', party: [], boxes: Array.from({ length: 8 }, () => []), bag: { potion: 3 }, keyItems: {}, money: 3000,
    badges: [], vBadges: [], flags: {}, quests: {}, dex: {}, visited: {}, ach: {}, clock: 8 * 60, day: 0, playTime: 0, steps: 0, repel: 0, lure: 0,
    daycare: { mons: [], egg: null, counter: 0 }, stats: {}, settings: Object.assign(MB.defaultSettings(), MB.settings || {}), chapter: 0, starShards: [], frontier: null, hallOfFame: [], gates: {}, riftPhase: 0,
  }, o || {});
};
MB.migrateState = function (S) {
  const base = MB.newState();
  for (const k in base) if (S[k] === undefined) S[k] = base[k];
  S.settings = Object.assign(MB.defaultSettings(), S.settings || {});
  // drop unknown species/moves defensively
  const fix = (m) => { if (!MB.SP[m.sp]) return false; m.moves = (m.moves || []).filter((x) => MB.MOVES[x.id]); if (!m.moves.length) MB.Mon.defaultMoves(m); return true; };
  S.party = S.party.filter(fix); S.boxes = S.boxes.map((b) => b.filter(fix));
  for (const id in S.bag) if (!MB.ITEMS[id]) delete S.bag[id];
  if (!MB.WORLD_SPECS[S.map]) { S.map = 'willowbrook'; S.px = null; S.py = null; }
  return S;
};
