import React, { useMemo } from "react";
import * as THREE from "three";
import { useAssets } from "../three/assets";
import { Stage } from "../three/Stage";
import { matteMat } from "../three/materials";
import { LINES, heroOf, sungAmount, vol } from "../data";
import { noise1 } from "../utils/random";
import { Glow, useStarfield } from "../words/points";
import { wordPoints } from "../words/glyphs";
import { Finish, Full, Letters, DRIFT } from "./kit";

/** NEON / stars: STARS is thousands of points that ignite as he sings it; FLOAT drifts past in the foreground. */
const LI = 26;
export const SFStars: React.FC<{ t: number }> = ({ t }) => {
  const a = useAssets();
  const w = heroOf(LI);
  const stars = useStarfield(7000, 41, [40, 70, 60], [0, 0, -28]);
  const pts = useMemo(() => {
    if (!a) return null;
    const p = wordPoints(a.bebas, "STARS", 0.95, 16000, 0.5, 9, 0.06);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(p.pos, 3));
    // ignite left to right with jitter: seed follows x
    const seeds = new Float32Array(p.seeds.length);
    for (let i = 0; i < seeds.length; i++) seeds[i] = Math.min(0.999, Math.max(0, (p.pos[i * 3] + 1.7) / 3.4 * 0.75 + p.seeds[i] * 0.25));
    g.setAttribute("seed", new THREE.BufferAttribute(seeds, 1));
    const br = new Float32Array(p.seeds.length);
    for (let i = 0; i < br.length; i++) br[i] = 0.25 + Math.pow(p.seeds[(i * 7) % br.length], 5) * 1.6;
    g.setAttribute("bright", new THREE.BufferAttribute(br, 1));
    return g;
  }, [a]);
  const small = useMemo(() => {
    if (!a) return null;
    return (["SOMEWHERE", "BETWEEN", "THE"] as const).map((txt, k) => {
      const p = wordPoints(a.bebas, txt, [0.36, 0.3, 0.24][k], 4200, 0.55, 30 + k, 0.08);
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(p.pos, 3));
      g.setAttribute("seed", new THREE.BufferAttribute(p.seeds, 1));
      g.setAttribute("bright", new THREE.BufferAttribute(new Float32Array(p.seeds.length).map((_, i) => 0.25 + Math.pow(p.seeds[(i * 11) % p.seeds.length], 6) * 1.2), 1));
      return g;
    });
  }, [a]);
  const drift = useMemo(() => matteMat(DRIFT, 0.5), []);
  if (!a || !pts || !small) return <Full>{null}</Full>;
  const ign = Math.min(1, 0.15 + sungAmount(w, t) * 1.0);
  const sway = noise1(t * 0.25, 3) - 0.5;
  return (
    <Full>
      <Stage cam={{ pos: [sway * 0.3, 0.2, 6.2], look: [0, 0.3, 0], fov: 38, roll: sway * 0.03 }}
        look={{ exposure: 1, env: 0.3, bloom: { strength: 0.75, radius: 0.55, threshold: 0.6 }, bg: "#020203", dof: { focus: 6.2, aperture: 0.03, maxblur: 0.014 } }}>
        <directionalLight position={[2, 4, 5]} intensity={1.2} color="#e8eef4" />
        <Glow geo={stars} size={5} gain={0.7} time={t} twinkle={0.45} />
        <Glow geo={pts} size={1.5} ignite={ign} gain={0.3 + vol(w, t) * 0.2} time={t} twinkle={0.35} position={[0, 1.25, -1.6]} rotation={[0, sway * 0.2, 0]} scale={1.25} />
        {small.map((g, k) => {
          const wd = LINES[LI].words[1 + k];
          const on = Math.min(1, Math.max(0, (t - wd.s + 0.05) / 0.3));
          const P: [number, number, number][] = [[-0.25, -0.15, 0.9], [0.35, 0.3, -0.2], [0.85, 0.62, -0.9]];
          return <Glow key={k} geo={g} size={1.9} ignite={on} gain={0.55} time={t} twinkle={0.3} position={P[k]} rotation={[0, -0.15 + k * 0.12, (k - 1) * 0.05]} />;
        })}
        <Letters font={a.bebas} family="bebas" text="FLOAT" size={0.36} depth={0.2} material={drift} tracking={0.05} shadows={false}
          position={[-0.15, -0.72, 2.7]} rotation={[0.12, 0.3, 0.08]}
          xf={(i, x) => ({ p: [x + i * 0.02, Math.sin(t * 0.6 + i) * 0.04 + i * 0.03, i * 0.05], r: [0, 0, (i - 2) * 0.05 + Math.sin(t * 0.4 + i) * 0.04] })} />
      </Stage>
      <Finish grain={0.08} />
    </Full>
  );
};
