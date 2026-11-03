import React from "react";
import { Composition, useCurrentFrame } from "remotion";
import { FPS } from "./data";
import { setFormat } from "./theme";
import { LyricBar } from "./words/LyricBar";
import { FRAMES } from "./v3/frames";
import { Verse1V3, V1V3_START, V1V3_END } from "./v3/verse1";
import { Chorus1V3, C1_START, C1_END } from "./v3/chorus1";
import { useVideoConfig } from "remotion";
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
  const { width, height } = useVideoConfig();
  setFormat(width, height);
  return (
    <>
      {muted ? null : <AudioTrack />}
      <Intro t={f / FPS} />
      <LyricBar t={f / FPS} />
    </>
  );
};

/** Verse 1 (0:23.0–0:57.4): the bedroom (S1's room) then the void (V1B). */
const V1_START = 23.0;
const V1Comp: React.FC<{ muted?: boolean }> = ({ muted }) => {
  const f = useCurrentFrame();
  const t = V1_START + f / FPS;
  const { width, height } = useVideoConfig();
  setFormat(width, height);
  return (
    <>
      {muted ? null : <Audio src={staticFile("audio/drift.m4a")} startFrom={Math.round(V1_START * FPS)} />}
      {t < V1B_START ? <S1 t={t} /> : <V1B t={t} />}
      <LyricBar t={t} />
    </>
  );
};

/** Style frames for storyboard v3: one second per frame (0 alarm, 1 call, 2 battery, 3 voicemail, 4 xray). */
const V3Frames: React.FC = () => {
  const f = useCurrentFrame();
  const { width, height } = useVideoConfig();
  setFormat(width, height);
  const ids = Object.keys(FRAMES);
  const C = FRAMES[ids[Math.min(ids.length - 1, Math.floor(f / 30))]];
  return <C t={(f % 30) / 30} />;
};

const V1V3Comp: React.FC<{ muted?: boolean }> = ({ muted }) => {
  const f = useCurrentFrame();
  const t = V1V3_START + f / FPS;
  const { width, height } = useVideoConfig();
  setFormat(width, height);
  return (
    <>
      {muted ? null : <Audio src={staticFile("audio/drift.m4a")} startFrom={Math.round(V1V3_START * FPS)} />}
      <Verse1V3 t={t} />
      <LyricBar t={t} />
    </>
  );
};

const C1Comp: React.FC<{ muted?: boolean }> = ({ muted }) => {
  const f = useCurrentFrame();
  const t = C1_START + f / FPS;
  const { width, height } = useVideoConfig();
  setFormat(width, height);
  return (
    <>
      {muted ? null : <Audio src={staticFile("audio/drift.m4a")} startFrom={Math.round(C1_START * FPS)} />}
      <Chorus1V3 t={t} />
      <LyricBar t={t} />
    </>
  );
};

export const Root: React.FC = () => (
  <>
    <Composition id="Style" component={StyleFrame} durationInFrames={120} fps={FPS} width={1080} height={1920} defaultProps={{ id: "weight" } as { id: string; t0?: number }} />
    <Composition id="Intro" component={IntroComp} durationInFrames={Math.round(INTRO_END * FPS)} fps={FPS} width={1920} height={1080} defaultProps={{ muted: false }} />
    <Composition id="V1" component={V1Comp} durationInFrames={Math.round((V1B_END - V1_START) * FPS)} fps={FPS} width={1920} height={1080} defaultProps={{ muted: false }} />
    <Composition id="IntroVertical" component={IntroComp} durationInFrames={Math.round(INTRO_END * FPS)} fps={FPS} width={1080} height={1920} defaultProps={{ muted: false }} />
    <Composition id="V1Vertical" component={V1Comp} durationInFrames={Math.round((V1B_END - V1_START) * FPS)} fps={FPS} width={1080} height={1920} defaultProps={{ muted: false }} />
    <Composition id="V1v3" component={V1V3Comp} durationInFrames={Math.round((V1V3_END - V1V3_START) * FPS)} fps={FPS} width={1920} height={1080} defaultProps={{ muted: false }} />
    <Composition id="C1v3" component={C1Comp} durationInFrames={Math.round((C1_END - C1_START) * FPS)} fps={FPS} width={1920} height={1080} defaultProps={{ muted: false }} />
    <Composition id="V3Frames" component={V3Frames} durationInFrames={150} fps={FPS} width={1920} height={1080} />
    <Composition id="S1" component={S1Comp} durationInFrames={Math.round(S1_END * FPS)} fps={FPS} width={1080} height={1920} defaultProps={{ muted: false }} />
  </>
);
