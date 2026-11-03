import React from "react";
import { AbsoluteFill } from "remotion";
import { clamp01, cubicIn, cubicInOut, cubicOut, mix } from "../utils/ease";
import { rng } from "../utils/random";
import { Lyrics, FN_SPECS } from "./kinetic";
import { FF, Finish3, Float, P, Room } from "./kit";
import { Phone } from "./frames";
import { Battery, Up } from "./chorus1";
import { Shot, Sp, W, big, mixC, mono, seen, sungC } from "./verse1";
import { VOC } from "./voice";

/**
 * Final chorus + outro (3:22.9–4:24). The biggest float: the battery charges to 100% on STRONGER; the things that
 * chased you can't find you, can't reach you; you hear yourself again (a waveform drawn from the real vocal).
 * Then tomorrow's list, the shelf rebuilt and holding WEIGHT, the alarm set, airplane mode, the light drifting
 * off, the title, and the dark that loops back to the first frame.
 */
export const FN_START = 202.8;
export const FN_END = 264.0;

export const FinaleV3: React.FC<{ t: number }> = ({ t }) => {
  const dim = t < 236.8 ? 1.1 : mix(1.1, 0.2, cubicInOut(clamp01((t - 236.8) / 5)));
  const light = t > 246 ? mix(0.2, 0, clamp01((t - 246) / 3)) : dim;
  return (
    <AbsoluteFill style={{ background: P.char }}>
      <Room t={t} light={light} cam={[Math.sin(t * 0.11) * 0.2, 1.45, 6.0]} />
      {t < 227.6 ? <svg viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0 }}>{Array.from({ length: 90 }, (_, i) => { const r = rng(i + 1900); const x = r() * 1920, sp = 40 + r() * 80, y = 1100 - (((t - 202) * sp + r() * 1100) % 1150); return <circle key={i} cx={x + Math.sin(t * 0.6 + i) * 12} cy={y} r={0.8 + r() * 2} fill={P.light} opacity={0.12 + r() * 0.35} />; })}</svg> : null}

      {/* 3:22 · I DON'T WANNA DIE · I JUST WANNA DRIFT — charging fast, DND on */}
      <Up t={t} s={202.86} e={207.28}>
        <Battery pct={mix(61, 88, clamp01((t - 203) / 4))} top="STILL HERE · CHARGING" sub={
          <div style={{ ...mono(18, P.paper) }}><Sp t={t} li={79} wi={0} text="I" /> <Sp t={t} li={79} wi={1} text="don't" /> <Sp t={t} li={79} wi={2} text="wanna" /> <Sp t={t} li={79} wi={3} text="die" /> · <Sp t={t} li={80} wi={0} text="I" /> <Sp t={t} li={80} wi={1} text="just" /> <Sp t={t} li={80} wi={2} text="wanna" /> <Sp t={t} li={80} wi={3} text="drift" style={{ ...big(44, "0.2em") }} /></div>
        } />
        <div style={{ position: "absolute", right: 140, top: 560, display: "flex", alignItems: "center", gap: 16, opacity: clamp01((t - 205) / 0.4) }}><span style={{ fontSize: 50, color: P.bone }}>☾</span><span style={mono(18, P.paper)}>do not disturb · on</span></div>
      </Up>

      {/* 3:27 · SOMEWHERE THE GUILT CAN'T FIND ME — the location search finds nothing */}
      <Up t={t} s={207.28} e={210.11}>
        {(() => {
          const sweep = (t - 207.3) * 2.4;
          return (
            <svg viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0 }}>
              {[120, 220, 320].map((r, i) => <circle key={i} cx={960} cy={500} r={r} fill="none" stroke={P.dim} strokeWidth={1.5} />)}
              <path d={`M960 500 L${960 + Math.cos(sweep) * 330} ${500 + Math.sin(sweep) * 330} A330 330 0 0 0 ${960 + Math.cos(sweep - 0.5) * 330} ${500 + Math.sin(sweep - 0.5) * 330} Z`} fill={P.light} opacity={0.12} />
              <text x={960} y={150} textAnchor="middle" style={{ font: `500 22px ${FF.mono}`, letterSpacing: "0.3em" }} fill={P.stone}><tspan opacity={seen(81, 0, t)}>SOMEWHERE </tspan><tspan opacity={seen(81, 1, t)}>THE</tspan></text>
              <text x={960} y={520} textAnchor="middle" style={{ font: `400 120px ${FF.display}`, letterSpacing: "0.3em" }} fill={sungC(81, 2, t)} opacity={seen(81, 2, t) * 0.35}>GUILT</text>
              <text x={960} y={900} textAnchor="middle" style={{ font: `500 24px ${FF.mono}`, letterSpacing: "0.26em" }} fill={P.paper}><tspan opacity={seen(81, 3, t)}>CAN'T </tspan><tspan opacity={seen(81, 4, t)} fill={sungC(81, 4, t, P.paper)}>FIND </tspan><tspan opacity={seen(81, 5, t)}>ME</tspan><tspan opacity={seen(81, 4, t)} fill={P.dim}> · location unavailable</tspan></text>
            </svg>
          );
        })()}
      </Up>

      {/* 3:30 · SOMEWHERE THE PAST CAN'T REACH — call failed */}
      <Up t={t} s={210.11} e={212.62}>
        <Float x={775} y={110} w={380} h={780} rx={6} ry={-4}>
          <Phone w={380} h={780}>
            <div style={{ position: "absolute", top: 160, width: "100%", textAlign: "center" }}>
              <div style={mono(14)}><Sp t={t} li={82} wi={0} text="somewhere" /> · calling</div>
              <div style={{ ...big(70, "0.14em"), marginTop: 34, paddingLeft: "0.14em" }}><Sp t={t} li={82} wi={1} text="THE" /> <Sp t={t} li={82} wi={2} text="PAST" /></div>
              <div style={{ ...mono(16, t >= W(82, 4).s ? P.bone : P.dim), marginTop: 26 }}>{t >= W(82, 4).s ? "call failed · unreachable" : <><Sp t={t} li={82} wi={3} text="can't" /> · connecting…</>}</div>
              <div style={{ ...big(64, "0.2em"), marginTop: 30 }}><Sp t={t} li={82} wi={4} text="REACH" /></div>
            </div>
          </Phone>
        </Float>
      </Up>

      {/* 3:32 · SOMEWHERE I CAN HEAR MYSELF AGAIN — a voice memo of the real vocal */}
      <Up t={t} s={212.62} e={215.22}>
        {(() => {
          const N = 160, bars = Array.from({ length: N }, (_, i) => { const tt = t - (N - i) * 0.02; return clamp01((VOC(tt) + 45) / 45); });
          return (
            <Float x={360} y={260} w={1200} h={480} rx={8}>
              <div style={{ width: "100%", height: "100%", background: "rgba(22,20,18,0.96)", borderRadius: 30, boxShadow: "inset 0 0 0 1px #3a342e", position: "relative", padding: "40px 50px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", ...mono(16) }}><span>voice memo · recording</span><span style={{ color: P.ember }}>● {Math.floor(t - 212.6)}s</span></div>
                <svg viewBox="0 0 1100 220" style={{ width: "100%", height: 220, marginTop: 30 }}>{bars.map((v, i) => <rect key={i} x={i * 6.8} y={110 - v * 100} width={3.4} height={Math.max(2, v * 200)} fill={i > N - 4 ? P.light : P.bone} opacity={0.4 + 0.6 * (i / N)} />)}</svg>
                <div style={{ ...mono(20, P.paper), marginTop: 20 }}><Sp t={t} li={83} wi={0} text="somewhere" /> <Sp t={t} li={83} wi={1} text="I" /> <Sp t={t} li={83} wi={2} text="can" /> <Sp t={t} li={83} wi={3} text="hear" /> <Sp t={t} li={83} wi={4} text="myself" style={{ ...big(48, "0.2em") }} /> <Sp t={t} li={83} wi={5} text="again" /></div>
              </div>
            </Float>
          );
        })()}
      </Up>

      {/* 3:35 · UNDERNEATH THE NOISE — the noise peels away, one line left */}
      <Up t={t} s={215.22} e={216.4}>
        <svg viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0 }}>
          {Array.from({ length: 7 }, (_, k) => { const off = clamp01((t - 215.3 - k * 0.12) / 0.4); return <path key={k} d={Array.from({ length: 120 }, (_, i) => `${i ? "L" : "M"}${i * 16} ${540 + Math.sin(i * (0.3 + k * 0.17) + t * (3 + k)) * (30 + k * 18)}`).join(" ")} fill="none" stroke={k === 0 ? P.bone : P.dim} strokeWidth={k === 0 ? 4 : 2} opacity={k === 0 ? 1 : 0.6 * (1 - off)} transform={`translate(0 ${k === 0 ? 0 : off * (k % 2 ? 300 : -300)})`} />; })}
          <text x={960} y={300} textAnchor="middle" style={{ font: `500 24px ${FF.mono}`, letterSpacing: "0.3em" }} fill={P.stone}><tspan opacity={seen(84, 0, t)} fill={sungC(84, 0, t)}>UNDERNEATH </tspan><tspan opacity={seen(84, 1, t)}>THE</tspan></text>
          <text x={960} y={820} textAnchor="middle" style={{ font: `400 110px ${FF.display}`, letterSpacing: "0.4em" }} fill={sungC(84, 2, t)} opacity={0}>NOISE</text>
        </svg>
      </Up>

      {/* 3:36 · AND WHEN I'M READY · I'LL COME BACK STRONGER — status READY, then 100% */}
      <Up t={t} s={216.4} e={218.14}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 340, textAlign: "center" }}>
          <div style={mono(22, P.paper)}><Sp t={t} li={85} wi={0} text="and" /> <Sp t={t} li={85} wi={1} text="when" /> <Sp t={t} li={85} wi={2} text="I'm" /></div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 30, marginTop: 30 }}>
            <svg viewBox="0 0 120 120" style={{ width: 120, height: 120 }}><circle cx={60} cy={60} r={52} fill="none" stroke={P.bone} strokeWidth={4} /><path d="M34 62 L52 80 L88 42" fill="none" stroke={P.bone} strokeWidth={8} strokeLinecap="round" strokeDasharray="90" strokeDashoffset={90 * (1 - clamp01((t - W(85, 3).s) / 0.25))} /></svg>
            <span style={{ ...big(140, "0.2em") }}><Sp t={t} li={85} wi={3} text="READY" /></span>
          </div>
        </div>
      </Up>
      <Up t={t} s={218.14} e={221.78}>
        <Battery pct={Math.min(100, mix(88, 100, clamp01((t - 218.2) / 2.8)))} top="" charging={t < 221.05} sub={
          <div style={{ ...mono(18, P.paper) }}><Sp t={t} li={86} wi={0} text="I'll" /> <Sp t={t} li={86} wi={1} text="come" /> <Sp t={t} li={86} wi={2} text="back" /> · fully charged</div>
        } />
        <div style={{ position: "absolute", left: 250, top: 40, ...big(150, "0.18em"), color: sungC(86, 3, t, "#b9ab97"), opacity: 0, transform: `translateY(${(1 - cubicOut(clamp01((t - W(86, 3).s) / 0.18))) * -40}px)` }}>STRONGER</div>
      </Up>

      {/* 3:41 · BUT TONIGHT — 11:59 */}
      <Up t={t} s={221.78} e={224.6}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 260, textAlign: "center" }}>
          <div style={{ font: `100 260px/1 ${FF.thin}`, color: P.bone }}>11:59</div>
          <div style={{ ...mono(22, P.paper), marginTop: 10 }}><Sp t={t} li={87} wi={0} text="but" /> · pm</div>
          <div style={{ ...big(130, "0.4em"), marginTop: 30 }}><Sp t={t} li={87} wi={1} text="TONIGHT" /></div>
        </div>
      </Up>

      {/* 3:44 · I JUST WANNA DRIFT — everything lifts */}
      <Up t={t} s={224.6} e={227.7}>
        {(() => {
          const lift = Math.max(0, t - W(88, 3).s);
          const all = ["6:00", "PRESSURE", "#BLESSED", "ME", "MY TIME", "WEIGHT", "MINE", "SUCCESS", "DARKNESS", "NOISE", "DAD", "NOTHING", "WON'T FIX", "GUILT", "THE PAST"];
          return (
            <>
              {all.map((g, i) => { const r = rng(i + 222); return <div key={i} style={{ position: "absolute", left: 120 + r() * 1600, top: 900 - (t - 224.6) * (90 + r() * 160) - r() * 300, ...big(30 + r() * 46, "0.16em"), color: P.stone, opacity: 0.35 * clamp01((t - 224.7 - i * 0.05) / 0.5), filter: `blur(${r() * 2}px)`, transform: `rotate(${(r() - 0.5) * 20}deg)` }}>{g}</div>; })}
              <div style={{ position: "absolute", left: 0, right: 0, top: 380 - lift * 40, textAlign: "center", ...mono(22, P.paper) }}><Sp t={t} li={88} wi={0} text="I" /> <Sp t={t} li={88} wi={1} text="just" /> <Sp t={t} li={88} wi={2} text="wanna" /></div>
              <div style={{ position: "absolute", left: 0, right: 0, top: 430 - lift * 40, textAlign: "center", ...big(220, "0.3em"), color: sungC(88, 3, t), opacity: 0, transform: `rotate(${-lift * 1.5}deg)` }}>DRIFT</div>
            </>
          );
        })()}
      </Up>

      {/* 3:47–3:56 · TOMORROW I'LL KEEP FIGHTING · BUILDING · CARRYING THE WEIGHT — tomorrow's list; the shelf rebuilt, holding */}
      <Shot t={t} s={227.53} e={236.85}>
        {(() => {
          const ink = "#2a2622";
          const row = (li: number, words: number[], label: React.ReactNode, i: number) => {
            const tick = clamp01((t - (W(li, 2).s + 0.2)) / 0.2);
            return <div key={i} style={{ font: `500 54px/1.2 ${FF.hand}`, marginTop: 18, display: "flex", gap: 18, alignItems: "baseline", opacity: seen(li, 0, t) }}><span style={{ display: "inline-block", width: 40, height: 40, border: `3px solid ${ink}`, position: "relative", top: 6 }}>{tick > 0 ? <svg viewBox="0 0 40 40" style={{ position: "absolute", inset: -3 }}><path d="M8 20 L17 30 L34 8" fill="none" stroke={ink} strokeWidth={4} strokeDasharray="44" strokeDashoffset={44 * (1 - tick)} /></svg> : null}</span>{words.map((wi) => <Sp key={wi} t={t} li={li} wi={wi} text={W(li, wi).w.toLowerCase()} rest={ink} style={{ color: ink }} />)}{label}</div>;
          };
          const shelfDraw = clamp01((t - 231.0) / 1.6);
          const wDrop = cubicIn(clamp01((t - (W(91, 5).s - 0.35)) / 0.35));
          const settle = Math.max(0, t - W(91, 5).s);
          return (
            <>
              <Float x={170} y={110} w={820} h={760} rx={10} rz={-2}>
                <div style={{ width: "100%", height: "100%", background: P.paper, color: ink, padding: "54px 60px", backgroundImage: "repeating-linear-gradient(transparent 0 62px, rgba(60,52,46,0.22) 62px 64px)", boxShadow: "inset 0 0 120px rgba(0,0,0,0.25)" }}>
                  <div style={{ ...mono(18, "#5a524a") }}><Sp t={t} li={89} wi={0} text="tomorrow" rest="#5a524a" style={{ color: "#5a524a" }} /></div>
                  {row(89, [1, 2, 3], null, 0)}
                  {row(90, [1, 2, 3], null, 1)}
                  {row(91, [1, 2, 3, 4], <span style={{ font: `400 60px ${FF.display}`, letterSpacing: "0.16em", color: sungC(91, 5, t, "#1a1714") === P.bone ? "#1a1714" : "#1a1714", opacity: seen(91, 5, t) }}>WEIGHT</span>, 2)}
                </div>
              </Float>
              <svg viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0 }}>
                <g stroke={P.bone} strokeWidth={4} fill="none" strokeLinecap="round">
                  <path d={`M1180 640 L${1180 + 560 * shelfDraw} 640`} />
                  <path d={`M1240 640 L1240 ${640 + 70 * clamp01(shelfDraw * 2)} L${1240 + 40 * clamp01(shelfDraw * 2 - 0.5)} 640`} />
                  <path d={`M1680 640 L1680 ${640 + 70 * clamp01(shelfDraw * 2 - 1)} L${1680 - 40 * clamp01(shelfDraw * 2 - 1.2)} 640`} />
                </g>
                <text x={1460} y={740} textAnchor="middle" style={{ font: `500 18px ${FF.mono}`, letterSpacing: "0.3em" }} fill={P.stone} opacity={shelfDraw}>REBUILT · LOAD TESTED</text>
                {t > W(91, 5).s - 0.4 ? <g transform={`translate(1460 ${mix(200, 600, wDrop) + Math.exp(-settle * 8) * Math.sin(settle * 30) * 6})`}><rect x={-170} y={-40} width={340} height={80} fill="#bdb3a4" /><text x={0} y={22} textAnchor="middle" style={{ font: `400 66px ${FF.display}`, letterSpacing: "0.2em" }} fill={P.char}>WEIGHT</text></g> : null}
                {settle > 0.3 ? <text x={1460} y={800} textAnchor="middle" style={{ font: `500 20px ${FF.mono}`, letterSpacing: "0.3em" }} fill={P.bone} opacity={clamp01((settle - 0.3) / 0.4)}>IT HOLDS</text> : null}
              </svg>
            </>
          );
        })()}
      </Shot>

      {/* 3:56 · BUT TONIGHT… — the alarm is set, the screen dims */}
      <Shot t={t} s={236.8} e={242.2}>
        <Float x={760} y={110} w={400} h={790} rx={14} ry={-6} rz={-2}>
          <div style={{ filter: `brightness(${mix(1, 0.35, clamp01((t - 238.5) / 3.5))})` }}>
            <Phone w={400} h={790}>
              <div style={{ position: "absolute", top: 110, width: "100%", textAlign: "center" }}>
                <div style={mono(14)}>alarm set · tomorrow</div>
                <div style={{ font: `100 170px/1 ${FF.thin}`, color: P.bone, marginTop: 24 }}>7:00</div>
                <div style={{ ...big(44, "0.3em"), marginTop: 30 }}><Sp t={t} li={92} wi={0} text="BUT" /><br /><Sp t={t} li={92} wi={1} text="TONIGHT" /></div>
                <div style={{ ...mono(13, P.dim, "0.12em"), marginTop: 20, textTransform: "none" }}>sleep well</div>
              </div>
            </Phone>
          </div>
        </Float>
      </Shot>

      {/* 4:02 · LET ME DRIFT — airplane mode, screen off, the light drifts away */}
      <Shot t={t} s={242.1} e={251}>
        {(() => {
          const air = cubicInOut(clamp01((t - 242.6) / 0.4)), off = clamp01((t - W(93, 2).s) / 0.6);
          const fly = Math.max(0, t - (W(93, 2).s + 0.4));
          return (
            <>
              <Float x={760} y={110} w={400} h={790} rx={14} ry={-6} rz={-2}>
                <Phone w={400} h={790}>
                  <div style={{ position: "absolute", inset: 0, opacity: 1 - off, display: "grid", placeItems: "center", alignContent: "center", gap: 26 }}>
                    <span style={{ fontSize: 80, color: mixC(P.dim, P.ember, air) }}>✈︎</span>
                    <div style={mono(16, P.paper)}>airplane mode</div>
                    <span style={{ width: 120, height: 68, borderRadius: 40, background: mixC("#3a342e", P.ember, air), position: "relative" }}><i style={{ position: "absolute", top: 6, left: 6 + air * 52, width: 56, height: 56, borderRadius: "50%", background: air > 0.5 ? P.char : P.paper }} /></span>
                    <div style={{ ...big(60, "0.3em"), marginTop: 30 }}><Sp t={t} li={93} wi={0} text="LET" /> <Sp t={t} li={93} wi={1} text="ME" /> <Sp t={t} li={93} wi={2} text="DRIFT" /></div>
                  </div>
                </Phone>
              </Float>
              {fly > 0 ? <div style={{ position: "absolute", left: 950 + Math.sin(fly * 0.7) * 120 + fly * 20, top: 480 - fly * 70, width: 18, height: 18, borderRadius: "50%", background: P.ember, boxShadow: `0 0 40px 10px rgba(240,124,74,0.5)`, opacity: 1 - clamp01((fly - 5.5) / 1.5) }} /> : null}
            </>
          );
        })()}
      </Shot>

      {/* 4:11 · the title, in the cover's lettering */}
      {t > 251 ? (
        <AbsoluteFill style={{ display: "grid", placeItems: "center", alignContent: "center", gap: 24, opacity: clamp01((t - 251) / 1.5) * (1 - clamp01((t - 259.5) / 1.5)) }}>
          <div style={{ font: `400 150px/1 ${FF.display}`, letterSpacing: "0.5em", paddingLeft: "0.5em", color: P.stone }}>RUDO</div>
          <div style={{ display: "flex", alignItems: "center", gap: 22, ...mono(20, P.stone, "0.42em") }}><i style={{ width: 70, height: 1, background: P.stone }} />DRIFT · STATIC &amp; SILENCE<i style={{ width: 70, height: 1, background: P.stone }} /></div>
        </AbsoluteFill>
      ) : null}
      {/* the last frames match the first: a spark, about to ignite */}
      {t > 261.5 ? <div style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, background: "#000", opacity: clamp01((t - 261.5) / 1) }}><div style={{ position: "absolute", left: "38%", top: "62%", width: 10, height: 10, borderRadius: "50%", background: P.ember, boxShadow: "0 0 30px 8px rgba(240,124,74,0.6)", opacity: clamp01((t - 262.6) / 1) }} /></div> : null}
      <Lyrics t={t} specs={FN_SPECS} />
      <Finish3 />
    </AbsoluteFill>
  );
};
