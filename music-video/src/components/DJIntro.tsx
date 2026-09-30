import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import chops from "../../data/chops.json";
import spectrum from "../../data/spectrum.json";
import { C } from "../theme";
import { clamp01, cubicInOut, expoIn, expoOut, mix, ramp } from "../utils/ease";
import { beatPulse, DOWNBEATS, FPS, lyric } from "../utils/time";
import { Helmet, VISOR_GEOM } from "./Helmet";

/**
 * The rise and the beat drop (≈22 s → the verse): the DJ stands alone in the
 * dark, no booth; the camera pushes into his helmet, and on the drop the A+ on
 * his visor becomes an equalizer driven by the song's real spectrum
 * (data/spectrum.json, scripts/spectrum.py). Every chopped "yeah" fills the
 * whole mark.
 */

const T_IN = 21.9;
const T_SWAP = 27.7; // stand → helmet dissolve
const DROP = 29.93;

// stand.png is 912×2480 (Real-ESRGAN ×4 of the character sheet); the visor sits at (456, 250)
const SW = 912,
  SH = 2480,
  HEAD = { x: 456, y: 250 };

// A+ mark (brand vector, units)
const MARK_W = 37.505,
  MARK_H = 33.432;
const A_PATH = "M27.255 0L27.255 10.795L22.085 10.795L22.085 5.64L5.405 33.432L0 33.432L18.607 0L27.255 0Z";
const P_PATH = "M37.505 20.169L34.414 25.343L27.256 25.343L27.256 33.432L22.082 33.432L22.082 25.343L11.762 25.343L14.868 20.169L22.082 20.169L22.082 12.083L27.256 12.083L27.256 20.169L37.505 20.169Z";

const SPEC: number[][] = spectrum.frames;
const band = (abs: number, b: number, back = 0) => {
  const i = Math.round((abs / FPS - spectrum.start) * spectrum.fps) - back;
  const row = SPEC[Math.max(0, Math.min(SPEC.length - 1, i))];
  return row[Math.max(0, Math.min(row.length - 1, b))] / 99;
};
const peakOf = (abs: number, b: number) => {
  let p = 0;
  for (let j = 0; j < 16; j++) p = Math.max(p, band(abs, b, j) - j * 0.028);
  return p;
};
const chopPulse = (t: number) => {
  let last = -99;
  for (const c of chops.yeah) if (c <= t + 0.02) last = c;
  return Math.exp(-(t - last) * 5.5);
};

/** The A+ as an LED equalizer, in mark units. */
const MarkEQ: React.FC<{ abs: number; level: number; fill: number }> = ({ abs, level, fill }) => {
  const NC = 22;
  const pitch = MARK_W / NC;
  const cols = Array.from({ length: NC }, (_, c) => {
    const b = Math.min(23, Math.floor((c * 24) / NC));
    const v = Math.max(fill, band(abs, b) * level);
    const pk = Math.max(fill, peakOf(abs, b) * level);
    return { x: c * pitch + 0.22, v: clamp01(v), pk: clamp01(pk) };
  });
  const bars = (clip: string, color: string) => (
    <g clipPath={`url(#${clip})`}>
      <g mask="url(#eqStripes)">
        {cols.map((c, i) => (
          <rect key={i} x={c.x} y={MARK_H * (1 - c.v)} width={pitch - 0.44} height={MARK_H * c.v + 0.1} fill={color} />
        ))}
      </g>
      {cols.map((c, i) => (
        <rect key={`p${i}`} x={c.x} y={Math.max(0, MARK_H * (1 - c.pk) - 1.1)} width={pitch - 0.44} height={0.55} fill={color} opacity={c.pk > 0.04 ? 1 : 0} />
      ))}
    </g>
  );
  return (
    <g>
      <defs>
        <clipPath id="eqA">
          <path d={A_PATH} />
        </clipPath>
        <clipPath id="eqP">
          <path d={P_PATH} />
        </clipPath>
        <pattern id="eqStripePat" patternUnits="userSpaceOnUse" width={MARK_W} height={1.25}>
          <rect x={0} y={0} width={MARK_W} height={0.95} fill="#fff" />
        </pattern>
        <mask id="eqStripes" maskUnits="userSpaceOnUse" x={-2} y={-2} width={MARK_W + 4} height={MARK_H + 4}>
          <rect x={-2} y={-2} width={MARK_W + 4} height={MARK_H + 4} fill="url(#eqStripePat)" />
        </mask>
        <filter id="eqGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation={0.9} result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* the mark, always faintly present so the shape reads */}
      <path d={A_PATH} fill={`rgba(${C.blueRGB},0.13)`} stroke={`rgba(${C.blueRGB},0.55)`} strokeWidth={0.18} />
      <path d={P_PATH} fill={`rgba(${C.blueRGB},0.13)`} stroke={`rgba(${C.blueRGB},0.55)`} strokeWidth={0.18} />
      <g filter="url(#eqGlow)">
        {bars("eqA", "#e6fbff")}
        {bars("eqP", C.blue)}
      </g>
    </g>
  );
};

/** Mirrored bar stacks either side of the helmet, like speaker columns. */
const SideEQ: React.FC<{ abs: number; level: number }> = ({ abs, level }) => {
  const N = 13;
  const out: React.ReactNode[] = [];
  for (let side = 0; side < 2; side++) {
    for (let i = 0; i < N; i++) {
      const b = Math.min(23, 1 + Math.floor((i * 22) / N));
      const v = band(abs, b) * level;
      const h = 30 + v * 400;
      const x = side === 0 ? 470 - i * 36 : 1450 + i * 36 - 18;
      out.push(
        <div key={`${side}-${i}`} style={{ position: "absolute", left: x, top: 540 - h, width: 18, height: h * 2,
          background: `repeating-linear-gradient(180deg, rgba(${C.blueRGB},${0.25 + 0.6 * v}) 0 9px, transparent 9px 13px)`,
          opacity: 1 - i / (N * 1.4) }} />,
      );
    }
  }
  return <>{out}</>;
};

export const DJIntro: React.FC<{ abs: number }> = ({ abs }) => {
  const t = abs / FPS;
  const END = lyric("changin").start;
  const fr = (s: number) => s * FPS;

  // ---------- act 1: the DJ stands in the dark ----------
  const u = clamp01((t - T_IN) / (T_SWAP + 0.6 - T_IN));
  const z = mix(1, 2.7, Math.pow(u, 2.1));
  const S = (1000 / SH) * z;
  const cx = 960;
  const cy = mix(1040 - (SH - HEAD.y) * (1000 / SH), 470, Math.pow(u, 1.5));
  const standOp = 1 - ramp(abs, fr(T_SWAP), 16, cubicInOut);
  const rim = ramp(abs, fr(T_IN + 0.4), 60);
  const lit = ramp(abs, fr(T_IN + 1.6), 90);
  const rise = ramp(abs, fr(T_IN), fr(DROP - T_IN), expoIn); // tension of the build
  const sweep = t * mix(0.35, 1.6, rise);
  const kick = beatPulse(abs, 6);
  const mids = band(abs, 12);

  // ---------- act 2: the helmet ----------
  const pre = ramp(abs, fr(T_SWAP - 0.2), fr(DROP - T_SWAP + 0.2), cubicInOut);
  const dropK = ramp(abs, fr(DROP) - 1, 3);
  const after = ramp(abs, fr(DROP), fr(END - DROP));
  const down = beatPulse(abs, 4, DOWNBEATS);
  const exitK = ramp(abs, fr(END) - 18, 18, expoIn);
  const Hh = (dropK < 1 ? mix(640, 1150, pre) : mix(1420, 1520, after)) * (1 + 0.025 * down * dropK) * mix(1, 2.6, exitK);
  const s = Hh / VISOR_GEOM.IH;
  const vcy = dropK < 1 ? mix(470, 540, pre) : 540;
  const helmetOp = ramp(abs, fr(T_SWAP - 0.1), 14, cubicInOut) * (1 - ramp(abs, fr(END) - 8, 8));
  const chop = t >= DROP - 0.05 ? chopPulse(t) : 0;
  const eqLevel = mix(0.35, 1, dropK) * (dropK < 1 ? 0.3 + 0.7 * pre : 1);
  // lay the EQ exactly over the A+ printed on the visor (measured bbox 292–619 × 409–744 image px)
  const msx = (619 - 292) / MARK_W,
    msy = (744 - 409) / MARK_H;

  const fadeIn = ramp(abs, fr(T_IN), 10);

  return (
    <AbsoluteFill style={{ background: "#040506", opacity: fadeIn }}>
      {/* haze + stage lights */}
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 60% 55% at 50% 38%, rgba(${C.blueRGB},${0.1 + 0.18 * rise + 0.1 * kick * after}) 0%, transparent 70%)` }} />
      {[-1, 0, 1].map((k) => (
        <div key={k} style={{ position: "absolute", left: 960 - 170, top: -140, width: 340, height: 1500, transformOrigin: "50% 0%",
          transform: `rotate(${k * 24 + Math.sin(sweep + k * 1.7) * 14}deg)`,
          background: `linear-gradient(180deg, rgba(${C.blueRGB},${(0.18 + 0.22 * mids) * rim * (1 - 0.6 * after)}) 0%, rgba(${C.blueRGB},0) 75%)`,
          clipPath: "polygon(44% 0, 56% 0, 100% 100%, 0 100%)", filter: "blur(6px)" }} />
      ))}

      {/* act 1 */}
      {standOp > 0 && (
        <AbsoluteFill style={{ opacity: standOp, filter: `blur(${ramp(abs, fr(T_SWAP), 16) * 8}px)` }}>
          {/* the line passes behind him at the waist */}
          <div style={{ position: "absolute", left: 0, top: cy + (SH * 0.49 - HEAD.y) * S, width: 1920, height: Math.max(3, 4 * z * 0.6), background: C.blue,
            transform: `scaleX(${ramp(abs, fr(T_IN + 0.5), 50, expoOut)})`, boxShadow: `0 0 ${18 + 30 * kick}px rgba(${C.blueRGB},0.9)` }} />
          {/* floor glow */}
          <div style={{ position: "absolute", left: cx - 520 * z, top: cy + (SH * 0.985 - HEAD.y) * S - 30 * z, width: 1040 * z, height: 60 * z, borderRadius: "50%",
            background: `radial-gradient(closest-side, rgba(${C.blueRGB},${0.35 * rim}), transparent)` }} />
          <Img src={staticFile("images/dj/stand.png")} style={{ position: "absolute", left: cx - HEAD.x * S, top: cy - HEAD.y * S, width: SW * S, height: SH * S,
            filter: `brightness(${mix(0.08, 0.95, lit)}) contrast(1.05) drop-shadow(0 0 ${6 + 10 * rim}px rgba(${C.blueRGB},${0.55 * rim}))` }} />
          {/* visor glows with the music */}
          <div style={{ position: "absolute", left: cx - 120 * z, top: cy - 120 * z, width: 240 * z, height: 240 * z, borderRadius: "50%",
            background: `radial-gradient(closest-side, rgba(${C.blueRGB},${(0.25 + 0.5 * mids) * rim}), transparent)`, mixBlendMode: "screen" }} />
        </AbsoluteFill>
      )}

      {/* act 2 */}
      {helmetOp > 0 && (
        <AbsoluteFill style={{ opacity: helmetOp }}>
          <AbsoluteFill style={{ opacity: mix(0.25, 1, dropK) * (1 - exitK) }}>
            <SideEQ abs={abs} level={mix(0.3, 1, dropK)} />
          </AbsoluteFill>
          <div style={{ position: "absolute", left: 960 - VISOR_GEOM.cx * s, top: vcy - VISOR_GEOM.cy * s, width: VISOR_GEOM.IW * s, height: Hh,
            WebkitMaskImage: "linear-gradient(180deg, #000 0%, #000 72%, transparent 97%), linear-gradient(90deg, transparent 0%, #000 12%, #000 88%, transparent 100%)",
            WebkitMaskComposite: "source-in" }}>
            <Helmet abs={abs} height={Hh} ids={[]} lights={mix(0.6, 1, pre)} dim={0.9} groove={dropK}
              overlay={
                <g transform={`translate(292 409) scale(${msx} ${msy})`} opacity={0.35 + 0.65 * pre}>
                  <MarkEQ abs={abs} level={eqLevel} fill={chop * 0.95 + exitK} />
                </g>
              } />
          </div>
          {/* each "yeah" throws a pulse of light off the visor */}
          <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 50%, rgba(${C.blueRGB},${0.28 * chop}) 0%, transparent 45%)`, mixBlendMode: "screen" }} />
        </AbsoluteFill>
      )}

      {/* the drop */}
      <AbsoluteFill style={{ background: "#fff", opacity: 0.75 * Math.exp(-Math.max(0, t - DROP) * 9) * (t >= DROP - 0.02 ? 1 : 0) }} />
      <AbsoluteFill style={{ background: "#000", opacity: ramp(abs, fr(END) - 6, 6) }} />
    </AbsoluteFill>
  );
};
