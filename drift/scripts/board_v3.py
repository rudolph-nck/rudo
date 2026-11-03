"""Drift storyboard v3: every line is an object from the song's world (the P(doom) approach) -> creative/storyboard-v3.html"""
import html, sys
ROOT = sys.argv[1] if len(sys.argv) > 1 else "."
E = html.escape

# ---------------- key-frame mockups (16:9, CSS) ----------------
def fr(inner, bg="var(--ink)"):
    return f'<div class="kf" style="background:{bg}">{inner}</div>'
K = {
 "alarm": fr('<div class="m-time">6:00</div><div class="m-sub">ANOTHER MORNING</div><div class="m-days"><b>M</b><b>T</b><b>W</b><b>T</b><b>F</b><b>S</b><b>S</b></div><div class="m-pill"><span>Snooze</span><span class="hot">Stop</span></div>'),
 "ecg": fr('<svg viewBox="0 0 320 180"><path d="M0 110 H70 l8 -10 l8 10 h20 l6 -62 l8 92 l6 -30 h40 l8 -10 l8 10 h20 l6 -62 l8 92 l6 -30 H320" fill="none" stroke="var(--hot)" stroke-width="2"/><text x="14" y="30" class="mono s">PRESSURE</text><text x="14" y="58" class="big">140/90</text><text x="230" y="30" class="mono s">CHEST</text><text x="230" y="58" class="big hotf">♥ 112</text></svg>'),
 "blessed": fr('<div class="m-post"><div class="m-ph"></div><div class="m-likes">♥ 24,817</div><div class="m-c"><b>@jay</b> so <i class="hot">#blessed</i></div><div class="m-c"><b>@mia</b> you’re so blessed</div><div class="m-c"><b>@dre</b> blessed fr 🙏</div><div class="m-c dim"><b>@you</b> …</div></div>'),
 "pie": fr('<svg viewBox="0 0 320 180"><g transform="translate(160 92)"><path d="M0 0 L0 -66 A66 66 0 0 1 57 -33 Z" fill="#2a2724" transform="translate(6 -10)"/><path d="M0 0 L57 -33 A66 66 0 0 1 40 52 Z" fill="#3a3632" transform="translate(12 4)"/><path d="M0 0 L40 52 A66 66 0 0 1 -50 43 Z" fill="#2a2724" transform="translate(0 12)"/><path d="M0 0 L-50 43 A66 66 0 0 1 0 -66 Z" fill="#33302c" transform="translate(-12 -2)"/><text x="-8" y="10" class="big hotf" text-anchor="middle">ME</text></g><text x="196" y="40" class="mono s">WORK 31%</text><text x="214" y="140" class="mono s">FAMILY 22%</text><text x="40" y="150" class="mono s">FANS 28%</text><text x="44" y="40" class="mono s">FRIENDS 19%</text></svg>'),
 "call": fr('<div class="m-call"><div class="mono s dim">incoming call</div><div class="m-name">DARKNESS</div><div class="mono s dim">mobile</div><div class="m-btns"><span class="dec">✕</span><span class="acc">✓</span></div></div>'),
 "battery": fr('<div class="m-batt"><div class="mono s">I’M RUNNING ON</div><div class="m-num">12<span class="hot">%</span></div><div class="m-bar"><i style="width:12%"></i></div></div>'),
 "tear": fr('<div class="m-paper"><div class="mono s">PAGE 312</div><div class="serif">THE END</div><div class="hand hot">not looking for an</div></div><div class="m-rip"></div>', "#000"),
 "dnd": fr('<div class="m-dnd"><span class="moon">☾</span><b>Do Not Disturb</b><i class="tog on"></i></div><div class="m-drift">DRIFT</div>'),
 "stars": fr('<svg viewBox="0 0 320 180"><circle cx="160" cy="90" r="80" fill="none" stroke="#8d877e" stroke-width=".6"/><circle cx="160" cy="90" r="54" fill="none" stroke="#5a554f" stroke-width=".5"/><g fill="#efede9"><circle cx="110" cy="60" r="1.6"/><circle cx="200" cy="52" r="1.2"/><circle cx="214" cy="120" r="1.8"/><circle cx="126" cy="128" r="1.3"/><circle cx="168" cy="40" r="1"/></g><path d="M110 60 L168 40 L200 52 L214 120 L126 128 Z" fill="none" stroke="#8d877e" stroke-width=".5"/><circle cx="160" cy="92" r="3" fill="var(--hot)"/><text x="168" y="96" class="serif s">you, somewhere between</text></svg>'),
 "satnav": fr('<svg viewBox="0 0 320 180"><path d="M0 150 C80 130 120 160 170 110 S260 60 320 70" fill="none" stroke="#3a3632" stroke-width="10"/><path d="M0 150 C80 130 120 160 170 110" fill="none" stroke="var(--hot)" stroke-width="3"/><circle cx="170" cy="110" r="6" fill="var(--hot)"/><rect x="16" y="14" width="160" height="40" rx="4" fill="#151412"/><text x="26" y="30" class="mono s dim">DESTINATION</text><text x="26" y="47" class="big">—</text></svg>'),
 "texts": fr('<div class="m-chat"><p class="me">you there?</p><p class="me">can we talk</p><p class="me">?</p><div class="mono s dim r">Delivered</div><div class="dots"><i></i><i></i><i></i></div></div>'),
 "voicemail": fr('<div class="m-vm"><div class="hand big2">Dad</div><div class="mono s dim">voicemail · 0:43 · Mar 2019</div><svg viewBox="0 0 260 40"><path d="M0 20 ' + " ".join(f"L{i*4} {20+((i*37)%17-8)*(0.6 if i<30 else 0.25)}" for i in range(65)) + '" fill="none" stroke="var(--hot)" stroke-width="1.5"/></svg><div class="m-play">▶</div></div>'),
 "xray": fr('<div class="m-x"><div class="mono s">SECURITY · LANE 3</div><div class="m-bag"><span>WEIGHT</span><span>PRESSURE</span><span class="hot">DAD</span><span>NOISE</span><span>TIME</span></div><div class="mono s dim">contents: not visible to others</div></div>', "#121110"),
 "notif": fr('<div class="m-notif"><p>Missed call · Mgr</p><p>3 new emails</p><p>Reminder: deadline</p><p class="gone">You were mentioned</p><div class="m-no">NO</div></div>'),
 "find": fr('<div class="m-find"><div class="mono s dim">FIND</div><div class="m-name">GUILT</div><div class="mono s">can’t locate this person</div><div class="ring"></div></div>'),
 "todo": fr('<div class="m-todo"><div class="mono s">TOMORROW</div><p>☐ keep fighting</p><p>☐ keep building</p><p>☐ keep carrying the <b class="hot">weight</b></p><div class="mono s dim">alarm 7:00 AM · tonight: drift</div></div>', "#bdb3a4"),
}

# ---------------- the shot list ----------------
# (time, line, object, treatment, transition)
CH = [
 ("Intro", "0:00–0:23", "approved · keep", "A spark writes your thoughts across the night (built). Type gets heavier; the battery gauge makes its first appearance on TIRED.", [
   ("0:00", "(instrumental)", "Spark / fuse", "A spark ignites on frame 1 and races, drawing a line; the sky fills with shooting-star trails.", "dives back to the spark"),
   ("0:06", "You ever get so tired", "Battery 3%", "The line is written by the spark; TIRED sags asleep. A low-battery warning ghosts in: 3%.", "camera follows the spark"),
   ("0:09", "You don't want to quit", "The no-sign", "The spark draws the circle-and-slash around QUIT.", "whip along the spiral"),
   ("0:11", "You don't want to disappear", "Fading word", "DIS · AP · PEAR builds, the spark burns out, the word drifts into the dark.", "relight"),
   ("0:18", "You just want everything to stop", "Freeze", "Everything stops on STOP; pull back to the spiral of every line over the figure on the rooftop.", "clock face"),
   ("0:21", "For a minute", "Clock", "A clock draws itself in the middle of the spiral, second hand ticking.", "the clock face becomes the alarm"),
 ]),
 ("Verse 1", "0:23–0:52", "battery drains 41% → 12%", "Your everyday: phone screens, monitors, forms and frames. Charcoal and stone, one soft light.", [
   ("0:23", "Another morning, same ceiling", "Phone alarm", "6:00 alarm, repeating every day of the week, all ticked. Stop is swiped; the clock face from the intro becomes the alarm ring, then the ceiling fan.", "eyes open on the ceiling"),
   ("0:25", "Same pressure on my chest", "Heart monitor", "A monitor readout: PRESSURE 140/90 climbing, CHEST with a pale beat on every kick.", "the ECG line pulls into a comment thread"),
   ("0:26", "Same people telling me I'm blessed", "Comment thread", "A post with a climbing like count; comments stack: #blessed, so blessed, blessed fr. Your own reply box stays empty.", "scroll down"),
   ("0:28", "While I'm struggling to rest", "Sleep tracker", "SLEEP 3h 12m · RESTLESS; the sleep graph is jagged; STRUGGLING's letters can't sit on one line.", "graph bars become pie slices"),
   ("0:29", "Everybody needs a piece of me", "Pie chart", "ME in the centre of a pie chart; slices labelled WORK, FAMILY, FRIENDS, FANS pull away on the beat.", "slices flip into calendar blocks"),
   ("0:31", "Everybody wants my time", "Calendar", "A week with every slot booked; no block says MINE. TIME is pulled across the grid.", "the week stacks onto the shelf"),
   ("0:33", "I'm carrying so much weight", "Scale + shelf", "A scale's digits roll up word by word (I'M → CARRYING → SO → MUCH); WEIGHT slams on the kick, the shelf breaks, the concrete cracks (approved scene).", "camera drops into the crack"),
   ("0:34", "I forgot what's actually mine", "Lost-property tag", "A paper tag reading MINE with the owner line blank, among the rubble; it tips into the crack.", "falling"),
   ("0:37", "Built a life that people envy", "Profile page", "A perfect profile: followers ticking up, a flawless photo grid. ENVY in the bio.", "pull back off the screen"),
   ("0:38", "Built a name they all respect", "Engraved plaque", "A brass nameplate being engraved: RUDO, then RESPECT in engraved serif.", "plaque reflects a chart"),
   ("0:40", "Funny how success can leave you", "Growth chart", "SUCCESS as a rising line, which then runs off the edge of the page and leaves the the light alone.", "the dot becomes a signal icon"),
   ("0:42", "Feeling more disconnected", "Status bar", "Signal bars drop one by one; NO SERVICE; DIS · CON · NECT · ED pull apart.", "a page slides in"),
   ("0:46", "Got accomplishments on paper", "Résumé", "A typed résumé: ACCOMPLISHMENTS as the heading, bullet points typing out.", "pinned to a wall"),
   ("0:47", "Got achievements on the wall", "Wall of frames", "Framed certificates and plaques; ACHIEVEMENTS in a gold frame.", "volume HUD"),
   ("0:49", "But none of that gets quiet", "Volume slider", "A volume slider dragged down but snapping back to max; the frames fall one per beat.", "the screen lights up: incoming call"),
   ("0:50", "When the darkness starts to call", "Incoming call", "A call screen: DARKNESS · mobile, Accept / Decline, the phone buzzing on the beat; CALL echoes.", "decline"),
 ]),
 ("Pre-Chorus", "0:52–0:57", "", "", [
   ("0:53", "And I'm not looking for an ending", "Last page of a book", "THE END, with 'not looking for an' scribbled above it in pencil.", ""),
   ("0:55", "I'm just looking for a break", "Paper tears", "On BREAK the page tears in half, and light pours through the gap into the chorus.", "the tear opens onto the sky"),
 ]),
 ("Chorus 1", "0:57–1:31", "battery charges 12% → 34%", "Weightless. Things switch off and float. The battery gauge appears big, in thin outlined numbers, like their P(doom) meter.", [
   ("0:57", "I don't wanna die", "Battery", "Huge thin outlined numbers: I'M RUNNING ON 12%. A charging bolt appears.", "the bolt lifts off"),
   ("0:59", "I just wanna drift", "Do Not Disturb", "The DND toggle switches on (moon icon); the phone dims; DRIFT floats off the screen, gravity off.", "float up into stars"),
   ("1:01", "Float somewhere between the stars", "Star chart", "An engraved star chart with constellation lines; a small the light labelled 'you, somewhere between'.", "chart flips to a dialog"),
   ("1:04", "And forget about all this", "Dialog box", "'Clear all? This can't be undone.' CLEAR ALL is pressed; everything behind it dissolves.", "a list slides up"),
   ("1:08", "No deadlines", "To-do list", "Deadlines struck through in pencil, with NO stamped on the beat.", "stamp"),
   ("1:09", "No expectations", "Review form", "A performance review: EXPECTATIONS crossed out, the stamp lands again.", "stamp"),
   ("1:11", "No voices in my head", "Group chat", "A group chat full of voice notes, muted one by one; the waveforms go flat.", "zoom out to the globe"),
   ("1:15", "I don't wanna leave this world", "Engraved globe", "An old engraved globe turning slowly; WORLD on its band.", "the globe becomes a status dot"),
   ("1:17", "I just wanna leave it for a bit", "Away status", "Status set to 'Away — back in a bit'; the held A stretches a progress bar.", "progress bar to battery"),
   ("1:24", "I don't wanna die / drift", "Battery + airplane mode", "34% and charging; airplane mode switches on; the stars stretch into highway lights.", "lane lines"),
 ]),
 ("Verse 2", "1:31–2:09", "battery drains 34% → 0%", "Night drive. The car's screens, the road and your phone, lit only by passing streetlights.", [
   ("1:31", "Sometimes I drive with no destination", "Satnav", "Destination: —. The route line draws itself with nowhere to end.", "dashboard"),
   ("1:33", "Radio low, windows down", "Car radio", "The radio display reads VOL LOW; the window icon slides down; wind lines.", "the noise meter wakes"),
   ("1:35", "Trying to outrun the noise", "Speedometer", "Speed climbs; NOISE is a spectrum analyzer chasing in the mirror.", "the mirror"),
   ("1:37", "That somehow always sticks around", "Rear-view mirror", "The NOISE waveform clings to the mirror and won't drop away.", "billboard"),
   ("1:41", "People think I'm doing great", "5-star review", "'How's he doing?' ★★★★★ GREAT, on a billboard passing.", "stars flip"),
   ("1:42", "Maybe that's the hardest part", "Annotation", "The five stars get circled in pencil: the hardest part.", "map zooms out"),
   ("1:44", "Being surrounded by everybody", "Map pins", "Hundreds of contact pins all around your one lit pin.", "measure"),
   ("1:46", "While feeling miles apart", "Distance line", "A measuring line between you and them: 2,431 mi. APART spreads apart.", "photo roll"),
   ("1:48", "Got memories that haunt me", "Photo roll", "Old photos flicker past, one lingers.", "messages"),
   ("1:49", "Got questions with no replies", "Text thread", "Your messages: Delivered. The typing dots appear, then disappear.", "contacts"),
   ("1:52", "Got a father that I miss", "Contact card", "A contact card with 'Dad' in handwriting.", "voicemail list"),
   ("1:54", "And old voicemails I still play sometimes", "Voicemail", "Voicemail · 0:43 · Mar 2019. Play is pressed and the pale waveform plays as you sing. Everything slows. The emotional hold.", "the waveform flattens"),
   ("1:58", "Got dreams that keep me moving", "Notebook", "A handwritten list of dreams, an arrow pushing forward.", "flip"),
   ("1:59", "And scars that keep me real", "X-ray film", "A medical scan with healed lines traced in pale light.", "battery"),
   ("2:01", "Most days I'm strong enough", "Battery 100%", "STRONG ENOUGH beside a full battery.", ""),
   ("2:04", "Some days I just wanna feel nothing", "Battery 0%", "On the held NOTHING the battery drains to 0% and the screen goes dark grey.", "the screen powers off"),
 ]),
 ("Pre-Chorus 2", "2:09–2:15", "", "", [
   ("2:09", "Not forever", "Timer", "A timer set to ∞, crossed out and set to something shorter.", ""),
   ("2:12", "Just long enough to breathe", "Breathing app", "A breathing circle grows and shrinks: breathe in, out. The headlights become stars.", "the circle opens the chorus"),
 ]),
 ("Chorus 2", "2:15–2:50", "battery charges 0% → 61%", "Same objects as chorus 1, bigger and faster: the star chart fills the sky, the stamps hit harder, every notification icon floats up together.", [
   ("2:15", "I don't wanna die / drift", "Battery + DND", "0% → charging; DND on; DRIFT floats.", ""),
   ("2:19–2:42", "Float… / forget… / No… / leave it for a bit", "Star chart, dialog, stamps, globe, away status", "Repeats chorus 1's objects with variations, a wider camera and more of them at once.", ""),
   ("2:42", "I don't wanna die / drift", "Battery 61%", "61% and still charging; the long WANNA floats down onto the rooftop.", "rooftop"),
 ]),
 ("Bridge", "2:50–3:12", "", "Quiet and honest. Fewer objects, longer holds.", [
   ("2:50", "Maybe I'm tired of carrying", "Airport X-ray", "Your bag rolls through a security X-ray.", ""),
   ("2:53", "Things nobody else can see", "X-ray screen", "The scan shows what's inside: WEIGHT, PRESSURE, NOISE, TIME, DAD (lit). 'Contents: not visible to others.'", "the badges"),
   ("2:55", "Maybe I'm tired of being", "App icons", "A home screen of app icons.", ""),
   ("2:58", "Everything everybody needs", "Notification badges", "Red badges multiply on every icon: 12, 48, 99+.", "a repair ticket"),
   ("3:01", "Maybe I don't need fixing", "Repair ticket", "Ticket #0001: STATUS: WON'T FIX — working as intended, stamped.", "white page"),
   ("3:04", "Maybe I just need peace", "Blank page", "A single word, 'peace', in serif italic on a nearly empty page.", "calendar"),
   ("3:06", "Maybe I just need one night", "Calendar", "One night blocked out: UNAVAILABLE.", ""),
   ("3:09", "Where the world doesn't ask for me", "Request bounce", "Meeting requests fly in and bounce off the blocked night.", "the phone buzzes"),
 ]),
 ("Breakdown", "3:12–3:22", "", "One object, the phone, stripped layer by layer on each NO.", [
   ("3:12", "No phone ringing", "Call screen", "Incoming calls declined, one after another.", "wipe"),
   ("3:14", "No notifications", "Notification stack", "The stack is cleared, one swipe per beat.", "wipe"),
   ("3:15", "No pressure", "Gauge", "The pressure gauge falls to zero.", "wipe"),
   ("3:17", "No proving myself", "Scoreboard", "A scoreboard switches off.", "wipe"),
   ("3:18", "No pretending", "Profile page", "The perfect profile page from verse 1 tears away.", "black"),
   ("3:19", "Just silence", "Volume 0", "Black. A volume bar at 0 and one small word.", ""),
   ("3:21", "Just breathing", "Breath circle", "The spark returns, pulsing like a slow breath.", "the breath swells into the chorus"),
 ]),
 ("Final Chorus", "3:22–3:47", "battery charges to 100%", "The biggest float. Things that chased you now can't reach you.", [
   ("3:22", "I don't wanna die / drift", "Battery + DND", "Charging fast; DND on; everything lifts.", ""),
   ("3:27", "Somewhere the guilt can't find me", "Location app", "FIND: GUILT · can't locate this person; a search ring finds nothing.", ""),
   ("3:30", "Somewhere the past can't reach", "Call failed", "Calling THE PAST… Call failed · unreachable.", ""),
   ("3:32", "Somewhere I can hear myself again", "Voice memo", "A voice memo recording; MYSELF as the waveform.", ""),
   ("3:35", "Underneath the noise", "Layered waveforms", "The NOISE layers peel away until your one line is left.", ""),
   ("3:36", "And when I'm ready", "Status", "Status: READY ✓.", ""),
   ("3:38", "I'll come back stronger", "Battery 100%", "The battery hits 100%: STRONGER, the one heavy word that stands.", ""),
   ("3:41", "But tonight / I just wanna drift", "Clock + DND", "11:59 PM; TONIGHT holds; DND on; DRIFT floats out wide.", "dims to the outro"),
 ]),
 ("Outro", "3:47–4:24", "battery 100% · charging overnight", "Tomorrow's list, then the phone goes dark and the spark floats away. Loops to the opening.", [
   ("3:47", "Tomorrow I'll keep fighting", "Tomorrow's to-do", "A to-do list headed TOMORROW; 'keep fighting' types out.", ""),
   ("3:50", "Tomorrow I'll keep building", "To-do + the shelf", "'keep building' types out; the broken shelf from verse 1 is drawn back together as a diagram.", ""),
   ("3:52", "Tomorrow I'll keep carrying the weight", "To-do + the shelf", "'keep carrying the WEIGHT' types out; WEIGHT is set on the rebuilt shelf, and it holds.", ""),
   ("3:56", "But tonight…", "Alarm set", "Alarm 7:00 AM set; the screen dims slowly over the held 5 seconds.", ""),
   ("4:02", "Let me drift", "Airplane mode", "Airplane mode on, screen off. The spark floats into the dark; the final frame matches frame 1.", "loop"),
 ]),
]
KEYS = [("alarm", "0:23 · Another morning"), ("ecg", "0:25 · Pressure on my chest"), ("blessed", "0:26 · Telling me I'm blessed"), ("pie", "0:29 · A piece of me"),
        ("call", "0:50 · The darkness starts to call"), ("tear", "0:55 · Looking for a break"), ("battery", "0:57 · The gauge"), ("dnd", "0:59 · I just wanna drift"),
        ("stars", "1:01 · Between the stars"), ("satnav", "1:31 · No destination"), ("texts", "1:49 · Questions with no replies"), ("voicemail", "1:54 · Old voicemails"),
        ("xray", "2:53 · Things nobody else can see"), ("notif", "3:14 · No notifications"), ("find", "3:27 · The guilt can't find me"), ("todo", "3:47 · Tomorrow")]

rules = [
 ("Every line is an object", "Each lyric is typed, printed, stamped, engraved or signed onto something real from your life: a phone screen, a form, a monitor, a map, a note."),
 ("Type follows the object", "Bold sans for big moments, typewriter for forms and screens, engraved serif for plaques and star charts, handwriting for Dad, notes and signatures."),
 ("One light in the dark", "Charcoal, concrete and stone, like the Static & Silence cover. The word being sung lifts from stone to bone-white; the spark is one soft warm-white light, like the light falling on the wall in the cover. No bright colours."),
 ("The battery gauge", "Like their P(doom) meter: huge thin outlined numbers that return at key moments. It drains through the verses and charges in the choruses."),
 ("Objects hand off", "Each object turns into the next: a page tears, a line becomes a chart, a dot becomes a pin, a screen powers off."),
 ("Small details reward a rewatch", "Timestamps, footnotes, tiny labels and UI copy, all written for Drift."),
 ("Pacing", "A new object for nearly every line in verses (2–3 s), bigger and faster in choruses, long holds for the voicemail and the bridge."),
 ("The figure and the spark", "You appear as a silhouette at a few moments (rooftop, driving, the X-ray), and the spark is the one soft light that runs through everything."),
]

def chapter(name, rng, meter, intro, shots):
    rows = "".join(f'<tr><td class="t">{E(t)}</td><td class="ly">{E(l)}</td><td class="ob">{E(o)}</td><td>{E(d)}</td><td class="tr">{E(x)}</td></tr>' for t, l, o, d, x in shots)
    m = f'<span class="meter">{E(meter)}</span>' if meter else ""
    i = f'<p class="cin">{E(intro)}</p>' if intro else ""
    return f'''<section class="ch" id="{E(name.lower().replace(" ", "-"))}"><header><h2>{E(name)}</h2><span class="t">{E(rng)}</span>{m}</header>{i}
<div class="tbl"><table><thead><tr><th>Time</th><th>Line</th><th>Object</th><th>What happens</th><th>Into next</th></tr></thead><tbody>{rows}</tbody></table></div></section>'''

page = f'''<title>Drift Object Storyboard</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;800;900&family=Bebas+Neue&family=IBM+Plex+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&family=Caveat:wght@500&display=swap">
<style>
/* Layout: the P(doom) look as a document. Black page, paper-white type, one hot pale. Rules grid, a wall of 16:9 key frames, then one table per chapter. Single dark theme on purpose. */
:root {{
  --ink:#0d0c0b; --wall:#2b2622; --panel:#161412; --line:#2e2a26; --paper:#bdb3a4; --fg:#d9d0c3; --muted:#7f7468; --stone:#8e7d6e; --hot:#ece2d0;
  --sans:"Archivo","Helvetica Neue",Arial,sans-serif; --display:"Bebas Neue","Oswald","Arial Narrow",sans-serif; --mono:"IBM Plex Mono",ui-monospace,monospace; --serif:"Instrument Serif",Georgia,serif; --hand:"Caveat",cursive;
  color-scheme:dark;
}}
* {{ box-sizing:border-box; }}
body {{ margin:0; background:radial-gradient(ellipse 90% 60% at 50% 0%, #26211d 0%, var(--ink) 70%) var(--ink); background-attachment:fixed; color:var(--fg); font:15px/1.55 var(--sans); }}
.wrap {{ max-width:1240px; margin:0 auto; padding-left:max(16px,env(safe-area-inset-left,0px)); padding-right:max(16px,env(safe-area-inset-right,0px)); padding-block:40px 90px; display:grid; gap:54px; }}
h1,h2,h3 {{ margin:0; font-family:var(--sans); text-wrap:balance; }}
h1 {{ font:400 clamp(56px,11vw,128px)/.9 var(--display); letter-spacing:.14em; color:var(--stone); }}
h1 em {{ font-style:normal; color:var(--hot); }}
.palette {{ display:grid; grid-template-columns:minmax(0,200px) minmax(0,1fr); gap:20px; align-items:end; }}
.palette img {{ width:100%; max-width:200px; border:1px solid var(--line); display:block; }}
.sw {{ display:grid; grid-template-columns:repeat(auto-fill,minmax(120px,1fr)); gap:10px; }}
.sw div {{ display:grid; gap:6px; font:11px var(--mono); color:var(--muted); }} .sw i {{ display:block; height:44px; border:1px solid var(--line); }}
.rule {{ display:flex; align-items:center; gap:14px; font:500 12px var(--mono); letter-spacing:.3em; color:var(--stone); text-transform:uppercase; }} .rule::before, .rule::after {{ content:""; height:1px; width:56px; background:var(--stone); opacity:.6; }}
@media (max-width:560px) {{ .palette {{ grid-template-columns:1fr; }} }}
h2 {{ font:400 44px/1 var(--display); letter-spacing:.1em; color:var(--fg); }}
h3 {{ font-weight:800; font-size:17px; }}
p {{ margin:0; max-width:70ch; }}
.eyebrow, .t, .meter, th {{ font:500 12px var(--mono); letter-spacing:.08em; text-transform:uppercase; }}
.eyebrow {{ color:var(--stone); }}
.lead {{ font-size:18px; color:#d8d3cb; max-width:60ch; }}
.stack {{ display:grid; gap:14px; }}
.rules {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:1px; background:var(--line); border:1px solid var(--line); }}
.rules div {{ background:var(--ink); padding:16px; display:grid; gap:6px; align-content:start; }}
.rules p {{ font-size:14px; color:#cfcac2; }}
.keys {{ display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:20px 16px; }}
.keys figure {{ margin:0; display:grid; gap:8px; min-width:0; }}
.keys figcaption {{ font:12px var(--mono); color:var(--muted); }}
.kf {{ background-image:radial-gradient(ellipse 80% 70% at 50% 20%, rgba(70,60,50,.35), rgba(0,0,0,0) 70%); aspect-ratio:16/9; max-width:100%; border:1px solid var(--line); position:relative; overflow:hidden; display:grid; place-items:center; color:var(--fg); }}
.kf svg {{ width:100%; height:100%; display:block; }}
.mono {{ font-family:var(--mono); }} .s {{ font-size:9px; letter-spacing:.08em; fill:#a9a39a; color:#a9a39a; text-transform:uppercase; }}
.big {{ font:400 30px var(--display); letter-spacing:.08em; fill:var(--fg); }} .hotf {{ fill:var(--hot); }} .hot {{ color:var(--hot); }} .dim {{ opacity:.5; }} .r {{ text-align:right; }}
.serif {{ font-family:var(--serif); font-style:italic; fill:#d8d3cb; }} .hand {{ font-family:var(--hand); }}
.m-time {{ font:200 64px/1 var(--sans); letter-spacing:-.02em; }} .m-sub {{ font:500 12px var(--mono); letter-spacing:.3em; color:var(--stone); }}
.kf:has(.m-time) {{ align-content:center; gap:6px; }}
.m-days {{ display:flex; gap:6px; font:10px var(--mono); }} .m-days b {{ width:16px; height:16px; border-radius:50%; background:var(--stone); color:#0d0c0b; display:grid; place-items:center; font-weight:500; }}
.m-pill {{ display:flex; gap:10px; font:12px var(--mono); }} .m-pill span {{ border:1px solid var(--line); padding:3px 10px; border-radius:20px; }}
.m-post {{ width:62%; display:grid; gap:4px; font:11px var(--sans); }} .m-ph {{ height:44px; background:#2a2724; }} .m-likes {{ font:12px var(--mono); }} .m-c i {{ font-style:normal; }}
.m-call {{ text-align:center; display:grid; gap:4px; }} .m-name {{ font:400 40px var(--display); letter-spacing:.16em; color:var(--stone); }}
.m-btns {{ display:flex; gap:40px; justify-content:center; margin-top:8px; }} .m-btns span {{ width:30px; height:30px; border-radius:50%; display:grid; place-items:center; font-size:14px; }}
.dec {{ background:#3a3632; }} .acc {{ background:var(--stone); color:#0d0c0b; }}
.m-batt {{ display:grid; gap:2px; justify-items:start; width:78%; }} .m-num {{ font:200 92px/0.9 var(--sans); -webkit-text-stroke:1px var(--fg); color:transparent; }}
.m-num span {{ -webkit-text-stroke:0; }} .m-bar {{ width:100%; height:6px; border:1px solid var(--muted); }} .m-bar i {{ display:block; height:100%; background:var(--stone); }}
.m-paper {{ background:var(--paper); color:#222; width:58%; height:78%; display:grid; place-items:center; align-content:center; gap:4px; clip-path:polygon(0 0,100% 0,100% 100%,62% 100%,56% 78%,61% 52%,54% 30%,58% 0,0 0); }}
.m-paper .serif {{ font-size:26px; color:#222; }} .m-paper .hand {{ font-size:20px; transform:rotate(-4deg); }} .m-paper .s {{ color:#777; }}
.m-rip {{ position:absolute; left:52%; top:12%; bottom:12%; width:6px; background:linear-gradient(#f4e7d2,#cdbba0); filter:blur(3px); }}
.m-dnd {{ display:flex; gap:10px; align-items:center; font:12px var(--sans); background:#1c1a18; padding:8px 12px; border-radius:10px; }} .moon {{ color:var(--hot); font-size:16px; }}
.tog {{ width:28px; height:16px; border-radius:10px; background:var(--stone); position:relative; }} .tog::after {{ content:""; position:absolute; right:2px; top:2px; width:12px; height:12px; border-radius:50%; background:#fff; }}
.m-drift {{ position:absolute; font:400 54px var(--display); letter-spacing:.12em; color:var(--hot); top:14%; right:12%; transform:rotate(-8deg); opacity:.9; }}
.m-chat {{ width:56%; display:grid; gap:6px; }} .m-chat .me {{ justify-self:end; background:#2a2724; padding:4px 10px; border-radius:12px; font:11px var(--sans); }}
.dots {{ display:flex; gap:4px; }} .dots i {{ width:6px; height:6px; border-radius:50%; background:var(--muted); opacity:.5; }}
.m-vm {{ width:74%; display:grid; gap:4px; }} .big2 {{ font-size:36px; line-height:1; }} .m-vm svg {{ height:34px; }} .m-play {{ color:var(--hot); font-size:16px; }}
.m-x {{ width:80%; display:grid; gap:6px; }} .m-bag {{ border:1px solid #5a544c; height:70px; display:flex; flex-wrap:wrap; gap:4px 10px; padding:8px; font:400 16px var(--display); letter-spacing:.1em; color:#9c9285; align-content:center; }}
.m-notif {{ width:60%; display:grid; gap:4px; font:11px var(--sans); position:relative; }} .m-notif p {{ background:#1c1a18; padding:5px 8px; border-radius:8px; }} .m-notif .gone {{ opacity:.25; transform:translateX(40px); }}
.m-no {{ position:absolute; right:-20%; top:20%; font:400 46px var(--display); letter-spacing:.1em; color:var(--hot); }}
.m-find {{ display:grid; justify-items:center; gap:4px; position:relative; }} .ring {{ position:absolute; width:120px; height:120px; border:1px solid var(--stone); border-radius:50%; top:-20px; opacity:.4; }}
.m-todo {{ color:#1f1d1a; width:70%; display:grid; gap:4px; font:14px var(--hand); }} .m-todo p {{ font-size:20px; line-height:1.1; }} .m-todo .s {{ color:#6d675f; }}
.ch {{ display:grid; gap:14px; border-top:1px solid var(--line); padding-top:20px; }}
.ch > header {{ display:flex; flex-wrap:wrap; gap:6px 16px; align-items:baseline; }}
.t {{ color:var(--muted); font-variant-numeric:tabular-nums; }}
.meter {{ color:var(--stone); border:1px solid var(--stone); padding:2px 8px; }}
.cin {{ color:#cfcac2; }}
.tbl {{ overflow-x:auto; border-top:1px solid var(--line); }}
table {{ border-collapse:collapse; width:100%; min-width:860px; font-size:14px; }}
th {{ text-align:left; color:var(--muted); padding:10px 10px 8px 0; border-bottom:1px solid var(--line); font-weight:500; }}
td {{ padding:10px 10px 10px 0; border-bottom:1px solid var(--line); vertical-align:top; color:#d8d3cb; }}
td.t {{ width:64px; }} td.ly {{ width:22%; color:var(--fg); }} td.ob {{ width:14%; color:var(--stone); font-weight:800; }} td.tr {{ width:14%; color:var(--muted); font:12px var(--mono); }}
nav {{ display:flex; flex-wrap:wrap; gap:6px 14px; font:12px var(--mono); }} nav a {{ color:var(--muted); text-decoration:none; border-bottom:1px solid var(--line); }}
nav a:hover, nav a:focus-visible {{ color:var(--fg); border-color:var(--hot); outline:none; }}
</style>
<div class="wrap">
  <header class="stack">
    <span class="eyebrow">RUDO · Static &amp; Silence · Drift · storyboard v3 · 16:9 master · 4:24</span>
    <h1>Every line<br>is a <em>thing</em></h1>
    <p class="lead">Built the way the P(doom) video works: each lyric becomes an everyday object from your life, with the words typed, printed, stamped or signed onto it, and every object turning into the next. Charcoal, concrete and stone, from the Static &amp; Silence cover, with one soft light. Your battery is the gauge that runs through the song.</p>
    <nav aria-label="Chapters">{"".join(f'<a href="#{E(n.lower().replace(" ", "-"))}">{E(n)} · {E(r)}</a>' for n, r, *_ in CH)}</nav>
  </header>
  <section class="stack" aria-label="Palette"><span class="rule">Static &amp; Silence</span>
    <div class="palette"><img src="cover-ref.jpg" alt="RUDO, Static and Silence album cover: two people sitting against a concrete wall in low light">
      <div class="sw">{"".join(f'<div><i style="background:{c}"></i>{n} · {c}</div>' for n, c in [("Charcoal", "#0d0c0b"), ("Lit wall", "#2b2622"), ("Concrete", "#433a30"), ("Stone (type)", "#8e7d6e"), ("Paper", "#bdb3a4"), ("Bone (sung word)", "#ece2d0"), ("The light", "#f2e3c8")])}</div></div></section>
  <section class="stack"><span class="eyebrow">How it works</span><div class="rules">{"".join(f"<div><h3>{E(h)}</h3><p>{E(p)}</p></div>" for h, p in rules)}</div></section>
  <section class="stack"><span class="eyebrow">Key frames · rough layout, not final art</span><div class="keys">{"".join(f'<figure>{K[k]}<figcaption>{E(c)}</figcaption></figure>' for k, c in KEYS)}</div></section>
  {"".join(chapter(*c) for c in CH)}
</div>
'''
open(f"{ROOT}/creative/storyboard-v3.html", "w").write(page)
print(len(page))
