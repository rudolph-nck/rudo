import React from "react";
import { C, glow } from "../theme";
import { Mono } from "../typography/Type";
import { cubicInOut, expoIn, mix, ramp } from "../utils/ease";
import { beatPulse, FPS } from "../utils/time";
import { chopStrobe, Crowd } from "./Crowd";
import { DJ, DJStage } from "./DJ";

/**
 * The beat drop: a wide concert shot. The DJ plays on stage, beams sweep, the
 * brand line runs along the stage edge, and a crowd jumps on the beat in the
 * foreground. Every chopped "yeah" fires a strobe and throws hands up.
 * `f` = frames since the drop; `outAt` = frames at which to push into the line.
 */
export const ConcertDrop: React.FC<{ abs: number; f: number; outAt: number }> = ({ abs, f, outAt }) => {
  const strobe = chopStrobe(abs);
  const kick = beatPulse(abs, 5);
  const push = ramp(f, 0, outAt, cubicInOut);
  const out = ramp(f, outAt - 10, 12, expoIn);
  const scale = mix(1.0, 1.08, push) * mix(1, 1.9, out);
  const drift = Math.sin((abs / FPS) * 0.35) * 40;
  const stageY = 680;
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#050607" }}>
      <div style={{ position: "absolute", inset: 0, transform: `scale(${scale})`, transformOrigin: `50% ${(stageY / 1080) * 100}%` }}>
        <DJStage abs={abs} lights={1} cx={960} cy={220} />
        {/* strobe wash from the stage */}
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 60% 55% at 50% 40%, rgba(220,245,255,${0.35 * strobe}), rgba(${C.blueRGB},${0.18 * strobe}) 45%, rgba(0,0,0,0) 75%)` }} />
        <div style={{ position: "absolute", left: 960 + drift * 0.15, top: stageY, transform: "translate(-50%,-100%)" }}>
          <DJ abs={abs} width={980} lights={1} />
        </div>
        {/* the line — the stage edge */}
        <div style={{ position: "absolute", left: 0, top: stageY + 4, width: 1920, height: 5, background: C.blue, filter: glow(0.9 + 0.8 * kick) }} />
        <div style={{ position: "absolute", left: 0, top: stageY + 9, width: 1920, height: 160, background: "linear-gradient(180deg, rgba(0,178,227,0.14), rgba(0,0,0,0))" }} />
        {/* backlight haze between stage and crowd so the silhouettes read */}
        <div style={{ position: "absolute", left: -200, right: -200, top: stageY - 40, height: 420,
          background: `radial-gradient(ellipse 70% 60% at 50% 30%, rgba(${C.blueRGB},${0.32 + 0.15 * kick + 0.25 * strobe}), rgba(${C.blueRGB},0.06) 60%, rgba(0,0,0,0) 85%)` }} />
        <Crowd abs={abs} driftX={drift} />
      </div>
      <div style={{ position: "absolute", left: 110, top: 96, opacity: 1 - out }}>
        <Mono text="ADDAPALOOZA · THE SUMMIT 2026 · LIVE" t={f} size={16} opacity={0.65} />
      </div>
      <div style={{ position: "absolute", inset: 0, background: `rgba(255,255,255,${0.12 * strobe})`, mixBlendMode: "screen" }} />
      <div style={{ position: "absolute", inset: 0, background: "#060708", opacity: ramp(f, outAt - 3, 4) }} />
    </div>
  );
};
