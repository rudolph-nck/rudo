// Plate 17 `tomorrow` — the outro and the loop (docs/TREATMENT-drift.md).
// "Tomorrow I'll keep fighting / … building / … carrying the weight / But tonight… / Let me drift".
// The room from the floor, the seam in its place. The dawn accent (this plate owns it) bleeds along the
// seam from the right: a warm wash on the wall and the floor, and the hairline itself warming.
//  - the three TOMORROWs stack on the wall in the lyric voice, each a little bolder (500 → 700 → 900),
//    lit lamp glyph by glyph as sung; the rest of each line sits under it, smaller;
//  - the slab hangs high on a slack tether (where `under` leaves it); it steps down on each TOMORROW and,
//    over "carrying the weight", lowers to the floor and lands softly on the seam, where it waits;
//  - the clock returns top-left (05:58 AM) on the downbeat inside "carrying"; on "But tonight…" its
//    seconds stop and everything on the wall dims; "But tonight…" lies on the floor in front of the slab;
//  - "Let me drift": the amber point lifts off the seam and rises slowly on its tether out of the top of
//    the frame; the camera holds; it swells with the breathy hum after "drift" (the vocal envelope);
//  - over the hum and the instrumental tail the dawn drains out, the slab and the tether go dark, and the
//    room settles back to plate 1's light; the closing "mm-hmm" is answered by the seam alone;
//  - on the LAST downbeat the clock's digits roll back, deliberately, to 04:37:00 AM, and from there to the
//    end every frame is exactly `seam`'s frame 0 (same calls, same order, default post): the video loops.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { clearRT, Layer2D } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { Lyrics, type Line, type Word } from '../engine/lyrics';
import { LIN, rgba } from '../engine/palette';
import { F, font, layout, measure, type TextLayout } from '../engine/type';
import { clamp, ease, frameIdx, lerp, smoothstep } from '../engine/util';
import {
  amberPoint, amberTail, clockSec, clockText, CLOCK_POS, drawClock2D, HAIR, roomLight2D, SAFE, seam, SEAM_Y, SLAB, slab2D, tether, tether2D,
} from './_motifs';

type RGB = [number, number, number];
const mix = (a: RGB, b: RGB, k: number, s = 1): RGB => [lerp(a[0], b[0], k) * s, lerp(a[1], b[1], k) * s, lerp(a[2], b[2], k) * s];

const LOOP_CLOCK = '04:37:00'; // what `seam` shows at t = 0
const RETURN_CLOCK = '05:58:00';
const PT_X = 860; // the amber point's place on the seam (right of the slab)
const SLAB_X = 400; // the slab's left edge (it hangs and lands here)
const SLAB_TOP0 = -110; // where it hangs as the plate opens (high, as `under` leaves it)
const SLAB_REST = SEAM_Y - SLAB.h;
const STACK_Y = [470, 670, 870]; // TOMORROW baselines
const TAIL_DY = 66; // the rest of the line, under its TOMORROW
const TAIL_SIZE = 50;
const TONIGHT_Y = 1350; // "But tonight…" on the floor in front of the slab
const DRIFT_Y = 640; // "Let me drift" on the cleared wall

interface WL { w: Word; x: number; L: TextLayout; fam: string; size: number; tr: number }

export default class Tomorrow extends Scene {
  private layer = new Layer2D();
  private lbSeam = new LineBatch(8, { screen2D: true, blend: 'add' });
  private lbDawn = new LineBatch(128, { screen2D: true, blend: 'normal' });
  private lb = new LineBatch(256, { screen2D: true, blend: 'add' });

  private tmr: Line[] = [];
  private tonight!: Line;
  private drift!: Line;
  private big: WL[] = []; // the three TOMORROWs
  private tails: WL[][] = []; // "I'll keep fighting", …
  private tonightW: WL[] = [];
  private driftW: WL[] = [];
  private dLast = 0; // the last downbeat: the reset
  private dPrev = 0; // the downbeat before it: everything has settled
  private dHum = 0; // the downbeat after "drift": the dawn starts draining
  private clockOn = 0;
  private stopAt = 0;
  private liftEnd = 0;

  override init() {
    const { lyrics, audio, start, end } = this.ctx;
    const inWin = lyrics.lines.filter((l) => l.start >= start - 0.05 && l.start < end);
    this.tmr = inWin.filter((l) => /^tomorrow/i.test(l.text)).slice(0, 3);
    this.tonight = inWin.find((l) => /^but tonight/i.test(l.text)) ?? lyrics.get('But tonight', 1);
    this.drift = inWin.find((l) => /let me drift/i.test(l.text)) ?? lyrics.get('Let me drift');

    const dbs = audio.downbeats.filter((d) => d > start && d < end - 0.2);
    this.dLast = dbs[dbs.length - 1] ?? end - 2;
    this.dPrev = dbs[dbs.length - 2] ?? this.dLast - 2.8;
    const dw = this.drift.words[this.drift.words.length - 1]!;
    this.dHum = dbs.find((d) => d > dw.end + 0.5) ?? dw.end + 2.4;
    const carrying = this.tmr[2]!.words.find((w) => /carrying/i.test(w.w)) ?? this.tmr[2]!.words[3]!;
    this.clockOn = dbs.find((d) => d >= carrying.start) ?? carrying.start;
    this.stopAt = this.tonight.words[0]!.start;
    this.liftEnd = this.drift.words[0]!.start + 8;

    // the stack: TOMORROW ×3, each bolder, one size (the boldest fits the safe width)
    const fams = [F.archivo(100, 500), F.archivo(100, 700), F.archivo(100, 900)];
    const trEm = 0.02;
    const size = Math.min(132, (100 * (SAFE.x1 - SAFE.x0)) / measure('TOMORROW', fams[2]!, 100, trEm * 100));
    const tailFam = F.archivo(100, 400);
    this.tmr.forEach((l, i) => {
      const fam = fams[i]!;
      const w0 = l.words[0]!;
      this.big.push({ w: w0, x: SAFE.x0, L: layout(w0.w.toUpperCase(), fam, size, trEm * size), fam, size, tr: trEm * size });
      this.tails.push(this.run(l.words.slice(1), tailFam, TAIL_SIZE, 0.01 * TAIL_SIZE, SAFE.x0 + 4));
    });
    const tf = F.archivo(112.5, 400), ts = 76;
    this.tonightW = this.run(this.tonight.words, tf, ts, 0.03 * ts, null);
    const df = F.archivo(125, 500);
    const dsz = Math.min(104, (100 * (SAFE.x1 - SAFE.x0)) / measure(this.drift.text, df, 100, 4));
    this.driftW = this.run(this.drift.words, df, dsz, 0.04 * dsz, null);
  }

  /** Lay a run of words on one line (x0 = left edge, or centred when null). */
  private run(ws: Word[], fam: string, size: number, tr: number, x0: number | null): WL[] {
    const space = measure(' ', fam, size) + tr;
    const Ls = ws.map((w) => layout(w.w, fam, size, tr));
    const total = Ls.reduce((s, L) => s + L.width, 0) + space * (ws.length - 1);
    let x = x0 ?? (this.ctx.W - total) / 2;
    return ws.map((w, i) => { const r = { w, x, L: Ls[i]!, fam, size, tr }; x += Ls[i]!.width + space; return r; });
  }

  // ---------------------------------------------------------------- the state as functions of t
  /** Dawn amount (0..1) and its reach from the right edge (fraction of the width). */
  private dawn(t: number) {
    const up = ease.inOutCubic(smoothstep(this.ctx.start, this.stopAt + 1.5, t));
    const down = ease.inOutCubic(smoothstep(this.dHum, this.dPrev, t));
    const D = up * (1 - down);
    return { D, reach: lerp(0.18, 0.95, up) * lerp(1, 0.4, down) };
  }

  /** The room's lamp falloff: dark out of `under`, dims on "But tonight…", settles back to plate 1's (1). */
  private room(t: number) {
    if (t >= this.dPrev) return 1;
    const a = lerp(0.4, 0.6, smoothstep(this.ctx.start, this.ctx.start + 2.5, t));
    const dim = lerp(a, 0.3, ease.inOutCubic(smoothstep(this.stopAt, this.stopAt + 0.8, t)));
    return lerp(dim, 1, ease.inOutCubic(smoothstep(this.dHum, this.dPrev, t)));
  }

  /** Slab top y and its tether slack: steps down on each TOMORROW, lowers over "carrying the weight". */
  private slab(t: number) {
    let y = SLAB_TOP0, slack = 0.45;
    this.tmr.forEach((l, i) => {
      const k = ease.outCubic(clamp((t - l.start) / 0.6));
      y += 40 * k; slack -= 0.1 * k;
      void i;
    });
    const l3 = this.tmr[2]!;
    const carrying = l3.words.find((w) => /carrying/i.test(w.w)) ?? l3.words[3]!;
    const weight = l3.words[l3.words.length - 1]!;
    const k = ease.inOutCubic(clamp((t - carrying.start) / (weight.end - carrying.start)));
    y = lerp(y, SLAB_REST, k);
    // the dark takes it back: as the room returns to the night light, the slab (lit by dawn) goes
    const alpha = 1 - ease.inOutCubic(smoothstep(this.dPrev - 2 * (this.dPrev - this.dHum) / 5, this.dPrev, t));
    return { y, slack: Math.max(0.15, slack), landed: k >= 1, alpha };
  }

  /** The amber point: on the seam, then lifting off on "Let", rising slowly out of the top. */
  private point(t: number) {
    const t0 = this.drift.words[0]!.start;
    const k = ease.inOutCubic(clamp((t - t0) / (this.liftEnd - t0)));
    return { x: PT_X, y: lerp(SEAM_Y, -90, k), k };
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides | void {
    const { renderer } = this.ctx;
    const t = f.t;
    const c = this.layer.ctx;
    this.layer.clear();

    // ---- the loop frame: exactly `seam` at t = 0 (same calls, same order, default post)
    const rollEnd = this.dLast + 0.62;
    if (t >= rollEnd) {
      roomLight2D(c);
      drawClock2D(c, clockSec(LOOP_CLOCK));
      clearRT(renderer, out, LIN.ink);
      this.ctx.comp.draw(renderer, this.layer.upload(), out);
      this.lbSeam.clear();
      seam(this.lbSeam, SEAM_Y, { width: HAIR });
      this.lbSeam.render(renderer, out);
      return;
    }

    const room = this.room(t);
    roomLight2D(c, SEAM_Y, { intensity: room });
    const { D, reach } = this.dawn(t);
    if (D > 0.001) this.dawnWash(c, D, reach);

    // the slab and its tether (in the layer, under the type)
    const s = this.slab(t);
    if (s.alpha > 0.001) {
      if (!s.landed) tether2D(c, SLAB_X + SLAB.w / 2, s.y + SLAB.h, SLAB_X + SLAB.w / 2, SEAM_Y, { slack: s.slack, t, seed: 5, alpha: 0.8 });
      const lit = lerp(0.25, 0.55, room);
      slab2D(c, SLAB_X, s.y, SLAB.w, SLAB.h, { lit, alpha: s.alpha, seed: 3 });
      if (D > 0.001) { // the dawn catches the slab's right side
        const g = c.createLinearGradient(SLAB_X, 0, SLAB_X + SLAB.w, 0);
        g.addColorStop(0, rgba('dawn', 0));
        g.addColorStop(1, rgba('dawn', 0.16 * D * s.alpha));
        c.fillStyle = g;
        c.fillRect(SLAB_X, s.y, SLAB.w, SLAB.h);
      }
    }

    this.drawStack(c, t);
    this.drawTonight(c, t);
    this.drawDrift(c, t);
    this.drawClock(c, t);

    clearRT(renderer, out, LIN.ink);
    this.ctx.comp.draw(renderer, this.layer.upload(), out);

    // the seam (the mm-hmm: the seam alone answers, a touch brighter, settling to exactly 1)
    const answer = smoothstep(this.dPrev - 0.6, this.dPrev, t) * (1 - smoothstep(this.dLast - 1.2, this.dLast - 0.4, t));
    const I = 1 + 0.22 * f.a.vocal * answer;
    this.lbSeam.clear();
    seam(this.lbSeam, SEAM_Y, { width: HAIR, intensity: I });
    this.lbSeam.render(renderer, out);
    // the hairline warming from the right (normal blend over the seam: no bright joints)
    if (D > 0.001) {
      const lbd = this.lbDawn;
      lbd.clear();
      const W = this.ctx.W, n = 60, x0 = W * (1 - reach);
      for (let i = 0; i < n; i++) {
        const xa = x0 + ((W - x0) * i) / n, xb = x0 + ((W - x0) * (i + 1)) / n;
        const u = Math.pow(smoothstep(x0, W, (xa + xb) / 2), 1.2);
        lbd.seg2(xa, SEAM_Y, xb, SEAM_Y, HAIR * lerp(1, 1.6, u * D), mix(LIN.bone, LIN.dawn, u, 0.88), 0.95 * D * u);
      }
      lbd.render(renderer, out);
    }

    // the amber point and its tether
    const lb = this.lb;
    lb.clear();
    const p = this.point(t);
    const tetherA = 1 - smoothstep(this.liftEnd + 1, this.dPrev - (this.dPrev - this.dHum) / 2.5, t);
    if (p.k > 0 && tetherA > 0.001) tether(lb, p.x, p.y, PT_X, SEAM_Y, { slack: 0.45 * smoothstep(0, 0.15, p.k), t, seed: 11, intensity: tetherA });
    if (p.y > -60) {
      const hum = t > this.drift.words[2]!.end ? f.a.vocal : 0;
      const headAt = (tb: number) => { const q = this.point(tb); return { x: q.x, y: q.y }; };
      if (p.k > 0) amberTail(lb, t, headAt, { len: 0.5, intensity: 0.6, embers: 8 });
      amberPoint(lb, p.x, p.y, t, 0.85 + 0.25 * hum, 0.75 + 0.25 * smoothstep(0, 0.05, p.k) + 0.35 * hum);
    }
    lb.render(renderer, out);

    // the kick breathes the frame a little until the tail; then nothing (the loop frame has default post)
    const kz = 1 - smoothstep(this.dHum, this.dPrev - 1, t);
    if (t >= this.dPrev) return;
    return { zoom: 1 + 0.004 * f.a.kick * kz };
  }

  /** The dawn along the seam from the right: a thin warm glow on the line, a wash up the wall, a fainter one on the floor. */
  private dawnWash(c: CanvasRenderingContext2D, D: number, reach: number) {
    const W = this.ctx.W;
    const R = W * 1.25 * reach;
    const blob = (sy: number, a0: number, a1: number, clipTop: number, clipH: number) => {
      c.save();
      c.beginPath(); c.rect(0, clipTop, W, clipH); c.clip();
      c.translate(W + 60, SEAM_Y);
      c.scale(1, sy);
      const g = c.createRadialGradient(0, 0, 0, 0, 0, R);
      g.addColorStop(0, rgba('dawn', a0 * D));
      g.addColorStop(0.45, rgba('dawn', a1 * D));
      g.addColorStop(1, rgba('dawn', 0));
      c.fillStyle = g;
      c.fillRect(-R, -R, 2 * R, 2 * R);
      c.restore();
    };
    blob(0.3, 0.26, 0.08, 0, SEAM_Y); // the wall
    blob(0.16, 0.14, 0.04, SEAM_Y, 400); // the floor's reflection
    blob(0.012, 0.55, 0.18, SEAM_Y - 30, 60); // the glow on the line itself
  }

  /** A word, dim up to 0.4 s early, lit lamp glyph by glyph while sung, then bone at `after`. */
  private word(c: CanvasRenderingContext2D, r: WL, y: number, t: number, alpha: number, after = 0.92, text?: string) {
    const w = r.w;
    if (t < w.start - 0.4 || alpha <= 0.001) return;
    c.font = font(r.fam, r.size);
    const pre = smoothstep(w.start - 0.4, w.start - 0.2, t);
    const p = Lyrics.wordProgress(w, t);
    const n = r.L.glyphs.length;
    void text;
    for (const g of r.L.glyphs) {
      const lit = t >= w.start && t < w.end ? clamp(p * n - g.i) : 0;
      const base = t < w.start ? 0.3 * pre : t >= w.end ? after : 0.3;
      if (lit < 1) { c.fillStyle = rgba('bone', base * alpha * (1 - lit)); c.fillText(g.ch, r.x + g.x, y); }
      if (lit > 0) { c.fillStyle = rgba('lamp', lit * alpha); c.fillText(g.ch, r.x + g.x, y); }
    }
  }

  private drawStack(c: CanvasRenderingContext2D, t: number) {
    const dim = lerp(1, 0.16, ease.inOutCubic(smoothstep(this.stopAt, this.stopAt + 0.8, t)));
    const gone = 1 - smoothstep(this.drift.start - 1.6, this.drift.start - 0.3, t);
    const A = dim * gone;
    if (A <= 0.001) return;
    this.tmr.forEach((l, i) => {
      const b = this.big[i]!;
      // each TOMORROW lands on its start: a short settle up from 14 px below
      const k = ease.outExpo(clamp((t - b.w.start) / 0.3));
      const y = STACK_Y[i]! + (t >= b.w.start ? 14 * (1 - k) : 14);
      const older = lerp(0.92, 0.62, smoothstep(this.tmr[i + 1]?.start ?? Infinity, (this.tmr[i + 1]?.start ?? Infinity) + 1.2, t));
      this.word(c, b, y, t, A, older);
      for (const r of this.tails[i]!) this.word(c, r, STACK_Y[i]! + TAIL_DY, t, A, older * 0.9);
      void l;
    });
  }

  private drawTonight(c: CanvasRenderingContext2D, t: number) {
    const A = 1 - smoothstep(this.drift.start, this.drift.start + 1.4, t);
    for (const r of this.tonightW) this.word(c, r, TONIGHT_Y, t, A, 0.8);
  }

  private drawDrift(c: CanvasRenderingContext2D, t: number) {
    const dw = this.drift.words[this.drift.words.length - 1]!;
    // "drift" keeps the light; the line fades over the hum after it
    const A = 1 - ease.inOutCubic(smoothstep(dw.end + 0.8, this.dHum + 0.6, t));
    this.driftW.forEach((r, i) => {
      if (i === this.driftW.length - 1 && t >= r.w.end) {
        c.font = font(r.fam, r.size);
        c.fillStyle = rgba('lamp', 0.95 * A);
        for (const g of r.L.glyphs) c.fillText(g.ch, r.x + g.x, DRIFT_Y);
      } else this.word(c, r, DRIFT_Y, t, A, 0.75);
    });
  }

  /** The clock: back on the downbeat inside "carrying" (05:58), stops on "But tonight…", rolls back to 04:37 on the last downbeat. */
  private drawClock(c: CanvasRenderingContext2D, t: number) {
    if (t < this.clockOn) return;
    // switched back on: a few frames of flicker
    const fi = frameIdx(t) - frameIdx(this.clockOn);
    if (fi < 9 && (fi === 1 || fi === 2 || fi === 5)) return;
    const from = clockSec(RETURN_CLOCK) + Math.max(0, Math.min(t, this.stopAt) - this.clockOn);
    if (t < this.dLast) { drawClock2D(c, from); return; }
    // the reset: each changed digit counts back to its 04:37:00 value, seconds first, then minutes, then hours
    const a = clockText(from), b = clockText(clockSec(LOOP_CLOCK));
    const fam = F.mono(400), size = CLOCK_POS.size;
    const cw = measure('0', fam, size), LH = size * 1.25;
    c.save();
    c.font = font(fam, size);
    c.fillStyle = rgba('dust', 0.9);
    c.textBaseline = 'alphabetic';
    for (let i = 0; i < a.length; i++) {
      const x = CLOCK_POS.x + i * cw, y = CLOCK_POS.y;
      const d0 = a.charCodeAt(i) - 48, d1 = b.charCodeAt(i) - 48;
      if (a[i] === b[i] || d0 < 0 || d0 > 9) { c.fillText(a[i]!, x, y); continue; }
      const steps = (d0 - d1 + 10) % 10;
      const delay = i >= 6 ? 0 : i >= 3 ? 0.12 : 0.24;
      const pos = steps * ease.inOutCubic(clamp((t - this.dLast - delay) / 0.36));
      c.save();
      c.beginPath(); c.rect(x - 1, y - size * 0.92, cw + 2, size * 1.06); c.clip();
      for (let k = Math.floor(pos); k <= Math.min(steps, Math.floor(pos) + 1); k++) {
        const d = (d0 - k + 10) % 10;
        c.fillText(String(d), x, y + (pos - k) * LH);
      }
      c.restore();
    }
    c.restore();
  }
}
