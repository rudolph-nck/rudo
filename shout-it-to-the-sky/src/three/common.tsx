import React, { useMemo } from "react";
import * as THREE from "three";
import { Line, nextLineStart } from "../data";
import { clamp01 } from "../utils/ease";
import { rng } from "../utils/random";

/** When a line leaves (or bursts). */
export const outOf = (l: Line, hold = 1.3) => Math.max(l.end, Math.min(nextLineStart(l) - 0.06, l.end + hold));

// ---------------------------------------------------------------------------------------------
/** Orients its children (local +y up, +z toward the viewer) to face a point. */
export const Panel: React.FC<{ at: THREE.Vector3; face: THREE.Vector3; up: THREE.Vector3; tilt?: [number, number, number]; children: React.ReactNode }> = ({ at, face, up, tilt = [0, 0, 0], children }) => {
  const o = new THREE.Object3D();
  o.position.copy(at);
  o.up.copy(up);
  o.lookAt(face);
  o.rotateX(tilt[0]);
  o.rotateY(tilt[1]);
  o.rotateZ(tilt[2]);
  return (
    <group position={at} quaternion={o.quaternion}>
      {children}
    </group>
  );
};

/** Embers bursting from a point cloud of positions (when a chorus line lets go). */
export const Burst: React.FC<{ t: number; at: number; center: THREE.Vector3; up: THREE.Vector3; spread: number; mat: THREE.ShaderMaterial; seed: number }> = ({ t, at, center, up, spread, mat, seed }) => {
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
    Cc.set([(1.0 + e.hot * 0.6) * f, (1.0 + e.hot * 0.6) * f, (1.05 + e.hot * 0.6) * f], i * 3);
    S[i] = e.s * (1 - k * 0.4);
  });
  geo.attributes.position.needsUpdate = true;
  geo.attributes.aColor.needsUpdate = true;
  geo.attributes.aSize.needsUpdate = true;
  return <points geometry={geo} material={mat} frustumCulled={false} />;
};


// ---------------------------------------------------------------------------------------------
export const skyMat = () =>
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { uGlow: { value: 1 }, uFade: { value: 1 }, uUp: { value: new THREE.Vector3(0, 0, 1) }, uFwd: { value: new THREE.Vector3(0, 1, 0) }, uSun: { value: 0 } },
    vertexShader: `varying vec3 vDir; void main(){ vDir=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
    fragmentShader: `varying vec3 vDir; uniform float uGlow; uniform float uFade; uniform vec3 uUp; uniform vec3 uFwd; uniform float uSun;
      void main(){
        float up=dot(vDir,uUp);
        vec3 hz=normalize(vDir-uUp*up+1e-5);
        float toward=max(0.0,dot(hz,uFwd));
        // night: graphite; sunrise: pale silver
        vec3 zen=mix(vec3(0.018,0.019,0.022),vec3(0.42,0.43,0.45),uSun);
        vec3 mid=mix(vec3(0.05,0.05,0.055),vec3(0.62,0.62,0.63),uSun);
        vec3 hor=mix(vec3(0.72,0.72,0.74),vec3(0.98,0.97,0.95),uSun);
        vec3 c=mix(mid,zen,smoothstep(0.0,0.7,up));
        float h=smoothstep(0.22,-0.01,up);
        c=mix(c,hor*0.8,h*h*(0.1+0.9*pow(toward,5.0))*(0.45+0.3*uGlow));
        c+=vec3(0.95,0.95,0.97)*exp(-pow(up*30.0,2.0))*pow(toward,18.0)*(0.3+0.35*uGlow+0.8*uSun);
        if(up<-0.02) c=mix(c,vec3(0.02),smoothstep(-0.02,-0.15,up));
        gl_FragColor=vec4(c*uFade,1.0);
      }`,
  });
export const pointsMat = (sizeScale = 300) =>
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

export const pointsGeo = (n: number, fill: (i: number, r: () => number) => { p: [number, number, number]; c: [number, number, number]; s: number }, seed: number) => {
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

