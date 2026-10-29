import React from "react";
import { AbsoluteFill, Audio, staticFile } from "remotion";
import { C } from "./theme";
import { BIG_KICKS, FPS, Line, SECTIONS, impactEnv, kickEnv, linesOf, nextLineStart, sectionAt, sectionById } from "./data";
import { useOffset, useT } from "./time";
import { ensureFonts } from "./utils/fonts";
import { clamp01, expoOut, keys, mix, sineInOut } from "./utils/ease";
import { hash01, noise1 } from "./utils/random";
import { Room, TitleCard } from "./scenes/Room";
import { Rooftop, Cam } from "./scenes/Rooftop";
import { Shatter } from "./scenes/Shatter";
import { AdlibLine, BrickLine, FlareLine, GlideLine, ImpactBlock, RapLine } from "./text/Kinetic";
import { ChromaDefs, Flash, Grade, Grain, LightLeaks, Vignette } from "./fx/Post";

ensureFonts();

// ---- anchors (song seconds) pulled from timing.json -------------------------------------------
const INTRO = sectionById("intro");
const DROP = BIG_KICKS.find((k) => k > 15 && k < 20) ?? 17.22; // the 808 that cracks the wall
const TUBE_ON = 3.61; // first kick: the tube strikes
const TITLE_IN = 11.6;

/** When a line leaves the screen. */
const outOf = (l: Line) => {
  const next = nextLineStart(l);
  const hold = l.style === "rap" ? 2.2 : l.style === "impact" ? 1.8 : 1.3;
  return Math.max(l.end, Math.min(next - 0.06, l.end + hold));
};

const roofCam = (local: number, len: number, warpT: number | null, t: number): Cam => {
  // crane up from behind RUDO's shoulder, then drift toward the horizon
  const k = clamp01(local / len);
  const e = sineInOut(k);
  const w = warpT === null ? 0 : expoOut(clamp01((t - warpT) / 1.6));
  return {
    pos: [mix(-0.5, 0.5, e) + noise1(t * 0.3, 7) * 0.15, mix(1.7, 4.2, e) + w * 9, mix(5.0, 1.0, e) - w * 60],
    look: [mix(-0.1, 0.1, e), mix(3.6, 5.2, e) + w * 30, -40 - w * 80],
    fov: mix(52, 46, e) + w * 22,
    roll: (noise1(t * 0.21, 3) - 0.5) * 0.03,
  };
};

const Chorus: React.FC<{ t: number; id: string }> = ({ t, id }) => {
  const sec = sectionById(id);
  const local = t - sec.start;
  const ls = linesOf(id);
  const uni = ls.find((l) => /universe/i.test(l.text));
  const uniWord = uni?.words.find((w) => /universe/i.test(w.w));
  const warpT = uniWord ? uniWord.s : null;
  const warpBack = uni ? nextLineStart(uni) : null;
  const warp = warpT === null || t < warpT ? 0 : expoOut(clamp01((t - warpT) / 1.6)) * (warpBack ? 1 - clamp01((t - warpBack) / 0.6) : 1);
  const n = SECTIONS.filter((s) => s.kind === "chorus").indexOf(sec);
  const look = { sunrise: n === 1 ? 0.85 : n === 2 ? 0.4 : 0, glow: 0.75 + 0.5 * kickEnv(t, 0.25), warp };
  return (
    <AbsoluteFill>
      <Rooftop t={t} local={local} look={look} cam={roofCam(local, sec.end - sec.start, warp > 0 ? warpT : null, t)} embers={0.8 + 0.4 * kickEnv(t, 0.3)} />
      {ls.map((l) => (
        <FlareLine key={l.id} line={l} t={t} out={outOf(l)} centerY={640} pulseKick={/grinding/i.test(l.text)} />
      ))}
    </AbsoluteFill>
  );
};

const Intro: React.FC<{ t: number }> = ({ t }) => {
  const ls = linesOf("intro");
  const [nobody, built, ...adlibs] = ls;
  const textUp = clamp01((t - nobody.start) / 0.15) * (1 - clamp01((t - outOf(built)) / 0.6));
  const zoom = keys(t, [
    [0, 1.0],
    [nobody.start, 1.02],
    [DROP - 0.01, 1.07],
    [DROP + 0.12, 1.1, expoOut],
    [INTRO.end, 1.16],
  ]);
  return (
    <AbsoluteFill>
      <Room t={t} tubeOn={TUBE_ON} crackAt={DROP} zoom={zoom} panY={-40 * (zoom - 1) * 10} dim={0.45 * textUp} blur={3.5 * textUp} />
      <TitleCard t={t} at={TITLE_IN} out={DROP} />
      <ImpactBlock line={nobody} t={t} out={built.start - 0.4} centerY={720} rows={[[0], [1, 2], [3]]} />
      <BrickLine line={built} t={t} out={outOf(built)} baseY={1180} rows={[[0, 1], [2, 3]]} />
      {adlibs.map((l, i) => (
        <AdlibLine key={l.id} line={l} t={t} x={[90, 300, 140, 380][i % 4]} y={[300, 1340, 520, 1180][i % 4]} />
      ))}
    </AbsoluteFill>
  );
};

/** Placeholder treatment for sections not yet designed (full build happens after preview sign-off). */
const Generic: React.FC<{ t: number; id: string }> = ({ t, id }) => {
  const sec = sectionById(id);
  const ls = linesOf(id);
  const tint = sec.kind === "verse1" ? "rgba(70,110,150,0.9)" : sec.kind === "verse2" ? "rgba(220,140,70,0.9)" : sec.kind === "bridge" ? "rgba(120,120,140,0.6)" : "rgba(240,180,90,0.7)";
  return (
    <AbsoluteFill>
      <Room t={t} tubeOn={-10} zoom={1.18} dim={0.55} blur={5} />
      <Grade tint={tint} />
      {ls.map((l) =>
        l.style === "rap" || l.style === "impact" ? (
          <RapLine key={l.id} line={l} t={t} out={outOf(l)} centerY={700} />
        ) : (
          <GlideLine key={l.id} line={l} t={t} out={outOf(l)} centerY={700} hand={sec.kind === "bridge"} />
        ),
      )}
    </AbsoluteFill>
  );
};

export const Film: React.FC<{ muted?: boolean }> = ({ muted }) => {
  const t = useT();
  const offset = useOffset();
  const sec = sectionAt(t);

  // global impact response: shake, flash, chromatic aberration
  const imp = impactEnv(t);
  const shakeAmp = Math.min(1.4, imp) * 26;
  const sx = (hash01(Math.floor(t * 60)) - 0.5) * 2 * shakeAmp;
  const sy = (hash01(Math.floor(t * 60) + 7) - 0.5) * 2 * shakeAmp;
  const rot = (hash01(Math.floor(t * 60) + 13) - 0.5) * shakeAmp * 0.04;
  const ca = Math.min(18, imp * 12);

  // chorus entrances: the ceiling blows open
  const chorusStarts = SECTIONS.filter((s) => s.kind === "chorus").map((s) => s.start);
  const blow = chorusStarts.find((c) => t >= c && t < c + 1.1);
  const blowFlash = blow === undefined ? 0 : Math.exp(-(t - blow) / 0.18) * 0.9;

  const warmth = sec.kind === "chorus" ? 1 : sec.kind === "intro" ? 0.35 : 0.5;

  return (
    <AbsoluteFill style={{ background: C.black }}>
      <ChromaDefs px={ca} />
      <AbsoluteFill style={{ transform: `translate(${sx}px, ${sy}px) rotate(${rot}deg) scale(${1 + Math.min(1, imp) * 0.02})`, filter: ca > 0.6 ? "url(#ca)" : undefined }}>
        {sec.kind === "intro" ? <Intro t={t} /> : sec.kind === "chorus" ? <Chorus t={t} id={sec.id} /> : <Generic t={t} id={sec.id} />}
        {blow !== undefined ? <Shatter t={t} at={blow} /> : null}
      </AbsoluteFill>
      <LightLeaks t={t} amount={warmth * (0.45 + 0.4 * kickEnv(t, 0.3)) + Math.min(0.6, imp * 0.4)} />
      <Flash v={Math.min(0.55, imp * 0.32) + blowFlash} color={blow !== undefined ? "255,214,150" : "255,244,225"} />
      <Vignette strength={0.72} />
      <Grain opacity={0.13} />
      {muted ? null : <Audio src={staticFile("audio/shout-it-to-the-sky.m4a")} startFrom={Math.round(offset * FPS)} />}
    </AbsoluteFill>
  );
};

