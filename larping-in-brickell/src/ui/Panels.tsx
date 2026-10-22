import { Fragment, useEffect, useState } from 'react';
import { useGame, isEndgameReady } from '../game/store';
import { useUI } from '../game/uiStore';
import { CLUB_THEMES, CLUB_UPGRADES, CLOUT_LEVELS, PROPERTY_BY_ID, YACHTS, YACHT_BY_ID, levelFor } from '../game/data/catalog';
import { CREATORS } from '../game/data/creators';
import { EVENTS } from '../game/data/events';
import { POI_BY_ID } from '../game/data/world';
import { RIVALS, CONTACTS } from '../game/data/rivals';
import { clubNightly } from '../game/systems/economy';
import { money } from '../game/systems/format';
import { engine } from '../game/engine/Engine';
import { audio } from '../game/engine/audio';
import { Btn, Confirm, Controls, Panel } from './common';
import { SettingsPanel } from './panels/Settings';
import { MapScreen } from './panels/MapScreen';
import { MaybachPanel } from './panels/MaybachPanel';
import { DialoguePanel } from './panels/Dialogue';
import { EventPanel, eventStatus } from './panels/EventPanel';
import { ClothesPanel, DealerPanel, GaragePanel, HomePanel, InspectPanel, WatchPanel } from './panels/Shops';
import { Phone } from './phone/Phone';
import { BarPanel, CasinoPanel } from './panels/Casino';
import { StashPanel } from './panels/Stash';

function Pause() {
  const ui = useUI();
  const { save } = useGame();
  const g = useGame((s) => s.game);
  const [quit, setQuit] = useState(false);
  const [view, setView] = useState<'main' | 'controls' | 'ach'>('main');
  if (view === 'controls') return <Panel title="Controls" size="narrow" onClose={() => setView('main')}><Controls /></Panel>;
  return (
    <Panel title="Paused" sub={`${g.nickname} · ${CLOUT_LEVELS[levelFor(g.clout)].name} · Day ${g.day}`} size="narrow">
      <div className="col">
        <Btn kind="gold" big onClick={ui.close}>Resume</Btn>
        <Btn onClick={() => save()}>Save game</Btn>
        <Btn onClick={() => ui.open('settings')}>Settings</Btn>
        <Btn onClick={() => setView('controls')}>Controls</Btn>
        <Btn onClick={() => { ui.setPhoneApp('tasks'); ui.open('phone'); }}>Missions & achievements ({g.achievements.length})</Btn>
        <Btn onClick={() => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.().catch(() => {}); }}>Toggle fullscreen</Btn>
        <Btn kind="danger" onClick={() => setQuit(true)}>Save & quit to main menu</Btn>
      </div>
      {quit && <Confirm text="Save and return to the main menu?" yes="Quit" onNo={() => setQuit(false)} onYes={() => { save(true); ui.close(); ui.setScreen('menu'); }} />}
    </Panel>
  );
}

function Report() {
  const g = useGame((s) => s.game);
  const arg = useUI((s) => s.panelArg);
  const r = g.reports[arg ? Number(arg) : g.reports.length - 1];
  const close = useUI((s) => s.close);
  if (!r) return null;
  const exps = Object.entries(r.expenses).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  return (
    <Panel title={`Month ${r.month} Report`} sub="The monthly expense challenge: did the lifestyle pay for itself?" foot={<Btn kind="gold" onClick={close}>{r.net >= 0 ? 'Keep flexing' : 'Lesson learned'}</Btn>}>
      <div className="grid c2">
        <div className="card">
          <h4>Income</h4>
          <div className="kv small">
            <span>Gross creator revenue</span><span>{money(r.gross)}</span>
            <span>Agency commission</span><span className="pos">{money(r.commission)}</span>
            <span>Other income (club, events, deals)</span><span className="pos">{money(r.otherIncome)}</span>
            <span><b>Total income</b></span><b className="pos">{money(r.totalIncome)}</b>
          </div>
          <h3 className="sec">Biggest revenue sources</h3>
          {r.topSources.length ? r.topSources.map(([k, v]) => <div key={k} className="row between small"><span>{k}</span><span className="pos">{money(v)}</span></div>) : <div className="muted small">Nothing yet. Time to recruit.</div>}
        </div>
        <div className="card">
          <h4>Expenses</h4>
          <div className="kv small">
            {exps.map(([k, v]) => <Fragment key={k}><span>{k}</span><span className="neg">{money(v)}</span></Fragment>)}
            <span><b>Total expenses</b></span><b className="neg">{money(r.totalExpenses)}</b>
          </div>
        </div>
      </div>
      <div className="card" style={{ marginTop: 12, alignItems: 'center', textAlign: 'center' }}>
        <div className="muted small" style={{ letterSpacing: 2 }}>NET PROFIT / LOSS</div>
        <div style={{ fontSize: 40, fontWeight: 800 }} className={r.net >= 0 ? 'pos' : 'neg'}>{r.net >= 0 ? '+' : ''}{money(r.net)}</div>
        <div className="small">Trend: {r.trend === 'up' ? '📈 Improving' : r.trend === 'down' ? '📉 Declining' : '➡ Flat'} · Cash after bills: <b className={r.cashAfter < 0 ? 'neg' : ''}>{money(r.cashAfter)}</b> · Clout {r.cloutChange >= 0 ? '+' : ''}{r.cloutChange}</div>
        <div className="small muted" style={{ marginTop: 8 }}>
          {r.cashAfter < 0 ? 'You are in the red. Sell a car or watch (60–70% back), run brand partnerships, win events and keep recruiting — nothing here is permanent.' : r.net < 0 ? 'The lifestyle cost more than the business made. Watch those recurring bills.' : 'The business is paying for the flex. That is the whole point.'}
        </div>
      </div>
    </Panel>
  );
}

function ClubPanel() {
  const g = useGame((s) => s.game);
  const { buyClubUpgrade, hostClubEvent } = useGame();
  const [theme, setTheme] = useState('neon');
  const [budget, setBudget] = useState(1);
  const [result, setResult] = useState<string | null>(null);
  if (!g.properties.includes('club')) return <PropertyPanel id="club" />;
  return (
    <Panel title="VOLT · Club Management" sub={`Nightly door & bar ≈ ${money(clubNightly(g))} · Events hosted ${g.club.eventsHosted} · Record crowd ${g.club.bestAttendance}`} size="wide">
      <div className="grid c2">
        <div className="col">
          <h3 className="sec">Host an event tonight</h3>
          <div className="col">{CLUB_THEMES.map((t) => <div key={t.id} className="card small" style={{ cursor: 'pointer', borderColor: theme === t.id ? 'var(--gold)' : undefined }} onClick={() => setTheme(t.id)}><div className="row between"><b>{t.name}</b><span className="price">{money(t.cost)} base</span></div><div className="muted">{t.blurb}</div></div>)}</div>
          <div className="row wrap">{['Low', 'Standard', 'All-out'].map((b, i) => <Btn key={b} small active={budget === i} onClick={() => setBudget(i)}>{b} budget</Btn>)}</div>
          <Btn kind="gold" disabled={g.club.lastEventDay === g.day} onClick={() => { const r = hostClubEvent(theme, budget); if (r) { setResult(`${r.win ? '🔥 SUCCESS' : '😬 Quiet night'} — ${r.text} Net ${money(r.cash)}, +${r.clout} clout.`); audio.crowdCheer(r.win ? 1.2 : 0.3); } }}>{g.club.lastEventDay === g.day ? 'Already hosted tonight' : 'Host event'}</Btn>
          {result && <div className="card small">{result}</div>}
        </div>
        <div className="col">
          <h3 className="sec">Renovations & staff</h3>
          {CLUB_UPGRADES.map((u) => {
            const owned = g.club.upgrades.includes(u.id);
            return (
              <div key={u.id} className={`card small ${owned ? 'owned' : ''}`}>
                <div className="row between"><b>{u.name}</b><span className="price">{owned ? 'Installed' : money(u.price)}</span></div>
                <div className="muted">{u.blurb} · +{Math.round(u.attendance * 100)}% attendance · {money(u.upkeep)}/mo</div>
                {!owned && <Btn small kind="gold" disabled={g.cash < u.price} onClick={() => buyClubUpgrade(u.id)}>Install</Btn>}
              </div>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}

const HULL_PRICE = 75000;
const HULLS = [
  { name: 'Factory finish', color: '' },
  { name: 'Midnight Navy', color: '#0e1a2b' },
  { name: 'Pearl White', color: '#f4f4f2' },
  { name: 'Liquid Gold', color: '#c9a03a' },
  { name: 'Obsidian', color: '#0b0b0d' },
  { name: 'Miami Pink', color: '#ff5fa2' },
];

function MarinaPanel() {
  const g = useGame((s) => s.game);
  const { buyProperty, buyYacht } = useGame();
  const ui = useUI();
  const lvl = levelFor(g.clout);
  const cur = g.yacht ? YACHT_BY_ID[g.yacht] : null;
  const ready = isEndgameReady(g) && !g.endgameCelebrated;
  return (
    <Panel title="Bayside Marina" sub="Where “on the boat” becomes a personality." size="wide">
      <div className="col">
        {!g.properties.includes('slip') ? (
          <div className="card">
            <h4>Marina slip</h4>
            <div className="muted small">{PROPERTY_BY_ID.slip.blurb} Upkeep {money(PROPERTY_BY_ID.slip.upkeep)}/month.</div>
            <Btn kind="gold" disabled={lvl < PROPERTY_BY_ID.slip.minLevel || g.cash < PROPERTY_BY_ID.slip.price} onClick={() => buyProperty('slip')}>{lvl < PROPERTY_BY_ID.slip.minLevel ? `🔒 ${CLOUT_LEVELS[PROPERTY_BY_ID.slip.minLevel].name}` : `Buy slip · ${money(PROPERTY_BY_ID.slip.price)}`}</Btn>
          </div>
        ) : <div className="tag green">Slip owned</div>}
        {cur && (
          <div className="card owned">
            <div className="row between"><h4>Your yacht: {cur.name}</h4><Btn kind="gold" onClick={() => engine?.boardYacht()}>Board yacht</Btn></div>
            <div className="muted small">Walk the deck, sleep in the master suite, take the helm to cruise the bay, or host a yacht party from the aft deck.</div>
            <div className="mb-label" style={{ marginTop: 6 }}>Hull finish · {money(HULL_PRICE)}</div>
            <div className="swatches">
              {HULLS.map((h) => (
                <div key={h.name} title={h.name} className={`swatch ${g.yachtHull === h.color ? 'sel' : ''}`} style={{ background: h.color || 'repeating-linear-gradient(45deg,#ddd,#ddd 4px,#0e1a2b 4px,#0e1a2b 8px)' }}
                  onClick={() => { if (g.yachtHull === h.color) return; if (!h.color || useGame.getState().spend(HULL_PRICE, `Yacht hull: ${h.name}`, 'purchases')) useGame.getState().mutate((x) => { x.yachtHull = h.color; x.clout += h.color ? 10 : 0; }, { save: true }); }} />
              ))}
            </div>
          </div>
        )}
        {ready && (
          <div className="card" style={{ borderColor: 'var(--gold)' }}>
            <h4>👑 Everything is in place.</h4>
            <div className="small">Board your superyacht and throw the King of Brickell party from the aft deck.</div>
          </div>
        )}
        <h3 className="sec">Yachts</h3>
        <div className="grid c3">
          {YACHTS.map((y) => {
            const owned = g.yacht === y.id;
            const lower = cur && cur.rank >= y.rank;
            const trade = cur ? Math.round(cur.price * 0.6) : 0;
            return (
              <div key={y.id} className={`card ${owned ? 'owned' : ''} ${lvl < y.minLevel ? 'locked' : ''}`}>
                <h4>{y.name}</h4>
                <div className="muted small">{y.blurb}</div>
                <div className="kv small"><span>Length</span><span>{y.length * 3.3 | 0} ft</span><span>Upkeep</span><span>{money(y.upkeep)}/mo</span><span>Clout</span><span>+{y.clout}</span></div>
                <div className="price">{money(y.price)}{trade && !lower ? ` (−${money(trade, true)} trade-in)` : ''}</div>
                {owned ? <span className="tag green">Owned</span> : lower ? <span className="tag">Smaller than yours</span> : (
                  <Btn small kind="gold" disabled={!g.properties.includes('slip') || lvl < y.minLevel || g.cash < y.price - trade} onClick={() => buyYacht(y.id)}>{!g.properties.includes('slip') ? 'Needs a slip' : lvl < y.minLevel ? `🔒 ${CLOUT_LEVELS[y.minLevel].name}` : 'Buy'}</Btn>
                )}
              </div>
            );
          })}
        </div>
        <div className="row wrap">
          {EVENTS.filter((e) => e.poi === 'marina').map((e) => <Btn key={e.id} small onClick={() => ui.startEvent(e.id)}>{e.name}</Btn>)}
        </div>
      </div>
    </Panel>
  );
}

function PropertyPanel({ id }: { id?: string }) {
  const arg = useUI((s) => s.panelArg);
  const pid = id ?? arg ?? 'office';
  const p = PROPERTY_BY_ID[pid];
  const g = useGame((s) => s.game);
  const buy = useGame((s) => s.buyProperty);
  const ui = useUI();
  if (!p) return null;
  const owned = g.properties.includes(pid);
  const lvl = levelFor(g.clout);
  const needs = p.requires && !g.properties.includes(p.requires);
  return (
    <Panel title={p.name} sub={p.blurb} size="narrow">
      <div className="col">
        <div className="kv">
          <span>Price</span><b className="price">{money(p.price)}</b>
          <span>Monthly upkeep</span><span>{money(p.upkeep)}</span>
          <span>Clout</span><span>+{p.clout}</span>
          <span>Requires</span><span>{CLOUT_LEVELS[p.minLevel].name}{p.requires ? ` + ${PROPERTY_BY_ID[p.requires].name}` : ''}</span>
        </div>
        <h3 className="sec">Benefits</h3>
        <ul style={{ margin: 0, paddingLeft: 18 }} className="small">{p.benefits.map((b) => <li key={b}>{b}</li>)}</ul>
        {owned ? <span className="tag green">Owned</span> : (
          <Btn kind="gold" disabled={lvl < p.minLevel || !!needs || g.cash < p.price} onClick={() => { if (buy(pid)) { if (pid === 'penthouse') ui.close(); } }}>
            {lvl < p.minLevel ? `🔒 Requires ${CLOUT_LEVELS[p.minLevel].name}` : needs ? `Requires ${PROPERTY_BY_ID[p.requires!].name}` : g.cash < p.price ? 'Not enough cash' : `Buy for ${money(p.price)}`}
          </Btn>
        )}
        {owned && pid === 'penthouse' && <Btn onClick={() => { ui.close(); engine?.enterPenthouse(); }}>Take the elevator up</Btn>}
      </div>
    </Panel>
  );
}

// Drinks sold at each venue. `amount` raises drunkenness (1 = blackout), `sober` lowers it.
const DRINKS: Record<string, { name: string; price: number; amount: number; clout?: number; sober?: number }[]> = {
  cafe: [{ name: 'Triple espresso', price: 8, amount: 0, sober: 0.3 }, { name: 'Espresso martini', price: 22, amount: 0.12 }],
  brunch: [{ name: 'Bottomless mimosas', price: 45, amount: 0.25 }, { name: 'Cold brew', price: 7, amount: 0, sober: 0.2 }],
  restaurant: [{ name: 'Old fashioned', price: 28, amount: 0.15 }, { name: 'Bottle of Bordeaux', price: 900, amount: 0.3, clout: 2 }],
  rooftop: [{ name: 'Rosé', price: 24, amount: 0.12 }, { name: 'Sunset spritz tower', price: 350, amount: 0.3, clout: 2 }],
};

function VenuePanel() {
  const id = useUI((s) => s.panelArg) ?? 'cafe';
  const p = POI_BY_ID[id];
  const g = useGame((s) => s.game);
  const ui = useUI();
  const events = EVENTS.filter((e) => e.poi === id);
  const creators = CREATORS.filter((c) => c.venue === id);
  const rivals = RIVALS.filter((r) => r.venue === id);
  const contacts = CONTACTS.filter((c) => c.venue === id);
  return (
    <Panel title={p.name} sub={p.desc}>
      {(DRINKS[id] ?? []).length > 0 && (
        <>
          <h3 className="sec">{id === 'cafe' ? 'Menu' : 'Bar'}</h3>
          <div className="row wrap">
            {(DRINKS[id] ?? []).map((d) => (
              <Btn key={d.name} small onClick={() => {
                if (!engine) return;
                if (d.sober) {
                  if (engine.blackedOut) engine.soberUp(d.sober);
                  else if (useGame.getState().spend(d.price, d.name, 'purchases')) { engine.soberUp(d.sober); ui.notify(`${d.name} ☕ You feel a bit more sober.`, 'info'); }
                } else engine.drink(d.name, d.price, d.amount, d.clout);
              }}>{d.name} · {money(d.price)}</Btn>
            ))}
          </div>
        </>
      )}
      {events.length > 0 && <h3 className="sec">Events here</h3>}
      <div className="col">
        {events.map((e) => {
          const st = eventStatus(g, e);
          return (
            <div key={e.id} className={`card small ${st.ok ? '' : 'locked'}`}>
              <div className="row between"><b>{e.name}</b><span className="tag gold">up to {money(e.reward.cash, true)}</span></div>
              <div className="muted">{e.blurb}</div>
              <div className="row between"><span className={st.ok ? 'pos' : 'muted'}>{st.ok ? 'Available' : st.reason}</span><Btn small kind="gold" disabled={!st.ok} onClick={() => ui.startEvent(e.id)}>Open</Btn></div>
            </div>
          );
        })}
      </div>
      {(creators.length > 0 || rivals.length > 0 || contacts.length > 0) && <h3 className="sec">Who hangs out here</h3>}
      <div className="row wrap small">
        {creators.map((c) => <span key={c.id} className={`tag ${g.creators[c.id] ? 'green' : 'gold'}`}>{c.name}</span>)}
        {rivals.map((r) => <span key={r.id} className="tag red">{r.name}</span>)}
        {contacts.map((c) => <span key={c.id} className="tag blue">{g.contacts.includes(c.id) ? c.name : 'A business contact'}</span>)}
      </div>
      {(creators.length > 0 || rivals.length > 0 || contacts.length > 0) && <p className="small muted">Walk up to people (look for the floating diamonds) and press E to talk.</p>}
      {id === 'hq' && g.properties.includes('hq') && <p className="small muted">Your HQ boosts revenue and growth across the roster and doubles staff capacity.</p>}
    </Panel>
  );
}

function Finale() {
  const g = useGame((s) => s.game);
  const { celebrate } = useGame();
  const close = useUI((s) => s.close);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done && !g.endgameCelebrated) {
      engine?.launchFireworks(40);
      audio.crowdCheer(1.5);
      audio.ui('achieve');
      celebrate();
      setDone(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="overlay">
      <div className="panel narrow finale">
        <div className="panel-body">
          <div className="logo-kicker">THE PARTY OF THE DECADE</div>
          <h1>KING OF BRICKELL</h1>
          <p>From one Maybach and a rented studio to a superyacht, a nightclub, an agency empire and a garage full of flex.</p>
          <p className="muted small">{Object.keys(g.creators).length} creators · {g.vehicles.length} vehicles · {g.watches.length} watches · {money(g.cash, true)} in cash · Day {g.day}</p>
          <p className="muted small">Fireworks are lighting up Biscayne Bay. Keep playing as long as you like — Brickell is yours.</p>
          <Btn kind="gold" big onClick={close}>Long live the bounce 👑</Btn>
        </div>
      </div>
    </div>
  );
}

export function Panels() {
  const panel = useUI((s) => s.panel);
  switch (panel) {
    case 'pause': return <Pause />;
    case 'settings': return <SettingsPanel onClose={() => useUI.getState().open('pause')} />;
    case 'phone': return <Phone />;
    case 'map': return <MapScreen />;
    case 'maybach': return <MaybachPanel />;
    case 'dealer': return <DealerPanel />;
    case 'watch': return <WatchPanel />;
    case 'clothes': return <ClothesPanel />;
    case 'garage': return <GaragePanel />;
    case 'home': return <HomePanel />;
    case 'inspect': return <InspectPanel />;
    case 'dialogue': return <DialoguePanel />;
    case 'event': return <EventPanel />;
    case 'report': return <Report />;
    case 'club': return <ClubPanel />;
    case 'marina': return <MarinaPanel />;
    case 'property': return <PropertyPanel />;
    case 'venue': return <VenuePanel />;
    case 'finale': return <Finale />;
    case 'bar': return <BarPanel />;
    case 'casino': return <CasinoPanel />;
    case 'stash': return <StashPanel />;
    default: return null;
  }
}
