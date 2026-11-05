# Phase 0 — port notes (Drift)

Read: ref/docs/TREATMENT.md, ref/docs/ENGINE.md, ref/app/src/timeline.ts, engine/scene.ts,
lyrics.ts, audio.ts, scenes/hook.ts, scenes/loss.ts (+ _motifs.ts, palette.ts, type.ts, post.ts,
hud.ts, gl.ts, scripts/render.ts, analysis/common.py, make_fonts.py for the specifics below);
CLAUDE.md, docs/STYLE.md, docs/TREATMENT-drift.md, docs/cover.png.
Measured on the provisional audio: librosa beat period ≈ 0.70 s → **≈ 86 BPM confirmed**.

---

## (a) The scene API in my own words

- A scene is one file `app/src/scenes/<plate>.ts` that default-exports a class extending `Scene`.
  The timeline gives it a window `[start, end)` and optional `params`; one module can serve several
  entries (`hook` ×3 via `params.n`).
- `init()` (async, once) builds everything expensive: geometry, text layouts, outlines, shaders.
- `render(f, out)` must **fully overwrite** `out`, a HalfFloat linear-HDR target at physical
  resolution, and may return post overrides: `bloom, grain, vignette, shake:[x,y], zoom, fade,
  flash, invert, exposure, halation, ca, hud…`. Values above ~0.85 linear bloom.
- `f` carries song time `t`, local time `lt`, window progress `p`, continuous `beat/bar` and their
  phases, and `f.a`: envelopes (`rms, low, mid, high, vocal, drums, bass, other`) plus decaying hit
  pulses (`kick, snare, hat, vonset`). `f.under/tin/tout` exist for overlapping (crossfade or custom)
  transitions; windows that only touch give a hard cut, which is what we want almost everywhere.
- `this.ctx` holds `renderer, audio, lyrics, comp` (alpha-over or blend compositor), `W, H`,
  `params, start, end`.
- Drawing tools: `FSPass` (fullscreen GLSL with palette consts, noise and SDFs), `Layer2D` (a
  logical-px Canvas2D uploaded as a texture, max 2–3 per scene), `LineBatch` (GPU capsule lines in
  2D or 3D, for hairlines, tethers and stars), three.js for real 3D, `type.ts` (`F.archivo(w, wt)`,
  `F.mono`, `F.serif`, `layout()`/`glyphX()` for kerned glyph-by-glyph drawing, `textPath2D`,
  `textPoints`), `stroke.ts` (single-stroke fonts written over time).
- Hard rules: output is a pure function of `f.t` (sub-frames render out of order for motion blur;
  `frameIdx(t)` for flicker); `stateful` scenes can't use adaptive sampling; lyrics are looked up
  by content (`lyrics.get(q, nth)`, which matches any part of a line's text, ignoring case and
  quote style); `Lyrics.wordProgress(w, t)` gives 0 → 1 across a word (by syllable when available).

## (b) How the timeline derives cuts from lyrics

- `makeTimeline(ly, au)` runs once on the aligned data. `cut(q, nth)` takes the first word's
  `start` of the nth line containing `q` and snaps it **down to the last beat** at or before it
  (`floor(beatAt(start + 0.02))`), so a cut never lands after the first sung word. `after(q)` snaps
  a line's end to the nearest downbeat. The outro can be anchored to `au.sections`.
- The `b` table then gives each plate its window (`E(id, file, start, end, extra)`), which runs
  from one anchor to the next; consecutive windows touch, which gives a hard cut. Modules load
  lazily through `import.meta.glob`, so a missing or broken scene renders black instead of breaking
  the build, and `render.ts --only <ids>` isolates entries.
- Extra per-entry options: `params`, `maxSamples` (cap on the adaptive sampler).
- Consequence for us: **`cut()` snaps to a beat, not a downbeat** (see d1).

## (c) Every 1920×1080 assumption that must change for 1080×1920

Engine (Phase 2 port):
1. `src/engine/gl.ts:9-10`: `W = 1920, H = 1080` → `W = 1080, H = 1920`. `PW/PH`, `makeRT`,
   `Layer2D`, `LineBatch` and the grain all derive from these, so they follow automatically.
   (`engine.ts` `rgbRT` uses `(PW*3)/4`, which still divides evenly for 1080.)
2. `src/engine/scale.ts`, `glsl/common.ts:13`, `gl.ts:182`: comments only ("1920x1080").
3. `index.html:11`: `aspect-ratio: 16/9` → `9/16`. `index.html:22`: export canvas
   `1920px × 1080px` → `1080px × 1920px`.
4. `scripts/render.ts`:
   - line 26: `OW = 1920*SCALE, OH = 1080*SCALE` → swap the two numbers.
   - line 56: viewport `{1920, 1080}` → `{1080, 1920}`.
   - line 65: fallback size → `1080`/`1920`.
   - lines 81 and 325: screenshot clips → `1080×1920`.
   - The usage text on line 12 needs updating too.
5. `render.ts:90` contact sheet: cell size `cw=480, ch=270` → `cw=270, ch=480`, or the sheets
   come out squashed. With `--cols 4` a 16-frame sheet becomes 4×4 tall cells; consider
   `--cols 8` as the default for vertical.
6. `src/engine/post.ts:150`: the vignette uses `length(dc * vec2(1.0, 0.8))` in uv space, tuned to
   a wide frame. For 9:16 use `vec2(0.8, 1.0)` or an aspect-correct radius, and re-tune by eye
   against the cover's falloff. CA (`post.ts:132-133`) already uses `res`, so it's fine.
7. `src/engine/post.ts:141`: halation is tinted with a hard-coded `vec3(1.0, 0.18, 0.04)`
   (p(doom)'s hazard orange). Change it to lamp, or it brings a hue outside the palette into every
   bloom.
8. `src/engine/hud.ts`: crop marks at the four corners, P(doom) readouts at `(64, H-66)` and
   `(W-64, H-66)`, and a `paper` mode. RUDO has no global HUD: the clock and ASKS are staged in the
   plates. Strip the HUD to nothing (keep the `hud` post param at 0) and delete `PDoom`;
   `hook.ts`/`loss.ts` import it, but all scenes are deleted in Phase 2 anyway.
9. `src/engine/palette.ts` + `glsl/common.ts:18-26` + `heat()` (common.ts:161): the keys are
   `ink, ink2, graphite, ash, bone, signal, ember, blood, acid`. STYLE's are
   `ink, concrete, dust, bone, lamp, ember, dawn`. Engine code (post, `heat()`, `_motifs`) references
   `signal/blood/ink2/graphite/ash`. Rename the keys and fix every reference in engine and motifs,
   rather than keeping aliases, so no p(doom) colour can leak in. `heat()` has to be rebuilt on
   ink → ember → lamp (there is no `blood`). Note: STYLE gives bone as `#E3DED4` (the reference is
   `#EEE9DF`), and the invert in `post.ts:147` (`0.8515 - col*0.84`) is calibrated to the old
   ink/bone pair; it needs recomputing, or don't use `invert` at all (see d10).
10. `docs/ENGINE.md` safe area: "≥ 96 px from the edges, clear of the HUD corners (bottom-left
    360×140, bottom-right 700×140)" → STYLE's vertical rules: lyrics in `y ∈ [220, 1480]`,
    `x ∈ [120, 960]`; nothing in the top 200 px or the bottom 420 px except stars and tethers;
    seam at y ≈ 1240.
11. Fonts are already the right three families; nothing to add. Archivo comes as static instances
    only (see d2).
12. Cosmetic: `window.__pdoom`, `PDOOM_NO_HMR`, the `audio/pdoom.mp3` path (`analysis/common.py:19`),
    `LYRICS_SRC`, and `STEM_OFFSET_SAMPLES` (measured for pdoom's Demucs stems; must be re-measured
    or removed for Drift, especially if we align on Suno's own vocal stem).

Scenes (all deleted in Phase 2, but these are the habits to unlearn): `hook.ts` and `loss.ts`
hard-code landscape geometry everywhere: `BIG/HAIR` layout constants (`numSize 720`,
`barW: W-236`), `H/2` baselines, a camera mapping `W/2 + px*(H/2)` that assumes width > height,
and hand-off coordinates copied from neighbouring plates. Text widths are a different problem in
portrait: **the usable line width is 840 px, not ~1700**. Every "set the line across the frame"
idiom needs wrapping or stacking, including the Phase 2 `karaoke` placeholder. Long lines ("And old
voicemails I still play sometimes", "Somewhere I can hear myself again", "Tomorrow I'll keep
carrying the weight") won't fit on one row at a readable size.

## (d) Things in TREATMENT-drift.md the engine can't do as written (or that contradict STYLE)

Ordered by how much they matter. Each has a proposed fix; the first six need a decision before
Phase 1/2.

**d1. "Hard cuts on downbeats" vs `cut()`.** `cut()` snaps to the last *beat*. Snapping to the last
downbeat instead would often cut up to a bar early, into the previous line. Proposal: add
`cutDown(q, nth)` in timeline.ts that uses the last downbeat if it is ≤ 1 beat before the first
word, otherwise the last beat. Use it for the plate boundaries and keep `cut()` for the hooks,
whose first word is the hit.

**d2. Continuous width/weight animation.** The treatment animates "weight 900 → 300" (Yeah),
"width 125 → 62" (ceiling), "weight 900 → 300" (scars *nothing*). The engine has static Archivo
instances only: 6 widths × weights 300/500/700/900, because Canvas2D and opentype.js need static
outlines. As written, the animation would step visibly. Fix: extend `analysis/make_fonts.py` to
generate finer instances (weights every 100, widths every 12.5 → 7 × 7 = 49 files, a few MB) and
let `F.archivo()` round to the nearest one. Or, for the two hero moments, interpolate outlines
between two instances via `textPathCommands` (same glyph topology across instances of a variable
font). Decide in Phase 2.

**d3. The hook repeats aren't in the timeline.** Each chorus ends with the hook sung again
(chorus 1: "I don't wanna die / I just wanna drift" ≈ 1:18–1:28; chorus 2 sings it *twice* there,
≈ 2:36–2:46). Plate 8 says "The hook repeat follows", but the skeleton gives that time to
`stars`. Either:
- (recommended) add entries `hook1b` and `hook2b` (`hook`, `params: { n, reprise: true }`) from
  `cut("I don't wanna die", 1)` and `cut("I don't wanna die", 3)` to `drive` and `carry`; or
- tell `stars` it owns a hook reprise and must render the slam itself, which puts the hook in two
  modules and invites drift between them.

Either way `hook` must handle chorus 2's double repeat (die/drift/die/drift).

**d4. Safe-area conflicts inside the treatment.**
- `drive`: "the machine voice is the dashboard **at the bottom**". The bottom 420 px is no-words
  territory. Move the dashboard up to y ≈ 1300–1460 (below the horizon seam, above the UI band)
  or make it the top band (y 220–330).
- `apart`: "the reply field **at the bottom**", and the lyric is typed into it. Same fix: put the
  field just above y = 1480.
- `under`: GUILT and PAST "below the seam, upside down": fine only if they sit in 1240–1480.
  That's 240 px; say so in the plate.

**d5. `silence`: "seven hard cuts, every one on a downbeat".** The seven breakdown lines span about
191–202 s, about 16 beats (4 bars) at 86 BPM, roughly one line per 2 beats. They can't each start on
a downbeat. Fix: cut on the beat each line starts (`cut()`), with "Just silence" and "Just breathing"
on the last two downbeats if the alignment allows. Also a timeline question: the seven sub-cuts
live *inside* the `silence` scene (one window), so the scene computes them from the line starts;
it does not get seven timeline entries. Say so.

**d6. The loop: first frame vs last frame.** Plate 1 starts on **black** ("Black. The seam fades
in"). Plate 17 ends on "the seam becomes the ceiling edge of plate 1, clock 04:37". For the loop to
be invisible the two frames must be identical. Decide one:
- frame 0 is the seam already lit plus the clock, with no fade-in, and `tomorrow` ends there; or
- `tomorrow` ends on black, after the seam dims.

Related ambiguity: is plate 1's line the **wall/floor seam** (plate 1 text, STYLE y ≈ 1240) or the
**ceiling edge** (plate 2 "the seam is revealed as the ceiling edge… the camera tilts down" and
plate 17 "becomes the ceiling edge of plate 1")? Pick one reading and fix both plates' wording.
Also the clock goes 05:58 → 04:37 at the end. Make the jump a deliberate event (the seconds stop,
then it *resets* on the loop frame), or it reads as a bug.

**d7. Sacred-voice budget.** STYLE: Cormorant italic is one line per song (*Maybe I don't need
fixing / Maybe I just need peace*). But `ceiling` sets *blessed* in the serif, and `wall` sets
every certificate title in the serif. Either allow upright Cormorant (roman) as "somebody else's
voice" and reserve only the *italic* for the confession line (my recommendation: write that into
STYLE), or move *blessed* and the certificates to Archivo/mono.

**d8. The machine voice comes back too early.** The treatment says the mono voice is gone after the
breakdown "until the outro's clock", but `under` fills the frame with "dense mono text — every
label and notification from the whole video, scrolling". Either `under` is an allowed exception
(write it in), or the noise wall is rendered as illegible hairline texture rather than set type.

**d9. Hand-off and continuity rules that can't hold literally.**
- KICKOFF Phase 3 prompt 1 checks "the seam at the same y in the last frame of `seam` and the
  first frame of `hook`". They are not adjacent (ceiling → … → break → hook). The real seam check
  for hook is **break → hook1**, **breath → hook2** and **silence → hook3**.
- "Seam y constant across every cut" conflicts with plates that move the camera on purpose:
  `hook` ("the seam is at the bottom"), `stars` (crane up, the seam far below), `drive` (seam =
  horizon), `voicemail` (seam = waveform), `under` (hairline at the bottom). Restate the rule as:
  *at every cut, the outgoing frame's seam y equals the incoming frame's seam y*. Plates can
  move it inside their window.

**d10. Inverted plates.** `wall` and `hook n=2` go bone-paper with ink lines, "lamp stays lamp".
The engine's `invert` post flips everything, lamp included, and its constants are calibrated to
p(doom)'s ink/bone. Scenes must draw bone paper themselves and never return `invert`. Note it in
ENGINE.md.

**d11. Kick-count assumptions — verify after Phase 1.**
- `pieces`: 14 cuts "on every kick" across "Everybody needs a piece of me … what's actually mine"
  (≈ 28–36 s, about 11–12 beats). 14 cuts only happen if the 808 pattern is denser than one per
  beat. If it isn't, allow two cuts per kick at the end, or let ASKS jump.
- `ceiling`: the slab lowers "one step per kick" over two lines. Fine, just count them.
- `dark`: "each buzz adds an ASK (15 → 22)", one per kick over two lines: 8 kicks needed.

**d12. `voicemail`: "Hold the last frame for a full bar".** "…play sometimes" ends at about 117 s
and "Got dreams" starts right after. There is probably no free bar. Either the hold runs under the
first bar of `scars` (so `scars` opens on the voicemail's last frame), or drop the hold. Check after
alignment.

**d13. Small wording issues for the scene authors.**
- `ceiling`: "the whole line rotates 90° to lie on the floor". This means a 3D rotation about the
  horizontal axis onto the floor plane (text on a perspective plane), not a 2D rotation. Doable
  (Layer2D texture on a three.js plane, or projected outlines); say it.
- STYLE's clock motif is `HH:MM AM` "seconds ticking", but there are no seconds in that format.
  Pick `04:37:12 AM`, or a blinking colon as the "tick".
- `under`: "tendrils… fall short on the beat" and "tether tightens": fine.
- `scars` *nothing*: one bar with grain, bloom and vignette all 0. The post overrides support
  exactly this.
- `stars`: "a few hundred bone points" with "one or two hairline constellations": fine with a
  `LineBatch`.

**d14. Already fixed before this pass.** `hook3` is `cut("I don't wanna die", 5)` (chorus 2 sings
it three times).

---

## Not a problem (checked)

- 1080×1920 at 60 fps is the same pixel count as 1920×1080: same per-frame budget, and `--scale 2`
  (2160×3840) works the same way.
- Post overrides cover everything the treatment asks of the frame: one-bar texture drop, 2 px nail
  shake, 808 zoom pulse (`zoom`, `shake`, `f.a.kick`), and the snare snaps.
- Every `cut()` query in the skeleton matches exactly the intended line in `lyrics/drift.src.js`.
  The matching is by substring, so `"I'm not looking for an ending"` finds "And I'm not looking for
  an ending". `'Float somewhere', 1` is chorus 2.
- The amber point maps directly onto `sparkHead`/`sparkParticles` in `_motifs.ts`. Tethers, the
  seam and stars are `LineBatch` hairlines (`pxLine` keeps them identical at 2×).
