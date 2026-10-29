import React from "react";
import { Composition, Series } from "remotion";
import { Film, JOURNEY_END } from "./Film";
import { TimeOffset } from "./time";
import { DURATION_FRAMES, FPS } from "./data";

/** Review cut for sign-off: intro open, the 808 wall crack, and the first chorus blow-out (15 s). */
export const PREVIEW_CUTS: [number, number][] = [
  [2.4, 10.6],
  [16.8, 18.0],
  [58.1, 63.7],
];

const Preview: React.FC = () => (
  <Series>
    {PREVIEW_CUTS.map(([a, b]) => (
      <Series.Sequence key={a} durationInFrames={Math.round((b - a) * FPS)}>
        <TimeOffset at={a}>
          <Film />
        </TimeOffset>
      </Series.Sequence>
    ))}
  </Series>
);

const previewFrames = PREVIEW_CUTS.reduce((n, [a, b]) => n + Math.round((b - a) * FPS), 0);

export const Root: React.FC = () => (
  <>
    <Composition id="LyricVideo" component={Film} durationInFrames={DURATION_FRAMES} fps={FPS} width={1080} height={1920} defaultProps={{ muted: false }} />
    <Composition id="Journey" component={Film} durationInFrames={Math.round(JOURNEY_END * FPS)} fps={FPS} width={1080} height={1920} defaultProps={{ muted: false }} />
    <Composition id="Preview" component={Preview} durationInFrames={previewFrames} fps={FPS} width={1080} height={1920} />
  </>
);
