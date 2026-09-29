import lyricsData from "../../data/lyrics.json";
import beatsData from "../../data/beats.json";
import timingData from "../../data/timing.json";

export const FPS = 30;
export const DURATION_FRAMES = timingData.durationInFrames;

export const sec = (s: number) => Math.round(s * FPS);
export const toSec = (f: number) => f / FPS;

export type LyricLine = {
  id: string;
  text: string;
  section: string;
  hero: string;
  start: number;
  end: number;
  startFrame: number;
  hold: number;
  words: Array<{ w: string; t: number }>;
};

const lines = lyricsData.lines as LyricLine[];
const byId = new Map(lines.map((l) => [l.id, l]));

/** Lyric line by id (throws early so typos surface in the studio). */
export const lyric = (id: string): LyricLine & { f: number; endF: number } => {
  const l = byId.get(id);
  if (!l) throw new Error(`Unknown lyric id: ${id}`);
  return { ...l, f: sec(l.start), endF: sec(l.end) };
};
export const allLyrics = lines;

/** Frame at which a lyric starts (absolute). */
export const at = (id: string) => lyric(id).f;

export const BEATS: number[] = beatsData.beats;
export const DOWNBEATS: number[] = beatsData.downbeats;
export const BEAT = beatsData.beatPeriod;
const ENERGY: number[] = beatsData.energyPerSecond;
const LOW: number[] = beatsData.lowPerSecond;

const lastBefore = (arr: number[], t: number) => {
  let lo = 0,
    hi = arr.length - 1,
    ans = -1;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    if (arr[m] <= t) {
      ans = m;
      lo = m + 1;
    } else hi = m - 1;
  }
  return ans;
};

/** 1 on the beat, decaying exponentially. `frame` is absolute. */
export const beatPulse = (frame: number, decay = 7, list: number[] = BEATS) => {
  const t = frame / FPS;
  const i = lastBefore(list, t + 0.5 / FPS);
  if (i < 0) return 0;
  const dt = Math.max(0, t - list[i]);
  return Math.exp(-dt * decay);
};
export const downbeatPulse = (frame: number, decay = 5) => beatPulse(frame, decay, DOWNBEATS);

/** Index of the beat active at absolute frame. */
export const beatIndex = (frame: number) => lastBefore(BEATS, frame / FPS + 0.5 / FPS);

const sample = (arr: number[], frame: number) => {
  const t = frame / FPS - 0.5;
  const i = Math.max(0, Math.min(arr.length - 2, Math.floor(t)));
  const k = Math.max(0, Math.min(1, t - i));
  return arr[i] * (1 - k) + arr[i + 1] * k;
};
/** Normalised loudness 0..~1.3 (mean ≈ 0.6). */
export const energy = (frame: number) => sample(ENERGY, frame) / 0.2;
/** Normalised kick/low-end presence 0..~1.4. */
export const lowEnergy = (frame: number) => sample(LOW, frame) / 22;
