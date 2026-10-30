"""Lead vocal stem (Suno 'Get Stems') -> data/vocal.json: loudness (dB, 100 Hz), pitch/voicing (pYIN)
and vocal onsets with strengths. Replaces the mix-based estimate from vocal_features.py."""
import sys, json, numpy as np, librosa
src, out = sys.argv[1], sys.argv[2]
SR, HOP = 22050, 220
y, _ = librosa.load(src, sr=SR, mono=True)
S = np.abs(librosa.stft(y, n_fft=2048, hop_length=HOP))
fr = librosa.fft_frequencies(sr=SR, n_fft=2048)
band = S[(fr > 120) & (fr < 5000)]
rms = np.sqrt((band ** 2).mean(0))
db = librosa.amplitude_to_db(rms, ref=np.max)
env = librosa.onset.onset_strength(S=librosa.amplitude_to_db(band), sr=SR, hop_length=HOP)
on = librosa.onset.onset_detect(onset_envelope=env, sr=SR, hop_length=HOP, units="frames", delta=0.05, wait=6)
f0, vflag, vprob = librosa.pyin(y, fmin=70, fmax=800, sr=SR, frame_length=2048, hop_length=HOP)
onsets = [{"t": round(float(i * HOP / SR), 3), "v": round(float(env[i] / env.max()), 3), "db": round(float(db[min(len(db) - 1, i + 3)]), 1)} for i in on]
json.dump({"hop": round(HOP / SR, 5), "db": [round(float(x), 1) for x in db], "f0": [round(float(x), 1) if x == x else 0 for x in f0],
           "vprob": [round(float(x), 2) for x in vprob], "onsets": onsets}, open(out, "w"))
print("frames", len(db), "onsets", len(onsets))
