// Main menu, deploy/respawn screen, pause menu and after-action report.
(function (G) {
  'use strict';
  const IF = G.IF, U = IF.U;
  const MN = (IF.Menu = {});
  const $ = (id) => document.getElementById(id);
  const set = () => IF.Profile.settings;
  const rank = () => IF.rankIndex(IF.Profile.xp);

  const TIPS = [
    'You are one soldier among two thousand. Stick with your squad and use cover.',
    'Press B to open the squad command menu — nearby squads will follow your orders.',
    'Press M for the tactical map: see the frontline, squad movements and detected enemies.',
    'Downed allies can be revived by holding F. Medics do it much faster.',
    'Press T to spot enemies for your whole army. Recon soldiers can call artillery with binoculars.',
    'Empty and abandoned vehicles can be driven with F. Your squad can ride along (B → 5).',
    'Holding more objectives drains the enemy\'s reinforcements.',
    'At night, press N for night vision.',
    'Machine guns and snipers are steadier when prone (Z).',
    'Enemy headquarters can only be attacked once your army holds five objectives.',
  ];

  MN.init = function () {
    MN.tab = 'battle';
    document.querySelectorAll('#menuTabs button').forEach((b) => b.addEventListener('click', () => { IF.Input.capture = null; MN.tab = b.dataset.tab; IF.SFX.ui('open'); MN.render(); }));
    $('btnResume').onclick = () => IF.Main.resume();
    $('btnQuit').onclick = () => IF.Main.quit();
    $('btnPauseControls').onclick = () => { IF.Main.quit(true); MN.tab = 'controls'; MN.render(); };
    $('btnPauseSettings').onclick = () => { IF.Main.quit(true); MN.tab = 'graphics'; MN.render(); };
    $('deployBtn').onclick = () => MN.doDeploy();
    $('deployMap').addEventListener('click', (e) => {
      const r = $('deployMap').getBoundingClientRect(), d = Math.min(2, G.devicePixelRatio || 1);
      const x = (e.clientX - r.left) * d, y = (e.clientY - r.top) * d;
      for (const h of IF.TacMap.spawnHits || []) if ((h.x - x) ** 2 + (h.z - y) ** 2 < h.r * h.r) { MN.deploySel = h.k; MN.renderDeployList(); }
    });
    MN.render();
  };

  MN.show = function (on) { $('menu').classList.toggle('hidden', !on); if (on) MN.render(); };

  function seg(name, options, cur, onPick) {
    return `<div class="seg" data-seg="${name}">${options.map((o) => `<button data-v="${o[0]}" class="${o[0] === cur ? 'sel' : ''}" ${o[2] ? 'disabled' : ''}>${o[1]}</button>`).join('')}</div>`;
  }
  function bindSeg(name, fn) {
    document.querySelectorAll(`[data-seg="${name}"] button`).forEach((b) => b.addEventListener('click', () => { if (b.disabled) return; fn(b.dataset.v); IF.saveProfile(); IF.SFX.ui('open'); MN.render(); }));
  }

  MN.render = function () {
    document.querySelectorAll('#menuTabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === MN.tab));
    const s = set(), body = $('menuBody');
    const r = rank(), R = IF.RANKS[r];
    $('menuFooter').innerHTML = `${R[1].toUpperCase()} · ${IF.Profile.xp} XP · ${IF.Profile.stats.battles} battles · ${IF.Profile.medals.length} medals &nbsp;&nbsp;|&nbsp;&nbsp; Built with Three.js — runs entirely in your browser`;
    if (MN.tab === 'battle') {
      const cls = IF.CLASSES.find((c) => c.id === s.cls) || IF.CLASSES[0];
      body.innerHTML = `<div class="grid2"><div>
        <div class="brief"><p><b>SITUATION:</b> Two armies of <b>1,000 soldiers</b> each — infantry squads, armour, artillery, helicopters and jets — collide across a contested front. Every soldier except you is commanded by AI. The battle runs whether you fight or not.</p>
        <p><b>MISSION:</b> Serve with your squad, take and hold objectives, and help your army exhaust the enemy's reinforcements or seize their headquarters.</p></div>
        <div class="row"><label>BATTLEFIELD</label>${seg('layout', [['random', 'Random']].concat(IF.LAYOUTS.map((l) => [l.id, l.name])), s.layout)}</div>
        <div class="row"><label>TIME OF DAY</label>${seg('time', [['random', 'Random'], ['dawn', 'Dawn'], ['day', 'Day'], ['dusk', 'Dusk'], ['night', 'Night']], s.time)}</div>
        <div class="row"><label>WEATHER</label>${seg('weather', [['random', 'Dynamic'], ['clear', 'Clear'], ['overcast', 'Overcast'], ['rain', 'Rain'], ['fog', 'Fog'], ['storm', 'Storm']], s.weather)}</div>
        <div class="row"><label>REINFORCEMENTS</label>${seg('size', [['skirmish', 'Skirmish · 500'], ['standard', 'Standard · 1000'], ['long', 'Long · 2000'], ['epic', 'Epic · 4000']], s.size)}</div>
        <p class="small">${(IF.LAYOUTS.find((l) => l.id === s.layout) || { desc: 'A randomly generated battlefield — different terrain, objectives and layout every time.' }).desc}</p>
      </div><div>
        <div class="card sel"><h4>YOUR DEPLOYMENT</h4><div class="kv">
          <span>Army</span><span style="color:${IF.TEAMS[s.army].hud}">${IF.TEAMS[s.army].name}</span>
          <span>Class</span><span>${cls.name}</span><span>Difficulty</span><span>${IF.DIFFICULTY[s.difficulty].name}</span>
          <span>Graphics</span><span>${s.graphics.toUpperCase()}</span><span>Rank</span><span>${R[1]}</span></div></div>
        <button class="btn primary big-start" id="startBtn">START BATTLE</button>
        <p class="small">Click the battlefield to capture the mouse. Esc pauses. H shows controls in battle.</p>
      </div></div>`;
      bindSeg('layout', (v) => (s.layout = v)); bindSeg('time', (v) => (s.time = v)); bindSeg('weather', (v) => (s.weather = v)); bindSeg('size', (v) => (s.size = v));
      $('startBtn').onclick = () => { IF.Audio.init(); IF.Audio.resume(); IF.Main.start(); };
    } else if (MN.tab === 'army') {
      const desc = ['Western-style coalition forces. Tan uniforms, red-orange tracers. Main battle tanks, IFVs, attack helicopters and precision air support.', 'Eastern bloc alliance. Dark green uniforms, green tracers. Heavy armour, massed artillery and rotary-wing assault.'];
      body.innerHTML = `<div class="grid2">${IF.TEAMS.map((t, k) => `<div class="card ${s.army === k ? 'sel' : ''}" data-army="${k}"><h4 style="color:${t.hud}">${t.name}</h4><p>${desc[k]}</p><p class="small" style="margin-top:8px">Squad callsigns: ${t.callsignBase.slice(0, 4).join(', ')}…</p></div>`).join('')}</div>`;
      document.querySelectorAll('[data-army]').forEach((el) => el.addEventListener('click', () => { s.army = +el.dataset.army; IF.saveProfile(); MN.render(); }));
    } else if (MN.tab === 'class') {
      const cls = IF.CLASSES.find((c) => c.id === s.cls) || IF.CLASSES[0];
      const L = IF.loadoutFor(cls.id);
      const lock = (rk) => rk > r;
      body.innerHTML = `<div class="grid3">${IF.CLASSES.map((c) => `<div class="card ${c.id === cls.id ? 'sel' : ''} ${lock(c.rank) ? 'locked' : ''}" data-cls="${c.id}"><h4>${c.name}</h4><p>${c.desc}</p>${lock(c.rank) ? `<p class="small">Unlocks at ${IF.RANKS[c.rank][1]}</p>` : ''}</div>`).join('')}</div>
      <h3 style="margin-top:22px;color:var(--accent2);letter-spacing:3px">LOADOUT — ${cls.name.toUpperCase()}</h3>
      <div class="row"><label>PRIMARY</label>${seg('prim', cls.primary.map((id) => [id, IF.WEAPONS[id].name + (lock(IF.WEAPONS[id].rank) ? ' 🔒' + IF.RANKS[IF.WEAPONS[id].rank][0] : ''), lock(IF.WEAPONS[id].rank)]), L.primary)}</div>
      <div class="row"><label>OPTIC</label>${seg('optic', ['none', 'reddot', 'acog'].map((id) => [id, IF.ATTACHMENTS[id].name + (lock(IF.ATTACHMENTS[id].rank) ? ' 🔒' + IF.RANKS[IF.ATTACHMENTS[id].rank][0] : ''), lock(IF.ATTACHMENTS[id].rank)]), L.optic)}</div>
      <div class="row"><label>BARREL / MAG</label>${seg('barrel', ['none', 'grip', 'suppress', 'extmag'].map((id) => [id, (id === 'none' ? 'None' : IF.ATTACHMENTS[id].name) + (lock(IF.ATTACHMENTS[id].rank) ? ' 🔒' + IF.RANKS[IF.ATTACHMENTS[id].rank][0] : ''), lock(IF.ATTACHMENTS[id].rank)]), L.barrel)}</div>
      <div class="row"><label>UNIFORM</label>${seg('uni', IF.UNIFORMS.map((u) => [u.id, u.name + (lock(u.rank) ? ' 🔒' + IF.RANKS[u.rank][0] : ''), lock(u.rank)]), L.uniform)}</div>
      <p class="small">${IF.WEAPONS[L.primary].name}: damage ${IF.WEAPONS[L.primary].dmg}${IF.WEAPONS[L.primary].pellets ? '×' + IF.WEAPONS[L.primary].pellets : ''}, ${IF.WEAPONS[L.primary].rpm} rpm, magazine ${IF.WEAPONS[L.primary].mag}, effective range ${IF.WEAPONS[L.primary].range} m. Sniper rifles and launchers use their own optics.</p>`;
      document.querySelectorAll('[data-cls]').forEach((el) => el.addEventListener('click', () => { const c = IF.CLASSES.find((k) => k.id === el.dataset.cls); if (c.rank > r) return; s.cls = c.id; IF.saveProfile(); MN.render(); }));
      const lo = (k, v) => { IF.Profile.loadout[cls.id] = Object.assign(IF.loadoutFor(cls.id), { [k]: v }); };
      bindSeg('prim', (v) => lo('primary', v)); bindSeg('optic', (v) => lo('optic', v)); bindSeg('barrel', (v) => lo('barrel', v)); bindSeg('uni', (v) => lo('uniform', v));
    } else if (MN.tab === 'difficulty') {
      const d = { recruit: 'Forgiving: you take much less damage, enemies are less accurate and health regenerates fully.', regular: 'The intended experience. Dangerous but fair.', veteran: 'Enemy AI is sharper, your health only regenerates to 50%.', elite: 'Brutal. Elite enemy soldiers, heavy damage, minimal regeneration.' };
      body.innerHTML = `<div class="grid2">${Object.entries(IF.DIFFICULTY).map(([k, v]) => `<div class="card ${s.difficulty === k ? 'sel' : ''}" data-diff="${k}"><h4>${v.name.toUpperCase()}</h4><p>${d[k]}</p></div>`).join('')}</div>`;
      document.querySelectorAll('[data-diff]').forEach((el) => el.addEventListener('click', () => { s.difficulty = el.dataset.diff; IF.saveProfile(); MN.render(); }));
    } else if (MN.tab === 'graphics') {
      body.innerHTML = `<div class="grid2"><div>
        <div class="row"><label>QUALITY</label>${seg('gfx', [['low', 'Low (school laptop)'], ['medium', 'Medium'], ['high', 'High']], s.graphics)}</div>
        <p class="small">Low disables shadows and lowers render resolution and draw distance — best for integrated graphics. All 2,000 soldiers are simulated on every setting; only rendering detail changes. Quality changes apply to the next battle.</p>
        <div class="row"><label>FIELD OF VIEW</label><input type="range" min="60" max="95" value="${s.fov}" id="fovR"><span id="fovV">${s.fov}°</span></div>
        <div class="row"><label>SENSITIVITY</label><input type="range" min="0.2" max="2.5" step="0.05" value="${s.sens}" id="sensR"><span id="sensV">${s.sens.toFixed(2)}</span></div>
        <div class="row"><label>VOLUME</label><input type="range" min="0" max="1" step="0.05" value="${s.volume}" id="volR"><span id="volV">${Math.round(s.volume * 100)}%</span></div>
        <div class="row"><label>GORE</label>${seg('gore', [['off', 'Off'], ['normal', 'Normal'], ['extreme', 'Extreme']], s.gore || 'extreme')}</div>
        <div class="row"><label>VOICE CHATTER</label>${seg('voice', [['1', 'On'], ['0', 'Off']], s.voice ? '1' : '0')}</div>
        <div class="row"><label>INVERT MOUSE Y</label>${seg('inv', [['0', 'Off'], ['1', 'On']], s.invertY ? '1' : '0')}</div>
      </div><div class="card"><h4>PERFORMANCE NOTES</h4><p>The simulation runs every soldier's AI with staggered updates and spatial grids. Nearby soldiers use detailed animated models, distant soldiers use one instanced low-poly mesh, and effects are pooled. Press F3 in battle to show frame time and render counts.</p></div></div>`;
      bindSeg('gfx', (v) => (s.graphics = v)); bindSeg('gore', (v) => (s.gore = v)); bindSeg('voice', (v) => (s.voice = v === '1')); bindSeg('inv', (v) => (s.invertY = v === '1'));
      const rng = (id, key, fmt, cb) => { $(id).addEventListener('input', (e) => { s[key] = +e.target.value; $(id.replace('R', 'V')).textContent = fmt(s[key]); if (cb) cb(s[key]); IF.saveProfile(); }); };
      rng('fovR', 'fov', (v) => v + '°'); rng('sensR', 'sens', (v) => v.toFixed(2)); rng('volR', 'volume', (v) => Math.round(v * 100) + '%', (v) => IF.Audio.setVolume(v));
    } else if (MN.tab === 'controls') {
      const I = IF.Input, L = I.label;
      const groups = {};
      for (const ac of IF.KEY_ACTIONS) (groups[ac[3]] = groups[ac[3]] || []).push(ac);
      const defaults = {}; for (const ac of IF.KEY_ACTIONS) defaults[ac[0]] = ac[2];
      body.innerHTML = `<div class="grid2"><div>
        <p class="small">Click a key to change it, then press the new key. Esc cancels. If the key is already used, the two actions swap keys. Mouse: left click fires, right click aims, wheel switches weapons. Esc always pauses.</p>
        ${Object.entries(groups).map(([g, list]) => `<h4 class="bind-group">${g.toUpperCase()}</h4><div class="binds">${list.map((ac) => `<span>${ac[1]}</span><button class="bind ${I.code(ac[0]) !== defaults[ac[0]] ? 'changed' : ''}" data-bind="${ac[0]}" id="bind-${ac[0]}">${L(ac[0])}</button>`).join('')}</div>`).join('')}
        <button class="btn" id="resetBinds" style="width:auto;margin-top:14px">RESET TO DEFAULT KEYS</button>
      </div>
        <div class="card"><h4>SQUAD COMMANDS (${L('commands')})</h4><p>Then 1 Follow me · 2 Hold position · 3 Advance · 4 Defend objective · 5 Regroup · 6 Enter vehicles · 7 Retreat.<br><br>Orders go to your own squad and any friendly squad near you — the radius grows with rank. Order your squad into a vehicle you are driving and they ride with you; exit to drop them off.</p>
        <h4 style="margin-top:14px">VEHICLES</h4><p>Ground: ${L('forward')}/${L('back')} throttle, ${L('left')}/${L('right')} steer, ${L('jump')} brake, mouse aims the turret, left click fires, ${L('weapon1')}/${L('weapon2')} switch main gun / coaxial MG.<br>Helicopters: ${L('forward')}/${L('back')} pitch, ${L('left')}/${L('right')} yaw, ${L('leanL')}/${L('leanR')} strafe, ${L('jump')}/${L('descend')} altitude, left click guns, ${L('weapon2')} rockets.</p></div></div>`;
      document.querySelectorAll('[data-bind]').forEach((btn) => btn.addEventListener('click', () => {
        if (I.capture) return;
        const id = btn.dataset.bind;
        btn.textContent = 'Press a key…'; btn.classList.add('listening');
        I.capture = (code) => {
          if (code !== 'Escape') { I.rebind(id, code); IF.SFX.ui('open'); }
          MN.render();
        };
      }));
      $('resetBinds').onclick = () => { I.capture = null; I.resetBinds(); MN.render(); };
    } else if (MN.tab === 'stats') {
      const P = IF.Profile, st = P.stats;
      const nx = IF.RANKS[Math.min(IF.RANKS.length - 1, r + 1)];
      const pct = r >= IF.RANKS.length - 1 ? 100 : ((P.xp - R[2]) / (nx[2] - R[2])) * 100;
      body.innerHTML = `<div class="grid2"><div>
        <div class="card"><h4>${R[1].toUpperCase()} (${R[0]})</h4><div class="rankbar"><i style="width:${pct}%"></i></div><p>${P.xp} XP${r < IF.RANKS.length - 1 ? ' · next: ' + nx[1] + ' at ' + nx[2] : ' · highest rank'}</p></div>
        <div class="kv" style="margin-top:14px">
          <span>Battles fought</span><span>${st.battles}</span><span>Victories / defeats</span><span>${st.wins} / ${st.losses}</span>
          <span>Kills / deaths</span><span>${st.kills} / ${st.deaths} (K/D ${(st.kills / Math.max(1, st.deaths)).toFixed(2)})</span><span>Headshots</span><span>${st.headshots}</span>
          <span>Accuracy</span><span>${st.shots ? Math.round(st.hits / st.shots * 100) : 0}%</span><span>Revives</span><span>${st.revives}</span>
          <span>Objectives captured</span><span>${st.captures}</span><span>Vehicles destroyed</span><span>${st.vehiclesDestroyed} (${st.helisDown} helicopters)</span>
          <span>Kills from vehicles</span><span>${st.vehicleKills}</span><span>Squad commands</span><span>${st.commands}</span>
          <span>Longest kill</span><span>${Math.round(st.longest)} m</span><span>Distance driven</span><span>${(st.distanceDriven / 1000).toFixed(1)} km</span>
          <span>Time in battle</span><span>${U.fmtTime(st.timePlayed)}</span><span>Best battle</span><span>${st.bestBattleXp} XP</span></div>
        <button class="btn danger" id="resetBtn" style="margin-top:18px;width:auto">RESET PROFILE</button>
      </div><div>
        <h3 style="color:var(--accent2);letter-spacing:3px;margin-top:0">MEDALS</h3>
        ${IF.MEDALS.map((m) => `<div class="card ${P.medals.includes(m.id) ? 'sel' : 'locked'}" style="margin-bottom:6px;cursor:default"><h4>${P.medals.includes(m.id) ? '★ ' : ''}${m.name}</h4><p>${m.desc}</p></div>`).join('')}
        <h3 style="color:var(--accent2);letter-spacing:3px">MISSION ACHIEVEMENTS</h3>
        <p class="small">${IF.ACHIEVEMENTS.map((a) => `${P.achievements.includes(a.id) ? '✔' : '·'} ${a.name} — ${a.desc}`).join('<br>')}</p>
      </div></div>`;
      $('resetBtn').onclick = () => {
        if (MN.resetArmed) { MN.resetArmed = false; IF.resetProfile(); MN.render(); return; }
        MN.resetArmed = true; $('resetBtn').textContent = 'CLICK AGAIN TO ERASE ALL PROGRESS';
        setTimeout(() => { MN.resetArmed = false; const b = $('resetBtn'); if (b) b.textContent = 'RESET PROFILE'; }, 4000);
      };
    }
  };

  // ------------------------------------------------------------------ loading
  MN.loading = function (on, txt, pct) {
    $('loading').classList.toggle('hidden', !on);
    if (txt) $('loadTxt').textContent = txt;
    if (pct !== undefined) $('loadBar').style.width = pct + '%';
    if (on && !MN.tipSet) { $('loadTip').textContent = 'TIP: ' + U.pick(TIPS); MN.tipSet = true; }
    if (!on) MN.tipSet = false;
  };

  // ------------------------------------------------------------------ deploy
  MN.showDeploy = function (first) {
    const B = IF.B, P = IF.Player;
    MN.deployOn = true;
    $('deploy').classList.remove('hidden');
    $('deployTitle').textContent = first ? 'DEPLOY' : 'REDEPLOY';
    $('deploySub').textContent = first ? 'The battle has begun. Choose where to enter — headquarters, a friendly objective, or take over a soldier in a squad.' : 'You were killed. The battle goes on. Choose your next deployment.';
    MN.deployOpts = P.spawnOptions();
    MN.deploySel = MN.deployOpts.findIndex((o) => !o.blocked && o.kind === (first ? 'obj' : 'soldier'));
    if (MN.deploySel < 0) MN.deploySel = MN.deployOpts.findIndex((o) => !o.blocked);
    MN.deployReadyT = first ? 0 : 5;
    const r = rank();
    $('deployClasses').innerHTML = IF.CLASSES.map((c) => `<button data-dc="${c.id}" class="${c.id === set().cls ? 'sel' : ''}" ${c.rank > r ? 'disabled' : ''}>${c.name}</button>`).join('');
    document.querySelectorAll('[data-dc]').forEach((b) => b.addEventListener('click', () => { set().cls = b.dataset.dc; IF.saveProfile(); P.cls = IF.CLASSES.find((c) => c.id === set().cls); P.loadout = IF.loadoutFor(P.cls.id); document.querySelectorAll('[data-dc]').forEach((q) => q.classList.toggle('sel', q === b)); }));
    MN.renderDeployList();
  };
  MN.renderDeployList = function () {
    $('deployList').innerHTML = MN.deployOpts.map((o, k) => `<div class="opt ${k === MN.deploySel ? 'sel' : ''} ${o.blocked ? 'blocked' : ''}" data-k="${k}">${o.label}<small>${o.blocked ? o.blocked : o.kind === 'obj' ? (o.obj.hq >= 0 ? 'Headquarters · transports available' : IF.OBJ_TYPE_LABEL[o.obj.type]) : 'Continue the fight as this soldier'}</small></div>`).join('') || '<p class="muted">No deployment options — waiting for reinforcements…</p>';
    document.querySelectorAll('#deployList .opt').forEach((el) => el.addEventListener('click', () => { const k = +el.dataset.k; if (MN.deployOpts[k].blocked) return; MN.deploySel = k; MN.renderDeployList(); }));
  };
  MN.updateDeploy = function (dt) {
    if (!MN.deployOn) return;
    const B = IF.B;
    MN.deployReadyT = Math.max(0, MN.deployReadyT - dt);
    MN.refreshT = (MN.refreshT || 0) - dt;
    if (MN.refreshT <= 0) {
      MN.refreshT = 1.5;
      const prev = MN.deployOpts[MN.deploySel];
      MN.deployOpts = IF.Player.spawnOptions();
      MN.deploySel = Math.max(0, MN.deployOpts.findIndex((o) => prev && o.label === prev.label));
      MN.renderDeployList();
    }
    IF.TacMap.draw($('deployMap'), B, { spawns: MN.deployOpts, sel: MN.deploySel });
    $('deployTimer').textContent = MN.deployReadyT > 0 ? 'Reinforcement wave in ' + Math.ceil(MN.deployReadyT) + 's' : 'Ready to deploy · Reinforcements: ' + B.tickets[B.playerTeam];
    $('deployBtn').disabled = MN.deployReadyT > 0;
    $('deployBtn').style.opacity = MN.deployReadyT > 0 ? 0.5 : 1;
  };
  MN.doDeploy = function () {
    if (MN.deployReadyT > 0) return;
    const o = MN.deployOpts[MN.deploySel];
    if (!o || o.blocked) return;
    IF.Audio.init(); IF.Audio.resume();
    if (IF.Player.deploy(o)) { MN.hideDeploy(); IF.Input.lock(); }
  };
  MN.hideDeploy = function () { MN.deployOn = false; $('deploy').classList.add('hidden'); };

  // ------------------------------------------------------------------ end of battle
  MN.showEnd = function (B, P, result) {
    const el = $('endPanel');
    const win = B.winner === B.playerTeam;
    const why = B.endReason === 'hq' ? (win ? 'The enemy headquarters has fallen.' : 'Our headquarters has been overrun.') : (win ? 'The enemy has run out of reinforcements.' : 'Our army has run out of reinforcements.');
    const ps = P.bs;
    el.innerHTML = `<p class="end-title ${win ? 'win' : 'loss'}">${win ? 'VICTORY' : 'DEFEAT'}</p><p class="muted">${why} Battle duration ${U.fmtTime(B.time)}.</p>
      <div class="end-grid">
        <div><span>Your kills</span><b>${ps.kills}</b></div><div><span>Deaths</span><b>${ps.deaths}</b></div>
        <div><span>Headshots</span><b>${ps.headshots}</b></div><div><span>Revives</span><b>${ps.revives}</b></div>
        <div><span>Objectives captured</span><b>${ps.captures}</b></div><div><span>Vehicles destroyed</span><b>${ps.vehiclesDestroyed}</b></div>
        <div><span>Squad commands</span><b>${ps.commands}</b></div><div><span>Best life</span><b>${ps.bestLife} kills</b></div>
        <div><span>Army casualties</span><b>${B.deaths[B.playerTeam]}</b></div><div><span>Enemy casualties</span><b>${B.deaths[1 - B.playerTeam]}</b></div>
        <div><span>Vehicles lost</span><b>${B.vehLost[B.playerTeam]}</b></div><div><span>Enemy vehicles lost</span><b>${B.vehLost[1 - B.playerTeam]}</b></div>
      </div>
      <p><b style="color:var(--accent2)">+${result.xp} XP</b>${result.bonus ? ' (includes ' + result.bonus + ' victory bonus)' : ''} · ${IF.RANKS[result.rankAfter][1]}${result.rankAfter > result.rankBefore ? ' — <b style="color:var(--ok)">PROMOTED!</b>' : ''}</p>
      ${result.medals.length ? '<p>New medals: ' + result.medals.map((m) => `<span class="medal">★ ${m.name}</span>`).join('') + '</p>' : ''}
      ${result.ach.length ? '<p>Achievements: ' + result.ach.map((a) => `<span class="medal">${a.name}</span>`).join('') + '</p>' : ''}
      <button class="btn primary" id="endAgain">NEW BATTLE</button><button class="btn" id="endMenu">MAIN MENU</button>`;
    $('endscreen').classList.remove('hidden');
    $('endAgain').onclick = () => { $('endscreen').classList.add('hidden'); IF.Main.quit(true); IF.Main.start(); };
    $('endMenu').onclick = () => { $('endscreen').classList.add('hidden'); IF.Main.quit(true); };
  };
})(typeof window !== 'undefined' ? window : globalThis);
