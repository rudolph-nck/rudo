import React from "react";
import { C } from "../theme";
import { clamp01 } from "../utils/ease";
import { scene } from "../utils/scenes";
import { Mono, Narrative } from "./Type";

/**
 * Narrative lyric caption. Shows whichever of `ids` is active at local
 * frame `f`, reading text + hero phrase from the scene manifest.
 */
export const Caption: React.FC<{
  f: number;
  offset: number; // chapter start frame (absolute)
  ids: string[];
  x?: number;
  y?: number;
  size?: number;
  width?: number;
  prefix?: string;
  color?: string;
  outDur?: number;
  align?: "left" | "right" | "center";
  hide?: string[];
}> = ({ f, offset, ids, x = 120, y = 870, size = 38, width = 1100, prefix, color = C.white, outDur = 8, align = "left", hide = [] }) => {
  const abs = f + offset;
  let cur = -1;
  ids.forEach((id, i) => {
    if (abs >= scene(id).startFrame - 3) cur = i;
  });
  if (cur < 0) return null;
  const id = ids[cur];
  if (hide.includes(id)) return null;
  const s = scene(id);
  const t = abs - s.startFrame + 3;
  const out = clamp01((abs - (s.endFrame - outDur)) / outDur);
  if (out >= 1) return null;
  return (
    <div style={{ position: "absolute", left: x, top: y, width, textAlign: align }}>
      {prefix && (
        <div style={{ marginBottom: 12, opacity: 1 - out }}>
          <Mono text={`${prefix}.${String(cur + 1).padStart(2, "0")}`} t={t} size={13} opacity={0.45} />
        </div>
      )}
      <Narrative text={s.display} hero={s.heroWord} t={t} out={out} size={size} color={color} align={align} />
    </div>
  );
};
