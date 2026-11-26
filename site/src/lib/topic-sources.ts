/**
 * The one definition of "a topic's sources" (来源数 / 最近进展 / the graph's
 * "N 份素材" sub-label): distinct source pages (paper/blog/video/podcast)
 * whose `topics` include the topic's slug, or that have an edge to a concept
 * that is `part-of` the topic. Concept, topic and entity pages never count,
 * even when their own `topics` list the topic.
 */
import type { GeneratedIndex, PageId } from './content-index';

export const SOURCE_PAGE_TYPES: ReadonlySet<string> = new Set(['paper', 'blog', 'video', 'podcast']);

/** Source page ids belonging to topic `topicId` (`wiki/topics/<slug>`), in index order. */
export function topicSourceIds(topicId: PageId, idx: GeneratedIndex): Set<PageId> {
  const topicSlug = topicId.slice('wiki/topics/'.length);
  const edges = idx.edges ?? [];

  const conceptIds = new Set(
    edges
      .filter((e) => e.rel === 'part-of' && e.to === topicId && idx.pages[e.from]?.type === 'concept')
      .map((e) => e.from),
  );

  const linked = new Set<PageId>();
  for (const e of edges) {
    if (conceptIds.has(e.to)) linked.add(e.from);
  }

  const out = new Set<PageId>();
  for (const page of Object.values(idx.pages)) {
    if (!SOURCE_PAGE_TYPES.has(page.type)) continue;
    if (page.topics.includes(topicSlug) || linked.has(page.id)) out.add(page.id);
  }
  return out;
}
