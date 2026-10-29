import React, { useMemo } from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { H, W } from "../theme";
import { clamp01, cubicIn, expoOut } from "../utils/ease";
import { rng } from "../utils/random";

/** The room blows apart: the plate breaks into shards that fly up and past the camera. */
export const Shatter: React.FC<{ t: number; at: number; dur?: number }> = ({ t, at, dur = 1.0 }) => {
  const shards = useMemo(() => {
    const r = rng(77);
    const cols = 4, rows = 7;
    const gx = (i: number, j: number) => (i / cols) * W + (i > 0 && i < cols ? (r() - 0.5) * 110 : 0) + j * 0;
    const pts: [number, number][][] = [];
    for (let j = 0; j <= rows; j++) {
      pts.push([]);
      for (let i = 0; i <= cols; i++) pts[j].push([gx(i, j), (j / rows) * H + (j > 0 && j < rows ? (r() - 0.5) * 140 : 0)]);
    }
    const out: { poly: [number, number][]; cx: number; cy: number; vx: number; vy: number; rz: number; rx: number; delay: number }[] = [];
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const a = pts[j][i], b = pts[j][i + 1], c = pts[j + 1][i + 1], d = pts[j + 1][i];
        const tris = r() < 0.5 ? [[a, b, c], [a, c, d]] : [[a, b, d], [b, c, d]];
        for (const tri of tris) {
          const cx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3;
          const cy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
          out.push({
            poly: tri as [number, number][],
            cx,
            cy,
            vx: (cx - W / 2) * (1.6 + r() * 1.4),
            vy: -900 - (1 - cy / H) * 1400 - r() * 600,
            rz: (r() - 0.5) * 120,
            rx: (r() - 0.5) * 160,
            delay: (1 - cy / H) * 0.06 + r() * 0.05,
          });
        }
      }
    return out;
  }, []);
  if (t < at || t > at + dur) return null;
  const S = H; // plate scale used by <Room zoom={1}>
  return (
    <AbsoluteFill style={{ perspective: 1400, perspectiveOrigin: "50% 40%" }}>
      {shards.map((s, i) => {
        const p = clamp01((t - at - s.delay) / (dur - s.delay));
        const e = expoOut(p);
        const g = cubicIn(p);
        const clip = `polygon(${s.poly.map(([x, y]) => `${x.toFixed(0)}px ${y.toFixed(0)}px`).join(",")})`;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              inset: 0,
              clipPath: clip,
              transformOrigin: `${s.cx}px ${s.cy}px`,
              transform: `translate3d(${s.vx * e}px, ${s.vy * e + 900 * g * 0.3}px, ${e * 900}px) rotateZ(${s.rz * e}deg) rotateX(${s.rx * e}deg)`,
              opacity: 1 - clamp01((p - 0.55) / 0.45),
            }}
          >
            <Img src={staticFile("images/room.png")} style={{ position: "absolute", left: (W - S) / 2, top: 0, width: S, height: S, filter: "brightness(1.05)" }} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
