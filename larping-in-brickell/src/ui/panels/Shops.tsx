import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { useGame } from '../../game/store';
import { useUI } from '../../game/uiStore';
import { ACCENTS, INTERIORS, MOD_PRICES, PAINTS, UNDERGLOWS, VEHICLES, VEHICLE_BY_ID, WHEELS } from '../../game/data/vehicles';
import { CLOUT_LEVELS, OUTFITS, OUTFIT_BY_ID, WATCHES, WATCH_BY_ID, levelFor, type WatchDef } from '../../game/data/catalog';
import { buildCar } from '../../game/engine/carModel';
import { vehicleResale } from '../../game/systems/economy';
import { money } from '../../game/systems/format';
import { engine } from '../../game/engine/Engine';
import type { VehicleMods } from '../../game/types';
import { Btn, Confirm, Panel } from '../common';

// ------------------------------------------------------------------ rotating 3D car preview
export function CarPreview(props: { id: string; mods: VehicleMods; height?: number }) {
  const host = useRef<HTMLDivElement>(null);
  const st = useRef<{ r: THREE.WebGLRenderer; scene: THREE.Scene; cam: THREE.PerspectiveCamera; car: ReturnType<typeof buildCar> | null; raf: number } | null>(null);
  useEffect(() => {
    const el = host.current!;
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    r.setPixelRatio(Math.min(2, devicePixelRatio));
    r.setSize(el.clientWidth, el.clientHeight);
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(r.domElement);
    const scene = new THREE.Scene();
    const pm = new THREE.PMREMGenerator(r);
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
    scene.add(new THREE.HemisphereLight('#ffffff', '#444', 0.8));
    const d = new THREE.DirectionalLight('#fff', 2);
    d.position.set(4, 6, 3);
    scene.add(d);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(4.2, 48), new THREE.MeshStandardMaterial({ color: '#1a1a1f', metalness: 0.6, roughness: 0.3 }));
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);
    const ring = new THREE.Mesh(new THREE.RingGeometry(4.1, 4.2, 64), new THREE.MeshBasicMaterial({ color: '#d4af6a' }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.01;
    scene.add(ring);
    const cam = new THREE.PerspectiveCamera(32, el.clientWidth / el.clientHeight, 0.1, 100);
    cam.position.set(7.5, 3.2, 7.5);
    cam.lookAt(0, 0.7, 0);
    const s = { r, scene, cam, car: null as ReturnType<typeof buildCar> | null, raf: 0 };
    st.current = s;
    const loop = () => {
      s.raf = requestAnimationFrame(loop);
      if (s.car) s.car.root.rotation.y += 0.008;
      r.render(scene, cam);
    };
    loop();
    return () => {
      cancelAnimationFrame(s.raf);
      s.car?.dispose();
      r.dispose();
      r.forceContextLoss();
      r.domElement.remove();
      st.current = null;
    };
  }, []);
  useEffect(() => {
    const s = st.current;
    if (!s) return;
    const prevRot = s.car?.root.rotation.y ?? 0.6;
    if (s.car) {
      s.scene.remove(s.car.root);
      s.car.dispose();
    }
    const def = VEHICLE_BY_ID[props.id];
    const car = buildCar(def.shape, def, props.mods, false, def.id === 'maybach');
    car.root.rotation.y = prevRot;
    for (const m of car.wheelMounts) m.position.y = car.wheelR;
    s.scene.add(car.root);
    s.car = car;
    const L = def.length;
    s.cam.position.set(L * 1.35, 2.6, L * 1.35);
    s.cam.lookAt(0, 0.6, 0);
  }, [props.id, JSON.stringify(props.mods)]); // eslint-disable-line react-hooks/exhaustive-deps
  return <div ref={host} style={{ width: '100%', height: props.height ?? 260, borderRadius: 14, overflow: 'hidden', background: 'radial-gradient(circle at 50% 40%, #23232b, #0b0b0e)' }} />;
}

// ------------------------------------------------------------------ dealership
export function DealerPanel() {
  const g = useGame((s) => s.game);
  const buy = useGame((s) => s.buyVehicle);
  const [sel, setSel] = useState(VEHICLES.find((v) => !g.vehicles.includes(v.id))?.id ?? 'maybach');
  const lvl = levelFor(g.clout);
  const v = VEHICLE_BY_ID[sel];
  const owned = g.vehicles.includes(sel);
  return (
    <Panel title="Brickell Prestige Motors" sub="“Financing available to approved buyers.” You are not an approved buyer." size="wide">
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr)', gap: 18 }}>
        <div className="col">
          <CarPreview id={sel} mods={g.mods[sel] ?? v.defaultMods} height={300} />
          <div className="row between">
            <div>
              <div className="muted small">{v.make} · {v.category}</div>
              <h3 style={{ margin: '2px 0', fontFamily: 'var(--serif)', fontSize: 26 }}>{v.name}</h3>
            </div>
            <div className="price" style={{ fontSize: 22 }}>{money(v.price)}</div>
          </div>
          <p className="muted small" style={{ margin: 0 }}>{v.blurb}</p>
          <div className="kv small">
            <span>Top speed</span><span>{Math.round(v.topSpeed * 3.6)} km/h</span>
            <span>Acceleration</span><span>{'▮'.repeat(Math.round(v.accel / 2.5))}</span>
            <span>Handling</span><span>{'▮'.repeat(Math.round(v.handling * 10))}</span>
            <span>Prestige (clout)</span><span>{'★'.repeat(Math.round(v.prestige / 2))} {v.prestige}/10</span>
            <span>Maintenance</span><span>{money(v.maintenance)}/month</span>
            <span>Requires</span><span>{CLOUT_LEVELS[v.minLevel].name}</span>
          </div>
          <div className="row">
            {owned ? <span className="tag green">In your garage</span> : <Btn kind="gold" disabled={lvl < v.minLevel || g.cash < v.price} onClick={() => buy(sel)}>{lvl < v.minLevel ? `Locked · ${CLOUT_LEVELS[v.minLevel].name}` : g.cash < v.price ? 'Not enough cash' : `Buy for ${money(v.price)}`}</Btn>}
          </div>
        </div>
        <div className="col" style={{ maxHeight: 560, overflow: 'auto' }}>
          {VEHICLES.map((x) => (
            <div key={x.id} className={`card ${g.vehicles.includes(x.id) ? 'owned' : ''} ${lvl < x.minLevel ? 'locked' : ''}`} style={{ cursor: 'pointer', borderColor: sel === x.id ? 'var(--gold)' : undefined }} onClick={() => setSel(x.id)}>
              <div className="row between"><h4>{x.make} {x.name}</h4><span className="price">{money(x.price, true)}</span></div>
              <div className="meta">{x.category} · Prestige {x.prestige} {g.vehicles.includes(x.id) ? '· Owned' : lvl < x.minLevel ? `· 🔒 ${CLOUT_LEVELS[x.minLevel].name}` : ''}</div>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

// ------------------------------------------------------------------ garage & customization
export function Customizer(props: { id: string }) {
  const g = useGame((s) => s.game);
  const buyMod = useGame((s) => s.buyMod);
  const def = VEHICLE_BY_ID[props.id];
  const m = g.mods[props.id] ?? def.defaultMods;
  const [preview, setPreview] = useState<VehicleMods>(m);
  useEffect(() => setPreview(m), [JSON.stringify(m)]); // eslint-disable-line react-hooks/exhaustive-deps
  const buy = (patch: Partial<VehicleMods>, cost: number, label: string) => buyMod(props.id, patch, cost, label);
  return (
    <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,1fr)', gap: 16 }}>
      <div className="col">
        <CarPreview id={props.id} mods={preview} height={280} />
        <p className="small muted" style={{ margin: 0 }}>Hover options to preview. Click to buy. Mods add a little clout and a little maintenance.</p>
      </div>
      <div className="col" style={{ gap: 10 }}>
        <div className="mb-label">Paint · {money(MOD_PRICES.paint)}</div>
        <div className="swatches">{PAINTS.map((p) => <div key={p.color} title={p.name} className={`swatch ${m.paint === p.color ? 'sel' : ''}`} style={{ background: p.color }} onMouseEnter={() => setPreview({ ...m, paint: p.color })} onMouseLeave={() => setPreview(m)} onClick={() => m.paint !== p.color && buy({ paint: p.color }, MOD_PRICES.paint, `${p.name} paint`)} />)}</div>
        <div className="mb-label">Two-tone accent · {money(MOD_PRICES.accent)}</div>
        <div className="swatches">{ACCENTS.map((p) => <div key={p.name} title={p.name} className={`swatch ${m.accent === p.color ? 'sel' : ''}`} style={{ background: p.color || 'repeating-linear-gradient(45deg,#333,#333 4px,#555 4px,#555 8px)' }} onMouseEnter={() => setPreview({ ...m, accent: p.color })} onMouseLeave={() => setPreview(m)} onClick={() => m.accent !== p.color && buy({ accent: p.color }, p.color ? MOD_PRICES.accent : 0, `${p.name} accent`)} />)}</div>
        <div className="mb-label">Wheels</div>
        <div className="row wrap">{WHEELS.map((w) => <Btn key={w.id} small active={m.wheels === w.id} onClick={() => m.wheels !== w.id && buy({ wheels: w.id }, w.price, w.name)}>{w.name}{w.price ? ` · ${money(w.price, true)}` : ''}</Btn>)}</div>
        <div className="mb-label">Window tint · {money(MOD_PRICES.tint)}</div>
        <div className="row wrap">{['Clear', 'Light', 'Dark', 'Limo'].map((t, i) => <Btn key={t} small active={m.tint === i} onClick={() => m.tint !== i && buy({ tint: i }, MOD_PRICES.tint, `${t} tint`)}>{t}</Btn>)}</div>
        <div className="mb-label">Interior · {money(MOD_PRICES.interior)}</div>
        <div className="swatches">{INTERIORS.map((p) => <div key={p.color} title={p.name} className={`swatch ${m.interior === p.color ? 'sel' : ''}`} style={{ background: p.color }} onClick={() => m.interior !== p.color && buy({ interior: p.color }, MOD_PRICES.interior, `${p.name} interior`)} />)}</div>
        <div className="mb-label">Underglow lighting · {money(MOD_PRICES.underglow)}</div>
        <div className="swatches">{UNDERGLOWS.map((p) => <div key={p.name} title={p.name} className={`swatch ${m.underglow === p.color ? 'sel' : ''}`} style={{ background: p.color || '#222' }} onClick={() => m.underglow !== p.color && buy({ underglow: p.color }, p.color ? MOD_PRICES.underglow : 0, `${p.name} underglow`)} />)}</div>
        <div className="mb-label">Performance</div>
        <div className="row wrap">
          {[1, 2, 3].map((lv) => <Btn key={`e${lv}`} small active={m.engine >= lv} disabled={m.engine >= lv || m.engine < lv - 1} onClick={() => buy({ engine: lv }, MOD_PRICES.engine[lv], `Engine stage ${lv}`)}>Engine {lv} · {money(MOD_PRICES.engine[lv], true)}</Btn>)}
        </div>
        <div className="row wrap">
          {[1, 2, 3].map((lv) => <Btn key={`h${lv}`} small active={m.handling >= lv} disabled={m.handling >= lv || m.handling < lv - 1} onClick={() => buy({ handling: lv }, MOD_PRICES.handling[lv], `Handling stage ${lv}`)}>Handling {lv} · {money(MOD_PRICES.handling[lv], true)}</Btn>)}
        </div>
        {props.id === 'maybach' && <Btn kind="gold" onClick={() => useUI.getState().open('maybach')}>Hydraulic suspension settings →</Btn>}
      </div>
    </div>
  );
}

export function GaragePanel() {
  const g = useGame((s) => s.game);
  const { setActiveVehicle, sellVehicle } = useGame();
  const rt = useUI((s) => s.rt);
  const [tab, setTab] = useState<'swap' | 'custom'>('swap');
  const [cust, setCust] = useState(g.activeVehicle);
  const [sell, setSell] = useState<string | null>(null);
  return (
    <Panel title="Garage" sub="Your collection, your rules." size="wide">
      <div className="tabs">
        <Btn small active={tab === 'swap'} onClick={() => setTab('swap')}>Vehicles</Btn>
        <Btn small active={tab === 'custom'} onClick={() => setTab('custom')}>Customize</Btn>
      </div>
      {tab === 'swap' && (
        <div className="grid c3">
          {g.vehicles.map((id) => {
            const v = VEHICLE_BY_ID[id];
            const active = g.activeVehicle === id;
            return (
              <div key={id} className={`card ${active ? 'owned' : ''}`}>
                <div className="row between"><h4>{v.make} {v.name}</h4>{active && <span className="tag green">Active</span>}</div>
                <div className="meta">{v.category} · {money(v.maintenance)}/mo upkeep</div>
                <div className="row wrap">
                  <Btn small kind={active ? undefined : 'gold'} disabled={active || rt.mode !== 'foot'} onClick={() => setActiveVehicle(id)}>{active ? 'Selected' : 'Drive this'}</Btn>
                  <Btn small onClick={() => { setCust(id); setTab('custom'); }}>Customize</Btn>
                  {id !== 'maybach' && <Btn small kind="danger" onClick={() => setSell(id)}>Sell {money(vehicleResale(id), true)}</Btn>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {tab === 'custom' && (
        <>
          <div className="row wrap" style={{ marginBottom: 12 }}>{g.vehicles.map((id) => <Btn key={id} small active={cust === id} onClick={() => setCust(id)}>{VEHICLE_BY_ID[id].name}</Btn>)}</div>
          <Customizer id={cust} />
        </>
      )}
      {sell && <Confirm text={`Sell the ${VEHICLE_BY_ID[sell].name} for ${money(vehicleResale(sell))}? (60% of the price, and people will talk.)`} yes="Sell" onNo={() => setSell(null)} onYes={() => { sellVehicle(sell); setSell(null); }} />}
    </Panel>
  );
}

// ------------------------------------------------------------------ watches
export function WatchFace({ w, size = 140 }: { w: WatchDef; size?: number }) {
  const [, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const d = new Date();
  const h = ((d.getHours() % 12) + d.getMinutes() / 60) * 30, m = d.getMinutes() * 6, s = d.getSeconds() * 6;
  return (
    <div className="watch-face" style={{ width: size, height: size, background: `radial-gradient(circle, ${w.dialColor} 58%, ${w.caseColor} 60%, ${w.caseColor} 70%, ${w.strapColor} 72%)`, boxShadow: w.diamonds ? `0 0 0 4px ${w.caseColor}, 0 0 24px rgba(200,230,255,.55)` : undefined }}>
      {w.diamonds && Array.from({ length: 12 }).map((_, i) => <div key={i} style={{ position: 'absolute', left: '50%', top: '50%', width: 6, height: 6, borderRadius: 3, background: '#fff', boxShadow: '0 0 6px #fff', transform: `rotate(${i * 30}deg) translateY(-${size * 0.33}px) translate(-3px,-3px)` }} />)}
      <div className="hand" style={{ width: 4, height: size * 0.22, transform: `translateX(-2px) rotate(${h}deg)`, background: w.caseColor === '#1a1a1a' ? '#d4af6a' : '#222' }} />
      <div className="hand" style={{ width: 3, height: size * 0.32, transform: `translateX(-1.5px) rotate(${m}deg)`, background: w.caseColor === '#1a1a1a' ? '#d4af6a' : '#222' }} />
      <div className="hand" style={{ width: 1.5, height: size * 0.34, transform: `translateX(-0.75px) rotate(${s}deg)`, background: '#c00' }} />
    </div>
  );
}

export function WatchPanel() {
  const g = useGame((s) => s.game);
  const { buyWatch, equipWatch, sellWatch } = useGame();
  const lvl = levelFor(g.clout);
  return (
    <Panel title="Tempo d'Oro" sub="Fine timepieces. Original designs. Prices that tell time for you." size="wide">
      <div className="grid c3">
        {WATCHES.map((w) => {
          const owned = g.watches.includes(w.id);
          const locked = lvl < w.minLevel;
          return (
            <div key={w.id} className={`card ${owned ? 'owned' : ''} ${locked ? 'locked' : ''}`}>
              <WatchFace w={w} size={110} />
              <div className="row between"><h4>{w.name}</h4>{w.diamonds && <span className="tag blue">Iced</span>}</div>
              <div className="meta">{w.brand} · {w.style}</div>
              <div className="small muted">{w.blurb}</div>
              <div className="row between"><span className="price">{money(w.price)}</span><span className="tag gold">+{w.clout} clout</span></div>
              {owned ? (
                <div className="row">
                  <Btn small kind={g.equippedWatch === w.id ? undefined : 'gold'} disabled={g.equippedWatch === w.id} onClick={() => equipWatch(w.id)}>{g.equippedWatch === w.id ? 'On your wrist' : 'Wear'}</Btn>
                  <Btn small kind="danger" onClick={() => sellWatch(w.id)}>Sell 70%</Btn>
                </div>
              ) : (
                <Btn small kind="gold" disabled={locked || g.cash < w.price} onClick={() => buyWatch(w.id)}>{locked ? `🔒 ${CLOUT_LEVELS[w.minLevel].name}` : 'Purchase'}</Btn>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

// ------------------------------------------------------------------ clothing
export function ClothesPanel() {
  const g = useGame((s) => s.game);
  const { buyOutfit, equipOutfit } = useGame();
  const lvl = levelFor(g.clout);
  return (
    <Panel title="Drip District" sub="Designer fits. Mandatory sunglasses included.">
      <div className="grid c3">
        {OUTFITS.map((o) => {
          const owned = g.outfits.includes(o.id);
          const locked = lvl < o.minLevel;
          return (
            <div key={o.id} className={`card ${owned ? 'owned' : ''} ${locked ? 'locked' : ''}`}>
              <div className="row" style={{ gap: 4 }}>{[o.top, o.bottom, o.shoes, o.accent].map((c, i) => <div key={i} className="swatch" style={{ background: c, cursor: 'default' }} />)}</div>
              <h4>{o.name}</h4>
              <div className="small muted">{o.blurb}</div>
              <div className="row between"><span className="price">{o.price ? money(o.price) : 'Owned'}</span>{o.clout > 0 && <span className="tag gold">+{o.clout} clout</span>}</div>
              {owned ? <Btn small disabled={g.equippedOutfit === o.id} onClick={() => equipOutfit(o.id)}>{g.equippedOutfit === o.id ? 'Wearing' : 'Wear'}</Btn>
                : <Btn small kind="gold" disabled={locked || g.cash < o.price} onClick={() => buyOutfit(o.id)}>{locked ? `🔒 ${CLOUT_LEVELS[o.minLevel].name}` : 'Buy & wear'}</Btn>}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

// ------------------------------------------------------------------ home & inspect
export function HomePanel() {
  const g = useGame((s) => s.game);
  const { sleep, save } = useGame();
  const ui = useUI();
  const canSleep = g.minute >= 18 * 60 || g.minute < 6 * 60;
  return (
    <Panel title={g.home === 'studio' ? 'Your Studio' : 'Home'} sub={g.home === 'studio' ? 'The bed folds into the wall. The dream does not.' : 'Upgraded living. The doorman nods.'} size="narrow">
      <div className="col">
        <div className="card">
          <h4>Sleep until 8:00 AM</h4>
          <div className="small muted">Commissions pay out at midnight. Bills arrive at the end of each month (every 7 days).</div>
          <Btn kind="gold" disabled={!canSleep} onClick={() => { if (sleep()) { save(); ui.close(); } }}>{canSleep ? 'Sleep & save' : 'Available after 6:00 PM'}</Btn>
        </div>
        <div className="card">
          <h4>Save game</h4>
          <Btn onClick={() => save()}>Save now</Btn>
        </div>
        <div className="card">
          <h4>Wardrobe & watch</h4>
          <Btn onClick={() => ui.open('inspect')}>Open wardrobe</Btn>
        </div>
        <div className="card">
          <h4>Garage</h4>
          <Btn onClick={() => ui.open('garage')}>Swap or customize vehicles</Btn>
        </div>
      </div>
    </Panel>
  );
}

export function InspectPanel() {
  const g = useGame((s) => s.game);
  const { equipWatch, equipOutfit } = useGame();
  const w = g.equippedWatch ? WATCH_BY_ID[g.equippedWatch] : null;
  const o = OUTFIT_BY_ID[g.equippedOutfit];
  useEffect(() => {
    // pose the figure to check the watch
    engine?.player.checkWatch();
  }, []);
  return (
    <Panel title={g.nickname} sub={`${CLOUT_LEVELS[levelFor(g.clout)].name} · Wardrobe & wrist`}>
      <div className="grid c2">
        <div className="card" style={{ alignItems: 'center', textAlign: 'center' }}>
          {w ? <WatchFace w={w} size={180} /> : <div className="muted" style={{ height: 180, display: 'flex', alignItems: 'center' }}>Bare wrist. Bold choice.</div>}
          <h4>{w ? `${w.brand} ${w.name}` : 'No watch equipped'}</h4>
          <div className="small muted">{w?.blurb}</div>
          <div className="small">Wearing: <b>{o.name}</b></div>
        </div>
        <div className="col">
          <h3 className="sec">Watches</h3>
          <div className="row wrap">
            <Btn small active={!g.equippedWatch} onClick={() => equipWatch(null)}>None</Btn>
            {g.watches.map((id) => <Btn key={id} small active={g.equippedWatch === id} onClick={() => equipWatch(id)}>{WATCH_BY_ID[id].name}</Btn>)}
          </div>
          {g.watches.length === 0 && <div className="small muted">Buy watches at Tempo d'Oro on Brickell Ave.</div>}
          <h3 className="sec">Outfits</h3>
          <div className="row wrap">{g.outfits.map((id) => <Btn key={id} small active={g.equippedOutfit === id} onClick={() => equipOutfit(id)}>{OUTFIT_BY_ID[id].name}</Btn>)}</div>
        </div>
      </div>
    </Panel>
  );
}
