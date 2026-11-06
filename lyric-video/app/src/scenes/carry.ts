// Plate 14 `carry` — the bridge: "Maybe I'm tired of carrying … Where the world doesn't ask for me"
// (docs/TREATMENT-drift.md). Back on the floor after chorus 2's last *drift*: the room again, close.
//  - One camera for the whole plate, always a zoom about a point ON the seam (the seam stays at y = SEAM_Y).
//    It opens close on the slab ("bigger than before": we are nearer it), drifts back slowly over the
//    quiet bars, pulls back over "Everything everybody needs" and lands on the downbeat of "Maybe I don't
//    need fixing" on `silence`'s first framing (zoom 1.06 about (760, SEAM_Y)). Then it stops: the first
//    still camera since `voicemail`, held to the cut.
//  - "Maybe I'm tired of carrying": the line rests on top of the slab, carried.
//  - "Things nobody else can see": the slab carries handwritten labels that are invisible (bone on bone,
//    a few per cent), readable only where the overhead lamp, swinging, sweeps its pool across the slab:
//    rent, her, the call I didn't make, dad, Monday, being fine.
//  - "Maybe I'm tired of being / Everything everybody needs": the pieces of ME from `pieces` (same cells,
//    same mono tags) come back in from the frame edges, two per beat, and try to reassemble on the slab's
//    face. Every one lands in the wrong slot; on the beats they try to shuffle to where they belong and
//    spring back. They do not fit.
//  - "Maybe I don't need fixing / Maybe I just need peace": the one Cormorant italic line of the video,
//    bone, centred on the wall above the seam, sung glyph by glyph in bone (no lamp, no bloom). The pieces
//    stop trying; on *peace* they are let go (they fade). The cracks from `scars` stay in the slab.
//  - "Maybe I just need one night / Where the world doesn't ask for me": the world arrives anyway, one ask
//    per kick, in `silence`'s positions: the phone lights up on the floor, the bubbles on the wall, the
//    certificates, the reply field with `I'm good`. ASKS appears in mono on the seam (40), ticks ONCE to 41
//    on "world", then its cursor blinks and it does not tick again. The last frame is `silence`'s first.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { clearRT, Layer2D, SCALE, W, H } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { Lyrics, type Line, type Word } from '../engine/lyrics';
import { LIN, rgba } from '../engine/palette';
import { F, font, layout, measure, plain, smart, type TextLayout } from '../engine/type';
import { drawStrokeText, strokeText, type StrokeText } from '../engine/stroke';
import { clamp, ease, frameIdx, hash, keys, lerp, mulberry32, pulse, smoothstep, TAU } from '../engine/util';
import { HAIR, roomLight2D, SAFE, seam, SEAM_Y, SLAB, slab2D } from './_motifs';

type RGB = [number, number, number];
const mul = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];

// ------------------------------------------------------------------ the room (world coords = `silence`'s)
const END_CAM = { cx: 760, z: 1.06 }; // `silence` shot 1
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

// --------------------------------------------------------------- the invisible labels (handwritten)
const LABELS = [
  { text: 'rent', x: 386, y: 1056, rot: -0.05 },
  { text: 'her', x: 612, y: 1048, rot: 0.04 },
  { text: "the call I didn't make", x: 398, y: 1112, rot: -0.02 },
  { text: 'dad', x: 652, y: 1150, rot: 0.06 },
  { text: 'Monday', x: 384, y: 1180, rot: 0.03 },
  { text: 'being fine', x: 520, y: 1214, rot: -0.03 },
];
const LABEL_SIZE = 30;

// ------------------------------------------------------------------------ the pieces of ME (plate 3)
const ME_FAM = F.archivo(125, 900);
const ME_TOP = 470, ME_BOT = 830; // as in `pieces`
const ME_LABELS = ['WORK', 'TEAM', 'BILLS', 'MOM', 'FRIENDS', 'CHURCH', 'HOA', 'TAXES', 'TEXTS', 'GROUP CHAT', 'LANDLORD', 'DENTIST 2:15'];
const HAND_LABELS = ['MEETING 9:00', 'GOT A MINUTE?'];
const CUT_ORDER = [11, 2, 7, 3, 9, 0, 8, 4, 10, 1, 5, 6]; // `pieces`' cut order: cell CUT_ORDER[j] wore ME_LABELS[j]
const WRONG = [3, 7, 0, 10, 1, 8, 11, 2, 5, 4, 6, 9]; // cell i lands in cell WRONG[i]'s slot (no fixed points)
const FLY = 0.55; // flight time in from the frame edge (lands on the beat)

type Rect = { x: number; y: number; w: number; h: number };
interface Piece {
  kind: 'me' | 'hand';
  cell: Rect; // at ME scale (plate 3 coordinates); hands: their own box
  label: string;
  land: number;
  side: -1 | 1;
  lane: number;
  right: { x: number; y: number }; // where it belongs (world)
  wrong: { x: number; y: number; rot: number }; // where it lands (world)
  s: number; // world scale
  tries: number[]; // beats on which it tries to move to where it belongs
}

interface RowW { w: Word; x: number; L: TextLayout }
interface Row { line: Line; words: RowW[]; fam: string; size: number; y: number; show: number; hide: number; serif: boolean; width: number; cx: number }

export default class Carry extends Scene {
  private layer = new Layer2D();
  private lb = new LineBatch(256, { screen2D: true, blend: 'add' });
  private mask!: HTMLCanvasElement; // the lamp's reveal of the invisible labels (offscreen, at SCALE)
  private mctx!: CanvasRenderingContext2D;
  private me!: HTMLCanvasElement;
  private meMap = { s: 1, cx: 0, cy: 0 };
  private cells: Rect[] = [];
  private sliver!: Rect;
  private pieces: Piece[] = [];
  private labels: { st: StrokeText; x: number; y: number; rot: number }[] = [];
  private cracks: { x: number; y: number }[][] = [];
  private rows: Row[] = [];
  private db: number[] = []; // downbeats in the window
  private lines: Line[] = [];
  private beamT = { on: 0, a: 0, b: 0, off: 0 };
  private calm = 0; // the camera lands: "Maybe I don't need fixing"
  private peace!: Word;
  private arrive: number[] = []; // the asks: phone, bubble 0, bubble 1, cert 0, bubble 2, bubble 3, field, cert 1
  private asksOn = 0;
  private tick = 0;
  private ringD = 0; // `silence`'s "No" (the phone's ring phase)
  private bubW: number[] = [];

  override init() {
    const { lyrics, audio, start, end } = this.ctx;
    this.lines = lyrics.lines.filter((l) => l.start >= start - 0.05 && l.start < end);
    if (this.lines.length !== 8) console.warn(`carry: expected 8 lines, found ${this.lines.length}`);
    const L = (s: string) => this.lines.find((l) => l.text.toLowerCase().replace(/’/g, "'").includes(s.toLowerCase()))!;
    const lA = L('tired of carrying'), lB = L('nobody else'), lC1 = L('tired of being'), lC2 = L('everybody needs');
    const lD1 = L("don't need fixing"), lD2 = L('need peace'), lE1 = L('one night'), lE2 = L('ask for me');
    this.db = audio.downbeats.filter((d) => d >= start - 0.05 && d < end - 0.05);
    while (this.db.length < 8) this.db.push(audio.timeOfBeat(Math.round(audio.beatAt(this.db[this.db.length - 1]!)) + 4));
    // the camera lands on the downbeat at (or just before) "Maybe I don't need fixing"
    this.calm = this.db.reduce((b, d) => (d <= lD1.start + 0.05 ? d : b), this.db[0]!);
    this.peace = lD2.words[lD2.words.length - 1]!;
    this.ringD = lyrics.get('No phone ringing').words[0]!.start;

    // the lamp's sweep: in on the downbeat before "Things", across the slab over the line, back and out
    const dB = this.db.reduce((b, d) => (d <= lB.start + 0.05 ? d : b), this.db[0]!);
    this.beamT = { on: dB, a: lB.start - 0.2, b: lB.end, off: lC1.start + 0.9 };

    // the asks: one per kick from "one night" to the cut (beats fill in if the kicks run short)
    const kicks = audio.events('kick', lE1.start, end - 0.1).map(([k]) => k);
    const beats: number[] = [];
    for (let b = Math.ceil(audio.beatAt(lE1.start)); audio.timeOfBeat(b) < end - 0.1; b++) beats.push(audio.timeOfBeat(b));
    const pool = kicks.length >= 8 ? kicks : [...new Set([...kicks, ...beats])].sort((a, b) => a - b);
    this.arrive = Array.from({ length: 8 }, (_, i) => pool[Math.round((i * (pool.length - 1)) / 7)] ?? end - 0.2);
    this.asksOn = this.arrive[0]!;
    const world = lE2.words.find((w) => /world/i.test(w.w))!;
    this.tick = kicks.find((k) => k >= world.start - 0.15) ?? world.start;

    this.buildRows({ lA, lB, lC1, lC2, lD1, lD2, lE1, lE2 });
    this.buildMe();
    this.buildPieces(lC1);
    this.buildSlabMarks();
    this.mask = document.createElement('canvas');
    this.mask.width = W * SCALE; this.mask.height = H * SCALE;
    this.mctx = this.mask.getContext('2d')!;
    this.bubW = BUBBLES.map((b) => measure(b.text, F.mono(400), BUB_SIZE) + 40);
  }

  // ------------------------------------------------------------------------------------- camera
  /** Zoom z about (cx, SEAM_Y). */
  private cam(t: number) {
    const d0 = this.db[0]!, d3 = this.db[3]!, c = this.calm;
    const z = keys(t, [[d0, 1.86], [d0 + 0.6, 1.8, ease.outCubic], [d3, 1.5, ease.linear], [c, END_CAM.z, ease.inOutCubic]]);
    const cx = keys(t, [[d0, 520], [d0 + 0.6, 520, ease.outCubic], [d3, 600, ease.linear], [c, END_CAM.cx, ease.inOutCubic]]);
    return { z, cx };
  }
  private toWorld(sx: number, sy: number, t: number) {
    const { z, cx } = this.cam(t);
    return { x: cx + (sx - cx) / z, y: SEAM_Y + (sy - SEAM_Y) / z, z };
  }

  // ----------------------------------------------------------------------------------- the lyric
  private buildRows(l: Record<string, Line>) {
    const mk = (line: Line, fam: string, o: { sy?: number; wy?: number; sw: number; cap: number; tref: number; show?: number; hide: number; serif?: boolean; tr?: number }) => {
      const { z, cx } = this.cam(o.tref);
      const trEm = o.tr ?? 0.01;
      // size: fit the screen width `sw` at the reference time (world size = screen size / z)
      const s100 = measure(line.text, fam, 100, trEm * 100);
      const size = Math.min(o.cap, (100 * o.sw) / s100) / z;
      const tr = trEm * size;
      const space = measure(' ', fam, size) + tr;
      let x = 0;
      const words: RowW[] = line.words.map((w) => { const Lw = layout(w.w, fam, size, tr); const r = { w, x, L: Lw }; x += Lw.width + space; return r; });
      const width = x - space;
      const wcx = cx + (540 - cx) / z;
      for (const r of words) r.x += wcx - width / 2;
      const y = o.wy ?? SEAM_Y + (o.sy! - SEAM_Y) / z;
      const row: Row = { line, words, fam, size, y, show: o.show ?? line.start - 0.4, hide: o.hide, serif: !!o.serif, width, cx: wcx };
      this.rows.push(row);
      return row;
    };
    const { lA, lB, lC1, lC2, lD1, lD2, lE1, lE2 } = l as Record<string, Line>;
    const hideC = lD1!.start + 0.02;
    mk(lA!, F.archivo(87.5, 700), { wy: SLAB_Y - 7, sw: 800, cap: 104, tref: lA!.start, show: Math.max(this.ctx.start, lA!.start - 0.4), hide: lA!.end + 0.06 });
    mk(lB!, F.archivo(100, 500), { sy: 640, sw: 800, cap: 96, tref: lB!.start, hide: lB!.end + 0.02 });
    mk(lC1!, F.archivo(87.5, 600), { sy: 600, sw: 780, cap: 96, tref: lC1!.start, hide: hideC });
    mk(lC2!, F.archivo(62.5, 900), { sy: 760, sw: 820, cap: 150, tref: lC1!.start, hide: hideC, tr: 0 });
    // the sacred voice: Cormorant italic, bone, centred on the wall above the seam (the camera is still)
    const serif = F.serif(400, true);
    const hideD = lE1!.start - 0.36;
    mk(lD1!, serif, { sy: 600, sw: 800, cap: 92, tref: lD1!.start, hide: hideD, serif: true, tr: 0 });
    mk(lD2!, serif, { sy: 704, sw: 800, cap: 92, tref: lD1!.start, hide: hideD, serif: true, tr: 0 });
    // the last two lines in `silence`'s rows (world y 800 and 930), the size it sets its lines at
    mk(lE1!, F.archivo(100, 600), { wy: 800, sw: 740 * END_CAM.z, cap: 84 * END_CAM.z, tref: this.ctx.end, hide: 1e9 });
    mk(lE2!, F.archivo(100, 600), { wy: 930, sw: 740 * END_CAM.z, cap: 84 * END_CAM.z, tref: this.ctx.end, hide: 1e9 });
    // QA: every row inside the title-safe area while it is on screen
    for (const r of this.rows) {
      const t1 = Math.min(r.hide, this.ctx.end - 0.01);
      for (let i = 0; i <= 8; i++) {
        const t = lerp(Math.max(r.show, this.ctx.start), t1, i / 8);
        const { z, cx } = this.cam(t);
        const xa = cx + z * (r.cx - r.width / 2 - cx), xb = cx + z * (r.cx + r.width / 2 - cx);
        const top = SEAM_Y + z * (r.y - r.size * 0.75 - SEAM_Y), bot = SEAM_Y + z * (r.y + r.size * 0.25 - SEAM_Y);
        if (xa < SAFE.x0 - 0.5 || xb > SAFE.x1 + 0.5 || top < SAFE.y0 || bot > SAFE.y1)
          console.warn(`carry: "${r.line.text}" outside the safe area at ${t.toFixed(2)}: x ${xa.toFixed(0)}–${xb.toFixed(0)}, y ${top.toFixed(0)}–${bot.toFixed(0)}`);
      }
    }
  }

  // ---------------------------------------------------------------------------------------- ME
  /** ME exactly as `pieces` renders it (bone, at SCALE), and the same 12 cells + sliver. */
  private buildMe() {
    const fam = ME_FAM;
    const probe = document.createElement('canvas').getContext('2d')!;
    probe.font = font(fam, 100);
    const m = probe.measureText('ME');
    const cap = (m.actualBoundingBoxAscent + m.actualBoundingBoxDescent) / 100;
    const inkW = (m.actualBoundingBoxLeft + m.actualBoundingBoxRight) / 100;
    const size = Math.min((ME_BOT - ME_TOP) / cap, (SAFE.x1 - SAFE.x0) / inkW);
    const iw = inkW * size, ih = cap * size;
    const x0 = W / 2 - iw / 2, y0 = ME_BOT - ih;
    const meX = x0 + (m.actualBoundingBoxLeft / 100) * size;
    const cv = document.createElement('canvas');
    cv.width = W * SCALE; cv.height = (ME_BOT + 40) * SCALE;
    const c = cv.getContext('2d')!;
    c.scale(SCALE, SCALE);
    c.font = font(fam, size);
    c.fillStyle = rgba('bone', 0.93);
    c.fillText('ME', meX, ME_BOT - (m.actualBoundingBoxDescent / 100) * size);
    this.me = cv;
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
    // ME on the slab's face: fit inside it with a margin
    const s = Math.min((SLAB.w - 44) / (X1 - X0), (SLAB.h - 52) / (Y1 - Y0));
    this.meMap = { s, cx: (X0 + X1) / 2, cy: (Y0 + Y1) / 2 };
  }
  private onSlab(x: number, y: number) {
    const m = this.meMap;
    return { x: 540 + m.s * (x - m.cx), y: SLAB_Y + SLAB.h / 2 - 4 + m.s * (y - m.cy) };
  }

  private buildPieces(lC1: Line) {
    const A = this.ctx.audio;
    const b0 = Math.ceil(A.beatAt(lC1.start - 0.08));
    const seq: ('me' | 0 | 1)[] = ['me', 'me', 'me', 'me', 'me', 0, 'me', 'me', 'me', 'me', 'me', 1, 'me', 'me'];
    let j = 0;
    const lanes = { [-1]: 0, [1]: 0 } as Record<number, number>;
    seq.forEach((k, i) => {
      const land = A.timeOfBeat(b0 + Math.floor(i / 2));
      const side: -1 | 1 = i % 2 === 0 ? -1 : 1;
      const lane = lanes[side]!++;
      const rr = mulberry32(300 + i);
      let p: Piece;
      if (k === 'me') {
        const ci = CUT_ORDER[j]!, cell = this.cells[ci]!, wc = this.cells[WRONG[ci]!]!;
        const right = this.onSlab(cell.x + cell.w / 2, cell.y + cell.h / 2);
        const w0 = this.onSlab(wc.x + wc.w / 2, wc.y + wc.h / 2);
        p = { kind: 'me', cell, label: ME_LABELS[j]!, land, side, lane, right, wrong: { x: w0.x + (rr() - 0.5) * 14, y: w0.y + (rr() - 0.5) * 10, rot: (rr() - 0.5) * 0.22 }, s: this.meMap.s, tries: [] };
        j++;
      } else {
        const len = k === 0 ? 34 : 46;
        const cell = { x: 0, y: 0, w: len + 18, h: 20 };
        const at = k === 0 ? { x: 486, y: 1092, rot: 0.62 } : { x: 604, y: 1168, rot: -0.34 };
        p = { kind: 'hand', cell, label: HAND_LABELS[k]!, land, side, lane, right: { x: 540, y: SLAB_Y - 60 }, wrong: at, s: 1, tries: [] };
      }
      // the tries: some of the beats after landing, until the camera lands (then they stop trying)
      for (let b = Math.round(A.beatAt(land)) + 1; A.timeOfBeat(b) < this.calm - 0.1; b++) if (hash(i, b, 7) < 0.55) p.tries.push(A.timeOfBeat(b));
      this.pieces.push(p);
    });
  }

  /** The cracks (from `scars`, never repaired) and the invisible handwritten labels. */
  private buildSlabMarks() {
    const r = mulberry32(1414);
    const starts = [[372, 1030, 0.5], [710, 1050, 2.6], [560, 1012, 1.7], [420, 1236, -1.2], [690, 1232, -2.2], [362, 1150, 0.1]] as const;
    for (const [x0, y0, a0] of starts) {
      const pts: { x: number; y: number }[] = [{ x: x0, y: y0 }];
      let a: number = a0, x: number = x0, y: number = y0;
      const n = 6 + Math.floor(r() * 5);
      for (let i = 0; i < n; i++) {
        a += (r() - 0.5) * 0.9;
        const step = 9 + r() * 16;
        x = clamp(x + Math.cos(a) * step, SLAB_X + 3, SLAB_X + SLAB.w - 3);
        y = clamp(y + Math.sin(a) * step, SLAB_Y + 3, SEAM_Y - 3);
        pts.push({ x, y });
      }
      this.cracks.push(pts);
      if (r() < 0.6) { // a short branch
        const k = 2 + Math.floor(r() * (pts.length - 3));
        const b: { x: number; y: number }[] = [{ ...pts[k]! }];
        let ba = a0 + (r() < 0.5 ? 0.9 : -0.9), bx = pts[k]!.x, by = pts[k]!.y;
        for (let i = 0; i < 3; i++) { ba += (r() - 0.5) * 0.7; bx += Math.cos(ba) * 10; by += Math.sin(ba) * 10; b.push({ x: clamp(bx, SLAB_X + 3, SLAB_X + SLAB.w - 3), y: clamp(by, SLAB_Y + 3, SEAM_Y - 3) }); }
        this.cracks.push(b);
      }
    }
    for (const lb of LABELS) {
      const st = strokeText(smart(lb.text), 'script', LABEL_SIZE, 0.5);
      this.labels.push({ st, x: Math.min(lb.x, SLAB_X + SLAB.w - 14 - st.width), y: lb.y, rot: lb.rot });
    }
  }

  // ---------------------------------------------------------------------------------- lamp sweep
  private beam(t: number) {
    const B = this.beamT;
    const I = smoothstep(B.on, B.a + 0.3, t) * (1 - smoothstep(B.b + 0.2, B.off, t));
    const x = t < B.b ? keys(t, [[B.on, 330], [B.a, 350, ease.outQuad], [B.b, 742, (u) => 0.5 - 0.5 * Math.cos(Math.PI * u)]])
      : keys(t, [[B.b, 742], [B.off, 560, (u) => 0.5 - 0.5 * Math.cos(Math.PI * u)]]);
    return { I, x, y: 1128 };
  }

  // ------------------------------------------------------------------------------------ render
  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer } = this.ctx;
    const t = f.t;
    const { z, cx } = this.cam(t);
    const X = (x: number) => cx + z * (x - cx);
    const Y = (y: number) => SEAM_Y + z * (y - SEAM_Y);
    const bm = this.beam(t);

    const c = this.layer.ctx;
    this.layer.clear();
    c.save();
    c.translate(cx, SEAM_Y); c.scale(z, z); c.translate(-cx, -SEAM_Y);
    // the wall light: low over the bridge, swinging with the lamp; up to `silence`'s 0.6 as the world arrives
    const light = lerp(0.42, 0.6, smoothstep(this.arrive[0]! - 0.05, this.arrive[0]! + 0.5, t)) + 0.1 * bm.I;
    roomLight2D(c, SEAM_Y, { intensity: light, cx: lerp(540, bm.x, 0.6 * bm.I) });
    this.drawPhone(c, t);
    this.drawCerts(c, t);
    this.drawBubbles(c, t);
    this.drawField(c, t);
    // the slab, its cracks, the lamp's pool on it
    const atEnd = smoothstep(this.calm - 1.5, this.calm, t);
    slab2D(c, SLAB_X, SLAB_Y, SLAB.w, SLAB.h, { lit: lerp(0.45, 0.3, atEnd), alpha: 0.95 });
    this.drawCracks(c, z);
    if (bm.I > 0.001) this.drawPool(c, bm);
    c.restore();
    if (bm.I > 0.001) this.drawLabels(c, t, bm, z, cx);
    c.save();
    c.translate(cx, SEAM_Y); c.scale(z, z); c.translate(-cx, -SEAM_Y);
    for (const p of this.pieces) this.drawPiece(c, p, t, z);
    for (const r of this.rows) this.drawRow(c, r, t);
    this.drawAsks(c, t);
    c.restore();

    clearRT(renderer, out, LIN.ink);
    this.ctx.comp.draw(renderer, this.layer.upload(), out);
    const lb = this.lb;
    lb.clear();
    seam(lb, SEAM_Y, { width: HAIR });
    const g = this.phoneGlow(t);
    if (g > 0.001) lb.seg2(X(PHONE.x - 46), Y(PHONE.y), X(PHONE.x + 46), Y(PHONE.y), 30 * z, mul(LIN.lamp, 1.15 * g), 0.55);
    lb.render(renderer, out);
    // the world's arrival breathes the frame on the kicks (as `silence` does); before it, nothing shakes
    return { zoom: t >= this.arrive[0]! - 0.02 ? 1 + 0.005 * f.a.kick : 1, grain: 0.055 };
  }

  // -------------------------------------------------------------------------------- the slab marks
  private drawCracks(c: CanvasRenderingContext2D, z: number) {
    c.save();
    c.lineJoin = 'round'; c.lineCap = 'round';
    for (const pts of this.cracks) {
      const path = () => { c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); };
      c.translate(0, 1 / z); path(); c.strokeStyle = rgba('ink', 0.7); c.lineWidth = (HAIR * 1.4) / z; c.stroke(); c.translate(0, -1 / z);
      path(); c.strokeStyle = rgba('dust', 0.55); c.lineWidth = (HAIR * 1.1) / z; c.stroke();
    }
    c.restore();
  }

  /** The swinging lamp's pool on the slab and the wall around it (warm, soft, never a flare). */
  private drawPool(c: CanvasRenderingContext2D, bm: { I: number; x: number; y: number }) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.translate(bm.x, bm.y); c.scale(1, 0.8);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, 150);
    g.addColorStop(0, rgba('dust', 0.2 * bm.I));
    g.addColorStop(0.45, rgba('lamp', 0.08 * bm.I));
    g.addColorStop(1, rgba('lamp', 0));
    c.fillStyle = g;
    c.fillRect(-150, -150, 300, 300);
    c.restore();
  }

  /** The invisible labels: bone at a few per cent, read only inside the lamp's pool (masked offscreen). */
  private drawLabels(c: CanvasRenderingContext2D, t: number, bm: { I: number; x: number; y: number }, z: number, cx: number) {
    const m = this.mctx;
    m.setTransform(1, 0, 0, 1, 0, 0);
    m.globalCompositeOperation = 'source-over';
    m.clearRect(0, 0, this.mask.width, this.mask.height);
    m.setTransform(SCALE * z, 0, 0, SCALE * z, SCALE * (cx - z * cx), SCALE * (SEAM_Y - z * SEAM_Y));
    m.strokeStyle = rgba('bone', 0.95);
    m.lineWidth = 2.1;
    m.lineCap = 'round'; m.lineJoin = 'round';
    for (const lb of this.labels) {
      m.save();
      m.translate(lb.x, lb.y); m.rotate(lb.rot);
      drawStrokeText(m, lb.st, lb.st.total);
      m.restore();
    }
    m.globalCompositeOperation = 'destination-in';
    m.save();
    m.translate(bm.x, bm.y); m.scale(1, 0.8);
    const g = m.createRadialGradient(0, 0, 0, 0, 0, 140);
    g.addColorStop(0, `rgba(0,0,0,${0.9 * bm.I})`);
    g.addColorStop(0.55, `rgba(0,0,0,${0.62 * bm.I})`);
    g.addColorStop(1, `rgba(0,0,0,${0.035 * bm.I})`); // bone on bone: there, but nobody else can see it
    m.fillStyle = g;
    m.fillRect(-3000, -3000, 6000, 6000);
    m.restore();
    c.drawImage(this.mask, 0, 0, W, H);
    void t;
  }

  // ------------------------------------------------------------------------------------ pieces
  private pose(p: Piece, t: number) {
    const t0 = p.land - FLY;
    if (t < t0) return null;
    const a = 1 - smoothstep(this.peace.start, this.peace.end + 0.35, t);
    if (a <= 0) return null;
    // in from the frame edge, where `pieces` parked them
    const sx = p.side < 0 ? -110 : W + 110, sy = 500 + p.lane * 92;
    const st = this.toWorld(sx, sy, t);
    const u = clamp((t - t0) / FLY), e = ease.inOutCubic(u);
    let x = lerp(st.x, p.wrong.x, e), y = lerp(st.y, p.wrong.y, e) - Math.sin(Math.PI * u) * 60;
    let rot = lerp(p.side * 0.5, p.wrong.rot, e) + p.side * 0.1 * pulse(t, p.land, 0.08) * (u >= 1 ? 1 : 0);
    // the tries: part of the way to where it belongs, then it springs back (it does not fit)
    for (const b of p.tries) {
      const d = t - b;
      if (d < 0 || d > 0.46) continue;
      const k = Math.sin(Math.PI * ease.outCubic(d / 0.46));
      x = lerp(x, p.right.x, 0.3 * k); y = lerp(y, p.right.y, 0.3 * k);
      rot = lerp(rot, 0, 0.5 * k);
    }
    y += 10 * (1 - a);
    return { x, y, rot, a };
  }

  private drawPiece(c: CanvasRenderingContext2D, p: Piece, t: number, z: number) {
    const q = this.pose(p, t);
    if (!q) return;
    const { w, h } = p.cell;
    const s = p.s;
    c.save();
    c.globalAlpha = q.a;
    c.translate(q.x, q.y); c.rotate(q.rot); c.scale(s, s);
    if (p.kind === 'me') {
      const S = SCALE, r = p.cell;
      c.drawImage(this.me, r.x * S, r.y * S, r.w * S, r.h * S, -w / 2, -h / 2, w, h);
    } else {
      c.fillStyle = rgba('bone', 0.9);
      c.fillRect(-w / 2 + 9, -2.5, w - 18, 5);
    }
    c.lineWidth = HAIR / (s * z);
    c.strokeStyle = rgba('bone', 0.75);
    c.strokeRect(-w / 2, -h / 2, w, h);
    // the mono tag, as on `pieces`' pile
    const px = 11 / s;
    c.font = font(F.mono(500), px);
    const tw = c.measureText(p.label).width;
    const tx = -w / 2, ty = h / 2 + px * 0.2;
    c.fillStyle = rgba('ink', 0.85);
    c.fillRect(tx, ty, tw + px * 0.5, px * 1.25);
    c.fillStyle = rgba('bone', 0.88);
    c.textBaseline = 'top';
    c.fillText(p.label, tx + px * 0.25, ty + px * 0.14);
    c.restore();
  }

  // ------------------------------------------------------------------------------------ lyrics
  /** Words dim ≤ 0.4 s early; Archivo lines fill lamp glyph by glyph while sung, then bone; the serif line fills bone. */
  private drawRow(c: CanvasRenderingContext2D, r: Row, t: number) {
    if (t < r.show) return;
    const off = 1 - smoothstep(r.hide, r.hide + (r.serif ? 0.3 : 0.16), t);
    if (off <= 0) return;
    c.font = font(r.fam, r.size);
    c.textBaseline = 'alphabetic';
    for (const pw of r.words) {
      const w = pw.w;
      if (t < w.start - 0.4) continue;
      const pre = smoothstep(Math.max(w.start - 0.4, r.show), Math.max(w.start - 0.4, r.show) + 0.12, t);
      const p = Lyrics.wordProgress(w, t), n = pw.L.glyphs.length;
      const singing = t >= w.start && t < w.end;
      const base = t < w.start ? (r.serif ? 0.26 : 0.3) * pre : t >= w.end ? (r.serif ? 0.94 : 0.92) : r.serif ? 0.26 : 0.3;
      for (const g of pw.L.glyphs) {
        const lit = singing ? clamp(p * n - g.i) : 0;
        if (r.serif) { // the sacred voice: bone, rising to full bone as sung (never lamp, never bloomed)
          const a = singing ? lerp(0.26, 0.94, lit) : base;
          c.fillStyle = rgba('bone', a * off); c.fillText(g.ch, pw.x + g.x, r.y);
          continue;
        }
        if (lit < 1) { c.fillStyle = rgba('bone', base * off * (1 - lit)); c.fillText(g.ch, pw.x + g.x, r.y); }
        if (lit > 0) { c.fillStyle = rgba('lamp', lit * off); c.fillText(g.ch, pw.x + g.x, r.y); }
      }
    }
  }

  // ---------------------------------------------------------------------- the world's asks (silence's)
  private phoneGlow(t: number) {
    const k = this.arrive[0]!;
    if (t < k) return 0;
    const ring = 0.72 + 0.28 * Math.pow(0.5 + 0.5 * Math.cos(TAU * 2.6 * (t - this.ringD)), 3); // = `silence`'s ring
    return ring * ease.outCubic(clamp((t - k) / 0.1));
  }

  private drawPhone(c: CanvasRenderingContext2D, t: number) {
    if (t < this.arrive[0]!) return; // the phone is the first ask: it arrives lit, on its kick
    const g = this.phoneGlow(t);
    const { x, y } = PHONE;
    if (g > 0) {
      c.save();
      c.translate(x, y); c.scale(1, 0.32);
      const fl = c.createRadialGradient(0, 0, 0, 0, 0, 300);
      fl.addColorStop(0, rgba('lamp', 0.32 * g)); fl.addColorStop(1, rgba('lamp', 0));
      c.fillStyle = fl; c.fillRect(-300, -300, 600, 600);
      c.restore();
      const wl = c.createLinearGradient(0, SEAM_Y, 0, SEAM_Y - 260);
      wl.addColorStop(0, rgba('lamp', 0.1 * g)); wl.addColorStop(1, rgba('lamp', 0));
      c.fillStyle = wl; c.fillRect(x - 260, SEAM_Y - 260, 520, 260);
    }
    // the phone, face-up on the floor (dark until the world calls)
    const quad = (s: number) => [[x - 60 * s, y - 26 * s], [x + 60 * s, y - 26 * s], [x + 76 * s, y + 26 * s], [x - 76 * s, y + 26 * s]] as const;
    const path = (q: ReturnType<typeof quad>) => { c.beginPath(); q.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py))); c.closePath(); };
    path(quad(1)); c.fillStyle = rgba('ink', 1); c.fill();
    c.strokeStyle = rgba('dust', 0.55); c.lineWidth = HAIR; c.stroke();
    if (g > 0) { path(quad(0.84)); c.fillStyle = rgba('lamp', 0.9 * g); c.fill(); }
  }

  private drawBubbles(c: CanvasRenderingContext2D, t: number) {
    c.font = font(F.mono(400), BUB_SIZE);
    const at = [1, 2, 4, 5];
    BUBBLES.forEach((b, i) => {
      const k0 = this.arrive[at[i]!]!;
      if (t < k0) return;
      const u = clamp((t - k0) / 0.2), s = lerp(0.86, 1, ease.outBack(u)), a = ease.outCubic(clamp((t - k0) / 0.08));
      const w = this.bubW[i]!;
      c.save();
      c.translate(b.x, b.y + BUB_H); c.scale(s, s); c.translate(-b.x, -(b.y + BUB_H));
      c.globalAlpha = a;
      c.strokeStyle = rgba('dust', 0.6); c.lineWidth = HAIR;
      c.beginPath(); c.roundRect(b.x, b.y, w, BUB_H, 18); c.stroke();
      c.fillStyle = rgba('bone', 0.62);
      c.fillText(b.text, b.x + 20, b.y + BUB_H / 2 + BUB_SIZE * 0.34);
      c.fillStyle = rgba('lamp', 0.85);
      c.beginPath(); c.arc(b.x + w - 2, b.y + 4, 5, 0, TAU); c.fill();
      c.restore();
    });
  }

  private drawCerts(c: CanvasRenderingContext2D, t: number) {
    const at = [3, 7];
    CERTS.forEach((cf, i) => {
      const k0 = this.arrive[at[i]!]!;
      if (t < k0) return;
      // hung on its nail: it drops the last few px onto it and swings to rest
      const u = clamp((t - k0) / 0.14);
      const dy = -16 * (1 - ease.outCubic(u));
      const sw = 0.03 * Math.exp(-(t - k0) / 0.25) * Math.sin((t - k0) * 26);
      c.save();
      c.globalAlpha = ease.outCubic(clamp((t - k0) / 0.06));
      c.translate(cf.x + cf.w / 2, cf.y + cf.h / 2 + dy); c.rotate(cf.rot + sw);
      const hx = -cf.w / 2, hy = -cf.h / 2;
      c.strokeStyle = rgba('dust', 0.7); c.lineWidth = HAIR;
      c.strokeRect(hx, hy, cf.w, cf.h);
      c.strokeStyle = rgba('dust', 0.35);
      c.strokeRect(hx + 10, hy + 10, cf.w - 20, cf.h - 20);
      c.textAlign = 'center';
      c.font = font(F.serif(400), cf.w > 300 ? 30 : 27);
      c.fillStyle = rgba('bone', 0.55);
      c.fillText(cf.title, 0, 4);
      c.font = font(F.mono(400), 15);
      c.fillStyle = rgba('dust', 0.75);
      c.fillText(cf.date, 0, cf.h / 2 - 30);
      c.textAlign = 'left';
      c.restore();
    });
  }

  private drawField(c: CanvasRenderingContext2D, t: number) {
    const k0 = this.arrive[6]!;
    if (t < k0) return;
    const a = ease.outCubic(clamp((t - k0) / 0.1));
    const typeEnd = Math.min(k0 + 0.32, this.ctx.end - 0.04);
    const n = FIELD.text.length, left = Math.min(n, Math.floor(clamp((t - k0 - 0.04) / (typeEnd - k0 - 0.04)) * n + 1e-6));
    const txt = FIELD.text.slice(0, left);
    c.font = font(F.mono(400), 28);
    const tw = measure(txt, F.mono(400), 28);
    const cursorX = FIELD.x + 22 + tw;
    c.strokeStyle = rgba('dust', 0.6 * a); c.lineWidth = HAIR;
    c.beginPath(); c.roundRect(FIELD.x, FIELD.y, FIELD.w, FIELD.h, FIELD.h / 2); c.stroke();
    c.fillStyle = rgba('bone', 0.8 * a);
    c.fillText(plain(txt), FIELD.x + 22, FIELD.y + FIELD.h / 2 + 10);
    if (Math.floor(frameIdx(t) / 30) % 2 === 0 || left < n) { // = `silence`'s cursor
      c.fillStyle = rgba('lamp', 0.9 * a);
      c.fillRect(cursorX + 2, FIELD.y + 16, 2, FIELD.h - 32);
    }
  }

  /** ASKS on the seam at the right (`silence`'s place): 40, one tick to 41 on "world", then a blinking cursor. */
  private drawAsks(c: CanvasRenderingContext2D, t: number) {
    if (t < this.asksOn) return;
    const a = ease.outCubic(clamp((t - this.asksOn) / 0.25));
    const v = t >= this.tick ? 41 : 40;
    const hot = t >= this.tick ? 1 - smoothstep(this.tick, this.tick + 0.4, t) : 0;
    c.save();
    c.textAlign = 'right';
    c.textBaseline = 'alphabetic';
    c.font = font(F.mono(500), 34);
    const num = String(v).padStart(2, '0');
    c.fillStyle = rgba('bone', 0.82 * a * (1 - hot));
    c.fillText(num, ASKS_X, ASKS_Y);
    if (hot > 0) { c.fillStyle = rgba('lamp', 0.9 * hot); c.fillText(num, ASKS_X, ASKS_Y); }
    const nw = measure('00', F.mono(500), 34);
    c.font = font(F.mono(400), 20);
    c.fillStyle = rgba('dust', 0.75 * a);
    c.fillText('ASKS', ASKS_X - nw - 12, ASKS_Y);
    // the cursor: it blinks on the beat and nothing more comes (off for the cut)
    const A = this.ctx.audio;
    if (t >= this.tick + 0.4 && t < this.ctx.end - 0.3 && A.beatAt(t) % 1 < 0.5) {
      c.fillStyle = rgba('lamp', 0.85);
      c.fillRect(ASKS_X + 6, ASKS_Y - 25, 3, 28);
    }
    c.restore();
  }
}
