import React from "react";
import { Composition, useCurrentFrame } from "remotion";
import { FPS } from "./data";
import { ensureFonts } from "./utils/fonts";
import { StyleFrame } from "./frames/Style";
import { AudioTrack, S1, S1_END } from "./sections/S1";
import { Intro, INTRO_END } from "./sections/Intro";
import { V1B, V1B_START, V1B_END } from "./sections/V1B";
import { Audio, staticFile } from "remotion";

ensureFonts();

const S1Comp: React.FC<{ muted?: boolean }> = ({ muted }) => {
  const f = useCurrentFrame();
  return (
    <>
      {muted ? null : <AudioTrack />}
      <S1 t={f / FPS} />
    </>
  );
};

const IntroComp: React.FC<{ muted?: boolean }> = ({ muted }) => {
  const f = useCurrentFrame();
  return (
    <>
      {muted ? null : <AudioTrack />}
      <Intro t={f / FPS} />
    </>
  );
};

/** Verse 1 (0:23.0–0:57.4): the bedroom (S1's room) then the void (V1B). */
const V1_START = 23.0;
const V1Comp: React.FC<{ muted?: boolean }> = ({ muted }) => {
  const f = useCurrentFrame();
  const t = V1_START + f / FPS;
  return (
    <>
      {muted ? null : <Audio src={staticFile("audio/drift.m4a")} startFrom={Math.round(V1_START * FPS)} />}
      {t < V1B_START ? <S1 t={t} /> : <V1B t={t} />}
    </>
  );
};

export const Root: React.FC = () => (
  <>
    <Composition id="Style" component={StyleFrame} durationInFrames={120} fps={FPS} width={1080} height={1920} defaultProps={{ id: "weight" } as { id: string; t0?: number }} />
    <Composition id="Intro" component={IntroComp} durationInFrames={Math.round(INTRO_END * FPS)} fps={FPS} width={1080} height={1920} defaultProps={{ muted: false }} />
    <Composition id="V1" component={V1Comp} durationInFrames={Math.round((V1B_END - V1_START) * FPS)} fps={FPS} width={1080} height={1920} defaultProps={{ muted: false }} />
    <Composition id="S1" component={S1Comp} durationInFrames={Math.round(S1_END * FPS)} fps={FPS} width={1080} height={1920} defaultProps={{ muted: false }} />
  </>
);
