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
SNAP = 0.22
DOWNBEAT_PHASE = 2

A = json.load(open(os.path.join(HERE, "audio_analysis.json")))
beats = A["beats"]
DURATION = 282.0

# (id, seconds, text, section, hero)  — hero = the word/phrase that carries the line
LINES = [
    ("yeah",        4.80, "Yeah…",                                                  "intro",  "Yeah"),
    ("y2026",      10.00, "2026.",                                                  "intro",  "2026"),
    ("whatayear",  10.80, "(What a year!)",                                         "intro",  "What a year"),
    ("roads0",     11.45, "Different roads.",                                       "intro",  "roads"),
    ("stories0",   12.60, "Different stories.",                                     "intro",  "stories"),
    ("destination",13.90, "One destination.",                                       "intro",  "One"),
    ("acu0",       15.00, "Addition Financial Credit Union…",                       "intro",  "Addition"),

    ("changin",    30.00, "Started the year with a whole lot changin’,",            "verse",  "changin’"),
    ("twoteams",   36.80, "Two teams movin’, one future waitin’,",                  "verse",  "Two teams"),
    ("envision",   42.30, "Envision came in, Addition stood tall,",                 "verse",  "stood tall"),
    ("sides",      44.70, "Different sides of the map—now we answer one call!",     "verse",  "one call"),
    ("march",      46.30, "March came quick, conversion on deck,",                  "verse",  "conversion"),
    ("longdays",   49.00, "Long days, late nights—what’d you expect?",              "verse",  "Long days"),
    ("groove",     51.10, "We learned it, taught it, found our groove,",            "verse",  "groove"),
    ("improve",    53.40, "Took what was different and made it improve!",           "verse",  "improve"),

    ("otor1",      57.52, "ONE TEAM! ONE RHYTHM!",                                  "chorus", "ONE TEAM"),
    ("everybody",  58.62, "Everybody move with us!",                                "chorus", "move"),
    ("otor2",      59.79, "ONE TEAM! ONE RHYTHM!",                                  "chorus", "ONE RHYTHM"),
    ("lookdid",    62.05, "Look at everything we did with it!",                     "chorus", "everything"),
    ("roads1",     64.80, "Different roads brought us together,",                   "chorus", "roads"),
    ("asone",      66.60, "now we’re standing here as one.",                        "chorus", "as one"),
    ("learned1",   68.30, "We learned!",                                            "chorus", "learned"),
    ("taught1",    69.10, "We taught!",                                             "chorus", "taught"),
    ("changed1",   69.95, "We changed!",                                            "chorus", "changed"),
    ("grew1",      70.80, "We grew!",                                               "chorus", "grew"),
    ("howwemove",  71.70, "THAT’S HOW WE MOVE!",                                    "chorus", "MOVE"),

    ("holdup",     74.10, "Hold up…",                                               "branches", "Hold up"),
    ("letsroll",   75.88, "Branches—LET’S ROLL!",                                   "branches", "LET’S ROLL"),
    ("b01",        79.40, "Altamonte, Longwood, Lake Mary too,",                    "branches", ""),
    ("b02",        81.60, "Fern Park, Sanford—yeah, that’s the crew!",              "branches", "the crew"),
    ("b03",        84.00, "Appleyard, Hansell, Quincy in the mix,",                 "branches", ""),
    ("b04",        86.10, "Bainbridge, Chattahoochee—you know what this is!",       "branches", ""),
    ("b05",        88.00, "Clermont, Four Corners, Kissimmee, The Loop,",           "branches", ""),
    ("b06",        90.40, "Poinciana, St. Cloud—now THAT’S a group!",               "branches", "THAT’S a group"),
    ("b07",        92.70, "Winter Garden, Metro West, South Orlando too,",          "branches", ""),
    ("b08",        94.40, "Different spots on the map—we move as one crew!",        "branches", "one crew"),
    ("b09",        96.80, "Apopka, Eustis, Leesburg in the flow,",                  "branches", ""),
    ("b10",        99.70, "Oviedo, Mills Ave—you already know!",                    "branches", ""),
    ("b11",       102.60, "Pine Hills, Parkway, East Orlando came through,",        "branches", ""),
    ("b12",       104.40, "Lake Nona, Killearn—yeah, we see you too!",              "branches", ""),
    ("b13",       106.60, "Liberty, Marianna—come on, bring it home!",              "branches", "bring it home"),
    ("b14",       109.20, "Orange City, Tallahassee Downtown strong!",              "branches", ""),
    ("b15",       111.00, "UCF, Seminole State, Downtown Campus too,",              "branches", ""),
    ("b16",       113.60, "High School Branches—LOOK AT THIS CREW!",                "branches", "LOOK AT THIS CREW"),

    ("departments",116.10, "Departments—LET’S GOOOO!",                              "departments", "Departments"),
    ("d01",       118.80, "Accounting and Finance keeping numbers aligned,",        "departments", "aligned"),
    ("d02",       122.00, "Payments and Collections keeping money moving right!",   "departments", "moving right"),
    ("d03",       125.50, "Business Intelligence turning data into drive!",         "departments", "data into drive"),
    ("d04",       126.90, "Project Management keeps the mission on time!",          "departments", "on time"),
    ("d05",       128.80, "Fraud Prevention, B-S-A on guard,",                      "departments", "on guard"),
    ("d06",       131.40, "Compliance and Legal keeping standards strong!",         "departments", "standards strong"),
    ("d07",       133.60, "Enterprise Risk watching what’s ahead,",                 "departments", "what’s ahead"),
    ("d08",       135.80, "Quality Control making sure we get it right instead!",   "departments", "right"),
    ("d09",       138.90, "Loss Prevention, Loss Mitigation seeing it through,",    "departments", "seeing it through"),
    ("d10",       141.00, "Consumer and Residential making dreams come true!",      "departments", "dreams"),
    ("d11",       143.40, "Business Lending opening doors to something new,",       "departments", "doors"),
    ("d12",       144.90, "Business Ops & Servicing keeping business moving too!",  "departments", "moving"),
    ("d13",       147.70, "IT keeps the systems running day and night,",            "departments", "day and night"),
    ("d14",       149.50, "Facilities keeps our spaces working right!",             "departments", "spaces"),
    ("d15",       151.70, "Brokerage Services helping futures grow,",               "departments", "futures grow"),
    ("d16",       154.20, "Different teams behind it—making Addition go!",          "departments", "Addition go"),
    ("d17",       156.00, "Retail Banking, Retail Ops holding it down,",            "departments", "holding it down"),
    ("d18",       158.30, "Contact Center answering when members come around!",     "departments", "answering"),
    ("d19",       161.50, "Virtual Services meeting members where they are,",       "departments", "where they are"),
    ("d20",       162.90, "Digital Member Experience taking service far!",          "departments", "far"),
    ("d21",       165.30, "Member Experience keeps the member at the heart,",       "departments", "heart"),
    ("d22",       167.40, "Community Development making an impact from the start!", "departments", "impact"),
    ("d23",       170.20, "Marketing and PR tell the story, make it loud,",         "departments", "LOUD"),
    ("d24",       172.20, "High School Branches building futures—make us proud!",   "departments", "proud"),
    ("d25",       174.10, "Human Resources, People Ops supporting the crew,",       "departments", "supporting"),
    ("d26",       176.70, "Learning and Development helping talent break through!", "departments", "break through"),
    ("d27",       178.90, "Executive Office setting vision, leading the way—",      "departments", "leading the way"),
    ("oneaddition",181.50,"Different roles, ONE ADDITION every day!",               "departments", "ONE ADDITION"),

    ("frontline", 184.50, "Front line.",                                            "beatcut", "Front line"),
    ("backoffice",187.30, "Back office.",                                           "beatcut", "Back office"),
    ("mix",       189.60, "Every team in the mix.",                                 "beatcut", "mix"),
    ("names",     193.10, "Different names.",                                       "beatcut", "names"),
    ("roles",     194.30, "Different roles.",                                       "beatcut", "roles"),
    ("piece",     195.40, "Every piece matters.",                                   "beatcut", "piece"),
    ("thatsaddition",197.60,"THAT’S ADDITION.",                                     "beatcut", "ADDITION"),

    ("learn",     198.62, "Learn…",                                                 "bridge", "Learn"),
    ("learn2",    200.60, "There’s always more to know.",                           "bridge", "more to know"),
    ("teach",     203.30, "Teach…",                                                 "bridge", "Teach"),
    ("teach2",    204.50, "Because someone helped us grow.",                        "bridge", "grow"),
    ("improve2",  207.30, "Improve…",                                               "bridge", "Improve"),
    ("improve3",  208.50, "Good enough ain’t where we stay.",                       "bridge", "ain’t where we stay"),
    ("integrity", 211.20, "Absolute Integrity…",                                    "bridge", "Integrity"),
    ("integrity2",212.80, "That’s how we lead the way.",                            "bridge", "lead the way"),

    ("offices",   214.40, "Different offices.",                                     "build", "offices"),
    ("roles2",    216.70, "Different roles.",                                       "build", "roles"),
    ("stories2",  218.00, "Different stories.",                                     "build", "stories"),
    ("roads2",    219.20, "Different roads.",                                       "build", "roads"),
    ("rhythmstarts",220.40,"But when the rhythm starts…",                           "build", "rhythm"),
    ("moveasone", 221.30, "WE MOVE AS ONE.",                                        "build", "AS ONE"),

    ("jax",       222.60, "JAX…",                                                   "finalbuild", "JAX"),
    ("ready",     225.95, "YOU READY?",                                             "finalbuild", "READY"),
    ("showem",    227.10, "Let’s show ’em how we move.",                            "finalbuild", "move"),

    ("otor3",     229.20, "ONE TEAM! ONE RHYTHM!",                                  "finalchorus", "ONE TEAM"),
    ("thisishow", 234.20, "This is how we move!",                                   "finalchorus", "move"),
    ("otor4",     236.50, "ONE TEAM! ONE RHYTHM!",                                  "finalchorus", "ONE RHYTHM"),
    ("beenthrough",239.50,"Look at everything we’ve been through!",                 "finalchorus", "been through"),
    ("branchesback",242.10,"From the branches to the back office,",                 "finalchorus", "branches"),
    ("everycrew", 244.50, "every team and every crew,",                             "finalchorus", "every crew"),
    ("test",      246.20, "2026 put us to the test—",                               "climax", "2026"),
    ("together",  247.32, "LOOK WHAT TOGETHER CAN DO!",                             "climax", "TOGETHER"),
    ("learned2",  251.90, "We learned!",                                            "climax", "learned"),
    ("taught2",   252.80, "We taught!",                                             "climax", "taught"),
    ("changed2",  253.40, "We changed!",                                            "climax", "changed"),
    ("grew2",     254.00, "We grew!",                                               "climax", "grew"),
    ("oneteam5",  255.30, "ONE TEAM!",                                              "climax", "ONE TEAM"),
    ("onerhythm5",257.50, "ONE RHYTHM!",                                            "climax", "ONE RHYTHM"),
    ("acu1",      258.53, "ADDITION FINANCIAL CREDIT UNION!",                       "climax", "ADDITION"),

    ("oneteam6",  261.40, "One team.",                                              "outro", "team"),
    ("onemission",264.10, "One mission.",                                           "outro", "mission"),
    ("onerhythm6",266.40, "One rhythm.",                                            "outro", "rhythm"),
    ("welcome",   268.60, "Welcome to Addapalooza.",                                "outro", "Addapalooza"),
    ("summit",    269.80, "Summit 2026, y’all!",                                    "outro", "Summit 2026"),
]

SECTIONS = [
    ("intro",       0.00,  "Intro — cinematic build",         "Signal → Line → Logo"),
    ("rise",       21.50,  "Rise / cut / drop",               "Timeline"),
    ("verse",      29.90,  "Verse",                           "Timeline · Merger · Map · Dial · Waveform"),
    ("chorus",     57.52,  "Chorus",                          "Rhythm type · Road"),
    ("branches",   74.10,  "Roll call — branches",            "Constellation map"),
    ("departments",116.10, "Beat switch — departments",       "The Rail"),
    ("beatcut",   183.40,  "Beat cut",                        "Depth planes · Name mosaic"),
    ("bridge",    198.62,  "Bridge",                          "Editorial light"),
    ("build",     214.40,  "Beat builds",                     "Recap montage → single line"),
    ("finalbuild",222.60,  "Final build",                     "Tension / DJ reveal"),
    ("finalchorus",226.00, "Final drop / chorus",             "Monument plus · DJ · Timeline recall"),
    ("climax",    246.20,  "Climax",                          "Together → logo"),
    ("outro",     261.30,  "Outro",                           "Addapalooza · Summit 2026"),
    ("end",       280.80,  "Mic drop",                        "Line to point"),
]


def snap(t):
    best = min(beats, key=lambda b: abs(b - t))
    return (round(best, 3), True) if abs(best - t) <= SNAP else (round(t, 3), False)


def main():
    os.makedirs(DATA, exist_ok=True)
    lyrics = []
    for i, (lid, t, text, sec, hero) in enumerate(LINES):
        st, snapped = snap(t)
        nxt = LINES[i + 1][1] if i + 1 < len(LINES) else DURATION
        lyrics.append({
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
