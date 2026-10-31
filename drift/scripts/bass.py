"""Bass envelope from the mix: low band (<140 Hz) energy and its hits, 100 Hz -> data/bass.json (0..1)."""
import sys, json, numpy as np, librosa
y, sr = librosa.load(sys.argv[1], sr=22050, mono=True)
H = 220
S = np.abs(librosa.stft(y, n_fft=2048, hop_length=H)); fr = librosa.fft_frequencies(sr=sr, n_fft=2048)
low = np.sqrt((S[fr < 140] ** 2).mean(0))
lev = low / (np.percentile(low, 99) + 1e-9)
hit = np.maximum(0, np.diff(low, prepend=low[0])); hit = hit / (np.percentile(hit, 99.5) + 1e-9)
json.dump({"hop": H / sr, "level": [round(float(min(1.2, x)), 3) for x in lev], "hit": [round(float(min(1.2, x)), 3) for x in hit]}, open(sys.argv[2], "w"))
print(len(lev))
