// Shared by `carry` and `silence` (continuity across the carry → silence cut):
//  - the slab's cracks (from `scars`, never repaired), in world coords on the resting SLAB;
//  - carry's last lyric line, "Where the world doesn't ask for me", at world row y 930 under the
//    end framing (zoom 1.06 about (760, SEAM_Y)); its "me" is still being sung after the cut, so
//    `silence` keeps drawing it (same place, same per-glyph lighting) until it is done.
import { Lyrics, type Line, type Word } from '../engine/lyrics';
import { rgba } from '../engine/palette';
import { F, font, layout, measure, type TextLayout } from '../engine/type';
import { clamp, mulberry32, smoothstep } from '../engine/util';
import { HAIR, SEAM_Y, SLAB } from './_motifs';

type P = { x: number; y: number };
const SLAB_X = 540 - SLAB.w / 2, SLAB_Y = SEAM_Y - SLAB.h;

// ----------------------------------------------------------------------------------- the cracks
let cracks: P[][] | null = null;
/** Crack polylines on the resting slab (world coords, seeded). */
export function slabCracks(): P[][] {
  if (cracks) return cracks;
  cracks = [];
  const r = mulberry32(1414);
  const starts = [[372, 1030, 0.5], [710, 1050, 2.6], [560, 1012, 1.7], [420, 1236, -1.2], [690, 1232, -2.2], [362, 1150, 0.1]] as const;
  const cx = (x: number) => clamp(x, SLAB_X + 3, SLAB_X + SLAB.w - 3), cy = (y: number) => clamp(y, SLAB_Y + 3, SEAM_Y - 3);
  for (const [x0, y0, a0] of starts) {
    const pts: P[] = [{ x: x0, y: y0 }];
    let a: number = a0, x: number = x0, y: number = y0;
    const n = 6 + Math.floor(r() * 5);
    for (let i = 0; i < n; i++) {
      a += (r() - 0.5) * 0.9;
      const step = 9 + r() * 16;
      x = cx(x + Math.cos(a) * step);
      y = cy(y + Math.sin(a) * step);
      pts.push({ x, y });
    }
    cracks.push(pts);
    if (r() < 0.6) { // a short branch
      const k = 2 + Math.floor(r() * (pts.length - 3));
      const b: P[] = [{ ...pts[k]! }];
      let ba = a0 + (r() < 0.5 ? 0.9 : -0.9), bx = pts[k]!.x, by = pts[k]!.y;
      for (let i = 0; i < 3; i++) { ba += (r() - 0.5) * 0.7; bx += Math.cos(ba) * 10; by += Math.sin(ba) * 10; b.push({ x: cx(bx), y: cy(by) }); }
      cracks.push(b);
    }
  }
  return cracks;
}

/** Draw the cracks (call with the context already in world coords; `z` = the camera zoom, so they stay hairlines). */
export function drawSlabCracks(c: CanvasRenderingContext2D, z: number, alpha = 1) {
  c.save();
  c.lineJoin = 'round'; c.lineCap = 'round';
  for (const pts of slabCracks()) {
    const path = () => { c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); };
    c.translate(0, 1 / z); path(); c.strokeStyle = rgba('ink', 0.7 * alpha); c.lineWidth = (HAIR * 1.4) / z; c.stroke(); c.translate(0, -1 / z);
    path(); c.strokeStyle = rgba('dust', 0.55 * alpha); c.lineWidth = (HAIR * 1.1) / z; c.stroke();
  }
  c.restore();
}

// ------------------------------------------------------------------------------ the lyric rows
export interface LyricRow { words: { w: Word; x: number; L: TextLayout }[]; fam: string; size: number; y: number; width: number; cx: number }

/** Lay out a line in world coords: sized to `sw` screen px (cap `cap`) at zoom z about cx, centred on screen x 540. */
export function layoutRow(line: Line, fam: string, o: { y: number; sw: number; cap: number; z: number; cx: number; trEm?: number }): LyricRow {
  const trEm = o.trEm ?? 0.01;
  const s100 = measure(line.text, fam, 100, trEm * 100);
  const size = Math.min(o.cap, (100 * o.sw) / s100) / o.z;
  const tr = trEm * size;
  const space = measure(' ', fam, size) + tr;
  let x = 0;
  const words = line.words.map((w) => { const L = layout(w.w, fam, size, tr); const r = { w, x, L }; x += L.width + space; return r; });
  const width = x - space;
  const wcx = o.cx + (540 - o.cx) / o.z;
  for (const r of words) r.x += wcx - width / 2;
  return { words, fam, size, y: o.y, width, cx: wcx };
}

/** carry's last line, exactly where carry ends it (world row y 930, the end framing 1.06 about 760). */
export function lastLineRow(line: Line): LyricRow {
  const z = 1.06;
  return layoutRow(line, F.archivo(100, 600), { y: 930, sw: 740 * z, cap: 84 * z, z, cx: 760 });
}

/**
 * Karaoke drawing of a row (world coords): each word dim (bone 30 %) at most 0.4 s early, lamp glyph by
 * glyph while sung (Lyrics.wordProgress), bone after. `show` = the row's earliest appearance, `off` = fade.
 */
export function drawLyricRow(c: CanvasRenderingContext2D, r: LyricRow, t: number, show: number, off: number) {
  if (off <= 0) return;
  c.font = font(r.fam, r.size);
  c.textBaseline = 'alphabetic';
  for (const pw of r.words) {
    const w = pw.w;
    if (t < w.start - 0.4) continue;
    const p0 = Math.max(w.start - 0.4, show);
    const pre = smoothstep(p0, p0 + 0.12, t);
    const p = Lyrics.wordProgress(w, t), n = pw.L.glyphs.length;
    const singing = t >= w.start && t < w.end;
    const base = t < w.start ? 0.3 * pre : t >= w.end ? 0.92 : 0.3;
    for (const g of pw.L.glyphs) {
      const lit = singing ? clamp(p * n - g.i) : 0;
      if (lit < 1) { c.fillStyle = rgba('bone', base * off * (1 - lit)); c.fillText(g.ch, pw.x + g.x, r.y); }
      if (lit > 0) { c.fillStyle = rgba('lamp', lit * off); c.fillText(g.ch, pw.x + g.x, r.y); }
    }
  }
}
