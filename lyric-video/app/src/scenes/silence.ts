// Plate 15 `silence` — the breakdown: "No phone ringing … Just breathing" (docs/TREATMENT-drift.md).
// Seven lines, seven hard cuts inside one timeline entry; every cut is a notch darker and every line
// switches one object off. Nothing is added, only removed.
//  - The cuts land on the beat each line starts on (NOTES-port d5): timeOfBeat(floor(beatAt(start))),
//    the last two on a downbeat when one is within a beat of the line (only "Just breathing" qualifies
//    with this alignment). Each shot is the same room from a slightly different framing (a zoom about a
//    point ON the seam, so the seam keeps y = SEAM_Y in every shot) with the lamp a step lower.
//  - The lyric lives on the wall in world space, alternating between two rows, so a line still being
//    sung across a cut stays where it was (seen from the new framing); each word shows dim at most 0.4 s
//    early, fills lamp glyph by glyph while sung, settles bone, and the line switches off at its end.
//  1 "No phone ringing": the phone face-up on the floor, ringing amber; on "No" the glow dies.  41 → 34
//  2 "No notifications": the text bubbles on the wall, each wiped with one lamp stroke.        → 20
//  3 "No pressure": the slab lifts off the seam and floats up out of the frame on its tether.  → 12
//  4 "No proving myself": the certificate frames blank to paper, then fade.                    → 6
//  5 "No pretending": the reply field with `I'm good`, deleted, then the field closes.          → 1
//  6 "Just silence": black, the grain only (the seam and tether a whisper). ASKS 00, once, then gone:
//    the machine voice does not return until the outro's clock.
//  7 "Just breathing": the seam becomes the breath trace, amber, one slow cycle with the amber point at its
//    crest; it exhales back flat to the bone seam at y = SEAM_Y for the cut to `hook3`.
// ASKS is a mono counter on the wall, standing on the seam at the right (as in `pieces`), never a HUD.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { clearRT, Layer2D, W } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { Lyrics, type Line, type Word } from '../engine/lyrics';
import { LIN, rgba } from '../engine/palette';
import { F, font, layout, measure, plain, type TextLayout } from '../engine/type';
import { clamp, ease, frameIdx, lerp, smoothstep, TAU } from '../engine/util';
import { amberPoint, HAIR, roomLight2D, SAFE, seam, SEAM_Y, SLAB, slab2D, tether2D } from './_motifs';

type RGB = [number, number, number];
const mul = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];

/** Per shot: the framing (zoom z about (cx, SEAM_Y)), the lamp on the wall, the seam's intensity. */
const SHOTS = [
  { cx: 760, z: 1.06, light: 0.6, seam: 1 }, //    phone
  { cx: 360, z: 1.05, light: 0.5, seam: 1 }, //    bubbles
  { cx: 540, z: 1.0, light: 0.42, seam: 1 }, //    slab
  { cx: 720, z: 1.05, light: 0.33, seam: 0.95 }, // certificates
  { cx: 400, z: 1.04, light: 0.24, seam: 0.9 }, //  reply field
  { cx: 540, z: 1.0, light: 0, seam: 0.1 }, //      silence
  { cx: 540, z: 1.0, light: 0, seam: 0 }, //        breathing (the trace replaces the seam)
] as const;
const PUSH = 0.012; // slow push inside each shot

const ROW_Y = [800, 930]; // the lyric's two rows on the wall (world baselines)
const MAX_W = 740; // world width of a "No" line (safe in every framing it appears in; checked in init)
const WEIGHTS = [700, 650, 600, 550, 500, 300, 300];
const QUIET = F.archivo(112.5, 300); // "Just silence", "Just breathing"
const QUIET_SIZE = 54;

const SLAB_X = 540 - SLAB.w / 2, SLAB_Y = SEAM_Y - SLAB.h;
const PHONE = { x: 800, y: 1335 };
const BUBBLES = [
  { text: 'so proud of you', x: 150, y: 384 },
  { text: 'need that by Friday', x: 196, y: 466 },
  { text: 'you good?', x: 150, y: 548 },
  { text: 'quick call?', x: 196, y: 630 },
];
const BUB_SIZE = 26, BUB_H = 54;
const CERTS = [
  { title: 'Excellence in Leadership', date: 'AWARDED · 2019', x: 596, y: 372, w: 330, h: 158, rot: -0.018 },
  { title: 'Employee of the Year', date: 'AWARDED · 2021', x: 640, y: 552, w: 270, h: 132, rot: 0.024 },
];
const FIELD = { x: 170, y: 1384, w: 420, h: 62, text: "I'm good" };
const ASKS_X = 940, ASKS_Y = SEAM_Y - 18;

interface PL { line: Line; fam: string; size: number; tr: number; y: number; words: { w: Word; x: number; L: TextLayout }[] }

export default class Silence extends Scene {
  private layer = new Layer2D();
  private lb = new LineBatch(1024, { screen2D: true, blend: 'add' });
  private lines: Line[] = [];
  private cuts: number[] = [];
  private placed: PL[] = [];
  private bubW: number[] = [];

  override init() {
    const L = this.ctx.lyrics, A = this.ctx.audio;
    this.lines = L.lines.filter((l) => l.start >= this.ctx.start - 0.05 && l.start < this.ctx.end - 0.15); // the hook3 "I" starts just before the cut
    if (this.lines.length !== 7) console.warn(`silence: expected 7 lines, found ${this.lines.length}`);
    // the cuts: the beat each line starts on; the last two take a downbeat within one beat of the line
    this.cuts = this.lines.map((l, k) => {
      const s = l.words[0]!.start + 0.02;
      let c = A.timeOfBeat(Math.floor(A.beatAt(s)));
      if (k >= this.lines.length - 2) {
        const d = [...A.downbeats].reverse().find((x) => x <= s);
        if (d !== undefined && A.beatAt(s) - A.beatAt(d) <= 1) c = d;
      }
      return k === 0 ? this.ctx.start : c;
    });
    for (let k = 1; k < this.cuts.length; k++) if (this.cuts[k]! <= this.cuts[k - 1]!) this.cuts[k] = A.timeOfBeat(Math.floor(A.beatAt(this.lines[k]!.start + 0.02)));

    this.placed = this.lines.map((line, k) => {
      const quiet = k >= 5;
      const fam = quiet ? QUIET : F.archivo(100, WEIGHTS[k] ?? 500);
      let size = quiet ? QUIET_SIZE : 84;
      if (!quiet) size = Math.min(size, (size * MAX_W) / measure(line.text, fam, size, 0.01 * size));
      const tr = 0.01 * size * (quiet ? 6 : 1); // the quiet lines are tracked loose
      const space = measure(' ', fam, size) + tr;
      const words: PL['words'] = [];
      let x = 0;
      for (const w of line.words) { const Lw = layout(w.w, fam, size, tr); words.push({ w, x, L: Lw }); x += Lw.width + space; }
      const width = x - space;
      for (const pw of words) pw.x += 540 - width / 2;
      const y = k === 6 ? 0 : ROW_Y[k % 2]!;
      // QA: inside the title-safe area in each framing the line appears in (its own shot and the next)
      if (k < 6) for (const s of [k, k + 1]) {
        const sh = SHOTS[Math.min(s, 6)]!, z = sh.z * (1 + PUSH);
        const X = (wx: number) => sh.cx + z * (wx - sh.cx);
        const top = SEAM_Y + z * (y - size * 0.75 - SEAM_Y);
        if (X(540 - width / 2) < SAFE.x0 || X(540 + width / 2) > SAFE.x1 || top < SAFE.y0)
          console.warn(`silence: "${line.text}" outside the safe area in shot ${s}: ${X(540 - width / 2).toFixed(0)}–${X(540 + width / 2).toFixed(0)}`);
      }
      return { line, fam, size, tr, y, words };
    });
    this.bubW = BUBBLES.map((b) => measure(b.text, F.mono(400), BUB_SIZE) + 40);
  }

  private shotAt(t: number) {
    let k = 0;
    for (let i = 0; i < this.cuts.length; i++) if (t >= this.cuts[i]!) k = i;
    return k;
  }

  // ------------------------------------------------------------------ timings of each switch-off
  private no(k: number) { return this.lines[k]!.words[0]!.start; }
  private lastWord(k: number) { const ws = this.lines[k]!.words; return ws[ws.length - 1]!; }
  /** The phone's glow: ringing until "No", then it dies (a short afterglow). */
  private phoneGlow(t: number) {
    const d = this.no(0);
    const ring = 0.72 + 0.28 * Math.pow(0.5 + 0.5 * Math.cos(TAU * 2.6 * (t - d)), 3);
    if (t < d) return ring;
    const u = (t - d) / 0.32;
    return ring * (1 - ease.outCubic(clamp(u))) + 0.05 * Math.exp(-(t - d) / 0.5) * (u < 1 ? u : 1);
  }
  /** Bubble i's wipe progress 0..1 (spread across "notifications"). */
  private wipe(i: number, t: number) {
    const w = this.lastWord(1), span = w.end - w.start - 0.15;
    const t0 = w.start + (i * span) / BUBBLES.length;
    return clamp((t - t0) / 0.24);
  }
  /** The slab's rise above the seam (px), from "No" of "No pressure". */
  private rise(t: number) {
    const u = (t - this.no(2)) / 1.25;
    if (u <= 0) return 0;
    return 8 * clamp(u / 0.12) + 1500 * Math.max(0, u - 0.06) ** 2;
  }
  private certBlank(t: number) { return smoothstep(this.no(3), this.no(3) + 0.32, t); }
  private certFade(t: number) { const n = this.no(3); return 1 - smoothstep(n + 0.5, Math.min(n + 1.0, this.cuts[4]! - 0.02), t); }
  /** Characters of `I'm good` left, and the field's closing 0..1. */
  private field(t: number) {
    const w = this.lastWord(4), n = FIELD.text.length;
    const del = clamp((t - w.start) / ((w.end - w.start) * 0.6));
    const close = clamp((t - (w.start + (w.end - w.start) * 0.66)) / ((w.end - w.start) * 0.3));
    return { left: n - Math.floor(del * n + 1e-6), del, close };
  }
  private asks(t: number): number {
    if (t < this.no(0)) return 41;
    const steps: [number, number, number][] = [ // [from, to, progress]
      [41, 34, ease.outCubic(clamp((t - this.no(0)) / 0.4))],
      [34, 20, BUBBLES.reduce((s, _, i) => s + (this.wipe(i, t) >= 1 ? 1 : 0), 0) / BUBBLES.length],
      [20, 12, clamp((t - this.no(2)) / 0.6)],
      [12, 6, this.certBlank(t)],
      [6, 1, this.field(t).del],
    ];
    let v = 41;
    for (const [a, b, p] of steps) { if (p <= 0) break; v = Math.round(lerp(a, b, p)); if (p < 1) break; }
    return v;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer } = this.ctx;
    const t = f.t;
    const k = this.shotAt(t);
    const sh = SHOTS[k]!;
    const t0 = this.cuts[k]!, t1 = this.cuts[k + 1] ?? this.ctx.end;
    const z = sh.z * (1 + PUSH * ease.inOutQuad(clamp((t - t0) / (t1 - t0))));
    const X = (x: number) => sh.cx + z * (x - sh.cx);
    const Y = (y: number) => SEAM_Y + z * (y - SEAM_Y);

    const c = this.layer.ctx;
    this.layer.clear();
    c.save();
    c.translate(sh.cx, SEAM_Y); c.scale(z, z); c.translate(-sh.cx, -SEAM_Y);
    roomLight2D(c, SEAM_Y, { intensity: sh.light });
    if (k === 0) this.drawPhone(c, t);
    if (k <= 1) this.drawBubbles(c, t);
    if (k <= 3) this.drawCerts(c, t, k);
    if (k <= 4) this.drawField(c, t, k);
    // the slab and its tether: on the seam until "No pressure", then up and out; the tether stays
    const r = this.rise(t);
    if (k <= 5) {
      const ta = k <= 4 ? 0.75 : 0.1;
      if (r > 0) tether2D(c, 540, SEAM_Y - Math.min(r, 1500), 540, SEAM_Y, { slack: 0, t, seed: 5, alpha: ta }); // taut: it is pulling
      if (k <= 4 && SEAM_Y - r > -SLAB.h - 40) {
        c.save();
        c.translate(540, SEAM_Y - r - SLAB.h / 2); c.rotate(0.03 * clamp(r / 900)); c.translate(-540, -(SEAM_Y - r - SLAB.h / 2));
        slab2D(c, SLAB_X, SLAB_Y - r, SLAB.w, SLAB.h, { lit: 0.3, alpha: 0.95 });
        c.restore();
      }
      if (r > 0) { c.strokeStyle = rgba('bone', 0.85 * ta); c.lineWidth = HAIR * 1.6; c.beginPath(); c.moveTo(535, SEAM_Y); c.lineTo(545, SEAM_Y); c.stroke(); }
    }
    this.drawAsks(c, t, k);
    for (let i = 0; i < 6; i++) this.drawLine(c, this.placed[i]!, t, k, 0);
    c.restore();
    // "Just breathing" rides the crest of the breath trace (screen space: shot 7 is unzoomed)
    const br = this.breath(t);
    if (k === 6) this.drawLine(c, this.placed[6]!, t, k, SEAM_Y - br.A - 44);

    clearRT(renderer, out, LIN.ink);
    this.ctx.comp.draw(renderer, this.layer.upload(), out);

    const lb = this.lb;
    lb.clear();
    if (k < 6) seam(lb, SEAM_Y, { intensity: sh.seam, width: HAIR });
    if (k === 0) { // the phone screen's glow (GL: it blooms, the one warm light in the frame)
      const g = this.phoneGlow(t);
      lb.seg2(X(PHONE.x - 46), Y(PHONE.y), X(PHONE.x + 46), Y(PHONE.y), 30 * z, mul(LIN.lamp, 1.15 * g), 0.55);
    }
    if (k === 1) BUBBLES.forEach((b, i) => { // one lamp stroke per bubble
      const p = this.wipe(i, t);
      if (p <= 0) return;
      const gone = p >= 1 ? clamp((t - this.wipeEnd(i)) / 0.3) : 0;
      if (gone >= 1) return;
      const x0 = b.x - 14, x1 = b.x + this.bubW[i]! + 14, y = b.y + BUB_H / 2;
      lb.seg2(X(x0), Y(y), X(lerp(x0, x1, ease.outCubic(p))), Y(y), 2.6 * z, mul(LIN.lamp, 1.5 * (1 - gone)), 1 - gone);
    });
    if (k === 6) {
      const pts: { x: number; y: number }[] = [];
      for (let i = 0; i <= 96; i++) { const x = (i / 96) * W; pts.push({ x, y: SEAM_Y - br.A * Math.exp(-(((x - 540) / 250) ** 2)) }); }
      if (br.m < 1) lb.polyline(pts, HAIR * 1.5, mul(LIN.lamp, 0.8 * (1 - br.m)), 1);
      if (br.m > 0) lb.polyline(pts, HAIR, mul(LIN.bone, 0.85 * br.m), 1);
      if (br.point > 0) amberPoint(lb, 540, SEAM_Y - br.A, t, 0.55, br.point);
    }
    lb.render(renderer, out);
    return { zoom: k <= 4 ? 1 + 0.005 * f.a.kick : 1, grain: k === 5 ? 0.07 : 0.055 };
  }

  private wipeEnd(i: number) {
    const w = this.lastWord(1), span = w.end - w.start - 0.15;
    return w.start + (i * span) / BUBBLES.length + 0.24;
  }

  /** The breath trace of shot 7: one inhale and exhale (amplitude A), cooling lamp → bone (m) as it flattens. */
  private breath(t: number) {
    const t0 = this.cuts[6]!, u = clamp((t - t0) / (this.ctx.end - t0));
    const A = 78 * Math.pow(Math.sin(Math.PI * ease.inOutQuad(u)), 1.4);
    return { A, m: smoothstep(0.72, 0.97, u), point: (1 - smoothstep(0.6, 0.93, u)) * smoothstep(0, 0.12, u) };
  }

  // -------------------------------------------------------------------------------- the objects
  private drawPhone(c: CanvasRenderingContext2D, t: number) {
    const g = this.phoneGlow(t);
    const { x, y } = PHONE;
    // the light it throws: on the floor (squashed) and the foot of the wall
    c.save();
    c.translate(x, y); c.scale(1, 0.32);
    const fl = c.createRadialGradient(0, 0, 0, 0, 0, 300);
    fl.addColorStop(0, rgba('lamp', 0.32 * g)); fl.addColorStop(1, rgba('lamp', 0));
    c.fillStyle = fl; c.fillRect(-300, -300, 600, 600);
    c.restore();
    const wl = c.createLinearGradient(0, SEAM_Y, 0, SEAM_Y - 260);
    wl.addColorStop(0, rgba('lamp', 0.1 * g)); wl.addColorStop(1, rgba('lamp', 0));
    c.fillStyle = wl; c.fillRect(x - 260, SEAM_Y - 260, 520, 260);
    // the phone, face-up on the floor in perspective (far edge narrower)
    const quad = (s: number) => [[x - 60 * s, y - 26 * s], [x + 60 * s, y - 26 * s], [x + 76 * s, y + 26 * s], [x - 76 * s, y + 26 * s]] as const;
    const path = (q: ReturnType<typeof quad>) => { c.beginPath(); q.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py))); c.closePath(); };
    path(quad(1)); c.fillStyle = rgba('ink', 1); c.fill();
    c.strokeStyle = rgba('dust', 0.55); c.lineWidth = HAIR; c.stroke();
    path(quad(0.84)); c.fillStyle = rgba('lamp', 0.9 * g); c.fill();
  }

  private drawBubbles(c: CanvasRenderingContext2D, t: number) {
    c.font = font(F.mono(400), BUB_SIZE);
    BUBBLES.forEach((b, i) => {
      const p = this.wipe(i, t), w = this.bubW[i]!;
      if (p >= 1) return;
      const x0 = b.x - 14, head = lerp(x0, b.x + w + 14, ease.outCubic(p));
      c.save();
      c.beginPath(); c.rect(head, b.y - 20, 2000, BUB_H + 40); c.clip();
      c.strokeStyle = rgba('dust', 0.6); c.lineWidth = HAIR;
      c.beginPath(); c.roundRect(b.x, b.y, w, BUB_H, 18); c.stroke();
      c.fillStyle = rgba('bone', 0.62);
      c.fillText(b.text, b.x + 20, b.y + BUB_H / 2 + BUB_SIZE * 0.34);
      c.fillStyle = rgba('lamp', 0.85); // the unread dot
      c.beginPath(); c.arc(b.x + w - 2, b.y + 4, 5, 0, TAU); c.fill();
      c.restore();
    });
  }

  private drawCerts(c: CanvasRenderingContext2D, t: number, k: number) {
    const blank = k < 3 ? 0 : this.certBlank(t), fade = k < 3 ? 1 : this.certFade(t);
    if (fade <= 0) return;
    for (const cf of CERTS) {
      c.save();
      c.translate(cf.x + cf.w / 2, cf.y + cf.h / 2); c.rotate(cf.rot);
      const hx = -cf.w / 2, hy = -cf.h / 2;
      if (blank > 0) { c.fillStyle = rgba('bone', 0.12 * blank * fade); c.fillRect(hx + 10, hy + 10, cf.w - 20, cf.h - 20); }
      c.strokeStyle = rgba('dust', 0.7 * fade); c.lineWidth = HAIR;
      c.strokeRect(hx, hy, cf.w, cf.h);
      c.strokeStyle = rgba('dust', 0.35 * fade);
      c.strokeRect(hx + 10, hy + 10, cf.w - 20, cf.h - 20);
      const a = (1 - blank) * fade;
      if (a > 0) {
        c.textAlign = 'center';
        c.font = font(F.serif(400), cf.w > 300 ? 30 : 27);
        c.fillStyle = rgba('bone', 0.55 * a);
        c.fillText(cf.title, 0, 4);
        c.font = font(F.mono(400), 15);
        c.fillStyle = rgba('dust', 0.75 * a);
        c.fillText(cf.date, 0, cf.h / 2 - 30);
        c.textAlign = 'left';
      }
      c.restore();
    }
  }

  private drawField(c: CanvasRenderingContext2D, t: number, k: number) {
    const fd = k < 4 ? { left: FIELD.text.length, close: 0 } : this.field(t);
    if (fd.close >= 1) return;
    const txt = FIELD.text.slice(0, fd.left);
    c.font = font(F.mono(400), 28);
    const tw = measure(txt, F.mono(400), 28);
    const cursorX = FIELD.x + 22 + tw;
    // closing: the field folds in from the right onto the cursor, then goes
    const w = lerp(FIELD.w, cursorX - FIELD.x + 14, ease.inOutCubic(clamp(fd.close / 0.7)));
    const a = 1 - smoothstep(0.6, 1, fd.close);
    c.strokeStyle = rgba('dust', 0.6 * a); c.lineWidth = HAIR;
    c.beginPath(); c.roundRect(FIELD.x, FIELD.y, w, FIELD.h, FIELD.h / 2); c.stroke();
    c.fillStyle = rgba('bone', 0.8 * a);
    c.fillText(plain(txt), FIELD.x + 22, FIELD.y + FIELD.h / 2 + 10);
    if (Math.floor(frameIdx(t) / 30) % 2 === 0 || (k === 4 && fd.left < FIELD.text.length && fd.left > 0)) {
      c.fillStyle = rgba('lamp', 0.9 * a);
      c.fillRect(cursorX + 2, FIELD.y + 16, 2, FIELD.h - 32);
    }
  }

  private drawAsks(c: CanvasRenderingContext2D, t: number, k: number) {
    c.textAlign = 'right';
    if (k <= 4) {
      const v = this.asks(t);
      c.font = font(F.mono(500), 34);
      c.fillStyle = rgba('bone', 0.82);
      c.fillText(String(v).padStart(2, '0'), ASKS_X, ASKS_Y);
      const nw = measure('00', F.mono(500), 34);
      c.font = font(F.mono(400), 20);
      c.fillStyle = rgba('dust', 0.75);
      c.fillText('ASKS', ASKS_X - nw - 12, ASKS_Y);
    } else if (k === 5) {
      // 00 shown once, small, then switched off on the next beat: the machine voice is gone
      const off = this.ctx.audio.timeOfBeat(Math.floor(this.ctx.audio.beatAt(this.cuts[5]!)) + 1);
      if (t < off) {
        c.font = font(F.mono(400), 22);
        c.fillStyle = rgba('dust', 0.8 * (1 - smoothstep(off - 0.06, off, t)));
        c.fillText('00', ASKS_X, ASKS_Y);
      }
    }
    c.textAlign = 'left';
  }

  /** A lyric line: words dim ≤ 0.4 s early, lamp glyph by glyph while sung, bone after; off at the line's end. */
  private drawLine(c: CanvasRenderingContext2D, P: PL, t: number, k: number, yOverride: number) {
    const li = this.placed.indexOf(P);
    if (t < this.cuts[li]! || k < li) return;
    const end = P.line.end;
    const offA = li === 6 ? Math.min(end, this.ctx.end - 0.1) : end + 0.03;
    const off = 1 - smoothstep(offA, offA + 0.09, t);
    if (off <= 0) return;
    const y = yOverride || P.y;
    c.font = font(P.fam, P.size);
    for (const pw of P.words) {
      const w = pw.w;
      if (t < w.start - 0.4) continue;
      const pre = smoothstep(w.start - 0.4, w.start - 0.28, t);
      const p = Lyrics.wordProgress(w, t), n = pw.L.glyphs.length;
      const base = t < w.start ? 0.3 * pre : t >= w.end ? 0.92 : 0.3;
      for (const g of pw.L.glyphs) {
        const lit = t >= w.start && t < w.end ? clamp(p * n - g.i) : 0;
        if (lit < 1) { c.fillStyle = rgba('bone', base * off * (1 - lit)); c.fillText(g.ch, pw.x + g.x, y); }
        if (lit > 0) { c.fillStyle = rgba('lamp', lit * off); c.fillText(g.ch, pw.x + g.x, y); }
      }
    }
  }
}
