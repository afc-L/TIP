// DOM helpers: screens, modals, toasts and tooltips.
(function () {
  const RW = window.RW;
  const U = RW.util;

  const ui = {
    init() {
      this.screens = document.getElementById('screens');
      this.hud = document.getElementById('hud');
      this.modalRoot = document.getElementById('modal');
      this.tipEl = document.getElementById('tooltip');
      this.toasts = document.getElementById('toasts');
      // Tooltips via delegation: [data-tip] (static html) or element._tip (function returning html).
      document.addEventListener('mouseover', (e) => {
        if (!RW.settings.tooltips) return;
        const el = e.target.closest && e.target.closest('[data-tip], .has-tip');
        if (!el) { this.hideTip(); return; }
        const html = el._tip ? el._tip() : el.dataset.tip;
        if (!html) { this.hideTip(); return; }
        this.tipEl.innerHTML = html;
        this.tipEl.classList.add('show');
        this.tipTarget = el;
        this.placeTip(e.clientX, e.clientY);
      });
      document.addEventListener('mousemove', (e) => { if (this.tipEl.classList.contains('show')) this.placeTip(e.clientX, e.clientY); });
      document.addEventListener('mousedown', () => this.hideTip());
      // UI click sounds
      document.addEventListener('click', (e) => {
        RW.audio.init(); RW.audio.resume();
        if (e.target.closest && e.target.closest('button, .btn, .card, .choice')) RW.audio.play('click');
      }, true);
    },
    placeTip(x, y) {
      const t = this.tipEl, w = t.offsetWidth, h = t.offsetHeight;
      let left = x + 16, top = y + 18;
      if (left + w > window.innerWidth - 8) left = x - w - 12;
      if (top + h > window.innerHeight - 8) top = y - h - 12;
      t.style.left = Math.max(4, left) + 'px'; t.style.top = Math.max(4, top) + 'px';
    },
    hideTip() { this.tipEl.classList.remove('show'); this.tipTarget = null; },
    refreshTip() { if (this.tipTarget && this.tipTarget._tip && this.tipEl.classList.contains('show')) this.tipEl.innerHTML = this.tipTarget._tip(); },

    show(html) {
      this.hideTip();
      this.screens.innerHTML = '';
      if (!html) return null;
      const el = typeof html === 'string' ? U.html(html) : html;
      this.screens.appendChild(el);
      return el;
    },
    setHud(html) {
      this.hideTip();
      this.hud.innerHTML = '';
      if (!html) return null;
      const el = typeof html === 'string' ? U.html(html) : html;
      this.hud.appendChild(el);
      return el;
    },
    // Modal dialog. buttons: [{label, cls, onClick(close), keep}]
    modal({ title, body, buttons = [{ label: 'OK' }], cls = '', onClose }) {
      this.closeModal();
      const el = U.html(`<div class="modal-back"><div class="modal panel ${cls}"><h2>${title || ''}</h2><div class="modal-body"></div><div class="modal-buttons"></div></div></div>`);
      const bodyEl = el.querySelector('.modal-body');
      if (typeof body === 'string') bodyEl.innerHTML = body; else if (body) bodyEl.appendChild(body);
      const bar = el.querySelector('.modal-buttons');
      const close = () => { if (el.parentNode) el.parentNode.removeChild(el); if (this.current === el) this.current = null; if (onClose) onClose(); };
      for (const b of buttons) {
        const btn = U.html(`<button class="btn ${b.cls || ''}">${b.label}</button>`);
        if (b.tip) btn.dataset.tip = b.tip;
        if (b.disabled) btn.disabled = true;
        btn.addEventListener('click', () => { if (!b.keep) close(); if (b.onClick) b.onClick(close); });
        bar.appendChild(btn);
      }
      this.modalRoot.appendChild(el);
      this.current = el;
      el._close = close;
      return el;
    },
    closeModal() { if (this.current && this.current._close) this.current._close(); this.modalRoot.innerHTML = ''; this.current = null; },
    get modalOpen() { return !!this.modalRoot.children.length; },
    toast(text, kind = 'info', ms = 3200) {
      const el = U.html(`<div class="toast ${kind}">${text}</div>`);
      this.toasts.appendChild(el);
      while (this.toasts.children.length > 6) this.toasts.removeChild(this.toasts.firstChild);
      setTimeout(() => el.classList.add('fade'), ms);
      setTimeout(() => el.remove(), ms + 600);
    },
    emblem(fid, size = 40) {
      const e = RW.data.EMBLEMS[fid];
      return `<span class="emblem" style="width:${size}px;height:${size}px">${e ? e() : ''}</span>`;
    },
    bar(frac, cls, label = '') {
      return `<div class="bar ${cls}"><div class="fill" style="width:${Math.round(U.clamp(frac, 0, 1) * 100)}%"></div>${label ? `<span>${label}</span>` : ''}</div>`;
    },
    // Unit stat tooltip.
    unitTip(typeId, extra = '') {
      const t = RW.data.UNITS[typeId];
      const row = (k, v) => `<tr><td>${k}</td><td>${v}</td></tr>`;
      return `<div class="tip-title">${RW.unitIcon(typeId)} ${t.name}</div><div class="tip-sub">${RW.catName[t.cat]} · ${RW.data.FACTIONS[t.faction].short}${t.tier > 1 ? ' · Tier ' + t.tier : ''}</div>
        <div class="tip-desc">${t.desc}</div>
        <table class="stats">${row('Soldiers', t.count)}${row('Health', Math.round(t.hp) + ' each')}${row('Melee attack', t.atk)}${row('Melee defence', t.def)}${row('Weapon damage', Math.round(t.dmg) + (t.ap ? ` (${Math.round(t.ap * 100)}% AP)` : ''))}${row('Armour', t.armor)}${row('Charge bonus', t.charge)}${row('Speed', t.speed)}${row('Morale', t.morale)}
        ${t.range ? row('Range', t.range) + row('Ammunition', t.ammo) + row('Missile damage', t.rdmg + (t.splash ? ' · splash' : '')) : ''}</table>
        <div class="tip-tags">${[t.large && 'Large', t.antiLarge && 'Bonus vs Large', t.shield && 'Shield', t.fear && 'Causes Fear', t.regen && 'Regenerates', t.cleave > 1 && 'Cleaving blows', t.morale >= 100 && 'Unbreakable'].filter(Boolean).map((x) => `<span>${x}</span>`).join('')}</div>
        ${t.cost ? `<div class="tip-cost">${RW.icon('gold', 'gold')} ${t.cost} recruit · ${t.upkeep} upkeep/turn</div>` : ''}${extra}`;
    },
    abilityTip(id, cd) {
      const a = RW.data.ABILITIES[id];
      return `<div class="tip-title">${RW.icon(a.icon)} ${a.name}</div><div class="tip-desc">${a.desc}</div><div class="tip-sub">Cooldown ${Math.round(cd || a.cd)}s · ${a.target === 'point' ? 'Target an area (radius ' + a.radius + 'm)' : 'Instant'}</div>`;
    },
  };
  RW.ui = ui;
})();
