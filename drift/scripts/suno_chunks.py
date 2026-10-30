"""suno_ocr_raw.json -> data/suno_chunks.json: each Suno caption chunk with the time it first
turns bold (= Suno's own onset for that chunk), mapped onto the official lyric words."""
import json, re, sys
from difflib import SequenceMatcher
ROOT = sys.argv[1] if len(sys.argv) > 1 else "."
d = json.load(open(f"{ROOT}/data/suno_ocr_raw.json"))
n = lambda s: re.sub(r"[^a-z]", "", re.sub(r"\[.*?\]", "", s.lower()))
chunks, prev_bold = [], [[], [], []]
for f in d["frames"]:
    bold = [n(it["t"]) for it in f["items"] if it["ink"] >= 0.205]
    bold = [k for k in bold if len(k) >= 2 and not (k == "drift" and f["time"] < 4)]
    recent = [k for fr_ in prev_bold for k in fr_]
    for k, it in zip(bold, [it for it in f["items"] if it["ink"] >= 0.205 and len(n(it["t"])) >= 2 and not (n(it["t"]) == "drift" and f["time"] < 4)]):
        # new chunk = not bold (allowing OCR spacing jitter) in the previous 0.6 s
        if not any(SequenceMatcher(None, k, s).ratio() > 0.85 for s in recent):
            chunks.append({"t": f["time"], "text": it["t"], "key": k})
    prev_bold = prev_bold[1:] + [bold]
# official lyric words as one letter stream; place each chunk's letters along it
words = []
for raw in open(f"{ROOT}/data/lyrics.txt"):
    raw = raw.strip()
    if raw and not raw.startswith("["): words += raw.split()
stream, owner = "", []
for i, w in enumerate(words):
    for ch in n(w): stream += ch; owner.append(i)
chunks = [c for c in chunks if c["t"] > 4.1]
cat, cown = "", []
for ci, c in enumerate(chunks):
    for ch in c["key"]: cat += ch; cown.append(ci)
first = {}
for blk in SequenceMatcher(None, cat, stream, autojunk=False).get_matching_blocks():
    for q in range(blk.size):
        ci = cown[blk.a + q]
        if ci not in first: first[ci] = (owner[blk.b + q], blk.a + q == sum(len(x["key"]) for x in chunks[:ci]))
keep = []
for ci, c in enumerate(chunks):
    if ci not in first: continue
    w0, clean = first[ci]
    if keep and w0 <= keep[-1]["w0"]: continue  # fragment of a chunk already placed
    c["w0"], c["exact"] = w0, clean; keep.append(c)
chunks = keep
json.dump(chunks, open(f"{ROOT}/data/suno_chunks.json", "w"), indent=0)
for c in chunks: print(f"{c['t']:6.1f} w{c['w0']:3d} {int(c['exact'])} {words[c['w0']]:>14s} | {c['text']}")
