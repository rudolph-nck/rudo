import scenesData from "../../data/scenes.json";
import { useCurrentFrame } from "remotion";
import { clamp01, cubicInOut } from "./ease";

export type Chapter = (typeof scenesData.chapters)[number];
export type Scene = (typeof scenesData.scenes)[number];

export const chapters = scenesData.chapters;
const sceneMap = new Map(scenesData.scenes.map((s) => [s.scene, s]));
const chapterMap = new Map(scenesData.chapters.map((c) => [c.id, c]));

export const scene = (id: string): Scene => {
  const s = sceneMap.get(id);
  if (!s) throw new Error(`Unknown scene ${id}`);
  return s;
};
export const chapter = (id: string): Chapter => {
  const c = chapterMap.get(id);
  if (!c) throw new Error(`Unknown chapter ${id}`);
  return c;
};

/**
 * Per-world helper. `f` = local frame. `L(id)` = local start frame of a
 * lyric scene, `E(id)` its local end. `abs` = absolute film frame.
 * `txt(id)` / `hero(id)` read display text from the manifest.
 */
export const useWorld = (chapterId: string) => {
  const f = useCurrentFrame();
  const ch = chapter(chapterId);
  const o = ch.startFrame;
  return {
    f,
    abs: f + o,
    dur: ch.endFrame - ch.startFrame,
    /** absolute seconds → local frame */
    T: (s: number) => Math.round(s * 30) - o,
    L: (id: string) => scene(id).startFrame - o,
    E: (id: string) => scene(id).endFrame - o,
    txt: (id: string) => scene(id).display,
    hero: (id: string) => scene(id).heroWord,
    /** chapter edge fade (in over `a` frames, out over `b` frames) */
    edge: (a = 10, b = 10) =>
      Math.min(cubicInOut(clamp01(f / Math.max(1, a))), cubicInOut(clamp01((ch.endFrame - o - f) / Math.max(1, b)))),
  };
};
