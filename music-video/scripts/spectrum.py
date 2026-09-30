"""Per-frame log-frequency spectrum of the master for the intro equalizer.

Writes data/spectrum.json: {fps, start, bands, frames: [[0..99 per band], ...]}
covering START..END seconds. Run with any Python that has numpy + scipy:
    python3 scripts/spectrum.py path/to/song.wav
"""
import json, sys
import numpy as np
import scipy.io.wavfile as wav

START, END, FPS, BANDS = 21.5, 38.7, 30, 24
sr, x = wav.read(sys.argv[1] if len(sys.argv) > 1 else "song.wav")
x = x.astype(np.float64)
if x.ndim > 1:
    x = x.mean(axis=1)
x /= np.abs(x).max() + 1e-9
N = 4096
win = np.hanning(N)
freqs = np.fft.rfftfreq(N, 1 / sr)
edges = np.geomspace(40, 14000, BANDS + 1)
rows = []
for k in range(int((END - START) * FPS)):
    c = int((START + k / FPS) * sr)
    seg = x[max(0, c - N // 2): c + N // 2]
    if len(seg) < N:
        seg = np.pad(seg, (0, N - len(seg)))
    mag = np.abs(np.fft.rfft(seg * win))
    row = []
    for b in range(BANDS):
        m = (freqs >= edges[b]) & (freqs < edges[b + 1])
        row.append(20 * np.log10(mag[m].mean() + 1e-9))
    rows.append(row)
a = np.array(rows)
# per-band normalisation (tilt-compensated), then gentle smoothing over time
lo = np.percentile(a, 8, axis=0)
hi = np.percentile(a, 99, axis=0)
a = np.clip((a - lo) / (hi - lo + 1e-9), 0, 1) ** 1.4
sm = a.copy()
for i in range(1, len(a)):
    sm[i] = np.maximum(a[i], sm[i - 1] * 0.82)  # fast attack, soft release
json.dump({"fps": FPS, "start": START, "bands": BANDS, "frames": (sm * 99).round().astype(int).tolist()},
          open("data/spectrum.json", "w"), separators=(",", ":"))
print("frames", len(sm), "mean", sm.mean().round(3))
