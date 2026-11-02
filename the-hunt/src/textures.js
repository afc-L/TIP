import * as THREE from 'three';
import { makeRng } from './util.js';

// Every texture is drawn into a canvas at startup: no image files to download.

function canvasTex(w, h, draw, { repeat = [1, 1], srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Forest-floor detail: needles, leaf litter, grass speckle. Tinted by terrain vertex colours. */
export function groundTexture() {
  const r = makeRng(11);
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#d2d2d2';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) {
      const v = 150 + r() * 105;
      g.fillStyle = `rgba(${v},${v},${v},${0.25 + r() * 0.4})`;
      g.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 3);
    }
    // pine needles
    g.lineWidth = 1;
    for (let i = 0; i < 2600; i++) {
      const x = r() * w, y = r() * h, a = r() * Math.PI, l = 3 + r() * 9;
      const v = 110 + r() * 140;
      g.strokeStyle = `rgba(${v},${v * 0.95},${v * 0.85},0.55)`;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      g.stroke();
    }
    // larger dark patches (moss / damp)
    for (let i = 0; i < 60; i++) {
      const x = r() * w, y = r() * h, rad = 8 + r() * 30;
      const grd = g.createRadialGradient(x, y, 0, x, y, rad);
      grd.addColorStop(0, 'rgba(40,40,40,0.25)');
      grd.addColorStop(1, 'rgba(40,40,40,0)');
      g.fillStyle = grd;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
  });
}

export function woodTexture(base = [92, 72, 52], { weathered = 0.5 } = {}) {
  const r = makeRng(23 + base[0]);
  return canvasTex(256, 256, (g, w, h) => {
    const plank = 32;
    for (let y = 0; y < h; y += plank) {
      const k = 0.75 + r() * 0.35;
      g.fillStyle = `rgb(${base[0] * k | 0},${base[1] * k | 0},${base[2] * k | 0})`;
      g.fillRect(0, y, w, plank);
      for (let i = 0; i < 40; i++) {
        const v = r() * 0.4;
        g.strokeStyle = `rgba(20,14,8,${v * 0.5})`;
        g.beginPath();
        const yy = y + r() * plank;
        g.moveTo(0, yy);
        g.bezierCurveTo(w * 0.3, yy + r() * 3 - 1.5, w * 0.7, yy + r() * 3 - 1.5, w, yy + r() * 2 - 1);
        g.stroke();
      }
      g.fillStyle = 'rgba(10,6,3,0.8)';
      g.fillRect(0, y, w, 2);
      // weathering / grey streaks
      for (let i = 0; i < 30 * weathered; i++) {
        g.fillStyle = `rgba(150,150,140,${r() * 0.12})`;
        g.fillRect(r() * w, y + r() * plank, 10 + r() * 60, 1 + r() * 3);
      }
      // nail heads
      g.fillStyle = 'rgba(20,20,20,0.9)';
      g.fillRect(6, y + plank / 2, 2, 2);
      g.fillRect(w - 8, y + plank / 2, 2, 2);
    }
  });
}

export function barkTexture() {
  const r = makeRng(5);
  return canvasTex(64, 256, (g, w, h) => {
    g.fillStyle = '#5a4a3c';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 220; i++) {
      const v = 30 + r() * 70;
      g.fillStyle = `rgba(${v},${v * 0.85},${v * 0.7},0.7)`;
      g.fillRect(r() * w, r() * h, 1 + r() * 4, 6 + r() * 30);
    }
  });
}

export function metalTexture() {
  const r = makeRng(7);
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#6d6f6e';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 400; i++) {
      g.fillStyle = `rgba(${90 + r() * 60 | 0},${50 + r() * 30 | 0},${20},${r() * 0.25})`;
      const s = 2 + r() * 10;
      g.fillRect(r() * w, r() * h, s, s);
    }
  });
}

export function signTexture(lines, { bg = '#3b2a1a', fg = '#e9dcc0', w = 512, h = 256, font = 'bold 44px Georgia, serif' } = {}) {
  return canvasTex(w, h, (g) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = fg;
    g.lineWidth = 8;
    g.strokeRect(14, 14, w - 28, h - 28);
    g.fillStyle = fg;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = font;
    const step = (h - 40) / lines.length;
    lines.forEach((l, i) => g.fillText(l, w / 2, 20 + step * (i + 0.5)));
    // grime
    const r = makeRng(3);
    for (let i = 0; i < 300; i++) {
      g.fillStyle = `rgba(0,0,0,${r() * 0.2})`;
      g.fillRect(r() * w, r() * h, 2 + r() * 8, 2 + r() * 8);
    }
  }, { repeat: [1, 1] });
}

export function fernTexture() {
  const r = makeRng(9);
  const t = canvasTex(128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = '#4c6a38';
    g.fillStyle = '#4c6a38';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(w / 2, h);
    g.quadraticCurveTo(w / 2 + 6, h / 2, w / 2 - 4, 4);
    g.stroke();
    for (let i = 0; i < 22; i++) {
      const t = i / 22;
      const y = h - t * (h - 8);
      const x = w / 2 + 6 * Math.sin(t * 3) - t * 6;
      const len = (1 - t) * 46 + 6;
      for (const s of [-1, 1]) {
        g.beginPath();
        g.moveTo(x, y);
        g.quadraticCurveTo(x + s * len * 0.6, y - 10, x + s * len, y - 4 - r() * 6);
        g.lineTo(x + s * len * 0.9, y + 2);
        g.closePath();
        g.fill();
      }
    }
  }, { repeat: [1, 1] });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.generateMipmaps = false;
  t.minFilter = THREE.LinearFilter;
  return t;
}

/** Soft round sprite for particles / glow. */
export function glowTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const t = canvasTex(64, 64, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grd.addColorStop(0, inner);
    grd.addColorStop(1, outer);
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
  }, { repeat: [1, 1] });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

export function waterTexture() {
  const r = makeRng(31);
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#808890';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 500; i++) {
      g.strokeStyle = `rgba(230,240,255,${r() * 0.18})`;
      g.lineWidth = 1;
      const x = r() * w, y = r() * h, l = 8 + r() * 30;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + l / 2, y - 2, x + l, y);
      g.stroke();
    }
  });
}

export function clothTexture(color = '#5d6b4a') {
  const r = makeRng(41);
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = color;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 600; i++) {
      g.fillStyle = `rgba(0,0,0,${r() * 0.15})`;
      g.fillRect(r() * w, r() * h, 2, 2);
    }
    for (let i = 0; i < 12; i++) {
      g.fillStyle = `rgba(60,30,20,${r() * 0.35})`;
      g.beginPath();
      g.arc(r() * w, r() * h, 4 + r() * 12, 0, Math.PI * 2);
      g.fill();
    }
  });
}
