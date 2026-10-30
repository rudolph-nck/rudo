import React from "react";
import { AbsoluteFill } from "remotion";
import { Line, kickEnv, linesOf, sectionById } from "../data";
import { SAFE, W, H } from "../theme";
import { F } from "../utils/fonts";
import { clamp01, cubicIn, cubicOut, expoOut, mix } from "../utils/ease";
import { Caption, lineOut } from "../v3/LyricType";
import { Headline, HotLine, INK, MorphDefs, STONE } from "./Morph";

/**
 * Pre-chorus, metamorphosis cut. The hot line from "earned all that" becomes the first door.
 * Every sung word is a door drawn in light that slams and folds down into a stair; the staircase
 * builds itself in 3D while the camera rides up beside it. "Let me say it now!" stretches in tall,
 * squashes to a line, and the line shrinks to a single point of light: the silent beat.
 */
const RISE = 120, RUN = 190, SW = 720;
const mono = (size: number, color = INK): React.CSSProperties => ({ fontFamily: F.mono, fontSize: size, color, lineHeight: 1.3, whiteSpace: "pre" });
const sub = (l: Line, from: number, to?: number): Line => ({ ...l, words: l.words.slice(from, to), start: l.words[from].s });

const Step: React.FC<{ k: number; word: string; at: number; t: number; last: boolean }> = ({ k, word, at, t, last }) => {
  const dt = t - at;
  if (dt < -0.02) return null;
  // 0..0.1: the door is drawn standing up; 0.08..0.28: it slams and folds down flat
  const draw = clamp01(dt / 0.1);
  const fold = clamp01((dt - 0.08) / 0.2);
  const f = fold < 1 ? cubicIn(fold) : 1;
  const bounce = fold >= 1 ? Math.sin(Math.min(1, (dt - 0.28) / 0.12) * Math.PI) * 4 : 0;
  const hot = Math.exp(-Math.max(0, dt - 0.08) / 0.12);
  const fs = Math.min(92, (SW * 0.86) / Math.max(2, word.length * 0.42));
  return (
    <div style={{ position: "absolute", left: -SW / 2, top: 0, width: SW, height: 0, transformStyle: "preserve-3d", transform: `translate3d(0, ${-k * RISE}px, ${-k * RUN}px)` }}>
      {/* riser: grows up as the door comes down; carries the word */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: -RISE * f,
          width: SW,
          height: RISE * f,
          background: "linear-gradient(180deg, #1d1c1b 0%, #0c0c0c 100%)",
          borderTop: `2px solid rgba(239,237,233,${0.5 + 0.5 * hot})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          fontFamily: F.display,
          fontSize: fs,
          lineHeight: 1,
          color: last ? STONE : INK,
          textShadow: hot > 0.05 ? `0 0 ${30 * hot}px rgba(255,240,220,${hot})` : undefined,
        }}
      >
        {word}
      </div>
      {/* tread: hinged at its front edge; stands up as a door, then folds back flat */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: -RISE * f - RUN,
          width: SW,
          height: RUN,
          transformOrigin: "50% 100%",
          transform: `rotateX(${mix(0, 90, f) - bounce}deg)`,
          background: f < 1 ? "rgba(10,10,10,0.92)" : "linear-gradient(180deg, #8f8c87 0%, #4e4c48 100%)",
          border: `3px solid rgba(255,244,230,${mix(1, 0.35, f)})`,
          boxShadow: hot > 0.05 ? `0 0 ${50 * hot}px rgba(255,236,210,${0.6 * hot})` : undefined,
          backfaceVisibility: "visible",
        }}
      >
        {/* the door: panel lines + handle, drawn in light while it stands */}
        {f < 0.9 ? (
          <svg viewBox="0 0 720 190" width={SW} height={RUN} style={{ position: "absolute", left: 0, top: 0 }}>
            <path d="M40 170 V30 H320 V170 M400 170 V30 H680 V170" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - draw} stroke="#fff4e6" strokeWidth={5} fill="none" />
            <circle cx={360} cy={100} r={10} fill="#fff4e6" opacity={draw} />
          </svg>
        ) : null}
      </div>
    </div>
  );
};

/** "Every no they gave me got me right here": a giant NO, NOs raining, collapse, a pin drops. */
const NoPin: React.FC<{ t: number; line: Line; until: number }> = ({ t, line, until }) => {
  const W_ = line.words;
  if (t < line.start - 0.02 || t >= until) return null;
  const no = W_[1].s, rain = W_[2].s, got = W_[5].s, here = W_[8].s, right = W_[7].s;
  const slam = expoOut(clamp01((t - no) / 0.12));
  const rainP = clamp01((t - rain) / 0.5);
  const col = cubicIn(clamp01((t - got) / 0.28));
  const pinDrop = clamp01((t - right) / 0.22);
  const land = t - right - 0.22;
  const cx = W / 2, cy = H * 0.6;
  const r = (i: number, k: number) => ((Math.sin(i * 91.7 + k * 13.3) * 43758.5) % 1 + 1) % 1;
  return (
    <AbsoluteFill>
      {/* the big NO */}
      {t >= no && col < 1 ? (
        <div style={{ position: "absolute", left: 0, top: cy - 420, width: W, textAlign: "center", fontFamily: F.display, fontSize: 760, lineHeight: 1, color: INK, transform: `scale(${mix(1.8, 1, slam) * mix(1, 0.02, col)}) scaleY(${1.15})`, textShadow: "0 20px 60px rgba(0,0,0,0.8)", opacity: 1 - col }}>
          NO
        </div>
      ) : null}
      {/* every no they gave me: a rain of NOs */}
      {rainP > 0 && col < 1
        ? Array.from({ length: 44 }, (_, i) => {
            const d = clamp01(rainP * 1.6 - r(i, 1) * 0.6);
            if (d <= 0) return null;
            const x = 60 + r(i, 2) * (W - 120), y0 = -120, y1 = 300 + r(i, 3) * 1300;
            const x2 = mix(x, cx, col), y2 = mix(mix(y0, y1, cubicOut(d)), cy, col);
            return <div key={i} style={{ position: "absolute", left: x2 - 60, top: y2 - 40, fontFamily: F.display, fontSize: 60 + r(i, 4) * 70, color: r(i, 5) > 0.7 ? STONE : "rgba(239,237,233,0.75)", transform: `rotate(${(r(i, 6) - 0.5) * 50}deg) scale(${1 - col})` }}>NO</div>;
          })
        : null}
      {/* the collapse: everything becomes one point of light */}
      {col > 0.6 ? <div style={{ position: "absolute", left: cx - 14, top: cy - 14, width: 28, height: 28, borderRadius: 14, background: "#fff4e6", boxShadow: "0 0 40px 14px rgba(255,240,220,0.7)", opacity: 1 - pinDrop * 0.4 }} /> : null}
      {/* RIGHT HERE: the pin drops onto the point; rings ripple out */}
      {pinDrop > 0 ? (
        <>
          {land > 0
            ? [0, 0.12, 0.24].map((d, i) => {
                const a = clamp01((land - d) / 0.6);
                return a > 0 && a < 1 ? <div key={i} style={{ position: "absolute", left: cx - 300 * a, top: cy - 90 * a, width: 600 * a, height: 180 * a, borderRadius: "50%", border: `3px solid rgba(239,237,233,${1 - a})` }} /> : null;
              })
            : null}
          <svg viewBox="0 0 200 260" width={300} height={390} style={{ position: "absolute", left: cx - 150, top: cy - 390 - mix(900, 0, cubicIn(pinDrop)) + (land > 0 ? -Math.abs(Math.sin(land * 22)) * 30 * Math.exp(-land / 0.08) : 0), overflow: "visible" }}>
            <path d="M100 250 C60 180 20 140 20 95 A80 80 0 1 1 180 95 C180 140 140 180 100 250 Z" fill="url(#metal)" stroke="#fff4e6" strokeWidth={5} />
            <circle cx={100} cy={95} r={32} fill="#0b0b0c" stroke={INK} strokeWidth={4} />
          </svg>
          {t >= here ? (
            <div style={{ position: "absolute", left: 0, width: W, top: cy + 110, textAlign: "center" }}>
              <div style={{ fontFamily: F.display, fontSize: 200, color: STONE, lineHeight: 1, transform: `scaleY(${mix(1.8, 1, expoOut(clamp01((t - here) / 0.2)))})` }}>HERE</div>
              <div style={mono(26, "rgba(239,237,233,0.6)")}>you are here · 28.5383° N, 81.3792° W</div>
            </div>
          ) : null}
        </>
      ) : null}
    </AbsoluteFill>
  );
};

/** "Let me hear it, let me hear it": sound rings burst on each "hear it". */
const Rings: React.FC<{ t: number; line: Line; until: number }> = ({ t, line, until }) => {
  if (t < line.start - 0.02 || t > until + 0.3) return null;
  const hits = line.words.filter((w) => /hear|say|now/i.test(w.w)).map((w) => w.s);
  const cx = W / 2, cy = H * 0.62;
  const out = clamp01((t - until) / 0.25);
  return (
    <AbsoluteFill style={{ opacity: 1 - out }}>
      {/* the speaker */}
      <svg viewBox="0 0 200 200" width={300} height={300} style={{ position: "absolute", left: cx - 150, top: cy - 150, overflow: "visible" }}>
        <path d="M100 30 A70 70 0 1 1 99.9 30 M100 70 A30 30 0 1 1 99.9 70" stroke={INK} strokeWidth={6} fill="none" transform={`translate(100 100) scale(${1 + kickEnv(t, 0.1) * 0.12}) translate(-100 -100)`} />
      </svg>
      {hits.flatMap((h, hi) =>
        [0, 0.08, 0.16].map((d, i) => {
          const a = clamp01((t - h - d) / 0.55);
          if (a <= 0 || a >= 1) return null;
          const r = 150 + a * 700;
          return <div key={`${hi}-${i}`} style={{ position: "absolute", left: cx - r, top: cy - r, width: r * 2, height: r * 2, borderRadius: "50%", border: `${6 * (1 - a) + 1}px solid rgba(255,244,230,${1 - a})` }} />;
        }),
      )}
    </AbsoluteFill>
  );
};

export const PreChorusM: React.FC<{ t: number; id?: string; bare?: boolean }> = ({ t, id = "prechorus1", bare }) => {
  const sec = sectionById(id);
  const lines = linesOf(id);
  // stairs carry lines 1 and 3; line 2 is the NO + pin, line 4 the sound rings
  const words = [lines[0], lines[2]].flatMap((l) => l.words.map((w, i) => ({ w, last: i === l.words.length - 1 })));
  const showStairs = (t < lines[1].start - 0.02) || (t >= lines[2].start - 0.03 && t < lines[3].start - 0.02);
  const outs = lines.map((l, i) => lineOut(l, lines[i + 1], 0.8));
  const last = lines[lines.length - 1];
  const tall = sub(last, Math.max(0, last.words.length - 5));
  const squash = last.end - 0.05;
  // how far up the staircase the camera is: eased count of steps so far
  let k = 0;
  words.forEach(({ w }, i) => {
    if (t >= w.s) k = Math.max(k, i + cubicOut(clamp01((t - w.s) / 0.35)));
  });
  const n = words.length;
  const second = id === "prechorus2";
  // camera: pulled back 3/4 view; swings round as the climb goes on
  const yaw = mix(-34, second ? 26 : -12, clamp01(k / n));
  const pitch = mix(14, 24, clamp01(k / n));
  const zoom = mix(0.78, 0.58, clamp01(k / n));
  const hush = clamp01((t - squash - 0.25) / 0.12);
  const point = clamp01((t - squash - 0.2) / 0.15) * (1 - clamp01((t - sec.end + 0.02) / 0.05));
  const enter = clamp01((t - (sec.start + 0.9)) / 0.25);
  const kick = kickEnv(t, 0.12);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <MorphDefs />
      {/* the hot line from the last section, until the first door takes it */}
      <HotLine x0={SAFE.left - 60} x1={SAFE.right + 60} y={H * 0.48} o={1 - enter} />
      {showStairs ? (
      <AbsoluteFill style={{ perspective: 1500, perspectiveOrigin: "50% 45%", opacity: 1 - hush }}>
        <div
          style={{
            position: "absolute",
            left: W / 2,
            top: H * 0.6,
            transformStyle: "preserve-3d",
            transform: `scale(${zoom * (1 + kick * 0.015)}) rotateX(${pitch}deg) rotateY(${yaw}deg) translate3d(0, ${k * RISE}px, ${k * RUN}px)`,
          }}
        >
          {words.map(({ w, last: isLast }, i) => (
            <Step key={i} k={i} word={w.w.toUpperCase().replace(/[,!]/g, "")} at={w.s} t={t} last={isLast} />
          ))}
        </div>
      </AbsoluteFill>
      ) : null}
      <NoPin t={t} line={lines[1]} until={lines[2].start - 0.03} />
      <Rings t={t} line={lines[3]} until={squash} />
      {/* the second time round, light falls on the stairs from above */}
      {second ? <AbsoluteFill style={{ background: "radial-gradient(ellipse 70% 40% at 50% 0%, rgba(240,238,234,0.18) 0%, rgba(0,0,0,0) 100%)", mixBlendMode: "screen" }} /> : null}
      {/* LET ME SAY IT NOW! — tall, then squashed to a line, then to a point */}
      {!bare ? <Headline line={tall} t={t} squashAt={squash} y={H * 0.3} maxH={560} /> : null}
      <HotLine x0={mix(SAFE.left - 60, W / 2 - 4, point)} x1={mix(SAFE.right + 60, W / 2 + 4, point)} y={H * 0.3} o={clamp01((t - squash - 0.15) / 0.08) * (t < sec.end ? 1 : 0)} />
      {bare ? null : lines.map((l, i) => <Caption key={l.id} line={l} t={t} out={outs[i]} top={210} />)}
      {bare ? null : <div style={{ position: "absolute", left: SAFE.left, top: 170, ...mono(20, STONE) }}>{second ? "07 / PRE-CHORUS — another stair" : "03 / PRE-CHORUS — every door they closed"}</div>}
      {bare ? null : <div style={{ position: "absolute", right: 150, top: 170, ...mono(20, "rgba(239,237,233,0.5)") }}>{`step ${String(words.filter(({ w }) => w.s <= t).length).padStart(2, "0")}/${n}`}</div>}
    </AbsoluteFill>
  );
};

