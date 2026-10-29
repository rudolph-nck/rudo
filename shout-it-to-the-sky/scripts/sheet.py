"""Contact sheet of stills:  python3 scripts/sheet.py <dir> <out.png> [cols]"""
import sys, glob, os
from PIL import Image, ImageDraw
d, out = sys.argv[1], sys.argv[2]
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 5
fs = sorted(glob.glob(os.path.join(d, "*.jpg")))
ims = [Image.open(f) for f in fs]
w, h = ims[0].size
rows = (len(ims) + cols - 1) // cols
sheet = Image.new("RGB", (cols * (w + 6), rows * (h + 26)), (30, 30, 30))
dr = ImageDraw.Draw(sheet)
for i, (f, im) in enumerate(zip(fs, ims)):
    x, y = (i % cols) * (w + 6), (i // cols) * (h + 26)
    sheet.paste(im, (x, y + 22))
    dr.text((x + 4, y + 4), os.path.basename(f)[1:-4] + "s", fill=(255, 220, 0))
sheet.save(out)
