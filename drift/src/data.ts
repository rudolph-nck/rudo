import timing from "../data/timing.json";
import heroes from "../data/heroes.json";
import { clamp01 } from "./utils/ease";

/** One sung word. env = voice loudness 0..1 sampled every 0.1 s from s to e. */
export type Word = {
  w: string; s: number; e: number; src: string; i: number;
  env: number[]; peak: number; dur: number; held: boolean; kick: boolean; beat: boolean;
  syl?: { t: string; s: number; e: number }[];
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

// ---------------------------------------------------------------------------------------------
/**
 * The word as it is being sung at time t: syllables appear as the voice reaches them; on a held
 * syllable its vowel keeps repeating (FAAAA) and the final consonants land only when the note ends
 * (FAAAAR). After it lands the stretch eases back to the plain spelling.
 */
const VOWEL = /[AEIOUY]/;
export const sungText = (w: Word, t: number) => {
  const syl = w.syl && w.syl.length ? w.syl : [{ t: w.w, s: w.s, e: w.e }];
  let out = "";
  for (const sy of syl) {
    if (t < sy.s - 0.03) break;
    const txt = sy.t.toUpperCase().replace(/[.,!?]/g, "");
    const dur = sy.e - sy.s;
    // the sung vowel: the syllable's first vowel group (TIIIRED, not TIREEED); in EA/OA-type pairs
    // the voice sits on the second letter (PEAAAR)
    let vi = -1;
    const m = /[AEIOU]+/.exec(txt) ?? /Y/.exec(txt);
    if (m) vi = m.index + (m[0].length > 1 && /[AO]$/.test(m[0]) ? m[0].length - 1 : 0);
    if (dur < 0.42 || vi < 0) { out += txt; continue; }
    const per = 0.16, maxX = 5;
    if (t < sy.e - 0.06) { // still holding: add vowels, no landing yet
      out += txt.slice(0, vi + 1) + txt[vi].repeat(Math.max(0, Math.min(maxX, Math.floor((t - sy.s - 0.12) / per))));
      return out;
    }
    const full = Math.max(0, Math.min(maxX, Math.floor((dur - 0.18) / per)));
    const ease = Math.min(1, Math.max(0, (t - sy.e - 0.35) / 0.45));
    out += txt.slice(0, vi + 1) + txt[vi].repeat(Math.round(full * (1 - ease))) + txt.slice(vi + 1);
  }
  return out;
};

import bassData from "../data/bass.json";
const BASS = bassData as unknown as { hop: number; level: number[]; hit: number[] };
/** Bass level 0..1 (low end of the mix) at t. */
export const bassLevel = (t: number) => BASS.level[Math.max(0, Math.min(BASS.level.length - 1, Math.round(t / BASS.hop)))] ?? 0;
/** Bass hits: each low-end attack as a quick pulse that decays (for pushing objects around). */
export const bassHit = (t: number, decay = 0.09) => {
  let v = 0;
  const i0 = Math.round(t / BASS.hop);
  for (let k = 0; k < Math.round((decay * 5) / BASS.hop); k++) {
    const h = BASS.hit[i0 - k];
    if (h) v = Math.max(v, h * Math.exp(-(k * BASS.hop) / decay));
  }
  return Math.min(1, v);
};
