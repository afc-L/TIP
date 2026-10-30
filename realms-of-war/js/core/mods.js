// Folds every source of army bonuses (legendary passive, equipment, commander skills, doctrine,
// technology, landmarks) into one flat modifier object used by battles and the campaign.
(function () {
  const RW = window.RW;
  const MUL = new Set(['dmgMul', 'rdmgMul', 'rangeMul', 'speedAll', 'infDmg', 'cavSpeed', 'monHp', 'genHp', 'scoutSpeed', 'siegeDmg', 'upkeepMul', 'cdMul', 'resPool', 'gateMul']);

  function merge(A, m) {
    if (!m) return;
    for (const k in m) {
      const v = m[k];
      if (typeof v !== 'number') continue;
      if (MUL.has(k)) A[k] = (A[k] || 1) * v; else A[k] = (A[k] || 0) + v;
    }
  }

  // opts: { commander: {legend, items, skills}, doctrine, techs: [ids], landmarks: [keys] }
  RW.compileArmyMods = function (opts = {}) {
    const D = RW.data;
    const A = {};
    const cmd = opts.commander || {};
    if (cmd.legend && D.LEGENDS[cmd.legend]) merge(A, D.LEGENDS[cmd.legend].passive.mods);
    for (const slot of ['weapon', 'armor', 'trinket']) {
      const id = cmd.items && cmd.items[slot];
      if (id && D.ITEMS[id]) merge(A, D.ITEMS[id].mods);
    }
    const sk = cmd.skills || {};
    const r = (id) => sk[id] || 0;
    merge(A, {
      genAtk: r('blade') * 4, genDef: r('blade') * 4, infDef: r('drill') * 2, morale: r('inspire') * 3,
      replenish: r('medic') * 0.05,
      dmgMul: 1 + r('tactics') * 0.03, gateMul: 1 + r('siege') * 0.5, siegeDmg: 1 + r('siege') * 0.1,
      cdMul: 1 - r('arcana') * 0.08, upkeepMul: 1 - r('supply') * 0.05, scoutSpeed: 1 + r('scout') * 0.05,
    });
    if (opts.doctrine && D.DOCTRINES[opts.doctrine]) merge(A, D.DOCTRINES[opts.doctrine].mods);
    if (opts.techs && opts.faction) {
      const tech = D.techFor(opts.faction);
      for (const id of opts.techs) {
        const t = tech.find((x) => x.id === id);
        if (!t) continue;
        const e = t.effect;
        merge(A, { infAtk: e.infAtk || 0, cavCharge: e.cavCharge || 0, morale: e.morale || 0, cdMul: e.cdMul || 1, rdmgMul: e.rdmgMul || 1 });
      }
    }
    for (const key of opts.landmarks || []) { const l = D.LANDMARKS[key]; if (l && l.morale) merge(A, { morale: l.morale }); }
    return A;
  };

  // Human-readable list of the active bonuses (for tooltips and the army screen).
  RW.describeMods = function (A) {
    const out = [];
    const pct = (v) => (v > 1 ? '+' : '') + Math.round((v - 1) * 100) + '%';
    if (A.morale) out.push(`Morale +${A.morale}`);
    if (A.dmgMul && A.dmgMul !== 1) out.push(`Melee damage ${pct(A.dmgMul)}`);
    if (A.infDmg && A.infDmg !== 1) out.push(`Infantry damage ${pct(A.infDmg)}`);
    if (A.rdmgMul && A.rdmgMul !== 1) out.push(`Missile damage ${pct(A.rdmgMul)}`);
    if (A.rangeMul && A.rangeMul !== 1) out.push(`Range ${pct(A.rangeMul)}`);
    if (A.speedAll && A.speedAll !== 1) out.push(`Speed ${pct(A.speedAll)}`);
    if (A.infDef) out.push(`Infantry defence +${A.infDef}`);
    if (A.infArmor) out.push(`Infantry armour +${A.infArmor}`);
    if (A.infAtk) out.push(`Infantry attack +${A.infAtk}`);
    if (A.cavCharge) out.push(`Cavalry charge +${A.cavCharge}`);
    if (A.cavAtk) out.push(`Cavalry attack +${A.cavAtk}`);
    if (A.cavSpeed && A.cavSpeed !== 1) out.push(`Cavalry speed ${pct(A.cavSpeed)}`);
    if (A.monHp && A.monHp !== 1) out.push(`Monster health ${pct(A.monHp)}`);
    if (A.monArmor) out.push(`Monster armour +${A.monArmor}`);
    if (A.genAtk) out.push(`Bodyguard attack +${A.genAtk}`);
    if (A.genDef) out.push(`Bodyguard defence +${A.genDef}`);
    if (A.genArmor) out.push(`Bodyguard armour +${A.genArmor}`);
    if (A.cdMul && A.cdMul !== 1) out.push(`Ability cooldowns ${pct(A.cdMul)}`);
    if (A.upkeepMul && A.upkeepMul !== 1) out.push(`Upkeep ${pct(A.upkeepMul)}`);
    if (A.replenish) out.push(`Replenishment +${Math.round(A.replenish * 100)}%`);
    if (A.harvest) out.push(`Heal ${Math.round(A.harvest * 100)}% of kills`);
    if (A.defAll) out.push(`Defence ${A.defAll > 0 ? '+' : ''}${A.defAll}`);
    return out;
  };
})();
