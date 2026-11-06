'use strict';
// Dex, Map, Quest Journal, Achievements, Settings, Save, Pause menu, Title, Character
// creation, Starter select, Evolution, Hatching, Hall of Fame.
(function () {
  const UI = MB.UI;
  const bg = MB.bgPanel;

  // ===================== AETHERDEX =====================
  class DexScene {
    constructor() { this.region = MB.state.region === 'V' && MB.state.flags.first_veloria ? 'V' : 'A'; this.idx = 0; this.scroll = 0; this.detail = false; this.mega = false; this.filter = 'all'; }
    list() { return MB.SPECIES.filter((s) => s.region === this.region && (this.filter === 'all' || (this.filter === 'caught' ? MB.state.dex[s.key] && MB.state.dex[s.key].caught : s.mega))); }
    update() {
      const I = MB.input, L = this.list();
      if (this.detail) {
        if (I.pressed('b')) { this.detail = false; this.mega = false; return; }
        if (I.pressed('a') && L[this.idx].mega && this.known(L[this.idx])) { this.mega = !this.mega; MB.audio.sfx(this.mega ? 'statup' : 'move'); }
        if (I.repeat('down')) { this.idx = Math.min(L.length - 1, this.idx + 1); this.mega = false; }
        if (I.repeat('up')) { this.idx = Math.max(0, this.idx - 1); this.mega = false; }
        if (I.pressed('left') || I.pressed('right')) { const s = L[this.idx]; if (this.known(s)) MB.audio.cry(s.key, this.mega); }
        return;
      }
      if (I.repeat('down')) this.idx = Math.min(L.length - 1, this.idx + 1);
      if (I.repeat('up')) this.idx = Math.max(0, this.idx - 1);
      if (I.repeat('right')) this.idx = Math.min(L.length - 1, this.idx + 10);
      if (I.repeat('left')) this.idx = Math.max(0, this.idx - 10);
      if (this.idx < this.scroll) this.scroll = this.idx; if (this.idx >= this.scroll + 12) this.scroll = this.idx - 11;
      if (I.pressed('b')) { this.close(); return; }
      if (I.pressed('a') && L.length) { if (this.known(L[this.idx])) { this.detail = true; MB.audio.sfx('select'); } else MB.audio.sfx('error'); }
      if (I.pressed('rift') || I.pressed('dex') || I.pressed('quests')) {
        if (MB.state.flags.first_veloria && I.pressed('rift')) { this.region = this.region === 'A' ? 'V' : 'A'; this.idx = 0; this.scroll = 0; }
        else { this.filter = { all: 'caught', caught: 'mega', mega: 'all' }[this.filter]; this.idx = 0; this.scroll = 0; }
      }
    }
    known(s) { const e = MB.state.dex[s.key]; return e && e.seen; }
    draw(ctx) {
      const S = MB.state, L = this.list();
      bg(ctx, '', '#a03838');
      const regionName = this.region === 'A' ? 'AETHERIA' : 'VELORIA';
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(0, 0, MB.W, 18);
      UI.text(ctx, `AETHERDEX — ${regionName}`, 8, 13, { size: 9, bold: true, color: '#fff' });
      const all = MB.SPECIES.filter((s) => s.region === this.region);
      const seen = all.filter((s) => S.dex[s.key] && S.dex[s.key].seen).length, caught = all.filter((s) => S.dex[s.key] && S.dex[s.key].caught).length;
      UI.text(ctx, `Seen ${seen}  Caught ${caught}/${all.length}  (${Math.round((caught / all.length) * 100)}%)`, MB.W - 6, 13, { size: 7, color: '#fff', align: 'right' });
      if (!L.length) { UI.box(ctx, 4, 22, MB.W - 8, 30); UI.text(ctx, 'No entries.', 14, 40); return; }
      const s = L[this.idx];
      if (this.detail) return this.drawDetail(ctx, s);
      UI.box(ctx, 4, 22, 150, 196);
      L.slice(this.scroll, this.scroll + 12).forEach((sp, i) => {
        const y = 36 + i * 15, e = S.dex[sp.key] || {};
        if (this.scroll + i === this.idx) { ctx.fillStyle = '#f8e0a0'; ctx.fillRect(8, y - 10, 142, 14); }
        UI.text(ctx, MB.pad(sp.id, 3), 12, y, { size: 7, color: '#808090' });
        if (e.caught) MB.drawCapsuleIcon(ctx, 'basic_capsule', 38, y - 3, 0.7, 0, 0);
        UI.text(ctx, e.seen ? sp.name : '-----', 46, y, { size: 7, bold: !!e.caught });
        if (sp.mega && e.seen) UI.text(ctx, '◆', 146, y, { size: 6, color: e.mega ? '#ff40c0' : '#c0a0c0', align: 'right' });
      });
      UI.box(ctx, 158, 22, 158, 196);
      const e = S.dex[s.key] || {};
      if (e.seen) {
        ctx.drawImage(MB.Sprites.get(s.key, false), 189, 26, 96, 96);
        UI.text(ctx, s.name, 237, 132, { size: 9, bold: true, align: 'center' });
        s.types.forEach((t, i) => UI.typeBadge(ctx, t, 237 - s.types.length * 21 + i * 42, 138, 40));
        UI.text(ctx, e.caught ? 'Caught' : 'Seen', 237, 162, { size: 7, align: 'center', color: e.caught ? '#30a030' : '#a08030' });
        UI.text(ctx, `Rarity: ${{ c: 'Common', u: 'Uncommon', r: 'Rare', vr: 'Very Rare', anc: 'Ancient', leg: 'Legendary', myth: 'Mythical', sec: 'Secret' }[s.rarity]}`, 237, 176, { size: 6, align: 'center' });
        UI.text(ctx, 'Z: details', 237, 208, { size: 6, align: 'center', color: '#808090' });
      } else { ctx.fillStyle = '#c0b8b0'; ctx.beginPath(); ctx.arc(237, 76, 30, 0, Math.PI * 2); ctx.fill(); UI.text(ctx, '?', 237, 84, { size: 20, bold: true, align: 'center', color: '#fff' }); }
      UI.box(ctx, 4, 220, MB.W - 8, 18);
      UI.text(ctx, `▲▼ browse  ◄► jump  P: filter (${this.filter})${S.flags.first_veloria ? '  R: region' : ''}  X: back`, 10, 232, { size: 6 });
    }
    drawDetail(ctx, s) {
      const e = MB.state.dex[s.key] || {};
      const mega = this.mega && s.mega;
      UI.box(ctx, 4, 22, 120, 120, mega ? 'mega' : undefined);
      ctx.drawImage(MB.Sprites.get(s.key, mega), 16, 30 + Math.sin(performance.now() / 300) * 1.5, 96, 96);
      UI.text(ctx, `No.${MB.pad(s.id, 3)}`, 10, 136, { size: 7, color: mega ? '#fff' : '#606070' });
      UI.box(ctx, 128, 22, 188, 120);
      UI.text(ctx, mega ? s.mega.name : s.name, 136, 38, { size: 9, bold: true });
      (mega ? s.mega.types : s.types).forEach((t, i) => UI.typeBadge(ctx, t, 136 + i * 42, 44, 40));
      const B = mega ? s.mega.base : s.base;
      MB.STAT_KEYS.forEach((k, i) => { const y = 66 + i * 11; UI.text(ctx, MB.STAT_NAMES[k], 136, y, { size: 6 }); UI.text(ctx, String(B[k]), 196, y, { size: 6, align: 'right', bold: true }); UI.bar(ctx, 200, y - 5, 108, 4, B[k] / 180, mega ? '#ff60d0' : '#60b060'); });
      UI.text(ctx, `Ability: ${mega ? MB.ABILITIES[s.mega.ability].name : s.abilities.slice(0, 2).map((a) => MB.ABILITIES[a].name).join(' / ')}`, 136, 136, { size: 6 });
      UI.box(ctx, 4, 146, MB.W - 8, 90);
      const lines = MB.UI.wrapLines(ctx, s.desc, MB.W - 30, 6.5);
      lines.slice(0, 3).forEach((l, i) => UI.text(ctx, l, 12, 160 + i * 10, { size: 6.5 }));
      const hab = s.legendary ? 'Unique location' : s.eggOnly ? 'Hatches from Eggs only' : s.fossil ? 'Revived from fossils' : s.starter ? 'Gift from Prof. Hazel' : s.habitats.join(', ');
      UI.text(ctx, `Habitat: ${hab}${s.night ? ' (night)' : s.day ? ' (day)' : ''}${s.water ? ' — water' : ''}`, 12, 196, { size: 6, color: '#405080' });
      const chain = MB.evoChain(s.key).map((c) => c.sp);
      UI.text(ctx, 'Line: ' + chain.map((c) => (MB.state.dex[c.key] && MB.state.dex[c.key].seen ? c.name : '???')).join(' → '), 12, 208, { size: 6 });
      if (s.prev) { const ev = MB.SP[s.prev].evo.find((x) => x.to === s.key); UI.text(ctx, 'Evolves from ' + MB.SP[s.prev].name + ': ' + MB.evoText(ev), 12, 218, { size: 6, color: '#606070' }); }
      if (s.mega) UI.text(ctx, `◆ Mega Evolution known — needs ${MB.ITEMS[s.mega.stone].name}. Z: view Mega`, 12, 230, { size: 6, color: '#a03080' });
      else if (!e.caught) UI.text(ctx, 'Catch it to learn more!', 12, 230, { size: 6, color: '#606070' });
    }
  }
  MB.DexScene = DexScene;

  // ===================== MAP =====================
  class MapScene {
    constructor(opts = {}) { this.opts = opts; this.region = MB.state.region || 'A'; this.towns = this.places(); this.idx = Math.max(0, this.towns.findIndex((s) => s.id === MB.state.map)); }
    places() { return Object.values(MB.WORLD_SPECS).filter((s) => s.region === this.region && s.mapXY && (s.type !== 'interior' && s.type !== 'gym')); }
    update() {
      const I = MB.input;
      const vis = this.towns.filter((s) => MB.state.visited[s.id]);
      if (!vis.length) { if (I.pressed('b') || I.pressed('a') || I.pressed('map')) this.close(); return; }
      let cur = vis.indexOf(this.towns[this.idx]); if (cur < 0) cur = 0;
      if (I.repeat('right') || I.repeat('down')) { cur = (cur + 1) % vis.length; this.idx = this.towns.indexOf(vis[cur]); MB.audio.sfx('move'); }
      if (I.repeat('left') || I.repeat('up')) { cur = (cur + vis.length - 1) % vis.length; this.idx = this.towns.indexOf(vis[cur]); MB.audio.sfx('move'); }
      if (I.pressed('b') || I.pressed('map')) { this.close(null); return; }
      if (I.pressed('a') && MB.state.keyItems.wing_whistle && this.opts.canFly !== false) {
        const t = this.towns[this.idx];
        if (t.fly && MB.state.visited[t.id] && t.id !== MB.state.map) { this.close(t.id); }
        else MB.audio.sfx('error');
      }
    }
    draw(ctx) {
      const S = MB.state;
      bg(ctx, '', this.region === 'A' ? '#3a7aa0' : '#5a4a90');
      ctx.fillStyle = this.region === 'A' ? '#5aa0d0' : '#6a5ab0'; ctx.fillRect(4, 20, MB.W - 8, 178);
      const sx = (MB.W - 16) / 48, sy = 172 / 32;
      const P = (s) => [8 + s.mapXY[0] * sx, 24 + s.mapXY[1] * sy];
      // landmass blobs
      ctx.fillStyle = this.region === 'A' ? '#78b860' : '#8a8ab8';
      for (const s of this.towns) { const [x, y] = P(s); ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = this.region === 'A' ? '#98c878' : '#a8a0d0';
      for (const s of this.towns) { const [x, y] = P(s); ctx.beginPath(); ctx.arc(x - 2, y - 2, 9, 0, Math.PI * 2); ctx.fill(); }
      // connections
      ctx.strokeStyle = 'rgba(255,250,220,0.8)'; ctx.lineWidth = 2;
      for (const s of this.towns) for (const e of s.exits || []) { const t = MB.WORLD_SPECS[e.to]; if (!t || !t.mapXY || !(S.visited[s.id] || S.visited[t.id])) continue; const [a, b] = P(s), [c, d] = P(t); ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke(); }
      for (const s of this.towns) {
        const [x, y] = P(s); const v = S.visited[s.id];
        const town = s.type === 'town';
        ctx.fillStyle = !v ? 'rgba(60,60,80,0.6)' : town ? '#e04848' : s.type === 'cave' ? '#806040' : '#f0e8c0';
        if (town) ctx.fillRect(x - 3.5, y - 3.5, 7, 7); else { ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill(); }
        if (s.id === S.map) { const b = Math.floor(performance.now() / 300) % 2; ctx.strokeStyle = b ? '#fff' : '#ff4040'; ctx.lineWidth = 1.5; ctx.strokeRect(x - 6, y - 6, 12, 12); }
      }
      const t = this.towns[this.idx];
      if (t) { const [x, y] = P(t); ctx.strokeStyle = '#fff070'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.stroke(); }
      UI.box(ctx, 4, 200, MB.W - 8, 36);
      if (t && S.visited[t.id]) {
        UI.text(ctx, t.name, 12, 214, { size: 8, bold: true });
        UI.text(ctx, t.subtitle || (t.wild ? `Wild creatures Lv. ${t.wild.lvl[0]}-${t.wild.lvl[1]}` : ''), 12, 228, { size: 6 });
        if (S.keyItems.wing_whistle && t.fly) UI.text(ctx, 'Z: Fly here', MB.W - 12, 214, { size: 7, align: 'right', color: '#3060a0' });
      } else UI.text(ctx, 'Explore to reveal more of the map.', 12, 220, { size: 7 });
      UI.text(ctx, (this.region === 'A' ? 'AETHERIA' : 'VELORIA') + `  ${MB.World.DAY_NAMES[MB.World.dayOfWeek()]}  ${MB.cap(MB.World.season())}`, 8, 14, { size: 8, bold: true, color: '#fff' });
    }
  }
  MB.MapScene = MapScene;

  // ===================== QUEST JOURNAL =====================
  class QuestScene {
    constructor() { this.tab = 0; this.idx = 0; this.scroll = 0; }
    list() {
      const S = MB.state;
      if (this.tab === 0) return MB.QUESTS.filter((q) => S.quests[q.id] && !S.quests[q.id].done);
      if (this.tab === 1) return MB.QUESTS.filter((q) => S.quests[q.id] && S.quests[q.id].done);
      return [];
    }
    update() {
      const I = MB.input, L = this.list();
      if (I.pressed('left') || I.pressed('right')) { this.tab = (this.tab + (I.pressed('right') ? 1 : 2)) % 3; this.idx = 0; this.scroll = 0; }
      if (L.length) { if (I.repeat('down')) this.idx = (this.idx + 1) % L.length; if (I.repeat('up')) this.idx = (this.idx + L.length - 1) % L.length; }
      if (this.idx < this.scroll) this.scroll = this.idx; if (this.idx >= this.scroll + 7) this.scroll = this.idx - 6;
      if (I.pressed('b') || I.pressed('quests')) this.close();
    }
    draw(ctx) {
      const S = MB.state;
      bg(ctx, '', '#2a6a5a');
      const tabs = ['ACTIVE', 'COMPLETED', 'STORY'];
      tabs.forEach((t, i) => { ctx.fillStyle = i === this.tab ? '#fff070' : 'rgba(255,255,255,0.25)'; UI.rr(ctx, 4 + i * 80, 3, 76, 14, 3); ctx.fill(); UI.text(ctx, t, 42 + i * 80, 13, { size: 7, bold: true, align: 'center', color: i === this.tab ? '#303040' : '#fff' }); });
      const done = Object.values(S.quests).filter((q) => q.done).length;
      UI.text(ctx, `${done}/${MB.QUESTS.length} done`, MB.W - 6, 13, { size: 7, color: '#fff', align: 'right' });
      if (this.tab === 2) {
        UI.box(ctx, 4, 22, MB.W - 8, 214);
        const ch = S.chapter || 0;
        UI.text(ctx, MB.CHAPTERS[ch], 14, 40, { size: 9, bold: true, color: '#503080' });
        UI.text(ctx, MB.storyHint(), 14, 58, { size: 7 });
        let y = 84;
        UI.text(ctx, 'Chapters', 14, y, { size: 7, bold: true }); y += 12;
        MB.CHAPTERS.forEach((c, i) => { if (i <= ch) { UI.text(ctx, (i < ch ? '✓ ' : '► ') + c, 18, y, { size: 6, color: i < ch ? '#409040' : '#303040' }); y += 9; } });
        UI.text(ctx, `Badges: ${S.badges.length}/8   Seals: ${S.vBadges.length}/6   Star Shards: ${(S.starShards || []).length}/8`, 14, 228, { size: 6 });
        return;
      }
      const L = this.list();
      UI.box(ctx, 4, 22, 150, 214);
      if (!L.length) UI.text(ctx, this.tab === 0 ? 'No active quests. Talk to people!' : 'None yet.', 12, 40, { size: 6 });
      L.slice(this.scroll, this.scroll + 7).forEach((q, i) => {
        const y = 38 + i * 28;
        if (this.scroll + i === this.idx) { ctx.fillStyle = '#f8e0a0'; ctx.fillRect(8, y - 10, 142, 26); }
        UI.text(ctx, q.name, 12, y, { size: 7, bold: true });
        const map = q.map ? MB.WORLD_SPECS[q.map] : Object.values(MB.WORLD_SPECS).find((s) => (s.npcs || []).some((n) => n.script === 'q:' + q.id) || (s.buildings || []).some((b) => (b.npcs || []).some((n) => n.script === 'q:' + q.id)));
        UI.text(ctx, map ? map.name : '', 12, y + 11, { size: 6, color: '#606070' });
      });
      UI.box(ctx, 158, 22, 158, 214);
      const q = L[this.idx];
      if (q) {
        const st = S.quests[q.id];
        UI.text(ctx, q.name, 166, 38, { size: 8, bold: true });
        UI.text(ctx, 'From: ' + q.giver, 166, 52, { size: 6, color: '#606070' });
        const intro = MB.UI.wrapLines(ctx, q.intro, 140, 6); MB.UI.font(ctx, 6); intro.slice(0, 7).forEach((l, i) => UI.text(ctx, l, 166, 68 + i * 10, { size: 6 }));
        if (!st.done) { UI.text(ctx, 'Objective:', 166, 150, { size: 7, bold: true }); const p = MB.UI.wrapLines(ctx, MB.Quests.progressText(q, st), 140, 6); p.slice(0, 3).forEach((l, i) => UI.text(ctx, l, 166, 164 + i * 10, { size: 6, color: '#205080' })); if (q.type === 'stages') UI.text(ctx, `Stage ${st.stage + 1}/${q.stages.length}`, 166, 200, { size: 6 }); }
        else UI.text(ctx, '✓ Completed', 166, 150, { size: 8, bold: true, color: '#309030' });
        const R = q.reward || {};
        UI.text(ctx, 'Reward: ' + [...(R.items || []).map(([id, n]) => `${MB.ITEMS[id].name}${n > 1 ? ' x' + n : ''}`), R.money ? '$' + R.money : ''].filter(Boolean).join(', ').slice(0, 40), 166, 226, { size: 6, color: '#806020' });
      }
    }
  }
  MB.QuestScene = QuestScene;
  MB.storyHint = function () {
    const S = MB.state, f = S.flags;
    if (!f.got_starter) return 'Visit Professor Hazel\'s lab in Willowbrook.';
    if (!f.badge_mira) return 'Travel north to Verdant City and earn Mira\'s badge.';
    if (!f.moonveil_done) return 'Head east through Route 2 into Moonveil Forest.';
    if (!f.badge_voltan) return 'Challenge Voltan at the Crystalwater Gym.';
    if (!f.badge_brutus) return 'Cross Ironpeak Mountain to reach Sunspire City.';
    if (!f.hollow_done) return 'Investigate the commotion at Ancient Hollow.';
    if (!f.badge_marina) return 'Continue south to Stormport City.';
    if (!f.plant_done) return 'Something is wrong at the Emberfall Power Plant.';
    if (!f.badge_cinder) return 'Challenge Cinder at the Emberfall Gym.';
    if (!f.caldera_done) return 'Find the Syndicate lab in the Ashen Caldera.';
    if (!f.badge_selene) return 'Climb to Skyreach City and face Selene.';
    if (!f.obs_done) return 'The Syndicate is raiding Starfall Observatory!';
    if (!f.badge_frost) return 'Brave the cold and challenge Frost in Frostholm.';
    if (!f.capital_done) return 'The Syndicate has seized the Aether Tower in the Capital.';
    if (!f.badge_darius) return 'Challenge Darius at the Aether Capital Gym.';
    if (!f.summit_done) return 'Climb the Celestial Path to stop Valen at the Summit.';
    if (!f.champion) return 'Cross Champion\'s Path and conquer the Elite Championship.';
    if (!S.keyItems.veloria_pass) return 'Visit Professor Hazel in Willowbrook.';
    if (!f.first_veloria) return 'Take the ship from Stormport to Veloria.';
    if (S.vBadges.length < 6) return `Earn the Warden Seals of Veloria (${S.vBadges.length}/6).`;
    if (!f.neo_done) return 'Stop Neo Eclipse in Zenith City.';
    if (!f.v_champion) return 'Challenge the Veloria League in Zenith City.';
    if (!f.final_boss_done) return 'Something stirs in the Forgotten Expanse, beyond the Hollow Depths...';
    if ((S.starShards || []).length < 8) return 'Find all 8 Star Shards and bring them to the Rift Core.';
    return 'Complete your Aetherdex, master the Battle Frontier, and find every Aether Stone!';
  };

  // ===================== ACHIEVEMENTS =====================
  class AchScene {
    constructor() { this.idx = 0; this.scroll = 0; }
    update() { const I = MB.input, n = MB.ACHIEVEMENTS.length; if (I.repeat('down')) this.idx = (this.idx + 1) % n; if (I.repeat('up')) this.idx = (this.idx + n - 1) % n; if (this.idx < this.scroll) this.scroll = this.idx; if (this.idx >= this.scroll + 11) this.scroll = this.idx - 10; if (I.pressed('b')) this.close(); }
    draw(ctx) {
      const S = MB.state;
      bg(ctx, 'ACHIEVEMENTS', '#806020');
      UI.text(ctx, `${Object.keys(S.ach).length}/${MB.ACHIEVEMENTS.length}   Completion ${MB.Achievements.completion()}%`, MB.W - 6, 13, { size: 7, color: '#fff', align: 'right' });
      UI.box(ctx, 4, 22, MB.W - 8, 214);
      MB.ACHIEVEMENTS.slice(this.scroll, this.scroll + 11).forEach(([id, name, desc], i) => {
        const y = 38 + i * 18, got = S.ach[id];
        if (this.scroll + i === this.idx) { ctx.fillStyle = '#f8e0a0'; ctx.fillRect(8, y - 10, MB.W - 16, 17); }
        UI.text(ctx, got ? '★' : '☆', 14, y + 1, { size: 9, color: got ? '#e0a000' : '#a0a0a0' });
        UI.text(ctx, name, 28, y, { size: 7, bold: true, color: got ? '#303040' : '#909090' });
        UI.text(ctx, desc, 130, y, { size: 6, color: got ? '#404050' : '#a0a0a0' });
      });
    }
  }
  MB.AchScene = AchScene;

  // ===================== SETTINGS =====================
  class SettingsScene {
    constructor() { this.idx = 0; }
    rows() {
      const s = MB.state ? MB.state.settings : MB.settings;
      return [
        ['Music Volume', Math.round(s.music * 10) + '/10', (d) => { s.music = MB.clamp(Math.round((s.music + d * 0.1) * 10) / 10, 0, 1); MB.audio.setMusicVol(s.music); }],
        ['Sound Volume', Math.round(s.sfx * 10) + '/10', (d) => { s.sfx = MB.clamp(Math.round((s.sfx + d * 0.1) * 10) / 10, 0, 1); MB.audio.setSfxVol(s.sfx); MB.audio.sfx('select'); }],
        ['Text Speed', ['Slow', 'Normal', 'Fast', 'Instant'][s.textSpeedIdx || 1], (d) => { s.textSpeedIdx = MB.clamp((s.textSpeedIdx || 1) + d, 0, 3); s.textSpeed = [30, 60, 120, 9999][s.textSpeedIdx]; MB.settings.textSpeed = s.textSpeed; }],
        ['Battle Style', s.battleStyle === 'set' ? 'Set' : 'Switch', () => { s.battleStyle = s.battleStyle === 'set' ? 'switch' : 'set'; }],
        ['Time Flow', s.realTime ? 'Real clock' : 'Game clock', () => { s.realTime = !s.realTime; }],
        ['Day/Night Tint', s.tint === false ? 'Off' : 'On', () => { s.tint = s.tint === false; }],
        ['Weather Effects', s.weather === false ? 'Off' : 'On', () => { s.weather = s.weather === false; }],
        ['Screen Scale', s.pixelPerfect ? 'Pixel perfect' : 'Fit window', () => { s.pixelPerfect = !s.pixelPerfect; MB.resize(); }],
      ];
    }
    update() {
      const I = MB.input, R = this.rows();
      if (I.repeat('down')) this.idx = (this.idx + 1) % R.length; if (I.repeat('up')) this.idx = (this.idx + R.length - 1) % R.length;
      if (I.repeat('right') || I.pressed('a')) R[this.idx][2](1);
      if (I.repeat('left')) R[this.idx][2](-1);
      if (I.pressed('b')) { MB.Save.saveSettings(); this.close(); }
    }
    draw(ctx) {
      bg(ctx, 'SETTINGS', '#405060');
      UI.box(ctx, 20, 30, MB.W - 40, 180);
      this.rows().forEach(([k, v], i) => { const y = 52 + i * 19; if (i === this.idx) UI.cursor(ctx, 32, y - 3); UI.text(ctx, k, 42, y, { size: 8 }); UI.text(ctx, '◄ ' + v + ' ►', MB.W - 34, y, { size: 8, align: 'right', bold: true, color: '#2050a0' }); });
      UI.text(ctx, 'WASD/Arrows move · Z/Enter confirm · X/Esc back · Shift run · I bag · C party · M map · P dex · Q quests · R rift', MB.W / 2, 226, { size: 5.5, align: 'center', color: '#e0e8f0' });
    }
  }
  MB.SettingsScene = SettingsScene;

  // ===================== SAVE =====================
  class SaveScene {
    constructor(mode) { this.mode = mode; this.idx = MB.state && MB.state.slot !== undefined ? MB.state.slot : 0; }
    update() {
      const I = MB.input;
      if (I.repeat('down')) this.idx = (this.idx + 1) % 3; if (I.repeat('up')) this.idx = (this.idx + 2) % 3;
      if (I.pressed('b')) { this.close(null); return; }
      if (I.pressed('a')) this.act();
    }
    async act() {
      const info = MB.Save.info(this.idx);
      if (this.mode === 'save') {
        if (info && MB.state.slot !== this.idx && !(await MB.yesno(`Overwrite Slot ${this.idx + 1}?`))) return;
        MB.state.slot = this.idx; const ok = MB.Save.save(this.idx);
        MB.audio.sfx(ok ? 'save' : 'error');
        await MB.say(ok ? `${MB.state.name} saved the game in Slot ${this.idx + 1}.` : 'Save failed! Storage may be full or disabled.');
        this.close(ok);
      } else if (this.mode === 'load') {
        if (!info) { MB.audio.sfx('error'); return; }
        this.close(this.idx);
      } else if (this.mode === 'delete') {
        if (info && (await MB.yesno(`Delete Slot ${this.idx + 1}? This cannot be undone.`))) MB.Save.del(this.idx);
      }
    }
    draw(ctx) {
      bg(ctx, this.mode === 'save' ? 'SAVE GAME' : this.mode === 'load' ? 'CONTINUE' : 'DELETE SAVE', '#305070');
      for (let i = 0; i < 3; i++) {
        const y = 28 + i * 66, info = MB.Save.info(i);
        UI.box(ctx, 16, y, MB.W - 32, 60, i === this.idx ? 'gold' : undefined);
        UI.text(ctx, `SLOT ${i + 1}`, 26, y + 16, { size: 8, bold: true });
        if (!info) { UI.text(ctx, '— Empty —', 26, y + 36, { size: 8, color: '#808090' }); continue; }
        UI.text(ctx, `${info.name}   ${info.location}`, 90, y + 16, { size: 8 });
        UI.text(ctx, `Badges ${info.badges}  Dex ${info.dex}  Time ${info.time}  $${info.money}`, 26, y + 32, { size: 7 });
        (info.party || []).forEach((p, k) => { try { ctx.drawImage(MB.Sprites.get(p.sp, false, p.shiny), 26 + k * 26, y + 34, 24, 24); } catch (e) { void e; } });
        UI.text(ctx, info.saved, MB.W - 24, y + 52, { size: 6, align: 'right', color: '#808090' });
      }
    }
  }
  MB.SaveScene = SaveScene;

  // ===================== PAUSE MENU =====================
  class PauseScene {
    constructor() { this.transparent = true; this.idx = 0; }
    items() { const S = MB.state; return [['Party', 'party'], S.keyItems.aetherdex ? ['Aetherdex', 'dex'] : null, ['Bag', 'bag'], S.keyItems.town_map ? ['Map', 'map'] : null, ['Quests', 'quests'], ['Achievements', 'ach'], [S.name, 'card'], ['Save', 'save'], ['Settings', 'settings'], ['Close', 'close']].filter(Boolean); }
    update() {
      const I = MB.input, L = this.items();
      if (I.repeat('down')) { this.idx = (this.idx + 1) % L.length; MB.audio.sfx('move'); }
      if (I.repeat('up')) { this.idx = (this.idx + L.length - 1) % L.length; MB.audio.sfx('move'); }
      if (I.pressed('b')) { this.close(); return; }
      if (I.pressed('a')) { MB.audio.sfx('select'); this.open(L[this.idx][1]); }
    }
    async open(k) {
      if (k === 'close') return this.close();
      await MB.openMenu(k);
    }
    draw(ctx) {
      const L = this.items();
      const h = L.length * 16 + 10;
      UI.box(ctx, MB.W - 100, 4, 96, h);
      L.forEach(([n], i) => { UI.text(ctx, n, MB.W - 82, 18 + i * 16, { size: 8 }); if (i === this.idx) UI.cursor(ctx, MB.W - 92, 15 + i * 16); });
      // info panel
      const S = MB.state;
      UI.box(ctx, 4, 4, 150, 46);
      const h24 = Math.floor(S.clock / 60) % 24, mm = Math.floor(S.clock % 60);
      UI.text(ctx, `${MB.World.DAY_NAMES[MB.World.dayOfWeek()]} ${MB.pad(h24, 2)}:${MB.pad(mm, 2)}  ${MB.cap(MB.World.timeOfDay())}`, 12, 18, { size: 7 });
      UI.text(ctx, `${MB.cap(MB.World.season())}  ·  ${MB.World.mapName()}`, 12, 30, { size: 7 });
      const ev = MB.World.events();
      UI.text(ctx, ev.length ? '◆ ' + ev[0].text.slice(0, 34) : 'A quiet day in Aetheria.', 12, 43, { size: 6, color: '#806020' });
    }
  }
  MB.PauseScene = PauseScene;
  MB.openMenu = async function (k) {
    if (k === 'party') return MB.Game.push(new MB.PartyScene({}));
    if (k === 'dex') return MB.Game.push(new DexScene());
    if (k === 'bag') return MB.Game.push(new MB.BagScene({ field: true }));
    if (k === 'map') { const fly = await MB.Game.push(new MapScene({})); if (fly) { MB.Game.scenes.filter((s) => s instanceof PauseScene).forEach((s) => s.close()); await MB.Over.flyTo(fly); } return; }
    if (k === 'quests') return MB.Game.push(new QuestScene());
    if (k === 'ach') return MB.Game.push(new AchScene());
    if (k === 'card') return MB.Game.push(new TrainerCard());
    if (k === 'save') return MB.Game.push(new SaveScene('save'));
    if (k === 'settings') return MB.Game.push(new SettingsScene());
  };

  class TrainerCard {
    update() { if (MB.input.pressed('b') || MB.input.pressed('a')) this.close(); }
    draw(ctx) {
      const S = MB.state;
      bg(ctx, 'TRAINER CARD', '#a05030');
      UI.box(ctx, 10, 26, MB.W - 20, 206, 'gold');
      const fr = MB.Chars.get(S.appearance).down[0];
      ctx.drawImage(fr, 230, 40, 64, 72);
      const L = [['Name', S.name], ['ID', S.trainerId], ['Money', '$' + S.money], ['Aetherdex', `${MB.Dex.countCaught()} caught / ${MB.Dex.countSeen()} seen`], ['Play time', MB.Save.fmtTime(S.playTime)], ['Battles', S.stats.battles || 0], ['Trainers beaten', S.stats.trainers || 0], ['Mega Evolutions', S.stats.megas || 0], ['Completion', MB.Achievements.completion() + '%'], ['Battle Points', (S.frontier && S.frontier.bp) || 0]];
      L.forEach(([k, v], i) => { UI.text(ctx, k, 22, 46 + i * 15, { size: 7, color: '#806020' }); UI.text(ctx, String(v), 110, 46 + i * 15, { size: 7, bold: true }); });
      UI.text(ctx, 'BADGES', 22, 206, { size: 7, bold: true });
      const types = ['Nature', 'Electric', 'Earth', 'Aqua', 'Flame', 'Psychic', 'Ice', 'Shadow'];
      const flags = ['badge_mira', 'badge_voltan', 'badge_brutus', 'badge_marina', 'badge_cinder', 'badge_selene', 'badge_frost', 'badge_darius'];
      types.forEach((t, i) => { ctx.fillStyle = S.flags[flags[i]] ? MB.TYPE_COLORS[t] : 'rgba(0,0,0,0.15)'; ctx.beginPath(); ctx.arc(80 + i * 18, 203, 6, 0, Math.PI * 2); ctx.fill(); if (S.flags[flags[i]]) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke(); } });
      if (S.vBadges.length) UI.text(ctx, `Veloria Seals: ${S.vBadges.length}/6`, 230, 206, { size: 6 });
    }
  }

  // ===================== TITLE =====================
  class TitleScene {
    constructor() { this.idx = 0; this.t = 0; this.mons = MB.SPECIES.filter((s) => s.mega).map((s) => s.key); }
    enter() { MB.audio.play('title'); }
    options() { return ['New Game', MB.Save.any() ? 'Continue' : null, 'Settings', 'Save Slots'].filter(Boolean); }
    update(dt) {
      this.t += dt;
      const I = MB.input, L = this.options();
      if (I.repeat('down')) { this.idx = (this.idx + 1) % L.length; MB.audio.sfx('move'); }
      if (I.repeat('up')) { this.idx = (this.idx + L.length - 1) % L.length; MB.audio.sfx('move'); }
      if (I.pressed('a')) { MB.audio.sfx('select'); this.choose(L[this.idx]); }
    }
    async choose(o) {
      if (o === 'New Game') { const slot = await MB.Game.push(new SlotPick()); if (slot === null || slot === undefined || slot < 0) return; if (MB.Save.info(slot) && !(await MB.yesno(`Slot ${slot + 1} has a save. Overwrite it when you first save?`))) return; this.close({ action: 'new', slot }); }
      else if (o === 'Continue') { const s = await MB.Game.push(new SaveScene('load')); if (s !== null && s !== undefined) this.close({ action: 'load', slot: s }); }
      else if (o === 'Settings') await MB.Game.push(new SettingsScene());
      else if (o === 'Save Slots') await MB.Game.push(new SaveScene('delete'));
    }
    draw(ctx) {
      const t = this.t;
      const g = ctx.createLinearGradient(0, 0, 0, MB.H); g.addColorStop(0, '#101038'); g.addColorStop(0.6, '#4a2a7a'); g.addColorStop(1, '#e07050');
      ctx.fillStyle = g; ctx.fillRect(0, 0, MB.W, MB.H);
      for (let i = 0; i < 60; i++) { ctx.fillStyle = `rgba(255,255,255,${0.4 + 0.4 * Math.sin(t * 2 + i)})`; ctx.fillRect((i * 53) % MB.W, (i * 29) % 120, 1, 1); }
      // silhouette mountains
      ctx.fillStyle = '#20143a'; ctx.beginPath(); ctx.moveTo(0, 200); for (let x = 0; x <= MB.W; x += 20) ctx.lineTo(x, 170 - Math.sin(x * 0.03) * 20 - Math.cos(x * 0.07) * 10); ctx.lineTo(MB.W, MB.H); ctx.lineTo(0, MB.H); ctx.fill();
      // parade of mega creatures
      const k = Math.floor(t / 3) % this.mons.length;
      const fade = Math.min(1, (t % 3) * 2, (3 - (t % 3)) * 2);
      ctx.globalAlpha = fade;
      const img = MB.Sprites.get(this.mons[k], true);
      const glow = ctx.createRadialGradient(240, 110, 5, 240, 110, 60); glow.addColorStop(0, 'rgba(255,128,240,0.5)'); glow.addColorStop(1, 'rgba(96,240,255,0)');
      ctx.fillStyle = glow; ctx.fillRect(170, 40, 140, 140);
      ctx.drawImage(img, 192, 62 + Math.sin(t * 2) * 3, 96, 96);
      UI.text(ctx, 'Mega ' + MB.SP[this.mons[k]].name, 240, 172, { size: 7, color: '#fff', align: 'center', bold: true });
      ctx.globalAlpha = 1;
      UI.text(ctx, 'MONSTERBOUND', 92, 56, { size: 22, bold: true, color: '#fff070', align: 'center', shadowColor: '#a02060' });
      UI.text(ctx, 'LEGENDS OF AETHER', 92, 74, { size: 9, bold: true, color: '#ffffff', align: 'center', shadowColor: '#402080' });
      const L = this.options();
      UI.box(ctx, 30, 96, 124, L.length * 18 + 10, 'dark');
      L.forEach((o, i) => { UI.text(ctx, o, 52, 112 + i * 18, { size: 9, color: '#fff', bold: i === this.idx }); if (i === this.idx) UI.cursor(ctx, 40, 109 + i * 18, '#fff070'); });
      UI.text(ctx, 'Z / Enter: select     Arrow keys / WASD: move', MB.W / 2, 232, { size: 6, align: 'center', color: '#ffe0d0' });
      UI.text(ctx, 'v1.0', MB.W - 6, 10, { size: 6, align: 'right', color: '#a0a0c0' });
    }
  }
  MB.TitleScene = TitleScene;
  class SlotPick {
    constructor() { this.idx = 0; this.transparent = false; }
    update() { const I = MB.input; if (I.repeat('down')) this.idx = (this.idx + 1) % 3; if (I.repeat('up')) this.idx = (this.idx + 2) % 3; if (I.pressed('a')) this.close(this.idx); if (I.pressed('b')) this.close(-1); }
    draw(ctx) { SaveScene.prototype.draw.call(Object.assign(Object.create(SaveScene.prototype), { mode: 'save', idx: this.idx }), ctx); UI.text(ctx, 'Choose a slot for your new adventure', MB.W / 2, 236, { size: 6, align: 'center', color: '#fff' }); }
  }

  // ===================== CHARACTER CREATION =====================
  class CreatorScene {
    constructor() {
      this.app = { skin: MB.Chars.SKINS[0], hair: MB.Chars.HAIRS[1], hairStyle: 'short', top: MB.Chars.OUTFITS[1], bottom: '#3a4a6a', shoes: '#40302a', hat: MB.Chars.OUTFITS[0] };
      this.idx = 0; this.dir = 0; this.t = 0; this.dress = false;
    }
    rows() {
      const A = this.app, C = MB.Chars;
      const cyc = (arr, k, d) => { const i = arr.indexOf(A[k]); A[k] = arr[(i + d + arr.length) % arr.length]; };
      return [
        ['Skin', () => A.skin, (d) => cyc(C.SKINS, 'skin', d)],
        ['Hair Style', () => A.hairStyle, (d) => cyc(['short', 'long', 'spiky', 'cap', 'bun', 'hat'], 'hairStyle', d)],
        ['Hair Color', () => A.hair, (d) => cyc(C.HAIRS, 'hair', d)],
        ['Outfit', () => A.top, (d) => cyc(C.OUTFITS, 'top', d)],
        ['Legs', () => A.bottom, (d) => cyc(['#3a4a6a', '#4a3a2a', '#2a2a30', '#6a6a70', '#304a30', '#a03030', '#e0d8c0'], 'bottom', d)],
        ['Hat Color', () => A.hat, (d) => cyc(C.OUTFITS, 'hat', d)],
        ['Style', () => (A.dress ? 'Skirt' : A.coat ? 'Coat' : 'Trousers'), () => { if (!A.dress && !A.coat) A.dress = true; else if (A.dress) { A.dress = false; A.coat = true; } else A.coat = false; }],
        ['Done', () => '', null],
      ];
    }
    update(dt) {
      this.t += dt;
      const I = MB.input, R = this.rows();
      if (I.repeat('down')) { this.idx = (this.idx + 1) % R.length; MB.audio.sfx('move'); }
      if (I.repeat('up')) { this.idx = (this.idx + R.length - 1) % R.length; MB.audio.sfx('move'); }
      if (R[this.idx][2]) { if (I.repeat('right') || I.pressed('a')) { R[this.idx][2](1); MB.audio.sfx('select'); } if (I.repeat('left')) { R[this.idx][2](-1); MB.audio.sfx('select'); } }
      else if (I.pressed('a')) this.close(Object.assign({}, this.app));
    }
    draw(ctx) {
      bg(ctx, 'CREATE YOUR TRAINER', '#3a5a9a');
      UI.box(ctx, 8, 26, 130, 200);
      const fr = MB.Chars.get(this.app);
      const dirs = ['down', 'left', 'up', 'right'];
      const d = dirs[Math.floor(this.t / 1.2) % 4];
      const f = [0, 1, 0, 2][Math.floor(this.t * 6) % 4];
      ctx.drawImage(fr[d][f], 25, 40, 96, 108);
      ['down', 'left', 'up', 'right'].forEach((dd, i) => ctx.drawImage(fr[dd][0], 18 + i * 28, 170, 24, 27));
      UI.box(ctx, 142, 26, 170, 200);
      this.rows().forEach(([k, v, fn], i) => {
        const y = 46 + i * 22;
        if (i === this.idx) UI.cursor(ctx, 152, y - 3);
        UI.text(ctx, k, 160, y, { size: 8, bold: !fn });
        const val = v();
        if (val && val.startsWith && val.startsWith('#')) { ctx.fillStyle = val; ctx.fillRect(260, y - 8, 30, 10); ctx.strokeStyle = '#303040'; ctx.strokeRect(260, y - 8, 30, 10); }
        else if (val) UI.text(ctx, '◄ ' + val + ' ►', 300, y, { size: 7, align: 'right', color: '#2050a0' });
      });
      UI.text(ctx, 'Left/Right to change · Z on Done to finish', MB.W / 2, 236, { size: 6, align: 'center', color: '#fff' });
    }
  }

  // ===================== STARTER SELECT =====================
  class StarterScene {
    constructor() { this.idx = 0; this.t = 0; this.list = ['emberfox', 'aquaphin', 'leafling']; }
    update(dt) { this.t += dt; const I = MB.input; if (I.pressed('right')) { this.idx = (this.idx + 1) % 3; MB.audio.cry(this.list[this.idx]); } if (I.pressed('left')) { this.idx = (this.idx + 2) % 3; MB.audio.cry(this.list[this.idx]); } if (I.pressed('a')) this.close(this.list[this.idx]); }
    draw(ctx) {
      bg(ctx, 'CHOOSE YOUR PARTNER', '#406040');
      this.list.forEach((k, i) => {
        const x = 14 + i * 102, sel = i === this.idx;
        UI.box(ctx, x, 28, 96, 134, sel ? 'gold' : undefined);
        const sp = MB.SP[k];
        ctx.globalAlpha = sel ? 1 : 0.55;
        ctx.drawImage(MB.Sprites.get(k), x, 32 + (sel ? Math.sin(this.t * 6) * 2 : 0), 96, 96);
        ctx.globalAlpha = 1;
        UI.text(ctx, sp.name, x + 48, 136, { size: 8, bold: true, align: 'center' });
        UI.typeBadge(ctx, sp.types[0], x + 28, 142, 40);
      });
      const sp = MB.SP[this.list[this.idx]];
      UI.box(ctx, 8, 166, MB.W - 16, 70);
      const fin = MB.SP[MB.evoChain(sp.key).slice(-1)[0].sp.key];
      MB.UI.wrapLines(ctx, sp.desc, MB.W - 40, 7).slice(0, 2).forEach((l, i) => UI.text(ctx, l, 18, 182 + i * 12, { size: 7 }));
      UI.text(ctx, `Evolves: ${MB.evoChain(sp.key).map((c) => c.sp.name).join(' → ')}   Mega: ◆ ${fin.mega ? fin.mega.types.join('/') : ''}`, 18, 210, { size: 6, color: '#604080' });
      UI.text(ctx, '◄ ► choose    Z select', MB.W / 2, 228, { size: 6, align: 'center', color: '#606070' });
    }
  }

  // ===================== EVOLUTION / HATCH =====================
  class EvolveScene {
    constructor(mon, to) { this.mon = mon; this.to = to; this.t = 0; this.phase = 'go'; this.canceled = false; this.msg = `What? ${mon.name} is evolving!`; }
    enter() { MB.audio.play('evolve'); MB.audio.cry(this.mon.sp); }
    update(dt) {
      this.t += dt;
      if (this.phase === 'go' && MB.input.pressed('b') && this.t > 0.5) { this.canceled = true; this.phase = 'cancel'; this.t = 0; this.msg = `Huh? ${this.mon.name} stopped evolving!`; }
      if (this.phase === 'go' && this.t > 5.2) { this.phase = 'done'; this.t = 0; MB.audio.sfx('evolve'); MB.audio.cry(this.to); this.msg = `Congratulations! ${this.mon.name} evolved into ${MB.SP[this.to].name}!`; }
      if ((this.phase === 'done' || this.phase === 'cancel') && this.t > 1.2 && (MB.input.pressed('a') || this.t > 4)) this.close(!this.canceled);
    }
    draw(ctx) {
      const g = ctx.createRadialGradient(160, 90, 10, 160, 90, 200); g.addColorStop(0, '#f0e0ff'); g.addColorStop(1, '#402070');
      ctx.fillStyle = g; ctx.fillRect(0, 0, MB.W, MB.H);
      const t = this.t;
      for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2 + t; const r = 70 + Math.sin(t * 3 + i) * 10; ctx.fillStyle = `rgba(255,255,255,${0.4 + 0.3 * Math.sin(t * 4 + i)})`; ctx.fillRect(160 + Math.cos(a) * r, 90 + Math.sin(a) * r * 0.7, 2, 2); }
      let showNew = false, white = 0;
      if (this.phase === 'go') { const freq = 0.6 + t * 1.4; showNew = Math.sin(t * freq * 3) > 0.3 && t > 1.5; white = Math.min(1, t / 1.5); }
      else if (this.phase === 'done') { showNew = true; white = Math.max(0, 1 - t * 1.5); }
      const key = showNew ? this.to : this.mon.sp;
      const img = MB.Sprites.get(key, false, this.mon.shiny);
      const sc = 112;
      ctx.drawImage(img, 160 - sc / 2, 40, sc, sc);
      if (white > 0) { ctx.globalAlpha = white; ctx.drawImage(MB.BattleScene.whiteOf(img), 160 - sc / 2, 40, sc, sc); ctx.globalAlpha = 1; }
      if (this.phase === 'done' && t < 0.4) { ctx.fillStyle = `rgba(255,255,255,${1 - t * 2.5})`; ctx.fillRect(0, 0, MB.W, MB.H); }
      UI.box(ctx, 6, MB.H - 52, MB.W - 12, 48);
      MB.UI.wrapLines(ctx, this.msg, MB.W - 40, 8).slice(0, 2).forEach((l, i) => UI.text(ctx, l, 18, MB.H - 32 + i * 14, { size: 8 }));
      if (this.phase === 'go') UI.text(ctx, 'X: stop', MB.W - 18, MB.H - 10, { size: 6, align: 'right', color: '#808090' });
    }
  }
  class HatchScene {
    constructor(mon) { this.mon = mon; this.t = 0; this.msg = 'Oh? The Egg is moving!'; }
    enter() { MB.audio.play('evolve'); }
    update(dt) { this.t += dt; if (this.t > 3.4 && !this.hatched) { this.hatched = true; MB.audio.sfx('hatch'); MB.audio.cry(this.mon.sp); this.msg = `${MB.SP[this.mon.sp].name} hatched from the Egg!`; } if (this.hatched && this.t > 4.4 && MB.input.pressed('a')) this.close(); }
    draw(ctx) {
      ctx.fillStyle = '#a8d8a0'; ctx.fillRect(0, 0, MB.W, MB.H);
      ctx.fillStyle = '#88c080'; for (let i = 0; i < MB.W; i += 16) ctx.fillRect(i, 140, 8, 100);
      const t = this.t;
      if (!this.hatched) { const sh = t > 1 ? Math.sin(t * (6 + t * 4)) * Math.min(1, (t - 1) / 2) * 0.3 : 0; ctx.save(); ctx.translate(160, 110); ctx.rotate(sh); ctx.drawImage(MB.Sprites.egg(), -48, -60, 96, 96); ctx.restore(); }
      else { if (t < 3.8) { ctx.fillStyle = `rgba(255,255,255,${1 - (t - 3.4) * 2.5})`; ctx.fillRect(0, 0, MB.W, MB.H); } ctx.drawImage(MB.Sprites.get(this.mon.sp, false, this.mon.shiny), 112, 46, 96, 96); }
      UI.box(ctx, 6, MB.H - 52, MB.W - 12, 48); UI.text(ctx, this.msg, 18, MB.H - 28, { size: 8 });
    }
  }
  class HallScene {
    constructor(region, first) { this.region = region; this.first = first; this.t = 0; this.team = MB.state.party.filter((m) => !m.egg); }
    enter() { MB.audio.play('victory'); }
    update(dt) { this.t += dt; if (this.t > 2 && MB.input.pressed('a')) this.close(); }
    draw(ctx) {
      const g = ctx.createLinearGradient(0, 0, 0, MB.H); g.addColorStop(0, '#302010'); g.addColorStop(1, '#a07020');
      ctx.fillStyle = g; ctx.fillRect(0, 0, MB.W, MB.H);
      for (let i = 0; i < 40; i++) { const y = (i * 37 + this.t * 40) % MB.H; ctx.fillStyle = '#fff070'; ctx.fillRect((i * 71) % MB.W, MB.H - y, 2, 2); }
      UI.text(ctx, 'HALL OF FAME', MB.W / 2, 28, { size: 16, bold: true, color: '#fff070', align: 'center', shadowColor: '#603000' });
      UI.text(ctx, `${MB.state.name} — Champion of ${this.region === 'A' ? 'Aetheria' : 'Veloria'}`, MB.W / 2, 44, { size: 8, color: '#fff', align: 'center' });
      this.team.forEach((m, i) => {
        const appear = MB.clamp((this.t - i * 0.4) * 2, 0, 1);
        ctx.globalAlpha = appear;
        const x = 14 + (i % 3) * 100, y = 54 + Math.floor(i / 3) * 86;
        ctx.drawImage(MB.Sprites.get(m.sp, false, m.shiny), x + 16, y, 64, 64);
        UI.text(ctx, `${m.name} Lv${m.lvl}`, x + 48, y + 74, { size: 7, color: '#fff', align: 'center', bold: true });
        ctx.globalAlpha = 1;
      });
      if (this.t > 2) UI.text(ctx, 'Z: continue', MB.W / 2, 234, { size: 6, color: '#fff', align: 'center' });
    }
  }
  class DexEntryPopup {
    constructor(sp, registered) { this.sp = MB.SP[sp]; this.t = 0; this.reg = registered; }
    enter() { MB.audio.cry(this.sp.key); }
    update(dt) { this.t += dt; if (this.t > 0.5 && (MB.input.pressed('a') || MB.input.pressed('b'))) this.close(); }
    draw(ctx) {
      const s = this.sp;
      bg(ctx, this.reg ? `New Aetherdex data: ${s.name}` : s.name, '#a03838');
      UI.box(ctx, 10, 26, 120, 120); ctx.drawImage(MB.Sprites.get(s.key), 22, 34, 96, 96);
      UI.box(ctx, 136, 26, 174, 120);
      UI.text(ctx, `No.${MB.pad(s.id, 3)} ${s.name}`, 146, 44, { size: 9, bold: true });
      s.types.forEach((t, i) => UI.typeBadge(ctx, t, 146 + i * 44, 52, 42));
      UI.text(ctx, `Habitat: ${s.habitats[0]}`, 146, 80, { size: 7 });
      UI.text(ctx, `Rarity: ${s.rarity.toUpperCase()}`, 146, 94, { size: 7 });
      if (s.mega) UI.text(ctx, '◆ Can Mega Evolve!', 146, 110, { size: 7, color: '#c03090', bold: true });
      UI.box(ctx, 10, 150, MB.W - 20, 80);
      MB.UI.wrapLines(ctx, s.desc, MB.W - 44, 7).slice(0, 4).forEach((l, i) => UI.text(ctx, l, 20, 168 + i * 13, { size: 7 }));
    }
  }

  MB.Screens = {
    async starterSelect() { return MB.Game.push(new StarterScene()); },
    async creator() { return MB.Game.push(new CreatorScene()); },
    async dexEntry(sp, reg) { return MB.Game.push(new DexEntryPopup(sp, reg)); },
    async evolve(m, to) {
      const ok = await MB.Game.push(new EvolveScene(m, to));
      if (ok) {
        const news = MB.Mon.evolve(m, to);
        MB.Dex.caught(to);
        MB.state.stats.evolutions = (MB.state.stats.evolutions || 0) + 1;
        MB.Achievements.unlock('first_evolution');
        for (const id of news) await MB.Screens.teachMove(m, id);
        MB.Achievements.check();
      }
      MB.audio.play(MB.Over ? MB.Over.musicFor() : 'route');
      return ok;
    },
    async hatch(m) {
      await MB.Game.push(new HatchScene(m));
      delete m.egg;
      m.name = MB.SP[m.sp].name; m.friend = 120; m.met = MB.World.mapName(); m.metLvl = 1;
      MB.Mon.heal(m);
      MB.Dex.caught(m.sp);
      MB.Achievements.unlock('first_hatch');
      if (await MB.yesno(`Give a nickname to the hatched ${m.name}?`)) m.name = await MB.inputText(`Nickname?`, m.name, 12);
      MB.audio.play(MB.Over.musicFor());
    },
    async hallOfFame(region, first) { return MB.Game.push(new HallScene(region, first)); },
    async pickPartyMon(prompt) { const r = await MB.Game.push(new MB.PartyScene({ pickOnly: true, prompt })); return r === undefined ? -1 : r; },
    async teachMove(m, id) {
      const mv = MB.MOVES[id];
      if (m.moves.some((x) => x.id === id)) return;
      if (m.moves.length < 4) { MB.Mon.learnMove(m, id); MB.audio.sfx('levelup'); await MB.say(`${m.name} learned ${mv.name}!`); return; }
      const c = await MB.ask(`${m.name} wants to learn ${mv.name}. Forget which move?`, [...m.moves.map((x) => MB.MOVES[x.id].name), `Don't learn`], { cancelValue: 4 });
      if (c >= 0 && c < 4) { const old = MB.MOVES[m.moves[c].id].name; MB.Mon.learnMove(m, id, c); await MB.say(`${m.name} forgot ${old} and learned ${mv.name}!`); }
    },
  };
})();
