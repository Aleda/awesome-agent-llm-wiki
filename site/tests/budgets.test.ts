/**
 * Task 14 budget-check tests (task-14-brief.md Step 1, pinned verbatim).
 * `bundleGzipSize` bundles a single entry with esbuild (bundle+minify+esm)
 * and gzips the result — this measures only this repo's own code (Starlight's
 * bundled scripts are never pulled in because each entry is bundled alone).
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { describe, expect, test, afterEach } from 'vitest';
import { bundleGzipSize, checkBudgets, BUDGETS } from '../scripts/check-budgets';

describe('bundleGzipSize', () => {
  test('hovercard bundle within 10KB', async () =>
    expect(await bundleGzipSize('src/scripts/hovercard.ts')).toBeLessThanOrEqual(BUDGETS.hovercard));

  test('graph bundle within 80KB', async () =>
    expect(await bundleGzipSize('src/graph/main.ts')).toBeLessThanOrEqual(BUDGETS.graph));

  test('graph bundle excludes d3-force and zod (regression guard)', async () => {
    const esbuild = await import('esbuild');
    const result = await esbuild.build({
      entryPoints: ['src/graph/main.ts'],
      bundle: true,
      minify: true,
      format: 'esm',
      write: false,
    });
    const text = result.outputFiles[0].text;
    expect(text).not.toMatch(/forceSimulation/);
    expect(text).not.toMatch(/\bzod\b/);
  });
});

describe('checkBudgets', () => {
  const tmpDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tmpDirs.splice(0).map((d) => fs.rm(d, { recursive: true, force: true })));
  });

  async function makeDist(graphJsonSize?: number): Promise<string> {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'budgets-test-'));
    tmpDirs.push(dir);
    await fs.mkdir(path.join(dir, 'data'), { recursive: true });
    if (graphJsonSize !== undefined) {
      // pad with whitespace so it's valid-ish content but hits the target gzip size
      const payload = JSON.stringify({ nodes: [], edges: [], pad: 'x'.repeat(graphJsonSize) });
      await fs.writeFile(path.join(dir, 'data/graph.json'), payload);
    }
    return dir;
  }

  test('over-budget graphData fails', async () => {
    // Build a graph.json whose gzip size exceeds 150KB: real randomness
    // (crypto, not a weak LCG that gzip can partially model) compresses
    // down to near-zero overhead, so 200KB of it stays over budget after gzip.
    const { randomBytes } = await import('node:crypto');
    const huge = randomBytes(220 * 1024).toString('base64');
    const dist = await makeDist();
    await fs.writeFile(path.join(dist, 'data/graph.json'), JSON.stringify({ pad: huge }));
    // sanity: confirm this payload really is over budget before asserting on checkBudgets
    const raw = await fs.readFile(path.join(dist, 'data/graph.json'));
    expect(gzipSync(raw).length).toBeGreaterThan(BUDGETS.graphData);

    const results = await checkBudgets(dist);
    const graphData = results.find((r) => r.name === 'graphData');
    expect(graphData).toBeDefined();
    expect(graphData!.ok).toBe(false);
  });

  test('missing graph.json is skipped, not failed', async () => {
    const dist = await makeDist();
    const results = await checkBudgets(dist);
    const graphData = results.find((r) => r.name === 'graphData');
    expect(graphData).toBeDefined();
    expect(graphData!.ok).toBe(true);
    expect((graphData as { status?: string }).status).toBe('skipped');
  });

  test('hovercard and graph entries are reported and within budget', async () => {
    const dist = await makeDist();
    const results = await checkBudgets(dist);
    const hovercard = results.find((r) => r.name === 'hovercard');
    const graph = results.find((r) => r.name === 'graph');
    expect(hovercard?.ok).toBe(true);
    expect(graph?.ok).toBe(true);
  });

  test('small graph.json passes the budget', async () => {
    const dist = await makeDist();
    await fs.writeFile(path.join(dist, 'data/graph.json'), JSON.stringify({ nodes: [], edges: [] }));
    const results = await checkBudgets(dist);
    const graphData = results.find((r) => r.name === 'graphData');
    expect(graphData?.ok).toBe(true);
  });
});
