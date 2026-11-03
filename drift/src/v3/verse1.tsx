import React from "react";
import { AbsoluteFill } from "remotion";
import { LINES, T } from "../data";
import { clamp01, cubicIn, cubicInOut, cubicOut, mix } from "../utils/ease";
import { rng } from "../utils/random";
import { FF, Finish3, Float, P, Room } from "./kit";
import { Label, Phone } from "./frames";

/**
 * Verse 1 + pre-chorus (0:23.0–0:57.4), storyboard v3: every line is an object from RUDO's day, in the Static &
 * Silence room. Each object rises into the light as its line starts and sinks back as the next one arrives.
 * Words appear as they're sung: bone while sung, settling to stone.
 */
export const V1V3_START = 23.0;
export const V1V3_END = 57.4;
export const W = (li: number, wi: number) => LINES[li].words[wi];
export const lineStart = (li: number) => LINES[li].words[0].s;

// colour of a word: hidden before it's sung, bone while sung, settling to stone
export const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
export const mixC = (a: string, b: string, k: number) => { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(",")})`; };
export const sungC = (li: number, wi: number, t: number, rest = P.stone) => { const w = W(li, wi); return t < w.e ? P.ember : mixC(P.ember, rest, clamp01((t - w.e) / 0.7)); };
export const seen = (li: number, wi: number, t: number) => clamp01((t - (W(li, wi).s - 0.04)) / 0.12);
export const Sp: React.FC<{ t: number; li: number; wi: number; text?: string; rest?: string; style?: React.CSSProperties }> = ({ t, li, wi, text, rest, style }) => (
  <span style={{ color: sungC(li, wi, t, rest), opacity: seen(li, wi, t), display: "inline-block", transform: `translateY(${(1 - seen(li, wi, t)) * 8}px)`, ...style }}>{text ?? W(li, wi).w.toUpperCase().replace(/[.,]/g, "")}</span>
);
export const beatsIn = (a: number, b: number) => T.beats.filter((x) => x >= a && x < b);
export const pulse = (t: number, a: number, b: number, d = 0.14) => { let v = 0; for (const x of beatsIn(a, b)) if (t >= x) v = Math.max(v, Math.exp(-(t - x) / d)); return v; };

/** One object's time on screen: rises into the light, holds, sinks back. */
/** The beat nearest to a time (within 0.22 s), so objects land on the beat. */
export const onBeat = (s: number) => { let b = s, d = 0.22; for (const x of T.beats) { if (Math.abs(x - s) < d) { d = Math.abs(x - s); b = x; } } return b; };
export const Shot: React.FC<{ t: number; s: number; e: number; children: React.ReactNode }> = ({ t, s: s0, e, children }) => {
  const s = onBeat(s0);
  const i = cubicOut(clamp01((t - (s - 0.3)) / 0.45)), o = cubicIn(clamp01((t - (e - 0.12)) / 0.38));
  if (i <= 0 || o >= 1) return null;
  return (
    <AbsoluteFill style={{ opacity: i * (1 - o), transform: `translateY(${(1 - i) * 46 - o * 26}px) scale(${1 - o * 0.05 + (1 - i) * 0.03})`, filter: `blur(${(1 - i) * 7 + o * 6}px)` }}>
      {children}
    </AbsoluteFill>
  );
};
export const big = (size: number, ls = "0.14em"): React.CSSProperties => ({ font: `400 ${size}px/1 ${FF.display}`, letterSpacing: ls });
export const mono = (size: number, c = P.stone, ls = "0.24em"): React.CSSProperties => ({ font: `500 ${size}px ${FF.mono}`, letterSpacing: ls, color: c, textTransform: "uppercase" });

export const Verse1V3: React.FC<{ t: number }> = ({ t }) => {
  // the light: brighter in the morning, dimming as the darkness calls, gone before BREAK
  const light = t < 46 ? 0.95 : t < 50.7 ? 0.8 : t < 53 ? mix(0.8, 0.45, clamp01((t - 50.7) / 1.5)) : mix(0.45, 0.25, clamp01((t - 53) / 2));
  const drift: [number, number, number] = [Math.sin(t * 0.13) * 0.18, 1.4 + Math.sin(t * 0.09) * 0.05, 6.2 - (t - 23) * 0.012];
  return (
    <AbsoluteFill style={{ background: P.char }}>
      <Room t={t} light={light} cam={drift} look={[Math.sin(t * 0.13) * 0.1, 1.5, 0]} />

      {/* 0:23 · ANOTHER MORNING, SAME CEILING — the alarm */}
      <Shot t={t} s={23.0} e={24.98}>
        <Float x={760} y={110} w={400} h={790} rx={16 - (t - 23) * 1.5} ry={-8} rz={-3}>
          <Phone w={400} h={790}>
            <div style={{ position: "absolute", top: 90, width: "100%", textAlign: "center" }}>
              <div style={mono(14)}>Monday · alarm</div>
              <div style={{ font: `100 170px/1 ${FF.thin}`, color: P.bone, marginTop: 24, letterSpacing: "-0.02em" }}>6:00</div>
              <div style={{ ...big(40, "0.3em"), marginTop: 26 }}><Sp t={t} li={6} wi={0} rest={P.paper} /><br /><Sp t={t} li={6} wi={1} rest={P.paper} /></div>
              <div style={{ display: "flex", gap: 14, justifyContent: "center", marginTop: 26 }}>
                {"MTWTFSS".split("").map((d, i) => { const on = clamp01((t - (23.15 + i * 0.09)) / 0.12); return <span key={i} style={{ width: 30, height: 30, borderRadius: "50%", background: mixC("#2a2622", P.stone, on), color: P.char, font: `500 13px/30px ${FF.mono}` }}>{d}</span>; })}
              </div>
              <div style={{ ...mono(13, P.dim, "0.12em"), marginTop: 14, textTransform: "none" }}><Sp t={t} li={6} wi={2} text="same" rest={P.dim} /> <Sp t={t} li={6} wi={3} text="ceiling, every day" rest={P.dim} /></div>
            </div>
            <div style={{ position: "absolute", bottom: 80, left: 34, right: 34, display: "flex", justifyContent: "space-between" }}>
              <span style={{ font: `500 22px ${FF.thin}`, color: P.paper, border: `1px solid ${P.dim}`, borderRadius: 40, padding: "16px 44px" }}>Snooze</span>
              <span style={{ font: `500 22px ${FF.thin}`, color: P.char, background: P.bone, borderRadius: 40, padding: "16px 54px", transform: `scale(${1 - 0.08 * Math.max(0, 1 - Math.abs(t - 24.5) / 0.15)})`, display: "inline-block" }}>Stop</span>
            </div>
          </Phone>
        </Float>
        <Label x={250} y={300}>alarm 06:00<br />repeats: every day<br />times heard: {(1405 + Math.min(7, Math.floor((t - 23) * 4))).toLocaleString("en-US")}</Label>
      </Shot>

      {/* 0:25 · SAME PRESSURE ON MY CHEST — the monitor */}
      <Shot t={t} s={24.98} e={26.4}>
        <Float x={430} y={250} w={1060} h={480} rx={8} ry={-6}>
          <div style={{ width: "100%", height: "100%", background: "#0b0a09", border: "10px solid #1d1a17", borderRadius: 16, boxShadow: "0 0 0 1px #3a342e", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", left: 40, top: 30 }}>
              <div style={mono(15)}><Sp t={t} li={7} wi={0} text="same" /> · <Sp t={t} li={7} wi={1} text="pressure" /></div>
              <div style={{ font: `100 120px/1 ${FF.thin}`, color: P.bone, marginTop: 6, opacity: seen(7, 1, t) }}>{Math.round(mix(118, 142, clamp01((t - 25.14) / 0.8)))}/{Math.round(mix(76, 91, clamp01((t - 25.14) / 0.8)))}</div>
            </div>
            <div style={{ position: "absolute", right: 40, top: 30, textAlign: "right" }}>
              <div style={mono(15)}><Sp t={t} li={7} wi={2} text="on" /> <Sp t={t} li={7} wi={3} text="my" /> <Sp t={t} li={7} wi={4} text="chest" /></div>
              <div style={{ font: `100 120px/1 ${FF.thin}`, color: P.bone, marginTop: 6, opacity: seen(7, 4, t) }}><span style={{ display: "inline-block", transform: `scale(${1 + 0.18 * pulse(t, 25.9, 27)})`, fontSize: 80, verticalAlign: "middle", marginRight: 16 }}>♥</span>112</div>
            </div>
            <svg viewBox="0 0 1040 200" style={{ position: "absolute", left: 0, bottom: 20, width: "100%", height: 200 }}>
              {(() => {
                const pts: string[] = [];
                const head = clamp01((t - 24.98) / 1.3) * 1040;
                const spikes = beatsIn(24.9, 26.6).map((b) => 60 + ((b - 24.98) / 1.3) * 1040);
                for (let x = 0; x <= head; x += 4) {
                  let y = 120;
                  for (const sx of spikes) { const d = x - sx; if (d > -10 && d < 0) y = 120 + d * 1.5; if (d >= 0 && d < 8) y = 40; if (d >= 8 && d < 18) y = 180; if (d >= 18 && d < 26) y = 105; }
                  pts.push(`${x},${y}`);
                }
                return <><polyline points={pts.join(" ")} fill="none" stroke={P.bone} strokeWidth={2.5} /><circle cx={head} cy={pts.length ? Number(pts[pts.length - 1].split(",")[1]) : 120} r={6} fill={P.ember} /></>;
              })()}
            </svg>
          </div>
        </Float>
      </Shot>

      {/* 0:26 · SAME PEOPLE TELLING ME I'M BLESSED — the comments */}
      <Shot t={t} s={26.4} e={28.18}>
        <Float x={640} y={80} w={640} h={860} rx={10} ry={8} rz={2}>
          <Phone w={640} h={860}>
            <div style={{ position: "absolute", left: 40, right: 40, top: 50 }}>
              <div style={{ height: 300, borderRadius: 14, background: "radial-gradient(120% 90% at 50% 10%, #4a4037 0%, #1a1714 70%)" }} />
              <div style={{ ...mono(18, P.bone, "0.04em"), marginTop: 18, textTransform: "none" }}>♥ {(24800 + Math.floor(clamp01((t - 26.4) / 1.6) * 17)).toLocaleString("en-US")}</div>
              {[["@jay", 8, 0, "same energy, so proud"], ["@mia", 8, 1, "people love this for you"], ["@dre", 8, 2, "everyone keeps telling me how"], ["@kayla", 8, 4, "you're so"]].map(([u, li, wi, txt], k) => (
                <div key={k} style={{ font: `400 24px ${FF.thin}`, color: P.paper, marginTop: 16, opacity: seen(li as number, wi as number, t) }}><b style={{ color: P.bone, fontWeight: 600 }}>{u}</b> {txt}</div>
              ))}
              <div style={{ marginTop: 16, opacity: seen(8, 5, t) }}><span style={{ ...big(64, "0.1em"), color: sungC(8, 5, t, P.paper) }}>#BLESSED</span> <span style={{ fontSize: 34 }}>🙏</span></div>
              <div style={{ font: `400 22px ${FF.thin}`, color: P.dim, marginTop: 18, borderTop: "1px solid #2e2a26", paddingTop: 14 }}>Reply as you…</div>
            </div>
          </Phone>
        </Float>
      </Shot>

      {/* 0:28 · WHILE I'M STRUGGLING TO REST — the sleep tracker */}
      <Shot t={t} s={28.18} e={29.75}>
        <Float x={480} y={190} w={960} h={600} rx={8} ry={-8}>
          <div style={{ width: "100%", height: "100%", background: "#0b0a09", border: "10px solid #1d1a17", borderRadius: 18, position: "relative", overflow: "hidden", boxShadow: "0 0 0 1px #3a342e" }}>
            <div style={{ position: "absolute", left: 40, top: 34 }}>
              <div style={mono(15)}>sleep · last night</div>
              <div style={{ font: `100 110px/1 ${FF.thin}`, color: P.bone, marginTop: 8 }}>3h 12m</div>
              <div style={{ ...mono(15, P.paper), marginTop: 8 }}><Sp t={t} li={9} wi={0} text="while" /> <Sp t={t} li={9} wi={1} text="I'm" /> · restless</div>
            </div>
            <div style={{ position: "absolute", right: 46, top: 60, ...big(70, "0.12em"), opacity: seen(9, 2, t) }}>
              {"STRUGGLING".split("").map((c, i) => { const r = rng(i * 13 + 2); const j = clamp01((t - 28.52) / 0.3); return <span key={i} style={{ display: "inline-block", color: sungC(9, 2, t), transform: `translate(${(r() - 0.5) * 10 * j}px, ${(r() - 0.5) * 26 * j}px) rotate(${(r() - 0.5) * 14 * j}deg)` }}>{c}</span>; })}
            </div>
            <div style={{ position: "absolute", right: 46, top: 160, ...mono(18, P.paper) }}><Sp t={t} li={9} wi={3} text="to" /> <Sp t={t} li={9} wi={4} text="rest" style={{ ...big(54, "0.2em") }} /></div>
            <svg viewBox="0 0 900 220" style={{ position: "absolute", left: 30, bottom: 30, width: 900, height: 220 }}>
              {Array.from({ length: 60 }, (_, i) => { const r = rng(i + 50)(); const h = 20 + r * 170; const vis = clamp01((t - 28.2 - i * 0.02) / 0.2); return <rect key={i} x={i * 15} y={210 - h * vis} width={10} height={h * vis} fill={r > 0.75 ? P.bone : P.dim} />; })}
            </svg>
          </div>
        </Float>
      </Shot>

      {/* 0:29 · EVERYBODY NEEDS A PIECE OF ME — the pie chart */}
      <Shot t={t} s={29.75} e={31.34}>
        {(() => {
          const sl = [["WORK", 0.31], ["FAMILY", 0.22], ["FANS", 0.28], ["FRIENDS", 0.19]] as const;
          let a0 = -Math.PI / 2;
          const R = 300, cx = 960, cy = 500;
          return (
            <svg viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0 }}>
              {sl.map(([n, f], k) => {
                const a1 = a0 + f * Math.PI * 2, mid = (a0 + a1) / 2;
                const pull = 70 * cubicOut(clamp01((t - (30.45 + k * 0.17)) / 0.3)) + 14 * pulse(t, 30.4, 31.4);
                const ox = Math.cos(mid) * pull, oy = Math.sin(mid) * pull;
                const d = `M${cx} ${cy} L${cx + R * Math.cos(a0)} ${cy + R * Math.sin(a0)} A${R} ${R} 0 ${f > 0.5 ? 1 : 0} 1 ${cx + R * Math.cos(a1)} ${cy + R * Math.sin(a1)} Z`;
                const el = (
                  <g key={k} transform={`translate(${ox} ${oy})`} opacity={clamp01((t - 29.75 - k * 0.12) / 0.25)}>
                    <path d={d} fill={["#2b2622", "#36302a", "#2f2a25", "#3a342e"][k]} stroke={P.char} strokeWidth={4} />
                    <text x={cx + Math.cos(mid) * (R + 70)} y={cy + Math.sin(mid) * (R + 70)} textAnchor="middle" style={{ font: `500 20px ${FF.mono}`, letterSpacing: "0.2em" }} fill={P.stone}>{n} {Math.round(f * 100)}%</text>
                  </g>
                );
                a0 = a1;
                return el;
              })}
              <circle cx={cx} cy={cy} r={120} fill={P.char} />
              <text x={cx} y={cy + 52} textAnchor="middle" style={{ font: `400 150px ${FF.display}`, letterSpacing: "0.08em" }} fill={sungC(10, 5, t)} opacity={seen(10, 5, t)}>ME</text>
              <text x={cx} y={150} textAnchor="middle" style={{ font: `500 22px ${FF.mono}`, letterSpacing: "0.3em" }} fill={P.stone} opacity={seen(10, 0, t)}>EVERYBODY NEEDS A PIECE</text>
            </svg>
          );
        })()}
      </Shot>

      {/* 0:31 · EVERYBODY WANTS MY TIME — the calendar */}
      <Shot t={t} s={31.34} e={33.02}>
        <Float x={360} y={150} w={1200} h={680} rx={10} ry={6}>
          <div style={{ width: "100%", height: "100%", background: "#0f0e0c", border: "1px solid #3a342e", borderRadius: 14, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", left: 30, top: 22, ...mono(16) }}>this week · <Sp t={t} li={11} wi={0} text="everybody" /> <Sp t={t} li={11} wi={1} text="wants" /></div>
            <div style={{ position: "absolute", right: 30, top: 14, ...big(48, "0.16em") }}><Sp t={t} li={11} wi={2} text="MY" /> <Sp t={t} li={11} wi={3} text="TIME" /></div>
            {Array.from({ length: 7 }, (_, d) => Array.from({ length: 9 }, (_, h) => {
              const k = d * 9 + h, at = 31.34 + (rng(k + 300)() * 1.4);
              const on = cubicOut(clamp01((t - at) / 0.2));
              return <div key={k} style={{ position: "absolute", left: 30 + d * 163, top: 80 + h * 64, width: 152, height: 56, borderRadius: 6, background: mixC("#171513", "#3a342e", on), border: "1px solid #24201c", font: `400 13px ${FF.mono}`, color: P.paper, padding: "6px 8px", opacity: 0.4 + 0.6 * on }}>{on > 0.5 ? ["call", "meeting", "session", "review", "dinner", "promo", "shoot", "interview"][k % 8] : ""}</div>;
            }))}
            <div style={{ position: "absolute", right: 30, bottom: 16, ...mono(14, P.bone), opacity: seen(11, 3, t) }}>no availability</div>
          </div>
        </Float>
      </Shot>

      {/* 0:33 · I'M CARRYING SO MUCH WEIGHT — the scale */}
      <Shot t={t} s={33.02} e={34.55}>
        {(() => {
          const ws = [0, 1, 2, 3, 4].map((wi) => W(12, wi).s), vals = [18, 46, 97, 160];
          let v = 0; ws.forEach((s, i) => { if (t >= s && i < 4) v = vals[i]; });
          const over = t >= ws[4];
          const shake = over ? Math.exp(-(t - ws[4]) / 0.15) : 0;
          return (
            <Float x={560 + shake * 8 * Math.sin(t * 90)} y={230} w={800} h={560} rx={30} ry={0}>
              <div style={{ width: "100%", height: "100%", background: "linear-gradient(#26221e, #141210)", borderRadius: 40, boxShadow: "inset 0 0 0 2px #3a342e", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", left: 120, right: 120, top: 70, height: 200, background: "#0b0a09", borderRadius: 14, display: "grid", placeItems: "center", boxShadow: "inset 0 0 0 1px #3a342e" }}>
                  {over ? <span style={{ ...big(130, "0.14em"), color: P.bone }}>WEIGHT</span> : <span style={{ font: `100 140px/1 ${FF.thin}`, color: P.bone }}>{v}<span style={{ fontSize: 40, marginLeft: 10 }}>kg</span></span>}
                  {over ? <svg viewBox="0 0 560 200" style={{ position: "absolute", inset: 0 }}><path d="M300 0 L280 70 L320 110 L270 200 M280 70 L200 90 M320 110 L420 140" fill="none" stroke={P.paper} strokeWidth={2} opacity={0.8} /></svg> : null}
                </div>
                <div style={{ position: "absolute", left: 0, right: 0, top: 300, textAlign: "center", ...mono(22, P.paper) }}>
                  <Sp t={t} li={12} wi={0} text="I'm" /> <Sp t={t} li={12} wi={1} text="carrying" /> <Sp t={t} li={12} wi={2} text="so" /> <Sp t={t} li={12} wi={3} text="much" />
                </div>
                <div style={{ position: "absolute", left: 0, right: 0, bottom: 50, textAlign: "center", ...mono(15, over ? P.bone : P.dim) }}>{over ? "overload · max 150 kg" : "max 150 kg"}</div>
              </div>
            </Float>
          );
        })()}
      </Shot>

      {/* 0:34 · I FORGOT WHAT'S ACTUALLY MINE — the lost-property tag, then it falls */}
      <Shot t={t} s={34.55} e={37.25}>
        {(() => {
          const mine = W(13, 4), fall = Math.max(0, t - (mine.s + 0.35));
          const y = 0.5 * 2600 * fall * fall, rot = -6 + fall * 60;
          return (
            <>
              <svg viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0 }}><path d={`M960 0 L${960 + Math.sin(t) * 4} ${210 + y}`} stroke={P.stone} strokeWidth={2} opacity={fall > 0 ? 0 : 0.8} /></svg>
              <Float x={700} y={210 + y} w={520} h={300} rz={rot}>
                <div style={{ width: "100%", height: "100%", background: P.paper, clipPath: "polygon(12% 0,100% 0,100% 100%,12% 100%,0 50%)", position: "relative", padding: "30px 40px 0 100px", color: "#2a2622" }}>
                  <div style={{ position: "absolute", left: 30, top: 136, width: 26, height: 26, borderRadius: "50%", background: P.char }} />
                  <div style={{ ...mono(15, "#5a524a") }}>lost property · no. 0013</div>
                  <div style={{ font: `400 26px ${FF.mono}`, marginTop: 18 }}><Sp t={t} li={13} wi={0} text="I" rest="#3a342e" style={{ color: "#2a2622" }} /> <Sp t={t} li={13} wi={1} text="forgot" rest="#3a342e" style={{ color: "#2a2622" }} /> <Sp t={t} li={13} wi={2} text="what's" rest="#3a342e" style={{ color: "#2a2622" }} /> <Sp t={t} li={13} wi={3} text="actually" rest="#3a342e" style={{ color: "#2a2622" }} /></div>
                  <div style={{ font: `400 20px ${FF.mono}`, marginTop: 26, color: "#5a524a" }}>owner: <span style={{ font: `500 76px ${FF.hand}`, color: "#1a1714", opacity: seen(13, 4, t), marginLeft: 12 }}>mine</span></div>
                </div>
              </Float>
            </>
          );
        })()}
      </Shot>

      {/* 0:37 · BUILT A LIFE THAT PEOPLE ENVY — the profile */}
      <Shot t={t} s={37.25} e={38.82}>
        <Float x={660} y={70} w={600} h={900} rx={10} ry={-8} rz={-2}>
          <Phone w={600} h={900}>
            <div style={{ position: "absolute", left: 40, right: 40, top: 60 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
                <div style={{ width: 120, height: 120, borderRadius: "50%", background: "radial-gradient(circle at 40% 35%, #5a4f44, #1a1714)" }} />
                <div>
                  <div style={{ font: `600 30px ${FF.thin}`, color: P.bone }}>rudo</div>
                  <div style={{ ...mono(15, P.paper, "0.06em"), textTransform: "none", marginTop: 6 }}>{(1.2 + clamp01((t - 37.3) / 1.4) * 0.12).toFixed(2)}M followers</div>
                </div>
              </div>
              <div style={{ font: `400 24px ${FF.thin}`, color: P.paper, marginTop: 24 }}><Sp t={t} li={14} wi={0} text="built" rest={P.paper} style={{ textTransform: "none" }} /> <Sp t={t} li={14} wi={1} text="a" rest={P.paper} /> <Sp t={t} li={14} wi={2} text="life" rest={P.paper} /> ✦</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginTop: 28 }}>
                {Array.from({ length: 9 }, (_, i) => <div key={i} style={{ aspectRatio: "1", background: `radial-gradient(circle at ${30 + (i * 17) % 50}% 30%, #4a4037, #171513)`, opacity: clamp01((t - 37.3 - i * 0.06) / 0.2) }} />)}
              </div>
              <div style={{ marginTop: 22, ...mono(16, P.paper) }}><Sp t={t} li={14} wi={3} text="that" /> <Sp t={t} li={14} wi={4} text="people" /> <Sp t={t} li={14} wi={5} text="envy" style={{ ...big(44, "0.2em") }} /></div>
            </div>
          </Phone>
        </Float>
      </Shot>

      {/* 0:38 · BUILT A NAME THEY ALL RESPECT — the plaque */}
      <Shot t={t} s={38.82} e={40.12}>
        <Float x={410} y={250} w={1100} h={520} rx={4} ry={10}>
          <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #5c5042 0%, #3a3128 45%, #6a5c4c 100%)", borderRadius: 8, boxShadow: "inset 0 0 0 10px #2a241e, inset 0 0 0 12px #7a6a58", display: "grid", placeItems: "center", alignContent: "center", gap: 18, textAlign: "center" }}>
            <div style={{ ...mono(16, "#c9b9a2") }}><Sp t={t} li={15} wi={0} text="built" rest="#c9b9a2" /> <Sp t={t} li={15} wi={1} text="a" rest="#c9b9a2" /> <Sp t={t} li={15} wi={2} text="name" rest="#c9b9a2" /></div>
            <div style={{ font: `400 170px/1 ${FF.serif}`, letterSpacing: "0.12em", color: "#e2d3bb", textShadow: "0 2px 0 #2a241e, 0 -1px 0 #8a7a66", clipPath: `inset(0 ${100 - 100 * clamp01((t - 39.19) / 0.5)}% 0 0)` }}>RUDO</div>
            <div style={{ font: `italic 400 40px ${FF.serif}`, color: "#d4c4ab", letterSpacing: "0.04em" }}><Sp t={t} li={15} wi={3} text="they" rest="#d4c4ab" /> <Sp t={t} li={15} wi={4} text="all" rest="#d4c4ab" /> <Sp t={t} li={15} wi={5} text="respect" rest="#d4c4ab" /></div>
          </div>
        </Float>
      </Shot>

      {/* 0:40 · FUNNY HOW SUCCESS CAN LEAVE YOU — the chart */}
      <Shot t={t} s={40.12} e={42.94}>
        {(() => {
          const rise = clamp01((t - 40.68) / 0.9), leave = clamp01((t - 41.74) / 0.7);
          const pts = [[260, 820], [520, 760], [760, 700], [960, 560], [1160, 380], [1380, 200], [1720, -200]];
          const upto = 3 + rise * 2 + leave * 1.2;
          const vis = pts.slice(0, Math.floor(upto) + 1);
          const tail = pts[Math.min(pts.length - 1, Math.floor(upto) + 1)];
          const f = upto - Math.floor(upto);
          const end = [mix(vis[vis.length - 1][0], tail[0], f), mix(vis[vis.length - 1][1], tail[1], f)];
          return (
            <svg viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0 }}>
              <line x1={240} y1={860} x2={1700} y2={860} stroke={P.dim} strokeWidth={1.5} /><line x1={240} y1={160} x2={240} y2={860} stroke={P.dim} strokeWidth={1.5} />
              <text x={240} y={130} style={{ font: `500 20px ${FF.mono}`, letterSpacing: "0.26em" }} fill={P.stone} opacity={seen(16, 0, t)}>FUNNY HOW</text>
              <text x={300} y={940} style={{ font: `400 90px ${FF.display}`, letterSpacing: "0.16em" }} fill={sungC(16, 2, t)} opacity={seen(16, 2, t)}>SUCCESS</text>
              <polyline points={[...vis, end].map((p) => p.join(",")).join(" ")} fill="none" stroke={P.bone} strokeWidth={3} opacity={1 - leave * 0.6} />
              <circle cx={960} cy={560} r={9} fill={P.ember} opacity={seen(16, 4, t)} />
              <text x={990} y={600} style={{ font: `500 22px ${FF.mono}`, letterSpacing: "0.22em" }} fill={P.stone} opacity={seen(16, 3, t)}>CAN LEAVE</text>
              <text x={990} y={660} style={{ font: `400 70px ${FF.display}`, letterSpacing: "0.2em" }} fill={sungC(16, 5, t)} opacity={seen(16, 5, t)}>YOU</text>
            </svg>
          );
        })()}
      </Shot>

      {/* 0:42 · FEELING MORE DIS·CON·NECT·ED — the status bar */}
      <Shot t={t} s={42.94} e={46.11}>
        {(() => {
          const w = W(17, 2), sy = w.syl ?? [];
          const bars = 4 - beatsIn(43.0, 46).filter((b) => t >= b).length;
          const spread = cubicInOut(clamp01((t - w.s) / 1.8)) * 120;
          return (
            <>
              <div style={{ position: "absolute", left: 380, top: 200, right: 380, height: 120, borderRadius: 60, background: "#0d0c0b", boxShadow: "inset 0 0 0 1px #3a342e", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 60px" }}>
                <span style={{ font: `500 40px ${FF.thin}`, color: P.bone }}>9:41</span>
                <span style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>{[0, 1, 2, 3].map((i) => <i key={i} style={{ width: 14, height: 16 + i * 12, background: i < Math.max(0, bars) ? P.bone : "#2e2a26", borderRadius: 3 }} />)}<span style={{ ...mono(18, P.paper), marginLeft: 18 }}>{bars <= 0 ? "no service" : "searching"}</span></span>
              </div>
              <div style={{ position: "absolute", left: 0, right: 0, top: 420, textAlign: "center", ...mono(24, P.paper) }}><Sp t={t} li={17} wi={0} text="feeling" /> <Sp t={t} li={17} wi={1} text="more" /></div>
              <div style={{ position: "absolute", left: 0, right: 0, top: 500, display: "flex", justifyContent: "center", gap: spread }}>
                {sy.map((s, k) => <span key={k} style={{ ...big(150, "0.1em"), color: t < s.e ? P.bone : mixC(P.bone, P.stone, clamp01((t - s.e) / 0.6)), opacity: clamp01((t - (s.s - 0.04)) / 0.12), transform: `translateY(${(k % 2 ? 1 : -1) * spread * 0.25}px) rotate(${(k - 1.5) * spread * 0.02}deg)` }}>{s.t.toUpperCase()}</span>)}
              </div>
            </>
          );
        })()}
      </Shot>

      {/* 0:46 · GOT ACCOMPLISHMENTS ON PAPER — the résumé */}
      <Shot t={t} s={46.11} e={47.89}>
        <Float x={600} y={50} w={720} h={860} rx={18} ry={-6} rz={-3}>
          <div style={{ width: "100%", height: "100%", background: P.paper, color: "#2a2622", padding: "56px 70px", boxShadow: "inset 0 0 120px rgba(0,0,0,0.25)" }}>
            <div style={{ font: `400 64px ${FF.serif}` }}>RUDO</div>
            <div style={{ ...mono(15, "#5a524a"), marginTop: 6 }}>artist · writer · performer</div>
            <div style={{ height: 1, background: "#5a524a", margin: "34px 0" }} />
            <div style={{ ...mono(18, "#2a2622") }}><Sp t={t} li={18} wi={0} text="got" rest="#2a2622" /></div>
            <div style={{ font: `400 58px ${FF.display}`, letterSpacing: "0.12em", color: "#1a1714", clipPath: `inset(0 ${100 - 100 * clamp01((t - 46.3) / 1.0)}% 0 0)` }}>ACCOMPLISHMENTS</div>
            {["Headlined, sold out", "Charted, 3 singles", "Wrote for others", "Toured, 41 cities"].map((x, i) => <div key={i} style={{ font: `400 26px ${FF.mono}`, marginTop: 20, opacity: clamp01((t - 46.6 - i * 0.18) / 0.2) }}>— {x}</div>)}
            <div style={{ ...mono(15, "#5a524a"), marginTop: 50 }}><Sp t={t} li={18} wi={2} text="on" rest="#5a524a" /> <Sp t={t} li={18} wi={3} text="paper" rest="#5a524a" /></div>
          </div>
        </Float>
      </Shot>

      {/* 0:47–0:50 · ACHIEVEMENTS ON THE WALL · BUT NONE OF THAT GETS QUIET — frames, then the volume that won't go down */}
      <Shot t={t} s={47.89} e={50.74}>
        {(() => {
          const drops = beatsIn(49.4, 50.8);
          return (
            <>
              {Array.from({ length: 12 }, (_, k) => {
                const c = k % 4, r = Math.floor(k / 4), x = 300 + c * 340 + (r % 2) * 60, y = 140 + r * 250;
                const center = k === 5;
                const di = drops.findIndex((_, j) => j === (k * 7) % Math.max(1, drops.length));
                const td = di >= 0 ? drops[di] + (k % 3) * 0.05 : 1e9;
                const fall = Math.max(0, t - td);
                return (
                  <div key={k} style={{ position: "absolute", left: x, top: y + 0.5 * 2400 * fall * fall, width: center ? 360 : 260, height: center ? 200 : 170, transform: `rotate(${(k % 2 ? 1 : -1) * (1 + fall * 70)}deg)`, background: "#171513", border: "8px solid #6a5c4c", boxShadow: "0 20px 30px rgba(0,0,0,0.5)", display: "grid", placeItems: "center", opacity: clamp01((t - 47.9 - k * 0.04) / 0.25) }}>
                    {center ? <span style={{ ...big(38, "0.12em"), color: sungC(19, 1, t), opacity: seen(19, 1, t) }}>ACHIEVEMENTS</span> : <span style={{ width: "60%", height: 4, background: "#3a342e" }} />}
                  </div>
                );
              })}
              <div style={{ position: "absolute", left: 0, right: 0, top: 70, textAlign: "center", ...mono(20, P.paper) }}><Sp t={t} li={19} wi={0} text="got" /> · <Sp t={t} li={19} wi={2} text="on" /> <Sp t={t} li={19} wi={3} text="the" /> <Sp t={t} li={19} wi={4} text="wall" /></div>
              {/* the volume */}
              {t > 49.2 ? (() => {
                const drag = cubicInOut(clamp01((t - 49.5) / 0.7)), snap = cubicOut(clamp01((t - 50.38) / 0.2));
                const lvl = 1 - drag * 0.85 + snap * 0.85;
                return (
                  <div style={{ position: "absolute", right: 170, top: 260, width: 120, height: 520, borderRadius: 60, background: "rgba(13,12,11,0.92)", boxShadow: "inset 0 0 0 1px #3a342e", overflow: "hidden", opacity: clamp01((t - 49.2) / 0.3) }}>
                    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: `${lvl * 100}%`, background: P.bone }} />
                    <div style={{ position: "absolute", left: 0, right: 0, bottom: 30, textAlign: "center", fontSize: 40, color: lvl > 0.3 ? P.char : P.bone }}>🔊︎</div>
                  </div>
                );
              })() : null}
              <div style={{ position: "absolute", right: 120, top: 810, width: 220, textAlign: "center", ...mono(16, P.paper) }}><Sp t={t} li={20} wi={0} text="but" /> <Sp t={t} li={20} wi={1} text="none" /> <Sp t={t} li={20} wi={2} text="of" /> <Sp t={t} li={20} wi={3} text="that" /> <Sp t={t} li={20} wi={4} text="gets" /></div>
              <div style={{ position: "absolute", right: 120, top: 850, width: 220, textAlign: "center", ...big(60, "0.18em"), opacity: seen(20, 5, t) }}><span style={{ color: sungC(20, 5, t), textDecoration: t > 50.5 ? "line-through" : "none", textDecorationThickness: 2 }}>QUIET</span></div>
            </>
          );
        })()}
      </Shot>

      {/* 0:50 · WHEN THE DARKNESS STARTS TO CALL — the call */}
      <Shot t={t} s={50.74} e={53.15}>
        {[0, 1, 2, 3].map((k) => {
          const ph = ((t - 51.0) * 0.8 + k * 0.25) % 1;
          const r = 230 + ph * 520;
          return t > 51 ? <div key={k} style={{ position: "absolute", left: 960 - r, top: 500 - r, width: r * 2, height: r * 2, borderRadius: "50%", border: `1px solid ${P.stone}`, opacity: 0.35 * (1 - ph) }} /> : null;
        })}
        {(() => {
          const buzz = pulse(t, 51.2, 53.2, 0.12);
          return (
            <Float x={775 + Math.sin(t * 80) * 6 * buzz} y={110} w={380} h={780} rx={6} ry={4} rz={2 + Math.sin(t * 70) * buzz}>
              <Phone w={380} h={780}>
                <div style={{ position: "absolute", top: 140, width: "100%", textAlign: "center" }}>
                  <div style={mono(14)}>incoming call</div>
                  <div style={{ ...big(70, "0.14em"), marginTop: 34, paddingLeft: "0.14em", color: sungC(21, 2, t, P.bone), clipPath: `inset(0 ${100 - 100 * clamp01((t - 51.24) / 0.45)}% 0 0)` }}>DARKNESS</div>
                  <div style={{ ...mono(14, P.dim, "0.18em"), marginTop: 16 }}><Sp t={t} li={21} wi={3} text="starts" rest={P.dim} /> <Sp t={t} li={21} wi={4} text="to" rest={P.dim} /> <Sp t={t} li={21} wi={5} text="call" rest={P.dim} /> · 3rd time tonight</div>
                </div>
                <div style={{ position: "absolute", bottom: 90, left: 54, right: 54, display: "flex", justifyContent: "space-between", textAlign: "center", font: `500 16px ${FF.thin}`, color: P.paper }}>
                  <div><div style={{ width: 96, height: 96, borderRadius: "50%", background: "#3a342e", display: "grid", placeItems: "center", fontSize: 38, color: P.bone }}>✕</div><div style={{ marginTop: 12 }}>Decline</div></div>
                  <div><div style={{ width: 96, height: 96, borderRadius: "50%", background: P.bone, display: "grid", placeItems: "center", fontSize: 38, color: P.char }}>✓</div><div style={{ marginTop: 12 }}>Accept</div></div>
                </div>
              </Phone>
            </Float>
          );
        })()}
        <Label x={1300} y={420}><Sp t={t} li={21} wi={0} text="when" /> <Sp t={t} li={21} wi={1} text="the" /><br />caller: darkness</Label>
      </Shot>

      {/* 0:53–0:57 · NOT LOOKING FOR AN ENDING · JUST LOOKING FOR A BREAK — the last page, torn */}
      <Shot t={t} s={53.15} e={58.5}>
        {(() => {
          const brk = W(23, 5), tear = cubicOut(clamp01((t - brk.s) / 0.35));
          const pencil = (li: number, wi: number) => <Sp t={t} li={li} wi={wi} text={W(li, wi).w.toLowerCase()} rest="#4a4440" style={{ color: "#2a2622" }} />;
          const half = (side: -1 | 1) => (
            <div style={{ position: "absolute", left: 610, top: 50, width: 700, height: 860, background: P.paper, color: "#2a2622", clipPath: side < 0 ? "polygon(0 0,52% 0,48% 18%,53% 36%,47% 55%,52% 74%,49% 100%,0 100%)" : "polygon(52% 0,100% 0,100% 100%,49% 100%,52% 74%,47% 55%,53% 36%,48% 18%)", transform: `translateX(${side * tear * 260}px) rotate(${side * tear * 7}deg)`, transformOrigin: side < 0 ? "0% 100%" : "100% 100%", boxShadow: "inset 0 0 120px rgba(0,0,0,0.25)" }}>
              <div style={{ position: "absolute", left: 0, right: 0, top: 40, textAlign: "center", ...mono(15, "#6a625a") }}>— 312 —</div>
              <div style={{ position: "absolute", left: 90, right: 90, top: 170, font: `500 48px/1.2 ${FF.hand}`, transform: "rotate(-3deg)" }}>{pencil(22, 0)} {pencil(22, 1)} {pencil(22, 2)} {pencil(22, 3)} {pencil(22, 4)} {pencil(22, 5)}</div>
              <div style={{ position: "absolute", left: 0, right: 0, top: 380, textAlign: "center", font: `400 100px ${FF.serif}`, letterSpacing: "0.06em" }}>
                <span style={{ position: "relative" }}>THE END{seen(22, 6, t) > 0 ? <svg viewBox="0 0 520 120" style={{ position: "absolute", left: -20, top: 10, width: 520, height: 120 }}><path d={`M10 60 L${10 + 500 * clamp01((t - 54.57) / 0.4)} 52`} stroke="#2a2622" strokeWidth={5} /></svg> : null}</span>
              </div>
              <div style={{ position: "absolute", left: 0, right: 0, top: 520, textAlign: "center", font: `500 64px ${FF.hand}`, opacity: seen(22, 6, t) }}>{pencil(22, 6)}</div>
              <div style={{ position: "absolute", left: 90, right: 90, top: 650, font: `500 46px/1.2 ${FF.hand}`, transform: "rotate(-2deg)" }}>{pencil(23, 0)} {pencil(23, 1)} {pencil(23, 2)} {pencil(23, 3)} {pencil(23, 4)}</div>
            </div>
          );
          return (
            <>
              {tear > 0 ? <div style={{ position: "absolute", left: 960 - 500 * tear, top: 0, width: 1000 * tear, height: 1080, background: `radial-gradient(ellipse 60% 70% at 50% 50%, ${P.light} 0%, rgba(242,227,200,0.5) 35%, rgba(242,227,200,0) 75%)`, opacity: tear }} /> : null}
              {half(-1)}{half(1)}
              {tear > 0 ? <div style={{ position: "absolute", left: 0, right: 0, top: 400, textAlign: "center", ...big(170, "0.2em"), color: P.char, opacity: tear }}>BREAK</div> : null}
            </>
          );
        })()}
      </Shot>
      <Finish3 />
    </AbsoluteFill>
  );
};
