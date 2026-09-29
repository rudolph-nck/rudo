import React from "react";
import { Img, staticFile } from "remotion";
import { C } from "../theme";
import { clamp01 } from "../utils/ease";
import { beatIndex, beatPulse, BEATS, downbeatPulse, FPS } from "../utils/time";

/** Source layer geometry (image px of the keyed booth, 1118×669). */
const IW = 1118,
  IH = 669;
const NECK = { x: 575 / IW, y: 118 / IH };
const HIPS = { x: 570 / IW, y: 292 / IH };

const Layer: React.FC<{ name: string; style?: React.CSSProperties; glow?: number }> = ({ name, style, glow = 0 }) => (
  <div style={{ position: "absolute", inset: 0, ...style }}>
    <Img src={staticFile(`images/dj/${name}.png`)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
    {glow > 0.01 && (
      <Img src={staticFile(`images/dj/${name}-glow.png`)}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", mixBlendMode: "screen", opacity: glow }} />
    )}
  </div>
);

/**
 * The Addapalooza DJ, performing: head nods and tilts on the beat, body bounces
 * and sways over the bar, emissive LEDs (visor, jacket, gloves, booth) flare on
 * the kick. Everything is derived from the beat grid, so it is in time with the song.
 */
export const DJ: React.FC<{ abs: number; width: number; lights?: number; energy?: number }> = ({ abs, width, lights = 1, energy = 1 }) => {
  const h = (width * IH) / IW;
  const bp = beatPulse(abs, 7) * energy;
  const db = downbeatPulse(abs, 5) * energy;
  const bi = beatIndex(abs);
  const t = abs / FPS;
  // continuous phase across the bar for sway
  const b0 = BEATS[Math.max(0, bi)] ?? 0;
  const b1 = BEATS[Math.max(0, bi) + 1] ?? b0 + 0.557;
  const beatPhase = clamp01((t - b0) / (b1 - b0));
  const barPhase = (((bi - 2) % 4) + 4) % 4 + beatPhase; // 0..4
  const sway = Math.sin((barPhase / 4) * Math.PI * 2) * energy;
  const side = bi % 2 === 0 ? 1 : -1;

  const bodyY = bp * 0.012 * h;
  const bodyRot = sway * 1.1;
  const headY = bodyY + bp * 0.012 * h;
  const headRot = bodyRot * 0.6 - bp * 5 + side * 1.6 * energy;
  const glowBase = lights * (0.25 + 0.75 * Math.max(bp, db * 0.8));

  return (
    <div style={{ position: "relative", width, height: h }}>
      {/* floor reflection */}
      <div style={{ position: "absolute", left: 0, top: h - 4, width, height: h * 0.45, overflow: "hidden", opacity: 0.16 * lights,
        WebkitMaskImage: "linear-gradient(180deg, rgba(0,0,0,0.9), transparent 80%)" }}>
        <div style={{ position: "absolute", left: 0, top: -h + h * 0.02, width, height: h, transform: "scaleY(-1)", transformOrigin: "50% 100%" }}>
          <Layer name="base" />
        </div>
      </div>
      <div style={{ position: "absolute", inset: 0, filter: `brightness(${0.35 + 0.65 * lights})` }}>
        <Layer name="body" glow={glowBase}
          style={{ transform: `translateY(${bodyY}px) rotate(${bodyRot}deg)`, transformOrigin: `${HIPS.x * 100}% ${HIPS.y * 100}%` }} />
        <Layer name="head" glow={Math.min(1, glowBase * 1.2 + 0.15 * lights)}
          style={{ transform: `translateY(${headY}px) rotate(${headRot}deg)`, transformOrigin: `${NECK.x * 100}% ${NECK.y * 100}%` }} />
        <Layer name="base" glow={glowBase * 0.8} />
      </div>
    </div>
  );
};

/** Stage behind the DJ: slow-sweeping beams and haze, beat-lit. */
export const DJStage: React.FC<{ abs: number; lights?: number; cx?: number; cy?: number }> = ({ abs, lights = 1, cx = 960, cy = 300 }) => {
  const bp = beatPulse(abs, 5);
  const t = abs / FPS;
  const beams = [-38, -22, -8, 8, 22, 38];
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", opacity: lights }}>
      <div style={{ position: "absolute", left: cx - 900, top: cy - 520, width: 1800, height: 1100,
        background: `radial-gradient(closest-side, rgba(${C.blueRGB},${0.22 + 0.12 * bp}), rgba(${C.blueRGB},0.05) 60%, rgba(0,0,0,0))` }} />
      {beams.map((a, i) => {
        const ang = a + Math.sin(t * 0.6 + i * 1.3) * 9;
        const on = 0.18 + 0.35 * bp * (i % 2 === (Math.floor(t / 0.557) % 2) ? 1 : 0.4);
        return (
          <div key={i} style={{ position: "absolute", left: cx - 3, top: -80, width: 6, height: 1500, transformOrigin: "50% 0%",
            transform: `rotate(${ang}deg) scaleX(${14 + 10 * (i % 3)})`,
            background: `linear-gradient(180deg, rgba(${i % 3 === 1 ? "255,255,255" : C.blueRGB},${on}) 0%, rgba(${C.blueRGB},0) 75%)`,
            mixBlendMode: "screen" }} />
        );
      })}
    </div>
  );
};
