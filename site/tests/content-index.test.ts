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
