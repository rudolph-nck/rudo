# Real-ESRGAN x4 (NCNN build, CPU) upscaler used for the DJ images.
# Needs: pip install ncnn numpy pillow; models from the realesrgan-ncnn-vulkan release zip (models/realesrgan-x4plus.*).
# Usage: python upscale_esrgan.py in.png out.png
import sys, time, numpy as np, ncnn
from PIL import Image
net = ncnn.Net()
net.opt.use_vulkan_compute = False
net.opt.num_threads = 4
net.load_param("models/realesrgan-x4plus.param"); net.load_model("models/realesrgan-x4plus.bin")
src, dst = sys.argv[1], sys.argv[2]
im = np.asarray(Image.open(src).convert("RGB")).astype(np.float32) / 255.0
H, W, _ = im.shape
T, P = 128, 12
out = np.zeros((H * 4, W * 4, 3), np.float32)
t0 = time.time()
for y in range(0, H, T):
    for x in range(0, W, T):
        y0, x0 = max(0, y - P), max(0, x - P)
        y1, x1 = min(H, y + T + P), min(W, x + T + P)
        tile = np.ascontiguousarray(im[y0:y1, x0:x1].transpose(2, 0, 1))
        ex = net.create_extractor()
        ex.input("data", ncnn.Mat(tile))
        _, o = ex.extract("output")
        o = np.array(o).transpose(1, 2, 0)
        oy, ox = (y - y0) * 4, (x - x0) * 4
        h, w = (min(y + T, H) - y) * 4, (min(x + T, W) - x) * 4
        out[y * 4:y * 4 + h, x * 4:x * 4 + w] = o[oy:oy + h, ox:ox + w]
Image.fromarray((np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8)).save(dst)
print(dst, out.shape, round(time.time() - t0, 1), "s")
