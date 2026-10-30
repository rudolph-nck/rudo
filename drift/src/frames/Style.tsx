import React from "react";
import { useCurrentFrame } from "remotion";
import { FPS, LINES, heroOf } from "../data";
import { SFShelf } from "./SFShelf";
import { SFEnvy } from "./SFEnvy";
import { SFBreak } from "./SFBreak";
import { SFStars } from "./SFStars";
import { SFNo } from "./SFNo";
import { SFFather } from "./SFFather";
import { SFDrift } from "./SFDrift";
import { SFKeep } from "./SFKeep";

/** Style frames: each is a real scene at a chosen song time; t0 + frame/30 is song time. */
export const STYLE: Record<string, { t: number; C: React.FC<{ t: number }> }> = {
  weight: { t: 33.75, C: SFShelf },
  envy: { t: heroOf(14).s + 0.5, C: SFEnvy },
  break: { t: heroOf(23).s + 0.75, C: SFBreak },
  stars: { t: heroOf(26).s + 0.6, C: SFStars },
  no: { t: heroOf(28).s + 0.75, C: SFNo },
  father: { t: LINES[45].words[5].s + 1.2, C: SFFather },
  drift: { t: heroOf(34).s + 2.2, C: SFDrift },
  keep: { t: heroOf(91).s + 0.3, C: SFKeep },
};

export const StyleFrame: React.FC<{ id: string; t0?: number }> = ({ id, t0 }) => {
  const f = useCurrentFrame();
  const S = STYLE[id];
  return <S.C t={(t0 ?? S.t) + f / FPS} />;
};
