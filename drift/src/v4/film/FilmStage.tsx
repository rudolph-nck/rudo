import React, { useLayoutEffect, useMemo } from "react";
import { ThreeCanvas } from "@remotion/three";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import {
  BlendFunction, BloomEffect, ChromaticAberrationEffect, DepthOfFieldEffect, EffectComposer, EffectPass, NoiseEffect, RenderPass,
  ToneMappingEffect, ToneMappingMode, VignetteEffect,
} from "postprocessing";
import { FMT } from "../../theme";
import { FilmLook } from "./looks";

export type FilmCam = { pos: THREE.Vector3; look: THREE.Vector3; fov: number; roll?: number; near?: number; far?: number };

/** Puts the camera where the shot wants it, and the renderer into a film-like state (physically lit, sharp shadows). */
const CameraRig: React.FC<{ cam: FilmCam; look: FilmLook }> = ({ cam, look }) => {
  const { gl, scene, camera } = useThree();
  const env = useMemo(() => { const pm = new THREE.PMREMGenerator(gl); const t = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose(); return t; }, [gl]);
  useLayoutEffect(() => {
    gl.toneMappingExposure = look.exposure; // tone mapping itself runs in the composer (ACES)
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = THREE.PCFShadowMap;
    scene.environment = env;
    scene.environmentIntensity = look.env;
    const pc = camera as THREE.PerspectiveCamera;
    pc.fov = cam.fov; pc.near = cam.near ?? 0.05; pc.far = cam.far ?? 400;
    pc.position.copy(cam.pos);
    const r = cam.roll ?? 0; pc.up.set(Math.sin(r), Math.cos(r), 0);
    pc.lookAt(cam.look);
    pc.updateProjectionMatrix();
  });
  return null;
};

/**
 * The film post chain (pmndrs `postprocessing`, the engine behind @react-three/postprocessing):
 *   depth of field → mipmap bloom (threshold 0.15, smoothing 0.7) → ACES tone mapping → chromatic aberration →
 *   film grain (noise, overlay) + vignette (offset 0.15, darkness 1.3).
 * Built synchronously in one memo (not via the declarative <EffectComposer>), because Remotion screenshots each frame
 * headlessly on the first render; the declarative wrapper assembles its passes a render later, which captures black.
 */
const FilmPost: React.FC<{ look: FilmLook; focus: number }> = ({ look, focus }) => {
  const { gl, scene, camera, size } = useThree();
  const P = useMemo(() => {
    const composer = new EffectComposer(gl, { frameBufferType: THREE.HalfFloatType, multisampling: 4 });
    composer.addPass(new RenderPass(scene, camera));
    const dof = new DepthOfFieldEffect(camera, { worldFocusDistance: focus, worldFocusRange: 1, bokehScale: look.bokeh });
    const bloom = new BloomEffect({ mipmapBlur: true, intensity: look.bloom.intensity, luminanceThreshold: look.bloom.threshold, luminanceSmoothing: look.bloom.smoothing });
    const tone = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });
    const ca = new ChromaticAberrationEffect({ offset: new THREE.Vector2(look.ca, look.ca), radialModulation: true, modulationOffset: 0.25 });
    const noise = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: false });
    const vig = new VignetteEffect({ eskil: false, offset: look.vignette.offset, darkness: look.vignette.darkness });
    composer.addPass(new EffectPass(camera, dof));
    composer.addPass(new EffectPass(camera, bloom, tone));
    composer.addPass(new EffectPass(camera, ca));
    composer.addPass(new EffectPass(camera, noise, vig));
    composer.setSize(size.width, size.height);
    return { composer, dof, bloom, ca, noise, vig };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, camera, size.width, size.height]);
  useLayoutEffect(() => {
    gl.toneMapping = THREE.NoToneMapping; // ACES runs in the chain, after bloom
    P.dof.cocMaterial.worldFocusDistance = focus;
    P.dof.cocMaterial.worldFocusRange = Math.max(0.25, focus * 0.35);
    P.dof.bokehScale = look.bokeh;
    P.bloom.intensity = look.bloom.intensity;
    P.bloom.luminanceMaterial.threshold = look.bloom.threshold;
    P.bloom.luminanceMaterial.smoothing = look.bloom.smoothing;
    P.ca.offset.set(look.ca, look.ca);
    P.noise.blendMode.opacity.value = look.grain;
    P.vig.offset = look.vignette.offset; P.vig.darkness = look.vignette.darkness;
  });
  useFrame((_, dt) => P.composer.render(dt), 1);
  return null;
};

/**
 * The scene wrapper for every Drift v2 shot: canvas → background + exponential fog from the look → near-zero
 * ambient → the shot's children → the film post chain.
 */
export const FilmStage: React.FC<{ cam: FilmCam; look: FilmLook; focus: number; children: React.ReactNode }> = ({ cam, look, focus, children }) => (
  <ThreeCanvas width={FMT.W} height={FMT.H} gl={{ antialias: false, preserveDrawingBuffer: true, powerPreference: "high-performance", stencil: false }} shadows>
    <CameraRig cam={cam} look={look} />
    <color attach="background" args={[look.bg]} />
    {look.fog.density > 0 ? <fogExp2 attach="fog" args={[look.fog.color, look.fog.density]} /> : null}
    <ambientLight intensity={look.ambient} />
    {children}
    <FilmPost look={look} focus={focus} />
  </ThreeCanvas>
);
