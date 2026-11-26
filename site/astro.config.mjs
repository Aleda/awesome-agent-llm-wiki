// @ts-check
import fs from 'node:fs';
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { unified } from '@astrojs/markdown-remark';
import { remarkWiki } from './src/lib/remark-wiki.ts';
import { rehypeTranscript } from './src/lib/rehype-transcript.ts';
import { toRoute } from './src/lib/routes.ts';

const INDEX_PATH = '.generated/index.json';

/**
 * Redirects from merged concept pages (`redirect_to`), read from the index the
 * prepare step writes before `astro build`. Keys are base-relative routes;
 * targets include the base. Missing index (e.g. config loaded on its own) ⇒ none.
 */
function loadRedirects() {
  let index;
  try {
    index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  } catch {
    return {};
  }
  /** @type {Record<string, string>} */
  const redirects = {};
  for (const [from, to] of Object.entries(index.redirects ?? {})) {
    redirects[`/${from}/`] = toRoute(/** @type {string} */ (to));
  }
  return redirects;
}

const SIDEBAR_GROUPS = [
  ['主题', 'wiki/topics'],
  ['概念', 'wiki/concepts'],
  ['论文', 'wiki/papers'],
  ['Blog', 'wiki/blogs'],
  ['视频', 'wiki/videos'],
  ['播客', 'wiki/podcasts'],
  ['实体', 'wiki/entities'],
];

export default defineConfig({
  site: 'https://aleda.github.io',
  base: '/awesome-agent-llm-wiki',
  redirects: loadRedirects(),
  markdown: {
    processor: unified({
      remarkPlugins: [[remarkWiki, { indexPath: INDEX_PATH, anchorsDir: 'public/data/anchors' }]],
      rehypePlugins: [rehypeTranscript],
    }),
  },
  integrations: [
    starlight({
      title: 'Agent LLM Wiki',
      defaultLocale: 'root',
      locales: { root: { label: '简体中文', lang: 'zh-CN' } },
      customCss: ['./src/styles/tokens.css'],
      // Starlight >= 0.39: a labelled group wraps the autogenerate item.
      sidebar: SIDEBAR_GROUPS.map(([label, directory]) => ({
        label,
        items: [{ autogenerate: { directory } }],
      })),
      components: {
        PageTitle: './src/components/PageTitle.astro',
      },
    }),
  ],
});
