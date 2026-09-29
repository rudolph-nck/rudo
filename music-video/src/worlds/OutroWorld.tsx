import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { Logo } from "../components/Brand";
import { Field, Flash, LightPool, Vignette } from "../effects/Finish";
import { ParticleField } from "../three/Particles";
import { C, glow } from "../theme";
import { Hero, Mono } from "../typography/Type";
import { baseCam } from "../utils/camera";
import { cubicInOut, expoIn, expoInOut, expoOut, mix, ramp } from "../utils/ease";
import { useWorld } from "../utils/scenes";
import { beatPulse } from "../utils/time";

const LOGO_W = 1040;
const LOGO_H = LOGO_W * (768 / 1376);

export const OutroWorld: React.FC = () => {
  const { f, L, T, abs, dur } = useWorld("outro");
  const O1 = L("oneteam6"),
    O2 = L("onemission"),
    O3 = L("onerhythm6"),
    WE = L("welcome"),
    SU = L("summit");
  const HIT = T(273.04);
  const END = T(280.8);
  const pulse = beatPulse(abs, 6);

  const threeOut = ramp(f, WE - 8, 12, cubicInOut);
  const sweep = ramp(f, WE, 40, cubicInOut);
  const lift = ramp(f, HIT, 26, expoInOut);
  const retract = ramp(f, END, 26, expoIn);
  const allOut = ramp(f, END - 6, 14, cubicInOut);
  const lineLen = 1920 * ramp(f, 0, 30, expoOut) * (1 - retract);
  const logoY = mix(470, 390, lift);
  const bannerY = logoY - LOGO_H / 2 + LOGO_H * (468 / 768);

  return (
    <AbsoluteFill>
      <Field />
      <ParticleField cam={baseCam(40, { z: 1483 - f * 1.2 })} frame={f} count={260} opacity={0.4 * (1 - allOut)} size={1.8} seed={261}
        box={{ x: [-2200, 2200], y: [-1400, 1400], z: [-4000, 900] }} drift={[0, -0.3, 0]} />

      {/* One team. One mission. One rhythm. */}
      {f < WE + 6 && (
        <AbsoluteFill style={{ opacity: 1 - threeOut }}>
          {[
            [O1, "One team."],
            [O2, "One mission."],
            [O3, "One rhythm."],
          ].map(([s, w], i) => (
            <div key={i} style={{ position: "absolute", left: 110, top: 190 + i * 190 }}>
              <Hero text={w as string} size={170} t={f - (s as number)} dur={16} stagger={1.2} tracking={-0.035} color={i === 2 ? C.blue : C.white} />
            </div>
          ))}
          <div style={{ position: "absolute", left: 110, top: 150 }}>
            <Mono text="OUTRO · 2026" t={f - O1} size={15} opacity={0.45} />
          </div>
        </AbsoluteFill>
      )}

      {/* the line — through the Summit banner at the welcome */}
      <div
        style={{
          position: "absolute",
          left: 960 - lineLen / 2,
          top: mix(830, bannerY, ramp(f, WE - 6, 24, expoInOut)) - 2,
          width: lineLen,
          height: 4,
          background: C.blue,
          filter: glow(0.7 + 0.5 * pulse),
        }}
      />
      {retract > 0.95 && (
        <div style={{ position: "absolute", left: 956, top: bannerY - 4, width: 8, height: 8, borderRadius: 4, background: C.blue, filter: glow(1.2), opacity: 1 - ramp(f, END + 26, 8) }} />
      )}

      {/* Welcome to Addapalooza. */}
      {f >= WE - 4 && (
        <AbsoluteFill style={{ opacity: 1 - allOut }}>
          <LightPool x={960} y={logoY} r={900} squash={0.55} color={C.blueRGB} opacity={0.16 * sweep + 0.06 * pulse} />
          <div
            style={{
              position: "absolute",
              left: 960 - LOGO_W / 2,
              top: logoY - LOGO_H / 2,
              width: LOGO_W,
              height: LOGO_H,
              WebkitMaskImage: `linear-gradient(100deg, #000 ${sweep * 130 - 30}%, transparent ${sweep * 130 - 5}%)`,
              transform: `scale(${mix(0.96, 1, sweep) * mix(1, 0.86, lift)})`,
            }}
          >
            <Img src={staticFile("images/addapalooza-logo.png")} style={{ width: "100%", height: "100%" }} />
            {/* light sweep */}
            <div style={{ position: "absolute", inset: 0, background: `linear-gradient(100deg, transparent ${sweep * 130 - 38}%, rgba(255,255,255,0.35) ${sweep * 130 - 30}%, transparent ${sweep * 130 - 20}%)`, mixBlendMode: "screen",
              WebkitMaskImage: `url(${staticFile("images/addapalooza-logo.png")})`, WebkitMaskSize: "100% 100%" }} />
          </div>
          <div style={{ position: "absolute", left: 110, top: 110 }}>
            <Mono text="WELCOME TO" t={f - WE} size={20} opacity={0.75} weight={500} />
          </div>
        </AbsoluteFill>
      )}

      {/* Summit 2026, y'all! — the DJ, lit by his visor */}
      {f >= SU && (
        <AbsoluteFill style={{ opacity: 1 - allOut }}>
          <div style={{ position: "absolute", right: 110, top: 96, textAlign: "right" }}>
            <Mono text="SUMMIT 2026, Y’ALL!" t={f - SU} size={20} opacity={0.75} weight={500} cps={30} />
          </div>
          <div style={{ position: "absolute", right: 130, bottom: 70, opacity: ramp(f, SU + 20, 30) * (1 - lift), filter: `brightness(${0.6 + 0.5 * pulse})`,
            WebkitMaskImage: "radial-gradient(ellipse 60% 60% at 50% 45%, #000 45%, transparent 100%)" }}>
            <Img src={staticFile("images/dj-helmet-3q.png")} style={{ height: 250, display: "block" }} />
          </div>
        </AbsoluteFill>
      )}

      {/* final lockup */}
      {f >= HIT - 2 && (
        <AbsoluteFill style={{ opacity: 1 - allOut }}>
          <div style={{ position: "absolute", left: 960, top: 800, transform: "translateX(-50%)" }}>
            <Hero text="ONE TEAM. ONE RHYTHM." size={64} t={f - HIT - 6} dur={10} stagger={0.6} tracking={0.02} align="center" />
          </div>
          <div style={{ position: "absolute", left: 960 - 170, top: 930, opacity: ramp(f, HIT + 24, 20) }}>
            <Logo width={340} />
          </div>
        </AbsoluteFill>
      )}

      <Flash at={HIT} peak={0.25} />
      <Vignette strength={0.6} />
      <AbsoluteFill style={{ background: "#000", opacity: ramp(f, dur - 8, 8) }} />
    </AbsoluteFill>
  );
};
