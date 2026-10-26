// Pooled DOM floating text (damage numbers and pickup labels) projected from world space.
import * as THREE from 'three';

interface FloatText { el: HTMLDivElement; x: number; y: number; z: number; life: number; max: number; active: boolean; drift: number; big: boolean }

const _v = new THREE.Vector3();

export class DamageNumbers {
  private root: HTMLDivElement;
  private pool: FloatText[] = [];
  private cursor = 0;
  enabled = true;

  constructor(host: HTMLElement, size = 90) {
    this.root = document.createElement('div');
    this.root.className = 'float-layer';
    host.appendChild(this.root);
    for (let i = 0; i < size; i++) {
      const el = document.createElement('div');
      el.className = 'float-text';
      el.style.display = 'none';
      this.root.appendChild(el);
      this.pool.push({ el, x: 0, y: 0, z: 0, life: 0, max: 1, active: false, drift: 0, big: false });
    }
  }

  private take(): FloatText {
    for (let k = 0; k < this.pool.length; k++) {
      const f = this.pool[(this.cursor + k) % this.pool.length];
      if (!f.active) { this.cursor = (this.cursor + k + 1) % this.pool.length; return f; }
    }
    // all busy: recycle the oldest-ish slot
    const f = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % this.pool.length;
    return f;
  }

  damage(x: number, y: number, z: number, amount: number, crit: boolean, player = false) {
    if (!this.enabled && !player) return;
    const f = this.take();
    f.el.textContent = player ? `-${Math.round(amount)}` : crit ? `${Math.round(amount)}!` : `${Math.round(amount)}`;
    f.el.className = 'float-text ' + (player ? 'ft-player' : crit ? 'ft-crit' : amount >= 100 ? 'ft-big' : 'ft-dmg');
    this.spawn(f, x, y, z, crit ? 0.9 : 0.65, crit);
  }

  label(x: number, y: number, z: number, text: string, cls = 'ft-label') {
    const f = this.take();
    f.el.textContent = text;
    f.el.className = 'float-text ' + cls;
    this.spawn(f, x, y, z, 1.2, true);
  }

  private spawn(f: FloatText, x: number, y: number, z: number, life: number, big: boolean) {
    f.x = x + (Math.random() - 0.5) * 0.6; f.y = y; f.z = z + (Math.random() - 0.5) * 0.3;
    f.life = life; f.max = life; f.active = true; f.drift = (Math.random() - 0.5) * 30; f.big = big;
    f.el.style.display = 'block';
  }

  clear() {
    for (const f of this.pool) { f.active = false; f.el.style.display = 'none'; }
  }

  update(dt: number, camera: THREE.Camera) {
    const w = window.innerWidth, h = window.innerHeight;
    for (const f of this.pool) {
      if (!f.active) continue;
      f.life -= dt;
      if (f.life <= 0) { f.active = false; f.el.style.display = 'none'; continue; }
      const t = 1 - f.life / f.max;
      _v.set(f.x, f.y + t * 1.2, f.z).project(camera);
      if (_v.z > 1) { f.el.style.display = 'none'; continue; }
      const sx = (_v.x * 0.5 + 0.5) * w + f.drift * t;
      const sy = (-_v.y * 0.5 + 0.5) * h;
      const pop = t < 0.15 ? 1 + (0.15 - t) * (f.big ? 5 : 3) : 1;
      f.el.style.display = 'block';
      f.el.style.transform = `translate(-50%, -50%) translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) scale(${pop.toFixed(2)})`;
      f.el.style.opacity = t > 0.7 ? ((1 - t) / 0.3).toFixed(2) : '1';
    }
  }
}
