import * as THREE from 'three';

// Stylised animated water with sun glints, fresnel and fog.
export function createWater(size: number, segments = 1) {
  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0 },
      uSunDir: { value: new THREE.Vector3(0.3, 0.8, 0.2) },
      uSunColor: { value: new THREE.Color('#fff6e0') },
      uDeep: { value: new THREE.Color('#0b4a66') },
      uShallow: { value: new THREE.Color('#1fa0b8') },
      uSky: { value: new THREE.Color('#9fd3ff') },
      uNight: { value: 0 },
    },
  ]);
  const mat = new THREE.ShaderMaterial({
    uniforms,
    fog: true,
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      #include <fog_pars_vertex>
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform vec3 uSky;
      uniform float uNight;
      varying vec3 vWorld;
      #include <fog_pars_fragment>
      float wave(vec2 p, vec2 d, float f, float s) { return sin(dot(p, d) * f + uTime * s); }
      void main() {
        vec2 p = vWorld.xz;
        float e = 0.6;
        vec2 grad = vec2(0.0);
        vec2 dirs[4];
        dirs[0] = normalize(vec2(1.0, 0.3)); dirs[1] = normalize(vec2(-0.4, 1.0));
        dirs[2] = normalize(vec2(0.7, -0.8)); dirs[3] = normalize(vec2(-1.0, -0.2));
        float fr[4]; fr[0] = 0.21; fr[1] = 0.33; fr[2] = 0.55; fr[3] = 0.9;
        float sp[4]; sp[0] = 1.1; sp[1] = 1.6; sp[2] = 2.3; sp[3] = 3.1;
        for (int i = 0; i < 4; i++) {
          float c = cos(dot(p, dirs[i]) * fr[i] + uTime * sp[i]);
          grad += dirs[i] * fr[i] * c * (0.35 / float(i + 1));
        }
        vec3 n = normalize(vec3(-grad.x * e, 1.0, -grad.y * e));
        vec3 v = normalize(cameraPosition - vWorld);
        float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
        vec3 base = mix(uShallow, uDeep, clamp(0.5 + 0.5 * n.x, 0.0, 1.0));
        vec3 col = mix(base, uSky, 0.15 + fres * 0.6);
        vec3 h = normalize(uSunDir + v);
        float spec = pow(max(dot(n, h), 0.0), 180.0) * step(0.0, uSunDir.y);
        col += uSunColor * spec * 2.0;
        // night: city light shimmer
        float shimmer = pow(max(0.0, sin(p.x * 0.8 + uTime * 2.0) * sin(p.y * 0.5 - uTime * 1.3)), 8.0);
        col = mix(col, col * 0.25 + vec3(0.9, 0.6, 0.3) * shimmer * 0.25, uNight);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  return { mesh, mat };
}
