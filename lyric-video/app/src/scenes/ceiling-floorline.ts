// Helper for plate 2 `ceiling` (and the first beat of `pieces`): the camera's room constants, the per-row
// perspective plane drawer, and the floor line "While I'm struggling / to rest" — standing on the floor in
// front of the wall, tipping backwards about its baseline, and lying flat in perspective between y ≈ 1245
// and 1345 (the `ceiling` plate's last frame). `pieces` keeps drawing it flat until "rest" has been sung,
// because "rest" starts right after the cut. Each glyph lights from Lyrics.wordProgress: lamp while sung,
// bone after, never early.
import { H, SCALE, scaleContext2D, W } from '../engine/gl';
import { Lyrics, type Line, type Word } from '../engine/lyrics';
import { rgba } from '../engine/palette';
import { F, font, layout, type TextLayout } from '../engine/type';
import { clamp, smoothstep } from '../engine/util';
import { SEAM_Y } from './_motifs';

// ------------------------------------------------------------------ the room and the camera (metres)
export const FOC = 1000; // focal length, logical px
export const EYE = 1.0; // camera height above the floor
export const ZW = 2.0; // distance to the far wall
export const CX = W / 2;
export const YH = SEAM_Y - (FOC * EYE) / ZW; // horizon (eye level) on screen: 740; at pitch 0 the seam is at SEAM_Y
export const NEAR = 0.06;
const ROW = 0.94; // row pitch, em

export /** A textured plane whose texture rows are world lines parallel to X: row v at (oy, oz) + v·m·(vy, vz). */
interface Plane { cv: HTMLCanvasElement; tw: number; th: number; m: number; oy: number; oz: number; vy: number; vz: number }

export function texCanvas(w: number, h: number) {
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(w * SCALE);
  cv.height = Math.ceil(h * SCALE);
  const c = scaleContext2D(cv.getContext('2d')!, SCALE);
  return { cv, c };
}

/**
 * Draw a plane in perspective, one destination row at a time (rows are horizontal because the camera never
 * rolls): each screen row's ray meets the plane at texture row v, and that texture row is drawn there scaled
 * by FOC/depth. `step` is the row height in logical px; `alphaAt(y)` fades rows by screen y.
 */
export function drawPlane(c: CanvasRenderingContext2D, P: Plane, p: number, step: number, alpha = 1, alphaAt?: (y: number) => number) {
  const cp = Math.cos(p), sp = Math.sin(p), oy = P.oy - EYE;
  const S = P.th * P.m;
  // screen extent: the projections of the two end rows (clipped to the near plane)
  const zcAt = (s: number) => (P.oz + s * P.vz) * cp + (oy + s * P.vy) * sp;
  let s0 = 0, s1 = S;
  const za = zcAt(0), zb = zcAt(S);
  if (za <= NEAR && zb <= NEAR) return;
  if (za <= NEAR) s0 = (NEAR - za) / (zb - za) * S + 1e-4;
  if (zb <= NEAR) s1 = (NEAR - za) / (zb - za) * S - 1e-4;
  const yAt = (s: number) => { const Y = oy + s * P.vy, Z = P.oz + s * P.vz; return YH - (FOC * (Y * cp - Z * sp)) / (Z * cp + Y * sp); };
  let ya = yAt(s0), yb = yAt(s1);
  if (ya > yb) [ya, yb] = [yb, ya];
  ya = Math.max(ya, -2); yb = Math.min(yb, H + 2);
  if (yb <= ya) return;
  const sAt = (y: number) => {
    const k = (YH - y) / FOC;
    const dy = k * cp + sp, dz = cp - k * sp;
    const s = (dz * oy - dy * P.oz) / (dy * P.vz - dz * P.vy);
    const lam = Math.abs(dz) > Math.abs(dy) ? (P.oz + s * P.vz) / dz : (oy + s * P.vy) / dy;
    return { s, lam };
  };
  const st = Math.max(1 / SCALE, step);
  const y0 = Math.floor(ya * SCALE) / SCALE;
  c.save();
  for (let y = y0; y < yb; y += st) {
    const A = sAt(y), B = sAt(y + st);
    if (A.lam <= NEAR || B.lam <= NEAR) continue;
    let va = clamp(A.s, s0, s1) / P.m, vb = clamp(B.s, s0, s1) / P.m;
    if (va > vb) [va, vb] = [vb, va];
    if (vb - va <= 1e-4) continue;
    const a = alpha * (alphaAt ? alphaAt(y + st / 2) : 1);
    if (a <= 0.002) continue;
    const k = (FOC / ((A.lam + B.lam) / 2)) * P.m; // screen px per texture px on this row
    c.globalAlpha = a;
    c.drawImage(P.cv, 0, va * SCALE, P.tw * SCALE, Math.max((vb - va) * SCALE, 0.5), CX - (P.tw / 2) * k, y, P.tw * k, st);
  }
  c.restore();
}

/** One word's glyphs: dim ≤ 0.4 s early, lamp glyph by glyph while sung (never early), bone after. */
export function drawWordGlyphs(c: CanvasRenderingContext2D, w: Word, L: TextLayout, x: number, y: number, t: number, after = 0.92) {
  if (t < w.start - 0.4) return;
  const pre = smoothstep(w.start - 0.4, w.start - 0.2, t);
  const n = L.glyphs.length, pr = Lyrics.wordProgress(w, t);
  c.font = font(L.family, L.size);
  for (const g of L.glyphs) {
    const lit = t >= w.start && t < w.end ? clamp(pr * n - g.i) : t >= w.end ? 1 : 0;
    const base = t < w.start ? 0.3 * pre : 0.3;
    if (t >= w.end) { c.fillStyle = rgba('bone', after); c.fillText(g.ch, x + g.x, y); continue; }
    if (lit < 1) { c.fillStyle = rgba('bone', base * (1 - lit)); c.fillText(g.ch, x + g.x, y); }
    if (lit > 0) { c.fillStyle = rgba('lamp', lit); c.fillText(g.ch, x + g.x, y); }
  }
}

/** "While I'm struggling / to rest" as a plane hinged on the floor (texture 1:1 when upright). */
export class FloorLine {
  readonly line: Line;
  readonly size: number;
  readonly zb: number; // depth of its baseline on the floor
  readonly baseY: number; // its baseline's screen y (pitch 0)
  private tex: { cv: HTMLCanvasElement; c: CanvasRenderingContext2D; tw: number; th: number };
  private fam = F.archivo(62.5, 900);
  private lc = new Map<string, TextLayout>();

  constructor(lyrics: Lyrics) {
    this.line = lyrics.lines.find((l) => /struggling to rest/i.test(l.text))!;
    const ws = this.line.words;
    const rows = [ws.slice(0, 3), ws.slice(3)].map((r) => r.map((w) => w.w).join(' '));
    this.size = Math.floor(Math.min(132, ...rows.map((r) => (132 * 840) / this.lay(r, 132).width)));
    const th = Math.ceil(this.size * (ROW + 0.78));
    this.tex = { ...texCanvas(980, th), tw: 980, th };
    // when flat, its far edge lies just in front of the wall
    this.zb = (ZW - 0.02) / (1 + th / FOC);
    this.baseY = YH + (FOC * EYE) / this.zb;
  }

  private lay(text: string, size: number) {
    const k = `${size}|${text}`;
    let l = this.lc.get(k);
    if (!l) { l = layout(text, this.fam, size); this.lc.set(k, l); }
    return l;
  }

  /** Draw at time t, rotated `angle` (0 = upright, π/2 = flat on the floor), scaled vertically by `up` about its baseline. */
  draw(c: CanvasRenderingContext2D, t: number, angle: number, up = 1, alpha = 1) {
    if (alpha <= 0.002 || up <= 0) return;
    const T = this.tex, tc = T.c, size = this.size, ws = this.line.words;
    tc.setTransform(1, 0, 0, 1, 0, 0);
    tc.clearRect(0, 0, T.tw, T.th);
    // two rows into the texture, the bottom row's baseline on the texture's bottom edge
    const rows = [ws.slice(0, 3), ws.slice(3)];
    const yLast = T.th - 2;
    rows.forEach((row, ri) => {
      const y = yLast - (rows.length - 1 - ri) * size * ROW;
      const Ls = row.map((w) => this.lay(w.w, size));
      const sp = this.lay(' ', size).width * 0.9;
      const wsum = Ls.reduce((a, L) => a + L.width, 0) + sp * (row.length - 1);
      let x = T.tw / 2 - wsum / 2;
      row.forEach((w, i) => { drawWordGlyphs(tc, w, Ls[i]!, x, y, t); x += Ls[i]!.width + sp; });
    });
    // the plane: hinged on the floor at depth zb, rotated away from the camera
    const m = this.zb / FOC, hgt = T.th * m;
    const P: Plane = { cv: T.cv, tw: T.tw, th: T.th, m, oy: hgt * Math.cos(angle), oz: this.zb + hgt * Math.sin(angle), vy: -Math.cos(angle), vz: -Math.sin(angle) };
    c.save();
    c.translate(0, this.baseY); c.scale(1, up); c.translate(0, -this.baseY);
    drawPlane(c, P, 0, 1 / SCALE, alpha);
    c.restore();
  }
}

const cache = new WeakMap<Lyrics, FloorLine>();
/** The floor line lying flat, exactly as `ceiling` leaves it, lit by the words' timing at t. */
export function drawFloorLine(c: CanvasRenderingContext2D, ctx: { lyrics: Lyrics }, t: number, alpha = 1) {
  let fl = cache.get(ctx.lyrics);
  if (!fl) { fl = new FloorLine(ctx.lyrics); cache.set(ctx.lyrics, fl); }
  fl.draw(c, t, Math.PI / 2, 1, alpha);
}
