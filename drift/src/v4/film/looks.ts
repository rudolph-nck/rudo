/**
 * Global environment configuration for Drift v2: one "look" per act of the story.
 *  CAGE     — the concrete workshop: near-black ambient, one hard overhead key, wet concrete, heavy haze.
 *  VOID     — the chorus sky: weightless indigo + amber starlight, crystalline type, thin atmosphere.
 *  MONOLITH — the return: grounded, cold dawn key, bold type standing on wet stone.
 * Scenes interpolate between looks with `mixLook` so act changes grade smoothly instead of cutting.
 */
export type FilmLook = {
  bg: string;
  /** Exponential-squared atmosphere. Density is per metre (our world is built in real metres). */
  fog: { color: string; density: number };
  ambient: number;
  env: number;
  exposure: number;
  bloom: { intensity: number; threshold: number; smoothing: number };
  vignette: { offset: number; darkness: number };
  ca: number;
  grain: number;
  /** Depth of field: bokeh size in px at 1080p; focus is driven per shot. */
  bokeh: number;
  /** 0 = brutalist concrete type, 1 = crystal type. */
  crystal: number;
};

export const CAGE: FilmLook = {
  bg: "#0b0b0d", fog: { color: "#0b0b0d", density: 0.16 }, ambient: 0.02, env: 0.22, exposure: 1.0,
  bloom: { intensity: 1.2, threshold: 0.15, smoothing: 0.7 }, vignette: { offset: 0.15, darkness: 1.3 },
  ca: 0.0015, grain: 0.03, bokeh: 4.5, crystal: 0,
};
export const VOID: FilmLook = {
  bg: "#05040c", fog: { color: "#0a0820", density: 0.0 }, ambient: 0.02, env: 0.5, exposure: 1.05,
  bloom: { intensity: 1.2, threshold: 0.15, smoothing: 0.7 }, vignette: { offset: 0.15, darkness: 1.15 },
  ca: 0.0015, grain: 0.03, bokeh: 2.5, crystal: 1,
};
export const MONOLITH: FilmLook = {
  bg: "#0b0b0d", fog: { color: "#10121a", density: 0.035 }, ambient: 0.02, env: 0.3, exposure: 1.0,
  bloom: { intensity: 1.0, threshold: 0.15, smoothing: 0.7 }, vignette: { offset: 0.15, darkness: 1.3 },
  ca: 0.0015, grain: 0.03, bokeh: 3.5, crystal: 0,
};

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const lerpHex = (a: string, b: string, k: number) => {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(lerp((pa >> s) & 255, (pb >> s) & 255, k));
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, "0")}`;
};
export const mixLook = (a: FilmLook, b: FilmLook, k: number): FilmLook => (k <= 0 ? a : k >= 1 ? b : {
  bg: lerpHex(a.bg, b.bg, k),
  fog: { color: lerpHex(a.fog.color, b.fog.color, k), density: lerp(a.fog.density, b.fog.density, k) },
  ambient: lerp(a.ambient, b.ambient, k), env: lerp(a.env, b.env, k), exposure: lerp(a.exposure, b.exposure, k),
  bloom: { intensity: lerp(a.bloom.intensity, b.bloom.intensity, k), threshold: lerp(a.bloom.threshold, b.bloom.threshold, k), smoothing: lerp(a.bloom.smoothing, b.bloom.smoothing, k) },
  vignette: { offset: lerp(a.vignette.offset, b.vignette.offset, k), darkness: lerp(a.vignette.darkness, b.vignette.darkness, k) },
  ca: lerp(a.ca, b.ca, k), grain: lerp(a.grain, b.grain, k), bokeh: lerp(a.bokeh, b.bokeh, k), crystal: lerp(a.crystal, b.crystal, k),
});

/** Which look each section of the song lives in (the full-song skeleton). */
export const SECTION_LOOK: Record<string, FilmLook> = {
  intro: CAGE, verse1: CAGE, prechorus1: CAGE, chorus1: VOID,
  verse2: VOID, prechorus2: VOID, chorus2: VOID,
  bridge: CAGE, breakdown: CAGE, chorus3: VOID, outro: MONOLITH,
};
