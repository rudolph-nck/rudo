import React, { useMemo } from "react";
import * as THREE from "three";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { useAssets } from "../three/assets";
import { Stage } from "../three/Stage";
import { LINES, T, bassLevel, pulse } from "../data";
import { clamp01, cubicInOut, cubicOut, mix } from "../utils/ease";
import { noise1, rng } from "../utils/random";
import { capHeight, layout } from "../words/glyphs";
import { Glow } from "../words/points";
import { Full, Letters } from "../frames/kit";
import { NoSign, Sky, SkyClock, mkLine } from "./S1";
import { FMT, aspect } from "../theme";

/**
 * Intro (0:00–0:23.3), rebuilt to hook from frame 1.
 *  A spark — a shooting star — writes your thoughts across the night. Its path spirals around you
 *  like an orbit; every word is written onto it the moment it's sung (hot amber while sung, cooling to
 *  white behind the spark). The camera chases the spark the whole time.
 *  0:00  the spark ignites and races; the sky fills with more and more shooting-star trails.
 *  TIRED sags asleep. QUIT: the spark draws the no-sign itself. DISAPPEAR: the spark burns out, the word
 *  drifts into the abyss, the sky's trails go out one by one. STOP: everything freezes, the camera rips
 *  back: a spiral of every line above a figure on a rooftop edge. FOR A MINUTE: a clock draws itself.
 * Type stays flat and crisp; only the spark glows.
 */
export const INTRO_END = 23.3;
const L = (li: number) => LINES[li].words;
const INK = new THREE.Color("#f1eee8");
const AMBER = new THREE.Color("#ff7a2c");
const SILVER = new THREE.Color("#8d877d");
const R = 6; // spiral radius
const K = 0.07; // rise per unit of path
const NS = 0.34, HS = 0.95; // word sizes
const HERO = new Set(["1-4", "2-4", "3-4", "4-5"]);
const STOP_T = L(4)[5].s;
const LINE_GAP = 2.6;
const LEAD = 34; // path length raced before YEAH

// ---- the path: a slowly rising spiral; text faces in, toward the axis ----
const P = (s: number) => { const q = s / R; return new THREE.Vector3(R * Math.sin(q), K * s, -R * Math.cos(q)); };
const Tan = (s: number) => { const q = s / R; return new THREE.Vector3(Math.cos(q), 0, Math.sin(q)); };
const Nin = (s: number) => { const q = s / R; return new THREE.Vector3(-Math.sin(q), 0, Math.cos(q)); };
const TILT = 0.78; // the spiral's text leans back, facing down toward someone looking up from below
const Zf = (s: number) => Nin(s).multiplyScalar(Math.cos(TILT)).add(new THREE.Vector3(0, -Math.sin(TILT), 0)); // text normal
const Yf = (s: number) => Zf(s).cross(Tan(s)).normalize(); // text up
const basisQ = (s: number) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(Tan(s), Yf(s), Zf(s)));
const hfov = (fov: number) => 2 * Math.atan(Math.tan((fov * Math.PI) / 360) * aspect());
// distance that fits a word: by its width and by its height
const fitD = (w: number, ch: number, k: number) => Math.max((w * k) / Math.tan(hfov(46) / 2), (ch * 1.3) / Math.tan((23 * Math.PI) / 180));

type Slot = { li: number; wi: number; s: number; w: number; size: number; text: string; hero: boolean };

export const Intro: React.FC<{ t: number }> = ({ t }) => {
  const a = useAssets();
  const matCache = useMemo(() => new Map<string, THREE.MeshBasicMaterial>(), []);

  // ---- layout: every word of lines 0–4 gets a slot on the path ----
  const slots = useMemo(() => {
    if (!a) return null;
    const out: Slot[] = [];
    let cur = 0;
    for (let li = 0; li <= 4; li++) {
      L(li).forEach((w, wi) => {
        const hero = HERO.has(`${li}-${wi}`);
        const size = li === 0 ? 0.3 : hero ? HS : NS;
        const text = w.w.toUpperCase().replace(/[.,!?]/g, "");
        const width = layout(a.bebas, text, size, 0.04).width;
        out.push({ li, wi, s: cur, w: width, size, text, hero });
        cur += width + (hero ? 0.35 : 0.16);
      });
      cur += LINE_GAP;
    }
    return out;
  }, [a]);

  // ---- spark position on the path over time (keys: reaches each word as it's sung) ----
  const keys = useMemo(() => {
    if (!slots) return [] as [number, number][];
    const k: [number, number][] = [[0, -LEAD]];
    slots.forEach((sl, i) => {
      const w = L(sl.li)[sl.wi];
      const nx = slots[i + 1] ? L(slots[i + 1].li)[slots[i + 1].wi].s : w.s + 1;
      if (sl.li === 4 && sl.wi === 0) k.push([17.9, sl.s - 3.2]); // a new spark streaks in
      k.push([w.s - 0.01, sl.s]);
      k.push([w.s + Math.min(0.22, Math.max(0.06, nx - w.s - 0.03)), sl.s + sl.w]);
      if (sl.li === 3 && sl.wi === 4) k.push([17.6, sl.s + sl.w]); // burnt out, waits
    });
    return k;
  }, [slots]);
  const sAt = (tt: number) => {
    if (!keys.length) return 0;
    if (tt <= keys[0][0]) return keys[0][1];
    if (tt < 4.3) return -LEAD * Math.pow(1 - tt / 4.3, 1.5); // races in, slowing into YEAH
    for (let i = 0; i < keys.length - 1; i++) {
      const [t0, s0] = keys[i], [t1, s1] = keys[i + 1];
      if (tt >= t0 && tt <= t1) return mix(s0, s1, cubicInOut(clamp01((tt - t0) / Math.max(1e-3, t1 - t0))));
    }
    return keys[keys.length - 1][1];
  };

  // ---- the sky: stars on a shell, and shooting-star trails that multiply ----
  const stars = useMemo(() => {
    const r = rng(181), n = 7000, pos = new Float32Array(n * 3), seed = new Float32Array(n), bright = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const u = r() * 2 - 1, q = r() * Math.PI * 2, rad = 40 + r() * 110, c = Math.sqrt(1 - u * u);
      pos.set([Math.cos(q) * c * rad, u * rad + 4, Math.sin(q) * c * rad], i * 3); seed[i] = r(); bright[i] = Math.pow(r(), 6) * 2.2 + 0.08;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("seed", new THREE.BufferAttribute(seed, 1)); g.setAttribute("bright", new THREE.BufferAttribute(bright, 1));
    return g;
  }, []);
  const trails = useMemo(() => {
    const r = rng(77), N = 64;
    return Array.from({ length: N }, (_, i) => {
      const c = new THREE.Vector3((r() - 0.5) * 20, 2 + (r() - 0.3) * 18, (r() - 0.5) * 20);
      const rad = 22 + r() * 40;
      const a1 = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize();
      const b1 = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).cross(a1).normalize();
      const f0 = r() * Math.PI * 2, span = 0.5 + r() * 1.1, n = 48;
      const pts = Array.from({ length: n }, (_, j) => { const f = f0 + (span * j) / (n - 1); return c.clone().addScaledVector(a1, Math.cos(f) * rad).addScaledVector(b1, Math.sin(f) * rad); });
      const line = mkLine(n, 1.1 + r() * 0.6, "#a39d93");
      line.g.setPositions(pts.flatMap((p) => [p.x, p.y, p.z]));
      const t0 = 0.12 + 3.5 * Math.pow(i / N, 0.55), dur = 0.9 + r() * 1.8;
      return { pts, line, t0, dur, out: 13.7 + 3.6 * r() };
    });
  }, []);
  const heads = useMemo(() => {
    const n = trails.length, g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute("seed", new THREE.BufferAttribute(new Float32Array(n).map((_, i) => (i * 0.618) % 1), 1));
    g.setAttribute("bright", new THREE.BufferAttribute(new Float32Array(n).fill(1.6), 1));
    return g;
  }, [trails]);
  const embers = useMemo(() => {
    const n = 70, g = new THREE.BufferGeometry(), r = rng(9);
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute("seed", new THREE.BufferAttribute(new Float32Array(n).map(() => r()), 1));
    g.setAttribute("bright", new THREE.BufferAttribute(new Float32Array(n).map((_, i) => 1.8 * Math.pow(1 - i / n, 2)), 1));
    return { g, jit: Array.from({ length: n }, () => new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5)) };
  }, []);
  const fuse = useMemo(() => mkLine(700, 1.7, "#ffffff"), []);
  const sparkMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.5, 0.18).multiplyScalar(9), toneMapped: false }), []);

  if (!a || !slots) return <Full bg="#030304">{null}</Full>;

  // ---------- time: everything freezes on STOP until FOR ----------
  const FOR_T = L(5)[0].s;
  const tf = t > STOP_T && t < FOR_T ? STOP_T : t >= FOR_T ? t - (FOR_T - STOP_T) : t; // the world's clock (twinkle etc.)
  const frozen = t > STOP_T + 0.12;
  const sSp = frozen ? sAt(STOP_T + 0.12) : sAt(t);
  const disW = L(3)[4];
  const sparkOn = t < disW.e + 0.15 ? 1 : t < 17.75 ? Math.max(0, 1 - (t - disW.e - 0.15) / 0.5) : cubicOut(clamp01((t - 17.75) / 0.15));
  const relight = Math.max(0, 1 - Math.abs(t - 17.95) / 0.25);
  const beat = pulse(t, T.beats, 0.1);

  // ---------- materials ----------
  const mat = (heat: number, o: number) => {
    const h = Math.round(clamp01(heat) * 12), q = Math.round(clamp01(o) * 16);
    const key = `${h}-${q}`;
    let m = matCache.get(key);
    if (!m) { m = new THREE.MeshBasicMaterial({ color: INK.clone().lerp(AMBER, h / 12), transparent: true, toneMapped: false }); m.opacity = q / 16; m.depthWrite = q > 10; matCache.set(key, m); }
    return m;
  };

  // ---------- words ----------
  const lineStart = (li: number) => L(li)[0].s;
  const words: React.ReactNode[] = [];
  let quit: { pos: THREE.Vector3; q: THREE.Quaternion; r: number } | null = null;
  slots.forEach((sl) => {
    const w = L(sl.li)[sl.wi];
    const isDis = sl.li === 3 && sl.wi === 4;
    if (t < w.s - 0.02) return;
    const app = clamp01((t - (w.s - 0.02)) / 0.07);
    const slam = sl.hero ? 1 + 0.22 * (1 - cubicOut(clamp01((t - w.s) / 0.16))) : 1 + 0.1 * (1 - cubicOut(clamp01((t - w.s) / 0.12)));
    const wordHeat = t < w.e ? 1 : Math.exp(-(t - w.e) / 0.7);
    const past = sl.li < 4 && t > (sl.li < 4 ? lineStart(sl.li + 1) : 99) ? cubicInOut(clamp01((t - lineStart(sl.li + 1)) / 0.8)) : 0;
    let o = app * (sl.li === 0 ? 0.62 : 1) * (1 - 0.5 * past);
    if (sl.li === 0 && t > w.e) o *= Math.max(0.35, 1 - (t - w.e) / 1.2);
    // where the word sits (on the path, text resting on the fuse)
    const smid = sl.s + sl.w / 2, chh = capHeight(a.bebas, sl.size);
    let pos = P(smid).addScaledVector(Yf(smid), chh / 2 + 0.05).addScaledVector(Zf(smid), 0.02); // text is laid out from its centre
    let q = basisQ(sl.s + sl.w / 2);
    // DISAPPEAR drifts away into the abyss
    if (isDis) {
      const u = cubicInOut(clamp01((t - (w.e + 0.15)) / (17.9 - w.e - 0.15)));
      pos = pos.addScaledVector(Zf(smid), -u * 15).addScaledVector(Yf(smid), u * 1.5);
      q = q.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, u * 0.15)));
      o *= 1 - u;
    }
    if (o <= 0.01) return;
    const n = sl.text.length;
    // syllables of DISAPPEAR appear one by one
    const sylOf: number[] = [];
    if (isDis && w.syl) w.syl.forEach((sy, k) => { for (let c = 0; c < sy.t.length; c++) sylOf.push(k); });
    const lay = layout(a.bebas, sl.text, sl.size, 0.04).letters;
    // TIRED falls asleep: letters sag and tilt
    const sleepy = sl.li === 1 && sl.hero ? cubicInOut(clamp01((t - (w.s + 0.35)) / 1.3)) : 0;
    const xf = (i: number, x: number) => {
      if (isDis && w.syl && t < w.syl[sylOf[i] ?? 0].s - 0.02) return { p: [x, 0, 0] as [number, number, number], hide: true };
      const dy = sleepy ? -sleepy * (0.05 + 0.2 * Math.sin(((i + 0.5) / n) * Math.PI)) * sl.size : 0;
      return { p: [x, dy, 0] as [number, number, number], r: [0, 0, sleepy * (i - (n - 1) / 2) * -0.06] as [number, number, number] };
    };
    const matFn = (i: number) => {
      const sl0 = smid + (lay[i]?.x ?? 0);
      const d = sSp - sl0; // spark distance past this letter
      const near = d < 0 ? 0.85 : Math.max(0, 1 - d / 1.8);
      const heat = Math.min(near * (sparkOn > 0.2 ? 1 : 0.6), wordHeat) * (sl.li === 0 ? 0.35 : 1);
      return mat(heat, o);
    };
    const sc = slam;
    words.push(
      <group key={`${sl.li}-${sl.wi}`} position={pos.toArray() as [number, number, number]} quaternion={q}>
        <group scale={[sc, sc, 1]}>
          <Letters font={a.bebas} family="bebas" text={sl.text} size={sl.size} depth={0.001} material={matFn} tracking={0.04} bevel={0} shadows={false} xf={xf} />
        </group>
      </group>,
    );
    if (sl.li === 2 && sl.hero) quit = { pos: pos.clone(), q, r: Math.max(sl.w * 0.66, capHeight(a.bebas, sl.size) * 0.95) };
  });

  // ---------- QUIT: the spark draws the no-sign ----------
  const qW = L(2)[4];
  const qDraw = cubicInOut(clamp01((t - (qW.s + 0.06)) / 0.38)), qSlash = cubicInOut(clamp01((t - (qW.s + 0.48)) / 0.14));
  let sparkPos = P(sSp).addScaledVector(Zf(sSp), 0.03);
  if (quit && t > qW.s + 0.06 && t < qW.s + 0.66) {
    const Q = quit as { pos: THREE.Vector3; q: THREE.Quaternion; r: number };
    let lp: THREE.Vector3;
    if (qDraw < 1) { const ang = Math.PI * 0.75 - qDraw * Math.PI * 2; lp = new THREE.Vector3(Math.cos(ang) * Q.r, Math.sin(ang) * Q.r, 0.03); }
    else { const s0 = new THREE.Vector3(-Q.r * 0.707, Q.r * 0.707, 0.03), s1 = new THREE.Vector3(Q.r * 0.707, -Q.r * 0.707, 0.03); lp = s0.lerp(s1, qSlash); }
    sparkPos = Q.pos.clone().add(lp.applyQuaternion(Q.q));
  }
  const qFade = 1 - 0.5 * cubicInOut(clamp01((t - (L(3)[0].s + 0.2)) / 0.8));

  // ---------- the fuse: the spark's path so far ----------
  const s0 = Math.max(-LEAD, sSp - 70);
  const NP = 700, fp: number[] = [], fc: number[] = [];
  for (let i = 0; i < NP; i++) {
    const s = mix(s0, sSp, i / (NP - 1));
    const p = P(s).addScaledVector(Zf(s), 0.015).addScaledVector(Yf(s), -0.01);
    fp.push(p.x, p.y, p.z);
    const d = sSp - s, hot = Math.exp(-d / 0.9) * sparkOn;
    const c = SILVER.clone().multiplyScalar(0.55 + 0.25 * Math.exp(-d / 6)).lerp(AMBER, hot);
    fc.push(c.r, c.g, c.b);
  }
  fuse.g.setPositions(fp); fuse.g.setColors(fc); fuse.m.vertexColors = true; fuse.m.color.set("#ffffff");
  fuse.m.opacity = 1;

  // embers behind the spark
  {
    const pa = embers.g.getAttribute("position") as THREE.BufferAttribute;
    embers.jit.forEach((j, i) => {
      const age = i * 0.012;
      const s = frozen ? sSp - i * 0.02 : sAt(t - age);
      const p = (i < 3 ? sparkPos.clone() : P(s).addScaledVector(Zf(s), 0.03)).addScaledVector(j, 0.04 + age * (frozen ? 0.6 : 1.4)).add(new THREE.Vector3(0, -age * age * 3, 0));
      pa.setXYZ(i, p.x, p.y, p.z);
    });
    pa.needsUpdate = true;
  }
  // sky trails
  {
    const ha = heads.getAttribute("position") as THREE.BufferAttribute;
    trails.forEach((tr, i) => {
      const pr = clamp01((tf - tr.t0) / tr.dur);
      const fade = 1 - clamp01((t - tr.out) / 0.5);
      tr.line.g.instanceCount = Math.max(1, Math.round((tr.pts.length - 1) * cubicOut(pr)));
      tr.line.m.opacity = (pr > 0 ? mix(0.5, 0.16, clamp01((t - 4.0) / 1.0)) : 0) * fade;
      const hp = tr.pts[Math.min(tr.pts.length - 1, Math.round((tr.pts.length - 1) * cubicOut(pr)))];
      const live = pr > 0 && pr < 1 && fade > 0;
      ha.setXYZ(i, live ? hp.x : 0, live ? hp.y : -999, live ? hp.z : 0);
    });
    ha.needsUpdate = true;
  }

  // ---------- camera ----------
  // chase: just behind the line you're hearing, low, looking along it toward the spark (text recedes into depth)
  const BACK = [2.0, 1.8, 2.1, 1.9, 1.6], DIST = [1.25, 1.05, 0.95, 1.15, 0.9], HO = [-0.1, 0.25, -0.2, 0.15, -0.05];
  const prm = (arr: number[]) => {
    let v = arr[0];
    for (let li = 1; li <= 4; li++) v = mix(v, arr[li], cubicInOut(clamp01((t - (lineStart(li) - 0.8)) / 0.9)));
    return v;
  };
  let sc = 0; for (let k = 0; k < 16; k++) sc += frozen ? sSp : sAt(t - k * 0.05); sc /= 16; // the camera trails the spark softly
  let back = prm(BACK), dist = prm(DIST), ho = prm(HO), fov = 52;
  const race = 1 - cubicInOut(clamp01((t - 3.6) / 0.7)); // racing in: tight on the spark
  back = mix(back, 0.9, race); dist = mix(dist, 0.55, race); ho = mix(ho, -0.08, race); fov = mix(fov, 62, race);
  const cb = sc - back;
  let pos = P(cb).addScaledVector(Zf(cb), dist).addScaledVector(Yf(cb), ho + 0.12);
  let look = P(sc + 0.35).addScaledVector(Yf(sc), 0.12);
  let up = Yf(cb).clone();
  // reveal: the sky filling up
  const rev = cubicInOut(clamp01((t - 2.2) / 0.9)) * (1 - cubicInOut(clamp01((t - 3.45) / 0.8)));
  if (rev > 0) {
    const sp = P(sSp);
    pos = pos.lerp(new THREE.Vector3(sp.x * 0.15, sp.y - 2.5, sp.z * 0.15), rev);
    look = look.lerp(new THREE.Vector3(sp.x * 0.3, sp.y + 14, sp.z * 0.3 - 4), rev);
    up = up.lerp(new THREE.Vector3(0, 0, -1), rev).normalize();
    fov = mix(fov, 70, rev);
  }
  // hero words: square up to them
  slots.forEach((sl) => {
    if (!sl.hero || sl.li === 4) return;
    const w = L(sl.li)[sl.wi];
    const outT = lineStart(sl.li + 1) - 0.4;
    const k = cubicInOut(clamp01((t - (w.s - 0.12)) / 0.5)) * (1 - cubicInOut(clamp01((t - (outT - 0.1)) / 0.65)));
    if (k <= 0) return;
    const sm = sl.s + sl.w / 2, ch = capHeight(a.bebas, sl.size);
    const drift = sl.li === 1 ? cubicInOut(clamp01((t - w.s - 0.3) / 1.6)) : sl.li === 3 ? cubicInOut(clamp01((t - w.e) / 4)) : 0;
    const fit = fitD(sl.w, ch * (sl.li === 2 ? 1.5 : 1), sl.li === 2 ? 0.78 : 0.64); // the whole word in frame
    const cp = P(sm).addScaledVector(Zf(sm), fit - drift * 0.6).addScaledVector(Yf(sm), ch * 0.5 + 0.05 - drift * 0.25);
    const cl = P(sm).addScaledVector(Yf(sm), ch * 0.5 - drift * 0.3).addScaledVector(Zf(sm), -drift * 4);
    pos = pos.lerp(cp, k); look = look.lerp(cl, k); fov = mix(fov, 46, k);
    up = up.lerp(Yf(sm).applyAxisAngle(Zf(sm), sl.li === 1 ? -drift * 0.08 : 0), k).normalize();
  });
  // STOP: freeze, then rip back — the spiral above the figure on the rooftop edge
  const stopSl = slots.find((s) => s.li === 4 && s.wi === 5)!;
  const kick = Math.max(0, 1 - (t - STOP_T) / 0.18) * (t > STOP_T ? 1 : 0);
  const pb = cubicInOut(clamp01((t - (STOP_T + 0.22)) / 1.25));
  const yMid = K * (stopSl.s * 0.5);
  const WIDE = new THREE.Vector3(0, -6.5, 0.0), WLOOK = new THREE.Vector3(0, 4, 0.5); // under the spiral, looking straight up
  if (t > STOP_T - 0.05 && pb <= 0) {
    const sm = stopSl.s + stopSl.w / 2, ch = capHeight(a.bebas, stopSl.size);
    const k = cubicOut(clamp01((t - (STOP_T - 0.05)) / 0.12));
    const fit = fitD(stopSl.w, ch, 0.66);
    pos = pos.lerp(P(sm).addScaledVector(Zf(sm), fit).addScaledVector(Yf(sm), ch * 0.5), k);
    look = look.lerp(P(sm).addScaledVector(Yf(sm), ch * 0.5), k); up = up.lerp(Yf(sm), k).normalize(); fov = mix(fov, 46, k);
  }
  if (pb > 0) {
    const sm = stopSl.s + stopSl.w / 2, ch = capHeight(a.bebas, stopSl.size);
    const fit = fitD(stopSl.w, ch, 0.66);
    const from = P(sm).addScaledVector(Zf(sm), fit).addScaledVector(Yf(sm), ch * 0.5);
    pos = from.lerp(WIDE, pb); look = P(sm).addScaledVector(Yf(sm), ch * 0.5).lerp(WLOOK, pb); fov = mix(46, aspect() > 1 ? 80 : 104, pb);
    up = Yf(sm).lerp(new THREE.Vector3(0, 0, 1), pb).normalize();
  }
  // FOR A MINUTE: the clock in front of the wide view; push in slowly
  const clockC = WIDE.clone().add(WLOOK.clone().sub(WIDE).normalize().multiplyScalar(7.5));
  const push = cubicInOut(clamp01((t - FOR_T) / (INTRO_END - FOR_T)));
  if (pb > 0) { pos = pos.clone().lerp(clockC, push * 0.32); }
  // shake on STOP, a punch on every beat
  if (kick > 0) pos = pos.add(new THREE.Vector3(noise1(t * 60, 3) - 0.5, noise1(t * 60, 4) - 0.5, 0).multiplyScalar(0.02 * kick));

  const dawn = cubicInOut(clamp01((t - 21.9) / 1.2));
  const blinkT = L(6)[0].s - 0.14;
  const lid = clamp01((t - (blinkT - 0.16)) / 0.16);
  const silO = pb;
  const starGain = 0.85 + 0.35 * bassLevel(tf);

  return (
    <AbsoluteFill style={{ background: "#030304" }}>
      <Stage cam={{ pos: pos.toArray() as [number, number, number], look: look.toArray() as [number, number, number], fov, up: up.toArray() as [number, number, number] }}
        look={{ exposure: 1.0, env: 0.1, bloom: { strength: 1.1, radius: 0.55, threshold: 0.96 }, bg: "#030304" }}>
        <Sky dawn={dawn} />
        <Glow geo={stars} size={30} gain={starGain} time={tf} twinkle={frozen && t < FOR_T ? 0 : 0.35} />
        {trails.map((tr, i) => (tr.line.m.opacity > 0.01 ? <primitive key={i} object={tr.line.l} /> : null))}
        <Glow geo={heads} size={60} gain={2.2} time={tf} color="#ffd6b0" twinkle={0.2} />
        <primitive object={fuse.l} />
        {words}
        {quit && qDraw > 0 ? (
          <group position={(quit as { pos: THREE.Vector3 }).pos.toArray() as [number, number, number]} quaternion={(quit as { q: THREE.Quaternion }).q}>
            <NoSign r={(quit as { r: number }).r} draw={qDraw} slash={qSlash} o={qFade} />
          </group>
        ) : null}
        {sparkOn > 0.01 ? (
          <>
            <mesh position={sparkPos.toArray() as [number, number, number]} material={sparkMat} scale={(0.022 + 0.03 * relight) * sparkOn * (frozen ? 1 : 1 + 0.25 * (noise1(t * 40, 7) - 0.5))}>
              <sphereGeometry args={[1, 16, 12]} />
            </mesh>
            <Glow geo={embers.g} size={40} gain={1.6 * sparkOn} time={tf} color="#ffb47a" twinkle={frozen ? 0 : 0.6} />
          </>
        ) : null}
        {/* FOR A MINUTE, with a clock drawing itself */}
        {t > FOR_T - 0.05 ? (() => {
          const o = cubicOut(clamp01((t - (FOR_T - 0.05)) / 0.4));
          const mW = L(5)[2];
          const items: [string, number, number, boolean][] = [["FOR A", 0.3, 0.55, t >= FOR_T - 0.02], ["MINUTE", 0.62, -0.25, t >= mW.s - 0.02]];
          return (
            <group position={clockC.toArray() as [number, number, number]} ref={(g) => { if (g) { g.up.set(0, 0, 1); g.lookAt(WIDE); } }}>
              <SkyClock r={1.9} sec={Math.max(0, t - mW.s)} o={o * 0.85} />
              {items.map(([txt, size, y, on], i) => {
                if (!on) return null;
                const sl = i === 1 ? 1 + 0.2 * (1 - cubicOut(clamp01((t - mW.s) / 0.16))) : 1;
                const heat = i === 1 ? Math.max(0, 1 - (t - mW.s) / 1.2) : Math.max(0, 1 - (t - FOR_T) / 1.0);
                return <group key={i} position={[0, y, 0]} scale={[sl, sl, 1]}><Letters font={a.bebas} family="bebas" text={txt} size={size} depth={0.001} material={mat(heat, 1)} tracking={0.04} bevel={0} shadows={false} /></group>;
              })}
            </group>
          );
        })() : null}
      </Stage>
      {/* the figure on the rooftop edge, seen in the pull-back */}
      {silO > 0.01 ? (
        <AbsoluteFill style={{ opacity: silO * (1 - push * 0.6) }}>
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: FMT.H * 0.13, background: "#000" }} />
          <Img src={staticFile("images/rudo-cutout.png")} style={{ position: "absolute", left: FMT.W / 2 - FMT.H * 0.075, bottom: FMT.H * 0.13 - 12, width: FMT.H * 0.15, filter: "brightness(0)" }} />
        </AbsoluteFill>
      ) : null}
      {/* the blink into morning */}
      {lid > 0 ? (
        <>
          <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: (FMT.H / 2) * lid, background: "#000" }} />
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: (FMT.H / 2) * lid, background: "#000" }} />
        </>
      ) : null}
    </AbsoluteFill>
  );
};
