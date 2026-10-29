import React, { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { Assets } from "./assets";
import { buildMats } from "./materials";
import { Burst, Panel, outOf, pointsGeo, pointsMat, skyMat } from "./common";
import { ACCENT, FillLine, SparkBurst, advance, letterGeo, sparkMat, typeMats } from "./Type";
import { BR, CH1, CH3, CRACK_ORIGIN, EDGE, LID, OUTRO, POST2, PRE2, PRE_WORDS, ROOM, RUDO_POS, SLOT, STAIRS, STAIR_RISE, TRENCH, V2, V3, camAt, lineAnchor, stepPos } from "./layout";
import { ChorusFlares, Deck, Desk, Floaters, Hallway, House, Slabs } from "./Sets";
import { BIG_KICKS, Line, kickEnv, linesOf, nextLineStart, sectionById } from "../data";
import { clamp01, cubicOut, expoOut } from "../utils/ease";
import { noise1, rng } from "../utils/random";

/** Fluorescent tube state: dead, then a stutter of strikes, then on (with mains hum flutter). */
const tubeLevel = (t: number, on: number) => {
  if (t < on - 1.25) return 0;
  if (t >= on) return 0.93 + 0.07 * noise1(t * 40, 5);
  // deterministic strike pattern in the 1.25 s before `on`
  const k = Math.floor((t - (on - 1.25)) * 30);
  const pattern = [0, 0, 1, 0.2, 0, 0, 0, 0.6, 1, 0, 0, 0, 0, 0, 0.3, 0, 0, 1, 1, 0.4, 0, 0, 0, 0.8, 1, 0.7, 0, 0, 0.5, 1, 1, 1, 1, 1, 1, 1, 1, 1];
  return pattern[Math.min(pattern.length - 1, k)];
};

export const DROP = BIG_KICKS.find((k) => k > 15 && k < 20) ?? 17.22;
export const TUBE_ON = 3.61;
const TITLE_IN = 11.6;


// ---------------------------------------------------------------------------------------------
// geometry helpers
const plane = (w: number, h: number, tile: number) => {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / tile, (uv.getY(i) * h) / tile);
  return g;
};

/** Wall-plane rectangle (z = 0) with world-scaled UVs, by its x/y extents. */
const WallPiece: React.FC<{ x0: number; x1: number; y0: number; y1: number; mat: THREE.Material }> = ({ x0, x1, y0, y1, mat }) => {
  const g = useMemo(() => {
    const g = plane(x1 - x0, y1 - y0, 2.6);
    // offset UVs by world position so adjacent pieces tile continuously
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) + x0 / 2.6, uv.getY(i) + y0 / 2.6);
    return g;
  }, [x0, x1, y0, y1]);
  return <mesh geometry={g} material={mat} position={[(x0 + x1) / 2, (y0 + y1) / 2, 0]} receiveShadow />;
};

// crack ribbons: quads along polylines, each vertex carries its path distance from the origin
type Seg = { a: THREE.Vector2; b: THREE.Vector2; d0: number; d1: number; w: number };
const buildCracks = () => {
  const r = rng(808);
  const segs: Seg[] = [];
  const mainPts: THREE.Vector2[] = [];
  const walk = (x: number, y: number, ang: number, len: number, w: number, d: number, depth: number, main = false) => {
    let L = 0;
    while (L < len) {
      const s = 0.12 + r() * 0.1;
      if (main) {
        // the main crack heads up the wall toward the slot, then runs straight along the lid
        const target = y < SLOT.y0 ? Math.PI / 2 + x * 0.9 : Math.PI / 2 + x * 3;
        ang += (target - ang) * 0.25 + (y < SLOT.y0 ? (r() - 0.5) * 0.7 : 0);
      } else ang += (r() - 0.5) * 0.8;
      const nx = x + Math.cos(ang) * s, ny = y + Math.sin(ang) * s;
      const ww = main ? w : w * (1 - (L / len) * 0.8);
      segs.push({ a: new THREE.Vector2(x, y), b: new THREE.Vector2(nx, ny), d0: main ? y - CRACK_ORIGIN.y : d + L, d1: main ? ny - CRACK_ORIGIN.y : d + L + s, w: ww });
      x = nx; y = ny; L += s;
      if (main) mainPts.push(new THREE.Vector2(x, y));
      if (depth < 3 && r() < (main ? 0.06 : 0.07)) walk(x, y, ang + (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.8), (main ? 1.2 + r() * 4 : len * 0.4), main ? 0.03 : ww * 0.7, main ? y - CRACK_ORIGIN.y : d + L, depth + 1);
      if (main && y > LID.y0) break;
    }
  };
  walk(CRACK_ORIGIN.x, CRACK_ORIGIN.y, Math.PI / 2, 999, 0.065, 0, 0, true);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + 0.3;
    if (Math.abs(a - Math.PI / 2) < 0.4) continue;
    walk(CRACK_ORIGIN.x, CRACK_ORIGIN.y, a, 1.2 + r() * 2.2, 0.035, 0, 1);
  }
  const pos: number[] = [], dist: number[] = [], side: number[] = [], idx: number[] = [];
  segs.forEach((s, i) => {
    const dir = s.b.clone().sub(s.a).normalize();
    const n = new THREE.Vector2(-dir.y, dir.x).multiplyScalar(s.w / 2);
    const v = [s.a.clone().add(n), s.a.clone().sub(n), s.b.clone().add(n), s.b.clone().sub(n)];
    v.forEach((p) => pos.push(p.x, p.y, 0));
    dist.push(s.d0, s.d0, s.d1, s.d1);
    side.push(1, -1, 1, -1);
    const o = i * 4;
    idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aD", new THREE.Float32BufferAttribute(dist, 1));
  g.setAttribute("aS", new THREE.Float32BufferAttribute(side, 1));
  g.setIndex(idx);
  return { geo: g, main: mainPts };
};
const crackMat = () =>
  new THREE.ShaderMaterial({
    uniforms: { uTip: { value: 0 }, uGlow: { value: 1 } },
    vertexShader: `attribute float aD; attribute float aS; varying float vD; varying float vS; void main(){ vD=aD; vS=aS; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
    fragmentShader: `uniform float uTip; uniform float uGlow; varying float vD; varying float vS;
      void main(){ if(vD>uTip) discard; float hot=exp(-(uTip-vD)*0.9);
        float core=exp(-vS*vS*7.0); vec3 lava=vec3(0.93,0.94,0.97)*uGlow*(0.95+1.1*hot);
        vec3 c=mix(vec3(0.05,0.025,0.01),lava,core); gl_FragColor=vec4(c,1.0);} `,
    side: THREE.DoubleSide,
    toneMapped: false,
    // sits on the wall: win the depth test without z-fighting at long range
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });

// ---------------------------------------------------------------------------------------------
/** Blueprint drawing of the room: axes, polar rings round RUDO, floor grid, outlines. */
const buildBlueprint = () => {
  const v: number[] = [];
  const seg = (a: [number, number, number], b: [number, number, number]) => v.push(...a, ...b);
  const W2 = ROOM.halfW, D = ROOM.depth, Hh = ROOM.height;
  // axes through the crack origin
  seg([-W2, CRACK_ORIGIN.y, 0.005], [W2, CRACK_ORIGIN.y, 0.005]);
  seg([0, 0, 0.005], [0, Hh, 0.005]);
  // polar rings + spokes on the floor round RUDO
  for (const r of [0.55, 0.95, 1.45, 2.1]) {
    for (let i = 0; i < 72; i++) {
      const a0 = (i / 72) * Math.PI * 2, a1 = ((i + 1) / 72) * Math.PI * 2;
      seg([Math.cos(a0) * r, 0.004, RUDO_POS.z + 0.25 + Math.sin(a0) * r], [Math.cos(a1) * r, 0.004, RUDO_POS.z + 0.25 + Math.sin(a1) * r]);
    }
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    seg([0, 0.004, RUDO_POS.z + 0.25], [Math.cos(a) * 2.1, 0.004, RUDO_POS.z + 0.25 + Math.sin(a) * 2.1]);
  }
  // floor grid
  for (let x = -W2; x <= W2 + 1e-6; x += 0.5) seg([x, 0.003, 0], [x, 0.003, D]);
  for (let z = 0; z <= D + 1e-6; z += 0.5) seg([-W2, 0.003, z], [W2, 0.003, z]);
  // room outline
  const c: [number, number, number][] = [[-W2, 0, 0], [W2, 0, 0], [W2, Hh, 0], [-W2, Hh, 0]];
  for (let i = 0; i < 4; i++) seg(c[i], c[(i + 1) % 4]);
  for (const x of [-W2, W2]) {
    seg([x, 0, 0], [x, 0, D]);
    seg([x, Hh, 0], [x, Hh, D]);
  }
  // dimension line across the floor, with ticks
  seg([-W2, 0.01, 7.6], [W2, 0.01, 7.6]);
  for (let x = -W2; x <= W2 + 1e-6; x += 0.4) seg([x, 0.01, 7.52], [x, 0.01, 7.68]);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
  return g;
};



// ---------------------------------------------------------------------------------------------
export const World: React.FC<{ t: number; a: Assets; bloom: number }> = ({ t, a, bloom }) => {
  const { camera, scene, gl, size } = useThree();

  // ---- materials ----
  const M = useMemo(() => buildMats(a), [a]);
  const TM = useMemo(() => typeMats(), []);
  const SP = useMemo(() => sparkMat(), []);

  const cracks = useMemo(() => {
    const b = buildCracks();
    return { geo: b.geo, main: b.main, mat: crackMat() };
  }, []);
  const mainX = (y: number) => {
    const m = cracks.main;
    let lo = 0, hi = m.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (m[mid].y < y) lo = mid + 1;
      else hi = mid;
    }
    return m[Math.min(lo, m.length - 1)]?.x ?? 0;
  };
  const blueprint = useMemo(() => buildBlueprint(), []);
  const sky = useMemo(() => skyMat(), []);
  const skyDeck = useMemo(() => skyMat(), []);
  const starMat = useMemo(() => pointsMat(520), []);
  const emberMat = useMemo(() => pointsMat(260), []);
  const SKY_C = useMemo(() => new THREE.Vector3(0, 175, 0), []);
  const stars = useMemo(
    () =>
      pointsGeo(
        5000,
        (i, r) => {
          const deep = i > 2600;
          let p: [number, number, number];
          if (deep) {
            const k = r();
            p = [(r() - 0.5) * 220, 230 + k * 400, 60 + k * 330 + (r() - 0.5) * 160];
          } else {
            const u = 0.02 + r() * 0.98, th = r() * Math.PI * 2, s = Math.sqrt(1 - u * u);
            p = [Math.cos(th) * s * 600, 175 + Math.sin(th) * s * 600, u * 600];
          }
          const warm = r();
          return { p, c: [1, 0.92 + warm * 0.08, 0.82 + warm * 0.18], s: r() < 0.03 ? 3.5 : 0.8 + r() * 1.4 };
        },
        11,
      ),
    [],
  );
  const city = useMemo(
    () =>
      pointsGeo(
        4200,
        (i, r) => {
          const gx = r() < 0.5;
          const a1 = (Math.floor(r() * 70) - 35) * 7;
          const b1 = r() * 600;
          const x = gx ? a1 + (r() - 0.5) : (r() - 0.5) * 500;
          const y = EDGE + 25 + (gx ? b1 : Math.floor(r() * 80) * 7.5);
          const w = r();
          return { p: [x, y, -48 - r() * 3], c: [0.85 + w * 0.15, 0.85 + w * 0.15, 0.88 + w * 0.12], s: 1.2 + r() * 2.2 };
        },
        23,
      ),
    [],
  );
  const embersSeed = useMemo(() => {
    const r = rng(31);
    return Array.from({ length: 420 }, () => ({ x: (r() - 0.5) * 14, y: r() * 30, life: 2.5 + r() * 3.5, off: r() * 10, vz: 0.8 + r() * 1.8, ph: r() * 6.3, s: 0.5 + r() * 1.2, hot: r() }));
  }, []);
  const emberGeo = useMemo(() => pointsGeo(420, () => ({ p: [0, 0, 0], c: [0, 0, 0], s: 1 }), 2), []);

  const composer = useMemo(() => {
    const c = new EffectComposer(gl);
    c.addPass(new RenderPass(scene, camera));
    const b = new UnrealBloomPass(new THREE.Vector2(size.width / 2, size.height / 2), 0.5, 0.4, 0.88);
    c.addPass(b);
    c.addPass(new OutputPass());
    return { c, b };
  }, [gl, scene, camera, size.width, size.height]);
  useFrame(() => composer.c.render(), 1);

  // ---- camera ----
  const cam = camAt(t);
  const kick = kickEnv(t, 0.12);
  useLayoutEffect(() => {
    const c = camera as THREE.PerspectiveCamera;
    c.position.copy(cam.pos);
    c.up.copy(cam.up);
    c.lookAt(cam.look);
    c.fov = cam.fov;
    c.near = t > DROP && t < 29.4 ? 0.12 : 0.04;
    c.far = 3000;
    c.updateProjectionMatrix();
  });

  // ---- environment by zone ----
  const outro = t >= OUTRO.start;
  const inRoom = t < DROP + 1.4 || outro;
  const inSky = (t >= CH1.start - 0.4 && t < V2.start) || (t >= CH3.start && t < OUTRO.start);
  const inHouse = t >= V2.start && t < V3.start;
  const inDesk = t >= V3.start && t < CH3.start;
  const level = outro ? 1 : tubeLevel(t, TUBE_ON);
  gl.toneMapping = THREE.ACESFilmicToneMapping;
  gl.toneMappingExposure = inSky ? 1.05 : 1.15;
  composer.b.strength = bloom;
  scene.background = new THREE.Color(inSky ? "#030304" : "#030303");
  const fogC = outro || t < DROP ? null : inDesk ? "#050505" : inHouse ? null : t < 29.6 ? "#040404" : t < CH1.start - 0.4 ? "#05060a" : null;
  scene.fog = fogC ? new THREE.Fog(fogC, 4, inDesk ? 22 : t < 29.6 ? 34 : 26) : null;

  const tipAt = (tt: number) => (tt < DROP ? -1 : Math.max(3.5 * expoOut(clamp01((tt - DROP) / 0.45)), camAt(tt).pos.y - CRACK_ORIGIN.y + 9 + (tt - DROP) * 0.1));
  cracks.mat.uniforms.uTip.value = outro || t > CH1.start ? 400 : Math.min(tipAt(t), 400);
  cracks.mat.uniforms.uGlow.value = 0.8 + 0.35 * Math.min(1, kickEnv(t, 0.25)) + 0.3 * Math.exp(-Math.max(0, t - DROP) / 0.35);
  sky.uniforms.uGlow.value = 0.8 + 0.5 * kickEnv(t, 0.3);
  sky.uniforms.uSun.value = t >= CH3.start ? 0.35 : 0;
  starMat.uniforms.uTime.value = t;
  starMat.uniforms.uFade.value = inSky ? clamp01((t - CH1.start + 0.4) / 1.2) : 0;
  M.photo.uniforms.uLevel.value = 0.06 + 0.94 * level;
  // the room is drawn as a blueprint during the strings, then the tube fills it in
  const draw = clamp01((t - 0.25) / 3.1);
  M.blue.opacity = (t < TUBE_ON ? 1 : 1 - 0.75 * clamp01((t - TUBE_ON) / 1.5)) * (0.35 + 0.65 * draw);
  for (const e of [M.wall, M.floor, M.brick]) e.u.uMix.value = 1;

  if (inSky) {
    const P = emberGeo.attributes.position.array as Float32Array, Cc = emberGeo.attributes.aColor.array as Float32Array, S = emberGeo.attributes.aSize.array as Float32Array;
    const local = t - CH1.start;
    embersSeed.forEach((e, i) => {
      const age = (local + e.off) % e.life;
      const k = age / e.life;
      P.set([e.x + Math.sin(age + e.ph) * 0.8, cam.pos.y + 2 + e.y, -1 + age * e.vz], i * 3);
      const f = Math.sin(Math.PI * k) * (0.8 + 0.4 * kick);
      Cc.set([(0.7 + e.hot * 0.5) * f, (0.7 + e.hot * 0.5) * f, (0.74 + e.hot * 0.5) * f], i * 3);
      S[i] = e.s;
    });
    emberGeo.attributes.position.needsUpdate = true;
    emberGeo.attributes.aColor.needsUpdate = true;
    emberGeo.attributes.aSize.needsUpdate = true;
  }

  // ---- lyrics ----
  const intro = linesOf("intro");
  const [nobody, built] = intro;
  const v1 = linesOf("verse1");
  const pre = linesOf("prechorus1");
  const ch1 = linesOf("chorus1");

  const bricks = useMemo(() => {
    const rows = [[0, 1], [2, 3]];
    const S = 0.3, G = 0.012;
    const out: { ch: string; x: number; y: number; t0: number; w: number }[] = [];
    rows.forEach((idx, ri) => {
      const letters = idx.flatMap((wi, n) => [...(n > 0 ? [{ ch: " ", wi, k: -1 }] : []), ...built.words[wi].w.toUpperCase().split("").map((ch, k) => ({ ch, wi, k }))]);
      const total = letters.reduce((s, l) => s + (l.ch === " " ? S * 0.45 : S) + G, -G);
      let x = -total / 2;
      letters.forEach((l) => {
        const w = l.ch === " " ? S * 0.45 : S;
        if (l.ch !== " ") out.push({ ch: l.ch, x: x + w / 2, y: (rows.length - 1 - ri) * (S + G) + S / 2, t0: built.words[l.wi].s + l.k * 0.045, w });
        x += w + G;
      });
    });
    return out;
  }, []);

  const stepsVisible = t > PRE_WORDS[0].s - 0.5 && t < CH1.start + 3;
  const lidShards = useMemo(() => {
    const r = rng(9);
    const out: { geo: THREE.BufferGeometry; c: THREE.Vector3; v: THREE.Vector3; spin: THREE.Vector3 }[] = [];
    const nx = 4, ny = 6;
    const X = (i: number) => -TRENCH.halfW + (i / nx) * TRENCH.halfW * 2;
    const Yy = (j: number) => LID.y0 + (j / ny) * (LID.y1 - LID.y0);
    for (let i = 0; i < nx; i++)
      for (let j = 0; j < ny; j++) {
        const pts = [new THREE.Vector2(X(i), Yy(j)), new THREE.Vector2(X(i + 1), Yy(j)), new THREE.Vector2(X(i + 1), Yy(j + 1)), new THREE.Vector2(X(i), Yy(j + 1))];
        const tris = r() < 0.5 ? [[0, 1, 2], [0, 2, 3]] : [[0, 1, 3], [1, 2, 3]];
        tris.forEach((tr) => {
          const c = pts[tr[0]].clone().add(pts[tr[1]]).add(pts[tr[2]]).multiplyScalar(1 / 3);
          const shape = new THREE.Shape(tr.map((q) => pts[q].clone().sub(c)));
          const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.25, bevelEnabled: false });
          const uv = geo.attributes.uv as THREE.BufferAttribute;
          for (let q = 0; q < uv.count; q++) uv.setXY(q, (uv.getX(q) + c.x) / 2.6, (uv.getY(q) + c.y) / 2.6);
          out.push({ geo, c: new THREE.Vector3(c.x, c.y, -0.25), v: new THREE.Vector3(c.x * (1.5 + r() * 2), (r() - 0.3) * 6, 9 + r() * 10), spin: new THREE.Vector3((r() - 0.5) * 9, (r() - 0.5) * 9, (r() - 0.5) * 6) });
        });
      }
    return out;
  }, []);

  const cables = useMemo(() => {
    const r = rng(3);
    return Array.from({ length: 6 }, (_, i) => {
      const x0 = -1.25 + i * 0.5;
      const pts: THREE.Vector3[] = [];
      for (let y = TRENCH.y0; y <= STAIRS.y0; y += 4) pts.push(new THREE.Vector3(x0 + Math.sin(y * 0.11 + i) * 0.12, y, TRENCH.floor + 0.06 + r() * 0.05));
      return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 220, 0.03 + r() * 0.015, 6, false);
    });
  }, []);
  const G = useMemo(
    () => ({
      roomFloor: plane(ROOM.halfW * 2, ROOM.depth, 2.6),
      roomWall: plane(ROOM.depth, ROOM.height, 2.6),
      trFloor: plane(TRENCH.halfW * 2, TRENCH.y1 - TRENCH.y0, 2.6),
      trWall: plane(-TRENCH.floor, TRENCH.y1 - TRENCH.y0, 2.6),
      trCap: plane(TRENCH.halfW * 2, -TRENCH.floor, 2.6),
      box: new THREE.BoxGeometry(1, 1, 1),
      boxEdges: new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
      packet: new THREE.SphereGeometry(0.035, 8, 8),
      led: new THREE.BoxGeometry(0.012, STAIRS.y0 - TRENCH.y0, 0.012),
    }),
    [],
  );
  const highway = v1.find((l) => /highway/i.test(l.text));
  const preLast = new Set(pre.map((l) => l.words[l.words.length - 1]));
  const Z = new THREE.Vector3(0, 0, 1);

  // crack-tip sparks: a burst every 0.2 s from where the fracture front is
  const tipBursts: number[] = [];
  if (t > DROP && t < 29.5) for (let k = Math.ceil((t - 0.9 - DROP) / 0.2); DROP + k * 0.2 <= t; k++) if (k >= 0) tipBursts.push(DROP + k * 0.2);

  return (
    <>
      <ambientLight intensity={inSky ? 0.18 : 0.03} />
      {/* ===================== ROOM ===================== */}
      {inRoom ? (
        <group>
          <mesh geometry={G.roomFloor} material={M.floor.m} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, ROOM.depth / 2]} />
          {[-1, 1].map((s) => (
            <mesh key={s} geometry={G.roomWall} material={M.wall.m} rotation={[0, (-s * Math.PI) / 2, 0]} position={[s * ROOM.halfW, ROOM.height / 2, ROOM.depth / 2]} />
          ))}
          <lineSegments geometry={blueprint} material={M.blue} />
          <mesh position={[0, 4.15, 1.6]} material={M.tube}>
            <boxGeometry args={[1.7, 0.045, 0.06]} />
          </mesh>
          <pointLight position={[0, 3.95, 1.7]} intensity={26 * level} distance={0} decay={2} color="#eef2ff" />
          <spotLight position={[0, 4.1, 1.6]} angle={0.75} penumbra={0.9} intensity={60 * level} distance={0} decay={2} color="#f2f4ff" />
          <pointLight position={[1.6, 2.4, 6.4]} intensity={9 * level} distance={0} decay={2} color="#f2f1ee" />
          <pointLight position={[-1.2, 1.4, 3.4]} intensity={5 * level * clamp01((t - built.start + 0.5) / 0.5)} distance={6} decay={1.5} color="#eeedea" />
          {t > DROP ? <pointLight position={[0, 2.6, 0.6]} intensity={6 * (0.6 + kick)} distance={0} decay={2} color="#f4f6fa" /> : null}
          {/* RUDO, engraved */}
          {(() => {
            const asp = (a.rudo.image as HTMLImageElement).width / (a.rudo.image as HTMLImageElement).height;
            const h = 1.36;
            return (
              <>
                <mesh position={[RUDO_POS.x, h / 2 - 0.03, RUDO_POS.z]} material={M.photo}>
                  <planeGeometry args={[h * asp, h]} />
                </mesh>
                <mesh position={[0, 0.003, RUDO_POS.z + 0.25]} rotation={[-Math.PI / 2, 0, 0]} material={M.shadow}>
                  <planeGeometry args={[1.9, 0.9]} />
                </mesh>
              </>
            );
          })()}
          {/* NOBODY HANDED ME NOTHING! */}
          <Panel at={new THREE.Vector3(0.04, 1.98, 4.15)} face={new THREE.Vector3(0.1, 1.6, 7.6)} up={new THREE.Vector3(0, 1, 0)} tilt={[0, 0.16, 0.02]}>
            <FillLine font={a.inter} line={nobody} t={t} size={0.2} maxW={0.8} mats={TM} mode="slam" out={built.start - 0.2} sparks={SP} />
          </Panel>
          {/* So I built it! — lettered bricks */}
          <group position={[-1.75, 0, 2.35]} rotation={[0, 1.0, 0]}>
            {bricks.map((b, i) => {
              if (t < b.t0) return null;
              const p = clamp01((t - b.t0) / 0.3);
              const land = t - b.t0 - 0.3;
              const dy = (1 - p * p) * 3.2 + (land > 0 ? Math.abs(Math.sin(land * 26)) * 0.05 * Math.exp(-land / 0.07) : 0);
              const lit = land > 0;
              return (
                <group key={i} position={[b.x, b.y + dy, 0]} rotation={[0, (1 - p) * 0.6, (1 - p) * 0.3]}>
                  <mesh material={M.brick.m} geometry={G.box} scale={[b.w, 0.3, 0.3]} />
                  <lineSegments geometry={G.boxEdges} material={M.edge} scale={[b.w * 1.002, 0.302, 0.302]} />
                  <mesh geometry={letterGeo(a.inter, b.ch, 0.17)} material={lit ? (i >= bricks.length - 3 ? TM.accent : TM.lit) : TM.ghost} position={[-advance(a.inter, b.ch, 0.17) / 2, -0.065, 0.152]} />
                  <SparkBurst t={t} at={b.t0 + 0.3} origin={[0, -0.15, 0.1]} count={26} speed={2.2} spread={1.4} gravity={[0, -7, 0]} mat={SP} seed={i + 5} life={0.45} dir={[0, 0.4, 1]} />
                </group>
              );
            })}
          </group>
          {/* RUDO / SHOUT IT TO THE SKY set into the wall */}
          {t > TITLE_IN
            ? "RUDO".split("").map((ch, i) => {
                const p = cubicOut(clamp01((t - TITLE_IN - i * 0.18) / 1.0));
                if (p <= 0) return null;
                return <mesh key={ch} geometry={letterGeo(a.inter, ch, 0.42)} material={p < 0.25 ? TM.hot : TM.lit} position={[(i - 1.5) * 0.66 - advance(a.inter, ch, 0.42) / 2, 2.98 - (1 - p) * 0.08, 0.01]} />;
              })
            : null}
          {t > TITLE_IN + 0.9
            ? [..."SHOUT IT TO THE SKY"].map((ch, i, arr) => {
                if (ch === " " || t < TITLE_IN + 0.9 + i * 0.03) return null;
                const x0 = arr.slice(0, i).reduce((s2, c) => s2 + advance(a.inter, c, 0.07) + 0.035, 0);
                const total = arr.reduce((s2, c) => s2 + advance(a.inter, c, 0.07) + 0.035, 0);
                return <mesh key={i} geometry={letterGeo(a.inter, ch, 0.07)} material={TM.accent} position={[x0 - total / 2, 2.66, 0.01]} />;
              })
            : null}
        </group>
      ) : null}

      {/* ===================== THE WALL (later: the ground) ===================== */}
      <group>
        <WallPiece x0={-40} x1={-TRENCH.halfW} y0={0} y1={EDGE} mat={inSky ? M.roof.m : M.wall.m} />
        <WallPiece x0={TRENCH.halfW} x1={40} y0={0} y1={EDGE} mat={inSky ? M.roof.m : M.wall.m} />
        <WallPiece x0={-TRENCH.halfW} x1={TRENCH.halfW} y0={0} y1={SLOT.y0} mat={M.wall.m} />
        <WallPiece x0={-TRENCH.halfW} x1={-SLOT.halfW} y0={SLOT.y0} y1={SLOT.y1} mat={M.wall.m} />
        <WallPiece x0={SLOT.halfW} x1={TRENCH.halfW} y0={SLOT.y0} y1={SLOT.y1} mat={M.wall.m} />
        <WallPiece x0={-TRENCH.halfW} x1={TRENCH.halfW} y0={SLOT.y1} y1={LID.y0} mat={M.wall.m} />
        <WallPiece x0={-TRENCH.halfW} x1={TRENCH.halfW} y0={LID.y1} y1={EDGE} mat={inSky ? M.roof.m : M.wall.m} />
        {t < CH1.start ? (
          <WallPiece x0={-TRENCH.halfW} x1={TRENCH.halfW} y0={LID.y0} y1={LID.y1} mat={M.wall.m} />
        ) : (
          lidShards.map((s, i) => {
            const e = t - CH1.start;
            if (e > 3) return null;
            return <mesh key={i} geometry={s.geo} material={M.roof.m} position={[s.c.x + s.v.x * e, s.c.y + s.v.y * e, s.c.z + s.v.z * e - 4.9 * e * e]} rotation={[s.spin.x * e, s.spin.y * e, s.spin.z * e]} />;
          })
        )}
        {t > DROP && t < 30 ? (
          <>
            <pointLight position={[0.3, cam.pos.y + 3.5, 0.9]} intensity={22 * (0.7 + 0.5 * kick)} distance={18} decay={1.2} color="#e9edf2" />
            <pointLight position={[-2.5, cam.pos.y + 10, 4]} intensity={30} distance={40} decay={1.1} color="#b8c2cc" />
          </>
        ) : null}
        <mesh geometry={cracks.geo} material={cracks.mat} position={[0, 0, 0.012]} />
        <mesh geometry={cracks.geo} material={cracks.mat} position={[0, 0, -0.012]} />
        {tipBursts.map((tb) => {
          const ty = Math.min(SLOT.y0, CRACK_ORIGIN.y + tipAt(tb) - 6.5);
          return <SparkBurst key={tb} t={t} at={tb} origin={[mainX(ty), ty, 0.03]} count={30} speed={3.2} spread={0.9} gravity={tb < DROP + 0.6 ? [0, -7, 0] : [0, 0, -7]} mat={SP} seed={Math.round(tb * 10)} life={0.55} dir={tb < DROP + 0.6 ? [0, 0.3, 1] : [0, 0.5, 1]} />;
        })}
      </group>

      {/* ===================== TRENCH (verse 1) + STAIRS (pre-chorus) ===================== */}
      {t > 27 && t < CH1.start + 2.5 ? (
        <group>
          <mesh geometry={G.trFloor} material={M.cold.m} position={[0, (TRENCH.y0 + TRENCH.y1) / 2, TRENCH.floor]} />
          {[-1, 1].map((s) => (
            <mesh key={s} geometry={G.trWall} material={M.cold.m} position={[s * TRENCH.halfW, (TRENCH.y0 + TRENCH.y1) / 2, TRENCH.floor / 2]} rotation={[0, (-s * Math.PI) / 2, 0]} />
          ))}
          <mesh geometry={G.trCap} material={M.cold.m} position={[0, TRENCH.y0, TRENCH.floor / 2]} rotation={[Math.PI / 2, 0, 0]} />
          {cables.map((g, i) => (
            <mesh key={i} geometry={g} material={M.cable} />
          ))}
          {Array.from({ length: 36 }, (_, i) => {
            const lane = i % 6;
            const y = TRENCH.y0 + ((t * (11 + (i % 5)) + i * 7.3) % (STAIRS.y0 - TRENCH.y0));
            return <mesh key={i} geometry={G.packet} material={M.packet} position={[-1.25 + lane * 0.5 + Math.sin(y * 0.11 + lane) * 0.12, y, TRENCH.floor + 0.1]} scale={[1, 8, 1]} />;
          })}
          {[-1, 1].flatMap((s) => [-2.4, -7.6].map((z) => <mesh key={`${s}${z}`} geometry={G.led} material={M.led} position={[s * (TRENCH.halfW - 0.02), (TRENCH.y0 + STAIRS.y0) / 2, z]} />))}
          {[0, 1, 2].map((i) => {
            const y = Math.floor(cam.pos.y / 9) * 9 + i * 9;
            return <pointLight key={i} position={[0, y, -3.2]} intensity={16} distance={16} decay={1.4} color="#d7e4ee" />;
          })}
          {highway && t > highway.start - 0.2 && t < highway.end + 1.2
            ? Array.from({ length: 10 }, (_, i) => {
                const d = t - highway.start - i * 0.12;
                if (d < 0) return null;
                const y = cam.pos.y + 26 - d * 38;
                const s = i % 2 ? 1 : -1;
                return <mesh key={i} geometry={G.box} position={[s * 1.25, y, TRENCH.floor + 0.4 + (i % 3) * 0.5]} material={i % 3 === 0 ? M.packet : M.led} scale={[0.03, 2.6, 0.03]} />;
              })
            : null}
          {v1.map((l, i) => {
            const at = lineAnchor(l, 0.35);
            const side = i % 2 ? 1 : -1;
            const pos = new THREE.Vector3(side * 0.16, at.y, at.z + (i % 3 === 0 ? 0.2 : -0.25));
            const from = camAt(l.start).pos;
            return (
              <Panel key={l.id} at={pos} face={new THREE.Vector3(from.x * 0.5, from.y, from.z)} up={Z} tilt={[0, side * 0.22, side * 0.04]}>
                <FillLine font={a.inter} line={l} t={t} size={0.19} maxW={1.85} mats={TM} base="steel" accentAll={/^red$/i} sparks={SP} />
              </Panel>
            );
          })}
          {stepsVisible
            ? PRE_WORDS.map((w, k) => {
                if (t < w.s - 0.02) return null;
                const s = stepPos(k);
                const h = s.z - TRENCH.floor;
                const p = expoOut(clamp01((t - w.s) / 0.22));
                const mini = { id: `S${k}`, section: "prechorus1", text: w.w, style: "rap" as const, words: [w], start: w.s, end: w.e, anchored: 1 };
                return (
                  <group key={k}>
                    <mesh material={M.cold.m} geometry={G.box} position={[0, s.y + STAIRS.run / 2, TRENCH.floor + (h * p) / 2]} scale={[TRENCH.halfW * 2 - 0.02, STAIRS.run, Math.max(0.001, h * p)]} />
                    <lineSegments geometry={G.boxEdges} material={M.edge} position={[0, s.y + STAIRS.run / 2, TRENCH.floor + (h * p) / 2]} scale={[TRENCH.halfW * 2 - 0.02, STAIRS.run, Math.max(0.001, h * p)]} />
                    <group position={[0, s.y - 0.02, s.z - STAIR_RISE * 0.5]} rotation={[Math.PI / 2, 0, 0]}>
                      <FillLine font={a.inter} line={mini} t={t} size={STAIR_RISE * 0.62} maxW={3} mats={TM} accentLast={preLast.has(w)} />
                    </group>
                  </group>
                );
              })
            : null}
          {stepsVisible ? <pointLight position={[0, LID.y0 + 1, -0.8]} intensity={4 + 30 * clamp01((t - PRE_WORDS[0].s) / (CH1.start - PRE_WORDS[0].s))} distance={30} decay={1.5} color="#eeeeee" /> : null}
          {stepsVisible ? <pointLight position={[0.6, cam.pos.y + 1.6, cam.pos.z + 0.6]} intensity={16} distance={10} decay={1.2} color="#f0f0f0" /> : null}
        </group>
      ) : null}

      {/* ===================== SKY (chorus) ===================== */}
      {inSky ? (
        <group>
          <mesh material={sky} position={SKY_C}>
            <sphereGeometry args={[900, 48, 32]} />
          </mesh>
          <points geometry={stars} material={starMat} frustumCulled={false} />
          <points geometry={city} material={starMat} frustumCulled={false} />
          <hemisphereLight args={["#2c2e33", "#0d0d0e", 0.6]} />
          <directionalLight position={[0, 400, 30]} intensity={1.8} color="#e8e9ec" />
          <mesh position={[0, EDGE - 0.01, 0.02]} material={M.rim}>
            <boxGeometry args={[80, 0.025, 0.03]} />
          </mesh>
          {(() => {
            const asp = (a.rudo.image as HTMLImageElement).width / (a.rudo.image as HTMLImageElement).height;
            const h = 1.36;
            return (
              <group position={[0, EDGE - 0.5, h / 2 - 0.03]} rotation={[Math.PI / 2, 0, 0]}>
                <mesh position={[0, 0, -0.03]} scale={[1.04, 1.03, 1]} material={M.halo}>
                  <planeGeometry args={[h * asp, h]} />
                </mesh>
                <mesh material={M.silhouette}>
                  <planeGeometry args={[h * asp, h]} />
                </mesh>
              </group>
            );
          })()}
          <points geometry={emberGeo} material={emberMat} frustumCulled={false} />
          {t < V2.start ? <ChorusFlares t={t} a={a} M={M} TM={TM} SP={SP} id="chorus1" up={Z} emberMat={emberMat} /> : <ChorusFlares t={t} a={a} M={M} TM={TM} SP={SP} id="chorus3" up={Z} emberMat={emberMat} />}
          {t > 79 && t < V2.start ? <Slabs t={t} a={a} M={M} TM={TM} SP={SP} id="postchorus1" /> : null}
          {t > POST2.start - 1 ? <Slabs t={t} a={a} M={M} TM={TM} SP={SP} id="postchorus2" /> : null}
          {t >= CH3.start ? <Floaters t={t} a={a} M={M} TM={TM} SP={SP} start={CH3.start} /> : null}
        </group>
      ) : null}
      {/* ===================== HOUSE / DECK (verse 2, pre-chorus 2, chorus 2) ===================== */}
      {inHouse ? <House t={t} a={a} M={M} TM={TM} SP={SP} /> : null}
      {inHouse && t > PRE2.start - 2 ? <Deck t={t} a={a} M={M} TM={TM} SP={SP} emberMat={emberMat} sky={skyDeck} /> : null}
      {/* ===================== DESK / HALLWAY (verse 3, bridge) ===================== */}
      {inDesk ? <Desk t={t} a={a} M={M} TM={TM} SP={SP} /> : null}
      {inDesk && t > BR.start - 3 ? <Hallway t={t} a={a} M={M} TM={TM} SP={SP} emberMat={emberMat} /> : null}
      {/* ===================== OUTRO ===================== */}
      {outro ? (
        <Panel at={new THREE.Vector3(0, 2.05, 2.2)} face={new THREE.Vector3(0, 1.5, 6.4)} up={new THREE.Vector3(0, 1, 0)}>
          <FillLine font={a.inter} line={linesOf("outro")[0]} t={t} size={0.26} maxW={1.2} mats={TM} mode="slam" sparks={SP} />
        </Panel>
      ) : null}
    </>
  );
};
