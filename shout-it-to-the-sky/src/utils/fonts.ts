import "@fontsource/bebas-neue/400.css";
import "@fontsource/oswald/300.css";
import "@fontsource/oswald/500.css";
import "@fontsource/oswald/700.css";
import "@fontsource/caveat/500.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import { continueRender, delayRender } from "remotion";

// Bebas Neue is the closest open match to the cover's tall condensed RUDO lettering;
// Oswald stands in for the wide-tracked "STATIC & SILENCE" subtitle face.
export const F = {
  display: "'Bebas Neue', 'Oswald', sans-serif",
  cond: "'Oswald', sans-serif",
  hand: "'Caveat', cursive",
  mono: "'IBM Plex Mono', monospace",
};

const specs = [
  "400 20px 'Bebas Neue'",
  "300 20px 'Oswald'",
  "500 20px 'Oswald'",
  "700 20px 'Oswald'",
  "500 20px 'Caveat'",
  "400 20px 'IBM Plex Mono'",
  "500 20px 'IBM Plex Mono'",
];

let started = false;
export const ensureFonts = () => {
  if (started || typeof document === "undefined") return;
  started = true;
  const handle = delayRender("fonts");
  Promise.all(specs.map((s) => document.fonts.load(s, "AaBb0123!'")))
    .then(() => document.fonts.ready)
    .then(() => continueRender(handle))
    .catch(() => continueRender(handle));
};
