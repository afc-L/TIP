'use strict';
// Boot, main loop, new game / continue flows.
(function () {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  MB.ctx = ctx;
  MB.canvas = canvas;
  let scale = 3, offX = 0, offY = 0;
  MB.resize = function () {
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth, h = window.innerHeight;
    canvas.width = Math.floor(w * dpr); canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    let s = Math.min(canvas.width / MB.W, canvas.height / MB.H);
    const pp = (MB.state ? MB.state.settings : MB.settings || {}).pixelPerfect;
    if (pp && s >= 1) s = Math.floor(s);
    scale = s; offX = Math.floor((canvas.width - MB.W * s) / 2); offY = Math.floor((canvas.height - MB.H * s) / 2);
  };
  window.addEventListener('resize', MB.resize);
  MB.settings = Object.assign(MB.defaultSettings(), MB.Save.loadSettings() || {});
  MB.audio.setMusicVol(MB.settings.music); MB.audio.setSfxVol(MB.settings.sfx);
  MB.resize();
  MB.injectQuestNpcs();

  // ---------------- prologue ----------------
  class PrologueScene {
    constructor() { this.t = 0; this.sp = 'leafling'; }
    update(dt) { this.t += dt; }
    draw(c) {
      const g = c.createLinearGradient(0, 0, 0, MB.H); g.addColorStop(0, '#203050'); g.addColorStop(1, '#507090');
      c.fillStyle = g; c.fillRect(0, 0, MB.W, MB.H);
      for (let i = 0; i < 40; i++) { c.fillStyle = 'rgba(255,255,255,0.4)'; c.fillRect((i * 67 + this.t * 6) % MB.W, (i * 31) % 150, 1, 1); }
      const prof = MB.Chars.get(MB.Chars.randomApp('prof', 'prof'));
      c.drawImage(prof.down[0], 60, 40, 64, 72);
      if (this.sp) { c.drawImage(MB.Sprites.get(this.sp), 170, 40 + Math.sin(this.t * 2) * 3, 96, 96); }
    }
  }
  async function newGame(slot) {
    MB.World.reset();
    MB.state = MB.newState({ slot });
    const S = MB.state;
    MB.audio.play('lab');
    const pro = new PrologueScene();
    MB.Game.push(pro);
    const P = 'Prof. Hazel';
    await MB.say('Hello there! Welcome to the world of Aetheria!', { speaker: P });
    pro.sp = 'emberfox';
    await MB.say('My name is Hazel Thorne. People call me the Creature Professor.', { speaker: P });
    pro.sp = 'aquaphin';
    await MB.say('This world is inhabited far and wide by creatures — hundreds of species, each with its own story.', { speaker: P });
    pro.sp = null;
    await MB.say('Some say that long ago, people and creatures shared a bond so strong it could transform them. The ancients called it the Great Becoming.', { speaker: P });
    pro.sp = 'solarion';
    await MB.say('Legends tell of mighty creatures of dawn and dusk... but that\'s a tale for another day.', { speaker: P });
    pro.sp = null;
    await MB.say('First, tell me a little about yourself.', { speaker: P });
    S.appearance = await MB.Screens.creator();
    S.name = (await MB.inputText('What is your name?', 'Alex', 10)) || 'Alex';
    await MB.say(`${S.name}! What a fine name.`, { speaker: P });
    await MB.say('This is my grandson. He\'s been your rival since you were both babies. ...Erm, what was his name again?', { speaker: P });
    S.rivalName = (await MB.inputText("Your rival's name?", 'Kael', 10)) || 'Kael';
    S.rivalApp = { skin: '#f8d8b8', hair: '#c03828', hairStyle: 'spiky', top: '#303038', bottom: '#3050a0', shoes: '#202020' };
    await MB.say(`That\'s right! ${S.rivalName}! I remember now.`, { speaker: P });
    await MB.say(`${S.name}, your very own legend is about to unfold. A world of dreams and adventures awaits! Let\'s go!`, { speaker: P });
    pro.close();
    await MB.fadeOut(0.6);
    startOverworld();
    S.map = 'wb_home';
    const home = MB.World.get('wb_home');
    S.px = Math.floor(home.w / 2); S.py = 2; S.dir = 'down';
    S.lastCenter = { map: 'willowbrook', door: 'wb_home' };
    MB.Over.onEnterMap(true);
    await MB.fadeIn(0.6);
    await MB.say('You wake up in your room in Willowbrook Village. Today is the day you get your first creature!');
    await MB.say('Controls: Arrows/WASD to move, Z or Enter to talk, X or Esc for the menu.');
  }
  function startOverworld() {
    MB.Game.scenes.length = 0;
    const ow = new MB.Overworld();
    MB.Game.push(ow);
  }
  async function continueGame(slot) {
    MB.World.reset();
    const S = MB.Save.load(slot);
    if (!S) { await MB.say('That save file could not be loaded.'); return boot(); }
    S.slot = slot;
    MB.state = S;
    MB.settings = S.settings;
    MB.audio.setMusicVol(S.settings.music); MB.audio.setSfxVol(S.settings.sfx);
    startOverworld();
    const m = MB.World.get(S.map);
    if (S.px === null || S.px === undefined || !MB.World.tileAt(m, S.px, S.py)) { const [x, y] = MB.Over.nearestFree(Math.floor(m.w / 2), Math.floor(m.h / 2)); S.px = x; S.py = y; }
    MB.Over.onEnterMap(true);
    MB.toast(`Welcome back, ${S.name}!`);
  }
  async function boot() {
    MB.Game.scenes.length = 0;
    MB.state = null;
    const res = await MB.Game.push(new MB.TitleScene());
    if (res.action === 'new') await newGame(res.slot);
    else await continueGame(res.slot);
  }
  MB.boot = boot;
  // Test/debug helper: jump straight into the overworld with a prepared team.
  MB.debugStart = function (o = {}) {
    MB.World.reset();
    MB.state = MB.newState({ slot: 2, name: 'Tester', appearance: { skin: '#f8d8b8', hair: '#3a2818', hairStyle: 'cap', top: '#3070d0', bottom: '#3a4a6a', hat: '#d04040' } });
    const S = MB.state;
    S.starter = 'emberfox';
    for (const [k, l, extra] of o.party || [['infernyx', 40, { item: 'infernyx_stone' }]]) S.party.push(MB.Mon.create(k, l, Object.assign({ ot: S.trainerId }, extra || {})));
    Object.assign(S.keyItems, { aetherdex: true, town_map: true, running_shoes: true, aether_gauntlet: true }, o.keys || {});
    Object.assign(S.bag, { basic_capsule: 10, great_capsule: 5, potion: 5, super_potion: 3 }, o.bag || {});
    Object.assign(S.flags, o.flags || {});
    S.map = o.map || 'route1';
    startOverworld();
    const m = MB.World.get(S.map);
    const p = o.pos || (m.exits[0] ? m.exits[0].inner : [5, 5]);
    S.px = p[0]; S.py = p[1];
    MB.Over.onEnterMap(true);
    return S;
  };

  // ---------------- main loop ----------------
  let last = performance.now();
  function frame(now) {
    let dt = (now - last) / 1000; last = now;
    if (dt > 0.05) dt = 0.05;
    if (dt < 0) dt = 0;
    try {
      MB.Game.tickTimers(dt);
      MB.Game.update(dt);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(scale, 0, 0, scale, offX, offY);
      ctx.imageSmoothingEnabled = false;
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, MB.W, MB.H); ctx.clip();
      MB.Game.draw(ctx);
      MB.drawToasts(ctx, dt);
      ctx.restore();
    } catch (e) { console.error(e); MB.lastError = e; }
    MB.input.endFrame(dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  // hide the loading overlay
  const ld = document.getElementById('loading'); if (ld) ld.remove();
  boot();
  window.addEventListener('beforeunload', () => { if (MB.state && MB.state.slot !== undefined && MB.state.settings.autosave !== false && MB.Over) MB.Save.save(MB.state.slot); });
})();
