// Lobby: animated 3D character, play / locker / challenges / career / settings, plus pause and results screens.
import * as THREE from 'three';
import { CharacterRenderer } from './character.js';
import { COSMETIC_SETS, appearanceFromLoadout } from './cosmetics.js';
import { DIFFICULTY, GAME_NAME } from './config.js';
import { Progression, DEFAULT_SETTINGS } from './progression.js';
import { fmtTime } from './util.js';

const $ = (id) => document.getElementById(id);
const hex = (n) => '#' + n.toString(16).padStart(6, '0');

export class Lobby3D {
  constructor(game) {
    this.game = game;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1d2a6b);
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    this.camera.position.set(0, 1.5, 5.4);
    this.camera.lookAt(0, 1.0, 0);
    this.scene.add(new THREE.HemisphereLight(0xbfd8ff, 0x302050, 1.2));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(3, 5, 4);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x66ccff, 1.4);
    rim.position.set(-4, 3, -3);
    this.scene.add(rim);
    // backdrop gradient
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(40, 20), new THREE.ShaderMaterial({
      depthWrite: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'varying vec2 vUv; void main(){ vec3 a=vec3(0.06,0.09,0.32); vec3 b=vec3(0.36,0.22,0.78); vec3 c=mix(a,b,vUv.y); float r=length(vUv-vec2(0.5,0.45)); c+=vec3(0.25,0.35,0.6)*(1.0-smoothstep(0.0,0.35,r))*0.6; gl_FragColor=vec4(c,1.0); }',
    }));
    bg.position.set(0, 3, -8);
    this.scene.add(bg);
    // pedestal
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.25, 0.35, 40), new THREE.MeshLambertMaterial({ color: 0x2b3a8c }));
    ped.position.y = -0.18;
    this.scene.add(ped);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.04, 8, 60), new THREE.MeshBasicMaterial({ color: 0x5ce1ff }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.01;
    this.scene.add(ring);
    this.ring = ring;
    // floating shapes
    this.floaters = [];
    for (let i = 0; i < 18; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), new THREE.MeshLambertMaterial({ color: [0xffd23f, 0x5ce1ff, 0xff4f6d, 0xb765ff][i % 4] }));
      m.position.set((Math.random() - 0.5) * 12, Math.random() * 5, -2 - Math.random() * 5);
      m.userData.s = Math.random() * 2 + 0.5;
      this.scene.add(m);
      this.floaters.push(m);
    }
    this.chars = new CharacterRenderer(this.scene, 2);
    this.chars.mesh.castShadow = false;
    this.rot = 0.4;
    this.drag = null;
    this.t = 0;
    this.emoteT = 0;
    const cv = game.canvas;
    cv.addEventListener('mousedown', (e) => { if (game.state === 'menu') this.drag = e.clientX; });
    window.addEventListener('mousemove', (e) => { if (this.drag !== null) { this.rot += (e.clientX - this.drag) * 0.01; this.drag = e.clientX; } });
    window.addEventListener('mouseup', () => { this.drag = null; });
  }
  resize(w, h) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.camera.position.x = 0; }
  render(dt) {
    this.t += dt;
    if (this.drag === null) this.rot += dt * 0.3;
    this.emoteT -= dt;
    const ap = appearanceFromLoadout(this.game.prog.data.loadout);
    const pose = { x: 0, y: 0, z: 0, yaw: this.rot, pitch: 0, phase: this.t * 2, speed: 0, crouch: false, grounded: true, flash: 0, state: this.emoteT > 0 ? 'emote' : 'ground', held: { kind: 'pickaxe' }, swing: 0 };
    if (this.showGlider) { pose.state = 'glide'; pose.y = 0.2 + Math.sin(this.t * 2) * 0.05; }
    this.chars.begin();
    this.chars.draw(pose, ap);
    this.chars.end();
    for (const f of this.floaters) { f.rotation.x += dt * f.userData.s; f.rotation.y += dt; f.position.y += Math.sin(this.t * f.userData.s) * 0.003; }
    this.ring.material.color.setHSL(0.52 + Math.sin(this.t) * 0.05, 1, 0.6);
    this.game.renderer.render(this.scene, this.camera);
  }
}

export class Menu {
  constructor(game) {
    this.game = game;
    this.prog = game.prog;
    this.lobby = new Lobby3D(game);
    game.lobby = this.lobby;
    this.lockerKind = 'outfit';
    this.tab = 'play';
    document.title = GAME_NAME;
    this.bind();
    this.renderAll();
  }

  bind() {
    const g = this.game, d = this.prog.data;
    document.querySelectorAll('#menu nav button').forEach((b) => b.addEventListener('click', () => { g.audio.init(); g.audio.ui('click'); this.showTab(b.dataset.tab); }));
    document.querySelectorAll('button').forEach((b) => b.addEventListener('mouseenter', () => g.audio.ui('hover')));
    $('name-input').value = d.name;
    $('name-input').addEventListener('change', (e) => { d.name = e.target.value.slice(0, 16) || 'Player'; this.prog.save(); });
    document.querySelectorAll('.mode-card').forEach((c) => c.addEventListener('click', () => { d.mode = c.dataset.mode; this.prog.save(); g.audio.ui('click'); this.renderPlay(); }));
    document.querySelectorAll('#diff-buttons button').forEach((b) => b.addEventListener('click', () => { d.difficulty = b.dataset.d; this.prog.save(); g.audio.ui('click'); this.renderPlay(); }));
    $('play-btn').addEventListener('click', () => this.play());
    document.querySelectorAll('#locker-cats button').forEach((b) => b.addEventListener('click', () => { this.lockerKind = b.dataset.k; g.audio.ui('click'); this.renderLocker(); }));
    $('emote-btn').addEventListener('click', () => { this.lobby.emoteT = 4; g.audio.init(); g.audio.ui('click'); });
    // results
    $('res-again').addEventListener('click', () => { this.hideResults(); this.play(); });
    $('res-lobby').addEventListener('click', () => { this.hideResults(); this.toMenu(); });
    $('res-spectate').addEventListener('click', () => { this.hideResults(); g.spectating = true; g.input.lock(); });
    // pause
    $('pause-resume').addEventListener('click', () => this.resume());
    $('pause-leave').addEventListener('click', () => { this.hidePause(); g.leaveMatch(); this.toMenu(); });
    $('pause-settings').addEventListener('click', () => { $('pause-settings-panel').classList.toggle('hidden'); });
    $('reset-progress').addEventListener('click', () => {
      if (confirm('Reset all progression, stats and settings?')) { this.prog.reset(); g.settings = this.prog.data.settings; g.applySettings(); this.renderAll(); }
    });
    // click-to-play overlay for pointer lock
    $('clicktoplay').addEventListener('click', () => { g.audio.init(); g.input.lock(); });
    g.input.onLockChange = (locked) => {
      if (g.state !== 'match') return;
      if (locked) { $('clicktoplay').classList.add('hidden'); this.hidePause(); g.paused = false; }
      else if (!g.ended && !g.mapOpen) { this.showPause(); }
      else if (g.ended && g.spectating && !g.mapOpen) { g.spectating = false; this.showResults(g.results); }
    };
    // map toggle & escape
    window.addEventListener('keydown', (e) => {
      if (g.state !== 'match') return;
      if (e.code === 'KeyM' || e.code === 'Tab') {
        e.preventDefault();
        if (g.paused && !g.mapOpen) return;
        g.mapOpen = !g.mapOpen;
        $('bigmap').classList.toggle('hidden', !g.mapOpen);
        if (g.mapOpen) g.input.unlock();
        else if (!g.ended || g.spectating) g.input.lock();
      }
      if (e.code === 'Escape' && g.ended && $('results').classList.contains('hidden')) {
        g.spectating = false;
        this.showResults(g.results);
      }
    });
    $('bigmap-canvas').addEventListener('click', (e) => {
      const r = e.target.getBoundingClientRect();
      const fx = (e.clientX - r.left) / r.width, fz = (e.clientY - r.top) / r.height;
      g.mapMarker = { x: -900 + fx * 1800, z: -900 + fz * 1800 };
    });
    $('bigmap-close').addEventListener('click', () => { g.mapOpen = false; $('bigmap').classList.add('hidden'); if (!g.ended) g.input.lock(); });
    // settings form
    this.buildSettings($('settings-form'));
    this.buildSettings($('pause-settings-panel'));
    g.events.on('matchEnd', (r) => setTimeout(() => this.showResults(r), r.victory ? 600 : 300));
  }

  showTab(t) {
    this.tab = t;
    document.querySelectorAll('#menu nav button').forEach((b) => b.classList.toggle('active', b.dataset.tab === t));
    document.querySelectorAll('#menu .tab').forEach((s) => s.classList.toggle('hidden', s.id !== 'tab-' + t));
    this.lobby.showGlider = false;
    if (t === 'locker') this.renderLocker();
    if (t === 'challenges') this.renderChallenges();
    if (t === 'career') this.renderCareer();
  }

  renderAll() {
    this.renderHeader();
    this.renderPlay();
    this.renderLocker();
    this.renderChallenges();
    this.renderCareer();
    this.syncSettings();
  }

  renderHeader() {
    const p = this.prog;
    $('lvl-badge').textContent = p.level;
    $('xp-fill').style.width = (p.xpInto / p.xpNeeded) * 100 + '%';
    $('xp-text').textContent = `${p.xpInto} / ${p.xpNeeded} XP`;
  }

  renderPlay() {
    const d = this.prog.data;
    document.querySelectorAll('.mode-card').forEach((c) => c.classList.toggle('sel', c.dataset.mode === d.mode));
    document.querySelectorAll('#diff-buttons button').forEach((b) => b.classList.toggle('sel', b.dataset.d === d.difficulty));
    $('diff-row').style.opacity = d.mode === 'practice' ? 0.4 : 1;
    const daily = this.prog.dailyDefs();
    $('play-daily').innerHTML = daily.map((c) => `<div class="mini-ch ${c.done ? 'done' : ''}"><span>${c.text}</span><div class="bar"><i style="width:${(c.progress / c.goal) * 100}%"></i></div><small>${Math.floor(c.progress)}/${c.goal} · ${c.xp} XP</small></div>`).join('');
  }

  renderLocker() {
    const d = this.prog.data, kind = this.lockerKind;
    document.querySelectorAll('#locker-cats button').forEach((b) => b.classList.toggle('sel', b.dataset.k === kind));
    this.lobby.showGlider = kind === 'glider';
    const set = COSMETIC_SETS[kind];
    const grid = $('locker-grid');
    grid.innerHTML = '';
    for (const c of set) {
      const locked = this.prog.level < c.level;
      const el = document.createElement('button');
      el.className = 'cos' + (d.loadout[kind] === c.id ? ' sel' : '') + (locked ? ' locked' : '');
      const sw = kind === 'outfit' ? [c.top, c.bottom, c.skin, c.accent] : kind === 'glider' ? [c.color, c.color2] : kind === 'backpack' ? [c.color] : [c.color === 'rainbow' ? 0xff00ff : c.color || 0x222222];
      el.innerHTML = `<div class="sw">${sw.map((s) => `<i style="background:${hex(s || 0)}"></i>`).join('')}</div><b>${c.name}</b><small>${locked ? '🔒 Level ' + c.level : d.loadout[kind] === c.id ? 'Equipped' : 'Owned'}</small>`;
      el.addEventListener('click', () => {
        if (locked) { this.game.audio.ui('empty'); return; }
        d.loadout[kind] = c.id;
        this.prog.save();
        this.game.audio.ui('click');
        this.lobby.emoteT = 1.5;
        this.renderLocker();
      });
      grid.appendChild(el);
    }
  }

  renderChallenges() {
    const daily = this.prog.dailyDefs();
    $('daily-list').innerHTML = daily.map((c) => this.chRow(c.text, c.progress, c.goal, c.xp, c.done)).join('');
    $('season-list').innerHTML = this.prog.seasonDefs().map((c) => this.chRow(c.text, c.progress, c.goal, c.xp, c.claimed)).join('');
    const next = COSMETIC_SETS.outfit.concat(COSMETIC_SETS.glider, COSMETIC_SETS.backpack, COSMETIC_SETS.contrail).filter((c) => c.level > this.prog.level).sort((a, b) => a.level - b.level).slice(0, 4);
    $('unlocks-list').innerHTML = next.length ? next.map((c) => `<div class="unlock"><b>Lv ${c.level}</b> ${c.name}</div>`).join('') : '<div class="unlock">Everything unlocked!</div>';
  }
  chRow(text, p, goal, xp, done) {
    return `<div class="ch ${done ? 'done' : ''}"><div class="t">${done ? '✔ ' : ''}${text}</div><div class="bar"><i style="width:${Math.min(100, (p / goal) * 100)}%"></i></div><div class="r">${Math.floor(p).toLocaleString()} / ${goal.toLocaleString()} <b>+${xp} XP</b></div></div>`;
  }

  renderCareer() {
    const s = this.prog.data.stats;
    const kd = s.deaths ? (s.kills / s.deaths).toFixed(2) : s.kills.toFixed(2);
    const items = [
      ['Level', this.prog.level], ['Matches', s.matches], ['Wins', s.wins], ['Win %', s.matches ? ((s.wins / s.matches) * 100).toFixed(1) + '%' : '0%'],
      ['Top 10', s.top10], ['Top 25', s.top25], ['Eliminations', s.kills], ['K/D', kd],
      ['Damage dealt', s.damage.toLocaleString()], ['Headshots', s.headshots], ['Best placement', s.bestPlace ? '#' + s.bestPlace : '-'], ['Time survived', fmtTime(s.timeAlive)],
      ['Chests opened', s.chests], ['Structures built', s.built], ['Materials harvested', s.harvested.toLocaleString()], ['Distance travelled', (s.distance / 1000).toFixed(1) + ' km'],
    ];
    $('career-grid').innerHTML = items.map(([k, v]) => `<div class="stat"><small>${k}</small><b>${v}</b></div>`).join('');
    const h = this.prog.data.history;
    $('history').innerHTML = h.length ? h.map((m) => `<div class="hist ${m.place === 1 ? 'win' : ''}"><b>#${m.place}</b> ${m.kills} elims <small>${m.mode === 'practice' ? 'Practice' : 'Solo'} · ${new Date(m.date).toLocaleDateString()}</small></div>`).join('') : '<div class="hist">No matches yet — drop in!</div>';
  }

  buildSettings(root) {
    const S = () => this.game.settings;
    const rows = [
      ['Graphics', null],
      ['quality', 'Quality preset', 'select', [['low', 'Low (best performance)'], ['medium', 'Medium'], ['high', 'High']]],
      ['renderDist', 'Render distance', 'range', [200, 900, 25]],
      ['resScale', 'Resolution scale', 'range', [0.5, 1, 0.05]],
      ['shadows', 'Shadows', 'check'],
      ['weather', 'Weather effects', 'check'],
      ['showFps', 'Show FPS', 'check'],
      ['Controls', null],
      ['fov', 'Field of view', 'range', [60, 100, 1]],
      ['sensitivity', 'Mouse sensitivity', 'range', [0.2, 3, 0.05]],
      ['adsSens', 'ADS sensitivity', 'range', [0.2, 1.5, 0.05]],
      ['invertY', 'Invert Y axis', 'check'],
      ['toggleSprint', 'Sprint by default (Shift walks)', 'check'],
      ['autoPickup', 'Auto-pickup ammo, materials & healing', 'check'],
      ['editOnRelease', 'Confirm edit on mouse release', 'check'],
      ['keepSlot', 'Keep current slot when picking up', 'check'],
      ['Audio', null],
      ['master', 'Master volume', 'range', [0, 1, 0.05]],
      ['sfx', 'Effects volume', 'range', [0, 1, 0.05]],
      ['music', 'Music volume', 'range', [0, 1, 0.05]],
    ];
    root.innerHTML = '';
    for (const r of rows) {
      if (!r[1]) { const h = document.createElement('h4'); h.textContent = r[0]; root.appendChild(h); continue; }
      const [key, label, type, opts] = r;
      const row = document.createElement('label');
      row.className = 'set-row';
      let input;
      if (type === 'select') {
        input = document.createElement('select');
        for (const [v, t] of opts) { const o = document.createElement('option'); o.value = v; o.textContent = t; input.appendChild(o); }
      } else if (type === 'range') {
        input = document.createElement('input'); input.type = 'range';
        input.min = opts[0]; input.max = opts[1]; input.step = opts[2];
      } else { input = document.createElement('input'); input.type = 'checkbox'; }
      input.dataset.key = key;
      const val = document.createElement('span'); val.className = 'val';
      row.innerHTML = `<span class="lbl">${label}</span>`;
      row.appendChild(input);
      row.appendChild(val);
      const apply = () => {
        const s = S();
        if (type === 'check') s[key] = input.checked;
        else if (type === 'range') s[key] = parseFloat(input.value);
        else s[key] = input.value;
        if (key === 'quality') {
          if (input.value === 'low') { s.shadows = false; s.renderDist = Math.min(s.renderDist, 350); s.resScale = 0.85; }
          if (input.value === 'high') { s.shadows = true; s.renderDist = Math.max(s.renderDist, 550); s.resScale = 1; }
          if (input.value === 'medium') { s.shadows = true; s.resScale = 1; }
        }
        this.prog.save();
        this.game.applySettings();
        this.syncSettings();
      };
      input.addEventListener(type === 'range' ? 'input' : 'change', apply);
      root.appendChild(row);
    }
    const reset = document.createElement('button');
    reset.textContent = 'Restore defaults';
    reset.className = 'small-btn';
    reset.addEventListener('click', () => { Object.assign(S(), DEFAULT_SETTINGS); this.prog.save(); this.game.applySettings(); this.syncSettings(); });
    root.appendChild(reset);
  }
  syncSettings() {
    const s = this.game.settings;
    document.querySelectorAll('[data-key]').forEach((input) => {
      const k = input.dataset.key;
      if (input.type === 'checkbox') input.checked = !!s[k];
      else input.value = s[k];
      const v = input.parentElement.querySelector('.val');
      if (v) v.textContent = input.type === 'range' ? (Number.isInteger(s[k]) ? s[k] : Number(s[k]).toFixed(2)) : '';
    });
  }

  play() {
    const g = this.game, d = this.prog.data;
    g.audio.init();
    $('menu').classList.add('hidden');
    $('loading-match').classList.remove('hidden');
    setTimeout(() => {
      g.startMatch(d.mode, d.difficulty);
      $('loading-match').classList.add('hidden');
      $('clicktoplay').classList.remove('hidden');
      g.input.lock();
    }, 50);
  }

  toMenu() {
    const g = this.game;
    g.state = 'menu';
    g.hud.show(false);
    $('menu').classList.remove('hidden');
    $('bigmap').classList.add('hidden');
    $('clicktoplay').classList.add('hidden');
    g.mapOpen = false;
    g.input.unlock();
    g.audio.startMusic();
    this.renderAll();
  }

  showPause() {
    const g = this.game;
    if (g.state !== 'match') return;
    g.paused = true;
    $('pause').classList.remove('hidden');
    $('pause-settings-panel').classList.add('hidden');
    this.syncSettings();
  }
  hidePause() { $('pause').classList.add('hidden'); }
  resume() { this.hidePause(); this.game.paused = false; this.game.input.lock(); }

  showResults(r) {
    const g = this.game;
    g.input.unlock();
    g.paused = false;
    const el = $('results');
    el.classList.remove('hidden');
    el.classList.toggle('victory', r.victory);
    $('res-title').textContent = r.victory ? '#1 VICTORY' : 'ELIMINATED';
    $('res-sub').textContent = r.victory ? 'Last one standing!' : `You placed #${r.m.place} of ${r.m.total}`;
    $('res-stats').innerHTML = [
      ['Placement', '#' + r.m.place], ['Eliminations', r.m.kills], ['Damage', Math.round(r.m.damage)], ['Survived', fmtTime(r.m.timeAlive)],
      ['Chests', r.m.chests], ['Built', r.m.built], ['Harvested', r.m.harvested], ['Headshots', r.m.headshots],
    ].map(([k, v]) => `<div class="stat"><small>${k}</small><b>${v}</b></div>`).join('');
    $('res-xp').innerHTML = r.summary.breakdown.map(([k, v]) => `<div class="xprow"><span>${k}</span><b>+${v}</b></div>`).join('') + `<div class="xprow total"><span>Total XP</span><b>+${r.summary.total}</b></div>` + (r.summary.ups.length ? `<div class="levelup">LEVEL UP! Now level ${this.prog.level}</div>` : '');
    if (r.summary.ups.length) setTimeout(() => g.audio.ui('levelup', 0.6), 800);
    $('res-spectate').style.display = !r.victory && g.aliveCount > 1 ? 'inline-block' : 'none';
    this.renderHeader();
  }
  hideResults() { $('results').classList.add('hidden'); }
}

export { Progression };
