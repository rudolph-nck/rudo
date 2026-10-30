import React, { useMemo } from "react";
import * as THREE from "three";
import { rng } from "../utils/random";

/**
 * Glowing points (stars, neon letters, dust). Each point has a seed; `ignite` 0..1 lights them in
 * seed order, `gain` scales brightness (drive it with the voice), `twinkle` uses `time`.
 * Additive, untonemapped: the bright ones bloom.
 */
export const pointsMat = () =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    uniforms: {
      uColor: { value: new THREE.Color("#fff4e6") },
      uSize: { value: 6 },
      uIgnite: { value: 1 },
      uGain: { value: 1 },
      uTime: { value: 0 },
      uTwinkle: { value: 0.3 },
      uScale: { value: 1920 / 2 },
    },
    vertexShader: /* glsl */ `
      attribute float seed;
      attribute float bright;
      uniform float uSize, uIgnite, uTime, uScale, uTwinkle;
      varying float vA;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float on = smoothstep(seed - 0.04, seed + 0.001, uIgnite);
        float tw = 1.0 - uTwinkle + uTwinkle * (0.5 + 0.5 * sin(uTime * (1.5 + seed * 4.0) + seed * 40.0));
        vA = on * tw * bright;
        // freshly ignited points flare, then settle
        float fresh = clamp(1.0 - (uIgnite - seed) * 6.0, 0.0, 1.0) * on;
        vA *= 1.0 + fresh * 2.5;
        gl_PointSize = min(9.0, uSize * (0.55 + bright) * (1.0 + fresh * 0.8) * uScale / -mv.z * 0.01);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uGain;
      varying float vA;
      void main() {
        vec2 d = gl_PointCoord - 0.5;
        float r = length(d) * 2.0;
        float core = exp(-r * r * 18.0);
        float halo = exp(-r * r * 4.0) * 0.18;
        float a = (core + halo) * vA * uGain;
        if (a < 0.002) discard;
        gl_FragColor = vec4(uColor * a * 2.2, a);
      }`,
  });

export const usePointsGeo = (pos: Float32Array, seeds: Float32Array, bright?: Float32Array) =>
  useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("seed", new THREE.BufferAttribute(seeds, 1));
    g.setAttribute("bright", new THREE.BufferAttribute(bright ?? new Float32Array(seeds.length).fill(1), 1));
    return g;
  }, [pos, seeds, bright]);

export const Glow: React.FC<{
  geo: THREE.BufferGeometry; size?: number; ignite?: number; gain?: number; time?: number; color?: string; twinkle?: number;
  position?: [number, number, number]; rotation?: [number, number, number]; scale?: number;
}> = ({ geo, size = 6, ignite = 1, gain = 1, time = 0, color = "#fff4e6", twinkle = 0.3, position, rotation, scale }) => {
  const mat = useMemo(() => pointsMat(), []);
  mat.uniforms.uSize.value = size;
  mat.uniforms.uIgnite.value = ignite;
  mat.uniforms.uGain.value = gain;
  mat.uniforms.uTime.value = time;
  mat.uniforms.uTwinkle.value = twinkle;
  (mat.uniforms.uColor.value as THREE.Color).set(color);
  return <points geometry={geo} material={mat} position={position} rotation={rotation} scale={scale} frustumCulled={false} />;
};

/** A deep starfield shell: n stars in a box, brightness power-law (few bright, many faint). */
export const useStarfield = (n: number, seed: number, box: [number, number, number], center: [number, number, number] = [0, 0, -20]) =>
  useMemo(() => {
    const r = rng(seed);
    const pos = new Float32Array(n * 3), seeds = new Float32Array(n), bright = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = center[0] + (r() - 0.5) * box[0];
      pos[i * 3 + 1] = center[1] + (r() - 0.5) * box[1];
      pos[i * 3 + 2] = center[2] + (r() - 0.5) * box[2];
      seeds[i] = r();
      bright[i] = Math.pow(r(), 6) * 2.2 + 0.08;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("seed", new THREE.BufferAttribute(seeds, 1));
    g.setAttribute("bright", new THREE.BufferAttribute(bright, 1));
    return g;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, seed, box.join(), center.join()]);
