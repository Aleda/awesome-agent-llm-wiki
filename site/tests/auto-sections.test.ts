import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { VFile } from 'vfile';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { prepare } from '../scripts/prepare';
import { autoSections } from '../src/lib/auto-sections';
import { remarkWiki } from '../src/lib/remark-wiki';
import type { GeneratedIndex } from '../src/lib/content-index';

// vitest runs with cwd = site/, fixtures live at the repo root.
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MINI = path.join(REPO_ROOT, 'tests/fixtures/mini-repo');

let tmp: string;
let opts: { indexPath: string; anchorsDir: string };
let idx: GeneratedIndex;

beforeAll(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'auto-sections-test-'));
  await prepare({ root: MINI, siteDir: tmp });
  opts = {
    indexPath: path.join(tmp, '.generated/index.json'),
    anchorsDir: path.join(tmp, 'public/data/anchors'),
  };
  idx = JSON.parse(await fs.readFile(opts.indexPath, 'utf8'));
});

afterAll(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

async function md(markdown: string, filePath: string): Promise<string> {
  const file = new VFile({ value: markdown, path: filePath });
  const out = await unified()
    .use(remarkParse)
    .use(remarkWiki, opts)
    .use(remarkRehype)
    .use(rehypeStringify)
    .process(file);
  return String(out);
}

/**
 * Synthetic index with 12 source pages whose `topics` include `context`, to
 * exercise the "最近进展 caps at 10" rule (brief Step 1, `BIG_IDX`).
 */
const BIG_IDX: GeneratedIndex = (() => {
  const pages: GeneratedIndex['pages'] = {
    'wiki/topics/context': {
      id: 'wiki/topics/context',
      type: 'topic',
      title: 'Context',
      summary: '关于上下文管理的研究方向。',
      topics: [],
      by: [],
      insights: [],
    },
  };
  for (let i = 0; i < 12; i++) {
    const id = `wiki/papers/big-${i}`;
    pages[id] = {
      id,
      type: 'paper',
      title: `Big Paper ${i}`,
      summary: `测试论文 ${i}。`,
      topics: ['context'],
      by: [],
      insights: [],
      date: `2026-10-${String(i + 1).padStart(2, '0')}`,
    };
  }
  return { pages, edges: [], backlinks: {}, redirects: {} };
})();

describe('autoSections', () => {
  test('concept evolution sorted by date', () =>
    expect(
      autoSections('wiki/concepts/context-compaction', idx)['演化'].map((i) => i.date),
    ).toEqual(['2026-11-03', '2026-11-03']));

  test('source relations include incoming with arrow', () =>
    expect(
      autoSections('wiki/papers/202611-sample-paper', idx)['关系'].map((i) => i.rel),
    ).toContain('← 讲解'));

  test('topic recent progress caps at 10', () =>
    expect(autoSections('wiki/topics/context', BIG_IDX)['最近进展']).toHaveLength(10));

  test('empty topic gets empty list', () =>
    expect(autoSections('wiki/topics/memory', idx)['最近进展']).toEqual([]));

  test('entity lists its sources with first insight', () =>
    expect(autoSections('wiki/entities/demo-org', idx)['相关素材'][0].note).toBe(
      idx.pages['wiki/papers/202611-sample-paper'].insights[0],
    ));

  test('source relations outgoing then incoming, part-of excluded', () => {
    const items = autoSections('wiki/videos/20261101-demo-explainer', idx)['关系'];
    // the video's only relation is `explains -> paper`; no incoming edges for it.
    expect(items.map((i) => i.rel)).toEqual(['讲解']);
    expect(items[0].title).toBe(idx.pages['wiki/papers/202611-sample-paper'].title);
  });

  test('evolution note comes from the source relation note', () => {
    const items = autoSections('wiki/concepts/context-compaction', idx)['演化'];
    const challenged = items.find((i) => i.rel === '反驳');
    expect(challenged?.note).toBe('挑战旧方案的假设');
  });

  test('concept pages only produce 演化', () => {
    const sections = autoSections('wiki/concepts/context-compaction', idx);
    expect(Object.keys(sections)).toEqual(['演化']);
  });

  test('topic pages only produce 最近进展', () => {
    const sections = autoSections('wiki/topics/context', idx);
    expect(Object.keys(sections)).toEqual(['最近进展']);
  });

  test('entity pages only produce 相关素材', () => {
    const sections = autoSections('wiki/entities/demo-org', idx);
    expect(Object.keys(sections)).toEqual(['相关素材']);
  });

  test('source pages only produce 关系', () => {
    const sections = autoSections('wiki/papers/202611-sample-paper', idx);
    expect(Object.keys(sections)).toEqual(['关系']);
  });

  test('root topic has no 关系/最近进展 skip — still gets 最近进展 like other topics', () => {
    // root topics are topics too; only the section-set differs by page type.
    const sections = autoSections('wiki/topics/agent', idx);
    expect(Object.keys(sections)).toEqual(['最近进展']);
  });

  test('unknown page id produces no sections', () => {
    expect(autoSections('wiki/nope', idx)).toEqual({});
  });

  test('injected under existing empty heading, before next heading', async () => {
    const html = await md('## 定义\n\n一句话\n\n## 演化\n\n## 设计空间\n\n表', 'wiki/concepts/context-compaction.md');
    expect(html.indexOf('<li>')).toBeGreaterThan(html.indexOf('演化'));
    expect(html.indexOf('<li>')).toBeLessThan(html.indexOf('设计空间'));
  });

  test('appended when heading missing', async () =>
    expect(await md('## 新认知\n\n- x', 'wiki/papers/202611-sample-paper.md')).toMatch(
      /<h2[^>]*>关系<\/h2>/,
    ));

  test('injected list items carry data-preview on their links', async () => {
    const html = await md('## 定义\n\n一句话\n\n## 演化\n\n## 设计空间\n\n表', 'wiki/concepts/context-compaction.md');
    expect(html).toContain(
      'data-preview="/awesome-agent-llm-wiki/data/previews/wiki/papers/202611-sample-paper.json"',
    );
  });

  test('empty list renders 暂无', async () =>
    expect(await md('## 这个方向在解决什么\n\n（待录入）', 'wiki/topics/memory.md')).toMatch(
      /<h2[^>]*>最近进展<\/h2>\s*<p>暂无<\/p>/,
    ));

  test('non-empty existing heading is left untouched (no injection)', async () => {
    const html = await md(
      '## 演化\n\n已经手写的内容。\n\n## 设计空间\n\n表',
      'wiki/concepts/context-compaction.md',
    );
    expect(html).not.toContain('<li>');
    expect(html).toContain('已经手写的内容');
  });

  test('raw pages are not given any auto section', async () => {
    const html = await md('普通正文', 'wiki/glossary.md');
    expect(html).not.toMatch(/<h2[^>]*>(关系|演化|最近进展|相关素材)<\/h2>/);
  });
});
