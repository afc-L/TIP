// Campaign screen: map interaction, territory/army panels, recruitment, construction, turns and battles.
(function () {
  const RW = window.RW;
  const T = THREE;
  const U = RW.util;
  const D = RW.data;
  const ui = RW.ui;

  class CampaignScene {
    constructor(app, campaign) {
      this.app = app;
      this.c = campaign;
      this.persistent = true;
      this.view = new RW.CampaignView(campaign);
      this.scene = this.view.scene;
      this.camera = new T.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.5, 600);
      const ext = this.view.map.extent;
      const cap = this.view.map.sites[campaign.factions[campaign.player].capital] || this.view.center;
      this.rts = new RW.RTSCamera(this.camera, { x: cap.x, z: cap.z, yaw: 0, dist: 55, minDist: 14, maxDist: 110, minPitch: 0.75, maxPitch: 1.25, panSpeed: 0.55, bounds: { minX: 0, maxX: ext.x, minZ: 0, maxZ: ext.z } });
      this.raycaster = new T.Raycaster();
      this.selT = -1; this.selArmy = null;
      this.busy = false;
      this.mouse = { x: 0, y: 0, moved: false };
      this.tmpV = new T.Vector3();
      this.c.hooks.onEliminated = (f) => ui.toast(`${D.FACTIONS[f].name} has been destroyed!`, f === this.c.player ? 'bad' : 'good', 5000);
      this.activate();
      // Select the player's first army.
      const a = this.c.armiesOf(this.c.player)[0];
      if (a) this.selectArmy(a);
    }
    get me() { return this.c.factions[this.c.player]; }
    get fac() { return D.FACTIONS[this.c.player]; }

    // ---------------------------------------------------------------- lifecycle
    activate() {
      this.active = true;
      this.buildHud();
      this.bindInput();
      this.view.refresh();
      this.refreshAll();
      RW.audio.music('campaign');
    }
    deactivate() {
      this.active = false;
      for (const f of this.unbind || []) f();
      this.unbind = [];
      if (this.hud) this.hud.remove();
      this.hud = null;
      ui.hideTip();
    }
    dispose() { this.deactivate(); this.view.dispose(); }
    resize() { this.camera.aspect = window.innerWidth / window.innerHeight; this.camera.updateProjectionMatrix(); }

    // ---------------------------------------------------------------- HUD
    buildHud() {
      const el = ui.setHud(`<div class="camp-hud">
        <div class="c-top panel">
          <div class="c-fac">${ui.emblem(this.c.player, 34)}<span>${this.fac.name}</span></div>
          <div class="c-res"><span class="c-gold has-tip">${RW.icon('gold', 'gold')} <b></b></span><span class="c-net has-tip"></span><span class="c-armies has-tip"></span><span class="c-terrs has-tip"></span></div>
          <div class="c-turn">Turn <b></b> · <span class="c-diff"></span></div>
          <div class="c-btns">
            <button class="btn sm c-obj" data-tip="Victory objectives and progress">Objectives</button>
            <button class="btn sm c-arm" data-tip="Unlock permanent unit upgrades">Armoury</button>
            <button class="btn sm c-fin" data-tip="Overview of all factions">Factions</button>
            <button class="btn sm c-menu" data-tip="Save, settings, quit (Esc)">☰</button>
          </div>
        </div>
        <div class="c-left panel"></div>
        <div class="c-right panel"></div>
        <div class="c-log panel"></div>
        <div class="c-labels"></div>
        <div class="c-end">
          <button class="btn c-next" data-tip="Select your next army with moves left (Tab)">Next Army</button>
          <button class="btn primary big c-endturn" data-tip="End your turn. Enemy factions will act. (Enter)">End Turn</button>
        </div>
        <div class="c-aiturn"><div class="spinner"></div><span></span><button class="btn sm c-skip">Faster</button></div>
        <div class="c-help">Left-click: select · Right-click: march / attack · WASD / edge: pan · Wheel: zoom · Q/E: rotate</div>
      </div>`);
      this.hud = el;
      this.$ = (s) => el.querySelector(s);
      this.$('.c-endturn').onclick = () => this.endTurn();
      this.$('.c-next').onclick = () => this.nextArmy();
      this.$('.c-obj').onclick = () => this.showObjectives();
      this.$('.c-arm').onclick = () => this.showArmoury();
      this.$('.c-fin').onclick = () => this.showFactions();
      this.$('.c-menu').onclick = () => this.openMenu();
      this.$('.c-skip').onclick = () => { this.fast = true; };
      this.$('.c-gold')._tip = () => {
        const f = this.c.player;
        const rows = this.c.owned(f).map((t) => `<tr><td>${this.c.tdef(t.id).name}</td><td>+${this.c.territoryIncome(t)}</td></tr>`).join('');
        return `<div class="tip-title">Treasury</div><table class="stats">${rows}<tr><td><b>Income</b></td><td><b>+${this.c.income(f)}</b></td></tr><tr><td>Army upkeep</td><td>-${this.c.upkeep(f)}</td></tr></table>${f === 'valor' ? '<div class="tip-sub">Chivalric Order: +15% income</div>' : ''}`;
      };
      this.$('.c-net')._tip = () => 'Net gold per turn (income minus army upkeep). If your treasury goes negative, troops desert.';
      this.$('.c-armies')._tip = () => `Armies: ${this.c.armiesOf(this.c.player).length} of ${this.c.maxArmies(this.c.player)} allowed. Hold more territories to field more armies (1 + 1 per 3 territories, max 5).`;
      this.$('.c-terrs')._tip = () => 'Territories controlled.';
      // Labels
      const lab = this.$('.c-labels');
      this.labelEls = new Map();
      for (const td of D.TERRITORIES) {
        const le = U.html(`<div class="tlabel"><div class="tl-name"></div><div class="tl-sub"></div></div>`);
        le.addEventListener('mousedown', (e) => { e.stopPropagation(); if (e.button === 0) this.selectTerritory(td.id); else if (e.button === 2) this.orderMarch(td.id); });
        le.addEventListener('contextmenu', (e) => e.preventDefault());
        le._tip = () => this.territoryTip(td.id);
        lab.appendChild(le);
        this.labelEls.set(td.id, le);
      }
      this.armyEls = new Map();
    }

    territoryTip(tid) {
      const c = this.c, t = c.terr(tid), td = c.tdef(tid);
      const a = c.armyAt(tid);
      let s = `<div class="tip-title">${td.name}</div><div class="tip-sub">${D.TERRAIN_INFO[td.terrain].name} · ${D.SETTLEMENT.levels[t.level].name} · ${D.FACTIONS[t.owner].name}</div>`;
      if (td.shrine) s += '<div class="tip-desc">✦ Ancient Shrine (objective, +40 gold)</div>';
      if (c.factions[t.owner] && c.factions[t.owner].capital === tid) s += '<div class="tip-desc">♛ Capital</div>';
      s += `<div class="tip-desc">Income ${c.territoryIncome(t)} · Garrison strength ${Math.round(c.garrisonPower(t))}${t.buildings.walls ? ' · Walled' : ''}</div>`;
      if (a) s += `<div class="tip-desc">Army: ${U.escape(a.commander.name)} (${D.FACTIONS[a.faction].short}) · ${a.units.length} units · strength ${Math.round(c.armyPower(a))}</div>`;
      if (this.selArmy && this.selArmy.faction === c.player && c.canMoveTo(this.selArmy, tid)) {
        const kind = c.moveKind(this.selArmy, tid);
        if (kind === 'battle') {
          const setup = c.battleSetup(this.selArmy, tid);
          s += `<div class="tip-warn">Right-click to attack · Auto-resolve odds ${Math.round(c.odds(setup) * 100)}%</div>`;
        } else s += '<div class="tip-ok">Right-click to march here</div>';
      }
      return s;
    }

    refreshAll() {
      if (!this.active) return;
      const c = this.c, f = c.player, fs = this.me;
      this.$('.c-gold b').textContent = U.fmt(fs.gold);
      const net = c.net(f);
      this.$('.c-net').innerHTML = `<span class="${net >= 0 ? 'pos' : 'neg'}">${net >= 0 ? '+' : ''}${net}/turn</span>`;
      this.$('.c-armies').innerHTML = `⚑ ${c.armiesOf(f).length}/${c.maxArmies(f)}`;
      this.$('.c-terrs').innerHTML = `⌂ ${c.owned(f).length}/16`;
      this.$('.c-turn b').textContent = c.turn;
      this.$('.c-diff').textContent = c.difficulty[0].toUpperCase() + c.difficulty.slice(1);
      // Labels
      for (const [tid, le] of this.labelEls) {
        const t = c.terr(tid), td = c.tdef(tid);
        const capital = Object.values(c.factions).some((x) => x.capital === tid && x.alive);
        le.querySelector('.tl-name').innerHTML = `${capital ? '♛ ' : ''}${td.shrine ? '✦ ' : ''}${td.name}`;
        le.querySelector('.tl-sub').innerHTML = `${'★'.repeat(t.level)}${t.buildings.walls ? ' ⛫' : ''}`;
        le.style.setProperty('--oc', D.FACTIONS[t.owner].color);
        le.classList.toggle('sel', tid === this.selT);
        le.classList.toggle('target', this.view.targets.has(tid));
      }
      // Army chips
      const lab = this.$('.c-labels');
      const seen = new Set();
      for (const a of c.armies) {
        seen.add(a.id);
        let el = this.armyEls.get(a.id);
        if (!el) {
          el = U.html(`<div class="achip"><span class="ac-n"></span></div>`);
          el.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            const army = this.armyEls.get(a.id) && c.armyById(a.id);
            if (!army) return;
            if (e.button === 0) { if (army.faction === f) this.selectArmy(army); else this.selectTerritory(army.tid); }
            else if (e.button === 2) this.orderMarch(army.tid);
          });
          el.addEventListener('contextmenu', (e) => e.preventDefault());
          el._tip = () => { const army = c.armyById(a.id); return army ? this.armyTip(army) : ''; };
          lab.appendChild(el);
          this.armyEls.set(a.id, el);
        }
        el.style.setProperty('--fc', D.FACTIONS[a.faction].color);
        el.querySelector('.ac-n').innerHTML = `${a.units.length}${a.faction === f && a.moves > 0 ? ' <i>•</i>' : ''}`;
        el.classList.toggle('sel', a === this.selArmy);
        el.classList.toggle('mine', a.faction === f);
      }
      for (const [id, el] of this.armyEls) if (!seen.has(id)) { el.remove(); this.armyEls.delete(id); }
      this.renderLeft();
      this.renderRight();
      this.renderLog();
    }

    armyTip(a) {
      const c = this.c;
      return `<div class="tip-title">${U.escape(a.commander.name)}</div><div class="tip-sub">${D.FACTIONS[a.faction].name} · Level ${a.commander.level} · ${D.TRAITS[a.commander.trait] ? D.TRAITS[a.commander.trait].name : ''}</div>
        <div class="tip-desc">${a.units.length} units · Strength ${Math.round(c.armyPower(a))}</div>
        <div class="tip-units">${a.units.map((u) => RW.unitIcon(u.typeId)).join('')}</div>`;
    }

    renderLog() {
      const el = this.$('.c-log');
      el.innerHTML = '<h4>Chronicle</h4>' + this.c.log.slice(-6).reverse().map((l) => `<div><span class="dim">T${l.turn}</span> ${U.escape(l.text)}</div>`).join('');
    }

    renderLeft() {
      const el = this.$('.c-left');
      const c = this.c, f = c.player;
      if (this.selT < 0) { el.innerHTML = '<div class="hint">Select a territory or army.</div>'; return; }
      const t = c.terr(this.selT), td = c.tdef(this.selT);
      const mineT = t.owner === f;
      const lvl = D.SETTLEMENT.levels[t.level];
      const fs = this.me;
      let html = `<h3 style="--oc:${D.FACTIONS[t.owner].color}">${td.name}</h3>
        <div class="sub">${ui.emblem(t.owner, 20)} ${D.FACTIONS[t.owner].name}</div>
        <div class="row"><span>Terrain</span><b>${D.TERRAIN_INFO[td.terrain].name}</b></div>
        <div class="row"><span>Settlement</span><b>${lvl.name} ${'★'.repeat(t.level)}</b></div>
        <div class="row"><span>Income</span><b>${RW.icon('gold', 'gold')} ${c.territoryIncome(t)}</b></div>
        <div class="row"><span>Garrison</span><b>${c.garrisonUnits(t).length} units · ${Math.round(t.garrisonHp * 100)}%</b></div>
        <div class="row"><span>Battlefield</span><b>${D.BATTLE_MAPS[c.isSiege(this.selT, t.owner) ? 'siege' : D.TERRAIN_INFO[td.terrain].battle].name}</b></div>
        ${td.shrine ? '<div class="note shrine">✦ Ancient Shrine — hold all three to win.</div>' : ''}
        <div class="bld">${Object.entries(D.SETTLEMENT.buildings).map(([k, b]) => `<span class="${t.buildings[k] ? 'on' : ''}" data-tip="<b>${b.name}</b><br>${b.desc}">${b.name}</span>`).join('')}</div>`;
      if (mineT) {
        html += '<div class="actions">';
        if (t.level < 3) {
          const cost = c.upgradeCost(t);
          html += `<button class="btn sm act-up" ${fs.gold < cost ? 'disabled' : ''} data-tip="Upgrade to ${D.SETTLEMENT.levels[t.level + 1].name}: +income, unlocks tier ${t.level + 1} units, +garrison, +1 recruit slot.">Upgrade to ${D.SETTLEMENT.levels[t.level + 1].name} (${cost})</button>`;
        }
        for (const [k, b] of Object.entries(D.SETTLEMENT.buildings)) {
          if (t.buildings[k]) continue;
          const cost = c.buildingCost(t, k);
          html += `<button class="btn sm act-b" data-k="${k}" ${fs.gold < cost ? 'disabled' : ''} data-tip="<b>${b.name}</b><br>${b.desc}">Build ${b.name} (${cost})</button>`;
        }
        if (!c.armyAt(this.selT)) {
          const can = c.canRaiseArmy(f, this.selT);
          html += `<button class="btn sm act-raise" ${can ? '' : 'disabled'} data-tip="Raise a new army here with a new commander (500 gold). Armies: ${c.armiesOf(f).length}/${c.maxArmies(f)}.">Raise New Army (500)</button>`;
        }
        html += '</div>';
      }
      el.innerHTML = html;
      const up = el.querySelector('.act-up');
      if (up) up.onclick = () => { const err = c.upgradeSettlement(t); this.afterAction(err, `${td.name} grows into a ${D.SETTLEMENT.levels[t.level].name}!`); };
      el.querySelectorAll('.act-b').forEach((b) => (b.onclick = () => { const err = c.build(t, b.dataset.k); this.afterAction(err, `${D.SETTLEMENT.buildings[b.dataset.k].name} built in ${td.name}.`); }));
      const ra = el.querySelector('.act-raise');
      if (ra) ra.onclick = () => this.raiseArmyDialog(this.selT);
    }

    afterAction(err, ok) {
      if (err) { ui.toast(err, 'warn'); RW.audio.play('error'); return; }
      if (ok) ui.toast(ok, 'good');
      RW.audio.play('build');
      this.view.refresh();
      this.refreshAll();
    }

    renderRight() {
      const el = this.$('.c-right');
      const c = this.c, f = c.player;
      const a = this.selArmy && c.armies.includes(this.selArmy) ? this.selArmy : null;
      if (!a) {
        // Enemy army in the selected territory?
        const other = this.selT >= 0 ? c.armyAt(this.selT) : null;
        if (other) { el.innerHTML = this.armyReadOnly(other); el.style.display = ''; return; }
        el.style.display = 'none'; return;
      }
      el.style.display = '';
      const cmd = a.commander, trait = D.TRAITS[cmd.trait];
      const t = c.terr(a.tid);
      const inHome = t.owner === f;
      let html = `<h3>${ui.emblem(f, 22)} ${U.escape(cmd.name)}</h3>
        <div class="sub">Level ${cmd.level} commander · <span data-tip="${trait ? trait.desc : ''}" class="trait">${trait ? trait.name : '-'}</span></div>
        ${ui.bar(cmd.xp / (cmd.level * 100), 'xp', `XP ${cmd.xp}/${cmd.level * 100}`)}
        <div class="row"><span>Moves</span><b>${a.moves}/${c.armyMoves(a)}</b></div>
        <div class="row"><span>Strength</span><b>${Math.round(c.armyPower(a))}</b></div>
        <div class="row"><span>Upkeep</span><b>-${c.armyUpkeep(a)}/turn</b></div>
        <div class="units">`;
      a.units.forEach((u, i) => {
        html += `<div class="ucell" data-i="${i}">${RW.unitIcon(u.typeId)}<span class="rk">${'▲'.repeat(u.rank || 0)}</span>${ui.bar(u.hp, 'hp')}<button class="x" data-i="${i}" data-tip="Disband this unit">×</button></div>`;
      });
      for (let i = a.units.length; i < RW.MAX_UNITS; i++) html += '<div class="ucell empty"></div>';
      html += '</div>';
      if (inHome) {
        const slots = c.recruitSlots(t);
        html += `<h4>Recruit at ${c.tdef(a.tid).name} <span class="dim">(${slots} slot${slots === 1 ? '' : 's'} left this turn)</span></h4><div class="recruit">`;
        for (const ut of Object.values(D.UNITS).filter((x) => x.faction === f && x.recruitable)) {
          const cost = c.unitCost(f, ut.id, t);
          const locked = ut.tier > t.level;
          const dis = locked || slots <= 0 || this.me.gold < cost || a.units.length >= RW.MAX_UNITS;
          html += `<button class="rbtn ${locked ? 'locked' : ''}" data-id="${ut.id}" ${dis ? 'disabled' : ''}>${RW.unitIcon(ut.id)}<span class="rn">${ut.name}</span><span class="rc">${locked ? 'Needs ' + D.SETTLEMENT.levels[ut.tier].name : cost}</span></button>`;
        }
        html += '</div>';
      } else html += '<div class="note">Move this army into one of your settlements to recruit. Armies replenish faster in friendly territory.</div>';
      // March options
      const opts = c.adj(a.tid).map((n) => ({ n, ok: c.canMoveTo(a, n), kind: c.canMoveTo(a, n) ? c.moveKind(a, n) : null }));
      html += `<h4>March</h4><div class="march">${opts.map((o) => {
        const td = c.tdef(o.n);
        let lab = o.kind === 'battle' ? `⚔ Attack ${td.name}` : `➜ ${td.name}`;
        if (!o.ok) lab = `${td.name}`;
        return `<button class="btn sm mbtn ${o.kind === 'battle' ? 'danger' : ''}" data-n="${o.n}" ${o.ok ? '' : 'disabled'}>${lab}</button>`;
      }).join('')}</div>`;
      el.innerHTML = html;
      el.querySelectorAll('.ucell[data-i]').forEach((cell) => {
        const u = a.units[+cell.dataset.i];
        cell._tip = () => ui.unitTip(u.typeId, `<div class="tip-live">Strength ${Math.round(u.hp * 100)}% · Rank ${u.rank || 0} · XP ${u.xp || 0}</div>`);
      });
      el.querySelectorAll('.x').forEach((b) => (b.onclick = (e) => {
        e.stopPropagation();
        const i = +b.dataset.i;
        ui.modal({ title: 'Disband unit?', body: `<p>Disband ${D.UNITS[a.units[i].typeId].name}? This saves ${D.UNITS[a.units[i].typeId].upkeep} upkeep per turn.</p>`, buttons: [{ label: 'Disband', cls: 'danger', onClick: () => { c.disband(a, i); this.refreshAll(); } }, { label: 'Cancel' }] });
      }));
      el.querySelectorAll('.rbtn').forEach((b) => {
        b._tip = () => ui.unitTip(b.dataset.id);
        b.onclick = () => {
          const err = c.recruit(a, b.dataset.id);
          if (err) { ui.toast(err, 'warn'); RW.audio.play('error'); return; }
          RW.audio.play('coin');
          this.refreshAll();
        };
      });
      el.querySelectorAll('.mbtn').forEach((b) => {
        b._tip = () => this.territoryTip(+b.dataset.n);
        b.onclick = () => this.orderMarch(+b.dataset.n);
      });
    }

    armyReadOnly(a) {
      const c = this.c;
      const trait = D.TRAITS[a.commander.trait];
      return `<h3>${ui.emblem(a.faction, 22)} ${U.escape(a.commander.name)}</h3>
        <div class="sub">${D.FACTIONS[a.faction].name} · Level ${a.commander.level} · ${trait ? trait.name : ''}</div>
        <div class="row"><span>Strength</span><b>${Math.round(c.armyPower(a))}</b></div>
        <div class="units">${a.units.map((u) => `<div class="ucell" data-tip="${U.escape(D.UNITS[u.typeId].name)} · ${Math.round(u.hp * 100)}%">${RW.unitIcon(u.typeId)}${ui.bar(u.hp, 'hp')}</div>`).join('')}</div>`;
    }

    // ---------------------------------------------------------------- selection & orders
    selectTerritory(tid) {
      this.selT = tid;
      const a = this.c.armyAt(tid);
      if (a && a.faction === this.c.player) this.selArmy = a;
      else if (this.selArmy && this.selArmy.tid !== tid) this.selArmy = null;
      this.updateTargets();
      RW.audio.play('select');
      this.view.selectedT = tid;
      this.view.refresh();
      this.refreshAll();
    }
    selectArmy(a) {
      this.selArmy = a;
      this.selT = a.tid;
      this.view.selectedT = a.tid;
      this.updateTargets();
      this.view.refresh();
      this.refreshAll();
      RW.audio.play('select');
    }
    updateTargets() {
      this.view.targets = new Set();
      const a = this.selArmy;
      if (a && a.faction === this.c.player && a.moves > 0) for (const n of this.c.adj(a.tid)) if (this.c.canMoveTo(a, n)) this.view.targets.add(n);
    }
    nextArmy() {
      const list = this.c.armiesOf(this.c.player);
      if (!list.length) { ui.toast('You have no armies. Raise one in a settlement you own.', 'warn'); return; }
      const ready = list.filter((a) => a.moves > 0);
      const pool = ready.length ? ready : list;
      const i = pool.indexOf(this.selArmy);
      const a = pool[(i + 1) % pool.length];
      this.selectArmy(a);
      const s = this.view.map.sites[a.tid];
      this.rts.focus(s.x, s.z);
    }

    orderMarch(tid) {
      const c = this.c, a = this.selArmy;
      if (this.busy) return;
      if (!a || a.faction !== c.player) { this.selectTerritory(tid); return; }
      if (a.tid === tid) return;
      if (!c.adj(a.tid).includes(tid)) { ui.toast('Armies can only march to a neighbouring territory.', 'warn'); RW.audio.play('error'); return; }
      if (a.moves <= 0) { ui.toast('This army has already moved this turn.', 'warn'); RW.audio.play('error'); return; }
      if (!c.canMoveTo(a, tid)) { ui.toast('Another of your armies is already there.', 'warn'); RW.audio.play('error'); return; }
      const kind = c.moveKind(a, tid);
      if (kind === 'move') {
        a.tid = tid; a.moves--;
        RW.audio.play('order');
        this.selT = tid; this.view.selectedT = tid;
        this.updateTargets(); this.view.refresh(); this.refreshAll();
        return;
      }
      if (a.units.length === 0) { ui.toast('This army has no troops! Recruit some first.', 'warn'); return; }
      this.battlePrompt(a, tid, true).then(() => this.postBattle());
    }

    // Shows forces and odds; resolves after the battle (fought or auto-resolved) or cancel.
    battlePrompt(attacker, tid, playerAttacking) {
      return new Promise((resolve) => {
        const c = this.c;
        const setup = c.battleSetup(attacker, tid);
        const odds = c.odds(setup);
        const mySide = playerAttacking ? setup.att : setup.def;
        const foeSide = playerAttacking ? setup.def : setup.att;
        const pWin = playerAttacking ? odds : 1 - odds;
        const list = (side) => `<div class="bp-units">${RW.unitIcon(D.FACTIONS[side.faction].general)}${side.units.map((u) => `<span class="bpu" data-tip="${U.escape(D.UNITS[u.typeId].name)} · ${Math.round(u.hpFrac * 100)}%">${RW.unitIcon(u.typeId)}<i style="width:${Math.round(u.hpFrac * 100)}%"></i></span>`).join('')}</div>`;
        const mapName = D.BATTLE_MAPS[setup.mapType].name;
        const title = playerAttacking ? `Attack ${c.tdef(tid).name}?` : `${c.tdef(tid).name} is under attack!`;
        const body = `<div class="bp">
            <div class="bp-side">${ui.emblem(mySide.faction, 36)}<div><b>${U.escape(mySide.commander.name)}</b><br><span class="dim">Strength ${Math.round(c.sidePower(mySide, !playerAttacking && setup.siege))}</span></div></div>${list(mySide)}
            <div class="bp-vs">VS</div>
            <div class="bp-side">${ui.emblem(foeSide.faction, 36)}<div><b>${U.escape(foeSide.commander.name)}</b><br><span class="dim">Strength ${Math.round(c.sidePower(foeSide, playerAttacking && setup.siege))}</span></div></div>${list(foeSide)}
            <p class="center">Battlefield: <b>${mapName}</b> — ${D.BATTLE_MAPS[setup.mapType].desc}</p>
            <div class="odds"><span>Auto-resolve odds</span>${ui.bar(pWin, pWin > 0.6 ? 'good' : pWin < 0.4 ? 'bad' : 'mid', Math.round(pWin * 100) + '% victory')}</div>
          </div>`;
        const buttons = [
          { label: '⚔ Fight Battle', cls: 'primary', onClick: () => this.fight(attacker, setup, playerAttacking).then(resolve) },
          { label: 'Auto-resolve', onClick: () => {
            const res = c.autoResolve(setup);
            // autoResolve uses setup sides: 0 = attacker.
            const out = c.applyBattle(attacker, setup, res, false);
            const won = playerAttacking ? out.attWon : !out.attWon;
            RW.audio.play(won ? 'victory' : 'defeat');
            ui.modal({ title: won ? '<span class="win">Victory!</span>' : '<span class="lose">Defeat</span>', body: `<p class="center">${out.text || (won ? 'Your forces carried the day.' : 'Your forces were beaten.')}</p>`, buttons: [{ label: 'Continue', cls: 'primary', onClick: () => resolve(out) }] });
          } },
        ];
        if (playerAttacking) buttons.push({ label: 'Cancel', onClick: () => resolve(null) });
        ui.modal({ title, body, buttons, cls: 'wide' });
      });
    }

    // Launch a real-time battle; resolves with the campaign outcome.
    fight(attacker, setup, playerAttacking) {
      return new Promise((resolve) => {
        const c = this.c;
        const mine = playerAttacking ? setup.att : setup.def, foe = playerAttacking ? setup.def : setup.att;
        const cfg = {
          mapType: setup.mapType, seed: Math.floor(Math.random() * 1e9), attackerSide: playerAttacking ? 0 : 1, difficulty: c.difficulty,
          sides: [Object.assign({ isPlayer: true }, mine), Object.assign({}, foe)],
        };
        const bs = new RW.BattleScene(this.app, cfg, (res) => {
          this.app.setScene(this);
          this.activate();
          let out = { attWon: false, text: 'The battle was abandoned.' };
          if (res) out = c.applyBattle(attacker, setup, res, !playerAttacking);
          const won = playerAttacking ? out.attWon : !out.attWon;
          ui.toast(out.text || (won ? 'Victory!' : 'Defeat.'), won ? 'good' : 'bad', 5000);
          resolve(out);
        });
        this.app.setScene(bs);
      });
    }

    postBattle() {
      const c = this.c;
      if (this.selArmy && !c.armies.includes(this.selArmy)) this.selArmy = null;
      if (this.selArmy) { this.selT = this.selArmy.tid; this.view.selectedT = this.selT; }
      this.updateTargets();
      this.view.refresh();
      this.refreshAll();
      c.checkElimination();
      this.checkGameOver();
    }

    raiseArmyDialog(tid) {
      const c = this.c, f = c.player;
      if (!c.canRaiseArmy(f, tid)) { ui.toast('Cannot raise an army here.', 'warn'); return; }
      const taken = c.armiesOf(f).map((a) => a.commander.name);
      const cands = [];
      while (cands.length < 3) {
        const cmd = RW.randomCommander(f, taken.concat(cands.map((x) => x.name)));
        if (!cands.some((x) => x.trait === cmd.trait) || cands.length >= 2) cands.push(cmd);
      }
      const body = U.html(`<div class="cmd-choices">${cands.map((cmd, i) => `<div class="choice" data-i="${i}"><b>${U.escape(cmd.name)}</b><span class="trait">${D.TRAITS[cmd.trait].name}</span><p>${D.TRAITS[cmd.trait].desc}</p></div>`).join('')}</div>`);
      let pick = 0;
      body.querySelectorAll('.choice').forEach((el) => (el.onclick = () => { pick = +el.dataset.i; body.querySelectorAll('.choice').forEach((x) => x.classList.toggle('on', x === el)); }));
      body.querySelector('.choice').classList.add('on');
      ui.modal({ title: 'Choose a Commander', body, buttons: [
        { label: 'Raise Army (500)', cls: 'primary', onClick: () => {
          const a = c.raiseArmy(f, tid, cands[pick]);
          if (a) { this.selectArmy(a); ui.toast(`${a.commander.name} raises the banners! Recruit troops now.`, 'good'); RW.audio.play('horn'); }
        } },
        { label: 'Cancel' },
      ] });
    }

    // ---------------------------------------------------------------- dialogs
    showObjectives() {
      const objs = this.c.objectives();
      ui.modal({ title: 'Paths to Victory', body: `<p class="center dim">Complete any one objective to win the campaign.</p>${objs.map((o) => `<div class="objective ${o.done ? 'done' : ''}"><b>${o.name}</b><p>${o.desc}</p>${ui.bar(o.frac, 'xp', o.progress)}</div>`).join('')}<p class="dim">Defeat: lose all of your territories.</p>`, buttons: [{ label: 'Close' }] });
    }
    showArmoury() {
      const c = this.c, f = c.player, fs = this.me;
      const body = U.html(`<div class="armoury"><p class="center dim">Upgrades apply to all your armies permanently. Some require battle victories to unlock. Victories: <b>${fs.wins}</b></p>${D.UPGRADES[f].map((up) => {
        const owned = fs.upgrades.includes(up.id);
        const cost = c.techCost(f, up);
        const locked = fs.wins < up.wins;
        return `<div class="upg ${owned ? 'owned' : ''} ${locked ? 'locked' : ''}"><div><b>${up.name}</b><p>${up.desc}</p>${locked ? `<span class="dim">Requires ${up.wins} victories</span>` : ''}</div>${owned ? '<span class="ok">Owned</span>' : `<button class="btn sm" data-id="${up.id}" ${locked || fs.gold < cost ? 'disabled' : ''}>${cost} gold</button>`}</div>`;
      }).join('')}</div>`);
      body.querySelectorAll('button[data-id]').forEach((b) => (b.onclick = () => {
        const err = c.buyUpgrade(f, b.dataset.id);
        if (err) { ui.toast(err, 'warn'); return; }
        RW.audio.play('build');
        ui.closeModal(); this.refreshAll(); this.showArmoury();
      }));
      ui.modal({ title: 'Armoury', body, buttons: [{ label: 'Close' }] });
    }
    showFactions() {
      const c = this.c;
      const rows = ['valor', 'horde', 'arcane', 'rebels'].map((f) => {
        const fs = c.factions[f], fd = D.FACTIONS[f];
        const pow = c.armiesOf(f).reduce((s, a) => s + c.armyPower(a), 0);
        return `<tr class="${fs.alive || f === 'rebels' ? '' : 'dead'}"><td>${ui.emblem(f, 22)} ${fd.name}${fs.isPlayer ? ' (you)' : ''}</td><td>${c.owned(f).length}</td><td>${c.armiesOf(f).length}</td><td>${Math.round(pow)}</td><td>${f === 'rebels' ? '-' : fs.alive ? '+' + c.income(f) : 'Destroyed'}</td></tr>`;
      }).join('');
      const fd = this.fac;
      ui.modal({ title: 'Factions', body: `<table class="ftable"><tr><th>Faction</th><th>Territories</th><th>Armies</th><th>Army strength</th><th>Income</th></tr>${rows}</table><p><b>${fd.bonus.name}:</b> ${fd.bonus.desc}</p>`, buttons: [{ label: 'Close' }] });
    }
    openMenu() {
      ui.modal({ title: 'Campaign Menu', body: `<p class="center">Turn ${this.c.turn} · ${this.fac.name}</p><p class="center dim">The campaign autosaves at the start of every turn.</p>`, buttons: [
        { label: 'Resume', cls: 'primary' },
        { label: 'Save Game', onClick: () => { ui.toast(this.c.save() ? 'Game saved.' : 'Could not save (storage unavailable).', 'good'); } },
        { label: 'Settings', onClick: () => RW.app.openSettings(() => this.openMenu()) },
        { label: 'How to Play', onClick: () => RW.app.showHelp(() => this.openMenu()) },
        { label: 'Quit to Main Menu', cls: 'danger', onClick: () => { this.c.save(); RW.app.mainMenu(); } },
      ] });
    }

    // ---------------------------------------------------------------- turn flow
    async endTurn() {
      if (this.busy || this.c.over) return;
      const c = this.c;
      const idle = c.armiesOf(c.player).filter((a) => a.moves > 0 && a.units.length).length;
      this.busy = true; this.fast = false;
      this.hud.classList.add('ai-turn');
      RW.audio.play('turn');
      const hooks = {
        attack: (army, tid) => this.aiAttack(army, tid),
        moved: async (army, from, to) => {
          const near = [from, to].some((t) => c.terr(t).owner === c.player || c.adj(t).some((n) => c.terr(n).owner === c.player));
          this.view.refresh();
          if (near && !this.fast) await new Promise((r) => setTimeout(r, 380));
        },
      };
      try {
        for (const f of D.PLAYABLE) {
          if (f === c.player || !c.factions[f].alive) continue;
          this.$('.c-aiturn span').innerHTML = `${ui.emblem(f, 22)} ${D.FACTIONS[f].name} is moving…`;
          await new Promise((r) => setTimeout(r, this.fast ? 50 : 350));
          await RW.campaignAI.runFaction(c, f, hooks);
          this.view.refresh(); this.refreshAll();
          if (this.checkGameOver()) return;
        }
        c.turn++;
        c.beginRound();
        c.checkElimination();
        if (this.checkGameOver()) return;
        c.addLog(`Turn ${c.turn} begins.`);
      } catch (e) {
        console.error(e);
        ui.toast('Error during enemy turn: ' + e.message, 'bad', 8000);
      } finally {
        this.busy = false;
        this.hud && this.hud.classList.remove('ai-turn');
      }
      this.updateTargets();
      this.view.refresh(); this.refreshAll();
      ui.toast(`Turn ${c.turn}` + (idle ? '' : ''), 'info');
      // Random event
      const ev = c.rollEvent();
      if (ev) await this.showEvent(ev);
      c.save();
      this.refreshAll();
    }

    showEvent(ev) {
      return new Promise((resolve) => {
        RW.audio.play('turn');
        ui.modal({
          title: ev.title, cls: 'event',
          body: `<p>${ev.text}</p>`,
          buttons: ev.options.map((o) => ({ label: o.label, disabled: o.disabled, onClick: async () => {
            const r = o.apply();
            if (r && r.revolt != null) {
              const rebels = this.c.spawnRebels(r.revolt);
              this.view.refresh();
              await this.aiAttack(rebels, r.revolt);
            }
            this.view.refresh(); this.refreshAll();
            resolve();
          } })),
        });
      });
    }

    // An AI army attacks territory tid. If the player is involved, ask them to fight or auto-resolve.
    async aiAttack(army, tid) {
      const c = this.c;
      const setup = c.battleSetup(army, tid);
      if (setup.defFaction === c.player) {
        const s = this.view.map.sites[tid];
        this.rts.focus(s.x, s.z);
        this.view.refresh(); this.refreshAll();
        const out = await this.battlePrompt(army, tid, false);
        this.postBattle();
        return out;
      }
      const res = c.autoResolve(setup);
      const out = c.applyBattle(army, setup, res, false);
      if (out.text && (setup.defFaction !== 'rebels' || army.faction === 'rebels')) c.addLog(out.text);
      this.view.refresh();
      return out;
    }

    checkGameOver() {
      const end = this.c.checkEnd();
      if (!end) return false;
      this.busy = false;
      if (this.hud) this.hud.classList.remove('ai-turn');
      RW.audio.play(end.result === 'victory' ? 'victory' : 'defeat');
      const c = this.c;
      RW.Campaign.deleteSave();
      const stats = `<div class="res-grid"><div><h3>Turns</h3><p>${c.turn}</p></div><div><h3>Battles won</h3><p>${c.factions[c.player].wins}</p></div><div><h3>Battles lost</h3><p>${c.factions[c.player].losses}</p></div><div><h3>Territories</h3><p>${c.owned(c.player).length}/16</p></div></div>`;
      ui.modal({
        title: end.result === 'victory' ? '<span class="win">Victory!</span>' : '<span class="lose">Defeat</span>', cls: 'results',
        body: end.result === 'victory' ? `<p class="center">${this.fac.name} triumphs through <b>${end.objective}</b>! The realms bow before you.</p>${stats}` : `<p class="center">${end.reason} ${this.fac.name} is no more.</p>${stats}`,
        buttons: [{ label: 'Main Menu', cls: 'primary', onClick: () => RW.app.mainMenu() }, { label: 'New Campaign', onClick: () => RW.app.newCampaignScreen() }],
      });
      return true;
    }

    // ---------------------------------------------------------------- input & frame
    bindInput() {
      const cv = this.app.canvas;
      const on = (t, ev, fn, opt) => { t.addEventListener(ev, fn, opt); (this.unbind = this.unbind || []).push(() => t.removeEventListener(ev, fn, opt)); };
      on(cv, 'contextmenu', (e) => e.preventDefault());
      on(cv, 'mousedown', (e) => {
        if (ui.modalOpen) return;
        if (e.button === 1 || (e.button === 0 && e.altKey)) { this.rot = { x: e.clientX }; e.preventDefault(); return; }
        if (e.button === 0) this.ldrag = { x: e.clientX, y: e.clientY, moved: false };
        if (e.button === 2) { const tid = this.pick(e.clientX, e.clientY); if (tid >= 0) this.orderMarch(tid); }
      });
      on(window, 'mousemove', (e) => {
        this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.moved = true;
        if (this.rot) { this.rts.rotateBy(e.clientX - this.rot.x, 0); this.rot.x = e.clientX; }
        if (this.ldrag) {
          const dx = e.clientX - this.ldrag.x, dy = e.clientY - this.ldrag.y;
          if (this.ldrag.moved || Math.abs(dx) + Math.abs(dy) > 5) {
            // Drag the map to pan.
            this.ldrag.moved = true;
            const k = this.rts.dist / window.innerHeight * 1.1;
            this.rts.pan(-dx * k, -dy * k * 1.3);
            this.ldrag.x = e.clientX; this.ldrag.y = e.clientY;
          }
        }
      });
      on(window, 'mouseup', (e) => {
        if (e.button === 1 || (this.rot && e.button === 0)) this.rot = null;
        if (e.button === 0 && this.ldrag) {
          const moved = this.ldrag.moved; this.ldrag = null;
          if (!moved && !ui.modalOpen && e.target === cv) { const tid = this.pick(e.clientX, e.clientY); if (tid >= 0) this.selectTerritory(tid); }
        }
      });
      on(cv, 'wheel', (e) => { e.preventDefault(); this.rts.zoom(e.deltaY); }, { passive: false });
      on(window, 'keydown', (e) => {
        if (ui.modalOpen) { if (e.code === 'Escape') ui.closeModal(); return; }
        if (e.code === 'Escape') { if (this.selArmy || this.selT >= 0) { this.selArmy = null; this.selT = -1; this.view.selectedT = -1; this.updateTargets(); this.view.refresh(); this.refreshAll(); } else this.openMenu(); }
        else if (e.code === 'Enter') this.endTurn();
        else if (e.code === 'Tab') { e.preventDefault(); this.nextArmy(); }
      });
    }
    pick(cx, cy) {
      const ndc = new T.Vector2((cx / window.innerWidth) * 2 - 1, -(cy / window.innerHeight) * 2 + 1);
      this.raycaster.setFromCamera(ndc, this.camera);
      return this.view.pickTerritory(this.raycaster);
    }
    screenPos(x, y, z) {
      this.tmpV.set(x, y, z).project(this.camera);
      if (this.tmpV.z > 1) return null;
      return { x: (this.tmpV.x * 0.5 + 0.5) * window.innerWidth, y: (-this.tmpV.y * 0.5 + 0.5) * window.innerHeight };
    }

    update(dt) {
      this.rts.update(dt, !ui.modalOpen);
      this.view.update(dt);
      if (!this.active) return;
      if (this.mouse.moved && !this.ldrag) {
        this.mouse.moved = false;
        const over = document.elementFromPoint(this.mouse.x, this.mouse.y);
        const tid = over === this.app.canvas ? this.pick(this.mouse.x, this.mouse.y) : -1;
        if (tid !== this.view.hoverT) {
          this.view.hoverT = tid; this.view.refresh();
          this.app.canvas.style.cursor = tid >= 0 && this.view.targets.has(tid) ? 'pointer' : 'default';
        }
      }
      // Labels
      const W = window.innerWidth, H = window.innerHeight;
      const small = this.rts.dist > 80;
      for (const [tid, el] of this.labelEls) {
        const s = this.view.map.sites[tid];
        const p = this.screenPos(s.x, this.view.tileHeight(s.x, s.z) + 3.2, s.z);
        if (!p || p.x < -80 || p.x > W + 80 || p.y < -40 || p.y > H + 40) { el.style.display = 'none'; continue; }
        el.style.display = '';
        el.style.transform = `translate(${p.x | 0}px, ${p.y | 0}px) translate(-50%, -100%)`;
        el.classList.toggle('small', small);
      }
      for (const [id, el] of this.armyEls) {
        const tok = this.view.tokens.get(id);
        if (!tok) { el.style.display = 'none'; continue; }
        const p = this.screenPos(tok.mesh.position.x, tok.mesh.position.y + 2.8, tok.mesh.position.z);
        if (!p) { el.style.display = 'none'; continue; }
        el.style.display = '';
        el.style.transform = `translate(${p.x | 0}px, ${p.y | 0}px) translate(-50%, -100%)`;
      }
    }
  }

  RW.CampaignScene = CampaignScene;
})();
