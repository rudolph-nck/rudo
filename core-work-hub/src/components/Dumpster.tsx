// The trash panda and the dumpster: fills as tickets close; on fire when a goal is hit. Original art, inline SVG.
import { useEffect, useState } from 'react';
import { FUR, Sack, ScrapsFigure, ScrapsHead, ScrapsTail } from './Scraps';

type Pose = 'sneak' | 'peek' | 'sit' | 'dive' | 'toss' | 'fire';
const IDLE: Pose[] = ['sneak', 'peek', 'toss', 'sit', 'dive'];

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
  const [idle, setIdle] = useState(0);
  useEffect(() => {
    if (fire) return;
    const t = setInterval(() => setIdle((x) => (x + 1) % IDLE.length), 7000);
    return () => clearInterval(t);
  }, [fire]);
  const pose: Pose = fire ? 'fire' : tossing ? 'toss' : IDLE[idle];
  useEffect(() => {
    if (!drops) return;
    setTossing(true);
    const t = setTimeout(() => setTossing(false), 1400 + Math.min(drops, 8) * 260);
    return () => clearTimeout(t);
  }, [drops]);
  return (
    <svg className={`dumpster-scene ${fire ? 'on-fire' : ''}`} viewBox="0 -60 520 360" role="img" aria-label={label}>
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

      {/* The trash panda (poses rotate; tossing on new closes; shades and a marshmallow when on fire) */}
      <PandaPose pose={pose} />
    </svg>
  );
}

const S = 0.6; // Scraps' scale in the scene (design is 400 units tall)
const INK = '#2A2C33';

function PandaPose({ pose }: { pose: Pose }) {
  if (pose === 'peek')
    return (
      <g key="peek" className="pose pose-peek">
        <clipPath id="above-rim"><rect x="0" y="-60" width="520" height="206" /></clipPath>
        <g clipPath="url(#above-rim)">
          <g className="tail-wag" style={{ transformOrigin: '448px 150px' }}>
            <g transform={`translate(448 152) scale(${S})`}><ScrapsTail d="M0 0 Q36 -60 12 -126" tip={[12, -126]} /></g>
          </g>
          <g className="peek-pop"><g transform={`translate(${352 - S * 200} ${104 - S * 150}) scale(${S})`}><ScrapsHead look={0} /></g></g>
        </g>
        <ellipse cx="318" cy="143" rx="10" ry="8" fill={INK} />
        <ellipse cx="388" cy="143" rx="10" ry="8" fill={INK} />
      </g>
    );
  if (pose === 'sit')
    return (
      <g key="sit" className="pose pose-sit">
        <g transform={`translate(${300 - S * 200} ${146 - S * 334}) scale(${S})`}><ScrapsFigure variant="sit" look={-4} /></g>
      </g>
    );
  if (pose === 'dive')
    return (
      <g key="dive" className="pose pose-dive">
        <clipPath id="above-rim2"><rect x="0" y="-60" width="520" height="204" /></clipPath>
        <g clipPath="url(#above-rim2)">
          <g transform={`translate(360 150) scale(${S})`}>
            <g className="tail-wag" style={{ transformOrigin: '0px -60px' }}><ScrapsTail d="M0 -60 Q44 -130 14 -205" tip={[14, -205]} /></g>
            <ellipse cx="0" cy="-26" rx="60" ry="52" fill={FUR} />
            <g className="kick-l" style={{ transformOrigin: '-24px -60px' }}>
              <path d="M-24 -60 L-40 -128" stroke={FUR} strokeWidth="28" strokeLinecap="round" />
              <ellipse cx="-42" cy="-136" rx="22" ry="12" fill={INK} transform="rotate(-70 -42 -136)" />
            </g>
            <g className="kick-r" style={{ transformOrigin: '24px -60px' }}>
              <path d="M24 -60 L40 -128" stroke={FUR} strokeWidth="28" strokeLinecap="round" />
              <ellipse cx="42" cy="-136" rx="22" ry="12" fill={INK} transform="rotate(70 42 -136)" />
            </g>
          </g>
        </g>
        <g className="fly fly1"><rect x="330" y="120" width="16" height="11" rx="2" fill="#c98a3c" /></g>
        <g className="fly fly2"><rect x="380" y="118" width="9" height="15" rx="2" fill="#c0392b" /></g>
        <g className="fly fly3"><circle cx="356" cy="122" r="7" fill="#e8d9b0" /></g>
      </g>
    );
  if (pose === 'fire')
    return (
      <g key="fire" className="pose pose-fire">
        <g transform={`translate(${130 - S * 200} ${268 - S * 372}) scale(${S})`}><ScrapsFigure variant="fire" grin /></g>
      </g>
    );
  // sneak (the design pose) and toss face the dumpster: mirrored
  const X = 150 + S * 200;
  const Y = 268 - S * 372;
  return (
    <g key={pose} className={`pose pose-${pose}`}>
      <g transform={`translate(${X} ${Y}) scale(${-S} ${S})`}>
        <g className={pose === 'sneak' ? 'sc-tiptoe' : ''}><ScrapsFigure variant={pose === 'sneak' ? 'sneak' : 'toss'} look={pose === 'sneak' ? -10 : -6} /></g>
      </g>
      {pose === 'toss' && (
        <g className="toss-sack"><g transform={`translate(${X} ${Y}) scale(${-S} ${S})`}><Sack /></g></g>
      )}
    </g>
  );
}
