# One Team, One Rhythm — cinematic music video

A 4:42 motion-design film for **Addition Financial × Addapalooza — The Summit 2026**, built as a
generative, data-driven Remotion project. 1920×1080, 30 fps, 8,460 frames.

**Idea in one line:** the brand's signature blue line travels through darkness and becomes a timeline,
a plus (two lines crossing), a road, a map, a rail, a margin and a stage, until everyone the song names
has been drawn onto it.

## Quick start

```bash
cd music-video
npm install
npm run studio                       # live editing in Remotion Studio
npm run render                       # production master → renders/final/one-team-one-rhythm.mp4
npx remotion render src/index.ts Film renders/previews/preview.mp4 --scale=0.5   # fast review pass
node scripts/stills.mjs renders/styleframes 1 10.7 43.9 66.9   # stills at given seconds
```

`remotion.config.ts` uses the container's headless Chromium if present and the `swangle` (software
WebGL) renderer. On a normal machine you can delete those two lines.

## Layout

```
assets/        source material (audio, brand guide PDF, source images, vector logos rebuilt from the PDF)
public/        render-time copies: keyed images, logos, grain tiles, audio
creative/      brand-analysis · song-analysis · visual-language · storyboard · styleframes
data/          lyrics.json · timing.json · beats.json · scenes.json · places.json · departments.json
scripts/       analysis + data builders (Python), stills renderer (Node)
src/
  Film.tsx          manifest → chapters → worlds, + grain + audio
  worlds/           one component per visual chapter (Signal, Verse, Chorus, Map, Rail, Mosaic,
                    Bridge, Build, Finale, Climax, Outro)
  three/            Stage3D (CSS-3D perspective stage), Lines3D (canvas lines with near-clip),
                    Particles, Lines3D
  components/       Brand (PlusMark, BrandLine, Logo, Segment), Timeline, Glyphs (27 line diagrams)
  typography/       Hero, Narrative, Mono, Serif, Scramble, Counter, Caption
  effects/          FilmGrain, Vignette, LightPool, Flash, Field
  utils/            camera (shared projection), time (lyrics/beats), ease, random, scenes, fonts
renders/       styleframes / previews / final
```

## Content vs rendering

Everything a writer or producer would change lives in `data/`:

| File | What it controls |
|---|---|
| `lyrics.json` | every sung line: text, hero word, start time (Suno highlight time snapped to the beat grid) |
| `scenes.json` | the **scene manifest**: chapters → worlds with start/end frames and transitions, plus one entry per lyric with `display`, `heroWord`, `visualConcept`, `cameraBehavior`, `transitionIn/Out`, `assetReferences`, `beatMarkers` |
| `beats.json` | 107.7 BPM beat grid, downbeats, accents, per-second energy and low end (drives pulses) |
| `places.json` | the 36 roll-call places and their coordinates (map constellation) |
| `departments.json` | the 27 department lines: name, action, and which glyph draws them |

Change a line's `display` text in `scenes.json` and the film updates. To regenerate after re-timing:

```bash
python3 scripts/build_data.py     # lyrics.json, beats.json, timing.json
python3 scripts/build_scenes.py   # scenes.json
```

## How the timing was made
1. The vocal was isolated from the master with Spleeter (2-stem model), see `scripts/sep.py`.
2. Word-level speech recognition ran on the vocal stem with sherpa-onnx (NeMo Parakeet TDT 0.6B), in
   30 s and 12 s windows (`scripts/asr.py`, raw output in `data/asr/`).
3. `scripts/build_data.py` fuzzy-aligns every word of the lyric sheet to the recognised words, so each
   line **and each word** in `data/lyrics.json` carries its sung onset. Unrecognised words are
   interpolated between their matched neighbours.
4. The chopped "yeah" vocals on the beat drop were located as onsets in the vocal stem (`data/chops.json`).

Where the recording differs from the lyric sheet, the film follows **what is sung**. For example,
the final drop sings "ONE TEAM! ONE RHYTHM!" where the sheet has "JAX… YOU READY?".

## How lyrics are shown
- `src/typography/LyricBand.tsx` is the main lyric display. Every line appears as large type at the
  top (under the graphics in the departments chapter), word by word at its sung time. Words act out
  their meaning: *down* sinks, *grow/improve/proud* rise, *loud* swells, *far* recedes, *move/roll*
  push forward, *changin'/conversion* scramble, *aligned* snaps into line, *together/one* converge.
- Lines a world already sets as hero type (chorus, bridge, climax, outro…) are flagged
  `caption: false` in `data/scenes.json` and are not duplicated.
- In the final chorus the lyrics play on the DJ's helmet visor as LED text (`src/components/Helmet.tsx`).

## The DJ
`public/images/dj/` holds the supplied DJ image cut into booth / body / head layers (2× upscaled,
sharpened, with emissive-glow passes). `src/components/DJ.tsx` animates them on the beat grid with a
smooth groove. `ConcertDrop.tsx` + `Crowd.tsx` stage him for the beat drop in front of a crowd that
jumps on the beat.

## Brand compliance
Colours measured from the PDF (Vivid Blue `#00B2E3`, Anchor Gray `#53575A`, Lunar Gray `#CFD3D3`);
Primary Reverse logo only; lockup lines at exactly the plus bar weight and aligned to it; the line
passes behind subjects; one brand notch per image; Open Sans ExtraBold for hero type. See
`creative/brand-analysis.md`.
