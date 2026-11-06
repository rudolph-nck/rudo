// Plate 10 `apart` — "People think I'm doing great / Maybe that's the hardest part / Being surrounded by
// everybody / While feeling miles apart" (docs/TREATMENT-drift.md). The room again, wall and seam.
//  - Other people's words land on the wall as text bubbles (hairline pills), one per kick: praise in
//    upright Cormorant (somebody else's words: never lamp, never bloomed), asks in Plex Mono (the world
//    asking). They stack like a thread, the newest at the bottom pushing the older ones up. ASKS counts
//    every bubble, 31 → 40, in mono on the wall standing on the seam at the right (as `silence` recalls it).
//  - "People think I'm doing great": the lyric stands on the seam, heavy and condensed (verse weight).
//  - "Maybe that's the hardest part": a reply field just above the UI band (y 1380–1460, NOTES-port d4);
//    the lyric is typed into it with the voice (never ahead), then deleted character by character
//    before it is sent. The send arrow never lights.
//  - "Being surrounded by everybody": the thread breaks up and the bubbles surround the line, set in the
//    middle of the wall; on the beat and on the downbeat they close in from all four edges (the last
//    three arrive from beyond the frame) and the line condenses (width 112.5 → 62.5) until it has no room.
//  - "While feeling miles apart": the line takes line 3’s place on the wall, wide and light, its tracking opening;
//    the bubbles recede along the seam into perspective, a step farther on each kick, each with a mono
//    distance under it, until they are dots on the horizon and go. The last frame is the seam at
//    y = SEAM_Y, the line above it on the wall, ASKS 40: `voicemail`'s seam becomes its waveform.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { clearRT, Layer2D } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { Lyrics, type Line, type Word } from '../engine/lyrics';
import { LIN, rgba } from '../engine/palette';
import { F, font, layout, measure, smart } from '../engine/type';
import { clamp, ease, frameIdx, hash, lerp, smoothstep, TAU } from '../engine/util';
import { HAIR, roomLight2D, SAFE, seam, SEAM_Y } from './_motifs';

// ------------------------------------------------------------------------------- the messages
type Voice = 'serif' | 'mono';
type Slot = 'T0' | 'T1' | 'T2' | 'B0' | 'B1' | 'B2' | 'B3' | 'L' | 'R';
/** In order of arrival (kicks). `slot`: where the bubble ends when the crowd closes in around the line
 *  (T = above it, B = below, counted outward from the line; L / R flank its first row). `from` is the
 *  edge a late bubble enters from. */
const MSGS: { text: string; voice: Voice; slot: Slot; from?: 'left' | 'right' | 'top' | 'bottom' }[] = [
  { text: smart("you're killing it"), voice: 'serif', slot: 'T2' },
  { text: 'so proud of you', voice: 'serif', slot: 'B2' },
  { text: 'can you look at this real quick', voice: 'mono', slot: 'T1' },
  { text: 'you good?', voice: 'mono', slot: 'L' },
  { text: 'need that by Friday', voice: 'mono', slot: 'B1' },
  { text: 'you make it look easy', voice: 'serif', slot: 'T0' },
  { text: 'call me?', voice: 'mono', slot: 'R', from: 'right' },
  { text: 'one more thing', voice: 'mono', slot: 'B0', from: 'bottom' },
  { text: 'so inspiring', voice: 'serif', slot: 'B3', from: 'left' },
];
const ASKS0 = 31;
const MONO_SZ = 26, SERIF_SZ = 36, BUB_H = 56, PAD = 22, RAD = 18;
const STACK_BOT = 950; // the thread's newest bubble sits here (above "People think…" on the seam)
const GAP = 18; // between stacked bubbles
const TIGHT = 12; // between bubbles and the line when the crowd has closed in
const LOOSE = 34; // … when they first surround it
const CROWD_CY = 760; // the surrounded line's centre on the wall
const ASKS_X = 940, ASKS_Y = SEAM_Y - 18;
const FIELD = { x: 140, y: 1380, w: 800, h: 80 }; // the reply field: above the UI band (bottom 420 px)
const FIELD_SZ = 44;

interface Bub { text: string; voice: Voice; slot: Slot; from?: string; w: number; t0: number; i: number; miles: number; hx: number }
interface Row { words: Word[]; text: string }
type Rect = { x: number; y: number; w: number; h: number };

export default class Apart extends Scene {
  private layer = new Layer2D();
  private lb = new LineBatch(64, { screen2D: true, blend: 'add' });
  private l1!: Line; private l2!: Line; private l3!: Line; private l4!: Line;
  private bubs: Bub[] = [];
  private crowdSteps: number[] = []; // the beat and the downbeat inside "Being surrounded…"
  private recedeSteps: number[] = []; // the line start and the kicks inside "While feeling miles apart"
  private tickTimes: number[] = [];
  private l1Size = 0; private l3Size0 = 0; private l4Size = 0;
  private l3Rows: Row[] = [];

  override init() {
    const L = this.ctx.lyrics, A = this.ctx.audio;
    const mine = L.lines.filter((l) => l.start >= this.ctx.start - 0.05 && l.start < this.ctx.end);
    this.l1 = mine.find((l) => /people think/i.test(l.text))!;
    this.l2 = mine.find((l) => /hardest part/i.test(l.text))!;
    this.l3 = mine.find((l) => /surrounded/i.test(l.text))!;
    this.l4 = mine.find((l) => /miles apart/i.test(l.text))!;

    // the kicks: the strong ones in the first two lines carry the thread (one bubble each); inside line 3
    // the kick on the beat adds one, the downbeat adds the last ones (two at once if needed: ASKS 40 by "apart")
    const kicks = (A.onsets.kick ?? []).filter(([t]) => t > this.ctx.start && t < this.ctx.end - 0.12);
    const thread = kicks.filter(([t, s]) => s >= 0.6 && t < this.l3.start).map(([t]) => t);
    const nThread = MSGS.findIndex((m) => m.from !== undefined);
    const tThread = thread.slice(0, nThread);
    const crowdK = kicks.filter(([t, s]) => s >= 0.45 && t > this.l3.start + 0.2 && t < this.l4.start).map(([t]) => t);
    this.crowdSteps = crowdK.length >= 2 ? [crowdK[0]!, crowdK[crowdK.length - 1]!] : [this.l3.start + 0.7, this.l4.start - 0.3];
    const late = MSGS.length - tThread.length;
    const tLate = Array.from({ length: late }, (_, k) => (k === 0 && late > 1 ? this.crowdSteps[0]! : this.crowdSteps[1]!));
    const times = [...tThread, ...tLate];
    this.recedeSteps = [this.l4.start, ...kicks.filter(([t, s]) => s >= 0.45 && t > this.l4.start + 0.2).map(([t]) => t)].slice(0, 4);

    // recession: each bubble ends as a dot on the seam; dots ordered by where the bubble stood, spread out
    const order = MSGS.map((m, i) => ({ i, x: slotXHint(m.slot, i) })).sort((a, b) => a.x - b.x);
    const hxs = new Map<number, number>();
    order.forEach((o, k) => hxs.set(o.i, lerp(180, 780, k / (MSGS.length - 1))));
    this.bubs = MSGS.map((m, i) => ({
      ...m, i, t0: times[i]!, miles: 0.35 + 0.9 * hash(i, 41), hx: hxs.get(i)!,
      w: measure(m.text, m.voice === 'serif' ? F.serif(500) : F.mono(400), m.voice === 'serif' ? SERIF_SZ : MONO_SZ) + 2 * PAD,
    }));
    this.tickTimes = [...new Set(times)];

    // sizes: line 1 in two rows on the seam (heavy, condensed); line 3 in three rows (fits at its widest);
    // line 4 in two rows on the wall, wide and light, fitted at its widest tracking
    const fit = (rows: string[], fam: string, max: number, maxW: number, tr = 0) =>
      Math.min(max, ...rows.map((r) => (max * maxW) / measure(r, fam, max, tr * max)));
    this.l1Size = fit(['People think', 'I’m doing great'], F.archivo(75, 800), 112, 640); // clear of ASKS at the seam's right
    const w3 = this.l3.words;
    this.l3Rows = [[w3[0]!], [w3[1]!], w3.slice(2)].map((ws) => ({ words: ws, text: ws.map((w) => w.w).join(' ') }));
    this.l3Size0 = fit(this.l3Rows.map((r) => r.text), F.archivo(112.5, 800), 116, 720);
    const w4 = this.l4.words;
    this.l4Size = fit([w4.slice(0, 2).map((w) => w.w).join(' '), w4.slice(2).map((w) => w.w).join(' ')], F.archivo(125, 500), 104, 800, 0.2);
  }

  // ------------------------------------------------------------------------------- timing curves
  /** Crowd closing in, 0 (surrounding, loose) → 1 (no room): two steps, on the beat and the downbeat. */
  private crowd(t: number) {
    const [a, b] = this.crowdSteps as [number, number];
    return 0.5 * ease.outExpo(clamp((t - a) / 0.35)) + 0.5 * ease.outBack(clamp((t - b) / 0.32), 1.2);
  }
  /** The thread breaking up to surround the line (at line 3's start). */
  private surround(t: number) { return ease.outExpo(clamp((t - this.l3.start) / 0.45)); }
  /** Perspective depth of the receding bubbles: 1 on the wall, a step farther on each kick. */
  private depth(t: number) {
    const Z = [2.4, 5.5, 13, 40];
    let z = 1;
    this.recedeSteps.forEach((s, k) => { z += (Z[k]! - (k ? Z[k - 1]! : 1)) * ease.outExpo(clamp((t - s) / 0.4)); });
    return z * (1 + 0.08 * Math.max(0, t - this.l4.start));
  }

  // ------------------------------------------------------------------------------- geometry
  /** Line 3's layout at crowd c: rows centred on CROWD_CY; width 112.5 → 62.5, size shrinking a little. */
  private l3Layout(c: number) {
    const fam = F.archivo(lerp(112.5, 62.5, c), 800);
    const size = this.l3Size0 * lerp(1, 0.86, c);
    const lead = size * 1.0;
    const n = this.l3Rows.length;
    const asc = size * 0.73, desc = size * 0.22;
    const top = CROWD_CY - ((n - 1) * lead + asc + desc) / 2;
    const rows = this.l3Rows.map((r, k) => {
      const L = layout(r.text, fam, size, 0.01 * size);
      const y = top + asc + k * lead;
      return { ...r, L, x: 540 - L.width / 2, y };
    });
    return { fam, size, rows, top, bottom: top + (n - 1) * lead + asc + desc, asc };
  }

  /** Bubble rect in the thread (before line 3), newest at the bottom pushing older ones up. */
  private stackRect(b: Bub, t: number): Rect {
    let y = STACK_BOT - BUB_H;
    for (const o of this.bubs) {
      if (o.i <= b.i || o.from) continue;
      y -= (BUB_H + GAP) * ease.outExpo(clamp((t - o.t0) / 0.3));
    }
    const right = b.i % 2 === 1;
    const x = right ? 940 - b.w - 70 * hash(b.i, 3) : 140 + 80 * hash(b.i, 5);
    return { x, y, w: b.w, h: BUB_H };
  }

  /** Bubble rect around line 3 at crowd c (gap between LOOSE and TIGHT; edge bubbles pushed out to the edges). */
  private crowdRect(b: Bub, c: number, Lc = this.l3Layout(c)): Rect {
    const gap = lerp(LOOSE, TIGHT, c);
    const k = Number(b.slot.slice(1));
    const offX = (k % 2 ? 1 : -1) * (b.slot[0] === 'T' ? 1 : -1) * (0.3 + 0.7 * hash(b.i, 9)) * lerp(110, 45, c);
    const cx = (w: number) => clamp(540 + offX - w / 2, SAFE.x0 + 4, SAFE.x1 - 4 - w);
    if (b.slot[0] === 'T') {
      const y = Lc.top - gap - BUB_H - k * (BUB_H + gap);
      return { x: cx(b.w), y, w: b.w, h: BUB_H };
    }
    if (b.slot[0] === 'B') {
      const y = Lc.bottom + gap + k * (BUB_H + gap);
      return { x: cx(b.w), y, w: b.w, h: BUB_H };
    }
    const r0 = Lc.rows[0]!;
    const y = r0.y - Lc.asc / 2 - BUB_H / 2;
    const edge = lerp(0, 1, c); // pushed to the frame edge when loose, pressed against the word when tight
    if (b.slot === 'L') return { x: lerp(SAFE.x0 + 4, r0.x - gap - b.w, edge), y, w: b.w, h: BUB_H };
    return { x: lerp(SAFE.x1 - 4 - b.w, r0.x + r0.L.width + gap, edge), y, w: b.w, h: BUB_H };
  }

  /** Where a late bubble comes from: beyond its edge of the frame. */
  private offRect(b: Bub, r: Rect): Rect {
    if (b.from === 'left') return { ...r, x: -b.w - 40 };
    if (b.from === 'right') return { ...r, x: this.ctx.W + 40 };
    if (b.from === 'top') return { ...r, y: -BUB_H - 40 };
    return { ...r, y: this.ctx.H - 380 };
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer } = this.ctx;
    const t = f.t;
    const c = this.layer.ctx;
    this.layer.clear();
    roomLight2D(c, SEAM_Y, { intensity: 0.9 });

    this.drawBubbles(c, t);
    this.drawL1(c, t);
    this.drawField(c, t);
    this.drawL3(c, t);
    this.drawL4(c, t);
    this.drawAsks(c, t);

    clearRT(renderer, out, LIN.ink);
    this.ctx.comp.draw(renderer, this.layer.upload(), out);
    this.lb.clear();
    seam(this.lb, SEAM_Y, { width: HAIR });
    this.lb.render(renderer, out);
    return { zoom: 1 + 0.006 * f.a.kick };
  }

  // ------------------------------------------------------------------------------- bubbles
  private drawBubbles(c: CanvasRenderingContext2D, t: number) {
    const sur = this.surround(t), cr = this.crowd(t);
    const Lc = this.l3Layout(cr);
    const Lend = this.l3Layout(1);
    const z = this.depth(t), rec = t >= this.l4.start;
    const gone = 1 - smoothstep(this.ctx.end - 0.3, this.ctx.end - 0.04, t);
    for (const b of this.bubs) {
      if (t < b.t0) continue;
      const pop = ease.outBack(clamp((t - b.t0) / 0.26), 1.4);
      let r: Rect;
      if (rec) {
        const r0 = this.crowdRect(b, 1, Lend);
        // perspective toward the bubble's own point on the horizon (the seam)
        const hx = b.hx, hy = SEAM_Y - 4;
        const s = 1 / z;
        const cx = hx + (r0.x + r0.w / 2 - hx) * s, cy = hy + (r0.y + r0.h / 2 - hy) * s;
        this.bubble(c, b, cx, cy, s, gone, t);
        // the distance under it, once it has started to go
        const la = smoothstep(1.4, 2.2, z) * gone;
        if (la > 0) {
          const mi = b.miles * z;
          const txt = mi < 10 ? `${mi.toFixed(1)} mi` : `${Math.round(mi)} mi`;
          c.font = font(F.mono(400), 17);
          c.textAlign = 'center';
          c.fillStyle = rgba('dust', 0.85 * la);
          // under its point on the horizon, two staggered rows so neighbours never touch
          const k = [...this.bubs].sort((p, q) => p.hx - q.hx).indexOf(b);
          c.fillText(txt, b.hx, SEAM_Y + (k % 2 ? 54 : 32));
          c.textAlign = 'left';
        }
        continue;
      }
      if (!b.from) {
        const a = this.stackRect(b, t);
        const bb = this.crowdRect(b, cr, Lc);
        r = mixRect(a, bb, sur);
      } else {
        const bb = this.crowdRect(b, cr, Lc);
        r = mixRect(this.offRect(b, bb), bb, ease.outExpo(clamp((t - b.t0) / 0.3)));
      }
      const s = lerp(0.9, 1, pop);
      this.bubble(c, b, r.x + r.w / 2, r.y + r.h / 2 + 10 * (1 - pop), s, clamp((t - b.t0) / 0.06), t);
    }
  }

  /** One bubble centred at (cx, cy), scaled by s: hairline pill, ink fill, the words; a lamp unread dot. */
  private bubble(c: CanvasRenderingContext2D, b: Bub, cx: number, cy: number, s: number, alpha: number, t: number) {
    if (alpha <= 0.001) return;
    const w = b.w * s, h = BUB_H * s, x = cx - w / 2, y = cy - h / 2;
    if (s < 0.06) { // a dot on the horizon
      c.fillStyle = rgba('bone', 0.75 * alpha);
      c.beginPath(); c.arc(cx, cy, 2.4, 0, TAU); c.fill();
      return;
    }
    c.save();
    c.globalAlpha = alpha;
    c.beginPath(); c.roundRect(x, y, w, h, RAD * s);
    c.fillStyle = rgba('ink', 0.7); c.fill();
    c.strokeStyle = rgba('dust', 0.7); c.lineWidth = HAIR; c.stroke();
    // a small tail at the bottom-left corner (incoming)
    c.beginPath();
    c.moveTo(x + 16 * s, y + h - 0.5); c.lineTo(x + 6 * s, y + h + 10 * s); c.lineTo(x + 30 * s, y + h - 0.5);
    c.fillStyle = rgba('ink', 0.7); c.fill();
    c.stroke();
    // the words: only where the whole text box is inside the title-safe area (fade in across its edge)
    const sz = (b.voice === 'serif' ? SERIF_SZ : MONO_SZ) * s;
    const tx0 = x + PAD * s, tx1 = x + w - PAD * s, ty0 = cy - sz * 0.6, ty1 = cy + sz * 0.45;
    const inside = Math.min(tx0 - SAFE.x0, SAFE.x1 - tx1, ty0 - SAFE.y0, SAFE.y1 - ty1);
    const ta = clamp(inside / 30) * smoothstep(0.45, 0.62, s);
    if (ta > 0) {
      c.font = font(b.voice === 'serif' ? F.serif(500) : F.mono(400), sz);
      c.fillStyle = rgba('bone', (b.voice === 'serif' ? 0.86 : 0.72) * ta);
      c.fillText(b.text, tx0, cy + sz * (b.voice === 'serif' ? 0.26 : 0.34));
    }
    // the unread dot: lamp, the screen's glow; it goes out when the bubbles start to recede
    const dot = 1 - smoothstep(this.l4.start, this.l4.start + 0.3, t);
    if (dot > 0) {
      c.fillStyle = rgba('lamp', 0.85 * dot);
      c.beginPath(); c.arc(x + w - 2 * s, y + 4 * s, 5 * s, 0, TAU); c.fill();
    }
    c.restore();
  }

  // ------------------------------------------------------------------------------- the lyric
  /** "People think I'm doing great": two rows standing on the seam, heavy; dims after it is sung, gone at line 3. */
  private drawL1(c: CanvasRenderingContext2D, t: number) {
    const l = this.l1;
    const off = 1 - smoothstep(this.l3.start - 0.25, this.l3.start, t);
    if (off <= 0) return;
    const after = lerp(1, 0.38, smoothstep(l.end + 0.2, l.end + 0.8, t));
    const fam = F.archivo(75, 800), size = this.l1Size, tr = 0.01 * size;
    const rows = [l.words.slice(0, 2), l.words.slice(2)];
    rows.forEach((ws, k) => {
      const y = SEAM_Y - 22 - (rows.length - 1 - k) * size * 1.02;
      this.drawRun(c, ws, fam, size, tr, 500, y, t, after * off);
    });
  }

  /** The reply field: opens 0.4 s before line 2; the line is typed with the voice, then deleted before it is sent. */
  private drawField(c: CanvasRenderingContext2D, t: number) {
    const l = this.l2;
    const open = ease.outExpo(clamp((t - (l.start - 0.4)) / 0.3));
    if (open <= 0) return;
    const text = l.text;
    const typed = Math.floor(Lyrics.lineCharProgress(l, t) + 1e-6); // never ahead of the voice
    const delStart = l.end + 0.12, perChar = 0.026;
    const deleted = t < delStart ? 0 : Math.min(text.length, Math.floor((t - delStart) / perChar) + 1);
    const n = Math.max(0, typed - deleted);
    const delEnd = delStart + text.length * perChar;
    const close = ease.inOutCubic(clamp((t - delEnd - 0.15) / 0.35));
    if (close >= 1) return;
    const a = open * (1 - close);
    const fy = FIELD.y + 30 * (1 - open);
    const fw = lerp(FIELD.w, FIELD.h, close);
    c.save();
    c.strokeStyle = rgba('dust', 0.65 * a); c.lineWidth = HAIR;
    c.fillStyle = rgba('ink', 0.6 * a);
    c.beginPath(); c.roundRect(FIELD.x, fy, fw, FIELD.h, FIELD.h / 2); c.fill(); c.stroke();
    // the send arrow at the right end: hairline, never lit (it is never sent)
    const sx = FIELD.x + fw - FIELD.h / 2, sy = fy + FIELD.h / 2;
    if (close < 0.5) {
      c.strokeStyle = rgba('dust', 0.55 * a * (1 - 2 * close));
      c.beginPath(); c.arc(sx, sy, 22, 0, TAU); c.stroke();
      c.beginPath(); c.moveTo(sx, sy + 11); c.lineTo(sx, sy - 11); c.moveTo(sx - 8, sy - 3); c.lineTo(sx, sy - 11); c.lineTo(sx + 8, sy - 3); c.stroke();
    }
    const fam = F.archivo(87.5, 600), size = FIELD_SZ;
    const L = layout(text, fam, size, 0.01 * size);
    const x0 = FIELD.x + 34, base = fy + FIELD.h / 2 + size * 0.36;
    c.font = font(fam, size);
    // placeholder until the first character
    if (n === 0 && t < l.start) {
      c.font = font(F.mono(400), 26);
      c.fillStyle = rgba('dust', 0.6 * a);
      c.fillText('Reply…', x0, fy + FIELD.h / 2 + 9);
    }
    c.font = font(fam, size);
    // the word being sung types in lamp; typed words settle to bone; while deleting, it is all bone
    const sungWord = deleted === 0 ? l.words.find((w) => t >= w.start && t < w.end) : undefined;
    let wStart = 0;
    const ranges = l.words.map((w) => { const r = [wStart, wStart + w.w.length] as const; wStart += w.w.length + 1; return { w, r }; });
    for (const g of L.glyphs) {
      if (g.i >= n) break;
      const inSung = sungWord && ranges.find((q) => q.w === sungWord && g.i >= q.r[0] && g.i < q.r[1]);
      c.fillStyle = inSung ? rgba('lamp', a) : rgba('bone', 0.9 * a);
      c.fillText(g.ch, x0 + g.x, base);
    }
    // the cursor: lamp, steady while typing or deleting, blinking otherwise
    const cx = x0 + (n > 0 ? L.glyphs[n - 1]!.x + L.glyphs[n - 1]!.w + 0.01 * size : 0);
    const busy = (t >= l.start && t < l.end) || (t >= delStart && t < delEnd);
    if (busy || Math.floor(frameIdx(t) / 30) % 2 === 0) {
      c.fillStyle = rgba('lamp', 0.9 * a);
      c.fillRect(cx + 3, fy + 20, 2.5, FIELD.h - 40);
    }
    c.restore();
  }

  /** "Being surrounded by everybody": three rows in the middle of the wall, condensing as the crowd closes in. */
  private drawL3(c: CanvasRenderingContext2D, t: number) {
    const l = this.l3;
    if (t < l.start || t >= this.l4.start) return; // no anticipation: the thread holds the wall until it breaks up
    const Lc = this.l3Layout(this.crowd(t));
    for (const r of Lc.rows) this.drawRun(c, r.words, Lc.fam, Lc.size, 0.01 * Lc.size, 540, r.y, t, 1, r.L);
  }

  /** "While feeling miles apart": two rows in the middle of the wall, wide and light; the tracking opens as the bubbles go. */
  private drawL4(c: CanvasRenderingContext2D, t: number) {
    const l = this.l4;
    if (t < l.start) return; // no anticipation: line 3 holds the wall until this line starts
    const fam = F.archivo(125, 500), size = this.l4Size;
    const open = ease.inOutCubic(clamp((t - l.start) / (this.ctx.end - l.start)));
    const tr = lerp(0.03, 0.2, open) * size;
    const rows = [l.words.slice(0, 2), l.words.slice(2)];
    rows.forEach((ws, k) => {
      const y = CROWD_CY + size * 0.36 + (k - 0.5) * size * 1.12;
      this.drawRun(c, ws, fam, size, tr, 540, y, t, 1);
    });
  }

  /** A run of words centred on cx at baseline y: dim ≤ 0.4 s early, lamp glyph by glyph while sung, bone after. */
  private drawRun(c: CanvasRenderingContext2D, ws: Word[], fam: string, size: number, tr: number, cx: number, y: number, t: number, alpha: number, Lpre?: ReturnType<typeof layout>) {
    const text = ws.map((w) => w.w).join(' ');
    const L = Lpre ?? layout(text, fam, size, tr);
    const x0 = cx - L.width / 2;
    c.font = font(fam, size);
    let gi = 0;
    for (const w of ws) {
      const n = Array.from(w.w).length;
      const p = Lyrics.wordProgress(w, t);
      const pre = smoothstep(w.start - 0.4, w.start - 0.25, t);
      for (let k = 0; k < n; k++) {
        const g = L.glyphs[gi + k]!;
        const singing = t >= w.start && t < w.end;
        const lit = singing ? clamp(p * n - k) : 0;
        const base = t < w.start ? 0.34 * pre : t >= w.end ? 0.94 : 0.34;
        if (lit < 1) { c.fillStyle = rgba('bone', base * (1 - lit) * alpha); c.fillText(g.ch, x0 + g.x, y); }
        if (lit > 0) { c.fillStyle = rgba('lamp', lit * alpha); c.fillText(g.ch, x0 + g.x, y); }
      }
      gi += n + 1; // the space
    }
  }

  // ------------------------------------------------------------------------------- ASKS
  /** ASKS on the wall, standing on the seam at the right: every bubble is one more; a lamp flash on each tick. */
  private drawAsks(c: CanvasRenderingContext2D, t: number) {
    const v = ASKS0 + this.bubs.filter((b) => b.t0 <= t).length;
    const last = [...this.tickTimes].reverse().find((k) => k <= t);
    const hot = last !== undefined ? 1 - smoothstep(last, last + 0.35, t) : 0;
    c.save();
    c.textAlign = 'right';
    const num = String(v).padStart(2, '0');
    c.font = font(F.mono(500), 34);
    c.fillStyle = rgba('bone', 0.82);
    c.fillText(num, ASKS_X, ASKS_Y);
    if (hot > 0) { c.fillStyle = rgba('lamp', 0.9 * hot); c.fillText(num, ASKS_X, ASKS_Y); }
    const nw = measure('00', F.mono(500), 34);
    c.font = font(F.mono(400), 20);
    c.fillStyle = rgba('dust', 0.75);
    c.fillText('ASKS', ASKS_X - nw - 12, ASKS_Y);
    c.restore();
  }
}

const mixRect = (a: Rect, b: Rect, k: number): Rect => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), w: lerp(a.w, b.w, k), h: lerp(a.h, b.h, k) });

/** A rough x for ordering the horizon dots by where each bubble stands in the crowd (left to right). */
function slotXHint(slot: Slot, i: number) {
  if (slot === 'L') return 0;
  if (slot === 'R') return 1000;
  return 540 + (hash(i, 9) - 0.5) * 90 + (slot[0] === 'T' ? -1 : 1) * Number(slot.slice(1));
}
