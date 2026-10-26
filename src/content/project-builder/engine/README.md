# Project Builder guide format

Data-driven guides are JSON files in `src/content/project-builder/guides/<slug>.json`.
The route `/project-builder/<slug>` inlines the JSON and `engine.js` into
`template.html`. Register each guide in `src/lib/project-builder/guides.ts`.

The tub shower guide (`tub-shower-tile.html`) predates the engine and is a
hand-built page; don't copy its structure, copy `guides/outlet-gfci.json`.

## Top level

| key | type | notes |
| --- | --- | --- |
| `slug` | string | matches the file name and registry entry |
| `title` | string | 2–4 words, e.g. "Replace an Outlet or GFCI" |
| `eyebrow` | string | short header label, e.g. "Electrical · outlets" |
| `category` | string | Flooring, Plumbing, Electrical, Walls, Carpentry, Painting |
| `difficulty` | string | Beginner, Intermediate, Advanced |
| `time` | string | e.g. "1–2 hours", "2 weekends" |
| `summary` | html | 1–3 sentences: what you'll end up with |
| `safety` | html | the non-negotiable safety rules for this job |
| `pro` | html | when to stop and call a licensed pro / permits |
| `questions` | array | optional, see below |
| `calcs` | array | optional, see below |
| `calcNote` | html | optional note under the numbers |
| `overviewFig` | fig id or array | optional picture on the Start tab |
| `tools` | array | every tool and material |
| `phases` | array | `{ "name", "steps": [...] }` |
| `days` | array | optional `{ "t", "ids": [stepIds], "wait" }` work sessions |
| `help` | object | `{ id: { "t", "fig", "b" } }` quick help cards |
| `figs` | object | `{ id: { "svg", "h", "cap", "title" } }` |
| `glossary` | array | `[["Term","Definition"], ...]` |

## Templates and conditions

Any text field can use `{{ expression }}`; it is evaluated with `a` (answers by
question id), `c` (calc results), `frac(x)` (inches to the nearest 1/16 with a
`"` sign) and `Math`. Example: `"{{c.boxes}} boxes"`.

`[[warn|Tag|html]]`, `[[info|Tag|html]]`, `[[ok|Tag|html]]` inside html become
callout boxes.

Steps, tools, calcs and questions may have `"when": "a.method==='sweat'"`; they are
hidden when it is false.

## questions

```json
{ "id": "method", "label": "How will you join pipe?", "type": "choice", "default": "sweat",
  "options": [ { "v": "sweat", "label": "Solder (sweat)", "hint": "classic" }, ... ], "hint": "..." }
{ "id": "length", "label": "Room length", "type": "number", "unit": "ft", "default": 12, "step": 0.5 }
```

## calcs

`{ "id": "sqft", "label": "Floor area", "expr": "Math.round(a.length*a.width)", "fmt": "{{c.sqft}} sq ft" }`.
Calcs run in order, so later ones can use `c.<earlier id>`. Omit `label` for
helper values that shouldn't be shown.

## tools

`{ "id": "flapper", "c": "Parts", "n": "Toilet flapper (2\" or 3\")", "must": true,
"w": "why you need it, one sentence", "q": "store search words", "qty": "1", "rent": false, "when": "..." }`

## steps

```json
{ "id": "s1", "t": "Turn off the power", "time": "10 min",
  "idea": "One plain sentence: what this step does and why.",
  "stop": "optional html shown as a red STOP AND CHECK box",
  "fig": "figId" or ["figA","figB"],
  "need": ["toolId", ...], "ppe": ["Glasses"], "wait": "optional",
  "timers": [["Label", minutes]],
  "b": "<ol><li>numbered, concrete actions</li></ol>",
  "help": ["helpId"], "faq": [["Question?","Answer."]], "when": "optional" }
```

Write `b` as an ordered list of short, literal actions a first-timer can follow
(what to hold, which way to turn, what it should look like when right). Put the
"why" in `idea`, a callout, or an FAQ.

## figs (SVG)

`svg` is the inner markup of an `<svg viewBox="0 0 320 H">` (H = `h`, default 180).
Use only these classes so figures work in light and dark mode:

| class | use |
| --- | --- |
| `o` | ink outline / line (no fill) — add `d` for dashed |
| `a` / `af` | accent line / accent fill (arrows, highlights) |
| `w` | wood (studs, lumber) |
| `b` | board (drywall, cement board, subfloor) |
| `tl` | tile / finished surface (light) |
| `tb` | tub, porcelain, fixtures |
| `y` | yellow (tape, level, highlight object) |
| `bk` | plain object (white fill + outline) |
| `m` / `mp` | red membrane / pink |
| `th` | thinset, mortar, compound, adhesive |
| `th-l` | faint ink line (ridges, texture) |
| `wt` | water |
| `mos` | blue tint (selected zone, mosaic) |
| `bad` / `badf` | red line / red fill (wrong way, danger) |
| `good` / `goodf` | green line / green fill (right way) |
| `inkf` | solid ink fill (screws, dots) |
| text default | muted 9px mono label |
| text `k` | bold ink label · `ac` accent label · `wa` warning label · `gd` good label · `nm` white number in an `af` circle |

Rules: keep every label inside the viewBox and off other labels (about 5.4px per
character at 9px), no more than ~55 characters per line, and draw to scale-ish
proportions. Animations may use SMIL (`<animate>`, `<animateTransform>`); they are
stripped automatically for reduced-motion users, so the static frame must make
sense on its own. `clipPath` ids must be unique across the whole guide.
