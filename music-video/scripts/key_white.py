# Keys the white studio background off a character-sheet crop (flood fill from the border,
# so white parts inside the subject, like the visor A, survive). Usage: python key_white.py in.png out.png
import sys, numpy as np
from PIL import Image, ImageDraw, ImageFilter
src, dst = sys.argv[1], sys.argv[2]
im = np.asarray(Image.open(src).convert("RGB")).astype(np.float32)
mn = im.min(axis=2)
H, W = mn.shape
# background = white region connected to the image border (so the white A on the visor survives)
bin_ = Image.fromarray(np.where(mn > 215, 255, 0).astype(np.uint8)).copy()
for x in range(0, W, 4):
    for y in (0, H - 1):
        if bin_.getpixel((x, y)) == 255:
            ImageDraw.floodfill(bin_, (x, y), 128)
for y in range(0, H, 4):
    for x in (0, W - 1):
        if bin_.getpixel((x, y)) == 255:
            ImageDraw.floodfill(bin_, (x, y), 128)
bg = np.asarray(bin_) == 128
bgd = np.asarray(Image.fromarray((bg * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))) > 0  # bg + 2px rim
a = np.where(bgd, np.clip((250.0 - mn) / 38.0, 0, 1), 1.0)
a[bg & (mn > 240)] = 0
A = Image.fromarray((a * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7))
a = np.asarray(A).astype(np.float32) / 255
c = np.clip((im - (1 - a[..., None]) * 255) / np.maximum(a[..., None], 1e-3), 0, 255)
Image.fromarray(np.dstack([c, a * 255]).astype(np.uint8), "RGBA").save(dst, optimize=True)
print(dst, W, H)
