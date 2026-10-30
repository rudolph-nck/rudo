import React, { useMemo } from "react";
import * as THREE from "three";
import { useAssets } from "../three/assets";
import { Stage } from "../three/Stage";
import { stoneMat } from "../three/materials";
import { LINES, heroOf } from "../data";
import { clamp01, cubicOut, mix } from "../utils/ease";
import { capHeight, layout } from "../words/glyphs";
import { Caption, Finish, Full, Letters } from "./kit";

/** HEAVY (shouldered): at dawn, KEEP stands up under the verse-1 stone block and lifts it. */
const LI = 91;
const Sky: React.FC = () => {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `varying vec3 vP; void main(){ float y = vP.y; vec3 top = vec3(0.020,0.022,0.026); vec3 mid = vec3(0.10,0.095,0.09); vec3 hor = vec3(0.62,0.55,0.46);
      vec3 c = mix(hor, mid, smoothstep(-0.01, 0.10, y)); c = mix(c, top, smoothstep(0.08, 0.5, y));
      float sun = exp(-pow(length(vec2(vP.x*1.0 + 0.12, (y + 0.004)*5.0)) * 9.0, 1.4)) * 1.6; c += vec3(1.0,0.93,0.82) * sun;
      gl_FragColor = vec4(c, 1.0); }`,
  }), []);
  return <mesh material={mat}><sphereGeometry args={[150, 64, 32]} /></mesh>;
};

export const SFKeep: React.FC<{ t: number }> = ({ t }) => {
  const a = useAssets();
  const keepW = LINES[LI].words.find((x) => x.w.toLowerCase() === "keep")!;
  const w = heroOf(LI);
  const m = useMemo(() => (a ? { stone: stoneMat(a, "#c4b6a2", 1.5, 0.7), ground: stoneMat(a, "#4a4642", 0.25, 1.4), block: stoneMat(a, "#a9a197", 1.1, 0.9), weight: stoneMat(a, "#d8ccbb", 1.5, 0.5) } : null), [a]);
  if (!a || !m) return <Full>{null}</Full>;
  const size = 1.25, cap = capHeight(a.bebas, size);
  const kw = layout(a.bebas, "KEEP", size, 0.04).width;
  const lift = cubicOut(clamp01((t - keepW.s) / Math.max(0.6, w.s - keepW.s + 0.4)));
  const sy = mix(0.82, 1, lift);
  const bh = 0.62, bw = kw + 0.3;
  const top = cap * sy;
  return (
    <Full>
      <Stage cam={{ pos: [-1.4, 0.75, 9.8], look: [0, 1.85, 0], fov: 36 }} look={{ exposure: 1.0, env: 0.15, bloom: { strength: 0.5, radius: 0.7, threshold: 0.8 }, fog: { color: "#3a3631", near: 12, far: 80 } }}>
        <Sky />
        <directionalLight position={[3, 3.2, -14]} intensity={4} color="#ffe6c8" castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-6} shadow-camera-right={6} shadow-camera-top={6} shadow-camera-bottom={-6} shadow-bias={-0.0005} />
        <directionalLight position={[-4, 3, 8]} intensity={0.55} color="#9fb0c0" />
        <mesh rotation={[-Math.PI / 2, 0, 0]} material={m.ground} receiveShadow><planeGeometry args={[300, 300]} /></mesh>
        <group position={[0, top / 2, 0]} scale={[1, sy, 1]}>
          <Letters font={a.bebas} family="bebas" text="KEEP" size={size} depth={0.6} material={m.stone} tracking={0.04} bevel={0.025} />
        </group>
        <group position={[0, top + bh / 2 + 0.005, 0]} rotation={[0, 0, mix(0.05, 0.0, lift)]}>
          <mesh material={m.block} castShadow receiveShadow><boxGeometry args={[bw, bh, 0.9]} /></mesh>
          <Letters font={a.bebas} family="bebas" text="WEIGHT" size={0.44} depth={0.06} material={m.weight} tracking={0.08} bevel={0.02} position={[0, 0, 0.46]} />
        </group>
      </Stage>
      <Caption line={LINES[LI]} t={t} hero="weight" />
      <Finish grain={0.09} vignette={0.55} />
    </Full>
  );
};
