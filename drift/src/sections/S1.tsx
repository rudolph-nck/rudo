import React, { useMemo } from "react";
import * as THREE from "three";
import { Audio, staticFile } from "remotion";
import { useAssets } from "../three/assets";
import { Stage } from "../three/Stage";
import { stoneMat } from "../three/materials";
import { LINES, T, Word, sungAmount, vol } from "../data";
import { clamp01, cubicIn, cubicInOut, cubicOut, mix } from "../utils/ease";
import { noise1, rng } from "../utils/random";
import { capHeight, layout } from "../words/glyphs";
import { HotPoint3D, LightWord, Written, headOf, writeWord } from "../words/lightwrite";
import { Glow } from "../words/points";
import { Finish, Full, Letters } from "../frames/kit";
import { shelfFrame, useShelfKit } from "../frames/SFShelf";
import { Motes } from "../frames/SFWeight";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { W, H } from "../theme";

/**
 * Section 1 (0:00–0:35.3): intro + verse 1, one continuous dolly along a long concrete wall.
 * Intro: the room is dark; the hot point writes each line on the wall in light, word by word as
 * it's sung. Verse: the lamp strikes on (ANOTHER MORNING) and every word is a stone object.
 * Ends on the shelf (I'M CARRYING SO MUCH WEIGHT).
 */
export const S1_END = 35.3;
const G = 22;
const WALL_Z = -0.62;
const WZ = WALL_Z + 0.025; // writing plane
const IX = [0, 2.6, 5.2, 7.8, 10.4, 13.0]; // intro stations (lines 0..5)
const X6 = 16.2, X7 = 17.3, X8 = 18.6, X9 = 20.2, X10 = 21.9, XS = 24.6;
const LAMP = 21.2;
const L = (li: number) => LINES[li].words;

// ---------------------------------------------------------------------------------------------
// light lines (cuts, clock)
const useLine = (pts: THREE.Vector3[], width: number) =>
  useMemo(() => {
    const g = new LineGeometry();
    g.setPositions(pts.flatMap((p) => [p.x, p.y, p.z]));
    const m = new LineMaterial({ linewidth: width, worldUnits: false, transparent: true, toneMapped: false, depthWrite: false });
    m.resolution.set(W, H);
    const l = new Line2(g, m);
    l.frustumCulled = false;
    return { l, m, g, n: pts.length - 1 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width]);
const HOT = new THREE.Color(1, 0.95, 0.88).multiplyScalar(3.2), COOL = new THREE.Color("#c4b6a2").multiplyScalar(0.5);
const LineObj: React.FC<{ pts: THREE.Vector3[]; draw: number; heat: number; width?: number; o?: number; position?: [number, number, number]; rotation?: [number, number, number] }> = ({ pts, draw, heat, width = 3, o = 1, position, rotation }) => {
  const L2 = useLine(pts, width);
  L2.m.color.copy(COOL).lerp(HOT, clamp01(heat));
  L2.m.opacity = o;
  L2.g.instanceCount = Math.max(0, Math.round(L2.n * clamp01(draw)));
  if (draw <= 0) return null;
  return <primitive object={L2.l} position={position} rotation={rotation} />;
};

// ---------------------------------------------------------------------------------------------
// intro layout: each line = rows of words written on the wall at its station
type IW = { w: Word; text: string; written: Written; x: number; y: number; hero: boolean; li: number; wi: number };
const useIntro = (a: ReturnType<typeof useAssets>) =>
  useMemo(() => {
    const out: IW[] = [];
    if (!a) return out;
    const row = (li: number, wis: number[], y: number, size: number, hero = false, maxW = 1.0) => {
      const texts = wis.map((wi) => L(li)[wi].w.toUpperCase().replace(/[.,]/g, ""));
      const full = texts.join(" ");
      const s0 = Math.min(size, size * (maxW / layout(a.bebas, full, size, 0.04).width));
      const lay = layout(a.bebas, full, s0, 0.04);
      let ci = 0;
      texts.forEach((tx, k) => {
        const first = lay.letters[ci], last = lay.letters[ci + tx.length - 1];
        const cx = (first.x - first.adv / 2 + last.x + last.adv / 2) / 2;
        out.push({ w: L(li)[wis[k]], text: tx, written: writeWord(a.bebas, tx, s0, 0.04, "i"), x: IX[li] + cx, y, hero, li, wi: wis[k] });
        ci += tx.length + 1;
      });
    };
    row(0, [0], 1.55, 0.42, true);
    row(1, [0, 1, 2, 3], 2.05, 0.16); row(1, [4], 1.55, 0.62, true);
    row(2, [0, 1, 2, 3], 2.05, 0.16); row(2, [4], 1.5, 0.72, true);
    row(3, [0, 1, 2, 3], 2.05, 0.16); row(3, [4], 1.55, 0.5, true);
    row(4, [0, 1, 2], 2.3, 0.16); row(4, [3], 1.95, 0.4, true); row(4, [4], 1.42, 0.14); row(4, [5], 1.0, 0.7, true);
    row(5, [0, 1], 2.4, 0.16); row(5, [2], 1.5, 0.34, true, 0.8);
    return out;
  }, [a]);

const drawDur = (iw: IW) => (iw.hero ? Math.min(0.75, Math.max(0.3, (iw.w.e - iw.w.s) * 0.7)) : Math.min(0.35, Math.max(0.14, (iw.w.e - iw.w.s) * 0.9)));
const stopT = L(4)[5].s;

// ---------------------------------------------------------------------------------------------
export const S1: React.FC<{ t: number }> = ({ t }) => {
  const a = useAssets();
  const kit = useShelfKit(a);
  const target = useMemo(() => new THREE.Object3D(), []);
  const mats = useMemo(() => {
    if (!a) return null;
    const tints = ["#e2ded8", "#bdb6ac", "#9a938a", "#7b756e", "#5c5751"];
    return {
      wall: stoneMat(a, "#45413c", 0.4, 1.5), floor: stoneMat(a, "#6d6862", 0.5, 1.5),
      tint: tints.map((c) => stoneMat(a, c, 1.4, 0.6)), hero: stoneMat(a, "#c4b6a2", 1.5, 0.7), slab: stoneMat(a, "#8a847c", 0.9, 1.4),
      ghost: [0.5, 0.32, 0.2, 0.12].map((o) => { const m = stoneMat(a, "#c4b6a2", 1.5, 0.7); m.transparent = true; m.opacity = o; m.depthWrite = false; return m; }),
    };
  }, [a]);
  const intro = useIntro(a);
  const shards = useMemo(() => { const r = rng(61); return Array.from({ length: 40 }, () => ({ s: 0.012 + r() * 0.03, d: new THREE.Vector3((r() - 0.5) * 2.6, 0.4 + r() * 0.9, -0.4 - r() * 1.8), spin: [r() * 9, r() * 9, r() * 9] })); }, []);
  const R = 0.62;
  const circle = useMemo(() => Array.from({ length: 121 }, (_, i) => { const q = Math.PI / 2 - (i / 120) * Math.PI * 2; return new THREE.Vector3(Math.cos(q) * R, Math.sin(q) * R, 0); }), []);
  const ticks = useMemo(() => Array.from({ length: 12 }, (_, i) => { const q = (i / 12) * Math.PI * 2; return [new THREE.Vector3(Math.sin(q) * R * 0.88, Math.cos(q) * R * 0.88, 0), new THREE.Vector3(Math.sin(q) * R * 0.97, Math.cos(q) * R * 0.97, 0)]; }), []);
  if (!a || !mats || !kit) return <Full>{null}</Full>;

  // ---------- time freeze on STOP ----------
  const frozen = t >= stopT && t < L(5)[0].s;
  const tf = frozen ? stopT : t; // motes, sparks, camera drift stop dead

  // ---------- intro words ----------
  const drawOf = (iw: IW) => clamp01((t - iw.w.s) / drawDur(iw));
  const heatOf = (iw: IW) => { const d = t - (iw.w.s + drawDur(iw)); return d < 0 ? 1 : Math.max(0.12, Math.exp(-d / 1.1)); };
  let headW: THREE.Vector3 | null = null;
  const introNodes = intro.map((iw, k) => {
    const d = drawOf(iw);
    if (d <= 0) return null;
    let o = 1, heat = heatOf(iw), xf: ((i: number) => { p?: [number, number, number]; r?: [number, number, number]; o?: number }) | undefined;
    const n = iw.text.length;
    if (iw.li === 0) { // YEAH: drawn on the breath, exhaled away
      o = t < iw.w.e ? 0.35 + 0.65 * Math.min(1, vol(iw.w, t) * 1.4 + 0.3) : Math.max(0, 1 - (t - iw.w.e) / 0.8);
    }
    if (iw.li === 1 && iw.hero) { // TIRED: the letters slump over the held note
      const s = sungAmount(iw.w, t) * (t > iw.w.e ? 1 : 1);
      xf = (i) => { const c = (i - (n - 1) / 2) / ((n - 1) / 2); return { p: [c * s * 0.03, -s * (0.08 * (1 - c * c) + 0.03 * Math.abs(c)), 0], r: [0, 0, -c * s * 0.32] }; };
    }
    if (iw.li === 2 && iw.hero) { // QUIT: cut through, halves pushed apart a hair
      const cut = clamp01((t - (iw.w.e - 0.55)) / 0.12);
      xf = (i) => ({ p: [(i < n / 2 ? -1 : 1) * cut * 0.025, (i < n / 2 ? 1 : -1) * cut * 0.012, 0] });
    }
    if (iw.li === 3 && iw.hero) { // DISAPPEAR: thins away letter by letter, comes back as a ghost
      const u = clamp01((t - (iw.w.s + 0.6)) / 1.4), back = clamp01((t - (iw.w.e - 0.1)) / 0.5);
      xf = (i) => ({ o: Math.max(back * 0.22, 1 - clamp01(u * (n + 1) - i)) });
    }
    if (iw.li === 4 && iw.hero && iw.wi === 5) { // STOP: slammed on, all at once
      heat = t < stopT + 0.08 ? 1 : frozen ? 1 : heat;
    }
    // EVERYTHING: every line written so far warms up again for the pull-back
    const ev = L(4)[3];
    if (t > ev.s && t < stopT) heat = Math.max(heat, 0.6 * clamp01((t - ev.s) / 0.5) * (1 - clamp01((t - (stopT - 0.3)) / 0.3)));
    if (t > LAMP + 0.5) { o *= Math.max(0.35, 1 - (t - LAMP - 0.5) / 1.2); heat = Math.min(heat, 0.12); }
    const dd = iw.li === 4 && iw.wi === 5 ? clamp01((t - stopT) / 0.06) : d;
    if (dd < 1 || (iw.w.s <= t && t < iw.w.s + drawDur(iw) + 0.05)) headW = headOf(iw.written, dd).add(new THREE.Vector3(iw.x, iw.y, WZ));
    return <LightWord key={k} w={iw.written} draw={dd} heat={heat} o={o} width={iw.hero ? 3.4 : 2.2} position={[iw.x, iw.y, WZ]} xf={xf} />;
  });
  // the cut through QUIT
  const quit = intro.find((iw) => iw.li === 2 && iw.hero)!;
  const qw = quit.written.width, qc = quit.written.cap;
  const cutPts = [new THREE.Vector3(-qw * 0.62, qc * 0.75, 0.004), new THREE.Vector3(qw * 0.62, -qc * 0.75, 0.004)];
  const cutDraw = clamp01((t - (quit.w.e - 0.55)) / 0.12);
  // the clock around MINUTE
  const minute = intro.find((iw) => iw.li === 5 && iw.hero)!;
  const clockT0 = minute.w.s;
  const circDraw = clamp01((t - clockT0) / 0.6);
  const beatsSince = T.beats.filter((b) => b > clockT0 + 0.3 && b <= t).length;
  const handA = -beatsSince * (Math.PI / 30) - (frozen ? 0 : 0);
  if (circDraw > 0 && circDraw < 1) headW = circle[Math.floor(circDraw * 120)].clone().add(new THREE.Vector3(minute.x, minute.y, WZ));

  // ---------- verse objects ----------
  const drop = (s: number, rest: number, h = 0.45) => {
    const fall = Math.sqrt((2 * h) / G);
    if (t < s - fall) return null;
    if (t < s) { const u = s - t; return rest + 0.5 * G * u * u; }
    const d = t - s;
    return rest + Math.abs(Math.sin(d * 24)) * 0.025 * Math.exp(-d * 12);
  };
  const word = (key: string, text: string, size: number, mat: THREE.Material, x: number, y: number | null, z: number, extra?: { r?: [number, number, number]; s?: [number, number, number]; depth?: number }) =>
    y === null ? null : (
      <group key={key} position={[x, y, z]} rotation={extra?.r} scale={extra?.s}>
        <Letters font={a.bebas} family="bebas" text={text} size={size} depth={extra?.depth ?? size * 0.32} material={mat} tracking={0.03} bevel={0.022} />
      </group>
    );
  const cap = (s: number) => capHeight(a.bebas, s);
  const V: React.ReactNode[] = [];
  if (t > LAMP - 0.4) {
    const l6 = L(6), l7 = L(7), l8 = L(8), l9 = L(9), l10 = L(10), l11 = L(11);
    // L6: ANOTHER stands in the dark; MORNING rises like the sun as the lamp comes up
    V.push(word("another", "ANOTHER", 0.2, mats.tint[1], X6 - 0.2, drop(l6[0].s, cap(0.2) / 2), -0.35));
    const rise = cubicOut(clamp01((t - l6[1].s) / 0.55));
    if (t >= l6[1].s - 0.05) V.push(<group key="morning" position={[X6 + 0.05, 0, 0.12]} rotation={[mix(-Math.PI / 2, 0, rise), 0, 0]}><group position={[0, cap(0.3) / 2, 0]}><Letters font={a.bebas} family="bebas" text="MORNING" size={0.3} depth={0.12} material={mats.tint[0]} tracking={0.03} /></group></group>);
    // SAME x3: stamps, each greyer
    V.push(word("same1", "SAME", 0.13, mats.tint[2], X7 - 0.62, drop(l6[2].s, cap(0.13) / 2, 0.6), -0.1));
    V.push(word("same2", "SAME", 0.13, mats.tint[3], X7 - 0.62, drop(l7[0].s, cap(0.13) / 2 + cap(0.13) + 0.004, 0.6), -0.1));
    V.push(word("same3", "SAME", 0.13, mats.tint[4], X7 - 0.62, drop(l8[0].s, cap(0.13) / 2 + 2 * (cap(0.13) + 0.004), 0.6), -0.1));
    // CEILING slab drops into frame, then presses PRESSURE flat
    const pCap = cap(0.3);
    const sq = cubicOut(clamp01((t - (l7[1].s + 0.25)) / 0.3));
    const pSY = mix(1, 0.6, sq), pSX = mix(1, 1.16, sq);
    const slabH = 0.26;
    let slabY = 3.6;
    const sIn = l6[3].s;
    if (t >= sIn - 0.3) slabY = Math.max(2.2, 3.6 - 0.5 * G * Math.pow(Math.max(0, t - (sIn - 0.3)), 2));
    if (t >= sIn && t < sIn + 0.2) slabY = 2.2 + Math.abs(Math.sin((t - sIn) * 30)) * 0.03 * Math.exp(-(t - sIn) * 12);
    if (t >= l7[1].s) { const u = cubicIn(clamp01((t - l7[1].s) / 0.25)); slabY = mix(2.2, pCap * pSY + slabH / 2, u); }
    const kickPush = t >= l7[1].s ? Math.min(0.02, Math.exp(-((t - T.kicks.filter((k) => k.t <= t).slice(-1)[0]?.t) || 9) * 10) * 0.02) : 0;
    if (t >= sIn - 0.3) V.push(
      <group key="slab" position={[X7 + 0.12, slabY - kickPush, -0.12]}>
        <mesh material={mats.slab} castShadow receiveShadow><boxGeometry args={[1.5, slabH, 0.42]} /></mesh>
        <group position={[0, 0, 0.215]}><Letters font={a.bebas} family="bebas" text="CEILING" size={0.15} depth={0.02} material={mats.tint[1]} tracking={0.12} bevel={0.008} /></group>
      </group>,
    );
    if (t >= l7[1].s - 0.2) V.push(<group key="pressure" position={[X7 + 0.12, pCap * pSY / 2, 0.05]} scale={[pSX, pSY, 1]}><Letters font={a.bebas} family="bebas" text="PRESSURE" size={0.3} depth={0.3} material={mats.hero} tracking={0.02} /></group>);
    ["ON", "MY", "CHEST"].forEach((tx, i) => V.push(word("omc" + i, tx, 0.1, mats.tint[0], X7 - 0.1 + i * 0.17 + (i === 2 ? 0.04 : 0), drop(l7[2 + i].s, cap(0.1) * 0.35, 0.25), 0.55, { s: [1.1, 0.7, 1] })));
    // L8: PEOPLE TELLING ME stamped across the wall, a crowd of voices; BLESSED echoes
    const crowd: [number, number][] = [[-0.45, 2.05], [0.25, 2.2], [0.55, 1.75], [-0.2, 1.62], [-0.6, 1.3], [0.45, 1.32]];
    [1, 2, 3].forEach((wi, k) => {
      const w = l8[wi];
      crowd.forEach(([cx, cy], c) => {
        if ((c + k) % 2) return;
        const s0 = w.s + c * 0.035;
        if (t < s0) return;
        const pop = cubicOut(clamp01((t - s0) / 0.12));
        V.push(<group key={`crowd${k}-${c}`} position={[X8 + cx + k * 0.08, cy - k * 0.1, WALL_Z + 0.01 + 0.02 * pop]}><Letters font={a.bebas} family="bebas" text={w.w.toUpperCase()} size={0.11} depth={0.03} material={mats.tint[1 + ((c + k) % 3)]} tracking={0.05} bevel={0.006} shadows={false} /></group>);
      });
    });
    V.push(word("im8", "I'M", 0.12, mats.tint[1], X8 + 0.0, drop(l8[4].s, cap(0.12) / 2, 0.3), 0.35));
    if (t >= l8[5].s) {
      V.push(<group key="blessed" position={[X8 + 0.05, 0.98, WALL_Z + 0.04]}><Letters font={a.bebas} family="bebas" text="BLESSED" size={0.32} depth={0.06} material={mats.hero} tracking={0.03} /></group>);
      mats.ghost.forEach((gm, k) => {
        const e = cubicOut(clamp01((t - l8[5].s - 0.05 * (k + 1)) / 0.5));
        if (e <= 0) return;
        V.push(<group key={"echo" + k} position={[X8 + 0.05, 0.98 + e * 0.02 * k, WALL_Z + 0.06 + e * 0.12 * (k + 1)]} scale={1 + e * 0.13 * (k + 1)}><Letters font={a.bebas} family="bebas" text="BLESSED" size={0.32} depth={0.02} material={gm} tracking={0.03} shadows={false} /></group>);
      });
    }
    // L9: WHILE I'M STRUGGLING TO, then REST lies down, stretches, can't stay down
    const rowX = (texts: string[], size: number, gap = 0.05) => { const ws = texts.map((x) => layout(a.bebas, x, size, 0.03).width); const tot = ws.reduce((p, q) => p + q, 0) + gap * (ws.length - 1); let x = -tot / 2; return ws.map((w) => { const c = x + w / 2; x += w + gap; return c; }); };
    const xs9 = rowX(["WHILE", "I'M", "STRUGGLING", "TO"], 0.13);
    ["WHILE", "I'M", "STRUGGLING", "TO"].forEach((tx, i) => {
      const xs = xs9;
      const y = drop(l9[i].s, cap(0.13) / 2, 0.3);
      if (y === null) return;
      const shake = i === 2 && t > l9[2].s ? Math.sin(t * 47) * 0.04 * Math.exp(-(t - l9[2].s) * 0.6) : 0;
      V.push(<group key={"l9" + i} position={[X9 + xs[i], y, -0.3]} rotation={[0, 0, shake]}><Letters font={a.bebas} family="bebas" text={tx} size={0.13} depth={0.05} material={mats.tint[1 + (i % 3)]} tracking={0.03} xf={i === 2 ? (li, x) => ({ p: [x, Math.sin(t * 31 + li * 2) * 0.008 * (t > l9[2].s ? 1 : 0), 0], r: [0, 0, Math.sin(t * 23 + li) * 0.08 * (t > l9[2].s ? 1 : 0)] }) : undefined} /></group>);
    });
    if (t >= l9[4].s - 0.2) {
      const w = l9[4];
      const tip = cubicIn(clamp01((t - (w.s + 0.08)) / 0.32));
      const stretch = sungAmount(w, t);
      const back = t > l10[0].s - 0.05 ? cubicOut(clamp01((t - (l10[0].s - 0.05)) / 0.18)) : 0;
      const lie = tip * (1 - back);
      const c = cap(0.42);
      V.push(
        <group key="rest" position={[X9, drop(w.s, 0, 0.35) ?? 0, 0.2]} rotation={[-lie * (Math.PI / 2 - 0.02), 0, 0]}>
          <group position={[0, c / 2, 0]} scale={[1 + stretch * 0.7 * (1 - back), 1, 1]}><Letters font={a.bebas} family="bebas" text="REST" size={0.42} depth={0.14} material={mats.hero} tracking={0.03} /></group>
        </group>,
      );
    }
    // L10/11: EVERYBODY multiplies on the beat into a crowd; PIECE is taken apart; TIME torn into wedges
    const beats = T.beats.filter((b) => b >= l10[0].s - 0.02 && b < XS);
    const counts = [1, 2, 4, 8, 16, 24, 36, 48, 64];
    const nb = beats.filter((b) => b <= t).length;
    const n = t < l10[0].s ? 0 : counts[Math.min(counts.length - 1, Math.max(0, nb - 1) + (t >= l11[0].s ? 2 : 0))];
    const eW = layout(a.bebas, "EVERYBODY", 0.13, 0.03).width;
    const slots: [number, number][] = [];
    for (let r = 0; r < 12; r++) for (let c = -3; c <= 3; c++) slots.push([c * (eW + 0.05) + (r % 2) * 0.15, 0.1 - r * 0.24]);
    slots.sort((p, q) => Math.hypot(p[0], (p[1] - 0.1) * 1.6) - Math.hypot(q[0], (q[1] - 0.1) * 1.6)); // the crowd grows outward from the middle
    for (let i = 0; i < n; i++) {
      const born = i === 0 ? l10[0].s : beats[Math.max(0, Math.floor(Math.log2(i + 1)) - 1)] ?? l10[0].s;
      const y = drop(born + (i % 5) * 0.02, cap(0.13) / 2, 0.25);
      if (y === null) continue;
      V.push(<group key={"eb" + i} position={[X10 + slots[i][0] - 0.1, y, slots[i][1]]}><Letters font={a.bebas} family="bebas" text="EVERYBODY" size={0.13} depth={0.04} material={mats.tint[1 + (i % 4)]} tracking={0.03} shadows={i < 16} /></group>);
    }
    ["NEEDS", "A"].forEach((tx, i) => V.push(word("na" + i, tx, 0.12, mats.tint[0], X10 - 0.5 + i * 0.3, drop(l10[1 + i].s, cap(0.12) / 2, 0.3), 0.45)));
    const pcs = l10[3];
    const breakT = pcs.s + 0.16;
    if (t >= pcs.s - 0.2 && t < breakT) V.push(word("piece", "PIECE", 0.3, mats.hero, X10 + 0.1, drop(pcs.s, cap(0.3) / 2, 0.4), 0.4));
    if (t >= breakT) shards.forEach((sh, i) => {
      const d = t - breakT, u = cubicInOut(clamp01(d / 0.7));
      const p0 = new THREE.Vector3(X10 + 0.1 + (i / 40 - 0.5) * 0.55, cap(0.3) * (0.2 + (i % 5) * 0.15), 0.4);
      const p1 = new THREE.Vector3(X10 - 0.1 + slots[i % Math.max(1, n)][0], 0.06, slots[i % Math.max(1, n)][1]);
      const p = p0.clone().lerp(p1, u); p.y += Math.sin(u * Math.PI) * sh.d.y * 0.6;
      V.push(<mesh key={"sh" + i} position={p} rotation={[sh.spin[0] * u, sh.spin[1] * u, sh.spin[2] * u]} material={mats.hero} castShadow><tetrahedronGeometry args={[sh.s, 0]} /></mesh>);
    });
    ["OF", "ME"].forEach((tx, i) => V.push(word("ofme" + i, tx, 0.07, mats.tint[0], X10 + 0.02 + i * 0.12, drop(l10[4 + i].s, cap(0.07) / 2, 0.2), 0.62)));
    ["WANTS", "MY"].forEach((tx, i) => V.push(word("wm" + i, tx, 0.12, mats.tint[0], X10 - 0.45 + i * 0.32, drop(l11[1 + i].s, cap(0.12) / 2, 0.3), 0.55)));
    const tm = l11[3];
    if (t >= tm.s - 0.25) {
      const tear = cubicIn(clamp01((t - (tm.s + 0.18)) / 0.35));
      const dy = drop(tm.s, 0.27, 0.5) ?? 0.27;
      V.push(
        <group key="time" position={[X10 + 0.32, dy, 0.32]}>
          {Array.from({ length: 6 }, (_, k) => {
            const ang = (k + 0.5) * (Math.PI / 3);
            return (
              <group key={k} position={[Math.sin(ang) * tear * 1.2, Math.cos(ang) * tear * 0.6 - tear * tear * 0.8, -tear * 0.8]} rotation={[0, 0, tear * (k % 2 ? 1 : -1) * 1.2]}>
                <mesh rotation={[Math.PI / 2, 0, 0]} material={mats.slab} castShadow><cylinderGeometry args={[0.26, 0.26, 0.06, 16, 1, false, k * (Math.PI / 3), Math.PI / 3]} /></mesh>
              </group>
            );
          })}
          <group position={[0, 0, 0.035]} scale={1 - tear}><Letters font={a.bebas} family="bebas" text="TIME" size={0.15} depth={0.03} material={mats.hero} tracking={0.05} /></group>
        </group>,
      );
    }
  }

  // ---------- camera ----------
  const sh = shelfFrame(a, kit, t, false);
  type K = [number, number, number, number, number]; // t, x, y, dist, lookY
  const KS: K[] = [
    [0, IX[0], 1.55, 3.2, 1.55], [L(1)[0].s, IX[1], 1.75, 3.0, 1.75], [L(2)[0].s, IX[2], 1.72, 3.0, 1.7], [L(3)[0].s, IX[3], 1.75, 3.0, 1.75],
    [L(4)[0].s, IX[4], 1.95, 3.0, 2.0], [L(4)[3].s + 0.4, IX[4], 1.9, 3.1, 1.9], [L(4)[3].s + 1.4, 6.6, 1.7, 14, 1.6], [stopT - 0.35, 6.6, 1.7, 14, 1.6],
    [stopT - 0.02, IX[4], 1.2, 2.6, 1.15], [L(5)[0].s, IX[5], 1.8, 3.2, 1.75], [LAMP, IX[5], 1.75, 3.3, 1.65],
    [LAMP + 0.8, X6 - 0.05, 0.85, 3.2, 0.45], [L(6)[2].s, X7 - 0.1, 1.2, 3.4, 1.0], [L(6)[3].s + 0.15, X7, 1.45, 3.5, 1.55], [L(7)[1].s + 0.1, X7 + 0.1, 0.95, 3.3, 0.45], [L(7)[4].s, X7 + 0.1, 0.8, 3.0, 0.35],
    [L(8)[0].s, X8, 1.25, 3.3, 1.3], [L(9)[0].s, X9, 1.35, 2.9, 0.15], [L(10)[0].s, X10, 1.3, 2.6, 0.0], [L(11)[0].s, X10 + 0.05, 1.6, 3.1, -0.1],
  ];
  let cx = KS[0][1], cy = KS[0][2], cd = KS[0][3], ly = KS[0][4];
  for (let i = 1; i < KS.length; i++) {
    const [tk, x, y, d, l] = KS[i];
    const span = Math.min(tk < LAMP ? 0.32 : 0.5, tk - KS[i - 1][0]);
    const u = cubicInOut(clamp01((t - (tk < LAMP ? tk - span : tk - 0.12)) / span));
    cx = mix(cx, x, u); cy = mix(cy, y, u); cd = mix(cd, d, u); ly = mix(ly, l, u);
  }
  // hand-off into the shelf camera
  const toShelf = cubicInOut(clamp01((t - (L(12)[0].s - 0.5)) / 0.5));
  const drift = frozen ? 0 : 1;
  let cam: [number, number, number] = [cx + (noise1(tf * 0.4, 1) - 0.5) * 0.06 * drift, cy + (noise1(tf * 0.33, 2) - 0.5) * 0.04 * drift, WALL_Z + cd];
  let look: [number, number, number] = [cx, ly, WALL_Z];
  let focus = cd, roll = 0;
  if (toShelf > 0) {
    const sc: [number, number, number] = [sh.cam[0] + XS, sh.cam[1], sh.cam[2]];
    const sl: [number, number, number] = [sh.look[0] + XS, sh.look[1], sh.look[2]];
    cam = cam.map((v, i) => mix(v, sc[i], toShelf)) as [number, number, number];
    look = look.map((v, i) => mix(v, sl[i], toShelf)) as [number, number, number];
    focus = mix(focus, sh.focus, toShelf); roll = sh.roll * toShelf;
  }
  // ---------- light ----------
  const strike = [0, 0.08, 0.16, 0.24, 0.34];
  const lampOn = t < LAMP ? 0 : (() => { const d = t - LAMP; const k = strike.filter((s) => s <= d).length; return d > 0.34 ? 1 : k % 2 ? 0.85 : 0.08; })();
  target.position.set(cam[0] - 0.1, 0.6, -0.2);
  const flash = t >= stopT && t < stopT + 0.25 ? Math.exp(-(t - stopT) * 18) : 0;
  return (
    <Full>
      <Stage cam={{ pos: cam, look, fov: 42, roll }}
        look={{ exposure: 1.05, env: 0.12 * Math.max(0.15, lampOn), bloom: { strength: 0.55 + flash * 0.8, radius: 0.55, threshold: 0.8 }, bg: "#030303", dof: { focus, aperture: 0.0016, maxblur: 0.005 } }}>
        <primitive object={target} />
        <spotLight position={[cam[0] + 0.3, 4.4, 1.6]} target={target} angle={0.46} penumbra={0.75} intensity={300 * lampOn} decay={2} color="#fff1df" castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0003} />
        <pointLight position={[cam[0] - 2.4, 1.8, 2]} intensity={5 * lampOn} color="#8fa0b0" decay={2} />
        <pointLight position={[cam[0] + 0.6, 0.5, 2.4]} intensity={1.2 * lampOn} color="#e8dfd2" decay={2} />
        <ambientLight intensity={0.012} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[20, 0, 0]} receiveShadow material={mats.floor}><planeGeometry args={[80, 30]} /></mesh>
        <mesh position={[20, 6, WALL_Z]} receiveShadow material={mats.wall}><planeGeometry args={[80, 14]} /></mesh>
        {introNodes}
        <group position={[quit.x, quit.y, WZ]}><LineObj pts={cutPts} draw={cutDraw} heat={t > LAMP ? 0.1 : Math.max(0.15, Math.exp(-(t - quit.w.e) / 1.1))} width={3} o={t > LAMP + 0.5 ? 0.4 : 1} /></group>
        <group position={[minute.x, minute.y, WZ]} rotation={[0, 0, 0]}>
          <LineObj pts={circle} draw={circDraw} heat={t < clockT0 + 0.8 ? 1 : 0.45} width={2.6} o={t > LAMP + 0.5 ? 0.4 : 1} />
          {ticks.map((tk, i) => <LineObj key={i} pts={tk} draw={clamp01((t - clockT0 - 0.5 - i * 0.025) / 0.05)} heat={0.5} width={2} o={t > LAMP + 0.5 ? 0.4 : 0.9} />)}
          <LineObj pts={[new THREE.Vector3(0, 0, 0.002), new THREE.Vector3(Math.sin(-handA) * R * 0.8, Math.cos(-handA) * R * 0.8, 0.002)]} draw={clamp01((t - clockT0 - 0.6) / 0.1)} heat={0.9} width={2.4} o={t > LAMP + 0.5 ? 0.4 : 1} />
        </group>
        <HotPoint3D p={headW ?? new THREE.Vector3(cam[0], 1.5, WZ)} t={tf} light={1.8} o={headW && t < LAMP ? 1 : 0} />
        {V}
        <group position={[XS, 0, 0]}>{t > L(11)[0].s ? sh.nodes : null}</group>
        <group position={[cam[0], 0, 0]}><Motes t={tf} /></group>
      </Stage>
      <Finish grain={0.09} />
    </Full>
  );
};

export const Section1: React.FC<{ t: number; muted?: boolean }> = ({ t }) => <S1 t={t} />;
export const AudioTrack: React.FC = () => <Audio src={staticFile("audio/drift.m4a")} />;
