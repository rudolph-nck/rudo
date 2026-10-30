import React from "react";
import { AbsoluteFill, Audio, staticFile, useCurrentFrame } from "remotion";
import { DURATION_FRAMES, FPS, SECTIONS, linesOf } from "../data";
import { Intro } from "../intro/Intro";
import { useIntroAssets } from "../intro/Scene3D";
import { Verse1 } from "./Verse1";
import { Verse1M } from "../v4/Verse1M";
import { PreChorusM } from "../v4/PreM";
import { Chorus, PostChorus } from "./Rise";
import { Verse2 } from "./Flip";
import { Bridge, Outro, Verse3 } from "./Night";

/** The full song in the v3 style. */
export const SONG_FRAMES = DURATION_FRAMES;

/**
 * Hand-offs between sections: a section keeps the screen until its last line has finished,
 * but never past the first sung word of the next one.
 */
const firstWord = (id: string) => linesOf(id)[0]?.words[0].s ?? Infinity;
const lastEnd = (id: string) => {
  const ls = linesOf(id);
  return ls.length ? ls[ls.length - 1].end : -Infinity;
};
const BOUNDS = SECTIONS.map((s, i) => {
  const next = SECTIONS[i + 1];
  const end = next ? Math.min(firstWord(next.id) - 0.05, Math.max(s.end, lastEnd(s.id) + 0.15)) : Infinity;
  return { id: s.id, end };
});
const sectionFor = (t: number) => BOUNDS.find((b) => t < b.end)?.id ?? "outro";

type Assets = ReturnType<typeof useIntroAssets>;
const POST1_MONTAGE = [31.4, 35.0, 53.6, 44.8, 63.5, 40.1, 47.3, 56.5, 70.0, 33.9, 66.0, 49.2];
const POST2_MONTAGE = [35.0, 109.9, 53.6, 123.0, 168.0, 63.5, 113.0, 186.0, 44.8, 148.0, 130.9, 176.0];

/** Render the picture of any moment without its lyrics (for montages and the three-lives split). */
const renderBare = (src: number, a: Assets): React.ReactNode => {
  const id = sectionFor(src);
  if (id === "verse1") return <Verse1M t={src} assets={a} bare />;
  if (id.startsWith("prechorus")) return <PreChorusM t={src} id={id} bare />;
  if (id.startsWith("chorus")) return <Chorus t={src} a={a} id={id} bare />;
  if (id === "verse2") return <Verse2 t={src} bare />;
  if (id === "verse3") return <Verse3 t={src} a={a} bare />;
  if (id === "bridge") return <Bridge t={src} a={a} bare />;
  return null;
};

export const Song: React.FC<{ muted?: boolean }> = ({ muted }) => {
  const t = useCurrentFrame() / FPS;
  const a = useIntroAssets();
  const id = sectionFor(t);
  const at = (src: number) => renderBare(src, a);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {id === "intro" ? <Intro muted /> : null}
      {id === "verse1" ? <Verse1M t={t} assets={a} /> : null}
      {id === "prechorus1" || id === "prechorus2" ? <PreChorusM t={t} id={id} /> : null}
      {id === "chorus1" || id === "chorus2" || id === "chorus3" ? <Chorus t={t} a={a} id={id} /> : null}
      {id === "postchorus1" ? <PostChorus t={t} a={a} id={id} montage={POST1_MONTAGE} renderAt={at} /> : null}
      {id === "postchorus2" ? <PostChorus t={t} a={a} id={id} montage={POST2_MONTAGE} renderAt={at} /> : null}
      {id === "verse2" ? <Verse2 t={t} /> : null}
      {id === "verse3" ? <Verse3 t={t} a={a} renderAt={at} /> : null}
      {id === "bridge" ? <Bridge t={t} a={a} /> : null}
      {id === "outro" ? <Outro t={t} a={a} /> : null}
      {muted ? null : <Audio src={staticFile("audio/shout-it-to-the-sky.m4a")} />}
    </AbsoluteFill>
  );
};
