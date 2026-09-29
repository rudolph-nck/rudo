"""
Builds data/scenes.json — the editable scene manifest.

chapters[] : which world renders which span (start/end frames, transitions)
scenes[]   : one entry per lyric moment with concept/camera/transition notes.
             Worlds read `display` + `heroWord` from here, so text edits land
             without touching animation code.
Run after build_data.py:  python3 scripts/build_scenes.py
"""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "data")
FPS = 30
lyr = {l["id"]: l for l in json.load(open(os.path.join(DATA, "lyrics.json")))["lines"]}

# chapter: id, world, start s, end s, transitionIn, transitionOut, background, accent
CHAPTERS = [
    ("signal",      "SignalWorld",  0.00,  30.10, "fade from black", "timeline slams in on drop", "ink", "blue line"),
    ("verse",       "VerseWorld",  29.90,  57.60, "whip-in on drop", "curve shoots up → cut on downbeat", "ink", "blue line / plus"),
    ("chorus",      "ChorusWorld", 57.40,  77.10, "hard cut on downbeat", "freeze → vanishing point", "ink", "beat meter"),
    ("branches",    "MapWorld",    76.80, 118.10, "point → map tilt", "nodes slide into one line", "ink", "live nodes"),
    ("departments", "RailWorld",  117.80, 186.40, "nodes → rail", "rail bends into ring → snap to black", "ink", "station word"),
    ("beatcut",     "MosaicWorld",186.20, 199.50, "black", "plus of names → dissolve to warm dark", "ink", "plus of names"),
    ("bridge",      "BridgeWorld",199.20, 216.80, "warm fade", "line rotates horizontal", "warm dark", "single line"),
    ("build",       "BuildWorld", 216.50, 225.90, "line continues", "line holds → the drop", "ink", "one line"),
    ("finale",      "FinaleWorld",225.60, 247.60, "the drop — DJ lights up", "everything collapses to one line", "ink", "the DJ"),
    ("climax",      "ClimaxWorld",247.40, 263.90, "line under tension", "logo holds → dissolve", "ink", "plus"),
    ("outro",       "OutroWorld", 263.70, 282.00, "line", "line → point → black", "ink", "line / Addapalooza"),
]

# lines whose world already displays the full lyric as hero type → no caption
IN_WORLD = {
    "oneaddition", "learned1", "taught1", "changed1", "grew1",
    "y2026", "otor1", "otor2", "howwemove", "holdup", "letsroll", "departments",
    "frontline", "backoffice", "mix", "names", "roles", "piece", "thatsaddition",
    "learn", "learn2", "teach", "teach2", "improve2", "improve3", "integrity", "integrity2",
    "offices", "roles2", "stories2", "roads2", "rhythmstarts", "moveasone",
    "drop1", "showem", "otor3", "otor3b", "otor3c", "thisishow", "otor4", "beenthrough", "branchesback", "everycrew",
    "test", "together", "learned2", "taught2", "changed2", "grew2", "oneteam5", "onerhythm5", "acu1",
    "oneteam6", "onemission", "onerhythm6", "welcome", "summit",
}

# per-lyric concept notes: id -> (visualConcept, cameraBehavior, transitionIn, transitionOut, assets)
N = {
 "yeah": ("point stretches into the brand line", "imperceptible push", "from point", "", []),
 "y2026": ("line becomes ruler; 2026 rises, line passes behind numerals", "slow push", "ticks cascade", "", []),
 "whatayear": ("italic serif margin note on a hairline leader", "", "write-on", "", []),
 "roads0": ("lines peel off the main line at different angles", "tilt", "", "", []),
 "stories0": ("lines settle at different heights with indices", "", "", "", []),
 "destination": ("all lines converge on one vanishing point", "", "", "point", []),
 "acu0": ("vanishing point blooms into plus; logo lockup with brand lines", "locked", "bloom", "line carries on", ["logos/logo-reverse.svg"]),
 "changin": ("timeline JAN; CHANGIN' scrambles and locks", "lateral truck", "whip-in", "", []),
 "twoteams": ("two lines race in: 01 ADDITION / 02 ENVISION; FUTURE point", "truck", "", "", []),
 "envision": ("horizontal + rising vertical cross into the brand plus", "push-in", "", "plus", []),
 "sides": ("pull back: plus between two constellations; ONE CALL ring pulse", "fast pullback", "", "", []),
 "march": ("months whip to MAR; CONVERSION progress line 0→100", "whip → hold", "", "line", []),
 "longdays": ("progress line curls into 24h dial; day/night light", "slow orbit", "", "ring", []),
 "groove": ("ring unrolls into beat-reactive waveform", "", "", "wave", []),
 "improve": ("jittery waves resolve into one rising curve", "tilt with curve", "", "curve exits top", []),
 "otor1": ("full-bleed ONE TEAM / ONE RHYTHM; line = beat meter", "downbeat scale 2%", "hard cut", "", []),
 "everybody": ("narrative slides; hero tracks apart", "", "", "", []),
 "otor2": ("chorus type on a rotating 3D plane", "yaw 30°", "", "", []),
 "lookdid": ("verse words stream through depth", "dolly", "", "", []),
 "roads1": ("line tips into ground plane = road; side roads merge", "low drive", "", "", []),
 "asone": ("roads merged; horizon is the line; AS ONE", "crane up", "", "", []),
 "learned1": ("word painted on road", "drive", "", "", []),
 "taught1": ("word painted on road", "drive", "", "", []),
 "changed1": ("word painted on road", "drive", "", "", []),
 "grew1": ("word painted on road", "drive", "", "", []),
 "howwemove": ("speed; THAT'S HOW WE MOVE on horizon", "accelerate", "", "freeze", []),
 "holdup": ("freeze; everything falls away but the vanishing point", "freeze", "", "point", []),
 "letsroll": ("tilt down onto dark map; BRANCHES / LET'S ROLL", "tilt down", "", "", []),
 "b08": ("pull back — both regions joined by one path", "pullback", "", "", []),
 "b13": ("long arc from panhandle back to Orlando", "follow arc", "", "", []),
 "b16": ("overhead reveal of all nodes; counter", "crane overhead", "", "nodes", []),
 "departments": ("nodes slide into one line: the Rail; DEPARTMENTS", "snap to side view", "", "", []),
 "d23": ("LOUD full-bleed", "", "", "", []),
 "oneaddition": ("rail bends into ring of names around plus", "pullback/orbit", "", "ring", []),
 "frontline": ("near plane FRONT LINE.", "", "black", "", []),
 "backoffice": ("dolly through to far plane BACK OFFICE.", "dolly through", "", "", []),
 "mix": ("all names swirl in 3D, settle into wall", "settle", "", "", []),
 "names": ("scan highlights names", "slow push", "", "", []),
 "roles": ("scan highlights roles", "", "", "", []),
 "piece": ("each piece lights individually", "", "", "", []),
 "thatsaddition": ("names inside a plus region light blue", "hold", "", "plus", []),
 "learn": ("i. Learn — vertical line extends beyond frame", "tilt up", "warm fade", "", []),
 "teach": ("ii. Teach — second line lifted beside first", "", "", "", []),
 "improve2": ("iii. Improve — passes GOOD ENOUGH tick", "", "", "", []),
 "integrity": ("iv. Absolute Integrity — straight bright line rotates to lead", "", "", "line", []),
 "offices": ("office windows in perspective", "fast push", "", "", []),
 "roles2": ("rail names streak", "", "", "", []),
 "stories2": ("scattered story lines", "", "", "", []),
 "roads2": ("road lines", "", "", "", []),
 "rhythmstarts": ("all lines collapse to one trembling line", "", "", "", []),
 "moveasone": ("line locks; WE MOVE AS ONE", "", "", "", []),
 "jax": ("helmet emerges lit by A+ visor", "slow push", "darkness", "", ["images/dj-helmet-front.png"]),
 "ready": ("visor flare; YOU READY?", "", "", "flash", ["images/dj-helmet-front.png"]),
 "showem": ("lit extruded 3D plus monument", "orbit", "flash", "", []),
 "otor3": ("chorus type around monument", "orbit", "", "", []),
 "thisishow": ("DJ at booth in notched frame", "push", "", "", ["images/dj-booth.png"]),
 "otor4": ("chorus type + beat meter callback", "", "", "", []),
 "beenthrough": ("timeline rush callback", "dolly", "", "", []),
 "branchesback": ("map + rail callbacks", "", "", "", []),
 "everycrew": ("everything collapses into one line", "", "", "line", []),
 "test": ("2026 over a line under tension", "", "", "", []),
 "together": ("lines from every direction lock into giant plus; burst", "", "", "", []),
 "acu1": ("logo lockup full width with brand lines", "locked", "", "", ["logos/logo-reverse.svg"]),
 "welcome": ("Addapalooza mark revealed by light sweep; line through banner", "push", "", "", ["images/addapalooza-logo.png"]),
 "summit": ("SUMMIT 2026 + tagline; helmet visor", "", "", "", ["images/dj-helmet-3q.png"]),
}

def chapter_of(t):
    best = None
    for c in CHAPTERS:
        if c[2] <= t < c[3]:
            best = c
    return best[0] if best else CHAPTERS[-1][0]

beats = json.load(open(os.path.join(DATA, "beats.json")))

def main():
    chapters = [{
        "id": cid, "world": world, "start": s, "end": e,
        "startFrame": round(s * FPS), "endFrame": round(e * FPS),
        "transitionIn": ti, "transitionOut": to, "background": bg, "accent": acc,
    } for cid, world, s, e, ti, to, bg, acc in CHAPTERS]
    ids = list(lyr.keys())
    scenes = []
    for i, lid in enumerate(ids):
        l = lyr[lid]
        end = lyr[ids[i + 1]]["start"] if i + 1 < len(ids) else 282.0
        concept, cam, tin, tout, assets = N.get(lid, ("", "", "", "", []))
        bm = [round(b * FPS) for b in beats["downbeats"] if l["start"] <= b < end]
        scenes.append({
            "scene": lid,
            "chapter": chapter_of(l["start"]),
            "startFrame": round(l["start"] * FPS),
            "endFrame": round(end * FPS),
            "lyric": l["text"],
            "display": l["text"],
            "heroWord": l["hero"],
            "visualConcept": concept,
            "cameraBehavior": cam,
            "background": "ink",
            "accent": "#00B2E3",
            "transitionIn": tin,
            "transitionOut": tout,
            "assetReferences": assets,
            "beatMarkers": bm,
            "caption": lid not in IN_WORLD,
            "notes": "",
        })
    json.dump({"fps": FPS, "width": 1920, "height": 1080, "durationInFrames": 8460,
               "chapters": chapters, "scenes": scenes},
              open(os.path.join(DATA, "scenes.json"), "w"), indent=1, ensure_ascii=False)
    print(len(chapters), "chapters,", len(scenes), "scenes")

if __name__ == "__main__":
    main()
