"""woff2 -> three.js typeface JSON (for extruded 3D lyric words).
python3 scripts/make_typeface.py <font.woff2> <out.json> <family>"""
import sys, json
from fontTools.ttLib import TTFont
from fontTools.pens.basePen import BasePen

src, out, family = sys.argv[1:4]
f = TTFont(src)
gs = f.getGlyphSet()
cmap = f.getBestCmap()
upm = f["head"].unitsPerEm
scale = 1000 / upm
r = lambda v: round(v * scale, 1)

class P(BasePen):
    def __init__(self, gs):
        super().__init__(gs); self.o = []
    def _moveTo(self, p): self.o += ["m", r(p[0]), r(p[1])]
    def _lineTo(self, p): self.o += ["l", r(p[0]), r(p[1])]
    def _qCurveToOne(self, c, p): self.o += ["q", r(p[0]), r(p[1]), r(c[0]), r(c[1])]
    def _curveToOne(self, c1, c2, p): self.o += ["b", r(p[0]), r(p[1]), r(c1[0]), r(c1[1]), r(c2[0]), r(c2[1])]
    def _closePath(self): pass

glyphs = {}
chars = "".join(chr(c) for c in range(32, 127)) + "’‘“”—–"
for ch in chars:
    gn = cmap.get(ord(ch))
    if not gn: continue
    g = gs[gn]
    pen = P(gs); g.draw(pen)
    glyphs[ch] = {"ha": r(g.width), "x_min": 0, "x_max": r(g.width), "o": " ".join(str(v) for v in pen.o)}
hh = f["hhea"]
json.dump({
    "glyphs": glyphs, "familyName": family, "ascender": r(hh.ascent), "descender": r(hh.descent),
    "underlinePosition": -100, "underlineThickness": 50,
    "boundingBox": {"xMin": 0, "yMin": r(hh.descent), "xMax": 1000, "yMax": r(hh.ascent)},
    "resolution": 1000, "original_font_information": {"fullName": family},
}, open(out, "w"))
print(len(glyphs), "glyphs", out)
