/** Base path the site is served from (GitHub Pages project page). */
export const BASE = '/awesome-agent-llm-wiki';

/**
 * Build a site route for a page id. `hash` should include the leading `#`
 * when present (e.g. `#定义`), or be omitted / empty for none.
 *
 * Mirrors Starlight's `slugToParam`: a trailing `/index` segment is dropped
 * (`wiki/index` is served at `/wiki/`) and a bare `index` is the base root.
 */
export function toRoute(id: string, hash = ''): string {
  if (id === 'index' || id === '') return `${BASE}/${hash}`;
  const path = id.endsWith('/index') ? id.slice(0, -'/index'.length) : id;
  return `${BASE}/${path}/${hash}`;
}

/**
 * Follow a redirect chain (`redirects[from] = to`) to its final id. Bounded
 * and cycle-safe: on a cycle it stops at the first repeated id. The prepare
 * step already rejects broken or cyclic chains; this only guards consumers.
 */
export function followRedirects(redirects: Record<string, string>, id: string): string {
  const seen = new Set<string>();
  let current = id;
  while (redirects[current] !== undefined && !seen.has(current)) {
    seen.add(current);
    current = redirects[current];
  }
  return current;
}

/**
 * Astro `redirects` config from index.json `redirects`: keys are
 * base-relative routes, targets are full routes, and chains are collapsed
 * so every source points straight at its final page (A→B→C emits A→C).
 */
export function redirectRoutes(redirects: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const from of Object.keys(redirects)) {
    out[toRoute(from).slice(BASE.length)] = toRoute(followRedirects(redirects, from));
  }
  return out;
}
