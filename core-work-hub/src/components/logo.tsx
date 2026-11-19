// The Core Work Hub mark (the Kanban icon): charcoal tile in light mode, light tile in dark mode,
// for both the in-app logo and the browser-tab icon.

// Shapes from the supplied kanban-icon.svg (viewBox 0 0 100 100).
const CARDS = [[18, 22], [18, 42], [18, 62], [38, 22], [38, 42]];

export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 100 100" aria-hidden focusable="false">
      <rect width="100" height="100" rx="22" fill="var(--logo-tile)" />
      {CARDS.map(([x, y]) => <rect key={`${x}-${y}`} x={x} y={y} width="14" height="14" rx="4" fill="var(--logo-card)" />)}
      <circle cx="71" cy="29" r="11" fill="var(--logo-accent)" />
      <path d="M65.5 29.5l4 4 7-8" fill="none" stroke="var(--logo-tick)" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const LIGHT = { tile: '#1B2230', card: '#FFFFFF', accent: '#7DE3C3', tick: '#1B2230' };
const DARK = { tile: '#E9EDF4', card: '#1B2230', accent: '#2FB892', tick: '#FFFFFF' };

function svg(c: typeof LIGHT) {
  const cards = CARDS.map(([x, y]) => `<rect x="${x}" y="${y}" width="14" height="14" rx="4" fill="${c.card}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="${c.tile}"/>${cards}<circle cx="71" cy="29" r="11" fill="${c.accent}"/><path d="M65.5 29.5l4 4 7-8" fill="none" stroke="${c.tick}" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
const dataUrl = (s: string) => 'data:image/svg+xml,' + encodeURIComponent(s);

/** Browser-tab icon matching the theme the page shows (System follows Windows; Light/Dark follow the toggle). */
export function syncFavicon() {
  const forced = document.documentElement.getAttribute('data-theme');
  const dark = forced ? forced === 'dark' : window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.type = 'image/svg+xml';
  link.href = dataUrl(svg(dark ? DARK : LIGHT));
}

let watching = false;
export function watchFavicon() {
  syncFavicon();
  if (watching) return;
  watching = true;
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', syncFavicon);
  new MutationObserver(syncFavicon).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}
