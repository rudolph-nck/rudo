import { Config } from "@remotion/cli/config";
import fs from "fs";

// Headless Chromium shipped with the container; on a normal machine Remotion fetches its own.
const localShell = ["/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell", "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell"].find((p) => fs.existsSync(p));
if (localShell) Config.setBrowserExecutable(localShell);

Config.setChromiumOpenGlRenderer("swangle");
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(92);
Config.setConcurrency(4);
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setCrf(18);
Config.setEntryPoint("src/index.ts");
