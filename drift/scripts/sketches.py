"""Storyboard sketch frames as inline SVG (9:16, viewBox 270x480). Line drawings in the video's
language: hot point of light, contour lines, condensed type, grey/stone."""
import math, random
INK, STONE, HOT, DRIFT, GHOST, MUTED, BG = "#efede9", "#c4b6a2", "#fff4e6", "#a9b7c4", "rgba(239,237,233,0.18)", "#8d877e", "#0b0a09"
W, H = 270, 480

class F:
    def __init__(s, fid): s.id, s.parts, s.defs = fid, [], []
    def add(s, x): s.parts.append(x); return s
    def svg(s):
        d = f'''<defs><radialGradient id="{s.id}h"><stop offset="0" stop-color="#fff" stop-opacity="1"/><stop offset=".25" stop-color="#fff1dd" stop-opacity=".8"/><stop offset="1" stop-color="#ffd9a8" stop-opacity="0"/></radialGradient>
<filter id="{s.id}b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
<filter id="{s.id}s" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2"/></filter>{"".join(s.defs)}</defs>'''
        return f'<svg viewBox="0 0 {W} {H}" class="sk" role="img" aria-hidden="true"><rect width="{W}" height="{H}" fill="{BG}"/>{d}{"".join(s.parts)}</svg>'
    # primitives
    def hot(s, x, y, r=14, o=1): return s.add(f'<circle cx="{x}" cy="{y}" r="{r}" fill="url(#{s.id}h)" opacity="{o}"/>')
    def text(s, x, y, t, size=60, fill=INK, anchor="middle", rot=0, sx=1, sy=1, o=1, font="display", ls=0, stroke=None, sw=1):
        fam = {"display": "Bebas Neue, Oswald, Arial Narrow, sans-serif", "hand": "Caveat, cursive", "mono": "IBM Plex Mono, monospace", "body": "IBM Plex Sans, sans-serif"}[font]
        st = f' stroke="{stroke}" stroke-width="{sw}"' if stroke else ""
        return s.add(f'<text x="0" y="0" transform="translate({x} {y}) rotate({rot}) scale({sx} {sy})" font-family="{fam}" font-size="{size}" fill="{fill}" text-anchor="{anchor}" opacity="{o}" letter-spacing="{ls}"{st}>{t}</text>')
    def line(s, x1, y1, x2, y2, c=INK, w=1, o=1, dash=None):
        da = f' stroke-dasharray="{dash}"' if dash else ""
        return s.add(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{c}" stroke-width="{w}" opacity="{o}" stroke-linecap="round"{da}/>')
    def path(s, d, c=INK, w=1.5, o=1, fill="none", blur=False):
        f = f' filter="url(#{s.id}s)"' if blur else ""
        return s.add(f'<path d="{d}" stroke="{c}" stroke-width="{w}" fill="{fill}" opacity="{o}" stroke-linecap="round" stroke-linejoin="round"{f}/>')
    def glowpath(s, d, w=2):
        s.path(d, "#ffe9cf", w * 4, 0.35, blur=True); return s.path(d, HOT, w)
    def stars(s, n, seed, x0=0, y0=0, x1=W, y1=H, o=1):
        r = random.Random(seed)
        for _ in range(n):
            x, y, k = r.uniform(x0, x1), r.uniform(y0, y1), r.random()
            s.add(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{0.4 + k * 1.2:.2f}" fill="{HOT if k > 0.85 else INK}" opacity="{(0.25 + k * 0.6) * o:.2f}"/>')
        return s
    def figure(s, cx, cy, sc=1, pose="stand", o=1, lines=28, c=INK):
        """RUDO as contour lines clipped to a silhouette (the 3D contour model, sketched)."""
        P = {
         "stand": "M0 -95 a15 17 0 1 1 0.1 0 M-8 -62 C-28 -60 -38 -50 -40 -20 L-44 30 L-34 32 L-28 -8 L-24 40 L-22 110 L-6 110 L0 50 L6 110 L22 110 L24 40 L28 -8 L34 32 L44 30 L40 -20 C38 -50 28 -60 8 -62 Z",
         "float": "M0 -95 a15 17 0 1 1 0.1 0 M-8 -62 C-30 -60 -48 -56 -66 -70 L-70 -62 C-52 -44 -36 -40 -28 -30 L-26 30 L-34 100 L-20 104 L0 46 L16 96 L30 92 L24 30 L28 -30 C36 -40 52 -44 70 -62 L66 -70 C48 -56 30 -60 8 -62 Z",
         "sit": "M-2 -78 a15 17 0 1 1 0.1 0 M-10 -46 C-34 -42 -40 -20 -36 10 L-10 22 L30 4 L44 46 L60 44 L46 -6 C40 -18 20 -14 8 -10 C14 -30 10 -44 6 -46 Z M-36 10 L-40 30 L40 30 Z",
         "carry": "M0 -60 a15 17 0 1 1 0.1 0 M-8 -28 C-28 -26 -38 -16 -40 6 L-44 30 L-34 32 L-28 10 L-24 50 L-24 120 L-8 120 L0 64 L6 120 L22 120 L24 50 L28 10 L34 32 L44 30 L40 6 C38 -16 28 -26 8 -28 Z M-46 -50 L-40 -32 L40 -32 L46 -50 Z",
        }[pose]
        cid = f"{s.id}c{len(s.defs)}"
        s.defs.append(f'<clipPath id="{cid}"><path d="{P}" transform="translate({cx} {cy}) scale({sc})"/></clipPath>')
        g = [f'<g clip-path="url(#{cid})" opacity="{o}">']
        top, bot = cy - 115 * sc, cy + 125 * sc
        for i in range(lines):
            y = top + (bot - top) * i / (lines - 1)
            wob = " ".join(f"{cx - 80 * sc + k * 8 * sc:.1f},{y + math.sin(k * 0.7 + i) * 1.6 * sc:.1f}" for k in range(21))
            g.append(f'<polyline points="{wob}" fill="none" stroke="{c}" stroke-width="{0.9}" opacity="{0.55 + 0.45 * (i % 3 == 0)}"/>')
        g.append("</g>")
        s.add("".join(g))
        return s.add(f'<path d="{P}" transform="translate({cx} {cy}) scale({sc})" fill="none" stroke="{c}" stroke-width="{0.7 / sc:.2f}" opacity="{0.5 * o}"/>')
    def globe(s, cx, cy, r, c=INK, o=1, spin=0.3):
        s.add(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="{c}" stroke-width="1.2" opacity="{o}"/>')
        for k in range(-3, 4):
            yy = cy + r * k / 4; rr = math.sqrt(max(0, r * r - (yy - cy) ** 2))
            s.add(f'<ellipse cx="{cx}" cy="{yy:.1f}" rx="{rr:.1f}" ry="{rr * 0.18:.1f}" fill="none" stroke="{c}" stroke-width=".7" opacity="{0.6 * o}"/>')
        for k in range(6):
            a = (k / 6 + spin) * math.pi
            s.add(f'<ellipse cx="{cx}" cy="{cy}" rx="{abs(math.cos(a)) * r:.1f}" ry="{r}" fill="none" stroke="{c}" stroke-width=".7" opacity="{0.6 * o}"/>')
        return s
    def ripples(s, cx, cy, n, r0, dr, c=INK, o=1):
        for i in range(n): s.add(f'<circle cx="{cx}" cy="{cy}" r="{r0 + i * dr}" fill="none" stroke="{c}" stroke-width="1" opacity="{o * (1 - i / n):.2f}"/>')
        return s
    def smoke(s, pts, o=0.6):
        for (x, y, r) in pts: s.add(f'<circle cx="{x}" cy="{y}" r="{r}" fill="#3a3631" opacity="{o}" filter="url(#{s.id}b)"/>')
        return s
    def floor(s, y, n=12, o=0.35, c=INK):
        for i in range(n):
            yy = y + (H - y) * (i / n) ** 1.8
            s.line(0, yy, W, yy, c, 0.7, o)
        for k in range(-8, 9):
            s.line(W / 2 + k * 6, y, W / 2 + k * 60, H, c, 0.6, o * 0.8)
        return s
    def cap(s, t, y=420, size=13, o=0.7):
        return s.text(W / 2, y, t, size, MUTED, font="body", o=o)

def frames():
    out = []
    # 1 YEAH
    f = F("f1"); f.hot(135, 250, 60, 0.9).ripples(135, 250, 4, 30, 18, HOT, 0.25).cap("Yeah…", 330)
    out.append(("0:04.2", "Intro", "YEAH", "Black. One hot point swells and fades with the breath. The point is the narrator of the whole film.", f))
    # 2 QUIT / DISAPPEAR
    f = F("f2"); f.floor(330, 8, 0.12).text(135, 180, "QUIT", 110, INK, sy=1.3).line(40, 200, 230, 110, HOT, 3).hot(230, 110, 16)
    f.text(135, 300, "DISAPPEAR", 52, "none", stroke=INK, sw=0.8, o=0.6).text(70, 300, "DISA", 52, INK, anchor="end", o=0.0)
    f.cap("You don't want to quit / disappear", 420)
    out.append(("0:09.0 → 0:11.3", "Intro", "QUIT · DISAPPEAR", "QUIT is cut by one hot line and stays on screen, refused. DISAPPEAR thins from solid to bare contour across the rising note, then comes back as a ghost.", f))
    # 3 STOP → MINUTE
    f = F("f3"); f.stars(60, 3, o=0.35).text(135, 230, "STOP", 150, INK, sy=1.25)
    for x in (20, 250):
        f.line(x, 40, x, 60, MUTED, 3).line(x + (8 if x < 100 else -8), 40, x + (8 if x < 100 else -8), 60, MUTED, 3)
    f.add(f'<circle cx="135" cy="345" r="38" fill="none" stroke="{INK}" stroke-width="1.4" opacity=".7"/>').line(135, 345, 135, 315, HOT, 2).hot(135, 315, 8).cap("everything to stop / for a minute", 420)
    out.append(("0:18.0", "Intro", "STOP → MINUTE", "First hit. Dust, grain and the point all freeze for the held STOP. The frozen frame turns into a clock; one tick and the world restarts.", f))
    # 4 PRESSURE (ceiling)
    f = F("f4")
    pts = "0,0 270,0 270,150 0,150"
    f.add(f'<polygon points="{pts}" fill="#1d1a16"/>')
    for i in range(14): f.line(0, 10 + i * 10, 270, 10 + i * 10, STONE, 0.7, 0.35)
    f.line(0, 150, 270, 150, HOT, 2).hot(30, 150, 10)
    for i, o in enumerate((0.5, 0.32, 0.18)): f.text(60 + i * 75, 40 + i * 4, "SAME", 26, INK, o=o)
    f.text(135, 192, "PRESSURE", 54, STONE, sx=1.3, sy=0.55).floor(300, 10, 0.18).text(135, 236, "ON MY CHEST", 22, INK, sx=1.4, sy=0.5, o=0.55)
    out.append(("0:24.4", "Verse 1", "SAME · PRESSURE", "The cover's room seen from the floor, empty. The ceiling is a stone contour slab that lowers on each kick. SAME stamps, greyer each time; PRESSURE is squashed flat, bulging sideways.", f))
    # 5 WEIGHT
    f = F("f5").floor(330, 10, 0.2)
    f.add(f'<g transform="rotate(-3 135 260)"><rect x="40" y="200" width="190" height="120" fill="#2b2722" stroke="{STONE}" stroke-width="1"/>')
    for i in range(10): f.line(40, 210 + i * 11, 230, 210 + i * 11, STONE, 0.5, 0.4)
    f.add("</g>").text(135, 290, "WEIGHT", 92, STONE, sy=1.1, rot=-3)
    for x in (30, 60, 210, 240): f.line(x, 330, x + (-14 if x < 135 else 14), 345, INK, 1, 0.5)
    f.text(190, 312, "mine", 18, HOT, font="hand", rot=-3).hot(208, 306, 7).cap("I'm carrying so much weight", 420)
    out.append(("0:33.0", "Verse 1", "WEIGHT · MINE", "The stone block drops on the kick and the frame jolts down. While 'mine' is held (1.6 s), the hot point carves it into the block, small. This block comes back three more times.", f))
    # 6 DISCONNECTED → PAPER → WALL → DARKNESS
    f = F("f6")
    for (x, y, w_, h_) in ((30, 60, 90, 60), (140, 50, 100, 70), (40, 150, 70, 90), (130, 150, 110, 50), (130, 215, 60, 40)):
        f.add(f'<rect x="{x}" y="{y}" width="{w_}" height="{h_}" fill="none" stroke="{STONE}" stroke-width="1" opacity=".7"/>')
    f.glowpath("M20 330 L70 315 L100 322 L128 300 C150 296 160 297 168 296", 1.6).path("M178 293 L250 250", HOT, 1.6, 0.8).hot(173, 295, 10)
    f.smoke([(60, 120, 30), (180, 90, 40), (200, 210, 36), (90, 230, 28), (150, 160, 30)], 0.75)
    f.text(135, 380, "DISCONNECTED", 40, INK, sx=1.25).cap("trophy wall · graph snaps · smoke", 430)
    out.append(("0:42 → 0:51", "Verse 1", "SUCCESS · DISCONNECTED · DARKNESS", "Plaques carved in the concrete wall. The SUCCESS graph climbs, stretches thin over the 3 s held DISCONNECTED and snaps. The certificate burns; DARKNESS smoke fills the wall.", f))
    # 7 BREAK
    f = F("f7")
    f.add(f'<clipPath id="f7k"><path d="M135 100 L128 170 L142 230 L126 300 L140 380 L170 380 L156 300 L172 230 L158 170 L165 100 Z"/></clipPath>')
    f.text(135, 290, "BREAK", 150, INK, sy=1.3)
    f.add('<g clip-path="url(#f7k)"><rect width="270" height="480" fill="#050505"/>')
    f.stars(40, 7, 120, 100, 180, 380)
    f.add("</g>").path("M135 100 L128 170 L142 230 L126 300 L140 380 M165 100 L158 170 L172 230 L156 300 L170 380", HOT, 1.2).hot(150, 240, 22, 0.6)
    f.cap("I'm just looking for a break", 430)
    out.append(("0:55.0", "Pre-Chorus", "BREAK", "BREAK cracks down the middle and the gap widens with his voice over the 1.2 s note. Stars are behind it. We fall up through the crack into the chorus.", f))
    # 8 STARS + floating RUDO
    f = F("f8").stars(160, 8)
    for k, ch in enumerate("STARS"):
        r = random.Random(k)
        for _ in range(26):
            f.add(f'<circle cx="{40 + k * 46 + r.uniform(-14, 14):.1f}" cy="{120 + r.uniform(-30, 30):.1f}" r="{r.uniform(.6, 1.8):.1f}" fill="{HOT}" opacity="{r.uniform(.5, 1):.2f}"/>')
    f.text(135, 140, "STARS", 90, HOT, o=0.25)
    for w_, x_, y_, r_, sz in (("FLOAT", 90, 300, -8, 64), ("somewhere", 182, 262, 10, 20), ("between", 70, 360, 6, 22), ("the", 200, 340, -16, 18)):
        f.text(x_, y_, w_, sz, DRIFT if w_ == "FLOAT" else INK, rot=r_, o=0.95 if w_ == "FLOAT" else 0.55, font="display" if w_ == "FLOAT" else "body")
    f.cap("Float somewhere between the stars", 440)
    out.append(("1:01.8", "Chorus 1", "STARS", "No gravity. FLOAT and the words around it hang loose in space. Each letter of STARS is a cluster of points that ignite with his voice. Kicks light new stars instead of shaking the frame.", f))
    # 9 NO DEADLINES
    f = F("f9").stars(60, 9, o=0.4)
    for r_ in range(5):
        for c_ in range(5):
            x, y = 40 + c_ * 38, 150 + r_ * 38
            f.add(f'<rect x="{x}" y="{y}" width="34" height="34" fill="none" stroke="{INK}" stroke-width=".8" opacity="{0.6 if c_ * 5 + r_ < 13 else 0.08}"/>')
    f.hot(140, 260, 18).text(135, 120, "NO", 60, HOT).text(135, 380, "DEADLINES", 58, INK, o=0.8).cap("hot point runs backwards and unwrites", 430)
    out.append(("1:06.7", "Chorus 1", "NO DEADLINES", "NO is the eraser: a calendar drawn in light is unwritten by the hot point running back along its own path. Then the BLESSED crowd, then the VOICES.", f))
    # 10 WORLD → BIT
    f = F("f10").stars(90, 10).globe(135, 380, 110, INK, 0.8).text(112, 236, "B", 64, DRIFT, rot=-6).text(136, 206, "I", 64, DRIFT, rot=4).text(162, 180, "T", 64, DRIFT, rot=12).hot(135, 268, 12, 0.7)
    f.text(135, 70, "WORLD", 60, INK, o=0.8).cap("I just wanna leave it for a bit", 108, 12)
    out.append(("1:14 → 1:18", "Chorus 1", "WORLD · BIT", "The contour globe turns. On the held high 'bit' the letters B-I-T lift off its surface and float up for exactly the length of the note.", f))
    # 11 DRIFT
    f = F("f11").stars(120, 11)
    for k, (ch, dx, dy, r) in enumerate(zip("DRIFT", (-90, -50, -12, 34, 86), (0, -6, -26, -40, -78), (0, -4, -10, 14, 28))):
        f.text(135 + dx, 260 + dy, ch, 92, DRIFT if k > 1 else INK, rot=r, o=1 - k * 0.12)
    f.text(135, 150, "i don't wanna die", 14, MUTED, font="body").cap("held ~3.5 s · letters drift for exactly the note", 440, 11)
    out.append(("1:25.9", "Chorus 1", "DIE · DRIFT", "DIE stays a small, still caption. DRIFT's letters unhook from the baseline and float apart, following his volume; when the note fades they're stars. Then the stars streak into road lines.", f))
    # 12 DESTINATION road
    f = F("f12")
    for k in range(-5, 6): f.line(135, 200, 135 + k * 70, 480, INK, 0.8, 0.4)
    for i in range(7):
        y = 200 + 280 * (i / 7) ** 1.7; f.line(132 - (y - 200) * 0.02, y, 138 + (y - 200) * 0.02, y + 6 + i * 3, HOT, 2 + i * 0.6)
    f.hot(135, 200, 10).text(135, 120, "DESTINATION", 34, INK, sx=1.25, o=0.55).text(150, 120, "DESTINATION", 34, INK, sx=1.25, o=0.2)
    f.text(70, 250, "NOISE", 28, MUTED, rot=-8, o=0.6).cap("Sometimes I drive with no destination", 440)
    out.append(("1:30.4", "Verse 2", "DESTINATION · NOISE", "Night road drawn by the hot point, rushing at camera. DESTINATION streaks past unreadable. NOISE is static type chasing the car; on 'sticks around' it sticks to the glass and drips.", f))
    # 13 EVERYBODY / APART
    f = F("f13")
    for r_ in range(16):
        for c_ in range(2):
            x = (6 if c_ == 0 else 264) ; f.text(x, 70 + r_ * 22, "EVERYBODY", 15, INK, anchor="start" if c_ == 0 else "end", o=0.25 + 0.3 * (r_ % 3 == 0))
    f.line(135, 60, 135, 400, MUTED, 0.6, 0.4, "2 4").text(135, 250, "APART", 64, DRIFT).cap("surrounded by everybody · miles apart", 450, 11)
    out.append(("1:43.8 → 1:45.8", "Verse 2", "EVERYBODY · APART", "EVERYBODY multiplies on the beat (1, 2, 4, 16, 64) into a field of words. On 'miles apart' the field slides to both edges and APART is left alone in the gap.", f))
    # 14 FATHER
    f = F("f14").floor(340, 8, 0.12)
    f.text(135, 220, "father", 84, STONE, font="hand").hot(214, 205, 10)
    wav = " ".join(f"{20 + i * 2.3:.1f},{300 + math.sin(i * 0.5) * (14 * math.exp(-((i - 50) / 30) ** 2)) * math.sin(i * 0.13):.1f}" for i in range(100))
    f.add(f'<polyline points="{wav}" fill="none" stroke="{HOT}" stroke-width="1.2" opacity=".8"/>').cap("Got a father that I miss", 420)
    out.append(("1:51.0", "Verse 2", "FATHER · VOICEMAILS", "The emotional core. No beat-cuts, no shake. FATHER is carved slowly by hand in stone; the carving line becomes a voicemail waveform that plays.", f))
    # 15 FOREVER (pre 2)
    f = F("f15").line(0, 300, 270, 300, INK, 0.8, 0.5).text(30, 290, "FOREVER", 52, INK, anchor="start", sx=1.75, o=0.9)
    f.add(f'<rect x="232" y="180" width="40" height="130" fill="{BG}"/>').line(232, 230, 232, 300, HOT, 2).hot(232, 230, 10).cap("Not forever · Just long enough to breathe", 420)
    out.append(("2:07.0", "Pre-Chorus 2", "FOREVER · BREATHE", "Beat gone. FOREVER stretches toward the horizon for the held note and is cut off when the note ends. Then the whole frame breathes with his voice into chorus 2.", f))
    # 16 CARRYING (bridge)
    f = F("f16").stars(50, 16, 0, 0, 270, 200, 0.6).floor(320, 9, 0.22)
    f.add(f'<rect x="60" y="186" width="150" height="76" fill="#2b2722" stroke="{STONE}" stroke-width="1.2"/>')
    for i in range(7): f.line(60, 196 + i * 10, 210, 196 + i * 10, STONE, 0.5, 0.4)
    f.text(135, 318, "CARRYING", 74, INK, sy=0.8).cap("Maybe I'm tired of carrying", 450)
    out.append(("2:48.6", "Bridge", "CARRYING · SEE", "Half-time, nearly monochrome. The word CARRYING bears the verse-1 stone block on its letters, bowing under it as it moves along a contour plain. On 'nobody else can see' the block turns to clear glass, so only the refraction shows it's there.", f))
    # 17 SILENCE
    f = F("f17").hot(135, 250, 5, 0.9).text(135, 300, "just silence", 11, MUTED, font="body")
    out.append(("3:18.6", "Breakdown", "SILENCE", "After five NOs, each faster (phone, badges, ceiling slab, trophy wall, mask), everything has been erased. One point and the smallest type in the film. On 'breathing' the point breathes and grows.", f))
    # 18 HEAR
    f = F("f18").stars(70, 18, o=0.6).ripples(135, 230, 7, 12, 16, HOT, 0.8).text(135, 238, "MYSELF AGAIN", 18, INK, font="display", ls=2)
    f.text(135, 90, "HEAR", 80, HOT).text(135, 452, "underneath the noise", 13, MUTED, font="mono", o=0.5)
    for i in range(10): f.line(20 + i * 23, 460, 34 + i * 23, 460, MUTED, 1, 0.4)
    out.append(("3:32.0", "Final Chorus", "HEAR MYSELF AGAIN", "The beat drops out and the camera itself drifts. HEAR sends one clean ring per note of the 'hear myself again' melisma. When the beat returns, NOISE is small static at the very bottom, underneath everything.", f))
    # 19 TOMORROW / BUILDING / WEIGHT
    f = F("f19").line(0, 330, 270, 330, HOT, 1.5).hot(135, 330, 30, 0.5)
    for i in range(7): f.add(f'<rect x="{186 + (i % 2) * 4}" y="{300 - i * 22}" width="56" height="22" fill="none" stroke="{STONE}" stroke-width="1" opacity="{0.4 + i * 0.08:.2f}"/>')
    f.add(f'<rect x="28" y="190" width="112" height="58" fill="#2b2722" stroke="{STONE}" stroke-width="1"/>').text(84, 234, "WEIGHT", 40, STONE).text(84, 318, "KEEP", 92, INK, sy=1.15).text(214, 130, "BUILDING", 30, INK)
    f.text(135, 400, "TOMORROW", 50, INK, o=0.6).cap("Tomorrow I'll keep carrying the weight", 450)
    out.append(("3:44.8 → 3:53", "Outro", "FIGHTING · BUILDING · WEIGHT", "A horizon line like dawn. FIGHTING hits out, BUILDING assembles into a tower, and KEEP stands up under the same stone block from verse 1, lifting it by choice this time.", f))
    # 20 LET ME DRIFT → return
    f = F("f20").stars(200, 20)
    for k, ch in enumerate("DRIFT"):
        r = random.Random(40 + k)
        for _ in range(14):
            f.add(f'<circle cx="{60 + k * 38 + r.uniform(-22, 22):.1f}" cy="{150 - k * 8 + r.uniform(-28, 28):.1f}" r="{r.uniform(.5, 1.6):.1f}" fill="{DRIFT}" opacity="{r.uniform(.4, .9):.2f}"/>')
    f.line(0, 250, 270, 250, MUTED, 0.5, 0.4).text(135, 270, "4:09 · beat returns", 10, MUTED, font="mono")
    f.text(135, 400, "RUDO", 70, "none", stroke=HOT, sw=1.1, ls=14).text(135, 400, "RU", 70, INK, anchor="end", ls=14, o=0).hot(176, 360, 12)
    f.text(135, 440, "DRIFT", 20, INK, ls=8)
    out.append(("3:57 → 4:24", "Outro", "LET ME DRIFT → TOMORROW", "The last DRIFT dissolves into the starfield. Eleven seconds of near-silence (one star pulses on the breath at 4:02). When the beat returns at 4:09, one hot point redraws the RUDO wordmark and the title.", f))
    return out
