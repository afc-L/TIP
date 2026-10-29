// App shell: renderer, main loop, scene switching, window focus/resize handling.
(function () {
  const RW = window.RW;
  const ui = RW.ui;

  const app = {
    scene: null,
    init() {
      ui.init();
      const q = RW.quality();
      const canvas = document.getElementById('view');
      let renderer;
      try {
        renderer = new THREE.WebGLRenderer({ canvas, antialias: q.antialias, powerPreference: 'high-performance' });
      } catch (e) {
        document.getElementById('screens').innerHTML = '<div class="screen fatal"><h1>WebGL unavailable</h1><p>Realms of War needs a browser with WebGL enabled (Chrome, Edge, Firefox or Safari).</p></div>';
        return;
      }
      this.renderer = renderer;
      this.canvas = canvas;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.applyGraphics();
      window.addEventListener('resize', () => this.resize());
      document.addEventListener('visibilitychange', () => { if (document.hidden) RW.audio.suspend(); else RW.audio.resume(); });
      // Audio can only start after a user gesture.
      const unlock = () => { RW.audio.init(); RW.audio.resume(); RW.audio.music(this.scene instanceof RW.BattleScene ? 'battle' : 'campaign'); };
      window.addEventListener('pointerdown', unlock, { once: true });
      window.addEventListener('keydown', unlock, { once: true });
      this.resize();
      this.last = performance.now();
      this.fpsT = 0; this.frames = 0;
      requestAnimationFrame((t) => this.loop(t));
      RW.menus.main();
      document.getElementById('loading').remove();
    },
    applyGraphics() {
      if (!this.renderer) return;
      const q = RW.quality();
      this.renderer.setPixelRatio(q.pixelRatio);
      this.renderer.shadowMap.enabled = q.shadows;
      this.renderer.shadowMap.type = THREE.PCFShadowMap;
      this.resize();
    },
    resize() {
      if (!this.renderer) return;
      this.renderer.setSize(window.innerWidth, window.innerHeight, false);
      if (this.scene && this.scene.resize) this.scene.resize();
    },
    setScene(next) {
      const prev = this.scene;
      if (prev === next) return;
      if (prev) { if (prev.persistent) prev.deactivate(); else prev.dispose(); }
      this.scene = next;
      if (next && next.resize) next.resize();
    },
    loop(t) {
      requestAnimationFrame((tt) => this.loop(tt));
      const dt = Math.min(0.1, (t - this.last) / 1000);
      this.last = t;
      if (document.hidden || !this.scene) return;
      try {
        this.scene.update(dt);
        this.renderer.render(this.scene.scene, this.scene.camera);
      } catch (e) {
        console.error(e);
        if (!this.errShown) { this.errShown = true; ui.toast('Error: ' + e.message, 'bad', 8000); }
      }
    },

    // ---------------------------------------------------------------- navigation
    mainMenu() {
      ui.closeModal();
      const cs = this.campaignScene;
      this.campaignScene = null;
      if (cs) { cs.dispose(); if (this.scene === cs) this.scene = null; }
      RW.menus.main();
    },
    newCampaignScreen() { this.mainMenu(); RW.menus.newCampaign(); },
    continueCampaign() {
      const c = RW.Campaign.load();
      if (!c) { ui.toast('No saved campaign found.', 'warn'); return; }
      this.startCampaign(c);
    },
    startCampaign(c) {
      ui.show(null); ui.closeModal();
      c.save();
      const cs = new RW.CampaignScene(this, c);
      this.setScene(cs);
      this.campaignScene = cs;
      ui.toast(`Turn ${c.turn} — ${RW.data.FACTIONS[c.player].name}`, 'info');
    },
    startQuickBattle(cfg) {
      ui.show(null); ui.closeModal();
      const bs = new RW.BattleScene(this, cfg, () => { this.mainMenu(); });
      this.setScene(bs);
    },
    openSettings(back) { RW.menus.settings(back); },
    showHelp(back) { RW.menus.help(back); },
  };

  RW.app = app;
  window.addEventListener('DOMContentLoaded', () => app.init());
})();
