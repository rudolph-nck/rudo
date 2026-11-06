// Plate 9 `drive` — "Sometimes I drive with no destination" (docs/TREATMENT-drift.md).
// Hard cut from the hook reprise: the seam (y = SEAM_Y) is now the HORIZON of a night road, seen through a
// windshield. The road snaps out of the horizon on the cut; hairline lane dashes and roadside posts rush
// toward the camera, surging on every beat (an impulse per beat with a fast exponential coast: hold →
// snap, never a float). Stars above; the road bends on the downbeats (a physical track: the stars slide
// the other way).
//  - The lyric arrives on overhead ROAD SIGNS (a gantry over the lane): one sign per line, snapping in
//    from the horizon as the line starts, creeping closer a step per beat while it is sung, then rushing
//    overhead as the next arrives. Each word is lit by the headlights as sung: dim bone before, lamp glyph
//    by glyph while sung (never early), bone after. The text fades before the sign is big enough to leave
//    the title-safe area.
//  - The machine voice is the dashboard, reflected low in the glass just under the horizon
//    (y ≈ 1300–1460, above the UI band; NOTES-port d4): `02:14:07 AM · RADIO 88.7 · NAV: DESTINATION —`
//    and a radio dial whose needle is lamp. "Radio low": the dial's glow dips. "windows down": the mono
//    text shivers like wind.
//  - "Trying to outrun the noise": notifications stack in the REAR-VIEW MIRROR on the kicks; ASKS (in the
//    mirror) resumes 22 → 31. "That somehow always sticks around": the same notifications appear as
//    faint mirrored reflections on the windshield, fixed while the road speeds up; the mirror no longer
//    changes.
// First and last frame: the seam/horizon at SEAM_Y, full width (hand-offs from `hook1b`, to `apart`).
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { clearRT, Layer2D, W, H } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { Lyrics, type Line, type Word } from '../engine/lyrics';
import { LIN, rgba } from '../engine/palette';
import { F, font, layout, type TextLayout } from '../engine/type';
import { clamp, ease, frameIdx, fract, hash, lerp, mulberry32, pulse, smoothstep } from '../engine/util';
import { clockSec, clockText, HAIR, SAFE, seam, SEAM_Y } from './_motifs';

// ---- the road's projection (metres; camera at the origin looking down +Z, eye height CAM_Y)
const HY = SEAM_Y;
const VPX = W / 2;
const FOC = 900; // px per metre at Z = 1
const CAM_Y = 1.2;
const Z_FAR = 160;
const LEFT_EDGE = -5.4, RIGHT_EDGE = 1.9, CENTRE = -1.8; // two lanes; we drive in the right one
const DASH = 3, DASH_PERIOD = 10;
const POST_PERIOD = 18;

// ---- the overhead signs (drawn in "reference px" = the sign's size at Z = REF_Z, then scaled REF_Z / Z)
const REF_Z = 10;
const SIGN_W = 756;
const TEXT_W = 640;
const SIGN_Y = 5.6; // world height of the panel's centre (m)
const FAM = F.archivo(75, 700);
const TR_EM = 0.01;
const Z_ARRIVE = 60, Z_READ0 = 11.5, Z_READ1 = 9.4;
const SURGE = 0.4, EXIT = 0.32;

// ---- the cabin
const MIRROR = { x: 290, y: 236, w: 500, h: 160 } as const;
const HUD_Y = 1336, DIAL_Y = 1404, DIAL_X0 = 330, DIAL_X1 = 750;
const DASH_TOP = 1492;
const ASK_FROM = 22, ASK_TO = 31;
const NOTES = [
  'WORK · 14 unread', 'MOM · call me back', 'TEAM · quick sync tmrw?', 'BILLS · payment due',
  'HOA · violation notice', 'TEXTS · you up?', 'MEETING 9:00 · moved to 8:30', 'CHURCH · can you lead sunday?',
  'TAXES · action required',
];
const MONO = F.mono(400);

interface SignWord { w: Word; x: number; y: number; L: TextLayout }
interface Sign { line: Line; words: SignWord[]; size: number; h: number; surge: number; exit: number; lead: number }
interface Star { x: number; y: number; r: number; a: number }

export default class Drive extends Scene {
  private world = new Layer2D();
  private cabin = new Layer2D();
  private lb = new LineBatch(256, { screen2D: true, blend: 'add' });
  private signs: Sign[] = [];
  private stars: Star[] = [];
  private beats: number[] = [];
  private downs: number[] = [];
  private kicks: number[] = []; // strong kicks: the cabin jolts
  private asks: { t: number; n: number }[] = []; // notification arrivals (ASKS +n each)
  private noteT: number[] = []; // arrival time of each notification
  private fastFrom = 0; // "That somehow always sticks around": the road speeds up
  private lowW!: Word; // "low,"
  private windW!: Word; // "windows"
  private downW!: Word; // "down"

  override init() {
    const { lyrics, audio, start, end } = this.ctx;
    // (a line starting on the cut out belongs to the next plate: `apart`'s first line starts ~0 s before it)
    const lines = lyrics.lines.filter((l) => l.start >= start - 0.05 && l.start < end - 0.25);
    const beats = audio.beats.filter((b) => b >= start - 2 && b < end + 2);
    this.beats = beats;
    this.downs = audio.downbeats.filter((d) => d >= start - 0.01 && d < end);
    this.kicks = (audio.onsets.kick ?? []).filter(([t, s]) => t >= start && t < end && s >= 0.9).map(([t]) => t);
    const beatIn = (a: number, b: number) => beats.find((x) => x >= a && x <= b);

    // signs: one per line
    lines.forEach((line, i) => {
      const prev = lines[i - 1];
      const surge = !prev ? Math.max(start, line.start - 0.22)
        : beatIn(prev.end - 0.06, line.start - 0.05) ?? Math.max(line.start - 0.22, prev.end - 0.06);
      this.signs.push({ ...this.typeset(line), line, surge, exit: Infinity, lead: line.start - 0.4 });
    });
    this.signs.forEach((s, i) => {
      const next = this.signs[i + 1];
      const after = beats.find((b) => b >= s.line.end - 0.02);
      s.exit = Math.max(s.line.end - 0.06, Math.min(next?.surge ?? Infinity, after ?? end));
    });

    const find = (re: RegExp) => lines.flatMap((l) => l.words).find((w) => re.test(w.w))!;
    this.lowW = find(/^low/i);
    this.windW = find(/^windows/i);
    this.downW = find(/^down/i);
    const noise = lines.find((l) => /outrun/i.test(l.text))!;
    const sticks = lines.find((l) => /sticks around/i.test(l.text))!;
    this.fastFrom = this.signs.find((s) => s.line === sticks)!.surge;

    // ASKS 22 → 31 on the kicks from "Trying to outrun the noise" until the next line (the mirror then
    // stops changing). Fewer kicks than asks: the last kicks add two.
    const need = ASK_TO - ASK_FROM;
    let ks = (audio.onsets.kick ?? []).filter(([t, s]) => t >= noise.start - 0.05 && t < sticks.start && s >= 0.4);
    if (ks.length > need) ks = [...ks].sort((a, b) => b[1] - a[1]).slice(0, need).sort((a, b) => a[0] - b[0]);
    const per = ks.map(() => 1);
    for (let extra = need - ks.length, j = ks.length - 1; extra > 0 && ks.length; extra--, j = j <= 0 ? ks.length - 1 : j - 1) per[j]!++;
    this.asks = ks.map(([t], j) => ({ t, n: per[j]! }));
    for (const a of this.asks) for (let k = 0; k < a.n; k++) this.noteT.push(a.t + k * 0.09);

    // stars: a few hundred bone points, fewer and dimmer toward the horizon
    const rnd = mulberry32(909);
    for (let i = 0; i < 280; i++) {
      const y = Math.pow(rnd(), 1.4) * (HY - 30);
      this.stars.push({ x: -80 + rnd() * (W + 160), y, r: 0.5 + Math.pow(rnd(), 3) * 1.4, a: (0.18 + 0.6 * rnd()) * (1 - 0.6 * (y / HY)) });
    }
  }

  /** The line on its sign: two balanced rows (one if it is a single word), sized to TEXT_W. */
  private typeset(line: Line): { words: SignWord[]; size: number; h: number } {
    const ws = line.words;
    const S0 = 80;
    const wid = (g: Word[], s: number) => g.reduce((a, w, i) => a + layout(w.w, FAM, s, TR_EM * s).width + (i ? s * 0.26 : 0), 0);
    let best: Word[][] = [ws];
    if (ws.length > 1) {
      let bw = Infinity;
      for (let k = 1; k < ws.length; k++) {
        const m = Math.max(wid(ws.slice(0, k), S0), wid(ws.slice(k), S0));
        if (m < bw) { bw = m; best = [ws.slice(0, k), ws.slice(k)]; }
      }
    }
    const size = Math.min(S0, (S0 * TEXT_W) / Math.max(...best.map((g) => wid(g, S0))));
    const lead = size * 1.12;
    const h = best.length * lead + size * 0.95;
    const out: SignWord[] = [];
    best.forEach((g, ri) => {
      const rw = wid(g, size);
      let x = -rw / 2;
      const y = (ri - (best.length - 1) / 2) * lead + size * 0.36; // baseline (cap-centred rows)
      for (const w of g) {
        const L = layout(w.w, FAM, size, TR_EM * size);
        out.push({ w, x, y, L });
        x += L.width + size * 0.26;
      }
    });
    return { words: out, size, h };
  }

  // ------------------------------------------------------------------------------- motion
  /** The road's bend (−1..1) eased onto each downbeat: right, left, nearly straight. */
  private curv(t: number) {
    const targets = [0, 0.85, -0.7, 0.25];
    let c = 0;
    this.downs.forEach((d, i) => {
      if (i === 0) return;
      const to = targets[i % targets.length]!, from = targets[(i - 1) % targets.length]!;
      if (t >= d) c = lerp(from, to, ease.inOutCubic(clamp((t - d) / 1.0)));
    });
    return c;
  }
  private bend(Z: number, c: number) { return c * 0.0006 * Z * Z; }
  private P(X: number, Y: number, Z: number, c: number) {
    return { x: VPX + (FOC * (X + this.bend(Z, c))) / Z, y: HY - (FOC * (Y - CAM_Y)) / Z };
  }

  /** Distance driven (m): a steady speed plus an impulse on every beat with a fast coast; faster in the last line. */
  private road(t: number) {
    const fast = (x: number) => smoothstep(this.fastFrom - 0.05, this.fastFrom + 0.6, x);
    const t0 = this.ctx.start;
    // steady part: 14 m/s, rising to 30 m/s (closed-form integral of the eased ramp is not needed: sample it)
    let base = 14 * (t - t0);
    const a = this.fastFrom, b = this.fastFrom + 0.6;
    if (t > a) {
      // ∫ 16 * smoothstep over [a, min(t, b)] + 16 * (t - b) past b
      const n = 8, tb = Math.min(t, b);
      let s = 0;
      for (let i = 0; i < n; i++) s += fast(a + ((i + 0.5) / n) * (tb - a));
      base += 16 * (s / n) * (tb - a) + (t > b ? 16 * (t - b) : 0);
    }
    let imp = 0;
    for (const bt of this.beats) {
      if (bt > t) break;
      imp += lerp(5, 10, fast(bt)) * (1 - Math.pow(0.5, (t - bt) / 0.11));
    }
    return base + imp;
  }

  /** Stepped beat count: whole beats plus a fast ease into each one (a step per beat). */
  private steps(t: number) {
    const B = this.ctx.audio.beatAt(t);
    return Math.floor(B) + ease.outExpo(clamp(fract(B) / 0.35));
  }

  /** A sign's distance (m) at t, or null when it is not on screen. */
  private signZ(s: Sign, t: number): number | null {
    if (t < s.surge) return null;
    const readEnd = s.exit;
    const st = (x: number) => this.steps(x);
    const u = clamp((st(t) - st(s.surge)) / Math.max(1e-3, st(readEnd) - st(s.surge)));
    const zr = lerp(Z_READ0, Z_READ1, u);
    if (t < s.exit) return lerp(Z_ARRIVE, zr, ease.outExpo(clamp((t - s.surge) / SURGE)));
    const k = clamp((t - s.exit) / EXIT);
    if (k >= 1) return null;
    return lerp(Z_READ1, 0.9, ease.inQuad(k));
  }

  /** The cabin's jolt on the strong kicks (px, down). */
  private jolt(t: number) {
    let j = 0;
    for (const k of this.kicks) j += pulse(t, k, 0.07) * 2.6;
    return j;
  }

  // ------------------------------------------------------------------------------- render
  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer } = this.ctx;
    const t = f.t;
    const c = this.world.ctx;
    this.world.clear();
    const cv = this.curv(t);
    const R = this.road(t);
    // the road snaps out of the horizon on the cut
    const g = ease.outExpo(clamp((t - this.ctx.start) / 0.35));
    const zNear = Math.pow(Z_FAR, 1 - g) * Math.pow(1.35, g);

    // sky: stars (at infinity: only the bend's yaw moves them) and the faintest horizon glow
    const sdx = -cv * 70;
    for (let i = 0; i < this.stars.length; i++) {
      const s = this.stars[i]!;
      const tw = 0.85 + 0.15 * hash(i, frameIdx(t) >> 3);
      c.fillStyle = rgba('bone', s.a * tw);
      c.beginPath(); c.arc(s.x + sdx, s.y, s.r, 0, Math.PI * 2); c.fill();
    }
    const hg = c.createLinearGradient(0, HY - 140, 0, HY);
    hg.addColorStop(0, rgba('concrete', 0));
    hg.addColorStop(1, rgba('concrete', 0.35));
    c.fillStyle = hg; c.fillRect(0, HY - 140, W, 140);

    // road surface (the headlights' pool toward the camera)
    const zs: number[] = [];
    for (let k = 0; k <= 48; k++) zs.push(zNear * Math.pow(Z_FAR / zNear, k / 48));
    c.beginPath();
    zs.forEach((Z, k) => { const p = this.P(LEFT_EDGE - 0.4, 0, Z, cv); k ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y); });
    for (let k = zs.length - 1; k >= 0; k--) { const p = this.P(RIGHT_EDGE + 0.4, 0, zs[k]!, cv); c.lineTo(p.x, p.y); }
    c.closePath();
    const rg = c.createLinearGradient(0, HY, 0, H);
    rg.addColorStop(0, rgba('concrete', 0.08));
    rg.addColorStop(0.35, rgba('concrete', 0.55));
    rg.addColorStop(1, rgba('concrete', 0.9));
    c.fillStyle = rg; c.fill();
    const fog = (Z: number) => clamp(1.15 - Z / 130);
    // edges
    for (const X of [LEFT_EDGE, RIGHT_EDGE]) {
      c.strokeStyle = rgba('bone', 0.5); c.lineWidth = HAIR;
      c.beginPath();
      zs.forEach((Z, k) => { const p = this.P(X, 0, Z, cv); k ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y); });
      c.stroke();
    }
    // centre dashes, rushing
    const off = ((R % DASH_PERIOD) + DASH_PERIOD) % DASH_PERIOD;
    for (let k = 0; k < Z_FAR / DASH_PERIOD + 2; k++) {
      const z0 = k * DASH_PERIOD - off, z1 = z0 + DASH;
      if (z1 <= zNear || z0 >= Z_FAR) continue;
      const a = Math.max(z0, zNear), b = Math.min(z1, Z_FAR);
      const hw = 0.09;
      const p0 = this.P(CENTRE - hw, 0, a, cv), p1 = this.P(CENTRE + hw, 0, a, cv);
      const p2 = this.P(CENTRE + hw, 0, b, cv), p3 = this.P(CENTRE - hw, 0, b, cv);
      c.fillStyle = rgba('bone', 0.8 * fog(a));
      c.beginPath(); c.moveTo(p0.x, p0.y); c.lineTo(p1.x, p1.y); c.lineTo(p2.x, p2.y); c.lineTo(p3.x, p3.y); c.closePath(); c.fill();
      // a hairline along it keeps far dashes from vanishing
      c.strokeStyle = rgba('bone', 0.6 * fog(a)); c.lineWidth = HAIR * 0.8;
      const m0 = this.P(CENTRE, 0, a, cv), m1 = this.P(CENTRE, 0, b, cv);
      c.beginPath(); c.moveTo(m0.x, m0.y); c.lineTo(m1.x, m1.y); c.stroke();
    }
    // roadside posts
    const poff = ((R % POST_PERIOD) + POST_PERIOD) % POST_PERIOD;
    for (let k = 0; k < Z_FAR / POST_PERIOD + 2; k++) {
      const Z = k * POST_PERIOD - poff + 4;
      if (Z <= Math.max(zNear, 1.4) || Z >= Z_FAR) continue;
      for (const X of [LEFT_EDGE - 0.9, RIGHT_EDGE + 0.9]) {
        const p0 = this.P(X, 0, Z, cv), p1 = this.P(X, 0.95, Z, cv);
        c.strokeStyle = rgba('dust', 0.75 * fog(Z)); c.lineWidth = Math.max(HAIR, 0.12 * FOC / Z);
        c.beginPath(); c.moveTo(p0.x, p0.y); c.lineTo(p1.x, p1.y); c.stroke();
        c.fillStyle = rgba('bone', 0.8 * fog(Z));
        c.fillRect(p1.x - 1, p1.y, 2, Math.max(1.5, 0.12 * FOC / Z));
      }
    }

    // signs, far first
    const live = this.signs.map((s) => ({ s, Z: this.signZ(s, t) })).filter((x): x is { s: Sign; Z: number } => x.Z !== null).sort((a, b) => b.Z - a.Z);
    for (const { s, Z } of live) this.drawSign(c, s, Z, t, cv);

    clearRT(renderer, out, LIN.ink);
    this.ctx.comp.draw(renderer, this.world.upload(), out);
    const lb = this.lb;
    lb.clear();
    seam(lb, SEAM_Y, { width: HAIR });
    lb.render(renderer, out);

    // ---- cabin (moves with the car: the kick jolt)
    const k = this.cabin.ctx;
    this.cabin.clear();
    const jy = this.jolt(t);
    k.save();
    k.translate(0, jy);
    this.drawGhosts(k, t);
    this.drawFrame(k);
    this.drawMirror(k, t, R);
    this.drawHud(k, t);
    k.restore();
    this.ctx.comp.draw(renderer, this.cabin.upload(), out);

    // the dial's needle glows (lamp: the radio is the signal light), dipping on "Radio low"
    lb.clear();
    const lv = this.radio(t);
    const nx = DIAL_X0 + ((88.7 - 88) / 20) * (DIAL_X1 - DIAL_X0);
    lb.seg2(nx, DIAL_Y - 16 + jy, nx, DIAL_Y + 14 + jy, 9, [LIN.lamp[0] * 0.5 * lv, LIN.lamp[1] * 0.5 * lv, LIN.lamp[2] * 0.5 * lv], 0.35);
    lb.seg2(nx, DIAL_Y - 14 + jy, nx, DIAL_Y + 12 + jy, 2.2, [LIN.lamp[0] * 1.6 * lv, LIN.lamp[1] * 1.6 * lv, LIN.lamp[2] * 1.6 * lv], 1);
    lb.render(renderer, out);

    return { zoom: 1 + 0.006 * f.a.kick, grain: 0.05 };
  }

  /** Radio level: full, then "Radio low" turns it down (a strong ease on "low"). */
  private radio(t: number) {
    return lerp(1, 0.32, ease.outExpo(clamp((t - this.lowW.start) / 0.4)));
  }

  private drawSign(c: CanvasRenderingContext2D, s: Sign, Z: number, t: number, cv: number) {
    const sc = REF_Z / Z;
    const ctr = this.P(0, SIGN_Y, Z, cv);
    const fadeIn = smoothstep(0, 0.08, t - s.surge);
    const fog = clamp(1.25 - Z / 60);
    const A = fadeIn * fog;
    if (A <= 0.001) return;
    // gantry: two posts beyond the shoulders and a beam under/over the panel (world-projected hairlines)
    const halfH = s.h / 2 / (FOC / REF_Z); // panel half-height in metres
    const yTop = SIGN_Y + halfH + 0.15, yBot = SIGN_Y - halfH - 0.15;
    c.strokeStyle = rgba('dust', 0.7 * A); c.lineWidth = Math.max(HAIR, 0.14 * FOC / Z * 0.5);
    for (const X of [LEFT_EDGE - 1.2, RIGHT_EDGE + 2.3]) {
      const p0 = this.P(X, 0, Z, cv), p1 = this.P(X, yTop, Z, cv);
      c.beginPath(); c.moveTo(p0.x, p0.y); c.lineTo(p1.x, p1.y); c.stroke();
    }
    c.lineWidth = HAIR;
    for (const Y of [yTop, yBot]) {
      const p0 = this.P(LEFT_EDGE - 1.2, Y, Z, cv), p1 = this.P(RIGHT_EDGE + 2.3, Y, Z, cv);
      c.beginPath(); c.moveTo(p0.x, p0.y); c.lineTo(p1.x, p1.y); c.stroke();
    }
    // panel (camera-facing: a uniform scale)
    c.save();
    c.translate(ctr.x, ctr.y);
    c.scale(sc, sc);
    const w = SIGN_W, h = s.h;
    const pg = c.createLinearGradient(0, -h / 2, 0, h / 2);
    pg.addColorStop(0, rgba('concrete', 0.97 * A));
    pg.addColorStop(1, rgba('concrete', 0.97 * A));
    c.fillStyle = pg;
    c.fillRect(-w / 2, -h / 2, w, h);
    const lg = c.createLinearGradient(0, -h / 2, 0, h / 2); // lit a touch from below by the headlights
    lg.addColorStop(0, rgba('dust', 0));
    lg.addColorStop(1, rgba('dust', 0.08 * A));
    c.fillStyle = lg;
    c.fillRect(-w / 2, -h / 2, w, h);
    c.strokeStyle = rgba('bone', 0.75 * A); c.lineWidth = HAIR / sc;
    c.strokeRect(-w / 2, -h / 2, w, h);
    c.strokeStyle = rgba('bone', 0.28 * A);
    c.strokeRect(-w / 2 + 12, -h / 2 + 12, w - 24, h - 24);
    // the words: shown dim at most 0.4 s early; faded before the sign grows past the safe area
    const ta = A * smoothstep(s.lead, s.lead + 0.15, t) * smoothstep(8.3, 9.1, Z);
    if (ta > 0.001) {
      c.font = font(FAM, s.size);
      for (const sw of s.words) this.drawWord(c, sw, t, ta);
    }
    c.restore();
  }

  /** dim bone → lamp glyph by glyph while sung (the headlights find it) → bone. */
  private drawWord(c: CanvasRenderingContext2D, sw: SignWord, t: number, a: number) {
    const w = sw.w;
    const p = Lyrics.wordProgress(w, t);
    const n = sw.L.glyphs.length;
    for (const g of sw.L.glyphs) {
      const lit = t >= w.start && t < w.end ? clamp(p * n - g.i) : 0;
      const base = t < w.start ? 0.3 : t >= w.end ? 0.95 : 0.3;
      if (lit < 1) { c.fillStyle = rgba('bone', base * a * (1 - lit)); c.fillText(g.ch, sw.x + g.x, sw.y); }
      if (lit > 0) { c.fillStyle = rgba('lamp', lit * a); c.fillText(g.ch, sw.x + g.x, sw.y); }
    }
  }

  /** Roof liner, A-pillars and the dashboard's edge: the windshield's frame. */
  private drawFrame(k: CanvasRenderingContext2D) {
    k.fillStyle = rgba('concrete', 1);
    k.beginPath();
    k.moveTo(0, 0); k.lineTo(W, 0); k.lineTo(W, 150);
    for (let x = W; x >= 0; x -= 40) k.lineTo(x, 128 - 0.00006 * (x - VPX) ** 2 + 22);
    k.closePath(); k.fill();
    k.strokeStyle = rgba('dust', 0.45); k.lineWidth = HAIR;
    k.beginPath();
    for (let x = 0; x <= W; x += 40) { const y = 150 - 0.00006 * (x - VPX) ** 2; x ? k.lineTo(x, y) : k.moveTo(x, y); }
    k.stroke();
    // pillars
    for (const s of [-1, 1]) {
      const x0 = s < 0 ? 0 : W;
      k.fillStyle = rgba('concrete', 1);
      k.beginPath(); k.moveTo(x0, 120); k.lineTo(x0 - s * 70, 120); k.lineTo(x0 - s * 6, 980); k.lineTo(x0, 980); k.closePath(); k.fill();
      k.beginPath(); k.moveTo(x0 - s * 70, 120); k.lineTo(x0 - s * 6, 980); k.stroke();
    }
    // dashboard edge (inside the bottom UI band: the room only)
    k.fillStyle = rgba('concrete', 1);
    k.beginPath();
    k.moveTo(0, H);
    for (let x = 0; x <= W; x += 40) k.lineTo(x, DASH_TOP + 0.00005 * (x - VPX) ** 2);
    k.lineTo(W, H); k.closePath(); k.fill();
    const dg = k.createLinearGradient(0, DASH_TOP, 0, H);
    dg.addColorStop(0, rgba('ink', 0.1)); dg.addColorStop(1, rgba('ink', 0.75));
    k.fillStyle = dg; k.fill();
    k.beginPath();
    for (let x = 0; x <= W; x += 40) { const y = DASH_TOP + 0.00005 * (x - VPX) ** 2; x ? k.lineTo(x, y) : k.moveTo(x, y); }
    k.strokeStyle = rgba('dust', 0.5); k.stroke();
  }

  /** The rear-view mirror: the road behind, the notifications stacking (newest on top) and ASKS. */
  private drawMirror(k: CanvasRenderingContext2D, t: number, R: number) {
    const m = MIRROR;
    // stem from the roof
    k.fillStyle = rgba('concrete', 0.95);
    k.fillRect(VPX - 14, 128, 28, m.y - 128);
    k.save();
    rrect(k, m.x, m.y, m.w, m.h, 22);
    k.fillStyle = rgba('ink', 1);
    k.fill();
    k.clip();
    // the road behind, receding (dashes moving away toward its vanishing point)
    const vx = VPX, vy = m.y + 70, bot = m.y + m.h;
    k.strokeStyle = rgba('dust', 0.22); k.lineWidth = HAIR;
    k.beginPath(); k.moveTo(m.x - 40, vy); k.lineTo(m.x + m.w + 40, vy); k.stroke();
    for (const ex of [-300, 160]) { k.beginPath(); k.moveTo(vx, vy); k.lineTo(vx + ex, bot); k.stroke(); }
    const off = fract(R / DASH_PERIOD);
    for (let i = 0; i < 6; i++) {
      const u0 = (i + off) / 6; // 0 near the camera, 1 at the horizon
      const z0 = 2 + u0 * 30, z1 = z0 + 1.2;
      const y0 = vy + 90 / z0 * 1.0, y1 = vy + 90 / z1;
      if (y0 > bot + 10) continue;
      k.strokeStyle = rgba('dust', 0.3 * (1 - u0));
      k.beginPath(); k.moveTo(vx + (-70 * 2) / z0, y0); k.lineTo(vx + (-70 * 2) / z1, y1); k.stroke();
    }
    // notifications
    k.font = font(MONO, 17);
    const rowH = 25, x0 = m.x + 20, y0 = m.y + 30;
    this.noteT.forEach((a, j) => {
      if (t < a) return;
      let idx = 0;
      for (let q = j + 1; q < this.noteT.length; q++) idx += ease.outExpo(clamp((t - this.noteT[q]!) / 0.25));
      const kin = ease.outExpo(clamp((t - a) / 0.22));
      const y = y0 + idx * rowH - (1 - kin) * 14;
      k.fillStyle = rgba('bone', 0.82 * kin * (j === this.noteT.length - 1 || idx > 0.5 ? 0.85 : 1));
      k.fillText(NOTES[j % NOTES.length]!, x0, y);
    });
    // ASKS, in the mirror's corner (staged inside the mirror, never a screen HUD)
    let v = ASK_FROM, bump = 0;
    for (const a of this.asks) if (t >= a.t) { v += a.n; bump = Math.max(bump, pulse(t, a.t, 0.12)); }
    k.textAlign = 'right';
    k.font = font(MONO, 15);
    k.fillStyle = rgba('dust', 0.85);
    k.fillText('ASKS', m.x + m.w - 66, m.y + m.h - 18);
    k.font = font(F.mono(600), 15 * (1 + 0.25 * bump));
    k.fillStyle = rgba('bone', 0.9);
    k.fillText(String(v).padStart(2, '0'), m.x + m.w - 22, m.y + m.h - 18);
    k.textAlign = 'left';
    k.restore();
    k.strokeStyle = rgba('bone', 0.6); k.lineWidth = HAIR;
    rrect(k, m.x, m.y, m.w, m.h, 22); k.stroke();
  }

  /** "That somehow always sticks around": the notifications reflected in the windshield, mirrored, faint, fixed. */
  private drawGhosts(k: CanvasRenderingContext2D, t: number) {
    const t0 = this.fastFrom;
    if (t < t0) return;
    k.font = font(MONO, 22);
    this.noteT.forEach((_, j) => {
      const a = ease.outExpo(clamp((t - t0 - j * 0.07) / 0.35));
      if (a <= 0) return;
      const txt = NOTES[j % NOTES.length]!;
      const wd = txt.length * 22 * 0.6;
      const x = SAFE.x0 + 20 + hash(j, 31) * (SAFE.x1 - SAFE.x0 - 40 - wd);
      const y = 440 + j * 26 + (hash(j, 37) - 0.5) * 10;
      k.save();
      k.translate(x + wd, y);
      k.scale(-1, 1);
      k.fillStyle = rgba('bone', 0.15 * a);
      k.fillText(txt, 0, 0);
      k.restore();
    });
  }

  /** The dashboard, reflected low in the glass: clock · radio · nav, and the radio dial. Shivers on "windows down". */
  private drawHud(k: CanvasRenderingContext2D, t: number) {
    const sec = clockSec('02:14:00') + Math.max(0, t - this.ctx.start) + 7;
    const parts: [string, string][] = [[`${clockText(sec)} · RADIO `, 'bone'], ['88.7', 'lamp'], [' · NAV: DESTINATION —', 'bone']];
    const txt = parts.map((p) => p[0]).join('');
    const size = 23;
    const L = layout(txt, MONO, size);
    const x0 = VPX - L.width / 2;
    const wind = smoothstep(this.windW.start - 0.05, this.windW.start + 0.12, t) * (1 - smoothstep(this.downW.end + 0.4, this.downW.end + 1.6, t));
    const fi = frameIdx(t);
    const lv = this.radio(t);
    k.font = font(MONO, size);
    let ci = 0;
    for (const [s, col] of parts) {
      for (let i = 0; i < s.length; i++, ci++) {
        const g = L.glyphs[ci]!;
        const dx = (hash(fi, ci, 1) - 0.5) * 2.6 * wind, dy = (hash(fi, ci, 2) - 0.5) * 4 * wind + Math.sin(t * 9 + ci * 0.7) * 1.4 * wind;
        k.fillStyle = col === 'lamp' ? rgba('lamp', lerp(0.4, 1, lv)) : rgba('bone', 0.72);
        k.fillText(g.ch, x0 + g.x + dx, HUD_Y + dy);
      }
    }
    // the dial: a hairline scale 88–108 MHz, the lamp needle at 88.7
    k.strokeStyle = rgba('dust', 0.6); k.lineWidth = HAIR;
    k.beginPath(); k.moveTo(DIAL_X0, DIAL_Y); k.lineTo(DIAL_X1, DIAL_Y); k.stroke();
    k.font = font(MONO, 13);
    k.textAlign = 'center';
    for (let mhz = 88; mhz <= 108; mhz++) {
      const x = DIAL_X0 + ((mhz - 88) / 20) * (DIAL_X1 - DIAL_X0);
      const major = (mhz - 88) % 4 === 0;
      k.beginPath(); k.moveTo(x, DIAL_Y - (major ? 9 : 5)); k.lineTo(x, DIAL_Y); k.stroke();
      if (major) { k.fillStyle = rgba('dust', 0.7); k.fillText(String(mhz), x, DIAL_Y + 26); }
    }
    k.textAlign = 'left';
    const nx = DIAL_X0 + ((88.7 - 88) / 20) * (DIAL_X1 - DIAL_X0);
    k.strokeStyle = rgba('lamp', lerp(0.5, 1, lv)); k.lineWidth = 1.6;
    k.beginPath(); k.moveTo(nx, DIAL_Y - 14); k.lineTo(nx, DIAL_Y + 12); k.stroke();
  }
}

function rrect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
