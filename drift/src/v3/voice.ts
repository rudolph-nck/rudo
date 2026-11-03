import vocal from "../../data/vocal.json";

/** The real lead vocal's loudness (dB) at song time t, smoothed a touch. Used to draw live waveforms. */
const V = vocal as unknown as { hop: number; db: number[] };
export const VOC = (t: number) => {
  const i = Math.round(t / V.hop);
  let s = 0, n = 0;
  for (let k = -3; k <= 3; k++) { const v = V.db[i + k]; if (v !== undefined) { s += v; n++; } }
  return n ? s / n : -60;
};
