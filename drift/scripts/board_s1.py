"""Section 1 storyboard (POV: lying on your back, looking up) -> creative/storyboard-s1.html"""
import sys, html, math, random
sys.path.insert(0, "scripts")
from sketches import F, INK, STONE, HOT, MUTED, W, H

def starword(f, x, y, t, size, o=1, anchor="middle", rot=0, dim=False):
    c = HOT if not dim else INK
    f.add(f'<text x="0" y="0" transform="translate({x} {y}) rotate({rot})" font-family="Bebas Neue, Oswald, sans-serif" font-size="{size}" text-anchor="{anchor}" fill="none" stroke="#ffe9cf" stroke-width="{size*0.06:.2f}" stroke-dasharray="0.1 {size*0.07:.2f}" stroke-linecap="round" opacity="{0.35*o}" filter="url(#{f.id}s)">{t}</text>')
    return f.add(f'<text x="0" y="0" transform="translate({x} {y}) rotate({rot})" font-family="Bebas Neue, Oswald, sans-serif" font-size="{size}" text-anchor="{anchor}" fill="none" stroke="{c}" stroke-width="{size*0.035:.2f}" stroke-dasharray="0.1 {size*0.07:.2f}" stroke-linecap="round" opacity="{o}">{t}</text>')
def solid(f, x, y, t, size, fill=INK, o=1, sx=1, sy=1, rot=0):
    return f.text(x, y, t, size, fill, o=o, sx=sx, sy=sy, rot=rot)
def roof(f, o=1):
    f.add(f'<path d="M0 455 L80 445 L270 452 L270 480 L0 480 Z" fill="#000" opacity="{o}"/>')
    return f.line(0, 455, 80, 445, MUTED, 0.6, 0.4).line(80, 445, 270, 452, MUTED, 0.6, 0.4)
def lids(f, k):
    # eyelids closing: k 0 open .. 1 closed
    top = 240 * k; bot = 480 - 240 * k
    f.add(f'<path d="M0 0 H270 V{top - 30} Q135 {top + 30} 0 {top - 30} Z" fill="#000" opacity="0.92"/>')
    return f.add(f'<path d="M0 480 H270 V{bot + 30} Q135 {bot - 30} 0 {bot + 30} Z" fill="#000" opacity="0.92"/>')
def timer(f, s="0:00", p=0.0):
    f.add(f'<circle cx="236" cy="40" r="15" fill="none" stroke="{INK}" stroke-width="1" opacity="0.25"/>')
    a = p * 2 * math.pi
    if p > 0: f.add(f'<path d="M236 25 A15 15 0 {1 if p > 0.5 else 0} 1 {236 + 15 * math.sin(a):.1f} {40 - 15 * math.cos(a):.1f}" fill="none" stroke="{INK}" stroke-width="1.4"/>')
    return f.text(236, 43, s, 8, INK, font="mono", o=0.9)
def ceiling(f, o=1, drop=0):
    f.add(f'<rect width="270" height="480" fill="#1a1816" opacity="{o}"/>')
    for i in range(7): f.line(0, 40 + i * 70 + drop * (i - 3) * 2, 270, 40 + i * 70 + drop * (i - 3) * 2, STONE, 0.6, 0.18 * o)
    for i in range(5): f.line(i * 67, 0, i * 67 + (i - 2) * drop * 3, 480, STONE, 0.6, 0.12 * o)
    f.add(f'<rect x="95" y="60" width="80" height="16" fill="{HOT}" opacity="{0.35 * o}"/>')
    return f.hot(135, 68, 34, 0.25 * o)
def strings(f, cx, cy, pts):
    for (x, y) in pts: f.line(cx + (x - cx) * 0.18, cy + (y - cy) * 0.18, x, y, INK, 0.9, 0.7)
    return f

def frames():
    out = []
    f = F("a1").stars(170, 1).add('<rect width="270" height="480" fill="#000" opacity="0.35"/>'); roof(f)
    out.append(("0:00", "Night opens", "Black. The stars fade up slowly. A dark rooftop edge at the very bottom of the frame tells you where you are: lying on your back, looking up.", f))
    f = F("a2").stars(170, 1); roof(f); starword(f, 135, 230, "YEAH", 44, 0.45)
    out.append(("0:04", "YEAH", "The sky takes a breath. YEAH glows faintly between the stars and fades with the exhale. Nothing else moves.", f))
    f = F("a3").stars(170, 1); roof(f); starword(f, 135, 150, "YOU EVER GET SO", 20); starword(f, 160, 230, "TIRED", 26, 0.5, rot=-8); lids(f, 0.28)
    out.append(("0:06–0:08", "TIRED", "YOU EVER GET SO forms one word at a time, like constellations. TIRED sinks deeper into the sky, smaller and fainter, and the frame's edges close in slowly like heavy eyelids.", f))
    f = F("a4").stars(170, 2); roof(f); starword(f, 135, 150, "YOU DON'T WANT TO", 19); starword(f, 135, 255, "QUIT", 52)
    f.add('<circle cx="135" cy="238" r="58" fill="none" stroke="#fff4e6" stroke-width="2.2" stroke-dasharray="0.1 5" stroke-linecap="round"/>').line(94, 197, 176, 279, HOT, 2, 0.9, "0.1 5")
    out.append(("0:09", "QUIT", "QUIT, with a no-sign drawn around it in stars: the circle, then the slash.", f))
    f = F("a5").stars(170, 3); roof(f); starword(f, 135, 150, "YOU DON'T WANT TO", 19); starword(f, 135, 250, "DISAPP", 42, 0.6, anchor="end", rot=0); f.add('<g opacity="0.15">'); starword(f, 135, 250, "EAR", 42, 1, anchor="start"); f.add('</g>')
    out.append(("0:11", "DISAPPEAR", "DISAPPEAR's stars go out one by one, left to right, until the sky is just sky again.", f))
    f = F("a6").stars(220, 4, o=0.6)
    for (x, y, t_, s) in [(70, 70, "YEAH", 11), (190, 110, "TIRED", 12), (60, 170, "QUIT", 14), (200, 215, "DISAPPEAR", 10), (120, 290, "EVERYTHING", 13)]: starword(f, x, y, t_, s, 0.7)
    f.add('<circle cx="60" cy="166" r="13" fill="none" stroke="#fff4e6" stroke-width="0.8" opacity="0.6"/>'); starword(f, 135, 380, "STOP", 46)
    out.append(("0:18", "STOP", "On STOP the camera pulls out fast. Every line so far turns out to be a constellation in one big sky, a star map of the whole intro. It holds for a moment.", f))
    f = F("a7").stars(170, 5); roof(f); starword(f, 135, 210, "FOR A", 18); starword(f, 135, 260, "MINUTE", 40); timer(f, "0:00", 0.02)
    out.append(("0:19.4", "FOR A MINUTE", "Back in close. A small ring timer pops up in the top corner and starts counting. It runs one real minute and completes on 'I just wanna drift' at about 1:20.", f))
    f = F("a8").stars(120, 6, o=0.35)
    f.add('<defs><linearGradient id="dawn" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#e8c9a0" stop-opacity="0.75"/><stop offset="0.45" stop-color="#6b5a4a" stop-opacity="0.25"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient></defs><rect width="270" height="480" fill="url(#dawn)"/>')
    roof(f); solid(f, 135, 240, "ANOTHER", 18, INK, 0.8); solid(f, 135, 300, "MORNING", 50, STONE); timer(f, "0:03", 0.05)
    out.append(("0:21–0:23", "ANOTHER MORNING", "Dawn floods up from the rooftop edge and the stars fade out. The words stop being made of stars: from here on they're solid and heavy.", f))
    f = F("a9"); ceiling(f); solid(f, 135, 200, "SAME", 18, INK, 0.8); solid(f, 135, 250, "CEILING", 40, INK); timer(f, "0:04", 0.07)
    out.append(("0:23.7", "SAME CEILING", "The sky is gone. Still lying on your back, you're looking at the same bedroom ceiling as every morning. The stars were the escape.", f))
    f = F("a10"); ceiling(f, 1, 6); solid(f, 135, 200, "SAME", 16, INK, 0.7); solid(f, 135, 255, "PRESSURE", 44, STONE, sx=0.8, sy=0.62); solid(f, 110, 320, "ON MY", 16, INK, 0.8)
    f.ripples(135, 370, 3, 18, 10, STONE, 0.5); solid(f, 135, 378, "CHEST", 30, INK); timer(f, "0:05", 0.08)
    out.append(("0:24–0:26", "PRESSURE · CHEST", "The ceiling lowers. PRESSURE is squeezed from every side and trembles. CHEST beats like a heart, a double pulse on each beat.", f))
    f = F("a11"); ceiling(f, 0.85)
    for (x, y, t_, r) in [(30, 90, "PEOPLE", 35), (240, 120, "TELLING", -35), (40, 380, "ME", -30), (235, 360, "I'M", 30)]: solid(f, x, y, t_, 16, INK, 0.8, rot=r)
    for k in range(4): solid(f, 135 + (k - 1.5) * 14, 245 + (k - 1.5) * 8, "BLESSED", 38, STONE, 0.15)
    solid(f, 135, 245, "BLESSED", 38, STONE); timer(f, "0:07", 0.12)
    out.append(("0:26–0:27", "PEOPLE TELLING ME I'M BLESSED", "The other words lean in from the edges of the frame, the way faces look down at someone lying in bed. BLESSED is said by several voices at once: out-of-sync copies close in and become one word.", f))
    f = F("a12"); ceiling(f, 0.8); solid(f, 135, 160, "WHILE I'M", 16, INK, 0.8)
    for i, ch in enumerate("STRUGGLING"): solid(f, 52 + i * 18, 225 + ((i * 37) % 9 - 4) * 3, ch, 30, INK, rot=((i * 53) % 21 - 10))
    solid(f, 135, 285, "TO", 14, INK, 0.8); solid(f, 135, 340, "REST", 40, STONE); lids(f, 0.12); timer(f, "0:08", 0.14)
    out.append(("0:27–0:29", "STRUGGLING TO REST", "STRUGGLING's letters keep trying to become one word and slipping apart. On REST the eyelids start to close but snap back open: no rest.", f))
    f = F("a13"); ceiling(f, 0.7); solid(f, 135, 120, "EVERYBODY", 30, INK); solid(f, 135, 150, "NEEDS A PIECE OF", 15, INK, 0.85); solid(f, 135, 285, "ME", 120, INK)
    strings(f, 135, 250, [(0, 150), (270, 190), (0, 400), (270, 420), (60, 480), (220, 480), (0, 270)]); timer(f, "0:11", 0.18)
    out.append(("0:29.8–0:31", "EVERYBODY / NEEDS A PIECE OF / ME", "Stacked: EVERYBODY, then NEEDS A PIECE OF, then ME, very big. Lines shoot in from every edge of the frame, hook into ME on the beats and yank pieces of it off in different directions.", f))
    f = F("a14"); ceiling(f, 0.7); solid(f, 135, 150, "EVERYBODY WANTS MY", 16, INK, 0.85); solid(f, 135, 250, "TIME", 60, INK, 0.9)
    strings(f, 135, 235, [(0, 200), (270, 260), (120, 480)]); timer(f, "0:12", 0.2); f.line(236, 40, 270, 0, INK, 0.9, 0.7)
    out.append(("0:31.7", "EVERYBODY WANTS MY TIME", "TIME gets hooked and pulled the same way, and so does the little timer in the corner: even the minute he asked for is being taken.", f))
    f = F("a15")
    f.add('<rect width="270" height="480" fill="#1a1816"/>'); f.line(0, 300, 270, 300, MUTED, 0.6, 0.4)
    f.add(f'<rect x="10" y="160" width="250" height="8" fill="{STONE}" opacity="0.7"/>'); solid(f, 40, 155, "I'M", 10, INK); solid(f, 90, 155, "CARRYING", 16, INK)
    f.text(135, 60, "↓ sits up", 12, MUTED, font="mono")
    out.append(("0:32", "Sitting up", "The camera tilts down from the ceiling to the wall as if sitting up in bed, and finds the shelf. The approved shelf sequence plays: I'M CARRYING SO MUCH WEIGHT.", f))
    f = F("a16"); f.add('<rect width="270" height="480" fill="#1a1816"/>'); f.line(0, 250, 270, 250, MUTED, 0.6, 0.5)
    solid(f, 140, 300, "WEIGHT", 54, STONE)
    for i in range(14): f.line(140, 305, 140 + math.cos(i) * 110, 305 + abs(math.sin(i)) * 60, "#000", 1.2, 0.8)
    out.append(("0:34.4", "WEIGHT", "WEIGHT slams into the concrete on the kick and the floor cracks (approved).", f))
    f = F("a17"); f.add('<rect width="270" height="480" fill="#1a1816"/>'); f.line(0, 200, 270, 200, MUTED, 0.6, 0.5)
    solid(f, 135, 150, "I FORGOT WHAT'S ACTUALLY", 16, INK, 0.85); solid(f, 150, 330, "WEIGHT", 54, STONE, 0.6)
    for (x, y) in [(70, 380), (96, 392), (120, 400), (188, 394), (212, 382)]: f.add(f'<polygon points="{x},{y} {x+9},{y-6} {x+14},{y+3} {x+4},{y+8}" fill="#5a5550"/>')
    solid(f, 118, 404, "mine", 12, HOT, font="hand") if False else f.text(110, 408, "MINE", 11, HOT); f.hot(118, 404, 14, 0.5)
    out.append(("0:34.4–0:36", "I FORGOT WHAT'S ACTUALLY MINE", "Same physical logic as the shelf. The words drop in among the rubble, and the camera searches the cracked floor and finds MINE, tiny and half buried under the debris, the one small thing that's his. It glows faintly, the first warm light since the stars.", f))
    return out

FR = frames()
cards = "".join(f'<figure class="fr"><div class="fimg">{f.svg()}</div><figcaption><span class="n">{k+1}</span><span class="t">{html.escape(t)}</span><strong>{html.escape(name)}</strong><p>{html.escape(d)}</p></figcaption></figure>' for k, (t, name, d, f) in enumerate(FR))
tpl = open("scripts/storyboard.tpl.html").read()
head = tpl[:tpl.index('<div class="wrap">')]
head = head.replace("<title>Drift Storyboard</title>", "<title>Drift Intro Storyboard</title>")
page = head + f'''<div class="wrap">
  <header class="stack">
    <span class="eyebrow">RUDO · Drift · Section 1 storyboard · 0:00–0:36</span>
    <h1>Looking up</h1>
    <p class="thesis">We are the person lying on their back. No figure on screen; the camera is their eyes. Night: the lyrics form in the sky like constellations. Morning: the sky turns into the same bedroom ceiling, and the words become solid and heavy. At 0:32 they sit up and face the wall with the shelf.</p>
  </header>
  <section class="stack">
    <h2>The journey</h2>
    <div class="throughline">
      <div><h3>Night · 0:00–0:21</h3><p>Rooftop, stars, lying on your back. Words are made of stars: light, distant, drifting. TIRED sinks away, QUIT is refused, DISAPPEAR goes out, STOP pulls back to the whole sky.</p></div>
      <div><h3>Dawn · 0:21–0:23</h3><p>MORNING floods the sky with light and the stars fade. The escape is over.</p></div>
      <div><h3>Ceiling · 0:23–0:32</h3><p>Same POV, now a bedroom ceiling. Solid words, gravity, pressure. People lean in, pieces of ME are pulled away, even the minute is taken.</p></div>
      <div><h3>Up · 0:32–0:36</h3><p>Sitting up to face the wall: the shelf, WEIGHT through the floor, and MINE found small in the rubble.</p></div>
    </div>
  </section>
  <section class="stack">
    <h2>Frames</h2>
    <p class="lead">Rough sketches of composition and motion. The final look is the clean, calm style from the draft: solid type, lots of dark space, one effect per line.</p>
    <div class="frames">{cards}</div>
  </section>
</div>
'''
open("creative/storyboard-s1.html", "w").write(page)
print("ok", len(FR))
