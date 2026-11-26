/**
 * Build-time graph data and deterministic layout (Task 10, spec §8.1).
 * `buildGraph` turns a `GeneratedIndex` (Task 5) into the compact
 * `GraphData` the graph page (`public/data/graph.json`) ships to the
 * browser — key names are shortened to keep the 2,000-node budget
 * (≤150 KB gzip, see global-constraints.md) and coordinates are computed
 * once here, with d3-force, rather than re-run in the browser.
 *
 * Layout summary (binding decisions, task-10-brief.md):
 * - Root topic fixed at (0, 0); non-root topics fixed on a radius-1000
 *   ring, ordered by `order` (undocumented-order topics sorted after,
 *   by id), evenly spaced starting at -90deg (top) going clockwise. An
 *   auto `part-of` edge links every non-root topic to the root.
 * - Concepts start at the mean of their topics' coordinates and are
 *   pulled toward their topic(s) with a link force (distance 260). A
 *   concept with no topic is pulled weakly toward root instead.
 * - A source with at least one concept relation attaches to its single
 *   strongest concept (priority: proposes > extends > challenges >
 *   supports > alternative-to > applies; ties broken by concept id),
 *   distance 120. A source with no concept relation attaches to the
 *   target of its `explains`/`responds` edge if it has one (distance 120),
 *   else to its first topic (distance 120), else to root.
 * - `by` edges (source -> entity) use link force at distance 90 and
 *   the sentinel relation index `REL_BY = REL.length` (entities have no
 *   `Rel`); entities are otherwise only pulled toward their one source.
 * - Every node gets a collision force (radius `r + 12`); source nodes
 *   use at least `SOURCE_COLLIDE_RADIUS` (≈ 42, half an L2 card's width
 *   in world units) so their L2 cards do not pile on top of each other.
 *   Entities keep the small `r + 12`.
 * - Random source `d3.randomLcg(42)`; simulation runs a fixed 300 ticks
 *   (no live timer — this all happens at build time, once). Stability
 *   across builds (spec §8.1 "新增内容时…已有节点尽量不动"): a node present
 *   in `prev` (previous build's coordinates) keeps its old position
 *   exactly (pinned via fx/fy), except a node one layout-link hop from a
 *   NEW node (one absent from `prev`), which gets a short low-alpha pass
 *   after the new nodes settle. When there is no new node the simulation
 *   is skipped and the output equals `prev` (plus the fixed ring), so
 *   repeated builds never drift.
 *   A `prev` entry whose `x` or `y` is not `Number.isFinite` (e.g. a
 *   corrupted positions file round-tripping `Infinity`/`NaN` through
 *   JSON) is treated as absent, so a bad on-disk value can never poison a
 *   node's computed position.
 *
 * Browser code that only needs the `GNode`/`GEdge`/`GraphData` *types*
 * must import them with `import type`, not a value import — a plain
 * import pulls in `d3-force`/`d3-random`, which are build-time-only and
 * must never reach the browser bundle.
 */
import { forceSimulation, forceLink, forceCollide } from 'd3-force';
import { randomLcg } from 'd3-random';
import { REL } from '../lib/schema';
import type { PageType, Rel } from '../lib/schema';
import type { GeneratedIndex, PageId, PageInfo } from '../lib/content-index';
import { topicSourceIds } from '../lib/topic-sources';

/** Sentinel `r` value for a `by` edge (source -> entity): one past the last real `Rel` index, since entities have no `Rel`. */
export const REL_BY = REL.length;

/** One graph node, compact field names to keep the gzip budget (see module doc). */
export interface GNode {
  id: PageId;
  t: PageType;
  l: string;
  s: string;
  tp: string[];
  d?: string;
  o?: string;
  /** Present (and `true`) only on the root topic ("Agent"). */
  root?: true;
  /**
   * Topic nodes only: source count shown as "N 份素材" — `topicSourceIds`
   * (same rule as the topic page's 来源数) for a topic, every source page
   * for the root. Omitted when 0. Computed here so render.ts stays free of
   * index lookups.
   */
  n?: number;
  x: number;
  y: number;
  r: number;
}

/** One graph edge: `a`/`b` are node indices into `GraphData.nodes`, `r` is a `REL` index or `REL_BY`. */
export interface GEdge {
  a: number;
  b: number;
  r: number;
}

/** Compact build output written to `public/data/graph.json`. `al` only lists nodes that actually have aliases (Task 13 search). */
export interface GraphData {
  nodes: GNode[];
  edges: GEdge[];
  al: Record<PageId, string[]>;
}

const RADIUS: Record<PageType, number> = {
  topic: 44,
  concept: 18, // base; concept radius also adds 2*sqrt(source count), computed per-node below
  paper: 6,
  blog: 6,
  video: 6,
  podcast: 6,
  entity: 5,
  raw: 0, // raw pages are never graph nodes
};
const ROOT_RADIUS = 60;
const TOPIC_RING_RADIUS = 1000;
const TOPIC_LINK_DISTANCE = 260;
/**
 * Source attach distance (source -> concept / fallback target). Raised from
 * 90 so the L2 source cards, which need `SOURCE_COLLIDE_RADIUS`, fit around
 * their concept without being pushed far out.
 */
const SOURCE_LINK_DISTANCE = 120;
/** `by` (source -> entity) link distance: entities stay close to their source. */
const ENTITY_LINK_DISTANCE = 90;
const COLLIDE_PADDING = 12;
/**
 * Collision radius for source nodes, from the L2 card footprint: a card is
 * `CARD_W` CSS px wide, i.e. `CARD_W / LEVEL_SCALE[2]` world units at L2.
 * The two numbers are duplicated from lod.ts (CARD_W = 220,
 * LEVEL_SCALE[2] = 2.6) so this build-time module does not import browser
 * code; keep them in sync. 220 / 2.6 / 2 ≈ 42.3.
 */
const L2_CARD_W = 220;
const L2_SCALE = 2.6;
const SOURCE_COLLIDE_RADIUS = Math.ceil(L2_CARD_W / L2_SCALE / 2);
const TICKS = 300;
/** Starting alpha and tick count for the pass that lets a new node's existing neighbours adjust. */
const LOW_ALPHA = 0.1;
const LOW_ALPHA_TICKS = 100;
const SEED = 42;

const SOURCE_TYPES = new Set<PageType>(['paper', 'blog', 'video', 'podcast']);

/** `proposes > extends > challenges > supports > alternative-to > applies` (ties by concept id) — brief's binding decision for a source's single strongest concept. */
const STRONGEST_CONCEPT_PRIORITY: Rel[] = [
  'proposes',
  'extends',
  'challenges',
  'supports',
  'alternative-to',
  'applies',
];

interface BuildNode extends GNode {
  index?: number;
  vx?: number;
  vy?: number;
  fx?: number;
  fy?: number;
}

interface BuildLink {
  source: PageId;
  target: PageId;
  distance: number;
}

/** `topics[0]`, mapped to its `wiki/topics/<slug>` id, or `undefined` if the page has no topics. */
function firstTopicId(info: PageInfo): PageId | undefined {
  return info.topics.length > 0 ? `wiki/topics/${info.topics[0]}` : undefined;
}

/** Every non-raw page keyed by id, in the deterministic output order: root, topics (by order, then id), concepts (by id), sources (by id), entities (by id). */
function sortedGraphPages(idx: GeneratedIndex): [PageId, PageInfo][] {
  const entries = Object.entries(idx.pages).filter(([, info]) => info.type !== 'raw');

  const rootEntry = entries.find(([, info]) => info.type === 'topic' && info.root === true);
  const topics = entries
    .filter(([id]) => id !== rootEntry?.[0])
    .filter(([, info]) => info.type === 'topic')
    .sort(([idA, a], [idB, b]) => {
      const oa = a.order;
      const ob = b.order;
      if (oa !== undefined && ob !== undefined) return oa - ob;
      if (oa !== undefined) return -1;
      if (ob !== undefined) return 1;
      return idA.localeCompare(idB);
    });
  const concepts = entries
    .filter(([, info]) => info.type === 'concept')
    .sort(([idA], [idB]) => idA.localeCompare(idB));
  const sources = entries
    .filter(([, info]) => SOURCE_TYPES.has(info.type))
    .sort(([idA], [idB]) => idA.localeCompare(idB));
  const entities = entries
    .filter(([, info]) => info.type === 'entity')
    .sort(([idA], [idB]) => idA.localeCompare(idB));

  const out: [PageId, PageInfo][] = [];
  if (rootEntry !== undefined) out.push(rootEntry);
  out.push(...topics, ...concepts, ...sources, ...entities);
  return out;
}

/** The target of a source's single strongest concept relation, or `undefined` if it has none. */
function strongestConceptTarget(sourceId: PageId, idx: GeneratedIndex): PageId | undefined {
  const outgoing = idx.edges.filter(
    (e) => e.from === sourceId && STRONGEST_CONCEPT_PRIORITY.includes(e.rel),
  );
  if (outgoing.length === 0) return undefined;
  const sorted = outgoing.slice().sort((e1, e2) => {
    const p1 = STRONGEST_CONCEPT_PRIORITY.indexOf(e1.rel);
    const p2 = STRONGEST_CONCEPT_PRIORITY.indexOf(e2.rel);
    if (p1 !== p2) return p1 - p2;
    return e1.to.localeCompare(e2.to);
  });
  return sorted[0].to;
}

/** The target of a source's `explains`/`responds` edge, if it has one. */
function explainsOrRespondsTarget(sourceId: PageId, idx: GeneratedIndex): PageId | undefined {
  const edge = idx.edges.find(
    (e) => e.from === sourceId && (e.rel === 'explains' || e.rel === 'responds'),
  );
  return edge?.to;
}

/**
 * Number of distinct source-type (paper/blog/video/podcast) backlinks into
 * a concept — the "素材数" the concept radius formula counts.
 * Concept<->concept/topic edges (`part-of`, `alternative-to`, or any edge
 * whose origin isn't a source page) never count, so they can't inflate
 * the radius.
 */
function conceptSourceCount(conceptId: PageId, idx: GeneratedIndex): number {
  const backlinks = idx.backlinks[conceptId] ?? [];
  const sourceIds = new Set(
    backlinks
      .filter((e) => e.rel !== 'part-of' && e.rel !== 'alternative-to')
      .filter((e) => SOURCE_TYPES.has(idx.pages[e.from]?.type as PageType))
      .map((e) => e.from),
  );
  return sourceIds.size;
}

/** Radius for a node per spec §8.1 (root 60, topic 44, concept `18 + 2*sqrt(source count)`, source 6, entity 5), rounded to an integer. */
function radiusFor(id: PageId, info: PageInfo, idx: GeneratedIndex): number {
  if (info.type === 'topic' && info.root === true) return ROOT_RADIUS;
  if (info.type === 'concept') {
    return Math.round(RADIUS.concept + 2 * Math.sqrt(conceptSourceCount(id, idx)));
  }
  return RADIUS[info.type];
}

/** `o` field: title of the first `by` entry with role `org` (its entity page's title if the page exists, else the literal name). */
function orgNameOf(info: PageInfo, idx: GeneratedIndex): string | undefined {
  const orgEntry = info.by.find((b) => b.role === 'org');
  if (orgEntry === undefined) return undefined;
  if (orgEntry.entity !== undefined) {
    const entityId = `wiki/entities/${orgEntry.entity}`;
    return idx.pages[entityId]?.title ?? orgEntry.entity;
  }
  return orgEntry.name;
}

/** Evenly spaced ring angle for the `index`-th of `count` topics, starting at -90deg (top) going clockwise. */
function ringAngle(index: number, count: number): number {
  return -Math.PI / 2 + (2 * Math.PI * index) / count;
}

/**
 * `prev[id]` if it's actually a 2-element array of finite numbers, else
 * `undefined` — a corrupt/malformed on-disk value (wrong shape, a
 * non-array, `null`, extra/missing elements, or a non-finite coordinate)
 * is treated the same as a missing entry (see module doc). `prev` comes
 * from parsed JSON (or a test), so its runtime shape for a given id isn't
 * guaranteed to match the declared `[number, number]` type.
 */
function finitePrevPos(
  prev: Record<PageId, [number, number]>,
  id: PageId,
): [number, number] | undefined {
  const pos: unknown = prev[id];
  if (!Array.isArray(pos) || pos.length !== 2) return undefined;
  const [x, y] = pos;
  return Number.isFinite(x) && Number.isFinite(y) ? (pos as [number, number]) : undefined;
}

/**
 * Build the full `GraphData` for `idx`: nodes (one per non-`raw` page) in
 * deterministic sort order, edges (index graph edges between two graph
 * nodes, plus auto topic->root `part-of` edges and `by` edges), and the
 * alias table. `prev` maps a `PageId` to its previous build's `[x, y]`,
 * used to seed that node's starting position so existing nodes barely
 * move across builds (see module doc).
 */
export function buildGraph(
  idx: GeneratedIndex,
  prev: Record<PageId, [number, number]>,
): GraphData {
  const sortedEntries = sortedGraphPages(idx);
  const order = sortedEntries.map(([id]) => id);
  const indexOf = new Map(order.map((id, i) => [id, i]));

  const rootId = sortedEntries.find(
    ([, info]) => info.type === 'topic' && info.root === true,
  )?.[0];
  const topicEntries = sortedEntries.filter(
    ([id, info]) => info.type === 'topic' && id !== rootId,
  );

  // Build nodes.
  const nodes: BuildNode[] = sortedEntries.map(([id, info]) => {
    const node: BuildNode = {
      id,
      t: info.type,
      l: info.title,
      s: info.summary,
      tp: info.topics,
      x: 0,
      y: 0,
      r: radiusFor(id, info, idx),
    };
    if (info.date !== undefined) node.d = info.date;
    const org = orgNameOf(info, idx);
    if (org !== undefined) node.o = org;
    return node;
  });
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  // Fixed positions: root at origin, topics evenly on the ring.
  if (rootId !== undefined) {
    const root = nodeById.get(rootId)!;
    root.fx = 0;
    root.fy = 0;
    root.x = 0;
    root.y = 0;
  }
  topicEntries.forEach(([id], i) => {
    const angle = ringAngle(i, topicEntries.length);
    const x = Math.round(TOPIC_RING_RADIUS * Math.cos(angle));
    const y = Math.round(TOPIC_RING_RADIUS * Math.sin(angle));
    const node = nodeById.get(id)!;
    node.fx = x;
    node.fy = y;
    node.x = x;
    node.y = y;
  });

  // Links: topic(non-root) -> root (auto part-of), concept -> topic(s),
  // source -> strongest concept / explains-responds target / first topic /
  // root, by (source -> entity).
  const links: BuildLink[] = [];
  const autoTopicRootEdges: [PageId, PageId][] = [];

  if (rootId !== undefined) {
    for (const [id] of topicEntries) {
      links.push({ source: id, target: rootId, distance: TOPIC_RING_RADIUS });
      autoTopicRootEdges.push([id, rootId]);
    }
  }

  for (const [id, info] of sortedEntries) {
    if (info.type === 'concept') {
      const topicIds = info.topics
        .map((slug) => `wiki/topics/${slug}`)
        .filter((t) => nodeById.has(t));
      if (topicIds.length > 0) {
        for (const topicId of topicIds) {
          links.push({ source: id, target: topicId, distance: TOPIC_LINK_DISTANCE });
        }
      } else if (rootId !== undefined) {
        // concept with no topic: pulled weakly toward root (longer
        // distance -> weaker pull, given shared link strength).
        links.push({ source: id, target: rootId, distance: TOPIC_RING_RADIUS });
      }
    } else if (SOURCE_TYPES.has(info.type)) {
      const strongest = strongestConceptTarget(id, idx);
      let target: PageId | undefined = strongest;
      if (target === undefined) target = explainsOrRespondsTarget(id, idx);
      if (target === undefined) target = firstTopicId(info);
      if (target === undefined) target = rootId;
      if (target !== undefined && nodeById.has(target)) {
        links.push({ source: id, target, distance: SOURCE_LINK_DISTANCE });
      }
    }
  }

  // `by` links: source -> entity (any by entry with a resolvable entity page).
  const byLinks: [PageId, PageId][] = [];
  for (const [id, info] of sortedEntries) {
    if (!SOURCE_TYPES.has(info.type)) continue;
    for (const by of info.by) {
      if (by.entity === undefined) continue;
      const entityId = `wiki/entities/${by.entity}`;
      if (nodeById.has(entityId)) {
        links.push({ source: id, target: entityId, distance: ENTITY_LINK_DISTANCE });
        byLinks.push([id, entityId]);
      }
    }
  }

  // Initial positions for free (non-fixed) nodes: concepts start at the mean
  // of their topics' coordinates (or root if none); sources/entities start
  // at their link target's coordinates if known, else root/origin. Nodes
  // with a valid `prev` entry start (and, see below, usually stay) at their
  // previous build's position.
  const newIds = new Set<PageId>();
  for (const [id, info] of sortedEntries) {
    const node = nodeById.get(id)!;
    if (node.fx !== undefined) continue; // root/topic: already fixed

    const prevPos = finitePrevPos(prev, id);
    if (prevPos !== undefined) {
      node.x = prevPos[0];
      node.y = prevPos[1];
      continue;
    }
    newIds.add(id);

    if (info.type === 'concept') {
      const topicIds = info.topics.map((slug) => `wiki/topics/${slug}`).filter((t) => nodeById.has(t));
      if (topicIds.length > 0) {
        const xs = topicIds.map((t) => nodeById.get(t)!.x);
        const ys = topicIds.map((t) => nodeById.get(t)!.y);
        node.x = xs.reduce((a, b) => a + b, 0) / xs.length;
        node.y = ys.reduce((a, b) => a + b, 0) / ys.length;
        continue;
      }
    }
    // sources/entities/topicless-concepts: start near their link target, else origin.
    const link = links.find((l) => l.source === id);
    if (link !== undefined) {
      const targetNode = nodeById.get(link.target);
      if (targetNode !== undefined) {
        node.x = targetNode.x;
        node.y = targetNode.y;
        continue;
      }
    }
    node.x = 0;
    node.y = 0;
  }

  // Stability (spec §8.1 "已有节点尽量不动"): a node with a valid prev
  // position is pinned, unless it is one layout-link hop from a new node;
  // those neighbours are released only for a short low-alpha pass after the
  // new nodes have settled. With no new node at all, nothing is simulated
  // and every coordinate is exactly the previous one.
  if (newIds.size > 0) {
    const neighbours = new Set<PageId>();
    for (const l of links) {
      if (newIds.has(l.source) && !newIds.has(l.target)) neighbours.add(l.target);
      if (newIds.has(l.target) && !newIds.has(l.source)) neighbours.add(l.source);
    }
    const pinned: BuildNode[] = [];
    for (const node of nodes) {
      if (node.fx !== undefined || newIds.has(node.id)) continue;
      node.fx = node.x;
      node.fy = node.y;
      pinned.push(node);
    }

    // Run the force simulation (build-time only, fixed seed, fixed tick count).
    const simulation = forceSimulation(nodes)
      .randomSource(randomLcg(SEED))
      .force(
        'link',
        forceLink<BuildNode, BuildLink>(links)
          .id((n) => n.id)
          .distance((l) => l.distance),
      )
      .force(
        'collide',
        forceCollide<BuildNode>((n) =>
          SOURCE_TYPES.has(n.t) ? Math.max(SOURCE_COLLIDE_RADIUS, n.r + COLLIDE_PADDING) : n.r + COLLIDE_PADDING,
        ),
      )
      .stop();

    simulation.tick(TICKS);

    // Low-alpha pass: let the new nodes' direct neighbours make room.
    const released = pinned.filter((n) => neighbours.has(n.id));
    if (released.length > 0 && pinned.length > 0) {
      for (const node of released) {
        node.fx = undefined;
        node.fy = undefined;
        node.vx = 0;
        node.vy = 0;
      }
      simulation.alpha(LOW_ALPHA).tick(LOW_ALPHA_TICKS);
    }

    for (const node of pinned) {
      node.fx = undefined;
      node.fy = undefined;
    }
  }

  // Round coordinates to integers (brief Step 3: "坐标取整到整数，以减小体积").
  for (const node of nodes) {
    node.x = Math.round(node.x);
    node.y = Math.round(node.y);
  }

  // Edges: index-graph edges whose endpoints are both graph nodes, plus
  // auto topic->root part-of edges, plus `by` edges (sentinel REL_BY).
  // Deduped on identical (a, b, r).
  const relIndex = new Map<Rel, number>(REL.map((r, i) => [r, i]));
  const seen = new Set<string>();
  const edges: GEdge[] = [];

  function pushEdge(fromId: PageId, toId: PageId, r: number): void {
    const a = indexOf.get(fromId);
    const b = indexOf.get(toId);
    if (a === undefined || b === undefined) return;
    const key = `${a}-${b}-${r}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ a, b, r });
  }

  for (const edge of idx.edges) {
    const r = relIndex.get(edge.rel);
    if (r === undefined) continue;
    pushEdge(edge.from, edge.to, r);
  }
  for (const [topicId, target] of autoTopicRootEdges) {
    pushEdge(topicId, target, relIndex.get('part-of')!);
  }
  for (const [sourceId, entityId] of byLinks) {
    pushEdge(sourceId, entityId, REL_BY);
  }

  // Alias table: only nodes that actually have aliases.
  const al: Record<PageId, string[]> = {};
  for (const [id, info] of sortedEntries) {
    if (info.aliases !== undefined && info.aliases.length > 0) {
      al[id] = info.aliases;
    }
  }

  const sourceCount = nodes.filter((n) => SOURCE_TYPES.has(n.t)).length;

  // Strip simulation-internal fields (index/vx/vy/fx/fy) from the output nodes.
  const outNodes: GNode[] = nodes.map((n) => {
    const out: GNode = { id: n.id, t: n.t, l: n.l, s: n.s, tp: n.tp, x: n.x, y: n.y, r: n.r };
    if (n.id === rootId) out.root = true;
    if (n.d !== undefined) out.d = n.d;
    if (n.o !== undefined) out.o = n.o;
    if (n.t === 'topic') {
      const count = n.id === rootId ? sourceCount : topicSourceIds(n.id, idx).size;
      if (count > 0) out.n = count;
    }
    return out;
  });

  return { nodes: outNodes, edges, al };
}
