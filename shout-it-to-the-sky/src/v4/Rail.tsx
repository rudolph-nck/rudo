import React, { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { Font } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { Line, kickEnv } from "../data";
import { clamp01, cubicOut } from "../utils/ease";
import { rng } from "../utils/random";

/**
 * Kinetic rails (after the reference's "we lit the fuse"): a section's lines are written along
 * one continuous cable in 3D. A spark runs down the cable and lights each letter on its sung
 * time; the camera chases the spark, so the words swing past in perspective.
 */
export const INK = new THREE.Color("#efede9");
export const STONE = new THREE.Color("#c4b6a2");
export const GHOST = new THREE.Color("#3a3935");

type Glyph = { ch: string; s: number; w: number; litT: number; word: number; line: number; last: boolean; geo: THREE.BufferGeometry };
export type Rail = {
  curve: THREE.CatmullRomCurve3;
  length: number;
  glyphs: Glyph[];
  /** arc-length position of the spark at time t */
  head: (t: number) => number;
  lines: Line[];
  size: number;
  lineSpan: { s0: number; s1: number; start: number; end: number }[];
};

const glyphCache = new Map<string, { geo: THREE.BufferGeometry; adv: number }>();
const glyph = (font: Font, ch: string, size: number) => {
  const key = `${(font as unknown as { data: { familyName: string } }).data.familyName}|${ch}|${size}`;
  let g = glyphCache.get(key);
  if (!g) {
    const geo = new TextGeometry(ch, { font, size, depth: size * 0.12, curveSegments: 6, bevelEnabled: false });
    const d = (font as unknown as { data: { glyphs: Record<string, { ha: number }>; resolution: number } }).data;
    g = { geo, adv: ((d.glyphs[ch]?.ha ?? 500) / d.resolution) * size };
    glyphCache.set(key, g);
  }
  return g;
};

/**
 * Build a rail for a run of lines. The path wanders through space (seeded), each line taking
 * the next stretch with a gap between lines that the spark crosses between vocals.
 */
export const buildRail = (lines: Line[], font: Font, opts: { size?: number; seed?: number; sway?: number; gap?: number; start?: THREE.Vector3 } = {}) => {
  const size = opts.size ?? 0.16;
  const gap = opts.gap ?? size * 6;
  const sway = opts.sway ?? 1;
  // lay glyphs out along a straight arc-length axis first
  const glyphs: Glyph[] = [];
  const lineSpan: Rail["lineSpan"] = [];
  let s = size * 4;
  lines.forEach((l, li) => {
    const s0 = s;
    l.words.forEach((w, wi) => {
      const word = w.w.toUpperCase();
      const dur = Math.max(0.1, (w.e - w.s) * 0.85);
      [...word].forEach((ch, k) => {
        const g = glyph(font, ch, size);
        glyphs.push({ ch, s, w: g.adv, litT: w.s + (dur * k) / word.length, word: wi, line: li, last: wi === l.words.length - 1, geo: g.geo });
        s += g.adv * 0.98;
      });
      s += size * 0.32;
    });
    lineSpan.push({ s0, s1: s, start: l.start, end: l.end });
    s += gap;
  });
  const total = s + size * 4;
  // a wandering path whose arc length ~= total: sample a seeded 3D wander, then rescale
  const r = rng(opts.seed ?? 7);
  const pts: THREE.Vector3[] = [];
  let p = opts.start?.clone() ?? new THREE.Vector3(0, 0, 0);
  let yaw = 0, pitch = 0;
  const step = size * 5;
  const n = Math.ceil((total * 1.08) / step) + 2;
  for (let i = 0; i < n; i++) {
    pts.push(p.clone());
    yaw += (r() - 0.5) * 0.55 * sway;
    yaw *= 0.92;
    pitch += (r() - 0.5) * 0.3 * sway;
    pitch *= 0.85;
    p = p.clone().add(new THREE.Vector3(Math.cos(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.sin(yaw) * Math.cos(pitch)).multiplyScalar(step));
  }
  const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
  const length = curve.getLength();
  const times: number[] = [], arcs: number[] = [];
  glyphs.forEach((g) => {
    times.push(g.litT);
    arcs.push(g.s + g.w * 0.5);
  });
  const head = (t: number) => {
    if (t <= times[0]) return Math.max(0, arcs[0] - size * 3 * clamp01((times[0] - t) / 0.6) - size * 0.5);
    for (let i = 0; i < times.length - 1; i++) {
      if (t < times[i + 1]) {
        const k = clamp01((t - times[i]) / Math.max(1e-3, times[i + 1] - times[i]));
        // within a word the spark keeps pace; across a gap it eases over
        return arcs[i] + (arcs[i + 1] - arcs[i]) * (arcs[i + 1] - arcs[i] > size * 2 ? cubicOut(k) : k);
      }
    }
    return Math.min(length, arcs[arcs.length - 1] + (t - times[times.length - 1]) * size * 2);
  };
  return { curve, length, glyphs, head, lines, size, lineSpan } as Rail;
};

/** Point + frame on the rail at arc length s (text up = world-up projected). */
export const frameAt = (rail: Rail, s: number) => {
  const u = clamp01(s / rail.length);
  const pos = rail.curve.getPointAt(u);
  const tan = rail.curve.getTangentAt(u).normalize();
  const up = new THREE.Vector3(0, 1, 0).addScaledVector(tan, -tan.y).normalize();
  const nrm = new THREE.Vector3().crossVectors(tan, up).normalize();
  return { pos, tan, up, nrm };
};

/** Camera that chases the spark: behind and beside it, looking just ahead. */
export const chaseCam = (rail: Rail, t: number, o: { dist?: number; side?: number; lift?: number; lead?: number; drop?: number } = {}) => {
  const dist = o.dist ?? 2.1, side = o.side ?? 1, lift = o.lift ?? 0.1, lead = o.lead ?? 0.1, drop = o.drop ?? 0.0;
  const sNow = rail.head(t);
  const sLag = rail.head(t - 0.25);
  const f = frameAt(rail, (sNow * 0.6 + sLag * 0.4));
  const ahead = frameAt(rail, sNow + lead);
  const pos = f.pos.clone().addScaledVector(f.nrm, dist * side).addScaledVector(f.tan, -dist * 0.38).addScaledVector(f.up, lift + 0.12);
  const look = ahead.pos.clone().addScaledVector(ahead.up, -drop + rail.size * 0.5);
  return { pos, look, up: new THREE.Vector3(0, 1, 0) };
};

// ---------------------------------------------------------------------------------------------
const glowTexture = (() => {
  let tex: THREE.Texture | null = null;
  return () => {
    if (tex) return tex;
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const x = c.getContext("2d")!;
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.15, "rgba(255,244,228,0.8)");
    g.addColorStop(0.45, "rgba(255,226,190,0.18)");
    g.addColorStop(1, "rgba(255,220,180,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 128);
    tex = new THREE.CanvasTexture(c);
    return tex;
  };
})();

const braidMat = () =>
  new THREE.ShaderMaterial({
    uniforms: { uHead: { value: 0 }, uLen: { value: 1 }, uKey: { value: new THREE.Vector3(0.3, 1, 0.5).normalize() } },
    vertexShader: `varying vec2 vUv; varying vec3 vN; void main(){ vUv=uv; vN=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
    fragmentShader: `uniform float uHead; uniform float uLen; uniform vec3 uKey; varying vec2 vUv; varying vec3 vN;
      void main(){
        float s = vUv.x * uLen;
        float braid = abs(fract(s * 38.0 + vUv.y * 6.0) - 0.5) * 2.0;
        float braid2 = abs(fract(s * 38.0 - vUv.y * 6.0) - 0.5) * 2.0;
        float lines = smoothstep(0.55, 0.85, max(braid, braid2));
        float L = 0.35 + 0.65 * max(0.0, dot(normalize(vN), uKey));
        float burnt = step(s, uHead);
        float near = exp(-max(0.0, uHead - s) * 14.0) * burnt;
        vec3 base = mix(vec3(0.08), vec3(0.62, 0.61, 0.58), lines) * L;
        vec3 col = mix(base, base * 0.35, burnt) + vec3(1.0, 0.93, 0.84) * near * 1.6;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });

/** The cable, its letters, and the spark. Optionally drives the camera. */
export const RailView: React.FC<{
  rail: Rail;
  t: number;
  drive?: boolean;
  cam?: Parameters<typeof chaseCam>[2];
  fade?: number;
  showCable?: boolean;
  accent?: (lineIdx: number, wordIdx: number) => THREE.Color | null;
}> = ({ rail, t, drive = true, cam, fade = 1.6, showCable = true, accent }) => {
  const { camera } = useThree();
  const mats = useMemo(
    () => ({
      ghost: new THREE.MeshBasicMaterial({ color: GHOST }),
      lit: new THREE.MeshBasicMaterial({ color: INK }),
      stone: new THREE.MeshBasicMaterial({ color: STONE }),
      hot: new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffffff") }),
      glow: new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }),
      halo: new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.22 }),
      braid: braidMat(),
      spark: new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    }),
    [],
  );
  const tube = useMemo(() => {
    // the cable runs just under the baseline
    const pts: THREE.Vector3[] = [];
    const N = Math.ceil(rail.length / (rail.size * 0.5));
    for (let i = 0; i <= N; i++) {
      const f = frameAt(rail, (i / N) * rail.length);
      pts.push(f.pos.clone().addScaledVector(f.up, -rail.size * 0.28));
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), N * 2, rail.size * 0.09, 10, false);
  }, [rail]);
  const sparkGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(90 * 6), 3));
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(90 * 6), 3));
    return g;
  }, []);
  const placed = useMemo(
    () =>
      rail.glyphs.map((g) => {
        const f = frameAt(rail, g.s);
        const m = new THREE.Matrix4().makeBasis(f.tan, f.up, f.nrm);
        const q = new THREE.Quaternion().setFromRotationMatrix(m);
        return { pos: f.pos, q };
      }),
    [rail],
  );

  const acCache = useMemo(() => new Map<string, THREE.MeshBasicMaterial>(), []);
  const acMat = (c: THREE.Color) => {
    const k = c.getHexString();
    if (!acCache.has(k)) acCache.set(k, new THREE.MeshBasicMaterial({ color: c }));
    return acCache.get(k)!;
  };
  const head = rail.head(t);
  const hf = frameAt(rail, head);
  const sparkPos = hf.pos.clone().addScaledVector(hf.up, -rail.size * 0.28);

  useLayoutEffect(() => {
    if (!drive) return;
    const c = chaseCam(rail, t, cam);
    const pc = camera as THREE.PerspectiveCamera;
    pc.position.copy(c.pos);
    pc.up.copy(c.up);
    pc.lookAt(c.look);
    pc.fov = 42;
    pc.near = 0.02;
    pc.far = 400;
    pc.updateProjectionMatrix();
  });

  // spark streaks: spawned at the head over the last half second, falling away
  const P = sparkGeo.attributes.position.array as Float32Array;
  const C = sparkGeo.attributes.color.array as Float32Array;
  const kick = kickEnv(t, 0.12);
  for (let i = 0; i < 90; i++) {
    const t0 = Math.floor(t * 180 - i) / 180;
    const age = t - t0;
    const r = rng(Math.floor(t0 * 180) + 11);
    const s0 = rail.head(t0);
    const f0 = frameAt(rail, s0);
    const base = f0.pos.clone().addScaledVector(f0.up, -rail.size * 0.28);
    const v = f0.tan.clone().multiplyScalar(-0.4 - r() * 0.8).addScaledVector(f0.up, 0.2 + r() * 1.4).addScaledVector(f0.nrm, (r() - 0.5) * 1.6).multiplyScalar(0.5 + kick * 0.8);
    const life = 0.25 + r() * 0.3;
    const k = age / life;
    const a = k < 1 && t > rail.glyphs[0].litT - 0.6 && head < rail.length - rail.size ? (1 - k) ** 2 : 0;
    const p1 = base.clone().addScaledVector(v, age).add(new THREE.Vector3(0, -2.2 * age * age, 0));
    const p0 = p1.clone().addScaledVector(v, -0.03);
    P.set([p0.x, p0.y, p0.z, p1.x, p1.y, p1.z], i * 6);
    C.set([a, a * 0.92, a * 0.8, a * 0.4, a * 0.3, a * 0.2], i * 6);
  }
  sparkGeo.attributes.position.needsUpdate = true;
  sparkGeo.attributes.color.needsUpdate = true;
  mats.braid.uniforms.uHead.value = head;
  mats.braid.uniforms.uLen.value = rail.length;

  return (
    <>
      {showCable ? <mesh geometry={tube} material={mats.braid} /> : null}
      {rail.glyphs.map((g, i) => {
        const sp = rail.lineSpan[g.line];
        if (t < sp.start - 0.05) return null;
        const nextStart = rail.lineSpan[g.line + 1]?.start ?? Infinity;
        const old = t - Math.max(sp.end, Math.min(nextStart, sp.end + fade));
        if (old > 0.6) return null;
        const lit = t >= g.litT;
        const hot = lit && t - g.litT < 0.12;
        const ac = accent?.(g.line, g.word);
        const mat = !lit ? mats.ghost : hot ? mats.hot : ac ? acMat(ac) : g.last ? mats.stone : mats.lit;
        const pop = lit ? 1 + 0.25 * Math.exp(-(t - g.litT) / 0.06) : 1;
        const fadeOut = old > 0 ? 1 - old / 0.6 : 1;
        return (
          <group key={i} position={placed[i].pos} quaternion={placed[i].q}>
            <mesh geometry={g.geo} material={mat} scale={[pop * fadeOut, pop * fadeOut, 1]} />
          </group>
        );
      })}
      {/* spark */}
      {head > 0 && head < rail.length - rail.size && t > rail.glyphs[0].litT - 0.6 ? (
        <>
          <sprite material={mats.glow} position={sparkPos} scale={[rail.size * (1.5 + kick * 0.9), rail.size * (1.5 + kick * 0.9), 1]} />
          <sprite material={mats.halo} position={sparkPos} scale={[rail.size * 4.5, rail.size * 4.5, 1]} />
        </>
      ) : null}
      <lineSegments geometry={sparkGeo} material={mats.spark} frustumCulled={false} />
    </>
  );
};
