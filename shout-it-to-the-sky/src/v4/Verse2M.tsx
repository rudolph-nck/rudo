import React from "react";
import { AbsoluteFill } from "remotion";
import { Line, T, kickEnv, linesOf, sectionById } from "../data";
import { SAFE, W, H } from "../theme";
import { F } from "../utils/fonts";
import { clamp01, cubicIn, cubicInOut, cubicOut, expoOut, mix } from "../utils/ease";
import { hash01, rng } from "../utils/random";
import { Caption, lineOut } from "../v3/LyricType";
import { Drawn, Field, HOT, Headline, HotLine, INK, MorphDefs, STONE, gridLayout, multiply } from "./Morph";

/**
 * Verse 2, metamorphosis cut: the flip. The hot line becomes a clock that never stops; the clock
 * becomes the house; the house is gutted, framed, hung, mudded, tiled, brought back to life;
 * then the money: the red balance, dollars poured into the walls, a card stretched to a line,
 * the after-pic and the receipt behind it; and every house he flips stacks into a stair.
 */
const SEC = sectionById("verse2");
const L = linesOf("verse2");
/** hand-off: the first sung word of pre-chorus 2 */
const END = linesOf("prechorus2")[0].words[0].s - 0.05;
const RED = "#e5483b";
const wd = (li: number, wi: number) => L[li].words[Math.min(wi, L[li].words.length - 1)].s;
const beatsIn = (a: number, b: number) => T.beats.filter((x) => x >= a && x < b);
const sub = (l: Line, from: number, to?: number): Line => ({ ...l, words: l.words.slice(from, to), start: l.words[from].s });
const mono = (size: number, color = INK): React.CSSProperties => ({ fontFamily: F.mono, fontSize: size, color, lineHeight: 1.3, whiteSpace: "pre" });
const CX = W / 2, CY = H * 0.56;
/** Window for line i: from just before it is sung to just after the next line starts. */
const from = (i: number) => L[i].start - 0.12;
const to = (i: number) => (L[i + 1] ? L[i + 1].start + 0.06 : END);
const exitOf = (t: number, i: number, dur = 0.16) => cubicIn(clamp01((t - to(i) + dur) / dur));

const Obj: React.FC<{ x: number; y: number; size: number; rot?: number; o?: number; style?: React.CSSProperties; children: React.ReactNode }> = ({ x, y, size, rot = 0, o = 1, style, children }) => (
  <svg viewBox="0 0 200 200" width={size} height={size} style={{ position: "absolute", left: x - size / 2, top: y - size / 2, overflow: "visible", transform: `rotate(${rot}deg)`, opacity: o, ...style }}>
    {children}
  </svg>
);

// shapes (viewBox 0 0 200 200)
const CLOCK = "M100 22 A78 78 0 1 1 99.9 22";
const HOUSE = "M28 188 V96 L100 28 L172 96 V188 Z";
const DOOR = "M86 188 V138 H114 V188";
const WIN_A = "M44 110 h30 v28 h-30 z";
const WIN_B = "M126 110 h30 v28 h-30 z";
const HAMMER = "M100 196 L100 66 M58 30 h84 v38 h-84 z";
const CARD = "M22 52 h156 a12 12 0 0 1 12 12 v72 a12 12 0 0 1 -12 12 h-156 a12 12 0 0 1 -12 -12 v-72 a12 12 0 0 1 12 -12 z M10 80 h180 M28 120 h40";
const PHONE = "M60 8 h80 a16 16 0 0 1 16 16 v152 a16 16 0 0 1 -16 16 h-80 a16 16 0 0 1 -16 -16 v-152 a16 16 0 0 1 16 -16 z M86 22 h28";
const TROWEL = "M30 130 L170 130 L150 160 L50 160 Z M100 130 L100 84 M86 84 h28";

// ---------------------------------------------------------------------------------------------
/** 0. the hot line wraps into a clock; it hits five; it never stops. */
const ClockOut: React.FC<{ t: number }> = ({ t }) => {
  if (t > to(0)) return null;
  const draw = clamp01((t - SEC.start - 0.1) / 0.75);
  const fill = clamp01((t - wd(0, 0)) / 0.3);
  // hands: run to 5:00 on "five", then spin faster and faster on "never clock out"
  const toFive = cubicOut(clamp01((t - wd(0, 0)) / (wd(0, 3) - wd(0, 0) + 0.1)));
  const spin = Math.max(0, t - wd(0, 6)) ** 2 * 900;
  const hour = mix(0, 150, toFive) + spin / 12, min = mix(0, 0, toFive) + spin;
  const m = multiply(t, beatsIn(wd(0, 6), to(0)).slice(0, 2), [1, 3, 9]);
  const ex = exitOf(t, 0);
  const lineIn = 1 - clamp01((t - SEC.start) / 0.35);
  return (
    <>
      <HotLine x0={mix(SAFE.left - 60, CX - 4, 1 - lineIn)} x1={mix(SAFE.right + 60, CX + 4, 1 - lineIn)} y={H * 0.5} o={lineIn} />
      {gridLayout(m.cur, mix(0, 330, m.p), m.cur === 1 ? 1 : 3).map((p, i) => (
        <Obj key={i} x={CX + p.x} y={CY + p.y} size={(m.cur === 1 ? 560 : 300) * (1 - ex * 0.3)} o={(i === 0 ? 1 : m.p) * (1 - ex)}>
          <Drawn d={CLOCK} p={i === 0 ? draw : 1} fill={fill} w={5} />
          {Array.from({ length: 12 }, (_, k) => {
            const a = (k / 12) * Math.PI * 2;
            return <line key={k} x1={100 + Math.cos(a) * 62} y1={100 + Math.sin(a) * 62} x2={100 + Math.cos(a) * 70} y2={100 + Math.sin(a) * 70} stroke={INK} strokeWidth={3} opacity={fill} />;
          })}
          <line x1={100} y1={100} x2={100} y2={58} stroke={INK} strokeWidth={7} strokeLinecap="round" transform={`rotate(${hour + i * 40} 100 100)`} opacity={fill} />
          <line x1={100} y1={100} x2={100} y2={40} stroke={STONE} strokeWidth={4} strokeLinecap="round" transform={`rotate(${min + i * 70} 100 100)`} opacity={fill} />
          {i === 0 && t > wd(0, 3) && t < wd(0, 6) ? <text x={100} y={150} textAnchor="middle" fill={STONE} fontFamily="IBM Plex Mono" fontSize={16}>17:00</text> : null}
        </Obj>
      ))}
    </>
  );
};

/** 1. the clock face folds into the house; FLIP turns it over; the gut tears out. */
const House: React.FC<{ t: number }> = ({ t }) => {
  if (t < from(1) || t > to(1)) return null;
  const draw = clamp01((t - from(1)) / 0.4);
  const flip = cubicInOut(clamp01((t - wd(1, 4) + 0.05) / 0.3));
  const tear = clamp01((t - wd(1, 8)) / 0.45);
  const ex = exitOf(t, 1);
  const parts = [DOOR, WIN_A, WIN_B];
  return (
    <AbsoluteFill style={{ perspective: 1400 }}>
      <AbsoluteFill style={{ transform: `rotateY(${flip * 360}deg) scale(${1 - ex * 0.2})`, opacity: 1 - ex }}>
        <Obj x={CX} y={CY} size={640}>
          <Drawn d={HOUSE} p={draw} fill={clamp01((t - wd(1, 2)) / 0.25)} w={5} />
          {parts.map((d, i) => {
            const r = rng(i + 3);
            const g = tear;
            const dx = (r() - 0.5) * 900 * g, dy = (-200 - r() * 300) * g + 1400 * g * g, rot = (r() - 0.5) * 540 * g;
            return (
              <g key={i} transform={`translate(${dx * 0.3} ${dy * 0.3}) rotate(${rot} 100 130)`} opacity={1 - clamp01((g - 0.6) / 0.4)}>
                <Drawn d={d} p={clamp01(draw * 1.5 - 0.5)} fill={clamp01((t - wd(1, 2)) / 0.25)} w={4} />
              </g>
            );
          })}
        </Obj>
      </AbsoluteFill>
      {t > wd(1, 7) ? <div style={{ position: "absolute", left: 0, width: W, top: H * 0.82, textAlign: "center", ...mono(30, STONE), opacity: 1 - ex }}>{`GUT REHAB · ${tear > 0 ? "DEMO " + Math.round(tear * 100) + "%" : "1924"}`}</div> : null}
    </AbsoluteFill>
  );
};

/** 2. floor planks rip up, nails pop, the tile cracks and drops out. */
const Demo: React.FC<{ t: number }> = ({ t }) => {
  if (t < from(2) || t > to(2)) return null;
  const tilt = cubicOut(clamp01((t - from(2)) / 0.3));
  const ex = exitOf(t, 2);
  const planks = 12;
  return (
    <Field tilt={mix(20, 62, tilt)} z={-200} originY={62}>
      <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", opacity: 1 - ex }}>
        {/* planks */}
        {Array.from({ length: planks }, (_, i) => {
          const at = wd(2, 0) + i * 0.025;
          const up = cubicOut(clamp01((t - at) / 0.3));
          const y = H * 0.36 + i * 70;
          const gone = t > wd(2, 7);
          return gone ? null : (
            <g key={i} transform={`translate(0 ${-up * 160 * (i % 2 ? 1 : 0.6)}) rotate(${up * (i % 2 ? -8 : 6)} ${CX} ${y})`}>
              <rect x={SAFE.left - 160} y={y} width={SAFE.right - SAFE.left + 320} height={60} fill="#0d0d0e" stroke={INK} strokeWidth={3} />
              {/* nails */}
              {[0.15, 0.5, 0.85].map((k, j) => {
                const pop = clamp01((t - wd(2, 4) - (i + j) * 0.015) / 0.25);
                return <line key={j} x1={SAFE.left - 160 + k * (SAFE.right - SAFE.left + 320)} y1={y + 30} x2={SAFE.left - 160 + k * (SAFE.right - SAFE.left + 320)} y2={y + 30 - pop * 70 - (pop > 0 ? 6 : 0)} stroke={pop > 0 ? HOT : INK} strokeWidth={5} strokeLinecap="round" />;
              })}
            </g>
          );
        })}
        {/* the tile underneath: cracks run, then the tiles fall away */}
        {t > wd(2, 7) - 0.05
          ? Array.from({ length: 6 * 9 }, (_, i) => {
              const c = i % 6, r = Math.floor(i / 6);
              const x = CX - 3 * 150 + c * 150, y = H * 0.3 + r * 150;
              const crack = clamp01((t - wd(2, 7)) / 0.25);
              const drop = clamp01((t - wd(2, 9) - hash01(i) * 0.2) / 0.35);
              return (
                <g key={i} transform={`translate(0 ${drop * drop * 900}) rotate(${drop * (hash01(i + 9) - 0.5) * 60} ${x + 75} ${y + 75})`} opacity={1 - drop}>
                  <rect x={x + 3} y={y + 3} width={144} height={144} fill="#121212" stroke={INK} strokeWidth={2.5} />
                  <path d={`M${x + 75} ${y + 75} L${x + 75 + (hash01(i) - 0.5) * 150 * crack} ${y + 75 + (hash01(i + 1) - 0.5) * 150 * crack}`} stroke={HOT} strokeWidth={3} />
                </g>
              );
            })
          : null}
      </svg>
    </Field>
  );
};

/** 3. the sledgehammer swings on the kicks; each hit cracks the frame. */
const Sledge: React.FC<{ t: number }> = ({ t }) => {
  if (t < from(3) || t > to(3)) return null;
  const draw = clamp01((t - from(3)) / 0.35);
  const hits = beatsIn(wd(3, 1) - 0.1, to(3) - 0.1);
  const last = hits.filter((b) => b <= t).pop();
  const since = last === undefined ? 9 : t - last;
  // swing: wind back before each hit, slam down at the hit
  const next = hits.find((b) => b > t);
  const wind = next !== undefined ? clamp01(1 - (next - t) / 0.35) : 0;
  const rot = since < 0.08 ? mix(0, 0, since) : -mix(0, 75, cubicInOut(wind)) + Math.exp(-since / 0.07) * 8;
  const shake = Math.exp(-since / 0.08) * 18;
  const ex = exitOf(t, 3);
  return (
    <AbsoluteFill style={{ transform: `translate(${(hash01(Math.floor(t * 60)) - 0.5) * shake}px, ${(hash01(Math.floor(t * 60) + 3) - 0.5) * shake}px)`, opacity: 1 - ex }}>
      <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
        {hits.filter((b) => b <= t).map((b, i) => {
          const p = clamp01((t - b) / 0.5);
          const r = rng(i * 7 + 1);
          return (
            <g key={i}>
              {Array.from({ length: 7 }, (_, k) => {
                const a = r() * Math.PI * 2, l = 120 + r() * 380;
                return <line key={k} x1={CX + 120} y1={H * 0.74} x2={CX + 120 + Math.cos(a) * l * cubicOut(p)} y2={H * 0.74 + Math.sin(a) * l * cubicOut(p) * 0.5} stroke={p < 0.4 ? HOT : INK} strokeWidth={3} />;
              })}
              <circle cx={CX + 120} cy={H * 0.74} r={mix(20, 420, cubicOut(p))} fill="none" stroke={HOT} strokeWidth={4} opacity={1 - p} />
            </g>
          );
        })}
      </svg>
      <Obj x={CX - 40} y={H * 0.56} size={620} rot={rot} style={{ transformOrigin: "50% 98%" }}>
        <Drawn d={HAMMER} p={draw} fill={clamp01((t - wd(3, 0) - 0.2) / 0.3)} w={7} />
      </Obj>
    </AbsoluteFill>
  );
};

/** 4–5. studs stand up in light on the beat; drywall hangs over them; screws; the plumb line. */
const Frame: React.FC<{ t: number }> = ({ t }) => {
  if (t < from(4) || t > to(5)) return null;
  const studs = 9;
  const sb = beatsIn(wd(4, 0) - 0.05, wd(4, 7) + 0.2);
  const m = multiply(t, sb.slice(0, 3), [1, 3, 5, 9]);
  const n = Math.min(studs, Math.max(m.cur, t > wd(4, 5) ? 9 : 0));
  const x0 = SAFE.left - 20, x1 = SAFE.right + 20, top = H * 0.32, bot = H * 0.82;
  const sx = (i: number) => mix(x0, x1, i / (studs - 1));
  const plate = clamp01((t - wd(4, 2)) / 0.35);
  const panels = [0, 1, 2];
  const ex = exitOf(t, 5);
  return (
    <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0, opacity: 1 - ex }}>
      {Array.from({ length: studs }, (_, i) => {
        const order = [4, 0, 8, 2, 6, 1, 3, 5, 7].indexOf(i);
        const on = order < n;
        if (!on) return null;
        const at = order < 1 ? wd(4, 0) : order < 3 ? sb[0] ?? wd(4, 2) : order < 5 ? sb[1] ?? wd(4, 3) : wd(4, 5);
        const up = expoOut(clamp01((t - at) / 0.22));
        return <rect key={i} x={sx(i) - 14} y={mix(bot, top, up)} width={28} height={(bot - top) * up} fill="rgba(20,20,20,0.9)" stroke={up < 1 ? HOT : INK} strokeWidth={3} />;
      })}
      <rect x={x0 - 14} y={top - 28} width={(x1 - x0 + 28) * plate} height={28} fill="url(#metal)" />
      <rect x={x0 - 14} y={bot} width={(x1 - x0 + 28) * plate} height={28} fill="url(#metal)" />
      {/* drywall */}
      {panels.map((k) => {
        const at = wd(5, 0) + k * 0.16;
        const p = expoOut(clamp01((t - at) / 0.28));
        const pw = (x1 - x0) / 3;
        return p > 0 ? <rect key={k} x={x0 + k * pw + 4} y={mix(-800, top, p)} width={pw - 8} height={bot - top} fill="#1d1d1c" stroke={INK} strokeWidth={2.5} /> : null;
      })}
      {/* screws */}
      {t > wd(5, 3)
        ? Array.from({ length: 3 * 2 * 5 }, (_, i) => {
            const k = Math.floor(i / 10), c = (i % 10) % 2, r = Math.floor((i % 10) / 2);
            const pw = (x1 - x0) / 3;
            const at = wd(5, 3) + i * 0.012;
            const p = clamp01((t - at) / 0.12);
            const x = x0 + k * pw + (c ? pw - 40 : 40), y = top + 60 + r * ((bot - top - 120) / 4);
            return p > 0 ? <circle key={i} cx={x} cy={y} r={mix(14, 7, p)} fill={p < 1 ? HOT : STONE} /> : null;
          })
        : null}
      {/* plumb line */}
      {t > wd(5, 7) ? (() => {
        const p = cubicOut(clamp01((t - wd(5, 7)) / 0.3));
        const sw = Math.sin((t - wd(5, 7)) * 9) * Math.exp(-(t - wd(5, 7)) * 3) * 6;
        const ly = mix(top, bot - 60, p);
        return (
          <g transform={`rotate(${sw} ${CX} ${top})`}>
            <line x1={CX} y1={top} x2={CX} y2={ly} stroke={HOT} strokeWidth={3} />
            <path d={`M${CX - 22} ${ly} L${CX + 22} ${ly} L${CX} ${ly + 60} Z`} fill="url(#metal)" />
          </g>
        );
      })() : null}
      {t > wd(5, 8) ? <text x={CX} y={bot + 90} textAnchor="middle" fontFamily="IBM Plex Mono" fontSize={30} fill={STONE}>PLUMB · 0.0°</text> : null}
    </svg>
  );
};

/** 6. the trowel throws mud across the wall and feathers it out to glass. */
const Mud: React.FC<{ t: number }> = ({ t }) => {
  if (t < from(6) || t > to(6)) return null;
  const throwP = cubicOut(clamp01((t - wd(6, 0)) / 0.35));
  const feather = cubicInOut(clamp01((t - wd(6, 3)) / 0.5));
  const glass = clamp01((t - wd(6, 6)) / 0.3);
  const sweep = clamp01((t - wd(6, 7)) / 0.35);
  const ex = exitOf(t, 6);
  const tx = mix(SAFE.left - 100, SAFE.right + 100, feather);
  return (
    <AbsoluteFill style={{ opacity: 1 - ex }}>
      <div style={{ position: "absolute", left: 0, top: H * 0.32, width: W, height: H * 0.5, background: "#1d1d1c" }} />
      {/* the mud: rough blobs, smoothed behind the trowel */}
      <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
        {Array.from({ length: 26 }, (_, i) => {
          const r = rng(i + 50);
          const x = SAFE.left - 60 + r() * (SAFE.right - SAFE.left + 120), y = H * 0.36 + r() * H * 0.42;
          const smooth = x < tx ? 1 : 0;
          return <ellipse key={i} cx={x} cy={y} rx={mix(30, 160, throwP) * (1 + smooth * 1.6)} ry={mix(20, 70, throwP) * (1 - smooth * 0.8)} fill={`rgba(200,196,188,${(0.75 - smooth * 0.55) * throwP})`} />;
        })}
        <rect x={0} y={H * 0.32} width={tx} height={H * 0.5} fill={`rgba(222,219,212,${0.2 + glass * 0.5})`} />
      </svg>
      {/* glass reflection sweep */}
      {glass > 0 ? <div style={{ position: "absolute", left: mix(-600, W + 200, sweep), top: H * 0.32, width: 260, height: H * 0.5, background: "linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.75), rgba(255,255,255,0))", transform: "skewX(-20deg)" }} /> : null}
      <Obj x={tx} y={H * 0.56} size={340} rot={-8}>
        <Drawn d={TROWEL} p={clamp01((t - from(6)) / 0.3)} fill={1} w={5} />
      </Obj>
    </AbsoluteFill>
  );
};

/** 7. tile drops in row by row on the beat, gets set straight, then lies down as the floor. */
const Tile: React.FC<{ t: number }> = ({ t }) => {
  if (t < from(7) || t > to(7)) return null;
  const rows = 8, cols = 6, s = 150;
  const tb = beatsIn(wd(7, 0) - 0.05, to(7));
  const straight = cubicOut(clamp01((t - wd(7, 3)) / 0.3));
  const lay = cubicInOut(clamp01((t - wd(7, 6)) / 0.4));
  const ex = exitOf(t, 7);
  return (
    <Field tilt={mix(0, 68, lay)} z={-lay * 300} originY={70}>
      <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0, opacity: 1 - ex, overflow: "visible" }}>
        {Array.from({ length: rows * cols }, (_, i) => {
          const c = i % cols, r = Math.floor(i / cols);
          const at = (tb[Math.floor(r / 2)] ?? wd(7, 0) + r * 0.2) + c * 0.02;
          const p = expoOut(clamp01((t - at) / 0.22));
          if (p <= 0) return null;
          const jit = (1 - straight) * (hash01(i) - 0.5) * 18;
          const x = CX - (cols * s) / 2 + c * s, y = H * 0.24 + r * s;
          return <rect key={i} x={x + 4} y={mix(y - 300, y, p) + jit} width={s - 8} height={s - 8} rx={4} fill={(c + r) % 2 ? "#222" : "#2c2b29"} stroke={straight > 0.5 ? STONE : INK} strokeWidth={2.5} transform={`rotate(${jit * 0.6} ${x + s / 2} ${y + s / 2})`} opacity={p} />;
        })}
        {straight > 0 && straight < 1 ? <line x1={SAFE.left - 40} x2={SAFE.right + 40} y1={H * 0.24 + 4 * s} y2={H * 0.24 + 4 * s} stroke={HOT} strokeWidth={4} opacity={1 - straight} /> : null}
      </svg>
    </Field>
  );
};

/** 8–9. the bones: a crooked frame snaps square, then the house fills and its windows light. */
const Bones: React.FC<{ t: number }> = ({ t }) => {
  if (t < from(8) || t > to(9)) return null;
  const draw = clamp01((t - from(8)) / 0.5);
  const fix = cubicOut(clamp01((t - wd(8, 0)) / 0.5));
  const dead = t > wd(8, 9) && t < wd(9, 0) ? 1 : 0;
  const live = clamp01((t - wd(9, 2)) / 0.4);
  const glow = clamp01((t - wd(9, 8)) / 0.4);
  const ex = exitOf(t, 9);
  // crooked → square: each joint off by a seeded amount until fixed
  const off = (k: number) => (1 - fix) * (hash01(k) - 0.5) * 60;
  const P = [
    [28, 188], [28, 96], [100, 28], [172, 96], [172, 188],
  ].map(([x, y], k) => [x + off(k), y + off(k + 7)]);
  const frame = `M${P[0]} L${P[1]} L${P[2]} L${P[3]} L${P[4]} Z M${P[1]} L${P[3]} M64 188 V${62 + off(3)} M136 188 V${62 + off(4)} M28 142 H172`;
  const windows = [[44, 110], [126, 110], [44, 150], [126, 150], [85, 70]];
  return (
    <AbsoluteFill style={{ opacity: 1 - ex, transform: `scale(${1 + ex * 0.4})` }}>
      <Obj x={CX} y={CY} size={700} rot={(1 - fix) * -4}>
        {live > 0 ? <path d="M28 188 V96 L100 28 L172 96 V188 Z" fill={`rgba(28,27,25,${live})`} /> : null}
        <Drawn d={frame} p={draw} fill={fix} w={4} />
        {windows.map(([x, y], i) => {
          const on = clamp01((t - wd(9, 2) - i * 0.12) / 0.15);
          return <rect key={i} x={x} y={y} width={30} height={26} fill={`rgba(255,236,206,${on * (0.75 + glow * 0.25)})`} stroke={INK} strokeWidth={1.5} opacity={live} style={{ filter: on > 0.5 ? "drop-shadow(0 0 12px rgba(255,230,190,0.8))" : "none" }} />;
        })}
      </Obj>
      {dead ? <div style={{ position: "absolute", left: 0, width: W, top: H * 0.83, textAlign: "center", ...mono(30, "rgba(239,237,233,0.5)") }}>CONDEMNED · 2019</div> : null}
      {glow > 0 ? <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 56%, rgba(255,232,200,${0.22 * glow}) 0%, rgba(0,0,0,0) 45%)` }} /> : null}
    </AbsoluteFill>
  );
};

/** 10–11. MEDIOCRE gets struck; AVERAGE is caged; the bars bend open on STUBBORN. */
const Cage: React.FC<{ t: number }> = ({ t }) => {
  if (t < from(10) || t > to(11)) return null;
  const ex = exitOf(t, 11);
  const strike = clamp01((t - wd(10, 3) - 0.15) / 0.25);
  const bars = 9;
  const drop = (i: number) => expoOut(clamp01((t - wd(11, 3) + 0.05 - i * 0.02) / 0.22));
  const bend = cubicOut(clamp01((t - wd(11, 7)) / 0.35));
  const w0 = SAFE.left + 20, w1 = SAFE.right - 20, top = H * 0.4, bot = H * 0.72;
  return (
    <AbsoluteFill style={{ opacity: 1 - ex }}>
      {t < wd(11, 0) ? (
        <div style={{ position: "absolute", left: 0, width: W, top: H * 0.48, textAlign: "center" }}>
          <span style={{ position: "relative", fontFamily: F.display, fontSize: 230, color: INK, transform: "scaleY(1.5)", display: "inline-block" }}>
            MEDIOCRE
            <span style={{ position: "absolute", left: -20, top: "48%", height: 14, width: `${strike * 110}%`, background: STONE, boxShadow: "0 0 30px rgba(255,236,210,0.8)" }} />
          </span>
          {t > wd(10, 4) ? <div style={{ ...mono(40, STONE), marginTop: 40 }}>{`SETTLE FOR LESS?  ${t > wd(10, 7) ? "NO." : ""}`}</div> : null}
        </div>
      ) : (
        <>
          <div style={{ position: "absolute", left: 0, width: W, top: H * 0.5, textAlign: "center", fontFamily: F.display, fontSize: 250, lineHeight: 1, color: INK, transform: `scaleY(1.5) scale(${1 + bend * 0.12})` }}>AVERAGE</div>
          <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
            <rect x={w0 - 30} y={mix(-60, top - 30, drop(0))} width={w1 - w0 + 60} height={22} fill="url(#metal)" />
            {Array.from({ length: bars }, (_, i) => {
              const x = mix(w0, w1, i / (bars - 1));
              const d = drop(i);
              const side = x < CX ? -1 : 1;
              const push = bend * (1 - Math.abs(x - CX) / (w1 - CX)) * 300 * side + bend * side * 60;
              const y0 = mix(-H * 0.4, top, d), y1 = mix(-H * 0.4 + (bot - top), bot, d);
              return <path key={i} d={`M${x} ${y0} Q${x + push} ${(y0 + y1) / 2} ${x} ${y1}`} fill="none" stroke={bend > 0 && bend < 0.6 ? HOT : INK} strokeWidth={14} strokeLinecap="round" opacity={1 - clamp01((bend - 0.7) / 0.3) * (i % 2)} />;
            })}
          </svg>
        </>
      )}
    </AbsoluteFill>
  );
};

/** 12–13. BANK ACCOUNT RED again; dollars multiply and pour into the walls and the floor. */
const Money: React.FC<{ t: number }> = ({ t }) => {
  if (t < from(12) || t > to(13)) return null;
  const bal = mix(2184.5, -4212.55, cubicOut(clamp01((t - wd(12, 2)) / 1.0)));
  const pin = expoOut(clamp01((t - wd(12, 0)) / 0.2));
  const into = t > wd(13, 0) - 0.05;
  const mb = beatsIn(wd(13, 0) - 0.05, wd(13, 7));
  const m = multiply(t, mb.slice(0, 3), [1, 4, 16, 48]);
  const fill = cubicInOut(clamp01((t - wd(13, 7)) / 0.5));
  const ex = exitOf(t, 13);
  // house cross-section: walls left/right, floor along the bottom
  const slot = (i: number, n: number) => {
    const k = i / Math.max(1, n - 1);
    if (i % 3 === 0) return { x: SAFE.left + 10, y: mix(H * 0.36, H * 0.74, k) };
    if (i % 3 === 1) return { x: SAFE.right - 10, y: mix(H * 0.36, H * 0.74, k) };
    return { x: mix(SAFE.left, SAFE.right, k), y: H * 0.78 };
  };
  return (
    <AbsoluteFill style={{ opacity: 1 - ex }}>
      {!into ? (
        <>
          <Headline line={sub(L[12], 0, 3)} t={t} squashAt={wd(13, 0) - 0.2} y={H * 0.36} maxH={360} color={(w) => (/red/i.test(w) ? RED : null)} />
          {t > wd(12, 2) ? <div style={{ position: "absolute", left: SAFE.left, top: H * 0.56, width: SAFE.right - SAFE.left, textAlign: "center", fontFamily: F.display, fontSize: 240, color: bal < 0 ? RED : INK, transform: `scaleY(${mix(1.8, 1, pin)})` }}>{`${bal < 0 ? "-" : ""}$${Math.abs(bal).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</div> : null}
          {t > wd(12, 5) ? <div style={{ position: "absolute", left: 0, width: W, top: H * 0.74, textAlign: "center", ...mono(30, "rgba(239,237,233,0.6)") }}>like before · verse 1 · −$12.84</div> : null}
        </>
      ) : (
        <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
          {/* the house section */}
          <path d={`M${SAFE.left - 30} ${H * 0.8} V${H * 0.34} L${CX} ${H * 0.22} L${SAFE.right + 30} ${H * 0.34} V${H * 0.8} Z`} fill="none" stroke={INK} strokeWidth={4} opacity={clamp01((t - wd(13, 0)) / 0.3)} />
          {gridLayout(m.cur, mix(0, m.cur > 16 ? 125 : m.cur > 4 ? 190 : 330, m.p), m.cur > 16 ? 6 : undefined).map((p, i) => {
            const a = { x: CX + p.x, y: H * 0.52 + p.y };
            const b = slot(i, m.cur);
            const x = mix(a.x, b.x, fill), y = mix(a.y, b.y, fill);
            const s = mix(m.cur === 1 ? 3.2 : m.cur <= 4 ? 1.9 : m.cur <= 16 ? 1.15 : 0.75, 0.55, fill);
            return (
              <g key={i} transform={`translate(${x} ${y}) scale(${s}) rotate(${fill * (i % 2 ? 90 : 0)})`} opacity={i === 0 ? 1 : m.p}>
                <rect x={-80} y={-40} width={160} height={80} rx={8} fill="#121a14" stroke={STONE} strokeWidth={3} />
                <text x={0} y={18} textAnchor="middle" fontFamily="Bebas Neue" fontSize={56} fill={RED}>$</text>
              </g>
            );
          })}
        </svg>
      )}
    </AbsoluteFill>
  );
};

/** 14. the card is drawn, MAXED OUT stamps it, it stretches thin into a limit bar that overruns. */
const Card: React.FC<{ t: number }> = ({ t }) => {
  if (t < from(14) || t > to(14)) return null;
  const draw = clamp01((t - from(14)) / 0.3);
  const stamp = expoOut(clamp01((t - wd(14, 0)) / 0.15));
  const thin = cubicInOut(clamp01((t - wd(14, 2)) / 0.35));
  const push = clamp01((t - wd(14, 4)) / (to(14) - wd(14, 4)));
  const ex = exitOf(t, 14);
  return (
    <AbsoluteFill style={{ opacity: 1 - ex }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, transform: `scaleX(${mix(1, 2.6, thin)}) scaleY(${mix(1, 0.03, thin)})`, transformOrigin: `${CX}px ${CY}px` }}>
        <Obj x={CX} y={CY} size={760}>
          <Drawn d={CARD} p={draw} fill={clamp01((t - from(14) - 0.2) / 0.2)} w={4} />
          <text x={30} y={140} fontFamily="IBM Plex Mono" fontSize={12} fill={INK} opacity={draw}>•••• •••• •••• 0451</text>
        </Obj>
        {stamp > 0 ? <div style={{ position: "absolute", left: 0, width: W, top: CY - 80, textAlign: "center", fontFamily: F.display, fontSize: 150, color: RED, transform: `rotate(-8deg) scale(${mix(2.2, 1, stamp)})`, opacity: stamp }}>MAXED OUT</div> : null}
      </div>
      {thin > 0.9 ? (
        <>
          <div style={{ position: "absolute", left: SAFE.left, top: CY - 20, width: SAFE.right - SAFE.left, height: 40, border: `3px solid ${INK}`, borderRadius: 6 }} />
          <div style={{ position: "absolute", left: SAFE.left, top: CY - 20, width: (SAFE.right - SAFE.left) * mix(0.9, 1.22, push), height: 40, background: push > 0.3 ? RED : STONE, borderRadius: 6, boxShadow: "0 0 30px rgba(229,72,59,0.5)" }} />
          <div style={{ position: "absolute", left: SAFE.left, top: CY + 50, ...mono(34, STONE) }}>{`LIMIT ${Math.round(mix(90, 122, push))}%`}</div>
        </>
      ) : null}
    </AbsoluteFill>
  );
};

/** 15–16. the phone shows the after-pic; swipe: the receipt unrolls; it crumples into a shine. */
const AfterPic: React.FC<{ t: number }> = ({ t }) => {
  if (t < from(15) || t > to(16)) return null;
  const draw = clamp01((t - from(15)) / 0.35);
  const likes = Math.floor(clamp01((t - wd(15, 3)) / 0.6) * 2400);
  const swipe = cubicInOut(clamp01((t - wd(15, 5)) / 0.3));
  const unroll = cubicOut(clamp01((t - wd(15, 6)) / 1.6));
  const crumple = cubicIn(clamp01((t - wd(16, 5)) / 0.35));
  const shine = clamp01((t - wd(16, 9) + 0.1) / 0.25);
  const ex = exitOf(t, 16);
  const costs = [["DEMO + HAUL", "-$3,200"], ["FRAMING", "-$6,850"], ["DRYWALL + MUD", "-$4,100"], ["TILE", "-$2,975"], ["NIGHTS", "-∞"], ["WEEKENDS", "-∞"], ["SLEEP", "-∞"]];
  const PH = { x: CX, y: H * 0.54, s: 900 };
  return (
    <AbsoluteFill style={{ opacity: 1 - ex }}>
      <AbsoluteFill style={{ transform: `scale(${mix(1, 0.02, crumple)}) rotate(${crumple * 200}deg)`, transformOrigin: `${CX}px ${H * 0.54}px` }}>
        <Obj x={PH.x} y={PH.y} size={PH.s}>
          <Drawn d={PHONE} p={draw} fill={1} w={3} />
        </Obj>
        {/* the screen: AFTER pic → receipt */}
        <div style={{ position: "absolute", left: CX - 205, top: H * 0.54 - 370, width: 410, height: 740, overflow: "hidden", borderRadius: 12, opacity: draw }}>
          <div style={{ position: "absolute", left: -swipe * 410, top: 0, width: 410, height: 740, background: "linear-gradient(180deg, #2a2723, #0f0f0f)" }}>
            <svg viewBox="0 0 200 200" width={410} height={410} style={{ position: "absolute", top: 120 }}>
              <path d={HOUSE} fill="#1d1b18" stroke={INK} strokeWidth={3} />
              {[[44, 110], [126, 110], [85, 140]].map(([x, y], i) => <rect key={i} x={x} y={y} width={30} height={26} fill="rgba(255,232,196,0.9)" />)}
            </svg>
            <div style={{ position: "absolute", left: 20, top: 30, ...mono(22, STONE) }}>@rudo · AFTER ✨</div>
            <div style={{ position: "absolute", left: 20, bottom: 40, ...mono(24) }}>{`♥ ${likes.toLocaleString()}`}</div>
          </div>
          <div style={{ position: "absolute", left: (1 - swipe) * 410, top: 0, width: 410, height: 740, background: "#e9e6df", padding: 26 }}>
            <div style={mono(22, "#111")}>WHAT I PAID</div>
            {costs.map(([k, v], i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", marginTop: 26, opacity: clamp01(unroll * costs.length - i), ...mono(22, "#111") }}>
                <span>{k}</span>
                <span style={{ color: RED }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </AbsoluteFill>
      {shine > 0 ? (
        <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
          {Array.from({ length: 4 }, (_, i) => {
            const a = (i * Math.PI) / 4 + t * 0.5;
            const l = mix(0, i % 2 ? 260 : 620, shine);
            return <line key={i} x1={CX - Math.cos(a) * l} y1={H * 0.54 - Math.sin(a) * l} x2={CX + Math.cos(a) * l} y2={H * 0.54 + Math.sin(a) * l} stroke={HOT} strokeWidth={i % 2 ? 3 : 6} strokeLinecap="round" />;
          })}
          <circle cx={CX} cy={H * 0.54} r={mix(0, 90, shine)} fill="url(#hot)" />
        </svg>
      ) : null}
    </AbsoluteFill>
  );
};

/** 17. every house he flips stacks into a stair; the stair squashes into the line. */
const Steps: React.FC<{ t: number }> = ({ t }) => {
  if (t < from(17) - 0.2) return null;
  const sb = [wd(17, 0), wd(17, 1), wd(17, 3), ...beatsIn(wd(17, 3) + 0.2, wd(17, 9) + 0.1)];
  const n = 7;
  const sq = cubicIn(clamp01((t - END + 0.4) / 0.25));
  const hl = clamp01((t - END + 0.2) / 0.1);
  const s = 150;
  return (
    <>
      <AbsoluteFill style={{ transform: `scaleY(${mix(1, 0.01, sq)})`, transformOrigin: `50% ${H * 0.48}px` }}>
        {Array.from({ length: n }, (_, i) => {
          const at = sb[i] ?? sb[sb.length - 1] + (i - sb.length + 1) * 0.2;
          const p = expoOut(clamp01((t - at) / 0.22));
          if (p <= 0) return null;
          const x = SAFE.left + 30 + i * ((SAFE.right - SAFE.left - 60 - s) / (n - 1)) + s / 2;
          const y = H * 0.74 - i * 110;
          return (
            <Obj key={i} x={x} y={mix(y + 200, y, p)} size={s} o={p}>
              <Drawn d={HOUSE} p={clamp01(p * 1.4)} fill={clamp01((t - at - 0.2) / 0.2)} w={8} />
              {[[44, 110], [126, 110]].map(([wx, wy], k) => <rect key={k} x={wx} y={wy} width={30} height={26} fill="rgba(255,232,196,0.85)" opacity={clamp01((t - at - 0.25) / 0.2)} />)}
            </Obj>
          );
        })}
        {/* the stair line under the houses */}
        <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
          <Drawn
            d={Array.from({ length: n }, (_, i) => {
              const x = SAFE.left + 30 + i * ((SAFE.right - SAFE.left - 60 - s) / (n - 1));
              const y = H * 0.74 - i * 110 + s / 2;
              return `${i ? "L" : "M"}${x} ${y + 110} L${x} ${y} L${x + s} ${y}`;
            }).join(" ")}
            p={clamp01((t - wd(17, 0)) / (wd(17, 9) - wd(17, 0) + 0.2))}
            fill={clamp01((t - wd(17, 9)) / 0.3)}
            w={5}
          />
        </svg>
      </AbsoluteFill>
      <HotLine x0={SAFE.left - 60} x1={SAFE.right + 60} y={H * 0.48} o={hl} />
    </>
  );
};

// ---------------------------------------------------------------------------------------------
export const Verse2M: React.FC<{ t: number; bare?: boolean }> = ({ t, bare }) => {
  const outs = L.map((l, i) => lineOut(l, L[i + 1], 1.2));
  const kick = kickEnv(t, 0.12);
  const sx = (hash01(Math.floor(t * 60)) - 0.5) * kick * 3, sy = (hash01(Math.floor(t * 60) + 5) - 0.5) * kick * 3;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <MorphDefs />
      <AbsoluteFill style={{ transform: `translate(${sx}px, ${sy}px)` }}>
        <ClockOut t={t} />
        <House t={t} />
        <Demo t={t} />
        <Sledge t={t} />
        <Frame t={t} />
        <Mud t={t} />
        <Tile t={t} />
        <Bones t={t} />
        <Cage t={t} />
        <Money t={t} />
        <Card t={t} />
        <AfterPic t={t} />
        <Steps t={t} />
      </AbsoluteFill>
      {bare ? null : (
        <>
          <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 22%)" }} />
          <Headline line={sub(L[9], 0, 4)} t={t} squashAt={wd(9, 4) + 0.1} y={H * 0.22} maxH={320} color={(w) => (/beautiful/i.test(w) ? STONE : null)} />
          <Headline line={L[16]} t={t} squashAt={outs[16] - 0.2} y={H * 0.22} maxH={300} color={(w) => (/shine|cost/i.test(w) ? STONE : null)} />
          <Headline line={L[17]} t={t} squashAt={END - 0.45} y={H * 0.2} maxH={300} color={(w) => (/step/i.test(w) ? STONE : null)} />
          {L.map((l, i) => (
            <Caption key={l.id} line={l} t={t} out={outs[i]} top={210} />
          ))}
          <div style={{ position: "absolute", left: SAFE.left, top: 170, ...mono(20, STONE) }}>06 / VERSE 2 — the flip</div>
        </>
      )}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 85% 65% at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.7) 100%)", pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};
