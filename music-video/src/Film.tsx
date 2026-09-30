import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame } from "remotion";
import { DJIntro } from "./components/DJIntro";
import { FilmGrain } from "./effects/Finish";
import { LyricBand } from "./typography/LyricBand";
import { chapters } from "./utils/scenes";
import { lyric } from "./utils/time";
import { ensureFonts } from "./utils/fonts";
import { WORLDS } from "./worlds";

ensureFonts();

// the DJ owns the rise and the beat drop, from ~22 s until the verse starts
const DJ_FROM = Math.round(21.9 * 30);
const DJ_TO = Math.round(lyric("changin").start * 30);
const DJLayer: React.FC = () => {
  const f = useCurrentFrame();
  return <DJIntro abs={f + DJ_FROM} />;
};

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
    <Sequence from={DJ_FROM} durationInFrames={DJ_TO - DJ_FROM} name="DJ intro">
      <DJLayer />
    </Sequence>
    <LyricBand />
    <FilmGrain />
    {!muted && <Audio src={staticFile("audio/one-team-one-rhythm.m4a")} />}
  </AbsoluteFill>
);
