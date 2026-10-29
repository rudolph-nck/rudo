import React, { useMemo } from "react";
import { AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from "remotion";
import { FPS, impactEnv, kickEnv, linesOf } from "../data";
import { SAFE, W, H } from "../theme";
import { F, ensureFonts } from "../utils/fonts";
import { fitSize, measure } from "../utils/measure";
import { clamp01, cubicOut, expoOut, mix } from "../utils/ease";
import { hash01, noise1, rng } from "../utils/random";
import { Grain, Vignette } from "../fx/Post";
import { PLATES } from "./plates";

ensureFonts();

/**
 * Intro, 0:00–0:29 — director's cut v2.
 * Picture: cinematic plates (Higgsfield) when present, else the cover photo as a stand-in.
 * Lyrics: crisp screen-space type, always inside the safe frame while sung, that physically
 * becomes the objects (shouted words crack and fall; the rubble rebuilds as the brick wall).
 */
const INK = "#efede9";
const STONE = "#c4b6a2";
const SAFE_W = SAFE.right - SAFE.left;
const CX = (SAFE.left + SAFE.right) / 2;
const DROP = 17.218;
const TUBE_ON = 3.61;
const FLOOR = 1470;

const [NOBODY, BUILT] = linesOf("intro");
const NOBODY_ROWS = [[0], [1, 2], [3]];
const FALL_AT = BUILT.start - 1.35; // the shout cracks and falls before the rebuild
const TITLE_IN = 11.6;

const tubeLevel = (t: number) => {
  if (t < TUBE_ON - 1.25) return 0;
  if (t >= TUBE_ON) return 0.94 + 0.06 * noise1(t * 40, 5);
  const k = Math.floor((t - (TUBE_ON - 1.25)) * 30);
  const p = [0, 0, 1, 0.2, 0, 0, 0, 0.6, 1, 0, 0, 0, 0, 0, 0.3, 0, 0, 1, 1, 0.4, 0, 0, 0, 0.8, 1, 0.7, 0, 0, 0.5, 1, 1, 1, 1, 1, 1, 1, 1, 1];
  return p[Math.min(p.length - 1, k)];
};

// ---------------------------------------------------------------------------------------------
/** Picture layer: Higgsfield plates where available, cover-photo stand-in otherwise. */
const Picture: React.FC<{ t: number }> = ({ t }) => {
  const plate = PLATES.find((p) => t >= p.from && t < p.to);
  const lvl = tubeLevel(t);
  const imp = impactEnv(t);
  // stand-in: slow push, plus the shout's punch-in
  const zoom = 1.04 + 0.05 * clamp01(t / 17) + 0.05 * Math.min(1, imp) + (t > DROP ? 0.12 * expoOut(clamp01((t - DROP) / 1.2)) : 0);
  const textDim = clamp01((t - NOBODY.start + 0.1) / 0.2) * (1 - clamp01((t - 12) / 1.5)) * 0.45;
  return (
    <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
      {PLATES.map((p) => (
        <Sequence key={p.file} from={Math.round(p.from * FPS)} durationInFrames={Math.round((p.to - p.from) * FPS)} layout="none">
          <AbsoluteFill>
            <OffthreadVideo src={staticFile(p.file)} muted style={{ width: W, height: H, objectFit: "cover", filter: `brightness(${1 - textDim}) contrast(1.08) saturate(0.6)` }} />
          </AbsoluteFill>
        </Sequence>
      ))}
      {!plate ? (
        <div style={{ position: "absolute", left: (W - H * zoom) / 2, top: (H - H * zoom) / 2 + 40, width: H * zoom, height: H * zoom }}>
          <Img src={staticFile("images/room.png")} style={{ width: "100%", height: "100%", filter: `brightness(${(0.05 + 0.95 * lvl) * (1 - textDim)}) contrast(1.1) saturate(0.55)` }} />
        </div>
      ) : null}
      {/* top light cone + dust, only on the stand-in */}
      {!plate && lvl > 0.05 ? (
        <AbsoluteFill style={{ background: `radial-gradient(ellipse 60% 40% at 50% 6%, rgba(225,232,240,${0.12 * lvl}) 0%, rgba(0,0,0,0) 100%)`, mixBlendMode: "screen" }} />
      ) : null}
      {/* legibility: darken the band the type lives in */}
      <AbsoluteFill style={{ background: `linear-gradient(180deg, rgba(0,0,0,${0.55 * clamp01((t - 4.4) / 0.3)}) 0%, rgba(0,0,0,0) 55%)` }} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------------------------
type Glyph = { ch: string; x: number; y: number; size: number; word: number; accent: boolean };

/** Shouted line: justified rows of heavy type, each word slams on its sung time. */
const useNobodyGlyphs = () =>
  useMemo(() => {
    const words = NOBODY.words.map((w) => w.w.toUpperCase());
    const rowsTxt = NOBODY_ROWS.map((r) => r.map((i) => words[i]).join(" "));
    const sizes = rowsTxt.map((r) => Math.min(250, fitSize(r, F.grotesk, SAFE_W * 0.98, 250, 900, -0.02)));
    const lh = (s: number) => s * 0.93;
    const total = sizes.reduce((a, s) => a + lh(s), 0);
    let y = 330 + (620 - total) / 2;
    const glyphs: Glyph[] = [];
    NOBODY_ROWS.forEach((row, ri) => {
      const s = sizes[ri];
      const font = `900 ${s}px ${F.grotesk}`;
      const rowW = measure(rowsTxt[ri], font, -0.02);
      let x = CX - rowW / 2;
      row.forEach((wi, k) => {
        if (k > 0) x += measure(" ", font);
        for (const ch of words[wi]) {
          const cw = measure(ch, font) - 0.02 * s;
          glyphs.push({ ch, x, y, size: s, word: wi, accent: wi === words.length - 1 });
          x += cw;
        }
      });
      y += lh(s);
    });
    return glyphs;
  }, []);

const Nobody: React.FC<{ t: number }> = ({ t }) => {
  const glyphs = useNobodyGlyphs();
  const fall = useMemo(() => {
    const r = rng(41);
    return glyphs.map((g) => ({ delay: r() * 0.35, spin: (r() - 0.5) * 160, dx: (SAFE.left + 30 + r() * (SAFE_W - 140)) - g.x, bounce: 0.25 + r() * 0.3, floor: FLOOR + (r() - 0.5) * 70 }));
  }, [glyphs]);
  if (t < NOBODY.start - 0.02 || t > BUILT.start + 0.6) return null;
  return (
    <>
      {glyphs.map((g, i) => {
        const w = NOBODY.words[g.word];
        const dt = t - w.s;
        if (dt < 0) return null;
        // slam in
        const p = cubicOut(clamp01(dt / 0.09));
        const sc = mix(1.55, 1, p);
        // crack and fall
        const f = fall[i];
        const ft = t - FALL_AT - f.delay;
        let y = g.y, x = g.x, rot = 0, op = 1;
        if (ft > 0) {
          const T = Math.sqrt((2 * (f.floor - g.size - g.y)) / 4200);
          if (ft < T) {
            y = g.y + 0.5 * 4200 * ft * ft;
            x = g.x + f.dx * (ft / T);
            rot = f.spin * (ft / T);
          } else {
            const b = ft - T;
            y = f.floor - g.size - Math.abs(Math.sin(b * 14)) * 60 * f.bounce * Math.exp(-b * 5);
            x = g.x + f.dx;
            rot = f.spin;
          }
        }
        // the rubble is taken up by the rebuild
        if (t > BUILT.start) op = 1 - clamp01((t - BUILT.start) / 0.5);
        const fresh = dt < 0.06;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              fontFamily: F.grotesk,
              fontWeight: 900,
              fontSize: g.size,
              lineHeight: 1,
              letterSpacing: "-0.02em",
              color: fresh ? "#ffffff" : g.accent ? STONE : INK,
              transform: `scale(${sc}) rotate(${rot}deg)`,
              transformOrigin: "50% 60%",
              opacity: op,
              textShadow: "0 6px 0 rgba(0,0,0,0.35), 0 18px 40px rgba(0,0,0,0.65)",
              whiteSpace: "pre",
            }}
          >
            {g.ch}
          </div>
        );
      })}
    </>
  );
};

// ---------------------------------------------------------------------------------------------
/** So I built it! — the fallen letters rise back up and lock in as lettered bricks. */
const Bricks: React.FC<{ t: number; shatter: number }> = ({ t, shatter }) => {
  const nobodyGlyphs = useNobodyGlyphs();
  const bricks = useMemo(() => {
    const rows = [[0, 1], [2, 3]];
    const S = 100, G = 8;
    const out: { ch: string; x: number; y: number; w: number; t0: number; from: { x: number; y: number; rot: number } }[] = [];
    let n = 0;
    const r = rng(9);
    rows.forEach((idx, ri) => {
      const cells: { ch: string; w: number; wi: number; k: number }[] = [];
      idx.forEach((wi, m) => {
        if (m > 0) cells.push({ ch: " ", w: S * 0.35, wi, k: -1 });
        BUILT.words[wi].w.toUpperCase().split("").forEach((ch, k) => cells.push({ ch, w: ch === "I" || ch === "!" ? S * 0.62 : S, wi, k }));
      });
      const rowW = cells.reduce((a, c) => a + c.w + G, -G);
      let x = CX - rowW / 2;
      const y = 1040 + ri * (S + G);
      cells.forEach((c) => {
        if (c.ch !== " ") {
          const src = nobodyGlyphs[n % nobodyGlyphs.length];
          out.push({ ch: c.ch, x, y, w: c.w, t0: BUILT.words[c.wi].s + c.k * 0.05, from: { x: src.x + (r() - 0.5) * 100, y: FLOOR - 120, rot: (r() - 0.5) * 90 } });
          n++;
        }
        x += c.w + G;
      });
    });
    return out;
  }, [nobodyGlyphs]);
  if (t < BUILT.start - 0.05) return null;
  return (
    <>
      {bricks.map((b, i) => {
        const dt = t - b.t0;
        if (dt < 0) return null;
        const p = clamp01(dt / 0.3);
        const e = cubicOut(p);
        // arc from the rubble to the slot
        const x = mix(b.from.x, b.x, e);
        const y = mix(b.from.y, b.y, e) - Math.sin(Math.PI * p) * 160;
        const rot = mix(b.from.rot, 0, e);
        const land = dt - 0.3;
        const thud = land > 0 ? Math.exp(-land / 0.06) : 0;
        const sh = shatter > 0 ? { tx: (b.x - CX) * shatter * 2.2, ty: (b.y - 1100) * shatter * 2.2 - 300 * shatter, s: 1 + shatter * 1.6, r: (hash01(i) - 0.5) * 200 * shatter, o: 1 - clamp01((shatter - 0.4) / 0.6) } : { tx: 0, ty: 0, s: 1, r: 0, o: 1 };
        return (
          <React.Fragment key={i}>
            <div
              style={{
                position: "absolute",
                left: x + sh.tx,
                top: y + sh.ty + thud * 6,
                width: b.w,
                height: 100,
                transform: `rotate(${rot + sh.r}deg) scale(${sh.s})`,
                opacity: sh.o,
                borderRadius: 6,
                background: `url(${staticFile("fx/grain-2.png")}), linear-gradient(180deg, #e2ded7 0%, #c6c0b6 60%, #a39b8f 100%)`,
                backgroundSize: "420px 420px, 100% 100%",
                backgroundBlendMode: "soft-light, normal",
                boxShadow: "inset 0 3px 0 rgba(255,255,255,0.35), inset 0 -6px 0 rgba(0,0,0,0.3), 0 18px 34px rgba(0,0,0,0.7)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: F.grotesk,
                fontWeight: 900,
                fontSize: 76,
                color: "#26221d",
                textShadow: "0 2px 0 rgba(255,255,255,0.45), 0 -1px 0 rgba(0,0,0,0.5)",
              }}
            >
              {b.ch}
            </div>
            {land > 0 && land < 0.5 ? (
              <div
                style={{
                  position: "absolute",
                  left: b.x - 40,
                  top: b.y + 100,
                  width: b.w + 80,
                  height: 70,
                  borderRadius: "50%",
                  background: `radial-gradient(closest-side, rgba(220,215,205,${0.4 * (1 - land / 0.5)}), rgba(220,215,205,0))`,
                  transform: `scale(${1 + land * 1.8}, ${1 + land * 0.6})`,
                }}
              />
            ) : null}
          </React.Fragment>
        );
      })}
    </>
  );
};

// ---------------------------------------------------------------------------------------------
const Title: React.FC<{ t: number; shatter: number }> = ({ t, shatter }) => {
  if (t < TITLE_IN || shatter >= 1) return null;
  const sp = 1 - shatter;
  return (
    <div style={{ position: "absolute", left: 0, top: 360, width: W, opacity: sp, transform: `scale(${1 + shatter * 0.4})` }}>
      <div style={{ display: "flex", justifyContent: "center", gap: 70 }}>
        {"RUDO".split("").map((ch, i) => {
          const p = cubicOut(clamp01((t - TITLE_IN - i * 0.16) / 1.0));
          return (
            <span key={ch} style={{ fontFamily: F.grotesk, fontWeight: 800, fontSize: 190, lineHeight: 1, color: INK, opacity: p, transform: `translateY(${(1 - p) * 30}px)`, filter: `blur(${(1 - p) * 8}px)`, textShadow: "0 16px 40px rgba(0,0,0,0.7)" }}>
              {ch}
            </span>
          );
        })}
      </div>
      <div style={{ marginTop: 26, textAlign: "center", fontFamily: F.grotesk, fontWeight: 500, fontSize: 34, letterSpacing: "0.5em", paddingLeft: "0.5em", color: STONE, opacity: cubicOut(clamp01((t - TITLE_IN - 0.9) / 0.9)) }}>
        SHOUT IT TO THE SKY
      </div>
    </div>
  );
};

/** Small, precise tracking HUD on RUDO (stand-in head position). */
const Tracker: React.FC<{ t: number }> = ({ t }) => {
  const on = clamp01((t - NOBODY.words[1].s) / 0.2) * (1 - clamp01((t - FALL_AT) / 0.3));
  const on2 = clamp01((t - 12.4) / 0.25) * (1 - clamp01((t - 16.6) / 0.3));
  const op = Math.max(on, on2);
  if (op <= 0) return null;
  const hx = 545, hy = on2 > on ? 690 : 700, s = 150;
  const conf = (0.11 + 0.08 * hash01(Math.floor(t * 6))).toFixed(2);
  const label = on2 > on ? ["EYES", "focus ... locked"] : ["SUBJ. RUDO", "handed ... 0.00"];
  return (
    <div style={{ position: "absolute", inset: 0, opacity: op }}>
      <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
        {[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy], i) => (
          <path key={i} d={`M${hx + sx * s} ${hy + sy * s - sy * 22} L${hx + sx * s} ${hy + sy * s} L${hx + sx * s - sx * 22} ${hy + sy * s}`} stroke={STONE} strokeWidth={3} fill="none" />
        ))}
        <path d={`M${hx + s} ${hy + s} L${hx + s + 60} ${hy + s + 70}`} stroke="rgba(239,237,233,0.5)" strokeWidth={2} />
      </svg>
      <div style={{ position: "absolute", left: hx + s + 68, top: hy + s + 56, fontFamily: F.mono, fontSize: 24, color: STONE, lineHeight: 1.35 }}>
        <div>{label[0]}</div>
        <div style={{ color: "rgba(239,237,233,0.6)", fontSize: 20 }}>{label[1]}</div>
        <div style={{ color: "rgba(239,237,233,0.45)", fontSize: 18 }}>conf {conf}</div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------------------------
/** The 808: a crack races across the frame, light floods through it. */
const Crack: React.FC<{ t: number }> = ({ t }) => {
  const paths = useMemo(() => {
    const r = rng(808);
    const out: { d: string; len: number; w: number; delay: number }[] = [];
    const grow = (x: number, y: number, a: number, len: number, w: number, depth: number, delay: number) => {
      let d = `M${x.toFixed(1)} ${y.toFixed(1)}`, L = 0;
      while (L < len) {
        a += (r() - 0.5) * 0.7;
        const s = 14 + r() * 14;
        x += Math.cos(a) * s;
        y += Math.sin(a) * s;
        L += s;
        d += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
        if (depth < 2 && r() < 0.08) grow(x, y, a + (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.6), len * 0.4, w * 0.6, depth + 1, delay + (L / len) * 0.2);
      }
      out.push({ d, len: L, w, delay });
    };
    for (let i = 0; i < 10; i++) grow(540, 1080, (i / 10) * Math.PI * 2 + r() * 0.4, 600 + r() * 700, 4.5, 0, r() * 0.05);
    return out;
  }, []);
  if (t < DROP) return null;
  const p = clamp01((t - DROP) / 0.35);
  const glow = 0.6 + 0.6 * Math.exp(-(t - DROP) / 0.4) + 0.3 * kickEnv(t, 0.2);
  const fly = clamp01((t - DROP - 0.6) / 1.4); // camera dives into the crack
  return (
    <AbsoluteFill style={{ transform: `scale(${1 + expoOut(fly) * 5})`, transformOrigin: "540px 1080px", opacity: 1 - clamp01((t - DROP - 1.6) / 0.6) }}>
      <svg width={W} height={H}>
        <defs>
          <filter id="cg" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation={10} />
          </filter>
        </defs>
        {paths.map((c, i) => {
          const q = expoOut(clamp01((p * 1.1 - c.delay) / 0.9));
          const off = c.len * (1 - q);
          return (
            <g key={i}>
              <path d={c.d} stroke={`rgba(240,240,245,${0.35 * glow})`} strokeWidth={c.w * 3} fill="none" filter="url(#cg)" strokeDasharray={c.len} strokeDashoffset={off} />
              <path d={c.d} stroke="#050505" strokeWidth={c.w * 1.6} fill="none" strokeDasharray={c.len} strokeDashoffset={off} />
              <path d={c.d} stroke={`rgba(255,255,255,${Math.min(1, glow)})`} strokeWidth={c.w * 0.6} fill="none" strokeDasharray={c.len} strokeDashoffset={off} />
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

/** After the dive: riding a river of light down the crack until verse 1 (stand-in until the plate). */
const CrackRide: React.FC<{ t: number }> = ({ t }) => {
  if (t < DROP + 1.6) return null;
  const k = t - DROP - 1.6;
  const pts = Array.from({ length: 60 }, (_, i) => {
    const z = i / 59;
    const depth = 1 / (0.12 + z * 3);
    const x = 540 + Math.sin(z * 6 + k * 1.2) * 220 * (1 - z) + noise1(z * 4 + k, 3) * 60 * (1 - z);
    const y = 1920 - z * 1040;
    return { x, y, w: 40 * depth };
  });
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  return (
    <AbsoluteFill style={{ opacity: clamp01(k / 0.6) }}>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 120% 60% at 50% 50%, #1a1a1c 0%, #050505 70%)" }} />
      {/* concrete ground rushing toward camera */}
      <svg width={W} height={H} style={{ position: "absolute" }}>
        <defs>
          <filter id="cg2" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation={10} />
          </filter>
        </defs>
        {Array.from({ length: 26 }, (_, i) => {
          const z = ((i / 26 + k * 0.35) % 1);
          const y = 880 + Math.pow(z, 2.2) * 1040;
          return <line key={i} x1={0} y1={y} x2={W} y2={y} stroke={`rgba(200,200,205,${0.05 + z * 0.18})`} strokeWidth={1 + z * 3} />;
        })}
        <path d={d} stroke="rgba(240,240,245,0.35)" strokeWidth={26} fill="none" filter="url(#cg2)" />
        <path d={d} stroke="#ffffff" strokeWidth={5} fill="none" />
      </svg>
      <AbsoluteFill style={{ background: "linear-gradient(180deg, #050505 0%, rgba(5,5,5,0) 46%)" }} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------------------------
export const Intro: React.FC<{ muted?: boolean }> = ({ muted }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const imp = impactEnv(t);
  const shake = Math.min(1.3, imp) * 20;
  const sx = (hash01(frame * 3) - 0.5) * 2 * shake;
  const sy = (hash01(frame * 3 + 1) - 0.5) * 2 * shake;
  const shatter = t > DROP ? clamp01((t - DROP) / 0.9) : 0;
  const flash = Math.min(0.45, imp * 0.22) + (t > DROP ? 0.85 * Math.exp(-(t - DROP) / 0.12) : 0);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill style={{ transform: `translate(${sx}px, ${sy}px) scale(1.03)` }}>
        <Picture t={t} />
        <Grain opacity={0.06} />
        <Vignette strength={0.6} />
        <Crack t={t} />
        <CrackRide t={t} />
      </AbsoluteFill>
      {/* type sits above grain/vignette so it stays crisp; it shakes less than the picture */}
      <AbsoluteFill style={{ transform: `translate(${sx * 0.4}px, ${sy * 0.4}px)` }}>
        <Tracker t={t} />
        <Title t={t} shatter={shatter} />
        <Nobody t={t} />
        <Bricks t={t} shatter={shatter} />
      </AbsoluteFill>
      {flash > 0.01 ? <AbsoluteFill style={{ background: `rgba(255,255,255,${flash})` }} /> : null}
      {muted ? null : <Audio src={staticFile("audio/shout-it-to-the-sky.m4a")} />}
    </AbsoluteFill>
  );
};

export const INTRO_FRAMES = Math.round(29.2 * FPS);
