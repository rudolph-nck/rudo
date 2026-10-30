import React, { useMemo } from "react";
import * as THREE from "three";
import { useAssets } from "../three/assets";
import { Stage } from "../three/Stage";
import { lightMat } from "../three/materials";
import { LINES, heroOf } from "../data";
import { clamp01 } from "../utils/ease";
import { rng } from "../utils/random";
import { Glow } from "../words/points";
import { Finish, Full } from "./kit";

/** CARVE (soft): FATHER cut into concrete by the hot point, by hand, slowly; the fresh groove glows and cools. */
const LI = 45;
const S = 2048, WORLD = 6; // canvas px, plane size in metres
const SEG = [
  { text: "Got a", px: 150, wi: [0, 1] },
  { text: "father", px: 300, wi: [2, 2] },
  { text: "that I miss", px: 150, wi: [3, 5] },
];
const font = (px: number) => `500 ${px}px Caveat`;

const useCarve = (a: ReturnType<typeof useAssets>) =>
  useMemo(() => {
    if (!a) return null;
    const mk = () => { const c = document.createElement("canvas"); c.width = c.height = S; return c; };
    const bump = mk(), glow = mk(), mask = mk();
    const mctx = mask.getContext("2d")!;
    const ws = SEG.map((sg) => { mctx.font = font(sg.px); return mctx.measureText(sg.text).width; });
    const tw = Math.max(...ws);
    const rowY = [S / 2 - 250, S / 2 + 10, S / 2 + 270];
    const shift = [-120, 0, 90]; // handwritten: rows don't line up
    const lay = SEG.map((sg, i) => ({ ...sg, x0: S / 2 - ws[i] / 2 + shift[i], x1: S / 2 + ws[i] / 2 + shift[i], cy: rowY[i] }));
    const bt = new THREE.CanvasTexture(bump), gt = new THREE.CanvasTexture(glow);
    gt.colorSpace = THREE.SRGBColorSpace;
    const cmap = a.concrete.clone(); cmap.wrapS = cmap.wrapT = THREE.RepeatWrapping; cmap.repeat.set(2.5, 2.5); cmap.needsUpdate = true;
    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color("#9d968d"), map: cmap, bumpMap: bt, bumpScale: 5, roughness: 0.92, emissive: new THREE.Color("#ffd9ae"), emissiveMap: gt, emissiveIntensity: 1.6 });
    return { bump, glow, bt, gt, mat, tw, lay };
  }, [a]);

export const SFFather: React.FC<{ t: number }> = ({ t }) => {
  const a = useAssets();
  const w = heroOf(LI);
  const c = useCarve(a);
  const sparks = useMemo(() => {
    const r = rng(3); const n = 160;
    const pos = new Float32Array(n * 3), seed = new Float32Array(n), br = new Float32Array(n);
    for (let i = 0; i < n; i++) { seed[i] = r(); br[i] = 0.4 + r() * 1.2; }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("seed", new THREE.BufferAttribute(seed, 1));
    g.setAttribute("bright", new THREE.BufferAttribute(br, 1));
    return g;
  }, []);
  if (!a || !c) return <Full>{null}</Full>;
  // the head follows the voice: it crosses each segment while its words are sung
  const words = LINES[LI].words;
  let row = -1, headX = 0, p = 0;
  c.lay.forEach((sg, i) => {
    const t0 = words[sg.wi[0]].s, t1 = Math.max(t0 + 0.4, words[sg.wi[1]].e);
    if (t >= t0) { row = i; const u = clamp01((t - t0) / (t1 - t0)); headX = sg.x0 + (sg.x1 - sg.x0) * u; p = (i + u) / c.lay.length; }
  });
  // everything in finished rows is cut; the current row is cut up to the head
  const clipCut = (ctx: CanvasRenderingContext2D) => {
    ctx.beginPath();
    c.lay.forEach((sg, i) => { if (i < row) ctx.rect(0, sg.cy - sg.px, S, sg.px * 2); else if (i === row) ctx.rect(0, sg.cy - sg.px, headX, sg.px * 2); });
    ctx.clip();
  };
  const drawLine = (ctx: CanvasRenderingContext2D) => c.lay.forEach((sg) => { ctx.font = font(sg.px); ctx.fillText(sg.text, sg.x0, sg.cy); });
  const cy = row >= 0 ? c.lay[row].cy : S / 2;
  // height: concrete bump + the groove (dark = deep), cut up to the head
  const b = c.bump.getContext("2d")!;
  b.globalCompositeOperation = "source-over";
  b.fillStyle = "#808080"; b.fillRect(0, 0, S, S); b.globalAlpha = 0.45;
  for (let ix = 0; ix < 3; ix++) for (let iy = 0; iy < 3; iy++) b.drawImage(a.concreteBump.image as CanvasImageSource, (ix * S) / 2.5, (iy * S) / 2.5, S / 2.5, S / 2.5);
  b.globalAlpha = 1;
  b.save(); clipCut(b);
  b.textBaseline = "middle"; b.textAlign = "left";
  b.filter = "blur(8px)"; b.fillStyle = "rgba(0,0,0,0.85)"; drawLine(b);
  b.filter = "blur(2px)"; b.fillStyle = "rgba(10,10,10,1)"; drawLine(b);
  b.restore(); b.filter = "none";
  // glow: fresh groove near the head is hot, cooling behind it
  const g = c.glow.getContext("2d")!;
  g.clearRect(0, 0, S, S); g.fillStyle = "#000"; g.fillRect(0, 0, S, S);
  g.save(); g.beginPath(); if (row >= 0) g.rect(0, c.lay[row].cy - c.lay[row].px, headX, c.lay[row].px * 2); g.clip();
  const grad = g.createLinearGradient(headX - 360, 0, headX, 0);
  grad.addColorStop(0, "rgba(255,200,150,0.0)"); grad.addColorStop(0.8, "rgba(255,215,170,0.08)"); grad.addColorStop(1, "rgba(255,245,230,1)");
  g.textBaseline = "middle"; g.textAlign = "left"; g.fillStyle = grad;
  g.filter = "blur(2px)"; drawLine(g); g.restore(); g.filter = "none";
  c.bt.needsUpdate = true; c.gt.needsUpdate = true;
  // head in world space (find the stroke under the head column: brightest y of the glyph there)
  const hx = (headX / S - 0.5) * WORLD;
  const col = b.getImageData(Math.max(0, Math.min(S - 1, Math.round(headX - 4))), 0, 1, S).data;
  let best = cy, bv = 255;
  const band = row >= 0 ? c.lay[row] : null;
  if (band) for (let y = Math.round(band.cy - band.px * 0.6); y < band.cy + band.px * 0.6; y += 3) { const v = col[y * 4]; if (v < bv) { bv = v; best = y; } }
  const hy = -(best / S - 0.5) * WORLD;
  // sparks spray from the head
  const sp = sparks.attributes.position as THREE.BufferAttribute;
  const r = rng(Math.floor(t * 30));
  for (let i = 0; i < sp.count; i++) {
    const life = (t * 1.7 + i / sp.count) % 1, ang = (i * 2.399) % (Math.PI * 2);
    const v = 0.4 + ((i * 0.618) % 1) * 1.2;
    sp.setXYZ(i, hx + Math.cos(ang) * v * life * 0.35, hy + Math.sin(ang) * v * life * 0.22 - life * life * 0.5, 0.03 + life * 0.25 * ((i * 0.37) % 1));
  }
  sp.needsUpdate = true; void r;
  const carving = row >= 0 && p < 1 && t < words[5].e + 0.1;
  return (
    <Full>
      <Stage cam={{ pos: [0.6, -0.15, 6.4], look: [0, 0.0, 0], fov: 40 }} look={{ exposure: 1.05, env: 0.05, bloom: { strength: 0.5, radius: 0.45, threshold: 0.8 }, bg: "#050505", dof: { focus: 6.2, aperture: 0.0015, maxblur: 0.006 } }}>
        <directionalLight position={[-6, 1.2, 0.9]} intensity={8} color="#efe6da" />
        <ambientLight intensity={0.05} />
        <mesh material={c.mat}><planeGeometry args={[WORLD, WORLD]} /></mesh>
        {carving ? (
          <>
            <pointLight position={[hx, hy, 0.25]} intensity={0.8} distance={3} decay={2} color="#ffd6a6" />
            <mesh position={[hx, hy, 0.02]} material={lightMat("#fff4e6", 6)}><sphereGeometry args={[0.022, 16, 16]} /></mesh>
            <Glow geo={sparks} size={1.6} gain={0.9} time={t} twinkle={0.6} />
          </>
        ) : null}
      </Stage>
      <Finish grain={0.1} />
    </Full>
  );
};
