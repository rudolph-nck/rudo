import * as THREE from "three";
import { Assets } from "./assets";
import { engrave, engravePhoto } from "./engrave";
import { ACCENT } from "./Type";

/** Every material the world uses, built once per asset set. */
export const buildMats = (a: Assets) => {
    const wall = engrave({ map: a.concrete, bump: a.concreteBump, bumpScale: 1.2, color: "#a3a19d", ink: "#e6e4e0", spacing: 0.026 });
  const floor = engrave({ map: a.concrete, color: "#8a8884", ink: "#d6d4d0", spacing: 0.03, dir: [0.1, 0.35, 1] });
  const cold = engrave({ map: a.concrete, bump: a.concreteBump, color: "#9b9d9f", ink: "#cfd1d3", spacing: 0.03, gain: 2.6 });
  const brick = engrave({ map: a.concrete, color: "#c2bfba", ink: "#ecebe8", spacing: 0.014, dir: [0, 1, 0.35], warp: 0.8 });
  const roof = engrave({ map: a.concrete, color: "#8f8c87", ink: "#dcdad6", spacing: 0.034, gain: 2.8 });
  const photo = engravePhoto(a.rudo);
  const tube = new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false });
  const silhouette = new THREE.MeshBasicMaterial({ map: a.rudo, color: "#000000", transparent: true, alphaTest: 0.35 });
  const halo = new THREE.MeshBasicMaterial({ map: a.rudo, color: ACCENT, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const cable = new THREE.MeshStandardMaterial({ color: "#121416", roughness: 0.5, metalness: 0.3 });
  const led = new THREE.MeshBasicMaterial({ color: "#d9e2ea", toneMapped: false });
  const packet = new THREE.MeshBasicMaterial({ color: new THREE.Color(ACCENT).multiplyScalar(2), toneMapped: false });
  const rim = new THREE.MeshBasicMaterial({ color: new THREE.Color(ACCENT).multiplyScalar(1.6), toneMapped: false });
  const edge = new THREE.LineBasicMaterial({ color: "#d9d7d3", transparent: true, opacity: 0.75 });
  const blue = new THREE.LineBasicMaterial({ color: "#e4e2de", transparent: true, opacity: 0.5 });
  const blueHot = new THREE.LineBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.85 });
  const shadow = new THREE.MeshBasicMaterial({
    transparent: true,
    depthWrite: false,
    color: "#000000",
    opacity: 0.6,
    alphaMap: (() => {
      const c = document.createElement("canvas");
      c.width = c.height = 128;
      const x = c.getContext("2d")!;
      const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, "#fff");
      g.addColorStop(1, "#000");
      x.fillStyle = g;
      x.fillRect(0, 0, 128, 128);
      return new THREE.CanvasTexture(c);
    })(),
  });
  const shoes = engravePhoto(a.sneakers);
  return { shoes, wall, floor, cold, brick, roof, photo, tube, silhouette, halo, cable, led, packet, rim, edge, blue, blueHot, shadow };
};
export type Mats = ReturnType<typeof buildMats>;
