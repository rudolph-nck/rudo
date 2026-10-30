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

type Assets = { geo: THREE.BufferGeometry; font: Font };
const mono = (size: number, color = INK): React.CSSProperties => ({ fontFamily: F.mono, fontSize: size, color, lineHeight: 1.35, whiteSpace: "pre" });

const CH1_START = sectionById("chorus1").start;

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
const preCache = new Map<string, ReturnType<typeof buildPre>>();
const buildPre = (id: string) => {
  const sec = sectionById(id);
  const lines = linesOf(id);
  const words = lines.flatMap((l) => l.words.map((w) => ({ w, last: w === l.words[l.words.length - 1] })));
  const n = words.length - 1;
  // pre-chorus 2 is seen from higher up, lit from above
  const lift = id === "prechorus2" ? 1.4 : 0;
  const cam = makeCam([
    { t: sec.start, p: [3.6, 1.4 + lift, 6.2], l: [0, -0.2, 0.6], fov: 38 },
    ...words.map(({ w }, k): CamKey => {
      const s = stepAt(k);
      return { t: w.s + 0.05, p: [s.x + 3.4 - lift * 0.8, s.y + 1.6 + lift, s.z + 5.6], l: [s.x - 0.1, s.y - 0.55, s.z + 0.9], fov: 38 };
    }),
    { t: sec.end + 0.03, p: [stepAt(n).x + 3.6, stepAt(n).y + 2.4 + lift, stepAt(n).z + 5.0], l: [0, stepAt(n).y * 0.6, stepAt(n).z * 0.6], fov: 40 },
  ]);
  return { sec, lines, words, cam, lift };
};
const preData = (id: string) => {
  if (!preCache.has(id)) preCache.set(id, buildPre(id));
  return preCache.get(id)!;
};

const StairScene: React.FC<{ t: number; a: Assets; id: string }> = ({ t, a, id }) => {
  const D = preData(id);
  const { camera, gl } = useThree();
  const M = useMemo(() => ({ step: contourMat({ pitch: 6, warp: 0.15, axis: [0, 1, 0.35] }), letter: new THREE.MeshBasicMaterial({ color: INK }), accent: new THREE.MeshBasicMaterial({ color: STONE }), edge: new THREE.LineBasicMaterial({ color: "#8e8b86" }) }), []);
  const box = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), []);
  useLayoutEffect(() => applyCam(camera, D.cam(t)));
  gl.setClearColor("#000");
  M.step.uniforms.uKey.value.set(D.lift ? 0.1 : 0.5, 1, D.lift ? 0.2 : 0.6).normalize();
  M.step.uniforms.uLevel.value = 0.85 + 0.3 * kickEnv(t, 0.2) + D.lift * 0.15;
  return (
    <>
      {D.words.map(({ w, last }, k) => {
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

export const PreChorus: React.FC<{ t: number; a: Assets | null; bare?: boolean; id?: string }> = ({ t, a, bare, id = "prechorus1" }) => {
  const D = preData(id);
  const PRE = D.lines;
  const step = D.words.filter(({ w }) => w.s <= t).length;
  const hush = t > PRE[PRE.length - 1].end ? clamp01((t - PRE[PRE.length - 1].end) / 0.15) : 0;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {a ? (
        <ThreeCanvas width={W} height={H} style={{ position: "absolute", inset: 0 }} gl={{ antialias: true }}>
          <StairScene t={t} a={a} id={id} />
        </ThreeCanvas>
      ) : null}
      {bare ? null : PRE.map((l, i) => <LyricLine key={l.id} line={l} t={t} top={250} out={lineOut(l, PRE[i + 1], 0.5)} maxSize={104} />)}
      {bare ? null : <div style={{ position: "absolute", left: SAFE.left, top: 170, ...mono(20, STONE) }}>{id === "prechorus2" ? "07 / PRE-CHORUS — another stair" : "03 / PRE-CHORUS — every door they closed"}</div>}
      <div style={{ position: "absolute", left: SAFE.left, top: 206, ...mono(18, DIM), opacity: bare ? 0 : 1 }}>{`step ${String(step).padStart(2, "0")} / ${D.words.length} · rise ${RISE.toFixed(2)} · run ${RUN.toFixed(2)}`}</div>
      {D.lift ? <AbsoluteFill style={{ background: "radial-gradient(ellipse 70% 40% at 50% 0%, rgba(240,238,234,0.16) 0%, rgba(0,0,0,0) 100%)", mixBlendMode: "screen" }} /> : null}
      {/* the silent beat before the chorus */}
      {hush > 0 ? <AbsoluteFill style={{ background: `rgba(0,0,0,${0.85 * hush})` }} /> : null}
    </AbsoluteFill>
  );
};

// =============================================================================================
// CHORUS: the roof at night. RUDO sits on the ledge above a city drawn in lines.
/** Per-chorus data: lines, the "universe" line, and the chorus-1 camera moves shifted in time. */
const chCache = new Map<string, ReturnType<typeof buildCh>>();
const buildCh = (id: string) => {
  const sec = sectionById(id);
  const lines = linesOf(id);
  const uni = lines.find((l) => /universe/i.test(l.text))!;
  const d = sec.start - CH1_START;
  const mood = id === "chorus2" ? "sunrise" : id === "chorus3" ? "final" : "night";
  const cam = makeCam([
    // opens exactly where the pre-chorus flight landed: in front of him on the roof
    { t: sec.start, p: [0.0, 1.25, -2.9], l: [0, 0.7, 0], fov: 40 },
    // SHOUT: hold on him through the blast, then tilt up into the sky after the words
    { t: lines[0].words[1].s, p: [0.0, 1.25, -2.9], l: [0, 0.7, 0], fov: 40 },
    { t: lines[0].words[1].s + 0.35, p: [0.15, 1.15, -3.3], l: [0, 1.0, 0], fov: 42 },
    { t: lines[0].end, p: [0.2, 0.9, -3.6], l: [0, 6, -1.4], fov: 58 },
    // scars and stars overhead, drifting
    { t: lines[1].end, p: [0.1, 0.9, -3.6], l: [0.8, 6.2, -1.2], fov: 60 },
    // came up from the floor: dive back down onto him
    { t: lines[2].start + 0.7, p: [2.0, 1.4, -3.4], l: [0, 0.8, 0], fov: 44 },
    { t: lines[2].start + 1.1, p: [2.2, 1.35, -3.2], l: [0, 0.75, 0], fov: 43 },
    { t: lines[2].end, p: [2.8, 1.2, -2.7], l: [0, 0.7, 0], fov: 42 },
    { t: 69.5 + d, p: [2.9, 0.75, -1.4], l: [0, 0.55, 0], fov: 38 },
    { t: 73.5 + d, p: [0.6, 2.0, -3.4], l: [0, 0.2, 3], fov: 40 },
    { t: uni.start, p: [-0.4, 1.2, -2.6], l: [0, 1.0, 2], fov: 42 },
    { t: uni.start + 1.6, p: [0, 3.5, -1.0], l: [0, 40, 6], fov: 60 },
    { t: sec.end, p: [0, 6.5, 0.5], l: [0, 60, 10], fov: 62 },
  ]);
  return { sec, lines, uni, cam, mood };
};
const chData = (id: string) => {
  if (!chCache.has(id)) chCache.set(id, buildCh(id));
  return chCache.get(id)!;
};

/** Window facade texture for the tower (crisp lit/unlit windows). */
let facadeTex: THREE.CanvasTexture | null = null;
const facade = () => {
  if (facadeTex) return facadeTex;
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 6144;
  const x = c.getContext("2d")!;
  x.fillStyle = "#0b0b0b";
  x.fillRect(0, 0, c.width, c.height);
  const r = rng(42);
  const cols = 6, rows = 64;
  const cw = c.width / cols, rh = c.height / rows;
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const lit = r() < 0.38;
      x.fillStyle = lit ? `rgba(240,236,228,${0.55 + r() * 0.45})` : "#1a1a1a";
      x.fillRect(i * cw + cw * 0.18, j * rh + rh * 0.16, cw * 0.64, rh * 0.62);
      x.strokeStyle = "rgba(239,237,233,0.55)";
      x.lineWidth = 3;
      x.strokeRect(i * cw + cw * 0.18, j * rh + rh * 0.16, cw * 0.64, rh * 0.62);
    }
  x.strokeStyle = "rgba(239,237,233,0.35)";
  x.lineWidth = 4;
  for (let i = 0; i <= cols; i++) {
    x.beginPath();
    x.moveTo(i * cw, 0);
    x.lineTo(i * cw, c.height);
    x.stroke();
  }
  facadeTex = new THREE.CanvasTexture(c);
  facadeTex.colorSpace = THREE.SRGBColorSpace;
  facadeTex.anisotropy = 8;
  return facadeTex;
};

export const RoofScene: React.FC<{ t: number; a: Assets; id?: string; cam?: ReturnType<ReturnType<typeof makeCam>>; tower?: boolean }> = ({ t, a, id = "chorus1", cam, tower }) => {
  const D = chData(id);
  const winMat = useMemo(() => new THREE.MeshBasicMaterial({ map: facade() }), []);
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
  useLayoutEffect(() => applyCam(camera, cam ?? D.cam(t)));
  gl.setClearColor("#000", 0);
  const kick = kickEnv(t, 0.2);
  // night: light from the city behind him; sunrise: from the low sun in front
  if (D.mood === "sunrise") M.body.uniforms.uKey.value.set(0.3, 0.35, 0.9).normalize();
  else M.body.uniforms.uKey.value.set(-0.2, 0.7, -0.8).normalize();
  M.body.uniforms.uRim.value = 1.3;
  M.body.uniforms.uLevel.value = 0.9 + 0.25 * kick;
  M.ledge.uniforms.uLevel.value = 0.7;
  M.bldg.uniforms.uLevel.value = 0.55 + 0.2 * kick;
  starMat.size = 1.6 + clamp01((t - D.uni.start) / 1.5) * 2.5;
  starMat.opacity = D.mood === "sunrise" ? 0.25 : 1;
  starMat.transparent = true;
  const lift = D.mood === "final" ? Math.max(0, t - D.sec.start) : 0;
  return (
    <>
      <mesh geometry={a.geo} material={M.body} position={[0, 0, 0]} rotation={[0, Math.PI, 0]} />
      <mesh geometry={box} material={M.ledge} position={[0, -0.25, 0]} scale={[5, 0.5, 1.4]} />
      <mesh geometry={box} material={M.ledge} position={[0, -6, 2.5]} scale={[5, 11, 5]} />
      {tower ? (
        <>
          <mesh geometry={box} material={M.bldg} position={[0, -42, 2.5]} scale={[5, 61, 5]} />
          <mesh material={winMat} position={[0, -36, -0.02]} rotation={[0, Math.PI, 0]}>
            <planeGeometry args={[4.8, 71]} />
          </mesh>
        </>
      ) : null}
      {city.map((b, i) => (
        <mesh key={i} geometry={box} material={M.bldg} position={[b.x, -30 + b.h / 2, b.z]} scale={[b.w, b.h, b.w]} />
      ))}
      <points geometry={stars} material={starMat} />
      {/* final chorus: everything he built lifts into the sky around him */}
      {D.mood === "final"
        ? Array.from({ length: 26 }, (_, i) => {
            const r = (k: number) => ((Math.sin(i * 12.9898 + k * 78.233) * 43758.5453) % 1 + 1) % 1;
            const ang = r(1) * Math.PI * 2, rad = 2.2 + r(2) * 5;
            const y = -6 + r(3) * 4 + lift * (0.5 + r(4) * 0.8);
            const kind = i % 3;
            return (
              <group key={i} position={[Math.cos(ang) * rad, y, Math.sin(ang) * rad]} rotation={[lift * 0.2 * r(5), lift * 0.3 * r(6), 0]}>
                {kind === 0 ? <mesh geometry={box} material={M.ledge} scale={[0.9, 0.18, 0.35]} /> : kind === 1 ? <mesh geometry={box} material={M.bldg} scale={[0.6, 0.45, 0.6]} /> : <mesh geometry={box} material={M.ledge} scale={[0.3, 0.14, 0.14]} />}
              </group>
            );
          })
        : null}
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

export const Chorus: React.FC<{ t: number; a: Assets | null; bare?: boolean; id?: string }> = ({ t, a, bare, id = "chorus1" }) => {
  const D = chData(id);
  const CH = D.lines;
  const outs = CH.map((l, i) => lineOut(l, CH[i + 1], 1.6));
  const kick = kickEnv(t, 0.12);
  const flash = Math.max(0, 0.9 * Math.exp(-(t - D.sec.start) / 0.14)) + (D.mood === "final" ? kick * 0.12 : 0);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {D.mood === "sunrise" ? (
        <AbsoluteFill style={{ background: "linear-gradient(180deg, #121212 0%, #2a2928 45%, #8d8a85 72%, #d9d6d0 82%, #1a1a1a 100%)" }} />
      ) : null}
      {a ? (
        <ThreeCanvas width={W} height={H} style={{ position: "absolute", inset: 0 }} gl={{ antialias: true, alpha: true }}>
          <RoofScene t={t} a={a} id={id} />
        </ThreeCanvas>
      ) : null}
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 40%)" }} />
      {bare
        ? null
        : CH.map((l, i) => <LyricLine key={l.id} line={l} t={t} top={250} out={outs[i]} maxSize={130} align="center" />)}
      {CH.filter((l) => /grinding/i.test(l.text) || D.mood === "final").map((l, i) => (
        <React.Fragment key={l.id}>
          <Sparks t={t} at={l.start} until={l.end} x={SAFE.left + 40} y={640} dir={Math.PI * 0.85} seed={i * 7 + 1} />
          <Sparks t={t} at={l.start} until={l.end} x={SAFE.right - 40} y={640} dir={Math.PI * 0.15} seed={i * 7 + 2} />
        </React.Fragment>
      ))}
      {bare ? null : <div style={{ position: "absolute", left: SAFE.left, top: 170, ...mono(20, STONE) }}>{id === "chorus2" ? "08 / CHORUS — sunrise" : id === "chorus3" ? "11 / FINAL CHORUS — everything lifts" : "04 / CHORUS — the roof"}</div>}
      {flash > 0.01 ? <AbsoluteFill style={{ background: `rgba(255,255,255,${flash})` }} /> : null}
    </AbsoluteFill>
  );
};

// =============================================================================================
// POST-CHORUS: shouted lines stamped full-width; then a strobe through the grind on the beat.
export const PostChorus: React.FC<{ t: number; a: Assets | null; id?: string; montage: number[]; renderAt: (src: number) => React.ReactNode }> = ({ t, a, id = "postchorus1", montage, renderAt }) => {
  const sec = sectionById(id);
  const POST = linesOf(id);
  const stampUntil = POST[POST.length - 1].end + 0.6;
  const outs = POST.map((l, i) => lineOut(l, POST[i + 1], 0.8));
  const beats = T.beats.filter((b) => b >= stampUntil && b < sec.end);
  const bi = beats.filter((b) => b <= t).length - 1;
  const inMontage = t >= stampUntil && bi >= 0;
  const src = inMontage ? montage[bi % montage.length] + (t - beats[bi]) : t;
  const beatFlash = inMontage ? Math.exp(-(t - beats[bi]) / 0.06) * 0.5 : 0;
  const roofId = id === "postchorus2" ? "chorus3" : "chorus1";
  const roof = chData(roofId);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {inMontage ? (
        renderAt(src)
      ) : a ? (
        <ThreeCanvas width={W} height={H} style={{ position: "absolute", inset: 0 }} gl={{ antialias: true }}>
          <RoofScene t={roof.sec.end - 2 + (t - sec.start) * 0.4} a={a} id={roofId} />
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
      <div style={{ position: "absolute", left: SAFE.left, top: 170, ...mono(20, STONE) }}>{id === "postchorus2" ? "12 / POST-CHORUS — the whole climb" : "05 / POST-CHORUS — still climbing"}</div>
    </AbsoluteFill>
  );
};
