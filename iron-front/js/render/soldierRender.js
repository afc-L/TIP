// Soldier rendering with level of detail: articulated instanced models near the camera,
// a single merged low-poly instanced model further away, and instanced corpses.
(function (G) {
  'use strict';
  const IF = G.IF, U = IF.U, ST = IF.ST, ROLE = IF.ROLE;
  const SR = (IF.SoldierRender = {});

  const SKIN = [0.78, 0.6, 0.48], DARK = [0.14, 0.14, 0.14], GEAR = [0.75, 0.72, 0.6], BOOT = [0.18, 0.15, 0.12];

  function partGeos() {
    const P = {};
    let b;
    // thigh (pivot at hip, extends down)
    b = new IF.GEO.Builder(); b.box(0.17, 0.46, 0.2, 0, -0.23, 0, [1, 1, 1]); P.thigh = b.build();
    // shin + boot (pivot at knee)
    b = new IF.GEO.Builder(); b.box(0.15, 0.44, 0.17, 0, -0.22, 0, [1, 1, 1]); b.box(0.16, 0.1, 0.3, 0, -0.45, -0.05, BOOT); P.shin = b.build();
    // torso + vest + backpack (pivot at hips)
    b = new IF.GEO.Builder();
    b.box(0.42, 0.56, 0.24, 0, 0.29, 0, [1, 1, 1]);
    b.box(0.44, 0.3, 0.28, 0, 0.36, -0.01, [0.8, 0.8, 0.75]);          // vest (tinted darker)
    b.box(0.3, 0.38, 0.17, 0, 0.36, 0.2, GEAR);                       // pack
    b.box(0.1, 0.12, 0.08, 0.12, 0.25, -0.15, [0.7, 0.7, 0.65]); b.box(0.1, 0.12, 0.08, -0.12, 0.25, -0.15, [0.7, 0.7, 0.65]);
    b.box(0.16, 0.08, 0.14, 0, 0.6, 0, SKIN); // neck
    P.torso = b.build();
    // head (pivot at hips -> offset)
    b = new IF.GEO.Builder(); b.box(0.2, 0.24, 0.22, 0, 0.76, -0.01, SKIN); b.box(0.16, 0.04, 0.02, 0, 0.78, -0.125, [0.2, 0.18, 0.16]); P.head = b.build();
    // helmet
    b = new IF.GEO.Builder(); b.add(new THREE.SphereGeometry(0.16, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), 0, 0.82, 0, 0, 0, 0, [1, 1, 1], 1, 0.9, 1.08); b.box(0.34, 0.025, 0.36, 0, 0.82, 0, [1, 1, 1]); P.helmet = b.build();
    // arms + weapon variants (pivot at shoulder height, chest centre)
    const arms = (gun) => {
      const a = new IF.GEO.Builder();
      // right arm: upper arm down/forward, forearm to grip
      a.box(0.12, 0.3, 0.12, 0.25, -0.12, -0.06, [1, 1, 1], 0.5, 0, 0);
      a.box(0.1, 0.1, 0.32, 0.18, -0.24, -0.26, [1, 1, 1], 0, 0.3, 0);
      a.box(0.09, 0.09, 0.09, 0.1, -0.24, -0.42, SKIN);
      // left arm reaching to the handguard
      a.box(0.12, 0.28, 0.12, -0.25, -0.1, -0.1, [1, 1, 1], 0.7, 0, 0);
      a.box(0.1, 0.1, 0.36, -0.12, -0.2, -0.38, [1, 1, 1], 0, -0.45, 0);
      a.box(0.09, 0.09, 0.09, -0.03, -0.18, -0.6, SKIN);
      if (gun === 'rifle') { a.box(0.06, 0.1, 0.82, 0.06, -0.16, -0.48, DARK); a.box(0.05, 0.16, 0.08, 0.06, -0.26, -0.42, DARK); a.box(0.06, 0.05, 0.18, 0.06, -0.08, -0.3, DARK); }
      else if (gun === 'mg') { a.box(0.09, 0.13, 1.0, 0.06, -0.16, -0.52, DARK); a.box(0.14, 0.13, 0.16, 0.06, -0.29, -0.4, [0.3, 0.32, 0.25]); }
      else if (gun === 'sniper') { a.box(0.06, 0.09, 1.15, 0.06, -0.16, -0.6, [0.25, 0.2, 0.14]); a.cyl(0.035, 0.32, 0.06, -0.06, -0.42, DARK, Math.PI / 2, 0, 0); }
      else if (gun === 'at') { a.box(0.06, 0.1, 0.7, 0.06, -0.16, -0.42, DARK); a.cyl(0.08, 1.1, 0.16, 0.12, -0.1, [0.3, 0.33, 0.25], Math.PI / 2, 0, 0); }
      return a.build();
    };
    P.arms = { rifle: arms('rifle'), mg: arms('mg'), sniper: arms('sniper'), at: arms('at') };
    // far LOD: one merged standing figure (pivot at feet)
    b = new IF.GEO.Builder();
    b.box(0.18, 0.92, 0.2, 0.11, 0.46, 0, [1, 1, 1]); b.box(0.18, 0.92, 0.2, -0.11, 0.46, 0, [1, 1, 1]);
    b.box(0.44, 0.58, 0.28, 0, 1.22, 0, [1, 1, 1]); b.box(0.3, 0.36, 0.16, 0, 1.25, 0.2, GEAR);
    b.box(0.2, 0.24, 0.22, 0, 1.66, 0, SKIN); b.box(0.32, 0.12, 0.32, 0, 1.8, 0, [0.85, 0.85, 0.85]);
    b.box(0.1, 0.42, 0.12, 0.27, 1.2, -0.1, [1, 1, 1], 0.6, 0, 0); b.box(0.1, 0.42, 0.12, -0.27, 1.2, -0.12, [1, 1, 1], 0.9, 0, 0);
    b.box(0.07, 0.1, 0.85, 0.05, 1.2, -0.42, DARK);
    P.far = b.build();
    // headless variant for decapitated corpses
    b = new IF.GEO.Builder();
    b.box(0.18, 0.92, 0.2, 0.11, 0.46, 0, [1, 1, 1]); b.box(0.18, 0.92, 0.2, -0.11, 0.46, 0, [1, 1, 1]);
    b.box(0.44, 0.58, 0.28, 0, 1.22, 0, [1, 1, 1]); b.box(0.3, 0.36, 0.16, 0, 1.25, 0.2, GEAR);
    b.box(0.17, 0.07, 0.17, 0, 1.54, 0, [0.45, 0.05, 0.04]);
    b.box(0.1, 0.42, 0.12, 0.27, 1.2, -0.1, [1, 1, 1], 0.6, 0, 0); b.box(0.1, 0.42, 0.12, -0.27, 1.2, -0.12, [1, 1, 1], 0.9, 0, 0);
    P.headless = b.build();
    return P;
  }

  SR.build = function (B) {
    const q = IF.R.q;
    SR.maxNear = q.maxNear; SR.nearDist = q.near;
    const P = (SR.P = partGeos());
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const mk = (geo, n, shadow) => { const m = new THREE.InstancedMesh(geo, mat, n); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.castShadow = !!shadow; m.frustumCulled = false; m.count = 0; IF.R.scene.add(m); return m; };
    const N = SR.maxNear;
    SR.near = {
      torso: mk(P.torso, N, true), head: mk(P.head, N, false), helmet: mk(P.helmet, N, false),
      thighL: mk(P.thigh, N, true), thighR: mk(P.thigh, N, true), shinL: mk(P.shin, N, false), shinR: mk(P.shin, N, false),
      arms: { rifle: mk(P.arms.rifle, N, true), mg: mk(P.arms.mg, 40, true), sniper: mk(P.arms.sniper, 40, true), at: mk(P.arms.at, 40, true) },
    };
    SR.far = mk(P.far, IF.CFG.MAX_SOLDIERS, false);
    SR.corpse = mk(P.far, 480, false);
    SR.corpseHL = mk(P.headless, 200, false);
    // pre-allocate colour buffers
    const all = [SR.near.torso, SR.near.head, SR.near.helmet, SR.near.thighL, SR.near.thighR, SR.near.shinL, SR.near.shinR, SR.near.arms.rifle, SR.near.arms.mg, SR.near.arms.sniper, SR.near.arms.at, SR.far, SR.corpse, SR.corpseHL];
    const c = new THREE.Color(1, 1, 1);
    for (const m of all) { for (let i = 0; i < m.instanceMatrix.count; i++) m.setColorAt(i, c); m.instanceColor.setUsage(THREE.DynamicDrawUsage); }
    SR.all = all;
    SR.frustum = new THREE.Frustum();
    SR.teamCol = IF.TEAMS.map((t) => new THREE.Color(t.uniform[0], t.uniform[1], t.uniform[2]));
    SR.helmCol = IF.TEAMS.map((t) => new THREE.Color(t.helmet[0], t.helmet[1], t.helmet[2]));
    SR.nearList = new Int32Array(N);
  };

  const M = new THREE.Matrix4(), Mb = new THREE.Matrix4(), Mp = new THREE.Matrix4(), Mt = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), Sc = new THREE.Vector3(1, 1, 1), E = new THREE.Euler();
  const Csk = new THREE.Color(), Cw = new THREE.Color(1, 1, 1), Cd = new THREE.Color();
  const sphere = new THREE.Sphere(new THREE.Vector3(), 1.6);

  function setRT(m, x, y, z, ex, ey, ez) { E.set(ex, ey, ez, 'YXZ'); Q.setFromEuler(E); V.set(x, y, z); Sc.set(1, 1, 1); m.compose(V, Q, Sc); return m; }

  SR.update = function (B, dt, hideIdx) {
    const S = B.S, cam = IF.R.camera;
    SR.frustum.setFromProjectionMatrix(Mt.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    const cx = cam.position.x, cz = cam.position.z;
    const farD = IF.R.scene.fog.far + 50, farD2 = farD * farD;
    const nearD2 = SR.nearDist * SR.nearDist;
    let nf = 0, nn = 0;
    const N = SR.near;
    const cnt = { torso: 0, rifle: 0, mg: 0, sniper: 0, at: 0 };
    const playerTint = IF.Player && IF.Player.uniformTint;
    for (let i = 0; i < S.n; i++) {
      const st = S.st[i];
      if (st === ST.DEAD || st === ST.MOUNTED || i === hideIdx) continue;
      const x = S.x[i], z = S.z[i];
      const dx = x - cx, dz = z - cz, d2 = dx * dx + dz * dz;
      if (d2 > farD2) continue;
      sphere.center.set(x, S.y[i] + 0.9, z);
      if (!SR.frustum.intersectsSphere(sphere)) continue;
      const team = S.team[i];
      const col = i === B.playerIdx && playerTint ? playerTint : SR.teamCol[team];
      if (d2 < nearD2 && nn < SR.maxNear) {
        // ---------- detailed model ----------
        nn++;
        const yaw = S.yaw[i], y = S.y[i];
        const downed = st === ST.DOWNED;
        const stance = downed ? 3 : S.stance[i];
        const spd = S.spd[i];
        const ph = S.anim[i] * 1.0;
        const swing = Math.min(1, spd / 3) * (stance === 0 ? 0.6 : 0.35);
        // body base
        setRT(Mb, x, y, z, 0, yaw, 0);
        let hipY = 0.95, torsoP = 0, thL = Math.sin(ph) * swing, thR = -Math.sin(ph) * swing, shL = Math.max(0, -Math.sin(ph)) * swing * 1.4, shR = Math.max(0, Math.sin(ph)) * swing * 1.4;
        let lean = S.lean[i] * 0.3;
        let armP = S.aimP[i] || 0;
        if (spd > 4.5 && stance === 0) torsoP = 0.25;
        if (stance === 1) { hipY = 0.6; thL = 1.25 + thL * 0.3; shL = -1.35; thR = 0.15; shR = -1.5 + 0.1; torsoP = 0.18; }
        if (stance === 2 || stance === 3) {
          // lying: rotate whole frame
          Mp.makeRotationX(stance === 3 ? Math.PI / 2 : -Math.PI / 2);
          Mt.makeTranslation(0, stance === 3 ? 0.18 : 0.2, stance === 3 ? -0.9 : 0.95);
          Mb.multiply(Mt).multiply(Mp);
          hipY = 0; torsoP = 0; thL = Math.sin(ph * 2) * swing * 0.5; thR = -thL; shL = 0.15; shR = 0.15;
          armP = stance === 3 ? -0.4 + Math.sin(B.time * 6 + i) * 0.1 : Math.PI / 2 + armP;
          lean = 0;
        }
        if (S.reloadAnim[i] > 0 && stance !== 3) armP -= 0.6;
        // torso
        M.copy(Mb).multiply(setRT(Mp, 0, hipY, 0, torsoP, 0, lean));
        const ti = cnt.torso;
        N.torso.setMatrixAt(ti, M); N.torso.setColorAt(ti, col);
        N.head.setMatrixAt(ti, M); N.head.setColorAt(ti, Cw);
        N.helmet.setMatrixAt(ti, M); N.helmet.setColorAt(ti, i === B.playerIdx && playerTint ? playerTint : SR.helmCol[team]);
        // arms + weapon (pivot at chest)
        const role = S.role[i];
        let gun = 'rifle';
        if (i === B.playerIdx && IF.Player) gun = IF.Player.tpGun(); else if (role === ROLE.MG) gun = 'mg'; else if (role === ROLE.RECON) gun = 'sniper'; else if (role === ROLE.AT) gun = 'at';
        if (cnt[gun] >= N.arms[gun].instanceMatrix.count) gun = 'rifle';
        Mt.copy(M).multiply(setRT(Mp, 0, 0.5, 0, stance === 2 ? Math.PI / 2 - Math.PI / 2 + armP - Math.PI / 2 * 0 : armP, 0, 0));
        if (stance === 2) { Mt.copy(M).multiply(setRT(Mp, 0, 0.5, 0, armP - Math.PI / 2 + Math.PI / 2, 0, 0)); }
        N.arms[gun].setMatrixAt(cnt[gun], Mt); N.arms[gun].setColorAt(cnt[gun], col); cnt[gun]++;
        // legs
        const legs = [[N.thighL, N.shinL, 0.11, thL, shL], [N.thighR, N.shinR, -0.11, thR, shR]];
        for (const [tm, sm, lx, ta, sa] of legs) {
          M.copy(Mb).multiply(setRT(Mp, lx, hipY, 0, -ta, 0, 0));
          tm.setMatrixAt(ti, M); tm.setColorAt(ti, col);
          M.multiply(setRT(Mp, 0, -0.46, 0, sa, 0, 0));
          sm.setMatrixAt(ti, M); sm.setColorAt(ti, col);
        }
        cnt.torso++;
      } else {
        // ---------- far model ----------
        const stance = st === ST.DOWNED ? 2 : S.stance[i];
        const bob = S.spd[i] > 0.5 ? Math.abs(Math.sin(S.anim[i])) * 0.06 : 0;
        if (stance === 2) { setRT(M, x, S.y[i] + 0.2, z, -Math.PI / 2, S.yaw[i], 0); M.multiply(Mt.makeTranslation(0, -0.9, 0)); }
        else { setRT(M, x, S.y[i] + bob, z, 0, S.yaw[i], 0); if (stance === 1) M.scale(V.set(1, 0.72, 1)); }
        SR.far.setMatrixAt(nf, M); SR.far.setColorAt(nf, col);
        nf++;
      }
    }
    N.torso.count = N.head.count = N.helmet.count = N.thighL.count = N.thighR.count = N.shinL.count = N.shinR.count = cnt.torso;
    for (const g of ['rifle', 'mg', 'sniper', 'at']) N.arms[g].count = cnt[g];
    SR.far.count = nf;
    // corpses
    let nc = 0, nh = 0;
    for (let k = B.corpses.length - 1; k >= 0 && nc < 480; k--) {
      const c = B.corpses[k];
      if (c.gib && c.goreDone) continue; // blown apart: only the pieces remain
      const dx = c.x - cx, dz = c.z - cz;
      if (dx * dx + dz * dz > 450 * 450) continue;
      setRT(M, c.x, c.y + 0.16, c.z, -Math.PI / 2 * c.roll, c.yaw, c.roll * 0.4);
      M.multiply(Mt.makeTranslation(0, -0.9, 0));
      Cd.copy(SR.teamCol[c.team]).multiplyScalar(0.75);
      if (c.headless && nh < 200) { SR.corpseHL.setMatrixAt(nh, M); SR.corpseHL.setColorAt(nh, Cd); nh++; continue; }
      SR.corpse.setMatrixAt(nc, M);
      SR.corpse.setColorAt(nc, Cd);
      nc++;
    }
    SR.corpse.count = nc; SR.corpseHL.count = nh;
    for (const m of SR.all) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    SR.stats = { near: cnt.torso, far: nf, corpses: nc };
  };

  SR.dispose = function () {
    if (!SR.all) return;
    for (const m of SR.all) { IF.R.scene.remove(m); m.dispose(); }
    SR.all = null;
  };
})(typeof window !== 'undefined' ? window : globalThis);
