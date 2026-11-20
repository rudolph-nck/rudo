// Scraps, the Core trash panda ("02 · Sneaky heister" design): bandana, loot sack, tiptoes, paw to lips.
// Shapes and colours follow the design reference exactly; drawn in its 400×400 coordinates (head centre 200,150).
const INK = '#2A2C33';
export const FUR = '#8C909B';
const BELLY = '#DDE0E5';
const MUZZLE = '#F3F4F6';
const PINK = '#F4A3B4';
const BANDANA = '#E0574F';
const SACK = '#3E4A5C';
const SACK_HI = '#5A6880';

/** Head (ears, cheek tufts, mask, eyes, nose, smirk, whiskers). look: pupil shift (design: -10, glancing left). */
export function ScrapsHead({ look = -10, shades = false, chew = false, grin = false }: { look?: number; shades?: boolean; chew?: boolean; grin?: boolean }) {
  return (
    <g>
      <ellipse cx="130" cy="86" rx="24" ry="36" transform="rotate(-22 130 86)" fill={FUR} />
      <ellipse cx="132" cy="90" rx="12" ry="21" transform="rotate(-22 132 90)" fill={PINK} />
      <g className="sc-ear" style={{ transformOrigin: '262px 110px' }}>
        <ellipse cx="270" cy="86" rx="24" ry="36" transform="rotate(22 270 86)" fill={FUR} />
        <ellipse cx="268" cy="90" rx="12" ry="21" transform="rotate(22 268 90)" fill={PINK} />
      </g>
      <path d="M114 150 L90 168 L114 172 L98 190 L128 186 Z" fill={FUR} />
      <path d="M286 150 L310 168 L286 172 L302 190 L272 186 Z" fill={FUR} />
      <ellipse cx="200" cy="150" rx="92" ry="74" fill={FUR} />
      <ellipse cx="200" cy="180" rx="62" ry="38" fill={MUZZLE} />
      <path d="M190 80 Q200 75 210 80 L205 128 L195 128 Z" fill={INK} />
      <ellipse cx="158" cy="116" rx="24" ry="8" fill={MUZZLE} transform="rotate(8 158 116)" />
      <ellipse cx="242" cy="116" rx="24" ry="8" fill={MUZZLE} transform="rotate(-8 242 116)" />
      <path d="M112 148 Q130 115 170 128 Q190 134 200 146 Q210 134 230 128 Q270 115 288 148 Q278 178 240 177 Q215 175 200 164 Q185 175 160 177 Q122 178 112 148 Z" fill={INK} />
      {shades ? (
        <g>
          <path d="M136 138 H190 L186 160 C182 170 146 170 140 160 Z" fill="#0b0c0e" />
          <path d="M210 138 H264 L260 160 C254 170 218 170 214 160 Z" fill="#0b0c0e" />
          <path d="M190 142 H210" stroke="#0b0c0e" strokeWidth="5" />
          <path d="M146 146 L162 146 M220 146 L236 146" stroke="#fff" strokeOpacity="0.55" strokeWidth="4" strokeLinecap="round" />
        </g>
      ) : (
        <g className="sc-blink" style={{ transformOrigin: '200px 150px' }}>
          <circle cx="162" cy="150" r="19" fill="#FFFFFF" />
          <circle cx="238" cy="150" r="19" fill="#FFFFFF" />
          <g className="sc-pupils" style={{ transform: `translateX(${look + 10}px)` }}>
            <circle cx="152" cy="151" r="11" fill={INK} />
            <circle cx="155" cy="146" r="3.5" fill="#FFFFFF" />
            <circle cx="228" cy="151" r="11" fill={INK} />
            <circle cx="231" cy="146" r="3.5" fill="#FFFFFF" />
          </g>
        </g>
      )}
      <ellipse cx="136" cy="186" rx="11" ry="6" fill={PINK} opacity=".75" />
      <ellipse cx="264" cy="186" rx="11" ry="6" fill={PINK} opacity=".75" />
      <ellipse cx="200" cy="181" rx="12" ry="8" fill={INK} />
      <ellipse cx="196" cy="178" rx="3" ry="1.6" fill="#FFFFFF" />
      {chew ? (
        <path className="sc-chew" d="M190 198 Q200 206 210 198" fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
      ) : grin ? (
        <path d="M184 196 Q200 214 218 196" fill="#7a2f33" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
      ) : (
        <path d="M200 198 Q214 208 226 194" fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
      )}
      <g stroke={INK} strokeWidth="2" strokeLinecap="round" opacity=".45">
        <line x1="232" y1="184" x2="272" y2="178" />
        <line x1="232" y1="190" x2="270" y2="194" />
        <line x1="168" y1="184" x2="128" y2="178" />
      </g>
    </g>
  );
}

/** Ringed tail as in the design: a thick fur stroke with dark dashes and a dark tip. */
export function ScrapsTail({ d, tip }: { d: string; tip: [number, number] }) {
  return (
    <g>
      <path d={d} fill="none" stroke={FUR} strokeWidth="32" strokeLinecap="round" />
      <path d={d} fill="none" stroke={INK} strokeWidth="32" strokeDasharray="14 15" />
      <circle cx={tip[0]} cy={tip[1]} r="16" fill={INK} />
    </g>
  );
}

export function Sack({ x = 0, y = 0 }: { x?: number; y?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M256 112 Q332 78 352 140 Q366 204 300 208 Q244 208 254 150 Z" fill={SACK} />
      <path d="M300 112 Q338 120 342 160" fill="none" stroke={SACK_HI} strokeWidth="7" strokeLinecap="round" />
      <ellipse cx="248" cy="106" rx="14" ry="8" fill={SACK} transform="rotate(-35 248 106)" />
      <ellipse cx="262" cy="96" rx="13" ry="7" fill={SACK} transform="rotate(30 262 96)" />
    </g>
  );
}

const Bandana = () => (
  <g>
    <path d="M150 198 Q200 222 250 198 L242 216 Q200 238 158 216 Z" fill={BANDANA} />
    <path d="M172 212 L200 262 L228 212 Z" fill={BANDANA} />
    <circle cx="190" cy="226" r="3" fill="#FFFFFF" />
    <circle cx="208" cy="236" r="3" fill="#FFFFFF" />
    <circle cx="199" cy="248" r="3" fill="#FFFFFF" />
    <circle cx="168" cy="210" r="3" fill="#FFFFFF" />
    <circle cx="234" cy="210" r="3" fill="#FFFFFF" />
  </g>
);

const Paw = ({ x, y, rx = 11, ry = 9 }: { x: number; y: number; rx?: number; ry?: number }) => <ellipse cx={x} cy={y} rx={rx} ry={ry} fill={INK} />;

/**
 * Full body in design coordinates (feet on y≈372).
 * sneak: the design pose (sack over the shoulder, paw to lips). toss: sack-arm thrown forward, no sack.
 * fire: sack set down, marshmallow stick, shades. sit: legs forward (for sitting on the rim).
 */
export function ScrapsFigure({ variant, look = -10, grin = false }: { variant: 'sneak' | 'toss' | 'fire' | 'sit'; look?: number; grin?: boolean }) {
  const sit = variant === 'sit';
  return (
    <g>
      <g className="sc-tail" style={{ transformOrigin: '150px 300px' }}>
        <ScrapsTail d={sit ? 'M160 310 Q120 350 130 400 Q136 430 120 450' : 'M155 300 Q85 302 72 245 Q66 205 96 186'} tip={sit ? [120, 450] : [96, 186]} />
      </g>
      {variant === 'sneak' && <g className="sc-sack"><Sack /></g>}
      {variant === 'fire' && <Sack x={-170} y={160} />}
      {sit ? (
        <g>
          <path d="M184 326 L178 380" stroke={FUR} strokeWidth="20" strokeLinecap="round" />
          <path d="M218 326 L224 382" stroke={FUR} strokeWidth="20" strokeLinecap="round" />
          <Paw x={176} y={388} rx={10} ry={14} />
          <Paw x={226} y={390} rx={10} ry={14} />
        </g>
      ) : (
        <g>
          <path d="M186 326 L176 370" stroke={FUR} strokeWidth="20" strokeLinecap="round" />
          <path d="M216 326 L232 366" stroke={FUR} strokeWidth="20" strokeLinecap="round" />
          <ellipse cx="172" cy="374" rx="16" ry="8" fill={INK} transform="rotate(-15 172 374)" />
          <ellipse cx="238" cy="370" rx="16" ry="8" fill={INK} transform="rotate(-25 238 370)" />
        </g>
      )}
      <ellipse cx="200" cy="272" rx="58" ry="68" fill={FUR} />
      <ellipse cx="200" cy="288" rx="36" ry="46" fill={BELLY} />
      {variant === 'sneak' && (
        <g>
          <path d="M236 234 Q262 190 256 122" fill="none" stroke={FUR} strokeWidth="22" strokeLinecap="round" />
          <Paw x={256} y={118} rx={14} ry={12} />
        </g>
      )}
      {variant === 'toss' && (
        <g className="sc-throw" style={{ transformOrigin: '236px 234px' }}>
          <path d="M236 234 Q262 190 256 122" fill="none" stroke={FUR} strokeWidth="22" strokeLinecap="round" />
          <Paw x={256} y={118} rx={14} ry={12} />
        </g>
      )}
      {variant === 'fire' && (
        <g>
          <path d="M240 240 Q290 228 320 200" fill="none" stroke={FUR} strokeWidth="22" strokeLinecap="round" />
          <Paw x={324} y={196} rx={13} ry={11} />
          <path d="M330 190 L470 110" stroke="#8d5a2b" strokeWidth="6" strokeLinecap="round" />
          <g className="sc-toast"><ellipse cx="476" cy="106" rx="15" ry="12" fill="#fff4e0" stroke="#d9a94e" strokeWidth="3" /></g>
        </g>
      )}
      <Bandana />
      <g className="sc-head" style={{ transformOrigin: '200px 220px' }}>
        <ScrapsHead look={look} shades={variant === 'fire'} chew={sit} grin={grin} />
      </g>
      {variant === 'sneak' && (
        <g>
          <g stroke={INK} strokeWidth="3" strokeLinecap="round" opacity=".35">
            <line x1="330" y1="250" x2="360" y2="250" />
            <line x1="320" y1="270" x2="356" y2="270" />
            <line x1="330" y1="290" x2="352" y2="290" />
          </g>
          {/* paw to lips: shh */}
          <path d="M156 246 Q140 226 176 204" fill="none" stroke={FUR} strokeWidth="18" strokeLinecap="round" />
          <Paw x={183} y={204} />
          <ellipse cx="187" cy="191" rx="4.5" ry="11" fill={INK} />
        </g>
      )}
      {sit && (
        <g className="sc-munch">
          <path d="M156 246 Q140 226 170 208" fill="none" stroke={FUR} strokeWidth="18" strokeLinecap="round" />
          <g transform="translate(150 196) rotate(-30)">
            <path d="M0 0 L40 -12 L31 24 Z" fill="#f2c14e" />
            <path d="M0 0 L40 -12" stroke="#c98a3c" strokeWidth="8" strokeLinecap="round" />
            <circle cx="21" cy="3" r="4" fill="#c0392b" />
            <circle cx="27" cy="13" r="3.4" fill="#c0392b" />
          </g>
          <Paw x={172} y={208} />
        </g>
      )}
      {(variant === 'toss' || variant === 'fire' || sit) && (
        <g>
          {variant !== 'sit' && <path d="M164 240 Q140 270 150 300" fill="none" stroke={FUR} strokeWidth="18" strokeLinecap="round" />}
          {variant !== 'sit' && <Paw x={152} y={304} />}
        </g>
      )}
    </g>
  );
}
