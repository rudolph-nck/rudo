import React, { useMemo } from "react";
import { AbsoluteFill } from "remotion";
import * as THREE from "three";
import { Font } from "three/examples/jsm/loaders/FontLoader.js";
import { Line } from "../data";
import { SAFE } from "../theme";
import { F } from "../utils/fonts";
import { Grain, Vignette } from "../fx/Post";
import { glyphGeo, layout } from "../words/glyphs";

export const INK = "#efede9";
export const STONE = "#c4b6a2";
export const DRIFT = "#a9b7c4";
export const GHOST = "rgba(239,237,233,0.2)";

/** Quiet caption: the sung line, letters lighting as they're sung; the hero word is skipped
 *  (it is on screen as the effect) or shown in stone. */
export const Caption: React.FC<{ line: Line; t: number; hero?: string; top?: number; size?: number; align?: "left" | "center"; o?: number }> = ({
  line, t, hero, top = SAFE.top, size = 38, align = "left", o = 1,
}) => (
  <div style={{ position: "absolute", left: SAFE.left, top, width: SAFE.right - SAFE.left, fontFamily: F.grotesk, fontWeight: 500, fontSize: size, lineHeight: 1.25, letterSpacing: "-0.01em", textAlign: align, opacity: o, textShadow: "0 2px 18px rgba(0,0,0,0.85)" }}>
    {line.words.map((w, wi) => {
      const isHero = hero && w.w.toLowerCase().replace(/[^a-z']/g, "") === hero.toLowerCase().replace(/[^a-z']/g, "");
      const dur = Math.max(0.12, (w.e - w.s) * 0.8);
      return (
        <span key={wi}>
          {[...w.w].map((ch, li) => {
            const lit = t >= w.s + (dur * li) / w.w.length;
            return (
              <span key={li} style={{ color: !lit ? GHOST : isHero ? STONE : INK }}>{ch}</span>
            );
          })}{" "}
        </span>
      );
    })}
  </div>
);

export const Finish: React.FC<{ grain?: number; vignette?: number }> = ({ grain = 0.09, vignette = 0.65 }) => (
  <>
    <Vignette strength={vignette} />
    <Grain opacity={grain} />
  </>
);

export type XF = { p: [number, number, number]; r?: [number, number, number]; s?: number; hide?: boolean };

/** A word as separate 3D letters so each can move on its own. xf(i) places letter i. */
export const Letters: React.FC<{
  font: Font; family: string; text: string; size: number; depth: number; material: THREE.Material | ((i: number) => THREE.Material);
  tracking?: number; bevel?: number; xf?: (i: number, x: number) => XF; shadows?: boolean;
  position?: [number, number, number]; rotation?: [number, number, number];
}> = ({ font, family, text, size, depth, material, tracking = 0, bevel = 0.02, xf, shadows = true, position, rotation }) => {
  const { letters } = useMemo(() => layout(font, text, size, tracking), [font, text, size, tracking]);
  return (
    <group position={position} rotation={rotation}>
      {letters.map((L, i) => {
        if (L.ch === " ") return null;
        const x = xf ? xf(i, L.x) : { p: [L.x, 0, 0] as [number, number, number] };
        if (x.hide) return null;
        return (
          <mesh key={i} geometry={glyphGeo(font, L.ch, size, depth, family, bevel)} material={typeof material === "function" ? material(i) : material}
            position={x.p} rotation={x.r} scale={x.s ?? 1} castShadow={shadows} receiveShadow={shadows} />
        );
      })}
    </group>
  );
};

/** Backfaces darkened: clipped (broken) solids read as filled stone, not hollow shells. */
export const solidify = <M extends THREE.Material>(m: M, inside = 0.08) => {
  m.side = THREE.DoubleSide;
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace("#include <dithering_fragment>", `#include <dithering_fragment>\n if (!gl_FrontFacing) gl_FragColor.rgb *= ${inside.toFixed(3)};`);
  };
  return m;
};

export const Full: React.FC<{ children: React.ReactNode; bg?: string }> = ({ children, bg = "#050505" }) => (
  <AbsoluteFill style={{ background: bg }}>{children}</AbsoluteFill>
);
