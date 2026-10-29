"""Remove the cover's typography (RUDO, STATIC & SILENCE, VOL. 1, advisory label) so the
photo can serve as the concrete-room plate. Text pixels are thresholded inside known boxes."""
import sys, cv2, numpy as np
src, out = sys.argv[1], sys.argv[2]
im = cv2.imread(src)
g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY).astype(np.float32)
mask = np.zeros(g.shape, np.uint8)
def text_in(x0, y0, x1, y1, k=7, dil=6):
    roi = g[y0:y1, x0:x1]
    bg = cv2.medianBlur(roi.astype(np.uint8), 51).astype(np.float32)
    m = ((roi - bg) > k).astype(np.uint8) * 255
    m = cv2.dilate(m, np.ones((dil, dil), np.uint8))
    mask[y0:y1, x0:x1] = np.maximum(mask[y0:y1, x0:x1], m)
text_in(300, 100, 960, 275, k=4, dil=11)   # RUDO
text_in(300, 280, 960, 335, k=4, dil=7)   # STATIC & SILENCE
text_in(560, 1075, 700, 1110, k=6, dil=7) # VOL. 1
mask[1122:1222, 556:700] = 255            # advisory label (solid box)
mask[165:220, 325:370] = 255           # stubborn speck left of the R
cv2.imwrite(out.replace(".png", "-mask.png"), mask)
res = cv2.inpaint(im, mask, 9, cv2.INPAINT_TELEA)
# Re-grain the inpainted areas so they don't read as smooth smears.
rng = np.random.default_rng(7)
n = rng.normal(0, 5, im.shape).astype(np.float32)
soft = cv2.GaussianBlur(mask, (0, 0), 3)[..., None] / 255.0
res = np.clip(res.astype(np.float32) + n * soft, 0, 255).astype(np.uint8)
cv2.imwrite(out, res)
print("ok")
