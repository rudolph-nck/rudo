"""Spectrogram strips of the mix (vocal band) with the current word timing overlaid, for
checking/correcting onsets by eye:  python3 scripts/spec_check.py <wav> <out_dir> [from to]"""
import json, sys, os, numpy as np, librosa
from PIL import Image, ImageDraw
wav, out = sys.argv[1], sys.argv[2]
a0, a1 = (float(sys.argv[3]), float(sys.argv[4])) if len(sys.argv) > 4 else (0, 264)
os.makedirs(out, exist_ok=True)
T = json.load(open("data/timing.json"))
words = [(w, i) for l in T["lines"] for w in l["words"] for i in [0]]
gi = 0; W = []
for l in T["lines"]:
    for w in l["words"]: W.append((gi, w)); gi += 1
PX, SEG = 120, 16
y, sr = librosa.load(wav, sr=16000)
for a in np.arange(a0, a1, SEG):
    b = min(a + SEG, a1)
    seg = y[int(a * sr): int(b * sr)]
    M = librosa.amplitude_to_db(np.abs(librosa.stft(seg, n_fft=1024, hop_length=80))[8:150], ref=np.max)
    img = np.clip((M + 55) / 55 * 255, 0, 255).astype(np.uint8)[::-1]
    im = Image.fromarray(img).convert("RGB").resize((int((b - a) * PX), 260))
    canvas = Image.new("RGB", (im.width, 360)); canvas.paste(im, (0, 100)); dr = ImageDraw.Draw(canvas)
    for s in np.arange(np.ceil(a * 2) / 2, b, 0.5):
        x = (s - a) * PX; dr.line([(x, 92), (x, 100 if s % 1 else 110)], fill=(0, 255, 0))
        if s % 1 == 0: dr.text((x + 2, 80), f"{s:g}", fill=(0, 255, 0))
    k = 0
    for g, w in W:
        if a <= w["s"] < b:
            x = (w["s"] - a) * PX; xe = (min(w["e"], b) - a) * PX
            c = (255, 80, 80) if w["src"] != "interp" else (255, 220, 0)
            row = 4 + (k % 4) * 18; k += 1
            dr.line([(x, row + 14), (x, 360)], fill=c); dr.line([(x, row + 14), (xe, row + 14)], fill=c)
            dr.text((x + 2, row), f"{g}:{w['w']}", fill=c)
    canvas.save(f"{out}/s{a:06.1f}.png")
print("ok")
