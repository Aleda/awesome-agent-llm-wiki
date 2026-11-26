/**
 * Canvas 2D renderer for the homepage graph (Task 11, spec §8.2–§8.3).
 *
 * Browser code: only `import type` from build.ts / schema.ts /
 * content-index.ts, so d3-force and zod never reach the bundle.
 *
 * Frame pipeline (`draw`):
 *  1. Cull: an index quadtree (built once) gives the nodes whose centre is
 *     inside the viewport grown by a margin (largest droplet, card and
 *     label half-widths). Only these are animated and drawn.
 *  2. Edges: thin curved threads in the from-node's type colour, batched
 *     into one path per (colour, gate) bucket. Drawn if at least one end
 *     is on screen. Source edges fade in with L1; `by` edges only when
 *     `showEntities`. Edges touching the hovered node are drawn on top.
 *  3. Droplets: translucent radial-gradient bodies (glassy centre, denser
 *     rim), a soft glow in the type colour (a sprite pre-rendered per theme,
 *     skipped while `moving`), a specular highlight and a
 *     faint caustic crescent. Gradients live in unit space and are built
 *     once per theme; each droplet is placed with `setTransform`, so no
 *     per-node gradient is allocated.
 *  4. Screen-space labels with a halo, L2 source cards, hover relation
 *     labels and the focus ring.
 *
 * Camera convention: see camera.ts (`screen = (world - cam) · k`).
 */
import { quadtree, type Quadtree, type QuadtreeLeaf } from 'd3-quadtree';
import type { GNode, GraphData } from './build';
import type { PageId } from '../lib/content-index';
import type { PageType } from '../lib/schema';
import { REL_LABEL, TYPE_LABEL } from '../lib/labels';
import type { Camera } from './camera';
import { CARD_H, CARD_W, isRootNode, lodAlpha, screenRadius } from './lod';
import { DROPLET_POINTS, dropletInto, driftInto } from './droplet';

export interface ViewState {
  hover?: PageId;
  focus?: PageId;
  /** Nodes that pass the filters (Task 13). Nodes outside it, and their edges, are not drawn. */
  visible: Set<PageId>;
  reducedMotion: boolean;
  /** Entity nodes and `by` edges are drawn only when true (default false). */
  showEntities?: boolean;
  /** `REL` indexes to draw edges for (Task 13 rel filter); absent means every rel is drawn. `by` edges are governed by `showEntities` only, never by this. */
  rels?: Set<number>;
  /** Neighbours of `hover` (Task 12 `neighbors`); they stay at full opacity while the rest dim to 0.15. */
  neighbors?: Set<PageId>;
  /** True while the camera is panning/zooming/flying (Task 12): droplet glows are skipped to keep frames cheap. */
  moving?: boolean;
  /** Animation clock in ms, normally the rAF timestamp; defaults to `performance.now()`. */
  time?: number;
}

export interface Renderer {
  draw(cam: Camera, state: ViewState): void;
  /** Size the canvas to `w` × `h` CSS px at device pixel ratio `dpr`. */
  resize(w: number, h: number, dpr: number): void;
  /** Re-read the colour tokens (call after the theme changes). */
  refreshTheme(): void;
  /**
   * Screen-px boxes (CSS px, halo included) of the node labels drawn in the
   * last frame, topic labels including their "N 份素材" line. Relation pills
   * avoid these; e2e uses them to check labels stay on screen (Task 12).
   */
  labelBoxes(): LabelBox[];
}

export interface LabelBox {
  id: PageId;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

// ---------------------------------------------------------------- culling

export function buildQuadtree(nodes: GNode[]): Quadtree<GNode> {
  return quadtree<GNode>()
    .x((n) => n.x)
    .y((n) => n.y)
    .addAll(nodes);
}

/** Ids of the nodes whose centre lies inside `rect` (world units, inclusive). */
export function visibleIds(
  qt: Quadtree<GNode>,
  rect: { x0: number; y0: number; x1: number; y1: number },
): Set<PageId> {
  const out = new Set<PageId>();
  qt.visit((node, x0, y0, x1, y1) => {
    if (!node.length) {
      let leaf: QuadtreeLeaf<GNode> | undefined = node as QuadtreeLeaf<GNode>;
      do {
        const d = leaf.data;
        if (d.x >= rect.x0 && d.x <= rect.x1 && d.y >= rect.y0 && d.y <= rect.y1) out.add(d.id);
        leaf = leaf.next;
      } while (leaf);
    }
    return x0 > rect.x1 || y0 > rect.y1 || x1 < rect.x0 || y1 < rect.y0;
  });
  return out;
}

// ------------------------------------------------------------------- loop

/**
 * `requestAnimationFrame` loop calling `step(timestamp)` once per frame.
 * While `doc.hidden` is true no frame is scheduled at all; the loop
 * resumes on the next `visibilitychange` that makes the page visible.
 */
export function createLoop(step: (t: number) => void, doc: Document): { start(): void; stop(): void } {
  let running = false;
  let pending: number | null = null;

  const frame = (t: number): void => {
    pending = null;
    if (!running || doc.hidden) return;
    step(t);
    schedule();
  };
  const schedule = (): void => {
    if (pending === null && running && !doc.hidden) pending = requestAnimationFrame(frame);
  };
  const cancel = (): void => {
    if (pending !== null) cancelAnimationFrame(pending);
    pending = null;
  };
  const onVisibility = (): void => {
    if (doc.hidden) cancel();
    else schedule();
  };

  return {
    start() {
      if (running) return;
      running = true;
      doc.addEventListener('visibilitychange', onVisibility);
      schedule();
    },
    stop() {
      running = false;
      doc.removeEventListener('visibilitychange', onVisibility);
      cancel();
    },
  };
}

// ------------------------------------------------------------------ theme

type RGB = [number, number, number];

const TYPES = ['topic', 'concept', 'paper', 'blog', 'video', 'podcast', 'entity'] as const;
type NodeType = (typeof TYPES)[number];
const SOURCE_TYPES: ReadonlySet<PageType> = new Set<PageType>(['paper', 'blog', 'video', 'podcast']);

/** Light-theme token values (tokens.css), used when a variable can't be read. */
const FALLBACK: Record<NodeType, string> = {
  topic: '#3730a3',
  concept: '#0f766e',
  paper: '#1d4ed8',
  blog: '#b45309',
  video: '#be123c',
  podcast: '#6d28d9',
  entity: '#475569',
};

/** Parse `#rgb`, `#rrggbb(aa)` or `rgb()/rgba()`; `null` if unrecognised. */
export function parseColor(input: string): RGB | null {
  const s = input.trim().toLowerCase();
  let m = /^#([0-9a-f]{3})$/.exec(s);
  if (m) return [0, 1, 2].map((i) => parseInt(m![1][i] + m![1][i], 16)) as RGB;
  m = /^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/.exec(s);
  if (m) return [0, 2, 4].map((i) => parseInt(m![1].slice(i, i + 2), 16)) as RGB;
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(s);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])].map((v) => Math.round(Math.min(255, v))) as RGB;
  return null;
}

const rgba = (c: RGB, a: number): string => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const mix = (c: RGB, d: RGB, f: number): RGB => [0, 1, 2].map((i) => Math.round(c[i] + (d[i] - c[i]) * f)) as RGB;

interface Tone {
  rgb: RGB;
  solid: string;
  rim: string;
  glow: string;
  body: CanvasGradient | null;
  /** Pre-rendered soft glow (see `glowSprite`), or null without a 2D context. */
  halo: CanvasImageSource | null;
}

/** Precomputed `ctx.font` strings, so the hot loop never builds a font string. */
interface Fonts {
  root: string;
  topic: string;
  concept: string;
  sub: string;
  small: string;
  cardTitle: string;
}

interface Theme {
  dark: boolean;
  tones: Tone[];
  ink: string;
  muted: string;
  halo: string;
  cardBg: string;
  cardBorder: string;
  cardShadow: string;
  specular: CanvasGradient | null;
  caustic: string;
  fonts: Fonts;
}

const FONT_STACK = 'system-ui, -apple-system, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';
const WHITE: RGB = [255, 255, 255];

function cssVar(name: string): string {
  try {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  } catch {
    return '';
  }
}

/** An offscreen canvas of `w` × `h` device px with its 2D context, or null where canvases are unavailable (happy-dom). */
function offscreen(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] | null {
  try {
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const cx = cv.getContext('2d');
    return cx ? [cv, cx] : null;
  } catch {
    return null;
  }
}

/** Glow sprite size in px and the fraction of its half-width where the droplet rim sits. */
const GLOW_PX = 128;
export const GLOW_RIM = 0.62;

/**
 * Soft glow in `rgb` at peak alpha `a`, rendered once per theme: flat
 * under the droplet, then a smooth Gaussian-like falloff outside the rim.
 * Replaces a per-draw `shadowBlur`, which is the costliest canvas op at
 * high DPR.
 */
function glowSprite(rgb: RGB, a: number): CanvasImageSource | null {
  const o = offscreen(GLOW_PX, GLOW_PX);
  if (!o) return null;
  const [cv, cx] = o;
  const h = GLOW_PX / 2;
  const gr = cx.createRadialGradient(h, h, 0, h, h, h);
  const stops: [number, number][] = [[0, 1], [GLOW_RIM, 0.9], [0.72, 0.55], [0.82, 0.25], [0.91, 0.08], [1, 0]];
  for (const [o2, f] of stops) gr.addColorStop(o2, rgba(rgb, a * f));
  cx.fillStyle = gr;
  cx.fillRect(0, 0, GLOW_PX, GLOW_PX);
  return cv;
}

/** Card drop shadow, padding `CARD_PAD` px around the card, rendered once per theme and DPR. */
const CARD_PAD = 24;
function cardShadowSprite(color: string, dpr: number): CanvasImageSource | null {
  const o = offscreen(Math.ceil((CARD_W + 2 * CARD_PAD) * dpr), Math.ceil((CARD_H + 2 * CARD_PAD) * dpr));
  if (!o) return null;
  const [cv, cx] = o;
  cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  cx.shadowColor = color;
  cx.shadowBlur = 14 * dpr;
  cx.shadowOffsetY = 3 * dpr;
  // Draw the shape far off-canvas and keep only its shadow, so the sprite is shadow-only.
  const off = 10000;
  cx.shadowOffsetX = off * dpr;
  cx.beginPath();
  roundRectPath(cx, CARD_PAD - off, CARD_PAD, CARD_W, CARD_H, 10);
  cx.fillStyle = '#000';
  cx.fill();
  return cv;
}

function readTheme(ctx: CanvasRenderingContext2D | null): Theme {
  let dark = false;
  try {
    dark = document.documentElement.dataset.theme === 'dark';
  } catch {
    /* no document */
  }
  const tones = TYPES.map((t): Tone => {
    const rgb = parseColor(cssVar(`--c-${t}`)) ?? (parseColor(FALLBACK[t]) as RGB);
    let body: CanvasGradient | null = null;
    if (ctx) {
      // Unit-space body: focal highlight up-left, glassy centre, denser rim.
      body = ctx.createRadialGradient(-0.34, -0.42, 0, 0, 0, 1);
      body.addColorStop(0, rgba(mix(rgb, WHITE, dark ? 0.55 : 0.72), dark ? 0.62 : 0.8));
      body.addColorStop(0.45, rgba(rgb, 0.36));
      body.addColorStop(0.85, rgba(rgb, 0.46));
      body.addColorStop(1, rgba(rgb, 0.55));
    }
    const glowA = dark ? 0.5 : 0.32;
    return { rgb, solid: rgba(rgb, 1), rim: rgba(rgb, 0.6), glow: rgba(rgb, glowA), body, halo: ctx ? glowSprite(rgb, glowA) : null };
  });
  let specular: CanvasGradient | null = null;
  if (ctx) {
    specular = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    specular.addColorStop(0, `rgba(255,255,255,${dark ? 0.7 : 0.9})`);
    specular.addColorStop(1, 'rgba(255,255,255,0)');
  }
  const cardBg = cssVar('--card-bg') || (dark ? '#1e2230' : '#ffffff');
  const ff = cssVar('--sl-font') || FONT_STACK;
  return {
    dark,
    tones,
    ink: cssVar('--c-ink') || (dark ? '#e2e8f0' : '#0f172a'),
    muted: cssVar('--c-muted') || (dark ? 'rgba(226,232,240,0.68)' : 'rgba(15,23,42,0.6)'),
    halo: rgba(parseColor(cardBg) ?? (dark ? [30, 34, 48] : WHITE), 0.85),
    cardBg,
    cardBorder: cssVar('--card-border') || (dark ? 'rgba(226,232,240,0.12)' : 'rgba(15,23,42,0.1)'),
    cardShadow: dark ? 'rgba(0,0,0,0.45)' : 'rgba(15,23,42,0.14)',
    specular,
    caustic: dark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.45)',
    fonts: {
      root: `600 20px ${ff}`,
      topic: `600 18px ${ff}`,
      concept: `500 13px ${ff}`,
      sub: `12px ${ff}`,
      small: `11px ${ff}`,
      cardTitle: `600 13px ${ff}`,
    },
  };
}

/** FNV-1a of an id: per-node wobble/drift seed that does not change when other nodes are added. */
function hashId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h | 0;
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** `s` cut with an ellipsis to fit `max` px in the context's current font. */
function ellipsize(ctx: CanvasRenderingContext2D, s: string, max: number): string {
  if (ctx.measureText(s).width <= max) return s;
  let lo = 0;
  let hi = s.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (ctx.measureText(s.slice(0, mid) + '…').width <= max) lo = mid;
    else hi = mid - 1;
  }
  return s.slice(0, lo).trimEnd() + '…';
}

/** White type glyph (about 10 px) centred at (cx, cy) inside the card badge. */
function drawGlyph(ctx: CanvasRenderingContext2D, t: PageType, cx: number, cy: number): void {
  ctx.beginPath();
  if (t === 'video') {
    ctx.moveTo(cx - 2.2, cy - 3.4);
    ctx.lineTo(cx + 3.6, cy);
    ctx.lineTo(cx - 2.2, cy + 3.4);
    ctx.closePath();
    ctx.fill();
    return;
  }
  if (t === 'paper') {
    ctx.moveTo(cx - 3, cy - 4);
    ctx.lineTo(cx + 1.2, cy - 4);
    ctx.lineTo(cx + 3, cy - 2.2);
    ctx.lineTo(cx + 3, cy + 4);
    ctx.lineTo(cx - 3, cy + 4);
    ctx.closePath();
    ctx.moveTo(cx - 1.4, cy - 0.6);
    ctx.lineTo(cx + 1.4, cy - 0.6);
    ctx.moveTo(cx - 1.4, cy + 1.8);
    ctx.lineTo(cx + 1.4, cy + 1.8);
  } else if (t === 'podcast') {
    roundRectPath(ctx, cx - 1.8, cy - 4.4, 3.6, 5.6, 1.8);
    ctx.moveTo(cx - 3.4, cy - 0.4);
    ctx.arc(cx, cy - 0.4, 3.4, Math.PI, 0, true);
    ctx.moveTo(cx, cy + 3);
    ctx.lineTo(cx, cy + 4.4);
  } else {
    ctx.moveTo(cx - 3.4, cy - 2.6);
    ctx.lineTo(cx + 3.4, cy - 2.6);
    ctx.moveTo(cx - 3.4, cy);
    ctx.lineTo(cx + 3.4, cy);
    ctx.moveTo(cx - 3.4, cy + 2.6);
    ctx.lineTo(cx + 0.8, cy + 2.6);
  }
  ctx.stroke();
}

const EDGE_ALPHA = 0.18;
const EDGE_BEND = 0.08;
const DIM = 0.15;
/** Label line heights in CSS px for the label boxes (font size plus a little leading). */
const LINE_H = { root: 24, topic: 22, sub: 15, concept: 16, small: 14 } as const;
/** Halo stroke (3.5 px) half-width plus 1 px, added around every label box. */
const LABEL_PAD = 3;
/** Curve parameters tried, in order, for a relation pill. */
const PILL_T = [0.5, 0.36, 0.64] as const;
/** Screen-px half-extent of anything drawn around a node centre (card half-width, widest label). */
const SCREEN_MARGIN = Math.max(CARD_W / 2, 140) + 8;
const KIND_ROOT = 0;
const KIND_TOPIC = 1;
const KIND_CONCEPT = 2;
const KIND_SOURCE = 3;
const KIND_ENTITY = 4;
const GATE_ALWAYS = 0;
const GATE_L1 = 1;
const GATE_BY = 2;
const REL_NAMES: string[] = Object.values(REL_LABEL);
const TAU = Math.PI * 2;

interface CardText {
  title: string;
  meta: string;
  summary: string;
}

// --------------------------------------------------------------- renderer

/**
 * Create a renderer drawing `data` into `canvas`. Never throws: without a
 * 2D context (e.g. happy-dom) every method is a no-op apart from sizing.
 */
export function createRenderer(canvas: HTMLCanvasElement, data: GraphData): Renderer {
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = canvas.getContext('2d');
  } catch {
    ctx = null;
  }
  let theme = readTheme(ctx);
  let vw = 0;
  let vh = 0;
  let dpr = 1;

  const nodes = data.nodes;
  const N = nodes.length;
  const indexOf = new Map<PageId, number>();
  const kind = new Uint8Array(N);
  const tone = new Uint8Array(N);
  const seed = new Int32Array(N);
  const subLabel: string[] = new Array(N).fill('');
  let maxR = 0;
  nodes.forEach((n, i) => {
    indexOf.set(n.id, i);
    kind[i] = isRootNode(n) ? KIND_ROOT : n.t === 'topic' ? KIND_TOPIC : n.t === 'concept' ? KIND_CONCEPT : SOURCE_TYPES.has(n.t) ? KIND_SOURCE : KIND_ENTITY;
    tone[i] = Math.max(0, TYPES.indexOf(n.t as NodeType));
    seed[i] = hashId(n.id);
    maxR = Math.max(maxR, n.r);
  });
  // "N 份素材" under the root and each topic: the build-time count `n` (build.ts, same rule as 来源数).
  nodes.forEach((n, i) => {
    if (kind[i] <= KIND_TOPIC && n.n) subLabel[i] = `${n.n} 份素材`;
  });

  // Edges, bucketed by (colour of the from-node, visibility gate) so each bucket is one stroked path.
  const ea = new Int32Array(data.edges.length);
  const eb = new Int32Array(data.edges.length);
  const er = new Int32Array(data.edges.length);
  const bucketLists = new Map<number, number[]>();
  data.edges.forEach((e, j) => {
    ea[j] = e.a;
    eb[j] = e.b;
    er[j] = e.r;
    if (!(e.a >= 0 && e.a < N && e.b >= 0 && e.b < N)) return;
    const gate = e.r >= REL_NAMES.length || kind[e.a] === KIND_ENTITY || kind[e.b] === KIND_ENTITY
      ? GATE_BY
      : kind[e.a] === KIND_SOURCE || kind[e.b] === KIND_SOURCE ? GATE_L1 : GATE_ALWAYS;
    const key = tone[e.a] * 3 + gate;
    const list = bucketLists.get(key) ?? [];
    list.push(j);
    bucketLists.set(key, list);
  });
  const buckets = [...bucketLists].map(([key, list]) => ({ tone: Math.floor(key / 3), gate: key % 3, list: Int32Array.from(list) }));

  // Index quadtree for per-frame culling (indices avoid a GNode -> index lookup).
  const qt = quadtree<number>()
    .x((i) => nodes[i].x)
    .y((i) => nodes[i].y)
    .addAll(nodes.map((_, i) => i));

  // Per-frame scratch, allocated once.
  const pos = new Float64Array(2 * N);
  const rad = new Float64Array(N);
  const onScreen = new Uint32Array(N);
  const placed = new Uint32Array(N);
  const vis = new Int32Array(N);
  const hl = new Int32Array(data.edges.length);
  const ok = new Uint8Array(N);
  const pts = new Float64Array(DROPLET_POINTS * 2);
  const dbuf = new Float64Array(2);
  const cards: (CardText | undefined)[] = new Array(N);
  // Label widths per node (main line, sub line), measured once per theme/font.
  const labelW = new Float64Array(N).fill(NaN);
  const subW = new Float64Array(N).fill(NaN);
  // Label boxes drawn this frame: x0, y0, x1, y1 per entry, owner node in lboxNode.
  const lbox = new Float64Array(4 * N);
  const lboxNode = new Int32Array(N);
  let nLabel = 0;
  let frame = 0;
  let nVis = 0;
  let rx0 = 0;
  let ry0 = 0;
  let rx1 = 0;
  let ry1 = 0;
  let cam: Camera = { x: 0, y: 0, k: 1 };
  let clock = 0;
  let reduced = false;
  let moving = false;
  /** `ViewState.rels` for the in-progress frame; undefined means every rel draws (Task 13). */
  let relFilter: Set<number> | undefined;
  let cardShadow: CanvasImageSource | null = null;
  let cardShadowDpr = 0;
  /** Last font assigned to the context; `ctx.font` is only set when it changes (reset when a resize clears the context state). */
  let curFont = '';
  const font = (c: CanvasRenderingContext2D, f: string): void => {
    if (f !== curFont) {
      c.font = f;
      curFont = f;
    }
  };

  const place = (i: number): void => {
    if (placed[i] === frame) return;
    placed[i] = frame;
    const n = nodes[i];
    driftInto(dbuf, 0, clock, seed[i], reduced);
    pos[2 * i] = (n.x - cam.x) * cam.k + dbuf[0];
    pos[2 * i + 1] = (n.y - cam.y) * cam.k + dbuf[1];
    rad[i] = screenRadius(n, cam.k);
  };

  let lodSource = 0;
  let lodEntity = 0;
  const visitor = (node: { length?: number }, x0: number, y0: number, x1: number, y1: number): boolean => {
    if (!node.length) {
      let leaf: QuadtreeLeaf<number> | undefined = node as unknown as QuadtreeLeaf<number>;
      do {
        const i = leaf.data;
        const n = nodes[i];
        if (ok[i] && n.x >= rx0 && n.x <= rx1 && n.y >= ry0 && n.y <= ry1) {
          const k = kind[i];
          if ((k !== KIND_SOURCE || lodSource > 0.001) && (k !== KIND_ENTITY || lodEntity > 0.001)) {
            onScreen[i] = frame;
            vis[nVis++] = i;
            place(i);
          }
        }
        leaf = leaf.next;
      } while (leaf);
    }
    return x0 > rx1 || y0 > ry1 || x1 < rx0 || y1 < ry0;
  };

  // Edge geometry: a gentle quadratic bend, trimmed to the droplet rims.
  const geo = new Float64Array(6);
  const edgeGeom = (A: number, B: number): boolean => {
    const ax = pos[2 * A];
    const ay = pos[2 * A + 1];
    const bx = pos[2 * B];
    const by = pos[2 * B + 1];
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy);
    if (len <= rad[A] + rad[B] + 1) return false;
    const cx = (ax + bx) / 2 - dy * EDGE_BEND;
    const cy = (ay + by) / 2 + dx * EDGE_BEND;
    const la = Math.hypot(cx - ax, cy - ay) || 1;
    const lb = Math.hypot(cx - bx, cy - by) || 1;
    geo[0] = ax + ((cx - ax) / la) * rad[A];
    geo[1] = ay + ((cy - ay) / la) * rad[A];
    geo[2] = cx;
    geo[3] = cy;
    geo[4] = bx + ((cx - bx) / lb) * rad[B];
    geo[5] = by + ((cy - by) / lb) * rad[B];
    return true;
  };
  /**
   * Shared culling test for an edge: both ends pass the filters, its rel is
   * selected (Task 13; `by` edges are gated by `showEntities` alone via the
   * GATE_BY bucket, never by `relFilter`), and at least one end is on screen.
   */
  const edgeLive = (j: number): boolean => {
    const A = ea[j];
    const B = eb[j];
    if (!ok[A] || !ok[B] || (onScreen[A] !== frame && onScreen[B] !== frame)) return false;
    if (relFilter && er[j] < REL_NAMES.length && !relFilter.has(er[j])) return false;
    place(A);
    place(B);
    return true;
  };

  /** Closed droplet outline in unit space (radius 1): Catmull-Rom through the control points, or a circle when reduced. */
  const outline = (c: CanvasRenderingContext2D, i: number): void => {
    if (reduced) {
      c.arc(0, 0, 1, 0, TAU);
      return;
    }
    dropletInto(pts, 1, clock, seed[i], false);
    const P = DROPLET_POINTS;
    c.moveTo(pts[0], pts[1]);
    for (let s = 0; s < P; s++) {
      const p0 = ((s + P - 1) % P) * 2;
      const p1 = s * 2;
      const p2 = ((s + 1) % P) * 2;
      const p3 = ((s + 2) % P) * 2;
      c.bezierCurveTo(
        pts[p1] + (pts[p2] - pts[p0]) / 6,
        pts[p1 + 1] + (pts[p2 + 1] - pts[p0 + 1]) / 6,
        pts[p2] - (pts[p3] - pts[p1]) / 6,
        pts[p2 + 1] - (pts[p3 + 1] - pts[p1 + 1]) / 6,
        pts[p2],
        pts[p2 + 1],
      );
    }
    c.closePath();
  };

  const drawDroplet = (c: CanvasRenderingContext2D, i: number, alpha: number, emphasis: boolean): void => {
    const R = rad[i];
    const sx = pos[2 * i];
    const sy = pos[2 * i + 1];
    const tn = theme.tones[tone[i]];
    if (R < 2.5) {
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.globalAlpha = alpha * 0.8;
      c.fillStyle = tn.solid;
      c.beginPath();
      c.arc(sx, sy, Math.max(R, 1.2), 0, TAU);
      c.fill();
      return;
    }
    const k = kind[i];
    c.globalAlpha = alpha;
    // Glow: the pre-rendered sprite, its rim ring matched to the droplet rim, nudged down a little like a drop shadow. Skipped while the camera moves.
    if (!moving && tn.halo && (emphasis || k <= KIND_TOPIC || (k === KIND_CONCEPT && R >= 10))) {
      const ext = (R / GLOW_RIM) * (emphasis ? 1.12 : 1);
      const dy = k <= KIND_TOPIC ? 4 : 2;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.drawImage(tn.halo, sx - ext, sy - ext + dy, 2 * ext, 2 * ext);
    }
    c.setTransform(dpr * R, 0, 0, dpr * R, dpr * sx, dpr * sy);
    c.beginPath();
    outline(c, i);
    if (tn.body) c.fillStyle = tn.body;
    c.fill();
    c.lineWidth = (emphasis ? 2 : 1) / R;
    c.strokeStyle = tn.rim;
    c.stroke();
    if (R < 8) return;
    // Caustic crescent, lower right, as light focused through the drop.
    c.beginPath();
    c.arc(0, 0, 0.74, 0.12 * Math.PI, 0.46 * Math.PI);
    c.lineWidth = Math.min(0.07, 3 / R);
    c.lineCap = 'round';
    c.strokeStyle = theme.caustic;
    c.stroke();
    // Specular highlight, upper left.
    if (theme.specular) {
      c.translate(-0.36, -0.44);
      c.rotate(-0.65);
      c.scale(0.3, 0.17);
      c.beginPath();
      c.arc(0, 0, 1, 0, TAU);
      c.fillStyle = theme.specular;
      c.fill();
    }
  };

  const cardText = (c: CanvasRenderingContext2D, i: number): CardText => {
    let ct = cards[i];
    if (ct) return ct;
    const n = nodes[i];
    font(c, theme.fonts.cardTitle);
    const title = ellipsize(c, n.l, CARD_W - 40 - 12);
    font(c, theme.fonts.small);
    const metaRaw = [n.o, n.d].filter((v) => v).join(' · ') || TYPE_LABEL[n.t];
    ct = { title, meta: ellipsize(c, metaRaw, CARD_W - 28), summary: ellipsize(c, n.s, CARD_W - 28) };
    cards[i] = ct;
    return ct;
  };

  const drawCard = (c: CanvasRenderingContext2D, i: number, alpha: number, emphasis: boolean): void => {
    const n = nodes[i];
    const tn = theme.tones[tone[i]];
    const x0 = Math.round(pos[2 * i] - CARD_W / 2);
    const y0 = Math.round(pos[2 * i + 1] - CARD_H / 2);
    const text = cardText(c, i);
    c.globalAlpha = alpha;
    if (cardShadow) c.drawImage(cardShadow, x0 - CARD_PAD, y0 - CARD_PAD, CARD_W + 2 * CARD_PAD, CARD_H + 2 * CARD_PAD);
    c.beginPath();
    roundRectPath(c, x0, y0, CARD_W, CARD_H, 10);
    c.fillStyle = theme.cardBg;
    c.fill();
    c.lineWidth = emphasis ? 1.5 : 1;
    c.strokeStyle = emphasis ? tn.rim : theme.cardBorder;
    c.stroke();
    c.save();
    c.clip();
    c.fillStyle = tn.solid;
    c.fillRect(x0, y0, 4, CARD_H);
    c.restore();
    c.globalAlpha = alpha;
    // Type badge.
    c.beginPath();
    c.arc(x0 + 24, y0 + 18, 9, 0, TAU);
    c.fillStyle = tn.solid;
    c.fill();
    c.fillStyle = '#ffffff';
    c.strokeStyle = '#ffffff';
    c.lineWidth = 1.3;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    drawGlyph(c, n.t, x0 + 24, y0 + 18);
    // Text rows.
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    font(c, theme.fonts.cardTitle);
    c.fillStyle = theme.ink;
    c.fillText(text.title, x0 + 40, y0 + 18);
    font(c, theme.fonts.small);
    c.fillStyle = theme.muted;
    c.fillText(text.meta, x0 + 16, y0 + 37);
    c.fillText(text.summary, x0 + 16, y0 + 52);
  };

  const dim = new Float64Array(N);
  const MAX_PILLS = 64;
  const boxes = new Float64Array(4 * MAX_PILLS);
  const rootIdx = kind.indexOf(KIND_ROOT);

  function draw(camera: Camera, st: ViewState): void {
    const c = ctx;
    if (!c || vw <= 0 || vh <= 0) return;
    frame = (frame + 1) >>> 0 || 1;
    cam = camera;
    clock = (st.time ?? (typeof performance !== 'undefined' ? performance.now() : Date.now())) / 1000;
    reduced = st.reducedMotion;
    moving = st.moving === true;
    relFilter = st.rels;
    if (cardShadowDpr !== dpr) {
      cardShadow = cardShadowSprite(theme.cardShadow, dpr);
      cardShadowDpr = dpr;
    }
    const k = cam.k;
    const a = lodAlpha(k);
    const l1 = a.conceptLabel;
    const showEntities = st.showEntities === true;
    lodSource = a.sourceDot + a.sourceCard;
    lodEntity = showEntities ? l1 : 0;
    for (let i = 0; i < N; i++) ok[i] = st.visible.has(nodes[i].id) && (kind[i] !== KIND_ENTITY || showEntities) ? 1 : 0;
    const hi = st.hover !== undefined ? indexOf.get(st.hover) ?? -1 : -1;
    const nb = st.neighbors;

    // Background: a faint pool of the topic colour around Agent.
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.globalAlpha = 1;
    c.clearRect(0, 0, vw, vh);
    if (rootIdx >= 0) {
      const gx = (nodes[rootIdx].x - cam.x) * k;
      const gy = (nodes[rootIdx].y - cam.y) * k;
      const pool = c.createRadialGradient(gx, gy, 0, gx, gy, 1500 * k);
      pool.addColorStop(0, rgba(theme.tones[0].rgb, theme.dark ? 0.12 : 0.07));
      pool.addColorStop(1, rgba(theme.tones[0].rgb, 0));
      c.fillStyle = pool;
      c.fillRect(0, 0, vw, vh);
    }

    // 1. Cull.
    const m = (Math.max(maxR * k, 40) + SCREEN_MARGIN) / k;
    rx0 = cam.x - m;
    ry0 = cam.y - m;
    rx1 = cam.x + vw / k + m;
    ry1 = cam.y + vh / k + m;
    nVis = 0;
    qt.visit(visitor);
    const order = vis.subarray(0, nVis).sort(); // node order: root, topics, concepts, sources, entities
    for (let v = 0; v < nVis; v++) {
      const i = order[v];
      dim[i] = hi < 0 || i === hi || (nb !== undefined && nb.has(nodes[i].id)) ? 1 : DIM;
    }

    // 2. Edges, one path per bucket; edges touching the hovered node are deferred.
    c.lineWidth = 1;
    c.lineCap = 'round';
    let nHl = 0;
    const edgeDim = hi >= 0 ? DIM : 1;
    for (const bk of buckets) {
      const gate = bk.gate === GATE_ALWAYS ? 1 : bk.gate === GATE_L1 ? l1 : lodEntity;
      if (gate < 0.01) continue;
      c.globalAlpha = EDGE_ALPHA * gate * edgeDim;
      c.strokeStyle = theme.tones[bk.tone].solid;
      c.beginPath();
      for (let q = 0; q < bk.list.length; q++) {
        const j = bk.list[q];
        if (!edgeLive(j)) continue;
        if (hi >= 0 && (ea[j] === hi || eb[j] === hi)) {
          hl[nHl++] = j;
          continue;
        }
        if (!edgeGeom(ea[j], eb[j])) continue;
        c.moveTo(geo[0], geo[1]);
        c.quadraticCurveTo(geo[2], geo[3], geo[4], geo[5]);
      }
      c.stroke();
    }
    c.lineWidth = 1.6;
    for (let q = 0; q < nHl; q++) {
      const j = hl[q];
      if (!edgeGeom(ea[j], eb[j])) continue;
      c.globalAlpha = 0.75 * (kind[ea[j]] === KIND_SOURCE || kind[eb[j]] === KIND_SOURCE ? l1 : 1);
      c.strokeStyle = theme.tones[tone[ea[j]]].solid;
      c.beginPath();
      c.moveTo(geo[0], geo[1]);
      c.quadraticCurveTo(geo[2], geo[3], geo[4], geo[5]);
      c.stroke();
    }

    // 3. Droplets, back to front so Agent ends on top.
    for (let v = nVis - 1; v >= 0; v--) {
      const i = order[v];
      const kd = kind[i];
      const lod = kd === KIND_SOURCE ? a.sourceDot : kd === KIND_ENTITY ? lodEntity : 1;
      const alpha = lod * dim[i];
      if (alpha >= 0.01) drawDroplet(c, i, alpha, i === hi);
    }

    // 4a. L2 source cards (under the labels, so concept names stay readable).
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (a.sourceCard >= 0.01) {
      for (let v = 0; v < nVis; v++) {
        const i = order[v];
        if (kind[i] === KIND_SOURCE) drawCard(c, i, a.sourceCard * dim[i], i === hi);
      }
    }

    // 4b. Labels (screen space, constant size, haloed).
    c.textAlign = 'center';
    c.lineJoin = 'round';
    c.lineWidth = 3.5;
    c.strokeStyle = theme.halo;
    const label = (s: string, x: number, y: number): void => {
      c.strokeText(s, x, y);
      c.fillText(s, x, y);
    };
    const widthOf = (cache: Float64Array, i: number, s: string): number => {
      if (Number.isNaN(cache[i])) cache[i] = c.measureText(s).width;
      return cache[i];
    };
    const addBox = (i: number, halfW: number, y0: number, y1: number): void => {
      const b = 4 * nLabel;
      lbox[b] = pos[2 * i] - halfW - LABEL_PAD;
      lbox[b + 1] = y0 - LABEL_PAD;
      lbox[b + 2] = pos[2 * i] + halfW + LABEL_PAD;
      lbox[b + 3] = y1 + LABEL_PAD;
      lboxNode[nLabel++] = i;
    };
    nLabel = 0;
    for (let v = nVis - 1; v >= 0; v--) {
      const i = order[v];
      const kd = kind[i];
      const n = nodes[i];
      const x = pos[2 * i];
      const y = pos[2 * i + 1];
      const R = rad[i];
      if (kd <= KIND_TOPIC) {
        c.globalAlpha = a.topicLabel * dim[i];
        c.fillStyle = theme.tones[0].solid;
        let sub = y + R + 8;
        let w: number;
        let top: number;
        if (kd === KIND_ROOT) {
          font(c, theme.fonts.root);
          c.textBaseline = 'middle';
          label(n.l, x, y);
          w = widthOf(labelW, i, n.l);
          top = y - LINE_H.root / 2;
        } else {
          font(c, theme.fonts.topic);
          c.textBaseline = 'top';
          label(n.l, x, sub);
          w = widthOf(labelW, i, n.l);
          top = sub;
          sub += 23;
        }
        let bottom = kd === KIND_ROOT ? y + LINE_H.root / 2 : top + LINE_H.topic;
        if (subLabel[i]) {
          font(c, theme.fonts.sub);
          c.textBaseline = 'top';
          c.fillStyle = theme.muted;
          label(subLabel[i], x, sub);
          w = Math.max(w, widthOf(subW, i, subLabel[i]));
          bottom = sub + LINE_H.sub;
        }
        addBox(i, w / 2, top, bottom);
      } else if (kd === KIND_CONCEPT || kd === KIND_ENTITY) {
        const alpha = (kd === KIND_CONCEPT ? l1 : lodEntity) * dim[i];
        if (alpha < 0.01) continue;
        c.globalAlpha = alpha;
        font(c, kd === KIND_CONCEPT ? theme.fonts.concept : theme.fonts.small);
        c.textBaseline = 'top';
        c.fillStyle = kd === KIND_CONCEPT ? theme.ink : theme.muted;
        label(n.l, x, y + R + 5);
        addBox(i, widthOf(labelW, i, n.l) / 2, y + R + 5, y + R + 5 + (kd === KIND_CONCEPT ? LINE_H.concept : LINE_H.small));
      }
    }

    // 4c. Relation labels on the hovered node's edges.
    font(c, theme.fonts.small);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    let nBox = 0;
    for (let q = 0; q < nHl; q++) {
      const j = hl[q];
      const r = er[j];
      const pillAlpha = 0.95 * (kind[ea[j]] === KIND_SOURCE || kind[eb[j]] === KIND_SOURCE ? l1 : 1);
      if (pillAlpha < 0.01 || r < 0 || r >= REL_NAMES.length || !edgeGeom(ea[j], eb[j])) continue;
      const s = REL_NAMES[r];
      const w = c.measureText(s).width + 12;
      // Greedy de-overlap: a pill goes at the curve's midpoint, else a bit
      // towards either end, at the first spot that covers neither a placed
      // pill nor a node label; otherwise it is skipped. Stop at MAX_PILLS.
      if (nBox >= MAX_PILLS) break;
      let mx = 0;
      let my = 0;
      let found = false;
      for (let tIdx = 0; tIdx < PILL_T.length && !found; tIdx++) {
        const t = PILL_T[tIdx];
        const u = 1 - t;
        mx = u * u * geo[0] + 2 * u * t * geo[2] + t * t * geo[4];
        my = u * u * geo[1] + 2 * u * t * geo[3] + t * t * geo[5];
        const x0 = mx - w / 2;
        const x1 = mx + w / 2;
        const y0 = my - 9;
        const y1 = my + 9;
        let clash = false;
        for (let b = 0; b < nBox && !clash; b++) {
          clash = x0 < boxes[4 * b + 2] && x1 > boxes[4 * b] && y0 < boxes[4 * b + 3] + 1 && y1 + 1 > boxes[4 * b + 1];
        }
        for (let b = 0; b < nLabel && !clash; b++) {
          clash = x0 < lbox[4 * b + 2] && x1 > lbox[4 * b] && y0 < lbox[4 * b + 3] && y1 > lbox[4 * b + 1];
        }
        found = !clash;
      }
      if (!found) continue;
      boxes[4 * nBox] = mx - w / 2;
      boxes[4 * nBox + 1] = my - 9;
      boxes[4 * nBox + 2] = mx + w / 2;
      boxes[4 * nBox + 3] = my + 9;
      nBox++;
      c.globalAlpha = pillAlpha;
      c.beginPath();
      roundRectPath(c, mx - w / 2, my - 9, w, 18, 9);
      c.fillStyle = theme.cardBg;
      c.fill();
      c.lineWidth = 1;
      c.strokeStyle = theme.tones[tone[ea[j]]].rim;
      c.stroke();
      c.fillStyle = theme.ink;
      c.fillText(s, mx, my + 0.5);
    }

    // Keep the hovered node's own label on top of the relation pills.
    if (nHl > 0 && hi >= 0 && onScreen[hi] === frame && kind[hi] !== KIND_SOURCE) {
      const kd = kind[hi];
      c.globalAlpha = 1;
      c.lineWidth = 3.5;
      c.strokeStyle = theme.halo;
      font(c, kd === KIND_ROOT ? theme.fonts.root : kd === KIND_TOPIC ? theme.fonts.topic : kd === KIND_CONCEPT ? theme.fonts.concept : theme.fonts.small);
      c.textBaseline = kd === KIND_ROOT ? 'middle' : 'top';
      c.fillStyle = kd <= KIND_TOPIC ? theme.tones[0].solid : kd === KIND_CONCEPT ? theme.ink : theme.muted;
      const y = pos[2 * hi + 1];
      label(nodes[hi].l, pos[2 * hi], kd === KIND_ROOT ? y : y + rad[hi] + (kd === KIND_TOPIC ? 8 : 5));
    }

    // 4d. Focus ring.
    const fi = st.focus !== undefined ? indexOf.get(st.focus) ?? -1 : -1;
    if (fi >= 0 && onScreen[fi] === frame) {
      const x = pos[2 * fi];
      const y = pos[2 * fi + 1];
      c.globalAlpha = 0.9;
      c.strokeStyle = theme.tones[tone[fi]].solid;
      c.lineWidth = 1.5;
      c.setLineDash([5, 4]);
      c.lineDashOffset = reduced ? 0 : -clock * 8;
      c.beginPath();
      if (kind[fi] === KIND_SOURCE && a.sourceCard >= 0.5) {
        roundRectPath(c, Math.round(x - CARD_W / 2) - 4, Math.round(y - CARD_H / 2) - 4, CARD_W + 8, CARD_H + 8, 13);
      } else {
        c.arc(x, y, rad[fi] + 6, 0, TAU);
      }
      c.stroke();
      c.setLineDash([]);
      c.lineDashOffset = 0;
    }
    c.globalAlpha = 1;
  }

  return {
    draw,
    resize(w: number, h: number, ratio: number) {
      vw = Math.max(0, w);
      vh = Math.max(0, h);
      dpr = ratio > 0 && Number.isFinite(ratio) ? ratio : 1;
      canvas.width = Math.max(1, Math.round(vw * dpr));
      canvas.height = Math.max(1, Math.round(vh * dpr));
      curFont = '';
      if (canvas.style) {
        canvas.style.width = `${vw}px`;
        canvas.style.height = `${vh}px`;
      }
    },
    labelBoxes() {
      const out: LabelBox[] = [];
      for (let b = 0; b < nLabel; b++) {
        out.push({ id: nodes[lboxNode[b]].id, x0: lbox[4 * b], y0: lbox[4 * b + 1], x1: lbox[4 * b + 2], y1: lbox[4 * b + 3] });
      }
      return out;
    },
    refreshTheme() {
      theme = readTheme(ctx);
      labelW.fill(NaN);
      subW.fill(NaN);
      cards.fill(undefined);
      cardShadowDpr = 0;
      curFont = '';
    },
  };
}
