import { useEffect, useRef, useState } from 'react';
import { useUI } from '../../game/uiStore';
import { useGame, currentMission } from '../../game/store';
import { POIS, POI_BY_ID } from '../../game/data/world';
import { CREATORS } from '../../game/data/creators';
import { EVENTS } from '../../game/data/events';
import { levelFor } from '../../game/data/catalog';
import { engine } from '../../game/engine/Engine';
import { BASE_SCALE, MAP_BOUNDS, baseMap, drawLabels, drawPlayer, drawPois } from '../mapdraw';
import { Btn } from '../common';

export function MapScreen() {
  const ref = useRef<HTMLCanvasElement>(null);
  const close = useUI((s) => s.close);
  const setWaypoint = useUI((s) => s.setWaypoint);
  const waypoint = useUI((s) => s.waypoint);
  const g = useGame((s) => s.game);
  const [hover, setHover] = useState<string | null>(null);
  const mission = currentMission(g);
  const lvl = levelFor(g.clout);
  const recruitPois = new Set(CREATORS.filter((c) => !g.creators[c.id] && c.minLevel <= lvl && !((g.lostToRival[c.id] ?? 0) > g.day)).map((c) => c.venue));
  const eventPois = new Set(EVENTS.filter((e) => e.minLevel <= lvl && g.eventsDone[e.id] !== g.day).map((e) => e.poi));

  const view = useRef({ scale: 1, ox: 0, oz: 0 });
  useEffect(() => {
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const c = ref.current;
      if (!c) return;
      const W = c.clientWidth * devicePixelRatio, H = c.clientHeight * devicePixelRatio;
      if (c.width !== W || c.height !== H) {
        c.width = W;
        c.height = H;
      }
      const ctx = c.getContext('2d')!;
      const mw = MAP_BOUNDS.maxX - MAP_BOUNDS.minX, mh = MAP_BOUNDS.maxZ - MAP_BOUNDS.minZ;
      const scale = Math.min(W / mw, H / mh) * 0.96;
      const ox = (W - mw * scale) / 2, oz = (H - mh * scale) / 2;
      view.current = { scale, ox, oz };
      const tx = (x: number) => ox + (x - MAP_BOUNDS.minX) * scale;
      const tz = (z: number) => oz + (z - MAP_BOUNDS.minZ) * scale;
      ctx.fillStyle = '#07090d';
      ctx.fillRect(0, 0, W, H);
      const bm = baseMap(engine?.world ?? null);
      ctx.drawImage(bm, ox, oz, (bm.width / BASE_SCALE) * scale, (bm.height / BASE_SCALE) * scale);
      drawLabels(ctx, tx, tz, scale);
      drawPois(ctx, tx, tz, 11 * devicePixelRatio, true, hover);
      // recruitment & event markers
      ctx.font = `${12 * devicePixelRatio}px Inter`;
      for (const p of POIS) {
        let k = 0;
        if (recruitPois.has(p.id)) {
          ctx.fillStyle = '#ffd36a';
          ctx.beginPath();
          ctx.arc(tx(p.x) + 13 * devicePixelRatio, tz(p.z) - 11 * devicePixelRatio, 5 * devicePixelRatio, 0, Math.PI * 2);
          ctx.fill();
          k++;
        }
        if (eventPois.has(p.id)) {
          ctx.fillStyle = '#ff4fd8';
          ctx.beginPath();
          ctx.arc(tx(p.x) + (13 + k * 11) * devicePixelRatio, tz(p.z) - 11 * devicePixelRatio, 5 * devicePixelRatio, 0, Math.PI * 2);
          ctx.fill();
        }
        if (mission?.target === p.id) {
          ctx.strokeStyle = '#3dffb0';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(tx(p.x), tz(p.z), 18 * devicePixelRatio + Math.sin(performance.now() / 200) * 3, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      const wp = useUI.getState().waypoint;
      if (wp) {
        ctx.fillStyle = '#ffd36a';
        ctx.beginPath();
        ctx.moveTo(tx(wp.x), tz(wp.z));
        ctx.arc(tx(wp.x), tz(wp.z) - 16, 8 * devicePixelRatio, Math.PI * 0.8, Math.PI * 2.2);
        ctx.closePath();
        ctx.fill();
      }
      if (engine?.car) {
        ctx.fillStyle = '#3dffb0';
        ctx.beginPath();
        ctx.arc(tx(engine.car.x), tz(engine.car.z), 4 * devicePixelRatio, 0, Math.PI * 2);
        ctx.fill();
      }
      const rt = useUI.getState().rt;
      drawPlayer(ctx, tx(rt.x), tz(rt.z), rt.heading, 12 * devicePixelRatio);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [hover, mission?.target]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (e: React.MouseEvent) => {
    const c = ref.current!;
    const r = c.getBoundingClientRect();
    const { scale, ox, oz } = view.current;
    const x = ((e.clientX - r.left) * devicePixelRatio - ox) / scale + MAP_BOUNDS.minX;
    const z = ((e.clientY - r.top) * devicePixelRatio - oz) / scale + MAP_BOUNDS.minZ;
    let best: string | null = null;
    let bd = 25 / (scale / devicePixelRatio);
    for (const p of POIS) {
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < bd) {
        bd = d;
        best = p.id;
      }
    }
    return { x, z, best };
  };

  return (
    <div className="mapscreen">
      <div className="map-head">
        <div>
          <div className="panel-title">Brickell · Miami</div>
          <div className="map-legend">
            <span>▲ You</span><span style={{ color: '#3dffb0' }}>● Your vehicle</span><span style={{ color: '#ffd36a' }}>● Recruit available</span><span style={{ color: '#ff4fd8' }}>● Event available</span><span style={{ color: '#3dffb0' }}>◯ Mission target</span><span>Click a location to set a waypoint</span>
          </div>
        </div>
        <div className="row wrap">
          {mission?.target && <Btn small kind="gold" onClick={() => { const p = POI_BY_ID[mission.target!]; setWaypoint({ x: p.x, z: p.z, label: p.name }); }}>Waypoint: objective</Btn>}
          {waypoint && <Btn small onClick={() => setWaypoint(null)}>Clear waypoint</Btn>}
          <Btn small onClick={close}>Close (M)</Btn>
        </div>
      </div>
      <canvas
        ref={ref}
        onMouseMove={(e) => setHover(pick(e).best)}
        onClick={(e) => {
          const { x, z, best } = pick(e);
          if (best) setWaypoint({ x: POI_BY_ID[best].x, z: POI_BY_ID[best].z, label: POI_BY_ID[best].name });
          else setWaypoint({ x, z, label: 'Custom waypoint' });
        }}
      />
      {hover && (
        <div className="glass" style={{ position: 'absolute', left: 20, bottom: 20, padding: 14, maxWidth: 360 }}>
          <b>{POI_BY_ID[hover].name}</b>
          <div className="small muted">{POI_BY_ID[hover].desc}</div>
        </div>
      )}
    </div>
  );
}
