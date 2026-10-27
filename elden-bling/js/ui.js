// DOM-based HUD and menus.
import { WEAPONS, ARMOR, CONSUMABLES, FLASK, SHOP, CREDITS, SOCKS, REGION_BOSSES } from './data.js';
import { groundHeight, edgeDistance } from './collision.js';
import { SHRINES, BOSS_SPOTS } from './world.js';
import { PRESETS } from './settings.js';

const $ = (id) => document.getElementById(id);

export class UI {
  constructor(game) {
    this.game = game;
    this.stack = []; // open blocking screens
    this.cache = {};
    this.toastEl = $('toasts');
    this.subT = 0;
    this.tipT = 0;
    this.bannerT = 0;
    this.invTab = 'equip';
    this.bind();
  }

  // ---------- Screen stack ----------
  open(id) {
    const el = $(id);
    el.classList.remove('hidden');
    // Only the top screen is shown; the ones underneath wait their turn.
    for (const s of this.stack) if (s !== id) $(s).classList.add('covered');
    el.classList.remove('covered');
    this.stack = this.stack.filter((s) => s !== id);
    this.stack.push(id);
  }
  close(id) {
    $(id).classList.add('hidden');
    $(id).classList.remove('covered');
    this.stack = this.stack.filter((s) => s !== id);
    const top = this.stack[this.stack.length - 1];
    if (top) $(top).classList.remove('covered');
  }
  closeTop() {
    const top = this.stack[this.stack.length - 1];
    if (top) this.close(top);
    return top;
  }
  isOpen(id) { return this.stack.includes(id); }
  get blocking() { return this.stack.length > 0; }

  bind() {
    const g = this.game;
    const click = (id, fn) => $(id).addEventListener('click', () => { g.audio.play('ui'); fn(); });
    click('btn-play', () => g.newGame());
    click('btn-continue', () => g.continueGame());
    click('btn-settings', () => this.openSettings());
    click('btn-credits', () => { $('credits-body').innerHTML = CREDITS; this.open('credits'); });
    click('btn-credits-back', () => this.close('credits'));
    click('btn-resume', () => g.resume());
    click('btn-pause-settings', () => this.openSettings());
    click('btn-pause-controls', () => this.open('controls-screen'));
    click('btn-controls-back', () => this.close('controls-screen'));
    click('btn-quit', () => g.quitToMenu());
    click('btn-settings-back', () => this.closeSettings());
    click('btn-inv-close', () => g.closeMenus());
    click('btn-shrine-leave', () => g.closeMenus());
    click('btn-shop-leave', () => g.closeMenus());
    click('btn-map-close', () => g.closeMenus());
    click('btn-victory-continue', () => g.keepExploring());
    click('btn-victory-menu', () => g.quitToMenu());
    click('btn-death-skip', () => g.respawn());
    document.querySelectorAll('#inventory .tabs button').forEach((b) => b.addEventListener('click', () => { this.invTab = b.dataset.tab; this.renderInventory(); g.audio.play('ui'); }));

    // Settings controls.
    const s = g.settings;
    const range = (id, key, fmt = (v) => Math.round(v * 100) + '%') => {
      const el = $(id);
      el.value = s[key];
      const out = el.parentElement.querySelector('output');
      const show = () => { if (out) out.textContent = fmt(Number(el.value)); };
      show();
      el.addEventListener('input', () => { s[key] = Number(el.value); show(); g.applySettings(key); });
    };
    range('set-master', 'master');
    range('set-music', 'music');
    range('set-sfx', 'sfx');
    range('set-scale', 'renderScale');
    range('set-sens', 'sensitivity', (v) => v.toFixed(1) + 'x');
    const check = (id, key) => {
      const el = $(id);
      el.checked = !!s[key];
      el.addEventListener('change', () => { s[key] = el.checked; g.applySettings(key); });
    };
    check('set-mute', 'muted');
    check('set-invert', 'invertY');
    check('set-fps', 'showFps');
    check('set-guide', 'showControls');
    check('set-auto', 'autoAdjust');
    check('set-shadows', 'shadows');
    const presetBox = $('set-preset');
    for (const k in PRESETS) {
      const b = document.createElement('button');
      b.textContent = PRESETS[k].label;
      b.dataset.p = k;
      b.addEventListener('click', () => { g.setPreset(k); this.syncSettings(); g.audio.play('ui'); });
      presetBox.appendChild(b);
    }
    this.syncSettings();
  }

  syncSettings() {
    const s = this.game.settings;
    document.querySelectorAll('#set-preset button').forEach((b) => b.classList.toggle('on', b.dataset.p === s.preset));
    $('set-scale').value = s.renderScale;
    $('set-scale').parentElement.querySelector('output').textContent = Math.round(s.renderScale * 100) + '%';
    $('set-shadows').checked = s.shadows;
    $('set-mute').checked = s.muted;
    $('restart-note').classList.toggle('hidden', !this.game.needsReload);
  }

  openSettings() { this.syncSettings(); this.open('settings'); }
  closeSettings() { this.close('settings'); this.game.saveSettingsNow(); }

  // ---------- Main menu ----------
  showMainMenu(hasSave) {
    $('btn-continue').classList.toggle('hidden', !hasSave);
    $('btn-play').textContent = hasSave ? 'New Game' : 'Play';
    this.open('main-menu');
  }

  // ---------- HUD ----------
  showHUD(on) { $('hud').classList.toggle('hidden', !on); }

  setWidth(id, frac) {
    const v = Math.max(0, Math.min(1, frac));
    const k = Math.round(v * 1000);
    if (this.cache[id] === k) return;
    this.cache[id] = k;
    $(id).style.transform = `scaleX(${v})`;
  }

  setText(id, text) {
    if (this.cache['t' + id] === text) return;
    this.cache['t' + id] = text;
    $(id).textContent = text;
  }

  setHTML(id, html) {
    if (this.cache['h' + id] === html) return;
    this.cache['h' + id] = html;
    $(id).innerHTML = html;
  }

  updateHUD(dt) {
    const g = this.game, p = g.player;
    // Bar width grows with max stats, like the real thing.
    const hpW = 200 + p.stats.vig * 12, stW = 170 + p.stats.end * 10;
    if (this.cache.hpW !== hpW) { this.cache.hpW = hpW; $('hp-bar').style.width = hpW + 'px'; }
    if (this.cache.stW !== stW) { this.cache.stW = stW; $('sta-bar').style.width = stW + 'px'; }
    const hpF = p.hp / p.maxHp;
    this.setWidth('hp-fill', hpF);
    this.hpLag = this.hpLag === undefined ? hpF : this.hpLag > hpF ? Math.max(hpF, this.hpLag - dt * 0.35) : hpF;
    this.setWidth('hp-lag', this.hpLag);
    this.setWidth('sta-fill', p.sta / p.maxSta);
    this.setWidth('xp-fill', p.stats.xp / p.xpNeed);
    this.setText('hud-level', 'Lv ' + p.stats.level);
    this.setText('hp-text', Math.ceil(Math.max(0, p.hp)) + ' / ' + p.maxHp);
    $('hud-levelup').classList.toggle('hidden', p.stats.xp < p.xpNeed);
    this.setText('coins', String(p.coins));
    this.setText('q-flask', String(p.flasks));
    for (const k of ['garlic', 'dignity', 'pepper', 'coconut', 'bomb', 'firebomb', 'mushroom', 'candy']) this.setText('q-' + k, String(p.inv.items[k] || 0));
    this.setText('q-medal', String(g.flags.medallions || 0));
    let buffs = '';
    if (p.buffs.pepper > 0) buffs += `<span class="buff pepper">Rage ${Math.ceil(p.buffs.pepper)}s</span>`;
    if (p.buffs.dignity > 0) buffs += `<span class="buff dignity">Dignity ${Math.ceil(p.buffs.dignity)}s</span>`;
    if (p.poison > 0) buffs += '<span class="buff poison">Poisoned</span>';
    if (p.chill > 0) buffs += '<span class="buff chill">Chilled</span>';
    if (p.burn > 0) buffs += '<span class="buff burn">Burning</span>';
    this.setHTML('buffs', buffs);

    if (g.boss) {
      const f = Math.max(0, g.boss.hp / g.boss.maxHp);
      this.setWidth('boss-fill', f);
      this.bossLag = this.bossLag === undefined ? f : this.bossLag > f ? Math.max(f, this.bossLag - dt * 0.25) : f;
      this.setWidth('boss-lag', this.bossLag);
    }

    if (this.subT > 0) { this.subT -= dt; if (this.subT <= 0) $('subtitle').classList.remove('show'); }
    if (this.tipT > 0) { this.tipT -= dt; if (this.tipT <= 0) $('tip').classList.remove('show'); }
    if (this.bannerT > 0) { this.bannerT -= dt; if (this.bannerT <= 0) $('banner').classList.remove('show'); }
    if (this.dmgFlash > 0) { this.dmgFlash -= dt; $('vignette').style.opacity = String(Math.max(0, this.dmgFlash * 2.5)); }
    $('poison-vignette').style.opacity = p.poison > 0 ? '0.6' : '0';
    $('low-hp').style.opacity = p.alive && hpF < 0.3 ? String(0.5 + Math.sin(performance.now() / 200) * 0.2) : '0';
  }

  flashDamage() { this.dmgFlash = 0.35; }

  prompt(text) {
    const html = text ? `<kbd>E</kbd> ${text}` : '';
    this.setHTML('prompt', html);
    $('prompt').classList.toggle('show', !!text);
  }

  toast(msg, cls = '') {
    const el = document.createElement('div');
    el.className = 'toast ' + cls;
    el.innerHTML = msg;
    this.toastEl.appendChild(el);
    while (this.toastEl.children.length > 5) this.toastEl.removeChild(this.toastEl.firstChild);
    setTimeout(() => el.classList.add('out'), 3200);
    setTimeout(() => el.remove(), 3800);
  }

  banner(text, sub = '') {
    $('banner').innerHTML = `<div class="t">${text}</div>${sub ? `<div class="s">${sub}</div>` : ''}`;
    $('banner').classList.add('show');
    this.bannerT = 3.2;
  }

  subtitle(name, text, dur = 3) {
    $('subtitle').innerHTML = `<b>${name}:</b> ${text}`;
    $('subtitle').classList.add('show');
    this.subT = dur;
  }

  tip(html, dur = 8) {
    $('tip').innerHTML = `<span class="tip-h">Tip</span> ${html}`;
    $('tip').classList.add('show');
    this.tipT = dur;
  }

  quest(main, side) {
    this.setHTML('quest-main', main);
    this.setHTML('quest-side', side || '');
  }

  bossBar(boss) {
    $('boss-bar').classList.toggle('hidden', !boss);
    if (boss) { $('boss-name').textContent = boss.def.name; this.bossLag = 1; this.setWidth('boss-lag', 1); this.setWidth('boss-fill', 1); }
  }

  bossTitle(name, title) {
    $('boss-title').innerHTML = `<div class="n">${name}</div><div class="s">${title}</div>`;
    $('boss-title').classList.add('show');
    setTimeout(() => $('boss-title').classList.remove('show'), 3600);
  }

  showControlsGuide(on) { $('controls-guide').classList.toggle('hidden', !on); }

  setFps(on, fps) {
    $('fps').classList.toggle('hidden', !on);
    if (on) this.setText('fps', fps + ' FPS');
  }

  lockReticle(pos) {
    const el = $('lock-reticle');
    if (!pos) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    el.style.transform = `translate(${pos[0]}px, ${pos[1]}px) translate(-50%, -50%)`;
  }

  // ---------- Death / victory ----------
  death(on, line) {
    if (on) { $('death-line').textContent = line; $('banner').classList.remove('show'); this.bannerT = 0; this.open('death'); }
    else this.close('death');
  }

  victory(stats) {
    $('victory-stats').innerHTML = stats;
    this.open('victory');
  }

  // ---------- Dialogue ----------
  dialogue(name, text, choices = null) {
    const g = this.game;
    $('dlg-name').textContent = name;
    $('dlg-text').innerHTML = text;
    const box = $('dlg-choices');
    box.innerHTML = '';
    const list = choices || [{ label: 'Continue', fn: null }];
    for (const c of list) {
      const b = document.createElement('button');
      b.textContent = c.label;
      b.addEventListener('click', () => { g.audio.play('ui'); this.close('dialogue'); if (c.fn) c.fn(); if (!this.blocking) g.closeMenus(); });
      box.appendChild(b);
    }
    g.openMenu('dialogue');
  }

  // ---------- Inventory ----------
  renderInventory() {
    const g = this.game, p = g.player;
    document.querySelectorAll('#inventory .tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === this.invTab));
    const dmg = Math.round(p.weapon.dmg * (1 + p.stats.str * 0.08));
    $('inv-stats').innerHTML = `
      <div class="stat-row"><span>Level</span><b>${p.stats.level}</b></div>
      <div class="stat-row"><span>XP</span><b>${Math.floor(p.stats.xp)} / ${p.xpNeed}</b></div>
      <div class="stat-row"><span>Vigor</span><b>${p.stats.vig}</b></div>
      <div class="stat-row"><span>Endurance</span><b>${p.stats.end}</b></div>
      <div class="stat-row"><span>Strength</span><b>${p.stats.str}</b></div>
      <hr>
      <div class="stat-row"><span>Health</span><b>${Math.ceil(p.hp)} / ${p.maxHp}</b></div>
      <div class="stat-row"><span>Stamina</span><b>${p.maxSta}</b></div>
      <div class="stat-row"><span>Attack</span><b>${dmg}</b></div>
      <div class="stat-row"><span>Defense</span><b>${Math.round(p.defense * 100)}%</b></div>
      <div class="stat-row"><span>Coins</span><b>${p.coins}</b></div>
      <div class="stat-row"><span>Dignity</span><b>${g.stats.deaths > 3 ? '0%' : '3%'}</b></div>`;
    const list = $('inv-list');
    list.innerHTML = '';
    const item = (title, desc, meta, btn, onClick, equipped) => {
      const d = document.createElement('div');
      d.className = 'item' + (equipped ? ' equipped' : '');
      d.innerHTML = `<div class="item-h"><b>${title}</b><span class="meta">${meta}</span></div><div class="desc">${desc}</div>`;
      if (btn) {
        const b = document.createElement('button');
        b.textContent = btn;
        b.addEventListener('click', () => { onClick(); g.audio.play('ui'); this.renderInventory(); });
        d.querySelector('.item-h').appendChild(b);
      }
      list.appendChild(d);
    };
    if (this.invTab === 'equip') {
      const w = p.weapon;
      item('Weapon: ' + w.name, w.desc, `DMG ${w.dmg} · SPD ${w.speed}`, null, null, true);
      for (const slot of ['head', 'body']) {
        const a = p.equip[slot] ? ARMOR[p.equip[slot]] : null;
        item((slot === 'head' ? 'Head: ' : 'Body: ') + (a ? a.name : 'Nothing'), a ? a.desc : 'Just vibes.', a ? `DEF ${Math.round(a.def * 100)}%` : '', a ? 'Unequip' : null, () => { p.equip[slot] = null; p.refreshEquip(); }, !!a);
      }
      item(FLASK.name + ` (${p.flasks}/${p.maxFlasks})`, FLASK.desc, 'Q', null, null, false);
    } else if (this.invTab === 'weapons') {
      for (const id of p.inv.weapons) {
        const w = WEAPONS[id];
        const eq = p.equip.weapon === id;
        item(w.name, w.desc, `DMG ${w.dmg} · SPD ${w.speed}${w.stagger ? ' · Stagger' : ''}`, eq ? null : 'Equip', () => { p.equip.weapon = id; p.refreshEquip(); }, eq);
      }
    } else if (this.invTab === 'armor') {
      if (!p.inv.armor.length) list.innerHTML = '<p class="empty">No armor yet. You are wearing optimism.</p>';
      for (const id of p.inv.armor) {
        const a = ARMOR[id];
        const eq = p.equip[a.slot] === id;
        item(a.name, a.desc, `${a.slot.toUpperCase()} · DEF ${Math.round(a.def * 100)}%`, eq ? 'Unequip' : 'Equip', () => { p.equip[a.slot] = eq ? null : id; p.refreshEquip(); }, eq);
      }
    } else {
      let any = false;
      for (const id in CONSUMABLES) {
        const n = p.inv.items[id] || 0;
        if (!n) continue;
        any = true;
        const c = CONSUMABLES[id];
        item(`${c.name} ×${n}`, c.desc, `Key ${c.key}`, 'Use', () => g.useItem(id), false);
      }
      if (g.flags.hasChicken && !g.flags.chickenReturned) item('Nugget (Chicken)', 'Currently sitting on your head. Judging you. Return her to Farmer Dennis.', 'Quest', null, null, false);
      if (g.flags.medallions) item(`Bling Medallion ×${g.flags.medallions}`, 'Heavy, shiny, and slightly sticky. Three of them open the fog to Lord Touchgrass.', 'Key item', null, null, false);
      const socks = Object.keys(g.flags.socks || {}).length;
      if (socks) item(`Lost Socks ×${socks}`, 'None of them match. Sockrates, in the grasslands, collects them.', 'Key item', null, null, false);
      if (!any) list.insertAdjacentHTML('afterbegin', '<p class="empty">No consumables. Barry sells some, allegedly.</p>');
    }
  }

  // ---------- Shrine / level up ----------
  renderShrine(shrine) {
    const g = this.game, p = g.player;
    $('shrine-name').textContent = shrine.name;
    const need = p.xpNeed;
    const can = p.stats.xp >= need;
    const stats = [
      ['vig', 'Vigor', `+14 max HP (now ${p.maxHp})`],
      ['end', 'Endurance', `+10 max stamina (now ${p.maxSta})`],
      ['str', 'Strength', `+8% damage (now +${p.stats.str * 8}%)`],
    ];
    let html = `<p class="lvl-info">Level <b>${p.stats.level}</b> · XP <b>${Math.floor(p.stats.xp)}</b> / ${need} needed for the next level</p>`;
    html += stats.map(([k, n, d]) => `<div class="lvl-row"><div><b>${n}</b> <span class="v">${p.stats[k]}</span><div class="desc">${d}</div></div><button data-stat="${k}" ${can ? '' : 'disabled'}>+ Level</button></div>`).join('');
    $('shrine-level').innerHTML = html;
    $('shrine-level').querySelectorAll('button[data-stat]').forEach((b) => b.addEventListener('click', () => { g.levelUp(b.dataset.stat); this.renderShrine(shrine); }));
    const tr = $('shrine-travel');
    tr.innerHTML = '';
    for (const id in g.world.shrines) {
      const s = g.world.shrines[id];
      if (!g.flags.shrines[id] || id === shrine.id) continue;
      const b = document.createElement('button');
      b.textContent = 'Travel: ' + s.name;
      b.addEventListener('click', () => { g.audio.play('ui'); g.travel(s); });
      tr.appendChild(b);
    }
    if (!tr.children.length) tr.innerHTML = '<p class="empty">Discover more shrines to travel between them.</p>';
  }

  // ---------- Shop ----------
  renderShop(list = SHOP, title = "Barry's Bargain Bin") {
    const g = this.game, p = g.player;
    this.shopArgs = [list, title];
    $('shop-title').textContent = title;
    const box = $('shop-list');
    box.innerHTML = `<p class="lvl-info">Your coins: <b>${p.coins}</b></p>`;
    for (const s of list) {
      const sold = s.once && g.flags.bought[s.id];
      const data = s.kind === 'consumable' ? CONSUMABLES[s.id] : s.kind === 'armor' ? ARMOR[s.id] : s.kind === 'weapon' ? WEAPONS[s.id] : s;
      const d = document.createElement('div');
      d.className = 'item';
      d.innerHTML = `<div class="item-h"><b>${data.name}</b><span class="meta">${sold ? 'SOLD OUT' : s.price + ' coins'}</span></div><div class="desc">${data.desc}</div>`;
      if (!sold) {
        const b = document.createElement('button');
        b.textContent = 'Buy';
        b.disabled = p.coins < s.price;
        b.addEventListener('click', () => { g.buy(s); this.renderShop(...this.shopArgs); });
        d.querySelector('.item-h').appendChild(b);
      }
      box.appendChild(d);
    }
  }

  // ---------- World map ----------
  renderMap() {
    const g = this.game, W = g.world;
    const X0 = -264, X1 = 264, Z0 = -194, Z1 = 150, S = 1.25; // metres per pixel
    const w = Math.round((X1 - X0) / S), h = Math.round((Z1 - Z0) / S);
    const cv = $('map-canvas');
    if (!this.mapBase) {
      // Paint the terrain once and keep it.
      const base = document.createElement('canvas');
      base.width = w; base.height = h;
      const ctx = base.getContext('2d');
      const img = ctx.createImageData(w, h);
      const c = { setHex(v) { this.r = (v >> 16) / 255; this.g = ((v >> 8) & 255) / 255; this.b = (v & 255) / 255; return this; }, offsetHSL() { return this; }, lerp(o, t) { this.r += (o.r - this.r) * t; this.g += (o.g - this.g) * t; this.b += (o.b - this.b) * t; return this; } };
      for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
        const x = X0 + px * S, z = Z0 + py * S;
        const y = groundHeight(x, z);
        const k = (py * w + px) * 4;
        if (y < -0.9 && z > 120 && Math.abs(x) < 110) { img.data[k] = 50; img.data[k + 1] = 130; img.data[k + 2] = 190; img.data[k + 3] = 255; continue; }
        const e = edgeDistance(x, z);
        if (e > 1) { const v = Math.max(40, 110 - e * 2); img.data[k] = v; img.data[k + 1] = v * 0.95; img.data[k + 2] = v * 0.85; img.data[k + 3] = 255; continue; }
        W.groundColor(x, y, z, c, 0.5);
        const shade = 0.85 + Math.min(0.25, y * 0.05);
        img.data[k] = c.r * 255 * shade; img.data[k + 1] = c.g * 255 * shade; img.data[k + 2] = c.b * 255 * shade; img.data[k + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      // Walls and big obstacles.
      ctx.fillStyle = 'rgba(40,30,20,0.85)';
      for (const b of W.col.boxes) {
        if (!b.cam || b.maxX - b.minX > 200) continue;
        ctx.fillRect((b.minX - X0) / S, (b.minZ - Z0) / S, Math.max(1, (b.maxX - b.minX) / S), Math.max(1, (b.maxZ - b.minZ) / S));
      }
      this.mapBase = base;
    }
    cv.width = w * 2; cv.height = h * 2;
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.mapBase, 0, 0, w * 2, h * 2);
    const P = (x, z) => [((x - X0) / S) * 2, ((z - Z0) / S) * 2];
    // Gates that are now open.
    for (const id in W.gates) {
      const gt = W.gates[id];
      if (!gt.open) continue;
      const [a, b] = P(gt.box.minX, gt.box.minZ), [c2, d2] = P(gt.box.maxX, gt.box.maxZ);
      ctx.fillStyle = '#e8d8a0'; ctx.fillRect(a, b, c2 - a, d2 - b);
    }
    ctx.font = 'bold 22px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.globalAlpha = 0.75;
    const label = (t, x, z) => { let [px, pz] = P(x, z); const hw = ctx.measureText(t).width / 2 + 4; px = Math.max(hw, Math.min(cv.width - hw, px)); ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.strokeText(t, px, pz); ctx.fillStyle = '#fff4d0'; ctx.fillText(t, px, pz); };
    label('GRASSLANDS', 0, 50); label('CURSED SWAMP', 0, 0); label("KING'S BACKYARD", 0, -56);
    label('CRUNCHY DESERT', -110, 72); label('CHILLY PEAKS', 110, 72); label('BEACH OF REGRET', 0, 128);
    label('HAUNTED WOODS', -110, -78); label('MOUNT SLIGHTLY HOT', 110, -78); label('FUNGAL FUNHOUSE', -210, 90); label('CANDY KINGDOM', 210, 90);
    ctx.globalAlpha = 1;
    const dot = (x, z, color, r, ring) => { const [px, pz] = P(x, z); ctx.beginPath(); ctx.arc(px, pz, r, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); if (ring) { ctx.lineWidth = 2; ctx.strokeStyle = ring; ctx.stroke(); } };
    // Shrines: bright when discovered.
    for (const sh of SHRINES) dot(sh.x, sh.z, g.flags.shrines[sh.id] ? '#7dff8a' : 'rgba(120,160,120,0.6)', 7, '#0a2a0a');
    // Bosses.
    const bossDot = (x, z, dead, name, optional) => {
      dot(x, z, dead ? '#666' : optional ? '#e8902a' : '#d8342a', optional ? 8 : 10, '#000');
      const [px, pz] = P(x, z);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 13px system-ui, sans-serif'; ctx.fillText(dead ? '✓' : '!', px, pz + 5);
      ctx.font = '14px system-ui, sans-serif'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.strokeText(name, px, pz - 15); ctx.fillStyle = dead ? '#bbb' : '#ffd0c0'; ctx.fillText(name, px, pz - 15);
    };
    for (const id in BOSS_SPOTS) bossDot(BOSS_SPOTS[id][0], BOSS_SPOTS[id][1], !!g.flags.bosses[id], REGION_BOSSES[id].name.replace(/ \(.*\)$/, '').split(',')[0], REGION_BOSSES[id].optional);
    bossDot(0, -34, !!g.flags.miniDead, 'The Unemployed Knight');
    bossDot(0, -90, !!g.flags.bossDead, 'Lord Touchgrass');
    // People.
    for (const n of g.npcs) dot(n.pos.x, n.pos.z, '#4ab0ff', 5, '#002');
    if (g.coinBag) dot(g.coinBag.x, g.coinBag.z, '#ffcc22', 7, '#000');
    // Player arrow.
    const pl = g.player;
    const [px, pz] = P(pl.pos.x, pl.pos.z);
    ctx.save(); ctx.translate(px, pz); ctx.rotate(-pl.yaw + Math.PI);
    ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(9, 10); ctx.lineTo(0, 5); ctx.lineTo(-9, 10); ctx.closePath();
    ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#000'; ctx.stroke(); ctx.restore();
    const socks = Object.keys(g.flags.socks || {}).length;
    $('map-legend').innerHTML = `<span><i class="lg shrine"></i>Shrine</span><span><i class="lg boss"></i>Medallion boss</span><span><i class="lg field"></i>Field boss</span><span><i class="lg npc"></i>Person</span><span><i class="lg bag"></i>Your dropped coins</span><span>Medallions <b>${g.flags.medallions || 0} / 6</b></span><span>Socks <b>${socks} / ${SOCKS.length}</b></span>`;
  }
}
