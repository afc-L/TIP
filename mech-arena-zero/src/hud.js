// In-match HUD (DOM overlay + minimap canvas).
import * as THREE from 'three';
import { DAMAGE_TYPES } from './data.js';
import { profile } from './save.js';
import { Input, keyName } from './input.js';
import { fmtTime, clamp } from './util.js';

const _v = new THREE.Vector3(), _w = new THREE.Vector3();
const $ = (id) => document.getElementById(id);

export class Hud {
  constructor(game) {
    this.game = game;
    this.root = $('hud');
    this.root.innerHTML = TEMPLATE;
    this.root.classList.remove('hidden');
    this.el = {};
    this.root.querySelectorAll('[data-h]').forEach((e) => { this.el[e.dataset.h] = e; });
    this.markers = []; this.arrows = []; this.arcs = [];
    this.bannerT = 0; this.toasts = []; this.feed = [];
    this.slowT = 0; this.fps = 0; this.fpsAcc = 0; this.fpsN = 0;
    this.rebuildLoadout();
    this.buildMinimapBase();
    this.el.fps.style.display = profile.settings.showFps ? 'block' : 'none';
    this.hitT = 0; this.lowHpWarn = false;
  }

  rebuildLoadout() {
    const p = this.game.player;
    this.el.frame.textContent = `${p.frame.name.toUpperCase()} · ${p.frame.cls.toUpperCase()}`;
    const keys = profile.settings.keys;
    this.el.weapons.innerHTML = p.weapons.map((w, i) => `
      <div class="wcard ${i === 1 && p.mods.noSecondary ? 'disabled' : ''}" data-w="${i}">
        <div class="wkey">${i === 0 ? 'LMB' : 'RMB'}</div>
        <div class="wname">${w.def.name}<span class="dtype" style="color:${DAMAGE_TYPES[w.def.dmgType].color}">${DAMAGE_TYPES[w.def.dmgType].name}</span></div>
        <div class="wstat"></div>
        <div class="wbar"><div></div></div>
      </div>`).join('');
    this.wcards = [...this.el.weapons.querySelectorAll('.wcard')].map((c) => ({ c, stat: c.querySelector('.wstat'), bar: c.querySelector('.wbar div') }));
    this.el.equips.innerHTML = p.equip.map((e, i) => `
      <div class="eslot ${p.mods.noEquip ? 'disabled' : ''}" data-e="${i}" title="${e.def.name}">
        <div class="ekey">${keyName(keys['slot' + (i + 1)])}</div><div class="eicon">${e.def.icon}</div><div class="ename">${e.def.name}</div><div class="ecd"></div>
      </div>`).join('') + `
      <div class="eslot ability ${p.mods.noAbility ? 'disabled' : ''}" title="${p.ability.def.name}">
        <div class="ekey">${keyName(keys.ability)}</div><div class="eicon">★</div><div class="ename">${p.ability.def.name}</div><div class="ecd"></div>
      </div>`;
    this.eslots = [...this.el.equips.querySelectorAll('.eslot')].map((c) => ({ c, cd: c.querySelector('.ecd') }));
    this.el.hint.innerHTML = `${keyName(keys.equipUse)}: use selected equipment · ${keyName(keys.lock)}: lock · ${keyName(keys.dash)}: dash · ${keyName(keys.reload)}: reload/vent · Hold ${keyName(keys.scoreboard)}: scores · Esc: pause`;
  }

  buildMinimapBase() {
    const a = this.game.arena;
    const k = 2, size = Math.ceil(a.half * 2 * k);
    const c = document.createElement('canvas'); c.width = c.height = size;
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(10,20,30,0.85)'; ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = 'rgba(80,200,255,0.08)'; ctx.lineWidth = 1;
    for (let i = 0; i < size; i += 20 * k) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, size); ctx.moveTo(0, i); ctx.lineTo(size, i); ctx.stroke(); }
    for (const h of a.hazards) { ctx.fillStyle = 'rgba(255,90,20,0.45)'; ctx.fillRect((h.minX + a.half) * k, (h.minZ + a.half) * k, (h.maxX - h.minX) * k, (h.maxZ - h.minZ) * k); }
    for (const b of a.boxes) {
      if (b.maxY < 1) continue;
      const t = clamp(b.maxY / 16, 0.2, 1);
      ctx.fillStyle = `rgba(${120 + t * 60},${170 + t * 50},${200 + t * 40},${0.25 + t * 0.35})`;
      ctx.fillRect((b.minX + a.half) * k, (b.minZ + a.half) * k, (b.maxX - b.minX) * k, (b.maxZ - b.minZ) * k);
    }
    ctx.strokeStyle = 'rgba(120,220,255,0.6)'; ctx.lineWidth = 3; ctx.strokeRect(0, 0, size, size);
    this.mmBase = c; this.mmK = k;
    this.mm = this.el.minimap.getContext('2d');
  }

  // ---------------- events ----------------
  banner(title, sub = '', dur = 2.5) {
    this.el.banner.innerHTML = `<div class="bt">${title}</div><div class="bs">${sub}</div>`;
    this.el.banner.classList.add('show');
    this.bannerT = dur;
  }
  toast(text, color = '#ffb347') {
    if (this.toasts.some((t) => t.text === text && t.t > 0.6)) return;
    const d = document.createElement('div'); d.className = 'toast'; d.textContent = text; d.style.color = color;
    this.el.toasts.appendChild(d);
    this.toasts.push({ d, t: 2.2, text });
    if (this.toasts.length > 4) { const o = this.toasts.shift(); o.d.remove(); }
  }
  showCondition(c) {
    if (!c || c.name === 'Clear Skies') return;
    this.toast(`CONDITION: ${c.name.toUpperCase()} — ${c.desc}`, '#7fe8ff');
  }
  hitmarker(crit, kill, immune) {
    const h = this.el.hitmarker;
    h.className = 'hitmarker show' + (crit ? ' crit' : '') + (kill ? ' kill' : '') + (immune ? ' immune' : '');
    this.hitT = kill ? 0.35 : 0.15;
  }
  damageFrom(pos, amount) {
    const g = this.game;
    const dx = pos.x - g.player.pos.x, dz = pos.z - g.player.pos.z;
    const yaw = g.camYaw;
    const fwd = dx * Math.sin(yaw) + dz * Math.cos(yaw);
    const right = -dx * Math.cos(yaw) + dz * Math.sin(yaw);
    const ang = Math.atan2(right, fwd);
    let a = this.arcs.find((x) => x.t <= 0);
    if (!a) {
      if (this.arcs.length >= 6) a = this.arcs[0];
      else { const d = document.createElement('div'); d.className = 'dmgarc'; this.el.arcs.appendChild(d); a = { d, t: 0 }; this.arcs.push(a); }
    }
    a.t = 1.0; a.d.style.transform = `rotate(${ang}rad)`;
    a.d.style.opacity = '1';
    a.d.style.setProperty('--w', `${clamp(amount / 60, 0.4, 1.4)}`);
    this.el.vignette.style.opacity = String(clamp(0.25 + amount / 200, 0, 0.8));
  }
  flashHazard() { this.el.vignette.style.opacity = '0.5'; this.el.vignette.classList.add('fire'); this.toast('WARNING: LAVA — ARMOR BURNING', '#ff6a2a'); }
  killfeed(killer, victim) {
    const kc = killer ? (killer.team === 0 ? 'ally' : 'enemy') : 'env';
    const vc = victim.team === 0 ? 'ally' : 'enemy';
    const d = document.createElement('div'); d.className = 'kf';
    d.innerHTML = `<span class="${kc}">${killer ? killer.name : 'ENVIRONMENT'}</span> <b>⨯</b> <span class="${vc}">${victim.name}</span>`;
    this.el.feed.prepend(d);
    this.feed.push({ d, t: 5 });
    if (this.feed.length > 5) { const o = this.feed.shift(); o.d.remove(); }
  }
  bossIntro(def) {
    this.el.bossintro.innerHTML = `<div class="bi-warn">⚠ WARNING ⚠</div><div class="bi-name">${def.name}</div><div class="bi-title">${def.title}</div><div class="bi-tip">${def.intro}</div><div class="bi-skip">SPACE to skip</div>`;
    this.el.bossintro.classList.add('show');
  }
  bossIntroEnd() { this.el.bossintro.classList.remove('show'); }

  // ---------------- per frame ----------------
  update(dt) {
    const g = this.game, p = g.player, el = this.el;
    // fps
    this.fpsAcc += dt; this.fpsN++;
    if (this.fpsAcc > 0.5) { this.fps = Math.round(this.fpsN / this.fpsAcc); this.fpsAcc = 0; this.fpsN = 0; el.fps.textContent = `${this.fps} FPS`; }
    // bars
    const st = p.stats;
    el.hpfill.style.width = `${clamp(p.hp / st.maxHp, 0, 1) * 100}%`;
    el.hptext.textContent = Math.ceil(p.hp);
    el.shfill.style.width = `${st.maxShield ? clamp(p.shield / st.maxShield, 0, 1) * 100 : 0}%`;
    el.shtext.textContent = p.overshield > 0 ? `${Math.ceil(p.shield)} +${Math.ceil(p.overshield)}` : Math.ceil(p.shield);
    el.osfill.style.width = `${clamp(p.overshield / 300, 0, 1) * 100}%`;
    el.enfill.style.width = `${clamp(p.energy / st.maxEnergy, 0, 1) * 100}%`;
    el.entext.textContent = `${Math.ceil(p.energy)} · DASH ${'◆'.repeat(p.dashCharges)}${'◇'.repeat(Math.max(0, st.dashCharges - p.dashCharges))}`;
    const low = p.alive && p.hp / st.maxHp < 0.3;
    el.status.classList.toggle('low', low);
    if (low && !this.lowHpWarn) { this.lowHpWarn = true; this.toast('ARMOR CRITICAL', '#ff4d4d'); }
    if (!low) this.lowHpWarn = false;
    // buffs
    const b = p.buffs;
    const names = { overdrive: 'OVERDRIVE', cloak: 'CAMO', fortify: 'FORTIFY', aegisDome: 'AEGIS DOME', overclock: 'OVERCLOCK', servo: 'SERVOS', uplink: 'UPLINK', ecm: 'ECM', repair: 'REPAIRING' };
    el.buffs.innerHTML = Object.keys(b).filter((k) => names[k]).map((k) => `<span>${names[k]} ${b[k].toFixed(1)}</span>`).join('');
    // weapons
    p.weapons.forEach((w, i) => {
      const s = w.status(), c = this.wcards[i];
      if (!c) return;
      c.stat.textContent = s.label;
      c.bar.style.width = `${clamp(s.frac, 0, 1) * 100}%`;
      c.bar.className = s.heat ? (s.frac > 0.75 ? 'hot' : 'heat') : s.warn ? 'warn' : '';
      c.c.classList.toggle('firing', p.intent.fire[i]);
    });
    // equipment
    p.equip.forEach((e, i) => {
      const s = this.eslots[i];
      s.c.classList.toggle('sel', p.selEquip === i);
      s.c.classList.toggle('ready', e.cd <= 0);
      s.cd.textContent = e.cd > 0 ? Math.ceil(e.cd) : '';
      s.cd.style.height = `${e.cd > 0 ? (e.cd / (e.def.cd * st.cdMul)) * 100 : 0}%`;
    });
    const ab = this.eslots[this.eslots.length - 1];
    ab.cd.textContent = p.ability.cd > 0 ? Math.ceil(p.ability.cd) : '';
    ab.cd.style.height = `${p.ability.cd > 0 ? (p.ability.cd / (p.ability.def.cd * st.cdMul)) * 100 : 0}%`;
    ab.c.classList.toggle('ready', p.ability.cd <= 0);
    // mode info
    const info = g.mode.hud();
    el.mtitle.textContent = info.title;
    el.mscore.textContent = info.score;
    el.mobj.textContent = info.obj;
    el.mtime.textContent = info.timeLeft !== undefined ? fmtTime(info.timeLeft) : fmtTime(g.time);
    if (info.points) {
      el.points.style.display = 'flex';
      el.points.innerHTML = info.points.map((pt) => {
        const col = pt.owner === 0 ? '#3aa8ff' : pt.owner === 1 ? '#ff6a2a' : '#aab';
        return `<div class="pt ${pt.contested ? 'contested' : ''}" style="border-color:${col};color:${col}"><b>${pt.name}</b><i style="width:${Math.abs(pt.prog) * 100}%;background:${pt.prog >= 0 ? '#3aa8ff' : '#ff6a2a'}"></i></div>`;
      }).join('');
    } else el.points.style.display = 'none';
    // boss bar
    const boss = g.boss;
    if (boss && (boss.alive || boss.deadT < 2)) {
      el.bossbar.style.display = 'block';
      el.bossname.textContent = `${boss.name}${boss.bossCtrl ? ' · PHASE ' + boss.bossCtrl.phase : ''}`;
      el.bosshp.style.width = `${clamp(boss.hp / boss.stats.maxHp, 0, 1) * 100}%`;
      el.bosssh.style.width = `${boss.stats.maxShield ? clamp(boss.shield / boss.stats.maxShield, 0, 1) * 100 : 0}%`;
    } else el.bossbar.style.display = 'none';
    // banner/toasts/feed
    if (this.bannerT > 0) { this.bannerT -= dt; if (this.bannerT <= 0) el.banner.classList.remove('show'); }
    for (let i = this.toasts.length - 1; i >= 0; i--) { const t = this.toasts[i]; t.t -= dt; if (t.t <= 0) { t.d.remove(); this.toasts.splice(i, 1); } else t.d.style.opacity = String(Math.min(1, t.t * 2)); }
    for (let i = this.feed.length - 1; i >= 0; i--) { const f = this.feed[i]; f.t -= dt; if (f.t <= 0) { f.d.remove(); this.feed.splice(i, 1); } }
    if (this.hitT > 0) { this.hitT -= dt; if (this.hitT <= 0) el.hitmarker.className = 'hitmarker'; }
    for (const a of this.arcs) if (a.t > 0) { a.t -= dt; a.d.style.opacity = String(Math.max(0, a.t)); }
    const vo = parseFloat(el.vignette.style.opacity || '0');
    const base = low ? 0.35 + Math.sin(g.time * 6) * 0.1 : 0;
    el.vignette.style.opacity = String(Math.max(base, vo - dt * 1.2));
    if (vo < 0.05) el.vignette.classList.remove('fire');
    // crosshair spread & state
    const spread = p.spreadMul ? p.spreadMul() : 1;
    el.cross.style.setProperty('--s', `${8 + spread * 6}px`);
    el.cross.classList.toggle('ontarget', !!g.aimTarget && g.aimTarget.team !== p.team);
    // death / respawn
    if (!p.alive && g.respawnAt > g.time) { el.respawn.style.display = 'block'; el.respawn.textContent = `REDEPLOYING IN ${Math.ceil(g.respawnAt - g.time)}`; }
    else el.respawn.style.display = 'none';
    // scoreboard
    const sb = Input.held('scoreboard') && !g.ended;
    el.scoreboard.style.display = sb ? 'block' : 'none';
    if (sb && (this.sbT = (this.sbT || 0) - dt) <= 0) { this.sbT = 0.3; this.renderScoreboard(); }
    // markers / minimap (throttled heavy parts)
    this.updateMarkers();
    this.slowT -= dt;
    if (this.slowT <= 0) { this.slowT = 1 / 20; this.drawMinimap(); }
  }

  renderScoreboard() {
    const g = this.game;
    const row = (m) => `<tr class="${m.isPlayer ? 'me' : ''} ${m.alive ? '' : 'dead'}"><td>${m.name}</td><td>${m.frame.name}</td><td>${m.kills}</td><td>${m.deaths}</td><td>${Math.round(m.dmgDealt)}</td></tr>`;
    const t0 = g.mechs.filter((m) => m.team === 0), t1 = g.mechs.filter((m) => m.team === 1 && !m.decoy);
    this.el.scoreboard.innerHTML = `
      <div class="sbh">${g.mode.hud().title} · ${fmtTime(g.time)} · ${g.diffDef.name.toUpperCase()} · ${g.condition.name}</div>
      <table><tr><th>YOUR TEAM</th><th>FRAME</th><th>K</th><th>D</th><th>DMG</th></tr>${t0.map(row).join('')}</table>
      <table class="en"><tr><th>HOSTILES</th><th>FRAME</th><th>K</th><th>D</th><th>DMG</th></tr>${t1.map(row).join('')}</table>
      <div class="sbf">Match: ${g.matchStats.kills} kills · ${Math.round(g.matchStats.damage)} damage · accuracy ${g.matchStats.shots ? Math.round(g.matchStats.hits / g.matchStats.shots * 100) : 0}%</div>`;
  }

  updateMarkers() {
    const g = this.game, p = g.player, cam = g.camera;
    const W = window.innerWidth, H = window.innerHeight;
    let mi = 0, ai = 0;
    const reveal = !!p.buffs.uplink;
    const lock = p.intent.lock;
    for (const m of g.targets) {
      if (!m.alive || m === p || m.team === 2) continue;
      if (m.cloaked && m.team !== p.team) continue;
      const c = m.center(_v);
      c.y = m.pos.y + m.height + 1.2;
      const dist = m.pos.distanceTo(p.pos);
      if (dist > 200) continue;
      // LOS checks are cached per target to limit cost
      if (!m._losT || g.time - m._losT > 0.25) { m._losT = g.time + Math.random() * 0.05; m._los = g.arena.lineOfSight(p.eye(_w), m.center(_w)); }
      const visible = m._los || reveal || m.team === p.team;
      _w.copy(c).project(cam);
      const onScreen = _w.z < 1 && Math.abs(_w.x) < 1 && Math.abs(_w.y) < 1;
      if (onScreen && (visible || m === lock)) {
        let el = this.markers[mi];
        if (!el) { el = document.createElement('div'); el.className = 'emark'; el.innerHTML = '<div class="en"></div><div class="eb"><i class="h"></i><i class="s"></i></div>'; this.el.markers.appendChild(el); el._n = el.querySelector('.en'); el._h = el.querySelector('.h'); el._s = el.querySelector('.s'); this.markers.push(el); }
        mi++;
        el.style.display = 'block';
        el.style.transform = `translate(${(_w.x * 0.5 + 0.5) * W}px, ${(-_w.y * 0.5 + 0.5) * H}px)`;
        el.className = 'emark ' + (m.team === p.team ? 'friend' : 'foe') + (m === lock ? ' locked' : '') + (m.isBoss ? ' boss' : '');
        const name = m.isStructure ? m.name : `${m.name}${m.miniboss ? ' ★' : ''}`;
        if (el._nm !== name) { el._n.textContent = name; el._nm = name; }
        el._h.style.width = `${clamp(m.hp / m.stats.maxHp, 0, 1) * 100}%`;
        el._s.style.width = `${m.stats.maxShield ? clamp(m.shield / m.stats.maxShield, 0, 1) * 100 : 0}%`;
        el.style.opacity = dist > 120 ? '0.6' : '1';
      } else if (!onScreen && m.team !== p.team && (dist < 90 || m.isBoss || m === lock)) {
        let el = this.arrows[ai];
        if (!el) { el = document.createElement('div'); el.className = 'earrow'; this.el.markers.appendChild(el); this.arrows.push(el); }
        ai++;
        // direction relative to camera
        const dx = m.pos.x - p.pos.x, dz = m.pos.z - p.pos.z;
        const yaw = g.camYaw;
        const fwd = dx * Math.sin(yaw) + dz * Math.cos(yaw);
        const right = -dx * Math.cos(yaw) + dz * Math.sin(yaw);
        const ang = Math.atan2(right, fwd);
        const r = Math.min(W, H) * 0.36;
        el.style.display = 'block';
        el.style.transform = `translate(${W / 2 + Math.sin(ang) * r}px, ${H / 2 - Math.cos(ang) * r}px) rotate(${ang}rad)`;
        el.classList.toggle('boss', !!m.isBoss);
      }
    }
    for (let i = mi; i < this.markers.length; i++) this.markers[i].style.display = 'none';
    for (let i = ai; i < this.arrows.length; i++) this.arrows[i].style.display = 'none';
    // lock reticle
    const lr = this.el.lock;
    if (lock && lock.alive) {
      lock.center(_w).project(cam);
      if (_w.z < 1) {
        lr.style.display = 'block';
        lr.style.transform = `translate(${(_w.x * 0.5 + 0.5) * W}px, ${(-_w.y * 0.5 + 0.5) * H}px)`;
        lr.dataset.label = lock.decoy ? 'DECOY' : `LOCK ${Math.round(lock.pos.distanceTo(p.pos))}m`;
        lr.classList.toggle('decoy', !!lock.decoy);
      } else lr.style.display = 'none';
    } else lr.style.display = 'none';
  }

  drawMinimap() {
    const g = this.game, p = g.player, a = g.arena, ctx = this.mm;
    const S = 170, cx = S / 2, cy = S / 2, view = 75;
    const sc = (S / 2) / view;
    const yaw = g.camYaw, c = Math.cos(yaw), s = Math.sin(yaw);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, S / 2 - 1, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = 'rgba(5,12,20,0.9)'; ctx.fillRect(0, 0, S, S);
    // world->screen: sx = (-c*dx + s*dz)*sc + cx ; sy = -(s*dx + c*dz)*sc + cy
    const k = this.mmK;
    const A = -c * sc / k, B = -s * sc / k, C = s * sc / k, D = -c * sc / k;
    const u0 = (p.pos.x + a.half) * k, v0 = (p.pos.z + a.half) * k;
    ctx.setTransform(A, B, C, D, cx - (A * u0 + C * v0), cy - (B * u0 + D * v0));
    ctx.drawImage(this.mmBase, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const toS = (x, z) => { const dx = x - p.pos.x, dz = z - p.pos.z; return [(-c * dx + s * dz) * sc + cx, -(s * dx + c * dz) * sc + cy]; };
    // domination points
    const info = g.mode.points;
    if (info) for (const pt of info) {
      const [x, y] = toS(pt.pos.x, pt.pos.z);
      ctx.strokeStyle = pt.owner === 0 ? '#3aa8ff' : pt.owner === 1 ? '#ff6a2a' : '#ccc';
      ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, pt.radius * sc, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = ctx.strokeStyle; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(pt.name, x, y + 4);
    }
    for (const pk of g.pickups) { const [x, y] = toS(pk.pos.x, pk.pos.z); ctx.fillStyle = '#66ff99'; ctx.fillRect(x - 3, y - 1, 6, 2); ctx.fillRect(x - 1, y - 3, 2, 6); }
    const reveal = !!p.buffs.uplink;
    for (const m of g.targets) {
      if (!m.alive || m === p || m.team === 2) continue;
      const enemy = m.team !== p.team;
      if (enemy && m.cloaked) continue;
      if (enemy && !reveal && !m._los && m.pos.distanceTo(p.pos) > 45 && !m.isBoss) continue;
      const [x, y] = toS(m.pos.x, m.pos.z);
      ctx.fillStyle = enemy ? (m.isBoss ? '#ff2f6d' : m.isStructure ? '#c58bff' : '#ff6a2a') : '#3aa8ff';
      const r = m.isBoss ? 6 : m.isStructure ? 3.5 : 3.5;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      if (m === p.intent.lock) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.strokeRect(x - 6, y - 6, 12, 12); }
    }
    // player arrow (facing = mech yaw relative to camera)
    const rel = p.yaw - yaw;
    ctx.translate(cx, cy); ctx.rotate(-rel);
    ctx.fillStyle = '#5ce8ff';
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill();
    ctx.restore();
    // view cone & ring
    ctx.strokeStyle = 'rgba(92,232,255,0.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, S / 2 - 1, 0, Math.PI * 2); ctx.stroke();
    // compass N
    const [nx, ny] = toS(p.pos.x, p.pos.z - 1000);
    const na = Math.atan2(ny - cy, nx - cx);
    ctx.fillStyle = '#ffb347'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('N', cx + Math.cos(na) * (S / 2 - 10), cy + Math.sin(na) * (S / 2 - 10) + 4);
  }

  dispose() {
    this.root.innerHTML = '';
    this.root.classList.add('hidden');
  }
}

const TEMPLATE = `
<div id="vignette" data-h="vignette"></div>
<div class="hud-markers" data-h="markers"></div>
<div class="hud-arcs" data-h="arcs"></div>
<div class="crosshair" data-h="cross"><i></i><i></i><i></i><i></i><b></b></div>
<div class="hitmarker" data-h="hitmarker"></div>
<div class="lockret" data-h="lock"></div>
<canvas class="minimap" data-h="minimap" width="170" height="170"></canvas>
<div class="hud-top">
  <div class="mtitle" data-h="mtitle"></div>
  <div class="mrow"><span class="mtime" data-h="mtime"></span><span class="mscore" data-h="mscore"></span></div>
  <div class="mobj" data-h="mobj"></div>
  <div class="points" data-h="points"></div>
</div>
<div class="bossbar" data-h="bossbar"><div class="bn" data-h="bossname"></div><div class="bb"><div class="bh" data-h="bosshp"></div></div><div class="bbs"><div data-h="bosssh"></div></div></div>
<div class="status" data-h="status">
  <div class="frame" data-h="frame"></div>
  <div class="bar sh"><label>SHIELD</label><div class="track"><div class="fill" data-h="shfill"></div><div class="fill os" data-h="osfill"></div></div><span data-h="shtext"></span></div>
  <div class="bar hp"><label>ARMOR</label><div class="track"><div class="fill" data-h="hpfill"></div></div><span data-h="hptext"></span></div>
  <div class="bar en"><label>ENERGY</label><div class="track"><div class="fill" data-h="enfill"></div></div><span data-h="entext"></span></div>
  <div class="buffs" data-h="buffs"></div>
</div>
<div class="loadout"><div class="weapons" data-h="weapons"></div><div class="equips" data-h="equips"></div></div>
<div class="feed" data-h="feed"></div>
<div class="toasts" data-h="toasts"></div>
<div class="banner" data-h="banner"></div>
<div class="bossintro" data-h="bossintro"></div>
<div class="respawn" data-h="respawn"></div>
<div class="scoreboard" data-h="scoreboard"></div>
<div class="fps" data-h="fps"></div>
<div class="hint" data-h="hint"></div>
`;
