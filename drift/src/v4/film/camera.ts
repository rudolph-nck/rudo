import * as THREE from "three";
import { spring } from "remotion";
import { FPS } from "../../data";

/**
 * Camera cinematography helpers.
 * - `springK`: Remotion spring (critically damped, heavy) as a 0..1 progress from a start time: zero velocity at the
 *   start, settles without overshoot — weight, not tweening.
 * - `drift`: the continuous floating-rig loop on X/Y (sin(frame·0.01)·0.04, with a slower Y partner) plus a tiny
 *   second octave so it never reads as a pure sine.
 * - `orbitAround`: place the camera on a circle around a subject (yaw in radians), for 90–180° orbit holds.
 * - `throughHole`: a Z fly-through — approach, pass through the counter of a letter, exit on the far side.
 */
export const springK = (t: number, t0: number, cfg: { damping?: number; mass?: number; stiffness?: number } = {}) =>
  t < t0 ? 0 : spring({ frame: (t - t0) * FPS, fps: FPS, config: { damping: cfg.damping ?? 200, mass: cfg.mass ?? 1.6, stiffness: cfg.stiffness ?? 70 } });

export const drift = (t: number, amp = 0.04) => {
  const f = t * FPS;
  return new THREE.Vector3(Math.sin(f * 0.01) * amp + Math.sin(f * 0.027 + 1.3) * amp * 0.25, Math.sin(f * 0.0073 + 0.6) * amp * 0.8 + Math.sin(f * 0.021) * amp * 0.2, 0);
};

export const orbitAround = (c: THREE.Vector3, yaw: number, dist: number, h: number) => c.clone().add(new THREE.Vector3(Math.sin(yaw) * dist, h, Math.cos(yaw) * dist));

/** Fly through a hole at `hole` travelling along -dirZ: k 0 → start (dist in front), 0.8 → in the counter, 1 → beyond. */
export const throughHole = (hole: THREE.Vector3, normal: THREE.Vector3, k: number, before: number, after: number) => {
  const s = before - (before + after) * k;
  return { p: hole.clone().addScaledVector(normal, s), l: hole.clone().addScaledVector(normal, s - 2) };
};
