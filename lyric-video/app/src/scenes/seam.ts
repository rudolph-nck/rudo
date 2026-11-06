// Plate 1 `seam` — "Yeah… / You ever get so tired … / stop for a minute" (docs/TREATMENT-drift.md).
// Frame 0 is the loop frame (plate 17 `tomorrow` ends on it exactly): the wall/floor seam already lit at
// y = SEAM_Y, the lamp falloff on the wall and its faint floor reflection, and the clock top-left at
// 04:37:00 AM — nothing else. Then:
//  - the title card "RUDO · DRIFT" sits on the wall for one bar, from the first downbeat;
//  - "Yeah…" in the lyric voice, low contrast, exhales from weight 900 to 300 (over the word and the
//    breath after it, until the spoken lines begin);
//  - the spoken lines are typed small in mono, one at a time, character by character with the voice
//    (never ahead of it), each fading as the next arrives;
//  - on "stop" the clock's seconds stop; on "for a minute" the seam dims to almost nothing and holds.
import type * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { clearRT, Layer2D } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { Lyrics, type Line } from '../engine/lyrics';
import { LIN, rgba } from '../engine/palette';
import { F, font, layout, measure, plain } from '../engine/type';
import { clamp, ease, frameIdx, lerp, smoothstep } from '../engine/util';
import { clockAt, drawClock2D, HAIR, roomLight2D, SAFE, seam, SEAM_Y } from './_motifs';

const TITLE = 'RUDO · DRIFT';
const MONO_SIZE = 40;
const MONO_Y = SEAM_Y - 70; // the typed thought sits on the wall just above the seam
const YEAH_Y = SEAM_Y - 64;

export default class SeamScene extends Scene {
  private layer = new Layer2D();
  private lb = new LineBatch(64, { screen2D: true, blend: 'add' });
  private yeah!: Line;
  private spoken: Line[] = [];
  private stopAt = Infinity;
  private dimAt = Infinity;
  private titleOn = 0;
  private titleOff = 0;

  override init() {
    const L = this.ctx.lyrics, A = this.ctx.audio;
    this.yeah = L.get('Yeah');
    // the spoken lines: everything after "Yeah…" that starts inside this plate
    this.spoken = L.lines.filter((l) => l.i > this.yeah.i && l.start < this.ctx.end);
    const stop = L.get('everything to stop').words.find((w) => /stop/i.test(w.w))!;
    this.stopAt = stop.start;
    this.dimAt = L.get('For a minute').words[0]!.start;
    // the title holds for one bar from the first downbeat
    this.titleOn = A.downbeats[0] ?? 0;
    this.titleOff = A.downbeats[1] ?? this.titleOn + 4 * 0.6996;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer } = this.ctx;
    const t = f.t;
    const c = this.layer.ctx;
    this.layer.clear();
    roomLight2D(c);

    // the clock: ticks with song time from 04:37:00, stops on "stop"
    drawClock2D(c, clockAt(t, '04:37:00', 0, this.stopAt));

    this.title(c, t);
    this.drawYeah(c, t);
    this.typed(c, t);

    clearRT(renderer, out, LIN.ink);
    this.ctx.comp.draw(renderer, this.layer.upload(), out);

    // the seam: lit; on "for a minute" it dims to almost nothing over the phrase, then holds
    const dim = ease.inOutCubic(smoothstep(this.dimAt, this.dimAt + 0.7, t));
    this.lb.clear();
    seam(this.lb, SEAM_Y, { intensity: lerp(1, 0.07, dim), width: HAIR });
    this.lb.render(renderer, out);
  }

  /** "RUDO · DRIFT": the cover's wide, tracked title on the wall, for one bar; hard on and off. */
  private title(c: CanvasRenderingContext2D, t: number) {
    if (t < this.titleOn || t >= this.titleOff) return;
    const fam = F.archivo(125, 500), size = 64, tr = 0.08 * size;
    const w = measure(TITLE, fam, size, tr);
    c.save();
    c.font = font(fam, size);
    c.letterSpacing = `${tr}px`;
    c.fillStyle = rgba('bone', 0.92);
    c.fillText(TITLE, (this.ctx.W - w) / 2, SEAM_Y - 420);
    c.restore();
  }

  /** "Yeah…": one word, low contrast, exhaling 900 → 300 from its start until the spoken lines begin. */
  private drawYeah(c: CanvasRenderingContext2D, t: number) {
    const w = this.yeah.words[0]!;
    const next = this.spoken[0]?.start ?? w.end + 1.5;
    if (t < w.start || t >= next) return;
    const k = ease.outCubic(clamp((t - w.start) / Math.max(0.3, next - 0.15 - w.start)));
    const fam = F.archivo(100, lerp(900, 300, k));
    const size = 150;
    const a = 0.42 * (1 - smoothstep(next - 0.35, next, t)); // low contrast; gone as the first line types
    const Lt = layout(w.w, fam, size);
    c.save();
    c.font = font(fam, size);
    c.fillStyle = rgba('bone', a);
    c.fillText(w.w, (this.ctx.W - Lt.width) / 2, YEAH_Y);
    c.restore();
  }

  /** The spoken lines, typed in mono with the voice, one at a time; each fades as the next arrives. */
  private typed(c: CanvasRenderingContext2D, t: number) {
    const fam = F.mono(400);
    c.save();
    c.font = font(fam, MONO_SIZE);
    const cw = measure('M', fam, MONO_SIZE);
    this.spoken.forEach((l, i) => {
      if (t < l.start) return;
      const next = this.spoken[i + 1];
      const fade = next ? 1 - smoothstep(next.start, next.start + 0.3, t) : 1;
      if (fade <= 0) return;
      const text = plain(l.text);
      const n = Math.floor(Lyrics.lineCharProgress(l, t) + 1e-6); // chars sung so far (never ahead)
      const shown = text.slice(0, n);
      // wrap at the safe width (mono: fixed advance)
      const perRow = Math.floor((SAFE.x1 - SAFE.x0) / cw);
      const rows = wrap(shown, text, perRow);
      const y0 = MONO_Y - (rows.total - 1) * MONO_SIZE * 1.3;
      c.fillStyle = rgba('bone', 0.82 * fade);
      rows.shown.forEach((r, ri) => c.fillText(r, SAFE.x0, y0 + ri * MONO_SIZE * 1.3));
      // the cursor: a dust block after the last typed char while the line is live, blinking at 2 Hz
      if (!next || t < next.start) {
        const last = rows.shown[rows.shown.length - 1] ?? '';
        const typing = n < text.length;
        const on = typing || Math.floor(frameIdx(t) / 15) % 2 === 0;
        if (on) {
          c.fillStyle = rgba('dust', 0.6 * fade);
          c.fillRect(SAFE.x0 + last.length * cw + 4, y0 + (rows.shown.length - 1) * MONO_SIZE * 1.3 - MONO_SIZE * 0.72, cw * 0.55, MONO_SIZE * 0.86);
        }
      }
    });
    c.restore();
  }
}

/** Word-wrap the full text at `perRow` chars, then cut the rows to the `shown` prefix (rows don't reflow while typing). */
function wrap(shown: string, full: string, perRow: number) {
  const rows: string[] = [];
  let cur = '';
  for (const word of full.split(' ')) {
    if (cur && (cur + ' ' + word).length > perRow) { rows.push(cur + ' '); cur = word; }
    else cur = cur ? cur + ' ' + word : word;
  }
  rows.push(cur);
  const out: string[] = [];
  let left = shown.length;
  for (const r of rows) {
    if (left <= 0) break;
    out.push(r.slice(0, left).replace(/ $/, ''));
    left -= r.length;
  }
  return { shown: out.length ? out : [''], total: rows.length };
}
