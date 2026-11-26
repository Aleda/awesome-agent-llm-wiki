/**
 * `frameCluster` (V3/V4 of the 2026-11 visual review): flying to a topic at
 * L1 frames the topic plus its concepts; flying to a concept at L2 frames
 * the concept plus its sources' cards — always landing on the requested
 * level.
 */
import { describe, expect, test } from 'vitest';
import { fitNode, frameCluster, LEVEL_RANGE, worldToScreen, type Camera } from '../src/graph/camera';
import { CARD_H, CARD_W, LEVEL_SCALE, levelOf } from '../src/graph/lod';

type P = { x: number; y: number };
const view = { w: 1100, h: 848 };

const screen = (c: Camera, p: P): [number, number] => worldToScreen(c, [p.x, p.y]);
const inside = (c: Camera, p: P, mx: number, my: number): boolean => {
  const [sx, sy] = screen(c, p);
  return sx >= mx && sx <= view.w - mx && sy >= my && sy <= view.h - my;
};

describe('frameCluster', () => {
  test('L1: topic and all its concepts are on screen with label room, level stays 1', () => {
    // Like the real Context topic: the topic sits at the ring top, its
    // concepts spread below and to the sides of it.
    const topic = { x: 0, y: -1000 };
    const concepts = [
      { x: -260, y: -930 },
      { x: 240, y: -910 },
      { x: -120, y: -720 },
      { x: 90, y: -690 },
      { x: 10, y: -1180 },
    ];
    const c = frameCluster(topic, concepts, view, 1);
    expect(levelOf(c.k)).toBe(1);
    for (const p of [topic, ...concepts]) expect(inside(c, p, 100, 40)).toBe(true);
    // The cluster is centred, not the topic dot (V4: concepts crowded at the bottom).
    const ys = [topic, ...concepts].map((p) => screen(c, p)[1]);
    const mid = (Math.min(...ys) + Math.max(...ys)) / 2;
    expect(Math.abs(mid - view.h / 2)).toBeLessThan(60);
  });

  test('L2: every neighbouring source card fits fully on screen, level stays 2', () => {
    // Sources trail off to one side of the concept (as in the real layout,
    // where a source sits by its strongest concept, not this one): at the
    // plain L2 scale centred on the concept the far ones are off screen (V3).
    const concept = { x: 500, y: 300 };
    const sources = [
      { x: 560, y: 250 },
      { x: 700, y: 330 },
      { x: 820, y: 260 },
      { x: 880, y: 420 },
    ];
    const c = frameCluster(concept, sources, view, 2);
    expect(levelOf(c.k)).toBe(2);
    expect(c.k).toBeGreaterThanOrEqual(LEVEL_RANGE[2][0]);
    for (const s of sources) expect(inside(c, s, CARD_W / 2, CARD_H / 2)).toBe(true);
  });

  test('a small cluster is not zoomed past the level scale', () => {
    const c = frameCluster({ x: 0, y: 0 }, [{ x: 30, y: 10 }], view, 2);
    expect(c.k).toBe(LEVEL_SCALE[2]);
  });

  test('members that cannot fit at the level are dropped farthest first; the rest stay on screen', () => {
    // Real case (model-managed-context): one source close by, one too far
    // to share the screen at the lowest L2 zoom. The near one and the
    // focus are framed fully; the view leans toward the far one.
    const focus = { x: 0, y: 0 };
    const near = { x: -150, y: 100 };
    const far = { x: -2500, y: 200 };
    const c = frameCluster(focus, [far, near], view, 2);
    expect(c.k).toBeCloseTo(LEVEL_RANGE[2][0]);
    expect(levelOf(c.k)).toBe(2);
    expect(inside(c, near, CARD_W / 2 - 1, CARD_H / 2 - 1)).toBe(true);
    expect(inside(c, focus, CARD_W / 2 - 1, CARD_H / 2 - 1)).toBe(true);
    expect(screen(c, focus)[0]).toBeGreaterThan(view.w / 2); // leaned left, toward `far`

    // Nothing fits: lowest zoom of the level, focus on screen, never outside the level.
    for (const level of [1, 2] as const) {
      const c2 = frameCluster(focus, [{ x: 3000, y: 2000 }, { x: 2800, y: -50 }], view, level);
      expect(c2.k).toBeCloseTo(LEVEL_RANGE[level][0]);
      expect(levelOf(c2.k)).toBe(level);
      expect(inside(c2, focus, 0, 0)).toBe(true);
    }
  });

  test('level ranges sit clear of the crossfade bands', () => {
    expect(levelOf(LEVEL_RANGE[1][0])).toBe(1);
    expect(levelOf(LEVEL_RANGE[1][1])).toBe(1);
    expect(levelOf(LEVEL_RANGE[2][0])).toBe(2);
  });

  test('L0 or an empty cluster is plain fitNode', () => {
    const n = { x: 10, y: 20 } as Parameters<typeof fitNode>[0];
    expect(frameCluster(n, [{ x: 400, y: 400 }], view, 0)).toEqual(fitNode(n, view, 0));
    expect(frameCluster(n, [], view, 2)).toEqual(fitNode(n, view, 2));
  });
});
