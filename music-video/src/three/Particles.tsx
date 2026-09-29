import React, { useLayoutEffect, useMemo, useRef } from "react";
import { Cam, H, project, W } from "../utils/camera";
import { rng } from "../utils/random";

type Box = { x: [number, number]; y: [number, number]; z: [number, number] };

/**
 * Atmospheric dust / particle field drawn on canvas with the shared camera
 * projection, so it parallaxes correctly against the CSS-3D stage.
 */
export const ParticleField: React.FC<{
  cam: Cam;
  count?: number;
  box?: Box;
  seed?: number;
  size?: number;
  color?: string;
  opacity?: number;
  /** world-space drift per frame */
  drift?: [number, number, number];
  frame: number;
  /** optional per-particle brightness modulation (0..1) */
  twinkle?: number;
  blueRatio?: number;
}> = ({
  cam,
  count = 400,
  box = { x: [-3000, 3000], y: [-1600, 1600], z: [-4000, 800] },
  seed = 1,
  size = 2.2,
  color = "255,255,255",
  opacity = 0.5,
  drift = [0, -0.4, 0],
  frame,
  twinkle = 0.5,
  blueRatio = 0.12,
}) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const pts = useMemo(() => {
    const r = rng(seed);
    return Array.from({ length: count }, () => ({
      x: box.x[0] + r() * (box.x[1] - box.x[0]),
      y: box.y[0] + r() * (box.y[1] - box.y[0]),
      z: box.z[0] + r() * (box.z[1] - box.z[0]),
      b: 0.35 + r() * 0.65,
      ph: r() * Math.PI * 2,
      blue: r() < blueRatio,
    }));
  }, [count, seed, box.x[0], box.x[1], box.y[0], box.y[1], box.z[0], box.z[1], blueRatio]);

  useLayoutEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, W, H);
    const hY = box.y[1] - box.y[0];
    for (const p of pts) {
      // wrap drift inside the box so the field never empties
      let y = p.y + drift[1] * frame;
      y = box.y[0] + ((((y - box.y[0]) % hY) + hY) % hY);
      const x = p.x + drift[0] * frame;
      const z = p.z + drift[2] * frame;
      const pr = project([x, y, z], cam, 60);
      if (!pr.visible || pr.x < -20 || pr.x > W + 20 || pr.y < -20 || pr.y > H + 20) continue;
      const tw = 1 - twinkle + twinkle * (0.5 + 0.5 * Math.sin(frame * 0.07 + p.ph));
      const a = opacity * p.b * tw * Math.min(1, pr.s * 1.6);
      const r = Math.max(0.5, size * pr.s);
      ctx.fillStyle = `rgba(${p.blue ? "0,178,227" : color},${a})`;
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  return <canvas ref={ref} width={W} height={H} style={{ position: "absolute", left: 0, top: 0, width: W, height: H }} />;
};
