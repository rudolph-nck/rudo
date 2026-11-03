import React from "react";
import { AbsoluteFill } from "remotion";
import { bassLevel } from "../data";
import { clamp01, cubicInOut, cubicOut, mix } from "../utils/ease";
import { rng } from "../utils/random";
import { FF, Finish3, Float, P, Room } from "./kit";
import { Phone } from "./frames";
import { Battery } from "./chorus1";
import { Shot, Sp, W, big, mono, seen, sungC } from "./verse1";

/**
 * Verse 2 + pre-chorus 2 (1:31.8–2:15.7): the night drive. Dashboard screens and the road, streetlights sweeping
 * across the wall as you pass them. The battery drains to 0% on NOTHING and the screen goes dark; then a timer
 * and a breathing circle bring the light back for chorus 2.
 */
export const V2_START = 91.8;
export const V2_END = 135.7;
const hand = (size: number): React.CSSProperties => ({ font: `500 ${size}px/1.15 ${FF.hand}` });

export const Verse2V3: React.FC<{ t: number }> = ({ t }) => {
  const nothing = W(50, 6);
  const drain = clamp01((t - 124.1) / (nothing.e - 124.1));
  const back = cubicInOut(clamp01((t - 132.7) / 3));
  const light = t < 124 ? 0.62 : t < 129.8 ? mix(0.62, 0.04, cubicInOut(drain)) : mix(0.04, 0.9, back);
  const cam: [number, number, number] = [Math.sin(t * 0.21) * 0.15, 1.38, 6.1];
  const sweepOn = t < 124 ? 1 : 1 - clamp01((t - 124) / 2);
  return (
    <AbsoluteFill style={{ background: P.char }}>
      <Room t={t} light={light} cam={cam} />
      {/* streetlights passing over the wall */}
      {sweepOn > 0 ? Array.from({ length: 2 }, (_, k) => {
        const ph = (((t - 91.8) / 2.6 + k * 0.5) % 1);
        return <div key={k} style={{ position: "absolute", top: 0, bottom: 0, left: `${-40 + ph * 160}%`, width: "26%", background: "linear-gradient(90deg, rgba(242,227,200,0), rgba(242,227,200,0.10), rgba(242,227,200,0))", opacity: sweepOn, transform: "skewX(-18deg)" }} />;
      }) : null}

      {/* 1:31 · SOMETIMES I DRIVE WITH NO DESTINATION — the satnav */}
      <Shot t={t} s={91.8} e={93.54}>
        <Float x={360} y={170} w={1200} h={640} rx={14} ry={-4}>
          <div style={{ width: "100%", height: "100%", background: "#0c0b0a", borderRadius: 26, border: "10px solid #1d1a17", position: "relative", overflow: "hidden" }}>
            <svg viewBox="0 0 1180 620" style={{ position: "absolute", inset: 0 }}>
              {[["M-20 520 C200 480 340 560 520 420 S860 180 1200 220", 26], ["M80 -20 C120 200 260 300 300 640", 14], ["M700 -20 C640 160 760 300 720 640", 14], ["M-20 140 C300 160 600 100 1200 120", 10]].map(([d, w], i) => <path key={i} d={d as string} fill="none" stroke="#2c2824" strokeWidth={w as number} strokeLinecap="round" />)}
              <path d="M-20 520 C200 480 340 560 520 420 S860 180 1200 220" fill="none" stroke={P.bone} strokeWidth={5} strokeDasharray="1700" strokeDashoffset={1700 * (1 - clamp01((t - 91.9) / 1.6))} />
              <circle cx={520} cy={420} r={14} fill={P.light} />
            </svg>
            <div style={{ position: "absolute", left: 30, top: 24, width: 470, background: "#171513", borderRadius: 14, padding: "18px 24px", boxShadow: "inset 0 0 0 1px #3a342e" }}>
              <div style={mono(14)}><Sp t={t} li={35} wi={0} text="sometimes" /> <Sp t={t} li={35} wi={1} text="I" /> <Sp t={t} li={35} wi={2} text="drive" /> <Sp t={t} li={35} wi={3} text="with" /> <Sp t={t} li={35} wi={4} text="no" /></div>
              <div style={{ ...big(54, "0.14em"), marginTop: 8 }}><Sp t={t} li={35} wi={5} text="DESTINATION" /></div>
              <div style={{ ...mono(15, P.dim, "0.1em"), textTransform: "none", marginTop: 6, opacity: seen(35, 5, t) }}>— no route set · just driving</div>
            </div>
          </div>
        </Float>
      </Shot>

      {/* 1:33 · RADIO LOW, WINDOWS DOWN — the dashboard */}
      <Shot t={t} s={93.54} e={95.0}>
        <Float x={360} y={300} w={1200} h={420} rx={18}>
          <div style={{ width: "100%", height: "100%", background: "linear-gradient(#1c1916, #0e0d0b)", borderRadius: 30, boxShadow: "inset 0 0 0 1px #3a342e", display: "grid", gridTemplateColumns: "1.3fr 1fr", padding: 40, gap: 40 }}>
            <div style={{ background: "#0b0a09", borderRadius: 16, padding: "26px 30px", boxShadow: "inset 0 0 0 1px #2e2a26" }}>
              <div style={mono(14)}><Sp t={t} li={36} wi={0} text="radio" /> · fm</div>
              <div style={{ font: `100 110px/1 ${FF.thin}`, color: P.bone, marginTop: 10 }}>88.1</div>
              <div style={{ display: "flex", gap: 6, alignItems: "flex-end", marginTop: 20 }}>{Array.from({ length: 12 }, (_, i) => { const lvl = clamp01((t - 93.85) / 0.3) > 0.5 ? 3 : 12; return <i key={i} style={{ width: 16, height: 10 + i * 4, background: i < lvl ? P.bone : "#2a2622" }} />; })}<span style={{ ...big(44, "0.2em"), marginLeft: 18 }}><Sp t={t} li={36} wi={1} text="LOW" /></span></div>
            </div>
            <div style={{ display: "grid", alignContent: "center", gap: 18, textAlign: "center" }}>
              <svg viewBox="0 0 200 120" style={{ width: 220, height: 132, justifySelf: "center" }}><path d="M10 110 L40 20 L190 20 L190 110 Z" fill="none" stroke={P.stone} strokeWidth={3} /><rect x={42} y={24 + 82 * clamp01((t - 94.3) / 0.6)} width={144} height={82 * (1 - clamp01((t - 94.3) / 0.6))} fill={P.dim} /></svg>
              <div style={{ ...big(44, "0.2em") }}><Sp t={t} li={36} wi={2} text="WINDOWS" /> <Sp t={t} li={36} wi={3} text="DOWN" /></div>
            </div>
          </div>
        </Float>
      </Shot>

      {/* 1:35 · TRYING TO OUTRUN THE NOISE — speedometer, the noise chasing */}
      <Shot t={t} s={95.0} e={97.77}>
        {(() => {
          const sp = mix(40, 128, cubicOut(clamp01((t - 95.0) / 2.2)));
          const a = (-210 + (sp / 160) * 240) * (Math.PI / 180);
          return (
            <>
              <svg viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0 }}>
                {Array.from({ length: 48 }, (_, i) => { const h = 20 + 260 * Math.abs(Math.sin(i * 1.7 + t * 9)) * (0.3 + bassLevel(t)) * clamp01((t - 96.3) / 0.3 + 0.25); return <rect key={i} x={140 + i * 34} y={980 - h} width={20} height={h} fill={P.dim} opacity={0.55} />; })}
                <circle cx={960} cy={520} r={330} fill="#0d0c0b" stroke={P.stone} strokeWidth={2} />
                {Array.from({ length: 17 }, (_, i) => { const q = (-210 + i * 15) * (Math.PI / 180); return <line key={i} x1={960 + Math.cos(q) * 300} y1={520 + Math.sin(q) * 300} x2={960 + Math.cos(q) * (i % 2 ? 280 : 260)} y2={520 + Math.sin(q) * (i % 2 ? 280 : 260)} stroke={P.paper} strokeWidth={3} />; })}
                <line x1={960} y1={520} x2={960 + Math.cos(a) * 270} y2={520 + Math.sin(a) * 270} stroke={P.bone} strokeWidth={6} strokeLinecap="round" />
                <circle cx={960} cy={520} r={18} fill={P.light} />
                <text x={960} y={680} textAnchor="middle" style={{ font: `100 90px ${FF.thin}` }} fill={P.bone}>{Math.round(sp)}</text>
                <text x={960} y={330} textAnchor="middle" style={{ font: `500 20px ${FF.mono}`, letterSpacing: "0.3em" }} fill={P.stone}><tspan opacity={seen(37, 0, t)}>TRYING </tspan><tspan opacity={seen(37, 1, t)}>TO </tspan><tspan opacity={seen(37, 2, t)} fill={sungC(37, 2, t)}>OUTRUN </tspan><tspan opacity={seen(37, 3, t)}>THE</tspan></text>
              </svg>
              <div style={{ position: "absolute", left: 0, right: 0, top: 760, textAlign: "center", ...big(120, "0.4em"), color: sungC(37, 4, t), opacity: seen(37, 4, t) }}>NOISE</div>
            </>
          );
        })()}
      </Shot>

      {/* 1:37 · THAT SOMEHOW ALWAYS STICKS AROUND — the rear-view mirror */}
      <Shot t={t} s={97.77} e={101.25}>
        <Float x={460} y={200} w={1000} h={360} rx={6} rz={-2}>
          <div style={{ width: "100%", height: "100%", borderRadius: 180, background: "radial-gradient(120% 140% at 50% 0%, #2a2622, #0b0a09 70%)", boxShadow: "inset 0 0 0 12px #141210, inset 0 0 0 14px #3a342e", position: "relative", overflow: "hidden" }}>
            <svg viewBox="0 0 1000 360" style={{ position: "absolute", inset: 0 }}>
              {Array.from({ length: 30 }, (_, i) => { const h = 20 + 140 * Math.abs(Math.sin(i * 1.3 + t * 8)) * (0.35 + bassLevel(t)); return <rect key={i} x={140 + i * 25} y={180 - h / 2} width={12} height={h} fill={P.paper} opacity={0.5} />; })}
            </svg>
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 40, textAlign: "center", ...mono(14, P.dim) }}>objects in mirror are closer than they appear</div>
          </div>
        </Float>
        <div style={{ position: "absolute", left: 0, right: 0, top: 640, textAlign: "center", ...mono(22, P.paper) }}><Sp t={t} li={38} wi={0} text="that" /> <Sp t={t} li={38} wi={1} text="somehow" /> <Sp t={t} li={38} wi={2} text="always" /></div>
        <div style={{ position: "absolute", left: 0, right: 0, top: 700, textAlign: "center", ...big(110, "0.2em") }}><Sp t={t} li={38} wi={3} text="STICKS" /> <Sp t={t} li={38} wi={4} text="AROUND" /></div>
      </Shot>

      {/* 1:41 · PEOPLE THINK I'M DOING GREAT · MAYBE THAT'S THE HARDEST PART — the review card */}
      <Shot t={t} s={101.25} e={104.23}>
        <Float x={560} y={180} w={800} h={600} rx={10} ry={6}>
          <div style={{ width: "100%", height: "100%", background: "rgba(22,20,18,0.96)", borderRadius: 26, boxShadow: "inset 0 0 0 1px #3a342e", padding: "54px 60px", position: "relative" }}>
            <div style={mono(15)}><Sp t={t} li={39} wi={0} text="people" /> <Sp t={t} li={39} wi={1} text="think" /> · rate how he's <Sp t={t} li={39} wi={3} text="doing" /></div>
            <div style={{ fontSize: 110, letterSpacing: 18, color: P.bone, marginTop: 28 }}>{"★★★★★".split("").map((c, i) => <span key={i} style={{ opacity: clamp01((t - 101.7 - i * 0.1) / 0.15) }}>{c}</span>)}</div>
            <div style={{ ...big(120, "0.2em"), marginTop: 10 }}><Sp t={t} li={39} wi={4} text="GREAT" /></div>
            <svg viewBox="0 0 680 220" style={{ position: "absolute", left: 50, top: 110, width: 680, height: 220, opacity: seen(40, 0, t) }}>
              <path d="M40 120 C40 30 640 10 650 110 C660 200 60 210 50 120" fill="none" stroke={P.paper} strokeWidth={4} strokeDasharray="1800" strokeDashoffset={1800 * (1 - clamp01((t - 102.9) / 0.6))} />
            </svg>
            <div style={{ position: "absolute", right: 50, bottom: 40, ...hand(54), color: P.paper, transform: "rotate(-4deg)" }}>
              <Sp t={t} li={40} wi={0} text="maybe" rest={P.paper} style={{ textTransform: "none" }} /> <Sp t={t} li={40} wi={1} text="that's" rest={P.paper} style={{ textTransform: "none" }} /> <Sp t={t} li={40} wi={2} text="the" rest={P.paper} style={{ textTransform: "none" }} /> <Sp t={t} li={40} wi={3} text="hardest" rest={P.bone} style={{ textTransform: "none" }} /> <Sp t={t} li={40} wi={4} text="part" rest={P.paper} style={{ textTransform: "none" }} />
            </div>
          </div>
        </Float>
      </Shot>

      {/* 1:44 · BEING SURROUNDED BY EVERYBODY · WHILE FEELING MILES APART — the map of pins */}
      <Shot t={t} s={104.23} e={108.18}>
        {(() => {
          const pins = Array.from({ length: 80 }, (_, i) => { const r = rng(i + 640); return { x: 1200 + (r() - 0.5) * 900, y: 520 + (r() - 0.5) * 620, at: 105.29 + r() * 0.9 }; });
          const you = { x: 420, y: 620 };
          const meas = clamp01((t - 107.24) / 0.6);
          return (
            <svg viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0 }}>
              {Array.from({ length: 14 }, (_, i) => <path key={i} d={`M${-50 + i * 160} -20 C${i * 160 + 80} 400 ${i * 160 - 120} 700 ${i * 140 + 60} 1100`} fill="none" stroke="#242120" strokeWidth={3} />)}
              {pins.map((p, i) => { const k = cubicOut(clamp01((t - p.at) / 0.2)); return <g key={i} opacity={k}><circle cx={p.x} cy={p.y - 18 * k} r={9} fill={P.stone} /><line x1={p.x} y1={p.y - 9 - 18 * k + 18} x2={p.x} y2={p.y} stroke={P.stone} strokeWidth={2} /></g>; })}
              <circle cx={you.x} cy={you.y} r={16} fill={P.light} />
              <text x={you.x} y={you.y + 56} textAnchor="middle" style={{ font: `500 20px ${FF.mono}`, letterSpacing: "0.26em" }} fill={P.paper}>YOU</text>
              {meas > 0 ? <><line x1={you.x + 24} y1={you.y} x2={you.x + 24 + (820 - 24) * meas} y2={you.y - 100 * meas} stroke={P.bone} strokeWidth={2} strokeDasharray="10 8" /><text x={you.x + 420} y={you.y - 80} textAnchor="middle" style={{ font: `100 64px ${FF.thin}` }} fill={P.bone} opacity={meas}>2,431 mi</text></> : null}
              <text x={1200} y={120} textAnchor="middle" style={{ font: `500 22px ${FF.mono}`, letterSpacing: "0.26em" }} fill={P.stone}><tspan opacity={seen(41, 0, t)}>BEING </tspan><tspan opacity={seen(41, 1, t)} fill={sungC(41, 1, t)}>SURROUNDED </tspan><tspan opacity={seen(41, 2, t)}>BY </tspan><tspan opacity={seen(41, 3, t)} fill={sungC(41, 3, t)}>EVERYBODY</tspan></text>
              <text x={960} y={890} textAnchor="middle" style={{ font: `400 90px ${FF.display}`, letterSpacing: "0.3em" }} fill={P.bone}><tspan opacity={seen(42, 0, t)} fill={sungC(42, 0, t)} style={{ font: `500 24px ${FF.mono}` }}>WHILE </tspan><tspan opacity={seen(42, 1, t)} fill={sungC(42, 1, t)} style={{ font: `500 24px ${FF.mono}` }}>FEELING </tspan><tspan opacity={seen(42, 2, t)} fill={sungC(42, 2, t)}>MILES</tspan><tspan opacity={seen(42, 3, t)} fill={sungC(42, 3, t)} dx={120 * clamp01((t - 107.92) / 0.5)}>APART</tspan></text>
            </svg>
          );
        })()}
      </Shot>

      {/* 1:48 · GOT MEMORIES THAT HAUNT ME — the photo roll */}
      <Shot t={t} s={108.18} e={109.99}>
        {Array.from({ length: 7 }, (_, i) => {
          const x = 1900 - ((t - 108.0) * 520 + i * 330) % 2600;
          const hold = i === 3 ? clamp01((t - 109.2) / 0.3) : 0;
          return <div key={i} style={{ position: "absolute", left: x, top: 270 + (i % 2) * 40, width: 300, height: 360, background: P.paper, padding: "18px 18px 70px", transform: `rotate(${(i % 3 - 1) * 4}deg) scale(${1 + hold * 0.08})`, boxShadow: "0 30px 40px rgba(0,0,0,0.5)", filter: `grayscale(1) blur(${i === 3 ? 0 : 1}px)` }}><div style={{ width: "100%", height: "100%", background: `radial-gradient(circle at ${30 + i * 9}% ${40 + (i % 3) * 10}%, #6a5f55, #1a1714 70%)` }} /></div>;
        })}
        <div style={{ position: "absolute", left: 0, right: 0, top: 760, textAlign: "center", ...mono(22, P.paper) }}><Sp t={t} li={43} wi={0} text="got" /> <Sp t={t} li={43} wi={1} text="memories" /> <Sp t={t} li={43} wi={2} text="that" /></div>
        <div style={{ position: "absolute", left: 0, right: 0, top: 790, textAlign: "center", ...big(100, "0.3em") }}><Sp t={t} li={43} wi={3} text="HAUNT" /> <Sp t={t} li={43} wi={4} text="ME" /></div>
      </Shot>

      {/* 1:49 · GOT QUESTIONS WITH NO REPLIES — the thread */}
      <Shot t={t} s={109.99} e={112.72}>
        <Float x={660} y={70} w={600} h={880} rx={10} ry={-6}>
          <Phone w={600} h={880}>
            <div style={{ position: "absolute", left: 40, right: 40, top: 60, display: "grid", gap: 18 }}>
              <div style={{ ...mono(14), textAlign: "center" }}><Sp t={t} li={44} wi={0} text="got" /> <Sp t={t} li={44} wi={1} text="questions" /></div>
              {[["you up?", 110.0], ["can we talk", 110.36], ["did I do something", 110.83], ["?", 111.03]].map(([m, at], i) => (
                <div key={i} style={{ justifySelf: "end", background: "#2a2622", color: P.bone, borderRadius: 26, padding: "16px 26px", font: `400 30px ${FF.thin}`, opacity: clamp01((t - (at as number)) / 0.15), transform: `translateY(${(1 - clamp01((t - (at as number)) / 0.15)) * 20}px)` }}>{m}</div>
              ))}
              <div style={{ justifySelf: "end", ...mono(13, P.dim, "0.1em"), textTransform: "none", opacity: clamp01((t - 111.3) / 0.2) }}>Delivered</div>
              <div style={{ display: "flex", gap: 8, background: "#1b1816", borderRadius: 24, padding: "18px 24px", width: "fit-content", opacity: Math.max(0, Math.sin((t - 111.4) * 3)) * (t > 111.4 && t < 112.6 ? 1 : 0) }}>{[0, 1, 2].map((k) => <i key={k} style={{ width: 12, height: 12, borderRadius: "50%", background: P.stone, opacity: 0.4 + 0.6 * Math.abs(Math.sin(t * 6 + k)) }} />)}</div>
              <div style={{ textAlign: "center", ...big(64, "0.2em"), marginTop: 30 }}><Sp t={t} li={44} wi={2} text="WITH" style={{ ...mono(20) }} /> <Sp t={t} li={44} wi={3} text="NO" /> <Sp t={t} li={44} wi={4} text="REPLIES" /></div>
            </div>
          </Phone>
        </Float>
      </Shot>

      {/* 1:52 · GOT A FATHER THAT I MISS — the contact card */}
      <Shot t={t} s={112.72} e={114.1}>
        <Float x={560} y={250} w={800} h={480} rx={8} ry={8}>
          <div style={{ width: "100%", height: "100%", background: "rgba(22,20,18,0.96)", borderRadius: 30, boxShadow: "inset 0 0 0 1px #3a342e", display: "grid", placeItems: "center", alignContent: "center", gap: 14, textAlign: "center" }}>
            <div style={{ width: 160, height: 160, borderRadius: "50%", background: "radial-gradient(circle at 45% 35%, #6a5f55, #1a1714)", boxShadow: `0 0 0 2px ${P.stone}` }} />
            <div style={{ ...hand(110), color: P.bone }}>Dad</div>
            <div style={mono(15)}><Sp t={t} li={45} wi={0} text="got" /> <Sp t={t} li={45} wi={1} text="a" /> <Sp t={t} li={45} wi={2} text="father" /> <Sp t={t} li={45} wi={3} text="that" /> <Sp t={t} li={45} wi={4} text="I" /> <Sp t={t} li={45} wi={5} text="miss" style={{ color: P.bone }} /> · last call mar 2019</div>
          </div>
        </Float>
      </Shot>

      {/* 1:54 · AND OLD VOICEMAILS I STILL PLAY SOMETIMES — the voicemail plays (the emotional hold) */}
      <Shot t={t} s={114.08} e={118.4}>
        {(() => {
          const wave = Array.from({ length: 120 }, (_, i) => 26 * Math.abs(Math.sin(i * 0.37) * Math.sin(i * 0.11 + 1)) + 3);
          const play = W(46, 5).s, pos = clamp01((t - play) / 2.4);
          return (
            <Float x={620} y={90} w={680} h={800} rx={22 - (t - 114) * 1.5} rz={-2}>
              <Phone w={680} h={800}>
                <div style={{ position: "absolute", top: 54, left: 50, right: 50 }}>
                  <div style={mono(16)}><Sp t={t} li={46} wi={0} text="and" /> <Sp t={t} li={46} wi={1} text="old" /> <Sp t={t} li={46} wi={2} text="voicemails" /></div>
                  {[["Unknown", "0:05 · Yesterday"], ["Mom", "0:12 · Sunday"]].map(([n, d], i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "22px 0", borderBottom: "1px solid #2e2a26", font: `400 26px ${FF.thin}`, color: P.dim }}><span>{n}</span><span style={{ font: `400 18px ${FF.mono}` }}>{d}</span></div>)}
                  <div style={{ marginTop: 40, padding: "30px 34px", background: "rgba(236,226,208,0.05)", borderRadius: 20, border: "1px solid #3a342e" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}><span style={{ ...hand(96), color: P.bone }}>Dad</span><span style={{ font: `400 18px ${FF.mono}`, color: P.stone, letterSpacing: "0.12em" }}>0:43 · MAR 2019</span></div>
                    <svg width="100%" height="90" viewBox="0 0 600 90" style={{ marginTop: 24 }}>
                      {wave.map((h, i) => <rect key={i} x={i * 5} y={45 - h} width={2.4} height={h * 2} fill={i / 120 < pos ? P.bone : P.dim} />)}
                      <circle cx={pos * 600} cy={45} r={7} fill={P.light} />
                    </svg>
                    <div style={{ display: "flex", justifyContent: "space-between", font: `400 18px ${FF.mono}`, color: P.stone, marginTop: 10 }}><span>{t >= play ? "▶ playing" : "▶ play"}</span><span>0:{String(Math.floor(pos * 43)).padStart(2, "0")} / 0:43</span></div>
                  </div>
                  <div style={{ ...mono(15, P.dim, "0.12em"), marginTop: 30, textTransform: "none" }}><Sp t={t} li={46} wi={3} text="I" rest={P.dim} /> <Sp t={t} li={46} wi={4} text="still" rest={P.dim} /> <Sp t={t} li={46} wi={5} text="play" rest={P.dim} /> it <Sp t={t} li={46} wi={6} text="sometimes" rest={P.dim} /> · played 214 times · saved</div>
                </div>
              </Phone>
            </Float>
          );
        })()}
      </Shot>

      {/* 1:58 · GOT DREAMS THAT KEEP ME MOVING — the notebook */}
      <Shot t={t} s={118.37} e={119.85}>
        <Float x={560} y={140} w={800} h={700} rx={20} rz={-3}>
          <div style={{ width: "100%", height: "100%", background: P.paper, color: "#2a2622", padding: "50px 70px", backgroundImage: "repeating-linear-gradient(transparent 0 58px, rgba(60,52,46,0.25) 58px 60px)", boxShadow: "inset 0 0 120px rgba(0,0,0,0.25)" }}>
            <div style={{ ...hand(64) }}><Sp t={t} li={47} wi={0} text="got" rest="#2a2622" style={{ color: "#2a2622", textTransform: "none" }} /> <Sp t={t} li={47} wi={1} text="dreams:" rest="#2a2622" style={{ color: "#2a2622", textTransform: "none" }} /></div>
            {["the album, all of it", "a show that sells out twice", "a house with big windows", "mom never worrying"].map((x, i) => <div key={i} style={{ ...hand(44), marginTop: 6, opacity: clamp01((t - 118.6 - i * 0.18) / 0.2) }}>— {x}</div>)}
            <div style={{ ...hand(58), marginTop: 20, textAlign: "right" }}><Sp t={t} li={47} wi={2} text="that" rest="#2a2622" style={{ color: "#2a2622", textTransform: "none" }} /> <Sp t={t} li={47} wi={3} text="keep" rest="#2a2622" style={{ color: "#2a2622", textTransform: "none" }} /> <Sp t={t} li={47} wi={4} text="me" rest="#2a2622" style={{ color: "#2a2622", textTransform: "none" }} /> <Sp t={t} li={47} wi={5} text="moving →" rest="#2a2622" style={{ color: "#1a1714", textTransform: "none" }} /></div>
          </div>
        </Float>
      </Shot>

      {/* 1:59 · AND SCARS THAT KEEP ME REAL — the x-ray film */}
      <Shot t={t} s={119.83} e={121.4}>
        <Float x={560} y={140} w={800} h={660} rx={6} ry={-8}>
          <div style={{ width: "100%", height: "100%", background: "radial-gradient(60% 70% at 50% 45%, #2a2826, #0b0b0a)", borderRadius: 10, boxShadow: "inset 0 0 0 1px #3a342e", position: "relative" }}>
            <svg viewBox="0 0 800 660" style={{ position: "absolute", inset: 0 }}>
              <path d="M300 640 C310 500 280 380 330 260 C360 190 380 120 360 40 M480 640 C470 500 500 380 450 260 C430 190 420 120 440 40" fill="none" stroke={P.paper} strokeOpacity={0.35} strokeWidth={40} strokeLinecap="round" />
              {[["M350 420 l60 -30", 120.2], ["M420 300 l40 40", 120.4], ["M380 520 l50 10", 120.6]].map(([d, at], i) => <path key={i} d={d as string} stroke={P.light} strokeWidth={4} strokeLinecap="round" strokeDasharray="80" strokeDashoffset={80 * (1 - clamp01((t - (at as number)) / 0.3))} />)}
            </svg>
            <div style={{ position: "absolute", left: 24, top: 18, ...mono(14) }}>film 03 · healed</div>
          </div>
        </Float>
        <div style={{ position: "absolute", left: 0, right: 0, top: 820, textAlign: "center", ...big(80, "0.24em") }}><Sp t={t} li={48} wi={0} text="AND" style={{ ...mono(22) }} /> <Sp t={t} li={48} wi={1} text="SCARS" /> <Sp t={t} li={48} wi={2} text="THAT" style={{ ...mono(22) }} /> <Sp t={t} li={48} wi={3} text="KEEP" style={{ ...mono(22) }} /> <Sp t={t} li={48} wi={4} text="ME" style={{ ...mono(22) }} /> <Sp t={t} li={48} wi={5} text="REAL" /></div>
      </Shot>

      {/* 2:01–2:09 · MOST DAYS I'M STRONG ENOUGH · SOME DAYS I JUST WANNA FEEL NOTHING — the battery drains to 0 */}
      <Shot t={t} s={121.4} e={130.2}>
        {(() => {
          const pct = t < 124.1 ? 100 : Math.round(mix(100, 0, Math.pow(drain, 1.6)));
          const grey = clamp01((t - 127.7) / 1.6);
          return (
            <div style={{ position: "absolute", inset: 0, filter: `saturate(${1 - grey}) brightness(${1 - grey * 0.55})` }}>
              <Battery pct={pct} top={t < 124.1 ? "MOST DAYS" : "SOME DAYS"} charging={false} sub={
                <div style={{ ...mono(18, P.paper) }}>
                  {t < 124.1 ? <><Sp t={t} li={49} wi={0} text="most" /> <Sp t={t} li={49} wi={1} text="days" /> <Sp t={t} li={49} wi={2} text="I'm" /> <Sp t={t} li={49} wi={3} text="strong" /> <Sp t={t} li={49} wi={4} text="enough" /></> : <><Sp t={t} li={50} wi={0} text="some" /> <Sp t={t} li={50} wi={1} text="days" /> <Sp t={t} li={50} wi={2} text="I" /> <Sp t={t} li={50} wi={3} text="just" /> <Sp t={t} li={50} wi={4} text="wanna" /> <Sp t={t} li={50} wi={5} text="feel" /></>}
                </div>
              } />
              {t < 124.1 ? <div style={{ position: "absolute", right: 260, top: 640, ...big(110, "0.2em") }}><Sp t={t} li={49} wi={3} text="STRONG" /> <Sp t={t} li={49} wi={4} text="ENOUGH" /></div> : null}
              {t > 127.6 ? <div style={{ position: "absolute", right: 150, top: 300, ...big(110, "0.3em"), color: P.stone, opacity: seen(50, 6, t) * (1 - clamp01((t - 129.3) / 0.5)) * 0.8 }}>NOTHING</div> : null}
            </div>
          );
        })()}
      </Shot>

      {/* 2:09 · NOT FOREVER — the timer */}
      <Shot t={t} s={129.8} e={132.75}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 260, textAlign: "center" }}>
          <div style={mono(20)}>timer</div>
          <div style={{ position: "relative", display: "inline-block", marginTop: 20, font: `100 260px/1 ${FF.thin}`, color: P.bone }}>∞
            <svg viewBox="0 0 400 260" style={{ position: "absolute", left: -60, top: 0, width: 400, height: 260 }}><line x1={20} y1={200} x2={20 + 360 * clamp01((t - 130.3) / 0.4)} y2={200 - 140 * clamp01((t - 130.3) / 0.4)} stroke={P.paper} strokeWidth={5} /></svg>
          </div>
          <div style={{ ...big(90, "0.3em"), marginTop: 20 }}><Sp t={t} li={51} wi={0} text="NOT" /> <Sp t={t} li={51} wi={1} text="FOREVER" /></div>
        </div>
      </Shot>

      {/* 2:12 · JUST LONG ENOUGH TO BREATHE — the breathing circle; the light comes back */}
      <Shot t={t} s={132.71} e={136.0}>
        {(() => {
          const ph = 0.5 - 0.5 * Math.cos((t - 132.7) * (Math.PI / 1.4));
          const r = mix(110, 300, ph);
          return (
            <>
              <div style={{ position: "absolute", left: 960 - r, top: 470 - r, width: r * 2, height: r * 2, borderRadius: "50%", border: `2px solid ${P.bone}`, background: `radial-gradient(circle, rgba(242,227,200,${0.12 + ph * 0.12}), rgba(242,227,200,0) 70%)` }} />
              <div style={{ position: "absolute", left: 0, right: 0, top: 450, textAlign: "center", ...mono(20, P.paper) }}>{ph > 0.5 ? "breathe out" : "breathe in"}</div>
              <div style={{ position: "absolute", left: 0, right: 0, top: 760, textAlign: "center", ...mono(22, P.paper) }}><Sp t={t} li={52} wi={0} text="just" /> <Sp t={t} li={52} wi={1} text="long" /> <Sp t={t} li={52} wi={2} text="enough" /> <Sp t={t} li={52} wi={3} text="to" /></div>
              <div style={{ position: "absolute", left: 0, right: 0, top: 800, textAlign: "center", ...big(96, "0.4em") }}><Sp t={t} li={52} wi={4} text="BREATHE" /></div>
            </>
          );
        })()}
      </Shot>
      <Finish3 />
    </AbsoluteFill>
  );
};
