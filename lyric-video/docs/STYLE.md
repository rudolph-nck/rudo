# RUDO — style bible (album-wide)

Every RUDO video shares this file. Per-song decisions live in docs/TREATMENT-<song>.md.
Modelled on the treatment/engine docs of mexicat/pdoom-video; same discipline, different world.

## The world

The room on the album cover: a bare concrete room, one warm overhead light, a dark polished
floor that reflects it, and the seam where the wall meets the floor. Nobody is drawn. No figures,
no faces. The room is the character; the lyric is every object in it.

## Frame

- Logical canvas 1080×1920 (9:16). Export 1080×1920 at 60 fps; `--scale 2` for 2160×3840.
- Title-safe (vertical, TikTok/Reels): lyrics between y = 220 and y = 1480; x ≥ 120 from each side.
  The bottom 420 px is UI overlay territory: no words there, ever. The top 200 px likewise.
- The seam sits at y ≈ 1240 (two-thirds down, like the cover) unless a plate moves the camera.
- Compose for a phone in one hand: one idea per frame, type readable at arm's length.

## Palette (linear values in app/src/engine/palette.ts)

| name | hex | role |
| --- | --- | --- |
| ink | #0B0B0C | background |
| concrete | #2A2826 | the lit wall, panels |
| dust | #8F8A82 | secondary type, hairlines at rest |
| bone | #E3DED4 | paper, lyric type |
| lamp | #E8A04A | **the signal colour**: the one warm light. The sung word, the amber point, every screen glow, the sun at the end |
| ember | #C76A1E | hot cores inside lamp glow |
| dawn | #F4C27A | rare accent, owned by one moment per song (Drift: the outro) |

Rules: only lamp/ember may exceed ~0.85 linear (bloom). Bone type stays crisp. No other hues.
Some plates invert to bone paper with ink lines for light/dark rhythm; lamp stays lamp on both.
Stars are bone points, never lamp.

## Typography

- **Archivo** (variable: width 62–125, weight 300–900): the lyric voice. Wide and tracked
  (+0.08 em) like the cover's title when it's a title; condensed (62) under pressure; wide (125)
  and light (500) when drifting.
- **IBM Plex Mono**: the machine voice. Clocks, counters, notifications, dashboards, forms.
  In RUDO videos the machine voice is *the world asking*. Typewriter quotes.
- **Cormorant Garamond italic**: the sacred voice. One line per song, the confession line.
- Single-stroke fonts (stroke.ts) when something is written by hand or by the amber point.
- Kerned glyph by glyph (layout()/glyphX()). Typographic punctuation in lyric and serif voices.
- No outlined or haloed type. No glyphs from outside the three families.

## Motion

- Something is always moving; big changes land on downbeats, kicks, snares. Camera eases into beats.
- Strong eases (outExpo, inOutCubic, springs). Hold → snap. No floaty drift between scenes.
- Hard cuts on downbeats are the default transition.
- Tempo is slow (RUDO ≈ 86 BPM: beat 0.698 s, bar 2.79 s). Cut on downbeats or every two bars.
  808s drive a soft zoom/shake pulse (hit('kick', t, 0.25)); snares drive snaps; the piano/other
  envelope drives slow camera drift. Use the silence before a line: hold, then land the word.
- Camera moves are physical: tilt, push, crane, track. The room is real.

## Karaoke rules (all plates)

- Every lyric line readable and synced per word: appears/highlights at `start`, completes by `end`.
- Each plate integrates the lyric graphically and differently: set on a surface in perspective,
  cut into pieces, typed as a reply, ridden on a waveform, carved into a slab, placed as
  constellation labels. Never a subtitle on top.
- Sung portion in lamp or bone; unsung at 30–40 % or hairline.

## Album motifs (app/src/scenes/_motifs.ts)

1. **The seam**: one bone hairline, the wall/floor edge. Becomes other lines (ceiling edge,
   horizon, waveform, breath trace, dawn line). It never breaks except as a deliberate door.
2. **The amber point**: a lamp-coloured point with a soft core that travels the seam, lights
   words as it passes under them, and is the only thing that ever leaves the seam — on a tether.
3. **The slab**: a plain rectangle of the wall, hairline-drawn with concrete texture. The weight.
4. **The tether**: a hairline from any floating thing straight down to the seam. Always present
   when something floats. Taut when pulling back, slack when released.
5. **The clock**: Plex Mono `HH:MM AM`, top-left, seconds ticking; it can stop.

## The hook

Each song's hook is one typographic slam, full width, one word per sung word, that escalates
each time it returns: (1) bone on ink, clean; (2) inverted, heavier; (3) the breakdown: hairline,
small, slow, mostly black; (4, if there is a fourth) maximal: stacked copies, strobe, shake.

## The running state

Each song picks one measurable thing that changes across it, staged inside the plates (never a
corner HUD), frozen in the choruses, paid off full-screen or zeroed at the climax.

## Taste (the not-slop list)

No neon purple/cyan, glowing brains, Matrix rain, lens flares, particle nebulae, stock skies,
stock "AI" imagery. No emoji, cartoon faces, mascots, logos, real product UIs, copied artworks.
Subjects are concrete objects treated as visual puns and transformations, never literal
illustrations of each line. Heavy the way a quiet person is heavy: deadpan counters, small mono
footnotes, things switched off one at a time.

## Craft

- Every scene is checked as stills *looked at* by Claude Code at 3+ timestamps before it is done.
- < 25 ms/frame preview. Precompute in init(). ≤ 3 Canvas2D layers per scene.
- Motion blur is real (sub-frame averaging): fast motion streaks instead of stepping.
- Check at 1× and 2×: the 2× frame should look the same, only sharper (use pxLine() for hairlines).
