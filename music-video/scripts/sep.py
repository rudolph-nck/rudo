import wave, numpy as np, sys
from spleeter.separator import Separator
SP=sys.argv[1]
w=wave.open(SP+'/song.wav'); sr=w.getframerate(); n=w.getnframes(); ch=w.getnchannels()
x=np.frombuffer(w.readframes(n),dtype=np.int16).reshape(-1,ch).astype(np.float32)/32768
sep=Separator('spleeter:2stems')
out=sep.separate(x)
v=out['vocals']
import os; os.makedirs(SP+'/sep',exist_ok=True)
y=(np.clip(v,-1,1)*32767).astype(np.int16)
o=wave.open(SP+'/sep/vocals.wav','wb'); o.setnchannels(ch); o.setsampwidth(2); o.setframerate(sr); o.writeframes(y.tobytes()); o.close()
print('ok',v.shape,sr)
