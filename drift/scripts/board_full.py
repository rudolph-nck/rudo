"""Full-song storyboard (the hook-first direction) -> creative/storyboard-full.html
Intro frames are real renders from the approved test; every other frame is a quick 9:16 sketch."""
import base64, html, random, sys, os
ROOT = sys.argv[1] if len(sys.argv) > 1 else "."
FR = sys.argv[2] if len(sys.argv) > 2 else "/tmp/claude-0/sb"

AMB, INK, STONE, MUT, BG = "#ff7a2c", "#efede9", "#c4b6a2", "#8d877e", "#08080a"

def img(t):
    b = base64.b64encode(open(f"{FR}/f_{t}.jpg", "rb").read()).decode()
    return f'<img src="data:image/jpeg;base64,{b}" alt="Frame at {t} seconds from the intro test render">'

# ---------------- tiny 9:16 sketch kit (viewBox 90x160) ----------------
def svg(*els, bg=BG):
    return f'<svg viewBox="0 0 90 160" role="img" aria-hidden="true"><rect width="90" height="160" fill="{bg}"/>{"".join(els)}</svg>'
def stars(n=40, seed=1, o=0.7):
    r = random.Random(seed)
    return "".join(f'<circle cx="{r.random()*90:.1f}" cy="{r.random()*160:.1f}" r="{0.25+r.random()**4*0.9:.2f}" fill="#fff" opacity="{o*(0.3+r.random()*0.7):.2f}"/>' for _ in range(n))
def spark(x, y, r=2.2):
    return (f'<circle cx="{x}" cy="{y}" r="{r*4}" fill="url(#glow)"/><circle cx="{x}" cy="{y}" r="{r*0.6}" fill="#fff6ea"/>')
def w(x, y, s, t, c=INK, rot=0, o=1, anchor="middle"):
    return (f'<text x="{x}" y="{y}" font-size="{s}" fill="{c}" opacity="{o}" text-anchor="{anchor}" '
            f'transform="rotate({rot} {x} {y})" class="sw">{html.escape(t)}</text>')
def ln(d, c=MUT, sw=0.5, o=1, dash=None):
    da = f' stroke-dasharray="{dash}"' if dash else ""
    return f'<path d="{d}" fill="none" stroke="{c}" stroke-width="{sw}" opacity="{o}"{da}/>'
def rect(x, y, ww, hh, c, o=1, rx=0):
    return f'<rect x="{x}" y="{y}" width="{ww}" height="{hh}" fill="{c}" opacity="{o}" rx="{rx}"/>'
def circ(x, y, r, c=MUT, sw=0.5, o=1, fill="none"):
    return f'<circle cx="{x}" cy="{y}" r="{r}" fill="{fill}" stroke="{c}" stroke-width="{sw}" opacity="{o}"/>'

SK = {
 "fan": svg(rect(0, 0, 90, 160, "#4a463f"), rect(0, 0, 90, 160, "url(#sun)"),
            *[ln(f"M{-10+i*12} 0 L{30+i*12} 160", "#fff", 3, 0.05) for i in range(9)],
            circ(45, 40, 4, "#222", 0, 1, "#2a2724"), *[ln(f"M45 40 L{45+26*__import__('math').cos(a)} {40+26*__import__('math').sin(a)}", "#2a2724", 4) for a in (0.3, 1.87, 3.44, 5.01)],
            w(45, 92, 9, "ANOTHER", "#1d1b19"), w(45, 110, 17, "MORNING", "#1d1b19"), spark(66, 70, 0.9)),
 "chest": svg(rect(0, 0, 90, 160, "#3e3a35"), rect(0, 52, 6, 56, "#1d1b19"), rect(84, 52, 6, 56, "#1d1b19"),
              w(45, 72, 13, "PRESSURE", "#1d1b19"), w(45, 104, 26, "CHEST", "#1d1b19"), circ(45, 95, 26, "#1d1b19", 0.6, 0.35), circ(45, 95, 34, "#1d1b19", 0.4, 0.18)),
 "me": svg(rect(0, 0, 90, 160, "#3a3631"), w(45, 50, 8, "EVERYBODY", "#1d1b19"), w(45, 60, 5, "NEEDS A PIECE OF", "#1d1b19"),
           w(45, 112, 52, "ME", "#1d1b19"), *[ln(f"M{x0} {y0} L{x1} {y1}", "#1d1b19", 0.5) for x0, y0, x1, y1 in ((0, 70, 24, 90), (90, 64, 66, 88), (0, 140, 26, 108), (90, 150, 64, 110), (45, 160, 47, 114))],
           rect(14, 84, 5, 5, "#1d1b19"), rect(70, 82, 4, 4, "#1d1b19")),
 "weight": svg(rect(0, 0, 90, 160, "#151311"), rect(0, 112, 90, 48, "#2a2622"), rect(0, 112, 90, 48, "url(#floor)"),
               w(14, 104, 4, "I'M", STONE), w(24, 104, 5, "CARRYING", STONE), w(40, 104, 6.5, "SO", STONE), w(52, 104, 8, "MUCH", STONE),
               w(66, 116, 16, "WEIGHT", INK, 6), ln("M56 120 L50 132 L54 140 L44 156", "#000", 0.8), ln("M70 122 L78 136 L74 146", "#000", 0.7),
               ln("M8 84 L36 96", STONE, 1.4), ln("M48 98 L82 84", STONE, 1.4), spark(64, 120, 1.2)),
 "void": svg(rect(0, 0, 90, 160, "#050505"), rect(0, 0, 90, 26, "#2a2622"), ln("M0 26 L20 22 L34 28 L52 20 L70 27 L90 22", "#000", 2), stars(30, 4, 0.5),
             w(45, 74, 10, "MINE", INK, -8), spark(45, 60, 1.0), w(45, 128, 18, "LIFE", STONE, 0, 0.9), rect(30, 132, 30, 28, "#1c1a17")),
 "disc": svg(rect(0, 0, 90, 160, "#070708"), stars(26, 7, 0.4), w(45, 50, 8, "FUNNY HOW SUCCESS", STONE), w(45, 64, 7, "CAN LEAVE YOU", STONE),
             w(10, 100, 13, "DIS", INK), w(32, 104, 13, "CON", INK, 4), w(58, 98, 13, "NECT", INK, -5), w(82, 106, 13, "ED", INK, 8), spark(45, 128, 1.1)),
 "wall": svg(rect(0, 0, 90, 160, "#1a1816"), *[rect(8 + (i % 3) * 26, 26 + (i // 3) * 36, 20, 26, "#2c2925") for i in range(9)],
             *[ln(f"M{8+(i%3)*26} {26+(i//3)*36} h20 v26 h-20 z", STONE, 0.4) for i in range(9)], w(45, 150, 9, "ACHIEVEMENTS", INK),
             rect(60, 120, 20, 26, "#2c2925"), ln("M60 120 l20 4", MUT, 0.5)),
 "break": svg(rect(0, 0, 90, 160, "#030303"), ln("M0 92 L22 84 L38 94 L56 82 L74 92 L90 86", "#ffd2a8", 2.4), ln("M0 92 L22 84 L38 94 L56 82 L74 92 L90 86", "#fff", 0.6),
              rect(0, 80, 90, 20, "url(#crackglow)"), w(45, 76, 17, "BREAK", INK), spark(56, 82, 1.2)),
 "drift": svg(rect(0, 0, 90, 160, "url(#warm)"), stars(46, 9, 0.8), w(45, 60, 8, "I JUST WANNA", INK, -6, 0.9), w(46, 92, 24, "DRIFT", AMB, -10),
              w(18, 128, 6, "WEIGHT", STONE, 32, 0.5), w(70, 138, 6, "PRESSURE", STONE, -24, 0.5), spark(70, 84, 1.3)),
 "no": svg(rect(0, 0, 90, 160, "#08080a"), stars(30, 11, 0.5), w(45, 64, 22, "NO", INK), w(45, 92, 13, "DEADLINES", INK, 0, 0.9),
           *[f'<polygon points="{x},{y} {x+4},{y+1} {x+1},{y+5}" fill="{INK}" opacity="0.7" transform="rotate({r} {x} {y})"/>' for x, y, r in ((18, 104, 20), (30, 112, -30), (58, 108, 50), (70, 118, 10), (44, 122, -60), (64, 98, 80), (24, 96, -10))]),
 "world": svg(rect(0, 0, 90, 160, "#070708"), stars(50, 13, 0.7), circ(45, 150, 36, STONE, 0.5, 0.6, "#141312"), w(45, 46, 7, "I DON'T WANNA LEAVE THIS", STONE), w(45, 64, 16, "WORLD", INK), spark(45, 92, 1.1)),
 "road": svg(rect(0, 0, 90, 160, "#060607"), "<polygon points='45,70 90,160 0,160' fill='#121212'/>", ln("M45 70 L45 160", "#d8cfbf", 0.8, 0.8, "4 5"),
             *[circ(30 + i * 4, 76 + i * 3, 0.8, "#ffd9b0", 0, 0.9, "#ffd9b0") for i in range(4)], rect(56, 40, 30, 14, "#1d2a20"),
             w(71, 50, 4.6, "NO DESTINATION", "#cfd8cc"), w(30, 112, 11, "DRIVE", INK, 0)),
 "voicemail": svg(rect(0, 0, 90, 160, "#08080a"), rect(18, 30, 54, 100, "#141312", 1, 6), rect(18, 30, 54, 100, "url(#phone)", 1, 6),
                  ln("M24 86 " + " ".join(f"L{24+i*1.4:.1f} {86 + (6*__import__('math').sin(i*0.9)*abs(__import__('math').sin(i*0.21))):.1f}" for i in range(30)), AMB, 0.9),
                  w(45, 56, 9, "FATHER", INK), w(45, 110, 4.5, "VOICEMAIL  0:43", MUT), spark(66, 86, 1.0)),
 "nothing": svg(rect(0, 0, 90, 160, "#1b1b1b"), w(45, 70, 7, "SOME DAYS I JUST WANNA FEEL", "#5a5a5a"), w(45, 98, 20, "NOTHING", "#9a9a9a", 0, 0.35)),
 "breathe": svg(rect(0, 0, 90, 160, "#050506"), stars(36, 15, 0.6), *[ln(f"M{45+i*0.2} 160 L{30-i*9} {120-i*3}", "#ffd9b0", 0.6, 0.3) for i in range(3)],
                circ(45, 78, 10, AMB, 0.4, 0.5), circ(45, 78, 18, AMB, 0.3, 0.25), spark(45, 78, 1.5), w(45, 112, 14, "BREATHE", INK)),
 "bridge": svg(rect(0, 0, 90, 160, "#08080a"), stars(40, 17, 0.6), *[w(45, 30 + i * 11, 7, "EVERYTHING EVERYBODY", STONE, 0, 0.25 + i * 0.07) for i in range(9)],
               w(45, 140, 11, "NEEDS", INK), rect(33, 146, 24, 14, "#000")),
 "peace": svg(rect(0, 0, 90, 160, "#060607"), stars(20, 19, 0.4), w(45, 86, 20, "PEACE", INK), ln("M10 110 L80 110", STONE, 0.3, 0.6),
              *[w(x, y, 4, "FIXING", MUT, r, 0.5) for x, y, r in ((16, 140, 70), (70, 150, -60), (40, 154, 90))]),
 "notif": svg(rect(0, 0, 90, 160, "#0b0b0c"), *[rect(10, 18 + i * 15, 70, 12, "#1e1d1b", 1, 3) for i in range(8)], *[rect(14, 21 + i * 15, 20, 2, MUT) for i in range(8)],
              *[rect(14, 25 + i * 15, 40, 2, "#3a3835") for i in range(8)], w(45, 150, 12, "NO", INK), rect(0, 70, 90, 6, "url(#wipe)")),
 "silence": svg(rect(0, 0, 90, 160, "#000"), w(45, 82, 6, "SILENCE", "#bdb8af")),
 "final": svg(rect(0, 0, 90, 160, "url(#warm)"), stars(60, 21, 0.9), *[w(x, y, s, t, c, r, o) for x, y, s, t, c, r, o in (
              (20, 30, 5, "TIRED", STONE, -20, 0.6), (70, 40, 5, "QUIT", STONE, 15, 0.6), (30, 132, 6, "WEIGHT", STONE, 30, 0.6), (66, 146, 5, "NOISE", STONE, -12, 0.6),
              (45, 70, 8, "SOMEWHERE THE PAST", INK, 0, 0.9), (45, 92, 18, "CAN'T REACH", INK, 0, 1))], spark(78, 82, 1.3)),
 "build": svg(rect(0, 0, 90, 160, "#151311"), rect(0, 112, 90, 48, "#2a2622"), ln("M10 92 L80 92", INK, 1.6), ln("M14 92 L14 102 M76 92 L76 102", STONE, 1),
              w(45, 88, 13, "WEIGHT", INK), w(45, 60, 6, "TOMORROW I'LL KEEP BUILDING", STONE), spark(80, 92, 1.3),
              *[circ(80 + dx, 92 + dy, 0.5, AMB, 0, 1, AMB) for dx, dy in ((3, -3), (5, 1), (-2, -5), (4, 4))]),
 "loop": svg(rect(0, 0, 90, 160, "#030304"), stars(30, 23, 0.5), w(45, 70, 7, "LET ME", STONE, 0, 0.8), w(45, 92, 22, "DRIFT", INK, 0, 0.9), spark(60, 120, 1.0),
             ln("M20 150 Q40 130 58 121", AMB, 0.5, 0.7)),
 "spiral": svg(rect(0, 0, 90, 160, "url(#warm)"), stars(50, 25, 0.8), '<ellipse cx="45" cy="66" rx="40" ry="16" fill="none" stroke="#8d877e" stroke-width="0.4"/>',
               *[w(x, y, 4.5, t, STONE, r, 0.8) for x, y, t, r in ((14, 60, "TIRED", -40), (32, 52, "QUIT", -12), (58, 52, "WEIGHT", 12), (76, 62, "NOISE", 40), (66, 80, "MINE", -20), (24, 80, "ME", 20))],
               w(45, 112, 22, "DRIFT", AMB, -6), spark(30, 104, 1.2)),
 "tonight": svg(rect(0, 0, 90, 160, "url(#warm)"), stars(40, 27, 0.8), w(45, 60, 15, "STRONGER", "#b9ab97"), rect(18, 64, 54, 3, "#5a5248"),
                w(45, 96, 8, "BUT", INK, 0, 0.8), w(45, 116, 20, "TONIGHT", AMB), spark(72, 100, 1.2)),
}
DEFS = f'''<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
<radialGradient id="glow"><stop offset="0" stop-color="{AMB}" stop-opacity="0.9"/><stop offset="0.35" stop-color="{AMB}" stop-opacity="0.35"/><stop offset="1" stop-color="{AMB}" stop-opacity="0"/></radialGradient>
<linearGradient id="sun" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd8a8" stop-opacity="0.35"/><stop offset="1" stop-color="#ffd8a8" stop-opacity="0"/></linearGradient>
<linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1df" stop-opacity="0.18"/><stop offset="1" stop-color="#000" stop-opacity="0.4"/></linearGradient>
<linearGradient id="crackglow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb070" stop-opacity="0"/><stop offset="0.5" stop-color="#ffb070" stop-opacity="0.35"/><stop offset="1" stop-color="#ffb070" stop-opacity="0"/></linearGradient>
<linearGradient id="warm" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#3a2416"/><stop offset="0.5" stop-color="#120d0b"/><stop offset="1" stop-color="#060607"/></linearGradient>
<linearGradient id="phone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffcf9f" stop-opacity="0.12"/><stop offset="1" stop-color="#ffcf9f" stop-opacity="0"/></linearGradient>
<linearGradient id="wipe" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#0b0b0c" stop-opacity="1"/><stop offset="1" stop-color="#0b0b0c" stop-opacity="0"/></linearGradient>
</defs></svg>'''

# ---------------- the story ----------------
# (section, time range, mode, frames [(visual, time, title, text)], beats [(time, lyric, action)], transition-out)
S = [
 ("Intro", "0:00–0:23", "Built · approved test", [
   ("0.8", "0:00", "Ignition", "The spark lights on frame 1 and races. The camera rides right behind it."),
   ("3.0", "0:02", "The sky fills", "One trail becomes dozens of shooting stars stitching the sky, then the camera dives back to the spark."),
   ("7.9", "0:07", "TIRED", "Every word is written by the spark as it's sung. TIRED sags asleep."),
   ("10.5", "0:10", "QUIT", "The spark draws the no-sign around QUIT itself."),
   ("14.5", "0:12–0:18", "DISAPPEAR", "Builds DIS · AP · PEAR. The spark burns out and the word drifts into the dark."),
   ("21.9", "0:20–0:23", "STOP · FOR A MINUTE", "Freeze, then the rip back: every line circling over the figure on the rooftop edge, the clock in the middle.")],
  [], "The clock face shrinks into the ceiling fan's hub; the second hand becomes a blade as the eyes open."),
 ("Verse 1", "0:23–0:52", "Gravity", [
   ("fan", "0:23", "ANOTHER MORNING", "Waking up under the same ceiling. The fan turns slowly. The spark is now a dust mote drifting in the sunbeam."),
   ("chest", "0:25", "PRESSURE · CHEST", "The room squeezes PRESSURE in from both walls on the beat. CHEST thumps like a heartbeat."),
   ("me", "0:30", "PIECE OF ME", "ME fills the screen. Strings yank a piece off on every beat. TIME gets pulled apart the same way."),
   ("weight", "0:33", "WEIGHT", "Sit up into the dark room. The words get heavier on the shelf; WEIGHT slams on the kick and cracks the concrete. The spark is the crack's first light."),
   ("void", "0:35–0:40", "MINE · BUILT A LIFE", "MINE falls through the crack and the camera dives after it. In the void: monuments built from LIFE and NAME, huge and cold."),
   ("disc", "0:40", "DISCONNECTED", "SUCCESS gleams, then DIS · CON · NECT · ED drift apart one syllable at a time."),
   ("wall", "0:46", "PAPER · WALL", "A wall of framed words: ACCOMPLISHMENTS, ACHIEVEMENTS. The camera tracks past fast."),
   ("break", "0:49–0:56", "DARKNESS · BREAK", "On NONE OF THAT GETS QUIET the frames drop one per beat and the lights die. DARKNESS swallows the room. Pre-chorus: the faint spark, then BREAK splits the dark open with light.")],
  [("0:24.2", "same ceiling", "The fan's shadow sweeps the words."),
   ("0:26.4", "telling me I'm blessed", "BLESSED repeats from every edge in small voices, the camera whips between them."),
   ("0:28.2", "struggling to rest", "STRUGGLING's letters can't line up; REST sinks like eyelids."),
   ("0:49.3", "none of that gets quiet", "Frames fall off the wall, one per beat.")],
  "Light pours through the crack in BREAK and becomes the chorus."),
 ("Chorus 1", "0:56–1:31", "Weightless", [
   ("drift", "0:57", "DRIFT", "Gravity switches off for the first time. Every heavy word lifts, warm light opens up, the spark leaves its path and floats free."),
   ("no", "1:08", "NO · NO · NO", "Each NO slams on the beat and the word after it shatters like glass into floating shards."),
   ("world", "1:15–1:31", "LEAVE THIS WORLD", "A small world falls away below as the camera floats up. BIT holds tiny and alone. On the long WANNA the stars stretch into highway lights.")],
  [("1:01.6", "float somewhere between the stars", "Words drift between real stars; STARS lights up as a constellation."),
   ("1:04.5", "forget about all this", "The heavy verse words float off and dissolve."),
   ("1:24.6", "I don't wanna… die", "Slow-motion on the held WANNA; the spark spirals.")],
  "Star streaks become the lane lines of a night highway."),
 ("Verse 2", "1:31–2:09", "Gravity · the drive", [
   ("road", "1:31", "NO DESTINATION", "Night highway, camera low on the asphalt. Lyrics are the road: signs, lane lines, a blank DESTINATION sign."),
   ("voicemail", "1:52", "FATHER · VOICEMAILS", "The car stops. A phone glows. The spark draws a voicemail waveform that plays as you sing. Everything slows. Emotional peak."),
   ("nothing", "2:04", "FEEL NOTHING", "On the held NOTHING the colour drains out of the whole frame until the word is barely there.")],
  [("1:33.5", "radio low, windows down", "A radio dial reads LOW; WINDOWS slide past."),
   ("1:35", "outrun the noise", "NOISE is static scribble chasing in the mirror; STICKS AROUND wraps around the car."),
   ("1:41", "people think I'm doing great", "GREAT on a billboard flying past."),
   ("1:46", "miles apart", "The camera pulls back miles; the letters of APART end up far from each other."),
   ("1:50", "questions with no replies", "Typing dots that never resolve."),
   ("1:58", "scars that keep me real", "SCARS glow like cracks of light in the road.")],
  "Pre-chorus: FOREVER stretches long, BREATHE pulses like a breath, the headlights become stars as the camera lifts off."),
 ("Pre-Chorus 2 · Chorus 2", "2:09–2:50", "Weightless, bigger", [
   ("breathe", "2:12", "BREATHE", "The spark pulses slow, like breathing. Headlights rise into stars."),
   ("spiral", "2:15–2:50", "DRIFT, wider", "Same release as chorus 1 but bigger: the spiral of every line so far floats around you. The NOs shatter again.")],
  [], "The long WANNA floats down to the rooftop."),
 ("Bridge", "2:50–3:12", "Still", [
   ("bridge", "2:58", "EVERYTHING EVERYBODY NEEDS", "The figure on the rooftop edge again. Words they carry are only outlines, invisible to anyone else, stacking up into the sky."),
   ("peace", "3:01–3:12", "PEACE", "FIXING's scaffolding falls away. PEACE alone in stillness. ONE NIGHT is the night sky; ASK FOR ME fades out.")],
  [("2:50", "tired of carrying things nobody else can see", "Outlined words only SEE reveals."),
   ("3:09", "where the world doesn't ask for me", "The city lights below go out one by one.")],
  "A phone buzzes in the dark."),
 ("Breakdown", "3:12–3:22", "Biggest contrast", [
   ("notif", "3:12", "NO PHONE RINGING…", "Notifications flood the screen, buzzing and stacking. Each NO wipes a layer away."),
   ("silence", "3:19.8", "JUST SILENCE", "Everything drops to black with one small word."),
   ("breathe", "3:21.2", "JUST BREATHING", "The spark comes back, pulsing like a breath.")],
  [("3:14", "no notifications", "One wipe per NO, on the beat."),
   ("3:17", "no proving myself · no pretending", "The last layers peel off.")],
  "The breath swells into the final chorus."),
 ("Final Chorus", "3:22–3:47", "The biggest float", [
   ("final", "3:27", "THE PAST CAN'T REACH", "Every word from the whole story floats together, warm. GUILT's searchlight misses. PAST reaches and falls short. MYSELF echoes back. NOISE sinks below."),
   ("tonight", "3:41–3:47", "BUT TONIGHT", "STRONGER lands solid and stays. TONIGHT holds. DRIFT floats out wide.")],
  [("3:36", "when I'm ready", "READY settles."),
   ("3:38", "I'll come back stronger", "STRONGER in stone, the one heavy word that stands.")],
  "The camera drifts down into the dark room from verse 1."),
 ("Outro", "3:47–4:24", "Rebuild · loop", [
   ("build", "3:50", "KEEP BUILDING", "FIGHTING throws sparks. On BUILDING the spark rebuilds the broken shelf plank by plank. WEIGHT returns, and this time the shelf holds."),
   ("loop", "4:02–4:24", "LET ME DRIFT", "The spark floats off into the dark. The last frame matches the first, so the video loops on Reels and TikTok.")],
  [("3:47.5", "tomorrow I'll keep fighting", "Sparks fly off the spark."),
   ("3:52.8", "keep carrying the weight", "The shelf takes WEIGHT and holds."),
   ("3:56.8", "but tonight…", "Held for 5 seconds: the room goes dark around the spark.")],
  "Loop: the final frame is the spark igniting in the dark."),
]
RULES = [
 ("The spark is you", "One light carries through the whole video: dust in the sunbeam, the crack's first light, free in the chorus, rebuilding the shelf, last thing on screen."),
 ("Scenes turn into each other", "Clock into fan, burnt-out spark into a blink, the crack into the void into the chorus sky, stars into highway lights. No hard cuts between worlds."),
 ("Heavy verses, weightless choruses", "In verses gravity wins: words fall, break, weigh things down. On “I just wanna drift” gravity switches off."),
 ("Amber is the word being sung", "The type stays flat and crisp. Only the spark glows; the sung word is hot amber, then cools to white."),
 ("Something new every 2–3 s", "A new angle, object or scene change. The camera never parks."),
 ("Camera follows the singing", "Held notes ease into slow motion; fast lines get quicker moves and whips. Every beat gives the camera a small punch."),
 ("The bass moves the world", "Stars, dust, the fan, the strings, the shelf and the car all react to the kick and the bass."),
 ("It loops", "The last frame matches the first: the spark igniting in the dark."),
 ("Phone-safe", "Key words stay clear of the Reels/TikTok buttons on the right and the caption area at the bottom."),
]

def frame(vis, t, title, text):
    v = img(vis) if vis[0].isdigit() else SK[vis]
    return f'<figure class="fr"><div class="fimg">{v}</div><figcaption><span class="t">{t}</span><strong>{html.escape(title)}</strong><p>{html.escape(text)}</p></figcaption></figure>'

secs = []
for name, rng_, mode, frames, beats, trans in S:
    mclass = "w" if "Weightless" in mode or "float" in mode else "g" if "Gravity" in mode else "b" if "Built" in mode else "s"
    b = ""
    if beats:
        b = '<ul class="beats">' + "".join(f'<li><span class="t">{t}</span><span class="ly">“{html.escape(l)}”</span><span>{html.escape(a)}</span></li>' for t, l, a in beats) + "</ul>"
    secs.append(f'''<section class="sec" id="{name.split()[0].lower()}">
  <header><h2>{html.escape(name)}</h2><span class="t">{rng_}</span><span class="mode {mclass}">{html.escape(mode)}</span></header>
  <div class="frames">{"".join(frame(*f) for f in frames)}</div>
  {b}
  <p class="trans"><span>Into the next scene</span>{html.escape(trans)}</p>
</section>''')

rules = "".join(f'<div><h3>{html.escape(h)}</h3><p>{html.escape(p)}</p></div>' for h, p in RULES)
page = f'''<title>Drift Full Storyboard</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<style>
/* Layout: one dark column, the video's world. A rule grid up top, then each section: header, a row of 9:16 frames, a beat list, the transition into the next scene. Single dark theme on purpose. */
:root {{
  --bg:#09090a; --panel:#131211; --line:#2a2723; --ink:#efede9; --muted:#8d877e; --stone:#c4b6a2; --amber:#ff7a2c; --float:#e8b58a;
  --display:"Bebas Neue","Oswald","Arial Narrow",sans-serif; --body:"IBM Plex Sans",system-ui,sans-serif; --mono:"IBM Plex Mono",ui-monospace,monospace;
  color-scheme:dark;
}}
* {{ box-sizing:border-box; }}
body {{ background:var(--bg); color:var(--ink); font:15px/1.55 var(--body); margin:0; }}
.wrap {{ max-width:1180px; margin:0 auto; padding-left:max(16px,env(safe-area-inset-left,0px)); padding-right:max(16px,env(safe-area-inset-right,0px)); padding-block:40px 90px; display:grid; gap:56px; }}
h1,h2,h3 {{ font-family:var(--display); font-weight:400; letter-spacing:.02em; margin:0; text-wrap:balance; }}
h1 {{ font-size:clamp(60px,13vw,132px); line-height:.86; }}
h1 em {{ font-style:normal; color:var(--amber); }}
h2 {{ font-size:46px; line-height:1; }}
h3 {{ font-size:22px; line-height:1.05; color:var(--stone); }}
p {{ margin:0; max-width:68ch; }}
.eyebrow {{ font:500 12px var(--mono); letter-spacing:.14em; text-transform:uppercase; color:var(--stone); }}
.stack {{ display:grid; gap:14px; }}
.lead {{ font-size:18px; color:#d6d2cb; max-width:58ch; }}
.rules {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:1px; background:var(--line); border:1px solid var(--line); }}
.rules div {{ background:var(--bg); padding:16px; display:grid; gap:6px; align-content:start; }}
.rules p {{ font-size:14px; color:#cfcac2; }}
.sec {{ display:grid; gap:20px; border-top:1px solid var(--line); padding-top:22px; }}
.sec > header {{ display:flex; flex-wrap:wrap; align-items:baseline; gap:8px 16px; }}
.t {{ font:12px var(--mono); color:var(--muted); font-variant-numeric:tabular-nums; }}
.mode {{ font:500 11px var(--mono); letter-spacing:.12em; text-transform:uppercase; padding:3px 8px; border:1px solid var(--line); color:var(--muted); }}
.mode.w {{ color:var(--bg); background:var(--float); border-color:var(--float); }}
.mode.g {{ color:var(--stone); border-color:var(--stone); }}
.mode.b {{ color:var(--bg); background:var(--ink); border-color:var(--ink); }}
.frames {{ display:grid; grid-template-columns:repeat(auto-fill,minmax(190px,1fr)); gap:22px 16px; }}
.fr {{ margin:0; display:grid; gap:10px; align-content:start; min-width:0; }}
.fimg {{ aspect-ratio:9/16; max-width:100%; border:1px solid var(--line); overflow:hidden; background:#000; }}
.fimg img, .fimg svg {{ display:block; width:100%; height:100%; object-fit:cover; }}
.sw {{ font-family:var(--display); letter-spacing:.04em; }}
.fr figcaption {{ display:grid; gap:4px; }}
.fr strong {{ font:24px/1 var(--display); font-weight:400; letter-spacing:.03em; }}
.fr p {{ font-size:14px; color:#d6d2cb; }}
.beats {{ list-style:none; margin:0; padding:0; display:grid; gap:0; border-top:1px solid var(--line); }}
.beats li {{ display:grid; grid-template-columns:72px minmax(0,1.1fr) minmax(0,1.6fr); gap:6px 16px; padding:10px 0; border-bottom:1px solid var(--line); font-size:14px; }}
.beats .ly {{ color:var(--stone); }}
@media (max-width:640px) {{ .beats li {{ grid-template-columns:64px minmax(0,1fr); }} .beats li span:last-child {{ grid-column:2; color:#cfcac2; }} }}
.trans {{ display:flex; flex-wrap:wrap; gap:6px 12px; align-items:baseline; font-size:14px; color:#cfcac2; max-width:none; }}
.trans span {{ font:500 11px var(--mono); letter-spacing:.12em; text-transform:uppercase; color:var(--amber); }}
nav {{ display:flex; flex-wrap:wrap; gap:6px 14px; font:12px var(--mono); }}
nav a {{ color:var(--muted); text-decoration:none; border-bottom:1px solid var(--line); }}
nav a:hover, nav a:focus-visible {{ color:var(--ink); outline:none; border-color:var(--amber); }}
</style>
{DEFS}
<div class="wrap">
  <header class="stack">
    <span class="eyebrow">RUDO · Drift · full storyboard · 4:24 · 1080×1920</span>
    <h1>A spark<br>writes <em>Drift</em></h1>
    <p class="lead">The whole song in the direction you approved from the intro test. The spark is you. Gravity pulls the verses down; the choruses let go. Intro frames are from the real render; the rest are sketches for the shots.</p>
    <nav aria-label="Sections">{"".join(f'<a href="#{n.split()[0].lower()}">{html.escape(n)} · {r}</a>' for n, r, *_ in S)}</nav>
  </header>
  <section class="stack" aria-label="Rules for the whole video">
    <span class="eyebrow">Rules for every section</span>
    <div class="rules">{rules}</div>
  </section>
  {"".join(secs)}
</div>
'''
open(f"{ROOT}/creative/storyboard-full.html", "w").write(page)
print(len(page))
