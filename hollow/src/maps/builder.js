// MapBuilder: accumulates static geometry per material (merged per spatial chunk so
// frustum culling still works), registers colliders, navigation nodes, lights, windows,
// interactables and hallucination anchor points. Every map script talks to this.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CollisionWorld } from '../core/collision.js';
import { mat, symbolTexture } from '../core/textures.js';

export const windUniforms = { uTime: { value: 0 }, uWind: { value: 1 }, uDistort: { value: 0 } };

// Vertex sway for vegetation (and the "trees moving" hallucination via uDistort).
export function addWind(material, strength = 1, rigidHeight = 0.5) {
  material.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = windUniforms.uTime; sh.uniforms.uWind = windUniforms.uWind; sh.uniforms.uDistort = windUniforms.uDistort;
    sh.vertexShader = 'uniform float uTime; uniform float uWind; uniform float uDistort;\n' + sh.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      vec4 wpW = modelMatrix * vec4(position, 1.0);
      #ifdef USE_INSTANCING
        wpW = modelMatrix * instanceMatrix * vec4(position, 1.0);
      #endif
      float hW = max(position.y - ${rigidHeight.toFixed(2)}, 0.0);
      float ph = wpW.x * 0.13 + wpW.z * 0.11;
      float sw = (sin(uTime * 1.3 + ph) * 0.6 + sin(uTime * 2.9 + ph * 1.7) * 0.25) * uWind * ${(0.02 * strength).toFixed(4)} * hW;
      sw += sin(uTime * 0.7 + ph * 3.0) * uDistort * 0.08 * hW;
      transformed.x += sw; transformed.z += sw * 0.6;
    `);
  };
  material.customProgramCacheKey = () => 'wind' + strength + rigidHeight;
  return material;
}

// Box geometry whose UVs are in world units (so textures tile at a constant scale).
export function worldBox(sx, sy, sz, texScale = 2) {
  const g = new THREE.BoxGeometry(sx, sy, sz);
  const uv = g.attributes.uv;
  const dims = [[sz, sy], [sz, sy], [sx, sz], [sx, sz], [sx, sy], [sx, sy]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) {
    const k = f * 4 + i; uv.setXY(k, uv.getX(k) * dims[f][0] / texScale, uv.getY(k) * dims[f][1] / texScale);
  }
  return g;
}

export class Door {
  constructor(builder, x, y, z, width, height, axis, matKey = 'door', opts = {}) {
    // axis: 'x' means the door blocks travel along z (door plane spans x)
    this.axis = axis; this.width = width; this.height = height;
    this.pivot = new THREE.Group();
    const hingeX = axis === 'x' ? x - width / 2 : x, hingeZ = axis === 'x' ? z : z - width / 2;
    this.pivot.position.set(hingeX, y, hingeZ);
    const panel = new THREE.Mesh(worldBox(width - 0.04, height - 0.04, 0.06, 1.2), builder.m(matKey));
    if (axis === 'x') panel.position.set(width / 2, height / 2, 0);
    else { panel.position.set(0, height / 2, width / 2); panel.rotation.y = Math.PI / 2; }
    panel.castShadow = true; panel.receiveShadow = true;
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), builder.m('brass'));
    if (axis === 'x') knob.position.set(width - 0.12, height * 0.48, 0.06); else knob.position.set(0.06, height * 0.48, width - 0.12);
    this.pivot.add(panel, knob);
    builder.root.add(this.pivot);
    this.pos = new THREE.Vector3(x, y, z);
    this.collider = axis === 'x'
      ? builder.world.addBox(x - width / 2, y, z - 0.08, x + width / 2, y + height, z + 0.08, { surface: 'wood', door: this, noFloor: true })
      : builder.world.addBox(x - 0.08, y, z - width / 2, x + 0.08, y + height, z + width / 2, { surface: 'wood', door: this, noFloor: true });
    this.open = false; this.angle = 0; this.target = 0; this.locked = !!opts.locked; this.dir = 1;
    this.autoCloseT = 0; this.kind = 'door';
    this.creak = opts.creak ?? true;
  }
  toggle(fromPos, game, silent) {
    if (this.locked) { game && game.audio.play('locked', this.pos, { vol: 0.6 }); return false; }
    this.open = !this.open;
    if (this.open && fromPos) {
      // swing away from the opener
      const d = this.axis === 'x' ? fromPos.z - this.pos.z : fromPos.x - this.pos.x;
      this.dir = d > 0 ? -1 : 1;
    }
    this.target = this.open ? this.dir * 1.6 : 0;
    this.collider.enabled = !this.open;
    if (game && !silent) game.audio.play(this.open ? 'doorOpen' : 'doorClose', this.pos, { vol: 0.8 });
    if (game) game.emitNoise(this.pos, this.open ? 9 : 12, 'door');
    return true;
  }
  update(dt) {
    this.angle += (this.target - this.angle) * Math.min(1, dt * 5);
    this.pivot.rotation.y = this.axis === 'x' ? -this.angle : this.angle;
  }
}

export class MapBuilder {
  constructor(game, quality) {
    this.game = game; this.quality = quality;
    this.root = new THREE.Group();
    this.world = new CollisionWorld();
    this.geos = new Map();
    this.mats = new Map();
    this.chunk = 72;
    this.lights = [];
    this.windows = [];
    this.nodes = [];
    this.anchors = { window: [], hallEnd: [], treeGap: [], roof: [], impossible: [], mirror: [], spot: [], indoor: [], far: [] };
    this.interactables = [];
    this.doors = [];
    this.emitters = [];
    this.updaters = [];
    this.instances = [];
    this.mirrors = [];
    this.spawns = { player: new THREE.Vector3(), playerYaw: 0, npc: [] };
    this.abandonedTargets = [];
    this.surfaceRegions = [];
    this.defaultSurface = 'concrete';
  }

  // Material registry. Named materials are created lazily from presets.
  m(key) {
    if (this.mats.has(key)) return this.mats.get(key);
    const p = MATERIAL_PRESETS[key];
    let material;
    if (!p) material = new THREE.MeshStandardMaterial({ color: 0xff00ff });
    else if (typeof p === 'function') material = p();
    else if (p.tex) material = mat(p.tex, p);
    else material = new THREE.MeshStandardMaterial(p);
    this.mats.set(key, material);
    return material;
  }
  setMat(key, material) { this.mats.set(key, material); return material; }

  add(geo, matKey, { cast = true, receive = true } = {}) {
    geo.computeBoundingBox();
    const c = geo.boundingBox.getCenter(new THREE.Vector3());
    const ck = Math.floor(c.x / this.chunk) + ',' + Math.floor(c.z / this.chunk);
    const k = matKey + '|' + ck + '|' + (cast ? 1 : 0);
    if (!this.geos.has(k)) this.geos.set(k, { matKey, cast, receive, list: [] });
    // normalise attributes so merging works
    if (!geo.index) geo = geo.toNonIndexed ? geo : geo;
    for (const name of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(name)) geo.deleteAttribute(name);
    if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
    this.geos.get(k).list.push(geo.index ? geo.toNonIndexed() : geo);
  }

  // Centre-based box. opts: collide, surface, tex (world uv scale), rotY, cast, climbable
  box(cx, cy, cz, sx, sy, sz, matKey, opts = {}) {
    const g = worldBox(sx, sy, sz, opts.tex || 2);
    if (opts.rotY) g.rotateY(opts.rotY);
    g.translate(cx, cy, cz);
    this.add(g, matKey, opts);
    if (opts.collide !== false) {
      if (opts.rotY && Math.abs(Math.sin(opts.rotY)) > 0.5) this.world.box(cx, cy, cz, sz, sy, sx, opts);
      else this.world.box(cx, cy, cz, sx, sy, sz, opts);
    }
  }
  // min/max helper
  boxMM(x0, y0, z0, x1, y1, z1, matKey, opts = {}) {
    this.box((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), matKey, opts);
  }

  // A wall between two points (axis aligned), with openings [{at, w, y0, y1}] measured along the wall.
  wall(x0, z0, x1, z1, yBase, h, thick, matKey, openings = [], opts = {}) {
    const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    const len = alongX ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
    const sx = Math.min(x0, x1), sz = Math.min(z0, z1);
    const ops = openings.slice().sort((a, b) => a.at - b.at);
    const seg = (a, b, y0, y1) => {
      if (b - a < 0.01 || y1 - y0 < 0.01) return;
      if (alongX) this.boxMM(sx + a, yBase + y0, z0 - thick / 2, sx + b, yBase + y1, z0 + thick / 2, matKey, opts);
      else this.boxMM(x0 - thick / 2, yBase + y0, sz + a, x0 + thick / 2, yBase + y1, sz + b, matKey, opts);
    };
    let cur = 0;
    for (const o of ops) {
      const a = o.at - o.w / 2, b = o.at + o.w / 2;
      seg(cur, a, 0, h);
      seg(a, b, 0, o.y0 ?? 0);
      seg(a, b, o.y1 ?? h, h);
      cur = b;
    }
    seg(cur, len, 0, h);
  }

  cyl(x, y, z, rt, rb, h, matKey, opts = {}) {
    const g = new THREE.CylinderGeometry(rt, rb, h, opts.seg || 10, 1, !!opts.open);
    if (opts.rotZ) g.rotateZ(opts.rotZ);
    if (opts.rotX) g.rotateX(opts.rotX);
    g.translate(x, y + h / 2, z);
    if (opts.uvScale) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * opts.uvScale[0], uv.getY(i) * opts.uvScale[1]); }
    this.add(g, matKey, opts);
    if (opts.collide) this.world.addCircle(x, z, Math.max(rt, rb), y, y + h, opts);
  }

  geo(g, matKey, opts = {}) { this.add(g, matKey, opts); }

  // Real-time mesh that is not merged (moving things).
  mesh(obj) { this.root.add(obj); return obj; }

  light(x, y, z, color = 0xffd8a0, intensity = 8, distance = 14, opts = {}) {
    const L = { pos: new THREE.Vector3(x, y, z), color: new THREE.Color(color), intensity, distance, base: intensity,
      flicker: opts.flicker || 0, broken: opts.broken || 0, on: opts.on !== false, phase: Math.random() * 100, group: opts.group || null, glow: null, abandon: opts.abandon !== false, factor: 1 };
    L.glowSize = opts.bulb !== false ? (opts.glowSize || 1.2) : 0; // drawn by one Points cloud (see finish)
    this.lights.push(L);
    return L;
  }

  // Lit / unlit window panes (instanced later). dir: outward normal (nx,nz)
  window(x, y, z, w, h, nx, nz, lit = Math.random() < 0.4, opts = {}) {
    const W = { pos: new THREE.Vector3(x, y, z), w, h, nx, nz, lit, baseLit: lit, color: new THREE.Color(opts.color || (Math.random() < 0.3 ? 0xa8c0ff : 0xffc27a)), index: -1, flick: 0 };
    this.windows.push(W);
    this.anchors.window.push({ pos: new THREE.Vector3(x - nx * 0.6, y - h / 2 + 0.05, z - nz * 0.6), face: new THREE.Vector3(nx, 0, nz), win: W });
    return W;
  }

  // Story interactables: notes, tape recorders, symbols, the rift, switches.
  item(kind, id, x, y, z, yaw = 0, opts = {}) {
    let mesh;
    if (kind === 'note') {
      mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.32), new THREE.MeshStandardMaterial({ color: 0xe8e0c8, roughness: 0.9, emissive: 0x403830, emissiveIntensity: 0.6, side: THREE.DoubleSide }));
      if (opts.flat) mesh.rotation.x = -Math.PI / 2;
    } else if (kind === 'recording') {
      mesh = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 0.15), new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.4, metalness: 0.3 })); mesh.add(body);
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.01, 6, 4), new THREE.MeshBasicMaterial({ color: 0xff2020, toneMapped: false })); led.position.set(0.09, 0.045, 0.06); mesh.add(led);
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.005, 0.07), new THREE.MeshStandardMaterial({ color: 0x2a3a3a, roughness: 0.1 })); win.position.y = 0.042; mesh.add(win);
    } else if (kind === 'symbol') {
      mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), new THREE.MeshStandardMaterial({ map: symbolTexture(), transparent: true, depthWrite: false, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 }));
    } else if (kind === 'rift') {
      mesh = makeRift();
    } else {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.35, 0.1), new THREE.MeshStandardMaterial({ color: 0x5a5a50, metalness: 0.5, roughness: 0.5, emissive: 0x200000 }));
    }
    mesh.position.set(x, y, z); mesh.rotation.y = yaw + (mesh.rotation.y || 0);
    this.root.add(mesh);
    const marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: kind === 'symbol' ? 0xff3030 : kind === 'rift' ? 0xa060ff : 0xffe0a0, transparent: true, depthTest: false, blending: THREE.AdditiveBlending, opacity: 0.9 }));
    marker.scale.setScalar(kind === 'rift' ? 3 : 0.9); marker.position.set(x, y + 0.2, z); marker.visible = false; marker.renderOrder = 11;
    this.root.add(marker);
    const it = { kind, id, pos: new THREE.Vector3(x, y, z), mesh, marker, taken: false, radius: kind === 'rift' ? 2.4 : 2.2, ...opts };
    this.interactables.push(it);
    return it;
  }

  door(x, y, z, w, h, axis, matKey, opts) {
    const d = new Door(this, x, y, z, w, h, axis, matKey, opts);
    this.doors.push(d);
    return d;
  }

  region(x0, z0, x1, z1, surface) { this.surfaceRegions.push({ x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1), surface }); }
  // Flat ground slab (visual only; collision comes from the terrain function)
  ground(x0, z0, x1, z1, matKey, surface, y = 0, tex = 4) {
    const sx = Math.abs(x1 - x0), sz = Math.abs(z1 - z0);
    const g = worldBox(sx, 0.2, sz, tex); g.translate((x0 + x1) / 2, y - 0.1, (z0 + z1) / 2);
    this.add(g, matKey, { cast: false });
    if (surface) this.region(x0, z0, x1, z1, surface);
  }

  // ---------- navigation ----------
  node(x, z, y = 0, tags = []) {
    const n = { id: this.nodes.length, pos: new THREE.Vector3(x, y, z), links: [], tags: new Set(tags), door: null };
    this.nodes.push(n); return n;
  }
  link(a, b) { if (a === b) return; if (!a.links.includes(b)) a.links.push(b); if (!b.links.includes(a)) b.links.push(a); }
  chain(list) { for (let i = 1; i < list.length; i++) this.link(list[i - 1], list[i]); }

  instanced(geo, material, matrices, { cast = true, receive = true, chunk = 60 } = {}) {
    // Split into spatial chunks so off-screen chunks are culled.
    const groups = new Map();
    const p = new THREE.Vector3();
    for (const m of matrices) {
      p.setFromMatrixPosition(m);
      const k = Math.floor(p.x / chunk) + ',' + Math.floor(p.z / chunk);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(m);
    }
    const out = [];
    for (const list of groups.values()) {
      const im = new THREE.InstancedMesh(geo, material, list.length);
      list.forEach((m, i) => im.setMatrixAt(i, m));
      im.castShadow = cast; im.receiveShadow = receive;
      im.computeBoundingSphere();
      this.root.add(im); out.push(im);
    }
    return out;
  }

  finish() {
    for (const [, g] of this.geos) {
      if (!g.list.length) continue;
      let merged;
      try { merged = mergeGeometries(g.list, false); } catch (e) { console.warn('merge failed', g.matKey, e); continue; }
      if (!merged) { console.warn('merge null', g.matKey); continue; }
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, this.m(g.matKey));
      mesh.castShadow = g.cast; mesh.receiveShadow = g.receive;
      mesh.matrixAutoUpdate = false; mesh.updateMatrix();
      this.root.add(mesh);
      g.list.forEach((x) => x.dispose());
    }
    this.geos.clear();
    // all light glows in one draw call; per-light alpha is updated by the map each frame
    const glowing = this.lights.filter((L) => L.glowSize > 0);
    if (glowing.length) {
      const n = glowing.length; const g = new THREE.BufferGeometry();
      const pos = new Float32Array(n * 3), col = new Float32Array(n * 4), size = new Float32Array(n);
      glowing.forEach((L, i) => { pos.set([L.pos.x, L.pos.y, L.pos.z], i * 3); size[i] = L.glowSize * 1.6; col.set([L.color.r, L.color.g, L.color.b, 0.8], i * 4); L.glowIndex = i; });
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aColor', new THREE.BufferAttribute(col, 4)); g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
      const m = new THREE.ShaderMaterial({ uniforms: { uTex: { value: glowTex }, uScale: { value: 600 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        vertexShader: 'attribute float aSize; attribute vec4 aColor; varying vec4 vColor; uniform float uScale; void main(){ vColor = aColor; vec4 mv = modelViewMatrix * vec4(position,1.0); vColor.a *= clamp(1.0 - (-mv.z) / 110.0, 0.0, 1.0); gl_PointSize = aSize * uScale / max(-mv.z, 0.1); gl_Position = projectionMatrix * mv; }',
        fragmentShader: 'uniform sampler2D uTex; varying vec4 vColor; void main(){ vec4 t = texture2D(uTex, gl_PointCoord); gl_FragColor = vec4(vColor.rgb * t.rgb, vColor.a * t.a); }' });
      this.glowPoints = new THREE.Points(g, m); this.glowPoints.frustumCulled = false; this.glowPoints.renderOrder = 2; this.root.add(this.glowPoints);
    }
    // windows as one instanced mesh with per-instance colour
    if (this.windows.length) {
      const geo = new THREE.PlaneGeometry(1, 1);
      const m = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
      const im = new THREE.InstancedMesh(geo, m, this.windows.length);
      const o = new THREE.Object3D();
      this.windows.forEach((W, i) => {
        o.position.copy(W.pos); o.position.x += W.nx * 0.02; o.position.z += W.nz * 0.02;
        o.rotation.set(0, Math.atan2(W.nx, W.nz), 0); o.scale.set(W.w, W.h, 1); o.updateMatrix();
        im.setMatrixAt(i, o.matrix); W.index = i;
      });
      im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.windows.length * 3), 3);
      this.windowMesh = im; this.root.add(im);
      this.refreshWindows(1);
    }
  }

  refreshWindows(abandonFactor = 1) {
    if (!this.windowMesh) return;
    const c = new THREE.Color();
    for (const W of this.windows) {
      if (W.lit && abandonFactor > 0.5) c.copy(W.color).multiplyScalar(0.55 * (1 - W.flick));
      else c.setRGB(0.012, 0.014, 0.02);
      this.windowMesh.setColorAt(W.index, c);
    }
    this.windowMesh.instanceColor.needsUpdate = true;
  }
}

const glowTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.2, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); return t;
})();

// The rift: a hole in the world. A dark disc with a swirling rim shader.
export const riftUniforms = { uTime: { value: 0 } };
function makeRift() {
  const g = new THREE.Group();
  const m = new THREE.ShaderMaterial({
    uniforms: riftUniforms, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform float uTime; varying vec2 vUv;
      void main(){ vec2 c = vUv - 0.5; float r = length(c) * 2.0; float a = atan(c.y, c.x);
        float swirl = sin(a * 6.0 + r * 12.0 - uTime * 2.0) * 0.5 + 0.5;
        float rim = smoothstep(0.55, 0.85, r) * (1.0 - smoothstep(0.85, 1.0, r));
        vec3 col = mix(vec3(0.0), vec3(0.35, 0.1, 0.55), rim * (0.5 + swirl * 0.8));
        float alpha = (1.0 - smoothstep(0.92, 1.0, r)) * (r < 0.6 ? 0.97 : 0.75 + rim * 0.25);
        gl_FragColor = vec4(col, alpha); }`,
  });
  const disc = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 3.2), m); disc.position.y = 1.6; g.add(disc);
  const disc2 = disc.clone(); disc2.rotation.y = Math.PI / 2; disc2.scale.set(0.3, 1, 1);
  g.add(disc2);
  return g;
}

// Material presets. Keys reference procedural textures in textures.js.
export const MATERIAL_PRESETS = {
  asphalt: { tex: 'asphalt', repeat: 1, roughness: 0.9 },
  paint: { color: 0xb8b0a0, roughness: 0.7 },
  wetAsphalt: { tex: 'wetAsphalt', repeat: 1, roughness: 0.28, color: 0x9a9a9a, envMapIntensity: 1.2, normalScale: 0.35 },
  sidewalk: { tex: 'concrete', repeat: 1, roughness: 0.85, color: 0xb0b0aa },
  wetSidewalk: { tex: 'concrete', repeat: 1, roughness: 0.5, color: 0x777774, envMapIntensity: 1, normalScale: 0.3 },
  concrete: { tex: 'concrete', repeat: 1, roughness: 0.9 },
  darkConcrete: { tex: 'concrete', repeat: 1, roughness: 0.9, color: 0x666666 },
  brick: { tex: 'brick', repeat: 1, roughness: 0.9 },
  darkBrick: { tex: 'brick', repeat: 1, roughness: 0.9, color: 0x776666 },
  siding: { tex: 'siding', repeat: 1, roughness: 0.75, color: 0xd8d4c8 },
  sidingBlue: { tex: 'siding', repeat: 1, roughness: 0.75, color: 0x8a9cb0 },
  sidingGreen: { tex: 'siding', repeat: 1, roughness: 0.75, color: 0x8d9a80 },
  sidingRed: { tex: 'siding', repeat: 1, roughness: 0.75, color: 0xa88070 },
  sidingRot: { tex: 'siding', repeat: 1, roughness: 0.95, color: 0x6a665c },
  roof: { tex: 'shingles', repeat: 1, roughness: 0.9 },
  grass: { tex: 'grass', repeat: 1, roughness: 0.95 },
  forestFloor: { tex: 'forestFloor', repeat: 1, roughness: 0.95 },
  dirt: { tex: 'dirt', repeat: 1, roughness: 0.95 },
  rock: { tex: 'rock', repeat: 1, roughness: 0.9 },
  bark: { tex: 'bark', repeat: 1, roughness: 0.95 },
  wood: { tex: 'planks', repeat: 1, roughness: 0.8 },
  woodFloor: { tex: 'woodFloor', repeat: 1, roughness: 0.6 },
  darkWood: { tex: 'planks', repeat: 1, roughness: 0.8, color: 0x664a3a },
  door: { tex: 'planks', repeat: 1, roughness: 0.7, color: 0x9a7a60 },
  doorWhite: { tex: 'plaster', repeat: 1, roughness: 0.6, color: 0xd0ccc0 },
  doorMetal: { tex: 'metal', repeat: 1, roughness: 0.5, metalness: 0.6, color: 0x8899aa },
  tile: { tex: 'tile', repeat: 1, roughness: 0.35 },
  dirtyTile: { tex: 'tile', repeat: 1, roughness: 0.5, color: 0xa8b0a0 },
  hospitalWall: { tex: 'hospitalWall', repeat: 1, roughness: 0.8 },
  wallpaper: { tex: 'wallpaper', repeat: 1, roughness: 0.9 },
  plaster: { tex: 'plaster', repeat: 1, roughness: 0.9 },
  carpet: { tex: 'carpet', repeat: 1, roughness: 1 },
  metal: { tex: 'metal', repeat: 1, roughness: 0.45, metalness: 0.7 },
  rust: { tex: 'metal', repeat: 1, roughness: 0.8, metalness: 0.4, color: 0x9a6a50 },
  cloth: { tex: 'cloth', repeat: 1, roughness: 1 },
  bone: { tex: 'bone', repeat: 1, roughness: 0.6 },
  void: { tex: 'void', repeat: 1, roughness: 0.4, metalness: 0.2 },
  flesh: { tex: 'flesh', repeat: 1, roughness: 0.25, metalness: 0.1 },
  tarp: { tex: 'tarp', repeat: 1, roughness: 0.7 },
  carPaint: { color: 0x3a4a5a, roughness: 0.25, metalness: 0.6 },
  carPaintRed: { color: 0x6a1a18, roughness: 0.25, metalness: 0.6 },
  carPaintWhite: { color: 0xb8b8b4, roughness: 0.25, metalness: 0.5 },
  carPaintBlack: { color: 0x101214, roughness: 0.2, metalness: 0.6 },
  carPaintGreen: { color: 0x2a3a2a, roughness: 0.3, metalness: 0.5 },
  glass: { color: 0x0a0e12, roughness: 0.05, metalness: 0.9, envMapIntensity: 1.5 },
  tire: { color: 0x111111, roughness: 0.9 },
  chrome: { color: 0xcccccc, roughness: 0.15, metalness: 1 },
  brass: { color: 0xb08a40, roughness: 0.35, metalness: 1 },
  blackMetal: { color: 0x1a1a1c, roughness: 0.5, metalness: 0.8 },
  paintedMetal: { color: 0x4a5a48, roughness: 0.6, metalness: 0.4 },
  yellowMetal: { color: 0xa08020, roughness: 0.5, metalness: 0.4 },
  redMetal: { color: 0x7a1a1a, roughness: 0.5, metalness: 0.4 },
  whiteMetal: { color: 0xc8c8c0, roughness: 0.4, metalness: 0.3 },
  plastic: { color: 0x888888, roughness: 0.5 },
  fabricBlue: { tex: 'cloth', repeat: 1, roughness: 1, color: 0x3a4a6a },
  fabricRed: { tex: 'cloth', repeat: 1, roughness: 1, color: 0x6a2a2a },
  fabricGreen: { tex: 'cloth', repeat: 1, roughness: 1, color: 0x4a5a3a },
  fabricBrown: { tex: 'cloth', repeat: 1, roughness: 1, color: 0x5a4a3a },
  sheet: { tex: 'cloth', repeat: 1, roughness: 1, color: 0xc8c8c0 },
  mattress: { tex: 'cloth', repeat: 1, roughness: 1, color: 0x9a9a88 },
  water: () => new THREE.MeshStandardMaterial({ color: 0x0a1418, roughness: 0.05, metalness: 0.2, envMapIntensity: 1.4 }),
  lampOn: { color: 0xffffff, emissive: 0xffe0b0, emissiveIntensity: 2 },
  lampCold: { color: 0xffffff, emissive: 0xd0e8ff, emissiveIntensity: 2 },
  neonRed: { color: 0x220000, emissive: 0xff2030, emissiveIntensity: 3 },
  neonBlue: { color: 0x000022, emissive: 0x30a0ff, emissiveIntensity: 3 },
  neonGreen: { color: 0x002200, emissive: 0x30ff80, emissiveIntensity: 2.5 },
  neonPink: { color: 0x220011, emissive: 0xff40c0, emissiveIntensity: 3 },
  screen: { color: 0x000000, emissive: 0x7090ff, emissiveIntensity: 1.2 },
  black: { color: 0x050505, roughness: 1 },
  glowSprite: () => new THREE.SpriteMaterial({ map: glowTex, color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8 }),
  leaves: () => null,
};
