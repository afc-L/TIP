// Menu screens (DOM). Every button maps to a real action.
import {
  FRAMES, FRAME_ORDER, WEAPONS, WEAPON_ORDER, EQUIPMENT, EQUIP_ORDER, ARMORS, ARMOR_ORDER, MOBILITY, MOBILITY_ORDER,
  ABILITIES, DAMAGE_TYPES, UPGRADE_BRANCHES, UPGRADE_TIERS, ARENAS, ARENA_ORDER, MODES, MODE_ORDER, ELIM_SIZES,
  CONDITIONS, BOSSES, BOSS_ORDER, CHALLENGES, ACHIEVEMENTS, DIFFICULTIES, DIFF_ORDER, xpForLevel, MAX_LEVEL, ENEMY_TYPES,
} from './data.js';
import {
  profile, save, resetProfile, owns, canBuy, buy, canUpgrade, doUpgrade, upgradeCost, loadoutWeight, computeStats,
  arenaUnlocked, bossUnlocked, ensureDaily, KEY_LABELS, DEFAULT_KEYS, KEY_GROUPS, checkAchievements,
} from './save.js';
import { sfx, applyVolumes, playMusic } from './audio.js';
import { Input, keyName } from './input.js';
import { fmtNum, fmtTime } from './util.js';

const root = () => document.getElementById('menu-root');

function weaponDps(w) {
  if (w.kind === 'missile') return (w.dmg * w.salvo) / (w.reload + w.salvo * w.salvoDelay);
  let dps = w.dmg * (w.pellets || 1) * w.rate;
  if (w.mag) { const cycle = w.mag / w.rate + w.reload; dps = (w.dmg * (w.pellets || 1) * w.mag) / cycle; }
  return dps;
}
function statLine(label, value, frac, color = '#4fe3ff') {
  return `<div class="sl"><span>${label}</span><div class="slbar"><i style="width:${Math.max(2, Math.min(100, frac * 100))}%;background:${color}"></i></div><b>${value}</b></div>`;
}
function costTag(d) {
  const parts = [];
  if (d.cost) parts.push(`<span class="cr">${fmtNum(d.cost)} CR</span>`);
  if (d.rp) parts.push(`<span class="rp">${d.rp} RP</span>`);
  return parts.join(' ') || '<span class="cr">FREE</span>';
}

export class Menus {
  constructor(app) {
    this.app = app;
    this.screen = null;
    this.garageFrame = profile.currentFrame;
    this.armoryTab = 'weapon';
    this.modeSel = { mode: profile.lastMode.mode || 'survival', arena: profile.lastMode.arena || 'industrial', size: 'skirmish', boss: 'irongiant', condition: 'random', difficulty: profile.settings.difficulty };
    this.settingsTab = 'graphics';
    this.returnTo = 'main';
    document.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b || b.classList.contains('locked-btn')) return;
      if (!root().contains(b) && !document.getElementById('modal-root').contains(b)) return;
      this.act(b.dataset.act, b.dataset, b);
    });
    document.addEventListener('input', (e) => {
      const t = e.target;
      if (!t.dataset || !t.dataset.set) return;
      this.setSetting(t.dataset.set, t.type === 'checkbox' ? t.checked : t.type === 'range' ? parseFloat(t.value) : t.value, t);
    });
    document.addEventListener('change', (e) => {
      const t = e.target;
      if (t.dataset && t.dataset.loadout) this.setLoadout(t.dataset.loadout, t.value);
      if (t.dataset && t.dataset.msel) { this.modeSel[t.dataset.msel] = t.value; this.render(); }
    });
  }

  show(screen) {
    this.screen = screen;
    root().classList.remove('hidden');
    this.render();
    const preview = { main: 'main', garage: 'garage', armory: 'side', upgrades: 'side' }[screen] || 'dim';
    this.app.setMenuView(preview);
  }
  hide() { root().classList.add('hidden'); root().innerHTML = ''; this.screen = null; }

  render() {
    const fn = this['r_' + this.screen];
    if (!fn) return;
    root().innerHTML = `<div class="screen s-${this.screen}">${fn.call(this)}</div>`;
    if (this.screen === 'garage') this.app.setPreview(profile.loadouts[this.garageFrame]);
    else if (this.screen === 'main') this.app.setPreview(profile.loadouts[profile.currentFrame]);
  }

  header(title, sub = '') {
    return `<div class="topbar"><button class="back" data-act="go" data-to="${this.backTarget()}">◂ BACK</button>
      <div class="ttl"><h2>${title}</h2><span>${sub}</span></div>${this.wallet()}</div>`;
  }
  backTarget() {
    if (this.screen === 'keybinds') return this.keybindsReturn || 'main';
    if (this.screen === 'settings' && this.returnTo === 'pause') return 'pause';
    return 'main';
  }
  wallet() {
    return `<div class="wallet"><span class="lv">LV ${profile.level}</span><span class="cr">${fmtNum(profile.credits)} CR</span><span class="rp">${fmtNum(profile.rp)} RP</span></div>`;
  }

  // ======================================================================
  r_main() {
    const p = profile;
    const need = xpForLevel(p.level);
    const daily = ensureDaily();
    const lm = p.lastMode;
    const quick = `${MODES[lm.mode] ? MODES[lm.mode].name : 'Arena Survival'} · ${ARENAS[lm.arena] ? ARENAS[lm.arena].name : 'Industrial Zone'}`;
    const items = [
      ['play', 'PLAY', `Quick deploy: ${quick}`],
      ['garage', 'MECH GARAGE', 'Build and configure your mechs'],
      ['armory', 'EQUIPMENT', 'Purchase weapons, modules and parts'],
      ['upgrades', 'UPGRADE TREE', 'Permanent pilot & chassis upgrades'],
      ['modes', 'GAME MODES', 'Survival · Elimination · Bosses · Domination'],
      ['missions', 'MISSIONS', `Challenges, daily op ${daily.op.done ? '✓' : '●'} and contracts`],
      ['stats', 'STATISTICS', 'Career record and achievements'],
      ['settings', 'SETTINGS', 'Graphics, audio and controls'],
      ['keybinds', 'KEYBINDS', 'Change your keyboard and mouse controls'],
    ];
    return `
    <div class="main-left">
      <div class="logo"><div class="l1">MECH ARENA</div><div class="l2">ZERO</div><div class="l3">TACTICAL COMBAT FRAME SIMULATOR · v1.0</div></div>
      <nav class="mainnav">${items.map(([to, t, s], i) => `<button class="mbtn" data-act="${to === 'play' ? 'quickplay' : 'go'}" data-to="${to}" style="animation-delay:${i * 40}ms"><b>${t}</b><span>${s}</span></button>`).join('')}</nav>
    </div>
    <div class="main-right">
      <div class="pilotcard">
        <div class="pc-top"><div class="pc-rank">${p.level}</div><div><div class="pc-name">${escapeHtml(p.pilot)}</div><div class="pc-sub">PILOT LEVEL ${p.level}${p.level >= MAX_LEVEL ? ' (MAX)' : ''}</div></div></div>
        <div class="xpbar"><i style="width:${Math.min(100, p.xp / need * 100)}%"></i></div>
        <div class="pc-xp">${fmtNum(p.xp)} / ${fmtNum(need)} XP</div>
        <div class="pc-cur"><span class="cr">${fmtNum(p.credits)} CR</span><span class="rp">${fmtNum(p.rp)} RP</span></div>
        <div class="pc-mech">ACTIVE FRAME: <b>${FRAMES[p.currentFrame].name}</b> · ${FRAMES[p.currentFrame].cls}</div>
      </div>
      <div class="dailycard">
        <div class="dc-h">DAILY OPERATION <span>${daily.date}</span></div>
        <div class="dc-b">${MODES[daily.op.mode].name} · ${ARENAS[daily.op.arena].name}<br><small>${CONDITIONS[daily.op.condition].name} · ${DIFFICULTIES[daily.op.difficulty].name} · 2× credits, +15 RP</small></div>
        ${daily.op.done ? '<div class="done">COMPLETED</div>' : `<button class="btn small" data-act="daily">LAUNCH OP</button>`}
      </div>
    </div>`;
  }

  // ======================================================================
  r_modes() {
    const s = this.modeSel;
    if (!MODES[s.mode] || profile.level < MODES[s.mode].level) s.mode = 'survival';
    const list = MODE_ORDER.map((id) => {
      const m = MODES[id], locked = profile.level < m.level;
      return `<button class="modecard ${s.mode === id ? 'sel' : ''} ${locked ? 'locked' : ''}" data-act="${locked ? 'deny' : 'msel'}" data-k="mode" data-v="${id}">
        <div class="mi">${m.icon}</div><div><b>${m.name}</b><span>${locked ? `Unlocks at level ${m.level}` : m.desc}</span></div></button>`;
    }).join('');
    let opts = '';
    if (s.mode === 'challenge') {
      opts = `<p class="note">Challenge missions are listed on the Missions screen.</p><button class="btn" data-act="go" data-to="missions">OPEN MISSIONS</button>`;
    } else if (s.mode === 'boss') {
      opts = `<div class="opt-h">SELECT TARGET</div><div class="bosslist">${BOSS_ORDER.map((id) => {
        const b = BOSSES[id], un = bossUnlocked(id, BOSSES), done = profile.bosses[id];
        return `<button class="bosscard ${s.boss === id ? 'sel' : ''} ${un ? '' : 'locked'}" data-act="${un ? 'msel' : 'deny'}" data-k="boss" data-v="${id}">
          <b>${b.name}</b><small>${b.title}</small><span>${un ? b.desc : `Requires level ${b.level}${b.requires ? ' and defeating ' + BOSSES[b.requires].name : ''}`}</span>
          <em>${done ? `DEFEATED ×${done}` : `First kill: ${fmtNum(b.reward.credits)} CR · ${b.reward.rp} RP`}</em></button>`;
      }).join('')}</div>${this.diffSel()}`;
    } else {
      opts = `<div class="opt-h">ARENA</div><div class="arenalist">${ARENA_ORDER.map((id) => {
        const a = ARENAS[id], un = arenaUnlocked(id);
        return `<button class="arenacard a-${id} ${s.arena === id ? 'sel' : ''} ${un ? '' : 'locked'}" data-act="${un ? 'msel' : 'deny'}" data-k="arena" data-v="${id}"><b>${a.name}</b><span>${un ? a.desc : 'Unlocks at level ' + a.level}</span>${profile.arenaWins[id] ? '<em>✓</em>' : ''}</button>`;
      }).join('')}</div>`;
      if (s.mode === 'elimination') {
        opts += `<div class="opt-h">TEAM SIZE</div><div class="seg">${Object.entries(ELIM_SIZES).map(([k, v]) => `<button class="${s.size === k ? 'sel' : ''}" data-act="msel" data-k="size" data-v="${k}">${v.name}</button>`).join('')}</div>`;
      }
      opts += this.diffSel();
      opts += `<div class="opt-h">MATCH CONDITIONS</div><select data-msel="condition"><option value="random" ${s.condition === 'random' ? 'selected' : ''}>Randomized</option>${Object.entries(CONDITIONS).map(([k, c]) => `<option value="${k}" ${s.condition === k ? 'selected' : ''}>${c.name} — ${c.desc}</option>`).join('')}</select>`;
    }
    const canDeploy = s.mode !== 'challenge' && (s.mode !== 'boss' || bossUnlocked(s.boss, BOSSES));
    return `${this.header('GAME MODES', 'Choose your battlefield')}
    <div class="cols2"><div class="col modes">${list}</div>
    <div class="col opts">${opts}${canDeploy ? `<button class="btn deploy" data-act="deploy">DEPLOY ▸</button>` : ''}</div></div>`;
  }
  diffSel() {
    const s = this.modeSel;
    return `<div class="opt-h">DIFFICULTY</div><div class="seg">${DIFF_ORDER.map((d) => `<button class="${s.difficulty === d ? 'sel' : ''}" data-act="msel" data-k="difficulty" data-v="${d}" title="${DIFFICULTIES[d].desc}">${DIFFICULTIES[d].name}</button>`).join('')}</div>
    <p class="note">${DIFFICULTIES[s.difficulty].desc} Rewards ×${DIFFICULTIES[s.difficulty].reward}${DIFFICULTIES[s.difficulty].rp ? `, +${DIFFICULTIES[s.difficulty].rp} RP on win` : ''}.</p>`;
  }

  // ======================================================================
  r_garage() {
    const fid = this.garageFrame;
    const f = FRAMES[fid];
    const ownsF = owns('frame', fid);
    const l = profile.loadouts[fid];
    const frames = FRAME_ORDER.map((id) => {
      const fr = FRAMES[id], o = owns('frame', id);
      const lock = !o && profile.level < fr.level;
      return `<button class="framecard ${id === fid ? 'sel' : ''} ${o ? 'owned' : ''} ${lock ? 'locked' : ''}" data-act="gframe" data-v="${id}">
        <b>${fr.name}</b><small>${fr.cls}</small>${id === profile.currentFrame ? '<em>ACTIVE</em>' : o ? '' : lock ? `<em>LV ${fr.level}</em>` : `<em>${costTag(fr)}</em>`}</button>`;
    }).join('');
    const st = computeStats(l, profile.upgrades);
    const w = loadoutWeight(l);
    const over = w > f.capacity;
    const sel = (kind, cur, ids, defs, key) => `<select data-loadout="${key}" ${ownsF ? '' : 'disabled'}>${ids.filter((id) => owns(kind, id)).map((id) => `<option value="${id}" ${id === cur ? 'selected' : ''}>${defs[id].name} (${defs[id].weight >= 0 ? '+' : ''}${defs[id].weight})</option>`).join('')}</select>`;
    const eqSel = (i) => `<select data-loadout="equip${i}" ${ownsF ? '' : 'disabled'}><option value="">— Empty —</option>${EQUIP_ORDER.filter((id) => owns('equip', id)).map((id) => `<option value="${id}" ${l.equip[i] === id ? 'selected' : ''}>${EQUIPMENT[id].name} (+${EQUIPMENT[id].weight})</option>`).join('')}</select>`;
    const ab = ABILITIES[f.ability];
    const wInfo = (id) => { const d = WEAPONS[id]; return `<div class="winfo"><span style="color:${DAMAGE_TYPES[d.dmgType].color}">${DAMAGE_TYPES[d.dmgType].name}</span> · ~${Math.round(weaponDps(d))} DPS · ${d.range}m</div>`; };
    let buyBox = '';
    if (!ownsF) {
      const c = canBuy('frame', fid);
      buyBox = `<div class="buybox"><div>${costTag(f)}</div><button class="btn ${c.ok ? '' : 'disabled'}" data-act="${c.ok ? 'buy' : 'deny'}" data-kind="frame" data-v="${fid}">${c.ok ? 'PURCHASE FRAME' : c.why}</button></div>`;
    }
    return `${this.header('MECH GARAGE', 'Configure your combat frame')}
    <div class="garage">
      <div class="col framelist">${frames}</div>
      <div class="garage-center">
        <div class="gname"><h1>${f.name}</h1><span>${f.cls.toUpperCase()} CHASSIS</span></div>
        <p class="gdesc">${f.desc}</p>
        <div class="gability"><b>★ ${ab.name}</b> — ${ab.desc} <i>(${ab.cd}s)</i></div>
        ${buyBox}
        <div class="rotate-hint">Drag to rotate · Mouse wheel to zoom</div>
      </div>
      <div class="col loadoutcol">
        <div class="cap ${over ? 'over' : ''}"><span>CAPACITY</span><div class="capbar"><i style="width:${Math.min(100, w / f.capacity * 100)}%"></i></div><b>${w} / ${f.capacity}</b></div>
        ${over ? '<div class="warnmsg">Over capacity — remove parts before deploying.</div>' : ''}
        <label>PRIMARY WEAPON (LMB)</label>${sel('weapon', l.weapons[0], WEAPON_ORDER, WEAPONS, 'w0')}${wInfo(l.weapons[0])}
        <label>SECONDARY WEAPON (RMB)</label>${sel('weapon', l.weapons[1], WEAPON_ORDER, WEAPONS, 'w1')}${wInfo(l.weapons[1])}
        <label>ARMOR</label>${sel('armor', l.armor, ARMOR_ORDER, ARMORS, 'armor')}
        <label>MOBILITY</label>${sel('mobility', l.mobility, MOBILITY_ORDER, MOBILITY, 'mobility')}
        <label>EQUIPMENT SLOTS (${f.slots})</label>${Array.from({ length: f.slots }, (_, i) => eqSel(i)).join('')}
        <div class="statsbox">
          ${statLine('ARMOR', Math.round(st.maxHp), st.maxHp / 1900, '#ffb347')}
          ${statLine('SHIELD', Math.round(st.maxShield), st.maxShield / 650, '#4fe3ff')}
          ${statLine('SPEED', st.speed.toFixed(1), st.speed / 20, '#7dffb0')}
          ${statLine('JUMP', st.jump.toFixed(1), st.jump / 22, '#c792ff')}
          ${statLine('ENERGY', Math.round(st.maxEnergy), st.maxEnergy / 200, '#ffe066')}
          ${statLine('DPS', Math.round((weaponDps(WEAPONS[l.weapons[0]]) + weaponDps(WEAPONS[l.weapons[1]])) * st.dmgMul), (weaponDps(WEAPONS[l.weapons[0]]) + weaponDps(WEAPONS[l.weapons[1]])) / 300, '#ff6a6a')}
        </div>
        ${ownsF ? (fid === profile.currentFrame ? '<div class="activeflag">✓ ACTIVE FRAME</div>' : `<button class="btn" data-act="setframe" data-v="${fid}">SET AS ACTIVE</button>`) : ''}
      </div>
    </div>`;
  }
  setLoadout(key, value) {
    const l = profile.loadouts[this.garageFrame];
    if (key === 'w0') l.weapons[0] = value;
    else if (key === 'w1') l.weapons[1] = value;
    else if (key === 'armor') l.armor = value;
    else if (key === 'mobility') l.mobility = value;
    else if (key.startsWith('equip')) {
      const i = +key.slice(5);
      if (value && l.equip.includes(value) && l.equip[i] !== value) { sfx('uideny'); this.toast('Module already equipped in another slot'); this.render(); return; }
      l.equip[i] = value || null;
    }
    sfx('ui');
    save();
    this.render();
  }

  // ======================================================================
  r_armory() {
    const tabs = [['weapon', 'WEAPONS'], ['equip', 'SPECIAL EQUIPMENT'], ['armor', 'ARMOR'], ['mobility', 'MOBILITY']];
    const t = this.armoryTab;
    const conf = { weapon: [WEAPON_ORDER, WEAPONS], equip: [EQUIP_ORDER, EQUIPMENT], armor: [ARMOR_ORDER, ARMORS], mobility: [MOBILITY_ORDER, MOBILITY] }[t];
    const cards = conf[0].map((id) => {
      const d = conf[1][id];
      const o = owns(t, id);
      const c = canBuy(t, id);
      let stats = '';
      if (t === 'weapon') {
        stats = `<div class="istats">
          <span>TYPE <b style="color:${DAMAGE_TYPES[d.dmgType].color}">${DAMAGE_TYPES[d.dmgType].name}</b></span>
          <span>DAMAGE <b>${d.dmg}${d.pellets ? '×' + d.pellets : ''}${d.salvo ? '×' + d.salvo : ''}${d.splash ? ' (splash)' : ''}</b></span>
          <span>FIRE RATE <b>${d.kind === 'missile' ? 'salvo' : d.rate + '/s'}</b></span>
          <span>RANGE <b>${d.range}m</b></span>
          <span>${d.heat ? 'HEAT/SHOT' : 'MAGAZINE'} <b>${d.heat ? d.heat : d.mag + (d.kind === 'missile' ? ' salvo' : '')}</b></span>
          <span>${d.heat ? 'COOLING' : 'RELOAD'} <b>${d.heat ? 'passive' : d.reload + 's'}</b></span>
          <span>~DPS <b>${Math.round(weaponDps(d))}</b></span><span>WEIGHT <b>${d.weight}</b></span></div>`;
      } else if (t === 'equip') stats = `<div class="istats"><span>COOLDOWN <b>${d.cd}s</b></span>${d.dur ? `<span>DURATION <b>${d.dur}s</b></span>` : ''}<span>WEIGHT <b>${d.weight}</b></span></div>`;
      else stats = `<div class="istats"><span>WEIGHT <b>${d.weight >= 0 ? '+' : ''}${d.weight}</b></span></div>`;
      return `<div class="item ${o ? 'owned' : ''} ${d.experimental ? 'exp' : ''}">
        <div class="ih"><b>${d.icon ? d.icon + ' ' : ''}${d.name}</b><small>${d.cat || (d.experimental ? 'Experimental' : '')}</small></div>
        <p>${d.desc}</p>${stats}
        <div class="ifoot">${o ? '<span class="ownedtag">OWNED</span>' : `${costTag(d)} <button class="btn small ${c.ok ? '' : 'disabled'}" data-act="${c.ok ? 'buy' : 'deny'}" data-kind="${t}" data-v="${id}">${c.ok ? 'BUY' : c.why}</button>`}</div>
      </div>`;
    }).join('');
    return `${this.header('EQUIPMENT', 'Armory — standard gear costs credits, experimental tech needs research points')}
      <div class="tabs">${tabs.map(([k, n]) => `<button class="${t === k ? 'sel' : ''}" data-act="atab" data-v="${k}">${n}</button>`).join('')}</div>
      <div class="itemgrid">${cards}</div>
      <p class="note">Damage types: ${Object.values(DAMAGE_TYPES).map((d) => `<b style="color:${d.color}">${d.name}</b> ${d.desc}`).join(' · ')}</p>`;
  }

  // ======================================================================
  r_upgrades() {
    const cols = Object.entries(UPGRADE_BRANCHES).map(([id, b]) => {
      const tier = profile.upgrades[id];
      const next = upgradeCost(id);
      const c = canUpgrade(id);
      const nodes = UPGRADE_TIERS.map((t, i) => `<div class="unode ${i < tier ? 'got' : i === tier ? 'next' : ''}"><b>${['I', 'II', 'III', 'IV', 'V'][i]}</b><span>${fmtNum(t.cost)} CR${t.rp ? ' · ' + t.rp + ' RP' : ''}</span><small>LV ${t.level}</small></div>`).join('<div class="ulink"></div>');
      return `<div class="ubranch">
        <div class="uh"><div class="uicon">${b.icon}</div><b>${b.name}</b><small>${b.desc}</small><em>Per tier: ${b.per}</em></div>
        <div class="unodes">${nodes}</div>
        ${next ? `<button class="btn small ${c.ok ? '' : 'disabled'}" data-act="${c.ok ? 'upgrade' : 'deny'}" data-v="${id}">${c.ok ? `UPGRADE → ${['I', 'II', 'III', 'IV', 'V'][tier]}` : c.why}</button>` : '<div class="maxed">MAXED</div>'}
      </div>`;
    }).join('');
    return `${this.header('UPGRADE TREE', 'Permanent upgrades apply to every mech you pilot')}<div class="utree">${cols}</div>
    <p class="note">Enemy forces adapt to your upgrade level, so upgrades give you an edge — not invincibility.</p>`;
  }

  // ======================================================================
  r_missions() {
    const d = ensureDaily();
    const ch = CHALLENGES.map((c) => {
      const lock = profile.level < c.level, done = profile.challenges[c.id];
      return `<div class="chal ${done ? 'done' : ''} ${lock ? 'locked' : ''}">
        <div class="ch-h"><b>${c.name}</b><small>${ARENAS[c.arena].name} · ${DIFFICULTIES[c.diff].name}</small></div>
        <p>${c.desc}</p>
        <div class="ch-f"><span>${done ? `✓ Best ${fmtTime(done)}` : `${fmtNum(c.reward.credits)} CR · ${c.reward.rp} RP · ${c.reward.xp} XP`}</span>
        ${lock ? `<span class="lk">LEVEL ${c.level}</span>` : `<button class="btn small" data-act="challenge" data-v="${c.id}">${done ? 'REPLAY' : 'START'}</button>`}</div></div>`;
    }).join('');
    const op = d.op;
    const opDesc = `${MODES[op.mode].name}${op.mode === 'elimination' ? ' (' + ELIM_SIZES[op.size].name + ')' : ''} · ${ARENAS[op.arena].name}`;
    return `${this.header('MISSIONS', 'Challenge missions, daily operations and contracts')}
    <div class="cols2">
      <div class="col">
        <div class="dailybig"><div class="dc-h">DAILY OPERATION · ${d.date}</div>
          <h3>${opDesc}</h3><p>Condition: <b>${CONDITIONS[op.condition].name}</b> — ${CONDITIONS[op.condition].desc}<br>Difficulty: <b>${DIFFICULTIES[op.difficulty].name}</b> · Reward: 2× credits, 1.5× XP, +15 RP</p>
          ${op.done ? '<div class="done">COMPLETED TODAY</div>' : '<button class="btn" data-act="daily">LAUNCH DAILY OP</button>'}</div>
        <div class="opt-h">DAILY CONTRACTS</div>
        ${d.contracts.map((c) => `<div class="contract ${c.done ? 'done' : ''}"><div><b>${c.text}</b><small>${c.done ? 'COMPLETE' : `${fmtNum(c.progress)} / ${fmtNum(c.n)}`} · ${c.reward} CR</small></div><div class="cbar"><i style="width:${c.progress / c.n * 100}%"></i></div></div>`).join('')}
        <p class="note">Contracts progress in any mode and refresh every day.</p>
      </div>
      <div class="col chals"><div class="opt-h">CHALLENGE MISSIONS (${Object.keys(profile.challenges).length}/${CHALLENGES.length})</div>${ch}</div>
    </div>`;
  }

  // ======================================================================
  r_stats() {
    const s = profile.stats;
    const fav = Object.entries(s.mechUse).sort((a, b) => b[1] - a[1])[0];
    const favW = Object.entries(s.weaponDamage).sort((a, b) => b[1] - a[1])[0];
    const rows = [
      ['Pilot level', profile.level], ['Total matches', s.matches], ['Wins', s.wins], ['Losses', s.losses],
      ['Win rate', s.matches ? Math.round(s.wins / s.matches * 100) + '%' : '—'],
      ['Enemies defeated', fmtNum(s.kills)], ['Deaths', s.deaths], ['Bosses defeated', s.bossKills],
      ['Total damage dealt', fmtNum(s.damage)], ['Damage taken', fmtNum(s.damageTaken)], ['Critical hits', fmtNum(s.crits)],
      ['Accuracy', s.shotsFired ? Math.round(s.shotsHit / s.shotsFired * 100) + '%' : '—'],
      ['Highest survival wave', s.bestWave], ['Favorite mech', fav ? `${FRAMES[fav[0]].name} (${fav[1]} matches)` : '—'],
      ['Most-used weapon', favW ? `${WEAPONS[favW[0]] ? WEAPONS[favW[0]].name : favW[0]} (${fmtNum(favW[1])} dmg)` : '—'],
      ['Time in combat', fmtTime(s.playTime)], ['Challenges complete', `${Object.keys(profile.challenges).length}/${CHALLENGES.length}`],
      ['Bosses', BOSS_ORDER.map((b) => `${BOSSES[b].name.split(' ')[0]} ${profile.bosses[b] ? '✓' : '✗'}`).join(' · ')],
    ];
    const ach = Object.entries(ACHIEVEMENTS).map(([id, a]) => `<div class="ach ${profile.achievements[id] ? 'got' : ''}"><b>${profile.achievements[id] ? '🏆' : '🔒'} ${a.name}</b><span>${a.desc}</span><small>+${fmtNum(a.reward)} CR</small></div>`).join('');
    return `${this.header('STATISTICS', 'Service record')}
    <div class="cols2"><div class="col"><table class="stattable">${rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table></div>
    <div class="col"><div class="opt-h">ACHIEVEMENTS (${Object.keys(profile.achievements).length}/${Object.keys(ACHIEVEMENTS).length})</div><div class="achgrid">${ach}</div></div></div>`;
  }

  // ======================================================================
  r_settings() {
    const s = profile.settings;
    const t = this.settingsTab;
    const tabs = [['graphics', 'GRAPHICS'], ['audio', 'AUDIO'], ['controls', 'CONTROLS'], ['gameplay', 'GAMEPLAY'], ['data', 'DATA']];
    const range = (k, min, max, step, label, fmt = (v) => v) => `<div class="setrow"><label>${label}</label><input type="range" min="${min}" max="${max}" step="${step}" value="${s[k]}" data-set="${k}"><span class="val" data-val="${k}">${fmt(s[k])}</span></div>`;
    const check = (k, label) => `<div class="setrow"><label>${label}</label><input type="checkbox" ${s[k] ? 'checked' : ''} data-set="${k}"></div>`;
    let body = '';
    if (t === 'graphics') {
      body = `<div class="setrow"><label>Quality preset</label><div class="seg">${['low', 'medium', 'high'].map((q) => `<button class="${s.quality === q ? 'sel' : ''}" data-act="quality" data-v="${q}">${q.toUpperCase()}</button>`).join('')}</div></div>
      <p class="note">LOW is recommended for older/integrated-GPU laptops: no shadows, fewer particles, lower resolution.</p>
      ${range('renderScale', 0.5, 1.5, 0.05, 'Render scale', (v) => Math.round(v * 100) + '%')}
      ${check('shadows', 'Shadows')}
      ${range('particles', 0.3, 1.5, 0.1, 'Particle density', (v) => Math.round(v * 100) + '%')}
      ${range('fov', 55, 95, 1, 'Field of view', (v) => v + '°')}
      ${range('cameraShake', 0, 1.5, 0.1, 'Camera shake', (v) => Math.round(v * 100) + '%')}
      ${check('showFps', 'Show FPS counter')}`;
    } else if (t === 'audio') {
      body = `${range('masterVol', 0, 1, 0.05, 'Master volume', (v) => Math.round(v * 100) + '%')}
      ${range('sfxVol', 0, 1, 0.05, 'Effects volume', (v) => Math.round(v * 100) + '%')}
      ${range('musicVol', 0, 1, 0.05, 'Music volume', (v) => Math.round(v * 100) + '%')}
      ${check('music', 'Background music')}
      <button class="btn small" data-act="testsound">TEST SOUND</button>`;
    } else if (t === 'controls') {
      body = `${range('sensitivity', 0.2, 3, 0.05, 'Mouse sensitivity', (v) => v.toFixed(2))}
      ${check('invertY', 'Invert Y axis')}
      ${check('aimAssist', 'Aim assist on locked targets')}
      <div class="opt-h">KEY BINDINGS</div>
      <p class="note">Rebind any action to a key or mouse button.</p>
      <button class="btn" data-act="openkeys" data-from="settings">EDIT KEYBINDS ▸</button>`;
    } else if (t === 'gameplay') {
      body = `<div class="setrow"><label>Default difficulty</label><div class="seg">${DIFF_ORDER.map((d) => `<button class="${s.difficulty === d ? 'sel' : ''}" data-act="setdiff" data-v="${d}">${DIFFICULTIES[d].name}</button>`).join('')}</div></div>
      <p class="note">${DIFFICULTIES[s.difficulty].desc}</p>
      ${check('damageNumbers', 'Show damage numbers')}
      <div class="setrow"><label>Pilot callsign</label><input type="text" maxlength="14" value="${escapeHtml(profile.pilot)}" data-set="pilot"></div>`;
    } else if (t === 'data') {
      body = `<p>Progress is saved automatically in this browser (localStorage) after every match and purchase.</p>
      <button class="btn small" data-act="savenow">SAVE NOW</button>
      <div class="danger"><b>Reset all progress</b><p>Deletes your level, currencies, mechs, equipment, upgrades, achievements and statistics.</p><button class="btn danger" data-act="reset">RESET SAVE DATA</button></div>`;
    }
    return `${this.header('SETTINGS', 'Changes save automatically')}<div class="tabs">${tabs.map(([k, n]) => `<button class="${t === k ? 'sel' : ''}" data-act="stab" data-v="${k}">${n}</button>`).join('')}</div><div class="setbody">${body}</div>`;
  }
  r_keybinds() {
    const keys = profile.settings.keys;
    const counts = {};
    for (const k of Object.keys(DEFAULT_KEYS)) if (keys[k]) counts[keys[k]] = (counts[keys[k]] || 0) + 1;
    const row = (k) => {
      const code = keys[k];
      const listening = this.listening === k;
      const changed = code !== DEFAULT_KEYS[k];
      const clash = code && counts[code] > 1;
      return `<div class="kbrow ${listening ? 'listening' : ''} ${clash ? 'clash' : ''}">
        <span class="kbl">${KEY_LABELS[k]}</span>
        <button class="keybtn ${listening ? 'listening' : ''} ${code ? '' : 'unbound'}" data-act="rebind" data-v="${k}" id="kb-${k}">${listening ? 'PRESS A KEY…' : code ? keyName(code) : 'UNBOUND'}</button>
        <button class="kbreset" data-act="resetkey" data-v="${k}" title="Reset to ${keyName(DEFAULT_KEYS[k])}" ${changed ? '' : 'disabled'}>↺</button>
      </div>`;
    };
    const unbound = Object.keys(DEFAULT_KEYS).filter((k) => !keys[k]).length;
    return `${this.header('KEYBINDS', 'Click an action, then press a key or mouse button')}
    <div class="kbhelp"><span><b>Esc</b> cancels</span><span><b>Backspace</b> unbinds</span><span>Binding a key that is already used swaps the two actions</span><span><b>Esc</b> always pauses the game and can't be rebound</span></div>
    ${unbound ? `<div class="warnmsg">${unbound} action${unbound > 1 ? 's are' : ' is'} unbound and can't be used in a match.</div>` : ''}
    <div class="kbgrid">${KEY_GROUPS.map((g) => `<section class="kbgroup"><div class="opt-h">${g.name.toUpperCase()}</div>${g.keys.map(row).join('')}</section>`).join('')}</div>
    <div class="kbfoot"><button class="btn small" data-act="resetkeys">RESET ALL TO DEFAULTS</button></div>`;
  }
  startRebind(action) {
    this.listening = action;
    this.render();
    // start listening after the click that opened it has finished
    setTimeout(() => Input.captureNextKey((code) => this.finishRebind(action, code)), 0);
  }
  finishRebind(action, code) {
    const keys = profile.settings.keys;
    this.listening = null;
    if (code === 'Escape') { sfx('ui'); this.render(); return; }
    if (code === 'Backspace' || code === 'Delete') { keys[action] = null; save(); sfx('ui'); this.toast(`${KEY_LABELS[action]} unbound`); this.render(); return; }
    const other = Object.keys(DEFAULT_KEYS).find((k) => keys[k] === code && k !== action);
    const prev = keys[action];
    keys[action] = code;
    if (other) {
      keys[other] = prev || null;
      this.toast(`${keyName(code)} moved from ${KEY_LABELS[other]} — that action is now ${prev ? keyName(prev) : 'unbound'}`);
    }
    save(); sfx('uiconfirm'); this.render();
  }

  setSetting(k, v, el) {
    if (k === 'pilot') { profile.pilot = String(v).toUpperCase().slice(0, 14) || 'PILOT'; save(); return; }
    profile.settings[k] = v;
    const lab = root().querySelector(`[data-val="${k}"]`);
    if (lab) {
      const f = { renderScale: (x) => Math.round(x * 100) + '%', particles: (x) => Math.round(x * 100) + '%', fov: (x) => x + '°', cameraShake: (x) => Math.round(x * 100) + '%', sensitivity: (x) => x.toFixed(2) }[k] || ((x) => Math.round(x * 100) + '%');
      lab.textContent = f(v);
    }
    if (['masterVol', 'sfxVol', 'musicVol', 'music'].includes(k)) applyVolumes();
    if (k === 'renderScale' || k === 'fov') this.app.applyGraphics();
    this.app.settingsChanged(k);
    save();
  }

  // ======================================================================
  r_pause() {
    const g = this.app.game;
    const info = g ? g.mode.hud() : { title: '' };
    return `<div class="pausebox"><h2>PAUSED</h2><div class="psub">${info.title} · ${g ? fmtTime(g.time) : ''}</div>
      <button class="btn" data-act="resume">RESUME</button>
      <button class="btn" data-act="psettings">SETTINGS</button>
      <button class="btn" data-act="openkeys" data-from="pause">KEYBINDS</button>
      <button class="btn" data-act="restart">RESTART MATCH</button>
      <button class="btn danger" data-act="abandon">ABANDON MATCH</button>
      <div class="pcontrols">${['forward', 'left', 'back', 'right'].map((k) => keyName(profile.settings.keys[k])).join('')} move · Mouse aim · ${keyName(profile.settings.keys.fire1)} / ${keyName(profile.settings.keys.fire2)} fire · ${keyName(profile.settings.keys.jump)} jump (hold: jets) · ${keyName(profile.settings.keys.sprint)} sprint · ${keyName(profile.settings.keys.dash)} dash · ${keyName(profile.settings.keys.ability)} ability · ${[1, 2, 3, 4].map((i) => keyName(profile.settings.keys['slot' + i])).join('/')} select module · ${keyName(profile.settings.keys.equipUse)} use module · ${keyName(profile.settings.keys.lock)} lock · ${keyName(profile.settings.keys.zoom)} zoom · ${keyName(profile.settings.keys.reload)} reload</div></div>`;
  }

  r_results() {
    const r = this.results;
    const st = r.stats;
    const acc = st.shots ? Math.round(st.hits / st.shots * 100) : 0;
    return `<div class="results ${r.win ? 'win' : 'lose'}">
      <h1>${r.mode === 'survival' ? (r.win ? 'RUN COMPLETE' : 'RUN OVER') : r.win ? 'VICTORY' : 'DEFEAT'}</h1><div class="rr">${r.reason}</div>
      <div class="rgrid">
        <div class="rbox"><div class="opt-h">COMBAT REPORT</div>
          <table class="stattable"><tr><td>Mode</td><td>${MODES[r.mode].name}</td></tr><tr><td>Duration</td><td>${fmtTime(r.time)}</td></tr>
          ${r.mode === 'survival' ? `<tr><td>Waves cleared</td><td>${r.wave}</td></tr>` : ''}
          <tr><td>Kills</td><td>${st.kills}</td></tr><tr><td>Damage dealt</td><td>${fmtNum(st.damage)}</td></tr><tr><td>Damage taken</td><td>${fmtNum(st.damageTaken)}</td></tr>
          <tr><td>Accuracy</td><td>${acc}%</td></tr><tr><td>Critical hits</td><td>${st.crits}</td></tr><tr><td>Abilities used</td><td>${st.abilities}</td></tr></table></div>
        <div class="rbox"><div class="opt-h">REWARDS</div>
          <div class="rew"><span class="cr">+${fmtNum(r.credits)} CR</span><span class="xp">+${fmtNum(r.xp)} XP</span><span class="rp">+${r.rp} RP</span></div>
          ${r.daily ? '<div class="good">Daily Operation complete! Bonus applied.</div>' : ''}
          ${r.firstBoss ? '<div class="good">First boss kill bonus!</div>' : ''}
          ${r.levelAfter > r.levelBefore ? `<div class="lvup">PILOT LEVEL ${r.levelAfter}!</div><ul class="unl">${r.unlocks.map((u) => `<li>${u}</li>`).join('') || '<li>New gear available in the armory</li>'}</ul>` : `<div class="xpbar"><i style="width:${Math.min(100, profile.xp / xpForLevel(profile.level) * 100)}%"></i></div><small>${fmtNum(profile.xp)} / ${fmtNum(xpForLevel(profile.level))} XP to level ${profile.level + 1}</small>`}
          ${r.achievements.length ? `<div class="opt-h">ACHIEVEMENTS UNLOCKED</div>${r.achievements.map((a) => `<div class="achpop">🏆 ${ACHIEVEMENTS[a].name} <small>+${fmtNum(ACHIEVEMENTS[a].reward)} CR</small></div>`).join('')}` : ''}
        </div>
      </div>
      <div class="rbtns"><button class="btn" data-act="again">PLAY AGAIN</button><button class="btn" data-act="go" data-to="garage">GARAGE</button><button class="btn" data-act="go" data-to="main">MAIN MENU</button></div>
    </div>`;
  }

  // ======================================================================
  act(a, d, el) {
    switch (a) {
      case 'go':
        sfx('ui');
        Input.cancelCapture(); this.listening = null;
        if (d.to === 'keybinds') this.keybindsReturn = 'main';
        if (d.to === 'settings' && this.screen === 'keybinds' && this.keybindsReturn === 'settings') { this.show('settings'); return; }
        if (d.to === 'pause') { this.show('pause'); return; }
        if (this.app.game && d.to === 'main' && this.screen !== 'results') { this.show('pause'); return; }
        if (this.app.game) this.app.endGame();
        this.show(d.to);
        break;
      case 'deny': sfx('uideny'); break;
      case 'quickplay': {
        sfx('uiconfirm');
        const lm = profile.lastMode;
        let cfg = { ...lm };
        if (!cfg.mode || cfg.mode === 'challenge' || (cfg.mode === 'boss' && !bossUnlocked(cfg.boss || 'irongiant', BOSSES))) cfg = { mode: 'survival', arena: 'industrial' };
        if (cfg.arena && !arenaUnlocked(cfg.arena)) cfg.arena = 'industrial';
        cfg.difficulty = profile.settings.difficulty;
        this.launch(cfg);
        break;
      }
      case 'msel':
        sfx('ui');
        this.modeSel[d.k] = d.v;
        this.render();
        break;
      case 'deploy': {
        const s = this.modeSel;
        const cfg = { mode: s.mode, arena: s.arena, difficulty: s.difficulty, size: s.size, boss: s.boss, condition: s.condition };
        sfx('uiconfirm');
        this.launch(cfg);
        break;
      }
      case 'challenge': sfx('uiconfirm'); this.launch({ mode: 'challenge', challenge: d.v }); break;
      case 'daily': {
        const op = ensureDaily().op;
        if (op.done) return;
        sfx('uiconfirm');
        let mode = op.mode;
        if (profile.level < MODES[mode].level) mode = 'survival';
        this.launch({ mode, arena: arenaUnlocked(op.arena) ? op.arena : 'industrial', difficulty: op.difficulty, condition: op.condition, size: op.size, daily: true });
        break;
      }
      case 'gframe': sfx('ui'); this.garageFrame = d.v; this.render(); break;
      case 'setframe': sfx('uiconfirm'); profile.currentFrame = d.v; save(); this.render(); break;
      case 'buy': {
        const r = buy(d.kind, d.v);
        if (r.ok) {
          sfx('buy');
          if (d.kind === 'frame') { profile.currentFrame = d.v; }
          const got = checkAchievements(); save();
          got.forEach((id) => this.toast(`Achievement: ${id.replace('_', ' ')}`));
        } else sfx('uideny');
        this.render();
        break;
      }
      case 'atab': sfx('ui'); this.armoryTab = d.v; this.render(); break;
      case 'upgrade': {
        const r = doUpgrade(d.v);
        if (r.ok) { sfx('buy'); checkAchievements(); save(); } else sfx('uideny');
        this.render();
        break;
      }
      case 'stab': sfx('ui'); this.settingsTab = d.v; this.render(); break;
      case 'quality': {
        const q = d.v;
        const s = profile.settings;
        s.quality = q;
        if (q === 'low') { s.renderScale = 0.75; s.shadows = false; s.particles = 0.6; }
        if (q === 'medium') { s.renderScale = 1; s.shadows = true; s.particles = 1; }
        if (q === 'high') { s.renderScale = 1.25; s.shadows = true; s.particles = 1.25; }
        save(); this.app.applyGraphics(); sfx('ui'); this.render();
        if (this.app.game) this.toast('Shadow/particle changes apply to the next match');
        break;
      }
      case 'setdiff': profile.settings.difficulty = d.v; this.modeSel.difficulty = d.v; save(); sfx('ui'); this.render(); break;
      case 'testsound': sfx('explosion', 1); setTimeout(() => sfx('pulse', 1), 300); break;
      case 'rebind':
        if (this.listening === d.v) { Input.cancelCapture(); this.listening = null; this.render(); break; }
        Input.cancelCapture();
        sfx('ui'); this.startRebind(d.v);
        break;
      case 'resetkey': {
        const keys = profile.settings.keys, def = DEFAULT_KEYS[d.v], prev = keys[d.v];
        const other = Object.keys(DEFAULT_KEYS).find((k) => k !== d.v && keys[k] === def);
        if (other) keys[other] = prev || null;
        keys[d.v] = def; save(); sfx('ui'); this.render(); break;
      }
      case 'openkeys': sfx('ui'); this.keybindsReturn = d.from || 'main'; this.show('keybinds'); break;
      case 'resetkeys': Input.cancelCapture(); this.listening = null; profile.settings.keys = { ...DEFAULT_KEYS }; save(); sfx('ui'); this.toast('All keybinds reset to defaults'); this.render(); break;
      case 'savenow': save(); sfx('uiconfirm'); this.toast('Progress saved'); break;
      case 'reset':
        this.confirm('RESET ALL PROGRESS?', 'This permanently deletes your save data. This cannot be undone.', () => {
          resetProfile(); applyVolumes(); this.garageFrame = 'striker'; this.toast('Save data reset'); this.show('main');
        });
        break;
      case 'resume': sfx('ui'); this.app.resume(); break;
      case 'psettings': sfx('ui'); this.returnTo = 'pause'; this.show('settings'); break;
      case 'restart': sfx('ui'); this.app.restart(); break;
      case 'abandon':
        this.confirm('ABANDON MATCH?', 'You will forfeit all rewards from this match.', () => { this.app.endGame(); this.show('main'); });
        break;
      case 'again': sfx('uiconfirm'); this.launch(this.results.cfg); break;
      case 'modal-ok': { const cb = this._modalCb; this.closeModal(); if (cb) cb(); break; }
      case 'modal-cancel': this.closeModal(); break;
    }
  }

  launch(cfg) {
    // validate loadout capacity
    const l = profile.loadouts[profile.currentFrame];
    if (loadoutWeight(l) > FRAMES[profile.currentFrame].capacity) {
      sfx('uideny');
      this.confirm('LOADOUT OVER CAPACITY', `Your ${FRAMES[profile.currentFrame].name} exceeds its equipment capacity. Open the garage to fix it?`, () => { this.garageFrame = profile.currentFrame; this.show('garage'); });
      return;
    }
    if (cfg.mode === 'boss' || cfg.mode === 'challenge') cfg.condition = 'clear';
    else if (cfg.condition === 'random' || !cfg.condition) {
      const keys = Object.keys(CONDITIONS);
      cfg.condition = Math.random() < 0.4 ? 'clear' : keys[Math.floor(Math.random() * keys.length)];
    }
    if (cfg.mode !== 'challenge' && !cfg.daily) profile.lastMode = { mode: cfg.mode, arena: cfg.arena, boss: cfg.boss, size: cfg.size };
    save();
    this.hide();
    this.app.startGame(cfg);
  }

  showResults(r) { this.results = r; this.show('results'); }

  confirm(title, text, cb) {
    this._modalCb = cb;
    const m = document.getElementById('modal-root');
    m.innerHTML = `<div class="modal"><h3>${title}</h3><p>${text}</p><div><button class="btn danger" data-act="modal-ok">CONFIRM</button><button class="btn" data-act="modal-cancel">CANCEL</button></div></div>`;
    m.classList.remove('hidden');
  }
  closeModal() { const m = document.getElementById('modal-root'); m.classList.add('hidden'); m.innerHTML = ''; this._modalCb = null; }
  toast(text) {
    const t = document.createElement('div'); t.className = 'menutoast'; t.textContent = text;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2200);
  }
}

function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
