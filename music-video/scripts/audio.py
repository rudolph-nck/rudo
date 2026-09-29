import librosa, numpy as np, json
y,sr=librosa.load('song.wav',sr=22050,mono=True)
dur=len(y)/sr
tempo,beats=librosa.beat.beat_track(y=y,sr=sr,units='time')
print('dur',dur,'tempo',tempo, 'nbeats',len(beats), beats[:12])
ibi=np.diff(beats); print('ibi median',np.median(ibi), 'std',ibi.std())
onset_env=librosa.onset.onset_strength(y=y,sr=sr)
rms=librosa.feature.rms(y=y,hop_length=512)[0]; t=librosa.times_like(rms,sr=sr,hop_length=512)
# 1s energy profile
sec=[float(rms[(t>=i)&(t<i+1)].mean()) for i in range(int(dur)+1)]
print('energy/sec:'); 
for i in range(0,len(sec),10): print(i, ' '.join(f'{v*100:4.1f}' for v in sec[i:i+10]))
# low-freq (kick) and high energy
S=np.abs(librosa.stft(y,hop_length=512))
fr=librosa.fft_frequencies(sr=sr)
low=S[fr<150].mean(0); high=S[fr>4000].mean(0)
lows=[float(low[(t>=i)&(t<i+1)].mean()) for i in range(int(dur)+1)]
highs=[float(high[(t>=i)&(t<i+1)].mean()) for i in range(int(dur)+1)]
print('low/sec'); 
for i in range(0,len(lows),10): print(i,' '.join(f'{v:5.1f}' for v in lows[i:i+10]))
print('high/sec');
for i in range(0,len(highs),10): print(i,' '.join(f'{v*10:5.1f}' for v in highs[i:i+10]))
# onsets
on=librosa.onset.onset_detect(onset_envelope=onset_env,sr=sr,units='time')
# strong onsets
env_t=librosa.times_like(onset_env,sr=sr)
strong=[float(x) for x in on if onset_env[np.argmin(np.abs(env_t-x))]>np.percentile(onset_env,97)]
json.dump({'duration':dur,'tempo':float(np.atleast_1d(tempo)[0]),'beats':[float(b) for b in beats],'rms_per_sec':sec,'low_per_sec':lows,'high_per_sec':highs,'strong_onsets':strong},open('audio_analysis.json','w'))
# segmentation
chroma=librosa.feature.chroma_cqt(y=y,sr=sr); mf=librosa.feature.mfcc(y=y,sr=sr,n_mfcc=13)
feat=np.vstack([librosa.util.normalize(chroma),librosa.util.normalize(mf)])
bounds=librosa.segment.agglomerative(feat,16); print('segment bounds', np.round(librosa.frames_to_time(bounds,sr=sr),1))
