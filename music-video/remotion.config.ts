import { Config } from "@remotion/cli/config";

// Headless Chromium shipped with the container; swap for your own if needed.
const localShell = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
import fs from "fs";
if (fs.existsSync(localShell)) Config.setBrowserExecutable(localShell);

Config.setChromiumOpenGlRenderer("swangle");
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(92);
Config.setConcurrency(4);
Config.setPixelFormat("yuv420p");
Config.setCodec("h264");
Config.setCrf(18);
Config.setEntryPoint("src/index.ts");
