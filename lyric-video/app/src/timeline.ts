// The edit: which plate plays when (docs/TREATMENT-drift.md, "timeline.ts skeleton"). Boundaries are
// anchored to lyric lines by content and snapped to the beat grid, so they follow the aligned data
// (data/lyrics.json, data/audio.json).
import type { TimelineEntry } from './engine/engine';
import type { SceneClass } from './engine/scene';
import type { Lyrics } from './engine/lyrics';
import type { AudioData } from './engine/audio';

// Scene modules are discovered lazily so a missing/broken scene never breaks the build.
const modules = import.meta.glob<{ default: SceneClass }>('./scenes/*.ts');
/**
 * Phase 2: every plate plays the `karaoke` placeholder until its own module (scenes/<file>.ts)
 * exists; then that module takes over with no change here.
 */
const scene = (name: string) => () => {
  const m = modules[`./scenes/${name}.ts`] ?? modules['./scenes/karaoke.ts'];
  return m ? m() : Promise.reject(new Error(`scene module not found: scenes/${name}.ts`));
};

export function makeTimeline(ly: Lyrics, au: AudioData): TimelineEntry[] {
  /** Hooks: cut on the last beat at/before the first word of the matching line (never after the word). */
  const cut = (q: string, nth = 0, tol = 0.02) => {
    const s = ly.get(q, nth).words[0]!.start;
    return au.timeOfBeat(Math.floor(au.beatAt(s + tol)));
  };
  /** Plate boundaries: the last downbeat if it is at most one beat before the line's first word,
   *  otherwise the last beat (a straight downbeat snap would cut a bar early, into the previous line).
   *  Hooks use plain cut(): their first word is the hit. */
  const cutDown = (q: string, nth = 0, tol = 0.02) => {
    const s = ly.get(q, nth).words[0]!.start + tol;
    const d = [...au.downbeats].reverse().find((x) => x <= s);
    const beat = au.timeOfBeat(Math.floor(au.beatAt(s)));
    return d !== undefined && au.beatAt(s) - au.beatAt(d) <= 1 ? d : beat;
  };

  // "I don't wanna die" is sung 5 times (Phase 1, docs/PHASE1-report.md): chorus 1 = 0 and its
  // reprise 1, chorus 2 = 2 and its single reprise 3, the final chorus = 4. (The treatment's
  // skeleton assumed 6: chorus 2 does NOT sing the pair twice.)
  const b = {
    ceiling: cutDown('Another morning'),
    pieces: cutDown('Everybody needs a piece'),
    wall: cutDown('Built a life'),
    dark: cutDown('But none of that gets quiet'),
    break1: cutDown("I'm not looking for an ending"),
    hook1: cut("I don't wanna die", 0),
    stars1: cutDown('Float somewhere', 0),
    hook1b: cut("I don't wanna die", 1), // chorus 1 reprise
    drive: cutDown('Sometimes I drive'),
    apart: cutDown('People think'),
    voicemail: cutDown('Got memories'),
    scars: cutDown('Got dreams'),
    breath: cutDown('Not forever'),
    hook2: cut("I don't wanna die", 2),
    stars2: cutDown('Float somewhere', 1),
    hook2b: cut("I don't wanna die", 3), // chorus 2 reprise (single)
    carry: cutDown("Maybe I'm tired of carrying"),
    silence: cutDown('No phone ringing'),
    hook3: cut("I don't wanna die", 4),
    under: cutDown('Somewhere the guilt'),
    tomorrow: cutDown("Tomorrow I'll keep fighting"),
    end: au.duration,
  };

  /** `file` is the plate's module (scenes/<file>.ts); the karaoke placeholder stands in until it exists. */
  const E = (id: string, file: string, start: number, end: number, extra: Partial<TimelineEntry> = {}): TimelineEntry =>
    ({ id, load: scene(file), start, end, ...extra, file } as TimelineEntry);

  return [
    E('seam', 'seam', 0, b.ceiling),
    E('ceiling', 'ceiling', b.ceiling, b.pieces),
    E('pieces', 'pieces', b.pieces, b.wall),
    E('wall', 'wall', b.wall, b.dark),
    E('dark', 'dark', b.dark, b.break1),
    E('break', 'break', b.break1, b.hook1),
    E('hook1', 'hook', b.hook1, b.stars1, { params: { n: 1 } }),
    E('stars1', 'stars', b.stars1, b.hook1b),
    E('hook1b', 'hook', b.hook1b, b.drive, { params: { n: 1, reprise: true } }),
    E('drive', 'drive', b.drive, b.apart),
    E('apart', 'apart', b.apart, b.voicemail),
    E('voicemail', 'voicemail', b.voicemail, b.scars),
    E('scars', 'scars', b.scars, b.breath),
    E('breath', 'breath', b.breath, b.hook2),
    E('hook2', 'hook', b.hook2, b.stars2, { params: { n: 2 } }),
    E('stars2', 'stars', b.stars2, b.hook2b),
    E('hook2b', 'hook', b.hook2b, b.carry, { params: { n: 2, reprise: true } }),
    E('carry', 'carry', b.carry, b.silence),
    E('silence', 'silence', b.silence, b.hook3),
    E('hook3', 'hook', b.hook3, b.under, { params: { n: 3 } }),
    E('under', 'under', b.under, b.tomorrow),
    E('tomorrow', 'tomorrow', b.tomorrow, b.end),
  ];
}
