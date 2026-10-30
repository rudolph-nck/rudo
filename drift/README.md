# Drift — kinetic lyric video

RUDO · *Static & Silence*. Vertical 1080×1920, 30 fps, 4:24, original audio. Built on the
Shout It to the Sky pipeline (Remotion + Three.js, morph toolkit, contour RUDO). New this time:
the lyrics drive the effects (a word-effect library keyed to each hero word's timing and voice).

## Status
Step 1 approved (all 94 hero words kept). Step 2 storyboard: `creative/storyboard.html` (scripts/storyboard.py + scripts/sketches.py). Waiting for approval.

## Timing pipeline (no ASR model reachable from this environment)
| Step | Script | Output |
|---|---|---|
| Suno export → OCR of the bold (sung) lyric chunk per frame | `scripts/suno_ocr.py` | `data/suno_ocr_raw.json` |
| Chunk onsets mapped onto the official lyric words | `scripts/suno_chunks.py` | `data/suno_chunks.json` |
| Voice-isolation filter (centre channel + REPET-SIM), loudness + pYIN | `scripts/vocal_features.py` | `data/vocal.json` |
| BPM, beats, downbeats, kicks, energy | `scripts/analyze_audio.py` | `data/beats.json` |
| Word timing, held notes, voice envelope per word | `scripts/build_timing.py` | `data/timing.json`, `data/timing-summary.txt` |
| Spectrogram strips with timing overlay, for hand-checking | `scripts/spec_check.py` | (scratch) |
| Hand-checked onsets (override) | — | `data/anchors.json` |
| Hero words, effects, motifs | — | `data/heroes.json` |
| Step 1 report | `scripts/word_report.py` | `creative/word-analysis.html` |

A Suno vocal stem would replace the OCR/filter approximations with exact word timing.
