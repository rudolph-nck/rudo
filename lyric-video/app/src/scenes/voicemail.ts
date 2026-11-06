// Plate 11 `voicemail` — "Got memories that haunt me / Got questions with no replies / Got a father that I
// miss / And old voicemails I still play sometimes" (docs/TREATMENT-drift.md). The quietest plate, one shot:
// no cuts, no shake, no zoom, no bloom except the LED-sized scrubber.
//  - It opens on `apart`'s last frame (seam at SEAM_Y, "While feeling / miles apart" on the wall, ASKS 40 on
//    the seam at the right); "apart" is sung past the cut, so it finishes lighting here, then goes.
//  - A voicemail player in the machine voice, centred: `VOICEMAIL`, `Dad · 0:42 · saved`. The seam is its
//    waveform: the hairline thickens into a quiet audio trace (Dad's message, then the silence before the
//    click, flat under ASKS). The played part is bone, the rest dust; the amber scrubber is the LED.
//  - The lyric rides the trace's crest, row by row, lit word by word as the scrubber passes under it; between
//    rows the scrubber is drawn back (he rewinds) and the old row sinks into the trace.
//  - "Got questions with no replies": a question mark typed into a reply field per word; the cursor blinks;
//    nothing comes back; the field closes. "Got a father that I miss": the scrubber is the only motion.
//  - On *play* the trace replays from the start, dimmer, over the live one (an echo); the scrubber runs to the
//    end and the echo fades. The last frame is that still frame, drawn by voicemail-player.ts's
//    drawVoicemailHold(), which `scars` uses to open on exactly this frame and hold it to its first downbeat.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { clearRT, Layer2D } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { VOICEMAIL_CLEAR, voicemailPlayer } from './voicemail-player';

export default class Voicemail extends Scene {
  private layer = new Layer2D();
  private lb = new LineBatch(2048, { screen2D: true, blend: 'add' });

  override init() { voicemailPlayer(this.ctx.lyrics); }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer } = this.ctx;
    const p = voicemailPlayer(this.ctx.lyrics);
    this.layer.clear();
    this.lb.clear();
    p.draw(this.layer.ctx, this.lb, f.t, f.t); // frozen at the hold time once everything has settled
    clearRT(renderer, out, VOICEMAIL_CLEAR);
    this.ctx.comp.draw(renderer, this.layer.upload(), out);
    this.lb.render(renderer, out);
    return {};
  }
}
