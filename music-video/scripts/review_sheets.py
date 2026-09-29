"""Sample a render every N seconds into labelled contact sheets for review."""
import subprocess, sys, os
from PIL import Image, ImageDraw
src, out, step = sys.argv[1], sys.argv[2], float(sys.argv[3]) if len(sys.argv) > 3 else 2.0
os.makedirs(out, exist_ok=True)
dur = float(subprocess.run(["ffprobe" if False else "ffmpeg", "-i", src], capture_output=True, text=True).stderr.split("Duration: ")[1].split(",")[0].split(":")[-1]) + 60 * int(subprocess.run(["ffmpeg", "-i", src], capture_output=True, text=True).stderr.split("Duration: ")[1].split(":")[1])
w, h, cols, rows = 384, 216, 5, 6
ts = [i * step for i in range(int(dur / step))]
for s in range(0, len(ts), cols * rows):
    sheet = Image.new("RGB", (w * cols, (h + 16) * rows)); d = ImageDraw.Draw(sheet)
    for k, t in enumerate(ts[s:s + cols * rows]):
        raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-ss", str(t), "-i", src, "-frames:v", "1", "-vf", f"scale={w}:{h}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True).stdout
        if len(raw) < w * h * 3: continue
        im = Image.frombytes("RGB", (w, h), raw[: w * h * 3])
        x, y = (k % cols) * w, (k // cols) * (h + 16)
        sheet.paste(im, (x, y + 16)); d.text((x + 3, y + 2), f"{t:.0f}s", fill=(255, 255, 255))
    sheet.save(f"{out}/review_{s // (cols * rows):02d}.jpg", quality=82)
print("ok", len(ts))
