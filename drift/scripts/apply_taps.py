"""data/taps.txt (RUDO's tap-along: li.wi.si start) -> data/anchors.json.
Each tap is the moment that syllable is sung, nothing more: the syllable starts on its tap and lasts until the
next tap (RUDO waited for the next word before tapping again). Median offset vs stem onsets is -0.03 s: no shift."""
import json, sys
ROOT = sys.argv[1] if len(sys.argv) > 1 else "."
tl = json.load(open(f"{ROOT}/data/timing.json")); L = tl["lines"]
T = [(tuple(map(int, k.split("."))), float(s)) for k, s, e in (l.split() for l in open(f"{ROOT}/data/taps.txt").read().splitlines()[1:])]
gi = {}; n = 0
for li, l in enumerate(L):
    for wi, w in enumerate(l["words"]): gi[(li, wi)] = n; n += 1
syl = {}
for i, ((li, wi, si), s) in enumerate(T):
    syl.setdefault(gi[(li, wi)], []).append(s)
out = {"_": "from data/taps.txt (RUDO tap-along) via scripts/apply_taps.py; _syl = syllable starts + end (= next tap)"}
S = {}
order = sorted(syl)
for k, g in enumerate(order):
    nxt = syl[order[k + 1]][0] if k + 1 < len(order) else syl[g][-1] + 1.5
    out[str(g)] = syl[g][0]
    S[str(g)] = syl[g] + [nxt]
out["_lock"] = list(range(len(L)))
out["_syl"] = S
json.dump(out, open(f"{ROOT}/data/anchors.json", "w"), indent=0)
print(len(S), "words")
