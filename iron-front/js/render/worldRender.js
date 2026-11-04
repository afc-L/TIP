// Static battlefield rendering: terrain, water, roads, buildings (instanced), trees, scorch marks.
(function (G) {
  'use strict';
  const IF = G.IF, U = IF.U, GT = IF.GROUND;
  const WR = (IF.WorldRender = {});

  const GCOL = [];
  GCOL[GT.GRASS] = [0.33, 0.40, 0.20]; GCOL[GT.DIRT] = [0.44, 0.37, 0.26]; GCOL[GT.CONCRETE] = [0.50, 0.50, 0.48];
  GCOL[GT.MUD] = [0.28, 0.23, 0.16]; GCOL[GT.SAND] = [0.60, 0.54, 0.40]; GCOL[GT.ROCK] = [0.45, 0.44, 0.42];
  GCOL[GT.FIELD] = [0.55, 0.49, 0.26]; GCOL[GT.FIELD2] = [0.33, 0.28, 0.19]; GCOL[GT.DRYGRASS] = [0.42, 0.42, 0.24];

  function detailTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d');
    const img = x.createImageData(128, 128);
    for (let i = 0; i < 128 * 128; i++) {
      const v = 200 + Math.random() * 55;
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    // a few darker blotches
    for (let k = 0; k < 40; k++) { x.fillStyle = 'rgba(0,0,0,0.05)'; x.beginPath(); x.arc(Math.random() * 128, Math.random() * 128, Math.random() * 10 + 2, 0, 7); x.fill(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }

  WR.build = function (W) {
    const scene = IF.R.scene;
    WR.group = new THREE.Group(); scene.add(WR.group);
    WR.W = W;
    // ---- terrain ----
    const Gs = W.GRID, CELL = W.CELL, HALF = W.HALF;
    const pos = new Float32Array(Gs * Gs * 3), col = new Float32Array(Gs * Gs * 3), uv = new Float32Array(Gs * Gs * 2);
    const n = U.makeNoise(W.seed + 3);
    WR.baseCol = new Float32Array(Gs * Gs * 3);
    for (let iz = 0; iz < Gs; iz++) for (let ix = 0; ix < Gs; ix++) {
      const i = iz * Gs + ix, x = ix * CELL - HALF, z = iz * CELL - HALF;
      pos[i * 3] = x; pos[i * 3 + 1] = W.h[i]; pos[i * 3 + 2] = z;
      uv[i * 2] = x / 7; uv[i * 2 + 1] = z / 7;
      let c = GCOL[W.ground[i]] || GCOL[0];
      const sl = W.slopeAt(x, z);
      const v = 1 + n.fbm(x / 40, z / 40, 3) * 0.22;
      let r = c[0] * v, g = c[1] * v, b = c[2] * v;
      if (sl > 0.45) { const k = U.clamp((sl - 0.45) * 2, 0, 0.8); r = U.lerp(r, 0.42, k); g = U.lerp(g, 0.40, k); b = U.lerp(b, 0.37, k); }
      if (W.hasRiver && W.h[i] < W.waterY + 0.3) { r *= 0.7; g *= 0.68; b *= 0.6; }
      col[i * 3] = r; col[i * 3 + 1] = g; col[i * 3 + 2] = b;
    }
    WR.baseCol.set(col);
    const idx = new Uint32Array((Gs - 1) * (Gs - 1) * 6);
    let k = 0;
    for (let iz = 0; iz < Gs - 1; iz++) for (let ix = 0; ix < Gs - 1; ix++) {
      const a = iz * Gs + ix, b = a + 1, c = a + Gs, d = c + 1;
      idx[k++] = a; idx[k++] = c; idx[k++] = b; idx[k++] = c; idx[k++] = d; idx[k++] = b;
    }
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    tg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    tg.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    tg.setIndex(new THREE.BufferAttribute(idx, 1));
    tg.computeVertexNormals();
    WR.terrain = new THREE.Mesh(tg, new THREE.MeshLambertMaterial({ vertexColors: true, map: detailTexture() }));
    WR.terrain.receiveShadow = true;
    WR.group.add(WR.terrain);
    // land beyond the battlefield: a strip that starts exactly at the map border (never over the map)
    {
      const per = [];
      for (let k = 0; k < Gs - 1; k++) per.push([k, 0]);
      for (let k = 0; k < Gs - 1; k++) per.push([Gs - 1, k]);
      for (let k = Gs - 1; k > 0; k--) per.push([k, Gs - 1]);
      for (let k = Gs - 1; k > 0; k--) per.push([0, k]);
      per.push(per[0]);
      const ap = [], ac = [], ai = [];
      const OUT = 2600;
      for (let k = 0; k < per.length; k++) {
        const [ix, iz] = per[k];
        const vi = iz * Gs + ix;
        const x = ix * CELL - HALF, z = iz * CELL - HALF, y = W.h[vi];
        const len = Math.sqrt(x * x + z * z) || 1;
        const ox = x / len * OUT, oz = z / len * OUT;
        ap.push(x, y, z, x + ox * 0.08, y + 4, z + oz * 0.08, x + ox, y + 60, z + oz);
        const r = col[vi * 3] * 0.9, g = col[vi * 3 + 1] * 0.9, b = col[vi * 3 + 2] * 0.9;
        ac.push(r, g, b, r * 0.85, g * 0.9, b * 0.8, 0.26, 0.3, 0.18);
        if (k > 0) {
          const a0 = (k - 1) * 3, a1 = k * 3;
          ai.push(a0, a1, a0 + 1, a1, a1 + 1, a0 + 1, a0 + 1, a1 + 1, a0 + 2, a1 + 1, a1 + 2, a0 + 2);
        }
      }
      const ag = new THREE.BufferGeometry();
      ag.setAttribute('position', new THREE.Float32BufferAttribute(ap, 3));
      ag.setAttribute('color', new THREE.Float32BufferAttribute(ac, 3));
      ag.setIndex(ai); ag.computeVertexNormals();
      const apron = new THREE.Mesh(ag, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
      apron.receiveShadow = true;
      WR.group.add(apron);
    }

    // ---- water ----
    if (W.hasRiver) {
      const wm = new THREE.MeshPhongMaterial({ color: 0x35525e, specular: 0x667788, shininess: 70, transparent: true, opacity: 0.86 });
      WR.water = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000, 1, 1), wm);
      WR.water.rotation.x = -Math.PI / 2; WR.water.position.y = W.waterY; WR.water.receiveShadow = true;
      WR.group.add(WR.water);
    }

    // ---- roads ----
    const rp = [], rc = [], ri = [];
    for (const rd of W.roads) {
      const pts = rd.pts.length > 2 ? rd.pts : densify(rd.pts, 8);
      const color = rd.kind === 'highway' ? [0.22, 0.22, 0.23] : rd.kind === 'runway' ? [0.36, 0.37, 0.38] : [0.40, 0.33, 0.23];
      const base = rp.length / 3;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i], q = pts[Math.min(pts.length - 1, i + 1)], o = pts[Math.max(0, i - 1)];
        let dx = q[0] - o[0], dz = q[1] - o[1]; const L = Math.sqrt(dx * dx + dz * dz) || 1; dx /= L; dz /= L;
        const nx = -dz * rd.w * 0.5, nz = dx * rd.w * 0.5;
        for (const s of [-1, 1]) {
          const x = p[0] + nx * s, z = p[1] + nz * s;
          const y = W.groundAt(x, z) + (W.onBridge(x, z) ? 0.06 : 0.14);
          rp.push(x, y, z);
          const v = 0.92 + Math.random() * 0.12;
          rc.push(color[0] * v, color[1] * v, color[2] * v);
        }
        if (i > 0) { const a = base + (i - 1) * 2; ri.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      }
    }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3));
    rg.setAttribute('color', new THREE.Float32BufferAttribute(rc, 3));
    rg.setIndex(ri); rg.computeVertexNormals();
    WR.roads = new THREE.Mesh(rg, new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    WR.roads.receiveShadow = true;
    WR.group.add(WR.roads);

    // ---- structures ----
    const kinds = { box: IF.GEO.unitRBox, prism: IF.GEO.unitPrism, cyl: IF.GEO.unitCyl, rock: IF.GEO.unitRock };
    WR.inst = {};
    for (const kd in kinds) {
      const list = W.boxes.map((b, i) => (b.kind === kd ? i : -1)).filter((i) => i >= 0);
      if (!list.length) continue;
      const m = new THREE.InstancedMesh(kinds[kd], new THREE.MeshLambertMaterial({ color: 0xffffff }), list.length);
      m.castShadow = kd !== 'rock'; m.receiveShadow = true;
      m.userData.list = list;
      WR.inst[kd] = m; WR.group.add(m);
    }
    WR.updateBoxes(true);

    // ---- trees ----
    const trunkG = new THREE.CylinderGeometry(0.18, 0.28, 1, 8); trunkG.translate(0, 0.5, 0);
    const pineB = new IF.GEO.Builder();
    pineB.add(new THREE.ConeGeometry(2.4, 5, 11), 0, 4.2, 0, 0, 0, 0, [0.16, 0.26, 0.14]);
    pineB.add(new THREE.ConeGeometry(1.8, 4, 11), 0, 6.6, 0, 0, 0.4, 0, [0.18, 0.29, 0.15]);
    const broadB = new IF.GEO.Builder();
    broadB.add(new THREE.IcosahedronGeometry(2.8, 1), 0, 5.8, 0, 0, 0, 0, [0.27, 0.36, 0.17], 1, 0.85, 1);
    broadB.add(new THREE.IcosahedronGeometry(2.0, 1), 1.2, 4.6, 0.6, 0.5, 0, 0, [0.24, 0.33, 0.15]);
    const fm = new THREE.MeshLambertMaterial({ vertexColors: true });
    WR.trees = [];
    for (let kind = 0; kind < 2; kind++) {
      const list = W.trees.map((t, i) => (t.kind === kind ? i : -1)).filter((i) => i >= 0);
      const fol = new THREE.InstancedMesh(kind === 0 ? pineB.build() : broadB.build(), fm, list.length);
      const trk = new THREE.InstancedMesh(trunkG, new THREE.MeshLambertMaterial({ color: 0x4a3a2a }), list.length);
      fol.castShadow = true; trk.castShadow = false; fol.receiveShadow = false;
      fol.userData.list = list; trk.userData.list = list;
      WR.trees.push(fol, trk); WR.group.add(fol); WR.group.add(trk);
    }
    WR.updateTrees(true);
    // ---- static props group for dynamic bits (supply crates, mines)
    WR.crateGeo = new THREE.BoxGeometry(1.4, 1.1, 1.4);
    WR.crateMat = new THREE.MeshLambertMaterial({ color: 0x5c6b3a });
    WR.crates = [];
    WR.scorchT = 0;
  };
  function densify(pts, step) {
    const a = pts[0], b = pts[1];
    const n = Math.max(2, Math.ceil(U.dist(a[0], a[1], b[0], b[1]) / step));
    const o = []; for (let i = 0; i <= n; i++) o.push([U.lerp(a[0], b[0], i / n), U.lerp(a[1], b[1], i / n)]);
    return o;
  }

  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler(), _c = new THREE.Color();
  WR.updateBoxes = function (initial) {
    const W = WR.W;
    for (const kd in WR.inst) {
      const m = WR.inst[kd];
      const list = m.userData.list;
      for (let k = 0; k < list.length; k++) {
        const b = W.boxes[list[k]];
        _p.set(b.x, b.y, b.z);
        _q.setFromAxisAngle(_s.set(0, 1, 0), b.rot);
        if (b.hidden) _s.set(0, 0, 0); else _s.set(b.sx, b.sy, b.sz);
        if (kd === 'rock' && !b.hidden) _s.set(b.sx, b.sy, b.sz);
        _m.compose(_p, _q, _s);
        m.setMatrixAt(k, _m);
        if (initial) { _c.setRGB(b.r, b.g, b.b); m.setColorAt(k, _c); }
      }
      m.instanceMatrix.needsUpdate = true;
      if (initial && m.instanceColor) m.instanceColor.needsUpdate = true;
      m.computeBoundingSphere();
    }
    W.dirtyBoxes = false;
  };
  WR.updateTrees = function (initial) {
    const W = WR.W;
    for (let k = 0; k < WR.trees.length; k++) {
      const m = WR.trees[k];
      const list = m.userData.list;
      const trunk = k % 2 === 1;
      for (let j = 0; j < list.length; j++) {
        const t = W.trees[list[j]];
        if (t.alive) {
          _e.set(0, (list[j] * 1.37) % 6.28, 0); _q.setFromEuler(_e);
          _p.set(t.x, t.y - 0.2, t.z);
          if (trunk) _s.set(t.s, t.s * (t.kind === 0 ? 4 : 4.8), t.s); else _s.set(t.s, t.s, t.s);
        } else {
          // fallen / shattered
          const a = (list[j] * 2.1) % 6.28;
          _e.set(Math.cos(a) * 1.45, 0, Math.sin(a) * 1.45, 'XYZ'); _q.setFromEuler(_e);
          _p.set(t.x, t.y + 0.3, t.z);
          if (trunk) _s.set(t.s, t.s * 3, t.s); else _s.set(t.s * 0.7, t.s * 0.5, t.s * 0.7);
        }
        _m.compose(_p, _q, _s);
        m.setMatrixAt(j, _m);
        if (initial && !trunk) { const v = 0.8 + ((list[j] * 7919) % 100) / 250; _c.setRGB(v, v, v * (t.kind === 1 && (list[j] % 9 === 0) ? 0.6 : 1)); m.setColorAt(j, _c); }
      }
      m.instanceMatrix.needsUpdate = true;
      if (initial && m.instanceColor) m.instanceColor.needsUpdate = true;
      m.computeBoundingSphere();
    }
    W.treesDirty = false;
  };

  WR.update = function (B, dt) {
    const W = B.W;
    if (W.dirtyBoxes) WR.updateBoxes(false);
    if (W.treesDirty) WR.updateTrees(false);
    // scorch marks darken the terrain around explosions
    WR.scorchT -= dt;
    if (W.scorch.length && WR.scorchT <= 0) {
      WR.scorchT = 0.4;
      const col = WR.terrain.geometry.attributes.color;
      const arr = col.array, Gs = W.GRID, CELL = W.CELL, HALF = W.HALF;
      while (W.scorch.length) {
        const [x, z, r] = W.scorch.pop();
        const i0 = Math.max(0, Math.floor((x - r + HALF) / CELL)), i1 = Math.min(Gs - 1, Math.ceil((x + r + HALF) / CELL));
        const k0 = Math.max(0, Math.floor((z - r + HALF) / CELL)), k1 = Math.min(Gs - 1, Math.ceil((z + r + HALF) / CELL));
        for (let iz = k0; iz <= k1; iz++) for (let ix = i0; ix <= i1; ix++) {
          const d = Math.sqrt((ix * CELL - HALF - x) ** 2 + (iz * CELL - HALF - z) ** 2);
          if (d > r + CELL * 0.5) continue;
          const i = (iz * Gs + ix) * 3;
          const kk = 0.82 + 0.18 * Math.min(1, d / (r + CELL));
          arr[i] = Math.max(0.09, arr[i] * kk); arr[i + 1] = Math.max(0.08, arr[i + 1] * kk); arr[i + 2] = Math.max(0.06, arr[i + 2] * kk);
        }
      }
      col.needsUpdate = true;
    }
    // supply drops
    while (WR.crates.length < B.supply.length) { const m = new THREE.Mesh(WR.crateGeo, WR.crateMat); m.castShadow = true; IF.R.scene.add(m); WR.crates.push(m); }
    for (let k = 0; k < WR.crates.length; k++) {
      const m = WR.crates[k], s = B.supply[k];
      m.visible = !!s;
      if (s) { const fall = Math.max(0, 40 - (B.time - s.drop) * 8); m.position.set(s.x, s.y + 0.55 + fall, s.z); }
    }
    if (WR.water) WR.water.material.opacity = 0.84 + Math.sin(B.time * 0.5) * 0.02;
  };

  WR.dispose = function () {
    if (!WR.group) return;
    IF.R.scene.remove(WR.group);
    WR.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } });
    for (const c of WR.crates || []) IF.R.scene.remove(c);
    WR.group = null; WR.crates = [];
  };
})(typeof window !== 'undefined' ? window : globalThis);
