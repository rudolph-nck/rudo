// RUDO album motifs (docs/STYLE.md, "Album motifs"), shared so every plate draws them identically:
//  1. the SEAM        one bone hairline, the wall/floor edge (y ≈ 1240)
//  2. the AMBER POINT a lamp point with a hot core and a soft tail; the only thing that leaves the seam
//  3. the SLAB        a plain rectangle of the wall, hairline-drawn with concrete texture: the weight
//  4. the TETHER      a hairline from any floating thing straight down to the seam (taut or slack)
//  5. the CLOCK       Plex Mono `HH:MM:SS AM`, top-left, seconds ticking with song time
// Read-only for scene work (CLAUDE.md): ask the lead for changes.
// GL versions draw into a 2D LineBatch (logical px, y down; additive or max blend for the glows);
// the *2D versions draw into a Canvas2D layer. Everything is a pure function of its arguments.
import type { LineBatch } from '../engine/lines';
import { LIN, rgba } from '../engine/palette';
import { F, font } from '../engine/type';
import { W } from '../engine/gl';
import { clamp, hash, lerp, mulberry32, TAU } from '../engine/util';

type RGB = [number, number, number];
type P2 = { x: number; y: number };
const mul = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];

/** Logical layout constants (STYLE.md "Frame"). */
export const SEAM_Y = 1240;
export const SAFE = { x0: 120, x1: 960, y0: 220, y1: 1480 } as const;
/** Hairline width in logical px (LineBatch scales it per physical px, so 2× renders look the same). */
export const HAIR = 1.25;

// ------------------------------------------------------------------------------- 1. the seam
/**
 * The seam: one bone hairline from x0 to x1 at y. `intensity` 0..1 dims it (plate 1's "for a minute"),
 * `gap` opens a door in it ([xa, xb], the `break` plate) with the two cut ends glowing slightly.
 */
export function seam(lb: LineBatch, y = SEAM_Y, o: { x0?: number; x1?: number; intensity?: number; width?: number; color?: RGB; gap?: [number, number] } = {}) {
  const x0 = o.x0 ?? 0, x1 = o.x1 ?? W, I = o.intensity ?? 1, w = o.width ?? HAIR;
  const col = mul(o.color ?? LIN.bone, 0.85 * I);
  if (I <= 0.001) return;
  if (!o.gap) { lb.seg2(x0, y, x1, y, w, col, 1); return; }
  const [a, b] = o.gap;
  if (a > x0) lb.seg2(x0, y, a, y, w, col, 1);
  if (b < x1) lb.seg2(b, y, x1, y, w, col, 1);
  for (const x of [a, b]) lb.seg2(x, y, x + 0.01, y, 4 * w, mul(LIN.bone, 1.2 * I), 0.8);
}

/** Canvas2D seam (for plates that compose the room in a 2D layer). */
export function seam2D(c: CanvasRenderingContext2D, y = SEAM_Y, o: { x0?: number; x1?: number; alpha?: number; width?: number } = {}) {
  c.save();
  c.strokeStyle = rgba('bone', 0.85 * (o.alpha ?? 1));
  c.lineWidth = o.width ?? HAIR;
  c.beginPath(); c.moveTo(o.x0 ?? 0, y); c.lineTo(o.x1 ?? W, y); c.stroke();
  c.restore();
}

/**
 * The room around the seam (the cover's light): a soft lamp falloff from above onto the concrete
 * wall, and the barest reflection of it on the floor below the seam. Canvas2D, drawn on ink.
 */
export function roomLight2D(c: CanvasRenderingContext2D, y = SEAM_Y, o: { intensity?: number; cx?: number } = {}) {
  const I = o.intensity ?? 1, cx = o.cx ?? W / 2;
  if (I <= 0.001) return;
  c.save();
  const g = c.createRadialGradient(cx, -120, 40, cx, y * 0.55, y * 1.05);
  g.addColorStop(0, rgba('concrete', 0.95 * I));
  g.addColorStop(0.55, rgba('concrete', 0.45 * I));
  g.addColorStop(1, rgba('concrete', 0));
  c.fillStyle = g;
  c.fillRect(0, 0, W, y);
  // floor: a faint, vertically squashed reflection of the falloff
  const f = c.createLinearGradient(0, y, 0, y + 220);
  f.addColorStop(0, rgba('concrete', 0.35 * I));
  f.addColorStop(1, rgba('concrete', 0));
  c.fillStyle = f;
  c.fillRect(0, y, W, 220);
  c.restore();
}

// ------------------------------------------------------------------------ 2. the amber point
/**
 * The amber point's head: a lamp halo, an ember ring and a hot core (> 1 linear: it blooms), with a
 * slow breathing flicker. 2D LineBatch, draw after anything it sits on.
 */
export function amberPoint(lb: LineBatch, x: number, y: number, t: number, scale = 1, intensity = 1) {
  const flick = 0.92 + 0.08 * Math.sin(t * 7.3) * Math.sin(t * 3.1 + 1.3); // slow: a lamp, not a fuse
  const I = intensity * flick;
  if (I <= 0.001) return;
  lb.seg2(x, y, x + 0.01, y, 34 * scale, mul(LIN.lamp, 0.35 * I), 0.3);
  lb.seg2(x, y, x + 0.01, y, 16 * scale, mul(LIN.lamp, 1.4 * I), 0.75);
  lb.seg2(x, y, x + 0.01, y, 8 * scale, mul(LIN.ember, 3.2 * I), 0.9);
  lb.seg2(x, y, x + 0.01, y, 4 * scale, [3.4 * I, 2.4 * I, 1.3 * I], 1);
}

/**
 * The amber point's tail: where the head was over the last `len` seconds (`headAt(t)`), drawn as a
 * fading lamp trail, plus a few slow embers shed along it (deterministic: born on a fixed clock with
 * hashed drift, so every sub-frame agrees). Draw before amberPoint().
 */
export function amberTail(lb: LineBatch, t: number, headAt: (t: number) => P2 | null, o: { len?: number; steps?: number; width?: number; intensity?: number; embers?: number; seed?: number; maxStep?: number } = {}) {
  const len = o.len ?? 0.6, steps = o.steps ?? 24, I = o.intensity ?? 1, w = o.width ?? 3;
  let prev = headAt(t);
  for (let i = 1; i <= steps && prev; i++) {
    const tb = t - (len * i) / steps;
    const p = headAt(tb);
    // stop at a jump (the point re-placed under another line's word): a tail is a path, not a teleport
    if (!p || Math.hypot(p.x - prev.x, p.y - prev.y) > (o.maxStep ?? 48)) break;
    const k = 1 - i / steps;
    lb.seg2(prev.x, prev.y, p.x, p.y, w * (0.4 + 0.6 * k), mul(LIN.lamp, 1.6 * I * k * k), Math.min(1, k * 1.5));
    prev = p;
  }
  // embers: a slow rate, short lives, drifting up a little (warm air, not sparks)
  const rate = o.embers ?? 14, seed = o.seed ?? 7, life = 0.9;
  if (rate <= 0) return;
  for (let n = Math.floor((t - life) * rate); n <= Math.floor(t * rate); n++) {
    const tb = n / rate, age = t - tb;
    if (age < 0 || age > life * (0.5 + 0.5 * hash(n, seed))) continue;
    const h = headAt(tb);
    if (!h) continue;
    const k = 1 - age / life;
    const x = h.x + (hash(n, seed + 1) - 0.5) * 30 * age, y = h.y - (8 + 26 * hash(n, seed + 2)) * age;
    lb.seg2(x, y, x + 0.01, y - 0.01, 2.2 * k + 0.6, mul(LIN.lamp, 1.8 * I * k), k);
  }
}

/** Canvas2D amber point (for 2D layers; it will not bloom there, so prefer the GL version). */
export function amberPoint2D(c: CanvasRenderingContext2D, x: number, y: number, scale = 1, alpha = 1) {
  const r = 18 * scale;
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(255,236,205,${alpha})`);
  g.addColorStop(0.22, rgba('lamp', 0.95 * alpha));
  g.addColorStop(0.55, rgba('ember', 0.35 * alpha));
  g.addColorStop(1, rgba('lamp', 0));
  c.fillStyle = g;
  c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
}

// --------------------------------------------------------------------------------- 3. the slab
const slabTex = new Map<string, HTMLCanvasElement>();
/** Concrete texture tile (seeded, cached): concrete base, soft mottling, a few pores and hairline pours. */
function concreteTile(seed: number, size = 256): HTMLCanvasElement {
  const key = `${seed}:${size}`;
  let cv = slabTex.get(key);
  if (cv) return cv;
  cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const c = cv.getContext('2d')!;
  const rnd = mulberry32(seed);
  c.fillStyle = rgba('concrete', 1);
  c.fillRect(0, 0, size, size);
  for (let i = 0; i < 220; i++) { // mottling
    const x = rnd() * size, y = rnd() * size, r = 8 + rnd() * 40;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    const light = rnd() < 0.5;
    g.addColorStop(0, light ? rgba('dust', 0.05 + rnd() * 0.05) : rgba('ink', 0.06 + rnd() * 0.08));
    g.addColorStop(1, rgba('ink', 0));
    c.fillStyle = g;
    // wrap so the tile repeats seamlessly
    for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) { c.beginPath(); c.arc(x + dx, y + dy, r, 0, TAU); c.fill(); }
  }
  for (let i = 0; i < 90; i++) { // pores
    c.fillStyle = rgba('ink', 0.25 + rnd() * 0.35);
    c.beginPath(); c.arc(rnd() * size, rnd() * size, 0.4 + rnd() * 1.1, 0, TAU); c.fill();
  }
  c.strokeStyle = rgba('dust', 0.06); c.lineWidth = 1; // pour lines
  for (let i = 0; i < 3; i++) { const y = rnd() * size; c.beginPath(); c.moveTo(0, y); c.lineTo(size, y + (rnd() - 0.5) * 6); c.stroke(); }
  slabTex.set(key, cv);
  return cv;
}

/**
 * The slab: a plain rectangle of the wall (x, y = top-left, w, h in logical px), concrete-textured and
 * hairline-edged in bone. `alpha` fades it, `lit` 0..1 adds the lamp's light from above, `seed` picks the
 * texture. Canvas2D; use a perspective transform on the context for slabs lying in the room.
 */
export function slab2D(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, o: { alpha?: number; lit?: number; seed?: number; edge?: number } = {}) {
  const a = o.alpha ?? 1;
  if (a <= 0.001) return;
  c.save();
  c.globalAlpha *= a;
  const pat = c.createPattern(concreteTile(o.seed ?? 3), 'repeat')!;
  pat.setTransform(new DOMMatrix().translate(x, y));
  c.fillStyle = pat;
  c.fillRect(x, y, w, h);
  const lit = o.lit ?? 0.6;
  if (lit > 0) {
    const g = c.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, rgba('dust', 0.14 * lit));
    g.addColorStop(1, rgba('ink', 0.25));
    c.fillStyle = g;
    c.fillRect(x, y, w, h);
  }
  c.strokeStyle = rgba('bone', 0.8 * (o.edge ?? 1));
  c.lineWidth = HAIR;
  c.strokeRect(x + HAIR / 2, y + HAIR / 2, w - HAIR, h - HAIR);
  c.restore();
}

/** The slab's hairline outline only (GL, e.g. a slab seen edge-on or as a wireframe in 3D-projected plates). */
export function slabEdges(lb: LineBatch, corners: [P2, P2, P2, P2], o: { intensity?: number; width?: number } = {}) {
  const col = mul(LIN.bone, 0.85 * (o.intensity ?? 1)), w = o.width ?? HAIR;
  for (let i = 0; i < 4; i++) { const p = corners[i]!, q = corners[(i + 1) % 4]!; lb.seg2(p.x, p.y, q.x, q.y, w, col, 1); }
}

// -------------------------------------------------------------------------------- 4. the tether
/**
 * Points of a tether from (x, y) (the floating thing) down to the seam at (ax, seamY). `slack` 0 = taut
 * (straight); 1 = released: the line sags sideways into a soft curve (a catenary-ish bow), the bow's
 * side and a slow sway set by `t` and `seed`.
 */
export function tetherPoints(x: number, y: number, ax: number, seamY: number, slack: number, t = 0, seed = 1, n = 24): P2[] {
  const pts: P2[] = [];
  const len = Math.hypot(ax - x, seamY - y);
  const side = hash(seed) < 0.5 ? -1 : 1;
  const sway = Math.sin(t * 0.9 + seed * 2.1) * 0.25;
  const bow = clamp(slack) * len * 0.18 * side * (1 + sway);
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const px = lerp(x, ax, u), py = lerp(y, seamY, u);
    // perpendicular offset: 0 at both ends, largest past the middle (weight hangs low)
    const s = Math.sin(Math.PI * u) * (1 + 0.35 * (u - 0.5));
    const nx = (seamY - y) / (len || 1), ny = -(ax - x) / (len || 1);
    pts.push({ x: px + nx * bow * s, y: py + ny * bow * s });
  }
  return pts;
}

/** Draw a tether (GL hairline), ending in a small bone anchor tick on the seam. */
export function tether(lb: LineBatch, x: number, y: number, ax: number, seamY = SEAM_Y, o: { slack?: number; t?: number; seed?: number; intensity?: number; width?: number } = {}) {
  const I = o.intensity ?? 1;
  if (I <= 0.001) return;
  const pts = tetherPoints(x, y, ax, seamY, o.slack ?? 0, o.t ?? 0, o.seed ?? 1);
  lb.polyline(pts, o.width ?? HAIR, mul(LIN.bone, 0.7 * I), 1);
  lb.seg2(ax - 5, seamY, ax + 5, seamY, (o.width ?? HAIR) * 1.6, mul(LIN.bone, 0.9 * I), 1);
}

/** Canvas2D tether. */
export function tether2D(c: CanvasRenderingContext2D, x: number, y: number, ax: number, seamY = SEAM_Y, o: { slack?: number; t?: number; seed?: number; alpha?: number; width?: number } = {}) {
  const pts = tetherPoints(x, y, ax, seamY, o.slack ?? 0, o.t ?? 0, o.seed ?? 1);
  c.save();
  c.strokeStyle = rgba('bone', 0.7 * (o.alpha ?? 1));
  c.lineWidth = o.width ?? HAIR;
  c.beginPath();
  pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
  c.stroke();
  c.restore();
}

// --------------------------------------------------------------------------------- 5. the clock
/** Seconds since midnight for 'HH:MM[:SS]' (24 h). */
export const clockSec = (hms: string) => { const [h = 0, m = 0, s = 0] = hms.split(':').map(Number); return h * 3600 + m * 60 + s; };

/** `HH:MM:SS AM` for seconds since midnight (STYLE: the clock motif's one format). */
export function clockText(sec: number): string {
  const s = ((Math.floor(sec) % 86400) + 86400) % 86400;
  const h24 = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(h12)}:${p(m)}:${p(ss)} ${h24 < 12 ? 'AM' : 'PM'}`;
}

/**
 * Clock time at song time t: starts at `base` ('04:37:00') at song time `t0`, ticks with song time, and
 * freezes at `stopAt` (song time) if given — "on 'stop' the clock's seconds stop".
 */
export function clockAt(t: number, base = '04:37:00', t0 = 0, stopAt?: number): number {
  const tt = stopAt !== undefined ? Math.min(t, stopAt) : t;
  return clockSec(base) + Math.max(0, tt - t0);
}

/** Clock position: top-left, inside the safe area (no words in the top 200 px). Baseline y. */
export const CLOCK_POS = { x: SAFE.x0, y: 262, size: 34 } as const;

/** Draw the clock (Plex Mono, dust by default) at CLOCK_POS unless overridden. Canvas2D. */
export function drawClock2D(c: CanvasRenderingContext2D, sec: number, o: { x?: number; y?: number; size?: number; color?: string; alpha?: number } = {}) {
  c.save();
  c.font = font(F.mono(400), o.size ?? CLOCK_POS.size);
  c.fillStyle = o.color ?? rgba('dust', o.alpha ?? 0.9);
  c.textBaseline = 'alphabetic';
  c.fillText(clockText(sec), o.x ?? CLOCK_POS.x, o.y ?? CLOCK_POS.y);
  c.restore();
}
