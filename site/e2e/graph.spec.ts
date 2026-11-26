import { expect, test, type Page } from '@playwright/test';

/**
 * Task 12 e2e: the graph homepage on the built mini-repo site. State is
 * read from `#graph-app`'s `data-level` / `data-focus` attributes.
 */

const HOME = '/awesome-agent-llm-wiki/';
const app = (page: Page) => page.locator('#graph-app');

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
  // Context topic is straight above Agent on the ring (world (0, -1000)); find it on screen.
  const pos = await page.evaluate(() => {
    const c = document.querySelector('canvas.graph-canvas') as HTMLCanvasElement;
    const w = c.clientWidth;
    const h = c.clientHeight;
    const k = Math.min(0.35, Math.min(w, h) / 2 / 1150);
    return { x: w / 2, y: h / 2 - 1000 * k };
  });
  await page.mouse.click(pos.x, pos.y);
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
