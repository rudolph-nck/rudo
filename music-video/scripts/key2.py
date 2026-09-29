import numpy as np
from PIL import Image
from scipy import ndimage as ndi
def flood(a, cand, seeds_mask):
    lab,n=ndi.label(cand)
    ids=set(np.unique(lab[seeds_mask & cand]))-{0}
    return np.isin(lab,list(ids))
# character sheet: white bg
a=np.asarray(Image.open('images/3.webp').convert('RGB')).astype(np.float32)
lum=a.mean(2); sat=a.max(2)-a.min(2)
cand=(lum>200)&(sat<30)
seed=np.zeros_like(cand); seed[0,:]=seed[-1,:]=seed[:,0]=seed[:,-1]=True
# panel gutters are white too; also seed every pixel that's pure white
seed|=(lum>245)
bg=flood(a,cand,seed)
alpha=ndi.gaussian_filter((~bg).astype(np.float32),0.8)
# despill: darken bright fringe
Image.fromarray(np.dstack([a,alpha*255]).clip(0,255).astype(np.uint8)).save('scratchpad/char_sheet_keyed.png')
# booth
b=np.asarray(Image.open('scratchpad/booth_keyed.png')).astype(np.float32)
rgb=b[...,:3]; al=b[...,3]/255
lum=rgb.mean(2); sat=rgb.max(2)-rgb.min(2)
H,W=lum.shape
cand=(lum>120)&(sat<45)
seed=np.zeros_like(cand); seed[-1,:]=True; seed[540:,0]=True; seed[540:,-1]=True
floor=flood(rgb,cand,seed)
floor[:520]=False
al=np.minimum(al, ndi.gaussian_filter((~floor).astype(np.float32),1.0))
# kill tiny islands
m=al>0.5; lab,n=ndi.label(m); sizes=ndi.sum(m,lab,range(1,n+1))
keep=np.isin(lab, [i+1 for i,s in enumerate(sizes) if s>4000])
al=al*ndi.gaussian_filter(keep.astype(np.float32),0.8)
Image.fromarray(np.dstack([rgb,al*255]).clip(0,255).astype(np.uint8)).save('scratchpad/booth_keyed.png')
for n in ['char_sheet_keyed','booth_keyed']:
    im=Image.open(f'scratchpad/{n}.png'); bg=Image.new('RGBA',im.size,(10,12,14,255)); bg.alpha_composite(im); bg.convert('RGB').save(f'scratchpad/{n}_ondark.jpg',quality=85)
