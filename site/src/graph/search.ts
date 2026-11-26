/**
 * Instant node search for the homepage graph (Task 13, spec §8.5 / brief).
 *
 * `searchNodes` scores every candidate node against a free-text query and
 * returns the best matches, most relevant first. It is pure (no DOM, no
 * fetch) so `main.ts` can call it on every keystroke; the Pagefind full-text
 * fallback lives in `main.ts` itself since it needs a dynamic `import()`.
 */
import type { GNode } from './build';
import type { PageId } from '../lib/content-index';

/** Tie order when two nodes score the same (brief, binding): topic (incl. root) > concept > source types > entity. */
const TYPE_RANK: Record<GNode['t'], number> = {
  topic: 0,
  concept: 1,
  paper: 2,
  blog: 2,
  video: 2,
  podcast: 2,
  entity: 3,
  raw: 4,
};

/** `s.normalize('NFKC').toLowerCase().trim()` (brief, binding, verbatim). */
function normalize(s: string): string {
  return s.normalize('NFKC').toLowerCase().trim();
}

/**
 * Match score for `node` against the normalised query `q` (already
 * non-empty): title prefix 3, title contains 2, any alias contains 2,
 * summary contains 1; 0 when none match (brief, binding).
 */
function scoreNode(node: GNode, q: string, aliases: string[]): number {
  const title = normalize(node.l);
  if (title.startsWith(q)) return 3;
  let score = 0;
  if (title.includes(q)) score = Math.max(score, 2);
  for (const alias of aliases) {
    if (normalize(alias).includes(q)) {
      score = Math.max(score, 2);
      break;
    }
  }
  if (score === 0 && node.s && normalize(node.s).includes(q)) score = 1;
  return score;
}

/**
 * Best `limit` nodes matching `q` in `nodes`, most relevant first (brief,
 * binding): `q` is NFKC-normalised, lower-cased and trimmed first; an
 * empty/whitespace-only query returns `[]` without scoring anything. Ties
 * break by type (`TYPE_RANK`), then by title (`localeCompare`).
 */
export function searchNodes(
  q: string,
  nodes: GNode[],
  aliases: Record<PageId, string[]>,
  limit = 8,
): GNode[] {
  const query = normalize(q);
  if (query === '') return [];

  const scored: { node: GNode; score: number }[] = [];
  for (const node of nodes) {
    const score = scoreNode(node, query, aliases[node.id] ?? []);
    if (score > 0) scored.push({ node, score });
  }

  scored.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    const ra = TYPE_RANK[a.node.t];
    const rb = TYPE_RANK[b.node.t];
    if (ra !== rb) return ra - rb;
    return a.node.l.localeCompare(b.node.l);
  });

  return scored.slice(0, limit).map((x) => x.node);
}
