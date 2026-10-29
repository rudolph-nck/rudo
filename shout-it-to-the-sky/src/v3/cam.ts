import * as THREE from "three";

export type V = [number, number, number];
export type CamKey = { t: number; p: V; l: V; up?: V; fov?: number };

/** Time-domain cubic Hermite through camera keys (C1-smooth), returns pos/look/up/fov at t. */
export const makeCam = (keys: CamKey[]) => {
  const K = [...keys].sort((a, b) => a.t - b.t);
  const herm = (t: number, get: (k: CamKey) => V) => {
    const v = (k: CamKey) => new THREE.Vector3(...get(k));
    if (t <= K[0].t) return v(K[0]);
    if (t >= K[K.length - 1].t) return v(K[K.length - 1]);
    let i = 0;
    while (K[i + 1].t < t) i++;
    const k0 = K[Math.max(0, i - 1)], k1 = K[i], k2 = K[i + 1], k3 = K[Math.min(K.length - 1, i + 2)];
    const dt = k2.t - k1.t, s = (t - k1.t) / dt;
    const m1 = v(k2).sub(v(k0)).multiplyScalar((dt / Math.max(1e-3, k2.t - k0.t)) * 0.85);
    const m2 = v(k3).sub(v(k1)).multiplyScalar((dt / Math.max(1e-3, k3.t - k1.t)) * 0.85);
    const h00 = 2 * s ** 3 - 3 * s ** 2 + 1, h10 = s ** 3 - 2 * s ** 2 + s, h01 = -2 * s ** 3 + 3 * s ** 2, h11 = s ** 3 - s ** 2;
    return v(k1).multiplyScalar(h00).add(m1.multiplyScalar(h10)).add(v(k2).multiplyScalar(h01)).add(m2.multiplyScalar(h11));
  };
  return (t: number) => ({
    pos: herm(t, (k) => k.p),
    look: herm(t, (k) => k.l),
    up: herm(t, (k) => k.up ?? [0, 1, 0]).normalize(),
    fov: herm(t, (k) => [k.fov ?? 34, 0, 0]).x,
  });
};

export const applyCam = (camera: THREE.Camera, c: ReturnType<ReturnType<typeof makeCam>>) => {
  const cam = camera as THREE.PerspectiveCamera;
  cam.position.copy(c.pos);
  cam.up.copy(c.up);
  cam.lookAt(c.look);
  cam.fov = c.fov;
  cam.near = 0.02;
  cam.far = 800;
  cam.updateProjectionMatrix();
};
