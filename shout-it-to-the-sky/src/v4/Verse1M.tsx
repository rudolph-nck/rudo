import React from "react";
import { AbsoluteFill } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import * as THREE from "three";
import { Font } from "three/examples/jsm/loaders/FontLoader.js";
import { Line, T, kickEnv, linesOf } from "../data";
import { SAFE, W, H } from "../theme";
import { F } from "../utils/fonts";
import { clamp01, cubicIn, cubicOut, expoOut, mix } from "../utils/ease";
import { hash01 } from "../utils/random";
import { IntroScene } from "../intro/Scene3D";
import { Caption, lineOut } from "../v3/LyricType";
import { Drawn, Field, Headline, HotLine, INK, MorphDefs, STONE, gridLayout, multiply } from "./Morph";

/**
 * Verse 1, metamorphosis cut: one continuous chain. Each lyric draws an object in light, the
 * object multiplies on the beat or collapses, and becomes the next thing.
 */
const L = linesOf("verse1");
const RED = "#e5483b";
const wd = (li: number, wi: number) => L[li].words[wi].s;
const beatsIn = (a: number, b: number) => T.beats.filter((x) => x >= a && x < b);
const sub = (l: Line, from: number, to?: number): Line => ({ ...l, words: l.words.slice(from, to), start: l.words[from].s });
const mono = (size: number, color = INK): React.CSSProperties => ({ fontFamily: F.mono, fontSize: size, color, lineHeight: 1.3, whiteSpace: "pre" });

// shapes (viewBox 0 0 200 200)
const LEAD = "M-900 150 L40 120";
const HEADSET = "M40 120 C40 40 160 40 160 120 M28 112 h24 v52 h-24 z M148 112 h24 v52 h-24 z M40 164 C60 192 110 188 128 176";
const CLOCK = "M100 30 A70 70 0 1 1 99.9 30";
const PHONE = "M65 18 h70 a16 16 0 0 1 16 16 v132 a16 16 0 0 1 -16 16 h-70 a16 16 0 0 1 -16 -16 v-132 a16 16 0 0 1 16 -16 z M86 34 h28";
const GAUGE = "M28 150 A72 72 0 0 1 172 150";
const BOX = "M10 10 h180 v180 h-180 z";

const Obj: React.FC<{ x: number; y: number; size: number; rot?: number; children: React.ReactNode; o?: number }> = ({ x, y, size, rot = 0, children, o = 1 }) => (
  <svg viewBox="0 0 200 200" width={size} height={size} style={{ position: "absolute", left: x - size / 2, top: y - size / 2, overflow: "visible", transform: `rotate(${rot}deg)`, opacity: o }}>
    {children}
  </svg>
);

// ---------------------------------------------------------------------------------------------
const CX = W / 2, CY = H * 0.56;

/** A. headset drawn in light → multiplies into a call-center field. */
const Headsets: React.FC<{ t: number }> = ({ t }) => {
  if (t > 33.9) return null;
  const draw = clamp01((t - 29.5) / 1.1);
  const fill = clamp01((t - 30.6) / 0.35);
  const m = multiply(t, beatsIn(30.9, 31.95).slice(0, 4), [1, 2, 4, 16, 64]);
  const tilt = mix(0, 64, cubicOut(clamp01((t - 31.45) / 0.55)));
  const dim = t > 32.0 ? mix(1, 0.32, clamp01((t - 32.0) / 0.3)) : 1;
  const prevL = gridLayout(m.prev, 0, undefined), curL = gridLayout(m.cur, 1);
  const cell = m.cur <= 2 ? 470 : m.cur <= 4 ? 420 : m.cur <= 16 ? 240 : 150;
  const size = m.cur === 1 ? 860 : cell * 0.95;
  return (
    <Field tilt={tilt} z={-tilt * 4}>
      {curL.map((c, i) => {
        const from = prevL[i % Math.max(1, m.prev)] ?? { x: 0, y: 0 };
        const x = CX + mix(from.x * (m.prev <= 1 ? 0 : cell), c.x * cell, m.p);
        const y = CY + mix(from.y * (m.prev <= 1 ? 0 : cell), c.y * cell, m.p);
        const rot = m.cur >= 16 && Math.floor(i / Math.ceil(Math.sqrt(m.cur))) % 2 ? 90 * m.p : 0;
        return (
          <Obj key={i} x={x} y={y} size={size} rot={rot} o={dim * (i === 0 ? 1 : m.p)}>
            {i === 0 && fill < 1 ? <Drawn d={LEAD} p={clamp01(draw * 2.2)} fill={0} w={3} cool={fill * 3} /> : null}
            <Drawn d={HEADSET} p={i === 0 ? clamp01(draw * 1.6 - 0.6) : 1} fill={i === 0 ? fill : 1} w={6} />
          </Obj>
        );
      })}
    </Field>
  );
};

/** B. password window over the field; the window rolls into a clock that strikes noon. */
const Login: React.FC<{ t: number }> = ({ t }) => {
  if (t < 32.0 || t > 33.95) return null;
  const pop = expoOut(clamp01((t - 32.0) / 0.2));
  const toClock = cubicIn(clamp01((t - wd(1, 3)) / 0.22));
  const dots = Math.max(0, Math.min(14, Math.floor((t - 32.05) * 16)));
  const ok = t > wd(1, 2);
  const clockDraw = clamp01((t - wd(1, 3) - 0.12) / 0.3);
  const hand = mix(-200, 0, cubicOut(clamp01((t - wd(1, 3)) / (wd(1, 5) + 0.12 - wd(1, 3)))));
  const gone = cubicIn(clamp01((t - 33.62) / 0.12));
  return (
    <>
      {toClock < 1 ? (
        <div style={{ position: "absolute", left: CX - 380, top: CY - 230, width: 760, height: 460, borderRadius: mix(16, 230, toClock), border: `3px solid ${INK}`, background: "#0b0b0c", transform: `scale(${pop * mix(1, 0.4, toClock)})`, opacity: 1 - toClock, padding: 40, boxShadow: "0 40px 100px rgba(0,0,0,0.9)" }}>
          <div style={mono(24, "rgba(239,237,233,0.5)")}>active directory · reset</div>
          <div style={{ ...mono(64), marginTop: 50, letterSpacing: "0.1em" }}>{"•".repeat(dots)}</div>
          <div style={{ marginTop: 50, width: 300, padding: "16px 0", textAlign: "center", borderRadius: 10, background: ok ? INK : "transparent", border: `3px solid ${INK}`, ...mono(32, ok ? "#000" : INK) }}>{ok ? "RESET ✓" : "RESET"}</div>
        </div>
      ) : null}
      {clockDraw > 0 ? (
        <Obj x={CX} y={CY} size={460} o={1 - gone}>
          <Drawn d={CLOCK} p={clockDraw} fill={clamp01((t - wd(1, 4)) / 0.2)} w={6} />
          <line x1={100} y1={100} x2={100 + Math.sin((hand * Math.PI) / 180) * 55} y2={100 - Math.cos((hand * Math.PI) / 180) * 55} stroke={INK} strokeWidth={7} strokeLinecap="round" />
          <line x1={100} y1={100} x2={100 + Math.sin((hand * 12 * Math.PI) / 180) * 40} y2={100 - Math.cos((hand * 12 * Math.PI) / 180) * 40} stroke={STONE} strokeWidth={5} strokeLinecap="round" />
          {t > wd(1, 5) ? <text x={100} y={168} textAnchor="middle" fill={STONE} fontFamily="IBM Plex Mono" fontSize={18}>12:00</text> : null}
        </Obj>
      ) : null}
    </>
  );
};

/** C. BANK ACCOUNT RED: tall headline + the balance draining; it all squashes into a red line. */
const Bank: React.FC<{ t: number }> = ({ t }) => {
  if (t < 33.6 || t > 35.95) return null;
  const l = L[2];
  const squash = 35.3;
  const bal = mix(43.17, -12.84, cubicOut(clamp01((t - wd(2, 2)) / 0.9)));
  const sq = cubicIn(clamp01((t - squash) / 0.25));
  const pin = expoOut(clamp01((t - wd(2, 3)) / 0.2));
  return (
    <>
      <Headline line={sub(l, 0, 3)} t={t} squashAt={squash} y={H * 0.36} maxH={360} color={(w) => (/red/i.test(w) ? RED : null)} />
      {t > wd(2, 2) ? (
        <div style={{ position: "absolute", left: SAFE.left, top: H * 0.56, width: SAFE.right - SAFE.left, textAlign: "center", fontFamily: F.display, fontSize: 300, lineHeight: 0.9, color: bal < 0 ? RED : INK, transform: `scaleY(${mix(1.8, 1, pin) * mix(1, 0.015, sq)}) scaleX(${mix(1, 1.4, sq)})`, opacity: pin }}>
          {bal < 0 ? "-" : ""}${Math.abs(bal).toFixed(2)}
        </div>
      ) : null}
      {t > wd(2, 4) && t < squash ? <div style={{ position: "absolute", left: 0, width: W, top: H * 0.76, textAlign: "center", ...mono(30, "rgba(239,237,233,0.6)") }}>pending · payday friday</div> : null}
    </>
  );
};

/** D. the red line becomes the highway's centre line; the camera tips down onto the road. */
const Highway: React.FC<{ t: number }> = ({ t }) => {
  if (t < 35.45 || t > 37.75) return null;
  const tilt = mix(0, 72, cubicOut(clamp01((t - 35.5) / 0.4)));
  const d = t - 35.5;
  const curl = cubicIn(clamp01((t - 37.2) / 0.35));
  return (
    <Field tilt={tilt} originY={52}>
      {/* centre dashes streaming */}
      {Array.from({ length: 26 }, (_, i) => {
        const y = ((i * 160 - d * 1500) % 4160 + 4160) % 4160 - 1600;
        return <div key={i} style={{ position: "absolute", left: CX - 9 + curl * (i % 2 ? 1 : -1) * 120, top: y, width: 18, height: 90, background: i < 2 && d < 0.2 ? RED : INK, borderRadius: 4, opacity: 1 - curl, boxShadow: "0 0 20px rgba(255,240,220,0.4)" }} />;
      })}
      {[-1, 1].map((s) => (
        <div key={s} style={{ position: "absolute", left: CX + s * 380 - 4, top: -1600, width: 8, height: 5200, background: "rgba(239,237,233,0.55)", opacity: 1 - curl }} />
      ))}
      {/* headlights passing */}
      {Array.from({ length: 6 }, (_, i) => {
        const y = 2600 - ((d * 2600 + i * 700) % 4200);
        return <div key={i} style={{ position: "absolute", left: CX + 180 + (i % 2) * 60, top: y, width: 14, height: 260, background: "linear-gradient(180deg, rgba(255,255,255,0), #fff)", opacity: 0.8 * (1 - curl), filter: "blur(2px)" }} />;
      })}
      {/* smoke */}
      {t > wd(3, 2)
        ? Array.from({ length: 8 }, (_, i) => {
            const a = ((t - wd(3, 2)) * 1.4 + i * 0.13) % 1;
            return <div key={i} style={{ position: "absolute", left: CX - 120 + Math.sin(i * 3) * 80, top: CY + 400 - a * 900, width: 160 + a * 260, height: 160 + a * 260, borderRadius: "50%", background: `radial-gradient(closest-side, rgba(220,220,220,${0.2 * (1 - a)}), rgba(220,220,220,0))` }} />;
          })
        : null}
    </Field>
  );
};

/** E. the dashes curl into a phone; "nobody called" multiplies it into a wall of silent phones. */
const Phones: React.FC<{ t: number }> = ({ t }) => {
  if (t < 37.3 || t > 38.95) return null;
  const draw = clamp01((t - 37.3) / 0.38);
  const fill = clamp01((t - 37.66) / 0.2);
  const m = multiply(t, [wd(4, 3), wd(4, 4)], [1, 4, 16]);
  const cell = m.cur === 1 ? 0 : m.cur === 4 ? 360 : 200;
  const size = m.cur === 1 ? 640 : m.cur === 4 ? 340 : 190;
  const out = clamp01((t - 38.65) / 0.15);
  return (
    <>
      {gridLayout(m.cur, 1).map((c, i) => (
        <Obj key={i} x={CX + c.x * cell * m.p} y={CY + c.y * cell * m.p} size={size} o={(i === 0 ? 1 : m.p) * (1 - out)}>
          <Drawn d={PHONE} p={i === 0 ? draw : 1} fill={i === 0 ? fill : 1} w={5} />
          {fill > 0.5 ? <text x={100} y={112} textAnchor="middle" fill={INK} fontFamily="Inter" fontWeight={800} fontSize={48}>0</text> : null}
          {fill > 0.5 ? <text x={100} y={138} textAnchor="middle" fill="rgba(239,237,233,0.5)" fontFamily="IBM Plex Mono" fontSize={11}>missed calls</text> : null}
        </Obj>
      ))}
    </>
  );
};

/** F. back to the wall: RUDO in 3D, a hot line draws the wall closing behind him. */
const Wall: React.FC<{ t: number; a: { geo: THREE.BufferGeometry; font: Font } | null }> = ({ t, a }) => {
  if (t < 38.75 || t > 40.85) return null;
  const draw = clamp01((t - wd(5, 9)) / 0.45);
  const out = cubicIn(clamp01((t - 40.6) / 0.2));
  return (
    <AbsoluteFill style={{ opacity: 1 - out, transform: `scale(${mix(1, 0.6, out)})` }}>
      {a ? (
        <ThreeCanvas width={W} height={H} style={{ position: "absolute", inset: 0 }} gl={{ antialias: true }}>
          <IntroScene t={4.2 + (t - 38.8) * 0.4} geo={a.geo} font={a.font} />
        </ThreeCanvas>
      ) : null}
      <Obj x={CX} y={CY - 40} size={880}>
        <Drawn d={BOX} p={draw} fill={0} w={2.4} />
      </Obj>
    </AbsoluteFill>
  );
};

/** G/H. every shift stamps a cell; the cells flip to NO; NO funnels into the gas gauge. */
const Shifts: React.FC<{ t: number }> = ({ t }) => {
  if (t < 40.65 || t > 44.4) return null;
  const words = [...L[6].words, ...L[7].words];
  const cols = 6, rows = 8, cell = 150;
  const n = cols * rows;
  const stamps = words.map((w) => w.s);
  const funnel = cubicIn(clamp01((t - wd(7, 9) + 0.05) / 0.3));
  return (
    <Field tilt={mix(0, 38, clamp01((t - 41.9) / 0.6))} originY={56}>
      {Array.from({ length: n }, (_, i) => {
        // cells arrive in bursts, one burst per sung word
        const burst = Math.floor((i / n) * stamps.length);
        const at = stamps[burst] + (i % 4) * 0.02;
        if (t < at) return null;
        const p = expoOut(clamp01((t - at) / 0.14));
        const col = i % cols, row = Math.floor(i / cols);
        const x = CX + (col - (cols - 1) / 2) * cell, y = CY + (row - (rows - 1) / 2) * cell;
        const isClass = row % 3 === 2;
        const no = t > wd(7, 2) + (i % 12) * 0.03;
        const fx = mix(x, CX, funnel), fy = mix(y, CY + 160, funnel);
        return (
          <div key={i} style={{ position: "absolute", left: fx - 62, top: fy - 62, width: 124, height: 124, borderRadius: 10, border: `3px solid ${no ? RED : isClass ? STONE : INK}`, transform: `scale(${mix(1.6, 1, p) * mix(1, 0.15, funnel)})`, opacity: 1 - funnel * 0.6, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F.display, fontSize: 60, color: no ? RED : isClass ? STONE : INK }}>
            {no ? "NO" : isClass ? "CLASS" : "SHIFT"}
          </div>
        );
      })}
    </Field>
  );
};
const Gauge: React.FC<{ t: number }> = ({ t }) => {
  if (t < wd(7, 8) || t > 44.6) return null;
  const draw = clamp01((t - wd(7, 8)) / 0.18);
  const sweep = cubicOut(clamp01((t - wd(7, 9)) / 0.5));
  const ang = mix(-90, 88, sweep);
  const rise = cubicIn(clamp01((t - 44.15) / 0.3));
  return (
    <Obj x={CX} y={CY + 160 - rise * 300} size={900} o={1 - rise * 0.6}>
      <Drawn d={GAUGE} p={draw} fill={clamp01((t - wd(7, 9)) / 0.15)} w={7} />
      <line x1={100} y1={150} x2={100 + Math.sin((ang * Math.PI) / 180) * 64 * (1 + rise * 3)} y2={150 - Math.cos((ang * Math.PI) / 180) * 64 * (1 + rise * 3)} stroke="#fff" strokeWidth={6} strokeLinecap="round" />
      <text x={22} y={178} fill="rgba(239,237,233,0.6)" fontFamily="IBM Plex Mono" fontSize={16}>E</text>
      <text x={170} y={178} fill={sweep > 0.95 ? STONE : "rgba(239,237,233,0.6)"} fontFamily="IBM Plex Mono" fontSize={16}>F</text>
    </Obj>
  );
};

/** I/J/K. the needle grows into a network; outages flash and clear; the nodes become an org chart. */
const NODES = [
  { k: "SERVER", lvl: 0, i: 0 },
  { k: "SWITCH", lvl: 1, i: 0 },
  { k: "SWITCH", lvl: 1, i: 1 },
  ...Array.from({ length: 4 }, (_, i) => ({ k: "PORT", lvl: 2, i })),
  ...Array.from({ length: 8 }, (_, i) => ({ k: "PORT", lvl: 3, i })),
];
const Network: React.FC<{ t: number }> = ({ t }) => {
  if (t < 44.2 || t > 49.4) return null;
  const lvlAt = [wd(8, 2), wd(8, 4), wd(8, 6), wd(8, 6) + 0.18];
  const org = cubicOut(clamp01((t - wd(10, 0)) / 0.6));
  const rise = cubicOut(clamp01((t - wd(10, 3)) / 0.5));
  const out = cubicIn(clamp01((t - 49.15) / 0.2));
  const pos = (n: (typeof NODES)[number], j: number) => {
    const count = [1, 2, 4, 8][n.lvl];
    const spread = [0, 420, 230, 112][n.lvl];
    const net = { x: CX + (n.i - (count - 1) / 2) * spread, y: H * 0.36 + n.lvl * 230 };
    // org chart: a tidy pyramid; one node (his) climbs to the top
    const mine = j === 9;
    const orgP = mine ? { x: CX, y: mix(H * 0.36 + 3 * 230, H * 0.34, rise) } : { x: net.x, y: net.y + (n.lvl === 0 ? 0 : 60) };
    return { x: mix(net.x, orgP.x, org), y: mix(net.y, orgP.y, org), mine };
  };
  return (
    <AbsoluteFill style={{ opacity: 1 - out, transform: `scale(${mix(1, 1.3, out)})` }}>
      <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
        {NODES.map((n, j) => {
          if (n.lvl === 0) return null;
          const parentLvl = n.lvl - 1;
          const parentIdx = NODES.findIndex((q) => q.lvl === parentLvl && q.i === Math.floor(n.i / 2));
          const A = pos(NODES[parentIdx], parentIdx), B = pos(n, j);
          const p = clamp01((t - lvlAt[n.lvl]) / 0.18);
          if (p <= 0) return null;
          return <line key={j} x1={A.x} y1={A.y} x2={mix(A.x, B.x, p)} y2={mix(A.y, B.y, p)} stroke={p < 1 ? "#fff" : "rgba(239,237,233,0.5)"} strokeWidth={3} />;
        })}
      </svg>
      {NODES.map((n, j) => {
        const at = lvlAt[n.lvl] + 0.12;
        if (t < at) return null;
        const P = pos(n, j);
        const p = expoOut(clamp01((t - at) / 0.15));
        // outage: red flicker, then OK one by one
        const down = t > wd(9, 1) && t < wd(9, 1) + 0.25 + j * 0.06;
        const w = [300, 250, 190, 104][n.lvl];
        const label = P.mine && rise > 0.3 ? "RUDO · LEAD" : n.k;
        return (
          <div key={j} style={{ position: "absolute", left: P.x - w / 2, top: P.y - 46, width: w, height: 92, borderRadius: 10, border: `3px solid ${down ? RED : P.mine && org > 0 ? STONE : INK}`, background: P.mine && rise > 0.3 ? "rgba(196,182,162,0.25)" : "#0b0b0c", transform: `scale(${mix(1.5, 1, p)})`, display: "flex", alignItems: "center", justifyContent: "center", ...mono(n.lvl === 3 ? 17 : 26, down ? RED : P.mine && rise > 0.3 ? INK : INK) }}>
            {label}
          </div>
        );
      })}
      {t > wd(9, 0) && t < wd(10, 0) ? <div style={{ position: "absolute", right: SAFE.left, top: H * 0.75, ...mono(56, STONE) }}>{`03:${String(Math.min(59, Math.floor((t - wd(9, 0)) * 30))).padStart(2, "0")} AM`}</div> : null}
    </AbsoluteFill>
  );
};

/** L. EARNED ALL THAT: the title change, then everything squashes into the line the stairs grow from. */
const Earned: React.FC<{ t: number }> = ({ t }) => {
  if (t < 49.0) return null;
  const l = L[11];
  const squash = 50.45;
  const strike = clamp01((t - wd(11, 2)) / 0.2);
  const hl = clamp01((t - squash - 0.18) / 0.1) * (1 - clamp01((t - squash - 0.6) / 0.3));
  return (
    <>
      {t < wd(11, 4) ? (
        <div style={{ position: "absolute", left: SAFE.left, top: H * 0.5, width: SAFE.right - SAFE.left, textAlign: "center" }}>
          <div style={{ ...mono(46, "rgba(239,237,233,0.6)"), position: "relative", display: "inline-block" }}>
            HELP DESK TECHNICIAN
            <div style={{ position: "absolute", left: 0, top: "52%", height: 4, width: `${strike * 100}%`, background: RED }} />
          </div>
          {t > wd(11, 3) ? <div style={{ fontFamily: F.display, fontSize: 150, color: STONE, transform: `scaleY(${mix(2, 1, expoOut(clamp01((t - wd(11, 3)) / 0.2)))})` }}>IT TEAM LEAD</div> : null}
        </div>
      ) : null}
      <Headline line={sub(l, 4)} t={t} squashAt={squash} y={H * 0.48} maxH={440} />
      <HotLine x0={SAFE.left - 60} x1={SAFE.right + 60} y={H * 0.48} o={hl} />
    </>
  );
};

// ---------------------------------------------------------------------------------------------
export const Verse1M: React.FC<{ t: number; assets: { geo: THREE.BufferGeometry; font: Font } | null; bare?: boolean }> = ({ t, assets, bare }) => {
  const outs = L.map((l, i) => lineOut(l, L[i + 1], 1.2));
  const kick = kickEnv(t, 0.12);
  const shake = (t > wd(2, 2) && t < wd(2, 2) + 0.2) || (t > wd(7, 2) && t < wd(7, 2) + 0.2) ? 10 : kick * 3;
  const sx = (hash01(Math.floor(t * 60)) - 0.5) * shake, sy = (hash01(Math.floor(t * 60) + 5) - 0.5) * shake;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <MorphDefs />
      <AbsoluteFill style={{ transform: `translate(${sx}px, ${sy}px)` }}>
        <Headsets t={t} />
        <Login t={t} />
        <Bank t={t} />
        <Highway t={t} />
        <Phones t={t} />
        <Wall t={t} a={assets} />
        <Shifts t={t} />
        <Gauge t={t} />
        <Network t={t} />
        <Earned t={t} />
      </AbsoluteFill>
      {bare ? null : L.map((l, i) => <Caption key={l.id} line={l} t={t} out={outs[i]} top={210} />)}
      {bare ? null : <div style={{ position: "absolute", left: SAFE.left, top: 170, ...mono(20, STONE) }}>02 / VERSE 1 — the back room</div>}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 85% 65% at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.7) 100%)", pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};

