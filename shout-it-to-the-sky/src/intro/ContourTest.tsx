import React, { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, staticFile, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { contourMat } from "../three/contour";

/** RUDO's mesh (Higgsfield image-to-3D), normalised: feet on y=0, ~1.35 m tall, facing +z. */
export const useRudoMesh = () => {
  const [geo, setGeo] = useState<THREE.BufferGeometry | null>(null);
  const [h] = useState(() => delayRender("rudo.glb"));
  useEffect(() => {
    new GLTFLoader().load(staticFile("models/rudo.glb"), (g) => {
      const geos: THREE.BufferGeometry[] = [];
      g.scene.updateMatrixWorld(true);
      g.scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) geos.push(m.geometry.clone().applyMatrix4(m.matrixWorld));
      });
      const geo0 = geos[0];
      geo0.computeBoundingBox();
      const b = geo0.boundingBox!;
      const s = 1.35 / (b.max.y - b.min.y);
      geo0.translate(-(b.max.x + b.min.x) / 2, -b.min.y, -(b.max.z + b.min.z) / 2);
      geo0.scale(s, s, s);
      geo0.computeVertexNormals();
      console.warn("RUDOMESH", geos.length, geo0.attributes.position.count, JSON.stringify(b));
      setGeo(geo0);
      continueRender(h);
    });
  }, [h]);
  return geo;
};

const Scene: React.FC<{ f: number; geo: THREE.BufferGeometry }> = ({ f, geo }) => {
  const { camera } = useThree();
  const mat = useMemo(() => contourMat(), []);
  useLayoutEffect(() => {
    const a = (f / 300) * Math.PI * 2;
    camera.position.set(Math.sin(a) * 3.2, 1.0, Math.cos(a) * 3.2);
    camera.lookAt(0, 0.62, 0);
    (camera as THREE.PerspectiveCamera).fov = 34;
    camera.updateProjectionMatrix();
  });
  return <mesh geometry={geo} material={mat} />;
};

export const ContourTest: React.FC = () => {
  const f = useCurrentFrame();
  const geo = useRudoMesh();
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {geo ? (
        <ThreeCanvas width={1080} height={1920} gl={{ antialias: true }}>
          <Scene f={f} geo={geo} />
        </ThreeCanvas>
      ) : null}
    </AbsoluteFill>
  );
};
