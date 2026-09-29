import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { FilmGrain } from "./effects/Finish";
import { chapters } from "./utils/scenes";
import { ensureFonts } from "./utils/fonts";
import { WORLDS } from "./worlds";

ensureFonts();

/**
 * The film = the scene manifest (data/scenes.json) mapped onto worlds.
 * Chapters may overlap; later chapters render on top and own their
 * transition-in.
 */
export const Film: React.FC<{ muted?: boolean }> = ({ muted = false }) => (
  <AbsoluteFill style={{ background: "#060708" }}>
    {chapters.map((c) => {
      const World = WORLDS[c.world];
      if (!World) return null;
      return (
        <Sequence key={c.id} from={c.startFrame} durationInFrames={c.endFrame - c.startFrame} name={`${c.id} · ${c.world}`}>
          <World />
        </Sequence>
      );
    })}
    <FilmGrain />
    {!muted && <Audio src={staticFile("audio/one-team-one-rhythm.m4a")} />}
  </AbsoluteFill>
);
