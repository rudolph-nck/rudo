# Shout It to the Sky — Lyric Video Storyboard & Prompt

Oct 29, 2026 · @Nick

## Creative vision

The video goes from the cold concrete room to the open sky: one
continuous rise from the floor to the roof to the stars. Vertical
1080×1920, 30 fps, 4:01.

- **Cover as style guide:** the Static & Silence cover sets the palette,
  the font and the grain. RUDO's concrete room is home base, but the
  camera is free to leave it.

- **Colour arc:** cold steel blue and grey (struggle), then sodium
  orange and dust (the grind at the flip), then gold, white and ember
  (the chorus, the legacy).

- **Recurring motifs:** stairs built from words, bricks stacking up, a
  red bank balance, a clock, sparks and embers.

- **Kinetic rules:** shouted lines slam in on the 808 with a screen
  shake and an impact flash. Fast rap lines snap in word by word on the
  beat. Sung lines glide and glow. Key nouns become literal 3D objects
  the camera travels through.

- **Polish:** film grain, light leaks, bloom on bright text, chromatic
  aberration on the impacts, depth of field, volumetric dust in light
  beams.

## Storyboard

| Section           | Visual                                                                                                                          | Text motion                                                                                                                                                                                                           |
|-------------------|---------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Intro             | Black, then the strings swell and the concrete room flickers on like a fluorescent tube. The 808 drop cracks the wall.          | "NOBODY HANDED ME NOTHING!" smashes in huge and shakes the frame. "So I built it!" assembles from falling bricks.                                                                                                     |
| Verse 1           | Cold blue back room: headset, monitor glow, a noodle cup. A red bank balance blinks. Headlights streak past on a night highway. | Terminal-style typing for the IT lines. "server, switch, port" become glowing network cables the camera races along. "back to the wall" pins the text against concrete.                                               |
| Pre-Chorus        | Doors slam shut one after another; each one folds down into a stair step. The camera climbs fast.                               | Every word lands as a step. The tempo of the climb builds with the music. "let me say it now!" holds, the frame goes silent for a beat.                                                                               |
| Chorus            | The ceiling blows open. A rooftop at night under a huge sky, RUDO silhouetted against gold light.                               | Each line launches upward like a flare and bursts into embers. "Still grinding!" pulses on every kick. "universe" pulls the camera into a star field.                                                                 |
| Post-Chorus       | Fast strobing cuts between the rooftop and the grind.                                                                           | All caps, full-width, stamped in on each beat with impact flashes.                                                                                                                                                    |
| Verse 2           | The flip house, dusty orange work lights. Floors rip up, tiles shatter, studs frame up, drywall rises, mud feathers smooth.     | Text gets physically built: "break the tile" shatters, "frame up the walls" draws as studs, "feather it out like glass" smooths into a mirror finish. "Average is a cage" puts bars round the words, then they break. |
| Pre-Chorus 2      | Same stairs, now warmer and lit from above.                                                                                     | Same as before, so the moment feels earned the second time.                                                                                                                                                           |
| Chorus 2          | Rooftop again, sunrise colours this time.                                                                                       | Bigger, brighter versions of the first chorus.                                                                                                                                                                        |
| Verse 3           | Midnight. The house is still, one desk lamp, a mic. Pages of lyrics float.                                                      | Rapid-fire words stack into a brick wall in real time. "Tired eyes" opens on a giant eye, the camera dives into the iris. "three lives" splits the screen into three panels: IT, the flip, the mic.                   |
| Bridge            | Half-time. Everything slows. A kid in worn shoes in an empty hallway, then a night-shift worker. Soft snow-like dust.           | Handwritten, quiet, slow fades. "the slow ones grow" sprouts like a vine.                                                                                                                                             |
| Final Chorus      | Full explosion: the room, the house and the rooftop all lift into the sky together. Fireworks of embers.                        | Maximum energy. Every line bursts, the whole screen fills with gold light.                                                                                                                                            |
| Final Post-Chorus | Fast montage of every earlier scene.                                                                                            | Stamped all-caps lines.                                                                                                                                                                                               |
| Outro             | Strings ring out. Back in the concrete room, now glowing warm gold.                                                             | "STILL GRINDING!" slams in once, holds, then cuts to black.                                                                                                                                                           |

## Master prompt for Claude Code

You are a motion designer and creative coder. Build a cinematic, kinetic
lyric music video for "Shout It to the Sky" by RUDO.  
  
INPUTS (in this folder):  
- song audio file (4:01)  
- cover.png: the Static & Silence album cover (RUDO sitting against a
blank concrete wall). Use it as the STYLE GUIDE: match its palette,
font, grain and mood.  
- lyrics.txt: final lyrics with section tags.  
- storyboard.md: the scene-by-scene plan. Follow it section by
section.  
  
STEP 1 - AUDIO ANALYSIS -\> timing.json  
- Detect BPM, every beat, downbeats, and strong 808/kick hits (librosa
or similar).  
- Detect section boundaries and match them to the lyric section tags.  
- Get word-level timestamps for every lyric (WhisperX forced alignment
against lyrics.txt).  
- Mark shouted lines (ALL CAPS) as "impact" lines.  
- Save everything to timing.json and show me a summary before
rendering.  
  
STEP 2 - BUILD THE VIDEO  
- Vertical 1080x1920, 30 fps, H.264 MP4 with the original audio.  
- Use Remotion (React) or a comparable code-based engine with real 3D
(Three.js) for camera moves.  
- Every word appears in sync with its timestamp. No word on screen early
or late.  
- Kinetic rules: impact lines slam in on the 808 with screen shake,
flash and chromatic aberration; fast rap lines snap in word by word on
the beat; sung lines glide, glow and drift; key nouns from the
storyboard become literal 3D objects the camera moves through.  
- Colour arc: cold steel blue (Verse 1), dusty orange (Verse 2), gold,
white and ember (choruses and final).  
- Cinematic polish: film grain, light leaks, bloom, depth of field,
volumetric dust, smooth eased camera moves. It should feel like a film,
not a slideshow.  
- Keep text inside TikTok safe zones (clear of the bottom 20% and the
right edge).  
  
STEP 3 - REVIEW  
- Render a 15-second preview of the Intro and first Chorus first, and
wait for my mi approval.  
- Then render the full video. Check sync at every section change.
