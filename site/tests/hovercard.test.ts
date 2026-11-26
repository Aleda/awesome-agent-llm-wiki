import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { initHoverCards } from '../src/scripts/hovercard';

/**
 * `happy-dom` environment (vitest.config.ts). A fresh `document` per test:
 * the DOM fixture below matches the real link shapes `remarkWiki` emits —
 * internal preview links (`data-preview=".../previews/<id>.json"`),
 * glossary links (`data-preview=".../glossary.json" data-term="…"`), and
 * citation links (`class="cite" data-preview=".../anchors/<dir>.json"
 * data-key="…"`).
 */

const PREVIEW_URL = '/awesome-agent-llm-wiki/data/previews/wiki/concepts/context-compaction.json';
const GLOSSARY_URL = '/awesome-agent-llm-wiki/data/glossary.json';
const ANCHORS_URL = '/awesome-agent-llm-wiki/data/anchors/sources/papers/2611.00001.json';

let fetchMock: ReturnType<typeof vi.fn>;
let cleanup: (() => void) | undefined;
let link: HTMLAnchorElement;
let termLink: HTMLAnchorElement;
let citeLink: HTMLAnchorElement;

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
}

/** Dispatch a bubbling pointerenter-equivalent: hovercard.ts delegates via mouseover/pointerover. */
function hover(el: Element): void {
  const rect = { top: 100, bottom: 120, left: 10, right: 60, width: 50, height: 20 } as DOMRect;
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(rect);
  el.dispatchEvent(new Event('pointerover', { bubbles: true }));
}

function leave(el: Element): void {
  el.dispatchEvent(new Event('pointerout', { bubbles: true }));
}

/** First tap previews (preventDefault); caller can tap again to navigate. */
function tap(el: Element): Event {
  const rect = { top: 100, bottom: 120, left: 10, right: 60, width: 50, height: 20 } as DOMRect;
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(rect);
  el.dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'touch' }),
  );
  const click = new MouseEvent('click', { bubbles: true, cancelable: true });
  el.dispatchEvent(click);
  return click;
}

beforeEach(() => {
  document.body.innerHTML = `
    <a id="link" href="/awesome-agent-llm-wiki/wiki/concepts/context-compaction/" data-preview="${PREVIEW_URL}">上下文压缩</a>
    <a id="term" href="/awesome-agent-llm-wiki/wiki/glossary/#browsecomp-plus" data-preview="${GLOSSARY_URL}" data-term="browsecomp-plus">BrowseComp-Plus</a>
    <a id="cite" class="cite" href="https://arxiv.org/abs/2611.00001" data-preview="${ANCHORS_URL}" data-key="00:01:02">00:01:02</a>
    <a id="plain" href="/awesome-agent-llm-wiki/wiki/topics/context/">Context</a>
  `;
  link = document.getElementById('link') as HTMLAnchorElement;
  termLink = document.getElementById('term') as HTMLAnchorElement;
  citeLink = document.getElementById('cite') as HTMLAnchorElement;

  fetchMock = vi.fn(async (url: string) => {
    if (url === PREVIEW_URL) {
      return json({
        id: 'wiki/concepts/context-compaction',
        type: 'concept',
        title: '上下文压缩',
        summary: '把历史对话压缩为更短表示，减少上下文占用。',
        topics: ['context'],
      });
    }
    if (url === GLOSSARY_URL) {
      return json({ 'browsecomp-plus': { term: 'BrowseComp-Plus', text: '一个用于评估浏览与检索能力的基准测试集合。' } });
    }
    if (url === ANCHORS_URL) {
      return json({ '00:01:02': { text: '第二段', href: 'https://example.com' } });
    }
    return new Response('', { status: 404 });
  });

  vi.useFakeTimers();
  cleanup = initHoverCards(document, { fetch: fetchMock as unknown as typeof fetch });
});

afterEach(() => {
  cleanup?.();
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('initHoverCards', () => {
  test('leaving within 150ms cancels the request', () => {
    hover(link);
    vi.advanceTimersByTime(100);
    leave(link);
    vi.advanceTimersByTime(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('hovering 150ms shows card with title and summary', async () => {
    hover(link);
    await vi.advanceTimersByTimeAsync(150);
    expect(document.querySelector('.hovercard')!.textContent).toContain('上下文压缩');
  });

  test('same url fetched once', async () => {
    for (let i = 0; i < 3; i++) {
      hover(link);
      await vi.advanceTimersByTimeAsync(150);
      leave(link);
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('404 shows nothing and does not throw', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 404 }));
    hover(link);
    await vi.advanceTimersByTimeAsync(150);
    expect(document.querySelector('.hovercard')).toBeNull();
  });

  test('glossary card picks the term', async () => {
    hover(termLink);
    await vi.advanceTimersByTimeAsync(150);
    expect(document.querySelector('.hovercard')!.textContent).toContain('BrowseComp-Plus');
  });

  test('anchor card shows source text', async () => {
    hover(citeLink);
    await vi.advanceTimersByTimeAsync(150);
    expect(document.querySelector('.hovercard')!.textContent).toContain('第二段');
  });

  test('first touch tap previews, second navigates', async () => {
    expect(tap(link).defaultPrevented).toBe(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(tap(link).defaultPrevented).toBe(false);
  });

  test('content is inserted as text, not HTML', async () => {
    fetchMock.mockResolvedValue(
      json({
        id: 'wiki/concepts/context-compaction',
        type: 'concept',
        title: '<img src=x onerror=alert(1)>',
        summary: 's',
        topics: [],
      }),
    );
    hover(link);
    await vi.advanceTimersByTimeAsync(150);
    expect(document.querySelector('.hovercard img')).toBeNull();
  });
});
