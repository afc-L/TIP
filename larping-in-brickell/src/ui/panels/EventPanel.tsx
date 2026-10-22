import { useState } from 'react';
import { useGame, watchCollectionValue } from '../../game/store';
import { useUI } from '../../game/uiStore';
import { EVENT_BY_ID, type EventDef } from '../../game/data/events';
import { CLOUT_LEVELS, YACHT_BY_ID, levelFor } from '../../game/data/catalog';
import { POI_BY_ID } from '../../game/data/world';
import { VEHICLE_BY_ID } from '../../game/data/vehicles';
import { RIVAL_BY_ID } from '../../game/data/rivals';
import { money, num } from '../../game/systems/format';
import { engine } from '../../game/engine/Engine';
import { audio } from '../../game/engine/audio';
import type { GameState } from '../../game/types';
import { Btn, Panel } from '../common';

export function eventStatus(g: GameState, def: EventDef): { ok: boolean; reason: string | null; here: boolean } {
  const lvl = levelFor(g.clout);
  const here = !!engine?.nearPoi(def.poi, 35);
  if (lvl < def.minLevel) return { ok: false, reason: `Requires ${CLOUT_LEVELS[def.minLevel].name}`, here };
  if (def.requires === 'hq' && !g.properties.includes('hq')) return { ok: false, reason: def.requiresLabel ?? 'Requirement not met', here };
  if (def.requires === 'penthouse' && !g.properties.includes('penthouse')) return { ok: false, reason: def.requiresLabel ?? '', here };
  if (def.requires === 'yacht' && !g.yacht) return { ok: false, reason: def.requiresLabel ?? '', here };
  if (def.requires === 'maybach' && !g.vehicles.includes('maybach')) return { ok: false, reason: 'Requires the Maybach', here };
  if (g.eventsDone[def.id] === g.day) return { ok: false, reason: 'Already done today — come back tomorrow', here };
  if (def.kind === 'showdown' && def.rival && g.rivals[def.rival]?.defeated && def.rival !== 'chase') {
    // can rematch for fun, still fine
  }
  return { ok: true, reason: null, here };
}

function Result() {
  const r = useUI((s) => s.eventResult)!;
  const close = useUI((s) => s.close);
  return (
    <Panel title={r.title} size="narrow" foot={<Btn kind="gold" onClick={close}>Continue</Btn>}>
      <div className="result-big">
        <div className="muted small" style={{ letterSpacing: 3 }}>{r.win ? 'YOU WON THE ROOM' : 'RESULT'}</div>
        <div className="score" style={{ color: r.win ? 'var(--gold2)' : 'var(--text)' }}>{r.score}</div>
        <div className="row" style={{ justifyContent: 'center', gap: 20 }}>
          <span className={r.cash >= 0 ? 'pos' : 'neg'}>{r.cash >= 0 ? '+' : ''}{money(r.cash)}</span>
          <span style={{ color: 'var(--gold2)' }}>{r.clout >= 0 ? '+' : ''}{r.clout} clout</span>
        </div>
        <p className="muted">{r.text}</p>
      </div>
    </Panel>
  );
}

function Convo({ def }: { def: EventDef }) {
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [reply, setReply] = useState<string | null>(null);
  const rounds = def.rounds!;
  const r = rounds[Math.min(round, rounds.length - 1)];
  const choose = (s: number, rep: string) => {
    setScore(score + s);
    setReply(rep);
    audio.ui(s >= 2 ? 'cash' : 'click');
  };
  const next = () => {
    setReply(null);
    if (round + 1 >= rounds.length) {
      const g = useGame.getState().game;
      const pctScore = Math.round((score / (rounds.length * 3)) * 88 + levelFor(g.clout) * 2 + Math.random() * 6);
      const res = useGame.getState().completeEvent(def.id, pctScore);
      useUI.setState({ eventResult: { title: def.name, ...res } });
    } else setRound(round + 1);
  };
  return (
    <div className="col" style={{ gap: 12 }}>
      <div className="muted small">Round {round + 1} of {rounds.length} · {r.speaker}</div>
      <div className="dlg-line">{r.prompt}</div>
      {!reply ? (
        <div className="choices">
          {r.options.map((o, i) => <button key={i} className="choice" onClick={() => choose(o.score, o.reply)}>{o.text}</button>)}
        </div>
      ) : (
        <>
          <div className="dlg-line" style={{ color: 'var(--gold2)' }}>{reply}</div>
          <div><Btn kind="gold" onClick={next}>{round + 1 >= rounds.length ? 'See results' : 'Next'}</Btn></div>
        </>
      )}
    </div>
  );
}

function PartyPlanner({ def }: { def: EventDef }) {
  const g = useGame((s) => s.game);
  const [guests, setGuests] = useState<string[]>(['creators']);
  const [budget, setBudget] = useState(1);
  const opts = [
    { id: 'creators', label: `Your roster (${Object.keys(g.creators).length} creators)`, pts: Math.min(25, Object.keys(g.creators).length * 4) },
    { id: 'contacts', label: `Business contacts (${g.contacts.filter((c) => ['marco', 'gloria', 'palmetto', 'yuki'].includes(c)).length}/4 met)`, pts: g.contacts.filter((c) => ['marco', 'gloria', 'palmetto', 'yuki'].includes(c)).length * 4 },
    { id: 'rivals', label: 'Invite your rivals (risky, iconic)', pts: Math.random() < 0.6 ? 14 : -6 },
    { id: 'press', label: 'Brickell press & photographers', pts: 10 },
  ];
  const costs = [10000, 40000, 120000];
  const host = () => {
    const cost = costs[budget];
    if (!useGame.getState().spend(cost, `${def.name} budget`, 'marketing')) return;
    const base = def.kind === 'yachtparty' ? 22 + (YACHT_BY_ID[g.yacht ?? '']?.rank ?? 1) * 8 : 34;
    const s = base + guests.reduce((a, id) => a + (opts.find((o) => o.id === id)?.pts ?? 0), 0) + budget * 9 + levelFor(g.clout) * 2 + Math.random() * 8;
    const res = useGame.getState().completeEvent(def.id, s);
    if (res.win && def.kind === 'yachtparty') useGame.getState().mutate((x) => { for (const c of Object.values(x.creators)) c.satisfaction = Math.min(100, c.satisfaction + 5); });
    useUI.setState({ eventResult: { title: def.name, ...res, cash: res.cash - cost, text: `${res.text} (Budget spent: ${money(cost)}.)` } });
    audio.crowdCheer(1);
  };
  return (
    <div className="col" style={{ gap: 10 }}>
      <h3 className="sec">Guest list</h3>
      {opts.map((o) => (
        <label key={o.id} className="row" style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={guests.includes(o.id)} onChange={(e) => setGuests(e.target.checked ? [...guests, o.id] : guests.filter((x) => x !== o.id))} />
          <span>{o.label}</span>
        </label>
      ))}
      <h3 className="sec">Budget</h3>
      <div className="row wrap">{['Intimate', 'Lavish', 'Legendary'].map((b, i) => <Btn key={b} small active={budget === i} onClick={() => setBudget(i)}>{b} · {money(costs[i], true)}</Btn>)}</div>
      <div><Btn kind="gold" onClick={host}>Host the party</Btn></div>
    </div>
  );
}

function Showdown({ def }: { def: EventDef }) {
  const r = RIVAL_BY_ID[def.rival!];
  const g = useGame((s) => s.game);
  const rs = g.rivals[def.rival!];
  const go = () => {
    const res = useGame.getState().rivalShowdown(def.rival!);
    audio.ui(res.win ? 'achieve' : 'error');
    useUI.setState({ eventResult: { title: def.name, score: res.player, cash: res.cash, clout: res.clout, win: res.win, text: `Your score ${num(res.player)} vs ${r.name.split(' ')[0]}'s ${num(res.rival)}. "${res.text}"` } });
  };
  const daily = Object.values(g.creators).reduce((a, c) => a + c.lastDayCommission, 0);
  const aud = Object.values(g.creators).reduce((a, c) => a + c.audience, 0);
  return (
    <div className="col">
      <p className="muted">Judged on clout, daily agency revenue and total audience. Rivals keep growing every day — so does the bragging.</p>
      <div className="grid c2">
        <div className="card"><h4>You</h4><div className="kv"><span>Clout</span><span>{num(g.clout)}</span><span>Daily commission</span><span>{money(daily)}</span><span>Audience</span><span>{num(aud)}</span></div></div>
        <div className="card"><h4>{r.name}</h4><div className="kv"><span>Clout</span><span>{num(rs.clout)}</span><span>Daily revenue</span><span>{money(rs.revenue)}</span><span>Roster</span><span>{rs.roster}</span></div></div>
      </div>
      <div><Btn kind="gold" onClick={go}>Start the showdown</Btn></div>
    </div>
  );
}

export function EventPanel() {
  const ev = useUI((s) => s.event);
  const result = useUI((s) => s.eventResult);
  const g = useGame((s) => s.game);
  const ui = useUI();
  if (result) return <Result />;
  if (!ev) return null;
  const def = EVENT_BY_ID[ev.eventId];
  if (!def) return null;
  const st = eventStatus(g, def);
  const poi = POI_BY_ID[def.poi];
  const needHere = !st.here;
  let body: React.ReactNode = null;
  if (!st.ok) body = <p className="neg">{st.reason}</p>;
  else if (needHere) {
    body = (
      <div className="col">
        <p>This event takes place at <b>{poi.name}</b>. Head there to start it.</p>
        <div><Btn kind="gold" onClick={() => { ui.setWaypoint({ x: poi.x, z: poi.z, label: poi.name }); ui.close(); }}>Set waypoint</Btn></div>
      </div>
    );
  } else if (def.kind === 'convo') body = <Convo def={def} />;
  else if (def.kind === 'bounceoff' || def.kind === 'showoff') {
    const ctx = engine?.context();
    body = (
      <div className="col">
        <p className="muted">{def.kind === 'bounceoff' ? 'The judge calls a bounce style and an intensity. Stop inside the ring and match it with B (toggle), 1/2/3 (style) and Z/X (intensity). Keep it matched to build a combo. 45 seconds.' : 'Complete each beat in order before the timer runs out: arrive, lights, horn, the signature move, a handbrake donut, and a clean park on the star.'}</p>
        {!ctx?.inCar && <p className="neg">Get in your vehicle first.</p>}
        {def.kind === 'bounceoff' && ctx?.inCar && ctx.vehicleId !== 'maybach' && <p className="neg">Only the Maybach has hydraulics. Swap at a garage.</p>}
        <div><Btn kind="gold" disabled={!ctx?.inCar || (def.kind === 'bounceoff' && ctx.vehicleId !== 'maybach')} onClick={() => { const err = engine?.startMinigame(def.kind as 'bounceoff' | 'showoff'); if (err) ui.notify(err, 'warn'); else ui.close(); }}>Start challenge</Btn></div>
      </div>
    );
  } else if (def.kind === 'carshow') {
    const ctx = engine?.context();
    const v = VEHICLE_BY_ID[ctx?.vehicleId ?? 'maybach'];
    const mods = g.mods[v.id];
    const modCount = mods ? (mods.engine + mods.handling + (mods.underglow ? 1 : 0) + (mods.chrome ? 1 : 0) + (mods.accent ? 1 : 0) + (mods.wheels !== v.defaultMods.wheels ? 1 : 0)) : 0;
    body = (
      <div className="col">
        <p>Entering: <b>{v.make} {v.name}</b> · Prestige {v.prestige}/10 · {modCount} mods{ctx?.bounceOn ? ' · BOUNCING' : ''}</p>
        {!ctx?.inCar && <p className="neg">Drive your car into the meet to enter it.</p>}
        <div><Btn kind="gold" disabled={!ctx?.inCar} onClick={() => {
          const score = v.prestige * 6 + modCount * 4 + levelFor(g.clout) * 3 + Math.random() * 10 + (ctx?.bounceOn ? 10 : 0);
          const res = useGame.getState().completeEvent(def.id, score);
          audio.crowdCheer(res.win ? 1 : 0.4);
          useUI.setState({ eventResult: { title: def.name, ...res } });
        }}>Present the car</Btn></div>
      </div>
    );
  } else if (def.kind === 'watchmeet') {
    const value = watchCollectionValue(g);
    const score = value <= 0 ? 15 : Math.min(100, 20 + Math.log10(value) * 11.5);
    body = (
      <div className="col">
        <p>Your collection: <b>{g.watches.length} watches</b> worth <b>{money(value)}</b>.</p>
        <div><Btn kind="gold" onClick={() => { const res = useGame.getState().completeEvent(def.id, score); useUI.setState({ eventResult: { title: def.name, ...res } }); }}>Show your wrist</Btn></div>
      </div>
    );
  } else if (def.kind === 'yachtparty' || def.kind === 'penthouse') body = <PartyPlanner def={def} />;
  else if (def.kind === 'showdown') body = <Showdown def={def} />;
  return (
    <Panel title={def.name} sub={`${poi.name} · Reward up to ${money(def.reward.cash)} & ${def.reward.clout} clout`}>
      <p className="muted" style={{ marginTop: 0 }}>{def.blurb}</p>
      {body}
    </Panel>
  );
}
