import React from "react";
import { Img, staticFile } from "remotion";
import { C, glow, PLUS } from "../theme";
import { clamp01 } from "../utils/ease";

/**
 * The plus, built from its two bars so it can assemble (two lines crossing).
 * size = rendered height in px. h/v = 0..1 growth of each bar from its centre.
 */
export const PlusMark: React.FC<{
  size: number;
  h?: number;
  v?: number;
  color?: string;
  glowAmt?: number;
  style?: React.CSSProperties;
}> = ({ size, h = 1, v = 1, color = C.blue, glowAmt = 0, style }) => {
  const s = size / PLUS.h;
  const hc = PLUS.w / 2; // horizontal bar centre
  const vc = PLUS.h / 2;
  return (
    <svg
      width={PLUS.w * s}
      height={PLUS.h * s}
      viewBox={`0 0 ${PLUS.w} ${PLUS.h}`}
      style={{ overflow: "visible", filter: glowAmt > 0 ? glow(glowAmt) : undefined, ...style }}
    >
      <g transform={`translate(${hc} 0) scale(${clamp01(h)} 1) translate(${-hc} 0)`}>
        <polygon fill={color} points={`3.106,8.086 25.743,8.086 22.652,13.26 0,13.26`} />
      </g>
      <g transform={`translate(0 ${vc}) scale(1 ${clamp01(v)}) translate(0 ${-vc})`}>
        <rect fill={color} x={10.32} y={0} width={5.174} height={21.349} />
      </g>
    </svg>
  );
};

/**
 * The brand line. Draws from `from` ("left" | "right" | "center") with progress 0..1.
 * thickness defaults to the plus bar weight for a plus of `plusSize` px.
 */
export const BrandLine: React.FC<{
  length: number;
  thickness?: number;
  progress?: number;
  from?: "left" | "right" | "center";
  color?: string;
  glowAmt?: number;
  opacity?: number;
  style?: React.CSSProperties;
}> = ({ length, thickness = 4, progress = 1, from = "left", color = C.blue, glowAmt = 0.6, opacity = 1, style }) => {
  const p = clamp01(progress);
  const origin = from === "left" ? "0% 50%" : from === "right" ? "100% 50%" : "50% 50%";
  return (
    <div
      style={{
        width: length,
        height: thickness,
        background: color,
        transform: `scaleX(${p})`,
        transformOrigin: origin,
        filter: glowAmt > 0 ? glow(glowAmt) : undefined,
        opacity,
        ...style,
      }}
    />
  );
};

/** A straight line between two 2D points (px), drawn with progress. */
export const Segment: React.FC<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  w?: number;
  color?: string;
  progress?: number;
  opacity?: number;
  glowAmt?: number;
}> = ({ x1, y1, x2, y2, w = 1.5, color = C.white, progress = 1, opacity = 1, glowAmt = 0 }) => {
  const len = Math.hypot(x2 - x1, y2 - y1) * clamp01(progress);
  const ang = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  if (len < 0.5 || opacity <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: x1,
        top: y1 - w / 2,
        width: len,
        height: w,
        background: color,
        opacity,
        transform: `rotate(${ang}deg)`,
        transformOrigin: "0 50%",
        filter: glowAmt ? glow(glowAmt) : undefined,
      }}
    />
  );
};

/** Primary Reverse logo (vector from the brand PDF). width in px. */
export const Logo: React.FC<{ width: number; reveal?: number; style?: React.CSSProperties; variant?: "full" | "wordmark" }> = ({
  width,
  reveal = 1,
  style,
  variant = "full",
}) => {
  const src = variant === "full" ? "logos/logo-reverse.svg" : "logos/logo-wordmark-reverse.svg";
  const ratio = variant === "full" ? 45.104 / 155.072 : 33.876 / 154.563;
  return (
    <div
      style={{
        width,
        height: width * ratio,
        clipPath: `inset(0 ${100 - clamp01(reveal) * 100}% 0 0)`,
        ...style,
      }}
    >
      <Img src={staticFile(src)} style={{ width: "100%", height: "100%", display: "block" }} />
    </div>
  );
};

/** The A of the logo only (white), used for the A+ lattice texture. */
export const AplusMark: React.FC<{ height: number; color?: string; plusColor?: string; opacity?: number }> = ({
  height,
  color = C.white,
  plusColor = C.blue,
  opacity = 1,
}) => {
  const s = height / 33.432;
  return (
    <svg width={37.505 * s} height={height} viewBox="0 0 37.505 33.432" style={{ opacity, overflow: "visible" }}>
      <path fill={color} d="M27.255 0.000L27.255 10.795L22.085 10.795L22.085 5.640L5.405 33.432L0.000 33.432L18.607 0.000L27.255 0.000Z" />
      <path
        fill={plusColor}
        d="M37.505 20.169L34.414 25.343L27.256 25.343L27.256 33.432L22.082 33.432L22.082 25.343L11.762 25.343L14.868 20.169L22.082 20.169L22.082 12.083L27.256 12.083L27.256 20.169L37.505 20.169Z"
      />
    </svg>
  );
};
