// Gore: directional blood sprays, ground splatter and growing blood pools (instanced decals),
// body parts thrown by explosions and vehicles (simple physics), headless corpses,
// and blood on the screen. Controlled by Settings → Gore (off / normal / extreme).
(function (G) {
  'use strict';
  const IF = G.IF, U = IF.U;
  const FX = IF.FX;
  const GR = (IF.Gore = {});

  const level = () => (IF.Profile.settings.gore || 'extreme');
  const mul = () => ({ off: 0, normal: 0.7, extreme: 1.4 }[level()] || 0);
  const camD2 = (x, z) => { const c = IF.R.camera.position; return (x - c.x) ** 2 + (z - c.z) ** 2; };

  function splatTex() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = '#fff';
    // irregular blob: overlapping circles plus droplets around the rim
    x.beginPath(); x.arc(64, 64, 34, 0, 7); x.fill();
    for (let k = 0; k < 14; k++) { const a = Math.random() * 6.28, r = 20 + Math.random() * 18; x.beginPath(); x.arc(64 + Math.cos(a) * r, 64 + Math.sin(a) * r, 8 + Math.random() * 14, 0, 7); x.fill(); }
    for (let k = 0; k < 22; k++) { const a = Math.random() * 6.28, r = 44 + Math.random() * 18; x.beginPath(); x.arc(64 + Math.cos(a) * r, 64 + Math.sin(a) * r, 1.5 + Math.random() * 3.5, 0, 7); x.fill(); }
    const t = new THREE.CanvasTexture(c);
    return t;
  }

  GR.init = function () {
    const N = (GR.N = 900);
    const geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshLambertMaterial({ map: splatTex(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, color: 0xffffff, alphaTest: 0.05 });
    GR.decals = new THREE.InstancedMesh(geo, mat, N);
    GR.decals.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    GR.decals.frustumCulled = false; GR.decals.count = 0; GR.decals.renderOrder = 1; GR.decals.receiveShadow = true;
    const c = new THREE.Color();
    for (let i = 0; i < N; i++) GR.decals.setColorAt(i, c.setRGB(0.35, 0.02, 0.02));
    IF.R.scene.add(GR.decals);
    GR.d = { x: new Float32Array(N), y: new Float32Array(N), z: new Float32Array(N), s: new Float32Array(N), target: new Float32Array(N), rate: new Float32Array(N), rot: new Float32Array(N), sx: new Float32Array(N) };
    GR.dCursor = 0; GR.dCount = 0; GR.growing = new Set();
    // body parts
    const M = (GR.M = 260);
    GR.gibMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff }), M);
    GR.gibMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    GR.gibMesh.frustumCulled = false; GR.gibMesh.count = 0; GR.gibMesh.castShadow = true;
    for (let i = 0; i < M; i++) GR.gibMesh.setColorAt(i, c);
    IF.R.scene.add(GR.gibMesh);
    GR.g = [];
    GR.gCursor = 0;
    GR.splats = []; // screen blood
    GR.on = true;
  };
  GR.dispose = function () {
    if (!GR.on) return;
    IF.R.scene.remove(GR.decals); IF.R.scene.remove(GR.gibMesh);
    GR.decals.dispose(); GR.gibMesh.dispose();
    GR.on = false; GR.g = []; GR.splats = [];
  };

  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler(), _c = new THREE.Color();
  function writeDecal(i) {
    const d = GR.d;
    _q.setFromAxisAngle(_s.set(0, 1, 0), d.rot[i]);
    _p.set(d.x[i], d.y[i], d.z[i]);
    _s.set(d.s[i] * d.sx[i], 1, d.s[i]);
    _m.compose(_p, _q, _s);
    GR.decals.setMatrixAt(i, _m);
    GR.decals.instanceMatrix.needsUpdate = true;
  }
  // a ground splat; grows from size0 to size1 over `grow` seconds
  GR.decal = function (x, z, size0, size1, grow, dark, stretch) {
    if (!GR.on) return;
    const W = IF.B && IF.B.W; if (!W) return;
    if (W.hasRiver && W.waterDepth(x, z) > 0.05) return;
    const i = GR.dCursor; GR.dCursor = (GR.dCursor + 1) % GR.N;
    GR.dCount = Math.min(GR.N, GR.dCount + 1);
    const d = GR.d;
    d.x[i] = x; d.z[i] = z; d.y[i] = W.groundAt(x, z) + 0.05 + (i % 7) * 0.002;
    d.s[i] = size0; d.target[i] = size1; d.rate[i] = grow > 0 ? (size1 - size0) / grow : 0;
    d.rot[i] = Math.random() * 6.28; d.sx[i] = stretch || 1;
    const k = dark === undefined ? U.rr(0.75, 1.05) : dark;
    GR.decals.setColorAt(i, _c.setRGB(0.34 * k, 0.015 * k, 0.015 * k));
    GR.decals.instanceColor.needsUpdate = true;
    if (d.rate[i] > 0) GR.growing.add(i); else GR.growing.delete(i);
    writeDecal(i);
    GR.decals.count = GR.dCount;
  };

  // ---------------------------------------------------------------- FX overrides
  FX.blood = function (x, y, z, dx, dz, k) {
    if (!FX.on) return;
    const m = mul();
    if (m <= 0) { FX.impact && FX.impact(x, y, z, 0); return; }
    if (camD2(x, z) > 220 * 220) return;
    k = (k || 1) * m;
    if (dx === undefined) { const a = Math.random() * 6.28; dx = Math.cos(a); dz = Math.sin(a); }
    const n = Math.round((5 + 7 * k) * FX.q);
    for (let i = 0; i < n; i++) {
      const sp = U.rr(1.5, 6) * (0.7 + k * 0.25);
      FX.smoke.emit(x, y, z, dx * sp + U.rr(-1.2, 1.2), U.rr(-0.3, 2.6), dz * sp + U.rr(-1.2, 1.2), U.rr(0.45, 1.0), U.rr(0.06, 0.14) * (1 + k * 0.15), 0.05, 0.5, 0.02, 0.02, 1, 0.28, 0.01, 0.01, 0.9, 0.6, 9.8);
    }
    // red mist
    for (let i = 0; i < Math.ceil(k * FX.q); i++) FX.smoke.emit(x + dx * 0.3, y, z + dz * 0.3, dx * 1.2, 0.3, dz * 1.2, U.rr(0.5, 0.9), 0.3, 0.9 + k * 0.3, 0.55, 0.04, 0.04, 0.55, 0.4, 0.05, 0.05, 0, 2, 0.5);
    // splatter on the ground behind the victim
    if (camD2(x, z) < 120 * 120) {
      GR.decal(x + dx * U.rr(0.6, 1.8), z + dz * U.rr(0.6, 1.8), U.rr(0.25, 0.5) * (0.8 + k * 0.3), 0, 0, undefined, U.rr(1, 1.8));
      if (k > 1.5) GR.decal(x + dx * U.rr(1.5, 3), z + dz * U.rr(1.5, 3), U.rr(0.2, 0.4), 0, 0, undefined, 1.5);
    }
  };
  FX.pool = function (x, z, size, grow) {
    if (!FX.on || mul() <= 0) return;
    GR.decal(x + U.rr(-0.3, 0.3), z + U.rr(-0.3, 0.3), 0.2, size * (0.8 + mul() * 0.25), grow || 20, U.rr(0.6, 0.85));
  };

  // a body part flying out of a blast
  function gib(x, y, z, vx, vy, vz, sx, sy, sz, col, blood) {
    if (!GR.on) return;
    const i = GR.gCursor; GR.gCursor = (GR.gCursor + 1) % GR.M;
    GR.g[i] = { x, y, z, vx, vy, vz, sx, sy, sz, rx: Math.random() * 6, ry: Math.random() * 6, rz: Math.random() * 6, wx: U.rr(-12, 12), wy: U.rr(-12, 12), wz: U.rr(-12, 12), rest: false, life: 100, blood: blood !== false, trail: 0, splatted: false };
    GR.gibMesh.setColorAt(i, _c.setRGB(col[0], col[1], col[2]));
    GR.gibMesh.instanceColor.needsUpdate = true;
    GR.gibMesh.count = Math.max(GR.gibMesh.count, i + 1);
  }

  FX.gore = function (c) {
    if (!FX.on) return;
    const m = mul();
    const lv = level();
    if (m <= 0) { c.gib = false; c.headless = false; return; }
    const B = IF.B, team = IF.TEAMS[c.team], uni = team.uniform, helm = team.helmet;
    const flesh = [0.45, 0.06, 0.05], skin = [0.72, 0.52, 0.42];
    const near = camD2(c.x, c.z) < 140 * 140;
    const [dx, dz] = c.dir;
    // decide what happens to the body
    const big = c.kind === 'crush' || c.dmg >= (lv === 'extreme' ? 105 : 170);
    if (c.gib && !big && c.kind !== 'crush') c.gib = false;
    if (c.kind === 'explosion' && lv === 'extreme' && c.dmg >= 70 && !c.gib && Math.random() < 0.35) c.gib = true;
    c.headless = !c.gib && c.head && (lv === 'extreme' ? Math.random() < 0.75 : Math.random() < 0.3);
    const y = c.y;
    c.goreDone = true;
    if (c.gib) {
      if (c.kind === 'crush') {
        // run over: flattened, smeared along the track
        GR.decal(c.x, c.z, 0.4, 2.2, 6, 0.7, 2.4);
        for (let k = 0; k < 3 * m; k++) gib(c.x + U.rr(-0.6, 0.6), y + 0.15, c.z + U.rr(-0.6, 0.6), U.rr(-1, 1), U.rr(0.5, 2), U.rr(-1, 1), U.rr(0.15, 0.3), 0.08, U.rr(0.15, 0.35), flesh);
        c.gib = true;
      } else {
        const n = Math.round(U.rr(5, 8) * Math.min(1.4, m));
        const parts = [[0.18, 0.75, 0.2, uni], [0.18, 0.75, 0.2, uni], [0.12, 0.6, 0.12, uni], [0.12, 0.6, 0.12, uni], [0.42, 0.45, 0.26, uni], [0.22, 0.24, 0.22, skin], [0.34, 0.14, 0.34, helm]];
        for (let k = 0; k < n; k++) {
          const p = parts[k % parts.length];
          const sp = U.rr(2.5, 7);
          const a = Math.atan2(dz, dx) + U.rr(-1.2, 1.2);
          gib(c.x, y + U.rr(0.5, 1.3), c.z, Math.cos(a) * sp, U.rr(3, 8), Math.sin(a) * sp, p[0], p[1], p[2], p[3]);
        }
        for (let k = 0; k < 5 * m; k++) gib(c.x, y + 1, c.z, U.rr(-7, 7), U.rr(3, 9), U.rr(-7, 7), U.rr(0.07, 0.16), U.rr(0.07, 0.14), U.rr(0.07, 0.16), flesh);
        // blood burst & a wide pool
        FX.blood(c.x, y + 1, c.z, dx, dz, 2.2);
        for (let k = 0; k < 10 * FX.q; k++) { const a = Math.random() * 6.28; FX.smoke.emit(c.x, y + 1, c.z, Math.cos(a) * U.rr(2, 6), U.rr(1, 5), Math.sin(a) * U.rr(2, 6), U.rr(0.6, 1.2), 0.14, 0.05, 0.45, 0.02, 0.02, 1, 0.25, 0.01, 0.01, 0.8, 0.4, 9.8); }
        GR.decal(c.x, c.z, 0.5, 2.0 + m * 0.4, 10, 0.75);
        for (let k = 0; k < 4; k++) { const a = Math.random() * 6.28, r = U.rr(1.2, 3.5); GR.decal(c.x + Math.cos(a) * r, c.z + Math.sin(a) * r, U.rr(0.3, 0.7), 0, 0); }
      }
      if (camD2(c.x, c.z) < 10 * 10) GR.screen(6, 0.9);
    } else {
      if (c.headless) {
        const hx = c.x + U.dirX(c.yaw) * 0.9, hz = c.z + U.dirZ(c.yaw) * 0.9;
        FX.blood(hx, y + 0.4, hz, dx, dz, 2.4);
        gib(hx, y + 1.5, hz, dx * U.rr(2, 5), U.rr(3, 6), dz * U.rr(2, 5), 0.32, 0.12, 0.34, helm, false);
        if (lv === 'extreme') gib(hx, y + 1.5, hz, dx * U.rr(1, 3), U.rr(2, 4), dz * U.rr(1, 3), 0.1, 0.1, 0.1, flesh);
        GR.decal(hx + dx, hz + dz, 0.3, 0.8, 4, 0.8, 1.6);
        if (camD2(c.x, c.z) < 6 * 6) GR.screen(3, 0.6);
      }
      // the pool grows slowly under the body
      if (near || camD2(c.x, c.z) < 200 * 200) GR.decal(c.x + U.rr(-0.3, 0.3), c.z + U.rr(-0.3, 0.3), 0.2, U.rr(1.0, 1.6) * (0.7 + m * 0.3), U.rr(15, 30), U.rr(0.55, 0.8));
    }
  };

  // blood on the camera lens
  GR.screen = function (n, k) {
    if (!GR.on || mul() <= 0) return;
    for (let i = 0; i < n; i++) {
      const side = Math.random();
      GR.splats.push({ x: side < 0.5 ? U.rr(0, 0.3) + (side < 0.25 ? 0 : 0.7) : U.rr(0, 1), y: side < 0.5 ? U.rr(0, 1) : (Math.random() < 0.5 ? U.rr(0, 0.25) : U.rr(0.75, 1)), r: U.rr(0.03, 0.09) * (0.6 + k), life: U.rr(2.5, 4.5), max: 4.5, drops: Array.from({ length: 6 }, () => [U.rr(-1.6, 1.6), U.rr(-1.6, 1.6), U.rr(0.1, 0.35)]) });
    }
    if (GR.splats.length > 30) GR.splats.splice(0, GR.splats.length - 30);
  };
  IF.on('playerDamage', (dmg, att, kind) => { if (IF.Player && IF.Player.alive && !IF.Player.veh && kind !== 'fall') GR.screen(Math.min(6, 1 + Math.round(dmg / 25)), Math.min(1, dmg / 60)); });

  GR.drawScreen = function (ctx, w, h, dt) {
    if (!GR.on || !GR.splats.length) return;
    const s = Math.min(w, h);
    for (let i = GR.splats.length - 1; i >= 0; i--) {
      const p = GR.splats[i];
      p.life -= dt;
      if (p.life <= 0) { GR.splats.splice(i, 1); continue; }
      const a = Math.min(0.85, p.life / p.max * 1.2);
      const cx = p.x * w, cy = p.y * h + (1 - p.life / p.max) * s * 0.05, r = p.r * s;
      ctx.fillStyle = `rgba(110,4,4,${a})`;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
      for (const d of p.drops) { ctx.beginPath(); ctx.arc(cx + d[0] * r, cy + d[1] * r, r * d[2], 0, 7); ctx.fill(); }
      ctx.fillStyle = `rgba(60,0,0,${a * 0.6})`;
      ctx.fillRect(cx - r * 0.12, cy, r * 0.24, r * (1.5 + (1 - p.life / p.max) * 3));
    }
  };

  GR.update = function (dt) {
    if (!GR.on) return;
    const d = GR.d;
    // growing pools
    if (GR.growing.size) {
      for (const i of GR.growing) {
        d.s[i] = Math.min(d.target[i], d.s[i] + d.rate[i] * dt);
        if (d.s[i] >= d.target[i]) GR.growing.delete(i);
        writeDecal(i);
      }
    }
    // body parts
    const W = IF.B && IF.B.W; if (!W) return;
    let any = false;
    for (let i = 0; i < GR.g.length; i++) {
      const g = GR.g[i];
      if (!g) continue;
      g.life -= dt;
      if (g.life <= 0) { GR.g[i] = null; _m.makeScale(0, 0, 0); GR.gibMesh.setMatrixAt(i, _m); any = true; continue; }
      if (!g.rest) {
        g.vy -= 9.8 * dt;
        g.x += g.vx * dt; g.y += g.vy * dt; g.z += g.vz * dt;
        g.rx += g.wx * dt; g.ry += g.wy * dt; g.rz += g.wz * dt;
        const gy = W.groundAt(g.x, g.z) + g.sy * 0.5;
        if (g.y < gy) {
          g.y = gy;
          if (g.blood && !g.splatted) { g.splatted = true; GR.decal(g.x, g.z, U.rr(0.15, 0.35), 0, 0, undefined, 1.4); }
          if (Math.abs(g.vy) < 1.5) {
            // come to rest lying flat (long limbs lie down)
            g.rest = true; g.rz = 0;
            if (g.sy > Math.max(g.sx, g.sz)) { g.rx = Math.PI / 2; g.y = W.groundAt(g.x, g.z) + g.sz * 0.5; } else g.rx = 0;
          }
          g.vy = -g.vy * 0.25; g.vx *= 0.55; g.vz *= 0.55; g.wx *= 0.5; g.wy *= 0.5; g.wz *= 0.5;
        }
        if (g.blood) { g.trail -= dt; if (g.trail <= 0) { g.trail = 0.04; FX.smoke.emit(g.x, g.y, g.z, 0, 0, 0, 0.5, 0.08, 0.02, 0.45, 0.02, 0.02, 0.9, 0.3, 0.01, 0.01, 0.6, 0, 3); } }
      }
      _e.set(g.rx, g.ry, g.rz); _q.setFromEuler(_e);
      _p.set(g.x, g.y, g.z); _s.set(g.sx, g.sy, g.sz);
      const fade = g.life < 3 ? g.life / 3 : 1;
      _s.multiplyScalar(fade);
      _m.compose(_p, _q, _s);
      GR.gibMesh.setMatrixAt(i, _m);
      any = true;
    }
    if (any) GR.gibMesh.instanceMatrix.needsUpdate = true;
  };
})(typeof window !== 'undefined' ? window : globalThis);
