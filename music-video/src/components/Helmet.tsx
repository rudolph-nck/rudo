import React from "react";
import { Img, staticFile } from "remotion";
import { C, F } from "../theme";
import { clamp01, cubicOut } from "../utils/ease";
import { scene } from "../utils/scenes";
import { beatIndex, beatPulse, BEATS, FPS, lyric } from "../utils/time";

/** helmet-close.png is 896×1108 (Real-ESRGAN ×4 of the character sheet); visor glass centred here (image px). */
const IW = 896,
  IH = 1108;
const VISOR = { cx: 455, cy: 588, rx: 240, ry: 272 };
const TEXT_W = 380,
  TEXT_H = 360;

/**
 * The DJ's helmet in close-up, its visor used as an LED lyric screen: the
 * A+ dims while a line plays and each word lights up as it is sung.
 */
export const VISOR_GEOM = { IW, IH, ...VISOR };

export const Helmet: React.FC<{
  abs: number;
  height: number;
  ids: string[];
  lights?: number;
  /** extra visor dimming 0..1 (to let an overlay own the glass) */
  dim?: number;
  /** drawn over the visor glass, in image pixels (896×1108) */
  overlay?: React.ReactNode;
  groove?: number;
}> = ({ abs, height, ids, lights = 1, dim = 0, overlay, groove = 1 }) => {
  const s = height / IH;
  const w = IW * s;
  const t = abs / FPS;

  // smooth nod on the beat (continuous — never snaps)
  const bi = Math.max(0, beatIndex(abs));
  const b0 = BEATS[bi] ?? 0;
  const b1 = BEATS[bi + 1] ?? b0 + 0.557;
  const ph = clamp01((t - b0) / (b1 - b0));
  const dip = (1 + Math.cos(ph * Math.PI * 2)) / 2;
  const nod = (dip - 0.5) * 2.2 * groove;
  const sway = Math.sin((t / (0.557 * 8)) * Math.PI * 2) * 1.2 * groove;

  // current visor line
  let line: ReturnType<typeof lyric> | undefined;
  for (const id of ids) {
    const l = lyric(id);
    if (l.start - 0.1 <= t) line = l;
  }
  const next = line ? ids.map(lyric).find((l) => l.start > line!.start) : undefined;
  const lineEnd = next ? next.start - 0.12 : line ? line.hold : 0;
  const on = line && t <= lineEnd ? 1 : 0;
  const display = line ? scene(line.id).display.split(" ") : [];
  const longest = Math.max(4, ...display.map((d) => d.length));
  const chars = display.join(" ").length;
  const fs = Math.min(84, TEXT_W / (longest * 0.72), Math.sqrt((TEXT_W * TEXT_H * 0.62) / Math.max(1, chars * 0.7))) * s;
  const presence = on * clamp01((t - (line?.start ?? 0) + 0.1) / 0.15);
  const kick = beatPulse(abs, 5);

  return (
    <div style={{ position: "relative", width: w, height, transform: `rotate(${nod + sway}deg) translateY(${dip * 6 * groove}px)`, transformOrigin: "52% 85%" }}>
      <Img src={staticFile("images/dj/helmet-close.png")} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", filter: `brightness(${0.55 + 0.45 * lights})` }} />
      {/* visor glass: dim the A+ while the LED text plays */}
      <div
        style={{
          position: "absolute",
          left: (VISOR.cx - VISOR.rx) * s,
          top: (VISOR.cy - VISOR.ry) * s,
          width: VISOR.rx * 2 * s,
          height: VISOR.ry * 2 * s,
          borderRadius: "50%",
          background: "radial-gradient(closest-side, rgba(2,4,12,0.94) 62%, rgba(2,4,12,0.6) 85%, rgba(2,4,12,0) 100%)",
          opacity: Math.min(0.97, 0.25 + 0.72 * presence + dim),
        }}
      />
      {overlay && (
        <svg width={w} height={height} viewBox={`0 0 ${IW} ${IH}`} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
          {overlay}
        </svg>
      )}
      {/* LED lyric */}
      {on > 0 && line && (
        <div
          style={{
            position: "absolute",
            left: (VISOR.cx - TEXT_W / 2) * s,
            top: (VISOR.cy - TEXT_H / 2 + 10) * s,
            width: TEXT_W * s,
            height: TEXT_H * s,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontFamily: F.hero,
              fontWeight: 800,
              fontSize: fs,
              lineHeight: 1.0,
              textTransform: "uppercase",
              color: "#dff7ff",
              letterSpacing: "0.01em",
              textShadow: `0 0 ${6 * s}px rgba(${C.blueRGB},1), 0 0 ${22 * s}px rgba(${C.blueRGB},${0.7 + 0.3 * kick})`,
              WebkitMaskImage: "radial-gradient(circle at 50% 50%, #000 60%, rgba(0,0,0,0.25) 66%)",
              WebkitMaskSize: `${Math.max(3, 6 * s)}px ${Math.max(3, 6 * s)}px`,
            }}
          >
            {line.words.map((wd, i) => {
              const p = cubicOut(clamp01((t - (wd.t - 0.05)) / 0.12));
              return (
                <span key={i} style={{ display: "inline-block", marginRight: "0.22em", opacity: p, filter: p < 1 ? `brightness(${1 + (1 - p) * 2})` : undefined }}>
                  {display[i] ?? wd.w}
                </span>
              );
            })}
          </div>
        </div>
      )}
      {/* glass sheen */}
      <div
        style={{
          position: "absolute",
          left: (VISOR.cx - VISOR.rx) * s,
          top: (VISOR.cy - VISOR.ry) * s,
          width: VISOR.rx * 2 * s,
          height: VISOR.ry * 2 * s,
          borderRadius: "50%",
          overflow: "hidden",
          mixBlendMode: "screen",
          opacity: 0.35,
        }}
      >
        <div style={{ position: "absolute", top: 0, bottom: 0, width: "30%", left: `${((t * 18) % 160) - 40}%`, transform: "skewX(-18deg)",
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)" }} />
      </div>
    </div>
  );
};
