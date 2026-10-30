// Front-end screens: main menu, new campaign (Classic / Greater Realm / Conquest), load game, quick & custom battle,
// survival, encyclopedia, settings, help.
(function () {
  const RW = window.RW;
  const U = RW.util;
  const D = RW.data;
  const ui = RW.ui;
  const SURVIVAL_KEY = 'realmsOfWar.survivalBest';
  const MODES = {
    classic: { name: 'Classic Campaign', desc: 'The original war of the Three Realms: 16 territories, three great powers. Unchanged rules.' },
    grand: { name: 'The Greater Realm', desc: '28 territories, six factions, diplomacy, technology, landmarks and ruins to explore.' },
    conquest: { name: 'Conquest', desc: 'Greater Realm with a tiny start: one village and a warband (but a fuller purse). Conquer the whole world.' },
  };

  // Slowly orbiting campaign map behind the menus.
  class MenuScene {
    constructor() {
      const demo = RW.Campaign.create(U.pick(D.PLAYABLE), 'normal', null, { mode: 'grand' });
      // Paint a few random territories for variety.
      for (const t of demo.territories) if (t.owner === 'rebels' && Math.random() < 0.5) t.owner = U.pick(demo.majors);
      this.view = new RW.CampaignView(demo);
      this.scene = this.view.scene;
      this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.5, 600);
      this.t = Math.random() * 10;
    }
    update(dt) {
      this.t += dt * 0.04;
      const c = this.view.center;
      this.camera.position.set(c.x + Math.sin(this.t) * 70, 46, c.z + Math.cos(this.t) * 55);
      this.camera.lookAt(c.x, 0, c.z);
      this.view.update(dt);
    }
    resize() { this.camera.aspect = window.innerWidth / window.innerHeight; this.camera.updateProjectionMatrix(); }
    dispose() { this.view.dispose(); }
  }
  RW.MenuScene = MenuScene;
  function backdrop() { if (!(RW.app.scene instanceof MenuScene)) RW.app.setScene(new MenuScene()); ui.setHud(null); }

  // Commander choice list shared by campaign setup and battles: random commanders plus the faction's legends.
  function legendsOf(f) { return Object.values(D.LEGENDS).filter((l) => l.faction === f); }
  function legendCard(L, on) {
    return `<div class="choice cmd legend ${on ? 'on' : ''}" data-l="${L.id}"><b>${L.name}</b><span class="trait legend">Legendary · ${L.title}</span>
      <p><b>${L.passive.name}:</b> ${L.passive.desc}</p><p class="dim">${L.abilities.map((a) => a.name).join(' · ')} · ${L.start.desc}</p></div>`;
  }

  const menus = {
    main() {
      const app = RW.app;
      backdrop();
      ui.closeModal();
      const saves = RW.Campaign.listSaves();
      const hasSave = saves.some((s) => !s.over);
      const el = ui.show(`<div class="screen menu-main">
        <div class="title-block">
          <div class="crest">${D.PLAYABLE.map((f) => D.EMBLEMS[f]()).join('')}</div>
          <h1>Realms of War</h1>
          <div class="tagline">A fantasy war of six kingdoms</div>
        </div>
        <div class="menu-buttons">
          ${hasSave ? '<button class="btn big primary m-continue">Continue Campaign</button>' : ''}
          <button class="btn big ${hasSave ? '' : 'primary'} m-new">New Campaign</button>
          ${saves.length ? '<button class="btn big m-load">Load Game</button>' : ''}
          <div class="menu-row"><button class="btn m-quick">Quick Battle</button><button class="btn m-custom">Custom Battle</button><button class="btn m-surv">Survival</button></div>
          <div class="menu-row"><button class="btn m-enc">Encyclopedia</button><button class="btn m-help">How to Play</button><button class="btn m-settings">Settings</button></div>
        </div>
        <div class="foot">Original game · runs entirely in your browser · progress saved locally</div>
      </div>`);
      const cont = el.querySelector('.m-continue');
      if (cont) cont.onclick = () => app.continueCampaign();
      const load = el.querySelector('.m-load');
      if (load) load.onclick = () => menus.load();
      el.querySelector('.m-new').onclick = () => menus.newCampaign();
      el.querySelector('.m-quick').onclick = () => menus.quickBattle(false);
      el.querySelector('.m-custom').onclick = () => menus.quickBattle(true);
      el.querySelector('.m-surv').onclick = () => menus.survival();
      el.querySelector('.m-enc').onclick = () => menus.encyclopedia(() => menus.main());
      el.querySelector('.m-help').onclick = () => menus.help(() => menus.main());
      el.querySelector('.m-settings').onclick = () => menus.settings(() => menus.main());
      RW.audio.music('campaign');
    },

    load() {
      const saves = RW.Campaign.listSaves();
      const slotName = (s) => (s === 'auto' ? 'Autosave' : s === 'legacy' ? 'Older save' : 'Slot ' + s);
      const body = U.html(`<div class="slots">${saves.map((sv) => `<div class="slot-row"><div>${ui.emblem(sv.player, 26)} <b>${slotName(sv.slot)}</b> — ${D.FACTIONS[sv.player].name} · ${MODES[sv.mode] ? MODES[sv.mode].name : sv.mode} · Turn ${sv.turn} · ${sv.difficulty}${sv.over ? ` · <span class="dim">${sv.over.result}</span>` : ''}<br><span class="dim">${sv.savedAt ? new Date(sv.savedAt).toLocaleString() : ''}</span></div>
        <div><button class="btn sm primary ld" data-s="${sv.slot}" ${sv.over ? 'disabled' : ''}>Load</button><button class="btn sm danger del" data-s="${sv.slot}">Delete</button></div></div>`).join('') || '<p class="dim">No saved games.</p>'}</div>`);
      body.querySelectorAll('.ld').forEach((b) => (b.onclick = () => {
        const c = RW.Campaign.load(b.dataset.s);
        if (!c) { ui.toast('That save could not be loaded.', 'bad'); return; }
        RW.app.startCampaign(c);
      }));
      body.querySelectorAll('.del').forEach((b) => (b.onclick = () => { RW.Campaign.deleteSave(b.dataset.s); ui.closeModal(); menus.main(); menus.load(); }));
      ui.modal({ title: 'Load Game', cls: 'wide', body, buttons: [{ label: 'Back' }] });
    },

    newCampaign() {
      let mode = 'classic', fid = 'valor', diff = RW.settings.difficulty || 'normal', cmdIdx = 0, legend = null;
      let cands = [];
      const el = ui.show(`<div class="screen menu-new">
        <h2>New Campaign</h2>
        <div class="modes">${Object.entries(MODES).map(([k, m]) => `<div class="choice mode" data-m="${k}"><b>${m.name}</b><p>${m.desc}</p></div>`).join('')}</div>
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
      const buildCards = () => {
        fbox.innerHTML = '';
        const list = mode === 'classic' ? D.CLASSIC : D.PLAYABLE;
        if (!list.includes(fid)) fid = list[0];
        fbox.classList.toggle('six', list.length > 3);
        for (const f of list) {
          const fd = D.FACTIONS[f];
          const card = U.html(`<div class="fcard choice" data-f="${f}" style="--fc:${fd.color}">
            <div class="fc-head">${ui.emblem(f, 56)}<h3>${fd.name}</h3></div>
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
      };
      const rollCmds = () => {
        cands = [];
        legend = null;
        const traits = U.shuffle(D.FACTION_TRAITS[fid].slice());
        for (let i = 0; i < 3; i++) { const c = RW.randomCommander(fid, cands.map((x) => x.name)); c.trait = traits[i % traits.length]; cands.push(c); }
        cmdIdx = 0;
      };
      const refresh = () => {
        el.querySelectorAll('.mode').forEach((m) => m.classList.toggle('on', m.dataset.m === mode));
        el.querySelectorAll('.fcard').forEach((c) => c.classList.toggle('on', c.dataset.f === fid));
        el.querySelector('.cmds').innerHTML = cands.map((c, i) => `<div class="choice cmd ${!legend && i === cmdIdx ? 'on' : ''}" data-i="${i}"><b>${U.escape(c.name)}</b><span class="trait">${D.TRAITS[c.trait].name}</span><p>${D.TRAITS[c.trait].desc}</p></div>`).join('')
          + legendsOf(fid).map((L) => legendCard(L, legend === L.id)).join('');
        el.querySelectorAll('.cmd[data-i]').forEach((c) => (c.onclick = () => { cmdIdx = +c.dataset.i; legend = null; refresh(); }));
        el.querySelectorAll('.cmd[data-l]').forEach((c) => { c.onclick = () => { legend = c.dataset.l; refresh(); }; c.setAttribute('data-tip', U.escape(D.LEGENDS[c.dataset.l].story)); });
        el.querySelectorAll('.diff').forEach((b) => b.classList.toggle('on', b.dataset.d === diff));
        el.querySelector('.diff-desc').textContent = { easy: 'For learning the ropes.', normal: 'The intended experience.', hard: 'For veteran generals.' }[diff];
      };
      el.querySelectorAll('.mode').forEach((m) => (m.onclick = () => { mode = m.dataset.m; buildCards(); rollCmds(); refresh(); }));
      el.querySelectorAll('.diff').forEach((b) => (b.onclick = () => { diff = b.dataset.d; refresh(); }));
      el.querySelector('.reroll').onclick = () => { rollCmds(); refresh(); };
      el.querySelector('.back').onclick = () => menus.main();
      el.querySelector('.start').onclick = () => {
        const go = () => { RW.settings.difficulty = diff; RW.saveSettings(); RW.app.startCampaign(RW.Campaign.create(fid, diff, cands[cmdIdx], { mode, legend })); };
        const auto = RW.Campaign.listSaves().find((s) => s.slot === 'auto' && !s.over);
        if (auto) ui.modal({ title: 'Overwrite Autosave?', body: '<p>Starting a new campaign replaces the autosave. Campaigns saved to numbered slots are kept.</p>', buttons: [{ label: 'Start New', cls: 'danger', onClick: go }, { label: 'Cancel' }] });
        else go();
      };
      buildCards(); rollCmds(); refresh();
    },

    // Quick battle: pick your army, the enemy is random. Custom battle: pick both armies, factions, weather and commanders.
    quickBattle(custom = false) {
      backdrop();
      const st = { mine: 'valor', foe: 'horde', map: 'grassland', budget: 7000, diff: RW.settings.difficulty || 'normal', defend: false, armies: { mine: [], foe: [] }, edit: 'mine', weather: 'auto', leg: { mine: null, foe: null } };
      const el = ui.show(`<div class="screen menu-quick">
        <h2>${custom ? 'Custom Battle' : 'Quick Battle'}</h2>
        <div class="q-grid">
          <div class="panel q-opts">
            <label>Your faction</label><div class="seg q-mine"></div>
            <label>Enemy faction</label><div class="seg q-foe"></div>
            <label>Battlefield</label><div class="seg q-map"></div>
            ${custom ? '<label>Weather</label><div class="seg q-weather"></div>' : ''}
            <label>Funds per side</label><div class="seg q-budget"></div>
            <label>Difficulty</label><div class="seg q-diff"></div>
            <label class="q-siege-l">Siege role</label><div class="seg q-siege"></div>
          </div>
          <div class="panel q-roster">${custom ? '<div class="seg q-edit"></div><label>Commander</label><div class="seg q-leg"></div>' : ''}<h3>Recruit <span class="q-left"></span></h3><div class="q-units"></div></div>
          <div class="panel q-army"><h3><span class="q-who">Your Army</span> <span class="q-count"></span></h3><div class="q-list"></div>
            <div class="q-army-btns"><button class="btn sm q-rand">Randomise</button><button class="btn sm q-clear">Clear</button></div>
            <p class="dim">${custom ? 'Build both armies. Each general\'s bodyguard is always included.' : 'Your general\'s bodyguard is always included. The enemy army is randomised with the same funds.'}</p></div>
        </div>
        <div class="setup-buttons"><button class="btn back">Back</button><button class="btn primary big q-go">Fight!</button></div>
      </div>`);
      const seg = (sel, opts, key, after) => {
        const box = el.querySelector(sel);
        if (!box) return;
        box.innerHTML = opts.map(([v, label, tip]) => `<button class="btn sm" data-v="${v}" ${tip ? `data-tip="${tip}"` : ''}>${label}</button>`).join('');
        box.querySelectorAll('button').forEach((b) => (b.onclick = () => { st[key] = isNaN(+b.dataset.v) ? (b.dataset.v === 'true' ? true : b.dataset.v === 'false' ? false : b.dataset.v) : +b.dataset.v; if (after) after(); refresh(); }));
      };
      const facOpts = D.PLAYABLE.map((f) => [f, `${ui.emblem(f, 18)} ${D.FACTIONS[f].short}`]);
      seg('.q-mine', facOpts, 'mine', () => { st.armies.mine = []; st.leg.mine = null; });
      seg('.q-foe', facOpts, 'foe', () => { st.armies.foe = []; st.leg.foe = null; });
      seg('.q-map', Object.entries(D.BATTLE_MAPS).map(([k, m]) => [k, m.name, m.desc]), 'map');
      seg('.q-weather', [['auto', 'Random']].concat(Object.entries(D.WEATHER).map(([k, w]) => [k, w.name, w.desc])), 'weather');
      seg('.q-budget', [[4000, 'Small (4,000)'], [7000, 'Medium (7,000)'], [11000, 'Large (11,000)']], 'budget', () => trim());
      seg('.q-diff', [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']], 'diff');
      seg('.q-siege', [['false', 'Attack the walls'], ['true', 'Defend the walls']], 'defend');
      seg('.q-edit', [['mine', 'Edit your army'], ['foe', 'Edit enemy army']], 'edit');
      const fac = () => st[st.edit];
      const army = () => st.armies[st.edit];
      const spent = (k = st.edit) => st.armies[k].reduce((s, id) => s + D.UNITS[id].cost, 0);
      const trim = () => { for (const k of ['mine', 'foe']) while (spent(k) > st.budget) st.armies[k].pop(); };
      const refresh = () => {
        if (!custom) st.edit = 'mine';
        for (const [sel, key] of [['.q-mine', 'mine'], ['.q-foe', 'foe'], ['.q-map', 'map'], ['.q-budget', 'budget'], ['.q-diff', 'diff'], ['.q-siege', 'defend'], ['.q-weather', 'weather'], ['.q-edit', 'edit']]) {
          el.querySelectorAll(sel + ' button').forEach((b) => b.classList.toggle('on', String(st[key]) === b.dataset.v));
        }
        el.querySelector('.q-siege').style.display = el.querySelector('.q-siege-l').style.display = st.map === 'siege' ? '' : 'none';
        const legBox = el.querySelector('.q-leg');
        if (legBox) {
          legBox.innerHTML = `<button class="btn sm ${!st.leg[st.edit] ? 'on' : ''}" data-l="">Captain</button>` + legendsOf(fac()).map((L) => `<button class="btn sm ${st.leg[st.edit] === L.id ? 'on' : ''}" data-l="${L.id}" data-tip="<b>${L.title}</b><br>${L.passive.name}: ${L.passive.desc}<br>${L.abilities.map((a) => a.name).join(' · ')}">${L.name}</button>`).join('');
          legBox.querySelectorAll('button').forEach((b) => (b.onclick = () => { st.leg[st.edit] = b.dataset.l || null; refresh(); }));
        }
        const left = st.budget - spent();
        el.querySelector('.q-left').innerHTML = `${RW.icon('gold', 'gold')} ${U.fmt(left)} left`;
        el.querySelector('.q-count').textContent = `${army().length}/12`;
        el.querySelector('.q-who').textContent = st.edit === 'mine' ? 'Your Army' : 'Enemy Army';
        const roster = Object.values(D.UNITS).filter((u) => u.faction === fac() && u.recruitable);
        const ub = el.querySelector('.q-units');
        ub.innerHTML = roster.map((u) => `<button class="rbtn ${u.rare ? 'rare' : ''}" data-id="${u.id}" ${u.cost > left || army().length >= 12 ? 'disabled' : ''}>${RW.unitIcon(u.id)}<span class="rn">${u.name}</span><span class="rc">${u.cost}</span></button>`).join('');
        ub.querySelectorAll('.rbtn').forEach((b) => { b._tip = () => ui.unitTip(b.dataset.id); b.onclick = () => { army().push(b.dataset.id); RW.audio.play('coin'); refresh(); }; });
        const lb = el.querySelector('.q-list');
        const gen = st.leg[st.edit] ? 'legend_' + st.leg[st.edit] : D.FACTIONS[fac()].general;
        lb.innerHTML = `<div class="qa gen">${RW.unitIcon(gen)} ${D.UNITS[gen].name}</div>` + army().map((id, i) => `<div class="qa" data-i="${i}">${RW.unitIcon(id)} ${D.UNITS[id].name}<span class="x">×</span></div>`).join('');
        lb.querySelectorAll('.qa[data-i]').forEach((d) => { d._tip = () => ui.unitTip(army()[+d.dataset.i]); d.onclick = () => { army().splice(+d.dataset.i, 1); refresh(); }; });
      };
      el.querySelector('.q-rand').onclick = () => { st.armies[st.edit] = D.genArmy(fac(), st.budget, 3, 12); refresh(); };
      el.querySelector('.q-clear').onclick = () => { st.armies[st.edit] = []; refresh(); };
      el.querySelector('.back').onclick = () => menus.main();
      el.querySelector('.q-go').onclick = () => {
        if (!st.armies.mine.length) st.armies.mine = D.genArmy(st.mine, st.budget, 3, 12);
        const foeArmy = custom && st.armies.foe.length ? st.armies.foe : D.genArmy(st.foe, st.budget, 3, 12);
        const attackerSide = st.map === 'siege' && st.defend ? 1 : 0;
        const cmd = (f, l) => (l ? { name: D.LEGENDS[l].name, legend: l, trait: null, level: 1 } : RW.randomCommander(f));
        const cfg = {
          mapType: st.map, seed: Math.floor(Math.random() * 1e9), attackerSide, difficulty: st.diff, quick: true,
          weather: st.weather === 'auto' ? D.weatherFor(st.map) : st.weather,
          sides: [
            { faction: st.mine, isPlayer: true, units: st.armies.mine.map((typeId) => ({ typeId })), commander: cmd(st.mine, st.leg.mine), ultimate: custom },
            { faction: st.foe, units: foeArmy.map((typeId) => ({ typeId })), commander: cmd(st.foe, st.leg.foe), ultimate: custom },
          ],
        };
        RW.app.startQuickBattle(cfg);
      };
      st.armies.mine = D.genArmy(st.mine, st.budget, 3, 12);
      refresh();
    },

    // ---------------------------------------------------------------- Survival: wave after wave with one army.
    survival() {
      backdrop();
      let fid = 'valor', legend = null, diff = RW.settings.difficulty || 'normal';
      const best = (() => { try { return +localStorage.getItem(SURVIVAL_KEY) || 0; } catch (e) { return 0; } })();
      const el = ui.show(`<div class="screen menu-new">
        <h2>Survival</h2>
        <p class="center dim">Hold out against endless waves. Survivors carry over; victories pay gold to recruit and heal between waves. Waves grow stronger, change faction, battlefield and weather. Best: <b>wave ${best}</b></p>
        <div class="factions six"></div>
        <div class="setup-row">
          <div class="panel setup-cmd"><h3>Commander</h3><div class="cmds"></div></div>
          <div class="panel setup-diff"><h3>Difficulty</h3><div class="diffs">${['easy', 'normal', 'hard'].map((d) => `<button class="btn diff" data-d="${d}">${d[0].toUpperCase() + d.slice(1)}</button>`).join('')}</div></div>
        </div>
        <div class="setup-buttons"><button class="btn back">Back</button><button class="btn primary big start">Muster the Army</button></div>
      </div>`);
      const fbox = el.querySelector('.factions');
      for (const f of D.PLAYABLE) {
        const fd = D.FACTIONS[f];
        const card = U.html(`<div class="fcard choice" data-f="${f}" style="--fc:${fd.color}"><div class="fc-head">${ui.emblem(f, 48)}<h3>${fd.name}</h3></div><div class="fc-good">▲ ${fd.strengths}</div></div>`);
        card.onclick = () => { fid = f; legend = null; refresh(); };
        fbox.appendChild(card);
      }
      const refresh = () => {
        el.querySelectorAll('.fcard').forEach((c) => c.classList.toggle('on', c.dataset.f === fid));
        el.querySelector('.cmds').innerHTML = `<div class="choice cmd ${!legend ? 'on' : ''}" data-l=""><b>A seasoned captain</b><p>No special abilities beyond the faction's own.</p></div>` + legendsOf(fid).map((L) => legendCard(L, legend === L.id)).join('');
        el.querySelectorAll('.cmd').forEach((c) => (c.onclick = () => { legend = c.dataset.l || null; refresh(); }));
        el.querySelectorAll('.diff').forEach((b) => b.classList.toggle('on', b.dataset.d === diff));
      };
      el.querySelectorAll('.diff').forEach((b) => (b.onclick = () => { diff = b.dataset.d; refresh(); }));
      el.querySelector('.back').onclick = () => menus.main();
      el.querySelector('.start').onclick = () => {
        const L = legend && D.LEGENDS[legend];
        const run = { faction: fid, diff, wave: 1, gold: 6000 + ((L && L.start.gold) || 0), army: ((L && L.start.units) || []).map((typeId) => ({ typeId, hp: 1, rank: 0, xp: 0 })), cmd: L ? { name: L.name, legend: L.id, trait: null, level: 1, xp: 0 } : RW.randomCommander(fid), kills: 0 };
        run.next = menus.survivalWave(run);
        menus.survivalCamp(run);
      };
      refresh();
    },
    survivalWave(run) {
      const w = run.wave;
      const foes = D.PLAYABLE.filter((f) => f !== run.faction);
      const maps = ['grassland', 'forest', 'hills', 'river', 'pass', 'snow', 'ancientforest', 'volcanic', 'desert', 'courtyard', 'temple'];
      const siege = w % 4 === 0;
      const mapType = siege ? 'siege' : U.pick(maps);
      const foe = U.pick(foes);
      const budget = 3000 + w * 850;
      const units = D.genArmy(foe, budget, Math.min(3, 1 + Math.floor((w + 1) / 2)), Math.min(12, 5 + w));
      // Every fifth wave is led by a legendary commander.
      const legs = legendsOf(foe);
      const boss = w % 5 === 0 && legs.length ? U.pick(legs) : null;
      return { foe, mapType, siege, weather: D.weatherFor(mapType), units, boss, budget };
    },
    survivalCamp(run) {
      backdrop();
      const f = run.faction, nx = run.next;
      const healCost = () => Math.round(run.army.reduce((s, u) => s + (1 - u.hp) * D.UNITS[u.typeId].cost * 0.4, 0));
      const draw = () => {
        const roster = Object.values(D.UNITS).filter((u) => u.faction === f && u.recruitable && (!u.rare || run.wave >= 4));
        const el = ui.show(`<div class="screen menu-quick">
          <h2>Survival — Wave ${run.wave}</h2>
          <div class="q-grid">
            <div class="panel q-opts"><h3>Next wave</h3>
              <p>${ui.emblem(nx.foe, 26)} <b>${D.FACTIONS[nx.foe].name}</b>${nx.boss ? `<br>Led by <b>${nx.boss.name}</b>, ${nx.boss.title}!` : ''}</p>
              <p>Battlefield: <b>${D.BATTLE_MAPS[nx.mapType].name}</b>${nx.siege ? ' — you defend the walls' : ''}<br>Weather: <b>${D.WEATHER[nx.weather].name}</b></p>
              <div class="bp-units">${nx.units.map((id) => `<span class="bpu" data-u="${id}">${RW.unitIcon(id)}</span>`).join('')}</div>
              <p class="dim">${nx.units.length} units · ~${U.fmt(nx.budget)} gold of troops</p>
              <h3>Treasury</h3><p>${RW.icon('gold', 'gold')} <b>${U.fmt(run.gold)}</b></p>
              <button class="btn sm s-heal" ${healCost() <= 0 || run.gold < healCost() ? 'disabled' : ''}>Heal all (${healCost()} gold)</button>
            </div>
            <div class="panel q-roster"><h3>Recruit</h3><div class="q-units">${roster.map((u) => `<button class="rbtn ${u.rare ? 'rare' : ''}" data-id="${u.id}" ${u.cost > run.gold || run.army.length >= 12 ? 'disabled' : ''}>${RW.unitIcon(u.id)}<span class="rn">${u.name}</span><span class="rc">${u.cost}</span></button>`).join('')}</div>
              <p class="dim">Rare units become available from wave 4.</p></div>
            <div class="panel q-army"><h3>Your Army <span>${run.army.length}/12</span></h3><div class="q-list">
              <div class="qa gen">${RW.unitIcon(run.cmd.legend ? 'legend_' + run.cmd.legend : D.FACTIONS[f].general)} ${U.escape(run.cmd.name)}</div>
              ${run.army.map((u, i) => `<div class="qa" data-i="${i}">${RW.unitIcon(u.typeId)} ${D.UNITS[u.typeId].name} <span class="dim">${Math.round(u.hp * 100)}% ${'▲'.repeat(u.rank || 0)}</span><span class="x">×</span></div>`).join('')}</div>
              <p class="dim">Click a unit to dismiss it (refunds nothing).</p></div>
          </div>
          <div class="setup-buttons"><button class="btn back">Abandon Run</button><button class="btn primary big s-go" ${run.army.length ? '' : 'disabled'}>Fight Wave ${run.wave}</button></div>
        </div>`);
        el.querySelectorAll('[data-u]').forEach((s) => (s._tip = () => ui.unitTip(s.dataset.u)));
        el.querySelectorAll('.rbtn').forEach((b) => { b._tip = () => ui.unitTip(b.dataset.id); b.onclick = () => { run.gold -= D.UNITS[b.dataset.id].cost; run.army.push({ typeId: b.dataset.id, hp: 1, rank: 0, xp: 0 }); RW.audio.play('coin'); draw(); }; });
        el.querySelectorAll('.qa[data-i]').forEach((d) => { d._tip = () => ui.unitTip(run.army[+d.dataset.i].typeId); d.onclick = () => { run.army.splice(+d.dataset.i, 1); draw(); }; });
        el.querySelector('.s-heal').onclick = () => { run.gold -= healCost(); for (const u of run.army) u.hp = 1; RW.audio.play('heal'); draw(); };
        el.querySelector('.back').onclick = () => ui.modal({ title: 'Abandon this run?', body: `<p>You reached wave ${run.wave}.</p>`, buttons: [{ label: 'Abandon', cls: 'danger', onClick: () => menus.main() }, { label: 'Keep fighting' }] });
        el.querySelector('.s-go').onclick = () => menus.survivalFight(run);
      };
      draw();
    },
    survivalFight(run) {
      const nx = run.next;
      const boss = nx.boss;
      const cfg = {
        mapType: nx.mapType, seed: Math.floor(Math.random() * 1e9), attackerSide: nx.siege ? 1 : 0, difficulty: run.diff, quick: true, weather: nx.weather,
        sides: [
          { faction: run.faction, isPlayer: true, units: run.army.map((u, i) => ({ typeId: u.typeId, hpFrac: u.hp, rank: u.rank, xp: u.xp, ref: { idx: i } })), commander: run.cmd, ultimate: run.wave >= 3 },
          { faction: nx.foe, units: nx.units.map((typeId) => ({ typeId, rank: Math.min(3, Math.floor((run.wave - 1) / 3)) })), commander: boss ? { name: boss.name, legend: boss.id, trait: null, level: 1 + Math.floor(run.wave / 3) } : RW.randomCommander(nx.foe) },
        ],
      };
      cfg.resolve = (res) => {
        const won = res.playerWon;
        for (const ru of res.units) {
          if (ru.side !== 0 || !ru.ref || ru.ref.idx == null) continue;
          const u = run.army[ru.ref.idx];
          u.hp = ru.alive ? Math.max(0.05, ru.hpFrac) : 0;
          u.xp = (u.xp || 0) + (ru.kills || 0);
          u.rank = ru.rank || u.rank;
          run.kills += ru.kills || 0;
        }
        run.army = run.army.filter((u) => u.hp > 0);
        if (!won) return { text: `Your army fell on wave ${run.wave}.` };
        const gold = 900 + run.wave * 250;
        run.gold += gold;
        run.cmd.xp = (run.cmd.xp || 0) + 60;
        let lv = 0;
        while (run.cmd.level < 10 && run.cmd.xp >= run.cmd.level * 100) { run.cmd.xp -= run.cmd.level * 100; run.cmd.level++; lv = run.cmd.level; }
        for (const u of run.army) u.hp = Math.min(1, u.hp + 0.25);
        return { gold, cmdXp: 60, cmdName: run.cmd.name, levelUp: lv, text: `Wave ${run.wave} defeated! Survivors recover 25% strength.` };
      };
      RW.app.startBattle(cfg, (res) => {
        if (res && res.playerWon) {
          run.wave++;
          run.next = menus.survivalWave(run);
          menus.survivalCamp(run);
        } else {
          const reached = run.wave;
          let best = 0;
          try { best = +localStorage.getItem(SURVIVAL_KEY) || 0; if (reached > best) localStorage.setItem(SURVIVAL_KEY, reached); } catch (e) { /* ignore */ }
          backdrop();
          ui.show(null);
          ui.modal({ title: '<span class="lose">The Line Breaks</span>', cls: 'results', body: `<div class="res-grid"><div><h3>Wave reached</h3><p>${reached}</p></div><div><h3>Best</h3><p>${Math.max(best, reached)}</p></div><div><h3>Enemies slain</h3><p>${run.kills}</p></div><div><h3>Commander level</h3><p>${run.cmd.level}</p></div></div>${reached > best ? '<p class="center win">New record!</p>' : ''}`,
            buttons: [{ label: 'Main Menu', cls: 'primary', onClick: () => menus.main() }, { label: 'Try Again', onClick: () => menus.survival() }] });
        }
      });
    },

    // ---------------------------------------------------------------- Encyclopedia
    encyclopedia(back, start) {
      let tab = start || D.PLAYABLE[0];
      const tabs = D.PLAYABLE.map((f) => [f, `${ui.emblem(f, 18)} ${D.FACTIONS[f].short}`]).concat([['items', 'Equipment'], ['world', 'World & Weather']]);
      const body = U.html('<div class="encyc"><div class="tabs"></div><div class="enc-body"></div></div>');
      const tbox = body.querySelector('.tabs'), eb = body.querySelector('.enc-body');
      tbox.innerHTML = tabs.map(([k, l]) => `<button class="btn sm" data-t="${k}">${l}</button>`).join('');
      const draw = () => {
        tbox.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.t === tab));
        if (D.FACTIONS[tab]) {
          const fd = D.FACTIONS[tab];
          const units = Object.values(D.UNITS).filter((u) => u.faction === tab && (u.recruitable || u.cat === 'general') && !u.id.startsWith('legend_'));
          const ult = fd.ultimate && D.ABILITIES[fd.ultimate];
          eb.innerHTML = `<h3 style="color:${fd.color}">${ui.emblem(tab, 32)} ${fd.name}</h3><p>${fd.desc}</p>
            <p class="fc-good">▲ ${fd.strengths}</p><p class="fc-bad">▼ ${fd.weaknesses}</p><p><b>${fd.bonus.name}:</b> ${fd.bonus.desc}</p>
            <p><b>Abilities:</b> ${fd.abilities.map((a) => `<span class="has-tip" data-ab="${a}">${RW.icon(D.ABILITIES[a].icon)} ${D.ABILITIES[a].name}</span>`).join(' · ')}${ult ? ` · <b>Ultimate</b> (research): <span class="has-tip" data-ab="${fd.ultimate}">${RW.icon(ult.icon)} ${ult.name}</span>` : ''}</p>
            <h4>Legendary Commanders</h4><div class="legends">${legendsOf(tab).map((L) => `<div class="legend-card"><b>${L.name}</b> — <i>${L.title}</i><p>${U.escape(L.story)}</p><p><b>${L.passive.name}:</b> ${L.passive.desc}</p>${L.abilities.map((a) => `<p>${RW.icon(a.icon)} <b>${a.name}</b> — ${a.desc}</p>`).join('')}<p class="dim">Start: ${L.start.desc}</p></div>`).join('')}</div>
            <h4>Units</h4><table class="res-units enc-units"><tr><th>Unit</th><th>Role</th><th>Tier</th><th>Cost</th><th>Men</th><th>Atk/Def</th><th>Armour</th><th>Notes</th></tr>
            ${units.map((u) => `<tr data-u="${u.id}"><td>${RW.unitIcon(u.id)} ${u.name}</td><td>${u.cat}${u.fly ? ' (flying)' : ''}</td><td>${u.tier}</td><td>${u.recruitable ? u.cost : '-'}</td><td>${u.count}</td><td>${u.atk}/${u.def}</td><td>${u.armor}</td><td>${u.rare ? '<span class="r-rare">Rare</span> ' : ''}${u.cat === 'general' ? 'Bodyguard' : ''}</td></tr>`).join('')}</table>`;
          eb.querySelectorAll('tr[data-u]').forEach((tr) => { tr.setAttribute('data-tip', ''); tr._tip = () => ui.unitTip(tr.dataset.u); });
          eb.querySelectorAll('[data-ab]').forEach((s) => (s._tip = () => ui.abilityTip(s.dataset.ab)));
        } else if (tab === 'items') {
          eb.innerHTML = `<p class="dim">Equipment is found after victories (35%), in ruins and through events, and equipped on commanders in Manage Army.</p>` + Object.keys(D.RARITY).map((r) => `<h4 class="r-${r}">${D.RARITY[r].name}</h4>${Object.values(D.ITEMS).filter((i) => i.rarity === r).map((i) => `<div class="inv"><span class="item r-${r}">${RW.icon('gem')} ${i.name}</span> <span class="dim">${i.slot}</span> — ${i.desc}</div>`).join('')}`).join('');
        } else {
          eb.innerHTML = `<h4>Landmarks (Greater Realm)</h4>${Object.values(D.LANDMARKS).map((l) => `<p>◆ <b>${l.name}</b> — ${l.desc}</p>`).join('')}
            <h4>Battlefields</h4>${Object.values(D.BATTLE_MAPS).map((m) => `<p><b>${m.name}</b> — ${m.desc}</p>`).join('')}
            <h4>Weather</h4>${Object.values(D.WEATHER).map((w) => `<p><b>${w.name}</b> — ${w.desc}</p>`).join('')}
            <h4>Doctrines</h4>${Object.values(D.DOCTRINES).map((d) => `<p><b>${d.name}</b> — ${d.desc}</p>`).join('')}
            <h4>Commander Skills</h4>${D.SKILLS.map((s) => `<p><b>${s.name}</b> (${s.branch}, ${s.max} ranks) — ${s.desc}</p>`).join('')}`;
        }
      };
      tbox.querySelectorAll('button').forEach((b) => (b.onclick = () => { tab = b.dataset.t; draw(); }));
      draw();
      ui.modal({ title: 'Encyclopedia', cls: 'wide encyclopedia', body, buttons: [{ label: 'Close', cls: 'primary', onClick: () => { if (back) back(); } }] });
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
        <label class="chk"><input type="checkbox" class="s-fast" ${s.fastCampaign ? 'checked' : ''}> Fast campaign animations</label>
      </div>`);
      body.querySelectorAll('.g-q button').forEach((b) => (b.onclick = () => { s.quality = b.dataset.v; body.querySelectorAll('.g-q button').forEach((x) => x.classList.toggle('on', x === b)); RW.saveSettings(); }));
      body.querySelector('.s-vol').oninput = (e) => { s.volume = +e.target.value; body.querySelector('.v-vol').textContent = Math.round(s.volume * 100) + '%'; RW.saveSettings(); };
      body.querySelector('.s-cam').oninput = (e) => { s.camSens = +e.target.value; body.querySelector('.v-cam').textContent = s.camSens.toFixed(1) + '×'; RW.saveSettings(); };
      body.querySelector('.s-music').onchange = (e) => { s.music = e.target.checked; RW.saveSettings(); };
      body.querySelector('.s-sfx').onchange = (e) => { s.sfx = e.target.checked; RW.saveSettings(); };
      body.querySelector('.s-edge').onchange = (e) => { s.edgeScroll = e.target.checked; RW.saveSettings(); };
      body.querySelector('.s-tips').onchange = (e) => { s.tooltips = e.target.checked; RW.saveSettings(); };
      body.querySelector('.s-fast').onchange = (e) => { s.fastCampaign = e.target.checked; RW.saveSettings(); };
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
          <li>Win by <b>Conquest</b> (12 territories), <b>Decapitation</b> (both rival capitals), holding the <b>Ancient Shrines</b> for 5 turns, or a <b>Golden Age</b> treasury. In the Greater Realm: 20 territories or three rival capitals.</li>
          <li><b>Greater Realm &amp; Conquest:</b> six factions, <b>Diplomacy</b> (peace, pacts, alliances, gold, military aid), <b>Research</b> (12 technologies; unlocks rare units and your ultimate ability), <b>landmarks</b> ◆ and explorable <b>ruins</b> ✧.</li>
          <li><b>Manage Army</b> (M): equip items, learn commander skills (one point per level), set a doctrine, drill unit types and pick your banner colour.</li>
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
          <tr><td>Z / X / C / V / B / N</td><td>Commander abilities</td></tr>
          <tr><td>Right-click wall (tower selected)</td><td>Push a siege tower to the walls</td></tr>
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
