import React, { useMemo } from "react";
import * as THREE from "three";
import { AbsoluteFill } from "remotion";
import { useAssets } from "../three/assets";
import { LINES, SECTIONS, T, heroOf } from "../data";
import { clamp01, cubicInOut } from "../utils/ease";
import { rng } from "../utils/random";
import { Glow } from "../words/points";
import { layout } from "../words/glyphs";
import { Beh, CamKey, clean, heat, makeCamera } from "./core";
import { Earth, Sky, WStyle, Word3D, fontFor, layLine } from "./world";
import { FilmStage } from "./film/FilmStage";
import { FilmLook, SECTION_LOOK, VOID, mixLook } from "./film/looks";
import { KeySpot, WetFloor } from "./film/env";
import { drift, orbitAround, springK } from "./film/camera";

/**
 * Drift v2 — full-song skeleton (verse 2 → outro, 1:31.8–4:24) on the film pipeline.
 * Until the bespoke scenes for these acts are built (capsule projections, the bridge power-down, the return home),
 * every line is staged by one rule set so the whole song plays end to end in the right world:
 *  - each section takes its look (CAGE / VOID / MONOLITH) and grades into the next over 1.5 s;
 *  - every line is a block of physical type: the line's hero word big on its own row, the rest small above it;
 *    in the cage/monolith it stands on a wet concrete floor under an overhead key, in the void it floats as crystal;
 *  - lines march away from the camera; when a hero word has a counter (O, D, Q, A, P, R, B) the camera flies
 *    through it into the next block (Z fly-through), otherwise it glides past it;
 *  - held hero words (sustains) get a 90° sprung orbit hold;
 *  - a floating-rig drift rides on everything.
 */
export const SK_START = 91.8;
const STEP = 7; // metres between line blocks
type Block = { li: number; o: THREE.Vector3; rows: number[][]; sizes: number[]; hero: number; style: WStyle; crystal: number; floor: boolean; beh: Record<number, Beh>; side: number; hole?: THREE.Vector3; held: boolean };

const lookAt = (t: number): FilmLook => {
  const i = SECTIONS.findIndex((s) => t >= s.start && t < s.end);
  const s = SECTIONS[Math.max(0, i)];
  const cur = SECTION_LOOK[s?.id] ?? VOID;
  const prevS = SECTIONS[i - 1];
  const prev = prevS ? SECTION_LOOK[prevS.id] ?? cur : cur;
  return mixLook(prev, cur, clamp01((t - (s?.start ?? 0) + 0.3) / 1.5));
};

export const Skeleton: React.FC<{ t: number }> = ({ t }) => {
  const a = useAssets();
  const stars = useMemo(() => {
    const r = rng(77), n = 7000, g = new THREE.BufferGeometry(), pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const u = r() * 2 - 1, q = r() * Math.PI * 2, rad = 400 + r() * 800, c = Math.sqrt(1 - u * u); pos.set([Math.cos(q) * c * rad, u * rad, Math.sin(q) * c * rad], i * 3); }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("seed", new THREE.BufferAttribute(new Float32Array(n).map(() => r()), 1));
    g.setAttribute("bright", new THREE.BufferAttribute(new Float32Array(n).map(() => Math.pow(r(), 5) * 2 + 0.1), 1));
    return g;
  }, []);
  const blocks = useMemo<Block[]>(() => {
    if (!a) return [];
    const out: Block[] = [];
    LINES.forEach((L, li) => {
      if (L.words[0].s < SK_START - 0.2) return;
      const look = SECTION_LOOK[L.section] ?? VOID;
      const crystal = look.crystal > 0.5 ? 1 : 0;
      const style: WStyle = crystal ? "drift" : "city";
      const font = fontFor(a, style);
      const h = heroOf(li), hero = Math.max(0, L.words.indexOf(h));
      const before = L.words.map((_, i) => i).filter((i) => i < hero), after = L.words.map((_, i) => i).filter((i) => i > hero);
      const rows = [before, [hero], after].filter((r) => r.length);
      const heroSize = Math.min(0.95, 3.4 / Math.max(3, clean(h.w).length));
      const sizes = rows.map((r) => (r.includes(hero) ? heroSize : 0.17));
      const k = out.length, side = k % 2 ? 1 : -1;
      const lay = layLine(font, li, rows, sizes);
      const floor = !crystal;
      const o = new THREE.Vector3(side * 0.9, floor ? lay.height / 2 + 0.02 : 1.4, -k * STEP);
      const held = h.e - h.s > 0.9;
      const beh: Record<number, Beh> = { [hero]: held ? "stretch" : crystal ? "float" : "stamp" };
      if (L.section === "breakdown") beh[hero] = "dissolve";
      // a counter to fly through: O, D, Q first, then A, P, R, B
      const word = clean(h.w);
      let ci = -1;
      for (const set of ["OQD", "APRB"]) { if (ci < 0) ci = [...word].findIndex((c) => set.includes(c)); }
      let hole: THREE.Vector3 | undefined;
      if (ci >= 0) {
        const w = lay.words.find((x) => x.wi === hero)!;
        const lx = layout(font, word, w.size, 0.04).letters[ci].x;
        hole = o.clone().add(new THREE.Vector3(w.x + lx, w.y + (/[AP R]/.test(word[ci]) ? w.size * 0.12 : 0), 0));
      }
      out.push({ li, o, rows, sizes, hero, style, crystal, floor, beh, side, hole, held });
    });
    return out;
  }, [a]);
  const cam = useMemo(() => {
    const keys: CamKey[] = [];
    blocks.forEach((b, k) => {
      const L = LINES[b.li], s = L.words[0].s, e = L.words[L.words.length - 1].e;
      const nx = blocks[k + 1] ? LINES[blocks[k + 1].li].words[0].s : e + 2;
      const eye = b.floor ? 0.9 : 1.55;
      const p0 = b.o.clone().add(new THREE.Vector3(-b.side * 0.3, eye - b.o.y + (b.floor ? 0 : b.o.y - 1.4), 2.3));
      const p1 = p0.clone().add(new THREE.Vector3(0, -0.05, -0.55));
      keys.push({ t: s - 0.35, p: p0.toArray() as [number, number, number], l: b.o.toArray() as [number, number, number], f: 44 });
      keys.push({ t: Math.max(s - 0.2, Math.min(e + 0.2, nx - 1.0)), p: p1.toArray() as [number, number, number], l: b.o.toArray() as [number, number, number], f: 42 });
      if (b.hole && nx - e > 0.5) {
        const tp = Math.min(nx - 0.45, Math.max(e + 0.1, nx - 0.7));
        keys.push({ t: tp, p: b.hole.toArray() as [number, number, number], l: b.hole.clone().add(new THREE.Vector3(0, 0, -3)).toArray() as [number, number, number], f: 58 });
      }
    });
    keys.sort((x, y) => x.t - y.t);
    for (let i = 1; i < keys.length; i++) if (keys[i].t <= keys[i - 1].t) keys[i].t = keys[i - 1].t + 0.05;
    return keys.length > 1 ? makeCamera(keys, 0.22) : null;
  }, [blocks]);
  if (!a || !cam) return <AbsoluteFill style={{ background: "#000" }} />;

  const look = lookAt(t);
  const c = cam(t);
  let camP = c.p.clone().add(drift(t, 0.04)), camL = c.l.clone().add(drift(t + 40, 0.015)), fov = c.f;
  // current block
  let cur = 0;
  blocks.forEach((b, k) => { if (t >= LINES[b.li].words[0].s - 0.4) cur = k; });
  const B = blocks[cur];
  // orbit hold on a sustained hero word
  if (B.held) {
    const h = LINES[B.li].words[B.hero];
    const win = cubicInOut(clamp01((t - h.s + 0.2) / 0.4)) * (1 - cubicInOut(clamp01((t - h.e - 0.1) / 0.6)));
    if (win > 0) {
      const yaw = -B.side * Math.PI * 0.5 * springK(t, h.s, { damping: 26, mass: 2, stiffness: 45 });
      const op = orbitAround(B.o, yaw, 2.4, B.floor ? 0.6 - B.o.y + 0.3 : 0.15);
      camP = camP.lerp(op, win); camL = camL.lerp(B.o, win); fov = fov + (44 - fov) * win;
    }
  }
  const focus = camP.distanceTo(B.o);
  const crystalNow = look.crystal;
  const floorOn = crystalNow < 0.5;
  // build visible blocks (the current, the previous fading, the next appearing far down the corridor)
  const els: React.ReactNode[] = [];
  blocks.forEach((b, k) => {
    if (k < cur - 1 || k > cur + 1) return;
    const L = LINES[b.li], s = L.words[0].s, e = L.words[L.words.length - 1].e;
    const nx = blocks[k + 1] ? LINES[blocks[k + 1].li].words[0].s : e + 3;
    const fade = clamp01((t - (s - 1.2)) / 0.8) * (1 - clamp01((t - nx - 0.2) / 0.6));
    if (fade <= 0) return;
    const font = fontFor(a, b.style);
    const lay = layLine(font, b.li, b.rows, b.sizes);
    els.push(
      <group key={b.li} position={b.o.toArray() as [number, number, number]}>
        {lay.words.map((w) => <Word3D key={w.wi} font={font} li={b.li} wi={w.wi} t={t} size={w.size} style={b.style} crystal={b.crystal} beh={b.beh[w.wi]} pos={[w.x, w.y, 0]} depth={b.crystal ? 0.2 : 0.32} fade={fade} />)}
      </group>,
    );
  });
  const lineHeat = LINES[B.li].words.reduce((m, w) => Math.max(m, heat(t, w)), 0);
  const sec = SECTIONS.find((s) => t >= s.start && t < s.end)?.id ?? "";
  const red = sec === "bridge" || sec === "breakdown";
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <FilmStage cam={{ pos: camP, look: camL, fov, near: 0.05, far: 6000 }} look={look} focus={focus}>
        {floorOn ? (
          <>
            <group position={[0, 0, Math.round(camP.z / 10) * 10]}><WetFloor size={60} /></group>
            <KeySpot target={B.o} intensity={red ? 60 : 85} ceiling={6} dist={4.5} angle={0.4} color={red ? "#ffd2c8" : sec === "outro" ? "#dfe8ff" : "#eef1f6"} />
            {red ? <pointLight position={[B.o.x - 2, 2.2, B.o.z - 1.5]} intensity={(6 + 6 * Math.max(0, Math.sin(t * Math.PI * 2 * 0.7))) * (sec === "breakdown" ? 0.5 : 1)} distance={9} color="#d2382b" /> : null}
            {sec === "outro" ? <directionalLight position={[-4, 3, -10]} intensity={0.6} color="#ffb066" /> : null}
          </>
        ) : (
          <>
            <Sky alt={1} />
            <group position={[camP.x, camP.y - 1000, camP.z]}><Glow geo={stars} size={30} gain={1 - crystalNow * 0} time={t} twinkle={0.3} position={[0, 1000, 0]} /></group>
            <Earth center={[0, -20600, camP.z]} R={20000} o={1} />
            <hemisphereLight intensity={0.35} color="#3a3a8a" groundColor="#2a1a10" />
            <directionalLight position={[300, 200, -800]} intensity={1.4} color="#ffb066" />
            <pointLight position={B.o.clone().add(new THREE.Vector3(0, 0.4, 1.2)).toArray() as [number, number, number]} intensity={1.2 * lineHeat} distance={6} color="#ffb066" />
          </>
        )}
        {els}
      </FilmStage>
    </AbsoluteFill>
  );
};
export const _sk = [T];
