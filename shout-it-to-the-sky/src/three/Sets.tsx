import React, { useMemo } from "react";
import * as THREE from "three";
import { Assets } from "./assets";
import { Mats } from "./materials";
import { Burst, Panel, outOf, pointsGeo } from "./common";
import { FillLine, SparkBurst, TypeMats, layoutWords } from "./Type";
import { DECK, DO, HALL, HO, HOUSE, PRE2_WORDS, SLABS, STAIR2, camAt, lineAnchor, step2Pos } from "./layout";
import { Line, kickEnv, linesOf } from "../data";
import { clamp01, cubicIn, cubicOut, expoOut } from "../utils/ease";
import { rng } from "../utils/random";

type P = { t: number; a: Assets; M: Mats; TM: TypeMats; SP: THREE.Material };
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);
const UNIT = new THREE.BoxGeometry(1, 1, 1);
const UNIT_EDGES = new THREE.EdgesGeometry(UNIT);
const v3 = (o: THREE.Vector3, x: number, y: number, z: number) => new THREE.Vector3(o.x + x, o.y + y, o.z + z);
const miniLine = (w: Line["words"][number], id: string, section: string): Line => ({ id, section, text: w.w, style: "rap", words: [w], start: w.s, end: w.e, anchored: 1 });

// ---------------------------------------------------------------------------------------------
/** Chorus lines launched off the ground ahead of the camera; they burst into silver embers. */
export const ChorusFlares: React.FC<P & { id: string; up: THREE.Vector3; emberMat: THREE.ShaderMaterial }> = ({ t, a, TM, SP, id, up, emberMat }) => (
  <>
    {linesOf(id).map((l, i) => {
      const out = outOf(l, 1.1);
      if (t < l.start - 0.1 || t > out + 2.3) return null;
      const c0 = camAt(l.start);
      const c1 = camAt(out);
      const fwd = c1.look.clone().sub(c1.pos).normalize();
      const at = c1.pos.clone().addScaledVector(fwd, 4.6).addScaledVector(up, 0.55);
      const chant = /grinding/i.test(l.text);
      const s = 1 + (chant ? kickEnv(t, 0.12) * 0.08 : 0);
      return (
        <React.Fragment key={l.id}>
          <Panel at={at} face={c0.pos.clone().lerp(c1.pos, 0.5)} up={up} tilt={[0, (i % 2 ? 1 : -1) * 0.12, 0]}>
            <group scale={s}>
              <FillLine font={a.inter} line={l} t={t} size={/universe/i.test(l.text) ? 0.5 : 0.44} maxW={2.2} mats={TM} out={out} chant={chant} sparks={SP} />
              {chant ? <SparkBurst t={t} at={l.start} origin={[1.0, -0.1, 0.05]} count={260} rate={110} speed={4.2} spread={0.35} gravity={[0, -6, 0]} mat={SP} seed={i * 31 + id.length} life={0.6} dir={[1, 0.45, 0.3]} /> : null}
            </group>
          </Panel>
          <Burst t={t} at={out} center={at} up={up} spread={2.4} mat={emberMat} seed={i * 17 + 3 + id.length} />
        </React.Fragment>
      );
    })}
  </>
);

// ---------------------------------------------------------------------------------------------
/** Post-chorus: concrete slabs in the sky, each shouted line stamped into one. */
export const Slabs: React.FC<P & { id: string }> = ({ t, a, M, TM, SP, id }) => {
  const ls = linesOf(id);
  const extra = useMemo(() => {
    const r = rng(id.length * 7 + 1);
    return Array.from({ length: 18 }, (_, i) => ({ x: (i % 2 ? 1 : -1) * (2.6 + r() * 3), y: SLABS.y0 + (i / 18) * (SLABS.y1 - SLABS.y0) + r() * 2, z: SLABS.z + (r() - 0.5) * 6, rz: (r() - 0.5) * 0.6, s: 0.6 + r() * 1.2 }));
  }, [id]);
  return (
    <group>
      {extra.map((e, i) => (
        <mesh key={i} geometry={UNIT} material={M.wall.m} position={[e.x, e.y, e.z]} rotation={[0.2, 0, e.rz]} scale={[2.6 * e.s, 0.45 * e.s, 1.1 * e.s]} />
      ))}
      {ls.map((l, i) => {
        const c0 = camAt(l.start);
        const at = camAt(l.start + 0.9).pos.clone().add(new THREE.Vector3((i % 2 ? 1 : -1) * 0.55, 4.2, -0.15));
        const press = clamp01((t - l.start) / 0.12);
        return (
          <Panel key={l.id} at={at} face={c0.pos} up={Z} tilt={[0, (i % 2 ? -1 : 1) * 0.18, 0]}>
            <mesh geometry={UNIT} material={M.wall.m} position={[0, 0, -0.32]} scale={[3.1, 1.25, 0.6]} />
            <lineSegments geometry={UNIT_EDGES} material={M.edge} position={[0, 0, -0.32]} scale={[3.11, 1.26, 0.61]} />
            <group position={[0, 0, 0.01 + (1 - press) * 0.25]}>
              <FillLine font={a.inter} line={l} t={t} size={0.2} maxW={2.8} mats={TM} mode={l.style === "impact" ? "slam" : "fill"} sparks={SP} />
            </group>
            <SparkBurst t={t} at={l.start} origin={[0, -0.62, 0.05]} count={90} speed={3.5} spread={1.1} gravity={[0, -7, 0]} mat={SP} seed={i + 40} life={0.6} dir={[0, 0.2, 1]} />
          </Panel>
        );
      })}
    </group>
  );
};

/** House lines hang a steady distance ahead of where the camera is when they start (house-local). */
const houseAnchor = (l: Line) => {
  const c = camAt(l.start + 0.15);
  const fwd = c.look.clone().sub(c.pos).normalize();
  return c.pos.clone().addScaledVector(fwd, 2.5).sub(HO);
};

// ---------------------------------------------------------------------------------------------
/** Verse 2: the flip house, gutted then rebuilt around the camera. */
export const House: React.FC<P> = ({ t, a, M, TM, SP }) => {
  const ls = linesOf("verse2");
  const at = (re: RegExp) => ls.find((l) => re.test(l.text))!;
  const L = { tile: at(/break the tile/i), frame: at(/frame up the walls/i), dry: at(/drywall/i), mud: at(/throw that mud/i), lay: at(/lay that tile/i), cage: at(/average is a cage/i) };
  const breakW = L.tile.words.find((w) => /tile/i.test(w.w))!;

  const studs = useMemo(() => {
    const out: { x: number; z: number; rot: number; k: number }[] = [];
    let k = 0;
    for (let z = HOUSE.z0; z >= HOUSE.z1; z -= 0.41) for (const x of [-HOUSE.halfW, HOUSE.halfW]) out.push({ x, z, rot: 0, k: k++ });
    for (let x = -HOUSE.halfW; x <= HOUSE.halfW; x += 0.41) {
      if (Math.abs(x) > 1.0) out.push({ x, z: -7, rot: Math.PI / 2, k: k++ });
      if (Math.abs(x) > 0.7) out.push({ x, z: HOUSE.z1, rot: Math.PI / 2, k: k++ });
    }
    return out;
  }, []);
  const tiles = useMemo(() => {
    const r = rng(12);
    const out: { x: number; z: number; v: THREE.Vector3; spin: THREE.Vector3; k: number }[] = [];
    let k = 0;
    for (let x = -1.8; x <= 1.8; x += 0.4) for (let z = 0.6; z >= -2.6; z -= 0.4) out.push({ x, z, v: new THREE.Vector3((r() - 0.5) * 3, 2 + r() * 3, (r() - 0.5) * 3), spin: new THREE.Vector3(r() * 9, r() * 9, r() * 9), k: k++ });
    return out;
  }, []);
  const frameP = (k: number, n: number) => expoOut(clamp01((t - L.frame.start - (k / n) * 1.6) / 0.25));
  const dryN = 12;
  const pageTex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 512;
    const x = c.getContext("2d")!;
    x.fillStyle = "#1a1a1a";
    x.fillRect(0, 0, 256, 512);
    x.strokeStyle = "rgba(220,220,220,0.5)";
    for (let i = 0; i < 40; i++) {
      x.beginPath();
      x.moveTo(0, i * 13);
      x.lineTo(256, i * 13 + 6);
      x.stroke();
    }
    return new THREE.CanvasTexture(c);
  }, []);

  return (
    <group position={HO}>
      {/* slab */}
      <mesh geometry={UNIT} material={M.floor.m} position={[0, -0.05, -7]} scale={[14, 0.1, 26]} />
      {/* old tile: shatters on "break the tile" */}
      {tiles.map((tl) => {
        const d = t - breakW.s - (tl.k % 7) * 0.012;
        if (d > 2.2) return null;
        const e = Math.max(0, d);
        return <mesh key={tl.k} geometry={UNIT} material={M.brick.m} position={[tl.x + tl.v.x * e, 0.02 + tl.v.y * e - 4.9 * e * e, tl.z + tl.v.z * e]} rotation={[tl.spin.x * e, tl.spin.y * e, tl.spin.z * e]} scale={[0.38, 0.03, 0.38]} />;
      })}
      {t > breakW.s ? <SparkBurst t={t} at={breakW.s} origin={[0, 0.1, -1]} count={160} speed={4} spread={1.4} gravity={[0, -8, 0]} mat={SP} seed={77} life={0.7} dir={[0, 1, 0.3]} /> : null}
      {/* framing: studs rise on "frame up the walls" */}
      {studs.map((s) => {
        const p = frameP(s.k, studs.length);
        if (p <= 0) return null;
        return (
          <group key={s.k} position={[s.x, 0, s.z]} rotation={[0, s.rot, 0]}>
            <mesh geometry={UNIT} material={M.brick.m} position={[0, (2.4 * p) / 2, 0]} scale={[0.045, 2.4 * p, 0.09]} />
          </group>
        );
      })}
      {/* plates and joists */}
      {t > L.frame.start + 1.2
        ? [-HOUSE.halfW, HOUSE.halfW].flatMap((x) => [0.02, 2.42].map((y) => <mesh key={`${x}${y}`} geometry={UNIT} material={M.brick.m} position={[x, y, (HOUSE.z0 + HOUSE.z1) / 2]} scale={[0.09, 0.045, HOUSE.z0 - HOUSE.z1]} />))
        : null}
      {t > L.frame.start + 1.6
        ? Array.from({ length: 24 }, (_, i) => <mesh key={i} geometry={UNIT} material={M.brick.m} position={[0, 2.5, HOUSE.z0 - i * 0.6]} scale={[HOUSE.halfW * 2, 0.14, 0.045]} />)
        : null}
      {/* drywall sheets on the left wall, one by one */}
      {Array.from({ length: dryN }, (_, i) => {
        const p = cubicOut(clamp01((t - L.dry.start - i * 0.12) / 0.25));
        if (p <= 0) return null;
        return <mesh key={i} geometry={UNIT} material={M.wall.m} position={[-HOUSE.halfW + 0.06, 1.22, HOUSE.z0 - 0.6 - i * 1.2]} scale={[0.02, 2.4 * p, 1.18]} />;
      })}
      {/* mud: the right wall smooths to a mirror finish */}
      {t > L.mud.start ? (
        <mesh position={[HOUSE.halfW - 0.06, 1.22, -7]} rotation={[0, -Math.PI / 2, 0]} scale={[Math.min(1, (t - L.mud.start) / 1.4) * 14, 2.4, 1]}>
          <planeGeometry args={[1, 1]} />
          <meshStandardMaterial color="#c9c8c5" roughness={0.12} metalness={0.6} />
        </mesh>
      ) : null}
      {/* new tile laid in sequence */}
      {t > L.lay.start
        ? tiles.map((tl) => {
            const p = cubicOut(clamp01((t - L.lay.start - tl.k * 0.02) / 0.2));
            if (p <= 0) return null;
            return (
              <group key={tl.k} position={[tl.x, 0.02, tl.z]}>
                <mesh geometry={UNIT} material={M.wall.m} scale={[0.38 * p, 0.03, 0.38 * p]} />
                <lineSegments geometry={UNIT_EDGES} material={M.edge} scale={[0.385 * p, 0.035, 0.385 * p]} />
              </group>
            );
          })
        : null}
      {/* "average is a cage": bars close round the line, then break */}
      {(() => {
        const l = L.cage;
        if (t < l.start || t > l.end + 1.6) return null;
        const anc = houseAnchor(l);
        const close = cubicOut(clamp01((t - l.start) / 0.3));
        const brk = clamp01((t - l.end) / 0.6);
        return (
          <group position={anc}>
            {Array.from({ length: 9 }, (_, i) => {
              const x = (i - 4) * 0.16;
              return <mesh key={i} geometry={UNIT} material={M.tube} position={[x * (1 + brk * 6), 0.25 - (1 - close) * 1.4 + brk * 1.5 * (i % 2 ? 1 : -1), 0.25]} rotation={[0, 0, brk * (i - 4) * 0.3]} scale={[0.012, 0.9, 0.012]} />;
            })}
          </group>
        );
      })()}
      {/* work lights */}
      <pointLight position={[-2, 2.2, -2.5]} intensity={8} distance={12} decay={1.4} color="#f0eeea" />
      <pointLight position={[2, 2.2, -9.5]} intensity={8} distance={12} decay={1.4} color="#f0eeea" />
      <pointLight position={[0, 2.3, 3]} intensity={5} distance={10} decay={1.4} color="#e6e6e6" />
      {/* floating paper plans */}
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i} position={[(i % 2 ? 1 : -1) * 2.6, 1.2 + Math.sin(t * 0.4 + i) * 0.3, -2 - i * 2.2]} rotation={[0.3, t * 0.15 + i, 0.2]}>
          <planeGeometry args={[0.42, 0.6]} />
          <meshBasicMaterial map={pageTex} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {/* the verse: lines hang in the frame, on the camera's path */}
      {ls.map((l, i) => {
        const anc = houseAnchor(l);
        const side = i % 2 ? 1 : -1;
        const from = camAt(l.start).pos.clone().sub(HO);
        if (t > outOf(l, 1.2) + 0.4) return null;
        return (
          <Panel key={l.id} at={anc} face={from} up={Y} tilt={[0, side * 0.1, 0]}>
            <FillLine font={a.inter} line={l} t={t} size={0.1} maxW={0.95} mats={TM} sparks={SP} out={outOf(l, 1.2)} />
          </Panel>
        );
      })}
    </group>
  );
};

// ---------------------------------------------------------------------------------------------
/** Pre-chorus 2 + chorus 2: an outside stair climbs from the house to a deck at sunrise. */
export const Deck: React.FC<P & { emberMat: THREE.ShaderMaterial; sky: THREE.ShaderMaterial }> = (p) => {
  const { t, a, M, TM, sky } = p;
  const pre = linesOf("prechorus2");
  const lastWords = new Set(pre.map((l) => l.words[l.words.length - 1]));
  const asp = (a.rudo.image as HTMLImageElement).width / (a.rudo.image as HTMLImageElement).height;
  const h = 1.36;
  sky.uniforms.uUp.value.set(0, 1, 0);
  sky.uniforms.uFwd.value.set(0, 0, -1);
  sky.uniforms.uSun.value = 1;
  sky.uniforms.uFade.value = 1;
  return (
    <group>
      <mesh material={sky} position={v3(HO, 0, 0, -40)}>
        <sphereGeometry args={[700, 48, 32]} />
      </mesh>
      <hemisphereLight args={["#d8d9dc", "#2a2a2b", 0.9]} />
      <directionalLight position={v3(HO, 0, 40, -400)} intensity={2.4} color="#f6f5f2" />
      <group position={HO}>
        {PRE2_WORDS.map((w, k) => {
          if (t < w.s - 0.02) return null;
          const s = step2Pos(k);
          const q = expoOut(clamp01((t - w.s) / 0.22));
          return (
            <group key={k}>
              <mesh geometry={UNIT} material={M.wall.m} position={[0, (s.y * q) / 2, s.z - STAIR2.run / 2]} scale={[2.2, Math.max(0.001, s.y * q), STAIR2.run]} />
              <lineSegments geometry={UNIT_EDGES} material={M.edge} position={[0, (s.y * q) / 2, s.z - STAIR2.run / 2]} scale={[2.21, Math.max(0.001, s.y * q), STAIR2.run + 0.005]} />
              <group position={[0, s.y - STAIR2.rise * 0.55, s.z + 0.004]}>
                <FillLine font={a.inter} line={miniLine(w, `S2${k}`, "prechorus2")} t={t} size={STAIR2.rise * 0.6} maxW={3} mats={TM} accentLast={lastWords.has(w)} />
              </group>
            </group>
          );
        })}
        {/* the deck */}
        <mesh geometry={UNIT} material={M.roof.m} position={[0, DECK.y - 0.1, (DECK.z0 + DECK.edge) / 2]} scale={[14, 0.2, DECK.z0 - DECK.edge]} />
        <mesh geometry={UNIT} material={M.rim} position={[0, DECK.y + 0.005, DECK.edge]} scale={[14, 0.02, 0.03]} />
        <group position={[0, DECK.y + h / 2 - 0.03, DECK.edge + 0.6]}>
          <mesh position={[0, 0, -0.03]} scale={[1.04, 1.03, 1]} material={M.halo}>
            <planeGeometry args={[h * asp, h]} />
          </mesh>
          <mesh material={M.silhouette}>
            <planeGeometry args={[h * asp, h]} />
          </mesh>
        </group>
      </group>
      <ChorusFlares {...p} id="chorus2" up={Y} />
    </group>
  );
};

// ---------------------------------------------------------------------------------------------
/** Verse 3: midnight desk. Every rapped word becomes a brick in a wall that grows behind it. */
export const Desk: React.FC<P> = ({ t, a, M, TM, SP }) => {
  const ls = linesOf("verse3");
  const words = useMemo(() => ls.flatMap((l) => l.words.map((w) => ({ w, last: w === l.words[l.words.length - 1] }))), []);
  const BH = 0.17, GAP = 0.012, WALL_W = 3.2, SIZE = 0.085;
  const bricks = useMemo(() => {
    const out: { x: number; y: number; w: number }[] = [];
    let x = -WALL_W / 2, row = 0;
    words.forEach(({ w }) => {
      const ww = layoutWords(a.inter, [w.w.toUpperCase()], SIZE, 99).pos[0].w + 0.09;
      if (x + ww > WALL_W / 2) {
        row++;
        x = -WALL_W / 2 + (row % 2 ? 0.08 : 0);
      }
      out.push({ x: x + ww / 2, y: row * (BH + GAP) + BH / 2, w: ww });
      x += ww + GAP;
    });
    return out;
  }, []);
  const lamp = 0.85 + 0.15 * Math.sin(t * 1.3);
  return (
    <group position={DO}>
      <mesh geometry={UNIT} material={M.floor.m} position={[0, -0.05, -2]} scale={[14, 0.1, 14]} />
      {/* desk, lamp, mic */}
      <mesh geometry={UNIT} material={M.brick.m} position={[0, 0.74, -1.3]} scale={[1.7, 0.05, 0.8]} />
      {[-0.8, 0.8].flatMap((x) => [-0.95, -1.65].map((z) => <mesh key={`${x}${z}`} geometry={UNIT} material={M.brick.m} position={[x, 0.36, z]} scale={[0.05, 0.72, 0.05]} />))}
      <mesh geometry={UNIT} material={M.cable} position={[0.55, 0.78, -1.45]} scale={[0.14, 0.03, 0.14]} />
      <mesh geometry={UNIT} material={M.cable} position={[0.55, 1.05, -1.45]} rotation={[0, 0, -0.35]} scale={[0.02, 0.55, 0.02]} />
      <mesh material={M.cable} position={[0.42, 1.3, -1.45]} rotation={[0, 0, 0.6]}>
        <coneGeometry args={[0.11, 0.16, 20, 1, true]} />
      </mesh>
      <mesh material={M.tube} position={[0.38, 1.24, -1.45]}>
        <sphereGeometry args={[0.03, 12, 12]} />
      </mesh>
      <spotLight position={[0.38, 1.24, -1.45]} angle={0.9} penumbra={0.8} intensity={14 * lamp} distance={0} decay={2} color="#f3f1ec" />
      <pointLight position={[0, 2.8, 1.2]} intensity={3} distance={10} decay={1.5} color="#d8dbe0" />
      <mesh geometry={UNIT} material={M.cable} position={[-0.45, 1.05, -1.2]} scale={[0.02, 0.6, 0.02]} />
      <mesh material={M.cable} position={[-0.45, 1.4, -1.2]}>
        <sphereGeometry args={[0.055, 20, 16]} />
      </mesh>
      {/* the wall of bars */}
      <group position={[0, 0, -3.3]}>
        {words.map(({ w, last }, i) => {
          if (t < w.s) return null;
          const b = bricks[i];
          const q = clamp01((t - w.s) / 0.16);
          const dy = (1 - cubicIn(q)) * 1.8;
          return (
            <group key={i} position={[b.x, b.y + dy, 0]}>
              <mesh geometry={UNIT} material={M.brick.m} scale={[b.w, BH, 0.14]} />
              <group position={[0, -SIZE * 0.05, 0.072]}>
                <FillLine font={a.inter} line={miniLine(w, `B${i}`, "verse3")} t={t} size={SIZE} maxW={9} mats={TM} mode="slam" accentLast={last} />
              </group>
            </group>
          );
        })}
      </group>
      {/* the verse's last word lights the room */}
      <SparkBurst t={t} at={ls[ls.length - 1].end - 0.2} origin={[0, 3.2, -3.1]} count={200} speed={4} spread={1.2} gravity={[0, -8, 0]} mat={SP} seed={303} life={0.8} dir={[0, 0.4, 1]} />
    </group>
  );
};

// ---------------------------------------------------------------------------------------------
/** Bridge: half-time down a quiet hallway; handwritten lines, the shoes, a vine that grows. */
export const Hallway: React.FC<P & { emberMat: THREE.ShaderMaterial }> = ({ t, a, M, TM, emberMat }) => {
  const ls = linesOf("bridge");
  const shoesLine = ls.find((l) => /shoes/i.test(l.text))!;
  const growLine = ls.find((l) => /grow/i.test(l.text))!;
  const len = HALL.z0 - HALL.z1;
  const dust = useMemo(
    () => pointsGeo(500, (i, r) => ({ p: [(r() - 0.5) * 2 * HALL.halfW, r() * HALL.h, HALL.z0 - r() * len], c: [0.6, 0.6, 0.62], s: 0.4 + r() * 0.9 }), 71),
    [],
  );
  const vine = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 80; i++) {
      const k = i / 80;
      pts.push(new THREE.Vector3(HALL.halfW - 0.02, 0.05 + k * 2.4, HALL.z0 - 7 + Math.sin(k * 9) * 0.25 - k * 0.6));
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 200, 0.012, 5, false);
  }, []);
  const grow = clamp01((t - growLine.start) / 2.2);
  vine.setDrawRange(0, Math.floor(grow * (vine.index?.count ?? 0) / 6) * 6);
  const P = dust.attributes.position.array as Float32Array;
  for (let i = 0; i < 500; i++) P[i * 3 + 1] = (((P[i * 3 + 1] - t * 0.05) % HALL.h) + HALL.h) % HALL.h;
  dust.attributes.position.needsUpdate = true;
  return (
    <group position={DO}>
      <mesh geometry={UNIT} material={M.floor.m} position={[0, -0.05, (HALL.z0 + HALL.z1) / 2]} scale={[HALL.halfW * 2, 0.1, len]} />
      <mesh geometry={UNIT} material={M.wall.m} position={[0, HALL.h + 0.05, (HALL.z0 + HALL.z1) / 2]} scale={[HALL.halfW * 2, 0.1, len]} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={UNIT} material={M.wall.m} position={[s * (HALL.halfW + 0.05), HALL.h / 2, (HALL.z0 + HALL.z1) / 2]} scale={[0.1, HALL.h, len]} />
      ))}
      {Array.from({ length: 9 }, (_, i) => (
        <group key={i}>
          <mesh geometry={UNIT} material={M.tube} position={[0, HALL.h - 0.01, HALL.z0 - 2 - i * 4.2]} scale={[0.5, 0.01, 0.12]} />
          <pointLight position={[0, HALL.h - 0.25, HALL.z0 - 2 - i * 4.2]} intensity={2.2} distance={5} decay={1.6} color="#e8e8ea" />
        </group>
      ))}
      <points geometry={dust} material={emberMat} frustumCulled={false} />
      {/* the shoes */}
      {t > shoesLine.start ? (
        <mesh position={[-0.35, 0.16, HALL.z0 - 3.2]} rotation={[0, 0.3, 0]} material={M.shoes}>
          <planeGeometry args={[0.9, 0.24]} />
        </mesh>
      ) : null}
      <mesh geometry={vine} material={M.edge} />
      {ls.map((l, i) => {
        const anc = lineAnchor(l, 0.6).clone().sub(DO);
        const from = camAt(l.start).pos.clone().sub(DO);
        return (
          <Panel key={l.id} at={anc.add(new THREE.Vector3((i % 2 ? 1 : -1) * 0.2, 0.15, 0))} face={from} up={Y} tilt={[0, (i % 2 ? -1 : 1) * 0.1, 0]}>
            <FillLine font={a.caveat} line={l} t={t} size={0.13} maxW={1.35} mats={TM} upper={false} out={outOf(l, 1.8)} />
          </Panel>
        );
      })}
    </group>
  );
};

// ---------------------------------------------------------------------------------------------
/** Final chorus: the room, the house frame and the slabs all lift into the sky with us. */
export const Floaters: React.FC<P & { start: number }> = ({ t, M, start }) => {
  const rise = Math.max(0, t - start) * 1.1;
  const r = useMemo(() => {
    const g = rng(55);
    return Array.from({ length: 22 }, (_, i) => ({ x: (i % 2 ? 1 : -1) * (3 + g() * 6), y: 152 + g() * 50, z: -4 + g() * 8, s: 0.5 + g() * 1.4, rot: g() * 6, kind: i % 3 }));
  }, []);
  return (
    <group>
      {r.map((f, i) => (
        <group key={i} position={[f.x, f.y, f.z + rise * (0.6 + (i % 4) * 0.25)]} rotation={[f.rot + t * 0.05, f.rot * 0.5, t * 0.03 * (i % 2 ? 1 : -1)]} scale={f.s}>
          {f.kind === 0 ? (
            // a room shell: floor + two walls
            <>
              <mesh geometry={UNIT} material={M.floor.m} scale={[2, 0.05, 2]} />
              <mesh geometry={UNIT} material={M.wall.m} position={[0, 0.7, -1]} scale={[2, 1.4, 0.05]} />
              <mesh geometry={UNIT} material={M.wall.m} position={[-1, 0.7, 0]} scale={[0.05, 1.4, 2]} />
            </>
          ) : f.kind === 1 ? (
            // a framed wall section
            <>
              {Array.from({ length: 6 }, (_, k) => (
                <mesh key={k} geometry={UNIT} material={M.brick.m} position={[(k - 2.5) * 0.4, 0, 0]} scale={[0.045, 2.2, 0.09]} />
              ))}
              <mesh geometry={UNIT} material={M.brick.m} position={[0, 1.1, 0]} scale={[2.4, 0.045, 0.09]} />
              <mesh geometry={UNIT} material={M.brick.m} position={[0, -1.1, 0]} scale={[2.4, 0.045, 0.09]} />
            </>
          ) : (
            <>
              <mesh geometry={UNIT} material={M.wall.m} scale={[2.6, 0.45, 1.1]} />
              <lineSegments geometry={UNIT_EDGES} material={M.edge} scale={[2.61, 0.46, 1.11]} />
            </>
          )}
        </group>
      ))}
    </group>
  );
};

