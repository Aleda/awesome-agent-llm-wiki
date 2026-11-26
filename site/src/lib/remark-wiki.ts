/**
 * remark plugin that turns wiki Markdown into site links (Task 6).
 *
 * - Relative `.md` links to wiki pages become site routes (`toRoute`), with
 *   the `#fragment` kept, redirects followed, and a `data-preview` pointing
 *   at the page's preview JSON. Links into `wiki/glossary` get the glossary
 *   preview and a `data-term`. Links into `sources/` are rewritten to their
 *   route but carry no preview. Internal links whose target does not exist
 *   are replaced by their text.
 * - Citation tokens inside `（…）` (`[HH:MM:SS]`, `§3.2`, `Fig. 4`, ...)
 *   become `<a class="cite">` links when the current source's anchor table
 *   (`<anchorsDir>/<source_dir>.json`) has the key; unknown keys stay text.
 *
 * Current source: the page's own `source_dir`; a paragraph starting with
 * `来源：` switches it to the `source_dir` of its first link's target until
 * the next `来源：` paragraph; a link inside the same `（…）` group as a
 * citation overrides it for that citation.
 * - Build-time auto sections (Task 8, `./auto-sections.ts`): a bullet list
 *   (or a `暂无` paragraph when empty) is injected under the page's `##
 *   关系`/`演化`/`最近进展`/`相关素材` heading (whichever applies to its
 *   type) when that heading exists and is empty, else appended as a new
 *   heading at the end of the document. Runs after the link-rewrite pass
 *   below so its freshly built links are not re-processed by it.
 *
 * Index and anchor JSON are read once per process (cached by path).
 */
import fs from 'node:fs';
import path from 'node:path';
import type { Heading, Link, List, ListItem, Parent, PhrasingContent, Root, RootContent, Text } from 'mdast';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';
import { findCitations } from './anchors';
import { autoSections, type AutoItem } from './auto-sections';
import { resolveLink, termSlug, type GeneratedIndex, type PageId } from './content-index';
import { BASE, followRedirects, toRoute } from './routes';

export interface RemarkWikiOptions {
  /** Path to `.generated/index.json`; relative paths resolve against `process.cwd()`. */
  indexPath: string;
  /** Directory holding `<source_dir>.json` anchor tables; relative to `process.cwd()` if not absolute. */
  anchorsDir: string;
}

type AnchorTable = Record<string, { text: string; href: string }>;

const GLOSSARY_ID = 'wiki/glossary';
const DOCS_MARKER = '/src/content/docs/';

const indexCache = new Map<string, GeneratedIndex>();
const anchorCache = new Map<string, AnchorTable | null>();

function loadIndex(indexPath: string): GeneratedIndex {
  const abs = path.resolve(indexPath);
  let index = indexCache.get(abs);
  if (index === undefined) {
    let raw: string;
    try {
      raw = fs.readFileSync(abs, 'utf8');
    } catch {
      throw new Error(`remarkWiki: cannot read ${abs}; run the prepare step first`);
    }
    index = JSON.parse(raw) as GeneratedIndex;
    indexCache.set(abs, index);
  }
  return index;
}

function loadAnchors(anchorsDir: string, sourceKey: string): AnchorTable | null {
  const base = path.resolve(anchorsDir);
  const abs = path.resolve(base, `${sourceKey}.json`);
  const rel = path.relative(base, abs);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
  if (!anchorCache.has(abs)) {
    let table: AnchorTable | null = null;
    try {
      table = JSON.parse(fs.readFileSync(abs, 'utf8')) as AnchorTable;
    } catch {
      table = null; // no anchor file for this source: citations stay text
    }
    anchorCache.set(abs, table);
  }
  return anchorCache.get(abs) ?? null;
}

/**
 * Turn a vfile path into a docs-relative page id (`wiki/papers/x`).
 * Astro passes an absolute path under `src/content/docs/`; tests pass the
 * docs-relative path directly. Returns `null` when neither applies.
 */
export function docsPageId(filePath: string | undefined): PageId | null {
  if (!filePath) return null;
  const posix = filePath.split(path.sep).join('/');
  let rel: string;
  const marker = posix.lastIndexOf(DOCS_MARKER);
  if (marker !== -1) {
    rel = posix.slice(marker + DOCS_MARKER.length);
  } else if (path.posix.isAbsolute(posix) || path.isAbsolute(filePath)) {
    return null;
  } else {
    rel = posix.replace(/^\.\//, '');
  }
  return rel.replace(/\.mdx?$/, '');
}

type Target =
  | { kind: 'page'; id: PageId; hash: string }
  | { kind: 'source'; id: PageId; hash: string }
  | { kind: 'missing' };

/** Classify a link href. `null` means external or non-`.md`: leave untouched. */
function resolveTarget(index: GeneratedIndex, fromId: PageId, href: string): Target | null {
  const resolved = resolveLink(fromId, href);
  if (resolved === null) return null;
  const id = followRedirects(index.redirects, resolved.id);
  if (index.pages[id] !== undefined) return { kind: 'page', id, hash: resolved.hash };
  if (id.startsWith('sources/')) return { kind: 'source', id, hash: resolved.hash };
  return { kind: 'missing' };
}

/**
 * The source_dir a link target belongs to: a wiki page's `sourceKey`, or for
 * a raw page under `sources/` its directory (`.../transcript`, `.../anchors`
 * dropped).
 */
function sourceOf(index: GeneratedIndex, target: Target | null): string | undefined {
  if (target?.kind === 'page') return index.pages[target.id].sourceKey;
  if (target?.kind === 'source') {
    const match = /^(sources\/.+)\/(?:transcript|anchors)$/.exec(target.id);
    return match?.[1];
  }
  return undefined;
}

interface TextSeg {
  start: number;
  end: number;
  node: Text;
  parent: Parent;
}

interface LinkSeg {
  start: number;
  end: number;
  node: Link;
}

/** Flatten a block's inline children into one string plus segment offsets. */
function flatten(block: Parent): { text: string; texts: TextSeg[]; links: LinkSeg[] } {
  let text = '';
  const texts: TextSeg[] = [];
  const links: LinkSeg[] = [];

  const walk = (parent: Parent, inLink: boolean) => {
    for (const child of parent.children as PhrasingContent[]) {
      if (child.type === 'text') {
        if (!inLink) texts.push({ start: text.length, end: text.length + child.value.length, node: child, parent });
        text += child.value;
      } else if (child.type === 'inlineCode') {
        text += child.value;
      } else if (child.type === 'link') {
        const start = text.length;
        walk(child, true);
        links.push({ start, end: text.length, node: child });
      } else if (child.type === 'break') {
        text += '\n';
      } else if ('children' in child) {
        walk(child as Parent, inLink || child.type === 'linkReference');
      }
    }
  };
  walk(block, false);
  return { text, texts, links };
}

interface CiteNode {
  type: 'wikiCite';
  children: Text[];
  data: { hName: 'a'; hProperties: Record<string, unknown> };
}

interface Replacement {
  start: number; // offset within the text node
  end: number;
  node: CiteNode;
}

interface BareDirective {
  type: 'textDirective';
  name: string;
  attributes?: Record<string, unknown> | null;
  children: unknown[];
}

/**
 * Starlight enables remark-directive, so `[00:01:02]` parses as text `[00`,
 * a text directive named `01`, then `:02]`... Starlight turns unhandled
 * directives back into text only after user plugins run. Restore bare text
 * directives (no label, no attributes) to `:name` now and merge adjacent
 * text nodes, so citation tokens sit inside a single text node.
 */
function restoreBareDirectives(tree: Root): void {
  visit(tree, (node) => {
    if (!('children' in node)) return;
    const parent = node as Parent;
    const merged: Parent['children'] = [];
    for (const child of parent.children) {
      let current = child;
      const d = child as unknown as BareDirective;
      if (
        d.type === 'textDirective' &&
        d.children.length === 0 &&
        (d.attributes == null || Object.keys(d.attributes).length === 0)
      ) {
        current = { type: 'text', value: `:${d.name}` };
      }
      const last = merged[merged.length - 1];
      if (current.type === 'text' && last?.type === 'text') {
        merged[merged.length - 1] = { type: 'text', value: last.value + current.value };
      } else {
        merged.push(current);
      }
    }
    parent.children = merged;
  });
}

/**
 * Render one `AutoItem` as a list item's inline children: `date · [title]
 * (href) · rel · note`, each part omitted when absent. The link already
 * carries its final `href` and (for non-raw pages) `data-preview`, so this
 * output is never touched by pass 2 above (it runs after it).
 */
function autoItemToListItem(item: AutoItem, idx: GeneratedIndex): ListItem {
  const parts: PhrasingContent[] = [];
  const push = (text: string) => {
    if (parts.length > 0) parts.push({ type: 'text', value: ' · ' });
    parts.push({ type: 'text', value: text });
  };

  if (item.date !== undefined) push(item.date);

  const href = toRoute(item.href);
  const linkProps: Record<string, unknown> = { href };
  const targetInfo = idx.pages[item.href];
  if (targetInfo !== undefined && targetInfo.type !== 'raw') {
    linkProps.dataPreview = `${BASE}/data/previews/${item.href}.json`;
  }
  const link: Link = {
    type: 'link',
    url: href,
    children: [{ type: 'text', value: item.title }],
    data: { hProperties: linkProps },
  };
  if (parts.length > 0) parts.push({ type: 'text', value: ' · ' });
  parts.push(link);

  if (item.rel !== undefined) push(item.rel);
  if (item.note !== undefined) push(item.note);

  return { type: 'listItem', children: [{ type: 'paragraph', children: parts }] };
}

/** Build the mdast nodes for a section's content: a bullet list, or a `暂无` paragraph when `items` is empty. */
function autoSectionNodes(items: AutoItem[], idx: GeneratedIndex): RootContent[] {
  if (items.length === 0) {
    return [{ type: 'paragraph', children: [{ type: 'text', value: '暂无' }] }];
  }
  const list: List = {
    type: 'list',
    ordered: false,
    children: items.map((item) => autoItemToListItem(item, idx)),
  };
  return [list];
}

/** Heading text as plain text (children are plain text in every real heading this plugin injects into). */
function headingText(heading: Heading): string {
  return heading.children.map((c) => ('value' in c ? (c as Text).value : '')).join('');
}

/**
 * Inject each of `autoSections(fromId, idx)`'s lists into `tree`: under an
 * existing `## <heading>` whose body is empty (next sibling is another
 * heading or end of document) when one exists with that exact text, else
 * appended as a new heading + list at the end of the document.
 */
function insertAutoSections(tree: Root, fromId: PageId, idx: GeneratedIndex): void {
  const sections = autoSections(fromId, idx);
  const headingTexts = Object.keys(sections);
  if (headingTexts.length === 0) return;

  for (const heading of headingTexts) {
    const items = sections[heading];
    const content = autoSectionNodes(items, idx);

    const children = tree.children as RootContent[];
    const at = children.findIndex(
      (node) => node.type === 'heading' && node.depth === 2 && headingText(node) === heading,
    );

    if (at !== -1) {
      const next = children[at + 1];
      const isEmpty = next === undefined || next.type === 'heading';
      if (isEmpty) {
        children.splice(at + 1, 0, ...content);
        continue;
      }
      // heading exists but already has hand-written content: leave it untouched.
      continue;
    }

    const newHeading: Heading = { type: 'heading', depth: 2, children: [{ type: 'text', value: heading }] };
    children.push(newHeading, ...content);
  }
}

export const remarkWiki: Plugin<[RemarkWikiOptions], Root> = (opts) => {
  return (tree, file) => {
    const fromId = docsPageId(file.path);
    if (fromId === null) return;
    const index = loadIndex(opts.indexPath);
    restoreBareDirectives(tree);

    let current: string | undefined = index.pages[fromId]?.sourceKey;

    // Pass 1: citations (needs original link urls to pick the source).
    visit(tree, (node) => {
      if (node.type !== 'paragraph' && node.type !== 'heading' && node.type !== 'tableCell') return;
      const { text, texts, links } = flatten(node as Parent);

      if (node.type === 'paragraph' && text.trimStart().startsWith('来源：')) {
        current = links.length > 0 ? sourceOf(index, resolveTarget(index, fromId, links[0].node.url)) : undefined;
      }

      const byNode = new Map<Text, { seg: TextSeg; reps: Replacement[] }>();
      for (const cite of findCitations(text)) {
        const seg = texts.find((s) => s.start <= cite.start && cite.end <= s.end);
        if (seg === undefined) continue;

        const groupStart = text.lastIndexOf('（', cite.start);
        const groupEnd = text.indexOf('）', cite.end);
        const inGroup = links.filter((l) => l.start > groupStart && l.end <= groupEnd);
        const preceding = inGroup.filter((l) => l.end <= cite.start);
        const groupLink = preceding.length > 0 ? preceding[preceding.length - 1] : inGroup[0];
        const source =
          (groupLink && sourceOf(index, resolveTarget(index, fromId, groupLink.node.url))) ?? current;
        if (source === undefined) continue;

        const anchor = loadAnchors(opts.anchorsDir, source)?.[cite.key];
        if (anchor === undefined) continue;

        const entry = byNode.get(seg.node) ?? { seg, reps: [] };
        entry.reps.push({
          start: cite.start - seg.start,
          end: cite.end - seg.start,
          node: {
            type: 'wikiCite',
            children: [{ type: 'text', value: text.slice(cite.start, cite.end) }],
            data: {
              hName: 'a',
              hProperties: {
                className: ['cite'],
                href: anchor.href,
                dataPreview: `${BASE}/data/anchors/${source}.json`,
                dataKey: cite.key,
              },
            },
          },
        });
        byNode.set(seg.node, entry);
      }

      for (const { seg, reps } of byNode.values()) {
        const value = seg.node.value;
        const parts: Array<Text | CiteNode> = [];
        let pos = 0;
        for (const rep of reps.sort((a, b) => a.start - b.start)) {
          if (rep.start > pos) parts.push({ type: 'text', value: value.slice(pos, rep.start) });
          parts.push(rep.node);
          pos = rep.end;
        }
        if (pos < value.length) parts.push({ type: 'text', value: value.slice(pos) });
        const at = seg.parent.children.indexOf(seg.node);
        seg.parent.children.splice(at, 1, ...(parts as unknown as PhrasingContent[]));
      }
    });

    // Pass 2: rewrite internal links.
    visit(tree, 'link', (node, idx, parent) => {
      const target = resolveTarget(index, fromId, node.url);
      if (target === null) return;
      if (target.kind === 'missing') {
        if (parent === undefined || idx === undefined) return;
        parent.children.splice(idx, 1, ...node.children);
        return idx;
      }
      const href = toRoute(target.id, target.hash);
      const props: Record<string, unknown> = { href };
      if (target.kind === 'page') {
        if (target.id === GLOSSARY_ID) {
          let term = target.hash.slice(1);
          try {
            term = decodeURIComponent(term);
          } catch {
            // keep the raw fragment
          }
          if (term !== '') {
            props.dataPreview = `${BASE}/data/glossary.json`;
            props.dataTerm = termSlug(term);
          }
        } else if (index.pages[target.id].type !== 'raw') {
          props.dataPreview = `${BASE}/data/previews/${target.id}.json`;
        }
      }
      node.url = href;
      // hProperties.href keeps non-ASCII fragments (`#定义`) as written, matching heading ids.
      node.data = { ...node.data, hProperties: { ...(node.data?.hProperties ?? {}), ...props } };
    });

    // Pass 3: inject build-time auto sections (Task 8). Runs after the link
    // rewrite above so the nodes built here (already carrying their final
    // href/data-preview) are not re-processed by it.
    insertAutoSections(tree, fromId, index);
  };
};

export default remarkWiki;
