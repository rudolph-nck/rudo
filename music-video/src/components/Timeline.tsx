import React from "react";
import { Obj } from "../three/Stage3D";
import { C, glow } from "../theme";
import { Mono } from "../typography/Type";
import { clamp01 } from "../utils/ease";

export const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
export const MONTH_STEP = 700;
export const monthX = (i: number) => 1400 + i * MONTH_STEP;

/**
 * The 2026 timeline — the brand line as a year ruler, in world space
 * (must be inside <Stage3D>). `active` month index is lit blue.
 */
export const TimelineRuler: React.FC<{
  y?: number;
  opacity?: number;
  active?: number;
  appear?: number;
  labelSize?: number;
  lineWidth?: number;
  from?: number;
  to?: number;
}> = ({ y = 0, opacity = 1, active = -1, appear = 1, labelSize = 26, lineWidth = 4, from = -3000, to = 10500 }) => {
  if (opacity <= 0.001) return null;
  return (
    <>
      <Obj x={from} y={y} anchor="left" opacity={opacity} cull={false}>
        <div style={{ width: (to - from) * clamp01(appear), height: lineWidth, background: C.blue, filter: glow(0.6) }} />
      </Obj>
      {MONTHS.map((m, i) => {
        const x = monthX(i);
        const on = i === active;
        return (
          <React.Fragment key={m}>
            <Obj x={x} y={y} anchor="bottom" opacity={opacity * appear}>
              <div style={{ width: on ? 3 : 2, height: on ? 110 : 64, background: on ? C.blue : C.white, opacity: on ? 1 : 0.7 }} />
            </Obj>
            <Obj x={x + 14} y={y - (on ? 116 : 70)} anchor="bottom-left" opacity={opacity * appear}>
              <Mono text={`${String(i + 1).padStart(2, "0")} · ${m} 2026`} t={999} size={labelSize} color={on ? C.blue : C.white} opacity={on ? 1 : 0.7} weight={500} />
            </Obj>
            <Obj x={x + MONTH_STEP / 2} y={y} anchor="top" opacity={opacity * appear * 0.8} cull>
              <div style={{ display: "flex", gap: MONTH_STEP / 10 - 1, marginTop: 8, transform: `translateX(-${MONTH_STEP / 2}px)` }}>
                {Array.from({ length: 10 }, (_, k) => (
                  <div key={k} style={{ width: 1, height: k === 5 ? 20 : 12, background: C.anchor }} />
                ))}
              </div>
            </Obj>
          </React.Fragment>
        );
      })}
    </>
  );
};
