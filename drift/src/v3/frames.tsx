import React from "react";
import { AbsoluteFill } from "remotion";
import { FF, Finish3, Float, Lyric, P, Room } from "./kit";

/** A phone: dark glass in a thin frame, catching the overhead light. */
export const Phone: React.FC<{ w: number; h: number; children: React.ReactNode }> = ({ w, h, children }) => (
  <div style={{ width: w, height: h, borderRadius: 54, background: "#0a0908", padding: 14, boxShadow: "inset 0 0 0 2px #3a342e, inset 0 0 0 5px #0d0c0b, 0 0 0 1px #4a433b" }}>
    <div style={{ width: "100%", height: "100%", borderRadius: 42, overflow: "hidden", position: "relative", background: "radial-gradient(120% 80% at 50% 0%, #1d1a17 0%, #0b0a09 60%)" }}>
      {children}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(115deg, rgba(255,240,220,0.07) 0%, rgba(255,240,220,0) 38%)" }} />
    </div>
  </div>
);
export const Label: React.FC<{ x: number; y: number; children: React.ReactNode; align?: "left" | "right" }> = ({ x, y, children, align = "left" }) => (
  <div style={{ position: "absolute", left: x, top: y, font: `500 15px ${FF.mono}`, letterSpacing: "0.18em", color: P.stone, textTransform: "uppercase", textAlign: align, lineHeight: 1.7 }}>{children}</div>
);
export const Hair: React.FC<{ x: number; y: number; w: number }> = ({ x, y, w }) => <div style={{ position: "absolute", left: x, top: y, width: w, height: 1, background: P.stone, opacity: 0.5 }} />;

// ---------------- 0:23 · Another morning, same ceiling ----------------
export const FAlarm: React.FC<{ t: number }> = ({ t }) => (
  <AbsoluteFill style={{ background: P.char }}>
    <Room t={t} light={0.9} />
    <Float x={760} y={110} w={400} h={790} rx={16} ry={-8} rz={-3}>
      <Phone w={400} h={790}>
        <div style={{ position: "absolute", top: 90, width: "100%", textAlign: "center" }}>
          <div style={{ font: `500 14px ${FF.mono}`, letterSpacing: "0.3em", color: P.stone }}>MONDAY · ALARM</div>
          <div style={{ font: `100 170px/1 ${FF.thin}`, color: P.bone, marginTop: 24, letterSpacing: "-0.02em" }}>6:00</div>
          <div style={{ font: `400 40px ${FF.display}`, letterSpacing: "0.3em", color: P.bone, marginTop: 26 }}>ANOTHER MORNING</div>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", marginTop: 30 }}>
            {"MTWTFSS".split("").map((d, i) => <span key={i} style={{ width: 30, height: 30, borderRadius: "50%", background: P.stone, color: P.char, font: `500 13px/30px ${FF.mono}` }}>{d}</span>)}
          </div>
          <div style={{ font: `400 15px ${FF.mono}`, color: P.dim, marginTop: 14, letterSpacing: "0.12em" }}>repeats every day</div>
        </div>
        <div style={{ position: "absolute", bottom: 80, left: 34, right: 34, display: "flex", justifyContent: "space-between" }}>
          <span style={{ font: `500 22px ${FF.thin}`, color: P.paper, border: `1px solid ${P.dim}`, borderRadius: 40, padding: "16px 44px" }}>Snooze</span>
          <span style={{ font: `500 22px ${FF.thin}`, color: P.char, background: P.bone, borderRadius: 40, padding: "16px 54px" }}>Stop</span>
        </div>
      </Phone>
    </Float>
    <Label x={250} y={300}>alarm 06:00<br />repeats: every day<br />times heard: 1,412</Label>
    <Hair x={250} y={392} w={300} />
    <Label x={1310} y={720}>same ceiling<br />same fan<br />same pressure ↓</Label>
    <Lyric words={["ANOTHER", "MORNING,", "SAME", "CEILING"]} on={1} />
    <Finish3 />
  </AbsoluteFill>
);

// ---------------- 0:50 · When the darkness starts to call ----------------
export const FCall: React.FC<{ t: number }> = ({ t }) => (
  <AbsoluteFill style={{ background: P.char }}>
    <Room t={t} light={0.55} />
    {[0, 1, 2, 3].map((k) => (
      <div key={k} style={{ position: "absolute", left: 960 - (260 + k * 150), top: 540 - (260 + k * 150), width: (260 + k * 150) * 2, height: (260 + k * 150) * 2, borderRadius: "50%", border: `1px solid ${P.stone}`, opacity: 0.28 - k * 0.06 }} />
    ))}
    <Float x={775} y={110} w={380} h={780} rx={6} ry={4} rz={2}>
      <div style={{ position: "absolute", inset: 0, transform: "translate(7px, -3px)", opacity: 0.18 }}><Phone w={380} h={780}>{null}</Phone></div>
      <Phone w={380} h={780}>
        <div style={{ position: "absolute", top: 140, width: "100%", textAlign: "center" }}>
          <div style={{ font: `500 14px ${FF.mono}`, letterSpacing: "0.3em", color: P.stone }}>INCOMING CALL</div>
          <div style={{ font: `400 70px/1 ${FF.display}`, letterSpacing: "0.14em", color: P.bone, marginTop: 34, paddingLeft: "0.14em" }}>DARKNESS</div>
          <div style={{ font: `400 14px ${FF.mono}`, letterSpacing: "0.18em", color: P.dim, marginTop: 16 }}>MOBILE · 3RD TIME TONIGHT</div>
        </div>
        <div style={{ position: "absolute", bottom: 90, left: 54, right: 54, display: "flex", justifyContent: "space-between", textAlign: "center", font: `500 16px ${FF.thin}`, color: P.paper }}>
          <div><div style={{ width: 96, height: 96, borderRadius: "50%", background: "#3a342e", display: "grid", placeItems: "center", fontSize: 38, color: P.bone }}>✕</div><div style={{ marginTop: 12 }}>Decline</div></div>
          <div><div style={{ width: 96, height: 96, borderRadius: "50%", background: P.bone, display: "grid", placeItems: "center", fontSize: 38, color: P.char }}>✓</div><div style={{ marginTop: 12 }}>Accept</div></div>
        </div>
      </Phone>
    </Float>
    <Label x={1300} y={420}>caller: darkness<br />starts to call<br />at night, mostly</Label>
    <Lyric words={["WHEN", "THE", "DARKNESS", "STARTS", "TO", "CALL"]} on={5} />
    <Finish3 />
  </AbsoluteFill>
);

// ---------------- 0:57 · the battery gauge ----------------
export const FBattery: React.FC<{ t: number }> = ({ t }) => (
  <AbsoluteFill style={{ background: P.char }}>
    <Room t={t} light={0.75} cam={[0, 1.6, 5.4]} look={[0, 1.7, 0]} />
    <div style={{ position: "absolute", left: 260, top: 210, font: `500 22px ${FF.mono}`, letterSpacing: "0.34em", color: P.stone }}>I’M RUNNING ON</div>
    <div style={{ position: "absolute", left: 230, top: 210, font: `100 520px/1 ${FF.thin}`, letterSpacing: "-0.03em", color: "transparent", WebkitTextStroke: `2px ${P.bone}` }}>
      12<span style={{ color: P.bone, WebkitTextStroke: "0px" }}>%</span>
    </div>
    <div style={{ position: "absolute", left: 260, top: 790, width: 1400, height: 14, border: `1px solid ${P.stone}` }}><div style={{ width: "12%", height: "100%", background: P.bone }} /></div>
    <Label x={260} y={830}>low power mode · on</Label>
    <Label x={1660} y={830} align="right">last full charge: a while ago</Label>
    <div style={{ position: "absolute", left: 1500, top: 260, font: `400 120px ${FF.thin}`, color: P.light, opacity: 0.85 }}>⚡︎</div>
    <Label x={1520} y={420}>charging</Label>
    <Lyric words={["I", "DON’T", "WANNA", "DIE"]} on={3} />
    <Finish3 />
  </AbsoluteFill>
);

// ---------------- 1:54 · old voicemails I still play sometimes ----------------
export const FVoicemail: React.FC<{ t: number }> = ({ t }) => {
  const wave = Array.from({ length: 120 }, (_, i) => 26 * Math.abs(Math.sin(i * 0.37) * Math.sin(i * 0.11 + 1)) + 3);
  return (
    <AbsoluteFill style={{ background: P.char }}>
      <Room t={t} light={0.6} />
      <Float x={620} y={90} w={680} h={800} rx={22} ry={0} rz={-2}>
        <Phone w={680} h={800}>
          <div style={{ position: "absolute", top: 54, left: 50, right: 50 }}>
            <div style={{ font: `500 16px ${FF.mono}`, letterSpacing: "0.3em", color: P.stone }}>VOICEMAIL</div>
            {[["Unknown", "0:05", "Yesterday"], ["Mom", "0:12", "Sunday"]].map(([n, d, w], i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "22px 0", borderBottom: `1px solid #2e2a26`, font: `400 26px ${FF.thin}`, color: P.dim }}><span>{n}</span><span style={{ font: `400 18px ${FF.mono}` }}>{d} · {w}</span></div>
            ))}
            <div style={{ marginTop: 40, padding: "30px 34px", background: "rgba(236,226,208,0.05)", borderRadius: 20, border: `1px solid #3a342e` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ font: `500 96px/1 ${FF.hand}`, color: P.bone }}>Dad</span>
                <span style={{ font: `400 18px ${FF.mono}`, color: P.stone, letterSpacing: "0.12em" }}>0:43 · MAR 2019</span>
              </div>
              <svg width="100%" height="90" viewBox="0 0 600 90" style={{ marginTop: 24 }}>
                {wave.map((h, i) => <rect key={i} x={i * 5} y={45 - h} width={2.4} height={h * 2} fill={i < 48 ? P.bone : P.dim} />)}
                <circle cx={240} cy={45} r={7} fill={P.light} />
              </svg>
              <div style={{ display: "flex", justifyContent: "space-between", font: `400 18px ${FF.mono}`, color: P.stone, marginTop: 10 }}><span>▶ playing</span><span>0:17 / 0:43</span></div>
            </div>
            <div style={{ font: `400 16px ${FF.mono}`, color: P.dim, marginTop: 30, letterSpacing: "0.12em" }}>played 214 times · saved</div>
          </div>
        </Phone>
      </Float>
      <Lyric words={["AND", "OLD", "VOICEMAILS", "I", "STILL", "PLAY", "SOMETIMES"]} on={2} />
      <Finish3 />
    </AbsoluteFill>
  );
};

// ---------------- 2:53 · things nobody else can see ----------------
export const FXray: React.FC<{ t: number }> = ({ t }) => (
  <AbsoluteFill style={{ background: P.char }}>
    <Room t={t} light={0.45} />
    <Float x={330} y={120} w={1260} h={760} rx={4} ry={-10} rz={0}>
      <div style={{ width: "100%", height: "100%", background: "#0c0c0b", border: "12px solid #1d1a17", borderRadius: 14, boxShadow: "0 0 0 1px #3a342e", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 30, top: 22, font: `500 16px ${FF.mono}`, letterSpacing: "0.26em", color: P.stone }}>SECURITY · LANE 3 · BAG 0042</div>
        <div style={{ position: "absolute", right: 30, top: 22, font: `500 16px ${FF.mono}`, letterSpacing: "0.2em", color: P.bone }}>● SCANNING</div>
        <svg viewBox="0 0 1200 640" style={{ position: "absolute", inset: "60px 0 40px 0", width: "100%", height: "calc(100% - 100px)" }}>
          <defs><filter id="xg"><feGaussianBlur stdDeviation="1.2" /></filter></defs>
          <rect x="170" y="70" width="860" height="470" rx="40" fill="rgba(189,179,164,0.06)" stroke={P.paper} strokeOpacity="0.5" strokeWidth="3" />
          <path d="M470 70 v-40 h260 v40" fill="none" stroke={P.paper} strokeOpacity="0.45" strokeWidth="6" />
          {/* WEIGHT: a dense stone block */}
          <rect x="230" y="300" width="280" height="190" rx="8" fill="rgba(236,226,208,0.32)" stroke={P.bone} strokeWidth="2" filter="url(#xg)" />
          <text x="370" y="410" textAnchor="middle" fontFamily="Bebas Neue" fontSize="62" letterSpacing="10" fill={P.char}>WEIGHT</text>
          {/* PRESSURE: a gauge */}
          <circle cx="640" cy="200" r="88" fill="rgba(189,179,164,0.12)" stroke={P.paper} strokeWidth="2" />
          <path d="M640 200 L700 150" stroke={P.bone} strokeWidth="4" />
          <text x="640" y="320" textAnchor="middle" fontFamily="Bebas Neue" fontSize="34" letterSpacing="8" fill={P.paper}>PRESSURE</text>
          {/* DAD: a phone with one voicemail */}
          <rect x="800" y="280" width="120" height="220" rx="18" fill="rgba(189,179,164,0.1)" stroke={P.paper} strokeWidth="2" />
          <text x="860" y="400" textAnchor="middle" fontFamily="Caveat" fontSize="54" fill={P.bone}>Dad</text>
          {/* NOISE: a tangle of wire */}
          <path d="M560 380 c40 -60 90 40 40 60 s-80 -50 -20 -70 s70 70 10 80 s-60 -20 -30 -60" fill="none" stroke={P.paper} strokeOpacity="0.7" strokeWidth="2.5" />
          <text x="610" y="500" textAnchor="middle" fontFamily="Bebas Neue" fontSize="32" letterSpacing="8" fill={P.paper}>NOISE</text>
          {/* TIME: a watch */}
          <circle cx="330" cy="170" r="54" fill="none" stroke={P.paper} strokeWidth="2" />
          <path d="M330 170 V132 M330 170 L356 182" stroke={P.paper} strokeWidth="2.5" />
          <text x="330" y="262" textAnchor="middle" fontFamily="Bebas Neue" fontSize="32" letterSpacing="8" fill={P.paper}>TIME</text>
          <rect x="0" y="0" width="1200" height="640" fill="url(#scan)" />
          <line x1="0" x2="1200" y1="430" y2="430" stroke={P.light} strokeOpacity="0.35" strokeWidth="2" />
        </svg>
        <div style={{ position: "absolute", left: 30, bottom: 20, font: `400 15px ${FF.mono}`, letterSpacing: "0.18em", color: P.stone }}>CONTENTS: NOT VISIBLE TO OTHERS</div>
        <div style={{ position: "absolute", right: 30, bottom: 20, font: `400 15px ${FF.mono}`, letterSpacing: "0.18em", color: P.dim }}>CARRIED SINCE: ALWAYS</div>
      </div>
    </Float>
    <Lyric words={["THINGS", "NOBODY", "ELSE", "CAN", "SEE"]} on={4} />
    <Finish3 />
  </AbsoluteFill>
);

export const FRAMES: Record<string, React.FC<{ t: number }>> = { alarm: FAlarm, call: FCall, battery: FBattery, voicemail: FVoicemail, xray: FXray };
