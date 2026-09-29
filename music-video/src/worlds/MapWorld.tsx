import React, { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill } from "remotion";
import placesData from "../../data/places.json";
import { Field, Flash, LightPool, Vignette } from "../effects/Finish";
import { Lines3D, Seg3 } from "../three/Lines3D";
import { ParticleField } from "../three/Particles";
import { Obj, Stage3D } from "../three/Stage3D";
import { C, F, glow } from "../theme";
import { Caption } from "../typography/Caption";
import { Hero, Mono } from "../typography/Type";
import { Cam, H, project, W } from "../utils/camera";
import { clamp01, expoInOut, expoOut, mix, ramp } from "../utils/ease";
import { chapter, scene, useWorld } from "../utils/scenes";
import { beatPulse } from "../utils/time";

const K = 5000; // px per degree
const LON0 = -82.8,
  LAT0 = 29.5;
const X = (lon: number) => (lon - LON0) * K;
const Z = (lat: number) => -(lat - LAT0) * K;
/** yaw so Tallahassee sits left and Orlando right */
const YAW = -33.7;

type Place = { line: string; name: string; lat: number; lon: number; side: string; x: number; z: number; idx: number; k: number };
const PLACES: Place[] = (() => {
  const counts: Record<string, number> = {};
  return placesData.places.map((p, i) => {
    const k = counts[p.line] ?? 0;
    counts[p.line] = k + 1;
    return { ...p, x: X(p.lon), z: Z(p.lat), idx: i + 1, k };
  });
})();
const LINES = ["b01", "b02", "b03", "b04", "b05", "b06", "b07", "b08", "b09", "b10", "b11", "b12", "b13", "b14", "b15", "b16"];
const centroid = (ps: Place[]) => ({
  x: ps.reduce((a, p) => a + p.x, 0) / ps.length,
  z: ps.reduce((a, p) => a + p.z, 0) / ps.length,
});
const ORL = centroid(PLACES.filter((p) => p.lon > -82.5));
const TLH = centroid(PLACES.filter((p) => p.lon < -83.5));
const MID = { x: (ORL.x + TLH.x) / 2, z: (ORL.z + TLH.z) / 2 };

type View = { x: number; z: number; d: number; rx: number; ry: number };
const camFromView = (v: View, fov = 40): Cam => {
  const rx = (v.rx * Math.PI) / 180,
    ry = (v.ry * Math.PI) / 180;
  const fwd = [-Math.sin(ry) * Math.cos(rx), Math.sin(rx), -Math.cos(ry) * Math.cos(rx)];
  return { x: v.x - fwd[0] * v.d, y: -fwd[1] * v.d, z: v.z - fwd[2] * v.d, rx: v.rx, ry: v.ry, rz: 0, fov };
};
const lerpView = (a: View, b: View, t: number, arc = 0): View => ({
  x: mix(a.x, b.x, t),
  z: mix(a.z, b.z, t),
  d: mix(a.d, b.d, t) + arc * Math.sin(Math.PI * t),
  rx: mix(a.rx, b.rx, t),
  ry: mix(a.ry, b.ry, t),
});

const HEROES: Record<string, string> = {
  b02: "THAT’S THE CREW!",
  b06: "NOW THAT’S\nA GROUP!",
  b08: "ONE CREW.",
  b13: "BRING IT\nHOME!",
  b16: "LOOK AT\nTHIS CREW!",
};

function s3(out: Seg3[], a: { x: number; z: number }, b: { x: number; z: number }, t0: number, t1: number, lift = 0) {
  const y = (t: number) => -Math.sin(Math.PI * t) * lift;
  out.push({
    a: [mix(a.x, b.x, t0), y(t0), mix(a.z, b.z, t0)],
    b: [mix(a.x, b.x, t1), y(t1), mix(a.z, b.z, t1)],
    color: "0,178,227",
    width: 2.5,
    px: true,
    glow: 8,
  });
}

export const MapWorld: React.FC = () => {
  const { f, L, abs } = useWorld("branches");
  const off = chapter("branches").startFrame;
  const HU = L("holdup"),
    LR = L("letsroll");
  const nodeOn = (p: Place) => L(p.line) + 3 + p.k * 13;

  // ---------- camera views ----------
  const views = useMemo(() => {
    const v: Array<[number, View, number]> = []; // frame, view, arc
    const lineView = (id: string): View => {
      const c = centroid(PLACES.filter((p) => p.line === id));
      const i = LINES.indexOf(id);
      return { x: c.x, z: c.z, d: 3600, rx: 52, ry: YAW + (i % 2 ? 7 : -6) };
    };
    v.push([LR - 4, { x: ORL.x, z: ORL.z - 3000, d: 9000, rx: 4, ry: YAW }, 0]);
    v.push([LR + 44, { x: ORL.x - 200, z: ORL.z, d: 7200, rx: 50, ry: YAW - 4 }, 0]);
    let prev = v[v.length - 1][1];
    for (const id of LINES) {
      const s = L(id);
      let target: View;
      if (id === "b08") target = { x: MID.x, z: MID.z, d: 21000, rx: 56, ry: YAW };
      else if (id === "b12") target = { x: MID.x, z: MID.z, d: 20000, rx: 50, ry: YAW + 4 };
      else if (id === "b14") target = { x: MID.x, z: MID.z, d: 20000, rx: 54, ry: YAW - 4 };
      else if (id === "b16") target = { x: MID.x, z: MID.z, d: 23000, rx: 70, ry: YAW };
      else target = lineView(id);
      const travel = Math.hypot(target.x - prev.x, target.z - prev.z);
      v.push([s - 6, prev, 0]);
      v.push([s + 30, target, travel > 6000 ? travel * 0.4 : 0]);
      prev = target;
      if (id === "b13") {
        const home = { x: MID.x, z: MID.z, d: 21000, rx: 58, ry: YAW + 3 };
        v.push([s + 40, prev, 0]);
        v.push([s + 66, home, 0]);
        prev = home;
      }
    }
    return v;
  }, []);
  let view: View = views[0][1];
  for (let i = 0; i < views.length - 1; i++) {
    const [f0, v0] = views[i];
    const [f1, v1, arc] = views[i + 1];
    if (f >= f0 && f <= f1) {
      view = lerpView(v0, v1, expoInOut(clamp01((f - f0) / Math.max(1, f1 - f0))), arc);
      break;
    }
    if (f > f1) view = v1;
  }
  view = { ...view, ry: view.ry + Math.sin(f / 160) * 2 };
  const cam = camFromView(view);
  const labelScale = view.d / 3600;
  const wide = view.d > 8000;

  // ---------- geometry ----------
  const grid = useMemo(() => {
    const s: Seg3[] = [];
    for (let lat = 27.75; lat <= 31.26; lat += 0.25) {
      const major = Math.abs(lat - Math.round(lat)) < 0.01;
      for (let lon = -85.75; lon < -80.5; lon += 0.25)
        s.push({ a: [X(lon), 0, Z(lat)], b: [X(lon + 0.25), 0, Z(lat)], width: major ? 1.2 : 0.8, px: true, alpha: major ? 0.2 : 0.08 });
    }
    for (let lon = -85.75; lon <= -80.5; lon += 0.25) {
      const major = Math.abs(lon - Math.round(lon)) < 0.01;
      for (let lat = 27.75; lat < 31.25; lat += 0.25)
        s.push({ a: [X(lon), 0, Z(lat)], b: [X(lon), 0, Z(lat + 0.25)], width: major ? 1.2 : 0.8, px: true, alpha: major ? 0.2 : 0.08 });
    }
    return s;
  }, []);
  const lit = PLACES.filter((p) => f >= nodeOn(p));
  // each new place connects to its nearest already-named place: one network
  const path: Seg3[] = [];
  for (let i = 1; i < lit.length; i++) {
    const b = lit[i];
    let a = lit[0],
      best = Infinity;
    for (let j = 0; j < i; j++) {
      const d = Math.hypot(lit[j].x - b.x, lit[j].z - b.z);
      if (d < best) {
        best = d;
        a = lit[j];
      }
    }
    const t = expoOut(clamp01((f - nodeOn(b)) / 16));
    const far = best > 6000;
    const n = far ? 40 : 8;
    for (let k = 0; k < n; k++) s3(path, a, b, (k / n) * t, ((k + 1) / n) * t, far ? 1800 : 0);
  }
  // bring it home: Marianna → Orlando
  const B13 = L("b13");
  const homeT = ramp(f, B13 + 44, 40, expoInOut);
  const marianna = PLACES.find((p) => p.name === "Marianna")!;
  if (homeT > 0) for (let k = 0; k < 40; k++) s3(path, marianna, ORL, (k / 40) * homeT, ((k + 1) / 40) * homeT, 4000);

  // ---------- nodes (canvas) ----------
  const nodeRef = useRef<HTMLCanvasElement>(null);
  const pulse = beatPulse(abs, 5);
  useLayoutEffect(() => {
    const c = nodeRef.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, W, H);
    const sinRx = Math.sin((cam.rx * Math.PI) / 180);
    for (const p of PLACES) {
      const t = f - nodeOn(p);
      if (t < 0) continue;
      const pr = project([p.x, 0, p.z], cam);
      if (!pr.visible) continue;
      const fresh = Math.exp(-t / 20);
      const r = Math.max(3.4, 11 * pr.s) * (1 + 0.8 * fresh) * (1 + 0.15 * pulse);
      ctx.shadowColor = `rgba(${C.blueRGB},0.9)`;
      ctx.shadowBlur = 14;
      ctx.fillStyle = fresh > 0.2 ? "#ffffff" : C.blue;
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      if (t < 40) {
        const q = t / 40;
        const rr = (20 + 260 * expoOut(q)) * pr.s * 2;
        ctx.strokeStyle = `rgba(${C.blueRGB},${0.8 * (1 - q)})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(pr.x, pr.y, rr, rr * sinRx, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  });

  const current = LINES.filter((id) => f >= L(id) - 3).pop();
  const B16 = L("b16");

  return (
    <AbsoluteFill>
      <Field />
      {f >= LR - 6 && (
        <>
          <ParticleField cam={cam} frame={f} count={300} opacity={0.3} size={10} seed={5}
            box={{ x: [TLH.x - 15000, ORL.x + 15000], y: [-6000, -200], z: [TLH.z - 15000, ORL.z + 15000] }} drift={[0, 0, 0]} twinkle={0.7} />
          <LightPool x={960} y={600} r={1000} squash={0.4} color={C.blueRGB} opacity={0.06} />
          <Lines3D cam={cam} segs={grid} opacity={ramp(f, LR, 30)} />
          <Lines3D cam={cam} segs={path} />
          <canvas ref={nodeRef} width={W} height={H} style={{ position: "absolute", inset: 0 }} />
          <Stage3D cam={cam}>
            {PLACES.map((p) => {
              const t = f - nodeOn(p);
              if (t < 0) return null;
              const isCur = p.line === current && f < B16;
              const dim = isCur ? 1 : wide ? 0 : 0.38;
              if (dim <= 0) return null;
              const left = p.side === "l";
              return (
                <Obj key={p.name} x={p.x + (left ? -40 : 40) * labelScale} y={-20 * labelScale} z={p.z} rx={cam.rx} ry={cam.ry}
                  anchor={left ? "right" : "left"} scale={labelScale * (isCur ? 1 : 0.75)} opacity={dim * ramp(t, 0, 10)}>
                  <div style={{ textAlign: left ? "right" : "left", whiteSpace: "nowrap" }}>
                    <Mono text={`${String(p.idx).padStart(2, "0")}  ${p.lat.toFixed(2)}°N ${Math.abs(p.lon).toFixed(2)}°W`} t={t - 2} size={20} opacity={0.6} cps={90} />
                    <div style={{ fontFamily: F.hero, fontWeight: 700, fontSize: 60, color: C.white, letterSpacing: "0.01em", textTransform: "uppercase", lineHeight: 1.05 }}>
                      {p.name}
                    </div>
                  </div>
                </Obj>
              );
            })}
          </Stage3D>
        </>
      )}

      {/* hold up — the freeze */}
      {f < LR + 10 && (
        <AbsoluteFill style={{ background: "#000", opacity: 1 - ramp(f, LR - 2, 12) }}>
          <div style={{ position: "absolute", left: 956, top: 536, width: 8, height: 8, borderRadius: 4, background: C.blue, filter: glow(1.2), opacity: ramp(f, HU, 4) }} />
          <div style={{ position: "absolute", left: 990, top: 528 }}>
            <Mono text="HOLD UP…" t={f - HU - 6} size={18} opacity={0.7} cps={20} />
          </div>
        </AbsoluteFill>
      )}

      {/* BRANCHES — LET'S ROLL */}
      {f >= LR && f < L("b01") + 20 && (
        <AbsoluteFill style={{ opacity: 1 - ramp(f, L("b01") - 4, 16) }}>
          <div style={{ position: "absolute", left: 110, top: 150 }}>
            <Mono text="ROLL CALL · 01" t={f - LR} size={16} opacity={0.55} />
            <div style={{ height: 16 }} />
            <Hero text="BRANCHES" size={230} t={f - LR} dur={12} stagger={1.2} tracking={-0.035} />
            <Hero text="LET’S ROLL!" size={230} t={f - LR - 12} dur={12} stagger={1.2} tracking={-0.035} color={C.blue} />
          </div>
        </AbsoluteFill>
      )}

      {/* punchlines */}
      {Object.entries(HEROES).map(([id, text]) => {
        const s = L(id),
          e = scene(id).endFrame - off;
        if (f < s || f > e + 6) return null;
        const hs = id === "b08" || id === "b16" ? s + 4 : s + 30;
        return (
          <div key={id} style={{ position: "absolute", left: 110, top: 140, opacity: 1 - ramp(f, e - 6, 10) }}>
            <Hero text={text} size={id === "b16" ? 190 : 150} t={f - hs} dur={12} stagger={1} tracking={-0.03} lineHeight={0.95} />
          </div>
        );
      })}

      {/* HUD */}
      {f >= LR && (
        <AbsoluteFill style={{ opacity: ramp(f, LR + 20, 20) }}>
          <div style={{ position: "absolute", right: 110, top: 80, textAlign: "right" }}>
            <Mono text={`NAMES CALLED  ${String(lit.length).padStart(3, "0")} / 036`} t={999} size={15} opacity={0.55} />
            <div style={{ height: 8 }} />
            <Mono text={`${(-view.z / K + LAT0).toFixed(3)}°N  ${Math.abs(view.x / K + LON0).toFixed(3)}°W  ALT ${Math.round(-cam.y / 10)}M`} t={999} size={13} opacity={0.35} />
          </div>
          {f >= B16 + 10 && (
            <div style={{ position: "absolute", right: 110, bottom: 110, textAlign: "right" }}>
              <div style={{ fontFamily: F.hero, fontWeight: 800, fontSize: 200, color: C.blue, lineHeight: 0.9, opacity: ramp(f, B16 + 10, 14) }}>36</div>
              <Mono text="PLACES · ONE CREW" t={f - B16 - 16} size={16} opacity={0.7} />
            </div>
          )}
        </AbsoluteFill>
      )}

      <Caption f={f} offset={off} ids={LINES} prefix="B" y={930} hide={["b16"]} />
      <Flash at={LR} peak={0.3} />
      <Vignette strength={0.6} />
    </AbsoluteFill>
  );
};
