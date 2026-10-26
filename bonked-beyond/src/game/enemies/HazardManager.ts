// Telegraphed ground hazards used by bosses: a visible warning, then damage, optionally lingering.
import type { Telegraph } from '../effects/Vfx';
import type { Run } from '../Run';

export interface HazardSpec {
  shape: 'circle' | 'rect';
  x: number; z: number;
  r?: number;
  angle?: number; length?: number; width?: number;
  warn: number;
  damage: number;
  major?: boolean;
  linger?: number;       // seconds of damaging zone after triggering
  lingerDamage?: number; // per 0.5s tick
  color?: string;
  lingerColor?: string;
  label: string;
  onTrigger?: (run: Run) => void;
}

interface Hazard extends HazardSpec { t: number; tg: Telegraph; triggered: boolean; lingerT: number; tick: number }

export class HazardManager {
  private list: Hazard[] = [];

  add(spec: HazardSpec, run: Run) {
    const tg = run.vfx.telegraph(spec.shape, spec.color ?? '#ff2e2e');
    this.list.push({ ...spec, t: 0, tg, triggered: false, lingerT: 0, tick: 0 });
  }

  private inside(h: Hazard, x: number, z: number, pad: number) {
    if (h.shape === 'circle') return (x - h.x) ** 2 + (z - h.z) ** 2 < ((h.r ?? 1) + pad) ** 2;
    const a = h.angle ?? 0;
    const dx = x - h.x, dz = z - h.z;
    const along = dx * Math.cos(a) + dz * Math.sin(a);
    const side = -dx * Math.sin(a) + dz * Math.cos(a);
    return along > -pad && along < (h.length ?? 1) + pad && Math.abs(side) < (h.width ?? 1) / 2 + pad;
  }

  update(dt: number, run: Run) {
    const p = run.player;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const h = this.list[i];
      h.t += dt;
      if (!h.triggered) {
        const prog = Math.min(1, h.t / h.warn);
        if (h.shape === 'circle') run.vfx.setCircle(h.tg, h.x, h.z, h.r ?? 1, prog);
        else run.vfx.setRect(h.tg, h.x, h.z, h.angle ?? 0, h.length ?? 1, h.width ?? 1, prog);
        if (h.t >= h.warn) {
          h.triggered = true;
          if (this.inside(h, p.x, p.z, p.radius * 0.6)) run.damagePlayer(h.damage, { x: h.x, z: h.z, label: h.label, major: h.major });
          h.onTrigger?.(run);
          if (h.linger) {
            h.lingerT = h.linger;
            h.tg.fillMat.color.set(h.lingerColor ?? '#ff7b00');
            h.tg.outlineMat.color.set(h.lingerColor ?? '#ff7b00');
          } else {
            run.vfx.release(h.tg);
            this.list.splice(i, 1);
          }
        }
      } else {
        h.lingerT -= dt;
        h.tick -= dt;
        if (h.shape === 'circle') run.vfx.setCircle(h.tg, h.x, h.z, h.r ?? 1, 1);
        h.tg.fillMat.opacity = 0.35 + Math.sin(run.time * 12 + i) * 0.1;
        if (Math.random() < 0.4) {
          const a = Math.random() * Math.PI * 2, d = Math.random() * (h.r ?? 1);
          run.particles.emit(h.x + Math.cos(a) * d, 0.2, h.z + Math.sin(a) * d, 0, 2.5, 0, 0.5, 0.2, Math.random() < 0.5 ? '#ff7b00' : '#ffd60a', -2);
        }
        if (h.tick <= 0 && this.inside(h, p.x, p.z, 0)) {
          h.tick = 0.5;
          run.damagePlayer(h.lingerDamage ?? 5, { x: h.x, z: h.z, label: h.label, major: h.major, ignoreIframes: false });
        }
        if (h.lingerT <= 0) {
          h.tg.fillMat.opacity = 0.35;
          run.vfx.release(h.tg);
          this.list.splice(i, 1);
        }
      }
    }
  }

  clear(run: Run) {
    for (const h of this.list) { h.tg.fillMat.opacity = 0.35; run.vfx.release(h.tg); }
    this.list.length = 0;
  }
}
