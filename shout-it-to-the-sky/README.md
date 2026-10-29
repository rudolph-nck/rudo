# Shout It to the Sky — kinetic lyric video

RUDO · *Static & Silence, Vol. 1*. Vertical 1080×1920, 30 fps, 4:01, H.264 with the original audio.
Built in Remotion (React) with Three.js for the 3D sets. The colour arc runs from the concrete
room (the album cover) to a gold rooftop sky.

## Quick start

```bash
cd shout-it-to-the-sky
npm install
npm run studio        # live editing
npm run preview       # 15 s review cut → renders/previews/preview-15s.mp4
npm run render        # full video   → renders/final/shout-it-to-the-sky.mp4
node scripts/stills.mjs renders/stills 0.5 4.7 17.3 59.2   # stills at song seconds
```

## Pipeline

| Step | Script | Output |
|---|---|---|
| Lyrics read off the Suno export, gaps filled from ASR | — | `data/lyrics.txt` |
| Line-change events from the Suno lyric scroll | `scripts/suno_events.py` | `data/suno_events.json` |
| Vocal stem (UVR MDX-Net Voc_FT, onnx) | `scripts/separate.py` | (scratch) |
| Word ASR on the stem (NeMo Parakeet-TDT via sherpa-onnx), two window passes | `scripts/asr.py` | `data/asr/*.json` |
| BPM, beats, downbeats, 808/kick hits, energy | `scripts/analyze_audio.py` | `data/beats.json` |
| Forced alignment of lyrics to ASR + sections + impact lines | `scripts/build_timing.py` | `data/timing.json`, `data/timing-summary.txt` |
| Cover → clean room plate (type inpainted out) | `scripts/clean_cover.py` | `public/images/room.png` |
| RUDO cut-out for the rooftop silhouette | `scripts/cutout.py` | `public/images/rudo-cutout.png` |

WhisperX wasn't available here because Hugging Face is blocked from this environment. Alignment
is a global Needleman–Wunsch pass between the lyric words and the ASR words instead. About 91%
of the words take an ASR onset directly; the rest are interpolated inside their line, never into
an instrumental gap. Lines under 50% anchored are flagged in `timing-summary.txt` for a manual
sync check.

To re-time after editing lyrics: `python3 scripts/build_timing.py .`

## Code

```
src/
  Film.tsx            section router, global impact response (shake / flash / chromatic aberration)
  data.ts             timing.json types, kick/impact envelopes
  scenes/Room.tsx     the concrete room: cover plate, fluorescent tube, dust in the beam, wall crack, title card
  scenes/Rooftop.tsx  Three.js: night sky shader, stars, city grid, parapet, RUDO silhouette, embers
  scenes/Shatter.tsx  "the ceiling blows open" transition into each chorus
  text/Kinetic.tsx    ImpactBlock · BrickLine · FlareLine · RapLine · GlideLine · AdlibLine
  fx/Post.tsx         grain, vignette, light leaks, flash, chromatic aberration filter, grade
```

## Status

The intro and choruses are designed and match the preview. The verses, pre-chorus, post-chorus,
bridge and outro currently use a placeholder treatment: the room plate with a grade, plus
word-snap or glide text. Their storyboard scenes come next, after the preview is signed off.
