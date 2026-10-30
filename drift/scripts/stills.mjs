// Many stills from one bundle:  node scripts/stills.mjs <out_dir> <scale> <t1> <t2> ...   (t = song seconds)
// Stills come from the full LyricVideo composition, muted, so t is absolute song time.
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "path";
import fs from "fs";
const [outDir, scaleArg, ...times] = process.argv.slice(2);
const scale = Number(scaleArg || 0.5);
fs.mkdirSync(outDir, { recursive: true });
const shell = ["/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell", "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell"].find((p) => fs.existsSync(p));
const opts = { browserExecutable: shell, chromiumOptions: { gl: "swangle" } };
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const composition = await selectComposition({ serveUrl, id: process.env.COMP ?? "LyricVideo", inputProps: { muted: true }, ...opts });
for (const t of times) {
  const frame = Math.round(Number(t) * 30);
  const output = path.join(outDir, `t${Number(t).toFixed(2).padStart(7, "0")}.jpg`);
  await renderStill({ serveUrl, composition, frame, output, imageFormat: "jpeg", jpegQuality: 88, scale, inputProps: { muted: true }, ...opts });
  console.log(output);
}
