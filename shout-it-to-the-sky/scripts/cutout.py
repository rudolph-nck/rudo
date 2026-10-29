"""Cut RUDO out of the cover (GrabCut seeded with a rough rectangle + known-floor/known-wall
strokes) -> RGBA sprite used as the rooftop silhouette."""
import sys, cv2, numpy as np
src, out = sys.argv[1], sys.argv[2]
im = cv2.imread(src)
h, w = im.shape[:2]
mask = np.full((h, w), cv2.GC_BGD, np.uint8)
mask[400:1060, 340:880] = cv2.GC_PR_BGD
# probable foreground: torso, arms, legs, shoes
cv2.ellipse(mask, (640, 520), (60, 75), 0, 0, 360, cv2.GC_FGD, -1)          # head
cv2.rectangle(mask, (510, 600), (800, 760), cv2.GC_FGD, -1)                  # torso/arms
cv2.rectangle(mask, (440, 760), (830, 900), cv2.GC_PR_FGD, -1)               # knees / forearms
cv2.rectangle(mask, (420, 900), (760, 1030), cv2.GC_PR_FGD, -1)              # shins + shoes
cv2.ellipse(mask, (430, 985), (60, 25), 0, 0, 360, cv2.GC_FGD, -1)           # left shoe
cv2.ellipse(mask, (700, 990), (50, 25), 0, 0, 360, cv2.GC_FGD, -1)           # right shoe
cv2.rectangle(mask, (505, 975), (650, 1060), cv2.GC_BGD, -1)              # floor between the shoes
cv2.rectangle(mask, (340, 400), (520, 640), cv2.GC_PR_BGD, -1)               # lit wall left of the head
cv2.ellipse(mask, (640, 520), (60, 75), 0, 0, 360, cv2.GC_FGD, -1)
bgd, fgd = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
cv2.grabCut(im, mask, None, bgd, fgd, 8, cv2.GC_INIT_WITH_MASK)
m = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
# keep the largest component, close small holes, soften edge
n, lab, st, _ = cv2.connectedComponentsWithStats(m)
m = np.where(lab == 1 + np.argmax(st[1:, cv2.CC_STAT_AREA]), 255, 0).astype(np.uint8)
m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((15, 15), np.uint8))
m = cv2.GaussianBlur(m, (0, 0), 1.2)
x, y, bw, bh = cv2.boundingRect((m > 20).astype(np.uint8))
rgba = np.dstack([im, m])[y - 8:y + bh + 8, x - 8:x + bw + 8]
cv2.imwrite(out, rgba)
cv2.imwrite(out.replace(".png", "-check.png"), np.where(m[..., None] > 128, im, (im * 0.25).astype(np.uint8)))
print("ok", x, y, bw, bh)
