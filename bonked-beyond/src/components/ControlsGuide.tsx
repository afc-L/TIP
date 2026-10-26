export function ControlsGuide() {
  const rows: [string, string][] = [
    ['W A S D / Arrow keys', 'Move'],
    ['Mouse', 'Aim knives (other weapons auto-target)'],
    ['Space / Right-click', 'Dodge roll (brief invulnerability)'],
    ['Shift', 'Sprint (uses stamina)'],
    ['Q / Left-click', 'SUPER BONK when the meter is full'],
    ['E', 'Interact: chests, shrines'],
    ['Esc / P', 'Pause'],
    ['1-4 / R', 'Pick an upgrade / reroll on level up'],
    ['Gamepad', 'Left stick move · A dodge · X super · B interact · Start pause'],
  ];
  return (
    <div className="controls">
      {rows.map(([k, v]) => <div key={k} className="ctrl-row"><kbd>{k}</kbd><span>{v}</span></div>)}
      <p className="hint">Weapons attack automatically. Walk over gems to gain XP, avoid red danger zones, and break barrels for loot.</p>
    </div>
  );
}
