/**
 * Build-time auto-generated sections (Task 8, spec CLAUDE.md §自动生成的内容).
 * `autoSections` computes the AutoItem lists for a page's secondary
 * headings; `remarkWiki` (Task 6) injects them as mdast nodes so the
 * `.md` source never carries this content.
 *
 * Which page types get which section (brief's "remark 注入规则"):
 * - source page (paper/blog/video/podcast): `关系` — outgoing edges first
 *   (rel label as-is), then incoming edges (rel label prefixed `← `).
 *   `part-of` edges are excluded in both directions.
 * - concept page: `演化` — one item per incoming (backlink) edge from a
 *   source page, sorted by the source's `date` ascending (ties by title);
 *   `note` is the edge's own `note` (written by the source's `relations`
 *   entry, per CLAUDE.md §自动生成的内容).
 * - topic page: `最近进展` — distinct source pages (paper/blog/video/
 *   podcast) whose `topics` include this topic's slug, or that have an
 *   edge to a concept that is `part-of` this topic; sorted by `date`
 *   descending (ties by title), capped at 10; `rel`/`note` omitted.
 * - entity page: `相关素材` — source pages whose `by` list references this
 *   entity, sorted by `date` descending; `note` is the source's
 *   `insights[0]`.
 *
 * Any other page type (raw, or an id not in the index) gets no sections
 * at all (`{}`).
 */
import type { GeneratedIndex, PageId, PageInfo } from './content-index';
import { REL_LABEL } from './labels';
import { topicSourceIds } from './topic-sources';

export interface AutoItem {
  date?: string;
  title: string;
  href: string;
  rel?: string;
  note?: string;
}

const SOURCE_TYPES = new Set(['paper', 'blog', 'video', 'podcast']);

/** Build an `AutoItem` pointing at `id`, with optional `rel`/`note`. */
function itemFor(
  idx: GeneratedIndex,
  id: PageId,
  extra: { rel?: string; note?: string } = {},
): AutoItem {
  const info = idx.pages[id];
  const item: AutoItem = { title: info?.title ?? id, href: id };
  if (info?.date !== undefined) item.date = info.date;
  if (extra.rel !== undefined) item.rel = extra.rel;
  if (extra.note !== undefined) item.note = extra.note;
  return item;
}

/** `关系` for a source page: outgoing edges, then incoming edges (rel prefixed `← `); `part-of` excluded both ways. */
function sourceRelations(id: PageId, idx: GeneratedIndex): AutoItem[] {
  const outgoing = (idx.edges ?? []).filter((e) => e.from === id && e.rel !== 'part-of');
  const incoming = (idx.backlinks[id] ?? []).filter((e) => e.rel !== 'part-of');

  const items: AutoItem[] = [];
  for (const edge of outgoing) {
    items.push(itemFor(idx, edge.to, { rel: REL_LABEL[edge.rel], note: edge.note }));
  }
  for (const edge of incoming) {
    items.push(itemFor(idx, edge.from, { rel: `← ${REL_LABEL[edge.rel]}`, note: edge.note }));
  }
  return items;
}

/** `演化` for a concept page: one item per incoming source edge, sorted by source date asc (ties by title). */
function conceptEvolution(id: PageId, idx: GeneratedIndex): AutoItem[] {
  const incoming = idx.backlinks[id] ?? [];
  return incoming
    .map((edge) => ({ edge, item: itemFor(idx, edge.from, { rel: REL_LABEL[edge.rel], note: edge.note }) }))
    .sort((a, b) => {
      const da = a.item.date ?? '';
      const db = b.item.date ?? '';
      if (da !== db) return da.localeCompare(db);
      return a.item.title.localeCompare(b.item.title);
    })
    .map((x) => x.item);
}

/** `最近进展` for a topic page: distinct sources by direct `topics` membership or via a `part-of` concept, sorted by date desc (ties by title), capped at 10. */
function topicRecentProgress(id: PageId, idx: GeneratedIndex): AutoItem[] {
  const sourceIds = topicSourceIds(id, idx);

  return [...sourceIds]
    .map((sid) => itemFor(idx, sid))
    .sort((a, b) => {
      const da = a.date ?? '';
      const db = b.date ?? '';
      if (da !== db) return db.localeCompare(da);
      return a.title.localeCompare(b.title);
    })
    .slice(0, 10);
}

/** `相关素材` for an entity page: source pages whose `by` references this entity, sorted by date desc; `note` is the source's first insight. */
function entityRelatedSources(id: PageId, idx: GeneratedIndex): AutoItem[] {
  const slug = id.slice('wiki/entities/'.length);

  const sources: PageInfo[] = Object.values(idx.pages).filter((page) =>
    page.by.some((b) => b.entity === slug),
  );

  return sources
    .map((info) => itemFor(idx, info.id, { note: info.insights[0] }))
    .sort((a, b) => {
      const da = a.date ?? '';
      const db = b.date ?? '';
      if (da !== db) return db.localeCompare(da);
      return a.title.localeCompare(b.title);
    });
}

/**
 * Compute every auto-generated section for page `id`, keyed by the
 * secondary heading text. Source pages get only `关系`, concept pages only
 * `演化`, topic pages only `最近进展`, entity pages only `相关素材`; any
 * other type (raw) or an id missing from the index gets `{}`.
 */
export function autoSections(id: PageId, idx: GeneratedIndex): Record<string, AutoItem[]> {
  const info = idx.pages[id];
  if (info === undefined) return {};

  if (SOURCE_TYPES.has(info.type)) {
    return { 关系: sourceRelations(id, idx) };
  }
  if (info.type === 'concept') {
    return { 演化: conceptEvolution(id, idx) };
  }
  if (info.type === 'topic') {
    return { 最近进展: topicRecentProgress(id, idx) };
  }
  if (info.type === 'entity') {
    return { 相关素材: entityRelatedSources(id, idx) };
  }
  return {};
}
