"""Shared paths / cache setup for the Drift analysis scripts (ported from pdoom-video).

Import this module FIRST (before torch / huggingface / mlx imports) so that all
model downloads land in analysis/.cache/.
"""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent          # analysis/
PROJECT = ROOT.parent                            # lyric-video/
CACHE = ROOT / ".cache"
for var, sub in [("TORCH_HOME", "torch"), ("HF_HOME", "hf"), ("HF_HUB_CACHE", "hf/hub"),
                 ("XDG_CACHE_HOME", "xdg"), ("HUGGINGFACE_HUB_CACHE", "hf/hub"),
                 ("TRANSFORMERS_CACHE", "hf/transformers"), ("MPLCONFIGDIR", "mpl"),
                 ("NUMBA_CACHE_DIR", "numba"), ("UV_CACHE_DIR", "uv")]:
    os.environ.setdefault(var, str(CACHE / sub))
    (CACHE / sub).mkdir(parents=True, exist_ok=True)

AUDIO = PROJECT / "audio" / "drift.mp3"
STEMS = ROOT / "stems" / "htdemucs_ft" / "drift"
LYRICS_SRC = PROJECT / "lyrics" / "drift.src.js"
# Suno's own lead-vocal stem (same render as the master: 0 ms offset by cross-correlation).
SUNO_LEAD = PROJECT / "audio" / "stems" / "drift-vocals.mp3"
DATA = PROJECT / "data"
QA = ROOT / "qa"
WORK = ROOT / "work"          # intermediate results (whisper json, alignments)
QA.mkdir(exist_ok=True)
WORK.mkdir(exist_ok=True)
DATA.mkdir(exist_ok=True)


def load_lyrics_src():
    """Parse lyrics.src.js -> list of (start, end, text)."""
    import json, re
    src = LYRICS_SRC.read_text(encoding="utf-8")
    body = src[src.index("["): src.rindex("]") + 1]
    return [tuple(x) for x in json.loads(body)]


# Demucs decodes the mp3 itself; for pdoom that decode did NOT trim the LAME encoder
# delay, so the stems ran 23 ms late against the gapless decode (our time reference).
# Don't assume it: measure it once by cross-correlating the sum of the four stems with the
# mix, cache it in work/stem_offset.json, and shift every stem by it.
_OFFSET = None


def stem_offset_samples():
    """Samples (at 44.1 kHz) by which the Demucs stems lag the gapless mp3 decode."""
    global _OFFSET
    if _OFFSET is not None:
        return _OFFSET
    import json
    cache = WORK / "stem_offset.json"
    if cache.exists():
        _OFFSET = int(json.loads(cache.read_text())["samples"])
        return _OFFSET
    import numpy as np, soundfile as sf
    from scipy.signal import correlate
    sr = 44100
    mix, _ = load_mix(sr)
    a, b = 30 * sr, 90 * sr
    tot = None
    for n in ("vocals", "drums", "bass", "other"):
        y, s = sf.read(STEMS / f"{n}.wav", dtype="float32", always_2d=True)
        assert s == sr
        y = y.mean(axis=1)
        tot = y if tot is None else tot[: len(y)] + y[: len(tot)]
    c = correlate(tot[a:b], mix[a:b], mode="full", method="fft")
    lag = int(np.argmax(c)) - (b - a - 1)
    assert abs(lag) < 4000, f"implausible stem offset {lag}"
    cache.write_text(json.dumps(dict(samples=lag, sr=sr)))
    print("stem offset", lag, "samples =", round(lag / sr * 1000, 2), "ms")
    _OFFSET = lag
    return lag


def load_stem(name, sr=None, mono=True):
    """Load a Demucs stem, time-aligned to the gapless mp3 decode."""
    import soundfile as sf
    import numpy as np
    y, s = sf.read(STEMS / f"{name}.wav", dtype="float32", always_2d=True)
    assert s == 44100
    off = stem_offset_samples()
    y = y[off:] if off >= 0 else np.pad(y, ((-off, 0), (0, 0)))
    y = y.mean(axis=1) if mono else y.T
    if sr and sr != s:
        import soxr
        y = soxr.resample(y, s, sr) if mono else np.stack([soxr.resample(c, s, sr) for c in y])
        s = sr
    return y, s


def load_lead(sr=None, mono=True):
    """Lead vocal only: Suno's own vocal stem (pdoom used a mel-roformer karaoke model here).
    librosa decodes through ffmpeg/libsndfile gaplessly, so it is already in master time."""
    import librosa
    y, s = librosa.load(str(SUNO_LEAD), sr=sr or 44100, mono=mono)
    return y, s


def load_vocal_source(name, sr=None):
    """'vocals' = Demucs vocal stem (mono sum), 'vocL'/'vocR' = its left/right
    channel (choruses are double-tracked and panned L/R, so each channel is
    closer to a single voice), 'lead' = karaoke lead."""
    if name == "lead":
        return load_lead(sr)
    if name in ("vocL", "vocR"):
        y, s = load_stem("vocals", sr=sr, mono=False)
        return y[0 if name == "vocL" else 1], s
    return load_stem("vocals", sr=sr)


def load_mix(sr=44100, mono=True):
    import librosa
    y, s = librosa.load(str(AUDIO), sr=sr, mono=mono)
    return y, s
