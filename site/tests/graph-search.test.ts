/**
 * Task 13 graph-search tests: `searchNodes` (instant node search) and
 * `applyFilters` (type/date/rel/entity filters). The brief's pinned test
 * literals come first, verbatim, built on the real mini-repo graph data
 * (same fixture `graph-interaction.test.ts` uses) so ids/titles match the
 * brief's prose. Extra coverage for the binding decisions follows.
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { prepare } from '../scripts/prepare';
import type { GNode, GraphData } from '../src/graph/build';
import type { PageId } from '../src/lib/content-index';
import { applyFilters, DEFAULT_FILTERS, type Filters } from '../src/graph/filters';
import { searchNodes } from '../src/graph/search';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MINI = path.join(REPO_ROOT, 'tests/fixtures/mini-repo');

let g: GraphData;
let nodes: GNode[];
let al: Record<PageId, string[]>;
let tmp: string;

beforeAll(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'graph-search-test-'));
  await prepare({ root: MINI, siteDir: tmp });
  g = JSON.parse(await fs.readFile(path.join(tmp, 'public/data/graph.json'), 'utf8'));
  nodes = g.nodes;
  al = g.al;
});

afterAll(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

// A graph that additionally has an entity node, for the "entities hidden by
// default" test — the mini-repo fixture already has `wiki/entities/demo-org`.
const gWithEntity = (): GraphData => g;

// ---------------------------------------------------------- brief, verbatim

test('Chinese substring hits concept title', () =>
  expect(searchNodes('压缩', nodes, al)[0].id).toBe('wiki/concepts/context-compaction'));
test('alias match', () =>
  expect(
    searchNodes('compaction', nodes, { 'wiki/concepts/context-compaction': ['compaction'] })[0].id,
  ).toBe('wiki/concepts/context-compaction'));
test('topic ranks above source on tie', () =>
  expect(searchNodes('context', nodes, al).map((n) => n.t).slice(0, 1)).toEqual(['topic']));
test('empty query returns nothing', () => expect(searchNodes('  ', nodes, al)).toEqual([]));
test('entities hidden by default', () =>
  expect(applyFilters(gWithEntity(), DEFAULT_FILTERS).has('wiki/entities/demo-org')).toBe(false));
test('date range excludes later sources', () =>
  expect(applyFilters(g, { ...DEFAULT_FILTERS, to: '2026-10' }).has('wiki/papers/202611-sample-paper')).toBe(
    false,
  ));
test('concepts always visible', () =>
  expect(applyFilters(g, { ...DEFAULT_FILTERS, types: new Set() }).has('wiki/concepts/isolated-idea')).toBe(
    true,
  ));

// ------------------------------------------------------------------ extras

describe('searchNodes', () => {
  test('title prefix match outranks a mere contains match', () => {
    // "Context" is a topic title prefix; "Isolated Idea" merely contains no "context" substring,
    // so this only checks prefix vs contains using two nodes that both contain "context".
    const results = searchNodes('Context', nodes, al);
    expect(results[0].id).toBe('wiki/topics/context');
  });

  test('case-insensitive and NFKC-normalised', () => {
    expect(searchNodes('CONTEXT', nodes, al)[0].id).toBe('wiki/topics/context');
    // Fullwidth "Ｃontext" (NFKC-normalises the fullwidth C to ASCII) should match the same way.
    expect(searchNodes('Ｃontext', nodes, al)[0].id).toBe('wiki/topics/context');
  });

  test('summary-only contains match scores lowest but still included', () => {
    // "压缩" appears in context-compaction's title; "演示论文" appears only in the paper's summary.
    const results = searchNodes('演示论文', nodes, al);
    expect(results.map((n) => n.id)).toContain('wiki/papers/202611-sample-paper');
  });

  test('no match excludes the node entirely', () => {
    expect(searchNodes('zzzz-nonexistent-query', nodes, al)).toEqual([]);
  });

  test('whitespace-only or empty alias table never throws', () => {
    expect(searchNodes('context', nodes, {})).not.toEqual([]);
  });

  test('respects the limit parameter (default 8)', () => {
    expect(searchNodes('e', nodes, al).length).toBeLessThanOrEqual(8);
    expect(searchNodes('e', nodes, al, 2).length).toBeLessThanOrEqual(2);
  });

  test('entities are excluded unless explicitly included via a pre-filtered node list', () => {
    // main.ts is responsible for passing/excluding entities per filters.entities;
    // searchNodes itself just scores whatever node list it is given.
    const withoutEntities = nodes.filter((n) => n.t !== 'entity');
    expect(searchNodes('Demo Org', withoutEntities, al)).toEqual([]);
    expect(searchNodes('Demo Org', nodes, al)[0]?.id).toBe('wiki/entities/demo-org');
  });

  test('tie order: topic > concept > source types > entity, then title', () => {
    // Construct nodes that all score the same (title contains) for a shared substring.
    const mk = (id: string, t: GNode['t'], l: string): GNode => ({ id, t, l, s: '', tp: [], x: 0, y: 0, r: 1 });
    const testNodes: GNode[] = [
      mk('wiki/entities/zz-shared', 'entity', 'ZZ Shared Entity'),
      mk('wiki/papers/zz-shared', 'paper', 'ZZ Shared Paper'),
      mk('wiki/blogs/zz-shared', 'blog', 'ZZ Shared Blog'),
      mk('wiki/concepts/zz-shared', 'concept', 'ZZ Shared Concept'),
      mk('wiki/topics/zz-shared', 'topic', 'ZZ Shared Topic'),
    ];
    const results = searchNodes('shared', testNodes, {});
    expect(results.map((n) => n.t)).toEqual(['topic', 'concept', 'blog', 'paper', 'entity']);
  });

  test('title tie-break sorts alphabetically within the same type and score', () => {
    const mk = (id: string, l: string): GNode => ({ id, t: 'concept', l, s: '', tp: [], x: 0, y: 0, r: 1 });
    const testNodes: GNode[] = [mk('wiki/concepts/b', 'Bravo Shared'), mk('wiki/concepts/a', 'Alpha Shared')];
    expect(searchNodes('shared', testNodes, {}).map((n) => n.id)).toEqual(['wiki/concepts/a', 'wiki/concepts/b']);
  });
});

describe('applyFilters', () => {
  test('DEFAULT_FILTERS has all 4 source types and all rels selected, entities off', () => {
    expect(DEFAULT_FILTERS.types).toEqual(new Set(['paper', 'blog', 'video', 'podcast']));
    expect(DEFAULT_FILTERS.entities).toBe(false);
    expect(DEFAULT_FILTERS.rels.size).toBeGreaterThan(0);
  });

  test('root and topics are always visible regardless of filters', () => {
    const vis = applyFilters(g, { ...DEFAULT_FILTERS, types: new Set() });
    expect(vis.has('wiki/topics/agent')).toBe(true);
    expect(vis.has('wiki/topics/context')).toBe(true);
    expect(vis.has('wiki/topics/memory')).toBe(true);
  });

  test('type filter hides sources of excluded types', () => {
    const vis = applyFilters(g, { ...DEFAULT_FILTERS, types: new Set(['blog']) });
    expect(vis.has('wiki/papers/202611-sample-paper')).toBe(false);
    expect(vis.has('wiki/videos/20261101-demo-explainer')).toBe(false);
  });

  test('date range is inclusive at both ends, comparing YYYY-MM', () => {
    const paper = 'wiki/papers/202611-sample-paper'; // date: 2026-11-03
    expect(applyFilters(g, { ...DEFAULT_FILTERS, from: '2026-11', to: '2026-11' }).has(paper)).toBe(true);
    expect(applyFilters(g, { ...DEFAULT_FILTERS, from: '2026-12' }).has(paper)).toBe(false);
    expect(applyFilters(g, { ...DEFAULT_FILTERS, to: '2026-10' }).has(paper)).toBe(false);
    expect(applyFilters(g, { ...DEFAULT_FILTERS, from: '2026-11', to: '2026-12' }).has(paper)).toBe(true);
  });

  test('sources without a date are always kept regardless of the date range', () => {
    const mk = (id: string, t: GNode['t'], d?: string): GNode => ({ id, t, l: id, s: '', tp: [], d, x: 0, y: 0, r: 1 });
    const data: GraphData = {
      nodes: [mk('wiki/topics/agent', 'topic'), mk('wiki/papers/undated', 'paper')],
      edges: [],
      al: {},
    };
    const vis = applyFilters(data, { ...DEFAULT_FILTERS, from: '2030-01', to: '2030-12' });
    expect(vis.has('wiki/papers/undated')).toBe(true);
  });

  test('entities visible only when entities: true', () => {
    expect(applyFilters(g, { ...DEFAULT_FILTERS, entities: true }).has('wiki/entities/demo-org')).toBe(true);
    expect(applyFilters(g, { ...DEFAULT_FILTERS, entities: false }).has('wiki/entities/demo-org')).toBe(false);
  });

  test('always returns a fresh Set instance, independent of filters mutation', () => {
    const f: Filters = { ...DEFAULT_FILTERS, types: new Set(DEFAULT_FILTERS.types) };
    const vis1 = applyFilters(g, f);
    f.types.clear();
    const vis2 = applyFilters(g, f);
    expect(vis1).not.toBe(vis2);
    expect(vis1.has('wiki/papers/202611-sample-paper')).toBe(true);
    expect(vis2.has('wiki/papers/202611-sample-paper')).toBe(false);
  });

  test('isolated concept with no backlinks is still always visible', () => {
    expect(applyFilters(g, DEFAULT_FILTERS).has('wiki/concepts/isolated-idea')).toBe(true);
  });
});
