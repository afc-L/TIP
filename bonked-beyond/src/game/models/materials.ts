import * as THREE from 'three';

const cache = new Map<string, THREE.Material>();

/** Shared flat-shaded lambert material. */
export function mat(color: THREE.ColorRepresentation, emissive?: THREE.ColorRepresentation, emissiveIntensity = 1): THREE.MeshLambertMaterial {
  const key = `${new THREE.Color(color).getHexString()}|${emissive ? new THREE.Color(emissive).getHexString() : ''}|${emissiveIntensity}`;
  let m = cache.get(key) as THREE.MeshLambertMaterial | undefined;
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color, flatShading: true });
    if (emissive) { m.emissive.set(emissive); m.emissiveIntensity = emissiveIntensity; }
    cache.set(key, m);
  }
  return m;
}

/** Unshaded glowing material. */
export function glow(color: THREE.ColorRepresentation): THREE.MeshBasicMaterial {
  const key = `glow|${new THREE.Color(color).getHexString()}`;
  let m = cache.get(key) as THREE.MeshBasicMaterial | undefined;
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color });
    cache.set(key, m);
  }
  return m;
}

/** A non-shared material (for meshes that flash individually). */
export function ownMat(color: THREE.ColorRepresentation): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color, flatShading: true });
}
