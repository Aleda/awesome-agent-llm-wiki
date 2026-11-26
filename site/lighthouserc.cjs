/**
 * Lighthouse CI config (Task 14, global-constraints.md: "移动端 Lighthouse
 * Performance ≥ 95"). URLs are computed at load time (this file is loaded
 * by `lhci autorun`/`lhci collect` as a regular CommonJS module, so a
 * top-level `require`/sync read runs before Lighthouse starts) from
 * `.generated/index.json`, written by `npm run prepare-content` — always
 * the homepage, plus the first paper/blog/podcast page found there
 * (whichever types exist; a near-empty real-content repo has none of
 * these, so it's just the homepage).
 *
 * `startServerCommand` runs `astro preview` with `ASTRO_PREVIEW_BACKGROUND=1`
 * (see playwright.config.ts for why: astro auto-backgrounds itself under an
 * agent-driven shell, which breaks a tool's own process tracking).
 */
const fs = require('node:fs');
const path = require('node:path');

const BASE = '/awesome-agent-llm-wiki';
const PORT = 4321;
const ORIGIN = `http://localhost:${PORT}`;
const INDEX_PATH = path.join(__dirname, '.generated/index.json');

/** Mirrors `src/lib/routes.ts#toRoute`, duplicated here because this file must stay plain CommonJS (no project TS imports). */
function toRoute(id) {
  if (id === 'index' || id === '') return `${BASE}/`;
  const p = id.endsWith('/index') ? id.slice(0, -'/index'.length) : id;
  return `${BASE}/${p}/`;
}

/** First page of `type`, in `index.json` key order (stable: `prepare.ts` writes `pages` from a `Map` built by `loadRepo`'s deterministic directory walk). */
function firstOfType(pages, type) {
  for (const id of Object.keys(pages)) {
    if (pages[id].type === type) return id;
  }
  return undefined;
}

function collectUrls() {
  const urls = [`${ORIGIN}${BASE}/`];

  let index;
  try {
    index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  } catch {
    return urls; // no index yet (e.g. config loaded standalone): homepage only
  }

  for (const type of ['paper', 'blog', 'podcast']) {
    const id = firstOfType(index.pages ?? {}, type);
    if (id !== undefined) urls.push(`${ORIGIN}${toRoute(id)}`);
  }

  return urls;
}

module.exports = {
  ci: {
    collect: {
      url: collectUrls(),
      startServerCommand: `ASTRO_PREVIEW_BACKGROUND=1 npx astro preview --port ${PORT}`,
      startServerReadyPattern: 'Local',
      numberOfRuns: 3,
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.95 }],
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: '.lighthouseci',
    },
  },
};
