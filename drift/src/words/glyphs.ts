import * as THREE from "three";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { Font } from "three/examples/jsm/loaders/FontLoader.js";
import { rng } from "../utils/random";

type FontData = { glyphs: Record<string, { ha: number }>; resolution: number; boundingBox: { yMin: number; yMax: number } };
const fd = (f: Font) => (f as unknown as { data: FontData }).data;

/** Cap height of the face at `size` (measured off 'H'). */
const capCache = new Map<Font, number>();
export const capHeight = (font: Font, size: number) => {
  let c = capCache.get(font);
  if (c === undefined) {
    const g = new THREE.ShapeGeometry(font.generateShapes("H", 1));
    g.computeBoundingBox();
    c = g.boundingBox!.max.y - g.boundingBox!.min.y;
    capCache.set(font, c);
  }
  return c * size;
};

/** Letter positions (x of each glyph's centre) for a word centred on 0, with tracking in em. */
export const layout = (font: Font, text: string, size: number, tracking = 0) => {
  const d = fd(font);
  let x = 0;
  const out = [...text].map((ch) => {
    const adv = ((d.glyphs[ch]?.ha ?? d.glyphs["?"]?.ha ?? 500) / d.resolution) * size;
    const o = { ch, x: x + adv / 2, adv };
    x += adv + tracking * size;
    return o;
  });
  const w = x - tracking * size;
  out.forEach((o) => (o.x -= w / 2));
  return { letters: out, width: w };
};

const geoCache = new Map<string, THREE.BufferGeometry>();
/** One extruded, bevelled glyph centred on its advance box; baseline-to-cap centred on y=0. */
export const glyphGeo = (font: Font, ch: string, size: number, depth: number, family = "f", bevel = 0.02) => {
  const k = `${family}|${ch}|${size}|${depth}|${bevel}`;
  let g = geoCache.get(k);
  if (!g) {
    const d = fd(font);
    const adv = ((d.glyphs[ch]?.ha ?? 500) / d.resolution) * size;
    g = new TextGeometry(ch, {
      font, size, depth, curveSegments: 10, bevelEnabled: bevel > 0,
      bevelThickness: size * bevel, bevelSize: size * bevel * 0.6, bevelSegments: 4,
    });
    g.translate(-adv / 2, -capHeight(font, size) / 2, -depth / 2);
    g.computeVertexNormals();
    // planar UVs from x/y in world units (stone texture runs continuously across a word)
    const pos = g.attributes.position as THREE.BufferAttribute;
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      uv[i * 2] = pos.getX(i) + pos.getZ(i) * 0.7;
      uv[i * 2 + 1] = pos.getY(i) + pos.getZ(i) * 0.3;
    }
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    geoCache.set(k, g);
  }
  return g;
};

/**
 * Points sampled on a word's face (area-weighted) plus densely along its outline, for
 * star/neon letters. Returns positions (centred like glyphGeo) and a per-point seed 0..1.
 */
export const wordPoints = (font: Font, text: string, size: number, n: number, edgeShare = 0.45, seed = 1, tracking = 0) => {
  const r = rng(seed);
  const { letters } = layout(font, text, size, tracking);
  const pos: number[] = [];
  const seeds: number[] = [];
  const letterIdx: number[] = [];
  const cap = capHeight(font, size);
  letters.forEach((L, li) => {
    if (L.ch === " ") return;
    const shapes = font.generateShapes(L.ch, size);
    const geo = new THREE.ShapeGeometry(shapes, 8);
    const p = geo.attributes.position as THREE.BufferAttribute;
    const idx = geo.index!;
    const tris: { a: THREE.Vector3; b: THREE.Vector3; c: THREE.Vector3; area: number }[] = [];
    let total = 0;
    for (let i = 0; i < idx.count; i += 3) {
      const a = new THREE.Vector3().fromBufferAttribute(p, idx.getX(i));
      const b = new THREE.Vector3().fromBufferAttribute(p, idx.getX(i + 1));
      const c = new THREE.Vector3().fromBufferAttribute(p, idx.getX(i + 2));
      const area = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).length() / 2;
      tris.push({ a, b, c, area });
      total += area;
    }
    const per = Math.round(n / letters.length);
    const nFace = Math.round(per * (1 - edgeShare));
    for (let k = 0; k < nFace; k++) {
      let x = r() * total;
      const t = tris.find((q) => (x -= q.area) <= 0) ?? tris[tris.length - 1];
      let u = r(), v = r();
      if (u + v > 1) { u = 1 - u; v = 1 - v; }
      const q = t.a.clone().addScaledVector(new THREE.Vector3().subVectors(t.b, t.a), u).addScaledVector(new THREE.Vector3().subVectors(t.c, t.a), v);
      pos.push(q.x - L.adv / 2 + L.x, q.y - cap / 2, (r() - 0.5) * size * 0.06);
      seeds.push(r()); letterIdx.push(li);
    }
    const outline = shapes.flatMap((s) => [s.getSpacedPoints(200), ...s.holes.map((h) => h.getSpacedPoints(120))]);
    const olen = outline.reduce((a, o) => a + o.length, 0);
    for (let k = 0; k < per - nFace; k++) {
      let x = Math.floor(r() * olen);
      const o = outline.find((q) => (x -= q.length) < 0) ?? outline[0];
      const q = o[(x + o.length) % o.length];
      pos.push(q.x - L.adv / 2 + L.x + (r() - 0.5) * size * 0.006, q.y - cap / 2 + (r() - 0.5) * size * 0.006, 0);
      seeds.push(r()); letterIdx.push(li);
    }
  });
  return { pos: new Float32Array(pos), seeds: new Float32Array(seeds), letter: new Float32Array(letterIdx) };
};
