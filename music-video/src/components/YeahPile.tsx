import React, { useMemo } from "react";
import chops from "../../data/chops.json";
import { C, F } from "../theme";
import { clamp01, expoIn, expoOut, mix, softBack } from "../utils/ease";
import { rng } from "../utils/random";
import { beatPulse, FPS } from "../utils/time";

/**
 * The chopped "yeah"s on the beat drop: every chop (data/chops.json, onsets
 * from the vocal stem) slams a YEAH! onto the screen. They pile up, breathe on
 * the beat, older ones recede — then the whole pile collapses into the line.
 */
export const YeahPile: React.FC<{ abs: number; collapseAt: number; lineY?: number }> = ({ abs, collapseAt, lineY = 700 }) => {
  const t = abs / FPS;
  const items = useMemo(() => {
    const r = rng(2993);
    // composed slots so the pile fills the frame without burying itself
    const slots = [
      [0.5, 0.46], [0.22, 0.3], [0.78, 0.62], [0.3, 0.72], [0.72, 0.28], [0.52, 0.8], [0.14, 0.55], [0.84, 0.42],
      [0.4, 0.22], [0.62, 0.56], [0.24, 0.86], [0.82, 0.82], [0.46, 0.36], [0.14, 0.2], [0.66, 0.2], [0.34, 0.52],
    ];
    return chops.yeah.map((on, i) => {
      const [sx, sy] = slots[i % slots.length];
      const big = i === 0 || i % 5 === 4;
      return {
        on,
        x: sx * 1920 + (r() - 0.5) * 120,
        y: sy * 1080 + (r() - 0.5) * 80,
        size: big ? 260 + r() * 60 : 110 + r() * 110,
        rot: (r() - 0.5) * 24,
        style: i % 4 === 3 ? "outline" : i % 3 === 1 ? "blue" : "solid",
        dir: r() < 0.5 ? -1 : 1,
      };
    });
  }, []);
  const collapse = expoIn(clamp01((t - collapseAt) / 0.4));
  const bp = beatPulse(abs, 6);
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      {items.map((it, i) => {
        const dt = t - it.on;
        if (dt < -0.02) return null;
        const pop = softBack(clamp01((dt + 0.02) / 0.16));
        const age = items.filter((o) => o.on > it.on && o.on <= t).length; // newer yeahs on top
        const fade = Math.max(0.28, 1 - age * 0.12);
        const drift = dt * 14 * it.dir;
        const x = mix(it.x + drift, 960, collapse);
        const y = mix(it.y, lineY, collapse);
        const sc = mix(1.35, 1, pop) * (1 + 0.05 * bp) * mix(1, 0.05, collapse);
        const fill = it.style === "blue" ? C.blue : it.style === "outline" ? "transparent" : C.white;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              transform: `translate(-50%,-50%) rotate(${mix(it.rot, 0, collapse)}deg) scale(${sc}) skewX(${-8 * (1 - expoOut(clamp01(dt / 0.3)))}deg)`,
              opacity: clamp01(dt / 0.04 + 0.2) * fade * (1 - collapse * 0.6),
              fontFamily: F.hero,
              fontWeight: 800,
              fontStyle: "italic",
              fontSize: it.size,
              lineHeight: 1,
              letterSpacing: "-0.04em",
              whiteSpace: "nowrap",
              color: fill,
              WebkitTextStroke: it.style === "outline" ? `${Math.max(2, it.size / 60)}px ${C.white}` : undefined,
              textShadow: it.style === "blue" ? `0 0 ${24 + 30 * bp}px rgba(${C.blueRGB},0.6)` : undefined,
              zIndex: i,
            }}
          >
            YEAH!
          </div>
        );
      })}
    </div>
  );
};
