import React, { useMemo } from "react";
import { AbsoluteFill, Audio, staticFile, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import * as THREE from "three";
import { DROP, IntroScene, projectIntro, useIntroAssets } from "./Scene3D";
import { FPS, impactEnv, linesOf } from "../data";
import { SAFE, W, H } from "../theme";
import { F, ensureFonts } from "../utils/fonts";
import { fitSize, measure } from "../utils/measure";
import { clamp01, cubicOut, expoOut, mix } from "../utils/ease";
import { hash01, noise1, rng } from "../utils/random";
import { Vignette } from "../fx/Post";

ensureFonts();

/**
 * Intro, 0:00–0:29 — director's cut v2.
 * Picture: cinematic plates (Higgsfield) when present, else the cover photo as a stand-in.
 * Lyrics: crisp screen-space type, always inside the safe frame while sung, that physically
 * becomes the objects (shouted words crack and fall; the rubble rebuilds as the brick wall).
 */
const INK = "#efede9";
const STONE = "#c4b6a2";
const SAFE_W = SAFE.right - SAFE.left;
const CX = (SAFE.left + SAFE.right) / 2;
const FLOOR = 1470;

const [NOBODY, BUILT] = linesOf("intro");
const NOBODY_ROWS = [[0], [1, 2], [3]];
const FALL_AT = BUILT.start - 1.35; // the shout cracks and falls before the rebuild
const TITLE_IN = 11.6;


// ---------------------------------------------------------------------------------------------
type Glyph = { ch: string; x: number; y: number; size: number; word: number; accent: boolean };

/** Shouted line: justified rows of heavy type, each word slams on its sung time. */
const useNobodyGlyphs = () =>
  useMemo(() => {
    const words = NOBODY.words.map((w) => w.w.toUpperCase());
    const rowsTxt = NOBODY_ROWS.map((r) => r.map((i) => words[i]).join(" "));
    const sizes = rowsTxt.map((r) => Math.min(250, fitSize(r, F.grotesk, SAFE_W * 0.98, 250, 900, -0.02)));
    const lh = (s: number) => s * 0.93;
    const total = sizes.reduce((a, s) => a + lh(s), 0);
    let y = 330 + (620 - total) / 2;
    const glyphs: Glyph[] = [];
    NOBODY_ROWS.forEach((row, ri) => {
      const s = sizes[ri];
      const font = `900 ${s}px ${F.grotesk}`;
      const rowW = measure(rowsTxt[ri], font, -0.02);
      let x = CX - rowW / 2;
      row.forEach((wi, k) => {
        if (k > 0) x += measure(" ", font);
        for (const ch of words[wi]) {
          const cw = measure(ch, font) - 0.02 * s;
          glyphs.push({ ch, x, y, size: s, word: wi, accent: wi === words.length - 1 });
          x += cw;
        }
      });
      y += lh(s);
    });
    return glyphs;
  }, []);

const Nobody: React.FC<{ t: number }> = ({ t }) => {
  const glyphs = useNobodyGlyphs();
  const fall = useMemo(() => {
    const r = rng(41);
    return glyphs.map((g) => ({ delay: r() * 0.35, spin: (r() - 0.5) * 160, dx: (SAFE.left + 30 + r() * (SAFE_W - 140)) - g.x, bounce: 0.25 + r() * 0.3, floor: FLOOR + (r() - 0.5) * 70 }));
  }, [glyphs]);
  if (t < NOBODY.start - 0.02 || t > BUILT.start + 0.6) return null;
  return (
    <>
      {glyphs.map((g, i) => {
        const w = NOBODY.words[g.word];
        const dt = t - w.s;
        if (dt < 0) return null;
        // slam in
        const p = cubicOut(clamp01(dt / 0.09));
        const sc = mix(1.55, 1, p);
        // crack and fall
        const f = fall[i];
        const ft = t - FALL_AT - f.delay;
        let y = g.y, x = g.x, rot = 0, op = 1;
        if (ft > 0) {
          const T = Math.sqrt((2 * (f.floor - g.size - g.y)) / 4200);
          if (ft < T) {
            y = g.y + 0.5 * 4200 * ft * ft;
            x = g.x + f.dx * (ft / T);
            rot = f.spin * (ft / T);
          } else {
            const b = ft - T;
            y = f.floor - g.size - Math.abs(Math.sin(b * 14)) * 60 * f.bounce * Math.exp(-b * 5);
            x = g.x + f.dx;
            rot = f.spin;
          }
        }
        // the rubble is taken up by the rebuild
        if (t > BUILT.start) op = 1 - clamp01((t - BUILT.start) / 0.5);
        const fresh = dt < 0.06;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              fontFamily: F.grotesk,
              fontWeight: 900,
              fontSize: g.size,
              lineHeight: 1,
              letterSpacing: "-0.02em",
              color: fresh ? "#ffffff" : g.accent ? STONE : INK,
              transform: `scale(${sc}) rotate(${rot}deg)`,
              transformOrigin: "50% 60%",
              opacity: op,
              textShadow: "0 6px 0 rgba(0,0,0,0.35), 0 18px 40px rgba(0,0,0,0.65)",
              whiteSpace: "pre",
            }}
          >
            {g.ch}
          </div>
        );
      })}
    </>
  );
};

// ---------------------------------------------------------------------------------------------
const Title: React.FC<{ t: number; shatter: number }> = ({ t, shatter }) => {
  if (t < TITLE_IN || shatter >= 1) return null;
  const sp = 1 - shatter;
  return (
    <div style={{ position: "absolute", left: 0, top: 360, width: W, opacity: sp, transform: `scale(${1 + shatter * 0.4})` }}>
      <div style={{ display: "flex", justifyContent: "center", gap: 70 }}>
        {"RUDO".split("").map((ch, i) => {
          const p = cubicOut(clamp01((t - TITLE_IN - i * 0.16) / 1.0));
          return (
            <span key={ch} style={{ fontFamily: F.grotesk, fontWeight: 800, fontSize: 190, lineHeight: 1, color: INK, opacity: p, transform: `translateY(${(1 - p) * 30}px)`, filter: `blur(${(1 - p) * 8}px)`, textShadow: "0 16px 40px rgba(0,0,0,0.7)" }}>
              {ch}
            </span>
          );
        })}
      </div>
      <div style={{ marginTop: 26, textAlign: "center", fontFamily: F.grotesk, fontWeight: 500, fontSize: 34, letterSpacing: "0.5em", paddingLeft: "0.5em", color: STONE, opacity: cubicOut(clamp01((t - TITLE_IN - 0.9) / 0.9)) }}>
        SHOUT IT TO THE SKY
      </div>
    </div>
  );
};

/** Small, precise tracking HUD on RUDO (stand-in head position). */
const Tracker: React.FC<{ t: number }> = ({ t }) => {
  const on = clamp01((t - NOBODY.words[1].s) / 0.2) * (1 - clamp01((t - FALL_AT) / 0.3));
  const on2 = clamp01((t - 12.4) / 0.25) * (1 - clamp01((t - 16.6) / 0.3));
  const op = Math.max(on, on2);
  if (op <= 0) return null;
  const head = projectIntro(t, new THREE.Vector3(0, on2 > on ? 1.17 : 1.12, 0.14));
  if (!head) return null;
  const hx = head.x, hy = head.y, s = on2 > on ? 120 : 140;
  const conf = (0.11 + 0.08 * hash01(Math.floor(t * 6))).toFixed(2);
  const label = on2 > on ? ["EYES", "focus ... locked"] : ["SUBJ. RUDO", "handed ... 0.00"];
  return (
    <div style={{ position: "absolute", inset: 0, opacity: op }}>
      <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
        {[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy], i) => (
          <path key={i} d={`M${hx + sx * s} ${hy + sy * s - sy * 22} L${hx + sx * s} ${hy + sy * s} L${hx + sx * s - sx * 22} ${hy + sy * s}`} stroke={STONE} strokeWidth={3} fill="none" />
        ))}
        <path d={`M${hx + s} ${hy + s} L${hx + s + 60} ${hy + s + 70}`} stroke="rgba(239,237,233,0.5)" strokeWidth={2} />
      </svg>
      <div style={{ position: "absolute", left: hx + s + 68, top: hy + s + 56, fontFamily: F.mono, fontSize: 24, color: STONE, lineHeight: 1.35 }}>
        <div>{label[0]}</div>
        <div style={{ color: "rgba(239,237,233,0.6)", fontSize: 20 }}>{label[1]}</div>
        <div style={{ color: "rgba(239,237,233,0.45)", fontSize: 18 }}>conf {conf}</div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------------------------
export const Intro: React.FC<{ muted?: boolean }> = ({ muted }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const assets = useIntroAssets();
  const imp = impactEnv(t);
  const shake = Math.min(1.3, imp) * 16;
  const sx = (hash01(frame * 3) - 0.5) * 2 * shake;
  const sy = (hash01(frame * 3 + 1) - 0.5) * 2 * shake;
  const shatter = t > DROP ? clamp01((t - DROP) / 0.9) : 0;
  const flash = Math.min(0.4, imp * 0.2) + (t > DROP ? 0.8 * Math.exp(-(t - DROP) / 0.12) : 0);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill style={{ transform: `translate(${sx}px, ${sy}px)` }}>
        {assets ? (
          <ThreeCanvas width={W} height={H} gl={{ antialias: true }}>
            <IntroScene t={t} geo={assets.geo} font={assets.font} />
          </ThreeCanvas>
        ) : null}
        {/* legibility band behind the shout */}
        <AbsoluteFill style={{ background: `linear-gradient(180deg, rgba(0,0,0,${0.5 * clamp01((t - 4.4) / 0.3) * (1 - clamp01((t - 8) / 0.6))}) 0%, rgba(0,0,0,0) 50%)` }} />
        <Vignette strength={0.5} />
      </AbsoluteFill>
      <AbsoluteFill style={{ transform: `translate(${sx * 0.4}px, ${sy * 0.4}px)` }}>
        <Tracker t={t} />
        <Title t={t} shatter={shatter} />
        <Nobody t={t} />
      </AbsoluteFill>
      {flash > 0.01 ? <AbsoluteFill style={{ background: `rgba(255,255,255,${flash})` }} /> : null}
      {muted ? null : <Audio src={staticFile("audio/shout-it-to-the-sky.m4a")} />}
    </AbsoluteFill>
  );
};

export const INTRO_FRAMES = Math.round(29.2 * FPS);
