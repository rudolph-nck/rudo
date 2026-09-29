import React from "react";
import { Composition } from "remotion";
import { Film } from "./Film";
import { DURATION_FRAMES, FPS } from "./utils/time";

export const Root: React.FC = () => (
  <>
    <Composition id="Film" component={Film} durationInFrames={DURATION_FRAMES} fps={FPS} width={1920} height={1080} defaultProps={{ muted: false }} />
    <Composition id="FilmSilent" component={Film} durationInFrames={DURATION_FRAMES} fps={FPS} width={1920} height={1080} defaultProps={{ muted: true }} />
  </>
);
