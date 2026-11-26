/**
 * Anchor parsing for transcripts, papers and blogs (spec: CLAUDE.md
 * "锚点、引用与术语表"). Pure, dependency-free module — a remark plugin
 * turns the citations this file finds into links, and a build-time
 * "prepare" step builds anchor JSON from `sources/**\/transcript.md` and
 * `anchors.md` files using the two parse functions below.
 *
 * A Python port (scripts/lib/anchors.py, task 15) must match
 * `parseAnchorsMd` exactly — keep that grammar strict and documented here.
 *
 * ## `parseTranscriptAnchors` grammar
 *
 * Input is a transcript Markdown file. It may start with a YAML
 * frontmatter block (`---` line, arbitrary lines, `---` line); that block
 * (and everything before the first anchor line) is ignored. Every line of
 * the form `[HH:MM:SS] <text>` starts a new anchor keyed by `HH:MM:SS`
 * (without brackets). Lines that follow an anchor line and are not
 * themselves an anchor line are appended to that anchor's value. The final
 * value is: every contributing line's text joined by a single space,
 * trimmed, then truncated to the first 200 Unicode code points (not UTF-16
 * code units — a surrogate pair counts as one character).
 *
 * ## `parseAnchorsMd` grammar
 *
 * One entry per line; any line not matching one of these forms is ignored:
 *
 * - `## §<num> <title>` — section heading. `<num>` is `\d+(\.\d+)*`
 *   (e.g. `3`, `3.2`, `3.2.1`). Key is `§<num>`, value is `<title>` trimmed.
 * - `- Fig. <n> — <desc>` — figure caption (em dash, U+2014). `<n>` is
 *   `\d+`. Key is `Fig. <n>`, value is `<desc>` trimmed.
 * - `- Tab. <n> — <desc>` — table caption (em dash, U+2014). `<n>` is
 *   `\d+`. Key is `Tab. <n>`, value is `<desc>` trimmed.
 * - `- §<num>[¶<n>]: "<quote>"` — verbatim quote tied to a section or
 *   section+paragraph. Key is `§<num>` or `§<num>¶<n>`, value is
 *   `<quote>` (the text between the double quotes, not trimmed further).
 *   A quote line overrides a title heading for the *same key* — i.e. if
 *   `§3.2` has both a `##` heading and a `- §3.2: "..."` quote, the quote
 *   wins regardless of line order.
 *
 * ## `findCitations` grammar
 *
 * Scans `text` for citation tokens, but only considers tokens that occur
 * inside a full-width parenthesis group `（…）` (U+FF08 / U+FF09). A group
 * may contain several citations separated by `、`, `，`, spaces, or `–`
 * (en dash, U+2013 — used for `[a]–[b]` ranges). Recognised token forms,
 * matched left to right inside each group:
 *
 * - `[HH:MM:SS]` — `key` is `HH:MM:SS` (brackets stripped), but `start`/
 *   `end` span the brackets too, so a remark plugin can slice the
 *   original `[HH:MM:SS]` token out of `text` verbatim.
 * - `§<num>¶<n>` or `§<num>` — `key` is the matched text as-is
 *   (`§3.2`, `§2¶3`); `<num>` is `\d+(\.\d+)*`, `<n>` is `\d+`.
 * - `Fig. <n>` — `key` is the matched text as-is (`Fig. 4`).
 * - `Tab. <n>` — `key` is the matched text as-is (`Tab. 2`).
 *
 * `start`/`end` are UTF-16 string offsets into `text` (end exclusive) of
 * the citation token itself, not the surrounding parentheses.
 */

const TRANSCRIPT_ANCHOR_LINE = /^\[(\d{2}:\d{2}:\d{2})\]\s?(.*)$/;
const MAX_ANCHOR_CHARS = 200;

/** Truncate `value` to the first `max` Unicode code points (not UTF-16 units). */
function truncateCodePoints(value: string, max: number): string {
  const chars = [...value];
  if (chars.length <= max) return value;
  return chars.slice(0, max).join('');
}

/**
 * Parse a transcript Markdown file into a map of `HH:MM:SS` -> text.
 * Frontmatter and any text before the first `[HH:MM:SS]` line is ignored.
 * See the grammar documented in the module header comment.
 */
export function parseTranscriptAnchors(md: string): Map<string, string> {
  const result = new Map<string, string>();
  const lines = md.split('\n');

  let currentKey: string | null = null;
  let currentLines: string[] = [];

  const flush = () => {
    if (currentKey === null) return;
    const joined = currentLines.join(' ').trim();
    result.set(currentKey, truncateCodePoints(joined, MAX_ANCHOR_CHARS));
  };

  for (const line of lines) {
    const match = TRANSCRIPT_ANCHOR_LINE.exec(line);
    if (match) {
      flush();
      currentKey = match[1];
      currentLines = [match[2]];
    } else if (currentKey !== null) {
      currentLines.push(line);
    }
    // lines before the first anchor (including frontmatter) are ignored.
  }
  flush();

  return result;
}

const SECTION_HEADING = /^##\s+§(\d+(?:\.\d+)*)\s+(.+)$/;
const FIG_LINE = /^-\s+Fig\.\s+(\d+)\s+—\s+(.+)$/;
const TAB_LINE = /^-\s+Tab\.\s+(\d+)\s+—\s+(.+)$/;
const QUOTE_LINE = /^-\s+§(\d+(?:\.\d+)*)(?:¶(\d+))?:\s+"(.*)"$/;

/**
 * Parse an `anchors.md` file (papers/blogs) into a map of key -> title,
 * figure/table caption, or quoted sentence. See the grammar documented in
 * the module header comment. A quote overrides a section title for the
 * same key, regardless of which line comes first in the file.
 */
export function parseAnchorsMd(md: string): Map<string, string> {
  const titles = new Map<string, string>();
  const quotes = new Map<string, string>();

  for (const rawLine of md.split('\n')) {
    const line = rawLine.trim();

    const section = SECTION_HEADING.exec(line);
    if (section) {
      const [, num, title] = section;
      titles.set(`§${num}`, title.trim());
      continue;
    }

    const fig = FIG_LINE.exec(line);
    if (fig) {
      const [, n, desc] = fig;
      titles.set(`Fig. ${n}`, desc.trim());
      continue;
    }

    const tab = TAB_LINE.exec(line);
    if (tab) {
      const [, n, desc] = tab;
      titles.set(`Tab. ${n}`, desc.trim());
      continue;
    }

    const quote = QUOTE_LINE.exec(line);
    if (quote) {
      const [, num, para, text] = quote;
      const key = para ? `§${num}¶${para}` : `§${num}`;
      quotes.set(key, text);
      continue;
    }
  }

  const result = new Map(titles);
  for (const [key, value] of quotes) {
    result.set(key, value);
  }
  return result;
}

/** One recognised citation token found by `findCitations`. */
export interface Citation {
  key: string;
  start: number;
  end: number;
}

const PAREN_GROUP = /（([^（）]*)）/g;
const CITATION_TOKEN = /\[(\d{2}:\d{2}:\d{2})\]|§(\d+(?:\.\d+)*)(?:¶(\d+))?|Fig\.\s+\d+|Tab\.\s+\d+/g;

/**
 * Find citation tokens inside full-width parenthesis groups `（…）`.
 * See the grammar documented in the module header comment.
 */
export function findCitations(text: string): Citation[] {
  const citations: Citation[] = [];

  for (const groupMatch of text.matchAll(PAREN_GROUP)) {
    const groupContent = groupMatch[1];
    const groupStart = groupMatch.index! + 1; // skip the opening （

    for (const token of groupContent.matchAll(CITATION_TOKEN)) {
      const tokenStart = groupStart + token.index!;
      const tokenEnd = tokenStart + token[0].length;

      if (token[1] !== undefined) {
        // [HH:MM:SS] — key excludes brackets, start/end include them.
        citations.push({ key: token[1], start: tokenStart, end: tokenEnd });
      } else {
        // §<num>[¶<n>], Fig. <n>, or Tab. <n> — key is the token verbatim.
        citations.push({ key: token[0], start: tokenStart, end: tokenEnd });
      }
    }
  }

  return citations;
}
