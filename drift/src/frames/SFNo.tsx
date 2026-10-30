import React from "react";
import { AbsoluteFill } from "remotion";
import { LINES, heroOf, vol } from "../data";
import { F } from "../utils/fonts";
import { clamp01, cubicInOut } from "../utils/ease";
import { Stage } from "../three/Stage";
import { Glow, useStarfield } from "../words/points";
import { LightPath, LineDefs, at } from "../words/lines";
import { Caption, Finish, Full } from "./kit";

/** ERASE: a calendar drawn in light; on NO the hot point runs back along its own path and unwrites it. */
const LI = 28;
const X = 150, Y = 0, CW = 780, CH = 760, R = 46;
const rr = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x + r} ${y} H${x + w - r} A${r} ${r} 0 0 1 ${x + w} ${y + r} V${y + h - r} A${r} ${r} 0 0 1 ${x + w - r} ${y + h} H${x + r} A${r} ${r} 0 0 1 ${x} ${y + h - r} V${y + r} A${r} ${r} 0 0 1 ${x + r} ${y} Z`;
const ring = (cx: number) => `M${cx - 18} ${Y + 30} V${Y - 34} A18 18 0 0 1 ${cx + 18} ${Y - 34} V${Y + 30}`;
const GX = X + 52, GY = Y + 230, GW = CW - 104, GH = CH - 290, COLS = 7, ROWS = 5;
export const CALENDAR = [
  rr(X, Y, CW, CH, R),
  `M${X} ${Y + 150} H${X + CW}`,
  ring(X + 190), ring(X + CW - 190),
  ...Array.from({ length: ROWS + 1 }, (_, r) => `M${GX} ${GY + (GH * r) / ROWS} H${GX + GW}`),
  ...Array.from({ length: COLS + 1 }, (_, c) => `M${GX + (GW * c) / COLS} ${GY} V${GY + GH}`),
  // deadline circles on three days
  ...[[2, 1], [4, 2], [5, 4]].map(([c, r]) => { const cx = GX + (GW * (c + 0.5)) / COLS, cy = GY + (GH * (r + 0.5)) / ROWS; return `M${cx + 36} ${cy} A36 36 0 1 1 ${cx + 35.9} ${cy - 4}`; }),
].join(" ");

export const SFNo: React.FC<{ t: number }> = ({ t }) => {
  const w = heroOf(LI);
  const noW = LINES[LI].words[0];
  const stars = useStarfield(4000, 51, [40, 70, 60], [0, 0, -28]);
  const draw = clamp01((t - (noW.s - 1.6)) / 1.2);
  const erase = cubicInOut(clamp01((t - noW.s) / Math.max(0.6, w.e - noW.s + 0.3)));
  const head = at(CALENDAR, draw * (1 - erase));
  const cells = Math.round(35 * (1 - erase));
  const day = (i: number) => i - 2; // month starts on a Wednesday
  const noGlow = 0.6 + vol(noW, t) + vol(w, t) * 0.5;
  return (
    <Full bg="#030303">
      <Stage cam={{ pos: [0, 0, 6], look: [0, 0, 0], fov: 40 }} look={{ bloom: { strength: 0.8, radius: 0.5, threshold: 0.6 }, bg: "#030303" }}>
        <Glow geo={stars} size={5} gain={0.45} time={t} twinkle={0.4} />
      </Stage>
      <LineDefs />
      <AbsoluteFill style={{ perspective: 1600 }}>
        <div style={{ position: "absolute", left: 0, top: 640, width: 1080, height: 900, transform: "rotateX(14deg) rotateY(-10deg) rotateZ(-2deg)", transformOrigin: "50% 40%" }}>
          <svg width={1080} height={900} viewBox={`0 -80 1080 900`} style={{ overflow: "visible" }}>
            {/* ghost of what was erased: a faint afterimage */}
            <path d={CALENDAR} stroke="rgba(255,236,214,0.06)" strokeWidth={3} fill="none" />
            {Array.from({ length: 35 }, (_, i) => {
              const c = i % 7, r = Math.floor(i / 7);
              return i < cells && day(i) >= 1 && day(i) <= 31 ? (
                <text key={i} x={GX + (GW * c) / COLS + 14} y={GY + (GH * r) / ROWS + 34} fontFamily={F.mono} fontSize={22} fill="rgba(239,237,233,0.55)">{day(i)}</text>
              ) : null;
            })}
            <text x={X + 52} y={Y + 104} fontFamily={F.mono} fontSize={40} letterSpacing="0.2em" fill={`rgba(239,237,233,${0.8 * (1 - erase)})`}>DEADLINES</text>
            <LightPath d={CALENDAR} draw={draw} erase={erase} w={3.4} cool={1} t={t} seed={3} head={false} />
          </svg>
        </div>
      </AbsoluteFill>
      {/* NO, white-hot */}
      <div style={{ position: "absolute", left: 0, top: 330, width: 1080, textAlign: "center", fontFamily: F.display, fontSize: 330, lineHeight: 1, color: "#fffaf3", opacity: t >= noW.s ? 1 : 0, textShadow: `0 0 ${30 * noGlow}px rgba(255,236,210,0.9), 0 0 ${110 * noGlow}px rgba(255,214,170,0.45)` }}>NO</div>
      {/* the hot point sits at the erase head; drawn in screen space through the same transform */}
      <AbsoluteFill style={{ perspective: 1600 }}>
        <div style={{ position: "absolute", left: 0, top: 640, width: 1080, height: 900, transform: "rotateX(14deg) rotateY(-10deg) rotateZ(-2deg)", transformOrigin: "50% 40%" }}>
          <svg width={1080} height={900} viewBox="0 -80 1080 900" style={{ overflow: "visible" }}>
            <LightPathHead x={head.x} y={head.y} t={t} on={erase > 0 && erase < 1} />
          </svg>
        </div>
      </AbsoluteFill>
      <Caption line={LINES[LI]} t={t} hero="deadlines" top={1700} align="center" size={34} />
      <Finish grain={0.08} />
    </Full>
  );
};

import { HotPoint } from "../words/lines";
const LightPathHead: React.FC<{ x: number; y: number; t: number; on: boolean }> = ({ x, y, t, on }) => (on ? <HotPoint x={x} y={y} r={20} t={t} seed={5} sparks={14} /> : null);
