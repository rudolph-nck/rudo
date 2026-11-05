# audio

- `drift.mp3` — PROVISIONAL. Extracted from Suno's lyric-video export (Drift.mp4, AAC 196 kb/s,
  re-encoded to 320 kb/s mp3). Replace it with the exact Suno master you will release
  **before Phase 1**: alignment is tuned to the exact file.
- `stems/drift-vocals.mp3`, `stems/drift-backing-vocals.mp3` — Suno's own stems (48 kHz,
  264.12 s, LAME delay 23 ms = 1105 samples). The lead stem is cleaner than a Demucs
  separation; Phase 1 can feed it to the CTC aligner directly (check the offset against the
  master by cross-correlation first, as ref/analysis/common.py does with STEM_OFFSET_SAMPLES).
