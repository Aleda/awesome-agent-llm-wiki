import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, test, beforeAll, afterAll } from 'vitest';
import { prepare } from '../scripts/prepare';
import type { GeneratedIndex } from '../src/lib/content-index';
import { metaCard, sourceCard } from '../src/lib/page-info';
import type { CardRow } from '../src/lib/page-info';

// vitest runs with cwd = site/, fixtures live at the repo root.
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MINI = path.join(REPO_ROOT, 'tests/fixtures/mini-repo');

const PAPER = 'wiki/papers/202611-sample-paper';
const VIDEO = 'wiki/videos/20261101-demo-explainer';

const labels = (rows: CardRow[]) => rows.map((r) => r.label);

let tmp: string;
let idx: GeneratedIndex;

/**
 * A paper with 7 outgoing relations (one more than the 6-item cap) plus an
 * incoming `explains` backlink — 8 relations total — enough to exercise the
 * "related caps at 6, rest overflows" rule in both directions at once.
 */
const EIGHT_RELS = 'wiki/papers/eight-rels';

/** A paper with 12 authors, to exercise the >3-authors collapse rule. */
const MANY_AUTHORS = 'wiki/papers/many-authors';
const manyAuthorNames = [
  'Peter Belcak',
  'Saurav Muralidharan',
  'Jindong Jiang',
  'Author 4',
  'Author 5',
  'Author 6',
  'Author 7',
  'Author 8',
  'Author 9',
  'Author 10',
  'Author 11',
  'Author 12',
];

/** A podcast page, for the podcast source-card field set. */
const PODCAST = 'wiki/podcasts/demo-podcast';

/** A blog page, for the blog source-card field set. */
const BLOG = 'wiki/blogs/demo-blog';

/** A concept with two distinct source pages pointing at it, to pin the 来源数 leading number at a distinct-page count (ruling R5), not an edge count. */
const TWO_SOURCES_CONCEPT = 'wiki/concepts/two-sources';

let idx8: GeneratedIndex;
let idxA: GeneratedIndex;
let idxP: GeneratedIndex;
let idxB: GeneratedIndex;
let idx2Sources: GeneratedIndex;

beforeAll(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'page-info-test-'));
  await prepare({ root: MINI, siteDir: tmp });
  idx = JSON.parse(await fs.readFile(path.join(tmp, '.generated/index.json'), 'utf8'));

  idx8 = {
    pages: {
      ...idx.pages,
      [EIGHT_RELS]: {
        id: EIGHT_RELS,
        type: 'paper',
        title: 'Eight Relations Paper',
        summary: '一篇有 8 条关系的测试论文。',
        topics: ['context'],
        by: [],
        insights: [],
        date: '2026-11-05',
        venue: 'arXiv',
        url: 'https://arxiv.org/abs/2611.00099',
        sourceKey: 'sources/papers/2611.00099',
      },
      'wiki/concepts/c1': {
        id: 'wiki/concepts/c1',
        type: 'concept',
        title: 'Concept One',
        summary: '测试概念 1。',
        topics: ['context'],
        by: [],
        insights: [],
        status: 'emerging',
      },
      'wiki/concepts/c2': {
        id: 'wiki/concepts/c2',
        type: 'concept',
        title: 'Concept Two',
        summary: '测试概念 2。',
        topics: ['context'],
        by: [],
        insights: [],
        status: 'emerging',
      },
      'wiki/concepts/c3': {
        id: 'wiki/concepts/c3',
        type: 'concept',
        title: 'Concept Three',
        summary: '测试概念 3。',
        topics: ['context'],
        by: [],
        insights: [],
        status: 'emerging',
      },
    },
    edges: [
      { from: EIGHT_RELS, to: 'wiki/concepts/c1', rel: 'proposes' },
      { from: EIGHT_RELS, to: 'wiki/concepts/c2', rel: 'extends' },
      { from: EIGHT_RELS, to: 'wiki/concepts/c3', rel: 'supports' },
      { from: EIGHT_RELS, to: 'wiki/concepts/context-compaction', rel: 'challenges' },
      { from: EIGHT_RELS, to: 'wiki/concepts/c1', rel: 'applies' },
      { from: EIGHT_RELS, to: 'wiki/papers/202611-sample-paper', rel: 'responds' },
      { from: EIGHT_RELS, to: 'wiki/concepts/c2', rel: 'alternative-to' },
    ],
    backlinks: {
      [EIGHT_RELS]: [
        { from: 'wiki/videos/20261101-demo-explainer', to: EIGHT_RELS, rel: 'explains' },
      ],
    },
    redirects: {},
  };

  idxA = {
    pages: {
      [MANY_AUTHORS]: {
        id: MANY_AUTHORS,
        type: 'paper',
        title: 'Many Authors Paper',
        summary: '一篇有很多作者的测试论文。',
        topics: ['context'],
        by: [
          ...manyAuthorNames.map((name) => ({ name, role: 'author' as const })),
          { name: 'Example Labs', role: 'org' as const },
        ],
        insights: [],
        date: '2026-11-06',
        venue: 'arXiv',
        url: 'https://arxiv.org/abs/2611.00098',
        sourceKey: 'sources/papers/2611.00098',
      },
    },
    edges: [],
    backlinks: {},
    redirects: {},
  };

  idxP = {
    pages: {
      [PODCAST]: {
        id: PODCAST,
        type: 'podcast',
        title: 'Demo Podcast',
        summary: '一期测试播客。',
        topics: ['context'],
        by: [
          { name: '主持人', role: 'host' },
          { name: '嘉宾', role: 'guest', bio: '测试机构创始人' },
        ],
        insights: [],
        date: '2026-11-07',
        venue: '小宇宙',
        show: '十字路口',
        duration: 41,
        url: 'https://www.xiaoyuzhoufm.com/episode/demo',
        sourceKey: 'sources/podcasts/demo/20261107-xyz',
      },
    },
    edges: [],
    backlinks: {},
    redirects: {},
  };

  idxB = {
    pages: {
      [BLOG]: {
        id: BLOG,
        type: 'blog',
        title: 'Demo Blog Post',
        summary: '一篇测试 blog。',
        topics: ['context'],
        by: [
          { name: 'Someone', role: 'author' },
          { name: 'Example Labs', role: 'org' },
        ],
        insights: [],
        date: '2026-11-08',
        venue: 'Anthropic Blog',
        url: 'https://example.com/blog/demo',
        sourceKey: 'sources/blogs/demo/20261108-demo',
      },
    },
    edges: [],
    backlinks: {},
    redirects: {},
  };

  idx2Sources = {
    pages: {
      [TWO_SOURCES_CONCEPT]: {
        id: TWO_SOURCES_CONCEPT,
        type: 'concept',
        title: 'Two Sources Concept',
        summary: '一个有两篇不同素材指向的测试概念。',
        topics: ['context'],
        by: [],
        insights: [],
        status: 'established',
      },
      'wiki/papers/source-one': {
        id: 'wiki/papers/source-one',
        type: 'paper',
        title: 'Source One',
        summary: '第一篇测试素材。',
        topics: ['context'],
        by: [],
        insights: [],
        date: '2026-11-09',
        venue: 'arXiv',
        url: 'https://arxiv.org/abs/2611.00097',
        sourceKey: 'sources/papers/2611.00097',
      },
      'wiki/papers/source-two': {
        id: 'wiki/papers/source-two',
        type: 'paper',
        title: 'Source Two',
        summary: '第二篇测试素材。',
        topics: ['context'],
        by: [],
        insights: [],
        date: '2026-11-10',
        venue: 'arXiv',
        url: 'https://arxiv.org/abs/2611.00096',
        sourceKey: 'sources/papers/2611.00096',
      },
    },
    edges: [
      { from: 'wiki/papers/source-one', to: TWO_SOURCES_CONCEPT, rel: 'proposes' },
      { from: 'wiki/papers/source-two', to: TWO_SOURCES_CONCEPT, rel: 'supports' },
    ],
    backlinks: {
      [TWO_SOURCES_CONCEPT]: [
        { from: 'wiki/papers/source-one', to: TWO_SOURCES_CONCEPT, rel: 'proposes' },
        { from: 'wiki/papers/source-two', to: TWO_SOURCES_CONCEPT, rel: 'supports' },
      ],
    },
    redirects: {},
  };
});

afterAll(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe('metaCard', () => {
  test('paper meta card rows', () => {
    expect(labels(metaCard(PAPER, idx))).toEqual(['类型', '方向', '出自', '相关']);
  });

  test('type row shows month', () => {
    expect(metaCard(PAPER, idx)[0].items[0].text).toBe('论文 · 2026-11');
  });

  test('related shows outgoing rel and incoming backlink', () => {
    const rel = metaCard(PAPER, idx)[3].items;
    expect(rel).toContainEqual(expect.objectContaining({ rel: '提出', incoming: false }));
    expect(rel).toContainEqual(expect.objectContaining({ rel: '讲解', incoming: true }));
  });

  test('related caps at 6 with overflow', () => {
    const r = metaCard(EIGHT_RELS, idx8)[3];
    expect(r.items).toHaveLength(6);
    expect(r.overflow).toHaveLength(2);
  });

  test('concept card counts relations (distinct source pages, ruling R5)', () => {
    const rows = metaCard('wiki/concepts/context-compaction', idx);
    expect(labels(rows)).toEqual(['定义', '所属主题', '来源数']);
    // The mini-repo's single paper has both a proposes and a challenges
    // edge into this concept: one distinct source page, two relations.
    expect(rows[2].items[0].text).toBe('1（提出 1 · 反驳 1）');
  });

  test('concept card counts distinct source pages, not edges', () => {
    const rows = metaCard('wiki/concepts/two-sources', idx2Sources);
    expect(rows[2].items[0].text).toBe('2（提出 1 · 支持 1）');
  });

  test('isolated concept shows zero', () => {
    expect(metaCard('wiki/concepts/isolated-idea', idx)[2].items[0].text).toBe('0');
  });

  test('topic card rows are 定义/概念数/来源数 (R4)', () => {
    expect(labels(metaCard('wiki/topics/context', idx))).toEqual(['定义', '概念数', '来源数']);
  });

  test('topic card counts concepts part-of it', () => {
    const rows = metaCard('wiki/topics/context', idx);
    // wiki/concepts/context-compaction and wiki/concepts/isolated-idea are
    // both part-of wiki/topics/context in the mini-repo fixture.
    expect(rows[1].items[0].text).toBe('2');
  });

  test('topic 来源数 counts only source pages, never concepts tagged with the topic', () => {
    // context: the paper and the video carry `topics: [context]`; the three
    // concepts also do, but they are not sources.
    expect(metaCard('wiki/topics/context', idx)[2].items[0].text).toBe('2');
  });

  test('topic 来源数 counts a source linked to a part-of concept even without the topic tag', () => {
    const id = 'wiki/papers/untagged';
    const edge = { from: id, to: 'wiki/concepts/context-compaction', rel: 'supports' as const };
    const idxU: GeneratedIndex = {
      ...idx,
      pages: {
        ...idx.pages,
        [id]: { ...idx.pages[PAPER], id, title: 'Untagged', topics: [] },
      },
      edges: [...idx.edges, edge],
    };
    expect(metaCard('wiki/topics/context', idxU)[2].items[0].text).toBe('3');
  });

  test('empty topic shows zero concepts and zero sources', () => {
    const rows = metaCard('wiki/topics/memory', idx);
    expect(rows[1].items[0].text).toBe('0');
    expect(rows[2].items[0].text).toBe('0');
  });
});

describe('sourceCard', () => {
  test('paper source card omits 作者 when by has no individual entries (ruling R6)', () => {
    // The mini-repo paper's `by` has only a `role: org` entry (demo-org),
    // no individual author — 作者 must be omitted, not fall back to org names.
    expect(labels(sourceCard(PAPER, idx))).toEqual(['机构', '发表', '链接', '总结']);
  });

  test('many authors collapse, full row set with an individual author present', () => {
    expect(labels(sourceCard(MANY_AUTHORS, idxA))).toEqual([
      '作者',
      '机构',
      '发表',
      '链接',
      '总结',
    ]);
    expect(sourceCard(MANY_AUTHORS, idxA)[0].items[0].text).toBe(
      'Peter Belcak、Saurav Muralidharan、Jindong Jiang 等 12 人',
    );
  });

  test('podcast source card', () => {
    expect(labels(sourceCard(PODCAST, idxP))).toEqual([
      '节目',
      '主持',
      '嘉宾',
      '时长',
      '平台',
      '总结',
    ]);
  });

  test('blog source card', () => {
    expect(labels(sourceCard(BLOG, idxB))).toEqual(['作者', '机构', '发布', '链接', '总结']);
  });

  test('video source card', () => {
    expect(labels(sourceCard(VIDEO, idx))).toEqual(['讲者', '平台', '时长', '讲解对象', '总结']);
  });
});
