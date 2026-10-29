/**
 * World plan (metres-ish). One continuous space, travelled by one camera.
 *
 *   ROOM     back wall is the plane z = 0; floor y = 0; RUDO sits against the wall.
 *   WALL     the same plane runs on up to y = EDGE. After the 808 the camera turns 90°
 *            and that wall becomes the ground it skims over, following the cracks.
 *   TRENCH   the crack opens into a canyon cut into the wall (z from -10 to 0), verse 1.
 *   STAIRS   pre-chorus: one step per sung word, climbing back up to the wall surface.
 *   SKY      chorus: we burst out through the lid. The wall surface is now a rooftop under
 *            a night sky ("up" is +z, the horizon glow is toward +y). RUDO sits at the edge.
 */
import * as THREE from "three";
import { Line, linesOf, sectionById } from "../data";

export const ROOM = { halfW: 3.2, depth: 9, height: 4.4 };
export const RUDO_POS = new THREE.Vector3(0, 0.66, 0.42);
export const CRACK_ORIGIN = new THREE.Vector2(0, 2.35);
export const SLOT = { y0: 30.5, y1: 40, halfW: 0.55 };
export const TRENCH = { y0: 30.5, y1: 141.5, halfW: 1.6, floor: -10 };
export const STAIRS = { y0: 118, run: 0.62 };
export const EDGE = 215;

export const PRE = linesOf("prechorus1");
export const PRE_WORDS = PRE.flatMap((l) => l.words);
export const STAIR_RISE = Math.abs(TRENCH.floor) / (PRE_WORDS.length + 0.3);
export const stepPos = (k: number) => ({ y: STAIRS.y0 + k * STAIRS.run, z: TRENCH.floor + (k + 1) * STAIR_RISE });
export const LID = { y0: stepPos(PRE_WORDS.length - 1).y - 2.2, y1: TRENCH.y1 };

export const CH1 = sectionById("chorus1");
export const V2 = sectionById("verse2");
export const PRE2 = sectionById("prechorus2");
export const CH2 = sectionById("chorus2");
export const V3 = sectionById("verse3");
export const BR = sectionById("bridge");
export const CH3 = sectionById("chorus3");
export const POST2 = sectionById("postchorus2");
export const OUTRO = sectionById("outro");

/** Slab corridor (post-choruses), floating above the roof in the sky region. */
export const SLABS = { y0: 242, y1: 300, z: 21 };
/** The flip house (y-up), far from the wall world. */
export const HO = new THREE.Vector3(300, 0, 0);
export const HOUSE = { halfW: 4, z0: 0, z1: -14, wallH: 2.45 };
export const PRE2_WORDS = linesOf("prechorus2").flatMap((l) => l.words);
export const STAIR2 = { z0: -14.6, rise: 0.21, run: 0.36 };
export const step2Pos = (k: number) => ({ y: (k + 1) * STAIR2.rise, z: STAIR2.z0 - k * STAIR2.run });
export const DECK = { y: (PRE2_WORDS.length) * STAIR2.rise, z0: STAIR2.z0 - PRE2_WORDS.length * STAIR2.run, edge: STAIR2.z0 - PRE2_WORDS.length * STAIR2.run - 26 };
/** Midnight desk + hallway (y-up). */
export const DO = new THREE.Vector3(-300, 0, 0);
export const HALL = { z0: -6, z1: -44, halfW: 1.1, h: 2.8 };

// ---------------------------------------------------------------------------------------------
type V = [number, number, number];
export type Key = { t: number; p: V; l: V; up?: V; fov?: number };
const Y: V = [0, 1, 0];
const Z: V = [0, 0, 1];

const keys: Key[] = [];
const k = (t: number, p: V, l: V, up: V, fov = 40) => keys.push({ t, p, l, up, fov });

// intro: the room
k(0.0, [0, 1.55, 8.6], [0, 1.25, 0], Y, 38);
k(3.6, [0, 1.5, 8.1], [0, 1.25, 0], Y, 38);
k(4.6, [0.05, 1.45, 7.5], [0, 1.3, 0], Y, 40);
k(6.6, [-0.1, 1.42, 6.5], [0.1, 1.35, 0], Y, 42);
k(8.1, [0.15, 1.35, 3.85], [-0.2, 1.1, 0], Y, 44);
k(9.6, [0.95, 1.15, 3.35], [-1.7, 0.4, 2.4], Y, 44);
k(11.0, [0.6, 0.9, 3.1], [-1.6, 0.4, 2.35], Y, 42);
k(12.8, [0.95, 0.95, 2.15], [0, 0.95, 0.45], Y, 42);
k(14.6, [-0.6, 1.3, 1.45], [0, 1.15, 0.45], Y, 40);
k(16.2, [0.25, 1.75, 1.05], [0, 1.95, 0.2], Y, 42);
k(17.15, [0.05, 2.05, 0.9], [0, 2.4, 0], Y, 44);
// the drop: lunge at the wall, then turn so the wall becomes the ground
k(17.6, [0, 2.3, 0.95], [0, 3.1, 0], [0, 0.6, 0.8], 50);
k(18.4, [0, 2.75, 0.55], [0, 5.5, 0.0], Z, 56);
k(22.0, [0.35, 8.6, 1.2], [0.1, 13, 0], Z, 58);
k(26.0, [-0.3, 19.2, 1.35], [0, 24, 0], Z, 60);
k(28.5, [0, 28.4, 0.9], [0, 33, -1.4], Z, 60);
// dive through the slot into the trench
k(29.4, [0, 32.6, -2.7], [0, 37.5, -6.2], Z, 58);
k(30.6, [0, 36.6, -6.3], [0, 42.6, -6.6], Z, 56);
// verse 1: race up the canyon
const TR_T0 = 30.6;
const TR_T1 = sectionById("prechorus1").start;
const TR_V = (STAIRS.y0 - 2.6 - 36.6) / (TR_T1 - TR_T0);
for (let t = TR_T0 + 1.6; t < TR_T1 - 0.2; t += 1.6) {
  const y = 36.6 + (t - TR_T0) * TR_V;
  const x = 0.42 * Math.sin(t * 0.55);
  const z = -6.3 + 0.7 * Math.sin(t * 0.37 + 1);
  k(t, [x, y, z], [x * 0.3, y + 6, z - 0.2], [Math.sin(t * 0.55) * 0.08, 0, 1], 56);
}
// pre-chorus: climb, one step per word
PRE_WORDS.forEach((w, i) => {
  const s = stepPos(i);
  k(w.s + 0.06, [0, s.y - 2.5, s.z + 1.35], [0, s.y + 2.2, s.z - 0.05], Z, 52 - (i / PRE_WORDS.length) * 6);
});
const top = stepPos(PRE_WORDS.length - 1);
k(CH1.start - 0.05, [0, top.y - 1.4, top.z + 1.3], [0, top.y + 2.5, top.z + 3.2], Z, 46);
// chorus 1: burst out into the sky, cruise toward the edge, then the universe
k(CH1.start + 1.1, [0, top.y + 1.8, 2.4], [0, top.y + 20, 3.4], Z, 46);
k(63.4, [0.45, 162, 2.8], [0, 185, 3.2], Z, 46);
k(68.0, [-0.5, 182, 2.3], [0, 205, 2.6], Z, 46);
k(72.6, [0.3, 203, 2.5], [0, EDGE, 1.7], Z, 44);
k(75.4, [0.2, 207.5, 2.8], [0, EDGE + 6, 5.0], Z, 46);
k(77.2, [0, 222, 40], [0, 250, 150], Z, 72);
// post-chorus 1: fall back out of the stars into a corridor of stamped slabs above the roof
k(80.4, [0, 236, 36], [0, 250, 22], Z, 58);
k(83.0, [0, 244, 24], [0, 256, 21], Z, 52);
k(88.0, [0.4, 258, 21.4], [0, 270, 20.6], Z, 50);
k(93.0, [-0.4, 272, 21.2], [0, 284, 20.4], Z, 50);
k(V2.start - 0.02, [0, 284, 21], [0, 296, 20], Z, 52);

// ---- shot 2: the flip house (verse 2), its outside stair (pre-chorus 2), the deck at sunrise (chorus 2)
const H = (x: number, y: number, z: number): V => [HO.x + x, HO.y + y, HO.z + z];
k(V2.start, H(0.4, 1.7, 7.5), H(0, 1.3, 0), Y, 44);
k(103.5, H(-0.3, 1.5, 2.2), H(0, 1.2, -3), Y, 50);
k(108.0, H(1.6, 1.2, -1.5), H(-1.5, 1.0, -4.5), Y, 52);
k(113.0, H(-1.2, 1.9, -4.6), H(2.2, 1.0, -6.0), Y, 52);
k(118.0, H(0.9, 0.7, -6.8), H(-1.0, 0.25, -9.5), Y, 50);
k(123.0, H(-1.5, 1.6, -9.6), H(2.0, 1.4, -11.5), Y, 50);
k(128.0, H(0.2, 2.1, -11.2), H(0, 1.2, -14.5), Y, 48);
PRE2_WORDS.forEach((w, i) => {
  const s = step2Pos(i);
  k(w.s + 0.06, H(0, s.y + 1.4, s.z + 2.4), H(0, s.y - 0.1, s.z - 2.0), Y, 52 - (i / PRE2_WORDS.length) * 6);
});
const top2 = step2Pos(PRE2_WORDS.length - 1);
k(CH2.start + 1.0, H(0, top2.y + 2.2, top2.z - 2.5), H(0, top2.y + 3.0, top2.z - 20), Y, 46);
k(150.0, H(0.4, top2.y + 1.9, DECK.edge + 9), H(0, top2.y + 2.4, DECK.edge - 12), Y, 46);
k(156.0, H(-0.4, top2.y + 1.7, DECK.edge + 4.5), H(0, top2.y + 1.6, DECK.edge - 10), Y, 44);
k(V3.start - 0.02, H(0, top2.y + 1.5, DECK.edge + 2.6), H(0, top2.y + 1.9, DECK.edge - 10), Y, 44);

// ---- shot 3: midnight desk (verse 3) and the hallway behind it (bridge)
const D = (x: number, y: number, z: number): V => [DO.x + x, DO.y + y, DO.z + z];
k(V3.start, D(0.2, 1.3, 3.6), D(0, 1.0, -1.5), Y, 42);
k(166.0, D(-1.8, 1.6, 2.4), D(0.2, 1.1, -2.8), Y, 46);
k(171.0, D(1.9, 2.1, 1.6), D(-0.2, 1.7, -3.2), Y, 48);
k(176.0, D(-1.2, 2.9, 1.2), D(0, 2.6, -3.4), Y, 50);
k(181.0, D(0, 3.6, 0.8), D(0, 3.2, -4.0), Y, 50);
k(BR.start + 0.3, D(0, 1.55, HALL.z0 + 1.0), D(0, 1.5, HALL.z0 - 6), Y, 44);
k(CH3.start - 0.02, D(0, 1.5, HALL.z0 - 9), D(0, 1.45, HALL.z0 - 16), Y, 44);

// ---- shot 4: final chorus, everything lifts into the sky; final post-chorus through the slabs
k(CH3.start, [0, 150, 1.6], [0, 175, 4], Z, 48);
k(197.0, [0.5, 160, 6], [0, 185, 12], Z, 50);
k(203.0, [-0.6, 170, 13], [0, 195, 20], Z, 52);
k(209.0, [0.3, 182, 19], [0, 210, 23], Z, 52);
k(POST2.start, [0, 236, 30], [0, 250, 22], Z, 56);
k(OUTRO.start - 0.02, [0, 268, 21.2], [0, 282, 20.4], Z, 50);

// ---- shot 5: outro, back in the room
k(OUTRO.start, [0, 1.5, 6.4], [0, 1.25, 0], Y, 40);
k(236.0, [0, 1.42, 4.0], [0, 1.15, 0], Y, 40);
k(241.5, [0, 1.38, 3.2], [0, 1.1, 0], Y, 38);

keys.sort((a, b) => a.t - b.t);
export const CAM_KEYS = keys;
/** Hard cuts: the camera interpolates only between keys of the same shot. */
export const SHOT_STARTS = [0, V2.start, V3.start, CH3.start, OUTRO.start];
const shotOf = (t: number) => SHOT_STARTS.filter((s) => t >= s).length - 1;

// ---------------------------------------------------------------------------------------------
// Time-domain Catmull-Rom (cubic Hermite with tangents from neighbours): C1-smooth velocity.
const SHOT_KEYS = SHOT_STARTS.map((_, i) => CAM_KEYS.filter((k) => shotOf(k.t) === i));
const herm = (t: number, get: (k: Key) => V): THREE.Vector3 => {
  const K = SHOT_KEYS[shotOf(t)];
  if (t <= K[0].t) return new THREE.Vector3(...get(K[0]));
  if (t >= K[K.length - 1].t) return new THREE.Vector3(...get(K[K.length - 1]));
  let i = 0;
  while (K[i + 1].t < t) i++;
  const k0 = K[Math.max(0, i - 1)], k1 = K[i], k2 = K[i + 1], k3 = K[Math.min(K.length - 1, i + 2)];
  const dt = k2.t - k1.t;
  const s = (t - k1.t) / dt;
  const p1 = new THREE.Vector3(...get(k1)), p2 = new THREE.Vector3(...get(k2));
  const m1 = new THREE.Vector3(...get(k2)).sub(new THREE.Vector3(...get(k0))).multiplyScalar(dt / Math.max(1e-3, k2.t - k0.t));
  const m2 = new THREE.Vector3(...get(k3)).sub(new THREE.Vector3(...get(k1))).multiplyScalar(dt / Math.max(1e-3, k3.t - k1.t));
  // dampen tangents at keys where direction reverses hard (avoids overshoot)
  const h00 = 2 * s ** 3 - 3 * s ** 2 + 1, h10 = s ** 3 - 2 * s ** 2 + s, h01 = -2 * s ** 3 + 3 * s ** 2, h11 = s ** 3 - s ** 2;
  return p1.multiplyScalar(h00).add(m1.multiplyScalar(h10 * 0.85)).add(p2.multiplyScalar(h01)).add(m2.multiplyScalar(h11 * 0.85));
};

export type CamState = { pos: THREE.Vector3; look: THREE.Vector3; up: THREE.Vector3; fov: number };
export const camAt = (t: number): CamState => {
  const pos = herm(t, (k) => k.p);
  const look = herm(t, (k) => k.l);
  const up = herm(t, (k) => k.up ?? Y).normalize();
  const fov = herm(t, (k) => [k.fov ?? 40, 0, 0]).x;
  return { pos, look, up, fov };
};

/** Where a lyric line should live so the camera meets it while it is sung. */
export const lineAnchor = (l: Line, lead = 0.45) => camAt(l.end + lead).pos;
