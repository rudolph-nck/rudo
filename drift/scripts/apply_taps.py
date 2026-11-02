"""data/taps.txt (RUDO's tap-along, li.wi.si start end) -> data/anchors.json.
Every syllable start comes straight from the taps (median offset vs the stem onsets is -0.03 s, so no shift).
On a line's last syllable a tap that lands in silence, with no vocal onset near it, marks where the held note
LANDS: the syllable starts on the first vocal onset after the previous tap and holds until the tap."""
import json, sys, numpy as np
ROOT = sys.argv[1] if len(sys.argv) > 1 else "."
voc = json.load(open(f"{ROOT}/data/vocal.json")); H = voc["hop"]; db = np.array(voc["db"])
ons = np.array([o["t"] for o in voc["onsets"] if o["db"] > -40])
tl = json.load(open(f"{ROOT}/data/timing.json")); L = tl["lines"]
old = json.load(open(f"{ROOT}/data/anchors.pre-taps.json"))
T = [(tuple(map(int, k.split("."))), float(s)) for k, s, e in (l.split() for l in open(f"{ROOT}/data/taps.txt").read().splitlines()[1:])]
gi = {}; n = 0
for li, l in enumerate(L):
    for wi, w in enumerate(l["words"]): gi[(li, wi)] = n; n += 1
KEEP = {15: old["_syl"]["15"]}  # DISAPPEAR: approved as is ("disappear is perfect")
syl, land = {}, []
for i, ((li, wi, si), s) in enumerate(T):
    start, end = s, None
    last = wi == len(L[li]["words"]) - 1 and si == len(L[li]["words"][wi]["syl"]) - 1
    if last and i:
        p = T[i - 1][1]
        d = db[int(s / H)]
        near = np.abs(ons - s).min() < 0.15
        if s - p > 0.9 and (d < -25 or (not near and d < -18)):
            after = ons[(ons > p + 0.12) & (ons < min(s - 0.3, p + 0.9))]
            prev = L[li]["words"][wi]["syl"][si]["s"]  # the stem-snapped start from before the taps
            st = float(after[0]) if len(after) else (prev if p + 0.08 < prev < s - 0.3 else p + 0.1)
            if st: start, end = st, s; land.append((L[li]["words"][wi]["w"], start, end))
    syl.setdefault(gi[(li, wi)], []).append(start)
    if end: syl[gi[(li, wi)]].append(end)
out = {"_": "from data/taps.txt (RUDO tap-along) via scripts/apply_taps.py; _syl = syllable starts + note end (null = measured from the stem)"}
S = {}
for g, v in sorted(syl.items()):
    w = L[[li for li, wi in gi if gi[(li, wi)] == g][0]]["words"]
    if g in KEEP: v = KEEP[g]
    out[str(g)] = round(v[0], 3)
    nsyl = sum(1 for (li, wi, si), _ in T if gi[(li, wi)] == g)
    S[str(g)] = [round(x, 3) for x in v] + ([None] if len(v) == nsyl else [])
out["_lock"] = list(range(len(L)))
out["_syl"] = S
json.dump(out, open(f"{ROOT}/data/anchors.json", "w"), indent=0)
for x in land: print("lands:", x)
