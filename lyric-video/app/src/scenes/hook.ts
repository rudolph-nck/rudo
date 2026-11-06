// Plate 7 `hook` — "I don't wanna die / I just wanna drift" (docs/TREATMENT-drift.md). The typographic slam:
// one word per sung word, full safe width, stacked down the frame above the seam:
//   I DON'T / WANNA / DIE   →   I JUST / WANNA / DRIFT
//  - each word slams in on its start; DIE lands heavy (width 62.5, weight 900) with a shake/zoom hit;
//  - on "just" DIE is un-inked: the fill drains out of the letters bottom-to-top, leaving a hairline,
//    then nothing (the one place type is briefly an outline: it is the drained husk of DIE, not a style);
//  - on "drift" the upper rows clear and DRIFT arrives (width 125, weight 500) and takes the light (lamp,
//    glyph by glyph as it is sung); its letters lift off the baseline at slightly different rates, the
//    tracking loosens, and from each letter a taut hairline tether runs straight down to the seam.
// params: n (1 = chorus 1: bone on ink, clean, letters rise a third of the frame; 2/3: TODO — they render
// the n=1 look for now), reprise (hook1b/hook2b: opens on `stars`' downward look, reels the tether in and
// brings DRIFT back down onto the seam before the slam). The lines are found by content inside this entry's window.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { clearRT, Layer2D } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { Lyrics, type Line, type Word } from '../engine/lyrics';
import { LIN, rgba } from '../engine/palette';
import { F, font, layout, measure, type TextLayout } from '../engine/type';
import { clamp, ease, frameIdx, hash, lerp, pulse, smoothstep } from '../engine/util';
import { HAIR, HANDOFF, SAFE, seam, SEAM_Y } from './_motifs';
import { downLook, downLookGlow, forABit } from './stars-down';
import { DriftWord, HOOK_BASE } from './hook-drift';

const BASE = HOOK_BASE; // baseline of the bottom row: the words stand on the seam
const GAP = 26; // vertical gap between rows (px)
const WIDTH = SAFE.x1 - SAFE.x0;

interface Row { words: Word[]; text: string; fam: string; size: number; tr: number; y: number; L: TextLayout; x: number }
interface Glyph { ch: string; x: number; w: number; rate: number; delay: number }

const fold = (s: string) => s.toLowerCase().replace(/’/g, "'");

export default class Hook extends Scene {
  private layer = new Layer2D();
  private lb = new LineBatch(512, { screen2D: true, blend: 'add' });
  private n = 1;
  private reprise = false;
  private dieLine!: Line;
  private driftLine!: Line;
  private prevDrift: Line | null = null;
  private rowsA: Row[] = []; // I DON'T / WANNA / DIE
  private rowsB: Row[] = []; // I JUST / WANNA / DRIFT
  private drift!: DriftWord;
  private prevDriftWord: DriftWord | null = null;
  /** "for a bit" (the end of the line before the reprise), still beside the point as the reprise opens. */
  private prevBit: Word[] = [];

  override init() {
    const { lyrics, params, start, end, H } = this.ctx;
    this.n = params.n ?? 1;
    this.reprise = !!params.reprise;
    const inWin = lyrics.lines.filter((l) => l.start >= start - 0.05 && l.start < end);
    this.dieLine = inWin.find((l) => fold(l.text).includes("wanna die")) ?? lyrics.get("I don't wanna die");
    this.driftLine = lyrics.lines.find((l) => l.i > this.dieLine.i && fold(l.text).includes('wanna drift'))!;
    const before = lyrics.lines.filter((l) => l.i < this.dieLine.i && fold(l.text).includes('wanna drift'));
    this.prevDrift = before[before.length - 1] ?? null;

    // DRIFT: the light word (shared with `stars`, which opens on this plate's last frame)
    this.drift = new DriftWord(this.driftLine.words[this.driftLine.words.length - 1]!, this.n, H);
    if (this.prevDrift) this.prevDriftWord = new DriftWord(this.prevDrift.words[this.prevDrift.words.length - 1]!, this.n, H);

    const prevLine = lyrics.lines[this.dieLine.i - 1];
    if (this.reprise && prevLine && /for a bit/i.test(prevLine.text)) this.prevBit = prevLine.words.slice(-3);
    this.rowsA = this.stack(this.dieLine, true);
    this.rowsB = this.stack(this.driftLine, false);
  }

  /** Rows for a hook line: [all but the last two words] / [second-to-last] / [last], bottom row on the seam. */
  private stack(line: Line, heavyLast: boolean): Row[] {
    const ws = line.words;
    const groups = [ws.slice(0, -2), ws.slice(-2, -1), ws.slice(-1)].filter((g) => g.length);
    const rows: Row[] = groups.map((g, gi) => {
      const last = gi === groups.length - 1;
      const text = g.map((w) => w.w.toUpperCase()).join(' ');
      // the last row of the DIE line is DIE (62.5 / 900); of the DRIFT line, DRIFT (drawn separately)
      const fam = last && heavyLast ? F.archivo(62.5, 900) : last ? this.drift.fam : F.archivo(100, 800);
      const trEm = last && heavyLast ? 0 : 0.01;
      const cap = last && heavyLast ? 440 : last ? this.drift.size : 210;
      const size = last && !heavyLast ? this.drift.size : Math.min(cap, (100 * WIDTH) / measure(text, fam, 100, trEm * 100));
      const tr = trEm * size;
      const L = layout(text, fam, size, tr);
      return { words: g, text, fam, size, tr, y: 0, L, x: SAFE.x0 + (WIDTH - L.width) / 2 };
    });
    // stack upward from the seam
    let y = BASE;
    for (let i = rows.length - 1; i >= 0; i--) {
      rows[i]!.y = y;
      y -= rows[i]!.size * 0.72 + GAP; // cap height + gap
    }
    return rows;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer } = this.ctx;
    const t = f.t;
    const c = this.layer.ctx;
    this.layer.clear();
    const lb = this.lb;
    lb.clear();

    const B0 = this.driftLine.words[0]!.start; // the second phrase begins
    const dw = this.drift.word;
    const dieW = this.dieLine.words[this.dieLine.words.length - 1]!;
    const justW = this.driftLine.words.find((w) => /just/i.test(w.w)) ?? this.driftLine.words[1]!;

    // reprise: opens on `stars`' last frame (the downward look down the tether, "for a bit" beside the
    // point). The tether reels in: the far seam widens to the full frame while DRIFT's letters come back
    // down from above onto the seam, landing as the first word hits.
    const first = this.dieLine.words[0]!.start;
    const opening = this.reprise && t < first;
    if (opening) {
      const k = ease.inOutCubic(clamp((t - this.ctx.start) / Math.max(0.2, first - this.ctx.start - 0.04)));
      downLook(lb, t, { half: lerp(HANDOFF.downLook.seamHalf, this.ctx.W / 2 + 4, k), tetherTop: lerp(0, SEAM_Y, k), point: 1 - k });
      if (this.prevBit.length) forABit(c, this.prevBit, t, 1 - smoothstep(0, 0.4, k));
      downLookGlow(c, 1 - k);
      // (tethers fade in with the descent: `stars`' last frame has only the one tether)
      if (this.prevDriftWord) this.prevDriftWord.draw(c, lb, t, 1 - k, { sung: true, dy: -1000 * (1 - k), tetherAlpha: smoothstep(0.15, 0.6, k) });
    }

    // phrase A: I DON'T / WANNA (until phrase B starts) and DIE (until it is un-inked)
    this.rowsA.forEach((r, ri) => {
      const isDie = ri === this.rowsA.length - 1;
      if (!isDie && t >= B0) return;
      if (isDie) this.drawDie(c, r, t, justW);
      else this.drawRow(c, r, t);
    });
    // phrase B: I JUST / WANNA until DRIFT arrives, then DRIFT alone
    if (t >= B0) {
      this.rowsB.slice(0, -1).forEach((r) => { if (t < dw.start) this.drawRow(c, r, t); });
      if (t >= dw.start) this.drift.draw(c, lb, t, this.drift.liftK(t));
    }

    clearRT(renderer, out, LIN.ink);
    this.ctx.comp.draw(renderer, this.layer.upload(), out);
    if (!opening) seam(lb, SEAM_Y, { width: HAIR });
    lb.render(renderer, out);

    // DIE's hit: a short hard shake and a punch-in; the kick breathes the frame a little
    const hit = pulse(t, dieW.start, 0.07);
    const fi = frameIdx(t);
    return {
      shake: [(hash(fi, 1) - 0.5) * 14 * hit, (hash(fi, 2) - 0.5) * 14 * hit],
      zoom: 1 + 0.035 * pulse(t, dieW.start, 0.16) + 0.008 * f.a.kick,
      grain: 0.05,
    };
  }

  /** A row of plain words: each word slams in on its start (a quick settle from 106 %). */
  private drawRow(c: CanvasRenderingContext2D, r: Row, t: number) {
    c.font = font(r.fam, r.size);
    c.letterSpacing = `${r.tr}px`;
    let ci = 0;
    for (const w of r.words) {
      const txt = w.w.toUpperCase();
      const x0 = r.x + (r.L.glyphs[ci]?.x ?? 0);
      ci += Array.from(txt).length + 1;
      if (t < w.start) continue;
      const k = ease.outExpo(clamp((t - w.start) / 0.14));
      const s = lerp(1.06, 1, k);
      const wW = measure(txt, r.fam, r.size, r.tr);
      c.save();
      c.translate(x0 + wW / 2, r.y - r.size * 0.36);
      c.scale(s, s);
      c.fillStyle = rgba('bone', 0.96);
      c.fillText(txt, -wW / 2, r.size * 0.36);
      c.restore();
    }
    c.letterSpacing = '0px';
  }

  /** DIE: slams on its start (from 125 %); on "just" its fill drains bottom-to-top leaving a hairline, then nothing. */
  private drawDie(c: CanvasRenderingContext2D, r: Row, t: number, just: Word) {
    const w = r.words[0]!;
    if (t < w.start) return;
    const txt = r.text;
    const cap = r.size * 0.72;
    const k = ease.outExpo(clamp((t - w.start) / 0.16));
    const s = lerp(1.25, 1, k);
    // drain: 0 before "just", 1 by its end; the husk then fades over 0.35 s
    const drain = ease.inOutCubic(clamp((t - just.start) / Math.max(0.2, just.end - just.start)));
    const husk = 1 - smoothstep(just.end, just.end + 0.35, t);
    if (husk <= 0) return;
    c.save();
    c.translate(r.x + r.L.width / 2, r.y - cap / 2);
    c.scale(s, s);
    c.translate(-r.L.width / 2, cap / 2);
    c.font = font(r.fam, r.size);
    // the remaining fill: the top (1 - drain) of the cap height
    if (drain < 1) {
      c.save();
      c.beginPath();
      c.rect(-20, -cap - r.size * 0.1, r.L.width + 40, (cap + r.size * 0.1) * (1 - drain));
      c.clip();
      c.fillStyle = rgba('bone', 0.97);
      c.fillText(txt, 0, 0);
      c.restore();
    }
    if (drain > 0) {
      c.strokeStyle = rgba('bone', 0.75 * husk);
      c.lineWidth = HAIR;
      c.strokeText(txt, 0, 0);
    }
    c.restore();
  }
}
