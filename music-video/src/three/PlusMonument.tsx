import { ThreeCanvas } from "@remotion/three";
import React, { useMemo } from "react";
import * as THREE from "three";
import { PLUS } from "../theme";

/** Brand plus (exact vector geometry) extruded into a lit, sculptural object. */
const usePlusGeometry = () =>
  useMemo(() => {
    const pts: Array<[number, number]> = [
      [25.743, 8.086],
      [22.652, 13.26],
      [15.494, 13.26],
      [15.494, 21.349],
      [10.32, 21.349],
      [10.32, 13.26],
      [0, 13.26],
      [3.106, 8.086],
      [10.32, 8.086],
      [10.32, 0],
      [15.494, 0],
      [15.494, 8.086],
    ];
    const s = 1 / PLUS.h; // normalise to height 1
    const shape = new THREE.Shape();
    pts.forEach(([x, y], i) => {
      const X = (x - PLUS.w / 2) * s * 4,
        Y = -(y - PLUS.h / 2) * s * 4;
      if (i === 0) shape.moveTo(X, Y);
      else shape.lineTo(X, Y);
    });
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.9, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 3 });
    g.center();
    return g;
  }, []);

const Monument: React.FC<{ rotY: number; rotX: number; scale: number; glowAmt: number; ringT: number }> = ({ rotY, rotX, scale, glowAmt, ringT }) => {
  const geo = usePlusGeometry();
  return (
    <>
      <ambientLight intensity={0.12} />
      <directionalLight position={[-4, 5, 6]} intensity={2.6} color="#ffffff" />
      <pointLight position={[3.5, -2, -3]} intensity={60} color="#00b2e3" distance={20} />
      <pointLight position={[-3, 1, 4]} intensity={12} color="#f4f1ea" distance={14} />
      <group rotation={[rotX, rotY, 0]} scale={scale}>
        <mesh geometry={geo}>
          <meshStandardMaterial color="#0b86ad" metalness={0.55} roughness={0.28} emissive="#00b2e3" emissiveIntensity={0.18 + 0.55 * glowAmt} />
        </mesh>
      </group>
      {/* the line, orbiting */}
      <group rotation={[1.2, 0, 0.25]}>
        <mesh rotation={[0, 0, ringT]}>
          <torusGeometry args={[2.7, 0.016, 8, 160, Math.PI * 2 * Math.min(1, ringT / 2.5 + 0.0001)]} />
          <meshBasicMaterial color="#00b2e3" />
        </mesh>
      </group>
    </>
  );
};

export const PlusMonument: React.FC<{
  width?: number;
  height?: number;
  rotY: number;
  rotX?: number;
  scale?: number;
  glowAmt?: number;
  ringT?: number;
  camZ?: number;
  camX?: number;
}> = ({ width = 1920, height = 1080, rotY, rotX = 0.15, scale = 1, glowAmt = 0, ringT = 0, camZ = 9, camX = 0 }) => (
  <ThreeCanvas width={width} height={height} camera={{ position: [camX, 0, camZ], fov: 40 }} gl={{ antialias: true, alpha: true }} style={{ position: "absolute", inset: 0 }}>
    <Monument rotY={rotY} rotX={rotX} scale={scale} glowAmt={glowAmt} ringT={ringT} />
  </ThreeCanvas>
);
