/** Base path the site is served from (GitHub Pages project page). */
export const BASE = '/awesome-agent-llm-wiki';

/**
 * Build a site route for a page id. `hash` should include the leading `#`
 * when present (e.g. `#定义`), or be omitted / empty for none.
 */
export function toRoute(id: string, hash = ''): string {
  return `${BASE}/${id}/${hash}`;
}
