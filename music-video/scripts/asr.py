import sherpa_onnx, numpy as np, librosa, json, sys
SP=sys.argv[1]; M=SP+'/models/sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8/'
rec=sherpa_onnx.OfflineRecognizer.from_transducer(encoder=M+'encoder.int8.onnx',decoder=M+'decoder.int8.onnx',joiner=M+'joiner.int8.onnx',tokens=M+'tokens.txt',model_type='nemo_transducer',num_threads=4)
y,sr=librosa.load(SP+'/sep/vocals.wav',sr=16000,mono=True)
WIN,HOP=float(sys.argv[2]),float(sys.argv[3])
words=[]
t0=0.0
while t0<len(y)/sr:
    seg=y[int(t0*sr):int((t0+WIN)*sr)]
    s=rec.create_stream(); s.accept_waveform(sr,seg); rec.decode_stream(s)
    r=s.result
    # build words from tokens (sentencepiece: '▁' marks word start)
    cur=None
    lo=t0+(0 if t0==0 else (WIN-HOP)/2); hi=t0+WIN-(WIN-HOP)/2
    for tok,ts in zip(r.tokens,r.timestamps):
        T=t0+ts
        if tok.startswith(' ') or tok.startswith('▁') or cur is None:
            if cur and lo<=cur['t']<hi: words.append(cur)
            cur={'w':tok.strip('▁ '),'t':round(T,3)}
        else: cur['w']+=tok
    if cur and lo<=cur['t']<hi: words.append(cur)
    print(f'{t0:6.1f}', r.text[:140]); sys.stdout.flush()
    t0+=HOP
json.dump(words,open(SP+'/asr_words_%s.json' % sys.argv[2] + '','w'),indent=0)
print(len(words))
