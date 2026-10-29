import React, { useLayoutEffect, useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { contourMat } from "../three/contour";

/** Look-dev for the contour shader before RUDO's mesh arrives. */
const Scene: React.FC<{ f: number }> = ({ f }) => {
  const { camera } = useThree();
  const mat = useMemo(() => contourMat(), []);
  const knot = useMemo(() => new THREE.TorusKnotGeometry(0.9, 0.32, 400, 64, 2, 3), []);
  const sph = useMemo(() => new THREE.SphereGeometry(0.55, 128, 96), []);
  useLayoutEffect(() => {
    const a = f / 90;
    camera.position.set(Math.sin(a) * 4.2, 0.6, Math.cos(a) * 4.2);
    camera.lookAt(0, 0, 0);
    (camera as THREE.PerspectiveCamera).fov = 40;
    camera.updateProjectionMatrix();
  });
  return (
    <>
      <mesh geometry={knot} material={mat} position={[0, 0.5, 0]} />
      <mesh geometry={sph} material={mat} position={[0.4, -1.6, 0.6]} />
    </>
  );
};

export const ContourTest: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <ThreeCanvas width={1080} height={1920} gl={{ antialias: true }}>
        <Scene f={f} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
