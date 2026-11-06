# Phases 3–6 report: the plates, continuity, the draft

All 17 plates exist (`app/src/scenes/`). The karaoke placeholder now only covers nothing (every timeline
entry has its own module). Plates were built one per agent from a shared brief (CLAUDE.md workflow:
stills at the first sung word / main hit / last frame, looked at; contact sheet looked at), then reviewed
by the lead against the treatment; hand-offs between neighbouring plates were fixed in follow-ups.

## The plates (window, what it does)

| entry | window (s) | what it does |
|---|---|---|
| `seam` | 0–22.18 | the loop frame; title card for one bar; "Yeah…" exhales 900→300; spoken lines typed in mono with the voice; clock stops on "stop"; seam dims on "for a minute" |
| `ceiling` | 22.18–29.18 | looking up (the hairline is the ceiling edge), lyric on the ceiling plane; tilt down to the seam; the slab steps down on the strong kicks; "blessed" in upright Cormorant; the last line tips over onto the floor (carried into `pieces` so "rest" lights) |
| `pieces` | 29.18–36.87 | ME cut into labelled pieces on the kicks, ASKS 01→14 (doubles on the late kicks so it reaches 14 before "mine"); the clock's hands torn off; pieces heap onto the sinking slab |
| `wall` | 36.87–48.77 | inverted bone paper; certificates hung on the beats with the lines as Cormorant titles; edge-on track for "disconnected"; floor line |
| `dark` | 48.77–52.96 | renders `wall` until the downbeat, flips to ink; frames as hairlines; the face-down phone glows on the kicks (ASKS 15→22); `Unknown · calling…`; its glow dies into `break`'s amber point |
| `break` | 52.96–57.16 | the point rides the seam under the lyric (tracked run); full stop left behind; the seam opens and the point drops into the gap; push about the seam |
| `hook1` / `hook1b` | 57.16–60.66 / 83.75–91.44 | the slam (I DON'T / WANNA / DIE → I JUST / WANNA / DRIFT); DIE drains on "just"; DRIFT lifts on tethers; the reprise opens on `stars`' downward look and brings DRIFT down |
| `stars1` / `stars2` | 60.66–83.75 / 139.01–162.10 | crane through ceiling and roof; constellation labels; the slab rising on its tether; NO slams wiping DUE / checklist / bubble on the kick; hard cut to the downward look (tethers converge on home). `stars2` opens on hook2's bone field |
| `drive` | 91.44–101.24 | seam = horizon of a night road; lyric on overhead signs; notifications in the mirror (ASKS 22→31); dashboard above the UI band |
| `apart` | 101.24–107.53 | praise (Cormorant) and asks (mono) land on the kicks (ASKS 31→40); the reply field typed and deleted; bubbles close in, then recede miles apart |
| `voicemail` | 107.53–118.03 | one shot: `Dad · 0:42 · saved`, the seam is the waveform, the LED scrubber under the sung glyph; the replay on "play" |
| `scars` | 118.03–129.22 | holds voicemail's last frame to the downbeat (the line set over it); slab swings up; carry's cracks one per word; carved line; the textureless "nothing" bar |
| `breath` | 129.22–135.51 | "forever" loosens along the seam; the seam becomes a breath trace; the point opens a bone door into hook2 |
| `hook2` / `hook2b` | 135.51–139.01 / 162.10–169.79 | n=2: inverted (ink on bone, drawn by the scene), heavier, DRIFT rises two-thirds; hook2b pulls DRIFT flat onto the seam on the cut |
| `carry` | 169.79–192.18 | the slab close, invisible labels; ME's pieces don't fit; the one italic confession line; the world's asks arrive into `silence`'s room (ASKS 41) |
| `silence` | 192.18–201.97 | seven beat cuts switching the room off; ASKS 41→00; the breath trace on "Just breathing" |
| `hook3` | 201.97–206.87 | n=3: hairline, small, slow; DIE simply fades; DRIFT rises to the safe top |
| `under` | 206.87–227.16 | GUILT/PAST mirrored under the seam, tendrils fall short; the noise parts; the tether tightens then slackens |
| `tomorrow` | 227.16–264.08 | dawn along the seam; three TOMORROWs; the slab set down; clock 05:58 → stops → resets to 04:37; last frame = frame 0 (verified numerically, grain-level difference) |

## Engine / shared changes made in these phases
- `post.ts`: bloom knee hardened (threshold 0.9, knee 0.1) so bone type never blooms; CA lowered (0.5) and
  faded out at the frame edge (it pulled a coloured line in from past the edge).
- `timeline.ts`: `hook3` cuts on the first beat after "Just breathing"; `stars2` gets `params: { n: 2 }`.
- `_motifs.ts`: `HANDOFF` (phone glow, downward look) and `SLAB` size.
- Shared plate helpers: `hook-drift.ts` (DRIFT), `stars-down.ts` (downward look), `wall-frames.ts`,
  `ceiling-floorline.ts`, `carry-lines.ts` (last line + slab cracks), `voicemail-player.ts` (the hold frame).

## Continuity (Phase 5)
- Whole-song cut pairs (last frame before / first after every cut): `out/wip/continuity/cuts_{1,2,3}.png`.
  Every cut keeps the seam at y = 1240; amber point, slab, clock hand-offs match where they cross a cut.
  The one break found (hook2 → stars2: stars always opened on the n=1 look) is fixed.
- Deliberate hard changes: wall's bone paper in/out (pieces→wall, dark's downbeat), hook2's bone field
  (breath opens it as a door; hook2b → carry flips back to ink "back on the floor").
- ASKS: 00 · 01→14 (pieces) · 14 (wall) · 15→22 (dark) · 22→31 (drive) · 31→40 (apart) · 40 (voicemail,
  scars, breath; frozen in the choruses) · 41 (carry) · 41→00 (silence).
- The loop: `tomorrow`'s last frame equals frame 0 (diff statistics identical to the grain-only baseline).

## Draft
(pending: the 30 fps draft is rendering; this section is filled in after it has been reviewed)

## Rendering the final (on a Mac with a GPU)
The cloud container renders with SwiftShader (CPU): ~0.3–0.4 s per frame at one sample, so the motion-blurred
final isn't practical here. On the Mac:

```
cd lyric-video/app && bun install
bun scripts/render.ts video --samples auto --shutter 0.2 --out ../out/drift.mp4            # 1080×1920, 60 fps
bun scripts/render.ts video --samples auto --shutter 0.2 --scale 2 --out ../out/drift-4k.mp4 # 2160×3840 for upload
```
