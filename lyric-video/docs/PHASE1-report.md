# Phase 1 report: Drift data

Outputs: `data/lyrics.json` (94 lines, word timings + conf, extras) and `data/audio.json`
(beats, downbeats, sections, 100 fps envelopes, kick/snare/hat/vocal onsets). Both use the same
schema as `ref/data` (`syl` is only emitted for multi-part pronunciations; Drift has none).
Timeline = gapless decode of `audio/drift.mp3`, 264.08 s.

Pipeline as specified: Demucs htdemucs_ft (CPU) → `vocal_feats.py` → CTC emissions (MMS_FA +
wav2vec2-lv60k on Demucs vocals mono/L/R and Suno's lead stem) → faster-whisper large-v3-turbo
→ `align.py --plots` → `analyze.py --plots`. Demucs stem offset measured at **1015 samples
(23.02 ms)**, the same LAME delay as pdoom, and it is corrected.

QA plots are gitignored. Regenerate them with `cd analysis && uv run python align.py --plots &&
uv run python analyze.py --plots`, and make zooms with `uv run python zoom.py t0 t1 name`.

## Headline: the hook is sung 5 times, not 6

The lyric sheet (from Suno's lyric video) had chorus 2 ending with the hook pair twice. **The
recording sings it once.** Evidence:
- **Suno's lead stem, transcribed by Whisper:** "…leave it for a **bit**" (158.4), then
  "I don't wanna die" (≈161.8–163.7), then "I just wanna drift" (≈166.7–169.3), then
  "Maybe I'm tired" (169.7).
- **Suno's backing stem:** only "oh, oh, oh" between 158.9 and 168.
- **QA plot** (`qa/line_62.png`/`63` on the first run): 159.2–162.6 holds a faint sustained tone
  with no consonant onsets. CTC had crammed a phantom die/drift pair into the melisma of
  "for a bit".

**Fix:** removed the phantom pair from `lyrics/drift.src.js`, now 94 lines; the header comment
explains why. `analyze.py` chorus 3 now uses `nth=4`.

| # | line | first word | chorus |
|---|---|---|---|
| 0 | L24 | 57.17 | chorus 1 |
| 1 | L33 | 84.30 | chorus 1 reprise |
| 2 | L53 | 135.54 | chorus 2 |
| 3 | L62 | 162.68 | chorus 2 reprise (single) |
| 4 | L79 | 201.87 | final chorus |

**Treatment impact (lead to update `docs/TREATMENT-drift.md` skeleton + d3):**
- `hook2b` = `cut("I don't wanna die", 3)` stays, but it is a **single** reprise
  (die/drift), not a double.
- `hook3` must become `cut("I don't wanna die", 4)`. With 5, `ly.get` would throw or return
  undefined.
- The closing note ("chorus 2 three times … the final chorus once (5)") is wrong. Chorus 2 sings
  the hook twice.

## Tempo and bar phase

- **85.766 BPM** (period 0.69958 s), constant, first beat 0.496 s, kick residual sd 18.9 ms. This
  matches the earlier smoke test and the ≈86 BPM estimate.
- **`BAR_PHASE = 2`**, now set explicitly: grid beat index 2 mod 4 is beat 1, and the first
  downbeat is at 1.895 s. **The automatic choice (phase 0) was wrong by two beats.** Its score was
  a near tie (1.127 vs 1.093), because snares sit on 2 and 4 under both phases.
- Evidence for phase 2:

  - **Kick 8th-positions** (phase 2): `[77, 19, 53, 66, 20, 46, 58, 51]`. The kick on 1 is the
    strongest slot.
  - **Snare 8th-positions:** `[4, 1, 55, 8, 0, 0, 61, 11]`, i.e. beats 2 and 4.
  - **Harmony:** bass and other-stem chroma change is largest on phase-2 downbeats **in all 11
    sections**, e.g. 0.49–0.72 there vs 0.14–0.41 on any other beat.
  - **Structural energy:** every large increase lands on a phase-2 downbeat (57.86 chorus 1,
    91.44 verse 2, 136.21 chorus 2, 180.99, 214.57, 250.94).
  - **Lyrics:** 39 of 94 line starts fall on, or an 8th before, a phase-2 downbeat, vs 33 for
    phase 0.

## Sections

Every section starts on a downbeat. The hook and the outro lines open with a pickup of more than
2 beats: "I don't wanna" comes before the bar, and **"die" lands on the downbeat**, which is
where the chorus energy enters. So `SECTIONS` can now key on a word: choruses on "die" (word 3),
outro on "fighting". Keyed on the first word, chorus 3 started a bar early and took the
breakdown's last line, "Just breathing".

| section | start–end (s) | m:ss | opens with |
|---|---|---|---|
| intro | 0.000–21.483 | 0:00 | "Yeah…" 4.26 (spoken-sung lines to "For a minute" 21.76) |
| verse1 | 21.483–52.264 | 0:21 | "Another morning" 22.84 |
| pre1 | 52.264–57.861 | 0:52 | "And I'm not looking for an ending" 53.10 |
| chorus1 | 57.861–91.441 | 0:58 | "I don't wanna" pickup 57.17, **die 57.74** |
| verse2 | 91.441–130.617 | 1:31 | "Sometimes I drive" 91.59 |
| pre2 | 130.617–136.214 | 2:11 | "Not forever" is a pickup at 129.43 (beat 3.3 of the previous bar) |
| chorus2 | 136.214–169.794 | 2:16 | "I don't wanna" pickup 135.54, **die 136.22** |
| bridge | 169.794–192.180 | 2:50 | "Maybe I'm tired of carrying" 170.14 |
| breakdown | 192.180–203.373 | 3:12 | "No phone ringing" 192.57. Exactly 4 bars, all 7 short lines |
| chorus3 | 203.373–228.558 | 3:23 | "I don't wanna" pickup 201.87, **die 203.40** |
| outro | 228.558–264.080 | 3:49 | "Tomorrow I'll keep" pickup 227.18, fighting 228.36; instrumental tail ≈ 251–262 |

## Hand-checked spots

**Spoken intro (0–21 s; `qa/intro_a.png`, `intro_b.png`, `line_00..05`).**
- "Yeah…" runs 4.26–4.62. Nothing is voiced before 4.2, so Whisper's 3.72 is wrong.
- FIX: the end goes 4.51 → 4.62, the end of the decay. This matters for the 900 → 300 weight
  animation.
- L1–L5 all sit on clear onsets. The only weak spot is "to" in "everything to stop"
  (19.38–19.48, conf 0.5): a tiny unstressed syllable before the "s" burst at 19.48. It is
  plausible as aligned.

**Breakdown (≈191–202 s; `qa/brk_a.png`, `brk_b.png`, `line_72..78`).**
- The seven lines start at 192.57, 193.93, 195.70, 196.74, 198.11, 199.47 and 200.88, and all
  of them sit on their onsets.
- One error was found and fixed. "Just" in "Just breathing" started at 200.66, the final /s/ of
  "silence" (the fricative rule overreached). The /dʒ/ burst is at 200.88–200.93.

**Final "drift" (`qa/line_92.png`, `line_93.png`, `outro_tail.png`).**
- "But tonight…" 236.60–238.40. FIX: refine had stretched "tonight…" to 242.04 across a
  silent gap (vocal stem silent 239–242), because its end search starts at the CTC end.
- "Let me drift" 242.04–242.95. FIX: the end goes 242.84 → 242.95 so the /ft/ release
  (242.88–242.92) is inside the word. **It is not truncated.**
- **It is also not a held note.** "drift" is a short word (≈0.5 s, reverb tail to ≈243.4).
  The sustained vowel at **244.3–246.2** is a breathy hum on the same pitch: no /dr/ onset, no
  /ft/, and Whisper hears "Hmm" (p 0.3). It is listed in `extras`, along with the closing
  "mm-hmm" at 259.0–260.5. Plates that wanted to ride a held "drift" to the end should ride
  the hum (extras) or the instrumental tail instead.

## Manual fixes (align.py `FIX`, each commented)

| word | change | reason |
|---|---|---|
| L0 "Yeah…" | end 4.51 → 4.62 | decay tail |
| L61 "bit" | end → 158.82 | lead stops; then backing pads only |
| L62 "I" | start 159.19 → 162.68 | rest-onset rule latched onto the pad; all CTC models + lead-stem Whisper put it at ≈162.7–162.9 |
| L78 "Just" | start 200.66 → 200.88 | took the /s/ of "silence" |
| L86 "I'll" | start 217.30 → 217.58 | 217.30–217.58 is still "ready"; the new low note starts at 217.58 (conf 0.7, owner please confirm) |
| L89 "Tomorrow" | start 226.70 → 227.18 | the held "drift" runs to 227.08; /t/ + low "To-" note at 227.18 (MMS agrees) |
| L92 "tonight…" | end 242.04 → 238.40 | silence 239–242 |
| L93 "drift" | end 242.84 → 242.95 | keep the /ft/ |

## Words with conf < 0.7 (30)

Status: **ok** = looked at, and the boundary is right; **?** = looked at, still ambiguous (owner
please confirm); **–** = not individually inspected. All "–" words are short function words
where only Whisper or one model disagrees.

| line | text | word | start–end | conf | plot | status |
|---|---|---|---|---|---|---|
| L4 | You just want everything to stop | to | 19.38–19.48 | 0.5 | `qa/line_04.png` | ok (intro_b) |
| L9 | While I'm struggling to rest | to | 29.04–29.18 | 0.68 | `qa/line_09.png` | – |
| L20 | But none of that gets quiet | of | 49.69–49.87 | 0.66 | `qa/line_20.png` | – |
| L23 | I'm just looking for a break | I'm | 55.44–55.58 | 0.66 | `qa/line_23.png` | – |
| L24 | I don't wanna die | I | 57.17–57.34 | 0.65 | `qa/line_24.png` | – |
| L27 | And forget about all this | And | 64.54–64.64 | 0.68 | `qa/line_27.png` | – |
| L30 | No voices in my head | head | 74.28–74.69 | 0.62 | `qa/line_30.png` | – |
| L31 | I don't wanna leave this world | I | 74.69–75.00 | 0.68 | `qa/line_31.png` | ok (Whisper 74.68) |
| L31 | I don't wanna leave this world | don't | 75.00–75.40 | 0.53 | `qa/line_31.png` | **?** fused/lv60k 75.00–75.04, MMS/Whisper 75.16–75.20 where the pitch steps; may be 0.18 s early |
| L32 | I just wanna leave it for a bit | I | 77.46–77.64 | 0.68 | `qa/line_32.png` | – |
| L50 | Some days I just wanna feel nothing | I | 124.70–125.02 | 0.54 | `qa/line_50.png` | – |
| L52 | Just long enough to breathe | Just | 132.35–132.73 | 0.61 | `qa/line_52.png` | ok (/dʒ/ burst 132.34) |
| L53 | I don't wanna die | I | 135.54–135.68 | 0.56 | `qa/line_53.png` | – |
| L53 | I don't wanna die | don't | 135.68–135.86 | 0.61 | `qa/line_53.png` | – |
| L59 | No voices in my head | in | 151.28–151.82 | 0.61 | `qa/line_59.png` | – |
| L60 | I don't wanna leave this world | I | 153.44–153.56 | 0.66 | `qa/line_60.png` | – |
| L61 | I just wanna leave it for a bit | it | 157.66–157.93 | 0.59 | `qa/line_61.png` | – |
| L71 | Where the world doesn't ask for me | ask | 191.60–191.74 | 0.56 | `qa/line_71.png` | ok (brk_a: onset 191.6) |
| L72 | No phone ringing | phone | 192.86–193.44 | 0.68 | `qa/line_72.png` | ok (brk_a) |
| L79 | I don't wanna die | I | 201.87–202.02 | 0.59 | `qa/line_79.png` | ok (onset 201.88) |
| L79 | I don't wanna die | don't | 202.02–202.92 | 0.43 | `qa/line_79.png` | **?** melisma: fused/lv60k 202.02 at the pitch rise, MMS/Whisper ≈202.8 at the formant shift |
| L84 | Underneath the noise | the | 215.68–215.96 | 0.47 | `qa/line_84.png` | ok (/ð/ onset; models mark the vowel at 215.78) |
| L88 | I just wanna drift | I | 224.06–224.73 | 0.61 | `qa/line_88.png` | **?** legato out of "tonight" on the same vowel; true start somewhere in 224.06–224.45 (pitch step at ≈224.4) |
| L88 | I just wanna drift | drift | 225.65–227.18 | 0.67 | `qa/line_88.png` | ok (start agrees ±0.09; end follows the L89 fix) |
| L89 | Tomorrow I'll keep fighting | I'll | 227.86–227.96 | 0.5 | `qa/line_89.png` | – |
| L90 | Tomorrow I'll keep building | Tomorrow | 229.98–230.66 | 0.67 | `qa/line_90.png` | ok (/t/ 229.96–230.00) |
| L90 | Tomorrow I'll keep building | I'll | 230.66–230.86 | 0.58 | `qa/line_90.png` | – |
| L91 | Tomorrow I'll keep carrying the weight | Tomorrow | 232.76–233.38 | 0.66 | `qa/line_91.png` | ok (low "To-" note 232.77) |
| L91 | Tomorrow I'll keep carrying the weight | I'll | 233.38–233.54 | 0.5 | `qa/line_91.png` | – |
| L91 | Tomorrow I'll keep carrying the weight | the | 235.26–235.56 | 0.6 | `qa/line_91.png` | – |

Also for the owner: L86 "I'll" (FIX, conf 0.7). Seven `extras` are still "unlisted vocal"
(66.9, 100.2, 111.8, 117.4, 145.7, 167.1, 183.2; each 0.5–1 s): backing ad-libs or breaths
between lines that I have not identified.

## Treatment checks (NOTES-port d11/d12)

Windows use the treatment's `cutDown()` semantics on this data. Kicks are from the drums stem;
"strong" means strength ≥ 0.4.

- **`pieces`** [29.179, 36.874), 11 beats: **12 kicks** (11 strong). The treatment wants 14
  cuts, so the fallback applies: the last 2 kicks cut two pieces each (ASKS jumps by 2 twice).
  The kicks are at 29.36 29.88 30.24 30.94 31.40(weak) 31.96 33.36 34.43 34.95 35.49 36.53
  36.77. Note the gap 33.36 → 34.43 ("so much weight").
- **`dark`** [48.767, 52.965), 6 beats: **8 kicks**, exactly the 8 wanted (ASKS 15 → 22).
  One of them, 49.88, is a weak ghost (0.28). Counting only strong kicks gives 7, so a double
  buzz on the last kick would apply. The kicks are at 49.48 49.88 50.16 51.21 51.56 51.74
  52.27 52.79.
- **`ceiling` slab steps** from "Same pressure on my chest" (24.60):
  - to the start of "While I'm struggling to rest" (27.93): **4 kicks** (25.35, 26.18 weak,
    26.39, 27.78).
  - through the end of that line (29.60): **6 kicks** (+28.83, 29.36), but 29.36 is past the
    `pieces` cut at 29.179.
  - **up to the `pieces` cut: 5 kicks**, the slab landing on 28.83.
- **Free bar before "Got dreams"? No.** "sometimes" ends at 117.30 and "Got dreams" starts at
  118.18: a gap of 0.88 s (1.25 beats), with no downbeat in it (the neighbours are 116.63 and
  119.42). `scars` cuts at 118.025 and holds the voicemail frame to its first downbeat, 119.42
  (1.4 s), as d12 planned.

## Script fixes (pdoom leftovers and environment)

- `ctcalign.py`: `N_FRAMES = 7833` was pdoom's length (156.7 s). It is now derived from the
  master (13204 frames), and every emission set is padded or cut to it.
- `whisper_run.py`: passes the 16 kHz samples to faster-whisper instead of a path. Its PyAV
  decoder fails with the PyAV version uv resolves (`open() got an unexpected keyword argument
  'metadata_errors'`).
- `analyze.py`: `BAR_PHASE = 2`; `SECTIONS` entries take an optional word index (choruses and
  outro); chorus 3 is `nth=4`; `NOTES` rewritten.
- `align.py`: `FIX`, `EXTRA_DESC` and `NOTES` filled in.
- `lyrics/drift.src.js`: the phantom chorus-2 pair is removed, and the header is corrected.
- Network: the environment allowlist was missing the PyTorch, Hugging Face (incl. its CDN
  hosts) and `dl.fbaipublicfiles.com` hosts. They were added this session.
