import React, { useMemo } from "react";
import { AbsoluteFill } from "remotion";
import deptData from "../../data/departments.json";
import { DJ, DJStage } from "../components/DJ";
import { Helmet } from "../components/Helmet";
import { monthX, TimelineRuler } from "../components/Timeline";
import { Field, Flash, Vignette } from "../effects/Finish";
import { ParticleField } from "../three/Particles";
import { Stage3D } from "../three/Stage3D";
import { C, glow } from "../theme";
import { Hero, Mono } from "../typography/Type";
import { baseCam } from "../utils/camera";
import { clamp01, cubicInOut, expoInOut, expoOut, mix, ramp } from "../utils/ease";
import { rng } from "../utils/random";
import { useWorld } from "../utils/scenes";
import { beatIndex, downbeatPulse } from "../utils/time";

/** Brand notch: bottom-right corner cut at the angle of the A (≈59°). */
const notch = (w: number, h: number, n: number) =>
  `polygon(0 0, ${w}px 0, ${w}px ${h - n}px, ${w - n * 0.6}px ${h}px, 0 ${h}px)`;

/**
 * Final drop + chorus. The Addapalooza DJ carries the drop: the booth lights
 * up on "ONE TEAM! ONE RHYTHM!", he performs in time with the beat while the
 * camera pushes in, then the film recalls its own worlds and collapses to one line.
 */
export const FinaleWorld: React.FC = () => {
  const { f, L, W, abs, dur } = useWorld("finale");
  const D1 = L("drop1"),
    SH = L("showem"),
    O3 = L("otor3"),
    O3B = L("otor3b"),
    O3C = L("otor3c"),
    TH = L("thisishow"),
    O4 = L("otor4"),
    BT = L("beenthrough"),
    BB = L("branchesback"),
    EC = L("everycrew");
  // word k of a line, in frames from the line's start (type lands on the sung word)
  const wt = (id: string, from: number) => Array.from({ length: 8 }, (_, k) => W(id, k) - from);
  const BR = W("branchesback", 2), // "branches"
    BO = W("branchesback", 5); // "back office"
  const db = downbeatPulse(abs, 5);
  const bi = beatIndex(abs);
  const inBar = (((bi - 2) % 4) + 4) % 4;

  const nodes = useMemo(() => {
    const r = rng(242);
    return Array.from({ length: 36 }, (_, i) => ({ x: i < 10 ? 200 + r() * 420 : 1100 + r() * 640, y: i < 10 ? 250 + r() * 260 : 420 + r() * 420 }));
  }, []);

  // ---------- the DJ shot: lights on at the drop, camera pushes in ----------
  const phDJ = f < O4 + 4;
  const phChorus = f >= O4 && f < BT + 4;
  const phTimeline = f >= BT && f < BB + 4;
  const phBranches = f >= BB && f < EC + 4;
  const phCrew = f >= EC;

  const lights = ramp(f, D1 - 1, 5, expoOut);
  // camera: wide on the drop → closer through the chorus → close-up on "this is how we move"
  // wide on the drop → fast push into the helmet → cut to the visor close-up
  const djW = 1180;
  const djX = 1140;
  const djY = 1050; // booth bottom edge
  const djH = (djW * 669) / 1118;
  const push = ramp(f, SH - 26, 26, (x) => x * x * x);
  const zoom = mix(1, 1.08, ramp(f, D1, SH - D1, cubicInOut)) * mix(1, 4.2, push);
  const HC = SH - 1; // cut to the helmet close-up
  const helmetIn = ramp(f, HC, 8, expoOut);
  const textOut = ramp(f, O4 - 6, 8);
  const tlCam = { ...baseCam(40), x: mix(monthX(11) + 400, monthX(0) - 600, expoInOut(ramp(f, BT, BB - BT))), y: -150, ry: -30, rx: 6 };

  // chorus text: one block that re-hits on each sung repetition
  const hits = [D1, O3, O3B, O3C];
  const lastHit = hits.filter((h) => f >= h).pop() ?? D1;
  const hitIdx = hits.indexOf(lastHit);

  return (
    <AbsoluteFill>
      <Field />

      {phDJ && f < HC + 2 && (
        <AbsoluteFill>
          <DJStage abs={abs} lights={lights} cx={djX} cy={djY - djH * 0.9} />
          <ParticleField cam={baseCam(40, { z: 1483 - f * 2 })} frame={f} count={320} opacity={0.45 * lights} size={1.9} seed={226}
            box={{ x: [-2600, 2600], y: [-1500, 1500], z: [-5000, 900] }} drift={[0, -0.6, 0]} />
          <div style={{ position: "absolute", left: 0, top: djY - djH * 0.6, width: 1920, height: 4, background: C.blue, filter: glow(0.8), opacity: lights * (1 - push),
            transform: `scaleX(${ramp(f, D1, 18, expoOut)})`, transformOrigin: "0 50%" }} />
          {/* push toward the helmet: transform origin sits on his head */}
          <div style={{ position: "absolute", left: djX, top: djY, transform: `translate(-50%,-100%) scale(${zoom})`, transformOrigin: "51.4% 9%" }}>
            <DJ abs={abs} width={djW} lights={0.15 + 0.85 * lights} energy={f < D1 ? 0 : 1} />
          </div>
          {f >= D1 && (
            <div style={{ position: "absolute", left: 110, top: 150, opacity: 1 - ramp(f, SH - 20, 10) }}>
              <Hero text="ONE TEAM!" size={130} t={f - D1} dur={8} stagger={1} tracking={-0.035} />
              <Hero text="ONE RHYTHM!" size={130} t={f - W("drop1", 2)} dur={8} stagger={1} tracking={-0.035} color={C.blue} />
            </div>
          )}
        </AbsoluteFill>
      )}

      {/* the helmet: lyrics on the visor */}
      {phDJ && f >= HC && (
        <AbsoluteFill style={{ opacity: 1 - ramp(f, O4 - 4, 6) }}>
          <DJStage abs={abs} lights={1} cx={960} cy={140} />
          <ParticleField cam={baseCam(40, { z: 1483 - f * 1.5 })} frame={f} count={260} opacity={0.4} size={1.8} seed={229}
            box={{ x: [-2600, 2600], y: [-1500, 1500], z: [-5000, 900] }} drift={[0, -0.5, 0]} />
          <div style={{ position: "absolute", left: 960, top: 1100,
            transform: `translate(-50%,-100%) scale(${mix(1.25, 1, helmetIn) * mix(1, 1.07, ramp(f, HC, O4 - HC, cubicInOut))})`, transformOrigin: "50% 60%" }}>
            <Helmet abs={abs} height={1140} ids={["showem", "otor3", "otor3b", "otor3c", "thisishow"]} />
          </div>
          <div style={{ position: "absolute", left: 110, top: 96 }}>
            <Mono text="ADDAPALOOZA · LIVE" t={f - HC} size={16} opacity={0.6} />
          </div>
          <div style={{ position: "absolute", left: 110, bottom: 96, display: "flex", gap: 12 }}>
            {[0, 1, 2, 3].map((k) => (
              <div key={k} style={{ width: 110, height: 5, background: k === inBar ? C.blue : "rgba(255,255,255,0.16)", boxShadow: k === inBar ? `0 0 14px rgba(${C.blueRGB},0.8)` : undefined }} />
            ))}
          </div>
        </AbsoluteFill>
      )}

      {/* chorus call-back, the DJ still playing behind the type */}
      {phChorus && (
        <AbsoluteFill style={{ opacity: 1 - ramp(f, BT - 2, 6) }}>
          <div style={{ position: "absolute", left: 1330, top: 1070, transform: "translate(-50%,-100%)", opacity: 0.32 }}>
            <DJ abs={abs} width={1000} lights={0.8} />
          </div>
          <div style={{ position: "absolute", left: 110, top: 200, transform: `scale(${1 + 0.025 * db})`, transformOrigin: "0 50%" }}>
            <Hero text="ONE TEAM!" size={240} t={f - O4} dur={10} stagger={1} tracking={-0.04} />
            <Hero text="ONE RHYTHM!" size={240} t={f - W("otor4", 2)} dur={10} stagger={1} tracking={-0.04} color={C.blue} />
          </div>
          <div style={{ position: "absolute", left: 110, top: 740, display: "flex", gap: 22 }}>
            {[0, 1, 2, 3].map((k) => (
              <div key={k} style={{ width: 360, height: 6, background: k === inBar ? C.blue : "rgba(255,255,255,0.14)", boxShadow: k === inBar ? `0 0 16px rgba(${C.blueRGB},0.8)` : undefined }} />
            ))}
          </div>
        </AbsoluteFill>
      )}

      {/* look at everything we've been through — the year rewinds */}
      {phTimeline && (
        <AbsoluteFill style={{ opacity: ramp(f, BT, 5) * (1 - ramp(f, BB - 2, 6)) }}>
          <Stage3D cam={tlCam}>
            <TimelineRuler labelSize={34} active={Math.max(0, Math.min(11, Math.round((tlCam.x + 300 - monthX(0)) / 700)))} />
          </Stage3D>
          <div style={{ position: "absolute", left: 110, top: 130 }}>
            <Hero text={"LOOK AT EVERYTHING\nWE’VE BEEN THROUGH!"} size={104} t={f - BT} dur={8} stagger={0.4} wordTimes={wt("beenthrough", BT)} tracking={-0.03} lineHeight={0.95} />
          </div>
        </AbsoluteFill>
      )}

      {/* from the branches to the back office */}
      {phBranches && (
        <AbsoluteFill style={{ opacity: ramp(f, BB, 5) * (1 - ramp(f, EC - 2, 6)) }}>
          <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
            {nodes.map((n, i) => {
              if (i === 0) return null;
              let j = 0,
                best = 1e9;
              for (let k = 0; k < i; k++) {
                const d = Math.hypot(nodes[k].x - n.x, nodes[k].y - n.y);
                if (d < best) {
                  best = d;
                  j = k;
                }
              }
              const t = clamp01((f - BR + 2 - i * 0.6) / 8);
              return <line key={i} x1={nodes[j].x} y1={nodes[j].y} x2={mix(nodes[j].x, n.x, t)} y2={mix(nodes[j].y, n.y, t)} stroke={C.blue} strokeWidth={1.6} opacity={0.8} />;
            })}
            {nodes.map((n, i) => (
              <circle key={`c${i}`} cx={n.x} cy={n.y} r={4.5} fill={C.white} opacity={clamp01((f - BR + 2 - i * 0.6) / 4)} />
            ))}
          </svg>
          <div style={{ position: "absolute", left: 0, top: 950, width: 1920, height: 4, background: C.blue, filter: glow(0.8), transform: `scaleX(${ramp(f, BO - 2, 20, expoOut)})`, transformOrigin: "0 50%" }} />
          {deptData.departments.slice(0, 12).map((d, i) => (
            <div key={d.id} style={{ position: "absolute", top: 966, left: 110 + i * 150 - (f - BB) * 3, opacity: clamp01((f - BO + 2 - i) / 6) }}>
              <Mono text={d.name.split("\n")[0]} t={999} size={12} opacity={0.6} />
            </div>
          ))}
          <div style={{ position: "absolute", left: 110, top: 600 }}>
            <Hero text={"FROM THE BRANCHES\nTO THE BACK OFFICE,"} size={96} t={f - BB} dur={8} stagger={0.4} wordTimes={wt("branchesback", BB)} tracking={-0.03} lineHeight={0.95} />
          </div>
        </AbsoluteFill>
      )}

      {/* every team and every crew → one line */}
      {phCrew && (
        <AbsoluteFill>
          <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
            {Array.from({ length: 14 }, (_, k) => {
              const t = expoInOut(ramp(f, EC + 8, 26));
              const y0 = 90 + k * 70;
              const a = (k - 7) * 5 * (1 - t);
              return (
                <line key={k} x1={0} x2={1920} y1={mix(y0, 540, t) - Math.tan((a * Math.PI) / 180) * 960} y2={mix(y0, 540, t) + Math.tan((a * Math.PI) / 180) * 960}
                  stroke={k === 7 ? C.blue : C.white} strokeWidth={k === 7 ? 4 : 1.2} opacity={k === 7 ? 1 : 0.55 * (1 - ramp(f, EC + 30, 10))} style={k === 7 ? { filter: glow(0.8) } : undefined} />
              );
            })}
          </svg>
          <div style={{ position: "absolute", left: 110, top: 190, opacity: 1 - ramp(f, dur - 16, 10) }}>
            <Hero text={"EVERY TEAM\nAND EVERY CREW,"} size={110} t={f - EC} dur={8} stagger={0.4} wordTimes={wt("everycrew", EC)} tracking={-0.03} lineHeight={0.95} />
          </div>
        </AbsoluteFill>
      )}

      <Flash at={D1} peak={0.6} dur={10} />
      <Flash at={SH - 1} peak={0.35} dur={8} />
      <Vignette strength={0.62} />
    </AbsoluteFill>
  );
};

