// Render many stills with one bundle:  node scripts/stills.mjs out_dir scale t1 t2 ...  (t in seconds)
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "path";
import fs from "fs";
const [outDir, scaleArg, ...times] = process.argv.slice(2);
const scale = Number(scaleArg || 0.5);
fs.mkdirSync(outDir, { recursive: true });
const shell = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const comp = await selectComposition({ serveUrl, id: "FilmSilent", browserExecutable: fs.existsSync(shell) ? shell : undefined, chromiumOptions: { gl: "swangle" } });
for (const t of times) {
  const frame = Math.round(Number(t) * 30);
  const out = path.join(outDir, `f${String(frame).padStart(5, "0")}_${Number(t).toFixed(2)}s.jpg`);
  await renderStill({ serveUrl, composition: comp, frame, output: out, imageFormat: "jpeg", jpegQuality: 88, scale,
    browserExecutable: fs.existsSync(shell) ? shell : undefined, chromiumOptions: { gl: "swangle" } });
  console.log(out);
}
