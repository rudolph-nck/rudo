// Palette sampled from the Static & Silence cover (assets/cover.png), then extended
// along the storyboard's colour arc: steel (struggle) → sodium/dust (grind) → gold/ember (legacy).
export const C = {
  black: "#050505",
  ink: "#0b0a09",
  concrete: "#2e2b26",
  concreteLit: "#4a453d",
  stone: "#867766", // RUDO lettering on the cover
  stoneLit: "#cbbba4", // stone pushed up for legibility on screen
  bone: "#ece2d0",
  steel: "#6f8796",
  steelDeep: "#1a2630",
  sodium: "#e08a3c",
  dust: "#b98a5a",
  gold: "#f4c46a",
  goldHot: "#ffe3a3",
  ember: "#ff7a2e",
  red: "#e3352b",
} as const;

export const W = 1080;
export const H = 1920;
// TikTok safe area: keep type clear of the bottom 20% and the right-hand UI rail.
export const SAFE = { left: 70, right: W - 150, top: 230, bottom: Math.round(H * 0.8) - 40 } as const;
