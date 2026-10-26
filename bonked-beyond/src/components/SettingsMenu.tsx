import { useEffect, useState } from 'react';
import { DIFFICULTY } from '../game/GameConfig';
import { audio } from '../game/effects/AudioManager';
import { useSettings, type Quality, type Settings } from '../store/settingsStore';
import { ControlsGuide } from './ControlsGuide';
import { Btn, PageHeader } from './ui';

function Slider({ k, label }: { k: keyof Settings; label: string }) {
  const v = useSettings((s) => s[k]) as number;
  const set = useSettings((s) => s.set);
  return (
    <label className="set-row">
      <span>{label}</span>
      <input type="range" min={0} max={1} step={0.05} value={v} onChange={(e) => set(k, Number(e.target.value) as never)} onMouseUp={() => audio.play('click')} />
      <b>{Math.round(v * 100)}%</b>
    </label>
  );
}

function Toggle({ k, label }: { k: keyof Settings; label: string }) {
  const v = useSettings((s) => s[k]) as boolean;
  const set = useSettings((s) => s.set);
  return (
    <label className="set-row toggle" onClick={() => { set(k, !v as never); audio.play('click'); }}>
      <span>{label}</span>
      <span className={`switch ${v ? 'on' : ''}`}><i /></span>
    </label>
  );
}

function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { v: T; l: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="set-row">
      <span>{label}</span>
      <div className="seg">{options.map((o) => <button key={o.v} className={value === o.v ? 'on' : ''} onClick={() => { onChange(o.v); audio.play('click'); }}>{o.l}</button>)}</div>
    </div>
  );
}

export function SettingsMenu({ onBack, embedded }: { onBack?: () => void; embedded?: boolean }) {
  const s = useSettings();
  const [fs, setFs] = useState(!!document.fullscreenElement);
  const [showControls, setShowControls] = useState(false);
  useEffect(() => {
    const on = () => setFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);
  const toggleFs = () => {
    try {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      else document.documentElement.requestFullscreen?.()?.catch(() => {});
    } catch { /* unsupported */ }
  };
  return (
    <div className={`settings ${embedded ? 'embedded' : 'panel'}`}>
      {!embedded && onBack && <PageHeader title="SETTINGS" onBack={onBack} />}
      <div className="settings-cols">
        <div>
          <h4>Audio</h4>
          <Slider k="masterVolume" label="Master volume" />
          <Slider k="musicVolume" label="Music volume" />
          <Slider k="sfxVolume" label="Sound effects" />
          <Toggle k="muted" label="Mute all" />
          <h4>Gameplay</h4>
          <Choice label="Difficulty" value={s.difficulty} options={(Object.keys(DIFFICULTY) as (keyof typeof DIFFICULTY)[]).map((d) => ({ v: d, l: DIFFICULTY[d].label }))} onChange={(v) => s.set('difficulty', v)} />
          <Toggle k="mouseAim" label="Mouse aiming" />
          <Slider k="cameraDistance" label="Camera distance" />
          <Slider k="cameraSmoothing" label="Camera smoothing" />
        </div>
        <div>
          <h4>Graphics</h4>
          <Choice<Quality> label="Quality" value={s.quality} options={[{ v: 'low', l: 'Low' }, { v: 'medium', l: 'Medium' }, { v: 'high', l: 'High' }]} onChange={(v) => s.set('quality', v)} />
          <p className="hint">Quality changes resolution and shadows immediately; foliage density and enemy cap apply on the next run.</p>
          <Toggle k="screenShake" label="Screen shake & hit-stop" />
          <Toggle k="damageNumbers" label="Damage numbers" />
          <Toggle k="reducedEffects" label="Reduced visual effects" />
          <Toggle k="showFps" label="Show FPS" />
          <div className="set-row"><span>Fullscreen</span><Btn onClick={toggleFs}>{fs ? 'Exit fullscreen' : 'Go fullscreen'}</Btn></div>
          <div className="set-row"><span>Controls</span><Btn onClick={() => setShowControls(!showControls)}>{showControls ? 'Hide guide' : 'Show guide'}</Btn></div>
          <div className="set-row"><span>Defaults</span><Btn variant="danger" onClick={() => s.reset()}>Reset settings</Btn></div>
        </div>
      </div>
      {showControls && <ControlsGuide />}
    </div>
  );
}
