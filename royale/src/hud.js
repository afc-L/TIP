// In-match interface: bars, hotbar, minimap, full map, kill feed, crosshair, prompts, damage numbers.
import * as THREE from 'three';
import { RARITY, MAP_HALF } from './config.js';
import { AMMO } from './items.js';
import { fmtTime, clamp } from './util.js';
import { BUS_ROUTE_COLOR } from './mapdraw.js';

const $ = (id) => document.getElementById(id);
const _v = new THREE.Vector3();
const ICON = { ar: 'AR', shotgun: 'SG', smg: 'SMG', sniper: 'SR', pistol: 'P', explosive: 'RL', special: 'SP' };

export class HUD {
  constructor(game) {
    this.game = game;
    this.root = $('hud');
    this.mini = $('minimap');
    this.miniCtx = this.mini.getContext('2d');
    this.big = $('bigmap-canvas');
    this.bigCtx = this.big.getContext('2d');
    this.feed = $('killfeed');
    this.dmgLayer = $('dmgnums');
    this.dmgPool = [];
    for (let i = 0; i < 30; i++) {
      const d = document.createElement('div');
      d.className = 'dmgnum';
      d.style.display = 'none';
      this.dmgLayer.appendChild(d);
      this.dmgPool.push({ el: d, life: 0, x: 0, y: 0, z: 0 });
    }
    this.hitT = 0;
    this.noteQ = [];
    this.noteT = 0;
    this.dmgDirs = [];
    this.lastHot = '';
    this.fpsT = 0; this.fpsN = 0;
    // build the hotbar
    const hb = $('hotbar');
    hb.innerHTML = '';
    this.slotEls = [];
    for (let i = -1; i < 5; i++) {
      const el = document.createElement('div');
      el.className = 'slot' + (i < 0 ? ' pick' : '');
      el.innerHTML = `<div class="key">${i < 0 ? 'F' : i + 1}</div><div class="ico"></div><div class="cnt"></div>`;
      hb.appendChild(el);
      this.slotEls.push(el);
    }
  }

  show(on) { this.root.classList.toggle('hidden', !on); }

  hitmarker(head, harvest) {
    const el = $('hitmarker');
    el.className = head ? 'head show' : harvest ? 'harvest show' : 'show';
    this.hitT = 0.15;
  }

  damageNumber(target, amount, shield, head) {
    const d = this.dmgPool.find((p) => p.life <= 0) || this.dmgPool[0];
    d.life = 0.9;
    d.x = target.pos.x + (Math.random() - 0.5) * 0.6;
    d.y = target.pos.y + 2.1;
    d.z = target.pos.z + (Math.random() - 0.5) * 0.6;
    d.el.textContent = Math.round(amount);
    d.el.className = 'dmgnum' + (head ? ' head' : shield ? ' shield' : '');
    d.el.style.display = 'block';
  }

  damageFrom(attackerPos) {
    this.dmgDirs.push({ x: attackerPos.x, z: attackerPos.z, t: 1.2 });
    if (this.dmgDirs.length > 4) this.dmgDirs.shift();
    $('hurtflash').style.opacity = 0.45;
  }

  killFeed(text, mine) {
    const el = document.createElement('div');
    el.className = 'kf' + (mine ? ' mine' : '');
    el.innerHTML = text;
    this.feed.prepend(el);
    while (this.feed.children.length > 6) this.feed.lastChild.remove();
    setTimeout(() => el.classList.add('fade'), 5500);
    setTimeout(() => el.remove(), 6200);
  }

  notify(text, sub = '', cls = '') {
    this.noteQ.push({ text, sub, cls });
  }

  elimBanner(name) {
    const el = $('elimbanner');
    el.innerHTML = `<span>ELIMINATED</span> ${name}`;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  }

  update(dt) {
    const g = this.game, a = g.player;
    if (!a) return;
    // FPS
    this.fpsN++; this.fpsT += g.realDt;
    if (this.fpsT > 0.5) {
      $('fps').textContent = g.settings.showFps ? `${Math.round(this.fpsN / this.fpsT)} FPS` : '';
      this.fpsN = 0; this.fpsT = 0;
    }
    // bars
    $('hp-fill').style.width = a.health + '%';
    $('hp-num').textContent = Math.ceil(a.health);
    $('sh-fill').style.width = a.shield + '%';
    $('sh-num').textContent = Math.ceil(a.shield);
    // mats
    for (const m of ['wood', 'stone', 'metal']) {
      const el = $('mat-' + m);
      el.querySelector('b').textContent = a.mats[m];
      el.classList.toggle('sel', a.buildMode && a.buildMat === m);
    }
    // ammo reserves
    $('ammo-res').innerHTML = Object.keys(AMMO).map((k) => `<span style="color:#${AMMO[k].color.toString(16).padStart(6, '0')}">${k[0].toUpperCase()}${k.slice(1, 3)} <b>${a.ammo[k]}</b></span>`).join('');
    // hotbar
    for (let i = -1; i < 5; i++) {
      const el = this.slotEls[i + 1];
      const it = i < 0 ? null : a.slots[i];
      el.classList.toggle('sel', a.sel === i && !a.buildMode);
      if (i < 0) { el.querySelector('.ico').textContent = '⛏'; continue; }
      const key = it ? `${it.id}:${it.count || 0}:${it.ammoIn || 0}` : '';
      if (el.dataset.k === key) continue;
      el.dataset.k = key;
      if (!it) { el.style.borderColor = ''; el.style.background = ''; el.querySelector('.ico').textContent = ''; el.querySelector('.cnt').textContent = ''; el.title = ''; continue; }
      const r = RARITY[it.rarity];
      el.style.borderColor = r.color;
      el.style.background = `linear-gradient(160deg, ${r.color}55, #0008)`;
      el.querySelector('.ico').textContent = it.kind === 'weapon' ? ICON[it.def.cat] : it.def.throwable ? '✹' : it.def.shield && !it.def.heal ? '◆' : '✚';
      el.querySelector('.cnt').textContent = it.kind === 'weapon' ? it.ammoIn : 'x' + it.count;
      el.title = it.name;
    }
    // held item info / ammo
    const held = a.held;
    const wi = $('weapon-info');
    if (a.buildMode) wi.innerHTML = `<b>BUILD</b> ${a.buildMat.toUpperCase()} <small>(R to switch)</small>`;
    else if (held && held.kind === 'weapon') {
      const r = RARITY[held.rarity];
      wi.innerHTML = `<span style="color:${r.color}">${held.name}</span> <b class="mag">${held.def.mag >= 999 ? a.ammo[held.def.ammo] : held.ammoIn}</b><small>/${held.def.mag >= 999 ? '∞' : a.ammo[held.def.ammo]}</small>`;
    } else if (held) wi.innerHTML = `<span style="color:${RARITY[held.rarity].color}">${held.name}</span> x${held.count}`;
    else wi.innerHTML = '<span>Harvesting Tool</span>';
    // progress bars (reload / use / chest)
    const pb = $('progress');
    let prog = 0, label = '';
    if (a.reloadT > 0 && held && held.kind === 'weapon') { prog = 1 - a.reloadT / held.reload; label = 'Reloading'; }
    else if (a.useItem) { prog = 1 - a.useT / a.useItem.def.use; label = 'Using ' + a.useItem.name; }
    else if (g.playerCtl.chestHold > 0) { prog = g.playerCtl.chestHold / 0.4; label = 'Opening'; }
    pb.style.display = prog > 0 ? 'block' : 'none';
    if (prog > 0) { $('progress-fill').style.width = clamp(prog, 0, 1) * 100 + '%'; $('progress-label').textContent = label; }
    // crosshair spread
    const ch = $('crosshair');
    let spread = 6;
    if (held && held.kind === 'weapon') spread = 4 + g.combat.spreadFor(a, held) * 380;
    ch.style.setProperty('--s', Math.min(60, spread) + 'px');
    ch.className = a.buildMode ? 'build' : held && held.def && held.def.cat === 'shotgun' ? 'shotgun' : '';
    $('scope').style.display = a.ads && held && held.def && held.def.scope && a.alive ? 'block' : 'none';
    // hitmarker
    if (this.hitT > 0) { this.hitT -= dt; if (this.hitT <= 0) $('hitmarker').className = ''; }
    // interaction prompt
    const ip = $('interact');
    const it = g.playerCtl.interact;
    if (it && a.alive) {
      let txt = '';
      if (it.kind === 'pickup') {
        const p = it.obj;
        const col = p.kind === 'item' ? RARITY[p.data.rarity].color : '#fff';
        const full = p.kind === 'item' && a.freeSlot() < 0 && !(p.data.kind === 'consumable' && a.slots.some((s) => s && s.type === p.data.type && s.count < s.def.stack));
        txt = `<kbd>E</kbd> ${full ? 'Swap for' : 'Pick up'} <b style="color:${col}">${p.label()}</b>`;
        if (p.kind === 'item' && p.data.kind === 'weapon') txt += `<small>${RARITY[p.data.rarity].name} · ${Math.round(p.data.dmg * (p.data.def.pellets || 1))} dmg · ${p.data.def.mag >= 999 ? '∞' : p.data.def.mag} mag</small>`;
      } else if (it.kind === 'chest') txt = `<kbd>E</kbd> Hold to open <b style="color:#ffd23f">${it.obj.mythic ? 'Vault Chest' : it.obj.rare ? 'Rare Chest' : 'Chest'}</b>`;
      else if (it.kind === 'drop') txt = `<kbd>E</kbd> Hold to open <b style="color:#5ac8ff">Supply Drop</b>`;
      else if (it.kind === 'repair') txt = `<kbd>E</kbd> Hold to repair (${Math.round(it.obj.hp)}/${it.obj.maxHp})`;
      ip.innerHTML = txt; ip.style.display = 'block';
    } else ip.style.display = 'none';
    // build bar
    const bb = $('buildbar');
    bb.style.display = a.buildMode || g.playerCtl.editing ? 'flex' : 'none';
    if (a.buildMode) {
      for (const el of bb.children) el.classList.toggle('sel', el.dataset.p === g.playerCtl.buildType);
    }
    $('edithint').style.display = g.playerCtl.editing ? 'block' : 'none';
    // top-right info
    const s = g.storm;
    const lab = s.phaseLabel();
    $('storm-info').innerHTML = `<span class="ico">◷</span> ${lab.text} <b>${lab.t > 0 ? fmtTime(lab.t) : ''}</b>`;
    $('alive').innerHTML = `<span class="ico">👤</span> ${g.aliveCount}`;
    $('kills').innerHTML = `<span class="ico">✖</span> ${a.kills}`;
    // in-storm warning
    const inStorm = a.alive && a.mode !== 'bus' && s.started && s.inStorm(a.pos.x, a.pos.z);
    $('stormfx').style.opacity = inStorm ? 0.55 : 0;
    $('storm-warn').style.display = inStorm ? 'block' : 'none';
    // jump prompt / phase prompts
    const jp = $('jumpprompt');
    if (a.mode === 'bus') { jp.style.display = 'block'; jp.innerHTML = g.bus.doorsOpen ? '<kbd>SPACE</kbd> Jump from the Sky Barge' : 'Doors opening...'; }
    else if (a.mode === 'skydive') { jp.style.display = 'block'; jp.innerHTML = '<kbd>W</kbd> + look down to dive · <kbd>SPACE</kbd> deploy glider'; }
    else jp.style.display = 'none';
    // hurt flash fade
    const hf = $('hurtflash');
    const op = parseFloat(hf.style.opacity || 0);
    if (op > 0) hf.style.opacity = Math.max(0, op - dt * 1.5);
    // damage direction
    const dd = $('dmgdir');
    let html = '';
    for (const d of this.dmgDirs) {
      d.t -= dt;
      if (d.t <= 0) continue;
      const ang = Math.atan2(d.x - a.pos.x, d.z - a.pos.z);
      const rel = -(ang - Math.atan2(-Math.sin(g.playerCtl.yaw), -Math.cos(g.playerCtl.yaw)));
      html += `<div class="arc" style="transform: rotate(${rel}rad); opacity:${Math.min(1, d.t)}"></div>`;
    }
    this.dmgDirs = this.dmgDirs.filter((d) => d.t > 0);
    dd.innerHTML = html;
    // notifications
    this.noteT -= dt;
    const nb = $('notice');
    if (this.noteT <= 0) {
      if (this.noteQ.length) {
        const n = this.noteQ.shift();
        nb.innerHTML = `<div class="t">${n.text}</div>${n.sub ? `<div class="s">${n.sub}</div>` : ''}`;
        nb.className = 'show ' + n.cls;
        this.noteT = 3.2;
      } else nb.className = '';
    }
    // damage numbers
    const cam = g.camera;
    const W = window.innerWidth, H = window.innerHeight;
    for (const d of this.dmgPool) {
      if (d.life <= 0) continue;
      d.life -= dt;
      d.y += dt * 0.9;
      _v.set(d.x, d.y, d.z).project(cam);
      if (d.life <= 0 || _v.z > 1) { d.el.style.display = 'none'; continue; }
      d.el.style.transform = `translate(${(_v.x * 0.5 + 0.5) * W}px, ${(-_v.y * 0.5 + 0.5) * H}px) scale(${0.8 + d.life * 0.4})`;
      d.el.style.opacity = Math.min(1, d.life * 2);
    }
    // spectating banner
    const sp = $('spectate');
    if (!a.alive && g.playerCtl.spectate) { sp.style.display = 'block'; sp.innerHTML = `Spectating <b>${g.playerCtl.spectate.name}</b> · ${g.aliveCount} left · <kbd>ESC</kbd> menu`; }
    else sp.style.display = 'none';
    this.drawMinimap();
    if (g.mapOpen) this.drawBigMap();
  }

  // world -> map image px
  drawMinimap() {
    const g = this.game, a = g.player, ctx = this.miniCtx, img = g.mapImage;
    const W = this.mini.width, H = this.mini.height;
    const focus = a.alive ? (a.mode === 'bus' ? g.bus.pos : a.pos) : (g.playerCtl.spectate ? g.playerCtl.spectate.pos : a.pos);
    const range = a.mode === 'bus' || a.airborne ? 600 : 220;   // metres across
    const s = img.width / (MAP_HALF * 2);
    const sx = (focus.x + MAP_HALF) * s - (range * s) / 2, sz = (focus.z + MAP_HALF) * s - (range * s) / 2;
    ctx.fillStyle = '#2e8fd6';
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(img, sx, sz, range * s, range * s, 0, 0, W, H);
    const k = W / range;
    const toM = (x, z) => [(x - focus.x) * k + W / 2, (z - focus.z) * k + H / 2];
    this.drawStorm(ctx, toM, k, W, H);
    // supply drops
    for (const d of g.loot.drops) if (!d.opened) { const [x, y] = toM(d.x, d.z); ctx.fillStyle = '#4fc3ff'; ctx.fillRect(x - 4, y - 4, 8, 8); }
    // player arrow
    const [px, py] = toM(focus.x, focus.z);
    this.arrow(ctx, px, py, a.alive ? a.yaw : 0, 7);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, W - 2, H - 2);
  }

  drawStorm(ctx, toM, k, W, H) {
    const s = this.game.storm;
    // storm outside area
    const [cx, cy] = toM(s.cx, s.cz);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.arc(cx, cy, Math.max(0, s.r * k), 0, Math.PI * 2, true);
    ctx.fillStyle = 'rgba(140,50,230,0.42)';
    ctx.fill('evenodd');
    ctx.restore();
    ctx.beginPath(); ctx.arc(cx, cy, Math.max(0, s.r * k), 0, Math.PI * 2);
    ctx.strokeStyle = '#c070ff'; ctx.lineWidth = 2; ctx.stroke();
    if (s.state !== 'done') {
      const [nx, ny] = toM(s.next.x, s.next.z);
      ctx.beginPath(); ctx.arc(nx, ny, Math.max(1, s.next.r * k), 0, Math.PI * 2);
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.stroke();
    }
  }

  arrow(ctx, x, y, yaw, r) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-yaw);
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.3); ctx.lineTo(r * 0.8, r); ctx.lineTo(0, r * 0.45); ctx.lineTo(-r * 0.8, r); ctx.closePath();
    ctx.fillStyle = '#ffd23f'; ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
  }

  drawBigMap() {
    const g = this.game, ctx = this.bigCtx, img = g.mapImage;
    const S = Math.min(window.innerWidth, window.innerHeight) * 0.86;
    if (this.big.width !== Math.round(S)) { this.big.width = this.big.height = Math.round(S); }
    const W = this.big.width;
    ctx.fillStyle = '#2e8fd6'; ctx.fillRect(0, 0, W, W);
    ctx.drawImage(img, 0, 0, W, W);
    const k = W / (MAP_HALF * 2);
    const toM = (x, z) => [(x + MAP_HALF) * k, (z + MAP_HALF) * k];
    // labels
    ctx.textAlign = 'center';
    for (const l of g.world.labels) {
      const [x, y] = toM(l.x, l.z);
      ctx.font = l.big ? `bold ${Math.round(W / 55)}px system-ui` : `italic ${Math.round(W / 75)}px system-ui`;
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.strokeText(l.name.toUpperCase(), x, y);
      ctx.fillStyle = l.big ? '#fff' : '#ffe9a8';
      ctx.fillText(l.name.toUpperCase(), x, y);
    }
    this.drawStorm(ctx, toM, k, W, W);
    // bus route
    if (g.bus.start_ && (g.player.mode === 'bus' || g.bus.active)) {
      const [x0, y0] = toM(g.bus.start_.x, g.bus.start_.z), [x1, y1] = toM(g.bus.end_.x, g.bus.end_.z);
      ctx.setLineDash([8, 6]); ctx.strokeStyle = BUS_ROUTE_COLOR; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.setLineDash([]);
      const [bx, by] = toM(g.bus.pos.x, g.bus.pos.z);
      ctx.fillStyle = '#3fa9f5'; ctx.beginPath(); ctx.arc(bx, by, 7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    }
    for (const d of g.loot.drops) if (!d.opened) { const [x, y] = toM(d.x, d.z); ctx.fillStyle = '#4fc3ff'; ctx.fillRect(x - 6, y - 6, 12, 12); ctx.strokeStyle = '#fff'; ctx.strokeRect(x - 6, y - 6, 12, 12); }
    const a = g.player;
    const f = a.mode === 'bus' ? g.bus.pos : a.pos;
    const [px, py] = toM(f.x, f.z);
    this.arrow(ctx, px, py, a.yaw, 9);
    // marker
    if (g.mapMarker) { const [mx, my] = toM(g.mapMarker.x, g.mapMarker.z); ctx.fillStyle = '#ff4f6d'; ctx.beginPath(); ctx.arc(mx, my, 6, 0, Math.PI * 2); ctx.fill(); }
    $('bigmap-info').innerHTML = `${g.storm.phaseLabel().text} ${g.storm.phaseLabel().t > 0 ? fmtTime(g.storm.phaseLabel().t) : ''} · ${g.aliveCount} players left · Click to place a marker`;
  }
}
