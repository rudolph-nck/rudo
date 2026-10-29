import timing from "../data/timing.json";

export type Word = { w: string; s: number; e: number; src: string };
export type LineStyle = "impact" | "rap" | "sung" | "adlib";
export type Line = {
  id: string;
  section: string;
  text: string;
  style: LineStyle;
  words: Word[];
  start: number;
  end: number;
  hit?: number;
  anchored: number;
};
export type Section = { id: string; kind: string; tag: string; label: string; lines: string[]; start: number; end: number };
export type Kick = { t: number; v: number };

export const T = timing as unknown as {
  fps: number;
  duration: number;
  bpm: number;
  beats: number[];
  downbeats: number[];
  kicks: Kick[];
  energy: number[];
  low: number[];
  sections: Section[];
  lines: Line[];
};

export const FPS = 30;
export const DURATION_FRAMES = Math.ceil(T.duration * FPS);

export const LINES = T.lines;
export const SECTIONS = T.sections;
export const lineById = (id: string) => LINES.find((l) => l.id === id)!;
export const sectionAt = (t: number) => SECTIONS.find((s) => t >= s.start && t < s.end) ?? SECTIONS[SECTIONS.length - 1];
export const sectionById = (id: string) => SECTIONS.find((s) => s.id === id)!;
export const linesOf = (sectionId: string) => LINES.filter((l) => l.section === sectionId);

/** Next line start after this line (for hand-offs). */
export const nextLineStart = (l: Line) => {
  const i = LINES.indexOf(l);
  return i + 1 < LINES.length ? LINES[i + 1].start : T.duration;
};

/** Sum of decaying pulses from events before t. */
export const pulse = (t: number, events: number[], decay = 0.12, weights?: number[]) => {
  let v = 0;
  for (let i = 0; i < events.length; i++) {
    const d = t - events[i];
    if (d < 0) break;
    if (d < decay * 8) v += (weights ? weights[i] : 1) * Math.exp(-d / decay);
  }
  return v;
};

const KT = T.kicks.map((k) => k.t);
const KV = T.kicks.map((k) => k.v);
/** Low-end (808/kick) envelope, ~0..1. */
export const kickEnv = (t: number, decay = 0.11) => Math.min(1.2, pulse(t, KT, decay, KV) * 1.6);
/** The heavy hits only (808 drops). */
export const BIG_KICKS = T.kicks.filter((k) => k.v >= 0.6).map((k) => k.t);

export const energyAt = (t: number) => {
  const i = Math.floor(t);
  const a = T.energy[Math.max(0, Math.min(T.energy.length - 1, i))] ?? 0;
  const b = T.energy[Math.max(0, Math.min(T.energy.length - 1, i + 1))] ?? 0;
  return a + (b - a) * (t - i);
};

/** Impact events: impact-line words + heavy 808s. amp ~ how hard to hit the frame. */
export const IMPACTS: { t: number; amp: number }[] = (() => {
  const ev: { t: number; amp: number }[] = [];
  for (const l of LINES) {
    if (l.style !== "impact") continue;
    l.words.forEach((w, i) => ev.push({ t: i === 0 && l.hit ? l.hit : w.s, amp: i === 0 ? 1 : 0.55 }));
  }
  for (const k of BIG_KICKS) if (!ev.some((e) => Math.abs(e.t - k) < 0.15)) ev.push({ t: k, amp: 0.8 });
  return ev.sort((a, b) => a.t - b.t);
})();
export const impactEnv = (t: number, decay = 0.13) =>
  pulse(
    t,
    IMPACTS.map((e) => e.t),
    decay,
    IMPACTS.map((e) => e.amp),
  );
