// Front-end screens: main menu, new campaign, quick battle, settings, help.
(function () {
  const RW = window.RW;
  const U = RW.util;
  const D = RW.data;
  const ui = RW.ui;

  // Slowly orbiting campaign map behind the menus.
  class MenuScene {
    constructor() {
      const demo = RW.Campaign.create(U.pick(D.PLAYABLE), 'normal');
      // Paint a few random territories for variety.
      for (const t of demo.territories) if (t.owner === 'rebels' && Math.random() < 0.5) t.owner = U.pick(D.PLAYABLE);
      this.view = new RW.CampaignView(demo);
      this.scene = this.view.scene;
      this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.5, 600);
      this.t = Math.random() * 10;
    }
    update(dt) {
      this.t += dt * 0.04;
      const c = this.view.center;
      this.camera.position.set(c.x + Math.sin(this.t) * 55, 38, c.z + Math.cos(this.t) * 45);
      this.camera.lookAt(c.x, 0, c.z);
      this.view.update(dt);
    }
    resize() { this.camera.aspect = window.innerWidth / window.innerHeight; this.camera.updateProjectionMatrix(); }
    dispose() { this.view.dispose(); }
  }
  RW.MenuScene = MenuScene;

  const menus = {
    main() {
      const app = RW.app;
      if (!(app.scene instanceof MenuScene)) app.setScene(new MenuScene());
      ui.setHud(null);
      ui.closeModal();
      const hasSave = RW.Campaign.hasSave();
      const el = ui.show(`<div class="screen menu-main">
        <div class="title-block">
          <div class="crest">${D.EMBLEMS.valor()}${D.EMBLEMS.horde()}${D.EMBLEMS.arcane()}</div>
          <h1>Realms of War</h1>
          <div class="tagline">A fantasy war of three kingdoms</div>
        </div>
        <div class="menu-buttons">
          ${hasSave ? '<button class="btn big primary m-continue">Continue Campaign</button>' : ''}
          <button class="btn big ${hasSave ? '' : 'primary'} m-new">New Campaign</button>
          <button class="btn big m-quick">Quick Battle</button>
          <button class="btn big m-help">How to Play</button>
          <button class="btn big m-settings">Settings</button>
        </div>
        <div class="foot">Original game · runs entirely in your browser · progress saved locally</div>
      </div>`);
      const cont = el.querySelector('.m-continue');
      if (cont) cont.onclick = () => app.continueCampaign();
      el.querySelector('.m-new').onclick = () => menus.newCampaign();
      el.querySelector('.m-quick').onclick = () => menus.quickBattle();
      el.querySelector('.m-help').onclick = () => menus.help(() => menus.main());
      el.querySelector('.m-settings').onclick = () => menus.settings(() => menus.main());
      RW.audio.music('campaign');
    },

    newCampaign() {
      let fid = 'valor', diff = RW.settings.difficulty || 'normal', cmdIdx = 0;
      let cands = [];
      const el = ui.show(`<div class="screen menu-new">
        <h2>Choose Your Faction</h2>
        <div class="factions"></div>
        <div class="setup-row">
          <div class="panel setup-cmd"><h3>Commander</h3><div class="cmds"></div><button class="btn sm reroll">↻ Other candidates</button></div>
          <div class="panel setup-diff"><h3>Difficulty</h3><div class="diffs">
            <button class="btn diff" data-d="easy" data-tip="Enemies are cautious, react slowly and earn less gold. You earn +15% gold.">Easy</button>
            <button class="btn diff" data-d="normal" data-tip="Challenging but fair. Enemies flank, skirmish and use abilities sensibly.">Normal</button>
            <button class="btn diff" data-d="hard" data-tip="Smarter enemies: focus fire, cavalry cycle-charges, better spell timing and campaign planning, slightly richer AI.">Hard</button>
          </div><p class="dim diff-desc"></p></div>
        </div>
        <div class="setup-buttons"><button class="btn back">Back</button><button class="btn primary big start">Begin Campaign</button></div>
      </div>`);
      const fbox = el.querySelector('.factions');
      for (const f of D.PLAYABLE) {
        const fd = D.FACTIONS[f];
        const card = U.html(`<div class="fcard choice" data-f="${f}" style="--fc:${fd.color}">
          <div class="fc-head">${ui.emblem(f, 64)}<h3>${fd.name}</h3></div>
          <p>${fd.desc}</p>
          <div class="fc-good">▲ ${fd.strengths}</div><div class="fc-bad">▼ ${fd.weaknesses}</div>
          <div class="fc-bonus"><b>${fd.bonus.name}:</b> ${fd.bonus.desc}</div>
          <div class="fc-abil">${fd.abilities.map((a) => `<span class="has-tip" data-ab="${a}">${RW.icon(D.ABILITIES[a].icon)} ${D.ABILITIES[a].name}</span>`).join('')}</div>
          <div class="fc-army">${fd.startArmy.map((u) => `<span class="has-tip" data-u="${u}">${RW.unitIcon(u)}</span>`).join('')}</div>
        </div>`);
        card.querySelectorAll('[data-u]').forEach((s) => (s._tip = () => ui.unitTip(s.dataset.u)));
        card.querySelectorAll('[data-ab]').forEach((s) => (s._tip = () => ui.abilityTip(s.dataset.ab)));
        card.onclick = () => { fid = f; rollCmds(); refresh(); };
        fbox.appendChild(card);
      }
      const rollCmds = () => {
        cands = [];
        const traits = U.shuffle(D.FACTION_TRAITS[fid].slice());
        for (let i = 0; i < 3; i++) { const c = RW.randomCommander(fid, cands.map((x) => x.name)); c.trait = traits[i]; cands.push(c); }
        cmdIdx = 0;
      };
      const refresh = () => {
        el.querySelectorAll('.fcard').forEach((c) => c.classList.toggle('on', c.dataset.f === fid));
        el.querySelector('.cmds').innerHTML = cands.map((c, i) => `<div class="choice cmd ${i === cmdIdx ? 'on' : ''}" data-i="${i}"><b>${U.escape(c.name)}</b><span class="trait">${D.TRAITS[c.trait].name}</span><p>${D.TRAITS[c.trait].desc}</p></div>`).join('');
        el.querySelectorAll('.cmd').forEach((c) => (c.onclick = () => { cmdIdx = +c.dataset.i; refresh(); }));
        el.querySelectorAll('.diff').forEach((b) => b.classList.toggle('on', b.dataset.d === diff));
        el.querySelector('.diff-desc').textContent = { easy: 'For learning the ropes.', normal: 'The intended experience.', hard: 'For veteran generals.' }[diff];
      };
      el.querySelectorAll('.diff').forEach((b) => (b.onclick = () => { diff = b.dataset.d; refresh(); }));
      el.querySelector('.reroll').onclick = () => { rollCmds(); refresh(); };
      el.querySelector('.back').onclick = () => menus.main();
      el.querySelector('.start').onclick = () => {
        const go = () => { RW.settings.difficulty = diff; RW.saveSettings(); RW.app.startCampaign(RW.Campaign.create(fid, diff, cands[cmdIdx])); };
        if (RW.Campaign.hasSave()) ui.modal({ title: 'Overwrite Save?', body: '<p>Starting a new campaign will replace your saved campaign.</p>', buttons: [{ label: 'Start New', cls: 'danger', onClick: go }, { label: 'Cancel' }] });
        else go();
      };
      rollCmds(); refresh();
    },

    quickBattle() {
      const st = { mine: 'valor', foe: 'horde', map: 'grassland', budget: 7000, diff: RW.settings.difficulty || 'normal', defend: false, army: [], trait: null };
      const el = ui.show(`<div class="screen menu-quick">
        <h2>Quick Battle</h2>
        <div class="q-grid">
          <div class="panel q-opts">
            <label>Your faction</label><div class="seg q-mine"></div>
            <label>Enemy faction</label><div class="seg q-foe"></div>
            <label>Battlefield</label><div class="seg q-map"></div>
            <label>Funds per side</label><div class="seg q-budget"></div>
            <label>Difficulty</label><div class="seg q-diff"></div>
            <label class="q-siege-l">Siege role</label><div class="seg q-siege"></div>
          </div>
          <div class="panel q-roster"><h3>Recruit <span class="q-left"></span></h3><div class="q-units"></div></div>
          <div class="panel q-army"><h3>Your Army <span class="q-count"></span></h3><div class="q-list"></div>
            <div class="q-army-btns"><button class="btn sm q-rand">Randomise</button><button class="btn sm q-clear">Clear</button></div>
            <p class="dim">Your general's bodyguard is always included. The enemy army is randomised with the same funds.</p></div>
        </div>
        <div class="setup-buttons"><button class="btn back">Back</button><button class="btn primary big q-go">Fight!</button></div>
      </div>`);
      const seg = (sel, opts, key, after) => {
        const box = el.querySelector(sel);
        box.innerHTML = opts.map(([v, label, tip]) => `<button class="btn sm" data-v="${v}" ${tip ? `data-tip="${tip}"` : ''}>${label}</button>`).join('');
        box.querySelectorAll('button').forEach((b) => (b.onclick = () => { st[key] = isNaN(+b.dataset.v) ? (b.dataset.v === 'true' ? true : b.dataset.v === 'false' ? false : b.dataset.v) : +b.dataset.v; if (after) after(); refresh(); }));
      };
      const facOpts = D.PLAYABLE.map((f) => [f, `${ui.emblem(f, 18)} ${D.FACTIONS[f].short}`]);
      seg('.q-mine', facOpts, 'mine', () => { st.army = []; });
      seg('.q-foe', facOpts, 'foe');
      seg('.q-map', Object.entries(D.BATTLE_MAPS).map(([k, m]) => [k, m.name, m.desc]), 'map');
      seg('.q-budget', [[4000, 'Small (4,000)'], [7000, 'Medium (7,000)'], [11000, 'Large (11,000)']], 'budget', () => trim());
      seg('.q-diff', [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']], 'diff');
      seg('.q-siege', [['false', 'Attack the walls'], ['true', 'Defend the walls']], 'defend');
      const spent = () => st.army.reduce((s, id) => s + D.UNITS[id].cost, 0);
      const trim = () => { while (spent() > st.budget) st.army.pop(); };
      const refresh = () => {
        for (const [sel, key] of [['.q-mine', 'mine'], ['.q-foe', 'foe'], ['.q-map', 'map'], ['.q-budget', 'budget'], ['.q-diff', 'diff'], ['.q-siege', 'defend']]) {
          el.querySelectorAll(sel + ' button').forEach((b) => b.classList.toggle('on', String(st[key]) === b.dataset.v));
        }
        el.querySelector('.q-siege').style.display = el.querySelector('.q-siege-l').style.display = st.map === 'siege' ? '' : 'none';
        const left = st.budget - spent();
        el.querySelector('.q-left').innerHTML = `${RW.icon('gold', 'gold')} ${U.fmt(left)} left`;
        el.querySelector('.q-count').textContent = `${st.army.length}/12`;
        const roster = Object.values(D.UNITS).filter((u) => u.faction === st.mine && u.recruitable);
        const ub = el.querySelector('.q-units');
        ub.innerHTML = roster.map((u) => `<button class="rbtn" data-id="${u.id}" ${u.cost > left || st.army.length >= 12 ? 'disabled' : ''}>${RW.unitIcon(u.id)}<span class="rn">${u.name}</span><span class="rc">${u.cost}</span></button>`).join('');
        ub.querySelectorAll('.rbtn').forEach((b) => { b._tip = () => ui.unitTip(b.dataset.id); b.onclick = () => { st.army.push(b.dataset.id); RW.audio.play('coin'); refresh(); }; });
        const lb = el.querySelector('.q-list');
        lb.innerHTML = `<div class="qa gen">${RW.unitIcon(D.FACTIONS[st.mine].general)} ${D.UNITS[D.FACTIONS[st.mine].general].name}</div>` + st.army.map((id, i) => `<div class="qa" data-i="${i}">${RW.unitIcon(id)} ${D.UNITS[id].name}<span class="x">×</span></div>`).join('');
        lb.querySelectorAll('.qa[data-i]').forEach((d) => { d._tip = () => ui.unitTip(st.army[+d.dataset.i]); d.onclick = () => { st.army.splice(+d.dataset.i, 1); refresh(); }; });
      };
      el.querySelector('.q-rand').onclick = () => { st.army = D.genArmy(st.mine, st.budget, 3, 12); refresh(); };
      el.querySelector('.q-clear').onclick = () => { st.army = []; refresh(); };
      el.querySelector('.back').onclick = () => menus.main();
      el.querySelector('.q-go').onclick = () => {
        if (!st.army.length) st.army = D.genArmy(st.mine, st.budget, 3, 12);
        const foeArmy = D.genArmy(st.foe, st.budget, 3, 12);
        const attackerSide = st.map === 'siege' && st.defend ? 1 : 0;
        const cfg = {
          mapType: st.map, seed: Math.floor(Math.random() * 1e9), attackerSide, difficulty: st.diff, quick: true,
          sides: [
            { faction: st.mine, isPlayer: true, units: st.army.map((typeId) => ({ typeId })), commander: RW.randomCommander(st.mine) },
            { faction: st.foe, units: foeArmy.map((typeId) => ({ typeId })), commander: RW.randomCommander(st.foe) },
          ],
        };
        // The enemy commander's trait is visible in the battle tooltip.
        RW.app.startQuickBattle(cfg);
      };
      st.army = D.genArmy(st.mine, st.budget, 3, 12);
      refresh();
    },

    settings(back) {
      const s = RW.settings;
      const body = U.html(`<div class="settings">
        <label>Graphics quality</label><div class="seg g-q">${['low', 'medium', 'high'].map((q) => `<button class="btn sm ${s.quality === q ? 'on' : ''}" data-v="${q}">${q[0].toUpperCase() + q.slice(1)}</button>`).join('')}</div>
        <p class="dim">Low disables shadows and reduces detail for older laptops. Terrain/tree detail applies to the next map loaded.</p>
        <label>Master volume <span class="v-vol">${Math.round(s.volume * 100)}%</span></label><input type="range" min="0" max="1" step="0.05" value="${s.volume}" class="s-vol">
        <label class="chk"><input type="checkbox" class="s-music" ${s.music ? 'checked' : ''}> Music</label>
        <label class="chk"><input type="checkbox" class="s-sfx" ${s.sfx ? 'checked' : ''}> Sound effects</label>
        <label>Camera sensitivity <span class="v-cam">${s.camSens.toFixed(1)}×</span></label><input type="range" min="0.3" max="2.5" step="0.1" value="${s.camSens}" class="s-cam">
        <label class="chk"><input type="checkbox" class="s-edge" ${s.edgeScroll ? 'checked' : ''}> Edge-of-screen scrolling</label>
        <label class="chk"><input type="checkbox" class="s-tips" ${s.tooltips ? 'checked' : ''}> Show tooltips</label>
      </div>`);
      body.querySelectorAll('.g-q button').forEach((b) => (b.onclick = () => { s.quality = b.dataset.v; body.querySelectorAll('.g-q button').forEach((x) => x.classList.toggle('on', x === b)); RW.saveSettings(); }));
      body.querySelector('.s-vol').oninput = (e) => { s.volume = +e.target.value; body.querySelector('.v-vol').textContent = Math.round(s.volume * 100) + '%'; RW.saveSettings(); };
      body.querySelector('.s-cam').oninput = (e) => { s.camSens = +e.target.value; body.querySelector('.v-cam').textContent = s.camSens.toFixed(1) + '×'; RW.saveSettings(); };
      body.querySelector('.s-music').onchange = (e) => { s.music = e.target.checked; RW.saveSettings(); };
      body.querySelector('.s-sfx').onchange = (e) => { s.sfx = e.target.checked; RW.saveSettings(); };
      body.querySelector('.s-edge').onchange = (e) => { s.edgeScroll = e.target.checked; RW.saveSettings(); };
      body.querySelector('.s-tips').onchange = (e) => { s.tooltips = e.target.checked; RW.saveSettings(); };
      ui.modal({ title: 'Settings', body, buttons: [{ label: 'Done', cls: 'primary', onClick: () => { RW.audio.play('click'); if (back) back(); } }] });
    },

    help(back) {
      ui.modal({ title: 'How to Play', cls: 'wide help', body: `
        <div class="help-cols"><div>
        <h3>The Campaign</h3>
        <ul>
          <li><b>Select</b> a territory or army with left-click. <b>Right-click</b> a neighbouring territory to march there — or attack it if it is held by someone else.</li>
          <li>Each army moves once per turn (twice with the <i>Swift Marcher</i> trait). Armies hold up to <b>12 units</b> plus the commander's bodyguard.</li>
          <li><b>Recruit</b> in your own settlements. Each settlement has limited recruitment slots per turn; upgrade it to unlock stronger units.</li>
          <li><b>Income</b> comes from territories; <b>upkeep</b> is paid for every unit. Build <b>Markets</b> for gold, <b>Barracks</b> for cheaper veteran recruits, <b>Walls</b> to force sieges.</li>
          <li>Win battles to unlock <b>Armoury</b> upgrades. Commanders and units gain experience.</li>
          <li>Win by <b>Conquest</b> (12 territories), <b>Decapitation</b> (both rival capitals), holding the <b>Ancient Shrines</b> for 5 turns, or a <b>Golden Age</b> treasury.</li>
          <li>Damaged units recover each turn, faster in friendly settlements.</li>
        </ul>
        <h3>Strategy Tips</h3>
        <ul>
          <li>Hit enemies in the <b>flank or rear</b>: big damage and morale penalties.</li>
          <li>Cavalry charges are devastating — but spears and halberds in front stop them.</li>
          <li>Archers on <b>hills</b> shoot further. Units in <b>forests</b> are hidden and hard to hit.</li>
          <li>Kill the enemy <b>general</b> to shake their whole army.</li>
        </ul>
        </div><div>
        <h3>Battle Controls</h3>
        <table class="keys">
          <tr><td>Left-click / drag box</td><td>Select units (Shift adds)</td></tr>
          <tr><td>Right-click ground</td><td>Move</td></tr>
          <tr><td>Right-click enemy</td><td>Attack</td></tr>
          <tr><td>Right-drag</td><td>Move into a line with a facing</td></tr>
          <tr><td>WASD / arrows / screen edge</td><td>Pan camera</td></tr>
          <tr><td>Q / E · Middle-drag · Alt+drag</td><td>Rotate camera</td></tr>
          <tr><td>Mouse wheel · R / F</td><td>Zoom (zoom out to see everything)</td></tr>
          <tr><td>Space</td><td>Pause (orders still work)</td></tr>
          <tr><td>1 / 2 / 3</td><td>Game speed</td></tr>
          <tr><td>T / Y / U</td><td>Line / Defensive / Loose formation</td></tr>
          <tr><td>G · H</td><td>Hold position · Halt</td></tr>
          <tr><td>Z / X / C</td><td>Commander abilities</td></tr>
          <tr><td>Ctrl+A · Esc</td><td>Select all · Deselect / menu</td></tr>
          <tr><td>Double-click card</td><td>Focus camera on unit</td></tr>
        </table>
        <h3>Morale</h3>
        <p>Units lose morale from casualties, being flanked or surrounded, terrifying monsters, nearby routing allies, and their general's death. Broken units flee and may rally later; units that break too often are shattered.</p>
        </div></div>`, buttons: [{ label: 'Close', cls: 'primary', onClick: () => { if (back) back(); } }] });
    },
  };
  RW.menus = menus;
})();
