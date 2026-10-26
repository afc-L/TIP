// Shared uniforms + shader patch that dithers away geometry between the camera and the player,
// so trees and ruins never hide the action.
import * as THREE from 'three';

export const occlusionUniforms = {
  uPlayer: { value: new THREE.Vector3() },
  uCam: { value: new THREE.Vector3(0, 30, 20) },
  uFadeR: { value: 3.2 },
};

export const timeUniform = { value: 0 };

export function occludable<T extends THREE.Material>(m: T): T {
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, occlusionUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vOccWorld;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vec4 occW = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          occW = instanceMatrix * occW;
        #endif
        vOccWorld = (modelMatrix * occW).xyz;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vOccWorld;
        uniform vec3 uPlayer; uniform vec3 uCam; uniform float uFadeR;`)
      .replace('void main() {', `void main() {
        vec3 occPa = vOccWorld - uCam;
        vec3 occBa = (uPlayer + vec3(0.0, 1.0, 0.0)) - uCam;
        float occH = clamp(dot(occPa, occBa) / dot(occBa, occBa), 0.0, 1.0);
        float occD = length(occPa - occBa * occH);
        if (occH < 0.96 && occD < uFadeR && vOccWorld.y > 0.9) {
          vec2 cell = floor(gl_FragCoord.xy);
          float pattern = mod(cell.x + cell.y * 2.0, 4.0);
          float keep = occD / uFadeR;
          if (pattern > keep * 4.0 - 0.5) discard;
        }`);
  };
  m.customProgramCacheKey = () => 'occ';
  return m;
}

export function swaying<T extends THREE.Material>(m: T, amount = 0.2): T {
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = timeUniform;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 swIp = vec3(instanceMatrix[3][0], 0.0, instanceMatrix[3][2]);
        #else
          vec3 swIp = vec3(0.0);
        #endif
        float sw = sin(uTime * 1.9 + swIp.x * 0.37 + swIp.z * 0.23) * ${amount.toFixed(3)} * max(position.y, 0.0);
        transformed.x += sw;
        transformed.z += sw * 0.6;`);
  };
  m.customProgramCacheKey = () => 'sway' + amount;
  return m;
}
