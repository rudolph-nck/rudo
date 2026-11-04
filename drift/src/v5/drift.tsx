import React, { useMemo } from "react";
import * as THREE from "three";
import { AbsoluteFill } from "remotion";
import { Font } from "three/examples/jsm/loaders/FontLoader.js";
import { useAssets } from "../three/assets";
import { LINES, T } from "../data";
import { clamp01, cubicOut } from "../utils/ease";
import { rng } from "../utils/random";
import { FilmStage } from "../v4/film/FilmStage";
import { FilmLook } from "../v4/film/looks";
import { BEATS, camAt, capHeight, counterOf, flatGlyph, flatMat, layout, pathAt, viewPoint } from "./kit";

/**
 * DRIFT v3 — Act 1 test (0:00–1:31.8): flat white typography in an infinite black void, one continuous camera.
 *  I   The Input Terminal (0:00–0:23)  fixed camera; a box cursor; lyrics typed inside a thin green frame; on STOP the
 *      cursor freezes solid and the frame flashes once.
 *  II  The Vertical System Crush (0:23–0:53)  the frame vanishes; green data tokens; the camera drops through a pillar
 *      of giant stacked words; STRUGGLING TO REST locks the frame, REST falls like a stone, the camera dives after it;
 *      on "when the darkness starts to call" it plummets into the void.
 *  III The System Fracture (0:53–0:57)  the plummet eases to a halt; slow forward crawl; clean centred lines in thin
 *      outline frames; BREAK in a crimson frame fractures on the hit.
 *  IV  The Celestial Horizon (0:57–1:32)  an endless forward glide through a celestial network; huge razor-thin words
 *      hang in the path; the camera flies straight through the counter of the D in DRIFT.
 */
export const V3_END = 91.8;
const GREEN = "#3dff8a", WHITE = "#ffffff", CRIMSON = "#e0283a";
const sm = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
const ramp = (t: number, t0: number, d: number) => sm((t - t0) / d);
const W = (li: number, wi: number) => LINES[li].words[wi];
const L0 = (li: number) => LINES[li].words[0].s;
const LE = (li: number) => LINES[li].words[LINES[li].words.length - 1].e;
const up = (s: string) => s.toUpperCase().replace(/[,!?]/g, "");
const heatOf = (t: number, w: { s: number; e: number }) => (t < w.s ? 0 : t < w.e ? 1 : Math.exp(-(t - w.e) / 0.5));

// ---------------------------------------------------------------------------------------------
type Fx = (i: number, n: number, x: number) => { dx?: number; dy?: number; s?: number; o?: number; rz?: number; k?: number; hide?: boolean };
/** A flat word/line: letters are flat vector shapes, centred on the origin (or left-aligned). */
const Flat: React.FC<{ font: Font; text: string; size: number; tracking?: number; hex?: string; k?: number; o?: number; pos?: THREE.Vector3 | [number, number, number]; left?: boolean; fx?: Fx; rz?: number }> = ({ font, text, size, tracking = 0.02, hex = WHITE, k = 1, o = 1, pos = [0, 0, 0], left, fx, rz = 0 }) => {
  if (o <= 0.003) return null;
  const lay = layout(font, text, size, tracking);
  const p = Array.isArray(pos) ? pos : (pos.toArray() as [number, number, number]);
  return (
    <group position={p} rotation={[0, 0, rz]}>
      {lay.letters.map((L, i) => {
        if (L.ch === " ") return null;
        const f = fx ? fx(i, lay.letters.length, L.x) : {};
        if (f.hide) return null;
        const oo = o * (f.o ?? 1);
        if (oo <= 0.003) return null;
        return <mesh key={i} geometry={flatGlyph(font, L.ch, size)} material={flatMat(hex, k * (f.k ?? 1), oo)} position={[(left ? L.x + lay.width / 2 : L.x) + (f.dx ?? 0), f.dy ?? 0, 0]} rotation={[0, 0, f.rz ?? 0]} scale={f.s ?? 1} />;
      })}
    </group>
  );
};
/** A hairline (flat strip). */
const Hair: React.FC<{ a: [number, number]; b: [number, number]; th: number; hex: string; k: number; o: number; z?: number }> = ({ a, b, th, hex, k, o, z = 0 }) => {
  if (o <= 0.003) return null;
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
  if (len < 1e-4) return null;
  return <mesh material={flatMat(hex, k, o)} position={[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, z]} rotation={[0, 0, Math.atan2(dy, dx)]}><planeGeometry args={[len, th]} /></mesh>;
};
const Frame: React.FC<{ w: number; h: number; th: number; hex: string; k: number; o: number; draw?: number }> = ({ w, h, th, hex, k, o, draw = 1 }) => {
  const x = w / 2, y = h / 2, dw = x * draw, dh = y * draw;
  return (
    <group>
      <Hair a={[-dw, y]} b={[dw, y]} th={th} hex={hex} k={k} o={o} />
      <Hair a={[-dw, -y]} b={[dw, -y]} th={th} hex={hex} k={k} o={o} />
      <Hair a={[-x, -dh]} b={[-x, dh]} th={th} hex={hex} k={k} o={o} />
      <Hair a={[x, -dh]} b={[x, dh]} th={th} hex={hex} k={k} o={o} />
    </group>
  );
};

// ---------------------------------------------------------------------------------------------
// particle fields (custom points: per-point size + brightness; tokens sample a tiny glyph atlas)
let ATLAS: THREE.CanvasTexture | null = null;
const atlas = () => {
  if (ATLAS) return ATLAS;
  const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d")!;
  g.fillStyle = "#fff"; g.font = "600 44px monospace"; g.textAlign = "center"; g.textBaseline = "middle";
  "01710F3A8:/<>#+=".split("").forEach((ch, i) => g.fillText(ch, (i % 4) * 64 + 32, Math.floor(i / 4) * 64 + 34));
  ATLAS = new THREE.CanvasTexture(c);
  return ATLAS;
};
const pointsMat = (tokens: boolean) => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uC: { value: new THREE.Color("#fff") }, uO: { value: 1 }, uS: { value: 1 }, uT: { value: 0 }, uMap: { value: tokens ? atlas() : null } },
  vertexShader: `attribute float aS; attribute float aB; attribute float aG; uniform float uS, uT; varying float vB; varying float vG;
    void main(){ vB = aB * (0.75 + 0.25 * sin(uT * (0.6 + aS * 2.0) + aG * 7.0)); vG = aG;
      vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = clamp(uS * aS * 420.0 / -mv.z, 0.0, 64.0); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: tokens
    ? `uniform vec3 uC; uniform float uO; uniform sampler2D uMap; varying float vB; varying float vG;
       void main(){ vec2 cell = vec2(mod(vG, 4.0), floor(vG / 4.0)); vec2 uv = (cell + vec2(gl_PointCoord.x, 1.0 - gl_PointCoord.y)) / 4.0;
         float a = texture2D(uMap, uv).a; if (a < 0.05) discard; gl_FragColor = vec4(uC * vB * a * uO, 1.0); }`
    : `uniform vec3 uC; uniform float uO; varying float vB;
       void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d); float a = smoothstep(0.5, 0.0, r); a *= a; gl_FragColor = vec4(uC * vB * a * uO, 1.0); }`,
});
const Field: React.FC<{ geo: THREE.BufferGeometry; tokens?: boolean; hex: string; o: number; size: number; t: number }> = ({ geo, tokens = false, hex, o, size, t }) => {
  const m = useMemo(() => pointsMat(tokens), [tokens]);
  if (o <= 0.003) return null;
  m.uniforms.uC.value.set(hex); m.uniforms.uO.value = o; m.uniforms.uS.value = size; m.uniforms.uT.value = t;
  return <points geometry={geo} material={m} frustumCulled={false} />;
};
const makeField = (n: number, seed: number, at: (r: () => number) => [number, number, number], sz: (r: () => number) => number, br: (r: () => number) => number) => {
  const r = rng(seed), pos = new Float32Array(n * 3), s = new Float32Array(n), b = new Float32Array(n), gl = new Float32Array(n);
  for (let i = 0; i < n; i++) { pos.set(at(r), i * 3); s[i] = sz(r); b[i] = br(r); gl[i] = Math.floor(r() * 16); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("aS", new THREE.BufferAttribute(s, 1)); g.setAttribute("aB", new THREE.BufferAttribute(b, 1)); g.setAttribute("aG", new THREE.BufferAttribute(gl, 1));
  return g;
};

// ---------------------------------------------------------------------------------------------
export const DriftV3: React.FC<{ t: number }> = ({ t }) => {
  const a = useAssets();
  const fields = useMemo(() => {
    const p23 = pathAt(23), p54 = pathAt(54.5), p57 = pathAt(57), p92 = pathAt(93);
    const tokens = makeField(18000, 11, (r) => [(r() - 0.5) * 40, p23.y + 8 - r() * (p23.y - p54.y + 20), 4 - r() * 70], (r) => 0.035 + r() * 0.05, (r) => 0.15 + Math.pow(r(), 3) * 0.9);
    const dust = makeField(2600, 12, (r) => [(r() - 0.5) * 26, p54.y + (r() - 0.5) * 16, p54.z + 3 - r() * 30], (r) => 0.03 + r() * 0.08, (r) => 0.2 + r() * 0.6);
    const zLen = p57.z - p92.z + 120;
    const stars = makeField(16000, 13, (r) => { let x = 0, y = 0; do { x = (r() - 0.5) * 80; y = (r() - 0.5) * 50; } while (Math.hypot(x, y) < 2.2); return [x, p57.y + y, p57.z + 10 - r() * zLen]; }, (r) => 0.02 + Math.pow(r(), 4) * 0.16, (r) => 0.25 + Math.pow(r(), 2) * 1.4);
    // the celestial network: faint threads between near neighbours of a subset of the stars
    const sp = stars.getAttribute("position") as THREE.BufferAttribute, seg: number[] = [];
    const idx = Array.from({ length: 2200 }, (_, i) => i * 7);
    for (const i of idx) {
      const ax = sp.getX(i), ay = sp.getY(i), az = sp.getZ(i);
      let best = [-1, -1], bd = [1e9, 1e9];
      for (const j of idx) { if (j === i) continue; const d = (sp.getX(j) - ax) ** 2 + (sp.getY(j) - ay) ** 2 + (sp.getZ(j) - az) ** 2; if (d < bd[0]) { bd = [d, bd[0]]; best = [j, best[0]]; } else if (d < bd[1]) { bd[1] = d; best[1] = j; } }
      for (const j of best) if (j >= 0 && bd[best.indexOf(j)] < 14 && Math.hypot(ax - p57.x, ay - p57.y) > 7) seg.push(ax, ay, az, sp.getX(j), sp.getY(j), sp.getZ(j));
    }
    const net = new THREE.BufferGeometry(); net.setAttribute("position", new THREE.BufferAttribute(new Float32Array(seg), 3));
    return { tokens, dust, stars, net };
  }, []);
  const netMat = useMemo(() => new THREE.LineBasicMaterial({ color: new THREE.Color("#9fb4ff"), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }), []);
  // pillar layout (Act II): each sung word is a row; it sits where the centre of view will be when it's sung
  const pillar = useMemo(() => {
    if (!a) return null;
    const PW = 7.0, r = capHeight(a.inter, 1);
    const rows: { li: number; wi: number; text: string; p: THREE.Vector3; size: number }[] = [];
    for (let li = 6; li <= 21; li++) LINES[li].words.forEach((w, wi) => {
      if (li === 9) return; // STRUGGLING TO REST is its own locked block
      rows.push({ li, wi, text: up(w.w), p: viewPoint(w.s + 0.12 + (li === 10 ? 0.4 : 0), 10), size: 0 });
    });
    rows.sort((x, y) => y.p.y - x.p.y);
    rows.forEach((row, i) => {
      const gu = i > 0 ? rows[i - 1].p.y - row.p.y : 9, gd = i < rows.length - 1 ? row.p.y - rows[i + 1].p.y : 9;
      const just = PW / layout(a.inter, row.text, 1, 0.0).width;
      row.size = Math.max(0.45, Math.min(just, (0.84 * Math.min(gu, gd)) / r, 2.8));
    });
    // the locked block: WHILE I'M / STRUGGLING / TO / REST
    const c = viewPoint(29.0, 10);
    const def = [{ wi: [0, 1], j: 0.45 }, { wi: [2], j: 1 }, { wi: [3], j: 0.3 }, { wi: [4], j: 0.82 }];
    let blk = def.map((d) => { const text = d.wi.map((wi) => up(W(9, wi).w)).join(" "); return { ...d, text, size: (PW * d.j) / layout(a.inter, text, 1, 0).width }; });
    const H = blk.reduce((s, b) => s + b.size * r * 1.32, 0), sc = Math.min(1, 5.6 / H);
    blk = blk.map((b) => ({ ...b, size: b.size * sc }));
    let y = (H * sc) / 2;
    const block = blk.map((b) => { const h = b.size * r * 1.32; y -= h / 2; const out = { ...b, p: c.clone().add(new THREE.Vector3(0, y, 0)) }; y -= h / 2; return out; });
    return { rows, block };
  }, [a]);
  if (!a || !pillar) return <AbsoluteFill style={{ background: "#000" }} />;

  const cam = camAt(t);
  const els: React.ReactNode[] = [];
  let focus = 10, bloomK = 1, bokeh = 1.5;

  // ===================== I · THE INPUT TERMINAL =====================
  if (t < BEATS.verseIn) {
    const O = new THREE.Vector3(0, 0, -10), BW = 9.4, BH = 4.7, fs = 0.27, lh = 0.62, x0 = -BW / 2 + 0.5;
    const beats = T.beats, bi = beats.findIndex((b) => b > t), lb = beats[Math.max(0, bi - 1)] ?? 0, nb = beats[bi] ?? lb + 0.6;
    const beatPh = (t - lb) / Math.max(0.2, nb - lb);
    const frozen = t >= W(4, 5).s;
    const draw = cubicOut(clamp01((t - 3.5) / 0.6));
    const flash = frozen ? 1 + 7 * Math.exp(-(t - W(4, 5).s) / 0.16) : 1;
    // the lines, typed character by character on the vocal
    const lines = [0, 1, 2, 3, 4, 5];
    let curX = 0, curY = 0, typing = false, anyLine = false;
    lines.forEach((li, k) => {
      const ws = LINES[li].words, y = BH / 2 - 0.62 - k * lh;
      const prompt = L0(li) - 0.2;
      if (t < prompt) return;
      anyLine = true;
      let text = "> ";
      const times: number[] = [prompt, prompt];
      ws.forEach((w, j) => {
        const s = (j ? " " : "") + up(w.w), n = s.length, step = Math.min(0.045, Math.max(0.012, (w.e - w.s) / n));
        for (let c = 0; c < n; c++) times.push(li === 5 ? L0(5) : w.s + c * step);
        text += s;
      });
      const shown = times.filter((x) => t >= x).length;
      if (times.some((x) => x <= t && t - x < 0.18)) typing = true;
      const lay = layout(a.jb, text, fs, 0);
      const vis = text.slice(0, shown);
      els.push(<Flat key={`tl${li}`} font={a.jb} text={vis} size={fs} tracking={0} left pos={O.clone().add(new THREE.Vector3(x0, y, 0))} k={1.05} fx={(i) => ({ hide: i === 0 })} />);
      if (!(frozen && li === 5)) { curX = x0 + (shown >= text.length ? lay.width : (lay.letters[shown]?.x ?? 0) + lay.width / 2 - (lay.letters[shown]?.adv ?? 0) / 2) + 0.03; curY = y; }
    });
    // the prompt ">" in green: draw separately over the white
    lines.forEach((li, k) => { if (t >= L0(li) - 0.2) els.push(<Flat key={`pr${li}`} font={a.jb} text=">" size={fs} left pos={O.clone().add(new THREE.Vector3(x0, BH / 2 - 0.62 - k * lh, 0.001))} hex={GREEN} k={1.25} />); });
    // the cursor: alone in dead centre, pulsing on the beat; then it hops into the frame and types
    const cw = fs * 0.62, ch = fs * 1.15;
    const home = new THREE.Vector3(0, 0, 0), inFrame = new THREE.Vector3(curX + cw / 2, curY, 0);
    const go = cubicOut(clamp01((t - 3.9) / 0.35));
    const cp = anyLine ? inFrame : home.clone().lerp(new THREE.Vector3(x0 + layout(a.jb, "> ", fs, 0).width + cw / 2, BH / 2 - 0.62, 0), go);
    const blinkOn = frozen ? 1 : typing ? 1 : beatPh < 0.5 ? 1 : 0.12;
    const pulse = t < 3.9 ? 0.35 + 0.65 * Math.exp(-beatPh * 3.2) : 1;
    els.push(<mesh key="cursor" material={flatMat(GREEN, frozen ? 1.5 : 1.25, blinkOn * pulse)} position={O.clone().add(cp).toArray() as [number, number, number]}><planeGeometry args={[cw, ch]} /></mesh>);
    // the frame: a thin green rectangle that draws outward from the centre; one hard flash when the system freezes
    if (draw > 0) els.push(<group key="frame" position={O.toArray() as [number, number, number]}><Frame w={BW} h={BH} th={0.012 * (frozen ? 1 + (flash - 1) * 0.25 : 1)} hex={GREEN} k={0.9 * flash} o={1} draw={draw} /></group>);
    focus = 10;
  }

  // ===================== II · THE VERTICAL SYSTEM CRUSH =====================
  if (t > BEATS.verseIn - 0.05 && t < 56) {
    pillar.rows.forEach((row) => {
      const w = W(row.li, row.wi);
      if (t < w.s - 3.2) return;
      if (cam.p.y - row.p.y < -14) return; // long gone above
      let o = clamp01((t - (w.s - 3.2)) / 0.4);
      if (row.li <= 8) o *= 1 - ramp(t, 27.9, 0.35); // clear the frame for the lock
      const h = heatOf(t, w);
      els.push(<Flat key={`p${row.li}-${row.wi}`} font={a.inter} text={row.text} size={row.size} tracking={0} pos={row.p} k={0.92 + 0.45 * h} o={o} />);
    });
    pillar.block.forEach((b, bi) => {
      const w0 = W(9, b.wi[0]);
      if (t < w0.s - 0.12 || t > 33) return;
      const o = clamp01((t - (w0.s - 0.12)) / 0.14) * (bi === 3 ? 1 - clamp01((t - BEATS.rest - 0.12) / 0.35) : 1);
      let p = b.p.clone(), rz = 0;
      if (bi === 3 && t > BEATS.rest) { const u = t - BEATS.rest; p = p.add(new THREE.Vector3(0.12 * sm(u / 0.2), -0.5 * 42 * u * u, 0)); rz = -0.07 * sm(u / 0.22); } // REST unhinges and drops like a stone
      const h = heatOf(t, W(9, b.wi[b.wi.length - 1]));
      els.push(<Flat key={`b${bi}`} font={a.inter} text={b.text} size={b.size} tracking={0} pos={p} rz={rz} k={0.95 + 0.45 * h} o={o} />);
    });
    focus = 10;
  }

  // ===================== III · THE SYSTEM FRACTURE =====================
  if (t > L0(22) - 0.3 && t < 60.5) {
    // line 22: rises into the centre as the plummet eases out; a thin white frame
    const c22 = viewPoint(54.7, 9);
    const o22 = clamp01((t - (L0(22) - 0.3)) / 0.5) * (1 - ramp(t, L0(23) - 0.35, 0.45));
    const r1 = "AND I'M NOT LOOKING", r2 = "FOR AN ENDING";
    const fs = 0.46, w22 = Math.max(layout(a.outfit, r1, fs, 0.14).width, layout(a.outfit, r2, fs, 0.14).width);
    if (o22 > 0) {
      const shownWords = LINES[22].words.filter((w) => t >= w.s - 0.05).length;
      const row1 = up(LINES[22].words.slice(0, Math.min(4, shownWords)).map((w) => w.w).join(" ")), row2 = shownWords > 4 ? up(LINES[22].words.slice(4, shownWords).map((w) => w.w).join(" ")) : "";
      els.push(
        <group key="l22" position={c22.toArray() as [number, number, number]}>
          <Flat font={a.outfit} text={row1} size={fs} tracking={0.14} pos={[-(w22 - layout(a.outfit, row1, fs, 0.14).width) / 2 * 0, 0.42, 0]} o={o22} k={1.0} />
          <Flat font={a.outfit} text={row2} size={fs} tracking={0.14} pos={[0, -0.42, 0]} o={o22} k={1.0} />
          <Frame w={w22 + 1.2} h={2.1} th={0.01} hex={WHITE} k={0.7} o={o22 * 0.8} draw={cubicOut(clamp01((t - L0(22)) / 0.8))} />
        </group>,
      );
    }
    // line 23 + BREAK in a crimson frame that fractures on the hit
    const c23 = viewPoint(56.6, 9);
    const o23 = clamp01((t - (L0(23) - 0.35)) / 0.45);
    const bk = W(23, 5), hit = bk.s, u = Math.max(0, t - hit);
    const ofade = 1 - ramp(t, hit + 0.15, 0.55);
    if (o23 > 0 && ofade > 0) {
      const lead = up(LINES[23].words.slice(0, 5).filter((w) => t >= w.s - 0.05).map((w) => w.w).join(" "));
      const bs = 0.95, bw = layout(a.outfit, "BREAK", bs, 0.12).width, fw = bw + 0.9, fh = bs * capHeight(a.outfit, 1) + 0.75, fy = -0.55;
      const segs: React.ReactNode[] = [];
      if (t > bk.s - 0.12) {
        const N = 34, per = 2 * (fw + fh);
        for (let i = 0; i < N; i++) {
          const d0 = (i / N) * per, d1 = ((i + 1) / N) * per;
          const at = (d: number): [number, number] => { if (d < fw) return [-fw / 2 + d, fh / 2]; d -= fw; if (d < fh) return [fw / 2, fh / 2 - d]; d -= fh; if (d < fw) return [fw / 2 - d, -fh / 2]; d -= fw; return [-fw / 2, -fh / 2 + d]; };
          const A = at(d0), B = at(d1), r = rng(i + 900), mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2;
          const vx = mx * 0.55 + (r() - 0.5) * 1.4, vy = my * 1.1 + (r() - 0.5) * 1.0, sp = (r() - 0.5) * 2.4;
          const e = 1 - Math.exp(-u * 1.6), dx = vx * (e * 1.6 + u * 0.25), dy = vy * (e * 1.6 + u * 0.25), rot = sp * u;
          const ca = Math.cos(rot), sa = Math.sin(rot), hx = (B[0] - A[0]) / 2, hy = (B[1] - A[1]) / 2;
          segs.push(<Hair key={i} a={[mx + dx - (hx * ca - hy * sa), my + fy + dy - (hx * sa + hy * ca)]} b={[mx + dx + (hx * ca - hy * sa), my + fy + dy + (hx * sa + hy * ca)]} th={0.013} hex={CRIMSON} k={1.35 + (u < 0.15 ? 2 * (1 - u / 0.15) : 0)} o={clamp01((t - (bk.s - 0.12)) / 0.12) * (1 - clamp01((u - 0.6) / 1.6)) * o23} />);
        }
      }
      els.push(
        <group key="l23" position={c23.toArray() as [number, number, number]}>
          <Flat font={a.outfit} text={lead} size={0.4} tracking={0.14} pos={[0, 0.72, 0]} o={o23 * ofade} />
          {t > bk.s - 0.12 ? <Flat font={a.outfit} text="BREAK" size={bs} tracking={0.12} pos={[0, fy, 0]} hex={WHITE} k={1.1 + 0.5 * heatOf(t, bk)} o={o23 * clamp01((t - (bk.s - 0.12)) / 0.1) * ofade}
            fx={(i, n) => ({ dx: (i - (n - 1) / 2) * (2.4 * cubicOut(clamp01(u / 1.1)) + u * 0.5), dy: (i % 2 ? 1 : -1) * 0.05 * u })} /> : null}
          {segs}
        </group>,
      );
    }
    if (t > L0(22) - 0.3 && t < 58) focus = cam.p.distanceTo(t < L0(23) - 0.3 ? c22 : c23);
    bokeh = 1.5 + 4.5 * ramp(t, 53.2, 0.8) * (1 - ramp(t, 57.6, 1.5));
  }

  // ===================== IV · THE CELESTIAL HORIZON =====================
  type CL = { li: number; pass: number; off: [number, number]; spread?: boolean; dfly?: boolean };
  const CH: CL[] = [
    { li: 24, pass: 60.0, off: [0, 0.9] },
    { li: 25, pass: BEATS.dPass, off: [0, 0], dfly: true },
    { li: 26, pass: 65.6, off: [-1.5, 0.5], spread: true },
    { li: 27, pass: 69.1, off: [1.5, -0.4], spread: true },
    { li: 28, pass: 70.2, off: [0, 0.9] },
    { li: 29, pass: 72.1, off: [0, -0.9] },
    { li: 30, pass: 76.1, off: [-1.6, 0.4] },
    { li: 31, pass: 78.5, off: [1.6, 0.2] },
    { li: 32, pass: 85.4, off: [0, 0.9], spread: true },
    { li: 33, pass: 90.9, off: [0, -0.9], spread: true },
    { li: 34, pass: 93.4, off: [0, 0], dfly: true },
  ];
  if (t > L0(24) - 0.8) {
    CH.forEach((c) => {
      const s = L0(c.li);
      if (t < s - 0.5 || t > c.pass + 0.2) return;
      const ws = LINES[c.li].words, hero = ws.length - 1;
      const heroT = up(ws[hero].w).replace(/\./g, ""), restT = up(ws.slice(0, hero).map((w) => w.w).join(" "));
      const hs = c.dfly ? 3.6 : Math.min(2.0, 8.5 / layout(a.poiret, heroT, 1, 0.06).width), ss = c.dfly ? 0.55 : Math.min(0.4, 6.5 / Math.max(1, layout(a.poiret, up(ws.slice(0, hero).map((w) => w.w).join(" ")), 1, 0.18).width));
      const hy = -0.35 * hs, ry = hy + hs * capHeight(a.poiret, 1) * 0.5 + 0.55 + ss * 0.5;
      const zPlane = pathAt(c.pass).z, cp = camAt(c.pass).p;
      let origin = new THREE.Vector3(cp.x + c.off[0], cp.y + c.off[1], zPlane);
      if (c.dfly) {
        const L = layout(a.poiret, heroT, hs, 0.06), ctr = counterOf(a.poiret, "D", hs)!;
        origin = new THREE.Vector3(cp.x - (L.letters[0].x + ctr.x), cp.y - (hy + ctr.y), zPlane);
      }
      const d = cam.p.z - zPlane;
      const o = clamp01((t - (s - 0.5)) / 0.7) * sm((40 - d) / 14) * (c.dfly ? clamp01((d - 0.15) / 0.6) : sm((d - 0.9) / 2.2));
      if (o <= 0) return;
      const spread = c.spread ? Math.max(0, t - (s + 0.5)) : 0;
      const fx: Fx | undefined = c.spread ? (i, n, x) => { const r = rng(c.li * 97 + i); const sp = Math.min(2.2, spread); return { dx: x * 0.09 * sp, dy: (r() - 0.5) * 0.08 * sp, rz: (r() - 0.5) * 0.015 * sp }; } : undefined;
      const restShown = up(ws.slice(0, hero).filter((w) => t >= w.s - 0.05).map((w) => w.w).join(" "));
      els.push(
        <group key={`c${c.li}`} position={origin.toArray() as [number, number, number]}>
          {restShown ? <Flat font={a.poiret} text={restShown} size={ss} tracking={0.18} pos={[0, ry, 0]} o={o * 0.95} k={1.0} fx={fx} /> : null}
          {t >= ws[hero].s - 0.08 ? <Flat font={a.poiret} text={heroT} size={hs} tracking={0.06} pos={[0, hy, 0]} o={o * clamp01((t - (ws[hero].s - 0.08)) / 0.3)} k={1.0 + 0.6 * heatOf(t, ws[hero])} fx={fx} /> : null}
        </group>,
      );
      void restT;
      if (t > s - 0.5 && t < c.pass) focus = Math.max(0.5, d);
    });
    bloomK = 1 + 1.7 * Math.exp(-(((t - BEATS.dPass) / 0.28) ** 2)) + 1.0 * Math.exp(-(((t - 93.4) / 0.4) ** 2));
    bokeh = t > 57.6 ? 2.2 : bokeh;
  }

  // ---------- particles ----------
  const oTok = ramp(t, BEATS.verseIn, 0.6) * (1 - ramp(t, 53.6, 1.2));
  const oDust = ramp(t, 53.0, 1.0) * (1 - ramp(t, 59.5, 2));
  const oStar = ramp(t, 56.8, 2.2);
  netMat.opacity = 0.07 * ramp(t, 58.0, 3.0);

  const look: FilmLook = {
    bg: "#000000", fog: { color: "#000000", density: 0 }, ambient: 0, env: 0, exposure: 1.0,
    bloom: { intensity: 0.75 * bloomK, threshold: 0.55, smoothing: 0.35 }, vignette: { offset: 0.3, darkness: 0.8 },
    ca: 0.0006, grain: 0.025, bokeh, crystal: 0,
  };
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <FilmStage cam={{ pos: cam.p, look: cam.l, fov: 40, near: 0.05, far: 900 }} look={look} focus={focus}>
        <Field geo={fields.tokens} tokens hex={GREEN} o={0.55 * oTok} size={1} t={t} />
        <Field geo={fields.dust} hex="#ffe9d2" o={0.7 * oDust} size={1} t={t * 0.4} />
        <Field geo={fields.stars} hex="#e9eeff" o={oStar} size={1} t={t} />
        {netMat.opacity > 0.002 ? <lineSegments geometry={fields.net} material={netMat} frustumCulled={false} /> : null}
        {els}
      </FilmStage>
    </AbsoluteFill>
  );
};
