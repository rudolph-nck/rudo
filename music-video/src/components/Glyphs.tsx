import React from "react";
import { C, F, PLUS } from "../theme";
import { clamp01, cubicInOut, expoOut, mix, quintOut } from "../utils/ease";
import { hash01 } from "../utils/random";

/**
 * Thin-line diagrams — one per department line — drawing what the lyric
 * *does*. 300×300 box, stroke-drawn over `t` frames.
 */
const S = 300;
const W1 = { stroke: C.white, strokeWidth: 2, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const B1 = { ...W1, stroke: C.blue, strokeWidth: 3 };
const draw = (p: number, len = 1200) => ({ strokeDasharray: len, strokeDashoffset: len * (1 - clamp01(p)) });

type G = (t: number) => React.ReactNode;

const GLYPHS: Record<string, G> = {
  aligned: (t) => (
    <>
      {Array.from({ length: 5 }, (_, c) =>
        Array.from({ length: 5 }, (_, r) => {
          const p = quintOut(clamp01((t - 6 - c * 3) / 22));
          const y0 = 40 + r * 48 + (hash01(c * 7 + r) - 0.5) * 140;
          return (
            <text key={`${c}${r}`} x={40 + c * 52} y={mix(y0, 60 + r * 48, p)} fill={r === 4 ? C.blue : C.white} fontFamily={F.mono} fontSize={24} opacity={0.3 + 0.7 * p}>
              {Math.floor(hash01(c * 13 + r * 3) * 10)}
            </text>
          );
        }),
      )}
      <line x1={30} x2={290} y1={272} y2={272} {...B1} style={draw(t / 30, 260)} />
    </>
  ),
  moving: (t) => (
    <>
      <line x1={10} x2={290} y1={150} y2={150} {...W1} opacity={0.4} style={draw(t / 16, 280)} />
      {Array.from({ length: 5 }, (_, i) => {
        const x = ((i * 64 + t * 4) % 320) - 20;
        return <polyline key={i} points={`${x},120 ${x + 26},150 ${x},180`} {...(i === 2 ? B1 : W1)} opacity={Math.sin((Math.PI * clamp01(x / 290)))} />;
      })}
    </>
  ),
  data: (t) => (
    <>
      {[60, 95, 80, 140, 175, 230].map((h, i) => {
        const p = expoOut(clamp01((t - i * 3) / 20));
        return <rect key={i} x={30 + i * 44} y={270 - h * p} width={26} height={h * p} fill={i === 5 ? C.blue : "rgba(255,255,255,0.85)"} />;
      })}
      <polyline points="43,200 87,170 131,185 175,120 219,90 263,30" {...B1} style={draw((t - 14) / 20, 330)} />
    </>
  ),
  time: (t) => (
    <>
      {[
        [20, 120],
        [90, 110],
        [150, 100],
        [200, 80],
      ].map(([x, w], i) => (
        <rect key={i} x={x} y={60 + i * 50} width={w * expoOut(clamp01((t - i * 5) / 16))} height={22} fill={i === 3 ? C.blue : "rgba(255,255,255,0.8)"} />
      ))}
      <line x1={mix(20, 280, clamp01(t / 70))} x2={mix(20, 280, clamp01(t / 70))} y1={30} y2={270} {...W1} strokeDasharray="4 6" />
    </>
  ),
  guard: (t) => {
    const a = (t * 6 * Math.PI) / 180;
    return (
      <>
        {[130, 90, 50].map((r) => (
          <circle key={r} cx={150} cy={150} r={r} {...W1} opacity={0.5} style={draw(t / 20, 2 * Math.PI * r)} />
        ))}
        <line x1={150} y1={150} x2={150 + Math.cos(a) * 130} y2={150 + Math.sin(a) * 130} {...B1} />
        {[0.8, 2.6, 4.4].map((b, i) => (
          <circle key={i} cx={150 + Math.cos(b) * (60 + i * 25)} cy={150 + Math.sin(b) * (60 + i * 25)} r={5} fill={C.blue} opacity={Math.max(0, Math.cos(a - b)) ** 6} />
        ))}
      </>
    );
  },
  standards: (t) => (
    <>
      <rect x={60} y={20} width={180} height={260} {...W1} style={draw(t / 18, 880)} />
      {Array.from({ length: 8 }, (_, i) => (
        <line key={i} x1={85} x2={i === 7 ? 150 : 215} y1={60 + i * 26} y2={60 + i * 26} {...W1} strokeWidth={1.5} opacity={0.7} style={draw((t - 8 - i * 2) / 8, 140)} />
      ))}
      <polyline points="160,240 180,258 222,214" {...B1} style={draw((t - 30) / 10, 90)} />
    </>
  ),
  ahead: (t) => (
    <>
      <line x1={0} x2={300} y1={200} y2={200} {...W1} style={draw(t / 14, 300)} />
      {[0, 1, 2, 3].map((i) => {
        const r = ((t * 2.2 + i * 45) % 180) + 10;
        return <path key={i} d={`M ${60 + r * 0.2} ${200 - r} A ${r} ${r} 0 0 1 ${60 + r * 1.1} 200`} {...W1} opacity={1 - r / 190} />;
      })}
      <circle cx={60} cy={200} r={7} fill={C.blue} />
    </>
  ),
  right: (t) => (
    <>
      <circle cx={150} cy={150} r={110} {...W1} style={draw(t / 16, 700)} />
      <line x1={150} x2={150} y1={20} y2={280} {...W1} opacity={0.5} style={draw(t / 12, 260)} />
      <line x1={20} x2={280} y1={150} y2={150} {...W1} opacity={0.5} style={draw(t / 12, 260)} />
      <polyline points="100,152 138,190 208,112" {...B1} strokeWidth={6} style={draw((t - 16) / 10, 160)} />
    </>
  ),
  through: (t) => (
    <>
      {[50, 100, 150, 200, 250].map((x, i) => (
        <g key={i} opacity={0.75}>
          <line x1={x} x2={x} y1={80} y2={130} {...W1} />
          <line x1={x} x2={x} y1={170} y2={220} {...W1} />
        </g>
      ))}
      <line x1={10} x2={mix(10, 295, cubicInOut(clamp01(t / 40)))} y1={150} y2={150} {...B1} />
      <circle cx={mix(10, 295, cubicInOut(clamp01(t / 40)))} cy={150} r={6} fill={C.blue} />
    </>
  ),
  dreams: (t) => (
    <>
      <polyline points="50,280 50,140 150,50 250,140 250,280 50,280" {...W1} style={draw(t / 22, 820)} />
      <rect x={128} y={200} width={44} height={80} fill={C.blue} opacity={clamp01((t - 20) / 8)} />
      <rect x={80} y={160} width={36} height={30} {...W1} opacity={clamp01((t - 16) / 8)} />
      <rect x={184} y={160} width={36} height={30} {...W1} opacity={clamp01((t - 18) / 8)} />
    </>
  ),
  doors: (t) => {
    const o = cubicInOut(clamp01((t - 8) / 30));
    return (
      <>
        <defs>
          <linearGradient id="doorlight" x1="0" x2="1">
            <stop offset="0" stopColor={C.blue} stopOpacity={0.9} />
            <stop offset="1" stopColor={C.blue} stopOpacity={0} />
          </linearGradient>
        </defs>
        <polygon points={`105,40 195,40 ${195 + 90 * o},290 ${105 - 20 * o},290`} fill="url(#doorlight)" opacity={0.35 * o} />
        <rect x={105} y={40} width={90} height={200} fill="rgba(0,178,227,0.85)" opacity={o} />
        <rect x={105} y={40} width={90} height={200} {...W1} style={draw(t / 14, 580)} />
        <polygon points={`105,40 ${105 + 90 * (1 - o)},${40 + 14 * o} ${105 + 90 * (1 - o)},${240 - 14 * o} 105,240`} fill={C.charcoal} stroke={C.white} strokeWidth={2} />
      </>
    );
  },
  gears: (t) => (
    <>
      {[120, 85, 50].map((r, i) => (
        <circle key={r} cx={150} cy={150} r={r} {...(i === 1 ? B1 : W1)} strokeDasharray={`${r * 0.6} ${r * 0.25}`} transform={`rotate(${(i % 2 ? -1 : 1) * t * (3 + i)} 150 150)`} opacity={clamp01(t / 10)} />
      ))}
      <circle cx={150} cy={150} r={8} fill={C.white} />
    </>
  ),
  daynight: (t) => {
    const a = ((t * 5 - 90) * Math.PI) / 180;
    return (
      <>
        <circle cx={150} cy={150} r={110} {...W1} opacity={0.4} strokeDasharray="3 7" />
        <line x1={20} x2={280} y1={150} y2={150} {...W1} opacity={0.5} />
        <circle cx={150 + Math.cos(a) * 110} cy={150 + Math.sin(a) * 110} r={20} fill={C.blue} />
        <circle cx={150 - Math.cos(a) * 110} cy={150 - Math.sin(a) * 110} r={16} {...W1} />
      </>
    );
  },
  spaces: (t) => (
    <>
      <rect x={30} y={40} width={240} height={220} {...W1} style={draw(t / 16, 920)} />
      <polyline points="130,40 130,150 30,150" {...W1} style={draw((t - 10) / 10, 220)} />
      <polyline points="130,110 270,110" {...W1} style={draw((t - 14) / 8, 140)} />
      <polyline points="200,110 200,260" {...W1} style={draw((t - 18) / 8, 150)} />
      <rect x={140} y={120} width={50} height={130} fill={C.blue} opacity={0.8 * clamp01((t - 24) / 8)} />
    </>
  ),
  grow: (t) => (
    <>
      <polyline points="20,270 80,270 80,210 140,210 140,150 200,150 200,90 260,90 260,40" {...B1} style={draw(t / 26, 520)} />
      <polyline points="240,58 260,36 282,58" {...B1} opacity={clamp01((t - 24) / 6)} />
      <line x1={20} x2={290} y1={280} y2={280} {...W1} opacity={0.4} />
    </>
  ),
  plus: (t) => {
    const p = expoOut(clamp01(t / 22));
    const s = 200 / PLUS.h;
    return (
      <g transform={`translate(150 150) rotate(${(1 - p) * -90}) scale(${p * s}) translate(${-PLUS.w / 2} ${-PLUS.h / 2})`}>
        <path d={PLUS.path} fill={C.blue} />
      </g>
    );
  },
  holding: (t) => (
    <>
      {[0, 1, 2].map((i) => (
        <rect key={i} x={40 + i * 20} y={200 - i * 50} width={220 - i * 40} height={34} fill={i === 0 ? C.blue : "rgba(255,255,255,0.85)"}
          transform={`translate(0 ${(1 - expoOut(clamp01((t - i * 6) / 14))) * -120})`} opacity={clamp01((t - i * 6) / 6)} />
      ))}
      <line x1={20} x2={280} y1={250} y2={250} {...W1} />
    </>
  ),
  answering: (t) => (
    <>
      <circle cx={70} cy={150} r={14} fill={C.blue} />
      {[0, 1, 2, 3].map((i) => {
        const r = ((t * 3 + i * 45) % 180) + 30;
        return <path key={i} d={`M ${70 + r * 0.5} ${150 - r * 0.866} A ${r} ${r} 0 0 1 ${70 + r * 0.5} ${150 + r * 0.866}`} {...W1} opacity={1 - (r - 30) / 180} />;
      })}
    </>
  ),
  where: (t) => (
    <>
      {[0, 1, 2].map((i) => {
        const q = ((t + i * 18) % 54) / 54;
        return <ellipse key={i} cx={150} cy={250} rx={20 + 120 * q} ry={(20 + 120 * q) * 0.3} {...W1} opacity={1 - q} />;
      })}
      <path d="M150 250 C 110 190, 100 160, 100 130 A 50 50 0 1 1 200 130 C 200 160, 190 190, 150 250 Z" {...B1} style={draw(t / 20, 420)} />
      <circle cx={150} cy={128} r={16} fill={C.white} opacity={clamp01((t - 14) / 6)} />
    </>
  ),
  far: (t) => {
    const q = cubicInOut(clamp01(t / 50));
    return (
      <>
        {[-1, -0.4, 0.4, 1].map((k, i) => (
          <line key={i} x1={150 + k * 150} y1={290} x2={150} y2={70} {...W1} opacity={0.45} style={draw(t / 14, 300)} />
        ))}
        <line x1={0} x2={300} y1={70} y2={70} {...W1} opacity={0.3} />
        <circle cx={150} cy={mix(270, 74, q)} r={mix(18, 3, q)} fill={C.blue} />
      </>
    );
  },
  heart: (t) => {
    // the member at the heart — hearts ripple out from a beating centre
    const H = (sc: number) => `M150 ${150 + 28 * sc} C ${150 - 70 * sc} ${150 - 18 * sc}, ${150 - 36 * sc} ${150 - 72 * sc}, 150 ${150 - 34 * sc} C ${150 + 36 * sc} ${150 - 72 * sc}, ${150 + 70 * sc} ${150 - 18 * sc}, 150 ${150 + 28 * sc} Z`;
    const beat = 1 + 0.08 * Math.max(0, Math.sin((t / 16.7) * Math.PI * 2));
    return (
      <>
        {[0, 1, 2, 3].map((i) => {
          const q = ((t + i * 13) % 52) / 52;
          return <path key={i} d={H(1.0 + q * 1.9)} {...W1} strokeWidth={2.5} opacity={(1 - q) * clamp01(t / 8)} />;
        })}
        <path d={H(1.0 * beat)} fill={C.blue} opacity={clamp01(t / 6)} />
      </>
    );
  },
  impact: (t) => (
    <>
      {[0, 1, 2, 3].map((i) => {
        const q = ((t + i * 12) % 48) / 48;
        return <circle key={i} cx={150} cy={150} r={10 + 140 * q} {...(i === 0 ? B1 : W1)} opacity={1 - q} />;
      })}
      <circle cx={150} cy={150} r={9} fill={C.white} />
    </>
  ),
  loud: (t) => (
    <>
      <polygon points="40,120 90,120 150,70 150,230 90,180 40,180" {...W1} style={draw(t / 14, 600)} />
      {[0, 1, 2].map((i) => (
        <path key={i} d={`M ${175 + i * 30} ${110 - i * 20} Q ${205 + i * 40} 150 ${175 + i * 30} ${190 + i * 20}`} {...(i === 2 ? B1 : W1)} opacity={clamp01((t - 6 - i * 4) / 6)} />
      ))}
    </>
  ),
  proud: (t) => (
    <>
      {[70, 110, 160, 210, 260].map((h, i) => (
        <line key={i} x1={50 + i * 50} x2={50 + i * 50} y1={280} y2={280 - h * expoOut(clamp01((t - i * 4) / 16))} {...(i === 4 ? B1 : W1)} strokeWidth={i === 4 ? 8 : 6} />
      ))}
    </>
  ),
  support: (t) => (
    <>
      <rect x={30} y={70} width={240} height={26} fill={C.blue} transform={`translate(0 ${(1 - expoOut(clamp01((t - 12) / 14))) * -80})`} />
      {[60, 150, 240].map((x, i) => (
        <line key={x} x1={x} x2={x} y1={280} y2={mix(280, 100, expoOut(clamp01((t - i * 3) / 14)))} {...W1} strokeWidth={10} strokeLinecap="butt" />
      ))}
      <line x1={10} x2={290} y1={282} y2={282} {...W1} />
    </>
  ),
  breakthrough: (t) => {
    const q = clamp01(t / 26);
    const hit = q > 0.55;
    return (
      <>
        <line x1={170} x2={170} y1={30} y2={120} {...W1} strokeWidth={4} />
        <line x1={170} x2={170} y1={180} y2={270} {...W1} strokeWidth={4} />
        {!hit && <line x1={170} x2={170} y1={120} y2={180} {...W1} strokeWidth={4} />}
        {hit &&
          [0, 1, 2, 3].map((i) => {
            const k = (q - 0.55) * 3;
            return <line key={i} x1={170 + k * (20 + i * 12)} y1={125 + i * 16 + (i - 1.5) * k * 40} x2={170 + k * (20 + i * 12)} y2={137 + i * 16 + (i - 1.5) * k * 40} {...W1} strokeWidth={3} opacity={1 - k} />;
          })}
        <line x1={10} x2={mix(10, 290, cubicInOut(q))} y1={150} y2={150} {...B1} strokeWidth={5} />
      </>
    );
  },
  lead: (t) => {
    const q = cubicInOut(clamp01(t / 40));
    return (
      <>
        {[-50, -25, 25, 50].map((dy, i) => (
          <line key={i} x1={10} y1={150 + dy * 2} x2={mix(30, 200, q)} y2={150 + dy * mix(2, 0.3, q)} {...W1} opacity={0.5} />
        ))}
        <line x1={10} y1={150} x2={mix(60, 285, q)} y2={150} {...B1} strokeWidth={5} />
        <polyline points={`${mix(60, 285, q) - 18},132 ${mix(60, 285, q)},150 ${mix(60, 285, q) - 18},168`} {...B1} strokeWidth={5} />
      </>
    );
  },
};

export const Glyph: React.FC<{ kind: string; t: number; size?: number; opacity?: number }> = ({ kind, t, size = 300, opacity = 1 }) => {
  const g = GLYPHS[kind];
  if (!g || t < 0) return null;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${S} ${S}`} style={{ overflow: "visible", opacity }}>
      {g(t)}
    </svg>
  );
};
