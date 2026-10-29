"""Storyboard board: rendered key frames + captions -> one tall PNG.
python3 scripts/board.py <frames_dir> <out.png>"""
import sys, glob, os
from PIL import Image, ImageDraw, ImageFont
d, out = sys.argv[1], sys.argv[2]
CAP = [
 ("01 INTRO", "0:02", "Blueprint: the room is drawn in lines while the strings swell."),
 ("01 INTRO", "0:05", "NOBODY HANDED ME NOTHING! slams in; HUD tracks RUDO."),
 ("01 INTRO", "0:10", "So I built it! Lettered bricks drop and stack, seen from the side."),
 ("01 INTRO", "0:14", "Orbit round his head; RUDO in line engraving; EYES locked."),
 ("01 INTRO", "0:17", "The 808: the wall splits; we turn and the wall becomes the ground."),
 ("01 INTRO", "0:23", "Skimming the concrete, chasing the white-hot crack."),
 ("02 VERSE 1", "0:36", "Inside the crack: a canyon of cables; IT terminal logs each line."),
 ("03 PRE-CHORUS", "0:54", "Every word is a step; the climb follows the vocal."),
 ("04 CHORUS", "0:59", "Lid blows out: the wall is a rooftop at night, RUDO at the edge."),
 ("04 CHORUS", "1:16", "\"universe\" pulls the camera up into the stars."),
 ("05 POST-CHORUS", "1:22", "Shouted lines stamped into concrete slabs floating in the dark."),
 ("06 VERSE 2", "1:44", "The flip house, gutted: rip up the floors, tile shatters."),
 ("06 VERSE 2", "1:48", "Frame up the walls: studs rise around the camera."),
 ("06 VERSE 2", "1:51", "Hang the drywall, feather the mud to a mirror finish."),
 ("06 VERSE 2", "2:00", "Average is a cage: bars close round the line, then break."),
 ("07 PRE-CHORUS 2", "2:17", "Same stairs, outside, climbing out of the house into the light."),
 ("08 CHORUS 2", "2:27", "Sunrise deck in pale silver; RUDO at the edge."),
 ("09 VERSE 3", "2:48", "Midnight desk: every bar becomes a brick in a wall of words."),
 ("09 VERSE 3", "2:59", "The wall is two storeys of verse by the end."),
 ("10 BRIDGE", "3:06", "Half-time hallway: handwritten lines, falling dust, the shoes."),
 ("11 FINAL CHORUS", "3:17", "Everything lifts: room, house frame and slabs rise with us."),
 ("12 POST-CHORUS", "3:34", "Back through the slabs, faster."),
 ("13 OUTRO", "3:48", "Back in the room, cracks glowing: STILL GRINDING! Cut to black."),
]
fs = sorted(glob.glob(os.path.join(d, "*.jpg")))
assert len(fs) == len(CAP), (len(fs), len(CAP))
ims = [Image.open(f) for f in fs]
w, h = ims[0].size
cols, pad, caph = 4, 28, 118
rows = (len(ims) + cols - 1) // cols
head = 170
W = cols * w + (cols + 1) * pad
H = head + rows * (h + caph + pad) + pad
sheet = Image.new("RGB", (W, H), (14, 14, 14))
dr = ImageDraw.Draw(sheet)
def font(sz, bold=False):
    for p in ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]:
        if os.path.exists(p): return ImageFont.truetype(p, sz)
    return ImageFont.load_default()
dr.text((pad, 40), "SHOUT IT TO THE SKY  ·  RUDO", font=font(46, True), fill=(236, 234, 230))
dr.text((pad, 104), "Storyboard key frames, rendered from the 3D engine. Grey palette, line-engraved world, letter-fill type.", font=font(22), fill=(150, 148, 144))
for i, (im, (sec, tc, cap)) in enumerate(zip(ims, CAP)):
    x = pad + (i % cols) * (w + pad)
    y = head + (i // cols) * (h + caph + pad)
    sheet.paste(im, (x, y))
    dr.text((x, y + h + 12), f"{sec}   {tc}", font=font(20, True), fill=(236, 234, 230))
    # wrap caption
    words, line, ly = cap.split(), "", y + h + 44
    for wd in words:
        if dr.textlength(line + " " + wd, font=font(17)) > w:
            dr.text((x, ly), line, font=font(17), fill=(160, 158, 154)); ly += 23; line = wd
        else:
            line = (line + " " + wd).strip()
    dr.text((x, ly), line, font=font(17), fill=(160, 158, 154))
sheet.save(out, optimize=True)
print(out, sheet.size)
