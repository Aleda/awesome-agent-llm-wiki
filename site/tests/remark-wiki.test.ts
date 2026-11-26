import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkDirective from 'remark-directive';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { VFile } from 'vfile';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { prepare } from '../scripts/prepare';
import { remarkWiki } from '../src/lib/remark-wiki';
import { rehypeTranscript } from '../src/lib/rehype-transcript';

// vitest runs with cwd = site/, fixtures live at the repo root.
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MINI = path.join(REPO_ROOT, 'tests/fixtures/mini-repo');

let tmp: string;
let opts: { indexPath: string; anchorsDir: string };

beforeAll(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'remark-wiki-test-'));
  await prepare({ root: MINI, siteDir: tmp });
  opts = {
    indexPath: path.join(tmp, '.generated/index.json'),
    anchorsDir: path.join(tmp, 'public/data/anchors'),
  };
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
    .use(rehypeTranscript)
    .use(rehypeStringify)
    .process(file);
  return String(out);
}

describe('remarkWiki links', () => {
  test('internal link rewritten with hash and preview', async () => {
    const html = await md(
      '[c](../concepts/context-compaction.md#定义)',
      'wiki/papers/202611-sample-paper.md',
    );
    expect(html).toContain('href="/awesome-agent-llm-wiki/wiki/concepts/context-compaction/#定义"');
    expect(html).toContain(
      'data-preview="/awesome-agent-llm-wiki/data/previews/wiki/concepts/context-compaction.json"',
    );
  });

  test('external link and image untouched', async () => {
    const html = await md(
      '[a](https://arxiv.org/abs/1) ![f](../assets/f.png)',
      'wiki/papers/202611-sample-paper.md',
    );
    expect(html).toContain('href="https://arxiv.org/abs/1"');
    expect(html).toContain('src="../assets/f.png"');
  });

  test('link to redirected concept goes to new page', async () =>
    expect(await md('[o](../concepts/old-name.md)', 'wiki/papers/202611-sample-paper.md')).toContain(
      '/wiki/concepts/context-compaction/',
    ));

  test('missing internal link becomes text', async () =>
    expect(await md('[x](../concepts/nope.md)', 'wiki/papers/202611-sample-paper.md')).not.toContain(
      '<a',
    ));

  test('glossary link gets term preview', async () =>
    expect(
      await md('[B](../glossary.md#browsecomp-plus)', 'wiki/papers/202611-sample-paper.md'),
    ).toContain('data-term="browsecomp-plus"'));

  test('absolute Astro file path is normalized to the docs-relative id', async () => {
    const abs = path.join(tmp, 'src/content/docs/wiki/papers/202611-sample-paper.md');
    const html = await md('[c](../concepts/context-compaction.md)', abs);
    expect(html).toContain('href="/awesome-agent-llm-wiki/wiki/concepts/context-compaction/"');
  });

  test('link into sources/ keeps its hash', async () => {
    const html = await md(
      '[t](../../sources/videos/demo/20261101-abc/transcript.md#t-000102)',
      'wiki/videos/20261101-demo-explainer.md',
    );
    expect(html).toContain(
      'href="/awesome-agent-llm-wiki/sources/videos/demo/20261101-abc/transcript/#t-000102"',
    );
  });
});

describe('remarkWiki citations', () => {
  test('timestamp cites own transcript', async () =>
    expect(await md('一句话（[00:01:02]）', 'wiki/videos/20261101-demo-explainer.md')).toContain(
      '#t-000102',
    ));

  test('unknown anchor stays text', async () =>
    expect(
      await md('一句话（[09:09:09]）', 'wiki/videos/20261101-demo-explainer.md'),
    ).not.toContain('class="cite"'));

  test('来源 line switches source', async () =>
    expect(
      await md(
        '来源：[视频](../videos/20261101-demo-explainer.md)\n\n观点（[00:01:02]）',
        'wiki/concepts/context-compaction.md',
      ),
    ).toContain('#t-000102'));

  test('inline link in same parens sets source', async () =>
    expect(
      await md(
        '观点（[视频](../videos/20261101-demo-explainer.md) [00:01:02]）',
        'wiki/concepts/context-compaction.md',
      ),
    ).toContain('#t-000102'));

  test('paper anchor links to paper url', async () =>
    expect(await md('结论（§3.2）', 'wiki/papers/202611-sample-paper.md')).toMatch(
      /class="cite"[^>]*href="https:\/\/arxiv\.org/,
    ));

  test('cite link carries preview json path and key, visible text unchanged', async () => {
    const html = await md('结论（§3.2、Fig. 4）', 'wiki/papers/202611-sample-paper.md');
    expect(html).toContain(
      'data-preview="/awesome-agent-llm-wiki/data/anchors/sources/papers/2611.00001.json"',
    );
    expect(html).toContain('data-key="Fig. 4"');
    expect(html).toContain('>§3.2</a>');
    expect(html).toContain('结论（');
  });

  test('concept page without 来源 has no current source', async () =>
    expect(await md('观点（[00:01:02]）', 'wiki/concepts/context-compaction.md')).not.toContain(
      'class="cite"',
    ));

  test('same-paren link into sources/ sets the source', async () =>
    expect(
      await md(
        '观点（[转写](../../sources/videos/demo/20261101-abc/transcript.md) [00:01:02]）',
        'wiki/concepts/context-compaction.md',
      ),
    ).toContain('class="cite" href="/awesome-agent-llm-wiki/sources/videos/demo/20261101-abc/transcript/#t-000102"'));

  test('来源 link to a paper anchors page sets the source', async () =>
    expect(
      await md(
        '来源：[锚点](../../sources/papers/2611.00001/anchors.md)\n\n结论（§3.2）',
        'wiki/concepts/context-compaction.md',
      ),
    ).toMatch(/class="cite"[^>]*href="https:\/\/arxiv\.org/));
});

describe('index pages', () => {
  // mini-repo has no index pages; inject them into a copy of the generated index.
  let indexOpts: { indexPath: string; anchorsDir: string };

  beforeAll(async () => {
    const index = JSON.parse(await fs.readFile(opts.indexPath, 'utf8'));
    const base = { summary: '', topics: [], by: [], insights: [] };
    index.pages['wiki/index'] = { ...base, id: 'wiki/index', type: 'raw', title: '首页' };
    index.pages['wiki/topics/index'] = {
      ...base,
      id: 'wiki/topics/index',
      type: 'topic',
      title: '主题索引',
    };
    const indexPath = path.join(tmp, '.generated/index-with-index-pages.json');
    await fs.writeFile(indexPath, JSON.stringify(index), 'utf8');
    indexOpts = { ...opts, indexPath };
  });

  async function mdIndex(markdown: string, filePath: string): Promise<string> {
    const file = new VFile({ value: markdown, path: filePath });
    const out = await unified()
      .use(remarkParse)
      .use(remarkWiki, indexOpts)
      .use(remarkRehype)
      .use(rehypeStringify)
      .process(file);
    return String(out);
  }

  test('link to wiki/index.md goes to the directory route', async () =>
    expect(await mdIndex('[h](../index.md)', 'wiki/papers/202611-sample-paper.md')).toContain(
      'href="/awesome-agent-llm-wiki/wiki/"',
    ));

  test('index page preview stays keyed by page id', async () => {
    const html = await mdIndex('[t](../topics/index.md#a)', 'wiki/papers/202611-sample-paper.md');
    expect(html).toContain('href="/awesome-agent-llm-wiki/wiki/topics/#a"');
    expect(html).toContain('data-preview="/awesome-agent-llm-wiki/data/previews/wiki/topics/index.json"');
  });
});

describe('with remark-directive (as in Starlight)', () => {
  // Starlight enables remark-directive, which parses `:01` in `[00:01:02]` as a
  // bare text directive and splits the surrounding text node.
  async function mdDirective(markdown: string, filePath: string): Promise<string> {
    const file = new VFile({ value: markdown, path: filePath });
    const out = await unified()
      .use(remarkParse)
      .use(remarkDirective)
      .use(remarkWiki, opts)
      .use(remarkRehype)
      .use(rehypeTranscript)
      .use(rehypeStringify)
      .process(file);
    return String(out);
  }

  test('timestamp citation still links', async () => {
    const html = await mdDirective('一句话（[00:01:02]）', 'wiki/videos/20261101-demo-explainer.md');
    expect(html).toContain('>[00:01:02]</a>');
    expect(html).toContain('#t-000102');
  });

  test('transcript timestamps still get ids', async () => {
    const html = await mdDirective(
      '[00:00:00] 第一段\n[00:01:02] 第二段',
      'sources/videos/demo/20261101-abc/transcript.md',
    );
    expect(html).toContain('<p id="t-000000">[00:00:00] 第一段</p>');
    expect(html).toContain('<p id="t-000102">[00:01:02] 第二段</p>');
  });
});

describe('rehypeTranscript', () => {
  test('transcript paragraphs get timestamp ids', async () => {
    const html = await md(
      '[00:01:02] 第二段\n\n普通段落',
      'sources/videos/demo/20261101-abc/transcript.md',
    );
    expect(html).toContain('<p id="t-000102">');
    expect(html).not.toContain('<p id="t-">');
  });

  test('consecutive timestamp lines in one paragraph each get an id', async () => {
    const html = await md(
      '[00:00:00] 第一段\n[00:01:02] 第二段',
      'sources/videos/demo/20261101-abc/transcript.md',
    );
    expect(html).toContain('<p id="t-000000">[00:00:00] 第一段</p>');
    expect(html).toContain('<p id="t-000102">[00:01:02] 第二段</p>');
  });

  test('non-transcript pages are untouched', async () =>
    expect(await md('[00:01:02] 第二段', 'wiki/videos/20261101-demo-explainer.md')).not.toContain(
      'id="t-000102"',
    ));
});
