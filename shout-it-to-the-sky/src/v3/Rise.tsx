import React, { useLayoutEffect, useMemo } from "react";
import { AbsoluteFill } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Font } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { T, kickEnv, linesOf, sectionById } from "../data";
import { SAFE, W, H } from "../theme";
import { F } from "../utils/fonts";
import { clamp01, cubicOut } from "../utils/ease";
import { rng } from "../utils/random";
import { contourMat } from "../three/contour";
import { CamKey, applyCam, makeCam } from "./cam";
import { DIM, INK, LyricLine, STONE, lineOut } from "./LyricType";
import { Verse1 } from "./Verse1";

type Assets = { geo: THREE.BufferGeometry; font: Font };
const mono = (size: number, color = INK): React.CSSProperties => ({ fontFamily: F.mono, fontSize: size, color, lineHeight: 1.35, whiteSpace: "pre" });

const PRE = linesOf("prechorus1");
const PRE_WORDS = PRE.flatMap((l) => l.words.map((w) => ({ w, last: w === l.words[l.words.length - 1] })));
const CH = linesOf("chorus1");
const POST = linesOf("postchorus1");
const CH_SEC = sectionById("chorus1");
const POST_SEC = sectionById("postchorus1");

const textGeoCache = new Map<string, { geo: THREE.BufferGeometry; w: number }>();
const textGeo = (font: Font, s: string, size: number) => {
  const key = `${s}|${size}`;
  let g = textGeoCache.get(key);
  if (!g) {
    const geo = new TextGeometry(s, { font, size, depth: size * 0.04, curveSegments: 6 });
    geo.computeBoundingBox();
    const b = geo.boundingBox!;
    geo.translate(-(b.max.x + b.min.x) / 2, -(b.max.y + b.min.y) / 2, 0);
    g = { geo, w: b.max.x - b.min.x };
    textGeoCache.set(key, g);
  }
  return g;
};

// =============================================================================================
// PRE-CHORUS: every word is a step that folds down onto the last one.
const RISE = 0.3, RUN = 0.5, STEP_W = 2.1;
const stepAt = (k: number) => new THREE.Vector3(0, k * RISE, -k * RUN);
const preCam = makeCam([
  { t: 49.7, p: [3.6, 1.4, 6.2], l: [0, -0.2, 0.6], fov: 38 },
  ...PRE_WORDS.map(({ w }, k): CamKey => {
    const s = stepAt(k);
    return { t: w.s + 0.05, p: [s.x + 3.4, s.y + 1.6, s.z + 5.6], l: [s.x - 0.1, s.y - 0.55, s.z + 0.9], fov: 38 };
  }),
  { t: 58.3, p: [stepAt(PRE_WORDS.length - 1).x + 3.6, stepAt(PRE_WORDS.length - 1).y + 2.4, stepAt(PRE_WORDS.length - 1).z + 5.0], l: [0, stepAt(PRE_WORDS.length - 1).y * 0.6, stepAt(PRE_WORDS.length - 1).z * 0.6], fov: 40 },
]);

const StairScene: React.FC<{ t: number; a: Assets }> = ({ t, a }) => {
  const { camera, gl } = useThree();
  const M = useMemo(() => ({ step: contourMat({ pitch: 6, warp: 0.15, axis: [0, 1, 0.35] }), letter: new THREE.MeshBasicMaterial({ color: INK }), accent: new THREE.MeshBasicMaterial({ color: STONE }), edge: new THREE.LineBasicMaterial({ color: "#8e8b86" }) }), []);
  const box = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), []);
  useLayoutEffect(() => applyCam(camera, preCam(t)));
  gl.setClearColor("#000");
  M.step.uniforms.uKey.value.set(0.5, 1, 0.6).normalize();
  M.step.uniforms.uLevel.value = 0.85 + 0.3 * kickEnv(t, 0.2);
  return (
    <>
      {PRE_WORDS.map(({ w, last }, k) => {
        const dt = t - w.s;
        if (dt < 0) return null;
        const s = stepAt(k);
        // fold: the step stands up like a card on the back edge, then falls flat into place
        const p = clamp01(dt / 0.2);
        const fold = (1 - cubicOut(p)) * (-Math.PI / 2) + (p >= 1 ? Math.sin(Math.min(1, (dt - 0.2) / 0.12) * Math.PI) * 0.05 : 0);
        const word = w.w.toUpperCase();
        const g = textGeo(a.font, word, Math.min(0.17, (STEP_W * 0.9) / Math.max(1, word.length * 0.62) / 1.05));
        return (
          <group key={k} position={[s.x, s.y, s.z - RUN / 2]} rotation={[fold, 0, 0]}>
            {/* pivot on the back edge: geometry offset forward by half a run */}
            <group position={[0, -RISE / 2, RUN / 2]}>
              <mesh geometry={box} material={M.step} scale={[STEP_W, RISE, RUN]} />
              <lineSegments geometry={edges} material={M.edge} scale={[STEP_W * 1.002, RISE * 1.004, RUN * 1.004]} />
              <mesh geometry={g.geo} material={last ? M.accent : M.letter} position={[0, 0, RUN / 2 + 0.003]} />
            </group>
          </group>
        );
      })}
    </>
  );
};

export const PreChorus: React.FC<{ t: number; a: Assets | null; bare?: boolean }> = ({ t, a, bare }) => {
  const step = PRE_WORDS.filter(({ w }) => w.s <= t).length;
  const hush = t > PRE[PRE.length - 1].end ? clamp01((t - PRE[PRE.length - 1].end) / 0.15) : 0;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {a ? (
        <ThreeCanvas width={W} height={H} style={{ position: "absolute", inset: 0 }} gl={{ antialias: true }}>
          <StairScene t={t} a={a} />
        </ThreeCanvas>
      ) : null}
      {bare ? null : PRE.map((l, i) => <LyricLine key={l.id} line={l} t={t} top={250} out={lineOut(l, PRE[i + 1], 0.5)} maxSize={104} />)}
      {bare ? null : <div style={{ position: "absolute", left: SAFE.left, top: 170, ...mono(20, STONE) }}>03 / PRE-CHORUS — every door they closed</div>}
      <div style={{ position: "absolute", left: SAFE.left, top: 206, ...mono(18, DIM), opacity: bare ? 0 : 1 }}>{`step ${String(step).padStart(2, "0")} / ${PRE_WORDS.length} · rise ${RISE.toFixed(2)} · run ${RUN.toFixed(2)}`}</div>
      {/* the silent beat before the chorus */}
      {hush > 0 ? <AbsoluteFill style={{ background: `rgba(0,0,0,${0.85 * hush})` }} /> : null}
    </AbsoluteFill>
  );
};

// =============================================================================================
// CHORUS: the roof at night. RUDO sits on the ledge above a city drawn in lines.
const uni = CH.find((l) => /universe/i.test(l.text))!;
const chCam = makeCam([
  { t: CH_SEC.start + 0.9, p: [0.8, 1.0, 3.6], l: [0, 0.55, 0], fov: 36 },
  { t: 64, p: [2.6, 1.3, 2.6], l: [0, 0.6, 0], fov: 36 },
  { t: 69.5, p: [2.9, 0.75, -1.4], l: [0, 0.55, 0], fov: 38 },
  { t: 73.5, p: [0.6, 2.0, -3.4], l: [0, 0.2, 3], fov: 40 },
  { t: uni.start, p: [-0.4, 1.2, -2.6], l: [0, 1.0, 2], fov: 42 },
  { t: uni.start + 1.6, p: [0, 3.5, -1.0], l: [0, 40, 6], fov: 60 },
  { t: CH_SEC.end, p: [0, 6.5, 0.5], l: [0, 60, 10], fov: 62 },
]);

const RoofScene: React.FC<{ t: number; a: Assets }> = ({ t, a }) => {
  const { camera, gl } = useThree();
  const M = useMemo(
    () => ({
      body: contourMat({ pitch: 6.5 }),
      ledge: contourMat({ pitch: 7, warp: 0.1, axis: [0, 1, 0.2] }),
      bldg: contourMat({ pitch: 9, warp: 0.1, axis: [0, 1, 0], ink: "#a8a6a1" }),
    }),
    [],
  );
  const box = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const city = useMemo(() => {
    const r = rng(17);
    return Array.from({ length: 140 }, () => {
      const ang = Math.PI * 0.15 + r() * Math.PI * 0.7; // spread in front (+z) of him
      const d = 8 + r() * 60;
      return { x: Math.cos(ang) * d * (r() < 0.5 ? 1 : -1), z: Math.sin(ang) * d, h: 4 + r() * 22, w: 1.5 + r() * 4 };
    });
  }, []);
  const stars = useMemo(() => {
    const r = rng(5);
    const n = 1600;
    const p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = 0.05 + r() * 0.95, th = r() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      p.set([Math.cos(th) * s * 300, u * 300 - 10, Math.sin(th) * s * 300], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    return g;
  }, []);
  const starMat = useMemo(() => new THREE.PointsMaterial({ color: "#e8e6e2", size: 1.6, sizeAttenuation: false }), []);
  useLayoutEffect(() => applyCam(camera, chCam(t)));
  gl.setClearColor("#000");
  const kick = kickEnv(t, 0.2);
  M.body.uniforms.uKey.value.set(-0.2, 0.7, -0.8).normalize(); // light from the city/sky behind
  M.body.uniforms.uRim.value = 1.3;
  M.body.uniforms.uLevel.value = 0.9 + 0.25 * kick;
  M.ledge.uniforms.uLevel.value = 0.7;
  M.bldg.uniforms.uLevel.value = 0.55 + 0.2 * kick;
  starMat.size = 1.6 + clamp01((t - uni.start) / 1.5) * 2.5;
  return (
    <>
      <mesh geometry={a.geo} material={M.body} position={[0, 0, 0]} rotation={[0, Math.PI, 0]} />
      <mesh geometry={box} material={M.ledge} position={[0, -0.25, 0]} scale={[5, 0.5, 1.4]} />
      <mesh geometry={box} material={M.ledge} position={[0, -6, 2.5]} scale={[5, 11, 5]} />
      {city.map((b, i) => (
        <mesh key={i} geometry={box} material={M.bldg} position={[b.x, -30 + b.h / 2, b.z]} scale={[b.w, b.h, b.w]} />
      ))}
      <points geometry={stars} material={starMat} />
    </>
  );
};

/** Grinder sparks spraying from a point (DOM, crisp). */
const Sparks: React.FC<{ t: number; at: number; until: number; x: number; y: number; dir: number; seed: number }> = ({ t, at, until, x, y, dir, seed }) => {
  if (t < at || t > until + 0.8) return null;
  const r = rng(seed);
  const parts = Array.from({ length: 140 }, () => ({ t0: at + r() * (until - at), ang: dir + (r() - 0.5) * 0.9, v: 900 + r() * 1100, life: 0.35 + r() * 0.45 }));
  return (
    <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
      {parts.map((p, i) => {
        const a = t - p.t0;
        if (a < 0 || a > p.life) return null;
        const k = a / p.life;
        const vx = Math.cos(p.ang) * p.v, vy = Math.sin(p.ang) * p.v;
        const px = x + vx * a, py = y + vy * a + 0.5 * 2200 * a * a;
        const tx = px - vx * 0.02, ty = py - (vy + 2200 * a) * 0.02;
        return <line key={i} x1={tx} y1={ty} x2={px} y2={py} stroke={`rgba(255,255,255,${1 - k})`} strokeWidth={2.4 * (1 - k * 0.5)} strokeLinecap="round" />;
      })}
    </svg>
  );
};

export const Chorus: React.FC<{ t: number; a: Assets | null; bare?: boolean }> = ({ t, a, bare }) => {
  const outs = CH.map((l, i) => lineOut(l, CH[i + 1], 1.6));
  const flash = Math.max(0, 0.9 * Math.exp(-(t - CH_SEC.start) / 0.14));
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {a ? (
        <ThreeCanvas width={W} height={H} style={{ position: "absolute", inset: 0 }} gl={{ antialias: true }}>
          <RoofScene t={t} a={a} />
        </ThreeCanvas>
      ) : null}
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 40%)" }} />
      {bare
        ? null
        : CH.map((l, i) => <LyricLine key={l.id} line={l} t={t} top={250} out={outs[i]} maxSize={130} align="center" />)}
      {CH.filter((l) => /grinding/i.test(l.text)).map((l, i) => (
        <React.Fragment key={l.id}>
          <Sparks t={t} at={l.start} until={l.end} x={SAFE.left + 40} y={640} dir={Math.PI * 0.85} seed={i * 7 + 1} />
          <Sparks t={t} at={l.start} until={l.end} x={SAFE.right - 40} y={640} dir={Math.PI * 0.15} seed={i * 7 + 2} />
        </React.Fragment>
      ))}
      {bare ? null : <div style={{ position: "absolute", left: SAFE.left, top: 170, ...mono(20, STONE) }}>04 / CHORUS — the roof</div>}
      {flash > 0.01 ? <AbsoluteFill style={{ background: `rgba(255,255,255,${flash})` }} /> : null}
    </AbsoluteFill>
  );
};

// =============================================================================================
// POST-CHORUS: shouted lines stamped full-width; then a strobe through the grind on the beat.
const STAMP_UNTIL = POST[POST.length - 1].end + 0.6;
const MONTAGE = [31.4, 35.0, 53.6, 44.8, 63.5, 40.1, 47.3, 56.5, 70.0, 33.9, 66.0, 49.2];

export const PostChorus: React.FC<{ t: number; a: Assets | null }> = ({ t, a }) => {
  const outs = POST.map((l, i) => lineOut(l, POST[i + 1], 0.8));
  const beats = T.beats.filter((b) => b >= STAMP_UNTIL && b < POST_SEC.end);
  const bi = beats.filter((b) => b <= t).length - 1;
  const inMontage = t >= STAMP_UNTIL && bi >= 0;
  const src = inMontage ? MONTAGE[bi % MONTAGE.length] + (t - beats[bi]) : t;
  const beatFlash = inMontage ? Math.exp(-(t - beats[bi]) / 0.06) * 0.5 : 0;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {inMontage ? (
        src < 29.2 ? null : src < 49.7 ? (
          <Verse1 t={src} assets={a} bare />
        ) : src < 58.27 ? (
          <PreChorus t={src} a={a} bare />
        ) : (
          <Chorus t={src} a={a} bare />
        )
      ) : a ? (
        <ThreeCanvas width={W} height={H} style={{ position: "absolute", inset: 0 }} gl={{ antialias: true }}>
          <RoofScene t={CH_SEC.end - 2 + (t - POST_SEC.start) * 0.4} a={a} />
        </ThreeCanvas>
      ) : null}
      {!inMontage ? (
        <>
          <AbsoluteFill style={{ background: "rgba(0,0,0,0.45)" }} />
          {POST.map((l, i) => (
            <LyricLine key={l.id} line={l} t={t} top={300} out={outs[i]} maxSize={168} maxRows={4} weight={900} timecodes={false} />
          ))}
        </>
      ) : null}
      {beatFlash > 0.01 ? <AbsoluteFill style={{ background: `rgba(255,255,255,${beatFlash})` }} /> : null}
      <div style={{ position: "absolute", left: SAFE.left, top: 170, ...mono(20, STONE) }}>05 / POST-CHORUS — still climbing</div>
    </AbsoluteFill>
  );
};

