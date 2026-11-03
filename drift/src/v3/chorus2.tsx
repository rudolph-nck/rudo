import React from "react";
import { LINES } from "../data";
import { Chorus1V3, C1_START, C1_END } from "./chorus1";

/**
 * Chorus 2 (2:15.7–2:50.4): the same eleven lines as chorus 1, so the same objects, driven by chorus 2's own
 * timing: song time is mapped word-by-word onto chorus 1's clock, so every object still lands exactly when its
 * word is sung. The battery charges from empty to 61%, and the chorus fades down into the bridge.
 */
export const C2_START = 135.6;
export const C2_END = 170.4;
const A = LINES.slice(53, 64).flatMap((l) => l.words.map((w) => w.s));
const B = LINES.slice(24, 35).flatMap((l) => l.words.map((w) => w.s));
const src = [C2_START, ...A, C2_END], dst = [C1_START - 0.1, ...B, C1_END];
const mapT = (t: number) => {
  if (t <= src[0]) return dst[0] + (t - src[0]);
  for (let i = 0; i < src.length - 1; i++) if (t <= src[i + 1]) return dst[i] + ((t - src[i]) / (src[i + 1] - src[i])) * (dst[i + 1] - dst[i]);
  return dst[dst.length - 1] + (t - src[src.length - 1]);
};
export const Chorus2V3: React.FC<{ t: number }> = ({ t }) => <Chorus1V3 t={mapT(t)} real={t} batt={[0, 20, 20, 61]} end="dim" />;
