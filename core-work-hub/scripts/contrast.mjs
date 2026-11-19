// WCAG AA contrast check for every text/background token pair, light and dark. Exits non-zero on failure.
import { readFileSync } from 'node:fs';
const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const block = (sel) => {
  const i = css.indexOf(sel);
  const body = css.slice(css.indexOf('{', i) + 1, css.indexOf('}', i));
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]));
};
const light = block(':root {');
const dark = { ...light, ...block(":root[data-theme='dark'] {") };
const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const pairs = [
  ...['text', 'text-2', 'text-3'].flatMap((t) => ['bg', 'surface', 'surface-2'].map((b) => [t, b])),
  ['text-2', 'surface-3'], ['accent-text', 'surface'], ['accent-text', 'surface-2'], ['accent-text', 'bg'], ['accent-text', 'accent-soft'], ['on-accent', 'accent'], ['on-accent', 'accent-hover'],
  ['danger', 'surface'], ['danger', 'bg'], ['danger', 'danger-soft'], ['success', 'success-soft'], ['warn', 'warn-soft'], ['warn', 'surface'],
  ['p1-fg', 'p1-bg'], ['p2-fg', 'p2-bg'], ['p3-fg', 'p3-bg'], ['p4-fg', 'p4-bg'],
];
// Non-text UI (3:1): bucket dots, slot borders.
const ui = [['b-project', 'surface'], ['b-maintenance', 'surface'], ['b-support', 'surface'], ['b-project', 'surface-2'], ['b-maintenance', 'surface-2'], ['b-support', 'surface-2'], ['accent', 'surface']];
const avatars = [...readFileSync(new URL('../src/model/avatar.ts', import.meta.url), 'utf8').matchAll(/color: '(#[0-9A-Fa-f]{6})'/g)].map((m) => m[1]);
if (avatars.length < 12) throw new Error('avatar palette not found');
let fail = 0;
for (const [name, t] of [['light', light], ['dark', dark]]) {
  for (const [f, b] of pairs) {
    const r = ratio(t[f], t[b]);
    if (r < 4.5) { fail++; console.log(`FAIL ${name}: --${f} on --${b} = ${r.toFixed(2)}`); }
  }
  for (const [f, b] of ui) {
    const r = ratio(t[f], t[b]);
    if (r < 3) { fail++; console.log(`FAIL ${name} (UI 3:1): --${f} on --${b} = ${r.toFixed(2)}`); }
  }
}
for (const a of avatars) if (ratio(a, '#ffffff') < 4.5) { fail++; console.log(`FAIL avatar ${a} with white = ${ratio(a, '#ffffff').toFixed(2)}`); }
const min = Math.min(...[light, dark].flatMap((t) => pairs.map(([f, b]) => ratio(t[f], t[b]))));
console.log(fail ? `${fail} contrast failures` : `All ${pairs.length * 2} text pairs pass WCAG AA (lowest ${min.toFixed(2)}:1); UI marks pass 3:1; avatars pass.`);
process.exit(fail ? 1 : 0);
