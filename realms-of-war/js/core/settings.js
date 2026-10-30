// Persistent player settings (graphics, sound, camera).
(function () {
  const RW = window.RW;
  const KEY = 'realmsOfWar.settings.v1';
  const DEFAULTS = { quality: 'medium', volume: 0.7, music: true, sfx: true, camSens: 1.0, edgeScroll: true, tooltips: true, difficulty: 'normal', fastCampaign: false };

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return Object.assign({}, DEFAULTS, JSON.parse(raw));
    } catch (e) { /* storage unavailable */ }
    return Object.assign({}, DEFAULTS);
  }

  const settings = load();
  RW.settings = settings;
  RW.saveSettings = function () {
    try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) { /* ignore */ }
    if (RW.audio) RW.audio.applySettings();
    if (RW.app && RW.app.applyGraphics) RW.app.applyGraphics();
  };

  // Graphics presets.
  RW.quality = function () {
    const q = settings.quality;
    if (q === 'low') return { pixelRatio: 1, shadows: false, shadowSize: 0, terrainRes: 80, trees: 0.5, particles: 400, antialias: false };
    if (q === 'high') return { pixelRatio: Math.min(window.devicePixelRatio || 1, 2), shadows: true, shadowSize: 2048, terrainRes: 140, trees: 1.2, particles: 1500, antialias: true };
    return { pixelRatio: Math.min(window.devicePixelRatio || 1, 1.25), shadows: true, shadowSize: 1024, terrainRes: 110, trees: 0.85, particles: 900, antialias: true };
  };
})();
