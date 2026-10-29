import React, { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { Assets } from "./assets";
import { Word3D, layoutRows, wordGeo } from "./Word3D";
import { CH1, CRACK_ORIGIN, EDGE, LID, PRE_WORDS, ROOM, RUDO_POS, SLOT, STAIRS, STAIR_RISE, TRENCH, camAt, lineAnchor, stepPos } from "./layout";
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

/** When a line leaves (or bursts). */
export const outOf = (l: Line, hold = 1.3) => Math.max(l.end, Math.min(nextLineStart(l) - 0.06, l.end + hold));

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
  const walk = (x: number, y: number, ang: number, len: number, w: number, d: number, depth: number, main = false) => {
    let L = 0;
    while (L < len) {
      const s = 0.12 + r() * 0.1;
      if (main) {
        // the main crack heads up the wall toward the slot, then runs straight along the lid
        const target = y < SLOT.y0 ? Math.PI / 2 + (-x * 0.9) : Math.PI / 2 - x * 3;
        ang += (target - ang) * 0.25 + (y < SLOT.y0 ? (r() - 0.5) * 0.7 : 0);
      } else ang += (r() - 0.5) * 0.8;
      const nx = x + Math.cos(ang) * s, ny = y + Math.sin(ang) * s;
      const ww = main ? w : w * (1 - (L / len) * 0.8);
      segs.push({ a: new THREE.Vector2(x, y), b: new THREE.Vector2(nx, ny), d0: d + L, d1: d + L + s, w: ww });
      x = nx; y = ny; L += s;
      if (depth < 3 && r() < (main ? 0.06 : 0.07)) walk(x, y, ang + (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.8), (main ? 1.2 + r() * 4 : len * 0.4), main ? 0.03 : ww * 0.7, d + L, depth + 1);
      if (main && y > LID.y0) break;
    }
  };
  walk(CRACK_ORIGIN.x, CRACK_ORIGIN.y, Math.PI / 2, 999, 0.055, 0, 0, true);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + 0.3;
    if (Math.abs(a - Math.PI / 2) < 0.4) continue;
    walk(CRACK_ORIGIN.x, CRACK_ORIGIN.y, a, 1.2 + r() * 2.2, 0.035, 0, 1);
  }
  const pos: number[] = [], dist: number[] = [], idx: number[] = [];
  segs.forEach((s, i) => {
    const dir = s.b.clone().sub(s.a).normalize();
    const n = new THREE.Vector2(-dir.y, dir.x).multiplyScalar(s.w / 2);
    const v = [s.a.clone().add(n), s.a.clone().sub(n), s.b.clone().add(n), s.b.clone().sub(n)];
    v.forEach((p) => pos.push(p.x, p.y, 0));
    dist.push(s.d0, s.d0, s.d1, s.d1);
    const o = i * 4;
    idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aD", new THREE.Float32BufferAttribute(dist, 1));
  g.setIndex(idx);
  return g;
};
const crackMat = () =>
  new THREE.ShaderMaterial({
    uniforms: { uTip: { value: 0 }, uGlow: { value: 1 } },
    vertexShader: `attribute float aD; varying float vD; void main(){ vD=aD; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
    fragmentShader: `uniform float uTip; uniform float uGlow; varying float vD;
      void main(){ if(vD>uTip) discard; float hot=exp(-(uTip-vD)*0.9);
        vec3 c=vec3(1.0,0.62,0.22)*uGlow*(1.4+3.5*hot); gl_FragColor=vec4(c,1.0);} `,
    side: THREE.DoubleSide,
    toneMapped: false,
  });

// ---------------------------------------------------------------------------------------------
const skyMat = () =>
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { uGlow: { value: 1 }, uFade: { value: 1 } },
    vertexShader: `varying vec3 vDir; void main(){ vDir=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
    fragmentShader: `varying vec3 vDir; uniform float uGlow; uniform float uFade;
      void main(){
        float up=vDir.z; float toward=max(0.0,dot(normalize(vDir.xy),vec2(0.0,1.0)));
        vec3 zen=vec3(0.012,0.018,0.05); vec3 mid=vec3(0.04,0.035,0.08); vec3 hor=vec3(0.95,0.58,0.24);
        vec3 c=mix(mid,zen,smoothstep(0.0,0.7,up));
        float h=smoothstep(0.22,-0.01,up);
        c=mix(c,hor,h*h*(0.12+0.88*pow(toward,4.0))*(0.55+0.35*uGlow));
        c+=vec3(1.0,0.75,0.42)*exp(-pow(up*20.0,2.0))*pow(toward,14.0)*(0.5+0.6*uGlow);
        if(up<-0.02) c=mix(c,vec3(0.02,0.015,0.015),smoothstep(-0.02,-0.15,up));
        gl_FragColor=vec4(c*uFade,1.0);
      }`,
  });
const pointsMat = (sizeScale = 300) =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uFade: { value: 1 } },
    vertexShader: `attribute float aSize; attribute vec3 aColor; attribute float aPhase; uniform float uTime; varying vec3 vC;
      void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0);
        float tw=0.7+0.3*sin(uTime*(1.3+aPhase*2.0)+aPhase*40.0); vC=aColor*tw;
        gl_PointSize=aSize*(${sizeScale.toFixed(1)}/-mv.z); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `varying vec3 vC; uniform float uFade; void main(){ float d=length(gl_PointCoord-0.5); float a=smoothstep(0.5,0.0,d); a*=a; gl_FragColor=vec4(vC*a*uFade,a*uFade);} `,
    toneMapped: false,
  });

const pointsGeo = (n: number, fill: (i: number, r: () => number) => { p: [number, number, number]; c: [number, number, number]; s: number }, seed: number) => {
  const r = rng(seed);
  const p = new Float32Array(n * 3), c = new Float32Array(n * 3), s = new Float32Array(n), ph = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const v = fill(i, r);
    p.set(v.p, i * 3);
    c.set(v.c, i * 3);
    s[i] = v.s;
    ph[i] = r();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(p, 3));
  g.setAttribute("aColor", new THREE.BufferAttribute(c, 3));
  g.setAttribute("aSize", new THREE.BufferAttribute(s, 1));
  g.setAttribute("aPhase", new THREE.BufferAttribute(ph, 1));
  return g;
};

// ---------------------------------------------------------------------------------------------
/** A lyric line as a slab of 3D words in the world, oriented toward where the camera will be. */
const LinePanel: React.FC<{
  a: Assets;
  line: Line;
  t: number;
  family: "bebas" | "oswald";
  size: number;
  maxW: number;
  mat: THREE.Material;
  hot?: THREE.Material;
  pick?: (w: string) => THREE.Material | undefined;
  reveal: "slam" | "snap" | "rise" | "flare" | "glide";
  at: THREE.Vector3;
  face: THREE.Vector3;
  up: THREE.Vector3;
  tilt?: [number, number, number];
  out?: number;
  chant?: boolean;
  scale?: number;
}> = ({ a, line, t, family, size, maxW, mat, hot, pick, reveal, at, face, up, tilt = [0, 0, 0], out, chant, scale = 1 }) => {
  const font = family === "bebas" ? a.bebas : a.oswald;
  const words = useMemo(() => line.words.map((w) => w.w.toUpperCase()), [line.id]);
  const lay = useMemo(() => layoutRows(font, words, size, maxW, 1.02, chant ? (w) => /!$/.test(w) : undefined), [line.id, family, size, maxW]);
  const quat = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.copy(at);
    o.up.copy(up);
    o.lookAt(face);
    o.rotateX(tilt[0]);
    o.rotateY(tilt[1]);
    o.rotateZ(tilt[2]);
    return o.quaternion.clone();
  }, [at.x, at.y, at.z, face.x, face.y, face.z, tilt[0], tilt[1], tilt[2]]);
  if (t < line.start - 0.05 || (out !== undefined && t > out + 0.5)) return null;
  return (
    <group position={at} quaternion={quat} scale={scale}>
      {line.words.map((w, i) => (
        <Word3D
          key={i}
          font={font}
          family={family}
          text={words[i]}
          size={size}
          depth={size * 0.22}
          material={pick?.(w.w) ?? mat}
          hot={hot}
          t={t}
          at={w.s}
          out={out}
          reveal={reveal}
          position={[lay.pos[i].x, lay.pos[i].y, 0]}
        />
      ))}
    </group>
  );
};

/** Embers bursting from a point cloud of positions (when a chorus line lets go). */
const Burst: React.FC<{ t: number; at: number; center: THREE.Vector3; up: THREE.Vector3; spread: number; mat: THREE.ShaderMaterial; seed: number }> = ({ t, at, center, up, spread, mat, seed }) => {
  const seeds = useMemo(() => {
    const r = rng(seed);
    return Array.from({ length: 160 }, () => ({ o: new THREE.Vector3((r() - 0.5) * spread, (r() - 0.5) * spread * 0.25, (r() - 0.5) * 0.4), v: new THREE.Vector3((r() - 0.5) * 2.2, (r() - 0.5) * 1.2, (r() - 0.5) * 2.2), life: 0.8 + r() * 1.1, s: 0.6 + r() * 1.6, hot: r() }));
  }, [seed, spread]);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(seeds.length * 3), 3));
    g.setAttribute("aColor", new THREE.BufferAttribute(new Float32Array(seeds.length * 3), 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(new Float32Array(seeds.length), 1));
    g.setAttribute("aPhase", new THREE.BufferAttribute(new Float32Array(seeds.length), 1));
    return g;
  }, [seeds]);
  const dt = t - at;
  if (dt < 0 || dt > 2.2) return null;
  const P = geo.attributes.position.array as Float32Array, Cc = geo.attributes.aColor.array as Float32Array, S = geo.attributes.aSize.array as Float32Array;
  seeds.forEach((e, i) => {
    const k = clamp01(dt / e.life);
    const p = center.clone().add(e.o).addScaledVector(e.v, dt).addScaledVector(up, dt * 1.6 + dt * dt * 0.8);
    P.set([p.x, p.y, p.z], i * 3);
    const f = (1 - k) * (k < 0.04 ? k / 0.04 : 1);
    Cc.set([1.6 * f, (0.5 + e.hot * 0.6) * f, 0.15 * f], i * 3);
    S[i] = e.s * (1 - k * 0.4);
  });
  geo.attributes.position.needsUpdate = true;
  geo.attributes.aColor.needsUpdate = true;
  geo.attributes.aSize.needsUpdate = true;
  return <points geometry={geo} material={mat} frustumCulled={false} />;
};

// ---------------------------------------------------------------------------------------------
export const World: React.FC<{ t: number; a: Assets; bloom: number }> = ({ t, a, bloom }) => {
  const { camera, scene, gl, size } = useThree();

  // ---- materials ----
  const M = useMemo(() => {
    const concrete = new THREE.MeshStandardMaterial({ map: a.concrete, bumpMap: a.concreteBump, bumpScale: 1.4, color: "#9a938a", roughness: 0.96, metalness: 0, side: THREE.DoubleSide });
    const floor = concrete.clone();
    floor.color = new THREE.Color("#6f6a63");
    floor.roughness = 0.78;
    const stone = new THREE.MeshStandardMaterial({ map: a.concrete, color: "#efe4d1", roughness: 0.82, metalness: 0.02 });
    const hot = new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: "#fff1d8", emissiveIntensity: 2.2 });
    const steel = new THREE.MeshStandardMaterial({ color: "#d9e6ef", emissive: "#2c5f86", emissiveIntensity: 0.55, roughness: 0.35, metalness: 0.5 });
    const cyan = new THREE.MeshStandardMaterial({ color: "#a8e4ff", emissive: "#3bb8ff", emissiveIntensity: 2.4, toneMapped: false });
    const red = new THREE.MeshStandardMaterial({ color: "#ff5546", emissive: "#ff2414", emissiveIntensity: 2.2, toneMapped: false });
    const gold = new THREE.MeshStandardMaterial({ color: "#ffe2a8", emissive: "#ffae45", emissiveIntensity: 1.9, roughness: 0.4, toneMapped: false });
    const goldHot = new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: "#fff0c8", emissiveIntensity: 4, toneMapped: false });
    const brick = new THREE.MeshStandardMaterial({ map: a.concrete, color: "#b9a588", roughness: 0.9 });
    const brickInk = new THREE.MeshStandardMaterial({ color: "#2b231c", roughness: 0.7 });
    const tube = new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false });
    const rudo = new THREE.MeshBasicMaterial({ map: a.rudo, transparent: true, depthWrite: true, alphaTest: 0.35 });
    const silhouette = new THREE.MeshBasicMaterial({ map: a.rudo, color: "#000000", transparent: true, alphaTest: 0.35 });
    const halo = new THREE.MeshBasicMaterial({ map: a.rudo, color: "#ffb257", transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const cable = new THREE.MeshStandardMaterial({ color: "#0d1a24", emissive: "#2f8fe0", emissiveIntensity: 0.5, roughness: 0.4 });
    const led = new THREE.MeshBasicMaterial({ color: "#6fc7ff", toneMapped: false });
    const packet = new THREE.MeshBasicMaterial({ color: "#d8f2ff", toneMapped: false });
    const rim = new THREE.MeshBasicMaterial({ color: "#ffbf72", toneMapped: false });
    const shadow = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, color: "#000000", opacity: 0.55, alphaMap: (() => {
      const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d")!;
      const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, "#fff"); g.addColorStop(1, "#000"); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
      return new THREE.CanvasTexture(c);
    })() });
    return { concrete, floor, stone, hot, steel, cyan, red, gold, goldHot, brick, brickInk, tube, rudo, silhouette, halo, cable, led, packet, rim, shadow };
  }, [a]);

  const cracks = useMemo(() => ({ geo: buildCracks(), mat: crackMat() }), []);
  const sky = useMemo(() => skyMat(), []);
  const starMat = useMemo(() => pointsMat(300), []);
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
            // a field around the warp corridor
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
          return { p: [x, y, -48 - r() * 3], c: [1, 0.55 + w * 0.3, 0.2 + w * 0.2], s: 1.2 + r() * 2.2 };
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
    const b = new UnrealBloomPass(new THREE.Vector2(size.width / 2, size.height / 2), 0.85, 0.55, 0.82);
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
    c.near = 0.04;
    c.far = 3000;
    c.updateProjectionMatrix();
  });

  // ---- environment by zone ----
  const inRoom = t < DROP + 1.4;
  const inSky = t >= CH1.start - 0.4;
  const level = tubeLevel(t, TUBE_ON);
  gl.toneMapping = THREE.ACESFilmicToneMapping;
  gl.toneMappingExposure = inSky ? 1.05 : 1.15;
  composer.b.strength = bloom;
  scene.background = new THREE.Color(inSky ? "#03040a" : "#020202");
  const fogC = t < DROP ? null : t < 29.6 ? "#040506" : t < CH1.start - 0.4 ? "#050b12" : null;
  scene.fog = fogC ? new THREE.Fog(fogC, 4, t < 29.6 ? 34 : 26) : null;

  const tip = t < DROP ? -1 : Math.max(3.5 * expoOut(clamp01((t - DROP) / 0.45)), cam.pos.y - CRACK_ORIGIN.y + 9 + (t - DROP) * 0.1);
  cracks.mat.uniforms.uTip.value = Math.min(tip, 400);
  cracks.mat.uniforms.uGlow.value = 0.9 + 0.5 * Math.min(1, kickEnv(t, 0.25)) + 1.2 * Math.exp(-Math.max(0, t - DROP) / 0.35);
  sky.uniforms.uGlow.value = 0.8 + 0.5 * kickEnv(t, 0.3);
  starMat.uniforms.uTime.value = t;
  starMat.uniforms.uFade.value = inSky ? clamp01((t - CH1.start + 0.4) / 1.2) : 0;
  emberMat.uniforms.uFade.value = 1;

  // rooftop embers drift up (+z) ahead of the camera
  if (inSky) {
    const P = emberGeo.attributes.position.array as Float32Array, Cc = emberGeo.attributes.aColor.array as Float32Array, S = emberGeo.attributes.aSize.array as Float32Array;
    const local = t - CH1.start;
    embersSeed.forEach((e, i) => {
      const age = (local + e.off) % e.life;
      const k = age / e.life;
      P.set([e.x + Math.sin(age + e.ph) * 0.8, cam.pos.y + 2 + e.y - ((cam.pos.y * 0.0) % 1), -1 + age * e.vz], i * 3);
      const f = Math.sin(Math.PI * k) * (0.8 + 0.4 * kick);
      Cc.set([1.5 * f, (0.4 + e.hot * 0.5) * f, 0.1 * f], i * 3);
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
  const ch1 = linesOf("chorus1");

  // bricks for "So I built it!": letters on bricks, rows dropped onto the floor beside RUDO
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
          out.push({ geo, c: new THREE.Vector3(c.x, c.y, -0.25), v: new THREE.Vector3((c.x) * (1.5 + r() * 2), (r() - 0.3) * 6, 9 + r() * 10), spin: new THREE.Vector3((r() - 0.5) * 9, (r() - 0.5) * 9, (r() - 0.5) * 6) });
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
      return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 220, 0.035 + r() * 0.02, 6, false);
    });
  }, []);
  const packetGeo = useMemo(() => new THREE.SphereGeometry(0.05, 8, 8), []);
  const ledGeo = useMemo(() => new THREE.BoxGeometry(0.03, STAIRS.y0 - TRENCH.y0, 0.03), []);

  const G = useMemo(
    () => ({
      roomFloor: plane(ROOM.halfW * 2, ROOM.depth, 2.6),
      roomWall: plane(ROOM.depth, ROOM.height, 2.6),
      trFloor: plane(TRENCH.halfW * 2, TRENCH.y1 - TRENCH.y0, 2.6),
      trWall: plane(-TRENCH.floor, TRENCH.y1 - TRENCH.y0, 2.6),
      trCap: plane(TRENCH.halfW * 2, -TRENCH.floor, 2.6),
      box: new THREE.BoxGeometry(1, 1, 1),
    }),
    [],
  );
  const highway = v1.find((l) => /highway/i.test(l.text));

  return (
    <>
      <ambientLight intensity={inSky ? 0.18 : 0.035} />
      {/* ===================== ROOM ===================== */}
      {inRoom ? (
        <group>
          <mesh geometry={G.roomFloor} material={M.floor} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, ROOM.depth / 2]} receiveShadow />
          {[-1, 1].map((s) => (
            <mesh key={s} geometry={G.roomWall} material={M.concrete} rotation={[0, (-s * Math.PI) / 2, 0]} position={[s * ROOM.halfW, ROOM.height / 2, ROOM.depth / 2]} />
          ))}
          {/* fluorescent tube */}
          <mesh position={[0, 4.15, 1.6]} material={M.tube} scale={[1, 1, 1]}>
            <boxGeometry args={[1.7, 0.045, 0.06]} />
          </mesh>
          <pointLight position={[0, 3.95, 1.7]} intensity={26 * level} distance={0} decay={2} color="#e8f0ff" />
          <spotLight position={[0, 4.1, 1.6]} target-position={[0, 0.8, 0.4]} angle={0.75} penumbra={0.9} intensity={60 * level} distance={0} decay={2} color="#f2f4ff" />
          {/* crack light spilling into the room after the drop */}
          {t > DROP ? <pointLight position={[0, 2.6, 0.6]} intensity={6 * (0.6 + kick)} distance={0} decay={2} color="#ffa24a" /> : null}
          {/* RUDO */}
          {(() => {
            const asp = (a.rudo.image as HTMLImageElement).width / (a.rudo.image as HTMLImageElement).height;
            const h = 1.36;
            M.rudo.color.setScalar(0.08 + 0.92 * level);
            return (
              <>
                <mesh position={[RUDO_POS.x, h / 2 - 0.03, RUDO_POS.z]} material={M.rudo}>
                  <planeGeometry args={[h * asp, h]} />
                </mesh>
                <mesh position={[0, 0.003, RUDO_POS.z + 0.25]} rotation={[-Math.PI / 2, 0, 0]} material={M.shadow}>
                  <planeGeometry args={[1.9, 0.9]} />
                </mesh>
              </>
            );
          })()}
          {/* NOBODY HANDED ME NOTHING! — stone words slam into the space between us and him */}
          {nobody.words.map((w, i) => {
            const P: [number, number, number][] = [[-0.25, 2.12, 5.25], [-0.12, 1.55, 5.45], [0.42, 1.55, 5.45], [0.02, 0.92, 5.7]];
            const R: [number, number, number][] = [[0, 0.2, 0.02], [0, -0.14, 0], [0, -0.14, 0], [0, 0.08, -0.02]];
            const S = [0.62, 0.44, 0.44, 0.6];
            return (
              <Word3D key={i} font={a.bebas} family="bebas" text={w.w.toUpperCase()} size={S[i]} depth={0.14} material={M.stone} hot={M.hot} t={t} at={w.s} out={built.start - 0.2} reveal="slam" position={P[i]} rotation={R[i]} />
            );
          })}
          {/* So I built it! — a wall of lettered bricks */}
          <group position={[1.75, 0, 2.35]} rotation={[0, -1.0, 0]}>
            {bricks.map((b, i) => {
              if (t < b.t0) return null;
              const p = clamp01((t - b.t0) / 0.3);
              const land = t - b.t0 - 0.3;
              const dy = (1 - p * p) * 3.2 + (land > 0 ? Math.abs(Math.sin(land * 26)) * 0.05 * Math.exp(-land / 0.07) : 0);
              const g = wordGeo(a.bebas, b.ch, 0.22, 0.03, "bebas");
              return (
                <group key={i} position={[b.x, b.y + dy, 0]} rotation={[0, (1 - p) * 0.6, (1 - p) * 0.3]}>
                  <mesh material={M.brick} geometry={G.box} scale={[b.w, 0.3, 0.3]} />
                  <mesh geometry={g.geo} material={M.brickInk} position={[0, 0, 0.152]} />
                </group>
              );
            })}
          </group>
          {/* RUDO / SHOUT IT TO THE SKY set into the wall */}
          {t > TITLE_IN
            ? "RUDO".split("").map((ch, i) => {
                const p = cubicOut(clamp01((t - TITLE_IN - i * 0.18) / 1.4));
                return <Word3D key={ch} font={a.bebas} family="bebas" text={ch} size={0.55} depth={0.08} material={M.stone} t={t} at={TITLE_IN} position={[(i - 1.5) * 0.72, 3.15, -0.05 + p * 0.09]} reveal="glide" />;
              })
            : null}
          {t > TITLE_IN + 0.9 ? <Word3D font={a.oswald} family="oswald" text="SHOUT IT TO THE SKY" size={0.085} depth={0.015} material={M.stone} t={t} at={TITLE_IN + 0.9} position={[0, 2.66, 0.02]} reveal="glide" /> : null}
        </group>
      ) : null}

      {/* ===================== THE WALL (later: the ground) ===================== */}
      <group>
        <WallPiece x0={-40} x1={-TRENCH.halfW} y0={0} y1={EDGE} mat={M.concrete} />
        <WallPiece x0={TRENCH.halfW} x1={40} y0={0} y1={EDGE} mat={M.concrete} />
        <WallPiece x0={-TRENCH.halfW} x1={TRENCH.halfW} y0={0} y1={SLOT.y0} mat={M.concrete} />
        <WallPiece x0={-TRENCH.halfW} x1={-SLOT.halfW} y0={SLOT.y0} y1={SLOT.y1} mat={M.concrete} />
        <WallPiece x0={SLOT.halfW} x1={TRENCH.halfW} y0={SLOT.y0} y1={SLOT.y1} mat={M.concrete} />
        <WallPiece x0={-TRENCH.halfW} x1={TRENCH.halfW} y0={SLOT.y1} y1={LID.y0} mat={M.concrete} />
        <WallPiece x0={-TRENCH.halfW} x1={TRENCH.halfW} y0={LID.y1} y1={EDGE} mat={M.concrete} />
        {/* the lid over the stairs: whole until the chorus, then it blows out */}
        {t < CH1.start ? (
          <WallPiece x0={-TRENCH.halfW} x1={TRENCH.halfW} y0={LID.y0} y1={LID.y1} mat={M.concrete} />
        ) : (
          lidShards.map((s, i) => {
            const d = t - CH1.start;
            if (d > 3) return null;
            const e = d;
            return (
              <mesh key={i} geometry={s.geo} material={M.concrete} position={[s.c.x + s.v.x * e, s.c.y + s.v.y * e, s.c.z + s.v.z * e - 4.9 * e * e]} rotation={[s.spin.x * e, s.spin.y * e, s.spin.z * e]} />
            );
          })
        )}
        <mesh geometry={cracks.geo} material={cracks.mat} position={[0, 0, 0.006]} />
        <mesh geometry={cracks.geo} material={cracks.mat} position={[0, 0, -0.006]} />
      </group>

      {/* ===================== TRENCH (verse 1) + STAIRS (pre-chorus) ===================== */}
      {t > 27 && t < CH1.start + 2.5 ? (
        <group>
          <mesh geometry={G.trFloor} material={M.floor} position={[0, (TRENCH.y0 + TRENCH.y1) / 2, TRENCH.floor]} />
          {[-1, 1].map((s) => (
            <mesh key={s} geometry={G.trWall} material={M.concrete} position={[s * TRENCH.halfW, (TRENCH.y0 + TRENCH.y1) / 2, TRENCH.floor / 2]} rotation={[0, (-s * Math.PI) / 2, 0]} />
          ))}
          <mesh geometry={G.trCap} material={M.concrete} position={[0, TRENCH.y0, TRENCH.floor / 2]} rotation={[Math.PI / 2, 0, 0]} />
          {/* cables and data packets */}
          {cables.map((g, i) => (
            <mesh key={i} geometry={g} material={M.cable} />
          ))}
          {Array.from({ length: 36 }, (_, i) => {
            const lane = i % 6;
            const y = TRENCH.y0 + ((t * (11 + (i % 5)) + i * 7.3) % (STAIRS.y0 - TRENCH.y0));
            return <mesh key={i} geometry={packetGeo} material={M.packet} position={[-1.25 + lane * 0.5 + Math.sin(y * 0.11 + lane) * 0.12, y, TRENCH.floor + 0.12]} scale={[1, 6, 1]} />;
          })}
          {/* LED strips: clean lines that draw the perspective */}
          {[-1, 1].flatMap((s) =>
            [-2.4, -7.6].map((z) => <mesh key={`${s}${z}`} geometry={ledGeo} material={M.led} position={[s * (TRENCH.halfW - 0.02), (TRENCH.y0 + STAIRS.y0) / 2, z]} />),
          )}
          {/* moving light pool that travels with us (fixed grid, so the lights don't swim) */}
          {[0, 1, 2].map((i) => {
            const y = Math.floor(cam.pos.y / 9) * 9 + i * 9;
            return <pointLight key={i} position={[0, y, -3.2]} intensity={7} distance={14} decay={1.6} color="#7cc4ff" />;
          })}
          {/* headlights down the highway */}
          {highway && t > highway.start - 0.2 && t < highway.end + 1.2
            ? Array.from({ length: 10 }, (_, i) => {
                const d = t - highway.start - i * 0.12;
                if (d < 0) return null;
                const y = cam.pos.y + 26 - d * 38;
                const s = i % 2 ? 1 : -1;
                return (
                  <mesh key={i} geometry={G.box} position={[s * 1.25, y, TRENCH.floor + 0.4 + (i % 3) * 0.5]} material={i % 3 === 0 ? M.red : M.packet} scale={[0.05, 2.6, 0.05]} />
                );
              })
            : null}
          {/* verse 1: each line hangs in the canyon at an angle; we fly through it */}
          {v1.map((l, i) => {
            const at = lineAnchor(l, 0.35);
            const side = i % 2 ? 1 : -1;
            const pos = new THREE.Vector3(side * 0.42, at.y, at.z + (i % 3 === 0 ? 0.25 : -0.35));
            const from = camAt(l.start).pos;
            const pick = (w: string) => (/^red$/i.test(w) ? M.red : /server|switch|port/i.test(w) ? M.cyan : undefined);
            return (
              <LinePanel key={l.id} a={a} line={l} t={t} family="oswald" size={0.25} maxW={2.3} mat={M.steel} hot={M.hot} pick={pick} reveal="snap" at={pos} face={new THREE.Vector3(from.x * 0.5, from.y, from.z)} up={new THREE.Vector3(0, 0, 1)} tilt={[0, side * 0.32, side * 0.05]} />
            );
          })}
          {/* pre-chorus: one step per word */}
          {stepsVisible
            ? PRE_WORDS.map((w, k) => {
                if (t < w.s - 0.02) return null;
                const s = stepPos(k);
                const h = s.z - TRENCH.floor;
                const p = expoOut(clamp01((t - w.s) / 0.22));
                return (
                  <group key={k}>
                    <mesh material={M.floor} geometry={G.box} position={[0, s.y + STAIRS.run / 2, TRENCH.floor + (h * p) / 2]} scale={[TRENCH.halfW * 2 - 0.02, STAIRS.run, Math.max(0.001, h * p)]} />
                    <Word3D font={a.bebas} family="bebas" text={w.w.toUpperCase()} size={0.34} depth={0.08} material={M.stone} hot={M.hot} t={t} at={w.s} reveal="rise" position={[((k % 3) - 1) * 0.55, s.y + STAIRS.run * 0.55, s.z + 0.19]} rotation={[Math.PI / 2, 0, 0]} />
                  </group>
                );
              })
            : null}
          {stepsVisible ? <pointLight position={[0, LID.y0 + 1, -0.8]} intensity={4 + 30 * clamp01((t - PRE_WORDS[0].s) / (CH1.start - PRE_WORDS[0].s))} distance={30} decay={1.5} color="#ffb867" /> : null}
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
          <hemisphereLight args={["#2b3050", "#120c08", 0.6]} />
          <directionalLight position={[0, 400, 30]} intensity={1.6} color="#ffb260" />
          <mesh position={[0, EDGE - 0.01, 0.02]} material={M.rim}>
            <boxGeometry args={[80, 0.03, 0.04]} />
          </mesh>
          {/* RUDO at the edge, against the glow */}
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
          {/* chorus lines launch up off the roof like flares, then burst into embers */}
          {ch1.map((l, i) => {
            const ta = l.start;
            const c0 = camAt(ta);
            const fwd = c0.look.clone().sub(c0.pos).normalize();
            const D = /universe/i.test(l.text) ? 7.5 : 6.2;
            const at = c0.pos.clone().addScaledVector(fwd, D).add(new THREE.Vector3(0, 0, 0.25));
            const out = outOf(l, 1.1);
            const chant = /grinding/i.test(l.text);
            const s = 1 + (chant ? kickEnv(t, 0.12) * 0.08 : 0);
            return (
              <React.Fragment key={l.id}>
                <LinePanel a={a} line={l} t={t} family="bebas" size={0.5} maxW={2.5} mat={M.gold} hot={M.goldHot} reveal="flare" at={at} face={c0.pos} up={c0.up} tilt={[0, (i % 2 ? 1 : -1) * 0.12, 0]} out={out} chant={chant} scale={s} />
                <Burst t={t} at={out} center={at} up={c0.up} spread={2.4} mat={emberMat} seed={i * 17 + 3} />
              </React.Fragment>
            );
          })}
        </group>
      ) : null}
    </>
  );
};

