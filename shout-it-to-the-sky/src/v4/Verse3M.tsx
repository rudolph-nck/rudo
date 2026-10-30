import React from "react";
import { AbsoluteFill } from "remotion";
import { Line, T, kickEnv, linesOf } from "../data";
import { SAFE, W, H } from "../theme";
import { F } from "../utils/fonts";
import { clamp01, cubicIn, cubicInOut, cubicOut, expoOut, mix } from "../utils/ease";
import { rng } from "../utils/random";
import { Caption, lineOut } from "../v3/LyricType";
import { Drawn, HOT, Headline, HotLine, INK, MorphDefs, STONE, multiply } from "./Morph";

/**
 * Verse 3, metamorphosis cut: midnight. The line becomes the roof of a quiet house; its light
 * goes out; the mic is drawn and the sound spills out of it; the wave breathes, flows, snaps
 * into ruled lines; the bars become bricks; tired eyes, a pen that won't stop and climbs;
 * L turns into a peak, peaks into a range; and the three lives stack up and fuse into one.
 */
const L = linesOf("verse3");
const END = linesOf("bridge")[0].words[0].s - 0.05;
const wd = (li: number, wi: number) => L[li].words[Math.min(wi, L[li].words.length - 1)].s;
const beatsIn = (a: number, b: number) => T.beats.filter((x) => x >= a && x < b);
const sub = (l: Line, from: number, to?: number): Line => ({ ...l, words: l.words.slice(from, to), start: l.words[from].s });
const mono = (size: number, color = INK): React.CSSProperties => ({ fontFamily: F.mono, fontSize: size, color, lineHeight: 1.3, whiteSpace: "pre" });
const CX = W / 2, CY = H * 0.56;
const from = (i: number) => L[i].start - 0.12;
const to = (i: number) => (L[i + 1] ? L[i + 1].start + 0.06 : END);
const exitOf = (t: number, i: number, dur = 0.16) => cubicIn(clamp01((t - to(i) + dur) / dur));

const Obj: React.FC<{ x: number; y: number; size: number; rot?: number; o?: number; style?: React.CSSProperties; children: React.ReactNode }> = ({ x, y, size, rot = 0, o = 1, style, children }) => (
  <svg viewBox="0 0 200 200" width={size} height={size} style={{ position: "absolute", left: x - size / 2, top: y - size / 2, overflow: "visible", transform: `rotate(${rot}deg)`, opacity: o, ...style }}>
    {children}
  </svg>
);

const HOUSE = "M28 188 V96 L100 28 L172 96 V188 Z";
const MIC = "M72 28 a28 28 0 0 1 56 0 v52 a28 28 0 0 1 -56 0 z M56 78 a44 44 0 0 0 88 0 M100 122 V170 M72 170 h56";
const EYE = "M14 100 Q100 34 186 100 Q100 166 14 100 Z";
const ELL = "M74 30 V160 H150";

/** A wave across the screen: amp (px), freq, phase; returns an SVG path. */
const wave = (y: number, amp: number, freq: number, ph: number, x0 = -40, x1 = W + 40, env = true) => {
  let d = "";
  for (let i = 0; i <= 120; i++) {
    const x = mix(x0, x1, i / 120);
    const e = env ? Math.sin((i / 120) * Math.PI) : 1;
    const v = Math.sin(x * freq + ph) * 0.7 + Math.sin(x * freq * 2.3 + ph * 1.7) * 0.3;
    d += `${i ? "L" : "M"}${x.toFixed(1)} ${(y + v * amp * e).toFixed(1)} `;
  }
  return d;
};

// ---------------------------------------------------------------------------------------------
/** 0. the line folds into a roof; the house at night; its light goes out on STILL. */
const Quiet: React.FC<{ t: number }> = ({ t }) => {
  if (t > to(0)) return null;
  const s0 = from(0) - 0.25;
  const draw = clamp01((t - s0) / 0.6);
  const lightOff = t > wd(0, 10);
  const ex = exitOf(t, 0);
  const stars = rng(8);
  return (
    <AbsoluteFill style={{ opacity: 1 - ex }}>
      <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
        {Array.from({ length: 40 }, (_, i) => <circle key={i} cx={stars() * W} cy={stars() * H * 0.45} r={2} fill={INK} opacity={clamp01((t - wd(0, 3)) / 0.4) * (0.4 + 0.4 * Math.sin(t * 2 + i))} />)}
      </svg>
      <Obj x={CX} y={CY} size={620}>
        <Drawn d={HOUSE} p={draw} fill={clamp01((t - wd(0, 4)) / 0.3)} w={4} />
        <rect x={86} y={112} width={28} height={28} fill={lightOff ? "#111" : "rgba(255,232,196,0.9)"} opacity={clamp01((t - wd(0, 7)) / 0.2)} style={{ filter: lightOff ? "none" : "drop-shadow(0 0 14px rgba(255,230,190,0.9))" }} />
      </Obj>
      {lightOff ? <div style={{ position: "absolute", left: 0, width: W, top: H * 0.82, textAlign: "center", ...mono(28, "rgba(239,237,233,0.5)") }}>11:58 PM</div> : null}
    </AbsoluteFill>
  );
};

/** 1–2. the mic is drawn; on SPILL the sound pours out; it breathes, then flows. */
const Mic: React.FC<{ t: number }> = ({ t }) => {
  if (t < from(1) || t > to(2)) return null;
  const draw = clamp01((t - from(1)) / 0.45);
  const spill = clamp01((t - wd(1, 8)) / 0.5);
  const breathe = t > wd(2, 0) ? 0.5 + 0.5 * Math.sin((t - wd(2, 0)) * 5) : 0;
  const flow = clamp01((t - wd(2, 5)) / 0.4);
  const ex = exitOf(t, 2);
  const kick = kickEnv(t, 0.15);
  return (
    <AbsoluteFill style={{ opacity: 1 - ex }}>
      <Obj x={CX} y={H * 0.42} size={mix(560, 380, spill)}>
        <Drawn d={MIC} p={draw} fill={clamp01((t - wd(1, 3)) / 0.25)} w={5} />
        {draw > 0.4 ? Array.from({ length: 5 }, (_, i) => <line key={i} x1={78} x2={122} y1={40 + i * 10} y2={40 + i * 10} stroke={INK} strokeWidth={1.5} opacity={0.6 * draw} />) : null}
      </Obj>
      {spill > 0 ? (
        <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
          {Array.from({ length: 7 }, (_, i) => {
            const y = mix(H * 0.42, H * 0.58 + (i - 3) * 70, spill);
            const amp = (40 + i * 6) * (0.4 + breathe * 0.9 + kick * 0.5) * mix(1, 0.8, flow);
            const ph = t * mix(2, 9, flow) + i * 0.6;
            const x0 = mix(CX - 30, -40, spill), x1 = mix(CX + 30, W + 40, spill);
            return <path key={i} d={wave(y, amp, 0.012 + i * 0.001, ph, x0, x1)} fill="none" stroke={i === 3 ? HOT : i % 2 ? STONE : INK} strokeWidth={i === 3 ? 5 : 2.5} opacity={1 - Math.abs(i - 3) * 0.12} />;
          })}
        </svg>
      ) : null}
    </AbsoluteFill>
  );
};

/** 3–4. the waves snap flat into ruled lines; words fire across them fast, then pull into focus. */
const Ruled: React.FC<{ t: number }> = ({ t }) => {
  if (t < from(3) || t > to(4)) return null;
  const snap = expoOut(clamp01((t - wd(3, 0)) / 0.25));
  const rows = 9;
  const fast = t > wd(4, 0) - 0.05;
  const clear = cubicOut(clamp01((t - wd(4, 8) + 0.1) / 0.3));
  const ex = exitOf(t, 4);
  const bars = ["clock out at five", "every stud every line", "pull the nails", "average is a cage", "built to last", "no time to wait", "every scar every night", "came up from the floor", "let me say it now"];
  return (
    <AbsoluteFill style={{ opacity: 1 - ex }}>
      <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
        {Array.from({ length: rows }, (_, i) => {
          const y = H * 0.36 + i * 100;
          const lit = clamp01((t - wd(3, Math.min(i, 7)) ) / 0.12);
          return <path key={i} d={wave(y, 50 * (1 - snap), 0.014, t * 6 + i, -40, W + 40)} fill="none" stroke={lit > 0 && snap > 0.9 ? INK : STONE} strokeWidth={2.5} opacity={0.5 + lit * 0.5} />;
        })}
        <line x1={SAFE.left + 40} x2={SAFE.left + 40} y1={H * 0.32} y2={H * 0.32 + rows * 100} stroke={STONE} strokeWidth={2} opacity={snap} />
      </svg>
      {fast
        ? bars.map((b, i) => {
            const at = wd(4, 0) + i * 0.08;
            const p = clamp01((t - at) / 0.18);
            if (p <= 0) return null;
            const n = Math.floor(p * b.length);
            return (
              <div key={i} style={{ position: "absolute", left: SAFE.left + 60, top: H * 0.36 + i * 100 - 52, ...mono(44, i % 3 === 0 ? STONE : INK), filter: `blur(${(1 - clear) * 6}px)`, transform: `translateX(${(1 - clear) * (i % 2 ? 30 : -30)}px)` }}>
                {b.slice(0, n).toUpperCase()}
              </div>
            );
          })
        : null}
    </AbsoluteFill>
  );
};

/** 5. every bar's a brick: the ruled lines lift into a wall, brick by brick, on the beat. */
const Bricks: React.FC<{ t: number }> = ({ t }) => {
  if (t < from(5) || t > to(5)) return null;
  const rows = 9, cols = 4, bw = 230, bh = 92;
  const ex = exitOf(t, 5);
  const span = to(5) - wd(5, 0) - 0.15;
  const words = L.slice(0, 5).flatMap((l) => l.words.map((w) => w.w.replace(/[^a-z']/gi, "").toUpperCase()));
  return (
    <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0, opacity: 1 - ex }}>
      {Array.from({ length: rows * cols }, (_, i) => {
        const r = Math.floor(i / cols), c = i % cols;
        const at = wd(5, 0) + (i / (rows * cols)) * span;
        const p = expoOut(clamp01((t - at) / 0.16));
        if (p <= 0) return null;
        const x = CX - (cols * bw) / 2 + c * bw + (r % 2 ? bw / 2 : 0) - bw / 4, y = H * 0.82 - (r + 1) * bh;
        return (
          <g key={i} transform={`translate(0 ${(1 - p) * -300})`} opacity={p}>
            <rect x={x + 4} y={y + 4} width={bw - 8} height={bh - 8} rx={4} fill="#151413" stroke={p < 1 ? HOT : INK} strokeWidth={2.5} />
            <text x={x + bw / 2} y={y + bh / 2 + 12} textAnchor="middle" fontFamily="Bebas Neue" fontSize={36} fill={i % 5 === 0 ? STONE : INK}>
              {words[i % words.length]}
            </text>
          </g>
        );
      })}
      {t > wd(5, 9) ? <text x={CX} y={H * 0.82 + 70} textAnchor="middle" fontFamily="IBM Plex Mono" fontSize={30} fill={STONE}>{`${2016}–${2025} · ${Math.round(clamp01((t - wd(5, 9)) / 0.3) * 412)} BARS`}</text> : null}
    </svg>
  );
};

/** 6–7. tired eyes, lids heavy; the pen line under them never stops, and climbs to the top. */
const Eyes: React.FC<{ t: number }> = ({ t }) => {
  if (t < from(6) || t > to(7)) return null;
  const draw = clamp01((t - from(6)) / 0.35);
  const lid = 0.35 + 0.35 * Math.max(0, Math.sin((t - wd(6, 0)) * 7)) * (t < wd(7, 0) ? 1 : 0);
  const eyesOut = cubicIn(clamp01((t - wd(7, 0) + 0.05) / 0.25));
  const penP = clamp01((t - wd(6, 3)) / (to(7) - wd(6, 3)));
  const climb = cubicInOut(clamp01((t - wd(7, 5)) / (wd(7, 9) - wd(7, 5) + 0.15)));
  const ex = exitOf(t, 7);
  // pen trace: scribble along the bottom, then a stair up to the top
  const pts: [number, number][] = [];
  const N = 160;
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const x = mix(-20, W + 20, u);
    const scrib = Math.sin(u * 90) * 22 + Math.sin(u * 37) * 14;
    const stair = Math.floor(u * 8) / 8;
    const y = mix(H * 0.78 + scrib, mix(H * 0.82, H * 0.3, stair), climb);
    pts.push([x, y]);
  }
  const n = Math.max(2, Math.floor(penP * N));
  const d = pts.slice(0, n).map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const head = pts[n - 1];
  return (
    <AbsoluteFill style={{ opacity: 1 - ex }}>
      {eyesOut < 1
        ? [-1, 1].map((sd) => (
            <Obj key={sd} x={CX + sd * 230} y={H * 0.46} size={400} o={1 - eyesOut}>
              <Drawn d={EYE} p={draw} fill={clamp01((t - wd(6, 1)) / 0.2)} w={4} />
              <circle cx={100} cy={100} r={26} fill="url(#metal)" opacity={draw} />
              <circle cx={100} cy={100} r={10} fill="#000" opacity={draw} />
              {/* lid */}
              <rect x={0} y={20} width={200} height={80 * lid * 2} fill="#000" />
              <path d={`M14 ${20 + 80 * lid * 2} Q100 ${20 + 80 * lid * 2 + 10} 186 ${20 + 80 * lid * 2}`} stroke={INK} strokeWidth={4} fill="none" />
            </Obj>
          ))
        : null}
      {t > wd(7, 0) && t < wd(7, 5) ? (
        <div style={{ position: "absolute", left: 0, width: W, top: H * 0.38, textAlign: "center", fontFamily: F.display, fontSize: 220, color: INK, transform: `scaleY(1.5)` }}>
          {t < wd(7, 2) ? "NO SLEEP" : "NO BREAKS"}
          <div style={{ ...mono(40, STONE), transform: "scaleY(0.67)" }}>{`03:${String(40 + Math.floor((t - wd(7, 0)) * 20)).padStart(2, "0")} AM`}</div>
        </div>
      ) : null}
      <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
        <path d={d} fill="none" stroke="rgba(255,236,210,0.4)" strokeWidth={14} filter="url(#soft)" />
        <path d={d} fill="none" stroke={INK} strokeWidth={5} strokeLinejoin="round" />
        <circle cx={head[0]} cy={head[1]} r={28} fill="url(#hot)" />
        {/* the pen nib */}
        <path d={`M${head[0]} ${head[1]} l20 -60 l14 6 z`} fill="url(#metal)" />
        {climb > 0.95 ? <text x={W - 120} y={H * 0.3 - 30} textAnchor="end" fontFamily="Bebas Neue" fontSize={90} fill={STONE}>TOP</text> : null}
      </svg>
    </AbsoluteFill>
  );
};

/** 8. LAST WEEK vs THIS WEEK: the new bar shoots past the old one. */
const Weeks: React.FC<{ t: number }> = ({ t }) => {
  if (t < from(8) || t > to(8)) return null;
  const days = 7;
  const ex = exitOf(t, 8);
  const old = cubicOut(clamp01((t - wd(8, 4)) / 0.3));
  const nw = expoOut(clamp01((t - wd(8, 7)) / 0.35));
  return (
    <AbsoluteFill style={{ opacity: 1 - ex }}>
      <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
        {Array.from({ length: days }, (_, i) => {
          const p = clamp01((t - wd(8, 0) - i * 0.06) / 0.15);
          const x = CX - days * 65 + i * 130;
          return (
            <g key={i} opacity={p}>
              <rect x={x + 6} y={H * 0.33} width={118} height={118} rx={8} fill="#111" stroke={INK} strokeWidth={2.5} />
              <text x={x + 65} y={H * 0.33 + 72} textAnchor="middle" fontFamily="IBM Plex Mono" fontSize={26} fill={STONE}>{"MTWTFSS"[i]}</text>
              <text x={x + 65} y={H * 0.33 + 104} textAnchor="middle" fontFamily="IBM Plex Mono" fontSize={18} fill={INK}>+1</text>
            </g>
          );
        })}
        <rect x={CX - 260} y={H * 0.82 - 300 * old} width={200} height={300 * old} fill="#2a2926" stroke={INK} strokeWidth={3} />
        <rect x={CX + 60} y={H * 0.82 - 560 * nw} width={200} height={560 * nw} fill="url(#metal)" />
        <text x={CX - 160} y={H * 0.82 + 50} textAnchor="middle" fontFamily="IBM Plex Mono" fontSize={26} fill={INK} opacity={old}>LAST WEEK</text>
        <text x={CX + 160} y={H * 0.82 + 50} textAnchor="middle" fontFamily="IBM Plex Mono" fontSize={26} fill={STONE} opacity={nw}>THIS WEEK</text>
      </svg>
    </AbsoluteFill>
  );
};

/** 9. an L is drawn; it turns 135° into a peak; the peaks multiply into a range. */
const Peaks: React.FC<{ t: number }> = ({ t }) => {
  if (t < from(9) || t > to(9)) return null;
  const draw = clamp01((t - wd(9, 0)) / 0.3);
  const turn = cubicInOut(clamp01((t - wd(9, 3) + 0.1) / 0.35));
  const pb = beatsIn(wd(9, 5) - 0.1, to(9));
  const m = multiply(t, pb.slice(0, 2), [1, 5, 13]);
  const ex = exitOf(t, 9);
  return (
    <AbsoluteFill style={{ opacity: 1 - ex }}>
      {t < wd(9, 3) ? <div style={{ position: "absolute", left: 0, width: W, top: H * 0.78, textAlign: "center", ...mono(32, STONE) }}>L = LOSS</div> : null}
      {t > wd(9, 4) ? <div style={{ position: "absolute", left: 0, width: W, top: H * 0.78, textAlign: "center", ...mono(32, STONE) }}>L = LESSON → PEAK</div> : null}
      {Array.from({ length: m.cur }, (_, i) => {
        const k = i === 0 ? 0 : i;
        const side = k % 2 ? -1 : 1;
        const rank = Math.ceil(k / 2);
        const x = CX + side * rank * mix(0, 150, m.p) * (i === 0 ? 0 : 1);
        const size = i === 0 ? mix(620, 520, m.cur > 1 ? m.p : 0) : mix(520, 520 - rank * 55, m.p);
        const y = H * 0.5 + (i === 0 ? 0 : rank * 34 * m.p);
        return (
          <Obj key={i} x={x} y={y} size={size} rot={mix(0, 135, turn)} o={i === 0 ? 1 : m.p * (1 - rank * 0.08)}>
            <Drawn d={ELL} p={i === 0 ? draw : 1} fill={clamp01((t - wd(9, 2)) / 0.25)} w={9} />
          </Obj>
        );
      })}
    </AbsoluteFill>
  );
};

/** 10–11. the three lives stack up as live bands, then fuse into one hustle; NO RUST shines. */
const Lives: React.FC<{ t: number; renderAt?: (src: number) => React.ReactNode }> = ({ t, renderAt }) => {
  if (t < from(10) || !renderAt) return null;
  const at = [wd(10, 0), wd(10, 4), wd(11, 2)];
  const src = [31.0, 116.4, 165.2];
  const labels = ["IT · BY DAY", "FLIPS · BY DUSK", "MIC · BY MIDNIGHT"];
  const fuse = cubicInOut(clamp01((t - wd(11, 5)) / 0.4));
  const rust = clamp01((t - wd(11, 7)) / 0.2);
  const sq = cubicIn(clamp01((t - END + 0.3) / 0.22));
  const bandH = 470, top0 = 250;
  return (
    <AbsoluteFill style={{ transform: `scaleY(${mix(1, 0.01, sq)})`, transformOrigin: `50% ${H * 0.5}px` }}>
      {at.map((a, i) => {
        const p = expoOut(clamp01((t - a + 0.05) / 0.22));
        if (p <= 0) return null;
        const y = mix(top0 + i * (bandH + 14), H * 0.5 - bandH / 2, fuse);
        return (
          <div key={i} style={{ position: "absolute", left: mix(W, 0, p), top: y, width: W, height: bandH, overflow: "hidden", borderTop: `3px solid ${STONE}`, borderBottom: `3px solid ${STONE}`, opacity: fuse > 0 ? mix(1, i === 2 ? 1 : 0.34, fuse) : 1, mixBlendMode: fuse > 0 ? "screen" : "normal" }}>
            <div style={{ position: "absolute", left: 0, top: -(H * 0.56 - bandH / 2), width: W, height: H }}>{renderAt(src[i] + (t - a) * 0.25)}</div>
            <div style={{ position: "absolute", left: SAFE.left, top: 16, ...mono(24, STONE), opacity: 1 - fuse }}>{labels[i]}</div>
          </div>
        );
      })}
      {fuse > 0 ? (
        <div style={{ position: "absolute", left: 0, width: W, top: H * 0.5 - bandH / 2 - 120, textAlign: "center", fontFamily: F.display, fontSize: 110, color: INK, opacity: fuse, transform: `scaleY(1.5)` }}>
          3 LIVES · 1 HUSTLE
        </div>
      ) : null}
      {rust > 0 ? (
        <div style={{ position: "absolute", left: 0, width: W, top: H * 0.5 + bandH / 2 + 30, textAlign: "center", fontFamily: F.display, fontSize: 200, color: STONE, transform: `scaleY(${mix(2, 1.4, rust)})`, textShadow: `0 0 ${40 * rust}px rgba(255,236,210,0.8)` }}>
          NO RUST
        </div>
      ) : null}
      {rust > 0 ? <div style={{ position: "absolute", left: mix(-400, W + 200, clamp01((t - wd(11, 7)) / 0.4)), top: H * 0.5 + bandH / 2, width: 200, height: 300, background: "linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.6), rgba(255,255,255,0))", transform: "skewX(-20deg)" }} /> : null}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------------------------
export const Verse3M: React.FC<{ t: number; bare?: boolean; renderAt?: (src: number) => React.ReactNode }> = ({ t, bare, renderAt }) => {
  const outs = L.map((l, i) => lineOut(l, L[i + 1], 1.0));
  const hl = clamp01((t - END + 0.1) / 0.08);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <MorphDefs />
      <Quiet t={t} />
      <Mic t={t} />
      <Ruled t={t} />
      <Bricks t={t} />
      <Eyes t={t} />
      <Weeks t={t} />
      <Peaks t={t} />
      {bare ? null : <Lives t={t} renderAt={renderAt} />}
      {bare ? null : (
        <>
          <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0) 20%)" }} />
          <Headline line={sub(L[1], 0, 4)} t={t} squashAt={wd(1, 4) + 0.15} y={H * 0.2} maxH={260} color={(w) => (/mic/i.test(w) ? STONE : null)} />
          <Headline line={L[5]} t={t} squashAt={to(5) - 0.25} y={H * 0.2} maxH={220} color={(w) => (/brick/i.test(w) ? STONE : null)} />
          <Headline line={sub(L[9], 0, 4)} t={t} squashAt={wd(9, 4) - 0.05} y={H * 0.2} maxH={300} color={(w) => (/^l$/i.test(w) ? STONE : null)} />
          {L.map((l, i) => (
            <Caption key={l.id} line={l} t={t} out={outs[i]} top={210} />
          ))}
          <div style={{ position: "absolute", left: SAFE.left, top: 170, ...mono(20, STONE) }}>09 / VERSE 3 — midnight</div>
        </>
      )}
      <HotLine x0={SAFE.left - 60} x1={SAFE.right + 60} y={H * 0.5} o={hl} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 85% 65% at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.7) 100%)", pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};


