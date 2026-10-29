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
k(80.4, [0, 245, 135], [0, 300, 260], Z, 60);

keys.sort((a, b) => a.t - b.t);
export const CAM_KEYS = keys;

// ---------------------------------------------------------------------------------------------
// Time-domain Catmull-Rom (cubic Hermite with tangents from neighbours): C1-smooth velocity.
const herm = (t: number, get: (k: Key) => V): THREE.Vector3 => {
  const K = CAM_KEYS;
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
