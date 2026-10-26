import { Logo } from './MainMenu';
import { PageHeader } from './ui';

export function Credits({ onBack }: { onBack: () => void }) {
  return (
    <div className="screen menu-page">
      <PageHeader title="CREDITS" onBack={onBack} />
      <div className="panel credits">
        <Logo small />
        <p>An original horde-survival roguelike built for the browser.</p>
        <p><b>Engine:</b> Three.js · React · Zustand · Vite · TypeScript</p>
        <p><b>Art:</b> 100% procedural low-poly geometry, generated in code.</p>
        <p><b>Audio:</b> Procedurally synthesized with the Web Audio API.</p>
        <p><b>Fonts:</b> Lilita One &amp; Nunito (SIL Open Font License).</p>
        <p className="dim">Inspired by the horde-survival genre. All characters, enemies, maps and names are original.</p>
      </div>
    </div>
  );
}
