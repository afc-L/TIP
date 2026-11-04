// First-person weapon view model: separate scene/camera so the gun never clips into walls.
(function (G) {
  'use strict';
  const IF = G.IF, U = IF.U;
  const VM = (IF.ViewModel = {});
  const DK = [0.12, 0.12, 0.13], MT = [0.22, 0.22, 0.23], WD = [0.36, 0.25, 0.15], SK = [0.78, 0.6, 0.48], GL = [0.25, 0.25, 0.27];

  // sight-line height (gun local Y) for each weapon / optic — ADS centres this on the screen
  VM.sightLine = function (model, scope, acog, reddot) {
    if (scope) return model === 'sniper' ? 0.085 : 0.1;
    if (acog) return 0.1;
    if (reddot) return 0.095;
    return model === 'pistol' ? 0.042 : model === 'at' ? 0.105 : 0.075;
  };
  const HALF = Math.PI / 2;
  const tcyl = (b, rT, rB, h, x, y, z, col, seg) => b.add(new THREE.CylinderGeometry(rT, rB, h, seg || 12), x, y, z, HALF, 0, 0, col);
  function ironSights(b, frontZ, rearZ, SY) {
    // rear aperture (peep) with protective ears
    b.add(new THREE.TorusGeometry(0.0085, 0.0028, 6, 16), 0, SY, rearZ, 0, 0, 0, DK);
    b.rbox(0.004, 0.026, 0.018, 0.016, SY - 0.004, rearZ, DK, 0, 0, 0, 0.0015); b.rbox(0.004, 0.026, 0.018, -0.016, SY - 0.004, rearZ, DK, 0, 0, 0, 0.0015);
    b.rbox(0.036, 0.016, 0.03, 0, SY - 0.018, rearZ, DK, 0, 0, 0, 0.004);
    // front post inside a ring guard
    b.rbox(0.0032, 0.022, 0.004, 0, SY - 0.011, frontZ, DK, 0, 0, 0, 0.001);
    b.add(new THREE.TorusGeometry(0.014, 0.0022, 6, 18), 0, SY - 0.004, frontZ, 0, 0, 0, DK);
    b.rbox(0.02, 0.03, 0.02, 0, SY - 0.032, frontZ, DK, 0, 0, 0, 0.004);
  }
  function gunGeo(model, scope, acog, reddot, suppress) {
    const b = new IF.GEO.Builder();
    const SY = VM.sightLine(model, scope, acog, reddot);
    const optic = scope || acog || reddot;
    let muzzleZ = -0.95;
    if (model === 'rifle' || model === 'smg') {
      const L = model === 'smg' ? 0.42 : 0.62;
      b.rbox(0.052, 0.07, 0.32, 0, 0.0, -0.1, DK, 0, 0, 0, 0.012);                 // upper receiver
      b.rbox(0.05, 0.05, 0.3, 0, -0.05, -0.08, MT, 0, 0, 0, 0.01);                 // lower receiver
      b.rbox(0.02, 0.014, 0.4, 0, 0.042, -0.18, DK, 0, 0, 0, 0.003);               // top rail
      for (let k = 0; k < 9; k++) b.rbox(0.024, 0.006, 0.012, 0, 0.051, -0.02 - k * 0.04, MT, 0, 0, 0, 0.002);
      b.rbox(0.06, 0.065, L - 0.24, 0, 0.0, -0.25 - (L - 0.24) / 2, [0.2, 0.2, 0.21], 0, 0, 0, 0.018); // handguard
      tcyl(b, 0.011, 0.011, 0.26, 0, 0.0, -L - 0.11, DK, 10);                      // barrel
      tcyl(b, 0.016, 0.016, 0.05, 0, 0.0, -L - 0.25, DK, 10);                      // flash hider
      b.rbox(0.034, 0.12, 0.05, 0, -0.1, -0.02, DK, -0.3, 0, 0, 0.01);             // pistol grip
      b.rbox(0.028, 0.16, 0.06, 0, -0.13, -0.16, MT, 0.18, 0, 0, 0.008);           // magazine
      b.rbox(0.03, 0.025, 0.06, 0, -0.06, -0.04, DK, 0, 0, 0, 0.006);              // trigger guard
      b.rbox(0.04, 0.06, 0.2, 0, -0.02, 0.15, DK, 0, 0, 0, 0.014);                 // stock
      b.rbox(0.045, 0.09, 0.03, 0, -0.03, 0.26, [0.1, 0.1, 0.1], 0, 0, 0, 0.01);   // butt pad
      if (!optic) ironSights(b, -L + 0.03, -0.02, SY);
      else b.rbox(0.012, 0.03, 0.012, 0, SY - 0.03, -L + 0.03, DK, 0, 0, 0, 0.002); // folded front sight
      muzzleZ = -L - 0.3;
    } else if (model === 'mg') {
      b.rbox(0.08, 0.1, 0.5, 0, 0, -0.2, DK, 0, 0, 0, 0.02);
      b.rbox(0.07, 0.07, 0.3, 0, 0.0, -0.6, [0.2, 0.2, 0.21], 0, 0, 0, 0.02);
      tcyl(b, 0.017, 0.017, 0.4, 0, 0.0, -0.95, DK, 10);
      b.rbox(0.12, 0.12, 0.14, 0.03, -0.12, -0.22, [0.28, 0.3, 0.22], 0, 0, 0, 0.02);   // ammo box
      b.rbox(0.035, 0.12, 0.05, 0, -0.1, 0.0, DK, -0.3, 0, 0, 0.01);
      b.rbox(0.05, 0.08, 0.24, 0, -0.01, 0.18, DK, 0, 0, 0, 0.016);
      b.rbox(0.09, 0.012, 0.16, 0, 0.055, -0.2, MT, 0, 0, 0, 0.004);                  // feed cover
      if (!optic) ironSights(b, -0.8, -0.05, SY);
      muzzleZ = -1.2;
    } else if (model === 'sniper') {
      b.rbox(0.055, 0.075, 0.9, 0, -0.01, -0.35, WD, 0, 0, 0, 0.02);
      b.rbox(0.05, 0.05, 0.28, 0, 0.02, -0.1, DK, 0, 0, 0, 0.012);
      tcyl(b, 0.012, 0.015, 0.45, 0, 0.01, -1.02, DK, 10);
      b.rbox(0.04, 0.12, 0.06, 0, -0.09, -0.02, WD, -0.3, 0, 0, 0.012); b.rbox(0.05, 0.1, 0.3, 0, -0.03, 0.2, WD, 0, 0, 0, 0.02);
      tcyl(b, 0.005, 0.005, 0.12, 0.03, 0.02, -0.02, DK, 6);                        // bolt
      muzzleZ = -1.3;
    } else if (model === 'pistol') {
      b.rbox(0.032, 0.035, 0.19, 0, 0.0, -0.08, DK, 0, 0, 0, 0.008);
      b.rbox(0.03, 0.03, 0.17, 0, -0.03, -0.07, MT, 0, 0, 0, 0.008);
      b.rbox(0.03, 0.11, 0.05, 0, -0.08, 0.0, DK, -0.2, 0, 0, 0.01);
      // rear notch + front post
      b.rbox(0.008, 0.012, 0.01, 0.009, SY - 0.006, 0.005, DK, 0, 0, 0, 0.002); b.rbox(0.008, 0.012, 0.01, -0.009, SY - 0.006, 0.005, DK, 0, 0, 0, 0.002);
      b.rbox(0.004, 0.012, 0.006, 0, SY - 0.006, -0.165, DK, 0, 0, 0, 0.001);
      muzzleZ = -0.22;
    } else if (model === 'at') {
      tcyl(b, 0.05, 0.05, 1.0, 0.0, 0.0, -0.25, [0.3, 0.33, 0.24], 14);
      b.add(new THREE.ConeGeometry(0.065, 0.26, 12), 0, 0, -0.88, -HALF, 0, 0, [0.32, 0.3, 0.22]);
      tcyl(b, 0.06, 0.07, 0.12, 0, 0, 0.27, DK, 14);
      b.rbox(0.035, 0.11, 0.05, 0, -0.09, -0.08, DK, -0.2, 0, 0, 0.01);
      // flip-up sights on top
      b.rbox(0.004, 0.05, 0.004, 0, SY - 0.025, -0.45, DK, 0, 0, 0, 0.001);
      b.add(new THREE.TorusGeometry(0.009, 0.0028, 6, 14), 0, SY, -0.05, 0, 0, 0, DK);
      b.rbox(0.02, 0.05, 0.02, 0, SY - 0.035, -0.05, DK, 0, 0, 0, 0.004);
      muzzleZ = -0.95;
    }
    if (scope) {
      const sy = SY, z0 = model === 'sniper' ? -0.22 : -0.2;
      tcyl(b, 0.024, 0.024, 0.26, 0, sy, z0, DK, 16);
      tcyl(b, 0.031, 0.026, 0.07, 0, sy, z0 - 0.16, DK, 16); tcyl(b, 0.028, 0.024, 0.06, 0, sy, z0 + 0.15, DK, 16);
      tcyl(b, 0.012, 0.012, 0.03, 0, sy + 0.028, z0, MT, 8);
      b.rbox(0.02, 0.03, 0.02, 0, sy - 0.03, z0 - 0.07, DK, 0, 0, 0, 0.004); b.rbox(0.02, 0.03, 0.02, 0, sy - 0.03, z0 + 0.07, DK, 0, 0, 0, 0.004);
    } else if (acog) {
      b.rbox(0.045, 0.05, 0.14, 0, SY, -0.15, DK, 0, 0, 0, 0.012);
      tcyl(b, 0.022, 0.022, 0.05, 0, SY, -0.24, DK, 14); tcyl(b, 0.017, 0.017, 0.03, 0, SY, -0.065, DK, 14);
      b.rbox(0.03, 0.03, 0.06, 0, SY - 0.04, -0.15, DK, 0, 0, 0, 0.005);
    } else if (reddot) {
      b.add(new THREE.TorusGeometry(0.023, 0.005, 8, 24), 0, SY, -0.15, 0, 0, 0, DK);
      b.rbox(0.03, 0.03, 0.05, 0, SY - 0.034, -0.15, DK, 0, 0, 0, 0.006);
      b.rbox(0.008, 0.012, 0.012, 0.026, SY, -0.15, DK, 0, 0, 0, 0.002);
    }
    if (suppress) tcyl(b, 0.022, 0.022, 0.2, 0, 0.0, muzzleZ + 0.02, DK, 12);
    const g = b.build();
    g.userData = { muzzleZ: suppress ? muzzleZ - 0.18 : muzzleZ, SY };
    return g;
  }
  function armsGeo(col) {
    const b = new IF.GEO.Builder();
    const GL = [0.17, 0.16, 0.15];
    b.add(new THREE.CylinderGeometry(0.042, 0.05, 0.36, 12), 0.08, -0.13, 0.13, HALF + 0.2, 0.15, 0, col);     // right sleeve
    b.rbox(0.06, 0.075, 0.1, 0.02, -0.075, -0.04, GL, 0, 0, 0, 0.022);                                       // right glove on the grip
    b.add(new THREE.CylinderGeometry(0.042, 0.05, 0.42, 12), -0.12, -0.11, -0.12, HALF + 0.15, -0.5, 0, col);  // left sleeve
    b.rbox(0.065, 0.06, 0.1, -0.015, -0.05, -0.36, GL, 0, 0, 0.3, 0.022);                                    // left glove under the handguard
    return b.build();
  }

  VM.init = function () {
    VM.scene = new THREE.Scene();
    VM.cam = IF.R.vmCamera = new THREE.PerspectiveCamera(60, G.innerWidth / G.innerHeight, 0.01, 10);
    VM.hemi = new THREE.HemisphereLight(0xd0dcff, 0x504a3c, 1.2); VM.scene.add(VM.hemi);
    VM.dir = new THREE.DirectionalLight(0xffffff, 1.5); VM.dir.position.set(0.5, 1, 0.3); VM.scene.add(VM.dir);
    VM.root = new THREE.Group(); VM.scene.add(VM.root);
    VM.mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    VM.armsMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    VM.cache = {};
    const fl = document.createElement('canvas'); fl.width = fl.height = 64; const x = fl.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,240,200,1)'); g.addColorStop(0.3, 'rgba(255,180,80,0.9)'); g.addColorStop(1, 'rgba(255,120,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    VM.flash = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.28), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(fl), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    VM.binoc = new IF.GEO.Builder().cyl(0.035, 0.14, -0.045, 0, -0.05, DK, Math.PI / 2, 0, 0).cyl(0.035, 0.14, 0.045, 0, -0.05, DK, Math.PI / 2, 0, 0).box(0.05, 0.04, 0.06, 0, 0.0, -0.02, MT).build();
    VM.sway = { x: 0, y: 0 }; VM.bob = 0; VM.key = '';
  };

  VM.setWeapon = function (w, team) {
    const P = IF.Player;
    const key = w.id + ':' + w.atts.map((a) => a.name).join(',') + ':' + team + ':' + (P.uniformTint ? P.uniformTint.getHexString() : '');
    if (key === VM.key) return;
    VM.key = key;
    while (VM.root.children.length) VM.root.remove(VM.root.children[0]);
    const n = (s) => w.atts.some((a) => a.name === s);
    const geo = gunGeo(w.d.model, w.d.scope, n('4x ACOG'), n('Red Dot Sight'), n('Suppressor'));
    VM.gun = new THREE.Mesh(geo, VM.mat);
    const t = IF.TEAMS[team].uniform;
    const col = P.uniformTint ? [P.uniformTint.r, P.uniformTint.g, P.uniformTint.b] : t;
    VM.arms = new THREE.Mesh(armsGeo(col), VM.armsMat);
    VM.gunGroup = new THREE.Group(); VM.gunGroup.add(VM.gun); VM.gunGroup.add(VM.arms);
    VM.flash.position.set(0, 0.0, geo.userData.muzzleZ);
    VM.gunGroup.add(VM.flash);
    // glowing red-dot reticle
    if (n('Red Dot Sight')) {
      VM.dot = VM.dot || new THREE.Mesh(new THREE.SphereGeometry(0.0016, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2a1a }));
      VM.dot.position.set(0, geo.userData.SY, -0.152);
      VM.gunGroup.add(VM.dot);
    }
    VM.root.add(VM.gunGroup);
    VM.sightY = geo.userData.SY;
  };

  VM.render = function (renderer, dt) {
    const P = IF.Player, B = IF.B;
    if (!P || !P.alive || P.veh || !P.viewFP || !B) return;
    const w = P.weapon();
    if (!w) return;
    VM.setWeapon(w, B.playerTeam);
    const scoped = P.ads > 0.8 && w.scope;
    VM.gunGroup.visible = !scoped && !P.binoc;
    if (!VM.gunGroup.visible) return;
    VM.cam.fov = 50; VM.cam.updateProjectionMatrix();
    // sway & bob
    VM.sway.x = U.lerp(VM.sway.x, -IF.Input.mx * 0.0006, Math.min(1, dt * 8));
    VM.sway.y = U.lerp(VM.sway.y, IF.Input.my * 0.0006, Math.min(1, dt * 8));
    const sp = Math.sqrt(P.vx * P.vx + P.vz * P.vz);
    VM.bob += dt * sp * 2.2;
    const bobK = (P.ads > 0.5 ? 0.15 : 1) * Math.min(1, sp / 3);
    const ads = P.ads;
    const hipX = 0.19, hipY = -0.2, hipZ = -0.52;
    const adsX = 0, adsY = -VM.sightY, adsZ = -0.36;
    let x = U.lerp(hipX, adsX, ads) + Math.sin(VM.bob) * 0.012 * bobK + VM.sway.x * (1 - ads * 0.85);
    let y = U.lerp(hipY, adsY, ads) - Math.abs(Math.cos(VM.bob)) * 0.01 * bobK + VM.sway.y * (1 - ads * 0.85);
    let z = U.lerp(hipZ, adsZ, ads);
    let rx = 0, ry = 0, rz = 0;
    P.kick = Math.max(0, (P.kick || 0) - dt * 9);
    z += P.kick * 0.045; rx += P.kick * 0.07;
    if (P.sprint) { const k = 1; x += 0.05 * k; y -= 0.06 * k; ry += 0.6 * k; rx -= 0.25 * k; }
    if (P.reloadT > 0) { const t = P.reloadT / (w.d.reload * w.reloadMul); const k = Math.sin(Math.min(1, (1 - t)) * Math.PI); y -= 0.1 * k; rx -= 0.5 * k; rz += 0.6 * k; }
    if (P.switchT > 0) { y -= P.switchT * 0.45; rx -= P.switchT * 1.2; }
    if (P.throwAnim > 0) { P.throwAnim -= dt; y -= 0.15; }
    rz += -P.lean * 0.1;
    VM.gunGroup.position.set(x, y, z);
    VM.gunGroup.rotation.set(rx, ry, rz);
    VM.flash.visible = P.kick > 0.75 && !w.quiet;
    VM.flash.rotation.z = Math.random() * 6;
    // match world lighting
    VM.hemi.intensity = IF.R.hemi.intensity * 0.9 + 0.15;
    VM.dir.intensity = IF.R.sun.intensity * 0.6 + 0.2;
    renderer.clearDepth();
    renderer.render(VM.scene, VM.cam);
  };
})(typeof window !== 'undefined' ? window : globalThis);
