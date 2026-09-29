# Visual Language

**One sentence:** a single line of Vivid Blue travels through darkness for four and a half minutes,
becoming a timeline, a plus, a road, a map, a rail, a margin and a stage, until everything the song
names has been drawn onto it.

## Principles
1. **Beautiful before busy.** Every frame should hold up as a still. At most one hero idea per moment.
2. **The line is the protagonist.** It is present in every chapter and every transition. Its end resolves
   into the plus whenever the lyric says *addition / together / one*.
3. **Transitions are transformations.** Each chapter's final state *is* the next chapter's first state:
   point → line → ruler → plus → map → timeline → dial → waveform → curve → type → road → vanishing point
   → constellation → rail → ring → depth planes → mosaic plus → margin → line → helmet visor → monument
   → logo → point.
4. **Darkness is composition.** Field is near-black; light pools define space.
5. **Blue means something.** Vivid Blue marks the line, the plus, the current word, and live nodes.
   Everything else is white or gray.

## Palette (from brand guide)
`--ink #060708` · `--charcoal #0C0E10` · `--anchor #53575A` · `--lunar #CFD3D3` · `--white #FFFFFF` ·
`--warm #F4F1EA` (editorial only) · **`--blue #00B2E3`** · `--deep #00538B` (shadow tint only)

## Type system
| Role | Face | Size @1080p | Treatment |
|---|---|---|---|
| HERO | Open Sans 800, tracking −2% | 140–420 px | Masked rise, track-in, scale on downbeat, lives in 3D |
| NARRATIVE | Inter 300 (hero word Inter 600 / blue) | 34–46 px | Word-by-word rise synced to the line, left-aligned on a grid |
| TECHNICAL | IBM Plex Mono 400/500, caps, +14% tracking | 13–18 px | Typed on; indices, coordinates, timecodes, counters. 45–60% white |
| EDITORIAL | Instrument Serif roman/italic | 60–220 px | Bridge only, plus one aside ("what a year!") |

Layout grid: 12 columns, 96 px outer margin, baseline 8 px. Type is placed on the grid off-centre far more
often than centred. Hero words may bleed out of frame.

## Motion
- Default easing: `expoInOut` for camera moves, `quintOut` for reveals, `cubicInOut` for holds/drifts.
  No bounces. Overshoot ≤ 2%, only on downbeat hits.
- Camera always drifts (0.3–1% per second push or lateral) so stills never feel frozen.
- Fast moves (≤ 8 frames) are reserved for: drop @29.9, chorus @57.5, "LET'S ROLL" @75.9, beat switch @116.1,
  final drop @226.0, "TOGETHER" @247.3.
- Beat response: line brightness +15% and ticks on every beat; downbeats may scale hero type 1.0→1.02.

## Depth
CSS-3D stage with a real perspective camera (shared projection math with the canvas particle layer), so
type, grids, roads and maps sit on genuine planes in one space. Three.js (via `@remotion/three`) is
used where lit, sculptural geometry is the point: the extruded plus monument in the final drop.

Layers per frame (back → front): field gradient · atmosphere/particles · grid/geo planes · the line ·
hero type · narrative/technical type · light (pools, sweeps) · grain + vignette.

## Imagery
Supplied images are *fragments*, never slides:
- DJ helmet: emerges from black lit only by its own A+ visor ("JAX… YOU READY?").
- DJ booth: framed in a brand notch (bottom-right), graded down, the line passing behind the DJ.
- Addapalooza logo: revealed by a light sweep and a mask at the welcome; the line runs through its
  "THE SUMMIT" bar.

## Finishing
Fine animated grain (≈7% overlay), soft vignette, pre-blurred light pools (no global bloom), a restrained
glow only on the line/plus, and a one-frame luminance flash only on the three biggest drops.
