// Avatar colours and validation. Every colour keeps white initials at WCAG AA (4.5:1); `npm run contrast` checks.
export const AVATAR_COLORS: { color: string; name: string }[] = [
  { color: '#3346D3', name: 'Indigo' },
  { color: '#155E99', name: 'Blue' },
  { color: '#00687A', name: 'Cyan' },
  { color: '#0B7363', name: 'Teal' },
  { color: '#28652A', name: 'Green' },
  { color: '#7A4E0E', name: 'Brown' },
  { color: '#A33A00', name: 'Orange' },
  { color: '#B42318', name: 'Red' },
  { color: '#A1206A', name: 'Magenta' },
  { color: '#7135B8', name: 'Purple' },
  { color: '#5A5F6E', name: 'Slate' },
  { color: '#1B2230', name: 'Charcoal' },
];
/** Default colour order, kept from before so nobody's colour changes until they pick one. */
export const DEFAULT_AVATAR_ORDER = ['#3346D3', '#0B7363', '#A33A00', '#7135B8', '#A1206A', '#28652A', '#155E99', '#5A5F6E'];

export const MAX_PHOTO_CHARS = 60_000;

export const validColor = (c: unknown): c is string => typeof c === 'string' && AVATAR_COLORS.some((a) => a.color.toLowerCase() === c.toLowerCase());
export const validPhoto = (p: unknown): p is string => typeof p === 'string' && p.length <= MAX_PHOTO_CHARS && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p);
/** One emoji (or symbol): a single grapheme, nothing that looks like markup. */
export function validEmoji(e: unknown): e is string {
  if (typeof e !== 'string' || !e || e.length > 16 || /[<>&\s]/.test(e)) return false;
  const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment(s: string): Iterable<unknown> } }).Segmenter;
  return Seg ? [...new Seg(undefined, { granularity: 'grapheme' }).segment(e)].length === 1 : [...e].length <= 4;
}
