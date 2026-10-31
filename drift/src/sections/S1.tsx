import React, { useMemo } from "react";
import * as THREE from "three";
import { AbsoluteFill, Audio, staticFile } from "remotion";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { loadTex, useAssets } from "../three/assets";
import { Stage } from "../three/Stage";
import { LINES, T, vol } from "../data";
import { clamp01, cubicIn, cubicInOut, cubicOut, mix } from "../utils/ease";
import { noise1, rng } from "../utils/random";
import { capHeight, layout, wordPoints } from "../words/glyphs";
import { Glow, useStarfield } from "../words/points";
import { Finish, Full, Letters } from "../frames/kit";
import { shelfFrame, useShelfKit } from "../frames/SFShelf";
import { F } from "../utils/fonts";
import { W, H } from "../theme";
import { continueRender, delayRender } from "remotion";

/**
 * Section 1 (0:00–0:36.3). POV: you're the person.
 *  Night  — sitting on a rooftop edge, looking up; the lyrics appear among the stars in clean flat
 *           type. On STOP the camera pulls out of your eyes: a black silhouette on the building
 *           edge, city far below, every line so far up in the sky.
 *  Dawn   — MORNING warms the sky from below; the stars go.
 *  Ceiling— a blink, and it's the same bedroom ceiling; morning light through blinds. Words hang
 *           under the ceiling and cast shadows on it; past lines fall toward you (gravity).
 *  Up     — at 0:32 you sit up and face the wall: the shelf, WEIGHT through the floor, and MINE,
 *           small, in the rubble.
 * Type is always crisp and flat: no bevel, no texture, no glow.
 */
export const S1_END = 36.6;
const L = (li: number) => LINES[li].words;
const INK = "#f1eee8";
const STONE = "#c9bca9";
const SHELF_K = 12;

// ---- world anchors ----
const O = new THREE.Vector3(0, 0.25, 0.25); // your eyes on the rooftop
const D = 7; // sky words distance
const YAW = [0.0, -0.46, 0.42, -0.44, 0.4, -0.38, 0.02];
const PITCH = [0.82, 1.0, 1.04, 0.62, 0.6, 0.34, 0.24];
const skyDir = (k: number) => new THREE.Vector3(Math.cos(PITCH[k]) * Math.sin(YAW[k]), Math.sin(PITCH[k]), -Math.cos(PITCH[k]) * Math.cos(YAW[k]));
const FLOOR_Y = 100; // the bedroom
const CY = 102.6; // ceiling height
const LIE = new THREE.Vector3(0, 100.6, 0.0); // lying on the bed, looking up
const SH = new THREE.Vector3(0, FLOOR_Y, -2.0); // shelf wall origin

// ---------------------------------------------------------------------------------------------
const mkLine = (n: number, width: number, color = "#f1eee8") => {
  const g = new LineGeometry();
  g.setPositions(new Array(n * 3).fill(0));
  const m = new LineMaterial({ linewidth: width, worldUnits: false, transparent: true });
  m.resolution.set(W, H);
  m.color = new THREE.Color(color);
  const l = new Line2(g, m);
  l.frustumCulled = false;
  return { g, m, l };
};
const String3: React.FC<{ a: THREE.Vector3; b: THREE.Vector3; sag: number; draw: number; o?: number }> = ({ a, b, sag, draw, o = 1 }) => {
  const obj = useMemo(() => mkLine(25, 1.6), []);
  if (draw <= 0) return null;
  const end = a.clone().lerp(b, clamp01(draw));
  const pts: number[] = [];
  for (let i = 0; i <= 24; i++) {
    const u = i / 24;
    const p = a.clone().lerp(end, u);
    p.z += Math.sin(u * Math.PI) * sag; // slack hangs toward the viewer (down)
    pts.push(p.x, p.y, p.z);
  }
  obj.g.setPositions(pts);
  obj.m.opacity = o;
  return <primitive object={obj.l} />;
};
const NoSign: React.FC<{ r: number; draw: number; slash: number; o: number }> = ({ r, draw, slash, o }) => {
  const circ = useMemo(() => Array.from({ length: 97 }, (_, i) => { const q = Math.PI * 0.75 - (i / 96) * Math.PI * 2; return new THREE.Vector3(Math.cos(q), Math.sin(q), 0); }), []);
  const obj = useMemo(() => {
    const ring = mkLine(97, 2.6);
    ring.g.setPositions(circ.flatMap((p) => [p.x * r, p.y * r, 0.01]));
    return { ring, slash: mkLine(2, 2.6) };
  }, [circ, r]);
  obj.ring.g.instanceCount = Math.max(1, Math.round(96 * draw));
  const s0 = new THREE.Vector3(-r * 0.707, r * 0.707, 0.01), s1 = new THREE.Vector3(r * 0.707, -r * 0.707, 0.01);
  const se = s0.clone().lerp(s1, slash);
  obj.slash.g.setPositions([s0.x, s0.y, s0.z, se.x, se.y, se.z]);
  obj.ring.m.opacity = o; obj.slash.m.opacity = o;
  if (draw <= 0) return null;
  return (<>{<primitive object={obj.ring.l} />}{slash > 0 ? <primitive object={obj.slash.l} /> : null}</>);
};

/** A big, quiet clock in the sky behind FOR A MINUTE: thin crisp lines, a ticking second hand. */
const SkyClock: React.FC<{ r: number; sec: number; o: number }> = ({ r, sec, o }) => {
  const obj = useMemo(() => {
    const ring = mkLine(121, 1.6, "#d8d1c6");
    ring.g.setPositions(Array.from({ length: 121 }, (_, i) => { const q = (i / 120) * Math.PI * 2; return [Math.cos(q) * r, Math.sin(q) * r, 0]; }).flat());
    const ticks = Array.from({ length: 60 }, (_, i) => {
      const l = mkLine(2, i % 5 === 0 ? 1.8 : 1.0, "#d8d1c6"), q = (i / 60) * Math.PI * 2, k = i % 5 === 0 ? 0.86 : 0.93;
      l.g.setPositions([Math.sin(q) * r * k, Math.cos(q) * r * k, 0, Math.sin(q) * r * 0.98, Math.cos(q) * r * 0.98, 0]);
      return l;
    });
    const sHand = mkLine(2, 1.4, "#efe9df"), mHand = mkLine(2, 2.2, "#d8d1c6");
    mHand.g.setPositions([0, 0, 0, 0, r * 0.62, 0]);
    return { ring, ticks, sHand, mHand };
  }, [r]);
  const q = -(Math.floor(sec) + Math.min(1, (sec % 1) * 8)) * (Math.PI / 30); // ticks, with a quick settle
  obj.sHand.g.setPositions([-Math.sin(q) * r * -0.12, -Math.cos(q) * r * 0.12, 0, Math.sin(-q) * r * 0.9, Math.cos(q) * r * 0.9, 0]);
  [obj.ring, obj.sHand, obj.mHand, ...obj.ticks].forEach((l) => (l.m.opacity = o));
  if (o <= 0.01) return null;
  return (
    <>
      <primitive object={obj.ring.l} />
      {obj.ticks.map((l, i) => <primitive key={i} object={l.l} />)}
      <primitive object={obj.mHand.l} />
      <primitive object={obj.sHand.l} />
    </>
  );
};

/** A word made of small tiles, so pieces of it can be pulled away. */
const useTiles = (a: ReturnType<typeof useAssets>, text: string, size: number, n: number, seed: number) =>
  useMemo(() => {
    if (!a) return null;
    const p = wordPoints(a.bebas, text, size, n, 0.2, seed, 0.03);
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: "#2a2724", roughness: 0.8 }), p.seeds.length);
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    return { mesh, pos: p.pos, seeds: p.seeds, n: p.seeds.length, tile: size * 0.036 };
  }, [a, text, size, n, seed]);
type Hook = { at: number; dir: THREE.Vector2; local: THREE.Vector2 };
const pullTiles = (tl: NonNullable<ReturnType<typeof useTiles>>, hooks: Hook[], yank: (h: Hook) => number, origin: THREE.Vector3) => {
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i < tl.n; i++) {
    const x = tl.pos[i * 3], y = tl.pos[i * 3 + 1];
    let dx = 0, dy = 0, dz = 0, spin = 0;
    for (const h of hooks) {
      const y0 = yank(h);
      if (y0 <= 0) continue;
      const w = Math.exp(-Math.hypot(x - h.local.x, y - h.local.y) / 0.16);
      const tear = w > 0.55 ? 1 : w;
      dx += h.dir.x * y0 * tear; dy += h.dir.y * y0 * tear; dz += y0 * tear * 0.2 * tl.seeds[i];
      spin += tear * y0 * 4;
    }
    q.setFromEuler(new THREE.Euler(spin * (tl.seeds[i] - 0.5), spin * 0.5, spin * (0.5 - tl.seeds[i])));
    s.setScalar(tl.tile).setZ(tl.tile * 0.6);
    v.set(origin.x + x + dx, origin.y + y + dy, origin.z + dz);
    m.compose(v, q, s);
    tl.mesh.setMatrixAt(i, m);
  }
  tl.mesh.instanceMatrix.needsUpdate = true;
};

const useCutout = () => {
  const [st] = React.useState(() => ({ tex: null as THREE.Texture | null, h: delayRender("cutout") }));
  const [tex, setTex] = React.useState<THREE.Texture | null>(null);
  React.useEffect(() => { loadTex("images/rudo-cutout.png").then((t) => { setTex(t); continueRender(st.h); }); }, [st]);
  return tex;
};

/** Sky: night, warming from the horizon at dawn. */
const Sky: React.FC<{ dawn: number }> = ({ dawn }) => {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { uD: { value: 0 } },
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `uniform float uD; varying vec3 vP; void main(){ float e = vP.y;
      vec3 night = mix(vec3(0.022,0.024,0.03), vec3(0.008,0.009,0.012), smoothstep(-0.05, 0.6, e));
      vec3 dawnLow = vec3(0.5,0.36,0.24), dawnMid = vec3(0.1,0.085,0.08), dawnTop = vec3(0.025,0.027,0.032);
      vec3 dawnC = mix(dawnLow, dawnMid, smoothstep(-0.05, 0.35, e)); dawnC = mix(dawnC, dawnTop, smoothstep(0.3, 0.95, e));
      gl_FragColor = vec4(mix(night, dawnC, uD), 1.0); }`,
  }), []);
  mat.uniforms.uD.value = dawn;
  return <mesh material={mat}><sphereGeometry args={[300, 48, 24]} /></mesh>;
};

// ---------------------------------------------------------------------------------------------
export const S1: React.FC<{ t: number }> = ({ t }) => {
  const a = useAssets();
  const kit = useShelfKit(a);
  const cut = useCutout();
  const matCache = useMemo(() => new Map<string, THREE.Material>(), []);
  const stars = useStarfield(9000, 81, [400, 260, 400], [0, 120, -60]);
  const city = useMemo(() => {
    const r = rng(83), n = 2600;
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const z = -14 - Math.pow(r(), 0.7) * 140; pos[i * 3] = (r() - 0.5) * (30 + -z * 1.4); pos[i * 3 + 1] = -4 - r() * 1.0; pos[i * 3 + 2] = z; }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("seed", new THREE.BufferAttribute(new Float32Array(n).map(() => r()), 1));
    g.setAttribute("bright", new THREE.BufferAttribute(new Float32Array(n).map(() => 0.15 + Math.pow(r(), 3) * 1.2), 1));
    return g;
  }, []);
  const me = useTiles(a, "ME", 0.62, 3600, 71);
  const time = useTiles(a, "TIME", 0.24, 2400, 72);
  const sil = useMemo(() => (cut ? new THREE.MeshBasicMaterial({ map: cut, color: "#000000", transparent: true, alphaTest: 0.5 }) : null), [cut]);
  const blinds = useMemo(() => Array.from({ length: 9 }, (_, i) => i), []);
  const voidDust = useMemo(() => {
    const r = rng(91), n = 900;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3).map((_, i) => (i % 3 === 1 ? -0.4 - r() * 14 : (r() - 0.5) * 2.4)), 3));
    g.setAttribute("seed", new THREE.BufferAttribute(new Float32Array(n).map(() => r()), 1));
    g.setAttribute("bright", new THREE.BufferAttribute(new Float32Array(n).map(() => 0.05 + Math.pow(r(), 4) * 0.5), 1));
    return g;
  }, []);
  if (!a || !kit || !me || !time || !sil) return <Full>{null}</Full>;

  // flat materials: sky words are unlit (crisp, even), room words are lit matte
  const flat = (key: string, color: string, o: number, lit = false) => {
    let m = matCache.get(key) as THREE.MeshBasicMaterial | THREE.MeshStandardMaterial | undefined;
    if (!m) { m = lit ? new THREE.MeshStandardMaterial({ color, roughness: 0.85 }) : new THREE.MeshBasicMaterial({ color }); m.transparent = true; matCache.set(key, m); }
    m.opacity = o; m.depthWrite = o > 0.6;
    return m;
  };
  const cap = (s: number) => capHeight(a.bebas, s);
  type Row = { li: number; wi: number; text: string; size: number; x: number; y: number; hero: boolean; color: string };
  const rows: Row[] = [];
  const row = (li: number, wis: number[], y: number, size: number, hero = false, maxW = 2.2, color0 = INK) => {
    const inSky = li < 6 || (li === 6 && wis[0] <= 1);
    const color = !inSky ? (color0 === STONE ? "#6f604e" : "#262421") : color0;
    const texts = wis.map((wi) => L(li)[wi].w.toUpperCase().replace(/[.,]/g, ""));
    const s0 = Math.min(size, size * (maxW / layout(a.bebas, texts.join(" "), size, 0.04).width));
    const lay = layout(a.bebas, texts.join(" "), s0, 0.04);
    let ci = 0;
    texts.forEach((tx, k) => {
      const f = lay.letters[ci], l = lay.letters[ci + tx.length - 1];
      rows.push({ li, wi: wis[k], text: tx, size: s0, x: (f.x - f.adv / 2 + l.x + l.adv / 2) / 2, y, hero, color });
      ci += tx.length + 1;
    });
  };
  // night (sky) — sizes for D = 7 m
  row(0, [0], 0, 0.5);
  row(1, [0, 1, 2, 3], 0.55, 0.3); row(1, [4], -0.2, 0.95, true, 2.0, STONE);
  row(2, [0, 1, 2, 3], 0.6, 0.3); row(2, [4], -0.2, 0.85, true);
  row(3, [0, 1, 2, 3], 0.6, 0.3); row(3, [4], -0.2, 0.75, true, 2.2);
  row(4, [0, 1, 2], 0.95, 0.26); row(4, [3], 0.48, 0.55, true); row(4, [4], 0.05, 0.22); row(4, [5], -0.55, 1.05, true, 2.0, STONE);
  row(5, [0, 1], 0.42, 0.3); row(5, [2], -0.15, 0.7, true);
  // ceiling — sizes for 2 m away
  row(6, [0], 0.45, 0.3); row(6, [1], -0.2, 0.95, true, 2.0, STONE); row(6, [2], 0.1, 0.07); row(6, [3], -0.06, 0.15, true);
  row(7, [0], 0.3, 0.06); row(7, [1], 0.15, 0.17, true, 0.62, STONE); row(7, [2, 3], -0.03, 0.06); row(7, [4], -0.16, 0.12, true);
  row(8, [0, 1, 2], 0.26, 0.06); row(8, [3, 4], 0.15, 0.06); row(8, [5], 0.0, 0.16, true, 0.6, STONE);
  row(9, [0, 1], 0.3, 0.06); row(9, [2], 0.16, 0.13, true, 0.62); row(9, [3], 0.03, 0.05); row(9, [4], -0.12, 0.15, true, 0.6, STONE);
  row(10, [0], 0.36, 0.1); row(10, [1, 2, 3, 4], 0.25, 0.055);
  row(11, [0, 1, 2], -0.26, 0.05);

  // ---------- timeline ----------
  const stopT = L(4)[5].s;
  const zoom = cubicInOut(clamp01((t - (stopT + 0.1)) / 0.45)) * (1 - cubicInOut(clamp01((t - (L(5)[0].s - 0.4)) / 0.4)));
  const mW = L(6)[1];
  const dawn = cubicInOut(clamp01((t - (L(6)[0].s - 0.2)) / 2.0));
  const blinkC = L(6)[3].s - 0.12; // the blink that turns sky into ceiling
  const inRoom = t >= blinkC;
  const lineNow = (() => { let k = 0; for (let li = 0; li <= 11; li++) if (t >= L(li)[0].s - 0.05) k = li; return k; })();
  const shelfT = L(SHELF_K)[0].s;

  // ---------- words ----------
  const sky: React.ReactNode[] = [];
  const room: React.ReactNode[] = [];
  rows.forEach((r) => {
    const w = L(r.li)[r.wi];
    const appear = cubicOut(clamp01((t - (w.s - 0.05)) / 0.3));
    if (appear <= 0) return;
    const key = `${r.li}-${r.wi}`;
    let o = appear;
    let p: [number, number, number] = [r.x, r.y + (1 - appear) * (r.li < 6 ? 0.08 : 0.02), 0];
    let rot: [number, number, number] = [0, 0, 0];
    let scl: [number, number, number] = [1, 1, 1];
    let xf: ((i: number, x: number) => { p: [number, number, number]; r?: [number, number, number] }) | undefined;
    const n = r.text.length;
    if (r.li < 6 || (r.li === 6 && r.wi <= 1)) {
      // ----- night sky -----
      const past = lineNow > r.li && r.li < 5;
      if (past) o *= mix(0.3, 0.9, zoom);
      if (r.li === 0) o = appear * (t < w.e ? 0.6 : Math.max(0, 1 - (t - w.e) / 1.0)) * (zoom > 0 ? 0 : 1);
      let dist = D;
      if (r.li === 1 && r.hero) { // TIRED sinks away into the sky, falling asleep
        const u = cubicInOut(clamp01((t - (w.s + 0.25)) / 2.6));
        dist = D + u * 9; o *= 1 - u * 0.7; rot = [0, 0, u * 0.18];
        xf = (i, x) => ({ p: [x * (1 + u * 0.15), Math.sin(i * 1.7) * u * 0.08, 0], r: [0, 0, (i - (n - 1) / 2) * u * 0.05] });
      }
      if (r.li === 3 && r.hero) { // DISAPPEAR: the whole word drifts away into the abyss
        const u = cubicIn(clamp01((t - (w.s + 0.3)) / Math.max(1.4, L(4)[0].s - w.s - 0.35)));
        dist = D + u * 16; o *= 1 - u; rot = [0, 0, u * 0.12];
      }
      if (r.li === 4 && r.wi === 5) { const u = clamp01((t - stopT) / 0.07); o = u * (lineNow > 4 ? mix(0.3, 0.9, zoom) : 1); scl = [1, mix(1.2, 1, u), 1]; }
      const dir = skyDir(r.li), C = O.clone().addScaledVector(dir, dist);
      sky.push(
        <group key={key} position={C.toArray() as [number, number, number]} ref={(g) => { if (g) g.lookAt(O); }}>
          <group position={p} rotation={rot} scale={scl}>
            <Letters font={a.bebas} family="bebas" text={r.text} size={r.size} depth={0.001} material={flat(key, r.color, o)} tracking={0.04} bevel={0} shadows={false} xf={xf} />
          </group>
        </group>,
      );
      return;
    }
    // ----- ceiling (local: x right, y toward your head, z toward you) -----
    if (!inRoom) return;
    const st = r.li === 11 ? 10 : r.li;
    const nextStart = st + 1 <= 10 ? L(st + 1)[0].s : shelfT;
    // a past line falls toward you and out of frame (gravity, lying on your back)
    const fall = Math.max(0, t - (nextStart - 0.05));
    const fz = st < 10 ? 0.5 * 5 * fall * fall : 0;
    if (st < 10 && fz > 2.2) return;
    o *= 1 - clamp01(fall / 0.22);
    p = [p[0], p[1], 0.06 + fz];
    if (r.li === 7 && r.wi === 1) { // PRESSURE: squeezed and trembling
      const u = cubicOut(clamp01((t - (w.s + 0.1)) / 0.45));
      scl = [mix(1, 0.8, u), mix(1, 0.6, u), 1];
      p = [p[0] + Math.sin(t * 61) * 0.002 * u, p[1], p[2]];
    }
    if (r.li === 7 && r.wi === 4) { // CHEST: a heartbeat
      const b = T.beats.filter((x) => x <= t).slice(-1)[0] ?? 0, d = t - b;
      const beat = t > w.s ? Math.exp(-d * 16) * 0.14 + (d > 0.14 ? Math.exp(-(d - 0.14) * 16) * 0.08 : 0) : 0;
      scl = [1 + beat, 1 + beat, 1];
    }
    if (r.li === 8 && r.hero) { // BLESSED, said by several people at once
      for (let c = 0; c < 4; c++) {
        const u = cubicOut(clamp01((t - (w.s - 0.08 + c * 0.03)) / 0.26));
        if (u <= 0 || u >= 1) continue;
        const ang = (c / 4) * Math.PI * 2 + 0.5;
        room.push(<group key={`bl${c}`} position={[p[0] + Math.cos(ang) * 0.12 * (1 - u), p[1] + Math.sin(ang) * 0.07 * (1 - u), p[2] + 0.01]}><Letters font={a.bebas} family="bebas" text="BLESSED" size={r.size} depth={0.004} material={flat(`bl${c}`, "#6f604e", 0.22 * (1 - u), true)} tracking={0.04} bevel={0} shadows={false} /></group>);
      }
      o *= clamp01((t - w.s - 0.06) / 0.2);
    }
    if ((r.li === 8) && !r.hero) { // the other words lean in from the edges, like faces looking down
      const edge = [[-0.3, 0.32, -0.6], [0.3, 0.3, 0.6], [-0.32, -0.25, 0.5], [0.3, -0.28, -0.5], [0, 0.38, 0]][r.wi] ?? [0, 0, 0];
      const u = cubicOut(clamp01((t - (w.s - 0.05)) / 0.35));
      p = [mix(edge[0] * 1.6, edge[0], u), mix(edge[1] * 1.3, edge[1], u), p[2]];
      rot = [0, 0, edge[2]];
    }
    if (r.li === 9 && r.wi === 2) { // STRUGGLING can't hold together
      const tt = t - w.s;
      xf = (i, x) => { const rr = rng(i * 7 + 3); const k = 1 - (0.55 + 0.45 * Math.abs(Math.sin(tt * 2.6 + i * 0.7))); return { p: [x + (rr() - 0.5) * 0.05 * k, (rr() - 0.5) * 0.06 * k, (rr() - 0.5) * 0.04 * k], r: [0, 0, (rr() - 0.5) * 0.9 * k] }; };
    }
    room.push(
      <group key={key} position={p} rotation={rot} scale={scl}>
        <Letters font={a.bebas} family="bebas" text={r.text} size={r.size} depth={0.004} material={flat(key, r.color, o, true)} tracking={0.04} bevel={0} shadows xf={xf} />
      </group>,
    );
  });

  // QUIT no-sign (in the sky, around QUIT)
  const qW = L(2)[4];
  const qRow = rows.find((r) => r.li === 2 && r.hero)!;
  const qR = Math.max(layout(a.bebas, "QUIT", qRow.size, 0.04).width * 0.62, cap(qRow.size) * 0.85);
  const qDraw = cubicInOut(clamp01((t - (qW.s + 0.06)) / 0.28)), qSlash = cubicInOut(clamp01((t - (qW.s + 0.36)) / 0.12));
  const qC = O.clone().addScaledVector(skyDir(2), D);

  // ME and TIME pulled apart (ceiling local)
  const meW = L(10)[5], tmW = L(11)[3];
  const meCap = cap(0.62);
  const meO = new THREE.Vector3(0, -0.05, 0.06);
  const hookDirs = [[-1, 0.35], [1, 0.25], [-0.8, -0.7], [0.9, -0.6], [-0.2, 1], [0.35, -1], [-1, -0.1], [1, 0.8]];
  const meHooks: Hook[] = hookDirs.map(([dx, dy], i) => { const r = rng(i + 40); return { at: meW.s + 0.12 + Math.floor(i / 2) * 0.17 + (i % 2) * 0.07, dir: new THREE.Vector2(dx, dy).normalize(), local: new THREE.Vector2((dx > 0 ? 1 : -1) * (0.08 + r() * 0.14), (r() - 0.5) * meCap * 0.8) }; });
  const yank = (h: Hook) => { const d = t - (h.at + 0.22); if (d <= 0) return 0; const jerks = T.beats.filter((b) => b > h.at + 0.2 && b <= t).length; return Math.min(0.34, 0.06 + jerks * 0.07) * (1 - Math.exp(-d * 9) * Math.cos(d * 22)); };
  const tO = new THREE.Vector3(0.05, -0.36, 0.06);
  const tCap = cap(0.24);
  const tHooks: Hook[] = [[-1, 0.2], [1, -0.1], [0.4, -1], [-0.5, 1]].map(([dx, dy], i) => ({ at: tmW.s + 0.05 + i * 0.07, dir: new THREE.Vector2(dx, dy).normalize(), local: new THREE.Vector2((dx > 0 ? 1 : -1) * (0.1 + i * 0.03), (i % 2 ? -1 : 1) * tCap * 0.25) }));
  const tYank = (h: Hook) => { const d = t - (h.at + 0.12); return d <= 0 ? 0 : 0.25 * (1 - Math.exp(-d * 8) * Math.cos(d * 20)) + d * 0.3; };
  const meVis = inRoom && t >= meW.s - 0.06 && t < shelfT + 0.3;
  const timeVis = inRoom && t >= tmW.s - 0.06 && t < shelfT + 0.3;
  if (meVis) pullTiles(me, meHooks, yank, meO);
  if (timeVis) pullTiles(time, tHooks, tYank, tO);
  const strings = (hooks: Hook[], Oo: THREE.Vector3, y: (h: Hook) => number, len: number) =>
    hooks.map((h, i) => {
      const hookAt = new THREE.Vector3(Oo.x + h.local.x + h.dir.x * y(h), Oo.y + h.local.y + h.dir.y * y(h), Oo.z + 0.02);
      const from = new THREE.Vector3(Oo.x + h.local.x + h.dir.x * len, Oo.y + h.local.y + h.dir.y * len, Oo.z + 0.05);
      return <String3 key={i} a={from} b={hookAt} sag={mix(0.08, 0, clamp01((t - (h.at + 0.18)) / 0.08))} draw={cubicOut(clamp01((t - h.at) / 0.22))} o={0.9} />;
    });
  // the ceiling lowers on PRESSURE
  const press = cubicOut(clamp01((t - (L(7)[1].s + 0.05)) / 0.5)) * (1 - cubicOut(clamp01((t - L(8)[0].s) / 0.8)));
  const ceilZ = -0.25 + press * 0.12; // local z of the ceiling plane (toward you = +)

  // ---------- camera ----------
  let pos: THREE.Vector3, look: THREE.Vector3, up = new THREE.Vector3(0, 1, 0), fov = 40;
  if (!inRoom) {
    // POV: turn from line to line across the sky
    let dir = skyDir(0);
    for (let k = 1; k <= 6; k++) { const u = cubicInOut(clamp01((t - (L(k)[0].s - (k <= 5 ? 0.42 : 0.12))) / (k <= 5 ? 0.4 : 0.5))); /* turn during the breath before the line */ if (u > 0) dir = dir.clone().lerp(skyDir(k), u).normalize(); }
    const breathe = new THREE.Vector3((noise1(t * 0.25, 1) - 0.5) * 0.02, (noise1(t * 0.21, 2) - 0.5) * 0.02, 0);
    pos = O.clone(); look = O.clone().addScaledVector(dir.add(breathe), 5);
    // STOP: out of your eyes — the silhouette on the building edge, the sky of lines above
    if (zoom > 0) {
      const zp = new THREE.Vector3(1.4, 0.9, 8.4), zl = new THREE.Vector3(0, 1.7, -3.5);
      pos = pos.clone().lerp(zp, zoom); look = look.clone().lerp(zl, zoom); fov = mix(40, 48, zoom);
    }
  } else {
    // lying on the bed looking up; ceiling local -> world: (x, y, z) -> (x, CY - 0.3 - z ... ) handled by the group
    const lp = new THREE.Vector3((noise1(t * 0.2, 3) - 0.5) * 0.01, (noise1(t * 0.18, 4) - 0.5) * 0.01, 0);
    pos = LIE.clone().add(new THREE.Vector3(lp.x, 0, lp.y));
    look = new THREE.Vector3(lp.x * 0.5, CY, lp.y * 0.5);
    up = new THREE.Vector3(0, 0, 1);
    fov = 34;
  }
  // sitting up into the shelf
  const sh = shelfFrame(a, kit, t, false);
  const toShelf = cubicInOut(clamp01((t - (shelfT - 0.2)) / 0.55));
  if (toShelf > 0) {
    const sp = new THREE.Vector3(...sh.cam).add(SH), sl = new THREE.Vector3(...sh.look).add(SH);
    pos = pos.clone().lerp(sp, toShelf); look = look.clone().lerp(sl, toShelf);
    up = up.clone().lerp(new THREE.Vector3(Math.sin(sh.roll), 1, 0), toShelf).normalize(); fov = mix(fov, 42, toShelf);
  }
  // MINE: find it in the rubble
  const mineW = L(13)[4];
  const mineP = new THREE.Vector3(sh.wX - 0.62, 0.002, -0.62 + 0.36 / 2 + 0.005 + 0.6).add(SH);
  const find = cubicInOut(clamp01((t - (mineW.s - 0.35)) / 0.6));
  if (find > 0) {
    pos = pos.clone().lerp(mineP.clone().add(new THREE.Vector3(0.08, 0.42, 0.48)), find);
    look = look.clone().lerp(mineP, find);
    up = up.clone().lerp(new THREE.Vector3(0, 1, 0), find).normalize(); fov = mix(fov, 36, find);
  }
  // the crack opens under it; MINE tips in and falls; the camera goes down after it
  const SLAM = 34.447;
  const crackW = t < SLAM ? 0 : 0.035 * cubicOut(clamp01((t - SLAM) / 0.25)) + 0.15 * cubicInOut(clamp01((t - (mineW.s + 0.1)) / 0.45));
  const tFall = mineW.s + 0.42;
  const fdt = Math.max(0, t - tFall);
  const vT = 2.2, tv = vT / 9; // falls, then drifts down at a steady speed
  const fallY = fdt < tv ? 0.5 * 9 * fdt * fdt : 0.5 * 9 * tv * tv + vT * (fdt - tv);
  const tip = cubicInOut(clamp01(fdt / 0.35));
  const mineNow = mineP.clone().add(new THREE.Vector3(0, -fallY, -0.05 * tip));
  const over = cubicInOut(clamp01((t - (tFall - 0.25)) / 0.4));
  (kit.mats.crack as THREE.MeshStandardMaterial).opacity = 1 - find;
  if (over > 0) {
    pos = pos.clone().lerp(mineNow.clone().add(new THREE.Vector3(0, 0.62, 0.1)), over);
    look = look.clone().lerp(mineNow, over);
    up = up.clone().lerp(new THREE.Vector3(0, 0, -1), over).normalize(); fov = mix(fov, 40, over);
  }

  // ---------- eyelids ----------
  const lidTired = cubicInOut(clamp01((t - (L(1)[4].s + 0.3)) / 1.6)) * 0.32 * (1 - cubicOut(clamp01((t - (L(2)[0].s - 0.15)) / 0.3)));
  const blink = t > blinkC - 0.16 && t < blinkC + 0.2 ? 1 - Math.abs((t - blinkC) / 0.16) : 0;
  const restW = L(9)[4];
  const lidRest = t > restW.s + 0.1 && t < L(10)[0].s ? cubicInOut(clamp01((t - restW.s - 0.1) / 0.7)) * 0.62 * (t > L(10)[0].s - 0.12 ? 0 : 1) : 0;
  const lid = Math.max(lidTired, clamp01(blink), lidRest);

  // ---------- timer ----------
  const tStart = L(5)[2].s;
  const el = Math.max(0, t - tStart);
  const pop = cubicOut(clamp01((t - tStart) / 0.3));
  const tug = timeVis ? Math.min(1, Math.max(0, t - (tmW.s + 0.15)) * 3) * (1 - clamp01((t - (shelfT - 0.1)) / 0.3)) : 0;
  const timerUI = false ? (
    <div style={{ position: "absolute", right: 150 - tug * 40, top: 230 - tug * 24, width: 112, height: 112, opacity: pop * (1 - zoom) * 0.9, transform: `scale(${mix(0.6, 1, pop)}) rotate(${tug * 14}deg)`, transformOrigin: "100% 0%" }}>
      <svg width={112} height={112} viewBox="0 0 112 112">
        <circle cx={56} cy={56} r={46} stroke="rgba(239,237,233,0.2)" strokeWidth={2.5} fill="none" />
        <circle cx={56} cy={56} r={46} stroke="#efe9df" strokeWidth={2.5} fill="none" strokeLinecap="round" pathLength={1} strokeDasharray={`${Math.min(1, el / 60)} 2`} transform="rotate(-90 56 56)" />
        <text x={56} y={63} textAnchor="middle" fontFamily={F.mono} fontSize={21} fill="#efe9df">{`0:${String(Math.min(59, Math.floor(el))).padStart(2, "0")}`}</text>
      </svg>
      {tug > 0 ? <svg width={300} height={300} style={{ position: "absolute", left: 56, top: 56, overflow: "visible" }}><line x1={0} y1={0} x2={260} y2={-200} stroke="#efe9df" strokeWidth={1.6} /></svg> : null}
    </div>
  ) : null;

  const starGain = (1 - dawn) * 0.85;
  return (
    <Full bg="#030304">
      <Stage cam={{ pos: pos.toArray() as [number, number, number], look: look.toArray() as [number, number, number], fov, up: up.toArray() as [number, number, number] }}
        look={{ exposure: 1.0, env: 0.15, bloom: { strength: 0.25, radius: 0.5, threshold: 0.92 }, bg: "#030304" }}>
        {/* ---------------- night world ---------------- */}
        {!inRoom || toShelf < 1 ? (
          <>
            <Sky dawn={dawn} />
            <Glow geo={stars} size={34} gain={starGain} time={t} twinkle={0.35} />
            {zoom > 0.02 ? <Glow geo={city} size={14} gain={0.8 * zoom} color="#f2dcc0" twinkle={0.25} time={t} /> : null}
            {/* the building and the figure on its edge (seen only in the pull-out) */}
            <mesh position={[0, -0.6 - 20, 6]}><boxGeometry args={[14, 40, 12]} /><meshBasicMaterial color="#020202" /></mesh>
            <mesh position={[0, 0.35, 0.18]} material={sil} visible={zoom > 0.01}><planeGeometry args={[0.76, 0.96]} /></mesh>
            {sky}
            {(() => {
              const m0 = L(5)[0].s, o = cubicOut(clamp01((t - (m0 - 0.1)) / 0.6)) * (1 - dawn) * (1 - zoom) * 0.5;
              const C = O.clone().addScaledVector(skyDir(5), D + 3.5);
              return o > 0.01 ? (
                <group position={C.toArray() as [number, number, number]} ref={(g) => { if (g) g.lookAt(O); }}>
                  <SkyClock r={1.55} sec={Math.max(0, t - L(5)[2].s)} o={o} />
                </group>
              ) : null;
            })()}
            {qDraw > 0 && !inRoom ? (
              <group position={qC.toArray() as [number, number, number]} ref={(g) => { if (g) g.lookAt(O); }}>
                <group position={[qRow.x, qRow.y, 0]}><NoSign r={qR} draw={qDraw} slash={qSlash} o={lineNow > 2 ? mix(0.0, 0.9, zoom) : 1} /></group>
              </group>
            ) : null}
          </>
        ) : null}
        {/* ---------------- the bedroom ---------------- */}
        {inRoom ? (
          <>
            <ambientLight intensity={0.16} color="#e9e1d6" />
            {/* morning sun through the blinds, low across the ceiling */}
            <directionalLight position={[2.2, CY - 1.4, 1.6]} target-position={[0, CY, 0]} intensity={3.4} color="#ffe6c8" castShadow
              shadow-mapSize={[2048, 2048]} shadow-camera-left={-3} shadow-camera-right={3} shadow-camera-top={3} shadow-camera-bottom={-3} shadow-camera-near={0.1} shadow-camera-far={10} shadow-bias={-0.0004} />
            {blinds.map((i) => (
              <mesh key={i} position={[1.55, CY - 1.0, 1.05 - i * 0.075]} rotation={[0.35, 0, 0]} castShadow><boxGeometry args={[0.02, 0.6, 0.035]} /><meshBasicMaterial colorWrite={false} depthWrite={false} /></mesh>
            ))}
            <group position={[0, CY, 0]} rotation={[Math.PI / 2, 0, 0]}>
              {/* the ceiling: plain, flat plaster */}
              <mesh position={[0, 0, ceilZ - 0.0]} receiveShadow><planeGeometry args={[8, 8]} /><meshStandardMaterial color={new THREE.Color("#d8d1c6").lerp(new THREE.Color("#1c1a18"), toShelf)} roughness={0.95} /></mesh>
              <group position={[0, 0, ceilZ + 0.25]}>{room}</group>
              {meVis ? <primitive object={me.mesh} /> : null}
              {meVis ? strings(meHooks, meO, yank, 1.4) : null}
              {timeVis ? <primitive object={time.mesh} /> : null}
              {timeVis ? strings(tHooks, tO, tYank, 1.2) : null}
            </group>
            {/* the wall you sit up to face, with the shelf */}
            <group position={SH.toArray() as [number, number, number]}>
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.25, 0]} receiveShadow geometry={floorGeo(crackW, mineP.x - SH.x, mineP.z - SH.z, sh.wX)}><meshStandardMaterial color="#34312d" roughness={0.92} /></mesh>
              <mesh position={[0, 3, -0.62]} receiveShadow><planeGeometry args={[14, 8]} /><meshStandardMaterial color="#2c2a27" roughness={0.95} /></mesh>
              <spotLight position={[0.4, 3.0, 2.2]} angle={0.62} penumbra={0.85} intensity={70 * toShelf} decay={2} color="#fff1df" castShadow shadow-mapSize={[1024, 1024]} />
              <ambientLight intensity={0.0} />
              {toShelf > 0 ? sh.nodes : null}
              {/* I FORGOT WHAT'S ACTUALLY ... MINE, among the rubble */}
              {L(13).map((w, i) => {
                const u = clamp01((t - (w.s - 0.12)) / 0.12);
                if (u <= 0) return null;
                const isMine = i === 4;
                const size = isMine ? 0.06 : 0.09;
                const fx = [-0.95, -0.55, -0.15, 0.2, 0][i], fz = [0.25, 0.42, 0.3, 0.5, 0][i];
                const pp = isMine ? mineNow.clone().sub(SH).add(new THREE.Vector3(0, 0, 0.09 * (1 - tip))) : new THREE.Vector3(sh.wX + fx, 0, -0.62 + 0.6 + fz);
                const drop = (1 - u) * 0.6;
                return (
                  <group key={i} position={[pp.x, pp.y + 0.003 + drop, pp.z]} rotation={[-Math.PI / 2 - (isMine ? tip * 0.9 + fdt * 0.25 : 0), isMine ? fdt * 0.18 : 0, isMine ? 0.15 + fdt * 0.1 : (i - 1.5) * 0.12]}>
                    <Letters font={a.bebas} family="bebas" text={w.w.toUpperCase()} size={size} depth={0.006} material={flat(`mine${i}`, isMine ? "#bfb4a4" : "#5e5850", 1, true)} tracking={0.04} bevel={0} shadows={false} />
                  </group>
                );
              })}
              {find > 0 ? <pointLight position={[mineNow.x - SH.x + 0.05, mineNow.y - SH.y + 0.4, mineNow.z - SH.z + 0.08]} intensity={0.12 * find} distance={1.4} decay={2} color="#ffe2bf" /> : null}
              {fdt > 0 ? <Glow geo={voidDust} size={6} gain={0.6} color="#e9e3d8" twinkle={0.3} time={t} position={[mineP.x - SH.x, 0, mineP.z - SH.z]} /> : null}
            </group>
          </>
        ) : null}
      </Stage>
      {/* eyelids */}
      {lid > 0.005 ? (
        <AbsoluteFill style={{ pointerEvents: "none" }}>
          <div style={{ position: "absolute", left: -200, right: -200, top: -1200 + lid * 1180, height: 1200, background: "#000", borderRadius: "0 0 50% 50% / 0 0 22% 22%", filter: "blur(18px)" }} />
          <div style={{ position: "absolute", left: -200, right: -200, bottom: -1200 + lid * 1180, height: 1200, background: "#000", borderRadius: "50% 50% 0 0 / 22% 22% 0 0", filter: "blur(18px)" }} />
        </AbsoluteFill>
      ) : null}
      <AbsoluteFill>{timerUI}</AbsoluteFill>
      <Finish grain={0.06} vignette={0.55} />
    </Full>
  );
};

/** The floor as a slab with a jagged crack through it (the crack's width animates). */
const floorCache = new Map<string, THREE.BufferGeometry>();
const floorGeo = (w: number, cx: number, cz: number, wX: number) => {
  const key = `${Math.round(w * 400)}|${cx.toFixed(3)}|${cz.toFixed(3)}`;
  let g = floorCache.get(key);
  if (!g) {
    const shape = new THREE.Shape([new THREE.Vector2(-7, -6), new THREE.Vector2(7, -6), new THREE.Vector2(7, 6), new THREE.Vector2(-7, 6)]);
    if (w > 0.002) {
      const r = rng(19), x0 = cx - 0.42, x1 = Math.min(wX - 0.1, cx + 0.55), n = 22;
      const top: THREE.Vector2[] = [], bot: THREE.Vector2[] = [];
      for (let i = 0; i <= n; i++) {
        const u = i / n, x = mix(x0, x1, u), taper = Math.sin(u * Math.PI) ** 0.6, j = (r() - 0.5) * 0.03;
        const zc = cz + Math.sin(u * 7.3) * 0.02 + j;
        top.push(new THREE.Vector2(x, -(zc - (w / 2) * taper - 0.004)));
        bot.push(new THREE.Vector2(x, -(zc + (w / 2) * taper + 0.004 + (r() - 0.5) * 0.01)));
      }
      shape.holes.push(new THREE.Path([...top, ...bot.reverse()]));
    }
    g = new THREE.ExtrudeGeometry(shape, { depth: 0.25, bevelEnabled: false });
    floorCache.set(key, g);
  }
  return g;
};

export const AudioTrack: React.FC = () => <Audio src={staticFile("audio/drift.m4a")} />;
void vol; void cubicIn;
