import { MODIFIER_MAP } from '../data/modifiers';
import { PASSIVE_MAP } from '../data/passives';
import { SYNERGIES } from '../data/synergies';
import type { PassiveId } from '../data/types';
import { SPECIAL_MAP } from '../data/upgrades';
import { WEAPON_MAX_LEVEL } from '../data/weapons';
import { engine } from '../game/Engine';
import { evolutionRequirement } from '../game/items/UpgradeSystem';

const pct = (v: number) => `${v >= 0 ? '+' : ''}${Math.round(v * 100)}%`;

export function Inventory() {
  const run = engine.run;
  if (!run) return null;
  const s = run.stats;
  const rows: [string, string, string][] = [
    ['Max HP', `${s.maxHp}`, 'Total health.'], ['Move speed', s.moveSpeed.toFixed(2), 'Units per second.'], ['Armor', s.armor.toFixed(1), 'Each point reduces incoming damage with diminishing returns (20 armor halves damage).'],
    ['Damage', pct(s.damageMult - 1), 'Multiplies all weapon damage.'], ['Crit chance', `${Math.round(s.critChance * 100)}%`, 'Chance for a hit to be critical (luck adds a little).'], ['Crit damage', `x${s.critDamage.toFixed(2)}`, 'Critical hits multiply damage by this.'],
    ['Cooldowns', pct(s.cooldownMult - 1), 'Lower is faster. Applies to every weapon.'], ['Area', pct(s.areaMult - 1), 'Size of swings, explosions, clouds and orbits.'], ['Duration', pct(s.durationMult - 1), 'How long projectiles and effects last.'],
    ['Projectile speed', pct(s.projectileSpeedMult - 1), 'Speed of projectiles.'], ['Extra projectiles', `+${s.extraProjectiles}`, 'Added to projectile counts.'], ['XP gain', pct(s.xpGain - 1), 'Multiplies experience from gems.'],
    ['Pickup radius', s.pickupRadius.toFixed(1), 'Distance at which gems and coins fly to you.'], ['Luck', `${Math.round(s.luck)}`, 'Better rarity rolls, drops and a little crit.'], ['Regen', `${s.regen.toFixed(2)}/s`, 'Health restored per second.'],
    ['Knockback', pct(s.knockbackMult - 1), 'How far your hits push enemies.'], ['Gold gain', pct(s.goldGain - 1), 'Multiplies gold from coins.'], ['Thorns', `${Math.round(s.thorns * 100)}%`, 'Damage reflected to attackers.'],
    ['Explosive dmg', pct(s.explosiveMult - 1), 'Bonus for explosions, quakes and clouds.'], ['DoT damage', pct(s.dotMult - 1), 'Poison and burn damage.'], ['Status duration', pct(s.statusDuration - 1), 'Burn, slow and shock durations.'],
    ['Summon damage', pct(s.summonMult - 1), 'Drones and coils.'], ['Healing', pct(s.healMult - 1), 'Healing received.'], ['Knockback resist', `${Math.round(s.knockbackResist * 100)}%`, 'Resistance to being pushed.'],
  ];
  return (
    <div className="inventory">
      <div className="inv-col">
        <h4>Weapons</h4>
        {run.weapons.list.map((w) => {
          const evo = w.def.evolution;
          const pl = run.passives[evo.passive] ?? 0;
          const req = evolutionRequirement(run, w.id);
          const ready = !w.evolved && w.level >= WEAPON_MAX_LEVEL && pl >= req;
          return (
            <div key={w.id} className={`inv-row ${w.evolved ? 'evolved' : ''} ${ready ? 'ready' : ''}`}>
              <span className="inv-icon">{w.evolved ? evo.icon : w.def.icon}</span>
              <div>
                <div className="inv-name">{w.evolved ? evo.name : w.def.name} <span className="inv-lvl">Lv {w.level}/{WEAPON_MAX_LEVEL}</span></div>
                <div className="inv-sub">{w.evolved ? evo.description : `Evolve → ${evo.name}: Lv ${WEAPON_MAX_LEVEL} (${w.level}/${WEAPON_MAX_LEVEL}) + ${PASSIVE_MAP[evo.passive].icon} ${PASSIVE_MAP[evo.passive].name} Lv ${req} (${pl}/${req})${ready ? ' — READY!' : ''}`}</div>
                <div className="inv-tags">{w.def.tags.map((t) => <span key={t}>{t}</span>)}</div>
              </div>
            </div>
          );
        })}
        <h4>Items</h4>
        {(Object.entries(run.passives) as [PassiveId, number][]).filter(([, l]) => l > 0).map(([id, l]) => (
          <div key={id} className="inv-row">
            <span className="inv-icon">{PASSIVE_MAP[id].icon}</span>
            <div><div className="inv-name">{PASSIVE_MAP[id].name} <span className="inv-lvl">Lv {l}/{PASSIVE_MAP[id].maxLevel}</span></div><div className="inv-sub">{PASSIVE_MAP[id].levelText(l)}</div></div>
          </div>
        ))}
        {!Object.values(run.passives).some(Boolean) && <div className="inv-sub">No items yet. Pick them on level up.</div>}
        {run.specials.size > 0 && <>
          <h4>Legendary traits</h4>
          {[...run.specials].map((id) => (
            <div key={id} className="inv-row evolved"><span className="inv-icon">{SPECIAL_MAP[id].icon}</span><div><div className="inv-name">{SPECIAL_MAP[id].name}</div><div className="inv-sub">{SPECIAL_MAP[id].description}</div></div></div>
          ))}
        </>}
        {run.opts.modifiers.length > 0 && <>
          <h4>Run modifiers</h4>
          {run.opts.modifiers.map((id) => (
            <div key={id} className="inv-row"><span className="inv-icon">{MODIFIER_MAP[id].icon}</span><div><div className="inv-name">{MODIFIER_MAP[id].name}</div><div className="inv-sub">{MODIFIER_MAP[id].description}</div></div></div>
          ))}
        </>}
      </div>
      <div className="inv-col">
        <h4>Synergies ({run.synergies.length} active)</h4>
        <div className="syn-list">
          {SYNERGIES.map((sy) => {
            const on = run.synergies.includes(sy.id);
            return (
              <div key={sy.id} className={`syn ${on ? 'on' : ''}`} title={sy.hint}>
                <span>{sy.icon}</span>
                <div><b>{sy.name}</b><div className="inv-sub">{on ? sy.description : `How: ${sy.hint}`}</div></div>
              </div>
            );
          })}
        </div>
        <h4>Current stats <span className="dim">(hover for details)</span></h4>
        <div className="stat-grid">{rows.map(([k, v, tip]) => <div key={k} title={tip}><span>{k}</span><b>{v}</b></div>)}</div>
      </div>
    </div>
  );
}
