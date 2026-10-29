import React from "react";
import { AbsoluteFill, Audio, staticFile, useCurrentFrame } from "remotion";
import { DURATION_FRAMES, FPS, sectionById } from "../data";
import { Intro } from "../intro/Intro";
import { useIntroAssets } from "../intro/Scene3D";
import { Verse1 } from "./Verse1";

/** The full song in the v3 style, assembled section by section as each is approved. */
export const SONG_FRAMES = DURATION_FRAMES;
const V1 = sectionById("verse1");

export const Song: React.FC<{ muted?: boolean }> = ({ muted }) => {
  const t = useCurrentFrame() / FPS;
  const assets = useIntroAssets();
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {t < V1.start + 0.05 ? <Intro muted /> : null}
      {t >= V1.start && t < 51.0 ? <Verse1 t={t} assets={assets} /> : null}
      {muted ? null : <Audio src={staticFile("audio/shout-it-to-the-sky.m4a")} />}
    </AbsoluteFill>
  );
};
