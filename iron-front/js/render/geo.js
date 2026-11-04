// Low-poly geometry helpers: merge many primitive parts into one vertex-coloured BufferGeometry.
(function (G) {
  'use strict';
  const IF = G.IF;
  const GEO = (IF.GEO = {});

  GEO.Builder = function () { this.pos = []; this.nor = []; this.col = []; };
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
  const _n = new THREE.Matrix3();
  GEO.Builder.prototype.add = function (geom, x, y, z, rx, ry, rz, color, sx, sy, sz) {
    const g = geom.index ? geom.toNonIndexed() : geom;
    _e.set(rx || 0, ry || 0, rz || 0, 'YXZ'); _q.setFromEuler(_e);
    _p.set(x || 0, y || 0, z || 0); _s.set(sx || 1, sy || 1, sz || 1);
    _m.compose(_p, _q, _s); _n.getNormalMatrix(_m);
    const P = g.attributes.position, N = g.attributes.normal;
    const v = new THREE.Vector3(), nn = new THREE.Vector3();
    const c = Array.isArray(color) ? color : [((color >> 16) & 255) / 255, ((color >> 8) & 255) / 255, (color & 255) / 255];
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i).applyMatrix4(_m);
      nn.fromBufferAttribute(N, i).applyMatrix3(_n).normalize();
      this.pos.push(v.x, v.y, v.z); this.nor.push(nn.x, nn.y, nn.z); this.col.push(c[0], c[1], c[2]);
    }
    return this;
  };
  GEO.Builder.prototype.box = function (sx, sy, sz, x, y, z, color, rx, ry, rz) { return this.add(GEO.unitBox, x, y, z, rx, ry, rz, color, sx, sy, sz); };
  GEO.Builder.prototype.cyl = function (r, h, x, y, z, color, rx, ry, rz, seg) { return this.add(seg ? new THREE.CylinderGeometry(1, 1, 1, seg) : GEO.unitCyl, x, y, z, rx, ry, rz, color, r, h, r); };
  GEO.Builder.prototype.build = function () {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere();
    return g;
  };
  GEO.init = function () {
    GEO.unitBox = new THREE.BoxGeometry(1, 1, 1);
    GEO.unitCyl = new THREE.CylinderGeometry(1, 1, 1, 8);
    // prism: triangular cross-section in Y-Z, ridge along X (unit box bounds)
    const s = new THREE.Shape();
    s.moveTo(-0.5, -0.5); s.lineTo(0.5, -0.5); s.lineTo(0, 0.5); s.lineTo(-0.5, -0.5);
    const pg = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false });
    pg.translate(0, 0, -0.5);
    pg.rotateY(Math.PI / 2); // extrusion along X; triangle in Z-Y
    GEO.unitPrism = pg.toNonIndexed();
    GEO.unitPrism.computeVertexNormals();
    GEO.unitRock = new THREE.IcosahedronGeometry(0.6, 0);
  };
  GEO.lambert = function (opts) {
    return new THREE.MeshLambertMaterial(Object.assign({ vertexColors: true }, opts || {}));
  };
})(typeof window !== 'undefined' ? window : globalThis);
