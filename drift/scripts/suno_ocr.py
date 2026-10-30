"""Highlighted-chunk timeline from the Suno lyric export. Suno bolds the chunk being sung;
OCR each frame of the lyric band, tag each text row bold/regular by ink density, and log
when the bold text changes -> data/suno_chunks.json"""
import subprocess, sys, json, numpy as np
from rapidocr_onnxruntime import RapidOCR
src, out = sys.argv[1], sys.argv[2]
FPS, W, Y0, H = 5, 824, 780, 280
cmd = ['ffmpeg', '-loglevel', 'error', '-i', src, '-vf', f'fps={FPS},crop={W}:{H}:0:{Y0},format=gray', '-f', 'rawvideo', '-']
fr = np.frombuffer(subprocess.run(cmd, capture_output=True).stdout, np.uint8).reshape(-1, H, W)
ocr = RapidOCR()
rows = []
for i, g in enumerate(fr):
    rgb = np.repeat(g[:, :, None], 3, 2)
    res, _ = ocr(rgb)
    items = []
    for box, txt, conf in (res or []):
        xs = [p[0] for p in box]; ys = [p[1] for p in box]
        x0, x1, y0, y1 = int(min(xs)), int(max(xs)), int(min(ys)), int(max(ys))
        crop = g[max(0, y0):y1, max(0, x0):x1].astype(np.float32)
        ink = float((crop > 200).mean()) if crop.size else 0
        bright = float(np.percentile(crop, 98)) if crop.size else 0
        items.append({"t": txt, "y": (y0 + y1) / 2, "ink": round(ink, 3), "b": round(bright)})
    rows.append({"time": round(i / FPS, 2), "items": sorted(items, key=lambda d: d["y"])})
    if i % 100 == 0: print(i, len(fr), [(d["t"], d["ink"], d["b"]) for d in items], flush=True)
json.dump({"fps": FPS, "frames": rows}, open(out, "w"))
