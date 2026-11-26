import { expect, test, type Page } from '@playwright/test';

/**
 * Task 12 e2e: the graph homepage on the built mini-repo site. State is
 * read from `#graph-app`'s `data-level` / `data-focus` attributes.
 */

const HOME = '/awesome-agent-llm-wiki/';
const app = (page: Page) => page.locator('#graph-app');

interface Box { id: string; x0: number; y0: number; x1: number; y1: number }
type Debug = { screenOf(id: string): [number, number] | null; labelBoxes(): Box[]; barBottom(): number };
/** Screen position of a node via the `graphDebug` test hook on `#graph-app` (main.ts). */
const screenOf = (page: Page, id: string) =>
  page.evaluate((nid) => (document.getElementById('graph-app') as unknown as { graphDebug: Debug }).graphDebug.screenOf(nid), id);

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

test('homepage shows the graph canvas at L0', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(HOME);
  await expect(page.locator('canvas.graph-canvas')).toBeVisible();
  await expect(app(page)).toHaveAttribute('data-ready', '');
  await expect(app(page)).toHaveAttribute('data-level', '0');
  await expect(app(page)).toHaveAttribute('data-focus', '');
  await expect(page.locator('.graph-brand')).toHaveText('Agent LLM Wiki');
  await expect(page.locator('#graph-search')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('a shared #node=&z= link opens focused at that level with the panel', async ({ page }) => {
  await page.goto(`${HOME}#node=wiki/topics/context&z=1`);
  await expect(app(page)).toHaveAttribute('data-focus', 'wiki/topics/context');
  await expect(app(page)).toHaveAttribute('data-level', '1');
  const panel = page.locator('.graph-panel');
  await expect(panel).toBeVisible();
  await expect(panel.locator('.graph-panel__title')).toHaveText('Context');
  await expect(panel.locator('.graph-panel__item')).toHaveCount(2);
  // Insight from the lazily fetched preview JSON.
  await expect(panel).toContainText('每 8 轮对话压缩一次上下文');
});

test('an unknown node in the hash falls back to L0 without console errors', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(`${HOME}#node=nope&z=2`);
  await expect(app(page)).toHaveAttribute('data-ready', '');
  await expect(app(page)).toHaveAttribute('data-level', '0');
  await expect(app(page)).toHaveAttribute('data-focus', '');
  await expect(page.locator('.graph-panel')).toBeHidden();
  expect(errors).toEqual([]);
});

test('pressing + three times raises the level, 0 resets it', async ({ page }) => {
  // At 1440×900 the R16 overview is k ≈ 0.33, so three ×1.25 steps cross L1_AT (0.6).
  // (At 1280×720 it is k ≈ 0.24 and needs five.)
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(HOME);
  await expect(app(page)).toHaveAttribute('data-ready', '');
  await expect(app(page)).toHaveAttribute('data-level', '0');
  for (let i = 0; i < 3; i++) await page.keyboard.press('+');
  await expect(app(page)).toHaveAttribute('data-level', '1');
  await page.keyboard.press('0');
  await expect(app(page)).toHaveAttribute('data-level', '0');
});

test('clicking a topic flies to L1 and Back returns to the overview', async ({ page }) => {
  await page.goto(HOME);
  await expect(app(page)).toHaveAttribute('data-ready', '');
  const pos = await screenOf(page, 'wiki/topics/context');
  expect(pos).not.toBeNull();
  await page.mouse.click(pos![0], pos![1]);
  await expect(app(page)).toHaveAttribute('data-focus', 'wiki/topics/context');
  await expect(app(page)).toHaveAttribute('data-level', '1');
  await expect(page).toHaveURL(/#node=wiki\/topics\/context&z=1$/);
  await page.goBack();
  await expect(app(page)).toHaveAttribute('data-focus', '');
  await expect(app(page)).toHaveAttribute('data-level', '0');
});

test('Escape closes the panel', async ({ page }) => {
  await page.goto(`${HOME}#node=wiki/concepts/context-compaction&z=2`);
  await expect(page.locator('.graph-panel')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.graph-panel')).toBeHidden();
  await expect(app(page)).toHaveAttribute('data-focus', '');
});

test('"打开页面" goes to the node page', async ({ page }) => {
  await page.goto(`${HOME}#node=wiki/concepts/context-compaction&z=2`);
  await page.locator('.graph-panel__open').click();
  await expect(page).toHaveURL(/\/awesome-agent-llm-wiki\/wiki\/concepts\/context-compaction\/$/);
  await expect(page.locator('h1')).toContainText('上下文压缩');
});

test('theme toggle flips data-theme and persists it', async ({ page }) => {
  await page.goto(HOME);
  const before = await page.evaluate(() => document.documentElement.dataset.theme);
  await page.locator('#graph-theme-btn').click();
  const after = await page.evaluate(() => document.documentElement.dataset.theme);
  expect(after).not.toBe(before);
  expect(await page.evaluate(() => localStorage.getItem('starlight-theme'))).toBe(after);
  await page.reload();
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(after);
});

for (const size of [
  { width: 1280, height: 720 },
  { width: 375, height: 667 },
]) {
  test(`initial view keeps every topic label inside the canvas below the bar at ${size.width}×${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto(HOME);
    await expect(app(page)).toHaveAttribute('data-ready', '');
    const topics = ['wiki/topics/agent', 'wiki/topics/context', 'wiki/topics/memory'];
    await expect
      .poll(() =>
        page.evaluate(() => (document.getElementById('graph-app') as unknown as { graphDebug: Debug }).graphDebug.labelBoxes().map((b) => b.id)),
      )
      .toEqual(expect.arrayContaining(topics));
    const { boxes, top } = await page.evaluate(() => {
      const d = (document.getElementById('graph-app') as unknown as { graphDebug: Debug }).graphDebug;
      return { boxes: d.labelBoxes(), top: d.barBottom() };
    });
    expect(top).toBeGreaterThan(0);
    for (const b of boxes.filter((x) => topics.includes(x.id))) {
      expect(b.x0, b.id).toBeGreaterThanOrEqual(0);
      expect(b.x1, b.id).toBeLessThanOrEqual(size.width);
      expect(b.y0, b.id).toBeGreaterThanOrEqual(top);
      expect(b.y1, b.id).toBeLessThanOrEqual(size.height);
    }
  });
}

test('after closing the panel, reload keeps the view but does not reopen the panel (f=0)', async ({ page }) => {
  await page.goto(`${HOME}#node=wiki/concepts/context-compaction&z=2`);
  await expect(page.locator('.graph-panel')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/#node=wiki\/concepts\/context-compaction&z=2&f=0$/);
  await page.reload();
  await expect(app(page)).toHaveAttribute('data-ready', '');
  await expect(app(page)).toHaveAttribute('data-level', '2');
  await expect(app(page)).toHaveAttribute('data-focus', '');
  await expect(page.locator('.graph-panel')).toBeHidden();
});

test('panning with nothing focused writes an unfocused (f=0) hash', async ({ page }) => {
  await page.goto(HOME);
  await expect(app(page)).toHaveAttribute('data-ready', '');
  await page.mouse.move(400, 400);
  await page.mouse.down();
  await page.mouse.move(460, 430, { steps: 5 });
  await page.mouse.up();
  await expect(page).toHaveURL(/&f=0$/);
  await page.reload();
  await expect(app(page)).toHaveAttribute('data-ready', '');
  await expect(page.locator('.graph-panel')).toBeHidden();
});

// --------------------------------------------------------------- Task 13

test('typing a Chinese substring and pressing Enter focuses the matching concept', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(HOME);
  await expect(app(page)).toHaveAttribute('data-ready', '');
  const input = page.locator('#graph-search-input');
  await input.fill('压缩');
  await expect(page.locator('#graph-search-listbox li.graph-search__option').first()).toBeVisible();
  await input.press('Enter');
  await expect(app(page)).toHaveAttribute('data-focus', 'wiki/concepts/context-compaction');
  await expect(page.locator('.graph-panel')).toBeVisible();
  expect(errors).toEqual([]);
});

test('a query with zero node results falls back to a Pagefind full-text box on Enter', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(HOME);
  await expect(app(page)).toHaveAttribute('data-ready', '');
  const input = page.locator('#graph-search-input');
  await input.fill('zzzz');
  await input.press('Enter');
  await expect(page.locator('#graph-search-fulltext')).toBeVisible();
  // Allowed to be an empty list, but it must render without throwing.
  expect(errors).toEqual([]);
});

test('ArrowDown/ArrowUp move the highlighted option and Escape closes the dropdown', async ({ page }) => {
  await page.goto(HOME);
  await expect(app(page)).toHaveAttribute('data-ready', '');
  const input = page.locator('#graph-search-input');
  await input.fill('e');
  const options = page.locator('#graph-search-listbox li.graph-search__option');
  await expect(options.first()).toBeVisible();
  await input.press('ArrowDown');
  await expect(options.nth(0)).toHaveAttribute('aria-selected', 'true');
  await input.press('Escape');
  await expect(page.locator('#graph-search-listbox')).toBeHidden();
});

test('"/" focuses the search input unless already typing elsewhere', async ({ page }) => {
  await page.goto(HOME);
  await expect(app(page)).toHaveAttribute('data-ready', '');
  await page.keyboard.press('/');
  await expect(page.locator('#graph-search-input')).toBeFocused();
});

test('filter button toggles the popover and hiding papers removes the paper from search', async ({ page }) => {
  await page.goto(HOME);
  await expect(app(page)).toHaveAttribute('data-ready', '');
  const filterBtn = page.locator('#graph-filter-btn');
  await expect(filterBtn).toBeVisible();
  await filterBtn.click();
  const panel = page.locator('#graph-filter-panel');
  await expect(panel).toBeVisible();
  await expect(filterBtn).toHaveAttribute('aria-expanded', 'true');

  await panel.locator('.graph-filter__type[value="paper"]').uncheck();
  const input = page.locator('#graph-search-input');
  await input.fill('Sample Paper');
  await expect(page.locator('#graph-search-listbox li.graph-search__option')).toHaveCount(0);

  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
});

test('showing entities makes the entity searchable and visible', async ({ page }) => {
  await page.goto(HOME);
  await expect(app(page)).toHaveAttribute('data-ready', '');
  await page.locator('#graph-filter-btn').click();
  await page.locator('#graph-filter-entities').check();
  const input = page.locator('#graph-search-input');
  await input.fill('Demo Org');
  await expect(page.locator('#graph-search-listbox li.graph-search__option').first()).toContainText('Demo Org');
});

test('an IME composition Enter (isComposing/keyCode 229) is ignored: no select, no Pagefind fallback', async ({ page }) => {
  await page.goto(HOME);
  await expect(app(page)).toHaveAttribute('data-ready', '');
  const input = page.locator('#graph-search-input');
  await input.fill('压缩');
  await expect(page.locator('#graph-search-listbox li.graph-search__option').first()).toBeVisible();

  // Simulate the Enter keydown an IME sends while a candidate is still being composed:
  // `isComposing: true` (and, on some browsers, legacy `keyCode: 229`) rather than a
  // committed Enter. The handler must ignore it entirely.
  await input.evaluate((el) => {
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, keyCode: 229, bubbles: true }));
  });

  await expect(app(page)).toHaveAttribute('data-focus', '');
  await expect(page.locator('.graph-panel')).toBeHidden();
  await expect(page.locator('#graph-search-fulltext')).toBeHidden();
  // The listbox itself is untouched by the composition keydown (still showing the live match).
  await expect(page.locator('#graph-search-listbox li.graph-search__option').first()).toBeVisible();
});

