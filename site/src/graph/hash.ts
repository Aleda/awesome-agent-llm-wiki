/**
 * Shareable graph view in the URL fragment (Task 12, spec §8.4):
 * `#node=<PageId>&z=<0|1|2>`, e.g. `#node=wiki/concepts/context-compaction&z=2`.
 *
 * The id is percent-encoded except for `/`, so links stay readable.
 * Decoding is total: an unknown node, a missing node, a non-numeric `z` or
 * an undecodable fragment all give the L0 overview `{ z: 0 }`.
 */
import type { PageId } from '../lib/content-index';

export interface GraphView {
  node?: PageId;
  z: 0 | 1 | 2;
}

export function encodeView(v: GraphView): string {
  if (v.node === undefined) return `#z=${v.z}`;
  return `#node=${encodeURIComponent(v.node).replace(/%2F/gi, '/')}&z=${v.z}`;
}

export function decodeView(hash: string, ids: Set<PageId>): GraphView {
  const fallback: GraphView = { z: 0 };
  try {
    const raw = hash.startsWith('#') ? hash.slice(1) : hash;
    let node: string | undefined;
    let zText: string | undefined;
    for (const part of raw.split('&')) {
      const eq = part.indexOf('=');
      if (eq < 0) continue;
      const key = part.slice(0, eq);
      const value = part.slice(eq + 1);
      if (key === 'node') node = decodeURIComponent(value);
      else if (key === 'z') zText = value;
    }
    if (!node || !ids.has(node)) return fallback;
    let z = 0;
    if (zText !== undefined) {
      const n = Number(zText);
      if (zText.trim() === '' || !Number.isFinite(n)) return fallback;
      z = Math.min(2, Math.max(0, Math.round(n)));
    }
    return { node, z: z as 0 | 1 | 2 };
  } catch {
    return fallback; // malformed percent-encoding
  }
}
