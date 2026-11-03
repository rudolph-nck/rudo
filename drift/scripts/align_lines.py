"""Forced alignment of each lyric line on the lead vocal stem (pocketsphinx, bundled en-us model).
RUDO's taps say roughly where each line is; the aligner finds where each word actually sounds.
usage: align_lines.py <voc16k.raw> <first_line> <last_line>  -> prints / writes data/align.json"""
import json, sys, re, os, numpy as np
from pocketsphinx import Decoder, get_model_path
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
raw = np.fromfile(sys.argv[1], dtype=np.int16); SR = 16000
a0, a1 = int(sys.argv[2]), int(sys.argv[3])
L = json.load(open(f"{ROOT}/data/timing.json"))["lines"]
T = {}
for k, s, e in (l.split() for l in open(f"{ROOT}/data/taps.txt").read().splitlines()[1:]):
    li, wi, si = map(int, k.split(".")); T.setdefault((li, wi), float(s))
mp = get_model_path()
dic = {}
for l in open(os.path.join(mp, "en-us", "cmudict-en-us.dict")):
    w = l.split()[0]; dic.setdefault(re.sub(r"\(\d+\)$", "", w), True)
FIX = {"wanna": "want to", "gonna": "going to", "voicemails": "voice mails"}
def norm(w):
    w = re.sub(r"[^a-z']", "", w.lower())
    return FIX.get(w, w)
res = {}
for li in range(a0, a1 + 1):
    ws = L[li]["words"]
    t0 = T[(li, 0)] - 0.9
    if li > 0: t0 = max(t0, T[(li - 1, len(L[li - 1]["words"]) - 1)] - 0.6)
    if res.get(li - 1) and res[li - 1][-1][0] != "ERR": t0 = max(t0, res[li - 1][-1][2] - 0.05)  # never before the last line ended
    t1 = T[(li + 1, 0)] + 0.25 if li + 1 < len(L) else T[(li, len(ws) - 1)] + 3
    toks = [norm(w["w"]) for w in ws]
    if any(p not in dic for t in toks for p in t.split()):
        res[li] = [("ERR", "oov " + " ".join(t for t in toks if any(p not in dic for p in t.split())))]; print(li, res[li]); continue
    def run(a, b):
        seg = raw[int(a * SR): int(b * SR)]
        d = Decoder(hmm=os.path.join(mp, "en-us", "en-us"), dict=os.path.join(mp, "en-us", "cmudict-en-us.dict"), loglevel="FATAL", fsgusefiller=True, bestpath=False)
        d.set_align_text(" ".join(toks))
        d.start_utt(); d.process_raw(seg.tobytes(), full_utt=True); d.end_utt()
        o = []
        for sg in (d.seg() or []):
            w = re.sub(r"\(\d+\)$", "", sg.word)
            if w in ("<sil>", "<s>", "</s>") or w.startswith("[") or w.startswith("+"): continue
            o.append((w, round(a + sg.start_frame * 0.01, 3), round(a + (sg.end_frame + 1) * 0.01, 3)))
        return o
    out = []
    for a, b in ((t0, t1), (t0 - 0.3, t1 + 0.8), (t0 - 0.6, t1 + 1.6)):
        try: out = run(max(0, a), b)
        except Exception: out = []
        # "want to" counts as one lyric word (wanna)
        merged, i = [], 0
        for t in toks:
            k = len(t.split())
            if i + k <= len(out): merged.append((t, out[i][1], out[i + k - 1][2]))
            i += k
        if len(merged) == len(ws): out = merged; break
        out = []
    if not out: out = [("ERR", "no alignment")]
    res[li] = out
    print(li, " ".join(f"{n}@{s:.2f}-{e:.2f}" for n, s, e in out) if out and out[0][0] != "ERR" else out,
          "| taps", " ".join(f"{T[(li, i)]:.2f}" for i in range(len(ws))))
json.dump(res, open(f"{ROOT}/data/align_{a0}_{a1}.json", "w"))
