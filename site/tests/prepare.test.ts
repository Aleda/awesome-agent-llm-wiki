import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import matter from 'gray-matter';
import { describe, expect, test, beforeAll, afterAll } from 'vitest';
import { prepare, stripInsight, defaultPositionsPath } from '../scripts/prepare';
import { ContentError } from '../src/lib/content-index';

// vitest runs with cwd = site/, fixtures live at the repo root.
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MINI = path.join(REPO_ROOT, 'tests/fixtures/mini-repo');
const BROKEN = path.join(REPO_ROOT, 'tests/fixtures/broken-repo');

function read(dir: string, rel: string): string {
  return fsSync.readFileSync(path.join(dir, rel), 'utf8');
}

describe('prepare on mini-repo', () => {
  let tmp: string;
  let index: any;

  beforeAll(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'prepare-test-'));
    await prepare({ root: MINI, siteDir: tmp });
    index = JSON.parse(read(tmp, '.generated/index.json'));
  });

  afterAll(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  test('transcripts become raw pages excluded from search', () => {
    expect(
      matter(read(tmp, 'src/content/docs/sources/videos/demo/20261101-abc/transcript.md')).data,
    ).toMatchObject({ type: 'raw', pagefind: false });
  });

  test('insights are stripped', () => {
    expect(index.pages['wiki/papers/202611-sample-paper'].insights[0]).not.toMatch(/[（*[]/);
  });

  test('preview json written', () => {
    expect(
      JSON.parse(read(tmp, 'public/data/previews/wiki/concepts/context-compaction.json')).type,
    ).toBe('concept');
  });

  test('transcript anchor href points to transcript page', () => {
    expect(
      JSON.parse(read(tmp, 'public/data/anchors/sources/videos/demo/20261101-abc.json'))[
        '00:01:02'
      ].href,
    ).toBe('/awesome-agent-llm-wiki/sources/videos/demo/20261101-abc/transcript/#t-000102');
  });

  test('glossary keyed by slug', () => {
    expect(JSON.parse(read(tmp, 'public/data/glossary.json'))['browsecomp-plus'].term).toBe(
      'BrowseComp-Plus',
    );
  });

  test('paper anchors.json href points to the paper url', () => {
    const anchors = JSON.parse(read(tmp, 'public/data/anchors/sources/papers/2611.00001.json'));
    expect(anchors['§3.2'].href).toBe('https://arxiv.org/abs/2611.00001');
    expect(anchors['§3.2'].text).toBe('we compact every 8 turns');
  });

  test('wiki files are copied byte-for-byte', () => {
    const original = fsSync.readFileSync(
      path.join(MINI, 'wiki/papers/202611-sample-paper.md'),
      'utf8',
    );
    const copied = read(tmp, 'src/content/docs/wiki/papers/202611-sample-paper.md');
    expect(copied).toBe(original);
  });

  test('raw pages are not written as previews', async () => {
    await expect(
      fs.access(path.join(tmp, 'public/data/previews/wiki/glossary.json')),
    ).rejects.toThrow();
  });

  test('sources anchors.md is copied with rewritten frontmatter', () => {
    const parsed = matter(
      read(tmp, 'src/content/docs/sources/papers/2611.00001/anchors.md'),
    );
    expect(parsed.data).toMatchObject({ type: 'raw', pagefind: false });
    expect(parsed.data.title).toBe('sources/papers/2611.00001 anchors');
    expect(parsed.data.raw).toEqual({});
  });

  test('index.pages includes sourceKey from frontmatter source_dir', () => {
    expect(index.pages['wiki/papers/202611-sample-paper'].sourceKey).toBe(
      'sources/papers/2611.00001',
    );
  });

  test('index.pages for a concept page has no sourceKey', () => {
    expect(index.pages['wiki/concepts/context-compaction'].sourceKey).toBeUndefined();
  });

  test('index.pages carries aliases from frontmatter', () => {
    expect(index.pages['wiki/concepts/context-compaction'].aliases).toEqual([
      'Context Compaction',
    ]);
  });

  test('index.pages omits aliases when frontmatter has none', () => {
    expect(index.pages['wiki/papers/202611-sample-paper'].aliases).toBeUndefined();
  });

  test('index has edges and backlinks records', () => {
    expect(
      index.edges.some(
        (e: any) =>
          e.from === 'wiki/papers/202611-sample-paper' &&
          e.to === 'wiki/concepts/context-compaction',
      ),
    ).toBe(true);
    expect(index.backlinks['wiki/papers/202611-sample-paper']).toBeDefined();
  });

  test('index has redirects record', () => {
    expect(index.redirects['wiki/concepts/old-name']).toBe('wiki/concepts/context-compaction');
  });
});

describe('prepare on broken-repo', () => {
  test('broken repo exits with all errors', async () => {
    const tmp2 = await fs.mkdtemp(path.join(os.tmpdir(), 'prepare-test-broken-'));
    try {
      await expect(prepare({ root: BROKEN, siteDir: tmp2 })).rejects.toThrow(ContentError);
    } finally {
      await fs.rm(tmp2, { recursive: true, force: true });
    }
  });
});

describe('prepare clears stale output', () => {
  test('removes previously generated files before writing', async () => {
    const tmp3 = await fs.mkdtemp(path.join(os.tmpdir(), 'prepare-test-clear-'));
    try {
      const staleDir = path.join(tmp3, 'src/content/docs');
      await fs.mkdir(staleDir, { recursive: true });
      await fs.writeFile(path.join(staleDir, 'stale.md'), 'stale');
      await prepare({ root: MINI, siteDir: tmp3 });
      await expect(fs.access(path.join(staleDir, 'stale.md'))).rejects.toThrow();
    } finally {
      await fs.rm(tmp3, { recursive: true, force: true });
    }
  });
});

describe('prepare carries paper code/pages and podcast show into PageInfo', () => {
  test('paper code/pages and podcast show survive into index.json', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'prepare-test-codeshow-root-'));
    const siteDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prepare-test-codeshow-site-'));
    try {
      await fs.mkdir(path.join(root, 'wiki/topics'), { recursive: true });
      await fs.writeFile(
        path.join(root, 'wiki/topics/agent.md'),
        [
          '---',
          'title: Agent',
          'type: topic',
          'summary: 根主题。',
          'added: 2026-11-26',
          'root: true',
          '---',
          '',
          '## 这个方向在解决什么',
          '',
        ].join('\n'),
      );

      await fs.mkdir(path.join(root, 'wiki/concepts'), { recursive: true });
      await fs.writeFile(
        path.join(root, 'wiki/concepts/demo-concept.md'),
        [
          '---',
          'title: Demo Concept',
          'type: concept',
          'summary: 临时测试概念。',
          'topics: [agent]',
          'added: 2026-11-26',
          'status: emerging',
          'relations:',
          '  - { topic: agent, rel: part-of }',
          '---',
          '',
          '## 定义',
          '',
          '临时测试内容。',
          '',
        ].join('\n'),
      );

      await fs.mkdir(path.join(root, 'sources/papers/0000.00000'), { recursive: true });
      await fs.writeFile(path.join(root, 'sources/papers/0000.00000/anchors.md'), '');

      await fs.mkdir(path.join(root, 'wiki/papers'), { recursive: true });
      await fs.writeFile(
        path.join(root, 'wiki/papers/demo-paper.md'),
        [
          '---',
          'title: Demo Paper',
          'type: paper',
          'summary: 临时测试论文。',
          'topics: [agent]',
          'added: 2026-11-26',
          'date: 2026-11-03',
          'url: https://arxiv.org/abs/0000.00000',
          'source_dir: sources/papers/0000.00000',
          'venue: arXiv',
          'code: https://github.com/example/demo',
          'pages: 31',
          'by: []',
          'relations:',
          '  - { concept: demo-concept, rel: proposes }',
          '---',
          '',
          '## 新认知',
          '',
          '- 临时测试要点。',
          '',
        ].join('\n'),
      );

      await fs.mkdir(path.join(root, 'sources/podcasts/demo/20261101-abc'), { recursive: true });
      await fs.writeFile(
        path.join(root, 'sources/podcasts/demo/20261101-abc/transcript.md'),
        '[00:00:00] 第一段开场\n',
      );

      await fs.mkdir(path.join(root, 'wiki/podcasts'), { recursive: true });
      await fs.writeFile(
        path.join(root, 'wiki/podcasts/demo-podcast.md'),
        [
          '---',
          'title: Demo Podcast',
          'type: podcast',
          'summary: 临时测试播客。',
          'topics: [agent]',
          'added: 2026-11-26',
          'date: 2026-11-01',
          'url: https://example.com/episode',
          'source_dir: sources/podcasts/demo/20261101-abc',
          'venue: 小宇宙',
          'show: 十字路口',
          'duration: 41',
          'by:',
          '  - { name: 主持人, role: host }',
          '  - { name: 嘉宾, role: guest }',
          'relations:',
          '  - { concept: demo-concept, rel: supports }',
          '---',
          '',
          '## 新认知',
          '',
          '- 临时测试要点。',
          '',
        ].join('\n'),
      );

      await prepare({ root, siteDir });
      const idx = JSON.parse(read(siteDir, '.generated/index.json'));
      expect(idx.pages['wiki/papers/demo-paper'].code).toBe('https://github.com/example/demo');
      expect(idx.pages['wiki/papers/demo-paper'].pages).toBe(31);
      expect(idx.pages['wiki/podcasts/demo-podcast'].show).toBe('十字路口');
    } finally {
      await fs.rm(root, { recursive: true, force: true });
      await fs.rm(siteDir, { recursive: true, force: true });
    }
  });
});

describe('prepare glossary fallback', () => {
  test('writes an empty glossary.json when wiki/glossary.md is missing', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'prepare-test-noglossary-root-'));
    const siteDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prepare-test-noglossary-site-'));
    try {
      // Minimal repo with no wiki/glossary.md at all.
      await fs.mkdir(path.join(root, 'wiki/topics'), { recursive: true });
      await fs.writeFile(
        path.join(root, 'wiki/topics/agent.md'),
        [
          '---',
          'title: Agent',
          'type: topic',
          'summary: 根主题。',
          'added: 2026-11-26',
          'root: true',
          '---',
          '',
          '## 这个方向在解决什么',
          '',
        ].join('\n'),
      );

      await prepare({ root, siteDir });
      expect(JSON.parse(read(siteDir, 'public/data/glossary.json'))).toEqual({});
    } finally {
      await fs.rm(root, { recursive: true, force: true });
      await fs.rm(siteDir, { recursive: true, force: true });
    }
  });
});

describe('stripInsight', () => {
  test('removes bold/italic/backtick markers', () => {
    expect(stripInsight('**bold** and *italic* and `code`')).toBe('bold and italic and code');
  });

  test('converts markdown links to plain text', () => {
    expect(stripInsight('see [concept page](../concepts/x.md#a)')).toBe('see concept page');
  });

  test('removes trailing full-width-paren citation group', () => {
    expect(stripInsight('一句判断（§3.2）')).toBe('一句判断');
  });

  test('removes trailing bracketed-timestamp citation group', () => {
    expect(stripInsight('补充说明（[00:01:02]）')).toBe('补充说明');
  });

  test('trims surrounding whitespace', () => {
    expect(stripInsight('  text here  ')).toBe('text here');
  });
});

describe('defaultPositionsPath', () => {
  const SITE_DIR = '.';

  test('CONTENT_ROOT unset uses the committed data/graph-positions.json', () => {
    expect(defaultPositionsPath(SITE_DIR, undefined)).toBe(
      path.join(SITE_DIR, 'data/graph-positions.json'),
    );
  });

  test("CONTENT_ROOT '..' (the documented default) uses data/graph-positions.json", () => {
    expect(defaultPositionsPath(SITE_DIR, '..')).toBe(
      path.join(SITE_DIR, 'data/graph-positions.json'),
    );
  });

  test("CONTENT_ROOT '../' (trailing slash) also resolves to the repo root", () => {
    expect(defaultPositionsPath(SITE_DIR, '../')).toBe(
      path.join(SITE_DIR, 'data/graph-positions.json'),
    );
  });

  test('an absolute path that resolves to the repo root also counts as real content', () => {
    const repoRoot = path.resolve(SITE_DIR, '..');
    expect(defaultPositionsPath(SITE_DIR, repoRoot)).toBe(
      path.join(SITE_DIR, 'data/graph-positions.json'),
    );
  });

  test('a fixture CONTENT_ROOT uses the .generated/ path, not the committed one', () => {
    expect(defaultPositionsPath(SITE_DIR, '../tests/fixtures/mini-repo')).toBe(
      path.join(SITE_DIR, '.generated/graph-positions.json'),
    );
  });
});
