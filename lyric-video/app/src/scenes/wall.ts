// Plate 4 `wall` — inverted (docs/TREATMENT-drift.md, plate 4). The scene draws bone paper with ink lines
// itself (never `invert`); lamp stays lamp.
//  - Hard cut to bone paper on the cut. Each line of the first couplet is a framed certificate hung on a
//    nail (a 2 px nail-hit shake and a mono tick beside the nail): the line is its title in upright
//    Cormorant (somebody else's words: ink, never lamp, never bloomed), printed word by word as sung, with
//    a mono date line. During the second line the frames multiply on the half beats, small, overlapping,
//    crooked.
//  - Third/fourth lines: on the kick the camera turns and tracks along the wall: the certificates go
//    edge-on, a receding row of hairlines with nothing in them. The lyric is set in the lyric voice above
//    the seam (ink, the sung glyphs lamp); the long held last word pulls its letters apart as it is sung.
//  - Fifth/sixth lines: the camera snaps back on the kick; the frames go soft. The fifth line lies on the
//    floor plane (true perspective, strip-projected), the sixth stands on the wall plane just above the
//    seam; the seam between them is the only thing in focus. The sixth line's last word is sung after the
//    cut: it shows dim here and belongs to `dark`.
//  - ASKS stays 14: a mono wall label hung beside the frames like a gallery caption.
// The last frame is frontal: the frames hang where wall-frames.ts says (for `dark`), seam at SEAM_Y.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { clearRT, Layer2D } from '../engine/gl';
import { Lyrics, type Line, type Word } from '../engine/lyrics';
import { LIN, rgba } from '../engine/palette';
import { F, font, layout, measure, type TextLayout } from '../engine/type';
import { clamp, ease, frameIdx, hash, lerp, mulberry32, pulse, smoothstep, TAU } from '../engine/util';
import { HAIR, SAFE, SEAM_Y } from './_motifs';
import { frameCorners, NAIL_RISE, WALL_FRAMES, WIRE, type WallFrame } from './wall-frames';

type P2 = { x: number; y: number };
type P3 = { x: number; y: number; z: number };

const D = 1000; // focal length = camera distance when frontal (frontal projection is the identity on the wall)
const EYE = 640; // eye height (screen y of the horizon)
const NEAR = 40;
const LYR = F.archivo(62.5, 900); // the verse voice: condensed, heavy
const SERIF = F.serif(600);
const SERIF_L = F.serif(400);
const MONO = F.mono(400);
const deg = Math.PI / 180;

interface PWord { w: Word; row: number; x: number; L: TextLayout }
interface Block { line: Line; words: PWord[]; rows: { y: number }[]; size: number; fam: string; tr: number }
interface Hung { fr: WallFrame; t: number; seed: number; title?: Block }

const fold = (s: string) => s.toLowerCase().replace(/’/g, "'");

export default class Wall extends Scene {
  private layer = new Layer2D();
  private paper!: HTMLCanvasElement;
  private lowCv!: HTMLCanvasElement;
  private lowC!: CanvasRenderingContext2D;
  private lines: Line[] = [];
  private hung: Hung[] = [];
  private rowFrames: { x: number; y: number; w: number; h: number; rot: number }[] = [];
  private l3!: Block;
  private l4!: Block;
  private l5!: Block;
  private l6!: Block;
  private tA = 0; // the turn begins (kick at the third line)
  private tA2 = 0; // ... and lands (downbeat)
  private tB = 0; // the snap back (kick before the fifth line)
  private hits: number[] = [];

  override init() {
    const { lyrics, audio, start, end } = this.ctx;
    this.lines = lyrics.lines.filter((l) => l.start >= start - 0.05 && l.start < end);
    const find = (q: string) => this.lines.find((l) => fold(l.text).includes(q)) ?? lyrics.get(q);
    const L1 = find('a life'), L2 = find('a name'), L3 = find('funny'), L4 = find('feeling'), L5 = find('on paper'), L6 = find('on the wall');

    // --- hanging times: the first certificate on the cut, the second on the downbeat before its line,
    // the small ones on the half beats through the second line
    const db = audio.downbeats.filter((d) => d <= L2.words[0]!.start + 0.02 && d > start);
    const t2 = db.length ? db[db.length - 1]! : L2.words[0]!.start;
    const halves: number[] = [];
    for (let b = Math.ceil(audio.beatAt(L2.words[0]!.start) * 2) / 2; ; b += 0.5) {
      const tb = audio.timeOfBeat(b);
      if (tb >= L3.words[0]!.start - 0.05 || halves.length >= 4) break;
      if (tb > t2 + 0.2) halves.push(tb);
    }
    const times = [start, t2, ...halves];
    WALL_FRAMES.forEach((fr, i) => {
      if (i >= times.length) return;
      const h: Hung = { fr, t: times[i]!, seed: 11 + i * 7 };
      if (i === 0) h.title = this.titleBlock(L1, fr);
      if (i === 1) h.title = this.titleBlock(L2, fr);
      this.hung.push(h);
    });
    // the empty certificates further along the wall, seen only while the camera tracks
    const rnd = mulberry32(41);
    for (let x = 1240, i = 0; i < 16; i++) {
      const w = 220 + rnd() * 260, hh = 150 + rnd() * 170;
      this.rowFrames.push({ x: x + w / 2, y: (i % 2 ? 840 : 480) + (rnd() - 0.5) * 120, w, h: hh, rot: (rnd() - 0.5) * 8 * deg });
      x += w + 60 + rnd() * 120;
    }

    // --- camera beats
    const kicks = (a: number, b: number) => audio.events('kick', a, b).filter(([, s]) => s > 0.5).map(([k]) => k);
    this.tA = kicks(L3.words[0]!.start - 0.1, L3.words[0]!.start + 0.5)[0] ?? L3.words[0]!.start;
    this.tA2 = audio.downbeats.find((d) => d > this.tA + 0.3) ?? this.tA + 1;
    const kb = kicks(L5.words[0]!.start - 0.55, L5.words[0]!.start - 0.1);
    this.tB = kb.length ? kb[kb.length - 1]! : L5.words[0]!.start - 0.35;
    this.hits = [...this.hung.map((h) => h.t), this.tB];

    // --- the lyric-voice blocks
    this.l3 = this.block(L3, LYR, 112, 0.01, SEAM_Y - 64, 'up');
    this.l4 = this.block(L4, LYR, 112, 0.01, SEAM_Y - 64, 'up', true);
    this.l6 = this.block(L6, LYR, 96, 0.01, SEAM_Y - 26, 'up');
    this.l5 = this.floorBlock(L5);

    // --- paper: bone with a faint seeded mottle and fibres (computed once)
    this.paper = document.createElement('canvas');
    this.paper.width = 540; this.paper.height = 960;
    const pc = this.paper.getContext('2d')!;
    const r2 = mulberry32(7);
    for (let i = 0; i < 260; i++) {
      const x = r2() * 540, y = r2() * 960, rr = 30 + r2() * 90;
      const g = pc.createRadialGradient(x, y, 0, x, y, rr);
      g.addColorStop(0, rgba('dust', 0.012 + r2() * 0.018));
      g.addColorStop(1, rgba('dust', 0));
      pc.fillStyle = g; pc.beginPath(); pc.arc(x, y, rr, 0, TAU); pc.fill();
    }
    pc.strokeStyle = rgba('dust', 0.06); pc.lineWidth = 0.5;
    for (let i = 0; i < 160; i++) {
      const x = r2() * 540, y = r2() * 960, a = r2() * TAU, l = 3 + r2() * 9;
      pc.beginPath(); pc.moveTo(x, y); pc.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); pc.stroke();
    }

    this.lowCv = document.createElement('canvas');
    this.lowCv.width = Math.round(this.ctx.W * LOW); this.lowCv.height = Math.round(this.ctx.H * LOW);
    this.lowC = this.lowCv.getContext('2d')!;
  }

  // ------------------------------------------------------------------------------------- layout
  /** A certificate title: the line in upright Cormorant, centred in ≤ 2 rows inside the frame's inner rule. */
  private titleBlock(line: Line, fr: WallFrame): Block {
    const maxW = fr.w - 110;
    let size = 70;
    let rows: Word[][] = [];
    for (; size > 30; size -= 2) {
      rows = splitRows(line.words, SERIF, size, 0, maxW, 2);
      if (rows.length <= 2) break;
    }
    const words: PWord[] = [];
    const lead = size * 1.02;
    const y0 = -((rows.length - 1) * lead) / 2 + size * 0.3; // relative to the frame centre (baseline)
    rows.forEach((r, ri) => {
      const text = r.map((w) => w.w).join(' ');
      const L = layout(text, SERIF, size);
      let ci = 0;
      for (const w of r) {
        words.push({ w, row: ri, x: -L.width / 2 + (L.glyphs[ci]?.x ?? 0), L: layout(w.w, SERIF, size) });
        ci += Array.from(w.w).length + 1;
      }
    });
    return { line, words, rows: rows.map((_, ri) => ({ y: y0 + ri * lead - 4 })), size, fam: SERIF, tr: 0 };
  }

  /** Lyric-voice rows (left-aligned at SAFE.x0), stacked up from `base`; `lastAlone` puts the last word on its own row. */
  private block(line: Line, fam: string, size0: number, trEm: number, base: number, _dir: 'up', lastAlone = false): Block {
    const maxW = SAFE.x1 - SAFE.x0;
    let size = size0;
    const ws = line.words;
    let rows: Word[][];
    for (;;) {
      rows = lastAlone ? [...splitRows(ws.slice(0, -1), fam, size, trEm * size, maxW, 9), [ws[ws.length - 1]!]] : splitRows(ws, fam, size, trEm * size, maxW, 9);
      const widest = Math.max(...rows.map((r) => measure(r.map((w) => w.w).join(' '), fam, size, trEm * size)));
      if (widest <= maxW || size < 40) break;
      size -= 4;
    }
    const lead = size * 0.86;
    const words: PWord[] = [];
    rows.forEach((r, ri) => {
      const text = r.map((w) => w.w).join(' ');
      const L = layout(text, fam, size, trEm * size);
      let ci = 0;
      for (const w of r) {
        words.push({ w, row: ri, x: SAFE.x0 + (L.glyphs[ci]?.x ?? 0), L: layout(w.w, fam, size, trEm * size) });
        ci += Array.from(w.w).length + 1;
      }
    });
    const n = rows.length;
    return { line, words, rows: rows.map((_, ri) => ({ y: base - (n - 1 - ri) * lead })), size, fam, tr: trEm * size };
  }

  /**
   * The fifth line, lying on the floor: laid out in floor coordinates (world x, depth v from the seam
   * towards the camera), sized so each row's projected width stays inside the safe area.
   */
  private floorBlock(line: Line): Block {
    const ws = line.words;
    const rowsW: Word[][] = [ws.slice(0, 2), ws.slice(2)]; // far row / near row
    const targetY = [1318, 1440]; // screen baselines
    const words: PWord[] = [];
    const rows: { y: number }[] = [];
    let size = 0;
    rowsW.forEach((r, ri) => {
      const sy = targetY[ri]!;
      const zp = (D * (SEAM_Y - EYE)) / (sy - EYE); // camera depth of that floor row
      const s = D / zp; // its horizontal scale
      const text = r.map((w) => w.w).join(' ');
      const maxWorld = (SAFE.x1 - SAFE.x0) / s;
      const sz = Math.min(170, (100 * maxWorld) / measure(text, LYR, 100, 1));
      if (ri === 0) size = sz;
      const L = layout(text, LYR, sz, 0.01 * sz);
      let ci = 0;
      // world x: centred on the frame's axis, so the rows converge symmetrically toward the horizon
      const x0 = 540 - L.width / 2;
      for (const w of r) {
        words.push({ w, row: ri, x: x0 + (L.glyphs[ci]?.x ?? 0), L: layout(w.w, LYR, sz, 0.01 * sz) });
        ci += Array.from(w.w).length + 1;
      }
      rows.push({ y: zp - D + 0 /* floor depth (negative Z toward camera) stored as v */ });
      rows[ri]!.y = -(zp - D); // v = -Z
      (rows[ri] as any).size = sz;
    });
    return { line, words, rows, size, fam: LYR, tr: 0.01 * size };
  }

  // ------------------------------------------------------------------------------------- camera
  private cam(t: number) {
    const k = ease.inOutCubic(clamp((t - this.tA) / (this.tA2 - this.tA)));
    const back = ease.outExpo(clamp((t - this.tB) / 0.42));
    const K = k * (1 - back);
    const track = 1500 * clamp((t - this.tA) / (this.tB - this.tA));
    const th = 74 * deg * K;
    return { K, th, cx: 540 + K * (-170 + track), cz: lerp(-D, -250, K), cos: Math.cos(th), sin: Math.sin(th) };
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer } = this.ctx;
    const t = f.t;
    const cam = this.cam(t);
    const proj = (p: P3): P2 & { z: number } => {
      const dx = p.x - cam.cx, dz = p.z - cam.cz;
      const xr = dx * cam.cos - dz * cam.sin, zr = dx * cam.sin + dz * cam.cos;
      return { x: 540 + (D * xr) / zr, y: EYE + (D * (p.y - EYE)) / zr, z: zr };
    };
    const seg = (a: P3, b: P3) => { // a world segment, clipped at the near plane
      let pa = proj(a), pb = proj(b);
      if (pa.z < NEAR && pb.z < NEAR) return;
      if (pa.z < NEAR || pb.z < NEAR) {
        const u = (NEAR - pa.z) / (pb.z - pa.z);
        const m = proj({ x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), z: lerp(a.z, b.z, u) });
        if (pa.z < NEAR) pa = m; else pb = m;
      }
      g.moveTo(pa.x, pa.y); g.lineTo(pb.x, pb.y);
    };

    const c = this.layer.ctx;
    let g: CanvasRenderingContext2D = c;
    this.layer.clear(rgba('bone', 1));
    c.globalAlpha = 1;
    c.drawImage(this.paper, 0, 0, this.ctx.W, this.ctx.H);

    // the floor: a slightly shaded plane below the seam (follows the seam's projection)
    const sL = proj({ x: cam.cx - 6000, y: SEAM_Y, z: 0 }), sR = proj({ x: cam.cx + 20000, y: SEAM_Y, z: 0 });
    const seamA = clipNear(sL, sR, cam, proj, SEAM_Y);
    c.save();
    c.beginPath();
    c.moveTo(seamA[0].x, seamA[0].y); c.lineTo(seamA[1].x, seamA[1].y);
    c.lineTo(this.ctx.W + 400, seamA[1].y); c.lineTo(this.ctx.W + 400, this.ctx.H + 400); c.lineTo(seamA[0].x, this.ctx.H + 400); c.closePath();
    // (edge-on, the floor runs to the horizon: its shade fades out toward it instead of stepping)
    const fg = c.createLinearGradient(0, lerp(SEAM_Y, EYE + 10, cam.K), 0, this.ctx.H);
    fg.addColorStop(0, rgba('dust', 0.13 * (1 - cam.K))); fg.addColorStop(0.5, rgba('dust', 0.07)); fg.addColorStop(1, rgba('dust', 0.03));
    c.fillStyle = fg; c.fill();
    c.restore();

    // the frames go soft once the line is on the paper and the wall: only the seam stays in focus
    const L5s = this.l5.line.words[0]!.start;
    const soft = smoothstep(L5s, L5s + 0.6, t);
    const textA = 1 - smoothstep(0.02, 0.14, cam.K); // contents blank as the frames turn edge-on
    const objs = () => {
      for (const h of this.hung) if (t >= h.t) this.drawFrame(g, h, t, cam, seg, proj, textA, soft);
      // the empty certificates further along the wall (beyond the frontal view)
      if (cam.K > 0.001) {
        g.strokeStyle = rgba('ink', 0.55);
        g.lineWidth = HAIR;
        g.beginPath();
        for (const fr of this.rowFrames) {
          const q = frameCorners(fr), qi = frameCorners(fr, 12);
          for (const Q of [q, qi]) for (let i = 0; i < 4; i++) seg({ ...Q[i]!, z: 0 }, { ...Q[(i + 1) % 4]!, z: 0 });
        }
        g.stroke();
      }
    };
    if (soft < 0.98) { c.save(); c.globalAlpha = 1 - soft; objs(); c.restore(); }
    if (soft > 0.02) {
      // out of focus: the same objects drawn at a third of the resolution and scaled up (cheap, deterministic)
      const lc = this.lowC;
      lc.setTransform(1, 0, 0, 1, 0, 0);
      lc.clearRect(0, 0, this.lowCv.width, this.lowCv.height);
      lc.setTransform(LOW, 0, 0, LOW, 0, 0);
      g = lc;
      objs();
      g = c;
      c.save(); c.globalAlpha = soft; c.imageSmoothingEnabled = true;
      c.drawImage(this.lowCv, 0, 0, this.ctx.W, this.ctx.H);
      c.restore();
    }
    c.save();
    this.askLabel(c, seg, proj, textA);
    c.restore();

    // the seam: an ink hairline on the paper, the one thing in focus
    c.save();
    c.strokeStyle = rgba('ink', 0.9);
    c.lineWidth = HAIR;
    c.beginPath(); c.moveTo(seamA[0].x, seamA[0].y); c.lineTo(seamA[1].x, seamA[1].y); c.stroke();
    c.restore();

    // the lyric voice
    this.drawBlock(c, this.l3, t, this.l4.line.words[0]!.start - 0.4, 0.4);
    this.drawBlock(c, this.l4, t, L5s, 0.3, true);
    this.drawFloor(c, t, 1 - cam.K);
    this.drawBlock(c, this.l6, t, Infinity, 0);

    clearRT(renderer, out, LIN.bone);
    this.ctx.comp.draw(renderer, this.layer.upload(), out);

    // nail hits: 2 px; the kick breathes the frame a touch
    let hit = 0;
    for (const h of this.hits) hit = Math.max(hit, pulse(t, h, 0.05));
    const fi = frameIdx(t);
    return {
      shake: [(hash(fi, 3) - 0.5) * 4 * hit, (hash(fi, 4) - 0.5) * 4 * hit],
      zoom: 1 + 0.004 * f.a.kick,
      vignette: 0.22,
      grain: 0.045,
    };
  }

  // ------------------------------------------------------------------------------------- objects
  private drawFrame(c: CanvasRenderingContext2D, h: Hung, t: number, cam: ReturnType<Wall['cam']>,
    seg: (a: P3, b: P3) => void, proj: (p: P3) => P2 & { z: number }, textA: number, soft: number) {
    const fr = h.fr;
    const age = t - h.t;
    // hung: a short drop onto the nail and a damped swing to its tilt
    const dy = -22 * (1 - ease.outExpo(clamp(age / 0.16)));
    const swing = 3.2 * deg * Math.exp(-age * 3.2) * Math.sin(age * 11 + hash(h.seed) * 0.6) * (hash(h.seed, 1) < 0.5 ? -1 : 1);
    const q = frameCorners(fr, 0, dy, swing), qi = frameCorners(fr, 13, dy, swing);
    const top = { x: (q[0]!.x + q[1]!.x) / 2, y: (q[0]!.y + q[1]!.y) / 2 };
    const nail = { x: fr.x + Math.sin(fr.rot) * NAIL_RISE, y: fr.y - fr.h / 2 - NAIL_RISE, z: 0 };
    const wa = { x: lerp(q[0]!.x, q[1]!.x, WIRE), y: lerp(q[0]!.y, q[1]!.y, WIRE), z: 0 };
    const wb = { x: lerp(q[1]!.x, q[0]!.x, WIRE), y: lerp(q[1]!.y, q[0]!.y, WIRE), z: 0 };
    void top;
    c.lineWidth = HAIR;
    // the shadow of the frame on the paper (a soft offset band, ink at a few %)
    if (cam.K < 0.5) {
      c.save();
      c.globalAlpha = 0.05 * (1 - cam.K * 2);
      c.fillStyle = rgba('ink', 1);
      c.beginPath();
      q.forEach((p, i) => { const s = proj({ x: p.x + 7, y: p.y + 10, z: 0 }); i ? c.lineTo(s.x, s.y) : c.moveTo(s.x, s.y); });
      c.closePath(); c.fill();
      c.restore();
      // the frame face: paper a shade whiter than the wall (bone, opaque), so overlapping frames cover
      c.save();
      c.fillStyle = rgba('bone', 1);
      c.beginPath();
      q.forEach((p, i) => { const s = proj({ ...p, z: 0 }); i ? c.lineTo(s.x, s.y) : c.moveTo(s.x, s.y); });
      c.closePath(); c.fill();
      c.restore();
    }
    c.strokeStyle = rgba('ink', 0.85);
    c.beginPath();
    for (let i = 0; i < 4; i++) seg({ ...q[i]!, z: 0 }, { ...q[(i + 1) % 4]!, z: 0 });
    c.stroke();
    c.strokeStyle = rgba('ink', 0.4);
    c.beginPath();
    for (let i = 0; i < 4; i++) seg({ ...qi[i]!, z: 0 }, { ...qi[(i + 1) % 4]!, z: 0 });
    // the wire
    seg(wa, nail); seg(nail, wb);
    c.stroke();
    const np = proj(nail);
    if (np.z > NEAR) {
      c.fillStyle = rgba('ink', 0.9);
      c.beginPath(); c.arc(np.x, np.y, Math.max(1, (3.2 * D) / np.z), 0, TAU); c.fill();
    }

    if (textA <= 0.001) return;
    // the contents, frontal only
    c.save();
    c.globalAlpha = textA;
    c.translate(fr.x, fr.y + dy);
    c.rotate(fr.rot + swing);
    c.textBaseline = 'alphabetic';
    if (fr.kind === 'title' && h.title) {
      const b = h.title;
      // heading: letterspaced small capitals of somebody else's voice
      c.font = font(SERIF_L, 21);
      c.letterSpacing = '5px';
      c.fillStyle = rgba('ink', 0.55);
      const hw = measure(fr.heading, SERIF_L, 21, 5);
      c.fillText(fr.heading, -hw / 2, -fr.h / 2 + 52);
      c.letterSpacing = '0px';
      // the title: the sung line, printed word by word (dim at most 0.4 s early, ink as sung)
      c.font = font(b.fam, b.size);
      for (const pw of b.words) {
        const w = pw.w;
        if (t < w.start - 0.4) continue;
        const pre = smoothstep(w.start - 0.4, w.start - 0.2, t);
        const p = Lyrics.wordProgress(w, t), n = pw.L.glyphs.length;
        for (const g of pw.L.glyphs) {
          const lit = clamp(p * n - g.i);
          c.fillStyle = rgba('ink', 0.16 * pre * (1 - lit) + 0.92 * lit);
          c.fillText(g.ch, pw.x + g.x, b.rows[pw.row]!.y);
        }
      }
      // the date line and two signature rules with a seal between
      const by = fr.h / 2 - 40;
      c.font = font(MONO, 16);
      c.fillStyle = rgba('ink', 0.6);
      const dw = measure(fr.date, MONO, 16);
      c.fillText(fr.date, -dw / 2, by + 5);
      c.strokeStyle = rgba('ink', 0.45);
      c.lineWidth = HAIR * 0.8;
      c.beginPath();
      c.moveTo(-fr.w / 2 + 50, by - 6); c.lineTo(-dw / 2 - 28, by - 6);
      c.moveTo(dw / 2 + 28, by - 6); c.lineTo(fr.w / 2 - 50, by - 6);
      c.stroke();
      c.beginPath(); c.arc(fr.w / 2 - 92, by - 40, 22, 0, TAU); c.stroke();
      c.beginPath(); c.arc(fr.w / 2 - 92, by - 40, 17, 0, TAU); c.stroke();
    } else {
      const sz = 25;
      c.font = font(SERIF, sz);
      c.fillStyle = rgba('ink', 0.78);
      const words = fr.heading.split(' ');
      const rows = words.length > 2 ? [words.slice(0, 2).join(' '), words.slice(2).join(' ')] : [fr.heading];
      rows.forEach((r, i) => { const w = measure(r, SERIF, sz); c.fillText(r, -w / 2, -12 + (i - (rows.length - 1) / 2) * sz * 1.05); });
      c.font = font(MONO, 12);
      c.fillStyle = rgba('ink', 0.55);
      const dw = measure(fr.date, MONO, 12);
      c.fillText(fr.date, -dw / 2, fr.h / 2 - 30);
      c.strokeStyle = rgba('ink', 0.4);
      c.lineWidth = HAIR * 0.8;
      c.beginPath(); c.moveTo(-fr.w / 2 + 34, fr.h / 2 - 46); c.lineTo(fr.w / 2 - 34, fr.h / 2 - 46); c.stroke();
    }
    c.restore();

    // the nail's tick in the mono voice: on the hit, then it settles faint
    if (textA > 0.001 && soft < 0.99) {
      const i = this.hung.indexOf(h) + 1;
      const a = lerp(0.75, 0.3, smoothstep(0.15, 1.2, age)) * textA;
      c.save();
      c.font = font(MONO, 14);
      c.fillStyle = rgba('ink', a);
      c.fillText(`NAIL ${String(i).padStart(2, '0')}`, nail.x + 12, Math.max(SAFE.y0 + 12, nail.y + 5));
      c.restore();
    }
  }

  /** ASKS, frozen at 14: a gallery caption card on the wall beside the frames, just above the seam. */
  private askLabel(c: CanvasRenderingContext2D, seg: (a: P3, b: P3) => void, proj: (p: P3) => P2 & { z: number }, textA: number) {
    const x0 = 846, y0 = 1036, w = 114, h = 78;
    c.strokeStyle = rgba('ink', 0.7);
    c.lineWidth = HAIR;
    c.beginPath();
    const q = [{ x: x0, y: y0 }, { x: x0 + w, y: y0 }, { x: x0 + w, y: y0 + h }, { x: x0, y: y0 + h }];
    for (let i = 0; i < 4; i++) seg({ ...q[i]!, z: 0 }, { ...q[(i + 1) % 4]!, z: 0 });
    c.stroke();
    void proj;
    if (textA <= 0.001) return;
    c.save();
    c.globalAlpha = textA;
    c.fillStyle = rgba('ink', 0.6);
    c.font = font(MONO, 15);
    c.fillText('ASKS', x0 + 14, y0 + 26);
    c.fillStyle = rgba('ink', 0.92);
    c.font = font(F.mono(500), 34);
    c.fillText('14', x0 + 14, y0 + 64);
    c.restore();
  }

  /** Lyric-voice block: dim ink ≤ 0.4 s early, lamp glyph by glyph as sung, then ink. Fades out from `outAt`. */
  private drawBlock(c: CanvasRenderingContext2D, b: Block, t: number, outAt: number, outDur: number, spread = false) {
    const fade = outDur > 0 ? 1 - smoothstep(outAt, outAt + outDur, t) : 1;
    if (fade <= 0 || t < b.line.words[0]!.start - 0.4) return;
    c.save();
    c.font = font(b.fam, b.size);
    c.letterSpacing = `${b.tr}px`;
    const last = b.words[b.words.length - 1]!;
    for (const pw of b.words) {
      const w = pw.w;
      if (t < w.start - 0.4) continue;
      const pre = smoothstep(w.start - 0.4, w.start - 0.2, t);
      const p = Lyrics.wordProgress(w, t), n = pw.L.glyphs.length;
      // the held last word comes apart as it is sung: its letters drift to the safe width
      let extra = 0;
      if (spread && pw === last) {
        const room = SAFE.x1 - SAFE.x0 - pw.L.width;
        extra = (room / Math.max(1, n - 1)) * ease.inOutCubic(clamp((t - w.start) / Math.max(0.3, w.end - w.start)));
      }
      const after = lerp(0.92, 0.7, smoothstep(w.end + 0.6, w.end + 1.6, t));
      for (const g of pw.L.glyphs) {
        const lit = t >= w.start && t < w.end ? clamp(p * n - g.i) : 0;
        const x = pw.x + g.x + extra * g.i;
        const yy = b.rows[pw.row]!.y + (spread && pw === last ? (hash(g.i, 9) - 0.5) * 2 * extra * 0.12 : 0);
        const base = t < w.start ? 0.2 * pre : t >= w.end ? after : 0.2;
        if (lit < 1) { c.fillStyle = rgba('ink', base * (1 - lit) * fade); c.fillText(g.ch, x, yy); }
        if (lit > 0) { c.fillStyle = rgba('lamp', lit * fade); c.fillText(g.ch, x, yy); }
      }
    }
    c.restore();
  }

  /**
   * The fifth line on the floor plane: each glyph drawn through the affine that best matches the floor's
   * projection at its own position (glyphs are small against the perspective, so the keystone is true).
   */
  private drawFloor(c: CanvasRenderingContext2D, t: number, vis: number) {
    const b = this.l5;
    if (vis <= 0.001 || t < b.line.words[0]!.start - 0.4) return;
    // floor point (world x, depth v toward the camera from the seam) → screen, frontal camera
    const P = (x: number, v: number) => { const z = D - v; return { x: 540 + (D * (x - 540)) / z, y: EYE + (D * (SEAM_Y - EYE)) / z }; };
    c.save();
    for (const pw of b.words) {
      const w = pw.w;
      if (t < w.start - 0.4) continue;
      const sz = (b.rows[pw.row] as any).size as number;
      c.font = font(LYR, sz);
      const pre = smoothstep(w.start - 0.4, w.start - 0.2, t);
      const p = Lyrics.wordProgress(w, t), n = pw.L.glyphs.length;
      const after = lerp(0.92, 0.75, smoothstep(w.end + 0.6, w.end + 1.6, t));
      const vb = b.rows[pw.row]!.y, cap = sz * 0.72;
      for (const g of pw.L.glyphs) {
        const lit = t >= w.start && t < w.end ? clamp(p * n - g.i) : 0;
        const base = t < w.start ? 0.2 * pre : t >= w.end ? after : 0.2;
        const gx = pw.x + g.x, gw = Math.max(1, g.w);
        const o = P(gx, vb), ex = P(gx + gw, vb), ey = P(gx, vb - cap);
        c.save();
        c.transform((ex.x - o.x) / gw, (ex.y - o.y) / gw, (ey.x - o.x) / -cap, (ey.y - o.y) / -cap, o.x, o.y);
        if (lit < 1) { c.fillStyle = rgba('ink', base * (1 - lit) * vis); c.fillText(g.ch, 0, 0); }
        if (lit > 0) { c.fillStyle = rgba('lamp', lit * vis); c.fillText(g.ch, 0, 0); }
        c.restore();
      }
    }
    c.restore();
  }
}

/** Resolution of the out-of-focus copy of the wall objects. */
const LOW = 0.36;

/** Split words into rows no wider than maxW (greedy, then balanced if it made exactly 2 rows). */
function splitRows(ws: Word[], fam: string, size: number, tr: number, maxW: number, maxRows: number): Word[][] {
  const rows: Word[][] = [];
  let cur: Word[] = [];
  for (const w of ws) {
    const next = [...cur, w];
    if (cur.length && measure(next.map((x) => x.w).join(' '), fam, size, tr) > maxW) { rows.push(cur); cur = [w]; }
    else cur = next;
  }
  if (cur.length) rows.push(cur);
  if (rows.length === 2) { // balance: the most even split that fits
    let best = rows, bestD = Infinity;
    for (let k = 1; k < ws.length; k++) {
      const a = ws.slice(0, k), b2 = ws.slice(k);
      const wa = measure(a.map((x) => x.w).join(' '), fam, size, tr), wb = measure(b2.map((x) => x.w).join(' '), fam, size, tr);
      if (wa > maxW || wb > maxW) continue;
      const d = Math.abs(wa - wb);
      if (d < bestD) { bestD = d; best = [a, b2]; }
    }
    return best;
  }
  void maxRows;
  return rows;
}

/** The seam's two screen end points, with the near end clipped at the near plane. */
function clipNear(a: P2 & { z: number }, b: P2 & { z: number }, cam: { cx: number }, proj: (p: P3) => P2 & { z: number }, y: number): [P2, P2] {
  if (a.z >= NEAR) return [a, b];
  // walk the seam's world x until it is in front of the camera
  let x0 = cam.cx - 6000, x1 = cam.cx + 20000;
  for (let i = 0; i < 40; i++) { const m = (x0 + x1) / 2; if (proj({ x: m, y, z: 0 }).z < NEAR) x0 = m; else x1 = m; }
  return [proj({ x: x1, y, z: 0 }), b];
}
