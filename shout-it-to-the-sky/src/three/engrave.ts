import * as THREE from "three";

/**
 * Line-engraving look (the reference's etched 3D): a lit MeshStandardMaterial whose final colour
 * is re-drawn as parallel ink lines. Line thickness follows the lit luminance, so light reads as
 * thick bright strokes and shadow as thin ones. Lines are warped by the concrete texture so they
 * follow the knockdown relief, and fade to a flat tone where they would alias.
 */
export type EngraveOpts = {
  color?: string;
  ink: string;
  bg?: string;
  spacing: number;
  dir?: [number, number, number];
  warp?: number;
  gain?: number;
  map?: THREE.Texture;
  bump?: THREE.Texture;
  bumpScale?: number;
};

export const engrave = (o: EngraveOpts) => {
  const m = new THREE.MeshStandardMaterial({
    color: o.color ?? "#ffffff",
    map: o.map,
    bumpMap: o.bump,
    bumpScale: o.bumpScale ?? 1,
    roughness: 0.92,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const u = {
    uInk: { value: new THREE.Color(o.ink) },
    uBg: { value: new THREE.Color(o.bg ?? "#050505") },
    uSpacing: { value: o.spacing },
    uDir: { value: new THREE.Vector3(...(o.dir ?? [0.12, 1, 0.8])).normalize() },
    uWarp: { value: o.warp ?? 1.6 },
    uGain: { value: o.gain ?? 2.2 },
    uMix: { value: 1 },
  };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader =
      "varying vec3 vEngW;\n" + sh.vertexShader.replace("#include <project_vertex>", "#include <project_vertex>\n  vEngW = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    sh.fragmentShader =
      "varying vec3 vEngW;\nuniform vec3 uInk; uniform vec3 uBg; uniform float uSpacing; uniform vec3 uDir; uniform float uWarp; uniform float uGain; uniform float uMix;\n" +
      sh.fragmentShader.replace(
        "#include <opaque_fragment>",
        `{
          float L = clamp(dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722)) * uGain, 0.0, 1.15);
          // line spacing follows distance in octaves (blended), so strokes keep a steady
          // on-screen pitch: no moire far away, no fat bars up close
          float dist = length(vEngW - cameraPosition);
          float lev = clamp(log2(dist / 8.0), -6.0, 6.0);
          float l0 = floor(lev);
          float fr = lev - l0;
          float warp = 0.0;
          #ifdef USE_MAP
            warp = (texture2D(map, vMapUv).g - 0.45) * uWarp;
          #endif
          float w = clamp(L * 0.9, 0.0, 0.95);
          float base = dot(vEngW, uDir) / uSpacing;
          float c0 = base / exp2(l0) + warp;
          float c1 = base / exp2(l0 + 1.0) + warp;
          float a0 = fwidth(c0), a1 = fwidth(c1);
          float n0 = 1.0 - smoothstep(w - a0, w + a0, abs(fract(c0) - 0.5) * 2.0);
          float n1 = 1.0 - smoothstep(w - a1, w + a1, abs(fract(c1) - 0.5) * 2.0);
          n0 = mix(n0, w, smoothstep(0.3, 0.8, a0));
          n1 = mix(n1, w, smoothstep(0.3, 0.8, a1));
          float ln = mix(n0, n1, smoothstep(0.0, 1.0, fr));
          vec3 ink = uInk * (0.45 + 0.75 * L);
          outgoingLight = mix(outgoingLight, mix(uBg, ink, ln), uMix);
        }
        #include <opaque_fragment>`,
      );
  };
  m.customProgramCacheKey = () => "engrave-v3";
  return { m, u };
};

/** RUDO's photo as a line engraving: stroke width follows the photo's luminance. */
export const engravePhoto = (map: THREE.Texture, ink = "#efe6d8") =>
  new THREE.ShaderMaterial({
    transparent: true,
    uniforms: { uMap: { value: map }, uLevel: { value: 1 }, uInk: { value: new THREE.Color(ink) }, uDensity: { value: 210 }, uPhoto: { value: 0.18 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform sampler2D uMap; uniform float uLevel; uniform vec3 uInk; uniform float uDensity; uniform float uPhoto;
      varying vec2 vUv;
      void main(){
        vec4 t = texture2D(uMap, vUv);
        if (t.a < 0.4) discard;
        float L = dot(t.rgb, vec3(0.2126, 0.7152, 0.0722));
        L = clamp(pow(L, 0.75) * 1.9 * uLevel, 0.0, 1.0);
        // contour lines that bend with the form (luminance-warped), like an etching
        float c = (vUv.y + vUv.x * 0.22) * uDensity + L * 2.4;
        float aa = fwidth(c);
        float f = abs(fract(c) - 0.5) * 2.0;
        float w = clamp(L * 0.92, 0.0, 0.95);
        float ln = 1.0 - smoothstep(w - aa, w + aa, f);
        vec3 col = mix(vec3(0.015), uInk * (0.55 + 0.6 * L), ln);
        col = mix(col, t.rgb * uLevel, uPhoto);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
