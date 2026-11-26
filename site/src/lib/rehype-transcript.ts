/**
 * rehype plugin for raw transcript pages (`sources/**\/transcript.md`).
 * Every paragraph that starts with `[HH:MM:SS]` gets `id="t-HHMMSS"`, the
 * target of the `#t-HHMMSS` hrefs in the anchor JSON. Consecutive
 * timestamp lines without a blank line between them parse as one
 * Markdown paragraph; such a paragraph is first split into one `<p>` per
 * timestamp line so each timestamp gets its own id.
 */
import type { Element, ElementContent, Root, Text } from 'hast';
import type { Plugin } from 'unified';
import { docsPageId } from './remark-wiki';

const TRANSCRIPT_ID = /^sources\/.+\/transcript$/;
const LEADING_TS = /^\[(\d{2}):(\d{2}):(\d{2})\]/;
const LINE_TS = /\n(?=\[\d{2}:\d{2}:\d{2}\])/;

/** Merge adjacent text nodes (plugins such as directive restoration can leave them split). */
function mergeText(children: ElementContent[]): ElementContent[] {
  const out: ElementContent[] = [];
  for (const child of children) {
    const last = out[out.length - 1];
    if (child.type === 'text' && last?.type === 'text') {
      out[out.length - 1] = { type: 'text', value: last.value + child.value };
    } else {
      out.push(child);
    }
  }
  return out;
}

/** Split a paragraph's children at every newline that is followed by a timestamp. */
function splitAtTimestamps(children: ElementContent[]): ElementContent[][] {
  const groups: ElementContent[][] = [[]];
  for (const child of mergeText(children)) {
    if (child.type !== 'text' || !LINE_TS.test(child.value)) {
      groups[groups.length - 1].push(child);
      continue;
    }
    const pieces = child.value.split(LINE_TS);
    pieces.forEach((value, i) => {
      if (i > 0) groups.push([]);
      if (value !== '') groups[groups.length - 1].push({ type: 'text', value } satisfies Text);
    });
  }
  return groups.filter((group) => group.length > 0);
}

function withId(p: Element): Element {
  const first = p.children[0];
  const match = first?.type === 'text' ? LEADING_TS.exec(first.value) : null;
  if (match) p.properties = { ...p.properties, id: `t-${match[1]}${match[2]}${match[3]}` };
  return p;
}

export const rehypeTranscript: Plugin<[], Root> = () => {
  return (tree, file) => {
    const id = docsPageId(file.path);
    if (id === null || !TRANSCRIPT_ID.test(id)) return;

    const rewrite = (parent: Root | Element) => {
      const out: typeof parent.children = [];
      for (const child of parent.children) {
        if (child.type === 'element' && child.tagName === 'p') {
          const groups = splitAtTimestamps(child.children);
          if (groups.length === 0) {
            out.push(child);
            continue;
          }
          groups.forEach((children, i) => {
            if (i > 0) out.push({ type: 'text', value: '\n' });
            out.push(withId({ ...child, properties: { ...child.properties }, children }));
          });
        } else {
          if (child.type === 'element') rewrite(child);
          out.push(child);
        }
      }
      parent.children = out as typeof parent.children;
    };
    rewrite(tree);
  };
};

export default rehypeTranscript;
