import { useSettings } from '../../game/settings';
import { Btn, Controls, Panel, Slider, Toggle } from '../common';
import { engine } from '../../game/engine/Engine';

export function SettingsPanel(props: { onClose: () => void }) {
  const { s, set, reset } = useSettings();
  const apply = (patch: Parameters<typeof set>[0]) => {
    set(patch);
    engine?.applySettings();
  };
  const pctf = (v: number) => `${Math.round(v * 100)}%`;
  const fs = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };
  return (
    <Panel title="Settings" onClose={props.onClose} foot={<><Btn kind="ghost" onClick={() => { reset(); engine?.applySettings(); }}>Reset to defaults</Btn><Btn kind="gold" onClick={props.onClose}>Done</Btn></>}>
      <h3 className="sec">Graphics</h3>
      <div className="col">
        <div className="row between"><span className="muted small">Quality</span>
          <div className="row">{(['low', 'medium', 'high'] as const).map((q) => <Btn key={q} small active={s.quality === q} onClick={() => apply({ quality: q, shadows: q !== 'low' })}>{q[0].toUpperCase() + q.slice(1)}</Btn>)}</div>
        </div>
        <div className="row between"><span className="muted small">Shadows</span><Toggle on={s.shadows} onChange={(v) => apply({ shadows: v })} /></div>
        <Slider label="Render scale" value={s.renderScale} min={0.5} max={1} step={0.05} onChange={(v) => apply({ renderScale: v })} fmt={pctf} />
        <Slider label="Field of view" value={s.fov} min={50} max={90} step={1} onChange={(v) => apply({ fov: v })} fmt={(v) => `${v}°`} />
        <div className="row between"><span className="muted small">Fullscreen</span><Btn small onClick={fs}>Toggle fullscreen</Btn></div>
        <div className="row between"><span className="muted small">Show FPS</span><Toggle on={s.showFps} onChange={(v) => set({ showFps: v })} /></div>
        <p className="small muted">Antialiasing and traffic density changes apply the next time the world loads.</p>
      </div>
      <h3 className="sec">Audio</h3>
      <div className="col">
        <Slider label="Master" value={s.masterVolume} min={0} max={1} onChange={(v) => apply({ masterVolume: v })} fmt={pctf} />
        <Slider label="Music" value={s.musicVolume} min={0} max={1} onChange={(v) => apply({ musicVolume: v })} fmt={pctf} />
        <Slider label="Sound effects" value={s.sfxVolume} min={0} max={1} onChange={(v) => apply({ sfxVolume: v })} fmt={pctf} />
        <Slider label="Vehicle FX (hydraulics)" value={s.vehicleFxVolume} min={0} max={1} onChange={(v) => apply({ vehicleFxVolume: v })} fmt={pctf} />
      </div>
      <h3 className="sec">Controls</h3>
      <div className="col">
        <Slider label="Mouse sensitivity" value={s.mouseSensitivity} min={0.2} max={3} onChange={(v) => set({ mouseSensitivity: v })} fmt={(v) => v.toFixed(2)} />
        <div className="row between"><span className="muted small">Invert Y</span><Toggle on={s.invertY} onChange={(v) => set({ invertY: v })} /></div>
      </div>
      <h3 className="sec">Gameplay</h3>
      <div className="col">
        <Slider label="Day length" value={s.dayLengthMinutes} min={4} max={30} step={1} onChange={(v) => set({ dayLengthMinutes: v })} fmt={(v) => `${v} min`} />
        <Slider label="Traffic density" value={s.trafficDensity} min={0.3} max={1.5} step={0.1} onChange={(v) => set({ trafficDensity: v })} fmt={pctf} />
        <div className="row between"><span className="muted small">Show minimap</span><Toggle on={s.showMinimap} onChange={(v) => set({ showMinimap: v })} /></div>
        <div className="row between"><span className="muted small">Rotate minimap with heading</span><Toggle on={s.rotateMinimap} onChange={(v) => set({ rotateMinimap: v })} /></div>
      </div>
      <h3 className="sec">Control guide</h3>
      <Controls />
    </Panel>
  );
}
