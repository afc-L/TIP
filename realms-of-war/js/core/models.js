// Procedural low-poly models. Each model is a single merged BufferGeometry with baked vertex
// colours so a whole regiment renders as one InstancedMesh draw call.
(function () {
  const RW = window.RW;
  const T = THREE;

  const _m = new T.Matrix4(), _q = new T.Quaternion(), _e = new T.Euler(), _s = new T.Vector3(), _p = new T.Vector3();
  const _c = new T.Color();

  class Builder {
    constructor() { this.pos = []; this.nor = []; this.col = []; }
    // Add a primitive geometry, transformed and flat-coloured.
    add(geo, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
      let g = geo.index ? geo.toNonIndexed() : geo.clone();
      _e.set(rx, ry, rz); _q.setFromEuler(_e); _p.set(x, y, z); _s.set(sx, sy, sz);
      _m.compose(_p, _q, _s);
      g.applyMatrix4(_m);
      g.computeVertexNormals();
      const p = g.attributes.position.array, n = g.attributes.normal.array;
      _c.set(color);
      for (let i = 0; i < p.length; i += 3) {
        this.pos.push(p[i], p[i + 1], p[i + 2]);
        this.nor.push(n[i], n[i + 1], n[i + 2]);
        // Tiny per-face shading variation for a hand-painted look.
        this.col.push(_c.r, _c.g, _c.b);
      }
      g.dispose();
      return this;
    }
    build() {
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(this.pos, 3));
      g.setAttribute('normal', new T.Float32BufferAttribute(this.nor, 3));
      g.setAttribute('color', new T.Float32BufferAttribute(this.col, 3));
      g.computeBoundingSphere();
      return g;
    }
  }

  // Shared primitive geometries.
  const box = new T.BoxGeometry(1, 1, 1);
  const cyl = new T.CylinderGeometry(0.5, 0.5, 1, 6);
  const cone = new T.ConeGeometry(0.5, 1, 6);
  const sph = new T.SphereGeometry(0.5, 6, 4);
  const oct = new T.OctahedronGeometry(0.5, 0);
  const dod = new T.DodecahedronGeometry(0.5, 0);
  const torusHalf = new T.TorusGeometry(0.45, 0.03, 3, 8, Math.PI);
  const PRIM = { box, cyl, cone, sph, oct, dod };

  const SKIN = '#d9a97f', DARK = '#3b3128', WOOD = '#7a5532', GOLD = '#e0b84a';

  function addHumanoid(b, o, F, oy = 0, seated = false) {
    const skin = o.skin || SKIN;
    const isOrc = !!o.skin;
    const bodyCol = { tunic: F.cloth, mail: '#8d939b', plate: F.metal, robe: F.cloth, rags: '#6b5238', scrap: '#5a5048' }[o.body] || F.cloth;
    const legCol = o.body === 'plate' ? F.metal : o.body === 'robe' ? F.cloth : DARK;
    // Legs
    if (seated) {
      b.add(box, legCol, -0.2, oy + 0.95, 0.1, -1.2, 0, 0.3, 0.17, 0.6, 0.18);
      b.add(box, legCol, 0.2, oy + 0.95, 0.1, -1.2, 0, -0.3, 0.17, 0.6, 0.18);
    } else if (o.body === 'robe') {
      b.add(cone, bodyCol, 0, oy + 0.55, 0, 0, 0, 0, 0.8, 1.1, 0.6);
    } else {
      b.add(box, legCol, -0.13, oy + 0.42, 0, 0, 0, 0, 0.18, 0.84, 0.2);
      b.add(box, legCol, 0.13, oy + 0.42, 0, 0, 0, 0, 0.18, 0.84, 0.2);
    }
    const ty = oy + (seated ? 1.45 : 1.15);
    // Torso + tabard
    b.add(box, bodyCol, 0, ty, 0, 0, 0, 0, 0.52, 0.66, 0.3);
    if (o.body === 'mail' || o.body === 'plate' || o.body === 'scrap') b.add(box, F.cloth, 0, ty - 0.08, 0.16, 0, 0, 0, 0.36, 0.62, 0.03);
    if (o.body === 'rags') b.add(box, F.cloth, 0, ty - 0.25, 0.01, 0, 0, 0, 0.55, 0.14, 0.32);
    // Shoulders / arms
    const armCol = o.body === 'rags' ? skin : bodyCol;
    b.add(box, armCol, -0.33, ty, 0.05, 0.3, 0, 0.1, 0.14, 0.6, 0.14);
    b.add(box, armCol, 0.33, ty, 0.08, -0.6, 0, -0.1, 0.14, 0.6, 0.14);
    if (o.body === 'plate' || o.body === 'scrap') {
      b.add(box, o.body === 'scrap' ? '#4a423b' : F.metal, -0.32, ty + 0.28, 0, 0, 0, 0.2, 0.22, 0.12, 0.3);
      b.add(box, o.body === 'scrap' ? '#4a423b' : F.metal, 0.32, ty + 0.28, 0, 0, 0, -0.2, 0.22, 0.12, 0.3);
    }
    // Head
    const hy = ty + 0.5;
    b.add(box, skin, 0, hy, 0, 0, 0, 0, isOrc ? 0.34 : 0.26, isOrc ? 0.3 : 0.28, isOrc ? 0.32 : 0.26);
    if (isOrc) { b.add(cone, '#efe6c8', -0.1, hy - 0.06, 0.16, -0.4, 0, 0, 0.05, 0.12, 0.05); b.add(cone, '#efe6c8', 0.1, hy - 0.06, 0.16, -0.4, 0, 0, 0.05, 0.12, 0.05); }
    // Helmets
    switch (o.helm) {
      case 'kettle': b.add(cyl, '#8d939b', 0, hy + 0.14, 0, 0, 0, 0, 0.5, 0.06, 0.5); b.add(sph, '#8d939b', 0, hy + 0.16, 0, 0, 0, 0, 0.3, 0.2, 0.3); break;
      case 'nasal': b.add(cone, '#9aa1a8', 0, hy + 0.2, 0, 0, 0, 0, 0.36, 0.3, 0.36); b.add(box, '#9aa1a8', 0, hy - 0.02, 0.14, 0, 0, 0, 0.04, 0.16, 0.03); break;
      case 'great': b.add(box, F.metal, 0, hy + 0.04, 0, 0, 0, 0, 0.32, 0.36, 0.32); b.add(box, '#222', 0, hy + 0.06, 0.165, 0, 0, 0, 0.22, 0.04, 0.01); b.add(cone, F.cloth, 0, hy + 0.3, 0, 0, 0, 0, 0.12, 0.2, 0.12); break;
      case 'horns': b.add(sph, '#4a423b', 0, hy + 0.12, 0, 0, 0, 0, 0.38, 0.22, 0.38); b.add(cone, '#e8dcc0', -0.2, hy + 0.28, 0, 0, 0, 0.7, 0.07, 0.28, 0.07); b.add(cone, '#e8dcc0', 0.2, hy + 0.28, 0, 0, 0, -0.7, 0.07, 0.28, 0.07); break;
      case 'hood': b.add(cone, o.hoodCol || F.cloth, 0, hy + 0.14, -0.02, 0, 0, 0, 0.38, 0.5, 0.38); break;
      case 'crown': b.add(box, F.metal, 0, hy + 0.04, 0, 0, 0, 0, 0.3, 0.34, 0.3); b.add(cyl, GOLD, 0, hy + 0.26, 0, 0, 0, 0, 0.34, 0.1, 0.34); break;
      case 'circlet': b.add(cyl, F.color2, 0, hy + 0.1, 0, 0, 0, 0, 0.3, 0.05, 0.3); b.add(box, '#e8e0d0', 0, hy + 0.12, -0.03, 0, 0, 0, 0.27, 0.1, 0.24); break;
      case 'tall': b.add(cone, F.cloth, 0, hy + 0.42, 0, -0.15, 0, 0, 0.34, 0.75, 0.34); b.add(cyl, F.color2, 0, hy + 0.12, 0, 0, 0, 0, 0.42, 0.04, 0.42); break;
      default: break;
    }
    // Weapons (right hand at x=+0.38)
    const wy = ty - 0.15;
    switch (o.weapon) {
      case 'sword': b.add(box, '#d7dde4', 0.4, wy + 0.42, 0.28, 0.5, 0, 0, 0.06, 0.8, 0.03); b.add(box, GOLD, 0.4, wy + 0.06, 0.12, 0.5, 0, 0, 0.2, 0.04, 0.05); break;
      case 'spear': b.add(cyl, WOOD, 0.4, wy + 0.5, 0.15, 0.15, 0, 0, 0.05, 2.4, 0.05); b.add(cone, '#d7dde4', 0.4, wy + 1.75, 0.34, 0.15, 0, 0, 0.09, 0.26, 0.09); break;
      case 'lance': b.add(cyl, F.color2, 0.4, wy + 0.3, 0.9, 1.25, 0, 0, 0.08, 3.0, 0.08); b.add(cone, '#d7dde4', 0.4, wy + 0.78, 2.35, 1.25, 0, 0, 0.1, 0.3, 0.1); break;
      case 'halberd': b.add(cyl, WOOD, 0.4, wy + 0.6, 0.15, 0.1, 0, 0, 0.05, 2.5, 0.05); b.add(box, '#c8ced5', 0.4, wy + 1.6, 0.3, 0.1, 0, 0, 0.04, 0.32, 0.3); break;
      case 'glaive': b.add(cyl, '#4a3c5a', 0.4, wy + 0.6, 0.15, 0.1, 0, 0, 0.05, 2.2, 0.05); b.add(box, F.color2, 0.4, wy + 1.75, 0.27, 0.1, 0, 0, 0.04, 0.5, 0.1); break;
      case 'axe': b.add(cyl, WOOD, 0.4, wy + 0.3, 0.25, 0.5, 0, 0, 0.05, 0.9, 0.05); b.add(box, '#9aa1a8', 0.4, wy + 0.6, 0.48, 0.5, 0, 0, 0.04, 0.3, 0.25); break;
      case 'club': b.add(cyl, WOOD, 0.4, wy + 0.35, 0.25, 0.5, 0, 0, 0.09, 0.9, 0.09); b.add(sph, '#6a4a2a', 0.4, wy + 0.72, 0.48, 0, 0, 0, 0.22, 0.3, 0.22); break;
      case 'bow': b.add(torusHalf, WOOD, 0.36, wy + 0.25, 0.25, 0, Math.PI / 2, Math.PI / 2, 1.5, 1.5, 1.5); break;
      case 'javelin': b.add(cyl, WOOD, 0.4, wy + 0.7, 0.1, -0.2, 0, 0, 0.04, 1.5, 0.04); b.add(cone, '#9aa1a8', 0.4, wy + 1.45, -0.05, -0.2, 0, 0, 0.06, 0.18, 0.06); break;
      case 'staff': b.add(cyl, '#3e2f4e', 0.4, wy + 0.55, 0.15, 0.1, 0, 0, 0.05, 1.8, 0.05); b.add(oct, F.color2, 0.4, wy + 1.5, 0.25, 0, 0, 0, 0.2, 0.28, 0.2); break;
      default: break;
    }
    if (o.shield) {
      b.add(box, F.cloth, -0.42, ty - 0.05, 0.18, 0, 0.25, 0, 0.06, 0.62, 0.48);
      b.add(box, F.color2, -0.455, ty - 0.05, 0.19, 0, 0.25, 0, 0.02, 0.16, 0.16);
    }
  }

  function addMount(b, o, F) {
    if (o.mount === 'wolf') {
      const c = '#5d5a55';
      b.add(box, c, 0, 0.95, 0, 0, 0, 0, 0.7, 0.65, 1.7);
      b.add(box, c, 0, 1.15, 1.05, -0.3, 0, 0, 0.5, 0.5, 0.6);
      b.add(box, '#4a4744', 0, 1.0, 1.45, 0, 0, 0, 0.32, 0.26, 0.45);
      b.add(cone, c, -0.15, 1.5, 1.05, 0, 0, 0, 0.12, 0.25, 0.12); b.add(cone, c, 0.15, 1.5, 1.05, 0, 0, 0, 0.12, 0.25, 0.12);
      b.add(box, c, 0, 1.05, -1.0, 0.8, 0, 0, 0.14, 0.14, 0.8);
      for (const [x, z] of [[-0.25, 0.6], [0.25, 0.6], [-0.25, -0.6], [0.25, -0.6]]) b.add(box, '#4a4744', x, 0.33, z, 0, 0, 0, 0.16, 0.66, 0.18);
      b.add(box, F.cloth, 0, 1.3, 0, 0, 0, 0, 0.74, 0.08, 0.6);
    } else if (o.mount === 'griffon') {
      const body = '#b08a4e', head = '#efe9dc';
      b.add(box, body, 0, 1.2, -0.1, 0, 0, 0, 0.75, 0.75, 1.8);
      b.add(box, head, 0, 1.75, 1.0, -0.3, 0, 0, 0.5, 0.6, 0.55);
      b.add(cone, GOLD, 0, 1.68, 1.4, 1.57, 0, 0, 0.15, 0.3, 0.15);
      b.add(box, F.cloth, -0.9, 1.75, -0.2, 0, 0, 0.45, 1.4, 0.06, 1.0);
      b.add(box, F.cloth, 0.9, 1.75, -0.2, 0, 0, -0.45, 1.4, 0.06, 1.0);
      b.add(box, F.color2, -1.5, 2.05, -0.2, 0, 0, 0.45, 0.4, 0.07, 0.9);
      b.add(box, F.color2, 1.5, 2.05, -0.2, 0, 0, -0.45, 0.4, 0.07, 0.9);
      b.add(box, body, 0, 1.2, -1.2, 0.5, 0, 0, 0.12, 0.12, 0.9);
      for (const [x, z] of [[-0.28, 0.6], [0.28, 0.6], [-0.28, -0.7], [0.28, -0.7]]) b.add(box, z > 0 ? GOLD : body, x, 0.42, z, 0, 0, 0, 0.17, 0.84, 0.18);
    } else {
      const coat = o.coat || '#6b4a2f';
      b.add(box, o.barding ? F.cloth : coat, 0, 1.25, 0, 0, 0, 0, 0.62, 0.72, 1.75);
      b.add(box, o.barding ? F.cloth : coat, 0, 1.75, 0.9, -0.7, 0, 0, 0.36, 0.85, 0.42);
      b.add(box, o.barding ? F.metal : coat, 0, 2.05, 1.25, -1.6, 0, 0, 0.3, 0.6, 0.28);
      b.add(box, '#2a211a', 0, 1.95, 0.75, -0.7, 0, 0, 0.08, 0.7, 0.3);
      b.add(box, '#2a211a', 0, 1.15, -0.95, 0.4, 0, 0, 0.12, 0.7, 0.12);
      if (o.barding) b.add(box, F.color2, 0, 0.92, 0, 0, 0, 0, 0.66, 0.1, 1.6);
      for (const [x, z] of [[-0.2, 0.65], [0.2, 0.65], [-0.2, -0.65], [0.2, -0.65]]) b.add(box, '#3a2a1c', x, 0.45, z, 0, 0, 0, 0.14, 0.9, 0.16);
    }
  }

  function addBeast(b, type, F) {
    if (type === 'troll') {
      const c = '#7a7f6a', d = '#5d6150';
      b.add(box, d, -0.45, 0.8, 0, 0, 0, 0, 0.45, 1.6, 0.5); b.add(box, d, 0.45, 0.8, 0, 0, 0, 0, 0.45, 1.6, 0.5);
      b.add(box, c, 0, 2.3, 0.15, 0.35, 0, 0, 1.5, 1.5, 1.0);
      b.add(box, F.cloth, 0, 1.55, 0.05, 0, 0, 0, 1.25, 0.4, 0.8);
      b.add(box, c, 0, 3.0, 0.75, 0.2, 0, 0, 0.6, 0.5, 0.55);
      b.add(cone, '#efe6c8', -0.15, 2.85, 1.05, -0.5, 0, 0, 0.08, 0.2, 0.08); b.add(cone, '#efe6c8', 0.15, 2.85, 1.05, -0.5, 0, 0, 0.08, 0.2, 0.08);
      b.add(box, c, -0.95, 1.9, 0.3, 0.2, 0, 0.15, 0.35, 1.7, 0.35); b.add(box, c, 0.95, 1.9, 0.3, -0.3, 0, -0.15, 0.35, 1.7, 0.35);
      b.add(cyl, WOOD, 1.05, 1.4, 0.9, 1.1, 0, 0, 0.18, 1.8, 0.18); b.add(dod, '#555', 1.05, 1.9, 1.7, 0, 0, 0, 0.6, 0.6, 0.6);
      b.add(dod, '#ff6a1a', 0, 2.6, -0.4, 0, 0, 0, 0.3, 0.3, 0.3);
    } else if (type === 'golem') {
      const c = '#8b8fa0', d = '#6c6f80';
      b.add(box, d, -0.5, 0.75, 0, 0, 0.1, 0, 0.6, 1.5, 0.6); b.add(box, d, 0.5, 0.75, 0, 0, -0.1, 0, 0.6, 1.5, 0.6);
      b.add(box, c, 0, 2.2, 0, 0, 0, 0, 1.7, 1.4, 1.0);
      b.add(box, c, 0, 3.15, 0.1, 0, 0, 0, 0.6, 0.55, 0.6);
      b.add(box, F.color2, 0, 3.2, 0.41, 0, 0, 0, 0.4, 0.08, 0.02);
      b.add(box, F.color2, 0, 2.3, 0.51, 0, 0, 0.78, 0.35, 0.35, 0.02);
      b.add(box, c, -1.2, 1.9, 0.1, 0, 0, 0.1, 0.55, 1.8, 0.55); b.add(box, c, 1.2, 1.9, 0.1, 0, 0, -0.1, 0.55, 1.8, 0.55);
      b.add(dod, d, -1.25, 0.9, 0.15, 0, 0, 0, 0.75, 0.75, 0.75); b.add(dod, d, 1.25, 0.9, 0.15, 0, 0, 0, 0.75, 0.75, 0.75);
    } else if (type === 'behemoth') {
      const c = '#3a3532', e = '#ff6a1a';
      b.add(box, c, -0.9, 1.6, 0, 0, 0, 0, 0.9, 3.2, 1.0); b.add(box, c, 0.9, 1.6, 0, 0, 0, 0, 0.9, 3.2, 1.0);
      b.add(box, c, 0, 4.6, 0.2, 0.25, 0, 0, 3.0, 3.0, 1.9);
      b.add(box, F.cloth, 0, 3.2, 0.1, 0, 0, 0, 2.5, 0.8, 1.6);
      b.add(box, c, 0, 6.3, 0.9, 0.2, 0, 0, 1.1, 1.0, 1.0);
      b.add(box, e, 0, 6.35, 1.41, 0, 0, 0, 0.7, 0.14, 0.02);
      b.add(dod, e, -0.7, 5.2, 0.9, 0, 0, 0, 0.5, 0.5, 0.5); b.add(dod, e, 0.8, 4.0, 1.1, 0, 0, 0, 0.4, 0.4, 0.4);
      b.add(box, c, -2.0, 3.9, 0.4, 0.2, 0, 0.15, 0.75, 3.4, 0.75); b.add(box, c, 2.0, 3.9, 0.6, -0.4, 0, -0.15, 0.75, 3.4, 0.75);
      b.add(cyl, '#2a2522', 2.2, 2.6, 1.8, 1.0, 0, 0, 0.35, 3.6, 0.35); b.add(dod, '#555', 2.2, 3.4, 3.5, 0, 0, 0, 1.2, 1.2, 1.2);
      b.add(cone, '#ddd2b8', -0.6, 7.0, 0.6, 0, 0, 0.6, 0.18, 0.7, 0.18); b.add(cone, '#ddd2b8', 0.6, 7.0, 0.6, 0, 0, -0.6, 0.18, 0.7, 0.18);
    }
  }

  function addSiege(b, type, F) {
    if (type === 'ballista') {
      b.add(box, '#4a3c5a', 0, 0.5, 0, 0, 0, 0, 1.6, 0.3, 2.6);
      b.add(box, '#4a3c5a', 0, 1.0, 0.2, -0.15, 0, 0, 0.3, 0.3, 2.8);
      b.add(box, '#cfc6e8', 0, 1.25, 1.4, 0, 0, 0, 3.0, 0.12, 0.18);
      b.add(oct, F.color2, 0, 1.6, 0.0, 0, 0, 0, 0.6, 0.9, 0.6);
      for (const [x, z] of [[-0.8, 0.9], [0.8, 0.9], [-0.8, -0.9], [0.8, -0.9]]) b.add(cyl, '#3a2d4a', x, 0.35, z, 0, 0, Math.PI / 2, 0.7, 0.18, 0.7);
      addHumanoid(b, { body: 'robe', helm: 'hood', weapon: 'staff' }, F, 0, false);
    } else {
      const crude = type === 'lobber';
      b.add(box, crude ? '#5a4128' : WOOD, 0, 0.55, 0, 0, 0, 0, 1.8, 0.3, 3.0);
      b.add(box, WOOD, -0.7, 1.3, 0.3, 0, 0, 0, 0.2, 1.6, 0.2); b.add(box, WOOD, 0.7, 1.3, 0.3, 0, 0, 0, 0.2, 1.6, 0.2);
      b.add(box, WOOD, 0, 2.0, 0.3, 0, 0, Math.PI / 2, 0.15, 1.6, 0.15);
      b.add(box, crude ? '#4a3520' : '#6a4a2a', 0, 1.6, -0.6, 0.9, 0, 0, 0.2, 0.2, 2.6);
      b.add(dod, '#777', 0, 2.35, -1.5, 0, 0, 0, 0.6, 0.6, 0.6);
      b.add(box, F.cloth, 0, 2.3, 0.3, 0, 0, 0, 0.6, 0.4, 0.05);
      for (const [x, z] of [[-1, 1.0], [1, 1.0], [-1, -1.0], [1, -1.0]]) b.add(cyl, '#3a2a1c', x, 0.45, z, 0, 0, Math.PI / 2, 0.9, 0.2, 0.9);
      addHumanoid(b, crude ? { body: 'rags', skin: '#5f7d3a', helm: 'none', weapon: 'club' } : { body: 'tunic', helm: 'kettle', weapon: 'none' }, F, 0, false);
    }
  }

  const cache = new Map();
  function factionPalette(fid) {
    const f = RW.data.FACTIONS[fid];
    return { cloth: f.cloth, metal: f.metal, color2: f.color2, color: f.color };
  }

  // Geometry for one soldier of a unit type, dressed in a faction's colours.
  function unitGeometry(typeId, factionId) {
    const key = typeId + '|' + factionId;
    if (cache.has(key)) return cache.get(key);
    const t = RW.data.UNITS[typeId];
    const F = factionPalette(factionId || t.faction);
    const b = new Builder();
    const m = t.model;
    if (m.kind === 'foot') {
      // Soldiers in a soldier's head position - move the humanoid so it starts at the feet.
      addHumanoid(b, m, F);
      // Offset the man in front of the siege engine.
    } else if (m.kind === 'mounted') {
      addMount(b, m, F);
      addHumanoid(b, Object.assign({}, m.rider, { shield: m.rider.shield }), F, 0.25, true);
    } else if (m.kind === 'beast') {
      addBeast(b, m.type, F);
    } else if (m.kind === 'siege') {
      addSiege(b, m.type, F);
    }
    const g = b.build();
    const sc = m.scale || 1;
    if (sc !== 1) g.scale(sc, sc, sc);
    if (m.kind === 'siege') g.translate(0, 0, 0);
    g.computeBoundingSphere();
    cache.set(key, g);
    return g;
  }

  // ---------------------------------------------------------------- scenery
  function treeGeometry(kind = 'pine') {
    const b = new Builder();
    if (kind === 'pine') {
      b.add(cyl, '#5a3f28', 0, 0.8, 0, 0, 0, 0, 0.35, 1.6, 0.35);
      b.add(cone, '#2f5a2e', 0, 2.4, 0, 0, 0, 0, 2.6, 2.4, 2.6);
      b.add(cone, '#36662f', 0, 3.6, 0, 0, 0.5, 0, 2.0, 2.0, 2.0);
      b.add(cone, '#3d7334', 0, 4.6, 0, 0, 1, 0, 1.3, 1.6, 1.3);
    } else {
      b.add(cyl, '#5e4430', 0, 1.0, 0, 0, 0, 0, 0.4, 2.0, 0.4);
      b.add(dod, '#4f7d36', 0, 3.0, 0, 0, 0, 0, 3.0, 2.6, 3.0);
      b.add(dod, '#5b8a3c', 0.6, 3.8, 0.3, 0.4, 0, 0, 1.9, 1.7, 1.9);
    }
    return b.build();
  }
  function rockGeometry() {
    const b = new Builder();
    b.add(dod, '#8a8780', 0, 0.4, 0, 0, 0, 0, 2, 1.3, 1.7);
    b.add(dod, '#77746d', 0.8, 0.3, 0.5, 0.5, 0.3, 0, 1.1, 0.9, 1.0);
    return b.build();
  }
  function houseGeometry(roof = '#8a3b2a') {
    const b = new Builder();
    b.add(box, '#cdbb98', 0, 1.5, 0, 0, 0, 0, 5, 3, 4);
    b.add(box, '#5b3d26', 0, 3.0, 0, 0, 0, 0, 5.1, 0.2, 4.1);
    // Gabled roof: two sloped planks and triangular gable ends.
    b.add(box, roof, 0, 3.75, -1.05, 0.72, 0, 0, 5.6, 0.22, 3.05);
    b.add(box, roof, 0, 3.75, 1.05, -0.72, 0, 0, 5.6, 0.22, 3.05);
    b.add(box, '#cdbb98', -2.45, 3.0, 0, Math.PI / 4, 0, 0, 0.1, 2.1, 2.1);
    b.add(box, '#cdbb98', 2.45, 3.0, 0, Math.PI / 4, 0, 0, 0.1, 2.1, 2.1);
    b.add(box, '#4a3020', 0, 1.0, 2.01, 0, 0, 0, 0.9, 2.0, 0.05);
    return b.build();
  }

  // Campaign settlement model by level (village / town / city), coloured by owner.
  function settlementGeometry(level, color, walls) {
    const b = new Builder();
    const wall = '#bcb3a0', roof = color;
    if (level >= 3) {
      b.add(box, wall, 0, 1.0, 0, 0, 0, 0, 2.6, 2.0, 2.6);
      b.add(cyl, wall, 0, 2.6, 0, 0, 0, 0, 1.2, 2.2, 1.2);
      b.add(cone, roof, 0, 4.2, 0, 0, 0, 0, 1.5, 1.2, 1.5);
      for (const [x, z] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) { b.add(cyl, wall, x, 1.3, z, 0, 0, 0, 0.8, 2.6, 0.8); b.add(cone, roof, x, 3.0, z, 0, 0, 0, 1.0, 0.9, 1.0); }
    } else if (level === 2) {
      b.add(box, wall, 0, 0.8, 0, 0, 0, 0, 1.8, 1.6, 1.6);
      b.add(cone, roof, 0, 2.1, 0, 0, Math.PI / 4, 0, 2.3, 1.1, 2.3);
      b.add(cyl, wall, 1.2, 1.3, 0.6, 0, 0, 0, 0.7, 2.6, 0.7);
      b.add(cone, roof, 1.2, 2.9, 0.6, 0, 0, 0, 0.9, 0.8, 0.9);
      b.add(box, '#cdbb98', -1.3, 0.5, 0.7, 0, 0.3, 0, 1.0, 1.0, 1.0); b.add(cone, '#8a3b2a', -1.3, 1.25, 0.7, 0, 0.3 + Math.PI / 4, 0, 1.3, 0.6, 1.3);
    } else {
      for (const [x, z, r] of [[0, 0, 0], [1.1, 0.5, 0.6], [-0.9, 0.7, -0.4], [0.2, -1.0, 0.2]]) {
        b.add(box, '#cdbb98', x, 0.45, z, 0, r, 0, 0.9, 0.9, 0.9);
        b.add(cone, x === 0 ? roof : '#8a3b2a', x, 1.15, z, 0, r + Math.PI / 4, 0, 1.25, 0.6, 1.25);
      }
    }
    if (walls) {
      const R = 2.6;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        b.add(box, '#9a927f', Math.cos(a) * R, 0.5, Math.sin(a) * R, 0, -a + Math.PI / 2, 0, 2.1, 1.0, 0.35);
      }
    }
    return b.build();
  }
  function shrineGeometry() {
    const b = new Builder();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      b.add(box, '#d8d2c0', Math.cos(a) * 1.6, 1.0, Math.sin(a) * 1.6, 0, -a, 0, 0.35, 2.0, 0.35);
    }
    b.add(cyl, '#d8d2c0', 0, 0.1, 0, 0, 0, 0, 4, 0.2, 4);
    b.add(oct, '#7ae8ff', 0, 1.6, 0, 0, 0, 0, 0.8, 1.3, 0.8);
    return b.build();
  }
  // Campaign army token: a standard bearer with a big banner in faction colour.
  function armyTokenGeometry(color, color2) {
    const b = new Builder();
    b.add(cyl, '#3a2a1c', 0, 0.15, 0, 0, 0, 0, 1.6, 0.3, 1.6);
    b.add(cyl, '#5a3f28', 0, 2.0, 0, 0, 0, 0, 0.12, 3.8, 0.12);
    b.add(box, color, 0.55, 3.1, 0, 0, 0, 0, 1.1, 1.5, 0.06);
    b.add(box, color2, 0.55, 3.1, 0.035, 0, 0, 0.78, 0.5, 0.5, 0.02);
    b.add(cone, '#e0b84a', 0, 4.05, 0, 0, 0, 0, 0.25, 0.4, 0.25);
    b.add(box, color, -0.35, 0.9, 0, 0, 0, 0, 0.5, 0.9, 0.35);
    b.add(box, '#d9a97f', -0.35, 1.55, 0, 0, 0, 0, 0.3, 0.3, 0.3);
    return b.build();
  }

  RW.models = { Builder, PRIM, unitGeometry, treeGeometry, rockGeometry, houseGeometry, settlementGeometry, shrineGeometry, armyTokenGeometry };
})();
