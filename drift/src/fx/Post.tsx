import React from "react";
import { AbsoluteFill, staticFile, useCurrentFrame } from "remotion";
import { hash01, noise1 } from "../utils/random";

/** Animated film grain from 8 pre-baked tiles, re-offset every frame. */
export const Grain: React.FC<{ opacity?: number }> = ({ opacity = 0.1 }) => {
  const f = useCurrentFrame();
  const tile = Math.floor(hash01(f) * 8);
  return (
    <AbsoluteFill
      style={{
        backgroundImage: `url(${staticFile(`fx/grain-${tile}.png`)})`,
        backgroundPosition: `${Math.floor(hash01(f + 17) * 384)}px ${Math.floor(hash01(f + 91) * 384)}px`,
        backgroundSize: "384px 384px",
        mixBlendMode: "overlay",
        opacity,
        pointerEvents: "none",
      }}
    />
  );
};

export const Vignette: React.FC<{ strength?: number }> = ({ strength = 0.7 }) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(ellipse 85% 62% at 50% 46%, rgba(0,0,0,0) 50%, rgba(0,0,0,${strength}) 100%)`,
      pointerEvents: "none",
    }}
  />
);

/** Warm light leaks drifting in from the frame edges (screen-blended, pre-blurred gradients). */
export const LightLeaks: React.FC<{ t: number; amount: number; color?: string; color2?: string }> = ({
  t,
  amount,
  color = "255,140,60",
  color2 = "255,210,140",
}) => {
  if (amount <= 0.01) return null;
  const a = noise1(t * 0.35, 3);
  const b = noise1(t * 0.27, 9);
  const c = noise1(t * 0.5, 21);
  return (
    <AbsoluteFill style={{ mixBlendMode: "screen", pointerEvents: "none", opacity: amount }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 55% 38% at ${-6 + a * 18}% ${18 + b * 40}%, rgba(${color},0.55) 0%, rgba(${color},0) 70%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 40% 30% at ${104 - b * 14}% ${70 - a * 30}%, rgba(${color2},0.38) 0%, rgba(${color2},0) 70%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background: `linear-gradient(${100 + c * 40}deg, rgba(${color},0) 30%, rgba(${color},${0.12 * c}) 50%, rgba(${color},0) 70%)`,
        }}
      />
    </AbsoluteFill>
  );
};

export const Flash: React.FC<{ v: number; color?: string }> = ({ v, color = "255,244,225" }) =>
  v <= 0.005 ? null : (
    <AbsoluteFill style={{ background: `rgba(${color},${Math.min(1, v)})`, mixBlendMode: "screen", pointerEvents: "none" }} />
  );

/**
 * SVG chromatic-aberration filter: splits R and B and pushes them apart horizontally.
 * Referenced as filter: url(#ca) only while the offset is visible (it is costly).
 */
export const ChromaDefs: React.FC<{ px: number }> = ({ px }) => (
  <svg width={0} height={0} style={{ position: "absolute" }}>
    <defs>
      <filter id="ca" x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
        <feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r" />
        <feOffset in="r" dx={px} dy={0} result="r2" />
        <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g" />
        <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b" />
        <feOffset in="b" dx={-px} dy={0} result="b2" />
        <feBlend in="r2" in2="g" mode="screen" result="rg" />
        <feBlend in="rg" in2="b2" mode="screen" />
      </filter>
    </defs>
  </svg>
);

/** Colour grade as a multiply + soft-light pair. */
export const Grade: React.FC<{ tint: string; lift?: string; amount?: number }> = ({ tint, lift, amount = 1 }) => (
  <>
    <AbsoluteFill style={{ background: tint, mixBlendMode: "soft-light", opacity: amount, pointerEvents: "none" }} />
    {lift ? <AbsoluteFill style={{ background: lift, mixBlendMode: "screen", opacity: amount, pointerEvents: "none" }} /> : null}
  </>
);
