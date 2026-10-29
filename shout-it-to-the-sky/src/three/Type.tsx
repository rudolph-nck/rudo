import React, { useMemo } from "react";
import * as THREE from "three";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { Font } from "three/examples/jsm/loaders/FontLoader.js";
import { Line } from "../data";
import { clamp01, cubicOut, mix } from "../utils/ease";
import { rng } from "../utils/random";

// RUDO palette: monochrome stone/concrete greys; the accent is white light, not a hue.
export const ACCENT = "#ffffff";

// ---------------------------------------------------------------------------------------------
// letters
const letterCache = new Map<string, THREE.BufferGeometry>();
export const letterGeo = (font: Font, ch: string, size: number) => {
  const key = `${ch}|${size}`;
  let g = letterCache.get(key);
  if (!g) {
    g = new TextGeometry(ch, { font, size, depth: size * 0.04, curveSegments: 6, bevelEnabled: false });
    letterCache.set(key, g);
  }
  return g;
};
export const advance = (font: Font, ch: string, size: number) => {
  const d = (font as unknown as { data: { glyphs: Record<string, { ha: number }>; resolution: number } }).data;
  return ((d.glyphs[ch]?.ha ?? d.glyphs["?"]?.ha ?? 500) / d.resolution) * size;
};
const wordW = (font: Font, w: string, size: number) => [...w].reduce((a, ch) => a + advance(font, ch, size) * 0.98, 0);

/** Shared flat type materials: ghost (unspoken letters), lit, accent, hot flash. */
export const typeMats = () => ({
  ghost: new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.13, depthWrite: false }),
  lit: new THREE.MeshBasicMaterial({ color: "#a8a49d" }),
  accent: new THREE.MeshBasicMaterial({ color: new THREE.Color("#f4f2ee").multiplyScalar(1.25), toneMapped: false }),
  hot: new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffffff").multiplyScalar(2.2), toneMapped: false }),
  steel: new THREE.MeshBasicMaterial({ color: "#9ea3a6" }),
});
export type TypeMats = ReturnType<typeof typeMats>;

export type FillMode = "fill" | "slam";

/** Rows of words, centred; optional forced breaks after "!" (chants). */
export const layoutWords = (font: Font, words: string[], size: number, maxW: number, lineH = 1.1, chant = false) => {
  const space = size * 0.3;
  const rows: number[][] = [[]];
  let cur = 0;
  words.forEach((w, i) => {
    const ww = wordW(font, w, size);
    const row = rows[rows.length - 1];
    const forced = chant && i > 0 && /!$/.test(words[i - 1]);
    if (row.length && (cur + space + ww > maxW || forced)) {
      rows.push([i]);
      cur = ww;
    } else {
      row.push(i);
      cur += (row.length > 1 ? space : 0) + ww;
    }
  });
  const pos: { x: number; y: number; w: number }[] = [];
  rows.forEach((row, ri) => {
    const ws = row.map((i) => wordW(font, words[i], size));
    let x = -(ws.reduce((a, b) => a + b, 0) + space * (row.length - 1)) / 2;
    row.forEach((i, k) => {
      pos[i] = { x, y: ((rows.length - 1) / 2 - ri) * size * lineH - size * 0.36, w: ws[k] };
      x += ws[k] + space;
    });
  });
  return { pos, rows: rows.length, h: rows.length * size * lineH };
};

/**
 * A lyric line in the reference's type style: each word appears (ghosted) on its sung time and
 * fills letter by letter across its duration; the line's last word is the accent colour.
 * "slam" fills the whole word at once with a scale punch (shouted lines).
 */
export const FillLine: React.FC<{
  font: Font;
  line: Line;
  t: number;
  size: number;
  maxW: number;
  mats: TypeMats;
  mode?: FillMode;
  out?: number;
  chant?: boolean;
  accentAll?: RegExp;
  base?: "lit" | "steel";
  sparks?: THREE.Material;
  up?: [number, number, number];
  accentLast?: boolean;
  upper?: boolean;
}> = ({ font, line, t, size, maxW, mats, mode = "fill", out, chant, accentAll, base = "lit", sparks, up = [0, 1, 0], accentLast = true, upper = true }) => {
  const words = useMemo(() => line.words.map((w) => (upper ? w.w.toUpperCase() : w.w)), [line.id, upper]);
  const lay = useMemo(() => layoutWords(font, words, size, maxW, 1.08, chant), [line.id, size, maxW]);
  if (t < line.start - 0.01) return null;
  const q = out !== undefined ? clamp01((t - out) / 0.3) : 0;
  if (q >= 1) return null;
  const last = words.length - 1;
  return (
    <group scale={[1 + q * 0.06, 1 - q, 1]}>
      {line.words.map((w, wi) => {
        if (t < w.s) return null;
        const accent = (accentLast && wi === last) || (accentAll && accentAll.test(w.w)) || (chant && /grinding/i.test(w.w));
        const letters = [...words[wi]];
        const dur = Math.max(0.12, (w.e - w.s) * 0.85);
        const dt = t - w.s;
        const slam = mode === "slam" ? cubicOut(clamp01(dt / 0.1)) : 1;
        let x = lay.pos[wi].x;
        const sc = mode === "slam" ? mix(1.35, 1, slam) : 1;
        const cx = lay.pos[wi].x + lay.pos[wi].w / 2;
        return (
          <group key={wi} position={[cx, lay.pos[wi].y, 0]} scale={sc}>
            {letters.map((ch, li) => {
              const lx = x - cx;
              x += advance(font, ch, size) * 0.98;
              if (ch === " ") return null;
              const lit = mode === "slam" ? 0 : w.s + (dur * li) / letters.length;
              const on = t >= lit;
              const fresh = on && t - lit < 0.07;
              const m = !on ? mats.ghost : fresh && accent ? mats.hot : accent ? mats.accent : base === "steel" ? mats.steel : mats.lit;
              const pop = on ? 1 + 0.12 * Math.exp(-(t - lit) / 0.05) : 1;
              return <mesh key={li} geometry={letterGeo(font, ch, size)} material={m} position={[lx, 0, 0]} scale={[pop, pop, 1]} />;
            })}
            {sparks && accent ? (
              <SparkBurst t={t} at={mode === "slam" ? w.s : w.s + dur * 0.5} origin={[0, size * 0.4, 0.02]} count={70} speed={2.4 * size * 3} spread={1.3} gravity={[-up[0] * 4, -up[1] * 4, -up[2] * 4]} mat={sparks} seed={wi * 13 + line.id.length} life={0.55} len={0.035} dir={[0.4, 0.8, 0.45]} />
            ) : null}
          </group>
        );
      })}
    </group>
  );
};

// ---------------------------------------------------------------------------------------------
/**
 * Welding / grinder sparks: short bright streaks (motion-blurred segments) under gravity.
 * Deterministic: particle k leaves at `at + k / rate` with a seeded velocity.
 */
export const SparkBurst: React.FC<{
  t: number;
  at: number;
  origin: [number, number, number];
  count: number;
  speed: number;
  spread: number;
  gravity: [number, number, number];
  mat: THREE.Material;
  seed: number;
  life?: number;
  len?: number;
  dir?: [number, number, number];
  rate?: number;
}> = ({ t, at, origin, count, speed, spread, gravity, mat, seed, life = 0.7, len = 0.05, dir = [0, 1, 0], rate = 0 }) => {
  const P = useMemo(() => {
    const r = rng(seed * 7919 + 17);
    const d = new THREE.Vector3(...dir).normalize();
    return Array.from({ length: count }, (_, k) => {
      const v = d
        .clone()
        .add(new THREE.Vector3((r() - 0.5) * 2, (r() - 0.5) * 2, (r() - 0.5) * 2).multiplyScalar(spread))
        .normalize()
        .multiplyScalar(speed * (0.35 + r() * 0.9));
      return { v, t0: rate > 0 ? k / rate : r() * 0.05, life: life * (0.4 + r() * 0.8), hot: r() };
    });
  }, [seed, count, speed, spread, life, rate, dir[0], dir[1], dir[2]]);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 6), 3));
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(count * 6), 3));
    return g;
  }, [count]);
  const dt = t - at;
  const span = (rate > 0 ? count / rate : 0.05) + life * 1.3;
  if (dt < 0 || dt > span) return null;
  const pos = geo.attributes.position.array as Float32Array;
  const col = geo.attributes.color.array as Float32Array;
  const g = new THREE.Vector3(...gravity);
  P.forEach((p, i) => {
    const a = dt - p.t0;
    let k = a / p.life;
    if (a < 0 || k > 1) k = 1;
    const at2 = Math.max(0, a);
    const head = new THREE.Vector3(...origin).addScaledVector(p.v, at2).addScaledVector(g, 0.5 * at2 * at2);
    const vel = p.v.clone().addScaledVector(g, at2);
    const tail = head.clone().addScaledVector(vel, -len * (1 / Math.max(0.5, speed)) * 4);
    pos.set([head.x, head.y, head.z, tail.x, tail.y, tail.z], i * 6);
    const f = k >= 1 ? 0 : (1 - k) * (1 - k);
    const v = (1.4 + p.hot * 0.9) * f * f;
    col.set([v, v, v * 1.04, v * 0.3, v * 0.3, v * 0.32], i * 6);
  });
  geo.attributes.position.needsUpdate = true;
  geo.attributes.color.needsUpdate = true;
  return <lineSegments geometry={geo} material={mat} frustumCulled={false} />;
};

export const sparkMat = () => new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
