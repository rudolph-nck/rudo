// Plate 5 `dark` — "But none of that gets quiet / When the darkness starts to call" (docs/TREATMENT-drift.md).
//  - The plate opens exactly where `wall` leaves off: until the downbeat, `wall` itself is rendered as the
//    paper underneath (bone paper, the frames, "on the wall" — whose last word is sung after the cut and
//    is lit here by wall's own karaoke). On "But" the first certificate is wiped blank and the line is set
//    in its place, ink on paper.
//  - On the downbeat the lamp goes out: the plate flips to ink. The certificates stay as faint bone
//    hairlines (wall-frames.ts: exactly where `wall` hung them), with a brief afterimage; "But none of that"
//    / "gets quiet" stand inside the two title frames, bone, sung glyph by glyph.
//  - A phone lies face-down on the floor by the seam. On every strong kick (≥ 0.4) its screen glows
//    lamp-amber through the gap under it and the polished floor reflects it: the only light in the frame.
//    Each buzz adds an ASK on the gallery card `wall` hung beside the frames (15 → 22; 7 strong kicks in
//    this window, so the last buzz adds two — the treatment's fallback).
//  - "When the darkness starts to call": the camera pushes slowly toward the phone through the whole line
//    (a dolly: the wall plane scales a little, the floor near the camera a lot; both about the seam, so the
//    seam keeps its y). On "call" the phone turns over on its own, landing face-up on the kick:
//    `Unknown · calling…` in mono, no accept button. The last buzz floods the bottom of the frame, then
//    the screen switches off like a CRT — to a line, to a point: the amber point that `break` opens with,
//    at HANDOFF.phoneGlow, scale 1.6, with the slab on the seam and the room light at 0.3.
import type * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { clearRT, FSPass, Layer2D, makeRT } from '../engine/gl';
import { LineBatch } from '../engine/lines';
import { Lyrics, type Line, type Word } from '../engine/lyrics';
import { LIN, rgba } from '../engine/palette';
import { F, fitSize, font, layout, type TextLayout } from '../engine/type';
import { clamp, ease, lerp, smoothstep } from '../engine/util';
import { amberPoint, amberTail, HAIR, HANDOFF, roomLight2D, seam, SEAM_Y, SLAB, slab2D } from './_motifs';
import { drawWallFrames2D, frameCorners, WALL_FRAMES } from './wall-frames';
import Wall from './wall';

const LYR = F.archivo(62.5, 900);
const MONO = F.mono(400);
const CX = 540; // the push is about (CX, SEAM_Y)
// the dolly: the wall plane scales 1 → ZW, the phone on the near floor 1 → ZP
const ZW = 1.15;
const ZP = 2.0;
// the phone (world px at zoom 1): length, depth, thickness; seen from 45° above the floor
const PL = 170, PS = 80, PT = 9;
const SIN = Math.SQRT1_2, COS = Math.SQRT1_2;
// its floor centre: chosen so the face-up screen's centre lands exactly on HANDOFF.phoneGlow at ZP
const PX = CX, PY = SEAM_Y + (HANDOFF.phoneGlow.y - SEAM_Y) / ZP + PT * COS;
// the slab in wall-plane coordinates: at ZW it is exactly `break`'s slab (screen x −80, SLAB size)
const SLAB_W = { x: CX - 620 / ZW, w: SLAB.w / ZW, h: SLAB.h / ZW };
// the ASKS gallery card `wall` hung (wall.ts askLabel)
const CARD = { x: 846, y: 1036, w: 114, h: 78 };
const CALLING = 'Unknown · calling…';

type P2 = { x: number; y: number };
interface PWord { w: Word; x: number; L: TextLayout }
interface Row { words: PWord[]; size: number; y: number }

const GLOW_FRAG = /* glsl */ `
uniform vec4 foot;     // phone footprint on screen: centre xy, half size zw
uniform float pool;    // light leaking from the phone (0..)
uniform float fill;    // the last buzz flooding the bottom of the frame
uniform float faceUp;  // 0 face-down (light from the gap: a hot rim) → 1 face-up (a soft pool)
uniform float R;       // radius scale (the push)
uniform float seamY;
float sdBox2(vec2 p, vec2 b) { vec2 q = abs(p) - b; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0); }
void main() {
  vec2 p = vec2(FRAG_PX.x, ${(1920).toFixed(1)} - FRAG_PX.y);
  vec3 col = vec3(0.0);
  float d = max(sdBox2(p - foot.xy, foot.zw), 0.0);
  if (p.y > seamY) {
    // the polished floor: a hot rim at the gap, a pool, a long soft reflection toward the camera
    float rim = exp(-d / (4.0 * R)) * (1.0 - 0.75 * faceUp);
    float near = exp(-d / (34.0 * R));
    float wide = exp(-d / (140.0 * R));
    float below = step(foot.y, p.y);
    float streak = below * exp(-abs(p.x - foot.x) / (foot.z * 0.9)) * exp(-max(p.y - foot.y - foot.w, 0.0) / (240.0 * R));
    col += pool * (C_EMBER * rim * 1.6 + C_LAMP * (near * 0.5 + wide * 0.13 + streak * 0.16));
    // the flood: the bottom of the frame fills with the glow
    float fl = exp(-d / (420.0 * R)) * (0.55 + 0.45 * smoothstep(seamY, ${(1920).toFixed(1)}, p.y));
    col += fill * C_LAMP * fl * 0.32;
  } else {
    // the wall catches a little of it, just above the seam
    vec2 q = (p - vec2(foot.x, seamY)) / vec2(520.0 * R, 300.0 * R);
    col += (pool * 0.07 + fill * 0.08) * C_LAMP * exp(-length(q) * 2.2);
  }
  fragColor = vec4(col, 1.0);
}`;

export default class Dark extends Scene {
  private wall!: Wall;
  private layer = new Layer2D(); // the room: frames, slab, words, the card
  private phoneL = new Layer2D(); // the phone (in front of the seam)
  private glowRT = makeRT();
  private glow = new FSPass(GLOW_FRAG, {
    foot: { value: [0, 0, 1, 1] }, pool: { value: 0 }, fill: { value: 0 }, faceUp: { value: 0 }, R: { value: 1 }, seamY: { value: SEAM_Y },
  });
  private lb = new LineBatch(64, { screen2D: true, blend: 'add' });
  private lbTop = new LineBatch(256, { screen2D: true, blend: 'add' });

  private l1!: Line;
  private l2!: Line;
  private rows1: Row[] = []; // [in frame 1, in frame 2]
  private rows2: Row[] = [];
  private tFlip = 0; // the downbeat: the lamp goes out
  private kicks: { t: number; add: number }[] = [];
  private tCall = 0; // the phone starts to turn over ("call")
  private tLand = 0; // ... and lands face-up (on the kick)
  private tPush0 = 0;
  private tc0 = 0; // the screen collapses: to a line ...
  private tc1 = 0; // ... to a point
  private tc2 = 0; // the point alone

  override async init() {
    const { lyrics, audio, start, end } = this.ctx;
    // `wall`, rendered underneath until the downbeat: its window per the timeline's cutDown('Built a life')
    const s = lyrics.get('Built a life').words[0]!.start + 0.02;
    const d = [...audio.downbeats].reverse().find((x) => x <= s);
    const wallStart = d !== undefined && audio.beatAt(s) - audio.beatAt(d) <= 1 ? d : audio.timeOfBeat(Math.floor(audio.beatAt(s)));
    this.wall = new Wall({ ...this.ctx, id: 'wall', start: wallStart, end: start });
    await this.wall.init();

    const mine = lyrics.lines.filter((l) => l.start >= start - 0.05 && l.start < end);
    this.l1 = mine.find((l) => /none of that/i.test(l.text)) ?? lyrics.get('But none of that gets quiet');
    this.l2 = mine.find((l) => /darkness/i.test(l.text)) ?? lyrics.get('When the darkness starts to call');

    this.tFlip = audio.downbeats.find((x) => x > start + 0.05 && x < this.l1.end) ?? this.l1.words[0]!.start;

    // the buzzes: every strong kick in the window; the last ones add two if there are fewer than 8
    const strong = audio.events('kick', start, end).filter(([, st]) => st >= 0.4).map(([k]) => k);
    const extra = Math.max(0, 8 - strong.length);
    this.kicks = strong.map((k, i) => ({ t: k, add: i >= strong.length - extra ? 2 : 1 }));

    const call = this.l2.words.find((w) => /call/i.test(w.w)) ?? this.l2.words[this.l2.words.length - 1]!;
    this.tCall = call.start;
    this.tLand = strong.find((k) => k > call.start + 0.1 && k < call.start + 0.45) ?? call.start + 0.22;
    this.tPush0 = this.l2.words[0]!.start;
    this.tc0 = end - 0.15;
    this.tc1 = end - 0.075;
    this.tc2 = end - 0.03;

    // line 1: one row in each title certificate
    const [f1, f2] = [WALL_FRAMES[0]!, WALL_FRAMES[1]!];
    const w1 = this.l1.words;
    const split = w1.findIndex((w) => /gets/i.test(w.w));
    const k = split > 0 ? split : Math.ceil(w1.length / 2);
    this.rows1 = [this.row(w1.slice(0, k), f1.w - 130, 150, 0), this.row(w1.slice(k), f2.w - 140, 170, 0)];
    this.rows1.forEach((r, i) => { r.y = (i ? f2 : f1).h * 0 + r.size * 0.34; });

    // line 2: three rows on the wall just above the seam, left of the card, right of the slab
    const w2 = this.l2.words;
    const di = w2.findIndex((w) => /darkness/i.test(w.w));
    const si = w2.findIndex((w) => /starts/i.test(w.w));
    const parts = di > 0 && si > di ? [w2.slice(0, di), w2.slice(di, si), w2.slice(si)] : [w2];
    const x0 = 330, maxW = 490;
    const size2 = Math.min(...parts.map((p) => fitSize(p.map((w) => w.w).join(' '), LYR, maxW, 132, 0.01 * 100)));
    this.rows2 = parts.map((p, i) => {
      const r = this.row(p, maxW, size2, x0);
      r.y = SEAM_Y - 46 - (parts.length - 1 - i) * size2 * 0.9;
      return r;
    });
  }

  /** A row of words at one size (≤ maxSize, fitted to maxW); x: absolute left, or 0 = centred on 0. */
  private row(ws: Word[], maxW: number, maxSize: number, x0: number): Row {
    const text = ws.map((w) => w.w).join(' ');
    const size = Math.min(maxSize, fitSize(text, LYR, maxW, maxSize));
    const tr = 0.01 * size;
    const L = layout(text, LYR, size, tr);
    const left = x0 || -L.width / 2;
    const words: PWord[] = [];
    let ci = 0;
    for (const w of ws) {
      words.push({ w, x: left + (L.glyphs[ci]?.x ?? 0), L: layout(w.w, LYR, size, tr) });
      ci += Array.from(w.w).length + 1;
    }
    return { words, size, y: 0 };
  }

  // ------------------------------------------------------------------------------------- timing
  /** The phone's glow pulse: a fast attack on each strong kick, a lamp-like decay. */
  private buzz(t: number) {
    let b = 0;
    for (const k of this.kicks) {
      const a = t - k.t;
      if (a < 0) continue;
      b = Math.max(b, Math.min(1, a / 0.018) * Math.pow(0.5, Math.max(0, a - 0.018) / 0.17));
    }
    return b;
  }

  private asks(t: number) {
    let n = 14;
    for (const k of this.kicks) if (t >= k.t) n += k.add;
    return n;
  }

  private lastAsk(t: number) {
    let last = -Infinity;
    for (const k of this.kicks) if (t >= k.t) last = k.t;
    return last;
  }

  /** The push: 0 → 1 through the second line, settled just before the cut. */
  private push(t: number) {
    return inOutSine(clamp((t - this.tPush0) / (this.tc2 - this.tPush0)));
  }

  // ------------------------------------------------------------------------------------- render
  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t;
    if (t < this.tFlip) return this.renderPaper(f, out);
    return this.renderDark(f, out);
  }

  /** Before the downbeat: `wall`'s paper continues; on "But" the first certificate is wiped and the line set in it. */
  private renderPaper(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t;
    const post = this.wall.render(f, out) ?? {};
    const c = this.layer.ctx;
    this.layer.clear();
    const t0 = this.l1.words[0]!.start;
    const wipe = ease.inOutCubic(clamp((t - (t0 - 0.16)) / 0.14));
    if (wipe > 0) {
      const fr = WALL_FRAMES[0]!;
      c.save();
      c.translate(fr.x, fr.y);
      c.rotate(fr.rot);
      const iw = fr.w - 30, ih = fr.h - 30;
      c.fillStyle = rgba('bone', 1);
      c.fillRect(-iw / 2, -ih / 2, iw * wipe, ih);
      c.font = font(LYR, this.rows1[0]!.size);
      c.letterSpacing = `${0.01 * this.rows1[0]!.size}px`;
      this.drawRow(c, this.rows1[0]!, t, 'ink', 'ink', 1);
      c.restore();
    }
    this.ctx.comp.draw(this.ctx.renderer, this.layer.upload(), out);
    return post;
  }

  private renderDark(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp } = this.ctx;
    const t = f.t;
    const k = this.push(t);
    const zw = lerp(1, ZW, k), zp = lerp(1, ZP, k);
    const buzz = this.buzz(t);
    // the end: everything but the point goes, the room comes back to `break`'s 0.3
    const endUp = inOutSine(clamp((t - (this.ctx.end - 0.5)) / (this.tc2 - (this.ctx.end - 0.5))));
    const out0 = 1 - smoothstep(this.tc0 - 0.1, this.tc1, t); // things that leave before the cut
    const after = smoothstep(this.tFlip, this.tFlip + 0.9, t); // the afterimage of the lit room fades

    // ---------------------------------------------------------------- the room (wall-plane layer)
    const c = this.layer.ctx;
    this.layer.clear();
    roomLight2D(c, SEAM_Y, { intensity: 0.3 * endUp + 0.22 * (1 - smoothstep(this.tFlip, this.tFlip + 0.25, t)) });
    // the slab: drawn in screen space (its texture unscaled, as `break` draws it)
    const sx = CX + zw * (SLAB_W.x - CX), sw = SLAB_W.w * zw, sh = SLAB_W.h * zw;
    slab2D(c, sx, SEAM_Y - sh, sw, sh, { lit: 0.3, alpha: lerp(0.4, 0.9, endUp), edge: lerp(0.4, 1, endUp) });
    c.save();
    c.translate(CX, SEAM_Y); c.scale(zw, zw); c.translate(-CX, -SEAM_Y);
    // the certificates: faint bone hairlines (an afterimage first), gone by the cut
    drawWallFrames2D(c, { color: 'bone', alpha: lerp(0.3, 0.1, after) * (1 - endUp * 0.9), width: HAIR / zw });
    // line 1, in the two title frames
    const fade1 = 1 - smoothstep(this.tPush0 - 0.05, this.tPush0 + 0.3, t);
    if (fade1 > 0) {
      this.rows1.forEach((r, i) => {
        const fr = WALL_FRAMES[i]!;
        c.save();
        c.translate(fr.x, fr.y); c.rotate(fr.rot);
        c.font = font(LYR, r.size);
        c.letterSpacing = `${0.01 * r.size}px`;
        this.drawRow(c, r, t, 'bone', 'bone', fade1);
        c.restore();
      });
    }
    // line 2, standing on the wall over the phone, underlit by it
    const fade2 = 1 - smoothstep(this.tc0 - 0.25, this.tc1, t);
    if (fade2 > 0) {
      for (const r of this.rows2) {
        c.save();
        c.translate(0, r.y);
        c.font = font(LYR, r.size);
        c.letterSpacing = `${0.01 * r.size}px`;
        this.drawRow(c, r, t, 'bone', 'lamp', fade2);
        c.restore();
      }
    }
    this.card(c, t, out0);
    c.restore();
    c.letterSpacing = '0px';

    // ---------------------------------------------------------------- the phone
    const ph = this.phone(t, zp, buzz);

    clearRT(renderer, out, LIN.ink);
    comp.draw(renderer, this.layer.upload(), out);

    // its light on the floor and the wall
    const flood = this.kicks.length ? this.floodAt(t) : 0;
    const coll = 1 - smoothstep(this.tc0, this.tc2, t);
    const u = this.glow.u;
    u.foot!.value = [ph.foot.x, ph.foot.y, ph.foot.hx, ph.foot.hy];
    u.pool!.value = ph.pool * coll;
    u.fill!.value = flood * coll;
    u.faceUp!.value = ph.up;
    u.R!.value = zp;
    this.glow.render(renderer, this.glowRT);
    comp.draw(renderer, this.glowRT.texture, out, { mode: 'add' });

    // the seam: dimmer in the dark, back to full by the cut
    this.lb.clear();
    seam(this.lb, SEAM_Y, { intensity: lerp(0.5, 1, endUp), width: HAIR });
    this.lb.render(renderer, out);

    comp.draw(renderer, this.phoneL.upload(), out);

    // the screen switching off: a hot line, then the point (`break`'s first frame)
    const lt = this.lbTop;
    lt.clear();
    if (t >= this.tc0 && t < this.tc1 + 0.02) {
      const a = clamp((t - this.tc0) / (this.tc1 - this.tc0));
      const hw = ph.screenHalfW * (1 - ease.inCubic(clamp((t - (this.tc0 + 0.3 * (this.tc1 - this.tc0))) / (0.7 * (this.tc1 - this.tc0)))));
      const I = smoothstep(0.1, 0.5, a) * (1 - smoothstep(0.85, 1, a));
      lt.seg2(HANDOFF.phoneGlow.x - hw, HANDOFF.phoneGlow.y, HANDOFF.phoneGlow.x + hw, HANDOFF.phoneGlow.y, 3, [LIN.lamp[0] * 2.2 * I, LIN.lamp[1] * 2.2 * I, LIN.lamp[2] * 2.2 * I], 1);
    }
    const pt = smoothstep(this.tc0 + 0.6 * (this.tc1 - this.tc0), this.tc2, t);
    if (pt > 0) {
      const at = () => ({ x: HANDOFF.phoneGlow.x, y: HANDOFF.phoneGlow.y });
      amberTail(lt, t, at, { len: 0.45, intensity: 0.8 * pt });
      amberPoint(lt, HANDOFF.phoneGlow.x, HANDOFF.phoneGlow.y, t, 1.6 * lerp(0.4, 1, pt), pt);
    }
    lt.render(renderer, out);

    return { zoom: 1 + 0.006 * f.a.kick };
  }

  /** The last buzz floods the bottom of the frame (it builds from the landing and peaks on the last kick). */
  private floodAt(t: number) {
    const last = this.kicks[this.kicks.length - 1]!.t;
    const a = t - last;
    if (a < 0) return 0.25 * smoothstep(this.tLand, last, t);
    return Math.min(1, a / 0.02) * (0.6 + 0.4 * Math.pow(0.5, a / 0.2));
  }

  /** ASKS on `wall`'s gallery card: hairline in the dark, the number lit for a moment on each buzz. */
  private card(c: CanvasRenderingContext2D, t: number, vis: number) {
    if (vis <= 0.001) return;
    const after = smoothstep(this.tFlip, this.tFlip + 0.9, t);
    const lit = Math.pow(0.5, Math.max(0, t - this.lastAsk(t)) / 0.22);
    c.save();
    c.globalAlpha = vis;
    c.strokeStyle = rgba('bone', lerp(0.3, 0.14, after));
    c.lineWidth = HAIR;
    c.strokeRect(CARD.x, CARD.y, CARD.w, CARD.h);
    c.font = font(MONO, 15);
    c.fillStyle = rgba('dust', 0.5);
    c.fillText('ASKS', CARD.x + 14, CARD.y + 26);
    c.font = font(F.mono(500), 34);
    const n = String(this.asks(t)).padStart(2, '0');
    c.fillStyle = rgba('bone', 0.6 * (1 - lit));
    c.fillText(n, CARD.x + 14, CARD.y + 64);
    if (lit > 0.01) { c.fillStyle = rgba('lamp', lit); c.fillText(n, CARD.x + 14, CARD.y + 64); }
    c.restore();
  }

  /** A row of words: dim ≤ 0.4 s early, `sung` glyph by glyph while sung, then `rest`. */
  private drawRow(c: CanvasRenderingContext2D, r: Row, t: number, rest: string, sung: string, alpha: number) {
    for (const pw of r.words) {
      const w = pw.w;
      if (t < w.start - 0.4) continue;
      const pre = smoothstep(w.start - 0.4, w.start - 0.2, t);
      const p = Lyrics.wordProgress(w, t), n = pw.L.glyphs.length;
      const settled = rest === 'ink' ? 0.92 : lerp(0.9, 0.62, smoothstep(w.end + 0.5, w.end + 1.5, t));
      for (const g of pw.L.glyphs) {
        const lit = t >= w.start && t < w.end ? clamp(p * n - g.i) : 0;
        const base = t < w.start ? 0.28 * pre : t >= w.end ? settled : 0.28;
        if (lit < 1) { c.fillStyle = rgba(rest, base * (1 - lit) * alpha); c.fillText(g.ch, pw.x + g.x, 0); }
        if (lit > 0) { c.fillStyle = rgba(sung, (sung === 'lamp' ? 1 : 0.92) * lit * alpha); c.fillText(g.ch, pw.x + g.x, 0); }
      }
    }
  }

  // ------------------------------------------------------------------------------------- the phone
  /**
   * The phone, a box on the floor seen 45° from above (orthographic: affine faces), turning about its long
   * axis on "call". Draws into the phone layer; returns where its light comes from.
   */
  private phone(t: number, zp: number, buzz: number) {
    const c = this.phoneL.ctx;
    this.phoneL.clear();
    const th = Math.PI * ease.inOutCubic(clamp((t - this.tCall) / (this.tLand - this.tCall)));
    const up = smoothstep(Math.PI * 0.5, Math.PI, th);
    const coll = 1 - smoothstep(this.tc0, this.tc2, t);
    const jit = Math.sin(t * 2 * Math.PI * 31) * 1.6 * buzz * (1 - up * 0.6) * coll;
    const cs = Math.cos(th), sn = Math.sin(th);
    const lift = (PS / 2) * Math.abs(sn) + (PT / 2) * Math.abs(cs);
    const P = (x: number, y: number, z: number): P2 => {
      const Y = y * cs - z * sn, Z = y * sn + z * cs + lift;
      const wx = PX + x + jit, wy = PY + Y * SIN - Z * COS;
      return { x: CX + zp * (wx - CX), y: SEAM_Y + zp * (wy - SEAM_Y) };
    };
    const hx = PL / 2, hy = PS / 2, hz = PT / 2;
    // faces: [corners (local), local normal]
    const faces: { q: [number, number, number][]; n: [number, number, number]; id: string }[] = [
      { id: 'back', n: [0, 0, 1], q: [[-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]] },
      { id: 'screen', n: [0, 0, -1], q: [[-hx, hy, -hz], [hx, hy, -hz], [hx, -hy, -hz], [-hx, -hy, -hz]] },
      { id: 'near', n: [0, 1, 0], q: [[-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [-hx, hy, -hz]] },
      { id: 'far', n: [0, -1, 0], q: [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz]] },
    ];
    const vis = (n: [number, number, number]) => { const ny = n[1] * cs - n[2] * sn, nz = n[1] * sn + n[2] * cs; return ny * COS + nz * SIN; };
    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
    // screen light (face-up: a steady incoming call; each buzz brightens it)
    const sI = (0.78 + 0.3 * buzz) * up;
    const body = lerp(1, 0.35, 1 - coll);
    let screenHalfW = 0;
    for (const fc of faces) {
      const pts = fc.q.map(([x, y, z]) => P(x, y, z));
      for (const p of pts) { bx0 = Math.min(bx0, p.x); bx1 = Math.max(bx1, p.x); by0 = Math.min(by0, p.y); by1 = Math.max(by1, p.y); }
      const v = vis(fc.n);
      if (v <= 0.002) continue;
      c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); c.closePath();
      if (fc.id === 'back') {
        c.fillStyle = rgba('ink', 1); c.fill();
        c.fillStyle = rgba('concrete', 0.55 * body); c.fill();
        c.strokeStyle = rgba('dust', 0.16 * body); c.lineWidth = HAIR; c.stroke();
      } else if (fc.id === 'screen') {
        c.fillStyle = rgba('ink', 1); c.fill();
        c.strokeStyle = rgba('dust', 0.2 * body); c.lineWidth = HAIR; c.stroke();
        // the screen, in face coordinates (u right, v down the screen as read from the camera)
        const o = P(-hx, hy, -hz), ux = P(hx, hy, -hz), vy = P(-hx, -hy, -hz);
        const a = (ux.x - o.x) / PL, b = (ux.y - o.y) / PL, cc = (vy.x - o.x) / PS, d = (vy.y - o.y) / PS;
        screenHalfW = ((PL - 16) / 2) * Math.hypot(a, b);
        c.save();
        c.transform(a, b, cc, d, o.x, o.y);
        this.screen(c, t, sI, coll);
        c.restore();
      } else {
        c.fillStyle = rgba('ink', 0.97); c.fill();
        // the edge nearest the floor catches the light from the gap
        if (fc.id === 'near' && up < 0.5) {
          const e0 = P(-hx, hy, -hz), e1 = P(hx, hy, -hz);
          c.strokeStyle = rgba('lamp', (0.1 + 0.6 * buzz) * (1 - up * 2)); c.lineWidth = HAIR * 1.4;
          c.beginPath(); c.moveTo(e0.x, e0.y); c.lineTo(e1.x, e1.y); c.stroke();
        }
      }
    }
    // the light: face-down only the gap leaks (on the kicks), face-up the screen lights the floor
    const pool = lerp(0.07 + 1.05 * buzz, 0.42 + 0.55 * buzz, up);
    const foot = { x: (bx0 + bx1) / 2, y: (by0 + by1) / 2, hx: (bx1 - bx0) / 2, hy: (by1 - by0) / 2 };
    return { foot, pool, up, screenHalfW };
  }

  /** The screen face (face coordinates PL × PS, read from the camera): lamp, `Unknown · calling…`, nothing to answer with. */
  private screen(c: CanvasRenderingContext2D, t: number, sI: number, coll: number) {
    if (sI <= 0.001) return;
    const m = 7;
    const w = PL - 2 * m, h = PS - 2 * m;
    // switching off: the lit area collapses vertically about its centre
    const sy = 1 - ease.inCubic(clamp((t - this.tc0) / (this.tc1 - this.tc0)));
    if (sy <= 0.001) return;
    const cy = PS / 2;
    const g = c.createRadialGradient(PL / 2, cy, 4, PL / 2, cy, w * 0.62);
    g.addColorStop(0, rgba('lamp', Math.min(1, 0.98 * sI)));
    g.addColorStop(1, rgba('ember', Math.min(1, 0.8 * sI)));
    c.fillStyle = g;
    c.fillRect(m, cy - (h / 2) * sy, w, h * sy);
    const ta = clamp(sI) * smoothstep(0.55, 0.9, sy) * coll;
    if (ta <= 0.01) return;
    c.save();
    c.beginPath(); c.rect(m, cy - (h / 2) * sy, w, h * sy); c.clip();
    c.fillStyle = rgba('ink', 0.92 * ta);
    const size = 13.8;
    c.font = font(MONO, size);
    const L = layout(CALLING, MONO, size);
    c.fillText(CALLING, (PL - L.width) / 2, cy + size * 0.36);
    c.restore();
  }
}

const inOutSine = (x: number) => 0.5 - 0.5 * Math.cos(Math.PI * x);
