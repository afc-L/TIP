// Procedurally generated canvas textures (no external assets needed).
import * as THREE from 'three';

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  return { c, ctx };
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function tex(c: HTMLCanvasElement, repeat = true, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

export type FacadeStyle = 'glass' | 'teal' | 'condo' | 'dark' | 'gold';

/** Facade map + emissive (lit windows) map. One texture tile = 32m x 32m (8 x 8 windows). */
export function facadeTextures(style: FacadeStyle, seed: number) {
  const W = 256, H = 256;
  const { c, ctx } = canvas(W, H);
  const { c: ec, ctx: ectx } = canvas(W, H);
  const r = rng(seed);
  const pal: Record<FacadeStyle, { frame: string; glassTop: string; glassBot: string; band?: string }> = {
    glass: { frame: '#9aa6b2', glassTop: '#9cc8e6', glassBot: '#2c5a7f' },
    teal: { frame: '#b8c6c4', glassTop: '#8fe0dc', glassBot: '#1f6b73' },
    condo: { frame: '#ecebe6', glassTop: '#a9c7d8', glassBot: '#3c5568', band: '#ffffff' },
    dark: { frame: '#2a2e35', glassTop: '#56677a', glassBot: '#141a22' },
    gold: { frame: '#c9a96a', glassTop: '#e8d5a0', glassBot: '#5a4520' },
  };
  const p = pal[style];
  ctx.fillStyle = p.frame;
  ctx.fillRect(0, 0, W, H);
  ectx.fillStyle = '#000';
  ectx.fillRect(0, 0, W, H);
  const cols = 8, rows = 8;
  const cw = W / cols, rh = H / rows;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x = i * cw + 2, y = j * rh + 3, w = cw - 4, h = rh - (style === 'condo' ? 9 : 5);
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, p.glassTop);
      g.addColorStop(1, p.glassBot);
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
      // sky reflection streak
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(x, y, w * 0.35, h);
      if (r() < 0.38) {
        const warm = r() < 0.7;
        const a = 0.55 + r() * 0.45;
        ectx.fillStyle = warm ? `rgba(255,${200 + Math.floor(r() * 40)},${120 + Math.floor(r() * 60)},${a})` : `rgba(170,210,255,${a})`;
        ectx.fillRect(x, y, w, h);
      }
    }
    if (p.band) {
      ctx.fillStyle = p.band;
      ctx.fillRect(0, (j + 1) * rh - 6, W, 4);
    }
  }
  return { map: tex(c), emissive: tex(ec) };
}

export function roadTexture() {
  const { c, ctx } = canvas(128, 256);
  ctx.fillStyle = '#2a2b2e';
  ctx.fillRect(0, 0, 128, 256);
  const r = rng(7);
  for (let i = 0; i < 900; i++) {
    const v = 30 + Math.floor(r() * 30);
    ctx.fillStyle = `rgb(${v},${v},${v + 2})`;
    ctx.fillRect(r() * 128, r() * 256, 1.5, 1.5);
  }
  // edge lines
  ctx.fillStyle = '#d8d8d0';
  ctx.fillRect(6, 0, 3, 256);
  ctx.fillRect(119, 0, 3, 256);
  // double yellow centre
  ctx.fillStyle = '#e6b422';
  ctx.fillRect(60, 0, 3, 256);
  ctx.fillRect(65, 0, 3, 256);
  // dashed lane lines
  ctx.fillStyle = '#d8d8d0';
  for (let y = 0; y < 256; y += 64) {
    ctx.fillRect(32, y, 2, 32);
    ctx.fillRect(94, y, 2, 32);
  }
  return tex(c);
}

export function intersectionTexture() {
  const { c, ctx } = canvas(128, 128);
  ctx.fillStyle = '#2a2b2e';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#e8e8e0';
  // crosswalk stripes on all four sides
  for (let i = 0; i < 8; i++) {
    const p = 10 + i * 14;
    ctx.fillRect(p, 2, 7, 12);
    ctx.fillRect(p, 114, 7, 12);
    ctx.fillRect(2, p, 12, 7);
    ctx.fillRect(114, p, 12, 7);
  }
  return tex(c, false);
}

export function concreteTexture(tint = '#bdb8ae') {
  const { c, ctx } = canvas(128, 128);
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 128; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 128);
    ctx.moveTo(0, i);
    ctx.lineTo(128, i);
    ctx.stroke();
  }
  const r = rng(3);
  for (let i = 0; i < 500; i++) {
    ctx.fillStyle = `rgba(0,0,0,${r() * 0.06})`;
    ctx.fillRect(r() * 128, r() * 128, 2, 2);
  }
  return tex(c);
}

export function grassTexture() {
  const { c, ctx } = canvas(128, 128);
  ctx.fillStyle = '#4f7d3a';
  ctx.fillRect(0, 0, 128, 128);
  const r = rng(11);
  for (let i = 0; i < 1500; i++) {
    const g = 90 + Math.floor(r() * 60);
    ctx.fillStyle = `rgba(${40 + r() * 30},${g},${30 + r() * 20},0.7)`;
    ctx.fillRect(r() * 128, r() * 128, 1.5, 3);
  }
  return tex(c);
}

export function woodTexture() {
  const { c, ctx } = canvas(128, 128);
  ctx.fillStyle = '#a0703f';
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 128; i += 16) {
    ctx.fillStyle = i % 32 ? '#94653a' : '#a77545';
    ctx.fillRect(0, i, 128, 15);
    ctx.fillStyle = 'rgba(40,20,5,0.6)';
    ctx.fillRect(0, i + 15, 128, 1);
  }
  return tex(c);
}

/** A sign texture with text. Returns texture and aspect ratio. */
export function signTexture(text: string, opts: { color?: string; bg?: string; font?: string; glow?: boolean; sub?: string } = {}) {
  const font = opts.font ?? '700 64px "Inter", "Helvetica Neue", Arial, sans-serif';
  const mctx = canvas(8, 8).ctx;
  mctx.font = font;
  const w = Math.ceil(mctx.measureText(text).width) + 60;
  const h = opts.sub ? 130 : 96;
  const { c, ctx } = canvas(Math.max(64, w), h);
  if (opts.bg) {
    ctx.fillStyle = opts.bg;
    ctx.fillRect(0, 0, c.width, h);
  }
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (opts.glow) {
    ctx.shadowColor = opts.color ?? '#fff';
    ctx.shadowBlur = 18;
  }
  ctx.fillStyle = opts.color ?? '#fff';
  ctx.fillText(text, c.width / 2, opts.sub ? 52 : h / 2 + 2);
  if (opts.sub) {
    ctx.shadowBlur = 0;
    ctx.font = '500 28px "Inter", Arial, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(opts.sub, c.width / 2, 104);
  }
  const t = tex(c, false);
  return { tex: t, aspect: c.width / h };
}

/** Street name sign (green, US style) */
export function streetSignTexture(text: string) {
  const { c, ctx } = canvas(256, 48);
  ctx.fillStyle = '#0d5c32';
  ctx.fillRect(0, 0, 256, 48);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 3;
  ctx.strokeRect(3, 3, 250, 42);
  ctx.fillStyle = '#fff';
  ctx.font = '700 26px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 26);
  return tex(c, false);
}

export function grilleTexture() {
  const { c, ctx } = canvas(128, 128);
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, 128, 128);
  for (let x = 4; x < 128; x += 8) {
    const g = ctx.createLinearGradient(x, 0, x + 5, 0);
    g.addColorStop(0, '#666');
    g.addColorStop(0.5, '#fff');
    g.addColorStop(1, '#777');
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, 4, 128);
  }
  return tex(c, false);
}

export function skyGradientTexture() {
  const { c, ctx } = canvas(4, 256);
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#fff');
  g.addColorStop(1, '#fff');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  return tex(c, false);
}

export function danceFloorTexture() {
  const { c, ctx } = canvas(256, 256);
  const cols = ['#ff00aa', '#00e5ff', '#7a00ff', '#ffcc00', '#00ff88', '#ff3355'];
  const r = rng(5);
  for (let i = 0; i < 8; i++)
    for (let j = 0; j < 8; j++) {
      ctx.fillStyle = cols[Math.floor(r() * cols.length)];
      ctx.fillRect(i * 32 + 1, j * 32 + 1, 30, 30);
    }
  return tex(c);
}

export class ScreenTexture {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  constructor(w = 512, h = 192) {
    const { c, ctx } = canvas(w, h);
    this.canvas = c;
    this.ctx = ctx;
    this.texture = tex(c, false);
  }
  update() {
    this.texture.needsUpdate = true;
  }
}
