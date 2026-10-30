import timing from "../data/timing.json";
import heroes from "../data/heroes.json";
import { clamp01 } from "./utils/ease";

/** One sung word. env = voice loudness 0..1 sampled every 0.1 s from s to e. */
export type Word = {
  w: string; s: number; e: number; src: string; i: number;
  env: number[]; peak: number; dur: number; held: boolean; kick: boolean; beat: boolean;
};
export type Line = { id: string; section: string; text: string; style: string; words: Word[]; start: number; end: number; anchored: number };
export type Section = { id: string; kind: string; tag: string; label: string; lines: string[]; start: number; end: number };
export type Kick = { t: number; v: number };
export type Hero = { hero: string; type: string; lit: string; role: string; fx: string; motif: string; note: string };

export const T = timing as unknown as {
  fps: number; duration: number; bpm: number; beats: number[]; downbeats: number[]; kicks: Kick[];
  energy: number[]; low: number[]; sections: Section[]; lines: Line[];
};
export const HEROES = heroes as unknown as Record<string, Hero>;

export const FPS = 30;
export const DURATION_FRAMES = Math.ceil(T.duration * FPS);
export const LINES = T.lines;
export const SECTIONS = T.sections;
export const sectionById = (id: string) => SECTIONS.find((s) => s.id === id)!;
export const linesOf = (sectionId: string) => LINES.filter((l) => l.section === sectionId);

const norm = (w: string) => w.toLowerCase().replace(/[^a-z']/g, "");
/** The hero word of line li (its timing cue). */
export const heroOf = (li: number): Word => {
  const h = HEROES[String(li)];
  const l = LINES[li];
  return l.words.find((w) => norm(w.w) === norm(h.hero)) ?? l.words[l.words.length - 1];
};

/** Voice loudness 0..1 at song time t inside word w (linear between 0.1 s samples, 0 outside). */
export const vol = (w: Word, t: number) => {
  if (t < w.s || t > w.e) return 0;
  const x = (t - w.s) / 0.1;
  const i = Math.floor(x);
  const a = w.env[Math.min(i, w.env.length - 1)] ?? 0;
  const b = w.env[Math.min(i + 1, w.env.length - 1)] ?? a;
  return a + (b - a) * (x - i);
};
/** 0..1 progress through the sung note. */
export const holdP = (w: Word, t: number) => clamp01((t - w.s) / Math.max(0.05, w.e - w.s));
/** Integral of the voice over the note so far (0..1 of the full note's energy): a held note's "effect amount". */
export const sungAmount = (w: Word, t: number) => {
  const tot = w.env.reduce((a, b) => a + b, 0) || 1;
  const k = Math.max(0, Math.min(w.env.length, (t - w.s) / 0.1));
  let acc = 0;
  for (let i = 0; i < Math.floor(k); i++) acc += w.env[i];
  if (k < w.env.length) acc += (w.env[Math.floor(k)] ?? 0) * (k - Math.floor(k));
  return clamp01(acc / tot);
};

const KT = T.kicks.map((k) => k.t);
const KV = T.kicks.map((k) => k.v);
export const pulse = (t: number, events: number[], decay = 0.12, weights?: number[]) => {
  let v = 0;
  for (let i = 0; i < events.length; i++) {
    const d = t - events[i];
    if (d < 0) break;
    if (d < decay * 8) v += (weights ? weights[i] : 1) * Math.exp(-d / decay);
  }
  return v;
};
export const kickEnv = (t: number, decay = 0.11) => Math.min(1.2, pulse(t, KT, decay, KV) * 1.6);
