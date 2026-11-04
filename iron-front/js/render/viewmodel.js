// First-person weapon view model: separate scene/camera so the gun never clips into walls.
(function (G) {
  'use strict';
  const IF = G.IF, U = IF.U;
  const VM = (IF.ViewModel = {});
  const DK = [0.12, 0.12, 0.13], MT = [0.22, 0.22, 0.23], WD = [0.36, 0.25, 0.15], SK = [0.78, 0.6, 0.48], GL = [0.25, 0.25, 0.27];

  function gunGeo(model, scope, acog, reddot, suppress) {
    const b = new IF.GEO.Builder();
    if (model === 'rifle' || model === 'smg') {
      const L = model === 'smg' ? 0.5 : 0.72;
      b.box(0.05, 0.08, L, 0, 0, -L / 2, DK);                 // receiver/barrel shroud
      b.cyl(0.012, 0.25, 0, 0.01, -L - 0.12, DK, Math.PI / 2, 0, 0);
      b.box(0.04, 0.13, 0.06, 0, -0.09, -0.12, DK, -0.25, 0, 0); // grip
      b.box(0.035, 0.16, 0.07, 0, -0.1, -0.28, MT, 0.15, 0, 0);  // magazine
      b.box(0.045, 0.07, 0.22, 0, -0.01, 0.12, DK);             // stock
      b.box(0.012, 0.03, 0.02, 0, 0.055, -L + 0.04, DK);         // front sight
      if (!scope && !acog && !reddot) b.box(0.03, 0.02, 0.03, 0, 0.055, -0.05, DK);
    } else if (model === 'mg') {
      b.box(0.08, 0.1, 0.9, 0, 0, -0.45, DK); b.cyl(0.018, 0.35, 0, 0.01, -1.0, DK, Math.PI / 2, 0, 0);
      b.box(0.11, 0.11, 0.14, 0.03, -0.11, -0.3, [0.28, 0.3, 0.22]); b.box(0.04, 0.12, 0.06, 0, -0.1, -0.1, DK, -0.25, 0, 0); b.box(0.05, 0.08, 0.25, 0, -0.01, 0.15, DK);
      b.box(0.012, 0.03, 0.02, 0, 0.06, -0.85, DK);
    } else if (model === 'sniper') {
      b.box(0.05, 0.08, 1.0, 0, 0, -0.45, WD); b.cyl(0.013, 0.35, 0, 0.02, -1.1, DK, Math.PI / 2, 0, 0);
      b.box(0.04, 0.12, 0.06, 0, -0.09, -0.08, WD, -0.3, 0, 0); b.box(0.05, 0.1, 0.3, 0, -0.02, 0.15, WD);
    } else if (model === 'pistol') {
      b.box(0.035, 0.05, 0.19, 0, 0, -0.08, DK); b.box(0.032, 0.11, 0.05, 0, -0.07, -0.01, DK, -0.2, 0, 0);
    } else if (model === 'at') {
      b.cyl(0.055, 1.05, 0.0, 0.0, -0.25, [0.3, 0.33, 0.24], Math.PI / 2, 0, 0); b.add(new THREE.ConeGeometry(0.06, 0.25, 8), 0, 0, -0.9, -Math.PI / 2, 0, 0, [0.32, 0.3, 0.22]);
      b.box(0.04, 0.12, 0.06, 0, -0.1, -0.1, DK, -0.2, 0, 0); b.box(0.03, 0.06, 0.06, -0.06, 0.06, -0.2, DK);
    }
    if (scope) { b.cyl(0.025, 0.32, 0, 0.075, -0.25, DK, Math.PI / 2, 0, 0); b.cyl(0.032, 0.05, 0, 0.075, -0.42, DK, Math.PI / 2, 0, 0); }
    else if (acog) { b.box(0.04, 0.05, 0.13, 0, 0.07, -0.18, DK); }
    else if (reddot) { b.box(0.035, 0.045, 0.06, 0, 0.065, -0.15, DK); b.box(0.025, 0.025, 0.005, 0, 0.07, -0.12, [0.6, 0.1, 0.1]); }
    if (suppress) b.cyl(0.022, 0.18, 0, 0.01, -0.85, DK, Math.PI / 2, 0, 0);
    return b.build();
  }
  function armsGeo(col) {
    const b = new IF.GEO.Builder();
    b.box(0.09, 0.09, 0.42, 0.07, -0.13, 0.12, col, 0.2, 0.15, 0);   // right forearm
    b.box(0.07, 0.08, 0.09, 0.02, -0.09, -0.1, SK);                 // right hand
    b.box(0.09, 0.09, 0.46, -0.13, -0.1, -0.12, col, 0.15, -0.5, 0); // left forearm
    b.box(0.07, 0.07, 0.09, -0.02, -0.06, -0.38, SK);                // left hand on the handguard
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
    VM.flash.position.set(0, 0.01, w.d.model === 'mg' ? -1.2 : w.d.model === 'sniper' ? -1.3 : w.d.model === 'pistol' ? -0.22 : w.d.model === 'at' ? -0.95 : w.d.model === 'smg' ? -0.68 : -0.95);
    VM.gunGroup.add(VM.flash);
    VM.root.add(VM.gunGroup);
    VM.sightY = w.d.scope ? 0.075 : n('4x ACOG') ? 0.095 : n('Red Dot Sight') ? 0.075 : 0.06;
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
    const adsX = 0, adsY = -VM.sightY, adsZ = -0.4;
    let x = U.lerp(hipX, adsX, ads) + Math.sin(VM.bob) * 0.012 * bobK + VM.sway.x;
    let y = U.lerp(hipY, adsY, ads) - Math.abs(Math.cos(VM.bob)) * 0.01 * bobK + VM.sway.y;
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
