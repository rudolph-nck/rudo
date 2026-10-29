"""lyrics.txt + ASR words + beat analysis -> data/timing.json

Forced alignment: a global Needleman-Wunsch pass between the lyric word sequence and the
ASR word sequence (fuzzy word similarity). Matched lyric words take the ASR start time;
unmatched runs are interpolated between anchors without spilling into instrumental gaps.
"""
import json, re, sys
from difflib import SequenceMatcher

ROOT = sys.argv[1] if len(sys.argv) > 1 else "."
LYR = open(f"{ROOT}/data/lyrics.txt").read()
asr_a = json.load(open(f"{ROOT}/data/asr/parakeet_vocals.json"))
asr_b = json.load(open(f"{ROOT}/data/asr/parakeet_vocals_w6.json"))
beats = json.load(open(f"{ROOT}/data/beats.json"))
DUR = beats["duration"]

norm = lambda w: re.sub(r"[^a-z0-9]", "", w.lower())

# ---------- lyrics ----------
SECTION_KIND = {
    "Intro": "intro", "Final Chorus": "chorus", "Verse 1": "verse1", "Pre-Chorus": "prechorus", "Chorus": "chorus",
    "Post-Chorus": "postchorus", "Verse 2": "verse2", "Verse 3": "verse3", "Bridge": "bridge", "Outro": "outro",
}
sections, lines = [], []
cur = None
for raw in LYR.splitlines():
    raw = raw.strip()
    if not raw:
        continue
    m = re.match(r"^\[(.+?)\]$", raw)
    if m:
        tag = m.group(1)
        name = tag.split(":")[0].strip()
        if name not in SECTION_KIND:  # performance notes: [Shouted], [Strings swell, 808 drop], [End]
            if cur is not None:
                cur.setdefault("notes", []).append(tag)
            continue
        kind = SECTION_KIND[name]
        n = sum(1 for s in sections if s["kind"] == kind) + 1
        cur = {"id": f"{kind}{n}" if kind in ("chorus", "prechorus", "postchorus") else kind,
               "kind": kind, "tag": tag, "label": name, "lines": []}
        sections.append(cur)
        continue
    adlib = raw.startswith("(")
    text = raw.strip("()")
    letters = re.sub(r"[^A-Za-z]", "", text)
    impact = len(letters) > 3 and letters.isupper()
    k = cur["kind"]
    if adlib:
        style = "adlib"
    elif impact:
        style = "impact"
    elif k in ("verse1", "verse2", "verse3", "postchorus", "prechorus"):
        style = "rap"
    else:
        style = "sung"
    line = {"id": f"L{len(lines):03d}", "section": cur["id"], "text": text, "style": style,
            "words": [{"w": w} for w in text.split()]}
    cur["lines"].append(line["id"])
    lines.append(line)

L = [(li, wi, norm(w["w"])) for li, ln in enumerate(lines) for wi, w in enumerate(ln["words"])]

# ---------- ASR: merge the two window passes ----------
A = sorted(asr_a, key=lambda w: w["s"])
for w in asr_b:  # fill holes the 12 s windows missed
    if not any(abs(w["s"] - x["s"]) < 0.3 and (norm(w["w"]) == norm(x["w"]) or abs(w["s"] - x["s"]) < 0.05) for x in A):
        A.append(w)
A = sorted([w for w in A if norm(w["w"])], key=lambda w: w["s"])
An = [norm(w["w"]) for w in A]

# ---------- alignment ----------
cache = {}
def sim(a, b):
    k = (a, b)
    if k not in cache:
        cache[k] = 1.0 if a == b else SequenceMatcher(None, a, b).ratio()
    return cache[k]

n, m = len(L), len(An)
GAP_L, GAP_A = -0.55, -0.35  # skipping an ASR word (ad-lib/hallucination) is cheaper
S = [[0.0] * (m + 1) for _ in range(n + 1)]
P = [[0] * (m + 1) for _ in range(n + 1)]
for i in range(1, n + 1):
    S[i][0] = i * GAP_L; P[i][0] = 1
for j in range(1, m + 1):
    S[0][j] = j * GAP_A; P[0][j] = 2
for i in range(1, n + 1):
    li = L[i - 1][2]
    Si, Sp = S[i], S[i - 1]
    for j in range(1, m + 1):
        s = sim(li, An[j - 1])
        diag = Sp[j - 1] + (2.0 * s if s >= 0.55 else -1.0)
        up = Sp[j] + GAP_L
        left = Si[j - 1] + GAP_A
        if diag >= up and diag >= left:
            Si[j] = diag; P[i][j] = 0
        elif up >= left:
            Si[j] = up; P[i][j] = 1
        else:
            Si[j] = left; P[i][j] = 2
match = [None] * n
loose = [None] * n  # diagonal pairings with a misheard word: still a good time estimate
i, j = n, m
while i > 0 and j > 0:
    if P[i][j] == 0:
        if sim(L[i - 1][2], An[j - 1]) >= 0.55:
            match[i - 1] = j - 1
        else:
            loose[i - 1] = j - 1
        i -= 1; j -= 1
    elif P[i][j] == 1:
        i -= 1
    else:
        j -= 1

# Within a line, an anchor far after its predecessor usually matched a later repeat of the
# same word (echoes, ad-libs). Re-point it at the nearest similar ASR word, or drop it.
for k in range(1, n):
    if match[k] is None or match[k - 1] is None or L[k][0] != L[k - 1][0]:
        continue
    t0, t1 = A[match[k - 1]]["s"], A[match[k]]["s"]
    if t1 - t0 > 2.0:
        cands = [j for j in range(match[k - 1] + 1, match[k]) if A[j]["s"] - t0 <= 1.5 and sim(L[k][2], An[j]) >= 0.55]
        match[k] = cands[0] if cands else None

# ---------- times ----------
t = [A[match[k]]["s"] if match[k] is not None else None for k in range(n)]
for k in range(n):
    if t[k] is None and loose[k] is not None:
        prv = next((t[q] for q in range(k - 1, -1, -1) if t[q] is not None), -1.0)
        nxt = next((t[q] for q in range(k + 1, n) if t[q] is not None and match[q] is not None), 1e9)
        if prv < A[loose[k]]["s"] < nxt and A[loose[k]]["s"] - prv < 1.5:
            t[k] = A[loose[k]]["s"]
# A run of unmatched lyric words facing the same number of unused ASR words between the
# same two anchors: pair them in order (misheard words still carry good onsets).
used = set(x for x in match if x is not None)
k = 0
while k < n:
    if t[k] is not None:
        k += 1; continue
    b = k
    while b < n and t[b] is None:
        b += 1
    ja = match[k - 1] if k > 0 and match[k - 1] is not None else None
    jb = match[b] if b < n and match[b] is not None else None
    if ja is not None and jb is not None:
        free = [j for j in range(ja + 1, jb) if j not in used and A[j]["s"] > A[ja]["s"]]
        if len(free) == b - k:
            for q, j in enumerate(free):
                t[k + q] = A[j]["s"]; loose[k + q] = j
    k = b
# drop anchors that break monotonicity (rare; from fuzzy matches)
last = -1.0
for k in range(n):
    if t[k] is not None:
        if t[k] <= last:
            t[k] = None
        else:
            last = t[k]
t_loose = [t[k] is not None and match[k] is None for k in range(n)]
RATE = {"rap": 0.24, "impact": 0.3, "sung": 0.38, "adlib": 0.35}
k = 0
while k < n:
    if t[k] is not None:
        k += 1; continue
    a = k - 1
    b = k
    while b < n and t[b] is None:
        b += 1
    ta = t[a] if a >= 0 else 0.0
    tb = t[b] if b < n else DUR - 1.0
    run = list(range(k, b))
    # split the run at line boundaries: words in the anchor-a line go forward from ta,
    # words in later lines go backward from tb (keeps words out of instrumental gaps)
    la = L[a][0] if a >= 0 else -1
    fwd = [x for x in run if L[x][0] == la]
    back = [x for x in run if L[x][0] != la]
    span = max(0.05, tb - ta)
    if fwd:
        r = min(RATE[lines[la]["style"]], span / (len(run) + 1))
        for q, x in enumerate(fwd):
            t[x] = ta + r * (q + 1)
    if back:
        lb = L[back[-1]][0]
        r = min(RATE[lines[lb]["style"]], (tb - (t[fwd[-1]] if fwd else ta)) / (len(back) + 1))
        for q, x in enumerate(reversed(back)):
            t[x] = tb - r * (q + 1)
    k = b

for k, (li, wi, _) in enumerate(L):
    lines[li]["words"][wi]["s"] = round(t[k], 3)
    lines[li]["words"][wi]["src"] = "asr" if match[k] is not None else ("asr-loose" if t_loose[k] else "interp")

# manual overrides: shift a whole line so it starts at the given time
import os
ap = f"{ROOT}/data/anchors.json"
for key, at in (json.load(open(ap)).items() if os.path.exists(ap) else []):
    if key.startswith("_"):
        continue
    sid, idx = key.split(":")
    sec = next(x for x in sections if x["id"] == sid)
    ln = next(x for x in lines if x["id"] == sec["lines"][int(idx)])
    d = at - ln["words"][0]["s"]
    for w in ln["words"]:
        w["s"] = round(w["s"] + d, 3); w["src"] = "manual"

TAIL = {"rap": 0.45, "impact": 0.8, "sung": 1.1, "adlib": 0.7}
for li, ln in enumerate(lines):
    ws = ln["words"]
    nxt = lines[li + 1]["words"][0]["s"] if li + 1 < len(lines) else DUR
    for q, w in enumerate(ws):
        if q + 1 < len(ws):
            w["e"] = round(min(ws[q + 1]["s"], w["s"] + 0.9), 3)
        else:
            w["e"] = round(max(w["s"] + 0.2, min(nxt, w["s"] + TAIL[ln["style"]])), 3)
    ln["start"], ln["end"] = ws[0]["s"], ws[-1]["e"]
    ln["anchored"] = round(sum(w["src"] != "interp" for w in ws) / len(ws), 2)

# impact lines land on the nearest 808 / kick
kicks = [k["t"] for k in beats["kicks"]]
for ln in lines:
    if ln["style"] == "impact":
        s = ln["start"]
        near = min(kicks, key=lambda x: abs(x - s))
        ln["hit"] = round(near if abs(near - s) < 0.2 else s, 3)

# ---------- sections ----------
down = beats["downbeats"]
for si, sec in enumerate(sections):
    first = next(l for l in lines if l["id"] == sec["lines"][0])
    s = first["start"]
    prev_db = [d for d in down if s - 2.5 <= d <= s - 0.05]
    sec["start"] = 0.0 if si == 0 else round(prev_db[-1] if prev_db else s - 0.4, 3)
for si, sec in enumerate(sections):
    sec["end"] = round(sections[si + 1]["start"] if si + 1 < len(sections) else DUR, 3)

out = {
    "fps": 30, "duration": DUR, "bpm": beats["bpm"],
    "beats": beats["beats"], "downbeats": down, "kicks": beats["kicks"],
    "energy": beats["energy"], "low": beats["low"],
    "sections": sections, "lines": lines,
}
json.dump(out, open(f"{ROOT}/data/timing.json", "w"), indent=1)

# ---------- summary ----------
fmt = lambda x: f"{int(x // 60)}:{x % 60:05.2f}"
print(f"duration {fmt(DUR)}  bpm {beats['bpm']}  beats {len(beats['beats'])}  downbeats {len(down)}  kicks {len(kicks)}")
tot = sum(len(l["words"]) for l in lines); anc = sum(w["src"] != "interp" for l in lines for w in l["words"])
print(f"lines {len(lines)}  words {tot}  ASR-anchored {anc} ({anc / tot:.0%})\n")
for sec in sections:
    print(f"[{fmt(sec['start'])} – {fmt(sec['end'])}] {sec['tag']}")
    for lid in sec["lines"]:
        l = next(x for x in lines if x["id"] == lid)
        flag = "" if l["anchored"] >= 0.5 else "   <-- low anchor"
        hit = f" hit {fmt(l['hit'])}" if "hit" in l else ""
        print(f"   {fmt(l['start'])}–{fmt(l['end'])}  {l['style']:6s} {l['anchored']:.0%}  {l['text']}{hit}{flag}")
