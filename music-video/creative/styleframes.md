# Styleframes

Full-resolution stills rendered straight from the final composition (`renders/styleframes/`), one per
key moment. Regenerate with:

```bash
node scripts/stills.mjs renders/styleframes 1 10.7 32.5 43.9 69.5 95.8 131.7 183.6 198.6 205.5 224.0 231.9 250.3 260.8 275.0
```

| # | Time | Moment | Establishes |
|---|---|---|---|
| 01 | 10.7 s | Opening — **2026** rising behind the line | The line is born; the line cuts behind subjects; hero type scale |
| 02 | 32.5 s | Beat drop — the helmet close-up, the visor A+ as an equalizer | The DJ as performer; the brand mark as the music |
| 03 | 43.9 s | Verse — **Envision + Addition cross into the plus** | The film's thesis: the plus is two lines crossing |
| 04 | 69.5 s | Chorus — **AS ONE** on the merged road | Line → road; kinetic lyric band |
| 05 | 95.8 s | Roll call — **one crew** across both regions | Real geography as constellation; one bridge between regions |
| 06 | 131.7 s | Departments — a Rail station | Glyph system; name under the rail; lyrics below |
| 07 | 183.6 s | **ONE ADDITION** — the rail closed into a ring | Line → orbit → plus |
| 08 | 198.6 s | **THAT'S ADDITION.** — the plus made of every name | Recognition; every piece matters |
| 09 | 205.5 s | Intimate — **Teach.** | Warm editorial register: serif, dust, a single margin line |
| 10 | 224.0 s | Tension — **WE MOVE AS ONE.** | Everything collapsed to one line |
| 11 | 231.9 s | Final chorus — the helmet visor as an LED lyric screen | The DJ as the film's performer |
| 12 | 250.3 s | **TOGETHER** | Lines from every direction lock into the plus |
| 13 | 260.8 s | Logo lockup | Brand lines at exact plus weight |
| 14 | 275.0 s | Ending — Addapalooza + tagline + logo | Arrival |

## Design notes from review
- The first draft of the map joined places in the order they were sung, and the zig-zags read as noise.
  Replaced with a nearest-neighbour network: each new place links to the closest one already named, so
  the only long line is the single bridge between the Orlando and Tallahassee regions. That line is the
  merger, drawn.
- Wide map shots are yawed 34° so Tallahassee sits left and Orlando right, filling the 16:9 frame.
- Old labels are hidden in wide shots so the constellation reads as light, not text.
- The ENVISION / ADDITION words were moved off the plus so the thesis frame stays clean.
- The chorus hero type was resized so "ONE RHYTHM" never touches the frame edge.
- The 3D plus monument was removed at the client's request; the DJ now carries the final drop.
