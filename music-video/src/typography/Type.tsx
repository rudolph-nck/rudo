import React from "react";
import { C, F } from "../theme";
import { clamp01, cubicOut, Ease, expoOut, quintOut } from "../utils/ease";
import { hash01 } from "../utils/random";

type Common = {
  /** frames since this element's reveal started (may be negative) */
  t: number;
  /** 0..1 exit progress */
  out?: number;
  color?: string;
  style?: React.CSSProperties;
};

/**
 * HERO TYPE — Open Sans ExtraBold. Characters rise out of a mask with a
 * staggered expo ease; `mode="track"` instead collapses wide tracking.
 */
export const Hero: React.FC<
  Common & {
    text: string;
    size: number;
    dur?: number;
    stagger?: number;
    mode?: "rise" | "track" | "fade" | "drop";
    tracking?: number;
    weight?: number;
    italic?: boolean;
    lineHeight?: number;
    align?: "left" | "center" | "right";
    ease?: Ease;
  }
> = ({
  text,
  size,
  t,
  out = 0,
  dur = 16,
  stagger = 1.6,
  mode = "rise",
  color = C.white,
  tracking = -0.02,
  weight = 800,
  italic = false,
  lineHeight = 0.92,
  align = "left",
  ease = expoOut,
  style,
}) => {
  const lines = text.split("\n");
  let idx = 0;
  const o = clamp01(out);
  return (
    <div
      style={{
        fontFamily: F.hero,
        fontWeight: weight,
        fontStyle: italic ? "italic" : "normal",
        fontSize: size,
        lineHeight,
        color,
        whiteSpace: "pre",
        textAlign: align,
        letterSpacing:
          mode === "track" ? `${tracking + (1 - ease(clamp01(t / (dur * 2)))) * 0.5}em` : `${tracking}em`,
        opacity: mode === "track" ? clamp01(t / dur) * (1 - o) : 1 - o * 0.999,
        ...style,
      }}
    >
      {lines.map((ln, li) => (
        <div key={li} style={{ overflow: mode === "rise" ? "hidden" : "visible", paddingBottom: size * 0.06, marginBottom: -size * 0.06 }}>
          {Array.from(ln).map((ch, ci) => {
            const i = idx++;
            const p = ease(clamp01((t - i * stagger) / dur));
            let tr = "none";
            let op = 1;
            if (mode === "rise") tr = `translateY(${(1 - p) * 105 + o * -105}%)`;
            if (mode === "drop") {
              tr = `translateY(${(1 - p) * -40}px)`;
              op = p;
            }
            if (mode === "fade") op = p;
            return (
              <span key={ci} style={{ display: "inline-block", transform: tr, opacity: op }}>
                {ch === " " ? " " : ch}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};

/**
 * NARRATIVE TYPE — readable lyric text. Words rise in sequence; the hero
 * phrase is set in the brand blue at a heavier weight.
 */
export const Narrative: React.FC<
  Common & {
    text: string;
    hero?: string;
    size?: number;
    width?: number;
    dur?: number;
    /** frames between words */
    wordStagger?: number;
    weight?: number;
    heroColor?: string;
    align?: "left" | "center" | "right";
    family?: string;
  }
> = ({
  text,
  hero = "",
  size = 40,
  width,
  t,
  out = 0,
  dur = 14,
  wordStagger = 2.2,
  color = C.white,
  heroColor = C.blue,
  weight = 300,
  align = "left",
  family = F.narrative,
  style,
}) => {
  const words = text.split(" ");
  // mark words belonging to the hero phrase
  const heroWords = hero ? hero.toLowerCase().split(" ") : [];
  let hStart = -1;
  if (heroWords.length) {
    const norm = (w: string) => w.toLowerCase().replace(/[^a-z0-9’']/g, "");
    for (let i = 0; i <= words.length - heroWords.length; i++) {
      if (heroWords.every((hw, k) => norm(words[i + k]) === norm(hw))) {
        hStart = i;
        break;
      }
    }
  }
  const o = clamp01(out);
  return (
    <div
      style={{
        fontFamily: family,
        fontWeight: weight,
        fontSize: size,
        lineHeight: 1.22,
        color,
        width,
        textAlign: align,
        letterSpacing: "-0.005em",
        opacity: 1 - o,
        transform: `translateY(${-o * 12}px)`,
        ...style,
      }}
    >
      {words.map((w, i) => {
        const p = cubicOut(clamp01((t - i * wordStagger) / dur));
        const isHero = hStart >= 0 && i >= hStart && i < hStart + heroWords.length;
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              marginRight: "0.26em",
              opacity: p,
              transform: `translateY(${(1 - p) * 0.45}em)`,
              color: isHero ? heroColor : undefined,
              fontWeight: isHero ? 600 : undefined,
            }}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
};

/** TECHNICAL TYPE — IBM Plex Mono caps, typed on. */
export const Mono: React.FC<
  Common & { text: string; size?: number; cps?: number; opacity?: number; weight?: number; tracking?: number; cursor?: boolean }
> = ({ text, t, size = 15, cps = 45, color = C.white, opacity = 0.55, out = 0, weight = 400, tracking = 0.14, cursor = false, style }) => {
  const n = Math.max(0, Math.floor((t / 30) * cps));
  const shown = text.slice(0, n);
  const typing = n < text.length && t >= 0;
  return (
    <div
      style={{
        fontFamily: F.mono,
        fontWeight: weight,
        fontSize: size,
        letterSpacing: `${tracking}em`,
        textTransform: "uppercase",
        color,
        opacity: opacity * (1 - clamp01(out)) * (t < 0 ? 0 : 1),
        whiteSpace: "pre",
        ...style,
      }}
    >
      {shown}
      {(cursor || typing) && t >= 0 ? <span style={{ background: color, color: "transparent", marginLeft: 2 }}>_</span> : null}
    </div>
  );
};

/** EDITORIAL TYPE — Instrument Serif; soft fade with slight upward settle. */
export const Serif: React.FC<Common & { text: string; size: number; italic?: boolean; dur?: number; lineHeight?: number }> = ({
  text,
  size,
  t,
  out = 0,
  italic = false,
  dur = 30,
  color = C.warm,
  lineHeight = 1.0,
  style,
}) => {
  const p = quintOut(clamp01(t / dur));
  return (
    <div
      style={{
        fontFamily: F.serif,
        fontStyle: italic ? "italic" : "normal",
        fontSize: size,
        lineHeight,
        color,
        whiteSpace: "pre",
        opacity: p * (1 - clamp01(out)),
        transform: `translateY(${(1 - p) * size * 0.12}px)`,
        letterSpacing: "-0.01em",
        ...style,
      }}
    >
      {text}
    </div>
  );
};

const GLYPHS = "ABCDEFGHJKLMNOPQRSTUVWXYZ0123456789+/<>#";
/** Characters cycle through glyphs and lock left→right (for "changin'", data). */
export const Scramble: React.FC<
  Common & { text: string; size: number; lockEvery?: number; family?: string; weight?: number; tracking?: number }
> = ({ text, size, t, out = 0, lockEvery = 2.5, color = C.white, family = F.hero, weight = 800, tracking = -0.02, style }) => {
  const chars = Array.from(text);
  return (
    <div
      style={{
        fontFamily: family,
        fontWeight: weight,
        fontSize: size,
        color,
        whiteSpace: "pre",
        letterSpacing: `${tracking}em`,
        lineHeight: 0.95,
        opacity: (t < 0 ? 0 : 1) * (1 - clamp01(out)),
        ...style,
      }}
    >
      {chars.map((ch, i) => {
        const locked = t >= 6 + i * lockEvery;
        const g = ch === " " ? " " : locked ? ch : GLYPHS[Math.floor(hash01(i * 13 + Math.floor(t / 2)) * GLYPHS.length)];
        return (
          <span key={i} style={{ display: "inline-block", opacity: t < i * 0.8 ? 0 : locked ? 1 : 0.55, color: locked ? undefined : C.blue }}>
            {g}
          </span>
        );
      })}
    </div>
  );
};

/** Counter that rolls to a value. */
export const Counter: React.FC<Common & { from: number; to: number; dur: number; pad?: number; size?: number; suffix?: string; opacity?: number }> = ({
  from,
  to,
  dur,
  t,
  pad = 3,
  size = 15,
  suffix = "",
  color = C.white,
  opacity = 0.6,
  style,
}) => {
  const v = Math.round(from + (to - from) * cubicOut(clamp01(t / dur)));
  return (
    <div style={{ fontFamily: F.mono, fontSize: size, color, opacity: t < 0 ? 0 : opacity, letterSpacing: "0.1em", fontVariantNumeric: "tabular-nums", ...style }}>
      {String(v).padStart(pad, "0")}
      {suffix}
    </div>
  );
};
