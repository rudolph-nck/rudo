// Global overlay. RUDO has no global HUD: the clock, ASKS and every readout are staged inside the
// plates (docs/STYLE.md). This stays as an empty, transparent layer so the post pass keeps one
// overlay slot; it is uploaded once and never redrawn.
import { Layer2D } from './gl';

export class Hud {
  layer = new Layer2D();
  private tex: ReturnType<Layer2D['upload']> | null = null;

  draw() {
    if (!this.tex) { this.layer.clear(); this.tex = this.layer.upload(); }
    return this.tex;
  }
}
