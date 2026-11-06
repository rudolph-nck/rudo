// Plate 8 `stars` — "Float somewhere between the stars … I just wanna leave it for a bit" (after hooks 1 and 2;
// docs/TREATMENT-drift.md). It opens on the hook's last frame (DRIFT lifted on its tethers, the seam at
// SEAM_Y) and then:
//  1. "Float somewhere": the camera cranes up — the wall, the ceiling edge, the roof line pass down the
//     frame, then nothing but night; DRIFT's tethers stretch down to the seam as it falls away. The slab
//     rises with us, slowly rotating, its tether paying out below. "between the stars": a few hundred bone
//     points; the lyric words become constellation labels in mono beside their stars (hairline leaders),
//     one per sung word, forming a loose constellation the shape of the seam.
//  2. "And forget about all this": far below, out of focus, the verse's objects slide past along the seam
//     and go. "No deadlines / No expectations / No voices in my head": each NO is a slam in the lyric voice;
//     on the next kick an object (calendar page DUE, checklist, speech bubble) is wiped with one stroke.
//  3. "I don't wanna leave this world / I just wanna leave it for a bit": a hard cut on the downbeat to the
//     downward look: the seam far below with the amber point (home) on it, the tether taut up from it;
//     every word's tether converges on the point; "for a bit" is set small beside it. The plate ends on the
//     bare downward look, which the hook reprise opens on.
// Every floating word keeps a visible tether to the seam (off-frame below, or converging on the point).
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { clearRT, Layer2D } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { Lyrics, type Line, type Word } from '../engine/lyrics';
import { LIN, rgba } from '../engine/palette';
import { F, font, layout, measure } from '../engine/type';
import { clamp, ease, hash, lerp, mulberry32, pulse, smoothstep, TAU } from '../engine/util';
import { HAIR, HANDOFF, roomLight2D, SAFE, seam, SEAM_Y, SLAB, slab2D } from './_motifs';
import { DriftWord } from './hook-drift';
import { downLook, downLookGlow, forABit } from './stars-down';

type RGB = [number, number, number];
const mul = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];
const fold = (s: string) => s.toLowerCase().replace(/’/g, "'");

const CRANE = 2700; // how far the camera rises (px of world)
const CEIL = 1400, ROOF = 1640; // ceiling edge and roof line, above the seam
const MONO = F.mono(400), MONO_SIZE = 38;

interface Label { w: Word; sx: number; sy: number; lx: number; ly: number }
interface Star { x: number; y: number; r: number; b: number; ph: number; f: number }

export default class Stars extends Scene {
  private layer = new Layer2D();
  private lb = new LineBatch(4096, { screen2D: true, blend: 'add' });
  private lbInk = new LineBatch(256, { screen2D: true, blend: 'normal' }); // ink lines while stars2 is still on hook2's bone field
  private n = 1;
  private stars: Star[] = [];
  private drift: DriftWord | null = null;
  private float!: Line;
  private forget: Line | null = null;
  private nos: Line[] = [];
  private leave1!: Line;
  private leave2!: Line;
  private tLook = 0; // the cut to the downward look
  private consts: Label[][] = [];
  private kicks: number[] = [];

  override init() {
    const { lyrics: ly, start, end, H, audio } = this.ctx;
    const inWin = ly.lines.filter((l) => l.start >= start - 0.05 && l.start < end);
    this.float = inWin.find((l) => /float/i.test(l.text))!;
    this.forget = inWin.find((l) => /forget/i.test(l.text)) ?? null;
    this.nos = inWin.filter((l) => /^no\b/i.test(l.text));
    this.leave1 = inWin.find((l) => fold(l.text).includes("don't wanna leave"))!;
    this.leave2 = inWin.find((l) => /leave it for a bit/i.test(l.text))!;
    const before = ly.lines.filter((l) => l.i < this.float.i && fold(l.text).includes('wanna drift'));
    const pd = before[before.length - 1];
    this.n = this.ctx.params.n ?? 1; // stars2 follows the inverted n=2 hook: it opens on its bone field
    if (pd) this.drift = new DriftWord(pd.words[pd.words.length - 1]!, this.n, H);
    const s = this.leave1.words[0]!.start + 0.02;
    this.tLook = [...audio.downbeats].reverse().find((d) => d <= s && s - d < 0.7) ?? this.leave1.words[0]!.start;
    this.kicks = audio.onsets['kick']!.filter(([, st]) => st > 0.35).map(([k]) => k);

    // the star field (seeded): mostly faint pinpoints, a few brighter
    const rnd = mulberry32(81);
    for (let i = 0; i < 340; i++) {
      const b = rnd() ** 2.2;
      this.stars.push({ x: rnd() * this.ctx.W, y: rnd() * H, r: 0.7 + 1.6 * b, b: 0.25 + 0.75 * b, ph: rnd() * TAU, f: 0.4 + rnd() });
    }
    // constellations: one per floating line, along a gently waving horizontal (the shape of the seam)
    const rows = [this.float, this.forget].filter(Boolean) as Line[];
    rows.forEach((l, li) => {
      const y0 = li === 0 ? 560 : 820;
      // stars spaced by the real label widths (mono), then fitted into the safe width
      const ws = l.words.map((w) => measure(w.w, MONO, MONO_SIZE) + 34);
      const sum = ws.reduce((a, b) => a + b, 0);
      const k = Math.min(1, (SAFE.x1 - SAFE.x0 - 20) / sum);
      let x = SAFE.x0 + ((SAFE.x1 - SAFE.x0) - sum * k) / 2;
      this.consts.push(l.words.map((w, wi) => {
        const sx = x;
        x += ws[wi]! * k;
        const sy = y0 + Math.sin(wi * 1.4 + li) * 30 + (hash(l.i, wi, 5) - 0.5) * 24;
        const up = wi % 2 === 0;
        return { w, sx, sy, lx: sx + 12, ly: sy + (up ? -18 : 42) };
      }));
    });
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer } = this.ctx;
    const t = f.t;
    const c = this.layer.ctx;
    this.layer.clear();
    const lb = this.lb;
    lb.clear();
    this.lbInk.clear();
    if (t < this.tLook) this.sky(c, lb, t);
    else this.look(c, lb, t);
    // n=2: hook2's bone field, darkening into night as the camera cranes up
    const k = this.paper(t);
    clearRT(renderer, out, [lerp(LIN.ink[0], LIN.bone[0], k), lerp(LIN.ink[1], LIN.bone[1], k), lerp(LIN.ink[2], LIN.bone[2], k)]);
    this.ctx.comp.draw(renderer, this.layer.upload(), out);
    this.lbInk.render(renderer, out);
    lb.render(renderer, out);
    return { zoom: 1 + 0.008 * f.a.kick }; // = hook's kick breath (the seam keeps its pixel row at the cut)
  }

  /** 1 = hook2's bone field (stars2 only), 0 = night. */
  private paper(t: number) {
    if (this.n !== 2) return 0;
    const tF = this.float.words[0]!.start;
    return 1 - smoothstep(tF, tF + 0.9, t);
  }

  // ---------------------------------------------------------------------------- 1 + 2: the sky
  private sky(c: CanvasRenderingContext2D, lb: LineBatch, t: number) {
    const W = this.ctx.W, H = this.ctx.H;
    const tF = this.float.words[0]!.start;
    const crane = ease.inOutCubic(clamp((t - tF) / 1.9));
    const h = CRANE * crane;
    const seamY = SEAM_Y + h; // the seam's screen y as we rise

    // the room falling away: the lit wall between the seam and the ceiling edge, the roof slab above it
    if (crane > 0 && crane < 1) {
      c.save();
      c.translate(0, h);
      roomLight2D(c, SEAM_Y, { intensity: 0.55 * smoothstep(0, 0.15, crane) });
      c.fillStyle = rgba('concrete', 0.55);
      c.fillRect(0, SEAM_Y - ROOF, W, ROOF - CEIL);
      c.restore();
      seam(lb, SEAM_Y - CEIL + h, { intensity: 0.8 });
      seam(lb, SEAM_Y - ROOF + h, { intensity: 0.6 });
    }
    const ink = this.paper(t) > 0.5; // on the bone field: ink seam and tethers (normal blend)
    if (seamY < H + 40) {
      if (ink) seam(this.lbInk, seamY, { width: HAIR, color: LIN.ink });
      else seam(lb, seamY, { width: HAIR });
    }

    // the stars: in once the roof line has passed below the top of the frame
    const sa = smoothstep(ROOF - 200, ROOF + 500, h);
    if (sa > 0) for (const s of this.stars) {
      const tw = 0.8 + 0.2 * Math.sin(t * s.f + s.ph);
      const y = s.y + (1 - crane) * 120;
      lb.seg2(s.x, y, s.x + 0.01, y, s.r, mul(LIN.bone, 0.9 * s.b * tw * sa), 1);
    }

    // DRIFT (the hook's last frame), floating with us, fading as the stars come in; tethers to the seam
    if (this.drift) {
      const a = 1 - smoothstep(tF + 0.5, tF + 1.7, t);
      if (a > 0) this.drift.draw(c, ink ? this.lbInk : lb, t, this.drift.liftK(t), {
        sung: t >= this.drift.word.end, seamY: Math.min(seamY, H + 20), alpha: a, ink,
        tether: ink ? { rgb: LIN.ink, width: HAIR * 0.75 } : undefined,
      });
    }

    // the slab rises with us from below, slowly turning, its tether paying out to the seam below
    const rise = ease.outCubic(clamp((t - tF - 0.5) / 2.2));
    const lastNo = this.nos[this.nos.length - 1];
    const slabOut = lastNo ? smoothstep(lastNo.end, lastNo.end + 0.6, t) : 0;
    if (rise > 0 && slabOut < 1) {
      const sw = SLAB.w * 0.62, sh = SLAB.h * 0.62;
      const cx = 790, cy = lerp(H + 260, 1250, rise) + Math.sin(t * 0.5) * 10;
      const ang = 0.18 * Math.sin(t * 0.21) + 0.05 * (t - tF);
      c.save();
      c.globalAlpha = 1 - slabOut;
      c.translate(cx, cy); c.rotate(ang);
      slab2D(c, -sw / 2, -sh / 2, sw, sh, { lit: 0.25, seed: 3 });
      c.restore();
      const by = cy + (sh / 2) * Math.cos(ang) + (sw / 2) * Math.abs(Math.sin(ang)) * 0.3;
      lb.seg2(cx, by, cx, H + 20, HAIR, mul(LIN.bone, 0.6), 1 - slabOut);
    }

    // constellations (float, forget), dimming once the NOs begin
    const tNo = this.nos[0]?.start ?? Infinity;
    const dimAll = 1 - smoothstep(tNo - 0.1, tNo + 0.3, t);
    this.consts.forEach((cs, ci) => this.constellation(c, lb, cs, t, dimAll * (ci === 0 ? sa : 1)));

    // "And forget about all this": the verse's objects slide past far below, out of focus
    if (this.forget) this.farBelow(c, t);

    // the NOs
    this.nos.forEach((l, i) => this.no(c, lb, l, t, this.nos[i + 1]?.start ?? this.tLook));
  }

  /** A line as a constellation: a star per word, the word in mono beside it on a hairline leader, joined star to star, tethered down. */
  private constellation(c: CanvasRenderingContext2D, lb: LineBatch, cs: Label[], t: number, alpha: number) {
    if (alpha <= 0.001) return;
    const H = this.ctx.H;
    c.save();
    c.font = font(MONO, MONO_SIZE);
    cs.forEach((L, i) => {
      if (t < L.w.start) return;
      const k = ease.outCubic(clamp((t - L.w.start) / 0.25));
      const p = Lyrics.wordProgress(L.w, t);
      const a = alpha * lerp(1, 0.55, smoothstep(L.w.end + 1, L.w.end + 2.5, t));
      lb.seg2(L.sx, L.sy, L.sx + 0.01, L.sy, 4.5, mul(LIN.bone, 1.1 * a), 1); // the word's star
      lb.seg2(L.sx, L.sy, lerp(L.sx, L.lx - 4, k), lerp(L.sy, L.ly - 10, k), HAIR, mul(LIN.dust, 0.9 * a), 1); // leader
      lb.seg2(L.sx, L.sy + 4, L.sx, H + 20, HAIR * 0.8, mul(LIN.bone, 0.35 * a * k), 1); // tether down to the seam
      const prev = cs[i - 1];
      if (prev) lb.seg2(prev.sx, prev.sy, lerp(prev.sx, L.sx, k), lerp(prev.sy, L.sy, k), HAIR, mul(LIN.dust, 0.6 * a), 1);
      c.fillStyle = p < 1 ? rgba('lamp', a * k) : rgba('bone', 0.92 * a);
      c.fillText(L.w.w, L.lx, L.ly);
    });
    c.restore();
  }

  /** Far below, out of focus: picture frames, pieces, the phone slide left along a soft seam and go. */
  private farBelow(c: CanvasRenderingContext2D, t: number) {
    const l = this.forget!;
    const k = clamp((t - l.start) / (l.end + 1 - l.start));
    const a = smoothstep(0, 0.12, k) * (1 - smoothstep(0.85, 1, k));
    if (a <= 0) return;
    const y = 1660;
    c.save();
    c.filter = 'blur(7px)';
    c.globalAlpha = a * 0.75;
    c.strokeStyle = rgba('bone', 0.6); c.lineWidth = 3;
    c.beginPath(); c.moveTo(0, y); c.lineTo(this.ctx.W, y); c.stroke();
    const objs: [number, number, number][] = [[0, 120, 150], [260, 70, 70], [420, 160, 110], [700, 40, 80], [860, 130, 170]];
    const shift = lerp(900, -1200, k);
    for (const [ox, w, hh] of objs) {
      c.strokeStyle = rgba('bone', 0.5); c.lineWidth = 4;
      c.strokeRect(ox + shift, y - hh, w, hh);
    }
    c.fillStyle = rgba('lamp', 0.5); // the phone's glow, small
    c.fillRect(1100 + shift, y - 16, 70, 12);
    c.restore();
  }

  /** NO: a slam in the lyric voice, the rest of the line in mono under it, and an object wiped on the next kick. */
  private no(c: CanvasRenderingContext2D, lb: LineBatch, l: Line, t: number, until: number) {
    const w0 = l.words[0]!;
    if (t < w0.start || t >= until) return;
    const W = this.ctx.W, H = this.ctx.H;
    const fam = F.archivo(100, 900), size = 300;
    const s = lerp(1.22, 1, ease.outExpo(clamp((t - w0.start) / 0.15)));
    const nw = measure('NO', fam, size);
    const cy = 900;
    c.save();
    c.translate(W / 2, cy - size * 0.36); c.scale(s, s);
    c.font = font(fam, size);
    c.fillStyle = rgba('bone', 0.96);
    c.fillText('NO', -nw / 2, size * 0.36);
    c.restore();
    lb.seg2(W / 2, cy + 8, W / 2, H + 20, HAIR, mul(LIN.bone, 0.45), 1); // its tether
    // the rest of the line, mono, under it
    const rest = l.words.slice(1);
    const txt = rest.map((w) => w.w).join(' ');
    c.save();
    c.font = font(MONO, 44);
    let x = W / 2 - measure(txt, MONO, 44) / 2;
    for (const w of rest) {
      const ww = measure(w.w + ' ', MONO, 44);
      if (t >= w.start) { c.fillStyle = Lyrics.wordProgress(w, t) < 1 ? rgba('lamp', 1) : rgba('bone', 0.9); c.fillText(w.w, x, cy + 100); }
      x += ww;
    }
    c.restore();
    // the object above NO, wiped with one horizontal stroke on the first kick after the slam
    const kick = this.kicks.find((k) => k > w0.start + 0.05 && k < until) ?? w0.start + 0.5;
    const wipe = clamp((t - kick) / 0.12);
    const gone = smoothstep(kick + 0.12, kick + 0.25, t);
    if (gone >= 1) return;
    const ox = W / 2, oy = 470;
    c.save();
    c.globalAlpha = 1 - gone;
    c.strokeStyle = rgba('bone', 0.85); c.lineWidth = HAIR * 1.4;
    const kind = /deadline/i.test(l.text) ? 'cal' : /expect/i.test(l.text) ? 'list' : 'bubble';
    if (kind === 'cal') {
      c.strokeRect(ox - 110, oy - 120, 220, 240);
      c.beginPath(); c.moveTo(ox - 110, oy - 70); c.lineTo(ox + 110, oy - 70); c.stroke();
      for (const dx of [-60, 60]) { c.beginPath(); c.moveTo(ox + dx, oy - 140); c.lineTo(ox + dx, oy - 100); c.stroke(); }
      c.font = font(F.mono(500), 54); c.fillStyle = rgba('bone', 0.85);
      c.fillText('DUE', ox - measure('DUE', F.mono(500), 54) / 2, oy + 40);
    } else if (kind === 'list') {
      c.strokeRect(ox - 120, oy - 130, 240, 260);
      for (let i = 0; i < 4; i++) { const y = oy - 80 + i * 55; c.strokeRect(ox - 90, y - 16, 26, 26); c.beginPath(); c.moveTo(ox - 44, y - 3); c.lineTo(ox + 90, y - 3); c.stroke(); }
    } else {
      c.beginPath(); c.roundRect(ox - 150, oy - 100, 300, 170, 26); c.stroke();
      c.beginPath(); c.moveTo(ox - 60, oy + 70); c.lineTo(ox - 90, oy + 120); c.lineTo(ox - 20, oy + 70); c.stroke();
    }
    c.restore();
    if (wipe > 0) lb.seg2(ox - 190, oy, lerp(ox - 190, ox + 190, ease.outCubic(wipe)), oy, 3, mul(LIN.lamp, 1.6 * (1 - gone)), 1);
  }

  // ------------------------------------------------------------------- 3: the downward look
  private look(c: CanvasRenderingContext2D, lb: LineBatch, t: number) {
    downLook(lb, t);
    downLookGlow(c); // faint lamp light on the floor around home, far below
    // the two lines, wide and light, high up; each word's tether converges on the point; "for a bit" sits beside it
    const bit = this.leave2.words.slice(-3);
    const upper2 = this.leave2.words.slice(0, -3);
    this.hang(c, lb, this.leave1.words, t, 470, this.leave2.start + 0.6);
    this.hang(c, lb, upper2, t, 600, (upper2[upper2.length - 1]?.end ?? t) + 1.6);
    forABit(c, bit, t);
  }

  /** A row of words in the drifting voice (wide, light), tethered down to home; fades out after `out`. */
  private hang(c: CanvasRenderingContext2D, lb: LineBatch, ws: Word[], t: number, y: number, out: number) {
    if (!ws.length || t < ws[0]!.start - 0.4) return;
    const D = HANDOFF.downLook;
    const fam = F.archivo(125, 500), size = 52, tr = 0.06 * size;
    const fade = 1 - smoothstep(out, out + 0.8, t);
    if (fade <= 0) return;
    const space = measure(' ', fam, size) + tr;
    const widths = ws.map((w) => layout(w.w, fam, size, tr).width);
    let x = this.ctx.W / 2 - (widths.reduce((a, b) => a + b, 0) + space * (ws.length - 1)) / 2;
    c.save();
    c.font = font(fam, size);
    c.letterSpacing = `${tr}px`;
    ws.forEach((w, i) => {
      const pre = smoothstep(w.start - 0.4, w.start - 0.25, t);
      const p = Lyrics.wordProgress(w, t);
      const a = (t < w.start ? 0.3 * pre : 1) * fade;
      c.fillStyle = t >= w.start && p < 1 ? rgba('lamp', a) : rgba('bone', (t < w.start ? 1 : 0.92) * a);
      if (a > 0) c.fillText(w.w, x, y);
      if (t >= w.start) {
        const cx = x + widths[i]! / 2;
        lb.seg2(cx, y + 10, D.x, D.y - 8, HAIR * 0.8, mul(LIN.bone, 0.32 * fade * pulse(t, w.start, 9)), 1);
      }
      x += widths[i]! + space;
    });
    c.restore();
  }
}
