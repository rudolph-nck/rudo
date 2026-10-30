export type Ease = (t: number) => number;

export const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;

export const linear: Ease = (t) => t;
export const cubicInOut: Ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const cubicOut: Ease = (t) => 1 - Math.pow(1 - t, 3);
export const cubicIn: Ease = (t) => t * t * t;
export const quintOut: Ease = (t) => 1 - Math.pow(1 - t, 5);
export const quintInOut: Ease = (t) => (t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2);
export const expoOut: Ease = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
export const expoIn: Ease = (t) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10));
export const expoInOut: Ease = (t) =>
  t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2;
export const sineInOut: Ease = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
/** Tiny, controlled overshoot for downbeat hits only (≈2%). */
export const softBack: Ease = (t) => {
  const c1 = 0.6,
    c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

/** 0→1 progress for local frame f over [start, start+dur], eased. */
export const ramp = (f: number, start: number, dur: number, ease: Ease = cubicInOut) =>
  ease(clamp01((f - start) / Math.max(1, dur)));

/** Fade in over [a, a+inDur] and out over [b-outDur, b]. */
export const window01 = (f: number, a: number, b: number, inDur = 12, outDur = 12, ease: Ease = cubicInOut) =>
  Math.min(ramp(f, a, inDur, ease), 1 - ramp(f, b - outDur, outDur, ease));

/**
 * Piecewise keyframe interpolation. keys: [[frame, value], ...] sorted.
 * Each segment eased with `ease` (or per-key ease in 3rd slot).
 */
export const keys = (f: number, ks: Array<[number, number, Ease?]>, ease: Ease = cubicInOut) => {
  if (f <= ks[0][0]) return ks[0][1];
  for (let i = 0; i < ks.length - 1; i++) {
    const [f0, v0] = ks[i];
    const [f1, v1, e] = ks[i + 1];
    if (f <= f1) return mix(v0, v1, (e ?? ease)(clamp01((f - f0) / Math.max(1e-6, f1 - f0))));
  }
  return ks[ks.length - 1][1];
};
