import React, { createContext, useContext } from "react";
import { Cam, focal, H, toCam, W } from "../utils/camera";

const CamCtx = createContext<Cam | null>(null);
export const useCam = () => {
  const c = useContext(CamCtx);
  if (!c) throw new Error("useCam outside <Stage3D>");
  return c;
};

/**
 * A real perspective stage built from CSS 3D transforms. Children are placed
 * with <Obj/> in world px. The same Cam drives canvas layers via project().
 */
export const Stage3D: React.FC<{ cam: Cam; children: React.ReactNode; style?: React.CSSProperties }> = ({
  cam,
  children,
  style,
}) => {
  const P = focal(cam.fov);
  return (
    <CamCtx.Provider value={cam}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          width: W,
          height: H,
          overflow: "hidden",
          perspective: `${P}px`,
          perspectiveOrigin: "50% 50%",
          ...style,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 0,
            height: 0,
            transformStyle: "preserve-3d",
            transform: `translateZ(${P}px) rotateZ(${-cam.rz}deg) rotateX(${-cam.rx}deg) rotateY(${-cam.ry}deg) translate3d(${-cam.x}px, ${-cam.y}px, ${-cam.z}px)`,
          }}
        >
          {children}
        </div>
      </div>
    </CamCtx.Provider>
  );
};

type ObjProps = {
  x?: number;
  y?: number;
  z?: number;
  rx?: number;
  ry?: number;
  rz?: number;
  scale?: number;
  /** Anchor of the child box: "center" | "left" | "right" | "bottom-left" … */
  anchor?: "center" | "left" | "right" | "top-left" | "bottom-left" | "bottom-right" | "bottom" | "top";
  /** Hide when behind / too close to camera (default true). */
  cull?: boolean;
  near?: number;
  opacity?: number;
  children?: React.ReactNode;
  style?: React.CSSProperties;
};

const anchorT: Record<NonNullable<ObjProps["anchor"]>, string> = {
  center: "translate(-50%,-50%)",
  left: "translate(0,-50%)",
  right: "translate(-100%,-50%)",
  "top-left": "translate(0,0)",
  "bottom-left": "translate(0,-100%)",
  "bottom-right": "translate(-100%,-100%)",
  bottom: "translate(-50%,-100%)",
  top: "translate(-50%,0)",
};

/** An object placed in the Stage3D world. */
export const Obj: React.FC<ObjProps> = ({
  x = 0,
  y = 0,
  z = 0,
  rx = 0,
  ry = 0,
  rz = 0,
  scale = 1,
  anchor = "center",
  cull = true,
  near = 40,
  opacity = 1,
  children,
  style,
}) => {
  const cam = useCam();
  if (cull) {
    const [, , cz] = toCam([x, y, z], cam);
    if (-cz < near) return null;
  }
  if (opacity <= 0.001) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        transformStyle: "preserve-3d",
        transform: `translate3d(${x}px, ${y}px, ${z}px) rotateY(${ry}deg) rotateX(${rx}deg) rotateZ(${rz}deg) scale(${scale})`,
        opacity,
      }}
    >
      <div style={{ position: "absolute", left: 0, top: 0, transform: anchorT[anchor], ...style }}>{children}</div>
    </div>
  );
};
