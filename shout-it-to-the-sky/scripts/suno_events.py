"""Line-change events from the Suno lyric export: the lyric list scrolls whenever
the highlighted line advances, so motion onsets in the lyric band ~= line starts."""
import subprocess, sys, json, numpy as np
src, out = sys.argv[1], sys.argv[2]
W, H, FPS = 824, 300, 10
cmd = ['ffmpeg', '-loglevel', 'error', '-i', src, '-vf', f'fps={FPS},crop={W}:{H}:0:770,format=gray', '-f', 'rawvideo', '-']
fr = np.frombuffer(subprocess.run(cmd, capture_output=True).stdout, np.uint8).reshape(-1, H, W).astype(np.float32)
def edges(a):
    return (np.abs(np.diff(a, axis=1))[:-1, :] + np.abs(np.diff(a, axis=0))[:, :-1]) > 40
E = [edges(f) for f in fr]
d = np.array([0] + [(E[i] ^ E[i - 1]).mean() * 1000 for i in range(1, len(E))])
quiet = d < 2.0
ev = [i for i in range(4, len(d)) if not quiet[i] and quiet[i - 4:i].all()]
json.dump({'fps': FPS, 'events': [round(i / FPS, 2) for i in ev]}, open(out, 'w'))
print(len(ev), [round(i / FPS, 1) for i in ev])
