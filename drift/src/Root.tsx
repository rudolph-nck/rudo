import React from "react";
import { Composition, useCurrentFrame } from "remotion";
import { FPS } from "./data";
import { setFormat } from "./theme";
import { LyricBar } from "./words/LyricBar";
import { FRAMES } from "./v3/frames";
import { Verse1V3, V1V3_START, V1V3_END } from "./v3/verse1";
import { Chorus1V3, C1_START, C1_END } from "./v3/chorus1";
import { Verse2V3 } from "./v3/verse2";
import { Chorus2V3 } from "./v3/chorus2";
import { BridgeV3 } from "./v3/bridge";
import { FinaleV3 } from "./v3/finale";
import { BeatRuler } from "./v3/kit";
import { AbsoluteFill } from "remotion";
import { T } from "./data";
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

/** The whole song. Sections hand over with short crossfades at their seams. */
const SECTIONS_V3: { from: number; to: number; C: React.FC<{ t: number }> }[] = [
  { from: 0, to: 23.3, C: Intro },
  { from: 23.0, to: 57.4, C: Verse1V3 },
  { from: 57.2, to: 92.1, C: Chorus1V3 },
  { from: 91.4, to: 135.9, C: Verse2V3 },
  { from: 135.5, to: 170.6, C: Chorus2V3 },
  { from: 170.2, to: 203.1, C: BridgeV3 },
  { from: 202.7, to: 264.1, C: FinaleV3 },
];
const FullComp: React.FC<{ muted?: boolean }> = ({ muted }) => {
  const f = useCurrentFrame();
  const t = f / FPS;
  const { width, height } = useVideoConfig();
  setFormat(width, height);
  const live = SECTIONS_V3.map((s, i) => ({ ...s, i })).filter((s) => t >= s.from && t < s.to);
  return (
    <>
      {muted ? null : <AudioTrack />}
      {live.map((s, k) => {
        // the later section fades in over the earlier one across their overlap
        const prev = SECTIONS_V3[s.i - 1];
        const o = k > 0 && prev ? Math.min(1, Math.max(0, (t - s.from) / Math.max(0.05, prev.to - s.from))) : 1;
        return <AbsoluteFill key={s.i} style={{ opacity: o }}><s.C t={t} /></AbsoluteFill>;
      })}
      <LyricBar t={t} hideFrom={199.7} hideTo={202.8} />
      <BeatRuler t={t} o={t < 6 || (t > 199.6 && t < 202.6) || t > 249 ? 0 : 1} />
    </>
  );
};
const FULL_END = Math.ceil(T.duration * FPS) / FPS;

export const Root: React.FC = () => (
  <>
    <Composition id="Style" component={StyleFrame} durationInFrames={120} fps={FPS} width={1080} height={1920} defaultProps={{ id: "weight" } as { id: string; t0?: number }} />
    <Composition id="Intro" component={IntroComp} durationInFrames={Math.round(INTRO_END * FPS)} fps={FPS} width={1920} height={1080} defaultProps={{ muted: false }} />
    <Composition id="V1" component={V1Comp} durationInFrames={Math.round((V1B_END - V1_START) * FPS)} fps={FPS} width={1920} height={1080} defaultProps={{ muted: false }} />
    <Composition id="IntroVertical" component={IntroComp} durationInFrames={Math.round(INTRO_END * FPS)} fps={FPS} width={1080} height={1920} defaultProps={{ muted: false }} />
    <Composition id="V1Vertical" component={V1Comp} durationInFrames={Math.round((V1B_END - V1_START) * FPS)} fps={FPS} width={1080} height={1920} defaultProps={{ muted: false }} />
    <Composition id="V1v3" component={V1V3Comp} durationInFrames={Math.round((V1V3_END - V1V3_START) * FPS)} fps={FPS} width={1920} height={1080} defaultProps={{ muted: false }} />
    <Composition id="C1v3" component={C1Comp} durationInFrames={Math.round((C1_END - C1_START) * FPS)} fps={FPS} width={1920} height={1080} defaultProps={{ muted: false }} />
    <Composition id="Drift" component={FullComp} durationInFrames={Math.round(FULL_END * FPS)} fps={FPS} width={1920} height={1080} defaultProps={{ muted: false }} />
    <Composition id="V3Frames" component={V3Frames} durationInFrames={150} fps={FPS} width={1920} height={1080} />
    <Composition id="S1" component={S1Comp} durationInFrames={Math.round(S1_END * FPS)} fps={FPS} width={1080} height={1920} defaultProps={{ muted: false }} />
  </>
);
