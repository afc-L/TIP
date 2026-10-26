import { PASSIVE_MAP } from '../data/passives';
import type { PassiveId } from '../data/types';
import { WEAPON_MAX_LEVEL } from '../data/weapons';
import { engine } from '../game/Engine';

const pct = (v: number) => `${v >= 0 ? '+' : ''}${Math.round(v * 100)}%`;

export function Inventory() {
  const run = engine.run;
  if (!run) return null;
  const s = run.stats;
  const rows: [string, string][] = [
    ['Max HP', `${s.maxHp}`], ['Move speed', s.moveSpeed.toFixed(2)], ['Armor', s.armor.toFixed(1)],
    ['Damage', pct(s.damageMult - 1)], ['Crit chance', `${Math.round(s.critChance * 100)}%`], ['Crit damage', `x${s.critDamage.toFixed(2)}`],
    ['Cooldowns', pct(s.cooldownMult - 1)], ['Area', pct(s.areaMult - 1)], ['Duration', pct(s.durationMult - 1)],
    ['Projectile speed', pct(s.projectileSpeedMult - 1)], ['Extra projectiles', `+${s.extraProjectiles}`], ['XP gain', pct(s.xpGain - 1)],
    ['Pickup radius', s.pickupRadius.toFixed(1)], ['Luck', `${Math.round(s.luck)}`], ['Regen', `${s.regen.toFixed(2)}/s`],
    ['Knockback', pct(s.knockbackMult - 1)], ['Gold gain', pct(s.goldGain - 1)], ['Thorns', `${Math.round(s.thorns * 100)}%`],
    ['Explosive dmg', pct(s.explosiveMult - 1)], ['Knockback resist', `${Math.round(s.knockbackResist * 100)}%`],
  ];
  return (
    <div className="inventory">
      <div className="inv-col">
        <h4>Weapons</h4>
        {run.weapons.list.map((w) => {
          const evo = w.def.evolution;
          const pl = run.passives[evo.passive] ?? 0;
          return (
            <div key={w.id} className={`inv-row ${w.evolved ? 'evolved' : ''}`}>
              <span className="inv-icon">{w.evolved ? evo.icon : w.def.icon}</span>
              <div>
                <div className="inv-name">{w.evolved ? evo.name : w.def.name} <span className="inv-lvl">Lv {w.level}/{WEAPON_MAX_LEVEL}</span></div>
                <div className="inv-sub">{w.evolved ? 'EVOLVED' : `Evolve → ${evo.name}: max level + ${PASSIVE_MAP[evo.passive].name} Lv ${evo.passiveLevel} (${pl}/${evo.passiveLevel})`}</div>
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
        {!Object.values(run.passives).some(Boolean) && <div className="inv-sub">No items yet.</div>}
      </div>
      <div className="inv-col">
        <h4>Current stats</h4>
        <div className="stat-grid">{rows.map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}</div>
      </div>
    </div>
  );
}
