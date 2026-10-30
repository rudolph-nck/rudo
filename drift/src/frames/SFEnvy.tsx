import React, { useMemo } from "react";
import * as THREE from "three";
import { useAssets } from "../three/assets";
import { EnvOn, Stage } from "../three/Stage";
import { glassMat, lightMat, stoneMat } from "../three/materials";
import { LINES, heroOf } from "../data";
import { noise1 } from "../utils/random";
import { capHeight } from "../words/glyphs";
import { Caption, Finish, Full, Letters } from "./kit";

const softbox = () =>
  new THREE.ShaderMaterial({
    toneMapped: false,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `varying vec2 vUv; void main(){ vec2 d = abs(vUv - 0.5) * 2.0; float a = (1.0 - smoothstep(0.55, 1.0, d.x)) * (1.0 - smoothstep(0.4, 1.0, d.y)); vec3 c = mix(vec3(0.55,0.53,0.50), vec3(1.0,0.97,0.92), vUv.y); gl_FragColor = vec4(c * a * 0.6, 1.0); }`,
  });

/** GLASS: ENVY as thick clear glass on a plinth; light strips and plaques on the wall refract through it. */
const LI = 14;
export const SFEnvy: React.FC<{ t: number }> = ({ t }) => {
  const a = useAssets();
  const w = heroOf(LI);
  const m = useMemo(() => (a ? { glass: glassMat(), wall: stoneMat(a, "#141312", 0.5, 1.4), plinth: stoneMat(a, "#3a3733", 1.2, 0.6), plaque: stoneMat(a, "#c4b6a2", 1.5, 0.5), strip: lightMat("#fff4e6", 1.1), stripDim: lightMat("#fff4e6", 0.8), panel: softbox() } : null), [a]);
  if (!a || !m) return <Full>{null}</Full>;
  m.wall.envMapIntensity = 0.06; m.plinth.envMapIntensity = 0.12;
  const size = 0.88, cap = capHeight(a.bebas, size);
  const appear = Math.min(1, Math.max(0, (t - w.s) / 0.35));
  const turn = -0.42 + (t - w.s) * 0.06;
  return (
    <Full>
      <Stage cam={{ pos: [0.7 + noise1(t * 0.3, 4) * 0.05, 1.7, 6.4], look: [0, 1.25, 0], fov: 36 }}
        look={{ exposure: 0.95, env: 0.08, bloom: { strength: 0.3, radius: 0.5, threshold: 0.95 }, bg: "#050505", dof: { focus: 6.4, aperture: 0.0025, maxblur: 0.008 } }}>
        <spotLight position={[0.3, 6, 2.2]} angle={0.2} penumbra={0.6} intensity={140} decay={2} color="#fff3e4" castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} />
        <pointLight position={[-2.5, 2.4, 1.5]} intensity={8} decay={2} color="#c9d4dc" />
        <mesh position={[0, 4, -2.6]} material={m.wall} receiveShadow><planeGeometry args={[20, 12]} /></mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} material={m.wall} receiveShadow><planeGeometry args={[20, 20]} /></mesh>
        <EnvOn mat={m.glass} k={1.4} />
        <mesh position={[0, 1.42, -1.5]} material={m.panel}><planeGeometry args={[4.6, 1.15]} /></mesh>
        {[-2.6, 2.6].map((x, i) => (
          <mesh key={i} position={[x, 2.0, -1.45]} material={m.stripDim}><boxGeometry args={[0.05, 3.2, 0.04]} /></mesh>
        ))}
        <mesh position={[0, 0.45, 0]} material={m.plinth} castShadow receiveShadow><boxGeometry args={[3.4, 0.9, 1.3]} /></mesh>
        <group position={[0, 0.9 + cap / 2 + 0.003, 0]} rotation={[0, turn, 0]} scale={0.94 + 0.06 * appear}>
          <Letters font={a.bebas} family="bebas" text="ENVY" size={size} depth={0.55} material={m.glass} tracking={0.04} bevel={0.035} />
        </group>
      </Stage>
      <Caption line={LINES[LI]} t={t} hero="envy" />
      <Finish />
    </Full>
  );
};
