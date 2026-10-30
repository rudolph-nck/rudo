import React, { useLayoutEffect, useMemo } from "react";
import { ThreeCanvas } from "@remotion/three";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { BokehPass } from "three/examples/jsm/postprocessing/BokehPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { W, H } from "../theme";

export type Cam = { pos: [number, number, number]; look: [number, number, number]; fov?: number; roll?: number; up?: [number, number, number] };
export type Look = {
  exposure?: number;
  env?: number; // studio reflections strength
  bloom?: { strength: number; radius: number; threshold: number };
  dof?: { focus: number; aperture: number; maxblur: number };
  fog?: { color: string; near: number; far: number };
  bg?: string;
};

/** Camera, tone mapping, studio reflections and the post chain (bloom, depth of field). */
const Rig: React.FC<{ cam: Cam; look: Look }> = ({ cam, look }) => {
  const { gl, scene, camera, size } = useThree();
  const envTex = useMemo(() => {
    const pm = new THREE.PMREMGenerator(gl);
    const t = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
    return t;
  }, [gl]);
  const composer = useMemo(() => {
    const rt = new THREE.WebGLRenderTarget(size.width, size.height, { samples: 4, type: THREE.HalfFloatType });
    const c = new EffectComposer(gl, rt);
    c.setPixelRatio(1);
    c.setSize(size.width, size.height);
    c.addPass(new RenderPass(scene, camera));
    if (look.dof) c.addPass(new BokehPass(scene, camera, { focus: look.dof.focus, aperture: look.dof.aperture, maxblur: look.dof.maxblur }));
    if (look.bloom) c.addPass(new UnrealBloomPass(new THREE.Vector2(size.width, size.height), look.bloom.strength, look.bloom.radius, look.bloom.threshold));
    c.addPass(new OutputPass());
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, camera, size.width, size.height]);

  useLayoutEffect(() => {
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = look.exposure ?? 1;
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = THREE.PCFSoftShadowMap;
    gl.localClippingEnabled = true;
    scene.environment = envTex;
    scene.environmentIntensity = look.env ?? 0.35;
    scene.background = new THREE.Color(look.bg ?? "#050505");
    scene.fog = look.fog ? new THREE.Fog(look.fog.color, look.fog.near, look.fog.far) : null;
    const pc = camera as THREE.PerspectiveCamera;
    pc.fov = cam.fov ?? 35;
    pc.near = 0.05;
    pc.far = 400;
    pc.position.set(...cam.pos);
    if (cam.up) pc.up.set(...cam.up);
    else pc.up.set(Math.sin(cam.roll ?? 0), Math.cos(cam.roll ?? 0), 0);
    pc.lookAt(...cam.look);
    pc.updateProjectionMatrix();
  });
  useFrame(() => {
    composer.render();
  }, 1);
  return null;
};

export const Stage: React.FC<{ cam: Cam; look?: Look; children: React.ReactNode }> = ({ cam, look = {}, children }) => (
  <ThreeCanvas width={W} height={H} gl={{ antialias: true, preserveDrawingBuffer: true }} shadows>
    <Rig cam={cam} look={look} />
    {children}
  </ThreeCanvas>
);

/** Give one material the studio reflections at its own strength (scene env stays low for the room). */
export const EnvOn: React.FC<{ mat: THREE.MeshStandardMaterial; k: number }> = ({ mat, k }) => {
  const { scene } = useThree();
  useLayoutEffect(() => {
    mat.envMap = scene.environment;
    mat.envMapIntensity = k;
    mat.needsUpdate = true;
  });
  return null;
};
