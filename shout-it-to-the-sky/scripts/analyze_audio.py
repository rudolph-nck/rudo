"""Beats, downbeats, 808/kick hits, energy envelope -> data/beats.json"""
import sys, json, numpy as np, librosa, scipy.signal as sg
src, out = sys.argv[1], sys.argv[2]
y, sr = librosa.load(src, sr=22050, mono=True)
dur = len(y) / sr
HOP = 256
oenv = librosa.onset.onset_strength(y=y, sr=sr, hop_length=HOP)
tempo, beats = librosa.beat.beat_track(onset_envelope=oenv, sr=sr, hop_length=HOP, units="time", tightness=120)
tempo = float(np.atleast_1d(tempo)[0])
# Low band (808 / kick) envelope: < 120 Hz energy, spectral flux.
S = np.abs(librosa.stft(y, n_fft=2048, hop_length=HOP))
fr = librosa.fft_frequencies(sr=sr, n_fft=2048)
low = S[fr < 120].sum(0)
t = librosa.frames_to_time(np.arange(len(low)), sr=sr, hop_length=HOP)
lowdb = librosa.amplitude_to_db(low, ref=np.max)
flux = np.maximum(0, np.diff(low, prepend=low[0]))
flux /= flux.max() + 1e-9
peaks, props = sg.find_peaks(flux, height=0.12, distance=int(0.18 * sr / HOP))
kicks = [{"t": round(float(t[p]), 3), "v": round(float(flux[p]), 3)} for p in peaks]
# Downbeat phase: which of the 4 beat positions carries the most low-end onset.
bidx = librosa.time_to_frames(beats, sr=sr, hop_length=HOP)
strength = np.array([flux[max(0, b - 2): b + 3].max() for b in bidx])
phase = int(np.argmax([strength[k::4].mean() for k in range(4)]))
downbeats = [float(b) for b in beats[phase::4]]
# 1/sec energy
rms = librosa.feature.rms(y=y, hop_length=HOP)[0]
per = [float(rms[(t >= i) & (t < i + 1)].mean()) for i in range(int(np.ceil(dur)))]
lows = [float(low[(t >= i) & (t < i + 1)].mean()) for i in range(int(np.ceil(dur)))]
mx = max(lows)
json.dump({
    "duration": round(dur, 3), "bpm": round(tempo, 2),
    "beats": [round(float(b), 3) for b in beats], "downbeats": [round(b, 3) for b in downbeats],
    "kicks": kicks, "energy": [round(v / max(per), 3) for v in per], "low": [round(v / mx, 3) for v in lows],
}, open(out, "w"))
print("dur", dur, "bpm", tempo, "beats", len(beats), "downbeat phase", phase, "kicks", len(kicks))
print("ibi median", np.median(np.diff(beats)))
for i in range(0, len(per), 10):
    print(f"{i:4d}", " ".join(f"{v / max(per) * 9:1.0f}" for v in per[i:i + 10]), " | ", " ".join(f"{v / mx * 9:1.0f}" for v in lows[i:i + 10]))
