import React, { useMemo } from "react";
import * as THREE from "three";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { useAssets } from "../three/assets";
import { FilmStage } from "./film/FilmStage";
import { CAGE, VOID, mixLook } from "./film/looks";
import { KeySpot, keySpotPos } from "./film/env";
import { drift, orbitAround, springK, throughHole } from "./film/camera";
import { LINES, T } from "../data";
import { clamp01, cubicIn, cubicInOut, cubicOut, mix } from "../utils/ease";
import { noise1, rng } from "../utils/random";
import { Glow } from "../words/points";
import { layout } from "../words/glyphs";
import { useCutout } from "../sections/S1";
import { FMT } from "../theme";
import { Beh, CamKey, KICKS, L0, SNARES, W, handheld, heat, lastIn, makeCamera } from "./core";
import { C, City, Dust, Earth, LightShaft, Motes, Pod, Popup, Sky, WStyle, Word3D, Workshop, fontFor, layLine } from "./world";

/**
 * DRIFT v2 — Act 1 test (0:00–1:31.8).
 * The workshop: a cluttered room at night, a cold monitor, a slow fan, notifications blinking. The lyrics are the
 * interface: solid extruded words in rigid pop-up windows that pile up around you; the camera is trapped with them,
 * whipping 90° on the snare from window to window. Pre-chorus: you turn to the glass pod, step in, the visor comes
 * down, BREAK flips the manual override. Chorus: the text shatters into glowing dust, the floor drops, the pod
 * rockets out of the city into indigo, the dust becomes a constellation, and the lyrics float in deep space while
 * the camera makes slow panoramic orbits (a full 180° hold around the glowing A of "for a… bit").
 */
export const A1_END = 91.8;
const P0 = new THREE.Vector3(0, 0, 2.9); // the pod, at the south end of the room
const VC = new THREE.Vector3(0, 0, -0.2); // the verse: you, standing in the middle of the wet floor, surrounded
const EYE = 1.05; // verse eye height
const SV = 2.6; // verse windows are architectural: 2.6x scale, standing on the floor
const dirY = (th: number) => new THREE.Vector3(Math.sin(th), 0, -Math.cos(th));
const LAUNCH = 57.16;
const ALT = 1000;
const podY = (t: number) => { const u = clamp01((t - 57.45) / 4.1); return ALT * (u < 0.5 ? 16 * u ** 5 : 1 - Math.pow(-2 * u + 2, 5) / 2); };
const podPos = (t: number) => new THREE.Vector3(P0.x, P0.y + podY(t), P0.z);

type LineDef = { li: number; rows: number[][]; sizes: number[]; beh?: Record<number, Beh>; style: WStyle; tone?: "red" | "blue"; title?: string };
// ---- verse 1: each line is a pop-up window in the ring around you ----
const VERSE: LineDef[] = [
  { li: 6, rows: [[0], [1], [2, 3]], sizes: [0.06, 0.13, 0.06], beh: { 1: "rise" }, style: "city", tone: "blue", title: "CALENDAR · 06:00" },
  { li: 7, rows: [[0, 1], [2, 3, 4]], sizes: [0.1, 0.08], beh: { 1: "squeeze", 4: "beat" }, style: "city", tone: "red", title: "WARNING" },
  { li: 8, rows: [[0, 1, 2], [3, 4, 5]], sizes: [0.05, 0.1], beh: {}, style: "city", tone: "blue", title: "47 NEW COMMENTS" },
  { li: 9, rows: [[0, 1], [2], [3, 4]], sizes: [0.05, 0.11, 0.07], beh: { 2: "jitter", 4: "sag" }, style: "city", tone: "red", title: "SLEEP · 3H 12M" },
  { li: 10, rows: [[0], [1, 2, 3, 4], [5]], sizes: [0.08, 0.05, 0.16], beh: { 5: "split" }, style: "city", tone: "red", title: "REQUESTS (12)" },
  { li: 11, rows: [[0, 1], [2, 3]], sizes: [0.07, 0.13], beh: { 3: "split" }, style: "city", tone: "blue", title: "NO AVAILABILITY" },
  { li: 12, rows: [[0, 1], [2, 3], [4]], sizes: [0.05, 0.07, 0.16], beh: { 4: "drop" }, style: "city", tone: "red", title: "OVERLOAD" },
  { li: 13, rows: [[0, 1, 2, 3], [4]], sizes: [0.05, 0.1], beh: { 1: "dissolve" }, style: "city", tone: "blue", title: "LOST PROPERTY" },
  { li: 14, rows: [[0, 1, 2], [3, 4, 5]], sizes: [0.1, 0.06], beh: { 2: "rise" }, style: "city", tone: "blue", title: "PROFILE · 1.2M" },
  { li: 15, rows: [[0, 1, 2], [3, 4, 5]], sizes: [0.1, 0.06], beh: { 2: "rise", 5: "type" }, style: "city", tone: "blue", title: "VERIFIED" },
  { li: 16, rows: [[0, 1], [2], [3, 4, 5]], sizes: [0.05, 0.12, 0.06], beh: { 2: "rise" }, style: "city", tone: "red", title: "GROWTH −84%" },
  { li: 17, rows: [[0, 1], [2]], sizes: [0.06, 0.1], beh: { 2: "split" }, style: "city", tone: "red", title: "NO SERVICE" },
  { li: 18, rows: [[0], [1], [2, 3]], sizes: [0.05, 0.08, 0.06], beh: { 1: "type", 3: "type" }, style: "city", tone: "blue", title: "RESUME.PDF" },
  { li: 19, rows: [[0], [1], [2, 3, 4]], sizes: [0.05, 0.09, 0.06], beh: { 1: "rise", 4: "freeze" }, style: "city", tone: "blue", title: "AWARDS" },
  { li: 20, rows: [[0, 1, 2, 3, 4], [5]], sizes: [0.05, 0.12], beh: { 5: "dissolve" }, style: "city", tone: "red", title: "VOLUME 100%" },
  { li: 21, rows: [[0, 1], [2], [3, 4, 5]], sizes: [0.05, 0.13, 0.08], beh: {}, style: "city", tone: "red", title: "INCOMING CALL" },
];
// ---- chorus 1: the lines in deep space around the pod ----
const CHORUS: LineDef[] = [
  { li: 24, rows: [[0, 1, 2], [3]], sizes: [0.41, 1.22], beh: { 0: "shatter", 1: "shatter", 2: "shatter", 3: "shatter" }, style: "city" },
  { li: 25, rows: [[0, 1, 2], [3]], sizes: [0.38, 1.35], beh: { 3: "float" }, style: "drift" },
  { li: 26, rows: [[0], [1, 2], [3, 4]], sizes: [0.94, 0.41, 0.74], beh: { 0: "float" }, style: "serif" },
  { li: 27, rows: [[0, 1], [2, 3], [4]], sizes: [0.54, 0.43, 0.81], beh: { 1: "dissolve", 3: "stretch", 4: "dissolve" }, style: "drift" },
  { li: 28, rows: [[0], [1]], sizes: [1.22, 0.57], beh: { 0: "stamp", 1: "shatter" }, style: "drift" },
  { li: 29, rows: [[0], [1]], sizes: [1.22, 0.49], beh: { 0: "stamp", 1: "shatter" }, style: "drift" },
  { li: 30, rows: [[0, 1], [2, 3, 4]], sizes: [0.74, 0.43], beh: { 1: "jitter", 4: "dissolve" }, style: "drift" },
  { li: 31, rows: [[0, 1, 2, 3], [4, 5]], sizes: [0.38, 1.01], beh: { 5: "rise" }, style: "steel" },
  { li: 32, rows: [[0, 1, 2, 3, 4], [5, 6, 7]], sizes: [0.35, 0.81], beh: { 6: "stretch" }, style: "drift" },
  { li: 33, rows: [[0, 1, 2], [3]], sizes: [0.41, 1.22], beh: { 2: "stretch", 3: "rise" }, style: "drift" },
  { li: 34, rows: [[0, 1, 2], [3]], sizes: [0.38, 1.42], beh: { 3: "float" }, style: "drift" },
];
const next = (defs: LineDef[], k: number, fallback: number) => (defs[k + 1] ? L0(defs[k + 1].li) : fallback);

// ---- the verse ring: which way the camera faces for each line (a 90° whip on the snare before each new line) ----
const VTH = VERSE.map((_, k) => Math.PI / 4 + k * (Math.PI / 2));
const whipAt = VERSE.map((d) => { const s = L0(d.li); const sn = SNARES.filter((x) => x <= s && s - x < 0.7); return sn.length ? sn[sn.length - 1] - 0.05 : s - 0.28; });
const WHIP = 0.72; // slow-in / slow-out: the turn straddles the snare instead of snapping on it
const verseYaw = (t: number) => { let th = VTH[0]; for (let k = 1; k < VERSE.length; k++) { const u = springK(t, whipAt[k] - WHIP * 0.4, { damping: 24, mass: 1.6, stiffness: 70 }); th = mix(th, VTH[k], u); } return th; };
/** The camera on a tracking rig: slow, weighted drift (two octaves of smooth noise), never jitter. */
const rig = (t: number, amp: number) => new THREE.Vector3(
  (noise1(t * 0.17, 41) - 0.5) * amp + (noise1(t * 0.43, 44) - 0.5) * amp * 0.3,
  (noise1(t * 0.14, 42) - 0.5) * amp * 0.7 + (noise1(t * 0.39, 45) - 0.5) * amp * 0.2,
  (noise1(t * 0.12, 43) - 0.5) * amp * 0.8);
const lineHeat = (li: number, t: number) => LINES[li].words.reduce((m, w) => Math.max(m, heat(t, w)), 0);
// where each window sits: in front of you on its yaw; older windows pushed back when a new one lands on the same side
const slot = (k: number, t: number) => {
  const pushes = VERSE.filter((d, j) => j > k && j % 4 === k % 4 && t >= L0(d.li) - 0.1).length;
  const r = rng(k + 3);
  const rad = 2.0 + Math.min(3, pushes) * 0.5, side = (r() - 0.5) * 0.5 + pushes * (r() - 0.5) * 0.9;
  const d = dirY(VTH[k]), sd = new THREE.Vector3(-d.z, 0, d.x);
  // the slab stands on the floor; older slabs lean back a little as they're pushed away
  return { pos: VC.clone().addScaledVector(d, rad).addScaledVector(sd, side), rotY: -VTH[k] + (r() - 0.5) * 0.22, tilt: -0.04 * pushes + (r() - 0.5) * 0.03, dim: pushes };
};

// ---- intro camera (spline), pre-chorus camera (spline) ----
// The room: desk + monitor against the north wall, the pod to the south, a wet concrete floor between them where
// the intro words stand like monoliths under the single overhead key.
const INTRO_AT: Record<number, [number, number, number]> = { 0: [0, 1.12, -1.73], 1: [-1.2, 0, -0.2], 2: [1.3, 0, -0.5], 3: [-0.2, 0, -0.3], 4: [0, 0, 0.1], 5: [0, 0, -1.05] };
type IntroDef = { li: number; rows: number[][]; sizes: number[]; beh?: Record<number, Beh>; ry: number };
const INTRO: IntroDef[] = [
  { li: 0, rows: [[0]], sizes: [0.07], ry: 0 },
  { li: 1, rows: [[0, 1, 2, 3], [4]], sizes: [0.11, 0.42], beh: { 4: "sag" }, ry: 0.45 },
  { li: 2, rows: [[0, 1, 2, 3], [4]], sizes: [0.09, 0.36], beh: { 4: "stamp" }, ry: -0.36 },
  { li: 3, rows: [[0, 1, 2, 3], [4]], sizes: [0.08, 0.24], beh: { 4: "dissolve" }, ry: 0 },
  { li: 4, rows: [[0, 1, 2], [3], [4], [5]], sizes: [0.09, 0.16, 0.07, 0.62], beh: { 5: "freeze" }, ry: 0 },
  { li: 5, rows: [[0, 1], [2]], sizes: [0.09, 0.22], ry: 0 },
];
const INTRO_KEYS: CamKey[] = [
  { t: 0, p: [2.4, 2.75, 1.5], l: [0, 0.7, -1.4], f: 50 }, // the album shot: high corner, the desk in the pool of light
  { t: 3.4, p: [1.4, 2.0, 0.6], l: [0, 0.9, -1.5], f: 46 },
  { t: 4.6, p: [0.35, 1.32, -0.6], l: [0, 1.12, -1.72], f: 40 }, // the monitor: "Yeah..."
  { t: 5.6, p: [0.2, 1.28, -0.75], l: [0, 1.12, -1.75], f: 38 },
  { t: 6.7, p: [-0.3, 0.78, 1.35], l: [-1.2, 0.42, -0.2], f: 42 }, // low, on the wet floor: TIRED
  { t: 8.7, p: [-0.5, 0.66, 1.15], l: [-1.2, 0.36, -0.2], f: 40 },
  { t: 9.5, p: [0.6, 0.72, 1.2], l: [1.3, 0.36, -0.5], f: 42 }, // truck right: QUIT
  { t: 11.0, p: [0.75, 0.6, 0.95], l: [1.3, 0.3, -0.5], f: 40 },
  { t: 11.9, p: [0.9, 0.78, 1.45], l: [-0.2, 0.4, -0.3], f: 42 }, // DISAPPEAR (orbit hold layered on top)
  { t: 13.6, p: [-1.0, 0.8, 1.35], l: [-0.2, 0.4, -0.3], f: 42 },
  { t: 15.4, p: [-2.0, 2.4, 1.9], l: [0, 0.55, -1.0], f: 46 }, // wide: the cage, the figure at the desk, the stones on the floor
  { t: 17.4, p: [-1.4, 2.0, 1.95], l: [0, 0.6, -0.6], f: 46 },
  { t: 18.5, p: [0.1, 0.95, 1.95], l: [0, 0.55, 0.1], f: 44 }, // EVERYTHING TO STOP
  { t: 19.0, p: [0.1, 0.9, 1.9], l: [0, 0.5, 0.1], f: 44 },
];
const introCam = makeCamera(INTRO_KEYS, 0.3);

export const Act1: React.FC<{ t: number }> = ({ t }) => {
  const a = useAssets();
  const cut = useCutout();
  const sil = useMemo(() => (cut ? new THREE.MeshBasicMaterial({ map: cut, color: "#000", transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }) : null), [cut]);
  const stars = useMemo(() => {
    const r = rng(21), n = 6000, g = new THREE.BufferGeometry(), pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const u = r() * 2 - 1, q = r() * Math.PI * 2, rad = 300 + r() * 900, c = Math.sqrt(1 - u * u); pos.set([Math.cos(q) * c * rad, ALT + Math.abs(u) * rad * 0.9 - 80, Math.sin(q) * c * rad], i * 3); }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("seed", new THREE.BufferAttribute(new Float32Array(n).map(() => r()), 1));
    g.setAttribute("bright", new THREE.BufferAttribute(new Float32Array(n).map(() => Math.pow(r(), 5) * 2 + 0.1), 1));
    return g;
  }, []);
  // the dust: from the windows around you (relative to the pod) to a constellation around the pod
  const dust = useMemo(() => {
    const r = rng(33), n = 3200, from = new Float32Array(n * 3), to = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const k = i % VERSE.length, th = VTH[k] + (r() - 0.5) * 0.6, rad = 0.9 + r() * 1.4;
      const p = VC.clone().addScaledVector(dirY(th), rad).add(new THREE.Vector3(0, (r() - 0.5) * 0.9, 0)).sub(P0);
      from.set([p.x, p.y, p.z], i * 3);
      const star = Math.floor(r() * 40), sr = rng(star + 500);
      const u = sr() * 2 - 1, q = sr() * Math.PI * 2, R = 3.2 + sr() * 4, cc = Math.sqrt(1 - u * u);
      const j = (r() - 0.5) * 0.16;
      to.set([Math.cos(q) * cc * R + j, 1.2 + u * R * 0.6 + j, Math.sin(q) * cc * R + j], i * 3);
    }
    return { from, to };
  }, []);
  if (!a) return <AbsoluteFill style={{ background: "#000" }} />;
  /** Where an intro line stands: on the wet floor (its block's base just above the ground), or on the monitor. */
  const introOrigin = (d: IntroDef) => {
    const at = INTRO_AT[d.li];
    if (d.li === 0) return new THREE.Vector3(...at);
    const h = layLine(a.inter, d.li, d.rows, d.sizes).height;
    return new THREE.Vector3(at[0], h / 2 + 0.02, at[2]);
  };
  /** The counter (hole) of letter `ci` of word `wi` in an intro line, in world space. */
  const holeOf = (d: IntroDef, wi: number, ci: number) => {
    const lay = layLine(a.inter, d.li, d.rows, d.sizes);
    const w = lay.words.find((x) => x.wi === wi)!;
    const word = W(d.li, wi).w.toUpperCase().replace(/[.,!?…]/g, "");
    const lx = layout(a.inter, word, w.size, 0.04).letters[ci].x;
    return introOrigin(d).add(new THREE.Vector3(w.x + lx, w.y, 0));
  };

  // ---------- state ----------
  const kickT = lastIn(KICKS, t, 1);
  const drop = Math.max(0, t - LAUNCH);
  const inRoom = t < 59.0;
  const lever = cubicOut(clamp01((t - (LAUNCH - 0.06)) / 0.12));
  const pp = podPos(t);
  const alt = clamp01(podY(t) / 600);
  const alarm = t > 50.7 && t < 53.4 ? 0.5 + 0.5 * Math.sin((t - 50.7) * Math.PI * 2 * 1.4) : 0;
  const screen = clamp01((t - 0.4) / 1.2);

  // ---------- words ----------
  const els: React.ReactNode[] = [];
  // what the lens is focused on: every line registers its centre when it starts; focus racks between them
  const foci: { t0: number; p: THREE.Vector3; li: number }[] = [];
  const lineWords = (d: LineDef, origin: THREE.Vector3, rotY: number, fade: number, keyp: string, billboardTo?: THREE.Vector3, depth?: number) => {
    const font = fontFor(a, d.style);
    const lay = layLine(font, d.li, d.rows, d.sizes);
    let ry = rotY;
    if (billboardTo) { const v = billboardTo.clone().sub(origin); ry = Math.atan2(v.x, v.z); }
    return (
      <group key={keyp} position={origin.toArray() as [number, number, number]} rotation={[0, ry, 0]}>
        {lay.words.map((w) => <Word3D key={w.wi} font={font} li={d.li} wi={w.wi} t={t} size={w.size} style={d.style} beh={d.beh?.[w.wi]} pos={[w.x, w.y, 0]} depth={depth ?? (d.style === "city" ? 0.28 : 0.18)} kickT={kickT} fade={fade} />)}
      </group>
    );
  };

  // intro lines: solid words in front of the monitor; QUIT inside an error window
  if (t < 23.4) {
    const intro = INTRO;
    intro.forEach((d, k) => {
      // TIRED and QUIT stay standing in the room like tombstones until the fly-through; the rest hand over
      const end = d.li === 1 || d.li === 2 ? 20.85 : k + 1 < intro.length ? L0(intro[k + 1].li) - 0.1 : 23.3;
      const fade = 1 - clamp01((t - end) / 0.35);
      if (t < L0(d.li) - 0.1 || fade <= 0) return;
      const origin = introOrigin(d);
      foci.push({ t0: L0(d.li), p: origin, li: d.li });
      if (d.li === 2) { const lw = layLine(a.inter, 2, d.rows, d.sizes); els.push(
        <group key="quitbox" position={[origin.x, origin.y, origin.z - 0.12]} rotation={[0, d.ry, 0]} scale={cubicOut(clamp01((t - (W(2, 4).s - 0.08)) / 0.2))}>
          <Popup w={lw.width + 0.3} h={lw.height + 0.3} tone="red" title="ERROR · CANNOT QUIT" font={a.mono} flash={Math.max(0, Math.sin((t - 10) * 9)) * (t > W(2, 4).s ? 1 : 0) * (t < 11 ? 1 : 0.3)} o={fade} />
        </group>,
      ); }
      els.push(lineWords({ li: d.li, rows: d.rows, sizes: d.sizes, beh: d.beh, style: "city" }, origin, d.ry, fade, `in${d.li}`, undefined, d.li === 0 ? 0.06 : 0.32));
    });
  }

  // verse windows: they pile up around you
  if (t > 22.6 && t < LAUNCH + 0.5) {
    VERSE.forEach((d, k) => {
      if (t < L0(d.li) - 0.12) return;
      const sl = slot(k, t);
      const pop = cubicOut(clamp01((t - (L0(d.li) - 0.12)) / 0.38));
      foci.push({ t0: L0(d.li), p: sl.pos.clone().add(new THREE.Vector3(0, (((layLine(fontFor(a, d.style), d.li, d.rows, d.sizes).height + 0.16) * SV) / 2) + 0.05, 0)), li: d.li });
      const gone = 1 - clamp01((t - (L0(22) + 0.2)) / 0.6);
      const font = fontFor(a, d.style);
      const lay = layLine(font, d.li, d.rows, d.sizes);
      const w = lay.width + 0.14, h = lay.height + 0.16;
      const standY = (h * SV) / 2 + 0.05; // the slab's bottom edge hovers just above the wet floor
      const flash = Math.max(alarm * (d.tone === "red" ? 1 : 0.5), k === VERSE.length - 1 ? 0 : 0) + (t - L0(d.li) < 0.25 ? 1 - (t - L0(d.li)) / 0.25 : 0) * 0.6;
      const o = (sl.dim ? Math.max(0.03, 0.14 - (sl.dim - 1) * 0.05) : 1) * gone * pop;
      // WEIGHT drops its window; ME / TIME tear
      const wy = d.li === 12 && t > W(12, 4).s - 0.05 ? -0.05 * Math.exp(-(t - W(12, 4).s) / 0.12) * Math.sin((t - W(12, 4).s) * 60) : 0;
      els.push(
        <group key={`v${k}`} position={sl.pos.clone().add(new THREE.Vector3(0, standY + wy * SV + (1 - pop) * 0.25, 0)).toArray() as [number, number, number]} rotation={[sl.tilt, sl.rotY, 0]} scale={SV * (0.9 + 0.1 * pop)}>
          <Popup w={w} h={h} tone={d.tone ?? "blue"} title={d.title ?? "SYSTEM"} font={a.mono} flash={flash} o={o}>
            <group position={[0, -0.03, 0.03]}>{lay.words.map((wd) => <Word3D key={wd.wi} font={font} li={d.li} wi={wd.wi} t={t} size={wd.size} style="city" beh={d.beh?.[wd.wi]} pos={[wd.x, wd.y, 0]} depth={0.3} kickT={kickT} fade={o} />)}</group>
          </Popup>
        </group>,
      );
    });
    // BLESSED: everyone says it — a burst of small error windows
    const bw = W(8, 5);
    if (t > bw.s - 0.05 && t < LAUNCH) {
      for (let i = 0; i < 9; i++) {
        const at = bw.s + i * 0.06; if (t < at) continue;
        const r = rng(i + 70), th = VTH[2] + (r() - 0.5) * 1.2, p = VC.clone().addScaledVector(dirY(th), 1.5 + r() * 1.2).add(new THREE.Vector3(0, 0.25 + r() * 1.5, 0));
        const sc = cubicOut(clamp01((t - at) / 0.12)) * (1 - clamp01((t - (L0(9) + 2)) / 0.4));
        if (sc <= 0) continue;
        els.push(
          <group key={`bl${i}`} position={p.toArray() as [number, number, number]} rotation={[0, -th + (r() - 0.5) * 0.4, (r() - 0.5) * 0.1]} scale={sc * SV * 0.8}>
            <Popup w={0.3} h={0.12} tone={i % 2 ? "red" : "blue"} title="!" font={a.mono} flash={0.4} o={0.9}>
              <Word3D font={a.inter} li={8} wi={5} t={t} size={0.045} style="city" pos={[0, -0.015, 0.03]} depth={0.25} />
            </Popup>
          </group>,
        );
      }
    }
  }
  // pre-chorus: the lines appear on the pod glass in front of you
  const podEye = new THREE.Vector3(0, 1.27, P0.z + 0.12);
  if (t > L0(22) - 0.2 && t < LAUNCH + 1.2) {
    const pc: LineDef[] = [
      { li: 22, rows: [[0, 1, 2, 3], [4, 5], [6]], sizes: [0.035, 0.035, 0.075], beh: { 6: "dissolve" }, style: "city" },
      { li: 23, rows: [[0, 1, 2, 3, 4], [5]], sizes: [0.035, 0.1], beh: { 5: "stamp" }, style: "city" },
    ];
    pc.forEach((d, k) => {
      const end = k === 0 ? L0(23) - 0.1 : LAUNCH + 0.9;
      const fade = 1 - clamp01((t - end) / 0.3);
      if (t < L0(d.li) - 0.1 || fade <= 0) return;
      // line 22 faces you as you walk to the pod; line 23 faces you once you're seated
      const o2 = new THREE.Vector3(0, 1.38, P0.z - 0.45).add(new THREE.Vector3(0, podY(t), 0));
      foci.push({ t0: L0(d.li), p: o2, li: d.li });
      els.push(lineWords(d, o2, d.li === 22 ? Math.PI : 0, fade, `pc${d.li}`));
    });
  }
  // chorus: lines float around the pod, facing you
  let camP = new THREE.Vector3(), camL = new THREE.Vector3(), fov = 40, roll = 0;
  const chorusCam = () => {
    // procedural: a slow panoramic orbit around the pod; a 180° orbit hold around the glowing A
    const s0 = 61.2;
    const phi = 0.4 + (t - s0) * 0.09;
    const rad = 7.2 + Math.sin((t - s0) * 0.21) * 0.8, hh = 1.6 + Math.sin((t - s0) * 0.13) * 0.9;
    const c = pp.clone().add(new THREE.Vector3(0, 1.1, 0));
    let p = c.clone().add(new THREE.Vector3(Math.sin(phi) * rad, hh, Math.cos(phi) * rad)), l = c.clone();
    // look down to the world on "leave this world"
    const wk = cubicInOut(clamp01((t - (L0(31) - 0.4)) / 1.0)) * (1 - cubicInOut(clamp01((t - (L0(32) - 0.2)) / 0.8)));
    l = l.add(new THREE.Vector3(0, -6 * wk, 0)); p = p.add(new THREE.Vector3(0, 3 * wk, 0));
    // orbit hold: 180° around the A while it's held
    const A = W(32, 6), hold = cubicInOut(clamp01((t - (A.s - 0.2)) / 0.6)) * (1 - cubicInOut(clamp01((t - (A.e + 0.2)) / 0.7)));
    if (hold > 0) {
      const ac = aPos();
      const ang = phi + Math.PI * cubicInOut(clamp01((t - A.s) / (A.e - A.s)));
      const ap = ac.clone().add(new THREE.Vector3(Math.sin(ang) * 3.0, 0.5, Math.cos(ang) * 3.0));
      p = p.lerp(ap, hold); l = l.lerp(ac, hold);
    }
    return { p, l, f: 48 };
  };
  const toCam = () => { const d = camP.clone().sub(pp); d.y = 0; return d.normalize(); };
  // the A of "for a… bit" sits in front of the pod
  const aPos = () => pp.clone().add(new THREE.Vector3(0, 1.4, 0));

  // ---------- camera ----------
  if (t < 23.0) {
    // the spline carries the intro; a floating-rig drift rides on top of every hold
    const c = introCam(Math.min(t, 19.0));
    camP = c.p.clone().add(drift(t, 0.04)); camL = c.l.clone().add(drift(t + 40, 0.015)); fov = c.f;
    // ORBIT HOLD — DISAPPEAR: a 90° revolution around the sustained word, sprung (weight, no linear starts)
    {
      const ctr = introOrigin(INTRO[3]).add(new THREE.Vector3(0, -0.05, 0));
      const win = cubicInOut(clamp01((t - 11.75) / 0.55)) * (1 - cubicInOut(clamp01((t - 13.8) / 1.1)));
      if (win > 0) {
        const yaw = mix(0.62, -0.95, springK(t, W(3, 4).s - 0.1, { damping: 26, mass: 2.2, stiffness: 45 }));
        const op = orbitAround(ctr, yaw, 1.85, 0.42).add(drift(t, 0.03));
        camP = camP.clone().lerp(op, win); camL = camL.clone().lerp(ctr, win); fov = mix(fov, 42, win);
      }
    }
    // ORBIT HOLD — EVERYTHING… STOP: swing out ~80° to show the depth of the slab, spring back square on STOP
    const stopD = INTRO[4], hole = holeOf(stopD, 5, 2); // the O of STOP
    const sctr = new THREE.Vector3(introOrigin(stopD).x, hole.y, introOrigin(stopD).z);
    if (t > 18.9) {
      const out = springK(t, W(4, 3).s, { damping: 24, mass: 1.8, stiffness: 55 }), back = springK(t, W(4, 5).s, { damping: 24, mass: 1.4, stiffness: 80 });
      const yaw = 0.05 - 1.35 * out + 1.4 * back;
      const dist = mix(1.85, 1.4, back);
      const op = orbitAround(sctr, yaw, dist, 0.32 * (1 - back) + 0.02);
      const win = cubicInOut(clamp01((t - 18.9) / 0.4));
      camP = camP.clone().lerp(op.add(drift(t, 0.02 * (1 - back))), win);
      camL = camL.clone().lerp(sctr.clone().add(new THREE.Vector3(0, 0.12 * (1 - back), 0)), win); fov = mix(fov, 46, win);
    }
    // Z FLY-THROUGH #1 — through the counter of STOP's O, wiping into FOR A MINUTE behind it
    const forD = INTRO[5], forC = introOrigin(forD);
    if (t > 20.55) {
      const k = cubicInOut(clamp01((t - 20.55) / 0.6));
      const fp = throughHole(hole, new THREE.Vector3(0, 0, 1), k, 1.4, 0.35);
      camP = fp.p; camL = fp.l.clone().lerp(forC, cubicInOut(clamp01((t - 20.85) / 0.45))); fov = mix(46, 54, Math.sin(k * Math.PI));
    }
    // Z FLY-THROUGH #2 — FOR A MINUTE holds, then straight through the O of FOR into the verse
    if (t > 21.15) {
      const hF = holeOf(forD, 0, 1);
      const settle = springK(t, 21.15, { damping: 24, mass: 1.4, stiffness: 60 });
      const sp = hole.clone().add(new THREE.Vector3(0, 0, -0.35)).lerp(new THREE.Vector3(hF.x, hF.y + 0.04, forC.z + 0.85), settle).add(drift(t, 0.012));
      camP = sp; camL = forC.clone(); fov = 50;
      const v = cubicIn(clamp01((t - 22.25) / 0.75));
      if (v > 0) { const fp = throughHole(hF, new THREE.Vector3(0, 0, 1), v, 0.85, 0.3); camP = sp.clone().lerp(fp.p, Math.min(1, v * 3)); camL = forC.clone().lerp(fp.l, v); fov = mix(50, 66, v); }
    }
  } else if (t < L0(22) - 0.4) {
    // verse: trapped in the ring, whipping 90° on the snare, a slow push into each window, a nervous hand
    const th = verseYaw(t);
    const k = VERSE.reduce((acc, d, i) => (t >= L0(d.li) - 0.3 ? i : acc), 0);
    const lineT = t - L0(VERSE[k].li), push = 0.12 * cubicOut(clamp01(lineT / 2.4));
    const d = dirY(th);
    // standing in the middle of the wet floor; the slab in front, its reflection under it; a slow push on each line
    camP = VC.clone().addScaledVector(d, -0.45 + push * 2.5).add(new THREE.Vector3(0, EYE, 0)).add(drift(t, 0.04));
    camL = VC.clone().addScaledVector(d, 2.0).add(new THREE.Vector3(0, 0.66, 0)).add(drift(t + 40, 0.02));
    fov = 46 - 4 * cubicOut(clamp01(lineT / 2.4));
    // ease in from the fly-through
    const ein = 1 - cubicOut(clamp01((t - 23.0) / 0.6));
    if (ein > 0) { camP = camP.clone().addScaledVector(d, -0.4 * ein); fov += 18 * ein; }
    // WEIGHT lands: a short shake; DARKNESS calls: the room shakes with each beat
    if (t > W(12, 4).s) camP.add(new THREE.Vector3(0, Math.exp(-(t - W(12, 4).s) / 0.2) * Math.sin((t - W(12, 4).s) * 40) * 0.02, 0));
    if (alarm > 0) camP.add(handheld(t * 3, 0.01 * alarm, 6));
    roll = (noise1(t * 0.21, 5) - 0.5) * 0.03;
  } else if (t < LAUNCH + 0.3) {
    // pre-chorus: turn around to the pod, walk in, sit, look down at the console
    const th0 = verseYaw(L0(22) - 0.4), d0 = dirY(th0);
    const keys: CamKey[] = [
      { t: L0(22) - 0.4, p: VC.clone().addScaledVector(d0, -0.45).add(new THREE.Vector3(0, EYE, 0)).toArray() as [number, number, number], l: VC.clone().addScaledVector(d0, 2).add(new THREE.Vector3(0, 0.66, 0)).toArray() as [number, number, number], f: 44 },
      { t: L0(22) + 0.6, p: [0.1, 1.35, P0.z - 2.2], l: [0, 1.2, P0.z], f: 44 },
      { t: L0(23) - 0.3, p: [0.05, 1.32, P0.z - 1.0], l: [0, 1.15, P0.z], f: 44 },
      { t: L0(23) + 0.9, p: [0, 1.28, P0.z + 0.12], l: [0, 1.15, P0.z - 0.6], f: 50 },
      { t: LAUNCH + 0.3, p: [0, 1.27, P0.z + 0.12], l: [0.06, 1.05, P0.z - 0.5], f: 52 },
    ];
    const c = makeCamera(keys, 0.3)(t);
    camP = c.p.clone().add(rig(t, 0.014)); camL = c.l; fov = c.f;
  } else {
    // launch: hyperspeed pull-back out of the pod and up through the city, then the orbit in deep space
    const u = clamp01((t - (LAUNCH + 0.3)) / 4.0);
    const back = 0.5 + 70 * cubicInOut(Math.min(1, u * 1.6)) * (1 - cubicInOut(clamp01((u - 0.55) / 0.45))) + 6.8 * cubicInOut(clamp01((u - 0.55) / 0.45));
    const launchP = pp.clone().add(new THREE.Vector3(Math.sin(0.4) * back, 1.3 - back * 0.55 * (1 - clamp01((u - 0.6) / 0.4)) + 1.6 * clamp01((u - 0.6) / 0.4), Math.cos(0.4) * back));
    const launchL = pp.clone().add(new THREE.Vector3(0, 1.1, 0));
    const orb = chorusCam();
    const blend = cubicInOut(clamp01((t - 60.6) / 1.2));
    camP = launchP.lerp(orb.p.clone().add(rig(t, 0.35)), blend); camL = launchL.lerp(orb.l, blend); fov = mix(mix(52, 64, Math.sin(Math.min(1, u * 1.4) * Math.PI)), orb.f, blend);
  }

  // chorus words (after the camera is known, so they can face it)
  if (t > L0(24) - 0.2) {
    CHORUS.forEach((d, k) => {
      const end = next(CHORUS, k, A1_END + 1) - 0.1;
      const floatW = Object.values(d.beh ?? {}).includes("float");
      if (t < L0(d.li) - 0.1 || t > end + (floatW ? 3.5 : 0.5)) return;
      const ex = clamp01((t - end) / 0.45);
      const fade = floatW ? 1 - clamp01((t - end - 0.15) / 0.55) : 1 - ex;
      const dc = toCam();
      let origin = pp.clone().add(new THREE.Vector3(0, 1.35 + ex * 0.6, 0)).addScaledVector(dc, d.li === 24 ? 1.6 : 3.4);
      if (d.li === 31) origin = origin.add(new THREE.Vector3(0, -1.2, 0));
      if (d.li === 32) { const c2 = camP.clone().sub(aPos()); c2.y = 0; c2.normalize(); origin = aPos().clone().addScaledVector(c2, 1.1); }
      foci.push({ t0: L0(d.li), p: origin, li: d.li });
      els.push(lineWords(d, origin, 0, fade, `ch${d.li}`, camP));
    });
  }

  // ---------- focus + the word light ----------
  foci.sort((x, y) => x.t0 - y.t0);
  const live = foci.filter((f) => f.t0 <= t + 0.05);
  const cur = live[live.length - 1], prev = live[live.length - 2];
  let focus = camP.distanceTo(camL);
  if (cur) {
    const dc = camP.distanceTo(cur.p), dp = prev ? camP.distanceTo(prev.p) : dc;
    focus = mix(dp, dc, cubicInOut(clamp01((t - cur.t0 + 0.05) / 0.5)));
  }
  const wh = cur ? lineHeat(cur.li, t) : 0;
  // the overhead key follows the story: it slides (racks) from the last line's slab to the new one
  const keyT = cur ? (prev ? prev.p.clone().lerp(cur.p, cubicInOut(clamp01((t - cur.t0 + 0.3) / 0.9))) : cur.p.clone()) : new THREE.Vector3(0, 0.8, -1.4);
  if (t < 6.0) keyT.set(0, 0.8, -1.35); // the opening: the pool of light on the desk
  if (t > 13.9 && t < 18.0) keyT.lerp(new THREE.Vector3(0, 0.75, -1.1), cubicInOut(clamp01((t - 13.9) / 1.2)));
  const keyP = keySpotPos(keyT);
  const look = t < LAUNCH + 0.2 ? CAGE : mixLook(CAGE, VOID, clamp01((t - LAUNCH - 0.2) / 0.6));
  const wlP = cur ? cur.p.clone().add(camP.clone().sub(cur.p).normalize().multiplyScalar(0.65)).add(new THREE.Vector3(0, 0.3, 0)) : new THREE.Vector3();

  // ---------- render ----------
  const roomO = inRoom;
  const space = t > LAUNCH + 1.0;
  const dustK = clamp01((t - (LAUNCH + 0.05)) / 4.2);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <FilmStage cam={{ pos: camP, look: camL, fov, roll, near: t > LAUNCH + 0.8 ? 0.3 : 0.05, far: t > LAUNCH ? 60000 : 400 }} look={look} focus={focus}>
        <Sky alt={alt} />
        {/* the room */}
        {roomO ? (
          <>
            {/* practicals: the monitor's cold spill, an industrial red warning lamp in the far corner */}
            <pointLight position={[0, 1.2, -1.45]} intensity={1.2 * (0.4 + screen)} distance={3} color="#6f9fe0" />
            <pointLight position={[-2.6, 2.4, -2.6]} intensity={2.5 + 10 * alarm} distance={7} color="#d2382b" />
            {/* THE KEY: one hard overhead spot, steep angle, sharp shadows, soft penumbra — the cover light */}
            <KeySpot target={keyT} intensity={85} angle={0.42} />
            <LightShaft from={keyP.toArray() as [number, number, number]} to={keyT.clone().setY(0).toArray() as [number, number, number]} r0={0.06} r1={keyP.y * Math.tan(0.5) * 0.9} color="#a9b6cc" k={0.12} t={t} />
            <Motes t={t} o={1} />
            {/* the sung word lights the room: its backlight spills forward onto desk, walls and you */}
            <pointLight position={wlP.toArray() as [number, number, number]} intensity={0.7 * wh} distance={2.6} decay={2} color="#cfdcf2" />
            <Workshop t={t} drop={drop} concrete={a.concrete} bump={a.concreteBump} screen={screen} alarm={alarm} />
            {/* you, at the desk: seen only from the wide shots */}
            {sil && t > 13.0 && t < 18.4 ? <mesh material={sil} position={[0, 0.72, -0.85]} rotation={[0, Math.PI, 0]} castShadow><planeGeometry args={[0.85, 1.05]} /></mesh> : null}
          </>
        ) : null}
        {/* the pod, and you in it */}
        <group position={pp.toArray() as [number, number, number]}>
          <pointLight position={[0, 1.4, 0]} intensity={(t > L0(22) ? 1.6 : 0.4) + 2.2 * lever} distance={5} color="#ffb066" />
          <Pod hum={t} lever={lever} glow={t > L0(22) - 0.5 ? cubicOut(clamp01((t - L0(22) + 0.5) / 1.2)) * 0.6 + lever * 0.6 : 0.15} />
          {sil && t > LAUNCH + 0.4 ? <mesh material={sil} position={[0, 1.0, 0.1]} rotation={[0, 0, 0]}><planeGeometry args={[0.7, 0.86]} /></mesh> : null}
        </group>
        {/* the city falls away below; the earth curves; the stars */}
        {t > LAUNCH - 0.2 && t < 66 ? <City y0={-60} o={1 - clamp01((t - 63) / 3)} /> : null}
        {space ? (
          <>
            <hemisphereLight intensity={0.35} color="#3a3a8a" groundColor="#2a1a10" />
            <directionalLight position={[300, ALT - 80, -800]} intensity={1.4} color="#ffb066" />
            <Glow geo={stars} size={30} gain={alt} time={t} twinkle={0.3} />
            <Earth center={[0, -20000, 0]} R={20000} o={clamp01((t - 59) / 2)} />
            <Dust from={dust.from} to={dust.to} k={dustK} spin={(t - LAUNCH) * 0.6} o={clamp01((t - LAUNCH) / 0.4)} center={pp.toArray() as [number, number, number]} />
          </>
        ) : t > LAUNCH ? <Dust from={dust.from} to={dust.to} k={dustK} spin={(t - LAUNCH) * 0.6} o={clamp01((t - LAUNCH) / 0.3)} center={pp.toArray() as [number, number, number]} /> : null}
        {els}
      </FilmStage>
      {/* the visor: a thin amber HUD while you're in the pod, before launch */}
      {t > L0(23) && t < LAUNCH + 0.8 ? (
        <AbsoluteFill style={{ opacity: clamp01((t - L0(23)) / 0.4) * (1 - clamp01((t - LAUNCH - 0.3) / 0.5)) }}>
          <svg viewBox="0 0 1920 1080" style={{ width: "100%", height: "100%" }}>
            <path d="M260 160 Q960 40 1660 160" fill="none" stroke="#ffb066" strokeWidth={2} opacity={0.6} />
            <path d="M260 920 Q960 1040 1660 920" fill="none" stroke="#ffb066" strokeWidth={2} opacity={0.6} />
            {Array.from({ length: 21 }, (_, i) => <line key={i} x1={760 + i * 20} y1={110} x2={760 + i * 20} y2={i % 5 ? 122 : 132} stroke="#ffb066" strokeWidth={1.5} opacity={0.7} />)}
            <text x={300} y={210} style={{ font: "500 18px 'IBM Plex Mono', monospace", letterSpacing: "0.3em" }} fill="#ffb066" opacity={0.85}>POD-01 · MANUAL</text>
            <text x={1620} y={210} textAnchor="end" style={{ font: "500 18px 'IBM Plex Mono', monospace", letterSpacing: "0.3em" }} fill="#ffb066" opacity={0.85}>{t > LAUNCH ? "OVERRIDE · ENGAGED" : "OVERRIDE · ARMED"}</text>
            <text x={300} y={890} style={{ font: "500 16px 'IBM Plex Mono', monospace", letterSpacing: "0.3em" }} fill="#ffb066" opacity={0.6}>O2 98% · SIGNAL 0 · NOTIFICATIONS OFF</text>
          </svg>
        </AbsoluteFill>
      ) : null}
      {/* lens dust: fine specks and smudges on the front element, lit only when something bright is in frame */}
      <LensDust k={0.015 + 0.08 * wh + (t > LAUNCH && t < LAUNCH + 3 ? 0.25 : 0)} />
    </AbsoluteFill>
  );
};
export const _u = [T, LINES, Img, staticFile, FMT, rng, handheld];

/** Lens dust as a screen-blended plate: hundreds of micro specks, a few soft smudges and a hair or two. */
let dustURL: string | null = null;
const lensDustURL = () => {
  if (dustURL) return dustURL;
  const c = document.createElement("canvas"); c.width = 1920; c.height = 1080;
  const g = c.getContext("2d")!, r = rng(1234);
  g.fillStyle = "#000"; g.fillRect(0, 0, 1920, 1080);
  for (let i = 0; i < 14; i++) { const x = r() * 1920, y = r() * 1080, rad = 60 + r() * 180; const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, `rgba(190,200,215,${0.05 + r() * 0.07})`); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
  for (let i = 0; i < 700; i++) { const x = r() * 1920, y = r() * 1080, rad = 0.6 + Math.pow(r(), 4) * 7; g.fillStyle = `rgba(230,236,245,${0.15 + r() * 0.5})`; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill(); }
  for (let i = 0; i < 3; i++) { g.strokeStyle = "rgba(220,225,235,0.3)"; g.lineWidth = 1; g.beginPath(); let x = r() * 1920, y = r() * 1080; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 60; y += (r() - 0.3) * 40; g.lineTo(x, y); } g.stroke(); }
  dustURL = c.toDataURL("image/png");
  return dustURL;
};
const LensDust: React.FC<{ k: number }> = ({ k }) => <AbsoluteFill style={{ backgroundImage: `url(${lensDustURL()})`, backgroundSize: "100% 100%", mixBlendMode: "screen", opacity: Math.min(1, k) }} />;
