import React, { useMemo } from "react";
import { AbsoluteFill } from "remotion";
import deptData from "../../data/departments.json";
import { Field, LightPool, Vignette } from "../effects/Finish";
import { Lines3D, Seg3 } from "../three/Lines3D";
import { C, glow } from "../theme";
import { Hero, Mono } from "../typography/Type";
import { baseCam } from "../utils/camera";
import { clamp01, expoIn, expoInOut, expoOut, mix, ramp } from "../utils/ease";
import { rng } from "../utils/random";
import { useWorld } from "../utils/scenes";
import { beatPulse, energy } from "../utils/time";

/** Beat builds — rapid recall of the film's worlds, then everything → one line. */
export const BuildWorld: React.FC = () => {
  const { f, L, abs, dur } = useWorld("build");
  const OF = L("offices"),
    RO = L("roles2"),
    ST = L("stories2"),
    RD = L("roads2"),
    RH = L("rhythmstarts"),
    MA = L("moveasone");
  const words: Array<[number, number, string]> = [
    [OF, RO, "OFFICES."],
    [RO, ST, "ROLES."],
    [ST, RD, "STORIES."],
    [RD, RH, "ROADS."],
  ];
  const base = baseCam(40);

  // offices: windows on two facades receding
  const offices = useMemo(() => {
    const s: Seg3[] = [];
    for (const side of [-1, 1])
      for (let z = -200; z > -9000; z -= 420)
        for (let y = -900; y < 900; y += 220) {
          const x = side * 700;
          const w = 150;
          s.push({ a: [x, y, z], b: [x, y, z - w], width: 1.5, px: true, alpha: 0.5 });
          s.push({ a: [x, y + 120, z], b: [x, y + 120, z - w], width: 1.5, px: true, alpha: 0.5 });
          s.push({ a: [x, y, z], b: [x, y + 120, z], width: 1.5, px: true, alpha: 0.5 });
          s.push({ a: [x, y, z - w], b: [x, y + 120, z - w], width: 1.5, px: true, alpha: 0.5 });
        }
    return s;
  }, []);
  const roads = useMemo(() => {
    const s: Seg3[] = [];
    for (let z = 0; z > -30000; z -= 500) {
      s.push({ a: [0, 260, z], b: [0, 260, z - 500], color: C.blueRGB, width: 6, glow: 8 });
      for (const x of [-240, 240, -900, 900]) s.push({ a: [x, 260, z], b: [x, 260, z - 250], width: 4, alpha: 0.5 });
    }
    return s;
  }, []);
  const stories = useMemo(() => {
    const r = rng(218);
    return Array.from({ length: 22 }, () => ({ x: r() * 1920, y: 80 + r() * 920, len: 200 + r() * 700, a: (r() - 0.5) * 70 }));
  }, []);

  const collapse = ramp(f, RH, 20, expoInOut);
  const lock = ramp(f, MA, 8, expoOut);
  const tremble = (1 - lock) * collapse * (6 + 22 * beatPulse(abs, 8)) * (0.6 + energy(abs) * 0.4);

  const inOf = f >= OF && f < RO + 4;
  const inRo = f >= RO && f < ST + 4;
  const inSt = f >= ST && f < RD + 4;
  const inRd = f >= RD && f < RH + 22;
  const zPush = (s: number) => -(f - s) * 90 - expoIn(clamp01((f - s) / 40)) * 2000;

  return (
    <AbsoluteFill>
      <Field />
      {inOf && <Lines3D cam={{ ...base, z: base.z + zPush(OF) }} segs={offices} opacity={ramp(f, OF, 6) * (1 - ramp(f, RO - 2, 6))} fadeFar={9000} />}
      {inRo && (
        <AbsoluteFill style={{ opacity: ramp(f, RO, 6) * (1 - ramp(f, ST - 2, 6)) }}>
          {deptData.departments.slice(0, 14).map((d, i) => (
            <div key={d.id} style={{ position: "absolute", top: 80 + i * 66, left: 2000 - ((f - RO) * (40 + (i % 4) * 14) + i * 300) % 2600, whiteSpace: "nowrap" }}>
              <Mono text={d.name.replace("\n", " ")} t={999} size={30} opacity={0.35 + (i % 3) * 0.2} color={i % 5 === 0 ? C.blue : C.white} weight={500} />
            </div>
          ))}
        </AbsoluteFill>
      )}
      {inSt && (
        <AbsoluteFill style={{ opacity: ramp(f, ST, 6) * (1 - ramp(f, RD - 2, 6)) }}>
          {stories.map((s, i) => (
            <div key={i} style={{ position: "absolute", left: s.x, top: s.y, width: s.len * expoOut(clamp01((f - ST - i * 0.5) / 12)), height: 1.5, background: C.white, opacity: 0.6,
              transform: `rotate(${s.a}deg)`, transformOrigin: "0 50%" }} />
          ))}
        </AbsoluteFill>
      )}
      {inRd && <Lines3D cam={{ ...base, rx: 3, z: base.z + zPush(RD) }} segs={roads} opacity={ramp(f, RD, 6) * (1 - collapse)} fadeFar={24000} />}

      {/* everything collapses into one line */}
      {f >= RH - 2 && (
        <AbsoluteFill>
          <LightPool x={960} y={540} r={900} squash={0.2} color={C.blueRGB} opacity={0.12 * collapse + 0.1 * lock} />
          <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
            {[0, 1, 2, 3, 4, 5].map((k) => {
              const y0 = mix(200 + k * 140, 540, collapse);
              let d = "";
              for (let x = 0; x <= 1920; x += 16) {
                const w = Math.sin((Math.PI * x) / 1920);
                const y = y0 + Math.sin(x * 0.03 + f * 0.9 + k) * tremble * w * (k === 0 ? 1 : 0.6);
                d += `${x ? "L" : "M"}${x} ${y.toFixed(1)}`;
              }
              return <path key={k} d={d} fill="none" stroke={k === 0 ? C.blue : C.white} strokeWidth={k === 0 ? mix(3, 5, lock) : 1.2} opacity={k === 0 ? 1 : 0.5 * (1 - lock)}
                style={k === 0 ? { filter: glow(0.8 + lock) } : undefined} />;
            })}
          </svg>
        </AbsoluteFill>
      )}

      {/* DIFFERENT … */}
      {f < RH + 4 && (
        <div style={{ position: "absolute", left: 110, top: 260, opacity: 1 - ramp(f, RH - 4, 8) }}>
          <div style={{ position: "absolute", inset: "-40px -60px", background: "radial-gradient(closest-side, rgba(6,7,8,0.8), rgba(6,7,8,0))" }} />
          <div style={{ position: "relative" }}>
            <Hero text="DIFFERENT" size={170} t={f - OF} dur={10} stagger={0.8} tracking={-0.035} />
            {words.map(([s, e, w]) =>
              f >= s && f < e ? (
                <Hero key={w} text={w} size={170} t={f - s} dur={8} stagger={0.8} tracking={-0.035} color={C.blue} />
              ) : null,
            )}
          </div>
        </div>
      )}
      {f >= RH && f < MA + 2 && (
        <div style={{ position: "absolute", left: 110, top: 330 }}>
          <Hero text={"BUT WHEN THE\nRHYTHM STARTS…"} size={92} t={f - RH} dur={10} stagger={0.6} tracking={-0.03} lineHeight={0.98} />
        </div>
      )}
      {f >= MA && (
        <div style={{ position: "absolute", left: 110, top: 150 }}>
          <Hero text={"WE MOVE\nAS ONE."} size={230} t={f - MA} dur={10} stagger={1} tracking={-0.04} lineHeight={0.9} />
        </div>
      )}
      <Vignette strength={0.6} />
      <AbsoluteFill style={{ background: "#000", opacity: ramp(f, dur - 6, 5) }} />
    </AbsoluteFill>
  );
};
