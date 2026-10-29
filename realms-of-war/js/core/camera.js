// Keyboard state + an RTS-style orbit camera shared by the campaign map and battles.
(function () {
  const RW = window.RW;
  const U = RW.util;

  const input = { keys: new Set(), mouse: { x: 0, y: 0, inside: false } };
  function typing(e) { const t = e.target; return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT'); }
  window.addEventListener('keydown', (e) => { if (!typing(e)) input.keys.add(e.code); });
  window.addEventListener('keyup', (e) => input.keys.delete(e.code));
  window.addEventListener('blur', () => { input.keys.clear(); input.mouse.inside = false; });
  window.addEventListener('mousemove', (e) => { input.mouse.x = e.clientX; input.mouse.y = e.clientY; input.mouse.inside = true; });
  document.addEventListener('mouseleave', () => { input.mouse.inside = false; });
  RW.input = input;

  class RTSCamera {
    constructor(camera, opts) {
      this.cam = camera;
      this.tx = opts.x || 0; this.tz = opts.z || 0;
      this.yaw = opts.yaw || 0;
      this.dist = this.targetDist = opts.dist || 60;
      this.minDist = opts.minDist || 12; this.maxDist = opts.maxDist || 200;
      this.minPitch = opts.minPitch || 0.5; this.maxPitch = opts.maxPitch || 1.25;
      this.bounds = opts.bounds || { minX: -100, maxX: 100, minZ: -100, maxZ: 100 };
      this.heightFn = opts.heightFn || (() => 0);
      this.panSpeed = opts.panSpeed || 1;
      this.rotating = false;
      this.edgeScroll = opts.edgeScroll !== false;
      this.ty = 0;
      this.anim = null;
    }
    zoom(deltaY) {
      const f = Math.exp(deltaY * 0.0012 * RW.settings.camSens);
      this.targetDist = U.clamp(this.targetDist * f, this.minDist, this.maxDist);
    }
    pan(dx, dz) {
      const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
      this.tx += dx * c + dz * s;
      this.tz += -dx * s + dz * c;
      this.anim = null;
    }
    focus(x, z, dist) {
      this.anim = { x, z, dist: dist || this.targetDist };
    }
    rotateBy(dx, dy) {
      this.yaw -= dx * 0.005 * RW.settings.camSens;
      if (dy) this.targetDist = U.clamp(this.targetDist * Math.exp(dy * 0.004), this.minDist, this.maxDist);
    }
    update(dt, allowKeys = true) {
      const k = input.keys;
      const sens = RW.settings.camSens;
      const speed = (20 + this.dist * 1.1) * this.panSpeed * sens * dt;
      if (allowKeys) {
        let px = 0, pz = 0;
        if (k.has('KeyW') || k.has('ArrowUp')) pz -= 1;
        if (k.has('KeyS') || k.has('ArrowDown')) pz += 1;
        if (k.has('KeyA') || k.has('ArrowLeft')) px -= 1;
        if (k.has('KeyD') || k.has('ArrowRight')) px += 1;
        if (this.edgeScroll && RW.settings.edgeScroll && input.mouse.inside && document.hasFocus()) {
          const m = 6, w = window.innerWidth, h = window.innerHeight;
          if (input.mouse.x <= m) px -= 1; else if (input.mouse.x >= w - m) px += 1;
          if (input.mouse.y <= m) pz -= 1; else if (input.mouse.y >= h - m) pz += 1;
        }
        if (k.has('ShiftLeft') || k.has('ShiftRight')) { px *= 2; pz *= 2; }
        if (px || pz) this.pan(px * speed, pz * speed);
        if (k.has('KeyQ')) this.yaw += 1.6 * sens * dt;
        if (k.has('KeyE')) this.yaw -= 1.6 * sens * dt;
        if (k.has('KeyR') || k.has('PageUp')) this.targetDist = U.clamp(this.targetDist * (1 - 1.5 * dt), this.minDist, this.maxDist);
        if (k.has('KeyF') || k.has('PageDown')) this.targetDist = U.clamp(this.targetDist * (1 + 1.5 * dt), this.minDist, this.maxDist);
      }
      if (this.anim) {
        const a = this.anim, t = 1 - Math.exp(-6 * dt);
        this.tx += (a.x - this.tx) * t; this.tz += (a.z - this.tz) * t;
        this.targetDist += (a.dist - this.targetDist) * t;
        if (Math.abs(a.x - this.tx) + Math.abs(a.z - this.tz) < 0.3) this.anim = null;
      }
      const b = this.bounds;
      this.tx = U.clamp(this.tx, b.minX, b.maxX);
      this.tz = U.clamp(this.tz, b.minZ, b.maxZ);
      this.dist += (this.targetDist - this.dist) * (1 - Math.exp(-10 * dt));
      const gy = this.heightFn(this.tx, this.tz);
      this.ty += (gy - this.ty) * (1 - Math.exp(-5 * dt));
      const zt = (this.dist - this.minDist) / (this.maxDist - this.minDist);
      const pitch = U.lerp(this.minPitch, this.maxPitch, Math.pow(U.clamp(zt, 0, 1), 0.7));
      const cp = Math.cos(pitch);
      const x = this.tx + Math.sin(this.yaw) * cp * this.dist;
      const z = this.tz + Math.cos(this.yaw) * cp * this.dist;
      let y = this.ty + Math.sin(pitch) * this.dist;
      // Never dip below the terrain.
      const under = this.heightFn(x, z) + 2;
      if (y < under) y = under;
      this.cam.position.set(x, y, z);
      this.cam.lookAt(this.tx, this.ty, this.tz);
    }
  }
  RW.RTSCamera = RTSCamera;
})();
