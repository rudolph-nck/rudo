import React, { useMemo } from "react";
import { AbsoluteFill } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { Line, kickEnv, linesOf } from "../data";
import { SAFE, W, H } from "../theme";
import { F } from "../utils/fonts";
import { clamp01, cubicOut, expoOut, mix } from "../utils/ease";
import { hash01 } from "../utils/random";
import { IntroScene } from "../intro/Scene3D";
import { Caption, DIM, INK, STONE, lineOut } from "./LyricType";
import { RailView, buildRail } from "../v4/Rail";
import * as THREE from "three";
import { Font } from "three/examples/jsm/loaders/FontLoader.js";

const L = linesOf("verse1");
const RED = "#e5483b";
const RED3 = new THREE.Color(RED);
const PANEL = "#0d0d0e";
const EDGE = "#34332f";
const WIN = { left: 70, top: 720, width: 940, height: 740 };

/** Characters of `text` typed by time t (start..start+dur). */
const typed = (text: string, t: number, start: number, dur: number) => text.slice(0, Math.max(0, Math.floor(clamp01((t - start) / dur) * text.length)));
const caret = (t: number) => (Math.floor(t * 4) % 2 ? "▌" : " ");
const mono = (size: number, color = INK): React.CSSProperties => ({ fontFamily: F.mono, fontSize: size, color, lineHeight: 1.35, whiteSpace: "pre" });

/** App window chrome; pops in with a quick scale, cuts out at `out`. */
const Win: React.FC<{ t: number; at: number; out: number; title: string; children: React.ReactNode; height?: number; top?: number }> = ({ t, at, out, title, children, height = WIN.height, top = WIN.top }) => {
  if (t < at || t > out) return null;
  const p = expoOut(clamp01((t - at) / 0.18));
  const glitch = t - at < 0.07 ? (hash01(Math.floor(t * 60)) - 0.5) * 30 : 0;
  return (
    <div
      style={{
        position: "absolute",
        left: WIN.left + glitch,
        top,
        width: WIN.width,
        height,
        background: PANEL,
        border: `2px solid ${EDGE}`,
        borderRadius: 14,
        overflow: "hidden",
        transform: `scale(${mix(0.94, 1, p)})`,
        opacity: p,
        boxShadow: "0 30px 80px rgba(0,0,0,0.8)",
      }}
    >
      <div style={{ height: 52, borderBottom: `2px solid ${EDGE}`, display: "flex", alignItems: "center", padding: "0 20px", gap: 10 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ width: 14, height: 14, borderRadius: 7, background: i === 0 ? "#4a4946" : "#2a2927" }} />
        ))}
        <div style={{ ...mono(20, DIM), marginLeft: 16 }}>{title}</div>
      </div>
      <div style={{ position: "relative", padding: 34, height: height - 52 }}>{children}</div>
    </div>
  );
};

// ---------------------------------------------------------------------------------------------
const Helpdesk: React.FC<{ t: number; l: Line; out: number }> = ({ t, l, out }) => {
  const rows = ["#4471  printer offline", "#4472  vpn won't connect", "#4473  outlook keeps crashing", "#4474  ", "#4475  password expired", "#4476  monitor flicker"];
  return (
    <Win t={t} at={l.start} out={out} title="helpdesk — queue · back room · 61°F">
      {rows.map((r, i) => {
        const mine = i === 3;
        return (
          <div key={i} style={{ ...mono(26, mine ? INK : DIM), padding: "12px 0", borderBottom: `1px solid ${EDGE}` }}>
            {mine ? `#4474  ${typed("started with a headset in a cold back room", t, l.start, l.end - l.start)}${caret(t)}` : r}
          </div>
        );
      })}
      {/* headset, drawn as a line icon */}
      <svg width={260} height={220} style={{ position: "absolute", right: 30, bottom: 30 }} viewBox="0 0 260 220">
        <path d="M40 140 C40 40, 220 40, 220 140" stroke={STONE} strokeWidth={10} fill="none" strokeDasharray={420} strokeDashoffset={420 * (1 - clamp01((t - l.start) / 0.6))} />
        <rect x={20} y={120} width={44} height={80} rx={14} fill="none" stroke={INK} strokeWidth={8} />
        <rect x={196} y={120} width={44} height={80} rx={14} fill="none" stroke={INK} strokeWidth={8} />
        <path d="M42 200 C60 230, 120 220, 140 206" stroke={INK} strokeWidth={6} fill="none" />
      </svg>
    </Win>
  );
};

const Reset: React.FC<{ t: number; l: Line; out: number }> = ({ t, l, out }) => {
  const d = t - l.start;
  const dots = "•".repeat(Math.max(0, Math.min(12, Math.floor(d * 14))));
  const done = d > 0.9;
  return (
    <Win t={t} at={l.start} out={out} title="active directory — reset password">
      <div style={mono(22, DIM)}>user</div>
      <div style={{ ...mono(34), border: `2px solid ${EDGE}`, borderRadius: 8, padding: "12px 18px", margin: "8px 0 26px" }}>{typed("jdoe@corp", t, l.start, 0.35)}</div>
      <div style={mono(22, DIM)}>new password</div>
      <div style={{ ...mono(34), border: `2px solid ${EDGE}`, borderRadius: 8, padding: "12px 18px", margin: "8px 0 26px", height: 48 }}>{dots}</div>
      <div style={{ ...mono(30, done ? "#0d0d0e" : INK), background: done ? INK : "transparent", border: `2px solid ${INK}`, borderRadius: 8, padding: "14px 0", textAlign: "center", width: 360 }}>{done ? "RESET ✓" : "RESET"}</div>
      <div style={{ ...mono(24, DIM), position: "absolute", left: 34, bottom: 40 }}>lunch 12:00 · cup noodles · 3 min</div>
      <div style={{ ...mono(64, STONE), position: "absolute", right: 40, bottom: 26 }}>{`12:0${Math.min(9, Math.floor(d * 6))}`}</div>
    </Win>
  );
};

const Bank: React.FC<{ t: number; l: Line; out: number }> = ({ t, l, out }) => {
  const d = t - l.start;
  // the balance drains in sync with the line, into the red
  const bal = mix(43.17, -12.84, cubicOut(clamp01(d / (l.end - l.start))));
  const neg = bal < 0;
  const tx = [
    ["FRI", "PAYDAY · pending", "+0.00"],
    ["THU", "GAS — QUICKSTOP", "-40.00"],
    ["THU", "NOODLES ×12", "-9.99"],
    ["WED", "PHONE BILL", "-6.02"],
  ];
  return (
    <Win t={t} at={l.start} out={out} title="first community bank — checking ••4417">
      <div style={mono(24, DIM)}>available balance</div>
      <div style={{ fontFamily: F.grotesk, fontWeight: 800, fontSize: 132, lineHeight: 1.1, color: neg ? RED : INK, letterSpacing: "-0.03em" }}>
        {neg ? "-" : ""}${Math.abs(bal).toFixed(2)}
      </div>
      <div style={{ height: 10, background: "#1c1b1a", borderRadius: 5, margin: "8px 0 26px", overflow: "hidden" }}>
        <div style={{ width: `${Math.max(0, (bal / 43.17) * 100)}%`, height: 10, background: neg ? RED : STONE }} />
      </div>
      {tx.map((r, i) => {
        const show = d > 0.15 + i * 0.22;
        if (!show) return null;
        return (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", ...mono(26, i === 0 ? STONE : INK), padding: "10px 0", borderBottom: `1px solid ${EDGE}` }}>
            <span>
              <span style={{ color: DIM }}>{r[0]}  </span>
              {r[1]}
            </span>
            <span style={{ color: r[2].startsWith("-") ? RED : STONE }}>{r[2]}</span>
          </div>
        );
      })}
      <div style={{ ...mono(24, DIM), position: "absolute", left: 34, bottom: 30 }}>memo: {typed("praying on fridays", t, l.start + 0.6, 1.0)}{caret(t)}</div>
    </Win>
  );
};

const Highway: React.FC<{ t: number; l: Line; out: number }> = ({ t, l, out }) => {
  const d = t - l.start;
  if (t < l.start || t > out) return null;
  return (
    <div style={{ position: "absolute", left: 0, top: 680, width: W, height: 860, overflow: "hidden" }}>
      <svg width={W} height={860}>
        {/* road */}
        <path d={`M540 40 L-200 860 M540 40 L1280 860`} stroke={INK} strokeWidth={3} />
        {Array.from({ length: 14 }, (_, i) => {
          const z = ((i / 14 + d * 1.6) % 1);
          const y = 40 + Math.pow(z, 2.2) * 820;
          const w = 4 + z * 26;
          return <rect key={i} x={540 - w / 2} y={y} width={w} height={8 + z * 60} fill={INK} opacity={0.3 + z * 0.7} />;
        })}
        {/* headlight streaks */}
        {Array.from({ length: 6 }, (_, i) => {
          const z = ((i / 6 + d * 2.4) % 1);
          const x = 540 + (i % 2 ? 1 : -1) * (40 + z * 520);
          const y = 40 + Math.pow(z, 2) * 820;
          return <line key={i} x1={x} y1={y} x2={x + (i % 2 ? 1 : -1) * z * 60} y2={y + z * 90} stroke={i % 3 === 0 ? RED : "#fff"} strokeWidth={2 + z * 6} opacity={0.8} />;
        })}
      </svg>
      <div style={{ position: "absolute", left: 70, bottom: 40, ...mono(26, DIM) }}>2014 sedan · 212,480 mi</div>
      <div style={{ position: "absolute", right: 150, bottom: 30, ...mono(30, Math.floor(t * 3) % 2 ? RED : "#5a1f1a") }}>⚠ CHECK ENGINE</div>
      {/* smoke */}
      {Array.from({ length: 10 }, (_, i) => {
        const a = (d * 1.2 + i * 0.1) % 1;
        return <div key={i} style={{ position: "absolute", left: 480 + Math.sin(i * 2 + d) * 60, top: 760 - a * 600, width: 60 + a * 160, height: 60 + a * 160, borderRadius: "50%", background: `radial-gradient(closest-side, rgba(220,220,220,${0.18 * (1 - a)}), rgba(220,220,220,0))` }} />;
      })}
    </div>
  );
};

const Phone: React.FC<{ t: number; l: Line; out: number }> = ({ t, l, out }) => {
  if (t < l.start || t > out) return null;
  const p = expoOut(clamp01((t - l.start) / 0.2));
  return (
    <div style={{ position: "absolute", left: 300, top: 720 + (1 - p) * 80, width: 480, height: 760, borderRadius: 60, border: `4px solid ${INK}`, background: PANEL, opacity: p, padding: 40 }}>
      <div style={{ ...mono(22, DIM), textAlign: "center" }}>FRI 11:48 PM</div>
      <div style={{ fontFamily: F.grotesk, fontWeight: 800, fontSize: 120, color: INK, textAlign: "center", marginTop: 60 }}>0</div>
      <div style={{ ...mono(28, DIM), textAlign: "center" }}>missed calls</div>
      <div style={{ ...mono(26, DIM), textAlign: "center", marginTop: 60, border: `2px solid ${EDGE}`, borderRadius: 18, padding: 22 }}>no new messages</div>
      <div style={{ ...mono(24, INK), marginTop: 40, borderTop: `2px solid ${EDGE}`, paddingTop: 20 }}>
        {typed("nobody knew me", t, l.start, 0.6)}
        {caret(t)}
      </div>
    </div>
  );
};

const Calendar: React.FC<{ t: number; l: Line; out: number }> = ({ t, l, out }) => {
  const d = t - l.start;
  const days = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
  const classStart = l.words[3].s - l.start;
  return (
    <Win t={t} at={l.start} out={out} title="schedule — week 37">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 10 }}>
        {days.map((dname, i) => (
          <div key={dname}>
            <div style={{ ...mono(20, DIM), textAlign: "center", marginBottom: 10 }}>{dname}</div>
            {[0, 1, 2].map((s) => {
              const isClass = s === 2;
              const at = isClass ? classStart + i * 0.05 : (s * 7 + i) * 0.035;
              const on = d > at;
              return (
                <div key={s} style={{ height: 150, marginBottom: 10, borderRadius: 8, border: `2px solid ${on ? (isClass ? STONE : INK) : EDGE}`, background: on ? (isClass ? "rgba(196,182,162,0.18)" : "rgba(239,237,233,0.1)") : "transparent", ...mono(17, on ? INK : "transparent"), padding: 8 }}>
                  {isClass ? "CLASS" : "SHIFT"}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </Win>
  );
};

const Gas: React.FC<{ t: number; l: Line; out: number }> = ({ t, l, out }) => {
  const d = t - l.start;
  const fill = clamp01((t - l.words[5].s) / 1.0);
  const ang = mix(-120, 120, cubicOut(fill));
  return (
    <Win t={t} at={l.start} out={out} title="inbox — 23 rejections">
      {Array.from({ length: 5 }, (_, i) => {
        const at = i * 0.12;
        const fly = clamp01((d - 0.5 - i * 0.08) / 0.4);
        if (d < at) return null;
        return (
          <div key={i} style={{ ...mono(24, DIM), padding: "8px 0", borderBottom: `1px solid ${EDGE}`, transform: `translate(${fly * 420}px, ${fly * 260}px) scale(${1 - fly * 0.7})`, opacity: 1 - fly }}>
            <span style={{ color: RED, fontWeight: 700 }}>NO </span> — unfortunately, we've decided…
          </div>
        );
      })}
      <svg width={420} height={300} viewBox="-210 -230 420 300" style={{ position: "absolute", right: 40, bottom: 40 }}>
        <path d="M-180 0 A180 180 0 0 1 180 0" stroke={EDGE} strokeWidth={22} fill="none" />
        <path d="M-180 0 A180 180 0 0 1 180 0" stroke={STONE} strokeWidth={22} fill="none" strokeDasharray={566} strokeDashoffset={566 * (1 - fill)} />
        <line x1={0} y1={0} x2={Math.sin((ang * Math.PI) / 180) * 150} y2={-Math.cos((ang * Math.PI) / 180) * 150} stroke={INK} strokeWidth={8} />
        <text x={-190} y={50} fill={DIM} fontFamily="IBM Plex Mono" fontSize={30}>E</text>
        <text x={170} y={50} fill={DIM} fontFamily="IBM Plex Mono" fontSize={30}>F</text>
      </svg>
    </Win>
  );
};

const Network: React.FC<{ t: number; l: Line; out: number }> = ({ t, l, out }) => {
  const nodes = [
    { x: 430, y: 90, k: "SERVER", w: 3 },
    { x: 200, y: 330, k: "SWITCH", w: 5 },
    { x: 660, y: 330, k: "SWITCH", w: 5 },
    { x: 90, y: 560, k: "PORT", w: 6 },
    { x: 310, y: 560, k: "PORT", w: 6 },
    { x: 550, y: 560, k: "PORT", w: 6 },
    { x: 770, y: 560, k: "PORT", w: 6 },
  ];
  const edges = [[0, 1], [0, 2], [1, 3], [1, 4], [2, 5], [2, 6]];
  const lit = (i: number) => t >= l.words[nodes[i].w].s;
  return (
    <Win t={t} at={l.start} out={out} title="netmap — core-sw-02">
      <svg width={872} height={660} style={{ position: "absolute", left: 34, top: 20 }}>
        {edges.map(([a, b], i) => {
          const p = clamp01((t - l.start - i * 0.08) / 0.3);
          const A = nodes[a], B = nodes[b];
          return <line key={i} x1={A.x + 60} y1={A.y + 30} x2={A.x + 60 + (B.x - A.x) * p} y2={A.y + 30 + (B.y - A.y) * p} stroke={lit(b) ? STONE : EDGE} strokeWidth={3} />;
        })}
        {nodes.map((n, i) => (
          <g key={i}>
            <rect x={n.x} y={n.y} width={120} height={60} rx={8} fill={lit(i) ? "rgba(196,182,162,0.2)" : PANEL} stroke={lit(i) ? STONE : EDGE} strokeWidth={3} />
            <text x={n.x + 60} y={n.y + 39} textAnchor="middle" fill={lit(i) ? INK : DIM} fontFamily="IBM Plex Mono" fontSize={20}>{n.k}</text>
          </g>
        ))}
      </svg>
      <div style={{ ...mono(22, DIM), position: "absolute", left: 34, bottom: 30 }}>{`ping core-sw-02 ... ${(0.6 + hash01(Math.floor(t * 8)) * 0.4).toFixed(1)}ms`}</div>
    </Win>
  );
};

const Outage: React.FC<{ t: number; l: Line; out: number }> = ({ t, l, out }) => {
  const d = t - l.start;
  const svc = ["email", "vpn", "file-server", "payroll", "phones", "badge-access"];
  const clock = mix(167, 192, clamp01(d / 1.6));
  return (
    <Win t={t} at={l.start} out={out} title="status — incident INC-4471">
      {svc.map((s, i) => {
        const ok = d > 0.3 + i * 0.18;
        return (
          <div key={s} style={{ display: "flex", justifyContent: "space-between", ...mono(30), padding: "14px 0", borderBottom: `1px solid ${EDGE}` }}>
            <span>{s}</span>
            <span style={{ color: ok ? STONE : RED }}>{ok ? "● OK" : "● DOWN"}</span>
          </div>
        );
      })}
      <div style={{ ...mono(64, STONE), position: "absolute", right: 40, bottom: 20 }}>{`0${Math.floor(clock / 60)}:${String(Math.floor(clock % 60)).padStart(2, "0")} AM`}</div>
    </Win>
  );
};

const Org: React.FC<{ t: number; l: Line; out: number }> = ({ t, l, out }) => {
  const up = cubicOut(clamp01((t - l.words[2].s) / 0.6));
  return (
    <Win t={t} at={l.start} out={out} title="org chart — IT">
      <svg width={872} height={660} style={{ position: "absolute", left: 34, top: 20 }}>
        {[180, 436, 692].map((x, i) => (
          <line key={i} x1={436} y1={110} x2={x} y2={300} stroke={EDGE} strokeWidth={3} />
        ))}
        {[180, 436, 692].map((x, i) => (
          <rect key={i} x={x - 110} y={300} width={220} height={90} rx={10} fill={PANEL} stroke={EDGE} strokeWidth={3} />
        ))}
        {[110, 330, 550, 770].map((x, i) => (
          <rect key={i} x={x - 90} y={500} width={180} height={80} rx={10} fill={PANEL} stroke={EDGE} strokeWidth={3} />
        ))}
        {/* his card: from the seat he sat in to the top */}
        <g transform={`translate(${mix(550, 436, up)}, ${mix(540, 70, up)})`}>
          <rect x={-130} y={-45} width={260} height={90} rx={12} fill="rgba(196,182,162,0.2)" stroke={STONE} strokeWidth={4} />
          <text x={0} y={-4} textAnchor="middle" fill={INK} fontFamily="Inter" fontWeight={800} fontSize={30}>RUDO</text>
          <text x={0} y={28} textAnchor="middle" fill={STONE} fontFamily="IBM Plex Mono" fontSize={20}>{up > 0.6 ? "team lead" : "help desk"}</text>
        </g>
      </svg>
    </Win>
  );
};

const Title: React.FC<{ t: number; l: Line; out: number }> = ({ t, l, out }) => {
  const swap = t > l.words[3].s;
  const stamp = t - l.words[6].s;
  return (
    <Win t={t} at={l.start} out={out + 0.6} title="profile — directory">
      <div style={{ display: "flex", gap: 34, alignItems: "center" }}>
        <div style={{ width: 200, height: 200, borderRadius: 100, border: `3px solid ${STONE}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F.grotesk, fontWeight: 800, fontSize: 80, color: INK }}>R</div>
        <div>
          <div style={{ fontFamily: F.grotesk, fontWeight: 800, fontSize: 64, color: INK }}>RUDO</div>
          <div style={{ ...mono(30, DIM), textDecoration: swap ? "line-through" : "none" }}>Help Desk Technician</div>
          {swap ? <div style={{ ...mono(36, STONE) }}>IT Team Lead</div> : null}
        </div>
      </div>
      <div style={{ ...mono(24, DIM), marginTop: 50 }}>same desk · same screen · since 2016</div>
      {stamp > 0 ? (
        <div
          style={{
            position: "absolute",
            right: 50,
            bottom: 60,
            border: `8px solid ${STONE}`,
            color: STONE,
            fontFamily: F.grotesk,
            fontWeight: 900,
            fontSize: 110,
            padding: "6px 30px",
            transform: `rotate(-12deg) scale(${mix(2.2, 1, cubicOut(clamp01(stamp / 0.12)))})`,
            opacity: clamp01(stamp / 0.05),
          }}
        >
          EARNED
        </div>
      ) : null}
    </Win>
  );
};

// ---------------------------------------------------------------------------------------------
/** Verse 1, 0:29–0:50: the IT years, told through the screens he lived in. */
export const Verse1: React.FC<{ t: number; assets: { geo: THREE.BufferGeometry; font: Font } | null; bare?: boolean }> = ({ t, assets, bare }) => {
  const outs = L.map((l, i) => lineOut(l, L[i + 1], 1.2));
  const apps = [Helpdesk, Reset, Bank, Highway, Phone, null, Calendar, Gas, Network, Outage, Org, Title];
  const wall = L[5];
  const rail = useMemo(() => (assets ? buildRail(L, assets.font, { seed: 11, size: 0.16 }) : null), [assets]);
  const kick = kickEnv(t, 0.15);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {/* faint blueprint grid, like the reference */}
      <AbsoluteFill
        style={{
          backgroundImage: "linear-gradient(rgba(239,237,233,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(239,237,233,0.05) 1px, transparent 1px)",
          backgroundSize: "90px 90px",
          backgroundPosition: `0 ${(t * 40) % 90}px`,
          opacity: 0.8 + kick * 0.4,
        }}
      />
      {/* back to the wall: the 3D RUDO returns */}
      {assets && t >= wall.start - 0.05 && t < outs[5] ? (
        <ThreeCanvas width={W} height={H} style={{ position: "absolute", inset: 0 }} gl={{ antialias: true }}>
          <IntroScene t={4.0 + (t - wall.start) * 0.35} geo={assets.geo} font={assets.font} />
        </ThreeCanvas>
      ) : null}
      {/* the apps sit in the lower half, under the rail */}
      <div style={{ position: "absolute", inset: 0, transform: "translateY(260px) scale(0.8)", transformOrigin: "50% 100%" }}>
        {L.map((l, i) => {
          const App = apps[i];
          return App ? <App key={l.id} t={t} l={l} out={outs[i]} /> : null;
        })}
      </div>
      {/* the lyric rides a network cable; the data pulse lights it */}
      {bare || !rail ? null : (
        <ThreeCanvas width={W} height={H} style={{ position: "absolute", inset: 0 }} gl={{ antialias: true, alpha: true }}>
          <RailView rail={rail} t={t} cam={{ drop: 0.42 }} accent={(li, wi) => (/^red$/i.test(L[li].words[wi].w) ? RED3 : null)} />
        </ThreeCanvas>
      )}
      {bare ? null : L.map((l, i) => <Caption key={l.id} line={l} t={t} out={outs[i]} />)}
      {bare ? null : <div style={{ position: "absolute", left: SAFE.left, top: 180, ...mono(20, STONE) }}>02 / VERSE 1 — the back room</div>}
    </AbsoluteFill>
  );
};
