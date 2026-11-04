import React, { useMemo } from "react";
import * as THREE from "three";
import { Font } from "three/examples/jsm/loaders/FontLoader.js";
import { capHeight, glyphGeo, layout } from "../words/glyphs";
import { rng } from "../utils/random";
import { Beh, LX, W, clean, heat, letterXf, sylStarts } from "./core";

/** Palette for Drift v2: industrial red + cold office blue in the city; indigo, charcoal and amber starlight above. */
export const C = {
  red: new THREE.Color("#d2382b"), blue: new THREE.Color("#5f8fd8"), coldWhite: new THREE.Color("#dfe7f2"),
  amber: new THREE.Color("#ffb066"), indigo: new THREE.Color("#1d1a4a"), char: new THREE.Color("#0b0b0e"), bone: new THREE.Color("#ece2d0"),
};

// ---------------------------------------------------------------------------------------------
// Words as solid objects
export type WStyle = "city" | "drift" | "serif" | "steel";
const matCache = new Map<string, THREE.MeshStandardMaterial>();
/** A letter's material: body + an emission that is hot while the word is sung, cooling after. */
export const letterMat = (style: WStyle, h: number, o: number) => {
  const hq = Math.round(h * 10), oq = Math.round(o * 12);
  const key = `${style}|${hq}|${oq}`;
  let m = matCache.get(key);
  if (!m) {
    const k = hq / 10;
    if (style === "city") m = new THREE.MeshStandardMaterial({ color: "#9e9890", roughness: 0.55, metalness: 0.25, emissive: C.blue.clone().multiplyScalar(0.05).lerp(C.red.clone().multiplyScalar(0.6), k) });
    else if (style === "steel") m = new THREE.MeshStandardMaterial({ color: "#b9b2a8", roughness: 0.32, metalness: 0.8, emissive: C.amber.clone().multiplyScalar(0.9 * k) });
    else if (style === "serif") m = new THREE.MeshStandardMaterial({ color: "#f0e6d6", roughness: 0.6, metalness: 0.05, emissive: C.bone.clone().multiplyScalar(0.2 + 0.6 * k) });
    else m = new THREE.MeshStandardMaterial({ color: "#f6e8d4", roughness: 0.5, metalness: 0.05, emissive: C.amber.clone().multiplyScalar(0.25 + 1.1 * k) });
    m.transparent = oq < 12; m.opacity = oq / 12; m.depthWrite = oq > 8;
    matCache.set(key, m);
  }
  return m;
};
export const fontFor = (a: { inter: Font; mono: Font; serif: Font; bebas: Font }, style: WStyle) => (style === "city" ? a.inter : style === "serif" ? a.serif : style === "steel" ? a.bebas : a.mono);

/**
 * One sung word as a row of extruded letters, revealed by syllable and moved by its behaviour.
 * Placed at `pos` with rotation `rot` (word centred on 0). Depth gives it mass; long shadows from the lights.
 */
export const Word3D: React.FC<{ font: Font; li: number; wi: number; t: number; size: number; style: WStyle; beh?: Beh; pos?: [number, number, number]; rot?: [number, number, number]; depth?: number; kickT?: number; fade?: number; text?: string }> = ({ font, li, wi, t, size, style, beh = "pop", pos = [0, 0, 0], rot = [0, 0, 0], depth = 0.22, kickT, fade = 1, text }) => {
  const w = W(li, wi);
  const word = text ?? clean(w.w);
  if (t < w.s - 0.08) return null;
  const lay = layout(font, word, size, 0.04);
  const starts = sylStarts(li, wi);
  const n = word.length;
  const h = heat(t, w);
  return (
    <group position={pos} rotation={rot}>
      {lay.letters.map((L, i) => {
        if (L.ch === " ") return null;
        const x: LX = letterXf(beh, t, w, i, n, L.x / size, starts[i] ?? w.s, li * 31 + wi, kickT);
        const o = x.o * fade;
        if (o <= 0.01) return null;
        return (
          <mesh key={i} geometry={glyphGeo(font, L.ch, size, size * depth, `v4${style}`, 0.012)} material={letterMat(style, h, o)}
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
// A pop-up window: dark glass slab, a coloured title bar, a close box. The lyric lives inside it.
export const Popup: React.FC<{ w: number; h: number; tone: "red" | "blue"; title: string; font: Font; flash?: number; o?: number; children?: React.ReactNode }> = ({ w, h, tone, title, font, flash = 0, o = 1, children }) => {
  const col = tone === "red" ? C.red : C.blue;
  const bar = useMemo(() => new THREE.MeshStandardMaterial({ color: col, emissive: col.clone().multiplyScalar(0.9), roughness: 0.5, transparent: true }), [tone]);
  const body = useMemo(() => new THREE.MeshStandardMaterial({ color: "#0d0e12", roughness: 0.25, metalness: 0.4, transparent: true, emissive: new THREE.Color("#000") }), []);
  const edge = useMemo(() => new THREE.MeshStandardMaterial({ color: col, emissive: col.clone().multiplyScalar(1.4), transparent: true }), [tone]);
  bar.opacity = o; body.opacity = 0.9 * o; edge.opacity = o;
  bar.emissive.copy(col).multiplyScalar(0.9 + 1.6 * flash);
  body.emissive.copy(col).multiplyScalar(0.12 * flash);
  const tb = Math.min(0.09, h * 0.18);
  const tl = layout(font, title, tb * 0.45, 0.2);
  return (
    <group>
      <mesh material={body} position={[0, 0, -0.03]} castShadow receiveShadow><boxGeometry args={[w, h, 0.04]} /></mesh>
      <mesh material={bar} position={[0, h / 2 - tb / 2, 0]}><boxGeometry args={[w, tb, 0.05]} /></mesh>
      {[[-w / 2, 0, 0.004, h], [w / 2, 0, 0.004, h], [0, -h / 2, w, 0.004]].map(([x, y, ww, hh], i) => <mesh key={i} material={edge} position={[x, y, 0]}><boxGeometry args={[ww || 0.004, hh || 0.004, 0.05]} /></mesh>)}
      <group position={[-w / 2 + 0.04 + tl.width / 2, h / 2 - tb / 2, 0.03]}>
        {tl.letters.map((L, i) => (L.ch === " " ? null : <mesh key={i} geometry={glyphGeo(font, L.ch, tb * 0.45, 0.004, "v4ui", 0)} material={edge} position={[L.x, 0, 0]} />))}
      </group>
      <mesh material={edge} position={[w / 2 - tb * 0.6, h / 2 - tb / 2, 0.03]} rotation={[0, 0, Math.PI / 4]}><boxGeometry args={[tb * 0.5, tb * 0.08, 0.01]} /></mesh>
      <mesh material={edge} position={[w / 2 - tb * 0.6, h / 2 - tb / 2, 0.03]} rotation={[0, 0, -Math.PI / 4]}><boxGeometry args={[tb * 0.5, tb * 0.08, 0.01]} /></mesh>
      {children}
    </group>
  );
};

// ---------------------------------------------------------------------------------------------
// The workshop: concrete box, desk, monitor, shelves, cables, a ceiling fan. The pod stands behind the chair.
export const Workshop: React.FC<{ t: number; drop: number; concrete: THREE.Texture; bump: THREE.Texture; screen: number; alarm: number }> = ({ t, drop, concrete, bump, screen, alarm }) => {
  const wall = useMemo(() => { const m = new THREE.MeshStandardMaterial({ color: "#4a4a50", roughness: 0.95, map: concrete, bumpMap: bump, bumpScale: 0.4 }); concrete.wrapS = concrete.wrapT = THREE.RepeatWrapping; return m; }, [concrete, bump]);
  const dark = useMemo(() => new THREE.MeshStandardMaterial({ color: "#1b1c21", roughness: 0.7, metalness: 0.3 }), []);
  const metal = useMemo(() => new THREE.MeshStandardMaterial({ color: "#5a5d66", roughness: 0.35, metalness: 0.8 }), []);
  const scr = useMemo(() => new THREE.MeshStandardMaterial({ color: "#000", emissive: C.blue.clone(), roughness: 0.2 }), []);
  scr.emissive.copy(C.blue).multiplyScalar(0.15 + 0.5 * screen).lerp(C.red.clone().multiplyScalar(0.8), alarm);
  const boxes = useMemo(() => { const r = rng(5); return Array.from({ length: 34 }, () => ({ x: (r() < 0.5 ? -1 : 1) * (3.2 + r() * 0.5), y: 0.2 + Math.floor(r() * 5) * 0.55, z: -3 + r() * 6, w: 0.25 + r() * 0.5, h: 0.2 + r() * 0.3, d: 0.3 + r() * 0.3 })); }, []);
  const cables = useMemo(() => { const r = rng(9); return Array.from({ length: 7 }, () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3((r() - 0.5) * 2, 0.02, -1.4 + r() * 0.2), new THREE.Vector3((r() - 0.5) * 3, 0.01, (r() - 0.5) * 2), new THREE.Vector3((r() - 0.5) * 6, 0.02, (r() - 0.5) * 6), new THREE.Vector3((r() - 0.5) * 7, 0.6 + r() * 2, r() < 0.5 ? -3.95 : 3.95)]), 40, 0.012 + r() * 0.012, 6)); }, []);
  const g = 9.8, fall = drop > 0 ? 0.5 * g * drop * drop : 0;
  return (
    <group>
      {/* the floor drops away */}
      <group position={[0, -fall, 0]}>
        <mesh material={dark} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[8, 8]} /></mesh>
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
