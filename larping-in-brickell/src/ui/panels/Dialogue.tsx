import { useMemo, useState } from 'react';
import { useGame } from '../../game/store';
import { useUI } from '../../game/uiStore';
import { CREATOR_BY_ID, type CreatorDef } from '../../game/data/creators';
import { CONTACT_BY_ID, RIVAL_BY_ID } from '../../game/data/rivals';
import { CLOUT_LEVELS, MONTH_DAYS, levelFor } from '../../game/data/catalog';
import { PITCHES, acceptChance, baseInterest } from '../../game/systems/recruit';
import { projectedDaily, STIPEND_COST } from '../../game/systems/economy';
import { money, pct, num, pick } from '../../game/systems/format';
import { audio } from '../../game/engine/audio';
import { Avatar, Bar, Btn, Toggle } from '../common';

function Shell(props: { name: string; sub: string; color: string; skin?: string; children: React.ReactNode }) {
  const close = useUI((s) => s.close);
  return (
    <div className="dialogue">
      <div className="panel">
        <div className="panel-head">
          <div className="dlg-speaker">
            <Avatar name={props.name} color={props.color} skin={props.skin} />
            <div>
              <h2 className="panel-title" style={{ fontSize: 22 }}>{props.name}</h2>
              <div className="panel-sub">{props.sub}</div>
            </div>
          </div>
          <button className="close-x" onClick={close}>✕</button>
        </div>
        <div className="panel-body">{props.children}</div>
      </div>
    </div>
  );
}

export function OfferForm(props: { def: CreatorDef; interest: number; mode: 'sign' | 'renew'; onDone: (accepted: boolean) => void; onBack: () => void }) {
  const g = useGame((s) => s.game);
  const { signCreator, declineCreator, renewContract } = useGame();
  const signed = g.creators[props.def.id];
  const [commission, setCommission] = useState(signed ? signed.contract.commission : Math.round(Math.min(0.4, props.def.maxCommission + 0.03) * 100) / 100);
  const [months, setMonths] = useState(signed ? signed.contract.durationMonths : 6);
  const [stipend, setStipend] = useState(signed ? signed.contract.growthStipend : false);
  const audience = signed ? signed.audience : props.def.audience;
  const pop = signed ? signed.popularity : props.def.popularity;
  const daily = projectedDaily(g, audience, pop, commission);
  const chance = acceptChance(g, props.def, props.interest, commission, months, stipend);
  const go = () => {
    const ok = Math.random() < chance;
    if (ok) {
      audio.ui('cash');
      if (props.mode === 'sign') signCreator(props.def.id, { commission, months, stipend });
      else renewContract(props.def.id, { commission, months, stipend });
    } else {
      audio.ui('error');
      if (props.mode === 'sign') declineCreator(props.def.id);
    }
    props.onDone(ok);
  };
  return (
    <div className="col" style={{ gap: 12 }}>
      <h3 className="sec">{props.mode === 'sign' ? 'Management contract' : 'Contract renewal'}</h3>
      <div className="slider-row">
        <span className="muted">Agency commission</span>
        <input type="range" min={0.1} max={0.5} step={0.01} value={commission} onChange={(e) => setCommission(parseFloat(e.target.value))} />
        <b style={{ textAlign: 'right' }}>{pct(commission)}</b>
      </div>
      <div className="row between">
        <span className="muted small">Contract duration</span>
        <div className="row">{[3, 6, 12].map((m) => <Btn key={m} small active={months === m} onClick={() => setMonths(m)}>{m} months</Btn>)}</div>
      </div>
      <div className="row between">
        <span className="muted small">Growth stipend (agency pays {money(STIPEND_COST)}/month for extra growth)</span>
        <Toggle on={stipend} onChange={setStipend} />
      </div>
      <div className="card">
        <div className="kv">
          <span>Creator keeps</span><b>{pct(1 - commission)}</b>
          <span>Projected agency commission</span><b className="pos">{money(daily)}/day · {money(daily * MONTH_DAYS)}/month</b>
          <span>Term</span><span>{months} in-game months ({months * MONTH_DAYS} days)</span>
          <span>Hidden fees</span><span>None. Ever.</span>
          <span>Likelihood they accept</span><b className={chance > 0.6 ? 'pos' : chance < 0.35 ? 'neg' : ''}>{Math.round(chance * 100)}%</b>
        </div>
        <Bar value={chance} color={chance > 0.6 ? 'green' : chance < 0.35 ? 'red' : undefined} />
        <div className="small muted">Fair split for {props.def.name.split(' ')[0]}: around {pct(props.def.maxCommission)} or lower. They care most about <b>{props.def.preference}</b>.</div>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <Btn kind="ghost" onClick={props.onBack}>Back</Btn>
        <Btn kind="gold" onClick={go}>{props.mode === 'sign' ? 'Propose contract' : 'Propose renewal'}</Btn>
      </div>
    </div>
  );
}

function CreatorDialogue({ id }: { id: string }) {
  const def = CREATOR_BY_ID[id];
  const g = useGame((s) => s.game);
  const close = useUI((s) => s.close);
  const ui = useUI();
  const lvl = levelFor(g.clout);
  const start = useMemo(() => baseInterest(g, def), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [interest, setInterest] = useState(start);
  const [used, setUsed] = useState<string[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [line, setLine] = useState(def.lines.greet);
  const [stage, setStage] = useState<'talk' | 'offer' | 'result'>('talk');
  const signed = g.creators[id];
  const sub = `${def.niche} · ${def.age} · ${def.handle} · ${num(signed ? signed.audience : def.audience)} subscribers · ${def.tier}`;

  if (signed && stage !== 'result') {
    const left = signed.contract.endDay - g.day;
    return (
      <Shell name={def.name} sub={`Your client · ${sub}`} color={def.look.outfit} skin={def.look.skin}>
        {stage === 'offer' ? (
          <OfferForm def={def} interest={signed.satisfaction} mode="renew" onBack={() => setStage('talk')} onDone={(ok) => { setLine(ok ? '"Locked in. Let\'s keep growing."' : '"I need a better deal than that. Let\'s talk again."'); setStage('result'); }} />
        ) : (
          <>
            <div className="dlg-line">"{signed.satisfaction > 70 ? 'Honestly? Best management I have had.' : signed.satisfaction > 45 ? 'Things are good. Could always be growing faster.' : 'I am not loving the split right now, not going to lie.'}"</div>
            <div className="kv" style={{ marginBottom: 12 }}>
              <span>Satisfaction</span><span>{Math.round(signed.satisfaction)}/100</span>
              <span>Yesterday's commission</span><span className="pos">{money(signed.lastDayCommission)}</span>
              <span>Contract</span><span>{pct(signed.contract.commission)} · {left > 0 ? `${left} days left` : 'expires today'}</span>
            </div>
            <div className="choices">
              <button className="choice" onClick={() => { ui.setPhoneApp('alwaysfans'); ui.open('phone'); }}>Plan a marketing campaign together</button>
              <button className="choice" onClick={() => setStage('offer')}>Renegotiate / renew the contract</button>
              <button className="choice" onClick={close}>"Keep up the great work." (leave)</button>
            </div>
          </>
        )}
      </Shell>
    );
  }

  if (lvl < def.minLevel) {
    return (
      <Shell name={def.name} sub={sub} color={def.look.outfit} skin={def.look.skin}>
        <div className="dlg-line">"Sorry, I only take meetings with managers who are at least <b>{CLOUT_LEVELS[def.minLevel].name}</b> level. No offense."</div>
        <div className="small muted">Raise your Brickell Clout to level {def.minLevel + 1} to pitch {def.name.split(' ')[0]}.</div>
        <div className="choices" style={{ marginTop: 12 }}><button className="choice" onClick={close}>"Totally fair. See you around." (leave)</button></div>
      </Shell>
    );
  }
  if ((g.cooldowns[id] ?? 0) > g.day && stage !== 'result') {
    return (
      <Shell name={def.name} sub={sub} color={def.look.outfit} skin={def.look.skin}>
        <div className="dlg-line">"We already talked about this. Give me a day to think, okay?"</div>
        <div className="small muted">Try again tomorrow. Meanwhile: run a campaign, attend an event or recruit someone else.</div>
        <div className="choices" style={{ marginTop: 12 }}><button className="choice" onClick={close}>Respect their time (leave)</button></div>
      </Shell>
    );
  }

  const pitch = (pid: string) => {
    const p = PITCHES.find((x) => x.id === pid)!;
    const r = p.effect(g, def);
    setUsed([...used, pid]);
    setInterest(Math.max(0, Math.min(100, interest + r.delta)));
    setLog([...log, `› ${p.label}`, r.line]);
    setLine(r.delta >= 10 ? def.lines.intrigued : r.delta < 0 ? 'Hmm.' : 'Okay...');
  };

  return (
    <Shell name={def.name} sub={sub} color={def.look.outfit} skin={def.look.skin}>
      <div className="small muted" style={{ marginBottom: 6 }}>{def.personality}</div>
      {stage === 'talk' && (
        <>
          <div className="dlg-line">"{line}"</div>
          {log.length > 0 && <div className="dlg-log">{log.map((l, i) => <div key={i}>{l}</div>)}</div>}
          <div className="row between small" style={{ margin: '10px 0 4px' }}><span className="muted">Interest</span><b>{Math.round(interest)}/100</b></div>
          <Bar value={interest / 100} />
          <div className="choices" style={{ marginTop: 12 }}>
            {PITCHES.map((p) => (
              <button key={p.id} className="choice" disabled={used.includes(p.id)} onClick={() => pitch(p.id)}>{p.label}</button>
            ))}
            <button className="choice" style={{ borderColor: 'var(--gold)' }} onClick={() => setStage('offer')}>Make a contract offer →</button>
            <button className="choice" onClick={close}>End the conversation respectfully</button>
          </div>
        </>
      )}
      {stage === 'offer' && (
        <OfferForm def={def} interest={interest} mode="sign" onBack={() => setStage('talk')} onDone={(ok) => { setLine(ok ? def.lines.accept : def.lines.decline); setStage('result'); }} />
      )}
      {stage === 'result' && (
        <>
          <div className="dlg-line">"{line}"</div>
          <div className="small muted">{g.creators[id] ? 'Welcome to the roster! Manage them in Phone → AlwaysFans Manager.' : 'They declined — and that is their call. You can try again tomorrow.'}</div>
          <div className="choices" style={{ marginTop: 12 }}><button className="choice" onClick={close}>Continue</button></div>
        </>
      )}
    </Shell>
  );
}

function RivalDialogue({ id }: { id: string }) {
  const r = RIVAL_BY_ID[id];
  const g = useGame((s) => s.game);
  const ui = useUI();
  const [line, setLine] = useState(() => pick(r.lines));
  const rs = g.rivals[id];
  const lvl = levelFor(g.clout);
  const canShow = lvl >= r.minLevel && g.eventsDone[`showdown_${id}`] !== g.day;
  return (
    <Shell name={r.name} sub={`${r.agency} · ${r.strategy} · Drives: ${r.vehicle}`} color={r.color} skin={r.look.skin}>
      <div className="dlg-line">"{line}"</div>
      <div className="kv small" style={{ marginBottom: 12 }}>
        <span>Their clout</span><span>{num(rs.clout)}</span>
        <span>Their roster</span><span>{rs.roster} creators</span>
        <span>Their revenue</span><span>{money(rs.revenue)}/day</span>
        <span>Status</span><span>{rs.defeated ? 'You beat them in a showdown 🏆' : 'Undefeated (for now)'}</span>
      </div>
      <div className="choices">
        <button className="choice" disabled={!canShow} onClick={() => ui.startEvent(`showdown_${id}`)}>
          {lvl < r.minLevel ? `Challenge to a showdown (needs ${CLOUT_LEVELS[r.minLevel].name})` : g.eventsDone[`showdown_${id}`] === g.day ? 'Showdown done today' : 'Challenge to an agency showdown'}
        </button>
        <button className="choice" onClick={() => setLine(pick(r.lines))}>"Tell me more about your 'strategy'."</button>
        <button className="choice" onClick={() => { setLine("Ha. Nice try. I'm still not telling you who does my wrap."); useGame.getState().mutate((x) => { x.rivals[id].relation += 2; }); }}>Compliment their car</button>
        <button className="choice" onClick={ui.close}>Walk away with dignity</button>
      </div>
    </Shell>
  );
}

function ContactDialogue({ id }: { id: string }) {
  const c = CONTACT_BY_ID[id];
  const g = useGame((s) => s.game);
  const ui = useUI();
  const [line, setLine] = useState(c.lines[0]);
  const key = `contactRef_${id}`;
  const usedToday = (g.stats[key] || 0) === g.day;
  return (
    <Shell name={c.name} sub={c.role} color={c.look.outfit} skin={c.look.skin}>
      <div className="dlg-line">"{line}"</div>
      <div className="choices">
        <button className="choice" onClick={() => setLine(pick(c.lines))}>Ask for advice</button>
        <button className="choice" disabled={usedToday} onClick={() => {
          useGame.getState().mutate((x) => { x.stats[key] = x.day; });
          const st = useGame.getState();
          if (id === 'gloria') { st.mutate((x) => { x.cooldowns = {}; }); setLine('I made some calls. Every creator who said "maybe" will take your meeting again today.'); }
          else if (id === 'marco') { st.addClout(4, 'Marco told the valets about you'); setLine('I told all the valets in Brickell who you are. Arrive slow, leave a legend.'); }
          else if (id === 'palmetto') { st.addClout(4, 'DJ Palmetto shouted you out'); setLine('Shout-out on the mic tonight. Your name, my reverb.'); }
          else { st.addClout(4, 'Captain Yuki vouched for you'); setLine('I will put in a word with the marina. Slip holders like people who pay on time.'); }
        }}>{usedToday ? 'Already helped you today' : 'Ask for a favor / referral'}</button>
        <button className="choice" onClick={ui.close}>Thank them (leave)</button>
      </div>
    </Shell>
  );
}

export function DialoguePanel() {
  const d = useUI((s) => s.dialogue);
  if (!d) return null;
  if (d.kind === 'creator') return <CreatorDialogue key={d.id} id={d.id} />;
  if (d.kind === 'rival') return <RivalDialogue key={d.id} id={d.id} />;
  if (d.kind === 'contact') return <ContactDialogue key={d.id} id={d.id} />;
  return null;
}
