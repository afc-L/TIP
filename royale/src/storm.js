// Shrinking storm: phases, randomised safe zones, a moving final circle, damage and the wall visual.
import * as THREE from 'three';
import { STORM_PHASES, MAP_HALF } from './config.js';
import { lerp, rand } from './util.js';

export class Storm {
  constructor(game) {
    this.game = game;
    const geo = new THREE.CylinderGeometry(1, 1, 1, 96, 1, true);
    geo.translate(0, 0.5, 0);
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0x9b3cff) } },
      vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vUv=uv; vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `uniform float uTime; uniform vec3 uColor; varying vec2 vUv; varying vec3 vW;
        float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
        float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
        void main(){ float a = vUv.x*80.0; float s = n(vec2(a + uTime*0.6, vW.y*0.05 - uTime*0.3)) * 0.6 + n(vec2(a*2.3 - uTime, vW.y*0.12))*0.4;
          float alpha = 0.35 + s*0.35; alpha *= smoothstep(0.0, 0.05, vUv.y) * (1.0 - smoothstep(0.85, 1.0, vUv.y));
          gl_FragColor = vec4(uColor * (0.7 + s*0.6), alpha); }`,
    });
    this.wall = new THREE.Mesh(geo, this.mat);
    this.wall.renderOrder = 2;
    this.wall.frustumCulled = false;
    game.scene.add(this.wall);
    // next-zone ring (white line on the ground)
    const ringGeo = new THREE.TorusGeometry(1, 0.004, 4, 128);
    ringGeo.rotateX(Math.PI / 2);
    this.ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }));
    this.ring.visible = false;
    game.scene.add(this.ring);
    this.reset(1);
  }

  reset(scale = 1) {
    this.scale = scale;
    this.phase = -1;
    this.state = 'idle';     // idle | wait | shrink | done
    this.cx = rand(-120, 120); this.cz = rand(-120, 120);
    this.r = 1250;
    this.from = { x: this.cx, z: this.cz, r: this.r };
    this.next = { x: this.cx, z: this.cz, r: this.r };
    this.timer = 0;
    this.total = 0;
    this.dmg = 1;
    this.started = false;
  }

  // choose the first safe zone up-front so it can be shown (and used by the AI) during the bus flight
  preparePhase0() {
    const P = STORM_PHASES[0];
    const c = this.pickCenter({ x: this.cx, z: this.cz, r: this.r - 250 }, P.radius);
    this.next = { x: c.x, z: c.z, r: P.radius };
    this.prepared = true;
  }

  start() {
    this.started = true;
    this.phase = -1;
    this.nextPhase();
  }

  pickCenter(cur, newR) {
    const T = this.game.terrain;
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.sqrt(Math.random()) * Math.max(0, cur.r - newR);
      const x = cur.x + Math.cos(a) * d, z = cur.z + Math.sin(a) * d;
      if (Math.abs(x) > MAP_HALF - 80 || Math.abs(z) > MAP_HALF - 80) continue;
      if (newR < 200 && T.heightAt(x, z) < 1) continue;
      if (newR >= 200 && T.islandMask(x, z) < 0.9) continue;
      return { x, z };
    }
    return { x: cur.x, z: cur.z };
  }

  nextPhase() {
    this.phase++;
    if (this.phase >= STORM_PHASES.length) { this.state = 'done'; return; }
    const P = STORM_PHASES[this.phase];
    this.from = { x: this.cx, z: this.cz, r: this.r };
    if (!(this.phase === 0 && this.prepared)) {
      const c = P.moving ? this.pickCenter({ x: this.cx, z: this.cz, r: this.r + 60 }, 0) : this.pickCenter(this.from, P.radius);
      this.next = { x: c.x, z: c.z, r: P.radius };
    }
    this.prepared = false;
    this.state = 'wait';
    this.timer = P.wait * this.scale;
    this.dmg = P.dmg;
    this.game.onStormPhase(this.phase, 'wait');
  }

  update(dt) {
    this.mat.uniforms.uTime.value += dt;
    if (!this.started) { this._visual(); return; }
    if (this.state === 'wait') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.state = 'shrink';
        this.timer = STORM_PHASES[this.phase].shrink * this.scale;
        this.shrinkDur = this.timer;
        this.game.onStormPhase(this.phase, 'shrink');
      }
    } else if (this.state === 'shrink') {
      this.timer -= dt;
      const k = 1 - Math.max(0, this.timer) / this.shrinkDur;
      this.cx = lerp(this.from.x, this.next.x, k);
      this.cz = lerp(this.from.z, this.next.z, k);
      this.r = lerp(this.from.r, this.next.r, k);
      if (this.timer <= 0) this.nextPhase();
    }
    this._visual();
  }

  _visual() {
    this.wall.visible = this.started;
    this.wall.position.set(this.cx, -30, this.cz);
    this.wall.scale.set(Math.max(this.r, 0.5), 700, Math.max(this.r, 0.5));
    const showRing = this.started && this.state !== 'done' && this.next.r > 0;
    this.ring.visible = showRing;
    if (showRing) {
      const y = this.game.player ? this.game.player.pos.y : 10;
      this.ring.position.set(this.next.x, Math.max(1, y - 2), this.next.z);
      this.ring.scale.set(this.next.r, 1, this.next.r);
      this.ring.material.opacity = 0.35;
    }
  }

  inStorm(x, z) {
    return Math.hypot(x - this.cx, z - this.cz) > this.r;
  }
  distOutside(x, z) { return Math.hypot(x - this.cx, z - this.cz) - this.r; }
  inNext(x, z, margin = 0) { return Math.hypot(x - this.next.x, z - this.next.z) < this.next.r - margin; }
  // seconds until the storm edge reaches a point (rough), Infinity if it never does this phase
  timeUntilCovered(x, z) {
    if (this.inStorm(x, z)) return 0;
    const dNext = Math.hypot(x - this.next.x, z - this.next.z);
    if (dNext < this.next.r) return Infinity;
    const waitT = this.state === 'wait' ? this.timer : 0;
    const shrinkT = this.state === 'wait' ? STORM_PHASES[this.phase]?.shrink * this.scale : this.timer;
    const dCur = this.r - Math.hypot(x - this.cx, z - this.cz);
    const total = this.r - this.next.r;
    if (total <= 0) return waitT + shrinkT;
    return waitT + shrinkT * Math.max(0, Math.min(1, dCur / (total + 1e-3)));
  }
  phaseLabel() {
    if (!this.started) return { text: 'Storm forming', t: 0 };
    if (this.state === 'wait') return { text: 'Storm shrinks in', t: this.timer };
    if (this.state === 'shrink') return { text: 'Storm shrinking', t: this.timer };
    return { text: 'Final storm', t: 0 };
  }
}
