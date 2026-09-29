import React, { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill } from "remotion";
import { BrandLine, Logo, PlusMark } from "../components/Brand";
import { Field, Flash, LightPool, Vignette } from "../effects/Finish";
import { C, glow } from "../theme";
import { Hero, Mono } from "../typography/Type";
import { H, W } from "../utils/camera";
import { clamp01, cubicInOut, expoIn, expoInOut, expoOut, mix, ramp } from "../utils/ease";
import { rng } from "../utils/random";
import { useWorld } from "../utils/scenes";
import { downbeatPulse } from "../utils/time";

const PC = { x: 960, y: 450 }; // plus centre

export const ClimaxWorld: React.FC = () => {
  const { f, L, abs, dur } = useWorld("climax");
  const TS = L("test"),
    TG = L("together"),
    stamps = [L("learned2"), L("taught2"), L("changed2"), L("grew2")],
    OT = L("oneteam5"),
    OR = L("onerhythm5"),
    AC = L("acu1");
  const db = downbeatPulse(abs, 5);

  // lines from every direction
  const rays = useMemo(() => {
    const r = rng(247);
    return Array.from({ length: 28 }, (_, i) => {
      const a = (i / 28) * Math.PI * 2 + r() * 0.2;
      return { a, len: 400 + r() * 700, d: r() * 6, horiz: i % 2 === 0 };
    });
  }, []);
  const burst = useMemo(() => {
    const r = rng(2471);
    return Array.from({ length: 260 }, () => ({ a: r() * Math.PI * 2, v: 8 + r() * 38, s: 1 + r() * 2.5, b: r() < 0.3 }));
  }, []);
  const burstRef = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const c = burstRef.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, W, H);
    const t = f - (TG + 14);
    if (t < 0 || t > 80) return;
    for (const p of burst) {
      const d = p.v * (1 - Math.exp(-t / 14)) * 14;
      const x = PC.x + Math.cos(p.a) * d,
        y = PC.y + Math.sin(p.a) * d * 0.8;
      ctx.fillStyle = p.b ? `rgba(0,178,227,${1 - t / 80})` : `rgba(255,255,255,${0.8 * (1 - t / 80)})`;
      ctx.beginPath();
      ctx.arc(x, y, p.s, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  const tension = ramp(f, TS, TG - TS, expoIn);
  const lock = ramp(f, TG + 4, 12, expoOut);
  const plusOut = ramp(f, stamps[0] - 8, 10, expoInOut);
  const stampOut = ramp(f, OT - 4, 6);

  return (
    <AbsoluteFill>
      <Field />
      {/* 2026 put us to the test — a line held under tension */}
      {f < TG + 6 && (
        <AbsoluteFill>
          <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
            <path
              d={`M0 640 Q 960 ${640 + Math.sin(f * 1.7) * 14 * tension + 60 * tension} 1920 640`}
              stroke={C.blue}
              strokeWidth={3 + 2 * tension}
              fill="none"
              style={{ filter: glow(0.6 + tension) }}
            />
          </svg>
          <div style={{ position: "absolute", left: 960, top: 640, transform: `translate(-50%,-78%) translateX(${Math.sin(f * 2.3) * 3 * tension}px)` }}>
            <Hero text="2026" size={400} t={f - TS + 4} dur={8} stagger={1.2} tracking={-0.045} />
          </div>
          <div style={{ position: "absolute", left: 110, top: 720 }}>
            <Mono text="PUT US TO THE TEST —" t={f - TS - 6} size={22} opacity={0.7} cps={40} weight={500} />
          </div>
        </AbsoluteFill>
      )}

      {/* LOOK WHAT TOGETHER CAN DO */}
      {f >= TG - 2 && f < stamps[0] + 6 && (
        <AbsoluteFill style={{ opacity: 1 - plusOut }}>
          <LightPool x={PC.x} y={PC.y} r={900} color={C.blueRGB} opacity={0.25 * lock} />
          {rays.map((r, i) => {
            const t = expoIn(clamp01((f - TG - r.d) / 12));
            const far = 1500;
            const x = PC.x + Math.cos(r.a) * mix(far, 0, t),
              y = PC.y + Math.sin(r.a) * mix(far, 0, t);
            const ang = r.horiz ? 0 : 90;
            return (
              <div key={i} style={{ position: "absolute", left: x - r.len / 2, top: y - 1.5, width: r.len * mix(1, 0.3, t), height: 3, background: i % 3 ? C.white : C.blue,
                opacity: (1 - lock) * 0.8, transform: `rotate(${ang}deg)` }} />
            );
          })}
          <div style={{ position: "absolute", left: PC.x, top: PC.y, transform: `translate(-50%,-50%) scale(${mix(1.3, 1, lock) * (1 + 0.03 * db)})` }}>
            <PlusMark size={440} h={lock} v={ramp(f, TG + 7, 10, expoOut)} glowAmt={1.2} />
          </div>
          <canvas ref={burstRef} width={W} height={H} style={{ position: "absolute", inset: 0 }} />
          <div style={{ position: "absolute", left: 960, top: 760, transform: "translateX(-50%)", textAlign: "center" }}>
            <Mono text="LOOK WHAT" t={f - TG} size={26} opacity={0.8} weight={500} style={{ textAlign: "center" }} />
            <Hero text="TOGETHER" size={200} t={f - TG - 2} dur={10} stagger={1} tracking={-0.04} align="center" />
            <Mono text="CAN DO!" t={f - TG - 20} size={26} opacity={0.8} weight={500} style={{ textAlign: "center" }} />
          </div>
        </AbsoluteFill>
      )}

      {/* We learned! We taught! We changed! We grew! */}
      {f >= stamps[0] - 2 && f < OT + 2 && (
        <AbsoluteFill style={{ opacity: 1 - stampOut }}>
          {["LEARNED!", "TAUGHT!", "CHANGED!", "GREW!"].map((w, i) => {
            const t = f - stamps[i];
            if (t < -1) return null;
            const x = i % 2 === 0 ? 110 : 1010,
              y = i < 2 ? 190 : 600;
            return (
              <div key={w} style={{ position: "absolute", left: x, top: y, transform: `scale(${1 + 0.05 * Math.exp(-Math.max(0, t) / 4)})`, transformOrigin: "0 0" }}>
                <Mono text={`WE · 0${i + 1}`} t={t} size={18} opacity={0.6} color={i === 3 ? C.blue : C.white} />
                <Hero text={w} size={170} t={t} dur={6} stagger={0.5} tracking={-0.04} color={i === 3 ? C.blue : C.white} />
              </div>
            );
          })}
          <div style={{ position: "absolute", left: 0, top: 540, width: 1920, height: 3, background: C.blue, filter: glow(0.7), transform: `scaleX(${ramp(f, stamps[0], 30, expoOut)})` }} />
        </AbsoluteFill>
      )}

      {/* ONE TEAM! / ONE RHYTHM! */}
      {f >= OT - 2 && f < AC + 2 && (
        <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center", opacity: 1 - ramp(f, AC - 3, 5) }}>
          <div style={{ transform: `scale(${1 + 0.03 * db})` }}>
            {f < OR ? (
              <Hero text="ONE TEAM!" size={330} t={f - OT} dur={8} stagger={1} tracking={-0.045} align="center" />
            ) : (
              <Hero text="ONE RHYTHM!" size={300} t={f - OR} dur={8} stagger={1} tracking={-0.045} align="center" color={C.blue} />
            )}
          </div>
        </AbsoluteFill>
      )}

      {/* ADDITION FINANCIAL CREDIT UNION! */}
      {f >= AC - 2 && (
        <AbsoluteFill style={{ opacity: 1 - ramp(f, dur - 10, 10) }}>
          <LightPool x={960} y={540} r={1000} squash={0.4} color={C.blueRGB} opacity={0.12} />
          {(() => {
            const LW = 980;
            const s = LW / 155.072;
            const barY = 540;
            const top = barY - (219.968 - 207.885 + 10.673) * s;
            const reveal = ramp(f, AC, 16, expoOut);
            const lines = ramp(f, AC + 8, 26, expoOut);
            return (
              <>
                <div style={{ position: "absolute", left: 960 - LW / 2, top, clipPath: `inset(0 ${(1 - reveal) * 50}% 0 ${(1 - reveal) * 50}%)`, transform: `scale(${mix(1.06, 1, reveal) + 0.01 * ramp(f, AC, 80, cubicInOut)})` }}>
                  <Logo width={LW} />
                </div>
                <div style={{ position: "absolute", right: 960 + LW / 2 + 60, top: barY - (5.174 * s) / 2 }}>
                  <BrandLine length={1000} thickness={5.174 * s} progress={lines} from="right" glowAmt={0.3} />
                </div>
                <div style={{ position: "absolute", left: 960 + LW / 2 + 60, top: barY - (5.174 * s) / 2 }}>
                  <BrandLine length={1000} thickness={5.174 * s} progress={lines} from="left" glowAmt={0.3} />
                </div>
              </>
            );
          })()}
        </AbsoluteFill>
      )}

      <Flash at={TG} peak={0.55} dur={10} />
      <Flash at={AC} peak={0.3} />
      <Vignette strength={0.6} />
    </AbsoluteFill>
  );
};

