/**
 * 2D camera for the homepage graph (Task 11, spec §8.2).
 *
 * Convention (the only one used anywhere in the graph code):
 *
 *     screen = (world - (cam.x, cam.y)) * cam.k
 *
 * Screen coordinates are CSS pixels relative to the canvas's top-left
 * corner; `(cam.x, cam.y)` is the world point drawn at that corner and
 * `cam.k` is CSS px per world unit. The viewport size is therefore not
 * part of the camera — only `fitNode` needs it, to centre a node.
 */
import type { GNode } from './build';
import { LEVEL_SCALE } from './lod';

export interface Camera {
  x: number;
  y: number;
  k: number;
}

/** Zoom limits: the whole 1000-radius topic ring fits a phone at `K_MIN`; `K_MAX` is well past L2. */
export const K_MIN = 0.1;
export const K_MAX = 6;

export function worldToScreen(c: Camera, p: [number, number]): [number, number] {
  return [(p[0] - c.x) * c.k, (p[1] - c.y) * c.k];
}

export function screenToWorld(c: Camera, p: [number, number]): [number, number] {
  return [p[0] / c.k + c.x, p[1] / c.k + c.y];
}

/** Multiply the zoom by `factor` (clamped to `[K_MIN, K_MAX]`) while the world point under `screen` stays under it. */
export function zoomAt(c: Camera, screen: [number, number], factor: number): Camera {
  const k = Math.min(K_MAX, Math.max(K_MIN, c.k * factor));
  const [wx, wy] = screenToWorld(c, screen);
  return { x: wx - screen[0] / k, y: wy - screen[1] / k, k };
}

const easeInOut = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * Camera at progress `t` (clamped to 0–1, cubic ease-in-out) between `from`
 * and `to`. Zoom is interpolated geometrically so every zoom step feels
 * the same size. The origin `(x, y)` moves along the straight line from
 * `from` to `to` at a rate tied to `1/k`: with this pairing the flight is
 * a pure zoom about the single screen point that `from` and `to` agree on,
 * so a zoom toward a node never swings sideways. With equal zooms it is a
 * plain eased pan.
 */
export function flyTo(from: Camera, to: Camera, t: number): Camera {
  if (t <= 0) return { ...from };
  if (t >= 1) return { ...to };
  const u = easeInOut(t);
  const k = from.k * (to.k / from.k) ** u;
  const span = 1 / from.k - 1 / to.k;
  const p = Math.abs(span) * Math.min(from.k, to.k) < 1e-9 ? u : (1 / from.k - 1 / k) / span;
  return { x: from.x + (to.x - from.x) * p, y: from.y + (to.y - from.y) * p, k };
}

/** Camera at `LEVEL_SCALE[level]` with `n` at the centre of a `view.w` × `view.h` viewport. */
export function fitNode(n: GNode, view: { w: number; h: number }, level: 0 | 1 | 2): Camera {
  const k = LEVEL_SCALE[level];
  return { x: n.x - view.w / (2 * k), y: n.y - view.h / (2 * k), k };
}
