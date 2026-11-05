"""Run faster-whisper (word timestamps) on the time-corrected vocal stem.

Writes work/whisper_<tag>.json in the same shape the pdoom pipeline's mlx-whisper run
produced ({"segments": [{"start","end","text","words": [{"word","start","end"}]}]}), so
align.py reads it unchanged. Used only as an independent cross-check for the CTC forced
alignment. (pdoom used mlx-whisper, which needs Apple Silicon; this runs on Linux CPU.)

Run:  uv run python whisper_run.py [turbo|large]
"""
import common  # noqa: F401  (sets cache dirs)
import json, sys

MODELS = {"turbo": "large-v3-turbo", "large": "large-v3"}


def vocals16k():
    """The Demucs vocal stem (offset-corrected), mono 16 kHz, as work/vocals16k.wav."""
    p = common.WORK / "vocals16k.wav"
    if not p.exists():
        import soundfile as sf
        y, sr = common.load_stem("vocals", sr=16000)
        sf.write(p, y, sr)
    return p


def run(tag, model, prompt=None):
    from faster_whisper import WhisperModel
    m = WhisperModel(model, device="cpu", compute_type="int8",
                     download_root=str(common.CACHE / "hf" / "faster-whisper"))
    segs, _ = m.transcribe(
        str(vocals16k()), language="en", word_timestamps=True,
        condition_on_previous_text=False, initial_prompt=prompt, temperature=0.0,
        no_speech_threshold=None, vad_filter=False,
    )
    res = {"segments": []}
    for s in segs:
        res["segments"].append(dict(
            start=s.start, end=s.end, text=s.text,
            words=[dict(word=w.word, start=w.start, end=w.end, probability=w.probability) for w in (s.words or [])],
        ))
        print(f"{s.start:7.2f} {s.end:7.2f} {s.text}")
    out = common.WORK / f"whisper_{tag}.json"
    out.write_text(json.dumps(res, indent=1, default=float))
    return res


if __name__ == "__main__":
    which = sys.argv[1] if len(sys.argv) > 1 else "turbo"
    prompt = ("Song lyrics, rap/R&B, about being tired and wanting a break: "
              "I don't wanna die, I just wanna drift. Voicemails, notifications, tomorrow.")
    run(which, MODELS[which])
    run(which + "_prompt", MODELS[which], prompt)
