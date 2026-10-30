import React, { useMemo } from "react";
import * as THREE from "three";
import { useAssets } from "../three/assets";
import { Stage } from "../three/Stage";
import { lightMat, stoneMat } from "../three/materials";
import { LINES, heroOf, sungAmount, vol } from "../data";
import { rng } from "../utils/random";
import { Glow, useStarfield } from "../words/points";
import { Finish, Full, Letters, solidify } from "./kit";

/** CRACK-OPEN: BREAK splits down a jagged crack; the gap widens with the voice; space is behind it. */
const LI = 23;
const TILT = 0.1;
const crackPts = (() => {
  const r = rng(5);
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 22; i++) {
    const y = 1.45 - (i / 22) * 2.2;
    pts.push(new THREE.Vector3(Math.sin(TILT) * y * -1 + (r() - 0.5) * 0.09, y, 0.3));
  }
  return pts;
})();

export const SFBreak: React.FC<{ t: number }> = ({ t }) => {
  const a = useAssets();
  const w = heroOf(LI);
  const amt = sungAmount(w, t);
  const gap = 0.04 + amt * 0.75 + vol(w, t) * 0.08;
  const stars = useStarfield(5000, 31, [30, 50, 40], [0, 0, -30]);
  const deep = useStarfield(2600, 32, [2.2, 6, 20], [0, 0, -12]);
  const m = useMemo(() => {
    if (!a) return null;
    const n = new THREE.Vector3(Math.cos(TILT), Math.sin(TILT), 0);
    const L = solidify(stoneMat(a, "#b8b2aa", 1.6, 0.6));
    const R = solidify(stoneMat(a, "#b8b2aa", 1.6, 0.6));
    const pl = new THREE.Plane(n.clone().negate(), 0), pr = new THREE.Plane(n.clone(), 0);
    L.clippingPlanes = [pl.clone()]; R.clippingPlanes = [pr.clone()];
    return { L, R, pl, pr, glow: lightMat("#fff4e6", 4) };
  }, [a]);
  const crackGeo = useMemo(() => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(crackPts, false, "catmullrom", 0.1), 120, 0.012, 6, false), []);
  if (!a || !m) return <Full>{null}</Full>;
  const lx = -gap / 2, rx = gap / 2, lr = gap * 0.05, rr = -gap * 0.05;
  const mL = new THREE.Matrix4().compose(new THREE.Vector3(lx, 0, 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, lr)), new THREE.Vector3(1, 1, 1));
  const mR = new THREE.Matrix4().compose(new THREE.Vector3(rx, 0, 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, rr)), new THREE.Vector3(1, 1, 1));
  m.L.clippingPlanes![0].copy(m.pl).applyMatrix4(mL);
  m.R.clippingPlanes![0].copy(m.pr).applyMatrix4(mR);
  const rows = (mat: THREE.Material) => (
    <>
      <Letters font={a.bebas} family="bebas" text="I'M JUST LOOKING" size={0.4} depth={0.4} material={mat} tracking={0.04} bevel={0.02} position={[0, 1.13, 0]} />
      <Letters font={a.bebas} family="bebas" text="FOR A" size={0.4} depth={0.4} material={mat} tracking={0.04} bevel={0.02} position={[0, 0.7, 0]} />
    </>
  );
  const word = <Letters font={a.bebas} family="bebas" text="BREAK" size={1.05} depth={0.55} material={m.L} tracking={0.02} bevel={0.025} />;
  return (
    <Full>
      <Stage cam={{ pos: [0.25, -0.1, 8.6], look: [0, 0.4, 0], fov: 36 }} look={{ exposure: 1.05, env: 0.25, bloom: { strength: 0.7, radius: 0.5, threshold: 0.8 }, bg: "#030303" }}>
        <directionalLight position={[-3, 5, 4]} intensity={2.4} color="#f1e9dd" />
        <pointLight position={[0, 0, 1.4]} intensity={5 + amt * 25} decay={2} color="#ffe2bf" />
        <Glow geo={stars} size={4} gain={0.5} time={t} twinkle={0.4} />
        <Glow geo={deep} size={2.6} gain={0.3 + amt * 0.7} time={t} twinkle={0.5} />
        <group position={[lx, 0, 0]} rotation={[0, 0, lr]}>{word}{rows(m.L)}<mesh geometry={crackGeo} material={m.glow} /></group>
        <group position={[rx, 0, 0]} rotation={[0, 0, rr]}>
          <Letters font={a.bebas} family="bebas" text="BREAK" size={1.05} depth={0.55} material={m.R} tracking={0.02} bevel={0.025} />
          {rows(m.R)}
          <mesh geometry={crackGeo} material={m.glow} />
        </group>
      </Stage>
      <Finish />
    </Full>
  );
};
