/**
 * Semantic-zoom levels (Task 11, spec §8.2). Three levels, chosen by the
 * camera zoom `k`; contents crossfade within ±BAND of each threshold
 * instead of popping.
 *
 * - L0 (k < L1_AT): root and topic droplets with labels; concepts are
 *   unlabelled droplets; sources hidden.
 * - L1 (L1_AT ≤ k < L2_AT): concept labels; sources as type-coloured dots.
 * - L2 (k ≥ L2_AT): sources as fixed-size screen-space cards.
 */
import type { GNode } from './build';

/** Camera zoom that `fitNode` uses for each level; each sits outside the crossfade bands. */
export const LEVEL_SCALE = [0.35, 1.0, 2.6] as const;
export const L1_AT = 0.6;
export const L2_AT = 1.8;
/** Crossfade half-width, as a fraction of the threshold. */
export const BAND = 0.15;

/** L2 source card size in CSS px, independent of zoom. In world units a card is `CARD_W / k` × `CARD_H / k`, centred on the node (Task 12 hit test). */
export const CARD_W = 220;
export const CARD_H = 64;

export interface LodAlpha {
  topicLabel: number;
  conceptDot: number;
  conceptLabel: number;
  sourceDot: number;
  sourceCard: number;
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

const ramp = (at: number, k: number): number => smoothstep(at * (1 - BAND), at * (1 + BAND), k);

export function lodAlpha(k: number): LodAlpha {
  const l1 = ramp(L1_AT, k);
  const l2 = ramp(L2_AT, k);
  return { topicLabel: 1, conceptDot: 1, conceptLabel: l1, sourceDot: l1 * (1 - l2), sourceCard: l2 };
}

/**
 * Minimum on-screen radius (CSS px) so the Agent and topic droplets stay
 * "大水滴" at L0, where `r · k` alone would make a topic only ~15 px.
 * Concepts keep a small floor so their unlabelled dots stay visible.
 */
export const MIN_SCREEN_R = { root: 34, topic: 24, concept: 4 } as const;

/** The root topic is the only topic at (0, 0): build.ts pins it there and puts every other topic on the radius-1000 ring. */
export function isRootNode(n: Pick<GNode, 't' | 'x' | 'y'>): boolean {
  return n.t === 'topic' && n.x === 0 && n.y === 0;
}

/** Drawn droplet radius in CSS px at zoom `k`. Task 12's circle hit test should divide this by `k` to get world units. */
export function screenRadius(n: Pick<GNode, 't' | 'x' | 'y' | 'r'>, k: number): number {
  const base = n.r * k;
  if (n.t === 'topic') return Math.max(base, isRootNode(n) ? MIN_SCREEN_R.root : MIN_SCREEN_R.topic);
  if (n.t === 'concept') return Math.max(base, MIN_SCREEN_R.concept);
  return base;
}

/** The level whose range contains `k` (thresholds are inclusive on the upper level). */
export function levelOf(k: number): 0 | 1 | 2 {
  return k < L1_AT ? 0 : k < L2_AT ? 1 : 2;
}
