// Style-frame stills:  node scripts/style.mjs <out_dir> <id>[@songSeconds] ...
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "path";
import fs from "fs";
const [outDir, ...ids] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const shell = ["/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell", "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell"].find((p) => fs.existsSync(p));
const opts = { browserExecutable: shell, chromiumOptions: { gl: "swangle" }, timeoutInMilliseconds: 300000 };
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
for (const spec of ids) {
  const [id, at] = spec.split("@");
  const inputProps = { id, t0: at ? Number(at) : undefined };
  const composition = await selectComposition({ serveUrl, id: "Style", inputProps, ...opts });
  const props = { ...composition.defaultProps, ...inputProps };
  if (props.t0 === undefined) delete props.t0;
  const output = path.join(outDir, `${id}${at ? "@" + at : ""}.jpg`);
  const t = Date.now();
  await renderStill({ serveUrl, composition, frame: 0, output, imageFormat: "jpeg", jpegQuality: 92, inputProps: props, ...opts,
    onBrowserLog: (l) => { if (l.type === "error" || l.type === "warning") console.log("  [browser]", l.text.slice(0, 200)); } });
  console.log(output, ((Date.now() - t) / 1000).toFixed(1) + "s");
}
