// DOM user interface: menus, settings, evolution shop, HUD, subtitles, notes.
import { ABILITY_DEFS } from '../systems/abilities.js';
import { SHOP } from '../systems/progress.js';
import { SKINS } from '../actors/monsterModel.js';
import { CHAPTERS, NOTES, CHALLENGES } from '../systems/story.js';
import { MAPS } from '../maps/index.js';

const $ = (id) => document.getElementById(id);
const ICONS = { senses: '◉', predator: '◈', presence: '☗', night: '◐', roar: '✺', mimic: '❝', stalk: '⋯' };
const TIPS = [
  'People cannot hear what is only in your head. Watch them.',
  'Crouching in darkness makes you very hard to see.',
  'A scream travels. So does panic.',
  'Someone hiding is still breathing.',
  'Heavy strikes break locked doors.',
  'Hold Space against a wall while moving into it to climb.',
  'If the world goes quiet, something is about to happen. Or nothing is.',
  'It never comes closer. It never follows. It only waits.',
  'Help arrives with flashlights. Light reveals you.',
  'Night Vision drains while it is on. Use it, then let your eyes rest.',
];

export class UI {
  constructor(game) {
    this.game = game; this.stack = []; this.subs = []; this.hintT = 0; this.toastCount = 0;
    document.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', (e) => { this.click(); this.act(b.dataset.act, b); e.stopPropagation(); }));
    document.querySelectorAll('button').forEach((b) => b.addEventListener('mouseenter', () => this.game.audio.ready && this.game.audio.play('ui', null, { vol: 0.06, f: 330 })));
    this.buildAbilityBar();
    this.bindSettings();
  }
  click() { this.game.audio.init(); this.game.audio.play('ui', null, { vol: 0.15, f: 180 }); }

  show(id) { document.querySelectorAll('.screen').forEach((s) => s.classList.add('hidden')); if (id) $(id).classList.remove('hidden'); this.current = id; }
  push(id) { this.stack.push(this.current); this.show(id); }
  back() { const prev = this.stack.pop(); this.show(prev || (this.game.running ? 'pauseScreen' : 'menu')); }

  openMenu() {
    const P = this.game.progress;
    this.stack = []; this.show('menu');
    $('btnSurvival').disabled = !P.modeUnlocked('survival');
    $('btnNightmare').disabled = !P.modeUnlocked('nightmare');
    $('btnSurvival').title = 'Unlocked after Chapter II'; $('btnNightmare').title = 'Unlocked after finishing the story';
    $('essenceMenu').textContent = `${P.d.essence} essence`;
    $('hud').classList.add('hidden');
  }

  act(a, el) {
    const g = this.game;
    switch (a) {
      case 'story': this.buildChapters(); this.push('storyScreen'); break;
      case 'free': case 'survival': case 'nightmare': this.buildMaps(a); this.push('mapScreen'); break;
      case 'evo': this.buildEvo(); this.push('evoScreen'); break;
      case 'settings': this.loadSettings(); this.push('settingsScreen'); break;
      case 'help': this.push('helpScreen'); break;
      case 'back': this.back(); break;
      case 'resume': g.resume(); break;
      case 'quit': g.quitToMenu(); break;
      case 'retry': g.retry(); break;
      case 'newgame': if (confirm('Start the story from the beginning? (Essence and unlocks are kept.)')) { g.progress.d.chapter = 1; g.progress.save(); g.start('story', 'suburb', { chapter: 1 }); } break;
      case 'resetSave': if (confirm('Erase all progress?')) { g.progress.reset(); this.openMenu(); } break;
    }
  }

  buildChapters() {
    const P = this.game.progress, list = $('chapterList'); list.innerHTML = '';
    for (const n of [1, 2, 3, 4, 5]) {
      const C = CHAPTERS[n]; const locked = !(P.d.unlockAll || n <= P.d.chapter);
      const d = document.createElement('div'); d.className = 'card' + (locked ? ' locked' : '');
      d.innerHTML = `<div class="cs">Chapter ${n}${n === P.d.chapter && !P.d.storyComplete ? ' · continue' : ''}</div><div class="ct">${C.title.replace(/^[IVX]+\. /, '')}</div><div class="cd">${locked ? '???' : C.intro}</div>`;
      if (!locked) d.addEventListener('click', () => { this.click(); this.game.start('story', C.map, { chapter: n }); });
      list.appendChild(d);
    }
  }
  buildMaps(mode) {
    const P = this.game.progress, list = $('mapList'); list.innerHTML = '';
    $('mapScreenTitle').textContent = mode === 'free' ? 'Free Hunt' : mode === 'survival' ? 'Survival' : 'Nightmare';
    $('mapScreenDesc').textContent = mode === 'free' ? 'No objectives. Explore, hunt, find what was left behind.' : mode === 'survival' ? 'Hunger burns faster. Searchers come in growing numbers. How long can you last?' : 'Darker. Louder. Less certain. Feed to open the way to somewhere else.';
    const keys = Object.keys(MAPS).sort((a, b) => MAPS[a].order - MAPS[b].order);
    for (const k of keys) {
      const M = MAPS[k]; const locked = !P.mapUnlocked(k, M.order);
      const d = document.createElement('div'); d.className = 'card' + (locked ? ' locked' : '');
      const best = P.d.bestSurvival[k];
      d.innerHTML = `<div class="cs">${M.sub}</div><div class="ct">${locked ? '???' : M.title}</div><div class="cd">${locked ? 'Reach this place in the story to unlock it.' : M.desc}</div>${mode === 'survival' && best ? `<div class="best">Best: ${fmtTime(best.time)} · ${best.fed} fed</div>` : ''}`;
      if (!locked) d.addEventListener('click', () => { this.click(); this.game.start(mode, k, {}); });
      list.appendChild(d);
    }
  }
  buildEvo() {
    const g = this.game, P = g.progress;
    $('essenceEvo').textContent = `You have ${P.d.essence} essence.`;
    const sl = $('shopList'); sl.innerHTML = '';
    for (const it of SHOP) {
      if (it.type === 'skin') continue;
      const row = document.createElement('div'); row.className = 'shop-item';
      let label, can = false, owned = false;
      if (it.type === 'upgrade') {
        const lvl = P.upgradeLevel(it.key), max = it.cost.length;
        owned = lvl >= max; const cost = owned ? 0 : it.cost[lvl];
        const req = it.requires && !P.isUnlocked(it.requires);
        label = owned ? 'Maxed' : req ? 'Requires ability' : `${cost} · Lv ${lvl + 1}/${max}`; can = !owned && !req && P.d.essence >= cost;
      } else { owned = P.isUnlocked(it.id); label = owned ? 'Unlocked' : `${it.cost}`; can = !owned && P.d.essence >= it.cost; }
      row.innerHTML = `<div><div class="n">${it.name}</div><div class="d">${it.desc}</div></div>`;
      const btn = document.createElement('button'); btn.textContent = label; btn.disabled = !can && !owned; if (owned) { btn.classList.add('owned'); btn.disabled = true; }
      btn.addEventListener('click', () => { if (P.buy(it)) { g.audio.play('shimmer', null, { vol: 0.3 }); g.applyUpgrades(); this.buildEvo(); } });
      row.appendChild(btn); sl.appendChild(row);
    }
    const sk = $('skinList'); sk.innerHTML = '';
    for (const k in SKINS) {
      const S = SKINS[k]; const owned = P.skinOwned(k); const shopIt = SHOP.find((s) => s.key === k && s.type === 'skin');
      const row = document.createElement('div'); row.className = 'shop-item';
      row.innerHTML = `<div><div class="n">${S.name}</div><div class="d">${k === 'hollow' && !owned ? 'Find all five symbols.' : S.desc}</div></div>`;
      const btn = document.createElement('button');
      if (owned) { btn.textContent = P.d.skin === k ? 'Wearing' : 'Wear'; btn.disabled = P.d.skin === k; btn.addEventListener('click', () => { P.d.skin = k; P.save(); g.monster && g.monster.setSkin(k); this.buildEvo(); }); }
      else if (shopIt) { btn.textContent = `${shopIt.cost}`; btn.disabled = P.d.essence < shopIt.cost; btn.addEventListener('click', () => { if (P.buy(shopIt)) { P.d.skin = k; P.save(); g.monster && g.monster.setSkin(k); this.buildEvo(); } }); }
      else { btn.textContent = 'Locked'; btn.disabled = true; }
      row.appendChild(btn); sk.appendChild(row);
    }
    const cl = $('challengeList'); cl.innerHTML = '';
    for (const mk in CHALLENGES) for (const c of CHALLENGES[mk]) { const d = document.createElement('div'); d.className = 'chal' + (P.d.challenges.includes(c.id) ? ' done' : ''); d.textContent = `${MAPS[mk] ? MAPS[mk].title : mk}: ${c.text} (+${c.reward})`; cl.appendChild(d); }
    $('foundList').textContent = `Notes & tapes: ${P.d.notes.length}/${Object.keys(NOTES).filter((k) => !k.startsWith('sym')).length} · Symbols: ${P.d.symbols.length}/5`;
  }

  // ---------------- settings ----------------
  bindSettings() {
    const g = this.game;
    const on = (id, ev, fn) => $(id).addEventListener(ev, fn);
    on('setQuality', 'change', (e) => g.setSetting('quality', e.target.value));
    for (const [id, k] of [['setMaster', 'master'], ['setSfx', 'sfx'], ['setAmb', 'amb'], ['setVoice', 'voice'], ['setMusic', 'music']]) on(id, 'input', (e) => g.setSetting(k, +e.target.value));
    on('setSens', 'input', (e) => g.setSetting('sens', +e.target.value));
    on('setInvert', 'change', (e) => g.setSetting('invert', e.target.checked));
    on('setFov', 'input', (e) => g.setSetting('fov', +e.target.value));
    on('setSubs', 'change', (e) => g.setSetting('subtitles', e.target.checked));
    on('setGore', 'change', (e) => g.setSetting('gore', e.target.value));
    on('setHallu', 'change', (e) => g.setSetting('hallucinations', e.target.value === 'full'));
    on('setName', 'input', (e) => g.setSetting('playerName', e.target.value));
    on('setVoices', 'change', (e) => g.setSetting('voices', e.target.checked));
    on('setFps', 'change', (e) => g.setSetting('fps', e.target.checked));
    on('setUnlockAll', 'change', (e) => { g.progress.d.unlockAll = e.target.checked; g.progress.save(); });
  }
  loadSettings() {
    const s = this.game.settings;
    $('setQuality').value = s.quality; $('setMaster').value = s.master; $('setSfx').value = s.sfx; $('setAmb').value = s.amb; $('setVoice').value = s.voice; $('setMusic').value = s.music;
    $('setSens').value = s.sens; $('setInvert').checked = s.invert; $('setFov').value = s.fov; $('setSubs').checked = s.subtitles; $('setHallu').value = s.hallucinations ? 'full' : 'off'; $('setGore').value = s.gore || 'full';
    $('setName').value = s.playerName || ''; $('setVoices').checked = s.voices; $('setFps').checked = s.fps; $('setUnlockAll').checked = this.game.progress.d.unlockAll;
  }

  // ---------------- loading / end ----------------
  loading(title) { this.show('loading'); $('loadTitle').textContent = title; $('loadTip').textContent = TIPS[Math.floor(Math.random() * TIPS.length)]; }
  endScreen(title, text, retry = true) { this.show('endScreen'); $('endTitle').textContent = title; $('endText').textContent = text; $('btnRetry').classList.toggle('hidden', !retry); $('hud').classList.add('hidden'); }

  // ---------------- HUD ----------------
  showHUD(v) { $('hud').classList.toggle('hidden', !v); }
  buildAbilityBar() {
    const bar = $('abilities'); bar.innerHTML = ''; this.abEls = {};
    for (const k in ABILITY_DEFS) {
      const D = ABILITY_DEFS[k];
      const el = document.createElement('div'); el.className = 'ab';
      el.innerHTML = `<div class="k">${D.label}</div><div class="ic">${ICONS[k]}</div><div class="cd"></div><div class="nm">${D.name.split(' ').pop()}</div>`;
      el.title = `${D.name} — ${D.desc}`;
      bar.appendChild(el); this.abEls[k] = el;
    }
  }
  updateHUD(dt) {
    const g = this.game, m = g.monster, A = g.abilities;
    $('hpBar').style.width = m.health + '%'; $('hungerBar').style.width = m.hunger + '%'; $('stBar').style.width = m.stamina + '%';
    for (const k in this.abEls) {
      const el = this.abEls[k], S = A.state[k], D = ABILITY_DEFS[k];
      const unlocked = A.unlocked(k); el.classList.toggle('locked', !unlocked); el.classList.toggle('active', !!A.active[k]);
      const cdEl = el.querySelector('.cd');
      if (D.toggle) cdEl.style.height = ((1 - S.energy) * 100) + '%';
      else cdEl.style.height = (S.cdT > 0 ? Math.min(1, S.cdT / A.cooldown(k)) * 100 : 0) + '%';
    }
    // objective + compass
    const txt = g.mode === 'story' ? g.story.objectiveText() : g.mode === 'nightmare' ? g.nightmareObjective() : g.mode === 'survival' ? 'Survive. Feed to stay alive.' : '';
    $('objText').textContent = txt; $('objective').style.opacity = txt ? 1 : 0;
    const tp = g.mode === 'story' ? g.story.targetPos() : g.mode === 'nightmare' ? g.nightmareTarget() : null;
    if (tp) {
      const cam = g.camera; const dx = tp.x - cam.position.x, dz = tp.z - cam.position.z;
      const ang = Math.atan2(dx, dz) - m.camYaw;
      $('compass').classList.remove('hidden');
      $('compassArrow').style.transform = `rotate(${-ang}rad)`;
      $('compassDist').textContent = Math.round(Math.hypot(dx, dz)) + ' m';
    } else $('compass').classList.add('hidden');
    // interaction prompt
    const it = g.nearestInteractable();
    $('prompt').innerHTML = it ? `<b>E</b>${it.label}` : (g.combat.findFeedTargetQuiet && g.combat.findFeedTargetQuiet() ? '<b>F</b>Hold to feed' : '');
    // subtitles expiry
    this.subs = this.subs.filter((s) => { s.t -= dt; if (s.t <= 0) { s.el.remove(); return false; } return true; });
    if (this.hintT > 0) { this.hintT -= dt; if (this.hintT <= 0) $('hint').style.opacity = 0; }
    if (g.settings.fps) { $('fps').classList.remove('hidden'); $('fps').textContent = `${g.fps | 0} fps · ${g.npcs.list.length} npc · ${g.graphics.renderer.info.render.calls} calls`; } else $('fps').classList.add('hidden');
    if (g.mode === 'survival') { $('survivalInfo').classList.remove('hidden'); $('survivalInfo').innerHTML = `${fmtTime(g.survival.time)}<small>WAVE ${g.survival.wave} · ${g.stats.fedInMap} FED</small>`; } else $('survivalInfo').classList.add('hidden');
  }
  subtitle(npc, text, quiet) {
    if (!this.game.settings.subtitles) return;
    const d = npc.pos.distanceTo(this.game.monster.pos); if (d > (quiet ? 6 : 22)) return;
    this.subtitleRaw(text, 3.2, quiet);
  }
  subtitleRaw(text, t = 4, quiet = false) {
    if (!this.game.settings.subtitles && !text.includes(':')) return;
    const el = document.createElement('div'); el.className = 'sub' + (quiet ? ' quiet' : ''); el.textContent = text;
    const wrap = document.createElement('div'); wrap.appendChild(el); $('subtitles').appendChild(wrap);
    this.subs.push({ el: wrap, t });
    while (this.subs.length > 3) { const s = this.subs.shift(); s.el.remove(); }
  }
  toast(text, t = 3, cls = '') {
    const el = document.createElement('div'); el.className = 'toast ' + cls; el.textContent = text; $('toasts').appendChild(el);
    setTimeout(() => { el.style.transition = 'opacity .6s'; el.style.opacity = 0; setTimeout(() => el.remove(), 700); }, t * 1000);
  }
  bloodSplat(amount = 1) {
    if (this.game.settings.gore === 'reduced') return;
    const host = $('bloodScreen');
    if (!this.splatImgs) this.splatImgs = [0, 1, 2, 3, 4].map(() => {
      const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); const R = Math.random;
      for (let i = 0; i < 26; i++) { const r = i === 0 ? 50 + R() * 30 : 4 + R() * 22; const a = R() * 6.28, d = i === 0 ? 0 : 20 + R() * 95; const px = 128 + Math.cos(a) * d, py = 128 + Math.sin(a) * d; x.fillStyle = `rgba(${90 + R() * 40 | 0},0,0,${0.75 + R() * 0.2})`; x.beginPath(); x.arc(px, py, r, 0, 6.28); x.fill(); if (i && R() < 0.5) { x.lineWidth = 2 + R() * 4; x.strokeStyle = x.fillStyle; x.beginPath(); x.moveTo(128, 128); x.lineTo(px, py); x.stroke(); } }
      for (let i = 0; i < 6; i++) { const px = 90 + R() * 76; x.fillRect(px, 128, 3 + R() * 4, 40 + R() * 90); } // runs
      return c.toDataURL();
    });
    for (let i = 0; i < Math.ceil(3 * amount); i++) {
      const el = document.createElement('div'); el.className = 'splat'; el.style.backgroundImage = `url(${this.splatImgs[Math.floor(Math.random() * this.splatImgs.length)]})`; el.style.transform = `rotate(${Math.random() * 360}deg)`;
      const sz = 80 + Math.random() * 260 * amount; const edge = Math.random() < 0.5;
      el.style.width = el.style.height = sz + 'px';
      el.style.left = (edge ? (Math.random() < 0.5 ? -sz * 0.3 : innerWidth - sz * 0.7) : Math.random() * innerWidth - sz / 2) + 'px';
      el.style.top = (Math.random() * innerHeight - sz / 2) + 'px';
      host.appendChild(el);
      setTimeout(() => { el.style.opacity = 0; }, 600 + Math.random() * 800);
      setTimeout(() => el.remove(), 3600);
    }
  }
  hint(text, t = 4) { $('hint').textContent = text; $('hint').style.opacity = 1; this.hintT = t; }
  showNote(title, text, tape = false) { $('note').classList.remove('hidden'); $('note').classList.toggle('tape', tape); $('noteTitle').textContent = title; $('noteText').textContent = text; this.noteOpen = true; }
  closeNote() { $('note').classList.add('hidden'); this.noteOpen = false; }
  chapterTitle(title, intro) { const el = $('chapterTitle'); el.classList.remove('hidden'); $('ctTitle').textContent = title; $('ctIntro').textContent = intro; el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; clearTimeout(this.ctT); this.ctT = setTimeout(() => el.classList.add('hidden'), 7000); }
  clickToPlay(v) { $('clickToPlay').classList.toggle('hidden', !v); }
  clearHUD() { $('bloodScreen').innerHTML = ''; $('subtitles').innerHTML = ''; this.subs = []; $('toasts').innerHTML = ''; this.closeNote(); $('chapterTitle').classList.add('hidden'); $('hint').style.opacity = 0; }
}
export function fmtTime(s) { s = Math.floor(s); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
