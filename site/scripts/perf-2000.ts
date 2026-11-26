/**
 * Pre-release 2,000-node graph performance check (Task 26 Step 2, spec §3:
 * "图谱的首屏时间和帧率在发版前用本地造的 2,000 节点数据手工测一次，不进 CI").
 * Not part of `npm run build`; run by hand:
 *
 *   npm run build                                  # real content
 *   npx tsx scripts/perf-2000.ts write             # overwrite dist/data/graph.json
 *   ASTRO_PREVIEW_BACKGROUND=1 npx astro preview --port 4321 &
 *   npx tsx scripts/perf-2000.ts measure [out.png] # TTI + frame times, JSON on stdout
 *   npm run build                                  # restore real data
 *
 * `measure` uses Playwright Chromium at 1440×900, devicePixelRatio 2, once
 * unthrottled and once with CDP `Emulation.setCPUThrottlingRate` 4×.
 * First interactive = navigation start → `data-ready` on `#graph-app`.
 * Frame times come from a requestAnimationFrame recorder while a script
 * pans (mouse drag) and zooms (wheel) across L0 → L1 → L2 and back.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { chromium, type Page } from '@playwright/test';
import { buildGraph } from '../src/graph/build';
import { synthIndex } from '../tests/helpers/synth';

const ORIGIN = 'http://localhost:4321';
const HOME = `${ORIGIN}/awesome-agent-llm-wiki/`;
const W = 1440;
const H = 900;
const TTI_RUNS = 5;
/** Matches `WHEEL_RATE` in src/graph/main.ts: zoom factor = exp(-deltaY × rate). */
const WHEEL_RATE = 0.0015;

async function write(): Promise<void> {
  const json = JSON.stringify(buildGraph(synthIndex(2000), {}));
  const out = path.resolve('dist/data/graph.json');
  await fs.writeFile(out, json, 'utf8');
  const data = JSON.parse(json) as { nodes: unknown[]; edges: unknown[] };
  console.log(
    JSON.stringify({
      file: out,
      nodes: data.nodes.length,
      edges: data.edges.length,
      rawBytes: Buffer.byteLength(json),
      gzipBytes: gzipSync(json).length,
    }),
  );
}

/** Records `performance.now()` when `#graph-app` gets `data-ready` (relative to navigation start). */
const READY_PROBE = `
  new MutationObserver((ms, obs) => {
    for (const m of ms) {
      if (m.target.id === 'graph-app' && m.target.hasAttribute('data-ready')) {
        window.__readyAt = performance.now();
        obs.disconnect();
        return;
      }
    }
  }).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-ready'] });
`;

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const quantile = (xs: number[], q: number): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.floor(q * (s.length - 1))))];
};

interface FrameStats {
  frames: number;
  medianFps: number;
  p5Fps: number;
  over16: number;
  /** > 20 ms: a frame that actually missed a 60 Hz vsync (> 16.7 ms alone also counts rAF timestamp jitter around 16.67 ms). */
  over20: number;
  over33: number;
}

/** Frame deltas (ms) → stats. p5 fps is the fps of the 95th-percentile frame time. */
function stats(deltas: number[]): FrameStats {
  const pct = (t: number) => Math.round((1000 * deltas.filter((d) => d > t).length) / deltas.length) / 10;
  return {
    frames: deltas.length,
    medianFps: Math.round(10000 / median(deltas)) / 10,
    p5Fps: Math.round(10000 / quantile(deltas, 0.95)) / 10,
    over16: pct(16.7),
    over20: pct(20),
    over33: pct(33.4),
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * rAF recorder: pushes `[frameDeltaMs, phase]` into `window.__frames` until
 * `window.__rec` is cleared. A string, not a function: tsx/esbuild's
 * `keepNames` would inject a `__name` helper the page doesn't have.
 */
const RECORDER = `
  window.__frames = [];
  window.__mark = 'idle';
  window.__rec = true;
  let last = 0;
  const tick = (t) => {
    if (!window.__rec) return;
    window.__frames.push([t - last, window.__mark]);
    last = t;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame((t) => { last = t; requestAnimationFrame(tick); });
`;

async function startRecorder(page: Page): Promise<void> {
  await page.evaluate(RECORDER);
}

const mark = (page: Page, m: string) => page.evaluate((v) => ((window as unknown as { __mark: string }).__mark = v), m);

/** Drag the canvas in a slow circle for `ms`. */
async function pan(page: Page, ms: number): Promise<void> {
  const cx = W / 2;
  const cy = H / 2 + 40;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const a = ((Date.now() - t0) / ms) * Math.PI * 2;
    await page.mouse.move(cx + 180 * Math.sin(a), cy + 120 * Math.sin(2 * a));
    await sleep(8);
  }
  await page.mouse.up();
}

/**
 * Current camera scale k: screen distance between two topic droplets over
 * their world distance (via the e2e `graphDebug.screenOf` hook).
 */
async function scaleOf(page: Page, world: number): Promise<number> {
  const d = await page.evaluate(`(() => {
    const g = document.getElementById('graph-app').graphDebug;
    const a = g.screenOf('wiki/topics/t0'), b = g.screenOf('wiki/topics/t1');
    return Math.hypot(a[0] - b[0], a[1] - b[1]);
  })()`);
  return (d as number) / world;
}

/**
 * Wheel-zoom at the viewport centre to scale `k1` over `ms`, following a
 * geometric schedule. Closed-loop on the measured k: Chromium delivers a
 * different deltaY than dispatched (halved at devicePixelRatio 2).
 */
async function zoom(page: Page, ms: number, k1: number, world: number): Promise<void> {
  await page.mouse.move(W / 2, H / 2 + 40);
  const k0 = await scaleOf(page, world);
  const t0 = Date.now();
  for (;;) {
    const f = Math.min(1, (Date.now() - t0) / ms);
    const target = k0 * Math.pow(k1 / k0, f);
    const k = await scaleOf(page, world);
    const dy = (-2 * Math.log(target / k)) / WHEEL_RATE;
    if (Math.abs(dy) > 0.5) await page.mouse.wheel(0, Math.max(-400, Math.min(400, dy)));
    if (f >= 1 && Math.abs(Math.log(k1 / k)) < 0.02) break;
    if (Date.now() - t0 > ms + 1500) break;
    await sleep(8);
  }
}

/** World distance between the root topic t0 and topic t1 in the served graph.json. */
async function topicDistance(): Promise<number> {
  const g = (await (await fetch(`${HOME}data/graph.json`)).json()) as { nodes: { id: string; x: number; y: number }[] };
  const a = g.nodes.find((n) => n.id === 'wiki/topics/t0')!;
  const b = g.nodes.find((n) => n.id === 'wiki/topics/t1')!;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

async function run(throttle: number, shot?: string) {
  const world = await topicDistance();
  const browser = await chromium.launch({ headless: false, args: ['--disable-backgrounding-occluded-windows'] });
  try {
    const tti: number[] = [];
    for (let i = 0; i < TTI_RUNS; i++) {
      const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
      await page.addInitScript(READY_PROBE);
      await page.goto(HOME);
      await page.waitForSelector('#graph-app[data-ready]');
      tti.push(await page.evaluate(() => (window as unknown as { __readyAt: number }).__readyAt));
      await ctx.close();
    }

    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
    await page.goto(HOME);
    await page.waitForSelector('#graph-app[data-ready]');
    const SEG = 1700;
    await sleep(1000);
    const kStart = await scaleOf(page, world);
    await startRecorder(page);
    await mark(page, 'idle');
    await sleep(SEG);
    const levels: string[] = [];
    const lv = async () => levels.push(String(await page.locator('#graph-app').getAttribute('data-level')));
    await lv();
    const steps: [string, () => Promise<void>][] = [
      ['pan L0', () => pan(page, SEG)],
      ['zoom L0→L1', () => zoom(page, SEG, 1.0, world)],
      ['pan L1', () => pan(page, SEG)],
      ['zoom L1→L2', () => zoom(page, SEG, 2.6, world)],
      ['pan L2', () => pan(page, SEG)],
      ['zoom L2→L0', () => zoom(page, SEG, kStart, world)],
    ];
    for (const [name, step] of steps) {
      await mark(page, name);
      await step();
      await lv();
    }
    const frames = await page.evaluate(() => {
      const w = window as unknown as { __frames: [number, string][]; __rec: boolean };
      w.__rec = false;
      return w.__frames;
    });
    const of = (prefix: string) => frames.filter(([, k]) => k.startsWith(prefix)).map(([d]) => d);
    const result = {
      throttle,
      ttiMs: tti.map((t) => Math.round(t)),
      ttiMedianMs: Math.round(median(tti)),
      levels,
      kStart: Math.round(kStart * 1000) / 1000,
      idle: stats(of('idle')),
      pan: stats(of('pan')),
      zoom: stats(of('zoom')),
      all: stats([...of('pan'), ...of('zoom')]),
      segments: Object.fromEntries(steps.map(([name]) => [name, stats(of(name))])),
    };
    await ctx.close();

    if (shot) {
      const c = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
      const p = await c.newPage();
      await p.goto(`${HOME}#node=wiki/topics/t1&z=1`);
      await p.waitForSelector('#graph-app[data-ready]');
      await sleep(2000);
      await p.screenshot({ path: shot });
      result.levels.push(`shot:L${await p.locator('#graph-app').getAttribute('data-level')}`);
      await c.close();
    }
    return result;
  } finally {
    await browser.close();
  }
}

async function measure(shot?: string): Promise<void> {
  const unthrottled = await run(1, shot);
  const throttled = await run(4);
  console.log(JSON.stringify({ unthrottled, throttled }, null, 2));
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === 'write') await write();
else if (cmd === 'measure') await measure(arg);
else {
  console.error('usage: tsx scripts/perf-2000.ts write | measure [screenshot.png]');
  process.exit(2);
}
