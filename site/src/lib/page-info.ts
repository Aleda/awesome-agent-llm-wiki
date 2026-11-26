/**
 * Builds the two header cards content pages render (Task 7, spec §7.1):
 * `metaCard` (left card, "元信息") and `sourceCard` (right card, "来源").
 * Both read a single `PageInfo` plus the surrounding `GeneratedIndex` (for
 * edges/backlinks/other pages) and return `CardRow[]` — rows a `.astro`
 * component renders without any further lookups.
 *
 * Rows for fields the page's frontmatter never set are omitted entirely
 * (e.g. a paper without `code` just lists its original-text link); an
 * empty "相关" row still renders, with a single "暂无" item.
 */
import { REL_LABEL, TYPE_LABEL } from './labels';
import type { Edge, GeneratedIndex, PageId, PageInfo } from './content-index';
import { BASE, toRoute } from './routes';
import { topicSourceIds } from './topic-sources';

export interface CardItem {
  text: string;
  href?: string;
  preview?: string;
  rel?: string;
  incoming?: boolean;
}

export interface CardRow {
  label: string;
  items: CardItem[];
  overflow: CardItem[];
}

const MAX_RELATED = 6;

/** Relation priority for ordering 相关 items (ties broken by title, A→Z). */
const REL_PRIORITY: string[] = [
  'proposes',
  'extends',
  'challenges',
  'supports',
  'explains',
  'responds',
  'alternative-to',
  'applies',
];

function cardItemHref(id: PageId): { href: string; preview: string } {
  return { href: toRoute(id), preview: `${BASE}/data/previews/${id}.json` };
}

/** A page's title, or the raw id's final segment if it isn't in `idx.pages` (e.g. a dangling link — shouldn't happen post-build, but keeps this defensive). */
function titleOf(idx: GeneratedIndex, id: PageId): string {
  return idx.pages[id]?.title ?? id;
}

/**
 * 相关 row items: outgoing edges from `id` (excluding `part-of` edges to a
 * topic, since topics already show in 方向) first, then incoming backlinks
 * — each group internally ordered by `REL_PRIORITY`, ties broken by title.
 * Capped at `MAX_RELATED`; the rest is returned as `overflow`.
 */
function relatedItems(
  id: PageId,
  idx: GeneratedIndex,
): { items: CardItem[]; overflow: CardItem[] } {
  const outgoing = (idx.edges ?? []).filter((e) => e.from === id);
  const incoming = idx.backlinks[id] ?? [];

  function toItem(edge: Edge, incomingFlag: boolean): { item: CardItem; other: PageId } {
    const other = incomingFlag ? edge.from : edge.to;
    const { href, preview } = cardItemHref(other);
    return {
      item: {
        text: titleOf(idx, other),
        href,
        preview,
        rel: REL_LABEL[edge.rel],
        incoming: incomingFlag,
      },
      other,
    };
  }

  function sortGroup(edges: Edge[], incomingFlag: boolean): CardItem[] {
    return edges
      .map((edge) => ({ edge, ...toItem(edge, incomingFlag) }))
      .sort((a, b) => {
        const pa = REL_PRIORITY.indexOf(a.edge.rel);
        const pb = REL_PRIORITY.indexOf(b.edge.rel);
        if (pa !== pb) return pa - pb;
        return a.item.text.localeCompare(b.item.text);
      })
      .map((x) => x.item);
  }

  const outgoingFiltered = outgoing.filter(
    (e) => !(e.rel === 'part-of' && idx.pages[e.to]?.type === 'topic'),
  );

  const all = [...sortGroup(outgoingFiltered, false), ...sortGroup(incoming, true)];

  return { items: all.slice(0, MAX_RELATED), overflow: all.slice(MAX_RELATED) };
}

/** 方向 row: topic titles (from `info.topics`), linking to their topic pages. */
function directionRow(info: PageInfo, idx: GeneratedIndex): CardRow {
  const items: CardItem[] = info.topics.map((slug) => {
    const id = `wiki/topics/${slug}`;
    const { href, preview } = cardItemHref(id);
    return { text: titleOf(idx, id), href, preview };
  });
  return { label: '方向', items, overflow: [] };
}

/** Resolve a `by` entry's org-role name: the entity page's title if it has one, else the literal `name`. */
function orgName(idx: GeneratedIndex, entry: PageInfo['by'][number]): string {
  if (entry.entity !== undefined) {
    return titleOf(idx, `wiki/entities/${entry.entity}`);
  }
  return entry.name ?? '';
}

/** 出自 row: org names from `by` joined with `venue`, e.g. `NVIDIA · arXiv`. */
function originRow(info: PageInfo, idx: GeneratedIndex): CardRow | null {
  const orgs = info.by.filter((b) => b.role === 'org').map((b) => orgName(idx, b));
  const parts = [...orgs];
  if (info.venue !== undefined) parts.push(info.venue);
  if (parts.length === 0) return null;
  return { label: '出自', items: [{ text: parts.join(' · ') }], overflow: [] };
}

/** `YYYY-MM` from an ISO `YYYY-MM-DD` date string. */
function yearMonth(date: string): string {
  return date.slice(0, 7);
}

/** Left card for a source page (paper/blog/video/podcast): 类型/方向/出自/相关. */
function sourceMetaCard(id: PageId, info: PageInfo, idx: GeneratedIndex): CardRow[] {
  const rows: CardRow[] = [];

  const typeText =
    info.date !== undefined
      ? `${TYPE_LABEL[info.type]} · ${yearMonth(info.date)}`
      : TYPE_LABEL[info.type];
  rows.push({ label: '类型', items: [{ text: typeText }], overflow: [] });

  rows.push(directionRow(info, idx));

  const origin = originRow(info, idx);
  if (origin !== null) rows.push(origin);

  const { items: relItems, overflow } = relatedItems(id, idx);
  rows.push({
    label: '相关',
    items: relItems.length > 0 ? relItems : [{ text: '暂无' }],
    overflow,
  });

  return rows;
}

/** Edges counted as "sources" of a concept: everything pointing at it except `part-of`/`alternative-to` (those are concept↔concept/topic, not素材→概念). */
function conceptSourceEdges(backlinks: Edge[]): Edge[] {
  return backlinks.filter((e) => e.rel !== 'part-of' && e.rel !== 'alternative-to');
}

/**
 * `2（提出 1 · 反驳 1）` / `0` 来源数 text (ruling R5 — spec §7.1): the
 * leading number counts *distinct source pages* pointing at the concept;
 * the per-relation breakdown stays edge-based (one page citing a concept
 * under two relations contributes 1 to both relation counts, but only 1
 * to the distinct-page total).
 */
function sourceCountText(edges: Edge[]): string {
  const distinctSources = new Set(edges.map((e) => e.from));
  if (distinctSources.size === 0) return '0';
  const counts = new Map<string, number>();
  const order: string[] = [];
  for (const edge of edges) {
    const label = REL_LABEL[edge.rel];
    if (!counts.has(label)) {
      counts.set(label, 0);
      order.push(label);
    }
    counts.set(label, counts.get(label)! + 1);
  }
  const breakdown = order.map((label) => `${label} ${counts.get(label)}`).join(' · ');
  return `${distinctSources.size}（${breakdown}）`;
}

/** Left card for a concept page: 定义/所属主题/来源数. */
function conceptMetaCard(id: PageId, info: PageInfo, idx: GeneratedIndex): CardRow[] {
  const topicItems: CardItem[] = info.topics.map((slug) => {
    const topicId = `wiki/topics/${slug}`;
    const { href, preview } = cardItemHref(topicId);
    return { text: titleOf(idx, topicId), href, preview };
  });

  const sourceEdges = conceptSourceEdges(idx.backlinks[id] ?? []);

  return [
    { label: '定义', items: [{ text: info.summary }], overflow: [] },
    {
      label: '所属主题',
      items: topicItems.length > 0 ? topicItems : [{ text: '暂无' }],
      overflow: [],
    },
    { label: '来源数', items: [{ text: sourceCountText(sourceEdges) }], overflow: [] },
  ];
}

/**
 * Left card for a topic page: 定义/概念数/来源数 (ruling R4 — topics have no
 * parent, so they get 概念数 where a concept page would show 所属主题).
 * 概念数 counts concepts `part-of` this topic; 来源数 is `topicSourceIds`
 * (source pages tagged with the topic or linked to one of its concepts).
 */
function topicMetaCard(id: PageId, info: PageInfo, idx: GeneratedIndex): CardRow[] {
  const conceptIds = new Set(
    (idx.edges ?? [])
      .filter((e) => e.rel === 'part-of' && e.to === id && idx.pages[e.from]?.type === 'concept')
      .map((e) => e.from),
  );

  const allSourceIds = topicSourceIds(id, idx);

  return [
    { label: '定义', items: [{ text: info.summary }], overflow: [] },
    { label: '概念数', items: [{ text: String(conceptIds.size) }], overflow: [] },
    { label: '来源数', items: [{ text: String(allSourceIds.size) }], overflow: [] },
  ];
}

/**
 * Build the left ("元信息") card rows for a page. Source pages (paper,
 * blog, video, podcast) get 类型/方向/出自/相关; concept pages get
 * 定义/所属主题/来源数; topic pages get 定义/概念数/来源数 (R4). Any other
 * page type (entity, raw) has no meta card — callers should check
 * `info.type` before calling, but this returns `[]` defensively.
 */
export function metaCard(id: PageId, idx: GeneratedIndex): CardRow[] {
  const info = idx.pages[id];
  if (info === undefined) return [];
  switch (info.type) {
    case 'paper':
    case 'blog':
    case 'video':
    case 'podcast':
      return sourceMetaCard(id, info, idx);
    case 'concept':
      return conceptMetaCard(id, info, idx);
    case 'topic':
      return topicMetaCard(id, info, idx);
    default:
      return [];
  }
}

/**
 * `A、B、C 等 N 人` for >3 authors, else all joined by `、`. Authors are
 * `by` entries with an individual role (`author`/`speaker`); returns
 * `null` when there is none, so the 作者 row is omitted entirely rather
 * than falling back to org names (ruling R6 — that would just duplicate
 * 机构).
 */
function authorsText(idx: GeneratedIndex, info: PageInfo): string | null {
  const individual = info.by.filter((b) => b.role === 'author' || b.role === 'speaker');
  if (individual.length === 0) return null;
  const names = individual.map((a) => orgName(idx, a));
  if (names.length > 3) {
    return `${names.slice(0, 3).join('、')} 等 ${names.length} 人`;
  }
  return names.join('、');
}

/** 机构 row: org names from `by`. Omitted only when `by` has no org entry at all. */
function orgsRow(idx: GeneratedIndex, info: PageInfo): CardRow | null {
  const orgEntries = info.by.filter((b) => b.role === 'org');
  if (orgEntries.length === 0) return null;
  const orgs = orgEntries.map((b) => orgName(idx, b));
  return { label: '机构', items: [{ text: orgs.join('、') }], overflow: [] };
}

/** 链接 row: 原文 (`url`) and, for papers, 代码 (`code`) when present. */
function linksRow(info: PageInfo): CardRow | null {
  const items: CardItem[] = [];
  if (info.url !== undefined) items.push({ text: '原文', href: info.url });
  if (info.code !== undefined) items.push({ text: '代码', href: info.code });
  if (items.length === 0) return null;
  return { label: '链接', items, overflow: [] };
}

function summaryRow(info: PageInfo): CardRow {
  return { label: '总结', items: [{ text: info.summary }], overflow: [] };
}

/** 发表 row for a paper: `arXiv 2611.00001 · 31 页` (venue + id from the url + page count, each part omitted if absent). */
function publishedRow(info: PageInfo): CardRow | null {
  if (info.venue === undefined) return null;
  const parts = [info.venue];
  const arxivId = info.url !== undefined ? /\/abs\/([^/?#]+)/.exec(info.url)?.[1] : undefined;
  if (arxivId !== undefined) parts.push(arxivId);
  let text = parts.join(' ');
  if (info.pages !== undefined) text += ` · ${info.pages} 页`;
  return { label: '发表', items: [{ text }], overflow: [] };
}

function paperSourceCard(info: PageInfo, idx: GeneratedIndex): CardRow[] {
  const rows: CardRow[] = [];
  const authors = authorsText(idx, info);
  if (authors !== null) rows.push({ label: '作者', items: [{ text: authors }], overflow: [] });
  const orgs = orgsRow(idx, info);
  if (orgs !== null) rows.push(orgs);
  const published = publishedRow(info);
  if (published !== null) rows.push(published);
  const links = linksRow(info);
  if (links !== null) rows.push(links);
  rows.push(summaryRow(info));
  return rows;
}

function blogSourceCard(info: PageInfo, idx: GeneratedIndex): CardRow[] {
  const rows: CardRow[] = [];
  const authors = authorsText(idx, info);
  if (authors !== null) rows.push({ label: '作者', items: [{ text: authors }], overflow: [] });
  const orgs = orgsRow(idx, info);
  if (orgs !== null) rows.push(orgs);
  if (info.date !== undefined) {
    rows.push({ label: '发布', items: [{ text: info.date }], overflow: [] });
  }
  const links = linksRow(info);
  if (links !== null) rows.push(links);
  rows.push(summaryRow(info));
  return rows;
}

function videoSourceCard(info: PageInfo, idx: GeneratedIndex, id: PageId): CardRow[] {
  const rows: CardRow[] = [];
  const speakers = info.by
    .filter((b) => b.role === 'speaker' || b.role === 'author')
    .map((b) => orgName(idx, b));
  if (speakers.length > 0) {
    rows.push({ label: '讲者', items: [{ text: speakers.join('、') }], overflow: [] });
  }
  if (info.venue !== undefined) {
    rows.push({ label: '平台', items: [{ text: info.venue }], overflow: [] });
  }
  if (info.duration !== undefined) {
    rows.push({ label: '时长', items: [{ text: `${info.duration} 分钟` }], overflow: [] });
  }
  const explainsTargets = (idx.edges ?? []).filter((e) => e.from === id && e.rel === 'explains');
  if (explainsTargets.length > 0) {
    rows.push({
      label: '讲解对象',
      items: explainsTargets.map((e) => {
        const { href, preview } = cardItemHref(e.to);
        return { text: titleOf(idx, e.to), href, preview };
      }),
      overflow: [],
    });
  }
  rows.push(summaryRow(info));
  return rows;
}

function podcastSourceCard(info: PageInfo, idx: GeneratedIndex): CardRow[] {
  const rows: CardRow[] = [];
  if (info.show !== undefined) {
    rows.push({ label: '节目', items: [{ text: info.show }], overflow: [] });
  }
  const hosts = info.by.filter((b) => b.role === 'host').map((b) => orgName(idx, b));
  if (hosts.length > 0) {
    rows.push({ label: '主持', items: [{ text: hosts.join('、') }], overflow: [] });
  }
  const guests = info.by.filter((b) => b.role === 'guest');
  if (guests.length > 0) {
    rows.push({
      label: '嘉宾',
      items: [
        {
          text: guests
            .map((g) => {
              const name = orgName(idx, g);
              return g.bio !== undefined ? `${name}（${g.bio}）` : name;
            })
            .join('、'),
        },
      ],
      overflow: [],
    });
  }
  if (info.duration !== undefined) {
    rows.push({ label: '时长', items: [{ text: `${info.duration} 分钟` }], overflow: [] });
  }
  if (info.venue !== undefined) {
    rows.push({ label: '平台', items: [{ text: info.venue }], overflow: [] });
  }
  rows.push(summaryRow(info));
  return rows;
}

/**
 * Build the right ("来源") card rows for a source page (paper/blog/video/
 * podcast), per the field table in spec §7.1. Concept/topic/entity/raw
 * pages have no source card — returns `[]` for them.
 */
export function sourceCard(id: PageId, idx: GeneratedIndex): CardRow[] {
  const info = idx.pages[id];
  if (info === undefined) return [];
  switch (info.type) {
    case 'paper':
      return paperSourceCard(info, idx);
    case 'blog':
      return blogSourceCard(info, idx);
    case 'video':
      return videoSourceCard(info, idx, id);
    case 'podcast':
      return podcastSourceCard(info, idx);
    default:
      return [];
  }
}
