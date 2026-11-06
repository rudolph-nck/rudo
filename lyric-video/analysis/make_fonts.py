# Generate static font instances for the renderer (canvas + opentype.js need static outlines).
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from pathlib import Path
src = Path('../app/public/fonts/src'); out = Path('../app/public/fonts')
jobs = []
# Drift (Phase 2): widths every 12.5 (62.5-125) x weights every 100 (300-900), so width/weight
# animations step finely; F.archivo() rounds to the nearest instance. File names keep the
# wdth*10 convention, with 62.5 written as w625.
for wd in [62.5, 75, 87.5, 100, 112.5, 125]:
    for wt in [300, 400, 500, 600, 700, 800, 900]:
        jobs.append(('Archivo[wdth,wght].ttf', {'wdth': wd, 'wght': wt}, f'Archivo-w{int(wd*10)}-{wt}.ttf'))
for wd in [75, 100]:
    for wt in [400, 800]:
        jobs.append(('Archivo-Italic[wdth,wght].ttf', {'wdth': wd, 'wght': wt}, f'ArchivoItalic-w{int(wd*10)}-{wt}.ttf'))
for wt in [400, 600]:
    jobs.append(('CormorantGaramond[wght].ttf', {'wght': wt}, f'Cormorant-{wt}.ttf'))
    jobs.append(('CormorantGaramond-Italic[wght].ttf', {'wght': wt}, f'CormorantItalic-{wt}.ttf'))
for s, loc, name in jobs:
    f = TTFont(src / s)
    inst = instancer.instantiateVariableFont(f, loc, updateFontNames=False)
    inst.save(out / name)
print(len(jobs), 'instances')
