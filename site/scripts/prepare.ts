#!/usr/bin/env -S node
/**
 * Build-time "prepare" step (Task 5). Reads `wiki/**` via `loadRepo`, then
 * writes everything downstream build/UI steps need so they never re-scan
 * the repo themselves:
 *
 * - `<siteDir>/src/content/docs/wiki/**`        — wiki pages copied as-is.
 * - `<siteDir>/src/content/docs/sources/**`     — only `transcript.md` and
 *   `anchors.md`, frontmatter rewritten to `{ title, type: 'raw',
 *   pagefind: false, raw: <original frontmatter> }`.
 * - `<siteDir>/.generated/index.json`           — a `GeneratedIndex`.
 * - `<siteDir>/public/data/previews/<PageId>.json` — one per non-raw page.
 * - `<siteDir>/public/data/anchors/<source_dir>.json` — one per source_dir
 *   that some wiki page actually references.
 * - `<siteDir>/public/data/glossary.json`       — term -> { term, text }.
 * - `<siteDir>/public/data/graph.json`          — compact `GraphData`
 *   (Task 10), coordinates computed once at build time with d3-force.
 * - `<siteDir>/data/graph-positions.json` (or `positionsPath`, see
 *   `PrepareOptions`) — every graph node's `[x, y]`, read back on the next
 *   run so existing nodes barely move when content is added.
 *
 * Output dirs (`src/content/docs/`, `public/data/`, `.generated/`, all
 * under `siteDir`) are cleared at the start of every run so stale pages
 * never linger after a page is deleted upstream.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import matter from 'gray-matter';
import {
  loadRepo,
  termSlug,
  ContentError,
  type Edge,
  type Page,
  type PageId,
  type PageInfo,
  type GeneratedIndex,
} from '../src/lib/content-index';
import { toRoute } from '../src/lib/routes';
import { parseTranscriptAnchors, parseAnchorsMd } from '../src/lib/anchors';
import { buildGraph } from '../src/graph/build';

/**
 * Resolve `candidate` (relative or absolute) against `base` and assert the
 * result stays inside `base`. `loadRepo` already rejects a `source_dir`
 * that is absolute or has a `..` segment, so this is a second,
 * independent check at the point every content-derived path is actually
 * used for I/O — defense in depth against any value (current or future)
 * that reaches here without going through that validation. Returns the
 * resolved absolute path; throws if it escapes `base`.
 */
function within(base: string, candidate: string): string {
  const resolvedBase = path.resolve(base);
  const resolvedCandidate = path.resolve(base, candidate);
  const relative = path.relative(resolvedBase, resolvedCandidate);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`path escapes ${resolvedBase}: ${candidate}`);
  }
  return resolvedCandidate;
}

/**
 * Strip an insight bullet (from `## 新认知`) down to plain prose:
 * `**bold**`/`*italic*`/`` `code` `` markers are removed, `[text](url)`
 * markdown links become `text`, and full-width-paren citation groups
 * `（…）` (the anchor the bullet cites) are dropped, then the result is
 * trimmed.
 */
export function stripInsight(md: string): string {
  let s = md;
  s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
  s = s.replace(/[*`]/g, '');
  s = s.replace(/（[^（）]*）/g, '');
  s = s.replace(/[ \t]+([，。])/g, '$1');
  return s.trim();
}

/** Top-level `- ` bullets in a section body (no nested/indented bullets). */
function topLevelBullets(sectionBody: string): string[] {
  return sectionBody
    .split('\n')
    .filter((line) => /^-\s+/.test(line))
    .map((line) => line.replace(/^-\s+/, ''));
}

/** First 3 `## 新认知` bullets, stripped to plain prose. */
function extractInsights(page: Page): string[] {
  const section = page.sections['新认知'];
  if (section === undefined) return [];
  return topLevelBullets(section).slice(0, 3).map(stripInsight);
}

/** Project a `Page` down to the `PageInfo` shape written into index.json. */
function toPageInfo(page: Page): PageInfo {
  const fm = page.fm as Record<string, unknown>;
  const info: PageInfo = {
    id: page.id,
    type: page.fm.type,
    title: page.fm.title,
    summary: 'summary' in page.fm ? (fm.summary as string) : '',
    topics: 'topics' in page.fm && Array.isArray(fm.topics) ? (fm.topics as string[]) : [],
    by: 'by' in page.fm && Array.isArray(fm.by) ? (fm.by as PageInfo['by']) : [],
    insights: extractInsights(page),
  };
  if (typeof fm.date === 'string') info.date = fm.date;
  if (typeof fm.venue === 'string') info.venue = fm.venue;
  if (typeof fm.duration === 'number') info.duration = fm.duration;
  if (typeof fm.url === 'string') info.url = fm.url;
  if (typeof fm.source_dir === 'string') info.sourceKey = fm.source_dir;
  if (typeof fm.status === 'string') info.status = fm.status;
  if (typeof fm.root === 'boolean') info.root = fm.root;
  if (typeof fm.order === 'number') info.order = fm.order;
  if (typeof fm.code === 'string') info.code = fm.code;
  if (typeof fm.pages === 'number') info.pages = fm.pages;
  if (typeof fm.show === 'string') info.show = fm.show;
  if ('aliases' in fm && Array.isArray(fm.aliases) && fm.aliases.length > 0) {
    info.aliases = fm.aliases as string[];
  }
  return info;
}

/** Recursively copy `wiki/**` into `<siteDir>/src/content/docs/wiki/**`, byte-for-byte. */
async function copyWikiTree(root: string, siteDir: string): Promise<void> {
  const srcDir = path.join(root, 'wiki');
  const destDir = path.join(siteDir, 'src/content/docs/wiki');

  async function recurse(current: string, destCurrent: string) {
    const entries = await fs.readdir(current, { withFileTypes: true });
    await fs.mkdir(destCurrent, { recursive: true });
    for (const entry of entries) {
      const srcPath = path.join(current, entry.name);
      const destPath = path.join(destCurrent, entry.name);
      if (entry.isDirectory()) {
        await recurse(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }

  await recurse(srcDir, destDir);
}

/**
 * Copy `transcript.md`/`anchors.md` for every `source_dir` referenced by
 * some wiki page into `<siteDir>/src/content/docs/sources/**`, rewriting
 * frontmatter to `{ title, type: 'raw', pagefind: false, raw }`.
 */
async function copySourceRawFiles(
  root: string,
  siteDir: string,
  sourceDirs: Set<string>,
): Promise<void> {
  for (const sourceDir of sourceDirs) {
    for (const filename of ['transcript.md', 'anchors.md']) {
      const srcPath = within(root, path.join(sourceDir, filename));
      let raw: string;
      try {
        raw = await fs.readFile(srcPath, 'utf8');
      } catch {
        continue; // missing file for this source_dir: skip silently (lint reports it)
      }
      const parsed = matter(raw);
      const title =
        typeof parsed.data.title === 'string' ? parsed.data.title : `${sourceDir} anchors`;
      const rewritten = matter.stringify(parsed.content, {
        title,
        type: 'raw',
        pagefind: false,
        raw: parsed.data,
      });
      const destPath = within(
        path.join(siteDir, 'src/content/docs'),
        path.join(sourceDir, filename),
      );
      await fs.mkdir(path.dirname(destPath), { recursive: true });
      await fs.writeFile(destPath, rewritten, 'utf8');
    }
  }
}

/** Write `public/data/previews/<PageId>.json` for every non-`raw` page. */
async function writePreviews(
  siteDir: string,
  pages: Map<PageId, Page>,
  pageInfos: Record<PageId, PageInfo>,
): Promise<void> {
  for (const [id, page] of pages) {
    if (page.fm.type === 'raw') continue;
    const info = pageInfos[id];
    const preview: Record<string, unknown> = {
      id: info.id,
      type: info.type,
      title: info.title,
      summary: info.summary,
      topics: info.topics,
    };
    if (info.insights.length > 0) preview.insight = info.insights[0];
    const destPath = within(path.join(siteDir, 'public/data/previews'), `${id}.json`);
    await fs.mkdir(path.dirname(destPath), { recursive: true });
    await fs.writeFile(destPath, JSON.stringify(preview), 'utf8');
  }
}

/**
 * Write `public/data/anchors/<source_dir>.json` for every `source_dir`
 * referenced by some wiki page. A transcript source builds its anchor map
 * from `<source_dir>/transcript.md` (href points into the rendered
 * transcript page); a paper/blog source builds it from
 * `<source_dir>/anchors.md` (href is the page's `url`). A source_dir with
 * neither file present is skipped silently — lint reports it later.
 */
async function writeAnchorFiles(
  root: string,
  siteDir: string,
  pages: Map<PageId, Page>,
): Promise<void> {
  for (const [id, page] of pages) {
    const fm = page.fm as Record<string, unknown>;
    const sourceDir = typeof fm.source_dir === 'string' ? fm.source_dir : undefined;
    if (sourceDir === undefined) continue;

    const anchors: Record<string, { text: string; href: string }> = {};

    if (page.fm.type === 'video' || page.fm.type === 'podcast') {
      const transcriptPath = within(root, path.join(sourceDir, 'transcript.md'));
      let raw: string;
      try {
        raw = await fs.readFile(transcriptPath, 'utf8');
      } catch {
        continue; // no transcript for this source_dir: skip silently
      }
      const transcriptId = `${sourceDir}/transcript`;
      const parsedAnchors = parseTranscriptAnchors(raw);
      for (const [key, text] of parsedAnchors) {
        const hhmmss = key.replace(/:/g, '');
        anchors[key] = { text, href: toRoute(transcriptId, `#t-${hhmmss}`) };
      }
    } else if (page.fm.type === 'paper' || page.fm.type === 'blog') {
      const anchorsMdPath = within(root, path.join(sourceDir, 'anchors.md'));
      let raw: string;
      try {
        raw = await fs.readFile(anchorsMdPath, 'utf8');
      } catch {
        continue; // no anchors.md for this source_dir: skip silently
      }
      const href = typeof fm.url === 'string' ? fm.url : '';
      const parsedAnchors = parseAnchorsMd(raw);
      for (const [key, text] of parsedAnchors) {
        anchors[key] = { text, href };
      }
    } else {
      continue;
    }

    const destPath = within(path.join(siteDir, 'public/data/anchors'), `${sourceDir}.json`);
    await fs.mkdir(path.dirname(destPath), { recursive: true });
    await fs.writeFile(destPath, JSON.stringify(anchors), 'utf8');
  }
}

/**
 * Parse `wiki/glossary.md`'s body into `public/data/glossary.json`. Always
 * writes the file, even as `{}` when `wiki/glossary.md` is missing, so a
 * hover-card fetch for a term never 404s.
 */
async function writeGlossary(root: string, siteDir: string): Promise<void> {
  const glossaryPath = path.join(root, 'wiki/glossary.md');
  const glossary: Record<string, { term: string; text: string }> = {};

  let raw: string | undefined;
  try {
    raw = await fs.readFile(glossaryPath, 'utf8');
  } catch {
    raw = undefined; // no glossary in this repo: still write {}
  }

  if (raw !== undefined) {
    const { content } = matter(raw);
    const lines = content.split('\n');
    let currentTerm: string | null = null;
    let buffer: string[] = [];

    const flush = () => {
      if (currentTerm === null) return;
      const text = stripInsight(buffer.join('\n').trim());
      glossary[termSlug(currentTerm)] = { term: currentTerm, text };
    };

    for (const line of lines) {
      const heading = /^##\s+(.+?)\s*$/.exec(line);
      if (heading) {
        flush();
        currentTerm = heading[1];
        buffer = [];
      } else if (currentTerm !== null) {
        buffer.push(line);
      }
    }
    flush();
  }

  const destPath = path.join(siteDir, 'public/data/glossary.json');
  await fs.mkdir(path.dirname(destPath), { recursive: true });
  await fs.writeFile(destPath, JSON.stringify(glossary), 'utf8');
}

/** Remove and recreate the three generated output dirs under `siteDir`. */
async function clearOutputDirs(siteDir: string): Promise<void> {
  for (const rel of ['src/content/docs', 'public/data', '.generated']) {
    await fs.rm(path.join(siteDir, rel), { recursive: true, force: true });
  }
}

/**
 * Read the previous build's graph positions (`{ [PageId]: [x, y] }`) from
 * `positionsPath`, so `buildGraph` can seed existing nodes from their old
 * coordinates. Missing file, unreadable JSON, or anything that doesn't
 * parse to a plain object all resolve to `{}` — a first run, or a corrupt
 * file, should never fail the build; it only means every node starts from
 * its computed initial position instead of a previous one. Per-entry
 * validation (e.g. a non-finite `x`/`y` from a hand-edited or truncated
 * file) is `buildGraph`'s job, not this function's — it treats any such
 * entry as absent.
 */
async function readPrevPositions(positionsPath: string): Promise<Record<PageId, [number, number]>> {
  let raw: string;
  try {
    raw = await fs.readFile(positionsPath, 'utf8');
  } catch {
    return {};
  }
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    return parsed as Record<PageId, [number, number]>;
  } catch {
    return {};
  }
}

/**
 * Write `positionsPath` as `{ [PageId]: [x, y] }` for every graph node,
 * pretty-printed with keys sorted so the committed file diffs stably
 * (brief Step 5: "录入后随内容一起提交，保持布局稳定").
 */
async function writePositions(
  positionsPath: string,
  graph: { nodes: { id: PageId; x: number; y: number }[] },
): Promise<void> {
  const positions: Record<PageId, [number, number]> = {};
  for (const node of graph.nodes) {
    positions[node.id] = [node.x, node.y];
  }
  const sorted: Record<PageId, [number, number]> = {};
  for (const id of Object.keys(positions).sort()) {
    sorted[id] = positions[id];
  }
  await fs.mkdir(path.dirname(positionsPath), { recursive: true });
  await fs.writeFile(positionsPath, JSON.stringify(sorted, null, 2) + '\n', 'utf8');
}

export interface PrepareOptions {
  root: string;
  siteDir: string;
  /**
   * Where to read the previous build's graph node positions from, and
   * write this build's positions back to. Defaults to
   * `<siteDir>/data/graph-positions.json` — the file committed to the
   * repo so the real site's layout stays stable across builds. The CLI
   * (`main`, below) overrides this to a `.generated/` path for fixture
   * builds (`CONTENT_ROOT` set), so a test run building the mini-repo
   * fixture never touches the committed real-content positions file.
   */
  positionsPath?: string;
}

/**
 * Run the full prepare step: load and validate `wiki/**` from `root`, then
 * write all generated output under `siteDir`. Throws `ContentError` (with
 * `.errors: string[]`) if the repo fails validation; nothing is written in
 * that case beyond the initial clear.
 */
export async function prepare(opts: PrepareOptions): Promise<void> {
  const { root, siteDir } = opts;
  const positionsPath = opts.positionsPath ?? path.join(siteDir, 'data/graph-positions.json');

  await clearOutputDirs(siteDir);

  const repoIndex = await loadRepo(root);

  const pageInfos: Record<PageId, PageInfo> = {};
  for (const [id, page] of repoIndex.pages) {
    pageInfos[id] = toPageInfo(page);
  }

  const edges: Edge[] = repoIndex.edges;
  const backlinks: Record<PageId, Edge[]> = {};
  for (const [id, list] of repoIndex.backlinks) {
    backlinks[id] = list;
  }
  const redirects: Record<PageId, PageId> = {};
  for (const [from, to] of repoIndex.redirects) {
    redirects[from] = to;
  }

  const generatedIndex: GeneratedIndex = {
    pages: pageInfos,
    edges,
    backlinks,
    redirects,
  };

  const sourceDirs = new Set<string>();
  for (const page of repoIndex.pages.values()) {
    const fm = page.fm as Record<string, unknown>;
    if (typeof fm.source_dir === 'string') sourceDirs.add(fm.source_dir);
  }

  await copyWikiTree(root, siteDir);
  await copySourceRawFiles(root, siteDir, sourceDirs);
  await writePreviews(siteDir, repoIndex.pages, pageInfos);
  await writeAnchorFiles(root, siteDir, repoIndex.pages);
  await writeGlossary(root, siteDir);

  const indexPath = path.join(siteDir, '.generated/index.json');
  await fs.mkdir(path.dirname(indexPath), { recursive: true });
  await fs.writeFile(indexPath, JSON.stringify(generatedIndex), 'utf8');

  const prevPositions = await readPrevPositions(positionsPath);
  const graph = buildGraph(generatedIndex, prevPositions);
  const graphPath = path.join(siteDir, 'public/data/graph.json');
  await fs.mkdir(path.dirname(graphPath), { recursive: true });
  await fs.writeFile(graphPath, JSON.stringify(graph), 'utf8');
  await writePositions(positionsPath, graph);
}

async function main(): Promise<void> {
  const root = process.env.CONTENT_ROOT ?? '..';
  const siteDir = '.';
  const positionsPath =
    process.env.CONTENT_ROOT === undefined
      ? path.join(siteDir, 'data/graph-positions.json')
      : path.join(siteDir, '.generated/graph-positions.json');
  try {
    await prepare({ root, siteDir, positionsPath });
  } catch (error) {
    if (error instanceof ContentError) {
      for (const line of error.errors) {
        console.error(line);
      }
      process.exit(1);
    }
    throw error;
  }
}

const isMainModule =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  void main();
}
