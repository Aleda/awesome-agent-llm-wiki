import { z } from 'astro/zod';

/**
 * Edge relation kinds (see CLAUDE.md §关系（边）and spec §5.1 / §6.2).
 * `by` (source → entity) is a separate frontmatter field, not part of this enum.
 */
export const REL = [
  'proposes',
  'extends',
  'supports',
  'challenges',
  'applies',
  'explains',
  'responds',
  'part-of',
  'alternative-to',
] as const;

export type Rel = (typeof REL)[number];

/** Page kinds recognised by the wiki (spec §6.1). */
export const PAGE_TYPES = [
  'topic',
  'concept',
  'paper',
  'blog',
  'video',
  'podcast',
  'entity',
  'raw',
] as const;

export type PageType = (typeof PAGE_TYPES)[number];

/**
 * ISO date string `YYYY-MM-DD`. Accepts a JS `Date` too (gray-matter/YAML
 * parsers may coerce bare dates) and normalizes it back to the string form so
 * `added`/`date` are always plain strings on the parsed object.
 */
const isoDateString = z
  .union([z.string(), z.date()])
  .transform((value) => (value instanceof Date ? value.toISOString().slice(0, 10) : value))
  .pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD'));

/** One edge declared in a page's `relations` list. Exactly one target key. */
export const relationSchema = z
  .object({
    concept: z.string().optional(),
    source: z.string().optional(),
    topic: z.string().optional(),
    rel: z.enum(REL),
    note: z.string().optional(),
  })
  .refine((relation) => {
    const targets = [relation.concept, relation.source, relation.topic].filter(
      (target) => target !== undefined,
    );
    return targets.length === 1;
  }, 'relation must have exactly one of concept, source, or topic');

/** One entry in a source page's `by` list: author, org, host, guest, or speaker. */
export const bySchema = z
  .object({
    entity: z.string().optional(),
    name: z.string().optional(),
    role: z.enum(['org', 'author', 'host', 'guest', 'speaker']),
    bio: z.string().optional(),
  })
  .refine((by) => by.entity !== undefined || by.name !== undefined, {
    message: 'by entry needs entity or name',
  });

const commonFields = {
  title: z.string(),
  summary: z.string().max(60),
  topics: z.array(z.string()).default([]),
  aliases: z.array(z.string()).default([]),
  added: isoDateString,
};

/** An absolute `http://` or `https://` URL — rendered as a link href, so no `javascript:`/`data:`/relative values. */
const httpUrl = z.string().refine((v) => /^https?:\/\//i.test(v), { message: 'must start with http:// or https://' });

/** Shared fields across every "source" (素材) page type: paper, blog, video, podcast. */
const sourceFields = {
  ...commonFields,
  date: isoDateString,
  url: httpUrl,
  source_dir: z.string(),
  venue: z.string(),
  by: z.array(bySchema).default([]),
  relations: z.array(relationSchema).min(1),
};

const paperSchema = z.object({
  ...sourceFields,
  type: z.literal('paper'),
  code: httpUrl.optional(),
  pages: z.number().optional(),
});

const blogSchema = z.object({
  ...sourceFields,
  type: z.literal('blog'),
});

const videoSchema = z.object({
  ...sourceFields,
  type: z.literal('video'),
  duration: z.number(),
});

const podcastSchema = z
  .object({
    ...sourceFields,
    type: z.literal('podcast'),
    duration: z.number(),
    show: z.string(),
  })
  .refine((page) => page.by.some((by) => by.role === 'host'), {
    message: 'podcast needs at least one host in by',
  })
  .refine((page) => page.by.some((by) => by.role === 'guest'), {
    message: 'podcast needs at least one guest in by',
  });

const conceptSchema = z.object({
  ...commonFields,
  type: z.literal('concept'),
  status: z.enum(['emerging', 'established']).default('emerging'),
  redirect_to: z.string().optional(),
  relations: z.array(relationSchema).min(1),
});

const topicSchema = z.object({
  ...commonFields,
  type: z.literal('topic'),
  root: z.boolean().optional(),
  order: z.number().optional(),
});

const entitySchema = z.object({
  ...commonFields,
  type: z.literal('entity'),
});

/** `type: raw` pages need only `title`; everything else passes through untouched (ruling R1). */
const rawSchema = z
  .object({
    title: z.string(),
    type: z.literal('raw'),
  })
  .passthrough();

export const pageSchema = z.discriminatedUnion('type', [
  paperSchema,
  blogSchema,
  videoSchema,
  podcastSchema,
  conceptSchema,
  topicSchema,
  entitySchema,
  rawSchema,
]);

export type PageFrontmatter = z.infer<typeof pageSchema>;
