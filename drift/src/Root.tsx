import React from "react";
import { Composition, useCurrentFrame } from "remotion";
import { FPS } from "./data";
import { ensureFonts } from "./utils/fonts";
import { StyleFrame } from "./frames/Style";
import { AudioTrack, S1, S1_END } from "./sections/S1";
import { Intro, INTRO_END } from "./sections/Intro";

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

export const Root: React.FC = () => (
  <>
    <Composition id="Style" component={StyleFrame} durationInFrames={120} fps={FPS} width={1080} height={1920} defaultProps={{ id: "weight" } as { id: string; t0?: number }} />
    <Composition id="Intro" component={IntroComp} durationInFrames={Math.round(INTRO_END * FPS)} fps={FPS} width={1080} height={1920} defaultProps={{ muted: false }} />
    <Composition id="S1" component={S1Comp} durationInFrames={Math.round(S1_END * FPS)} fps={FPS} width={1080} height={1920} defaultProps={{ muted: false }} />
  </>
);
