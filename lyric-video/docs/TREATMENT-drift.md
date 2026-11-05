# Drift — treatment

RUDO · vertical 9:16 · ≈ 86 BPM. Read docs/STYLE.md first. Times come from `src/timeline.ts`,
derived from `data/lyrics.json`; scenes look lines up by content, never by seconds.

## The idea in one paragraph

The video is **one night in the room on the album cover**, seen from the floor. It opens on the
seam where the wall meets the floor — a single horizontal hairline — and that line is the ground
he is tied to for the whole song. The verses are *weight*: things get set on the line (the
ceiling, a slab of the wall, certificates, a phone, asks from everybody) until there is no room
left. The choruses are *drift*: the type lifts off the line and floats up into a star field,
always on a thin tether back to the seam. The breakdown switches the room off one object at a
time. The outro is dawn along the seam, the weight left on the floor to be picked up tomorrow,
and the last frame is the first frame, so the video loops. Nobody is drawn.

## The three decisions

- **Motif: the seam** (STYLE.md motif 1), with the amber point, the slab and the tether.
  Leaving the line but staying tethered to it is the meaning of *drift, not die*.
- **Signal colour: lamp `#E8A04A`.** Phone screen, radio dial, voicemail LED, the sun on the seam.
- **Running state: ASKS.** A mono counter of what the world wants from him. 00 in the intro,
  climbs through the verses staged inside the plates, freezes in the choruses, zeroed line by
  line in the breakdown. Never in a corner.
- Rare accent **dawn `#F4C27A`** is owned by the outro only.
- Sacred voice (Cormorant italic) is used once: *Maybe I don't need fixing / Maybe I just need peace.*

## Tone rules for Drift

- **Drift is never die.** The seam never breaks (except as the *break* door in the pre-chorus,
  which is a gap, not an end). In every chorus the floating type keeps a visible tether to the
  seam. The word *die* is never set beautifully: it lands, and on *just* it is un-inked. The word
  *drift* is the one that gets the light.
- **Weight, then release.** Verses add objects until the frame is crowded and heavy (width 62,
  weight 900, things stacked on the seam). Choruses empty it (width 100–125, weight 500, loose
  tracking, nothing on the seam but the tether). The pressure should drop on the first *drift*.
- **Slow is the energy.** Cut on downbeats or every two bars. 808 → soft zoom/shake pulse;
  snare → snaps; piano envelope → slow camera drift. Hold the frame, then land the word.
- **The room is real.** Tilt, push, crane, track. Drifting belongs to the chorus and nowhere else.
- **Machine voice is the world asking.** Every clock, badge, calendar, counter, notification is
  Plex Mono and is a demand. The breakdown switches them off; the mono voice is gone until the
  outro's clock.
- **Restraint in the emotional centre.** `voicemail` is one shot. No cuts, no shake, no bloom
  beyond the LED.
- **Vertical first.** Seam at y ≈ 1240. Lyrics between y = 220 and 1480. Bottom 420 px for stars
  and tether only.
- **Not slop.** No figures or faces, no neon, no lens flares, no particle clouds. Stars are a few
  hundred bone points with one or two hairline constellations.

## Plates

| # | id | Lyric lines owned | Idiom / instrument | ASKS |
| --- | --- | --- | --- | --- |
| 1 | `seam` | Yeah… / You ever get so tired … / stop for a minute | The seam alone, a clock, a held breath | 00 |
| 2 | `ceiling` | Another morning, same ceiling … struggling to rest | Tilt from ceiling to wall; a slab lowers; type lies down | 00 |
| 3 | `pieces` | Everybody needs a piece of me … what's actually mine | ME cut into labelled pieces on the kicks | 01–14 |
| 4 | `wall` | Built a life … achievements on the wall | Inverted: bone paper, framed certificates hung on nails | 14 |
| 5 | `dark` | But none of that gets quiet … darkness starts to call | Lights out one by one; a phone face-down, buzzing amber | 15–22 |
| 6 | `break` | I'm not looking for an ending / just looking for a break | The seam refuses a full stop, then opens a gap: the door | 22 |
| 7 | `hook` ×3 | I don't wanna die / I just wanna drift (each chorus) | The typographic slam; DIE un-inked, DRIFT lifts off on a tether | frozen |
| 8 | `stars` | Float somewhere between the stars … leave it for a bit | Crane up through the ceiling; words as constellation labels; NO ×3 erases objects | frozen |
| 9 | `drive` | Sometimes I drive … sticks around | Night road; the seam is the horizon; dashboard mono; signs on the beat | 23–31 |
| 10 | `apart` | People think I'm doing great … miles apart | Text bubbles stacking; the reply typed and deleted; bubbles recede a mile | 31–40 |
| 11 | `voicemail` | Got memories … old voicemails I still play sometimes | One shot: a voicemail player; the seam is the waveform | 40 |
| 12 | `scars` | Got dreams … some days I just wanna feel nothing | Cracks drawn into the slab; on *nothing* grain, bloom and weight drop out for one bar | 40 |
| 13 | `breath` | Not forever / just long enough to breathe | The seam becomes a breath trace; the ring is the door again | 40 |
| 14 | `carry` | Maybe I'm tired of carrying … world doesn't ask for me | Invisible labels revealed by the lamp; the serif line; the counter slows | 40 → 41 |
| 15 | `silence` | No phone ringing … Just breathing | Hard cuts; each NO switches something off; ASKS zeroes | 41 → 00 |
| 16 | `under` | Somewhere the guilt can't find me … But tonight I just wanna drift | Final-chorus plate: tendrils that fall short, noise that parts, the tether slackens | — |
| 17 | `tomorrow` | Tomorrow I'll keep fighting … Let me drift | Dawn along the seam; the slab waits on the floor; loop to frame 1 | — |

`hook` plays three times with `params: { n: 1 | 2 | 3 }`; `stars` follows hooks 1 and 2; `under`
replaces `stars` after hook 3.

## Plates 1–5: the weight

### 1 `seam` — "for a minute"
Black. The seam fades in: one bone hairline at y ≈ 1240, lit from above by a soft lamp falloff
so the wall above it is barely concrete and the floor below barely reflects it (the cover's
light). Top-left, the machine voice: `04:37 AM`, seconds ticking. "Yeah…" is a single word in the
lyric voice, low contrast, that exhales (weight 900 → 300) over its length. The spoken lines
("You ever get so tired…") are typed small in mono, one line at a time, like a thought being
admitted, each fading as the next arrives. On "stop" the clock's seconds stop. On "for a minute"
the seam dims to almost nothing and holds for the rest of the bar. ASKS is not shown; it reads 00.
The title card "RUDO · DRIFT" in the cover's wide tracking sits on the wall above the seam for one
bar, then goes.

### 2 `ceiling` — "Another morning, same ceiling"
The seam is revealed as the **ceiling edge** seen from the floor looking up: the camera tilts
down over the first line, and the line becomes the wall/floor seam of the cover's room (hairline
perspective, two side walls, the lit patch on the wall). "same ceiling": the words sit on the
ceiling plane in perspective, receding. "Same pressure on my chest": a **slab** — a plain
rectangle of the wall, hairline-drawn with concrete texture — lowers from the top on the 808
hits, one step per kick, and the lyric beneath it condenses (width 125 → 62) as it comes down.
"Same people telling me I'm blessed": *blessed* arrives in the serif, upright, bright — somebody
else's word — no bloom; it sits like a greeting card on the wall. "While I'm struggling to rest":
the whole line rotates 90° to lie on the floor along the seam, and the slab rests on top of it.
The slab stays for the rest of the verse.

### 3 `pieces` — "Everybody needs a piece of me"
ME in the lyric voice, huge, wide, centred on the wall above the seam. On every kick a
rectangular piece is cut out of the letters (hairline cut; the piece slides to an edge of the
frame) and gets a mono label: `WORK`, `TEAM`, `BILLS`, `MOM`, `FRIENDS`, `CHURCH`, `HOA`,
`TAXES`, `TEXTS`, `MEETING 9:00`… Each cut increments **ASKS 01 → 14** in mono beside the seam.
"Everybody wants my time": the clock from plate 1 reappears and its hands are torn off as pieces
too. "I'm carrying so much weight": the pieces pile onto the slab on the floor; the slab sinks a
few pixels into the seam. "I forgot what's actually mine": what is left of ME is a sliver; the
word *mine* appears tiny, mono, lower-case, below the seam where nobody looks.

### 4 `wall` — "Built a life that people envy" (inverted)
Hard cut to **bone paper**: the wall inverted, ink lines. On each downbeat a nail hit (shake
2 px, a tick in the mono voice) and a hairline frame is hung on the wall; the lyric line is
typeset inside it as a certificate title in the serif with a mono date line (`AWARDED · 2019`).
"Built a name they all respect": the frames multiply faster, overlapping, crooked. "Funny how
success can leave you / feeling more disconnected": the frames are seen from the side — the
camera tracks along the wall and the certificates are edge-on, a row of hairlines, nothing in
them. "Got accomplishments on paper / got achievements on the wall": the two halves of the line
sit on the two surfaces, *paper* on the floor plane, *wall* on the wall plane, and the seam
between them is the only thing in focus.

### 5 `dark` — "But none of that gets quiet"
The inverted plate flips back to ink on the downbeat as the lamp goes out; the frames remain as
faint hairlines. "When the darkness starts to call": a phone lies face-down on the floor by the
seam; on each kick its screen glows lamp-amber through the gap under it and the floor reflects it
(the only light in the frame). Each buzz adds an ASK (15 → 22). On "call" the phone turns over on
its own and the screen reads, in mono, `Unknown · calling…` with no accept button. The camera
pushes slowly toward it through the whole line and the glow fills the bottom of the frame as we
cut to the pre-chorus.

## Plates 6–12: the break, the drift, the drive

### 6 `break` — "I'm not looking for an ending"
Everything in the room goes; only the seam, the slab, and the phone glow remain. The lyric is set
*on* the seam, the words lit as the amber point (the phone's glow, now a travelling light on the
line) passes under them. On "ending" a full stop is drawn at the end of the line — a hard bone dot
— and the amber point **does not stop**: it passes straight through and the dot is left behind,
dimming. On "break" the seam opens: a gap, two bright ends, and the amber point drops into it. The
camera pushes into the gap on the downbeat; it is the door to the chorus. ASKS freezes at 22 and
is not shown again until verse 2.

### 7 `hook` ×3 — "I don't wanna die / I just wanna drift"
The typographic slam. One word per sung word, full-width Archivo, stacked down the vertical
frame: I DON'T / WANNA / DIE → then I JUST / WANNA / DRIFT. **DIE** lands heavy (weight 900,
width 62) on its hit; on "just" it is un-inked: the fill drains out of the letters bottom-to-top
leaving a hairline, then nothing. **DRIFT** arrives at width 125, weight 500, and its letters
**lift off the baseline**: each glyph rises at a slightly different rate, tracking loosens, and
from each letter a hairline tether runs straight down to the seam. The letters never leave the
frame.
- n=1 (chorus 1): bone on ink, clean. The seam is at the bottom; the letters rise a third of the frame.
- n=2 (chorus 2): inverted — ink type on a bone field — heavier; the letters rise two-thirds; thinner tethers.
- n=3 (final chorus): the breakdown version. Hairline type, small, a lot of black, slow; the
  letters rise almost to the top safe area; the tethers are one pixel. The only hook where DIE
  is not slammed: it is already a hairline, and it simply fades.

### 8 `stars` — "Float somewhere between the stars" (after hooks 1 and 2)
"Float somewhere": the camera cranes **up through the ceiling** — the ceiling edge passes, then
the roof line, then nothing. The slab detaches from the floor and drifts up with us, slowly
rotating, its tether paying out below. "between the stars": a field of a few hundred bone
points; the lyric words are placed **as constellation labels** in mono beside stars, with
hairline leader lines, one word per sung word, forming a loose constellation that happens to be
the shape of the seam. "And forget about all this": far below, out of focus, the verse's objects
(frames, pieces, phone) slide past along the seam and go. "No deadlines / No expectations / No
voices in my head": each **NO** is a slam in the lyric voice, and on each one an object is erased
on the kick: a hairline calendar page (`DUE`), a checklist, a speech-bubble outline — each wiped
with a single horizontal stroke. "I don't wanna leave this world / I just wanna leave it for a
bit": the camera looks straight down the tether: the seam is a hairline far below with one amber
point on it (home), and the tether is taut. *For a bit* is set small beside the amber point. The
hook repeat follows.

### 9 `drive` — "Sometimes I drive with no destination"
Hard cut on the downbeat: the seam is now the **horizon of a night road**, seen through a
windshield, hairline lane markings rushing toward the seam in perspective, stars above. The
machine voice is the dashboard at the bottom: `2:14 AM · RADIO 88.7 · NAV: DESTINATION —`.
"Radio low, windows down": the radio glow dips; the mono text shivers like wind. The lyric
arrives on **road signs** that pass on the beat, each line a sign, each word lit by the
headlights as sung. "Trying to outrun the noise": notifications appear in the **rear-view
mirror**, mono, stacking; ASKS resumes 23 → 31. "That somehow always sticks around": the
notifications are also in the windshield reflection; the road speeds up, the mirror does not change.

### 10 `apart` — "People think I'm doing great"
The room again, wall and seam. **Text bubbles** (hairline rounded rectangles, mono) stack on the
wall on the kicks: `you're killing it`, `so proud of you`, `can you look at this real quick`,
`you good?`, `need that by Friday`. ASKS 31 → 40. "Maybe that's the hardest part": the reply
field at the bottom; the lyric is **typed as the reply** in the lyric voice, then deleted
character by character before it is sent. "Being surrounded by everybody": the bubbles crowd in
from all four edges until the lyric has no room. "While feeling miles apart": the bubbles
**recede along the seam** into perspective, each a mile farther, a mono distance under each
(`1.2 mi`, `3.8 mi`, `12 mi`…), until they are dots on the horizon and the frame is empty but
for the seam.

### 11 `voicemail` — "Got memories that haunt me" (one shot)
The quietest plate. A **voicemail player** in the machine voice, centred: `Dad · 0:42 · saved`.
The seam is its **waveform**: the hairline thickens into a quiet audio trace. The lyric rides the
waveform as the amber scrubber passes under each word; the words are the only thing in the lyric
voice on screen. "Got questions with no replies": question marks are typed into a reply field;
the cursor blinks; nothing comes back. "Got a father that I miss": the progress bar is the only
motion in the frame. "And old voicemails I still play sometimes": on *play*, the trace replays
from the start, dimmer, over the live one — an echo. No cuts, no shake, no bloom except the
LED-sized dot of the scrubber. Hold the last frame for a full bar.

### 12 `scars` — "Got dreams that keep me moving"
The slab, close, filling the frame. "Got dreams that keep me moving": the amber point runs along
the seam at the slab's base, pulling the slab forward a step per beat. "And scars that keep me
real": hairline **cracks** are drawn into the slab's face on the snares, one per word; they stay.
"Most days I'm strong enough": the slab stands upright, the lyric carved into it. "Some days I
just wanna feel nothing": on **nothing**, everything drops out for exactly one bar — grain off,
bloom off, vignette off, type weight 900 → 300, the amber goes grey. The only moment in the
video with no texture. Then the grain returns with the pre-chorus.

## Plates 13–17: the switch-off and the dawn

### 13 `breath` — "Not forever / just long enough to breathe"
The seam alone again. "Not forever": *forever* is set along the seam and runs off the right edge;
the amber point follows it and turns back. "Just long enough to breathe": the seam becomes a
**breath trace** — a slow sine, one inhale and one exhale per bar, the lyric riding the crest.
On *breathe* the trace rounds into a ring that expands to the frame's edges; the ring is the
door; the camera goes through it into chorus 2 (hook n=2).

### 14 `carry` — "Maybe I'm tired of carrying"
Back on the floor, after the second drift. The slab sits on the seam, bigger than before.
"Things nobody else can see": the slab is covered in labels that are **invisible** — bone on
bone — readable only where the lamp sweeps across (a moving light revealing `rent`, `her`,
`the call I didn't make`, `dad`, `Monday`, `being fine`). "Maybe I'm tired of being / everything
everybody needs": the pieces of ME from plate 3 return and try to reassemble on the slab, wrong —
the letters don't fit back. "Maybe I don't need fixing / Maybe I just need peace": the **one
serif italic line** of the video, Cormorant, bone, centred on the wall above the seam, no bloom.
The cracks in the slab are not repaired. The camera stops moving for the first time since the
voicemail. "Maybe I just need one night / where the world doesn't ask for me": ASKS appears in
mono under the line, ticks once to 41, then its cursor blinks and does not tick again.

### 15 `silence` — the breakdown
Seven lines, seven hard cuts, every one on a downbeat, every one switching something off.
Nothing is added, only removed.
1. "No phone ringing": the phone from plate 5, face-up, glowing — the glow dies. ASKS 41 → 34.
2. "No notifications": the text bubbles from plate 10 — wiped with one horizontal stroke each. ASKS → 20.
3. "No pressure": the slab lifts off the seam and floats up out of the frame on its tether. ASKS → 12.
4. "No proving myself": the certificate frames from plate 4 — contents blank to paper, then the frames fade. ASKS → 6.
5. "No pretending": the reply field from plate 10, with `I'm good` typed in it — deleted, the field closes. ASKS → 1.
6. "Just silence": black. The grain only. ASKS 00 shown once, small, then gone. The machine voice does not return until the outro.
7. "Just breathing": the breath trace from plate 13, amber, alone, one slow cycle. The seam is the only thing in the world.

### 16 `under` — the final chorus (after hook n=3)
The hairline hook hands off to the star field, but now from far below: the seam is a hairline at
the bottom with the amber point on it, and the words are small, high, drifting. "Somewhere the
guilt can't find me / Somewhere the past can't reach": **GUILT** and **PAST** are set below the
seam, upside down, and hairline tendrils grow up from them toward the floating words and fall
short, every time, on the beat. "Somewhere I can hear myself again / underneath the noise": the
frame fills with dense mono text — every label and notification from the whole video, scrolling
— and it **parts** down the middle like curtains to reveal the lyric line in the lyric voice,
bone, quiet. "And when I'm ready / I'll come back stronger": the tether **tightens**: a slow
pull, the floating words descending a little, the slab at the top of the frame descending too.
"But tonight": the pull stops. "I just wanna drift": release — the words loosen, rise again, and
the tether goes slack, a soft curve instead of a straight line.

### 17 `tomorrow` — the outro and the loop
The room from the floor, the seam in its place. The sky above the wall is not black any more:
the **dawn** accent bleeds along the seam from the right, the one time a second warm tone
appears. "Tomorrow I'll keep fighting / Tomorrow I'll keep building / Tomorrow I'll keep carrying
the weight": the three TOMORROWs stack on the wall in the lyric voice, each one a beat, each a
little bolder; on *weight* the slab lowers back to the floor and lands softly on the seam, where
it will be picked up. The clock returns, mono, top-left: `05:58 AM`. "But tonight…": everything
on the wall dims; the clock's seconds stop. "Let me drift": the amber point lifts off the seam
one last time and rises slowly on its tether, and the camera tilts up with it until the seam
becomes the ceiling edge of plate 1. The clock reads `04:37 AM`. The last frame is the first
frame; the video loops.

## Hand-offs to make continuous (check with `render.ts sheet --cuts`)

- Seam position (y) across every cut.
- The amber point's screen position into and out of `break`, `breath`, `silence`, `tomorrow`.
- The slab's size and tether angle between `stars`, `carry`, `silence` step 3 and `under`.
- The clock's position between `seam` and `tomorrow`.

## timeline.ts skeleton

```ts
const b = {
  ceiling:   cut('Another morning'),
  pieces:    cut('Everybody needs a piece'),
  wall:      cut('Built a life'),
  dark:      cut('But none of that gets quiet'),
  break1:    cut("I'm not looking for an ending"),
  hook1:     cut("I don't wanna die", 0),
  stars1:    cut('Float somewhere', 0),
  drive:     cut('Sometimes I drive'),
  apart:     cut('People think'),
  voicemail: cut('Got memories'),
  scars:     cut('Got dreams'),
  breath:    cut('Not forever'),
  hook2:     cut("I don't wanna die", 2),   // chorus 1 sings it twice (0, 1)
  stars2:    cut('Float somewhere', 1),
  carry:     cut("Maybe I'm tired of carrying"),
  silence:   cut('No phone ringing'),
  hook3:     cut("I don't wanna die", 5),   // chorus 2 sings it three times (2, 3, 4)
  under:     cut('Somewhere the guilt'),
  tomorrow:  cut("Tomorrow I'll keep fighting"),
  end:       au.duration,
};
return [
  E('seam','seam', 0, b.ceiling),
  E('ceiling','ceiling', b.ceiling, b.pieces),
  E('pieces','pieces', b.pieces, b.wall),
  E('wall','wall', b.wall, b.dark),
  E('dark','dark', b.dark, b.break1),
  E('break','break', b.break1, b.hook1),
  E('hook1','hook', b.hook1, b.stars1, { params: { n: 1 } }),
  E('stars1','stars', b.stars1, b.drive),
  E('drive','drive', b.drive, b.apart),
  E('apart','apart', b.apart, b.voicemail),
  E('voicemail','voicemail', b.voicemail, b.scars),
  E('scars','scars', b.scars, b.breath),
  E('breath','breath', b.breath, b.hook2),
  E('hook2','hook', b.hook2, b.stars2, { params: { n: 2 } }),
  E('stars2','stars', b.stars2, b.carry),
  E('carry','carry', b.carry, b.silence),
  E('silence','silence', b.silence, b.hook3),
  E('hook3','hook', b.hook3, b.under, { params: { n: 3 } }),
  E('under','under', b.under, b.tomorrow),
  E('tomorrow','tomorrow', b.tomorrow, b.end),
];
```

The `nth` indices are confirmed against the lyric sheet: chorus 1 sings "I don't wanna die"
twice (0, 1), chorus 2 three times (2, 3, 4 — it ends on the hook sung twice), the final chorus
once (5). `hook` owns only the first occurrence in each chorus; `stars` picks up the rest as its
exit (in chorus 2, `stars2` owns the double hook at its end). Re-check against
`data/lyrics.json` after alignment.

## Build order

Engine port + placeholder karaoke first (KICKOFF.md Phase 3). Then the spine, so the motif is
proven early: `seam` → `hook` → `break` → `stars` → `silence` → `tomorrow`. Then the verse plates.
`voicemail` last, when the tone is known.
