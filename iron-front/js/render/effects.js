// Particle effects (instanced billboards), tracers, explosions, smoke, fire, impacts, flares.
(function (G) {
  'use strict';
  const IF = G.IF, U = IF.U;
  const FX = IF.FX;

  function spriteTex(kind) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    if (kind === 'smoke') { g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.5, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); }
    else { g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)'); }
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    if (kind === 'smoke') {
      // break up the edge with soft noise
      x.globalCompositeOperation = 'destination-out';
      for (let k = 0; k < 30; k++) { x.fillStyle = 'rgba(0,0,0,0.12)'; x.beginPath(); x.arc(Math.random() * 64, Math.random() * 64, 4 + Math.random() * 9, 0, 7); x.fill(); }
    }
    const t = new THREE.CanvasTexture(c);
    return t;
  }

  function System(n, additive, tex) {
    this.n = n; this.count = 0;
    this.px = new Float32Array(n); this.py = new Float32Array(n); this.pz = new Float32Array(n);
    this.vx = new Float32Array(n); this.vy = new Float32Array(n); this.vz = new Float32Array(n);
    this.life = new Float32Array(n); this.max = new Float32Array(n); this.s0 = new Float32Array(n); this.s1 = new Float32Array(n);
    this.c0 = new Float32Array(n * 4); this.c1 = new Float32Array(n * 4); this.drag = new Float32Array(n); this.grav = new Float32Array(n); this.rot = new Float32Array(n);
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    this.aOff = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.InstancedBufferAttribute(new Float32Array(n * 2), 2).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('offset', this.aOff); geo.setAttribute('sizeRot', this.aSize); geo.setAttribute('pcolor', this.aCol);
    geo.instanceCount = 0;
    this.geo = geo;
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: tex }, fogColor: { value: new THREE.Color() }, fogNear: { value: 1 }, fogFar: { value: 1000 }, bright: { value: 1 } },
      vertexShader: [
        'attribute vec3 offset; attribute vec2 sizeRot; attribute vec4 pcolor; varying vec2 vUv; varying vec4 vCol; varying float vDepth;',
        'void main(){ vUv = uv; vCol = pcolor; vec4 mv = modelViewMatrix * vec4(offset,1.0);',
        ' float c = cos(sizeRot.y), s = sin(sizeRot.y); vec2 p = vec2(position.x*c - position.y*s, position.x*s + position.y*c) * sizeRot.x;',
        ' mv.xy += p; vDepth = -mv.z; gl_Position = projectionMatrix * mv; }'].join('\n'),
      fragmentShader: [
        'uniform sampler2D map; uniform vec3 fogColor; uniform float fogNear; uniform float fogFar; uniform float bright; varying vec2 vUv; varying vec4 vCol; varying float vDepth;',
        'void main(){ vec4 t = texture2D(map, vUv); float f = smoothstep(fogNear, fogFar, vDepth);',
        additive ? ' gl_FragColor = vec4(vCol.rgb * t.a * vCol.a * (1.0-f) * bright, 1.0);' : ' vec3 col = mix(vCol.rgb*bright, fogColor, f); gl_FragColor = vec4(col, t.a * vCol.a);',
        '}'].join('\n'),
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.mat = mat;
    this.mesh = new THREE.Mesh(geo, mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = additive ? 3 : 2;
    IF.R.scene.add(this.mesh);
  }
  System.prototype.emit = function (x, y, z, vx, vy, vz, life, s0, s1, r0, g0, b0, a0, r1, g1, b1, a1, drag, grav) {
    let i;
    if (this.count < this.n) i = this.count++;
    else { i = (this.cursor = ((this.cursor || 0) + 1) % this.n); }
    this.px[i] = x; this.py[i] = y; this.pz[i] = z; this.vx[i] = vx; this.vy[i] = vy; this.vz[i] = vz;
    this.life[i] = 0; this.max[i] = life; this.s0[i] = s0; this.s1[i] = s1;
    const c0 = this.c0, c1 = this.c1, k = i * 4;
    c0[k] = r0; c0[k + 1] = g0; c0[k + 2] = b0; c0[k + 3] = a0; c1[k] = r1; c1[k + 1] = g1; c1[k + 2] = b1; c1[k + 3] = a1;
    this.drag[i] = drag || 0; this.grav[i] = grav || 0; this.rot[i] = Math.random() * 6.28;
  };
  System.prototype.update = function (dt, bright) {
    const n = this.count;
    const off = this.aOff.array, sz = this.aSize.array, col = this.aCol.array;
    let w = 0;
    for (let i = 0; i < n; i++) {
      this.life[i] += dt;
      if (this.life[i] >= this.max[i]) continue;
      // compact in place
      if (w !== i) {
        this.px[w] = this.px[i]; this.py[w] = this.py[i]; this.pz[w] = this.pz[i]; this.vx[w] = this.vx[i]; this.vy[w] = this.vy[i]; this.vz[w] = this.vz[i];
        this.life[w] = this.life[i]; this.max[w] = this.max[i]; this.s0[w] = this.s0[i]; this.s1[w] = this.s1[i]; this.drag[w] = this.drag[i]; this.grav[w] = this.grav[i]; this.rot[w] = this.rot[i];
        for (let q = 0; q < 4; q++) { this.c0[w * 4 + q] = this.c0[i * 4 + q]; this.c1[w * 4 + q] = this.c1[i * 4 + q]; }
      }
      const dk = Math.max(0, 1 - this.drag[w] * dt);
      this.vx[w] *= dk; this.vy[w] = this.vy[w] * dk - this.grav[w] * dt; this.vz[w] *= dk;
      this.px[w] += this.vx[w] * dt; this.py[w] += this.vy[w] * dt; this.pz[w] += this.vz[w] * dt;
      const t = this.life[w] / this.max[w];
      off[w * 3] = this.px[w]; off[w * 3 + 1] = this.py[w]; off[w * 3 + 2] = this.pz[w];
      sz[w * 2] = this.s0[w] + (this.s1[w] - this.s0[w]) * Math.sqrt(t); sz[w * 2 + 1] = this.rot[w] + t * 0.6;
      const k = w * 4;
      col[k] = this.c0[k] + (this.c1[k] - this.c0[k]) * t; col[k + 1] = this.c0[k + 1] + (this.c1[k + 1] - this.c0[k + 1]) * t; col[k + 2] = this.c0[k + 2] + (this.c1[k + 2] - this.c0[k + 2]) * t;
      const fade = t < 0.1 ? t / 0.1 : 1;
      col[k + 3] = (this.c0[k + 3] + (this.c1[k + 3] - this.c0[k + 3]) * t) * fade;
      w++;
    }
    this.count = w;
    this.geo.instanceCount = w;
    this.aOff.needsUpdate = true; this.aSize.needsUpdate = true; this.aCol.needsUpdate = true;
    const f = IF.R.scene.fog;
    this.mat.uniforms.fogColor.value.copy(f.color); this.mat.uniforms.fogNear.value = f.near; this.mat.uniforms.fogFar.value = f.far;
    this.mat.uniforms.bright.value = bright;
  };

  FX.init = function () {
    const q = IF.R.q;
    FX.q = q.particles;
    FX.smoke = new System(Math.round(3200 * q.particles), false, spriteTex('smoke'));
    FX.glow = new System(Math.round(1800 * q.particles), true, spriteTex('glow'));
    // tracers
    const N = 500;
    FX.trN = N;
    FX.tr = { sx: new Float32Array(N), sy: new Float32Array(N), sz: new Float32Array(N), dx: new Float32Array(N), dy: new Float32Array(N), dz: new Float32Array(N), len: new Float32Array(N), t: new Float32Array(N), r: new Float32Array(N), g: new Float32Array(N), b: new Float32Array(N), on: new Uint8Array(N), w: new Float32Array(N) };
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 6), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * 6), 3).setUsage(THREE.DynamicDrawUsage));
    FX.trMesh = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    FX.trMesh.frustumCulled = false; FX.trMesh.renderOrder = 4;
    IF.R.scene.add(FX.trMesh);
    FX.trCursor = 0;
    FX.on = true;
  };
  FX.dispose = function () {
    if (!FX.on) return;
    for (const s of [FX.smoke, FX.glow]) { IF.R.scene.remove(s.mesh); s.geo.dispose(); s.mat.dispose(); }
    IF.R.scene.remove(FX.trMesh); FX.on = false;
  };
  const camNear = (x, z, r) => { const c = IF.R.camera.position; const dx = x - c.x, dz = z - c.z; return dx * dx + dz * dz < r * r; };
  const camD = (x, y, z) => { const c = IF.R.camera.position; return Math.sqrt((x - c.x) ** 2 + (y - c.y) ** 2 + (z - c.z) ** 2); };

  FX.tracer = function (x, y, z, x2, y2, z2, team, heavy) {
    if (!FX.on) return;
    const T = FX.tr, i = FX.trCursor = (FX.trCursor + 1) % FX.trN;
    let dx = x2 - x, dy = y2 - y, dz = z2 - z; const L = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    T.sx[i] = x; T.sy[i] = y; T.sz[i] = z; T.dx[i] = dx / L; T.dy[i] = dy / L; T.dz[i] = dz / L; T.len[i] = L; T.t[i] = 0; T.on[i] = 1;
    const c = IF.TEAMS[team >= 0 ? team : 0].tracer;
    const k = heavy ? 1 : 0.7;
    T.r[i] = c[0] * k; T.g[i] = c[1] * k; T.b[i] = c[2] * k; T.w[i] = heavy ? 9 : 6;
  };
  FX.muzzle = function (x, y, z, team, size) {
    if (!FX.on || !camNear(x, z, 450)) return;
    const s = size || 0.7;
    FX.glow.emit(x, y, z, 0, 0, 0, 0.06, s, s * 1.4, 1, 0.8, 0.45, 1, 1, 0.5, 0.2, 0);
    if (s > 2) { FX.smoke.emit(x, y, z, U.rr(-1, 1), 1, U.rr(-1, 1), 2.2, s, s * 3, 0.6, 0.58, 0.55, 0.5, 0.6, 0.6, 0.6, 0, 0.6, -0.3); IF.R.flash(x, y, z, 6, 0.12); }
  };
  FX.impact = function (x, y, z, kind) {
    if (!FX.on || !camNear(x, z, 300)) return;
    if (Math.random() > FX.q + 0.1) return;
    const W = IF.B && IF.B.W;
    const gt = W ? W.groundTypeAt(x, z) : 0;
    const dark = gt === IF.GROUND.MUD ? 0.55 : 0.85;
    FX.smoke.emit(x, y + 0.1, z, U.rr(-0.6, 0.6), U.rr(0.8, 2), U.rr(-0.6, 0.6), 0.8, 0.25, 1.1, 0.5 * dark, 0.45 * dark, 0.36 * dark, 0.7, 0.5, 0.47, 0.42, 0, 1.5, 1);
    if (kind === 1) for (let k = 0; k < 3; k++) FX.glow.emit(x, y, z, U.rr(-4, 4), U.rr(1, 5), U.rr(-4, 4), 0.2, 0.08, 0.04, 1, 0.8, 0.4, 1, 1, 0.4, 0.1, 0, 0, 9);
  };
  FX.blood = function (x, y, z) {
    if (!FX.on) return;
    for (let k = 0; k < 4; k++) FX.smoke.emit(x, y, z, U.rr(-1.2, 1.2), U.rr(0, 1.6), U.rr(-1.2, 1.2), 0.5, 0.12, 0.35, 0.42, 0.03, 0.03, 0.85, 0.25, 0.02, 0.02, 0, 1, 6);
  };
  FX.smokePuff = function (x, y, z, size, small, black) {
    if (!FX.on || !camNear(x, z, 650)) return;
    const s = size || 1;
    if (small === true) { FX.smoke.emit(x, y, z, U.rr(-0.3, 0.3), U.rr(0.2, 0.6), U.rr(-0.3, 0.3), 1.2, 0.4, 1.4, 0.75, 0.74, 0.72, 0.5, 0.8, 0.8, 0.8, 0, 1, -0.1); return; }
    const c = black ? 0.12 : 0.42;
    const wnd = IF.B ? IF.B.env.wind : 0;
    FX.smoke.emit(x + U.rr(-0.5, 0.5), y, z + U.rr(-0.5, 0.5), Math.cos(wnd) * 1.2 + U.rr(-0.4, 0.4), U.rr(1.6, 3), Math.sin(wnd) * 1.2 + U.rr(-0.4, 0.4), U.rr(4, 7), s, s * 4.5, c, c, c * 0.95, 0.65, c + 0.15, c + 0.15, c + 0.15, 0, 0.3, -0.15);
  };
  FX.fireAt = function (x, y, z, s) {
    if (!FX.on || !camNear(x, z, 650)) return;
    FX.glow.emit(x + U.rr(-0.6, 0.6) * s, y, z + U.rr(-0.6, 0.6) * s, U.rr(-0.3, 0.3), U.rr(1.5, 3.5), U.rr(-0.3, 0.3), U.rr(0.4, 0.8), 1.6 * s, 0.4 * s, 1, 0.55, 0.15, 0.9, 0.8, 0.15, 0.02, 0, 0.5, -1);
  };
  FX.dust = function (x, y, z, s) {
    if (!FX.on || !camNear(x, z, 500)) return;
    const n = Math.max(1, Math.round(s * 0.8 * FX.q));
    for (let k = 0; k < n; k++) FX.smoke.emit(x + U.rr(-s, s) * 0.5, y, z + U.rr(-s, s) * 0.5, U.rr(-1.5, 1.5), U.rr(0.3, 1.5), U.rr(-1.5, 1.5), U.rr(2, 4), s * 0.5, s * 1.6, 0.52, 0.46, 0.37, 0.55, 0.56, 0.52, 0.45, 0, 0.8, -0.05);
  };
  FX.debris = function (x, y, z, s) {
    if (!FX.on || !camNear(x, z, 700)) return;
    for (let k = 0; k < 18 * FX.q; k++) FX.smoke.emit(x, y, z, U.rr(-8, 8), U.rr(4, 14), U.rr(-8, 8), U.rr(1, 2.2), 0.4, 0.3, 0.25, 0.22, 0.2, 1, 0.2, 0.18, 0.16, 0.6, 0.2, 12);
  };
  FX.splash = function (x, y, z, r) {
    if (!FX.on || !camNear(x, z, 600)) return;
    for (let k = 0; k < 16 * FX.q; k++) FX.smoke.emit(x + U.rr(-1, 1) * r * 0.2, y, z + U.rr(-1, 1) * r * 0.2, U.rr(-2, 2), U.rr(6, 16), U.rr(-2, 2), U.rr(1.2, 2.2), r * 0.15, r * 0.5, 0.8, 0.85, 0.9, 0.9, 0.7, 0.75, 0.8, 0, 0.5, 10);
    { const dd = camD(x, y, z) / 8; IF.emit('shake', U.clamp(r * 0.06 / (1 + dd * dd), 0, 0.5)); }
  };
  FX.smokeScreen = function (x, y, z, r) {
    if (!FX.on) return;
    for (let k = 0; k < 26 * FX.q; k++) FX.smoke.emit(x + U.rr(-r, r) * 0.5, y + U.rr(0, 2), z + U.rr(-r, r) * 0.5, U.rr(-1, 1), U.rr(0.2, 0.8), U.rr(-1, 1), U.rr(22, 32), r * 0.5, r * 1.3, 0.8, 0.8, 0.82, 0.85, 0.85, 0.85, 0.86, 0, 0.25, -0.01);
  };
  FX.flare = function (x, y, z) {
    if (!FX.on) return;
    FX.glow.emit(x, y, z, 0, -2, 0, 40, 6, 4, 1, 0.95, 0.8, 1, 1, 0.7, 0.4, 0.6, 0, 0);
    IF.R.flare = new THREE.Vector3(x, y, z);
  };
  FX.explosion = function (x, y, z, r, kind) {
    if (!FX.on) return;
    const d = camD(x, y, z);
    // camera shake & flash light regardless of distance
    { const dd = d / (6 + r); IF.emit('shake', U.clamp(r * 0.08 / (1 + dd * dd), 0, 0.9)); }
    if (d < 400) IF.R.flash(x, y, z, Math.min(30, r * 3), 0.22 + r * 0.01);
    if (d > 1100) return;
    const q = FX.q * (d > 500 ? 0.4 : 1);
    const big = kind === 'bomb' || kind === 'arty' || kind === 'vehicle';
    const s = Math.max(1, r * 0.45);
    // flash
    FX.glow.emit(x, y + 0.5, z, 0, 0, 0, 0.18, s * 4, s * 7, 1, 0.85, 0.6, 1, 1, 0.4, 0.1, 0);
    // fireball
    for (let k = 0; k < 10 * q; k++) FX.glow.emit(x + U.rr(-s, s) * 0.5, y + U.rr(0, s), z + U.rr(-s, s) * 0.5, U.rr(-4, 4) * s * 0.4, U.rr(2, 7) * s * 0.4, U.rr(-4, 4) * s * 0.4, U.rr(0.35, 0.7), s * 2.2, s * 3.2, 1, 0.62, 0.22, 1, 0.6, 0.12, 0.02, 0, 2.5, -1);
    // sparks / fragments
    for (let k = 0; k < 14 * q; k++) FX.glow.emit(x, y + 0.4, z, U.rr(-20, 20), U.rr(5, 24), U.rr(-20, 20), U.rr(0.5, 1.4), 0.25, 0.15, 1, 0.75, 0.35, 1, 1, 0.3, 0.05, 0, 0.3, 18);
    // dirt column
    if (kind !== 'air') for (let k = 0; k < 10 * q; k++) FX.smoke.emit(x + U.rr(-1, 1), y, z + U.rr(-1, 1), U.rr(-3, 3), U.rr(6, 18) * (big ? 1.4 : 1), U.rr(-3, 3), U.rr(1.2, 2.4), s * 0.8, s * 2, 0.3, 0.25, 0.19, 0.95, 0.35, 0.3, 0.25, 0, 0.8, 11);
    // rolling smoke
    for (let k = 0; k < (big ? 14 : 8) * q; k++) FX.smoke.emit(x + U.rr(-s, s), y + U.rr(0, s), z + U.rr(-s, s), U.rr(-2, 2), U.rr(1.5, 4.5), U.rr(-2, 2), U.rr(5, 11), s * 1.5, s * 5, 0.16, 0.15, 0.14, 0.85, 0.4, 0.39, 0.37, 0, 0.5, -0.2);
    // ground dust ring
    for (let k = 0; k < 8 * q; k++) { const a = k / 8 * 6.28; FX.smoke.emit(x, y + 0.3, z, Math.cos(a) * 9 * s * 0.4, 0.6, Math.sin(a) * 9 * s * 0.4, U.rr(2.5, 4), s, s * 3.5, 0.5, 0.44, 0.36, 0.7, 0.55, 0.52, 0.46, 0, 1.8, 0); }
  };

  FX.update = function (dt) {
    if (!FX.on) return;
    const B = IF.B;
    const day = B ? U.clamp(IF.Battle.daylight(B) * 3 + 0.3, 0.15, 1) : 1;
    FX.smoke.update(dt, IF.Player && IF.Player.nvg ? 0.9 : day);
    FX.glow.update(dt, 1);
    // tracers
    const T = FX.tr, P = FX.trMesh.geometry.attributes.position.array, Cc = FX.trMesh.geometry.attributes.color.array;
    for (let i = 0; i < FX.trN; i++) {
      const k = i * 6;
      if (!T.on[i]) { P[k] = P[k + 3] = 0; P[k + 1] = P[k + 4] = -999; P[k + 2] = P[k + 5] = 0; continue; }
      T.t[i] += dt * 520;
      const a = Math.max(0, T.t[i] - T.w[i]), b = Math.min(T.len[i], T.t[i]);
      if (a >= T.len[i]) { T.on[i] = 0; continue; }
      P[k] = T.sx[i] + T.dx[i] * a; P[k + 1] = T.sy[i] + T.dy[i] * a; P[k + 2] = T.sz[i] + T.dz[i] * a;
      P[k + 3] = T.sx[i] + T.dx[i] * b; P[k + 4] = T.sy[i] + T.dy[i] * b; P[k + 5] = T.sz[i] + T.dz[i] * b;
      Cc[k] = T.r[i] * 0.3; Cc[k + 1] = T.g[i] * 0.3; Cc[k + 2] = T.b[i] * 0.3;
      Cc[k + 3] = T.r[i]; Cc[k + 4] = T.g[i]; Cc[k + 5] = T.b[i];
    }
    FX.trMesh.geometry.attributes.position.needsUpdate = true;
    FX.trMesh.geometry.attributes.color.needsUpdate = true;
  };
})(typeof window !== 'undefined' ? window : globalThis);
