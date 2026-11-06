# Phase 2 report: engine port

`app/` is the pdoom-video engine ported to Drift. Every timeline entry plays the `karaoke`
placeholder until its own plate module (`app/src/scenes/<plate>.ts`) exists. Writing that module
makes the plate take over, with no change to `timeline.ts`.

## What changed

- **Canvas** 1080×1920. Changed in: `gl.ts` `W`/`H`, `index.html` (9:16, export canvas size),
  `render.ts` (output size, viewport, screenshot clips, 9:16 contact-sheet cells, default 8
  columns).
- **Palette** = STYLE.md (`ink, concrete, dust, bone, lamp, ember, dawn`) in `palette.ts` and
  GLSL (`C_*`). `heat()` is rebuilt as ink → ember → lamp. No p(doom) key is left anywhere.
- **Post**: halation is tinted lamp, not hazard orange, and the vignette is re-tuned for 9:16.
  `invert` is documented as off-limits; inverted plates draw bone paper themselves.
- **HUD** stripped: no crop marks, P(doom) readout or captions. `hud.ts` is an empty overlay.
- **Fonts**: `analysis/make_fonts.py` makes Archivo instances every 12.5 width (62.5–125) × every
  100 weight (300–900), 42 files. `F.archivo()` rounds to the nearest instance. Plex Mono and
  Cormorant were already there.
- **`_motifs.ts`**: the seam (plus `roomLight2D`, the cover's falloff), the amber point (head +
  tail + embers), the slab (seeded concrete texture), the tether (taut ↔ slack) and the clock
  (`HH:MM:SS AM`, ticking, stoppable). Documented in `docs/ENGINE.md`.
- **`timeline.ts`** follows the treatment skeleton with `cutDown()`. The hook indices are
  corrected for the Phase 1 finding (the hook is sung 5 times): `hook2b` is the single chorus-2
  reprise (3), and `hook3` = 4.
- **Renames**: `__pdoom` → `__rudo`, `PDOOM_NO_HMR` → `RUDO_NO_HMR`, audio `drift.mp3`. The
  p(doom)-only `plates` render mode is removed.
- **New render.ts mode** `timeline` prints every window.
- **Linux rendering**: render.ts launches the container's Chromium with SwiftShader WebGL
  (macOS still uses Chrome with Metal).
- **`docs/ENGINE.md`** is ported: the vertical frame, safe areas, palette, fonts, motifs and the
  placeholder.

## Checks

- **Typecheck**: app and scripts are clean.
- **Contact sheets**: three sheets of 32 frames cover 0–264 s (`out/wip/phase2/sheet_*.png`,
  gitignored). Every line is readable and synced per word, with the amber point under the sung
  word.
- **Lyrics outside the safe area: none.** `karaoke` checks every word's box against
  x 120–960, y ≥ 220 when it lays the lines out, and warns. No warnings for any of the 94 lines.

## Timeline windows (s)

| entry | start | end | | entry | start | end |
|---|---|---|---|---|---|---|
| seam | 0.000 | 22.183 | | scars | 118.025 | 129.218 |
| ceiling | 22.183 | 29.178 | | breath | 129.218 | 135.514 |
| pieces | 29.178 | 36.874 | | hook2 | 135.514 | 139.012 |
| wall | 36.874 | 48.767 | | stars2 | 139.012 | 162.098 |
| dark | 48.767 | 52.964 | | hook2b | 162.098 | 169.794 |
| break | 52.964 | 57.162 | | carry | 169.794 | 192.180 |
| hook1 | 57.162 | 60.659 | | silence | 192.180 | 201.275 |
| stars1 | 60.659 | 83.745 | | hook3 | 201.275 | 206.871 |
| hook1b | 83.745 | 91.441 | | under | 206.871 | 227.159 |
| drive | 91.441 | 101.235 | | tomorrow | 227.159 | 264.080 |
| apart | 101.235 | 107.531 | | | | |
| voicemail | 107.531 | 118.025 | | | | |

Each window holds exactly the lines the treatment gives it. Windows that look wrong:

- **`hook3` starts inside `silence`'s last line.** `cut()` snaps to the beat before "I"
  (201.87), which is 201.275, but "Just breathing" runs 201.21–201.87, so `silence` loses most of
  its seventh line. The hook's "I don't wanna" is a long pickup, and the downbeat it leads to is
  "die" at 203.37. Options:
  - (a) `hook3` renders the tail of "breathing" itself;
  - (b) cut at "I" itself (201.87, off the beat; the hook's first word is the hit);
  - (c) cut on the "die" downbeat (203.37) and let `silence` carry the "I don't wanna" pickup.
- **`hook1b` starts 0.33 s inside the held "bit"** (80.06–84.07). This is minor, and `hook`
  can draw the end of "bit".
- **Small spills** under 0.2 s ("drift" into `stars1`, `drive`, `carry`; "People" 15 ms into
  `drive` because of `cutDown`'s 20 ms tolerance) are below notice.
- **`stars1`/`stars2` are 23 s each and `tomorrow` is 37 s**, as the treatment intends.
  `tomorrow`'s last 20 s are the hum (244–246) and the instrumental tail (≈251–262).

## Not done or not checked here

- Per-frame cost on a GPU. The container renders with SwiftShader (CPU), so `perf` numbers here
  say nothing about the < 25 ms preview budget. Check with `bun scripts/render.ts perf` on the
  Mac.
- Hand-off continuity (`sheet --cuts`): every entry is the same placeholder, so cuts are
  invisible until plates exist.
