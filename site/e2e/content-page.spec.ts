import { expect, test } from '@playwright/test';

/**
 * Task 9 e2e: hover preview card + the MetaCard/SourceCard responsive
 * layout (Task 7) on the real built mini-repo site. The paper page
 * (`wiki/papers/202611-sample-paper`) links to the concept `上下文压缩`,
 * whose preview summary mentions `压缩`, and carries both a `.meta-card`
 * and a `.source-card` (see `PageTitle.astro`).
 */

const PAPER_PATH = '/awesome-agent-llm-wiki/wiki/papers/202611-sample-paper/';

test('hovering the concept link shows a preview card with the summary', async ({ page }) => {
  await page.goto(PAPER_PATH);

  const link = page.locator('a[data-preview*="context-compaction"]').first();
  await link.scrollIntoViewIfNeeded();
  await link.hover();

  const card = page.locator('.hovercard');
  await expect(card).toBeVisible();
  await expect(card).toContainText('压缩');
});

test('narrow viewport stacks MetaCard above SourceCard', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto(PAPER_PATH);

  const metaBox = await page.locator('.meta-card').boundingBox();
  const sourceBox = await page.locator('.source-card').boundingBox();
  expect(metaBox).not.toBeNull();
  expect(sourceBox).not.toBeNull();
  expect(metaBox!.y).toBeLessThan(sourceBox!.y);
});

test('wide viewport places MetaCard and SourceCard side by side', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(PAPER_PATH);

  const metaBox = await page.locator('.meta-card').boundingBox();
  const sourceBox = await page.locator('.source-card').boundingBox();
  expect(metaBox).not.toBeNull();
  expect(sourceBox).not.toBeNull();
  expect(metaBox!.y).toBe(sourceBox!.y);
});
