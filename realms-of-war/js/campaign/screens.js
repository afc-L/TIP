// Extra campaign screens: diplomacy, research, army management (equipment, skills, doctrine, drill, banners),
// army inspection, statistics, notification history, save slots and the minimap.
(function () {
  const RW = window.RW;
  const U = RW.util;
  const D = RW.data;
  const ui = RW.ui;
  const P = RW.CampaignScene.prototype;
  const STATE_CLS = { war: 'bad', peace: 'mid', nap: 'mid', alliance: 'good' };

  P.rewardsHtml = function (rw) {
    if (!rw) return '';
    const items = (rw.items || []).map((it) => `<span class="item r-${it.rarity}">${RW.icon('gem')} ${U.escape(it.name)}</span>`).join(' ');
    return `<div class="rewards">
      ${rw.gold ? `<div>${RW.icon('gold', 'gold')} <b>+${rw.gold}</b> gold</div>` : ''}
      ${rw.cmdXp ? `<div>${RW.icon('crown')} ${U.escape(rw.cmdName || 'Commander')} +${rw.cmdXp} XP${rw.levelUp ? ` · <b>Level ${rw.levelUp}!</b>` : ''}</div>` : ''}
      ${items ? `<div>Found: ${items}</div>` : ''}
      ${(rw.extra || []).map((x) => `<div>${U.escape(x)}</div>`).join('')}
    </div>`;
  };
  P.checkGameOverAgain = function () { this.checkGameOver(); };

  // ---------------------------------------------------------------- ruins
  P.exploreRuins = function (a) {
    const out = this.c.explore(a);
    if (!out) { ui.toast('Nothing to explore here.', 'warn'); return; }
    RW.audio.play('magic');
    this.c.notify(out.text, 'good');
    ui.modal({ title: `✧ ${this.c.tdef(a.tid).name}`, cls: 'event', body: `<p>${U.escape(out.text)}</p>${out.item ? `<p class="center"><span class="item r-${D.ITEMS[out.item].rarity}">${RW.icon('gem')} ${D.ITEMS[out.item].name}</span><br><span class="dim">${D.ITEMS[out.item].desc} Equip it from Manage Army.</span></p>` : ''}`, buttons: [{ label: 'Excellent', cls: 'primary' }] });
    this.view.refresh(); this.refreshAll();
  };

  // ---------------------------------------------------------------- army management
  P.showArmyManager = function (a, tab = 'units') {
    const c = this.c, fs = c.factions[a.faction], cmd = a.commander;
    const leg = cmd.legend && D.LEGENDS[cmd.legend];
    const pts = c.skillPoints(a);
    const mods = c.armyMods(a);
    const inHome = c.terr(a.tid).owner === a.faction;
    const tabs = [['units', 'Units'], ['commander', `Commander${pts ? ` (${pts})` : ''}`], ['equipment', `Equipment${fs.items.length ? ` (${fs.items.length})` : ''}`], ['doctrine', 'Doctrine & Drill']];
    const unitRows = a.units.map((u, i) => {
      const ut = D.UNITS[u.typeId];
      const dl = fs.drill[u.typeId] || 0;
      return `<tr data-i="${i}"><td>${RW.unitIcon(u.typeId)} ${ut.name}${ut.rare ? ' <span class="r-rare">★</span>' : ''}</td><td>${ui.bar(u.hp, 'hp', Math.round(u.hp * 100) + '%')}</td><td>${'▲'.repeat(u.rank || 0) || '-'}</td><td>${u.xp || 0}</td><td>${dl ? 'Drill ' + dl : '-'}</td><td>${ut.upkeep}</td></tr>`;
    }).join('') || '<tr><td colspan="6" class="dim">No units. Recruit in one of your settlements.</td></tr>';
    const skills = D.SKILLS.map((sk) => {
      const r = cmd.skills[sk.id] || 0;
      return `<div class="skill ${r ? 'on' : ''}"><div><b>${sk.name}</b> <span class="dim">${sk.branch}</span><p>${sk.desc}</p></div><div class="pips">${'●'.repeat(r)}${'○'.repeat(sk.max - r)}</div><button class="btn sm sk" data-id="${sk.id}" ${!pts || r >= sk.max ? 'disabled' : ''}>Learn</button></div>`;
    }).join('');
    const slotHtml = ['weapon', 'armor', 'trinket'].map((slot) => {
      const id = cmd.items[slot];
      const it = id && D.ITEMS[id];
      return `<div class="eslot"><span class="dim">${slot[0].toUpperCase() + slot.slice(1)}</span>${it ? `<span class="item r-${it.rarity}" data-tip="${U.escape(it.desc)}">${RW.icon('gem')} ${U.escape(it.name)}</span><button class="btn sm uneq" data-slot="${slot}">Unequip</button>` : '<span class="dim">— empty —</span>'}</div>`;
    }).join('');
    const inv = fs.items.map((id, i) => {
      const it = D.ITEMS[id];
      return `<div class="inv"><span class="item r-${it.rarity}">${RW.icon('gem')} ${U.escape(it.name)}</span><span class="dim">${D.RARITY[it.rarity].name} ${it.slot}</span><p>${it.desc}</p><button class="btn sm eq" data-i="${i}">Equip</button></div>`;
    }).join('') || '<p class="dim">No spare equipment. Items are found after victories, in ruins and through events.</p>';
    const doctrines = Object.entries(D.DOCTRINES).map(([k, d]) => `<button class="btn sm doc ${a.doctrine === k ? 'primary' : ''}" data-k="${k}" ${inHome ? '' : 'disabled'} data-tip="${U.escape(d.desc)}">${d.name}</button>`).join('');
    const types = [...new Set(a.units.map((u) => u.typeId))];
    const drills = types.map((id) => {
      const lvl = fs.drill[id] || 0, cost = c.drillCost(a.faction, id);
      return `<div class="upg"><div><b>${D.UNITS[id].name}</b> <span class="dim">Drill ${lvl}/2</span><p>+2 attack, +2 defence and +3 morale per drill level, for every unit of this type.</p></div>${lvl >= 2 ? '<span class="ok">Mastered</span>' : `<button class="btn sm drl" data-id="${id}" ${fs.gold < cost ? 'disabled' : ''}>${cost} gold</button>`}</div>`;
    }).join('') || '<p class="dim">Recruit units to drill them.</p>';
    const banners = D.BANNER_COLORS.map((col) => `<span class="swatch ${(fs.banner || D.FACTIONS[a.faction].color) === col ? 'on' : ''}" data-c="${col}" style="background:${col}"></span>`).join('');
    const body = U.html(`<div class="manager">
      <div class="tabs">${tabs.map(([k, l]) => `<button class="btn sm ${k === tab ? 'on' : ''}" data-t="${k}">${l}</button>`).join('')}</div>
      <div class="tab" data-t="units"><table class="res-units"><tr><th>Unit</th><th>Strength</th><th>Rank</th><th>XP</th><th>Drill</th><th>Upkeep</th></tr>${unitRows}</table>
        <p class="dim">Hover a unit for its full card. Units gain ranks from kills (+attack, +defence, +morale).</p></div>
      <div class="tab" data-t="commander">
        <div class="cmd-head"><b>${U.escape(cmd.name)}</b> · Level ${cmd.level} · ${ui.bar(cmd.xp / (cmd.level * 100), 'xp', `XP ${cmd.xp}/${cmd.level * 100}`)}</div>
        ${leg ? `<div class="legend-card"><b>${leg.title}</b><p><i>${U.escape(leg.story)}</i></p><p><b>${leg.passive.name}:</b> ${leg.passive.desc}</p>${leg.abilities.map((ab) => `<p><b>${ab.name}</b> — ${ab.desc}</p>`).join('')}</div>` : cmd.trait && D.TRAITS[cmd.trait] ? `<p><b>${D.TRAITS[cmd.trait].name}:</b> ${D.TRAITS[cmd.trait].desc}</p>` : ''}
        <h4>Skills <span class="dim">(${pts} point${pts === 1 ? '' : 's'} — one per level)</span></h4><div class="skills">${skills}</div></div>
      <div class="tab" data-t="equipment"><h4>Equipped</h4>${slotHtml}<h4>Treasury</h4><div class="invlist">${inv}</div></div>
      <div class="tab" data-t="doctrine"><h4>Battle doctrine ${inHome ? '' : '<span class="dim">(change it in one of your settlements)</span>'}</h4><div class="docs">${doctrines}</div>
        <h4>Drill (per unit type, all armies)</h4>${drills}
        <h4>Banner colour</h4><div class="swatches">${banners}</div></div>
      <div class="mods dim">Army bonuses: ${U.escape(RW.describeMods(mods)) || 'none'}</div>
    </div>`);
    const show = (t) => {
      body.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.t === t));
      body.querySelectorAll('.tab').forEach((el) => (el.hidden = el.dataset.t !== t));
    };
    show(tab);
    body.querySelectorAll('.tabs button').forEach((b) => (b.onclick = () => show(b.dataset.t)));
    body.querySelectorAll('tr[data-i]').forEach((tr) => { const u = a.units[+tr.dataset.i]; tr._tip = () => ui.unitTip(u.typeId, `<div class="tip-live">Strength ${Math.round(u.hp * 100)}% · Rank ${u.rank || 0} · XP ${u.xp || 0}</div>`); tr.setAttribute('data-tip', ''); });
    const redo = (t, err) => {
      if (err) { ui.toast(err, 'warn'); RW.audio.play('error'); return; }
      RW.audio.play('build');
      ui.closeModal(); this.refreshAll(); this.view.refresh(); this.showArmyManager(a, t);
    };
    body.querySelectorAll('.sk').forEach((b) => (b.onclick = () => redo('commander', c.learnSkill(a, b.dataset.id))));
    body.querySelectorAll('.eq').forEach((b) => (b.onclick = () => redo('equipment', c.equip(a, +b.dataset.i))));
    body.querySelectorAll('.uneq').forEach((b) => (b.onclick = () => { c.unequip(a, b.dataset.slot); redo('equipment'); }));
    body.querySelectorAll('.doc').forEach((b) => (b.onclick = () => redo('doctrine', c.setDoctrine(a, b.dataset.k))));
    body.querySelectorAll('.drl').forEach((b) => (b.onclick = () => redo('doctrine', c.drill(a.faction, b.dataset.id))));
    body.querySelectorAll('.swatch').forEach((sw) => (sw.onclick = () => { fs.banner = sw.dataset.c === D.FACTIONS[a.faction].color ? null : sw.dataset.c; redo('doctrine'); }));
    ui.modal({ title: `${ui.emblem(a.faction, 26)} ${U.escape(cmd.name)}'s Army`, cls: 'wide', body, buttons: [{ label: 'Close' }] });
  };

  // Read-only look at any army (enemy armies before attacking them).
  P.inspectArmy = function (a) {
    const c = this.c, cmd = a.commander;
    const leg = cmd.legend && D.LEGENDS[cmd.legend];
    const rows = a.units.map((u, i) => `<tr data-i="${i}"><td>${RW.unitIcon(u.typeId)} ${D.UNITS[u.typeId].name}</td><td>${ui.bar(u.hp, 'hp', Math.round(u.hp * 100) + '%')}</td><td>${'▲'.repeat(u.rank || 0) || '-'}</td><td>${D.UNITS[u.typeId].cat}</td></tr>`).join('');
    const mine = this.selArmy && this.selArmy.faction === c.player && c.armies.includes(this.selArmy) ? this.selArmy : null;
    let odds = '';
    if (mine && c.adj(mine.tid).includes(a.tid) && c.canMoveTo(mine, a.tid)) {
      const p = c.odds(c.battleSetup(mine, a.tid));
      odds = `<div class="odds"><span>Auto-resolve odds if ${U.escape(mine.commander.name)} attacks</span>${ui.bar(p, p > 0.6 ? 'good' : p < 0.4 ? 'bad' : 'mid', Math.round(p * 100) + '%')}</div>`;
    }
    const body = U.html(`<div><p>${D.FACTIONS[a.faction].name} · Level ${cmd.level}${leg ? ` · <b>${leg.title}</b>` : cmd.trait && D.TRAITS[cmd.trait] ? ' · ' + D.TRAITS[cmd.trait].name : ''} · Strength <b>${Math.round(c.armyPower(a))}</b></p>
      <table class="res-units"><tr><th>Unit</th><th>Strength</th><th>Rank</th><th>Type</th></tr>${rows}</table>${odds}</div>`);
    body.querySelectorAll('tr[data-i]').forEach((tr) => { const u = a.units[+tr.dataset.i]; tr.setAttribute('data-tip', ''); tr._tip = () => ui.unitTip(u.typeId); });
    ui.modal({ title: `${ui.emblem(a.faction, 26)} ${U.escape(cmd.name)}`, cls: 'wide', body, buttons: [{ label: 'Close' }] });
  };

  // ---------------------------------------------------------------- diplomacy
  P.showDiplomacy = function () {
    const c = this.c, p = c.player, fs = this.me;
    const others = c.majors.filter((f) => f !== p);
    const cards = others.map((f) => {
      const r = c.rel(p, f), alive = c.factions[f].alive;
      const opinion = Math.round(r.opinion);
      const mem = r.memory.slice(-4).reverse().map((m) => `<div class="${m.delta >= 0 ? 'good' : 'bad'}">T${m.turn}: ${U.escape(m.text)} (${m.delta > 0 ? '+' : ''}${m.delta})</div>`).join('') || '<div class="dim">No dealings yet.</div>';
      const theirs = others.filter((g) => g !== f && c.factions[g].alive).map((g) => `<span class="${STATE_CLS[c.rel(f, g).state]}" data-tip="${D.FACTIONS[f].short} & ${D.FACTIONS[g].short}: ${RW.Campaign.STATES[c.rel(f, g).state]}">${ui.emblem(g, 16)}</span>`).join('');
      const enemies = others.filter((g) => g !== f && c.factions[g].alive && c.atWar(p, g));
      const btn = (k, label, dis, tip) => `<button class="btn sm dp" data-f="${f}" data-k="${k}" ${dis || !alive ? 'disabled' : ''} data-tip="${tip}">${label}</button>`;
      return `<div class="dcard ${alive ? '' : 'dead'}">
        <div class="dhead">${ui.emblem(f, 30)}<div><b>${D.FACTIONS[f].name}</b><br><span class="${STATE_CLS[r.state]}">${alive ? RW.Campaign.STATES[r.state] : 'Destroyed'}</span> · Opinion <b class="${opinion >= 0 ? 'good' : 'bad'}">${opinion > 0 ? '+' : ''}${opinion}</b></div></div>
        <div class="dim">${c.owned(f).length} territories · ${c.armiesOf(f).length} armies · ${U.fmt(c.factions[f].gold)} gold</div>
        <div class="drels">Their relations: ${theirs || '-'}</div>
        <div class="dmem">${mem}</div>
        <div class="dbtns">
          ${r.state === 'war' ? btn('peace', 'Propose Peace', false, 'End the war. More likely after a long war, when they are losing, or with gifts.') : btn('war', 'Declare War', false, 'Breaking a treaty early angers every faction.')}
          ${btn('nap', 'Non-Aggression Pact', r.state === 'war' || r.state === 'nap' || r.state === 'alliance', 'Neither side may attack the other.')}
          ${btn('alliance', 'Propose Alliance', r.state === 'war' || r.state === 'alliance', 'Allies send troops to battles next to their armies, and fight your enemies. Needs a shared enemy and good relations.')}
          ${btn('gift', 'Gift 200 gold', fs.gold < 200, 'Improves their opinion of you.')}
          ${btn('gold', 'Request 400 gold', r.state !== 'alliance', 'Allies with full coffers may lend gold (costs opinion).')}
          ${enemies.length ? `<select class="aid-t" data-f="${f}">${enemies.map((g) => `<option value="${g}">${D.FACTIONS[g].short}</option>`).join('')}</select>${btn('aid', 'Request Military Aid', r.state !== 'alliance', 'Ask your ally to march against a common enemy for six turns.')}` : ''}
        </div></div>`;
    }).join('');
    const body = U.html(`<div class="diplo"><p class="center dim">Factions remember how you treat them. Battles, broken treaties and refusals sour relations; gifts, treaties and shared enemies improve them. You cannot march into the lands of a faction you are not at war with.</p><div class="dgrid">${cards}</div></div>`);
    body.querySelectorAll('.dp').forEach((b) => (b.onclick = () => {
      const f = b.dataset.f, k = b.dataset.k;
      let res;
      if (k === 'gift') res = c.diploGift(f, 200);
      else if (k === 'gold') res = c.diploRequestGold(f);
      else if (k === 'aid') res = c.diploRequestAid(f, body.querySelector(`.aid-t[data-f="${f}"]`).value);
      else res = c.diploPropose(f, k);
      ui.toast(res.text, res.ok ? 'good' : 'warn', 4000);
      c.notify(res.text, res.ok ? 'good' : 'info');
      RW.audio.play(res.ok ? (k === 'war' ? 'horn' : 'coin') : 'error');
      ui.closeModal(); this.updateTargets(); this.view.refresh(); this.refreshAll(); this.showDiplomacy();
    }));
    ui.modal({ title: 'Diplomacy', cls: 'wide', body, buttons: [{ label: 'Close' }] });
  };

  // ---------------------------------------------------------------- research
  P.showResearch = function () {
    const c = this.c, f = c.player, fs = this.me;
    const list = c.techList(f);
    const cats = ['Military', 'Economy', 'Magic', 'Infrastructure'];
    const cur = fs.research && list.find((t) => t.id === fs.research.id);
    const ult = D.FACTIONS[f].ultimate && D.ABILITIES[D.FACTIONS[f].ultimate];
    const rares = Object.values(D.UNITS).filter((u) => u.faction === f && u.rare).map((u) => `${u.name} (${list.find((t) => t.id === u.rare.tech).name})`).join(', ');
    const cols = cats.map((cat) => `<div class="tcol"><h4>${cat}</h4>${list.filter((t) => t.cat === cat).map((t) => {
      const known = fs.techs.includes(t.id), active = cur && cur.id === t.id;
      const err = c.canResearch(f, t.id);
      return `<div class="tech ${known ? 'known' : ''} ${active ? 'active' : ''}"><b>${t.name}</b><p>${t.desc}</p>${known ? '<span class="ok">Known</span>' : active ? `${ui.bar(fs.research.progress / t.turns, 'xp', `${Math.floor(fs.research.progress)}/${t.turns} turns`)}` : `<button class="btn sm rs" data-id="${t.id}" ${err ? `disabled data-tip="${U.escape(err)}"` : ''}>${t.cost} gold · ${t.turns} turns</button>`}</div>`;
    }).join('')}</div>`).join('');
    const body = U.html(`<div class="research"><p class="center dim">Research one technology at a time. ${cur ? `Now researching <b>${cur.name}</b>.` : '<b>Nothing is being researched.</b>'}${c.landmarksOf(f).includes('observatory') ? ' The Star Observatory speeds your research.' : ''}</p>
      <p class="center dim">Rare units: ${rares || '-'}${ult ? ` · Ultimate ability: <b>${ult.name}</b>` : ''}</p><div class="tgrid">${cols}</div></div>`);
    body.querySelectorAll('.rs').forEach((b) => (b.onclick = () => {
      const err = c.research(f, b.dataset.id);
      if (err) { ui.toast(err, 'warn'); RW.audio.play('error'); return; }
      RW.audio.play('magic');
      ui.closeModal(); this.refreshAll(); this.showResearch();
    }));
    ui.modal({ title: 'Research', cls: 'wide', body, buttons: [{ label: 'Close' }] });
  };

  // ---------------------------------------------------------------- statistics & notifications
  P.showStats = function (onClose) {
    const c = this.c, st = c.stats, fs = this.me;
    const body = U.html(`<div class="stats-screen">
      <div class="res-grid">
        <div><h3>Turn</h3><p>${c.turn}</p></div><div><h3>Battles</h3><p>${st.won} won · ${st.lost} lost</p></div>
        <div><h3>Captured</h3><p>${st.captured} territories</p></div><div><h3>Gold earned</h3><p>${U.fmt(st.goldEarned)}</p></div>
        <div><h3>Units recruited</h3><p>${st.recruited}</p></div><div><h3>Events</h3><p>${st.events}</p></div>
        <div><h3>Technologies</h3><p>${fs.techs.length}</p></div><div><h3>Ruins explored</h3><p>${c.explored.length}</p></div>
      </div>
      <h4>Territories held over time</h4><canvas class="graph" width="620" height="170"></canvas>
      <div class="legend">${c.majors.map((f) => `<span style="color:${D.FACTIONS[f].color}">■ ${D.FACTIONS[f].short}</span>`).join(' ')}</div>
    </div>`);
    ui.modal({ title: 'Campaign Statistics', cls: 'wide', body, buttons: [{ label: 'Close', onClick: onClose }] });
    const cv = body.querySelector('.graph'), ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
    const h = st.history;
    if (h.length > 1) {
      const max = Math.max(4, ...h.map((r) => Math.max(...c.majors.map((f) => r[f] || 0))));
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(0, (H * k) / 4); ctx.lineTo(W, (H * k) / 4); ctx.stroke(); }
      for (const f of c.majors) {
        ctx.beginPath();
        h.forEach((r, i) => { const x = (i / (h.length - 1)) * (W - 4) + 2, y = H - 4 - ((r[f] || 0) / max) * (H - 12); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
        ctx.strokeStyle = D.FACTIONS[f].color; ctx.lineWidth = f === c.player ? 3 : 1.5; ctx.stroke();
      }
    } else { ctx.fillStyle = '#aaa'; ctx.font = '13px sans-serif'; ctx.fillText('Play a few turns to see the history.', 20, H / 2); }
  };
  P.showNotifications = function () {
    const n = this.c.notifications.slice().reverse();
    const log = this.c.log.slice().reverse();
    const body = U.html(`<div class="notes"><div class="tabs"><button class="btn sm on" data-t="n">Notifications</button><button class="btn sm" data-t="l">Chronicle</button></div>
      <div class="tab" data-t="n">${n.map((x) => `<div class="note-row ${x.kind}"><span class="dim">T${x.turn}</span> ${U.escape(x.text)}</div>`).join('') || '<p class="dim">Nothing yet.</p>'}</div>
      <div class="tab" data-t="l" hidden>${log.map((x) => `<div class="note-row"><span class="dim">T${x.turn}</span> ${U.escape(x.text)}</div>`).join('')}</div></div>`);
    body.querySelectorAll('.tabs button').forEach((b) => (b.onclick = () => {
      body.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('on', x === b));
      body.querySelectorAll('.tab').forEach((t) => (t.hidden = t.dataset.t !== b.dataset.t));
    }));
    ui.modal({ title: 'Messages', cls: 'wide', body, buttons: [{ label: 'Close' }] });
  };
  // Short toasts for this turn's important notifications (research, diplomacy).
  P.showTurnNotes = function () {
    const c = this.c;
    for (const n of c.notifications.filter((x) => x.turn === c.turn && !x.shown).slice(-3)) { n.shown = true; ui.toast(n.text, n.kind === 'bad' ? 'bad' : n.kind === 'good' ? 'good' : 'info', 4500); }
    this.refreshAll();
  };

  // ---------------------------------------------------------------- saving
  P.saveDialog = function () {
    const c = this.c;
    const saves = RW.Campaign.listSaves();
    const rows = RW.Campaign.SLOTS.filter((s) => s !== 'auto').map((slot) => {
      const sv = saves.find((x) => x.slot === slot);
      return `<button class="btn slot" data-s="${slot}">Slot ${slot} — ${sv ? `${D.FACTIONS[sv.player].short} · ${sv.mode} · turn ${sv.turn} · ${new Date(sv.savedAt).toLocaleString()}` : '<span class="dim">empty</span>'}</button>`;
    }).join('');
    const body = U.html(`<div class="slots"><p class="dim center">The campaign also autosaves every turn.</p>${rows}</div>`);
    body.querySelectorAll('.slot').forEach((b) => (b.onclick = () => {
      const ok = c.save(b.dataset.s);
      ui.closeModal();
      ui.toast(ok ? `Saved to slot ${b.dataset.s}.` : 'Could not save (storage unavailable).', ok ? 'good' : 'bad');
    }));
    ui.modal({ title: 'Save Game', body, buttons: [{ label: 'Cancel' }] });
  };

  // ---------------------------------------------------------------- minimap
  P.bindMinimap = function () {
    const cv = this.$('.c-mini');
    if (!cv) return;
    const go = (e) => {
      const r = cv.getBoundingClientRect(), ext = this.c.map.extent;
      this.rts.focus(((e.clientX - r.left) / r.width) * ext.x, ((e.clientY - r.top) / r.height) * ext.z);
    };
    cv.addEventListener('mousedown', (e) => { e.stopPropagation(); go(e); this.miniDrag = true; });
    cv.addEventListener('mousemove', (e) => { if (this.miniDrag && e.buttons & 1) go(e); });
    cv.addEventListener('mouseup', () => (this.miniDrag = false));
  };
  P.drawMinimap = function () {
    const cv = this.$ && this.$('.c-mini');
    if (!cv) return;
    const ctx = cv.getContext('2d'), W = cv.width, H = cv.height, c = this.c, m = c.map, ext = m.extent;
    const sx = W / ext.x, sz = H / ext.z;
    ctx.fillStyle = '#203e58'; ctx.fillRect(0, 0, W, H);
    const r = Math.max(1.6, m.HEX * sx * 1.05);
    for (const tl of m.tiles) {
      if (tl.t === -1) continue;
      const t = c.terr(tl.t);
      ctx.fillStyle = tl.border ? this.view.bannerOf(t.owner) : t.owner === 'rebels' ? '#7c7a6a' : this.view.bannerOf(t.owner);
      ctx.globalAlpha = tl.border ? 1 : 0.6;
      ctx.fillRect(tl.x * sx - r / 2, tl.z * sz - r / 2, r, r);
    }
    ctx.globalAlpha = 1;
    for (const a of c.armies) {
      const s = m.sites[a.tid];
      ctx.fillStyle = a.faction === c.player ? '#fff' : '#111';
      ctx.strokeStyle = this.view.bannerOf(a.faction);
      ctx.beginPath(); ctx.arc(s.x * sx - 4, s.z * sz + 2, 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    // Camera view marker
    const cx = this.rts.tx, cz = this.rts.tz;
    if (cx != null) {
      const w = this.rts.dist * 0.9 * sx, h = this.rts.dist * 0.6 * sz;
      ctx.strokeStyle = 'rgba(255,240,200,0.9)'; ctx.lineWidth = 1;
      ctx.strokeRect(cx * sx - w / 2, cz * sz - h / 2, w, h);
    }
  };
})();
