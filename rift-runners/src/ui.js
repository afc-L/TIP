import { RARITY, WEAPONS } from './config.js';
import { UPGRADE_BY_ID, SYNERGIES } from './upgrades.js';
import { SHOP } from './meta.js';

const $ = (id) => document.getElementById(id);

export function fmtTime(s) {
  s = Math.max(0, Math.floor(s));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

// All DOM work lives here. The game calls in; button presses go out through onAction.
export class UI {
  constructor() {
    this.screens = ['menu', 'shop', 'howto', 'settings', 'levelup', 'pause', 'confirm', 'end'];
    this.current = null;
    this.onAction = () => {};
    this.cache = {};
    this.el = {
      hud: $('hud'), hpFill: $('hp-fill'), hpText: $('hp-text'), shieldFill: $('shield-fill'), xpFill: $('xp-fill'),
      lvl: $('lvl-text'), wave: $('wave-text'), waveSub: $('wave-sub'), waveFill: $('wave-fill'),
      bossBar: $('boss-bar'), bossName: $('boss-name'), bossFill: $('boss-fill'),
      timer: $('timer'), shards: $('shard-text'), mute: $('btn-mute'), pause: $('btn-pause'),
      slots: $('slots'), icons: $('upgrade-icons'), fps: $('fps'), vignette: $('hurt-vignette'),
      announce: $('announce'), toasts: $('toasts'), cards: $('cards'), particles: $('menu-particles'),
    };

    for (const name of this.screens) {
      const root = $(`screen-${name}`);
      root.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (btn && !btn.disabled) this.onAction(name, btn.dataset.action, btn);
      });
    }
    this.el.pause.addEventListener('click', () => this.onAction('hud', 'pause'));
    this.el.mute.addEventListener('click', () => this.onAction('hud', 'mute'));

    this.buildSlots();
    this.buildMenuParticles();
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

  renderMenuStats(meta) {
    const d = meta.data;
    $('menu-stats').innerHTML = `<span>💎 ${d.shards} shards</span><span>Runs: ${d.runs}</span><span>Wins: ${d.wins}</span><span>Best wave: ${d.bestWave || '—'}</span>`;
  }

  renderShop(meta) {
    $('shop-shards').textContent = meta.data.shards;
    const grid = $('shop-grid');
    grid.innerHTML = '';
    for (const item of SHOP) {
      const lvl = meta.level(item.id);
      const cost = meta.cost(item.id);
      const div = document.createElement('div');
      div.className = 'shop-item';
      const pips = Array.from({ length: item.max }, (_, i) => `<div class="pip ${i < lvl ? 'on' : ''}"></div>`).join('');
      div.innerHTML = `
        <div class="top"><div class="icon">${item.icon}</div><div><div class="name">${item.name}</div><div class="desc">${item.desc} per rank</div></div></div>
        <div class="pips">${pips}</div>`;
      const btn = document.createElement('button');
      btn.className = 'btn small';
      btn.dataset.action = 'buy';
      btn.dataset.id = item.id;
      if (cost === null) { btn.textContent = 'Maxed'; btn.disabled = true; }
      else { btn.textContent = `Buy · 💎 ${cost}`; btn.disabled = meta.data.shards < cost; }
      div.appendChild(btn);
      grid.appendChild(div);
    }
  }

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
    bind('set-autofire', 'autofire');
    bind('set-fps', 'showFps');
    bind('set-quality', 'quality', 'value');
  }

  syncSettings(settings) {
    $('set-muted').checked = settings.muted;
    this.el.mute.textContent = settings.muted ? '🔇' : '🔊';
  }

  buildSlots() {
    const mk = (id, icon, label, ability) => {
      const d = document.createElement('div');
      d.className = `slot${ability ? ' ability' : ''}`;
      d.innerHTML = `${icon}<div class="cd"></div><div class="lv"></div><div class="lbl">${label}</div>`;
      d.dataset.id = id;
      this.el.slots.appendChild(d);
      return d;
    };
    this.slotEls = {
      bolt: mk('bolt', WEAPONS.bolt.icon, 'LMB'),
      arc: mk('arc', WEAPONS.arc.icon, 'LMB'),
      orb: mk('orb', WEAPONS.orb.icon, 'LMB'),
      dash: mk('dash', '💨', 'Space', true),
      pulse: mk('pulse', '🌀', 'Shift', true),
    };
    for (const [id, el] of Object.entries(this.slotEls)) {
      el.title = { bolt: 'Rift Bolt', arc: 'Arc Burst (unlock via upgrade)', orb: 'Void Orb (unlock via upgrade)', dash: 'Dash', pulse: 'Rift Pulse' }[id];
    }
  }

  set(key, el, prop, value) {
    if (this.cache[key] === value) return;
    this.cache[key] = value;
    if (prop === 'text') el.textContent = value;
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
    this.set('shards', el.shards, 'text', String(g.meta.data.shards + Math.floor(run.shards)));

    const w = g.waves;
    this.set('wave', el.wave, 'text', `WAVE ${w.wave} / 10`);
    let sub, frac;
    if (w.state === 'boss') {
      sub = 'Defeat the Rift Guardian';
      frac = g.boss.e ? 1 - g.boss.e.hp / g.boss.e.maxHp : 1;
    } else if (w.state === 'break') {
      sub = `Next wave in ${Math.ceil(w.breakT)}…`;
      frac = 1;
    } else {
      sub = `${w.remaining} enemies remaining`;
      frac = w.quota ? w.killed / w.quota : 0;
    }
    this.set('wsub', el.waveSub, 'text', sub);
    this.set('wfill', el.waveFill, 'width', `${(frac * 100).toFixed(1)}%`);

    // Top bar for the boss or an active miniboss
    let big = null;
    if (g.boss.active && g.boss.e) big = { name: 'The Rift Guardian', hp: g.boss.e.hp, max: g.boss.e.maxHp, p2: g.boss.phase === 2 };
    else {
      const mb = g.enemies.list.find((e) => e.miniboss && !e.dead);
      if (mb) big = { name: mb.name, hp: mb.hp, max: mb.maxHp, p2: false };
    }
    el.bossBar.classList.toggle('hidden', !big);
    if (big) {
      this.set('bname', el.bossName, 'text', big.name);
      this.set('bfill', el.bossFill, 'width', `${(Math.max(0, big.hp) / big.max * 100).toFixed(1)}%`);
      el.bossBar.classList.toggle('phase2', big.p2);
    }

    // Weapon / ability slots
    const s = g.stats, c = g.combat;
    const slot = (id, owned, lvl, cdFrac) => {
      const e = this.slotEls[id];
      e.classList.toggle('empty', !owned);
      const cd = e.querySelector('.cd');
      this.set(`sc${id}`, cd, 'height', `${owned ? Math.round(cdFrac * 100) : 0}%`);
      const lv = e.querySelector('.lv');
      this.set(`sl${id}`, lv, 'text', owned && lvl ? `${lvl}` : '');
      e.classList.toggle('ready', owned && cdFrac <= 0);
    };
    slot('bolt', true, 0, c.cd.bolt / c.weaponCooldown('bolt'));
    slot('arc', s.arc > 0, s.arc, s.arc ? c.cd.arc / c.weaponCooldown('arc') : 0);
    slot('orb', s.orb > 0, s.orb, s.orb ? c.cd.orb / c.weaponCooldown('orb') : 0);
    slot('dash', true, 0, p.dashCd / (1.5 * s.dashCdMult));
    slot('pulse', true, 0, p.pulseCd / 10);

    const low = p.hp / p.maxHp < 0.3 && p.alive;
    el.vignette.classList.toggle('low', low);
    if (!low) el.vignette.style.opacity = String(Math.min(0.9, g.effects.flash));
    else el.vignette.style.removeProperty('opacity');
  }

  renderUpgradeIcons(levels, synergies) {
    const html = [];
    for (const [id, l] of Object.entries(levels)) {
      const u = UPGRADE_BY_ID[id];
      if (!u) continue;
      html.push(`<div class="uicon" style="--rc:${RARITY[u.rarity].color}" title="${u.name} (Lv ${l})">${u.icon}<i>${l}</i></div>`);
    }
    for (const id of synergies) {
      const s = SYNERGIES.find((x) => x.id === id);
      html.push(`<div class="uicon" style="--rc:#ffb547" title="Synergy: ${s.name}">✨</div>`);
    }
    this.el.icons.innerHTML = html.join('');
    $('pause-build').innerHTML = this.buildChips(levels, synergies);
  }

  buildChips(levels, synergies) {
    const chips = Object.entries(levels).map(([id, l]) => {
      const u = UPGRADE_BY_ID[id];
      return u ? `<span class="chip" style="border-color:${RARITY[u.rarity].color}">${u.icon} ${u.name} <b>${l}</b></span>` : '';
    });
    for (const id of synergies) {
      const s = SYNERGIES.find((x) => x.id === id);
      chips.push(`<span class="chip syn">✨ ${s.name}</span>`);
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
  }

  showLevelUp(choices, levels, pending, onPick) {
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
      card.innerHTML = `
        <div class="key">${i + 1}</div>
        <div class="rarity">${rar.label}${u.weapon ? ' · Weapon' : ''}</div>
        <div class="c-icon">${u.icon}</div>
        <div class="c-name">${u.name}</div>
        <div class="c-level">${u.filler ? 'Instant' : lvl === 1 ? 'NEW' : `Level ${lvl - 1} → ${lvl}`} ${u.max ? `<span class="muted">(max ${u.max})</span>` : ''}</div>
        <div class="c-desc">${u.desc(lvl)}</div>
        ${syn.length ? `<div class="c-syn">✨ Synergy: ${syn.join(', ')}</div>` : ''}`;
      card.addEventListener('click', () => onPick(i));
      wrap.appendChild(card);
      return card;
    });
    this.show('levelup');
    // Short lockout so a held/spammed click while fighting doesn't pick blindly.
    setTimeout(() => this.cardEls.forEach((c) => c.classList.remove('locked')), 380);
  }

  showEnd(victory, summary, levels, synergies) {
    const t = $('end-title');
    t.textContent = victory ? 'Victory' : 'Defeated';
    t.className = `end-title ${victory ? 'victory' : 'defeat'}`;
    $('end-sub').textContent = victory
      ? 'The Rift Guardian has fallen. The runner breaks free… for now.'
      : `The rift claimed you on wave ${summary.wave}.`;
    const stats = [
      ['Time survived', fmtTime(summary.time)],
      ['Wave reached', `${summary.wave} / 10`],
      ['Enemies defeated', summary.kills],
      ['Level reached', summary.level],
      ['Damage dealt', Math.round(summary.damage).toLocaleString()],
      ['Elites slain', summary.elites],
      ['Upgrades chosen', summary.picks],
      ['Shards earned', `💎 ${summary.shards}`, 'gold'],
    ];
    $('end-stats').innerHTML = stats.map(([k, v, c]) => `<div class="stat ${c || ''}"><div class="k">${k}</div><div class="v">${v}</div></div>`).join('');
    $('end-upgrades').innerHTML = this.buildChips(levels, synergies);
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
