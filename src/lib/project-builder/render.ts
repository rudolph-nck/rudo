import { readFile } from "fs/promises";
import path from "path";
import type { Guide } from "./guides";

const CONTENT_DIR = path.join(process.cwd(), "src/content/project-builder");

/** Returns the full HTML document for a guide. */
export async function renderGuide(guide: Guide): Promise<string> {
  if (guide.file) {
    return readFile(path.join(CONTENT_DIR, guide.file), "utf8");
  }
  const [template, engine, json] = await Promise.all([
    readFile(path.join(CONTENT_DIR, "engine/template.html"), "utf8"),
    readFile(path.join(CONTENT_DIR, "engine/engine.js"), "utf8"),
    readFile(path.join(CONTENT_DIR, "guides", guide.data as string), "utf8"),
  ]);
  const data = JSON.parse(json) as { title: string; short?: string };
  // Escape "<" so guide text can never close the <script> tag it is embedded in.
  const safeData = JSON.stringify(data).replace(/</g, "\\u003c");
  const plain = (s: string) => s.replace(/[<>&"]/g, "");
  return template
    .split("__TITLE__").join(plain(data.title))
    .split("__SHORT__").join(plain(data.short || data.title))
    .replace("__GUIDE_DATA__", () => safeData)
    .replace("__ENGINE_JS__", () => engine);
}
