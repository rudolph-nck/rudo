import React, { useLayoutEffect, useRef } from "react";
import { Cam, focal, H, toCam, V3, W } from "../utils/camera";

export type Seg3 = {
  a: V3;
  b: V3;
  color?: string; // "r,g,b"
  alpha?: number;
  /** width in world px (scaled by depth) — or fixed screen px if `px` */
  width?: number;
  px?: boolean;
  glow?: number;
};

const NEAR = 30;

/**
 * World-space line renderer on canvas with near-plane clipping, sharing the
 * camera model with <Stage3D/>. Used for roads, graticules, rails, rays.
 */
export const Lines3D: React.FC<{ cam: Cam; segs: Seg3[]; opacity?: number; fadeFar?: number }> = ({ cam, segs, opacity = 1, fadeFar = 0 }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = "butt";
    const P = focal(cam.fov);
    for (const s of segs) {
      let A = toCam(s.a, cam);
      let B = toCam(s.b, cam);
      let da = -A[2],
        db = -B[2];
      if (da < NEAR && db < NEAR) continue;
      if (da < NEAR) {
        const t = (NEAR - da) / (db - da);
        A = [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, -NEAR];
        da = NEAR;
      } else if (db < NEAR) {
        const t = (NEAR - db) / (da - db);
        B = [B[0] + (A[0] - B[0]) * t, B[1] + (A[1] - B[1]) * t, -NEAR];
        db = NEAR;
      }
      const sa = P / da,
        sb = P / db;
      const x1 = W / 2 + A[0] * sa,
        y1 = H / 2 + A[1] * sa,
        x2 = W / 2 + B[0] * sb,
        y2 = H / 2 + B[1] * sb;
      const w = s.px ? s.width ?? 1.5 : Math.max(0.6, ((s.width ?? 4) * (sa + sb)) / 2);
      let alpha = (s.alpha ?? 1) * opacity;
      if (fadeFar > 0) alpha *= Math.max(0, Math.min(1, 1 - (Math.min(da, db) - fadeFar * 0.4) / (fadeFar * 0.6)));
      if (alpha <= 0.003) continue;
      ctx.strokeStyle = `rgba(${s.color ?? "255,255,255"},${alpha})`;
      ctx.lineWidth = Math.min(w, 60);
      if (s.glow) {
        ctx.shadowColor = `rgba(${s.color ?? "0,178,227"},${0.8 * alpha})`;
        ctx.shadowBlur = s.glow;
      } else ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  });
  return <canvas ref={ref} width={W} height={H} style={{ position: "absolute", left: 0, top: 0, width: W, height: H }} />;
};
