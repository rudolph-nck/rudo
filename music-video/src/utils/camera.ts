/**
 * One camera model shared by the CSS-3D stage (<Stage3D/>) and the canvas
 * projection (particles, projected lines) so every layer sits in one space.
 *
 * World units are CSS px, y points DOWN, the camera looks toward −z.
 * Rotations in degrees:  rx > 0 looks down · ry > 0 looks left · rz rolls.
 */
export const W = 1920;
export const H = 1080;

export type Cam = { x: number; y: number; z: number; rx: number; ry: number; rz: number; fov: number };
export type V3 = [number, number, number];

export const focal = (fov: number) => H / 2 / Math.tan((fov * Math.PI) / 360);

/** Camera placed so the z=0 plane renders at 1:1 pixel scale. */
export const baseCam = (fov = 40, o: Partial<Cam> = {}): Cam => ({
  x: 0,
  y: 0,
  z: focal(fov),
  rx: 0,
  ry: 0,
  rz: 0,
  fov,
  ...o,
});

const D = Math.PI / 180;

/** World → camera space (matches the CSS transform chain in Stage3D). */
export const toCam = (p: V3, c: Cam): V3 => {
  let x = p[0] - c.x,
    y = p[1] - c.y,
    z = p[2] - c.z;
  // rotateY(-ry)
  let a = -c.ry * D,
    cs = Math.cos(a),
    sn = Math.sin(a);
  [x, z] = [cs * x + sn * z, -sn * x + cs * z];
  // rotateX(-rx)
  a = -c.rx * D;
  cs = Math.cos(a);
  sn = Math.sin(a);
  [y, z] = [cs * y - sn * z, sn * y + cs * z];
  // rotateZ(-rz)
  a = -c.rz * D;
  cs = Math.cos(a);
  sn = Math.sin(a);
  [x, y] = [cs * x - sn * y, sn * x + cs * y];
  return [x, y, z];
};

export type Projected = { x: number; y: number; s: number; depth: number; visible: boolean };

/** Project a world point to screen px. `s` = pixel scale at that depth. */
export const project = (p: V3, c: Cam, near = 20): Projected => {
  const [x, y, z] = toCam(p, c);
  const depth = -z;
  const P = focal(c.fov);
  if (depth < near) return { x: 0, y: 0, s: 0, depth, visible: false };
  const s = P / depth;
  return { x: W / 2 + x * s, y: H / 2 + y * s, s, depth, visible: true };
};

export const lerpCam = (a: Cam, b: Cam, t: number): Cam => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  z: a.z + (b.z - a.z) * t,
  rx: a.rx + (b.rx - a.rx) * t,
  ry: a.ry + (b.ry - a.ry) * t,
  rz: a.rz + (b.rz - a.rz) * t,
  fov: a.fov + (b.fov - a.fov) * t,
});

/**
 * Keyframed camera. keys: [frame, partial cam] — missing fields inherit from
 * the previous key. Each segment eased with the provided easing.
 */
export const camPath = (
  f: number,
  ks: Array<[number, Partial<Cam>, ((t: number) => number)?]>,
  base: Cam,
  ease: (t: number) => number,
): Cam => {
  const full: Array<[number, Cam, ((t: number) => number) | undefined]> = [];
  let prev = base;
  for (const [fr, p, e] of ks) {
    prev = { ...prev, ...p };
    full.push([fr, prev, e]);
  }
  if (f <= full[0][0]) return full[0][1];
  for (let i = 0; i < full.length - 1; i++) {
    const [f0, c0] = full[i];
    const [f1, c1, e] = full[i + 1];
    if (f <= f1) {
      const t = Math.min(1, Math.max(0, (f - f0) / Math.max(1e-6, f1 - f0)));
      return lerpCam(c0, c1, (e ?? ease)(t));
    }
  }
  return full[full.length - 1][1];
};
