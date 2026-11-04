// Full-screen tactical map (also used by the deploy screen): terrain, objectives, frontline
// influence, friendly squads and their orders, detected enemies, vehicles.
(function (G) {
  'use strict';
  const IF = G.IF, U = IF.U, ST = IF.ST;
  const TM = (IF.TacMap = {});
  const IN = 48;
  const inf = new Float32Array(IN * IN);

  TM.draw = function (canvas, B, opts) {
    opts = opts || {};
    const dpr = Math.min(2, G.devicePixelRatio || 1);
    const w = canvas.clientWidth * dpr, h = canvas.clientHeight * dpr;
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    const c = canvas.getContext('2d');
    c.fillStyle = '#080a07'; c.fillRect(0, 0, w, h);
    const size = Math.min(w, h) * 0.94;
    const ox = (w - size) / 2, oy = (h - size) / 2;
    const sc = size / 2000;
    const tx = (x) => ox + (x + 1000) * sc, tz = (z) => oy + (z + 1000) * sc;
    TM.xf = { ox, oy, sc, dpr };
    const H = IF.HUD, S = B.S, fT = B.playerTeam;
    if (H.mapImg) { c.globalAlpha = 0.9; c.drawImage(H.mapImg, ox, oy, size, size); c.globalAlpha = 1; }
    // grid
    c.strokeStyle = 'rgba(255,255,255,0.08)'; c.lineWidth = 1;
    c.font = `${10 * dpr}px Consolas`; c.fillStyle = 'rgba(255,255,255,0.4)';
    for (let k = 0; k <= 10; k++) {
      c.beginPath(); c.moveTo(ox + k * size / 10, oy); c.lineTo(ox + k * size / 10, oy + size); c.stroke();
      c.beginPath(); c.moveTo(ox, oy + k * size / 10); c.lineTo(ox + size, oy + k * size / 10); c.stroke();
      if (k < 10) { c.fillText(String.fromCharCode(65 + k), ox + (k + 0.5) * size / 10 - 3, oy - 4); c.fillText(String(k + 1), ox - 14 * dpr, oy + (k + 0.5) * size / 10); }
    }
    // influence / frontline (friendly forces + detected enemies)
    inf.fill(0);
    for (let i = 0; i < S.n; i++) {
      const st = S.st[i];
      if (st !== ST.ALIVE) continue;
      const friendly = S.team[i] === fT;
      if (!friendly && S.spotT[i] < B.time - 20) continue;
      const cx = Math.floor((S.x[i] + 1000) / 2000 * IN), cz = Math.floor((S.z[i] + 1000) / 2000 * IN);
      for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
        const x = cx + dx, z = cz + dz; if (x < 0 || z < 0 || x >= IN || z >= IN) continue;
        inf[z * IN + x] += (friendly ? 1 : -1.4) / (1 + dx * dx + dz * dz);
      }
    }
    for (const o of B.W.objectives) if (o.owner >= 0) {
      const cx = Math.floor((o.x + 1000) / 2000 * IN), cz = Math.floor((o.z + 1000) / 2000 * IN);
      for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) { const x = cx + dx, z = cz + dz; if (x >= 0 && z >= 0 && x < IN && z < IN) inf[z * IN + x] += (o.owner === fT ? 2 : -2) / (1 + dx * dx + dz * dz); }
    }
    const cs = size / IN;
    for (let z = 0; z < IN; z++) for (let x = 0; x < IN; x++) {
      const v = inf[z * IN + x];
      if (Math.abs(v) < 0.2) continue;
      c.fillStyle = v > 0 ? `rgba(80,160,255,${Math.min(0.28, Math.abs(v) * 0.04)})` : `rgba(255,80,60,${Math.min(0.28, Math.abs(v) * 0.04)})`;
      c.fillRect(ox + x * cs, oy + z * cs, cs + 0.5, cs + 0.5);
    }
    c.strokeStyle = 'rgba(255,212,106,0.85)'; c.lineWidth = 2 * dpr;
    c.beginPath();
    for (let z = 0; z < IN - 1; z++) for (let x = 0; x < IN - 1; x++) {
      const a = inf[z * IN + x], b = inf[z * IN + x + 1], d = inf[(z + 1) * IN + x];
      if (Math.abs(a) > 0.3 && Math.abs(b) > 0.3 && Math.sign(a) !== Math.sign(b)) { c.moveTo(ox + (x + 1) * cs, oy + z * cs); c.lineTo(ox + (x + 1) * cs, oy + (z + 1) * cs); }
      if (Math.abs(a) > 0.3 && Math.abs(d) > 0.3 && Math.sign(a) !== Math.sign(d)) { c.moveTo(ox + x * cs, oy + (z + 1) * cs); c.lineTo(ox + (x + 1) * cs, oy + (z + 1) * cs); }
    }
    c.stroke();
    // squad movement arrows (friendly)
    c.lineWidth = 1 * dpr;
    for (const sq of B.squads) {
      if (sq.team !== fT || sq.type !== 'inf' || sq.alive === 0 || sq.leader < 0 || !sq.dest) continue;
      const l = sq.leader;
      c.strokeStyle = sq.playerSquad ? 'rgba(143,239,106,0.9)' : sq.state === 'retreat' ? 'rgba(240,176,64,0.5)' : 'rgba(95,179,255,0.35)';
      c.beginPath(); c.moveTo(tx(S.x[l]), tz(S.z[l])); c.lineTo(tx(sq.dest.x), tz(sq.dest.z)); c.stroke();
    }
    // soldiers
    for (let i = 0; i < S.n; i++) {
      const st = S.st[i];
      if (st !== ST.ALIVE && st !== ST.DOWNED) continue;
      if (S.team[i] === fT) c.fillStyle = S.squad[i] === (IF.Player && IF.Player.squadId) ? '#8fef6a' : '#5fb3ff';
      else { if (S.spotT[i] < B.time) continue; c.fillStyle = '#ff5a4a'; }
      c.fillRect(tx(S.x[i]) - 1 * dpr, tz(S.z[i]) - 1 * dpr, 2 * dpr, 2 * dpr);
    }
    // vehicles
    for (const v of B.vehicles) {
      if (v.state === 'gone') continue;
      if (v.state === 'wreck') { c.fillStyle = 'rgba(30,30,30,0.8)'; c.fillRect(tx(v.x) - 2 * dpr, tz(v.z) - 2 * dpr, 4 * dpr, 4 * dpr); continue; }
      if (v.team === 1 - fT && v.spotT < B.time) continue;
      c.save(); c.translate(tx(v.x), tz(v.z)); c.rotate(-v.yaw);
      c.fillStyle = H.teamCol(B, v.team); c.strokeStyle = '#000'; c.lineWidth = 1;
      const s = (v.T.air ? 5 : v.type === 'mbt' ? 5 : 4) * dpr;
      if (v.T.air) { c.beginPath(); c.moveTo(0, -s); c.lineTo(s, s); c.lineTo(-s, s); c.closePath(); c.fill(); c.stroke(); }
      else { c.fillRect(-s * 0.6, -s, s * 1.2, s * 2); c.strokeRect(-s * 0.6, -s, s * 1.2, s * 2); }
      c.restore();
    }
    for (const j of B.jets) { c.fillStyle = H.teamCol(B, j.team); c.beginPath(); c.arc(tx(j.x), tz(j.z), 3 * dpr, 0, 7); c.fill(); }
    // objectives
    for (const o of B.W.objectives) {
      const x = tx(o.x), z = tz(o.z);
      const col = H.teamCol(B, o.owner);
      c.strokeStyle = col; c.lineWidth = 2 * dpr; c.fillStyle = 'rgba(0,0,0,0.55)';
      c.beginPath(); c.arc(x, z, Math.max(10 * dpr, o.r * sc), 0, 7); c.fill(); c.stroke();
      if (o.contested) { c.strokeStyle = '#f0b040'; c.setLineDash([4, 3]); c.beginPath(); c.arc(x, z, Math.max(10 * dpr, o.r * sc) + 4 * dpr, 0, 7); c.stroke(); c.setLineDash([]); }
      c.fillStyle = col; c.font = `bold ${13 * dpr}px Consolas`; c.textAlign = 'center';
      c.fillText(o.letter === 'HQ' ? 'HQ' : o.letter, x, z + 4 * dpr);
      c.font = `${10 * dpr}px Consolas`; c.fillStyle = '#e8e4d0';
      c.fillText(o.name + ' · ' + IF.OBJ_TYPE_LABEL[o.type], x, z + Math.max(10 * dpr, o.r * sc) + 13 * dpr);
    }
    if (B.helpMarker) { c.strokeStyle = '#f0b040'; c.lineWidth = 2 * dpr; c.beginPath(); c.arc(tx(B.helpMarker.x), tz(B.helpMarker.z), 9 * dpr, 0, 7); c.stroke(); c.fillStyle = '#f0b040'; c.fillText('ASSIST', tx(B.helpMarker.x), tz(B.helpMarker.z) - 12 * dpr); }
    for (const z of B.W.dangerZones) if (z.team === fT) { c.strokeStyle = 'rgba(255,80,60,0.8)'; c.setLineDash([3, 3]); c.beginPath(); c.arc(tx(z.x), tz(z.z), z.r * sc, 0, 7); c.stroke(); c.setLineDash([]); }
    // spawn options (deploy screen)
    if (opts.spawns) {
      TM.spawnHits = [];
      opts.spawns.forEach((sp, k) => {
        const x = sp.kind === 'obj' ? tx(sp.obj.x) : tx(sp.x), z = sp.kind === 'obj' ? tz(sp.obj.z) : tz(sp.z);
        const sel = k === opts.sel;
        c.strokeStyle = sp.blocked ? 'rgba(255,90,74,0.7)' : sel ? '#ffe9a0' : 'rgba(226,207,142,0.8)'; c.lineWidth = (sel ? 3 : 1.5) * dpr;
        c.beginPath(); c.arc(x, z, (sp.kind === 'obj' ? 20 : 9) * dpr, 0, 7); c.stroke();
        if (sp.kind === 'soldier') { c.fillStyle = sel ? '#ffe9a0' : '#e2cf8e'; c.fillText('▲', x, z + 4 * dpr); }
        TM.spawnHits.push({ x, z, r: (sp.kind === 'obj' ? 22 : 12) * dpr, k });
      });
    }
    // player
    if (IF.Player && IF.Player.idx >= 0 && (IF.Player.alive || IF.Player.state === 'downed')) {
      const P = IF.Player;
      const x = P.veh ? P.veh.x : S.x[P.idx], z = P.veh ? P.veh.z : S.z[P.idx];
      c.save(); c.translate(tx(x), tz(z)); c.rotate(-P.yaw);
      c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineWidth = 1.5;
      const s = 7 * dpr; c.beginPath(); c.moveTo(0, -s); c.lineTo(s * 0.7, s); c.lineTo(0, s * 0.5); c.lineTo(-s * 0.7, s); c.closePath(); c.fill(); c.stroke();
      c.restore();
    }
  };

  TM.info = function (B) {
    const fT = B.playerTeam;
    let h = '';
    for (const o of B.W.objectives) {
      const col = IF.HUD.teamCol(B, o.owner);
      const f = fT === 0 ? o.c0 : o.c1, e = fT === 0 ? o.c1 : o.c0;
      h += `<div><b style="color:${col}">${o.letter === 'HQ' ? 'HQ' : o.letter}</b> ${o.name} <span style="color:#8f8c7a">(${IF.OBJ_TYPE_LABEL[o.type]})</span><br><span style="color:#8f8c7a">&nbsp;&nbsp;&nbsp;${o.owner < 0 ? 'NEUTRAL' : o.owner === fT ? 'FRIENDLY' : 'ENEMY'}${o.contested ? ' · CONTESTED' : ''} · ${f || 0} friendly / ${e || 0} hostile inside</span></div>`;
    }
    const cmd = B.cmd[fT];
    const focus = cmd.focus >= 0 ? B.W.objectives[cmd.focus] : null;
    h += `<div style="margin-top:12px;color:#e2cf8e">COMMANDER: ${cmd.posture.toUpperCase()}${focus ? ' · MAIN EFFORT ' + (focus.letter !== 'HQ' ? focus.letter + ' ' : '') + focus.name : ''}</div>`;
    h += `<div style="color:#8f8c7a">Phase: ${IF.PHASES[B.phase]} · ${U.fmtTime(B.time)}</div>`;
    return h;
  };
})(typeof window !== 'undefined' ? window : globalThis);
