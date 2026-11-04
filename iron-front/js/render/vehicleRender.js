// Vehicle, helicopter, jet and drone models (merged low-poly geometry per part).
(function (G) {
  'use strict';
  const IF = G.IF, U = IF.U;
  const VR = (IF.VehicleRender = {});

  const D = [0.16, 0.16, 0.15], T1 = [1, 1, 1], T2 = [0.82, 0.82, 0.8], GL = [0.2, 0.28, 0.33], W = [0.12, 0.12, 0.12];

  function models() {
    const M = {};
    const mk = () => new IF.GEO.Builder();
    const wheels = (b, n, len, wid, r, y) => { for (let k = 0; k < n; k++) for (const s of [-1, 1]) b.cyl(r, 0.35, s * (wid / 2 - 0.1), y, -len / 2 + 0.8 + k * ((len - 1.6) / (n - 1)), W, 0, 0, Math.PI / 2, 10); };
    // ---- MBT ----
    let b = mk(), T = IF.VEH.mbt;
    b.box(T.wid * 0.62, 0.9, T.len * 0.92, 0, 0.95, 0, T1);
    b.box(T.wid * 0.66, 0.35, T.len * 0.25, 0, 1.25, -T.len * 0.36, T2, -0.35, 0, 0);
    for (const s of [-1, 1]) { b.box(0.75, 0.95, T.len, s * (T.wid / 2 - 0.38), 0.55, 0, D); b.box(0.08, 0.55, T.len * 0.9, s * (T.wid / 2 + 0.02), 0.85, 0, T2); }
    b.box(T.wid * 0.6, 0.3, 1.2, 0, 1.2, T.len * 0.42, [0.5, 0.5, 0.45]);
    M.mbt = { hull: b.build() };
    b = mk(); b.box(T.wid * 0.6, 0.75, 3.6, 0, 0.38, 0.2, T1); b.box(T.wid * 0.5, 0.4, 1, 0, 0.3, 2.3, T2); b.cyl(0.32, 0.5, 0.5, 0.9, 0.6, T2); b.box(0.15, 0.3, 0.3, -0.7, 0.95, 0.6, D);
    M.mbt.turret = b.build(); M.mbt.turretY = 1.4; M.mbt.turretZ = 0.4;
    b = mk(); b.cyl(0.1, 5.2, 0, 0, -2.6, T2, Math.PI / 2, 0, 0); b.cyl(0.15, 0.6, 0, 0, -3.3, T2, Math.PI / 2, 0, 0); b.cyl(0.13, 0.3, 0, 0, -5.1, D, Math.PI / 2, 0, 0);
    M.mbt.barrel = b.build(); M.mbt.barrelY = 0.35; M.mbt.barrelZ = -1.5;
    // ---- IFV ----
    T = IF.VEH.ifv; b = mk();
    b.box(T.wid * 0.85, 1.25, T.len * 0.9, 0, 1.2, 0.2, T1); b.box(T.wid * 0.85, 0.6, 1.8, 0, 1.0, -T.len * 0.42, T2, 0.6, 0, 0);
    for (const s of [-1, 1]) b.box(0.6, 0.8, T.len, s * (T.wid / 2 - 0.3), 0.45, 0, D);
    b.box(1.0, 1.0, 0.1, 0, 1.2, T.len * 0.46 + 0.2, D);
    M.ifv = { hull: b.build() };
    b = mk(); b.box(1.5, 0.55, 2.0, 0, 0.28, 0.2, T1); b.box(0.2, 0.3, 0.3, 0.6, 0.6, 0.2, D); M.ifv.turret = b.build(); M.ifv.turretY = 1.85; M.ifv.turretZ = -0.6;
    b = mk(); b.cyl(0.06, 2.4, 0, 0, -1.2, D, Math.PI / 2, 0, 0); M.ifv.barrel = b.build(); M.ifv.barrelY = 0.3; M.ifv.barrelZ = -0.8;
    // ---- APC (wheeled) ----
    T = IF.VEH.apc; b = mk();
    b.box(T.wid * 0.92, 1.4, T.len * 0.88, 0, 1.45, 0, T1); b.box(T.wid * 0.9, 0.8, 1.5, 0, 1.25, -T.len * 0.43, T2, 0.7, 0, 0);
    b.box(T.wid * 0.5, 0.15, 0.6, 0, 1.9, -T.len * 0.2, GL);
    wheels(b, 4, T.len * 0.9, T.wid, 0.55, 0.55);
    M.apc = { hull: b.build() };
    b = mk(); b.cyl(0.45, 0.35, 0, 0.18, 0, T2); b.box(0.4, 0.4, 0.1, 0, 0.45, -0.25, T1); M.apc.turret = b.build(); M.apc.turretY = 2.15; M.apc.turretZ = -0.4;
    b = mk(); b.cyl(0.04, 1.4, 0, 0, -0.7, D, Math.PI / 2, 0, 0); b.box(0.14, 0.18, 0.5, 0, 0, -0.05, D); M.apc.barrel = b.build(); M.apc.barrelY = 0.45; M.apc.barrelZ = 0;
    // ---- Truck ----
    T = IF.VEH.truck; b = mk();
    b.box(T.wid, 0.4, T.len, 0, 0.85, 0, D);
    b.box(T.wid, 1.6, 2.0, 0, 1.75, -T.len / 2 + 1.1, T1); b.box(T.wid * 0.95, 0.6, 0.06, 0, 2.1, -T.len / 2 + 0.08, GL);
    b.box(T.wid, 0.6, T.len - 2.4, 0, 1.35, 1.1, T2); b.box(T.wid * 0.98, 1.6, T.len - 2.5, 0, 2.4, 1.1, [0.72, 0.7, 0.58]);
    wheels(b, 3, T.len * 0.85, T.wid, 0.5, 0.5);
    M.truck = { hull: b.build() };
    // ---- Recon ----
    T = IF.VEH.recon; b = mk();
    b.box(T.wid, 0.8, T.len, 0, 0.95, 0, T1); b.box(T.wid * 0.9, 0.55, T.len * 0.45, 0, 1.6, 0.2, T2); b.box(T.wid * 0.85, 0.4, 0.06, 0, 1.6, -0.84, GL, -0.4, 0, 0);
    wheels(b, 2, T.len * 0.85, T.wid, 0.45, 0.45);
    M.recon = { hull: b.build() };
    b = mk(); b.cyl(0.35, 0.15, 0, 0, 0, D); b.box(0.12, 0.2, 0.3, 0, 0.25, 0, D); M.recon.turret = b.build(); M.recon.turretY = 1.9; M.recon.turretZ = 0.4;
    b = mk(); b.cyl(0.04, 1.3, 0, 0, -0.65, D, Math.PI / 2, 0, 0); M.recon.barrel = b.build(); M.recon.barrelY = 0.3; M.recon.barrelZ = 0;
    // ---- SPG ----
    T = IF.VEH.arty; b = mk();
    b.box(T.wid * 0.8, 1.0, T.len * 0.9, 0, 1.0, 0, T1);
    for (const s of [-1, 1]) b.box(0.7, 0.9, T.len, s * (T.wid / 2 - 0.35), 0.5, 0, D);
    M.arty = { hull: b.build() };
    b = mk(); b.box(T.wid * 0.78, 1.4, 4.4, 0, 0.7, 0.6, T1); b.box(0.5, 0.3, 0.5, 0.8, 1.55, 1.2, T2); M.arty.turret = b.build(); M.arty.turretY = 1.5; M.arty.turretZ = 1.6;
    b = mk(); b.cyl(0.14, 6.5, 0, 0, -3.25, T2, Math.PI / 2, 0, 0); b.cyl(0.2, 0.5, 0, 0, -6.4, D, Math.PI / 2, 0, 0); M.arty.barrel = b.build(); M.arty.barrelY = 0.9; M.arty.barrelZ = -1.5;
    // ---- Attack helicopter ----
    T = IF.VEH.aheli; b = mk();
    b.box(1.3, 1.6, 6.5, 0, 1.6, -0.5, T1); b.box(0.9, 0.7, 2.6, 0, 2.6, -1.6, GL); b.box(0.5, 0.6, 6.5, 0, 2.0, 5.2, T1);
    b.box(0.12, 1.6, 1.3, 0, 2.8, 8.2, T1); b.box(3.6, 0.15, 1.0, 0, 1.6, 0.3, T2);
    for (const s of [-1, 1]) { b.cyl(0.22, 1.4, s * 1.7, 1.35, 0.3, D, Math.PI / 2, 0, 0); b.box(0.12, 0.12, 2.2, s * 0.45, 0.35, -0.2, D); }
    b.cyl(0.1, 1.2, 0, 1.0, -3.6, D, Math.PI / 2, 0, 0); b.box(0.6, 0.5, 1.2, 0, 2.6, 0.6, T2);
    M.aheli = { hull: b.build(), rotorY: 3.15, rotorZ: 0.3, rotorR: 7, tailZ: 8.2, tailY: 2.8 };
    // ---- Transport helicopter ----
    T = IF.VEH.theli; b = mk();
    b.box(2.2, 2.0, 7.5, 0, 1.6, -0.2, T1); b.box(2.0, 1.0, 1.6, 0, 1.8, -4.4, GL, 0.35, 0, 0); b.box(0.7, 0.8, 7, 0, 2.2, 6.2, T1);
    b.box(0.12, 1.8, 1.4, 0, 3.1, 9.4, T1); b.box(2.6, 0.12, 0.8, 0, 2.3, 9.2, T2);
    for (const s of [-1, 1]) { b.box(0.08, 0.08, 4.2, s * 1.3, 0.2, -0.5, D); b.box(0.06, 1.0, 1.6, s * 1.12, 1.9, 0.4, D); }
    b.box(1.2, 0.6, 2.6, 0, 2.85, 0.2, T2);
    M.theli = { hull: b.build(), rotorY: 3.35, rotorZ: 0.2, rotorR: 8, tailZ: 9.4, tailY: 3.1 };
    // rotors
    b = mk(); b.box(0.35, 0.06, 1, 0, 0, 0, D, 0, 0, 0, 1, 1, 1); M.blade = b.build();
    // jet
    b = mk();
    b.cyl(0.75, 14, 0, 0, 0, T1, Math.PI / 2, 0, 0); b.box(0.9, 0.8, 2.6, 0, 0.55, -3.6, GL);
    b.add(new THREE.ConeGeometry(0.75, 3, 8), 0, 0, -8.4, -Math.PI / 2, 0, 0, T2);
    b.box(9, 0.15, 4.5, 0, 0, 1.2, T1); b.box(4, 0.12, 1.8, 0, 0, 6.2, T1);
    b.box(0.15, 2.6, 2.4, 0.9, 1.4, 5.6, T1, 0, 0, 0.3); b.box(0.15, 2.6, 2.4, -0.9, 1.4, 5.6, T1, 0, 0, -0.3);
    M.jet = b.build();
    b = mk(); b.box(0.6, 0.5, 3.6, 0, 0, 0, T2); b.box(7, 0.08, 0.7, 0, 0.1, 0.2, T2); b.box(2.2, 0.08, 0.5, 0, 0.3, 1.7, T2); b.cyl(0.15, 0.6, 0, 0, 1.9, D, Math.PI / 2, 0, 0);
    M.uav = b.build();
    return M;
  }

  VR.build = function (B) {
    VR.M = models();
    VR.mats = IF.TEAMS.map((t) => new THREE.MeshLambertMaterial({ vertexColors: true, color: new THREE.Color(t.vehicle[0], t.vehicle[1], t.vehicle[2]) }));
    VR.mats.push(new THREE.MeshLambertMaterial({ vertexColors: true, color: 0x5a5a52 }));   // neutral/abandoned
    VR.wreckMat = new THREE.MeshLambertMaterial({ vertexColors: true, color: 0x1c1a18 });
    VR.jetMat = new THREE.MeshLambertMaterial({ vertexColors: true, color: 0x7a8088 });
    VR.objs = new Map();
    VR.jets = []; VR.uavs = [];
    VR.group = new THREE.Group(); IF.R.scene.add(VR.group);
  };

  function makeObj(v) {
    const m = VR.M[v.type];
    const mat = VR.mats[v.team >= 0 ? v.team : 2];
    const g = new THREE.Group();
    const hull = new THREE.Mesh(m.hull, mat); hull.castShadow = true; hull.receiveShadow = true; g.add(hull);
    const o = { g, hull, v, mat };
    if (m.turret) {
      o.turret = new THREE.Group(); o.turret.position.set(0, m.turretY, m.turretZ); g.add(o.turret);
      const tm = new THREE.Mesh(m.turret, mat); tm.castShadow = true; o.turret.add(tm); o.turretMesh = tm;
      if (m.barrel) { o.barrel = new THREE.Group(); o.barrel.position.set(0, m.barrelY, m.barrelZ); o.turret.add(o.barrel); const bm = new THREE.Mesh(m.barrel, mat); bm.castShadow = true; o.barrel.add(bm); o.barrelMesh = bm; }
    }
    if (m.rotorY) {
      o.rotor = new THREE.Group(); o.rotor.position.set(0, m.rotorY, m.rotorZ); g.add(o.rotor);
      for (let k = 0; k < 4; k++) { const bl = new THREE.Mesh(VR.M.blade, mat); bl.scale.set(1, 1, m.rotorR * 2); bl.rotation.y = k * Math.PI / 4; o.rotor.add(bl); }
      o.tail = new THREE.Group(); o.tail.position.set(0.3, m.tailY, m.tailZ); g.add(o.tail);
      for (let k = 0; k < 2; k++) { const bl = new THREE.Mesh(VR.M.blade, mat); bl.scale.set(0.6, 1, 2.6); bl.rotation.z = Math.PI / 2; bl.rotation.x = k * Math.PI / 2; o.tail.add(bl); }
    }
    VR.group.add(g);
    return o;
  }
  function setMat(o, mat) {
    if (o.mat === mat) return;
    o.mat = mat;
    o.g.traverse((c) => { if (c.isMesh) c.material = mat; });
  }

  VR.update = function (B, dt) {
    const cam = IF.R.camera;
    const far = IF.R.scene.fog.far + 200;
    for (const v of B.vehicles) {
      let o = VR.objs.get(v.id);
      if (v.state === 'gone') { if (o) { VR.group.remove(o.g); VR.objs.delete(v.id); } continue; }
      if (!o) { o = makeObj(v); VR.objs.set(v.id, o); }
      const d2 = U.dist2(v.x, v.z, cam.position.x, cam.position.z);
      o.g.visible = d2 < far * far && !(v.playerIn && IF.Player && IF.Player.firstPerson && !v.T.air && false);
      if (!o.g.visible) continue;
      const mat = v.state === 'wreck' || v.state === 'crashing' ? VR.wreckMat : VR.mats[v.team >= 0 ? v.team : 2];
      setMat(o, mat);
      o.g.position.set(v.x, v.y, v.z);
      o.g.rotation.set(v.pitch, v.yaw, v.roll, 'YXZ');
      if (o.turret) {
        o.turret.rotation.y = U.wrapAng(v.turretYaw - v.yaw);
        if (o.barrel) { o.barrel.rotation.x = U.clamp(v.gunPitch, -0.15, v.type === 'arty' ? 1.1 : 0.4); o.barrel.position.z = VR.M[v.type].barrelZ + v.recoil * 0.5; }
      }
      if (o.rotor) {
        const spin = v.state === 'active' && (v.crew.length || v.playerIn) ? (v.alt > 0.5 || v.task !== 'idle' || v.playerIn ? 1 : 0.4) : v.state === 'crashing' ? 0.6 : 0;
        v.rotor = (v.rotor || 0) + dt * 28 * spin;
        o.rotor.rotation.y = v.rotor; o.tail.rotation.x = v.rotor * 1.6;
      }
      // damage effects
      v.fxT = (v.fxT || 0) - dt;
      if (v.fxT <= 0 && d2 < 700 * 700) {
        if (v.state === 'wreck' && v.burning) { v.fxT = 0.12; IF.FX.fireAt(v.x, v.y + 1.6, v.z, 1.3); if (Math.random() < 0.6) IF.FX.smokePuff(v.x, v.y + 2.5, v.z, 3.5, false, true); }
        else if (v.state === 'wreck') { v.fxT = 0.6; if (B.time - v.wreckT < 200) IF.FX.smokePuff(v.x, v.y + 2, v.z, 2.5, false, true); }
        else if (v.state === 'crashing') { v.fxT = 0.05; IF.FX.fireAt(v.x, v.y + 1, v.z, 1.5); IF.FX.smokePuff(v.x, v.y + 1, v.z, 3, false, true); }
        else if (v.hp < v.T.hp * 0.28) { v.fxT = 0.12; IF.FX.fireAt(v.x, v.y + v.T.hgt, v.z, 0.8); IF.FX.smokePuff(v.x, v.y + v.T.hgt + 0.5, v.z, 2.2, false, true); }
        else if (v.hp < v.T.hp * 0.55) { v.fxT = 0.25; IF.FX.smokePuff(v.x, v.y + v.T.hgt, v.z, 1.6, false, v.hp < v.T.hp * 0.4); }
        else if (Math.abs(v.spd) > 3 && !v.T.air && d2 < 250 * 250) { v.fxT = 0.18; IF.FX.dust(v.x - U.dirX(v.yaw) * v.T.len * 0.5, v.y + 0.3, v.z - U.dirZ(v.yaw) * v.T.len * 0.5, 1.4); }
        else if (v.T.air && v.alt < 14 && v.state === 'active' && (v.crew.length || v.playerIn) && d2 < 300 * 300) { v.fxT = 0.12; IF.FX.dust(v.x + U.rr(-6, 6), B.W.groundAt(v.x, v.z) + 0.3, v.z + U.rr(-6, 6), 3); }
        else v.fxT = 0.3;
      }
    }
    // jets
    while (VR.jets.length < B.jets.length) { const m = new THREE.Mesh(VR.M.jet, VR.jetMat); m.castShadow = true; VR.group.add(m); VR.jets.push(m); }
    for (let k = 0; k < VR.jets.length; k++) {
      const m = VR.jets[k], j = B.jets[k];
      m.visible = !!j;
      if (j) { m.position.set(j.x, j.y, j.z); m.rotation.set(j.climb ? -0.3 : 0, j.yaw, j.roll || 0, 'YXZ'); }
    }
    while (VR.uavs.length < B.uavs.length) { const m = new THREE.Mesh(VR.M.uav, VR.jetMat); VR.group.add(m); VR.uavs.push(m); }
    for (let k = 0; k < B.uavs.length; k++) { const u = B.uavs[k], m = VR.uavs[k]; m.position.set(u.x, u.y, u.z); m.rotation.set(0, u.yaw, 0.25); m.scale.setScalar(1.6); }
  };

  VR.dispose = function () {
    if (!VR.group) return;
    IF.R.scene.remove(VR.group);
    VR.objs = new Map(); VR.jets = []; VR.uavs = []; VR.group = null;
  };
})(typeof window !== 'undefined' ? window : globalThis);
