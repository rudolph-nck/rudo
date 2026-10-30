import React, { useMemo } from "react";
import * as THREE from "three";
import { Font } from "three/examples/jsm/loaders/FontLoader.js";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { capHeight, layout } from "./glyphs";
import { lightMat } from "../three/materials";
import { Glow } from "./points";
import { rng } from "../utils/random";
import { W, H } from "../theme";

/**
 * Words written in light: each glyph's outline as fat lines, laid down by the hot point in
 * reading order (letter by letter, contour by contour). draw 0..1 is the fraction of the total
 * outline length written; heat 1 = white-hot, 0 = cooled to a dim stone-coloured line.
 */
type Stroke = { pts: THREE.Vector3[]; len: number; line: Line2 };
export type Written = { letters: { strokes: Stroke[]; len: number; x: number }[]; total: number; width: number; cap: number };

const HOT = new THREE.Color(1.0, 0.95, 0.88).multiplyScalar(3.2);
const COOL = new THREE.Color("#c4b6a2").multiplyScalar(0.5);

const cache = new Map<string, Written>();
export const writeWord = (font: Font, text: string, size: number, tracking = 0.04, key = "") => {
  const k = `${key}|${text}|${size}|${tracking}`;
  let w = cache.get(k);
  if (w) return w;
  const { letters, width } = layout(font, text, size, tracking);
  const cap = capHeight(font, size);
  let total = 0;
  const out = letters.map((L) => {
    if (L.ch === " ") return { strokes: [], len: 0, x: L.x };
    const shapes = font.generateShapes(L.ch, size);
    const contours = shapes.flatMap((s) => [s, ...s.holes]);
    const strokes = contours.map((c) => {
      const raw = c.getPoints(24);
      let len = 0;
      for (let i = 1; i < raw.length; i++) len += raw[i].distanceTo(raw[i - 1]);
      const n = Math.max(8, Math.ceil(len / (size * 0.045)));
      const sp = (c as THREE.Path).getSpacedPoints(n);
      // letter-local: centred on the letter's advance box, so each letter can turn about itself
      const pts = sp.map((p) => new THREE.Vector3(p.x - L.adv / 2, p.y - cap / 2, 0));
      if (pts.length && pts[0].distanceTo(pts[pts.length - 1]) > 1e-4) pts.push(pts[0].clone());
      const g = new LineGeometry();
      g.setPositions(pts.flatMap((p) => [p.x, p.y, p.z]));
      const line = new Line2(g, undefined as unknown as LineMaterial);
      g.computeBoundingSphere();
      return { pts, len, line };
    });
    const len = strokes.reduce((a, s) => a + s.len, 0);
    total += len;
    return { strokes, len, x: L.x };
  });
  w = { letters: out, total, width, cap };
  cache.set(k, w);
  return w;
};

/** Where the writing head is (local coordinates) at draw progress d. */
export const headOf = (w: Written, d: number) => {
  let rem = Math.max(0, Math.min(1, d)) * w.total;
  for (const L of w.letters)
    for (const s of L.strokes) {
      if (rem <= s.len) {
        const i = Math.min(s.pts.length - 1, Math.floor((rem / s.len) * (s.pts.length - 1)));
        return s.pts[i].clone().add(new THREE.Vector3(L.x, 0, 0));
      }
      rem -= s.len;
    }
  const last = w.letters.filter((l) => l.strokes.length).slice(-1)[0];
  return last ? last.strokes.slice(-1)[0].pts.slice(-1)[0].clone().add(new THREE.Vector3(last.x, 0, 0)) : new THREE.Vector3();
};

export type LetterXF = { p?: [number, number, number]; r?: [number, number, number]; s?: number; o?: number };

export const LightWord: React.FC<{
  w: Written; draw: number; heat: number; o?: number; width?: number;
  position?: [number, number, number]; rotation?: [number, number, number]; scale?: number;
  xf?: (i: number) => LetterXF;
}> = ({ w, draw, heat, o = 1, width = 3, position, rotation, scale, xf }) => {
  const mats = useMemo(() => w.letters.map(() => new LineMaterial({ linewidth: width, worldUnits: false, transparent: true, toneMapped: false, depthWrite: false })), [w, width]);
  let rem = Math.max(0, Math.min(1, draw)) * w.total;
  const col = new THREE.Color().copy(COOL).lerp(HOT, Math.max(0, Math.min(1, heat)));
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {w.letters.map((L, li) => {
        if (!L.strokes.length) return null;
        const x = xf?.(li) ?? {};
        const m = mats[li];
        m.color.copy(col);
        m.opacity = o * (x.o ?? 1);
        m.resolution.set(W, H);
        m.linewidth = width;
        const strokes = L.strokes.map((s, si) => {
          const segs = s.pts.length - 1;
          const vis = rem >= s.len ? segs : Math.max(0, Math.floor((rem / s.len) * segs));
          rem = Math.max(0, rem - s.len);
          if (vis <= 0) return null;
          s.line.material = m;
          (s.line.geometry as LineGeometry).instanceCount = vis;
          return <primitive key={si} object={s.line} />;
        });
        return (
          <group key={li} position={[L.x + (x.p?.[0] ?? 0), x.p?.[1] ?? 0, x.p?.[2] ?? 0]} rotation={x.r} scale={x.s ?? 1}>
            {strokes}
          </group>
        );
      })}
    </group>
  );
};

/** The hot point in 3D: a white-hot bead that actually lights the room, plus sparks thrown off. */
export const HotPoint3D: React.FC<{ p: THREE.Vector3; t: number; o?: number; light?: number; sparks?: boolean }> = ({ p, t, o = 1, light = 1.6, sparks = true }) => {
  const bead = useMemo(() => lightMat("#fff4e6", 7), []);
  const sp = useMemo(() => {
    const n = 60, r = rng(5);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute("seed", new THREE.BufferAttribute(new Float32Array(n).map(() => r()), 1));
    g.setAttribute("bright", new THREE.BufferAttribute(new Float32Array(n).map(() => 0.4 + r()), 1));
    return g;
  }, []);
  const pos = sp.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const life = (t * 2.3 + i / pos.count) % 1, a = (i * 2.399) % (Math.PI * 2), v = 0.15 + ((i * 0.618) % 1) * 0.35;
    pos.setXYZ(i, p.x + Math.cos(a) * v * life, p.y + Math.sin(a) * v * life * 0.6 - life * life * 0.35, p.z + 0.02 + life * 0.15 * ((i * 0.37) % 1));
  }
  pos.needsUpdate = true;
  return (
    <>
      <mesh position={p} material={bead} scale={Math.max(0.001, o)} visible={o > 0.01}><sphereGeometry args={[0.012, 12, 12]} /></mesh>
      <pointLight position={[p.x, p.y, p.z + 0.06]} intensity={light * o} distance={4} decay={2} color="#ffdcb4" />
      {sparks ? <Glow geo={sp} size={1.3} gain={0.8 * Math.max(0, o)} time={t} twinkle={0.6} /> : null}
    </>
  );
};
