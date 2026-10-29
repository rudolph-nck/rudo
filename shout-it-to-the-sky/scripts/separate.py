"""Vocal stem with UVR MDX-Net Voc_FT (onnx), numpy STFT. Improves ASR on a dense mix."""
import sys, numpy as np, onnxruntime as ort, soundfile as sf, librosa
model, src, out = sys.argv[1:4]
N_FFT, HOP, DIM_F, DIM_T, COMP = 6144, 1024, 3072, 256, 1.021
sess = ort.InferenceSession(model, providers=["CPUExecutionProvider"])
inp = sess.get_inputs()[0].name
y, sr = librosa.load(src, sr=44100, mono=False)
if y.ndim == 1: y = np.stack([y, y])
chunk = HOP * (DIM_T - 1); trim = N_FFT // 2; gen = chunk - 2 * trim
pad = gen - y.shape[1] % gen
mix = np.concatenate([np.zeros((2, trim)), y, np.zeros((2, pad)), np.zeros((2, trim))], 1)
win = np.hanning(N_FFT + 1)[:-1].astype(np.float32)
def stft(x):  # x: (2, chunk) -> (4, DIM_F, DIM_T)
    S = np.stack([librosa.stft(c, n_fft=N_FFT, hop_length=HOP, window=win, center=True) for c in x])
    S = S[:, :DIM_F, :DIM_T]
    return np.concatenate([np.stack([S[c].real, S[c].imag]) for c in range(2)]).astype(np.float32)
def istft(X):
    out = []
    for c in range(2):
        Z = X[2 * c] + 1j * X[2 * c + 1]
        Z = np.concatenate([Z, np.zeros((N_FFT // 2 + 1 - DIM_F, Z.shape[1]))])
        out.append(librosa.istft(Z, hop_length=HOP, window=win, center=True, length=chunk))
    return np.stack(out)
res = []
n = (mix.shape[1] - 2 * trim) // gen
for i in range(n):
    seg = mix[:, i * gen: i * gen + chunk]
    X = stft(seg)[None]
    Y = sess.run(None, {inp: X})[0][0]
    res.append(istft(Y)[:, trim:-trim])
    print(f"{i + 1}/{n}", flush=True)
voc = np.concatenate(res, 1)[:, :y.shape[1]] * COMP
sf.write(out, voc.T, sr)
print("ok", voc.shape)
