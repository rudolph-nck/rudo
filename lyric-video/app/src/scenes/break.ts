// Plate 6 `break` — "And I'm not looking for an ending / I'm just looking for a break" (docs/TREATMENT-drift.md).
// Everything in the room goes; only the seam, the slab and the phone's glow remain. The glow becomes the
// amber point: it starts where `dark` leaves the phone (HANDOFF.phoneGlow), rises onto the seam and travels
// along it under the lyric, which is set ON the seam as one run; the camera tracks the point.
//  - each word shows dim at most 0.4 s early, is lit lamp glyph by glyph as it is sung (never early: the
//    word's own timing, not the point, lights it), then settles to bone;
//  - on "ending" a hard bone full stop is set after the word; the point does not stop, it passes straight
//    through, and the dot is left behind, dimming;
//  - on "break" the seam opens ahead of the point: a gap with two bright ends; the point drops into it on
//    the last beat while the camera pushes into the gap (scaling about the gap, so the seam keeps its y for
//    the cut to `hook1`): the door to the chorus.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { clearRT, Layer2D } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { Lyrics, type Line, type Word } from '../engine/lyrics';
import { LIN, rgba } from '../engine/palette';
import { F, font, layout, measure } from '../engine/type';
import { clamp, ease, lerp, smoothstep, TAU } from '../engine/util';
import { amberPoint, amberTail, HAIR, HANDOFF, roomLight2D, SAFE, seam, SEAM_Y, SLAB, slab2D } from './_motifs';

const FAM = F.archivo(100, 700);
const SIZE = 104;
const TR = 0.01 * SIZE;
const BASE = SEAM_Y - 20; // the words stand on the seam
const CX = 540; // the camera keeps the point here

interface PW { w: Word; x0: number; x1: number; L: ReturnType<typeof layout> }

export default class Break extends Scene {
  private layer = new Layer2D();
  private lb = new LineBatch(1024, { screen2D: true, blend: 'add' });
  private words: PW[] = [];
  private ending!: PW;
  private brk!: PW;
  private dotX = 0;
  private gapX = 0;
  private gapHalf = 56;
  private tDrop = 0; // the point reaches the gap
  private cutT = 0; // this plate's end (the last beat): the point is through the gap

  override init() {
    const ly = this.ctx.lyrics;
    const l1 = ly.get("I'm not looking for an ending"), l2 = ly.get('looking for a break');
    const space = measure(' ', FAM, SIZE) + TR;
    let x = 0;
    const place = (l: Line) => l.words.forEach((w) => {
      const L = layout(w.w, FAM, SIZE, TR);
      this.words.push({ w, x0: x, x1: x + L.width, L });
      x += L.width + space;
    });
    place(l1);
    this.ending = this.words[this.words.length - 1]!;
    this.dotX = this.ending.x1 + SIZE * 0.16;
    x += SIZE * 0.9; // the full stop's room between the lines
    place(l2);
    this.brk = this.words[this.words.length - 1]!;
    this.gapX = this.brk.x1 + SIZE * 0.55;
    this.cutT = this.ctx.end;
    this.tDrop = this.cutT - 0.2;
  }

  /** The point's world x along the run at time t: under the sung word, across the gaps between words. */
  private pointWX(t: number): number {
    const ws = this.words;
    const first = ws[0]!;
    if (t <= first.w.start) return first.x0;
    // "break": from the word's left edge to the gap, arriving at tDrop (it leads the word's wipe a little)
    if (t >= this.brk.w.start) return lerp(this.brk.x0, this.gapX, ease.inOutCubic(clamp((t - this.brk.w.start) / (this.tDrop - this.brk.w.start))));
    for (let i = 0; i < ws.length; i++) {
      const a = ws[i]!, b = ws[i + 1];
      if (t < a.w.end) return lerp(a.x0, a.x1, Lyrics.wordProgress(a.w, t));
      if (b && t < b.w.start) return lerp(a.x1, b.x0, (t - a.w.end) / Math.max(1e-3, b.w.start - a.w.end));
    }
    return this.brk.x1;
  }

  /** Point position (world x, screen-ish y before the camera's push): rises from the phone glow onto the seam, drops into the gap. */
  private pointAt(t: number) {
    const s0 = this.ctx.start, first = this.words[0]!.w.start;
    const rise = ease.inOutCubic(clamp((t - s0) / Math.max(0.3, first - s0 - 0.15)));
    const drop = ease.inCubic(clamp((t - this.tDrop) / (this.cutT - this.tDrop)));
    return { wx: this.pointWX(t), y: lerp(HANDOFF.phoneGlow.y, SEAM_Y, rise) + 150 * drop, rise, drop };
  }

  /** Camera x: the point, smoothed over the last 0.3 s (deterministic: an average of past positions). */
  private camX(t: number) {
    let s = 0;
    for (let i = 0; i < 8; i++) s += this.pointWX(t - (0.3 * i) / 7);
    return s / 8;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer } = this.ctx;
    const t = f.t;
    const cam = this.camX(t);
    // the push into the gap over the last beat, about the gap (on the seam: the seam keeps its y)
    const P = 60 / this.ctx.audio.bpm;
    const z = lerp(1, 1.9, ease.inCubic(clamp((t - (this.cutT - P)) / P)));
    const gx = CX + (this.gapX - cam);
    const X = (wx: number) => gx + z * (CX + (wx - cam) - gx);
    const Y = (y: number) => SEAM_Y + z * (y - SEAM_Y);

    const c = this.layer.ctx;
    this.layer.clear();
    roomLight2D(c, SEAM_Y, { intensity: 0.3 });
    c.save();
    c.translate(gx, SEAM_Y); c.scale(z, z); c.translate(-gx, -SEAM_Y);
    // the slab, left behind on the seam where the verse put it
    const slabX = CX + (this.words[0]!.x0 - 620 - cam);
    slab2D(c, slabX, SEAM_Y - SLAB.h, SLAB.w, SLAB.h, { lit: 0.3, alpha: 0.9 });
    // the words
    c.font = font(FAM, SIZE);
    c.letterSpacing = `${TR}px`;
    for (const pw of this.words) this.drawWord(c, pw, t, CX + (pw.x0 - cam));
    // the full stop after "ending": hard bone, left behind, dimming
    const e = this.ending.w.end;
    if (t >= e) {
      const dim = lerp(1, 0.3, smoothstep(e + 0.3, e + 1.6, t));
      c.fillStyle = rgba('bone', 0.95 * dim * edgeFade(CX + (this.dotX - cam)));
      c.beginPath(); c.arc(CX + (this.dotX - cam), BASE - SIZE * 0.06, SIZE * 0.075, 0, TAU); c.fill();
    }
    c.restore();
    c.letterSpacing = '0px';

    clearRT(renderer, out, LIN.ink);
    this.ctx.comp.draw(renderer, this.layer.upload(), out);

    const lb = this.lb;
    lb.clear();
    // the seam, opening on "break": a gap ahead of the point with two bright ends
    const open = ease.outExpo(clamp((t - this.brk.w.start) / 0.3));
    if (open > 0) seam(lb, SEAM_Y, { gap: [X(this.gapX - this.gapHalf * open), X(this.gapX + this.gapHalf * open)], width: HAIR * z });
    else seam(lb, SEAM_Y, { width: HAIR });
    // the point (the phone's glow at first: larger and softer), with its tail along the run
    const p = this.pointAt(t);
    const headAt = (tb: number) => { const q = this.pointAt(tb); return { x: X(q.wx), y: Y(q.y) }; };
    const fade = 1 - smoothstep(0.55, 1, p.drop);
    if (fade > 0) {
      amberTail(lb, t, headAt, { len: 0.45, intensity: 0.8 * fade });
      amberPoint(lb, X(p.wx), Y(p.y), t, lerp(1.6, 0.9, p.rise) * z ** 0.5, fade);
    }
    lb.render(renderer, out);
    return { zoom: 1 + 0.006 * f.a.kick };
  }

  /** dim 0.4 s before its start → lamp glyph by glyph while sung → bone, easing back to half after a while. */
  private drawWord(c: CanvasRenderingContext2D, pw: PW, t: number, sx: number) {
    const w = pw.w;
    if (t < w.start - 0.4 || edgeFade(sx) + edgeFade(sx + pw.L.width) <= 0) return;
    const pre = smoothstep(w.start - 0.4, w.start - 0.25, t);
    const p = Lyrics.wordProgress(w, t);
    const n = pw.L.glyphs.length;
    const after = lerp(0.95, 0.55, smoothstep(w.end + 0.8, w.end + 2, t));
    for (const g of pw.L.glyphs) {
      const ef = edgeFade(sx + g.x + g.w / 2); // per glyph: a long word crossing the edge fades letter by letter
      if (ef <= 0) continue;
      const lit = t >= w.start && t < w.end ? clamp(p * n - g.i) : 0;
      const base = t < w.start ? 0.32 * pre : t >= w.end ? after : 0.32;
      if (lit < 1) { c.fillStyle = rgba('bone', base * ef * (1 - lit)); c.fillText(g.ch, sx + g.x, BASE); }
      if (lit > 0) { c.fillStyle = rgba('lamp', lit * ef); c.fillText(g.ch, sx + g.x, BASE); }
    }
  }
}

/** Words fade out past the title-safe edges (the run is tracked, so it crosses them). */
function edgeFade(x: number) {
  return clamp((x - (SAFE.x0 - 80)) / 120) * clamp((SAFE.x1 + 80 - x) / 120);
}
