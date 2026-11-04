import React, { useMemo } from "react";
import * as THREE from "three";
import { Font } from "three/examples/jsm/loaders/FontLoader.js";
import { capHeight, glyphGeo, layout } from "../words/glyphs";
import { rng } from "../utils/random";
import { Beh, LX, W, clean, heat, letterXf, sylStarts } from "./core";
import { Tone, distressedGlyph, typeMat } from "./film/materials";
import { WetFloor } from "./film/env";

/** Palette for Drift v2: industrial red + cold office blue in the city; indigo, charcoal and amber starlight above. */
export const C = {
  red: new THREE.Color("#d2382b"), blue: new THREE.Color("#5f8fd8"), coldWhite: new THREE.Color("#dfe7f2"),
  amber: new THREE.Color("#ffb066"), indigo: new THREE.Color("#1d1a4a"), char: new THREE.Color("#0b0b0e"), bone: new THREE.Color("#ece2d0"),
};

// ---------------------------------------------------------------------------------------------
// Words as solid objects
export type WStyle = "city" | "drift" | "serif" | "steel";
/**
 * Surface micro-detail for the letters: brushed grain, fine pitting, a few hairline scratches and smudges.
 * Used as roughness + bump map so moving light catches imperfections. Glyph UVs are in metres, so repeat ~4/m.
 */
export const surfaceTex = (() => {
  let tx: THREE.CanvasTexture | null = null;
  return () => {
    if (tx) return tx;
    const N = 512, c = document.createElement("canvas"); c.width = c.height = N;
    const g = c.getContext("2d")!, r = rng(808);
    const img = g.createImageData(N, N);
    // brushed: per-row streak value + per-pixel grain
    const rowv = Array.from({ length: N }, () => r());
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const k = (y * N + x) * 4;
      const streak = rowv[y] * 0.5 + rowv[(y + 1) % N] * 0.3 + rowv[(y + 3) % N] * 0.2;
      const v = 118 + (streak - 0.5) * 46 + (r() - 0.5) * 30;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = v; img.data[k + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    // smudges (rougher patches)
    for (let i = 0; i < 26; i++) { const x = r() * N, y = r() * N, rad = 20 + r() * 70; const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, `rgba(${r() < 0.5 ? "200,200,200" : "60,60,60"},${0.12 + r() * 0.14})`); gr.addColorStop(1, "rgba(128,128,128,0)"); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
    // hairline scratches
    for (let i = 0; i < 70; i++) { g.strokeStyle = `rgba(${r() < 0.6 ? 230 : 40},${r() < 0.6 ? 230 : 40},${r() < 0.6 ? 230 : 40},${0.15 + r() * 0.3})`; g.lineWidth = 0.5 + r() * 0.8; g.beginPath(); const x = r() * N, y = r() * N, a = (r() - 0.5) * 0.5 + (r() < 0.3 ? Math.PI / 2 : 0), L = 20 + r() * 140; g.moveTo(x, y); g.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); g.stroke(); }
    // pitting
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(30,30,30,${0.2 + r() * 0.4})`; g.fillRect(r() * N, r() * N, 1 + r() * 1.5, 1 + r() * 1.5); }
    tx = new THREE.CanvasTexture(c); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(4, 4); tx.colorSpace = THREE.NoColorSpace; tx.anisotropy = 4;
    return tx;
  };
})();

/** Rim (side-wall) emission colour per style: the backlight of the letters. */
const RIM: Record<WStyle, THREE.Color> = { city: new THREE.Color("#cfdcf2"), steel: new THREE.Color("#ffb066"), serif: new THREE.Color("#ece2d0"), drift: new THREE.Color("#ffb066") };
const matCache = new Map<string, THREE.MeshStandardMaterial[]>();
/**
 * A letter's materials: [face, side]. Faces are tangible (anodized brushed metal in the city, matte ceramic /
 * satin bone above); the side walls and bevels carry the emission, so a sung word is backlit along its edges.
 */
export const letterMat = (style: WStyle, h: number, o: number, alarm = 0) => {
  const hq = Math.round(h * 10), oq = Math.round(o * 12), aq = Math.round(alarm * 4);
  const key = `${style}|${hq}|${oq}|${aq}`;
  let m = matCache.get(key);
  if (!m) {
    const k = hq / 10, st = surfaceTex();
    let face: THREE.MeshStandardMaterial, side: THREE.MeshStandardMaterial;
    const rim = RIM[style].clone().lerp(C.red, aq / 4);
    if (style === "city") {
      face = new THREE.MeshStandardMaterial({ color: "#8d9098", metalness: 0.78, roughness: 1.0, roughnessMap: st, bumpMap: st, bumpScale: 0.35, envMapIntensity: 0.9, emissive: rim.clone().multiplyScalar(0.02 + 0.05 * k) });
      side = new THREE.MeshStandardMaterial({ color: "#2a2c31", metalness: 0.6, roughness: 0.4, emissive: rim.clone().multiplyScalar(0.04 + 1.05 * k) });
    } else if (style === "steel") {
      face = new THREE.MeshStandardMaterial({ color: "#b9b2a8", metalness: 0.85, roughness: 0.85, roughnessMap: st, bumpMap: st, bumpScale: 0.3, emissive: rim.clone().multiplyScalar(0.25 * k) });
      side = new THREE.MeshStandardMaterial({ color: "#3a332c", metalness: 0.6, roughness: 0.4, emissive: rim.clone().multiplyScalar(0.1 + 1.8 * k) });
    } else if (style === "serif") {
      face = new THREE.MeshStandardMaterial({ color: "#efe5d5", metalness: 0.05, roughness: 1.0, roughnessMap: st, bumpMap: st, bumpScale: 0.2, emissive: C.bone.clone().multiplyScalar(0.18 + 0.45 * k) });
      side = new THREE.MeshStandardMaterial({ color: "#5a5048", roughness: 0.6, emissive: rim.clone().multiplyScalar(0.15 + 1.2 * k) });
    } else {
      face = new THREE.MeshStandardMaterial({ color: "#f3e6d2", metalness: 0.05, roughness: 1.0, roughnessMap: st, bumpMap: st, bumpScale: 0.2, emissive: C.amber.clone().multiplyScalar(0.22 + 0.7 * k) });
      side = new THREE.MeshStandardMaterial({ color: "#4a3a2a", roughness: 0.5, emissive: rim.clone().multiplyScalar(0.2 + 1.6 * k) });
    }
    for (const x of [face, side]) { x.transparent = oq < 12; x.opacity = oq / 12; x.depthWrite = oq > 8; }
    m = [face, side];
    matCache.set(key, m);
  }
  return m;
};
/** A soft additive halo behind a sung word: the light its backlit letters throw onto the air around them. */
const haloMats = new Map<string, THREE.MeshBasicMaterial>();
export const Halo: React.FC<{ w: number; h: number; color: THREE.Color; k: number; z?: number }> = ({ w, h, color, k, z = -0.04 }) => {
  const kq = Math.round(k * 16);
  if (kq <= 0) return null;
  const key = `${color.getHexString()}|${kq}`;
  let m = haloMats.get(key);
  if (!m) { m = new THREE.MeshBasicMaterial({ map: dot(), color: color.clone().multiplyScalar(0.09 * kq / 16), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }); haloMats.set(key, m); }
  return <mesh material={m} position={[0, 0, z]}><planeGeometry args={[w, h]} /></mesh>;
};
export const fontFor = (a: { inter: Font; mono: Font; serif: Font; bebas: Font }, style: WStyle) => (style === "city" ? a.inter : style === "serif" ? a.serif : style === "steel" ? a.bebas : a.mono);

/**
 * One sung word as a row of extruded letters, revealed by syllable and moved by its behaviour.
 * Placed at `pos` with rotation `rot` (word centred on 0). Depth gives it mass; long shadows from the lights.
 */
export const Word3D: React.FC<{ font: Font; li: number; wi: number; t: number; size: number; style: WStyle; beh?: Beh; pos?: [number, number, number]; rot?: [number, number, number]; depth?: number; kickT?: number; fade?: number; text?: string; halo?: boolean; alarm?: number; crystal?: number; tone?: Tone }> = ({ font, li, wi, t, size, style, beh = "pop", pos = [0, 0, 0], rot = [0, 0, 0], depth = 0.22, kickT, fade = 1, text, halo = false, alarm = 0, crystal, tone }) => {
  const cr = crystal ?? (style === "city" ? 0 : 1);
  const tn: Tone = tone ?? (alarm > 0.5 ? "ember" : style === "city" ? "cold" : style === "serif" ? "bone" : "amber");
  const w = W(li, wi);
  const word = text ?? clean(w.w);
  if (t < w.s - 0.08) return null;
  const lay = layout(font, word, size, 0.04);
  const starts = sylStarts(li, wi);
  const n = word.length;
  const h = heat(t, w);
  return (
    <group position={pos} rotation={rot}>
      {halo ? <Halo w={lay.width * 1.25 + size * 0.6} h={size * 2.0} color={RIM[style]} k={h * fade * (t >= w.s ? 1 : 0)} z={-size * depth - 0.01} /> : null}
      {lay.letters.map((L, i) => {
        if (L.ch === " ") return null;
        const x: LX = letterXf(beh, t, w, i, n, L.x / size, starts[i] ?? w.s, li * 31 + wi, kickT);
        const o = x.o * fade;
        if (o <= 0.01) return null;
        return (
          <mesh key={i} geometry={distressedGlyph(font, L.ch, size, size * depth, `v5${style}`, cr > 0.5 ? 0.004 : 0.02)} material={typeMat(cr, h, o, tn)}
            position={[x.p[0] * size, x.p[1] * size, x.p[2] * size]} rotation={x.r} scale={x.s} castShadow receiveShadow />
        );
      })}
    </group>
  );
};
/** Width of a word (for layout). */
export const wordW = (font: Font, li: number, wi: number, size: number) => layout(font, clean(W(li, wi).w), size, 0.04).width;
/** A line laid out in rows; returns the centre of every word (local space, line centred on 0). */
export const layLine = (font: Font, li: number, rows: number[][], sizes: number[], gap = 0.32) => {
  const out: { wi: number; x: number; y: number; size: number }[] = [];
  const hs = rows.map((_, ri) => sizes[ri] ?? sizes[sizes.length - 1]);
  const totalH = hs.reduce((s, x) => s + x * 1.05, 0);
  let y = totalH / 2;
  rows.forEach((r, ri) => {
    const size = hs[ri];
    y -= size * 0.525;
    const ws = r.map((wi) => wordW(font, li, wi, size));
    const width = ws.reduce((a, b) => a + b, 0) + gap * size * (r.length - 1);
    let x = -width / 2;
    r.forEach((wi, k) => { out.push({ wi, x: x + ws[k] / 2, y, size }); x += ws[k] + gap * size; });
    y -= size * 0.525;
  });
  return { words: out, height: totalH, width: Math.max(...rows.map((r, ri) => r.reduce((s, wi) => s + wordW(font, li, wi, hs[ri]), 0) + gap * hs[ri] * (r.length - 1))) };
};

// ---------------------------------------------------------------------------------------------
// A notification as a glass panel: near-invisible dark glass, hairline edges with a chromatic fringe (red/cyan split),
// bright corner ticks, a tiny mono caption over a hairline rule. No solid title bars, no opaque slab.
const panelCache = new Map<string, THREE.Material>();
const pm = (key: string, make: () => THREE.Material) => { let m = panelCache.get(key); if (!m) { m = make(); panelCache.set(key, m); } return m; };
export const Popup: React.FC<{ w: number; h: number; tone: "red" | "blue"; title: string; font: Font; flash?: number; o?: number; children?: React.ReactNode }> = ({ w, h, tone, title, font, flash = 0, o = 1, children }) => {
  const col = tone === "red" ? C.red : C.coldWhite;
  const oq = Math.round(o * 10) / 10, fq = Math.round(flash * 8) / 8;
  const glass = pm(`g|${tone}|${oq}|${fq}`, () => new THREE.MeshPhysicalMaterial({ color: "#07090d", roughness: 0.14, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.4, transparent: true, opacity: (0.62 + 0.08 * fq) * oq, depthWrite: false, emissive: col.clone().multiplyScalar(0.04 * fq) }));
  const edge = pm(`e|${tone}|${oq}|${fq}`, () => new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(0.55 + 1.3 * fq), transparent: true, opacity: 0.85 * oq, depthWrite: false }));
  const tick = pm(`t|${tone}|${oq}|${fq}`, () => new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(1.2 + 1.8 * fq), transparent: true, opacity: oq, depthWrite: false }));
  const fr = pm(`fr|${oq}`, () => new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.12, 0.08), transparent: true, opacity: 0.45 * oq, depthWrite: false, blending: THREE.AdditiveBlending }));
  const fb = pm(`fb|${oq}`, () => new THREE.MeshBasicMaterial({ color: new THREE.Color(0.05, 0.45, 1), transparent: true, opacity: 0.45 * oq, depthWrite: false, blending: THREE.AdditiveBlending }));
  const rule = pm(`r|${tone}|${oq}`, () => new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(0.6), transparent: true, opacity: 0.35 * oq, depthWrite: false }));
  if (oq <= 0) return <group>{children}</group>;
  const hw = 0.0016, ca = 0.0024, tl = Math.min(w, h) * 0.12, tt = 0.003;
  const cap = Math.min(0.022, h * 0.09);
  const tlay = layout(font, title, cap, 0.25);
  const ty = h / 2 - cap * 1.4;
  const frame = (mat: THREE.Material, dx: number, dy: number, key: string) => (
    <group key={key} position={[dx, dy, 0]}>
      <mesh material={mat} position={[0, h / 2, 0]}><planeGeometry args={[w, hw]} /></mesh>
      <mesh material={mat} position={[0, -h / 2, 0]}><planeGeometry args={[w, hw]} /></mesh>
      <mesh material={mat} position={[-w / 2, 0, 0]}><planeGeometry args={[hw, h]} /></mesh>
      <mesh material={mat} position={[w / 2, 0, 0]}><planeGeometry args={[hw, h]} /></mesh>
    </group>
  );
  return (
    <group>
      <mesh material={glass} position={[0, 0, -0.012]}><boxGeometry args={[w, h, 0.006]} /></mesh>
      {frame(fr, ca, ca * 0.5, "fr")}{frame(fb, -ca, -ca * 0.5, "fb")}{frame(edge, 0, 0, "e")}
      {[[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([sx, sy], i) => (
        <group key={i} position={[(sx * w) / 2, (sy * h) / 2, 0.001]}>
          <mesh material={tick} position={[(-sx * tl) / 2, 0, 0]}><planeGeometry args={[tl, tt]} /></mesh>
          <mesh material={tick} position={[0, (-sy * tl) / 2, 0]}><planeGeometry args={[tt, tl]} /></mesh>
        </group>
      ))}
      <group position={[-w / 2 + cap * 1.2 + tlay.width / 2, ty, 0.002]}>
        {tlay.letters.map((L, i) => (L.ch === " " ? null : <mesh key={i} geometry={glyphGeo(font, L.ch, cap, 0.001, "v4cap", 0)} material={edge} position={[L.x, 0, 0]} />))}
      </group>
      <mesh material={rule} position={[0, ty - cap * 0.95, 0.001]}><planeGeometry args={[w - cap * 2.4, 0.0012]} /></mesh>
      {/* a tiny close mark, two hairlines */}
      {[1, -1].map((s2) => <mesh key={s2} material={edge} position={[w / 2 - cap * 1.4, ty, 0.002]} rotation={[0, 0, (s2 * Math.PI) / 4]}><planeGeometry args={[cap * 0.9, 0.0014]} /></mesh>)}
      {children}
    </group>
  );
};

// Volumetric light: a cone of lit air from a source to a target. View-dependent falloff (soft at the silhouette),
// fading along its length, with slow drifting density so it reads as dust in the beam rather than a solid shape.
export const LightShaft: React.FC<{ from: [number, number, number]; to: [number, number, number]; r0: number; r1: number; color: string; k: number; t: number }> = ({ from, to, r0, r1, color, k, t }) => {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uC: { value: new THREE.Color(color) }, uK: { value: 0 }, uT: { value: 0 } },
    vertexShader: `varying float vH; varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main(){ vH = position.y + 0.5; vec4 mv = modelViewMatrix * vec4(position,1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vW = (modelMatrix * vec4(position,1.)).xyz; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uC; uniform float uK, uT; varying float vH; varying vec3 vN; varying vec3 vV; varying vec3 vW;
      float n3(vec3 p){ return fract(sin(dot(floor(p), vec3(12.9898,78.233,37.719))) * 43758.5453); }
      float vn(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
        return mix(mix(mix(n3(i),n3(i+vec3(1,0,0)),f.x),mix(n3(i+vec3(0,1,0)),n3(i+vec3(1,1,0)),f.x),f.y),mix(mix(n3(i+vec3(0,0,1)),n3(i+vec3(1,0,1)),f.x),mix(n3(i+vec3(0,1,1)),n3(i+vec3(1,1,1)),f.x),f.y),f.z); }
      void main(){ float edge = pow(abs(dot(vN, vV)), 2.2);
        float along = smoothstep(0.0, 0.25, vH) * (0.35 + 0.65 * vH);
        float dens = 0.65 + 0.35 * vn(vW * 3.0 + vec3(0., -uT * 0.08, uT * 0.05));
        gl_FragColor = vec4(uC * edge * along * dens * uK, 1.0); }`,
  }), [color]);
  mat.uniforms.uK.value = k; mat.uniforms.uT.value = t;
  const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), len = a.distanceTo(b);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), a.clone().sub(b).normalize());
  const mid = a.clone().add(b).multiplyScalar(0.5);
  return <mesh material={mat} position={mid.toArray() as [number, number, number]} quaternion={q} scale={[1, len, 1]} renderOrder={5}><cylinderGeometry args={[r0, r1, 1, 48, 1, true]} /></mesh>;
};

/** Air motes: tiny specks hanging in the room, drifting; out of focus they become micro-bokeh. */
export const Motes: React.FC<{ t: number; o: number }> = ({ t, o }) => {
  const { geo, base } = useMemo(() => {
    const r = rng(404), n = 1400, base = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      for (let tries = 0; tries < 20; tries++) {
      // most in the spot beam above the desk, some through the room
      if (i < 900) { const h = r(), rad = (0.15 + h * 0.75) * Math.sqrt(r()), a = r() * Math.PI * 2; base.set([0.2 + (-0.2) * h + Math.cos(a) * rad, 2.9 - h * 2.1, -0.5 - 0.9 * h + Math.sin(a) * rad], i * 3); }
      else base.set([(r() - 0.5) * 6, 0.2 + r() * 2.6, (r() - 0.5) * 6], i * 3);
      const x = base[i * 3], y = base[i * 3 + 1], z = base[i * 3 + 2];
      if (!(Math.abs(x) < 0.7 && y > 0.9 && y < 2.0 && z > -1.2 && z < 2.6)) break; // not in the camera's path
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    return { geo: g, base };
  }, []);
  const mat = useMemo(() => new THREE.PointsMaterial({ size: 0.003, map: dot(), color: new THREE.Color("#dfe6f2"), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), []);
  mat.opacity = 0.4 * o;
  const pa = geo.getAttribute("position") as THREE.BufferAttribute, n = base.length / 3;
  for (let i = 0; i < n; i++) pa.setXYZ(i, base[i * 3] + Math.sin(t * 0.13 + i) * 0.04, base[i * 3 + 1] + Math.sin(t * 0.07 + i * 1.7) * 0.05 - ((t * 0.01 + i * 0.001) % 0.1), base[i * 3 + 2] + Math.cos(t * 0.11 + i * 0.3) * 0.04);
  pa.needsUpdate = true;
  return <points geometry={geo} material={mat} frustumCulled={false} />;
};

// ---------------------------------------------------------------------------------------------
// The workshop: concrete box, desk, monitor, shelves, cables, a ceiling fan. The pod stands behind the chair.
export const Workshop: React.FC<{ t: number; drop: number; concrete: THREE.Texture; bump: THREE.Texture; screen: number; alarm: number }> = ({ t, drop, concrete, bump, screen, alarm }) => {
  const wall = useMemo(() => { const m = new THREE.MeshStandardMaterial({ color: "#4a4a50", roughness: 0.95, map: concrete, bumpMap: bump, bumpScale: 0.4 }); concrete.wrapS = concrete.wrapT = THREE.RepeatWrapping; return m; }, [concrete, bump]);
  const dark = useMemo(() => new THREE.MeshStandardMaterial({ color: "#1b1c21", roughness: 0.7, metalness: 0.3 }), []);
  const metal = useMemo(() => new THREE.MeshStandardMaterial({ color: "#5a5d66", roughness: 0.35, metalness: 0.8 }), []);
  const scr = useMemo(() => new THREE.MeshStandardMaterial({ color: "#000", emissive: C.blue.clone(), roughness: 0.7 }), []);
  scr.emissive.copy(C.blue).multiplyScalar(0.03 + 0.12 * screen).lerp(C.red.clone().multiplyScalar(0.8), alarm);
  const boxes = useMemo(() => { const r = rng(5); return Array.from({ length: 34 }, () => ({ x: (r() < 0.5 ? -1 : 1) * (3.2 + r() * 0.5), y: 0.2 + Math.floor(r() * 5) * 0.55, z: -3 + r() * 6, w: 0.25 + r() * 0.5, h: 0.2 + r() * 0.3, d: 0.3 + r() * 0.3 })); }, []);
  const cables = useMemo(() => { const r = rng(9); return Array.from({ length: 7 }, () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3((r() - 0.5) * 2, 0.02, -1.4 + r() * 0.2), new THREE.Vector3((r() - 0.5) * 3, 0.01, (r() - 0.5) * 2), new THREE.Vector3((r() - 0.5) * 6, 0.02, (r() - 0.5) * 6), new THREE.Vector3((r() - 0.5) * 7, 0.25 + r() * 0.45, r() < 0.5 ? -3.95 : 3.95)]), 40, 0.012 + r() * 0.012, 6)); }, []);
  const g = 9.8, fall = drop > 0 ? 0.5 * g * drop * drop : 0;
  return (
    <group>
      {/* the floor drops away */}
      <group position={[0, -fall, 0]}>
        <WetFloor size={8} />
        {/* desk, monitor, keyboard */}
        <mesh material={dark} position={[0, 0.74, -1.55]} castShadow receiveShadow><boxGeometry args={[1.8, 0.05, 0.8]} /></mesh>
        {[-0.8, 0.8].map((x) => <mesh key={x} material={metal} position={[x, 0.37, -1.55]} castShadow><boxGeometry args={[0.05, 0.74, 0.7]} /></mesh>)}
        <mesh material={dark} position={[0, 1.12, -1.78]} castShadow><boxGeometry args={[0.95, 0.56, 0.04]} /></mesh>
        <mesh material={scr} position={[0, 1.12, -1.755]}><planeGeometry args={[0.9, 0.51]} /></mesh>
        <mesh material={metal} position={[0, 0.85, -1.78]}><boxGeometry args={[0.06, 0.2, 0.06]} /></mesh>
        <mesh material={dark} position={[0, 0.775, -1.35]} castShadow><boxGeometry args={[0.6, 0.02, 0.18]} /></mesh>
        {cables.map((c, i) => <mesh key={i} geometry={c} material={dark} castShadow />)}
        {boxes.map((b, i) => <mesh key={i} material={i % 3 ? dark : metal} position={[b.x, b.y + b.h / 2, b.z]} castShadow receiveShadow><boxGeometry args={[b.w, b.h, b.d]} /></mesh>)}
        {/* shelves */}
        {[-1, 1].map((sx) => [0.2, 0.75, 1.3, 1.85, 2.4].map((y) => <mesh key={`${sx}${y}`} material={metal} position={[sx * 3.45, y, 0]} receiveShadow><boxGeometry args={[0.7, 0.03, 6.4]} /></mesh>))}
      </group>
      {/* walls and ceiling (they fall away with the floor) */}
      <group position={[0, -fall * 0.6, 0]}>
        <mesh material={wall} position={[0, 1.5, -4]} receiveShadow><planeGeometry args={[8, 3]} /></mesh>
        <mesh material={wall} position={[-4, 1.5, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow><planeGeometry args={[8, 3]} /></mesh>
        <mesh material={wall} position={[4, 1.5, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow><planeGeometry args={[8, 3]} /></mesh>
        <mesh material={wall} position={[0, 1.5, 4]} rotation={[0, Math.PI, 0]} receiveShadow><planeGeometry args={[8, 3]} /></mesh>
        <mesh material={wall} position={[0, 3, 0]} rotation={[Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[8, 8]} /></mesh>
        {/* the ceiling fan, slow */}
        <group position={[0, 2.95, -0.4]}>
          <mesh material={metal} position={[0, -0.12, 0]}><cylinderGeometry args={[0.012, 0.012, 0.24]} /></mesh>
          <group position={[0, -0.26, 0]} rotation={[0, t * 1.1, 0]}>
            <mesh material={metal}><cylinderGeometry args={[0.07, 0.07, 0.07, 20]} /></mesh>
            {[0, 1, 2, 3].map((k) => <mesh key={k} material={dark} rotation={[0, (k * Math.PI) / 2, 0.06]} position={[Math.cos((k * Math.PI) / 2) * 0.33, 0, -Math.sin((k * Math.PI) / 2) * 0.33]} castShadow><boxGeometry args={[0.55, 0.01, 0.11]} /></mesh>)}
          </group>
        </group>
      </group>
    </group>
  );
};

// The glass pod: a capsule of glass ribs on a base, a seat, a console with the manual override.
export const Pod: React.FC<{ hum: number; lever: number; glow: number }> = ({ hum, lever, glow }) => {
  const glass = useMemo(() => new THREE.MeshPhysicalMaterial({ color: "#9fb4cc", roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.16, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false }), []);
  const rib = useMemo(() => new THREE.MeshStandardMaterial({ color: "#2a2c33", roughness: 0.3, metalness: 0.9, emissive: new THREE.Color("#000") }), []);
  const ring = useMemo(() => new THREE.MeshStandardMaterial({ color: "#000", emissive: C.amber.clone() }), []);
  const swi = useMemo(() => new THREE.MeshStandardMaterial({ color: "#000", emissive: C.red.clone() }), []);
  ring.emissive.copy(C.amber).multiplyScalar(0.2 + 1.4 * glow * (0.85 + 0.15 * Math.sin(hum * 40)));
  swi.emissive.copy(C.red).lerp(C.amber, lever).multiplyScalar(1.5);
  return (
    <group>
      <mesh material={glass} position={[0, 1.15, 0]}><capsuleGeometry args={[0.72, 0.9, 12, 32]} /></mesh>
      {[0, 1, 2, 3, 4, 5].map((k) => <mesh key={k} material={rib} position={[Math.cos((k / 6) * Math.PI * 2) * 0.73, 1.15, Math.sin((k / 6) * Math.PI * 2) * 0.73]} castShadow><boxGeometry args={[0.03, 1.6, 0.03]} /></mesh>)}
      <mesh material={rib} position={[0, 0.06, 0]} castShadow receiveShadow><cylinderGeometry args={[0.85, 0.95, 0.12, 40]} /></mesh>
      <mesh material={ring} position={[0, 0.13, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.8, 0.012, 8, 64]} /></mesh>
      <mesh material={ring} position={[0, 2.2, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.5, 0.01, 8, 64]} /></mesh>
      {/* seat + console */}
      <mesh material={rib} position={[0, 0.5, 0.25]} castShadow><boxGeometry args={[0.45, 0.08, 0.45]} /></mesh>
      <mesh material={rib} position={[0, 0.85, 0.47]} castShadow><boxGeometry args={[0.45, 0.6, 0.06]} /></mesh>
      <mesh material={rib} position={[0, 0.95, -0.42]} rotation={[-0.6, 0, 0]} castShadow><boxGeometry args={[0.6, 0.04, 0.3]} /></mesh>
      {/* the manual override: a lever in a red housing */}
      <group position={[0.18, 1.0, -0.43]} rotation={[-0.6, 0, 0]}>
        <mesh material={swi} position={[0, 0.03, 0]}><boxGeometry args={[0.08, 0.02, 0.1]} /></mesh>
        <group rotation={[-0.9 + 1.8 * lever, 0, 0]}><mesh material={rib} position={[0, 0.06, 0]}><cylinderGeometry args={[0.008, 0.008, 0.12]} /></mesh><mesh material={swi} position={[0, 0.125, 0]}><sphereGeometry args={[0.018, 12, 8]} /></mesh></group>
      </group>
    </group>
  );
};

// ---------------------------------------------------------------------------------------------
// The city: a grid of towers with lit windows (industrial red + office blue), our tower in the middle.
const windowTex = (() => {
  let tex: THREE.CanvasTexture | null = null;
  return () => {
    if (tex) return tex;
    const c = document.createElement("canvas"); c.width = 64; c.height = 256;
    const g = c.getContext("2d")!; const r = rng(41);
    g.fillStyle = "#000"; g.fillRect(0, 0, 64, 256);
    for (let y = 2; y < 256; y += 8) for (let x = 2; x < 64; x += 8) { if (r() < 0.42) { const v = 120 + r() * 135; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, y, 5, 4); } }
    tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.magFilter = THREE.NearestFilter;
    return tex;
  };
})();
export const City: React.FC<{ y0: number; o?: number }> = ({ y0, o = 1 }) => {
  const mesh = useMemo(() => {
    const r = rng(77), n = 1500;
    const mat = new THREE.MeshStandardMaterial({ color: "#0e0f14", roughness: 0.8, emissive: new THREE.Color("#ffffff"), emissiveMap: windowTex(), emissiveIntensity: 2.4 });
    const m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, n);
    const M = new THREE.Matrix4(), col = new THREE.Color();
    let k = 0;
    for (let i = 0; i < n * 3 && k < n; i++) {
      const x = (r() - 0.5) * 900, z = (r() - 0.5) * 900;
      if (Math.abs(x) < 14 && Math.abs(z) < 14) continue;
      const d = Math.hypot(x, z), h = 12 + r() * 70 * Math.exp(-d / 350) + r() * 20;
      const w = 6 + r() * 9;
      M.compose(new THREE.Vector3(x, h / 2, z), new THREE.Quaternion(), new THREE.Vector3(w, h, w * (0.7 + r() * 0.6)));
      m.setMatrixAt(k, M);
      col.copy(r() < 0.55 ? C.blue : C.red).lerp(new THREE.Color("#ffffff"), 0.35 + r() * 0.3);
      m.setColorAt(k, col);
      k++;
    }
    m.count = k;
    m.frustumCulled = false;
    return m;
  }, []);
  (mesh.material as THREE.MeshStandardMaterial).opacity = o;
  (mesh.material as THREE.MeshStandardMaterial).transparent = o < 1;
  return <primitive object={mesh} position={[0, y0, 0]} />;
};

/** The sky: city haze near the ground, indigo above, amber starlight along the horizon. alt 0..1. */
export const Sky: React.FC<{ alt: number }> = ({ alt }) => {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { uA: { value: 0 } },
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `uniform float uA; varying vec3 vP; void main(){ float e = vP.y;
      vec3 haze = mix(vec3(0.16,0.05,0.05), vec3(0.03,0.04,0.08), smoothstep(-0.1, 0.5, e));
      vec3 up = mix(vec3(0.42,0.24,0.12), vec3(0.11,0.09,0.27), smoothstep(-0.12, 0.12, e));
      up = mix(up, vec3(0.02,0.02,0.06), smoothstep(0.1, 0.9, e));
      gl_FragColor = vec4(mix(haze, up, uA), 1.0); }`,
  }), []);
  mat.uniforms.uA.value = alt;
  return <mesh material={mat} renderOrder={-1}><sphereGeometry args={[3000, 48, 24]} /></mesh>;
};

/** The Earth far below: a dark curve with a grid of city lights. */
export const Earth: React.FC<{ center: [number, number, number]; R: number; o: number }> = ({ center, R, o }) => {
  const { g, m } = useMemo(() => {
    const r = rng(12), n = 9000, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, d = Math.acos(1 - r() * 0.35);
      const x = Math.sin(d) * Math.cos(a), z = Math.sin(d) * Math.sin(a), y = Math.cos(d);
      pos.set([x * R, y * R, z * R], i * 3);
      const c = r() < 0.5 ? C.amber : C.blue; col.set([c.r, c.g, c.b], i * 3);
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({ size: 2.5, map: dot(), vertexColors: true, transparent: true, sizeAttenuation: false, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending });
    return { g: geo, m: mat };
  }, [R]);
  m.opacity = o;
  return (
    <group position={center}>
      <mesh><sphereGeometry args={[R * 0.998, 96, 48]} /><meshStandardMaterial color="#05060c" roughness={1} transparent opacity={o} /></mesh>
      <mesh><sphereGeometry args={[R * 1.02, 96, 48]} /><meshBasicMaterial color="#3a4c9a" transparent opacity={0.12 * o} side={THREE.BackSide} depthWrite={false} /></mesh>
      <points geometry={g} material={m} />
    </group>
  );
};

/** Glowing dust: N motes that start as the shattered text and swirl into a constellation. */
export const Dust: React.FC<{ from: Float32Array; to: Float32Array; k: number; spin: number; o: number; center: [number, number, number] }> = ({ from, to, k, spin, o, center }) => {
  const geo = useMemo(() => { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(from.length), 3)); return g; }, [from]);
  const mat = useMemo(() => new THREE.PointsMaterial({ size: 0.03, map: dot(), color: C.amber.clone().multiplyScalar(1.6), transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }), []);
  mat.opacity = o;
  const pa = geo.getAttribute("position") as THREE.BufferAttribute;
  const n = from.length / 3;
  for (let i = 0; i < n; i++) {
    const ki = Math.min(1, Math.max(0, k * 1.3 - (i % 97) / 97 * 0.3));
    const e = ki < 0.5 ? 4 * ki * ki * ki : 1 - Math.pow(-2 * ki + 2, 3) / 2;
    let x = from[i * 3] + (to[i * 3] - from[i * 3]) * e, y = from[i * 3 + 1] + (to[i * 3 + 1] - from[i * 3 + 1]) * e, z = from[i * 3 + 2] + (to[i * 3 + 2] - from[i * 3 + 2]) * e;
    // a swirl on the way
    const sw = Math.sin(ki * Math.PI) * (1.5 + (i % 7) * 0.2), a = spin * (0.4 + (i % 13) / 13) + i;
    x += Math.cos(a) * sw; z += Math.sin(a) * sw; y += Math.sin(a * 0.7) * sw * 0.4;
    pa.setXYZ(i, x, y, z);
  }
  pa.needsUpdate = true;
  return <points geometry={geo} material={mat} position={center} frustumCulled={false} />;
};

export const cap = (font: Font, s: number) => capHeight(font, s);
/** A soft round point sprite. */
const dot = (() => { let tx: THREE.CanvasTexture | null = null; return () => { if (tx) return tx; const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d")!; const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.35, "rgba(255,255,255,0.6)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); tx = new THREE.CanvasTexture(c); return tx; }; })();
export type { Beh };
