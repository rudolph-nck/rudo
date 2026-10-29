import React from "react";
import { AbsoluteFill, Audio, staticFile, useCurrentFrame } from "remotion";
import { DURATION_FRAMES, FPS, sectionById } from "../data";
import { Intro } from "../intro/Intro";
import { useIntroAssets } from "../intro/Scene3D";
import { Verse1 } from "./Verse1";
import { Chorus, PostChorus, PreChorus } from "./Rise";

/** The full song in the v3 style, assembled section by section as each is approved. */
export const SONG_FRAMES = DURATION_FRAMES;
const V1 = sectionById("verse1");
const PRE1 = sectionById("prechorus1");
const CH1 = sectionById("chorus1");
const POST1 = sectionById("postchorus1");

export const Song: React.FC<{ muted?: boolean }> = ({ muted }) => {
  const t = useCurrentFrame() / FPS;
  const assets = useIntroAssets();
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {t < V1.start + 0.05 ? <Intro muted /> : null}
      {t >= V1.start && t < PRE1.start ? <Verse1 t={t} assets={assets} /> : null}
      {t >= PRE1.start && t < CH1.start ? <PreChorus t={t} a={assets} /> : null}
      {t >= CH1.start && t < POST1.start ? <Chorus t={t} a={assets} /> : null}
      {t >= POST1.start && t < POST1.end ? <PostChorus t={t} a={assets} /> : null}
      {muted ? null : <Audio src={staticFile("audio/shout-it-to-the-sky.m4a")} />}
    </AbsoluteFill>
  );
};
