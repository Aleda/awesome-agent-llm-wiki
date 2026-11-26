/**
 * Homepage graph app (Task 12, spec §8): loads `graph.json`, drives the
 * Task 11 renderer from a camera, and wires input, the preview panel, the
 * shareable `#node=&z=` view and the theme toggle.
 *
 * Self-starting: importing this module initialises `#graph-app` if present
 * (GraphApp.astro imports it). Browser code: only `import type` from
 * build.ts, so d3-force and zod stay out of the bundle.
 *
 * Camera rules (binding, task 12):
 * - Initial view: `initialCamera` (Ruling R16), the topic ring fitted in
 *   screen px below the top bar; a valid hash instead fits its node at its level.
 * - Wheel zooms by exp(-deltaY · 0.0015) about the cursor; drag pans with a
 *   4 px click threshold; two pointers pinch; `+`/`=` and `-` zoom ×/÷1.25
 *   about the view centre, `0` resets, Escape closes the panel.
 * - `moving` is true while dragging, flying, or within 150 ms of a
 *   wheel/pinch event (the renderer skips glows then).
 * - Hash: replaceState 300 ms after the view settles; click flights
 *   pushState so Back returns to the previous view.
 */
import type { GNode, GraphData } from './build';
import type { PageId } from '../lib/content-index';
import { BASE, toRoute } from '../lib/routes';
import { TYPE_LABEL } from '../lib/labels';
import { type Camera, fitNode, flyTo, initialCamera, screenToWorld, worldToScreen, zoomAt } from './camera';
import { LEVEL_SCALE, isRootNode, levelOf } from './lod';
import { buildQuadtree, createLoop, createRenderer, type Renderer, type ViewState } from './render';
import { clickAction, hitTest, isSource, neighbors, relatedSources } from './interaction';
import { type GraphView, decodeView, encodeView } from './hash';

const FLY_MS = 400;
const KEY_FLY_MS = 160;
const KEY_ZOOM = 1.25;
const CLICK_SLOP = 4;
const MOVING_TAIL_MS = 150;
const HASH_DELAY_MS = 300;
const WHEEL_RATE = 0.0015;
/** Trackpad pinch arrives as ctrl+wheel with ~10× smaller deltas than a mouse wheel. */
const PINCH_WHEEL_BOOST = 10;
/** Below this width the panel is a bottom sheet. */
const NARROW = 640;
const THEME_KEY = 'starlight-theme';

type Level = 0 | 1 | 2;

interface Flight {
  from: Camera;
  to: Camera;
  start: number;
  dur: number;
}

function media(q: string): MediaQueryList | null {
  try {
    return typeof matchMedia === 'function' ? matchMedia(q) : null;
  } catch {
    return null;
  }
}

function storedTheme(): string | null {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
}

/** Theme toggle and auto-theme tracking. Works even when the graph data fails to load. */
function setupTheme(root: HTMLElement, onChange: () => void): void {
  const html = document.documentElement;
  const btn = root.querySelector<HTMLButtonElement>('#graph-theme-btn');
  const dark = media('(prefers-color-scheme: dark)');
  const sync = (): void => {
    const isDark = html.dataset.theme === 'dark';
    if (btn) {
      btn.setAttribute('aria-pressed', String(isDark));
      btn.setAttribute('aria-label', isDark ? '切换到浅色模式' : '切换到深色模式');
      btn.title = isDark ? '浅色模式' : '深色模式';
    }
  };
  const apply = (t: 'light' | 'dark'): void => {
    if (html.dataset.theme === t) return sync();
    html.dataset.theme = t;
    sync();
    onChange();
  };
  const fromStore = (): void => {
    const s = storedTheme();
    apply(s === 'light' || s === 'dark' ? s : dark?.matches ? 'dark' : 'light');
  };
  btn?.addEventListener('click', () => {
    const next = html.dataset.theme === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* storage blocked: the toggle still works for this page view */
    }
    apply(next);
  });
  dark?.addEventListener('change', () => {
    const s = storedTheme();
    if (s !== 'light' && s !== 'dark') fromStore();
  });
  // Back from a content page (bfcache): the theme may have been changed there.
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) fromStore();
  });
  sync();
}

async function loadGraph(): Promise<GraphData | null> {
  try {
    const res = await fetch(`${BASE}/data/graph.json`);
    if (!res.ok) return null;
    const data = (await res.json()) as GraphData;
    return Array.isArray(data?.nodes) && Array.isArray(data.edges) ? data : null;
  } catch {
    return null;
  }
}

/** Preview JSON `insight` per source, fetched once; null when missing or the request fails. */
const insights = new Map<PageId, Promise<string | null>>();
function loadInsight(id: PageId): Promise<string | null> {
  let p = insights.get(id);
  if (!p) {
    // A failed request (network error, non-2xx, bad JSON) is dropped from the cache so a later open retries.
    p = fetch(encodeURI(`${BASE}/data/previews/${id}.json`))
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((j: { insight?: unknown } | null) => (j && typeof j.insight === 'string' && j.insight ? j.insight : null))
      .catch(() => {
        insights.delete(id);
        return null;
      });
    insights.set(id, p);
  }
  return p;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** Side preview panel (bottom sheet on narrow screens). All data goes in via textContent. */
function createPanel(root: HTMLElement, data: GraphData, onClose: () => void) {
  const panel = root.querySelector<HTMLElement>('.graph-panel')!;
  const type = panel.querySelector<HTMLElement>('.graph-panel__type')!;
  const title = panel.querySelector<HTMLElement>('.graph-panel__title')!;
  const summary = panel.querySelector<HTMLElement>('.graph-panel__summary')!;
  const open = panel.querySelector<HTMLAnchorElement>('.graph-panel__open')!;
  const related = panel.querySelector<HTMLElement>('.graph-panel__related')!;
  const list = panel.querySelector<HTMLElement>('.graph-panel__list')!;
  panel.querySelector('.graph-panel__close')?.addEventListener('click', onClose);
  let token = 0;

  const relatedItem = (n: GNode, t: number): HTMLElement => {
    const li = el('li', 'graph-panel__item');
    const a = el('a', 'graph-panel__item-link');
    a.href = toRoute(n.id);
    a.dataset.type = n.t;
    a.append(el('span', 'graph-panel__item-title', n.l));
    const meta = [TYPE_LABEL[n.t], n.o, n.d].filter(Boolean).join(' · ');
    a.append(el('span', 'graph-panel__item-meta', meta));
    li.append(a);
    const text = el('p', 'graph-panel__item-insight is-pending', n.s);
    li.append(text);
    void loadInsight(n.id).then((s) => {
      if (t !== token) return;
      if (s) text.textContent = s;
      text.classList.remove('is-pending');
    });
    return li;
  };

  return {
    show(n: GNode): void {
      const t = ++token;
      type.textContent = TYPE_LABEL[n.t] || '';
      type.dataset.type = n.t;
      title.textContent = n.l;
      summary.textContent = n.s || '暂无摘要。';
      open.href = toRoute(n.id);
      list.replaceChildren();
      if (n.t === 'topic' || n.t === 'concept') {
        const items = relatedSources(n.id, data, 3);
        if (items.length === 0) list.append(el('li', 'graph-panel__empty', '还没有相关素材。'));
        for (const s of items) list.append(relatedItem(s, t));
        related.hidden = false;
      } else {
        related.hidden = true;
      }
      panel.scrollTop = 0;
      panel.dataset.open = '';
      panel.setAttribute('aria-hidden', 'false');
    },
    hide(): void {
      token++;
      delete panel.dataset.open;
      panel.setAttribute('aria-hidden', 'true');
    },
    get isOpen(): boolean {
      return panel.dataset.open !== undefined;
    },
    /** Viewport area left uncovered by the open panel, for centring a focused node. */
    freeArea(w: number, h: number): { w: number; h: number } {
      if (panel.dataset.open === undefined) return { w, h };
      return w >= NARROW ? { w: Math.max(240, w - panel.offsetWidth - 16), h } : { w, h: Math.max(160, h - panel.offsetHeight) };
    },
  };
}

export async function initGraph(root: HTMLElement): Promise<void> {
  const canvas = root.querySelector<HTMLCanvasElement>('canvas.graph-canvas');
  const status = root.querySelector<HTMLElement>('.graph-status');
  const bar = root.querySelector<HTMLElement>('.graph-bar');
  if (!canvas) return;
  let renderer: Renderer | null = null;
  let dirty = true;
  setupTheme(root, () => {
    renderer?.refreshTheme();
    dirty = true;
  });

  const data = await loadGraph();
  if (!data || data.nodes.length === 0) {
    if (status) {
      status.textContent = data ? '图谱里还没有内容。' : '图谱数据加载失败，请刷新重试，或从“目录”浏览全部页面。';
      status.dataset.state = 'error';
    }
    return;
  }
  status?.remove();

  const r = createRenderer(canvas, data);
  renderer = r;
  const qt = buildQuadtree(data.nodes);
  const byId = new Map(data.nodes.map((n) => [n.id, n]));
  const ids = new Set(byId.keys());
  /** Filter result (Task 13 replaces it); stable, never rebuilt per frame. */
  const visible: Set<PageId> = new Set(ids);
  const centreNode = data.nodes.find(isRootNode) ?? data.nodes.find((n) => n.t === 'topic') ?? data.nodes[0];

  const reducedMq = media('(prefers-reduced-motion: reduce)');
  const state: ViewState = { visible, reducedMotion: reducedMq?.matches === true, showEntities: false };
  reducedMq?.addEventListener('change', () => {
    state.reducedMotion = reducedMq.matches;
    dirty = true;
  });

  const panel = createPanel(root, data, () => clearFocus());

  let vw = Math.max(1, root.clientWidth || window.innerWidth);
  let vh = Math.max(1, root.clientHeight || window.innerHeight);
  const barH = (): number => (bar ? bar.offsetTop + bar.offsetHeight : 0);

  const maxTopicR = data.nodes.reduce((m, n) => (n.t === 'topic' && !isRootNode(n) ? Math.max(m, n.r) : m), 0);
  const initialCam = (): Camera => initialCamera({ w: vw, h: vh, top: barH() }, maxTopicR, [centreNode.x, centreNode.y]);
  /** `fitNode` into the area below the top bar and beside the panel. */
  const fitView = (n: GNode, z: Level): Camera => {
    const top = barH();
    const area = panel.freeArea(vw, vh - top);
    const c = fitNode(n, area, z);
    return { x: c.x, y: c.y - top / c.k, k: c.k };
  };

  let cam: Camera = { x: 0, y: 0, k: LEVEL_SCALE[0] };
  let flight: Flight | null = null;
  let focus: PageId | undefined;
  /** Node the view was last centred on (focus, or an f=0 view); names the hash while it stays on screen after the panel closes. */
  let anchor: PageId | undefined;
  let hover: PageId | undefined;
  let dragging = false;
  let movingUntil = 0;
  let wasMoving = false;
  let hashTimer: ReturnType<typeof setTimeout> | undefined;
  let navHash = location.hash;

  const setLevel = (): void => {
    const lv = String(levelOf(cam.k));
    if (root.dataset.level !== lv) root.dataset.level = lv;
  };
  const cameraChanged = (): void => {
    dirty = true;
    setLevel();
    scheduleHash();
  };
  const setFocus = (id: PageId | undefined): void => {
    focus = id;
    if (id !== undefined) anchor = id;
    state.focus = id;
    root.dataset.focus = id ?? '';
    dirty = true;
  };
  const setHover = (id: PageId | undefined): void => {
    if (id === hover) return;
    hover = id;
    state.hover = id;
    state.neighbors = id === undefined ? undefined : neighbors(id, data, { showEntities: state.showEntities });
    canvas.style.cursor = id === undefined ? '' : 'pointer';
    dirty = true;
  };

  const flyCam = (to: Camera, dur: number): void => {
    if (dur <= 0 || state.reducedMotion) {
      flight = null;
      cam = to;
      cameraChanged();
    } else {
      flight = { from: cam, to, start: performance.now(), dur };
      dirty = true;
    }
  };
  const stopFlight = (): void => {
    flight = null;
  };

  // ---------------------------------------------------------------- hash

  const isInitial = (): boolean => {
    const c = initialCam();
    return Math.abs(cam.k / c.k - 1) < 1e-3 && Math.hypot((cam.x - c.x) * cam.k, (cam.y - c.y) * cam.k) < 2;
  };
  const onScreen = (n: GNode): boolean => {
    const [sx, sy] = worldToScreen(cam, [n.x, n.y]);
    return sx >= 0 && sx <= vw && sy >= barH() && sy <= vh;
  };
  /** The node a settled view is "about": the focus if still on screen, else the nearest node drawn at this level. */
  const viewNode = (z: Level): GNode | undefined => {
    for (const id of [focus, anchor]) {
      const n = id !== undefined ? byId.get(id) : undefined;
      if (n && onScreen(n)) return n;
    }
    const top = barH();
    const [cx, cy] = screenToWorld(cam, [vw / 2, (top + vh) / 2]);
    let best: GNode | undefined;
    let bestD = Infinity;
    for (const n of data.nodes) {
      if (!visible.has(n.id) || n.t === 'entity') continue;
      if (z === 0 && n.t !== 'topic') continue;
      if (z === 1 && isSource(n)) continue;
      const d = (n.x - cx) ** 2 + (n.y - cy) ** 2;
      if (d < bestD) {
        bestD = d;
        best = n;
      }
    }
    return best;
  };
  /** `&f=0` (Ruling R17) whenever the hash node is not an open focus, so reload/share/Back never opens a panel the user did not have. */
  const currentHash = (): string => {
    if (focus === undefined && isInitial()) return '';
    const z = levelOf(cam.k);
    const n = viewNode(z);
    if (!n) return '';
    return encodeView(n.id === focus && panel.isOpen ? { node: n.id, z } : { node: n.id, z, f: 0 });
  };
  const base = (): string => location.pathname + location.search;
  const writeHash = (): void => {
    clearTimeout(hashTimer);
    hashTimer = undefined;
    const h = currentHash();
    if (h === location.hash || (h === '' && location.hash === '')) return;
    history.replaceState(history.state, '', base() + h);
    navHash = location.hash;
  };
  function scheduleHash(): void {
    clearTimeout(hashTimer);
    hashTimer = setTimeout(writeHash, HASH_DELAY_MS);
  }

  /** Apply a decoded view: focus + panel + camera (no history entry). */
  const goTo = (v: GraphView, dur: number): void => {
    const n = v.node !== undefined ? byId.get(v.node) : undefined;
    if (n && v.f === 0) {
      setFocus(undefined);
      anchor = n.id;
      panel.hide();
      flyCam(fitView(n, v.z), dur);
    } else if (n) {
      setFocus(n.id);
      panel.show(n);
      flyCam(fitView(n, v.z), dur);
    } else {
      setFocus(undefined);
      anchor = undefined;
      panel.hide();
      flyCam(initialCam(), dur);
    }
  };
  function clearFocus(): void {
    if (focus === undefined && !panel.isOpen) return;
    setFocus(undefined);
    panel.hide();
    scheduleHash();
  }
  const reset = (): void => {
    setFocus(undefined);
    anchor = undefined;
    panel.hide();
    flyCam(initialCam(), FLY_MS);
    scheduleHash();
  };

  // --------------------------------------------------------------- input

  const local = (e: { clientX: number; clientY: number }): [number, number] => {
    const b = canvas.getBoundingClientRect();
    return [e.clientX - b.left, e.clientY - b.top];
  };
  const pointers = new Map<number, [number, number]>();
  let down: { p: [number, number]; cam: Camera; moved: boolean } | null = null;
  const zoomBy = (at: [number, number], f: number): void => {
    stopFlight();
    cam = zoomAt(cam, at, f);
    movingUntil = performance.now() + MOVING_TAIL_MS;
    // Mid-drag: rebase the drag on the zoomed camera, or the next move reverts the zoom.
    if (down) {
      const [p] = [...pointers.values()];
      if (p) down = { p, cam, moved: true };
    }
    cameraChanged();
  };
  const pick = (p: [number, number]): GNode | null =>
    hitTest(qt, screenToWorld(cam, p), cam.k, { showEntities: state.showEntities, visible });

  const onClick = (n: GNode | null): void => {
    if (!n) {
      clearFocus();
      return;
    }
    const act = clickAction(n, levelOf(cam.k));
    if (act.kind === 'navigate') {
      location.assign(act.href);
      return;
    }
    writeHash(); // settle the current view first so Back lands on it
    const target = byId.get(act.focus)!;
    setFocus(target.id);
    panel.show(target);
    flyCam(fitView(target, act.level), FLY_MS);
    const h = encodeView({ node: target.id, z: act.level });
    if (h !== location.hash) history.pushState(null, '', base() + h);
    navHash = location.hash;
    clearTimeout(hashTimer);
  };

  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? vh : 1;
      const dy = e.deltaY * unit * (e.ctrlKey ? PINCH_WHEEL_BOOST : 1);
      zoomBy(local(e), Math.exp(-dy * WHEEL_RATE));
    },
    { passive: false },
  );

  let pinch: { dist: number; mid: [number, number] } | null = null;
  const pinchOf = (): { dist: number; mid: [number, number] } => {
    const [a, b] = [...pointers.values()];
    return { dist: Math.max(1, Math.hypot(a[0] - b[0], a[1] - b[1])), mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] };
  };

  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    canvas.setPointerCapture?.(e.pointerId);
    const p = local(e);
    pointers.set(e.pointerId, p);
    stopFlight();
    if (pointers.size === 1) {
      down = { p, cam, moved: false };
    } else if (pointers.size === 2) {
      down = null;
      pinch = pinchOf();
      dragging = false;
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = local(e);
    if (!pointers.has(e.pointerId)) {
      if (e.pointerType === 'mouse') setHover(pick(p)?.id);
      return;
    }
    pointers.set(e.pointerId, p);
    if (pinch && pointers.size >= 2) {
      const next = pinchOf();
      cam = zoomAt(cam, next.mid, next.dist / pinch.dist);
      cam = { ...cam, x: cam.x - (next.mid[0] - pinch.mid[0]) / cam.k, y: cam.y - (next.mid[1] - pinch.mid[1]) / cam.k };
      pinch = next;
      movingUntil = performance.now() + MOVING_TAIL_MS;
      cameraChanged();
      return;
    }
    if (!down) return;
    const dx = p[0] - down.p[0];
    const dy = p[1] - down.p[1];
    if (!down.moved && Math.hypot(dx, dy) < CLICK_SLOP) return;
    if (!down.moved) {
      down.moved = true;
      dragging = true;
      setHover(undefined);
      canvas.classList.add('is-dragging');
    }
    cam = { x: down.cam.x - dx / down.cam.k, y: down.cam.y - dy / down.cam.k, k: down.cam.k };
    cameraChanged();
  });
  const endPointer = (e: PointerEvent, cancelled: boolean): void => {
    if (!pointers.delete(e.pointerId)) return;
    if (pinch) {
      if (pointers.size < 2) pinch = null;
      if (pointers.size === 1) {
        // Continue as a drag with the remaining finger, without a click on release.
        const [p] = [...pointers.values()];
        down = { p, cam, moved: true };
        dragging = true;
        canvas.classList.add('is-dragging');
      }
      return;
    }
    const d = down;
    down = null;
    dragging = false;
    canvas.classList.remove('is-dragging');
    if (d && !d.moved && !cancelled) onClick(pick(local(e)));
    else dirty = true;
  };
  canvas.addEventListener('pointerup', (e) => endPointer(e, false));
  canvas.addEventListener('pointercancel', (e) => endPointer(e, true));
  canvas.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse' && !pointers.has(e.pointerId)) setHover(undefined);
  });

  window.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    const centre: [number, number] = [vw / 2, (barH() + vh) / 2];
    const keyZoom = (f: number): void => {
      const to = zoomAt(flight ? flight.to : cam, centre, f);
      flyCam(to, KEY_FLY_MS);
    };
    if (e.key === '+' || e.key === '=') keyZoom(KEY_ZOOM);
    else if (e.key === '-' || e.key === '_') keyZoom(1 / KEY_ZOOM);
    else if (e.key === '0') reset();
    else if (e.key === 'Escape') clearFocus();
    else return;
    e.preventDefault();
  });

  // Back/forward and hand-edited fragments. Chrome fires both popstate and
  // hashchange for one traversal; `navHash` makes the second a no-op.
  const onNav = (): void => {
    if (location.hash === navHash) return;
    navHash = location.hash;
    goTo(decodeView(location.hash, ids), FLY_MS);
  };
  window.addEventListener('popstate', onNav);
  window.addEventListener('hashchange', onNav);

  // ----------------------------------------------------------- size, loop

  const applySize = (): void => {
    const w = Math.max(1, root.clientWidth);
    const h = Math.max(1, root.clientHeight);
    const wasInitial = focus === undefined && isInitial();
    // Keep the view centre fixed when the viewport changes size.
    const [cx, cy] = screenToWorld(cam, [vw / 2, vh / 2]);
    vw = w;
    vh = h;
    r.resize(w, h, window.devicePixelRatio || 1);
    cam = wasInitial ? initialCam() : { x: cx - w / (2 * cam.k), y: cy - h / (2 * cam.k), k: cam.k };
    dirty = true;
    setLevel();
  };
  if (typeof ResizeObserver === 'function') new ResizeObserver(applySize).observe(root);
  else window.addEventListener('resize', applySize);
  // DPR changes (browser zoom, moving to another monitor) do not resize the element.
  const watchDpr = (): void => {
    const mq = media(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    mq?.addEventListener('change', () => {
      applySize();
      watchDpr();
    }, { once: true });
  };
  watchDpr();

  vw = Math.max(1, root.clientWidth);
  vh = Math.max(1, root.clientHeight);
  r.resize(vw, vh, window.devicePixelRatio || 1);
  const first = decodeView(location.hash, ids);
  goTo(first, 0);
  if (first.node === undefined && location.hash !== '') history.replaceState(history.state, '', base());
  navHash = location.hash;
  setLevel();

  const loop = createLoop((now) => {
    if (flight) {
      const t = (now - flight.start) / flight.dur;
      cam = flyTo(flight.from, flight.to, t);
      if (t >= 1) flight = null;
      cameraChanged();
    }
    const moving = dragging || flight !== null || pinch !== null || now < movingUntil;
    state.moving = moving;
    state.time = now;
    // Animate continuously unless reduced motion; then redraw only on change.
    if (!state.reducedMotion || dirty || moving || wasMoving) {
      r.draw(cam, state);
      dirty = false;
    }
    wasMoving = moving;
  }, document);
  loop.start();
  // Test hook (e2e): screen position of a node and the label boxes drawn last frame.
  (root as HTMLElement & { graphDebug?: unknown }).graphDebug = {
    screenOf: (id: PageId) => {
      const n = byId.get(id);
      return n ? worldToScreen(cam, [n.x, n.y]) : null;
    },
    labelBoxes: () => r.labelBoxes(),
    barBottom: barH,
  };
  root.dataset.ready = '';
}

const app = typeof document !== 'undefined' ? document.getElementById('graph-app') : null;
if (app) void initGraph(app);
