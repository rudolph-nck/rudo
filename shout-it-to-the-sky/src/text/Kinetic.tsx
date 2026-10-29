import React, { useMemo } from "react";
import { staticFile } from "remotion";
import { C, SAFE } from "../theme";
import { Line, kickEnv } from "../data";
import { clamp01, cubicIn, cubicOut, expoOut, mix, quintOut } from "../utils/ease";
import { hash01, rng } from "../utils/random";
import { F } from "../utils/fonts";
import { fitSize, measure } from "../utils/measure";

const SAFE_W = SAFE.right - SAFE.left;
const CX = (SAFE.left + SAFE.right) / 2;
const disp = (s: string) => s.toUpperCase();

/** Greedy word wrap at a given font; returns rows of word indices. */
const wrap = (words: string[], font: string, maxW: number, ls = 0) => {
  const rows: number[][] = [[]];
  let cur = "";
  words.forEach((w, i) => {
    const next = cur ? cur + " " + w : w;
    if (cur && measure(next, font, ls) > maxW) {
      rows.push([i]);
      cur = w;
    } else {
      rows[rows.length - 1].push(i);
      cur = next;
    }
  });
  return rows;
};

const stoneFill = (top = "#f1e7d6", bottom = "#a8937c"): React.CSSProperties => ({
  backgroundImage: `url(${staticFile("fx/grain-5.png")}), linear-gradient(180deg, ${top} 0%, ${bottom} 100%)`,
  backgroundBlendMode: "multiply",
  backgroundSize: "260px 260px, 100% 100%",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
});

// ---------------------------------------------------------------------------------------------
/** Shouted lines: each word slams in on its timestamp as a justified block of stone type. */
export const ImpactBlock: React.FC<{ line: Line; t: number; out: number; centerY: number; rows?: number[][] }> = ({ line, t, out, centerY, rows }) => {
  const words = line.words.map((w) => disp(w.w));
  const layout = useMemo(() => {
    const R = rows ?? wrap(words, `400 200px ${F.display}`, SAFE_W * 0.95);
    const rs = R.map((idx) => {
      const txt = idx.map((i) => words[i]).join(" ");
      const size = fitSize(txt, F.display, SAFE_W * 0.94, 330);
      return { idx, size };
    });
    const total = rs.reduce((a, r) => a + r.size * 0.86, 0);
    let y = centerY - total / 2;
    return rs.map((r) => {
      const top = y;
      y += r.size * 0.86;
      return { ...r, top };
    });
  }, [line.id, centerY]);
  if (t < line.start - 0.01 || t > out + 0.35) return null;
  const pout = clamp01((t - out) / 0.32);
  return (
    <div style={{ position: "absolute", inset: 0, opacity: 1 - pout, transform: `translateY(${-pout * 60}px) scale(${1 + pout * 0.1})`, filter: pout > 0 ? `blur(${pout * 10}px)` : undefined }}>
      {layout.map((r, ri) => {
        // per-word horizontal placement inside the justified row
        const font = `400 ${r.size}px ${F.display}`;
        const space = measure(" ", font);
        const widths = r.idx.map((i) => measure(words[i], font));
        const rowW = widths.reduce((a, b) => a + b, 0) + space * (r.idx.length - 1);
        let x = CX - rowW / 2;
        return r.idx.map((wi, k) => {
          const w = line.words[wi];
          const x0 = x;
          x += widths[k] + space;
          const dt = t - w.s;
          if (dt < 0) return null;
          const p = clamp01(dt / 0.11);
          const sc = mix(2.3, 1, cubicOut(p)) * (1 + 0.035 * Math.exp(-Math.max(0, dt - 0.11) / 0.08) * Math.sin(dt * 60));
          const ghost = 1 - clamp01(dt / 0.16);
          const style: React.CSSProperties = {
            position: "absolute",
            left: x0,
            top: r.top,
            fontFamily: F.display,
            fontSize: r.size,
            lineHeight: 1,
            whiteSpace: "nowrap",
            transformOrigin: "50% 55%",
          };
          return (
            <React.Fragment key={`${ri}-${k}`}>
              {ghost > 0 ? (
                <div style={{ ...style, color: `rgba(255,236,210,${0.35 * ghost})`, transform: `scale(${sc * 1.12})`, filter: "blur(6px)" }}>{words[wi]}</div>
              ) : null}
              <div style={{ ...style, transform: `scale(${sc})`, opacity: clamp01(dt / 0.04), filter: "drop-shadow(0 10px 22px rgba(0,0,0,0.75))" }}>
                <span style={stoneFill()}>{words[wi]}</span>
              </div>
            </React.Fragment>
          );
        });
      })}
    </div>
  );
};

// ---------------------------------------------------------------------------------------------
/** "So I built it!": every letter is a brick that drops into the wall on its word's timestamp. */
export const BrickLine: React.FC<{ line: Line; t: number; out: number; baseY: number; rows?: number[][] }> = ({ line, t, out, baseY, rows }) => {
  const words = line.words.map((w) => disp(w.w));
  const GAP = 8;
  const layout = useMemo(() => {
    const R = rows ?? [line.words.map((_, i) => i)];
    // size so the widest brick row fits the safe width
    const rowUnits = (size: number, idx: number[]) => {
      const font = `400 ${size}px ${F.display}`;
      return idx.reduce((a, wi, n) => a + (n > 0 ? size * 0.22 + GAP : 0) + words[wi].split("").reduce((b, ch) => b + Math.max(size * 0.5, measure(ch, font) + size * 0.24) + GAP, -GAP), 0);
    };
    const size = Math.min(170, ...R.map((idx) => (SAFE_W * 0.9 * 100) / rowUnits(100, idx)));
    const font = `400 ${size}px ${F.display}`;
    const bh = size * 1.02;
    const bricks: { ch: string; x: number; y: number; w: number; t0: number; key: string }[] = [];
    R.forEach((idx, ri) => {
      let x = CX - rowUnits(size, idx) / 2;
      const y = baseY - (R.length - ri) * (bh + GAP);
      idx.forEach((wi, n) => {
        if (n > 0) x += size * 0.22 + GAP;
        words[wi].split("").forEach((ch, k) => {
          const w = Math.max(size * 0.5, measure(ch, font) + size * 0.24);
          bricks.push({ ch, x, y, w, t0: line.words[wi].s + k * 0.045, key: `${ri}-${wi}-${k}` });
          x += w + GAP;
        });
      });
    });
    return { bricks, size, bh };
  }, [line.id, baseY]);
  const { size, bh } = layout;
  if (t < line.start - 0.01 || t > out + 0.4) return null;
  const pout = clamp01((t - out) / 0.35);
  const FALL = 0.3;
  return (
    <div style={{ position: "absolute", inset: 0, opacity: 1 - pout }}>
      {layout.bricks.map((b) => {
        const dt = t - b.t0;
        if (dt < 0) return null;
        const p = clamp01(dt / FALL);
        const land = dt - FALL;
        const y = b.y - (1 - cubicIn(p)) * 1100 + (land > 0 ? -Math.abs(Math.sin(land * 26)) * 18 * Math.exp(-land / 0.07) : 0);
        const rot = (hash01(b.x) - 0.5) * 18 * (1 - p);
        const puff = land > 0 ? clamp01(1 - land / 0.5) : 0;
        return (
          <React.Fragment key={b.key}>
            <div
              style={{
                position: "absolute",
                left: b.x,
                top: y,
                width: b.w,
                height: bh,
                transform: `rotate(${rot}deg)`,
                background: `url(${staticFile("fx/grain-2.png")}), linear-gradient(180deg, #c9b9a2 0%, #a8967f 55%, #7d6e5d 100%)`,
                backgroundBlendMode: "multiply",
                backgroundSize: "200px 200px, 100% 100%",
                borderRadius: 4,
                boxShadow: "inset 0 3px 0 rgba(255,240,220,0.22), inset 0 -5px 0 rgba(0,0,0,0.35), 0 14px 26px rgba(0,0,0,0.6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: F.display,
                fontSize: size * 0.9,
                lineHeight: 1,
                paddingTop: size * 0.06,
                color: "#1f1a16",
                textShadow: "0 2px 0 rgba(255,240,220,0.45), 0 -2px 1px rgba(0,0,0,0.55)",
              }}
            >
              {b.ch}
            </div>
            {puff > 0 ? (
              <div
                style={{
                  position: "absolute",
                  left: b.x - 30,
                  top: b.y + bh - 30,
                  width: b.w + 60,
                  height: 60,
                  borderRadius: "50%",
                  background: `radial-gradient(closest-side, rgba(200,185,165,${0.35 * puff}), rgba(200,185,165,0))`,
                  transform: `scale(${1 + (1 - puff) * 0.8}, ${1 + (1 - puff) * 0.3})`,
                }}
              />
            ) : null}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------------------------------------
/** Chorus lines: launched upward like a flare, words bloom in on time, then burst into embers. */
export const FlareLine: React.FC<{ line: Line; t: number; out: number; centerY: number; pulseKick?: boolean; maxSize?: number }> = ({
  line,
  t,
  out,
  centerY,
  pulseKick,
  maxSize = 165,
}) => {
  const words = line.words.map((w) => disp(w.w));
  const lay = useMemo(() => {
    // repeated chants ("STILL GRINDING! STILL GRINDING!") break one phrase per row
    const clauses: number[][] = [[]];
    words.forEach((w, i) => {
      clauses[clauses.length - 1].push(i);
      if (/!$/.test(w) && i < words.length - 1) clauses.push([]);
    });
    const chant = clauses.length > 1;
    const size = chant
      ? Math.min(maxSize, ...clauses.map((c) => fitSize(c.map((i) => words[i]).join(" "), F.display, SAFE_W * 0.92, maxSize)))
      : Math.min(maxSize, fitSize(words.reduce((a, b) => (a.length > b.length ? a : b)), F.display, SAFE_W * 0.9, maxSize));
    const font = `400 ${size}px ${F.display}`;
    const rows = chant ? clauses : wrap(words, font, SAFE_W * 0.92);
    const lh = size * 0.95;
    const space = measure(" ", font);
    const items: { wi: number; x: number; y: number; w: number }[] = [];
    rows.forEach((idx, ri) => {
      const ws = idx.map((i) => measure(words[i], font));
      const rowW = ws.reduce((a, b) => a + b, 0) + space * (idx.length - 1);
      let x = CX - rowW / 2;
      idx.forEach((wi, k) => {
        items.push({ wi, x, y: centerY - (rows.length * lh) / 2 + ri * lh, w: ws[k] });
        x += ws[k] + space;
      });
    });
    return { size, items, lh, h: rows.length * lh };
  }, [line.id, centerY]);
  const embers = useMemo(() => {
    const r = rng(line.id.charCodeAt(1) * 31 + line.id.charCodeAt(3));
    return Array.from({ length: 150 }, () => {
      const it = lay.items[Math.floor(r() * lay.items.length)];
      return { x: it.x + r() * it.w, y: it.y + lay.size * (0.15 + r() * 0.7), vx: (r() - 0.5) * 260, vy: -120 - r() * 420, s: 2 + r() * 6, life: 0.7 + r() * 1.1, hot: r() };
    });
  }, [line.id, lay]);

  const LAUNCH = 0.2;
  const t0 = line.start - LAUNCH;
  if (t < t0 || t > out + 1.9) return null;
  const launch = clamp01((t - t0) / LAUNCH);
  const life = t - line.start;
  const drift = -Math.min(1, Math.max(0, life) / 6) * 70;
  const pout = clamp01((t - out) / 0.22);
  const kick = pulseKick ? kickEnv(t, 0.12) : 0;
  const scale = 1 + Math.max(0, life) * 0.006 + kick * 0.07;
  const streakTop = mix(1560, centerY + lay.h / 2, expoOut(launch));

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {/* flare streak */}
      {launch < 1 || life < 0.45 ? (
        <div
          style={{
            position: "absolute",
            left: CX - 3,
            top: streakTop,
            width: 6,
            height: Math.max(0, 1580 - streakTop),
            background: `linear-gradient(180deg, rgba(255,236,190,${0.95 * (1 - clamp01(life / 0.45))}) 0%, rgba(255,140,50,0) 100%)`,
            filter: "blur(2px)",
            boxShadow: "0 0 24px 6px rgba(255,170,80,0.35)",
          }}
        />
      ) : null}
      {launch >= 1 && life < 0.5 ? (
        <div
          style={{
            position: "absolute",
            left: CX - 260,
            top: centerY - 260,
            width: 520,
            height: 520,
            borderRadius: "50%",
            background: `radial-gradient(closest-side, rgba(255,214,140,${0.55 * (1 - life / 0.5)}), rgba(255,150,60,0))`,
            mixBlendMode: "screen",
          }}
        />
      ) : null}
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `translateY(${drift - pout * 40}px) scale(${scale + pout * 0.08})`,
          transformOrigin: `${CX}px ${centerY}px`,
          opacity: 1 - pout,
          filter: pout > 0 ? `blur(${pout * 8}px)` : undefined,
        }}
      >
        {lay.items.map((it) => {
          const w = line.words[it.wi];
          const dt = t - w.s;
          if (dt < 0) return null;
          const p = quintOut(clamp01(dt / 0.32));
          const hot = Math.exp(-dt / 0.35);
          return (
            <div
              key={it.wi}
              style={{
                position: "absolute",
                left: it.x,
                top: it.y + (1 - p) * 40,
                fontFamily: F.display,
                fontSize: lay.size,
                lineHeight: 1,
                whiteSpace: "nowrap",
                color: `rgb(255,${Math.round(mix(236, 250, hot))},${Math.round(mix(196, 240, hot))})`,
                opacity: clamp01(dt / 0.08),
                filter: `blur(${(1 - p) * 7}px)`,
                textShadow: `0 0 ${18 + hot * 30}px rgba(255,190,90,${0.75 + hot * 0.25}), 0 0 ${60 + kick * 40}px rgba(255,140,40,${0.45 + kick * 0.3})`,
              }}
            >
              {words[it.wi]}
            </div>
          );
        })}
      </div>
      {/* ember burst */}
      {t > out
        ? embers.map((e, i) => {
            const a = t - out;
            if (a > e.life) return null;
            const k = a / e.life;
            const x = e.x + e.vx * a;
            const y = e.y + drift + e.vy * a + 140 * a * a;
            const op = (1 - k) * (k < 0.05 ? k / 0.05 : 1);
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: x,
                  top: y,
                  width: e.s,
                  height: e.s,
                  borderRadius: "50%",
                  background: `rgb(255,${Math.round(120 + e.hot * 110)},${Math.round(40 + e.hot * 60)})`,
                  opacity: op,
                  boxShadow: `0 0 ${e.s * 2.5}px rgba(255,150,60,${op})`,
                }}
              />
            );
          })
        : null}
    </div>
  );
};

// ---------------------------------------------------------------------------------------------
/** Fast rap: words snap in on their timestamps, the previous line steps back. */
export const RapLine: React.FC<{ line: Line; t: number; out: number; centerY: number; color?: string; accent?: string; font?: "cond" | "mono" }> = ({
  line,
  t,
  out,
  centerY,
  color = C.bone,
  accent = C.steel,
  font = "cond",
}) => {
  const words = line.words.map((w) => disp(w.w));
  const fam = font === "mono" ? F.mono : F.cond;
  const weight = font === "mono" ? 500 : 700;
  const lay = useMemo(() => {
    const size = 92;
    const f = `${weight} ${size}px ${fam}`;
    const rows = wrap(words, f, SAFE_W * 0.92);
    const space = measure(" ", f);
    const lh = size * 1.12;
    const items: { wi: number; x: number; y: number }[] = [];
    rows.forEach((idx, ri) => {
      let x = SAFE.left + 10;
      idx.forEach((wi) => {
        items.push({ wi, x, y: centerY - (rows.length * lh) / 2 + ri * lh });
        x += measure(words[wi], f) + space;
      });
    });
    return { size, items };
  }, [line.id, centerY]);
  if (t < line.start - 0.01 || t > out + 0.5) return null;
  const pout = clamp01((t - out) / 0.18);
  return (
    <div style={{ position: "absolute", inset: 0, opacity: 1 - pout * 0.8, transform: `translateY(${-pout * 230}px) scale(${1 - pout * 0.25})`, transformOrigin: `${SAFE.left}px ${centerY}px` }}>
      {lay.items.map((it) => {
        const dt = t - line.words[it.wi].s;
        if (dt < 0) return null;
        const p = clamp01(dt / 0.07);
        return (
          <div
            key={it.wi}
            style={{
              position: "absolute",
              left: it.x,
              top: it.y,
              fontFamily: fam,
              fontWeight: weight,
              fontSize: lay.size,
              lineHeight: 1,
              color: dt < 0.09 ? "#ffffff" : color,
              transform: `scale(${mix(1.35, 1, cubicOut(p))})`,
              transformOrigin: "0% 60%",
              textShadow: `0 0 ${dt < 0.12 ? 26 : 0}px ${accent}, 0 6px 18px rgba(0,0,0,0.7)`,
              whiteSpace: "nowrap",
            }}
          >
            {words[it.wi]}
          </div>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------------------------------------
/** Sung lines that glide and glow (pre-chorus / bridge fallback). */
export const GlideLine: React.FC<{ line: Line; t: number; out: number; centerY: number; color?: string; glow?: string; hand?: boolean }> = ({
  line,
  t,
  out,
  centerY,
  color = C.bone,
  glow = "255,200,140",
  hand,
}) => {
  const words = hand ? line.words.map((w) => w.w) : line.words.map((w) => disp(w.w));
  const fam = hand ? F.hand : F.display;
  const lay = useMemo(() => {
    const size = hand ? 120 : 130;
    const f = `${hand ? 500 : 400} ${size}px ${fam}`;
    const rows = wrap(words, f, SAFE_W * 0.92);
    const space = measure(" ", f);
    const lh = size * (hand ? 1.05 : 0.98);
    const items: { wi: number; x: number; y: number }[] = [];
    rows.forEach((idx, ri) => {
      const ws = idx.map((i) => measure(words[i], f));
      let x = CX - (ws.reduce((a, b) => a + b, 0) + space * (idx.length - 1)) / 2;
      idx.forEach((wi, k) => {
        items.push({ wi, x, y: centerY - (rows.length * lh) / 2 + ri * lh });
        x += ws[k] + space;
      });
    });
    return { size, items };
  }, [line.id, centerY]);
  if (t < line.start - 0.01 || t > out + 0.8) return null;
  const pout = clamp01((t - out) / 0.7);
  return (
    <div style={{ position: "absolute", inset: 0, opacity: 1 - pout, transform: `translateY(${-pout * 50 - Math.max(0, t - line.start) * 6}px)` }}>
      {lay.items.map((it) => {
        const dt = t - line.words[it.wi].s;
        if (dt < 0) return null;
        const p = cubicOut(clamp01(dt / 0.45));
        return (
          <div
            key={it.wi}
            style={{
              position: "absolute",
              left: it.x,
              top: it.y + (1 - p) * 24,
              fontFamily: fam,
              fontWeight: hand ? 500 : 400,
              fontSize: lay.size,
              lineHeight: 1,
              color,
              opacity: p,
              filter: `blur(${(1 - p) * 6}px)`,
              textShadow: `0 0 28px rgba(${glow},0.55)`,
              whiteSpace: "nowrap",
            }}
          >
            {words[it.wi]}
          </div>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------------------------------------
/** Background ad-lib: a whisper of tracked type, like the cover's subtitle. */
export const AdlibLine: React.FC<{ line: Line; t: number; x: number; y: number; color?: string; size?: number }> = ({ line, t, x, y, color = C.stone, size = 46 }) => {
  if (t < line.start - 0.01 || t > line.end + 1.2) return null;
  const pin = cubicOut(clamp01((t - line.start) / 0.25));
  const pout = clamp01((t - line.end - 0.4) / 0.8);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        fontFamily: F.cond,
        fontWeight: 300,
        fontSize: size,
        letterSpacing: "0.42em",
        color,
        opacity: pin * (1 - pout) * 0.9,
        transform: `translateX(${(1 - pin) * -20 + (t - line.start) * 8}px)`,
        filter: `blur(${pout * 4}px)`,
        whiteSpace: "nowrap",
      }}
    >
      {disp(line.text)}
    </div>
  );
};

export const CENTER_X = CX;
