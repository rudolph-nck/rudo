"""Step 2 storyboard: worlds per section, motif lanes, hand-offs, pacing, sketch frames -> creative/storyboard.html"""
import json, re, html, sys
sys.path.insert(0, "scripts")
import sketches
T = json.load(open("data/timing.json")); H = json.load(open("data/heroes.json"))
LINES, SECS = T["lines"], T["sections"]
esc = html.escape
fmt = lambda x: f"{int(x // 60)}:{x % 60:04.1f}"
norm = lambda w: re.sub(r"[^a-z']", "", w.lower())

WORLDS = [
 ("intro", "The Still Room", "breath · tired · quit · disappear · stop · minute",
  "Black, then the cover's concrete room fades in, barely lit. One hot point is the only light.",
  "Locked off, very slow push-in.", "Sparse: one move per line, long holds. Energy 22.",
  "STOP freezes everything → the frozen frame becomes a clock (MINUTE) → the clock's face tilts up into the ceiling."),
 ("verse1", "The Ceiling", "same · pressure · weight · everybody · success · wall · darkness",
  "The room from the floor: a stone contour ceiling that lowers on kicks. Then the camera pulls back and the back wall becomes a trophy wall.",
  "Low angle, pressed down; pulls back for the second half.", "Medium. The beat grid multiplies (PIECE, TIME), kicks drop stone. Energy 49.",
  "DARKNESS smoke fills the trophy wall to full black."),
 ("prechorus1", "The Doorway", "ending · break",
  "Black. ENDING is a ghost we pass. BREAK cracks open on stars.", "Push forward into the crack.", "Builds over 5 s. Energy 57.",
  "Through the crack: we fall up into the sky."),
 ("chorus1", "Weightless", "drift · stars · forget · no · world · bit",
  "Starfield, no floor, no gravity. Contour RUDO floats. A contour globe below.", "Slow orbit; never cuts hard.",
  "High energy, slow visuals: kicks ignite stars and pulse the NOs instead of shaking the frame. Energy 78.",
  "DRIFT's letters become stars → stars streak into road lines (light-speed into verse 2)."),
 ("verse2", "Night Road", "destination · noise · great · everybody · apart · father · scars · strong",
  "A night highway drawn by the hot point, then a crowd field, then the stillness of the father lines, then the road again, lit ahead.",
  "Driving forward; full stop for FATHER.", "Fast for the first half, still at 1:51 (FATHER), rebuilding to STRONG. Energy 65.",
  "The beat drops out: NOTHING empties letter by letter into bare contour lines on a horizon."),
 ("prechorus2", "Empty Horizon", "forever · breathe",
  "One horizon line in black.", "Static.", "Almost no beat (energy 32). The quietest doorway.",
  "BREATHE: the frame inhales and the horizon blooms into the chorus-2 sky."),
 ("chorus2", "Weightless II", "drift · stars · no · world · bit",
  "The chorus-1 sky, now holding the floating leftovers from chorus 1. Twice the stars.", "Wider orbit than chorus 1; the globe seen from farther away.",
  "Energy 82, the peak. NOs now erase the verse-2 world (road, crowd, GREAT mask).",
  "DRIFT wobbles with his vibrato and settles into the bridge's night sky."),
 ("bridge", "The Long Walk", "carrying · see · everybody · fixing · peace · night · world",
  "A contour plain under a dim sky. He carries the stone block; it turns to glass.", "Side-on tracking shot at walking pace.",
  "Half-time. Energy 54. Each 'Maybe' is a soft reset.", "The globe stops turning ('doesn't ask for me') and shrinks into a ringing phone."),
 ("breakdown", "The Erasing", "no · ringing · notifications · pressure · proving · pretending · silence · breathing",
  "Five things from earlier return and are erased by NO, each faster. Then nothing.", "Hard and close, then empty.",
  "Energy 76; erasures speed up per line. Then SILENCE.", "The single point breathes and grows into the final chorus."),
 ("chorus3", "Underneath", "drift · guilt · past · hear · noise · stronger · tonight",
  "Starfield again, but the camera drifts too. Below him: guilt smoke and the past, out of reach. Then the noise, small and below him.",
  "The camera floats freely; it rises above the noise when the beat returns.", "Stripped (4:04–4:13, no beat), then a rebuild into STRONGER. Energy 53.",
  "TONIGHT pulls back to night, and the stars set into a horizon."),
 ("outro", "Tomorrow", "fighting · building · weight · tonight · drift",
  "A horizon line like dawn. A tower builds. He lifts the stone block by choice. Night again, the last drift, near-silence, then the beat returns.",
  "Wide, steady.", "Steady build, then 11 s of near-silence, then the instrumental return. Energy 50.",
  "End card: the hot point redraws RUDO and the title DRIFT."),
]
LANES = [("weight", "Weight", "var(--stone)"), ("die/drift", "Drift", "var(--drift)"), ("no", "No / erase", "var(--hot)"),
         ("everybody", "Everybody", "var(--ink)"), ("noise", "Noise", "var(--muted)"), ("stars", "Stars / night", "var(--hot)"),
         ("tonight", "Stars / night", "var(--hot)"), ("breath", "Breath", "var(--hot)"), ("time", "Time", "var(--ink)"), ("got-list", "Got-list / father", "var(--stone)"), ("father", "Got-list / father", "var(--stone)")]
LANE_ORDER = ["Weight", "Drift", "No / erase", "Everybody", "Noise", "Stars / night", "Breath", "Time", "Got-list / father"]
FR = sketches.frames()
def tparse(s):
    m = re.match(r"(\d+):([\d.]+)", s); return int(m.group(1)) * 60 + float(m.group(2))

# ---- timeline SVG ----
dur = T["duration"]; PX = 8; Wd = int(dur * PX) + 40; LH = 20
top = 94; Hh = top + 60 + len(LANE_ORDER) * LH + 50
ex = lambda t: 20 + t * PX
sv = [f'<svg viewBox="0 0 {Wd} {Hh}" width="{Wd}" height="{Hh}" role="img" aria-label="Storyboard timeline: worlds, energy, motif lanes and sketch frames">']
for i, s in enumerate(SECS):
    sv.append(f'<rect x="{ex(s["start"]):.1f}" y="10" width="{(s["end"]-s["start"])*PX:.1f}" height="{Hh-30}" fill="{"var(--band3)" if i % 2 else "var(--band2)"}"/>')
for i, s in enumerate(SECS):
    w = next(x for x in WORLDS if x[0] == s["id"])
    ly = 28 if i % 2 == 0 else 58
    sv.append(f'<text x="{ex(s["start"])+5:.1f}" y="{ly}" class="tw1">{esc(w[1].upper())}</text><text x="{ex(s["start"])+5:.1f}" y="{ly+14}" class="tl">{esc(s["label"])} · {fmt(s["start"])}</text>')
    if i: sv.append(f'<path d="M{ex(s["start"]):.1f} 10 l5 6 l-5 6 l-5 -6 z" fill="var(--hot)"/>')
E = T["energy"]
pts = " ".join(f"{ex(i+0.5):.1f},{top+50 - v*40:.1f}" for i, v in enumerate(E))
sv.append(f'<polygon points="{ex(0.5)},{top+50} {pts} {ex(len(E)-0.5)},{top+50}" fill="var(--energy)"/><polyline points="{pts}" fill="none" stroke="var(--muted)" stroke-width="1"/>')
lane_y = {n: top + 70 + i * LH for i, n in enumerate(LANE_ORDER)}
for n, y in lane_y.items():
    sv.append(f'<line x1="20" x2="{Wd-20}" y1="{y}" y2="{y}" stroke="var(--line)"/><text x="{Wd-24}" y="{y-4}" class="tl" text-anchor="end">{esc(n)}</text><text x="24" y="{y-4}" class="tl">{esc(n)}</text>')
for li, l in enumerate(LINES):
    h = H[str(li)]
    lane = next((x for x in LANES if x[0] == h["motif"]), None)
    if not lane: continue
    w = next((w for w in l["words"] if norm(w["w"]) == norm(h["hero"])), l["words"][-1])
    y = lane_y[lane[1]]
    sv.append(f'<rect x="{ex(w["s"]):.1f}" y="{y-3}" width="{max(4,(w["e"]-w["s"])*PX):.1f}" height="6" rx="3" fill="{lane[2]}"><title>{esc(h["hero"])} {fmt(w["s"])}</title></rect>')
fy = Hh - 34
for k, (t, *_r) in enumerate(FR):
    x = ex(tparse(t))
    sv.append(f'<a href="#fr{k+1}"><circle cx="{x:.1f}" cy="{fy}" r="9" fill="var(--ink)"/><text x="{x:.1f}" y="{fy+4}" class="fn" text-anchor="middle">{k+1}</text></a>')
sv.append(f'<text x="{ex(238.3):.1f}" y="{top+44}" class="tl">near-silence</text><text x="{ex(249.2):.1f}" y="{top+44}" class="tl">beat returns</text></svg>')

worlds_html = "".join(f'''<article class="world"><header><span class="t">{fmt(next(s["start"] for s in SECS if s["id"]==wid))}</span><h3>{esc(name)}</h3><span class="sl">{esc(next(s["label"] for s in SECS if s["id"]==wid))}</span></header>
<p class="words">{esc(words)}</p><dl><div><dt>World</dt><dd>{esc(look)}</dd></div><div><dt>Camera</dt><dd>{esc(cam)}</dd></div><div><dt>Pacing</dt><dd>{esc(pace)}</dd></div><div><dt>Hand-off</dt><dd>{esc(out)}</dd></div></dl></article>''' for wid, name, words, look, cam, pace, out in WORLDS)
frames_html = "".join(f'<figure class="fr" id="fr{k+1}"><div class="fimg">{f.svg()}</div><figcaption><span class="n">{k+1}</span><span class="t">{esc(t)} · {esc(sec)}</span><strong>{esc(word)}</strong><p>{esc(desc)}</p></figcaption></figure>' for k, (t, sec, word, desc, f) in enumerate(FR))
page = open("scripts/storyboard.tpl.html").read().replace("{{TIMELINE}}", "".join(sv)).replace("{{WORLDS}}", worlds_html).replace("{{FRAMES}}", frames_html)
open("creative/storyboard.html", "w").write(page); print("ok", len(page))
