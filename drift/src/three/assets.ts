import { useEffect, useState } from "react";
import * as THREE from "three";
import { Font } from "three/examples/jsm/loaders/FontLoader.js";
import { continueRender, delayRender, staticFile } from "remotion";
import { rng } from "../utils/random";

export type Assets = {
  bebas: Font;
  oswald: Font;
  inter: Font;
  caveat: Font;
  concrete: THREE.Texture;
  concreteBump: THREE.Texture;
};

// ---------------------------------------------------------------------------------------------
// Procedural knockdown concrete: layered value noise, flattened trowel splats with a lit edge
// and a shadowed edge, and a few water stains. Same seed -> same pixels on every render.
const makeConcrete = (size = 1024) => {
  const r = rng(4242);
  const col = document.createElement("canvas");
  col.width = col.height = size;
  const bump = document.createElement("canvas");
  bump.width = bump.height = size;
  const c = col.getContext("2d")!;
  const b = bump.getContext("2d")!;
  c.fillStyle = "#77716a";
  c.fillRect(0, 0, size, size);
  b.fillStyle = "#808080";
  b.fillRect(0, 0, size, size);

  const noiseLayer = (cells: number, alpha: number, ctx: CanvasRenderingContext2D, lo: number, hi: number) => {
    const n = document.createElement("canvas");
    n.width = n.height = cells;
    const nc = n.getContext("2d")!;
    const img = nc.createImageData(cells, cells);
    for (let i = 0; i < cells * cells; i++) {
      const v = lo + r() * (hi - lo);
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    nc.putImageData(img, 0, 0);
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = true;
    // draw tiled 3x3 so the upscaled noise wraps seamlessly
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) ctx.drawImage(n, dx * size, dy * size, size, size);
    ctx.globalAlpha = 1;
  };
  noiseLayer(8, 0.35, c, 60, 170);
  noiseLayer(32, 0.22, c, 70, 160);
  noiseLayer(128, 0.16, c, 60, 180);
  noiseLayer(512, 0.18, c, 40, 200);
  noiseLayer(64, 0.25, b, 90, 160);

  // knockdown splats
  for (let i = 0; i < 2600; i++) {
    const x = r() * size;
    const y = r() * size;
    const rx = 3 + r() * 13;
    const ry = rx * (0.5 + r() * 0.5);
    const rot = r() * Math.PI;
    const blob = (ctx: CanvasRenderingContext2D, ox: number, oy: number, fill: string) => {
      for (const [wx, wy] of [[0, 0], [size, 0], [-size, 0], [0, size], [0, -size]]) {
        ctx.beginPath();
        // lumpy ellipse
        for (let k = 0; k <= 12; k++) {
          const a = (k / 12) * Math.PI * 2;
          const j = 0.75 + r() * 0.35;
          const px = x + wx + ox + Math.cos(a) * rx * j * Math.cos(rot) - Math.sin(a) * ry * j * Math.sin(rot);
          const py = y + wy + oy + Math.cos(a) * rx * j * Math.sin(rot) + Math.sin(a) * ry * j * Math.cos(rot);
          if (k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.fillStyle = fill;
        ctx.fill();
      }
    };
    const tone = 120 + Math.floor(r() * 40);
    blob(c, 1.2, 1.2, "rgba(20,18,16,0.12)");
    blob(c, -0.6, -0.6, "rgba(235,228,215,0.06)");
    blob(c, 0, 0, `rgba(${tone},${tone - 4},${tone - 10},0.22)`);
    blob(b, 0, 0, "rgba(200,200,200,0.6)");
  }
  // stains and pores
  for (let i = 0; i < 14; i++) {
    const x = r() * size,
      y = r() * size,
      rad = 60 + r() * 220;
    const g = c.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, `rgba(30,26,22,${0.12 + r() * 0.15})`);
    g.addColorStop(1, "rgba(30,26,22,0)");
    c.fillStyle = g;
    c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  for (let i = 0; i < 2500; i++) {
    const x = r() * size,
      y = r() * size,
      s = 0.6 + r() * 1.8;
    c.fillStyle = `rgba(15,13,11,${0.25 + r() * 0.4})`;
    c.fillRect(x, y, s, s);
    b.fillStyle = "rgba(20,20,20,0.9)";
    b.fillRect(x, y, s, s);
  }
  const tex = new THREE.CanvasTexture(col);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const btex = new THREE.CanvasTexture(bump);
  btex.wrapS = btex.wrapT = THREE.RepeatWrapping;
  return { tex, btex };
};

let cache: Assets | null = null;
let pending: Promise<Assets> | null = null;

const loadFont = async (file: string) => {
  const { FontLoader } = await import("three/examples/jsm/loaders/FontLoader.js");
  const json = await fetch(staticFile(file)).then((r) => r.json());
  return new FontLoader().parse(json);
};
export const loadTex = (file: string) =>
  new Promise<THREE.Texture>((res) =>
    new THREE.TextureLoader().load(staticFile(file), (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      res(t);
    }),
  );

const load = () => {
  if (!pending) {
    pending = (async () => {
      await document.fonts.ready;
      const [bebas, oswald, inter, caveat] = await Promise.all([
        loadFont("fonts/bebas.typeface.json"),
        loadFont("fonts/oswald700.typeface.json"),
        loadFont("fonts/inter800.typeface.json"),
        loadFont("fonts/caveat500.typeface.json"),
      ]);
      const { tex, btex } = makeConcrete();
      cache = { bebas, oswald, inter, caveat, concrete: tex, concreteBump: btex };
      return cache;
    })();
  }
  return pending;
};

/** Loads fonts + textures outside the r3f canvas (so the first rendered frame already has them). */
export const useAssets = () => {
  const [assets, setAssets] = useState<Assets | null>(cache);
  const [handle] = useState(() => (cache ? null : delayRender("3d assets")));
  useEffect(() => {
    if (assets || handle === null) return;
    load().then((a) => {
      setAssets(a);
      continueRender(handle);
    });
  }, [assets, handle]);
  return assets;
};
