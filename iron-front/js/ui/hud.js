// In-battle HUD: overlay markers, crosshair, minimap, compass, objectives, squad, kill feed,
// radio log, weapon/vehicle panels, command menu, scoreboard.
(function (G) {
  'use strict';
  const IF = G.IF, U = IF.U, ST = IF.ST;
  const H = (IF.HUD = {});
  const $ = (id) => document.getElementById(id);

  H.init = function () {
    H.ov = $('overlay'); H.ctx = H.ov.getContext('2d');
    H.mm = $('minimap'); H.mctx = H.mm.getContext('2d');
    H.cp = $('compass'); H.cctx = H.cp.getContext('2d');
    H.radio = []; H.feed = [];
    H.resize();
    G.addEventListener('resize', H.resize);
    IF.on('radio', (from, text, key) => {
      if (!IF.B) return;
      H.radio.push({ from, text, key, t: 12 });
      if (H.radio.length > 6) H.radio.shift();
      H.radioDirty = true;
      IF.SFX.radio(text, from === 'COMMAND');
    });
    IF.on('kill', (t, att, kind, head) => H.onKill(t, att, kind, head));
    IF.on('phase', (p, name) => H.banner(name, 5));
    IF.on('objCaptured', (o, team) => { const B = IF.B; if (!B) return; H.banner((team === B.playerTeam ? 'CAPTURED: ' : 'LOST: ') + (o.letter !== 'HQ' ? o.letter + ' — ' : '') + o.name.toUpperCase(), 4); });
    IF.on('event', (kind, team, x) => { const B = IF.B; if (!B) return; if (kind === 'pinned') H.banner('SQUAD PINNED DOWN — ASSIST THEM', 4); if (kind === 'abandoned') H.banner('ABANDONED VEHICLE SPOTTED', 3); });
    IF.on('lastStand', (t) => { const B = IF.B; H.banner(t === B.playerTeam ? 'OUT OF REINFORCEMENTS — LAST STAND' : 'ENEMY RESERVES EXHAUSTED', 6); });
  };
  H.resize = function () {
    const dpr = Math.min(2, G.devicePixelRatio || 1);
    H.ov.width = G.innerWidth * dpr; H.ov.height = G.innerHeight * dpr; H.dpr = dpr;
  };
  H.banner = function (text, t) {
    const el = $('eventbanner');
    el.textContent = text; el.classList.add('show');
    clearTimeout(H.bannerT); H.bannerT = setTimeout(() => el.classList.remove('show'), (t || 4) * 1000);
  };

  H.soldierName = function (B, i) {
    if (i < 0 || i >= B.S.n) return 'Unknown';
    if (i === B.playerIdx) return 'YOU';
    const sq = B.squads[B.S.squad[i]];
    return (sq ? sq.callsign + ' ' : '') + IF.ROLE_NAMES[B.S.role[i]];
  };
  H.onKill = function (t, att, kind, head) {
    const B = IF.B; if (!B) return;
    const S = B.S;
    const P = IF.Player;
    const px = B.camX, pz = B.camZ;
    const near = U.dist2(S.x[t], S.z[t], px, pz) < 140 * 140;
    const mine = att === B.playerIdx || t === B.playerIdx;
    if (!mine && !near) return;
    if (!mine && Math.random() < 0.4 && H.feed.length > 3) return;
    const ta = att >= 0 && att < S.n ? S.team[att] : -1;
    const how = kind === 'explosion' ? '✹' : kind === 'crush' ? '⛟' : kind === 'bleed' ? '✚' : head ? '⌖' : '›';
    H.feed.push({ a: att >= 0 && att < S.n ? H.soldierName(B, att) : (kind === 'explosion' ? 'Artillery' : '—'), at: ta, v: H.soldierName(B, t), vt: S.team[t], how, mine, t: 6 });
    if (H.feed.length > 6) H.feed.shift();
    H.feedDirty = true;
  };

  // static map image (shared by minimap, tactical map & deploy screen)
  H.buildMapImage = function (W) {
    const N = 512, c = document.createElement('canvas'); c.width = c.height = N;
    const x = c.getContext('2d');
    const img = x.createImageData(N, N);
    const GC = { 0: [70, 82, 46], 1: [96, 82, 60], 2: [104, 104, 100], 3: [62, 52, 38], 4: [130, 118, 90], 5: [96, 94, 90], 6: [112, 100, 56], 7: [74, 62, 44], 8: [88, 88, 52] };
    for (let py = 0; py < N; py++) for (let px = 0; px < N; px++) {
      const wx = px / N * 2000 - 1000, wz = py / N * 2000 - 1000;
      const gt = W.groundTypeAt(wx, wz);
      let c0 = GC[gt] || GC[0];
      const h = W.terrainAt(wx, wz);
      const sh = 1 + (W.terrainAt(wx - 4, wz - 4) - h) * 0.06;
      let r = c0[0] * sh, g = c0[1] * sh, b = c0[2] * sh;
      if (W.hasRiver && h < W.waterY) { r = 40; g = 70; b = 90; }
      const f = W.folAt(wx, wz); if (f > 0) { r *= 0.7; g *= 0.85; b *= 0.65; }
      const k = (py * N + px) * 4;
      img.data[k] = r; img.data[k + 1] = g; img.data[k + 2] = b; img.data[k + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    const s = N / 2000, tx = (v) => (v + 1000) * s;
    // roads
    for (const rd of W.roads) {
      x.strokeStyle = rd.kind === 'highway' ? '#3b3b3b' : rd.kind === 'runway' ? '#6a6a6a' : '#7a6748'; x.lineWidth = Math.max(1, rd.w * s);
      x.beginPath(); rd.pts.forEach((p, i) => (i ? x.lineTo(tx(p[0]), tx(p[1])) : x.moveTo(tx(p[0]), tx(p[1])))); x.stroke();
    }
    for (const br of W.bridges) { x.save(); x.translate(tx(br.x), tx(br.z)); x.rotate(-br.rot); x.fillStyle = '#9a9a96'; x.fillRect(-br.w * s / 2 - 1, -br.len * s / 2, br.w * s + 2, br.len * s); x.restore(); }
    // buildings
    x.fillStyle = 'rgba(30,30,28,0.85)';
    for (const b of W.buildings) { x.save(); x.translate(tx(b.x), tx(b.z)); x.rotate(-b.rot); x.fillRect(-b.w * s / 2, -b.d * s / 2, Math.max(1, b.w * s), Math.max(1, b.d * s)); x.restore(); }
    for (const m of W.minefields) { x.strokeStyle = 'rgba(255,60,40,0.7)'; x.setLineDash([2, 2]); x.beginPath(); x.arc(tx(m.x), tx(m.z), m.r * s, 0, 7); x.stroke(); x.setLineDash([]); }
    H.mapImg = c;
    return c;
  };

  const teamCol = (B, t) => (t < 0 ? '#e8e8e0' : t === B.playerTeam ? '#5fb3ff' : '#ff5a4a');
  H.teamCol = teamCol;

  // ------------------------------------------------------------------ per-frame
  H.update = function (B, dt) {
    const P = IF.Player, S = B.S;
    H.t = (H.t || 0) + dt;
    H.slow = (H.slow || 0) - dt;
    H.drawOverlay(B, dt);
    H.drawCompass(B);
    if (H.slow > 0) return;
    H.slow = 0.1;
    // tickets & objectives
    const f = B.playerTeam, e = 1 - f;
    $('tkFriendName').textContent = IF.TEAMS[f].short; $('tkEnemyName').textContent = IF.TEAMS[e].short;
    $('tkFriend').textContent = B.tickets[f]; $('tkEnemy').textContent = B.tickets[e];
    $('tkFriendBar').style.width = (100 * B.tickets[f] / B.startTickets) + '%';
    $('tkEnemyBar').style.width = (100 * B.tickets[e] / B.startTickets) + '%';
    let html = '';
    for (const o of B.W.objectives) {
      const cls = o.owner < 0 ? 'n' : o.owner === f ? 'f' : 'e';
      const prog = f === 0 ? -o.progress : o.progress; // +1 = ours
      const fillC = prog > 0 ? '#5fb3ff' : '#ff5a4a';
      html += `<div class="obj ${cls} ${o.contested ? 'c' : ''}"><div class="fill" style="height:${Math.abs(prog) * 100}%;background:${fillC}"></div><span>${o.letter === 'HQ' ? (o.hq === f ? '★' : '☠') : o.letter}</span></div>`;
    }
    $('objRow').innerHTML = html;
    $('phase').textContent = IF.PHASES[B.phase] + '  ·  ' + U.fmtTime(B.time) + '  ·  ' + String(Math.floor(B.env.hour)).padStart(2, '0') + ':' + String(Math.floor((B.env.hour % 1) * 60)).padStart(2, '0') + ' ' + B.env.weather.toUpperCase();
    // forces
    let alive = [0, 0], veh = [0, 0];
    for (const sq of B.squads) alive[sq.team] += sq.alive;
    for (const v of B.activeVeh) if (v.state === 'active' && v.team >= 0) veh[v.team]++;
    $('forces').innerHTML = `FRIENDLY <b>${alive[f]}</b> on field · <b>${B.tickets[f]}</b> reserves · <b>${veh[f]}</b> vehicles<br>ENEMY <b>${alive[e]}</b> on field · <b>${B.tickets[e]}</b> reserves · <b>${veh[e]}</b> vehicles`;
    // health / stance
    const hp = Math.max(0, Math.round(P.hp));
    $('hpbar').style.width = hp + '%'; $('hptext').textContent = hp;
    $('hpwrap').classList.toggle('low', hp < 35);
    $('stance').textContent = P.veh ? (P.seat === 'driver' ? 'DRIVING' : 'PASSENGER') : (['STANDING', 'CROUCHED', 'PRONE'][P.stance] + (P.sprint ? ' · SPRINT' : '') + (P.lean ? (P.lean < -0.3 ? ' · LEAN L' : P.lean > 0.3 ? ' · LEAN R' : '') : '') + (P.nvg ? ' · NVG' : ''));
    // weapon
    const w = P.weapon();
    if (w && !P.veh) {
      $('weaponbox').classList.remove('hidden');
      $('wname').textContent = w.d.name + (w.atts.length ? ' · ' + w.atts.map((a) => a.name).join(' · ') : '') + (P.reloadT > 0 ? ' — RELOADING' : '');
      $('mag').textContent = w.mag; $('reserve').textContent = '/ ' + w.reserve;
      $('ammo').classList.toggle('low', w.mag <= Math.ceil(w.magMax * 0.2));
      const g = P.cls.gadget;
      const gtxt = { medkit: 'MEDKIT ×' + P.medkits, ammo: 'AMMO BOX' + (P.gadgetCd > 0 ? ' ' + Math.ceil(P.gadgetCd) + 's' : ''), repair: 'REPAIR (hold)', arty: 'BINOCULARS' + (P.artyCd > 0 ? ' ' + Math.ceil(P.artyCd) + 's' : ''), launcher: 'LAUNCHER' }[g];
      $('gadgets').innerHTML = P.weapons.map((q, k) => `<span class="${k === P.slot ? 'on' : ''}">[${k + 1}] ${q.d.name.split(' ')[0]}</span>`).join('') + `<br><span class="on">[G] FRAG ×${P.grenades}</span>` + (P.smokes ? `<span>[X] SMOKE ×${P.smokes}</span>` : '') + (P.mines ? `<span>[X] AT MINE ×${P.mines}</span>` : '') + (g !== 'launcher' ? `<span>[4] ${gtxt}</span>` : '');
    } else $('weaponbox').classList.add('hidden');
    // vehicle
    if (P.veh) {
      const v = P.veh;
      $('vehbox').classList.remove('hidden');
      $('vname').textContent = v.T.name.toUpperCase() + (P.seat === 'passenger' ? ' — PASSENGER' : '');
      $('vhpbar').style.width = Math.max(0, v.hp / v.T.hp * 100) + '%';
      $('vhpbar').style.background = v.hp < v.T.hp * 0.3 ? '#e45a3c' : v.hp < v.T.hp * 0.6 ? '#f0b040' : '#8fd16a';
      const wpn = !v.T.gun ? 'Unarmed' : P.vehWeapon === 1 ? (v.T.gun === 'heligun' ? 'Rockets ×' + v.rockets : 'Coaxial MG') : ({ cannon: '120mm Cannon', autocannon: '30mm Autocannon', hmg: '.50 cal HMG', heligun: '30mm Chain Gun', howitzer: '155mm Howitzer (LMB: fire at crosshair)' }[v.T.gun]);
      $('vinfo').innerHTML = `${Math.round(Math.abs(v.spd) * 3.6)} km/h${v.T.air ? ' · ALT ' + Math.round(v.alt) + 'm' : ''} · ${wpn}${v.fireCd > 0.3 ? ' · RELOADING' : ''} · Passengers ${v.passengers.length}/${v.T.seats}<br>F exit · V camera${v.T.mg || v.T.gun === 'heligun' ? ' · 1/2 weapons' : ''}${v.T.air ? ' · SPACE up · CTRL/C down · Q/E strafe' : ' · SPACE brake'}`;
    } else $('vehbox').classList.add('hidden');
    // squad panel
    H.squadPanel(B);
    // prompts and messages
    const pr = $('prompt');
    if (P.interactPrompt && !P.veh && P.alive) { pr.style.display = 'block'; pr.textContent = P.reviveTgt >= 0 ? 'Reviving… ' + Math.round((P.reviveProg || 0) * 100) + '%' : P.interactPrompt.text; }
    else pr.style.display = 'none';
    $('messages').innerHTML = P.messages.map((m) => `<div style="opacity:${Math.min(1, m.life)}">${m.t}</div>`).join('');
    $('xppops').innerHTML = (P.xpPops || []).map((x) => `<div style="opacity:${Math.min(1, x.t)}">+${x.n} ${x.why}</div>`).join('');
    // command menu
    const cm = $('cmdmenu');
    cm.classList.toggle('hidden', !P.cmdMenu);
    if (P.cmdMenu) cm.innerHTML = '<h3>SQUAD COMMANDS</h3>' + P.COMMANDS.map((c, k) => `<div><b>${k + 1}</b>${c[1]}</div>`).join('') + '<div class="small" style="color:#8f8c7a;margin-top:6px">Applies to your squad and friendly squads within ' + (70 + IF.rankIndex(IF.Profile.xp + P.bs.xp) * 6) + 'm · B to close</div>';
    // downed
    $('downed').classList.toggle('hidden', P.state !== 'downed');
    if (P.state === 'downed') { $('downedBar').style.width = Math.max(0, P.downT / 30 * 100) + '%'; const S2 = B.S; const r = S2.rescuer[P.idx]; $('downedTxt').textContent = r >= 0 && S2.st[r] === ST.ALIVE ? 'A medic is coming to you!' : 'Wait for a medic — or press SPACE to give up'; }
    // effects overlays
    $('vignette').style.opacity = U.clamp((1 - P.hp / 100) * 0.9 + P.suppress * 0.35 + (P.state === 'downed' ? 0.6 : 0), 0, 1);
    $('nvg').classList.toggle('on', !!P.nvg && P.alive);
    const w2 = P.weapon();
    $('scope').classList.toggle('hidden', !(P.alive && !P.veh && w2 && w2.scope && P.ads > 0.8));
    $('binoc').classList.toggle('hidden', !(P.alive && P.binoc));
    // feeds
    for (const r of H.radio) r.t -= 0.1;
    if (H.radio.length && H.radio[0].t <= 0) { H.radio.shift(); H.radioDirty = true; }
    if (H.radioDirty) { H.radioDirty = false; $('radiolog').innerHTML = H.radio.map((r) => `<div class="${r.from === 'COMMAND' ? 'cmd' : ''} ${r.key === 'lost' || r.key === 'fallback' ? 'bad' : ''}"><b>${r.from}</b>${r.text}</div>`).join(''); }
    for (const k of H.feed) k.t -= 0.1;
    if (H.feed.length && H.feed[0].t <= 0) { H.feed.shift(); H.feedDirty = true; }
    if (H.feedDirty) { H.feedDirty = false; $('killfeed').innerHTML = H.feed.map((k) => `<div class="${k.mine ? 'me' : ''}"><span class="${k.at === B.playerTeam ? 'f' : 'e'}">${k.a}</span> ${k.how} <span class="${k.vt === B.playerTeam ? 'f' : 'e'}">${k.v}</span></div>`).join(''); }
    H.drawMinimap(B);
    // scoreboard
    const sb = $('scoreboard');
    const show = IF.Input.down('Tab');
    sb.classList.toggle('hidden', !show);
    if (show) H.scoreboard(B);
    if (IF.Main && IF.Main.showPerf) $('perf').textContent = IF.Main.perfText || '';
    else $('perf').textContent = '';
  };

  H.squadPanel = function (B) {
    const P = IF.Player, S = B.S;
    const sq = B.squads[P.squadId];
    if (!sq) { $('squadbox').innerHTML = ''; return; }
    const stateTxt = { move: 'MOVING', combat: 'IN CONTACT', defend: 'DEFENDING', hold: 'HOLDING', flank: 'FLANKING', retreat: 'FALLING BACK', regroup: 'REGROUPING', mount: 'MOUNTING', mounted: 'IN TRANSPORT', deploy: 'DEPLOYING', dead: 'WIPED OUT', follow: 'FOLLOWING YOU' }[sq.state] || sq.state.toUpperCase();
    const dest = sq.dest && sq.dest.obj ? (sq.dest.obj.letter !== 'HQ' ? sq.dest.obj.letter + ' ' : '') + sq.dest.obj.name : '';
    let h = `<div class="sqh"><span>SQUAD ${sq.callsign}</span><span>${sq.alive}/${sq.size}</span></div><div class="st">${stateTxt}${dest ? ' → ' + dest : ''}${sq.override && B.time < sq.override.until ? ' · ORDER: ' + sq.override.cmd.toUpperCase() : ''}</div>`;
    for (const m of sq.members) {
      const st = S.st[m];
      const cls = m === P.idx ? 'me' : st === ST.DEAD ? 'd' : st === ST.DOWNED || S.hp[m] < 50 ? 'w' : '';
      const status = m === P.idx ? 'YOU' : st === ST.DEAD ? 'KIA' : st === ST.DOWNED ? 'DOWN' : st === ST.MOUNTED ? 'MOUNTED' : Math.round(S.hp[m]) + '%';
      h += `<div class="m ${cls}"><span>${IF.ROLE_NAMES[S.role[m]]}</span><span>${status}</span></div>`;
    }
    $('squadbox').innerHTML = h;
  };

  H.scoreboard = function (B) {
    const P = IF.Player, f = B.playerTeam, e = 1 - f;
    const own = [0, 0];
    for (const o of B.W.objectives) if (o.owner >= 0) own[o.owner]++;
    let alive = [0, 0], down = [0, 0];
    for (const sq of B.squads) alive[sq.team] += sq.alive;
    down[0] = B.downed[0].length; down[1] = B.downed[1].length;
    const states = {};
    for (const sq of B.squads) if (sq.team === f && sq.type === 'inf') states[sq.state] = (states[sq.state] || 0) + 1;
    const rows = [
      ['', IF.TEAMS[f].short + ' (YOU)', IF.TEAMS[e].short],
      ['Reinforcements', B.tickets[f], B.tickets[e]], ['Soldiers on field', alive[f], alive[e]], ['Wounded awaiting medic', down[f], down[e]],
      ['Killed in action', B.deaths[f], B.deaths[e]], ['Vehicles lost', B.vehLost[f], B.vehLost[e]], ['Objectives held', own[f], own[e]],
      ['Commander posture', B.cmd[f].posture.toUpperCase(), '???'],
    ];
    const ps = P.bs;
    $('scoreboard').innerHTML = `<h3>BATTLE STATUS — ${IF.PHASES[B.phase]} — ${U.fmtTime(B.time)}</h3><table>${rows.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}</table>
      <h3 style="margin-top:14px">YOUR SERVICE</h3><table><tr><td>Kills / Deaths</td><td>${ps.kills} / ${ps.deaths}</td><td>Headshots ${ps.headshots}</td></tr><tr><td>XP this battle</td><td>${ps.xp}</td><td>Revives ${ps.revives}</td></tr><tr><td>Captures</td><td>${ps.captures}</td><td>Vehicles destroyed ${ps.vehiclesDestroyed}</td></tr></table>
      <div class="small" style="margin-top:8px">Friendly squads: ${Object.entries(states).map(([k, v]) => k + ' ' + v).join(' · ')}</div>`;
  };

  // ------------------------------------------------------------------ minimap
  H.drawMinimap = function (B) {
    const c = H.mctx, W = 210, S = B.S, P = IF.Player;
    const range = P.veh && P.veh.T.air ? 600 : 260;
    const px = B.camX, pz = B.camZ;
    const yaw = P.alive ? (P.veh ? P.yaw : P.yaw) : 0;
    const sc = W / 2 / range;
    c.save();
    c.fillStyle = '#10140e'; c.fillRect(0, 0, W, W);
    c.translate(W / 2, W / 2);
    c.rotate(yaw);
    // background map
    if (H.mapImg) { const k = 512 / 2000; c.globalAlpha = 0.85; c.drawImage(H.mapImg, (px + 1000) * k - range * k, (pz + 1000) * k - range * k, range * 2 * k, range * 2 * k, -range * sc, -range * sc, range * 2 * sc, range * 2 * sc); c.globalAlpha = 1; }
    const tx = (x) => (x - px) * sc, tz = (z) => (z - pz) * sc;
    // objectives
    for (const o of B.W.objectives) {
      c.strokeStyle = teamCol(B, o.owner); c.lineWidth = 1.5;
      c.beginPath(); c.arc(tx(o.x), tz(o.z), o.r * sc, 0, 7); c.stroke();
    }
    // soldiers
    const fT = B.playerTeam;
    const mySq = P.squadId;
    for (let i = 0; i < S.n; i++) {
      const st = S.st[i];
      if (st !== ST.ALIVE && st !== ST.DOWNED) continue;
      const x = S.x[i], z = S.z[i];
      if (Math.abs(x - px) > range * 1.42 || Math.abs(z - pz) > range * 1.42) continue;
      if (S.team[i] === fT) c.fillStyle = S.squad[i] === mySq ? '#8fef6a' : st === ST.DOWNED ? '#f0b040' : '#5fb3ff';
      else { if (S.spotT[i] < B.time && !(B.time - S.lastFire[i] < 1.5 && U.dist2(x, z, px, pz) < 150 * 150)) continue; c.fillStyle = '#ff5a4a'; }
      c.fillRect(tx(x) - 1.5, tz(z) - 1.5, 3, 3);
    }
    // vehicles
    for (const v of B.activeVeh) {
      if (Math.abs(v.x - px) > range * 1.42 || Math.abs(v.z - pz) > range * 1.42) continue;
      if (v.team === 1 - fT && v.spotT < B.time) continue;
      c.save(); c.translate(tx(v.x), tz(v.z)); c.rotate(-v.yaw);
      c.fillStyle = teamCol(B, v.team); c.strokeStyle = '#000';
      if (v.T.air) { c.beginPath(); c.arc(0, 0, 5, 0, 7); c.fill(); c.stroke(); }
      else { c.fillRect(-3, -5, 6, 10); c.strokeRect(-3, -5, 6, 10); }
      c.restore();
    }
    if (B.helpMarker) { c.strokeStyle = '#f0b040'; c.lineWidth = 2; c.beginPath(); c.arc(tx(B.helpMarker.x), tz(B.helpMarker.z), 7 + Math.sin(H.t * 6) * 2, 0, 7); c.stroke(); }
    c.restore();
    // objective letters (unrotated text)
    c.save(); c.translate(W / 2, W / 2);
    c.font = 'bold 11px Consolas, monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    for (const o of B.W.objectives) {
      const dx = (o.x - px) * sc, dz = (o.z - pz) * sc;
      let rx = dx * cs - dz * sn, rz = dx * sn + dz * cs;
      const L = Math.sqrt(rx * rx + rz * rz), lim = W / 2 - 9;
      if (L > lim) { rx *= lim / L; rz *= lim / L; }
      c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(rx - 8, rz - 7, 16, 14);
      c.fillStyle = teamCol(B, o.owner); c.fillText(o.letter === 'HQ' ? 'H' : o.letter, rx, rz + 1);
    }
    // player arrow
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(0, -7); c.lineTo(5, 6); c.lineTo(0, 3); c.lineTo(-5, 6); c.closePath(); c.fill();
    c.restore();
    // north indicator
    c.save(); c.translate(W / 2, W / 2);
    const NR = W / 2 - 9;
    c.fillStyle = '#e2cf8e'; c.font = 'bold 10px Consolas'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('N', NR * Math.sin(yaw), -NR * Math.cos(yaw)); c.restore();
    $('gridref').textContent = 'GRID ' + String.fromCharCode(65 + Math.floor((px + 1000) / 200)) + (Math.floor((pz + 1000) / 200) + 1);
  };

  H.drawCompass = function (B) {
    const c = H.cctx, W = 460, Hh = 34, P = IF.Player;
    c.clearRect(0, 0, W, Hh);
    const yaw = P.veh ? P.yaw : P.yaw;
    const deg = ((-yaw * 180 / Math.PI) % 360 + 360) % 360; // 0 = north, clockwise
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(0, 6, W, 22);
    c.strokeStyle = '#cfc9ae'; c.fillStyle = '#cfc9ae'; c.font = '11px Consolas'; c.textAlign = 'center';
    const ppd = 3.2;
    for (let a = -80; a <= 80; a += 5) {
      const d = Math.round(deg + a); const dd = ((d % 360) + 360) % 360;
      const x = W / 2 + (a - (deg - Math.floor(deg))) * ppd + (Math.round(deg) - deg) * 0;
      const xx = W / 2 + (d - deg) * ppd;
      if (dd % 15 === 0) {
        c.beginPath(); c.moveTo(xx, 8); c.lineTo(xx, dd % 45 === 0 ? 16 : 13); c.stroke();
        const lab = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' }[dd];
        c.fillStyle = lab === 'N' ? '#e2cf8e' : '#cfc9ae';
        c.fillText(lab || String(dd), xx, 27);
      }
      void x;
    }
    // objective pips
    const S = B.S;
    const px = B.camX, pz = B.camZ;
    for (const o of B.W.objectives) {
      const a = Math.atan2(o.x - px, -(o.z - pz)) * 180 / Math.PI;
      let rel = ((a - deg + 540) % 360) - 180;
      if (Math.abs(rel) > 72) continue;
      c.fillStyle = teamCol(B, o.owner); c.font = 'bold 9px Consolas';
      c.fillText(o.letter === 'HQ' ? 'H' : o.letter, W / 2 + rel * ppd, 5);
    }
    c.fillStyle = '#e2cf8e'; c.beginPath(); c.moveTo(W / 2, 30); c.lineTo(W / 2 - 4, 34); c.lineTo(W / 2 + 4, 34); c.fill();
    void S;
  };

  // ------------------------------------------------------------------ overlay canvas
  const _p = new THREE.Vector3();
  H.project = function (x, y, z) {
    const cam = IF.R.camera;
    _p.set(x, y, z).project(cam);
    if (_p.z > 1) return null;
    return [(_p.x * 0.5 + 0.5) * H.ov.width, (-_p.y * 0.5 + 0.5) * H.ov.height];
  };
  H.drawOverlay = function (B, dt) {
    const c = H.ctx, Wd = H.ov.width, Ht = H.ov.height, d = H.dpr, P = IF.Player, S = B.S;
    c.clearRect(0, 0, Wd, Ht);
    if (!P.alive && P.state !== 'downed') return;
    const cam = IF.R.camera.position;
    c.font = `${11 * d}px Consolas, monospace`; c.textAlign = 'center';
    // objectives
    for (const o of B.W.objectives) {
      const gy = B.W.groundAt(o.x, o.z) + 14;
      const p = H.project(o.x, gy, o.z);
      if (!p) continue;
      const dist = Math.sqrt(U.dist2(o.x, o.z, cam.x, cam.z));
      const r = 11 * d;
      c.strokeStyle = teamCol(B, o.owner); c.lineWidth = 2 * d; c.fillStyle = 'rgba(0,0,0,0.45)';
      c.beginPath(); c.arc(p[0], p[1], r, 0, 7); c.fill(); c.stroke();
      if (o.contested) { c.strokeStyle = '#f0b040'; c.beginPath(); c.arc(p[0], p[1], r + 3 * d, 0, 7); c.stroke(); }
      c.fillStyle = teamCol(B, o.owner); c.font = `bold ${12 * d}px Consolas`;
      c.fillText(o.letter === 'HQ' ? 'H' : o.letter, p[0], p[1] + 4 * d);
      c.font = `${10 * d}px Consolas`; c.fillStyle = '#ddd';
      c.fillText(Math.round(dist) + 'm', p[0], p[1] + r + 12 * d);
    }
    // inside an objective: capture bar
    const px = B.camX, pz = B.camZ;
    for (const o of B.W.objectives) {
      if (U.dist2(px, pz, o.x, o.z) > o.r * o.r) continue;
      const prog = B.playerTeam === 0 ? -o.progress : o.progress;
      const bw = 300 * d, bx = Wd / 2 - bw / 2, by = 150 * d;
      c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(bx, by, bw, 16 * d);
      c.fillStyle = prog >= 0 ? '#5fb3ff' : '#ff5a4a';
      c.fillRect(Wd / 2, by + 2 * d, (bw / 2 - 2 * d) * prog, 12 * d);
      c.fillStyle = '#fff'; c.font = `${11 * d}px Consolas`;
      const f = B.playerTeam === 0 ? o.c0 : o.c1, e = B.playerTeam === 0 ? o.c1 : o.c0;
      c.fillText(`${o.letter !== 'HQ' ? o.letter + ' · ' : ''}${o.name.toUpperCase()}  ${f || 0} vs ${e || 0}${o.hq >= 0 && o.hq !== B.playerTeam && o.owner === o.hq && B.W.objectives.filter((q) => q.owner === B.playerTeam && q.hq < 0).length < 5 ? '  (LOCKED — hold 5 objectives)' : ''}`, Wd / 2, by + 12 * d);
    }
    // soldiers markers
    const fT = B.playerTeam;
    for (let i = 0; i < S.n; i++) {
      const st = S.st[i];
      if ((st !== ST.ALIVE && st !== ST.DOWNED) || i === P.idx) continue;
      const dx = S.x[i] - cam.x, dz = S.z[i] - cam.z, d2 = dx * dx + dz * dz;
      if (S.team[i] === fT) {
        const mine = S.squad[i] === P.squadId;
        if (d2 > (mine ? 150 * 150 : st === ST.DOWNED ? 60 * 60 : 18 * 18)) continue;
        const p = H.project(S.x[i], S.y[i] + (st === ST.DOWNED ? 1.0 : 2.15), S.z[i]);
        if (!p) continue;
        if (st === ST.DOWNED) { c.fillStyle = '#f0b040'; c.fillRect(p[0] - 5 * d, p[1] - 1.5 * d, 10 * d, 3 * d); c.fillRect(p[0] - 1.5 * d, p[1] - 5 * d, 3 * d, 10 * d); continue; }
        c.fillStyle = mine ? '#8fef6a' : '#5fb3ff';
        const s = (mine ? 5 : 3.5) * d;
        c.beginPath(); c.moveTo(p[0], p[1] - s); c.lineTo(p[0] + s, p[1]); c.lineTo(p[0], p[1] + s); c.lineTo(p[0] - s, p[1]); c.fill();
      } else if (S.spotT[i] > B.time + 6 && d2 < 500 * 500 && st === ST.ALIVE) {
        // explicitly spotted enemies (by you, recon or drones)
        const p = H.project(S.x[i], S.y[i] + 2.2, S.z[i]);
        if (!p) continue;
        c.fillStyle = '#ff5a4a'; const s = 4 * d;
        c.beginPath(); c.moveTo(p[0], p[1] + s); c.lineTo(p[0] + s, p[1] - s); c.lineTo(p[0] - s, p[1] - s); c.fill();
      }
    }
    // vehicles
    for (const v of B.activeVeh) {
      if (v === P.veh) continue;
      const d2 = U.dist2(v.x, v.z, cam.x, cam.z);
      const enemySpot = v.team === 1 - fT && v.spotT > B.time;
      const emptyF = v.team === fT && v.crew.length === 0 && !v.playerIn;
      if (!(v.team === fT && d2 < 35 * 35) && !(emptyF && d2 < 90 * 90) && !enemySpot && !(v.team < 0 && d2 < 150 * 150)) continue;
      const p = H.project(v.x, v.y + v.T.hgt + 2.5, v.z);
      if (!p) continue;
      c.fillStyle = teamCol(B, v.team); c.font = `${10 * d}px Consolas`;
      c.fillText((v.team < 0 ? 'ABANDONED ' : '') + v.T.short + (v.team === fT && v.crew.length === 0 && !v.playerIn ? ' (EMPTY)' : '') + ' ' + Math.round(Math.sqrt(d2)) + 'm', p[0], p[1]);
      c.fillRect(p[0] - 15 * d, p[1] + 3 * d, 30 * d * Math.max(0, v.hp / v.T.hp), 2 * d);
    }
    if (B.helpMarker) { const p = H.project(B.helpMarker.x, B.W.groundAt(B.helpMarker.x, B.helpMarker.z) + 6, B.helpMarker.z); if (p) { c.fillStyle = '#f0b040'; c.font = `bold ${11 * d}px Consolas`; c.fillText('⚠ ASSIST ' + Math.round(Math.sqrt(U.dist2(B.helpMarker.x, B.helpMarker.z, cam.x, cam.z))) + 'm', p[0], p[1]); } }
    for (const s of B.supply) { const p = H.project(s.x, s.y + 2, s.z); if (p && U.dist2(s.x, s.z, cam.x, cam.z) < 300 * 300) { c.fillStyle = '#8fd16a'; c.fillText('▣ SUPPLY', p[0], p[1]); } }
    if (B.artyMarker && B.time < B.artyMarker.until) { const p = H.project(B.artyMarker.x, B.W.groundAt(B.artyMarker.x, B.artyMarker.z) + 3, B.artyMarker.z); if (p) { c.strokeStyle = '#ff5a4a'; c.lineWidth = 2 * d; c.beginPath(); c.arc(p[0], p[1], 14 * d, 0, 7); c.stroke(); c.fillStyle = '#ff5a4a'; c.fillText('FIRE MISSION', p[0], p[1] - 18 * d); } }
    // crosshair
    const cx = Wd / 2, cy = Ht / 2;
    const w = P.weapon();
    if (P.alive && !P.binoc) {
      if (P.veh) {
        c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = 1.5 * d;
        c.beginPath(); c.arc(cx, cy, 14 * d, 0, 7); c.moveTo(cx - 24 * d, cy); c.lineTo(cx - 8 * d, cy); c.moveTo(cx + 8 * d, cy); c.lineTo(cx + 24 * d, cy); c.moveTo(cx, cy + 8 * d); c.lineTo(cx, cy + 24 * d); c.stroke();
        if (P.veh.T.gun && !P.veh.T.air) {
          // where the turret is actually pointing
          const v = P.veh;
          const tp = H.project(v.x + U.dirX(v.turretYaw) * 200, v.y + v.T.hgt + Math.tan(v.gunPitch) * 200, v.z + U.dirZ(v.turretYaw) * 200);
          if (tp) { c.strokeStyle = 'rgba(255,220,120,0.8)'; c.strokeRect(tp[0] - 4 * d, tp[1] - 4 * d, 8 * d, 8 * d); }
        }
      } else if (!(w.scope && P.ads > 0.8)) {
        const moving = Math.sqrt(P.vx * P.vx + P.vz * P.vz);
        const spread = U.lerp(w.d.hip, w.d.ads * w.adsMul, P.ads) * (1 + moving * 0.35) * (P.stance === 2 ? 0.5 : P.stance === 1 ? 0.75 : 1) * (1 + P.heat * 0.6);
        const gap = Math.max(3, spread * Ht * 0.9) * (P.ads > 0.6 ? 0.35 : 1);
        c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 1.5 * d; c.shadowColor = '#000'; c.shadowBlur = 2;
        const L = 7 * d;
        c.beginPath();
        if (P.ads > 0.6 && P.firstPerson) { c.arc(cx, cy, 1.5 * d, 0, 7); }
        else { c.moveTo(cx - gap - L, cy); c.lineTo(cx - gap, cy); c.moveTo(cx + gap, cy); c.lineTo(cx + gap + L, cy); c.moveTo(cx, cy - gap - L); c.lineTo(cx, cy - gap); c.moveTo(cx, cy + gap); c.lineTo(cx, cy + gap + L); }
        c.stroke(); c.shadowBlur = 0;
      }
    }
    if (P.hitMarker > 0) {
      c.strokeStyle = P.hitKind === 'kill' ? '#ff4a3a' : P.hitKind === 'head' ? '#ffd46a' : '#fff'; c.lineWidth = 2 * d;
      const a = 6 * d, b = 13 * d; c.beginPath();
      c.moveTo(cx - b, cy - b); c.lineTo(cx - a, cy - a); c.moveTo(cx + b, cy - b); c.lineTo(cx + a, cy - a); c.moveTo(cx - b, cy + b); c.lineTo(cx - a, cy + a); c.moveTo(cx + b, cy + b); c.lineTo(cx + a, cy + a); c.stroke();
    }
    // damage direction
    const yaw = P.yaw;
    for (const dd of P.dmgDirs) {
      const a = Math.atan2(dd.x - px, -(dd.z - pz)) + yaw; // relative bearing
      c.strokeStyle = `rgba(255,40,30,${Math.min(0.85, dd.t)})`; c.lineWidth = 6 * d;
      c.beginPath(); c.arc(cx, cy, 90 * d, a - Math.PI / 2 - 0.3, a - Math.PI / 2 + 0.3); c.stroke();
    }
    // binocular range finder
    if (P.binoc) { const ap = P.aimPoint(B); $('binocInfo').textContent = 'RANGE ' + Math.round(Math.sqrt(U.dist2(ap[0], ap[2], px, pz))) + 'm — LMB: call artillery' + (P.artyCd > 0 ? ' (ready in ' + Math.ceil(P.artyCd) + 's)' : '') + ' · T: spot'; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
