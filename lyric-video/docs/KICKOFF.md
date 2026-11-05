# Kickoff — how to run this with Claude Code

One phase per session. Don't let a session cross phases. You are the lead: you read the
contact sheets and give notes; Claude Code builds.

## Before you start (you, 15 minutes)

1. Install bun, Google Chrome, ffmpeg (with libx264), and uv.
2. `git clone https://github.com/mexicat/pdoom-video ref` next to this folder.
3. Put the song at `audio/drift.mp3` (the final Suno master — alignment is tuned to this exact
   file, so re-export means re-align).
4. Put the lyrics at `lyrics/drift.src.js` in the reference's format (look at
   `ref/lyrics/lyrics.src.js`): one entry per line, rough start times optional.
5. Put the album cover at `docs/cover.png` so Claude Code can look at it.

## Phase 0 — Study (no code)

> Read ref/docs/TREATMENT.md, ref/docs/ENGINE.md, ref/app/src/timeline.ts,
> ref/app/src/engine/scene.ts, lyrics.ts, audio.ts, and two scenes: ref/app/src/scenes/hook.ts
> and loss.ts. Then read CLAUDE.md, docs/STYLE.md and docs/TREATMENT-drift.md, and look at
> docs/cover.png. Write docs/NOTES-port.md: (a) the scene API in your own words, (b) how the
> timeline derives cuts from lyrics, (c) every place the reference assumes 1920x1080 that must
> change for 1080x1920, (d) anything in TREATMENT-drift.md you think the engine can't do as
> written. Do not write any code.

Read the notes. Fix anything in the treatment it flags.

## Phase 1 — Data

> Copy ref/analysis into analysis/. Run Demucs on audio/drift.mp3, then align.py and analyze.py
> to produce data/lyrics.json and data/audio.json with the same schema as ref/data. Generate the
> QA plots. List every word with conf < 0.7 with its plot so I can confirm or fix the boundary.
> Confirm the BPM and list the section boundaries against lyrics/drift.src.js. Note: the song
> has an intro of spoken lines, a breakdown of seven short lines, and a held final "drift" —
> check those three spots by hand.

Check the low-confidence words yourself; fix them in `FIX = {}`. Everything downstream trusts
this file.

## Phase 2 — Engine port

> Copy ref/app into app/. Change the logical canvas to 1080x1920; update safe areas in
> docs/ENGINE.md per STYLE.md; replace palette.ts with STYLE.md's palette; load Archivo, IBM
> Plex Mono and Cormorant Garamond. Delete all scenes. Write app/src/scenes/_motifs.ts with
> the seam, the amber point (with sparkHead-style core and tail), the slab, the tether and the
> clock, per STYLE.md. Write src/timeline.ts from the skeleton in TREATMENT-drift.md. Add one
> placeholder scene `karaoke` used for every entry: it renders the current lyric line in the
> lyric voice with per-word highlighting on the seam. Render a contact sheet of the whole song
> and look at it. Report any lyric outside the safe area and any entry whose window looks wrong.

You now have a complete, boring, perfectly synced karaoke video. Everything after is upgrading
one plate at a time.

## Phase 3 — The spine (one scene per task)

Prompt 1:
> Read docs/STYLE.md and docs/TREATMENT-drift.md. Build the `seam` scene first exactly as plate 1
> describes. Then build `hook` with n=1 as plate 7 describes: DIE un-inking on "just", DRIFT
> lifting on tethers. Follow CLAUDE.md's workflow. Render stills at: first frame, the "stop"
> word, the DIE hit, the "just" un-ink midpoint, the last frame of DRIFT. Look at each. The seam
> must be at the same y in the last frame of `break` and the first frame of `hook1`. Report what
> you verified.

Prompt 2:
> Build `break` and `stars`. The amber point must enter `break` from where `dark`'s phone glow
> will be and exit into the gap on the downbeat; `stars` must start by craning up through the
> ceiling edge and keep a visible tether from every floating word to the seam. Render a contact
> sheet from the start of `break` to the end of `stars` with --cuts and look at every cut pair
> for seam and point continuity. No word may highlight before its start time.

Prompt 3:
> Build `silence` and `tomorrow`. `silence` is seven hard cuts on downbeats, each removing one
> object per the treatment, with ASKS counting 41 → 00 staged in-world. `tomorrow` ends on a
> frame that matches `seam`'s first frame (seam y, clock position, amber falloff). Render the
> first and last frames of the video side by side and look at them. Then render a 4-sample draft
> of the whole song and list every place something moves off the beat.

## Phase 4 — The rest, one plate per task

Template:
> Build the `<plate>` scene per docs/TREATMENT-drift.md. Follow CLAUDE.md's workflow: write the
> scene, typecheck, render stills at the first sung word, the main hit and the last frame, LOOK
> at them, fix until sync/legibility/palette/safe-area/beat/seam all pass, then render a contact
> sheet of the window and look at it. Do not touch engine/ or timeline.ts. End with: what the
> plate does, what you verified, and anything in the treatment you could not realize.

Order: `ceiling` → `pieces` → `wall` → `dark` → `drive` → `apart` → `scars` → `breath` →
`carry` → `under` → `voicemail` last. Hooks n=2 and n=3 after `breath` and `silence` exist.
Subagents are fine here, one plate each; you review each contact sheet and give one round of notes.

## Phase 5 — Continuity and escalation

> Make the motif continuous: render `sheet --cuts` for the whole song and check, at every cut,
> the seam's y, the amber point's position, the slab's size and tether angle, and the clock's
> position. Fix every mismatch. Then make the three hooks escalate per STYLE.md's ladder and
> make sure ASKS reads correctly across plates (01–14, 15–22, 23–31, 31–40, 41, then 41 → 00).

## Phase 6 — Polish and render

> Render the full song at --samples 4. Watch for: any word highlighting before it is sung, any
> text outside safe area, any plate that doesn't move for > 2 s outside `voicemail` and
> `silence`, any colour outside the palette, any transition that isn't a hard cut on a downbeat
> without a reason, and the `scars` "nothing" bar dropping texture cleanly. Fix, then render
> final at --samples auto --shutter 0.2, and a --scale 2 version for upload.

## How to give notes (what the reference's lead did)

Watch the draft on your phone. Write 5–10 blunt notes per pass, numbered, and paste them as one
message. The notes that change the most: *this plate is a subtitle, make the words the object* ·
*nothing lands on the downbeat here* · *too many things in frame, remove two* · *the camera
drifts, give it a hold and a snap* · *the word is readable but not sung-synced* · *the seam moved*.
