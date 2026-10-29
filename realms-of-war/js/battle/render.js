// Three.js presentation of a battle: terrain, scenery, instanced soldiers, missiles and effects.
(function () {
  const RW = window.RW;
  const T = THREE;
  const U = RW.util;
  const M = RW.models;

  // Write a yaw (around Y) then pitch (around X) rotation + translation + uniform scale into a matrix array.
  function writeMatrix(arr, o, x, y, z, yaw, pitch, scale, roll = 0) {
    const c = Math.cos(yaw), s = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    if (roll) {
      // yaw * roll(Z) for creatures falling on their side
      const cr = Math.cos(roll), sr = Math.sin(roll);
      arr[o] = c * cr * scale; arr[o + 1] = sr * scale; arr[o + 2] = -s * cr * scale; arr[o + 3] = 0;
      arr[o + 4] = -c * sr * scale; arr[o + 5] = cr * scale; arr[o + 6] = s * sr * scale; arr[o + 7] = 0;
      arr[o + 8] = s * scale; arr[o + 9] = 0; arr[o + 10] = c * scale; arr[o + 11] = 0;
    } else {
      arr[o] = c * scale; arr[o + 1] = 0; arr[o + 2] = -s * scale; arr[o + 3] = 0;
      arr[o + 4] = s * sp * scale; arr[o + 5] = cp * scale; arr[o + 6] = c * sp * scale; arr[o + 7] = 0;
      arr[o + 8] = s * cp * scale; arr[o + 9] = -sp * scale; arr[o + 10] = c * cp * scale; arr[o + 11] = 0;
    }
    arr[o + 12] = x; arr[o + 13] = y; arr[o + 14] = z; arr[o + 15] = 1;
  }
  RW.writeMatrix = writeMatrix;

  // ---------------------------------------------------------------- particles
  const PVS = `attribute float size; attribute float alpha; attribute vec3 pcolor; varying float vA; varying vec3 vC;
    void main(){ vA = alpha; vC = pcolor; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * (300.0 / -mv.z); gl_Position = projectionMatrix * mv; }`;
  const PFS = `varying float vA; varying vec3 vC; void main(){ vec2 d = gl_PointCoord - 0.5; float r = dot(d,d); if (r > 0.25) discard; gl_FragColor = vec4(vC, vA * (1.0 - r * 4.0)); }`;

  class Particles {
    constructor(scene, cap, additive) {
      this.cap = cap; this.n = 0;
      this.p = new Float32Array(cap * 3); this.v = new Float32Array(cap * 3); this.c = new Float32Array(cap * 3);
      this.life = new Float32Array(cap); this.max = new Float32Array(cap); this.size0 = new Float32Array(cap); this.grav = new Float32Array(cap); this.a0 = new Float32Array(cap);
      this.size = new Float32Array(cap); this.alpha = new Float32Array(cap);
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.BufferAttribute(this.p, 3));
      g.setAttribute('pcolor', new T.BufferAttribute(this.c, 3));
      g.setAttribute('size', new T.BufferAttribute(this.size, 1));
      g.setAttribute('alpha', new T.BufferAttribute(this.alpha, 1));
      const m = new T.ShaderMaterial({ vertexShader: PVS, fragmentShader: PFS, transparent: true, depthWrite: false, blending: additive ? T.AdditiveBlending : T.NormalBlending });
      this.points = new T.Points(g, m);
      this.points.frustumCulled = false;
      this.geo = g;
      scene.add(this.points);
    }
    emit(x, y, z, vx, vy, vz, life, size, color, grav = 0, alpha = 1) {
      if (this.n >= this.cap) return;
      const i = this.n++;
      this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z;
      this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz;
      this.c[i * 3] = color.r; this.c[i * 3 + 1] = color.g; this.c[i * 3 + 2] = color.b;
      this.life[i] = life; this.max[i] = life; this.size0[i] = size; this.grav[i] = grav; this.a0[i] = alpha;
    }
    update(dt) {
      let i = 0;
      while (i < this.n) {
        this.life[i] -= dt;
        if (this.life[i] <= 0) {
          // swap-remove
          const j = --this.n;
          for (let k = 0; k < 3; k++) { this.p[i * 3 + k] = this.p[j * 3 + k]; this.v[i * 3 + k] = this.v[j * 3 + k]; this.c[i * 3 + k] = this.c[j * 3 + k]; }
          this.life[i] = this.life[j]; this.max[i] = this.max[j]; this.size0[i] = this.size0[j]; this.grav[i] = this.grav[j]; this.a0[i] = this.a0[j];
          continue;
        }
        this.v[i * 3 + 1] -= this.grav[i] * dt;
        this.p[i * 3] += this.v[i * 3] * dt; this.p[i * 3 + 1] += this.v[i * 3 + 1] * dt; this.p[i * 3 + 2] += this.v[i * 3 + 2] * dt;
        const t = this.life[i] / this.max[i];
        this.alpha[i] = this.a0[i] * Math.min(1, t * 2);
        this.size[i] = this.size0[i] * (1.4 - t * 0.6);
        i++;
      }
      this.geo.setDrawRange(0, this.n);
      this.geo.attributes.position.needsUpdate = true;
      this.geo.attributes.pcolor.needsUpdate = true;
      this.geo.attributes.size.needsUpdate = true;
      this.geo.attributes.alpha.needsUpdate = true;
    }
    dispose() { this.geo.dispose(); this.points.material.dispose(); }
  }
  RW.Particles = Particles;

  // ---------------------------------------------------------------- renderer
  class BattleRenderer {
    constructor(battle) {
      this.b = battle;
      this.q = RW.quality();
      const scene = (this.scene = new T.Scene());
      const skyCol = new T.Color(battle.cfg.mapType === 'siege' ? '#9fb3c4' : '#a9c3d6');
      scene.background = skyCol;
      scene.fog = new T.Fog(skyCol, 180, 560);
      this.disposables = [];

      // Lights
      const hemi = new T.HemisphereLight('#dfeaff', '#4a5a30', 0.75);
      scene.add(hemi);
      const sun = (this.sun = new T.DirectionalLight('#fff1d6', 1.25));
      sun.position.set(80, 140, 60);
      if (this.q.shadows) {
        sun.castShadow = true;
        sun.shadow.mapSize.set(this.q.shadowSize, this.q.shadowSize);
        const c = sun.shadow.camera; c.left = -140; c.right = 140; c.top = 140; c.bottom = -140; c.near = 10; c.far = 420;
        sun.shadow.bias = -0.0008;
      }
      scene.add(sun); scene.add(sun.target);
      this.buildSky();
      this.buildTerrain();
      this.buildScenery();
      this.buildUnits();
      this.buildFx();
    }

    track(o) { this.disposables.push(o); return o; }

    buildSky() {
      const g = this.track(new T.SphereGeometry(700, 16, 10));
      const col = [];
      const pos = g.attributes.position;
      const top = new T.Color('#5d86b8'), hor = new T.Color('#cfdce6'), c = new T.Color();
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i) / 700;
        c.copy(hor).lerp(top, U.clamp(y * 1.6, 0, 1));
        col.push(c.r, c.g, c.b);
      }
      g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
      const m = this.track(new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide, fog: false, depthWrite: false }));
      const sky = new T.Mesh(g, m);
      sky.renderOrder = -1;
      this.scene.add(sky);
    }

    buildTerrain() {
      const map = this.b.map, F = RW.MAPF;
      // The mesh extends past the playable area and rises into hills, framing the battlefield.
      const SIZE = 520;
      const res = Math.round(this.q.terrainRes * SIZE / map.size * 0.75);
      const g = this.track(new T.PlaneGeometry(SIZE, SIZE, res, res));
      g.rotateX(-Math.PI / 2);
      const pos = g.attributes.position;
      const col = new Float32Array(pos.count * 3);
      const noise = U.makeNoise(map.seed + 3);
      const c = new T.Color();
      const grassA = new T.Color('#6f9a45'), grassB = new T.Color('#557d35'), dry = new T.Color('#a29a5a'), rock = new T.Color('#85817a'),
        forest = new T.Color('#3d5b2a'), mud = new T.Color('#6e5f43'), sand = new T.Color('#b5a477'), dirt = new T.Color('#8a7a5a'), road = new T.Color('#9b8b68');
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i);
        const out = Math.max(Math.abs(x), Math.abs(z)) - map.half;
        let h = map.heightAt(x, z);
        if (out > -4) {
          const k = U.clamp((out + 4) / 60, 0, 1);
          h += k * k * (3 - 2 * k) * (16 + noise(x * 0.02 + 5, z * 0.02) * 22);
        }
        pos.setY(i, h);
        const n = noise(x * 0.05, z * 0.05, 2);
        c.copy(grassA).lerp(grassB, n);
        if (h > 6) c.lerp(dry, U.clamp((h - 6) / 10, 0, 0.6));
        const f = map.flagAt(x, z);
        if (f & F.FOREST) c.lerp(forest, 0.7);
        // Slope from neighbours
        const sl = Math.abs(map.heightAt(x + 1.5, z) - map.heightAt(x - 1.5, z)) + Math.abs(map.heightAt(x, z + 1.5) - map.heightAt(x, z - 1.5));
        if (sl > 2.2) c.lerp(rock, U.clamp((sl - 2.2) / 2, 0, 1));
        if (map.riverZ && out < 0) {
          const dz = Math.abs(z - map.riverZ(x));
          if (dz < 12) c.lerp(h < map.waterLevel ? mud : sand, U.clamp((12 - dz) / 4, 0, 0.85));
        }
        if (out > 10) c.lerp(dry, U.clamp((out - 10) / 60, 0, 0.35));
        if (f & F.ROAD) c.lerp(road, 0.7);
        if (map.type === 'siege' && z < map.wallZ) c.lerp(dirt, 0.5);
        col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      }
      g.setAttribute('color', new T.BufferAttribute(col, 3));
      g.computeVertexNormals();
      const m = this.track(new T.MeshLambertMaterial({ vertexColors: true }));
      const mesh = (this.terrain = new T.Mesh(g, m));
      mesh.receiveShadow = this.q.shadows;
      this.scene.add(mesh);
      // Skirt beyond the battlefield so the edge doesn't float in the void.
      const sg = this.track(new T.RingGeometry(250, 1000, 48, 1));
      sg.rotateX(-Math.PI / 2);
      const skirt = new T.Mesh(sg, this.track(new T.MeshLambertMaterial({ color: '#66803f' })));
      skirt.position.y = 14;
      this.scene.add(skirt);
      if (map.waterLevel != null) {
        const wg = this.track(new T.PlaneGeometry(map.size, 60, 1, 1));
        wg.rotateX(-Math.PI / 2);
        const wm = this.track(new T.MeshPhongMaterial({ color: '#3f78a8', transparent: true, opacity: 0.78, shininess: 80, specular: '#bcd' }));
        const water = new T.Mesh(wg, wm);
        // Follow the river: build a strip of tiles along x.
        this.scene.remove(water);
        const strip = new T.Group();
        for (let x = -map.half; x < map.half; x += 8) {
          let sumZ = 0, n = 0;
          for (let z = -30; z <= 30; z += 1) { if (map.heightAt(x + 4, z) < map.waterLevel) { sumZ += z; n++; } }
          if (!n) continue;
          const tile = new T.Mesh(wg, wm);
          tile.scale.set(8.4 / map.size, 1, 0.55);
          tile.position.set(x + 4, map.waterLevel, sumZ / n);
          strip.add(tile);
        }
        this.water = strip;
        this.scene.add(strip);
      }
    }

    buildScenery() {
      const map = this.b.map;
      const shadows = this.q.shadows;
      const instanced = (geo, items, fn, cast = true) => {
        if (!items.length) return null;
        const mat = this.track(new T.MeshLambertMaterial({ vertexColors: true }));
        const im = new T.InstancedMesh(geo, mat, items.length);
        this.track(geo);
        items.forEach((it, i) => { const m = fn(it); im.setMatrixAt(i, m); });
        im.instanceMatrix.needsUpdate = true;
        im.castShadow = shadows && cast; im.receiveShadow = shadows;
        this.scene.add(im);
        return im;
      };
      const mtx = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), v = new T.Vector3(), s = new T.Vector3();
      const place = (x, z, rot, sc, sink = 0.2) => { e.set(0, rot, 0); q.setFromEuler(e); v.set(x, map.heightAt(x, z) - sink, z); s.set(sc, sc, sc); return mtx.compose(v, q, s).clone(); };
      for (const kind of ['pine', 'oak']) {
        instanced(M.treeGeometry(kind), map.trees.filter((t) => t.kind === kind), (t) => place(t.x, t.z, t.r, t.s));
      }
      instanced(M.rockGeometry(), map.rocks, (r) => place(r.x, r.z, r.r, r.s * 1.6, 0.4));
      instanced(M.houseGeometry(), map.houses, (h) => place(h.x, h.z, h.rot, 1, 0.3));
      if (map.bridge) {
        const b = new M.Builder();
        const br = map.bridge, len = br.z1 - br.z0;
        b.add(M.PRIM.box, '#7a5532', 0, 0, 0, 0, 0, 0, 8.5, 0.5, len);
        b.add(M.PRIM.box, '#5a3f28', -4, 0.7, 0, 0, 0, 0, 0.3, 1, len);
        b.add(M.PRIM.box, '#5a3f28', 4, 0.7, 0, 0, 0, 0, 0.3, 1, len);
        for (let k = 0; k < 5; k++) b.add(M.PRIM.box, '#6b5b4a', 0, -1.5, -len / 2 + (k + 0.5) * (len / 5), 0, 0, 0, 7, 3, 1);
        const mesh = new T.Mesh(this.track(b.build()), this.track(new T.MeshLambertMaterial({ vertexColors: true })));
        mesh.position.set(br.x, 0.55, (br.z0 + br.z1) / 2);
        mesh.castShadow = shadows; mesh.receiveShadow = shadows;
        this.scene.add(mesh);
      }
      if (map.walls.length) {
        const b = new M.Builder();
        const stone = '#a39b88', dark = '#7d7666';
        for (const w of map.walls) {
          for (let x = w.x0; x < w.x1; x += 4) {
            const cx = Math.min(x + 2, w.x1 - 0.1);
            const h = map.heightAt(cx, w.z);
            b.add(M.PRIM.box, stone, cx, h + 2.5, w.z, 0, 0, 0, 4.05, 10, 4.5);
            b.add(M.PRIM.box, dark, cx - 1, h + 8, w.z + 1.8, 0, 0, 0, 1.3, 1.2, 1);
          }
        }
        for (const tw of map.towers) {
          const h = map.heightAt(tw.x, tw.z);
          b.add(M.PRIM.cyl, stone, tw.x, h + 5, tw.z, 0, 0, 0, 7, 14, 7);
          b.add(M.PRIM.cyl, dark, tw.x, h + 12.5, tw.z, 0, 0, 0, 8, 1.2, 8);
          b.add(M.PRIM.cone, '#7a3a2a', tw.x, h + 15, tw.z, 0, 0, 0, 8.5, 4, 8.5);
        }
        // Gatehouse arch
        const g = map.gate, gh = map.heightAt(g.x, g.z);
        b.add(M.PRIM.box, stone, g.x - 7, gh + 5, g.z, 0, 0, 0, 4, 14, 6);
        b.add(M.PRIM.box, stone, g.x + 7, gh + 5, g.z, 0, 0, 0, 4, 14, 6);
        b.add(M.PRIM.box, stone, g.x, gh + 10.5, g.z, 0, 0, 0, 18, 3, 6);
        const wallMesh = new T.Mesh(this.track(b.build()), this.track(new T.MeshLambertMaterial({ vertexColors: true })));
        wallMesh.castShadow = shadows; wallMesh.receiveShadow = shadows;
        this.scene.add(wallMesh);
        const gb = new M.Builder();
        gb.add(M.PRIM.box, '#5a3c22', 0, 4, 0, 0, 0, 0, 10.2, 8, 1.2);
        for (let k = -2; k <= 2; k++) gb.add(M.PRIM.box, '#3a2a1c', k * 2, 4, 0.65, 0, 0, 0, 0.3, 8, 0.2);
        gb.add(M.PRIM.box, '#555', 0, 5.5, 0.7, 0, 0, 0, 10, 0.4, 0.2);
        gb.add(M.PRIM.box, '#555', 0, 2.5, 0.7, 0, 0, 0, 10, 0.4, 0.2);
        this.gateMesh = new T.Mesh(this.track(gb.build()), this.track(new T.MeshLambertMaterial({ vertexColors: true })));
        this.gateMesh.position.set(g.x, gh - 0.5, g.z);
        this.gateMesh.castShadow = shadows;
        this.scene.add(this.gateMesh);
      }
      // Deployment zone outline
      const zn = map.deployZone(this.b.sideNorth[0]);
      const pts = [];
      const edge = (x0, z0, x1, z1) => { const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 3); for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, z = z0 + (z1 - z0) * i / n; pts.push(new T.Vector3(x, map.heightAt(x, z) + 0.4, z)); } };
      edge(zn.x0, zn.z0, zn.x1, zn.z0); edge(zn.x1, zn.z0, zn.x1, zn.z1); edge(zn.x1, zn.z1, zn.x0, zn.z1); edge(zn.x0, zn.z1, zn.x0, zn.z0);
      const lg = this.track(new T.BufferGeometry().setFromPoints(pts));
      this.deployLine = new T.Line(lg, this.track(new T.LineBasicMaterial({ color: '#ffd76a', transparent: true, opacity: 0.9 })));
      this.scene.add(this.deployLine);
      const fill = this.track(new T.PlaneGeometry(zn.x1 - zn.x0, zn.z1 - zn.z0));
      fill.rotateX(-Math.PI / 2);
      this.deployFill = new T.Mesh(fill, this.track(new T.MeshBasicMaterial({ color: '#ffd76a', transparent: true, opacity: 0.08, depthWrite: false })));
      this.deployFill.position.set((zn.x0 + zn.x1) / 2, 6, (zn.z0 + zn.z1) / 2);
      this.scene.add(this.deployFill);
    }

    buildUnits() {
      const groups = new Map();
      for (const u of this.b.units) {
        const key = u.typeId + '|' + u.faction;
        if (!groups.has(key)) groups.set(key, { key, typeId: u.typeId, faction: u.faction, units: [], cap: 0 });
        const g = groups.get(key);
        g.units.push(u); g.cap += u.count;
      }
      this.groups = [];
      let totalSoldiers = 0;
      for (const g of groups.values()) {
        const geo = M.unitGeometry(g.typeId, g.faction);
        const mat = this.track(new T.MeshLambertMaterial({ vertexColors: true }));
        const im = new T.InstancedMesh(geo, mat, g.cap);
        im.instanceMatrix.setUsage(T.DynamicDrawUsage);
        im.castShadow = this.q.shadows;
        im.frustumCulled = false;
        const white = new T.Color(1, 1, 1);
        for (let i = 0; i < g.cap; i++) im.setColorAt(i, white);
        let off = 0;
        for (const u of g.units) { u.r = { mesh: im, off, group: g }; off += u.count; }
        g.mesh = im;
        this.scene.add(im);
        this.groups.push(g);
        totalSoldiers += g.cap;
      }
      // Selection discs under soldiers
      const disc = this.track(new T.CircleGeometry(0.6, 10));
      disc.rotateX(-Math.PI / 2);
      this.markers = new T.InstancedMesh(disc, this.track(new T.MeshBasicMaterial({ transparent: true, opacity: 0.85, depthWrite: false })), totalSoldiers + 10);
      this.markers.frustumCulled = false; this.markers.renderOrder = 2;
      this.markers.setColorAt(0, new T.Color(1, 1, 1));
      this.scene.add(this.markers);
      // Ghost formation preview (right-drag)
      this.ghost = new T.InstancedMesh(disc, this.track(new T.MeshBasicMaterial({ color: '#9effa8', transparent: true, opacity: 0.45, depthWrite: false })), 700);
      this.ghost.frustumCulled = false; this.ghost.count = 0; this.ghost.renderOrder = 3;
      this.scene.add(this.ghost);
    }

    buildFx() {
      this.fire = new Particles(this.scene, this.q.particles, true);
      this.dust = new Particles(this.scene, Math.floor(this.q.particles * 0.8), false);
      const arrowG = this.track(new T.BoxGeometry(0.06, 0.06, 1.1));
      this.arrows = new T.InstancedMesh(arrowG, this.track(new T.MeshBasicMaterial({ color: '#3a2a1a' })), 800);
      this.arrows.frustumCulled = false; this.arrows.count = 0;
      this.scene.add(this.arrows);
      const ballG = this.track(new T.IcosahedronGeometry(0.5, 0));
      this.balls = new T.InstancedMesh(ballG, this.track(new T.MeshBasicMaterial({ color: '#ffffff' })), 200);
      this.balls.frustumCulled = false; this.balls.count = 0;
      this.balls.setColorAt(0, new T.Color(1, 1, 1));
      this.scene.add(this.balls);
      this.rings = [];
      this.ringGeo = this.track(new T.RingGeometry(0.92, 1, 48));
      this.ringGeo.rotateX(-Math.PI / 2);
      this.pillarGeo = this.track(new T.CylinderGeometry(1, 1, 30, 24, 1, true));
      this.effects = [];
      this.orderMarks = [];
      this._c = new T.Color();
      this.flashT = 0;
      this.flash = new T.PointLight('#ffaa55', 0, 80);
      this.scene.add(this.flash);
    }

    // ---------------------------------------------------------------- per frame
    update(dt, ui) {
      const b = this.b;
      const time = b.time;
      const sel = ui ? ui.selected : new Set();
      const hover = ui ? ui.hoverUnit : null;
      // Soldiers
      for (const g of this.groups) {
        const arr = g.mesh.instanceMatrix.array;
        for (const u of g.units) {
          const base = u.r.off;
          const hide = u.state === 'escaped' || (u.hidden && u.side !== 0);
          const mounted = u.t.model.kind === 'mounted' || u.t.model.kind === 'beast' || u.t.model.kind === 'siege';
          for (let i = 0; i < u.count; i++) {
            const o = (base + i) * 16;
            if (hide && (u.sa[i] || u.state === 'escaped')) { writeMatrix(arr, o, 0, -50, 0, 0, 0, 0); continue; }
            if (!u.sa[i]) {
              const since = time - u.sdie[i];
              if (u.sdie[i] < -100 || (this.q.terrainRes < 100 && since > 40)) { writeMatrix(arr, o, 0, -50, 0, 0, 0, 0); continue; }
              const fall = Math.min(1, since * 3);
              const sink = since > 60 ? Math.min(1.5, (since - 60) * 0.05) : 0;
              if (mounted) writeMatrix(arr, o, u.sx[i], u.sy[i] - sink, u.sz[i], u.sf[i], 0, 1, fall * 1.45);
              else writeMatrix(arr, o, u.sx[i], u.sy[i] - sink, u.sz[i], u.sf[i], -fall * 1.5, 1);
              continue;
            }
            const mv = u.smove[i];
            let lean = 0, bob = 0;
            if (mv > 0.3) { bob = Math.abs(Math.sin(u.sphase[i])) * (mounted ? 0.15 : 0.09); lean = mounted ? 0.03 : 0.08; }
            if (u.satk[i] > 0) lean += Math.sin((0.45 - u.satk[i]) / 0.45 * Math.PI) * (mounted ? 0.12 : 0.45);
            if (u.state === 'routing') lean = 0.25;
            writeMatrix(arr, o, u.sx[i], u.sy[i] + bob, u.sz[i], u.sf[i], lean, 1);
          }
        }
        g.mesh.instanceMatrix.needsUpdate = true;
      }
      // Selection / hover discs
      const mk = this.markers, marr = mk.instanceMatrix.array;
      let n = 0;
      const c = this._c;
      const addUnitDiscs = (u, col) => {
        for (let i = 0; i < u.count && n < mk.instanceMatrix.count; i++) {
          if (!u.sa[i]) continue;
          writeMatrix(marr, n * 16, u.sx[i], u.sy[i] + 0.12, u.sz[i], 0, 0, u.large ? 2.2 : 1);
          mk.setColorAt(n, col);
          n++;
        }
      };
      const selCol = new T.Color('#62f07c'), hovCol = new T.Color('#ffffff'), enemyCol = new T.Color('#ff4a3a'), targCol = new T.Color('#ffb03a');
      for (const u of sel) if (!u.gone) addUnitDiscs(u, selCol);
      if (hover && !hover.gone && !sel.has(hover)) addUnitDiscs(hover, hover.side === 0 ? hovCol : enemyCol);
      // Show attack targets of selected units
      for (const u of sel) {
        const t = u.order && u.order.type === 'attack' ? u.order.target : null;
        if (t && !t.gone && t !== hover && !(t.hidden && t.side !== 0)) addUnitDiscs(t, targCol);
      }
      mk.count = n;
      mk.instanceMatrix.needsUpdate = true;
      if (mk.instanceColor) mk.instanceColor.needsUpdate = true;

      // Projectiles
      let na = 0, nb = 0;
      const aarr = this.arrows.instanceMatrix.array, barr = this.balls.instanceMatrix.array;
      for (const p of b.projectiles) {
        if (p.t < 0) continue;
        const t = p.t / p.dur;
        const x = p.x0 + (p.x1 - p.x0) * t, z = p.z0 + (p.z1 - p.z0) * t;
        const y = p.y0 + (p.y1 - p.y0) * t + p.arc * 4 * t * (1 - t);
        if (p.kind === 'arrow' || p.kind === 'javelin') {
          if (na >= 800) continue;
          const dx = p.x1 - p.x0, dz = p.z1 - p.z0, dy = (p.y1 - p.y0) + p.arc * 4 * (1 - 2 * t);
          const yaw = Math.atan2(dx, dz), pitch = -Math.atan2(dy, Math.hypot(dx, dz));
          writeMatrix(aarr, na * 16, x, y, z, yaw, pitch, p.kind === 'javelin' ? 1.5 : 1);
          na++;
        } else {
          if (nb >= 200) continue;
          let sc = 1, col = '#888888';
          if (p.kind === 'boulder') { sc = 1.3; col = '#6b655c'; }
          else if (p.kind === 'magic') { sc = 0.7; col = p.side === 0 ? '#9ff3ff' : '#e3a8ff'; if (Math.random() < 0.5) this.fire.emit(x, y, z, 0, 0.5, 0, 0.35, 1.4, c.set('#b48cff')); }
          else if (p.kind === 'bolt') { sc = 0.8; col = '#7ae8ff'; this.fire.emit(x, y, z, 0, 0, 0, 0.4, 1.6, c.set('#7ae8ff')); }
          else if (p.kind === 'fireball') { sc = 2.2; col = '#ffb347'; for (let k = 0; k < 3; k++) this.fire.emit(x, y, z, (Math.random() - 0.5) * 2, Math.random() * 2, (Math.random() - 0.5) * 2, 0.5, 4, c.set(k ? '#ff6a1a' : '#ffd36a')); }
          else if (p.kind === 'meteor') { sc = 6; col = '#ff8a3a'; for (let k = 0; k < 6; k++) this.fire.emit(x + (Math.random() - 0.5) * 3, y + Math.random() * 3, z + (Math.random() - 0.5) * 3, 0, 4, 0, 0.9, 8, c.set(k % 2 ? '#ff5a1a' : '#ffd36a')); }
          writeMatrix(barr, nb * 16, x, y, z, 0, 0, sc);
          this.balls.setColorAt(nb, c.set(col));
          nb++;
        }
      }
      this.arrows.count = na; this.arrows.instanceMatrix.needsUpdate = true;
      this.balls.count = nb; this.balls.instanceMatrix.needsUpdate = true;
      if (this.balls.instanceColor) this.balls.instanceColor.needsUpdate = true;

      // New effects from the simulation
      while (b.fx.length) this.spawnFx(b.fx.shift());
      this.updateEffects(dt);
      this.fire.update(dt);
      this.dust.update(dt);

      // Gate
      if (this.gateMesh && b.map.gate.hp <= 0 && this.gateMesh.visible) this.gateMesh.visible = false;
      // Deploy zone
      const dep = b.phase === 'deploy';
      this.deployLine.visible = dep; this.deployFill.visible = dep;
      if (this.flashT > 0) { this.flashT -= dt; this.flash.intensity = Math.max(0, this.flashT) * 6; }
    }

    addRing(x, z, r, color, dur, opts = {}) {
      const m = new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, side: T.DoubleSide, blending: opts.additive === false ? T.NormalBlending : T.AdditiveBlending });
      const mesh = new T.Mesh(opts.pillar ? this.pillarGeo : this.ringGeo, m);
      mesh.position.set(x, this.b.map.heightAt(x, z) + (opts.pillar ? 15 : 0.5), z);
      mesh.renderOrder = 4;
      this.scene.add(mesh);
      this.effects.push({ mesh, t: 0, dur, r, grow: opts.grow !== false, pulse: !!opts.pulse, pillar: !!opts.pillar });
    }
    updateEffects(dt) {
      for (const e of this.effects) {
        e.t += dt;
        const k = e.t / e.dur;
        if (e.pillar) { e.mesh.scale.set(e.r * (0.3 + k * 0.7), 1, e.r * (0.3 + k * 0.7)); e.mesh.material.opacity = 0.35 * (1 - k); }
        else if (e.pulse) { const s = e.r * (0.9 + Math.sin(e.t * 10) * 0.08); e.mesh.scale.set(s, 1, s); e.mesh.material.opacity = 0.7; }
        else { const s = e.grow ? e.r * (0.2 + k * 0.8) : e.r; e.mesh.scale.set(s, 1, s); e.mesh.material.opacity = 0.9 * (1 - k); }
      }
      const keep = [];
      for (const e of this.effects) {
        if (e.t < e.dur) keep.push(e);
        else { this.scene.remove(e.mesh); e.mesh.material.dispose(); }
      }
      this.effects = keep;
      for (const o of this.orderMarks) {
        o.t += dt;
        o.mesh.material.opacity = Math.max(0, 0.8 * (1 - o.t / 1.6));
      }
      this.orderMarks = this.orderMarks.filter((o) => { if (o.t < 1.6) return true; this.scene.remove(o.mesh); o.mesh.material.dispose(); return false; });
    }

    // Visual for a move order: small rings at each destination.
    orderMarker(x, z, color = '#62f07c') {
      const m = new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false });
      const mesh = new T.Mesh(this.ringGeo, m);
      mesh.scale.set(2.2, 1, 2.2);
      mesh.position.set(x, this.b.map.heightAt(x, z) + 0.4, z);
      this.scene.add(mesh);
      this.orderMarks.push({ mesh, t: 0 });
    }

    spawnFx(f) {
      const map = this.b.map, c = this._c;
      const gy = (x, z) => map.heightAt(x, z);
      switch (f.type) {
        case 'explosion': {
          const r = f.r;
          for (let k = 0; k < (f.big ? 90 : 45); k++) {
            const a = Math.random() * Math.PI * 2, sp = Math.random() * r * 1.4;
            this.fire.emit(f.x + Math.cos(a) * r * 0.3, gy(f.x, f.z) + 1, f.z + Math.sin(a) * r * 0.3, Math.cos(a) * sp, 4 + Math.random() * (f.big ? 14 : 8), Math.sin(a) * sp, 0.6 + Math.random() * 0.6, f.big ? 7 : 4, c.set(Math.random() < 0.5 ? '#ff6a1a' : '#ffd36a'), 6);
          }
          for (let k = 0; k < 25; k++) this.dust.emit(f.x + (Math.random() - 0.5) * r, gy(f.x, f.z) + 1, f.z + (Math.random() - 0.5) * r, (Math.random() - 0.5) * 3, 2 + Math.random() * 3, (Math.random() - 0.5) * 3, 2 + Math.random() * 1.5, 6, c.set('#3c3530'), -0.3, 0.6);
          this.addRing(f.x, f.z, r * 1.2, f.color || '#ff8a3a', 0.6);
          this.flash.position.set(f.x, gy(f.x, f.z) + 6, f.z); this.flashT = f.big ? 0.9 : 0.4;
          break;
        }
        case 'impact': {
          for (let k = 0; k < 14; k++) this.dust.emit(f.x, gy(f.x, f.z) + 0.5, f.z, (Math.random() - 0.5) * 8, 3 + Math.random() * 4, (Math.random() - 0.5) * 8, 0.9 + Math.random() * 0.6, 3, c.set('#7a6a52'), 9, 0.8);
          break;
        }
        case 'magicburst': {
          for (let k = 0; k < 20; k++) this.fire.emit(f.x, gy(f.x, f.z) + 1, f.z, (Math.random() - 0.5) * 8, Math.random() * 6, (Math.random() - 0.5) * 8, 0.6, 2.5, c.set('#7ae8ff'), 4);
          this.addRing(f.x, f.z, f.r * 1.5, '#7ae8ff', 0.5);
          break;
        }
        case 'charge': {
          for (let k = 0; k < 18; k++) this.dust.emit(f.x + (Math.random() - 0.5) * 8, gy(f.x, f.z) + 0.5, f.z + (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 5, 1 + Math.random() * 2, (Math.random() - 0.5) * 5, 1.2, 4, c.set('#8a7a5e'), 1, 0.6);
          break;
        }
        case 'ring': this.addRing(f.x, f.z, f.r, f.color, f.dur || 1); break;
        case 'pillar': this.addRing(f.x, f.z, f.r, f.color, f.dur || 1.5, { pillar: true }); this.addRing(f.x, f.z, f.r, f.color, f.dur || 1.5, { grow: false }); break;
        case 'target': this.addRing(f.x, f.z, f.r, f.color, f.dur, { pulse: true }); break;
        case 'quake': {
          this.addRing(f.x, f.z, f.r * 1.3, '#c48a3a', 0.8);
          for (let k = 0; k < 50; k++) {
            const a = Math.random() * Math.PI * 2, rr = Math.random() * f.r;
            const x = f.x + Math.cos(a) * rr, z = f.z + Math.sin(a) * rr;
            this.dust.emit(x, gy(x, z) + 0.3, z, 0, 3 + Math.random() * 6, 0, 1 + Math.random(), 4, c.set(k % 3 ? '#6b5636' : '#3a2e22'), 10, 0.9);
          }
          break;
        }
        case 'sparkle': {
          for (let k = 0; k < 40; k++) {
            const a = Math.random() * Math.PI * 2, rr = Math.random() * f.r;
            const x = f.x + Math.cos(a) * rr, z = f.z + Math.sin(a) * rr;
            this.fire.emit(x, gy(x, z) + 0.5 + Math.random() * 2, z, 0, f.up ? 3 + Math.random() * 3 : 1, 0, 1 + Math.random(), 1.6, c.set(f.color), 0, 0.9);
          }
          break;
        }
        case 'rally': {
          const u = f.unit;
          for (let k = 0; k < 20; k++) this.fire.emit(u.x + (Math.random() - 0.5) * u.hw * 2, gy(u.x, u.z) + 2, u.z + (Math.random() - 0.5) * 4, 0, 2, 0, 1, 1.5, c.set('#ffd76a'));
          break;
        }
      }
    }

    // Ghost discs showing where a right-drag will place the selected units.
    showGhost(slots) {
      const arr = this.ghost.instanceMatrix.array;
      let n = 0;
      for (const s of slots) { if (n >= 700) break; writeMatrix(arr, n * 16, s.x, this.b.map.heightAt(s.x, s.z) + 0.2, s.z, 0, 0, 0.9); n++; }
      this.ghost.count = n;
      this.ghost.instanceMatrix.needsUpdate = true;
    }

    dispose() {
      this.fire.dispose(); this.dust.dispose();
      for (const d of this.disposables) if (d && d.dispose) d.dispose();
      for (const g of this.groups) g.mesh.dispose && g.mesh.dispose();
      this.scene.traverse((o) => { if (o.isInstancedMesh && o.dispose) o.dispose(); });
    }
  }

  RW.BattleRenderer = BattleRenderer;
})();
