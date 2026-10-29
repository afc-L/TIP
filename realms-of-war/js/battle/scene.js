// Battle screen: owns the simulation, renderer, camera, player input and the battle HUD.
(function () {
  const RW = window.RW;
  const T = THREE;
  const U = RW.util;
  const ui = RW.ui;
  const STEP = 0.05;

  const STATE_LABEL = { idle: 'Holding', moving: 'Moving', fighting: 'Fighting', shooting: 'Shooting', routing: 'Routing!', dead: 'Destroyed', escaped: 'Fled', gate: 'Battering gate' };

  class BattleScene {
    constructor(app, cfg, onDone) {
      this.app = app; this.cfg = cfg; this.onDone = onDone;
      this.battle = new RW.Battle(cfg);
      this.view = new RW.BattleRenderer(this.battle);
      this.scene = this.view.scene;
      this.camera = new T.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.5, 1600);
      const b = this.battle, map = b.map;
      const north = b.sideNorth[0];
      const zn = map.deployZone(north);
      this.rts = new RW.RTSCamera(this.camera, {
        x: 0, z: (zn.z0 + zn.z1) / 2 + (north ? 25 : -25), yaw: north ? Math.PI : 0, dist: 95,
        minDist: 10, maxDist: 290, bounds: { minX: -118, maxX: 118, minZ: -118, maxZ: 118 }, heightFn: (x, z) => map.heightAt(x, z),
      });
      this.selected = new Set();
      this.hoverUnit = null; this.inspect = null;
      this.speed = 1; this.paused = false;
      this.acc = 0; this.uiTimer = 0; this.miniTimer = 0;
      this.targeting = null;
      this.mouse = { x: 0, y: 0, moved: true };
      this.drag = null; this.rdrag = null; this.rotating = null;
      this.ended = false;
      this.raycaster = new T.Raycaster();
      this.tmpV = new T.Vector3();
      // Targeting ring for abilities
      const rg = new T.RingGeometry(0.9, 1, 48); rg.rotateX(-Math.PI / 2);
      this.targetRing = new T.Mesh(rg, new T.MeshBasicMaterial({ color: '#ffd76a', transparent: true, opacity: 0.85, depthWrite: false }));
      this.targetRing.visible = false; this.targetRing.renderOrder = 5;
      this.scene.add(this.targetRing);
      this.buildHud();
      this.bindInput();
      this.bindEvents();
      RW.audio.music('battle');
      RW.audio.play('horn');
    }

    // ---------------------------------------------------------------- HUD
    buildHud() {
      const b = this.battle;
      const me = b.sides[0], foe = b.sides[1];
      const mapInfo = RW.data.BATTLE_MAPS[b.cfg.mapType];
      const el = ui.setHud(`<div class="battle-hud">
        <div class="b-top panel">
          <div class="b-forces">
            ${ui.emblem(me.faction, 34)}
            <div class="b-forcebar"><div class="mine" style="background:${me.fac.color}"></div><div class="theirs" style="background:${foe.fac.color}"></div></div>
            ${ui.emblem(foe.faction, 34)}
          </div>
          <div class="b-clock">
            <span class="b-timer" data-tip="Battle time. If the time limit is reached, the defender wins.">0:00</span>
            <button class="btn sm b-pause" data-tip="Pause / resume (Space). You can still give orders while paused.">❚❚</button>
            <button class="btn sm b-spd on" data-s="1" data-tip="Normal speed (1)">1×</button>
            <button class="btn sm b-spd" data-s="2" data-tip="Double speed (2)">2×</button>
            <button class="btn sm b-spd" data-s="3" data-tip="Triple speed (3)">3×</button>
          </div>
          <div class="b-actions">
            <button class="btn sm danger b-retreat" data-tip="Withdraw your army from the field. Counts as a defeat; engaged units suffer losses.">Retreat</button>
            <button class="btn sm b-menu" data-tip="Battle menu (Esc)">☰</button>
          </div>
        </div>
        <div class="b-map-name">${mapInfo ? mapInfo.name : ''}${b.siege ? (b.attackerSide === 0 ? ' · You are attacking' : ' · You are defending') : ''}</div>
        <div class="b-msgs"></div>
        <div class="b-deploy panel">
          <div><b>Deployment</b> — drag-select and right-click inside the gold zone to position your army. Right-drag to set a line and facing.</div>
          <button class="btn primary b-start">Start Battle</button>
        </div>
        <div class="b-banners"></div>
        <div class="b-selbox"></div>
        <div class="b-paused">PAUSED</div>
        <div class="b-bottom">
          <div class="b-info panel"></div>
          <div class="b-cards"></div>
          <div class="b-right">
            <div class="b-abilities panel"></div>
            <div class="b-mini panel"><canvas width="190" height="190"></canvas></div>
          </div>
        </div>
        <div class="b-help">WASD/edge: pan · Q/E: rotate · Wheel/R/F: zoom · Middle-drag or Alt+drag: orbit · Ctrl+A: select all · T/Y/U formations · G hold · H halt · Z/X/C abilities</div>
      </div>`);
      this.hud = el;
      this.$ = (s) => el.querySelector(s);
      this.$('.b-start').onclick = () => this.startBattle();
      this.$('.b-pause').onclick = () => this.togglePause();
      el.querySelectorAll('.b-spd').forEach((btn) => (btn.onclick = () => this.setSpeed(+btn.dataset.s)));
      this.$('.b-retreat').onclick = () => this.confirmRetreat();
      this.$('.b-menu').onclick = () => this.openMenu();
      // Unit cards
      const cards = this.$('.b-cards');
      this.cardEls = new Map();
      for (const u of b.units.filter((x) => x.side === 0)) {
        const c = U.html(`<div class="ucard" style="--fc:${me.fac.color}">
          <div class="uc-top">${RW.unitIcon(u.typeId)}<span class="uc-rank">${'▲'.repeat(u.rank)}</span></div>
          <div class="uc-name">${u.isGeneral ? 'General' : u.name}</div>
          <div class="uc-count"></div>
          <div class="bar hp"><div class="fill"></div></div>
          <div class="bar mor"><div class="fill"></div></div>
          ${u.t.range ? '<div class="bar ammo"><div class="fill"></div></div>' : ''}
          <div class="uc-state"></div>
        </div>`);
        c._tip = () => this.unitTip(u);
        c.addEventListener('mousedown', (e) => {
          if (e.button !== 0) return;
          e.stopPropagation();
          if (e.shiftKey || e.ctrlKey) { if (this.selected.has(u)) this.selected.delete(u); else this.selected.add(u); }
          else { this.selected.clear(); this.selected.add(u); }
          this.inspect = u;
          RW.audio.play('select');
          this.refreshCards(); this.refreshInfo();
        });
        c.addEventListener('dblclick', () => this.rts.focus(u.x, u.z, Math.min(this.rts.targetDist, 70)));
        cards.appendChild(c);
        this.cardEls.set(u, c);
      }
      // Banners
      this.bannerEls = new Map();
      const bl = this.$('.b-banners');
      for (const u of b.units) {
        const fac = b.sides[u.side].fac;
        const be = U.html(`<div class="ubanner ${u.side === 0 ? 'mine' : 'foe'}" style="--fc:${fac.color}">${RW.unitIcon(u.typeId)}<div class="ub-bar"><div></div></div></div>`);
        be._tip = () => this.unitTip(u);
        be.addEventListener('mousedown', (e) => {
          e.stopPropagation(); e.preventDefault();
          if (e.button === 0 && u.side === 0) {
            if (!e.shiftKey) this.selected.clear();
            this.selected.add(u); this.inspect = u; this.refreshCards(); this.refreshInfo();
          } else if (e.button === 0) { this.inspect = u; this.refreshInfo(); }
          else if (e.button === 2 && u.side !== 0 && this.selected.size) this.attackOrder(u);
        });
        be.addEventListener('contextmenu', (e) => e.preventDefault());
        bl.appendChild(be);
        this.bannerEls.set(u, be);
      }
      // Abilities
      const ab = this.$('.b-abilities');
      const keys = ['Z', 'X', 'C'];
      this.abilityEls = me.abilities.map((a, i) => {
        const btn = U.html(`<button class="ability" style="--ac:${a.def.color}">${RW.icon(a.def.icon)}<span class="cd"></span><span class="key">${keys[i]}</span></button>`);
        btn._tip = () => ui.abilityTip(a.id, a.cdMax) + (me.general && me.general.gone ? '<div class="tip-warn">Your general is dead — abilities unavailable.</div>' : '');
        btn.onclick = () => this.useAbility(i);
        ab.appendChild(btn);
        return btn;
      });
      // Minimap
      this.mini = this.$('.b-mini canvas');
      this.miniCtx = this.mini.getContext('2d');
      this.miniBg = this.renderMiniBg();
      this.mini.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        const r = this.mini.getBoundingClientRect();
        const p = this.miniToWorld(e.clientX - r.left, e.clientY - r.top);
        if (e.button === 2 && this.selected.size) this.moveOrder(p.x, p.z);
        else this.rts.focus(p.x, p.z);
      });
      this.mini.addEventListener('contextmenu', (e) => e.preventDefault());
      this.refreshCards(); this.refreshInfo();
    }

    unitTip(u) {
      const fac = this.battle.sides[u.side].fac;
      let extra = `<div class="tip-live">${u.side === 0 ? '' : '<b>Enemy</b> · '}${u.alive}/${u.count} men · Morale ${Math.max(0, Math.round(u.morale))} · ${STATE_LABEL[u.state] || u.state}${u.t.range ? ' · Ammo ' + u.ammo + '/' + u.t.ammo : ''}</div>`;
      if (u.buffs.length) extra += `<div class="tip-buffs">${u.buffs.map((x) => x.name).join(', ')}</div>`;
      if (u.isGeneral) extra += `<div class="tip-desc">Commander: <b>${U.escape(u.name)}</b></div>`;
      return ui.unitTip(u.typeId, extra).replace('<div class="tip-title">', `<div class="tip-title" style="color:${fac.color2 === '#2a2522' ? fac.color : 'inherit'}">`);
    }

    renderMiniBg() {
      const map = this.battle.map, F = RW.MAPF;
      const c = document.createElement('canvas'); c.width = c.height = map.n;
      const ctx = c.getContext('2d');
      const img = ctx.createImageData(map.n, map.n);
      for (let j = 0; j < map.n; j++) for (let i = 0; i < map.n; i++) {
        const idx = j * map.n + i, f = map.flags[idx];
        const h = map.h[j * map.vn + i];
        let r = 96 + h * 3, g = 130 + h * 2, bl = 60;
        if (f & F.FOREST) { r = 50; g = 86; bl = 40; }
        if (f & F.BLOCK) { r = 120; g = 115; bl = 105; }
        if (f & F.DEEP) { r = 50; g = 100; bl = 160; }
        if (f & F.WATER) { r = 90; g = 140; bl = 170; }
        if (f & F.WALL) { r = 160; g = 150; bl = 130; }
        if (f & F.ROAD || f & F.GATE) { r = 150; g = 130; bl = 95; }
        const o = idx * 4;
        img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = bl; img.data[o + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      return c;
    }
    // Minimap is drawn rotated so "up" is toward the enemy (player always looks up).
    worldToMini(x, z) {
      const s = this.mini.width / this.battle.map.size, flip = this.battle.sideNorth[0];
      const mx = (x + 120) * s, mz = (z + 120) * s;
      return flip ? { x: this.mini.width - mx, y: this.mini.height - mz } : { x: mx, y: mz };
    }
    miniToWorld(px, py) {
      const s = this.battle.map.size / this.mini.width, flip = this.battle.sideNorth[0];
      if (flip) { px = this.mini.width - px; py = this.mini.height - py; }
      return { x: px * s - 120, z: py * s - 120 };
    }
    drawMini() {
      const ctx = this.miniCtx, W = this.mini.width, b = this.battle;
      ctx.save();
      ctx.clearRect(0, 0, W, W);
      if (b.sideNorth[0]) { ctx.translate(W, W); ctx.rotate(Math.PI); }
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(this.miniBg, 0, 0, W, W);
      ctx.restore();
      if (b.map.gate && b.map.gate.hp > 0) { const p = this.worldToMini(b.map.gate.x, b.map.gate.z); ctx.fillStyle = '#5a3c22'; ctx.fillRect(p.x - 4, p.y - 2, 8, 4); }
      const s = W / b.map.size;
      for (const u of b.units) {
        if (u.gone || (u.hidden && u.side !== 0)) continue;
        const p = this.worldToMini(u.x, u.z);
        const col = u.state === 'routing' ? '#ddd' : b.sides[u.side].fac.color;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(-u.facing + (b.sideNorth[0] ? Math.PI : 0));
        ctx.fillStyle = col;
        ctx.strokeStyle = this.selected.has(u) ? '#7dff8f' : '#000';
        ctx.lineWidth = this.selected.has(u) ? 2 : 1;
        const w = Math.max(3, u.hw * 2 * s), h = Math.max(2.5, u.hd * 2 * s);
        ctx.fillRect(-w / 2, -h / 2, w, h); ctx.strokeRect(-w / 2, -h / 2, w, h);
        ctx.restore();
      }
      // Camera footprint
      const pts = [[0, 0], [window.innerWidth, 0], [window.innerWidth, window.innerHeight], [0, window.innerHeight]].map(([x, y]) => this.groundAt(x, y, true));
      if (pts.every(Boolean)) {
        ctx.strokeStyle = 'rgba(255,240,200,0.8)'; ctx.lineWidth = 1;
        ctx.beginPath();
        pts.forEach((p, i) => { const m = this.worldToMini(p.x, p.z); if (i) ctx.lineTo(m.x, m.y); else ctx.moveTo(m.x, m.y); });
        ctx.closePath(); ctx.stroke();
      }
    }

    refreshCards() {
      for (const [u, c] of this.cardEls) {
        c.classList.toggle('sel', this.selected.has(u));
        c.classList.toggle('dead', u.state === 'dead' || u.state === 'escaped');
        c.classList.toggle('routing', u.state === 'routing');
        c.classList.toggle('fighting', u.state === 'fighting');
        c.classList.toggle('wavering', u.active && u.morale < 25);
        c.querySelector('.uc-count').textContent = `${u.alive}/${u.count}`;
        c.querySelector('.hp .fill').style.width = (u.alive / u.count) * 100 + '%';
        c.querySelector('.mor .fill').style.width = U.clamp(u.morale / 100, 0, 1) * 100 + '%';
        const am = c.querySelector('.ammo .fill');
        if (am) am.style.width = (u.ammo / Math.max(1, u.t.ammo)) * 100 + '%';
        c.querySelector('.uc-state').textContent = u.shattered && u.state !== 'dead' ? 'Shattered' : (u.hold && u.active ? 'Hold · ' : '') + (STATE_LABEL[u.state] || '');
      }
    }

    refreshInfo() {
      const box = this.$('.b-info');
      const sel = [...this.selected].filter((u) => !u.gone);
      const u = sel.length === 1 ? sel[0] : this.inspect && !this.inspect.gone ? this.inspect : null;
      const F = RW.FORMATIONS;
      const formBtns = sel.length ? `<div class="b-forms">
          ${Object.entries(F).map(([k, f], i) => `<button class="btn sm form ${sel.every((x) => x.formation === k) ? 'on' : ''}" data-f="${k}" data-tip="<b>${f.name} formation</b> (${'TYU'[i]})<br>${f.desc}">${f.name}</button>`).join('')}
          <button class="btn sm hold ${sel.every((x) => x.hold) ? 'on' : ''}" data-tip="<b>Hold position</b> (G)<br>Units won't automatically charge nearby enemies or pursue.">Hold</button>
          <button class="btn sm halt" data-tip="<b>Halt</b> (H)<br>Stop and cancel current orders.">Halt</button>
        </div>` : '';
      if (!u && !sel.length) { box.innerHTML = '<div class="b-hint">Select units by clicking them, their cards, or dragging a box. Right-click to move or attack.</div>'; return; }
      let head;
      if (u) {
        const t = u.t;
        const fac = this.battle.sides[u.side].fac;
        head = `<div class="bi-head">${RW.unitIcon(u.typeId)}<div><div class="bi-name" style="color:${u.side === 0 ? '#f1e2b0' : fac.color}">${U.escape(u.isGeneral ? u.name : u.name)}${u.side ? ' (enemy)' : ''}</div><div class="bi-sub">${RW.catName[u.cat]} · ${u.alive}/${u.count} men · ${STATE_LABEL[u.state] || ''}</div></div></div>
          <div class="bi-stats">
            <span data-tip="Melee attack">⚔ ${Math.round(t.atk)}</span><span data-tip="Melee defence">🛡 ${Math.round(t.def + u.form.def)}</span><span data-tip="Armour">⛨ ${Math.round(t.armor + u.buffVal('armor'))}</span>
            <span data-tip="Weapon damage">✦ ${Math.round(t.dmg)}</span><span data-tip="Charge bonus">➶ ${Math.round(t.charge)}</span><span data-tip="Speed">» ${t.speed.toFixed(1)}</span>
            ${t.range ? `<span data-tip="Range">◎ ${Math.round(t.range)}</span><span data-tip="Ammunition">➹ ${u.ammo}/${t.ammo}</span>` : ''}
          </div>
          ${ui.bar(u.alive / u.count, 'hp', 'Strength')}${ui.bar(U.clamp(u.morale / 100, 0, 1), 'mor', u.active && u.morale < 25 ? 'Wavering!' : 'Morale')}
          ${u.buffs.length ? `<div class="bi-buffs">${u.buffs.map((x) => `<span>${x.name}</span>`).join('')}</div>` : ''}`;
      } else head = `<div class="bi-name">${sel.length} units selected</div><div class="bi-sub">${sel.reduce((a, x) => a + x.alive, 0)} soldiers</div>`;
      box.innerHTML = head + formBtns;
      box.querySelectorAll('.form').forEach((btn) => (btn.onclick = () => this.setFormation(btn.dataset.f)));
      const hb = box.querySelector('.hold'); if (hb) hb.onclick = () => this.toggleHold();
      const hl = box.querySelector('.halt'); if (hl) hl.onclick = () => this.haltSel();
    }

    // ---------------------------------------------------------------- commands
    get selList() { return [...this.selected].filter((u) => !u.gone && u.state !== 'routing'); }
    setFormation(f) { this.battle.setFormation(this.selList, f); RW.audio.play('order'); this.refreshInfo(); }
    toggleHold() { const s = this.selList; const v = !s.every((u) => u.hold); for (const u of s) u.hold = v; RW.audio.play('order'); this.refreshInfo(); }
    haltSel() { for (const u of this.selList) u.halt(); RW.audio.play('order'); }
    moveOrder(x, z, facing = null, width = null) {
      const sel = this.selList;
      if (!sel.length) return;
      const plan = this.battle.orderGroupMove(sel, x, z, facing, width);
      for (const p of plan) this.view.orderMarker(p.x, p.z);
      RW.audio.play('order');
    }
    attackOrder(target) {
      const sel = this.selList;
      if (!sel.length || this.battle.phase === 'deploy') { if (this.battle.phase === 'deploy') ui.toast('Start the battle before attacking.', 'warn'); return; }
      this.battle.orderAttack(sel, target);
      this.view.orderMarker(target.x, target.z, '#ff5a3a');
      RW.audio.play('order');
    }
    useAbility(i) {
      const sd = this.battle.sides[0];
      const a = sd.abilities[i];
      if (!a) return;
      if (this.battle.phase !== 'battle') { ui.toast('Abilities can be used once the battle starts.', 'warn'); return; }
      if (!sd.general || sd.general.gone) { ui.toast('Your general has fallen — no abilities.', 'warn'); RW.audio.play('error'); return; }
      if (a.cd > 0) { RW.audio.play('error'); return; }
      if (a.def.target === 'self') { RW.castAbility(this.battle, 0, a.id, 0, 0); return; }
      this.targeting = this.targeting === a.id ? null : a.id;
      this.targetRing.material.color.set(a.def.color);
    }
    startBattle() {
      if (this.battle.phase !== 'deploy') return;
      this.battle.start();
      this.$('.b-deploy').style.display = 'none';
      RW.audio.play('horn');
    }
    togglePause() { this.paused = !this.paused; this.$('.b-paused').classList.toggle('show', this.paused); this.$('.b-pause').classList.toggle('on', this.paused); }
    setSpeed(s) {
      this.speed = s;
      if (this.paused) this.togglePause();
      this.hud.querySelectorAll('.b-spd').forEach((b) => b.classList.toggle('on', +b.dataset.s === s));
    }
    confirmRetreat() {
      if (this.ended) return;
      const wasPaused = this.paused;
      if (!this.paused) this.togglePause();
      ui.modal({
        title: 'Sound the Retreat?',
        body: '<p>Your army will withdraw from the field. The battle counts as a defeat and units in melee suffer extra losses.</p>',
        buttons: [
          { label: 'Retreat', cls: 'danger', onClick: () => { this.battle.retreat(0); } },
          { label: 'Keep Fighting', onClick: () => { if (!wasPaused) this.togglePause(); } },
        ],
      });
    }
    openMenu() {
      if (this.ended) return;
      const wasPaused = this.paused;
      if (!this.paused) this.togglePause();
      ui.modal({
        title: 'Battle Paused',
        body: `<p>${RW.data.BATTLE_MAPS[this.battle.cfg.mapType].desc}</p><p class="dim">Tip: attack enemies in the flank or rear for big morale and damage bonuses. Spears and halberds stop cavalry charges cold.</p>`,
        buttons: [
          { label: 'Resume', cls: 'primary', onClick: () => { if (!wasPaused) this.togglePause(); } },
          { label: 'Settings', onClick: () => RW.app.openSettings(() => this.openMenu()) },
          { label: this.cfg.quick ? 'Quit to Menu' : 'Retreat', cls: 'danger', onClick: () => { if (this.cfg.quick) this.finish(null); else this.battle.retreat(0); } },
        ],
      });
    }

    // ---------------------------------------------------------------- picking
    groundAt(cx, cy, quick = false) {
      const ndc = new T.Vector2((cx / window.innerWidth) * 2 - 1, -(cy / window.innerHeight) * 2 + 1);
      this.raycaster.setFromCamera(ndc, this.camera);
      const o = this.raycaster.ray.origin, d = this.raycaster.ray.direction;
      const map = this.battle.map;
      let prev = 0;
      const step = quick ? 8 : 2;
      for (let t = step; t < 1400; t += step) {
        const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
        if (Math.abs(x) > 400 || Math.abs(z) > 400) break;
        if (y <= map.heightAt(x, z)) {
          let lo = prev, hi = t;
          for (let k = 0; k < (quick ? 3 : 8); k++) {
            const m = (lo + hi) / 2;
            const yy = o.y + d.y * m, xx = o.x + d.x * m, zz = o.z + d.z * m;
            if (yy <= map.heightAt(xx, zz)) hi = m; else lo = m;
          }
          return { x: U.clamp(o.x + d.x * hi, -119, 119), z: U.clamp(o.z + d.z * hi, -119, 119) };
        }
        prev = t;
      }
      if (quick && d.y < 0) { const t = -o.y / d.y; return { x: U.clamp(o.x + d.x * t, -119, 119), z: U.clamp(o.z + d.z * t, -119, 119) }; }
      return null;
    }
    screenPos(x, y, z) {
      this.tmpV.set(x, y, z).project(this.camera);
      if (this.tmpV.z > 1) return null;
      return { x: (this.tmpV.x * 0.5 + 0.5) * window.innerWidth, y: (-this.tmpV.y * 0.5 + 0.5) * window.innerHeight };
    }
    unitAtScreen(cx, cy) {
      const g = this.groundAt(cx, cy);
      const b = this.battle;
      if (g) {
        const u = b.unitAtPoint(g.x, g.z, (x) => !(x.hidden && x.side !== 0));
        if (u) return u;
      }
      // Fallback: nearest soldier in screen space.
      let best = null, bd = 18 * 18;
      for (const u of b.units) {
        if (u.gone || (u.hidden && u.side !== 0)) continue;
        for (let i = 0; i < u.count; i += 2) {
          if (!u.sa[i]) continue;
          const p = this.screenPos(u.sx[i], u.sy[i] + 1, u.sz[i]);
          if (!p) continue;
          const d = (p.x - cx) ** 2 + (p.y - cy) ** 2;
          if (d < bd) { bd = d; best = u; }
        }
      }
      return best;
    }

    // ---------------------------------------------------------------- input
    bindInput() {
      const cv = this.app.canvas;
      const on = (t, ev, fn, opt) => { t.addEventListener(ev, fn, opt); (this.unbind = this.unbind || []).push(() => t.removeEventListener(ev, fn, opt)); };
      on(cv, 'contextmenu', (e) => e.preventDefault());
      on(cv, 'mousedown', (e) => this.onDown(e));
      on(window, 'mousemove', (e) => this.onMove(e));
      on(window, 'mouseup', (e) => this.onUp(e));
      on(cv, 'wheel', (e) => { e.preventDefault(); this.rts.zoom(e.deltaY); }, { passive: false });
      on(cv, 'dblclick', (e) => { const u = this.unitAtScreen(e.clientX, e.clientY); if (u) this.rts.focus(u.x, u.z, Math.min(this.rts.targetDist, 70)); });
      on(window, 'keydown', (e) => this.onKey(e));
      on(window, 'blur', () => { if (!this.paused && this.battle.phase === 'battle' && !this.ended) { this.togglePause(); ui.toast('Paused while the window is out of focus.'); } });
    }
    onDown(e) {
      if (ui.modalOpen || this.ended) return;
      this.mouse.x = e.clientX; this.mouse.y = e.clientY;
      if (e.button === 1 || (e.button === 0 && e.altKey)) { this.rotating = { x: e.clientX, y: e.clientY }; e.preventDefault(); return; }
      if (e.button === 0) {
        if (this.targeting) {
          const g = this.groundAt(e.clientX, e.clientY);
          if (g) {
            const i = this.battle.sides[0].abilities.findIndex((a) => a.id === this.targeting);
            if (RW.castAbility(this.battle, 0, this.targeting, g.x, g.z)) this.targeting = null;
            else RW.audio.play('error');
            if (i < 0) this.targeting = null;
          }
          return;
        }
        this.drag = { x: e.clientX, y: e.clientY, shift: e.shiftKey || e.ctrlKey };
      } else if (e.button === 2) {
        if (this.targeting) { this.targeting = null; return; }
        const g = this.groundAt(e.clientX, e.clientY);
        this.rdrag = { x: e.clientX, y: e.clientY, g, moved: false };
      }
    }
    onMove(e) {
      this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.moved = true;
      if (this.rotating) {
        this.rts.rotateBy(e.clientX - this.rotating.x, 0);
        this.rotating.x = e.clientX; this.rotating.y = e.clientY;
        return;
      }
      if (this.drag) {
        const box = this.$('.b-selbox');
        const x0 = Math.min(this.drag.x, e.clientX), y0 = Math.min(this.drag.y, e.clientY);
        const w = Math.abs(e.clientX - this.drag.x), h = Math.abs(e.clientY - this.drag.y);
        if (w + h > 6) { box.style.display = 'block'; box.style.left = x0 + 'px'; box.style.top = y0 + 'px'; box.style.width = w + 'px'; box.style.height = h + 'px'; }
      }
      if (this.rdrag && this.rdrag.g && this.selected.size) {
        const g = this.groundAt(e.clientX, e.clientY);
        if (g && Math.hypot(g.x - this.rdrag.g.x, g.z - this.rdrag.g.z) > 4) {
          this.rdrag.moved = true;
          const plan = this.dragPlan(this.rdrag.g, g);
          const slots = [];
          for (const p of plan) {
            const u = p.u;
            for (let k = 0; k < u.alive; k++) {
              const [lx, lz] = u.slotLocal(k, u.alive);
              const [wx, wz] = u.toWorld(lx, lz, p.x, p.z, p.facing);
              slots.push({ x: wx, z: wz });
            }
          }
          this.view.showGhost(slots);
          this.rdrag.plan = { a: this.rdrag.g, b: g };
        }
      }
    }
    dragPlan(a, b) {
      const dx = b.x - a.x, dz = b.z - a.z;
      // Facing perpendicular to the drag line, pointing away from the camera.
      let fx = dz, fz = -dx;
      const cf = { x: this.rts.tx - this.camera.position.x, z: this.rts.tz - this.camera.position.z };
      if (fx * cf.x + fz * cf.z < 0) { fx = -fx; fz = -fz; }
      const facing = Math.atan2(fx, fz);
      return this.battle.planGroupMove(this.selList, (a.x + b.x) / 2, (a.z + b.z) / 2, facing, Math.hypot(dx, dz));
    }
    onUp(e) {
      if (e.button === 1 || (this.rotating && e.button === 0)) { this.rotating = null; if (e.button === 1) return; }
      if (e.button === 0 && this.drag) {
        const d = this.drag; this.drag = null;
        const box = this.$('.b-selbox'); box.style.display = 'none';
        const w = Math.abs(e.clientX - d.x), h = Math.abs(e.clientY - d.y);
        if (!d.shift) this.selected.clear();
        if (w + h > 8) {
          const x0 = Math.min(d.x, e.clientX), x1 = Math.max(d.x, e.clientX), y0 = Math.min(d.y, e.clientY), y1 = Math.max(d.y, e.clientY);
          for (const u of this.battle.units) {
            if (u.side !== 0 || u.gone) continue;
            let inside = false;
            for (let i = 0; i < u.count && !inside; i += 3) {
              if (!u.sa[i]) continue;
              const p = this.screenPos(u.sx[i], u.sy[i] + 1, u.sz[i]);
              if (p && p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1) inside = true;
            }
            if (inside) this.selected.add(u);
          }
        } else {
          const u = this.unitAtScreen(e.clientX, e.clientY);
          if (u && u.side === 0) {
            if (d.shift && this.selected.has(u)) this.selected.delete(u); else this.selected.add(u);
          }
          this.inspect = u || null;
        }
        if (this.selected.size) RW.audio.play('select');
        this.refreshCards(); this.refreshInfo();
      }
      if (e.button === 2 && this.rdrag) {
        const r = this.rdrag; this.rdrag = null;
        this.view.ghost.count = 0;
        if (!this.selected.size || ui.modalOpen) return;
        if (r.moved && r.plan) {
          const plan = this.dragPlan(r.plan.a, r.plan.b);
          for (const p of plan) { this.battle.issueMove(p.u, p.x, p.z, p.facing); this.view.orderMarker(p.x, p.z); }
          RW.audio.play('order');
          return;
        }
        const target = this.unitAtScreen(e.clientX, e.clientY);
        if (target && target.side !== 0) { this.attackOrder(target); return; }
        const g = this.groundAt(e.clientX, e.clientY);
        if (!g) return;
        const gate = this.battle.map.gate;
        if (gate && gate.hp > 0 && this.battle.attackerSide === 0 && this.battle.phase === 'battle' && Math.hypot(g.x - gate.x, g.z - gate.z) < 9) {
          for (const u of this.selList) u.orderGate();
          this.view.orderMarker(gate.x, gate.z + 4, '#ffb03a');
          RW.audio.play('order');
          ui.toast('Attacking the gate!');
          return;
        }
        this.moveOrder(g.x, g.z);
      }
    }
    onKey(e) {
      if (ui.modalOpen || this.ended) { if (e.code === 'Escape' && ui.modalOpen && !this.ended) { ui.closeModal(); } return; }
      const k = e.code;
      if (k === 'Space') { e.preventDefault(); if (this.battle.phase === 'deploy') this.startBattle(); else this.togglePause(); }
      else if (k === 'Digit1') this.setSpeed(1);
      else if (k === 'Digit2') this.setSpeed(2);
      else if (k === 'Digit3') this.setSpeed(3);
      else if (k === 'KeyZ') this.useAbility(0);
      else if (k === 'KeyX') this.useAbility(1);
      else if (k === 'KeyC') this.useAbility(2);
      else if (k === 'KeyT') this.setFormation('line');
      else if (k === 'KeyY') this.setFormation('defensive');
      else if (k === 'KeyU') this.setFormation('loose');
      else if (k === 'KeyG') this.toggleHold();
      else if (k === 'KeyH') this.haltSel();
      else if (k === 'KeyA' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        for (const u of this.battle.units) if (u.side === 0 && u.active) this.selected.add(u);
        this.refreshCards(); this.refreshInfo();
      } else if (k === 'Escape') {
        if (this.targeting) this.targeting = null;
        else if (this.selected.size) { this.selected.clear(); this.refreshCards(); this.refreshInfo(); }
        else this.openMenu();
      }
    }

    bindEvents() {
      const b = this.battle;
      const msgs = this.$('.b-msgs');
      b.on('message', (m) => {
        const el = U.html(`<div class="bmsg ${m.kind} ${m.side === 0 ? 'mine' : 'foe'}">${U.escape(m.text)}</div>`);
        msgs.appendChild(el);
        while (msgs.children.length > 5) msgs.removeChild(msgs.firstChild);
        setTimeout(() => el.classList.add('fade'), 4500);
        setTimeout(() => el.remove(), 5200);
      });
      b.on('clash', () => RW.audio.play('clash', 70));
      b.on('volley', (u, kind) => { if (this.near(u)) RW.audio.play(kind === 'boulder' ? 'thud' : kind === 'magic' || kind === 'bolt' ? 'magic' : 'arrows', 120); });
      b.on('impact', (p) => { RW.audio.play(p.explode === 'meteor' || p.explode === 'fire' || p.explode === 'quake' ? 'boom' : 'thud', 80); });
      b.on('charge', (a) => { if (this.near(a)) RW.audio.play('charge', 300); });
      b.on('rout', (u) => { if (u.side === 0) RW.audio.play('rout', 400); });
      b.on('ability', (a) => RW.audio.play(a.sound || 'magic'));
      b.on('gate', () => RW.audio.play('boom'));
      b.on('gatehit', () => RW.audio.play('thud', 400));
      b.on('end', (res) => this.onEnd(res));
    }
    near(u) { return Math.hypot(u.x - this.rts.tx, u.z - this.rts.tz) < 30 + this.rts.dist * 1.2; }

    // ---------------------------------------------------------------- frame
    update(dt) {
      const b = this.battle;
      if (!ui.modalOpen) this.rts.update(dt, true);
      else this.rts.update(dt, false);
      if (!this.paused && !this.ended && b.phase === 'battle') {
        this.acc += Math.min(dt, 0.1) * this.speed;
        let steps = 0;
        while (this.acc >= STEP && steps < 8) { b.step(STEP); this.acc -= STEP; steps++; }
        if (steps >= 8) this.acc = 0;
      }
      this.view.update(this.paused ? 0 : dt * (b.phase === 'battle' ? this.speed : 1), this);
      // Hover
      if (this.mouse.moved && !this.drag) {
        this.mouse.moved = false;
        const over = document.elementFromPoint(this.mouse.x, this.mouse.y);
        this.hoverUnit = over === this.app.canvas ? this.unitAtScreen(this.mouse.x, this.mouse.y) : null;
        const cur = this.targeting ? 'crosshair' : this.hoverUnit && this.hoverUnit.side !== 0 && this.selected.size ? 'var(--cur-attack)' : 'default';
        this.app.canvas.style.cursor = cur === 'var(--cur-attack)' ? 'crosshair' : cur;
        this.app.canvas.classList.toggle('attack-cursor', !!(this.hoverUnit && this.hoverUnit.side !== 0 && this.selected.size));
      }
      // Targeting ring
      if (this.targeting) {
        const g = this.groundAt(this.mouse.x, this.mouse.y, true);
        const def = RW.data.ABILITIES[this.targeting];
        if (g) { this.targetRing.visible = true; this.targetRing.position.set(g.x, b.map.heightAt(g.x, g.z) + 0.6, g.z); this.targetRing.scale.set(def.radius, 1, def.radius); }
      } else this.targetRing.visible = false;
      this.updateBanners();
      this.uiTimer -= dt;
      if (this.uiTimer <= 0) {
        this.uiTimer = 0.2;
        this.refreshCards();
        if (this.selected.size === 1 || this.inspect) this.refreshInfo();
        this.updateTop();
        ui.refreshTip();
        for (const u of [...this.selected]) if (u.gone) this.selected.delete(u);
        let engaged = 0;
        for (const u of b.units) if (u.state === 'fighting') engaged++;
        RW.audio.din(b.phase === 'battle' && !this.paused ? engaged / 8 : 0);
      }
      this.miniTimer -= dt;
      if (this.miniTimer <= 0) { this.miniTimer = 0.15; this.drawMini(); }
      // Abilities
      const sd = b.sides[0];
      const genDead = !sd.general || sd.general.gone;
      sd.abilities.forEach((a, i) => {
        const el = this.abilityEls[i];
        const frac = a.cd > 0 ? a.cd / a.cdMax : 0;
        el.style.setProperty('--cdp', (frac * 360) + 'deg');
        el.classList.toggle('ready', frac === 0 && !genDead && b.phase === 'battle');
        el.classList.toggle('disabled', genDead);
        el.classList.toggle('targeting', this.targeting === a.id);
        el.querySelector('.cd').textContent = a.cd > 0 ? Math.ceil(a.cd) : '';
      });
    }

    updateTop() {
      const b = this.battle;
      const p0 = b.sidePower(0), p1 = b.sidePower(1);
      const tot = Math.max(1, p0 + p1);
      this.$('.b-forcebar .mine').style.width = (p0 / tot) * 100 + '%';
      this.$('.b-forcebar .theirs').style.width = (p1 / tot) * 100 + '%';
      this.$('.b-forcebar')._tip = () => `<b>Balance of power</b><br>Your army: ${Math.round(p0)} · Enemy: ${Math.round(p1)}<br>Your men: ${b.units.filter((u) => u.side === 0 && u.active).reduce((a, u) => a + u.alive, 0)} · Enemy men: ${b.units.filter((u) => u.side === 1 && u.active && !u.hidden).reduce((a, u) => a + u.alive, 0)}${b.units.some((u) => u.side === 1 && u.hidden) ? '+ (hidden)' : ''}`;
      this.$('.b-forcebar').classList.add('has-tip');
      const left = b.timeLimit - b.time;
      this.$('.b-timer').textContent = U.fmtTime(b.time) + (left < 180 ? ` (${U.fmtTime(left)} left)` : '');
      if (b.map.gate && b.map.gate.hp > 0 && b.phase === 'battle') this.$('.b-map-name').textContent = `Gate: ${Math.round((b.map.gate.hp / b.map.gate.maxHp) * 100)}%` + (b.attackerSide === 0 ? ' · Right-click the gate to batter it' : '');
      else if (b.map.gate) this.$('.b-map-name').textContent = 'The gate is broken!';
    }

    updateBanners() {
      const W = window.innerWidth, H = window.innerHeight;
      const far = this.rts.dist > 220;
      for (const [u, el] of this.bannerEls) {
        if (u.gone || (u.hidden && u.side !== 0)) { el.style.display = 'none'; continue; }
        const h = this.battle.map.heightAt(u.x, u.z) + (u.large ? 8 : 4.5) + (u.cat === 'monster' && u.t.model.type === 'behemoth' ? 4 : 0);
        const p = this.screenPos(u.x, h, u.z);
        if (!p || p.x < -40 || p.x > W + 40 || p.y < -40 || p.y > H + 40) { el.style.display = 'none'; continue; }
        el.style.display = 'flex';
        el.style.transform = `translate(${p.x | 0}px, ${p.y | 0}px)`;
        el.classList.toggle('sel', this.selected.has(u));
        el.classList.toggle('routing', u.state === 'routing');
        el.classList.toggle('small', far);
        el.firstElementChild.nextElementSibling.firstElementChild.style.width = (u.alive / u.count) * 100 + '%';
      }
    }

    onEnd(res) {
      if (this.ended) return;
      this.ended = true;
      this.paused = false;
      RW.audio.din(0);
      setTimeout(() => {
        RW.audio.play(res.playerWon ? 'victory' : 'defeat');
        const b = this.battle;
        const rows = b.units.filter((u) => u.side === 0).map((u) => `<tr class="${u.state === 'dead' ? 'dead' : ''}"><td>${RW.unitIcon(u.typeId)} ${U.escape(u.isGeneral ? u.name : u.name)}</td><td>${u.state === 'dead' ? 0 : u.alive}/${u.startAlive}</td><td>${u.kills}</td></tr>`).join('');
        const title = res.reason === 'retreat' ? 'Retreat' : res.playerWon ? (res.lost[1] / Math.max(1, res.start[1]) > 0.75 && res.lost[0] / Math.max(1, res.start[0]) < 0.3 ? 'Heroic Victory!' : 'Victory!') : 'Defeat';
        const sub = res.reason === 'time' ? 'Time ran out.' : res.reason === 'retreat' ? 'You withdrew from the field.' : res.playerWon ? 'The enemy flees the field!' : 'Your army has been broken.';
        ui.modal({
          title: `<span class="${res.playerWon ? 'win' : 'lose'}">${title}</span>`,
          cls: 'results',
          body: `<p class="center">${sub} · Battle time ${U.fmtTime(res.duration)}</p>
            <div class="res-grid">
              <div><h3>${ui.emblem(b.sides[0].faction, 26)} Your army</h3><p>Lost ${res.lost[0]} of ${res.start[0]} · Killed ${res.kills[0]}</p></div>
              <div><h3>${ui.emblem(b.sides[1].faction, 26)} Enemy</h3><p>Lost ${res.lost[1]} of ${res.start[1]} · Killed ${res.kills[1]}</p></div>
            </div>
            <table class="res-units"><tr><th>Unit</th><th>Survivors</th><th>Kills</th></tr>${rows}</table>`,
          buttons: [{ label: 'Continue', cls: 'primary', onClick: () => this.finish(res) }],
        });
      }, res.reason === 'retreat' ? 100 : 1500);
    }
    finish(res) {
      const done = this.onDone;
      this.onDone = null;
      if (done) done(res);
    }

    resize() {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
    }
    dispose() {
      for (const f of this.unbind || []) f();
      RW.audio.din(0);
      this.view.dispose();
      this.targetRing.geometry.dispose(); this.targetRing.material.dispose();
      // Only remove our own HUD - the next scene may already have built its own.
      if (this.hud) this.hud.remove();
      ui.hideTip();
      this.app.canvas.style.cursor = 'default';
      this.app.canvas.classList.remove('attack-cursor');
    }
  }

  RW.BattleScene = BattleScene;
})();
