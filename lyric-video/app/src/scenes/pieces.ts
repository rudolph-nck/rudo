// Plate 3 `pieces` — "Everybody needs a piece of me / Everybody wants my time / I'm carrying so much weight /
// I forgot what's actually mine" (docs/TREATMENT-drift.md).
// ME in the lyric voice, huge and wide, on the wall above the seam; the slab (left on the seam by `ceiling`)
// below it. On every kick a rectangular piece is cut out of the letters (a lamp hairline cut that cools to a
// dust scar), the piece slides to an edge of the frame and gets a mono label; ASKS counts the cuts in mono
// beside the seam, 01 → 14. The window has fewer kicks than pieces, so per the treatment's fallback the last
// kicks before "mine" cut two pieces at once and ASKS jumps by two (14 by "mine", never a piece off a kick).
//  - "Everybody wants my time": the clock reappears (mono at CLOCK_POS, a hairline face beside it) and its
//    two hands are torn off as pieces on the next two kicks.
//  - "I'm carrying so much weight": the pieces fall onto the slab, landing on the kicks, and pile up; every
//    landing kick sinks the slab a step into the seam.
//  - "I forgot what's actually mine": what is left of ME is a sliver; *mine* is set tiny, mono, lower-case,
//    below the seam where nobody looks.
// The sung lines are set on the wall as one inscription row above ME, per word: dim at most 0.4 s early, lit
// lamp glyph by glyph while sung, then bone.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { clearRT, Layer2D, SCALE, W } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { Lyrics, type Line, type Word } from '../engine/lyrics';
import { LIN, rgba } from '../engine/palette';
import { F, fitSize, font, layout, measure, plain } from '../engine/type';
import { clamp, ease, hash, lerp, mulberry32, pulse, smoothstep, TAU } from '../engine/util';
import { CLOCK_POS, clockSec, drawClock2D, HAIR, roomLight2D, SAFE, seam, SEAM_Y, SLAB, slab2D } from './_motifs';

const N_PIECES = 14;
const LABELS = ['WORK', 'TEAM', 'BILLS', 'MOM', 'FRIENDS', 'CHURCH', 'HOA', 'TAXES', 'TEXTS', 'GROUP CHAT', 'LANDLORD', 'DENTIST 2:15'];
const HAND_LABELS = ['MEETING 9:00', 'GOT A MINUTE?'];

const ME_FAM = F.archivo(125, 900);
const ME_TOP = 470; // ink top of ME
const ME_BOT = 830; // ink bottom (baseline) of ME
const BAND_Y = 402; // baseline of the sung line's row on the wall
const SLAB_X = W / 2 - SLAB.w / 2;
const FACE = { x: 896, y: 250, r: 44 }; // the clock face, on the clock's row
const ASKS = { x: 760, y: SEAM_Y - 16, size: 30 };
const MINE = { x: 168, y: SEAM_Y + 66, size: 28 };
const PARK_W = 92; // a parked piece's width at the frame edge
const PILE_W = 80; // a piled piece's width on the slab

type Rect = { x: number; y: number; w: number; h: number };
interface Piece {
  kind: 'me' | 'hand';
  cell: Rect; // the piece's rect at scale 1 (ME cells: where it was cut from; hands: its own box)
  hand?: 0 | 1;
  label: string;
  tc: number; // cut time (a kick)
  land: number; // landing on the pile (a kick), Infinity if it never falls
  side: -1 | 1;
  park: { x: number; y: number; s: number };
  slot: { x: number; y: number; s: number; rot: number };
  rot: number; // parked tilt
}
interface Row { line: Line; words: { w: Word; x: number }[]; fam: string; size: number; show: number }

export default class Pieces extends Scene {
  private layer = new Layer2D();
  private lb = new LineBatch(64, { screen2D: true, blend: 'add' });
  private me!: HTMLCanvasElement; // ME, bone, at SCALE
  private meX = 0;
  private meSize = 0;
  private cells: Rect[] = [];
  private sliver!: Rect;
  private pieces: Piece[] = [];
  private cutTimes: number[] = []; // one entry per cut event
  private sinkKicks: number[] = [];
  private kicks: number[] = [];
  private rows: Row[] = [];
  private mine!: Word;
  private clockOn = 0;
  private clockBase = 0;
  private weightStart = 0;

  override init() {
    const ly = this.ctx.lyrics, au = this.ctx.audio;
    const { start, end } = this.ctx;
    const L1 = ly.get('Everybody needs a piece'), L2 = ly.get('Everybody wants my time');
    const L3 = ly.get("I'm carrying so much weight"), L4 = ly.get("I forgot what's actually mine");
    this.mine = L4.words[L4.words.length - 1]!;
    this.weightStart = L3.start;
    // the clock comes back on the beat its line starts on; it resumes from where plate 1 stopped it
    this.clockOn = au.timeOfBeat(Math.floor(au.beatAt(L2.start + 0.02)));
    const stop = ly.get('everything to stop').words.find((w) => /stop/i.test(w.w))!;
    this.clockBase = clockSec('04:37:00') + Math.floor(stop.start);

    this.buildMe();
    this.buildRows([L1, L2, L3, L4]);

    // kicks inside the window; cuts on every kick before "mine", doubling the last ones to reach 14
    this.kicks = au.events('kick', start, end).map(([t]) => t);
    const pre = this.kicks.filter((k) => k < this.mine.start);
    const doubles = clamp(N_PIECES - pre.length, 0, pre.length);
    const per = pre.map((_, j) => (j >= pre.length - doubles ? 2 : 1));
    // ME cells in a fixed, scattered cut order (the sliver stays)
    const order = [11, 2, 7, 3, 9, 0, 8, 4, 10, 1, 5, 6];
    let meN = 0, handN = 0, sideN = 0;
    const parkN = { [-1]: 0, [1]: 0 } as Record<number, number>;
    pre.forEach((tc, j) => {
      this.cutTimes.push(tc);
      for (let q = 0; q < per[j]!; q++) {
        if (this.pieces.length >= N_PIECES) break;
        const isHand = tc >= this.clockOn && handN < 2;
        const i = this.pieces.length;
        let cell: Rect, label: string;
        if (isHand) { const len = handN === 0 ? 34 : 46; cell = { x: 0, y: 0, w: len + 18, h: 20 }; label = HAND_LABELS[handN]!; }
        else { cell = this.cells[order[meN % order.length]!]!; label = LABELS[meN % LABELS.length]!; meN++; }
        const side: -1 | 1 = isHand ? 1 : (sideN++ % 2 === 0 ? 1 : -1);
        const n = parkN[side]!++;
        const s = Math.min(isHand ? 1.2 : 0.5, PARK_W / cell.w);
        const park = { x: side < 0 ? 16 + (cell.w * s) / 2 : W - 16 - (cell.w * s) / 2, y: 520 + n * 96, s };
        this.pieces.push({ kind: isHand ? 'hand' : 'me', cell, hand: isHand ? (handN++ as 0 | 1) : undefined, label, tc, land: Infinity, side, park, slot: { x: 0, y: 0, s: 1, rot: 0 }, rot: (hash(i, 31) - 0.5) * 0.12 });
      }
    });
    // landings: the first kick from "I'm carrying…" on that is at least 0.4 s after the piece's cut
    for (const p of this.pieces) p.land = this.kicks.find((k) => k >= this.weightStart - 0.05 && k > p.tc + 0.4) ?? Infinity;
    const landed = this.pieces.filter((p) => p.land < Infinity).sort((a, b) => a.land - b.land || a.tc - b.tc);
    landed.forEach((p, s) => {
      const row = Math.floor(s / 4), col = s % 4;
      const sc = Math.min(p.kind === 'hand' ? 1.1 : 0.45, PILE_W / p.cell.w);
      const r = mulberry32(100 + s);
      p.slot = { x: W / 2 + (col - 1.5) * 86 + (r() - 0.5) * 14 + (row % 2) * 18, y: -24 - row * 42 - (r() - 0.5) * 6, s: sc, rot: (r() - 0.5) * 0.14 };
    });
    const firstLand = landed[0]?.land ?? Infinity;
    this.sinkKicks = this.kicks.filter((k) => k >= firstLand - 0.01);
  }

  /** ME rendered once (bone, at SCALE), and its ink box partitioned into 12 cells + the sliver. */
  private buildMe() {
    const fam = ME_FAM;
    const probe = document.createElement('canvas').getContext('2d')!;
    probe.font = font(fam, 100);
    const m = probe.measureText('ME');
    const cap = (m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) / 100;
    const inkW = (m.actualBoundingBoxLeft + m.actualBoundingBoxRight) / 100;
    const size = Math.min((ME_BOT - ME_TOP) / cap, (SAFE.x1 - SAFE.x0) / inkW);
    this.meSize = size;
    const iw = inkW * size, ih = cap * size;
    const x0 = W / 2 - iw / 2, y0 = ME_BOT - ih;
    this.meX = x0 + m.actualBoundingBoxLeft / 100 * size;
    const cv = document.createElement('canvas');
    cv.width = W * SCALE; cv.height = (ME_BOT + 40) * SCALE;
    const c = cv.getContext('2d')!;
    c.scale(SCALE, SCALE);
    c.font = font(fam, size);
    c.fillStyle = rgba('bone', 0.93);
    c.fillText('ME', this.meX, ME_BOT - (m.actualBoundingBoxDescent / 100) * size);
    this.me = cv;
    // cells: a thin left sliver, then 4 columns × 3 rows with per-column jittered row splits
    const pad = 6;
    const X0 = x0 - pad, X1 = x0 + iw + pad, Y0 = y0 - pad, Y1 = ME_BOT + pad;
    const cols = [0, 0.062, 0.3, 0.53, 0.77, 1].map((u) => lerp(X0, X1, u));
    this.sliver = { x: cols[0]!, y: Y0, w: cols[1]! - cols[0]!, h: Y1 - Y0 };
    const r = mulberry32(17);
    for (let ci = 1; ci < 5; ci++) {
      const a = lerp(0.28, 0.42, r()), b = lerp(0.6, 0.74, r());
      const ys = [0, a, b, 1].map((u) => lerp(Y0, Y1, u));
      for (let ri = 0; ri < 3; ri++) this.cells.push({ x: cols[ci]!, y: ys[ri]!, w: cols[ci + 1]! - cols[ci]!, h: ys[ri + 1]! - ys[ri]! });
    }
  }

  /** The sung lines: one row each on the wall above ME; L4 without "mine" (that one goes below the seam). */
  private buildRows(lines: Line[]) {
    const style: [number, number][] = [[62.5, 800], [62.5, 800], [62.5, 900], [87.5, 500]];
    lines.forEach((line, i) => {
      const words = i === 3 ? line.words.slice(0, -1) : line.words;
      const [wd, wt] = style[i]!;
      const fam = F.archivo(wd, wt);
      const text = words.map((w) => w.w).join(' ');
      const size = Math.min(96, fitSize(text, fam, SAFE.x1 - SAFE.x0));
      const space = measure(' ', fam, size);
      let x = W / 2 - measure(text, fam, size) / 2;
      const placed = words.map((w) => { const p = { w, x }; x += measure(w.w, fam, size) + space; return p; });
      this.rows.push({ line, words: placed, fam, size, show: i === 0 ? line.start - 0.4 : line.start - 0.12 });
    });
  }

  private cutsBy(t: number) { return this.pieces.filter((p) => p.tc <= t).length; }

  /** The slab's sink below its resting place (px): a step on every landing kick. */
  private sink(t: number) {
    let s = 0;
    for (const k of this.sinkKicks) s += 2.2 * ease.outCubic(clamp((t - k) / 0.12));
    return s;
  }

  /** A piece's pose at t (centre, scale, rotation) or null before its cut. */
  private pose(p: Piece, t: number) {
    const home = this.homePose(p, t);
    if (t < p.tc) return home;
    const slabTop = SEAM_Y - SLAB.h + this.sink(t);
    const slot = { x: p.slot.x, y: slabTop + p.slot.y, s: p.slot.s, rot: p.slot.rot };
    const park = { ...p.park, rot: p.rot };
    const direct = p.land - p.tc < 0.9;
    if (direct) { // straight from the cut onto the pile: out and up, then down onto it on the kick
      const u = clamp((t - p.tc) / (p.land - p.tc));
      const ux = ease.inOutCubic(u);
      const lift = Math.sin(Math.PI * Math.min(1, u * 1.15)) * 90;
      const y = lerp(home.y, slot.y, ease.inQuad(u)) - lift;
      return { x: lerp(home.x, slot.x, ux) + p.side * Math.sin(Math.PI * u) * 120, y, s: lerp(home.s, slot.s, ease.outCubic(u)), rot: lerp(home.rot, slot.rot, u) };
    }
    const a = ease.outExpo(clamp((t - p.tc) / 0.45));
    let q = { x: lerp(home.x, park.x, a), y: lerp(home.y, park.y, a), s: lerp(home.s, park.s, a), rot: lerp(home.rot, park.rot, a) };
    const f0 = p.land - 0.34;
    if (t >= f0) {
      const u = clamp((t - f0) / (p.land - f0));
      q = { x: lerp(q.x, slot.x, ease.inOutCubic(u)), y: lerp(q.y, slot.y, ease.inQuad(u)), s: lerp(q.s, slot.s, u), rot: lerp(q.rot, slot.rot, u) };
    }
    return q;
  }

  /** Where a piece sits before it is cut: ME cells in ME; hands on the clock face (rotated to the time). */
  private homePose(p: Piece, t: number) {
    if (p.kind === 'me') return { x: p.cell.x + p.cell.w / 2, y: p.cell.y + p.cell.h / 2, s: 1, rot: 0 };
    const sec = this.clockBase + Math.max(0, t - this.clockOn);
    const ang = p.hand === 0 ? ((sec / 3600) % 12) / 12 * TAU : ((sec / 60) % 60) / 60 * TAU;
    const len = p.cell.w - 18;
    const a = ang - Math.PI / 2;
    return { x: FACE.x + Math.cos(a) * len / 2, y: FACE.y + Math.sin(a) * len / 2, s: 1, rot: a };
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer } = this.ctx;
    const t = f.t;
    const c = this.layer.ctx;
    this.layer.clear();
    roomLight2D(c, SEAM_Y, { intensity: 0.85 });

    this.drawClock(c, t);
    this.drawRows(c, t);
    this.drawMe(c, t);
    this.drawSlab(c, t);
    // pieces: parked/flying ones over everything; piled ones in landing order (later on top)
    const ps = [...this.pieces].sort((a, b) => (Math.min(a.land, 99) - Math.min(b.land, 99)) || a.tc - b.tc);
    for (const p of ps) if (t >= p.tc) this.drawPiece(c, p, t);
    this.drawAsks(c, t);
    this.drawMine(c, t);

    clearRT(renderer, out, LIN.ink);
    this.ctx.comp.draw(renderer, this.layer.upload(), out);
    this.lb.clear();
    seam(this.lb, SEAM_Y, { width: HAIR });
    this.lb.render(renderer, out);
    return {};
  }

  // ------------------------------------------------------------------------------------------- ME
  private drawMe(c: CanvasRenderingContext2D, t: number) {
    // a soft jolt on each cut (the knife going through), about ME's centre; ME only, not the room
    let j = 0;
    for (const k of this.cutTimes) j += pulse(t, k, 0.08);
    const jx = Math.sin(t * 90) * 3 * Math.min(1, j);
    const S = SCALE;
    // the uncut cells as one clip path (one draw: no hairline seams between neighbouring cells)
    c.save();
    c.beginPath();
    const add = (r: Rect) => c.rect(r.x + jx, r.y, r.w, r.h);
    add(this.sliver);
    for (const cell of this.cells) { const p = this.pieces.find((q) => q.kind === 'me' && q.cell === cell); if (!p || t < p.tc) add(cell); }
    c.clip();
    c.drawImage(this.me, 0, 0, this.me.width, this.me.height, jx, 0, this.me.width / S, this.me.height / S);
    c.restore();
    for (const cell of this.cells) {
      const p = this.pieces.find((q) => q.kind === 'me' && q.cell === cell);
      if (!p || t < p.tc) continue;
      else { // the hole: a lamp hairline cut that cools to a dust scar
        const k = smoothstep(p.tc, p.tc + 0.5, t);
        c.save();
        c.lineWidth = HAIR;
        c.strokeStyle = k < 1 ? rgba('lamp', 0.9 * (1 - k)) : 'rgba(0,0,0,0)';
        c.strokeRect(cell.x + jx + 0.5, cell.y + 0.5, cell.w - 1, cell.h - 1);
        c.strokeStyle = rgba('dust', 0.2 * k);
        c.strokeRect(cell.x + jx + 0.5, cell.y + 0.5, cell.w - 1, cell.h - 1);
        c.restore();
      }
    }
  }

  // ---------------------------------------------------------------------------------------- pieces
  private drawPiece(c: CanvasRenderingContext2D, p: Piece, t: number) {
    const q = this.pose(p, t);
    const { w, h } = p.cell;
    const fresh = 1 - smoothstep(p.tc, p.tc + 0.4, t); // the cut edge is hot for a moment
    c.save();
    c.translate(q.x, q.y); c.rotate(q.rot); c.scale(q.s, q.s);
    if (p.kind === 'me') {
      const S = SCALE, r = p.cell;
      c.drawImage(this.me, r.x * S, r.y * S, r.w * S, r.h * S, -w / 2, -h / 2, w, h);
    } else {
      c.fillStyle = rgba('bone', 0.9);
      c.fillRect(-w / 2 + 9, -2.5, w - 18, 5);
    }
    c.lineWidth = HAIR / q.s;
    c.strokeStyle = rgba('bone', 0.75);
    c.strokeRect(-w / 2, -h / 2, w, h);
    if (fresh > 0) { c.strokeStyle = rgba('lamp', 0.9 * fresh); c.strokeRect(-w / 2, -h / 2, w, h); }
    // the label: mono, on an ink tag under the piece; it fades in as the piece leaves ME
    const la = smoothstep(p.tc + 0.08, p.tc + 0.3, t);
    if (la > 0) {
      const onPile = p.land < Infinity ? smoothstep(p.land - 0.34, p.land, t) : 0;
      const px = lerp(18, 12, onPile) / q.s;
      c.font = font(F.mono(500), px);
      const tw = c.measureText(p.label).width;
      const tx = p.side < 0 || onPile > 0.5 ? -w / 2 : w / 2 - tw - px * 0.5;
      const ty = h / 2 + px * 0.2;
      c.fillStyle = rgba('ink', 0.85 * la);
      c.fillRect(tx, ty, tw + px * 0.5, px * 1.25);
      c.fillStyle = rgba('bone', 0.88 * la);
      c.textBaseline = 'top';
      c.fillText(p.label, tx + px * 0.25, ty + px * 0.14);
    }
    c.restore();
  }

  // ------------------------------------------------------------------------------------------ slab
  private drawSlab(c: CanvasRenderingContext2D, t: number) {
    const s = this.sink(t);
    c.save();
    c.beginPath(); c.rect(0, 0, W, SEAM_Y); c.clip(); // it sinks into the seam: the floor hides its foot
    slab2D(c, SLAB_X, SEAM_Y - SLAB.h + s, SLAB.w, SLAB.h, { lit: 0.6 });
    c.restore();
  }

  // ----------------------------------------------------------------------------------------- clock
  private drawClock(c: CanvasRenderingContext2D, t: number) {
    if (t < this.clockOn) return;
    const dim = lerp(1, 0.55, smoothstep(this.weightStart, this.weightStart + 0.6, t));
    drawClock2D(c, this.clockBase + Math.max(0, t - this.clockOn), { alpha: 0.9 * dim });
    c.save();
    c.strokeStyle = rgba('dust', 0.75 * dim);
    c.lineWidth = HAIR;
    c.beginPath(); c.arc(FACE.x, FACE.y, FACE.r, 0, TAU); c.stroke();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU, r0 = FACE.r - (i % 3 === 0 ? 9 : 5);
      c.beginPath(); c.moveTo(FACE.x + Math.cos(a) * r0, FACE.y + Math.sin(a) * r0); c.lineTo(FACE.x + Math.cos(a) * (FACE.r - 2), FACE.y + Math.sin(a) * (FACE.r - 2)); c.stroke();
    }
    // the hands, while they are still on it
    for (const p of this.pieces) {
      if (p.kind !== 'hand' || t >= p.tc) continue;
      const q = this.homePose(p, t), len = p.cell.w - 18;
      c.save(); c.translate(q.x, q.y); c.rotate(q.rot);
      c.fillStyle = rgba('bone', 0.9 * dim);
      c.fillRect(-len / 2, -2.5, len, 5);
      c.restore();
    }
    c.fillStyle = rgba('bone', 0.9 * dim);
    c.beginPath(); c.arc(FACE.x, FACE.y, 3.5, 0, TAU); c.fill();
    c.restore();
  }

  // ------------------------------------------------------------------------------------------ ASKS
  private drawAsks(c: CanvasRenderingContext2D, t: number) {
    const n = this.cutsBy(t);
    const last = [...this.cutTimes].reverse().find((k) => k <= t);
    const hot = last !== undefined ? 1 - smoothstep(last, last + 0.35, t) : 0;
    const jump = last !== undefined ? this.pieces.filter((p) => p.tc === last).length : 0;
    c.save();
    c.font = font(F.mono(500), ASKS.size);
    c.textBaseline = 'alphabetic';
    c.fillStyle = rgba('dust', 0.9);
    c.fillText('ASKS', ASKS.x, ASKS.y);
    const nx = ASKS.x + measure('ASKS ', F.mono(500), ASKS.size);
    const num = String(n).padStart(2, '0');
    c.fillStyle = rgba('bone', 0.92);
    c.fillText(num, nx, ASKS.y);
    if (hot > 0) { c.fillStyle = rgba('lamp', hot); c.fillText(num, nx, ASKS.y); }
    if (jump > 1 && hot > 0) { // a deadpan footnote when two go at once
      c.font = font(F.mono(400), 18);
      c.fillStyle = rgba('dust', 0.85 * Math.min(1, hot * 2));
      c.fillText(`+${jump}`, nx + measure(num, F.mono(500), ASKS.size) + 10, ASKS.y - 14);
    }
    c.restore();
  }

  // ----------------------------------------------------------------------------------------- lyrics
  private drawRows(c: CanvasRenderingContext2D, t: number) {
    const i = this.rows.findIndex((r, k) => t >= r.show && (k === this.rows.length - 1 || t < this.rows[k + 1]!.show));
    if (i < 0) return;
    const row = this.rows[i]!;
    const fin = smoothstep(row.show, row.show + 0.1, t);
    // "weight": the row presses down a few px with the slab; the last row is set loose and light
    const dy = i >= 2 ? this.sink(t) * 0.6 : 0;
    c.save();
    c.font = font(row.fam, row.size);
    c.textBaseline = 'alphabetic';
    for (const pw of row.words) drawWord(c, pw.w, pw.x, BAND_Y + dy, row.fam, row.size, t, fin);
    c.restore();
  }

  /** "mine": tiny, mono, lower-case, below the seam where nobody looks. */
  private drawMine(c: CanvasRenderingContext2D, t: number) {
    const w = this.mine;
    if (t < w.start - 0.4) return;
    c.save();
    c.font = font(F.mono(400), MINE.size);
    c.textBaseline = 'alphabetic';
    const text = plain(w.w).toLowerCase();
    drawWord(c, { ...w, w: text }, MINE.x, MINE.y, F.mono(400), MINE.size, t, smoothstep(w.start - 0.4, w.start - 0.25, t), 0.8);
    c.restore();
  }
}

/** One word: dim (bone 32 %) before it is sung, lamp glyph by glyph while sung (never early), then bone. */
function drawWord(c: CanvasRenderingContext2D, w: Word, x: number, y: number, fam: string, size: number, t: number, alpha: number, sung = 0.95) {
  const L = layout(w.w, fam, size);
  const p = Lyrics.wordProgress(w, t);
  const n = L.glyphs.length;
  const singing = t >= w.start && t < w.end;
  for (const g of L.glyphs) {
    const k = singing ? clamp(p * n - g.i) : 0;
    const base = t >= w.end ? sung : 0.32;
    if (k < 1) { c.fillStyle = rgba('bone', base * alpha * (1 - k)); c.fillText(g.ch, x + g.x, y); }
    if (k > 0) { c.fillStyle = rgba('lamp', k * alpha); c.fillText(g.ch, x + g.x, y); }
  }
}
