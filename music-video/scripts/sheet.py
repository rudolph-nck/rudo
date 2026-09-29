import sys, glob
from PIL import Image
d, out = sys.argv[1], sys.argv[2]; cols=int(sys.argv[3]) if len(sys.argv)>3 else 3
fs=sorted(glob.glob(d+'/*.jpg')); ims=[Image.open(f) for f in fs]
w,h=ims[0].size; sheet=Image.new('RGB',(w*cols,h*((len(ims)+cols-1)//cols)))
for i,im in enumerate(ims): sheet.paste(im,((i%cols)*w,(i//cols)*h))
sheet.save(out,quality=85)
