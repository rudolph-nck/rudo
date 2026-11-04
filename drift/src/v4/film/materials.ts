import * as THREE from "three";
import { Font } from "three/examples/jsm/loaders/FontLoader.js";
import { glyphGeo } from "../../words/glyphs";
import { rng } from "../../utils/random";

/**
 * Brutalist type materials.
 * Concrete (verses/intro): MeshPhysicalMaterial, roughness 0.75, metalness 0.1, weathered albedo + bump
 * (form-work grain, stains, etched pits, hairline cracks) matching the worn lettering of the Static & Silence cover.
 * Crystal (choruses): the same physical material driven to transmission 0.4, thickness 2.0, roughness 0.2, so the
 * letters refract the sky behind them. `crystal` 0..1 blends the two continuously.
 */

// ---- weathered surface maps (generated once, deterministic) ----
let WX: { albedo: THREE.CanvasTexture; bump: THREE.CanvasTexture; rough: THREE.CanvasTexture } | null = null;
export const weathered = () => {
  if (WX) return WX;
  const N = 1024, r = rng(2718);
  const mk = () => { const c = document.createElement("canvas"); c.width = c.height = N; return c; };
  const ca = mk(), cb = mk(), cr = mk();
  const A = ca.getContext("2d")!, B = cb.getContext("2d")!, Rg = cr.getContext("2d")!;
  // value noise, 4 octaves, tileable
  const grid = (s: number) => { const g = Array.from({ length: s * s }, () => r()); return (x: number, y: number) => { const xi = Math.floor(x) % s, yi = Math.floor(y) % s, xf = x - Math.floor(x), yf = y - Math.floor(y); const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); const a = g[yi * s + xi], b = g[yi * s + ((xi + 1) % s)], c = g[((yi + 1) % s) * s + xi], d = g[((yi + 1) % s) * s + ((xi + 1) % s)]; return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }; };
  const oct = [grid(8), grid(16), grid(48), grid(160)];
  const ia = A.createImageData(N, N), ib = B.createImageData(N, N), ir = Rg.createImageData(N, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const n = oct[0]((x / N) * 8, (y / N) * 8) * 0.45 + oct[1]((x / N) * 16, (y / N) * 16) * 0.3 + oct[2]((x / N) * 48, (y / N) * 48) * 0.17 + oct[3]((x / N) * 160, (y / N) * 160) * 0.08;
    const grain = r();
    const k = (y * N + x) * 4;
    const alb = 150 + (n - 0.5) * 90 + (grain - 0.5) * 26; // concrete grey with cloudy variation
    ia.data[k] = alb; ia.data[k + 1] = alb * 0.985; ia.data[k + 2] = alb * 0.96; ia.data[k + 3] = 255;
    const bmp = 128 + (n - 0.5) * 70 + (grain - 0.5) * 50;
    ib.data[k] = ib.data[k + 1] = ib.data[k + 2] = bmp; ib.data[k + 3] = 255;
    const rgh = 200 + (n - 0.5) * 60 + (grain - 0.5) * 30;
    ir.data[k] = ir.data[k + 1] = ir.data[k + 2] = rgh; ir.data[k + 3] = 255;
  }
  A.putImageData(ia, 0, 0); B.putImageData(ib, 0, 0); Rg.putImageData(ir, 0, 0);
  // water stains / rust streaks running down
  for (let i = 0; i < 40; i++) { const x = r() * N, y = r() * N, w = 6 + r() * 40, h = 80 + r() * 300; const g = A.createLinearGradient(x, y, x, y + h); g.addColorStop(0, `rgba(40,34,28,${0.15 + r() * 0.25})`); g.addColorStop(1, "rgba(40,34,28,0)"); A.fillStyle = g; A.fillRect(x - w / 2, y, w, h); }
  // etched pits / air holes (dark in albedo, deep in bump, rough)
  for (let i = 0; i < 2600; i++) {
    const x = r() * N, y = r() * N, rad = 0.6 + Math.pow(r(), 3) * 5;
    A.fillStyle = `rgba(28,26,24,${0.4 + r() * 0.5})`; A.beginPath(); A.arc(x, y, rad, 0, Math.PI * 2); A.fill();
    B.fillStyle = `rgba(10,10,10,${0.6 + r() * 0.4})`; B.beginPath(); B.arc(x, y, rad, 0, Math.PI * 2); B.fill();
    Rg.fillStyle = "rgba(255,255,255,0.9)"; Rg.beginPath(); Rg.arc(x, y, rad, 0, Math.PI * 2); Rg.fill();
  }
  // chipped patches (lighter albedo, raised edge ring in bump)
  for (let i = 0; i < 60; i++) {
    const x = r() * N, y = r() * N, rad = 4 + r() * 18;
    A.fillStyle = `rgba(200,196,188,${0.2 + r() * 0.3})`; A.beginPath(); for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2, rr = rad * (0.6 + r() * 0.6); k ? A.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : A.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } A.closePath(); A.fill();
    B.fillStyle = "rgba(40,40,40,0.7)"; B.beginPath(); B.arc(x, y, rad * 0.8, 0, Math.PI * 2); B.fill();
  }
  // hairline cracks
  for (let i = 0; i < 26; i++) {
    let x = r() * N, y = r() * N, a = r() * Math.PI * 2;
    A.strokeStyle = `rgba(20,18,16,${0.35 + r() * 0.4})`; B.strokeStyle = "rgba(0,0,0,0.8)"; A.lineWidth = B.lineWidth = 0.6 + r();
    A.beginPath(); B.beginPath(); A.moveTo(x, y); B.moveTo(x, y);
    for (let k = 0; k < 14; k++) { a += (r() - 0.5) * 0.9; x += Math.cos(a) * 9; y += Math.sin(a) * 9; A.lineTo(x, y); B.lineTo(x, y); }
    A.stroke(); B.stroke();
  }
  const tex = (c: HTMLCanvasElement, srgb: boolean) => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1.6, 1.6); t.anisotropy = 8; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; return t; };
  WX = { albedo: tex(ca, true), bump: tex(cb, false), rough: tex(cr, false) };
  return WX;
};

export type Tone = "cold" | "ember" | "amber" | "bone";
const TONE: Record<Tone, THREE.Color> = { cold: new THREE.Color("#cfdcf2"), ember: new THREE.Color("#ff5a36"), amber: new THREE.Color("#ffb066"), bone: new THREE.Color("#ece2d0") };

const cache = new Map<string, THREE.MeshPhysicalMaterial[]>();
/**
 * [face, side] physical materials for a letter.
 * heat 0..1: the word is being sung — its side walls light up (backlit rim) and the face picks up a faint glow.
 * crystal 0..1: concrete → glass. o: opacity (fades).
 */
export const typeMat = (crystal: number, heat: number, o: number, tone: Tone = "cold") => {
  const cq = Math.round(crystal * 6) / 6, hq = Math.round(heat * 10) / 10, oq = Math.round(o * 12) / 12;
  const key = `${cq}|${hq}|${oq}|${tone}`;
  let m = cache.get(key);
  if (m) return m;
  const W = weathered(), glow = TONE[tone];
  const concrete = new THREE.Color("#b3aea6"), glass = new THREE.Color("#f4ecff");
  const face = new THREE.MeshPhysicalMaterial({
    color: concrete.clone().lerp(glass, cq),
    map: W.albedo, bumpMap: W.bump, bumpScale: 1.6 * (1 - cq) + 0.3 * cq, roughnessMap: cq < 0.5 ? W.rough : null,
    roughness: 0.75 + (0.2 - 0.75) * cq, metalness: 0.1 * (1 - cq),
    transmission: 0.4 * cq, thickness: 2.0 * cq, ior: 1.45, attenuationColor: new THREE.Color("#b9a8ff"), attenuationDistance: 3,
    clearcoat: 0.6 * cq, clearcoatRoughness: 0.15, specularIntensity: 0.5 + 0.5 * cq,
    emissive: glow.clone().multiplyScalar(0.005 + (0.02 + 0.25 * cq) * hq), emissiveMap: W.albedo,
  });
  const side = new THREE.MeshPhysicalMaterial({
    color: concrete.clone().multiplyScalar(0.55).lerp(glass, cq), map: W.albedo, bumpMap: W.bump, bumpScale: 1.6 * (1 - cq),
    roughness: 0.8 + (0.2 - 0.8) * cq, metalness: 0.1 * (1 - cq), transmission: 0.4 * cq, thickness: 2.0 * cq, ior: 1.45,
    emissive: glow.clone().multiplyScalar(0.01 + 0.4 * hq),
  });
  for (const x of [face, side]) { x.transparent = oq < 1; x.opacity = oq; x.depthWrite = oq > 0.66; }
  m = [face, side];
  cache.set(key, m);
  return m;
};

/**
 * Distressed glyph geometry: the extruded letter with its vertices pushed by a position-keyed noise field, so edges
 * and corners come out hand-cut and worn instead of CAD-perfect. Keyed on position, so shared seams stay closed.
 */
const dcache = new Map<string, THREE.BufferGeometry>();
export const distressedGlyph = (font: Font, ch: string, size: number, depth: number, family: string, amount = 0.018) => {
  const k = `${family}|${ch}|${size}|${depth}|${amount}`;
  let g = dcache.get(k);
  if (g) return g;
  g = glyphGeo(font, ch, size, depth, family, 0.01).clone();
  const p = g.attributes.position as THREE.BufferAttribute, a = amount * size;
  const h = (x: number, y: number, z: number, s: number) => { const v = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + s) * 43758.5453; return v - Math.floor(v) - 0.5; };
  const f = 9 / size;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const qx = Math.round(x * f * 4) / 4, qy = Math.round(y * f * 4) / 4, qz = Math.round(z * f * 4) / 4;
    p.setXYZ(i, x + h(qx, qy, qz, 1) * a, y + h(qx, qy, qz, 2) * a, z + h(qx, qy, qz, 3) * a * 0.5);
  }
  g.computeVertexNormals();
  dcache.set(k, g);
  return g;
};
