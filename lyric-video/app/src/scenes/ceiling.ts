// Plate 2 `ceiling` — "Another morning, same ceiling … While I'm struggling to rest" (docs/TREATMENT-drift.md).
// One real camera on the floor of the cover's room (pinhole, pitch only, lens shifted so the horizon sits at
// YH): the ceiling, the far wall, the floor and the side walls are planes, drawn per screen row (exact
// perspective for any plane whose rows are horizontal, which is every plane here: the camera never rolls).
//  - Hard cut on the downbeat looking UP: the hairline at SEAM_Y is the ceiling edge, starting as dim as
//    `seam` left its seam and brightening into "Another". "Another / morning, / same / ceiling" lie on the
//    ceiling plane, one word per row, receding toward the edge.
//  - The tilt: a slow creep from the first beat, then a decisive tilt down after "ceiling" is sung, landing
//    on the next beat: the ceiling edge leaves through the top, the wall/floor seam rises into SEAM_Y.
//  - "Same pressure … / Same people …": the slab lowers from the top, one step per strong kick inside the
//    lines (strength ≥ 0.4), and the lyric standing on the floor beneath it condenses with it (width 125 →
//    62, weight 500 → 900). Each line is pressed flat into the floor when the next one starts.
//    "blessed" is somebody else's word: upright Cormorant, bright bone, on a little card hung on the wall.
//  - "While I'm struggling to rest" stands on the floor in front of the wall, then tips over backwards
//    (a 90° rotation about its baseline, a real 3D plane) onto the floor, landing with the slab, which drops
//    onto the seam behind it on the last strong kick. Last frame: seam at SEAM_Y, slab resting on it.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { clearRT, H, Layer2D, SCALE, W } from '../engine/gl';
import { Lyrics, type Line, type Word } from '../engine/lyrics';
import { LIN, rgba } from '../engine/palette';
import { F, font, layout, type TextLayout } from '../engine/type';
import { clamp, ease, lerp, pulse, smoothstep } from '../engine/util';
import { CX, drawPlane, EYE, FloorLine, FOC, NEAR, type Plane, texCanvas, YH, ZW } from './ceiling-floorline';
import { clockSec, drawClock2D, HAIR, roomLight2D, SEAM_Y, SLAB, slab2D } from './_motifs';


// ------------------------------------------------------------------ the room and the camera (metres)
const HC = 2.75; // ceiling height
const XW = 1.15; // half the room's width (side-wall corners just off-frame once the camera has landed)
const PX_M = FOC / ZW; // px per metre on the far wall at pitch 0 (500)

/** Camera-space (yc up, zc forward) of a world point (Y up from the floor, Z forward), camera pitched up by p. */
function cam(Y: number, Z: number, p: number) {
  const y = Y - EYE, cp = Math.cos(p), sp = Math.sin(p);
  return { yc: y * cp - Z * sp, zc: Z * cp + y * sp };
}
function proj(X: number, Y: number, Z: number, p: number) {
  const { yc, zc } = cam(Y, Z, p);
  if (zc <= NEAR) return null;
  return { x: CX + (FOC * X) / zc, y: YH - (FOC * yc) / zc, zc };
}

// ------------------------------------------------------------------ type
const SAFE_X = 840;
const ROW = 0.94; // row pitch, em

interface RowWord { w: Word; serif?: boolean }

export default class Ceiling extends Scene {
  private layer = new Layer2D();
  private L1!: Line; private L2!: Line; private L3!: Line; private L4!: Line;
  private blessed!: Word;
  private p0 = 1.18; // starting pitch (rad), solved in init so the ceiling edge sits at SEAM_Y
  private tCreep = 0; private tSnap = 0; private tLand = 0;
  private steps: number[] = []; // strong kicks: the slab's steps; the last is the landing
  private bTop = -20; private bHang = 960; // slab bottom: before the first step, and after the last hanging step
  private size2 = 96; private size3 = 96;
  private wallP!: Plane; private floorP!: Plane; private ceilP!: Plane;
  private ceilText!: { cv: HTMLCanvasElement; c: CanvasRenderingContext2D; tw: number; th: number };
  private floor!: FloorLine;
  private lyrY = 1361; // its screen y at pitch 0
  private lcache = new Map<string, TextLayout>();

  private lay(text: string, fam: string, size: number, tr = 0) {
    const k = `${fam}|${size}|${tr}|${text}`;
    let l = this.lcache.get(k);
    if (!l) { l = layout(text, fam, size, tr); this.lcache.set(k, l); }
    return l;
  }

  override init() {
    const { lyrics: ly, audio, start, end } = this.ctx;
    const inWin = ly.lines.filter((l) => l.start >= start - 0.05 && l.start < end);
    const find = (re: RegExp) => inWin.find((l) => re.test(l.text))!;
    this.L1 = find(/same ceiling/i);
    this.L2 = find(/pressure/i);
    this.L3 = find(/blessed/i);
    this.L4 = find(/struggling/i);
    this.blessed = this.L3.words.find((w) => /blessed/i.test(w.w))!;

    // starting pitch: the ceiling edge (Y = HC, Z = ZW) projects onto SEAM_Y
    let lo = 0.2, hi = 1.5;
    for (let i = 0; i < 50; i++) {
      const m = (lo + hi) / 2, q = cam(HC, ZW, m);
      const y = YH - (FOC * q.yc) / q.zc;
      if (y < SEAM_Y) lo = m; else hi = m;
    }
    this.p0 = (lo + hi) / 2;

    // the tilt: creep from the first beat, then the real move once "ceiling" is sung, landing on the next beat
    const ceilW = this.L1.words[this.L1.words.length - 1]!;
    this.tCreep = audio.timeOfBeat(Math.floor(audio.beatAt(start + 0.02)) + 1);
    this.tSnap = ceilW.end - 0.2;
    this.tLand = audio.timeOfBeat(Math.ceil(audio.beatAt(ceilW.end) - 1e-3));

    // the slab's steps: strong kicks from "Same pressure" to the end of the plate
    this.steps = (audio.onsets['kick'] ?? []).filter(([k, s]) => s >= 0.4 && k >= this.L2.start - 0.05 && k < end - 0.05).map(([k]) => k);

    // type sizes: line 2/3 at their widest (width 125) fit the safe width; line 4 at width 62.5
    const wide = F.archivo(125, 500);
    const fit = (rows: string[], fam: string, max: number) => Math.min(max, ...rows.map((r) => (max * SAFE_X) / this.lay(r, fam, max).width));
    const txt = (l: Line, a: number, b: number) => l.words.slice(a, b).map((w) => w.w).join(' ');
    this.size2 = Math.floor(fit([txt(this.L2, 0, 2), txt(this.L2, 2, 99)], wide, 104));
    this.size3 = Math.floor(fit([txt(this.L3, 0, 2), txt(this.L3, 2, this.L3.words.length - 1)], wide, 104));

    // ---- light textures (the cover's light, mapped onto the room's planes so it tilts with them)
    // far wall: roomLight2D exactly as it lies at pitch 0 (tex row v ↔ screen -135 + v), extended up to the ceiling
    const wallTop = YH - (HC - EYE) * PX_M; // -135
    const tw = Math.ceil(2 * XW * PX_M), wth = Math.ceil(SEAM_Y - wallTop);
    const wt = texCanvas(tw, wth);
    wt.c.save(); wt.c.translate((tw - W) / 2, -wallTop); roomLight2D(wt.c); wt.c.restore();
    wt.c.drawImage(wt.cv, 0, Math.ceil(-wallTop + 2) * SCALE, tw * SCALE, SCALE, 0, 0, tw, -wallTop + 2);
    this.wallP = { cv: wt.cv, tw, th: wth, m: 1 / PX_M, oy: HC, oz: ZW, vy: -1, vz: 0 };
    // floor: the faint reflection (roomLight2D's floor band, re-parametrised linearly in depth)
    const fth = 360, ft = texCanvas(tw, fth);
    for (let v = 0; v < fth; v++) {
      const z = ZW - v / PX_M, r = (FOC * EYE) / z - (SEAM_Y - YH);
      ft.c.fillStyle = rgba('concrete', 0.35 * clamp(1 - r / 220));
      ft.c.fillRect(0, v, tw, 1.02);
    }
    this.floorP = { cv: ft.cv, tw, th: fth, m: 1 / PX_M, oy: 0, oz: ZW, vy: 0, vz: -1 };
    // ceiling: a soft pool of the overhead light, brightest toward the far wall where the lamp hangs
    const cth = Math.ceil(ZW * PX_M), ct = texCanvas(tw, cth);
    const g = ct.c.createRadialGradient(tw / 2, cth * 0.8, 20, tw / 2, cth * 0.8, tw * 0.62);
    g.addColorStop(0, rgba('concrete', 0.75)); g.addColorStop(0.5, rgba('concrete', 0.32)); g.addColorStop(1, rgba('concrete', 0));
    ct.c.fillStyle = g; ct.c.fillRect(0, 0, tw, cth);
    this.ceilP = { cv: ct.cv, tw, th: cth, m: 1 / PX_M, oy: HC, oz: 0, vy: 0, vz: 1 };

    // ---- the ceiling lyric texture: one word per row, near (top of screen) to far (the edge)
    const n1 = this.L1.words.length;
    this.ceilText = { ...texCanvas(980, Math.ceil(n1 * CEIL_SIZE * ROW + CEIL_SIZE * 0.3)), tw: 980, th: Math.ceil(n1 * CEIL_SIZE * ROW + CEIL_SIZE * 0.3) };
    // ---- the tipping lyric (ceiling-floorline.ts): the standing lines share its baseline
    this.floor = new FloorLine(ly);
    this.lyrY = this.floor.baseY;
  }

  // ------------------------------------------------------------------ timing
  private pitch(t: number) {
    const creep = 0.14; // rad of slow creep before the move
    if (t < this.tCreep) return this.p0;
    if (t < this.tSnap) return this.p0 - creep * ease.inOutQuad((t - this.tCreep) / (this.tSnap - this.tCreep));
    if (t < this.tLand) return (this.p0 - creep) * (1 - ease.inOutCubic((t - this.tSnap) / (this.tLand - this.tSnap)));
    return 0;
  }

  /** The slab's bottom edge on screen (pitch 0): steps down on the strong kicks, drops onto the seam on the last. */
  private slabBottom(t: number) {
    const ks = this.steps, n = ks.length;
    const hang = (i: number) => (n <= 1 ? this.bTop : lerp(this.bTop, this.bHang, i / (n - 1)));
    let b = this.bTop;
    for (let i = 0; i < n - 1; i++) if (t >= ks[i]!) b = lerp(hang(i), hang(i + 1), ease.outExpo(clamp((t - ks[i]!) / 0.24)));
    const land = ks[n - 1];
    if (land !== undefined) {
      const fall = 0.24;
      if (t >= land - fall) b = lerp(hang(n - 1), SEAM_Y, ease.inQuad(clamp((t - (land - fall)) / fall)));
    }
    return b;
  }
  /** 0 → 1 pressure: how far the slab has come down its hanging steps. */
  private press(t: number) { return clamp((this.slabBottom(t) - this.bTop) / (this.bHang - this.bTop)); }
  private tipAngle(t: number) {
    const land = this.steps[this.steps.length - 1] ?? this.ctx.end - 0.3;
    const dur = 0.42;
    return (Math.PI / 2) * ease.inCubic(clamp((t - (land - dur)) / dur));
  }

  // ------------------------------------------------------------------ render
  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer } = this.ctx;
    const t = f.t;
    const p = this.pitch(t);
    const c = this.layer.ctx;
    this.layer.clear();

    // the light: brighter as the room comes round
    const tilt = clamp(1 - p / this.p0);
    const lightI = lerp(0.75, 1, tilt);
    if (p === 0) roomLight2D(c);
    else {
      drawPlane(c, this.ceilP, p, 3, 0.8 * (1 - tilt));
      drawPlane(c, this.wallP, p, 3, lightI);
      drawPlane(c, this.floorP, p, 3, lightI);
    }

    // the clock, stopped where `seam` left it, leaves as the morning starts
    const ca = 1 - smoothstep(this.tCreep - 0.1, this.tCreep + 0.5, t);
    if (ca > 0) drawClock2D(c, clockSec('04:37:19'), { alpha: 0.9 * ca });

    // hairlines: ceiling edge, seam, the side walls' corners (in the layer, so the standing type occludes them)
    const edgeI = lerp(0.07, 1, ease.inOutCubic(smoothstep(this.ctx.start, this.L1.start, t)));
    this.room(c, p, edgeI);

    if (p > 0.25) this.drawCeilingText(c, t, p);

    this.drawCard(c, t);
    // the slab hangs on the far wall above the frame until the camera has landed, then comes down
    if (p === 0) slab2D(c, CX - SLAB.w / 2, this.slabBottom(t) - SLAB.h, SLAB.w, SLAB.h, { lit: 0.55 });

    this.drawStanding(c, t, p);
    this.drawTip(c, t);

    clearRT(renderer, out, LIN.ink);
    this.ctx.comp.draw(renderer, this.layer.upload(), out);

    // weight: a small knock on each step, a heavier one on the landing
    const ks = this.steps;
    let sh = 0;
    ks.forEach((k, i) => { sh += (i === ks.length - 1 ? 6 : 2.2) * pulse(t, k, 0.07); });
    return { zoom: 1 + 0.006 * f.a.kick, shake: [0.3 * sh * Math.sin(t * 97), sh * Math.cos(t * 61)] };
  }

  /** The room's hairlines for pitch p. */
  private room(c: CanvasRenderingContext2D, p: number, edgeI: number) {
    c.save();
    c.lineWidth = HAIR;
    const line = (x0: number, y0: number, x1: number, y1: number, a: number) => {
      c.strokeStyle = rgba('bone', a); c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    };
    const corner = 0.85 * 0.3;
    const seg3 = (a: [number, number, number], b: [number, number, number], col: number) => {
      let A = { x: a[0], ...cam(a[1], a[2], p) }, B = { x: b[0], ...cam(b[1], b[2], p) };
      if (A.zc <= NEAR && B.zc <= NEAR) return;
      const cut = (P: typeof A, Q: typeof A) => { const u = (NEAR - P.zc) / (Q.zc - P.zc); return { x: lerp(P.x, Q.x, u), yc: lerp(P.yc, Q.yc, u), zc: NEAR }; };
      if (A.zc <= NEAR) A = cut(A, B);
      if (B.zc <= NEAR) B = cut(B, A);
      line(CX + (FOC * A.x) / A.zc, YH - (FOC * A.yc) / A.zc, CX + (FOC * B.x) / B.zc, YH - (FOC * B.yc) / B.zc, col);
    };
    // side walls: the vertical corners and the ceiling/floor edges running toward the camera
    for (const s of [-1, 1]) {
      seg3([s * XW, 0, ZW], [s * XW, HC, ZW], corner);
      seg3([s * XW, HC, ZW], [s * XW, HC, 0], corner);
      seg3([s * XW, 0, ZW], [s * XW, 0, 0], corner);
    }
    // the ceiling edge and the seam (both horizontal: the camera only pitches)
    const ce = proj(0, HC, ZW, p);
    if (ce && ce.y > -4 && ce.y < H + 4) {
      const xe = (FOC * XW) / ce.zc;
      line(Math.max(0, CX - xe), ce.y, Math.min(W, CX + xe), ce.y, 0.85 * edgeI);
    }
    const se = proj(0, 0, ZW, p);
    if (se && se.y > -4 && se.y < H + 4) {
      const xs = (FOC * XW) / se.zc;
      line(Math.max(0, CX - xs), se.y, Math.min(W, CX + xs), se.y, 0.85);
    }
    c.restore();
  }

  // ------------------------------------------------------------------ the lyric
  /** One word's glyphs: dim ≤ 0.4 s early, lamp glyph by glyph while sung (never early), bone after. */
  private word(c: CanvasRenderingContext2D, w: Word, L: TextLayout, x: number, y: number, t: number, o: { serif?: boolean; after?: number } = {}) {
    if (t < w.start - 0.4) return;
    const pre = smoothstep(w.start - 0.4, w.start - 0.2, t);
    const n = L.glyphs.length, pr = Lyrics.wordProgress(w, t);
    const after = o.after ?? 0.92;
    c.font = font(L.family, L.size);
    for (const g of L.glyphs) {
      const lit = t >= w.start && t < w.end ? clamp(pr * n - g.i) : t >= w.end ? 1 : 0;
      const base = t < w.start ? 0.3 * pre : 0.3;
      if (o.serif) { // somebody else's word: bone, brightening; never lamp
        c.fillStyle = rgba('bone', lerp(base, 1, lit));
        c.fillText(g.ch, x + g.x, y);
        continue;
      }
      if (t >= w.end) { c.fillStyle = rgba('bone', after); c.fillText(g.ch, x + g.x, y); continue; }
      if (lit < 1) { c.fillStyle = rgba('bone', base * (1 - lit)); c.fillText(g.ch, x + g.x, y); }
      if (lit > 0) { c.fillStyle = rgba('lamp', lit); c.fillText(g.ch, x + g.x, y); }
    }
  }

  /** Rows of words centred on CX; returns nothing, draws at baselines y0, y0 + pitch, … */
  private rows(c: CanvasRenderingContext2D, rows: RowWord[][], fam: string, size: number, yLast: number, t: number, tr = 0) {
    const pitch = size * ROW;
    rows.forEach((row, ri) => {
      const y = yLast - (rows.length - 1 - ri) * pitch;
      const Ls = row.map((rw) => this.lay(rw.w.w, fam, size, tr));
      const sp = this.lay(' ', fam, size).width * 0.9 + tr;
      const wsum = Ls.reduce((a, L) => a + L.width, 0) + sp * (row.length - 1);
      let x = CX - wsum / 2;
      row.forEach((rw, i) => { this.word(c, rw.w, Ls[i]!, x, y, t); x += Ls[i]!.width + sp; });
    });
  }

  /** "Another / morning, / same / ceiling" on the ceiling plane. */
  private drawCeilingText(c: CanvasRenderingContext2D, t: number, p: number) {
    const T = this.ceilText, tc = T.c;
    tc.setTransform(1, 0, 0, 1, 0, 0);
    tc.clearRect(0, 0, T.tw, T.th);
    const fam = F.archivo(125, 500), size = CEIL_SIZE, tr = 0.04 * size;
    tc.letterSpacing = `0px`;
    this.L1.words.forEach((w, i) => {
      const L = this.lay(w.w, fam, size, tr);
      this.word(tc, w, L, (T.tw - L.width) / 2, size * 0.86 + i * size * ROW, t);
    });
    // on the ceiling: rows run from the camera (top of the texture) toward the far wall; the last row ends
    // just short of the edge
    const m = 1 / 520, zFar = ZW - 0.14;
    const P: Plane = { cv: T.cv, tw: T.tw, th: T.th, m, oy: HC, oz: zFar - T.th * m, vy: 0, vz: 1 };
    drawPlane(c, P, p, 1 / SCALE, 1, (y) => clamp((y - 205) / 90)); // no words in the top band
  }

  /** "Same pressure …" and "Same people …": standing on the floor beneath the slab, condensing with it. */
  private drawStanding(c: CanvasRenderingContext2D, t: number, p: number) {
    const k = this.press(t);
    const fam = F.archivo(lerp(125, 62.5, k), lerp(500, 900, k));
    // during the tilt the line rises in with the room (a little parallax: it stays inside the safe area)
    const se = proj(0, 0, ZW, p);
    const dy = 0.1 * clamp((se ? se.y : H * 2) - SEAM_Y, 0, 800);
    const draw = (l: Line, next: Line, size: number, split: number, drop: (w: Word) => boolean, first: boolean) => {
      // the first line anticipates (dim, 0.4 s); the later ones rise out of the floor as the previous one is
      // pressed flat into it, both in 0.12 s from the new line's first word
      if (t < l.start - (first ? 0.4 : 0)) return;
      const up = first ? 1 : ease.outCubic(clamp((t - l.start) / 0.12));
      const sq = up * (1 - ease.outCubic(clamp((t - next.start) / 0.12)));
      if (sq <= 0) return;
      const ws = l.words.filter((w) => !drop(w));
      const rows = [ws.slice(0, split).map((w) => ({ w })), ws.slice(split).map((w) => ({ w }))];
      c.save();
      c.translate(0, this.lyrY + dy); c.scale(1, sq); c.translate(0, -(this.lyrY + dy));
      this.rows(c, rows, fam, size, this.lyrY + dy, t);
      c.restore();
    };
    draw(this.L2, this.L3, this.size2, 2, () => false, true);
    draw(this.L3, this.L4, this.size3, 2, (w) => w === this.blessed, false);
  }

  /** "blessed": upright Cormorant on a small card hung on the wall (the slab will cover it). */
  private drawCard(c: CanvasRenderingContext2D, t: number) {
    const w = this.blessed;
    const t0 = w.start - 0.4;
    if (t < t0) return;
    const hang = ease.outCubic(clamp((t - t0) / 0.25));
    const fam = F.serif(600), size = 92;
    const L = this.lay(w.w, fam, size);
    const cw = Math.min(SLAB.w - 40, L.width + 70), ch = 128;
    const cy = SEAM_Y - 98 - ch / 2 - (1 - hang) * 14;
    c.save();
    c.globalAlpha = hang;
    c.translate(CX, cy); c.rotate(-0.022);
    c.fillStyle = rgba('ink', 0.85);
    c.fillRect(-cw / 2, -ch / 2, cw, ch);
    c.strokeStyle = rgba('dust', 0.55); c.lineWidth = HAIR;
    c.strokeRect(-cw / 2, -ch / 2, cw, ch);
    this.word(c, w, L, -L.width / 2, size * 0.28, t, { serif: true });
    c.restore();
  }

  /** "While I'm struggling / to rest": stands on the floor, then tips over backwards onto it (ceiling-floorline.ts). */
  private drawTip(c: CanvasRenderingContext2D, t: number) {
    const l = this.L4;
    if (t < l.start) return; // no anticipation: it rises out of the floor as the line before is pressed flat
    this.floor.draw(c, t, this.tipAngle(t), ease.outCubic(clamp((t - l.start) / 0.12)));
  }
}

const CEIL_SIZE = 124;
