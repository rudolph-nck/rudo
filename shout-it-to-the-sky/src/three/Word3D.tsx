import React, { useMemo } from "react";
import * as THREE from "three";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { Font } from "three/examples/jsm/loaders/FontLoader.js";
import { clamp01, cubicIn, cubicOut, expoOut, mix } from "../utils/ease";

const geoCache = new Map<string, { geo: THREE.BufferGeometry; w: number; h: number }>();

/** Extruded, bevelled word geometry, centred on its x/y extents (cached). */
export const wordGeo = (font: Font, text: string, size: number, depth: number, family: string) => {
  const key = `${family}|${text}|${size}|${depth}`;
  let g = geoCache.get(key);
  if (!g) {
    const geo = new TextGeometry(text, {
      font,
      size,
      depth,
      curveSegments: 5,
      bevelEnabled: true,
      bevelThickness: Math.min(depth * 0.35, size * 0.03),
      bevelSize: size * 0.012,
      bevelSegments: 2,
    });
    geo.computeBoundingBox();
    const b = geo.boundingBox!;
    geo.translate(-(b.max.x + b.min.x) / 2, -(b.max.y + b.min.y) / 2, -depth / 2);
    geo.computeVertexNormals();
    g = { geo, w: b.max.x - b.min.x, h: b.max.y - b.min.y };
    geoCache.set(key, g);
  }
  return g;
};

/** Measured advance width of a word at a given size (for laying out rows). */
export const wordWidth = (font: Font, text: string, size: number) => {
  const data = (font as unknown as { data: { glyphs: Record<string, { ha: number }>; resolution: number } }).data;
  let w = 0;
  for (const ch of text) w += data.glyphs[ch]?.ha ?? data.glyphs["?"]?.ha ?? 500;
  return (w / data.resolution) * size;
};

export type Reveal = "slam" | "rise" | "drop" | "snap" | "flare" | "glide";

/**
 * A word that exists in the world from `at` (its sung time). Reveal is in the word's local
 * frame: +y is the word's up, +z faces the viewer.
 */
export const Word3D: React.FC<{
  font: Font;
  family: string;
  text: string;
  size: number;
  depth: number;
  material: THREE.Material;
  hot?: THREE.Material;
  t: number;
  at: number;
  out?: number;
  reveal?: Reveal;
  position: [number, number, number];
  rotation?: [number, number, number];
  order?: THREE.EulerOrder;
}> = ({ font, family, text, size, depth, material, hot, t, at, out, reveal = "snap", position, rotation = [0, 0, 0], order = "XYZ" }) => {
  const g = wordGeo(font, text, size, depth, family);
  const euler = useMemo(() => new THREE.Euler(rotation[0], rotation[1], rotation[2], order), [rotation[0], rotation[1], rotation[2], order]);
  if (t < at) return null;
  const dt = t - at;
  let sx = 1, sy = 1, sz = 1, ox = 0, oy = 0, oz = 0, ry = 0;
  if (reveal === "slam") {
    const p = cubicOut(clamp01(dt / 0.12));
    const s = mix(2.4, 1, p) * (1 + 0.04 * Math.exp(-Math.max(0, dt - 0.12) / 0.07) * Math.sin(dt * 70));
    sx = sy = sz = s;
    oz = (1 - p) * size * 3;
  } else if (reveal === "snap") {
    const p = cubicOut(clamp01(dt / 0.08));
    sx = sy = sz = mix(1.35, 1, p);
  } else if (reveal === "rise") {
    const p = expoOut(clamp01(dt / 0.3));
    oy = -(1 - p) * size * 2.2;
    sy = mix(0.05, 1, p);
  } else if (reveal === "drop") {
    const p = clamp01(dt / 0.3);
    const land = dt - 0.3;
    oy = (1 - cubicIn(p)) * 3.0 + (land > 0 ? Math.abs(Math.sin(land * 26)) * 0.06 * Math.exp(-land / 0.07) : 0);
    ry = (1 - p) * 0.5;
  } else if (reveal === "flare") {
    const p = expoOut(clamp01(dt / 0.55));
    oy = -(1 - p) * 4.5;
    sx = sy = sz = mix(0.6, 1, p);
  } else if (reveal === "glide") {
    const p = cubicOut(clamp01(dt / 0.45));
    oy = -(1 - p) * size * 0.6;
    sx = sy = sz = mix(0.9, 1, p);
  }
  let vis = true;
  if (out !== undefined && t > out) {
    const q = clamp01((t - out) / 0.35);
    if (q >= 1) vis = false;
    sx *= 1 + q * 0.5;
    sy *= 1 - q;
    sz *= 1 + q * 0.5;
  }
  if (!vis) return null;
  const useHot = hot && dt < 0.14;
  return (
    <group position={position} rotation={euler}>
      <group position={[ox, oy, oz]} rotation={[0, ry, 0]} scale={[sx, sy, sz]}>
        <mesh geometry={g.geo} material={useHot ? hot : material} castShadow />
      </group>
    </group>
  );
};

/** Lay a list of words into centred rows that fit `maxW`; returns local x/y per word. */
export const layoutRows = (font: Font, words: string[], size: number, maxW: number, lineH = 1.08, breakAt?: (w: string, i: number) => boolean) => {
  const space = size * 0.28;
  const rows: { i: number; w: number }[][] = [[]];
  let cur = 0;
  words.forEach((w, i) => {
    const ww = wordWidth(font, w, size);
    const row = rows[rows.length - 1];
    if (row.length && (cur + space + ww > maxW || (breakAt && breakAt(words[i - 1], i - 1)))) {
      rows.push([{ i, w: ww }]);
      cur = ww;
    } else {
      row.push({ i, w: ww });
      cur += (row.length > 1 ? space : 0) + ww;
    }
  });
  const out: { x: number; y: number; w: number }[] = new Array(words.length);
  rows.forEach((row, ri) => {
    const total = row.reduce((a, r) => a + r.w, 0) + space * (row.length - 1);
    let x = -total / 2;
    row.forEach((r) => {
      out[r.i] = { x: x + r.w / 2, y: ((rows.length - 1) / 2 - ri) * size * lineH, w: r.w };
      x += r.w + space;
    });
  });
  return { pos: out, rows: rows.length };
};
