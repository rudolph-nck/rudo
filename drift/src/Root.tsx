import React from "react";
import { Composition } from "remotion";
import { FPS } from "./data";
import { ensureFonts } from "./utils/fonts";
import { StyleFrame } from "./frames/Style";

ensureFonts();

export const Root: React.FC = () => (
  <>
    <Composition id="Style" component={StyleFrame} durationInFrames={120} fps={FPS} width={1080} height={1920} defaultProps={{ id: "weight" } as { id: string; t0?: number }} />
  </>
);
