// Bootstrap and game loop.
(function (G) {
  'use strict';
  const IF = G.IF, U = IF.U, I = IF.Input;
  const M = (IF.Main = { running: false, paused: false, showPerf: false });
  const $ = (id) => document.getElementById(id);

  M.boot = function () {
    const canvas = $('game');
    IF.R.init(canvas);
    IF.ViewModel.init();
    I.init(canvas);
    IF.HUD.init();
    IF.Menu.init();
    IF.on('pointerUnlocked', () => { if (M.running && !M.paused && !IF.Menu.deployOn && !M.mapOpen && IF.B && !IF.B.over && !M.endShown) M.pause(); });
    IF.on('battleOver', () => { M.endT = 4.5; });
    // idle menu backdrop: render nothing heavy
    M.last = U.now();
    requestAnimationFrame(M.frame);
    // help overlay
    const help = document.createElement('div');
    help.id = 'helpOverlay'; help.className = 'hidden';
    help.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);background:rgba(14,18,13,.92);border:1px solid rgba(200,190,140,.3);padding:18px 26px;font:13px Consolas,monospace;line-height:1.7;pointer-events:none;color:#dcd8c4;z-index:5';
    M.buildHelp = function () {
      const L = I.label;
      help.innerHTML = `<b style="color:#e2cf8e;letter-spacing:3px">FIELD MANUAL</b><br>${L('forward')}${L('left')}${L('back')}${L('right')} move · ${L('sprint')} sprint · ${L('crouch')} crouch · ${L('prone')} prone · ${L('leanL')}/${L('leanR')} lean · ${L('jump')} jump<br>LMB fire · RMB aim · ${L('reload')} reload · ${L('weapon1')}-${L('weapon3')} weapons · ${L('gadget')} gadget · ${L('grenade')} grenade · ${L('secondary')} smoke/mine<br>${L('interact')} vehicle / revive / resupply · ${L('spot')} spot · ${L('commands')} squad commands · ${L('map')} map · ${L('status')} status<br>${L('camera')} camera · ${L('nvg')} night vision · ${L('perf')} stats · Esc pause<br><span style="color:#8f8c7a">Change keys in Main menu → Controls</span>`;
    };
    M.buildHelp();
    document.body.appendChild(help);
    M.help = help;
  };

  M.start = function () {
    const s = IF.Profile.settings;
    IF.Menu.show(false);
    IF.Menu.loading(true, 'Generating battlefield…', 10);
    M.running = false;
    // let the loading screen paint before heavy generation
    setTimeout(() => {
      try {
        // the quality preset may have changed since boot
        const q = IF.QUALITY[s.graphics] || IF.QUALITY.medium;
        if (q !== IF.R.q) { IF.R.q = q; IF.R.renderer.shadowMap.enabled = q.shadows; IF.R.sun.castShadow = q.shadows; if (q.shadows) { IF.R.sun.shadow.mapSize.set(q.shadowSize, q.shadowSize); if (IF.R.sun.shadow.map) { IF.R.sun.shadow.map.dispose(); IF.R.sun.shadow.map = null; } } IF.R.renderer.setPixelRatio(Math.min(1.5, Math.min(G.devicePixelRatio || 1, 2) * q.scale)); IF.R.camera.far = q.far + 400; IF.R.resize(); }
        const B = IF.Battle.create({ layout: s.layout, playerTeam: s.army, difficulty: s.difficulty, size: s.size, time: s.time, weather: s.weather });
        IF.Menu.loading(true, 'Deploying 2,000 soldiers…', 55);
        setTimeout(() => {
          IF.WorldRender.build(B.W);
          IF.SoldierRender.build(B);
          IF.VehicleRender.build(B);
          IF.FX.init();
          IF.Gore.init();
          IF.HUD.buildMapImage(B.W);
          IF.Player.reset(B, { cls: s.cls });
          // let the armies get moving for a few seconds before the player arrives
          for (let k = 0; k < 90; k++) IF.Battle.update(B, 1 / 30);
          IF.Menu.loading(false);
          $('hud').classList.remove('hidden');
          M.running = true; M.paused = false; M.endShown = false; M.endT = -1; M.aqLevel = 0; M.aqT = -10;
          IF.Menu.showDeploy(true);
          IF.HUD.banner(IF.TEAMS[B.playerTeam].name + ' — ' + (IF.LAYOUTS.find((l) => l.id === B.W.layout) || {}).name.toUpperCase(), 5);
          M.battleStart = U.now();
        }, 30);
      } catch (e) {
        console.error(e);
        IF.Menu.loading(true, 'Error: ' + e.message, 0);
      }
    }, 60);
  };

  M.pause = function () {
    if (!M.running) return;
    M.paused = true;
    $('pause').classList.remove('hidden');
    if (IF.Audio.ctx) IF.Audio.ctx.suspend();
  };
  M.resume = function () {
    $('pause').classList.add('hidden');
    M.paused = false;
    IF.Audio.resume();
    I.lock();
  };
  M.quit = function (silent) {
    $('pause').classList.add('hidden');
    $('hud').classList.add('hidden');
    $('tacmap').classList.add('hidden'); $('clickToPlay').classList.add('hidden'); M.mapOpen = false;
    $('endscreen').classList.add('hidden');
    IF.Menu.hideDeploy();
    if (M.running && IF.B && !M.endShown) M.commitProfile(IF.B, IF.Player, false);
    M.running = false; M.paused = false;
    IF.Audio.stopAll && IF.Audio.stopAll();
    if (IF.Audio.ctx) IF.Audio.resume();
    IF.WorldRender.dispose(); IF.SoldierRender.dispose(); IF.VehicleRender.dispose(); IF.FX.dispose(); IF.Gore.dispose();
    IF.B = null;
    I.enabled = false; I.unlock();
    IF.Menu.show(true);
  };

  // write battle results into the persistent profile
  M.commitProfile = function (B, P, finished) {
    const prof = IF.Profile, st = prof.stats, bs = P.bs;
    const rankBefore = IF.rankIndex(prof.xp);
    const win = finished && B.winner === B.playerTeam;
    const bonus = finished ? (win ? 500 : 150) : 0;
    const xp = Math.round(bs.xp + bonus);
    prof.xp += xp;
    if (finished) { st.battles++; if (win) { st.wins++; if (B.opts.difficulty === 'veteran' || B.opts.difficulty === 'elite') st.hardWins++; } else st.losses++; }
    for (const k of ['kills', 'deaths', 'headshots', 'revives', 'captures', 'vehiclesDestroyed', 'helisDown', 'vehicleKills', 'commands', 'timesRevived', 'shots', 'hits', 'distanceDriven']) st[k] = (st[k] || 0) + (bs[k] || 0);
    st.longest = Math.max(st.longest, bs.longest);
    st.timePlayed += B.time;
    st.bestBattleXp = Math.max(st.bestBattleXp, xp);
    const medals = [];
    for (const m of IF.MEDALS) if (!prof.medals.includes(m.id) && m.check(st)) { prof.medals.push(m.id); medals.push(m); }
    const ach = [];
    bs.longestLife = Math.max(bs.longestLife, P.timeAlive);
    for (const a of IF.ACHIEVEMENTS) if (a.check(bs)) { ach.push(a); if (!prof.achievements.includes(a.id)) prof.achievements.push(a.id); }
    IF.saveProfile();
    return { xp, bonus, rankBefore, rankAfter: IF.rankIndex(prof.xp), medals, ach };
  };

  // adaptive quality: if the laptop struggles, step rendering detail down (simulation is unchanged)
  M.autoQuality = function (dt) {
    if (IF.Menu.deployOn || M.paused) return;
    M.aqT = (M.aqT || 0) + dt;
    if (M.aqT < 6) return;
    M.aqT = 0;
    const R = IF.R;
    if (M.fps < 26 && !M.aqLevel) {
      M.aqLevel = 1;
      R.renderer.shadowMap.enabled = false; R.sun.castShadow = false;
      R.renderer.setPixelRatio(Math.max(0.6, R.renderer.getPixelRatio() * 0.75)); R.resize();
      IF.Player.message('Performance mode: shadows off, lower resolution');
    } else if (M.fps < 22 && M.aqLevel === 1) {
      M.aqLevel = 2;
      R.renderer.setPixelRatio(Math.max(0.5, R.renderer.getPixelRatio() * 0.8)); R.resize();
      IF.SoldierRender.nearDist = 45; R.q.far = Math.min(R.q.far, 800);
      IF.FX.q = 0.5;
      IF.Player.message('Performance mode: reduced detail');
    }
  };
  M.frame = function () {
    requestAnimationFrame(M.frame);
    const now = U.now();
    let dt = (now - M.last) / 1000;
    M.last = now;
    const realDt = Math.min(1, dt);
    if (dt > 0.1) dt = 0.1;
    if (!M.running || !IF.B) { if (IF.R.ready) { IF.R.renderer.clear(); } return; }
    const B = IF.B, P = IF.Player, R = IF.R;
    I.enabled = !M.paused;
    if (M.paused) { I.endFrame(); return; }
    const t0 = U.now();
    // global keys
    if (I.hitA('map') && P.state !== 'deploy') { M.mapOpen = !M.mapOpen; $('tacmap').classList.toggle('hidden', !M.mapOpen); if (M.mapOpen) I.unlock(); else I.lock(); }
    if (I.hitA('perf')) M.showPerf = !M.showPerf;
    if (I.hitA('help')) { M.help.classList.toggle('hidden'); M.buildHelp(); }
    if (M.mapOpen && I.hit('Escape')) { M.mapOpen = false; $('tacmap').classList.add('hidden'); I.lock(); }
    // simulation step (sub-stepped for stability)
    const steps = dt > 0.05 ? 2 : 1;
    const sdt = Math.min(dt, 0.1) / steps;
    if (!(M.mapOpen && false)) {
      if (!IF.Menu.deployOn || true) P.update(B, dt);
      for (let k = 0; k < steps; k++) IF.Battle.update(B, sdt);
    }
    const t1 = U.now();
    // death -> redeploy screen
    if (P.state === 'dead' && !IF.Menu.deployOn && B.time - P.deathT > 3.5 && !B.over) { I.unlock(); IF.Menu.showDeploy(false); }
    if (IF.Menu.deployOn) IF.Menu.updateDeploy(dt);
    // camera position for LOD & audio
    const cam = R.camera;
    cam.updateMatrixWorld();
    B.camX = cam.position.x; B.camY = cam.position.y; B.camZ = cam.position.z;
    // render updates
    R.updateEnv(B, dt);
    IF.WorldRender.update(B, dt);
    IF.SoldierRender.update(B, dt, (P.viewFP && P.alive) || P.veh ? P.idx : -1);
    IF.VehicleRender.update(B, dt);
    IF.FX.update(dt);
    IF.Gore.update(dt);
    IF.Audio.update(B, dt, cam);
    IF.HUD.update(B, dt);
    if (M.mapOpen) { M.mapT = (M.mapT || 0) - dt; if (M.mapT <= 0) { M.mapT = 0.25; IF.TacMap.draw($('tacCanvas'), B, {}); $('tacInfo').innerHTML = IF.TacMap.info(B); } }
    R.renderer.clear();
    R.renderer.render(R.scene, cam);
    IF.ViewModel.render(R.renderer, dt);
    const t2 = U.now();
    // battle over
    if (B.over && M.endT > 0) { M.endT -= realDt; if (M.endT <= 0 && !M.endShown) { M.endShown = true; I.unlock(); IF.Menu.hideDeploy(); const res = M.commitProfile(B, P, true); IF.Menu.showEnd(B, P, res); } }
    // perf
    M.fps = U.lerp(M.fps || 60, 1 / Math.max(dt, 0.001), 0.05);
    M.autoQuality(dt);
    M.simMs = U.lerp(M.simMs || 0, t1 - t0, 0.05); M.renMs = U.lerp(M.renMs || 0, t2 - t1, 0.05);
    if (M.showPerf) {
      const info = R.renderer.info.render, ss = IF.SoldierRender.stats || {};
      M.perfText = `FPS ${M.fps.toFixed(0)}  sim ${M.simMs.toFixed(1)}ms  render ${M.renMs.toFixed(1)}ms\ncalls ${info.calls}  tris ${(info.triangles / 1000).toFixed(0)}k\nsoldiers near ${ss.near} far ${ss.far} corpses ${ss.corpses}\nprojectiles ${B.proj.count}  vehicles ${B.activeVeh.length}  particles ${IF.FX.smoke.count + IF.FX.glow.count}`;
    }
    I.endFrame();
  };

  G.addEventListener('DOMContentLoaded', M.boot);
})(typeof window !== 'undefined' ? window : globalThis);
