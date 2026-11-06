// The voicemail player of plate 11 `voicemail` (docs/TREATMENT-drift.md), as a pure function of time, so that
// `scars` (plate 12) can open on exactly voicemail's last frame and hold it until its first downbeat
// (NOTES-port d12): call drawVoicemailHold() there.
//
// Everything here is laid out from the lyrics by content (no hard-coded seconds) and cached per Lyrics.
// Drawing contract (both for the scene and for a plate drawing the hold):
//   1. clear the target to VOICEMAIL_CLEAR (ink);
//   2. clear a Layer2D, call draw*/drawVoicemailHold with its ctx and a cleared 2D additive LineBatch;
//   3. composite the Layer2D over the target, then render the LineBatch onto it (additive).
//   Post: the plate's own defaults (no shake, no zoom, default bloom: only the scrubber's LED blooms).
import type { AudioData } from '../engine/audio';
import type { LineBatch } from '../engine/lines';
import { Lyrics, type Line, type Word } from '../engine/lyrics';
import { LIN, rgba } from '../engine/palette';
import { F, font, layout, measure, type TextLayout } from '../engine/type';
import { clamp, ease, frameIdx, hash, lerp, noise1, smoothstep, TAU } from '../engine/util';
import { amberPoint, HAIR, roomLight2D, seam, SEAM_Y } from './_motifs';

type RGB = [number, number, number];
const mul = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];

/** The background the plate clears to (linear ink). */
export const VOICEMAIL_CLEAR: RGB = LIN.ink;

// --------------------------------------------------------------------------------------- geometry
/** The waveform spans the title-safe width; its message is 0:42 long. */
export const WAVE = { x0: 120, x1: 960, y: SEAM_Y, amp: 40, step: 4, secs: 42 } as const;
/** Where Dad stops talking (fraction of the message): the rest is the silence before the click, flat seam
 *  (under ASKS, which stands on the seam at the right, as `apart` left it). */
const SPEECH_END = 0.8;
const HEADER_Y = SEAM_Y - 248; // `Dad · 0:42 · saved`
const LABEL_Y = SEAM_Y - 304; // `VOICEMAIL`
const TIME_Y = SEAM_Y + 86; // `0:17` … `0:42` under the trace
const ROW_LIFT = 74; // the lyric's baseline above the trace's smoothed crest
const ASKS_X = 940, ASKS_Y = SEAM_Y - 18; // as `apart` (frozen at 40)
const FIELD = { x: 140, y: 1380, w: 800, h: 80 }; // the reply field, the same as `apart`'s
const LYR = F.archivo(100, 400);
const LYR_TR = 0.02;
/** Rows: at most this wide, centred a little left of the frame's centre so they stay clear of ASKS. */
const ROW_W = 760, ROW_CX = 520;
const APART_FAM = F.archivo(125, 500);
const APART_CY = 760;

interface Row { words: Word[]; L: TextLayout; x0: number; start: number; end: number; inT: number; outT: number }

class Player {
  rows: Row[] = [];
  size = 60;
  bars: { x: number; h: number }[] = [];
  crest: Float32Array;
  apart: Line | null;
  apartSize = 90;
  l2: Line;
  growA: number; growB: number;
  playT: number; // "play": the echo starts
  echoEnd: number;
  lastEnd: number;
  /** The frame the plate ends on (everything settled): the hold. */
  holdT: number;

  constructor(private ly: Lyrics) {
    const l1 = ly.get('Got memories that haunt me');
    this.l2 = ly.get('Got questions with no replies');
    const l3 = ly.get('Got a father that I miss');
    const l4 = ly.get('old voicemails I still play');
    this.apart = ly.find('miles apart')[0] ?? null;
    const iv = l4.words.findIndex((w) => /voicemails/i.test(w.w));
    const groups = [l1.words, this.l2.words, l3.words, l4.words.slice(0, iv + 1), l4.words.slice(iv + 1)];
    const texts = groups.map((g) => g.map((w) => w.w).join(' '));
    // one size for every row: the widest row fits 800 px
    this.size = Math.min(76, ...texts.map((s) => (76 * ROW_W) / measure(s, LYR, 76, LYR_TR * 76)));
    const tr = LYR_TR * this.size;
    this.rows = groups.map((ws, i) => {
      const L = layout(texts[i]!, LYR, this.size, tr);
      return { words: ws, L, x0: ROW_CX - L.width / 2, start: ws[0]!.start, end: ws[ws.length - 1]!.end, inT: 0, outT: Infinity };
    });
    // a row shows (dim) 0.4 s early, but never over a row that is still being sung; it sinks into the trace
    // as soon as the next one shows
    for (let i = 0; i < this.rows.length; i++) {
      const r = this.rows[i]!, p = this.rows[i - 1];
      // the old row lifts off the trace 0.3 s before the new one starts (its last word may still be lit,
      // moving: never hidden); the new row fades in under it, complete before its first word
      r.inT = p ? r.start - 0.18 : r.start - 0.4;
      if (p) p.outT = r.start - 0.3;
    }
    const pw = l4.words.find((w) => /^play/i.test(w.w))!;
    this.playT = pw.start;
    this.lastEnd = l4.words[l4.words.length - 1]!.end;
    this.echoEnd = this.lastEnd;
    this.holdT = this.lastEnd + 0.6;
    this.growA = l1.start - 0.35; this.growB = l1.start + 0.35;
    if (this.apart) {
      const w = this.apart.words;
      const r = [w.slice(0, 2), w.slice(2)].map((g) => g.map((x) => x.w).join(' '));
      this.apartSize = Math.min(104, ...r.map((s) => (104 * 800) / measure(s, APART_FAM, 104, 0.2 * 104)));
    }

    // Dad's message: phrases with pauses, syllables inside them, then the silence before the click
    const n = Math.round((WAVE.x1 - WAVE.x0) / WAVE.step);
    const phrases: [number, number][] = [[0.015, 0.13], [0.16, 0.31], [0.345, 0.43], [0.465, 0.62], [0.655, 0.73], [0.755, SPEECH_END]];
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      let e = 0;
      for (const [a, b] of phrases) e = Math.max(e, smoothstep(a, a + 0.012, u) * (1 - smoothstep(b - 0.02, b, u)));
      const syl = 0.45 + 0.55 * Math.abs(Math.sin(u * 190 + 1.7 * noise1(u * 13, 3)));
      const v = e * syl * (0.55 + 0.45 * noise1(u * 60, 7)) * (0.75 + 0.25 * hash(i, 11));
      const floor = u < SPEECH_END + 0.01 ? 0.035 + 0.03 * hash(i, 5) : 0;
      this.bars.push({ x: WAVE.x0 + i * WAVE.step, h: Math.max(floor, clamp(v)) });
    }
    // the smoothed crest the lyric rides
    this.crest = new Float32Array(this.bars.length);
    const sig = 14;
    for (let i = 0; i < this.bars.length; i++) {
      let s = 0, wsum = 0;
      for (let k = -3 * sig; k <= 3 * sig; k++) {
        const j = Math.min(this.bars.length - 1, Math.max(0, i + k));
        const wgt = Math.exp(-(k * k) / (2 * sig * sig));
        s += wgt * this.bars[j]!.h; wsum += wgt;
      }
      this.crest[i] = s / wsum;
    }
  }

  private crestAt(x: number) {
    const f = clamp((x - WAVE.x0) / WAVE.step, 0, this.crest.length - 1);
    const i = Math.floor(f), k = f - i;
    return lerp(this.crest[i]!, this.crest[Math.min(this.crest.length - 1, i + 1)]!, k);
  }
  private grow(t: number) { return ease.inOutCubic(clamp((t - this.growA) / (this.growB - this.growA))); }

  /** The scrubber's x under row r's sung word (glyph-accurate; it never leads the word). */
  private sweepX(r: Row, t: number) {
    let gi = 0;
    const gl = r.L.glyphs;
    for (let k = 0; k < r.words.length; k++) {
      const w = r.words[k]!, n = Array.from(w.w).length;
      const a = r.x0 + gl[gi]!.x, b = r.x0 + gl[gi + n - 1]!.x + gl[gi + n - 1]!.w;
      if (t < w.start) {
        if (k === 0) return a;
        const pw = r.words[k - 1]!, pg = gi - 2; // the previous word's last glyph
        const pb = r.x0 + gl[pg]!.x + gl[pg]!.w;
        return lerp(pb, a, clamp((t - pw.end) / Math.max(1e-3, w.start - pw.end)));
      }
      if (t < w.end) return lerp(a, b, Lyrics.wordProgress(w, t));
      gi += n + 1;
    }
    const lg = gl[gl.length - 1]!;
    return r.x0 + lg.x + lg.w;
  }

  /** The scrubber: under the sung word; drawn back (a rewind) to the next row between rows; to the end after the last. */
  scrubX(t: number) {
    const R = this.rows;
    if (t < R[0]!.start) return this.sweepX(R[0]!, R[0]!.start);
    let i = 0;
    for (let k = 0; k < R.length; k++) if (t >= R[k]!.start) i = k;
    const r = R[i]!, p = R[i - 1];
    let x = this.sweepX(r, t);
    if (p) {
      // the rewind: from where the previous row left the scrubber, at least 0.22 s, starting at its end
      const dur = Math.max(0.22, r.start - p.end);
      const k = ease.inOutCubic(clamp((t - p.end) / dur));
      const from = this.sweepX(p, p.end);
      if (t < r.start) return lerp(from, this.sweepX(r, r.start), k);
      x = lerp(from, x, k);
    }
    if (i === R.length - 1 && t > r.end) x = lerp(x, WAVE.x1, ease.inOutCubic(clamp((t - r.end) / 0.4)));
    // between rows before the rewind starts
    if (i < R.length - 1 && t >= r.end) {
      const n = R[i + 1]!;
      const dur = Math.max(0.22, n.start - r.end);
      x = lerp(this.sweepX(r, r.end), this.sweepX(n, n.start), ease.inOutCubic(clamp((t - r.end) / dur)));
    }
    return x;
  }

  /** Draw the plate's state at time t (state, frozen at holdT) with the LED's breathing at flickT. */
  draw(c: CanvasRenderingContext2D, lb: LineBatch, t: number, flickT = t) {
    t = Math.min(t, this.holdT);
    const g = this.grow(t);
    roomLight2D(c, SEAM_Y, { intensity: lerp(0.9, 0.62, smoothstep(this.growA, this.rows[0]!.end, t)) });
    this.drawApart(c, t);
    this.drawHeader(c, t, g);
    this.drawRows(c, t);
    this.drawField(c, t);
    this.drawAsks(c);

    // the trace
    const sx = this.scrubX(t);
    seam(lb, SEAM_Y, { width: HAIR });
    const bone = mul(LIN.bone, 0.8), dust = mul(LIN.dust, 0.5);
    for (const b of this.bars) {
      const h = b.h * WAVE.amp * g;
      if (h < 0.6) continue;
      lb.seg2(b.x, SEAM_Y - h, b.x, SEAM_Y + h, HAIR, b.x <= sx ? bone : dust, 1);
    }
    // the echo: on "play" the trace replays from the start, dimmer, over the live one; then it fades
    if (t >= this.playT) {
      const ex = lerp(WAVE.x0, WAVE.x1, clamp((t - this.playT) / (this.echoEnd - this.playT)));
      const fade = 1 - smoothstep(this.echoEnd, this.echoEnd + 0.5, t);
      if (fade > 0.001) {
        const col = mul(LIN.dust, 0.55 * fade);
        const up: { x: number; y: number }[] = [], dn: { x: number; y: number }[] = [];
        for (const b of this.bars) {
          if (b.x > ex) break;
          const h = (b.h * 1.25 + 0.06) * WAVE.amp;
          up.push({ x: b.x + 2, y: SEAM_Y - h - 3 }); dn.push({ x: b.x + 2, y: SEAM_Y + h + 3 });
        }
        if (up.length > 1) { lb.polyline(up, HAIR, col, 1); lb.polyline(dn, HAIR, col, 1); }
        if (ex < WAVE.x1) lb.seg2(ex, SEAM_Y - 0.01, ex, SEAM_Y + 0.01, 5, mul(LIN.bone, 0.5 * fade), 1);
      }
    }
    // the scrubber: an LED-sized amber point (the only bloom in the plate)
    amberPoint(lb, sx, SEAM_Y, flickT, 0.42, g);
  }

  /** "…miles apart" carried over the cut (sung past it): finishes lighting, then goes. */
  private drawApart(c: CanvasRenderingContext2D, t: number) {
    const l = this.apart;
    if (!l) return;
    const a = 1 - smoothstep(l.end, l.end + 0.55, t);
    if (a <= 0) return;
    const size = this.apartSize, tr = 0.2 * size;
    c.font = font(APART_FAM, size);
    const rows = [l.words.slice(0, 2), l.words.slice(2)];
    rows.forEach((ws, k) => {
      const y = APART_CY + size * 0.36 + (k - 0.5) * size * 1.12;
      const L = layout(ws.map((w) => w.w).join(' '), APART_FAM, size, tr);
      this.run(c, ws, L, 540 - L.width / 2, () => y, t, a, 0.94);
    });
  }

  private drawHeader(c: CanvasRenderingContext2D, t: number, g: number) {
    if (g <= 0) return;
    c.save();
    c.textAlign = 'center';
    c.font = font(F.mono(400), 22);
    c.letterSpacing = `${0.2 * 22}px`;
    c.fillStyle = rgba('dust', 0.7 * g);
    c.fillText('VOICEMAIL', 540 + 0.1 * 22, LABEL_Y);
    c.letterSpacing = '0px';
    c.font = font(F.mono(400), 40);
    c.fillStyle = rgba('bone', 0.86 * g);
    c.fillText('Dad · 0:42 · saved', 540, HEADER_Y);
    // the times under the trace: where the scrubber is, and the length
    const u = clamp((this.scrubX(t) - WAVE.x0) / (WAVE.x1 - WAVE.x0));
    const s = Math.floor(u * WAVE.secs + 1e-6);
    c.font = font(F.mono(400), 24);
    c.fillStyle = rgba('dust', 0.75 * g);
    c.textAlign = 'left';
    c.fillText(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`, WAVE.x0, TIME_Y);
    c.textAlign = 'right';
    c.fillText(`${Math.floor(WAVE.secs / 60)}:${String(WAVE.secs % 60).padStart(2, '0')}`, WAVE.x1, TIME_Y);
    c.restore();
  }

  /** The rows ride the trace's crest; when the next row shows, the old one is lifted off the trace one row up
   *  the wall (the trace flattens out of it), dims to a transcript line, and goes. */
  private drawRows(c: CanvasRenderingContext2D, t: number) {
    c.font = font(LYR, this.size);
    for (const r of this.rows) {
      if (t < r.inT || t >= r.outT + 1.4) continue;
      const fin = r === this.rows[0] ? 1 : smoothstep(r.inT, r.start - 0.02, t);
      const lift = r.outT < Infinity ? ease.outCubic(clamp((t - r.outT) / 0.3)) : 0;
      const nx = this.rows[this.rows.indexOf(r) + 1];
      const gone = (r.outT < Infinity ? 1 - smoothstep(r.outT + 0.6, r.outT + 1.4, t) : 1) * (nx && nx.outT < Infinity ? 1 - smoothstep(nx.outT, nx.outT + 0.15, t) : 1);
      const base = (x: number) => SEAM_Y - ROW_LIFT - lerp(this.crestAt(x), 0.25, lift) * WAVE.amp - lift * this.size * 1.3;
      this.run(c, r.words, r.L, r.x0, base, t, fin * lerp(1, 0.4, lift * smoothstep(r.end, r.end + 0.3, t)) * gone, 0.92);
    }
  }

  /** Words of a run: dim ≤ 0.4 s early, lamp glyph by glyph while sung (never early), bone after. */
  private run(c: CanvasRenderingContext2D, ws: Word[], L: TextLayout, x0: number, base: (x: number) => number, t: number, alpha: number, after: number) {
    c.font = font(L.family, L.size);
    let gi = 0;
    for (const w of ws) {
      const n = Array.from(w.w).length;
      const p = Lyrics.wordProgress(w, t);
      const pre = smoothstep(w.start - 0.4, w.start - 0.25, t);
      const singing = t >= w.start && t < w.end;
      for (let k = 0; k < n; k++) {
        const g = L.glyphs[gi + k]!;
        const x = x0 + g.x, y = base(x + g.w / 2);
        const lit = singing ? clamp(p * n - k) : 0;
        const a0 = t < w.start ? 0.32 * pre : t >= w.end ? after : 0.32;
        if (lit < 1) { c.fillStyle = rgba('bone', a0 * (1 - lit) * alpha); c.fillText(g.ch, x, y); }
        if (lit > 0) { c.fillStyle = rgba('lamp', lit * alpha); c.fillText(g.ch, x, y); }
      }
      gi += n + 1;
    }
  }

  /** "Got questions with no replies": a question mark typed into the reply field on each word; the cursor
   *  blinks; nothing comes back; the field closes before the next line. */
  private drawField(c: CanvasRenderingContext2D, t: number) {
    const l = this.l2;
    const open = ease.outExpo(clamp((t - (l.start - 0.4)) / 0.3));
    const closeA = l.end + 0.5;
    const close = ease.inOutCubic(clamp((t - closeA) / 0.4));
    if (open <= 0 || close >= 1) return;
    const a = open * (1 - close);
    const fy = FIELD.y + 30 * (1 - open);
    const fw = lerp(FIELD.w, FIELD.h, close);
    c.save();
    c.strokeStyle = rgba('dust', 0.65 * a); c.lineWidth = HAIR;
    c.fillStyle = rgba('ink', 0.6 * a);
    c.beginPath(); c.roundRect(FIELD.x, fy, fw, FIELD.h, FIELD.h / 2); c.fill(); c.stroke();
    const sx = FIELD.x + fw - FIELD.h / 2, sy = fy + FIELD.h / 2;
    if (close < 0.5) { // the send arrow, never lit
      c.strokeStyle = rgba('dust', 0.55 * a * (1 - 2 * close));
      c.beginPath(); c.arc(sx, sy, 22, 0, TAU); c.stroke();
      c.beginPath(); c.moveTo(sx, sy + 11); c.lineTo(sx, sy - 11); c.moveTo(sx - 8, sy - 3); c.lineTo(sx, sy - 11); c.lineTo(sx + 8, sy - 3); c.stroke();
    }
    const n = l.words.filter((w) => w.start <= t).length;
    const x0 = FIELD.x + 34;
    const size = 40, fam = F.mono(400);
    const cw = measure('?', fam, size);
    if (close < 0.3) {
      if (n === 0) {
        c.font = font(fam, 26);
        c.fillStyle = rgba('dust', 0.6 * a);
        c.fillText('Reply to Dad…', x0, sy + 9);
      } else {
        c.font = font(fam, size);
        c.fillStyle = rgba('bone', 0.9 * a);
        c.fillText('?'.repeat(n), x0, sy + size * 0.36);
      }
      const typing = l.words.some((w) => t >= w.start && t < w.start + 0.12);
      if (typing || Math.floor(frameIdx(t) / 30) % 2 === 0) {
        c.fillStyle = rgba('lamp', 0.9 * a);
        c.fillRect(x0 + n * cw + 3, fy + 20, 2.5, FIELD.h - 40);
      }
    }
    c.restore();
  }

  /** ASKS 40, frozen where `apart` left it (standing on the seam at the right, over the trace's silence). */
  private drawAsks(c: CanvasRenderingContext2D) {
    c.save();
    c.textAlign = 'right';
    c.font = font(F.mono(500), 34);
    c.fillStyle = rgba('bone', 0.82);
    c.fillText('40', ASKS_X, ASKS_Y);
    const nw = measure('00', F.mono(500), 34);
    c.font = font(F.mono(400), 20);
    c.fillStyle = rgba('dust', 0.75);
    c.fillText('ASKS', ASKS_X - nw - 12, ASKS_Y);
    c.restore();
  }
}

const cache = new WeakMap<Lyrics, Player>();
/** The (cached) player for these lyrics. */
export function voicemailPlayer(lyrics: Lyrics): Player {
  let p = cache.get(lyrics);
  if (!p) { p = new Player(lyrics); cache.set(lyrics, p); }
  return p;
}

/** Song time of the frame `voicemail` ends on (all motion settled): what the hold shows. */
export function voicemailHoldTime(lyrics: Lyrics): number { return voicemailPlayer(lyrics).holdT; }

/**
 * Draw `voicemail`'s last frame, frozen, independent of the scene instance: the 2D part into `c` (a cleared
 * Layer2D context: room light, `VOICEMAIL` / `Dad · 0:42 · saved`, `0:42 / 0:42`, ASKS 40, "I still play
 * sometimes" riding the trace in bone) and the GL part into `lb` (a cleared 2D additive LineBatch: the seam,
 * the fully played waveform, the LED scrubber at the waveform's end x = 960, y = SEAM_Y). `t` only drives the
 * LED's slow breathing. Clear the target to VOICEMAIL_CLEAR, composite the layer, then render `lb`.
 */
export function drawVoicemailHold(c: CanvasRenderingContext2D, lb: LineBatch, ctx: { lyrics: Lyrics; audio?: AudioData; W?: number; H?: number }, t: number): void {
  const p = voicemailPlayer(ctx.lyrics);
  p.draw(c, lb, p.holdT, t);
}
