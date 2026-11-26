import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import {
  loadRepo,
  resolveTarget,
  resolveLink,
  termSlug,
  ContentError,
  type RepoIndex,
} from '../src/lib/content-index';
import { toRoute } from '../src/lib/routes';

// vitest runs with cwd = site/, fixtures live at the repo root.
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MINI = path.join(REPO_ROOT, 'tests/fixtures/mini-repo');
const BROKEN = path.join(REPO_ROOT, 'tests/fixtures/broken-repo');

/** Write a minimal valid topic page so a temp repo's concept pages have a `part-of` target. */
async function writeContextTopic(wikiDir: string) {
  await fs.mkdir(path.join(wikiDir, 'topics'), { recursive: true });
  await fs.writeFile(
    path.join(wikiDir, 'topics', 'context.md'),
    [
      '---',
      'title: Context',
      'type: topic',
      'summary: 临时测试主题。',
      'added: 2026-11-26',
      '---',
      '',
      '## 这个方向在解决什么',
      '',
      '## 概念地图',
      '',
      '## 关键争论',
      '',
      '## 最近进展',
      '',
    ].join('\n'),
  );
}

async function writeConcept(wikiDir: string, slug: string, extraFrontmatter: string) {
  await fs.mkdir(path.join(wikiDir, 'concepts'), { recursive: true });
  await fs.writeFile(
    path.join(wikiDir, 'concepts', `${slug}.md`),
    [
      '---',
      `title: ${slug}`,
      'type: concept',
      'summary: 临时测试概念。',
      'topics: [context]',
      'added: 2026-11-26',
      'status: emerging',
      extraFrontmatter,
      'relations:',
      '  - { topic: context, rel: part-of }',
      '---',
      '',
      '## 定义',
      '',
      '临时测试内容。',
      '',
      '## 演化',
      '',
      '## 设计空间',
      '',
      '## 共识与分歧',
      '',
      '## 开放问题',
      '',
    ].join('\n'),
  );
}

/** Write a minimal valid paper page with a given `source_dir`, so loadRepo can validate it. */
async function writePaper(wikiDir: string, slug: string, sourceDir: string) {
  await fs.mkdir(path.join(wikiDir, 'papers'), { recursive: true });
  await fs.writeFile(
    path.join(wikiDir, 'papers', `${slug}.md`),
    [
      '---',
      `title: ${slug}`,
      'type: paper',
      'summary: 临时测试论文。',
      'topics: [context]',
      'added: 2026-11-26',
      'date: 2026-11-03',
      'url: https://arxiv.org/abs/0000.00000',
      `source_dir: ${sourceDir}`,
      'venue: arXiv',
      'by: []',
      'relations:',
      '  - { topic: context, rel: proposes }',
      '---',
      '',
      '## 新认知',
      '',
      '- 临时测试内容。',
      '',
    ].join('\n'),
  );
}

/** Make a temp dir under the OS tmpdir with a `wiki/` subdir, auto-cleaned via `using`-style helper. */
async function makeTempRepo(): Promise<{ root: string; wikiDir: string; cleanup: () => Promise<void> }> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'content-index-test-'));
  const wikiDir = path.join(root, 'wiki');
  await fs.mkdir(wikiDir, { recursive: true });
  return {
    root,
    wikiDir,
    cleanup: () => fs.rm(root, { recursive: true, force: true }),
  };
}


describe('loadRepo on mini-repo', () => {
  let idx: RepoIndex;

  test('loads without throwing', async () => {
    idx = await loadRepo(MINI);
    expect(idx).toBeDefined();
  });

  test('page ids are repo-relative paths', async () => {
    idx = await loadRepo(MINI);
    expect(idx.pages.has('wiki/concepts/context-compaction')).toBe(true);
  });

  test('redirected relation resolves to new target', async () => {
    idx = await loadRepo(MINI);
    expect(idx.edges).toContainEqual(
      expect.objectContaining({
        from: 'wiki/papers/202611-sample-paper',
        to: 'wiki/concepts/context-compaction',
        rel: 'challenges',
      }),
    );
  });

  test('redirect pages are not in pages', async () => {
    idx = await loadRepo(MINI);
    expect(idx.redirects.get('wiki/concepts/old-name')).toBe('wiki/concepts/context-compaction');
    expect(idx.pages.has('wiki/concepts/old-name')).toBe(false);
  });

  test('backlinks are collected', async () => {
    idx = await loadRepo(MINI);
    expect(idx.backlinks.get('wiki/papers/202611-sample-paper')!.map((e) => e.rel)).toEqual([
      'explains',
    ]);
  });

  test('sections keyed by h2', async () => {
    idx = await loadRepo(MINI);
    expect(idx.pages.get('wiki/papers/202611-sample-paper')!.sections['新认知']).toMatch(/§3\.2/);
  });

  test('raw pages are included but skip relation checks', async () => {
    idx = await loadRepo(MINI);
    expect(idx.pages.has('wiki/glossary')).toBe(true);
    expect(idx.pages.get('wiki/glossary')!.fm.type).toBe('raw');
  });

  test('only wiki/**/*.md is read, not sources/', async () => {
    idx = await loadRepo(MINI);
    const sourcePages = [...idx.pages.keys()].filter((id) => id.startsWith('sources/'));
    expect(sourcePages).toHaveLength(0);
  });
});

describe('loadRepo on broken-repo', () => {
  test('broken repo reports all errors at once', async () => {
    const err = await loadRepo(BROKEN).catch((e) => e);
    expect(err).toBeInstanceOf(ContentError);
    expect(err.errors).toHaveLength(3);
  });
});

describe('loadRepo source_dir validation (temp fixtures, path traversal)', () => {
  test('source_dir with a ".." segment is an error, not a path escape', async () => {
    const { wikiDir, cleanup } = await makeTempRepo();
    try {
      await writeContextTopic(wikiDir);
      await writePaper(wikiDir, 'traversal-paper', '../../../../etc');

      const err = await loadRepo(path.dirname(wikiDir)).catch((e) => e);
      expect(err).toBeInstanceOf(ContentError);
      expect(err.errors).toHaveLength(1);
      expect(err.errors[0]).toMatch(/invalid source_dir/);
      expect(err.errors[0]).toMatch(/traversal-paper/);
    } finally {
      await cleanup();
    }
  });

  test('absolute source_dir is an error', async () => {
    const { wikiDir, cleanup } = await makeTempRepo();
    try {
      await writeContextTopic(wikiDir);
      await writePaper(wikiDir, 'absolute-paper', '/etc/passwd-dir');

      const err = await loadRepo(path.dirname(wikiDir)).catch((e) => e);
      expect(err).toBeInstanceOf(ContentError);
      expect(err.errors).toHaveLength(1);
      expect(err.errors[0]).toMatch(/invalid source_dir/);
    } finally {
      await cleanup();
    }
  });

  test('source_dir not rooted at sources/ is an error', async () => {
    const { wikiDir, cleanup } = await makeTempRepo();
    try {
      await writeContextTopic(wikiDir);
      await writePaper(wikiDir, 'wrong-root-paper', 'not-sources/papers/x');

      const err = await loadRepo(path.dirname(wikiDir)).catch((e) => e);
      expect(err).toBeInstanceOf(ContentError);
      expect(err.errors).toHaveLength(1);
      expect(err.errors[0]).toMatch(/invalid source_dir/);
    } finally {
      await cleanup();
    }
  });

  test('a normal sources/ source_dir is valid', async () => {
    const { wikiDir, cleanup } = await makeTempRepo();
    try {
      await writeContextTopic(wikiDir);
      await writePaper(wikiDir, 'valid-paper', 'sources/papers/0000.00000');

      const idx = await loadRepo(path.dirname(wikiDir));
      expect(idx.pages.has('wiki/papers/valid-paper')).toBe(true);
    } finally {
      await cleanup();
    }
  });
});

describe('loadRepo redirect validation (temp fixtures)', () => {
  test('redirect_to pointing at a nonexistent concept is an error', async () => {
    const { wikiDir, cleanup } = await makeTempRepo();
    try {
      await writeContextTopic(wikiDir);
      await writeConcept(wikiDir, 'dangling-redirect', 'redirect_to: nonexistent-target');

      const err = await loadRepo(path.dirname(wikiDir)).catch((e) => e);
      expect(err).toBeInstanceOf(ContentError);
      expect(err.errors).toHaveLength(1);
      expect(err.errors[0]).toMatch(/redirect target does not exist/);
      expect(err.errors[0]).toMatch(/dangling-redirect/);
      expect(err.errors[0]).toMatch(/nonexistent-target/);
    } finally {
      await cleanup();
    }
  });

  test('a redirect cycle is reported as an error, not an infinite loop', async () => {
    const { wikiDir, cleanup } = await makeTempRepo();
    try {
      await writeContextTopic(wikiDir);
      await writeConcept(wikiDir, 'cycle-a', 'redirect_to: cycle-b');
      await writeConcept(wikiDir, 'cycle-b', 'redirect_to: cycle-a');

      const err = await loadRepo(path.dirname(wikiDir)).catch((e) => e);
      expect(err).toBeInstanceOf(ContentError);
      expect(err.errors.some((e: string) => /redirect cycle detected/.test(e))).toBe(true);
    } finally {
      await cleanup();
    }
  });
});

describe('resolveTarget', () => {
  test('concept target', () => {
    expect(resolveTarget({ concept: 'x', rel: 'proposes' })).toBe('wiki/concepts/x');
  });
  test('topic target', () => {
    expect(resolveTarget({ topic: 'x', rel: 'part-of' })).toBe('wiki/topics/x');
  });
  test('source target', () => {
    expect(resolveTarget({ source: 'papers/x', rel: 'explains' })).toBe('wiki/papers/x');
  });
});

describe('resolveLink', () => {
  test('keeps hash', () => {
    expect(resolveLink('wiki/papers/a.md', '../concepts/x.md#定义')).toEqual({
      id: 'wiki/concepts/x',
      hash: '#定义',
    });
  });
  test('ignores external and images', () => {
    expect(resolveLink('wiki/papers/a.md', 'https://arxiv.org/abs/1')).toBeNull();
    expect(resolveLink('wiki/papers/a.md', '../assets/fig.png')).toBeNull();
  });
  test('resolves a link into sources/ (rendered transcript page) and keeps its hash', () => {
    expect(
      resolveLink(
        'wiki/concepts/x.md',
        '../../sources/videos/demo/20261101-abc/transcript.md#t-000102',
      ),
    ).toEqual({
      id: 'sources/videos/demo/20261101-abc/transcript',
      hash: '#t-000102',
    });
  });
});

describe('termSlug', () => {
  test('lowercase, dashes collapsed and trimmed', () => {
    expect(termSlug('BrowseComp-Plus')).toBe('browsecomp-plus');
    expect(termSlug('Claude Code')).toBe('claude-code');
    expect(termSlug('GRPO')).toBe('grpo');
  });
});

describe('toRoute', () => {
  test('builds route with base and hash', () => {
    expect(toRoute('wiki/concepts/x', '#a')).toBe('/awesome-agent-llm-wiki/wiki/concepts/x/#a');
  });
});
