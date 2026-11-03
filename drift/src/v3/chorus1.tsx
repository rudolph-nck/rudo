import React from "react";
import { AbsoluteFill } from "remotion";
import { clamp01, cubicIn, cubicInOut, cubicOut, mix } from "../utils/ease";
import { rng } from "../utils/random";
import { FF, Finish3, Float, P, Room } from "./kit";
import { Label, Phone } from "./frames";
import { W, Sp, big, mono, mixC, onBeat, pulse, seen, sungC } from "./verse1";
import { kickEnv } from "../data";

/**
 * Chorus 1 (0:57.2–1:31.8). Gravity switches off for the first time: every object drifts UP into the light and
 * keeps rising as the next arrives; the dust rises; the light opens up warmer. The battery charges.
 */
export const C1_START = 57.2;
export const C1_END = 91.8;

/** In the chorus things float: they rise in from below, bob gently, and drift on up and away. */
let kt = 0; // real time for the kick dip (set by the chorus)
export const Up: React.FC<{ t: number; s: number; e: number; children: React.ReactNode }> = ({ t, s: s0, e, children }) => {
  const s = onBeat(s0);
  const i = cubicOut(clamp01((t - (s - 0.35)) / 0.6)), o = cubicIn(clamp01((t - (e - 0.15)) / 0.6));
  if (i <= 0 || o >= 1) return null;
  const bob = Math.sin((t - s) * 1.3) * 6 + kickEnv(kt) * 5; // floating, with a soft dip on each kick
  return (
    <AbsoluteFill style={{ opacity: i * (1 - o), transform: `translateY(${(1 - i) * 90 - o * 160 + bob}px) rotate(${(1 - i) * 1.5 - o * 2}deg)`, filter: `blur(${(1 - i) * 6 + o * 4}px)` }}>
      {children}
    </AbsoluteFill>
  );
};
/** The battery gauge: huge thin outlined numbers, charging. */
export const Battery: React.FC<{ pct: number; top: string; sub: React.ReactNode; charging?: boolean }> = ({ pct, top, sub, charging = true }) => (
  <>
    <div style={{ position: "absolute", left: 260, top: 210, ...mono(22, P.stone, "0.34em") }}>{top}</div>
    <div style={{ position: "absolute", left: 230, top: 210, font: `100 520px/1 ${FF.thin}`, letterSpacing: "-0.03em", color: "transparent", WebkitTextStroke: `2px ${P.bone}` }}>
      {Math.round(pct)}<span style={{ color: P.bone, WebkitTextStroke: "0px" }}>%</span>
    </div>
    <div style={{ position: "absolute", left: 260, top: 790, width: 1400, height: 14, border: `1px solid ${P.stone}` }}><div style={{ width: `${pct}%`, height: "100%", background: P.bone }} /></div>
    {charging ? <><div style={{ position: "absolute", left: 1500, top: 260, font: `400 120px ${FF.thin}`, color: P.light, opacity: 0.85 }}>⚡︎</div><Label x={1520} y={420}>charging</Label></> : null}
    <div style={{ position: "absolute", left: 260, top: 830 }}>{sub}</div>
  </>
);

export const Chorus1V3: React.FC<{ t: number; batt?: [number, number, number, number]; end?: "road" | "dim"; real?: number }> = ({ t, batt = [12, 15, 15, 34], end = "road", real }) => {
  const rt = real ?? t; // real song time (for anything tied to the actual beat)
  kt = rt;
  const open = cubicOut(clamp01((t - 57.16) / 0.9));
  const light = mix(0.25, 1.15, open) * (t > 84.5 ? mix(1, 0.85, clamp01((t - 84.5) / 4)) : 1);
  const cam: [number, number, number] = [Math.sin(t * 0.11) * 0.25, 1.45 + Math.sin(t * 0.17) * 0.06, 6.0];
  const flash = 1 - clamp01((t - 57.2) / 0.7);
  return (
    <AbsoluteFill style={{ background: P.char }}>
      <Room t={t} light={light} cam={cam} look={[Math.sin(t * 0.11) * 0.12, 1.55, 0]} />
      {/* the dust rises in the chorus */}
      <svg viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0 }}>
        {Array.from({ length: 70 }, (_, i) => { const r = rng(i + 900); const x = r() * 1920, sp = 30 + r() * 70, y = 1100 - (((t - 57) * sp + r() * 1100) % 1150); return <circle key={i} cx={x + Math.sin(t * 0.6 + i) * 12} cy={y} r={0.8 + r() * 1.8} fill={P.light} opacity={0.1 + r() * 0.3} />; })}
      </svg>

      {/* 0:57 · I DON'T WANNA DIE — the battery, charging; status: still here */}
      <Up t={t} s={57.2} e={59.24}>
        <Battery pct={mix(batt[0], batt[1], clamp01((t - 57.4) / 1.8))} top={batt[0] < 5 ? "I’M RUNNING ON EMPTY" : "I’M RUNNING ON"} sub={
          <div style={{ ...mono(18, P.paper) }}><Sp t={t} li={24} wi={0} text="I" /> <Sp t={t} li={24} wi={1} text="don't" /> <Sp t={t} li={24} wi={2} text="wanna" /> <Sp t={t} li={24} wi={3} text="die" /> <span style={{ marginLeft: 30, color: P.bone, opacity: seen(24, 3, t) }}>· status: still here</span></div>
        } />
      </Up>

      {/* 0:59 · I JUST WANNA DRIFT — Do Not Disturb switches on; DRIFT lifts off */}
      <Up t={t} s={59.24} e={61.62}>
        {(() => {
          const on = cubicInOut(clamp01((t - (W(25, 3).s - 0.1)) / 0.25));
          const lift = Math.max(0, t - W(25, 3).s);
          return (
            <>
              <Float x={560} y={420} w={800} h={170} rx={10}>
                <div style={{ width: "100%", height: "100%", borderRadius: 34, background: "rgba(20,18,16,0.92)", boxShadow: "inset 0 0 0 1px #3a342e", display: "flex", alignItems: "center", padding: "0 50px", gap: 34 }}>
                  <span style={{ fontSize: 70, color: mixC(P.dim, P.bone, on) }}>☾</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ font: `500 40px ${FF.thin}`, color: P.bone }}>Do Not Disturb</div>
                    <div style={{ ...mono(16, P.stone, "0.12em"), textTransform: "none", marginTop: 6 }}><Sp t={t} li={25} wi={0} text="I" /> <Sp t={t} li={25} wi={1} text="just" /> <Sp t={t} li={25} wi={2} text="wanna" /> · {on > 0.5 ? "on until I come back" : "off"}</div>
                  </div>
                  <span style={{ width: 120, height: 68, borderRadius: 40, background: mixC("#3a342e", P.bone, on), position: "relative" }}><i style={{ position: "absolute", top: 6, left: 6 + on * 52, width: 56, height: 56, borderRadius: "50%", background: on > 0.5 ? P.char : P.paper }} /></span>
                </div>
              </Float>
              <div style={{ position: "absolute", left: 0, right: 0, top: 220 - lift * 60, textAlign: "center", ...big(190, "0.22em"), color: sungC(25, 3, t), opacity: seen(25, 3, t), transform: `rotate(${-lift * 3}deg)` }}>DRIFT</div>
            </>
          );
        })()}
      </Up>

      {/* 1:01 · FLOAT SOMEWHERE BETWEEN THE STARS — the star chart */}
      <Up t={t} s={61.62} e={64.52}>
        {(() => {
          const stars = Array.from({ length: 34 }, (_, i) => { const r = rng(i + 70); const a = r() * Math.PI * 2, d = 40 + r() * 330; return [960 + Math.cos(a) * d * 1.25, 500 + Math.sin(a) * d * 0.95, 1 + r() * 3.2]; });
          const lines = [[0, 3], [3, 7], [7, 12], [12, 5], [5, 0], [9, 14], [14, 20], [20, 22], [16, 18], [18, 25]];
          const draw = clamp01((t - 61.7) / 2.2);
          return (
            <svg viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0 }}>
              <g transform={`rotate(${(t - 61.6) * 2} 960 500)`}>
                <circle cx={960} cy={500} r={430} fill="none" stroke={P.stone} strokeWidth={1.2} opacity={0.6} />
                <circle cx={960} cy={500} r={300} fill="none" stroke={P.dim} strokeWidth={1} opacity={0.6} />
                {Array.from({ length: 72 }, (_, i) => { const a = (i / 72) * Math.PI * 2; const r0 = i % 6 ? 422 : 410; return <line key={i} x1={960 + Math.cos(a) * r0} y1={500 + Math.sin(a) * r0} x2={960 + Math.cos(a) * 430} y2={500 + Math.sin(a) * 430} stroke={P.stone} strokeWidth={1} opacity={0.6} />; })}
                {lines.map(([a0, b0], k) => { const u = clamp01(draw * lines.length - k); if (u <= 0) return null; const A = stars[a0], B = stars[b0]; return <line key={k} x1={A[0]} y1={A[1]} x2={A[0] + (B[0] - A[0]) * u} y2={A[1] + (B[1] - A[1]) * u} stroke={P.paper} strokeWidth={1} opacity={0.6} />; })}
                {stars.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill={P.bone} opacity={0.5 + 0.5 * Math.sin(t * 2 + i)} />)}
              </g>
              <circle cx={1010} cy={520} r={9} fill={P.light} />
              <text x={1034} y={528} style={{ font: `italic 400 34px ${FF.serif}` }} fill={P.paper} opacity={seen(26, 1, t)}>you, somewhere</text>
              <text x={960} y={140} textAnchor="middle" style={{ font: `400 64px ${FF.display}`, letterSpacing: "0.3em" }} fill={sungC(26, 0, t)} opacity={seen(26, 0, t)}>FLOAT</text>
              <text x={960} y={905} textAnchor="middle" style={{ font: `italic 400 44px ${FF.serif}` }} fill={P.paper}><tspan opacity={seen(26, 2, t)} fill={sungC(26, 2, t, P.paper)}>between </tspan><tspan opacity={seen(26, 3, t)}>the </tspan><tspan opacity={seen(26, 4, t)} fill={sungC(26, 4, t, P.paper)} style={{ font: `400 64px ${FF.display}`, letterSpacing: "0.3em" }}>STARS</tspan></text>
            </svg>
          );
        })()}
      </Up>

      {/* 1:04 · AND FORGET ABOUT ALL THIS — the dialog */}
      <Up t={t} s={64.52} e={68.27}>
        {(() => {
          const press = W(27, 4).s, gone = cubicIn(clamp01((t - press) / 0.6));
          const ghosts = ["6:00", "140/90", "#BLESSED", "3h 12m", "ME", "MY TIME", "160 kg", "MINE", "SUCCESS", "NO SERVICE", "ACHIEVEMENTS", "DARKNESS"];
          return (
            <>
              {ghosts.map((g, i) => { const r = rng(i + 400); return <div key={i} style={{ position: "absolute", left: 160 + r() * 1500, top: 90 + r() * 820 - gone * (200 + r() * 300), ...big(40 + r() * 50, "0.14em"), color: P.stone, opacity: (0.18 + r() * 0.2) * (1 - gone) * clamp01((t - 64.6 - i * 0.08) / 0.4), filter: `blur(${1 + r() * 2 + gone * 6}px)` }}>{g}</div>; })}
              <Float x={610} y={330} w={700} h={360} rx={8}>
                <div style={{ width: "100%", height: "100%", borderRadius: 30, background: "rgba(24,22,20,0.95)", boxShadow: "inset 0 0 0 1px #3a342e", textAlign: "center", padding: "50px 50px 0" }}>
                  <div style={{ font: `500 40px ${FF.thin}`, color: P.bone }}><Sp t={t} li={27} wi={0} text="And" rest={P.bone} style={{ textTransform: "none" }} /> <Sp t={t} li={27} wi={1} text="forget" rest={P.bone} style={{ textTransform: "none" }} /> <Sp t={t} li={27} wi={2} text="about" rest={P.bone} style={{ textTransform: "none" }} /> <Sp t={t} li={27} wi={3} text="all" rest={P.bone} style={{ textTransform: "none" }} /> <Sp t={t} li={27} wi={4} text="this?" rest={P.bone} style={{ textTransform: "none" }} /></div>
                  <div style={{ font: `400 22px ${FF.thin}`, color: P.stone, marginTop: 16 }}>Just for tonight. You can bring it back tomorrow.</div>
                  <div style={{ display: "flex", borderTop: "1px solid #3a342e", marginTop: 50 }}>
                    <span style={{ flex: 1, padding: 28, font: `500 26px ${FF.thin}`, color: P.stone, borderRight: "1px solid #3a342e" }}>Cancel</span>
                    <span style={{ flex: 1, padding: 28, font: `600 26px ${FF.thin}`, color: P.char, background: P.bone, borderRadius: "0 0 30px 0", transform: `scale(${1 - 0.06 * Math.max(0, 1 - Math.abs(t - press) / 0.15)})` }}>Forget</span>
                  </div>
                </div>
              </Float>
            </>
          );
        })()}
      </Up>

      {/* 1:08–1:11 · NO DEADLINES · NO EXPECTATIONS — the list, the review, the stamp */}
      {[[28, 68.25, 69.46, "DEADLINES", ["Mix due Friday", "Label call 9am", "Tour dates locked", "Promo by Monday"]], [29, 69.46, 71.31, "EXPECTATIONS", ["Next single: bigger", "Always on", "Never tired", "Keep it up"]]].map(([li, s, e, word, items]) => (
        <Up key={li as number} t={t} s={s as number} e={e as number}>
          {(() => {
            const n = li as number, stampT = W(n, 0).s;
            const st = cubicOut(clamp01((t - stampT) / 0.16));
            const strike = clamp01((t - W(n, 1).s) / 0.8);
            return (
              <>
                <Float x={600} y={150} w={720} h={720} rx={12} rz={n === 28 ? -2 : 2}>
                  <div style={{ width: "100%", height: "100%", background: P.paper, color: "#2a2622", padding: "56px 64px", boxShadow: "inset 0 0 120px rgba(0,0,0,0.25)" }}>
                    <div style={{ ...mono(15, "#5a524a") }}>{n === 28 ? "to do · this week" : "annual review · form 7"}</div>
                    <div style={{ font: `400 64px ${FF.display}`, letterSpacing: "0.12em", marginTop: 16, color: sungC(n, 1, t, "#2a2622") === P.bone ? "#1a1714" : "#2a2622", opacity: seen(n, 1, t) }}>{word as string}</div>
                    {(items as string[]).map((x, i) => (
                      <div key={i} style={{ font: `400 28px ${FF.mono}`, marginTop: 22, position: "relative", width: "fit-content" }}>☐ {x}<i style={{ position: "absolute", left: 0, top: "52%", height: 3, background: "#2a2622", width: `${clamp01(strike * 4 - i) * 100}%` }} /></div>
                    ))}
                  </div>
                </Float>
                {st > 0 ? <div style={{ position: "absolute", left: 1060, top: 170, padding: "6px 34px", border: `6px solid ${P.bone}`, ...big(150, "0.12em"), color: P.bone, transform: `rotate(-12deg) scale(${mix(1.6, 1, st)})`, opacity: st * 0.92 }}>NO</div> : null}
              </>
            );
          })()}
        </Up>
      ))}

      {/* 1:11 · NO VOICES IN MY HEAD — the group chat, muted one by one */}
      <Up t={t} s={71.31} e={75.22}>
        <Float x={640} y={70} w={640} h={880} rx={10} ry={-6}>
          <Phone w={640} h={880}>
            <div style={{ position: "absolute", left: 40, right: 40, top: 50 }}>
              <div style={{ ...mono(15) }}>group · everyone · 128 unread</div>
              {Array.from({ length: 6 }, (_, i) => {
                const muteT = 72.1 + i * 0.45, m = clamp01((t - muteT) / 0.25);
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 26, justifyContent: i % 2 ? "flex-end" : "flex-start" }}>
                    <div style={{ width: 380, height: 70, borderRadius: 36, background: "#211e1b", display: "flex", alignItems: "center", gap: 3, padding: "0 24px", opacity: 1 - 0.55 * m }}>
                      <span style={{ color: P.bone, fontSize: 22, marginRight: 10 }}>{m > 0.5 ? "🔇︎" : "▶︎"}</span>
                      {Array.from({ length: 34 }, (_, k) => { const h = 6 + 22 * Math.abs(Math.sin(k * 0.7 + i) * Math.sin(k * 0.23 + t * (1 - m) * 3)); return <i key={k} style={{ width: 4, height: mix(h, 3, m), background: P.paper, borderRadius: 2 }} />; })}
                    </div>
                  </div>
                );
              })}
              <div style={{ marginTop: 34, textAlign: "center", ...mono(20, P.paper) }}><Sp t={t} li={30} wi={0} text="no" /> <Sp t={t} li={30} wi={1} text="voices" style={{ ...big(56, "0.18em") }} /> <Sp t={t} li={30} wi={2} text="in" /> <Sp t={t} li={30} wi={3} text="my" /> <Sp t={t} li={30} wi={4} text="head" /></div>
            </div>
          </Phone>
        </Float>
      </Up>

      {/* 1:15 · I DON'T WANNA LEAVE THIS WORLD — the engraved globe */}
      <Up t={t} s={75.22} e={77.7}>
        {(() => {
          const rot = (t - 75) * 0.5, R = 330, cx = 960, cy = 470;
          return (
            <svg viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0 }}>
              <circle cx={cx} cy={cy} r={R} fill="#14120f" stroke={P.stone} strokeWidth={2} />
              {Array.from({ length: 12 }, (_, k) => { const a = ((k / 12) * Math.PI + rot) % Math.PI; const rx = Math.abs(Math.cos(a)) * R; return <ellipse key={k} cx={cx} cy={cy} rx={rx} ry={R} fill="none" stroke={P.dim} strokeWidth={1} opacity={0.8} />; })}
              {[-0.66, -0.33, 0, 0.33, 0.66].map((f, k) => <ellipse key={k} cx={cx} cy={cy + f * R} rx={Math.sqrt(1 - f * f) * R} ry={Math.sqrt(1 - f * f) * R * 0.12} fill="none" stroke={P.dim} strokeWidth={1} />)}
              <rect x={cx - R - 30} y={cy - 40} width={2 * R + 60} height={80} fill={P.char} stroke={P.stone} strokeWidth={1.5} />
              <text x={cx} y={cy + 24} textAnchor="middle" style={{ font: `400 70px ${FF.display}`, letterSpacing: "0.5em" }} fill={sungC(31, 5, t)} opacity={seen(31, 5, t)}>WORLD</text>
              <text x={cx} y={cy - R - 50} textAnchor="middle" style={{ font: `500 22px ${FF.mono}`, letterSpacing: "0.26em" }} fill={P.stone}><tspan opacity={seen(31, 0, t)}>I </tspan><tspan opacity={seen(31, 1, t)}>DON'T </tspan><tspan opacity={seen(31, 2, t)}>WANNA </tspan><tspan opacity={seen(31, 3, t)} fill={sungC(31, 3, t)}>LEAVE </tspan><tspan opacity={seen(31, 4, t)}>THIS</tspan></text>
            </svg>
          );
        })()}
      </Up>

      {/* 1:17 · I JUST WANNA LEAVE IT FOR A… BIT — away status; the held A fills the bar */}
      <Up t={t} s={77.7} e={84.7}>
        {(() => {
          const a = W(32, 6), bit = W(32, 7);
          const fill = clamp01((t - a.s) / (bit.s - a.s));
          const set = cubicOut(clamp01((t - W(32, 3).s) / 0.3));
          return (
            <Float x={510} y={330} w={900} h={360} rx={8}>
              <div style={{ width: "100%", height: "100%", borderRadius: 30, background: "rgba(24,22,20,0.95)", boxShadow: "inset 0 0 0 1px #3a342e", padding: "44px 60px" }}>
                <div style={{ ...mono(15) }}>status</div>
                <div style={{ display: "flex", alignItems: "center", gap: 24, marginTop: 18 }}>
                  <span style={{ width: 30, height: 30, borderRadius: "50%", background: mixC("#4a7a4a", P.stone, set), boxShadow: `0 0 0 6px ${mixC("#22301f", "#2a2622", set)}` }} />
                  <span style={{ font: `500 54px ${FF.thin}`, color: P.bone }}>{set > 0.5 ? "Away" : "Available"}</span>
                </div>
                <div style={{ font: `400 30px ${FF.thin}`, color: P.paper, marginTop: 16, opacity: set }}>
                  <Sp t={t} li={32} wi={4} text="it" rest={P.paper} style={{ textTransform: "none" }} /> · back in <Sp t={t} li={32} wi={6} text="a" rest={P.paper} style={{ textTransform: "none" }} /> <Sp t={t} li={32} wi={7} text="bit" rest={P.bone} style={{ ...big(48, "0.2em") }} />
                </div>
                <div style={{ marginTop: 26, height: 10, background: "#2a2622", borderRadius: 5, overflow: "hidden" }}><div style={{ width: `${fill * 100}%`, height: "100%", background: P.bone }} /></div>
                <div style={{ ...mono(13, P.dim), marginTop: 10 }}><Sp t={t} li={32} wi={0} text="I" rest={P.dim} /> <Sp t={t} li={32} wi={1} text="just" rest={P.dim} /> <Sp t={t} li={32} wi={2} text="wanna" rest={P.dim} /> <Sp t={t} li={32} wi={3} text="leave" rest={P.dim} /> · <Sp t={t} li={32} wi={5} text="for" rest={P.dim} /> a while</div>
              </div>
            </Float>
          );
        })()}
      </Up>

      {/* 1:24 · I DON'T WANNA… DIE / I JUST WANNA DRIFT — the battery has climbed; airplane mode; the stars stretch into road lights */}
      <Up t={t} s={84.66} e={93}>
        {(() => {
          const air = cubicInOut(clamp01((t - (W(34, 3).s - 0.15)) / 0.3));
          return (
            <>
              <Battery pct={mix(batt[2], batt[3], clamp01((t - 84.7) / 5))} top="STILL HERE · CHARGING" sub={
                <div style={{ ...mono(18, P.paper) }}><Sp t={t} li={33} wi={0} text="I" /> <Sp t={t} li={33} wi={1} text="don't" /> <Sp t={t} li={33} wi={2} text="wanna" /> <Sp t={t} li={33} wi={3} text="die" /> <span style={{ marginLeft: 26 }}><Sp t={t} li={34} wi={0} text="· I" /> <Sp t={t} li={34} wi={1} text="just" /> <Sp t={t} li={34} wi={2} text="wanna" /> <Sp t={t} li={34} wi={3} text="drift" /></span></div>
              } />
              <div style={{ position: "absolute", right: 120, top: 560, display: "flex", alignItems: "center", gap: 18, opacity: clamp01((t - 89.9) / 0.4) }}>
                <span style={{ fontSize: 46, color: mixC(P.dim, P.bone, air) }}>✈︎</span>
                <span style={{ ...mono(18, P.paper) }}>airplane mode</span>
                <span style={{ width: 90, height: 50, borderRadius: 30, background: mixC("#3a342e", P.bone, air), position: "relative" }}><i style={{ position: "absolute", top: 5, left: 5 + air * 40, width: 40, height: 40, borderRadius: "50%", background: air > 0.5 ? P.char : P.paper }} /></span>
              </div>
            </>
          );
        })()}
      </Up>
      {/* the hand-off to verse 2: light streaks */}
      {end === "road" && t > 91.0 ? (
        <svg viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0 }}>
          {Array.from({ length: 40 }, (_, i) => { const r = rng(i + 77); const y = 540 + (r() - 0.5) * 900, k = clamp01((t - 91.0) / 0.8); const len = k * (300 + r() * 900); const x = 960 + (r() - 0.5) * 200; return <line key={i} x1={x - len * (r() > 0.5 ? 1 : -1)} y1={y} x2={x} y2={y + (r() - 0.5) * 20} stroke={P.light} strokeWidth={1 + r() * 2} opacity={0.15 + r() * 0.4} />; })}
        </svg>
      ) : null}
      {end === "dim" && t > 90.6 ? <AbsoluteFill style={{ background: P.char, opacity: cubicInOut(clamp01((t - 90.6) / 1.2)) }} /> : null}
      {flash > 0 ? <AbsoluteFill style={{ background: `radial-gradient(ellipse 60% 70% at 50% 50%, ${P.light}, rgba(242,227,200,0) 70%)`, opacity: flash * 0.9 }} /> : null}
      <Finish3 />
    </AbsoluteFill>
  );
};
