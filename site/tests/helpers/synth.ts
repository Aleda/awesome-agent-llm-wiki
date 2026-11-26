/**
 * Deterministic synthetic `GeneratedIndex` generator for graph-build size
 * tests (Task 10). Produces a realistic-shaped wiki: 10 topics (ordered
 * `0..9`), 15% of the remaining nodes are concepts (each `part-of` one
 * topic, chosen deterministically), the rest are source pages (paper/blog/
 * video/podcast, round-robin) each carrying exactly 2 relations to
 * concepts and a `by` org entry.
 *
 * Fully deterministic (seeded by `n` and position only, no `Math.random`)
 * so `synthIndex(n)` called twice returns byte-identical JSON — needed for
 * the gzip-budget test to be reproducible across runs/CI.
 */
import type { GeneratedIndex, PageInfo, Edge, By } from '../../src/lib/content-index';

const TOPIC_COUNT = 10;

/** Tiny deterministic string PRNG (mulberry32), seeded, for title/summary text — not used for layout, only for content variety. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CJK_POOL =
  '智能体推理规划上下文记忆压缩检索增强工具调用多代理协作评测基准安全对齐强化学习微调蒸馏' +
  '向量数据库知识图谱提示词链式思考自我反思长期记忆短期记忆任务分解环境模拟仿真训练数据集合成';

/** A deterministic Chinese string of exactly `len` characters, offset by `offset` so different calls don't repeat the same run. */
function cjkString(len: number, offset: number): string {
  let out = '';
  for (let i = 0; i < len; i++) {
    out += CJK_POOL[(offset + i) % CJK_POOL.length];
  }
  return out;
}

/** A deterministic title: a 2-character kind prefix plus `cjkString`, total length clamped to `[8, 20]` by `i`. */
function titleFor(kind: string, i: number): string {
  const bodyLen = 6 + (i % 13); // 6..18, so prefix(2) + body = 8..20
  return `${kind}${cjkString(bodyLen, i * 7)}`;
}

const ORG_NAMES = ['清华大学', 'OpenAI', 'DeepMind', '上海 AI 实验室', 'Anthropic', '北京智源研究院'];

const SOURCE_TYPES = ['paper', 'blog', 'video', 'podcast'] as const;

/** `YYYY-MM-DD`, spread deterministically across 2022-01-01..2026-12-28 by index. */
function spreadDate(i: number, total: number): string {
  const startYear = 2022;
  const endYear = 2026;
  const totalMonths = (endYear - startYear + 1) * 12;
  const monthIndex = Math.floor((i / Math.max(total, 1)) * totalMonths) % totalMonths;
  const year = startYear + Math.floor(monthIndex / 12);
  const month = (monthIndex % 12) + 1;
  const day = 1 + (i % 28);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Build a synthetic `GeneratedIndex` with `n` total nodes (1 root topic +
 * 9 non-root topics + concepts + sources), matching the brief's fixed
 * shape: 10 topics, 15% of the rest are concepts, the rest are source
 * pages with 2 relations each.
 */
export function synthIndex(n: number): GeneratedIndex {
  const rand = mulberry32(1234567);
  // consume a few values so title/summary text isn't trivially aligned with dates
  void rand();

  const pages: Record<string, PageInfo> = {};
  const edges: Edge[] = [];

  const remaining = Math.max(n - TOPIC_COUNT, 0);
  const conceptCount = Math.round(remaining * 0.15);
  const sourceCount = remaining - conceptCount;

  // 10 topics, t0 is root (order 0).
  const topicIds: string[] = [];
  for (let i = 0; i < TOPIC_COUNT; i++) {
    const id = `wiki/topics/t${i}`;
    topicIds.push(id);
    const info: PageInfo = {
      id,
      type: 'topic',
      title: titleFor('主题', i),
      summary: cjkString(30 + (i % 31), i * 13), // 30..60
      topics: [],
      by: [],
      insights: [],
      order: i,
    };
    if (i === 0) info.root = true;
    pages[id] = info;
  }

  // Concepts: each part-of one topic (round-robin over non-root topics so the
  // root topic isn't overloaded), title/summary sized per spec.
  const conceptIds: string[] = [];
  for (let i = 0; i < conceptCount; i++) {
    const id = `wiki/concepts/c${i}`;
    conceptIds.push(id);
    const topicIndex = 1 + (i % (TOPIC_COUNT - 1));
    const topicSlug = `t${topicIndex}`;
    const info: PageInfo = {
      id,
      type: 'concept',
      title: titleFor('概念', i),
      summary: cjkString(30 + (i % 31), i * 17),
      topics: [topicSlug],
      by: [],
      insights: [],
      status: 'emerging',
    };
    pages[id] = info;
    edges.push({ from: id, to: `wiki/topics/${topicSlug}`, rel: 'part-of' });
  }

  // Sources: round-robin over paper/blog/video/podcast; each gets 2 relations
  // to concepts (proposes + extends) and one org `by` entry, plus a topic.
  for (let i = 0; i < sourceCount; i++) {
    const type = SOURCE_TYPES[i % SOURCE_TYPES.length];
    const id = `wiki/${type}s/s${i}`;
    const topicIndex = 1 + (i % (TOPIC_COUNT - 1));
    const topicSlug = `t${topicIndex}`;
    const org = ORG_NAMES[i % ORG_NAMES.length];
    const by: By[] = [{ name: org, role: 'org' }];

    const info: PageInfo = {
      id,
      type,
      title: titleFor('素材', i),
      summary: cjkString(30 + (i % 31), i * 23),
      topics: [topicSlug],
      by,
      insights: [`${cjkString(20, i * 29)}`],
      date: spreadDate(i, sourceCount),
      venue: type === 'paper' ? 'arXiv' : type === 'video' ? 'Bilibili' : type === 'podcast' ? '小宇宙' : 'Blog',
    };
    if (type === 'video' || type === 'podcast') info.duration = 10 + (i % 50);
    if (type === 'podcast') info.show = `节目${cjkString(4, i)}`;
    if (type === 'paper' || type === 'blog' || type === 'video' || type === 'podcast') {
      info.url = `https://example.com/${type}/${i}`;
    }
    pages[id] = info;

    if (conceptIds.length > 0) {
      const c1 = conceptIds[i % conceptIds.length];
      const c2 = conceptIds[(i + 1) % conceptIds.length];
      edges.push({ from: id, to: c1, rel: 'proposes' });
      if (c2 !== c1) {
        edges.push({ from: id, to: c2, rel: 'extends' });
      } else {
        edges.push({ from: id, to: c1, rel: 'extends' });
      }
    }
  }

  const backlinks: Record<string, Edge[]> = {};
  for (const edge of edges) {
    const list = backlinks[edge.to] ?? [];
    list.push(edge);
    backlinks[edge.to] = list;
  }

  return {
    pages,
    edges,
    backlinks,
    redirects: {},
  };
}
