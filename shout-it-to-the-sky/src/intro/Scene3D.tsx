import React, { useEffect, useLayoutEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { continueRender, delayRender, staticFile } from "remotion";
import { Font, FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { contourMat } from "../three/contour";
import { kickEnv, linesOf } from "../data";
import { clamp01, cubicOut, expoOut } from "../utils/ease";
import { noise1, rng } from "../utils/random";

export const DROP = 17.218;
export const TUBE_ON = 3.61;
const BUILT = linesOf("intro")[1];
export const WALL_Z = -0.72;
export const CRACK_Y = 1.62;

export const tubeLevel = (t: number) => {
  if (t < TUBE_ON - 1.25) return 0;
  if (t >= TUBE_ON) return 0.94 + 0.06 * noise1(t * 40, 5);
  const k = Math.floor((t - (TUBE_ON - 1.25)) * 30);
  const p = [0, 0, 1, 0.2, 0, 0, 0, 0.6, 1, 0, 0, 0, 0, 0, 0.3, 0, 0, 1, 1, 0.4, 0, 0, 0, 0.8, 1, 0.7, 0, 0, 0.5, 1, 1, 1, 1, 1, 1, 1, 1, 1];
  return p[Math.min(p.length - 1, k)];
};

// ---------------------------------------------------------------------------------------------
// camera path (time-domain Hermite between keys)
type V = [number, number, number];
type K = { t: number; p: V; l: V; up: V; fov: number };
const Y: V = [0, 1, 0];
const KEYS: K[] = [
  { t: 0, p: [0, 0.92, 4.7], l: [0, 0.62, 0], up: Y, fov: 32 },
  { t: 3.6, p: [0, 0.9, 4.25], l: [0, 0.62, 0], up: Y, fov: 32 },
  { t: 4.6, p: [0.02, 0.88, 3.95], l: [0, 0.64, 0], up: Y, fov: 32 },
  { t: 5.1, p: [0, 0.84, 3.25], l: [0, 0.66, 0], up: Y, fov: 34 },
  { t: 7.6, p: [0.12, 0.82, 3.0], l: [0, 0.6, 0], up: Y, fov: 34 },
  { t: 9.0, p: [0.45, 0.8, 4.4], l: [0, 0.42, 0.9], up: Y, fov: 34 },
  { t: 11.0, p: [-0.35, 0.62, 4.0], l: [0, 0.4, 0.9], up: Y, fov: 34 },
  { t: 12.9, p: [0.95, 1.05, 1.45], l: [0, 0.95, 0], up: Y, fov: 34 },
  { t: 14.7, p: [-0.6, 1.15, 1.0], l: [0, 1.05, 0], up: Y, fov: 34 },
  { t: 16.4, p: [0.1, 1.66, 0.6], l: [0, 1.6, -0.7], up: Y, fov: 36 },
  { t: DROP, p: [0, 1.5, 0.18], l: [0, CRACK_Y + 0.1, WALL_Z], up: Y, fov: 40 },
  { t: DROP + 0.6, p: [0, 1.75, -0.42], l: [0, 2.7, WALL_Z], up: [0, 0.45, 0.9], fov: 48 },
  { t: DROP + 1.4, p: [0, 2.3, -0.5], l: [0, 5.2, WALL_Z], up: [0, 0, 1], fov: 56 },
  { t: 23, p: [0.18, 11, -0.42], l: [0, 15, WALL_Z], up: [0, 0, 1], fov: 58 },
  { t: 29.3, p: [-0.1, 27, -0.38], l: [0, 31, WALL_Z], up: [0, 0, 1], fov: 60 },
];
const herm = (t: number, get: (k: K) => V) => {
  const Ks = KEYS;
  if (t <= Ks[0].t) return new THREE.Vector3(...get(Ks[0]));
  if (t >= Ks[Ks.length - 1].t) return new THREE.Vector3(...get(Ks[Ks.length - 1]));
  let i = 0;
  while (Ks[i + 1].t < t) i++;
  const k0 = Ks[Math.max(0, i - 1)], k1 = Ks[i], k2 = Ks[i + 1], k3 = Ks[Math.min(Ks.length - 1, i + 2)];
  const dt = k2.t - k1.t, s = (t - k1.t) / dt;
  const v = (k: K) => new THREE.Vector3(...get(k));
  const m1 = v(k2).sub(v(k0)).multiplyScalar((dt / Math.max(1e-3, k2.t - k0.t)) * 0.85);
  const m2 = v(k3).sub(v(k1)).multiplyScalar((dt / Math.max(1e-3, k3.t - k1.t)) * 0.85);
  const h00 = 2 * s ** 3 - 3 * s ** 2 + 1, h10 = s ** 3 - 2 * s ** 2 + s, h01 = -2 * s ** 3 + 3 * s ** 2, h11 = s ** 3 - s ** 2;
  return v(k1).multiplyScalar(h00).add(m1.multiplyScalar(h10)).add(v(k2).multiplyScalar(h01)).add(m2.multiplyScalar(h11));
};
export const introCam = (t: number) => ({
  pos: herm(t, (k) => k.p),
  look: herm(t, (k) => k.l),
  up: herm(t, (k) => k.up).normalize(),
  fov: herm(t, (k) => [k.fov, 0, 0]).x,
});

const projCam = new THREE.PerspectiveCamera(32, 1080 / 1920, 0.02, 500);
/** Screen px of a world point at time t (for HUD), or null if behind camera. */
export const projectIntro = (t: number, p: THREE.Vector3) => {
  const c = introCam(t);
  projCam.fov = c.fov;
  projCam.position.copy(c.pos);
  projCam.up.copy(c.up);
  projCam.lookAt(c.look);
  projCam.updateProjectionMatrix();
  projCam.updateMatrixWorld();
  const v = p.clone().project(projCam);
  if (v.z > 1 || v.z < -1) return null;
  return { x: (v.x * 0.5 + 0.5) * 1080, y: (-v.y * 0.5 + 0.5) * 1920 };
};

// ---------------------------------------------------------------------------------------------
// assets: RUDO's mesh + Inter for the lettered bricks
export const useIntroAssets = () => {
  const [a, setA] = useState<{ geo: THREE.BufferGeometry; font: Font } | null>(null);
  const [h] = useState(() => delayRender("intro assets"));
  useEffect(() => {
    const loader = new GLTFLoader();
    Promise.all([
      new Promise<THREE.BufferGeometry>((res) =>
        loader.load(staticFile("models/rudo.glb"), (g: { scene: THREE.Object3D }) => {
          g.scene.updateMatrixWorld(true);
          let geo: THREE.BufferGeometry | null = null;
          g.scene.traverse((o) => {
            const m = o as THREE.Mesh;
            if (m.isMesh && !geo) geo = m.geometry.clone().applyMatrix4(m.matrixWorld);
          });
          const gg = geo as unknown as THREE.BufferGeometry;
          gg.computeBoundingBox();
          const b = gg.boundingBox!;
          const s = 1.35 / (b.max.y - b.min.y);
          gg.translate(-(b.max.x + b.min.x) / 2, -b.min.y, -(b.max.z + b.min.z) / 2);
          gg.scale(s, s, s);
          gg.computeVertexNormals();
          res(gg);
        }),
      ),
      fetch(staticFile("fonts/inter800.typeface.json"))
        .then((r) => r.json())
        .then((j) => new FontLoader().parse(j)),
    ]).then(([geo, font]) => {
      setA({ geo, font });
      continueRender(h);
    });
  }, [h]);
  return a;
};

// ---------------------------------------------------------------------------------------------
export const buildCrack = () => {
  const r = rng(808);
  const pos: number[] = [], dist: number[] = [], side: number[] = [], idx: number[] = [];
  let n = 0;
  const seg = (ax: number, ay: number, bx: number, by: number, d0: number, d1: number, w: number) => {
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1;
    const nx = (-dy / L) * w / 2, ny = (dx / L) * w / 2;
    pos.push(ax + nx, ay + ny, 0, ax - nx, ay - ny, 0, bx + nx, by + ny, 0, bx - nx, by - ny, 0);
    dist.push(d0, d0, d1, d1);
    side.push(1, -1, 1, -1);
    idx.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
    n += 4;
  };
  const walk = (x: number, y: number, a: number, len: number, w: number, d: number, depth: number, main: boolean) => {
    let L = 0;
    while (L < len) {
      const s = 0.05 + r() * 0.05;
      a += main ? (Math.PI / 2 + x * 1.5 - a) * 0.25 + (r() - 0.5) * 0.6 : (r() - 0.5) * 0.8;
      const nx = x + Math.cos(a) * s, ny = y + Math.sin(a) * s;
      seg(x, y, nx, ny, main ? y - CRACK_Y : d + L, main ? ny - CRACK_Y : d + L + s, main ? w : w * (1 - L / len));
      x = nx; y = ny; L += s;
      if (depth < 3 && r() < 0.07) walk(x, y, a + (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.7), main ? 0.4 + r() * 1.6 : len * 0.4, main ? 0.012 : w * 0.7, main ? y - CRACK_Y : d + L, depth + 1, false);
      if (main && y > 40) break;
    }
  };
  walk(0, CRACK_Y, Math.PI / 2, 999, 0.022, 0, 0, true);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.2;
    if (Math.abs(a - Math.PI / 2) > 0.35) walk(0, CRACK_Y, a, 0.6 + r() * 1.4, 0.014, 0, 1, false);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aD", new THREE.Float32BufferAttribute(dist, 1));
  g.setAttribute("aS", new THREE.Float32BufferAttribute(side, 1));
  g.setIndex(idx);
  return g;
};
export const crackMat = () =>
  new THREE.ShaderMaterial({
    uniforms: { uTip: { value: -1 }, uGlow: { value: 1 } },
    vertexShader: `attribute float aD; attribute float aS; varying float vD; varying float vS; void main(){ vD=aD; vS=aS; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
    fragmentShader: `uniform float uTip; uniform float uGlow; varying float vD; varying float vS;
      void main(){ if(vD>uTip) discard; float core=exp(-vS*vS*6.0); float hot=exp(-(uTip-vD)*2.0);
        gl_FragColor=vec4(vec3(1.0)*mix(0.04, uGlow*(1.0+hot), core),1.0);} `,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });

// ---------------------------------------------------------------------------------------------
export const IntroScene: React.FC<{ t: number; geo: THREE.BufferGeometry; font: Font }> = ({ t, geo, font }) => {
  const { camera, gl } = useThree();
  const M = useMemo(
    () => ({
      body: contourMat({ pitch: 6.5 }),
      wall: contourMat({ pitch: 10, warp: 0.2, axis: [0, 1, 0], ink: "#9a9894" }),
      floor: contourMat({ pitch: 10, warp: 0.2, axis: [0.15, 0, 1], ink: "#9a9894" }),
      brick: contourMat({ pitch: 5, warp: 0.1, axis: [0, 1, 0.2] }),
      letter: new THREE.MeshBasicMaterial({ color: "#f2f0ec" }),
      tube: new THREE.MeshBasicMaterial({ color: "#ffffff" }),
    }),
    [],
  );
  const crack = useMemo(() => ({ geo: buildCrack(), mat: crackMat() }), []);
  const box = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), []);
  const edgeMat = useMemo(() => new THREE.LineBasicMaterial({ color: "#d8d4cc", transparent: true, opacity: 0.8 }), []);

  const bricks = useMemo(() => {
    const rows = [[0, 1], [2, 3]];
    const S = 0.105, G = 0.006;
    const out: { ch: string; x: number; y: number; w: number; t0: number; geo: THREE.BufferGeometry; gw: number }[] = [];
    rows.forEach((idx, ri) => {
      const cells = idx.flatMap((wi, m) => [...(m > 0 ? [{ ch: " ", wi, k: -1 }] : []), ...BUILT.words[wi].w.toUpperCase().split("").map((ch, k) => ({ ch, wi, k }))]);
      const wOf = (ch: string) => (ch === " " ? S * 0.4 : ch === "I" || ch === "!" ? S * 0.62 : S);
      let x = -cells.reduce((a, c) => a + wOf(c.ch) + G, -G) / 2;
      cells.forEach((c) => {
        const w = wOf(c.ch);
        if (c.ch !== " ") {
          const tg = new TextGeometry(c.ch, { font, size: S * 0.56, depth: 0.004, curveSegments: 6 });
          tg.computeBoundingBox();
          const bb = tg.boundingBox!;
          tg.translate(-(bb.max.x + bb.min.x) / 2, -(bb.max.y + bb.min.y) / 2, 0);
          out.push({ ch: c.ch, x: x + w / 2, y: (1 - ri) * (S + G) + S / 2, w, t0: BUILT.words[c.wi].s + c.k * 0.05, geo: tg, gw: bb.max.x - bb.min.x });
        }
        x += w + G;
      });
    });
    return out;
  }, [font]);

  const c = introCam(t);
  useLayoutEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.position.copy(c.pos);
    cam.up.copy(c.up);
    cam.lookAt(c.look);
    cam.fov = c.fov;
    cam.near = 0.02;
    cam.far = 500;
    cam.updateProjectionMatrix();
  });
  gl.setClearColor("#000000");

  const lvl = tubeLevel(t);
  const kick = kickEnv(t, 0.2);
  const afterDrop = t > DROP ? clamp01((t - DROP) / 0.3) : 0;
  for (const m of [M.body, M.brick]) {
    m.uniforms.uLevel.value = 0.08 + 0.92 * lvl + 0.35 * afterDrop * (0.6 + kick);
    m.uniforms.uKey.value.set(0.25, 1, 0.55).normalize();
  }
  // the room stays dark: only a pool of light round him (and, after the drop, the crack's glow)
  for (const m of [M.wall, M.floor]) {
    m.uniforms.uLevel.value = (0.05 + 0.32 * lvl) * (1 - afterDrop) + afterDrop * (0.45 + 0.25 * kick);
    m.uniforms.uKey.value.set(0.25, 1, 0.55).normalize();
    m.uniforms.uRim.value = 0;
  }
  M.wall.uniforms.uFlow.value = 0;
  const tip = t < DROP ? -1 : Math.max(1.2 * expoOut(clamp01((t - DROP) / 0.4)), c.pos.y - CRACK_Y + 6);
  crack.mat.uniforms.uTip.value = tip;
  crack.mat.uniforms.uGlow.value = 1.1 + 0.6 * Math.exp(-(t - DROP) / 0.4) + 0.4 * kick;

  return (
    <>
      {/* RUDO */}
      <mesh geometry={geo} material={M.body} />
      {/* floor + wall (the wall runs on up: after the drop it is the ground we race over) */}
      <mesh material={M.floor} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 2]}>
        <planeGeometry args={[8, 6]} />
      </mesh>
      <mesh material={M.wall} position={[0, 21, WALL_Z]}>
        <planeGeometry args={[8, 42]} />
      </mesh>
      <mesh geometry={crack.geo} material={crack.mat} position={[0, 0, WALL_Z + 0.004]} />
      {/* the tube */}
      <mesh material={M.tube} position={[0, 3.0, 0.6]} scale={[1.5 * (lvl > 0.1 ? 1 : 0.0001), 0.03, 0.04]} geometry={box} />
      {/* So I built it! */}
      <group position={[0, 0, 1.05]} rotation={[0, 0, 0]}>
        {bricks.map((b, i) => {
          if (t < b.t0) return null;
          const p = clamp01((t - b.t0) / 0.28);
          const land = t - b.t0 - 0.28;
          const dy = (1 - p * p) * 1.2 + (land > 0 ? Math.abs(Math.sin(land * 26)) * 0.012 * Math.exp(-land / 0.07) : 0);
          const shat = afterDrop > 0 ? cubicOut(clamp01((t - DROP) / 1.0)) : 0;
          return (
            <group key={i} position={[b.x * (1 + shat * 2), b.y + dy + shat * 1.5 * ((i % 3) - 1), shat * 1.2]} rotation={[shat * (i % 2 ? 2 : -2), (1 - p) * 0.5 + shat, (1 - p) * 0.3]}>
              <mesh geometry={box} material={M.brick} scale={[b.w, 0.105, 0.105]} />
              <lineSegments geometry={edges} material={edgeMat} scale={[b.w * 1.004, 0.1055, 0.1055]} />
              <mesh geometry={b.geo} material={M.letter} position={[0, 0, 0.0535]} />
            </group>
          );
        })}
      </group>
    </>
  );
};
