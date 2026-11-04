import React, { useMemo } from "react";
import * as THREE from "three";
import { MeshReflectorMaterial } from "@react-three/drei";
import { weathered } from "./materials";

/**
 * The key: one hard overhead spot at a steep angle (like the single light over the figures on the cover), sharp
 * shadows, soft penumbra. Direction follows the cover/brief ratio (2, 8, 5) from its subject, clamped under the ceiling.
 */
export const keySpotPos = (target: THREE.Vector3, dist = 3.2, ceiling = 2.95) => {
  const dir = new THREE.Vector3(2, 8, 5).normalize();
  const p = target.clone().addScaledVector(dir, dist);
  if (p.y > ceiling) p.addScaledVector(dir, (ceiling - p.y) / dir.y);
  return p;
};
export const KeySpot: React.FC<{ target: THREE.Vector3; dist?: number; intensity?: number; color?: string; ceiling?: number; angle?: number }> = ({ target, dist = 3.2, intensity = 38, color = "#eef1f6", ceiling = 2.95, angle = 0.5 }) => {
  const p = keySpotPos(target, dist, ceiling);
  const tgt = useMemo(() => new THREE.Object3D(), []);
  tgt.position.copy(target); tgt.updateMatrixWorld();
  return (
    <>
      <primitive object={tgt} />
      <spotLight position={p.toArray() as [number, number, number]} target={tgt} angle={angle} penumbra={0.8} intensity={intensity} decay={2} color={color}
        castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.02} shadow-camera-near={0.3} shadow-camera-far={20} />
    </>
  );
};

/** Puddle mask: where the concrete is wet (glossy, mirror-ish) vs dry (rough). */
let PUD: THREE.CanvasTexture | null = null;
const puddles = () => {
  if (PUD) return PUD;
  const N = 512, c = document.createElement("canvas"); c.width = c.height = N; const g = c.getContext("2d")!;
  let s = 99; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  g.fillStyle = "rgb(150,150,150)"; g.fillRect(0, 0, N, N);
  for (let i = 0; i < 70; i++) { const x = r() * N, y = r() * N, rad = 20 + r() * 90; const gr = g.createRadialGradient(x, y, rad * 0.3, x, y, rad); gr.addColorStop(0, "rgba(20,20,20,0.9)"); gr.addColorStop(1, "rgba(20,20,20,0)"); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
  PUD = new THREE.CanvasTexture(c); PUD.wrapS = PUD.wrapT = THREE.RepeatWrapping; PUD.repeat.set(3, 3); PUD.colorSpace = THREE.NoColorSpace;
  return PUD;
};

/**
 * Wet concrete floor: a real planar reflection (blurred by roughness, broken up by puddles) so the key light's pool
 * and the type's emission mirror into the ground.
 */
export const WetFloor: React.FC<{ size?: number; y?: number; strength?: number }> = ({ size = 40, y = 0, strength = 3 }) => {
  const W = weathered();
  const pud = puddles();
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]} receiveShadow>
      <planeGeometry args={[size, size]} />
      <MeshReflectorMaterial
        resolution={1024} blur={[400, 120]} mixBlur={0.9} mixStrength={strength} mixContrast={1.1} depthScale={0.6} minDepthThreshold={0.2} maxDepthThreshold={1.4}
        color="#16161a" roughness={0.9} metalness={0.25} roughnessMap={pud} map={W.albedo} bumpMap={W.bump} bumpScale={0.4} mirror={0.6}
      />
    </mesh>
  );
};
