// Plate 13 `breath` — "Not forever / Just long enough to breathe" (docs/TREATMENT-drift.md). The pre-chorus
// before chorus 2. The seam alone again (after `scars`' textureless bar the grain is back):
//  - "Not forever": set on the seam. The amber point waits at the centre; as *forever* is sung its tracking
//    loosens until the word reaches the right safe edge, the point following the lit letter; after the word
//    the letters keep running and slide off the right edge; the point follows them, slows, and turns back
//    (it does not go "forever"), gliding home to where the next line starts.
//  - "Just long enough to breathe": the seam becomes a breath trace. The point is the pen: it travels under
//    the sung word and the seam behind it rises and falls with ONE slow breath spanning the line (inhale over
//    "Just long enough to", the crest exactly as *breathe* begins, on the kick; the long exhale over the held
//    *breathe*). The words ride the trace, glyph by glyph on its slope. The camera tracks the pen.
//  - On *breathe*'s exhale the trace settles back flat, and on the kick the point rounds into a ring; on the
//    next kick the ring opens as a door, a bone disc with the next room (bone paper, an ink seam at SEAM_Y)
//    inside, expanding through the frame; by the cut it covers the frame: `hook2`'s first frame (bone field,
//    ink hairline seam at y = 1240). Words the door passes over turn ink (lamp stays lamp).
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { clearRT, Layer2D } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { Lyrics, type Line, type Word } from '../engine/lyrics';
import { LIN, rgba } from '../engine/palette';
import { F, font, layout, measure, type TextLayout } from '../engine/type';
import { clamp, ease, lerp, smoothstep, TAU } from '../engine/util';
import { amberPoint, amberTail, HAIR, roomLight2D, SAFE, seam, SEAM_Y } from './_motifs';

const FAM1 = F.archivo(112.5, 600);
const SIZE1 = 112;
const FAM2 = F.archivo(112.5, 500);
const SIZE2 = 96;
const FAMB = F.archivo(125, 500); // *breathe*: wide and light (the release is coming)
const SIZEB = 118;
const LIFT = 18; // words stand this far above the line
const AMP = 165; // the breath's crest height above the seam (px)
const WAIT_X = 540; // where the point waits for *forever*
const TURN_X = 1000; // where it turns back
const EDGE_R = 940;
const SKIRT = 320; // px ahead of the pen over which the trace eases back down to the seam // the current word's right edge is kept inside this (camera)

interface PW { w: Word; x0: number; L: TextLayout; fam: string; size: number }

export default class Breath extends Scene {
  private layer = new Layer2D();
  private lb = new LineBatch(2048, { screen2D: true, blend: 'add' });
  private lbInk = new LineBatch(64, { screen2D: true, blend: 'normal' });
  private l1!: Line;
  private l2!: Line;
  private not!: PW;
  private forever!: PW;
  private foreverExtra = 0; // per-gap tracking added over *forever* so it reaches the right safe edge
  private words: PW[] = [];
  private tT: number[] = []; // pen table (line 2): time, world x, breath
  private tX: number[] = [];
  private tB: number[] = [];
  private t2 = 0; // line 2 starts
  private tEnd = 0;
  private tTurn = 0;
  private ring0 = 0; // the point rounds into a ring (kick)
  private ring1 = 0; // the ring opens as the door (next kick)
  private ringC = { x: 540, y: SEAM_Y };
  private ringMax = 1500;

  override init() {
    const { lyrics, start, end, audio } = this.ctx;
    const inWin = lyrics.lines.filter((l) => l.start >= start - 0.05 && l.start < end);
    this.l1 = inWin.find((l) => /forever/i.test(l.text)) ?? lyrics.get('Not forever');
    this.l2 = inWin.find((l) => /breathe/i.test(l.text)) ?? lyrics.get('long enough to breathe');
    this.tEnd = end;

    // line 1: "Not forever" on the seam from the left safe edge
    const [wNot, wFor] = [this.l1.words[0]!, this.l1.words[this.l1.words.length - 1]!];
    const tr1 = 0.01 * SIZE1;
    const Ln = layout(wNot.w, FAM1, SIZE1, tr1);
    this.not = { w: wNot, x0: SAFE.x0, L: Ln, fam: FAM1, size: SIZE1 };
    const fx0 = SAFE.x0 + Ln.width + measure(' ', FAM1, SIZE1) + tr1;
    const Lf = layout(wFor.w, FAM1, SIZE1, tr1);
    this.forever = { w: wFor, x0: fx0, L: Lf, fam: FAM1, size: SIZE1 };
    this.foreverExtra = Math.max(0, (SAFE.x1 - 14 - (fx0 + Lf.width)) / Math.max(1, Lf.glyphs.length - 1));
    this.tTurn = wFor.end + 0.36;

    // line 2: one run in world x (the camera tracks it), starting at the left safe edge
    let x = SAFE.x0;
    for (const w of this.l2.words) {
      const big = /breathe/i.test(w.w);
      const fam = big ? FAMB : FAM2, size = big ? SIZEB : SIZE2, tr = (big ? 0.04 : 0.01) * size;
      const L = layout(w.w, fam, size, tr);
      this.words.push({ w, x0: x, L, fam, size });
      x += L.width + measure(' ', FAM2, SIZE2) + 0.01 * SIZE2;
    }
    this.t2 = this.l2.words[0]!.start;

    // the pen table: where the point was at each moment of line 2, and the breath then
    for (let t = this.t2; t <= end + 1e-6; t += 1 / 240) { this.tT.push(t); this.tX.push(this.penWX(t)); this.tB.push(this.breathAt(t)); }

    // the door: the point rounds into a ring on the first kick well into *breathe*, opens on the next
    const bw = this.words[this.words.length - 1]!.w;
    const ks = (audio.onsets.kick ?? []).filter(([kt, s]) => kt > bw.start + 0.5 && kt < end - 0.12 && s > 0.25).map(([kt]) => kt);
    this.ring0 = ks[0] ?? end - 0.52;
    this.ring1 = ks[1] ?? Math.min(end - 0.3, this.ring0 + 0.2);
    const cam = this.camX(this.ring0);
    this.ringC = { x: this.penWX(this.ring0) - cam, y: SEAM_Y - this.traceAt(this.penWX(this.ring0), this.ring0) };
    const { W, H } = this.ctx;
    this.ringMax = Math.max(...[[0, 0], [W, 0], [0, H], [W, H]].map(([cx, cy]) => Math.hypot(cx! - this.ringC.x, cy! - this.ringC.y))) + 12;
  }

  /** One slow breath across line 2: flat at its first word, the crest at its midpoint (= *breathe*'s start), flat at the cut. */
  private breathAt(t: number) {
    const u = clamp((t - this.t2) / (this.tEnd - this.t2));
    return 0.5 - 0.5 * Math.cos(TAU * u);
  }

  /** The exhale settles the whole trace (its history too) flat by the cut. */
  private settle(t: number) {
    return 1 - ease.inOutCubic(smoothstep(this.ring0 - 0.25, this.tEnd - 0.04, t));
  }

  /** Pen world x in line 2: under the sung word, across the gaps. */
  private penWX(t: number): number {
    const ws = this.words;
    if (t <= ws[0]!.w.start) return ws[0]!.x0;
    for (let i = 0; i < ws.length; i++) {
      const a = ws[i]!, b = ws[i + 1];
      if (t < a.w.end) return lerp(a.x0, a.x0 + a.L.width, Lyrics.wordProgress(a.w, t));
      if (b && t < b.w.start) return lerp(a.x0 + a.L.width, b.x0, (t - a.w.end) / Math.max(1e-3, b.w.start - a.w.end));
    }
    const l = ws[ws.length - 1]!;
    return l.x0 + l.L.width;
  }

  /** Trace height (px above the seam) at world x, time t: the breath when the pen passed x; flat ahead of the pen. */
  private traceAt(xw: number, t: number): number {
    if (t < this.t2) return 0;
    const X = this.tX;
    if (xw <= X[0]!) return 0;
    const pen = this.penWX(t);
    if (xw > pen) {
      // ahead of the pen the seam swells up to meet it (a soft skirt), never a cliff
      const u = Math.min(1, (xw - pen) / SKIRT);
      return AMP * this.breathAt(t) * this.settle(t) * 0.5 * (1 + Math.cos(Math.PI * u));
    }
    let lo = 0, hi = X.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (X[m]! < xw) lo = m; else hi = m; }
    const k = clamp((xw - X[lo]!) / Math.max(1e-6, X[hi]! - X[lo]!));
    let b = lerp(this.tB[lo]!, this.tB[hi]!, k);
    if (this.tT[lo]! > t) b = this.breathAt(t);
    return AMP * b * this.settle(t);
  }

  /** Camera x: keeps the current (or next) word's right edge inside EDGE_R; a short look-ahead average (eases before the move). */
  private camTarget(t: number) {
    if (t < this.t2 - 0.4) return 0;
    const w = this.words.find((p) => p.w.end > t) ?? this.words[this.words.length - 1]!;
    return Math.max(0, w.x0 + w.L.width - EDGE_R);
  }
  private camX(t: number) {
    let s = 0;
    for (let i = 0; i < 9; i++) s += this.camTarget(t + 0.1 - (0.55 * i) / 8);
    return s / 9;
  }

  /** forever's glyph x at t (screen): tracking loosening as it is sung, then running off to the right. */
  private foreverGX(i: number, t: number) {
    const pw = this.forever, w = pw.w, n = pw.L.glyphs.length;
    const p = ease.inOutCubic(clamp((t - w.start) / Math.max(0.1, w.end - w.start)));
    const run = 1150 * ease.inQuad(clamp((t - w.end) / 0.85)) * (0.7 + 0.3 * (i / Math.max(1, n - 1)));
    return pw.x0 + pw.L.glyphs[i]!.x + this.foreverExtra * i * p + run;
  }

  /** The point's screen position. */
  private pointAt(t: number): { x: number; y: number } {
    const fw = this.forever.w;
    if (t < this.t2) {
      const n = this.forever.L.glyphs.length;
      const litX = (tt: number) => {
        const p = Lyrics.wordProgress(fw, tt) * n;
        const i = Math.min(n - 1, Math.floor(p)), g = this.forever.L.glyphs[i]!;
        return this.foreverGX(i, tt) + g.w * clamp(p - i);
      };
      if (t <= fw.end) return { x: Math.max(WAIT_X, t > fw.start ? litX(t) : WAIT_X), y: SEAM_Y };
      const xe = Math.max(WAIT_X, litX(fw.end - 1e-4));
      if (t <= this.tTurn) return { x: lerp(xe, TURN_X, ease.outCubic((t - fw.end) / (this.tTurn - fw.end))), y: SEAM_Y };
      const home = this.words[0]!.x0 - this.camX(this.t2);
      return { x: lerp(TURN_X, home, ease.inOutCubic(clamp((t - this.tTurn) / (this.t2 - this.tTurn)))), y: SEAM_Y };
    }
    const wx = this.penWX(t);
    return { x: wx - this.camX(t), y: SEAM_Y - this.traceAt(wx, t) };
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, W } = this.ctx;
    const t = f.t;
    const cam = this.camX(t);
    const c = this.layer.ctx;
    this.layer.clear();
    roomLight2D(c, SEAM_Y, { intensity: 0.24 });

    // the door
    const k0 = clamp((t - this.ring0) / Math.max(0.05, this.ring1 - this.ring0));
    const k1 = clamp((t - this.ring1) / Math.max(0.05, this.tEnd - 0.03 - this.ring1));
    const r0 = t >= this.ring0 ? 64 * ease.outExpo(k0) : 0; // the ring the point rounds into
    const R = t >= this.ring1 ? lerp(r0, this.ringMax, ease.inCubic(k1)) : 0; // the open door (bone disc)
    const { x: cx, y: cy } = this.ringC;
    if (R > 0) {
      c.fillStyle = rgba('bone', 1);
      c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.fill();
    }

    // ASKS: the running state, small on the floor under the seam (frozen at 40)
    const asksX = SAFE.x0 + 4 - cam;
    const asksA = 0.5 * edgeFade(asksX) * edgeFade(asksX + 120);
    if (asksA > 0) {
      c.save();
      if (R > 0) { c.beginPath(); c.rect(0, 0, W, this.ctx.H); c.arc(cx, cy, R, 0, TAU, true); c.clip(); }
      c.font = font(F.mono(400), 24);
      c.fillStyle = rgba('dust', asksA);
      c.fillText('ASKS 40', asksX, SEAM_Y + 58);
      c.restore();
    }

    // the words: bone on ink, and ink where the door has opened behind them (lamp stays lamp)
    if (R > 0) {
      c.save(); c.beginPath(); c.rect(0, 0, W, this.ctx.H); c.arc(cx, cy, R, 0, TAU, true); c.clip();
      this.drawWords(c, t, cam, 'bone');
      c.restore();
      c.save(); c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.clip();
      this.drawWords(c, t, cam, 'ink');
      c.restore();
    } else this.drawWords(c, t, cam, 'bone');

    clearRT(renderer, out, LIN.ink);
    this.ctx.comp.draw(renderer, this.layer.upload(), out);

    const lb = this.lb;
    lb.clear();
    const inDoor = (x: number, y: number) => R > 0 && Math.hypot(x - cx, y - cy) < R + 1;
    // the seam / breath trace (outside the door)
    const bone: [number, number, number] = [LIN.bone[0] * 0.85, LIN.bone[1] * 0.85, LIN.bone[2] * 0.85];
    if (t < this.t2 || this.settle(t) <= 0) {
      if (R <= 0) seam(lb, SEAM_Y, { width: HAIR });
      else {
        const half = R > Math.abs(cy - SEAM_Y) ? Math.sqrt(R * R - (cy - SEAM_Y) ** 2) : -1;
        if (half < 0) seam(lb, SEAM_Y, { width: HAIR });
        else {
          if (cx - half > 0) lb.seg2(0, SEAM_Y, cx - half, SEAM_Y, HAIR, bone, 1);
          if (cx + half < W) lb.seg2(cx + half, SEAM_Y, W, SEAM_Y, HAIR, bone, 1);
        }
      }
    } else {
      const STEP = 4;
      let px = 0, py = SEAM_Y - this.traceAt(cam, t);
      for (let sx = STEP; sx <= W + STEP; sx += STEP) {
        const y = SEAM_Y - this.traceAt(sx + cam, t);
        if (!inDoor((px + sx) / 2, (py + y) / 2)) lb.seg2(px, py, sx, y, HAIR, bone, 1);
        px = sx; py = y;
      }
    }
    // the ring: a bone hairline round the point, then the door's rim
    const rim = R > 0 ? R + 5 : r0;
    if (rim > 0.5 && rim < this.ringMax + 6) {
      const n = Math.min(400, Math.max(48, Math.round(rim * 0.5)));
      const a = R > 0 ? 0.9 : 0.9 * ease.outCubic(k0);
      for (let i = 0; i < n; i++) {
        const a0 = (TAU * i) / n, a1 = (TAU * (i + 1)) / n;
        lb.seg2(cx + rim * Math.cos(a0), cy + rim * Math.sin(a0), cx + rim * Math.cos(a1), cy + rim * Math.sin(a1), HAIR, bone, a);
      }
    }
    // the point: warms up from `scars`' grey, follows, turns back, pens the breath, then becomes the ring
    const warm = lerp(0.45, 1, ease.outCubic(clamp((t - this.ctx.start) / 0.45)));
    const fade = 1 - smoothstep(this.ring0, this.ring1, t);
    if (fade > 0) {
      const p = this.pointAt(t);
      amberTail(lb, t, (tb) => (tb < this.ctx.start ? null : this.pointAt(tb)), { len: 0.4, intensity: 0.75 * warm * fade, maxStep: 90 });
      amberPoint(lb, p.x, p.y, t, 1, warm * fade);
    }
    lb.render(renderer, out);

    // inside the door: the next room's ink seam at SEAM_Y (hook2's first frame)
    if (R > Math.abs(cy - SEAM_Y)) {
      const half = Math.sqrt(R * R - (cy - SEAM_Y) ** 2);
      this.lbInk.clear();
      seam(this.lbInk, SEAM_Y, { x0: Math.max(0, cx - half), x1: Math.min(W, cx + half), width: HAIR, color: LIN.ink });
      this.lbInk.render(renderer, out);
    }

    return { zoom: 1 + 0.006 * f.a.kick, grain: 0.05 };
  }

  private drawWords(c: CanvasRenderingContext2D, t: number, cam: number, fg: 'bone' | 'ink') {
    // line 1
    const l1Fade = 1 - smoothstep(this.t2 - 0.85, this.t2 - 0.45, t); // "Not" stays put and fades; *forever* runs off
    if (t < this.forever.w.end + 0.9) {
      const not = this.not;
      this.drawGlyphs(c, not, t, fg, (i) => ({ x: not.x0 + not.L.glyphs[i]!.x, y: SEAM_Y - LIFT, a: 0 }), l1Fade, false);
      this.drawGlyphs(c, this.forever, t, fg, (i) => ({ x: this.foreverGX(i, t), y: SEAM_Y - LIFT, a: 0 }), 1, true);
    }
    // line 2: riding the trace
    if (t < this.t2 - 0.4) return;
    for (const pw of this.words) {
      this.drawGlyphs(c, pw, t, fg, (i) => {
        const g = pw.L.glyphs[i]!;
        const wx = pw.x0 + g.x + g.w / 2;
        const y = SEAM_Y - this.traceAt(wx, t);
        const dy = this.traceAt(wx + 8, t) - this.traceAt(wx - 8, t);
        const a = Math.atan2(-dy, 16);
        return { x: wx - cam - g.w / 2, y: y - LIFT, a, cx: wx - cam };
      }, 1, false);
    }
  }

  /** dim up to 0.4 s before its start → lamp glyph by glyph while sung → bone (ink inside the door). */
  private drawGlyphs(c: CanvasRenderingContext2D, pw: PW, t: number, fg: 'bone' | 'ink', at: (i: number) => { x: number; y: number; a: number; cx?: number }, alpha: number, runOff: boolean) {
    const w = pw.w;
    if (t < w.start - 0.4 || alpha <= 0) return;
    const pre = smoothstep(w.start - 0.4, w.start - 0.25, t);
    const p = Lyrics.wordProgress(w, t);
    const n = pw.L.glyphs.length;
    c.font = font(pw.fam, pw.size);
    for (const g of pw.L.glyphs) {
      const q = at(g.i);
      const mid = q.cx ?? q.x + g.w / 2;
      const ef = runOff ? clamp((1075 - mid) / 140) : edgeFade(mid);
      if (ef <= 0) continue;
      const lit = t >= w.start && t < w.end ? clamp(p * n - g.i) : t >= w.end ? 1 : 0;
      const base = t < w.start ? 0.32 * pre : 0.32;
      const done = t >= w.end;
      c.save();
      c.translate(q.x + g.w / 2, q.y);
      if (q.a) c.rotate(q.a);
      if (done) {
        c.fillStyle = rgba(fg, 0.95 * ef * alpha);
        c.fillText(g.ch, -g.w / 2, 0);
      } else {
        if (lit < 1) { c.fillStyle = rgba(fg, base * ef * alpha * (1 - lit)); c.fillText(g.ch, -g.w / 2, 0); }
        if (lit > 0) { c.fillStyle = rgba('lamp', lit * ef * alpha); c.fillText(g.ch, -g.w / 2, 0); }
      }
      c.restore();
    }
  }
}

/** Words fade out past the title-safe edges (the run is tracked, so it crosses them). */
function edgeFade(x: number) {
  return clamp((x - (SAFE.x0 - 80)) / 120) * clamp((SAFE.x1 + 80 - x) / 120);
}
