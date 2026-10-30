"""lyrics.txt + Suno chunk onsets + vocal features + beats -> data/timing.json

No ASR model is reachable from this environment, so word timing is built from:
  1. Suno caption chunks: the time each chunk first turns bold (suno_chunks.json),
  2. data/anchors.json: hand-checked word onsets (from the spectrogram) that override 1,
  3. inside a chunk, words are spread by syllable count over the voiced span.
Each word also gets the voice's loudness through it (vocal.json, 10 Hz) and, when the note is
held, how long it is held. Words that land on a kick are marked."""
import json, re, sys, os
import numpy as np
ROOT = sys.argv[1] if len(sys.argv) > 1 else "."
beats = json.load(open(f"{ROOT}/data/beats.json"))
chunks = json.load(open(f"{ROOT}/data/suno_chunks.json"))
voc = json.load(open(f"{ROOT}/data/vocal.json"))
anchors = json.load(open(f"{ROOT}/data/anchors.json")) if os.path.exists(f"{ROOT}/data/anchors.json") else {}
DUR = beats["duration"]
HOP = voc["hop"]
DB = np.array(voc["db"])
# smoothed loudness, 0..1 over -42..0 dB
DBs = np.convolve(DB, np.ones(5) / 5, "same")
loud = lambda t: float(np.clip((DBs[min(len(DBs) - 1, max(0, int(t / HOP)))] + 42) / 42, 0, 1))

def syl(w):
    w = re.sub(r"[^a-z]", "", w.lower())
    if not w: return 1
    g = len(re.findall(r"[aeiouy]+", w))
    if w.endswith("e") and not w.endswith(("le", "ee")) and g > 1: g -= 1
    return max(1, g)

SECTION_KIND = {"Intro": "intro", "Verse 1": "verse1", "Verse 2": "verse2", "Pre-Chorus": "prechorus",
                "Chorus": "chorus", "Bridge": "bridge", "Breakdown": "breakdown", "Final Chorus": "chorus", "Outro": "outro"}
sections, lines, words = [], [], []
cur = None
for raw in open(f"{ROOT}/data/lyrics.txt"):
    raw = raw.strip()
    if not raw: continue
    m = re.match(r"^\[(.+?)\]$", raw)
    if m:
        name = m.group(1); kind = SECTION_KIND[name]
        k = sum(1 for s in sections if s["kind"] == kind) + 1
        sid = f"{kind}{k}" if kind in ("chorus", "prechorus") else kind
        if name == "Final Chorus": sid = "chorus3"
        cur = {"id": sid, "kind": kind, "tag": name, "label": name, "lines": []}
        sections.append(cur); continue
    ln = {"id": f"L{len(lines):03d}", "section": cur["id"], "text": raw, "style": "sung", "words": []}
    for w in raw.split():
        wd = {"w": w, "line": len(lines), "i": len(words)}
        ln["words"].append(wd); words.append(wd)
    cur["lines"].append(ln["id"]); lines.append(ln)

# ---- anchors: chunk onsets, then manual overrides (key = global word index) ----
anc = {c["w0"]: (c["t"], "suno") for c in chunks}
for k, v in anchors.items():
    if not k.startswith("_"): anc[int(k)] = (float(v), "manual")
# every line start without an anchor gets one from the previous chunk + syllable pace later
idx = sorted(anc)
for a, b in zip(idx, idx[1:] + [len(words)]):
    ta = anc[a][0]
    tb = anc[b][0] if b < len(words) else ta + 4.5
    run = words[a:b]
    # voiced span of the chunk: until loudness drops for good before the next chunk
    end = tb
    for t in np.arange(tb - 0.1, ta + 0.3, -0.05):
        if loud(t) > 0.45: end = min(tb, t + 0.15); break
    span = max(0.25 * len(run), end - ta)
    # pace: at most ~0.32 s per syllable, the last word takes the rest (held notes)
    sy = [syl(w["w"]) for w in run]
    pace = min(0.32, span / max(1, sum(sy)))
    t = ta
    for q, w in enumerate(run):
        w["s"] = round(t, 3); w["src"] = anc[a][1] if q == 0 else "interp"
        t += sy[q] * pace
    for q, w in enumerate(run):
        w["e"] = round(run[q + 1]["s"] if q + 1 < len(run) else max(w["s"] + 0.2, end), 3)

# ---- per-word sung features ----
kicks = [k["t"] for k in beats["kicks"]]
bt = beats["beats"]
for w in words:
    s, e = w["s"], w["e"]
    ts = np.arange(s, e, 0.1)
    env = [round(loud(x), 2) for x in ts] or [round(loud(s), 2)]
    w["env"] = env
    w["peak"] = max(env)
    w["dur"] = round(e - s, 2)
    w["held"] = bool(e - s >= 0.6 * syl(w["w"]) + 0.25)
    nk = min(kicks, key=lambda x: abs(x - s)); w["kick"] = bool(abs(nk - s) < 0.09)
    nb = min(bt, key=lambda x: abs(x - s)); w["beat"] = bool(abs(nb - s) < 0.07)
for ln in lines:
    ln["start"], ln["end"] = ln["words"][0]["s"], ln["words"][-1]["e"]
    ln["anchored"] = round(sum(w["src"] != "interp" for w in ln["words"]) / len(ln["words"]), 2)
    for w in ln["words"]: del w["line"]

down = beats["downbeats"]
for si, sec in enumerate(sections):
    s = next(l for l in lines if l["id"] == sec["lines"][0])["start"]
    prev = [d for d in down if s - 2.5 <= d <= s - 0.05]
    sec["start"] = 0.0 if si == 0 else round(prev[-1] if prev else s - 0.4, 3)
for si, sec in enumerate(sections):
    sec["end"] = round(sections[si + 1]["start"] if si + 1 < len(sections) else DUR, 3)

json.dump({"fps": 30, "duration": DUR, "bpm": beats["bpm"], "beats": bt, "downbeats": down, "kicks": beats["kicks"],
           "energy": beats["energy"], "low": beats["low"], "sections": sections, "lines": lines},
          open(f"{ROOT}/data/timing.json", "w"), indent=0)
fmt = lambda x: f"{int(x // 60)}:{x % 60:05.2f}"
for sec in sections:
    print(f"[{fmt(sec['start'])} – {fmt(sec['end'])}] {sec['tag']}")
    for lid in sec["lines"]:
        l = next(x for x in lines if x["id"] == lid)
        print(f"   {fmt(l['start'])}  " + " ".join(f"{w['w']}{'~' + str(w['dur']) if w['held'] else ''}{'*' if w['kick'] else ''}" for w in l["words"]))
