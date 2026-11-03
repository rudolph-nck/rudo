import React, { useMemo } from "react";
import * as THREE from "three";
import { AbsoluteFill } from "remotion";
import { useAssets } from "../three/assets";
import { Stage } from "../three/Stage";
import { LINES, T, bassHit, pulse } from "../data";
import { clamp01, cubicInOut, cubicOut, mix } from "../utils/ease";
import { noise1, rng } from "../utils/random";
import { capHeight, layout } from "../words/glyphs";
import { Glow } from "../words/points";
import { Letters } from "../frames/kit";

/**
 * Verse 1, second half (0:37.2–0:57.4). MINE falls through the crack into a dark void; the camera glides down
 * with it past cold monuments (LIFE, NAME, SUCCESS), watches DISCONNECTED come apart, tracks along a wall of
 * framed achievements whose frames drop one per beat as the lights die, and DARKNESS calls. Pre-chorus: the
 * spark comes back and writes the line; BREAK splits the dark open with light.
 * The camera runs on one smooth spline through keyframes, so every move glides.
 */
export const V1B_START = 37.2;
export const V1B_END = 57.4;
const L = (li: number) => LINES[li].words;
const INK = new THREE.Color("#f1eee8");
const AMBER = new THREE.Color("#ff7a2c");
type V3 = [number, number, number];

// ---- camera keyframes: time, position, look-at, fov ----
const KEYS: { t: number; p: V3; l: V3; f: number }[] = [
  { t: 37.2, p: [0, 0.62, 0.1], l: [0, -1.2, -0.22], f: 40 },
  { t: 37.75, p: [0, -2.4, 2.0], l: [0, -6.6, -2.0], f: 42 },
  { t: 38.45, p: [0.5, -7.0, 4.0], l: [0, -7.8, -3], f: 44 },
  { t: 39.0, p: [1.0, -9.0, 3.6], l: [2.2, -10.6, -4.2], f: 44 },
  { t: 39.6, p: [2.0, -11.2, 1.6], l: [4.5, -12.2, -5.5], f: 44 },
  { t: 40.25, p: [1.0, -15.4, 2.6], l: [0, -17.4, -4.5], f: 44 },
  { t: 41.2, p: [0.35, -16.9, 2.9], l: [0, -17.6, -4.5], f: 44 },
  { t: 42.6, p: [0.1, -18.3, 2.2], l: [0, -18.9, -4.5], f: 44 },
  { t: 43.5, p: [0, -21.6, 1.2], l: [0, -22.7, -4], f: 44 },
  { t: 45.7, p: [0, -22.4, 3.6], l: [0, -23.0, -4], f: 50 },
  { t: 46.35, p: [-3.0, -25.6, 0.9], l: [-3.2, -25.9, -3], f: 46 },
  { t: 47.9, p: [-0.4, -25.7, 0.8], l: [-0.2, -25.95, -3], f: 46 },
  { t: 49.3, p: [2.0, -25.8, 1.0], l: [2.4, -26.0, -3], f: 46 },
  { t: 50.8, p: [3.0, -25.9, 1.6], l: [3.2, -26.0, -2], f: 46 },
  { t: 52.6, p: [3.2, -25.95, 0.9], l: [3.2, -26.0, -2], f: 44 },
  { t: 54.4, p: [3.2, -25.95, 1.5], l: [3.2, -26.0, -2], f: 46 },
  { t: 56.4, p: [3.2, -26.0, 2.2], l: [3.2, -26.1, -2], f: 48 },
  { t: 57.4, p: [3.2, -26.0, 2.6], l: [3.2, -26.1, -2], f: 54 },
];
const curves = (() => {
  const P = new THREE.CatmullRomCurve3(KEYS.map((k) => new THREE.Vector3(...k.p)), false, "centripetal");
  const Lc = new THREE.CatmullRomCurve3(KEYS.map((k) => new THREE.Vector3(...k.l)), false, "centripetal");
  return { P, Lc };
})();
const camAt = (t: number) => {
  const n = KEYS.length;
  let i = 0;
  while (i < n - 2 && t > KEYS[i + 1].t) i++;
  const u = clamp01((t - KEYS[i].t) / (KEYS[i + 1].t - KEYS[i].t));
  const q = (i + u) / (n - 1);
  const f = mix(KEYS[i].f, KEYS[i + 1].f, cubicInOut(u));
  return { p: curves.P.getPoint(q), l: curves.Lc.getPoint(q), f };
};

export const V1B: React.FC<{ t: number }> = ({ t }) => {
  const a = useAssets();
  const cache = useMemo(() => new Map<string, THREE.Material>(), []);
  const dust = useMemo(() => {
    const r = rng(311), n = 1600, g = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) pos.set([(r() - 0.5) * 16, 3 - r() * 34, -9 + r() * 13], i * 3);
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("seed", new THREE.BufferAttribute(new Float32Array(n).map(() => r()), 1));
    g.setAttribute("bright", new THREE.BufferAttribute(new Float32Array(n).map(() => 0.04 + Math.pow(r(), 5) * 0.6), 1));
    return g;
  }, []);
  const embers = useMemo(() => {
    const n = 40, g = new THREE.BufferGeometry(), r = rng(19);
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute("seed", new THREE.BufferAttribute(new Float32Array(n).map(() => r()), 1));
    g.setAttribute("bright", new THREE.BufferAttribute(new Float32Array(n).map((_, i) => 1.6 * Math.pow(1 - i / n, 2)), 1));
    return { g, jit: Array.from({ length: n }, () => new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5)) };
  }, []);
  const frames = useMemo(() => {
    const r = rng(5), out: { x: number; y: number; w: number; h: number; tilt: number }[] = [];
    for (let row = 0; row < 3; row++) for (let c = 0; c < 11; c++) {
      const x = -5.2 + c * 1.05 + (row % 2) * 0.3, y = -25.15 - row * 0.78;
      if (Math.abs(x + 3.2) < 0.85 && row === 1) continue; // the paper
      if (Math.abs(x - 1.6) < 0.8 && row === 1) continue; // the achievement frame
      out.push({ x, y, w: 0.55 + r() * 0.25, h: 0.42 + r() * 0.2, tilt: (r() - 0.5) * 0.04 });
    }
    return out;
  }, []);
  const sparkMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.5, 0.18).multiplyScalar(9), toneMapped: false }), []);
  if (!a) return <AbsoluteFill style={{ background: "#040405" }} />;

  // ---------- materials ----------
  const flat = (heat: number, o: number, base = INK) => {
    const h = Math.round(clamp01(heat) * 12), q = Math.round(clamp01(o) * 16), key = `f${base.getHexString()}-${h}-${q}`;
    let m = cache.get(key) as THREE.MeshBasicMaterial | undefined;
    if (!m) { m = new THREE.MeshBasicMaterial({ color: base.clone().lerp(AMBER, h / 12), transparent: true, toneMapped: false }); m.opacity = q / 16; m.depthWrite = q > 10; cache.set(key, m); }
    return m;
  };
  const stone = (key: string, color: string, heat: number, metal = false) => {
    let m = cache.get(key) as THREE.MeshStandardMaterial | undefined;
    if (!m) { m = new THREE.MeshStandardMaterial({ color, roughness: metal ? 0.38 : 0.9, metalness: metal ? 0.75 : 0 }); cache.set(key, m); }
    m.emissive.copy(AMBER).multiplyScalar(0.32 * clamp01(heat));
    return m;
  };
  const heatOf = (s: number, e: number) => (t < s ? 0 : t < e ? 1 : Math.exp(-(t - e) / 0.45));
  const appear = (s: number, d = 0.18) => cubicOut(clamp01((t - (s - 0.03)) / d));

  // small flat word, centred at p, facing +z (or a given rotation)
  const word = (key: string, w: { s: number; e: number }, text: string, p: V3, size: number, rotY = 0, extra = 1, base = INK) => {
    const o = appear(w.s) * extra;
    if (o <= 0.01) return null;
    const pop = 1 + 0.12 * (1 - cubicOut(clamp01((t - w.s) / 0.2)));
    return (
      <group key={key} position={p} rotation={[0, rotY, 0]} scale={[pop, pop, 1]}>
        <Letters font={a.bebas} family="bebas" text={text} size={size} depth={0.001} material={flat(heatOf(w.s, w.e), o, base)} tracking={0.04} bevel={0} shadows={false} />
      </group>
    );
  };
  const line = (li: number, wis: number[], p: V3, size: number, rotY = 0, extra = 1) => {
    // words of one line, laid out as one row and each appearing when sung
    const texts = wis.map((wi) => L(li)[wi].w.toUpperCase().replace(/[.,]/g, ""));
    const lay = layout(a.bebas, texts.join(" "), size, 0.04);
    let ci = 0;
    return texts.map((tx, k) => {
      const f = lay.letters[ci], l = lay.letters[ci + tx.length - 1];
      const cx = (f.x - f.adv / 2 + l.x + l.adv / 2) / 2;
      ci += tx.length + 1;
      const v = new THREE.Vector3(cx, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
      return word(`${li}-${wis[k]}`, L(li)[wis[k]], tx, [p[0] + v.x, p[1], p[2] + v.z], size, rotY, extra);
    });
  };
  // a monument: a big extruded stone word that rises out of the dark when it's sung
  const monument = (key: string, w: { s: number; e: number }, text: string, c: V3, size: number, rotY: number, color: string, metal = false) => {
    if (t < w.s - 0.05) return null;
    const u = cubicOut(clamp01((t - (w.s - 0.05)) / 0.75));
    const ch = capHeight(a.bebas, size), wd = layout(a.bebas, text, size, 0.03).width;
    const y = c[1] - (1 - u) * 5;
    return (
      <group key={key} position={[c[0], y, c[2]]} rotation={[0, rotY, 0]}>
        <Letters font={a.bebas} family="bebas" text={text} size={size} depth={size * 0.28} material={stone(key, color, heatOf(w.s, w.e) * 0.9, metal)} tracking={0.03} bevel={0} shadows />
        <mesh position={[0, -ch / 2 - 0.22, size * 0.14]} receiveShadow castShadow><boxGeometry args={[wd + 0.6, 0.44, size * 0.28 + 0.9]} /><meshStandardMaterial color="#2a2825" roughness={0.95} /></mesh>
      </group>
    );
  };

  // ---------- the void: MINE keeps falling, monuments rise ----------
  const els: React.ReactNode[] = [];
  const mine = L(13)[4];
  {
    const d = t - V1B_START;
    const y = -(2.2 * d + 1.6 * d * d);
    const o = 1 - clamp01((d - 0.5) / 0.5);
    if (o > 0.01) els.push(
      <group key="mine" position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0.12 + d * 0.4]}>
        <Letters font={a.bebas} family="bebas" text="MINE" size={0.09} depth={0.001} material={flat(heatOf(mine.s, mine.e), o)} tracking={0.04} bevel={0} shadows={false} />
      </group>,
    );
  }
  // BUILT A LIFE THAT PEOPLE ENVY
  els.push(...line(14, [0, 1], [-0.95, -6.15, -2.6], 0.28));
  els.push(monument("life", L(14)[2], "LIFE", [0, -7.8, -3.2], 1.8, 0, "#8d877e"));
  els.push(...line(14, [3, 4, 5], [0, -9.25, -2.25], 0.22));
  // BUILT A NAME THEY ALL RESPECT
  els.push(...line(15, [0, 1], [3.6, -10.85, -4.6], 0.24, -0.45));
  els.push(monument("name", L(15)[2], "NAME", [4.5, -12.2, -5.5], 1.5, -0.45, "#7c776f"));
  els.push(...line(15, [3, 4, 5], [4.1, -13.5, -4.4], 0.2, -0.45));
  // FUNNY HOW SUCCESS CAN LEAVE YOU
  els.push(...line(16, [0, 1], [0, -16.25, -4.0], 0.26));
  els.push(monument("success", L(16)[2], "SUCCESS", [0, -17.45, -4.5], 0.85, 0, "#9c968c", true));
  els.push(...line(16, [3, 4], [-0.25, -18.55, -3.8], 0.2));
  {
    const you = L(16)[5];
    const fade = 1 - 0.5 * clamp01((t - you.e) / 1.0);
    els.push(word("16-5", you, "YOU", [0.55, -18.55, -3.8], 0.2, 0, fade));
  }
  // FEELING MORE DIS · CON · NECT · ED — the syllables drift apart
  els.push(...line(17, [0, 1], [0, -22.15, -4.0], 0.24));
  {
    const w = L(17)[2], sy = w.syl ?? [];
    const size = 0.42, parts = sy.map((x) => x.t.toUpperCase());
    const lay = layout(a.bebas, parts.join(""), size, 0.04);
    let ci = 0;
    const spread = cubicInOut(clamp01((t - w.s) / 2.4)) * 0.75 + Math.max(0, t - w.e) * 0.25;
    parts.forEach((tx, k) => {
      const f = lay.letters[ci], l = lay.letters[ci + tx.length - 1];
      const cx = (f.x - f.adv / 2 + l.x + l.adv / 2) / 2;
      ci += tx.length;
      const s = sy[k];
      const dx = (k - (parts.length - 1) / 2) * spread, dy = (k % 2 ? -1 : 1) * spread * 0.18, rz = (k - 1.5) * spread * 0.12;
      const o = appear(s.s);
      if (o <= 0.01) return;
      els.push(
        <group key={`dis${k}`} position={[cx + dx, -22.85 + dy, -4.0 - spread * 0.3 * Math.abs(k - 1.5)]} rotation={[0, 0, rz]}>
          <Letters font={a.bebas} family="bebas" text={tx} size={size} depth={0.001} material={flat(heatOf(s.s, s.e), o * (1 - 0.35 * clamp01((t - 46.0) / 0.6)))} tracking={0.04} bevel={0} shadows={false} />
        </group>,
      );
    });
  }

  // ---------- the wall of achievements ----------
  const wallOn = t > 45.4;
  const kicksAfter = T.beats.filter((b) => b > L(20)[0].s - 0.05);
  const lightsOut = cubicInOut(clamp01((t - (L(21)[0].s - 0.1)) / 0.9)); // WHEN THE DARKNESS
  if (wallOn) {
    frames.forEach((fr, i) => {
      // frames drop one per beat from BUT NONE OF THAT…, nearest the camera first
      const order = [...frames.keys()].sort((p, q) => Math.abs(frames[p].x - 2.2) - Math.abs(frames[q].x - 2.2));
      const k = order.indexOf(i);
      const tDrop = k < kicksAfter.length ? kicksAfter[Math.floor(k / 2)] + (k % 2) * 0.09 : 1e9;
      const d = Math.max(0, t - tDrop);
      const fy = 0.5 * 9 * d * d, rot = d * (i % 2 ? 2.2 : -2.6), fz = d * 0.8;
      if (fy > 6) return;
      els.push(
        <group key={`fr${i}`} position={[fr.x, fr.y - fy, -2.97 + fz]} rotation={[d * 0.9, 0, fr.tilt + rot]}>
          <mesh castShadow><boxGeometry args={[fr.w, fr.h, 0.04]} /><meshStandardMaterial color="#9a8a6c" roughness={0.5} metalness={0.3} /></mesh>
          <mesh position={[0, 0, 0.022]}><planeGeometry args={[fr.w - 0.08, fr.h - 0.08]} /><meshStandardMaterial color="#1c1b19" roughness={0.9} /></mesh>
          <mesh position={[0, 0.02, 0.024]}><planeGeometry args={[(fr.w - 0.2) * 0.8, 0.025]} /><meshStandardMaterial color="#6b655c" /></mesh>
          <mesh position={[-0.04, -0.05, 0.024]}><planeGeometry args={[(fr.w - 0.2) * 0.6, 0.018]} /><meshStandardMaterial color="#4c4842" /></mesh>
        </group>,
      );
    });
    // the wall itself
    els.push(<mesh key="wall" position={[0, -26, -3.02]} receiveShadow><planeGeometry args={[16, 6]} /><meshStandardMaterial color="#3b3833" roughness={0.95} /></mesh>);
    // ACCOMPLISHMENTS on paper
    const acc = L(18)[1];
    if (t > acc.s - 0.05) {
      const u = appear(acc.s, 0.3);
      const d = Math.max(0, t - (kicksAfter[2] ?? 99) - 0.05);
      els.push(
        <group key="paper" position={[-3.2, -25.95 - 0.5 * 9 * d * d, -2.95 + d * 0.5]} rotation={[d * 0.6, 0, -0.03 + d * 1.6]} scale={[1, mix(0.6, 1, u), 1]}>
          <mesh><planeGeometry args={[1.42, 0.48]} /><meshStandardMaterial color="#d9d3c8" roughness={0.95} /></mesh>
          <group position={[0, 0, 0.01]}><Letters font={a.bebas} family="bebas" text="ACCOMPLISHMENTS" size={0.15} depth={0.001} material={flat(heatOf(acc.s, acc.e), u, new THREE.Color("#2a2724"))} tracking={0.04} bevel={0} shadows={false} /></group>
        </group>,
      );
    }
    els.push(word("18-0", L(18)[0], "GOT", [-3.2, -25.5, -2.9], 0.13));
    els.push(...line(18, [2, 3], [-3.2, -26.38, -2.9], 0.13));
    // ACHIEVEMENTS in a frame
    const ach = L(19)[1];
    if (t > ach.s - 0.05) {
      const u = appear(ach.s, 0.3);
      const d = Math.max(0, t - (kicksAfter[3] ?? 99) - 0.12);
      els.push(
        <group key="ach" position={[1.6, -25.95 - 0.5 * 9 * d * d, -2.95 + d * 0.6]} rotation={[d * 0.8, 0, 0.02 - d * 1.9]} scale={[mix(0.7, 1, u), mix(0.7, 1, u), 1]}>
          <mesh castShadow><boxGeometry args={[1.32, 0.5, 0.05]} /><meshStandardMaterial color="#b49a6a" roughness={0.35} metalness={0.6} /></mesh>
          <mesh position={[0, 0, 0.03]}><planeGeometry args={[1.2, 0.38]} /><meshStandardMaterial color="#151413" /></mesh>
          <group position={[0, 0, 0.04]}><Letters font={a.bebas} family="bebas" text="ACHIEVEMENTS" size={0.16} depth={0.001} material={flat(heatOf(ach.s, ach.e), u)} tracking={0.04} bevel={0} shadows={false} /></group>
        </group>,
      );
    }
    els.push(word("19-0", L(19)[0], "GOT", [1.6, -25.52, -2.9], 0.13));
    els.push(...line(19, [2, 3, 4], [1.6, -26.4, -2.9], 0.13));
    // BUT NONE OF THAT GETS QUIET (in front of the wall, as the frames go)
    const clear20 = 1 - clamp01((t - (L(21)[0].s - 0.15)) / 0.3);
    els.push(...line(20, [0, 1, 2, 3, 4], [3.0, -25.62, -1.9], 0.11, 0, clear20));
    els.push(word("20-5", L(20)[5], "QUIET", [3.2, -25.86, -1.9], 0.2, 0, clear20));
  }
  // WHEN THE DARKNESS STARTS TO CALL
  const dk = L(21)[2], call = L(21)[5];
  els.push(...line(21, [0, 1], [3.2, -25.62, -1.6], 0.11, 0, 1 - clamp01((t - 52.85) / 0.3)));
  if (t > dk.s - 0.05) {
    const u = appear(dk.s, 0.5);
    const o = u * (1 - clamp01((t - 53.0) / 0.6));
    els.push(
      <group key="dark" position={[3.2, -25.95, -1.7]} scale={[mix(1.15, 1, u), mix(1.15, 1, u), 1]}>
        <mesh position={[0, 0, -0.05]}><planeGeometry args={[3.2, 1.0]} /><meshBasicMaterial color="#000" transparent opacity={0.0} /></mesh>
        <Letters font={a.bebas} family="bebas" text="DARKNESS" size={0.3} depth={0.001} material={flat(heatOf(dk.s, dk.e) * 0.3, o, new THREE.Color("#2b2925"))} tracking={0.04} bevel={0} shadows={false} />
      </group>,
    );
  }
  els.push(...line(21, [3, 4], [3.2, -26.32, -1.6], 0.11, 0, 1 - clamp01((t - 52.85) / 0.3)));
  if (t > call.s - 0.05) {
    const o0 = 1 - clamp01((t - 52.85) / 0.3);
    els.push(word("21-5", call, "CALL", [3.2, -26.62, -1.6], 0.24, 0, o0));
    // the call echoes outward, once per beat
    T.beats.filter((b) => b >= call.s - 0.05 && b < 53.2).forEach((b, k) => {
      const d = t - b;
      if (d < 0 || d > 1.2) return;
      const s = 1 + d * 1.4;
      els.push(
        <group key={`echo${k}`} position={[3.2, -26.62, -1.62]} scale={[s, s, 1]}>
          <Letters font={a.bebas} family="bebas" text="CALL" size={0.24} depth={0.001} material={flat(0, 0.35 * (1 - d / 1.2) * o0)} tracking={0.04} bevel={0} shadows={false} />
        </group>,
      );
    });
  }

  // ---------- pre-chorus: the spark comes back and writes; BREAK ----------
  const pc: { li: number; wi: number; x: number; y: number; size: number }[] = [];
  const rowAt = (li: number, wis: number[], y: number, size: number) => {
    const texts = wis.map((wi) => L(li)[wi].w.toUpperCase());
    const lay = layout(a.bebas, texts.join(" "), size, 0.04);
    let ci = 0;
    texts.forEach((tx, k) => {
      const f = lay.letters[ci], l = lay.letters[ci + tx.length - 1];
      pc.push({ li, wi: wis[k], x: 3.2 + (f.x - f.adv / 2 + l.x + l.adv / 2) / 2, y, size });
      ci += tx.length + 1;
    });
  };
  rowAt(22, [0, 1, 2, 3], -25.55, 0.13); rowAt(22, [4, 5], -25.75, 0.13); rowAt(22, [6], -26.02, 0.3);
  rowAt(23, [0, 1, 2, 3, 4], -26.32, 0.13);
  let sparkP: THREE.Vector3 | null = null;
  pc.forEach((r) => {
    const w = L(r.li)[r.wi];
    const wd = layout(a.bebas, w.w.toUpperCase(), r.size, 0.04).width;
    els.push(word(`${r.li}-${r.wi}`, w, w.w.toUpperCase(), [r.x, r.y, -1.6], r.size, 0, 1 - 0.4 * clamp01((t - 57.1) / 0.2)));
    if (t >= w.s - 0.02) sparkP = new THREE.Vector3(r.x + wd / 2 + 0.03, r.y - r.size * 0.25, -1.58);
  });
  const sparkOn = cubicOut(clamp01((t - 52.95) / 0.3));
  const brk = L(23)[5];
  const crack = cubicOut(clamp01((t - (brk.s - 0.04)) / 0.22));
  if (crack > 0) {
    // a jagged split of light across the dark, BREAK in front of it
    const open = cubicInOut(clamp01((t - brk.s) / 0.3));
    const pts = [-2.6, -1.9, -1.2, -0.6, 0, 0.7, 1.3, 2.0, 2.6].map((x, i) => new THREE.Vector2(x * crack, (i % 2 ? 0.06 : -0.05) + (i % 3 === 0 ? 0.03 : 0)));
    const shape = new THREE.Shape([...pts.map((p) => new THREE.Vector2(p.x, p.y + 0.02 + open * 0.16)), ...pts.slice().reverse().map((p) => new THREE.Vector2(p.x, p.y - 0.02 - open * 0.16))]);
    els.push(<mesh key="crack" position={[3.2, -26.62, -1.9]}><shapeGeometry args={[shape]} /><meshBasicMaterial color={new THREE.Color(1, 0.8, 0.6).multiplyScalar(3)} toneMapped={false} /></mesh>);
    els.push(word("23-5", brk, "BREAK", [3.2, -26.62, -1.55], 0.36, 0, 1, new THREE.Color("#141210")));
  }

  // ---------- embers trailing the spark ----------
  const sp = sparkP as THREE.Vector3 | null;
  if (sp) {
    const pa = embers.g.getAttribute("position") as THREE.BufferAttribute;
    embers.jit.forEach((j, i) => { const age = i * 0.02; pa.setXYZ(i, sp.x - age * 0.4 + j.x * 0.03, sp.y - age * age * 2 + j.y * 0.03, sp.z + j.z * 0.02); });
    pa.needsUpdate = true;
  }

  // ---------- camera ----------
  // the spline, averaged over ±0.35 s: every move eases in and out softly
  const pos = new THREE.Vector3(), look = new THREE.Vector3();
  let fov = 0;
  const OFF = [-0.35, -0.23, -0.12, 0, 0.12, 0.23, 0.35], WT = [0.5, 0.8, 1, 1.1, 1, 0.8, 0.5], WS = WT.reduce((x, y) => x + y, 0);
  OFF.forEach((o, i) => { const c = camAt(Math.min(V1B_END, Math.max(V1B_START, t + o))); pos.addScaledVector(c.p, WT[i] / WS); look.addScaledVector(c.l, WT[i] / WS); fov += (c.f * WT[i]) / WS; });
  const upV = new THREE.Vector3(0, 0, -1).lerp(new THREE.Vector3(0, 1, 0), cubicInOut(clamp01((t - 37.25) / 0.6))).normalize();
  const sway = new THREE.Vector3(noise1(t * 0.3, 1) - 0.5, noise1(t * 0.27, 2) - 0.5, 0).multiplyScalar(0.035);
  pos.add(sway); look.add(sway.multiplyScalar(0.5));
  const descend = t < 46.3;
  const flash = clamp01((t - (brk.s + 0.02)) / 0.2);
  const spotI = (1 - lightsOut) * (t > 45.6 ? 1 : 0);

  return (
    <AbsoluteFill style={{ background: "#040405" }}>
      <Stage cam={{ pos: pos.toArray() as V3, look: look.toArray() as V3, fov, up: upV.toArray() as V3 }}
        look={{ exposure: 1.0, env: 0.25, bloom: { strength: 0.9, radius: 0.55, threshold: 0.96 }, bg: "#040405", fog: { color: "#040405", near: 5, far: 22 } }}>
        <ambientLight intensity={0.12} color="#cfd6de" />
        {/* a cold light from far above the void */}
        <directionalLight position={[2, 20, 6]} intensity={descend ? 2.2 : 0.4 * (1 - lightsOut)} color="#dfe6ee" castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-8} shadow-camera-right={8} shadow-camera-top={8} shadow-camera-bottom={-30} shadow-camera-far={60} />
        {/* gallery light along the wall, dying on DARKNESS */}
        {spotI > 0.01 ? <spotLight position={[pos.x, -23.6, 1.2]} target-position={[pos.x + 0.3, -26, -3]} angle={0.75} penumbra={0.9} intensity={34 * spotI} decay={2} color="#ffe9cf" castShadow shadow-mapSize={[1024, 1024]} /> : null}
        {/* a warm glow behind DARKNESS so it reads as a silhouette */}
        {t > dk.s - 0.1 && t < 53.6 ? <pointLight position={[3.2, -25.9, -2.6]} intensity={2.2 * appear(dk.s, 0.5) * (1 - clamp01((t - 52.85) / 0.3))} distance={4} color="#ffb07a" /> : null}
        <Glow geo={dust} size={18} gain={0.9} time={t} twinkle={0.25} color="#e8e1d6" />
        {els}
        {sp && sparkOn > 0.01 ? (
          <>
            <mesh position={(sp as THREE.Vector3).toArray() as V3} material={sparkMat} scale={0.012 * sparkOn}><sphereGeometry args={[1, 14, 10]} /></mesh>
            <Glow geo={embers.g} size={30} gain={1.3 * sparkOn} time={t} color="#ffb47a" twinkle={0.5} />
          </>
        ) : null}
      </Stage>
      {flash > 0 ? <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 58%, rgba(255,226,196,0.5), rgba(255,226,196,0) 60%)", opacity: flash }} /> : null}
    </AbsoluteFill>
  );
};
