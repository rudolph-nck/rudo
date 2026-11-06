// The downward look down the tether (shared by `stars`, which ends on it, and the hook reprise, which opens
// on it): the seam far below as a short hairline, the amber point (home) on it, the tether taut straight
// up from it, and the end of the line ("for a bit") set small beside the point.
import type { LineBatch } from '../engine/lines';
import { Lyrics, type Word } from '../engine/lyrics';
import { LIN, rgba } from '../engine/palette';
import { F, font, layout } from '../engine/type';
import { clamp } from '../engine/util';
import { amberPoint, HAIR, HANDOFF, seam } from './_motifs';

/** half: the seam's half-length (HANDOFF.downLook.seamHalf = far below); tetherTop: where the tether starts (0 = from above the frame). */
export function downLook(lb: LineBatch, t: number, o: { half?: number; tetherTop?: number; point?: number; tether?: number } = {}) {
  const D = HANDOFF.downLook;
  const half = o.half ?? D.seamHalf;
  seam(lb, D.y, { x0: D.x - half, x1: D.x + half });
  const top = o.tetherTop ?? 0;
  if ((o.tether ?? 1) > 0.001 && top < D.y - 8)
    lb.seg2(D.x, top, D.x, D.y - 6, HAIR, [LIN.bone[0] * 0.75, LIN.bone[1] * 0.75, LIN.bone[2] * 0.75], o.tether ?? 1);
  amberPoint(lb, D.x, D.y, t, 0.9, o.point ?? 1);
}

/** "for a bit": small, beside the amber point, each word appearing on its start and lit lamp while sung. */
export function forABit(c: CanvasRenderingContext2D, words: Word[], t: number, alpha = 1) {
  const D = HANDOFF.downLook;
  const fam = F.archivo(125, 500), size = 34, tr = 0.06 * size;
  let x = D.x + 28;
  c.save();
  c.font = font(fam, size);
  c.letterSpacing = `${tr}px`;
  for (const w of words) {
    const L = layout(w.w, fam, size, tr);
    if (t >= w.start) {
      const p = Lyrics.wordProgress(w, t);
      c.fillStyle = p < 1 ? rgba('lamp', alpha) : rgba('bone', 0.9 * alpha);
      c.fillText(w.w, x, D.y - 22);
    }
    x += L.width + size * 0.4;
  }
  c.restore();
  return clamp(alpha);
}

/** The lamp's light on the floor around home, far below (Canvas2D; part of the downward look). */
export function downLookGlow(c: CanvasRenderingContext2D, alpha = 1) {
  if (alpha <= 0.001) return;
  const D = HANDOFF.downLook;
  const g = c.createRadialGradient(D.x, D.y, 0, D.x, D.y, 260);
  g.addColorStop(0, rgba('concrete', 0.5 * alpha)); g.addColorStop(1, rgba('concrete', 0));
  c.fillStyle = g; c.fillRect(D.x - 260, D.y - 260, 520, 520);
}
