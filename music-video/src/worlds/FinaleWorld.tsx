import React, { useMemo } from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import deptData from "../../data/departments.json";
import { monthX, TimelineRuler } from "../components/Timeline";
import { Field, Flash, LightPool, Vignette } from "../effects/Finish";
import { ParticleField } from "../three/Particles";
import { PlusMonument } from "../three/PlusMonument";
import { Stage3D } from "../three/Stage3D";
import { C, glow } from "../theme";
import { Hero, Mono } from "../typography/Type";
import { baseCam } from "../utils/camera";
import { clamp01, cubicInOut, expoInOut, expoOut, mix, ramp } from "../utils/ease";
import { rng } from "../utils/random";
import { useWorld } from "../utils/scenes";
import { beatIndex, beatPulse, downbeatPulse } from "../utils/time";

/** Brand notch: bottom-right corner cut at the angle of the A (≈59°). */
const notch = (w: number, h: number, n: number) =>
  `polygon(0 0, ${w}px 0, ${w}px ${h - n}px, ${w - n * 0.6}px ${h}px, 0 ${h}px)`;

export const FinaleWorld: React.FC = () => {
  const { f, L, abs, dur } = useWorld("finale");
  const JX = L("jax"),
    RY = L("ready"),
    SH = L("showem"),
    O3 = L("otor3"),
    TH = L("thisishow"),
    O4 = L("otor4"),
    BT = L("beenthrough"),
    BB = L("branchesback"),
    EC = L("everycrew");
  const pulse = beatPulse(abs, 6);
  const db = downbeatPulse(abs, 5);
  const bi = beatIndex(abs);
  const inBar = (((bi - 2) % 4) + 4) % 4;

  const nodes = useMemo(() => {
    const r = rng(242);
    return Array.from({ length: 36 }, (_, i) => ({ x: i < 10 ? 200 + r() * 420 : 1100 + r() * 640, y: i < 10 ? 250 + r() * 260 : 420 + r() * 420 }));
  }, []);

  // ---------- phases ----------
  const phHelmet = f < RY + 6;
  const phMonument = f >= RY - 2 && f < TH + 4;
  const phBooth = f >= TH && f < O4 + 4;
  const phChorus = f >= O4 && f < BT + 4;
  const phTimeline = f >= BT && f < BB + 4;
  const phBranches = f >= BB && f < EC + 4;
  const phCrew = f >= EC;

  const monIn = expoOut(ramp(f, RY, 16));
  const rotY = (f - RY) * 0.022 + (1 - monIn) * 2.2;

  const tlCam = { ...baseCam(40), x: mix(monthX(11) + 400, monthX(0) - 600, expoInOut(ramp(f, BT, BB - BT))), y: -150, ry: -30, rx: 6 };

  return (
    <AbsoluteFill>
      <Field />

      {/* JAX… — the helmet, lit by its own visor */}
      {phHelmet && (
        <AbsoluteFill style={{ background: "#000" }}>
          <LightPool x={1240} y={470} r={520} color={C.blueRGB} opacity={0.22 * ramp(f, JX + 10, 60) + 0.25 * ramp(f, RY - 8, 8)} />
          {/* the line passes behind him */}
          <div style={{ position: "absolute", left: 0, top: 560, width: 1920 * ramp(f, JX + 20, 50, expoOut), height: 3, background: C.blue, filter: glow(0.8) }} />
          <div
            style={{
              position: "absolute",
              left: 1240,
              top: 520,
              transform: `translate(-50%,-50%) scale(${mix(1.0, 1.08, ramp(f, JX, RY - JX, cubicInOut))})`,
              filter: `brightness(${mix(0.05, 1, ramp(f, JX + 6, 70, cubicInOut)) + 0.6 * ramp(f, RY - 6, 6)}) contrast(1.1)`,
              WebkitMaskImage: `radial-gradient(ellipse 60% 62% at 50% 45%, #000 ${mix(10, 60, ramp(f, JX, 60))}%, transparent 100%)`,
            }}
          >
            <Img src={staticFile("images/dj-helmet-front.png")} style={{ height: 620, display: "block" }} />
          </div>
          <div style={{ position: "absolute", left: 110, top: 630 }}>
            <Mono text="FINAL BUILD · 222.6" t={f - JX} size={15} opacity={0.5} />
            <div style={{ height: 16 }} />
            <Hero text="JAX…" size={240} t={f - JX - 4} dur={16} stagger={3} tracking={-0.04} />
          </div>
        </AbsoluteFill>
      )}

      {/* YOU READY? → monument → ONE TEAM ONE RHYTHM */}
      {phMonument && (
        <AbsoluteFill style={{ opacity: 1 - ramp(f, TH - 2, 6) }}>
          <ParticleField cam={baseCam(40, { z: 1483 - (f - RY) * 4 })} frame={f} count={380} opacity={0.5} size={2} seed={226}
            box={{ x: [-2600, 2600], y: [-1500, 1500], z: [-5000, 1000] }} drift={[0, 0, 0]} />
          <LightPool x={1180} y={540} r={760} color={C.blueRGB} opacity={0.16 + 0.1 * pulse} />
          <AbsoluteFill style={{ transform: "translateX(400px) translateY(40px)" }}>
            <PlusMonument rotY={rotY} rotX={0.18 + Math.sin(f / 50) * 0.08} scale={0.78 * monIn * (1 + 0.03 * db)} glowAmt={pulse} ringT={(f - RY) * 0.05} />
          </AbsoluteFill>
          <div style={{ position: "absolute", left: 110, top: 150 }}>
            {f < SH && <Hero text={"YOU\nREADY?"} size={220} t={f - RY + 2} dur={8} stagger={1} tracking={-0.04} lineHeight={0.9} color={C.blue} />}
            {f >= SH && f < O3 && <Hero text={"LET’S SHOW ’EM\nHOW WE MOVE."} size={120} t={f - SH} dur={10} stagger={0.6} tracking={-0.03} lineHeight={0.95} />}
            {f >= O3 && (
              <>
                <Hero text="ONE TEAM!" size={160} t={f - O3} dur={10} stagger={1} tracking={-0.035} />
                <Hero text="ONE RHYTHM!" size={160} t={f - O3 - 14} dur={10} stagger={1} tracking={-0.035} color={C.blue} />
              </>
            )}
          </div>
        </AbsoluteFill>
      )}

      {/* THIS IS HOW WE MOVE — the DJ at the booth */}
      {phBooth && (
        <AbsoluteFill style={{ opacity: ramp(f, TH, 5) * (1 - ramp(f, O4 - 2, 6)) }}>
          <div style={{ position: "absolute", left: 0, top: 500, width: 1920, height: 4, background: C.blue, filter: glow(0.8) }} />
          <div
            style={{
              position: "absolute",
              left: 620,
              top: 170,
              width: 1200,
              height: 720,
              clipPath: notch(1200, 720, 140),
              background: "#050607",
              transform: `scale(${mix(1, 1.05, ramp(f, TH, O4 - TH))})`,
              transformOrigin: "60% 40%",
            }}
          >
            <Img src={staticFile("images/dj-booth.png")} style={{ position: "absolute", left: 10, top: 20, width: 1180, filter: "brightness(0.9) saturate(0.9) contrast(1.05)" }} />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(5,6,7,0) 55%, rgba(5,6,7,0.7) 100%)" }} />
          </div>
          <div style={{ position: "absolute", left: 110, top: 700 }}>
            <Mono text="ADDAPALOOZA · LIVE" t={f - TH} size={15} opacity={0.55} />
            <div style={{ height: 14 }} />
            <Hero text={"THIS IS HOW\nWE MOVE!"} size={88} t={f - TH} dur={10} stagger={0.8} tracking={-0.035} lineHeight={0.95} />
          </div>
        </AbsoluteFill>
      )}

      {/* chorus call-back */}
      {phChorus && (
        <AbsoluteFill style={{ opacity: 1 - ramp(f, BT - 2, 6) }}>
          <div style={{ position: "absolute", left: 110, top: 230, transform: `scale(${1 + 0.025 * db})`, transformOrigin: "0 50%" }}>
            <Hero text="ONE TEAM!" size={260} t={f - O4} dur={10} stagger={1} tracking={-0.04} />
            <Hero text="ONE RHYTHM!" size={260} t={f - O4 - 14} dur={10} stagger={1} tracking={-0.04} color={C.blue} />
          </div>
          <div style={{ position: "absolute", left: 110, top: 800, display: "flex", gap: 22 }}>
            {[0, 1, 2, 3].map((k) => (
              <div key={k} style={{ width: 400, height: 6, background: k === inBar ? C.blue : "rgba(255,255,255,0.14)", boxShadow: k === inBar ? `0 0 16px rgba(${C.blueRGB},0.8)` : undefined }} />
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
            <Hero text={"LOOK AT EVERYTHING\nWE’VE BEEN THROUGH!"} size={104} t={f - BT} dur={10} stagger={0.5} tracking={-0.03} lineHeight={0.95} />
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
              const t = clamp01((f - BB - i * 0.6) / 8);
              return <line key={i} x1={nodes[j].x} y1={nodes[j].y} x2={mix(nodes[j].x, n.x, t)} y2={mix(nodes[j].y, n.y, t)} stroke={C.blue} strokeWidth={1.6} opacity={0.8} />;
            })}
            {nodes.map((n, i) => (
              <circle key={`c${i}`} cx={n.x} cy={n.y} r={4.5} fill={C.white} opacity={clamp01((f - BB - i * 0.6) / 4)} />
            ))}
          </svg>
          <div style={{ position: "absolute", left: 0, top: 950, width: 1920, height: 4, background: C.blue, filter: glow(0.8), transform: `scaleX(${ramp(f, BB + 26, 20, expoOut)})`, transformOrigin: "0 50%" }} />
          {deptData.departments.slice(0, 12).map((d, i) => (
            <div key={d.id} style={{ position: "absolute", top: 966, left: 110 + i * 150 - (f - BB) * 3, opacity: clamp01((f - BB - 26 - i) / 6) }}>
              <Mono text={d.name.split("\n")[0]} t={999} size={12} opacity={0.6} />
            </div>
          ))}
          <div style={{ position: "absolute", left: 110, top: 600 }}>
            <Hero text={"FROM THE BRANCHES\nTO THE BACK OFFICE,"} size={96} t={f - BB} dur={10} stagger={0.5} tracking={-0.03} lineHeight={0.95} />
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
            <Hero text={"EVERY TEAM\nAND EVERY CREW,"} size={110} t={f - EC} dur={10} stagger={0.6} tracking={-0.03} lineHeight={0.95} />
          </div>
        </AbsoluteFill>
      )}

      <Flash at={RY} peak={0.6} dur={10} />
      <Flash at={TH} peak={0.18} />
      <Vignette strength={0.62} />
    </AbsoluteFill>
  );
};

