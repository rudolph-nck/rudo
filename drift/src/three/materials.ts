import * as THREE from "three";
import { Assets } from "./assets";

export const PAL = {
  ink: "#efede9",
  stone: "#c4b6a2",
  hot: "#fff4e6",
  drift: "#a9b7c4",
  concrete: "#77716a",
  black: "#050505",
} as const;

const texCache = new Map<string, THREE.Texture>();
const rep = (t: THREE.Texture, r: number, key: string) => {
  const k = key + r;
  let c = texCache.get(k);
  if (!c) {
    c = t.clone();
    c.wrapS = c.wrapT = THREE.RepeatWrapping;
    c.repeat.set(r, r);
    c.needsUpdate = true;
    texCache.set(k, c);
  }
  return c;
};

/**
 * Cast stone / concrete: the procedural knockdown concrete as albedo + bump, matte with a faint
 * sheen on the edges. `tint` pulls it toward the stone accent or toward grey.
 */
export const stoneMat = (a: Assets, tint: string = PAL.stone, repeat = 0.35, bump = 2.2) =>
  new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(tint).multiplyScalar(1.55),
    map: rep(a.concrete, repeat, "c"),
    bumpMap: rep(a.concreteBump, repeat, "b"),
    bumpScale: bump,
    roughness: 0.86,
    metalness: 0,
    sheen: 0.25,
    sheenRoughness: 0.8,
    sheenColor: new THREE.Color("#ffffff"),
  });

/** Clear glass with a slightly cool body, thick enough to refract what's behind it. */
export const glassMat = () =>
  new THREE.MeshPhysicalMaterial({
    color: "#ffffff",
    transmission: 1,
    thickness: 0.6,
    ior: 1.52,
    roughness: 0.035,
    metalness: 0,
    attenuationColor: new THREE.Color("#cfd8db"),
    attenuationDistance: 1.6,
    specularIntensity: 1,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    envMapIntensity: 1.6,
    dispersion: 0.25,
  });

/** Emissive light that blooms (the hot point, glowing cracks). */
export const lightMat = (color: string = PAL.hot, gain = 3) =>
  new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(gain), toneMapped: false });

/** Matte painted letters (drift grey, ink). */
export const matteMat = (color: string, rough = 0.62) =>
  new THREE.MeshPhysicalMaterial({ color, roughness: rough, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.4 });
