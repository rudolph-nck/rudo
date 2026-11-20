// The trash panda and the dumpster: fills as tickets close; on fire when a goal is hit. Original art, inline SVG.
import { useEffect, useState } from 'react';

const TRASH = [
  // [x, y, kind, color] inside the dumpster (x 250-470, y 150-255 from the bottom up)
  [262, 240, 'bag', '#3b3f48'], [298, 244, 'box', '#c98a3c'], [336, 238, 'bag', '#2d3139'], [372, 246, 'can', '#c0392b'], [404, 240, 'bag', '#454a54'], [440, 243, 'box', '#d9a94e'],
  [276, 218, 'can', '#2e86c1'], [312, 214, 'bag', '#3b3f48'], [350, 220, 'box', '#b8773a'], [388, 214, 'bag', '#2d3139'], [424, 220, 'can', '#27ae60'], [455, 214, 'bag', '#454a54'],
  [266, 192, 'box', '#c98a3c'], [302, 190, 'bag', '#2d3139'], [340, 194, 'can', '#c0392b'], [378, 188, 'bag', '#454a54'], [414, 194, 'box', '#d9a94e'], [450, 190, 'bag', '#3b3f48'],
  [282, 166, 'bag', '#454a54'], [320, 162, 'box', '#b8773a'], [358, 168, 'bag', '#2d3139'], [396, 162, 'can', '#2e86c1'], [432, 168, 'bag', '#3b3f48'],
] as const;

function Junk({ x, y, kind, color }: { x: number; y: number; kind: string; color: string }) {
  if (kind === 'bag')
    return (
      <g>
        <ellipse cx={x} cy={y} rx="17" ry="14" fill={color} />
        <path d={`M${x - 4} ${y - 13} l4 -6 l4 6 z`} fill={color} />
        <ellipse cx={x - 5} cy={y - 4} rx="5" ry="3" fill="#ffffff" opacity="0.12" />
      </g>
    );
  if (kind === 'can')
    return (
      <g>
        <rect x={x - 7} y={y - 12} width="14" height="22" rx="3" fill={color} />
        <rect x={x - 7} y={y - 6} width="14" height="5" fill="#ffffff" opacity="0.5" />
      </g>
    );
  return (
    <g transform={`rotate(-8 ${x} ${y})`}>
      <rect x={x - 16} y={y - 10} width="32" height="20" rx="2" fill={color} />
      <path d={`M${x - 16} ${y - 4} h32`} stroke="#000" strokeOpacity="0.15" />
    </g>
  );
}

/** pct 0..1 of the current goal. `fire` = goal reached. `drops` = trash falling in now (new closes). */
export function DumpsterScene({ pct, fire, drops = 0, label }: { pct: number; fire: boolean; drops?: number; label: string }) {
  const fill = Math.max(0, Math.min(1, pct));
  const shown = Math.round(fill * TRASH.length);
  const [tossing, setTossing] = useState(drops > 0);
  useEffect(() => {
    if (!drops) return;
    setTossing(true);
    const t = setTimeout(() => setTossing(false), 1400 + Math.min(drops, 8) * 260);
    return () => clearTimeout(t);
  }, [drops]);
  return (
    <svg className={`dumpster-scene ${fire ? 'on-fire' : ''}`} viewBox="0 0 520 300" role="img" aria-label={label}>
      <defs>
        <clipPath id="bin-inside">
          <path d="M250 142 L470 142 L458 258 L262 258 Z" />
        </clipPath>
        <radialGradient id="fire-glow" cx="50%" cy="60%" r="60%">
          <stop offset="0%" stopColor="#ffb347" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#ffb347" stopOpacity="0" />
        </radialGradient>
      </defs>

      {fire && <ellipse cx="360" cy="140" rx="210" ry="140" fill="url(#fire-glow)" className="glow" />}
      <ellipse cx="300" cy="276" rx="230" ry="12" fill="#000" opacity="0.12" />

      {/* Dumpster back, trash, front */}
      <path d="M244 134 L476 134 L470 146 L250 146 Z" fill="#1f5a39" />
      <g clipPath="url(#bin-inside)">
        <rect x="244" y="140" width="232" height="120" fill="#16402a" />
        {TRASH.slice(0, shown).map(([x, y, kind, color], i) => (
          <Junk key={i} x={x} y={y} kind={kind} color={color} />
        ))}
      </g>
      <path d="M250 146 L470 146 L458 258 L262 258 Z" fill="none" stroke="#174a2f" strokeWidth="2" />
      {/* Cut-away front: see-through so the trash level shows */}
      <path d="M252 168 L468 168 L458 258 L262 258 Z" fill="#2f7d4f" fillOpacity="0.38" />
      <path d="M252 168 L468 168 L458 258 L262 258 Z" fill="none" stroke="#2f7d4f" strokeWidth="5" />
      <path d="M262 188 L458 188 M266 214 L454 214 M270 238 L450 238" stroke="#2f7d4f" strokeWidth="3" strokeOpacity="0.55" />
      <rect x="330" y="196" width="60" height="26" rx="4" fill="#256a41" />
      <text x="360" y="214" textAnchor="middle" fontSize="13" fontWeight="800" fill="#bfe8cf" fontFamily="inherit">CORE</text>
      <circle cx="280" cy="264" r="9" fill="#2b2e35" />
      <circle cx="440" cy="264" r="9" fill="#2b2e35" />
      {/* lid, propped open */}
      <path d="M246 132 L474 132 L462 96 L258 104 Z" fill="#358a58" />
      <path d="M258 104 L462 96" stroke="#2a6e46" strokeWidth="3" />

      {/* Fire */}
      {fire && (
        <g className="flames">
          <path className="flame f1" d="M290 150 C270 110 300 90 296 60 C320 90 330 110 318 150 Z" fill="#e8491d" />
          <path className="flame f2" d="M330 152 C305 95 345 70 340 30 C375 70 385 105 370 152 Z" fill="#f39c12" />
          <path className="flame f3" d="M378 152 C360 105 392 85 390 50 C418 85 425 115 410 152 Z" fill="#e8491d" />
          <path className="flame f4" d="M420 150 C405 115 430 100 428 74 C448 100 452 125 440 150 Z" fill="#f39c12" />
          <path className="flame f5" d="M345 152 C335 120 355 105 352 85 C372 110 376 130 366 152 Z" fill="#ffd166" />
          <path className="flame f6" d="M395 152 C386 128 400 118 398 102 C414 120 416 136 408 152 Z" fill="#ffd166" />
          <circle className="smoke s1" cx="330" cy="40" r="12" fill="#8a8f99" opacity="0.4" />
          <circle className="smoke s2" cx="380" cy="30" r="16" fill="#8a8f99" opacity="0.35" />
          <circle className="smoke s3" cx="420" cy="50" r="10" fill="#8a8f99" opacity="0.3" />
        </g>
      )}

      {/* Falling trash for new closes */}
      {tossing &&
        Array.from({ length: Math.min(drops, 8) }, (_, i) => (
          <g key={i} className="drop" style={{ animationDelay: `${0.3 + i * 0.26}s` }}>
            <Junk x={300 + ((i * 47) % 150)} y={0} kind={['bag', 'can', 'box'][i % 3]} color={['#3b3f48', '#c0392b', '#c98a3c'][i % 3]} />
          </g>
        ))}

      {/* The trash panda */}
      <g className={`panda ${fire ? 'toasting' : tossing ? 'tossing' : 'idle'}`}>
        {/* tail */}
        <g transform="rotate(-25 92 236)">
          <ellipse cx="62" cy="236" rx="38" ry="15" fill="#8b909b" />
          <ellipse cx="44" cy="236" rx="7" ry="14" fill="#33363d" />
          <ellipse cx="62" cy="236" rx="7" ry="15" fill="#33363d" />
          <ellipse cx="80" cy="236" rx="7" ry="15" fill="#33363d" />
          <ellipse cx="27" cy="236" rx="6" ry="11" fill="#33363d" />
        </g>
        {/* body */}
        <ellipse cx="135" cy="222" rx="50" ry="48" fill="#8b909b" />
        <ellipse cx="138" cy="232" rx="30" ry="32" fill="#d3d6dc" />
        {/* feet */}
        <ellipse cx="112" cy="268" rx="16" ry="8" fill="#33363d" />
        <ellipse cx="160" cy="268" rx="16" ry="8" fill="#33363d" />
        {/* arm reaching to the dumpster (or holding the marshmallow stick) */}
        <g className="arm">
          <path d="M168 200 Q200 178 228 162" stroke="#7e838e" strokeWidth="16" strokeLinecap="round" fill="none" />
          <circle cx="230" cy="161" r="9" fill="#33363d" />
          {fire ? (
            <g>
              <path d="M232 160 L300 120" stroke="#8d5a2b" strokeWidth="4" strokeLinecap="round" />
              <ellipse cx="304" cy="117" rx="9" ry="7" fill="#fff4e0" stroke="#d9a94e" strokeWidth="2" />
            </g>
          ) : (
            <g className="held-bag">
              <ellipse cx="238" cy="146" rx="16" ry="13" fill="#3b3f48" />
              <path d="M234 134 l4 -7 l4 7 z" fill="#3b3f48" />
            </g>
          )}
        </g>
        {/* head */}
        <g className="head">
          <ellipse cx="104" cy="112" rx="13" ry="16" fill="#8b909b" transform="rotate(-20 104 112)" />
          <ellipse cx="104" cy="114" rx="6" ry="9" fill="#33363d" transform="rotate(-20 104 114)" />
          <ellipse cx="166" cy="112" rx="13" ry="16" fill="#8b909b" transform="rotate(20 166 112)" />
          <ellipse cx="166" cy="114" rx="6" ry="9" fill="#33363d" transform="rotate(20 166 114)" />
          <ellipse cx="135" cy="146" rx="44" ry="38" fill="#9aa0aa" />
          {/* white brows and cheeks */}
          <path d="M100 136 Q112 124 128 132" stroke="#f1f2f4" strokeWidth="6" strokeLinecap="round" fill="none" />
          <path d="M142 132 Q158 124 170 136" stroke="#f1f2f4" strokeWidth="6" strokeLinecap="round" fill="none" />
          <ellipse cx="135" cy="163" rx="25" ry="16" fill="#f1f2f4" />
          {/* bandit mask */}
          <path d="M96 150 Q104 136 122 142 Q135 148 148 142 Q166 136 174 150 Q168 162 152 158 Q135 154 118 158 Q102 162 96 150 Z" fill="#2b2e35" />
          <circle className="eye" cx="116" cy="149" r="5.5" fill="#fff" />
          <circle className="eye" cx="154" cy="149" r="5.5" fill="#fff" />
          <circle cx="117" cy="150" r="2.8" fill="#111" />
          <circle cx="155" cy="150" r="2.8" fill="#111" />
          <ellipse cx="135" cy="162" rx="7" ry="5" fill="#2b2e35" />
          <path d={fire ? 'M126 170 Q135 180 144 170' : 'M128 171 Q135 176 142 171'} stroke="#2b2e35" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </g>
      </g>
    </svg>
  );
}
