// Renderer, post-processing chain and the dynamic light pool.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export const QUALITY = {
  low: { pixelRatio: 0.7, shadows: false, shadowSize: 0, bloom: false, lights: 4, npcScale: 0.6, drawDist: 140, mirrors: false, particles: 0.4, grass: 0, fogBoost: 1.25, antialias: false },
  medium: { pixelRatio: 1, shadows: true, shadowSize: 1024, bloom: true, lights: 6, npcScale: 0.85, drawDist: 220, mirrors: true, particles: 0.75, grass: 0.5, fogBoost: 1, antialias: false },
  high: { pixelRatio: Math.min(window.devicePixelRatio, 1.5), shadows: true, shadowSize: 2048, bloom: true, lights: 9, npcScale: 1, drawDist: 320, mirrors: true, particles: 1, grass: 1, fogBoost: 0.9, antialias: true },
};

const FinalShader = {
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) },
    uVignette: { value: 0.9 }, uGrain: { value: 0.06 }, uAberration: { value: 0.0015 }, uDistort: { value: 0 },
    uDesat: { value: 0.25 }, uTint: { value: new THREE.Vector3(1, 1, 1) }, uLift: { value: new THREE.Vector3(0, 0, 0) },
    uNight: { value: 0 }, uPredator: { value: 0 }, uFeed: { value: 0 }, uFlash: { value: 0 }, uDark: { value: 0 },
    uStretch: { value: 0 }, uGlitch: { value: 0 }, uDamage: { value: 0 }, uPresence: { value: 0 }, uExposure: { value: 1 },
    uSenses: { value: 0 }, uFear: { value: 0 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime; uniform vec2 uRes;
    uniform float uVignette, uGrain, uAberration, uDistort, uDesat, uNight, uPredator, uFeed, uFlash, uDark, uStretch, uGlitch, uDamage, uPresence, uExposure, uSenses, uFear;
    uniform vec3 uTint, uLift;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    vec3 thermal(float t){
      vec3 c1 = vec3(0.02,0.0,0.15), c2 = vec3(0.35,0.0,0.6), c3 = vec3(0.9,0.1,0.15), c4 = vec3(1.0,0.75,0.1), c5 = vec3(1.0,1.0,0.85);
      if (t < 0.25) return mix(c1,c2,t/0.25);
      if (t < 0.5) return mix(c2,c3,(t-0.25)/0.25);
      if (t < 0.75) return mix(c3,c4,(t-0.5)/0.25);
      return mix(c4,c5,(t-0.75)/0.25);
    }
    void main(){
      vec2 uv = vUv;
      vec2 c = uv - 0.5;
      // hallway stretch: pull the centre inward (tunnel)
      float r = length(c);
      uv = 0.5 + c * (1.0 - uStretch * 0.35 * (1.0 - r * 1.4));
      // wavy distortion (hallucination / feeding)
      uv.x += sin(uv.y * 18.0 + uTime * 2.3) * 0.004 * uDistort;
      uv.y += sin(uv.x * 14.0 + uTime * 1.7) * 0.003 * uDistort;
      // glitch band
      float band = step(0.985 - uGlitch * 0.1, hash(vec2(floor(uv.y * 40.0), floor(uTime * 12.0))));
      uv.x += band * uGlitch * (hash(vec2(uTime, uv.y)) - 0.5) * 0.08;
      float ab = uAberration + uDistort * 0.004 + uDamage * 0.006 + uPresence * 0.004;
      vec2 dir = c * ab * 2.0;
      vec3 col;
      col.r = texture2D(tDiffuse, uv + dir).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - dir).b;
      col *= uExposure;
      // night vision
      if (uNight > 0.001) {
        float l = dot(col, vec3(0.3,0.59,0.11));
        l = 1.0 - exp(-l * 14.0); // amplify faint light, compress bright light
        l = pow(l, 1.2) * 0.85;
        vec3 nv = vec3(0.25, 1.0, 0.35) * (l + 0.04) ;
        nv += (hash(uv * uRes + uTime) - 0.5) * 0.12;
        nv *= 0.92 + 0.08 * sin(uv.y * uRes.y * 1.5);
        col = mix(col, nv, uNight);
      }
      // predator (thermal + edges)
      if (uPredator > 0.001) {
        vec2 px = 1.0 / uRes;
        float l = dot(col, vec3(0.3,0.59,0.11));
        float lx = dot(texture2D(tDiffuse, uv + vec2(px.x,0)).rgb - texture2D(tDiffuse, uv - vec2(px.x,0)).rgb, vec3(0.33));
        float ly = dot(texture2D(tDiffuse, uv + vec2(0,px.y)).rgb - texture2D(tDiffuse, uv - vec2(0,px.y)).rgb, vec3(0.33));
        float e = clamp(length(vec2(lx,ly)) * 6.0, 0.0, 1.0);
        vec3 th = thermal(clamp(1.0 - exp(-l * 5.0), 0.0, 1.0)) * 0.8 + e * vec3(0.3,0.5,1.0) * 0.5;
        col = mix(col, th, uPredator);
      }
      // grading
      float lum = dot(col, vec3(0.299,0.587,0.114));
      col = mix(col, vec3(lum), uDesat);
      col = col * uTint + uLift;
      // senses: cool desaturation at edges
      col = mix(col, vec3(lum) * vec3(0.6,0.7,1.0), uSenses * 0.35 * smoothstep(0.2, 0.7, r));
      // feeding pulse: dark red closing in
      float v = smoothstep(0.85, 0.2, r * (1.0 + uFeed * 0.6 + uFear * 0.4));
      col *= mix(1.0, v, uVignette);
      col = mix(col, col * vec3(0.55, 0.08, 0.08), uFeed * smoothstep(0.15, 0.7, r));
      col = mix(col, col * vec3(0.6,0.0,0.0), uDamage * smoothstep(0.1, 0.8, r));
      // presence: the image darkens and loses colour around the edges
      col *= 1.0 - uPresence * 0.6 * smoothstep(0.1, 0.75, r);
      col *= 1.0 - uDark;
      // grain
      col += (hash(uv * uRes + fract(uTime * 7.0)) - 0.5) * uGrain * (0.25 + sqrt(max(dot(col, vec3(0.33)), 0.0)) * 2.0);
      col += uFlash;
      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }`,
};

export class Graphics {
  constructor(canvas) {
    this.canvas = canvas;
    this.qualityName = 'medium';
    this.q = QUALITY.medium;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.08, 400);
    this.scene = null;
    this.lightPool = [];
    this.virtualLights = [];
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    window.addEventListener('resize', () => this.resize());
  }

  setQuality(name) {
    this.qualityName = name; this.q = QUALITY[name];
    this.renderer.setPixelRatio(this.q.pixelRatio);
    this.renderer.shadowMap.enabled = this.q.shadows;
    this.renderer.shadowMap.needsUpdate = true;
    this.camera.far = this.q.drawDist;
    this.camera.updateProjectionMatrix();
    if (this.scene) this.setupComposer();
    this.resize();
  }

  setScene(scene) {
    this.scene = scene;
    // light pool: fixed number of point lights reassigned to nearest virtual lights every frame
    this.lightPool.forEach((l) => l.parent && l.parent.remove(l));
    this.lightPool = [];
    for (let i = 0; i < this.q.lights; i++) {
      const L = new THREE.PointLight(0xffffff, 0, 10, 2);
      L.castShadow = false; scene.add(L); this.lightPool.push(L);
    }
    this.setupComposer();
  }

  setupComposer() {
    const size = this.renderer.getSize(new THREE.Vector2());
    this.composer = new EffectComposer(this.renderer);
    this.composer.setPixelRatio(this.q.pixelRatio);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);
    if (this.q.bloom) {
      this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.55, 0.6, 0.82);
      this.composer.addPass(this.bloom);
    } else this.bloom = null;
    this.final = new ShaderPass(FinalShader);
    this.composer.addPass(this.final);
    this.composer.addPass(new OutputPass());
    this.fx = this.final.uniforms;
    this.resize();
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    if (this.composer) { this.composer.setSize(w, h); this.fx.uRes.value.set(w * this.q.pixelRatio, h * this.q.pixelRatio); }
  }

  // Assign pool lights to the closest / most important virtual lights.
  updateLights(virtual, focus, time) {
    const scored = [];
    for (const L of virtual) {
      if (!L.on || L.factor <= 0.01) continue;
      const d = L.pos.distanceTo(focus);
      if (d > L.distance + 40) continue;
      scored.push([d - L.intensity * 0.5, L]);
    }
    scored.sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < this.lightPool.length; i++) {
      const P = this.lightPool[i];
      const s = scored[i];
      if (!s) { P.intensity = 0; continue; }
      const L = s[1];
      P.position.copy(L.pos); P.color.copy(L.color); P.distance = L.distance;
      P.intensity = L.intensity * L.factor * L.cur;
    }
  }

  render() { this.composer.render(); }
}
