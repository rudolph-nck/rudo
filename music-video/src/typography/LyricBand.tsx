import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, F } from "../theme";
import { clamp01, cubicInOut, cubicOut, expoOut, mix, softBack } from "../utils/ease";
import { hash01 } from "../utils/random";
import { scene } from "../utils/scenes";
import { allLyrics, beatPulse, FPS, LyricLine } from "../utils/time";

/**
 * The main lyric display. Every sung line (that its world doesn't already
 * set as hero type) appears here, large, word-by-word at the sung time
 * (data/lyrics.json word onsets). Words act out what they mean:
 * "down" sinks, "grow" rises, "loud" swells, "far" recedes, "move" pushes…
 */

type Action =
  | "down" | "up" | "tall" | "loud" | "far" | "push" | "scramble" | "align" | "converge"
  | "pulse" | "shake" | "open" | "night" | "underline" | "drop" | "flow" | "mix" | "ring" | "none";

const ACTIONS: Array<[RegExp, Action]> = [
  [/^down$/, "down"],
  [/^(grow|grew|up|improve|proud|rise|futures|lift|build|building)$/, "up"],
  [/^(tall|strong|standards)$/, "tall"],
  [/^loud$/, "loud"],
  [/^far$/, "far"],
  [/^(move|moving|movin|roll|go|drive|through|ahead|way|leading|right|forward|flow)$/, "push"],
  [/^(changin|changed|change|conversion|data)$/, "scramble"],
  [/^aligned$/, "align"],
  [/^(together|one|as|crew|team|group|addition)$/, "converge"],
  [/^(heart|rhythm)$/, "pulse"],
  [/^impact$/, "shake"],
  [/^(doors|open|opening|new)$/, "open"],
  [/^night$/, "night"],
  [/^(guard|aligned|time)$/, "underline"],
  [/^home$/, "drop"],
  [/^mix$/, "mix"],
  [/^call$/, "ring"],
];
const actionFor = (w: string): Action => {
  const n = w.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]/g, "");
  for (const [re, a] of ACTIONS) if (re.test(n)) return a;
  return "none";
};

const GLYPHS = "ABCDEFGHJKLMNOPQRSTUVWXYZ0123456789+";

const Word: React.FC<{ text: string; t: number; wt: number; hero: boolean; abs: number; big: boolean }> = ({ text, t, wt, hero, abs, big }) => {
  const dt = t - wt; // seconds since this word was sung
  const p = cubicOut(clamp01((dt + 0.06) / 0.2));
  if (p <= 0) return <span style={{ display: "inline-block", marginRight: "0.24em", opacity: 0 }}>{text}</span>;
  const a = actionFor(text);
  const k = clamp01(dt / 0.55); // action progress
  let tr = `translateY(${(1 - p) * 0.3}em)`;
  let extra: React.CSSProperties = {};
  let letters: React.ReactNode = text;
  const perChar = (fn: (ch: string, i: number) => React.CSSProperties, glyph?: (ch: string, i: number) => string) =>
    Array.from(text).map((ch, i) => (
      <span key={i} style={{ display: "inline-block", ...fn(ch, i) }}>
        {glyph ? glyph(ch, i) : ch}
      </span>
    ));
  switch (a) {
    case "down":
      tr += ` translateY(${expoOut(k) * 0.32}em)`;
      extra = { opacity: mix(1, 0.8, k) };
      break;
    case "up":
      tr += ` translateY(${-expoOut(k) * 0.22}em)`;
      break;
    case "tall":
      tr += ` scaleY(${mix(0.6, 1, softBack(k))})`;
      extra = { transformOrigin: "50% 90%" };
      break;
    case "loud":
      tr += ` scale(${mix(1, 1.7, softBack(clamp01(dt / 0.35)))})`;
      extra = { transformOrigin: "0% 80%", marginRight: "0.9em" };
      break;
    case "far":
      tr += ` translate(${expoOut(k) * 0.35}em, ${-expoOut(k) * 0.12}em) scale(${mix(1, 0.62, expoOut(k))})`;
      extra = { opacity: mix(1, 0.6, k), transformOrigin: "0% 50%" };
      break;
    case "push":
      tr += ` translateX(${Math.sin(Math.PI * clamp01(dt / 0.4)) * 0.28}em) skewX(${-Math.sin(Math.PI * clamp01(dt / 0.4)) * 10}deg)`;
      break;
    case "scramble":
      letters = perChar(
        () => ({}),
        (ch, i) => (dt < 0.1 + i * 0.035 && /[a-z0-9]/i.test(ch) ? GLYPHS[Math.floor(hash01(i * 7 + Math.floor(dt * 24)) * GLYPHS.length)] : ch),
      );
      break;
    case "align":
      letters = perChar((_, i) => ({ transform: `translateY(${(hash01(i * 3.1) - 0.5) * 0.9 * (1 - expoOut(clamp01((dt - i * 0.02) / 0.35)))}em)` }));
      break;
    case "converge":
      extra = { letterSpacing: `${mix(0.28, -0.02, expoOut(k))}em` };
      break;
    case "pulse":
      tr += ` scale(${1 + 0.07 * beatPulse(abs, 6)})`;
      break;
    case "shake":
      tr += ` translateX(${Math.sin(dt * 90) * 0.08 * Math.exp(-dt * 6)}em)`;
      break;
    case "open":
      extra = { letterSpacing: `${mix(-0.06, 0.1, expoOut(k))}em` };
      break;
    case "night":
      extra = { color: `rgba(${C.blueRGB},${mix(1, 0.55, k)})` };
      break;
    case "underline":
      extra = { backgroundImage: `linear-gradient(${C.blue},${C.blue})`, backgroundRepeat: "no-repeat", backgroundPosition: "0 92%", backgroundSize: `${expoOut(k) * 100}% 0.07em` };
      break;
    case "drop":
      tr = `translateY(${(1 - softBack(clamp01((dt + 0.06) / 0.35))) * -0.8}em)`;
      break;
    case "mix":
      letters = perChar((_, i) => ({ transform: `rotate(${(hash01(i + 9) - 0.5) * 40 * (1 - expoOut(clamp01(dt / 0.45)))}deg) translateY(${(hash01(i + 3) - 0.5) * 0.4 * (1 - expoOut(clamp01(dt / 0.45)))}em)` }));
      break;
    case "ring":
      extra = { textShadow: `0 0 ${24 * (1 - k)}px rgba(${C.blueRGB},${1 - k})` };
      break;
  }
  return (
    <span
      style={{
        display: "inline-block",
        marginRight: "0.24em",
        opacity: p,
        transform: tr,
        color: hero ? C.blue : C.white,
        fontSize: big && hero ? "1.12em" : undefined,
        ...extra,
      }}
    >
      {letters}
    </span>
  );
};

const norm = (w: string) => w.toLowerCase().replace(/[^a-z0-9’']/g, "");

const Line: React.FC<{ line: LyricLine; t: number; abs: number; out: number }> = ({ line, t, abs, out }) => {
  const s = scene(line.id);
  const display = s.display.split(" ");
  const heroWords = (s.heroWord || "").split(" ").filter(Boolean).map(norm);
  let hStart = -1;
  for (let i = 0; heroWords.length && i <= display.length - heroWords.length; i++)
    if (heroWords.every((hw, k) => norm(display[i + k]) === hw)) {
      hStart = i;
      break;
    }
  const chars = s.display.length;
  const size = chars > 46 ? 76 : chars > 30 ? 90 : 112;
  return (
    <div
      style={{
        position: "absolute",
        left: 110,
        top: 96,
        width: 1640,
        fontFamily: F.hero,
        fontWeight: 800,
        fontSize: size,
        lineHeight: 1.06,
        letterSpacing: "-0.02em",
        opacity: 1 - out,
        transform: `translateY(${-cubicInOut(out) * 26}px)`,
      }}
    >
      {line.words.map((w, i) => (
        <Word key={i} text={display[i] ?? w.w} t={t} wt={w.t} abs={abs} big hero={hStart >= 0 && i >= hStart && i < hStart + heroWords.length} />
      ))}
    </div>
  );
};

export const LyricBand: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / FPS;
  let idx = -1;
  for (let i = 0; i < allLyrics.length; i++) if (allLyrics[i].start - 0.1 <= t) idx = i;
  if (idx < 0) return null;
  const cur = allLyrics[idx];
  const curOn = scene(cur.id).caption && t <= cur.hold;
  const prev = idx > 0 ? allLyrics[idx - 1] : undefined;
  const prevOut = prev ? clamp01((t - (cur.start - 0.1)) / 0.22) : 1;
  const prevOn = prev && scene(prev.id).caption && prevOut < 1 && t <= prev.hold + 0.3;
  const holdOut = clamp01((t - (cur.hold - 0.25)) / 0.25);
  const vis = Math.max(curOn ? 1 - holdOut : 0, prevOn ? 1 - prevOut : 0);
  if (vis <= 0.001) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 480, opacity: vis,
        background: "linear-gradient(180deg, rgba(6,7,8,0.72) 0%, rgba(6,7,8,0.45) 50%, rgba(6,7,8,0) 100%)" }} />
      {prevOn && prev && <Line line={prev} t={t} abs={f} out={prevOut} />}
      {curOn && <Line line={cur} t={t} abs={f} out={holdOut} />}
    </AbsoluteFill>
  );
};
