import React, { useMemo } from "react";
import * as THREE from "three";
import { useAssets } from "../three/assets";
import { Stage } from "../three/Stage";
import { LINES, heroOf, sungAmount, vol } from "../data";
import { rng, noise1 } from "../utils/random";
import { Glow, useStarfield } from "../words/points";
import { layout, wordPoints } from "../words/glyphs";
import { Caption, Finish, Full, Letters, DRIFT } from "./kit";

/**
 * DRIFT: the letters unhook from the baseline and float apart with no gravity. The distance is
 * the sung amount of the held note (voice-integrated), so it lasts exactly as long as the note.
 * The last letters start coming apart into stars.
 */
const LI = 34;
export const SFDrift: React.FC<{ t: number }> = ({ t }) => {
  const a = useAssets();
  const w = heroOf(LI);
  const stars = useStarfield(6500, 61, [40, 70, 60], [0, 0, -28]);
  const amt = sungAmount(w, t);
  const size = 1.25;
  const dirs = useMemo(() => {
    const r = rng(77);
    return Array.from({ length: 5 }, (_, i) => ({ d: [(r() - 0.5) * 0.6 + (i - 2) * 0.32, 0.35 + r() * 0.9 + i * 0.12, (r() - 0.5) * 1.6], rot: [(r() - 0.5) * 1.2, (r() - 0.5) * 1.6, (r() - 0.5) * 1.4 + (i - 2) * 0.15] }));
  }, []);
  const mats = useMemo(() => Array.from({ length: 5 }, () => new THREE.MeshPhysicalMaterial({ color: DRIFT, roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.25, transparent: true })), []);
  const dust = useMemo(() => {
    if (!a) return null;
    const lay = layout(a.bebas, "DRIFT", size, 0.04);
    return [3, 4].map((li) => {
      const p = wordPoints(a.bebas, lay.letters[li].ch, size, 2600, 0.55, 20 + li);
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(p.pos, 3));
      g.setAttribute("seed", new THREE.BufferAttribute(p.seeds, 1));
      const br = new Float32Array(p.seeds.length).map((_, i) => 0.3 + Math.pow(p.seeds[(i * 13) % p.seeds.length], 4) * 1.4);
      g.setAttribute("bright", new THREE.BufferAttribute(br, 1));
      g.userData = { base: p.pos.slice(), x: lay.letters[li].x };
      return g;
    });
  }, [a]);
  if (!a || !dust) return <Full>{null}</Full>;
  const k = amt * 1.15;
  const place = (i: number, x: number) => {
    const d = dirs[i], f = k * (0.35 + i * 0.22);
    const bob = noise1(t * 0.35 + i * 7, i) - 0.5;
    return {
      p: [x * (1 + k * 0.25) + d.d[0] * f, d.d[1] * f + bob * 0.08 * k, d.d[2] * f] as [number, number, number],
      r: [d.rot[0] * f, d.rot[1] * f, d.rot[2] * f] as [number, number, number],
    };
  };
  // F and T start dissolving: mesh fades as its point cloud blooms out
  const diss = [0, 0, 0, Math.max(0, k - 0.55) * 0.9, Math.max(0, k - 0.35) * 1.1].map((v) => Math.min(1, v));
  mats.forEach((m, i) => (m.opacity = 1 - diss[i] * 0.85));
  dust.forEach((g, j) => {
    const li = 3 + j, P = place(li, g.userData.x as number), base = g.userData.base as Float32Array, pos = g.attributes.position as THREE.BufferAttribute;
    const e = new THREE.Euler(...P.r), q = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      q.set(base[i * 3] - (g.userData.x as number), base[i * 3 + 1], base[i * 3 + 2]).applyEuler(e);
      const s = (i * 0.7548) % 1, spread = diss[li] * (0.2 + s * 1.6);
      pos.setXYZ(i, q.x + P.p[0] + (s - 0.5) * spread, q.y + P.p[1] + ((i * 0.5698) % 1) * spread * 0.8, q.z + P.p[2] + (((i * 0.3141) % 1) - 0.5) * spread);
    }
    pos.needsUpdate = true;
  });
  return (
    <Full>
      <Stage cam={{ pos: [-0.2, 0.9, 9.8], look: [-0.25, 0.85, 0], fov: 38 }} look={{ exposure: 0.9, env: 0.25, bloom: { strength: 0.4, radius: 0.5, threshold: 0.85 }, bg: "#030405", dof: { focus: 9.0, aperture: 0.0025, maxblur: 0.008 } }}>
        <directionalLight position={[-3, 4, 5]} intensity={0.9} color="#eef2f6" />
        <directionalLight position={[3, 1, -4]} intensity={1.6} color="#bccbd8" />
        <Glow geo={stars} size={5} gain={0.65} time={t} twinkle={0.45} />
        <Letters font={a.bebas} family="bebas" text="DRIFT" size={size} depth={0.32} material={(i) => mats[i]} tracking={0.04} bevel={0.03} shadows={false} xf={place} />
        {dust.map((g, j) => <Glow key={j} geo={g} size={1.3} gain={(0.1 + diss[3 + j] * 0.5) * (0.8 + vol(w, t))} time={t} color="#e6edf3" twinkle={0.4} />)}
      </Stage>
      <Caption line={LINES[LI - 1]} t={t} top={250} size={30} o={0.45} />
      <Caption line={LINES[LI]} t={t} hero="drift" top={300} />
      <Finish grain={0.08} />
    </Full>
  );
};
