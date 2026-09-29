/** Colour + type tokens derived from the Addition Financial brand guide. */
export const C = {
  ink: "#060708",
  charcoal: "#0C0E10",
  graphite: "#15181B",
  anchor: "#53575A", // Anchor Gray PMS 425 C
  lunar: "#CFD3D3", // Lunar Gray PMS 427 C
  white: "#FFFFFF",
  warm: "#F4F1EA",
  blue: "#00B2E3", // Vivid Blue PMS 306 C — the line, the plus
  blueRGB: "0,178,227",
  deep: "#00538B", // Button Blue PMS 7462 C — shadow tint only
};

export const F = {
  hero: "'Open Sans', sans-serif", // brand main typeface, 800
  narrative: "'Inter', 'Helvetica Neue', sans-serif", // stands in for Helvetica Neue 45 Light
  mono: "'IBM Plex Mono', monospace",
  serif: "'Instrument Serif', serif",
};

/** Plus geometry measured from the brand vector (units). */
export const PLUS = {
  w: 25.743,
  h: 21.349,
  bar: 5.174,
  slant: 3.106,
  path: "M25.743 8.086L22.652 13.260L15.494 13.260L15.494 21.349L10.320 21.349L10.320 13.260L0.000 13.260L3.106 8.086L10.320 8.086L10.320 0.000L15.494 0.000L15.494 8.086L25.743 8.086Z",
};
export const A_GLYPH = {
  w: 27.255,
  h: 33.432,
  path: "M27.255 0.000L27.255 10.795L22.085 10.795L22.085 5.640L5.405 33.432L0.000 33.432L18.607 0.000L27.255 0.000Z",
};

/** Blue glow used sparingly — line, plus, live nodes. */
export const glow = (strength = 1) =>
  `drop-shadow(0 0 ${3 * strength}px rgba(${C.blueRGB},${0.9 * Math.min(1, strength)})) drop-shadow(0 0 ${14 * strength}px rgba(${C.blueRGB},${0.35 * Math.min(1, strength)}))`;
