#!/usr/bin/env -S node
/**
 * Build-time bundle-size budget check (Task 14, global-constraints.md:
 * "内容页本库新增 JS ≤ 10 KB gzip；图谱页 JS ≤ 80 KB gzip；2,000 节点图谱数据 ≤
 * 150 KB gzip"). Run after `astro build` (wired into `npm run build`, see
 * package.json) so `dist/data/graph.json` already exists.
 *
 * `bundleGzipSize` bundles a single entry point alone with esbuild
 * (`bundle: true, minify: true, format: 'esm'`) and gzips the result. This
 * measures only this repo's own code: Starlight's own bundled scripts (and
 * any other page's code) are never pulled in because each entry is bundled
 * in isolation, from scratch, every time.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import * as esbuild from 'esbuild';

export const BUDGETS = {
  hovercard: 10 * 1024,
  graph: 80 * 1024,
  graphData: 150 * 1024,
} as const;

/** Entries measured against `BUDGETS.hovercard` / `BUDGETS.graph`, relative to `site/`. */
const ENTRIES: { name: 'hovercard' | 'graph'; entry: string }[] = [
  { name: 'hovercard', entry: 'src/scripts/hovercard.ts' },
  { name: 'graph', entry: 'src/graph/main.ts' },
];

/**
 * Bundle `entry` alone (esbuild, `bundle: true, minify: true, format:
 * 'esm'`, in-memory via `write: false`) and return the bundled text plus
 * its gzip size in bytes.
 */
async function bundleEntry(entry: string): Promise<{ text: string; gzipSize: number }> {
  const result = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    minify: true,
    format: 'esm',
    write: false,
  });
  const text = result.outputFiles[0].text;
  return { text, gzipSize: gzipSync(text).length };
}

/**
 * Bundle `entry` alone and return the gzip size in bytes of the resulting
 * single output file. Exported for the budget tests (task-14-brief.md
 * Step 1's pinned literals call this directly).
 */
export async function bundleGzipSize(entry: string): Promise<number> {
  return (await bundleEntry(entry)).gzipSize;
}

/**
 * Cheap regression guard (global-constraints.md / task-14-brief.md): the
 * graph bundle must never pull in `forceSimulation` (d3-force, build-time
 * only — see `src/graph/build.ts`) or `zod` (astro/zod, via `../lib/schema`
 * — `main.ts` must only `import type` from it). This happened once in
 * Task 13; checked here (not just in the test suite) so a real `npm run
 * build` catches it too.
 */
function assertGraphBundleClean(text: string): void {
  if (/forceSimulation/.test(text)) {
    throw new Error('graph bundle regression: contains "forceSimulation" (d3-force leaked into the browser bundle)');
  }
  if (/\bzod\b/.test(text)) {
    throw new Error('graph bundle regression: contains "zod" (astro/zod leaked into the browser bundle)');
  }
}

export interface BudgetResult {
  name: string;
  size: number;
  limit: number;
  ok: boolean;
  /** Present only for an entry that could not be measured (e.g. missing graph.json) and is therefore not failed. */
  status?: 'skipped';
}

/**
 * Check every budget: the hovercard and graph bundles (bundled fresh from
 * source via `bundleGzipSize`) and `graph.json`'s gzip size (read from
 * `<distDir>/data/graph.json`). A missing `graph.json` is reported as
 * `{ ok: true, status: 'skipped' }`, not a failure — some builds (e.g.
 * before the graph step ran) legitimately have none yet.
 */
export async function checkBudgets(distDir: string): Promise<BudgetResult[]> {
  const results: BudgetResult[] = [];

  for (const { name, entry } of ENTRIES) {
    const { text, gzipSize } = await bundleEntry(entry);
    if (name === 'graph') assertGraphBundleClean(text);
    const limit = BUDGETS[name];
    results.push({ name, size: gzipSize, limit, ok: gzipSize <= limit });
  }

  const graphJsonPath = path.join(distDir, 'data/graph.json');
  let graphBytes: Buffer | undefined;
  try {
    graphBytes = await fs.readFile(graphJsonPath);
  } catch {
    graphBytes = undefined;
  }

  if (graphBytes === undefined) {
    results.push({ name: 'graphData', size: 0, limit: BUDGETS.graphData, ok: true, status: 'skipped' });
  } else {
    const size = gzipSync(graphBytes).length;
    results.push({ name: 'graphData', size, limit: BUDGETS.graphData, ok: size <= BUDGETS.graphData });
  }

  return results;
}

function fmtKB(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function printTable(results: BudgetResult[]): void {
  for (const r of results) {
    const status = r.status === 'skipped' ? 'skipped' : r.ok ? 'ok' : 'OVER';
    const sizeStr = r.status === 'skipped' ? '-' : fmtKB(r.size);
    console.log(`${r.name.padEnd(10)} ${sizeStr.padStart(10)} / ${fmtKB(r.limit).padStart(8)}  ${status}`);
  }
}

async function main(): Promise<void> {
  const distDir = process.argv[2] ?? 'dist';
  const results = await checkBudgets(distDir);
  printTable(results);
  const failed = results.some((r) => !r.ok);
  if (failed) process.exit(1);
}

const isMainModule =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  void main();
}
