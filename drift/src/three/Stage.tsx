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
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { FMT } from "../theme";

export type Cam = { pos: [number, number, number]; look: [number, number, number]; fov?: number; roll?: number; up?: [number, number, number]; near?: number; far?: number };
export type Look = {
  exposure?: number;
  env?: number; // studio reflections strength
  bloom?: { strength: number; radius: number; threshold: number };
  dof?: { focus: number; aperture: number; maxblur: number };
  fog?: { color: string; near: number; far: number };
  /** Exponential-squared atmosphere (overrides fog). */
  fogExp?: { color: string; density: number };
  /** Lens finish after tone mapping: radial chromatic aberration (edges), film grain, vignette. */
  lens?: { ca: number; grain: number; vignette: number; time: number };
  bg?: string;
};

/** Lens finish: chromatic aberration that grows toward the frame edge, fine animated grain, a soft vignette. */
const LensShader = {
  uniforms: { tDiffuse: { value: null }, uCA: { value: 0 }, uGrain: { value: 0 }, uVig: { value: 0 }, uTime: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uCA, uGrain, uVig, uTime; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
    void main(){
      vec2 d = vUv - 0.5; float r2 = dot(d, d);
      vec2 off = d * uCA * r2 * 4.0;
      vec3 c = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
      c *= 1.0 - uVig * smoothstep(0.08, 0.55, r2);
      float g = h(vUv * 1931.0 + fract(uTime * 7.31) * 97.0) - 0.5;
      float lum = dot(c, vec3(0.299,0.587,0.114));
      c += g * uGrain * (0.35 + 0.65 * (1.0 - lum));
      gl_FragColor = vec4(c, 1.0);
    }`,
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
    let bokeh: BokehPass | null = null, bloom: UnrealBloomPass | null = null, lens: ShaderPass | null = null;
    if (look.bloom) c.addPass((bloom = new UnrealBloomPass(new THREE.Vector2(size.width, size.height), look.bloom.strength, look.bloom.radius, look.bloom.threshold)));
    // depth of field after bloom, so glows go soft with the surface they come from
    if (look.dof) c.addPass((bokeh = new BokehPass(scene, camera, { focus: look.dof.focus, aperture: look.dof.aperture, maxblur: look.dof.maxblur })));
    c.addPass(new OutputPass());
    if (look.lens) c.addPass((lens = new ShaderPass(LensShader)));
    return { c, bokeh, bloom, lens };
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
    scene.fog = look.fogExp ? new THREE.FogExp2(look.fogExp.color, look.fogExp.density) : look.fog ? new THREE.Fog(look.fog.color, look.fog.near, look.fog.far) : null;
    if (composer.bokeh && look.dof) { const u = composer.bokeh.uniforms as Record<string, THREE.IUniform>; u.focus.value = look.dof.focus; u.aperture.value = look.dof.aperture; u.maxblur.value = look.dof.maxblur; }
    if (composer.bloom && look.bloom) { composer.bloom.strength = look.bloom.strength; composer.bloom.radius = look.bloom.radius; composer.bloom.threshold = look.bloom.threshold; }
    if (composer.lens && look.lens) { const u = composer.lens.uniforms; u.uCA.value = look.lens.ca; u.uGrain.value = look.lens.grain; u.uVig.value = look.lens.vignette; u.uTime.value = look.lens.time; }
    const pc = camera as THREE.PerspectiveCamera;
    pc.fov = cam.fov ?? 35;
    pc.near = cam.near ?? 0.05;
    pc.far = cam.far ?? 400;
    pc.position.set(...cam.pos);
    if (cam.up) pc.up.set(...cam.up);
    else pc.up.set(Math.sin(cam.roll ?? 0), Math.cos(cam.roll ?? 0), 0);
    pc.lookAt(...cam.look);
    pc.updateProjectionMatrix();
  });
  useFrame(() => {
    composer.c.render();
  }, 1);
  return null;
};

export const Stage: React.FC<{ cam: Cam; look?: Look; children: React.ReactNode }> = ({ cam, look = {}, children }) => (
  <ThreeCanvas width={FMT.W} height={FMT.H} gl={{ antialias: true, preserveDrawingBuffer: true }} shadows>
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
