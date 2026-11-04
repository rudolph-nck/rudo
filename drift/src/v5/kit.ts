import * as THREE from "three";
import { Font } from "three/examples/jsm/loaders/FontLoader.js";
import { capHeight, layout } from "../words/glyphs";
import { clamp01 } from "../utils/ease";

/**
 * Drift v3 kit — flat typography in a void.
 * Every letter is a perfectly flat vector shape (the font's own outlines → ShapeGeometry): no extrusion, no bevel,
 * no lighting. Beauty comes from scale, arrangement and the bloom.
 */
const gcache = new Map<string, THREE.ShapeGeometry>();
export const flatGlyph = (font: Font, ch: string, size: number) => {
  const k = `${(font.data as { familyName?: string }).familyName}|${ch}|${size}`;
  let g = gcache.get(k);
  if (g) return g;
  const d = font.data as unknown as { glyphs: Record<string, { ha: number }>; resolution: number };
  const adv = ((d.glyphs[ch]?.ha ?? 500) / d.resolution) * size;
  g = new THREE.ShapeGeometry(font.generateShapes(ch, size), 10);
  g.translate(-adv / 2, -capHeight(font, size) / 2, 0);
  gcache.set(k, g);
  return g;
};

/** Centre of the largest counter (hole) of a glyph, relative to the letter's centre — for flying through a D or an O. */
export const counterOf = (font: Font, ch: string, size: number) => {
  const d = font.data as unknown as { glyphs: Record<string, { ha: number }>; resolution: number };
  const adv = ((d.glyphs[ch]?.ha ?? 500) / d.resolution) * size;
  let best: THREE.Box2 | null = null, area = 0;
  for (const s of font.generateShapes(ch, size)) for (const h of s.holes) {
    const b = new THREE.Box2().setFromPoints(h.getPoints(24));
    const sz = b.getSize(new THREE.Vector2()), a = sz.x * sz.y;
    if (a > area) { area = a; best = b; }
  }
  if (!best) return null;
  const c = best.getCenter(new THREE.Vector2());
  return { x: c.x - adv / 2, y: c.y - capHeight(font, size) / 2, w: best.max.x - best.min.x, h: best.max.y - best.min.y };
};

/** Flat material: unlit colour × intensity (values over ~0.6 feed the bloom). Cached by colour/intensity/opacity. */
const mcache = new Map<string, THREE.MeshBasicMaterial>();
export const flatMat = (hex: string, k: number, o: number) => {
  const kq = Math.round(k * 20) / 20, oq = Math.round(clamp01(o) * 40) / 40;
  const key = `${hex}|${kq}|${oq}`;
  let m = mcache.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(kq), transparent: true, opacity: oq, depthWrite: false, side: THREE.DoubleSide });
    mcache.set(key, m);
  }
  return m;
};

export { layout, capHeight };

// ---------------------------------------------------------------------------------------------
/**
 * THE CAMERA: one continuous journey. Position is the integral of a single velocity profile built only from wide
 * cubic ramps, so position AND velocity are continuous everywhere — no jumps, no whips, no springs. The camera never
 * rotates around anything; it only looks forward (with a gentle pitch while it descends).
 */
const sm = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
const ramp = (t: number, t0: number, d: number) => sm((t - t0) / d);
export const BEATS = {
  verseIn: 23.0, lockIn: 27.85, rest: 29.47, plunge: 51.2, halt: 53.0, crawl: 53.4, launch: 57.1, dPass: 61.45,
};
const V_DROP = 3.0;
export const velocity = (t: number) => {
  const B = BEATS;
  // ACT 2 — steady heavy drop + a slow forward push; the lock on STRUGGLING TO REST; the stone-drop chase on REST;
  // the plummet into the void on "when the darkness starts to call"
  const drop = ramp(t, B.verseIn, 1.0) * (1 - ramp(t, B.halt, 1.1));
  const lock = ramp(t, B.lockIn, 0.5) * (1 - ramp(t, B.rest + 0.02, 0.18));
  const chase = ramp(t, B.rest + 0.02, 0.22) * (1 - ramp(t, B.rest + 0.45, 1.3));
  const plunge = ramp(t, B.plunge, 1.3) * (1 - ramp(t, B.halt, 1.1));
  const vy = -V_DROP * drop * (1 - lock) - 15 * chase - 22 * plunge;
  // forward: push during the drop, organic crawl in the pre-chorus, the infinite glide in the chorus
  const fast = ramp(t, B.launch, 1.6) * (1 - ramp(t, B.dPass + 0.15, 1.6));
  const cruise = ramp(t, B.dPass + 0.15, 1.6);
  const vz = -0.6 * drop - 0.8 * ramp(t, B.crawl, 1.0) - 5.4 * fast - 2.4 * cruise;
  return new THREE.Vector3(0, vy, vz);
};
const DT = 1 / 240, TMAX = 96;
const TABLE = (() => {
  const n = Math.ceil(TMAX / DT) + 1, out = new Float32Array(n * 3);
  let x = 0, y = 0, z = 0;
  for (let i = 0; i < n; i++) {
    out[i * 3] = x; out[i * 3 + 1] = y; out[i * 3 + 2] = z;
    const v = velocity(i * DT + DT / 2); x += v.x * DT; y += v.y * DT; z += v.z * DT;
  }
  return out;
})();
/** Camera position on the journey (before the slow pan). */
export const pathAt = (t: number) => {
  const f = clamp01(t / TMAX) * (TABLE.length / 3 - 1), i = Math.floor(f), u = f - i, j = Math.min(i + 1, TABLE.length / 3 - 1);
  return new THREE.Vector3(TABLE[i * 3] + (TABLE[j * 3] - TABLE[i * 3]) * u, TABLE[i * 3 + 1] + (TABLE[j * 3 + 1] - TABLE[i * 3 + 1]) * u, TABLE[i * 3 + 2] + (TABLE[j * 3 + 2] - TABLE[i * 3 + 2]) * u);
};
/** Minor, slow X/Y panning in the chorus (very low frequency, so it only ever reads as drift). */
export const panAt = (t: number) => { const k = ramp(t, 57.0, 3); return new THREE.Vector3(Math.sin((t - 57) * 0.13) * 0.9 * k, Math.sin((t - 57) * 0.09 + 0.5) * 0.45 * k - 0.45 * Math.sin(0.5) * k, 0); };
/** Pitch (radians, negative = looking down): gentle while descending. */
export const pitchAt = (t: number) => -0.08 * ramp(t, BEATS.verseIn, 1.2) * (1 - ramp(t, BEATS.halt, 1.4));
export const camAt = (t: number) => {
  const p = pathAt(t).add(panAt(t));
  const pi = pitchAt(t);
  return { p, l: p.clone().add(new THREE.Vector3(0, Math.sin(pi), -Math.cos(pi))) };
};
/** Where the centre of view lands at distance d in front of the camera at time t. */
export const viewPoint = (t: number, d: number) => { const c = camAt(t); return c.p.clone().add(c.l.clone().sub(c.p).multiplyScalar(d)); };
