/**
 * Task 11 render-core tests: camera maths, semantic-zoom alphas, droplet
 * wobble/drift bounds, quadtree culling, the rAF loop's hidden-tab pause,
 * and smoke tests of `createRenderer` against a recording 2D context.
 * The brief's pinned tests come first, verbatim.
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { prepare } from '../scripts/prepare';
import type { GraphData } from '../src/graph/build';
import { REL } from '../src/lib/schema';
import { REL_LABEL } from '../src/lib/labels';
import { flyTo, fitNode, screenToWorld, worldToScreen, zoomAt, K_MIN, K_MAX } from '../src/graph/camera';
import { BAND, CARD_H, CARD_W, L1_AT, L2_AT, LEVEL_SCALE, levelOf, lodAlpha } from '../src/graph/lod';
import { dropletPoints, drift } from '../src/graph/droplet';
import { buildQuadtree, createLoop, createRenderer, visibleIds, type ViewState } from '../src/graph/render';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MINI = path.join(REPO_ROOT, 'tests/fixtures/mini-repo');

let g: GraphData;
let tmp: string;

beforeAll(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'graph-render-test-'));
  await prepare({ root: MINI, siteDir: tmp });
  g = JSON.parse(await fs.readFile(path.join(tmp, 'public/data/graph.json'), 'utf8'));
});

afterAll(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

const qtOf = (data: GraphData) => buildQuadtree(data.nodes);

// --- rAF test harness: a manual frame queue plus a writable document.hidden.
let rafQueue: Map<number, FrameRequestCallback> = new Map();
let rafSeq = 0;
let frameTime = 0;
function installRaf(): void {
  rafQueue = new Map();
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    rafSeq += 1;
    rafQueue.set(rafSeq, cb);
    return rafSeq;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    rafQueue.delete(id);
  });
}
function runFrames(n: number): void {
  for (let i = 0; i < n; i++) {
    const due = [...rafQueue.values()];
    rafQueue.clear();
    frameTime += 16;
    for (const cb of due) cb(frameTime);
  }
}
function setHidden(hidden: boolean): void {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event('visibilitychange'));
}

afterEach(() => {
  vi.unstubAllGlobals();
  setHidden(false);
});

describe('brief pinned tests', () => {
  test('zoomAt keeps the anchor point fixed', () => { const c = zoomAt({x:0,y:0,k:1}, [200,100], 2);
    expect(worldToScreen(c, screenToWorld({x:0,y:0,k:1}, [200,100]))).toEqual([200,100]); });
  test('L0 hides concept labels and sources', () => expect(lodAlpha(0.3)).toMatchObject({conceptLabel:0, sourceDot:0, conceptDot:1}));
  test('L1 shows concept labels and source dots, no cards', () => expect(lodAlpha(1)).toMatchObject({conceptLabel:1, sourceDot:1, sourceCard:0}));
  test('L2 shows cards instead of dots', () => expect(lodAlpha(3)).toMatchObject({sourceCard:1, sourceDot:0}));
  test('crossfade midpoint at threshold', () => expect(lodAlpha(L1_AT).conceptLabel).toBeCloseTo(0.5));
  test('alphas are monotonic in k', () => { let prev = 0; for (let k = 0.1; k < 3; k += 0.05) { const a = lodAlpha(k).sourceCard; expect(a).toBeGreaterThanOrEqual(prev); prev = a; } });
  test('droplet wobble within 6% of r', () => { for (const [x,y] of dropletPoints(20, 1.7, 3, false)) expect(Math.abs(Math.hypot(x,y) - 20)).toBeLessThanOrEqual(1.2); });
  test('reduced motion is a still circle', () => {
    expect(dropletPoints(20, 0, 3, true)).toEqual(dropletPoints(20, 9, 3, true)); expect(drift(5, 3, true)).toEqual([0,0]); });
  test('drift amplitude ≤ 2px', () => { for (let t = 0; t < 10; t += 0.3) expect(Math.hypot(...drift(t, 7, false))).toBeLessThanOrEqual(2); });
  test('culling returns only nodes in rect', () => expect(visibleIds(qtOf(g), {x0:-100,y0:-100,x1:100,y1:100})).toEqual(new Set(['wiki/topics/agent'])));
  test('loop stops when tab hidden', () => { installRaf(); const step = vi.fn(); const loop = createLoop(step, document); loop.start();
    setHidden(true); runFrames(3); const n = step.mock.calls.length; runFrames(3); expect(step.mock.calls.length).toBe(n); loop.stop(); });
});

describe('camera', () => {
  test('zoomAt keeps an arbitrary anchor fixed from a panned camera', () => {
    const c0 = { x: 37, y: -12, k: 0.8 };
    const anchor: [number, number] = [313, 157];
    const w = screenToWorld(c0, anchor);
    const c1 = zoomAt(c0, anchor, 1.25);
    const s = worldToScreen(c1, w);
    expect(s[0]).toBeCloseTo(anchor[0], 9);
    expect(s[1]).toBeCloseTo(anchor[1], 9);
    expect(c1.k).toBeCloseTo(1, 12);
  });

  test('zoomAt clamps k to [K_MIN, K_MAX] and still keeps the anchor fixed', () => {
    const c = zoomAt({ x: 0, y: 0, k: 1 }, [50, 50], 1e6);
    expect(c.k).toBe(K_MAX);
    const s = worldToScreen(c, [50, 50]);
    expect(s[0]).toBeCloseTo(50, 9);
    expect(zoomAt({ x: 0, y: 0, k: 1 }, [0, 0], 1e-6).k).toBe(K_MIN);
  });

  test('fitNode centres the node at the requested level scale', () => {
    const n = g.nodes.find((x) => x.id === 'wiki/topics/context')!;
    for (const level of [0, 1, 2] as const) {
      const c = fitNode(n, { w: 800, h: 600 }, level);
      expect(c.k).toBe(LEVEL_SCALE[level]);
      const [sx, sy] = worldToScreen(c, [n.x, n.y]);
      expect(sx).toBeCloseTo(400, 9);
      expect(sy).toBeCloseTo(300, 9);
    }
  });

  test('flyTo hits both endpoints exactly and zooms monotonically', () => {
    const a = { x: -400, y: -300, k: 0.35 };
    const b = { x: 100, y: -900, k: 2.6 };
    expect(flyTo(a, b, 0)).toEqual(a);
    expect(flyTo(a, b, 1)).toEqual(b);
    expect(flyTo(a, b, -1)).toEqual(a);
    expect(flyTo(a, b, 2)).toEqual(b);
    let prevK = a.k;
    for (let t = 0.05; t < 1; t += 0.05) {
      const c = flyTo(a, b, t);
      expect(c.k).toBeGreaterThanOrEqual(prevK);
      expect(Number.isFinite(c.x) && Number.isFinite(c.y)).toBe(true);
      prevK = c.k;
    }
  });

  test('flyTo eases (slow start, symmetric midpoint) and pans when k is equal', () => {
    const a = { x: 0, y: 0, k: 1 };
    const b = { x: 100, y: 50, k: 1 };
    expect(flyTo(a, b, 0.5)).toEqual({ x: 50, y: 25, k: 1 });
    expect(flyTo(a, b, 0.1).x).toBeLessThan(10);
  });

  test('flyTo keeps the same screen fixed point across the whole flight', () => {
    // A pure zoom about one screen point must stay a pure zoom about it.
    const a = { x: 0, y: 0, k: 1 };
    const b = zoomAt(a, [300, 200], 2.6);
    const w = screenToWorld(a, [300, 200]);
    for (const t of [0.2, 0.5, 0.8]) {
      const s = worldToScreen(flyTo(a, b, t), w);
      expect(s[0]).toBeCloseTo(300, 6);
      expect(s[1]).toBeCloseTo(200, 6);
    }
  });
});

describe('lod', () => {
  test('constants are the brief values', () => {
    expect(LEVEL_SCALE).toEqual([0.35, 1.0, 2.6]);
    expect([L1_AT, L2_AT, BAND, CARD_W, CARD_H]).toEqual([0.6, 1.8, 0.15, 220, 64]);
  });

  test('each LEVEL_SCALE sits outside the crossfade bands', () => {
    expect(lodAlpha(LEVEL_SCALE[0])).toEqual({ topicLabel: 1, conceptDot: 1, conceptLabel: 0, sourceDot: 0, sourceCard: 0 });
    expect(lodAlpha(LEVEL_SCALE[1])).toEqual({ topicLabel: 1, conceptDot: 1, conceptLabel: 1, sourceDot: 1, sourceCard: 0 });
    expect(lodAlpha(LEVEL_SCALE[2])).toEqual({ topicLabel: 1, conceptDot: 1, conceptLabel: 1, sourceDot: 0, sourceCard: 1 });
  });

  test('crossfade is complete at the band edges and half-way at L2_AT', () => {
    expect(lodAlpha(L1_AT * (1 - BAND)).conceptLabel).toBe(0);
    expect(lodAlpha(L1_AT * (1 + BAND)).conceptLabel).toBe(1);
    expect(lodAlpha(L2_AT).sourceCard).toBeCloseTo(0.5);
  });

  test('levelOf maps k to the band it is in', () => {
    expect([levelOf(0.35), levelOf(L1_AT - 0.01), levelOf(L1_AT), levelOf(1), levelOf(L2_AT), levelOf(5)]).toEqual([0, 0, 1, 1, 2, 2]);
  });
});

describe('droplet', () => {
  test('8 control points, wobble bound holds over time and seeds', () => {
    for (let seed = 0; seed < 50; seed++) {
      for (let t = 0; t < 20; t += 0.37) {
        const pts = dropletPoints(20, t, seed, false);
        expect(pts).toHaveLength(8);
        for (const [x, y] of pts) expect(Math.abs(Math.hypot(x, y) - 20)).toBeLessThanOrEqual(1.2);
      }
    }
  });

  test('droplet actually wobbles over time when motion is allowed', () => {
    expect(dropletPoints(20, 0, 3, false)).not.toEqual(dropletPoints(20, 2, 3, false));
  });

  test('reduced droplet is a perfect circle', () => {
    for (const [x, y] of dropletPoints(20, 4, 9, true)) expect(Math.hypot(x, y)).toBeCloseTo(20, 9);
  });

  test('drift bound holds over long time and many seeds, and moves', () => {
    for (let seed = 0; seed < 50; seed++) {
      for (let t = 0; t < 60; t += 0.7) expect(Math.hypot(...drift(t, seed, false))).toBeLessThanOrEqual(2);
    }
    expect(drift(0, 7, false)).not.toEqual(drift(3, 7, false));
  });

  test('drift is slow: moves less than 0.25 px per 100 ms', () => {
    for (let t = 0; t < 12; t += 0.5) {
      const [x0, y0] = drift(t, 11, false);
      const [x1, y1] = drift(t + 0.1, 11, false);
      expect(Math.hypot(x1 - x0, y1 - y0)).toBeLessThan(0.25);
    }
  });
});

describe('culling', () => {
  test('a rect covering the whole layout returns every node', () => {
    expect(visibleIds(qtOf(g), { x0: -5000, y0: -5000, x1: 5000, y1: 5000 })).toEqual(new Set(g.nodes.map((n) => n.id)));
  });

  test('an empty region returns nothing', () => {
    expect(visibleIds(qtOf(g), { x0: 3000, y0: 3000, x1: 3100, y1: 3100 }).size).toBe(0);
  });
});

describe('loop', () => {
  test('steps every frame while visible and passes the frame time', () => {
    installRaf();
    const step = vi.fn();
    const loop = createLoop(step, document);
    loop.start();
    runFrames(3);
    expect(step).toHaveBeenCalledTimes(3);
    expect(typeof step.mock.calls[0][0]).toBe('number');
    loop.stop();
  });

  test('resumes when the tab becomes visible again', () => {
    installRaf();
    const step = vi.fn();
    const loop = createLoop(step, document);
    loop.start();
    setHidden(true);
    runFrames(3);
    const n = step.mock.calls.length;
    setHidden(false);
    runFrames(2);
    expect(step.mock.calls.length).toBe(n + 2);
    loop.stop();
  });

  test('stop() halts stepping and start() twice does not double-schedule', () => {
    installRaf();
    const step = vi.fn();
    const loop = createLoop(step, document);
    loop.start();
    loop.start();
    runFrames(1);
    expect(step).toHaveBeenCalledTimes(1);
    loop.stop();
    runFrames(3);
    setHidden(false);
    runFrames(3);
    expect(step).toHaveBeenCalledTimes(1);
  });
});

// --- Renderer smoke tests against a recording 2D context. The recorder
// keeps every method call plus the fillStyle/globalAlpha in effect at
// each fill/fillText, which is enough to assert what got drawn.
interface Call { m: string; args: unknown[]; fillStyle: unknown; strokeStyle: unknown; alpha: number }
function recordingCanvas(): { canvas: HTMLCanvasElement; calls: Call[] } {
  const calls: Call[] = [];
  const state: Record<string | symbol, unknown> = { globalAlpha: 1, fillStyle: '#000', strokeStyle: '#000' };
  const ctx = new Proxy(state, {
    get(target, prop) {
      if (prop in target) return target[prop];
      return (...args: unknown[]) => {
        calls.push({ m: String(prop), args, fillStyle: target.fillStyle, strokeStyle: target.strokeStyle, alpha: target.globalAlpha as number });
        if (prop === 'createRadialGradient' || prop === 'createLinearGradient') {
          const stops: string[] = [];
          return { stops, addColorStop: (_o: number, c: string) => stops.push(c) };
        }
        if (prop === 'measureText') return { width: String(args[0]).length * 7 };
        return undefined;
      };
    },
    set(target, prop, value) {
      target[prop] = value;
      calls.push({ m: `set:${String(prop)}`, args: [value], fillStyle: target.fillStyle, strokeStyle: target.strokeStyle, alpha: target.globalAlpha as number });
      return true;
    },
  });
  const canvas = { width: 0, height: 0, style: {} as CSSStyleDeclaration, getContext: () => ctx } as unknown as HTMLCanvasElement;
  return { canvas, calls };
}

/** True if a fill/stroke style is (or is a gradient with a stop in) the colour whose `r,g,b` is given. */
const styleHas = (style: unknown, rgb: string): boolean =>
  typeof style === 'string' ? style.replace(/\s/g, '').includes(rgb) : ((style as { stops?: string[] })?.stops ?? []).some((c) => c.replace(/\s/g, '').includes(rgb));
const texts = (calls: Call[]) => calls.filter((c) => c.m === 'fillText').map((c) => String(c.args[0]));

function stateOf(over: Partial<ViewState> = {}): ViewState {
  return { visible: new Set(g.nodes.map((n) => n.id)), reducedMotion: false, time: 1234, ...over };
}

describe('renderer', () => {
  beforeAll(() => {
    document.documentElement.style.setProperty('--c-entity', '#123456');
  });

  test('REL_LABEL keys are in REL order (render maps edge r index -> label)', () => {
    expect(Object.keys(REL_LABEL)).toEqual([...REL]);
  });

  test('does not throw in happy-dom where getContext returns null', () => {
    const canvas = document.createElement('canvas');
    const r = createRenderer(canvas, g);
    r.resize(800, 600, 2);
    r.refreshTheme();
    expect(() => r.draw({ x: -400, y: -300, k: 1 }, stateOf())).not.toThrow();
  });

  test('resize sets the backing store from devicePixelRatio', () => {
    const { canvas } = recordingCanvas();
    createRenderer(canvas, g).resize(800, 600, 2);
    expect([canvas.width, canvas.height]).toEqual([1600, 1200]);
    expect(canvas.style.width).toBe('800px');
  });

  test('L0 draws root and topic labels but no concept labels or cards', () => {
    const { canvas, calls } = recordingCanvas();
    const r = createRenderer(canvas, g);
    r.resize(1000, 1000, 1);
    r.draw(fitNode(g.nodes[0], { w: 1000, h: 1000 }, 0), stateOf());
    const t = texts(calls);
    expect(t).toContain('Agent');
    expect(t.some((s) => s.includes('Context'))).toBe(true);
    expect(t.some((s) => s.includes('压缩'))).toBe(false);
    expect(t.some((s) => s.includes('Sample Paper'))).toBe(false);
  });

  test('L1 near a concept draws its label; L2 draws source cards', () => {
    const concept = g.nodes.find((n) => n.id === 'wiki/concepts/context-compaction')!;
    const paper = g.nodes.find((n) => n.id === 'wiki/papers/202611-sample-paper')!;

    const l1 = recordingCanvas();
    const r1 = createRenderer(l1.canvas, g);
    r1.resize(800, 600, 1);
    r1.draw(fitNode(concept, { w: 800, h: 600 }, 1), stateOf());
    expect(texts(l1.calls)).toContain(concept.l);
    expect(texts(l1.calls).some((s) => s.startsWith(paper.l.slice(0, 6)))).toBe(false);

    const l2 = recordingCanvas();
    const r2 = createRenderer(l2.canvas, g);
    r2.resize(800, 600, 1);
    r2.draw(fitNode(paper, { w: 800, h: 600 }, 2), stateOf());
    expect(texts(l2.calls).some((s) => s.startsWith(paper.l.slice(0, 6)))).toBe(true);
    expect(texts(l2.calls).some((s) => s.includes('Demo Org') && s.includes('2026-11-03'))).toBe(true);
  });

  test('entities are hidden unless showEntities, and nodes outside `visible` are skipped', () => {
    const entity = g.nodes.find((n) => n.t === 'entity')!;
    const cam = fitNode(entity, { w: 800, h: 600 }, 1);
    const entityFill = (calls: Call[]) => calls.some((c) => c.m === 'fill' && styleHas(c.fillStyle, '18,52,86'));

    const off = recordingCanvas();
    const rOff = createRenderer(off.canvas, g);
    rOff.resize(800, 600, 1);
    rOff.draw(cam, stateOf());
    expect(entityFill(off.calls)).toBe(false);

    const on = recordingCanvas();
    const rOn = createRenderer(on.canvas, g);
    rOn.resize(800, 600, 1);
    rOn.draw(cam, stateOf({ showEntities: true }));
    expect(entityFill(on.calls)).toBe(true);

    const filtered = recordingCanvas();
    const rF = createRenderer(filtered.canvas, g);
    rF.resize(800, 600, 1);
    rF.draw(cam, stateOf({ showEntities: true, visible: new Set(g.nodes.filter((n) => n.t !== 'entity').map((n) => n.id)) }));
    expect(entityFill(filtered.calls)).toBe(false);
  });

  test('hover dims non-neighbours and labels the hovered edges with REL_LABEL', () => {
    const concept = g.nodes.find((n) => n.id === 'wiki/concepts/context-compaction')!;
    const { canvas, calls } = recordingCanvas();
    const r = createRenderer(canvas, g);
    r.resize(800, 600, 1);
    r.draw(fitNode(concept, { w: 800, h: 600 }, 1), stateOf({
      hover: concept.id,
      neighbors: new Set(['wiki/topics/context', 'wiki/papers/202611-sample-paper']),
    }));
    const labelCalls = calls.filter((c) => c.m === 'fillText');
    const isolated = labelCalls.find((c) => c.args[0] === g.nodes.find((n) => n.id === 'wiki/concepts/isolated-idea')!.l);
    const hovered = labelCalls.find((c) => c.args[0] === concept.l);
    expect(hovered!.alpha).toBeCloseTo(1);
    expect(isolated!.alpha).toBeLessThanOrEqual(0.15 + 1e-9);
    expect(labelCalls.some((c) => Object.values(REL_LABEL).includes(String(c.args[0])))).toBe(true);
  });

  test('labelBoxes reports drawn labels and relation pills never cover one (Task 12)', () => {
    const topic = g.nodes.find((n) => n.id === 'wiki/topics/context')!;
    const { canvas, calls } = recordingCanvas();
    const r = createRenderer(canvas, g);
    r.resize(1280, 720, 1);
    const cam0 = { x: -1280 / 2 / 0.24, y: -720 / 2 / 0.24, k: 0.24 };
    r.draw(cam0, stateOf({ hover: topic.id, neighbors: new Set(['wiki/topics/agent', 'wiki/concepts/context-compaction', 'wiki/concepts/isolated-idea']) }));
    const boxes = r.labelBoxes();
    expect(boxes.map((b) => b.id)).toEqual(expect.arrayContaining(['wiki/topics/agent', 'wiki/topics/context', 'wiki/topics/memory']));
    for (const b of boxes) expect(b.x1 > b.x0 && b.y1 > b.y0).toBe(true);
    const rel = new Set(Object.values(REL_LABEL));
    const pills = calls.filter((c) => c.m === 'fillText' && rel.has(String(c.args[0])));
    expect(pills.length).toBeGreaterThan(0);
    for (const p of pills) {
      const w = String(p.args[0]).length * 7 + 12;
      const [x, y] = [Number(p.args[1]), Number(p.args[2]) - 0.5];
      for (const b of boxes) {
        const overlap = x - w / 2 < b.x1 && x + w / 2 > b.x0 && y - 9 < b.y1 && y + 9 > b.y0;
        expect(overlap, `${p.args[0]} pill over ${b.id} label`).toBe(false);
      }
    }
  });

  test('reduced motion draws droplets as arcs, not wobbling curves', () => {
    const { canvas, calls } = recordingCanvas();
    const r = createRenderer(canvas, g);
    r.resize(800, 600, 1);
    r.draw(fitNode(g.nodes[0], { w: 800, h: 600 }, 1), stateOf({ reducedMotion: true }));
    expect(calls.some((c) => c.m === 'bezierCurveTo')).toBe(false);
    expect(calls.some((c) => c.m === 'arc')).toBe(true);
  });

  test('focus ring is drawn for ViewState.focus', () => {
    const { canvas, calls } = recordingCanvas();
    const r = createRenderer(canvas, g);
    r.resize(800, 600, 1);
    r.draw(fitNode(g.nodes[1], { w: 800, h: 600 }, 1), stateOf({ focus: g.nodes[1].id }));
    expect(calls.some((c) => c.m === 'setLineDash')).toBe(true);
  });

  test('no per-draw shadowBlur on the main canvas; glow comes from sprites and is skipped while moving', () => {
    // Give the renderer working offscreen canvases so it builds glow sprites.
    const realCreate = document.createElement.bind(document);
    const spy = vi.spyOn(document, 'createElement').mockImplementation(((tag: string) =>
      tag === 'canvas' ? recordingCanvas().canvas : realCreate(tag)) as typeof document.createElement);
    try {
      const { canvas, calls } = recordingCanvas();
      const r = createRenderer(canvas, g);
      r.resize(1000, 1000, 2);
      const cam = fitNode(g.nodes[0], { w: 1000, h: 1000 }, 1);
      r.draw(cam, stateOf());
      expect(calls.some((c) => c.m === 'set:shadowBlur' && Number(c.args[0]) > 0)).toBe(false);
      const still = calls.filter((c) => c.m === 'drawImage').length;
      expect(still).toBeGreaterThan(0);
      calls.length = 0;
      r.draw(cam, stateOf({ moving: true }));
      expect(calls.filter((c) => c.m === 'drawImage').length).toBe(0);
    } finally {
      spy.mockRestore();
    }
  });

  test('ctx.font is only assigned when it changes', () => {
    const { canvas, calls } = recordingCanvas();
    const r = createRenderer(canvas, g);
    r.resize(1000, 1000, 1);
    r.draw(fitNode(g.nodes[0], { w: 1000, h: 1000 }, 0), stateOf());
    const fonts = calls.filter((c) => c.m === 'set:font').map((c) => String(c.args[0]));
    for (let i = 1; i < fonts.length; i++) expect(fonts[i]).not.toBe(fonts[i - 1]);
  });

  test('ink and muted text colours come from --c-ink / --c-muted', () => {
    document.documentElement.style.setProperty('--c-ink', '#010203');
    try {
      const concept = g.nodes.find((n) => n.id === 'wiki/concepts/context-compaction')!;
      const { canvas, calls } = recordingCanvas();
      const r = createRenderer(canvas, g);
      r.resize(800, 600, 1);
      r.draw(fitNode(concept, { w: 800, h: 600 }, 1), stateOf());
      const label = calls.find((c) => c.m === 'fillText' && c.args[0] === concept.l)!;
      expect(label.fillStyle).toBe('#010203');
    } finally {
      document.documentElement.style.removeProperty('--c-ink');
    }
  });
});

