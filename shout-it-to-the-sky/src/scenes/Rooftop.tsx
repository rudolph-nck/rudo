import React, { useLayoutEffect, useMemo, useState } from "react";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { continueRender, delayRender, staticFile } from "remotion";
import { H, W } from "../theme";
import { rng } from "../utils/random";

// Textures are loaded outside the r3f canvas: in render mode the canvas only draws on frame
// changes, so a texture arriving after the first draw would be missed.
const texCache = new Map<string, THREE.Texture>();
const useTexture = (src: string) => {
  const [tex, setTex] = useState<THREE.Texture | null>(() => texCache.get(src) ?? null);
  const [handle] = useState(() => (texCache.has(src) ? null : delayRender("texture " + src)));
  useLayoutEffect(() => {
    if (tex) return;
    new THREE.TextureLoader().load(src, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      texCache.set(src, t);
      setTex(t);
      if (handle !== null) continueRender(handle);
    });
  }, [src, handle, tex]);
  return tex;
};

export type RoofLook = {
  /** 0 = night gold, 1 = sunrise */
  sunrise: number;
  /** extra glow on the horizon behind RUDO */
  glow: number;
  /** star-field pull, 0..1 */
  warp: number;
};

const skyVert = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const skyFrag = /* glsl */ `
varying vec3 vDir;
uniform float uSunrise;
uniform float uGlow;
void main() {
  float y = vDir.y;
  vec3 zenith = mix(vec3(0.020, 0.028, 0.070), vec3(0.16, 0.20, 0.36), uSunrise);
  vec3 mid    = mix(vec3(0.045, 0.040, 0.085), vec3(0.62, 0.36, 0.32), uSunrise);
  vec3 hor    = mix(vec3(0.95, 0.62, 0.26),  vec3(1.00, 0.70, 0.38), uSunrise);
  // glow centred behind the figure (-z)
  float toward = max(0.0, dot(normalize(vec2(vDir.x, vDir.z)), vec2(0.0, -1.0)));
  float h = smoothstep(0.2, -0.01, y);
  vec3 col = mix(zenith, mid, smoothstep(0.85, 0.15, y));
  col = mix(col, hor, h * h * (0.15 + 0.85 * pow(toward, 4.0)) * (0.5 + 0.4 * uGlow));
  col += vec3(0.9, 0.5, 0.2) * exp(-y * 7.0) * step(0.0, y) * 0.10 * pow(toward, 2.0);
  // hot core just above the horizon
  float core = exp(-pow(y * 22.0, 2.0)) * pow(toward, 14.0);
  col += vec3(1.0, 0.78, 0.45) * core * (0.45 + 0.5 * uGlow);
  if (y < -0.02) col = mix(col, vec3(0.03, 0.02, 0.02), smoothstep(-0.02, -0.12, y));
  gl_FragColor = vec4(col, 1.0);
}`;

const starVert = /* glsl */ `
attribute float aSize;
attribute float aPhase;
uniform float uTime;
uniform float uWarp;
varying float vA;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float tw = 0.65 + 0.35 * sin(uTime * (1.5 + aPhase * 2.0) + aPhase * 30.0);
  vA = tw;
  gl_PointSize = aSize * (1.0 + uWarp * 2.5) * (300.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const starFrag = /* glsl */ `
varying float vA;
uniform float uFade;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float a = smoothstep(0.5, 0.0, d);
  a = a * a;
  gl_FragColor = vec4(vec3(1.0, 0.96, 0.88) * a * vA * uFade, a * vA * uFade);
}`;

const emberVert = /* glsl */ `
attribute float aSize;
attribute vec3 aColor;
varying vec3 vC;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vC = aColor;
  gl_PointSize = aSize * (260.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const emberFrag = /* glsl */ `
varying vec3 vC;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(vC * a * 1.4, a);
}`;

const N_STARS = 4200;
const N_CITY = 3600;
const N_EMBERS = 520;

const Scene: React.FC<{ t: number; local: number; look: RoofLook; cam: Cam; embers: number; rudo: THREE.Texture }> = ({ t, local, look, cam, embers, rudo }) => {
  const { camera } = useThree();

  const sky = useMemo(
    () => new THREE.ShaderMaterial({ vertexShader: skyVert, fragmentShader: skyFrag, side: THREE.BackSide, depthWrite: false, uniforms: { uSunrise: { value: 0 }, uGlow: { value: 1 } } }),
    [],
  );
  const starMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: starVert,
        fragmentShader: starFrag,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uWarp: { value: 0 }, uFade: { value: 1 } },
      }),
    [],
  );
  const stars = useMemo(() => {
    const r = rng(11);
    const pos = new Float32Array(N_STARS * 3);
    const size = new Float32Array(N_STARS);
    const ph = new Float32Array(N_STARS);
    for (let i = 0; i < N_STARS; i++) {
      // a shell plus a deep field the warp travels through
      const deep = i > N_STARS * 0.55;
      const u = r() * 2 - 1;
      const th = r() * Math.PI * 2;
      const rad = deep ? 60 + r() * 380 : 420;
      const y = deep ? u : Math.abs(u) * 0.98 + 0.02;
      const s = Math.sqrt(1 - y * y);
      pos[i * 3] = Math.cos(th) * s * rad;
      pos[i * 3 + 1] = y * rad + (deep ? 40 : 0);
      pos[i * 3 + 2] = Math.sin(th) * s * rad;
      size[i] = (deep ? 0.6 : 1) * (r() < 0.04 ? 3.2 : 0.7 + r() * 1.3);
      ph[i] = r();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    g.setAttribute("aPhase", new THREE.BufferAttribute(ph, 1));
    return g;
  }, []);

  const city = useMemo(() => {
    const r = rng(23);
    const pos = new Float32Array(N_CITY * 3);
    const col = new Float32Array(N_CITY * 3);
    const size = new Float32Array(N_CITY);
    for (let i = 0; i < N_CITY; i++) {
      // a street grid: snap one axis to avenues
      const gx = r() < 0.5;
      const a = (Math.floor(r() * 60) - 30) * 9;
      const b = (r() - 0.5) * 560;
      const x = gx ? a + (r() - 0.5) * 1.5 : b;
      const z = -40 - Math.abs(gx ? b : a) * 0.9 - r() * 30;
      pos[i * 3] = x;
      pos[i * 3 + 1] = -38 - r() * 2;
      pos[i * 3 + 2] = z;
      const warm = r();
      col[i * 3] = 1.0;
      col[i * 3 + 1] = 0.55 + warm * 0.3;
      col[i * 3 + 2] = 0.2 + warm * 0.25;
      size[i] = 0.6 + r() * 1.4;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    return g;
  }, []);
  const glowMat = useMemo(
    () => new THREE.ShaderMaterial({ vertexShader: emberVert, fragmentShader: emberFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    [],
  );

  const emberSeed = useMemo(() => {
    const r = rng(31);
    return Array.from({ length: N_EMBERS }, () => ({
      x: (r() - 0.5) * 40,
      z: -2 - r() * 30,
      life: 2.5 + r() * 3.5,
      off: r() * 10,
      vy: 1.2 + r() * 2.6,
      sw: 0.5 + r() * 1.5,
      ph: r() * 6.28,
      s: 0.35 + r() * 0.9,
      hot: r(),
    }));
  }, []);
  const emberGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N_EMBERS * 3), 3));
    g.setAttribute("aColor", new THREE.BufferAttribute(new Float32Array(N_EMBERS * 3), 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(new Float32Array(N_EMBERS), 1));
    return g;
  }, []);

  // per-frame updates
  sky.uniforms.uSunrise.value = look.sunrise;
  sky.uniforms.uGlow.value = look.glow;
  starMat.uniforms.uTime.value = t;
  starMat.uniforms.uWarp.value = look.warp;
  starMat.uniforms.uFade.value = 1 - look.sunrise * 0.75;
  {
    const p = emberGeo.attributes.position.array as Float32Array;
    const c = emberGeo.attributes.aColor.array as Float32Array;
    const s = emberGeo.attributes.aSize.array as Float32Array;
    emberSeed.forEach((e, i) => {
      const age = (local + e.off) % e.life;
      const k = age / e.life;
      p[i * 3] = e.x + Math.sin(age * e.sw + e.ph) * 1.2;
      p[i * 3 + 1] = -3 + age * e.vy;
      p[i * 3 + 2] = e.z + Math.cos(age * 0.7 + e.ph) * 0.8;
      const fade = Math.sin(Math.PI * Math.min(1, k)) * embers;
      c[i * 3] = 1.0 * fade;
      c[i * 3 + 1] = (0.35 + e.hot * 0.45) * fade;
      c[i * 3 + 2] = 0.08 * fade;
      s[i] = e.s * (1 - k * 0.5);
    });
    emberGeo.attributes.position.needsUpdate = true;
    emberGeo.attributes.aColor.needsUpdate = true;
    emberGeo.attributes.aSize.needsUpdate = true;
  }

  useLayoutEffect(() => {
    const c = camera as THREE.PerspectiveCamera;
    c.position.set(cam.pos[0], cam.pos[1], cam.pos[2]);
    c.lookAt(cam.look[0], cam.look[1], cam.look[2]);
    c.rotateZ(cam.roll);
    c.fov = cam.fov;
    c.near = 0.1;
    c.far = 2000;
    c.updateProjectionMatrix();
  });

  const aspect = (rudo.image as HTMLImageElement).width / (rudo.image as HTMLImageElement).height;
  const rh = 2.15;
  return (
    <>
      <mesh material={sky}>
        <sphereGeometry args={[900, 48, 32]} />
      </mesh>
      <points geometry={stars} material={starMat} />
      <points geometry={city} material={glowMat} />
      {/* roof slab + parapet */}
      <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[60, 60]} />
        <meshBasicMaterial color="#0b0908" />
      </mesh>
      <mesh position={[0, 0.45, -6]}>
        <boxGeometry args={[40, 0.9, 0.7]} />
        <meshBasicMaterial color="#070605" />
      </mesh>
      {/* rim of light on the parapet edge */}
      <mesh position={[0, 0.905, -6.36]}>
        <boxGeometry args={[40, 0.03, 0.02]} />
        <meshBasicMaterial color="#ffb45e" transparent opacity={0.55} />
      </mesh>
      {/* water tank + antenna silhouettes */}
      <group position={[-7.5, 0, -9]}>
        <mesh position={[0, 3.6, 0]}>
          <cylinderGeometry args={[1.6, 1.6, 3.2, 24]} />
          <meshBasicMaterial color="#060505" />
        </mesh>
        <mesh position={[0, 5.5, 0]}>
          <coneGeometry args={[1.75, 0.8, 24]} />
          <meshBasicMaterial color="#060505" />
        </mesh>
        {[-1.1, 1.1].map((x) => (
          <mesh key={x} position={[x, 1, 0]}>
            <boxGeometry args={[0.12, 2.2, 0.12]} />
            <meshBasicMaterial color="#060505" />
          </mesh>
        ))}
      </group>
      <group position={[8.5, 0, -12]}>
        <mesh position={[0, 4.5, 0]}>
          <boxGeometry args={[0.1, 9, 0.1]} />
          <meshBasicMaterial color="#060505" />
        </mesh>
        <mesh position={[0, 9.05, 0]}>
          <sphereGeometry args={[0.12, 12, 12]} />
          <meshBasicMaterial color={Math.sin(t * 3.2) > 0.3 ? "#ff3b2a" : "#3a0e0a"} />
        </mesh>
      </group>
      {/* RUDO on the ledge, silhouetted, with a gold rim */}
      {(
        <group position={[0, 0.9 + rh / 2 - 0.08, -6.15]}>
          <mesh position={[0, 0, -0.03]} scale={[1.035, 1.025, 1]}>
            <planeGeometry args={[rh * aspect, rh]} />
            <meshBasicMaterial map={rudo} color="#ffb860" transparent blending={THREE.AdditiveBlending} opacity={0.9} depthWrite={false} />
          </mesh>
          <mesh>
            <planeGeometry args={[rh * aspect, rh]} />
            <meshBasicMaterial map={rudo} color="#000000" transparent />
          </mesh>
        </group>
      )}
      <points geometry={emberGeo} material={glowMat} />
    </>
  );
};

export type Cam = { pos: [number, number, number]; look: [number, number, number]; fov: number; roll: number };

export const Rooftop: React.FC<{ t: number; local: number; look: RoofLook; cam: Cam; embers?: number }> = ({ t, local, look, cam, embers = 1 }) => {
  const rudo = useTexture(staticFile("images/rudo-cutout.png"));
  if (!rudo) return null;
  return (
    <ThreeCanvas width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }} gl={{ antialias: true, preserveDrawingBuffer: true }}>
      <Scene t={t} local={local} look={look} cam={cam} embers={embers} rudo={rudo} />
    </ThreeCanvas>
  );
};
