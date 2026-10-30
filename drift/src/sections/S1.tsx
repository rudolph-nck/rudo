import React, { useMemo } from "react";
import * as THREE from "three";
import { AbsoluteFill, Audio, staticFile } from "remotion";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { useAssets } from "../three/assets";
import { Stage } from "../three/Stage";
import { stoneMat } from "../three/materials";
import { LINES, T, Word, sungAmount, vol } from "../data";
import { clamp01, cubicIn, cubicInOut, cubicOut, mix } from "../utils/ease";
import { noise1, rng } from "../utils/random";
import { capHeight, layout, wordPoints } from "../words/glyphs";
import { Glow } from "../words/points";
import { Finish, Full, Letters } from "../frames/kit";
import { shelfFrame, useShelfKit } from "../frames/SFShelf";
import { F } from "../utils/fonts";
import { W, H } from "../theme";

/**
 * Section 1 (0:00–0:35.3), v2: a calm dark void. Each line is built word by word in clean solid
 * type and hangs in space; the camera sinks from line to line (gravity), past lines fade into
 * the dark. One effect per line, simple and physical. Ends on the shelf.
 */
export const S1_END = 35.3;
const L = (li: number) => LINES[li].words;
const INK = "#e9e5df";
const STONE = "#c4b6a2";

// the path: each line hangs a little lower and further back than the last
const P = (k: number): [number, number, number] => [k % 2 ? 0.12 : -0.12, 2.0 - k * 1.25, -k * 1.7];
const SHELF_K = 12;

type Spec = { li: number; wi: number; text: string; size: number; x: number; y: number; hero: boolean; color: string };

// ---------------------------------------------------------------------------------------------
const lineMatCache = new Map<string, LineMaterial>();
const String3: React.FC<{ a: THREE.Vector3; b: THREE.Vector3; sag: number; draw: number; o?: number; width?: number }> = ({ a, b, sag, draw, o = 1, width = 1.8 }) => {
  const obj = useMemo(() => {
    const g = new LineGeometry();
    g.setPositions(new Array(25 * 3).fill(0));
    const m = new LineMaterial({ linewidth: width, worldUnits: false, transparent: true, toneMapped: false, depthWrite: false });
    m.resolution.set(W, H);
    m.color = new THREE.Color("#efe9df").multiplyScalar(1.35);
    const l = new Line2(g, m);
    l.frustumCulled = false;
    return { g, m, l };
  }, [width]);
  void lineMatCache;
  if (draw <= 0) return null;
  const pts: number[] = [];
  const end = a.clone().lerp(b, clamp01(draw));
  for (let i = 0; i <= 24; i++) {
    const u = i / 24;
    const p = a.clone().lerp(end, u);
    p.y -= Math.sin(u * Math.PI) * sag;
    pts.push(p.x, p.y, p.z);
  }
  obj.g.setPositions(pts);
  obj.m.opacity = o;
  return <primitive object={obj.l} />;
};

/** A word made of small stone tiles, so pieces of it can be pulled away. */
const useTiles = (a: ReturnType<typeof useAssets>, text: string, size: number, n: number, seed: number) =>
  useMemo(() => {
    if (!a) return null;
    const p = wordPoints(a.bebas, text, size, n, 0.18, seed, 0.03);
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: "#dcd6cd", roughness: 0.55 }), p.seeds.length);
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    return { mesh, pos: p.pos, seeds: p.seeds, n: p.seeds.length, tile: size * 0.034 };
  }, [a, text, size, n, seed]);

type Hook = { at: number; dir: THREE.Vector2; local: THREE.Vector2 };
/** Place tiles: each hook drags the tiles near it along its string; yanks come as springy jerks. */
const pullTiles = (tl: NonNullable<ReturnType<typeof useTiles>>, hooks: Hook[], yank: (h: Hook) => number, origin: THREE.Vector3) => {
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i < tl.n; i++) {
    const x = tl.pos[i * 3], y = tl.pos[i * 3 + 1];
    let dx = 0, dy = 0, dz = 0, spin = 0;
    for (const h of hooks) {
      const y0 = yank(h);
      if (y0 <= 0) continue;
      const d = Math.hypot(x - h.local.x, y - h.local.y);
      const w = Math.exp(-d / 0.16);
      // tiles close to the hook tear off and go with the string; the rest of the letter stretches
      const tear = w > 0.55 ? 1 : w;
      dx += h.dir.x * y0 * tear;
      dy += h.dir.y * y0 * tear;
      dz += y0 * tear * 0.15 * (tl.seeds[i] - 0.5);
      spin += tear * y0 * 4;
    }
    q.setFromEuler(new THREE.Euler(spin * (tl.seeds[i] - 0.5), spin * 0.5, spin * (0.5 - tl.seeds[i])));
    s.setScalar(tl.tile).setZ(tl.tile * 3);
    v.set(origin.x + x + dx, origin.y + y + dy, origin.z + dz);
    m.compose(v, q, s);
    tl.mesh.setMatrixAt(i, m);
  }
  tl.mesh.instanceMatrix.needsUpdate = true;
};

// ---------------------------------------------------------------------------------------------
export const S1: React.FC<{ t: number }> = ({ t }) => {
  const a = useAssets();
  const kit = useShelfKit(a);
  const matCache = useMemo(() => new Map<string, THREE.MeshPhysicalMaterial>(), []);
  const me = useTiles(a, "ME", 1.15, 3800, 71);
  const time = useTiles(a, "TIME", 0.42, 2600, 72);
  const disp = useMemo(() => {
    if (!a) return null;
    const p = wordPoints(a.bebas, "DISAPPEAR", 0.42, 5000, 0.5, 73, 0.04);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(p.pos.slice(), 3));
    g.setAttribute("seed", new THREE.BufferAttribute(p.seeds, 1));
    g.setAttribute("bright", new THREE.BufferAttribute(new Float32Array(p.seeds.length).map((_, i) => 0.3 + ((i * 0.618) % 1) * 0.5), 1));
    g.userData = { base: p.pos };
    return g;
  }, [a]);
  const dust = useMemo(() => {
    const r = rng(9), n = 1400;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3).map((_, i) => (i % 3 === 0 ? (r() - 0.5) * 8 : i % 3 === 1 ? 4 - r() * 24 : 2 - r() * 26)), 3));
    g.setAttribute("seed", new THREE.BufferAttribute(new Float32Array(n).map(() => r()), 1));
    g.setAttribute("bright", new THREE.BufferAttribute(new Float32Array(n).map(() => 0.05 + Math.pow(r(), 5) * 0.4), 1));
    return g;
  }, []);
  const ceilMat = useMemo(() => (a ? stoneMat(a, "#8a847c", 0.9, 1.0) : null), [a]);
  if (!a || !kit || !me || !time || !disp || !ceilMat) return <Full>{null}</Full>;

  const mat = (key: string, color: string, o: number) => {
    let m = matCache.get(key);
    if (!m) {
      m = stoneMat(a, color, 1.6, 0.45);
      m.transparent = true;
      matCache.set(key, m);
    }
    m.opacity = o;
    m.depthWrite = o > 0.6;
    return m;
  };
  const cap = (s: number) => capHeight(a.bebas, s);

  // ---------- layout: rows of words per line, centred on the line's spot ----------
  const specs: Spec[] = [];
  const row = (li: number, wis: number[], y: number, size: number, hero = false, maxW = 1.05, color = INK) => {
    const texts = wis.map((wi) => L(li)[wi].w.toUpperCase().replace(/[.,]/g, ""));
    const s0 = Math.min(size, size * (maxW / layout(a.bebas, texts.join(" "), size, 0.04).width));
    const lay = layout(a.bebas, texts.join(" "), s0, 0.04);
    let ci = 0;
    texts.forEach((tx, k) => {
      const f = lay.letters[ci], l = lay.letters[ci + tx.length - 1];
      specs.push({ li, wi: wis[k], text: tx, size: s0, x: (f.x - f.adv / 2 + l.x + l.adv / 2) / 2, y, hero, color });
      ci += tx.length + 1;
    });
  };
  row(0, [0], 0, 0.3);
  row(1, [0, 1, 2, 3], 0.32, 0.17); row(1, [4], -0.12, 0.52, true, 0.9, STONE);
  row(2, [0, 1, 2, 3], 0.42, 0.17); row(2, [4], -0.14, 0.4, true, 0.9);
  row(3, [0, 1, 2, 3], 0.32, 0.17); row(3, [4], -0.12, 0.42, true, 0.95);
  row(4, [0, 1, 2], 0.62, 0.15); row(4, [3], 0.32, 0.32, true, 0.95); row(4, [4], 0.0, 0.13); row(4, [5], -0.38, 0.62, true, 0.9, STONE);
  row(5, [0, 1], 0.28, 0.17); row(5, [2], -0.08, 0.36, true);
  row(6, [0], 0.72, 0.16); row(6, [1], 0.38, 0.4, true, 1.0, STONE); row(6, [2], 0.0, 0.14); row(6, [3], -0.32, 0.3, true);
  row(7, [0], 0.66, 0.15); row(7, [1], 0.3, 0.42, true, 1.0, STONE); row(7, [2, 3], -0.06, 0.15); row(7, [4], -0.36, 0.3, true);
  row(8, [0, 1, 2], 0.66, 0.15); row(8, [3, 4], 0.38, 0.15); row(8, [5], 0.0, 0.42, true, 1.0, STONE);
  row(9, [0, 1], 0.7, 0.15); row(9, [2], 0.38, 0.32, true, 1.0); row(9, [3], 0.06, 0.13); row(9, [4], -0.3, 0.4, true, 1.0, STONE);
  row(10, [0], 1.02, 0.24); row(10, [1, 2, 3, 4], 0.74, 0.15);
  row(11, [0, 1, 2], -0.82, 0.13);

  // ---------- word appearance: soft, settles into place as it's sung ----------
  const kNow = (() => { let k = 0; for (let li = 0; li <= 10; li++) if (t >= L(li)[0].s - 0.05) k = li; if (t >= L(SHELF_K)[0].s - 0.1) k = SHELF_K; return k; })();
  const stopT = L(4)[5].s;
  const zoom = clamp01((t - (stopT + 0.12)) / 0.35) * (1 - clamp01((t - (L(5)[0].s - 0.35)) / 0.35));
  const nodes: React.ReactNode[] = [];
  specs.forEach((sp, idx) => {
    const w = L(sp.li)[sp.wi];
    const appear = cubicOut(clamp01((t - (w.s - 0.06)) / 0.28));
    if (appear <= 0) return;
    const st = sp.li === 11 ? 10 : sp.li;
    const P0 = P(st);
    const past = st < kNow;
    let o = appear * (past ? mix(0.32, 0.85, zoom) : 1);
    let pos: [number, number, number] = [P0[0] + sp.x, P0[1] + sp.y + (1 - appear) * 0.05, P0[2]];
    let rot: [number, number, number] = [0, 0, 0];
    let scl: [number, number, number] = [1, 1, 1];
    let xf: ((i: number, x: number) => { p: [number, number, number]; r?: [number, number, number] }) | undefined;
    const n = sp.text.length;
    const key = `${sp.li}-${sp.wi}`;
    // YEAH: a breath — in and out
    if (sp.li === 0) o = appear * (t < w.e ? 0.75 : Math.max(0, 1 - (t - w.e) / 0.9));
    // TIRED: tips back and drifts away into the dark, like falling asleep
    if (sp.li === 1 && sp.hero) {
      const u = cubicInOut(clamp01((t - (w.s + 0.25)) / 2.6));
      pos = [pos[0] + u * 0.15, pos[1] - u * 0.35, pos[2] - u * 3.2];
      rot = [-u * 0.9, 0, u * 0.12];
      o *= 1 - u * 0.75;
      xf = (i, x) => ({ p: [x * (1 + u * 0.12), Math.sin(i * 1.7) * u * 0.05, Math.cos(i * 2.3) * u * 0.08], r: [0, 0, (i - (n - 1) / 2) * u * 0.06] });
    }
    // DISAPPEAR: dissolves into the void (drawn as points below); the solid word fades out
    if (sp.li === 3 && sp.hero) o *= 1 - clamp01((t - (w.s + 0.45)) / 0.5);
    // STOP: slams in crisp
    if (sp.li === 4 && sp.wi === 5) { const u = clamp01((t - stopT) / 0.08); o = past ? o : u; scl = [1, mix(1.25, 1, u), 1]; }
    // MORNING: rises like the sun
    if (sp.li === 6 && sp.hero && sp.wi === 1) { const u = cubicOut(clamp01((t - w.s) / 0.7)); pos = [pos[0], pos[1] - (1 - u) * 0.25, pos[2]]; }
    // CEILING: hangs under the ceiling line as it lowers
    if (sp.li === 6 && sp.wi === 3) { const u = cubicOut(clamp01((t - w.s) / 0.5)); pos = [pos[0], pos[1] + 0.12 - u * 0.12, pos[2]]; }
    // PRESSURE: squeezed from both sides and above, trembling under it
    if (sp.li === 7 && sp.wi === 1) {
      const u = cubicOut(clamp01((t - (w.s + 0.12)) / 0.5));
      const tr = past ? 0 : Math.sin(t * 61) * 0.006 * u;
      scl = [mix(1, 0.78, u), mix(1, 0.62, u), 1];
      pos = [pos[0] + tr, pos[1] - u * 0.06, pos[2]];
      xf = (i, x) => ({ p: [x, Math.sin(t * 43 + i * 1.9) * 0.004 * u, 0] });
    }
    // CHEST: a heartbeat (lub-dub on each beat)
    if (sp.li === 7 && sp.wi === 4) {
      const b = T.beats.filter((x) => x <= t).slice(-1)[0] ?? 0;
      const d = t - b;
      const beat = t > w.s ? Math.exp(-d * 18) * 0.12 + Math.exp(-Math.max(0, d - 0.13) * 18) * 0.07 * (d > 0.13 ? 1 : 0) : 0;
      scl = [1 + beat, 1 + beat, 1 + beat];
    }
    // BLESSED: said by many people — out-of-sync copies close in and become one
    if (sp.li === 8 && sp.hero) {
      for (let c = 0; c < 5; c++) {
        const u = cubicOut(clamp01((t - (w.s - 0.08 + c * 0.03)) / 0.26));
        if (u <= 0 || u >= 1) continue;
        const ang = (c / 5) * Math.PI * 2 + 0.4;
        nodes.push(
          <group key={`bl${c}`} position={[pos[0] + Math.cos(ang) * 0.28 * (1 - u), pos[1] + Math.sin(ang) * 0.16 * (1 - u), pos[2] + 0.1 * (1 - u)]} rotation={[0, 0, Math.sin(ang) * 0.2 * (1 - u)]}>
            <Letters font={a.bebas} family="bebas" text="BLESSED" size={sp.size} depth={sp.size * 0.15} material={mat(`bl${c}`, STONE, 0.2 * (1 - u))} tracking={0.04} shadows={false} />
          </group>,
        );
      }
      o *= clamp01((t - w.s - 0.06) / 0.2);
    }
    // STRUGGLING: the letters keep trying to become one word and slipping apart
    if (sp.li === 9 && sp.wi === 2) {
      const tt = t - w.s;
      xf = (i, x) => {
        const r = rng(i * 7 + 3);
        const tryIn = 0.55 + 0.45 * Math.abs(Math.sin(tt * 2.6 + i * 0.7));
        const off = (1 - tryIn) * (past ? 0.4 : 1);
        return { p: [x + (r() - 0.5) * 0.18 * off, (r() - 0.5) * 0.22 * off, (r() - 0.5) * 0.3 * off], r: [0, 0, (r() - 0.5) * 0.9 * off] };
      };
    }
    // REST: lies down, gently, and stays down
    if (sp.li === 9 && sp.wi === 4) {
      const u = cubicInOut(clamp01((t - (w.s + 0.2)) / 0.8));
      pos = [pos[0], pos[1] - cap(sp.size) / 2 * u, pos[2]];
      rot = [-u * (Math.PI / 2 - 0.15), 0, 0];
    }
    nodes.push(
      <group key={key} position={pos} rotation={rot} scale={scl}>
        <Letters font={a.bebas} family="bebas" text={sp.text} size={sp.size} depth={sp.size * (sp.hero ? 0.28 : 0.18)} material={mat(key, sp.color, o)} tracking={0.04} bevel={0.018} shadows={o > 0.6} xf={xf} />
      </group>,
    );
    void idx;
  });

  // DISAPPEAR as points, drifting off into the void
  const dW = L(3)[4];
  const dU = clamp01((t - (dW.s + 0.35)) / 1.6);
  {
    const pos = disp.attributes.position as THREE.BufferAttribute, base = disp.userData.base as Float32Array;
    for (let i = 0; i < pos.count; i++) {
      const s = (i * 0.6180339) % 1, k = clamp01(dU * 1.6 - (base[i * 3] + 1.0) / 2.0 * 0.6 - s * 0.2);
      pos.setXYZ(i, base[i * 3] + k * (s - 0.5) * 0.6, base[i * 3 + 1] + k * 0.25 * (((i * 0.3819) % 1) - 0.3), base[i * 3 + 2] - k * k * 2.5);
    }
    pos.needsUpdate = true;
  }
  const dSpec = specs.find((s) => s.li === 3 && s.hero)!;
  const dP = P(3);

  // the no-sign around QUIT
  const qW = L(2)[4];
  const qSpec = specs.find((s) => s.li === 2 && s.hero)!;
  const qP = P(2);
  const qR = Math.max(layout(a.bebas, "QUIT", qSpec.size, 0.04).width * 0.6, cap(qSpec.size) * 0.85);
  const qDraw = cubicInOut(clamp01((t - (qW.s + 0.2)) / 0.45));
  const qSlash = cubicInOut(clamp01((t - (qW.s + 0.62)) / 0.18));
  const qC = new THREE.Vector3(qP[0] + qSpec.x, qP[1] + qSpec.y, qP[2] + 0.12);

  // CEILING line
  const cW = L(6)[3];
  const cP = P(6);
  const ceilY = cP[1] - 0.32 + cap(0.3) / 2 + 0.06 + 0.12 - cubicOut(clamp01((t - cW.s) / 0.5)) * 0.12;

  // ---------- strings into ME and TIME ----------
  const mP = P(10);
  const meO = new THREE.Vector3(mP[0], mP[1] + 0.05, mP[2]);
  const meW = L(10)[5], pcW = L(10)[3];
  void pcW;
  const hookDirs = [[-1, 0.35], [1, 0.25], [-0.8, -0.7], [0.9, -0.6], [-0.2, 1], [0.35, -1], [-1, -0.1], [1, 0.8]];
  const meCap = cap(1.15);
  const meHooks: Hook[] = hookDirs.map(([dx, dy], i) => {
    const r = rng(i + 40);
    return { at: meW.s + 0.12 + Math.floor(i / 2) * 0.17 + (i % 2) * 0.07, dir: new THREE.Vector2(dx, dy).normalize(), local: new THREE.Vector2((dx > 0 ? 1 : -1) * (0.15 + r() * 0.25), (r() - 0.5) * meCap * 0.8) };
  });
  const yank = (h: Hook) => {
    const d = t - (h.at + 0.22);
    if (d <= 0) return 0;
    // a series of jerks: each beat after the hook pulls harder
    const jerks = T.beats.filter((b) => b > h.at + 0.2 && b <= t).length;
    const spring = 1 - Math.exp(-d * 9) * Math.cos(d * 22);
    return Math.min(0.62, 0.12 + jerks * 0.13) * spring;
  };
  pullTiles(me, meHooks, yank, meO);
  const tP = P(10);
  const tO = new THREE.Vector3(tP[0] + 0.3, tP[1] - 1.12, tP[2] + 0.05);
  const tmW = L(11)[3];
  const tCap = cap(0.42);
  const tHooks: Hook[] = [[-1, 0.2], [1, -0.1], [0.4, -1], [-0.5, 1]].map(([dx, dy], i) => ({ at: tmW.s + 0.05 + i * 0.07, dir: new THREE.Vector2(dx, dy).normalize(), local: new THREE.Vector2((dx > 0 ? 1 : -1) * (0.2 + i * 0.05), (i % 2 ? -1 : 1) * tCap * 0.25) }));
  const tYank = (h: Hook) => { const d = t - (h.at + 0.12); return d <= 0 ? 0 : 0.5 * (1 - Math.exp(-d * 8) * Math.cos(d * 20)) + d * 0.6; };
  pullTiles(time, tHooks, tYank, tO);
  const meVis = t >= meW.s - 0.06 && t < L(SHELF_K)[0].s + 0.35;
  const timeVis = t >= tmW.s - 0.06 && t < L(SHELF_K)[0].s + 0.35;
  const strings = (hooks: Hook[], O: THREE.Vector3, y: (h: Hook) => number, len: number) =>
    hooks.map((h, i) => {
      const hookAt = new THREE.Vector3(O.x + h.local.x + h.dir.x * y(h), O.y + h.local.y + h.dir.y * y(h), O.z + 0.08);
      const from = new THREE.Vector3(O.x + h.local.x + h.dir.x * len, O.y + h.local.y + h.dir.y * len, O.z + 0.3);
      const draw = cubicOut(clamp01((t - h.at) / 0.22));
      const taut = clamp01((t - (h.at + 0.18)) / 0.08);
      return <String3 key={i} a={from} b={hookAt} sag={mix(0.25, 0.0, taut)} draw={draw} o={0.85} />;
    });

  // ---------- camera: sink from line to line ----------
  const camFor = (k: number): { pos: THREE.Vector3; look: THREE.Vector3 } => {
    const p = P(k);
    const dist = k === 10 ? 4.6 : k === 4 ? 3.6 : 3.1;
    const yOff = k === 10 ? -0.25 : k === 4 ? 0.1 : 0.05;
    return { pos: new THREE.Vector3(p[0] * 0.5, p[1] + yOff + 0.15, p[2] + dist), look: new THREE.Vector3(p[0] * 0.5, p[1] + yOff, p[2]) };
  };
  let camPos = camFor(0).pos, camLook = camFor(0).look;
  for (let k = 1; k <= 10; k++) {
    const tk = L(k)[0].s;
    const u = cubicInOut(clamp01((t - (k <= 5 ? tk - 0.3 : tk - 0.1)) / (k <= 5 ? 0.5 : 0.42)));
    if (u <= 0) break;
    const c = camFor(k);
    camPos = camPos.clone().lerp(c.pos, u);
    camLook = camLook.clone().lerp(c.look, u);
  }
  // STOP: pull out of the world for a moment and see every line so far
  if (zoom > 0) {
    const zp = new THREE.Vector3(1.4, P(2)[1] - 0.2, P(2)[2] + 9.5), zl = new THREE.Vector3(0, P(2)[1] - 0.3, P(2)[2] - 0.5);
    const e = cubicInOut(zoom);
    camPos = camPos.clone().lerp(zp, e);
    camLook = camLook.clone().lerp(zl, e);
  }
  // hand-off into the shelf
  const sh = shelfFrame(a, kit, t, false);
  const SH = new THREE.Vector3(0, P(SHELF_K)[1] - 1.9, P(SHELF_K)[2] - 1.0);
  const toShelf = cubicInOut(clamp01((t - (L(SHELF_K)[0].s - 0.12)) / 0.42));
  if (toShelf > 0) {
    camPos = camPos.clone().lerp(new THREE.Vector3(...sh.cam).add(SH), toShelf);
    camLook = camLook.clone().lerp(new THREE.Vector3(...sh.look).add(SH), toShelf);
  }
  const drift = new THREE.Vector3((noise1(t * 0.3, 1) - 0.5) * 0.05, (noise1(t * 0.27, 2) - 0.5) * 0.04, 0);
  camPos.add(drift);
  const focus = camPos.distanceTo(camLook);

  // ---------- light: night, then a sunrise on MORNING ----------
  const mW = L(6)[1];
  const sun = cubicOut(clamp01((t - (mW.s - 0.1)) / 1.4)) * (1 - clamp01((t - L(7)[0].s) / 0.6));
  const sunP = P(6);
  const keyI = mix(2.6, 3.4, sun);
  const fogFar = mix(9, 26, zoom);

  // ---------- the minute timer in the corner ----------
  const tStart = L(5)[2].s;
  const el = Math.max(0, t - tStart);
  const pop = cubicOut(clamp01((t - tStart) / 0.3));
  const timerUI = t >= tStart ? (
    <div style={{ position: "absolute", right: 150, top: 230, width: 128, height: 128, opacity: pop * 0.9, transform: `scale(${mix(0.6, 1, pop)})`, transformOrigin: "100% 0%" }}>
      <svg width={128} height={128} viewBox="0 0 128 128">
        <circle cx={64} cy={64} r={54} stroke="rgba(239,237,233,0.18)" strokeWidth={3} fill="none" />
        <circle cx={64} cy={64} r={54} stroke="#efe9df" strokeWidth={3} fill="none" strokeLinecap="round" pathLength={1} strokeDasharray={`${Math.min(1, el / 60)} 2`} transform="rotate(-90 64 64)" />
        <text x={64} y={72} textAnchor="middle" fontFamily={F.mono} fontSize={24} fill="#efe9df">{`0:${String(Math.min(59, Math.floor(el))).padStart(2, "0")}`}</text>
      </svg>
    </div>
  ) : null;

  return (
    <Full bg="#040404">
      <Stage cam={{ pos: camPos.toArray() as [number, number, number], look: camLook.toArray() as [number, number, number], fov: 40, roll: sh.roll * toShelf }}
        look={{ exposure: 1.0, env: 0.18, bloom: { strength: 0.35, radius: 0.6, threshold: 0.85 }, bg: "#040404", fog: { color: "#040404", near: 4.5, far: fogFar }, dof: { focus, aperture: 0.0024, maxblur: 0.008 } }}>
        <directionalLight position={[camPos.x - 2.5, camPos.y + 3, camPos.z + 1]} intensity={keyI} color="#f2ebe1" castShadow={false} />
        <directionalLight position={[camPos.x + 3, camPos.y - 1, camPos.z - 6]} intensity={1.2} color="#93a3b3" />
        <directionalLight position={[camPos.x + 0.5, camPos.y + 0.5, camPos.z + 3]} intensity={0.9} color="#efe9df" />
        {/* sunrise behind MORNING */}
        {sun > 0 ? (
          <group position={[sunP[0], sunP[1] + mix(-1.6, -0.35, sun), sunP[2] - 9]}>
            <mesh>
              <planeGeometry args={[9, 9]} />
              <shaderMaterial transparent depthWrite={false} toneMapped={false} uniforms={{ uA: { value: sun } }}
                vertexShader="varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }"
                fragmentShader="uniform float uA; varying vec2 vUv; void main(){ float d = length(vUv - 0.5) * 2.0; float core = smoothstep(0.07, 0.055, d); float halo = exp(-d * 5.0) * 0.32 + exp(-d * 2.0) * 0.1; vec3 c = vec3(1.0, 0.88, 0.72) * (core * 1.1 + halo); gl_FragColor = vec4(c * uA, (core * 0.9 + halo) * uA); }" />
            </mesh>
          </group>
        ) : null}
        {/* the ceiling line */}
        {t >= cW.s - 0.05 && kNow <= 7 ? (
          <mesh position={[cP[0], ceilY, cP[2]]} material={ceilMat}><boxGeometry args={[1.25, 0.04, 0.3]} /></mesh>
        ) : null}
        {nodes}
        {/* DISAPPEAR, coming apart into the dark */}
        {t >= dW.s + 0.3 ? <Glow geo={disp} size={1.4} gain={0.45 * (1 - dU * 0.9)} color="#e9e5df" twinkle={0.2} time={t} position={[dP[0] + dSpec.x, dP[1] + dSpec.y, dP[2]]} /> : null}
        {/* no-sign around QUIT */}
        {qDraw > 0 ? <NoSign c={qC} r={qR} draw={qDraw} slash={qSlash} o={kNow > 2 ? mix(0.35, 0.9, zoom) : 1} /> : null}
        {/* ME, pulled apart */}
        {meVis ? <primitive object={me.mesh} /> : null}
        {meVis ? strings(meHooks, meO, yank, 3.2) : null}
        {timeVis ? <primitive object={time.mesh} /> : null}
        {timeVis ? strings(tHooks, tO, tYank, 2.6) : null}
        {/* dust in the void */}
        <Glow geo={dust} size={2.2} gain={0.5} time={t} twinkle={0.5} color="#e9e3d8" />
        {/* the shelf room */}
        {t > L(11)[0].s ? (
          <group position={SH.toArray() as [number, number, number]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={ceilMat}><planeGeometry args={[16, 12]} /></mesh>
            <mesh position={[0, 4, -0.62]} receiveShadow material={ceilMat}><planeGeometry args={[16, 10]} /></mesh>
            <spotLight position={[0.4, 5.4, 2.2]} angle={0.5} penumbra={0.8} intensity={260 * toShelf} decay={2} color="#fff1df" castShadow shadow-mapSize={[1024, 1024]} />
            {sh.nodes}
          </group>
        ) : null}
      </Stage>
      <AbsoluteFill>{timerUI}</AbsoluteFill>
      <Finish grain={0.08} vignette={0.6} />
    </Full>
  );
};

/** The no-sign: a circle drawn in one stroke, then the slash. */
const NoSign: React.FC<{ c: THREE.Vector3; r: number; draw: number; slash: number; o: number }> = ({ c, r, draw, slash, o }) => {
  const circ = useMemo(() => Array.from({ length: 97 }, (_, i) => { const q = Math.PI * 0.75 - (i / 96) * Math.PI * 2; return new THREE.Vector3(Math.cos(q), Math.sin(q), 0); }), []);
  const obj = useMemo(() => {
    const mk = (n: number, w: number) => {
      const g = new LineGeometry();
      g.setPositions(new Array(n * 3).fill(0));
      const m = new LineMaterial({ linewidth: w, worldUnits: false, transparent: true, toneMapped: false, depthWrite: false });
      m.resolution.set(W, H);
      m.color = new THREE.Color("#fff3e6").multiplyScalar(1.6);
      const l = new Line2(g, m);
      l.frustumCulled = false;
      return { g, m, l };
    };
    return { ring: mk(97, 4), slash: mk(2, 4) };
  }, []);
  const k = Math.max(2, Math.round(96 * draw) + 1);
  obj.ring.g.setPositions(circ.slice(0, k).flatMap((p) => [c.x + p.x * r, c.y + p.y * r, c.z]));
  (obj.ring.g as LineGeometry).instanceCount = k - 1;
  const s0 = new THREE.Vector3(c.x - r * 0.707, c.y + r * 0.707, c.z), s1 = new THREE.Vector3(c.x + r * 0.707, c.y - r * 0.707, c.z);
  const se = s0.clone().lerp(s1, slash);
  obj.slash.g.setPositions([s0.x, s0.y, s0.z, se.x, se.y, se.z]);
  obj.ring.m.opacity = o; obj.slash.m.opacity = o;
  return (
    <>
      <primitive object={obj.ring.l} />
      {slash > 0 ? <primitive object={obj.slash.l} /> : null}
    </>
  );
};

export const AudioTrack: React.FC = () => <Audio src={staticFile("audio/drift.m4a")} />;
