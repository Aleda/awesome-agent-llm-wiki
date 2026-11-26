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
import { BAND, CARD_H, CARD_W, L1_AT, L2_AT, LEVEL_SCALE } from './lod';

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

/** Zoom range a framed view may use for each level, kept clear of the crossfade bands so `levelOf(k)` is still that level. */
export const LEVEL_RANGE: Record<0 | 1 | 2, [number, number]> = {
  0: [K_MIN, L1_AT * (1 - BAND)],
  1: [L1_AT * (1 + BAND), L2_AT * (1 - BAND)],
  2: [L2_AT * (1 + BAND), K_MAX],
};

/**
 * Screen-px room kept around a framed cluster for what is drawn in screen
 * space: at L1 a concept label (centred, below the dot) and a topic's
 * droplet + label; at L2 a source card (`CARD_W` × `CARD_H`, centred on the
 * node) plus a small gap.
 */
const FRAME_PAD: Record<1 | 2, { x: number; top: number; bottom: number }> = {
  1: { x: 110, top: 40, bottom: 72 },
  2: { x: CARD_W / 2 + 16, top: CARD_H / 2 + 16, bottom: CARD_H / 2 + 28 },
};

type XY = Pick<GNode, 'x' | 'y'>;

/** Bounding box of `pts` and the largest zoom that fits it (with `pad`) in `view`. */
function boxFit(pts: XY[], view: { w: number; h: number }, pad: { x: number; top: number; bottom: number }) {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const n of pts) {
    x0 = Math.min(x0, n.x);
    x1 = Math.max(x1, n.x);
    y0 = Math.min(y0, n.y);
    y1 = Math.max(y1, n.y);
  }
  const availW = Math.max(1, view.w - 2 * pad.x);
  const availH = Math.max(1, view.h - pad.top - pad.bottom);
  const fit = Math.min(x1 > x0 ? availW / (x1 - x0) : Infinity, y1 > y0 ? availH / (y1 - y0) : Infinity);
  return { x0, x1, y0, y1, fit };
}

/**
 * Camera for flying to `focus` at `level` in a `view.w` × `view.h` area
 * (same frame as `fitNode`): frames `focus` together with `cluster` (at
 * L1 a topic's part-of concepts, at L2 a concept's neighbouring sources).
 * The bounding box of their world positions gets `FRAME_PAD` screen-px
 * room for labels/cards; `k` is the largest zoom that fits, capped at
 * `LEVEL_SCALE[level]` and never below `LEVEL_RANGE[level][0]`, so the
 * view always lands on the requested level. Members that cannot share the
 * screen with `focus` even at that lowest zoom are dropped, farthest from
 * `focus` first; the view then uses the lowest zoom and leans toward the
 * dropped ones as far as `focus` and the kept members stay fully inside.
 * L0, or an empty cluster, is `fitNode`.
 */
export function frameCluster(focus: XY, cluster: XY[], view: { w: number; h: number }, level: 0 | 1 | 2): Camera {
  if (level === 0) return fitNode(focus as GNode, view, level);
  const pad = FRAME_PAD[level];
  const [lo, hi] = LEVEL_RANGE[level];
  const members = cluster
    .slice()
    .sort((a, b) => Math.hypot(a.x - focus.x, a.y - focus.y) - Math.hypot(b.x - focus.x, b.y - focus.y));
  const dropped: XY[] = [];
  let box = boxFit([focus, ...members], view, pad);
  while (members.length > 0 && box.fit < lo) {
    dropped.push(members.pop()!);
    box = boxFit([focus, ...members], view, pad);
  }
  if (members.length === 0 && dropped.length === 0) return fitNode(focus as GNode, view, level);
  if (dropped.length === 0) {
    const k = Math.min(hi, Math.max(lo, Math.min(box.fit, LEVEL_SCALE[level])));
    // Centre the padded box: its middle in screen px is at the area's middle.
    const cx = (box.x0 + box.x1) / 2;
    const cy = (box.y0 + box.y1) / 2 + (pad.bottom - pad.top) / (2 * k);
    return { x: cx - view.w / (2 * k), y: cy - view.h / (2 * k), k };
  }
  // Some members do not fit: zoom out as far as the level allows and lean
  // the view toward them (their centroid) as far as the kept points, with
  // their padding, stay inside — the dropped side shows as much as it can.
  const k = lo;
  const tx = dropped.reduce((a, n) => a + n.x, 0) / dropped.length;
  const ty = dropped.reduce((a, n) => a + n.y, 0) / dropped.length;
  const halfW = Math.max(0, view.w / 2 - pad.x) / k;
  const cxLo = box.x1 - halfW;
  const cxHi = box.x0 + halfW;
  const cyLo = box.y1 - Math.max(0, view.h / 2 - pad.bottom) / k;
  const cyHi = box.y0 + Math.max(0, view.h / 2 - pad.top) / k;
  const clamp = (v: number, a: number, b: number): number => (a > b ? (a + b) / 2 : Math.min(b, Math.max(a, v)));
  const cx = clamp(tx, cxLo, cxHi);
  const cy = clamp(ty, cyLo, cyHi);
  return { x: cx - view.w / (2 * k), y: cy - view.h / (2 * k), k };
}

/**
 * Screen-px margin kept around the topic ring in the initial view: a
 * topic droplet's minimum screen radius plus its label and "N 份素材" line
 * (labels are fixed screen px, so no world-unit margin works).
 */
export const RING_MARGIN_PX = 80;
/** Radius of the topic ring set by build.ts. */
export const TOPIC_RING = 1000;

/**
 * Initial L0 overview (Ruling R16): the whole topic ring fits in the
 * `view.w` × (`view.h` − `view.top`) area below the top bar, centred on
 * `centre` (the root) at screen `(w / 2, (top + h) / 2)`:
 * `k = min(LEVEL_SCALE[0], (min(w, h − top) / 2 − 80) / (1000 + maxTopicR))`,
 * clamped to `[K_MIN, K_MAX]`.
 */
export function initialCamera(
  view: { w: number; h: number; top: number },
  maxTopicR: number,
  centre: [number, number] = [0, 0],
): Camera {
  const availH = view.h - view.top;
  const fit = (Math.min(view.w, availH) / 2 - RING_MARGIN_PX) / (TOPIC_RING + Math.max(0, maxTopicR));
  const k = Math.min(K_MAX, Math.max(K_MIN, Math.min(LEVEL_SCALE[0], fit)));
  return { x: centre[0] - view.w / (2 * k), y: centre[1] - (view.top + view.h) / (2 * k), k };
}
