"""RUDO's taps + the lead vocal stem (+ forced alignment) -> data/anchors.json.
1. Each syllable starts on RUDO's tap, nudged onto the nearest real vocal onset within 0.12 s.
2. A word whose tap comes late (it lands in silence, or while the voice is still holding the note before it)
   is moved back to where it actually starts: the forced-aligned start when that line's alignment agrees with
   the taps, otherwise the first strong vocal onset after the previous syllable.
3. How long each word's last syllable is held is read off the stem (voice within 14 dB of its opening peak,
   until it drops for 0.12 s or the next word starts). Inner syllables run to the next syllable."""
import json, sys, numpy as np
ROOT = sys.argv[1] if len(sys.argv) > 1 else "."
tl = json.load(open(f"{ROOT}/data/timing.json")); L = tl["lines"]
voc = json.load(open(f"{ROOT}/data/vocal.json")); H = voc["hop"]
DB = np.convolve(np.array(voc["db"]), np.ones(5) / 5, "same")
ONS = np.array([o["t"] for o in voc["onsets"] if o["db"] > -30])
AL = {int(k): v for k, v in json.load(open(f"{ROOT}/data/align_0_93.json")).items()}
T = [(tuple(map(int, k.split("."))), float(s)) for k, s, e in (l.split() for l in open(f"{ROOT}/data/taps.txt").read().splitlines()[1:])]
db = lambda t: DB[min(len(DB) - 1, max(0, int(t / H)))]

def hold_end(s, nxt):
    i0, i1 = int(s / H), int((nxt - 0.02) / H)
    if i1 - i0 < 5: return nxt
    pk = DB[i0: i0 + int(0.25 / H)].max()
    if pk < -30: return min(nxt, s + 0.15)
    thr, need = pk - 14, int(0.12 / H)
    for k in range(i0 + int(0.1 / H), i1 - need):
        if (DB[k: k + need] < thr).all(): return k * H
    return nxt - 0.02

def snap(t, lo):
    c = ONS[(np.abs(ONS - t) < 0.12) & (ONS > lo)]
    return float(c[np.argmin(np.abs(c - t))]) if len(c) else t

# trusted alignments: the line's words (all but the last) agree with the taps
first = {}
for (li, wi, si), s in T: first.setdefault((li, wi), s)
trust = {}
for li, ws in AL.items():
    if ws[0][0] == "ERR" or len(ws) != len(L[li]["words"]): continue
    dev = [abs(ws[wi][1] - first[(li, wi)]) for wi in range(len(ws) - 1)] or [0]
    if np.median(dev) < 0.3: trust[li] = ws

starts = [s for _, s in T]
moved = []
for i, ((li, wi, si), s) in enumerate(T):
    lo = starts[i - 1] + 0.08 if i else 0
    st = snap(s, lo)
    if i and si == 0 and s - T[i - 1][1] > 0.8:
        late = db(s) < -25 or hold_end(starts[i - 1], s) > s - 0.6
        if late:
            p0 = starts[i - 1] + 0.12  # a word can't start until the one before it has sounded
            if li in trust and trust[li][wi][1] < s and s - trust[li][wi][1] < 1.6: st = max(trust[li][wi][1], p0); how = "aligned"
            else:
                c = [o for o in ONS if max(p0, s - 1.6) < o < s - 0.2 and db(o + 0.05) > -15]
                st, how = (float(c[0]), "onset") if c else (st, "kept")
            if how != "kept": moved.append(f"{L[li]['words'][wi]['w']} {s:.2f}->{st:.2f} ({how})")
    starts[i] = round(st, 3)
gi = {}; n = 0
for li, l in enumerate(L):
    for wi, w in enumerate(l["words"]): gi[(li, wi)] = n; n += 1
syl = {}
for ((li, wi, si), _), s in zip(T, starts): syl.setdefault(gi[(li, wi)], []).append(s)
syl[15] = [12.25, 12.45, 12.8]  # DISAPPEAR, approved as is
out = {"_": "scripts/apply_taps.py: taps + stem onsets + forced alignment; _syl = syllable starts + end of the held note"}
S, holds = {}, []
order = sorted(syl)
for k, g in enumerate(order):
    nxt = syl[order[k + 1]][0] if k + 1 < len(order) else syl[g][-1] + 1.5
    e = round(hold_end(syl[g][-1], nxt), 3) if g != 15 else 13.45
    out[str(g)] = syl[g][0]; S[str(g)] = syl[g] + [e]; holds.append((e - syl[g][-1], g))
out["_lock"] = list(range(len(L))); out["_syl"] = S
json.dump(out, open(f"{ROOT}/data/anchors.json", "w"), indent=0)
words = [w["w"] for l in L for w in l["words"]]
print(f"trusted alignment on {len(trust)} lines; moved {len(moved)} late taps:"); print("  " + "\n  ".join(moved))
print("held >= 0.6 s:", ", ".join(f"{words[g]}~{d:.1f}" for d, g in sorted(holds, key=lambda x: x[1]) if d >= 0.6))
