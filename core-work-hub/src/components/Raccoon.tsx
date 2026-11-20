// The Core trash panda: an original inked-cartoon raccoon (pointy snout, bandit mask, cocked brow, ringed tail),
// drawn from reusable parts so it can strike several poses around the dumpster.
import type { ReactNode } from 'react';

const INK = '#17191d';
const FUR = '#9a9fa9';
const FUR_DK = '#6c717b';
const FUR_LT = '#c9ccd3';
const WHITE = '#f4f5f7';
const MASK = '#1d1f24';
const ink = { stroke: INK, strokeWidth: 2.6, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

/** Head centred on (0,0), about 104 wide. `look` shifts the pupils; `shades` for the fire scene. */
export function Head({ look = 0, shades = false, smirk = true, chew = false }: { look?: number; shades?: boolean; smirk?: boolean; chew?: boolean }) {
  return (
    <g>
      {/* ears */}
      <path d="M-30 -30 C-44 -52 -40 -70 -27 -72 C-14 -68 -8 -52 -12 -36 Z" fill={FUR} {...ink} />
      <path d="M-27 -38 C-35 -52 -32 -62 -26 -63 C-19 -59 -16 -50 -18 -42 Z" fill={MASK} />
      <path d="M30 -30 C44 -52 40 -70 27 -72 C14 -68 8 -52 12 -36 Z" fill={FUR} {...ink} />
      <path d="M27 -38 C35 -52 32 -62 26 -63 C19 -59 16 -50 18 -42 Z" fill={MASK} />
      {/* head with fluffy cheek tufts */}
      <path d="M-40 -6 C-44 -30 -26 -46 0 -46 C26 -46 44 -30 40 -6 L54 2 L42 8 L52 16 L38 18 L44 26 L28 26 C20 36 10 42 0 42 C-10 42 -20 36 -28 26 L-44 26 L-38 18 L-52 16 L-42 8 L-54 2 Z" fill={FUR} {...ink} />
      {/* darker forehead stripe */}
      <path d="M-12 -45 C-6 -32 -4 -18 0 -8 C4 -18 6 -32 12 -45 C4 -47 -4 -47 -12 -45 Z" fill={FUR_DK} />
      {/* white brows: the right one cocked */}
      <path d="M-38 -14 C-30 -26 -16 -27 -8 -19" stroke={WHITE} strokeWidth="7" strokeLinecap="round" fill="none" />
      <path d="M9 -24 C16 -34 30 -33 38 -21" stroke={WHITE} strokeWidth="7" strokeLinecap="round" fill="none" />
      {/* bandit mask */}
      <path d="M-50 4 C-44 -12 -28 -16 -13 -12 C-7 -10 -3 -6 0 -2 C3 -6 7 -10 13 -12 C28 -16 44 -12 50 4 C44 12 32 14 21 9 C13 6 7 8 0 13 C-7 8 -13 6 -21 9 C-32 14 -44 12 -50 4 Z" fill={MASK} />
      {/* eyes */}
      {shades ? (
        <g>
          <path d="M-36 -6 H-8 L-11 6 C-14 11 -30 11 -34 6 Z" fill="#0b0c0e" stroke="#333" strokeWidth="1.5" />
          <path d="M8 -6 H36 L34 6 C30 11 14 11 11 6 Z" fill="#0b0c0e" stroke="#333" strokeWidth="1.5" />
          <path d="M-8 -4 H8" stroke="#333" strokeWidth="2.5" />
          <path d="M-30 -3 L-22 -3" stroke="#fff" strokeOpacity="0.6" strokeWidth="2" strokeLinecap="round" />
          <path d="M14 -3 L22 -3" stroke="#fff" strokeOpacity="0.6" strokeWidth="2" strokeLinecap="round" />
        </g>
      ) : (
        <g className="eyes">
          <circle cx="-22" cy="-1" r="8" fill="#fff" />
          <circle cx="22" cy="-1" r="8" fill="#fff" />
          <g className="pupils" style={{ transform: `translateX(${look}px)` }}>
            <circle cx="-22" cy="0" r="5.2" fill="#0b0c0e" />
            <circle cx="22" cy="0" r="5.2" fill="#0b0c0e" />
            <circle cx="-23.8" cy="-2" r="1.8" fill="#fff" />
            <circle cx="20.2" cy="-2" r="1.8" fill="#fff" />
          </g>
          {/* half-lids: the smug look */}
          <path d="M-31 -5 Q-22 -12 -13 -5 L-13 -10 L-31 -10 Z" fill={MASK} />
          <path d="M13 -7 Q22 -13 31 -7 L31 -12 L13 -12 Z" fill={MASK} />
        </g>
      )}
      {/* pointy white muzzle */}
      <path d="M-18 10 C-14 3 14 3 18 10 C21 22 10 34 0 36 C-10 34 -21 22 -18 10 Z" fill={WHITE} {...ink} strokeWidth={2} />
      <path d="M-8 15 C-7 10 7 10 8 15 C7 21 -7 21 -8 15 Z" fill="#0b0c0e" />
      <ellipse cx="-2.5" cy="13" rx="2.2" ry="1.3" fill="#fff" opacity="0.7" />
      {chew ? (
        <path className="chew" d="M-7 26 Q0 31 7 26" stroke={INK} strokeWidth="2.4" fill="none" strokeLinecap="round" />
      ) : smirk ? (
        <g>
          <path d="M-7 25 Q2 31 10 22" stroke={INK} strokeWidth="2.4" fill="none" strokeLinecap="round" />
          <path d="M3 27 l2.2 4 l2.2 -4.6 z" fill="#fff" stroke={INK} strokeWidth="0.9" />
        </g>
      ) : (
        <path d="M-6 25 Q0 29 6 25" stroke={INK} strokeWidth="2.4" fill="none" strokeLinecap="round" />
      )}
      {/* whiskers */}
      <g stroke="#e4e6ea" strokeWidth="1.3" strokeLinecap="round">
        <path d="M-16 20 L-46 14 M-16 23 L-45 24 M-15 26 L-40 33" />
        <path d="M16 20 L46 14 M16 23 L45 24 M15 26 L40 33" />
      </g>
    </g>
  );
}

/** Dark little hand with fingers, centred on (0,0). */
export function Paw({ r = 0 }: { r?: number }) {
  return (
    <g transform={`rotate(${r})`}>
      <ellipse cx="0" cy="0" rx="10" ry="8" fill="#2a2c32" {...ink} strokeWidth={1.8} />
      <circle cx="-7" cy="-7" r="3.2" fill="#2a2c32" stroke={INK} strokeWidth="1.2" />
      <circle cx="-2" cy="-9.5" r="3.2" fill="#2a2c32" stroke={INK} strokeWidth="1.2" />
      <circle cx="3.5" cy="-9" r="3.2" fill="#2a2c32" stroke={INK} strokeWidth="1.2" />
      <circle cx="8" cy="-6" r="3" fill="#2a2c32" stroke={INK} strokeWidth="1.2" />
    </g>
  );
}

/** Bushy ringed tail from (0,0) curving along `curve` (quadratic: control, end). */
export function Tail({ c = [-40, -20], e = [-70, -70], rings = 6, w = 17 }: { c?: [number, number]; e?: [number, number]; rings?: number; w?: number }) {
  const pts = Array.from({ length: rings * 2 + 1 }, (_, k) => {
    const t = k / (rings * 2);
    const x = (1 - t) * (1 - t) * 0 + 2 * (1 - t) * t * c[0] + t * t * e[0];
    const y = (1 - t) * (1 - t) * 0 + 2 * (1 - t) * t * c[1] + t * t * e[1];
    const dx = 2 * (1 - t) * c[0] + 2 * t * (e[0] - c[0]);
    const dy = 2 * (1 - t) * c[1] + 2 * t * (e[1] - c[1]);
    return { x, y, a: (Math.atan2(dy, dx) * 180) / Math.PI, t };
  });
  return (
    <g>
      {pts.map((p, k) => (
        <ellipse key={k} cx={p.x} cy={p.y} rx={w * 0.62} ry={w * (1 - p.t * 0.25)} transform={`rotate(${p.a} ${p.x} ${p.y})`} fill={k % 2 || k === pts.length - 1 ? MASK : FUR} stroke={INK} strokeWidth="1.8" />
      ))}
    </g>
  );
}

/** Seated / standing body centred on (0,0) (shoulders at y≈-36). */
export function Body({ children }: { children?: ReactNode }) {
  return (
    <g>
      <path d="M-40 34 C-48 0 -36 -38 0 -42 C36 -38 48 0 40 34 C30 48 -30 48 -40 34 Z" fill={FUR} {...ink} />
      <path d="M-22 32 C-26 8 -18 -20 0 -22 C18 -20 26 8 22 32 C14 40 -14 40 -22 32 Z" fill={FUR_LT} />
      <g stroke={FUR_DK} strokeWidth="1.6" strokeLinecap="round" fill="none">
        <path d="M-30 -10 l-5 4 M-34 6 l-5 3 M30 -10 l5 4 M34 6 l5 3" />
      </g>
      {children}
    </g>
  );
}

/** A trash bag, centred on (0,0). */
export function Bag({ s = 1 }: { s?: number }) {
  return (
    <g transform={`scale(${s})`}>
      <ellipse cx="0" cy="2" rx="17" ry="15" fill="#33363d" {...ink} strokeWidth={2} />
      <path d="M-5 -12 L0 -21 L5 -12 Z" fill="#33363d" stroke={INK} strokeWidth="1.6" />
      <path d="M-3 -21 l-5 -4 M3 -21 l5 -4" stroke={INK} strokeWidth="2" strokeLinecap="round" />
      <path d="M-9 -2 q5 -6 10 -2" stroke="#fff" strokeOpacity="0.18" strokeWidth="3" fill="none" strokeLinecap="round" />
    </g>
  );
}

export function Pizza() {
  return (
    <g>
      <path d="M0 0 L26 -8 L20 16 Z" fill="#f2c14e" stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M0 0 L26 -8" stroke="#c98a3c" strokeWidth="5" strokeLinecap="round" />
      <circle cx="14" cy="2" r="2.6" fill="#c0392b" />
      <circle cx="18" cy="9" r="2.2" fill="#c0392b" />
    </g>
  );
}

export const RIM_Y = 146;
