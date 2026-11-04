// Renderer, camera, lighting, sky, clouds, rain, day/night cycle and weather visuals.
(function (G) {
  'use strict';
  const IF = G.IF, U = IF.U;
  const R = (IF.R = { ready: false });

  const QUALITY = {
    low: { scale: 0.65, shadows: false, far: 800, shadowSize: 0, particles: 0.5, near: 55, maxNear: 80, antialias: false },
    medium: { scale: 0.9, shadows: true, far: 1150, shadowSize: 1024, particles: 0.8, near: 70, maxNear: 120, antialias: false },
    high: { scale: 1.25, shadows: true, far: 1600, shadowSize: 2048, particles: 1, near: 85, maxNear: 160, antialias: true },
  };
  IF.QUALITY = QUALITY;

  R.init = function (canvas) {
    const q = (R.q = QUALITY[IF.Profile.settings.graphics] || QUALITY.medium);
    const renderer = (R.renderer = new THREE.WebGLRenderer({ canvas, antialias: q.antialias, powerPreference: 'high-performance', stencil: false }));
    renderer.setPixelRatio(Math.min(G.devicePixelRatio || 1, 2) * q.scale > 1.5 ? 1.5 : Math.min(G.devicePixelRatio || 1, 2) * q.scale);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = q.shadows;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.autoClear = false;
    R.scene = new THREE.Scene();
    R.camera = new THREE.PerspectiveCamera(IF.Profile.settings.fov || 75, 1, 0.1, q.far + 400);
    R.scene.add(R.camera);
    R.scene.fog = new THREE.Fog(0x9aa8b4, 120, q.far);
    // lights
    R.hemi = new THREE.HemisphereLight(0xbfd4ff, 0x4a4430, 1.2);
    R.scene.add(R.hemi);
    R.sun = new THREE.DirectionalLight(0xfff2dd, 2.6);
    R.sun.castShadow = q.shadows;
    if (q.shadows) {
      R.sun.shadow.mapSize.set(q.shadowSize, q.shadowSize);
      const s = q.shadowSize > 1024 ? 110 : 75;
      Object.assign(R.sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 600 });
      R.sun.shadow.bias = -0.0006; R.sun.shadow.normalBias = 0.04;
    }
    R.scene.add(R.sun); R.scene.add(R.sun.target);
    // flash lights for explosions (fixed count avoids shader recompiles)
    R.flashLights = [];
    for (let k = 0; k < 3; k++) { const l = new THREE.PointLight(0xffaa55, 0, 60, 2); R.scene.add(l); R.flashLights.push({ l, t: 0, max: 0 }); }
    R.flareLight = new THREE.PointLight(0xfff0d0, 0, 500, 1.3); R.scene.add(R.flareLight);
    R.buildSky();
    R.buildRain();
    IF.GEO.init();
    R.ready = true;
    R.resize();
    G.addEventListener('resize', R.resize);
  };

  R.resize = function () {
    if (!R.renderer) return;
    const w = G.innerWidth, h = G.innerHeight;
    R.renderer.setSize(w, h, false);
    R.camera.aspect = w / h; R.camera.updateProjectionMatrix();
    if (R.vmCamera) { R.vmCamera.aspect = w / h; R.vmCamera.updateProjectionMatrix(); }
  };

  R.buildSky = function () {
    const geo = new THREE.SphereGeometry(1, 24, 14);
    R.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(0x4f7fc0) }, horizon: { value: new THREE.Color(0xb8c8d8) }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color(0xffeebb) }, night: { value: 0 }, cloud: { value: 0 } },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix*vec4(position,1.0); gl_Position = projectionMatrix*p; gl_Position.z = gl_Position.w*0.99999; }',
      fragmentShader: [
        'uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 sunCol; uniform float night; uniform float cloud; varying vec3 vDir;',
        'void main(){ float h = clamp(vDir.y,-0.2,1.0); vec3 c = mix(horizon, top, pow(max(h,0.0),0.55));',
        ' if (h<0.0) c = mix(horizon, horizon*0.6, -h*4.0);',
        ' float s = max(dot(normalize(vDir), sunDir),0.0); c += sunCol * (pow(s,600.0)*3.0*(1.0-cloud*0.8) + pow(s,8.0)*0.25);',
        ' gl_FragColor = vec4(c,1.0); }'].join('\n'),
    });
    R.sky = new THREE.Mesh(geo, R.skyMat);
    R.sky.scale.setScalar(1900); R.sky.renderOrder = -10; R.sky.frustumCulled = false;
    R.scene.add(R.sky);
    // stars
    const sp = [];
    for (let i = 0; i < 1500; i++) { const v = new THREE.Vector3(U.gauss(), Math.abs(U.gauss()) + 0.05, U.gauss()).normalize().multiplyScalar(1800); sp.push(v.x, v.y, v.z); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    R.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    R.stars.frustumCulled = false;
    R.scene.add(R.stars);
    // moon
    R.moon = new THREE.Mesh(new THREE.SphereGeometry(30, 12, 8), new THREE.MeshBasicMaterial({ color: 0xdde4ff, fog: false, transparent: true }));
    R.scene.add(R.moon);
    // cloud layer
    const cv = document.createElement('canvas'); cv.width = cv.height = 256;
    const cx = cv.getContext('2d');
    const n = U.makeNoise(77);
    const img = cx.createImageData(256, 256);
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
      // tileable-ish noise via wrapping coordinates on a torus
      const a = x / 256 * Math.PI * 2, b = y / 256 * Math.PI * 2;
      const v = n.fbm(Math.cos(a) * 2 + 10, Math.sin(a) * 2 + Math.cos(b) * 2 + 20, 5) + n.fbm(Math.sin(b) * 2 + 40, Math.cos(b) * 2, 4) * 0.5;
      const k = (y * 256 + x) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = 255;
      img.data[k + 3] = Math.max(0, Math.min(255, (v + 0.1) * 420));
    }
    cx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(cv); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(5, 5);
    R.cloudMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.6, depthWrite: false, fog: false, color: 0xffffff });
    R.clouds = new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000), R.cloudMat);
    R.clouds.rotation.x = Math.PI / 2; R.clouds.position.y = 650; R.clouds.renderOrder = -5;
    R.scene.add(R.clouds);
  };

  R.buildRain = function () {
    const N = 2600;
    const pos = new Float32Array(N * 6);
    R.rainData = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { R.rainData[i * 3] = U.rr(-50, 50); R.rainData[i * 3 + 1] = U.rr(0, 40); R.rainData[i * 3 + 2] = U.rr(-50, 50); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    R.rain = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xaabbcc, transparent: true, opacity: 0.35, fog: false, depthWrite: false }));
    R.rain.frustumCulled = false; R.rain.visible = false;
    R.scene.add(R.rain);
  };

  const tmpC = new THREE.Color(), tmpC2 = new THREE.Color();
  R.updateEnv = function (B, dt) {
    const env = B.env, cam = R.camera;
    const h = env.hour;
    const el = IF.Battle.daylight(B);
    const az = (h / 24) * Math.PI * 2 - Math.PI / 2;
    const sunDir = new THREE.Vector3(Math.cos(az) * Math.cos(Math.asin(U.clamp(el, -1, 1))), el, Math.sin(az) * 0.4).normalize();
    R.sunDir = sunDir;
    const day = U.clamp(el * 3 + 0.25, 0, 1);            // 0 night .. 1 day
    const golden = U.clamp(1 - Math.abs(el) * 4, 0, 1) * (el > -0.15 ? 1 : 0);
    const cloud = env.cloud, fog = env.fog, rain = env.rain;
    // sky colours
    const top = tmpC.setRGB(0.18, 0.36, 0.72).lerp(tmpC2.setRGB(0.42, 0.45, 0.5), cloud * 0.85);
    top.multiplyScalar(0.06 + day * 0.94);
    const hor = new THREE.Color(0.72, 0.78, 0.84).lerp(new THREE.Color(0.95, 0.6, 0.35), golden * 0.7 * (1 - cloud * 0.6)).lerp(new THREE.Color(0.62, 0.64, 0.66), cloud * 0.6 + fog * 0.3);
    hor.multiplyScalar(0.05 + day * 0.95);
    if (night(B) > 0.5 && B.flareT > B.time) hor.add(new THREE.Color(0.08, 0.07, 0.05));
    R.skyMat.uniforms.top.value.copy(top);
    R.skyMat.uniforms.horizon.value.copy(hor);
    R.skyMat.uniforms.sunDir.value.copy(sunDir);
    R.skyMat.uniforms.sunCol.value.setRGB(1, 0.85 - golden * 0.3, 0.6 - golden * 0.35).multiplyScalar(day);
    R.skyMat.uniforms.cloud.value = cloud;
    R.sky.position.copy(cam.position);
    R.stars.position.copy(cam.position);
    R.stars.material.opacity = U.clamp((1 - day) * (1 - cloud), 0, 1);
    const moonDir = sunDir.clone().negate(); moonDir.y = Math.abs(moonDir.y) * 0.8 + 0.25; moonDir.normalize();
    R.moon.position.copy(cam.position).addScaledVector(moonDir, 1700);
    R.moon.material.opacity = (1 - day) * (1 - cloud * 0.8);
    // lights
    const lightning = env.lightning;
    const nvg = IF.Player && IF.Player.nvg;
    if (el > -0.05) {
      R.sun.color.setRGB(1, 0.92 - golden * 0.35, 0.82 - golden * 0.5);
      R.sun.intensity = U.clamp(el * 6, 0, 1) * 2.8 * (1 - cloud * 0.6) * (1 - fog * 0.3);
      R.sun.position.copy(sunDir).multiplyScalar(300);
    } else {
      R.sun.color.setRGB(0.6, 0.7, 1.0);
      R.sun.intensity = 0.32 * (1 - cloud * 0.7);
      R.sun.position.copy(moonDir).multiplyScalar(300);
    }
    R.hemi.intensity = (0.16 + day * 1.05) * (1 - cloud * 0.15) + lightning * 2.5;
    R.hemi.color.setRGB(0.72, 0.8, 1.0).lerp(tmpC.setRGB(0.75, 0.75, 0.75), cloud);
    R.hemi.groundColor.setRGB(0.32, 0.28, 0.2).multiplyScalar(0.5 + day * 0.5);
    // shadows follow the camera
    R.sun.target.position.set(cam.position.x, 0, cam.position.z);
    R.sun.position.add(R.sun.target.position);
    // fog
    const fogC = hor.clone().lerp(new THREE.Color(0.55, 0.57, 0.6).multiplyScalar(0.1 + day * 0.9), fog * 0.7);
    if (nvg) fogC.setRGB(0.05, 0.12, 0.05);
    R.scene.fog.color.copy(fogC);
    const far = R.q.far * (1 - fog * 0.72) * (1 - rain * 0.3) * (1 - (1 - day) * 0.25);
    R.scene.fog.far = far; R.scene.fog.near = Math.max(10, far * 0.08);
    R.renderer.toneMappingExposure = nvg ? 3.2 : 1.0 + (1 - day) * 0.6;
    // clouds
    R.cloudMat.opacity = U.clamp(cloud * 0.9 + 0.05, 0, 0.95);
    R.cloudMat.color.setRGB(1, 1, 1).multiplyScalar(0.08 + day * 0.85).lerp(tmpC.setRGB(0.4, 0.4, 0.42).multiplyScalar(0.1 + day * 0.8), cloud * 0.6);
    R.cloudMat.map.offset.x += dt * 0.0012 * Math.cos(env.wind); R.cloudMat.map.offset.y += dt * 0.0012 * Math.sin(env.wind);
    R.clouds.position.x = cam.position.x * 0.8; R.clouds.position.z = cam.position.z * 0.8;
    // rain
    R.rain.visible = rain > 0.05;
    if (R.rain.visible) {
      const P = R.rain.geometry.attributes.position.array, D = R.rainData;
      const n = Math.floor((D.length / 3) * U.clamp(rain, 0, 1));
      const wx = Math.cos(env.wind) * 3, wz = Math.sin(env.wind) * 3;
      for (let i = 0; i < D.length / 3; i++) {
        let y = D[i * 3 + 1] - dt * 24;
        if (y < -5) y += 45;
        D[i * 3 + 1] = y;
        const x = cam.position.x + D[i * 3], z = cam.position.z + D[i * 3 + 2], yy = cam.position.y + y - 15;
        const k = i * 6;
        if (i < n) { P[k] = x; P[k + 1] = yy; P[k + 2] = z; P[k + 3] = x + wx * 0.05; P[k + 4] = yy - 0.9; P[k + 5] = z + wz * 0.05; }
        else { P[k] = P[k + 3] = x; P[k + 1] = P[k + 4] = -500; P[k + 2] = P[k + 5] = z; }
      }
      R.rain.geometry.attributes.position.needsUpdate = true;
      R.rain.material.opacity = 0.25 + day * 0.2;
    }
    // explosion flash lights
    for (const f of R.flashLights) { if (f.t > 0) { f.t -= dt; f.l.intensity = Math.max(0, f.t / f.dur) * f.max; } else f.l.intensity = 0; }
    if (B.flareT > B.time && R.flare) { R.flareLight.position.copy(R.flare); R.flareLight.intensity = 9 * U.clamp((B.flareT - B.time) / 10, 0, 1); R.flare.y -= dt * 2; }
    else R.flareLight.intensity = 0;
  };
  function night(B) { return B.night || 0; }
  R.flash = function (x, y, z, power, dur) {
    let best = R.flashLights[0];
    for (const f of R.flashLights) if (f.t <= 0) { best = f; break; }
    best.l.position.set(x, y + 2, z); best.t = dur || 0.25; best.dur = best.t; best.max = power; best.l.distance = 25 + power * 6;
  };
})(typeof window !== 'undefined' ? window : globalThis);
