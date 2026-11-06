// Phase 2 placeholder, used for every timeline entry until its plate exists (timeline.ts falls back to
// it): the current lyric line in the lyric voice (Archivo), set on the seam, with per-word highlighting.
// Unsung words dust-dim (bone 35 %); the sung word fills glyph by glyph in lamp from its start and is
// complete by its end; sung words settle to bone. The amber point rides the seam under the sung word.
// Words appear (dim) up to 0.4 s early. The entry id sits small in the top band for QA.
import type * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { Lyrics, type Line } from '../engine/lyrics';
import { LIN, rgba } from '../engine/palette';
import { clearRT } from '../engine/gl';
import { F, font, layout, measure } from '../engine/type';
import { clamp, smoothstep } from '../engine/util';
import { amberPoint, amberTail, HAIR, roomLight2D, SAFE, seam, SEAM_Y } from './_motifs';

const FAMILY = F.archivo(100, 700);
const MAX_SIZE = 92;
const TRACK = 0.02; // em
const LEAD = 0.4; // anticipation: a line shows (dim) this long before its first word
const HOLD = 1.6; // a finished line stays (settled) at most this long, or until the next line shows
const ROW_GAP = 1.14; // baseline-to-baseline, in sizes
const BASE_Y = SEAM_Y - 40; // baseline of the last row: the line stands on the seam

interface PlacedWord { w: Line['words'][number]; x: number; y: number; width: number }
interface Placed { line: Line; size: number; words: PlacedWord[] }

export default class Karaoke extends Scene {
  private layer = new Layer2D();
  private lb = new LineBatch(4000, { screen2D: true, blend: 'add' });
  private placed = new Map<number, Placed>();

  override init() {
    for (const l of this.ctx.lyrics.lines) this.placed.set(l.i, this.place(l));
  }

  /** Greedy wrap to the title-safe width (840 px), rows centred, the last row standing on the seam. */
  private place(line: Line): Placed {
    const maxW = SAFE.x1 - SAFE.x0;
    let size = MAX_SIZE;
    // one word wider than the safe width (none in Drift at 92 px, but stay safe): shrink to fit
    for (const w of line.words) size = Math.min(size, (MAX_SIZE * maxW) / Math.max(1, measure(w.w, FAMILY, MAX_SIZE, TRACK * MAX_SIZE)));
    const tr = TRACK * size, space = measure(' ', FAMILY, size) + tr;
    const rows: { words: Line['words']; widths: number[]; width: number }[] = [];
    for (const w of line.words) {
      const ww = measure(w.w, FAMILY, size, tr);
      const r = rows[rows.length - 1];
      if (r && r.width + space + ww <= maxW) { r.words.push(w); r.widths.push(ww); r.width += space + ww; }
      else rows.push({ words: [w], widths: [ww], width: ww });
    }
    const words: PlacedWord[] = [];
    rows.forEach((r, ri) => {
      const y = BASE_Y - (rows.length - 1 - ri) * size * ROW_GAP;
      let x = (SAFE.x0 + SAFE.x1) / 2 - r.width / 2;
      r.words.forEach((w, i) => { words.push({ w, x, y, width: r.widths[i]! }); x += r.widths[i]! + space; });
    });
    // QA: every glyph box inside the title-safe area (render.ts prints browser warnings)
    const asc = layout('Ág', FAMILY, size).ascent;
    for (const pw of words) {
      if (pw.x < SAFE.x0 - 0.5 || pw.x + pw.width > SAFE.x1 + 0.5 || pw.y - asc < SAFE.y0 || pw.y > SAFE.y1)
        console.warn(`karaoke: "${pw.w.w}" (L${line.i}) outside the safe area: x ${pw.x.toFixed(0)}–${(pw.x + pw.width).toFixed(0)}, top ${(pw.y - asc).toFixed(0)}`);
    }
    return { line, size, words };
  }

  /** The line on screen at t: the latest one that has started (minus the lead), while it is held. */
  private lineOn(t: number): Line | null {
    const L = this.ctx.lyrics;
    const l = L.lastLine(t + LEAD);
    if (!l) return null;
    const next = L.lines[l.i + 1];
    const until = Math.min(l.end + HOLD, next ? next.start - LEAD : Infinity);
    return t < Math.max(until, l.end) ? l : null;
  }

  /** The amber point's position at time t: under the word being sung (or the last one sung), on the seam. */
  private headAt = (t: number) => {
    const l = this.ctx.lyrics.lastLine(t);
    if (!l) return null;
    const P = this.placed.get(l.i)!;
    let pw = P.words[0]!;
    for (const q of P.words) if (q.w.start <= t) pw = q;
    const p = Lyrics.wordProgress(pw.w, t);
    return { x: pw.x + pw.width * p, y: SEAM_Y };
  };

  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer } = this.ctx;
    const t = f.t;
    const c = this.layer.ctx;
    this.layer.clear();
    roomLight2D(c);

    // QA label: the timeline entry (placeholder only; real plates have no labels)
    c.font = font(F.mono(400), 22);
    c.fillStyle = rgba('dust', 0.55);
    c.textAlign = 'right';
    c.fillText(`${this.ctx.id} · karaoke`, SAFE.x1, 262);
    c.textAlign = 'left';

    const l = this.lineOn(t);
    if (l) {
      const P = this.placed.get(l.i)!;
      const fadeIn = smoothstep(l.start - LEAD, l.start - LEAD + 0.12, t);
      const next = this.ctx.lyrics.lines[l.i + 1];
      const until = Math.min(l.end + HOLD, next ? next.start - LEAD : Infinity);
      const fadeOut = 1 - smoothstep(Math.max(until, l.end) - 0.15, Math.max(until, l.end), t);
      c.globalAlpha = fadeIn * fadeOut;
      for (const pw of P.words) this.drawWord(c, pw, P.size, t);
      c.globalAlpha = 1;
    }

    clearRT(renderer, out, LIN.ink);
    this.ctx.comp.draw(renderer, this.layer.upload(), out);

    const lb = this.lb;
    lb.clear();
    seam(lb, SEAM_Y, { width: HAIR });
    const h = this.headAt(t);
    if (h) {
      amberTail(lb, t, this.headAt, { len: 0.5, intensity: 0.8 });
      amberPoint(lb, h.x, h.y, t, 0.8, 1);
    }
    lb.render(renderer, out);
  }

  /** One word: unsung = bone 35 %, singing = lamp filling glyph by glyph, sung = bone. */
  private drawWord(c: CanvasRenderingContext2D, pw: PlacedWord, size: number, t: number) {
    const p = Lyrics.wordProgress(pw.w, t);
    const L = layout(pw.w.w, FAMILY, size, TRACK * size);
    c.font = font(FAMILY, size);
    const n = L.glyphs.length;
    const singing = t >= pw.w.start && t < pw.w.end;
    for (const g of L.glyphs) {
      // glyph i lights over [i/n, (i+1)/n) of the word's progress: the first at the word's start,
      // the last complete by its end (CLAUDE.md: never early)
      const k = singing ? clamp(p * n - g.i) : p >= 1 ? 1 : 0;
      const x = pw.x + g.x;
      if (k < 1 || !singing) {
        c.fillStyle = p >= 1 ? rgba('bone', 0.95) : rgba('bone', 0.35);
        c.fillText(g.ch, x, pw.y);
      }
      if (singing && k > 0) {
        c.fillStyle = rgba('lamp', k);
        c.fillText(g.ch, x, pw.y);
      }
    }
  }
}
