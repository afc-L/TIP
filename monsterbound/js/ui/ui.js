'use strict';
// UI toolkit: panels, text, cursors and the core modal scenes (dialogue, choices, text entry).
MB.FONT = '"Monaco","Lucida Console","Menlo","Consolas",monospace';
MB.UI = {
  font(ctx, size, bold) { ctx.font = (bold ? 'bold ' : '') + (size || 8) + 'px ' + MB.FONT; },
  text(ctx, s, x, y, opts = {}) {
    MB.UI.font(ctx, opts.size || 8, opts.bold);
    ctx.textAlign = opts.align || 'left';
    ctx.textBaseline = 'alphabetic';
    if (opts.shadow !== false) { ctx.fillStyle = opts.shadowColor || 'rgba(0,0,0,0.25)'; ctx.fillText(s, x + 0.6, y + 0.6); }
    ctx.fillStyle = opts.color || '#303040';
    ctx.fillText(s, x, y);
    ctx.textAlign = 'left';
  },
  box(ctx, x, y, w, h, style) {
    const st = Object.assign({ fill: '#f8f8f0', border: '#5868a0', inner: '#c8d0e8', radius: 4 }, MB.UI.THEMES[style] || {}, typeof style === 'object' ? style : {});
    const r = st.radius;
    ctx.fillStyle = st.border; MB.UI.rr(ctx, x, y, w, h, r + 1); ctx.fill();
    ctx.fillStyle = st.inner; MB.UI.rr(ctx, x + 1.5, y + 1.5, w - 3, h - 3, r); ctx.fill();
    ctx.fillStyle = st.fill; MB.UI.rr(ctx, x + 3, y + 3, w - 6, h - 6, Math.max(1, r - 1)); ctx.fill();
  },
  THEMES: {
    dark: { fill: '#283048', border: '#101420', inner: '#5868a0' },
    red: { fill: '#fff4f0', border: '#a03838', inner: '#e8a8a0' },
    gold: { fill: '#fffbe8', border: '#a08020', inner: '#e8d088' },
    green: { fill: '#f4fff0', border: '#3a8040', inner: '#a8d8a0' },
    mega: { fill: '#2a1838', border: '#ff60d0', inner: '#60f0ff' },
  },
  rr(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  },
  cursor(ctx, x, y, color) {
    const b = Math.floor(performance.now() / 300) % 2;
    ctx.fillStyle = color || '#e04040';
    ctx.beginPath(); ctx.moveTo(x + b, y - 3); ctx.lineTo(x + 4 + b, y); ctx.lineTo(x + b, y + 3); ctx.closePath(); ctx.fill();
  },
  typeBadge(ctx, type, x, y, w) {
    w = w || 38;
    ctx.fillStyle = MB.TYPE_COLORS[type]; MB.UI.rr(ctx, x, y, w, 9, 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 0.6; ctx.stroke();
    MB.UI.text(ctx, type.toUpperCase(), x + w / 2, y + 7, { size: 6, color: '#fff', align: 'center', bold: true, shadowColor: 'rgba(0,0,0,0.5)' });
  },
  bar(ctx, x, y, w, h, frac, color, back) {
    ctx.fillStyle = back || '#404850'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color; ctx.fillRect(x + 0.5, y + 0.5, Math.max(0, (w - 1) * MB.clamp(frac, 0, 1)), h - 1);
  },
  hpColor(f) { return f > 0.5 ? '#48d058' : f > 0.2 ? '#f0c030' : '#f04838'; },
  statusBadge(ctx, st, x, y) {
    if (!st) return;
    const C = { brn: ['BRN', '#e86830'], psn: ['PSN', '#a050c0'], tox: ['TOX', '#80309a'], par: ['PAR', '#d8b020'], slp: ['SLP', '#8890a0'], frz: ['FRZ', '#60c8e0'], fnt: ['FNT', '#c03030'] };
    const c = C[st]; if (!c) return;
    ctx.fillStyle = c[1]; MB.UI.rr(ctx, x, y, 18, 8, 2); ctx.fill();
    MB.UI.text(ctx, c[0], x + 9, y + 6.5, { size: 5.5, color: '#fff', align: 'center', bold: true, shadow: false });
  },
  monIcon(ctx, mon, x, y, size, bob) {
    const img = mon.egg ? MB.Sprites.egg() : MB.Sprites.get(mon.sp, false, mon.shiny);
    const s = size || 24;
    ctx.drawImage(img, x, y + (bob ? Math.sin(performance.now() / 150) * 1 : 0), s, s);
  },
  wrapLines(ctx, text, w, size) { MB.UI.font(ctx, size || 8); return MB.wrap(ctx, text, w); },
};

// ---------------- Scene manager ----------------
MB.Game = {
  scenes: [],
  push(scene) {
    return new Promise((resolve) => {
      scene._resolve = resolve;
      scene.close = (res) => { if (scene._closed) return; scene._closed = true; const i = MB.Game.scenes.indexOf(scene); if (i >= 0) MB.Game.scenes.splice(i, 1); MB.input.clear(); resolve(res); };
      MB.Game.scenes.push(scene);
      MB.input.clear();
      if (scene.enter) scene.enter();
    });
  },
  top() { return this.scenes[this.scenes.length - 1]; },
  update(dt) {
    const top = this.top();
    // background scenes may still animate (e.g. world water) but get no input
    for (const s of this.scenes) if (s !== top && s.bgUpdate) s.bgUpdate(dt);
    if (top && top.update) top.update(dt);
  },
  draw(ctx) {
    let start = 0;
    for (let i = this.scenes.length - 1; i >= 0; i--) if (!this.scenes[i].transparent) { start = i; break; }
    for (let i = start; i < this.scenes.length; i++) this.scenes[i].draw(ctx);
  },
  wait(sec) { return new Promise((res) => MB.Game.timers.push({ t: sec, res })); },
  timers: [],
  tickTimers(dt) { for (let i = this.timers.length - 1; i >= 0; i--) { const t = this.timers[i]; t.t -= dt; if (t.t <= 0) { this.timers.splice(i, 1); t.res(); } } },
};

// ---------------- Dialogue ----------------
class DialogScene {
  constructor(text, opts = {}) {
    this.transparent = true;
    this.opts = opts;
    this.pages = [];
    this.raw = String(text);
    this.page = 0; this.chars = 0; this.speed = (MB.settings && MB.settings.textSpeed) || 60;
    this.speaker = opts.speaker || null;
  }
  enter() {
    const ctx = MB.ctx;
    const lines = MB.UI.wrapLines(ctx, this.raw, MB.W - 40, 8);
    for (let i = 0; i < lines.length; i += 2) this.pages.push(lines.slice(i, i + 2));
  }
  update(dt) {
    const pg = this.pages[this.page] || [];
    const total = pg.join('').length;
    if (this.chars < total) {
      this.chars += dt * this.speed;
      if (MB.input.pressed('a') || MB.input.pressed('b')) this.chars = total;
      if (this.opts.voice && Math.floor(this.chars) % 3 === 0) { /* subtle */ }
      return;
    }
    if (this.opts.auto) { this.autoT = (this.autoT || 0) + dt; if (this.autoT > this.opts.auto) this.next(); return; }
    if (MB.input.pressed('a') || MB.input.pressed('b')) { MB.audio.sfx('select'); this.next(); }
  }
  next() {
    this.page++; this.chars = 0; this.autoT = 0;
    if (this.page >= this.pages.length) this.close();
  }
  draw(ctx) {
    const y = MB.H - 52;
    MB.UI.box(ctx, 6, y, MB.W - 12, 48);
    if (this.speaker) { MB.UI.box(ctx, 10, y - 14, Math.max(50, this.speaker.length * 5.4 + 14), 16, 'dark'); MB.UI.text(ctx, this.speaker, 17, y - 3, { color: '#fff', size: 7, bold: true }); }
    const pg = this.pages[this.page] || [];
    let left = Math.floor(this.chars);
    pg.forEach((ln, i) => {
      const s = ln.slice(0, Math.max(0, left)); left -= ln.length;
      MB.UI.text(ctx, s, 18, y + 18 + i * 15, { size: 8 });
    });
    const total = pg.join('').length;
    if (this.chars >= total && !this.opts.auto && !this.opts.noArrow) {
      const b = Math.floor(performance.now() / 300) % 2;
      ctx.fillStyle = '#e04040'; ctx.beginPath(); ctx.moveTo(MB.W - 22, y + 36 + b); ctx.lineTo(MB.W - 16, y + 36 + b); ctx.lineTo(MB.W - 19, y + 40 + b); ctx.fill();
    }
  }
}
MB.DialogScene = DialogScene;

class ChoiceScene {
  constructor(choices, opts = {}) {
    this.transparent = true; this.choices = choices; this.opts = opts; this.idx = opts.start || 0; this.scroll = 0;
    this.maxVis = opts.maxVis || 7;
  }
  update() {
    const n = this.choices.length;
    if (MB.input.repeat('down')) { this.idx = (this.idx + 1) % n; MB.audio.sfx('move'); }
    if (MB.input.repeat('up')) { this.idx = (this.idx + n - 1) % n; MB.audio.sfx('move'); }
    if (this.idx < this.scroll) this.scroll = this.idx;
    if (this.idx >= this.scroll + this.maxVis) this.scroll = this.idx - this.maxVis + 1;
    if (MB.input.pressed('a')) { MB.audio.sfx('select'); this.close(this.idx); }
    else if (MB.input.pressed('b') && this.opts.cancel !== false) { MB.audio.sfx('back'); this.close(this.opts.cancelValue !== undefined ? this.opts.cancelValue : -1); }
  }
  draw(ctx) {
    if (this.opts.prompt) { this.prompt = this.prompt || new DialogScene(this.opts.prompt, { noArrow: true }); if (!this.prompt.pages.length) this.prompt.enter(); this.prompt.chars = 999; this.prompt.draw(ctx); }
    MB.UI.font(ctx, 8);
    const w = Math.max(60, ...this.choices.map((c) => ctx.measureText(String(c)).width + 26));
    const vis = Math.min(this.maxVis, this.choices.length);
    const h = vis * 14 + 10;
    const x = this.opts.x !== undefined ? this.opts.x : MB.W - w - 8;
    const y = this.opts.y !== undefined ? this.opts.y : MB.H - 56 - h;
    MB.UI.box(ctx, x, y, w, h);
    for (let i = 0; i < vis; i++) {
      const ci = i + this.scroll;
      MB.UI.text(ctx, String(this.choices[ci]), x + 16, y + 15 + i * 14);
      if (ci === this.idx) MB.UI.cursor(ctx, x + 8, y + 12 + i * 14);
    }
    if (this.scroll > 0) MB.UI.text(ctx, '▲', x + w - 12, y + 10, { size: 6 });
    if (this.scroll + vis < this.choices.length) MB.UI.text(ctx, '▼', x + w - 12, y + h - 4, { size: 6 });
  }
}
MB.ChoiceScene = ChoiceScene;

class TextInputScene {
  constructor(prompt, def, max) {
    this.transparent = false; this.prompt = prompt; this.val = ''; this.max = max || 12; this.def = def || '';
    this.grid = ['ABCDEFGHIJ', 'KLMNOPQRST', 'UVWXYZ -.!', 'abcdefghij', 'klmnopqrst', 'uvwxyz\'?♀♂'];
    this.cx = 0; this.cy = 0;
  }
  enter() {
    MB.input.textMode = true;
    this.unhook = MB.input.onKey((e) => {
      if (e.key.length === 1 && /[A-Za-z0-9 \-.!'?]/.test(e.key)) { if (this.val.length < this.max) this.val += e.key; this.typed = true; }
      else if (e.code === 'Backspace') this.val = this.val.slice(0, -1);
    });
  }
  update() {
    if (MB.input.repeat('right')) this.cx = (this.cx + 1) % 11;
    if (MB.input.repeat('left')) this.cx = (this.cx + 10) % 11;
    if (MB.input.repeat('down')) this.cy = (this.cy + 1) % 7;
    if (MB.input.repeat('up')) this.cy = (this.cy + 6) % 7;
    if (MB.input.pressed('b')) { this.finish(this.val.trim() || this.def); MB.audio.sfx('back'); return; }
    if (MB.input.pressed('a')) {
      MB.audio.sfx('select');
      if (this.typed) { this.finish(this.val.trim() || this.def); return; }
      if (this.cy === 6 || this.cx === 10) {
        if (this.cy === 6 && this.cx < 5) { this.val = this.val.slice(0, -1); return; }
        this.finish(this.val.trim() || this.def); return;
      }
      const ch = this.grid[this.cy][this.cx];
      if (this.val.length < this.max) this.val += ch;
    }
  }
  finish(v) { MB.input.textMode = false; if (this.unhook) this.unhook(); this.close(v); }
  draw(ctx) {
    ctx.fillStyle = '#d8e0f0'; ctx.fillRect(0, 0, MB.W, MB.H);
    MB.UI.box(ctx, 10, 8, MB.W - 20, 44);
    MB.UI.text(ctx, this.prompt, 20, 24, { size: 8 });
    MB.UI.text(ctx, (this.val || '') + (Math.floor(performance.now() / 400) % 2 ? '_' : ' '), 20, 42, { size: 10, bold: true, color: '#2040a0' }); if (!this.val && this.def) MB.UI.text(ctx, '(default: ' + this.def + ')', 120, 42, { size: 7, color: '#8090b0' });
    MB.UI.text(ctx, `${this.val.length}/${this.max}`, MB.W - 24, 42, { size: 7, align: 'right' });
    MB.UI.box(ctx, 10, 58, MB.W - 20, 172);
    for (let j = 0; j < 6; j++) for (let i = 0; i < 10; i++) {
      const x = 28 + i * 24, y = 80 + j * 20;
      if (i === this.cx && j === this.cy) { ctx.fillStyle = '#a8c0f0'; ctx.fillRect(x - 6, y - 11, 18, 15); }
      MB.UI.text(ctx, this.grid[j][i], x, y, { size: 9 });
    }
    const special = [['DEL', 28], ['OK', 268]];
    if (this.cx === 10 && this.cy < 6) { ctx.fillStyle = '#a8c0f0'; ctx.fillRect(258, 70, 40, 116); }
    MB.UI.text(ctx, 'OK', 270, 130, { size: 9, bold: true });
    if (this.cy === 6) { ctx.fillStyle = '#a8c0f0'; ctx.fillRect(this.cx < 5 ? 20 : 140, 196, 100, 18); }
    MB.UI.text(ctx, 'Delete', 40, 209, { size: 8 }); MB.UI.text(ctx, 'Done', 170, 209, { size: 8 });
    MB.UI.text(ctx, 'Type a name, or pick letters with arrows. Enter: OK  Esc: done', MB.W / 2, 226, { size: 6, align: 'center' });
    void special;
  }
}
MB.TextInputScene = TextInputScene;

// convenience async helpers
MB.say = (text, opts) => MB.Game.push(new DialogScene(text, opts));
MB.sayAll = async (lines, speaker) => { for (const l of lines) await MB.say(l, { speaker }); };
MB.ask = (prompt, choices, opts = {}) => MB.Game.push(new ChoiceScene(choices, Object.assign({ prompt }, opts)));
MB.yesno = async (prompt) => (await MB.ask(prompt, ['Yes', 'No'], { cancelValue: 1 })) === 0;
MB.inputText = (prompt, def, max) => MB.Game.push(new TextInputScene(prompt, def, max));

// Fade transitions
class FadeScene {
  constructor(dir, dur, color) { this.transparent = true; this.dir = dir; this.dur = dur || 0.3; this.t = 0; this.color = color || '#000'; }
  update(dt) { this.t += dt; if (this.t >= this.dur) this.close(); }
  draw(ctx) { const a = this.dir === 'out' ? this.t / this.dur : 1 - this.t / this.dur; ctx.globalAlpha = MB.clamp(a, 0, 1); ctx.fillStyle = this.color; ctx.fillRect(0, 0, MB.W, MB.H); ctx.globalAlpha = 1; }
}
MB.FadeScene = FadeScene;
MB.fadeOut = (d, c) => MB.Game.push(new FadeScene('out', d, c));
MB.fadeIn = (d, c) => MB.Game.push(new FadeScene('in', d, c));

// Toast / banner notification overlay (non-blocking)
MB.toasts = [];
MB.toast = function (text, color) { MB.toasts.push({ text, t: 3, color: color || '#283048' }); };
MB.drawToasts = function (ctx, dt) {
  let y = 6;
  for (let i = MB.toasts.length - 1; i >= 0; i--) {
    const t = MB.toasts[i]; t.t -= dt;
    if (t.t <= 0) { MB.toasts.splice(i, 1); continue; }
    MB.UI.font(ctx, 7, true);
    const w = ctx.measureText(t.text).width + 16;
    ctx.globalAlpha = Math.min(1, t.t * 2);
    MB.UI.box(ctx, MB.W / 2 - w / 2, y, w, 16, { fill: t.color, border: '#101420', inner: '#8898d0' });
    MB.UI.text(ctx, t.text, MB.W / 2, y + 11, { size: 7, bold: true, color: '#fff', align: 'center' });
    ctx.globalAlpha = 1;
    y += 19;
  }
};
