import { hexToLinear } from './util';

// RUDO palette (docs/STYLE.md): the concrete room, one warm light. No other hues.
// Only lamp/ember may exceed ~0.85 linear (bloom). Bone type stays crisp.
export const HEX = {
  ink: '#0B0B0C', // background
  concrete: '#2A2826', // the lit wall, panels
  dust: '#8F8A82', // secondary type, hairlines at rest
  bone: '#E3DED4', // paper, lyric type
  lamp: '#E8A04A', // THE signal colour: the sung word, the amber point, every screen glow
  ember: '#C76A1E', // hot cores inside lamp glow
  dawn: '#F4C27A', // rare accent, owned by one moment per song (Drift: the outro)
} as const;

export type PaletteKey = keyof typeof HEX;

/** Linear RGB triplets for GL uniforms. */
export const LIN: Record<PaletteKey, [number, number, number]> = Object.fromEntries(
  Object.entries(HEX).map(([k, v]) => [k, hexToLinear(v)]),
) as Record<PaletteKey, [number, number, number]>;

/** CSS rgba() for Canvas2D. */
export function rgba(key: PaletteKey | string, a = 1): string {
  const hex = (HEX as Record<string, string>)[key] ?? key;
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
