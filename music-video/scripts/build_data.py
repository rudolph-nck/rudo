"""
Builds data/lyrics.json, data/beats.json and data/timing.json.

Sources
  - Lyric TEXT: the authoritative lyric sheet supplied with the brief.
  - Lyric TIMES: line-highlight events recovered from the Suno lyric export
    (see lyr2.py — edge-based scroll detection on the karaoke region), then
    hand-checked and snapped to the nearest beat when within SNAP seconds.
  - Beat grid: librosa beat tracker (audio.py -> audio_analysis.json).
    Downbeat phase measured from kick energy: beat index % 4 == 2.

Run:  python3 scripts/build_data.py
"""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "data")
FPS = 30
SNAP = 0.0  # ASR onsets are already exact; no beat snapping
DOWNBEAT_PHASE = 2

A = json.load(open(os.path.join(HERE, "audio_analysis.json")))
beats = A["beats"]
DURATION = 282.0

# (id, seconds, text, section, hero)  — hero = the word/phrase that carries the line
LINES = [
    # times = sung onsets from word-level ASR on the isolated vocal (see scripts/asr.py, data/asr/)
    ("yeah",        4.80, "Yeah…",                                                  "intro",  "Yeah"),
    ("y2026",       8.10, "2026.",                                                  "intro",  "2026"),
    ("whatayear",   9.90, "(What a year!)",                                         "intro",  "What a year"),
    ("roads0",     11.10, "Different roads.",                                       "intro",  "roads"),
    ("stories0",   13.30, "Different stories.",                                     "intro",  "stories"),
    ("destination",14.60, "One destination.",                                       "intro",  "One"),
    ("acu0",       16.30, "Addition Financial Credit Union…",                       "intro",  "Addition"),

    ("changin",    38.50, "Started the year with a whole lot changin’,",            "verse",  "changin’"),
    ("twoteams",   40.80, "Two teams movin’, one future waitin’,",                  "verse",  "Two teams"),
    ("envision",   43.00, "Envision came in, Addition stood tall,",                 "verse",  "stood tall"),
    ("sides",      45.20, "Different sides of the map—now we answer one call!",     "verse",  "one call"),
    ("march",      47.30, "March came quick, conversion on deck,",                  "verse",  "conversion"),
    ("longdays",   49.80, "Long days, late nights—what’d you expect?",              "verse",  "Long days"),
    ("groove",     52.20, "We learned it, taught it, found our groove,",            "verse",  "groove"),
    ("improve",    54.60, "Took what was different and made it improve!",           "verse",  "improve"),

    ("otor1",      57.50, "ONE TEAM! ONE RHYTHM!",                                  "chorus", "ONE TEAM"),
    ("everybody",  59.30, "Everybody move with us!",                                "chorus", "move"),
    ("otor2",      61.80, "ONE TEAM! ONE RHYTHM!",                                  "chorus", "ONE RHYTHM"),
    ("lookdid",    63.60, "Look at everything we did with it!",                     "chorus", "everything"),
    ("roads1",     66.20, "Different roads brought us together,",                   "chorus", "roads"),
    ("asone",      68.60, "now we’re standing here as one.",                        "chorus", "as one"),
    ("learned1",   70.40, "We learned!",                                            "chorus", "learned"),
    ("taught1",    70.90, "We taught!",                                             "chorus", "taught"),
    ("changed1",   71.40, "We changed!",                                            "chorus", "changed"),
    ("grew1",      72.00, "We grew!",                                               "chorus", "grew"),
    ("howwemove",  73.80, "THAT’S HOW WE MOVE!",                                    "chorus", "MOVE"),

    ("holdup",     75.05, "Hold up…",                                               "branches", "Hold up"),
    ("letsroll",   79.00, "Branches—LET’S ROLL!",                                   "branches", "LET’S ROLL"),
    ("b01",        80.10, "Altamonte, Longwood, Lake Mary too,",                    "branches", ""),
    ("b02",        82.30, "Fern Park, Sanford—yeah, that’s the crew!",              "branches", "the crew"),
    ("b03",        84.70, "Appleyard, Hansell, Quincy in the mix,",                 "branches", ""),
    ("b04",        86.70, "Bainbridge, Chattahoochee—you know what this is!",       "branches", ""),
    ("b05",        89.00, "Clermont, Four Corners, Kissimmee, The Loop,",           "branches", ""),
    ("b06",        91.00, "Poinciana, St. Cloud—now THAT’S a group!",               "branches", "THAT’S a group"),
    ("b07",        93.30, "Winter Garden, Metro West, South Orlando too,",          "branches", ""),
    ("b08",        95.40, "Different spots on the map—we move as one crew!",        "branches", "one crew"),
    ("b09",        97.60, "Apopka, Eustis, Leesburg in the flow,",                  "branches", ""),
    ("b10",       100.30, "Oviedo, Mills Ave—you already know!",                    "branches", ""),
    ("b11",       102.70, "Pine Hills, Parkway, East Orlando came through,",        "branches", ""),
    ("b12",       105.20, "Lake Nona, Killearn—yeah, we see you too!",              "branches", ""),
    ("b13",       107.60, "Liberty, Marianna—come on, bring it home!",              "branches", "bring it home"),
    ("b14",       109.80, "Orange City, Tallahassee Downtown strong!",              "branches", ""),
    ("b15",       112.10, "UCF, Seminole State, Downtown Campus too,",              "branches", ""),
    ("b16",       114.40, "High School Branches—LOOK AT THIS CREW!",                "branches", "LOOK AT THIS CREW"),

    ("departments",117.90, "Departments—LET’S GOOOO!",                              "departments", "Departments"),
    ("d01",       120.80, "Accounting and Finance keeping numbers aligned,",        "departments", "aligned"),
    ("d02",       123.20, "Payments and Collections keeping money moving right!",   "departments", "moving right"),
    ("d03",       125.40, "Business Intelligence turning data into drive!",         "departments", "data into drive"),
    ("d04",       127.80, "Project Management keeps the mission on time!",          "departments", "on time"),
    ("d05",       130.00, "Fraud Prevention, B-S-A on guard,",                      "departments", "on guard"),
    ("d06",       132.30, "Compliance and Legal keeping standards strong!",         "departments", "standards strong"),
    ("d07",       134.60, "Enterprise Risk watching what’s ahead,",                 "departments", "what’s ahead"),
    ("d08",       136.60, "Quality Control making sure we get it right instead!",   "departments", "right"),
    ("d09",       138.90, "Loss Prevention, Loss Mitigation seeing it through,",    "departments", "seeing it through"),
    ("d10",       141.00, "Consumer and Residential making dreams come true!",      "departments", "dreams"),
    ("d11",       143.40, "Business Lending opening doors to something new,",       "departments", "doors"),
    ("d12",       145.70, "Business Ops & Servicing keeping business moving too!",  "departments", "moving"),
    ("d13",       148.00, "IT keeps the systems running day and night,",            "departments", "day and night"),
    ("d14",       150.30, "Facilities keeps our spaces working right!",             "departments", "spaces"),
    ("d15",       152.70, "Brokerage Services helping futures grow,",               "departments", "futures grow"),
    ("d16",       154.80, "Different teams behind it—making Addition go!",          "departments", "Addition go"),
    ("d17",       157.20, "Retail Banking, Retail Ops holding it down,",            "departments", "holding it down"),
    ("d18",       159.30, "Contact Center answering when members come around!",     "departments", "answering"),
    ("d19",       161.50, "Virtual Services meeting members where they are,",       "departments", "where they are"),
    ("d20",       163.70, "Digital Member Experience taking service far!",          "departments", "far"),
    ("d21",       165.90, "Member Experience keeps the member at the heart,",       "departments", "heart"),
    ("d22",       168.00, "Community Development making an impact from the start!", "departments", "impact"),
    ("d23",       170.60, "Marketing and PR tell the story, make it loud,",         "departments", "loud"),
    ("d24",       173.10, "High School Branches building futures—make us proud!",   "departments", "proud"),
    ("d25",       175.40, "Human Resources, People Ops supporting the crew,",       "departments", "supporting"),
    ("d26",       177.90, "Learning and Development helping talent break through!", "departments", "break through"),
    ("d27",       180.20, "Executive Office setting vision, leading the way—",      "departments", "leading the way"),
    ("oneaddition",182.50,"Different roles, ONE ADDITION every day!",               "departments", "ONE ADDITION"),

    ("frontline", 188.60, "Front line.",                                            "beatcut", "Front line"),
    ("backoffice",189.25, "Back office.",                                           "beatcut", "Back office"),
    ("mix",       192.70, "Every team in the mix.",                                 "beatcut", "mix"),
    ("names",     193.80, "Different names.",                                       "beatcut", "names"),
    ("roles",     195.00, "Different roles.",                                       "beatcut", "roles"),
    ("piece",     197.20, "Every piece matters.",                                   "beatcut", "piece"),
    ("thatsaddition",198.30,"THAT’S ADDITION.",                                     "beatcut", "ADDITION"),

    ("learn",     199.30, "Learn…",                                                 "bridge", "Learn"),
    ("learn2",    200.60, "There’s always more to know.",                           "bridge", "more to know"),
    ("teach",     203.40, "Teach…",                                                 "bridge", "Teach"),
    ("teach2",    205.00, "Because someone helped us grow.",                        "bridge", "grow"),
    ("improve2",  208.20, "Improve…",                                               "bridge", "Improve"),
    ("improve3",  209.40, "Good enough ain’t where we stay.",                       "bridge", "ain’t where we stay"),
    ("integrity", 212.40, "Absolute Integrity…",                                    "bridge", "Integrity"),
    ("integrity2",214.30, "That’s how we lead the way.",                            "bridge", "lead the way"),

    ("offices",   216.60, "Different offices.",                                     "build", "offices"),
    ("roles2",    217.80, "Different roles.",                                       "build", "roles"),
    ("stories2",  219.00, "Different stories.",                                     "build", "stories"),
    ("roads2",    219.90, "Different roads.",                                       "build", "roads"),
    ("rhythmstarts",221.00,"But when the rhythm starts…",                           "build", "rhythm"),
    ("moveasone", 222.30, "WE MOVE AS ONE.",                                        "build", "AS ONE"),

    ("drop1",     225.70, "ONE TEAM! ONE RHYTHM!",                                  "finalchorus", "ONE TEAM"),
    ("showem",    228.50, "Let’s show ’em how we move!",                            "finalchorus", "move"),
    ("otor3",     230.30, "ONE TEAM! ONE RHYTHM!",                                  "finalchorus", "ONE TEAM"),
    ("otor3b",    233.60, "ONE TEAM! ONE RHYTHM!",                                  "finalchorus", "ONE RHYTHM"),
    ("otor3c",    234.80, "ONE TEAM! ONE RHYTHM!",                                  "finalchorus", "ONE TEAM"),
    ("thisishow", 236.60, "This is how we move!",                                   "finalchorus", "move"),
    ("otor4",     239.10, "ONE TEAM! ONE RHYTHM!",                                  "finalchorus", "ONE RHYTHM"),
    ("beenthrough",240.90,"Look at everything we’ve been through!",                 "finalchorus", "been through"),
    ("branchesback",243.50,"From the branches to the back office,",                 "finalchorus", "branches"),
    ("everycrew", 245.90, "every team and every crew,",                             "finalchorus", "every crew"),
    ("test",      247.50, "2026 put us to the test—",                               "climax", "2026"),
    ("together",  249.50, "LOOK WHAT TOGETHER CAN DO!",                             "climax", "TOGETHER"),
    ("learned2",  252.10, "We learned!",                                            "climax", "learned"),
    ("taught2",   252.60, "We taught!",                                             "climax", "taught"),
    ("changed2",  253.10, "We changed!",                                            "climax", "changed"),
    ("grew2",     253.70, "We grew!",                                               "climax", "grew"),
    ("oneteam5",  257.00, "ONE TEAM!",                                              "climax", "ONE TEAM"),
    ("onerhythm5",258.10, "ONE RHYTHM!",                                            "climax", "ONE RHYTHM"),
    ("acu1",      259.80, "ADDITION FINANCIAL CREDIT UNION!",                       "climax", "ADDITION"),

    ("oneteam6",  263.80, "One team.",                                              "outro", "team"),
    ("onemission",266.00, "One mission.",                                           "outro", "mission"),
    ("onerhythm6",268.00, "One rhythm.",                                            "outro", "rhythm"),
    ("welcome",   269.30, "Welcome to Addapalooza.",                                "outro", "Addapalooza"),
    ("summit",    272.80, "Summit 2026, y’all!",                                    "outro", "Summit 2026"),
]

SECTIONS = [
    ("intro",       0.00,  "Intro — cinematic build",         "Signal → Line → Logo"),
    ("rise",       21.50,  "Rise / cut / drop + chant",       "Timeline"),
    ("verse",      38.50,  "Verse",                           "Timeline · Merger · Map · Dial · Waveform"),
    ("chorus",     57.50,  "Chorus",                          "Rhythm type · Road"),
    ("branches",   76.90,  "Roll call — branches",            "Constellation map"),
    ("departments",117.90, "Beat switch — departments",       "The Rail"),
    ("beatcut",   184.80,  "Beat cut",                        "Depth planes · Name mosaic"),
    ("bridge",    199.30,  "Bridge",                          "Editorial light"),
    ("build",     216.60,  "Beat builds",                     "Recap montage → single line"),
    ("finalchorus",225.70, "Final drop / chorus",             "The DJ · Timeline recall"),
    ("climax",    247.50,  "Climax",                          "Together → logo"),
    ("outro",     263.80,  "Outro",                           "Addapalooza · Summit 2026"),
    ("end",       280.80,  "Mic drop",                        "Line to point"),
]


def load_asr():
    """Merge the two ASR passes: 30 s windows (more context) + 12 s windows (fills gaps)."""
    a = json.load(open(os.path.join(DATA, "asr", "words_30s.json")))
    b = json.load(open(os.path.join(DATA, "asr", "words_12s.json")))
    words = list(a)
    for w in b:
        if not any(abs(w["t"] - x["t"]) < 1.5 for x in a):
            words.append(w)
    return sorted(words, key=lambda w: w["t"])


def norm(w):
    return "".join(ch for ch in w.lower() if ch.isalnum())


def sim(a, b):
    a, b = norm(a), norm(b)
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    # Levenshtein ratio
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return 1 - prev[-1] / max(len(a), len(b))


def align_line(tokens, asr, t0, t1):
    """Monotonic fuzzy alignment of lyric tokens to ASR words inside [t0, t1)."""
    cand = [w for w in asr if t0 - 0.35 <= w["t"] < t1 - 0.25]
    n, m = len(tokens), len(cand)
    NEG = -1e9
    S = [[NEG] * (m + 1) for _ in range(n + 1)]
    B = [[None] * (m + 1) for _ in range(n + 1)]
    for j in range(m + 1):
        S[0][j] = -0.2 * j
    for i in range(1, n + 1):
        S[i][0] = -0.6 * i
        for j in range(1, m + 1):
            sc = sim(tokens[i - 1], cand[j - 1]["w"])
            opts = [(S[i - 1][j - 1] + (2 * sc if sc >= 0.5 else -1), "m"), (S[i - 1][j] - 0.6, "u"), (S[i][j - 1] - 0.2, "s")]
            S[i][j], B[i][j] = max(opts)
    times = [None] * n
    i, j = n, max(range(m + 1), key=lambda k: S[n][k])
    while i > 0 and j > 0:
        op = B[i][j]
        if op == "m":
            if sim(tokens[i - 1], cand[j - 1]["w"]) >= 0.5:
                times[i - 1] = cand[j - 1]["t"]
            i, j = i - 1, j - 1
        elif op == "u":
            i -= 1
        else:
            j -= 1
    # anchor first word to the line onset, interpolate the rest
    if times[0] is None:
        times[0] = t0
    known = [(k, t) for k, t in enumerate(times) if t is not None]
    for k in range(n):
        if times[k] is None:
            before = [(a, t) for a, t in known if a < k]
            after = [(a, t) for a, t in known if a > k]
            if before and after:
                (a0, ta), (a1, tb) = before[-1], after[0]
                times[k] = ta + (tb - ta) * (k - a0) / (a1 - a0)
            elif before:
                a0, ta = before[-1]
                span = min(t1 - 0.3, ta + 0.34 * (n - a0)) - ta
                times[k] = ta + max(0.0, span) * (k - a0) / max(1, n - a0)
    # monotonic, never before onset
    out = []
    last = t0
    for t in times:
        t = max(t, last)
        out.append(round(t, 3))
        last = t
    return out


def snap(t):
    best = min(beats, key=lambda b: abs(b - t))
    return (round(best, 3), True) if abs(best - t) <= SNAP else (round(t, 3), False)


def main():
    os.makedirs(DATA, exist_ok=True)
    lyrics = []
    asr = load_asr()
    for i, (lid, t, text, sec, hero) in enumerate(LINES):
        st, snapped = snap(t)
        nxt = LINES[i + 1][1] if i + 1 < len(LINES) else DURATION
        tokens = text.split()
        wt = align_line(tokens, asr, st, nxt)
        wt[0] = st
        last = wt[-1]
        lyrics.append({
            "words": [{"w": w, "t": tt} for w, tt in zip(tokens, wt)],
            "hold": round(min(nxt, last + 2.4), 3),
            "id": lid, "text": text, "section": sec, "hero": hero,
            "start": st, "rawStart": t, "snapped": snapped,
            "end": round(min(nxt, DURATION), 3),
            "startFrame": round(st * FPS),
        })
    json.dump({"fps": FPS, "source": "authoritative lyric sheet; timing from Suno highlight events + beat snap",
               "lines": lyrics}, open(os.path.join(DATA, "lyrics.json"), "w"), indent=1, ensure_ascii=False)

    downbeats = [round(b, 3) for i, b in enumerate(beats) if i % 4 == DOWNBEAT_PHASE]
    lows = A["low_per_sec"]
    dips = [s for s in range(1, len(lows) - 1) if lows[s] < 2.5 and s > 20]
    json.dump({
        "fps": FPS, "bpm": round(A["tempo"], 2), "beatPeriod": 0.5573,
        "beats": [round(b, 3) for b in beats],
        "downbeats": downbeats,
        "kickDropouts": dips,
        "accents": [round(x, 3) for x in A["strong_onsets"]],
        "energyPerSecond": [round(x, 4) for x in A["rms_per_sec"][:int(DURATION)]],
        "lowPerSecond": [round(x, 2) for x in lows[:int(DURATION)]],
    }, open(os.path.join(DATA, "beats.json"), "w"), indent=0)

    secs = []
    for i, (sid, t, name, world) in enumerate(SECTIONS):
        end = SECTIONS[i + 1][1] if i + 1 < len(SECTIONS) else DURATION
        secs.append({"id": sid, "name": name, "worlds": world, "start": t, "end": end,
                     "startFrame": round(t * FPS), "endFrame": round(end * FPS)})
    json.dump({"fps": FPS, "duration": DURATION, "durationInFrames": round(DURATION * FPS),
               "sections": secs}, open(os.path.join(DATA, "timing.json"), "w"), indent=1)
    print(len(lyrics), "lines;", len(downbeats), "downbeats; dips", dips)


if __name__ == "__main__":
    main()
