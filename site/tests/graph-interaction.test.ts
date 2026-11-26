/**
 * Task 12 interaction tests: click actions, neighbours, hit testing,
 * related sources for the preview panel and the shareable `#node=&z=` view.
 * The brief's pinned tests come first, verbatim.
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { prepare } from '../scripts/prepare';
import type { GNode, GraphData } from '../src/graph/build';
import type { PageId } from '../src/lib/content-index';
import { buildQuadtree } from '../src/graph/render';
import { CARD_H, CARD_W, LEVEL_SCALE, MIN_SCREEN_R } from '../src/graph/lod';
import { initialCamera, worldToScreen, K_MIN } from '../src/graph/camera';
import { clickAction, frameMembers, hitTest, neighbors, relatedSources } from '../src/graph/interaction';
import { decodeView, encodeView } from '../src/graph/hash';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MINI = path.join(REPO_ROOT, 'tests/fixtures/mini-repo');

let g: GraphData;
let ids: Set<PageId>;
let tmp: string;

beforeAll(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'graph-interaction-test-'));
  await prepare({ root: MINI, siteDir: tmp });
  g = JSON.parse(await fs.readFile(path.join(tmp, 'public/data/graph.json'), 'utf8'));
  ids = new Set(g.nodes.map((n) => n.id));
});

afterAll(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

const node = (id: string): GNode => {
  const n = g.nodes.find((x) => x.id === id);
  if (!n) throw new Error(`no node ${id}`);
  return n;
};

// ---------------------------------------------------------- brief, verbatim

test('topic click flies to L1', () => expect(clickAction(node('wiki/topics/context'), 0)).toEqual({kind:'fly', level:1, focus:'wiki/topics/context'}));
test('concept click flies to L2', () => expect(clickAction(node('wiki/concepts/context-compaction'), 1)).toMatchObject({kind:'fly', level:2}));
test('source click navigates', () => expect(clickAction(node('wiki/papers/202611-sample-paper'), 2)).toEqual({kind:'navigate', href:'/awesome-agent-llm-wiki/wiki/papers/202611-sample-paper/'}));
test('neighbors of concept', () => expect(neighbors('wiki/concepts/context-compaction', g)).toEqual(new Set(['wiki/topics/context','wiki/papers/202611-sample-paper'])));
test('hash round trip', () => expect(decodeView(encodeView({node:'wiki/topics/context', z:1}), ids)).toEqual({node:'wiki/topics/context', z:1}));
test('unknown node falls back to L0', () => expect(decodeView('#node=wiki/concepts/nope&z=2', ids)).toEqual({z:0}));
test('garbage hash falls back to L0', () => expect(decodeView('#%%%', ids)).toEqual({z:0}));

// ------------------------------------------------------------------ extras

describe('clickAction', () => {
  test('root topic also flies to L1', () => {
    expect(clickAction(node('wiki/topics/agent'), 0)).toEqual({ kind: 'fly', level: 1, focus: 'wiki/topics/agent' });
  });
  test('concept fly carries its id as focus', () => {
    expect(clickAction(node('wiki/concepts/context-compaction'), 1)).toEqual({
      kind: 'fly',
      level: 2,
      focus: 'wiki/concepts/context-compaction',
    });
  });
  test('video and entity navigate to their pages', () => {
    expect(clickAction(node('wiki/videos/20261101-demo-explainer'), 1)).toEqual({
      kind: 'navigate',
      href: '/awesome-agent-llm-wiki/wiki/videos/20261101-demo-explainer/',
    });
    expect(clickAction(node('wiki/entities/demo-org'), 2)).toEqual({
      kind: 'navigate',
      href: '/awesome-agent-llm-wiki/wiki/entities/demo-org/',
    });
  });
});

describe('neighbors', () => {
  test('entity edges count only when entities are shown', () => {
    const paper = 'wiki/papers/202611-sample-paper';
    expect(neighbors(paper, g).has('wiki/entities/demo-org')).toBe(false);
    expect(neighbors(paper, g, { showEntities: true }).has('wiki/entities/demo-org')).toBe(true);
    expect(neighbors(paper, g)).toEqual(new Set(['wiki/concepts/context-compaction', 'wiki/videos/20261101-demo-explainer']));
  });
  test('isolated node and unknown id have no neighbours', () => {
    expect(neighbors('wiki/concepts/isolated-idea', g)).toEqual(new Set(['wiki/topics/context']));
    expect(neighbors('wiki/concepts/nope', g)).toEqual(new Set());
  });
  test('root sees its topics', () => {
    expect(neighbors('wiki/topics/agent', g)).toEqual(new Set(['wiki/topics/context', 'wiki/topics/memory']));
  });
});

describe('hitTest', () => {
  const qt = () => buildQuadtree(g.nodes);
  const at = (id: string, dx = 0, dy = 0): [number, number] => [node(id).x + dx, node(id).y + dy];

  test('hits the root and a topic at L0 by their minimum screen radius', () => {
    const k = LEVEL_SCALE[0];
    expect(hitTest(qt(), at('wiki/topics/agent'), k)?.id).toBe('wiki/topics/agent');
    // Topic droplet is at least 24 px on screen: 20 px off-centre still hits.
    expect(hitTest(qt(), at('wiki/topics/memory', 20 / k), k)?.id).toBe('wiki/topics/memory');
    expect(hitTest(qt(), at('wiki/topics/memory', 30 / k + 44), k)).toBeNull();
  });

  test('empty space misses', () => {
    expect(hitTest(qt(), [600, 600], LEVEL_SCALE[0])).toBeNull();
  });

  test('sources are not hittable at L0', () => {
    expect(hitTest(qt(), at('wiki/papers/202611-sample-paper'), LEVEL_SCALE[0])?.id).not.toBe('wiki/papers/202611-sample-paper');
  });

  test('sources are hittable as dots at L1', () => {
    expect(hitTest(qt(), at('wiki/papers/202611-sample-paper'), LEVEL_SCALE[1])?.id).toBe('wiki/papers/202611-sample-paper');
  });

  test('at L2 a source is hit anywhere on its card rectangle', () => {
    const k = LEVEL_SCALE[2];
    const paper = 'wiki/papers/202611-sample-paper';
    // Near the card's right edge, far outside the 6-unit dot.
    expect(hitTest(qt(), at(paper, (CARD_W / 2 - 4) / k, (CARD_H / 2 - 4) / k), k)?.id).toBe(paper);
    expect(hitTest(qt(), at(paper, (CARD_W / 2 + 4) / k, 0), k)?.id).not.toBe(paper);
  });

  test('a source wins over the concept it overlaps', () => {
    // At L2 the paper card covers part of context-compaction's droplet; on the paper's centre the paper wins.
    expect(hitTest(qt(), at('wiki/papers/202611-sample-paper'), LEVEL_SCALE[2])?.id).toBe('wiki/papers/202611-sample-paper');
  });

  test('entities are hittable only when shown', () => {
    const k = LEVEL_SCALE[1];
    const e = 'wiki/entities/demo-org';
    expect(hitTest(qt(), at(e), k)?.id).not.toBe(e);
    expect(hitTest(qt(), at(e), k, { showEntities: true })?.id).toBe(e);
  });

  test('nodes outside `visible` are skipped', () => {
    const k = LEVEL_SCALE[0];
    expect(hitTest(qt(), at('wiki/topics/agent'), k, { visible: new Set(['wiki/topics/memory']) })).toBeNull();
  });
});

describe('relatedSources', () => {
  test('concept: its source neighbours, newest first', () => {
    expect(relatedSources('wiki/concepts/context-compaction', g).map((n) => n.id)).toEqual(['wiki/papers/202611-sample-paper']);
  });
  test('topic: sources tagged with the topic or attached to its concepts, newest first', () => {
    expect(relatedSources('wiki/topics/context', g).map((n) => n.id)).toEqual([
      'wiki/papers/202611-sample-paper',
      'wiki/videos/20261101-demo-explainer',
    ]);
  });
  test('limit and empty cases', () => {
    expect(relatedSources('wiki/topics/memory', g)).toEqual([]);
    expect(relatedSources('wiki/concepts/nope', g)).toEqual([]);
    expect(relatedSources('wiki/topics/context', g, 0)).toEqual([]);
  });
  test('sorts by date desc and caps at 3', () => {
    const mk = (id: string, t: GNode['t'], d?: string): GNode => ({ id, t, l: id, s: '', tp: ['x'], d, x: 0, y: 0, r: 6 });
    const data: GraphData = {
      nodes: [
        mk('wiki/concepts/c', 'concept'),
        mk('wiki/papers/a', 'paper', '2026-01-01'),
        mk('wiki/blogs/b', 'blog', '2026-03-01'),
        mk('wiki/videos/v', 'video', '2026-02-01'),
        mk('wiki/podcasts/p', 'podcast'),
      ],
      edges: [1, 2, 3, 4].map((a) => ({ a, b: 0, r: 0 })),
      al: {},
    };
    expect(relatedSources('wiki/concepts/c', data).map((n) => n.id)).toEqual(['wiki/blogs/b', 'wiki/videos/v', 'wiki/papers/a']);
  });
});

describe('frameMembers (camera framing cluster)', () => {
  const idsOf = (ns: GNode[]) => ns.map((n) => n.id).sort();
  test('topic at L1: its concepts', () => {
    expect(idsOf(frameMembers(node('wiki/topics/context'), 1, g))).toEqual([
      'wiki/concepts/context-compaction',
      'wiki/concepts/isolated-idea',
    ]);
  });
  test('concept at L2: its neighbouring sources', () => {
    expect(idsOf(frameMembers(node('wiki/concepts/context-compaction'), 2, g))).toEqual([
      'wiki/papers/202611-sample-paper',
    ]);
  });
  test('anything else frames the node alone', () => {
    expect(frameMembers(node('wiki/topics/context'), 2, g)).toEqual([]);
    expect(frameMembers(node('wiki/topics/agent'), 0, g)).toEqual([]);
    expect(frameMembers(node('wiki/papers/202611-sample-paper'), 2, g)).toEqual([]);
  });
  test('respects the visible set', () => {
    expect(frameMembers(node('wiki/topics/context'), 1, g, new Set(['wiki/concepts/isolated-idea'])).map((n) => n.id)).toEqual([
      'wiki/concepts/isolated-idea',
    ]);
  });
});

describe('encodeView / decodeView', () => {
  test('encodes as #node=<id>&z=<n> with slashes kept', () => {
    expect(encodeView({ node: 'wiki/topics/context', z: 1 })).toBe('#node=wiki/topics/context&z=1');
    expect(encodeView({ z: 0 })).toBe('#z=0');
  });
  test('ids are percent-encoded apart from slashes', () => {
    const id = 'wiki/concepts/a&b=c d';
    const h = encodeView({ node: id, z: 2 });
    expect(h).toBe('#node=wiki/concepts/a%26b%3Dc%20d&z=2');
    expect(decodeView(h, new Set([id]))).toEqual({ node: id, z: 2 });
  });
  test('accepts encoded slashes and a missing leading #', () => {
    expect(decodeView('#node=wiki%2Ftopics%2Fcontext&z=2', ids)).toEqual({ node: 'wiki/topics/context', z: 2 });
    expect(decodeView('node=wiki/topics/context&z=1', ids)).toEqual({ node: 'wiki/topics/context', z: 1 });
  });
  test('clamps z to 0..2 and defaults it', () => {
    expect(decodeView('#node=wiki/topics/context&z=7', ids)).toEqual({ node: 'wiki/topics/context', z: 2 });
    expect(decodeView('#node=wiki/topics/context&z=-3', ids)).toEqual({ node: 'wiki/topics/context', z: 0 });
    expect(decodeView('#node=wiki/topics/context', ids)).toEqual({ node: 'wiki/topics/context', z: 0 });
    expect(decodeView('#node=wiki/topics/context&z=abc', ids)).toEqual({ z: 0 });
  });
  test('f=0 marks a view without focus and round-trips (Ruling R17)', () => {
    expect(encodeView({ node: 'wiki/topics/context', z: 1, f: 0 })).toBe('#node=wiki/topics/context&z=1&f=0');
    expect(decodeView('#node=wiki/topics/context&z=1&f=0', ids)).toEqual({ node: 'wiki/topics/context', z: 1, f: 0 });
    expect(decodeView(encodeView({ node: 'wiki/concepts/context-compaction', z: 2, f: 0 }), ids)).toEqual({
      node: 'wiki/concepts/context-compaction',
      z: 2,
      f: 0,
    });
    // Any other f value is ignored (focused view); f=0 with an unknown node is still L0.
    expect(decodeView('#node=wiki/topics/context&z=1&f=1', ids)).toEqual({ node: 'wiki/topics/context', z: 1 });
    expect(decodeView('#node=nope&z=1&f=0', ids)).toEqual({ z: 0 });
  });
  test('empty and node-less hashes are the L0 view', () => {
    expect(decodeView('', ids)).toEqual({ z: 0 });
    expect(decodeView('#', ids)).toEqual({ z: 0 });
    expect(decodeView('#z=2', ids)).toEqual({ z: 0 });
    expect(decodeView('#node=&z=1', ids)).toEqual({ z: 0 });
    expect(decodeView('#node=nope&z=2', ids)).toEqual({ z: 0 });
  });
});

describe('initialCamera (Ruling R16)', () => {
  const R = 44;
  // Topic label metrics from render.ts: label starts 8 px below the droplet, "N 份素材" line ends ~46 px below it.
  const LABEL_BELOW = 8 + 23 + 15;
  const check = (w: number, h: number, top: number) => {
    const c = initialCamera({ w, h, top }, R);
    const k = c.k;
    const [cx, cy] = worldToScreen(c, [0, 0]);
    expect(cx).toBeCloseTo(w / 2);
    expect(cy).toBeCloseTo((top + h) / 2);
    const rScreen = Math.max(R * k, MIN_SCREEN_R.topic);
    const [, topY] = worldToScreen(c, [0, -1000]);
    const [, botY] = worldToScreen(c, [0, 1000]);
    expect(topY - rScreen).toBeGreaterThanOrEqual(top);
    expect(botY + rScreen + LABEL_BELOW).toBeLessThanOrEqual(h);
    return c;
  };
  test('formula: min(0.35, (min(w, h - top) / 2 - 80) / (1000 + R))', () => {
    expect(initialCamera({ w: 1280, h: 720, top: 52 }, R).k).toBeCloseTo((668 / 2 - 80) / 1044);
    expect(initialCamera({ w: 4000, h: 3000, top: 52 }, R).k).toBe(LEVEL_SCALE[0]);
  });
  test('the ring and its labels fit below the bar on desktop and phones', () => {
    check(1280, 720, 52);
    check(1440, 900, 52);
    check(1280, 800, 52);
    check(375, 667, 52);
  });
  test('centre defaults to the origin and follows a given root position', () => {
    const c = initialCamera({ w: 800, h: 600, top: 0 }, R, [100, -50]);
    expect(worldToScreen(c, [100, -50])[0]).toBeCloseTo(400);
    expect(worldToScreen(c, [100, -50])[1]).toBeCloseTo(300);
  });
  test('tiny viewports clamp to K_MIN instead of going negative', () => {
    expect(initialCamera({ w: 100, h: 100, top: 52 }, R).k).toBe(K_MIN);
  });
});
