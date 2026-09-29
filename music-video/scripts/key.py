import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi
def key(src, out, tol, feather=1.2, sat_max=None, crop=None):
    im=Image.open(src).convert('RGB')
    if crop: im=im.crop(crop)
    a=np.asarray(im).astype(np.float32)
    H,W,_=a.shape
    # background model: median of border pixels per row-ish -> use smooth estimate via large blur of border
    border=np.concatenate([a[0],a[-1],a[:,0],a[:,-1]])
    # distance to local bg estimated by column/row interpolation: use heavy blur of image where likely bg
    bgc=np.median(border,axis=0)
    lum=a.mean(2); sat=a.max(2)-a.min(2)
    # candidate bg: low saturation and luminance near border luminance range
    bl=border.mean(1); lo,hi=np.percentile(bl,1)-tol, np.percentile(bl,99)+tol
    cand=(lum>=lo)&(lum<=hi)&(sat<(sat_max if sat_max else 30))
    lab,n=ndi.label(cand)
    edge_labels=set(np.unique(np.concatenate([lab[0],lab[-1],lab[:,0],lab[:,-1]])))-{0}
    bg=np.isin(lab,list(edge_labels))
    bg=ndi.binary_opening(bg,iterations=1)
    alpha=(~bg).astype(np.float32)
    alpha=ndi.gaussian_filter(alpha,feather)
    rgba=np.dstack([a,alpha*255]).clip(0,255).astype(np.uint8)
    Image.fromarray(rgba).save(out)
    print(out, (H,W), 'bg frac', bg.mean(), 'lum range',lo,hi)
key('images/3.webp','scratchpad/char_sheet_keyed.png',tol=12,sat_max=25)
key('images/1.webp','scratchpad/addapalooza_keyed.png',tol=6,sat_max=18)
key('images/2.webp','scratchpad/booth_keyed.png',tol=10,sat_max=16)
for n in ['char_sheet_keyed','addapalooza_keyed','booth_keyed']:
    im=Image.open(f'scratchpad/{n}.png'); bg=Image.new('RGBA',im.size,(10,12,14,255)); bg.alpha_composite(im); bg.convert('RGB').save(f'scratchpad/{n}_ondark.jpg',quality=85)
