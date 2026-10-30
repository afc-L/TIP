// Commander abilities (cooldown based). Each faction has three; they need a living general.
(function () {
  const RW = window.RW;

  function alliesIn(b, side, x, z, r) {
    return b.units.filter((u) => u.side === side && !u.gone && Math.hypot(u.x - x, u.z - z) < r + u.radius * 0.5);
  }

  const EFFECTS = {
    rally_cry(b, side, x, z, def) {
      for (const u of alliesIn(b, side, x, z, def.radius)) {
        if (u.state === 'routing') { if (!u.shattered) b.rally(u, 45); continue; }
        u.morale += 30;
        u.addBuff({ name: 'Rally Cry', morale: 30, def: 8, t: 20 });
      }
      b.fx.push({ type: 'ring', x, z, r: def.radius, color: def.color, dur: 1.4 });
      b.fx.push({ type: 'sparkle', x, z, r: def.radius * 0.7, color: def.color });
      return 'horn';
    },
    cavalry_charge(b, side) {
      for (const u of b.units) {
        if (u.side !== side || u.gone) continue;
        if (u.cat === 'cav' || (u.isGeneral && u.t.model.kind === 'mounted')) {
          u.addBuff({ name: 'Cavalry Charge', chargeMul: 2, speedMul: 1.25, t: 15 });
          b.fx.push({ type: 'sparkle', x: u.x, z: u.z, r: u.radius, color: '#9fd0ff' });
        }
      }
      return 'horn';
    },
    healing_light(b, side, x, z, def) {
      for (const u of alliesIn(b, side, x, z, def.radius)) u.heal((u.maxPool - u.pool) * 0.3);
      b.fx.push({ type: 'pillar', x, z, r: def.radius, color: def.color, dur: 1.6 });
      b.fx.push({ type: 'sparkle', x, z, r: def.radius, color: def.color, up: true });
      return 'heal';
    },
    blood_frenzy(b, side, x, z, def) {
      for (const u of alliesIn(b, side, x, z, def.radius)) {
        if (u.state === 'routing') continue;
        u.morale += 20;
        u.addBuff({ name: 'Blood Frenzy', dmgMul: 1.25, morale: 20, t: 20 });
      }
      b.fx.push({ type: 'ring', x, z, r: def.radius, color: def.color, dur: 1.2 });
      b.fx.push({ type: 'sparkle', x, z, r: def.radius * 0.7, color: def.color });
      return 'horn';
    },
    earthshaker(b, side, x, z, def) {
      b.fx.push({ type: 'ring', x, z, r: def.radius, color: def.color, dur: 0.6 });
      b.pending.push({ at: b.time + 0.6, kind: 'fn', fn: () => {
        b.areaDamage(x, z, def.radius, 6, 0.5, b.sides[side].general, false, 25, side);
        for (const u of b.units) if (u.side !== side && !u.gone && Math.hypot(u.x - x, u.z - z) < def.radius + 8) u.morale -= 12;
        b.fx.push({ type: 'quake', x, z, r: def.radius });
        b.emit('impact', { explode: 'quake', x, z });
      } });
      return 'boom';
    },
    savage_charge(b, side) {
      for (const u of b.units) {
        if (u.side !== side || u.gone) continue;
        if (u.cat === 'cav' || u.cat === 'monster') {
          u.addBuff({ name: 'Savage Charge', chargeMul: 1.6, speedMul: 1.3, t: 15 });
          b.fx.push({ type: 'sparkle', x: u.x, z: u.z, r: u.radius, color: '#ff8a3a' });
        }
      }
      return 'horn';
    },
    fireball(b, side, x, z, def) {
      const g = b.sides[side].general;
      const sx = g && !g.gone ? g.x : x, sz = g && !g.gone ? g.z : z + 40;
      const d = Math.hypot(x - sx, z - sz);
      const flight = Math.max(0.5, d / 70);
      b.projectiles.push({ kind: 'fireball', x0: sx, y0: b.map.heightAt(sx, sz) + 3, z0: sz, x1: x, y1: b.map.heightAt(x, z) + 0.5, z1: z, t: 0, dur: flight, arc: d * 0.12, side });
      b.pending.push({ at: b.time + flight, kind: 'fn', fn: () => {
        b.areaDamage(x, z, def.radius, 9, 0.7, g, true, 12);
        b.fx.push({ type: 'explosion', x, z, r: def.radius, color: '#ff7a1a' });
        b.emit('impact', { explode: 'fire', x, z });
      } });
      return 'magic';
    },
    meteor(b, side, x, z, def) {
      const g = b.sides[side].general;
      b.fx.push({ type: 'target', x, z, r: def.radius, color: def.color, dur: 2.5 });
      b.projectiles.push({ kind: 'meteor', x0: x - 40, y0: 120, z0: z - 30, x1: x, y1: b.map.heightAt(x, z), z1: z, t: 0, dur: 2.5, arc: 0, side });
      b.pending.push({ at: b.time + 2.5, kind: 'fn', fn: () => {
        b.areaDamage(x, z, def.radius, 22, 0.7, g, true, 22);
        b.fx.push({ type: 'explosion', x, z, r: def.radius * 1.2, color: '#ff5a2a', big: true });
        b.emit('impact', { explode: 'meteor', x, z });
      } });
      return 'magic';
    },
    arcane_ward(b, side, x, z, def) {
      for (const u of alliesIn(b, side, x, z, def.radius)) {
        u.heal((u.maxPool - u.pool) * 0.2);
        u.addBuff({ name: 'Arcane Ward', armor: 25, t: 25 });
      }
      b.fx.push({ type: 'pillar', x, z, r: def.radius, color: def.color, dur: 1.6 });
      b.fx.push({ type: 'sparkle', x, z, r: def.radius, color: def.color, up: true });
      return 'heal';
    },
  };

  // Data-driven abilities (new factions, ultimates, legendary commanders).
  function fxFor(b, kind, x, z, r, color) {
    if (kind === 'arrows') {
      for (let k = 0; k < 40; k++) {
        const tx = x + (Math.random() - 0.5) * r * 2, tz = z + (Math.random() - 0.5) * r * 2;
        b.projectiles.push({ kind: 'arrow', x0: tx - 12, y0: b.map.heightAt(tx, tz) + 45, z0: tz + 18, x1: tx, y1: b.map.heightAt(tx, tz), z1: tz, t: -Math.random() * 0.5, dur: 0.9, arc: 0, side: -1 });
      }
      return;
    }
    if (kind === 'fire') { b.fx.push({ type: 'explosion', x, z, r, color }); return; }
    if (kind === 'quake') { b.fx.push({ type: 'quake', x, z, r }); return; }
    if (kind === 'roots') { b.fx.push({ type: 'roots', x, z, r, color }); return; }
    b.fx.push({ type: 'ring', x, z, r, color, dur: 1.2 });
    b.fx.push({ type: 'sparkle', x, z, r: r * 0.8, color, up: kind !== 'frost' });
    if (kind === 'frost') b.fx.push({ type: 'frost', x, z, r });
  }
  function generic(b, side, x, z, def) {
    const e = def.effect, gen = b.sides[side].general;
    const buff = () => (e.buff ? Object.assign({}, e.buff) : null);
    switch (e.kind) {
      case 'area_damage':
        b.fx.push({ type: 'target', x, z, r: def.radius, color: def.color, dur: 0.6 });
        b.pending.push({ at: b.time + 0.6, kind: 'fn', fn: () => {
          b.areaDamage(x, z, def.radius, e.dmg, e.ap, gen, false, e.morale || 0, side);
          fxFor(b, e.fx === 'arrows' ? 'magic' : e.fx, x, z, def.radius, def.color);
          b.fx.push({ type: 'magicburst', x, z, r: def.radius * 0.6 });
          b.emit('impact', { explode: 'fire', x, z });
        } });
        if (e.fx === 'arrows') fxFor(b, 'arrows', x, z, def.radius, def.color);
        return e.fx === 'arrows' ? 'arrows' : 'magic';
      case 'enemy_area':
        for (const u of b.units) {
          if (u.side === side || u.gone || Math.hypot(u.x - x, u.z - z) > def.radius + u.radius * 0.5) continue;
          if (e.morale) u.morale -= e.morale;
          const bf = buff(); if (bf) u.addBuff(bf);
        }
        if (e.dmg) b.areaDamage(x, z, def.radius, e.dmg, e.ap || 0, gen, false, 0, side);
        fxFor(b, e.fx, x, z, def.radius, def.color);
        return e.fx === 'fire' || e.fx === 'quake' ? 'boom' : 'magic';
      case 'ally_area':
        for (const u of alliesIn(b, side, x, z, def.radius)) {
          if (u.state === 'routing') { if (e.rally && !u.shattered) b.rally(u, 45); continue; }
          if (e.morale) u.morale += e.morale;
          if (e.heal) u.heal((u.maxPool - u.pool) * e.heal);
          const bf = buff(); if (bf) u.addBuff(bf);
        }
        fxFor(b, e.fx, x, z, def.radius, def.color);
        if (e.heal) b.fx.push({ type: 'pillar', x, z, r: def.radius, color: def.color, dur: 1.4 });
        return e.heal ? 'heal' : 'horn';
      case 'type_buff':
        for (const u of b.units) {
          if (u.side !== side || u.gone || u.equip) continue;
          const ok = e.cats.includes('all') || e.cats.includes(u.cat) || (u.fly && e.cats.includes('cav')) || (u.isGeneral && e.cats.includes('general')) || (u.isGeneral && u.t.model.kind === 'mounted' && e.cats.includes('cav'));
          if (!ok) continue;
          u.addBuff(buff());
          b.fx.push({ type: 'sparkle', x: u.x, z: u.z, r: u.radius, color: def.color });
        }
        return 'horn';
    }
    return 'magic';
  }

  // Returns true if the ability was cast.
  RW.castAbility = function (b, side, id, x, z) {
    const sd = b.sides[side];
    const ab = sd.abilities.find((a) => a.id === id);
    if (!ab || ab.cd > 0 || b.phase !== 'battle') return false;
    if (!sd.general || sd.general.gone) return false;
    const def = ab.def;
    if (def.target === 'point') {
      x = Math.max(-115, Math.min(115, x)); z = Math.max(-115, Math.min(115, z));
    }
    const snd = def.effect ? generic(b, side, x, z, def) : EFFECTS[id](b, side, x, z, def);
    ab.cd = ab.cdMax;
    b.note(`${def.name}`, side);
    b.emit('ability', { side, id, x, z, sound: snd, def });
    b.msg(`${side === 0 ? '' : 'Enemy '}${def.name}!`, side, side === 0 ? 'good' : 'bad');
    return true;
  };
})();
