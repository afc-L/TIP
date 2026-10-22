// Pedestrians (sidewalk loops, reactions, dodging) and named actors (creators, rivals, contacts, valets).
import * as THREE from 'three';
import { Crowd, randomLook, type CrowdAgent } from './character';
import { POI_BY_ID } from '../data/world';
import { CREATORS, CREATOR_BY_ID } from '../data/creators';
import { CONTACTS, RIVALS } from '../data/rivals';
import type { GameState } from '../types';
import { levelFor } from '../data/catalog';

export interface Ped {
  agent: CrowdAgent;
  loop: { cx: number; cz: number; hw: number; hd: number };
  s: number;
  dir: number;
  speed: number;
  idle: number;
  react: number; // seconds of looking at the player
  cooldown: number;
  dodge: { x: number; z: number; t: number } | null;
}

export type ActorKind = 'creator' | 'rival' | 'contact' | 'valet' | 'bouncer' | 'dealer';

export interface Actor {
  kind: ActorKind;
  id: string;
  name: string;
  poi: string;
  interior: 'club' | null;
  agent: CrowdAgent;
  marker: THREE.Mesh | null;
  homeYaw: number;
  talkT: number;
}

const MARKER_COLORS: Record<string, string> = {
  available: '#ffd36a', locked: '#8c8c8c', signed: '#3dffb0', rival: '#ff4d6d', contact: '#5cc8ff', cooldown: '#c08a3a',
};

export class Pedestrians {
  peds: Ped[] = [];
  constructor(public crowd: Crowd, loops: { cx: number; cz: number; hw: number; hd: number }[], count: number) {
    let seed = 2024;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < count; i++) {
      const loop = loops[Math.floor(r() * loops.length)];
      const agent = crowd.add({ x: 0, y: 0.14, z: 0, yaw: 0, speed: 0, phase: r() * 10, dance: 0, wave: 0, look: randomLook(r), visible: true });
      if (!agent) break;
      const per = 4 * (loop.hw + loop.hd);
      this.peds.push({ agent, loop, s: r() * per, dir: r() < 0.5 ? 1 : -1, speed: 1.1 + r() * 0.6, idle: 0, react: 0, cooldown: 0, dodge: null });
    }
  }

  static loopPos(l: Ped['loop'], s: number) {
    const w = 2 * l.hw, d = 2 * l.hd;
    const per = 2 * (w + d);
    s = ((s % per) + per) % per;
    if (s < w) return { x: l.cx - l.hw + s, z: l.cz - l.hd, dx: 1, dz: 0 };
    s -= w;
    if (s < d) return { x: l.cx + l.hw, z: l.cz - l.hd + s, dx: 0, dz: 1 };
    s -= d;
    if (s < w) return { x: l.cx + l.hw - s, z: l.cz + l.hd, dx: -1, dz: 0 };
    s -= w;
    return { x: l.cx - l.hw, z: l.cz + l.hd - s, dx: 0, dz: -1 };
  }

  /** Returns a reaction event when a pedestrian notices something. */
  update(
    dt: number,
    px: number,
    pz: number,
    car: { x: number; z: number; speed: number; active: boolean; bounce: boolean; style: string; prestige: number } | null,
    hidden: boolean,
  ): { ped: Ped; kind: 'bounce' | 'luxury' | 'dodge' | 'fan' } | null {
    let event: { ped: Ped; kind: 'bounce' | 'luxury' | 'dodge' | 'fan' } | null = null;
    for (const p of this.peds) {
      const a = p.agent;
      const dxp = a.x - px, dzp = a.z - pz;
      const d2 = dxp * dxp + dzp * dzp;
      a.visible = !hidden && d2 < 190 * 190;
      if (!a.visible) {
        // cheap far update
        p.s += p.dir * p.speed * dt;
        const pos = Pedestrians.loopPos(p.loop, p.s);
        a.x = pos.x;
        a.z = pos.z;
        continue;
      }
      p.cooldown = Math.max(0, p.cooldown - dt);
      // dodge an approaching car
      if (car && car.active && Math.abs(car.speed) > 3) {
        const cx = a.x - car.x, cz = a.z - car.z;
        const cd = Math.hypot(cx, cz);
        if (cd < 4.5 && !p.dodge) {
          const k = 1 / (cd || 1);
          p.dodge = { x: cx * k, z: cz * k, t: 0.6 };
          if (!event && p.cooldown <= 0) {
            event = { ped: p, kind: 'dodge' };
            p.cooldown = 6;
          }
        }
      }
      if (p.dodge) {
        a.x += p.dodge.x * 6 * dt;
        a.z += p.dodge.z * 6 * dt;
        p.dodge.t -= dt;
        a.speed = 5;
        a.yaw = Math.atan2(p.dodge.x, p.dodge.z);
        if (p.dodge.t <= 0) {
          p.dodge = null;
          // snap back to the loop smoothly via idle
          p.idle = 1;
        }
        continue;
      }
      // react to bounce / luxury cars nearby
      if (car && car.active && d2 < 20 * 20 && Math.abs(car.speed) < 6) {
        const interesting = car.bounce || car.prestige >= 8;
        if (interesting && p.react <= 0 && p.cooldown <= 0) {
          p.react = car.bounce ? 4 : 2.5;
          p.cooldown = 10 + Math.random() * 8;
          if (!event) event = { ped: p, kind: car.bounce ? 'bounce' : 'luxury' };
        }
      }
      if (p.react > 0) {
        p.react -= dt;
        const target = car ? Math.atan2(car.x - a.x, car.z - a.z) : a.yaw;
        a.yaw += angleDiff(target, a.yaw) * Math.min(1, dt * 6);
        a.speed = 0;
        a.wave = car?.bounce && (car.style !== 'executive') ? 1 : 0;
        a.dance = car?.bounce && car.style === 'miami' ? 0.6 : 0;
        continue;
      }
      a.wave = 0;
      a.dance = 0;
      if (p.idle > 0) {
        p.idle -= dt;
        a.speed = 0;
        // drift back toward the loop
        const pos = Pedestrians.loopPos(p.loop, p.s);
        a.x += (pos.x - a.x) * Math.min(1, dt * 2);
        a.z += (pos.z - a.z) * Math.min(1, dt * 2);
        continue;
      }
      if (Math.random() < dt * 0.02) p.idle = 2 + Math.random() * 4;
      p.s += p.dir * p.speed * dt;
      const pos = Pedestrians.loopPos(p.loop, p.s);
      a.x += (pos.x - a.x) * Math.min(1, dt * 8);
      a.z += (pos.z - a.z) * Math.min(1, dt * 8);
      a.yaw = Math.atan2(pos.dx * p.dir, pos.dz * p.dir);
      a.speed = p.speed;
      // fans recognise the player on foot at high clout
      if (!car && d2 < 6 * 6 && p.cooldown <= 0 && Math.random() < dt * 0.4) {
        p.cooldown = 30;
        if (!event) event = { ped: p, kind: 'fan' };
      }
    }
    return event;
  }
}

export function angleDiff(a: number, b: number) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// ----------------------------------------------------------------------------------------------

export class Actors {
  list: Actor[] = [];
  private markerGeo = new THREE.OctahedronGeometry(0.22, 0);
  private markerMats = new Map<string, THREE.MeshBasicMaterial>();

  constructor(private cityCrowd: Crowd, private clubCrowd: Crowd, private cityGroup: THREE.Object3D, private clubScene: THREE.Object3D) {
    const slotsUsed: Record<string, number> = {};
    const slot = (poi: string) => {
      const i = slotsUsed[poi] ?? 0;
      slotsUsed[poi] = i + 1;
      return i;
    };
    const clubSlots = [
      { x: -12, z: 8 }, { x: 10, z: 6 }, { x: 12, z: -6 }, { x: -12, z: -6 }, { x: 6, z: 12 },
    ];
    let clubI = 0;
    const place = (kind: ActorKind, id: string, name: string, poiId: string, look: CrowdAgent['look'], inside = false) => {
      const poi = POI_BY_ID[poiId];
      let x: number, z: number, yaw: number;
      if (inside) {
        const s = clubSlots[clubI++ % clubSlots.length];
        x = s.x;
        z = s.z;
        yaw = Math.atan2(-x, -z + 4);
      } else {
        const fx = Math.sin(poi.face), fz = Math.cos(poi.face);
        const px = fz, pz = -fx; // perpendicular along the sidewalk
        const offsets = [3.6, -3.6, 6.4, -6.4, 9.2, -9.2, 12, -12];
        const k = offsets[slot(poiId) % offsets.length];
        const out = poi.kind === 'carmeet' || poi.kind === 'showoff' ? 14 : 0.6;
        x = poi.x + px * k + fx * out;
        z = poi.z + pz * k + fz * out;
        yaw = poi.face + Math.PI * 0; // face the street
      }
      const crowd = inside ? this.clubCrowd : this.cityCrowd;
      const agent = crowd.add({ x, y: inside ? 0.08 : 0.14, z, yaw, speed: 0, phase: Math.random() * 10, dance: inside ? 0.25 : 0, wave: 0, look, visible: true });
      if (!agent) return;
      let marker: THREE.Mesh | null = null;
      if (kind !== 'valet' && kind !== 'bouncer' && kind !== 'dealer') {
        marker = new THREE.Mesh(this.markerGeo, this.mat('available'));
        marker.position.set(x, (inside ? 0.08 : 0.14) + 2.35, z);
        (inside ? this.clubScene : this.cityGroup).add(marker);
      }
      this.list.push({ kind, id, name, poi: poiId, interior: inside ? 'club' : null, agent, marker, homeYaw: yaw, talkT: 0 });
    };
    for (const c of CREATORS) {
      place('creator', c.id, c.name, c.venue, { skin: c.look.skin, hair: c.look.hair, top: c.look.outfit, bottom: '#1d2433', hairStyle: c.look.hairStyle, scale: 0.97 }, c.venue === 'club');
    }
    for (const r of RIVALS) place('rival', r.id, r.name, r.venue, { skin: r.look.skin, hair: r.look.hair, top: r.look.outfit, bottom: '#111', hairStyle: 'short', scale: 1.04 }, r.venue === 'club');
    place('dealer', 'dealer_street', 'Guy in a linen suit', 'carmeet', { skin: '#c68a5e', hair: '#111', top: '#f4efe4', bottom: '#f4efe4', hairStyle: 'short' });
    place('dealer', 'dealer_club', 'VIP bathroom attendant', 'club', { skin: '#e2b48c', hair: '#3a2a1a', top: '#111', bottom: '#111', hairStyle: 'short' }, true);
    for (const c of CONTACTS) place('contact', c.id, c.name, c.venue, { skin: c.look.skin, hair: c.look.hair, top: c.look.outfit, bottom: '#222', hairStyle: 'short' }, c.venue === 'club');
    for (const p of Object.values(POI_BY_ID)) {
      if (!p.valet) continue;
      const fx = Math.sin(p.face), fz = Math.cos(p.face);
      const agent = this.cityCrowd.add({ x: p.x + fx * 1.6 + fz * 1.8, y: 0.14, z: p.z + fz * 1.6 - fx * 1.8, yaw: p.face, speed: 0, phase: 0, dance: 0, wave: 0, look: { skin: '#c68a5e', hair: '#111', top: '#7b0d1e', bottom: '#111', hairStyle: 'short' }, visible: true });
      if (agent) this.list.push({ kind: 'valet', id: `valet_${p.id}`, name: 'Valet', poi: p.id, interior: null, agent, marker: null, homeYaw: p.face, talkT: 0 });
    }
    {
      const p = POI_BY_ID.club;
      const fx = Math.sin(p.face), fz = Math.cos(p.face);
      const agent = this.cityCrowd.add({ x: p.x - fz * 2.2 + fx * 0.3, y: 0.14, z: p.z + fx * 2.2 + fz * 0.3, yaw: p.face, speed: 0, phase: 0, dance: 0, wave: 0, look: { skin: '#4a2c1d', hair: '#111', top: '#111', bottom: '#111', hairStyle: 'none', scale: 1.15 }, visible: true });
      if (agent) this.list.push({ kind: 'bouncer', id: 'bouncer', name: 'VOLT Bouncer', poi: 'club', interior: null, agent, marker: null, homeYaw: p.face, talkT: 0 });
    }
  }

  private mat(key: string) {
    let m = this.markerMats.get(key);
    if (!m) {
      m = new THREE.MeshBasicMaterial({ color: MARKER_COLORS[key], toneMapped: false });
      this.markerMats.set(key, m);
    }
    return m;
  }

  /** Update visibility/marker colours from game state. */
  refresh(g: GameState) {
    const lvl = levelFor(g.clout);
    for (const a of this.list) {
      if (a.kind === 'creator') {
        const def = CREATOR_BY_ID[a.id];
        const lost = (g.lostToRival[a.id] ?? 0) > g.day;
        a.agent.visible = !lost;
        if (a.marker) {
          a.marker.visible = !lost;
          const key = g.creators[a.id] ? 'signed' : lvl < def.minLevel ? 'locked' : (g.cooldowns[a.id] ?? 0) > g.day ? 'cooldown' : 'available';
          a.marker.material = this.mat(key);
        }
      } else if (a.kind === 'rival') {
        if (a.marker) a.marker.material = this.mat('rival');
      } else if (a.kind === 'contact') {
        if (a.marker) {
          a.marker.material = this.mat('contact');
          a.marker.scale.setScalar(g.contacts.includes(a.id) ? 0.7 : 1);
        }
      }
    }
  }

  update(dt: number, t: number, px: number, pz: number, interior: string | null) {
    for (const a of this.list) {
      const inScope = (a.interior ?? null) === (interior === 'club' ? 'club' : null);
      if (a.marker) {
        a.marker.rotation.y = t * 2;
        a.marker.position.y = a.agent.y + 2.35 + Math.sin(t * 3 + a.agent.phase) * 0.08;
      }
      if (!inScope) continue;
      const d = Math.hypot(a.agent.x - px, a.agent.z - pz);
      // turn toward the player when close, otherwise idle sway
      const target = d < 6 ? Math.atan2(px - a.agent.x, pz - a.agent.z) : a.homeYaw;
      a.agent.yaw += angleDiff(target, a.agent.yaw) * Math.min(1, dt * 3);
      a.talkT = Math.max(0, a.talkT - dt);
      a.agent.wave = a.talkT > 0 ? 0.35 : 0;
    }
  }
}
