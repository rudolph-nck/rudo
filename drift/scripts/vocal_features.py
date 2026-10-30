"""Vocal emphasis stem without a neural separator (model hosts are blocked here):
centre channel -> REPET-SIM soft mask (Rafii & Pardo) -> vocal band. Then the voice's
loudness (dB, 100 Hz) and pitch / voicing (pYIN) -> data/vocal.json, stem -> argv[3]."""
import sys, json, numpy as np, librosa, soundfile as sf
src, out, stem = sys.argv[1:4]
SR, HOP = 22050, 512
y, _ = librosa.load(src, sr=SR, mono=False)
mid, side = (y[0] + y[1]) / 2, (y[0] - y[1]) / 2
S, ph = librosa.magphase(librosa.stft(mid, n_fft=2048, hop_length=HOP))
Ss = np.abs(librosa.stft(side, n_fft=2048, hop_length=HOP))
filt = librosa.decompose.nn_filter(S, aggregate=np.median, metric="cosine", width=int(librosa.time_to_frames(2, sr=SR, hop_length=HOP)))
filt = np.minimum(S, filt)
mask_v = librosa.util.softmask(S - filt, 8 * filt, power=2)
# centre-panned: penalise bins that are strong in the side channel
mask_c = librosa.util.softmask(S, 1.5 * Ss, power=2)
fr = librosa.fft_frequencies(sr=SR, n_fft=2048)
band = ((fr > 120) & (fr < 6000)).astype(float)[:, None]
V = S * mask_v * mask_c * band
v = librosa.istft(V * ph, hop_length=HOP, length=len(mid))
sf.write(stem, v, SR)
# loudness at 100 Hz
H2 = 220
rms = librosa.feature.rms(y=v, frame_length=2048, hop_length=H2)[0]
db = librosa.amplitude_to_db(rms, ref=np.max)
f0, vflag, vprob = librosa.pyin(v, fmin=70, fmax=700, sr=SR, frame_length=2048, hop_length=H2)
t = librosa.frames_to_time(np.arange(len(rms)), sr=SR, hop_length=H2)
json.dump({"hop": round(H2 / SR, 5), "db": [round(float(x), 1) for x in db],
           "f0": [round(float(x), 1) if x == x else 0 for x in f0],
           "vprob": [round(float(x), 2) for x in vprob]}, open(out, "w"))
print("frames", len(db), "dur", t[-1])
