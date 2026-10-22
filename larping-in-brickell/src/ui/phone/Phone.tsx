import { Fragment, useMemo, useState } from 'react';
import { useGame, currentMission } from '../../game/store';
import { useUI } from '../../game/uiStore';
import { CREATORS, CREATOR_BY_ID } from '../../game/data/creators';
import { CAMPAIGNS, CLOUT_LEVELS, MONTH_DAYS, PROPERTIES, STAFF, UPGRADES, YACHT_BY_ID, levelFor, PROPERTY_BY_ID } from '../../game/data/catalog';
import { VEHICLE_BY_ID } from '../../game/data/vehicles';
import { EVENTS } from '../../game/data/events';
import { ACHIEVEMENTS, MAIN_MISSIONS, SIDE_MISSIONS } from '../../game/data/missions';
import { CONTACTS, RIVALS } from '../../game/data/rivals';
import { POI_BY_ID } from '../../game/data/world';
import { accountCapacity, campaignGrowth, creatorGrowthRate, monthlyExpenses, oddsBonus, staffCap, sumExpenses, growthMult, revenueMult } from '../../game/systems/economy';
import { clock, money, num, pct } from '../../game/systems/format';
import { engine } from '../../game/engine/Engine';
import { Bar, Btn, Confirm, LineChart } from '../common';
import { eventStatus } from '../panels/EventPanel';
import type { GameState } from '../../game/types';

const APPS = [
  { id: 'alwaysfans', name: 'AlwaysFans', icon: '◆', bg: 'linear-gradient(135deg,#1a1a1f,#d4af6a)' },
  { id: 'bank', name: 'Bank', icon: '$', bg: 'linear-gradient(135deg,#0f5132,#3dffb0)' },
  { id: 'contacts', name: 'Contacts', icon: '👥', bg: 'linear-gradient(135deg,#334,#889)' },
  { id: 'social', name: 'Clout', icon: '📸', bg: 'linear-gradient(135deg,#ff4fd8,#ffb347)' },
  { id: 'map', name: 'Map', icon: '🗺', bg: 'linear-gradient(135deg,#0d3550,#5cc8ff)' },
  { id: 'properties', name: 'Properties', icon: '🏙', bg: 'linear-gradient(135deg,#3a2a10,#f0d59a)' },
  { id: 'vehicles', name: 'Vehicles', icon: '🚘', bg: 'linear-gradient(135deg,#111,#666)' },
  { id: 'events', name: 'Events', icon: '🎟', bg: 'linear-gradient(135deg,#4b0f6b,#ff4fd8)' },
  { id: 'tasks', name: 'Tasks', icon: '✓', bg: 'linear-gradient(135deg,#123,#3dffb0)' },
];

function waypointTo(poiId: string) {
  const p = POI_BY_ID[poiId];
  useUI.getState().setWaypoint({ x: p.x, z: p.z, label: p.name });
  useUI.getState().notify(`Waypoint set: ${p.name}`, 'info');
}

function Head({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="phone-app-head">
      <button className="back" onClick={onBack}>‹ Home</button>
      <h2>{title}</h2>
    </div>
  );
}

// ------------------------------------------------------------------ AlwaysFans manager
function AlwaysFans() {
  const g = useGame((s) => s.game);
  const [tab, setTab] = useState<'overview' | 'roster' | 'prospects' | 'campaigns' | 'agency'>('overview');
  const [sel, setSel] = useState<string | null>(null);
  const roster = Object.values(g.creators);
  const daily = roster.reduce((a, c) => a + c.lastDayCommission, 0);
  const audience = roster.reduce((a, c) => a + c.audience, 0);
  return (
    <div className="col">
      <div className="tabs">
        {(['overview', 'roster', 'prospects', 'campaigns', 'agency'] as const).map((t) => <Btn key={t} small active={tab === t} onClick={() => { setTab(t); setSel(null); }}>{t[0].toUpperCase() + t.slice(1)}</Btn>)}
      </div>
      {tab === 'overview' && <Overview g={g} daily={daily} audience={audience} go={(t) => setTab(t)} />}
      {tab === 'roster' && (sel ? <CreatorDetail id={sel} back={() => setSel(null)} /> : <Roster g={g} onSel={setSel} />)}
      {tab === 'prospects' && <Prospects g={g} />}
      {tab === 'campaigns' && <Campaigns g={g} />}
      {tab === 'agency' && <Agency g={g} />}
    </div>
  );
}

function Overview({ g, daily, audience, go }: { g: GameState; daily: number; audience: number; go: (t: 'roster' | 'prospects' | 'campaigns' | 'agency') => void }) {
  const hist = g.history.slice(-20);
  const attention: { text: string; act?: () => void }[] = [];
  for (const c of Object.values(g.creators)) {
    const left = c.contract.endDay - g.day;
    if (left <= 3) attention.push({ text: `${CREATOR_BY_ID[c.id].name}: contract ends in ${left} day(s) — renew`, act: () => go('roster') });
    if (c.satisfaction < 40) attention.push({ text: `${CREATOR_BY_ID[c.id].name} is unhappy (${Math.round(c.satisfaction)}) — lower commission or run a campaign`, act: () => go('roster') });
  }
  if (Object.keys(g.creators).length > accountCapacity(g)) attention.push({ text: 'Roster exceeds account-manager capacity — satisfaction is dropping. Hire an Account Manager.', act: () => go('agency') });
  if (Object.keys(g.creators).length === 0) attention.push({ text: 'No creators yet. Find prospects at Café Clout and other venues.', act: () => go('prospects') });
  const upcoming = EVENTS.filter((e) => eventStatus(g, e).ok).slice(0, 3);
  return (
    <div className="col">
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div className="card"><div className="meta">Daily commission</div><b className="pos" style={{ fontSize: 18 }}>{money(daily)}</b></div>
        <div className="card"><div className="meta">Total audience</div><b style={{ fontSize: 18 }}>{num(audience)}</b></div>
        <div className="card"><div className="meta">Creators</div><b style={{ fontSize: 18 }}>{Object.keys(g.creators).length}</b></div>
        <div className="card"><div className="meta">Active campaigns</div><b style={{ fontSize: 18 }}>{g.campaigns.length}</b></div>
      </div>
      <div className="card">
        <div className="meta">Revenue & audience (last {hist.length} days)</div>
        <LineChart series={[
          { label: 'Commission/day', color: '#3dffb0', values: hist.map((h) => h.revenue) },
          { label: 'Audience (scaled)', color: '#d4af6a', values: hist.map((h) => h.audience * (Math.max(1, ...hist.map((x) => x.revenue)) / Math.max(1, ...hist.map((x) => x.audience)))) },
        ]} />
      </div>
      <h3 className="sec">Needs attention</h3>
      {attention.length === 0 ? <div className="small muted">All good. Suspiciously good.</div> : attention.map((a, i) => <div key={i} className="card small" style={{ cursor: 'pointer' }} onClick={a.act}>⚠ {a.text}</div>)}
      <h3 className="sec">Upcoming events</h3>
      {upcoming.map((e) => <div key={e.id} className="card small"><div className="row between"><b>{e.name}</b><Btn small onClick={() => useUI.getState().startEvent(e.id)}>Open</Btn></div><div className="muted">{POI_BY_ID[e.poi].name}</div></div>)}
      <div className="small muted">Business expenses this month will be about {money(sumExpenses(monthlyExpenses(g)))}. See Bank for details.</div>
    </div>
  );
}

function Roster({ g, onSel }: { g: GameState; onSel: (id: string) => void }) {
  const [sort, setSort] = useState<'audience' | 'revenue' | 'sat' | 'growth'>('revenue');
  const list = Object.values(g.creators).sort((a, b) =>
    sort === 'audience' ? b.audience - a.audience : sort === 'revenue' ? b.lastDayCommission - a.lastDayCommission : sort === 'sat' ? b.satisfaction - a.satisfaction : creatorGrowthRate(g, b) - creatorGrowthRate(g, a));
  if (!list.length) return <div className="muted small">No creators signed yet. Check the Prospects tab.</div>;
  return (
    <table className="tbl">
      <thead>
        <tr>
          <th>Creator</th>
          <th onClick={() => setSort('audience')}>Fans{sort === 'audience' ? ' ▾' : ''}</th>
          <th onClick={() => setSort('revenue')}>$/day{sort === 'revenue' ? ' ▾' : ''}</th>
          <th onClick={() => setSort('sat')}>Mood{sort === 'sat' ? ' ▾' : ''}</th>
        </tr>
      </thead>
      <tbody>
        {list.map((c) => (
          <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => onSel(c.id)}>
            <td><b>{CREATOR_BY_ID[c.id].name}</b><div className="muted small">{pct(c.contract.commission)} · {pct(creatorGrowthRate(g, c), 1)}/day</div></td>
            <td>{num(c.audience)}</td>
            <td className="pos">{money(c.lastDayCommission, true)}</td>
            <td>{c.satisfaction > 70 ? '😄' : c.satisfaction > 45 ? '🙂' : c.satisfaction > 25 ? '😐' : '😠'} {Math.round(c.satisfaction)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CreatorDetail({ id, back }: { id: string; back: () => void }) {
  const g = useGame((s) => s.game);
  const { startCampaign, releaseCreator } = useGame();
  const [confirm, setConfirm] = useState(false);
  const c = g.creators[id];
  const def = CREATOR_BY_ID[id];
  if (!c) return <Btn onClick={back}>Back</Btn>;
  const left = c.contract.endDay - g.day;
  const lvl = levelFor(g.clout);
  return (
    <div className="col">
      <button className="back" onClick={back}>‹ Roster</button>
      <div className="row between"><div><h3 style={{ margin: 0 }}>{def.name}</h3><div className="small muted">{def.handle} · {def.niche} · Age {def.age} · {def.tier}</div></div></div>
      <div className="kv small">
        <span>Audience</span><span>{num(c.audience)}</span>
        <span>Growth rate</span><span>{pct(creatorGrowthRate(g, c), 2)}/day {campaignGrowth(g, id) > 0 ? '(campaign boost)' : ''}</span>
        <span>Popularity</span><span>{c.popularity.toFixed(1)}/10</span>
        <span>Professionalism · Marketing fit</span><span>{def.professionalism}/10 · {def.marketing}/10</span>
        <span>Gross yesterday</span><span>{money(c.lastDayGross)}</span>
        <span>Your commission</span><span className="pos">{money(c.lastDayCommission)} ({pct(c.contract.commission)})</span>
        <span>Lifetime commission</span><span>{money(c.lifetimeCommission)}</span>
        <span>Contract</span><span>{c.contract.durationMonths} months · {left > 0 ? `${left} days left` : 'ends today'}{c.contract.growthStipend ? ' · stipend' : ''}</span>
        <span>Satisfaction</span><span>{Math.round(c.satisfaction)}/100</span>
      </div>
      <Bar value={c.satisfaction / 100} color={c.satisfaction < 35 ? 'red' : 'green'} />
      <div className="card"><LineChart height={90} series={[{ label: 'Audience', color: '#d4af6a', values: c.history }, { label: 'Commission', color: '#3dffb0', values: c.revenueHistory.map((v) => (v * Math.max(1, ...c.history)) / Math.max(1, ...c.revenueHistory)) }]} /></div>
      <h3 className="sec">Run a campaign for {def.name.split(' ')[0]}</h3>
      {CAMPAIGNS.filter((k) => !k.roster).map((k) => (
        <div key={k.id} className="card small">
          <div className="row between"><b>{k.name}</b><span className="price">{money(k.cost)}</span></div>
          <div className="muted">{k.blurb}</div>
          <div className="row between">
            <span className="muted">{k.days > 1 ? `${k.days} days · ` : ''}Flop {pct(Math.max(0, k.odds.flop - oddsBonus(g) / 2))} · Viral {pct(k.odds.viral + oddsBonus(g))}</span>
            <Btn small kind="gold" disabled={lvl < k.minLevel || g.cash < k.cost} onClick={() => startCampaign(k.id, id)}>{lvl < k.minLevel ? `🔒 Lv${k.minLevel + 1}` : 'Launch'}</Btn>
          </div>
        </div>
      ))}
      <div className="row wrap">
        <Btn onClick={() => useUI.getState().startDialogue({ kind: 'creator', id })}>Renegotiate / renew</Btn>
        <Btn kind="danger" onClick={() => setConfirm(true)}>Release from contract</Btn>
      </div>
      {confirm && <Confirm text={`Release ${def.name}? They leave on good terms (−5 clout).`} onNo={() => setConfirm(false)} onYes={() => { releaseCreator(id); setConfirm(false); back(); }} />}
    </div>
  );
}

function Prospects({ g }: { g: GameState }) {
  const lvl = levelFor(g.clout);
  return (
    <div className="col">
      <div className="small muted">Meet creators in person. Approach them (gold diamond) and press E. Everyone listed is a consenting adult professional and free to say no.</div>
      {CREATORS.filter((c) => !g.creators[c.id]).map((c) => {
        const lost = (g.lostToRival[c.id] ?? 0) > g.day;
        const cd = (g.cooldowns[c.id] ?? 0) > g.day;
        const locked = lvl < c.minLevel;
        return (
          <div key={c.id} className={`card small ${locked || lost ? 'locked' : ''}`}>
            <div className="row between"><b>{c.name} <span className="muted">· {c.age}</span></b><span className="tag">{c.tier}</span></div>
            <div className="muted">{c.niche} · {num(c.audience)} fans · prefers {c.preference}</div>
            <div className="row between">
              <span>{lost ? '🔒 With a rival agency for now' : locked ? `🔒 Takes meetings at ${CLOUT_LEVELS[c.minLevel].name}` : cd ? '⏳ Try again tomorrow' : `📍 ${POI_BY_ID[c.venue].name}`}</span>
              {!lost && <Btn small onClick={() => waypointTo(c.venue)}>Waypoint</Btn>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Campaigns({ g }: { g: GameState }) {
  const { startCampaign } = useGame();
  const lvl = levelFor(g.clout);
  const [target, setTarget] = useState<string>(Object.keys(g.creators)[0] ?? '');
  const ids = Object.keys(g.creators);
  return (
    <div className="col">
      <h3 className="sec">Active campaigns</h3>
      {g.campaigns.length === 0 ? <div className="small muted">None running.</div> : g.campaigns.map((k) => (
        <div key={k.id} className="card small">
          <div className="row between"><b>{CAMPAIGNS.find((x) => x.id === k.type)?.name}</b><span className={`tag ${k.outcome === 'viral' ? 'gold' : k.outcome === 'flop' ? 'red' : 'green'}`}>{k.outcome}</span></div>
          <div className="muted">{k.creatorId ? CREATOR_BY_ID[k.creatorId]?.name : 'Entire roster'} · +{pct(k.growthBonus, 1)} growth/day · ends day {k.endDay}</div>
        </div>
      ))}
      <h3 className="sec">Launch</h3>
      {ids.length === 0 ? <div className="small muted">Sign a creator first.</div> : (
        <>
          <select className="name-input" value={target} onChange={(e) => setTarget(e.target.value)}>
            {ids.map((id) => <option key={id} value={id}>{CREATOR_BY_ID[id].name}</option>)}
          </select>
          {CAMPAIGNS.map((k) => (
            <div key={k.id} className="card small">
              <div className="row between"><b>{k.name}{k.roster ? ' (roster-wide)' : ''}</b><span className="price">{money(k.cost)}</span></div>
              <div className="muted">{k.blurb}</div>
              <div className="row between">
                <span className="muted">Expected: {k.growth ? `+${pct(k.growth, 1)} growth/day × ${k.days}d` : k.oneShot === 'cash' ? `~${money(k.cost * (k.oneShotValue ?? 1))} payout` : k.oneShot === 'audience' ? `+${pct(k.oneShotValue ?? 0)} audience` : '+popularity'} · Viral {pct(k.odds.viral + oddsBonus(g))}</span>
                <Btn small kind="gold" disabled={lvl < k.minLevel || g.cash < k.cost || (!k.roster && !target)} onClick={() => startCampaign(k.id, k.roster ? null : target)}>{lvl < k.minLevel ? `🔒 Lv${k.minLevel + 1}` : 'Launch'}</Btn>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function Agency({ g }: { g: GameState }) {
  const { buyUpgrade, hireStaff, fireStaff } = useGame();
  const lvl = levelFor(g.clout);
  const hasOffice = g.properties.includes('office');
  return (
    <div className="col">
      <div className="kv small">
        <span>Growth multiplier</span><span>×{growthMult(g).toFixed(2)}</span>
        <span>Revenue multiplier</span><span>×{revenueMult(g).toFixed(2)}</span>
        <span>Account capacity</span><span>{Object.keys(g.creators).length}/{Math.floor(accountCapacity(g))} creators</span>
      </div>
      {!hasOffice && <div className="card small">🏢 Rent the <b>Suite 404 Office</b> (Properties app) to hire staff and unlock most upgrades.</div>}
      <h3 className="sec">Staff</h3>
      {STAFF.map((s) => {
        const n = g.staff[s.id] || 0;
        const cap = staffCap(g, s.max);
        return (
          <div key={s.id} className="card small">
            <div className="row between"><b>{s.name}</b><span>{n}/{cap}</span></div>
            <div className="muted">{s.blurb} · Salary {money(s.salary)}/month · Hiring fee {money(s.hireFee)}</div>
            <div className="row"><Btn small kind="gold" disabled={n >= cap || g.cash < s.hireFee} onClick={() => hireStaff(s.id)}>Hire</Btn>{n > 0 && <Btn small kind="danger" onClick={() => fireStaff(s.id)}>Let go</Btn>}</div>
          </div>
        );
      })}
      <h3 className="sec">Upgrades</h3>
      {UPGRADES.map((u) => {
        const owned = g.upgrades.includes(u.id);
        const needs = u.requires && !g.properties.includes(u.requires);
        return (
          <div key={u.id} className={`card small ${owned ? 'owned' : ''}`}>
            <div className="row between"><b>{u.name}</b><span className="price">{owned ? 'Owned' : money(u.price)}</span></div>
            <div className="muted">{u.blurb}</div>
            {!owned && <Btn small kind="gold" disabled={lvl < u.minLevel || !!needs || g.cash < u.price} onClick={() => buyUpgrade(u.id)}>{lvl < u.minLevel ? `🔒 ${CLOUT_LEVELS[u.minLevel].name}` : needs ? `Needs ${PROPERTY_BY_ID[u.requires!].name}` : 'Buy'}</Btn>}
          </div>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------ Bank
function Bank() {
  const g = useGame((s) => s.game);
  const ui = useUI();
  const exp = monthlyExpenses(g);
  const total = sumExpenses(exp);
  const dayInMonth = ((g.day - 1) % MONTH_DAYS) + 1;
  const netWorth = g.cash + g.vehicles.reduce((a, v) => a + (VEHICLE_BY_ID[v]?.price ?? 0) * 0.6, 0) + g.properties.reduce((a, p) => a + (PROPERTY_BY_ID[p]?.price ?? 0) * 0.8, 0) + (g.yacht ? YACHT_BY_ID[g.yacht].price * 0.6 : 0);
  return (
    <div className="col">
      <div className="card" style={{ background: 'linear-gradient(135deg, rgba(212,175,106,.25), rgba(255,255,255,.03))' }}>
        <div className="meta">Available cash</div>
        <div style={{ fontSize: 30, fontWeight: 800 }} className={g.cash < 0 ? 'neg' : ''}>{money(g.cash)}</div>
        <div className="meta">Estimated net worth {money(netWorth, true)}</div>
      </div>
      <div className="card small">
        <div className="row between"><b>This month so far</b><span className="muted">Day {dayInMonth}/{MONTH_DAYS}</span></div>
        <div className="kv">
          <span>Creator commissions</span><span className="pos">{money(g.month.commission)}</span>
          <span>Other income</span><span className="pos">{money(g.month.otherIncome)}</span>
          <span>Marketing spent</span><span className="neg">{money(g.month.marketing)}</span>
          <span>Purchases</span><span className="neg">{money(g.month.purchases)}</span>
        </div>
      </div>
      <div className="card small">
        <div className="row between"><b>Bills due at month end</b><span className="neg">{money(total)}</span></div>
        <div className="kv">{Object.entries(exp).filter(([, v]) => v > 0).map(([k, v]) => <Fragment key={k}><span>{k}</span><span>{money(v)}</span></Fragment>)}</div>
        {g.cash < total && <div className="neg">⚠ Your cash won't cover next month's bills. Sell something, run campaigns or win events.</div>}
      </div>
      {g.reports.length > 0 && <Btn onClick={() => ui.open('report', String(g.reports.length - 1))}>Last monthly report</Btn>}
      <h3 className="sec">Transactions</h3>
      {g.ledger.slice(0, 30).map((t, i) => (
        <div key={i} className="row between small" style={{ borderBottom: '1px solid var(--line)', padding: '6px 0' }}>
          <span><span className="muted">D{t.day} {clock(t.minute)}</span> · {t.label}</span>
          <b className={t.amount >= 0 ? 'pos' : 'neg'}>{t.amount >= 0 ? '+' : ''}{money(t.amount)}</b>
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ Contacts & social
function Contacts() {
  const g = useGame((s) => s.game);
  return (
    <div className="col">
      <h3 className="sec">Creators</h3>
      {CREATORS.filter((c) => g.contacts.includes(c.id) || g.creators[c.id]).map((c) => (
        <div key={c.id} className="card small"><div className="row between"><b>{c.name}</b><span className={`tag ${g.creators[c.id] ? 'green' : ''}`}>{g.creators[c.id] ? 'Client' : 'Prospect'}</span></div><div className="row between"><span className="muted">{c.handle} · {POI_BY_ID[c.venue].name}</span><Btn small onClick={() => waypointTo(c.venue)}>Find</Btn></div></div>
      ))}
      {g.contacts.length === 0 && Object.keys(g.creators).length === 0 && <div className="small muted">Nobody yet. Go outside. Network.</div>}
      <h3 className="sec">Business contacts</h3>
      {CONTACTS.map((c) => (
        <div key={c.id} className={`card small ${g.contacts.includes(c.id) ? '' : 'locked'}`}><div className="row between"><b>{g.contacts.includes(c.id) ? c.name : '??? (not met yet)'}</b><span className="tag blue">{c.role}</span></div><div className="row between"><span className="muted">Usually at {POI_BY_ID[c.venue].name}</span><Btn small onClick={() => waypointTo(c.venue)}>Find</Btn></div></div>
      ))}
      <h3 className="sec">Rivals</h3>
      {RIVALS.map((r) => (
        <div key={r.id} className="card small"><div className="row between"><b>{r.name}</b><span className="tag red">{g.rivals[r.id].defeated ? 'Defeated' : 'Rival'}</span></div><div className="muted">{r.agency} · clout {num(g.rivals[r.id].clout)} · {r.personality}</div><div className="row between"><span className="muted">Hangs at {POI_BY_ID[r.venue].name}</span><Btn small onClick={() => waypointTo(r.venue)}>Find</Btn></div></div>
      ))}
    </div>
  );
}

function Social() {
  const g = useGame((s) => s.game);
  const key = 'postedDay';
  const posted = (g.stats[key] || 0) === g.day;
  const flex = () => {
    const st = useGame.getState();
    const lines = [
      `Another day in Brickell. ${g.vehicles.length > 1 ? `${g.vehicles.length} cars in the garage` : 'Maybach washed'}. ${Object.keys(g.creators).length} creators on the roster. Grateful. 🙏`,
      `Morning meeting at Café Clout. Evening meeting at VOLT. Somewhere in between: the bounce. 🚙⬆️⬇️`,
      `Not everyone understands the vision. That's fine. The vision has hydraulics. #LarpingInBrickell`,
      `Reminder: your network is your net worth. My net worth is mostly a Maybach. 💼`,
    ];
    st.post(g.nickname, '@' + g.nickname.toLowerCase().replace(/\s+/g, ''), lines[Math.floor(Math.random() * lines.length)], 'player', Math.floor(200 + g.clout * (2 + Math.random() * 4)));
    st.mutate((x) => { x.stats[key] = x.day; });
    st.addClout(2 + levelFor(g.clout), 'Your post is doing numbers');
  };
  return (
    <div className="col">
      <Btn kind="gold" disabled={posted} onClick={flex}>{posted ? 'Posted today (the algorithm needs rest)' : '📸 Post a flex'}</Btn>
      <div>
        {g.social.map((p) => (
          <div key={p.id} className={`post ${p.tone}`}>
            <div className="row between"><span className="who">{p.author} <span className="h">{p.handle}</span></span><span className="h">Day {p.day}</span></div>
            <div style={{ margin: '4px 0' }}>{p.text}</div>
            <div className="h">♥ {num(p.likes)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Properties, vehicles, events, tasks
function Properties() {
  const g = useGame((s) => s.game);
  const ui = useUI();
  const lvl = levelFor(g.clout);
  return (
    <div className="col">
      {g.properties.includes('club') && <Btn kind="gold" onClick={() => ui.open('club')}>⚡ VOLT club dashboard</Btn>}
      <Btn onClick={() => ui.open('marina')}>⚓ Marina & yachts</Btn>
      {PROPERTIES.filter((p) => p.price > 0 || g.properties.includes(p.id)).map((p) => {
        const owned = g.properties.includes(p.id);
        return (
          <div key={p.id} className={`card small ${owned ? 'owned' : ''} ${!owned && lvl < p.minLevel ? 'locked' : ''}`}>
            <div className="row between"><b>{p.name}</b><span className="price">{owned ? 'Owned' : money(p.price, true)}</span></div>
            <div className="muted">{p.blurb}</div>
            <div className="muted">Upkeep {money(p.upkeep)}/month · {p.benefits.join(' · ')}</div>
            {!owned && <Btn small onClick={() => ui.open('property', p.id)}>{lvl < p.minLevel ? `🔒 ${CLOUT_LEVELS[p.minLevel].name}` : 'View & buy'}</Btn>}
          </div>
        );
      })}
    </div>
  );
}

function Vehicles() {
  const g = useGame((s) => s.game);
  const ui = useUI();
  return (
    <div className="col">
      <div className="row wrap">
        <Btn kind="gold" onClick={() => ui.open('maybach')}>Maybach settings</Btn>
        <Btn onClick={() => ui.open('garage')}>Garage & customization</Btn>
      </div>
      <div className="card small">
        <b>Ride home</b>
        <div className="muted">Too many drinks, stuck on the yacht, or just lost? A rideshare takes you home for $85.</div>
        <Btn small onClick={() => {
          if (!engine) return;
          if (useUI.getState().rt.mode !== 'foot') { ui.notify('Park and get out first.', 'warn'); return; }
          if (engine.rideHome()) ui.close();
        }}>Call a ride home</Btn>
      </div>
      <div className="card small">
        <b>Valet delivery</b>
        <div className="muted">Lost your car? A valet brings your active vehicle to you for $250.</div>
        <Btn small onClick={() => {
          if (!engine) return;
          if (useUI.getState().rt.mode !== 'foot' || useUI.getState().rt.interior) { ui.notify('Delivery only works on foot, outside.', 'warn'); return; }
          if (useGame.getState().spend(250, 'Valet delivery', 'other') && engine.deliverCar()) ui.notify('Your car has been delivered. Tip not included.', 'info');
        }}>Deliver my {VEHICLE_BY_ID[g.activeVehicle].name}</Btn>
      </div>
      {g.vehicles.map((id) => {
        const v = VEHICLE_BY_ID[id];
        return (
          <div key={id} className={`card small ${g.activeVehicle === id ? 'owned' : ''}`}>
            <div className="row between"><b>{v.make} {v.name}</b>{g.activeVehicle === id && <span className="tag green">Active</span>}</div>
            <div className="muted">{v.category} · Prestige {v.prestige} · {money(v.maintenance)}/mo</div>
          </div>
        );
      })}
      <div className="small muted">Swap your active vehicle at your home or Brickell Central Garage.</div>
    </div>
  );
}

function Events() {
  const g = useGame((s) => s.game);
  const ui = useUI();
  return (
    <div className="col">
      {EVENTS.map((e) => {
        const st = eventStatus(g, e);
        return (
          <div key={e.id} className={`card small ${st.ok ? '' : 'locked'}`}>
            <div className="row between"><b>{e.name}</b><span className="tag gold">{money(e.reward.cash, true)} · {e.reward.clout}★</span></div>
            <div className="muted">{e.blurb}</div>
            <div className="row between">
              <span className={st.ok ? 'pos' : 'muted'}>{st.ok ? (st.here ? 'Available here' : `📍 ${POI_BY_ID[e.poi].name}`) : st.reason}</span>
              <div className="row">
                {!st.here && <Btn small onClick={() => waypointTo(e.poi)}>Waypoint</Btn>}
                {st.ok && st.here && <Btn small kind="gold" onClick={() => ui.startEvent(e.id)}>Start</Btn>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Tasks() {
  const g = useGame((s) => s.game);
  const cur = currentMission(g);
  const [tab, setTab] = useState<'main' | 'side' | 'ach'>('main');
  const track = (id: string, target?: string) => {
    useGame.getState().setTracked(id);
    if (target) waypointTo(target);
  };
  return (
    <div className="col">
      <div className="tabs">
        <Btn small active={tab === 'main'} onClick={() => setTab('main')}>Story ({g.missionsDone.length}/{MAIN_MISSIONS.length})</Btn>
        <Btn small active={tab === 'side'} onClick={() => setTab('side')}>Side jobs</Btn>
        <Btn small active={tab === 'ach'} onClick={() => setTab('ach')}>Achievements ({g.achievements.length}/{ACHIEVEMENTS.length})</Btn>
      </div>
      {tab !== 'ach' && (tab === 'main' ? MAIN_MISSIONS : SIDE_MISSIONS).map((m) => {
        const done = g.missionsDone.includes(m.id) || g.sideDone.includes(m.id);
        return (
          <div key={m.id} className={`card small ${done ? 'owned' : ''}`} style={{ borderColor: cur?.id === m.id ? 'var(--gold)' : undefined }}>
            <div className="row between"><b>{done ? '✓ ' : ''}{m.title}</b><span className="tag">{m.stage}</span></div>
            <div className="muted">{m.desc}{m.progress && !done ? ` (${m.progress(g)})` : ''}</div>
            <div className="row between"><span className="price">{m.reward.cash ? money(m.reward.cash) : ''}{m.reward.clout ? ` · +${m.reward.clout} clout` : ''}</span>
              {!done && <Btn small onClick={() => track(m.id, m.target)}>{m.target ? 'Track + waypoint' : 'Track'}</Btn>}
            </div>
          </div>
        );
      })}
      {tab === 'ach' && ACHIEVEMENTS.map((a) => (
        <div key={a.id} className={`card small ${g.achievements.includes(a.id) ? 'owned' : 'locked'}`}>
          <div className="row between"><b>{g.achievements.includes(a.id) ? '🏆 ' : '🔒 '}{a.name}</b><span className="muted">{a.reward.cash ? money(a.reward.cash, true) : ''}{a.reward.clout ? ` +${a.reward.clout}★` : ''}</span></div>
          <div className="muted">{a.desc}</div>
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ shell
export function Phone() {
  const app = useUI((s) => s.phoneApp);
  const setApp = useUI((s) => s.setPhoneApp);
  const close = useUI((s) => s.close);
  const minute = useGame((s) => s.game.minute);
  const g = useGame((s) => s.game);
  const lvl = levelFor(g.clout);
  const badges = useMemo(() => {
    const b: Record<string, number> = {};
    b.tasks = currentMission(g) ? 1 : 0;
    b.events = EVENTS.filter((e) => eventStatus(g, e).ok).length;
    b.alwaysfans = Object.values(g.creators).filter((c) => c.contract.endDay - g.day <= 3 || c.satisfaction < 40).length;
    return b;
  }, [g]);
  const open = (id: string) => {
    if (id === 'map') {
      useUI.getState().open('map');
      return;
    }
    setApp(id);
  };
  const appDef = APPS.find((a) => a.id === app);
  return (
    <div className="phone-wrap" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="phone">
        <div className="phone-notch" />
        <div className="phone-status"><span>{clock(minute)}</span><span>5G ▮▮▮ 🔋</span></div>
        <div className="phone-screen">
          {!appDef ? (
            <>
              <div style={{ textAlign: 'center', marginTop: 18 }}>
                <div style={{ fontSize: 46, fontWeight: 300 }}>{clock(minute).replace(/ (AM|PM)/, '')}</div>
                <div className="muted small">{g.nickname} · {CLOUT_LEVELS[lvl].name}</div>
                <div className="price" style={{ marginTop: 6 }}>{money(g.cash)}</div>
              </div>
              <div className="phone-home">
                {APPS.map((a) => (
                  <button key={a.id} className="app-icon" onClick={() => open(a.id)}>
                    <div className="ic" style={{ background: a.bg }}>{a.icon}{badges[a.id] ? <span className="badge">{badges[a.id]}</span> : null}</div>
                    {a.name}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <Head title={appDef.id === 'alwaysfans' ? 'AlwaysFans Manager' : appDef.name} onBack={() => setApp(null)} />
              {app === 'alwaysfans' && <AlwaysFans />}
              {app === 'bank' && <Bank />}
              {app === 'contacts' && <Contacts />}
              {app === 'social' && <Social />}
              {app === 'properties' && <Properties />}
              {app === 'vehicles' && <Vehicles />}
              {app === 'events' && <Events />}
              {app === 'tasks' && <Tasks />}
            </>
          )}
        </div>
        <div className="phone-home-bar" onClick={() => (app ? setApp(null) : close())} title="Home" />
      </div>
    </div>
  );
}
