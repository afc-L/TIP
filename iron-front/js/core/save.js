// Persistent player profile (localStorage, guarded so private windows still work).
(function (G) {
  'use strict';
  const IF = G.IF;
  const KEY = 'ironfront.profile.v1';

  const defaults = () => ({
    xp: 0, medals: [], achievements: [],
    stats: { battles: 0, wins: 0, losses: 0, hardWins: 0, kills: 0, deaths: 0, headshots: 0, shots: 0, hits: 0, revives: 0, captures: 0,
      vehiclesDestroyed: 0, helisDown: 0, vehicleKills: 0, commands: 0, timesRevived: 0, timePlayed: 0, bestBattleXp: 0, longest: 0, distanceDriven: 0 },
    settings: { army: 0, cls: 'rifle', difficulty: 'regular', graphics: 'medium', layout: 'random', time: 'random', weather: 'random', size: 'standard',
      voice: true, volume: 0.8, sens: 1.0, fov: 75, invertY: false },
    loadout: {},  // class id -> { primary, optic, barrel, uniform }
  });

  function load() {
    let p = defaults();
    try {
      const raw = G.localStorage && G.localStorage.getItem(KEY);
      if (raw) {
        const o = JSON.parse(raw);
        p = Object.assign(defaults(), o);
        p.stats = Object.assign(defaults().stats, o.stats || {});
        p.settings = Object.assign(defaults().settings, o.settings || {});
        p.loadout = o.loadout || {};
      }
    } catch (e) { /* ignore */ }
    return p;
  }

  IF.Profile = load();
  IF.saveProfile = function () {
    try { G.localStorage && G.localStorage.setItem(KEY, JSON.stringify(IF.Profile)); } catch (e) { /* ignore */ }
  };
  IF.resetProfile = function () { IF.Profile = defaults(); IF.saveProfile(); };

  IF.rankIndex = function (xp) {
    let r = 0;
    for (let i = 0; i < IF.RANKS.length; i++) if (xp >= IF.RANKS[i][2]) r = i;
    return r;
  };
  IF.loadoutFor = function (clsId) {
    const c = IF.CLASSES.find((k) => k.id === clsId) || IF.CLASSES[0];
    const l = Object.assign({ primary: c.primary[0], optic: 'none', barrel: 'none', uniform: 'std' }, IF.Profile.loadout[clsId] || {});
    const rank = IF.rankIndex(IF.Profile.xp);
    if (!c.primary.includes(l.primary) || IF.WEAPONS[l.primary].rank > rank) l.primary = c.primary[0];
    if ((IF.ATTACHMENTS[l.optic] || {}).rank > rank) l.optic = 'none';
    if ((IF.ATTACHMENTS[l.barrel] || {}).rank > rank) l.barrel = 'none';
    const u = IF.UNIFORMS.find((k) => k.id === l.uniform);
    if (!u || u.rank > rank) l.uniform = 'std';
    return l;
  };
})(typeof window !== 'undefined' ? window : globalThis);
