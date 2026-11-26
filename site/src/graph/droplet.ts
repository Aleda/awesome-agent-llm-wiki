/**
 * Droplet outline and float motion (Task 11, spec §8.3). Pure functions
 * of time and a per-node integer seed, so nothing needs to be stored per
 * node and an off-screen node costs nothing.
 *
 * Outline: 8 control points on a circle whose radius is modulated by two
 * low-frequency harmonics (2 and 3 lobes) drifting at different speeds,
 * peak amplitude 0.03·r + 0.015·r = 0.045·r (< 0.06·r). The renderer joins
 * the points with a closed Catmull-Rom curve.
 * Drift: an independent slow sine per axis (period 6–12 s), amplitude
 * 1.4 px per axis, so |drift| ≤ 1.4·√2 ≈ 1.98 px.
 * Reduced motion: a perfect circle and zero drift.
 */

export const DROPLET_POINTS = 8;
const A2 = 0.03;
const A3 = 0.015;
const DRIFT_AMP = 1.4;
const TAU = Math.PI * 2;

/** Deterministic hash of `seed` and `salt` to [0, 1). */
export function hash01(seed: number, salt: number): number {
  let h = Math.imul((seed | 0) ^ Math.imul(salt + 1, 0x9e3779b1), 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/**
 * Write the 8 control points (x0, y0, x1, y1, …) relative to the centre
 * into `out` (length ≥ 16). Allocation-free variant used by the renderer.
 */
export function dropletInto(out: Float64Array, r: number, t: number, seed: number, reduced: boolean): void {
  const p2 = TAU * hash01(seed, 1);
  const p3 = TAU * hash01(seed, 2);
  const w2 = TAU / (6.5 + 3 * hash01(seed, 3));
  const w3 = TAU / (4.5 + 2.5 * hash01(seed, 4));
  const rot = TAU * hash01(seed, 5);
  for (let i = 0; i < DROPLET_POINTS; i++) {
    const a = rot + (i * TAU) / DROPLET_POINTS;
    const rr = reduced ? r : r * (1 + A2 * Math.sin(2 * a + w2 * t + p2) + A3 * Math.sin(3 * a - w3 * t + p3));
    out[2 * i] = rr * Math.cos(a);
    out[2 * i + 1] = rr * Math.sin(a);
  }
}

export function dropletPoints(r: number, t: number, seed: number, reduced: boolean): [number, number][] {
  const buf = new Float64Array(DROPLET_POINTS * 2);
  dropletInto(buf, r, t, seed, reduced);
  const pts: [number, number][] = [];
  for (let i = 0; i < DROPLET_POINTS; i++) pts.push([buf[2 * i], buf[2 * i + 1]]);
  return pts;
}

/** Write the screen-px float offset at time `t` (seconds) into `out[off]`, `out[off + 1]`. Allocation-free variant used by the renderer. */
export function driftInto(out: Float64Array, off: number, t: number, seed: number, reduced: boolean): void {
  if (reduced) {
    out[off] = 0;
    out[off + 1] = 0;
    return;
  }
  const px = 6 + 6 * hash01(seed, 6);
  const py = 6 + 6 * hash01(seed, 7);
  out[off] = DRIFT_AMP * Math.sin((TAU * t) / px + TAU * hash01(seed, 8));
  out[off + 1] = DRIFT_AMP * Math.sin((TAU * t) / py + TAU * hash01(seed, 9));
}

/** Screen-px float offset at time `t` (seconds). */
export function drift(t: number, seed: number, reduced: boolean): [number, number] {
  if (reduced) return [0, 0];
  const buf = new Float64Array(2);
  driftInto(buf, 0, t, seed, reduced);
  return [buf[0], buf[1]];
}
