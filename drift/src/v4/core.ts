import * as THREE from "three";
import { LINES, T } from "../data";
import { clamp01, cubicInOut, cubicOut } from "../utils/ease";
import { noise1, rng } from "../utils/random";

/** Drift v2 engine core: timing helpers, beat/snare grid, word behaviours in 3D, and a cinematic camera spline. */
export const W = (li: number, wi: number) => LINES[li].words[wi];
export const L0 = (li: number) => LINES[li].words[0].s;
export const clean = (s: string) => s.toUpperCase().replace(/[.,!?…]/g, "");

/** Snares: beats 2 and 4 of every bar. */
export const SNARES: number[] = (() => {
  const out: number[] = [];
  const d = T.downbeats;
  for (let i = 0; i < d.length; i++) {
    const bar = T.beats.filter((b) => b >= d[i] - 0.01 && (i + 1 >= d.length || b < d[i + 1] - 0.01));
    if (bar[1] !== undefined) out.push(bar[1]);
    if (bar[3] !== undefined) out.push(bar[3]);
  }
  return out;
})();
export const KICKS = T.kicks.filter((k) => k.v > 0.5).map((k) => k.t);
/** Latest event at or before t within a window (or undefined). */
export const lastIn = (ev: number[], t: number, win = 99) => { let r: number | undefined; for (const e of ev) { if (e <= t && t - e < win) r = e; if (e > t) break; } return r; };
export const nearest = (ev: number[], t: number, win: number) => { let r = t, d = win; for (const e of ev) { if (Math.abs(e - t) < d) { d = Math.abs(e - t); r = e; } } return r; };

/** Which syllable each letter of a word belongs to: letters appear as their syllable is sung. */
export const sylStarts = (li: number, wi: number) => {
  const w = W(li, wi), text = clean(w.w);
  const syl = w.syl && w.syl.length ? w.syl : [{ t: w.w, s: w.s, e: w.e }];
  const lens = syl.map((s) => clean(s.t).length || 1);
  const total = lens.reduce((a, b) => a + b, 0);
  const out: number[] = [];
  let k = 0, acc = 0;
  for (let i = 0; i < text.length; i++) {
    while (k < syl.length - 1 && i >= Math.round(((acc + lens[k]) / total) * text.length)) { acc += lens[k]; k++; }
    out.push(syl[k].s);
  }
  return out;
};

export type Beh = "pop" | "sag" | "float" | "drop" | "squeeze" | "split" | "shatter" | "jitter" | "dissolve" | "stretch" | "stamp" | "rise" | "beat" | "type" | "freeze";
export type LX = { p: [number, number, number]; r: [number, number, number]; s: number; o: number; hide?: boolean };

/**
 * One letter of a sung word, in the word's local space (units = the word's size).
 * i: letter index, n: letter count, x: its x in the laid-out word, appear: when its syllable is sung.
 */
export const letterXf = (beh: Beh, t: number, w: { s: number; e: number }, i: number, n: number, x: number, appear: number, seed: number, kickT?: number): LX => {
  const u = t - w.s, hold = Math.max(0.15, w.e - w.s), after = t - w.e;
  const ci = i - (n - 1) / 2;
  let ap = cubicOut(clamp01((t - (appear - 0.03)) / 0.14));
  if (beh === "stamp" || beh === "drop" || beh === "freeze") ap = t >= w.s - 0.02 ? 1 : 0;
  if (beh === "type") ap = t >= w.s + (i / n) * Math.min(hold, 0.8) ? 1 : 0;
  const r = rng(seed * 977 + i);
  let px = x, py = (1 - ap) * -0.25, pz = (1 - ap) * 0.6, rx = 0, ry = (1 - ap) * 0.6, rz = 0, s = 1, o = ap;
  if (beh === "sag") { const k = cubicInOut(clamp01((u - 0.3) / 1.4)); py -= k * (0.18 * Math.sin(Math.PI * (i + 0.5) / n) + 0.05); rz += k * ci * -0.09; px += k * ci * 0.05; }
  if (beh === "float") { const v = Math.max(0, t - (w.s + 0.28 + i * 0.16)); py += 0.12 * v + 0.07 * v * v; px += Math.sin(v * 1.1 + i * 1.7) * 0.12 * Math.min(1, v); pz += Math.sin(v * 0.7 + i) * 0.3 * Math.min(1, v); rz += Math.sin(v * 0.8 + i) * 0.25 * Math.min(1, v); ry += Math.sin(v * 0.6 + i * 2) * 0.6 * Math.min(1, v); }
  if (beh === "drop") { const k = cubicOut(clamp01((t - (w.s - 0.02)) / 0.16)); py += (1 - k) * 2.5; }
  if (beh === "squeeze") { const k = cubicOut(clamp01((u - 0.05) / 0.4)); px *= 1 - 0.3 * k; s *= 1 - 0.08 * k; }
  if (beh === "split") { const k = cubicInOut(clamp01(u / Math.max(0.6, hold))); px += ci * 0.35 * k; py += (i % 2 ? 1 : -1) * 0.06 * k; rz += ci * 0.04 * k; pz += Math.abs(ci) * 0.2 * k; }
  if (beh === "stretch") { const k = cubicInOut(clamp01(u / hold)) * (1 - cubicInOut(clamp01(after / 0.5))); px += ci * 0.25 * k; if (n === 1) s *= 1 + 0.5 * k; }
  if (beh === "stamp") { const k = clamp01((t - w.s) / 0.12); s *= 1 + 0.8 * (1 - cubicOut(k)); pz += (1 - k) * 0.8; }
  if (beh === "freeze") { const k = clamp01((t - w.s) / 0.06); s *= 1 + 0.25 * (1 - k); }
  if (beh === "rise") { const k = cubicOut(clamp01((t - w.s) / 0.7)); py -= (1 - k) * 0.5; }
  if (beh === "beat") { const kd = kickT !== undefined ? t - kickT : 9; s *= 1 + 0.12 * Math.exp(-Math.max(0, kd) / 0.1) * (t > w.s ? 1 : 0); }
  if (beh === "jitter" && t > appear) { px += (noise1(t * 11, i * 3.1) - 0.5) * 0.08; py += (noise1(t * 11, i * 7.3) - 0.5) * 0.08; rz += (noise1(t * 9, i) - 0.5) * 0.3; }
  if (beh === "shatter") { const v = Math.max(0, t - (w.e + 0.05)); if (v > 0) { px += (r() - 0.5) * 4 * v; py += -3 * v * v + (0.5 + r()) * v; pz += (r() - 0.2) * 3 * v; rx += (r() - 0.5) * 9 * v; rz += (r() - 0.5) * 9 * v; o *= 1 - clamp01(v / 0.9); } }
  if (beh === "dissolve") { const v = Math.max(0, t - (w.e + i * 0.06)); if (v > 0) { o *= 1 - clamp01(v / 0.7); py += v * 0.25; s *= 1 - 0.3 * clamp01(v / 0.7); } }
  return { p: [px, py, pz], r: [rx, ry, rz], s, o };
};

/** Heat of a word: 1 while it's sung, cooling over 0.6 s. */
export const heat = (t: number, w: { s: number; e: number }) => (t < w.s ? 0 : t < w.e ? 1 : Math.exp(-(t - w.e) / 0.6));

// ---------------------------------------------------------------------------------------------
/** A camera key. Position and look-at in world space; fov in degrees; roll in radians. */
export type CamKey = { t: number; p: [number, number, number]; l: [number, number, number]; f?: number; roll?: number };
/** Smooth camera through keys: centripetal Catmull-Rom on position and target, eased timing per segment, averaged
 *  over a short window so every move eases in and out (no linear starts or stops). */
export const makeCamera = (keys: CamKey[], smooth = 0.25) => {
  const P = new THREE.CatmullRomCurve3(keys.map((k) => new THREE.Vector3(...k.p)), false, "centripetal");
  const Lc = new THREE.CatmullRomCurve3(keys.map((k) => new THREE.Vector3(...k.l)), false, "centripetal");
  const n = keys.length;
  const at = (t: number) => {
    let i = 0;
    while (i < n - 2 && t > keys[i + 1].t) i++;
    const u = clamp01((t - keys[i].t) / Math.max(1e-3, keys[i + 1].t - keys[i].t));
    const q = (i + u) / (n - 1);
    const f = (keys[i].f ?? 40) + ((keys[i + 1].f ?? 40) - (keys[i].f ?? 40)) * cubicInOut(u);
    const roll = (keys[i].roll ?? 0) + ((keys[i + 1].roll ?? 0) - (keys[i].roll ?? 0)) * cubicInOut(u);
    return { p: P.getPoint(clamp01(q)), l: Lc.getPoint(clamp01(q)), f, roll };
  };
  return (t: number) => {
    if (smooth <= 0) return at(t);
    const off = [-1, -0.66, -0.33, 0, 0.33, 0.66, 1], wt = [0.4, 0.75, 1, 1.1, 1, 0.75, 0.4], ws = wt.reduce((a, b) => a + b, 0);
    const p = new THREE.Vector3(), l = new THREE.Vector3();
    let f = 0, roll = 0;
    off.forEach((o, k) => { const c = at(Math.min(keys[n - 1].t, Math.max(keys[0].t, t + o * smooth))); p.addScaledVector(c.p, wt[k] / ws); l.addScaledVector(c.l, wt[k] / ws); f += (c.f * wt[k]) / ws; roll += (c.roll * wt[k]) / ws; });
    return { p, l, f, roll };
  };
};
/** Handheld breath: tiny, smooth, never jittery unless asked. */
export const handheld = (t: number, amp: number, speed = 1) => new THREE.Vector3((noise1(t * 0.6 * speed, 11) - 0.5) * amp, (noise1(t * 0.5 * speed, 12) - 0.5) * amp, (noise1(t * 0.55 * speed, 13) - 0.5) * amp);
