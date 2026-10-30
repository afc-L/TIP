// 3D campaign map: instanced hex tiles coloured by owner, settlements, shrines, roads and army tokens.
(function () {
  const RW = window.RW;
  const T = THREE;
  const U = RW.util;
  const D = RW.data;
  const M = RW.models;

  class CampaignView {
    constructor(campaign) {
      this.c = campaign;
      this.map = campaign.map;
      this.q = RW.quality();
      const scene = (this.scene = new T.Scene());
      scene.background = new T.Color('#1d2a36');
      scene.fog = new T.Fog('#1d2a36', 90, 190);
      scene.add(new T.HemisphereLight('#f4ecd8', '#3a4a5a', 0.85));
      const sun = (this.sun = new T.DirectionalLight('#ffe6c0', 1.1));
      sun.position.set(30, 60, 20);
      if (this.q.shadows) {
        sun.castShadow = true;
        sun.shadow.mapSize.set(this.q.shadowSize, this.q.shadowSize);
        const c = sun.shadow.camera; const ex = campaign.map.extent; const hw = ex.x / 2 + 12, hh = ex.z / 2 + 12; c.left = -hw; c.right = hw; c.top = hh; c.bottom = -hh; c.near = 1; c.far = 200;
        sun.shadow.bias = -0.001;
      }
      const ext = this.map.extent;
      this.center = { x: ext.x / 2, z: ext.z / 2 };
      sun.target.position.set(this.center.x, 0, this.center.z);
      sun.position.set(this.center.x + 30, 60, this.center.z + 20);
      scene.add(sun); scene.add(sun.target);
      this.disposables = [];
      this.tokens = new Map();
      this.settlements = new Map();
      this.selectedT = -1; this.targets = new Set(); this.hoverT = -1;
      this.time = 0;
      this.buildTiles();
      this.buildDecor();
      this.buildRoads();
      this.refresh();
    }
    track(o) { this.disposables.push(o); return o; }

    buildTiles() {
      const tiles = this.map.tiles;
      const g = this.track(new T.CylinderGeometry(this.map.HEX * 0.995, this.map.HEX * 0.995, 1, 6, 1));
      g.translate(0, 0.5, 0);
      const mat = this.track(new T.MeshLambertMaterial({ color: '#ffffff' }));
      const im = (this.tileMesh = new T.InstancedMesh(g, mat, tiles.length));
      im.receiveShadow = this.q.shadows;
      const m = new T.Matrix4();
      tiles.forEach((tl, i) => {
        const h = tl.t === -1 ? 0.12 : tl.water ? 0.3 : tl.h;
        m.makeScale(1, h, 1); m.setPosition(tl.x, 0, tl.z);
        im.setMatrixAt(i, m);
        im.setColorAt(i, new T.Color('#2b4f6e'));
      });
      this.scene.add(im);
      // Open sea beyond the map
      const sea = new T.Mesh(this.track(new T.PlaneGeometry(600, 600)), this.track(new T.MeshLambertMaterial({ color: '#203e58' })));
      sea.rotation.x = -Math.PI / 2; sea.position.set(this.center.x, 0.05, this.center.z);
      this.scene.add(sea);
    }

    buildDecor() {
      const tiles = this.map.tiles;
      const m = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), v = new T.Vector3(), s = new T.Vector3();
      const treeTiles = tiles.filter((t) => t.tree && t.t !== -1 && !t.water);
      const treeGeo = this.track(M.treeGeometry('pine'));
      const trees = new T.InstancedMesh(treeGeo, this.track(new T.MeshLambertMaterial({ vertexColors: true })), treeTiles.length * 2);
      let n = 0;
      const rng = U.makeRng(99);
      for (const tl of treeTiles) {
        const k = this.q.trees > 0.7 ? 2 : 1;
        for (let j = 0; j < k; j++) {
          e.set(0, rng() * 6, 0); q.setFromEuler(e);
          v.set(tl.x + (rng() - 0.5) * 1.2, tl.h, tl.z + (rng() - 0.5) * 1.2);
          const sc = 0.18 + rng() * 0.1; s.set(sc, sc, sc);
          trees.setMatrixAt(n++, m.compose(v, q, s));
        }
      }
      trees.count = n;
      trees.castShadow = this.q.shadows;
      this.scene.add(trees);
      // Mountains / peaks
      const b = new M.Builder();
      b.add(M.PRIM.cone, '#8a8478', 0, 0.9, 0, 0, 0, 0, 1.9, 1.8, 1.9);
      b.add(M.PRIM.cone, '#eef2f5', 0, 1.55, 0, 0, 0, 0, 0.75, 0.55, 0.75);
      const peakGeo = this.track(b.build());
      const peakTiles = tiles.filter((t) => t.peak && t.t !== -1);
      const peaks = new T.InstancedMesh(peakGeo, this.track(new T.MeshLambertMaterial({ vertexColors: true })), Math.max(1, peakTiles.length));
      peakTiles.forEach((tl, i) => {
        e.set(0, rng() * 6, 0); q.setFromEuler(e);
        const sc = tl.mountain ? 1.1 + rng() * 0.6 : 0.6 + rng() * 0.3;
        v.set(tl.x, tl.h - 0.1, tl.z); s.set(sc, sc * (tl.mountain ? 1.3 : 0.9), sc);
        peaks.setMatrixAt(i, m.compose(v, q, s));
      });
      peaks.count = peakTiles.length;
      peaks.castShadow = this.q.shadows;
      this.scene.add(peaks);
      // Landmarks and ruins (Greater Realm)
      this.ruinGlows = new Map();
      for (const td of this.map.territories) {
        const site = this.map.sites[td.id];
        if (td.landmark) {
          const mesh = new T.Mesh(this.track(M.landmarkGeometry(td.landmark)), this.track(new T.MeshLambertMaterial({ vertexColors: true })));
          mesh.scale.setScalar(0.5);
          mesh.position.set(site.x + 2.0, this.tileHeight(site.x + 2.0, site.z - 1.6), site.z - 1.6);
          mesh.castShadow = this.q.shadows;
          this.scene.add(mesh);
        }
        if (td.ruins) {
          const mesh = new T.Mesh(this.track(M.ruinsGeometry()), this.track(new T.MeshLambertMaterial({ vertexColors: true })));
          mesh.scale.setScalar(0.45);
          const rx = site.x - 2.4, rz = site.z - 1.5;
          mesh.position.set(rx, this.tileHeight(rx, rz), rz);
          this.scene.add(mesh);
          const glow = new T.PointLight('#ffcf6a', 0.9, 6);
          glow.position.set(rx, mesh.position.y + 1.2, rz);
          this.scene.add(glow);
          this.ruinGlows.set(td.id, glow);
        }
      }
      // Shrines
      for (const td of this.map.territories) {
        if (!td.shrine) continue;
        const site = this.map.sites[td.id];
        const mesh = new T.Mesh(this.track(M.shrineGeometry()), this.track(new T.MeshLambertMaterial({ vertexColors: true, emissive: '#113', emissiveIntensity: 0.4 })));
        mesh.scale.setScalar(0.45);
        mesh.position.set(site.x + 2.2, this.tileHeight(site.x + 2.2, site.z + 1.4), site.z + 1.4);
        this.scene.add(mesh);
        const glow = new T.PointLight('#7ae8ff', 0.8, 8);
        glow.position.set(mesh.position.x, mesh.position.y + 1.5, mesh.position.z);
        this.scene.add(glow);
      }
      // Selection ring
      const rg = this.track(new T.RingGeometry(2.6, 3.0, 40)); rg.rotateX(-Math.PI / 2);
      this.selRing = new T.Mesh(rg, this.track(new T.MeshBasicMaterial({ color: '#ffd76a', transparent: true, opacity: 0.9, depthWrite: false })));
      this.selRing.visible = false; this.selRing.renderOrder = 3;
      this.scene.add(this.selRing);
    }

    siteHeight(tid) {
      if (!this._siteH) this._siteH = this.map.sites.map((s) => this.tileHeight(s.x, s.z));
      return this._siteH[tid];
    }
    tileHeight(x, z) {
      // Fast path: look up the hex under the point, falling back to a full search near the coast.
      const HEX = this.map.HEX, r = Math.round(z / (1.5 * HEX)), c = Math.round((x - (r & 1 ? Math.sqrt(3) * HEX / 2 : 0)) / (Math.sqrt(3) * HEX));
      if (r >= 0 && c >= 0 && r < this.map.H && c < this.map.W) {
        let best = null, bd = Infinity;
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          const rr = r + dr, cc = c + dc;
          if (rr < 0 || cc < 0 || rr >= this.map.H || cc >= this.map.W) continue;
          const tl = this.map.tiles[rr * this.map.W + cc];
          const d = (tl.x - x) ** 2 + (tl.z - z) ** 2;
          if (d < bd) { bd = d; best = tl; }
        }
        if (best) return best.t === -1 ? 0.12 : best.h;
      }
      let best = null, bd = Infinity;
      for (const tl of this.map.tiles) { const d = (tl.x - x) ** 2 + (tl.z - z) ** 2; if (d < bd) { bd = d; best = tl; } }
      return best ? (best.t === -1 ? 0.12 : best.h) : 0.5;
    }

    buildRoads() {
      const pts = [];
      const sites = this.map.sites;
      for (let a = 0; a < this.map.adj.length; a++) for (const b of this.map.adj[a]) {
        if (b < a) continue;
        const A = sites[a], B = sites[b];
        const n = 14;
        for (let i = 0; i < n; i++) {
          const t0 = i / n, t1 = (i + 1) / n;
          const x0 = A.x + (B.x - A.x) * t0, z0 = A.z + (B.z - A.z) * t0, x1 = A.x + (B.x - A.x) * t1, z1 = A.z + (B.z - A.z) * t1;
          pts.push(new T.Vector3(x0, this.tileHeight(x0, z0) + 0.08, z0), new T.Vector3(x1, this.tileHeight(x1, z1) + 0.08, z1));
        }
      }
      const g = this.track(new T.BufferGeometry().setFromPoints(pts));
      const roads = new T.LineSegments(g, this.track(new T.LineDashedMaterial({ color: '#e8d7a8', dashSize: 0.5, gapSize: 0.35, transparent: true, opacity: 0.75 })));
      roads.computeLineDistances();
      this.scene.add(roads);
    }

    // Recolour tiles and rebuild settlements/tokens from campaign state.
    refresh() {
      const c = this.c;
      const tiles = this.map.tiles, im = this.tileMesh;
      const col = new T.Color(), oc = new T.Color(), tc = new T.Color();
      tiles.forEach((tl, i) => {
        if (tl.t === -1) { col.set('#2b4f6e'); im.setColorAt(i, col); return; }
        if (tl.water) { col.set('#3f78a8'); im.setColorAt(i, col); return; }
        const t = c.terr(tl.t);
        tc.set(tl.lava ? '#d2571e' : D.TERRAIN_INFO[this.map.territories[tl.t].terrain].color);
        oc.set(D.FACTIONS[t.owner].color);
        col.copy(tc).lerp(oc, t.owner === 'rebels' ? 0.15 : 0.42);
        if (tl.border) col.lerp(oc, 0.35).multiplyScalar(0.8);
        if (tl.t === this.selectedT) col.multiplyScalar(1.28);
        else if (this.targets.has(tl.t)) col.lerp(new T.Color(this.targetColor || '#fff1a8'), 0.28);
        else if (tl.t === this.hoverT) col.multiplyScalar(1.12);
        im.setColorAt(i, col);
      });
      im.instanceColor.needsUpdate = true;
      // Settlements
      for (const t of c.territories) {
        const key = `${t.owner}|${t.level}|${t.buildings.walls}|${this.bannerOf(t.owner)}`;
        let s = this.settlements.get(t.id);
        if (s && s.key === key) continue;
        if (s) { this.scene.remove(s.mesh); s.mesh.geometry.dispose(); }
        const site = this.map.sites[t.id];
        const F = D.FACTIONS[t.owner];
        const geo = M.settlementGeometry(t.level, this.bannerOf(t.owner), t.buildings.walls, F.style, F.color2);
        const mesh = new T.Mesh(geo, this.settleMat || (this.settleMat = this.track(new T.MeshLambertMaterial({ vertexColors: true }))));
        mesh.scale.setScalar(0.62);
        mesh.position.set(site.x, this.tileHeight(site.x, site.z), site.z);
        mesh.castShadow = this.q.shadows;
        this.scene.add(mesh);
        this.settlements.set(t.id, { key, mesh });
      }
      // Army tokens
      const alive = new Set();
      for (const a of c.armies) {
        alive.add(a.id);
        let tok = this.tokens.get(a.id);
        if (tok && tok.color !== this.bannerOf(a.faction)) { this.scene.remove(tok.mesh); tok.mesh.geometry.dispose(); this.tokens.delete(a.id); tok = null; }
        if (!tok) {
          const f = D.FACTIONS[a.faction];
          const mesh = new T.Mesh(M.armyTokenGeometry(this.bannerOf(a.faction), f.color2), this.tokenMat || (this.tokenMat = this.track(new T.MeshLambertMaterial({ vertexColors: true }))));
          mesh.scale.setScalar(0.55);
          mesh.castShadow = this.q.shadows;
          this.scene.add(mesh);
          const p = this.tokenPos(a.tid);
          mesh.position.set(p.x, p.y, p.z);
          tok = { mesh, army: a, from: null, t: 1, color: this.bannerOf(a.faction) };
          this.tokens.set(a.id, tok);
        }
        tok.army = a;
        const p = this.tokenPos(a.tid);
        tok.baseY = p.y;
        if (Math.hypot(tok.mesh.position.x - p.x, tok.mesh.position.z - p.z) > 0.1 && (!tok.to || tok.to.x !== p.x || tok.to.z !== p.z)) {
          tok.from = tok.mesh.position.clone(); tok.to = p; tok.t = 0;
        }
      }
      for (const [tid, glow] of this.ruinGlows) glow.visible = !c.explored.includes(tid);
      for (const [id, tok] of this.tokens) if (!alive.has(id)) { this.scene.remove(tok.mesh); tok.mesh.geometry.dispose(); this.tokens.delete(id); }
      // Selection ring
      if (this.selectedT >= 0) {
        const s = this.map.sites[this.selectedT];
        this.selRing.visible = true;
        this.selRing.position.set(s.x, this.tileHeight(s.x, s.z) + 0.1, s.z);
      } else this.selRing.visible = false;
    }
    bannerOf(f) {
      const fs = this.c.factions[f];
      return (fs && fs.banner) || D.FACTIONS[f].color;
    }
    tokenPos(tid) {
      const s = this.map.sites[tid];
      const x = s.x - 2.1, z = s.z + 1.2;
      return { x, y: this.tileHeight(x, z), z };
    }
    // Promise resolves when the token has walked to its new territory.
    animateArmy(a, ms = RW.settings.fastCampaign ? 220 : 450) {
      this.refresh();
      return new Promise((res) => setTimeout(res, ms));
    }

    pickTerritory(raycaster) {
      const hit = raycaster.intersectObject(this.tileMesh, false)[0];
      if (!hit || hit.instanceId == null) return -1;
      return this.map.tiles[hit.instanceId].t;
    }

    update(dt) {
      this.time += dt;
      for (const tok of this.tokens.values()) {
        if (tok.from && tok.t < 1) {
          tok.t = Math.min(1, tok.t + dt * (RW.settings.fastCampaign ? 5 : 2.4));
          const k = tok.t * tok.t * (3 - 2 * tok.t);
          tok.mesh.position.set(U.lerp(tok.from.x, tok.to.x, k), U.lerp(tok.from.y, tok.to.y, k) + Math.sin(k * Math.PI) * 1.2, U.lerp(tok.from.z, tok.to.z, k));
          if (tok.t >= 1) tok.from = null;
        }
        // Idle armies sway like a camp in the wind; marching ones bob with each step.
        const marching = tok.from && tok.t < 1;
        tok.mesh.rotation.y = marching ? Math.atan2(tok.to.x - tok.from.x, tok.to.z - tok.from.z) * 0.3 : Math.sin(this.time * 1.5 + tok.army.id) * 0.15;
        tok.mesh.rotation.z = marching ? Math.sin(this.time * 18) * 0.08 : 0;
        if (!marching) tok.mesh.position.y = tok.baseY + Math.abs(Math.sin(this.time * 2 + tok.army.id)) * 0.08;
      }
      if (this.selRing.visible) this.selRing.material.opacity = 0.6 + Math.sin(this.time * 4) * 0.3;
    }

    dispose() {
      for (const d of this.disposables) if (d && d.dispose) d.dispose();
      for (const s of this.settlements.values()) s.mesh.geometry.dispose();
      for (const t of this.tokens.values()) t.mesh.geometry.dispose();
      this.tileMesh.dispose();
    }
  }

  RW.CampaignView = CampaignView;
})();
