import React from "react";
import { AbsoluteFill, Audio, staticFile } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { C, H, W } from "./theme";
import { FPS, Line, impactEnv, kickEnv, linesOf, nextLineStart, sectionAt, sectionById } from "./data";
import { useOffset, useT } from "./time";
import { ensureFonts } from "./utils/fonts";
import { hash01 } from "./utils/random";
import { GlideLine, RapLine } from "./text/Kinetic";
import { ChromaDefs, Flash, Grade, Grain, LightLeaks, Vignette } from "./fx/Post";
import { Hud } from "./fx/Hud";
import { useAssets } from "./three/assets";
import { DROP, World } from "./three/World";
import { CH1 } from "./three/layout";

ensureFonts();

/** The 3D journey currently runs through chorus 1; later sections still use the 2D placeholder. */
export const JOURNEY_END = sectionById("postchorus1").start;

const outOf = (l: Line) => {
  const next = nextLineStart(l);
  const hold = l.style === "rap" ? 2.2 : l.style === "impact" ? 1.8 : 1.3;
  return Math.max(l.end, Math.min(next - 0.06, l.end + hold));
};

/** Placeholder treatment for sections not yet built in 3D. */
const Generic: React.FC<{ t: number; id: string }> = ({ t, id }) => {
  const sec = sectionById(id);
  const tint = sec.kind === "verse2" ? "rgba(220,140,70,0.9)" : sec.kind === "bridge" ? "rgba(120,120,140,0.6)" : "rgba(240,180,90,0.7)";
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse 80% 60% at 50% 40%, ${C.concrete} 0%, ${C.black} 75%)` }}>
      <Grade tint={tint} />
      {linesOf(id).map((l) =>
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
  const assets = useAssets();
  const sec = sectionAt(t);

  // global impact response: shake, flash, chromatic aberration
  const imp = impactEnv(t);
  const shakeAmp = Math.min(1.4, imp) * 22;
  const f = Math.floor(t * 60);
  const sx = (hash01(f) - 0.5) * 2 * shakeAmp;
  const sy = (hash01(f + 7) - 0.5) * 2 * shakeAmp;
  const rot = (hash01(f + 13) - 0.5) * shakeAmp * 0.04;
  const ca = Math.min(16, imp * 11);
  const burst = t >= CH1.start && t < CH1.start + 0.8 ? Math.exp(-(t - CH1.start) / 0.16) * 0.75 : 0;
  const warmth = t > CH1.start ? 0.7 : t > DROP ? 0.3 : 0.12;

  return (
    <AbsoluteFill style={{ background: C.black }}>
      <ChromaDefs px={ca} />
      <AbsoluteFill style={{ transform: `translate(${sx}px, ${sy}px) rotate(${rot}deg) scale(${1.02 + Math.min(1, imp) * 0.02})`, filter: ca > 0.6 ? "url(#ca)" : undefined }}>
        {t < JOURNEY_END ? (
          assets ? (
            <ThreeCanvas width={W} height={H} style={{ position: "absolute", inset: 0 }} gl={{ antialias: true, preserveDrawingBuffer: true }}>
              <World t={t} a={assets} bloom={0.45 + 0.25 * kickEnv(t, 0.3) * (t > CH1.start ? 1 : 0.4)} />
            </ThreeCanvas>
          ) : null
        ) : (
          <Generic t={t} id={sec.id} />
        )}
        {t < JOURNEY_END ? <Hud t={t} /> : null}
      </AbsoluteFill>
      <LightLeaks t={t} amount={warmth * (0.35 + 0.35 * kickEnv(t, 0.3)) + Math.min(0.5, imp * 0.35)} />
      <Flash v={Math.min(0.3, imp * 0.16) + burst * 0.6} color={burst > 0.05 ? "255,214,150" : "255,244,225"} />
      <Vignette strength={0.62} />
      <Grain opacity={0.12} />
      {muted ? null : <Audio src={staticFile("audio/shout-it-to-the-sky.m4a")} startFrom={Math.round(offset * FPS)} />}
    </AbsoluteFill>
  );
};
