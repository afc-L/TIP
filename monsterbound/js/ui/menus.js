'use strict';
// Party, Summary, Bag, Storage (PC) and Shop scenes.
const UI = MB.UI;
function bgPanel(ctx, title, color) {
  const g = ctx.createLinearGradient(0, 0, 0, MB.H);
  g.addColorStop(0, color || '#3a5a9a'); g.addColorStop(1, '#1c2848');
  ctx.fillStyle = g; ctx.fillRect(0, 0, MB.W, MB.H);
  ctx.fillStyle = 'rgba(255,255,255,0.05)'; for (let i = 0; i < MB.W; i += 12) ctx.fillRect(i, 0, 6, MB.H);
  if (title) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, MB.W, 18); UI.text(ctx, title, 8, 13, { color: '#fff', size: 9, bold: true }); }
}
MB.bgPanel = bgPanel;

// ===================== PARTY =====================
class PartyScene {
  constructor(opts = {}) { this.opts = opts; this.idx = opts.current !== undefined && !opts.battle ? 0 : 0; this.swap = -1; this.msg = opts.prompt || (opts.forced ? 'Choose a creature to send out.' : opts.battle ? 'Choose a creature.' : 'Choose a creature.'); if (opts.battle) this.idx = opts.battle.p.idx; }
  get party() { return MB.state.party; }
  update() {
    const I = MB.input, n = this.party.length;
    if (I.repeat('down')) { this.idx = (this.idx + 1) % n; MB.audio.sfx('move'); }
    if (I.repeat('up')) { this.idx = (this.idx + n - 1) % n; MB.audio.sfx('move'); }
    if (I.repeat('right') && this.idx % 2 === 0 && this.idx + 1 < n) this.idx++;
    if (I.repeat('left') && this.idx % 2 === 1) this.idx--;
    if (I.pressed('b')) { if (this.swap >= 0) { this.swap = -1; return; } if (!this.opts.forced) { MB.audio.sfx('back'); this.close(-1); } return; }
    if (I.pressed('a')) { MB.audio.sfx('select'); this.choose(); }
  }
  async choose() {
    const m = this.party[this.idx];
    const S = MB.state;
    if (this.swap >= 0) { const a = this.swap, b = this.idx; [S.party[a], S.party[b]] = [S.party[b], S.party[a]]; this.swap = -1; return; }
    if (this.opts.pickOnly) { this.close(this.idx); return; }
    if (this.opts.useItem) {
      const ok = await MB.ItemUse.onMon(this.opts.useItem, m, this.opts.battle);
      if (ok !== false) this.close(ok === 'battle' ? this.idx : this.idx); return;
    }
    if (this.opts.battle) {
      const B = this.opts.battle;
      const c = await MB.ask(`What to do with ${m.name}?`, ['Send Out', 'Summary', 'Cancel']);
      if (c === 0) {
        if (m.egg) return MB.say('An Egg can\'t battle!');
        if (m.hp <= 0) return MB.say(`${m.name} has no energy left to battle!`);
        if (this.idx === B.p.idx && B.mon(B.p).hp > 0) return MB.say(`${m.name} is already in battle!`);
        this.close(this.idx);
      } else if (c === 1) await MB.Game.push(new SummaryScene(this.idx));
      return;
    }
    const opts = ['Summary', 'Move', 'Item', m.egg ? null : 'Nickname', 'Cancel'].filter(Boolean);
    const c = await MB.ask(`What to do with ${m.name}?`, opts);
    const ch = opts[c];
    if (ch === 'Summary') await MB.Game.push(new SummaryScene(this.idx));
    else if (ch === 'Move') this.swap = this.idx;
    else if (ch === 'Item') {
      const c2 = await MB.ask(m.item ? `${m.name} holds ${MB.ITEMS[m.item].name}.` : `${m.name} holds nothing.`, ['Give', 'Take', 'Cancel']);
      if (c2 === 0) { const it = await MB.Game.push(new BagScene({ pickHeld: true })); if (it) { if (m.item) MB.Bag.add(m.item, 1); MB.Bag.remove(it, 1); m.item = it; await MB.say(`${m.name} is now holding ${MB.ITEMS[it].name}.`); if (MB.ITEMS[it].cat === 'mega' && MB.ITEMS[it].megaFor !== m.sp) await MB.say('(This Aether Stone doesn\'t match this creature, so it won\'t Mega Evolve.)'); } }
      else if (c2 === 1 && m.item) { MB.Bag.add(m.item, 1); await MB.say(`Took ${MB.ITEMS[m.item].name} from ${m.name}.`); m.item = null; }
    } else if (ch === 'Nickname') { if (m.ot && m.ot !== S.trainerId) return MB.say('This creature\'s name can\'t be changed.'); m.name = await MB.inputText(`Nickname for ${m.name}?`, m.name, 12); }
  }
  draw(ctx) {
    bgPanel(ctx, this.opts.battle ? 'PARTY' : 'PARTY', '#3a7a6a');
    this.party.forEach((m, i) => {
      const x = 6 + (i % 2) * 156, y = 24 + Math.floor(i / 2) * 58;
      const sel = i === this.idx, sw = i === this.swap;
      const style = sel ? { fill: '#fff8d0', border: '#c08020', inner: '#f0d070' } : m.hp <= 0 && !m.egg ? { fill: '#f0d0d0', border: '#803030', inner: '#d09090' } : undefined;
      UI.box(ctx, x, y, 152, 54, sw ? 'red' : style);
      UI.monIcon(ctx, m, x + 4, y + 4, 40, sel);
      UI.text(ctx, m.name, x + 48, y + 16, { size: 8, bold: true });
      if (m.egg) { UI.text(ctx, 'Egg', x + 48, y + 30, { size: 7 }); UI.text(ctx, m.egg.steps > 2000 ? 'It will take a while.' : m.egg.steps > 500 ? 'It moves now and then.' : 'It\'s about to hatch!', x + 48, y + 42, { size: 6 }); return; }
      UI.text(ctx, 'Lv' + m.lvl, x + 146, y + 16, { size: 7, align: 'right' });
      const max = MB.Mon.maxHp(m), f = m.hp / max;
      UI.bar(ctx, x + 48, y + 22, 96, 5, f, UI.hpColor(f));
      UI.text(ctx, `${m.hp}/${max}`, x + 146, y + 36, { size: 7, align: 'right' });
      UI.statusBadge(ctx, m.hp <= 0 ? 'fnt' : m.status, x + 48, y + 30);
      MB.SP[m.sp].types.forEach((t, k) => UI.typeBadge(ctx, t, x + 48 + k * 40, y + 41, 38));
      if (m.item) { ctx.fillStyle = MB.ITEMS[m.item] && MB.ITEMS[m.item].cat === 'mega' ? '#ff60d0' : '#e0b040'; ctx.beginPath(); ctx.arc(x + 40, y + 42, 3, 0, Math.PI * 2); ctx.fill(); }
    });
    UI.box(ctx, 4, MB.H - 34, MB.W - 8, 30);
    UI.text(ctx, this.swap >= 0 ? 'Move to where?' : this.msg, 14, MB.H - 15, { size: 8 });
  }
}
MB.PartyScene = PartyScene;

// ===================== SUMMARY =====================
class SummaryScene {
  constructor(idx, list) { this.list = list || MB.state.party; this.idx = idx; this.tab = 0; this.megaView = false; this.mv = 0; }
  update() {
    const I = MB.input;
    if (I.pressed('b')) { MB.audio.sfx('back'); this.close(); return; }
    if (I.pressed('right')) { this.tab = (this.tab + 1) % 4; MB.audio.sfx('move'); }
    if (I.pressed('left')) { this.tab = (this.tab + 3) % 4; MB.audio.sfx('move'); }
    if (this.tab === 2) { const n = this.mon.moves.length; if (I.pressed('down')) this.mv = (this.mv + 1) % n; if (I.pressed('up')) this.mv = (this.mv + n - 1) % n; }
    else { if (I.pressed('down')) { this.idx = (this.idx + 1) % this.list.length; this.mv = 0; } if (I.pressed('up')) { this.idx = (this.idx + this.list.length - 1) % this.list.length; this.mv = 0; } }
    if (I.pressed('a') && this.tab === 3 && MB.SP[this.mon.sp].mega) { this.megaView = !this.megaView; MB.audio.sfx(this.megaView ? 'statup' : 'back'); }
  }
  get mon() { return this.list[this.idx]; }
  draw(ctx) {
    const m = this.mon, sp = MB.SP[m.sp];
    bgPanel(ctx, '', '#5a3a8a');
    const tabs = ['INFO', 'STATS', 'MOVES', 'EVOLUTION'];
    tabs.forEach((t, i) => { ctx.fillStyle = i === this.tab ? '#fff070' : 'rgba(255,255,255,0.25)'; UI.rr(ctx, 4 + i * 78, 3, 74, 14, 3); ctx.fill(); UI.text(ctx, t, 41 + i * 78, 13, { size: 7, bold: true, align: 'center', color: i === this.tab ? '#303040' : '#fff' }); });
    // left: sprite card
    UI.box(ctx, 4, 22, 112, 120);
    if (m.egg) { ctx.drawImage(MB.Sprites.egg(), 12, 30, 96, 96); UI.text(ctx, 'EGG', 60, 136, { align: 'center', bold: true }); UI.box(ctx, 120, 22, 196, 120); UI.text(ctx, 'What will hatch from this Egg?', 130, 44, { size: 7 }); UI.text(ctx, `Steps left: ~${Math.max(0, m.egg.steps)}`, 130, 60, { size: 7 }); return; }
    const mega = this.megaView && sp.mega;
    ctx.drawImage(MB.Sprites.get(m.sp, mega, m.shiny), 12, 26 + Math.sin(performance.now() / 300) * 1.5, 96, 96);
    UI.text(ctx, m.name, 10, 132, { size: 8, bold: true });
    UI.text(ctx, 'Lv' + m.lvl, 110, 132, { size: 7, align: 'right' });
    if (m.shiny) UI.text(ctx, '★', 104, 34, { color: '#e0a000', size: 9 });
    if (m.gender) UI.text(ctx, m.gender === 'M' ? '♂' : '♀', 12, 36, { color: m.gender === 'M' ? '#4070e0' : '#e04080', size: 9 });
    UI.box(ctx, 120, 22, 196, 214);
    const L = (k, v, y, col) => { UI.text(ctx, k, 128, y, { size: 7, color: '#606070' }); UI.text(ctx, String(v), 200, y, { size: 7, bold: true, color: col }); };
    if (this.tab === 0) {
      L('Dex No.', MB.pad(sp.id, 3), 38); L('Species', sp.name, 52);
      UI.text(ctx, 'Type', 128, 66, { size: 7, color: '#606070' }); sp.types.forEach((t, i) => UI.typeBadge(ctx, t, 200 + i * 42, 59, 40));
      L('Trainer', m.ot === MB.state.trainerId ? MB.state.name : m.ot || '-', 80);
      L('Nature', MB.NATURES[m.nature][0], 94);
      const ab = MB.Mon.abilityId(m);
      L('Ability', MB.ABILITIES[ab].name + (m.ability === 2 ? ' (H)' : ''), 108);
      const ad = MB.UI.wrapLines(ctx, MB.ABILITIES[ab].desc, 176, 6); ad.slice(0, 2).forEach((l, i) => UI.text(ctx, l, 128, 120 + i * 10, { size: 6 }));
      L('Held', m.item ? MB.ITEMS[m.item].name : 'None', 148);
      L('Met', `${m.met || '?'} (Lv${m.metLvl || '?'})`, 162);
      const g = sp.growth; const lo = MB.Mon.expFor(g, m.lvl), hi = MB.Mon.expFor(g, m.lvl + 1);
      L('Exp.', m.exp, 176); L('To next', m.lvl >= 100 ? '-' : hi - m.exp, 190);
      UI.bar(ctx, 128, 196, 180, 4, m.lvl >= 100 ? 1 : (m.exp - lo) / Math.max(1, hi - lo), '#40a0f0');
      L('Friendship', m.friend >= 220 ? '♥♥♥♥♥' : m.friend >= 160 ? '♥♥♥♥' : m.friend >= 100 ? '♥♥♥' : m.friend >= 50 ? '♥♥' : '♥', 214, '#e04070');
      L('Capsule', MB.ITEMS[m.ball] ? MB.ITEMS[m.ball].name : 'Basic Capsule', 228);
      UI.box(ctx, 4, 146, 112, 90); const dl = MB.UI.wrapLines(ctx, sp.desc, 100, 6); MB.UI.font(ctx, 6); dl.slice(0, 8).forEach((l, i) => UI.text(ctx, l, 10, 158 + i * 10, { size: 6 }));
    } else if (this.tab === 1) {
      const st = MB.Mon.stats(m);
      const nat = MB.NATURES[m.nature];
      MB.STAT_KEYS.forEach((k, i) => {
        const y = 40 + i * 22;
        const col = nat[1] === k ? '#d03030' : nat[2] === k ? '#3050d0' : '#303040';
        UI.text(ctx, MB.STAT_NAMES[k], 128, y, { size: 7, color: col, bold: true });
        UI.text(ctx, k === 'hp' ? `${m.hp}/${st.hp}` : String(st[k]), 238, y, { size: 7, align: 'right', bold: true });
        UI.bar(ctx, 128, y + 4, 110, 3, sp.base[k] / 180, '#60c060');
        const iv = m.ivs[k] + ((m.bonus && m.bonus[k]) || 0);
        const grade = iv >= 31 ? 'S' : iv >= 26 ? 'A' : iv >= 20 ? 'B' : iv >= 13 ? 'C' : iv >= 6 ? 'D' : 'E';
        UI.text(ctx, 'Pot ' + grade, 248, y, { size: 6, color: '#806020' });
        UI.text(ctx, 'Eff ' + ((m.bonus && m.bonus['e' + k]) || 0), 284, y, { size: 6, color: '#406080' });
      });
      UI.text(ctx, `Base total: ${sp.bst}`, 128, 176, { size: 7 });
      UI.text(ctx, 'Pot = potential (IV), Eff = training effort', 128, 190, { size: 6, color: '#606070' });
      UI.text(ctx, 'Red: boosted by nature, Blue: lowered', 128, 202, { size: 6, color: '#606070' });
      UI.box(ctx, 4, 146, 112, 90); UI.text(ctx, 'Abilities', 10, 160, { size: 7, bold: true }); sp.abilities.forEach((a, i) => UI.text(ctx, (i === 2 ? 'H: ' : '') + MB.ABILITIES[a].name, 10, 174 + i * 12, { size: 6, color: i === m.ability ? '#d03030' : '#303040' }));
    } else if (this.tab === 2) {
      m.moves.forEach((mv, i) => {
        const M = MB.MOVES[mv.id], y = 30 + i * 26;
        if (i === this.mv) { ctx.fillStyle = '#f8e8a0'; ctx.fillRect(124, y - 2, 188, 24); }
        UI.typeBadge(ctx, M.type, 128, y, 38);
        UI.text(ctx, M.name, 170, y + 8, { size: 7, bold: true });
        UI.text(ctx, `PP ${mv.pp}/${M.pp}`, 306, y + 18, { size: 6, align: 'right' });
      });
      const M = MB.MOVES[m.moves[this.mv] ? m.moves[this.mv].id : 'tackle'];
      UI.text(ctx, `${M.cat === 'phys' ? 'Physical' : M.cat === 'spec' ? 'Special' : 'Status'}   Power ${M.power || '-'}   Acc ${M.acc || '-'}`, 128, 146, { size: 7 });
      UI.text(ctx, MB.describeMove(M), 128, 160, { size: 6 });
      UI.box(ctx, 4, 146, 112, 90); UI.text(ctx, 'Next moves', 10, 160, { size: 7, bold: true });
      sp.learn.filter(([l]) => l > m.lvl).slice(0, 6).forEach(([l, id], i) => UI.text(ctx, `Lv${l} ${MB.MOVES[id].name}`, 10, 174 + i * 10, { size: 6 }));
    } else {
      const chain = MB.evoChain(m.sp);
      UI.text(ctx, 'Evolution line', 128, 36, { size: 7, bold: true });
      chain.slice(0, 5).forEach((c, i) => {
        const y = 42 + i * 26;
        const seen = MB.state.dex[c.sp.key] && MB.state.dex[c.sp.key].seen;
        ctx.globalAlpha = seen ? 1 : 0.3;
        ctx.drawImage(MB.Sprites.get(c.sp.key), 128 + c.depth * 10, y, 24, 24);
        ctx.globalAlpha = 1;
        UI.text(ctx, seen ? c.sp.name : '???', 156 + c.depth * 10, y + 12, { size: 7, bold: c.sp.key === m.sp });
        if (c.sp.prev) { const e = MB.SP[c.sp.prev].evo.find((x) => x.to === c.sp.key); UI.text(ctx, MB.evoText(e), 156 + c.depth * 10, y + 21, { size: 6, color: '#606070' }); }
      });
      if (sp.mega) {
        const owns = MB.Bag.count(sp.mega.stone) > 0 || m.item === sp.mega.stone;
        UI.box(ctx, 4, 146, 112, 90, 'mega');
        UI.text(ctx, '◆ MEGA FORM', 10, 160, { size: 7, bold: true, color: '#ff80e0' });
        UI.text(ctx, 'Types: ' + sp.mega.types.join('/'), 10, 172, { size: 6, color: '#fff' });
        UI.text(ctx, 'Ability: ' + MB.ABILITIES[sp.mega.ability].name, 10, 182, { size: 6, color: '#fff' });
        UI.text(ctx, 'Stone: ' + (owns ? 'OWNED' : 'Not found'), 10, 192, { size: 6, color: owns ? '#80ff80' : '#ff9090' });
        UI.text(ctx, `BST ${sp.bst} → ${Object.values(sp.mega.base).reduce((a, b) => a + b, 0)}`, 10, 202, { size: 6, color: '#fff' });
        UI.text(ctx, 'Z: preview Mega', 10, 226, { size: 6, color: '#60f0ff' });
      } else { UI.box(ctx, 4, 146, 112, 90); UI.text(ctx, 'No known Mega', 10, 160, { size: 7 }); UI.text(ctx, 'Evolution.', 10, 172, { size: 7 }); }
    }
    UI.text(ctx, '◄ ► tabs   ▲ ▼ creature   X back', MB.W - 6, MB.H - 4, { size: 6, align: 'right', color: '#c0c0d0' });
  }
}
MB.SummaryScene = SummaryScene;
MB.describeMove = function (M) {
  const parts = [];
  if (M.priority) parts.push('Strikes first.');
  if (M.hits) parts.push(`Hits ${M.hits[0]}-${M.hits[1]} times.`);
  if (M.highCrit) parts.push('High crit ratio.');
  if (M.protect) parts.push('Protects from attacks this turn.');
  if (M.pivot) parts.push('User switches out after.');
  if (M.fixed) parts.push('Deals damage equal to user level.');
  const SN = { brn: 'burn', psn: 'poison', tox: 'badly poison', par: 'paralyze', slp: 'sleep', frz: 'freeze', cnf: 'confuse', stn: 'flinch' };
  for (const f of M.fx) {
    if (f.t === 'status') parts.push(`${f.ch < 100 ? f.ch + '% ' : ''}${f.self ? 'confuses user' : SN[f.s]}.`);
    if (f.t === 'stage') parts.push(`${f.ch < 100 ? f.ch + '%: ' : ''}${f.self ? 'User' : 'Foe'} ${MB.STAT_NAMES[f.stat]} ${f.n > 0 ? '+' : ''}${f.n}.`);
    if (f.t === 'heal') parts.push(`Heals ${f.v}%.`);
    if (f.t === 'drain') parts.push(`Drains ${f.v}% of damage.`);
    if (f.t === 'recoil') parts.push(`${f.v}% recoil.`);
    if (f.t === 'weather') parts.push(`Sets ${f.w}.`);
    if (f.t === 'leech') parts.push('Seeds the foe.');
    if (f.t === 'rest') parts.push('Sleeps to heal fully.');
    if (f.t === 'cure') parts.push('Cures status.');
    if (f.t === 'clear') parts.push('Resets all stat changes.');
  }
  return parts.join(' ').slice(0, 64) || 'A standard attack.';
};

// ===================== BAG =====================
class BagScene {
  constructor(opts = {}) { this.opts = opts; this.cat = opts.pickHeld ? 3 : 0; this.idx = 0; this.scroll = 0; if (opts.battle) this.cats = [0, 1, 2]; else this.cats = [0, 1, 2, 3, 4, 5, 6, 7]; if (opts.pickHeld) this.cats = [3, 5, 6, 4, 0]; this.ci = 0; this.cat = this.cats[0]; }
  items() { return MB.Bag.list(MB.Bag.CATS[this.cat][0]); }
  update() {
    const I = MB.input;
    const list = this.items();
    if (I.pressed('left')) { this.ci = (this.ci + this.cats.length - 1) % this.cats.length; this.cat = this.cats[this.ci]; this.idx = 0; this.scroll = 0; MB.audio.sfx('move'); }
    if (I.pressed('right')) { this.ci = (this.ci + 1) % this.cats.length; this.cat = this.cats[this.ci]; this.idx = 0; this.scroll = 0; MB.audio.sfx('move'); }
    if (list.length) {
      if (I.repeat('down')) { this.idx = (this.idx + 1) % list.length; MB.audio.sfx('move'); }
      if (I.repeat('up')) { this.idx = (this.idx + list.length - 1) % list.length; MB.audio.sfx('move'); }
    }
    if (this.idx < this.scroll) this.scroll = this.idx; if (this.idx >= this.scroll + 9) this.scroll = this.idx - 8;
    if (I.pressed('b')) { MB.audio.sfx('back'); this.close(null); return; }
    if (I.pressed('a') && list.length) { MB.audio.sfx('select'); this.choose(list[this.idx].id); }
  }
  async choose(id) {
    const it = MB.ITEMS[id];
    const S = MB.state;
    if (this.opts.pickHeld) { if (it.cat === 'key') return; this.close(id); return; }
    if (this.opts.battle) {
      const B = this.opts.battle;
      if (it.cat === 'capsule') { if (B.kind === 'trainer') { await MB.say('You can\'t catch another trainer\'s creature!'); return; } this.close({ type: 'ball', id }); return; }
      if (it.cat === 'battle') { this.close({ type: 'item', id, target: B.p.idx }); return; }
      if (it.cat === 'heal' && !it.field && !it.levelUp && !it.vitamin) {
        const t = await MB.Game.push(new PartyScene({ pickOnly: true, prompt: `Use ${it.name} on which creature?` }));
        if (t < 0) return;
        const m = S.party[t];
        if (m.egg) return MB.say('It won\'t have any effect.');
        if (it.revive ? m.hp > 0 : (m.hp <= 0 || ((!it.heal || m.hp >= MB.Mon.maxHp(m)) && (!it.cure || !m.status) && !it.pp))) return MB.say('It won\'t have any effect.');
        this.close({ type: 'item', id, target: t }); return;
      }
      return MB.say('That can\'t be used now.');
    }
    const acts = [];
    if (MB.ItemUse.canUseField(it)) acts.push('Use');
    if (['held', 'mega', 'heal', 'evo', 'battle', 'treasure'].includes(it.cat) && !it.field) acts.push('Give');
    if (it.cat !== 'key' && it.cat !== 'quest' && it.cat !== 'mega') acts.push('Toss');
    acts.push('Cancel');
    const c = await MB.ask(it.desc, acts);
    const a = acts[c];
    if (a === 'Use') { const r = await MB.ItemUse.field(id); if (r === 'close') this.close(null); }
    else if (a === 'Give') {
      const t = await MB.Game.push(new PartyScene({ pickOnly: true, prompt: `Give ${it.name} to which creature?` }));
      if (t < 0) return; const m = S.party[t];
      if (m.egg) return MB.say('An Egg can\'t hold items.');
      if (m.item) MB.Bag.add(m.item, 1);
      MB.Bag.remove(id, 1); m.item = id;
      await MB.say(`${m.name} is now holding ${it.name}.`);
    } else if (a === 'Toss') {
      if (await MB.yesno(`Throw away one ${it.name}?`)) MB.Bag.remove(id, 1);
    }
  }
  draw(ctx) {
    bgPanel(ctx, '', '#8a5a2a');
    const [, label] = MB.Bag.CATS[this.cat];
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(0, 0, MB.W, 20);
    UI.text(ctx, '◄ ' + label + ' ►', 80, 14, { size: 9, bold: true, color: '#fff', align: 'center' });
    this.cats.forEach((c, i) => { ctx.fillStyle = i === this.ci ? '#fff070' : 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.arc(170 + i * 12, 10, 3, 0, Math.PI * 2); ctx.fill(); });
    UI.text(ctx, `$${MB.state.money}`, MB.W - 8, 14, { size: 8, bold: true, color: '#fff070', align: 'right' });
    UI.box(ctx, 4, 24, 200, 150);
    const list = this.items();
    if (!list.length) UI.text(ctx, '(empty)', 20, 44, { size: 8, color: '#808080' });
    list.slice(this.scroll, this.scroll + 9).forEach((e, i) => {
      const it = MB.ITEMS[e.id], y = 40 + i * 15;
      if (this.scroll + i === this.idx) UI.cursor(ctx, 12, y - 3);
      if (it.cat === 'capsule') MB.drawCapsuleIcon(ctx, e.id, 26, y - 3, 1, 0, 0);
      else { ctx.fillStyle = it.cat === 'mega' ? '#ff60d0' : it.cat === 'evo' ? '#60c0f0' : it.cat === 'key' ? '#e0c040' : it.cat === 'held' ? '#a0e080' : '#f0f0f0'; ctx.beginPath(); ctx.arc(26, y - 3, 3.5, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#404040'; ctx.lineWidth = 0.6; ctx.stroke(); }
      UI.text(ctx, it.name, 36, y, { size: 7 });
      if (it.cat !== 'key') UI.text(ctx, '×' + e.n, 196, y, { size: 7, align: 'right' });
    });
    UI.box(ctx, 208, 24, 108, 150);
    const sel = list[this.idx];
    if (sel) {
      const it = MB.ITEMS[sel.id];
      if (it.cat === 'mega') { const s = MB.SP[it.megaFor]; ctx.drawImage(MB.Sprites.get(s.key, true), 230, 28, 64, 64); }
      else if (it.cat === 'capsule') MB.drawCapsuleIcon(ctx, sel.id, 262, 56, 3, 0, 0);
      const dl = MB.UI.wrapLines(ctx, it.desc, 96, 6); MB.UI.font(ctx, 6); dl.slice(0, 7).forEach((l, i) => UI.text(ctx, l, 214, 104 + i * 10, { size: 6 }));
    }
    UI.box(ctx, 4, 178, MB.W - 8, 58);
    UI.text(ctx, this.opts.battle ? 'Choose an item to use in battle.' : this.opts.pickHeld ? 'Choose an item to hold.' : 'Z: select   X: close   ◄ ►: pocket', 14, 196, { size: 7 });
    if (sel && MB.ITEMS[sel.id].cat === 'mega') UI.text(ctx, 'Give this stone to its creature and equip the Aether Gauntlet to Mega Evolve!', 14, 212, { size: 6, color: '#a03080' });
  }
}
MB.BagScene = BagScene;

// ---------------- item use ----------------
MB.ItemUse = {
  canUseField(it) { return it.cat === 'heal' || it.cat === 'evo' || it.field || it.bike || it.rod; },
  async field(id) {
    const S = MB.state, it = MB.ITEMS[id];
    if (it.repel) { S.repel = it.repel; MB.Bag.remove(id); await MB.say(`Weak wild creatures will stay away for ${it.repel} steps.`); return; }
    if (it.lure) { S.lure = it.lure; MB.Bag.remove(id); await MB.say('A sweet scent fills the air...'); return; }
    if (it.escape) { const m = MB.World.get(S.map); if (m.kind !== 'cave' && m.kind !== 'forest') return MB.say('You can only use that in caves and dungeons.'); MB.Bag.remove(id); await MB.Over.escapeRope(); return 'close'; }
    if (it.bike) { MB.Over.toggleBike(); return 'close'; }
    if (it.rod) { MB.Over.queue(() => MB.Over.fish()); return 'close'; }
    const t = await MB.Game.push(new PartyScene({ pickOnly: true, prompt: `Use ${it.name} on which creature?` }));
    if (t < 0) return;
    const m = S.party[t];
    await MB.ItemUse.onMon(id, m);
  },
  async onMon(id, m) {
    const S = MB.state, it = MB.ITEMS[id];
    if (m.egg) { await MB.say('It won\'t have any effect.'); return false; }
    const max = MB.Mon.maxHp(m);
    if (it.cat === 'evo') {
      const to = MB.Mon.itemEvolution(m, id, { time: MB.World.isNight() ? 'night' : 'day' });
      if (!to) { await MB.say('It won\'t have any effect.'); return false; }
      MB.Bag.remove(id); await MB.Screens.evolve(m, to); return true;
    }
    if (it.revive) { if (m.hp > 0) { await MB.say('It won\'t have any effect.'); return false; } m.hp = Math.floor(max * it.revive); MB.Bag.remove(id); MB.audio.sfx('heal'); await MB.say(`${m.name} was revived!`); return true; }
    if (it.levelUp) {
      if (m.lvl >= 100) { await MB.say('It won\'t have any effect.'); return false; }
      MB.Bag.remove(id);
      const ev = MB.Mon.gainExp(m, MB.Mon.expFor(MB.SP[m.sp].growth, m.lvl + 1) - m.exp);
      MB.audio.sfx('levelup'); await MB.say(`${m.name} grew to Lv. ${m.lvl}!`);
      for (const e of ev) if (e.type === 'move') await MB.Screens.teachMove(m, e.id);
      const to = MB.Mon.checkEvolution(m, { time: MB.World.isNight() ? 'night' : 'day', flags: S.flags });
      if (to) await MB.Screens.evolve(m, to);
      return true;
    }
    if (it.vitamin) {
      m.bonus = m.bonus || {};
      if (m.ivs[it.vitamin] + (m.bonus[it.vitamin] || 0) >= 31) { await MB.say('It won\'t have any effect.'); return false; }
      m.bonus[it.vitamin] = (m.bonus[it.vitamin] || 0) + 4; MB.Bag.remove(id); MB.audio.sfx('statup');
      await MB.say(`${m.name}'s ${MB.STAT_NAMES[it.vitamin]} potential rose!`); return true;
    }
    let did = false;
    if (it.heal && m.hp > 0 && m.hp < max) { m.hp = Math.min(max, m.hp + it.heal); did = true; }
    if (it.cure && m.status && (it.cure === 'all' || it.cure.includes(m.status))) { m.status = null; did = true; }
    if (it.pp) for (const mv of m.moves) { if (mv.pp < MB.MOVES[mv.id].pp) { mv.pp = Math.min(MB.MOVES[mv.id].pp, mv.pp + it.pp); did = true; } }
    if (it.friend) { m.friend = Math.min(255, m.friend + it.friend); did = true; }
    if (!did) { await MB.say('It won\'t have any effect.'); return false; }
    MB.Bag.remove(id); MB.audio.sfx('heal');
    await MB.say(`${m.name} was healed.`);
    return true;
  },
};

// ===================== STORAGE PC =====================
class PCScene {
  constructor() { this.box = 0; this.cx = 0; this.cy = 0; this.side = 'box'; this.held = null; this.pi = 0; }
  get S() { return MB.state; }
  boxList() { return this.S.boxes[this.box]; }
  update() {
    const I = MB.input, S = this.S;
    if (I.pressed('b')) { if (this.held) { MB.say('Put the creature down first!'); return; } this.close(); return; }
    if (this.side === 'box') {
      if (I.repeat('right')) this.cx = (this.cx + 1) % 6; if (I.repeat('left')) this.cx = (this.cx + 5) % 6;
      if (I.repeat('down')) { if (this.cy === 4) { this.side = 'party'; this.pi = 0; } else this.cy++; }
      if (I.repeat('up')) { if (this.cy === 0) this.cy = -1; else if (this.cy > 0) this.cy--; }
      if (this.cy === -1) { if (I.pressed('left')) { this.box = (this.box + S.boxes.length - 1) % S.boxes.length; } if (I.pressed('right')) { this.box = (this.box + 1) % S.boxes.length; } if (I.repeat('down')) this.cy = 0; }
    } else {
      if (I.repeat('down')) this.pi = Math.min(S.party.length, this.pi + 1);
      if (I.repeat('up')) { if (this.pi === 0) { this.side = 'box'; this.cy = 4; } else this.pi--; }
    }
    if (I.pressed('a')) this.act();
  }
  async act() {
    const S = this.S;
    if (this.side === 'box' && this.cy === -1) { if (S.boxes.length < 24 && await MB.yesno('Add a new box?')) S.boxes.push([]); return; }
    if (this.side === 'box') {
      const i = this.cy * 6 + this.cx; const list = this.boxList();
      if (this.held) {
        if (list[i]) { const t = list[i]; list[i] = this.held; this.held = t; } else { list.splice(Math.min(i, list.length), 0, this.held); this.held = null; }
        return;
      }
      const m = list[i]; if (!m) return;
      const c = await MB.ask(`${m.name} (Lv${m.lvl})`, ['Move', 'Withdraw', 'Summary', 'Release', 'Cancel']);
      if (c === 0) { this.held = list.splice(i, 1)[0]; }
      else if (c === 1) { if (S.party.length >= 6) return MB.say('Your party is full!'); S.party.push(list.splice(i, 1)[0]); }
      else if (c === 2) await MB.Game.push(new SummaryScene(i, list));
      else if (c === 3) { if (await MB.yesno(`Release ${m.name}? This can't be undone.`)) { list.splice(i, 1); await MB.say(`${m.name} was released. Bye-bye!`); } }
    } else {
      if (this.pi >= S.party.length) { if (this.held && S.party.length < 6) { S.party.push(this.held); this.held = null; } return; }
      const m = S.party[this.pi];
      if (this.held) { const t = S.party[this.pi]; S.party[this.pi] = this.held; this.held = t; return; }
      const c = await MB.ask(`${m.name} (Lv${m.lvl})`, ['Deposit', 'Move', 'Summary', 'Cancel']);
      if (c === 0) {
        if (S.party.filter((x) => !x.egg && x.hp > 0).length <= 1 && !m.egg && m.hp > 0) return MB.say('That\'s your last healthy creature!');
        if (this.boxList().length >= 30) return MB.say('This box is full.');
        this.boxList().push(S.party.splice(this.pi, 1)[0]); this.pi = Math.max(0, Math.min(this.pi, S.party.length - 1));
      } else if (c === 1) {
        if (S.party.filter((x) => !x.egg && x.hp > 0).length <= 1 && !m.egg) return MB.say('You can\'t move your last creature out!');
        this.held = S.party.splice(this.pi, 1)[0];
      } else if (c === 2) await MB.Game.push(new SummaryScene(this.pi));
    }
  }
  draw(ctx) {
    const S = this.S;
    bgPanel(ctx, '', '#3a6a9a');
    UI.box(ctx, 4, 4, 200, 20, this.cy === -1 && this.side === 'box' ? 'gold' : undefined);
    UI.text(ctx, `◄ Box ${this.box + 1}/${S.boxes.length} (${this.boxList().length}/30) ►`, 104, 18, { size: 8, bold: true, align: 'center' });
    UI.box(ctx, 4, 26, 200, 150);
    const list = this.boxList();
    for (let j = 0; j < 5; j++) for (let i = 0; i < 6; i++) {
      const k = j * 6 + i, x = 10 + i * 32, y = 30 + j * 29;
      ctx.fillStyle = 'rgba(80,110,160,0.15)'; ctx.fillRect(x, y, 30, 27);
      if (list[k]) UI.monIcon(ctx, list[k], x + 2, y, 26);
      if (this.side === 'box' && this.cy === j && this.cx === i) { ctx.strokeStyle = '#e04040'; ctx.lineWidth = 1.5; ctx.strokeRect(x, y, 30, 27); if (this.held) UI.monIcon(ctx, this.held, x + 6, y - 10, 26); }
    }
    UI.box(ctx, 208, 4, 108, 172);
    UI.text(ctx, 'PARTY', 262, 18, { size: 8, bold: true, align: 'center' });
    for (let i = 0; i <= Math.min(5, S.party.length); i++) {
      const y = 24 + i * 24;
      const m = S.party[i];
      if (this.side === 'party' && this.pi === i) { ctx.fillStyle = '#f8e8a0'; ctx.fillRect(212, y, 100, 23); if (this.held) UI.monIcon(ctx, this.held, 290, y - 4, 22); }
      if (m) { UI.monIcon(ctx, m, 214, y, 22); UI.text(ctx, m.name, 238, y + 10, { size: 6, bold: true }); UI.text(ctx, m.egg ? 'Egg' : 'Lv' + m.lvl, 238, y + 19, { size: 6 }); }
      else if (i === S.party.length && S.party.length < 6) UI.text(ctx, '(empty)', 240, y + 14, { size: 6, color: '#808080' });
    }
    UI.box(ctx, 4, 180, MB.W - 8, 56);
    let info = this.held ? `Holding ${this.held.name}. Choose a spot.` : 'Z: select  X: close.  Move up from the grid to change boxes.';
    const cur = this.side === 'box' ? list[this.cy * 6 + this.cx] : S.party[this.pi];
    if (cur && !this.held) { const sp = MB.SP[cur.sp]; info = `${cur.name} — ${cur.egg ? 'Egg' : sp.name + ' Lv' + cur.lvl + ' ' + sp.types.join('/')}${cur.shiny ? ' ★' : ''}`; }
    UI.text(ctx, info, 14, 200, { size: 7 });
    UI.text(ctx, `Caught: ${MB.Dex.countCaught()}   Stored: ${S.boxes.reduce((a, b) => a + b.length, 0)}`, 14, 220, { size: 6, color: '#606070' });
  }
}
MB.PCScene = PCScene;

// ===================== SHOP =====================
class ShopScene {
  constructor(list, name) { this.list = list.filter((id) => MB.ITEMS[id]); this.name = name || 'Shop'; this.idx = 0; this.scroll = 0; }
  update() {
    const I = MB.input;
    if (I.repeat('down')) this.idx = (this.idx + 1) % this.list.length; if (I.repeat('up')) this.idx = (this.idx + this.list.length - 1) % this.list.length;
    if (this.idx < this.scroll) this.scroll = this.idx; if (this.idx >= this.scroll + 10) this.scroll = this.idx - 9;
    if (I.pressed('b')) { this.close(); return; }
    if (I.pressed('a')) this.buy();
  }
  price(id) { const p = MB.ITEMS[id].price; const ev = MB.World.events(); return ev.some((e) => e.type === 'festival') ? Math.floor(p * 0.8) : p; }
  async buy() {
    const S = MB.state, id = this.list[this.idx], it = MB.ITEMS[id], p = this.price(id);
    const maxQ = Math.min(99, Math.floor(S.money / Math.max(1, p)));
    if (maxQ <= 0) return MB.say('You don\'t have enough money.');
    const qs = [1, 5, 10, 25].filter((q) => q <= maxQ);
    const c = await MB.ask(`${it.name}: $${p} each. How many?`, qs.map((q) => `${q}  ($${q * p})`));
    if (c < 0) return;
    const q = qs[c];
    S.money -= q * p; MB.Bag.add(id, q); MB.audio.sfx('item');
    if (it.cat === 'capsule' && q >= 10) { MB.Bag.add('basic_capsule', Math.floor(q / 10)); await MB.say('Here, have some extra Basic Capsules as a bonus!'); }
    else await MB.say(`Here you go! Thank you!`);
  }
  draw(ctx) {
    bgPanel(ctx, this.name.toUpperCase(), '#3a6aa0');
    UI.text(ctx, `$${MB.state.money}`, MB.W - 8, 13, { size: 8, bold: true, color: '#fff070', align: 'right' });
    UI.box(ctx, 4, 22, 200, 164);
    this.list.slice(this.scroll, this.scroll + 10).forEach((id, i) => {
      const y = 38 + i * 15;
      if (this.scroll + i === this.idx) UI.cursor(ctx, 12, y - 3);
      UI.text(ctx, MB.ITEMS[id].name, 22, y, { size: 7 });
      UI.text(ctx, '$' + this.price(id), 196, y, { size: 7, align: 'right' });
    });
    UI.box(ctx, 208, 22, 108, 164);
    const it = MB.ITEMS[this.list[this.idx]];
    const dl = MB.UI.wrapLines(ctx, it.desc, 96, 6); MB.UI.font(ctx, 6); dl.slice(0, 9).forEach((l, i) => UI.text(ctx, l, 214, 40 + i * 10, { size: 6 }));
    UI.text(ctx, `In bag: ${MB.Bag.count(it.id)}`, 214, 176, { size: 6 });
    UI.box(ctx, 4, 190, MB.W - 8, 46);
    UI.text(ctx, MB.World.events().some((e) => e.type === 'festival') ? 'Festival sale! 20% off everything!' : 'Z: buy   X: leave', 14, 210, { size: 7 });
  }
}
MB.ShopScene = ShopScene;
MB.shopFlow = async function (shopKey, name) {
  const c = await MB.ask('Welcome! How may I help you?', ['Buy', 'Sell', 'See ya!']);
  if (c === 0) await MB.Game.push(new ShopScene(MB.SHOPS[shopKey] || MB.SHOPS.t1, name));
  else if (c === 1) {
    const S = MB.state;
    while (true) {
      const sellable = Object.keys(S.bag).filter((id) => MB.ITEMS[id] && !['key', 'quest', 'mega'].includes(MB.ITEMS[id].cat));
      if (!sellable.length) return MB.say('You have nothing I\'d buy.');
      const val = (id) => MB.ITEMS[id].sell || Math.floor((MB.ITEMS[id].price || 100) / 2);
      const k = await MB.ask('What will you sell?', sellable.map((id) => `${MB.ITEMS[id].name} x${S.bag[id]} - $${val(id)}`), { maxVis: 7 });
      if (k < 0) return;
      const id = sellable[k];
      const qs = [1, S.bag[id]].filter((v, i, a) => a.indexOf(v) === i);
      const q = qs[await MB.ask('How many?', qs.map((x) => `${x} ($${x * val(id)})`))] ;
      if (!q) continue;
      MB.Bag.remove(id, q); S.money += q * val(id); MB.audio.sfx('item');
    }
  }
};
