let ctx: CanvasRenderingContext2D | null = null;
const cache = new Map<string, number>();
/** Text advance width in px for a CSS font shorthand (fonts are loaded before first frame). */
export const measure = (text: string, font: string, letterSpacingEm = 0) => {
  const key = font + "|" + letterSpacingEm + "|" + text;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  if (!ctx) ctx = document.createElement("canvas").getContext("2d");
  ctx!.font = font;
  const size = parseFloat(font.match(/(\d+(?:\.\d+)?)px/)?.[1] ?? "16");
  const w = ctx!.measureText(text).width + letterSpacingEm * size * Math.max(0, text.length - 1);
  cache.set(key, w);
  return w;
};
/** Largest font size (≤ max) at which text fits maxWidth. */
export const fitSize = (text: string, family: string, maxWidth: number, max: number, weight = 400, ls = 0) => {
  const w100 = measure(text, `${weight} 100px ${family}`, ls);
  return Math.min(max, (maxWidth / w100) * 100);
};
