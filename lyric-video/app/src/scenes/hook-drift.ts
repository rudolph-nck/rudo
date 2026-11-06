// DRIFT, the hook's light word, shared by `hook` and `stars` (stars opens on hook's last frame, so both
// must draw it identically): width 125 / weight 500, lamp glyph by glyph as it is sung, letters lifting
// off the baseline at slightly different rates, tracking loosening, a taut tether from each letter down
// to the seam.
import type { LineBatch } from '../engine/lines';
import { Lyrics, type Word } from '../engine/lyrics';
import { LIN, rgba } from '../engine/palette';
import { F, font, layout, measure } from '../engine/type';
import { clamp, ease, hash, lerp } from '../engine/util';
import { HAIR, SAFE, SEAM_Y } from './_motifs';

export const HOOK_BASE = SEAM_Y - 34; // baseline of the hook's bottom row
const WIDTH = SAFE.x1 - SAFE.x0;
const TR0 = 0.02, TR1 = 0.16;

export class DriftWord {
  fam: string;
  size: number;
  capH: number;
  /** How far the letters rise at full lift: n=1 a third of the frame, n=2 two-thirds, n=3 almost to the safe top (all kept below it). */
  rise: number;
  constructor(public word: Word, public n: number, H: number) {
    const txt = word.w.toUpperCase();
    this.fam = F.archivo(125, n === 3 ? 300 : 500); // n=3: the breakdown hook, hairline weight
    this.size = Math.min(260, (100 * WIDTH) / measure(txt, this.fam, 100, TR1 * 100)) * (n === 3 ? 0.5 : 1);
    this.capH = this.size * 0.72;
    const top = HOOK_BASE - this.capH - SAFE.y0 - 20;
    this.rise = n === 3 ? top : n === 2 ? Math.min((2 * H) / 3, top * 0.85) : Math.min(H / 3, top);
  }

  /** 0..1 lift over the sung word (at least 0.6 s). */
  liftK(t: number) {
    return clamp((t - this.word.start) / Math.max(0.6, this.word.end - this.word.start));
  }

  /**
   * Draw at lift k. `sung`: fully lit (an already-sung DRIFT); `seamY`: where the tethers end (the
   * seam's screen y; the crane in `stars` moves it); `alpha`: overall fade.
   */
  /** `ink`: unsung glyphs in ink (n=2, on bone); `tether`: the tethers' colour and width (draw them into a normal-blend LineBatch for ink). */
  draw(c: CanvasRenderingContext2D, lb: LineBatch, t: number, k: number, o: { sung?: boolean; seamY?: number; alpha?: number; tetherAlpha?: number; dy?: number; ink?: boolean; tether?: { rgb: [number, number, number]; width: number } } = {}) {
    const txt = this.word.w.toUpperCase();
    const tr = lerp(TR0, TR1, ease.outCubic(k)) * this.size;
    const L = layout(txt, this.fam, this.size, tr);
    const x0 = SAFE.x0 + (WIDTH - L.width) / 2;
    const p = o.sung ? 1 : Lyrics.wordProgress(this.word, t);
    const n = L.glyphs.length;
    const a = (o.alpha ?? 1) * (o.sung ? 1 : ease.outCubic(clamp((t - this.word.start) / 0.12)));
    if (a <= 0.001) return;
    const seamY = o.seamY ?? SEAM_Y;
    c.font = font(this.fam, this.size);
    for (const g of L.glyphs) {
      const rate = 0.75 + 0.5 * hash(g.i, 11 + this.n);
      const kg = ease.outCubic(clamp(k * rate)); // laggers stop short: the letters never re-align
      const y = HOOK_BASE - this.rise * kg + (o.dy ?? 0);
      const x = x0 + g.x;
      const lit = o.sung ? 1 : clamp(p * n - g.i);
      if (lit < 1) { c.fillStyle = rgba(o.ink ? 'ink' : 'bone', 0.96 * a * (1 - lit)); c.fillText(g.ch, x, y); }
      if (lit > 0) { c.fillStyle = rgba('lamp', a * lit); c.fillText(g.ch, x, y); }
      const lift = HOOK_BASE - y; // (dy < 0: still coming down from above the frame: tethered all the way)
      if (lift > 1.5) {
        const cx = x + g.w / 2, ta = clamp(lift / 24) * a * (o.tetherAlpha ?? 1);
        const k7 = 0.7, k9 = 0.9;
        const rgb = o.tether?.rgb ?? LIN.bone, tw = o.tether?.width ?? HAIR;
        lb.seg2(cx, y + 6, cx, seamY, tw, [rgb[0] * k7, rgb[1] * k7, rgb[2] * k7], ta);
        lb.seg2(cx - 4, seamY, cx + 4, seamY, tw * 1.6, [rgb[0] * k9, rgb[1] * k9, rgb[2] * k9], ta);
      }
    }
  }
}
