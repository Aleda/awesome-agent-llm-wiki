/**
 * Hover preview cards for internal links, glossary terms and citations
 * (Task 9). Delegates events on `document` so it works for any link the
 * page renders, including Astro-hydrated card components.
 *
 * Link shapes produced by `remarkWiki` / `MetaCard` / `SourceCard`:
 * - internal page: `data-preview=".../previews/<PageId>.json"` → JSON
 *   `{ id, type, title, summary, topics, insight? }`.
 * - glossary term: `data-preview=".../glossary.json" data-term="<slug>"`
 *   → JSON `Record<slug, { term, text }>`.
 * - citation: `class="cite" data-preview=".../anchors/<dir>.json"
 *   data-key="<key>"` → JSON `Record<key, { text, href }>`.
 *
 * Fetches are cached by `data-preview` URL (one request per URL for the
 * page's lifetime); a failed/404 fetch caches `null` and the card shows
 * nothing for any key looked up in it. All card content is set via
 * `textContent`, never `innerHTML`, so a hostile title/summary can't inject
 * markup.
 */

const TYPE_LABEL: Record<string, string> = {
  topic: '主题',
  concept: '概念',
  paper: '论文',
  blog: 'Blog',
  video: '视频',
  podcast: '播客',
  entity: '实体',
  raw: '',
};

interface PreviewData {
  id: string;
  type: string;
  title: string;
  summary: string;
  topics: string[];
  insight?: string;
}

type GlossaryData = Record<string, { term: string; text: string }>;
type AnchorsData = Record<string, { text: string; href: string }>;

export interface InitHoverCardsOptions {
  /** ms to wait before fetching/showing a preview. Default 150 (global-constraints.md). */
  delay?: number;
  /** injectable for tests; defaults to the global `fetch`. */
  fetch?: typeof fetch;
}

const LEAVE_DELAY = 100;

/** Find the nearest previewable link (or self) starting from `target`. */
function findPreviewLink(target: EventTarget | null): HTMLAnchorElement | null {
  if (!(target instanceof Element)) return null;
  const el = target.closest('a[data-preview]');
  return el instanceof HTMLAnchorElement ? el : null;
}

export function initHoverCards(doc: Document, opts: InitHoverCardsOptions = {}): () => void {
  const delay = opts.delay ?? 150;
  const doFetch = opts.fetch ?? fetch;

  const cache = new Map<string, Promise<unknown | null>>();
  let card: HTMLDivElement | null = null;
  let currentLink: HTMLAnchorElement | null = null;
  let hoverTimer: ReturnType<typeof setTimeout> | null = null;
  let leaveTimer: ReturnType<typeof setTimeout> | null = null;
  /** generation counter: guards against a stale fetch resolving after the user moved to another link */
  let requestId = 0;
  /** touch state: the link whose first tap already showed the card (second tap on it navigates) */
  let touchArmedLink: HTMLAnchorElement | null = null;

  function fetchJson(url: string): Promise<unknown | null> {
    let pending = cache.get(url);
    if (pending === undefined) {
      pending = doFetch(url)
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null);
      cache.set(url, pending);
    }
    return pending;
  }

  function clearHoverTimer(): void {
    if (hoverTimer !== null) {
      clearTimeout(hoverTimer);
      hoverTimer = null;
    }
  }

  function clearLeaveTimer(): void {
    if (leaveTimer !== null) {
      clearTimeout(leaveTimer);
      leaveTimer = null;
    }
  }

  function removeCard(): void {
    clearLeaveTimer();
    card?.remove();
    card = null;
    currentLink = null;
  }

  /** Build the card body (as text nodes) for the three kinds of preview data. */
  function renderCardBody(container: HTMLElement, link: HTMLAnchorElement, data: unknown): boolean {
    const term = link.dataset.term;
    const key = link.dataset.key;

    if (term !== undefined) {
      const entry = (data as GlossaryData | null)?.[term];
      if (entry === undefined) return false;
      const line1 = doc.createElement('div');
      line1.className = 'hovercard-title';
      line1.textContent = entry.term;
      const line2 = doc.createElement('div');
      line2.textContent = entry.text;
      container.append(line1, line2);
      return true;
    }

    if (key !== undefined) {
      const entry = (data as AnchorsData | null)?.[key];
      if (entry === undefined) return false;
      const line = doc.createElement('div');
      line.textContent = entry.text;
      container.append(line);
      return true;
    }

    const preview = data as PreviewData | null;
    if (preview === null || preview === undefined) return false;
    const typeLabel = TYPE_LABEL[preview.type] ?? preview.type;
    const line1 = doc.createElement('div');
    line1.className = 'hovercard-title';
    line1.textContent = typeLabel !== '' ? `${typeLabel} · ${preview.title}` : preview.title;
    const line2 = doc.createElement('div');
    line2.textContent = preview.summary;
    container.append(line1, line2);
    if (preview.insight !== undefined) {
      const line3 = doc.createElement('div');
      line3.className = 'hovercard-insight';
      line3.textContent = preview.insight;
      container.append(line3);
    }
    if (preview.topics.length > 0) {
      const topics = doc.createElement('div');
      topics.className = 'hovercard-topics';
      topics.textContent = preview.topics.join(' · ');
      container.append(topics);
    }
    return true;
  }

  /** Position `el` under `link`, flipping above / clamping horizontally to stay inside the viewport. */
  function position(el: HTMLElement, link: HTMLAnchorElement): void {
    const rect = link.getBoundingClientRect();
    const viewportWidth = doc.defaultView?.innerWidth ?? 0;
    const viewportHeight = doc.defaultView?.innerHeight ?? 0;
    const margin = 8;

    el.style.position = 'fixed';
    el.style.visibility = 'hidden';
    el.style.top = '0px';
    el.style.left = '0px';

    const elHeight = el.offsetHeight;
    const elWidth = el.offsetWidth;

    let top = rect.bottom + 6;
    if (viewportHeight > 0 && top + elHeight > viewportHeight) {
      const above = rect.top - 6 - elHeight;
      if (above >= 0) top = above;
    }

    let left = rect.left;
    if (viewportWidth > 0) {
      const maxLeft = viewportWidth - elWidth - margin;
      left = Math.min(Math.max(left, margin), Math.max(margin, maxLeft));
    }

    el.style.top = `${top}px`;
    el.style.left = `${left}px`;
    el.style.visibility = 'visible';
  }

  function showCardFor(link: HTMLAnchorElement, data: unknown): void {
    const container = doc.createElement('div');
    container.className = 'hovercard';
    container.setAttribute('role', 'tooltip');
    const hasContent = renderCardBody(container, link, data);
    if (!hasContent) return;

    removeCard();
    card = container;
    currentLink = link;
    doc.body.append(card);
    position(card, link);

    card.addEventListener('pointerenter', clearLeaveTimer);
    card.addEventListener('pointerleave', scheduleLeave);
  }

  async function openFor(link: HTMLAnchorElement): Promise<void> {
    const url = link.dataset.preview;
    if (url === undefined) return;
    const myRequestId = ++requestId;
    const data = await fetchJson(url);
    if (myRequestId !== requestId) return; // superseded by a newer hover
    showCardFor(link, data);
  }

  function scheduleLeave(): void {
    clearLeaveTimer();
    leaveTimer = setTimeout(removeCard, LEAVE_DELAY);
  }

  function onPointerOver(e: Event): void {
    const link = findPreviewLink((e as PointerEvent).target);
    if (link === null) return;
    const related = (e as PointerEvent).relatedTarget as EventTarget | null;
    if (related instanceof Node && link.contains(related)) return; // moved within the same link
    if (link === currentLink) {
      clearLeaveTimer();
      return;
    }
    clearHoverTimer();
    clearLeaveTimer();
    hoverTimer = setTimeout(() => {
      hoverTimer = null;
      void openFor(link);
    }, delay);
  }

  function onPointerOut(e: Event): void {
    const link = findPreviewLink((e as PointerEvent).target);
    if (link === null) return;
    const related = (e as PointerEvent).relatedTarget as EventTarget | null;
    if (related instanceof Node && link.contains(related)) return;
    if (related instanceof Node && card?.contains(related)) return; // moving into the card keeps it open
    clearHoverTimer();
    if (link === currentLink) scheduleLeave();
  }

  function onPointerDown(e: Event): void {
    const pe = e as PointerEvent;
    if (pe.pointerType !== 'touch') return;
    const link = findPreviewLink(pe.target);
    if (link === null) {
      touchArmedLink = null;
      return;
    }
    if (touchArmedLink !== link) {
      // first tap on this link: preview instead of navigating.
      touchArmedLink = link;
    }
  }

  function onClick(e: Event): void {
    const link = findPreviewLink(e.target as EventTarget | null);
    if (link === null) return;
    // Only touch taps are special-cased; pointerdown above armed `touchArmedLink`
    // for this exact link when the tap originated from a touch pointer.
    if (touchArmedLink !== link) return;
    if (currentLink === link && card !== null) {
      // card already open for this link: second tap navigates.
      touchArmedLink = null;
      return;
    }
    e.preventDefault();
    void (async () => {
      const url = link.dataset.preview;
      if (url === undefined) return;
      const myRequestId = ++requestId;
      const data = await fetchJson(url);
      if (myRequestId !== requestId) return;
      showCardFor(link, data);
    })();
  }

  function onKeyDown(e: Event): void {
    if ((e as KeyboardEvent).key === 'Escape') removeCard();
  }

  doc.addEventListener('pointerover', onPointerOver);
  doc.addEventListener('pointerout', onPointerOut);
  doc.addEventListener('pointerdown', onPointerDown);
  doc.addEventListener('click', onClick, true);
  doc.addEventListener('keydown', onKeyDown);

  return () => {
    clearHoverTimer();
    clearLeaveTimer();
    removeCard();
    doc.removeEventListener('pointerover', onPointerOver);
    doc.removeEventListener('pointerout', onPointerOut);
    doc.removeEventListener('pointerdown', onPointerDown);
    doc.removeEventListener('click', onClick, true);
    doc.removeEventListener('keydown', onKeyDown);
  };
}
