import "@fontsource/open-sans/400.css";
import "@fontsource/open-sans/600.css";
import "@fontsource/open-sans/700.css";
import "@fontsource/open-sans/800.css";
import "@fontsource/open-sans/800-italic.css";
import "@fontsource/inter/300.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import { continueRender, delayRender } from "remotion";

const specs = [
  "400 20px 'Open Sans'",
  "600 20px 'Open Sans'",
  "700 20px 'Open Sans'",
  "800 20px 'Open Sans'",
  "italic 800 20px 'Open Sans'",
  "300 20px 'Inter'",
  "400 20px 'Inter'",
  "600 20px 'Inter'",
  "400 20px 'IBM Plex Mono'",
  "500 20px 'IBM Plex Mono'",
  "400 20px 'Instrument Serif'",
  "italic 400 20px 'Instrument Serif'",
];

let started = false;
/** Blocks rendering until every face used in the film is loaded. */
export const ensureFonts = () => {
  if (started || typeof document === "undefined") return;
  started = true;
  const handle = delayRender("fonts");
  Promise.all(specs.map((s) => document.fonts.load(s, "AaBb0123+—’")))
    .then(() => document.fonts.ready)
    .then(() => continueRender(handle))
    .catch(() => continueRender(handle));
};
