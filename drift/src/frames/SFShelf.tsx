import React, { useMemo } from "react";
import * as THREE from "three";
import { useAssets } from "../three/assets";
import { Stage } from "../three/Stage";
import { stoneMat } from "../three/materials";
import { LINES, sungAmount, vol } from "../data";
import { clamp01, cubicInOut, cubicOut, mix } from "../utils/ease";
import { noise1, rng } from "../utils/random";
import { capHeight, layout } from "../words/glyphs";
import { Glow } from "../words/points";
import { Dust, Motes } from "./SFWeight";
import { Finish, Full, Letters } from "./kit";

/**
 * "I'm carrying so much weight": every word is an object. Each lands on a wall shelf as it is
 * sung, each heavier than the last (plaster → pale stone → stone → dark stone). WEIGHT lands
 * last; the plank bows under it for exactly the held note, snaps when the note ends, the small
 * words tip off, and WEIGHT drops through and slams into the concrete floor on the kick.
 */
const LI = 12;
const G = 22;
const SHELF_Y = 2.15, WALL_Z = -0.62, PLANK_D = 0.36, PLANK_T = 0.05, PLANK_L = 2.6, BRK = 0.95;
const PZ = WALL_Z + PLANK_D / 2 + 0.005; // plank centre z
const SLAM = 34.447; // the big kick
const BREAK_X = 0.05; // where the plank splits

type Spec = { text: string; size: number; tint: string; mass: number };
const SPECS: Spec[] = [
  { text: "I'M", size: 0.13, tint: "#e2ded8", mass: 0.04 },
  { text: "CARRYING", size: 0.18, tint: "#bdb6ac", mass: 0.12 },
  { text: "SO", size: 0.23, tint: "#958e85", mass: 0.16 },
  { text: "MUCH", size: 0.29, tint: "#6f6963", mass: 0.3 },
];
const W_SIZE = 0.46;

/** Plank wood: weathered grey oak, procedural grain. */
const woodMat = () => {
  const c = document.createElement("canvas");
  c.width = 2048; c.height = 256;
  const x = c.getContext("2d")!;
  const r = rng(91);
  x.fillStyle = "#7d776f"; x.fillRect(0, 0, 2048, 256);
  for (let i = 0; i < 260; i++) {
    const y = r() * 256, a = 0.04 + r() * 0.12, dark = r() > 0.5;
    x.strokeStyle = dark ? `rgba(40,36,32,${a})` : `rgba(200,194,186,${a})`;
    x.lineWidth = 0.6 + r() * 2.2;
    x.beginPath(); x.moveTo(0, y);
    for (let k = 0; k <= 32; k++) x.lineTo(k * 64, y + Math.sin(k * 0.7 + i) * (2 + r() * 3));
    x.stroke();
  }
  for (let i = 0; i < 5; i++) { // knots
    const cx = r() * 2048, cy = 40 + r() * 176;
    for (let k = 0; k < 6; k++) { x.strokeStyle = `rgba(45,40,35,${0.18 - k * 0.025})`; x.beginPath(); x.ellipse(cx, cy, 10 + k * 7, 5 + k * 3, 0, 0, Math.PI * 2); x.stroke(); }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.78, bumpMap: t, bumpScale: 0.6 });
};

/** Concrete crack decal: branching cracks from the impact point; `reveal` grows the radius. */
const crackTex = () => {
  const S = 1024, c = document.createElement("canvas");
  c.width = c.height = S;
  const x = c.getContext("2d")!;
  const r = rng(17);
  const branch = (px: number, py: number, ang: number, len: number, w: number, depth: number) => {
    let a = ang;
    x.beginPath(); x.moveTo(px, py);
    const pts: [number, number][] = [];
    for (let i = 0; i < len; i += 6) {
      a += (r() - 0.5) * 0.55;
      px += Math.cos(a) * 6; py += Math.sin(a) * 6;
      pts.push([px, py]);
      x.lineTo(px, py);
      if (depth < 3 && r() < 0.035) branch(px, py, a + (r() > 0.5 ? 1 : -1) * (0.5 + r() * 0.6), len * (0.3 + r() * 0.4), w * 0.6, depth + 1);
    }
    x.strokeStyle = "rgba(8,7,6,0.95)"; x.lineWidth = w; x.lineJoin = "round"; x.stroke();
    x.beginPath(); pts.forEach(([qx, qy], i) => (i ? x.lineTo(qx + 1.2, qy + 1.2) : x.moveTo(qx + 1.2, qy + 1.2)));
    x.strokeStyle = "rgba(200,192,180,0.25)"; x.lineWidth = Math.max(0.6, w * 0.35); x.stroke(); // lit lip
  };
  // crushed core
  const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, 150);
  g.addColorStop(0, "rgba(10,9,8,0.75)"); g.addColorStop(0.6, "rgba(20,18,16,0.35)"); g.addColorStop(1, "rgba(20,18,16,0)");
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 16; i++) branch(S / 2 + (r() - 0.5) * 120, S / 2 + (r() - 0.5) * 40, (i / 16) * Math.PI * 2 + r() * 0.3, 180 + r() * 300, 3.5 + r() * 3, 0);
  // ring fracture
  x.beginPath(); for (let k = 0; k <= 80; k++) { const a = (k / 80) * Math.PI * 2, rr = 170 + (r() - 0.5) * 30; x.lineTo(S / 2 + Math.cos(a) * rr * 1.6, S / 2 + Math.sin(a) * rr * 0.7); }
  x.strokeStyle = "rgba(10,9,8,0.7)"; x.lineWidth = 2.5; x.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

/** Ballistic piece: launched at t0 from p0 with v0, gravity, one damped bounce, then rest. */
const ballistic = (dt: number, p0: THREE.Vector3, v0: THREE.Vector3, floorY: number, e = 0.3) => {
  const p = p0.clone().addScaledVector(v0, dt);
  p.y = p0.y + v0.y * dt - 0.5 * G * dt * dt;
  if (p.y > floorY) return { p, landed: false };
  // first contact time
  const disc = v0.y * v0.y + 2 * G * (p0.y - floorY);
  const tc = (v0.y + Math.sqrt(Math.max(0, disc))) / G;
  const vy = (v0.y - G * tc) * -e;
  const d2 = dt - tc;
  const fr = Math.exp(-d2 * 5);
  const q = new THREE.Vector3(p0.x + v0.x * (tc + (1 - fr) / 5), floorY + Math.max(0, vy * d2 - 0.5 * G * d2 * d2), p0.z + v0.z * (tc + (1 - fr) / 5));
  return { p: q, landed: true, tc };
};

export const useShelfKit = (a: ReturnType<typeof useAssets>) => {
  const mats = useMemo(() => {
    if (!a) return null;
    return {
      words: SPECS.map((s) => new THREE.MeshStandardMaterial({ color: s.tint, roughness: 0.82 })),
      weight: new THREE.MeshStandardMaterial({ color: "#c4b6a2", roughness: 0.8 }),
      floor: stoneMat(a, "#6d6862", 0.5, 1.5),
      wall: stoneMat(a, "#5f5a54", 0.4, 1.5),
      wood: woodMat(),
      steel: new THREE.MeshStandardMaterial({ color: "#3b3b3a", metalness: 0.85, roughness: 0.42 }),
      crack: new THREE.MeshStandardMaterial({ map: crackTex(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, roughness: 1 }),
      chunk: stoneMat(a, "#5a5550", 1.0, 1.2),
    };
  }, [a]);
  // plank as two segmented halves (they split at BREAK_X)
  const halves = useMemo(() => {
    const L = new THREE.BoxGeometry(BREAK_X + PLANK_L / 2, PLANK_T, PLANK_D, 48, 1, 1);
    const R = new THREE.BoxGeometry(PLANK_L / 2 - BREAK_X, PLANK_T, PLANK_D, 32, 1, 1);
    L.translate(-PLANK_L / 2 + (BREAK_X + PLANK_L / 2) / 2, 0, 0);
    R.translate(BREAK_X + (PLANK_L / 2 - BREAK_X) / 2, 0, 0);
    return { L, R, L0: (L.attributes.position.array as Float32Array).slice(), R0: (R.attributes.position.array as Float32Array).slice() };
  }, []);
  const chunks = useMemo(() => {
    const r = rng(23);
    return Array.from({ length: 34 }, () => ({ s: 0.01 + Math.pow(r(), 3) * 0.045, v: new THREE.Vector3((r() - 0.5) * 5, 1.2 + r() * 3.5, (r() - 0.2) * 3), rot: [r() * 6, r() * 6, r() * 6] as [number, number, number], x: (r() - 0.5) * 0.9 }));
  }, []);
  const splinters = useMemo(() => {
    const r = rng(29);
    return Array.from({ length: 22 }, () => ({ l: 0.04 + r() * 0.16, v: new THREE.Vector3((r() - 0.5) * 2.4, 0.4 + r() * 1.8, (r() - 0.2) * 1.6), spin: (r() - 0.5) * 30 }));
  }, []);
  return a && mats ? { mats, halves, chunks, splinters } : null;
};

export type ShelfKit = NonNullable<ReturnType<typeof useShelfKit>>;
/** The shelf moment at song time t: scene nodes plus where the camera wants to be. */
export const shelfFrame = (a: NonNullable<ReturnType<typeof useAssets>>, kit: ShelfKit, t: number, room = true) => {
  const { mats, halves, chunks, splinters } = kit;
  const words = LINES[LI].words;
  const wW = words[4];

  // ---------- layout on the plank ----------
  const gap = 0.045;
  const caps = SPECS.map((s) => capHeight(a.bebas, s.size));
  const widths = SPECS.map((s) => layout(a.bebas, s.text, s.size, 0.03).width);
  const wCap = capHeight(a.bebas, W_SIZE), wWidth = layout(a.bebas, "WEIGHT", W_SIZE, 0.03).width;
  const total = widths.reduce((s, w) => s + w + gap, 0) + wWidth;
  const left = -total / 2 + 0.02;
  const xs: number[] = [];
  widths.reduce((x, w) => (xs.push(x + w / 2), x + w + gap), left);
  const wX = left + total - wWidth / 2;

  // ---------- timing ----------
  const fallH = SHELF_Y - 0.1; // weight's drop from the plank to the floor
  const snap = SLAM - Math.sqrt((2 * fallH) / G);
  const landT = (i: number) => words[i].s; // each word lands as it's sung
  const landed = (i: number) => t >= landT(i);
  const wLand = wW.s;

  // ---------- load & sag ----------
  let load = 0;
  SPECS.forEach((s, i) => { if (landed(i)) load += s.mass * (1 + 1.6 * Math.exp(-(t - landT(i)) * 14) * Math.sin((t - landT(i)) * 40)); });
  const held = t >= wLand ? sungAmount(wW, t) : 0;
  const strain = t >= wLand ? 0.55 + held * 0.9 + vol(wW, t) * 0.15 : 0; // weight bends it over the held note
  const tremble = t >= wLand && t < snap ? Math.sin(t * 90) * 0.004 * held : 0;
  const sagC = Math.min(0.2, load * 0.05 + strain * 0.11 + tremble + (t >= wLand ? 0.05 * Math.exp(-(t - wLand) * 9) * Math.cos((t - wLand) * 35) : 0));
  const sagAt = (x: number) => sagC * Math.max(-0.08, 1 - Math.pow(x / BRK, 2)) * (x > 0 ? 1 + 0.35 * strain : 1);
  const slopeAt = (x: number) => (sagAt(x + 0.01) - sagAt(x - 0.01)) / 0.02;

  // ---------- break ----------
  const broke = t >= snap;
  const dB = Math.max(0, t - snap);
  const swing = (alpha: number, max: number) => {
    const th = 0.5 * alpha * dB * dB;
    if (th < max) return th;
    const over = dB - Math.sqrt((2 * max) / alpha);
    return max + Math.sin(over * 9) * 0.12 * Math.exp(-over * 3);
  };
  const thL = broke ? swing(26, 1.25) : 0; // left half pivots down around the left bracket (clockwise)
  const thR = broke ? swing(40, 1.35) : 0;
  const deform = (geo: THREE.BufferGeometry, base: Float32Array) => {
    const p = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = base[i * 3];
      p.setY(i, base[i * 3 + 1] - (broke ? sagAt(x) * Math.exp(-dB * 4) : sagAt(x)));
      // the broken ends splinter (ragged)
      if (Math.abs(x - BREAK_X) < 0.03 && broke) p.setY(i, p.getY(i) + Math.sin(i * 12.9898) * 0.02);
    }
    p.needsUpdate = true;
    geo.computeVertexNormals();
  };
  deform(halves.L, halves.L0);
  deform(halves.R, halves.R0);

  // ---------- small words ----------
  const pivotL = new THREE.Vector3(-BRK, SHELF_Y, PZ);
  const smallXF = (i: number) => {
    const cap = caps[i], x = xs[i];
    const tl = landT(i);
    if (t < tl - Math.sqrt((2 * 0.4) / G)) return null;
    const restY = SHELF_Y + PLANK_T / 2 - sagAt(x) + cap / 2;
    if (t < tl) { // dropping onto the shelf
      const u = tl - t;
      return { p: new THREE.Vector3(x, restY + 0.5 * G * u * u, PZ), r: new THREE.Euler(0, 0, 0) };
    }
    if (!broke) {
      const b = Math.abs(Math.sin((t - tl) * 26)) * 0.03 * Math.exp(-(t - tl) * 12);
      return { p: new THREE.Vector3(x, restY + b, PZ), r: new THREE.Euler(0, 0, -Math.atan(slopeAt(x)) * 1.0) };
    }
    // ride the left half, then slide off its end and fall, tipping back to lie on the floor
    const detach = 0.16 + i * 0.02;
    const rel = new THREE.Vector3(x, SHELF_Y + PLANK_T / 2 + cap / 2, PZ).sub(pivotL);
    if (dB < detach) {
      const q = rel.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), -thL);
      return { p: pivotL.clone().add(q), r: new THREE.Euler(0, 0, -thL) };
    }
    const thD = 0.5 * 26 * detach * detach;
    const p0 = pivotL.clone().add(rel.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), -thD));
    const omega = 26 * detach;
    const v0 = new THREE.Vector3(-0.35 + i * 0.12, -rel.x * omega * 0.3, 0.55 + i * 0.1);
    const dt = dB - detach;
    const lieY = 0.06;
    const res = ballistic(dt, p0, v0, lieY + cap * 0.1, 0.25);
    const fallDur = res.tc ?? 0.5;
    const k = res.landed ? 1 : cubicInOut(clamp01(dt / fallDur));
    const spinZ = -thD - k * (1.2 + i * 0.5);
    return { p: res.p, r: new THREE.Euler(mix(0, -Math.PI / 2 + 0.06, k), (i - 1.5) * 0.25 * k, res.landed ? spinZ * 0.0 + (i - 1.5) * 0.4 : spinZ) };
  };

  // ---------- WEIGHT ----------
  const wRest = (x: number) => SHELF_Y + PLANK_T / 2 - sagAt(x) + wCap / 2;
  let wy: number, wrz = 0, sunk = 0;
  const startH = 3.2;
  if (t < wLand) {
    const u = wLand - t;
    wy = wRest(wX) + 0.5 * G * u * u;
    if (u > Math.sqrt((2 * startH) / G)) wy = 99;
  } else if (!broke) {
    wy = wRest(wX) + Math.abs(Math.sin((t - wLand) * 22)) * 0.04 * Math.exp(-(t - wLand) * 10);
    wrz = -Math.atan(slopeAt(wX)) * 0.8;
  } else if (t < SLAM) {
    const y0 = wRest(wX);
    wy = y0 - 0.5 * G * dB * dB;
    wrz = mix(-Math.atan(slopeAt(wX)) * 0.8, 0.06, clamp01(dB / 0.42));
  } else {
    const d = t - SLAM;
    sunk = 0.035 * cubicOut(clamp01(d / 0.06));
    wy = wCap / 2 - sunk;
    wrz = 0.06 * Math.exp(-d * 10) * Math.cos(d * 40) + 0.015;
  }
  const slam = t >= SLAM;
  const dS = Math.max(0, t - SLAM);

  // ---------- camera: frames the shelf, follows WEIGHT down, takes the slam ----------
  // close on each word as it lands, widening as the words get bigger; wide for WEIGHT; follow it down
  const keysCam: [number, number, number, number][] = [
    [words[0].s - 0.5, xs[0] + 0.15, 2.6, SHELF_Y + 0.05],
    ...SPECS.map((sp, i) => [words[i].s + 0.12, xs[i] + (i === 0 ? 0.15 : 0), 2.4 + sp.size * 7.5, SHELF_Y + 0.08 + caps[i] * 0.3] as [number, number, number, number]),
    [wLand - 0.05, 0, 6.3, SHELF_Y - 0.25],
  ];
  let k0 = keysCam[0];
  let camX = k0[1], camD = k0[2], camY = k0[3];
  for (let i = 1; i < keysCam.length; i++) {
    const [tk, xk, dk, yk] = keysCam[i];
    const span = Math.min(0.42, tk - keysCam[i - 1][0]);
    const u = cubicInOut(clamp01((t - (tk - span)) / span));
    camX = mix(camX, xk, u); camD = mix(camD, dk, u); camY = mix(camY, yk, u);
    k0 = keysCam[i];
  }
  const follow = cubicInOut(clamp01((t - snap + 0.05) / 0.5));
  const shake = slam ? Math.exp(-dS * 6) * 0.12 : broke ? 0.01 : 0;
  const lookY = mix(camY, 0.25, follow);
  const lookX = mix(camX, wX * 0.8, follow);
  const cam: [number, number, number] = [
    lookX + (noise1(t * 28, 1) - 0.5) * shake * 2 + 0.08,
    mix(camY + 0.12, 1.6, follow) + (noise1(t * 31, 2) - 0.5) * shake * 1.5 - (slam ? 0.06 * Math.exp(-dS * 9) : 0),
    PZ + mix(camD, 5.4, follow),
  ];
  const crackR = slam ? cubicOut(clamp01(dS / 0.14)) : 0;

  const nodes = (
    <>
        {room ? (
          <>
        <spotLight position={[0.4, 5.6, 2.4]} angle={0.55} penumbra={0.8} intensity={380} decay={2} color="#fff1df" castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0003} target-position={[0.2, 1.0, -0.3]} />
        <pointLight position={[-2.5, 1.8, 2]} intensity={5} color="#8fa0b0" decay={2} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={mats.floor}><planeGeometry args={[30, 30]} /></mesh>
        <mesh position={[0, 6, WALL_Z]} receiveShadow material={mats.wall}><planeGeometry args={[30, 14]} /></mesh>
          </>
        ) : null}
        {/* brackets */}
        {[-BRK, BRK].map((x, i) => (
          <group key={i} position={[x, SHELF_Y - PLANK_T / 2, WALL_Z]}>
            <mesh material={mats.steel} position={[0, -0.14, 0.012]} castShadow><boxGeometry args={[0.04, 0.3, 0.02]} /></mesh>
            <mesh material={mats.steel} position={[0, -0.012, PLANK_D / 2 - 0.02]} castShadow><boxGeometry args={[0.04, 0.02, PLANK_D - 0.04]} /></mesh>
            <mesh material={mats.steel} position={[0, -0.09, 0.12]} rotation={[-0.75, 0, 0]} castShadow><boxGeometry args={[0.03, 0.02, 0.3]} /></mesh>
          </group>
        ))}
        {/* plank halves, each pivoting on its bracket */}
        <group position={[-BRK, SHELF_Y, PZ]} rotation={[0, 0, -thL]}>
          <mesh geometry={halves.L} material={mats.wood} position={[BRK, 0, 0]} castShadow receiveShadow />
        </group>
        <group position={[BRK, SHELF_Y, PZ]} rotation={[0, 0, thR]}>
          <mesh geometry={halves.R} material={mats.wood} position={[-BRK, 0, 0]} castShadow receiveShadow />
        </group>
        {/* splinters off the break */}
        {broke ? splinters.map((s, i) => {
          const b = ballistic(dB, new THREE.Vector3(BREAK_X, SHELF_Y, PZ), s.v, 0.01, 0.2);
          return <mesh key={i} material={mats.wood} position={b.p} rotation={[s.spin * Math.min(dB, b.tc ?? dB), s.spin * 0.3 * dB, s.spin * 0.7 * Math.min(dB, b.tc ?? dB)]} castShadow><boxGeometry args={[s.l, 0.012, 0.02]} /></mesh>;
        }) : null}
        {/* the line, word by word */}
        {SPECS.map((s, i) => {
          const x = smallXF(i);
          if (!x) return null;
          return (
            <group key={i} position={x.p} rotation={x.r}>
              <Letters font={a.bebas} family="bebas" text={s.text} size={s.size} depth={0.06 + i * 0.03} material={mats.words[i]} tracking={0.03} bevel={0} />
            </group>
          );
        })}
        {wy < 50 ? (
          <group position={[wX, wy, PZ + (broke ? 0.15 * clamp01(dB / 0.4) : 0)]} rotation={[0, 0, wrz]}>
            <Letters font={a.bebas} family="bebas" text="WEIGHT" size={W_SIZE} depth={0.26} material={mats.weight} tracking={0.03} bevel={0} />
          </group>
        ) : null}
        {/* the slam: cracked concrete, chunks, dust */}
        {slam ? (
          <>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[wX, 0.002, PZ + 0.15]} scale={[0.15 + crackR * 0.85, 0.15 + crackR * 0.85, 1]} material={mats.crack}><planeGeometry args={[3.8, 3.8]} /></mesh>
            {chunks.map((c, i) => {
              const b = ballistic(dS, new THREE.Vector3(wX + c.x, 0.02, PZ + 0.15), c.v, c.s / 2, 0.35);
              const spin = Math.min(dS, b.tc ?? dS);
              return <mesh key={i} material={mats.chunk} position={b.p} rotation={[c.rot[0] * spin * 4, c.rot[1] * spin * 4, c.rot[2] * spin * 4]} castShadow><dodecahedronGeometry args={[c.s, 0]} /></mesh>;
            })}
          </>
        ) : null}
        <group position={[wX, 0, PZ + 0.15]}><Dust t={t} t0={SLAM} /></group>
        <Motes t={t} />
    </>
  );
  return { wX, nodes, cam, look: [lookX, lookY, PZ] as [number, number, number], focus: mix(camD, 5.4, follow), roll: slam ? (noise1(t * 20, 4) - 0.5) * 0.02 * Math.exp(-dS * 5) : 0 };
};

export const SFShelf: React.FC<{ t: number }> = ({ t }) => {
  const a = useAssets();
  const kit = useShelfKit(a);
  if (!a || !kit) return <Full>{null}</Full>;
  const f = shelfFrame(a, kit, t);
  return (
    <Full>
      <Stage cam={{ pos: f.cam, look: f.look, fov: 42, roll: f.roll }}
        look={{ exposure: 1.05, env: 0.12, bloom: { strength: 0.3, radius: 0.6, threshold: 0.88 }, bg: "#040404", dof: { focus: f.focus, aperture: 0.0015, maxblur: 0.005 } }}>
        {f.nodes}
      </Stage>
      <Finish />
    </Full>
  );
};
