/**
 * Pure interaction logic for the homepage graph (Task 12, spec §8.2–§8.4):
 * neighbours for hover highlighting, hit testing, what a click does, and
 * the related sources listed in the preview panel. No DOM access here;
 * `main.ts` wires these to pointer events.
 *
 * Browser code: only `import type` from build.ts (d3-force must not reach
 * the bundle). `REL_BY` is therefore derived from `REL_LABEL`, the same
 * way render.ts derives its relation names.
 */
import type { Quadtree, QuadtreeLeaf } from 'd3-quadtree';
import type { GNode, GraphData } from './build';
import type { PageId } from '../lib/content-index';
import type { PageType } from '../lib/schema';
import { REL_LABEL } from '../lib/labels';
import { toRoute } from '../lib/routes';
import { CARD_H, CARD_W, MIN_SCREEN_R, isRootNode, lodAlpha, screenRadius } from './lod';

/** `GEdge.r` of a `by` edge (source → entity): one past the last real relation. */
const REL_BY = Object.keys(REL_LABEL).length;

export const SOURCE_TYPES: ReadonlySet<PageType> = new Set<PageType>(['paper', 'blog', 'video', 'podcast']);
export const isSource = (n: Pick<GNode, 't'>): boolean => SOURCE_TYPES.has(n.t);

export interface EntityOption {
  /** Entity nodes and `by` edges take part only when true (filter, Task 13). */
  showEntities?: boolean;
}

/**
 * Ids directly connected to `id`, in either direction. `by` edges (and so
 * entities) count only when `showEntities`; an unknown id has none.
 */
export function neighbors(id: PageId, data: GraphData, opts: EntityOption = {}): Set<PageId> {
  const out = new Set<PageId>();
  const i = data.nodes.findIndex((n) => n.id === id);
  if (i < 0) return out;
  for (const e of data.edges) {
    if (e.r === REL_BY && !opts.showEntities) continue;
    if (e.a === i && data.nodes[e.b]) out.add(data.nodes[e.b].id);
    else if (e.b === i && data.nodes[e.a]) out.add(data.nodes[e.a].id);
  }
  out.delete(id);
  return out;
}

/** Overlap priority: the most specific node wins (source/entity > concept > topic > root). */
function rank(n: GNode): number {
  if (n.t === 'topic') return isRootNode(n) ? 0 : 1;
  if (n.t === 'concept') return 2;
  return 3;
}

const maxRadius = new WeakMap<object, number>();

/**
 * The node under `world` (world units) at zoom `k`, or null.
 *
 * - Droplets and dots are circles of world radius `screenRadius(n, k) / k`.
 * - Sources at L2 (`lodAlpha(k).sourceCard >= 0.5`) are their card rectangle,
 *   `CARD_W / k` × `CARD_H / k` centred on the node; below that they are dots,
 *   and they are not hittable at all while both dot and card are faded out
 *   (< 0.5).
 * - Entities only when `opts.showEntities` and their L1 fade-in is ≥ 0.5.
 * - Nodes outside `opts.visible` (filters) never hit.
 *
 * On overlap the most specific node wins, then the nearest centre.
 */
export function hitTest(
  qt: Quadtree<GNode>,
  world: [number, number],
  k: number,
  opts: EntityOption & { visible?: Set<PageId> } = {},
): GNode | null {
  if (!(k > 0) || !Number.isFinite(world[0]) || !Number.isFinite(world[1])) return null;
  let maxR = maxRadius.get(qt);
  if (maxR === undefined) {
    maxR = 0;
    for (const n of qt.data()) maxR = Math.max(maxR, n.r);
    maxRadius.set(qt, maxR);
  }
  const a = lodAlpha(k);
  const sourceHit = a.sourceDot >= 0.5 || a.sourceCard >= 0.5;
  const cards = a.sourceCard >= 0.5;
  const entityHit = opts.showEntities === true && a.conceptLabel >= 0.5;
  // Search box: the largest possible hit shape around any centre.
  const reach = Math.max(maxR, Math.max(MIN_SCREEN_R.root, CARD_W / 2) / k);
  const [px, py] = world;
  const x0 = px - reach;
  const y0 = py - reach;
  const x1 = px + reach;
  const y1 = py + reach;

  let best: GNode | null = null;
  let bestRank = -1;
  let bestD = Infinity;
  const consider = (n: GNode): void => {
    if (opts.visible && !opts.visible.has(n.id)) return;
    const dx = px - n.x;
    const dy = py - n.y;
    if (isSource(n)) {
      if (!sourceHit) return;
      if (cards) {
        if (Math.abs(dx) > CARD_W / 2 / k || Math.abs(dy) > CARD_H / 2 / k) return;
      } else if (Math.hypot(dx, dy) > screenRadius(n, k) / k) return;
    } else if (n.t === 'entity') {
      if (!entityHit || Math.hypot(dx, dy) > screenRadius(n, k) / k) return;
    } else if (Math.hypot(dx, dy) > screenRadius(n, k) / k) return;
    const r = rank(n);
    const d = dx * dx + dy * dy;
    if (r > bestRank || (r === bestRank && d < bestD)) {
      best = n;
      bestRank = r;
      bestD = d;
    }
  };
  qt.visit((q, qx0, qy0, qx1, qy1) => {
    if (!q.length) {
      let leaf: QuadtreeLeaf<GNode> | undefined = q as QuadtreeLeaf<GNode>;
      do {
        consider(leaf.data);
        leaf = leaf.next;
      } while (leaf);
    }
    return qx0 > x1 || qy0 > y1 || qx1 < x0 || qy1 < y0;
  });
  return best;
}

export type ClickAction =
  | { kind: 'fly'; level: 1 | 2; focus: PageId }
  | { kind: 'navigate'; href: string };

/**
 * What clicking `n` does (spec §8.2): a topic (including the root) flies to
 * L1, a concept to L2; sources and entities open their page. `level` is the
 * current level, kept in the signature for callers; the target level is
 * fixed per type so a click always lands on the same view.
 */
export function clickAction(n: GNode, _level: 0 | 1 | 2): ClickAction {
  if (n.t === 'topic') return { kind: 'fly', level: 1, focus: n.id };
  if (n.t === 'concept') return { kind: 'fly', level: 2, focus: n.id };
  return { kind: 'navigate', href: toRoute(n.id) };
}

/**
 * Up to `limit` sources related to a topic or concept, newest first (by
 * `d`, undated last, then id), for the preview panel:
 * - concept: its source neighbours;
 * - topic: its source neighbours, sources tagged with the topic (`tp`), and
 *   sources attached to the topic's concepts. (Sources rarely link to a
 *   topic directly, so neighbours alone would leave a topic panel empty.)
 */
export function relatedSources(id: PageId, data: GraphData, limit = 3): GNode[] {
  const self = data.nodes.find((n) => n.id === id);
  if (!self || limit <= 0) return [];
  const byId = new Map(data.nodes.map((n) => [n.id, n]));
  const out = new Map<PageId, GNode>();
  const addSources = (ids: Iterable<PageId>): void => {
    for (const nid of ids) {
      const n = byId.get(nid);
      if (n && isSource(n)) out.set(n.id, n);
    }
  };
  const near = neighbors(id, data);
  addSources(near);
  if (self.t === 'topic') {
    const slug = id.slice(id.lastIndexOf('/') + 1);
    for (const n of data.nodes) if (isSource(n) && n.tp.includes(slug)) out.set(n.id, n);
    for (const nid of near) if (byId.get(nid)?.t === 'concept') addSources(neighbors(nid, data));
  }
  return [...out.values()]
    .sort((p, q) => (q.d ?? '').localeCompare(p.d ?? '') || p.id.localeCompare(q.id))
    .slice(0, limit);
}

/**
 * Nodes the camera frames together with `n` when flying to it at `level`
 * (`frameCluster` in camera.ts): a topic at L1 brings its concepts, a
 * concept at L2 its neighbouring sources (entities never). Anything else
 * frames `n` alone (`[]`). Hidden nodes (`visible`, when given) are left out.
 */
export function frameMembers(n: GNode, level: 0 | 1 | 2, data: GraphData, visible?: ReadonlySet<PageId>): GNode[] {
  const want = n.t === 'topic' && !isRootNode(n) && level === 1 ? 'concept' : n.t === 'concept' && level === 2 ? 'source' : null;
  if (want === null) return [];
  const byId = new Map(data.nodes.map((m) => [m.id, m]));
  const out: GNode[] = [];
  for (const id of neighbors(n.id, data)) {
    const m = byId.get(id);
    if (!m || (visible && !visible.has(id))) continue;
    if (want === 'concept' ? m.t === 'concept' : isSource(m)) out.push(m);
  }
  return out;
}
