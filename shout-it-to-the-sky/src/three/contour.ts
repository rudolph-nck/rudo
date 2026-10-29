import * as THREE from "three";

/**
 * The reference reel's look: a mesh drawn entirely as fine contour lines that wrap the form
 * (iso-lines of height, warped by the surface), on black. Stroke width follows a key + rim
 * light, so form reads through line weight alone. Strokes are anti-aliased with fwidth and
 * keep a constant on-screen pitch, so they stay razor sharp at any distance.
 */
export const contourMat = (opts: { ink?: string; pitch?: number; warp?: number; axis?: [number, number, number] } = {}) =>
  new THREE.ShaderMaterial({
    uniforms: {
      uInk: { value: new THREE.Color(opts.ink ?? "#ecebe8") },
      uKey: { value: new THREE.Vector3(0.35, 0.9, 0.45).normalize() },
      uRim: { value: 0.9 },
      uPitch: { value: opts.pitch ?? 7.0 }, // target stroke spacing in pixels
      uWarp: { value: opts.warp ?? 0.6 },
      uLevel: { value: 1 },
      uRes: { value: new THREE.Vector2(1080, 1920) },
      uFlow: { value: 0 },
      uAxis: { value: new THREE.Vector3(...(opts.axis ?? [0, 1, 0])).normalize() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vW;
      varying vec3 vN;
      varying vec3 vObj;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        vObj = position;
        vN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uInk; uniform vec3 uKey; uniform float uRim; uniform float uPitch;
      uniform float uWarp; uniform float uLevel; uniform float uFlow; uniform vec3 uAxis;
      varying vec3 vW; varying vec3 vN; varying vec3 vObj;
      void main() {
        vec3 n = normalize(vN);
        if (!gl_FrontFacing) n = -n;
        vec3 v = normalize(cameraPosition - vW);
        float key = max(0.0, dot(n, uKey));
        float rim = pow(1.0 - max(0.0, dot(n, v)), 2.5);
        float I = clamp((0.08 + 0.95 * key + uRim * rim) * uLevel, 0.0, 1.0);
        // contour coordinate: height slices bent by the surface normal, like the reference
        float h = dot(vW, uAxis) + uWarp * (n.x * 0.06 + n.z * 0.04) + 0.012 * sin(vW.x * 23.0 + vW.z * 17.0) + uFlow;
        // keep the on-screen pitch constant: scale by how fast h changes per pixel
        float dh = max(fwidth(h), 1e-5);
        float lev = log2(dh * uPitch);
        float l0 = floor(lev);
        float fr = lev - l0;
        float w = clamp(I * 0.62, 0.04, 0.66);
        float c0 = h / exp2(l0), c1 = h / exp2(l0 + 1.0);
        float a0 = fwidth(c0), a1 = fwidth(c1);
        float s0 = 1.0 - smoothstep(w - a0, w + a0, abs(fract(c0) - 0.5) * 2.0);
        float s1 = 1.0 - smoothstep(w - a1, w + a1, abs(fract(c1) - 0.5) * 2.0);
        float ln = mix(s0, s1, smoothstep(0.0, 1.0, fr));
        vec3 col = uInk * ln * (0.55 + 0.6 * I);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
