import subprocess, numpy as np, json
from PIL import Image, ImageDraw
W,H=824,260
cmd=['ffmpeg','-loglevel','error','-i','/root/.claude/uploads/2aaa8590-4a45-5909-a053-8f7e4d82cd7a/ea531eb7-One_Team_One_Rhythm.mp4','-vf','crop=824:260:0:790,format=gray','-f','rawvideo','-']
fr=np.frombuffer(subprocess.run(cmd,capture_output=True).stdout,np.uint8).reshape(-1,H,W).astype(np.float32)
def edges(a):
    gx=np.abs(np.diff(a,axis=1))[:-1,:]; gy=np.abs(np.diff(a,axis=0))[:,:-1]
    return (gx+gy)>40
E=np.stack([edges(f) for f in fr])
d=np.array([0]+[ (E[i]^E[i-1]).mean()*1000 for i in range(1,len(E))])
np.save('ediff.npy',d)
# events: onset of motion after >=4 quiet frames
q=d<2.0
ev=[]
for i in range(4,len(d)):
    if not q[i] and q[i-4:i].all(): ev.append(i)
print(len(ev)); print([round(e/10,1) for e in ev])
json.dump(ev,open('events.json','w'))
# snapshot 1.5s after each event (or before next event)
shots=[]
for k,e in enumerate(ev):
    nxt=ev[k+1] if k+1<len(ev) else len(fr)
    shots.append(min(e+12,nxt-1))
w,h=494,156;per=12
for s in range(0,len(ev),per):
    sheet=Image.new('L',(w*2,(h+18)*6),0); dr=ImageDraw.Draw(sheet)
    for k,i in enumerate(range(s,min(s+per,len(ev)))):
        im=Image.fromarray(fr[shots[i]].astype(np.uint8)).resize((w,h)).point(lambda v:max(0,min(255,(v-120)*2.2)))
        x=(k%2)*w;y=(k//2)*(h+18); sheet.paste(im,(x,y+18)); dr.text((x+4,y+3),f'E{i} onset {ev[i]/10:.1f}s',fill=255)
    sheet.save(f'frames/ev_{s//per}.png')
