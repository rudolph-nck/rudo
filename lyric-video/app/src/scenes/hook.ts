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
// the n=1 look for now), reprise (hook1b/hook2b: opens with the previous DRIFT still lifted and reels it
// back down onto the seam before the slam). The lines are found by content inside this entry's window.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { clearRT, Layer2D } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { Lyrics, type Line, type Word } from '../engine/lyrics';
import { LIN, rgba } from '../engine/palette';
import { F, font, layout, measure, type TextLayout } from '../engine/type';
import { clamp, ease, frameIdx, hash, lerp, pulse, smoothstep } from '../engine/util';
import { HAIR, SAFE, seam, SEAM_Y } from './_motifs';

const BASE = SEAM_Y - 34; // baseline of the bottom row: the words stand on the seam
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
  private drift!: { word: Word; fam: string; size: number; y: number; tr0: number; tr1: number; capH: number };
  private rise = 0;

  override init() {
    const { lyrics, params, start, end, H } = this.ctx;
    this.n = params.n ?? 1;
    this.reprise = !!params.reprise;
    const inWin = lyrics.lines.filter((l) => l.start >= start - 0.05 && l.start < end);
    this.dieLine = inWin.find((l) => fold(l.text).includes("wanna die")) ?? lyrics.get("I don't wanna die");
    this.driftLine = lyrics.lines.find((l) => l.i > this.dieLine.i && fold(l.text).includes('wanna drift'))!;
    const before = lyrics.lines.filter((l) => l.i < this.dieLine.i && fold(l.text).includes('wanna drift'));
    this.prevDrift = before[before.length - 1] ?? null;

    // DRIFT: the light word; size fitted to the safe width at its loosest tracking
    const dWord = this.driftLine.words[this.driftLine.words.length - 1]!;
    const dFam = F.archivo(125, 500);
    const tr1 = 0.16, tr0 = 0.02;
    const dText = dWord.w.toUpperCase();
    const dSize = Math.min(260, (100 * WIDTH) / measure(dText, dFam, 100, tr1 * 100));
    const dCap = dSize * 0.72;
    this.drift = { word: dWord, fam: dFam, size: dSize, y: BASE, tr0, tr1, capH: dCap };
    // n=1: the letters rise a third of the frame (kept below the top of the safe area)
    this.rise = Math.min(H / 3, BASE - dCap - SAFE.y0 - 20);

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

    // reprise: the previous DRIFT, lifted, reels back down onto the seam before the first word
    if (this.reprise && this.prevDrift && t < this.dieLine.words[0]!.start) {
      const k = ease.inOutCubic(clamp((t - this.ctx.start) / Math.max(0.2, this.dieLine.words[0]!.start - this.ctx.start - 0.05)));
      this.drawDrift(c, lb, this.prevDrift.words[this.prevDrift.words.length - 1]!, t, 1 - k, true);
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
      if (t >= dw.start) this.drawDrift(c, lb, dw, t, this.liftK(t, dw), false);
    }

    clearRT(renderer, out, LIN.ink);
    this.ctx.comp.draw(renderer, this.layer.upload(), out);
    seam(lb, SEAM_Y, { width: HAIR });
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

  /** 0..1 lift of DRIFT over the sung word (at least 0.6 s), eased out. */
  private liftK(t: number, w: Word) {
    return clamp((t - w.start) / Math.max(0.6, w.end - w.start));
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

  /**
   * DRIFT: lamp as it is sung (glyph by glyph), letters lifting by `k` (0 = on the baseline, 1 = risen) at
   * slightly different rates, tracking loosening with the lift, a taut tether from each letter to the seam.
   * `sung`: draw fully lit (the reprise's already-sung DRIFT).
   */
  private drawDrift(c: CanvasRenderingContext2D, lb: LineBatch, w: Word, t: number, k: number, sung: boolean) {
    const D = this.drift;
    const txt = w.w.toUpperCase();
    const tr = lerp(D.tr0, D.tr1, ease.outCubic(k)) * D.size;
    const L = layout(txt, D.fam, D.size, tr);
    const x0 = SAFE.x0 + (WIDTH - L.width) / 2;
    const p = sung ? 1 : Lyrics.wordProgress(w, t);
    const n = L.glyphs.length;
    const arrive = sung ? 1 : ease.outCubic(clamp((t - w.start) / 0.12));
    c.font = font(D.fam, D.size);
    for (const g of L.glyphs) {
      // each glyph's own rate: some lead, some lag; all eased out
      const rate = 0.75 + 0.5 * hash(g.i, 11 + this.n);
      const kg = ease.outCubic(clamp(k * rate)); // laggers stop short: the letters never re-align
      const y = D.y - this.rise * kg;
      const x = x0 + g.x;
      const lit = sung ? 1 : clamp(p * n - g.i);
      c.fillStyle = rgba('bone', 0.96 * arrive * (1 - lit));
      if (lit < 1) c.fillText(g.ch, x, y);
      if (lit > 0) { c.fillStyle = rgba('lamp', arrive * lit); c.fillText(g.ch, x, y); }
      // tether: from the glyph's foot straight down to the seam, once it has left the baseline
      const lift = D.y - y;
      if (lift > 1.5) {
        const cx = x + g.w / 2;
        lb.seg2(cx, y + 6, cx, SEAM_Y, HAIR, [LIN.bone[0] * 0.7, LIN.bone[1] * 0.7, LIN.bone[2] * 0.7], clamp(lift / 24) * arrive);
        lb.seg2(cx - 4, SEAM_Y, cx + 4, SEAM_Y, HAIR * 1.6, [LIN.bone[0] * 0.9, LIN.bone[1] * 0.9, LIN.bone[2] * 0.9], clamp(lift / 24) * arrive);
      }
    }
  }
}
