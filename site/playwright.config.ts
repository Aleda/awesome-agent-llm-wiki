import { defineConfig, devices } from '@playwright/test';

/**
 * Task 9: hover-card + content-page layout e2e. Uses the mini repo as
 * content (same fixture the vitest suite uses) and `astro preview` to
 * serve the real built, base-pathed site.
 */
export default defineConfig({
  testDir: 'e2e',
  webServer: {
    // `astro preview` auto-backgrounds and detaches itself when it detects an
    // agent-driven shell (see astro/cli/agent.js), which breaks Playwright's
    // own process tracking; ASTRO_PREVIEW_BACKGROUND=1 keeps it foregrounded
    // under Playwright without changing the documented command/timeout.
    //
    // `url` probes the paper page rather than the bare base path: the mini
    // repo fixture has no `wiki/index.md`, so `/awesome-agent-llm-wiki/`
    // has no `index.html` and 404s even once the server is ready.
    command:
      'CONTENT_ROOT=../tests/fixtures/mini-repo npm run build && ASTRO_PREVIEW_BACKGROUND=1 npx astro preview --port 4321',
    url: 'http://localhost:4321/awesome-agent-llm-wiki/wiki/papers/202611-sample-paper/',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  use: {
    baseURL: 'http://localhost:4321',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
