import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "@fontsource/inter/100.css";
import "@fontsource/inter/200.css";
import "@fontsource/inter/300.css";
import React, { useMemo } from "react";
import * as THREE from "three";
import { AbsoluteFill } from "remotion";
import { useAssets } from "../three/assets";
import { Stage } from "../three/Stage";
import { Grain, Vignette } from "../fx/Post";
import { Glow } from "../words/points";
import { FMT } from "../theme";
import { rng } from "../utils/random";

/** Static & Silence palette (sampled from the cover). */
export const P = {
  char: "#0d0c0b", wall: "#2b2622", concrete: "#433a30", stone: "#8e7d6e", paper: "#bdb3a4", bone: "#ece2d0", light: "#f2e3c8", dim: "#5f574e",
};
export const FF = {
  display: "'Bebas Neue', 'Oswald', sans-serif",
  mono: "'IBM Plex Mono', monospace",
  serif: "'Instrument Serif', Georgia, serif",
  hand: "'Caveat', cursive",
  thin: "'Inter', sans-serif",
};

/** The room from the cover: a concrete wall, a dark floor, one soft warm light from above, dust in the air. */
export const Room: React.FC<{ t: number; light?: number; cam?: [number, number, number]; look?: [number, number, number] }> = ({ t, light = 1, cam = [0, 1.4, 6.2], look = [0, 1.5, 0] }) => {
  const a = useAssets();
  const dust = useMemo(() => {
    const r = rng(7), n = 500, g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3).map((_, i) => (i % 3 === 0 ? (r() - 0.5) * 9 : i % 3 === 1 ? r() * 4.5 : -0.5 + r() * 5)), 3));
    g.setAttribute("seed", new THREE.BufferAttribute(new Float32Array(n).map(() => r()), 1));
    g.setAttribute("bright", new THREE.BufferAttribute(new Float32Array(n).map(() => 0.04 + Math.pow(r(), 6) * 0.5), 1));
    return g;
  }, []);
  const wallMat = useMemo(() => {
    if (!a) return null;
    const m = new THREE.MeshStandardMaterial({ color: "#9a8f83", roughness: 0.95, map: a.concrete, bumpMap: a.concreteBump, bumpScale: 0.6 });
    a.concrete.wrapS = a.concrete.wrapT = THREE.RepeatWrapping;
    return m;
  }, [a]);
  if (!a || !wallMat) return <AbsoluteFill style={{ background: P.char }} />;
  return (
    <Stage cam={{ pos: cam, look, fov: 34 }} look={{ exposure: 1.0, env: 0.08, bloom: { strength: 0.35, radius: 0.6, threshold: 0.9 }, bg: P.char, fog: { color: P.char, near: 6, far: 16 } }}>
      <ambientLight intensity={0.05} color="#d8cbb8" />
      <spotLight position={[0.3, 6.5, 3.2]} target-position={[0, 1.6, -0.4]} angle={0.5} penumbra={0.9} intensity={300 * light} decay={2} color="#f2dcc0" castShadow shadow-mapSize={[1024, 1024]} />
      <mesh position={[0, 3, -0.6]} material={wallMat} receiveShadow><planeGeometry args={[14, 8]} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 2]} receiveShadow><planeGeometry args={[14, 6]} /><meshStandardMaterial color="#151311" roughness={0.35} metalness={0.2} /></mesh>
      <Glow geo={dust} size={7} gain={0.8 * light} time={t} twinkle={0.3} color="#efe3cf" position={[Math.sin(t * 0.07) * 0.1, t * 0.01, 0]} />
    </Stage>
  );
};

/** Film finish over everything: grain and a soft vignette, like the cover. */
export const Finish3: React.FC = () => (
  <>
    <Vignette strength={0.75} />
    <Grain opacity={0.07} />
  </>
);

/** A floating object in 3D: CSS perspective, a soft shadow, optional depth blur. */
export const Float: React.FC<{ x: number; y: number; w: number; h?: number; rx?: number; ry?: number; rz?: number; z?: number; blur?: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ x, y, w, h, rx = 0, ry = 0, rz = 0, z = 0, blur = 0, children, style }) => (
  <div style={{ position: "absolute", left: x, top: y, width: w, height: h, transform: `perspective(1600px) translateZ(${z}px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)`, transformOrigin: "50% 50%", filter: `${blur ? `blur(${blur}px) ` : ""}drop-shadow(0 30px 40px rgba(0,0,0,0.55))`, ...style }}>
    {children}
  </div>
);

/** Small lyric line at the bottom: sung words in stone, the word being sung in bone. */
export const Lyric: React.FC<{ words: string[]; on: number }> = ({ words, on }) => (
  <div style={{ position: "absolute", left: 0, right: 0, bottom: FMT.H * 0.065, textAlign: "center", fontFamily: FF.display, fontSize: 40, letterSpacing: "0.14em" }}>
    {words.map((w, i) => (
      <span key={i} style={{ color: i === on ? P.bone : i < on ? P.stone : "transparent", marginRight: "0.4em", textShadow: i === on ? "0 0 18px rgba(242,227,200,0.25)" : "none" }}>{w}</span>
    ))}
  </div>
);
