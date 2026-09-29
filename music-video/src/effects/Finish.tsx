import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";
import { hash01 } from "../utils/random";
import { C } from "../theme";

/** Fine animated film grain: 8 pre-baked tiles, re-offset every frame. */
export const FilmGrain: React.FC<{ opacity?: number }> = ({ opacity = 0.075 }) => {
  const f = useCurrentFrame();
  const tile = Math.floor(hash01(f) * 8);
  const ox = Math.floor(hash01(f + 17) * 384);
  const oy = Math.floor(hash01(f + 91) * 384);
  return (
    <AbsoluteFill
      style={{
        backgroundImage: `url(${staticFile(`fx/grain-${tile}.png`)})`,
        backgroundPosition: `${ox}px ${oy}px`,
        backgroundSize: "384px 384px",
        mixBlendMode: "overlay",
        opacity,
        pointerEvents: "none",
      }}
    />
  );
};

export const Vignette: React.FC<{ strength?: number }> = ({ strength = 0.55 }) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(ellipse 75% 70% at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,${strength}) 100%)`,
      pointerEvents: "none",
    }}
  />
);

/** Subtle lifted blacks + a hint of lens diffusion on highlights. */
export const Atmosphere: React.FC<{ tint?: string; amount?: number; x?: number; y?: number }> = ({
  tint = C.blueRGB,
  amount = 0.06,
  x = 50,
  y = 58,
}) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(ellipse 60% 45% at ${x}% ${y}%, rgba(${tint},${amount}) 0%, rgba(${tint},0) 70%)`,
      pointerEvents: "none",
    }}
  />
);

/** Soft pool of light (pre-blurred gradient, no filter cost). */
export const LightPool: React.FC<{
  x: number;
  y: number;
  r: number;
  color?: string;
  opacity?: number;
  squash?: number;
}> = ({ x, y, r, color = "255,255,255", opacity = 0.12, squash = 1 }) => (
  <div
    style={{
      position: "absolute",
      left: x - r,
      top: y - r * squash,
      width: r * 2,
      height: r * 2 * squash,
      background: `radial-gradient(closest-side, rgba(${color},${opacity}) 0%, rgba(${color},${opacity * 0.45}) 40%, rgba(${color},0) 100%)`,
      pointerEvents: "none",
    }}
  />
);

/** A one-frame-ish luminance flash reserved for the biggest drops. */
export const Flash: React.FC<{ at: number; dur?: number; peak?: number; color?: string }> = ({
  at,
  dur = 9,
  peak = 0.5,
  color = "255,255,255",
}) => {
  const f = useCurrentFrame();
  const t = f - at;
  if (t < 0 || t > dur) return null;
  const v = peak * Math.exp(-t / (dur / 3.5));
  return <AbsoluteFill style={{ background: `rgba(${color},${v})`, mixBlendMode: "screen", pointerEvents: "none" }} />;
};

export const Field: React.FC<{ color?: string; glowY?: number }> = ({ color = C.ink, glowY = 62 }) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(ellipse 90% 70% at 50% ${glowY}%, ${C.charcoal} 0%, ${color} 70%)`,
    }}
  />
);

