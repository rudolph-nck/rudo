import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { FPS, linesOf } from "../data";
import { W, H } from "../theme";
import { useIntroAssets } from "../intro/Scene3D";
import { RailView, buildRail } from "./Rail";

/** Look-dev for kinetic rails: verse 1 written along one cable, the spark lighting it. */
export const RailTest: React.FC<{ from: number }> = ({ from }) => {
  const t = useCurrentFrame() / FPS + from;
  const a = useIntroAssets();
  const rail = useMemo(() => (a ? buildRail(linesOf("verse1"), a.font, { seed: 11, size: 0.16 }) : null), [a]);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {rail ? (
        <ThreeCanvas width={W} height={H} gl={{ antialias: true }}>
          <RailView rail={rail} t={t} />
        </ThreeCanvas>
      ) : null}
    </AbsoluteFill>
  );
};
