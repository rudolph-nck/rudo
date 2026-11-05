# audio

- `drift.mp3` — the Suno master (48 kHz, 177 kb/s, 264.08 s decoded; LAME delay 23 ms is
  trimmed by gapless decoders). Alignment is tuned to this exact file: re-export means re-align.
- `stems/drift-vocals.mp3`, `stems/drift-backing-vocals.mp3` — Suno's own stems from the same
  render. Cross-correlated against the master: **0 ms offset** (same encoder delay), so no
  STEM_OFFSET correction is needed if they're used instead of Demucs output.
