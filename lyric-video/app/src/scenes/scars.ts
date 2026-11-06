// Plate 12 `scars` (docs/TREATMENT-drift.md). Lines are found by content inside the window; the text itself
// always comes from the lyrics data.
//  - THE HOLD (NOTES-port d12): opens on exactly `voicemail`'s last frame (drawVoicemailHold) and holds it to
//    the first downbeat. Line 1 is already being sung inside the hold, so it is set small on the wall above
//    the player, lit glyph by glyph from each word's start; it stays in place across the downbeat.
//  - Downbeat: the voicemail is gone and the slab swings up off the floor, close, filling the frame (a slab
//    hinged on the seam, drawn in perspective strip by strip). The amber point runs along the seam at the
//    slab's base, one run per beat, and on each beat the slab comes a step closer.
//  - Line 2: one hairline crack per word drawn into the slab's face (the snare in the line snaps the frame).
//    The cracks are `carry`'s cracks (carry-lines.ts slabCracks(), seeded mulberry32(1414), world coords on
//    the resting SLAB): the same data, revealed one per word; they stay.
//  - Line 3: the slab stands upright (landing on the snare) and the line is carved into its face; the amber
//    point rides the seam under the sung word.
//  - Line 4: on the wall above the slab, condensed, weight 900. On its last word everything drops out until
//    the cut: the slab is gone, grain/bloom/vignette 0, the type thins 900 → 300, the amber point goes grey and
//    sits at the centre of the seam. The last frame is `breath`'s first: ink room, flat seam at SEAM_Y,
//    `ASKS 40` small on the floor at x 124, the point at (540, SEAM_Y) warming back to 45 %.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { clearRT, Layer2D, SCALE } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { Lyrics, type Line, type Word } from '../engine/lyrics';
import { LIN, rgba } from '../engine/palette';
import { F, font, layout, measure, type TextLayout } from '../engine/type';
import { clamp, ease, frameIdx, hash, lerp, pulse, smoothstep } from '../engine/util';
import { amberPoint, amberTail, HAIR, roomLight2D, SAFE, seam, SEAM_Y, SLAB, slab2D } from './_motifs';
import { drawVoicemailHold, VOICEMAIL_CLEAR } from './voicemail-player';
import { slabCracks } from './carry-lines';

type RGB = [number, number, number];
type P = { x: number; y: number };
const mul = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];

// the slab in carry's world coords (resting on the seam, centred)
const SLAB_X = 540 - SLAB.w / 2, SLAB_Y = SEAM_Y - SLAB.h;
// perspective: the slab is hinged on the seam (its base); θ = 0 upright, > 0 leaning toward the camera
const YH = 700; // the horizon
const DS = 1500; // distance of the base (screen px)
const FS = 3.4; // face canvas px per world px (× SCALE)
// framing
const Z0 = 2.3, DZ = 0.22, ZUP = 2.7, ZEND = 2.5;
const TH_LIFT = 0.75, DTH = 0.1;
// type
const FAM_WALL = F.archivo(62.5, 900);
const SMALL = 60; // lines 1 and 2, small on the wall
const ROW1_Y = 470, ROW2_Y = 556;
const ROW4_Y = [404, 524];
const ASKS_POS = { x: SAFE.x0 + 4, y: SEAM_Y + 58 };

interface Run { words: Word[]; L: TextLayout; x0: number }

function makeRun(words: Word[], fam: string, size: number, cx = 540, trEm = 0.02): Run {
  const L = layout(words.map((w) => w.w).join(' '), fam, size, trEm * size);
  return { words, L, x0: cx - L.width / 2 };
}

/** The screen x-extent of each word of a run. */
function wordSpans(r: Run): [number, number][] {
  const out: [number, number][] = [];
  let gi = 0;
  for (const w of r.words) {
    const n = Array.from(w.w).length;
    const a = r.L.glyphs[gi]!, b = r.L.glyphs[gi + n - 1]!;
    out.push([r.x0 + a.x, r.x0 + b.x + b.w]);
    gi += n + 1;
  }
  return out;
}

export default class Scars extends Scene {
  private layer = new Layer2D();
  private lb = new LineBatch(4096, { screen2D: true, blend: 'add' });
  private face!: HTMLCanvasElement;
  private fc!: CanvasRenderingContext2D;

  private l1!: Line; private l2!: Line; private l3!: Line; private l4!: Line;
  private r1!: Run; private r2!: Run;
  private r3!: Run; // carved (world coords on the face)
  private r4: Map<number, Run[]> = new Map(); // per weight (300..900)
  private db = 0; // first downbeat: the hold ends
  private steps: number[] = []; // beats that pull the slab a step closer
  private stand0 = 0; private stand1 = 0;
  private tN = 0; // *nothing*
  private nothing!: Word;
  private groups: { main: P[]; branch: P[] | null; t: number }[] = [];
  private snares: number[] = [];

  override init() {
    const { lyrics, start, end, audio } = this.ctx;
    const inWin = lyrics.lines.filter((l) => l.start >= start - 0.05 && l.start < end);
    const pick = (re: RegExp) => inWin.find((l) => re.test(l.text)) ?? lyrics.lines.find((l) => re.test(l.text) && l.start > start - 1)!;
    this.l1 = pick(/dreams/i); this.l2 = pick(/scars/i); this.l3 = pick(/strong/i); this.l4 = pick(/nothing/i);

    this.r1 = makeRun(this.l1.words, FAM_WALL, SMALL);
    this.r2 = makeRun(this.l2.words, FAM_WALL, SMALL);

    this.db = audio.downbeats.find((d) => d >= start + 0.2) ?? start + 1.4;
    this.stand0 = this.l3.start;
    this.stand1 = audio.beats.find((b) => b >= this.stand0 + 0.15) ?? this.stand0 + 0.35;
    this.steps = audio.beats.filter((b) => b >= this.db - 0.01 && b < this.stand0 - 0.1);
    this.nothing = this.l4.words[this.l4.words.length - 1]!;
    this.tN = this.nothing.start;
    this.snares = audio.events('snare', this.l2.start - 0.05, this.l2.end).map((e) => e[0]);

    // line 3, carved: as wide as the upright face allows (world coords)
    const fam3 = F.archivo(62.5, 900);
    const s3 = Math.min(60, (60 * 300) / measure(this.l3.text, fam3, 60, 0.03 * 60));
    this.r3 = makeRun(this.l3.words, fam3, s3, 540, 0.03);

    // line 4: two rows on the wall, one size (fitted at the heaviest weight), a layout per weight instance
    const split = Math.ceil(this.l4.words.length / 2);
    const rows = [this.l4.words.slice(0, split), this.l4.words.slice(split)];
    const s4 = Math.min(120, ...rows.map((ws) => (120 * 820) / measure(ws.map((w) => w.w).join(' '), F.archivo(62.5, 900), 120, 0.02 * 120)));
    for (let wt = 300; wt <= 900; wt += 100) this.r4.set(wt, rows.map((ws) => makeRun(ws, F.archivo(62.5, wt), s4)));

    // the cracks: carry's data, grouped as main crack + its branch (a branch has 4 points and starts on the
    // previous main crack); one group per word of line 2, drawn at the word's start
    const all = slabCracks();
    const mains: { main: P[]; branch: P[] | null }[] = [];
    for (const pts of all) {
      if (pts.length === 4 && mains.length) mains[mains.length - 1]!.branch = pts;
      else mains.push({ main: pts, branch: null });
    }
    const ws = this.l2.words;
    this.groups = mains.map((g, i) => ({ ...g, t: ws[Math.min(i, ws.length - 1)]!.start + (i >= ws.length ? 0.08 * (i - ws.length + 1) : 0) }));

    this.face = document.createElement('canvas');
    this.face.width = Math.ceil(SLAB.w * FS * SCALE);
    this.face.height = Math.ceil(SLAB.h * FS * SCALE);
    this.fc = this.face.getContext('2d')!;
  }

  // ------------------------------------------------------------------------------- the slab state
  private slabState(t: number): { z: number; th: number } {
    let z = Z0, th = Math.PI / 2;
    // the swing up off the floor on the downbeat
    th = lerp(Math.PI / 2, TH_LIFT, ease.outExpo(clamp((t - this.db) / 0.5)));
    // a step closer per beat (the first step is the downbeat itself)
    this.steps.forEach((b, i) => {
      if (i === 0) return;
      const k = ease.outExpo(clamp((t - b) / 0.32));
      z += DZ * k; th -= DTH * k;
    });
    // stands upright, landing on the beat
    const s = clamp((t - this.stand0) / Math.max(0.1, this.stand1 - this.stand0));
    const ks = s * s * s; // it falls upright: accelerates into the landing
    th = lerp(th, 0, ks);
    z = lerp(z, ZUP, ease.inOutCubic(s));
    // a slow piano drift back over line 4
    z = lerp(z, ZEND, ease.inOutCubic(clamp((t - this.stand1 - 0.6) / Math.max(0.5, this.tN - this.stand1 - 0.6))));
    // the landing's thud: a small overshoot past upright, settling
    if (t >= this.stand1) th = -0.018 * Math.sin((t - this.stand1) * 22) * pulse(t, this.stand1, 0.09);
    return { z, th };
  }

  /** Screen position of a face point at world x and height h (world px) above the base. */
  private proj(wx: number, h: number, st: { z: number; th: number }): P {
    const H = h * st.z;
    const k = DS / (DS - H * Math.sin(st.th));
    return { x: 540 + (wx - 540) * st.z * k, y: YH + ((SEAM_Y - YH) - H * Math.cos(st.th)) * k };
  }

  // ------------------------------------------------------------------------------ the slab's face
  private drawFace(t: number, z: number) {
    const c = this.fc;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.face.width, this.face.height);
    const S = FS * SCALE;
    c.setTransform(S, 0, 0, S, -SLAB_X * S, -SLAB_Y * S);
    slab2D(c, SLAB_X, SLAB_Y, SLAB.w, SLAB.h, { lit: 0.45, alpha: 1 });
    this.drawCracks(c, t, z);
    this.drawCarved(c, t);
  }

  /** carry's cracks (same data, same strokes as drawSlabCracks), each drawn along its length on its word. */
  private drawCracks(c: CanvasRenderingContext2D, t: number, z: number) {
    c.save();
    c.lineJoin = 'round'; c.lineCap = 'round';
    const stroke = (pts: P[], u: number) => {
      if (u <= 0) return;
      const segs: number[] = [];
      let tot = 0;
      for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y); segs.push(d); tot += d; }
      const L = tot * u;
      const path = (dy: number) => {
        c.beginPath(); c.moveTo(pts[0]!.x, pts[0]!.y + dy);
        let acc = 0;
        for (let i = 1; i < pts.length; i++) {
          const d = segs[i - 1]!, p = pts[i - 1]!, q = pts[i]!;
          if (acc + d >= L) { const f = (L - acc) / Math.max(1e-6, d); c.lineTo(lerp(p.x, q.x, f), lerp(p.y, q.y, f) + dy); break; }
          c.lineTo(q.x, q.y + dy); acc += d;
        }
      };
      path(1 / z); c.strokeStyle = rgba('ink', 0.7); c.lineWidth = (HAIR * 1.4) / z; c.stroke();
      path(0); c.strokeStyle = rgba('dust', 0.55); c.lineWidth = (HAIR * 1.1) / z; c.stroke();
    };
    for (const g of this.groups) {
      if (t < g.t) continue;
      stroke(g.main, ease.outExpo(clamp((t - g.t) / 0.16)));
      if (g.branch) stroke(g.branch, ease.outCubic(clamp((t - g.t - 0.1) / 0.12)));
    }
    c.restore();
  }

  /** Line 3 carved into the face: a dark groove (shown at most 0.4 s early), lamp in the groove glyph by
   *  glyph while sung, bone after. */
  private drawCarved(c: CanvasRenderingContext2D, t: number) {
    const r = this.r3, base = SEAM_Y - 96;
    c.font = font(r.L.family, r.L.size);
    c.textBaseline = 'alphabetic';
    let gi = 0;
    for (const w of r.words) {
      const n = Array.from(w.w).length;
      if (t >= w.start - 0.4) {
        const pre = smoothstep(w.start - 0.4, w.start - 0.2, t);
        const p = Lyrics.wordProgress(w, t), singing = t >= w.start && t < w.end;
        const after = smoothstep(w.end, w.end + 0.35, t);
        for (let k = 0; k < n; k++) {
          const g = r.L.glyphs[gi + k]!, x = r.x0 + g.x;
          c.fillStyle = rgba('ink', 0.62 * pre); c.fillText(g.ch, x, base); // the groove
          const lit = singing ? clamp(p * n - k) : t >= w.end ? 1 : 0;
          if (lit > 0) {
            c.fillStyle = rgba('lamp', lit * (1 - after)); c.fillText(g.ch, x, base);
            if (after > 0) { c.fillStyle = rgba('bone', 0.82 * after); c.fillText(g.ch, x, base); }
          }
        }
      }
      gi += n + 1;
    }
  }

  /** Map the face canvas onto the screen: rows of the face are horizontal lines (the hinge is horizontal),
   *  so it is drawn strip by strip, each strip scaled for its depth. */
  private drawSlab(c: CanvasRenderingContext2D, st: { z: number; th: number }, alpha: number) {
    const S = FS * SCALE;
    c.save();
    c.globalAlpha = alpha;
    c.imageSmoothingEnabled = true;
    if (Math.abs(st.th) < 1e-3) {
      const a = this.proj(SLAB_X, SLAB.h, st), b = this.proj(SLAB_X + SLAB.w, 0, st);
      c.drawImage(this.face, 0, 0, this.face.width, this.face.height, a.x, a.y, b.x - a.x, b.y - a.y);
    } else {
      const N = 230, dh = SLAB.h / N;
      for (let j = 0; j < N; j++) {
        const h0 = SLAB.h - j * dh, h1 = h0 - dh;
        const top = this.proj(SLAB_X, h0, st), bot = this.proj(SLAB_X, h1, st);
        const mid = this.proj(SLAB_X, (h0 + h1) / 2, st), midR = this.proj(SLAB_X + SLAB.w, (h0 + h1) / 2, st);
        const y0 = Math.min(top.y, bot.y), hh = Math.abs(bot.y - top.y);
        if (hh < 0.01) continue;
        c.drawImage(this.face, 0, j * dh * S, this.face.width, dh * S, mid.x, y0, midR.x - mid.x, hh + 0.6);
      }
    }
    c.restore();
  }

  // ------------------------------------------------------------------------------------- type
  /** A run of words in screen coords: dim (bone 32 %) at most 0.4 s early, lamp glyph by glyph while sung
   *  (never early), bone after. `sung` overrides the lamp (the grey bar). */
  private drawRun(c: CanvasRenderingContext2D, r: Run, y: number, t: number, alpha: number, sung: 'lamp' | 'bone' = 'lamp', show = -Infinity) {
    if (alpha <= 0.001) return;
    c.font = font(r.L.family, r.L.size);
    c.textBaseline = 'alphabetic';
    let gi = 0;
    for (const w of r.words) {
      const n = Array.from(w.w).length;
      const p0 = Math.max(w.start - 0.4, show);
      const pre = smoothstep(p0, p0 + 0.15, t);
      const p = Lyrics.wordProgress(w, t), singing = t >= w.start && t < w.end;
      for (let k = 0; k < n; k++) {
        const g = r.L.glyphs[gi + k]!, x = r.x0 + g.x;
        const lit = singing ? clamp(p * n - k) : 0;
        const a0 = t < w.start ? 0.32 * pre : t >= w.end ? 0.9 : 0.32;
        if (lit < 1 && a0 > 0) { c.fillStyle = rgba('bone', a0 * (1 - lit) * alpha); c.fillText(g.ch, x, y); }
        if (lit > 0) { c.fillStyle = sung === 'lamp' ? rgba('lamp', lit * alpha) : rgba('bone', 0.95 * lit * alpha); c.fillText(g.ch, x, y); }
      }
      gi += n + 1;
    }
  }

  private weight(t: number) {
    if (t < this.tN) return 900;
    return 900 - 100 * Math.round(6 * ease.outCubic(clamp((t - this.tN) / 0.5)));
  }

  // ------------------------------------------------------------------------------ the amber point
  /** Under the sung word: glides from word to word, never ahead of the word being sung. */
  private underWords(t: number, spans: { w: Word; a: number; b: number }[], from: number, fromT: number): number {
    let x = from, lastT = fromT;
    for (const s of spans) {
      if (t < s.w.start) {
        const k = ease.inOutCubic(clamp((t - lastT) / Math.max(0.12, s.w.start - lastT)));
        return lerp(x, s.a, k);
      }
      if (t < s.w.end) return lerp(s.a, s.b, Lyrics.wordProgress(s.w, t));
      x = s.b; lastT = s.w.end;
    }
    return x;
  }

  private pointAt(t: number): P | null {
    if (t < this.db) return null;
    const y = SEAM_Y;
    if (t < this.stand0) {
      // one run along the slab's base per beat, alternating, from voicemail's LED (x 960)
      let x = 960;
      this.steps.forEach((b, i) => {
        if (t < b) return;
        const st = this.slabState(b + 0.32);
        const half = Math.min(500, (SLAB.w / 2) * st.z);
        const to = i % 2 === 0 ? 540 - half + 24 : 540 + half - 24;
        x = lerp(x, to, ease.outExpo(clamp((t - b) / 0.45)));
      });
      return { x, y };
    }
    const xStand = this.pointAt(this.stand0 - 1e-4)!.x;
    if (t < this.tN) {
      const st = this.slabState(t);
      const sp3 = wordSpans(this.r3).map(([a, b], i) => ({ w: this.r3.words[i]!, a: 540 + (a - 540) * st.z, b: 540 + (b - 540) * st.z }));
      const rows = this.r4.get(900)!;
      const sp4 = rows.flatMap((r) => wordSpans(r).map(([a, b], i) => ({ w: r.words[i]!, a, b })));
      return { x: this.underWords(t, [...sp3, ...sp4], xStand, this.stand0), y };
    }
    const xn = this.pointAt(this.tN - 1e-4)!.x;
    return { x: lerp(xn, 540, ease.inOutCubic(clamp((t - this.tN) / 0.6))), y };
  }

  // ------------------------------------------------------------------------------------- render
  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer } = this.ctx;
    const t = f.t;
    const c = this.layer.ctx;
    this.layer.clear();
    const lb = this.lb;
    lb.clear();

    // ---- the hold: voicemail's last frame, line 1 lit over it
    if (t < this.db) {
      drawVoicemailHold(c, lb, this.ctx, t);
      this.drawRun(c, this.r1, ROW1_Y, t, 1);
      clearRT(renderer, out, VOICEMAIL_CLEAR);
      this.ctx.comp.draw(renderer, this.layer.upload(), out);
      lb.render(renderer, out);
      return {};
    }

    const grey = t >= this.tN;
    const st = this.slabState(t);
    roomLight2D(c, SEAM_Y, { intensity: grey ? 0.24 : lerp(0.32, 0.42, smoothstep(this.db, this.db + 0.5, t)) });

    // the slab (gone on *nothing*)
    if (!grey) {
      this.drawFace(t, st.z * (DS / (DS - SLAB.h * st.z * Math.max(0, Math.sin(st.th)))) * 0.85);
      this.drawSlab(c, st, 1);
    }

    // lines 1 and 2, small on the wall; they go as the slab stands
    const off12 = 1 - smoothstep(this.stand0 + 0.1, this.stand0 + 0.5, t);
    this.drawRun(c, this.r1, ROW1_Y, t, off12);
    this.drawRun(c, this.r2, ROW2_Y, t, off12);

    // line 4 on the wall: weight 900 → 300 on *nothing*, then it goes before the cut
    const rows = this.r4.get(this.weight(t))!;
    const off4 = 1 - smoothstep(this.nothing.end + 0.15, this.nothing.end + 0.8, t);
    rows.forEach((r, i) => this.drawRun(c, r, ROW4_Y[i]!, t, off4, grey ? 'bone' : 'lamp', this.stand1));

    // ASKS 40, small on the floor under the seam (where `breath` has it)
    c.save();
    c.font = font(F.mono(400), 24);
    c.fillStyle = rgba('dust', 0.5);
    c.fillText('ASKS 40', ASKS_POS.x, ASKS_POS.y);
    c.restore();

    clearRT(renderer, out, LIN.ink);
    this.ctx.comp.draw(renderer, this.layer.upload(), out);

    // seam, the amber point (grey in the bar; warming back to breath's 45 % at the cut)
    seam(lb, SEAM_Y, { width: HAIR });
    const p = this.pointAt(t)!;
    if (!grey) {
      amberTail(lb, t, (tb) => (tb < this.db ? null : this.pointAt(tb)), { len: 0.45, intensity: 0.8, maxStep: 160 });
      amberPoint(lb, p.x, p.y, t, 1, 1);
    } else {
      const end = this.ctx.end;
      const warm = smoothstep(end - 0.6, end, t);
      const gI = 1 - warm;
      const d = LIN.dust;
      lb.seg2(p.x, p.y, p.x + 0.01, p.y, 18, mul(d, 0.22 * gI), 0.4);
      lb.seg2(p.x, p.y, p.x + 0.01, p.y, 8, mul(d, 0.7 * gI), 0.9);
      lb.seg2(p.x, p.y, p.x + 0.01, p.y, 4, mul(LIN.bone, 0.75 * gI), 1);
      if (warm > 0) amberPoint(lb, p.x, p.y, t, 1, 0.45 * warm);
    }
    lb.render(renderer, out);

    if (grey) return { grain: 0, bloom: 0, vignette: 0 };
    // the cracks snap the frame (harder on the snare); the 808 breathes it
    let sh = 0;
    for (const g of this.groups) sh += 1.2 * pulse(t, g.t, 0.06);
    for (const s of this.snares) sh += 2.4 * pulse(t, s, 0.07);
    sh += 2.0 * pulse(t, this.stand1, 0.08); // the slab lands
    const fi = frameIdx(t);
    return {
      grain: 0.05,
      zoom: 1 + 0.005 * f.a.kick,
      shake: sh > 0.05 ? [sh * (hash(fi, 3) - 0.5), sh * (hash(fi, 4) - 0.5)] : [0, 0],
    };
  }
}
