"""Token-timestamped ASR on the vocal stem with NeMo Parakeet-TDT (sherpa-onnx).
Overlapping windows; each word is kept only from the window whose centre it falls in."""
import sys, json, numpy as np, librosa, sherpa_onnx
model_dir, audio, out = sys.argv[1], sys.argv[2], sys.argv[3]
WIN, HOP = float(sys.argv[4]) if len(sys.argv) > 4 else 12.0, float(sys.argv[5]) if len(sys.argv) > 5 else 8.0
M = model_dir.rstrip("/") + "/"
rec = sherpa_onnx.OfflineRecognizer.from_transducer(
    encoder=M + "encoder.int8.onnx", decoder=M + "decoder.int8.onnx", joiner=M + "joiner.int8.onnx",
    tokens=M + "tokens.txt", model_type="nemo_transducer", num_threads=4)
y, sr = librosa.load(audio, sr=16000, mono=True)
words, t0 = [], 0.0
while t0 < len(y) / sr:
    seg = y[int(t0 * sr): int((t0 + WIN) * sr)]
    s = rec.create_stream(); s.accept_waveform(sr, seg); rec.decode_stream(s)
    r = s.result
    lo = t0 + (0 if t0 == 0 else (WIN - HOP) / 2); hi = t0 + WIN - (WIN - HOP) / 2
    cur = None
    for tok, ts in zip(r.tokens, r.timestamps):
        T = t0 + ts
        if tok.startswith(" ") or tok.startswith("▁") or cur is None:
            if cur and lo <= cur["s"] < hi: words.append(cur)
            cur = {"w": tok.strip("▁ "), "s": round(T, 3)}
        else:
            cur["w"] += tok
    if cur and lo <= cur["s"] < hi: words.append(cur)
    print(f"{t0:6.1f} {r.text[:150]}", flush=True)
    t0 += HOP
json.dump(words, open(out, "w"), indent=0)
print(len(words), "words")
