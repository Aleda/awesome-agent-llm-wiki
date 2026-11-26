import { defineCollection } from 'astro:content';
import type { Loader } from 'astro/loaders';
import { z } from 'astro/zod';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { PAGE_TYPES } from './lib/schema';

/**
 * Wiki frontmatter fields (Task 2), all optional and passthrough. Starlight's
 * `extend` cannot take a discriminated union, so strict per-type validation
 * lives in the prepare step (`loadRepo`), which fails before the build starts.
 * YAML parses bare dates into `Date`, so date fields accept both forms.
 */
const dateLike = z.union([z.string(), z.date()]);

const pageExtension = z
  .object({
    type: z.enum(PAGE_TYPES),
    summary: z.string(),
    topics: z.array(z.string()),
    aliases: z.array(z.string()),
    added: dateLike,
    date: dateLike,
    url: z.string(),
    source_dir: z.string(),
    venue: z.string(),
    by: z.array(z.record(z.string(), z.unknown())),
    relations: z.array(z.record(z.string(), z.unknown())),
    code: z.string(),
    pages: z.number(),
    duration: z.number(),
    show: z.string(),
    status: z.string(),
    redirect_to: z.string(),
    root: z.boolean(),
    order: z.number(),
    raw: z.record(z.string(), z.unknown()),
  })
  .partial()
  .passthrough();

/**
 * Entry id = docs-relative path without extension, kept verbatim. Starlight's
 * default slugifies each segment (`2611.00001` -> `261100001`, uppercase ->
 * lowercase), which would break `toRoute(id)` links into `sources/**`.
 */
const generateId = ({ entry }: { entry: string }) => entry.replace(/\.(md|mdx)$/, '');

/**
 * Starlight's docs loader minus merged concept pages (`redirect_to`): their
 * route belongs to the redirect generated in astro.config.mjs, so rendering
 * them as well would collide with it.
 */
function wikiDocsLoader(): Loader {
  const inner = docsLoader({ generateId });
  return {
    name: 'wiki-docs-loader',
    load: async (context) => {
      await inner.load(context);
      for (const [id, entry] of context.store.entries()) {
        if (typeof (entry.data as { redirect_to?: unknown }).redirect_to === 'string') {
          context.store.delete(id);
        }
      }
    },
  };
}

export const collections = {
  docs: defineCollection({
    loader: wikiDocsLoader(),
    schema: docsSchema({ extend: pageExtension }),
  }),
};
