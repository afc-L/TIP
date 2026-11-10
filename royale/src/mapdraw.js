// Renders the island into a 2D canvas used by the minimap and the full-screen map.
import * as THREE from 'three';
import { MAP_HALF } from './config.js';

export const BUS_ROUTE_COLOR = '#ffffff';

export function drawMapImage(terrain, world, size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const col = new THREE.Color();
  const scale = (MAP_HALF * 2) / size;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const x = -MAP_HALF + (i + 0.5) * scale, z = -MAP_HALF + (j + 0.5) * scale;
      const h = terrain.heightAt(x, z);
      const k = (j * size + i) * 4;
      if (h < -0.2 && h > -900) {
        const d = Math.min(1, -h / 12);
        img.data[k] = 70 - d * 30; img.data[k + 1] = 160 - d * 40; img.data[k + 2] = 225 - d * 20; img.data[k + 3] = 255;
        continue;
      }
      terrain.colorAt(x, z, h, col);
      col.convertLinearToSRGB();
      // hill shading
      const hx = terrain.heightAt(x + scale, z) - h;
      const shade = Math.max(0.65, Math.min(1.25, 1 - hx * 0.08));
      img.data[k] = Math.min(255, col.r * 255 * shade);
      img.data[k + 1] = Math.min(255, col.g * 255 * shade);
      img.data[k + 2] = Math.min(255, col.b * 255 * shade);
      img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const s = size / (MAP_HALF * 2);
  // roads
  ctx.strokeStyle = 'rgba(60,60,66,0.95)';
  ctx.lineWidth = Math.max(1.5, 8 * s);
  ctx.lineCap = 'round';
  for (const r of world.roads) {
    ctx.beginPath();
    r.forEach((p, i) => { const x = (p.x + MAP_HALF) * s, y = (p.z + MAP_HALF) * s; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
    ctx.stroke();
  }
  // buildings
  for (const f of world.footprints) {
    const x = (f.x0 + MAP_HALF) * s, y = (f.z0 + MAP_HALF) * s;
    const w = Math.max(1, (f.x1 - f.x0) * s), h = Math.max(1, (f.z1 - f.z0) * s);
    ctx.fillStyle = '#' + new THREE.Color().setHex(f.color, THREE.SRGBColorSpace).getHexString(THREE.SRGBColorSpace);
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(x, y, w, h);
  }
  return c;
}
