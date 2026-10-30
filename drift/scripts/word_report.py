"""timing.json + heroes.json -> creative/word-analysis.html (step 1 deliverable)."""
import json, re, html, collections, numpy as np
T = json.load(open("data/timing.json")); H = json.load(open("data/heroes.json"))
LINES, SECS = T["lines"], T["sections"]
esc = html.escape
fmt = lambda x: f"{int(x // 60)}:{x % 60:04.1f}"
norm = lambda w: re.sub(r"[^a-z']", "", w.lower())

FX = {
 "DRIFT": "Letters unhook from the baseline and float apart with slow spin and no gravity. The distance grows with held-note length × his volume. The song's signature.",
 "HEAVY": "Letters fill with stone, drop and land on the kick, and the frame jolts down. Variants: carried, lifted, shouldered.",
 "FLOAT": "The word (or the contour RUDO) lifts off the ground and hangs, bobbing gently for the length of the note.",
 "ERASE": "The hot point runs backwards along the path that drew the object, unwriting it. Used for every NO.",
 "PRESS": "A slab from above squashes the word flat; the letters bulge sideways. When released, they spring back.",
 "ECHO": "Stamped copies trail off the word, each one fainter and out of sync. More copies each time the word returns.",
 "MULTIPLY": "The old toolkit's beat grid: 1 → 2 → 4 → 16 → 64 copies, which tilt into a field.",
 "SHATTER": "The word breaks into shards that fly off-frame in different directions (taken by others).",
 "CARVE": "The hot point engraves the word into stone or concrete; the grooves can fill with light (healed).",
 "GLASS": "Clear refractive letters with highlight edges; the room bends through them.",
 "SMOKE": "Ink smoke pours out of the letters and spreads, curling with noise.",
 "STATIC": "Scanline / TV static type that vibrates, with a glitch burst on each kick.",
 "RIPPLE": "Concentric rings or a waveform pass through the word, their amplitude following his voice.",
 "STRETCH": "The word stretches along one axis for the length of the note, then snaps back or breaks.",
 "BREATHE": "Scale and glow follow his vocal volume frame by frame (inhale/exhale).",
 "NEON": "Each letter is a cluster of points that ignite like stars; brightness follows the voice.",
 "SPIN": "A 3D contour globe or object drawn in light, turning.",
 "GROW": "Lines or letters build upward, beat by beat.",
 "BURN": "The edges char to ash and drift up as embers (stone-grey, not orange).",
 "FADE-GHOST": "Solid → contour lines → nothing, swept left to right across the held note.",
 "FREEZE": "Everything on screen halts mid-motion for the length of the word.",
 "CLOCK": "A clock face is drawn in light; the hand ticks on the beat.",
 "CUT": "One hot line slashes through the word.",
 "SNAP": "Stretches thin over the held note, then snaps; the halves drift apart.",
 "STREAK": "Motion streaks: road lines rushing toward the camera, and type smeared by speed.",
 "DRIP": "The letters' lower edges sag and drip.",
 "MASK": "A confident sticker-like headline that peels off and shows grey behind.",
 "CRACK-OPEN": "A crack runs down the word and the gap widens with his volume; there's light behind it.",
 "SILENCE": "Almost empty frame, smallest type in the song, one hot point.",
 "QUIET CAPTION": "No effect, on purpose. Small grey caption, held steady.",
 "MELT": "Library only (not cast in this song): letters soften and slump down.",
 "SPIN-": "",
}
FX.pop("SPIN-")
REQUESTED = ["GLASS","GROW","SHATTER","BURN","MELT","SPIN","DRIP","ECHO","STRETCH","HEAVY","FLOAT","NEON","CARVE","RIPPLE","SMOKE"]
base_fx = lambda f: re.split(r"[ →(]", f)[0]

MOTIFS = [
 ("weight", "WEIGHT / carrying", "stone", "tired → pressure → weight → hardest → strong → carrying → stronger → carrying the weight",
  "The verse-1 stone block keeps coming back and changes each time: it crushes (V1), he carries it (bridge), the breakdown lifts it off, and in the outro he picks it up again by choice."),
 ("die/drift", "DIE / DRIFT", "drift", "7× DRIFT, 5× DIE",
  "DIE never gets an effect. DRIFT drifts a little farther each time: loosened → full drift → drift + chorus-1 leftovers still floating → the camera drifts → the letters dissolve into stars."),
 ("no", "NO ___ (erase)", "hot", "chorus ×2 (3 erases each) + breakdown (5 erases, faster)",
  "NO is the eraser. Each NO unwrites something we've already seen (calendar, BLESSED crowd, voices, the road, the GREAT mask, phone, badges, ceiling slab, trophy wall) until nothing is left: SILENCE."),
 ("everybody", "EVERYBODY", "ink", "needs a piece / wants my time / surrounded by / everything everybody needs",
  "Hands and silhouettes that take pieces of him. There are more of them every time the word comes back."),
 ("same", "SAME ×3", "ink", "same ceiling / same pressure / same people", "Identical stamps that get greyer: monotony."),
 ("got-list", "GOT … (the list)", "stone", "accomplishments, achievements / memories, questions, father, dreams",
  "V1: a trophy wall carved in concrete. V2: the same wall now holds memories and a voicemail."),
 ("noise", "NOISE / quiet / voices", "ink", "quiet, low, noise, sticks, voices, underneath the noise",
  "Static type that follows him everywhere, until the final chorus where it's small and underneath him."),
 ("stars", "STARS / night / tonight", "hot", "stars ×2, one night, tonight ×3", "Points of light that ignite with his voice and become DRIFT's destination."),
 ("breath", "BREATH", "hot", "Yeah… / breathe / peace / breathing / hear myself", "The frame breathes with his voice. The calmest moments in the song."),
 ("tomorrow", "TOMORROW", "stone", "fighting / building / carrying the weight", "The outro's answer: three building blocks on a horizon line."),
 ("time", "TIME", "ink", "minute, time, deadlines, forever, past", "Clocks and calendars, drawn and then erased."),
 ("no-exit", "QUIT / DISAPPEAR / ENDING", "ink", "quit, disappear, ending", "Exits that he refuses. Drawn as ghosts and walked past, never dramatised."),
]
COLORS = [
 ("ink", "#efede9", "Default ink", "Every caption and most hero words."),
 ("stone", "#c4b6a2", "Stone accent", "The WEIGHT family (weight, pressure, carrying, stronger, tomorrow), the GOT list and FATHER. Struggle words are made of stone."),
 ("hot", "#fff4e6", "Hot point", "Light words: stars, night, tonight, breathe, silence, and the eraser line of NO."),
 ("drift", "#a9b7c4", "Drift blue-grey (new, your call)", "Only DRIFT and FLOAT: a very slightly cool grey, so the one word the song is about reads like night air. If you'd rather keep strictly to the old palette, it becomes plain ink."),
 ("red", "#e5483b", "Red: money only", "The song has no money words, so red never appears. Even the notification badges stay grey."),
]
RHYMES = {7:"A",8:"A",9:"A",11:"B",13:"B",15:"C",17:"C",19:"D",21:"D",25:"E",27:"E",32:"E",36:"F",38:"F",40:"G",42:"G",44:"H",46:"H",48:"I",50:"I",65:"J",67:"J",69:"J",71:"J",72:"K",76:"K",78:"K",81:"L",82:"L",89:"M",90:"M"}

# ---- repeats ----
STOP = set("i i'm you a the to of my me and on in for that it is i'll can't don't doesn't with no all this what's that's just so be being".split())
cnt = collections.Counter(norm(w["w"]) for l in LINES for w in l["words"])
# ---- energy / vocal ----
E = T["energy"]; dur = T["duration"]
sec_stats = []
for s in SECS:
    a, b = int(s["start"]), int(s["end"])
    ws = [w for l in LINES if l["section"] == s["id"] for w in l["words"]]
    sec_stats.append({"id": s["id"], "label": s["label"], "start": s["start"], "end": s["end"],
        "energy": round(float(np.mean(E[a:b])), 2), "vocal": round(float(np.mean([w["peak"] for w in ws])), 2) if ws else 0,
        "kicks": sum(1 for k in T["kicks"] if s["start"] <= k["t"] < s["end"]),
        "held": sum(1 for w in ws if w["held"])})

# ---- map SVG ----
PX = 9; Wd = int(dur * PX) + 40; Hh = 300
def ex(t): return 20 + t * PX
svg = [f'<svg class="map" viewBox="0 0 {Wd} {Hh}" width="{Wd}" height="{Hh}" role="img" aria-label="Song map: sections, energy, held notes and hero words over 4:24">']
shade = {"intro":"var(--band1)","verse1":"var(--band2)","prechorus":"var(--band1)","chorus":"var(--band3)","verse2":"var(--band2)","bridge":"var(--band1)","breakdown":"var(--band3)","outro":"var(--band2)"}
for s in SECS:
    svg.append(f'<rect x="{ex(s["start"]):.1f}" y="20" width="{(s["end"]-s["start"])*PX:.1f}" height="250" fill="{shade[s["kind"]]}"/>')
    svg.append(f'<text x="{ex(s["start"])+4:.1f}" y="34" class="ml">{esc(s["label"].upper())}</text>')
for t in range(0, int(dur) + 1, 15):
    svg.append(f'<line x1="{ex(t)}" x2="{ex(t)}" y1="270" y2="276" stroke="var(--muted)"/><text x="{ex(t)}" y="290" class="mt" text-anchor="middle">{t//60}:{t%60:02d}</text>')
pts = " ".join(f"{ex(i+0.5):.1f},{250 - v*120:.1f}" for i, v in enumerate(E))
svg.append(f'<polygon points="{ex(0.5)},250 {pts} {ex(len(E)-0.5)},250" fill="var(--energy)" stroke="none"/>')
svg.append(f'<polyline points="{pts}" fill="none" stroke="var(--muted)" stroke-width="1.2"/>')
for k in T["kicks"]:
    if k["v"] > 0.35: svg.append(f'<line x1="{ex(k["t"]):.1f}" x2="{ex(k["t"]):.1f}" y1="262" y2="270" stroke="var(--muted)" stroke-width="1"/>')
row = 0
for li, l in enumerate(LINES):
    h = H.get(str(li)); 
    if not h: continue
    w = next((w for w in l["words"] if norm(w["w"]) == norm(h["hero"])), l["words"][-1])
    col = {"QUIET CAPTION":"var(--muted)"}.get(h["fx"], "var(--drift)" if base_fx(h["fx"]) in ("DRIFT","FLOAT") else "var(--stone)" if h["motif"] in ("weight","got-list","father","tomorrow") else "var(--hot)" if h["motif"] in ("stars","breath","tonight","no") else "var(--ink)")
    y = 56 + (row % 7) * 26; row += 1
    svg.append(f'<rect x="{ex(w["s"]):.1f}" y="{y+5}" width="{max(3,(w["e"]-w["s"])*PX):.1f}" height="5" rx="2" fill="{col}"/>')
    svg.append(f'<text x="{ex(w["s"]):.1f}" y="{y}" class="mw" fill="{col}">{esc(h["hero"].strip(".").upper())}</text>')
svg.append(f'<text x="{ex(238.5):.1f}" y="230" class="mt">near-silence</text><text x="{ex(249.2):.1f}" y="230" class="mt">beat returns</text>')
svg.append("</svg>")

def spark(env):
    if not env: env = [0]
    n = len(env); w = max(24, min(120, n * 6))
    p = " ".join(f"{i * (w / max(1, n - 1)):.1f},{18 - v * 16:.1f}" for i, v in enumerate(env)) if n > 1 else f"0,{18-env[0]*16} {w},{18-env[0]*16}"
    return f'<svg class="sp" viewBox="0 0 {w} 20" width="{w}" height="20" aria-hidden="true"><polyline points="{p}" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>'

# ---- hero rows ----
rows_by_sec = collections.OrderedDict((s["id"], []) for s in SECS)
for li, l in enumerate(LINES):
    h = H[str(li)]
    w = next((w for w in l["words"] if norm(w["w"]) == norm(h["hero"])), None)
    rep = cnt[norm(h["hero"])]
    words_html = " ".join(f'<b>{esc(x["w"])}</b>' if x is w else esc(x["w"]) for x in l["words"])
    rows_by_sec[l["section"]].append(f'''
<article class="hero" id="h{li}" data-li="{li}" data-word="{esc(h['hero'])}" data-fx="{esc(h['fx'])}">
  <div class="hw"><span class="t">{fmt(w['s'])}</span><h4 class="m-{esc(h['motif'].replace('/','-'))}">{esc(h['hero'].strip('.').upper())}</h4><span class="fx">{esc(h['fx'])}</span></div>
  <p class="line">{words_html}</p>
  <dl class="facts">
    <div><dt>sung</dt><dd>{w['s']:.2f}–{w['e']:.2f} s{' · <em>held ' + format(w['dur'], '.1f') + ' s</em>' if w['held'] else ''}</dd></div>
    <div><dt>voice</dt><dd>{spark(w['env'])} {int(w['peak']*100)}%</dd></div>
    <div><dt>hits</dt><dd>{' · '.join(x for x in [('lands on a kick' if w['kick'] else ('on the beat' if w['beat'] else '')), ('×' + str(rep) + ' in song' if rep > 1 else ''), ('rhyme ' + RHYMES[li] if li in RHYMES else '')] if x) or 'off the beat'}</dd></div>
    <div><dt>meaning</dt><dd>{esc(h['type'])} · {'literal' if h['lit']=='lit' else 'figurative'} · <span class="role r-{h['role']}">{h['role']}</span></dd></div>
  </dl>
  <p class="note">{esc(h['note'])}</p>
  <div class="mark" role="radiogroup" aria-label="Your call on {esc(h['hero'])}">
    <label><input type="radio" name="m{li}" value="keep" id="m{li}k"> Keep</label>
    <label><input type="radio" name="m{li}" value="change" id="m{li}c"> Change</label>
    <label><input type="radio" name="m{li}" value="idea" id="m{li}i"> My idea</label>
    <input type="text" id="n{li}" placeholder="Note (what to change, or your idea)" aria-label="Note for {esc(h['hero'])}">
  </div>
</article>''')

# ---- full word tables ----
wt = []
for s in SECS:
    rows = []
    for l in LINES:
        if l["section"] != s["id"]: continue
        li = LINES.index(l); h = H[str(li)]
        for w in l["words"]:
            hero = norm(w["w"]) == norm(h["hero"])
            c = cnt[norm(w["w"])]
            rows.append(f'<tr class="{"hr" if hero else ""}"><td>{esc(w["w"])}</td><td>{w["s"]:.2f}</td><td>{w["e"]:.2f}</td><td>{w["dur"]:.2f}{" held" if w["held"] else ""}</td><td>{int(w["peak"]*100)}</td><td>{"kick" if w["kick"] else ("beat" if w["beat"] else "")}</td><td>{"×"+str(c) if c>1 and norm(w["w"]) not in STOP else ""}</td><td>{"hero · "+esc(h["fx"]) if hero else "caption"}</td><td>{"est." if w["src"]=="interp" else w["src"]}</td></tr>')
    wt.append(f'<details><summary>{esc(s["label"])} <span>{fmt(s["start"])}–{fmt(s["end"])} · {sum(1 for l in LINES if l["section"]==s["id"] for _ in l["words"])} words</span></summary><div class="tw"><table><thead><tr><th>word</th><th>start</th><th>end</th><th>length</th><th>voice %</th><th>on</th><th>repeat</th><th>role</th><th>timing source</th></tr></thead><tbody>{"".join(rows)}</tbody></table></div></details>')

fx_used = collections.defaultdict(list)
for li, l in enumerate(LINES): fx_used[base_fx(H[str(li)]["fx"])].append(H[str(li)]["hero"].strip(".").upper())
fx_html = "".join(f'<div class="fxc"><h4>{k}{" <small>requested</small>" if k in REQUESTED else " <small>new</small>"}</h4><p>{esc(v)}</p><p class="used">{esc(", ".join(dict.fromkeys(fx_used.get(k, []))) or "not cast in Drift")}</p></div>' for k, v in FX.items())
motif_html = "".join(f'<div class="mo"><h4 class="c-{c}">{esc(n)}</h4><p class="occ">{esc(o)}</p><p>{esc(d)}</p></div>' for _, n, c, o, d in MOTIFS)
color_html = "".join(f'<div class="sw"><span class="chip" style="background:{hx}"></span><div><h4>{esc(n)} <code>{hx}</code></h4><p>{esc(d)}</p></div></div>' for _, hx, n, d in COLORS)
stat_rows = "".join(f'<tr><td>{esc(s["label"])}</td><td>{fmt(s["start"])}</td><td>{s["end"]-s["start"]:.0f} s</td><td><span class="bar" style="--v:{s["energy"]}"></span>{int(s["energy"]*100)}</td><td>{int(s["vocal"]*100)}</td><td>{s["kicks"]}</td><td>{s["held"]}</td></tr>' for s in sec_stats)
hero_html = "".join(f'<section class="sec" id="s-{sid}"><h3>{esc(next(s["label"] for s in SECS if s["id"]==sid))} <span>{fmt(next(s["start"] for s in SECS if s["id"]==sid))}</span></h3>{"".join(r)}</section>' for sid, r in rows_by_sec.items())

page = open("scripts/word_report.tpl.html").read()
for k, v in {"MAP": "".join(svg), "STATS": stat_rows, "MOTIFS": motif_html, "COLORS": color_html, "FX": fx_html, "HEROES": hero_html, "WORDS": "".join(wt),
             "NWORDS": str(sum(len(l["words"]) for l in LINES)), "NLINES": str(len(LINES))}.items():
    page = page.replace("{{" + k + "}}", v)
open("creative/word-analysis.html", "w").write(page)
print("ok", len(page))
