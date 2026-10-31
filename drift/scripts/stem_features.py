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
f0, vflag, vprob = librosa.pyin(y, fmin=70, fmax=800, sr=SR, frame_length=2048, hop_length=HOP)
on = librosa.onset.onset_detect(onset_envelope=env, sr=SR, hop_length=HOP, units="frames", delta=0.05, wait=6)
# a real new syllable shows a consonant burst (2.5-8 kHz), a dip in loudness just before it, or a
# pitch jump; vibrato on a held note shows none of these, so its wobble isn't read as new words
hiS = S[(fr > 2500) & (fr < 8000)]
eh = librosa.onset.onset_strength(S=librosa.amplitude_to_db(hiS), sr=SR, hop_length=HOP)
hon = set(librosa.onset.onset_detect(onset_envelope=eh, sr=SR, hop_length=HOP, units="frames", delta=0.07, wait=8).tolist())
dbs = np.convolve(db, np.ones(3) / 3, "same")
def real(i):
    w = int(0.09 * SR / HOP)
    dip = dbs[i: i + w].max() - dbs[max(0, i - w): i + 1].min()
    burst = any(abs(i - j) <= 4 for j in hon)
    a0, b0 = f0[max(0, i - 6): i - 1], f0[i + 2: i + 8]
    a0, b0 = a0[a0 == a0], b0[b0 == b0]
    jump = len(a0) and len(b0) and abs(12 * np.log2(np.median(b0) / np.median(a0))) > 1.6
    unvoiced_before = not np.any(vflag[max(0, i - 5): i])
    return dip >= 5 or burst or jump or unvoiced_before
onsets = [{"t": round(float(i * HOP / SR), 3), "v": round(float(env[i] / env.max()), 3), "db": round(float(db[min(len(db) - 1, i + 3)]), 1)} for i in on if real(i)]
json.dump({"hop": round(HOP / SR, 5), "db": [round(float(x), 1) for x in db], "f0": [round(float(x), 1) if x == x else 0 for x in f0],
           "vprob": [round(float(x), 2) for x in vprob], "onsets": onsets}, open(out, "w"))
print("frames", len(db), "onsets", len(onsets))
