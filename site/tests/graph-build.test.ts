/**
 * Task 10 graph-build tests. Mirrors the brief's pinned test literals
 * verbatim (spec §8.1 / task-10-brief.md Step 1), plus coverage for the
 * binding decisions the brief leaves to the implementer: `by` edges (`r =
 * REL_BY`), dedupe, node sort order, topic-ring angle/order, source
 * attachment fallback (explains/responds target → first topic → root),
 * isolated-concept-with-no-topic pull to root, and the `al` alias table.
 */
import { gzipSync } from 'node:zlib';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, test, beforeAll, afterAll } from 'vitest';
import { prepare } from '../scripts/prepare';
import { buildGraph, REL_BY, type GNode } from '../src/graph/build';
import type { Edge, GeneratedIndex } from '../src/lib/content-index';
import { synthIndex } from './helpers/synth';

// vitest runs with cwd = site/, fixtures live at the repo root.
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MINI = path.join(REPO_ROOT, 'tests/fixtures/mini-repo');

let idx: GeneratedIndex;
let tmp: string;

beforeAll(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'graph-build-test-'));
  await prepare({ root: MINI, siteDir: tmp });
  idx = JSON.parse(await fs.readFile(path.join(tmp, '.generated/index.json'), 'utf8'));
});

afterAll(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

/** Add one extra source page (and its edges/backlinks) to a `GeneratedIndex`, for the "existing nodes barely move" test. */
function withExtraSource(base: GeneratedIndex): GeneratedIndex {
  const id = 'wiki/papers/extra-source';
  const edge: Edge = { from: id, to: 'wiki/concepts/context-compaction', rel: 'supports' };
  return {
    pages: {
      ...base.pages,
      [id]: {
        id,
        type: 'paper',
        title: 'Extra Source Paper',
        summary: '追加的素材，用于测试新增节点时旧坐标基本不变。',
        topics: ['context'],
        by: [],
        insights: [],
        date: '2026-11-10',
        venue: 'arXiv',
        url: 'https://arxiv.org/abs/2611.00099',
        sourceKey: 'sources/papers/2611.00099',
      },
    },
    edges: [...base.edges, edge],
    backlinks: {
      ...base.backlinks,
      'wiki/concepts/context-compaction': [
        ...(base.backlinks['wiki/concepts/context-compaction'] ?? []),
        edge,
      ],
    },
    redirects: base.redirects,
  };
}

describe('buildGraph on mini-repo', () => {
  let g: ReturnType<typeof buildGraph>;

  beforeAll(() => {
    g = buildGraph(idx, {});
  });

  const at = (id: string): GNode => g.nodes.find((n) => n.id === id)!;
  const dist = (a: GNode, b: GNode) => Math.hypot(a.x - b.x, a.y - b.y);

  test('deterministic', () => {
    expect(JSON.stringify(buildGraph(idx, {}))).toBe(JSON.stringify(g));
  });

  test('root at origin', () => {
    expect([at('wiki/topics/agent').x, at('wiki/topics/agent').y]).toEqual([0, 0]);
  });

  test('topics on ring', () => {
    expect(Math.abs(dist(at('wiki/topics/context'), at('wiki/topics/agent')) - 1000)).toBeLessThan(
      1,
    );
  });

  test('topic ring starts at -90deg (top) going clockwise', () => {
    // order 1 = context: first non-root topic placed on the ring. With 2
    // non-root topics (context order 1, memory order 2) spaced evenly over
    // 360deg starting at -90deg clockwise: context at -90deg (top), memory
    // at 90deg (bottom).
    const context = at('wiki/topics/context');
    const memory = at('wiki/topics/memory');
    expect(Math.round(context.x)).toBe(0);
    expect(context.y).toBeLessThan(0); // top
    expect(Math.round(memory.x)).toBe(0);
    expect(memory.y).toBeGreaterThan(0); // bottom
  });

  test('concept near its topic', () => {
    const c = at('wiki/concepts/context-compaction');
    expect(dist(c, at('wiki/topics/context'))).toBeLessThan(dist(c, at('wiki/topics/memory')));
  });

  test('isolated concept has finite coords', () => {
    const c = at('wiki/concepts/isolated-idea');
    expect(Number.isFinite(c.x) && Number.isFinite(c.y)).toBe(true);
  });

  test('existing nodes barely move when a source is added', () => {
    const prev = Object.fromEntries(g.nodes.map((n) => [n.id, [n.x, n.y] as [number, number]]));
    const g2 = buildGraph(withExtraSource(idx), prev);
    for (const n of g.nodes) {
      expect(dist(n, g2.nodes.find((m) => m.id === n.id)!)).toBeLessThan(50);
    }
  });

  test('root node has no type/topics mismatch and radius 60', () => {
    expect(at('wiki/topics/agent').r).toBe(60);
  });

  test('topic radius is 44', () => {
    expect(at('wiki/topics/context').r).toBe(44);
  });

  test('source radius is 6', () => {
    expect(at('wiki/papers/202611-sample-paper').r).toBe(6);
  });

  test('entity radius is 5', () => {
    expect(at('wiki/entities/demo-org').r).toBe(5);
  });

  test('concept radius grows with source count (18 + 2*sqrt(sources))', () => {
    // context-compaction has 2 incoming edges (proposes + challenges) but
    // both come from the same paper, so distinct source count is 1 ->
    // 18 + 2*sqrt(1) = 20.
    const c = at('wiki/concepts/context-compaction');
    expect(c.r).toBe(Math.round(18 + 2 * Math.sqrt(1)));
  });

  test('coordinates are integers', () => {
    for (const n of g.nodes) {
      expect(Number.isInteger(n.x)).toBe(true);
      expect(Number.isInteger(n.y)).toBe(true);
    }
  });

  test('node ids are all distinct and cover every non-raw page', () => {
    const ids = new Set(g.nodes.map((n) => n.id));
    expect(ids.size).toBe(g.nodes.length);
    for (const id of Object.keys(idx.pages)) {
      if (idx.pages[id].type === 'raw') continue;
      expect(ids.has(id)).toBe(true);
    }
    // raw pages (glossary) are excluded
    expect(ids.has('wiki/glossary')).toBe(false);
  });

  test('node sort order: root, topics by order, concepts by id, sources by id, entities by id', () => {
    const order = g.nodes.map((n) => n.id);
    expect(order).toEqual([
      'wiki/topics/agent',
      'wiki/topics/context',
      'wiki/topics/memory',
      'wiki/concepts/context-compaction',
      'wiki/concepts/isolated-idea',
      'wiki/papers/202611-sample-paper',
      'wiki/videos/20261101-demo-explainer',
      'wiki/entities/demo-org',
    ]);
  });

  test('auto part-of edges link every non-root topic to root', () => {
    const idOf = (id: string) => g.nodes.findIndex((n) => n.id === id);
    const rootIdx = idOf('wiki/topics/agent');
    const contextIdx = idOf('wiki/topics/context');
    const memoryIdx = idOf('wiki/topics/memory');
    const hasEdge = (a: number, b: number) =>
      g.edges.some((e) => e.a === a && e.b === b && e.r === 7 /* part-of */);
    expect(hasEdge(contextIdx, rootIdx)).toBe(true);
    expect(hasEdge(memoryIdx, rootIdx)).toBe(true);
  });

  test('by edges use sentinel REL_BY and point source -> entity', () => {
    const idOf = (id: string) => g.nodes.findIndex((n) => n.id === id);
    const paperIdx = idOf('wiki/papers/202611-sample-paper');
    const entityIdx = idOf('wiki/entities/demo-org');
    const byEdge = g.edges.find((e) => e.a === paperIdx && e.b === entityIdx);
    expect(byEdge).toBeDefined();
    expect(byEdge!.r).toBe(REL_BY);
  });

  test('video with no concept relation attaches (via explains) near the paper it explains', () => {
    const video = at('wiki/videos/20261101-demo-explainer');
    const paper = at('wiki/papers/202611-sample-paper');
    const memory = at('wiki/topics/memory');
    expect(dist(video, paper)).toBeLessThan(dist(video, memory));
  });

  test('o field (机构) is the org entity title for the paper', () => {
    const paper = at('wiki/papers/202611-sample-paper');
    expect(paper.o).toBe('Demo Org');
  });

  test('al alias table only lists aliased nodes', () => {
    expect(g.al['wiki/concepts/context-compaction']).toEqual(['Context Compaction']);
    expect(g.al['wiki/papers/202611-sample-paper']).toBeUndefined();
  });

  test('edges are deduped on identical (a, b, r)', () => {
    const seen = new Set<string>();
    for (const e of g.edges) {
      const key = `${e.a}-${e.b}-${e.r}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  test('2000-node graph fits 150KB gzip', () => {
    const size = gzipSync(JSON.stringify(buildGraph(synthIndex(2000), {}))).length;
    expect(size).toBeLessThanOrEqual(150 * 1024);
  }, 60_000);
});

describe('buildGraph source attachment fallback', () => {
  test('a source with no concept relation and no explains/responds attaches to its first topic', () => {
    const base: GeneratedIndex = {
      pages: {
        'wiki/topics/agent': {
          id: 'wiki/topics/agent',
          type: 'topic',
          title: 'Agent',
          summary: '根主题。',
          topics: [],
          by: [],
          insights: [],
          root: true,
          order: 0,
        },
        'wiki/topics/context': {
          id: 'wiki/topics/context',
          type: 'topic',
          title: 'Context',
          summary: '上下文主题。',
          topics: [],
          by: [],
          insights: [],
          order: 1,
        },
        'wiki/blogs/orphan-source': {
          id: 'wiki/blogs/orphan-source',
          type: 'blog',
          title: 'Orphan Source',
          summary: '没有概念关系、没有 explains/responds 的素材。',
          topics: ['context'],
          by: [],
          insights: [],
          date: '2026-11-20',
          venue: 'Blog',
          url: 'https://example.com/orphan',
          sourceKey: 'sources/blogs/orphan',
        },
      },
      edges: [],
      backlinks: {},
      redirects: {},
    };
    const g = buildGraph(base, {});
    const at = (id: string): GNode => g.nodes.find((n) => n.id === id)!;
    const dist = (a: GNode, b: GNode) => Math.hypot(a.x - b.x, a.y - b.y);
    const orphan = at('wiki/blogs/orphan-source');
    const context = at('wiki/topics/context');
    const root = at('wiki/topics/agent');
    expect(dist(orphan, context)).toBeLessThan(dist(orphan, root));
  });

  test('a source with no concept relation, no explains/responds and no topic attaches to root', () => {
    const base: GeneratedIndex = {
      pages: {
        'wiki/topics/agent': {
          id: 'wiki/topics/agent',
          type: 'topic',
          title: 'Agent',
          summary: '根主题。',
          topics: [],
          by: [],
          insights: [],
          root: true,
          order: 0,
        },
        'wiki/blogs/rootless-source': {
          id: 'wiki/blogs/rootless-source',
          type: 'blog',
          title: 'Rootless Source',
          summary: '没有任何主题、概念关系的素材。',
          topics: [],
          by: [],
          insights: [],
          date: '2026-11-21',
          venue: 'Blog',
          url: 'https://example.com/rootless',
          sourceKey: 'sources/blogs/rootless',
        },
      },
      edges: [],
      backlinks: {},
      redirects: {},
    };
    const g = buildGraph(base, {});
    const at = (id: string): GNode => g.nodes.find((n) => n.id === id)!;
    const rootless = at('wiki/blogs/rootless-source');
    expect(Number.isFinite(rootless.x) && Number.isFinite(rootless.y)).toBe(true);
  });

  test('a concept with no topic is pulled weakly toward root but stays finite', () => {
    const base: GeneratedIndex = {
      pages: {
        'wiki/topics/agent': {
          id: 'wiki/topics/agent',
          type: 'topic',
          title: 'Agent',
          summary: '根主题。',
          topics: [],
          by: [],
          insights: [],
          root: true,
          order: 0,
        },
        'wiki/concepts/topicless': {
          id: 'wiki/concepts/topicless',
          type: 'concept',
          title: 'Topicless Concept',
          summary: '没有任何主题的概念，用于测试弱吸附到根节点。',
          topics: [],
          by: [],
          insights: [],
          status: 'emerging',
        },
      },
      edges: [],
      backlinks: {},
      redirects: {},
    };
    const g = buildGraph(base, {});
    const at = (id: string): GNode => g.nodes.find((n) => n.id === id)!;
    const c = at('wiki/concepts/topicless');
    expect(Number.isFinite(c.x) && Number.isFinite(c.y)).toBe(true);
  });

  test('a source attaches only to its single strongest concept (proposes beats challenges)', () => {
    // mini-repo paper proposes+challenges context-compaction (only one
    // concept target) — use a synthetic case with two distinct concepts to
    // confirm priority ordering picks `proposes` over `supports`.
    const base: GeneratedIndex = {
      pages: {
        'wiki/topics/agent': {
          id: 'wiki/topics/agent',
          type: 'topic',
          title: 'Agent',
          summary: '根主题。',
          topics: [],
          by: [],
          insights: [],
          root: true,
          order: 0,
        },
        'wiki/topics/context': {
          id: 'wiki/topics/context',
          type: 'topic',
          title: 'Context',
          summary: '上下文主题。',
          topics: [],
          by: [],
          insights: [],
          order: 1,
        },
        'wiki/concepts/strong': {
          id: 'wiki/concepts/strong',
          type: 'concept',
          title: 'Strong Concept',
          summary: '论文用 proposes 指向的概念。',
          topics: ['context'],
          by: [],
          insights: [],
          status: 'emerging',
        },
        'wiki/concepts/weak': {
          id: 'wiki/concepts/weak',
          type: 'concept',
          title: 'Weak Concept',
          summary: '论文用 supports 指向的概念。',
          topics: ['context'],
          by: [],
          insights: [],
          status: 'emerging',
        },
        'wiki/papers/dual-rel': {
          id: 'wiki/papers/dual-rel',
          type: 'paper',
          title: 'Dual Relation Paper',
          summary: '同时 supports 和 proposes 两个概念的论文。',
          topics: ['context'],
          by: [],
          insights: [],
          date: '2026-11-15',
          venue: 'arXiv',
          url: 'https://arxiv.org/abs/2611.00050',
          sourceKey: 'sources/papers/2611.00050',
        },
      },
      edges: [
        { from: 'wiki/concepts/strong', to: 'wiki/topics/context', rel: 'part-of' },
        { from: 'wiki/concepts/weak', to: 'wiki/topics/context', rel: 'part-of' },
        { from: 'wiki/papers/dual-rel', to: 'wiki/concepts/weak', rel: 'supports' },
        { from: 'wiki/papers/dual-rel', to: 'wiki/concepts/strong', rel: 'proposes' },
      ],
      backlinks: {
        'wiki/topics/context': [
          { from: 'wiki/concepts/strong', to: 'wiki/topics/context', rel: 'part-of' },
          { from: 'wiki/concepts/weak', to: 'wiki/topics/context', rel: 'part-of' },
        ],
      },
      redirects: {},
    };
    const g = buildGraph(base, {});
    const at = (id: string): GNode => g.nodes.find((n) => n.id === id)!;
    const dist = (a: GNode, b: GNode) => Math.hypot(a.x - b.x, a.y - b.y);
    const paper = at('wiki/papers/dual-rel');
    const strong = at('wiki/concepts/strong');
    const weak = at('wiki/concepts/weak');
    expect(dist(paper, strong)).toBeLessThan(dist(paper, weak));
  });
});
