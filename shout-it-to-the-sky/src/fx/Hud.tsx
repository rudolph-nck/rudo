import React from "react";
import * as THREE from "three";
import { H, W } from "../theme";
import { F } from "../utils/fonts";
import { clamp01, cubicOut } from "../utils/ease";
import { hash01 } from "../utils/random";
import { T, kickEnv, linesOf, sectionAt } from "../data";
import { CH1, CH3, OUTRO, PRE_WORDS, V2, camAt } from "../three/layout";
import { ACCENT } from "../three/Type";

const GREY = "rgba(200,196,188,0.78)";
const DIM = "rgba(200,196,188,0.42)";

const projCam = new THREE.PerspectiveCamera(40, W / H, 0.04, 3000);
/** Screen position (px) of a world point at song time t, or null if behind the camera. */
const project = (t: number, p: THREE.Vector3) => {
  const c = camAt(t);
  projCam.fov = c.fov;
  projCam.position.copy(c.pos);
  projCam.up.copy(c.up);
  projCam.lookAt(c.look);
  projCam.updateProjectionMatrix();
  projCam.updateMatrixWorld();
  const v = p.clone().project(projCam);
  if (v.z > 1 || v.z < -1) return null;
  return { x: (v.x * 0.5 + 0.5) * W, y: (-v.y * 0.5 + 0.5) * H };
};

const fmt = (s: number) => {
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${(s - m * 60).toFixed(2).padStart(5, "0")}`;
};

/** Typed-on mono text. */
const Typed: React.FC<{ text: string; t: number; at: number; cps?: number; style?: React.CSSProperties }> = ({ text, t, at, cps = 38, style }) => {
  if (t < at) return null;
  const n = Math.min(text.length, Math.floor((t - at) * cps));
  const cursor = n < text.length && Math.floor(t * 8) % 2 === 0;
  return (
    <span style={{ whiteSpace: "pre", ...style }}>
      {text.slice(0, n)}
      {cursor ? "▌" : ""}
    </span>
  );
};

const mono = (size = 19, color = GREY): React.CSSProperties => ({ fontFamily: F.mono, fontSize: size, color, letterSpacing: "0.02em", lineHeight: 1.35 });

/** Corner-bracket tracking box with a leader line to a label block. */
const Track: React.FC<{
  t: number;
  at: number;
  until: number;
  p: THREE.Vector3;
  size: number;
  label: string[];
  dx: number;
  dy: number;
  hot?: boolean;
  seed: number;
}> = ({ t, at, until, p, size, label, dx, dy, hot, seed }) => {
  if (t < at || t > until) return null;
  const s = project(t, p);
  if (!s) return null;
  const k = cubicOut(clamp01((t - at) / 0.25));
  const out = clamp01((t - until + 0.25) / 0.25);
  const op = k * (1 - out);
  const half = (size / 2) * (1.6 - 0.6 * k);
  const col = hot ? ACCENT : GREY;
  const br = 16;
  const lx = s.x + dx, ly = s.y + dy;
  const conf = (0.12 + 0.07 * hash01(Math.floor(t * 6) + seed)).toFixed(2);
  return (
    <>
      <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0, opacity: op }}>
        {[
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ].map(([sx, sy], i) => (
          <path key={i} d={`M${s.x + sx * half} ${s.y + sy * half + -sy * br} L${s.x + sx * half} ${s.y + sy * half} L${s.x + sx * half + -sx * br} ${s.y + sy * half}`} stroke={col} strokeWidth={2} fill="none" />
        ))}
        <circle cx={s.x} cy={s.y} r={3} fill={col} />
        <path d={`M${s.x + Math.sign(dx) * half} ${s.y} L${lx - Math.sign(dx) * 8} ${ly}`} stroke={DIM} strokeWidth={1.4} fill="none" />
      </svg>
      <div style={{ position: "absolute", left: dx > 0 ? lx : undefined, right: dx < 0 ? W - lx : undefined, top: ly - 14, opacity: op, textAlign: dx > 0 ? "left" : "right" }}>
        {label.map((l, i) => (
          <div key={i} style={mono(i === 0 ? 21 : 17, i === 0 ? col : DIM)}>
            <Typed text={l} t={t} at={at + 0.12 + i * 0.18} />
          </div>
        ))}
        <div style={mono(15, DIM)}>conf {conf}</div>
      </div>
    </>
  );
};

/** IT-desk terminal that logs verse 1 line by line. */
const LOG = [
  "> login helpdesk-01 ............ ok",
  "> reset_pw --user jdoe ......... ok",
  "> balance ........... -$43.17  RED",
  "> vehicle 2014 · 212,480 mi · CEL",
  "> calls 0 · msgs 0 · callbacks 0",
  "> position ........ back_to_wall",
  "> shifts 312 · classes 14",
  "> rejections -> fuel ......... ok",
  "> ping core-sw-02 .......... 0.8ms",
  "> INC-4471 resolved ...... 03:12",
  "> role helpdesk -> team_lead",
  "> title updated · earned ...... ok",
];

export const Hud: React.FC<{ t: number }> = ({ t }) => {
  const sec = sectionAt(t);
  const idx = T.sections.indexOf(sec) + 1;
  const kick = kickEnv(t, 0.12);
  const v1 = linesOf("verse1");
  const intro = linesOf("intro");
  const hudOn = clamp01((t - 3.4) / 0.4);

  // pre-chorus step counter
  const step = PRE_WORDS.filter((w) => w.s <= t).length;
  const alt = camAt(t).pos.z * 9.5 + Math.max(0, camAt(t).pos.y - 140) * 0.8;

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {/* section header + timecode */}
      <div style={{ position: "absolute", left: 64, top: 150, opacity: hudOn }}>
        <div style={mono(20, ACCENT)}>{String(idx).padStart(2, "0")} / {sec.label.toUpperCase()}</div>
        <div style={mono(17, DIM)}>{sec.tag.includes(":") ? sec.tag.split(":")[1].trim().toUpperCase() : "—"}</div>
        <div style={mono(17, DIM)}>
          t {fmt(t)} · {T.bpm.toFixed(1)} bpm
        </div>
      </div>
      {/* kick meter */}
      <div style={{ position: "absolute", left: 64, top: 262, display: "flex", gap: 4, opacity: hudOn }}>
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} style={{ width: 10, height: 6, background: i < Math.round(kick * 12) ? ACCENT : "rgba(200,196,188,0.18)" }} />
        ))}
      </div>

      {/* intro: the subject is tracked */}
      <Track t={t} at={intro[0].start - 0.2} until={8.6} p={new THREE.Vector3(0.02, 1.2, 0.44)} size={150} label={["SUBJ. RUDO", "status ... unseen", `handed ... 0.00`]} dx={210} dy={-120} hot seed={1} />
      <Track t={t} at={intro[0].words[2].s} until={8.6} p={new THREE.Vector3(0.0, 0.62, 0.46)} size={120} label={["HANDS", "support ... 0"]} dx={-220} dy={40} seed={2} />
      <Track t={t} at={intro[0].words[3].s} until={8.6} p={new THREE.Vector3(-0.32, 0.1, 0.62)} size={100} label={["FOOTING", "floor ... concrete"]} dx={-200} dy={150} seed={3} />
      <Track t={t} at={12.4} until={16.4} p={new THREE.Vector3(0.0, 1.17, 0.44)} size={170} label={["EYES", "focus ... locked", "grind ... 1.00"]} dx={190} dy={-170} hot seed={4} />

      {/* the drop */}
      {t > 17.2 && t < 29.2 ? (
        <div style={{ position: "absolute", left: 64, bottom: 470, opacity: clamp01((t - 17.3) / 0.3) }}>
          <div style={mono(20, ACCENT)}>FRACTURE PROPAGATION</div>
          <div style={mono(17, DIM)}>
            v {(38 + 6 * Math.sin(t * 3)).toFixed(1)} m/s · len {(camAt(t).pos.y + 7).toFixed(1)} m
          </div>
        </div>
      ) : null}

      {/* verse 1: terminal */}
      {t > v1[0].start - 0.3 && t < CH1.start - 8 ? (
        <div style={{ position: "absolute", left: 64, top: 300, width: 640, opacity: clamp01((t - v1[0].start + 0.3) / 0.3) }}>
          {v1.map((l, i) => {
            if (t < l.start) return null;
            const age = v1.filter((x) => x.start <= t).length - 1 - i;
            if (age > 6) return null;
            const red = /RED/.test(LOG[i]);
            return (
              <div key={l.id} style={{ ...mono(18, red ? ACCENT : age === 0 ? GREY : DIM), opacity: 1 - age * 0.12 }}>
                <Typed text={LOG[i] ?? ""} t={t} at={l.start} cps={60} />
              </div>
            );
          })}
        </div>
      ) : null}

      {/* pre-chorus: stair counter */}
      {step > 0 && t < CH1.start + 0.3 ? (
        <div style={{ position: "absolute", left: 64, top: 300 }}>
          <div style={mono(20, ACCENT)}>
            STEP {String(step).padStart(2, "0")} / {PRE_WORDS.length}
          </div>
          <div style={mono(17, DIM)}>rise 0.28 · run 0.62 · elev {(-10 + step * 0.28).toFixed(2)}</div>
          <div style={{ marginTop: 8, width: 300, height: 4, background: "rgba(200,196,188,0.18)" }}>
            <div style={{ width: `${(step / PRE_WORDS.length) * 100}%`, height: 4, background: ACCENT }} />
          </div>
        </div>
      ) : null}

      {/* chorus: altimeter */}
      {(t > CH1.start + 0.6 && t < V2.start) || (t > CH3.start + 0.6 && t < OUTRO.start) ? (
        <div style={{ position: "absolute", left: 64, top: 300 }}>
          <div style={mono(20, ACCENT)}>ALT +{alt.toFixed(1)} m</div>
          <div style={mono(17, DIM)}>{t > 75.4 && t < V2.start ? "heading ... universe · r = ∞" : "heading ... sky"}</div>
        </div>
      ) : null}
    </div>
  );
};
