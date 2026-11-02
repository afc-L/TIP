import { LANDMARKS, ROADS, WORLD, LAKE } from './world.js';
import { ITEMS } from './inventory.js';
import { DOCS, TIPS } from './content.js';
import { formatTime, clamp, rand } from './util.js';
import { MAG_SIZE } from './equipment.js';
import { WEATHERS } from './environment.js';

const $ = (id) => document.getElementById(id);

// DOM overlay: HUD, menus, backpack, map, document reader, endings.

export class UI {
  constructor(game) {
    this.game = game;
    this.modal = null; // 'inventory' | 'map' | 'doc' | 'confirm'
    this.mapDirty = true;
    this.markers = [];
    this.explored = new Uint8Array(36 * 36);
    this.toastEls = [];
    this.subT = 0; this.bannerT = 0; this.hitT = 0; this.dmg = 0; this.scare = 0;
    this.buildCompass();
    this.buildRadioBars();
    this.buildBinoculars();
    this.grain = $('grain');
    this.grainCtx = this.grain.getContext('2d');
    this.grain.width = 480; this.grain.height = 270;
    this.grainT = 0;
    $('mapCanvas').addEventListener('mousedown', (e) => this.onMapClick(e));
    $('docPaper').addEventListener('click', () => this.closeModal());
    $('loadTip').textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
  }

  get modalOpen() { return !!this.modal; }

  // ------------------------------------------------------------ screens

  show(id, on = true) { $(id).classList.toggle('hidden', !on); }

  setLoading(p, text) {
    $('loadFill').style.width = `${Math.round(p * 100)}%`;
    $('loadText').textContent = text;
  }

  // ------------------------------------------------------------ HUD

  buildCompass() {
    const strip = $('compassStrip');
    this.pxPerDeg = 3;
    let html = '';
    for (let d = -180; d <= 540; d += 15) {
      const x = (d + 180) * this.pxPerDeg;
      const n = ((d % 360) + 360) % 360;
      const card = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[n];
      const inter = { 45: 'NE', 135: 'SE', 225: 'SW', 315: 'NW' }[n];
      html += `<div class="tick" style="left:${x}px"></div>`;
      if (card) html += `<div class="lbl card" style="left:${x}px">${card}</div>`;
      else if (inter) html += `<div class="lbl" style="left:${x}px">${inter}</div>`;
      else if (n % 30 === 0) html += `<div class="lbl" style="left:${x}px;font-size:10px">${n}</div>`;
    }
    strip.innerHTML = html + '<div id="compassPips"></div>';
    this.pips = $('compassPips');
  }

  buildRadioBars() {
    $('rwBars').innerHTML = Array.from({ length: 10 }, (_, i) => `<i style="height:${30 + i * 7}%"></i>`).join('');
    this.rwBars = [...$('rwBars').children];
  }

  buildBinoculars() {
    document.querySelector('#binos .lenses').innerHTML = `<svg width="100%" height="100%" viewBox="0 0 160 90" preserveAspectRatio="xMidYMid slice" style="position:absolute;inset:0">
      <defs><mask id="bm"><rect x="-200" y="-200" width="560" height="490" fill="white"/><circle cx="63" cy="45" r="30" fill="black"/><circle cx="97" cy="45" r="30" fill="black"/></mask>
      <radialGradient id="bg1"><stop offset="80%" stop-color="black" stop-opacity="0"/><stop offset="100%" stop-color="black" stop-opacity="0.7"/></radialGradient></defs>
      <circle cx="63" cy="45" r="30" fill="url(#bg1)"/><circle cx="97" cy="45" r="30" fill="url(#bg1)"/>
      <rect x="-200" y="-200" width="560" height="490" fill="black" mask="url(#bm)"/></svg>`;
  }

  /** Write to the DOM only when a value actually changed (DOM writes are the expensive part). */
  setText(id, v) {
    const c = this._cache || (this._cache = {});
    if (c[id] === v) return;
    c[id] = v;
    $(id).textContent = v;
  }
  setHTML(id, v) {
    const c = this._cache || (this._cache = {});
    if (c['h' + id] === v) return;
    c['h' + id] = v;
    $(id).innerHTML = v;
  }
  setStyle(id, prop, v) {
    const c = this._cache || (this._cache = {});
    const k = id + prop;
    if (c[k] === v) return;
    c[k] = v;
    $(id).style[prop] = v;
  }

  update(dt) {
    const g = this.game, p = g.player, st = p.stats;
    // bars
    const setBar = (id, v, low) => {
      const w = `${Math.round(clamp(v, 0, 100))}%`;
      const c = this._cache || (this._cache = {});
      if (c[id] === w) return;
      c[id] = w;
      const el = $(id);
      el.style.width = w;
      el.parentElement.parentElement.classList.toggle('low', v < low);
    };
    setBar('barHealth', st.health, 25);
    setBar('barStamina', st.stamina, 15);
    setBar('barHunger', st.hunger, 15);
    setBar('barBattery', st.battery, 15);
    this.setText('flashLabel', g.equip.flashOn ? 'LIGHT ●' : 'LIGHT');
    // weapon
    const eq = g.equip;
    const names = { rifle: 'BOLT-ACTION RIFLE', binoculars: 'BINOCULARS', radio: 'HANDHELD RADIO' };
    this.setText('weaponName', names[eq.current]);
    this.setStyle('ammo', 'display', eq.current === 'rifle' ? '' : 'none');
    this.setText('ammoMag', String(eq.mag));
    this.setText('ammoRes', String(g.inv.count('ammo')));
    this.setText('weaponHint', eq.current === 'rifle' ? (eq.reloadT > 0 ? 'RELOADING…' : eq.mag === 0 ? 'R TO RELOAD' : 'RMB scope · Shift steady')
      : eq.current === 'binoculars' ? 'RMB to zoom' : 'Follow the beeping');
    // clock
    this.setText('clockTime', formatTime(g.env.hours));
    this.setText('clockDay', `Day ${g.env.day}`);
    this.setText('clockWeather', WEATHERS[g.env.weatherBlend < 0.5 ? g.env.weather : g.env.weatherNext].name);
    // compass
    const heading = ((-p.yaw * 180 / Math.PI) % 360 + 360) % 360;
    const w = $('compass').clientWidth;
    this.setStyle('compassStrip', 'transform', `translateX(${Math.round(w / 2 - (heading + 180) * this.pxPerDeg)}px)`);
    this.updatePips(heading);
    // optics
    const scoped = eq.aimT > 0.85 && eq.current === 'rifle';
    const binos = eq.aimT > 0.85 && eq.current === 'binoculars';
    this.show('scope', scoped && g.state === 'play');
    this.show('binos', binos && g.state === 'play');
    this.setStyle('crosshair', 'opacity', String(scoped || binos ? 0 : eq.aiming ? 0.3 : 1));
    if (scoped) this.setText('scopeInfo', eq.holdBreath ? 'HOLDING BREATH' : 'SHIFT · HOLD BREATH');
    if (binos) this.updateBinos();
    // radio widget
    const showRadio = eq.current === 'radio';
    this.show('radioWidget', showRadio);
    if (showRadio) {
      const s = g.story.radioSignal();
      const n = Math.round(s * 10);
      this.rwBars.forEach((b, i) => b.classList.toggle('on', i < n));
      this.setText('rwText', g.story.stage === 4 ? (s > 0.8 ? 'STRONG — VERY CLOSE' : s > 0.5 ? 'CLEARER… KEEP GOING' : 'FAINT — TURN SLOWLY') : 'CH 4 · LISTENING');
    }
    // prompt
    const it = g.focus;
    const label = it ? it.label?.() : null;
    this.setHTML('prompt', label ? `<b>E</b>${label}` : '');
    // timers
    if (this.subT > 0) { this.subT -= dt; if (this.subT <= 0) $('subtitle').style.opacity = 0; }
    if (this.bannerT > 0) { this.bannerT -= dt; if (this.bannerT <= 0) $('banner').style.opacity = 0; }
    if (this.hitT > 0) { this.hitT -= dt; if (this.hitT <= 0) $('hitmark').style.opacity = 0; }
    // damage + fear vignette
    this.dmg = Math.max(0, this.dmg - dt * 0.8);
    const lowHp = st.health < 30 ? (0.25 + Math.sin(g.time * 4) * 0.1) * (1 - st.health / 30) : 0;
    this.setStyle('damage', 'opacity', Math.max(this.dmg, lowHp).toFixed(2));
    const fear = st.fear;
    const fq = Math.round(fear * 20) / 20;
    this.setStyle('vignette', 'background', `radial-gradient(ellipse at center, rgba(0,0,0,0) ${45 - fq * 25}%, rgba(0,0,0,${0.55 + fq * 0.35}) 100%)`);
    this.scare = Math.max(0, this.scare - dt * 3);
    this.setStyle('jumpscare', 'opacity', (this.scare > 0.5 ? (Math.random() < 0.5 ? 0.9 : 0) : this.scare).toFixed(2));
    this.updateGrain(dt, fear);
    this.updateToasts(dt);
    // exploration fog for the map
    const ci = clamp(Math.floor((p.pos.x + WORLD.half) / 20), 0, 35), cj = clamp(Math.floor((p.pos.z + WORLD.half) / 20), 0, 35);
    for (let j = cj - 2; j <= cj + 2; j++) for (let i = ci - 2; i <= ci + 2; i++) {
      if (i >= 0 && j >= 0 && i < 36 && j < 36 && !this.explored[j * 36 + i]) { this.explored[j * 36 + i] = 1; this.mapDirty = true; }
    }
    if (this.modal === 'map') this.drawMap();
  }

  updatePips(heading) {
    const g = this.game, p = g.player.pos;
    const bearing = (x, z) => ((Math.atan2(x - p.x, -(z - p.z)) * 180 / Math.PI) + 360) % 360;
    let html = '';
    const place = (b, cls, sym, title = '') => {
      let d = b - heading;
      if (d > 180) d -= 360; if (d < -180) d += 360;
      if (Math.abs(d) > 85) return;
      const x = (heading + d + 180) * this.pxPerDeg;
      html += `<div class="pip ${cls}" style="left:${x}px" title="${title}">${sym}</div>`;
    };
    const t = g.story.target();
    if (t) {
      const dist = Math.round(Math.hypot(t.x - p.x, t.z - p.z));
      place(bearing(t.x, t.z), 'obj', `◆<span style="font-size:10px;display:block;margin-top:13px">${dist}m</span>`);
    }
    for (const m of this.markers) place(bearing(m.x, m.z), 'mark', '▼');
    if (this._pips !== html) { this._pips = html; this.pips.innerHTML = html; }
  }

  updateBinos() {
    const g = this.game;
    const cam = g.camera.position;
    const f = g.player.forward();
    const dist = g.world.raycast(cam.x, cam.y, cam.z, f.x, f.y, f.z, 400, { stepLen: 1 });
    this.setText('binoRange', dist >= 400 ? '--- m' : `${Math.round(dist)} m`);
    const id = g.animals.identify(cam, f, 300);
    let txt = '';
    if (id && id.dist < dist + 3) txt = `${id.a.sp.name}${id.a.dead ? ' (down)' : id.a.wounded ? ' (wounded)' : ''} · ${Math.round(id.dist)} m`;
    const c = g.creature;
    if (c.visibleInWorld && c.looking) txt = '?????? · ' + Math.round(c.pos.distanceTo(g.player.pos)) + ' m';
    this.setText('binoId', txt);
  }

  updateGrain(dt, fear) {
    if (!this.game.settings.grain) { this.grain.style.display = 'none'; return; }
    this.grain.style.display = '';
    this.grainT += dt;
    if (this.grainT < 0.06) return;
    this.grainT = 0;
    const ctx = this.grainCtx;
    if (!this.grainFrames) {
      this.grainFrames = [];
      for (let f = 0; f < 4; f++) {
        const img = ctx.createImageData(480, 270);
        const d = img.data;
        for (let i = 0; i < d.length; i += 4) { const v = Math.random() * 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
        this.grainFrames.push(img);
      }
      this.grainF = 0;
    }
    this.grainF = (this.grainF + 1 + Math.floor(Math.random() * 2)) % 4;
    ctx.putImageData(this.grainFrames[this.grainF], 0, 0);
    this.setStyle('grain', 'opacity', (0.07 + fear * 0.12 + (this.game.env.nightness * 0.03)).toFixed(2));
  }

  toast(text, secs = 3) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    $('toasts').appendChild(el);
    this.toastEls.push({ el, t: secs });
    if (this.toastEls.length > 4) { const o = this.toastEls.shift(); o.el.remove(); }
  }

  updateToasts(dt) {
    for (let i = this.toastEls.length - 1; i >= 0; i--) {
      const o = this.toastEls[i];
      o.t -= dt;
      if (o.t < 0.6) o.el.style.opacity = Math.max(0, o.t / 0.6);
      if (o.t <= 0) { o.el.remove(); this.toastEls.splice(i, 1); }
    }
  }

  subtitle(text, secs = 3, kind = '') {
    const el = $('subtitle');
    el.textContent = text;
    el.className = kind;
    el.style.opacity = 1;
    this.subT = secs;
  }

  locationBanner(name) {
    $('banner').innerHTML = `${name}<small>DISCOVERED</small>`;
    $('banner').style.opacity = 1;
    this.bannerT = 3;
  }

  hitMarker(text) {
    $('hitmark').textContent = text;
    $('hitmark').style.opacity = 1;
    this.hitT = 1.6;
  }

  damageFlash(amount) { this.dmg = Math.min(1, this.dmg + amount / 35); }
  jumpscare() { this.scare = 1.2; }

  objectiveUpdated() {
    const list = this.game.story.objectives();
    $('objList').innerHTML = list.map((o) => `<div class="${o.sub ? 'sub' : ''} ${o.done ? 'done' : ''}">${o.t}</div>`).join('');
    const el = $('objList');
    el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
    this._objT = 0;
  }

  refreshObjectiveTick(dt) {
    // countdown objectives need a periodic refresh
    this._objT = (this._objT || 0) + dt;
    if (this._objT > 1) {
      this._objT = 0;
      const list = this.game.story.objectives();
      $('objList').innerHTML = list.map((o) => `<div class="${o.sub ? 'sub' : ''} ${o.done ? 'done' : ''}">${o.t}</div>`).join('');
    }
  }

  fade(secs, mid) {
    const f = $('fade');
    f.style.transition = `opacity ${secs}s`;
    f.style.opacity = 1;
    setTimeout(() => { mid?.(); f.style.opacity = 0; }, secs * 1000 + 300);
  }

  // ------------------------------------------------------------ modals

  openModal(name) {
    if (this.modal === name) { this.closeModal(); return; }
    if (this.modal) this.closeModal();
    this.modal = name;
    this.show(name, true);
    if (name === 'inventory') this.refreshInventory();
    if (name === 'map') { this.mapDirty = true; this.drawMap(); this.game.input.unlock(); }
    if (name === 'inventory') this.game.input.unlock();
    this.game.audio.page();
  }

  closeModal() {
    if (!this.modal) return;
    this.show(this.modal, false);
    const was = this.modal;
    this.modal = null;
    if (was === 'doc') this._docDone?.();
    this._docDone = null;
    if (this.game.state === 'play') this.game.input.lock();
  }

  showDocument(doc, onClose) {
    $('docTitle').textContent = doc.title;
    $('docText').textContent = doc.text;
    $('docText').className = doc.style || 'type';
    this._docDone = onClose;
    if (this.modal) this.closeModal();
    this.modal = 'doc';
    this.show('doc', true);
    this.game.audio.page();
    $('docPaper').scrollTop = 0;
  }

  confirm(text, yes) {
    $('confirmText').textContent = text;
    this.modal = 'confirm';
    this.show('confirm', true);
    this.game.input.unlock();
    $('confirmYes').onclick = () => { this.show('confirm', false); this.modal = null; yes(); };
    $('confirmNo').onclick = () => { this.closeModal(); };
  }

  refreshInventory() {
    if (this.modal !== 'inventory') return;
    const g = this.game;
    const inv = g.inv;
    const ids = Object.keys(inv.items).sort((a, b) => (ITEMS[a]?.key ? 1 : 0) - (ITEMS[b]?.key ? 1 : 0));
    $('invList').innerHTML = ids.map((id) => {
      const d = ITEMS[id] || { name: id, max: 1 };
      const btn = d.use ? `<button data-use="${id}">${d.use === 'eat' ? 'Eat' : 'Use'}</button>` : '<span></span>';
      return `<div class="inv-item ${d.key ? 'key' : ''}"><span class="nm">${d.name}</span><span class="ct">${d.key ? '' : `${inv.count(id)} / ${d.max}`}</span>${btn}<span class="ds">${d.desc || ''}</span></div>`;
    }).join('') + `<div class="inv-item"><span class="nm">Rifle magazine</span><span class="ct">${g.equip.mag} / ${MAG_SIZE}</span><span></span></div>`;
    $('invList').querySelectorAll('button[data-use]').forEach((b) => b.onclick = () => { inv.use(b.dataset.use); this.refreshInventory(); });
    const kills = g.animals.kills;
    $('huntRecord').innerHTML = `<div>Score: <b style="color:var(--ink)">${g.animals.score}</b> · Animals taken: ${g.story.kills}</div>` +
      (kills.length ? kills.slice(-6).map((k) => `<div>· ${k.species}, ${k.dist} m${k.clean ? ', clean' : ''} — ${k.pts} pts</div>`).join('') : '<div>No harvests yet.</div>');
    const docs = [...g.story.docs];
    $('docList').innerHTML = docs.length ? docs.map((d) => `<div data-doc="${d}">${DOCS[d].keeper ? '✦ ' : '· '}${DOCS[d].title}</div>`).join('') : '<div>Nothing read yet.</div>';
    $('docList').querySelectorAll('div[data-doc]').forEach((el) => el.onclick = () => {
      const id = el.dataset.doc;
      this.closeModal();
      this.showDocument(DOCS[id], null);
    });
  }

  // ------------------------------------------------------------ map

  buildMapBase() {
    const g = this.game, w = g.world;
    const S = 760;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(S, S);
    const scale = WORLD.size / S;
    for (let py = 0; py < S; py++) {
      for (let px = 0; px < S; px++) {
        const x = -WORLD.half + px * scale, z = -WORLD.half + py * scale;
        const h = w.heightAt(x, z);
        const hx = w.heightAt(x + 2, z) - h, hz = w.heightAt(x, z + 2) - h;
        const shade = clamp(1 - (hx * 0.8 + hz * 0.5) * 0.25, 0.7, 1.2);
        let r = 196, gg = 186, b = 150;
        const open = w.openness(x, z);
        r -= (1 - open) * 34; gg -= (1 - open) * 22; b -= (1 - open) * 30;
        // contour lines
        if (Math.abs((h / 4) - Math.round(h / 4)) < 0.05) { r -= 30; gg -= 30; b -= 30; }
        const rd = w.roadAt(x, z);
        if (rd < 0.5) { r = 150; gg = 112; b = 70; }
        if (w.lakeEdge(x, z) > 0) { r = 92; gg = 112; b = 120; }
        const i = (py * S + px) * 4;
        img.data[i] = r * shade; img.data[i + 1] = gg * shade; img.data[i + 2] = b * shade; img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    // tree dots
    ctx.fillStyle = 'rgba(40,52,36,0.35)';
    for (const arr of w.circles.values()) {
      for (const t of arr) {
        if (t.kind !== 'tree') continue;
        ctx.fillRect((t.x + WORLD.half) / scale - 1, (t.z + WORLD.half) / scale - 1, 2, 2);
      }
    }
    // border & grid
    ctx.strokeStyle = 'rgba(60,50,30,0.25)';
    ctx.lineWidth = 1;
    for (let k = 0; k <= S; k += S / 8) { ctx.beginPath(); ctx.moveTo(k, 0); ctx.lineTo(k, S); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, k); ctx.lineTo(S, k); ctx.stroke(); }
    this.mapBase = c;
  }

  worldToMap(x, z) { const S = 760; return [(x + WORLD.half) / WORLD.size * S, (z + WORLD.half) / WORLD.size * S]; }

  drawMap() {
    if (!this.mapBase) this.buildMapBase();
    const g = this.game;
    const cv = $('mapCanvas');
    const ctx = cv.getContext('2d');
    ctx.drawImage(this.mapBase, 0, 0);
    // fog of war
    ctx.fillStyle = 'rgba(30,28,22,0.72)';
    const cs = 760 / 36;
    for (let j = 0; j < 36; j++) for (let i = 0; i < 36; i++) if (!this.explored[j * 36 + i]) ctx.fillRect(i * cs, j * cs, cs + 0.5, cs + 0.5);
    // landmarks
    ctx.font = 'bold 12px Futura, Trebuchet MS, Arial';
    ctx.textAlign = 'center';
    const icons = { truck: '▣', camp: '▲', tent: '⛺', lake: '≈', dock: '⊐', radio: '⌁', station: '■', cabin: '⌂', tower: '♜', gate: '⊟', hollow: '✶' };
    for (const k of g.story.discovered) {
      const L = LANDMARKS[k];
      if (!L || !L.name) continue;
      const [mx, my] = this.worldToMap(L.x, L.z);
      ctx.fillStyle = k === 'hollow' ? '#7a1510' : '#2a2016';
      ctx.font = 'bold 16px Arial';
      ctx.fillText(icons[L.icon] || '●', mx, my + 5);
      ctx.font = 'bold 11px Futura, Trebuchet MS, Arial';
      ctx.fillText(L.name.toUpperCase(), mx, my + 20);
    }
    // markers
    for (const m of this.markers) {
      const [mx, my] = this.worldToMap(m.x, m.z);
      ctx.fillStyle = '#b0402a';
      ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx - 6, my - 12); ctx.lineTo(mx + 6, my - 12); ctx.closePath(); ctx.fill();
    }
    // objective
    const t = g.story.target();
    if (t) {
      const [mx, my] = this.worldToMap(t.x, t.z);
      ctx.strokeStyle = '#a07a20'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(mx, my, 10 + Math.sin(performance.now() / 200) * 2, 0, Math.PI * 2); ctx.stroke();
    }
    // player
    const p = g.player;
    const [px, py] = this.worldToMap(p.pos.x, p.pos.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-p.yaw);
    ctx.fillStyle = '#e8e0c8'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(6, 7); ctx.lineTo(0, 3); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    // compass rose
    ctx.fillStyle = '#2a2016'; ctx.font = 'bold 18px Georgia'; ctx.fillText('N', 740, 30);
    ctx.beginPath(); ctx.moveTo(740, 36); ctx.lineTo(735, 52); ctx.lineTo(745, 52); ctx.closePath(); ctx.fill();
    // scale bar
    ctx.fillRect(20, 740, 760 / WORLD.size * 100, 3);
    ctx.font = '11px Arial'; ctx.textAlign = 'left'; ctx.fillText('100 m', 20, 735);
  }

  onMapClick(e) {
    const cv = $('mapCanvas');
    const r = cv.getBoundingClientRect();
    const mx = (e.clientX - r.left) / r.width * 760, my = (e.clientY - r.top) / r.height * 760;
    const x = mx / 760 * WORLD.size - WORLD.half, z = my / 760 * WORLD.size - WORLD.half;
    const near = this.markers.findIndex((m) => Math.hypot(m.x - x, m.z - z) < 12);
    if (near >= 0) this.markers.splice(near, 1);
    else if (this.markers.length < 8) this.markers.push({ x, z });
    this.game.audio.uiClick();
    this.drawMap();
  }

  // ------------------------------------------------------------ endings

  showEnding(e, stats, isDeath) {
    $('endTitle').textContent = e.title;
    $('endText').textContent = e.text;
    $('endStats').innerHTML = stats.map((s) => `<div>${s}</div>`).join('');
    this.show('btnEndLoad', isDeath && this.game.hasSave());
    this.show('ending', true);
  }

  serialize() { return { markers: this.markers, explored: Array.from(this.explored).join('') }; }
  load(d) {
    if (!d) return;
    this.markers = d.markers || [];
    if (d.explored) for (let i = 0; i < Math.min(d.explored.length, this.explored.length); i++) this.explored[i] = d.explored.charCodeAt(i) === 49 ? 1 : 0;
    this.mapDirty = true;
  }
}
