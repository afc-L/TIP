// Shared 2D map rendering for the minimap and the full-screen city map.
import { MAP_MAX_Z, MAP_MIN_X, MAP_MIN_Z, POIS, ROADS_X, ROADS_Z, ROAD_W, SEAWALL_X, STREET_NAMES_X, STREET_NAMES_Z, PIER_Z } from '../game/data/world';
import type { World } from '../game/engine/world';

export const MAP_BOUNDS = { minX: MAP_MIN_X - 30, maxX: 760, minZ: MAP_MIN_Z - 30, maxZ: MAP_MAX_Z + 120 };
let base: HTMLCanvasElement | null = null;
const BASE_SCALE = 2;

export function baseMap(world: World | null): HTMLCanvasElement {
  if (base) return base;
  const W = (MAP_BOUNDS.maxX - MAP_BOUNDS.minX) * BASE_SCALE;
  const H = (MAP_BOUNDS.maxZ - MAP_BOUNDS.minZ) * BASE_SCALE;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  const tx = (x: number) => (x - MAP_BOUNDS.minX) * BASE_SCALE;
  const tz = (z: number) => (z - MAP_BOUNDS.minZ) * BASE_SCALE;
  // land
  ctx.fillStyle = '#1b1f26';
  ctx.fillRect(0, 0, W, H);
  // water
  ctx.fillStyle = '#0d3550';
  ctx.fillRect(tx(SEAWALL_X), 0, W - tx(SEAWALL_X), H);
  // island
  ctx.fillStyle = '#2f4a2c';
  ctx.beginPath();
  ctx.arc(tx(560), tz(-240), 74 * BASE_SCALE, 0, Math.PI * 2);
  ctx.fill();
  // causeway
  ctx.fillStyle = '#6b6862';
  ctx.fillRect(tx(SEAWALL_X), tz(420) - 7 * BASE_SCALE, W, 14 * BASE_SCALE);
  // blocks
  ctx.fillStyle = '#2a2f38';
  if (world) for (const b of world.blockList) ctx.fillRect(tx(b.cx - b.w / 2 - 4), tz(b.cz - b.d / 2 - 4), (b.w + 8) * BASE_SCALE, (b.d + 8) * BASE_SCALE);
  // parks
  if (world) for (const p of world.parks) {
    ctx.fillStyle = p.color === '#4f7d3a' ? '#2f5a2e' : '#4a4232';
    ctx.fillRect(tx(p.x - p.w / 2), tz(p.z - p.d / 2), p.w * BASE_SCALE, p.d * BASE_SCALE);
  }
  // roads
  ctx.fillStyle = '#4b4f57';
  for (const x of ROADS_X) ctx.fillRect(tx(x - ROAD_W / 2), tz(ROADS_Z[0] - ROAD_W / 2), ROAD_W * BASE_SCALE, (ROADS_Z[ROADS_Z.length - 1] - ROADS_Z[0] + ROAD_W) * BASE_SCALE);
  for (const z of ROADS_Z) ctx.fillRect(tx(ROADS_X[0] - ROAD_W / 2), tz(z - ROAD_W / 2), (ROADS_X[ROADS_X.length - 1] - ROADS_X[0] + ROAD_W) * BASE_SCALE, ROAD_W * BASE_SCALE);
  // Brickell Ave highlight
  ctx.fillStyle = '#6a604a';
  ctx.fillRect(tx(-ROAD_W / 2), tz(ROADS_Z[0] - ROAD_W / 2), ROAD_W * BASE_SCALE, (ROADS_Z[ROADS_Z.length - 1] - ROADS_Z[0] + ROAD_W) * BASE_SCALE);
  // buildings
  if (world)
    for (const r of world.mapRects) {
      const shade = Math.min(1, r.h / 200);
      ctx.fillStyle = `rgba(${120 + shade * 80}, ${130 + shade * 70}, ${150 + shade * 60}, 0.85)`;
      ctx.fillRect(tx(r.x - r.w / 2), tz(r.z - r.d / 2), r.w * BASE_SCALE, r.d * BASE_SCALE);
    }
  // marina pier
  ctx.fillStyle = '#8a6a44';
  ctx.fillRect(tx(SEAWALL_X), tz(PIER_Z - 2), 130 * BASE_SCALE, 4 * BASE_SCALE);
  for (let i = 0; i < 5; i++) ctx.fillRect(tx(SEAWALL_X + 19 + i * 24), tz(PIER_Z + 2), 2 * BASE_SCALE, 18 * BASE_SCALE);
  base = c;
  return c;
}

export function resetBaseMap() {
  base = null;
}

export function drawLabels(ctx: CanvasRenderingContext2D, tx: (x: number) => number, tz: (z: number) => number, scale: number) {
  ctx.font = `600 ${Math.max(9, 4.5 * scale)}px Inter, Arial`;
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.textAlign = 'center';
  for (const x of ROADS_X) {
    ctx.save();
    ctx.translate(tx(x), tz(-150 + 50));
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(STREET_NAMES_X[x], 0, 3);
    ctx.restore();
  }
  for (const z of ROADS_Z) ctx.fillText(STREET_NAMES_Z[z], tx(-150 + 50), tz(z) + 3);
  ctx.fillStyle = 'rgba(120,200,255,0.5)';
  ctx.font = `italic 600 ${Math.max(12, 8 * scale)}px Playfair Display, Georgia`;
  ctx.fillText('Biscayne Bay', tx(560), tz(60));
}

export function drawPois(ctx: CanvasRenderingContext2D, tx: (x: number) => number, tz: (z: number) => number, size: number, labels: boolean, highlight?: string | null) {
  for (const p of POIS) {
    const x = tx(p.x), y = tz(p.z);
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(10,10,14,0.85)';
    ctx.fill();
    ctx.lineWidth = highlight === p.id ? 3 : 1.5;
    ctx.strokeStyle = highlight === p.id ? '#ffd36a' : p.color;
    ctx.stroke();
    ctx.fillStyle = p.color;
    ctx.font = `${Math.round(size * 1.05)}px Inter, "Apple Color Emoji", "Segoe UI Emoji", Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.icon, x, y + 1);
    if (labels) {
      ctx.font = '600 12px Inter, Arial';
      ctx.fillStyle = '#fff';
      ctx.textBaseline = 'top';
      ctx.fillText(p.name, x, y + size + 3);
    }
    ctx.textBaseline = 'alphabetic';
  }
}

export function drawPlayer(ctx: CanvasRenderingContext2D, x: number, y: number, heading: number, size: number) {
  ctx.save();
  ctx.translate(x, y);
  // world forward (sin h, cos h) in map coords (z down)
  ctx.rotate(Math.atan2(Math.cos(heading), Math.sin(heading)) + Math.PI / 2);
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size * 0.7, size * 0.8);
  ctx.lineTo(0, size * 0.4);
  ctx.lineTo(-size * 0.7, size * 0.8);
  ctx.closePath();
  ctx.fillStyle = '#ffd36a';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export { BASE_SCALE };
