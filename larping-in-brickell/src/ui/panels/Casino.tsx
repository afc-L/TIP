// The Gilded Flamingo casino games and the bar menus (VOLT + casino).
import { useEffect, useRef, useState } from 'react';
import { useGame } from '../../game/store';
import { useUI } from '../../game/uiStore';
import { engine } from '../../game/engine/Engine';
import { audio } from '../../game/engine/audio';
import { money } from '../../game/systems/format';
import { Btn, Panel } from '../common';

// ------------------------------------------------------------------ shared
const CHIPS = [100, 500, 1000, 5000, 25000, 100000];
const MAX_BET = 250000;

function useCash() {
  return useGame((s) => s.game.cash);
}

function BetPicker(props: { bet: number; setBet: (n: number) => void; disabled?: boolean }) {
  const cash = useCash();
  return (
    <div className="row wrap" style={{ gap: 6 }}>
      <span className="muted small">Bet</span>
      {CHIPS.map((c) => (
        <button key={c} className={`chip ${props.bet === c ? 'sel' : ''}`} disabled={props.disabled || c > cash || c > MAX_BET} onClick={() => props.setBet(c)}>
          {c >= 1000 ? `${c / 1000}K` : c}
        </button>
      ))}
    </div>
  );
}

function stake(bet: number, game: string): boolean {
  const g = useGame.getState();
  if (g.game.cash < bet) {
    useUI.getState().notify('Not enough cash for that bet.', 'bad');
    audio.ui('error');
    return false;
  }
  g.gamble(-bet, `${game} bet`);
  return true;
}

function payout(amount: number, game: string) {
  if (amount <= 0) return;
  useGame.getState().gamble(amount, `${game} payout`);
  audio.ui(amount >= 10000 ? 'achieve' : 'cash');
}

// ------------------------------------------------------------------ cards
type Suit = '♠' | '♥' | '♦' | '♣';
interface Card { r: number; s: Suit } // r: 2..14 (14 = ace)
const SUITS: Suit[] = ['♠', '♥', '♦', '♣'];
const RANK = (r: number) => (r <= 10 ? String(r) : ['J', 'Q', 'K', 'A'][r - 11]);

function shoe(decks: number): Card[] {
  const out: Card[] = [];
  for (let d = 0; d < decks; d++) for (const s of SUITS) for (let r = 2; r <= 14; r++) out.push({ r, s });
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function CardView({ c, hidden, held, onClick }: { c: Card; hidden?: boolean; held?: boolean; onClick?: () => void }) {
  const red = c.s === '♥' || c.s === '♦';
  return (
    <div className={`pcard ${hidden ? 'back' : ''} ${held ? 'held' : ''} ${onClick ? 'click' : ''}`} onClick={onClick} style={{ color: red ? '#c4122a' : '#111' }}>
      {!hidden && (
        <>
          <span className="tl">{RANK(c.r)}<br />{c.s}</span>
          <span className="mid">{c.s}</span>
        </>
      )}
      {held && <span className="holdtag">HELD</span>}
    </div>
  );
}

// ------------------------------------------------------------------ blackjack
function bjValue(h: Card[]) {
  let v = 0, aces = 0;
  for (const c of h) {
    if (c.r === 14) { aces++; v += 11; } else v += c.r >= 10 ? 10 : c.r;
  }
  while (v > 21 && aces > 0) { v -= 10; aces--; }
  return v;
}

function Blackjack() {
  const [bet, setBet] = useState(1000);
  const deck = useRef<Card[]>(shoe(6));
  const [player, setPlayer] = useState<Card[]>([]);
  const [dealer, setDealer] = useState<Card[]>([]);
  const [stakeAmt, setStakeAmt] = useState(0);
  const [phase, setPhase] = useState<'bet' | 'play' | 'done'>('bet');
  const [msg, setMsg] = useState('Dealer stands on all 17s. Blackjack pays 3:2.');
  const draw = () => {
    if (deck.current.length < 20) deck.current = shoe(6);
    return deck.current.pop()!;
  };
  const settle = (p: Card[], d: Card[], amt: number) => {
    const pv = bjValue(p), dv = bjValue(d);
    let win = 0, text = '';
    if (pv > 21) text = `Bust with ${pv}. The house says thank you.`;
    else if (p.length === 2 && pv === 21 && !(d.length === 2 && dv === 21)) { win = amt * 2.5; text = `BLACKJACK! +${money(amt * 1.5)}`; }
    else if (dv > 21) { win = amt * 2; text = `Dealer busts with ${dv}. You win ${money(amt)}!`; }
    else if (pv > dv) { win = amt * 2; text = `${pv} beats ${dv}. You win ${money(amt)}!`; }
    else if (pv === dv) { win = amt; text = `Push at ${pv}. Bet returned.`; }
    else text = `Dealer's ${dv} beats your ${pv}.`;
    payout(win, 'Blackjack');
    setMsg(text);
    setPhase('done');
  };
  const dealerPlay = (p: Card[], d: Card[], amt: number) => {
    const dd = [...d];
    if (bjValue(p) <= 21) while (bjValue(dd) < 17) dd.push(draw());
    setDealer(dd);
    settle(p, dd, amt);
  };
  const deal = () => {
    if (!stake(bet, 'Blackjack')) return;
    const p = [draw(), draw()], d = [draw(), draw()];
    setPlayer(p);
    setDealer(d);
    setStakeAmt(bet);
    setMsg('Hit, stand or double down.');
    setPhase('play');
    audio.ui('click');
    if (bjValue(p) === 21 || bjValue(d) === 21) {
      setDealer(d);
      settle(p, d, bet);
    }
  };
  const hit = () => {
    const p = [...player, draw()];
    setPlayer(p);
    if (bjValue(p) > 21) settle(p, dealer, stakeAmt);
    else if (bjValue(p) === 21) dealerPlay(p, dealer, stakeAmt);
  };
  const double = () => {
    if (!stake(stakeAmt, 'Blackjack double down')) return;
    const amt = stakeAmt * 2;
    setStakeAmt(amt);
    const p = [...player, draw()];
    setPlayer(p);
    dealerPlay(p, dealer, amt);
  };
  const cash = useCash();
  return (
    <div className="col felt">
      <div className="muted small">DEALER {phase !== 'play' && dealer.length ? `· ${bjValue(dealer)}` : ''}</div>
      <div className="row wrap hand">{dealer.map((c, i) => <CardView key={i} c={c} hidden={phase === 'play' && i === 1} />)}</div>
      <div className="muted small">YOU {player.length ? `· ${bjValue(player)}` : ''} {stakeAmt && phase !== 'bet' ? `· bet ${money(stakeAmt)}` : ''}</div>
      <div className="row wrap hand">{player.map((c, i) => <CardView key={i} c={c} />)}</div>
      <div className="casino-msg">{msg}</div>
      {phase === 'play' ? (
        <div className="row wrap">
          <Btn kind="gold" onClick={hit}>Hit</Btn>
          <Btn onClick={() => dealerPlay(player, dealer, stakeAmt)}>Stand</Btn>
          <Btn disabled={player.length !== 2 || cash < stakeAmt} onClick={double}>Double down</Btn>
        </div>
      ) : (
        <div className="col">
          <BetPicker bet={bet} setBet={setBet} />
          <div><Btn kind="gold" disabled={cash < bet} onClick={deal}>Deal · {money(bet)}</Btn></div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ roulette (European, single zero)
const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
type RBet = { key: string; label: string; amount: number; wins: (n: number) => boolean; pays: number };

function rouletteBet(key: string): Omit<RBet, 'amount'> {
  if (key.startsWith('n')) {
    const n = Number(key.slice(1));
    return { key, label: `Straight ${n}`, wins: (x) => x === n, pays: 35 };
  }
  const outside: Record<string, Omit<RBet, 'amount' | 'key'>> = {
    red: { label: 'Red', wins: (x) => REDS.has(x), pays: 1 },
    black: { label: 'Black', wins: (x) => x > 0 && !REDS.has(x), pays: 1 },
    odd: { label: 'Odd', wins: (x) => x > 0 && x % 2 === 1, pays: 1 },
    even: { label: 'Even', wins: (x) => x > 0 && x % 2 === 0, pays: 1 },
    low: { label: '1–18', wins: (x) => x >= 1 && x <= 18, pays: 1 },
    high: { label: '19–36', wins: (x) => x >= 19, pays: 1 },
    d1: { label: '1st 12', wins: (x) => x >= 1 && x <= 12, pays: 2 },
    d2: { label: '2nd 12', wins: (x) => x >= 13 && x <= 24, pays: 2 },
    d3: { label: '3rd 12', wins: (x) => x >= 25, pays: 2 },
  };
  return { key, ...outside[key] };
}

function Roulette() {
  const [chip, setChip] = useState(1000);
  const [bets, setBets] = useState<RBet[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [shown, setShown] = useState<number | null>(null);
  const [msg, setMsg] = useState('Place chips on the board, then spin. Single zero.');
  const [history, setHistory] = useState<number[]>([]);
  const cash = useCash();
  const total = bets.reduce((a, b) => a + b.amount, 0);
  const place = (key: string) => {
    if (spinning) return;
    if (total + chip > cash) { useUI.getState().notify('Not enough cash for another chip.', 'warn'); return; }
    if (total + chip > MAX_BET) { useUI.getState().notify(`Table limit is ${money(MAX_BET)} per spin.`, 'warn'); return; }
    audio.ui('click');
    setBets((bs) => {
      const ex = bs.find((b) => b.key === key);
      if (ex) return bs.map((b) => (b.key === key ? { ...b, amount: b.amount + chip } : b));
      return [...bs, { ...rouletteBet(key), amount: chip }];
    });
  };
  const timer = useRef<number | null>(null);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);
  const spin = () => {
    if (!bets.length || spinning) return;
    if (!stake(total, 'Roulette')) return;
    const result = Math.floor(Math.random() * 37);
    setSpinning(true);
    let ticks = 0;
    timer.current = window.setInterval(() => {
      ticks++;
      setShown(Math.floor(Math.random() * 37));
      if (ticks > 18) {
        clearInterval(timer.current!);
        timer.current = null;
        setShown(result);
        let win = 0;
        for (const b of bets) if (b.wins(result)) win += b.amount * (b.pays + 1);
        payout(win, 'Roulette');
        const color = result === 0 ? 'green' : REDS.has(result) ? 'red' : 'black';
        setMsg(win > 0 ? `${result} ${color}! You collect ${money(win)} (net ${win - total >= 0 ? '+' : ''}${money(win - total)}).` : `${result} ${color}. The croupier sweeps your chips.`);
        setHistory((h) => [result, ...h].slice(0, 12));
        setBets([]);
        setSpinning(false);
      }
    }, 80);
  };
  const amt = (key: string) => bets.find((b) => b.key === key)?.amount;
  const cell = (key: string, label: string, cls = '') => (
    <button className={`rcell ${cls}`} onClick={() => place(key)} disabled={spinning}>
      {label}
      {amt(key) ? <span className="rchip">{amt(key)! >= 1000 ? `${amt(key)! / 1000}K` : amt(key)}</span> : null}
    </button>
  );
  return (
    <div className="col felt">
      <div className="row between wrap">
        <div className={`rball ${shown === null ? '' : shown === 0 ? 'g' : REDS.has(shown) ? 'r' : 'b'}`}>{shown ?? '–'}</div>
        <div className="row wrap" style={{ gap: 4 }}>{history.map((n, i) => <span key={i} className={`rhist ${n === 0 ? 'g' : REDS.has(n) ? 'r' : 'b'}`}>{n}</span>)}</div>
      </div>
      <div className="rboard">
        {cell('n0', '0', 'g zero')}
        {Array.from({ length: 36 }, (_, i) => i + 1).map((n) => <span key={n} style={{ display: 'contents' }}>{cell(`n${n}`, String(n), REDS.has(n) ? 'r' : 'b')}</span>)}
      </div>
      <div className="row wrap" style={{ gap: 6 }}>
        {cell('d1', '1st 12')}{cell('d2', '2nd 12')}{cell('d3', '3rd 12')}
        {cell('low', '1–18')}{cell('even', 'Even')}{cell('red', 'Red', 'r')}{cell('black', 'Black', 'b')}{cell('odd', 'Odd')}{cell('high', '19–36')}
      </div>
      <div className="casino-msg">{msg}</div>
      <BetPicker bet={chip} setBet={setChip} disabled={spinning} />
      <div className="row wrap">
        <Btn kind="gold" disabled={!bets.length || spinning} onClick={spin}>{spinning ? 'Spinning…' : `Spin · ${money(total)} on the table`}</Btn>
        <Btn disabled={!bets.length || spinning} onClick={() => setBets([])}>Clear bets</Btn>
      </div>
      <div className="small muted">Straight up pays 35:1 · dozens 2:1 · red/black, odd/even, 1–18/19–36 pay 1:1.</div>
    </div>
  );
}

// ------------------------------------------------------------------ slots
const SYMBOLS = [
  { s: '🍒', w: 30, three: 3 },
  { s: '🍋', w: 25, three: 5 },
  { s: '🔔', w: 20, three: 10 },
  { s: '💎', w: 12, three: 25 },
  { s: '7️⃣', w: 8, three: 50 },
  { s: '🦩', w: 5, three: 100 },
];
const PAIR_PAYS = 1.2;
function spinReel() {
  let r = Math.random() * 100;
  for (const x of SYMBOLS) {
    if (r < x.w) return x.s;
    r -= x.w;
  }
  return SYMBOLS[0].s;
}

function Slots() {
  const [bet, setBet] = useState(500);
  const [reels, setReels] = useState(['🦩', '🦩', '🦩']);
  const [spinning, setSpinning] = useState(false);
  const [msg, setMsg] = useState('Three flamingos pay 100×. Any pair pays 1.2×.');
  const cash = useCash();
  const timer = useRef<number | null>(null);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);
  const pull = () => {
    if (spinning || !stake(bet, 'Slots')) return;
    const result = [spinReel(), spinReel(), spinReel()];
    setSpinning(true);
    let t = 0;
    timer.current = window.setInterval(() => {
      t++;
      setReels((r) => r.map((s, i) => (t > 8 + i * 4 ? result[i] : spinReel())));
      if (t > 18) {
        clearInterval(timer.current!);
        timer.current = null;
        setReels(result);
        setSpinning(false);
        let mult = 0;
        if (result[0] === result[1] && result[1] === result[2]) mult = SYMBOLS.find((x) => x.s === result[0])!.three;
        else if (result[0] === result[1] || result[1] === result[2] || result[0] === result[2]) mult = PAIR_PAYS;
        const win = Math.round(bet * mult);
        payout(win, 'Slots');
        setMsg(mult >= 25 ? `JACKPOT-ish! ${mult}× · ${money(win)}` : mult >= 3 ? `Three of a kind! ${mult}× · ${money(win)}` : mult > 0 ? `A pair. ${money(win)} back.` : 'Nothing. The flamingo judges you.');
        if (mult >= 25) audio.crowdCheer(1);
      }
    }, 70);
  };
  return (
    <div className="col felt" style={{ alignItems: 'center' }}>
      <div className="reels">{reels.map((s, i) => <div key={i} className={`reel ${spinning ? 'spin' : ''}`}>{s}</div>)}</div>
      <div className="casino-msg">{msg}</div>
      <BetPicker bet={bet} setBet={setBet} disabled={spinning} />
      <Btn kind="gold" big disabled={spinning || cash < bet} onClick={pull}>{spinning ? 'Spinning…' : `Pull · ${money(bet)}`}</Btn>
      <div className="row wrap small muted" style={{ gap: 10, justifyContent: 'center' }}>
        {[...SYMBOLS].reverse().map((x) => <span key={x.s}>{x.s}{x.s}{x.s} {x.three}×</span>)}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ video poker (Jacks or Better, 9/6)
const PAYTABLE: [string, number][] = [
  ['Royal Flush', 800], ['Straight Flush', 50], ['Four of a Kind', 25], ['Full House', 9], ['Flush', 6], ['Straight', 4], ['Three of a Kind', 3], ['Two Pair', 2], ['Jacks or Better', 1],
];

function evalPoker(h: Card[]): [string, number] | null {
  const ranks = h.map((c) => c.r).sort((a, b) => a - b);
  const counts = new Map<number, number>();
  for (const r of ranks) counts.set(r, (counts.get(r) || 0) + 1);
  const groups = [...counts.values()].sort((a, b) => b - a);
  const flush = h.every((c) => c.s === h[0].s);
  const uniq = [...new Set(ranks)];
  const straight = uniq.length === 5 && (ranks[4] - ranks[0] === 4 || ranks.join() === '2,3,4,5,14');
  const pay = (name: string): [string, number] => PAYTABLE.find(([n]) => n === name)!;
  if (straight && flush && ranks[0] === 10) return pay('Royal Flush');
  if (straight && flush) return pay('Straight Flush');
  if (groups[0] === 4) return pay('Four of a Kind');
  if (groups[0] === 3 && groups[1] === 2) return pay('Full House');
  if (flush) return pay('Flush');
  if (straight) return pay('Straight');
  if (groups[0] === 3) return pay('Three of a Kind');
  if (groups[0] === 2 && groups[1] === 2) return pay('Two Pair');
  if ([...counts.entries()].some(([r, n]) => n === 2 && r >= 11)) return pay('Jacks or Better');
  return null;
}

function VideoPoker() {
  const [bet, setBet] = useState(500);
  const [hand, setHand] = useState<Card[]>([]);
  const [held, setHeld] = useState([false, false, false, false, false]);
  const [phase, setPhase] = useState<'bet' | 'draw'>('bet');
  const [msg, setMsg] = useState('Deal five cards, hold the ones you want, draw once.');
  const [stakeAmt, setStakeAmt] = useState(0);
  const deck = useRef<Card[]>([]);
  const cash = useCash();
  const deal = () => {
    if (!stake(bet, 'Video poker')) return;
    deck.current = shoe(1);
    setHand(deck.current.splice(0, 5));
    setHeld([false, false, false, false, false]);
    setStakeAmt(bet);
    setPhase('draw');
    setMsg('Click cards to hold them, then draw.');
  };
  const drawCards = () => {
    const h = hand.map((c, i) => (held[i] ? c : deck.current.pop()!));
    setHand(h);
    setPhase('bet');
    const r = evalPoker(h);
    const win = r ? stakeAmt * r[1] : 0;
    payout(win, 'Video poker');
    setMsg(r ? `${r[0]}! Pays ${r[1]}× · ${money(win)}` : 'No win. Jacks or better needed.');
  };
  const current = phase === 'draw' ? evalPoker(hand) : null;
  return (
    <div className="col felt">
      <div className="paytable">{PAYTABLE.map(([n, p]) => <span key={n} className={current?.[0] === n ? 'hit' : ''}>{n}<b>{p}×</b></span>)}</div>
      <div className="row wrap hand" style={{ justifyContent: 'center' }}>
        {hand.length ? hand.map((c, i) => <CardView key={i} c={c} held={phase === 'draw' && held[i]} onClick={phase === 'draw' ? () => setHeld(held.map((h, j) => (j === i ? !h : h))) : undefined} />)
          : Array.from({ length: 5 }).map((_, i) => <CardView key={i} c={{ r: 14, s: '♠' }} hidden />)}
      </div>
      <div className="casino-msg">{msg}{current && phase === 'draw' ? ` (currently: ${current[0]})` : ''}</div>
      {phase === 'draw' ? <div><Btn kind="gold" onClick={drawCards}>Draw</Btn></div> : (
        <div className="col">
          <BetPicker bet={bet} setBet={setBet} />
          <div><Btn kind="gold" disabled={cash < bet} onClick={deal}>Deal · {money(bet)}</Btn></div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ casino panel
const GAMES: Record<string, { title: string; sub: string; el: () => React.ReactElement }> = {
  blackjack: { title: 'Blackjack', sub: 'Six-deck shoe · dealer stands on 17 · blackjack pays 3:2', el: () => <Blackjack /> },
  roulette: { title: 'Roulette', sub: 'European wheel · single zero', el: () => <Roulette /> },
  slots: { title: 'Flamingo Slots', sub: 'Three reels · pull responsibly-ish', el: () => <Slots /> },
  poker: { title: 'Video Poker', sub: 'Jacks or Better · 9/6 paytable', el: () => <VideoPoker /> },
};

export function CasinoPanel() {
  const arg = useUI((s) => s.panelArg) ?? 'blackjack';
  const [game, setGame] = useState(arg in GAMES ? arg : 'blackjack');
  const cash = useCash();
  const net = useGame((s) => s.game.stats.casinoNet || 0);
  const G = GAMES[game];
  return (
    <Panel title={G.title} sub={`${G.sub} · Cash ${money(cash)} · Lifetime ${net >= 0 ? '+' : ''}${money(net)}`} size="wide">
      <div className="tabs">{Object.entries(GAMES).map(([k, v]) => <Btn key={k} small active={game === k} onClick={() => setGame(k)}>{v.title}</Btn>)}</div>
      <G.el key={game} />
    </Panel>
  );
}

// ------------------------------------------------------------------ bars
interface Drink { name: string; price: number; amount: number; clout?: number; sober?: number; blurb: string }
const BARS: Record<string, { title: string; sub: string; drinks: Drink[] }> = {
  volt: {
    title: 'VOLT Bar',
    sub: 'Bass in your chest, sparklers in your eyes.',
    drinks: [
      { name: 'Tequila shot', price: 40, amount: 0.15, blurb: 'Salt, lime, regret.' },
      { name: 'Vodka soda', price: 28, amount: 0.12, blurb: 'The official drink of people who say "I\'m on a cut".' },
      { name: 'Neon Margarita', price: 35, amount: 0.15, blurb: 'Glows under blacklight. So will you.' },
      { name: 'Round of shots for the section', price: 600, amount: 0.25, clout: 2, blurb: 'Everybody loves you for 4 minutes.' },
      { name: 'Champagne bottle', price: 900, amount: 0.25, clout: 2, blurb: 'Comes with a sparkler and a photographer.' },
      { name: 'Bottle service', price: 2500, amount: 0.3, clout: 3, blurb: 'Parade of sparklers to your table.' },
      { name: 'Ace of Diamonds jeroboam', price: 25000, amount: 0.35, clout: 12, blurb: 'A three-liter bottle carried by four people.' },
      { name: 'Water', price: 8, amount: 0, sober: 0.1, blurb: 'Hydration is the real flex.' },
    ],
  },
  casino: {
    title: 'The Flamingo Bar',
    sub: 'Gold bar top. Gold-rimmed glasses. Gold-level markup.',
    drinks: [
      { name: 'Dry martini', price: 32, amount: 0.15, blurb: 'Shaken, because you saw it in a movie.' },
      { name: 'Old fashioned', price: 30, amount: 0.15, blurb: 'Smoked tableside, obviously.' },
      { name: 'Flamingo Fizz', price: 26, amount: 0.12, blurb: 'Pink, bubbly, dangerously easy.' },
      { name: '25-year single malt', price: 450, amount: 0.2, clout: 1, blurb: 'Older than half the creators you manage.' },
      { name: 'High-roller champagne tower', price: 8000, amount: 0.3, clout: 6, blurb: 'Forty coupes. Zero spills (so far).' },
      { name: 'Espresso', price: 9, amount: 0, sober: 0.25, blurb: 'Sharpens you up for the next hand.' },
    ],
  },
};

export function BarPanel() {
  const id = useUI((s) => s.panelArg) ?? 'volt';
  const bar = BARS[id] ?? BARS.volt;
  const drunk = useUI((s) => s.rt.drunk);
  const cash = useCash();
  const order = (d: Drink) => {
    if (!engine) return;
    if (d.sober) {
      if (engine.blackedOut) {
        engine.soberUp(d.sober); // explains that only sleep helps now
        return;
      }
      if (useGame.getState().spend(d.price, d.name, 'purchases')) {
        engine.soberUp(d.sober);
        useUI.getState().notify(`${d.name}. You feel a little sharper.`, 'info');
      }
      return;
    }
    engine.drink(d.name, d.price, d.amount, d.clout);
  };
  const level = drunk < 0.05 ? 'Sober' : drunk < 0.3 ? 'Tipsy' : drunk < 0.6 ? 'Buzzed' : drunk < 0.85 ? 'Drunk' : 'Wasted';
  return (
    <Panel title={bar.title} sub={`${bar.sub} · You: ${level}`}>
      <div className="grid c2">
        {bar.drinks.map((d) => (
          <div key={d.name} className="card">
            <div className="row between"><h4>{d.name}</h4><span className="price">{money(d.price)}</span></div>
            <div className="small muted">{d.blurb}</div>
            <div className="row between">
              <span className="small">{d.sober ? '☕ Sobers you up' : `🥂 ${'●'.repeat(Math.max(1, Math.round(d.amount * 10)))}`}{d.clout ? ` · +${d.clout} clout` : ''}</span>
              <Btn small kind="gold" disabled={cash < d.price} onClick={() => order(d)}>Order</Btn>
            </div>
          </div>
        ))}
      </div>
      <p className="small muted">Drink too much and you black out. Each ● is roughly how hard it hits.</p>
    </Panel>
  );
}
