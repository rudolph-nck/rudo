import React from "react";
import { AbsoluteFill } from "remotion";
import { T } from "../data";
import { clamp01, cubicIn, cubicInOut, cubicOut, mix } from "../utils/ease";
import { rng } from "../utils/random";
import { FF, Finish3, Float, P, Room } from "./kit";
import { Phone } from "./frames";
import { Shot, Sp, W, beatsIn, big, mixC, mono, seen, sungC } from "./verse1";

/**
 * Bridge + breakdown (2:50.4–3:22.9). Quiet and honest: the airport X-ray of what you carry, badges that never stop,
 * a repair ticket that says WON'T FIX, a single word on an empty page, one night blocked out. Then the breakdown
 * strips the phone one layer per NO, to black and silence, and the light comes back as a breath.
 */
export const BR_START = 170.3;
export const BR_END = 202.9;

export const BridgeV3: React.FC<{ t: number }> = ({ t }) => {
  const silence = W(77, 0).s, breathing = W(78, 0).s;
  const light = t < 192.9 ? 0.55 : t < silence ? mix(0.55, 0.3, clamp01((t - 192.9) / 6)) : t < breathing ? mix(0.3, 0, clamp01((t - silence) / 0.4)) : mix(0, 0.5, clamp01((t - breathing) / 1.6));
  return (
    <AbsoluteFill style={{ background: P.char }}>
      <Room t={t} light={light} cam={[Math.sin(t * 0.09) * 0.12, 1.4, 6.2]} />

      {/* 2:50 · MAYBE I'M TIRED OF CARRYING — the bag rolls onto the belt */}
      <Shot t={t} s={170.38} e={173.2}>
        <svg viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0 }}>
          <rect x={0} y={640} width={1920} height={90} fill="#1a1714" />
          {Array.from({ length: 40 }, (_, i) => { const x = ((i * 60 - (t - 170) * 140) % 2400 + 2400) % 2400 - 200; return <line key={i} x1={x} y1={646} x2={x} y2={724} stroke="#2e2a26" strokeWidth={3} />; })}
          {(() => { const x = mix(-500, 760, cubicOut(clamp01((t - 170.4) / 2.2))); return <g transform={`translate(${x} 420)`}><rect x={0} y={0} width={420} height={220} rx={26} fill="#24201c" stroke={P.stone} strokeWidth={2} /><path d="M140 0 v-40 h140 v40" fill="none" stroke={P.stone} strokeWidth={8} /><text x={210} y={128} textAnchor="middle" style={{ font: `500 20px ${FF.mono}`, letterSpacing: "0.3em" }} fill={P.stone}>CARRY-ON</text></g>; })()}
          <rect x={1300} y={300} width={460} height={430} fill="#121110" stroke="#3a342e" strokeWidth={2} />
          <text x={1530} y={350} textAnchor="middle" style={{ font: `500 18px ${FF.mono}`, letterSpacing: "0.3em" }} fill={P.stone}>SECURITY · LANE 3</text>
        </svg>
        <div style={{ position: "absolute", left: 0, right: 0, top: 160, textAlign: "center", ...mono(22, P.paper) }}><Sp t={t} li={64} wi={0} text="maybe" /> <Sp t={t} li={64} wi={1} text="I'm" /> <Sp t={t} li={64} wi={2} text="tired" /> <Sp t={t} li={64} wi={3} text="of" /></div>
        <div style={{ position: "absolute", left: 0, right: 0, top: 210, textAlign: "center", ...big(110, "0.3em") }}><Sp t={t} li={64} wi={4} text="CARRYING" /></div>
      </Shot>

      {/* 2:53 · THINGS NOBODY ELSE CAN SEE — the x-ray */}
      <Shot t={t} s={173.2} e={175.78}>
        {(() => {
          const scan = clamp01((t - 173.3) / 1.6) * 1200;
          const item = (x: number) => clamp01((scan - x) / 120);
          return (
            <Float x={330} y={120} w={1260} h={740} rx={4} ry={-10}>
              <div style={{ width: "100%", height: "100%", background: "#0c0c0b", border: "12px solid #1d1a17", borderRadius: 14, boxShadow: "0 0 0 1px #3a342e", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", left: 30, top: 22, ...mono(16) }}>security · lane 3 · bag 0042</div>
                <div style={{ position: "absolute", right: 30, top: 22, ...mono(16, P.ember) }}>● scanning</div>
                <svg viewBox="0 0 1200 640" style={{ position: "absolute", left: 0, top: 60, width: "100%", height: 600 }}>
                  <rect x="170" y="70" width="860" height="470" rx="40" fill="rgba(189,179,164,0.06)" stroke={P.paper} strokeOpacity="0.5" strokeWidth="3" />
                  <g opacity={item(230)}><circle cx="330" cy="170" r="54" fill="none" stroke={P.paper} strokeWidth="2" /><path d="M330 170 V132 M330 170 L356 182" stroke={P.paper} strokeWidth="2.5" /><text x="330" y="262" textAnchor="middle" fontFamily="Bebas Neue" fontSize="32" letterSpacing="8" fill={P.paper}>TIME</text></g>
                  <g opacity={item(230)}><rect x="230" y="300" width="280" height="190" rx="8" fill="rgba(236,226,208,0.32)" stroke={P.bone} strokeWidth="2" /><text x="370" y="410" textAnchor="middle" fontFamily="Bebas Neue" fontSize="62" letterSpacing="10" fill={P.char}>WEIGHT</text></g>
                  <g opacity={item(560)}><circle cx="640" cy="200" r="88" fill="rgba(189,179,164,0.12)" stroke={P.paper} strokeWidth="2" /><path d="M640 200 L700 150" stroke={P.bone} strokeWidth="4" /><text x="640" y="320" textAnchor="middle" fontFamily="Bebas Neue" fontSize="34" letterSpacing="8" fill={P.paper}>PRESSURE</text></g>
                  <g opacity={item(560)}><path d="M560 380 c40 -60 90 40 40 60 s-80 -50 -20 -70 s70 70 10 80 s-60 -20 -30 -60" fill="none" stroke={P.paper} strokeOpacity="0.7" strokeWidth="2.5" /><text x="610" y="500" textAnchor="middle" fontFamily="Bebas Neue" fontSize="32" letterSpacing="8" fill={P.paper}>NOISE</text></g>
                  <g opacity={item(820)}><rect x="800" y="280" width="120" height="220" rx="18" fill="rgba(189,179,164,0.1)" stroke={P.paper} strokeWidth="2" /><text x="860" y="400" textAnchor="middle" fontFamily="Caveat" fontSize="54" fill={P.bone}>Dad</text></g>
                  <line x1={scan} x2={scan} y1={0} y2={640} stroke={P.light} strokeOpacity={0.5} strokeWidth={3} />
                </svg>
                <div style={{ position: "absolute", left: 30, bottom: 20, ...mono(15) }}><Sp t={t} li={65} wi={0} text="things" /> <Sp t={t} li={65} wi={1} text="nobody" /> <Sp t={t} li={65} wi={2} text="else" /> <Sp t={t} li={65} wi={3} text="can" /> <Sp t={t} li={65} wi={4} text="see" /> · contents not visible to others</div>
                <div style={{ position: "absolute", right: 30, bottom: 20, ...mono(15, P.dim) }}>carried since: always</div>
              </div>
            </Float>
          );
        })()}
      </Shot>

      {/* 2:55 · MAYBE I'M TIRED OF BEING · EVERYTHING EVERYBODY NEEDS — badges that never stop */}
      <Shot t={t} s={175.78} e={181.41}>
        {(() => {
          const hits = beatsIn(178.3, 181.4);
          const n = hits.filter((b) => t >= b).length;
          return (
            <>
              <Float x={610} y={60} w={700} h={900} rx={8} ry={6}>
                <Phone w={700} h={900}>
                  <div style={{ position: "absolute", left: 50, right: 50, top: 80, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "46px 30px" }}>
                    {Array.from({ length: 16 }, (_, i) => {
                      const r = rng(i + 77);
                      const c = Math.min(99, Math.round((i % 5 + 1) * Math.pow(1.6, n) * (0.5 + r())));
                      return (
                        <div key={i} style={{ position: "relative", aspectRatio: "1", borderRadius: 26, background: `linear-gradient(140deg, ${["#3a342e", "#2c2824", "#433a30", "#24201c"][i % 4]}, #141210)`, boxShadow: "inset 0 0 0 1px #3a342e" }}>
                          {n > 0 && r() < 0.3 + n * 0.12 ? <span style={{ position: "absolute", right: -12, top: -12, minWidth: 40, height: 40, borderRadius: 20, background: P.bone, color: P.char, font: `600 20px/40px ${FF.thin}`, textAlign: "center", padding: "0 8px" }}>{c >= 99 ? "99+" : c}</span> : null}
                        </div>
                      );
                    })}
                  </div>
                </Phone>
              </Float>
              <div style={{ position: "absolute", left: 120, top: 330, width: 420, ...mono(22, P.paper) }}><Sp t={t} li={66} wi={0} text="maybe" /> <Sp t={t} li={66} wi={1} text="I'm" /> <Sp t={t} li={66} wi={2} text="tired" /> <Sp t={t} li={66} wi={3} text="of" /> <Sp t={t} li={66} wi={4} text="being" /></div>
              <div style={{ position: "absolute", right: 110, top: 300, width: 460, textAlign: "right", ...big(84, "0.16em"), lineHeight: 1.1 }}><Sp t={t} li={67} wi={0} text="EVERYTHING" /><br /><Sp t={t} li={67} wi={1} text="EVERYBODY" /><br /><Sp t={t} li={67} wi={2} text="NEEDS" /></div>
            </>
          );
        })()}
      </Shot>

      {/* 3:01 · MAYBE I DON'T NEED FIXING — the repair ticket */}
      <Shot t={t} s={181.41} e={184.02}>
        {(() => {
          const st = cubicOut(clamp01((t - W(68, 4).s) / 0.18));
          return (
            <>
              <Float x={560} y={150} w={800} h={680} rx={14} rz={-2}>
                <div style={{ width: "100%", height: "100%", background: P.paper, color: "#2a2622", padding: "54px 64px", boxShadow: "inset 0 0 120px rgba(0,0,0,0.25)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", ...mono(16, "#5a524a") }}><span>repair ticket</span><span>#0001</span></div>
                  <div style={{ font: `400 26px ${FF.mono}`, marginTop: 30 }}>item: <b>me</b></div>
                  <div style={{ font: `400 26px ${FF.mono}`, marginTop: 14 }}>reported by: everyone</div>
                  <div style={{ font: `400 26px ${FF.mono}`, marginTop: 14 }}>issue: <Sp t={t} li={68} wi={0} text="maybe" rest="#2a2622" style={{ color: "#2a2622" }} /> <Sp t={t} li={68} wi={1} text="I" rest="#2a2622" style={{ color: "#2a2622" }} /> <Sp t={t} li={68} wi={2} text="don't" rest="#2a2622" style={{ color: "#2a2622" }} /> <Sp t={t} li={68} wi={3} text="need" rest="#2a2622" style={{ color: "#2a2622" }} /></div>
                  <div style={{ font: `400 64px ${FF.display}`, letterSpacing: "0.16em", marginTop: 26, opacity: seen(68, 4, t) }}>FIXING</div>
                  <div style={{ height: 1, background: "#5a524a", margin: "26px 0" }} />
                  <div style={{ font: `400 26px ${FF.mono}`, opacity: st }}>status: won't fix — working as intended</div>
                </div>
              </Float>
              {st > 0 ? <div style={{ position: "absolute", left: 1040, top: 560, padding: "6px 30px", border: `6px solid ${P.ember}`, ...big(96, "0.12em"), color: P.ember, transform: `rotate(-10deg) scale(${mix(1.6, 1, st)})`, opacity: st * 0.85 }}>WON'T FIX</div> : null}
            </>
          );
        })()}
      </Shot>

      {/* 3:04 · MAYBE I JUST NEED PEACE — one word on an empty page */}
      <Shot t={t} s={184.02} e={186.88}>
        <Float x={560} y={90} w={800} h={820} rx={10}>
          <div style={{ width: "100%", height: "100%", background: P.paper, color: "#2a2622", position: "relative", boxShadow: "inset 0 0 140px rgba(0,0,0,0.22)" }}>
            <div style={{ position: "absolute", left: 0, right: 0, top: 120, textAlign: "center", ...mono(16, "#6a625a") }}><Sp t={t} li={69} wi={0} text="maybe" rest="#6a625a" style={{ color: "#6a625a" }} /> <Sp t={t} li={69} wi={1} text="I" rest="#6a625a" style={{ color: "#6a625a" }} /> <Sp t={t} li={69} wi={2} text="just" rest="#6a625a" style={{ color: "#6a625a" }} /> <Sp t={t} li={69} wi={3} text="need" rest="#6a625a" style={{ color: "#6a625a" }} /></div>
            <div style={{ position: "absolute", left: 0, right: 0, top: 330, textAlign: "center", font: `italic 400 150px ${FF.serif}`, opacity: seen(69, 4, t) }}>peace</div>
          </div>
        </Float>
      </Shot>

      {/* 3:06 · MAYBE I JUST NEED ONE NIGHT · WHERE THE WORLD DOESN'T ASK FOR ME — the blocked night */}
      <Shot t={t} s={186.88} e={192.95}>
        {(() => {
          const block = cubicOut(clamp01((t - W(70, 4).s) / 0.4));
          const asks = beatsIn(189.3, 192.9);
          return (
            <>
              <Float x={420} y={140} w={1080} h={700} rx={10} ry={-4}>
                <div style={{ width: "100%", height: "100%", background: "#0f0e0c", border: "1px solid #3a342e", borderRadius: 14, position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", left: 30, top: 22, ...mono(16) }}>tonight · <Sp t={t} li={70} wi={0} text="maybe" /> <Sp t={t} li={70} wi={1} text="I" /> <Sp t={t} li={70} wi={2} text="just" /> <Sp t={t} li={70} wi={3} text="need" /></div>
                  {Array.from({ length: 7 }, (_, d) => <div key={d} style={{ position: "absolute", left: 30 + d * 148, top: 80, width: 138, height: 590, borderRadius: 8, background: d === 4 ? mixC("#171513", "#3a342e", block) : "#171513", border: "1px solid #24201c" }}>{d === 4 && block > 0 ? <div style={{ position: "absolute", left: 0, right: 0, top: 220, textAlign: "center", opacity: block }}><div style={{ ...big(54, "0.12em"), color: P.bone }}><Sp t={t} li={70} wi={4} text="ONE" /><br /><Sp t={t} li={70} wi={5} text="NIGHT" /></div><div style={{ ...mono(13, P.paper), marginTop: 10 }}>unavailable</div></div> : null}</div>)}
                </div>
              </Float>
              {asks.map((b, k) => { const d = t - b; if (d < 0 || d > 1.1) return null; const x = 1700 - d * 900 + (d > 0.5 ? (d - 0.5) * 1400 : 0), y = 200 + k * 90 - (d > 0.5 ? (d - 0.5) * 400 : 0); return <div key={k} style={{ position: "absolute", left: x, top: y, width: 230, padding: "14px 18px", background: "#211e1b", borderRadius: 12, ...mono(13, P.paper, "0.06em"), textTransform: "none", opacity: 1 - clamp01((d - 0.7) / 0.4), boxShadow: "0 0 0 1px #3a342e" }}>invite: can you…?</div>; })}
              <div style={{ position: "absolute", left: 0, right: 0, top: 860, textAlign: "center", ...mono(22, P.paper) }}><Sp t={t} li={71} wi={0} text="where" /> <Sp t={t} li={71} wi={1} text="the" /> <Sp t={t} li={71} wi={2} text="world" style={{ ...big(56, "0.2em") }} /> <Sp t={t} li={71} wi={3} text="doesn't" /> <Sp t={t} li={71} wi={4} text="ask" /> <Sp t={t} li={71} wi={5} text="for" /> <Sp t={t} li={71} wi={6} text="me" style={{ ...big(56, "0.2em") }} /></div>
            </>
          );
        })()}
      </Shot>

      {/* 3:12–3:19 · NO PHONE RINGING · NO NOTIFICATIONS · NO PRESSURE · NO PROVING MYSELF · NO PRETENDING — one phone, stripped */}
      <Shot t={t} s={192.9} e={199.8}>
        {(() => {
          const L = [72, 73, 74, 75, 76];
          const cur = L.reduce((k, li, i) => (t >= W(li, 0).s - 0.05 ? i : k), 0);
          const li = L[cur];
          const loc = t - W(li, 0).s;
          const wipe = (i: number) => clamp01((t - (W(L[i], 0).s - 0.12)) / 0.25);
          return (
            <>
              <Float x={660} y={70} w={600} h={880} rx={6}>
                <Phone w={600} h={880}>
                  <div style={{ position: "absolute", inset: 0, padding: "70px 40px" }}>
                    {cur === 0 ? ["Manager", "Label", "Unknown"].map((n, i) => { const d = clamp01((loc - 0.2 - i * 0.35) / 0.25); return <div key={i} style={{ background: "#211e1b", borderRadius: 22, padding: "24px 28px", marginTop: 18, display: "flex", justifyContent: "space-between", font: `500 30px ${FF.thin}`, color: P.bone, transform: `translateX(${d * 700}px)`, opacity: 1 - d }}><span>{n}</span><span style={{ ...mono(14) }}>calling…</span></div>; }) : null}
                    {cur === 1 ? Array.from({ length: 7 }, (_, i) => { const d = clamp01((loc - 0.15 - i * 0.15) / 0.2); return <div key={i} style={{ background: "#211e1b", borderRadius: 18, padding: "18px 22px", marginTop: 12, font: `400 22px ${FF.thin}`, color: P.paper, transform: `translateX(${-d * 700}px)`, opacity: 1 - d }}>{["3 new emails", "Reminder: deadline", "You were mentioned", "Missed call", "12 likes", "Meeting moved", "Are you there?"][i]}</div>; }) : null}
                    {cur === 2 ? (() => { const a = mix(70, -90, cubicInOut(clamp01((loc - 0.3) / 1))) * (Math.PI / 180); return <svg viewBox="0 0 520 520" style={{ width: "100%", marginTop: 80 }}><path d="M60 360 A200 200 0 0 1 460 360" fill="none" stroke={P.stone} strokeWidth={6} /><line x1={260} y1={360} x2={260 + Math.sin(a) * 190} y2={360 - Math.cos(a) * 190} stroke={P.bone} strokeWidth={8} strokeLinecap="round" /><circle cx={260} cy={360} r={16} fill={P.ember} /><text x={260} y={450} textAnchor="middle" style={{ font: `500 22px ${FF.mono}`, letterSpacing: "0.26em" }} fill={P.stone}>PRESSURE</text></svg>; })() : null}
                    {cur === 3 ? ["#1  ——", "#2  ——", "#3  you", "#4  ——"].map((r, i) => <div key={i} style={{ font: `400 34px ${FF.mono}`, color: P.paper, marginTop: 26, opacity: 1 - clamp01((loc - 0.3 - i * 0.12) / 0.2) }}>{r}</div>) : null}
                    {cur === 4 ? <div style={{ marginTop: 40, opacity: 1 - clamp01((loc - 0.6) / 0.5) }}><div style={{ width: 160, height: 160, borderRadius: "50%", background: "radial-gradient(circle at 40% 35%, #5a4f44, #1a1714)", margin: "0 auto", clipPath: `inset(0 0 0 ${clamp01((loc - 0.3) / 0.5) * 100}%)` }} /><div style={{ textAlign: "center", font: `600 34px ${FF.thin}`, color: P.bone, marginTop: 20 }}>rudo ✦ living the life</div></div> : null}
                  </div>
                </Phone>
              </Float>
              <div style={{ position: "absolute", left: 1310, top: 420, width: 580, ...big(84, "0.2em"), lineHeight: 1.05 }}>
                {L.map((l, i) => i === cur ? <span key={i}><span style={{ color: sungC(l, 0, t), opacity: wipe(i) }}>NO</span><br />{LINE_REST(l, t)}</span> : null)}
              </div>
            </>
          );
        })()}
      </Shot>

      {/* 3:19 · JUST SILENCE — black, one small word */}
      {t > silence - 0.2 && t < breathing + 0.3 ? (
        <AbsoluteFill style={{ background: "#000", opacity: clamp01((t - (silence - 0.2)) / 0.3) * (1 - clamp01((t - breathing) / 0.3)) }}>
          <div style={{ position: "absolute", left: 0, right: 0, top: 500, textAlign: "center", ...mono(20, P.stone) }}><Sp t={t} li={77} wi={0} text="just" /> <Sp t={t} li={77} wi={1} text="silence" /></div>
          <div style={{ position: "absolute", left: 860, top: 560, width: 200, height: 4, background: "#2a2622" }} />
        </AbsoluteFill>
      ) : null}
      {/* 3:21 · JUST BREATHING — the light comes back as a breath */}
      {t > breathing - 0.1 ? (() => {
        const ph = 0.5 - 0.5 * Math.cos((t - breathing) * (Math.PI / 0.9));
        const r = mix(20, 120, ph) * clamp01((t - breathing) / 0.4);
        return (
          <>
            <div style={{ position: "absolute", left: 960 - r * 3, top: 480 - r * 3, width: r * 6, height: r * 6, borderRadius: "50%", background: `radial-gradient(circle, rgba(242,227,200,${0.35 + 0.25 * ph}), rgba(242,227,200,0) 60%)` }} />
            <div style={{ position: "absolute", left: 950, top: 470, width: 20, height: 20, borderRadius: "50%", background: P.ember, boxShadow: `0 0 ${30 + ph * 40}px ${P.ember}` }} />
            <div style={{ position: "absolute", left: 0, right: 0, top: 620, textAlign: "center", ...mono(20, P.paper) }}><Sp t={t} li={78} wi={0} text="just" /> <Sp t={t} li={78} wi={1} text="breathing" /></div>
          </>
        );
      })() : null}
      <Finish3 />
    </AbsoluteFill>
  );
};
const LINE_REST = (li: number, t: number) => {
  const words = [1, 2, 3].filter((wi) => W(li, wi));
  return <>{words.map((wi) => <span key={wi} style={{ color: sungC(li, wi, t), opacity: seen(li, wi, t) }}>{W(li, wi).w.toUpperCase()} </span>)}</>;
};
export const _u = [T, cubicIn];
