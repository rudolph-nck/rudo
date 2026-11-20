// Per-person appearance: light/dark mode and a colour theme (preset or custom accent + background tint).
// Saved with profile.set so it follows the person to any PC; cached locally so the page paints in the right colours.

export type Mode = 'auto' | 'light' | 'dark';
export type Tint = 'cool' | 'neutral' | 'warm';
export interface Appearance {
  mode?: Mode;
  /** Preset id, or 'custom'. */
  palette?: string;
  /** Custom accent (#rrggbb). */
  accent?: string;
  tint?: Tint;
  /** Quieter bucket colours (neutral themes). */
  muted?: boolean;
}
export interface Palette {
  id: string;
  name: string;
  accent: string;
  tint: Tint;
  muted?: boolean;
  group: 'Colourful' | 'Neutral';
}

export const PALETTES: Palette[] = [
  { id: 'indigo', name: 'Indigo', accent: '#3346d3', tint: 'cool', group: 'Colourful' },
  { id: 'ocean', name: 'Ocean', accent: '#0b7285', tint: 'cool', group: 'Colourful' },
  { id: 'forest', name: 'Forest', accent: '#2f7d4f', tint: 'neutral', group: 'Colourful' },
  { id: 'plum', name: 'Plum', accent: '#7b3fa0', tint: 'cool', group: 'Colourful' },
  { id: 'ember', name: 'Ember', accent: '#c2410c', tint: 'warm', group: 'Colourful' },
  { id: 'slate', name: 'Slate', accent: '#475569', tint: 'cool', muted: true, group: 'Neutral' },
  { id: 'graphite', name: 'Graphite', accent: '#3f3f46', tint: 'neutral', muted: true, group: 'Neutral' },
  { id: 'sand', name: 'Sand', accent: '#7c6a55', tint: 'warm', muted: true, group: 'Neutral' },
];
export const DEFAULT_PALETTE = 'indigo';

const HEX = /^#[0-9a-f]{6}$/i;
const MODES: Mode[] = ['auto', 'light', 'dark'];
const TINTS: Tint[] = ['cool', 'neutral', 'warm'];

/** Keep only valid fields (anything from a change file is untrusted). */
export function cleanAppearance(a: unknown): Appearance | undefined {
  if (!a || typeof a !== 'object') return undefined;
  const x = a as Record<string, unknown>;
  const out: Appearance = {};
  if (MODES.includes(x.mode as Mode)) out.mode = x.mode as Mode;
  if (x.palette === 'custom' || PALETTES.some((p) => p.id === x.palette)) out.palette = x.palette as string;
  if (typeof x.accent === 'string' && HEX.test(x.accent)) out.accent = x.accent.toLowerCase();
  if (TINTS.includes(x.tint as Tint)) out.tint = x.tint as Tint;
  if (typeof x.muted === 'boolean') out.muted = x.muted;
  return Object.keys(out).length ? out : undefined;
}

/** The accent, tint and muted setting a person's appearance resolves to. */
export function resolveTheme(a?: Appearance): { accent: string; tint: Tint; muted: boolean; isDefault: boolean } {
  const p = PALETTES.find((x) => x.id === (a?.palette ?? DEFAULT_PALETTE));
  if (a?.palette === 'custom' && a.accent) return { accent: a.accent, tint: a.tint ?? 'cool', muted: !!a.muted, isDefault: false };
  const pal = p ?? PALETTES[0];
  return { accent: pal.accent, tint: pal.tint, muted: !!pal.muted, isDefault: pal.id === DEFAULT_PALETTE };
}

// ---- colour maths
type RGB = [number, number, number];
const rgb = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
const hex = (c: RGB) => '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
export const mix = (a: string, b: string, t: number) => { const x = rgb(a), y = rgb(b); return hex([0, 1, 2].map((i) => x[i] + (y[i] - x[i]) * t) as RGB); };
const lum = (h: string) => { const c = rgb(h).map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
export const contrast = (a: string, b: string) => { const [l1, l2] = [lum(a), lum(b)].sort((p, q) => q - p); return (l1 + 0.05) / (l2 + 0.05); };
/** Move `c` toward `to` until it reaches `ratio` against `bg`. */
function until(c: string, to: string, bg: string, ratio: number) {
  for (let t = 0; t <= 1.0001; t += 0.04) { const m = mix(c, to, t); if (contrast(m, bg) >= ratio) return m; }
  return to;
}
const rgba = (h: string, a: number) => `rgba(${rgb(h).join(', ')}, ${a})`;

const SURFACES: Record<Tint, { light: string[]; dark: string[] }> = {
  // bg, surface, surface-2, surface-3, border, border-strong
  cool: { light: ['#f5f7fa', '#ffffff', '#eef1f6', '#e4e8ef', '#e1e6ee', '#c9d0db'], dark: ['#0e1117', '#171b24', '#1e2330', '#283043', '#2a3142', '#3a4357'] },
  neutral: { light: ['#f6f6f6', '#ffffff', '#efefef', '#e5e5e5', '#e3e3e3', '#cccccc'], dark: ['#111111', '#1a1a1a', '#222222', '#2c2c2c', '#2e2e2e', '#424242'] },
  warm: { light: ['#f7f5f2', '#fffefc', '#f0ece6', '#e6e1d9', '#e5dfd6', '#cfc7bb'], dark: ['#13110f', '#1c1916', '#24201c', '#2e2924', '#332d27', '#483f37'] },
};

function vars(accent: string, tint: Tint, muted: boolean, dark: boolean): string {
  const s = SURFACES[tint][dark ? 'dark' : 'light'];
  const [bg, surface, s2, s3, border, strong] = s;
  const v: Record<string, string> = { '--bg': bg, '--surface': surface, '--surface-2': s2, '--surface-3': s3, '--border': border, '--border-strong': strong };
  if (!dark) {
    const acc = until(accent, '#000000', '#ffffff', 3.2);
    Object.assign(v, {
      '--accent': acc,
      '--accent-hover': mix(acc, '#000000', 0.15),
      '--accent-text': until(acc, '#000000', '#ffffff', 4.8),
      '--accent-soft': mix(acc, '#ffffff', 0.9),
      '--on-accent': contrast(acc, '#ffffff') >= 4.5 ? '#ffffff' : '#111111',
      '--focus': `0 0 0 3px ${rgba(acc, 0.35)}`,
      '--p3-bg': mix(acc, '#ffffff', 0.88),
      '--p3-fg': until(acc, '#000000', mix(acc, '#ffffff', 0.88), 5),
    });
    if (muted) Object.assign(v, { '--b-project': '#5b6b8c', '--b-maintenance': '#4c7d76', '--b-support': '#9a6a3a' });
  } else {
    const acc = until(accent, '#ffffff', surface, 3.2);
    Object.assign(v, {
      '--accent': acc,
      '--accent-hover': mix(acc, '#000000', 0.12),
      '--accent-text': until(acc, '#ffffff', surface, 6),
      '--accent-soft': mix(acc, surface, 0.78),
      '--on-accent': contrast(acc, '#ffffff') >= 4.5 ? '#ffffff' : '#0b0b0b',
      '--focus': `0 0 0 3px ${rgba(acc, 0.45)}`,
      '--p3-bg': mix(acc, surface, 0.75),
      '--p3-fg': until(acc, '#ffffff', mix(acc, surface, 0.75), 6),
    });
    if (muted) Object.assign(v, { '--b-project': '#8693b3', '--b-maintenance': '#6fa39b', '--b-support': '#c08d5c' });
  }
  return Object.entries(v).map(([k, x]) => `${k}: ${x};`).join(' ');
}

/** CSS that overrides the base tokens for this theme ('' for the default look). */
export function themeCss(a?: Appearance): string {
  const t = resolveTheme(a);
  if (t.isDefault) return '';
  const light = vars(t.accent, t.tint, t.muted, false);
  const dark = vars(t.accent, t.tint, t.muted, true);
  return `:root { ${light} }\n@media (prefers-color-scheme: dark) { :root:not([data-theme='light']) { ${dark} } }\n:root[data-theme='dark'] { ${dark} }`;
}

/** Swatch colours for a preview: accent, background, surface. */
export function swatch(a?: Appearance, dark = false) {
  const t = resolveTheme(a);
  const s = SURFACES[t.tint][dark ? 'dark' : 'light'];
  const acc = dark ? until(t.accent, '#ffffff', s[1], 3.2) : until(t.accent, '#000000', '#ffffff', 3.2);
  return { accent: acc, bg: s[0], surface: s[1], s2: s[2], border: s[4], soft: dark ? mix(acc, s[1], 0.78) : mix(acc, '#ffffff', 0.9) };
}
