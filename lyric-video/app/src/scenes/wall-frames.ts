// The certificate frames of plate 4 `wall`, shared so `dark` (plate 5) can keep them "as faint hairlines"
// in exactly the place `wall`'s last frame leaves them (frontal camera, seam at SEAM_Y).
// World coordinates on the wall plane = screen px when the camera is frontal (wall's first/last frames).
import { rgba } from '../engine/palette';
import { HAIR } from './_motifs';

export interface WallFrame {
  /** centre, size (px) and tilt (radians) as hung */
  x: number; y: number; w: number; h: number; rot: number;
  /** 'title' = carries a lyric line; 'small' = one of the frames that multiply */
  kind: 'title' | 'small';
  heading: string;
  date: string;
}

const deg = Math.PI / 180;

/** The two title certificates, then the four small ones (in hanging order). */
export const WALL_FRAMES: WallFrame[] = [
  { x: 540, y: 470, w: 740, h: 320, rot: -0.6 * deg, kind: 'title', heading: 'IN RECOGNITION OF', date: 'AWARDED · 2019' },
  { x: 560, y: 830, w: 700, h: 300, rot: 1.3 * deg, kind: 'title', heading: 'PRESENTED FOR', date: 'AWARDED · 2021' },
  { x: 230, y: 372, w: 236, h: 166, rot: -7 * deg, kind: 'small', heading: 'With Distinction', date: '2016' },
  { x: 872, y: 650, w: 222, h: 154, rot: 5.5 * deg, kind: 'small', heading: 'Top Performer', date: 'Q3 · 2022' },
  { x: 214, y: 905, w: 232, h: 160, rot: 4 * deg, kind: 'small', heading: 'Employee of the Month', date: 'MAR · 2020' },
  { x: 868, y: 318, w: 220, h: 152, rot: -4.5 * deg, kind: 'small', heading: 'Certificate of Merit', date: '2018' },
];

/** The frame's nail sits this far above its top edge; the wire runs to points `WIRE` of the width in. */
export const NAIL_RISE = 52;
export const WIRE = 0.3;

/** Corners of a frame (or of its inner rule, inset `inset`), rotated about its centre: TL, TR, BR, BL. */
export function frameCorners(fr: { x: number; y: number; w: number; h: number; rot: number }, inset = 0, dy = 0, drot = 0) {
  const c = Math.cos(fr.rot + drot), s = Math.sin(fr.rot + drot);
  const hw = fr.w / 2 - inset, hh = fr.h / 2 - inset;
  return ([[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]] as const).map(([u, v]) => ({ x: fr.x + u * c - v * s, y: fr.y + dy + u * s + v * c }));
}

/**
 * The frames as hairlines only (frontal), for `dark`: outer frame, inner rule, the nail and its wire.
 * `color` defaults to ink (bone paper); on the ink plate pass 'bone' or 'dust' with a low alpha.
 */
export function drawWallFrames2D(c: CanvasRenderingContext2D, o: { alpha?: number; color?: string; width?: number } = {}) {
  const a = o.alpha ?? 0.25;
  c.save();
  c.lineWidth = o.width ?? HAIR;
  c.strokeStyle = rgba(o.color ?? 'ink', a);
  for (const fr of WALL_FRAMES) {
    for (const inset of [0, 13]) {
      const q = frameCorners(fr, inset);
      c.beginPath(); q.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); c.closePath(); c.stroke();
    }
    const q = frameCorners(fr);
    const nx = (q[0]!.x + q[1]!.x) / 2 + Math.sin(fr.rot) * NAIL_RISE, ny = (q[0]!.y + q[1]!.y) / 2 - Math.cos(fr.rot) * NAIL_RISE;
    const wa = { x: q[0]!.x + (q[1]!.x - q[0]!.x) * WIRE, y: q[0]!.y + (q[1]!.y - q[0]!.y) * WIRE };
    const wb = { x: q[1]!.x + (q[0]!.x - q[1]!.x) * WIRE, y: q[1]!.y + (q[0]!.y - q[1]!.y) * WIRE };
    c.beginPath(); c.moveTo(wa.x, wa.y); c.lineTo(nx, ny); c.lineTo(wb.x, wb.y); c.stroke();
    c.fillStyle = rgba(o.color ?? 'ink', a * 1.6);
    c.beginPath(); c.arc(nx, ny, 3, 0, Math.PI * 2); c.fill();
  }
  c.restore();
}
