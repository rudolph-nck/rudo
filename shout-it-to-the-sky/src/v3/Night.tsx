import React, { useLayoutEffect, useMemo } from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Font } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { T, kickEnv, linesOf, sectionById } from "../data";
import { SAFE, W, H } from "../theme";
import { F } from "../utils/fonts";
import { clamp01, cubicIn, cubicOut, mix } from "../utils/ease";
import { hash01, rng } from "../utils/random";
import { contourMat } from "../three/contour";
import { IntroScene, WALL_Z, buildCrack, crackMat } from "../intro/Scene3D";
import { applyCam, makeCam } from "./cam";
import { INK, LyricLine, STONE, lineOut } from "./LyricType";

type Assets = { geo: THREE.BufferGeometry; font: Font };
const mono = (size: number, color = INK): React.CSSProperties => ({ fontFamily: F.mono, fontSize: size, color, lineHeight: 1.35, whiteSpace: "pre" });

const brickTextCache = new Map<string, { geo: THREE.BufferGeometry; w: number }>();
const brickText = (font: Font, s: string, size: number) => {
  const key = `${s}|${size}`;
  let g = brickTextCache.get(key);
  if (!g) {
    const geo = new TextGeometry(s, { font, size, depth: 0.002, curveSegments: 5 });
    geo.computeBoundingBox();
    const b = geo.boundingBox!;
    geo.translate(-(b.max.x + b.min.x) / 2, -(b.max.y + b.min.y) / 2, 0);
    g = { geo, w: b.max.x - b.min.x };
    brickTextCache.set(key, g);
  }
  return g;
};

// =============================================================================================
// VERSE 3: midnight. Desk, lamp, mic; every bar becomes a brick in the wall behind him.
const V3 = linesOf("verse3");
const V3_SEC = sectionById("verse3");
const V3_WORDS = V3.flatMap((l) => l.words.map((w) => ({ w, last: w === l.words[l.words.length - 1] })));
const EYES = V3[6];
const THREE_LIVES = V3[11];
const WALL = { z: -1.15, w: 2.0, bh: 0.13, size: 0.066, y0: 0.82 };

const v3Cam = makeCam([
  { t: V3_SEC.start, p: [0.7, 1.15, 2.2], l: [0, 0.95, -1.0], fov: 40 },
  { t: 166, p: [-0.6, 1.05, 1.6], l: [0, 0.95, -1.15], fov: 40 },
  { t: 170, p: [0.5, 1.25, 1.4], l: [0, 1.1, -1.15], fov: 40 },
  { t: 172.8, p: [0.1, 1.45, 1.35], l: [0, 1.3, -1.15], fov: 40 },
  { t: 176, p: [-0.5, 1.7, 1.45], l: [0, 1.5, -1.15], fov: 42 },
  { t: 180, p: [0.4, 1.95, 1.7], l: [0, 1.7, -1.15], fov: 44 },
  { t: V3_SEC.end + 1.6, p: [0, 2.2, 2.3], l: [0, 1.8, -1.15], fov: 46 },
]);

const DeskScene: React.FC<{ t: number; a: Assets }> = ({ t, a }) => {
  const { camera, gl } = useThree();
  const M = useMemo(
    () => ({
      wood: contourMat({ pitch: 6, warp: 0.1, axis: [1, 0.2, 0.2] }),
      metal: contourMat({ pitch: 5, warp: 0.4 }),
      brick: contourMat({ pitch: 5, warp: 0.05, axis: [0, 1, 0.2] }),
      floor: contourMat({ pitch: 9, warp: 0.1, axis: [0.2, 0, 1], ink: "#8f8c87" }),
      page: contourMat({ pitch: 4, warp: 0.0, axis: [0, 1, 0] }),
      letter: new THREE.MeshBasicMaterial({ color: INK }),
      accent: new THREE.MeshBasicMaterial({ color: STONE }),
      bulb: new THREE.MeshBasicMaterial({ color: "#ffffff" }),
    }),
    [],
  );
  const box = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const sphere = useMemo(() => new THREE.SphereGeometry(1, 48, 32), []);
  const cyl = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 32), []);
  const cone = useMemo(() => new THREE.ConeGeometry(1, 1, 40, 1, true), []);
  const bricks = useMemo(() => {
    const out: { x: number; y: number; w: number; text: string; size: number }[] = [];
    let x = -WALL.w / 2, row = 0;
    V3_WORDS.forEach(({ w }) => {
      const s = w.w.toUpperCase();
      const g = brickText(a.font, s, WALL.size);
      const bw = g.w + 0.06;
      if (x + bw > WALL.w / 2) {
        row++;
        x = -WALL.w / 2 + (row % 2 ? 0.05 : 0);
      }
      out.push({ x: x + bw / 2, y: WALL.y0 + row * (WALL.bh + 0.006) + WALL.bh / 2, w: bw, text: s, size: WALL.size });
      x += bw + 0.006;
    });
    return out;
  }, [a.font]);
  useLayoutEffect(() => applyCam(camera, v3Cam(t)));
  gl.setClearColor("#000");
  const lamp = 0.92 + 0.08 * Math.sin(t * 1.7);
  for (const m of [M.wood, M.metal, M.brick, M.floor, M.page]) {
    m.uniforms.uKey.value.set(0.4, 1, 0.2).normalize();
    m.uniforms.uLevel.value = lamp * (0.75 + 0.2 * kickEnv(t, 0.2));
  }
  return (
    <>
      <mesh material={M.floor} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[8, 8]} />
      </mesh>
      {/* desk */}
      <mesh geometry={box} material={M.wood} position={[0, 0.74, -0.35]} scale={[1.5, 0.04, 0.7]} />
      {[-0.7, 0.7].flatMap((x) => [-0.65, -0.05].map((z) => <mesh key={`${x}${z}`} geometry={box} material={M.wood} position={[x, 0.36, z]} scale={[0.04, 0.72, 0.04]} />))}
      {/* lamp */}
      <mesh geometry={cyl} material={M.metal} position={[0.5, 0.77, -0.5]} scale={[0.09, 0.02, 0.09]} />
      <mesh geometry={box} material={M.metal} position={[0.5, 1.0, -0.5]} rotation={[0, 0, -0.3]} scale={[0.015, 0.48, 0.015]} />
      <mesh geometry={cone} material={M.metal} position={[0.4, 1.22, -0.5]} rotation={[0, 0, 0.7]} scale={[0.1, 0.14, 0.1]} />
      <mesh geometry={sphere} material={M.bulb} position={[0.37, 1.18, -0.5]} scale={0.025 * lamp} />
      {/* mic */}
      <mesh geometry={cyl} material={M.metal} position={[-0.35, 0.77, -0.3]} scale={[0.07, 0.02, 0.07]} />
      <mesh geometry={box} material={M.metal} position={[-0.35, 1.0, -0.3]} scale={[0.012, 0.46, 0.012]} />
      <mesh geometry={sphere} material={M.metal} position={[-0.35, 1.27, -0.3]} scale={[0.05, 0.075, 0.05]} />
      {/* pages of lyrics floating */}
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={i} geometry={box} material={M.page} position={[(hash01(i) - 0.5) * 2.2, 0.95 + hash01(i + 3) * 1.0 + Math.sin(t * 0.6 + i) * 0.06, -0.2 + (hash01(i + 7) - 0.5) * 0.9]} rotation={[t * 0.12 + i, t * 0.1 + i * 2, 0.3]} scale={[0.21, 0.297, 0.002]} />
      ))}
      {/* the wall of bars */}
      <group position={[0, 0, WALL.z]}>
        {V3_WORDS.map(({ w, last }, i) => {
          if (t < w.s) return null;
          const b = bricks[i];
          const p = clamp01((t - w.s) / 0.14);
          const dy = (1 - cubicIn(p)) * 0.8;
          const g = brickText(a.font, b.text, b.size);
          return (
            <group key={i} position={[b.x, b.y + dy, 0]}>
              <mesh geometry={box} material={M.brick} scale={[b.w, WALL.bh, 0.1]} />
              <mesh geometry={g.geo} material={last ? M.accent : M.letter} position={[0, 0, 0.051]} />
            </group>
          );
        })}
      </group>
    </>
  );
};

export const Verse3: React.FC<{ t: number; a: Assets | null; bare?: boolean; renderAt?: (src: number) => React.ReactNode }> = ({ t, a, bare, renderAt }) => {
  const outs = V3.map((l, i) => lineOut(l, V3[i + 1], 1.0));
  const eyes = t >= EYES.start && t < EYES.end + 0.05;
  const lives = renderAt && t >= THREE_LIVES.words[3].s && t < THREE_LIVES.end + 0.4;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {a && !eyes && !lives ? (
        <ThreeCanvas width={W} height={H} style={{ position: "absolute", inset: 0 }} gl={{ antialias: true }}>
          <DeskScene t={t} a={a} />
        </ThreeCanvas>
      ) : null}
      {/* tired eyes: straight into his face */}
      {a && eyes ? (
        <ThreeCanvas width={W} height={H} style={{ position: "absolute", inset: 0 }} gl={{ antialias: true }}>
          <IntroScene t={14.2 + (t - EYES.start) * 1.6} geo={a.geo} font={a.font} />
        </ThreeCanvas>
      ) : null}
      {/* three lives: the screen splits into IT, the flip, the mic */}
      {lives && renderAt
        ? [44.8, 109.9, 170.5].map((src, i) => (
            <div key={i} style={{ position: "absolute", left: 0, top: 230 + i * 440, width: W, height: 430, overflow: "hidden", borderTop: i ? `3px solid ${STONE}` : undefined, opacity: clamp01((t - THREE_LIVES.words[3].s - i * 0.12) / 0.1) }}>
              <div style={{ position: "absolute", left: 0, top: -760, width: W, height: H }}>{renderAt(src)}</div>
              <div style={{ position: "absolute", left: SAFE.left, top: 16, ...mono(22, STONE) }}>{["IT · BY DAY", "FLIPS · BY DUSK", "MIC · BY MIDNIGHT"][i]}</div>
            </div>
          ))
        : null}
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.85) 26%, rgba(0,0,0,0) 40%)" }} />
      {bare ? null : V3.map((l, i) => <LyricLine key={l.id} line={l} t={t} top={250} out={outs[i]} maxSize={104} />)}
      {bare ? null : <div style={{ position: "absolute", left: SAFE.left, top: 170, ...mono(20, STONE) }}>09 / VERSE 3 — midnight</div>}
    </AbsoluteFill>
  );
};

// =============================================================================================
// BRIDGE: half-time. Low on his worn sneakers, rising slowly to his face. Handwritten lines.
const BR = linesOf("bridge");
const BR_SEC = sectionById("bridge");
const brCam = makeCam([
  { t: BR_SEC.start, p: [0.45, 0.14, 1.25], l: [0.05, 0.1, 0.35], fov: 38 },
  { t: BR[1].start, p: [-0.4, 0.22, 1.35], l: [0, 0.18, 0.3], fov: 38 },
  { t: BR[2].start, p: [0.3, 0.7, 1.8], l: [0, 0.6, 0], fov: 38 },
  { t: BR_SEC.end, p: [0, 1.1, 2.4], l: [0, 1.0, 0], fov: 36 },
]);
const BridgeScene: React.FC<{ t: number; a: Assets }> = ({ t, a }) => {
  const { camera, gl } = useThree();
  const M = useMemo(() => ({ body: contourMat({ pitch: 6 }), floor: contourMat({ pitch: 9, warp: 0.1, axis: [0.15, 0, 1], ink: "#8f8c87" }) }), []);
  useLayoutEffect(() => applyCam(camera, brCam(t)));
  gl.setClearColor("#000");
  M.body.uniforms.uKey.value.set(0.2, 1, 0.4).normalize();
  M.body.uniforms.uLevel.value = 0.8;
  M.floor.uniforms.uLevel.value = 0.4;
  return (
    <>
      <mesh geometry={a.geo} material={M.body} />
      <mesh material={M.floor} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[6, 6]} />
      </mesh>
    </>
  );
};

/** Handwritten bridge lines (Caveat), each fading in as it's sung. */
const HandLine: React.FC<{ t: number; l: (typeof BR)[number]; out: number }> = ({ t, l, out }) => {
  if (t < l.start - 0.01 || t > out + 0.6) return null;
  const q = clamp01((t - out) / 0.6);
  return (
    <div style={{ position: "absolute", left: SAFE.left, top: 270, width: SAFE.right - SAFE.left, textAlign: "center", opacity: 1 - q }}>
      {l.words.map((w, i) => {
        const dt = t - w.s;
        if (dt < 0) return null;
        const p = cubicOut(clamp01(dt / 0.5));
        return (
          <span key={i} style={{ fontFamily: F.hand, fontWeight: 500, fontSize: 124, lineHeight: 1.05, color: i === l.words.length - 1 ? STONE : INK, opacity: p, filter: `blur(${(1 - p) * 4}px)`, display: "inline-block", marginRight: 26, transform: `translateY(${(1 - p) * 10}px)` }}>
            {w.w}
          </span>
        );
      })}
    </div>
  );
};

export const Bridge: React.FC<{ t: number; a: Assets | null; bare?: boolean }> = ({ t, a, bare }) => {
  const outs = BR.map((l, i) => lineOut(l, BR[i + 1], 2.0));
  const grow = clamp01((t - BR[3].words[5].s) / 2.2);
  const dust = useMemo(() => {
    const r = rng(12);
    return Array.from({ length: 70 }, () => ({ x: r() * W, y: r() * H, s: 2 + r() * 4, v: 30 + r() * 50 }));
  }, []);
  const vine = Array.from({ length: 60 }, (_, i) => {
    const k = i / 59;
    return `${i ? "L" : "M"}${(540 + Math.sin(k * 9) * 90 * (0.4 + k)).toFixed(1)} ${(1520 - k * 900).toFixed(1)}`;
  }).join(" ");
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {a ? (
        <ThreeCanvas width={W} height={H} style={{ position: "absolute", inset: 0 }} gl={{ antialias: true }}>
          <BridgeScene t={t} a={a} />
        </ThreeCanvas>
      ) : null}
      {dust.map((d, i) => (
        <div key={i} style={{ position: "absolute", left: d.x + Math.sin(t * 0.5 + i) * 20, top: (d.y + t * d.v) % H, width: d.s, height: d.s, borderRadius: "50%", background: "rgba(239,237,233,0.5)" }} />
      ))}
      {grow > 0 ? (
        <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
          <path d={vine} stroke={STONE} strokeWidth={5} fill="none" strokeDasharray={1400} strokeDashoffset={1400 * (1 - grow)} strokeLinecap="round" />
          {Array.from({ length: 9 }, (_, i) => {
            const k = (i + 1) / 10;
            if (grow < k) return null;
            const x = 540 + Math.sin(k * 9) * 90 * (0.4 + k), y = 1520 - k * 900;
            return <ellipse key={i} cx={x + (i % 2 ? 26 : -26)} cy={y} rx={24} ry={11} fill="none" stroke={STONE} strokeWidth={4} transform={`rotate(${i % 2 ? -30 : 30} ${x} ${y})`} />;
          })}
        </svg>
      ) : null}
      {t > BR[1].start && t < outs[1] + 0.6 ? <div style={{ position: "absolute", right: 150, bottom: 470, ...mono(44, STONE) }}>03:12 AM</div> : null}
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 34%)" }} />
      {bare ? null : BR.map((l, i) => <HandLine key={l.id} t={t} l={l} out={outs[i]} />)}
      {bare ? null : <div style={{ position: "absolute", left: SAFE.left, top: 170, ...mono(20, STONE) }}>10 / BRIDGE — half-time</div>}
    </AbsoluteFill>
  );
};

// =============================================================================================
// OUTRO: back in the concrete room, now glowing. STILL GRINDING! Cut to black.
const OUT = linesOf("outro")[0];
const OUT_SEC = sectionById("outro");
const outCam = makeCam([
  { t: OUT_SEC.start, p: [0, 1.0, 5.2], l: [0, 0.75, 0], fov: 34 },
  { t: T.duration, p: [0, 0.9, 3.4], l: [0, 0.7, 0], fov: 34 },
]);
const OutroScene: React.FC<{ t: number; a: Assets }> = ({ t, a }) => {
  const { camera, gl } = useThree();
  const M = useMemo(
    () => ({
      body: contourMat({ pitch: 6.5 }),
      wall: contourMat({ pitch: 10, warp: 0.2, axis: [0, 1, 0], ink: "#a9a7a2" }),
      floor: contourMat({ pitch: 10, warp: 0.2, axis: [0.15, 0, 1], ink: "#a9a7a2" }),
    }),
    [],
  );
  const crack = useMemo(() => ({ geo: buildCrack(), mat: crackMat() }), []);
  useLayoutEffect(() => applyCam(camera, outCam(t)));
  gl.setClearColor("#000");
  const kick = kickEnv(t, 0.25);
  M.body.uniforms.uKey.value.set(0.0, 0.6, -0.8).normalize(); // lit from the glowing wall behind
  M.body.uniforms.uRim.value = 1.5;
  M.body.uniforms.uLevel.value = 0.95;
  M.wall.uniforms.uLevel.value = 0.55 + 0.25 * kick;
  M.floor.uniforms.uLevel.value = 0.45;
  crack.mat.uniforms.uTip.value = 400;
  crack.mat.uniforms.uGlow.value = 1.2 + 0.5 * kick;
  return (
    <>
      <mesh geometry={a.geo} material={M.body} />
      <mesh material={M.floor} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 2]}>
        <planeGeometry args={[8, 6]} />
      </mesh>
      <mesh material={M.wall} position={[0, 3, WALL_Z]}>
        <planeGeometry args={[8, 6]} />
      </mesh>
      <mesh geometry={crack.geo} material={crack.mat} position={[0, 0, WALL_Z + 0.004]} />
    </>
  );
};

export const Outro: React.FC<{ t: number; a: Assets | null; bare?: boolean }> = ({ t, a, bare }) => {
  const hit = t - OUT.start;
  const flashPhoto = (hit >= 0 && hit < 2 / 30) || (t > T.duration - 1.6 && t < T.duration - 1.6 + 3 / 30);
  const black = clamp01((t - (T.duration - 1.5)) / 0.4);
  const sz = 236;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {a ? (
        <ThreeCanvas width={W} height={H} style={{ position: "absolute", inset: 0 }} gl={{ antialias: true }}>
          <OutroScene t={t} a={a} />
        </ThreeCanvas>
      ) : null}
      {flashPhoto ? <Img src={staticFile("images/room.png")} style={{ position: "absolute", left: -575, top: -345, width: 1254 * 1.8, height: 1254 * 1.8, filter: "contrast(1.1) saturate(0.6)" }} /> : null}
      {!bare && hit >= 0 ? (
        <div style={{ position: "absolute", left: SAFE.left, top: 330, width: SAFE.right - SAFE.left, textAlign: "center" }}>
          {OUT.words.map((w, i) => {
            const dt = t - w.s;
            if (dt < 0) return null;
            const p = cubicOut(clamp01(dt / 0.09));
            return (
              <div key={i} style={{ fontFamily: F.grotesk, fontWeight: 900, fontSize: i ? sz * 0.82 : sz, lineHeight: 0.95, letterSpacing: "-0.03em", color: i ? STONE : INK, transform: `scale(${mix(1.5, 1, p)})`, textShadow: "0 18px 50px rgba(0,0,0,0.8)" }}>
                {w.w.toUpperCase()}
              </div>
            );
          })}
        </div>
      ) : null}
      {hit >= 0 && hit < 0.2 ? <AbsoluteFill style={{ background: `rgba(255,255,255,${0.8 * (1 - hit / 0.2)})` }} /> : null}
      {bare ? null : <div style={{ position: "absolute", left: SAFE.left, top: 170, ...mono(20, STONE) }}>13 / OUTRO — still grinding</div>}
      {black > 0 ? <AbsoluteFill style={{ background: `rgba(0,0,0,${black})` }} /> : null}
    </AbsoluteFill>
  );
};

