"""Sample a render every N seconds into labelled contact sheets for review.
usage: python3 scripts/review_sheets.py render.mp4 out_dir [step_seconds] [start] [end]"""
import subprocess, sys, os, re
from PIL import Image, ImageDraw
src, out = sys.argv[1], sys.argv[2]
step = float(sys.argv[3]) if len(sys.argv) > 3 else 2.0
info = subprocess.run(["ffmpeg", "-i", src], capture_output=True, text=True).stderr
h_, m_, s_ = re.search(r"Duration: (\d+):(\d+):([\d.]+)", info).groups()
dur = int(h_) * 3600 + int(m_) * 60 + float(s_)
a = float(sys.argv[4]) if len(sys.argv) > 4 else 0.0
b = float(sys.argv[5]) if len(sys.argv) > 5 else dur
os.makedirs(out, exist_ok=True)
w, h, cols, rows = 480, 270, 4, 5
ts = [a + i * step for i in range(int((b - a) / step))]
for s in range(0, len(ts), cols * rows):
    sheet = Image.new("RGB", (w * cols, (h + 16) * rows), (40, 0, 0)); d = ImageDraw.Draw(sheet)
    for k, t in enumerate(ts[s:s + cols * rows]):
        raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-ss", f"{t:.2f}", "-i", src, "-frames:v", "1", "-vf", f"scale={w}:{h}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True).stdout
        if len(raw) < w * h * 3: continue
        im = Image.frombytes("RGB", (w, h), raw[: w * h * 3])
        x, y = (k % cols) * w, (k // cols) * (h + 16)
        sheet.paste(im, (x, y + 16)); d.text((x + 3, y + 2), f"{t:.1f}s", fill=(255, 255, 255))
    sheet.save(f"{out}/review_{s // (cols * rows):02d}.jpg", quality=80)
print("sheets:", (len(ts) + cols * rows - 1) // (cols * rows))
