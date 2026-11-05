# RUDO lyric-video engine

This repo renders kinetic-typography music videos as code. Every frame is a
deterministic function of song time. Read docs/STYLE.md, docs/ENGINE.md and
the current docs/TREATMENT-<song>.md before any scene work. The engine is a
fork of mexicat/pdoom-video (MIT); ref/ holds a clone for reference only.

## Non-negotiables
- Output is a pure function of f.t. Never Math.random(), Date.now(),
  performance.now(). Seeded hashes only (mulberry32, hash). Per-frame flicker
  uses frameIdx(t), never Math.floor(t * 60).
- Scenes look up lyrics BY CONTENT (lyrics.get('text')), never by seconds.
- Big changes land on downbeats, kicks or snares from data/audio.json.
- A word highlights at its start and completes by its end. Never early.
  Anticipation (dim words up to 0.4 s early) is fine.
- One palette (docs/STYLE.md). Only the signal colour may exceed 0.85 linear.
  Paper type stays crisp and never blooms.
- Logical canvas is 1080x1920 (vertical). Never hard-code pixel sizes
  outside W/H. Lyrics stay inside the vertical title-safe area (STYLE.md).
- < 25 ms/frame in preview. Precompute in init(). Max 3 Layer2D per scene.
- No outlined or haloed type. Real kerning via layout()/glyphX().
- Taste: no neon purple/cyan, no glowing brains, no particle nebulae, no lens
  flares, no stock AI imagery, no emoji, no logos, no copied artworks, no
  figures or faces.

## Ownership
- Scene work touches only app/src/scenes/<plate>.ts and helper files named
  app/src/scenes/<plate>-*.ts. Never edit app/src/engine/ or
  app/src/timeline.ts during scene work. If a scene needs an engine change,
  say exactly what and stop; the lead does engine changes in their own session.
- Shared motifs live in app/src/scenes/_motifs.ts (the seam, the amber point,
  the slab, the tether, the clock). Read-only for scene work; ask the lead.

## Workflow for every scene
1. Read the plate's paragraph in the treatment and the lyric lines it owns.
2. Write app/src/scenes/<plate>.ts extending Scene.
3. Typecheck: cd app && bunx tsc --noEmit -p tsconfig.json 2>&1 | grep scenes/<plate>
4. Render stills at 3+ timestamps (first sung word, the main hit, last frame):
   bun scripts/render.ts stills --t a,b,c --only <plate> --out ../out/wip/<plate>
5. LOOK at the PNGs with the Read tool. Check: sync, legibility, palette,
   safe area, motion on the beat, seam position. Fix and re-render until all pass.
6. Render a contact sheet of the whole window and look at it:
   bun scripts/render.ts sheet --from <start> --to <end> --n 16 --cols 4 --only <plate> --out ../out/wip/<plate>/sheet.png
7. Report: what the plate does, what you checked in the stills, and anything
   in the treatment you could not realize.

## Commands
- Preview: cd app && bunx vite      (http://localhost:5173/?t=23)
- Stills:  bun scripts/render.ts stills --t 12.5,13.0 --only seam --out ../out/wip/seam
- Sheet:   bun scripts/render.ts sheet --from 10 --to 20 --n 16 --cols 4 --only seam --out ../out/wip/seam/sheet.png
- Cuts:    bun scripts/render.ts sheet --cuts --out ../out/wip/cuts.png
- Clip:    bun scripts/render.ts video --from 20 --to 25 --only hook --out ../out/wip/hook.mp4 --preset veryfast
- Draft:   bun scripts/render.ts video --samples 4 --out ../out/<song>-draft.mp4
- Final:   bun scripts/render.ts video --samples auto --shutter 0.2 --out ../out/<song>.mp4
