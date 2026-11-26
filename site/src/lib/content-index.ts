import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import { pageSchema, type PageFrontmatter, type PageType, type Rel } from './schema';
import type { z } from 'astro/zod';
import type { bySchema } from './schema';

type By = z.infer<typeof bySchema>;

export type PageId = string;

export interface Page {
  id: PageId;
  path: string;
  fm: PageFrontmatter;
  body: string;
  sections: Record<string, string>;
}

export interface Edge {
  from: PageId;
  to: PageId;
  rel: Rel;
  note?: string;
}

export interface RepoIndex {
  pages: Map<PageId, Page>;
  edges: Edge[];
  backlinks: Map<PageId, Edge[]>;
  redirects: Map<PageId, PageId>;
}

/**
 * Per-page summary written to `.generated/index.json` (Task 5's `prepare`
 * step). A JSON-serialisable projection of a `Page`'s frontmatter, trimmed
 * to what downstream build steps (graph, cards, search) need so they never
 * have to re-read `wiki/**` themselves.
 */
export interface PageInfo {
  id: PageId;
  type: PageType;
  title: string;
  summary: string;
  topics: string[];
  date?: string;
  venue?: string;
  duration?: number;
  url?: string;
  by: By[];
  sourceKey?: string;
  insights: string[];
  status?: string;
  root?: boolean;
  order?: number;
}

/**
 * The on-disk shape of `.generated/index.json`: a JSON-serialisable
 * projection of `RepoIndex` (Maps become plain objects so it round-trips
 * through `JSON.stringify`/`JSON.parse`).
 */
export interface GeneratedIndex {
  pages: Record<PageId, PageInfo>;
  edges: Edge[];
  backlinks: Record<PageId, Edge[]>;
  redirects: Record<PageId, PageId>;
}

/** Thrown by `loadRepo` when one or more pages fail validation; collects every problem found. */
export class ContentError extends Error {
  errors: string[];

  constructor(errors: string[]) {
    super(`content index has ${errors.length} error(s):\n${errors.join('\n')}`);
    this.name = 'ContentError';
    this.errors = errors;
  }
}

const WIKI_FILENAME_RE = /^[a-z0-9][a-z0-9.-]*\.md$/;

/**
 * Validate a page's `source_dir` frontmatter value. Returns an error
 * message string when invalid, `null` when valid. Rejects anything that
 * could let a path built from `source_dir` escape the repo root or the
 * site's output dirs: absolute paths, any `..` path segment, and anything
 * not rooted at `sources/` (every real value looks like
 * `sources/papers/2611.00001`).
 */
function validateSourceDir(sourceDir: string): string | null {
  if (path.posix.isAbsolute(sourceDir) || /^[a-zA-Z]:[\\/]/.test(sourceDir)) {
    return `must be a relative path under sources/, got absolute path ${sourceDir}`;
  }
  const segments = sourceDir.split(/[\\/]/);
  if (segments.includes('..') || segments.includes('.')) {
    return `must not contain "." or ".." path segments, got ${sourceDir}`;
  }
  if (!sourceDir.startsWith('sources/')) {
    return `must start with "sources/", got ${sourceDir}`;
  }
  return null;
}

/** One relation entry from a page's frontmatter `relations` list (see schema.ts). */
interface RelationLike {
  concept?: string;
  source?: string;
  topic?: string;
  rel: Rel;
  note?: string;
}

/**
 * Resolve a relation's target key (`concept`/`source`/`topic`) to a `PageId`.
 * `source:papers/x` → `wiki/papers/x`; `entity:x` (used by `by.entity`) → `wiki/entities/x`.
 */
export function resolveTarget(relation: RelationLike | { entity: string }): PageId {
  if ('concept' in relation && relation.concept !== undefined) {
    return `wiki/concepts/${relation.concept}`;
  }
  if ('topic' in relation && relation.topic !== undefined) {
    return `wiki/topics/${relation.topic}`;
  }
  if ('source' in relation && relation.source !== undefined) {
    return `wiki/${relation.source}`;
  }
  if ('entity' in relation && relation.entity !== undefined) {
    return `wiki/entities/${relation.entity}`;
  }
  throw new Error('relation has no resolvable target');
}

/**
 * Resolve a relative `.md` link found in a page body to a `PageId` + hash.
 * Returns `null` for external links (any scheme, e.g. `https://`) and for
 * non-`.md` targets (images, other assets).
 */
export function resolveLink(
  fromPath: PageId,
  href: string,
): { id: PageId; hash: string } | null {
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//')) {
    // external link (has a URL scheme, e.g. https:, mailto:)
    return null;
  }
  const hashIndex = href.indexOf('#');
  const hash = hashIndex === -1 ? '' : href.slice(hashIndex);
  const withoutHash = hashIndex === -1 ? href : href.slice(0, hashIndex);
  if (!withoutHash.endsWith('.md')) {
    return null;
  }
  const fromDir = path.posix.dirname(fromPath);
  const resolved = path.posix.normalize(path.posix.join(fromDir, withoutHash));
  const id = resolved.replace(/\.md$/, '');
  return { id, hash };
}

/**
 * Slugify a glossary term: lowercase, collapse runs of non `[a-z0-9]` chars
 * into a single `-`, then trim leading/trailing `-`.
 */
export function termSlug(term: string): string {
  return term
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Recursively collect `.md` file paths under `dir`, relative to `dir`. */
async function walkMarkdown(dir: string): Promise<string[]> {
  const out: string[] = [];
  async function recurse(current: string) {
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await recurse(full);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        out.push(path.relative(dir, full).split(path.sep).join('/'));
      }
    }
  }
  await recurse(dir);
  return out;
}

/** Split a page body into sections keyed by `## <heading>` text. Content before the first H2 is dropped. */
function splitSections(body: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const lines = body.split('\n');
  let currentHeading: string | null = null;
  let buffer: string[] = [];

  function flush() {
    if (currentHeading !== null) {
      sections[currentHeading] = buffer.join('\n').trim();
    }
  }

  for (const line of lines) {
    const match = /^##\s+(.+?)\s*$/.exec(line);
    if (match) {
      flush();
      currentHeading = match[1];
      buffer = [];
    } else {
      buffer.push(line);
    }
  }
  flush();

  return sections;
}

export async function loadRepo(root: string): Promise<RepoIndex> {
  const errors: string[] = [];
  const wikiDir = path.join(root, 'wiki');
  const relPaths = await walkMarkdown(wikiDir);

  interface Parsed {
    repoPath: PageId; // e.g. wiki/concepts/x
    fm: PageFrontmatter;
    body: string;
  }

  const parsed: Parsed[] = [];

  for (const relPath of relPaths) {
    const filename = path.posix.basename(relPath);
    const repoPath = `wiki/${relPath.replace(/\.md$/, '')}`;

    if (!WIKI_FILENAME_RE.test(filename)) {
      errors.push(`invalid filename (must match ^[a-z0-9][a-z0-9.-]*\\.md$): wiki/${relPath}`);
      continue;
    }

    const raw = await fs.readFile(path.join(wikiDir, relPath), 'utf8');
    const { data, content } = matter(raw);

    const result = pageSchema.safeParse(data);
    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push(`schema error in wiki/${relPath}: ${issue.path.join('.')} ${issue.message}`);
      }
      continue;
    }

    if ('source_dir' in result.data && typeof result.data.source_dir === 'string') {
      const sourceDirError = validateSourceDir(result.data.source_dir);
      if (sourceDirError !== null) {
        errors.push(`invalid source_dir in wiki/${relPath}: ${sourceDirError}`);
        continue;
      }
    }

    parsed.push({ repoPath, fm: result.data, body: content });
  }

  const pages = new Map<PageId, Page>();
  const redirects = new Map<PageId, PageId>();

  for (const item of parsed) {
    const redirectTo =
      'redirect_to' in item.fm && typeof item.fm.redirect_to === 'string'
        ? item.fm.redirect_to
        : undefined;
    if (redirectTo !== undefined) {
      const targetId = `wiki/concepts/${redirectTo}`;
      redirects.set(item.repoPath, targetId);
      continue;
    }
    pages.set(item.repoPath, {
      id: item.repoPath,
      path: `wiki/${item.repoPath.slice('wiki/'.length)}.md`,
      fm: item.fm,
      body: item.body,
      sections: splitSections(item.body),
    });
  }

  function pageTargetExists(id: PageId): boolean {
    return pages.has(id) || redirects.has(id);
  }

  /**
   * Follow a redirect chain to its final destination. Reports (via `errors`)
   * when the chain is broken (final target isn't a real page) or cyclic,
   * rather than looping forever or silently returning a dangling id. Each
   * redirect source is only diagnosed once (memoized) even if reached both
   * from the up-front sweep below and again while resolving an edge target.
   */
  const redirectDiagnosed = new Set<PageId>();
  function resolveRedirect(id: PageId): PageId {
    const seen = new Set<PageId>();
    let current = id;
    while (redirects.has(current)) {
      if (seen.has(current)) {
        if (!redirectDiagnosed.has(id)) {
          redirectDiagnosed.add(id);
          errors.push(`redirect cycle detected starting at wiki/${id.slice('wiki/'.length)}`);
        }
        return current;
      }
      seen.add(current);
      current = redirects.get(current)!;
    }
    if (!pages.has(current) && !redirectDiagnosed.has(id)) {
      redirectDiagnosed.add(id);
      errors.push(
        `redirect target does not exist: wiki/${id.slice('wiki/'.length)} -> ${current}`,
      );
    }
    return current;
  }

  // Validate every redirect's final destination up front (not just the ones
  // reached via an edge), so an unreferenced broken `redirect_to` still errors.
  for (const sourceId of redirects.keys()) {
    resolveRedirect(sourceId);
  }

  const edges: Edge[] = [];
  const backlinks = new Map<PageId, Edge[]>();

  function addBacklink(edge: Edge) {
    const list = backlinks.get(edge.to) ?? [];
    list.push(edge);
    backlinks.set(edge.to, list);
  }

  for (const [id, page] of pages) {
    if (page.fm.type === 'raw') {
      continue; // raw pages skip relation checks
    }

    const relations: RelationLike[] =
      'relations' in page.fm && Array.isArray(page.fm.relations) ? page.fm.relations : [];

    for (const relation of relations) {
      const targetId = resolveTarget(relation);
      if (!pageTargetExists(targetId)) {
        errors.push(
          `relation target does not exist: wiki/${id.slice('wiki/'.length)}.md -> ${targetId} (rel: ${relation.rel})`,
        );
        continue;
      }
      const resolvedTargetId = resolveRedirect(targetId);
      const edge: Edge = { from: id, to: resolvedTargetId, rel: relation.rel };
      if (relation.note !== undefined) {
        edge.note = relation.note;
      }
      edges.push(edge);
      addBacklink(edge);
    }

    const byList: Array<{ entity?: string; name?: string; role: string; bio?: string }> =
      'by' in page.fm && Array.isArray(page.fm.by) ? page.fm.by : [];

    for (const by of byList) {
      if (by.entity !== undefined) {
        const targetId = resolveTarget({ entity: by.entity });
        if (!pageTargetExists(targetId)) {
          errors.push(
            `by.entity target does not exist: wiki/${id.slice('wiki/'.length)}.md -> ${targetId}`,
          );
        }
      }
    }
  }

  if (errors.length > 0) {
    throw new ContentError(errors);
  }

  return { pages, edges, backlinks, redirects };
}
