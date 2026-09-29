# Song Analysis — "One Team, One Rhythm"

- Duration 282.0 s · **107.7 BPM** · beat 0.557 s · bar 2.23 s · 4/4
- Downbeat phase measured from kick energy (beat index % 4 == 2): mean kick on that phase is 38.5 vs
  7–12 on the other phases.
- Timing sources: `data/beats.json` (librosa beat tracker) and `data/lyrics.json` (Suno highlight events
  snapped to the beat grid). Section notes in the lyric sheet ("CUTS", "DEAD SILENCE") show up in the
  master as **kick drop-outs**, not true digital silence. They are treated visually as cuts.

## Structure

| Time | Section | Energy | Musical events used as animation markers |
|---|---|---|---|
| 0.0–4.8 | Ambience | low swell | sub swell @2.0 |
| 4.8–21.5 | Intro vocal | medium | "Yeah…" 4.8, "2026." 10.0, name lines 11.5–15.0 |
| 21.5–29.9 | Rise → cut → drop | rising | kick thins @22, re-entry @29.9 |
| 29.9–57.5 | Verse | mid, steady | kick drop-outs 40, 45, 54 = breath points |
| 57.5–74.1 | Chorus | high | downbeats 57.52 / 59.79 / 62.05; drop-out @74 "Hold up…" |
| 74.1–116.1 | Roll call — branches | bouncy, 1 line per bar | drop-outs 79, 84, 92, 109 |
| 116.1–183.4 | Beat switch — departments | high, dense | switch 116; low-end gap 118–120; drop-outs 127, 150, 152 |
| 183.4–198.6 | Beat cut | sparse → building | "THAT'S ADDITION." 197.6 |
| 198.6–214.4 | Bridge | **lowest (no kick 200–216)** | intimate, vocal-forward |
| 214.4–222.6 | Beat builds | rising | 4 × "Different…", "WE MOVE AS ONE." 221.3 |
| 222.3–225.7 | Final build | tension, kick gap @223 | "WE MOVE AS ONE." held |
| 226.0–246.2 | Final drop + chorus | **highest (RMS peaks 226–243)** | drop 226.0 |
| 246.2–261.3 | Climax | peak with drop-out @245 | "LOOK WHAT TOGETHER CAN DO!" 247.32 (downbeat) · ACU 258.53 (downbeat) |
| 261.3–282.0 | Outro | high, then resolve | drop-out @272, last hit 273.0, tail to 282 |

## Lyrical narrative

The song is a **merger story told as a celebration**. 2026 was the year two credit unions became one
(Envision came in, Addition stood tall). Two regions on "different sides of the map" (Central Florida
and the Tallahassee / North Florida / South Georgia branches). A March systems conversion. Long days and
late nights. Then the whole organisation is named out loud: 36 branch locations, 28 department lines.
It ends on values (Learn, Teach, Improve, Absolute Integrity) and a welcome to the summit.

## Themes → metaphors

| Theme | Where | Visual metaphor |
|---|---|---|
| **Addition = two lines crossing** | "Two teams… Envision came in, Addition stood tall" | Two lines approach, one rises vertical, they cross and *become the brand plus*. The film's thesis frame. |
| Many → one | intro, chorus, build, climax | Many thin lines at different angles converge on one vanishing point / one line |
| Roads / paths | "Different roads brought us together" | The brand line rotates into the ground plane and becomes a road; other roads merge into it |
| A year | "2026", "March came quick", "been through" | The line as a timeline ruler with month ticks, recalled in the final chorus |
| Different sides of the map | verse, roll call | Dark geographic constellation, two clusters of real branch coordinates joined by one arc |
| Every piece matters | departments, beat cut | The Rail (departments as stations on one line) → a mosaic wall of every name forming a plus |
| Rhythm | chorus | The line as beat meter; type that breathes on downbeats |
| Values | bridge | Stillness, warm light, a vertical line like a page margin, serif type |
| Arrival | outro | Addapalooza mark + the masked A+ DJ revealed by his own light |

## Words that carry weight (hero words)
2026 · roads · One · Addition · changin' · stood tall · one call · conversion · groove · improve ·
ONE TEAM · ONE RHYTHM · as one · learned/taught/changed/grew · the crew · one crew · LOOK AT THIS CREW ·
Departments · LOUD · ONE ADDITION · Front line / Back office · every piece · THAT'S ADDITION · Learn ·
Teach · Improve · Integrity · AS ONE · READY · TOGETHER · Addapalooza.

## Emotional arc
Anticipation (intro) → momentum and grit (verse) → release (chorus) → pride and play (roll calls) →
recognition (beat cut) → reflection (bridge) → gathering tension (build) → euphoria (final chorus) →
arrival (outro) → a single point of light.

## Sung vs. sheet
Timings come from word-level ASR on the isolated vocal (see README). Where the recording differs from
the lyric sheet, the film follows what is sung:
- the final drop (225.7 s) sings **"ONE TEAM! ONE RHYTHM!"**, not "JAX… / YOU READY?";
- the final chorus repeats "ONE TEAM! ONE RHYTHM!" three times (230.3 / 233.6 / 234.8 s);
- the beat drop (29.9–38.5 s) carries chopped **"yeah"** vocals (16 onsets, `data/chops.json`);
- the verse starts at 38.5 s, and the Suno highlight times were 1–3 s early in places.
