import { RARITY, WEAPONS, ENEMY_TYPES, BESTIARY_ORDER, BOSSES, DIFFICULTIES, ELITE_MODS } from './config.js';
import { UPGRADE_BY_ID, SYNERGIES, WEAPON_IDS, evolutionHint } from './upgrades.js';
import { RELICS, RELIC_BY_ID, EVOLUTIONS } from './relics.js';
import { CLASSES, START_WEAPONS, LOADOUTS, COSMETICS, ARENAS } from './characters.js';
import { EVENTS } from './events.js';
import { SHOP } from './meta.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function fmtTime(s) {
  s = Math.max(0, Math.floor(s));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

const BOSS_DESC = {
  guardian: 'Final campaign boss. Three phases: radial bursts and ground strikes, then summons and combos, then a collapsing arena with rift lances and spirals.',
  devourer: 'Charges across the arena leaving acid pools, then is stunned at the wall. Punish it while it is dazed.',
  engineer: 'Shielded by pylons — destroy them first. Deploys turrets and mines and overheats after its barrage.',
};

// All DOM work lives here. The game calls in; button presses go out through onAction.
export class UI {
  constructor() {
    this.screens = ['menu', 'setup', 'shop', 'collection', 'howto', 'settings', 'levelup', 'relic', 'shrine', 'supply', 'pause', 'confirm', 'end'];
    this.current = null;
    this.onAction = () => {};
    this.cache = {};
    this.shopTab = 'bonuses';
    this.colTab = 'bestiary';
    this.el = {
      hud: $('hud'), hpFill: $('hp-fill'), hpText: $('hp-text'), shieldFill: $('shield-fill'), xpFill: $('xp-fill'),
      lvl: $('lvl-text'), wave: $('wave-text'), waveSub: $('wave-sub'), waveFill: $('wave-fill'), preview: $('wave-preview'),
      bossBar: $('boss-bar'), bossName: $('boss-name'), bossFill: $('boss-fill'), bossStatus: $('boss-status'), phaseMarks: $('phase-marks'),
      timer: $('timer'), shards: $('shard-text'), gold: $('gold-text'), mute: $('btn-mute'), pause: $('btn-pause'),
      slots: $('slots'), icons: $('upgrade-icons'), relics: $('relic-row'), objectives: $('objectives'), status: $('status-row'),
      hint: $('interact-hint'), fps: $('fps'), vignette: $('hurt-vignette'),
      announce: $('announce'), toasts: $('toasts'), cards: $('cards'), particles: $('menu-particles'),
    };

    for (const name of this.screens) {
      const root = $(`screen-${name}`);
      root.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn || btn.disabled) return;
        if (this.handleLocal(name, btn)) return;
        this.onAction(name, btn.dataset.action, btn);
      });
    }
    this.el.pause.addEventListener('click', () => this.onAction('hud', 'pause'));
    this.el.mute.addEventListener('click', () => this.onAction('hud', 'mute'));
    this.slotEls = {};
    this.buildMenuParticles();
  }

  // Buttons whose behaviour lives entirely inside the UI (tabs, modal callbacks).
  handleLocal(screen, btn) {
    const a = btn.dataset.action;
    if (a === 'tab' && screen === 'shop') { this.shopTab = btn.dataset.id; this.renderShop(this.meta); return true; }
    if (a === 'tab' && screen === 'collection') { this.colTab = btn.dataset.id; this.renderCollection(this.meta); return true; }
    if (screen === 'relic' && a === 'skip') { const cb = this.relicCb; this.relicCb = null; cb && cb(null); return true; }
    if (screen === 'relic' && a === 'cancelReplace') { $('relic-replace').classList.add('hidden'); return true; }
    if (screen === 'relic' && a === 'replace') { const cb = this.relicCb; this.relicCb = null; cb && cb(this.pendingRelic, btn.dataset.id); return true; }
    if (screen === 'shrine' && a === 'leave') { const cb = this.shrineCb; this.shrineCb = null; cb && cb(null); return true; }
    if (screen === 'shrine' && a === 'accept') { const cb = this.shrineCb; this.shrineCb = null; cb && cb(btn.dataset.id); return true; }
    if (screen === 'supply' && a === 'leave') { const cb = this.supplyCb; this.supplyCb = null; cb && cb(null); return true; }
    if (screen === 'supply' && a === 'buy') { this.supplyCb && this.supplyCb(btn.dataset.id); return true; }
    return false;
  }

  show(name) {
    for (const s of this.screens) $(`screen-${s}`).classList.toggle('active', s === name);
    this.current = name;
    document.body.classList.toggle('overlay-open', !!name && name !== 'menu');
    this.el.particles.classList.toggle('active', name === 'menu');
  }

  setHudVisible(v) { this.el.hud.classList.toggle('hidden', !v); }
  hideLoading() { $('loading').classList.add('gone'); }

  buildMenuParticles() {
    for (let i = 0; i < 40; i++) {
      const m = document.createElement('div');
      m.className = 'mote';
      const size = 2 + Math.random() * 4;
      m.style.left = `${Math.random() * 100}%`;
      m.style.width = m.style.height = `${size}px`;
      m.style.animationDuration = `${7 + Math.random() * 10}s`;
      m.style.animationDelay = `${-Math.random() * 15}s`;
      if (Math.random() < 0.35) m.style.background = '#8fe6ff';
      this.el.particles.appendChild(m);
    }
  }

  // ------------------------------------------------------------------ menu & setup
  renderMenuStats(meta) {
    this.meta = meta;
    const d = meta.data;
    const btn = $('btn-endless');
    btn.disabled = !meta.endlessUnlocked;
    btn.textContent = meta.endlessUnlocked ? `∞ Endless${d.records.endlessWave ? ` · best wave ${d.records.endlessWave}` : ''}` : '∞ Endless (defeat the Rift Guardian)';
    $('menu-stats').innerHTML = `<span>💎 ${d.shards} shards</span><span>Runs: ${d.runs}</span><span>Wins: ${d.wins}</span><span>Best wave: ${d.bestWave || '—'}</span>`;
  }

  renderSetup(meta, sel, mode) {
    this.meta = meta;
    this.setupSel = sel;
    $('setup-title').textContent = mode === 'endless' ? 'Endless Run' : 'Campaign Run';
    $('setup-sub').textContent = mode === 'endless'
      ? `Survive as long as you can. A boss every 10 waves, an elite every 5. Record: wave ${meta.data.records.endlessWave || 0} · ${fmtTime(meta.data.records.endlessTime || 0)}`
      : '10 waves, a random mid-boss on wave 5 and the Rift Guardian on wave 10.';
    // Difficulty
    $('setup-diff').innerHTML = Object.entries(DIFFICULTIES).map(([id, d]) => {
      const locked = id === 'nightmare' && !meta.nightmareUnlocked;
      return `<button class="choice ${sel.diff === id ? 'on' : ''}" data-action="diff" data-id="${id}" ${locked ? 'disabled' : ''} style="--cc:${d.color}">
        <b>${d.name}</b><small>${locked ? '🔒 Win a campaign run to unlock' : esc(d.desc)}</small>
        ${meta.data.winsByDiff[id] ? `<span class="tag">✔ ${meta.data.winsByDiff[id]} win${meta.data.winsByDiff[id] > 1 ? 's' : ''}</span>` : ''}</button>`;
    }).join('');
    // Classes
    $('setup-class').innerHTML = Object.entries(CLASSES).map(([id, c]) => {
      const owned = id === 'runner' || meta.isUnlocked('classes', id);
      return `<button class="class-card ${sel.cls === id ? 'on' : ''}" data-action="cls" data-id="${id}" ${owned ? '' : 'disabled'}>
        <div class="c-top"><span class="c-ico">${c.icon}</span><b>${c.name}</b></div>
        <div class="c-stats">❤️ ${c.maxHp} · ${WEAPONS[c.weapon].icon} ${WEAPONS[c.weapon].name}</div>
        <div class="c-desc">${esc(c.desc)}</div>
        <div class="c-abil">${c.ability.icon} <b>${c.ability.name}</b> — ${esc(c.ability.desc)}</div>
        ${owned ? '' : `<div class="c-lock">🔒 Unlock in the Sanctum · 💎 ${c.cost}</div>`}</button>`;
    }).join('');
    const opt = (v, label, cur) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${esc(label)}</option>`;
    const cls = CLASSES[sel.cls];
    $('setup-weapon').innerHTML = opt('class', `Class default (${WEAPONS[cls.weapon].name})`, sel.weapon) +
      Object.keys(START_WEAPONS).filter((w) => w !== cls.weapon && meta.isUnlocked('weapons', w)).map((w) => opt(w, WEAPONS[w].name, sel.weapon)).join('');
    $('setup-loadout').innerHTML = Object.entries(LOADOUTS).filter(([id]) => id === 'standard' || meta.isUnlocked('loadouts', id)).map(([id, l]) => opt(id, `${l.name} — ${l.desc}`, sel.loadout)).join('');
    $('setup-arena').innerHTML = opt('random', 'Random', sel.arena) + meta.data.unlocks.arenas.map((a) => opt(a, ARENAS[a].name, sel.arena)).join('');
    $('setup-cloak').innerHTML = Object.entries(COSMETICS.cloaks).filter(([id]) => id === 'default' || meta.isUnlocked('cloaks', id)).map(([id, c]) => opt(id, c.name, sel.cloak)).join('');
    $('setup-trail').innerHTML = Object.entries(COSMETICS.trails).filter(([id]) => id === 'default' || meta.isUnlocked('trails', id)).map(([id, c]) => opt(id, c.name, sel.trail)).join('');
    for (const [key, id] of [['weapon', 'setup-weapon'], ['loadout', 'setup-loadout'], ['arena', 'setup-arena'], ['cloak', 'setup-cloak'], ['trail', 'setup-trail']]) {
      const el = $(id);
      if (!el.options.length) continue;
      if (![...el.options].some((o) => o.value === sel[key])) sel[key] = el.options[0].value;
      el.value = sel[key];
      el.onchange = () => { sel[key] = el.value; this.onAction('setup', 'changed'); };
    }
    const lo = LOADOUTS[sel.loadout];
    $('setup-note').textContent = `${DIFFICULTIES[sel.diff].name}: shards ×${DIFFICULTIES[sel.diff].shardMult}. ${lo ? `Loadout: ${lo.desc}` : ''}`;
  }

  // ------------------------------------------------------------------ sanctum
  renderShop(meta) {
    this.meta = meta;
    $('shop-shards').textContent = meta.data.shards;
    const tabs = [['bonuses', 'Bonuses'], ['classes', 'Characters'], ['weapons', 'Starting Weapons'], ['relics', 'Relics'], ['arenas', 'Arenas'], ['loadouts', 'Loadouts'], ['cosmetics', 'Cosmetics']];
    $('shop-tabs').innerHTML = tabs.map(([id, n]) => `<button class="tab ${this.shopTab === id ? 'on' : ''}" data-action="tab" data-id="${id}">${n}</button>`).join('');
    $('btn-refund').classList.toggle('hidden', this.shopTab !== 'bonuses');
    const grid = $('shop-grid');
    const item = (icon, name, desc, extra, btn) => `<div class="shop-item"><div class="top"><div class="icon">${icon}</div><div><div class="name">${esc(name)}</div><div class="desc">${esc(desc)}</div></div></div>${extra || ''}${btn}</div>`;
    const buyBtn = (cat, id, cost) => {
      if (meta.isUnlocked(cat, id)) return '<button class="btn small" disabled>Owned</button>';
      if (cost == null) return '<button class="btn small" disabled>Earned from objectives</button>';
      return `<button class="btn small" data-action="unlock" data-cat="${cat}" data-id="${id}" ${meta.data.shards < cost ? 'disabled' : ''}>Unlock · 💎 ${cost}</button>`;
    };
    let html = '';
    const t = this.shopTab;
    if (t === 'bonuses') {
      html = SHOP.map((s) => {
        const lvl = meta.level(s.id), cost = meta.cost(s.id);
        const pips = `<div class="pips">${Array.from({ length: s.max }, (_, i) => `<div class="pip ${i < lvl ? 'on' : ''}"></div>`).join('')}</div>`;
        const btn = cost === null ? '<button class="btn small" disabled>Maxed</button>' : `<button class="btn small" data-action="buy" data-id="${s.id}" ${meta.data.shards < cost ? 'disabled' : ''}>Buy · 💎 ${cost}</button>`;
        return item(s.icon, s.name, `${s.desc} per rank`, pips, btn);
      }).join('');
    } else if (t === 'classes') {
      html = Object.entries(CLASSES).filter(([id]) => id !== 'runner').map(([id, c]) => item(c.icon, c.name, `${c.desc} Ability: ${c.ability.name}. Starts with ${WEAPONS[c.weapon].name}.`, '', buyBtn('classes', id, c.cost))).join('');
    } else if (t === 'weapons') {
      html = Object.entries(START_WEAPONS).filter(([, c]) => c > 0).map(([id, c]) => item(WEAPONS[id].icon, WEAPONS[id].name, `Start runs with this weapon. ${WEAPONS[id].desc}`, '', buyBtn('weapons', id, c))).join('');
    } else if (t === 'relics') {
      html = RELICS.filter((r) => r.unlock).map((r) => item(r.icon, r.name, `Adds this relic to the drop pool. ${r.desc}`, '', buyBtn('relics', r.id, r.unlock))).join('');
    } else if (t === 'arenas') {
      html = Object.entries(ARENAS).filter(([, a]) => a.cost > 0).map(([id, a]) => item(a.icon, a.name, a.desc, '', buyBtn('arenas', id, a.cost))).join('');
    } else if (t === 'loadouts') {
      html = Object.entries(LOADOUTS).filter(([, l]) => l.cost > 0).map(([id, l]) => item(l.icon, l.name, l.desc, '', buyBtn('loadouts', id, l.cost))).join('');
    } else {
      html = Object.entries(COSMETICS.cloaks).filter(([id]) => id !== 'default').map(([id, c]) => item(`<span class="swatch" style="background:${c.color}"></span>`, `${c.name} cloak`, c.objective ? 'Reward for the Executioner objective.' : 'Cloak colour.', '', buyBtn('cloaks', id, c.objective ? null : c.cost))).join('') +
        Object.entries(COSMETICS.trails).filter(([id]) => id !== 'default').map(([id, c]) => item(`<span class="swatch round" style="background:${c.color}"></span>`, `${c.name} trail`, c.objective ? 'Reward for the Specialist objective.' : 'Dash and movement trail colour.', '', buyBtn('trails', id, c.objective ? null : c.cost))).join('');
    }
    grid.innerHTML = html;
  }

  // ------------------------------------------------------------------ collection
  renderCollection(meta) {
    this.meta = meta;
    const tabs = [['bestiary', 'Bestiary'], ['relics', 'Relics'], ['weapons', 'Weapons & Evolutions'], ['history', 'Run History']];
    $('col-tabs').innerHTML = tabs.map(([id, n]) => `<button class="tab ${this.colTab === id ? 'on' : ''}" data-action="tab" data-id="${id}">${n}</button>`).join('');
    const d = meta.data, body = $('col-body');
    const t = this.colTab;
    if (t === 'bestiary') {
      const seen = d.seen;
      const rows = BESTIARY_ORDER.map((id) => {
        const e = ENEMY_TYPES[id], known = seen[id] !== undefined;
        return `<div class="entry ${known ? '' : 'unknown'}"><div class="e-name" style="color:${known ? e.color : '#666'}">${known ? e.name : '???'}</div>
          <div class="e-desc">${known ? esc(e.desc) : 'Not yet encountered.'}</div>${known ? `<div class="e-meta">Defeated: ${seen[id] || 0} · Health ${e.hp} · Speed ${e.speed}</div>` : ''}</div>`;
      });
      for (const [id, b] of Object.entries(BOSSES)) {
        const known = seen[id] !== undefined;
        rows.push(`<div class="entry boss ${known ? '' : 'unknown'}"><div class="e-name">${known ? '👑 ' + b.name : '👑 ???'}</div><div class="e-desc">${known ? BOSS_DESC[id] : 'A boss not yet faced.'}</div></div>`);
      }
      rows.push(`<div class="entry"><div class="e-name">Elite modifiers</div><div class="e-desc">${Object.values(ELITE_MODS).map((m) => `<span class="chip" style="border-color:${m.color}">${m.icon} <b>${m.name}</b> — ${esc(m.desc)}</span>`).join(' ')}</div></div>`);
      body.innerHTML = `<div class="entry-grid">${rows.join('')}</div>`;
    } else if (t === 'relics') {
      body.innerHTML = `<p class="muted">Found ${d.found.relics.length} / ${RELICS.length}. Locked relics can be added to the pool in the Sanctum.</p><div class="entry-grid">` + RELICS.map((r) => {
        const avail = !r.unlock || meta.isUnlocked('relics', r.id), found = d.found.relics.includes(r.id);
        return `<div class="entry ${found ? '' : 'unknown'}"><div class="e-name" style="color:${RARITY[r.rarity].color}">${r.icon} ${r.name}</div><div class="e-desc">${esc(r.desc)}</div><div class="e-meta">${found ? '✔ Found' : avail ? 'Not found yet' : `🔒 Unlock for 💎 ${r.unlock}`}</div></div>`;
      }).join('') + '</div>';
    } else if (t === 'weapons') {
      const ws = WEAPON_IDS.map((id) => `<div class="entry ${d.found.weapons.includes(id) ? '' : 'unknown'}"><div class="e-name">${WEAPONS[id].icon} ${WEAPONS[id].name}</div><div class="e-desc">${esc(WEAPONS[id].desc)}</div><div class="e-meta">${d.found.weapons.includes(id) ? '✔ Used' : 'Not used yet'}</div></div>`).join('');
      const evs = EVOLUTIONS.map((e) => {
        const found = d.found.evolutions.includes(e.id);
        return `<div class="entry ${found ? 'evo' : ''}"><div class="e-name">${e.icon} ${e.name} ${found ? '✔' : ''}</div><div class="e-recipe">${WEAPONS[e.weapon].icon} ${WEAPONS[e.weapon].name} Lv${e.level} + ${RELIC_BY_ID[e.relic].icon} ${RELIC_BY_ID[e.relic].name}</div><div class="e-desc">${esc(e.desc)}</div></div>`;
      }).join('');
      body.innerHTML = `<h3>Weapons</h3><div class="entry-grid">${ws}</div><h3>Evolution recipes</h3><div class="entry-grid">${evs}</div>`;
    } else {
      const r = d.records;
      const rows = d.history.map((h) => `<tr class="${h.victory ? 'win' : ''}"><td>${new Date(h.date).toLocaleDateString()}</td><td>${h.mode === 'endless' ? 'Endless' : 'Campaign'}</td><td>${DIFFICULTIES[h.diff]?.name || h.diff}</td><td>${CLASSES[h.cls]?.name || h.cls}</td><td>${h.victory ? '🏆 Victory' : `Wave ${h.wave}`}</td><td>${fmtTime(h.time)}</td><td>${h.kills}</td><td>💎 ${h.shards}</td></tr>`).join('');
      body.innerHTML = `<div class="records"><span>Campaign wins: <b>${d.wins}</b> (N ${d.winsByDiff.normal || 0} · H ${d.winsByDiff.hard || 0} · NM ${d.winsByDiff.nightmare || 0})</span><span>Endless best wave: <b>${r.endlessWave || '—'}</b></span><span>Longest endless survival: <b>${r.endlessTime ? fmtTime(r.endlessTime) : '—'}</b></span></div>` +
        (rows ? `<div class="table-wrap"><table class="history"><thead><tr><th>Date</th><th>Mode</th><th>Difficulty</th><th>Character</th><th>Result</th><th>Time</th><th>Kills</th><th>Shards</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="muted">No runs yet.</p>');
    }
  }

  // ------------------------------------------------------------------ settings
  bindSettings(settings, onChange) {
    const bind = (id, key, prop = 'checked') => {
      const input = $(id);
      input[prop] = settings[key];
      input.addEventListener('input', () => {
        settings[key] = prop === 'checked' ? input.checked : input.type === 'range' ? parseFloat(input.value) : input.value;
        onChange(key);
      });
    };
    bind('set-volume', 'volume', 'value');
    bind('set-muted', 'muted');
    bind('set-shake', 'shake');
    bind('set-numbers', 'numbers');
    bind('set-flash', 'reduceFlash');
    bind('set-autofire', 'autofire');
    bind('set-fps', 'showFps');
    bind('set-particles', 'particles', 'value');
    bind('set-quality', 'quality', 'value');
  }

  syncSettings(settings) {
    $('set-muted').checked = settings.muted;
    this.el.mute.textContent = settings.muted ? '🔇' : '🔊';
  }

  // ------------------------------------------------------------------ HUD
  buildSlots(g) {
    const s = g.stats;
    const owned = WEAPON_IDS.filter((w) => s.weapons[w]);
    const key = owned.map((w) => `${w}${s.weapons[w]}${s.evolved[w] || ''}`).join(',') + g.run.cls;
    if (key === this.slotKey) return;
    this.slotKey = key;
    const wrap = this.el.slots;
    wrap.innerHTML = '';
    this.slotEls = {};
    const mk = (id, icon, label, cls, title) => {
      const d = document.createElement('div');
      d.className = `slot ${cls}`;
      d.title = title;
      d.innerHTML = `${icon}<div class="cd"></div><div class="lv"></div><div class="lbl">${label}</div>`;
      wrap.appendChild(d);
      this.slotEls[id] = { el: d, cd: d.querySelector('.cd'), lv: d.querySelector('.lv') };
    };
    for (const w of owned) {
      const ev = s.evolved[w] ? EVOLUTIONS.find((e) => e.id === s.evolved[w]) : null;
      mk(w, ev ? ev.icon : WEAPONS[w].icon, w === 'blades' ? 'auto' : 'LMB', ev ? 'evolved' : '', ev ? ev.name : WEAPONS[w].name);
    }
    for (let i = owned.length; i < s.maxWeapons; i++) mk(`empty${i}`, '＋', 'empty', 'empty', 'Empty weapon slot');
    mk('dash', '💨', 'Space', 'ability', 'Dash');
    const ab = CLASSES[g.run.cls].ability;
    mk('ability', ab.icon, 'Shift', 'ability', `${ab.name}: ${ab.desc}`);
  }

  set(key, el, prop, value) {
    if (this.cache[key] === value) return;
    this.cache[key] = value;
    if (prop === 'text') el.textContent = value;
    else if (prop === 'html') el.innerHTML = value;
    else if (prop === 'width') el.style.width = value;
    else if (prop === 'height') el.style.height = value;
  }

  updateHud(g) {
    const p = g.player, run = g.run, el = this.el;
    this.set('hpw', el.hpFill, 'width', `${(Math.max(0, p.hp) / p.maxHp * 100).toFixed(1)}%`);
    this.set('hpt', el.hpText, 'text', `${Math.ceil(Math.max(0, p.hp))} / ${p.maxHp}`);
    this.set('shw', el.shieldFill, 'width', p.shieldMax > 0 ? `${(p.shield / p.maxHp * 100).toFixed(1)}%` : '0%');
    this.set('xpw', el.xpFill, 'width', `${(run.xp / run.xpNext * 100).toFixed(1)}%`);
    this.set('lvl', el.lvl, 'text', String(run.level));
    this.set('timer', el.timer, 'text', fmtTime(run.time));
    this.set('gold', el.gold, 'text', String(run.gold));
    this.set('shards', el.shards, 'text', String(g.meta.data.shards + Math.floor(run.shards)));

    const w = g.waves;
    this.set('wave', el.wave, 'text', `WAVE ${w.wave} / ${w.total}`);
    let sub, frac;
    if (w.state === 'boss') { sub = `Defeat ${g.boss.name}`; frac = g.boss.e ? 1 - g.boss.e.hp / g.boss.e.maxHp : 1; }
    else if (w.state === 'break') { sub = `Next wave in ${Math.ceil(w.breakT)}…`; frac = 1; }
    else { sub = `${w.remaining} enemies remaining`; frac = w.quota ? w.killed / w.quota : 0; }
    if (g.events.active) sub += ` · ${EVENTS[g.events.active].icon} ${EVENTS[g.events.active].name}`;
    this.set('wsub', el.waveSub, 'text', sub);
    this.set('wfill', el.waveFill, 'width', `${(frac * 100).toFixed(1)}%`);

    // Next wave preview during breaks
    let prev = '';
    if (w.state === 'break') {
      const pv = w.preview();
      if (pv) {
        if (pv.boss) prev = '<span class="pv-boss">👑 Boss wave next</span>';
        else prev = `Next: ${pv.types.map((t) => `<span class="pv" style="border-color:${ENEMY_TYPES[t].color}">${ENEMY_TYPES[t].name}</span>`).join('')}${pv.elites ? ` <span class="pv elite">+${pv.elites} elite</span>` : ''}`;
        if (pv.event) prev += `<div class="pv-event" style="color:${EVENTS[pv.event].color}">${EVENTS[pv.event].icon} Rift Event: <b>${EVENTS[pv.event].name}</b> — ${esc(EVENTS[pv.event].desc)}</div>`;
      }
    }
    this.set('preview', el.preview, 'html', prev);

    // Top bar for the boss or an active miniboss
    let big = null;
    if (g.boss.active && g.boss.e) big = { name: g.boss.name, hp: g.boss.e.hp, max: g.boss.e.maxHp, phase: g.boss.phase, count: g.boss.phaseCount, status: g.boss.status, key: g.boss.key };
    else {
      const mb = g.enemies.list.find((e) => e.miniboss && !e.dead);
      if (mb) big = { name: mb.name, hp: mb.hp, max: mb.maxHp, phase: 1, count: 1, status: mb.mods.map((m) => `${ELITE_MODS[m].icon} ${ELITE_MODS[m].name}`).join(' · '), key: 'mini' };
    }
    el.bossBar.classList.toggle('hidden', !big);
    if (big) {
      this.set('bname', el.bossName, 'text', big.count > 1 ? `${big.name} — Phase ${big.phase}` : big.name);
      this.set('bfill', el.bossFill, 'width', `${(Math.max(0, big.hp) / big.max * 100).toFixed(1)}%`);
      this.set('bstatus', el.bossStatus, 'text', big.status || '');
      const marks = big.count === 3 ? '<i style="left:33.3%"></i><i style="left:66.6%"></i>' : big.count === 2 ? '<i style="left:50%"></i>' : '';
      this.set('bmarks', el.phaseMarks, 'html', marks);
      el.bossBar.dataset.phase = big.phase;
    }

    // Weapon / ability slots
    this.buildSlots(g);
    const c = g.combat, s = g.stats;
    for (const [id, sl] of Object.entries(this.slotEls)) {
      let f = 0, lvl = '';
      if (WEAPONS[id]) { lvl = String(s.weapons[id] || ''); f = id === 'blades' ? 0 : c.cd[id] / c.weaponCooldown(id); }
      else if (id === 'dash') f = p.dashCd / (1.5 * s.dashCdMult);
      else if (id === 'ability') f = p.abilityCd / CLASSES[run.cls].ability.cd;
      this.set(`sc${id}`, sl.cd, 'height', `${Math.round(Math.min(1, f) * 100)}%`);
      this.set(`sl${id}`, sl.lv, 'text', lvl);
      sl.el.classList.toggle('ready', f <= 0 && !id.startsWith('empty'));
    }

    // Status effects
    const st = [];
    if (run.buffs.fury > 0) st.push(['🔥', `Fury ${Math.ceil(run.buffs.fury)}s`, 'buff']);
    if (p.overclockT > 0) st.push(['💓', 'Overclocked', 'buff']);
    if (p.bulwarkT > 0) st.push(['🛡️', 'Bulwark', 'buff']);
    if (s.relic.laststand && p.hp / p.maxHp < (s.syn.crimson ? 0.5 : 0.35)) st.push(['⚔', 'Last Stand', 'buff']);
    if (p.shield > 1) st.push(['🔷', `Shield ${Math.round(p.shield)}`, 'buff']);
    if (g.drainT > 0) st.push(['🩸', 'Drained', 'debuff']);
    if (g.hazards.inPool(p.x, p.z)) st.push(['☣️', 'Acid', 'debuff']);
    if (Math.hypot(p.x, p.z) > g.safeRadius()) st.push(['⚠', 'Outside safe zone', 'debuff']);
    if (g.events.active === 'bloodmoon') st.push(['🌑', 'Blood Moon', 'debuff']);
    this.set('status', el.status, 'html', st.map(([i, t, k]) => `<span class="st ${k}">${i} ${t}</span>`).join(''));

    // Objectives
    const obj = g.objectives.list.map((o) => `<div class="obj ${o.done ? 'done' : o.failed ? 'failed' : ''}"><span>${o.done ? '✔' : o.failed ? '✖' : '◇'} ${esc(o.text)}</span>${o.target > 1 && !o.done && !o.failed ? `<b>${Math.min(o.progress, o.target)}/${o.target}</b>` : ''}</div>`).join('');
    this.set('obj', el.objectives, 'html', obj);

    this.set('hint', el.hint, 'text', g.interactHint);
    el.hint.classList.toggle('hidden', !g.interactHint);

    const low = p.hp / p.maxHp < 0.3 && p.alive && !g.meta.settings.reduceFlash;
    el.vignette.classList.toggle('low', low);
    if (!low) el.vignette.style.opacity = String(Math.min(0.9, g.effects.flash));
    else el.vignette.style.removeProperty('opacity');
  }

  renderUpgradeIcons(g) {
    const levels = g.levels, synergies = g.synergies;
    const html = [];
    for (const [id, l] of Object.entries(levels)) {
      const u = UPGRADE_BY_ID[id];
      if (!u || u.weapon) continue;
      html.push(`<div class="uicon" style="--rc:${RARITY[u.rarity].color}" title="${esc(u.name)} (Lv ${l})">${u.icon}<i>${l}</i></div>`);
    }
    for (const id of synergies) {
      const s = SYNERGIES.find((x) => x.id === id);
      html.push(`<div class="uicon" style="--rc:#ffb547" title="Synergy: ${esc(s.name)} — ${esc(s.desc)}">✨</div>`);
    }
    this.el.icons.innerHTML = html.join('');
    this.el.relics.innerHTML = g.relics.map((id) => {
      const r = RELIC_BY_ID[id];
      return `<div class="relic" style="--rc:${RARITY[r.rarity].color}" title="${esc(r.name)}: ${esc(r.desc)}">${r.icon}</div>`;
    }).join('') + Array.from({ length: Math.max(0, 4 - g.relics.length) }, () => '<div class="relic empty" title="Empty relic slot"></div>').join('');
    $('pause-build').innerHTML = this.buildChips(g);
    $('pause-objectives').innerHTML = g.objectives.list.map((o) => `<div class="obj ${o.done ? 'done' : o.failed ? 'failed' : ''}">${o.done ? '✔' : o.failed ? '✖' : '◇'} ${esc(o.text)} <span class="muted">(+${o.reward}💎)</span></div>`).join('');
    this.slotKey = null;
  }

  buildChips(g) {
    const chips = Object.entries(g.levels).map(([id, l]) => {
      const u = UPGRADE_BY_ID[id];
      return u ? `<span class="chip" style="border-color:${RARITY[u.rarity].color}">${u.icon} ${esc(u.name)} <b>${l}</b></span>` : '';
    });
    for (const id of g.relics) { const r = RELIC_BY_ID[id]; chips.push(`<span class="chip relic-chip">${r.icon} ${esc(r.name)}</span>`); }
    for (const [w, id] of Object.entries(g.stats.evolved || {})) { const ev = EVOLUTIONS.find((e) => e.id === id); chips.push(`<span class="chip syn">${ev.icon} ${esc(ev.name)}</span>`); void w; }
    for (const id of g.synergies) {
      const s = SYNERGIES.find((x) => x.id === id);
      chips.push(`<span class="chip syn">✨ ${esc(s.name)}</span>`);
    }
    return chips.join('') || '<span class="muted">No upgrades yet</span>';
  }

  announce(title, sub, color = '#b98cff') {
    const a = this.el.announce;
    a.querySelector('.a-title').textContent = title;
    a.querySelector('.a-sub').textContent = sub || '';
    a.style.setProperty('--ac', color);
    a.classList.remove('show');
    void a.offsetWidth; // restart animation
    a.classList.add('show');
  }

  toast(title, color = '#b98cff', body = '') {
    const t = document.createElement('div');
    t.className = 'toast';
    t.style.setProperty('--tc', color);
    t.innerHTML = `<div class="t-title"></div>${body ? '<div class="t-body"></div>' : ''}`;
    t.querySelector('.t-title').textContent = title;
    if (body) t.querySelector('.t-body').textContent = body;
    this.el.toasts.appendChild(t);
    while (this.el.toasts.children.length > 4) this.el.toasts.firstChild.remove();
    setTimeout(() => t.remove(), 3900);
  }

  clearTransient() {
    this.el.toasts.innerHTML = '';
    this.el.announce.classList.remove('show');
    this.cache = {};
    this.slotKey = null;
  }

  // ------------------------------------------------------------------ modals
  showLevelUp(choices, levels, pending, relics, onPick) {
    $('levelup-sub').textContent = pending > 1 ? `Choose an upgrade  ·  ${pending} level-ups waiting` : 'Choose an upgrade';
    const wrap = this.el.cards;
    wrap.innerHTML = '';
    this.cardEls = choices.map((u, i) => {
      const lvl = (levels[u.id] || 0) + 1;
      const rar = RARITY[u.rarity];
      const card = document.createElement('div');
      card.className = `card ${u.rarity} locked`;
      card.style.setProperty('--rc', rar.color);
      const syn = SYNERGIES.filter((s) => s.parts.includes(u.name)).map((s) => s.name);
      let evo = '';
      if (u.weapon) {
        const ev = evolutionHint(u.id);
        if (ev) {
          const has = relics.includes(ev.relic);
          evo = `<div class="c-evo ${has ? 'ready' : ''}">🧬 Lv${ev.level} + ${RELIC_BY_ID[ev.relic].icon} ${RELIC_BY_ID[ev.relic].name}${has ? ' ✔' : ''} → <b>${ev.name}</b></div>`;
        }
      }
      card.innerHTML = `
        <div class="key">${i + 1}</div>
        <div class="rarity">${rar.label}${u.weapon ? ' · Weapon' : ''}</div>
        <div class="c-icon">${u.icon}</div>
        <div class="c-name">${esc(u.name)}</div>
        <div class="c-level">${u.filler ? 'Instant' : lvl === 1 ? 'NEW' : `Level ${lvl - 1} → ${lvl}`} ${u.max ? `<span class="muted">(max ${u.max})</span>` : ''}</div>
        <div class="c-desc">${esc(u.desc(lvl))}</div>
        ${evo}
        ${syn.length ? `<div class="c-syn">✨ Synergy: ${syn.join(', ')}</div>` : ''}`;
      card.addEventListener('click', () => onPick(i));
      wrap.appendChild(card);
      return card;
    });
    this.show('levelup');
    // Short lockout so a held/spammed click while fighting doesn't pick blindly.
    setTimeout(() => this.cardEls.forEach((c) => c.classList.remove('locked')), 380);
  }

  showRelicChoice(offers, owned, cap, cb) {
    this.relicCb = cb;
    $('relic-replace').classList.add('hidden');
    $('relic-sub').textContent = owned.length >= cap ? `Relic slots full (${owned.length}/${cap}) — choosing one will replace a relic you hold` : `Choose one relic (${owned.length}/${cap} slots used)`;
    $('relic-skip').textContent = offers.length === 1 ? 'Decline' : 'Leave it';
    const wrap = $('relic-cards');
    wrap.innerHTML = '';
    const cards = offers.map((r) => {
      const card = document.createElement('div');
      card.className = `card ${r.rarity} locked`;
      card.style.setProperty('--rc', RARITY[r.rarity].color);
      const ev = EVOLUTIONS.find((e) => e.relic === r.id);
      const syn = SYNERGIES.filter((s) => s.relic && s.parts.includes(r.name)).map((s) => s.name);
      card.innerHTML = `<div class="rarity">${RARITY[r.rarity].label} · Relic</div><div class="c-icon">${r.icon}</div><div class="c-name">${esc(r.name)}</div><div class="c-desc">${esc(r.desc)}</div>
        ${ev ? `<div class="c-evo">🧬 Evolves ${WEAPONS[ev.weapon].name} (Lv${ev.level}) → <b>${ev.name}</b></div>` : ''}
        ${syn.length ? `<div class="c-syn">✨ Synergy: ${syn.join(', ')}</div>` : ''}`;
      card.addEventListener('click', () => {
        if (card.classList.contains('locked')) return;
        if (owned.length < cap) { const c = this.relicCb; this.relicCb = null; c && c(r.id, null); return; }
        this.pendingRelic = r.id;
        const rep = $('relic-replace');
        rep.innerHTML = `<p>Replace which relic with <b>${esc(r.name)}</b>?</p>` + owned.map((id) => `<button class="btn small" data-action="replace" data-id="${id}">${RELIC_BY_ID[id].icon} ${esc(RELIC_BY_ID[id].name)}</button>`).join('') + '<button class="btn small ghost" data-action="cancelReplace">Cancel</button>';
        rep.classList.remove('hidden');
      });
      wrap.appendChild(card);
      return card;
    });
    this.show('relic');
    setTimeout(() => cards.forEach((c) => c.classList.remove('locked')), 380);
  }

  showShrine(options, gold, cb) {
    this.shrineCb = cb;
    $('shrine-gold').textContent = gold;
    $('shrine-cards').innerHTML = options.map((o) => `<div class="card shrine-card" style="--rc:#ffd36b">
      <div class="c-icon">${o.icon}</div><div class="c-name">${esc(o.name)}</div>
      <div class="risk">⚠ ${esc(o.risk)}</div><div class="reward">✦ ${esc(o.reward)}</div>
      <button class="btn small" data-action="accept" data-id="${o.id}" ${o.disabled ? 'disabled' : ''}>${o.disabled ? 'Not enough gold' : 'Accept'}</button></div>`).join('');
    this.show('shrine');
  }

  showSupply(items, gold, cb) {
    this.supplyCb = cb;
    $('supply-gold').textContent = gold;
    $('supply-list').innerHTML = items.map((it) => `<div class="supply-item"><span class="s-ico">${it.icon}</span><div><b>${esc(it.name)}</b><div class="muted small">${esc(it.desc)}</div></div>
      <button class="btn small" data-action="buy" data-id="${it.id}" ${it.disabled ? 'disabled' : ''}>🪙 ${it.cost}</button></div>`).join('');
    if (this.current !== 'supply') this.show('supply');
  }

  showEnd(victory, sm, g) {
    const t = $('end-title');
    const endless = sm.mode === 'endless';
    t.textContent = victory ? 'Victory' : endless ? 'The Rift Endures' : 'Defeated';
    t.className = `end-title ${victory ? 'victory' : 'defeat'}`;
    $('end-sub').textContent = victory
      ? `The Rift Guardian has fallen on ${sm.diff.name}.${g.meta.data.wins === 1 ? ' Endless Mode and Nightmare are now unlocked!' : ''}`
      : endless ? `You survived ${sm.wave - 1} endless waves.${sm.newRecord ? ' 🏆 New personal record!' : ''}` : `The rift claimed you on wave ${sm.wave}.`;
    const stats = [
      ['Time survived', fmtTime(sm.time)],
      ['Wave reached', endless ? `${sm.wave}` : `${sm.wave} / 10`],
      ['Enemies defeated', sm.kills],
      ['Level reached', sm.level],
      ['Damage dealt', Math.round(sm.damage).toLocaleString()],
      ['Elites & bosses', sm.elites],
      ['Character', sm.cls],
      ['Arena', sm.arena],
      ['Difficulty', sm.diff.name],
      ['Shards earned', `💎 ${sm.shards}`, 'gold'],
    ];
    if (endless) stats.push(['Best endless wave', sm.records.endlessWave, 'gold']);
    $('end-stats').innerHTML = stats.map(([k, v, c]) => `<div class="stat ${c || ''}"><div class="k">${k}</div><div class="v">${v}</div></div>`).join('');
    $('end-objectives').innerHTML = sm.objectives.map((o) => `<div class="obj ${o.done ? 'done' : 'failed'}">${o.done ? '✔' : '✖'} ${esc(o.text)} ${o.done ? `<b>+${o.reward}💎</b>` : ''}</div>`).join('');
    $('end-upgrades').innerHTML = this.buildChips(g);
    this.show('end');
  }

  confirm(title, text) {
    $('confirm-title').textContent = title;
    $('confirm-text').textContent = text;
    this.show('confirm');
  }

  setFps(visible, fps) {
    this.el.fps.classList.toggle('hidden', !visible);
    if (visible) this.el.fps.textContent = `${fps} fps`;
  }
}
