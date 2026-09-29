# Brand Analysis — Addition Financial × Addapalooza 2026

Source: `assets/Brand_Guidelines.pdf` (32 pp., "Brand Guidelines — logoUpdate", Aug 2026) plus the
four supplied images.

## 1. Asset audit

| Asset | Source | State in project |
|---|---|---|
| Song, 4:42, AAC 48 kHz | `One_Team_One_Rhythm.mp4` (Suno lyric export, 824×1464 @10 fps) | `assets/audio/one-team-one-rhythm.m4a` (stream copy, no re-encode) |
| Lyric sheet (authoritative text) | supplied in the brief conversation | `data/lyrics.json` |
| Lyric timing | **not supplied as JSON** — recovered from the Suno video's karaoke highlight (edge-diff scroll detection, 193 events, hand-verified) | `data/lyrics.json` (`rawStart` + beat-snapped `start`) |
| Logo (vector) | page 8 of the PDF — outlines, not live text | Rebuilt as clean SVG from PDF paths: `logo-reverse.svg`, `logo-full-color.svg`, `logo-wordmark-reverse.svg`, `aplus-mark-reverse.svg`, `plus.svg`, `a-glyph.svg` |
| Brand line + plus reference | image 4 (892×127 PNG) | `assets/logos/brand-line-plus-reference.png`; rebuilt procedurally in `<BrandLine />` |
| Addapalooza "The Summit 2026" event logo | image 1 (1376×768, grey studio bg) | background keyed → `public/images/addapalooza-logo.png` |
| DJ booth w/ masked DJ | image 2 (1376×768, light grey bg) | keyed, floor removed → `public/images/dj-booth.png` |
| DJ character sheet (A+ helmet) | image 3 (813×1456, white bg) | keyed; panels cut: `dj-front`, `dj-helmet-front`, `dj-helmet-3q`, `dj-helmet-side` |
| Reference motion video | **not included in the upload** (the only MP4 is the Suno export) | Visual language taken from the written brief |

Technical constraint: the character-sheet panels are small (helmet ≈ 200×260 px). They are never shown
full-frame; they appear as small, lit, graded fragments inside compositions.

## 2. Colour

Measured from the PDF vector fills and the colour page (p.10):

| Role in film | Brand name | HEX | Use |
|---|---|---|---|
| Field | — (derived) | `#060708` near-black, `#0C0E10` charcoal | 90% of every frame |
| Primary accent | **Vivid Blue** PMS 306 C | `#00B2E3` | The line, the plus, meaningful emphasis only |
| Type | Pure White | `#FFFFFF` → warm white `#F4F1EA` for editorial | Hero + narrative type |
| Secondary neutral | **Anchor Gray** PMS 425 C | `#53575A` | Technical rules, inactive labels, grids |
| Tertiary neutral | Lunar Gray PMS 427 C | `#CFD3D3` | Secondary type |
| Depth accent (rare) | Button Blue PMS 7462 C | `#00538B` | Only as deep shadow tone in light gradients |
| **Not used** | Click-me Green `#6ABF4B`, semantic web colours | — | Guide: "used very sparingly … primarily in web applications" |

Rule for the film: **one accent across a dark field.** Vivid Blue means *the line / the plus / together*.

## 3. Signature elements (p.12) — the film's DNA

1. **The blue line** — "Addition Financial's signature. It shows up in every piece. Sometimes calling
   attention to itself, sometimes playing a background role. Vertical or horizontal, thin or wide. It can
   act as a decorative element, or contain copy."
   → It is the protagonist of the film. It appears in every chapter.
2. **Line + logo** — "When linked with the logo, the line should match the weight and alignment of the
   blue plus sign." → All lockups use line thickness = plus bar thickness (5.174 / 21.349 of plus height).
3. **Line over photos cuts behind the subject.** → When the line meets `2026`, the DJ or the logo, it
   passes *behind* the subject.
4. **Angled notch** — matches the angle of the A (≈59°); top-left or bottom-right only, one per piece.
   → Used once per image card (DJ booth frame, helmet frames).
5. **A+ pattern** — texture on pieces without photography. → Very low-opacity A+ lattice in the
   department chapter.

## 4. The plus, measured

From the vector: plus = 25.743 × 21.349 units; bars 5.174 thick; the horizontal bar's ends are
**slanted** (dx 3.106 over the bar height), the same angle as the A's stroke. The plus is literally *two
lines crossing*. That is the creative key of the film (see `song-analysis.md`).

## 5. Typography

| Guide | Film role | Font file used |
|---|---|---|
| Open Sans Extrabold (main) | HERO TYPE | `@fontsource/open-sans` 800 |
| Open Sans Regular (supporting) | labels, lockups | `@fontsource/open-sans` 400/600 |
| Helvetica Neue 45 Light (long form) | NARRATIVE TYPE | Inter 300/400 (licence-free Helvetica-class grotesk) |
| — | TECHNICAL TYPE | IBM Plex Mono 400/500 |
| — | EDITORIAL TYPE (bridge only) | Instrument Serif (roman + italic) |

## 6. Voice

"Quirky and fun" (p.5) and "Count us in." The song is a celebration, so the film earns its energy
through rhythm and scale rather than playful gimmicks. The playful voice comes through in the choreography
and the roll calls (every name gets its own light) rather than in cartoon motion.

## 7. Logo rules applied
- Primary Reverse on dark (white wordmark, blue plus, blue "CREDIT UNION"). Full reverse is never used.
- Clearspace = height of the plus; nothing else enters that zone during lockups.
- The logo is never distorted, recoloured or outlined; it is revealed by masks and light only.
