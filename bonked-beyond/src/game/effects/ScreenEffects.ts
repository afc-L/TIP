// Camera shake, hit-stop and full-screen flashes. All respect accessibility settings.
import { getSettings } from '../../store/settingsStore';

export class ScreenEffects {
  shakeAmount = 0;
  hitStop = 0;
  private flashEl: HTMLDivElement;
  private flashT = 0;

  constructor(host: HTMLElement) {
    this.flashEl = document.createElement('div');
    this.flashEl.className = 'screen-flash';
    host.appendChild(this.flashEl);
  }

  shake(amount: number) {
    const s = getSettings();
    if (!s.screenShake) return;
    const scale = (s.reducedEffects ? 0.4 : 1) * s.shakeIntensity;
    this.shakeAmount = Math.min(1.2, Math.max(this.shakeAmount, amount * scale));
  }

  stop(seconds: number) {
    const s = getSettings();
    if (!s.screenShake || s.reducedEffects) return;
    this.hitStop = Math.max(this.hitStop, Math.min(0.12, seconds));
  }

  flash(color: string, strength = 0.35) {
    if (getSettings().reducedEffects) strength *= 0.4;
    this.flashEl.style.background = `radial-gradient(ellipse at center, transparent 35%, ${color} 130%)`;
    this.flashEl.style.opacity = String(strength);
    this.flashT = 0.35;
  }

  /** Returns time scale for the simulation this frame. */
  update(dt: number): number {
    this.shakeAmount = Math.max(0, this.shakeAmount - dt * 2.8);
    if (this.flashT > 0) {
      this.flashT -= dt;
      if (this.flashT <= 0) this.flashEl.style.opacity = '0';
    }
    if (this.hitStop > 0) {
      this.hitStop -= dt;
      return 0.08;
    }
    return 1;
  }

  reset() {
    this.shakeAmount = 0;
    this.hitStop = 0;
    this.flashT = 0;
    this.flashEl.style.opacity = '0';
  }
}
