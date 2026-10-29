import React, { useLayoutEffect, useMemo } from "react";
import { AbsoluteFill } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Line, impactEnv, kickEnv, linesOf } from "../data";
import { SAFE, W, H } from "../theme";
import { F } from "../utils/fonts";
import { clamp01, cubicIn, cubicOut, expoOut, mix } from "../utils/ease";
import { hash01, rng } from "../utils/random";
import { contourMat } from "../three/contour";
import { applyCam, makeCam } from "./cam";
import { DIM, INK, LyricLine, STONE, lineOut } from "./LyricType";

const L = linesOf("verse2");
const B = {
  clock: L[0], gut: L[1], rip: L[2], sledge: L[3], frame: L[4], dry: L[5], mud: L[6], lay: L[7], bones: L[8], beautiful: L[9],
  mediocre: L[10], cage: L[11], bank: L[12], walls: L[13], maxed: L[14], after: L[15], cost: L[16], step: L[17],
};
const RED = "#e5483b";
const PANEL = "#0d0d0e";
const EDGE = "#34332f";
const mono = (size: number, color = INK): React.CSSProperties => ({ fontFamily: F.mono, fontSize: size, color, lineHeight: 1.35, whiteSpace: "pre" });
const ROOM = { w: 4.2, d: 4.2, h: 2.6 };

// ---------------------------------------------------------------------------------------------
const cam = makeCam([
  { t: B.gut.start - 0.1, p: [0.3, 1.5, 3.4], l: [0, 1.2, -1.6], fov: 50 },
  { t: B.rip.start, p: [-0.6, 1.9, 2.4], l: [0, 0.0, 0.2], fov: 52 },
  { t: B.sledge.start, p: [0.5, 1.3, 2.6], l: [0, 1.1, -2.1], fov: 46 },
  { t: B.frame.start, p: [1.2, 1.4, 2.2], l: [-1.2, 1.2, -1.5], fov: 50 },
  { t: B.dry.start, p: [-1.0, 1.35, 1.6], l: [-2.1, 1.2, -0.6], fov: 50 },
  { t: B.mud.start, p: [0.9, 1.2, 1.4], l: [2.1, 1.3, -0.6], fov: 46 },
  { t: B.lay.start, p: [0.0, 2.1, 1.8], l: [0, 0, -0.6], fov: 52 },
  { t: B.bones.start, p: [0.6, 1.7, 3.6], l: [0, 1.1, -1.4], fov: 52 },
  { t: B.beautiful.end, p: [-0.4, 1.5, 3.2], l: [0, 1.2, -1.6], fov: 50 },
  { t: B.walls.start, p: [0.2, 1.6, 3.4], l: [0, 1.1, -1.4], fov: 54 },
  { t: B.walls.end, p: [-0.8, 1.2, 2.2], l: [0.6, 0.8, -1.6], fov: 56 },
  { t: B.step.start, p: [20 + 4.5, 2.4, 6.5], l: [20, 1.4, 0], fov: 40 },
  { t: B.step.end + 0.6, p: [20 + 6.5, 6.5, 7.5], l: [20 - 1, 4.0, -2.5], fov: 44 },
]);

/** Money texture: line-drawn bills and the numbers they became. */
const moneyTexture = () => {
  const c = document.createElement("canvas");
  c.width = c.height = 1024;
  const x = c.getContext("2d")!;
  x.fillStyle = "#000";
  x.fillRect(0, 0, 1024, 1024);
  const r = rng(77);
  for (let i = 0; i < 26; i++) {
    const bx = r() * 1024, by = r() * 1024, rot = (r() - 0.5) * 0.6;
    x.save();
    x.translate(bx, by);
    x.rotate(rot);
    x.strokeStyle = "rgba(196,182,162,0.9)";
    x.lineWidth = 3;
    x.strokeRect(-130, -56, 260, 112);
    x.strokeRect(-118, -44, 236, 88);
    x.beginPath();
    x.ellipse(0, 0, 30, 38, 0, 0, Math.PI * 2);
    x.stroke();
    x.fillStyle = "rgba(239,237,233,0.95)";
    x.font = "800 34px Inter";
    x.fillText("100", -112, -12);
    x.fillText("100", 54, 40);
    x.restore();
  }
  x.font = "500 26px 'IBM Plex Mono'";
  x.fillStyle = "rgba(239,237,233,0.8)";
  for (let i = 0; i < 18; i++) x.fillText(`-$${(r() * 4000 + 100).toFixed(2)}`, r() * 900, r() * 1000);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
};

const HouseScene: React.FC<{ t: number }> = ({ t }) => {
  const { camera, gl } = useThree();
  const M = useMemo(
    () => ({
      old: contourMat({ pitch: 7, warp: 0.5, axis: [0.25, 1, 0.1], ink: "#c9c6c0" }),
      dry: contourMat({ pitch: 7, warp: 0.05, axis: [0, 1, 0] }),
      glass: contourMat({ pitch: 3.2, warp: 0.0, axis: [0, 1, 0] }),
      stud: contourMat({ pitch: 5, warp: 0.1, axis: [0.3, 1, 0.3] }),
      floor: contourMat({ pitch: 8, warp: 0.2, axis: [0.2, 0, 1] }),
      tile: contourMat({ pitch: 5, warp: 0.05, axis: [1, 0, 0.3] }),
      house: contourMat({ pitch: 5, warp: 0.1, axis: [0, 1, 0.25] }),
      edge: new THREE.LineBasicMaterial({ color: "#a7a49e" }),
      laser: new THREE.MeshBasicMaterial({ color: "#ffffff" }),
      money: new THREE.MeshBasicMaterial({ map: moneyTexture(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
    }),
    [],
  );
  const box = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), []);
  const pyramid = useMemo(() => new THREE.ConeGeometry(0.75, 0.55, 4, 1), []);
  const chunks = useMemo(() => {
    const r = rng(3);
    return Array.from({ length: 34 }, (_, i) => ({ x: -1.9 + r() * 3.8, y: 0.3 + r() * 2.1, side: i % 3, v: new THREE.Vector3((r() - 0.5) * 2, r() * 2, 1 + r() * 2), spin: r() * 6, delay: r() * 1.2, s: 0.25 + r() * 0.5 }));
  }, []);
  const tiles = useMemo(() => {
    const out: { x: number; z: number; k: number }[] = [];
    let k = 0;
    for (let x = -1.8; x <= 1.81; x += 0.6) for (let z = -1.8; z <= 1.81; z += 0.6) out.push({ x, z, k: k++ });
    return out;
  }, []);
  useLayoutEffect(() => applyCam(camera, cam(t)));
  gl.setClearColor("#000");
  const kick = kickEnv(t, 0.2);
  const imp = impactEnv(t);
  for (const m of [M.old, M.dry, M.glass, M.stud, M.floor, M.tile, M.house]) {
    m.uniforms.uKey.value.set(0.3, 1, 0.5).normalize();
    m.uniforms.uLevel.value = 0.75 + 0.25 * kick;
  }
  M.glass.uniforms.uRim.value = 1.6;
  const beautiful = clamp01((t - B.beautiful.start) / 1.5);
  for (const m of [M.dry, M.glass, M.floor, M.tile]) m.uniforms.uLevel.value += beautiful * 0.35;
  const money = t > B.walls.start ? clamp01((t - B.walls.words[2].s) / 0.6) * (1 - clamp01((t - B.walls.end - 1.2) / 0.5)) : 0;
  M.money.opacity = money;
  (M.money.map as THREE.Texture).offset.set(0, -t * 0.05);

  const gutted = t > B.gut.start;
  const framed = (k: number, n: number) => cubicOut(clamp01((t - B.frame.start - (k / n) * 1.3) / 0.25));
  const dryP = (k: number) => cubicOut(clamp01((t - B.dry.start - k * 0.11) / 0.25));
  const glassOn = t > B.mud.words[3].s;
  const walls: { pos: [number, number, number]; rot: number; len: number }[] = [
    { pos: [0, ROOM.h / 2, -ROOM.d / 2], rot: 0, len: ROOM.w },
    { pos: [-ROOM.w / 2, ROOM.h / 2, 0], rot: Math.PI / 2, len: ROOM.d },
    { pos: [ROOM.w / 2, ROOM.h / 2, 0], rot: -Math.PI / 2, len: ROOM.d },
  ];
  const sledgeHole = t > B.sledge.words[0].s;
  const inHouse = t < B.step.start - 0.05;
  return (
    <>
      {inHouse ? (
        <group>
          {/* floor: old floor until ripped, then bare slab, then new tile */}
          <mesh material={M.floor} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
            <planeGeometry args={[ROOM.w, ROOM.d]} />
          </mesh>
          {tiles.map((tl) => {
            // old tile: shatters on "break the tile"
            const brk = t - B.rip.words[7].s - (tl.k % 9) * 0.02;
            const lay = clamp01((t - B.lay.start - tl.k * 0.025) / 0.18);
            if (t < B.lay.start) {
              if (brk > 1.5) return null;
              const e = Math.max(0, brk);
              return <mesh key={tl.k} geometry={box} material={M.tile} position={[tl.x, 0.02 + e * 3 - 4.9 * e * e, tl.z + e * 0.5]} rotation={[e * 5, e * 3, e * 4]} scale={[0.58, 0.03, 0.58]} />;
            }
            if (lay <= 0) return null;
            return (
              <group key={tl.k} position={[tl.x, 0.015, tl.z]}>
                <mesh geometry={box} material={M.tile} scale={[0.58 * lay, 0.02, 0.58 * lay]} />
                <lineSegments geometry={edges} material={M.edge} scale={[0.585 * lay, 0.025, 0.585 * lay]} />
              </group>
            );
          })}
          {walls.map((w, wi) => {
            const nStud = Math.floor(w.len / 0.41);
            return (
              <group key={wi} position={w.pos} rotation={[0, w.rot, 0]}>
                {/* the old wall: whole panels until "tear it out", then they peel off one by one */}
                {t < B.frame.start
                  ? Array.from({ length: Math.ceil(w.len / 1.2) }, (_, k) => {
                      const tearAt = B.gut.words[5].s + (k + wi * 2) * 0.09;
                      const blowAt = wi === 0 && k >= 1 && k <= 2 ? B.sledge.words[0].s : Infinity;
                      const e = Math.max(0, t - Math.min(tearAt, blowAt));
                      if (e > 1.4) return null;
                      const blown = t >= blowAt;
                      const fall = cubicIn(clamp01(e / 0.6));
                      return (
                        <group key={k} position={[-w.len / 2 + 0.6 + k * 1.2, -ROOM.h / 2, 0.1]} rotation={[blown ? 0 : fall * (Math.PI / 2), 0, 0]}>
                          <mesh geometry={box} material={M.old} position={[blown ? (hash01(k) - 0.5) * e * 4 : 0, ROOM.h / 2 + (blown ? e * 2 - 4.9 * e * e : 0), blown ? e * 5 : 0]} rotation={[blown ? e * 4 : 0, blown ? e * 3 : 0, 0]} scale={[1.18, ROOM.h, 0.03]} />
                        </group>
                      );
                    })
                  : null}
                {/* sledgehammer debris */}
                {wi === 0 && t > B.sledge.words[0].s && t < B.sledge.words[0].s + 1.6
                  ? chunks.map((c, ci) => {
                      const e = t - B.sledge.words[0].s - c.delay * 0.15;
                      if (e < 0) return null;
                      return <mesh key={ci} geometry={box} material={M.old} position={[c.x * 0.6 + c.v.x * e * 2, c.y - ROOM.h / 2 + c.v.y * e * 1.5 - 4.9 * e * e, 0.2 + c.v.z * e * 2.5]} rotation={[c.spin * e, c.spin * e * 0.6, 0]} scale={[c.s * 0.5, c.s * 0.5, 0.05]} />;
                    })
                  : null}
                {/* studs */}
                {Array.from({ length: nStud + 1 }, (_, k) => {
                  const p = framed(k + wi * 12, 36);
                  if (p <= 0) return null;
                  return <mesh key={k} geometry={box} material={M.stud} position={[-w.len / 2 + k * 0.41 + 0.02, -ROOM.h / 2 + ((ROOM.h - 0.1) * p) / 2, 0.06]} scale={[0.045, (ROOM.h - 0.1) * p, 0.09]} />;
                })}
                {/* drywall */}
                {Array.from({ length: Math.ceil(w.len / 1.2) }, (_, k) => {
                  const p = dryP(k + wi * 4);
                  if (p <= 0) return null;
                  return <mesh key={k} geometry={box} material={glassOn ? M.glass : M.dry} position={[-w.len / 2 + 0.6 + k * 1.2 + (1 - p) * 1.4, 0, 0.12]} scale={[1.19, ROOM.h, 0.012]} />;
                })}
                {/* money on the walls */}
                {money > 0 ? (
                  <mesh material={M.money} position={[0, 0, 0.14]}>
                    <planeGeometry args={[w.len, ROOM.h]} />
                  </mesh>
                ) : null}
              </group>
            );
          })}
          {money > 0 ? (
            <mesh material={M.money} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
              <planeGeometry args={[ROOM.w, ROOM.d]} />
            </mesh>
          ) : null}
          {/* plumb laser */}
          {t > B.dry.words[7].s && t < B.mud.start + 0.3 ? <mesh material={M.laser} position={[-ROOM.w / 2 + 0.16, ROOM.h / 2, -0.4]} scale={[0.004, ROOM.h, 0.004]} geometry={box} /> : null}
        </group>
      ) : null}
      {/* every house I flip is a step up the line */}
      {t > B.step.start - 0.05 ? (
        <group position={[20, 0, 0]}>
          {Array.from({ length: 7 }, (_, k) => {
            const wi = Math.min(B.step.words.length - 1, k);
            const p = expoOut(clamp01((t - B.step.words[wi].s) / 0.3));
            if (p <= 0) return null;
            return (
              <group key={k} position={[-k * 0.55, k * 0.75 + (1 - p) * 2, -k * 0.9]}>
                <mesh geometry={box} material={M.house} position={[0, 0.35, 0]} scale={[1.0, 0.7, 1.0]} />
                <lineSegments geometry={edges} material={M.edge} position={[0, 0.35, 0]} scale={[1.005, 0.705, 1.005]} />
                <mesh geometry={pyramid} material={M.house} position={[0, 0.98, 0]} rotation={[0, Math.PI / 4, 0]} />
              </group>
            );
          })}
        </group>
      ) : null}
    </>
  );
};

// ---------------------------------------------------------------------------------------------
/** App window for the money moments (matches verse 1). */
const Win: React.FC<{ t: number; at: number; out: number; title: string; children: React.ReactNode }> = ({ t, at, out, title, children }) => {
  if (t < at || t > out) return null;
  const p = expoOut(clamp01((t - at) / 0.18));
  return (
    <div style={{ position: "absolute", left: 70, top: 760, width: 940, height: 700, background: PANEL, border: `2px solid ${EDGE}`, borderRadius: 14, overflow: "hidden", transform: `scale(${mix(0.94, 1, p)})`, opacity: p, boxShadow: "0 30px 80px rgba(0,0,0,0.8)" }}>
      <div style={{ height: 52, borderBottom: `2px solid ${EDGE}`, display: "flex", alignItems: "center", padding: "0 20px", gap: 10 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ width: 14, height: 14, borderRadius: 7, background: i === 0 ? "#4a4946" : "#2a2927" }} />
        ))}
        <div style={{ ...mono(20, DIM), marginLeft: 16 }}>{title}</div>
      </div>
      <div style={{ position: "relative", padding: 34 }}>{children}</div>
    </div>
  );
};

const Apps: React.FC<{ t: number; outs: number[] }> = ({ t, outs }) => {
  const o = (l: Line) => outs[L.indexOf(l)];
  const bal = mix(-12.84, -2431.07, cubicOut(clamp01((t - B.bank.start) / (B.bank.end - B.bank.start))));
  const limit = clamp01((t - B.maxed.start) / 1.0);
  return (
    <>
      <Win t={t} at={B.clock.start} out={o(B.clock)} title="timeclock — badge 4417">
        <div style={{ ...mono(28, DIM) }}>shift 1 · IT</div>
        <div style={{ fontFamily: F.grotesk, fontWeight: 800, fontSize: 140, color: INK, lineHeight: 1.1 }}>17:00</div>
        <div style={{ ...mono(34, STONE) }}>{t > B.clock.words[2].s ? "CLOCKED OUT ✓" : "clocking out…"}</div>
        <div style={{ ...mono(28, DIM), marginTop: 40 }}>{t > B.clock.words[5].s ? "17:01 — shift 2 · THE FLIP" : ""}</div>
        <div style={{ ...mono(28, RED), marginTop: 6 }}>{t > B.clock.words[7].s ? "never clocked out" : ""}</div>
      </Win>
      <Win t={t} at={B.mediocre.start} out={o(B.mediocre)} title="standards — punch list">
        {[["mediocre", false], ["good enough", false], ["settle", false], ["level", true], ["plumb", true], ["built to last", true]].map(([k, ok], i) =>
          t > B.mediocre.start + i * 0.22 ? (
            <div key={String(k)} style={{ display: "flex", justifyContent: "space-between", ...mono(32, ok ? INK : DIM), padding: "12px 0", borderBottom: `1px solid ${EDGE}`, textDecoration: ok ? "none" : "line-through" }}>
              <span>{String(k)}</span>
              <span style={{ color: ok ? STONE : RED }}>{ok ? "✓" : "✗"}</span>
            </div>
          ) : null,
        )}
      </Win>
      <Win t={t} at={B.bank.start} out={o(B.bank)} title="first community bank — checking ••4417">
        <div style={mono(24, DIM)}>available balance</div>
        <div style={{ fontFamily: F.grotesk, fontWeight: 800, fontSize: 120, lineHeight: 1.1, color: RED, letterSpacing: "-0.03em" }}>-${Math.abs(bal).toFixed(2)}</div>
        {[["LUMBER YARD", "-1,284.00"], ["DRYWALL SUPPLY", "-642.18"], ["TILE OUTLET", "-497.20"]].map((r, i) =>
          t > B.bank.start + 0.3 + i * 0.25 ? (
            <div key={r[0]} style={{ display: "flex", justifyContent: "space-between", ...mono(28), padding: "12px 0", borderBottom: `1px solid ${EDGE}` }}>
              <span>{r[0]}</span>
              <span style={{ color: RED }}>{r[1]}</span>
            </div>
          ) : null,
        )}
        <div style={{ ...mono(24, DIM), marginTop: 20 }}>red like before.</div>
      </Win>
      <Win t={t} at={B.maxed.start} out={o(B.maxed)} title="credit — visa ••0091">
        <div style={mono(24, DIM)}>credit used</div>
        <div style={{ fontFamily: F.grotesk, fontWeight: 800, fontSize: 130, lineHeight: 1.1, color: limit >= 1 ? RED : INK }}>{Math.round(mix(62, 100, limit))}%</div>
        <div style={{ height: 22, background: "#1c1b1a", borderRadius: 11, overflow: "hidden", marginTop: 10 }}>
          <div style={{ width: `${mix(62, 100, limit)}%`, height: 22, background: limit >= 1 ? RED : STONE }} />
        </div>
        <div style={{ ...mono(30, limit >= 1 ? RED : DIM), marginTop: 30 }}>{limit >= 1 ? "LIMIT REACHED" : "processing…"}</div>
      </Win>
      {/* after pics: the post everyone sees */}
      {t > B.after.start && t < o(B.after) ? (
        <div style={{ position: "absolute", left: 260, top: 740, width: 560, height: 760, borderRadius: 50, border: `4px solid ${INK}`, background: PANEL, padding: 26, opacity: expoOut(clamp01((t - B.after.start) / 0.2)) }}>
          <div style={{ ...mono(22, INK) }}>@rudo · the flip</div>
          <div style={{ marginTop: 14, height: 480, borderRadius: 16, border: `2px solid ${EDGE}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F.grotesk, fontWeight: 900, fontSize: 110, color: INK, background: "linear-gradient(180deg, #1a1a1a 0%, #050505 100%)" }}>AFTER ✦</div>
          <div style={{ ...mono(30, INK), marginTop: 18 }}>♥ {Math.round(mix(12, 2431, clamp01((t - B.after.start) / 1.6))).toLocaleString()}</div>
          <div style={{ ...mono(22, DIM) }}>"wow you're so lucky"</div>
        </div>
      ) : null}
      {/* the cost they don't see: receipts, then the shine wipes them */}
      {t > B.cost.start && t < o(B.cost) ? (
        <div style={{ position: "absolute", left: 120, top: 780, width: 840 }}>
          {["permit  $1,150.00", "dumpster  $640.00", "plumber  $2,300.00", "electric  $3,120.00", "nights  ∞", "sleep  0"].map((r, i) => {
            const show = t > B.cost.start + i * 0.18;
            const shine = clamp01((t - B.cost.words[6].s) / 0.6);
            return show ? (
              <div key={r} style={{ ...mono(34, i >= 4 ? RED : INK), padding: "10px 0", borderBottom: `1px dashed ${EDGE}`, clipPath: `inset(0 ${shine * 100}% 0 0)` }}>
                {r}
              </div>
            ) : null;
          })}
          <div style={{ position: "absolute", left: `${clamp01((t - B.cost.words[6].s) / 0.6) * 100}%`, top: -40, width: 18, height: 560, background: "#fff", boxShadow: "0 0 50px 20px rgba(255,255,255,0.5)", opacity: t > B.cost.words[6].s ? 1 : 0 }} />
        </div>
      ) : null}
      {/* money tags on the walls */}
      {t > B.walls.words[2].s && t < o(B.walls) + 0.4
        ? [["FRAMING", "$11,000", 140, 900], ["DRYWALL", "$6,400", 600, 1060], ["TILE", "$3,800", 260, 1330], ["EVERY DOLLAR", "$21,200", 560, 1440]].map(([k, v, x, y], i) =>
            t > B.walls.words[2].s + i * 0.18 ? (
              <div key={String(k)} style={{ position: "absolute", left: Number(x), top: Number(y), borderLeft: `3px solid ${STONE}`, paddingLeft: 14 }}>
                <div style={mono(20, DIM)}>{String(k)}</div>
                <div style={{ fontFamily: F.grotesk, fontWeight: 800, fontSize: 52, color: STONE }}>{String(v)}</div>
              </div>
            ) : null,
          )
        : null}
    </>
  );
};

/** "Average is a cage": bars close round the line, then break. */
const Cage: React.FC<{ t: number }> = ({ t }) => {
  const l = B.cage;
  if (t < l.start || t > l.end + 0.9) return null;
  const close = cubicOut(clamp01((t - l.start) / 0.25));
  const brk = cubicIn(clamp01((t - l.words[l.words.length - 1].s) / 0.5));
  return (
    <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
      {Array.from({ length: 11 }, (_, i) => {
        const x = SAFE.left + i * ((SAFE.right - SAFE.left) / 10);
        const dir = i % 2 ? 1 : -1;
        return <line key={i} x1={x + brk * dir * 300} y1={220 - (1 - close) * 400 + brk * 500 * (hash01(i) - 0.3)} x2={x + brk * dir * 380} y2={680 - (1 - close) * 400 + brk * 700 * hash01(i + 9)} stroke={INK} strokeWidth={10} opacity={1 - brk * 0.8} />;
      })}
      <line x1={SAFE.left - 20} y1={220 - (1 - close) * 400} x2={SAFE.right + 20} y2={220 - (1 - close) * 400} stroke={INK} strokeWidth={10} opacity={1 - brk} />
      <line x1={SAFE.left - 20} y1={680 - (1 - close) * 400 + brk * 600} x2={SAFE.right + 20} y2={680 - (1 - close) * 400 + brk * 600} stroke={INK} strokeWidth={10} opacity={1 - brk} />
    </svg>
  );
};

// ---------------------------------------------------------------------------------------------
export const Verse2: React.FC<{ t: number; bare?: boolean }> = ({ t, bare }) => {
  const outs = L.map((l, i) => lineOut(l, L[i + 1], 1.0));
  const shake = Math.min(1, impactEnv(t) + (t > B.sledge.start && t < B.sledge.end ? kickEnv(t, 0.1) : 0)) * 14;
  const sx = (hash01(Math.floor(t * 60)) - 0.5) * shake, sy = (hash01(Math.floor(t * 60) + 3) - 0.5) * shake;
  const showApps = [B.clock, B.mediocre, B.bank, B.maxed].some((l) => t >= l.start && t < outs[L.indexOf(l)]);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill style={{ transform: `translate(${sx}px, ${sy}px)`, opacity: showApps ? 0.35 : 1 }}>
        <ThreeCanvas width={W} height={H} style={{ position: "absolute", inset: 0 }} gl={{ antialias: true }}>
          <HouseScene t={t} />
        </ThreeCanvas>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 38%)" }} />
      <Apps t={t} outs={outs} />
      {bare ? null : L.map((l, i) => <LyricLine key={l.id} line={l} t={t} top={250} out={outs[i]} maxSize={104} special={{ re: /^red,?$/i, color: RED }} />)}
      {bare ? null : <Cage t={t} />}
      {bare ? null : <div style={{ position: "absolute", left: SAFE.left, top: 170, ...mono(20, STONE) }}>06 / VERSE 2 — the flip</div>}
    </AbsoluteFill>
  );
};

