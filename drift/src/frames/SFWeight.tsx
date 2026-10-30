import React, { useMemo } from "react";
import * as THREE from "three";
import { useAssets } from "../three/assets";
import { Stage } from "../three/Stage";
import { stoneMat } from "../three/materials";
import { LINES, heroOf, kickEnv } from "../data";
import { clamp01, cubicOut, mix } from "../utils/ease";
import { rng, noise1 } from "../utils/random";
import { Glow } from "../words/points";
import { Caption, Finish, Full, Letters } from "./kit";
import { capHeight } from "../words/glyphs";

/** HEAVY: stone letters fall with gravity, land on the kick, the room jolts, dust and chips fly. */
const LI = 12;
const G = 22; // gravity, m/s²

const Dust: React.FC<{ t: number; t0: number }> = ({ t, t0 }) => {
  const geo = useMemo(() => {
    const r = rng(7);
    const n = 700;
    const pos = new Float32Array(n * 3), seed = new Float32Array(n), bright = new Float32Array(n), vel = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, sp = 0.4 + r() * 2.6;
      vel[i * 3] = Math.cos(a) * sp * 1.6; vel[i * 3 + 1] = 0.2 + r() * 1.1; vel[i * 3 + 2] = Math.sin(a) * sp * 0.7;
      pos[i * 3] = (r() - 0.5) * 3.4; pos[i * 3 + 1] = 0.02; pos[i * 3 + 2] = (r() - 0.5) * 0.5;
      seed[i] = r(); bright[i] = 0.15 + Math.pow(r(), 3) * 0.6;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("seed", new THREE.BufferAttribute(seed, 1));
    g.setAttribute("bright", new THREE.BufferAttribute(bright, 1));
    g.userData = { base: pos.slice(), vel };
    return g;
  }, []);
  const dt = Math.max(0, t - t0);
  const p = geo.attributes.position as THREE.BufferAttribute;
  const { base, vel } = geo.userData as { base: Float32Array; vel: Float32Array };
  const drag = (1 - Math.exp(-dt * 2.2)) / 2.2; // air drag on the puff
  for (let i = 0; i < p.count; i++) {
    p.setXYZ(i, base[i * 3] + vel[i * 3] * drag, base[i * 3 + 1] + vel[i * 3 + 1] * drag * (1 - dt * 0.15), base[i * 3 + 2] + vel[i * 3 + 2] * drag);
  }
  p.needsUpdate = true;
  return <Glow geo={geo} size={38} gain={t < t0 ? 0 : 0.13 * Math.exp(-dt * 0.4)} color="#d8cfc2" twinkle={0} />;
};

/** Motes hanging in the light cone (always there; the room's air). */
const Motes: React.FC<{ t: number }> = ({ t }) => {
  const geo = useMemo(() => {
    const r = rng(11);
    const n = 900;
    const pos = new Float32Array(n * 3), seed = new Float32Array(n), bright = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const y = r() * 5.5;
      const rad = 0.3 + y * 0.32;
      pos[i * 3] = 0.3 + (r() - 0.5) * rad * 2; pos[i * 3 + 1] = y; pos[i * 3 + 2] = 0.4 + (r() - 0.5) * 2.2;
      seed[i] = r(); bright[i] = 0.05 + Math.pow(r(), 4) * 0.5;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("seed", new THREE.BufferAttribute(seed, 1));
    g.setAttribute("bright", new THREE.BufferAttribute(bright, 1));
    return g;
  }, []);
  return <Glow geo={geo} size={4} gain={0.8} time={t} color="#f2ebdf" twinkle={0.5} position={[noise1(t * 0.2, 1) * 0.05, -((t * 0.03) % 0.4), 0]} />;
};

/** A cone of light from the ceiling lamp (volumetric look: additive, soft edges, fades down). */
const Beam: React.FC<{ o: number }> = ({ o }) => {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
        uniforms: { uO: { value: 1 } },
        vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv=uv; vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`,
        fragmentShader: `uniform float uO; varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ float edge=pow(abs(dot(vN,vV)),2.2); float down=smoothstep(0.0,0.25,vUv.y)*mix(0.35,1.0,vUv.y); gl_FragColor=vec4(vec3(1.0,0.96,0.9)*edge*down*0.075*uO,1.0); }`,
      }),
    [],
  );
  mat.uniforms.uO.value = o;
  return (
    <mesh position={[0.3, 2.9, 0.4]} material={mat}>
      <coneGeometry args={[2.1, 5.8, 64, 1, true]} />
    </mesh>
  );
};

export const SFWeight: React.FC<{ t: number }> = ({ t }) => {
  const a = useAssets();
  const w = heroOf(LI);
  const land = w.s + 0.12; // impact on the kick under 'weight'
  const mats = useMemo(() => (a ? { stone: stoneMat(a, "#c4b6a2", 1.6, 0.7), floor: stoneMat(a, "#6d6862", 0.5, 1.5), wall: stoneMat(a, "#5f5a54", 0.4, 1.5) } : null), [a]);
  if (!a || !mats) return <Full>{null}</Full>;
  const size = 0.68, rest = capHeight(a.bebas, size) / 2 + 0.002;
  // per-letter fall: staggered by 25 ms, small spin that settles
  const xf = (i: number, x: number) => {
    const tl = land + (i - 2.5) * 0.025;
    const fallT = Math.sqrt((2 * 7) / G);
    const u = t - (tl - fallT);
    let y = rest + 7;
    let rz = (rng(i + 3)() - 0.5) * 0.4, rx = 0.25;
    if (u > 0) {
      if (t < tl) {
        y = rest + 7 - 0.5 * G * u * u;
        const k = u / fallT; rz *= 1 - k * 0.8; rx *= 1 - k;
      } else {
        const d = t - tl; // bounce: 6% of the fall height, damped
        y = rest + Math.abs(Math.sin(d * 18)) * 0.07 * Math.exp(-d * 9);
        rz *= 0.2 * Math.exp(-d * 6) * Math.cos(d * 25); rx = 0;
      }
    }
    return { p: [x, y, 0] as [number, number, number], r: [rx, 0, rz] as [number, number, number] };
  };
  const hit = Math.max(0, t - land);
  const shake = t > land ? Math.exp(-hit * 7) * 0.09 : 0;
  const cam: [number, number, number] = [0.1 + noise1(t * 30, 2) * shake - shake / 2, 1.15 - shake * 0.8 * Math.cos(hit * 30), 5.7];
  return (
    <Full>
      <Stage cam={{ pos: cam, look: [0, 0.75, 0], fov: 36 }} look={{ exposure: 1.05, env: 0.12, bloom: { strength: 0.35, radius: 0.6, threshold: 0.85 }, bg: "#040404", dof: { focus: 5.8, aperture: 0.0018, maxblur: 0.006 } }}>
        <spotLight position={[0.3, 6.2, 1.6]} target-position={[0, 0, 0]} angle={0.42} penumbra={0.75} intensity={420 * (1 + kickEnv(t) * 0.05)} decay={2} color="#fff1df" castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} />
        <pointLight position={[-3, 2.2, -2]} intensity={6} color="#8fa0b0" decay={2} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={mats.floor}><planeGeometry args={[30, 30]} /></mesh>
        <mesh position={[0, 6, -3.2]} receiveShadow material={mats.wall}><planeGeometry args={[30, 14]} /></mesh>
        <Letters font={a.bebas} family="bebas" text="WEIGHT" size={size} depth={0.5} material={mats.stone} tracking={0.03} bevel={0.025} xf={xf} />
        <Beam o={1} />
        <Motes t={t} />
        <Dust t={t} t0={land} />
      </Stage>
      <Caption line={LINES[LI]} t={t} hero="weight" />
      <Finish />
    </Full>
  );
};
