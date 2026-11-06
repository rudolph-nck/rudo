// Plate 16 `under` — the final chorus, after hook n=3 (docs/TREATMENT-drift.md).
// "Somewhere the guilt can't find me / Somewhere the past can't reach / Somewhere I can hear myself again /
//  Underneath the noise / And when I'm ready / I'll come back stronger / But tonight / I just wanna drift".
// Seen from far below: the seam is the hairline at the bottom of a mostly black frame, the amber point on
// it, and the words are small, high and drifting, each line on a hairline tether down to the point.
//  - opens on hook3's last frame (DRIFT risen near the top on 1-px tethers, seam 0.9 px), which rises on
//    and goes as a sparse star field comes up;
//  - GUILT and PAST hang under the seam, upside down (the floor's reflection of a word that isn't there),
//    inside the 240 px between the seam and the safe floor (NOTES-port d4); on every beat hairline
//    tendrils grow up from them toward the floating words and fall short, wilting back;
//  - the noise: when "reach" ends, curtains of illegible hairline texture (runs of mono-width dashes and
//    blocks at word lengths, dust 30–40 %, scrolling — never set type: the machine voice stays silent,
//    NOTES-port d8) rush in from both edges and fill the frame; they part down the middle, row by row as
//    each row of the line comes due, to reveal "Somewhere I can hear myself again / Underneath the noise",
//    bone, quiet; after "noise" they part off the frame and the room light comes back;
//  - "And when I'm ready / I'll come back stronger": a tether drops in from above to the seam and the
//    pull starts: the slab is drawn down into the top of the frame, the floating words descend, and every
//    tether straightens; "But tonight": the pull holds and the amber point slides along the seam to its
//    place on the right; "I just wanna drift": release — the words loosen and rise, the slab rises, the
//    tethers go slack, soft curves.
//  - ends on `tomorrow`'s first frame: room light 0.4, the slab (SLAB) at x 400–760 with its top at y −110
//    on a slack tether (0.45, seed 5) from its bottom centre x 580 down to the seam, the amber point on the
//    seam at (860, 1240), intensity 0.75, scale 0.85, no tail; seam HAIR at y 1240.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { clearRT, Layer2D } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { Lyrics, type Line, type Word } from '../engine/lyrics';
import { LIN, rgba } from '../engine/palette';
import { F, font, layout, measure, type TextLayout } from '../engine/type';
import { clamp, ease, hash, lerp, mod, mulberry32, smoothstep, TAU } from '../engine/util';
import { amberPoint, amberTail, HAIR, roomLight2D, SAFE, seam, SEAM_Y, SLAB, slab2D, tether, tether2D, tetherPoints } from './_motifs';
import { DriftWord } from './hook-drift';

type RGB = [number, number, number];
const mul = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];
const fold = (s: string) => s.toLowerCase().replace(/’/g, "'");

// hand-off to `tomorrow` (its first frame)
const PT_X0 = 540, PT_X1 = 860; // the amber point: centre, then its place right of the slab
const PT_I = 0.75, PT_S = 0.85;
const SLAB_X = 400, SLAB_CX = SLAB_X + SLAB.w / 2, SLAB_TOP_END = -110, SLAB_TOP_OFF = -300, SLAB_TOP_PULLED = -40;
const SLAB_SLACK_END = 0.45, ROOM_END = 0.4;

const FLOAT = F.archivo(125, 500); // drifting: wide and light
const QUIET = F.archivo(112.5, 400);
const REFL = F.archivo(62.5, 800); // condensed under pressure: the weight under the floor

// the noise curtains
const NOISE_Y0 = 150, NOISE_Y1 = 1490, ROW_H = 26, CW = 14, STRIP = 2400;
const TEXT_MID = 820; // the middle of the revealed line (the curtains' lens)

interface WL { w: Word; x: number; y: number; L: TextLayout; fam: string; size: number; tr: number; ph: number }
interface Block { words: WL[]; ax: number; ay: number; seed: number }
interface Tok { x: number; n: number; kind: number }
interface NRow { y: number; v: number; a: number; toks: Tok[]; d: number; j: number }
interface Tendril { t0: number; sx: number; tx: number; ty: number; reach: number; amp: number; ph: number; droop: number }
interface Star { x: number; y: number; r: number; b: number; ph: number; f: number }

export default class Under extends Scene {
  private layer = new Layer2D();
  private lb = new LineBatch(4096, { screen2D: true, blend: 'add' });

  private L: Record<'guilt' | 'past' | 'hear' | 'under' | 'ready' | 'strong' | 'tonight' | 'drift', Line> = {} as never;
  private hookDrift: DriftWord | null = null;
  private b1!: Block; private b2!: Block; private b3!: Block; private bA!: Block; private bB!: Block;
  private b3Rows: { w: number; s: number }[] = [];
  private driftWL!: WL; // the last word, "drift" (loosens as it is released)
  private guiltW!: Word; private pastW!: Word;
  private refl: { w: Word; x: number; L: TextLayout; size: number }[] = [];
  private tendrils: Tendril[] = [];
  private rows: NRow[] = [];
  private stars: Star[] = [];
  private tIn = 0; // the noise rushes in
  private tOpen = 0; // …and parts off the frame
  private tDrop = 0; // the slab's tether drops in from above (a downbeat)

  override init() {
    const { lyrics, audio, start, end, H } = this.ctx;
    const inWin = lyrics.lines.filter((l) => l.start >= start - 0.05 && l.start < end);
    const find = (re: RegExp) => inWin.find((l) => re.test(fold(l.text)))!;
    this.L = {
      guilt: find(/guilt can't find/), past: find(/past can't reach/), hear: find(/hear myself/), under: find(/^underneath/),
      ready: find(/when i'm ready/), strong: find(/come back stronger/), tonight: find(/^but tonight/), drift: find(/wanna drift/),
    };
    const L = this.L;
    // hook3's DRIFT (this plate opens on hook3's last frame)
    const before = lyrics.lines.filter((l) => l.i < L.guilt.i && fold(l.text).includes('wanna drift'));
    const pd = before[before.length - 1];
    if (pd) this.hookDrift = new DriftWord(pd.words[pd.words.length - 1]!, 3, H);

    // ---- the floating lines
    this.b1 = this.block(L.guilt.words, FLOAT, 48, 620, 'left', 150, 360, 64, 1);
    this.b2 = this.block(L.past.words, FLOAT, 48, 620, 'right', 930, 560, 64, 2);
    const hw = L.hear.words, uw = L.under.words;
    const rows3 = [[hw[0]!], hw.slice(1, 5), hw.slice(5), uw];
    this.b3 = this.blockRows(rows3, QUIET, 60, 'center', 540, 700, 84, 3);
    this.b3Rows = rows3.map((r) => {
      const ws = this.b3.words.filter((x) => r.includes(x.w));
      const x0 = Math.min(...ws.map((x) => x.x)), x1 = Math.max(...ws.map((x) => x.x + x.L.width));
      return { w: x1 - x0, s: r[0]!.start };
    });
    this.bA = this.block([...L.ready.words, ...L.strong.words], FLOAT, 52, 410, 'left', 140, 420, 70, 4, L.strong.words[0]);
    // B: "But tonight" / "I just wanna" / "drift" (big, the light)
    const dws = L.drift.words;
    const bB = this.blockRows([L.tonight.words, dws.slice(0, -1)], FLOAT, 52, 'left', 140, 830, 70, 5);
    const dw = dws[dws.length - 1]!;
    const dsz = Math.min(130, (100 * 410) / measure(dw.w, FLOAT, 100, 10));
    this.driftWL = { w: dw, x: 140, y: 830 + 70 + dsz * 0.95, L: layout(dw.w, FLOAT, dsz, 0.02 * dsz), fam: FLOAT, size: dsz, tr: 0.02 * dsz, ph: 4.2 };
    bB.words.push(this.driftWL);
    bB.ay = this.driftWL.y + 18; bB.ax = 140 + this.driftWL.L.width / 2;
    this.bB = bB;

    // ---- GUILT and PAST under the seam (upside down), and the beats their tendrils grow on
    this.guiltW = L.guilt.words.find((w) => /guilt/i.test(w.w))!;
    this.pastW = L.past.words.find((w) => /past/i.test(w.w))!;
    const reflFit = (w: Word) => Math.min(290, (100 * 340) / measure(w.w.toUpperCase(), REFL, 100, 4));
    const gs = Math.min(reflFit(this.guiltW), reflFit(this.pastW)), ps = gs; // one size: a pair
    const gL = layout(this.guiltW.w.toUpperCase(), REFL, gs, 0.04 * gs), pL = layout(this.pastW.w.toUpperCase(), REFL, ps, 0.04 * ps);
    this.refl = [{ w: this.guiltW, x: 150, L: gL, size: gs }, { w: this.pastW, x: 930 - pL.width, L: pL, size: ps }];
    this.tIn = L.past.end;
    const uw0 = L.under.words;
    this.tOpen = uw0[uw0.length - 1]!.start; // on "noise" the curtains part off the frame
    this.tDrop = audio.downbeats.find((d) => d >= L.ready.start + 0.3) ?? L.ready.end;
    const rnd = mulberry32(161);
    const targets = (b: Block) => b.words.map((x) => ({ x: x.x + x.L.width / 2, y: x.y + 14 }));
    const tg = targets(this.b1), tp = targets(this.b2);
    for (const b of audio.beats) {
      if (b > this.tIn - 0.1) break;
      this.refl.forEach((r, ri) => {
        if (b < r.w.start - 0.06) return;
        const tgts = ri === 0 ? tg : tp;
        for (let k = 0; k < 2; k++) {
          const tgt = tgts[Math.floor(rnd() * tgts.length)]!;
          this.tendrils.push({
            t0: Math.max(b, r.w.start), sx: r.x + (0.1 + 0.8 * rnd()) * r.L.width, tx: tgt.x + (rnd() - 0.5) * 60, ty: tgt.y,
            reach: 0.5 + 0.28 * rnd(), amp: 14 + 26 * rnd(), ph: rnd() * TAU, droop: (rnd() < 0.5 ? -1 : 1) * (40 + 60 * rnd()),
          });
        }
      });
    }

    // ---- noise rows: runs of mono-width dashes and blocks at word lengths (illegible: no glyphs)
    for (let y = NOISE_Y0, i = 0; y <= NOISE_Y1; y += ROW_H, i++) {
      const r = mulberry32(900 + i);
      const toks: Tok[] = [];
      let x = r() * 40;
      while (x < STRIP - 200) {
        const n = 2 + Math.floor(r() ** 1.4 * 10);
        toks.push({ x, n, kind: r() < 0.55 ? 0 : r() < 0.7 ? 1 : 2 });
        x += (n + 1) * CW + (r() < 0.12 ? CW * (3 + Math.floor(r() * 8)) : 0);
      }
      this.rows.push({ y, v: (r() < 0.5 ? -1 : 1) * (16 + 54 * r()), a: 0.3 + 0.1 * r(), toks, d: r() * 0.14, j: (r() - 0.5) * 22 });
    }

    // ---- a sparse star field, far above
    const rs = mulberry32(73);
    for (let i = 0; i < 170; i++) {
      const b = rs() ** 2.4;
      this.stars.push({ x: rs() * this.ctx.W, y: 140 + rs() * 1000, r: 0.6 + 1.3 * b, b: 0.2 + 0.7 * b, ph: rs() * TAU, f: 0.4 + rs() });
    }
  }

  /** Greedy-wrap words into rows of at most maxW. `breakAt`: force a new row at this word. */
  private block(ws: Word[], fam: string, size: number, maxW: number, align: 'left' | 'right' | 'center', xRef: number, y0: number, lh: number, seed: number, breakAt?: Word): Block {
    const tr = 0.03 * size, space = measure(' ', fam, size) + tr;
    const rows: Word[][] = [];
    let w0 = 0;
    for (const w of ws) {
      const ww = measure(w.w, fam, size, tr);
      const r = rows[rows.length - 1];
      if (r && w !== breakAt && w0 + space + ww <= maxW) { r.push(w); w0 += space + ww; } else { rows.push([w]); w0 = ww; }
    }
    return this.blockRows(rows, fam, size, align, xRef, y0, lh, seed);
  }

  private blockRows(rows: Word[][], fam: string, size: number, align: 'left' | 'right' | 'center', xRef: number, y0: number, lh: number, seed: number): Block {
    const tr = 0.03 * size, space = measure(' ', fam, size) + tr;
    const words: WL[] = [];
    let bottom = y0, minX = Infinity, maxX = -Infinity;
    rows.forEach((r, ri) => {
      const Ls = r.map((w) => layout(w.w, fam, size, tr));
      const width = Ls.reduce((s, l) => s + l.width, 0) + space * (r.length - 1);
      let x = align === 'left' ? xRef : align === 'right' ? xRef - width : xRef - width / 2;
      const y = y0 + ri * lh;
      bottom = y;
      r.forEach((w, i) => {
        words.push({ w, x, y, L: Ls[i]!, fam, size, tr, ph: hash(w.start * 100, seed) * TAU });
        minX = Math.min(minX, x); maxX = Math.max(maxX, x + Ls[i]!.width);
        x += Ls[i]!.width + space;
      });
    });
    return { words, ax: (minX + maxX) / 2, ay: bottom + 16, seed };
  }

  // ------------------------------------------------------------------ the state as functions of t
  /** The pull: 0 → 1 over "And when I'm ready / I'll come back stronger", held through "But tonight". */
  private pull(t: number) {
    return ease.inOutCubic(clamp((t - this.L.ready.start) / (this.L.strong.end - this.L.ready.start)));
  }
  /** The release on "I just wanna drift" (a little on the legato "I", most of it on "drift"). */
  private release(t: number) {
    const ws = this.L.drift.words, dw = ws[ws.length - 1]!;
    return 0.2 * smoothstep(ws[0]!.start, dw.start, t) + 0.8 * ease.outCubic(clamp((t - dw.start) / 1.0));
  }
  private room(t: number) {
    return ROOM_END * ease.inOutCubic(smoothstep(this.L.under.end, this.L.strong.end, t));
  }
  private pointX(t: number) {
    const l = this.L.tonight;
    return lerp(PT_X0, PT_X1, ease.inOutCubic(clamp((t - l.start) / (l.end - 0.2 - l.start))));
  }
  private slab(t: number) {
    const P = this.pull(t), R = this.release(t);
    const top = lerp(lerp(SLAB_TOP_OFF, SLAB_TOP_PULLED, P), SLAB_TOP_END, R);
    return { top, slack: 0.15 * (1 - P) + SLAB_SLACK_END * R, drop: ease.outCubic(clamp((t - this.tDrop) / 0.55)) };
  }
  /** The noise curtains covering the frame (0..1, for fading what is behind them). */
  private cover(t: number) {
    return smoothstep(this.tIn, this.tIn + 0.35, t);
  }
  /** The gap between the curtains: each row of the line opens it as it comes due; after "noise" they part off the frame. */
  private gap(t: number) {
    let g = 0;
    for (const r of this.b3Rows) g = Math.max(g, (r.w + 150) * ease.outExpo(clamp((t - (r.s - 0.5)) / 0.4)));
    return lerp(g, 1700, ease.inOutCubic(clamp((t - this.tOpen) / 0.8)));
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, start, end } = this.ctx;
    const t = f.t;
    const c = this.layer.ctx;
    this.layer.clear();
    const lb = this.lb;
    lb.clear();
    const L = this.L;
    const P = this.pull(t), R = this.release(t);
    const cover = this.cover(t);
    const ptX = this.pointX(t);

    // ---- the room returning (dark out of the noise; tomorrow opens at 0.4)
    const room = this.room(t);
    if (room > 0.001) roomLight2D(c, SEAM_Y, { intensity: room });

    // ---- stars, far above (up as the hook's DRIFT goes; gone under the noise)
    const sa = smoothstep(start, L.guilt.start + 0.9, t) * (1 - cover);
    if (sa > 0.001) {
      for (const s of this.stars) {
        const tw = 0.7 + 0.3 * Math.sin(t * s.f * 2.2 + s.ph);
        c.fillStyle = rgba('bone', s.b * tw * sa * 0.75);
        c.beginPath(); c.arc(s.x, s.y, s.r, 0, TAU); c.fill();
      }
    }

    // ---- hook3's DRIFT: as it was on hook3's last frame, then rising on and gone
    if (this.hookDrift) {
      const g = ease.inOutCubic(smoothstep(start + 0.04, L.guilt.start + 0.55, t));
      if (g < 1) this.hookDrift.draw(c, lb, t, this.hookDrift.liftK(t), { alpha: 1 - g, dy: -70 * g, tether: { rgb: LIN.bone, width: 0.8 } });
    }

    // ---- GUILT and PAST under the seam, upside down, and their tendrils
    for (const r of this.refl) this.drawRefl(c, r, t, 1 - cover);
    this.drawTendrils(lb, t, 1 - cover);

    // ---- lines 1 and 2: small, high, drifting (L1 dims when L2 comes)
    const a1 = (1 - 0.45 * smoothstep(L.past.start - 0.2, L.past.start + 0.4, t)) * (1 - cover);
    this.drawBlock(c, lb, this.b1, t, a1, 0, ptX, 0.5);
    this.drawBlock(c, lb, this.b2, t, 1 - cover, 0, ptX, 0.5);

    // ---- the noise curtains
    if (t >= this.tIn && t < this.tOpen + 0.85) this.drawNoise(c, t, f.a.kick);

    // ---- "Somewhere I can hear myself again / Underneath the noise", in the gap
    const a3 = 1 - smoothstep(L.under.end - 0.04, L.under.end + 0.16, t);
    this.drawBlock(c, lb, this.b3, t, a3, 0, ptX, 0.35);

    // ---- the slab and its tether (from "And when I'm ready")
    const s = this.slab(t);
    if (t >= this.tDrop) {
      const by = s.top + SLAB.h;
      if (s.drop >= 1) tether2D(c, SLAB_CX, by, SLAB_CX, SEAM_Y, { slack: s.slack, t, seed: 5, alpha: 0.8 });
      else { // dropping in from above: drawn down to where it has reached
        const yEnd = lerp(-10, SEAM_Y, s.drop);
        const pts = tetherPoints(SLAB_CX, by, SLAB_CX, SEAM_Y, s.slack, t, 5).filter((p) => p.y <= yEnd);
        c.save(); c.strokeStyle = rgba('bone', 0.7 * 0.8); c.lineWidth = HAIR; c.beginPath();
        pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
        c.lineTo(SLAB_CX, yEnd); c.stroke(); c.restore();
      }
      if (by > -2) slab2D(c, SLAB_X, s.top, SLAB.w, SLAB.h, { lit: lerp(0.25, 0.55, room), seed: 3 });
    }

    // ---- "And when I'm ready / I'll come back stronger", then "But tonight / I just wanna drift"
    const slackW = 0.5 * (1 - P) + 0.6 * R;
    const dyW = 70 * P - 110 * R;
    const aA = lerp(1, 0.4, smoothstep(L.tonight.start - 0.2, L.tonight.start + 0.5, t)) * (1 - smoothstep(L.drift.start, L.drift.start + 0.9, t));
    // (A's tether would cross B: it lets go as B comes, A only dims and goes)
    this.drawBlock(c, lb, this.bA, t, aA, dyW, ptX, slackW, 1 - smoothstep(L.tonight.start - 0.4, L.tonight.start + 0.1, t));
    // "drift" loosens on the release
    const d = this.driftWL;
    const trD = lerp(0.02, 0.11, ease.outCubic(R)) * d.size;
    if (trD !== d.tr) { d.tr = trD; d.L = layout(d.w.w, d.fam, d.size, trD); }
    this.drawBlock(c, lb, this.bB, t, 1, dyW, ptX, slackW);

    clearRT(renderer, out, LIN.ink);
    this.ctx.comp.draw(renderer, this.layer.upload(), out);

    // ---- the seam (hook3's 0.9 px → HAIR) and the amber point
    seam(lb, SEAM_Y, { width: lerp(0.9, HAIR, smoothstep(start, start + 3, t)) });
    const pi = PT_I * smoothstep(L.guilt.start - 0.1, L.guilt.start + 0.9, t);
    if (pi > 0.001) {
      const l7 = L.tonight;
      const tailI = smoothstep(l7.start, l7.start + 0.3, t) * (1 - smoothstep(l7.end - 0.3, l7.end + 0.4, t));
      if (tailI > 0.001) amberTail(lb, t, (tb) => ({ x: this.pointX(tb), y: SEAM_Y }), { len: 0.6, intensity: 0.6 * tailI, embers: 8 });
      amberPoint(lb, ptX, SEAM_Y, t, PT_S, pi);
    }
    lb.render(renderer, out);

    // kick breath: hook3's (0.008) easing to tomorrow's (0.004); grain hook3's 0.05 → the default
    const k = smoothstep(start, end, t);
    return { zoom: 1 + lerp(0.008, 0.004, k) * f.a.kick, grain: lerp(0.05, 0.055, k) };
  }

  /** A block of floating words, each bobbing a little, with one tether from under it to the amber point. */
  private drawBlock(c: CanvasRenderingContext2D, lb: LineBatch, b: Block, t: number, alpha: number, dy: number, ptX: number, slack: number, tetherA = 1) {
    if (alpha <= 0.001) return;
    const first = b.words[0]!.w;
    if (t < first.start - 0.4) return;
    const age = Math.max(0, t - (first.start - 0.4));
    const rise = -7 * age; // drifting up, slowly
    let low = -Infinity, x0 = Infinity, x1 = -Infinity;
    for (const wl of b.words) {
      const bob = 5 * Math.sin(t * 0.7 + wl.ph), sway = 3 * Math.sin(t * 0.45 + wl.ph * 1.7);
      if (!this.word(c, wl, wl.x + sway, wl.y + rise + dy + bob, t, alpha)) continue;
      if (wl.y > low + 1) { low = wl.y; x0 = Infinity; x1 = -Infinity; }
      if (wl.y >= low - 1) { x0 = Math.min(x0, wl.x); x1 = Math.max(x1, wl.x + wl.L.width); }
    }
    if (low === -Infinity || tetherA <= 0.001) return;
    // the tether hangs from under the lowest row shown so far (a line grows downward as it is sung)
    const ta = tetherA * alpha * smoothstep(first.start - 0.4, first.start + 0.2, t);
    tether(lb, (x0 + x1) / 2, low + 16 + rise + dy, ptX, SEAM_Y, { slack, t, seed: b.seed, intensity: 0.55 * ta, width: 0.9 });
  }

  /** A word: dim (bone 30 %) up to 0.4 s early, lamp glyph by glyph while sung, then bone. "drift" keeps the light. */
  private word(c: CanvasRenderingContext2D, r: WL, x: number, y: number, t: number, alpha: number): boolean {
    const w = r.w;
    if (t < w.start - 0.4) return false;
    c.font = font(r.fam, r.size);
    const pre = smoothstep(w.start - 0.4, w.start - 0.2, t);
    const p = Lyrics.wordProgress(w, t);
    const n = r.L.glyphs.length;
    const keep = r === this.driftWL;
    for (const g of r.L.glyphs) {
      const lit = t < w.start ? 0 : t >= w.end ? (keep ? 1 : 0) : clamp(p * n - g.i);
      const base = t < w.start ? 0.3 * pre : t >= w.end ? 0.92 : 0.3;
      if (lit < 1) { c.fillStyle = rgba('bone', base * alpha * (1 - lit)); c.fillText(g.ch, x + g.x, y); }
      if (lit > 0) { c.fillStyle = rgba('lamp', lit * alpha); c.fillText(g.ch, x + g.x, y); }
    }
    return true;
  }

  /** GUILT / PAST hanging under the seam, upside down (mirrored like the floor's reflection), fading downward. */
  private drawRefl(c: CanvasRenderingContext2D, r: { w: Word; x: number; L: TextLayout; size: number }, t: number, alpha: number) {
    if (t < r.w.start || alpha <= 0.001) return;
    const k = ease.outCubic(clamp((t - r.w.start) / 0.4));
    const cap = r.size * 0.72;
    const base = SEAM_Y + 16 + 26 * (1 - k);
    c.save();
    c.translate(r.x, base);
    c.scale(1, -1);
    const g = c.createLinearGradient(0, 0, 0, -cap);
    g.addColorStop(0, rgba('dust', 0.62 * k * alpha));
    g.addColorStop(1, rgba('dust', 0.14 * k * alpha));
    c.fillStyle = g;
    c.font = font(REFL, r.size);
    for (const gl of r.L.glyphs) c.fillText(gl.ch, gl.x, 0);
    c.restore();
  }

  /** Tendrils: grow up from GUILT / PAST on the beat toward the floating words, fall short, wilt back. */
  private drawTendrils(lb: LineBatch, t: number, alpha: number) {
    if (alpha <= 0.001) return;
    const sy = SEAM_Y + 14;
    for (const d of this.tendrils) {
      const age = t - d.t0;
      if (age < 0 || age > 1.4) continue;
      const grow = ease.outExpo(clamp(age / 0.45));
      const fall = ease.inCubic(clamp((age - 0.45) / 0.8));
      const len = d.reach * grow * (1 - 0.85 * fall);
      const a = alpha * (1 - smoothstep(0.9, 1.4, age));
      if (len <= 0.005 || a <= 0.001) continue;
      const dx = d.tx - d.sx, dyy = d.ty - sy, dl = Math.hypot(dx, dyy);
      const nx = -dyy / dl, ny = dx / dl;
      const pts: { x: number; y: number }[] = [];
      const n = 26;
      for (let i = 0; i <= n; i++) {
        const u = (i / n) * len;
        const wob = d.amp * Math.sin(u * 9 + d.ph + age * 2) * u;
        const droop = d.droop * fall * (u / Math.max(0.01, len)) ** 2;
        pts.push({ x: d.sx + dx * u + nx * wob + droop * 0.6, y: sy + dyy * u + ny * wob + Math.abs(droop) * 0.8 });
      }
      lb.polyline(pts, 0.95, mul(LIN.bone, 0.5), a);
      const tip = pts[pts.length - 1]!;
      lb.seg2(tip.x, tip.y, tip.x + 0.01, tip.y, 2.4, mul(LIN.bone, 0.6), a * (1 - fall));
    }
  }

  /** The noise curtains: ink bands of hairline dash/block texture, rushing in from both edges, parting in the middle. */
  private drawNoise(c: CanvasRenderingContext2D, t: number, kick: number) {
    const W = this.ctx.W, mid = W / 2;
    const G = this.gap(t);
    c.save();
    for (const r of this.rows) {
      const kin = ease.outExpo(clamp((t - this.tIn - r.d) / 0.45));
      if (kin <= 0) continue;
      const lens = r.y > 640 && r.y < 1000 ? 1 : 0.62 + 0.38 * Math.exp(-(((r.y - TEXT_MID) / 420) ** 2));
      const g = G * lens;
      const eLt = mid - g / 2 + r.j, eRt = mid + g / 2 + r.j;
      const eL = lerp(-40, eLt, kin), eR = lerp(W + 40, eRt, kin);
      if (eL <= 0 && eR >= W) continue;
      const y0 = r.y - ROW_H / 2;
      c.fillStyle = rgba('ink', 1);
      if (eL > 0) c.fillRect(0, y0, eL, ROW_H);
      if (eR < W) c.fillRect(eR, y0, W - eR, ROW_H);
      const scroll = r.v * t;
      c.fillStyle = rgba('dust', r.a * (1 + 0.2 * kick));
      c.beginPath();
      for (const side of [0, 1]) {
        const shift = (side ? eR : eL) - mid;
        for (const tk of r.toks) {
          const X = mod(tk.x + scroll, STRIP) - (STRIP - W) / 2 + shift;
          const w = tk.n * CW;
          if (side === 0 ? X > eL : X + w < eR) continue;
          if (X + w < 0 || X > W) continue;
          for (let i = 0; i < tk.n; i++) {
            const x = X + i * CW;
            if (side === 0 ? x + CW > eL : x < eR) continue;
            const block = tk.kind === 1 || (tk.kind === 2 && (i + tk.n) % 3 === 0);
            if (block) c.rect(x + 1.5, r.y - 5, CW - 4, 9);
            else c.rect(x + 1.5, r.y, CW - 3, 1);
          }
        }
      }
      c.fill();
    }
    c.restore();
  }
}
