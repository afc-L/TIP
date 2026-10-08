const $ = (id) => document.getElementById(id);

export class UI {
  constructor(game) {
    this.game = game;
    this.feedEl = $('feed');
    this.aimCanvas = $('aim');
    this.aimCtx = this.aimCanvas.getContext('2d');
    this.msgTimer = 0;

    for (const group of document.querySelectorAll('.opts[data-setting]')) {
      const key = group.dataset.setting;
      for (const b of group.querySelectorAll('button')) {
        b.addEventListener('click', () => {
          let v = b.dataset.v;
          if (v === 'true') v = true; else if (v === 'false') v = false;
          game.settings[key] = v;
          this.syncMenu();
        });
      }
    }
    this.syncMenu();
    $('btn-start').addEventListener('click', () => { game.audio.unlock(); this.hideMenu(); game.start(); game.requestLock(); });
    $('btn-tutorial').addEventListener('click', () => this.showTutorial(true));
    $('btn-tut-close').addEventListener('click', () => { this.showTutorial(false); if (game.running) game.requestLock(); });
    $('btn-resume').addEventListener('click', () => game.requestLock());
    $('btn-restart').addEventListener('click', () => { game.start(); game.requestLock(); });
    $('btn-help').addEventListener('click', () => this.showTutorial(true));
    $('btn-menu').addEventListener('click', () => game.toMenu());
  }

  syncMenu() {
    for (const group of document.querySelectorAll('.opts[data-setting]')) {
      const v = String(this.game.settings[group.dataset.setting]);
      for (const b of group.querySelectorAll('button')) b.classList.toggle('sel', b.dataset.v === v);
    }
  }

  hideLoading() { $('loading').classList.add('hidden'); }
  showMenu() { $('menu').classList.remove('hidden'); $('hud').classList.add('hidden'); $('pause').classList.add('hidden'); }
  hideMenu() { $('menu').classList.add('hidden'); $('hud').classList.remove('hidden'); }
  showTutorial(b) { $('tutorial').classList.toggle('hidden', !b); }
  get tutorialOpen() { return !$('tutorial').classList.contains('hidden'); }
  showPause(b) { $('pause').classList.toggle('hidden', !b); }
  setLockHint(b) { $('lockhint').classList.toggle('hidden', !b); }
  setSandbox(b) { $('sandbox-help').classList.toggle('hidden', !b); }

  message(title, sub = '', defeat = false, time = 0) {
    $('cm-title').textContent = title;
    $('cm-title').classList.toggle('defeat', defeat);
    $('cm-sub').textContent = sub;
    this.msgTimer = time;
  }

  feed(text, color = '#e8d7b0') {
    const d = document.createElement('div');
    d.textContent = text;
    d.style.color = color;
    this.feedEl.appendChild(d);
    while (this.feedEl.children.length > 5) this.feedEl.removeChild(this.feedEl.firstChild);
    setTimeout(() => { d.style.opacity = '0'; }, 2600);
    setTimeout(() => d.remove(), 3200);
  }

  update(dt) {
    const g = this.game;
    if (this.msgTimer > 0) { this.msgTimer -= dt; if (this.msgTimer <= 0) this.message(''); }
    const p = g.player;
    this.panel('p', p);
    const e = p?.target || g.fighters.find((f) => f !== p);
    $('e-panel').classList.toggle('hidden', !e);
    if (e) this.panel('e', e);
    this.drawAim();
    this.setLockHint(!g.input.locked && g.running && !g.attract && !g.paused && !this.tutorialOpen);
    // blood vignette
    const hurt = p ? 1 - Math.max(0, p.health) / 100 : 0;
    g.hurtFlash = Math.max(0, (g.hurtFlash || 0) - dt * 1.5);
    const pulse = hurt > 0.5 ? (Math.sin(performance.now() / 300) * 0.5 + 0.5) * (hurt - 0.5) : 0;
    $('vignette').style.opacity = Math.min(1, hurt * 0.45 + g.hurtFlash + pulse * 0.6).toFixed(3);
  }

  panel(prefix, f) {
    if (!f) return;
    $(prefix + '-name').textContent = f.name + (f.weaponDef ? ` — ${f.hasWeapon ? f.weaponDef.label : 'disarmed'}` : '');
    $(prefix + '-health').style.width = Math.max(0, f.health) + '%';
    $(prefix + '-stamina').style.width = Math.max(0, f.stamina) + '%';
    $(prefix + '-balance').style.width = Math.max(0, f.balance * 100) + '%';
    let s = '';
    if (f.state === 'dead') s = f.deathCause === 'decapitated' ? 'DECAPITATED' : 'DEAD';
    else if (f.koTime > 0) s = 'UNCONSCIOUS';
    else if (f.state === 'down') s = f === this.game.player ? 'DOWN — SPACE to rise' : 'DOWN';
    else if (f.state === 'rising') s = 'GETTING UP';
    else if (f.dazed > 0) s = 'DAZED';
    else if (f.balance < 0.35) s = 'OFF BALANCE';
    else if (f.jarred > 0.2) s = 'ARM JARRED';
    else if (f.stamina < 15) s = 'EXHAUSTED';
    else if (f.grabJoint) s = 'GRAPPLING';
    $(prefix + '-status').textContent = s;
    const inj = [];
    for (const n of f.severed) if (!f.severed.has(f.parts[n].parent)) inj.push('lost ' + prettyPart(n));
    if (f.limb.armR > 0 && f.limb.armR < 0.7) inj.push('sword arm hurt');
    if (f.limb.armL > 0 && f.limb.armL < 0.7) inj.push('off arm hurt');
    if ((f.limb.legL > 0 && f.limb.legL < 0.7) || (f.limb.legR > 0 && f.limb.legR < 0.7)) inj.push('leg wounded');
    $(prefix + '-inj').textContent = inj.join(' · ');
  }

  drawAim() {
    const g = this.game, p = g.player, c = this.aimCtx;
    const W = this.aimCanvas.width;
    c.clearRect(0, 0, W, W);
    if (!p) return;
    const inp = p.input;
    c.strokeStyle = inp.guard ? 'rgba(90,160,255,0.9)' : 'rgba(232,215,176,0.5)';
    c.lineWidth = 2;
    c.beginPath(); c.arc(W / 2, W / 2, W / 2 - 4, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = 'rgba(232,215,176,0.2)';
    c.beginPath(); c.moveTo(W / 2, 6); c.lineTo(W / 2, W - 6); c.moveTo(6, W / 2); c.lineTo(W - 6, W / 2); c.stroke();
    const x = W / 2 + (inp.aim.x / 0.8) * (W / 2 - 10);
    const y = W / 2 - ((inp.aim.y - 0.05) / 0.75) * (W / 2 - 10);
    const r = 4 + inp.aim.reach * 12;
    c.fillStyle = inp.power > 0.6 ? 'rgba(220,40,40,0.95)' : 'rgba(232,215,176,0.9)';
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(232,215,176,0.7)';
    c.font = '10px Georgia';
    c.fillText(inp.power > 0.6 ? 'GRIP' : 'relaxed', 6, W - 6);
  }
}

function prettyPart(n) {
  return n.replace(/([A-Z])$/, (m) => (m === 'R' ? ' (right)' : ' (left)')).replace('upperArm', 'arm').replace('forearm', 'forearm');
}
