/**
 * Graph filters (Task 13, spec §8.5 / brief): which nodes a type/date/rel/
 * entity filter set makes visible, and the default filter state.
 *
 * `applyFilters` is pure and returns a brand-new `Set` every call; `main.ts`
 * copies it into the stable `visible` Set it hands the renderer (clear +
 * add) so the renderer/quadtree/culling code never has to special-case a
 * freshly-allocated Set per frame.
 *
 * Browser code: only `import type` from `../lib/schema` — a value import
 * there pulls in `astro/zod`, which must never reach the graph bundle (see
 * build.ts's module doc for the same rule re d3-force). `REL`'s runtime
 * values come from `REL_LABEL`'s keys instead, the same trick
 * `interaction.ts` uses for `REL_BY`.
 */
import type { GraphData } from './build';
import type { PageId } from '../lib/content-index';
import type { PageType, Rel } from '../lib/schema';
import { REL_LABEL } from '../lib/labels';

/** Every `Rel`, in schema order (`REL_LABEL`'s keys are declared in that order). */
const ALL_RELS = Object.keys(REL_LABEL) as Rel[];

/** The 4 source (素材) types, in the brief's checkbox order (论文 Blog 视频 播客). */
export const SOURCE_TYPES = ['paper', 'blog', 'video', 'podcast'] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export interface Filters {
  types: Set<SourceType>;
  from?: string;
  to?: string;
  rels: Set<Rel>;
  entities: boolean;
}

/** Four source types and every `rel` selected, entities off (brief, binding). */
export const DEFAULT_FILTERS: Filters = {
  types: new Set(SOURCE_TYPES),
  rels: new Set(ALL_RELS),
  entities: false,
};

const isSourceType = (t: PageType): t is SourceType => (SOURCE_TYPES as readonly PageType[]).includes(t);

/**
 * `{ from, to }` with the two swapped if both are set and `from > to`
 * (a user can type the "到" month before the "从" month, or set an earlier
 * "从" after a later "到" was already set); otherwise returned unchanged.
 * Pure, so `main.ts` can call it on every `change` before storing the
 * values back into the UI and into `Filters`.
 */
export function normalizeDateRange(from: string | undefined, to: string | undefined): { from?: string; to?: string } {
  if (from !== undefined && to !== undefined && from > to) return { from: to, to: from };
  return { from, to };
}

/**
 * Nodes visible under filter set `f` (brief, binding): root/topics/concepts
 * are always visible; a source is visible when its type is selected and its
 * date (`d.slice(0, 7)`, `YYYY-MM`) falls within `[from, to]` inclusive —
 * sources with no `d` are always kept; entities are visible only when
 * `f.entities` is true. `rels` is read by `main.ts`/`render.ts` to gate
 * which edges draw, not which nodes are visible, so it is not consulted
 * here.
 */
export function applyFilters(data: GraphData, f: Filters): Set<PageId> {
  const out = new Set<PageId>();
  for (const n of data.nodes) {
    if (n.t === 'topic' || n.t === 'concept') {
      out.add(n.id);
      continue;
    }
    if (n.t === 'entity') {
      if (f.entities) out.add(n.id);
      continue;
    }
    if (isSourceType(n.t)) {
      if (!f.types.has(n.t)) continue;
      if (n.d !== undefined) {
        const ym = n.d.slice(0, 7);
        if (f.from !== undefined && ym < f.from) continue;
        if (f.to !== undefined && ym > f.to) continue;
      }
      out.add(n.id);
    }
  }
  return out;
}
