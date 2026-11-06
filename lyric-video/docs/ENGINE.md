# Engine guide (for scene authors)

The video is a web app (`app/`, TypeScript + three.js, run with bun + Vite; a fork of mexicat/pdoom-video) that renders any song time `t` deterministically at **1080×1920 (9:16, vertical)** (or at 2× that, 2160×3840, with `?scale=2`; see "Output scale" below). The same code drives the live preview and the offline 60 fps export. Read `docs/STYLE.md` and `docs/TREATMENT-drift.md` with this file.

## Frame and safe areas (docs/STYLE.md)

- Logical canvas `W`×`H` = 1080×1920. Never hard-code pixel sizes outside `W`/`H`; the constants below live in `scenes/_motifs.ts`.
- **Lyrics stay inside the title-safe area: `x ∈ [120, 960]`, `y ∈ [220, 1480]`** (`SAFE`). The usable line width is 840 px: long lines wrap or stack.
- **No words in the top 200 px or the bottom 420 px** (phone UI overlays). Only stars, tethers and the room may go there.
- The seam sits at `y ≈ 1240` (`SEAM_Y`) unless a plate moves the camera. At every cut, the outgoing frame's seam y equals the incoming frame's seam y; plates may move it inside their own window.
- The clock sits top-left at `CLOCK_POS` (x 120, baseline y 262), inside the safe area.
- There is no global HUD (no crop marks, no corner readout, no captions): ASKS, the clock and every readout are staged inside the plates.

## Running things

- Dev server (probably already running): `cd app && bunx vite --port 5173`. Preview: http://localhost:5173/?t=23.0 (space = play/pause, ←/→ = ±1 s, shift = ±5 s, `,`/`.` = ±1 frame, `[`/`]` = previous/next timeline entry, `l` = loop the current entry, `h` = hide the UI).
- Stills (the main way to check your work — then LOOK at the PNGs with the Read tool): `cd app && bun scripts/render.ts stills --t 12.5,13.0,14.2 --only seam --out ../out/wip/seam`
- Contact sheet of a time range (9:16 cells, 8 columns by default): `bun scripts/render.ts sheet --from 1.5 --to 9 --n 16 --cols 8 --only seam --out ../out/wip/seam/sheet.png`. `--cuts` shows 4 frames around every timeline boundary.
- Short video clip (to judge motion: extract frames with ffmpeg, or just trust the math): `bun scripts/render.ts video --from 20 --to 25 --only hook1 --out ../out/wip/hook.mp4 --preset veryfast`
- `--only a,b` loads only those timeline entries (fast, and isolates you from other people's broken scenes). Without a matching entry nothing renders (black), so the entry must exist in `src/timeline.ts`. Entries whose plate module (`scenes/<file>.ts`) does not exist yet play the `karaoke` placeholder; writing `scenes/<file>.ts` makes the plate take over with no timeline change.
- Typecheck just your files: `bunx tsc --noEmit -p tsconfig.json 2>&1 | grep scenes/yourscene`.
- The render script prints `SCENE ERRORS` and browser console errors — read them.
- Browser: macOS uses system Chrome with Metal; Linux (the cloud container) uses the Chromium at `$RUDO_CHROME` or `/opt/pw-browsers/chromium` with SwiftShader WebGL (slow but exact).
- 4K: add `--scale 2` to any mode (`stills` then saves full-resolution 2160×3840 PNGs). Check your scene at both scales: downscaled, the 2× frame should look like the 1× one, only sharper.
- Renders while files are being edited: run a server without live reload (`RUDO_NO_HMR=1 bunx vite --port 5190`) and pass `--url http://localhost:5190`; a live-reloading server reloads the page mid-render. The private server that `render.ts` starts when none is reachable already runs without it.

## Data

- `lyrics` (`src/engine/lyrics.ts`): `lines[]` with `text,start,end,words[]`, each word `{w,start,end}` (word-level, aligned to the vocal). Find lines by content, never hard-code times: `const l = this.ctx.lyrics.get('Another morning')` → `l.words[3].start`. Helpers: `Lyrics.wordProgress(word, t)` (0..1 sung progress), `Lyrics.lineCharProgress(line, t)` (chars sung so far — for per-glyph wipes), `lyrics.findWords('drift')`. `lyrics.json` also has `extras` (non-lyric vocals: pads, the final hum) and `conf` per word; see docs/PHASE1-report.md.
- `audio` (`src/engine/audio.ts`): `beats[]`, `downbeats[]`, `sections[]`, `beatAt(t)` (continuous beat index), `barAt(t)`, `timeOfBeat(i)`, `nearestBeat(t)`, `events('kick'|'snare'|'hat'|'vocal', t0, t1)`, `env(name, t)` for `rms|low|mid|high|vocal|drums|bass|other` (0..1), `hit(kind, t, halfLife)` decaying pulses.
- Every `Frame` already carries `f.a` = `{rms,low,mid,high,vocal,drums,bass,other,kick,snare,hat,vonset}` and `f.beat,f.bar,f.beatPhase,f.barPhase`.

## Writing a scene

One file `app/src/scenes/<name>.ts`, default-exporting a class extending `Scene` (`src/engine/scene.ts`):

```ts
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { FSPass, Layer2D, W, H, clearRT } from '../engine/gl';

export default class MyScene extends Scene {
  bg = new FSPass(`uniform float t; void main(){ fragColor = vec4(C_INK, 1.0); }`, { t: { value: 0 } });
  text = new Layer2D();
  async init() { /* build geometry, precompute text outlines, etc. */ }
  render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp, lyrics } = this.ctx;
    this.bg.u.t!.value = f.t;
    this.bg.render(renderer, out);            // fullscreen shader → out (overwrites)
    const c = this.text.ctx; this.text.clear(); /* draw with Canvas2D */
    comp.draw(renderer, this.text.upload(), out); // alpha-over onto out
    return { bloom: 0.7 };                   // post overrides (optional)
  }
}
```

Rules:

- **Deterministic**: output must be a pure function of `f.t` (and seeded randomness: `mulberry32(seed)`, `hash(...)`). Never use `Math.random()`, `Date.now()` or `performance.now()` for visuals. The export averages many sub-frames per frame, in any order (see "Motion blur and sampling"). If you need simulation state (particles, feedback buffers), set `stateful = true`, reset in `reset()`, integrate with `f.dt`, and the engine will fast-forward after seeks; such a scene can only be exported with a fixed `--samples`.
- `render()` must fully overwrite `out` (a HalfFloat linear-HDR target). Colours are **linear**; values > ~0.85 bloom, and only lamp/ember may go there (bone type stays crisp). Palette (STYLE.md): `ink, concrete, dust, bone, lamp, ember, dawn` — `C_INK`, `C_CONCRETE`, `C_DUST`, `C_BONE`, `C_LAMP`, `C_EMBER`, `C_DAWN` in GLSL; `LIN.lamp` in TS for GL; `rgba('lamp', a)` for Canvas2D. Lamp is the one signal colour; dawn belongs to the outro only. No other hues.
- `ctx.params` holds the timeline entry's params (one module can serve several entries); `ctx.start/ctx.end` its window; `f.lt`/`f.p` local time/progress.
- Transitions: by default the engine crossfades overlapping entries. For custom transitions set `handlesTransition = true` and composite `f.under` (the previous scene's frame) yourself using `f.tin` (0→1 over the overlap). Most cuts should be hard cuts on downbeats (no overlap) — that's the default when windows touch.
- Post overrides you can return: `exposure, bloom, bloomThreshold, bloomKnee, bloomRadius, halation, ca, grain, vignette, fade, flash, shake:[x,y], zoom`. Defaults in `src/engine/post.ts`. Halation is tinted lamp; the vignette is tuned for 9:16. **Never return `invert`**: it flips lamp too and is calibrated to p(doom)'s colours. Inverted plates (`wall`, `hook` n=2) draw bone paper with ink lines themselves, and lamp stays lamp. `hud` is kept at 0 (the overlay is empty).
- Performance: aim for < 25 ms/frame. Canvas2D layers cost ~2–4 ms to upload each; don't use more than 2–3 per scene. Precompute in `init()`.
- Don't edit files outside your scene files (and your own helper files named `scenes/<name>-*.ts`). Engine changes: ask the lead (report in your final message what you'd need). Do not edit `src/timeline.ts` or `scenes/_motifs.ts`.

## Toolbox

- `gl.ts`: `FSPass(frag, uniforms)` fullscreen GLSL3 pass (has `vUv`, writes `fragColor`, gets `GLSL_COMMON`), `Compositor` via `this.ctx.comp.draw(renderer, tex, target, {mode:'normal'|'add'|'screen'|'multiply'|'max', opacity, tint, scale, offset})`, `Layer2D` (1080×1920 logical Canvas2D → sRGB texture), `makeRT()` (screen-sized HDR target; `makeRT(w, h)` takes logical px), `clearRT(renderer, rt, [r,g,b])`, `SCALE`/`PW`/`PH` (output scale and physical size).
- `glsl/common.ts` (`GLSL_COMMON`, prepended to FSPass; import it into your own ShaderMaterials): palette consts, `hash*`, `snoise(vec2|vec3)`, `fbm`, `curl2`, 2D/3D SDFs, `smin`, `aaFill`, `aaStroke`, **`hatch(u, darkness)` and `engrave(uv, darkness, freq, angle)`** for engraving-style shading (`hatchD(u, darkness, du)` takes the derivative of `u` from the caller, for a coordinate whose `fwidth` lies, such as an angle that wraps), `heat(x)` lamp ramp (ink → ember → lamp → hot lamp), `pxLine(d, a, b)` / `rampLine` for hairlines that stay identical at 2×, `toSRGB/toLinear`.
- `lines.ts`: `LineBatch(capacity, {screen2D, worldWidth, blend})` — GPU capsule segments, 2D pixels (y down) or 3D with a camera. `seg2`, `seg`, `polyline`, `render(renderer, out, camera?)`. Colours linear, can exceed 1 for glow. Good for 10k–200k segments.
- `type.ts`: fonts. `F.archivo(width 62–125, weight 300–900)` (the lyric voice; static instances every 12.5 width × every 100 weight, rounded to the nearest, so width/weight animations step finely; if a hero moment still steps visibly, interpolate outlines between neighbouring instances via `textPathCommands`), `F.archivoItalic()`, `F.serif(weight, italic)` (Cormorant Garamond: upright = somebody else's words; italic = the one confession line per song), `F.mono(weight, italic)` (IBM Plex Mono: the machine voice, the world asking). `font(family, px)` → CSS font string. `layout(text, family, size, tracking)` → per-glyph x/advance with the font's kerning (draw glyph i at `glyphs[i].x`). `glyphX(text, i, family, size)` → where to start drawing `text[i..]` when a word is drawn in pieces (sung/unsung colours, wipes); never offset a piece by `measure(text.slice(0, i))`, which drops the kern between the pieces. `fitSize`, `measure`, `textPath2D` (opentype outline as Path2D), `textPathCommands`, `textPoints(text, family, size, step)` (points filling the glyphs — "text made of atoms"). `smart(s)` / `plain(s)`: typewriter quotes → typographic (’ “ ” …) and back.
- `stroke.ts`: single-stroke plotter/engraving fonts (`script`, `hscript`, `sans`, `readable`, `tech`, `serif`, `osmotron`, `felix`): `strokeText(text, font, size, tracking, kern)`, `drawStrokeText(ctx2d, st, lengthPx)` → returns pen head position, `writtenLength(st, charTimes, t)` to sync writing to word timings. The fonts have no kerning tables: pairs that leave a hole (To, Yo, We, AV, LT…) are kerned optically from the glyph shapes (off for the connected scripts).

## Typography

- Proportional text gets the font's kerning: whole strings through Canvas2D get it for free; glyph-by-glyph drawing must use `layout()` / `glyphX()`. Adjacent runs in different fonts or sizes have no kerning between them: set that gap by eye.
- Lyrics come with typographic punctuation (`don’t`, `’cause`, `“Just`): `Word.w` and `Line.text` go through `smart()`; `lyrics.get()` matches straight or curly quotes. Hardcoded display strings use ’ “ ” … – — × − too. Mono text (IBM Plex Mono) is the UI/terminal voice and keeps typewriter quotes (`plain()` for a lyric shown as typed input).
- No outlined or haloed type.
- `util.ts`: `clamp, lerp, remap, smoothstep, ease.*, prog(x,a,b,ease), keys(t, [[t,v,ease],...]), springStep, pulse, mulberry32, hash, noise1/2/3, fbm1/2, polylineLengths, pointAtLength, window01`.

## Output scale (4K)

`?scale=2` (render.ts `--scale 2`) renders a true 2160×3840 frame. Scenes keep laying out in logical 1080×1920 px (`W`, `H`, `ctx.W`, `ctx.H` never change); the engine handles the rest:

- Render targets: `out`, the engine's targets and `makeRT()` are physical (`PW`×`PH`). `makeRT(w, h)` takes logical px and allocates `w*SCALE`×`h*SCALE`; pass `{ pxScale: 1 }` for a data-sized target whose resolution must not follow the output.
- `Layer2D`: the backing canvas is `SCALE`× larger and its context is pre-scaled, so drawing code works in logical px. `setTransform`/`resetTransform`/`getTransform`, `shadowBlur`, `shadowOffsetX/Y` and `filter` px lengths are patched to stay logical. Not patched: `canvas.width/height` and `getImageData`/`putImageData` are physical px, and `drawImage(layer.canvas, x, y)` needs an explicit size. `new Layer2D(w, h, 1)` makes a deliberately low-res layer (e.g. a soft glow). `scaleContext2D(ctx, SCALE)` applies the same patch to your own canvas.
- `LineBatch`: coordinates and widths stay logical; the AA feather and the hairline floor work in physical px, so hairlines stay crisp.
- GLSL (`GLSL_COMMON`): `gl_FragCoord`, `fwidth` and `dFdx` are physical. Use `FRAG_PX` (the fragment position in logical px) instead of `gl_FragCoord.xy` whenever it is combined with logical sizes, and `PX_SCALE` to convert. A line whose width comes from `fwidth` ("a 1.2 px hairline": `1.0 - smoothstep(a, b, d / fwidth(u))`) gets thinner and fainter at 4K: write it as `pxLine(d, a, b)`, which is identical at 1× and keeps the 1× ink with sharper edges at 4K (`rampLine` does the same for the linear-ramp idiom). `hatch`, `engrave` and `aaStroke` already do this. LOD thresholds and supersampling offsets expressed in pixels should be logical (`fwidth(u) * PX_SCALE`, offsets `/ PX_SCALE`).
- Offscreen canvases used as textures (atlases, text planes) keep their own size: make them `SCALE`× larger (with `ctx.scale(SCALE, SCALE)`) if they are shown large, or they look soft at 4K.
- Post (bloom, halation, CA, grain, vignette) scales automatically; the bloom pyramid stays at the logical resolution.

## Motion blur and sampling

The export renders every frame as the average of many sub-frames spread over the shutter (`--shutter 0.2`: a fifth of the frame time, centred on the frame's time), before post-processing. `--samples N` takes N evenly spaced sub-frames; `--samples auto` chooses the count per 32×32-logical-px tile (`Engine.render`, `AdaptiveSampling`):

- The count steps through 4, 12, 36, 108, 324. Each step adds a sub-frame either side of every existing one, so each set is evenly spread and centred on the frame's time.
- After each step the engine compares the new sub-frames' average with the old ones' (displayed values, worst 2×2-logical-px block). Stepped copies of a moving edge differ between the two sets; a converged streak or a still image does not. Stepping shrinks as 1/count, so the remaining error is about half the change the last step made; a tile stops when that is below `--tol` (default 3 levels of 255) in it and its 8 neighbours. A tile that has stopped is final: it is the average of its first n sub-frames, the image the per-frame sampler would give had it stopped at n.
- Later sub-frames skip the tiles that have stopped: the engine writes the tiles still refining into the depth buffer of its targets, and while it renders a sub-frame every draw into them is depth-tested against that mask, whatever the material says, so the GPU rejects the stopped tiles before shading them (early-Z; a stencil test does not reject early on Apple GPUs). The final average weighs each tile by its own count.
- In practice a still frame stops at 12, ordinary camera motion at 36, and whips, slams and fast zooms at 108 or 324. At 1:1 in 4K, 108 can't be told from 324, while 36 still shows faint striations on the fastest edges.
- `refine: 'frame'` (`--refine frame`) decides for the whole frame at once, as before tiles: every tile then takes the count its worst tile needs.

What this asks of scenes:

- Sub-frames are rendered out of time order and in any number: a scene's output must depend on `f.t` only. `stateful` scenes can't be sampled adaptively (the engine refuses); nothing may count `render()` calls.
- Per-frame flicker and jitter keyed to 60 fps must use `frameIdx(t)` (`util.ts`), not `Math.floor(t * 60)`. `frameIdx` is constant over the frame's shutter; `floor` switches at the frame's own time and double-exposes two states in every frame.
- Noise that changes with continuous `t` (a hash seeded by time) is resampled in every sub-frame: it averages out, but slowly, and makes the adaptive sampler work harder. Seed it with `frameIdx(t)` unless it is meant to smooth out.
- Anything emitted over time (the amber point's embers) is born on a fixed clock with hashed properties, so every sub-frame agrees; a rate read at the current `t` re-times every particle from one sub-frame to the next.
- Shaders that supersample internally (4 rotated-grid taps) take `ssTap: SS_TAP` and `${SS_TAP_GLSL}` and loop `for (int k = ssK0(); k < ssK1(); k++) ... rgss(k)`, weighting by `ssWeight()`. The engine then hands each sub-frame one tap, cycling them (every set is a multiple of 4), which averages to the same image for a quarter of the cost. In the preview and single-sample stills they take all four.
- Post parameters (shake, flash, zoom, fades) are read at one point of the shutter, 1/8 of it after the frame's time (a point every sample set includes); grain and dither are drawn once per frame.
- Masked tiles keep what the last sub-frame drew there. That is safe for `out` and the engine's own targets. A scene's own target keeps being drawn in full (and costs full price) unless the scene lists it in `tileMasked`: only a target with a depth buffer whose texels are read back at their own screen position or within a few px of it (`margin: 1` widens the mask by a tile), like a half-res G-buffer, or, with `moving: true`, one read through a zoom or pan that the scene gives before each sub-frame's draws with `ctx.mapTileMask(rt, map)`. A target read through a warp or a wide blur must not be listed.
- A draw into a masked target whose material asks for its own depth test (3D with a depth buffer) can't use the mask: the engine draws that sub-frame again unmasked and keeps drawing that scene unmasked.

## Shared motifs (`app/src/scenes/_motifs.ts`)

Use these so the album motifs (STYLE.md) look identical across plates. GL versions draw into a 2D additive `LineBatch`; `*2D` versions into a Canvas2D layer. Read-only for scene agents; ask the lead for changes.

- Constants: `SEAM_Y` (1240), `SAFE` (`x0 120, x1 960, y0 220, y1 1480`), `HAIR` (hairline width), `CLOCK_POS`.
- **The seam**: `seam(lb, y, {x0, x1, intensity, gap:[xa, xb]})` (a gap opens a door with glowing cut ends), `seam2D(ctx, y, {alpha})`, and `roomLight2D(ctx, y, {intensity, cx})`: the cover's light, a soft lamp falloff on the concrete wall and its faint floor reflection.
- **The amber point**: `amberPoint(lb, x, y, t, scale, intensity)` (lamp halo, ember ring, hot core: it blooms) and `amberTail(lb, t, headAt, {len, intensity, embers, maxStep})` (a fading trail along where `headAt(t)` was, plus slow embers; it stops at jumps). Draw the tail first. `amberPoint2D` is the Canvas2D fallback (no bloom).
- **The slab**: `slab2D(ctx, x, y, w, h, {alpha, lit, seed, edge})` (seeded concrete texture, bone hairline edge; use a perspective transform on the context for a slab lying in the room) and `slabEdges(lb, corners)` for an outline.
- **The tether**: `tether(lb, x, y, ax, seamY, {slack, t, seed})` / `tether2D(...)`: a hairline from a floating thing down to the seam with an anchor tick. `slack` 0 = taut (straight), 1 = released (a soft sagging bow that sways slowly). `tetherPoints(...)` gives the curve.
- **The clock**: `clockText(sec)` → `HH:MM:SS AM`; `clockAt(t, base, t0, stopAt)` (ticks with song time from `base` at `t0`, freezes at `stopAt`); `clockSec('04:37:00')`; `drawClock2D(ctx, sec, {x, y, size, color})` in Plex Mono at `CLOCK_POS`. Plates own the time base: `seam` starts at 04:37:00 and stops on "stop"; `tomorrow` shows 05:58, stops, and resets to 04:37 on the loop frame.

## Placeholder (`app/src/scenes/karaoke.ts`)

Phase 2's stand-in for every plate: the current line in the lyric voice standing on the seam (wrapped to 840 px), unsung words bone 35 %, the sung word filling lamp glyph by glyph from its start to its end, sung words bone; the amber point rides the seam under the sung word. It prints the entry id small in the top band for QA. A useful reference for per-word sync.
