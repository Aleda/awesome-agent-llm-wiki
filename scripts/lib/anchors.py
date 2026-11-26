"""Anchor parsing for transcripts, papers and blogs (spec: CLAUDE.md
"锚点、引用与术语表"). A Python port of `site/src/lib/anchors.ts` (task 15);
see that file's module header for the authoritative grammar — this must
match it exactly. Differences are only in the Python-facing return shapes
that `scripts/lint.py` actually needs (see each function's docstring).

## `parse_transcript_anchors` grammar

Input is a transcript Markdown file. It may start with a YAML frontmatter
block (`---` line, arbitrary lines, `---` line); that block (and everything
before the first anchor line) is ignored. Every line of the form
`[HH:MM:SS] <text>` starts a new anchor keyed by `HH:MM:SS` (without
brackets). Returns the *set* of valid `HH:MM:SS` keys (lint only needs to
know which timestamps exist, not their text).

## `parse_anchors_md` grammar

One entry per line; any line not matching one of these forms is ignored:

- `## §<num> <title>` — section heading. `<num>` is `\\d+(\\.\\d+)*`
  (e.g. `3`, `3.2`, `3.2.1`). Key is `§<num>`, value is `<title>` trimmed.
- `- Fig. <n> — <desc>` — figure caption (em dash, U+2014). `<n>` is
  `\\d+`. Key is `Fig. <n>`, value is `<desc>` trimmed.
- `- Tab. <n> — <desc>` — table caption (em dash, U+2014). `<n>` is
  `\\d+`. Key is `Tab. <n>`, value is `<desc>` trimmed.
- `- §<num>[¶<n>]: "<quote>"` — verbatim quote tied to a section or
  section+paragraph. Key is `§<num>` or `§<num>¶<n>`, value is `<quote>`
  (the text between the double quotes, not trimmed further). A quote line
  overrides a title heading for the *same key* regardless of line order.

## `find_citations` grammar

Scans `text` for citation tokens, but only considers tokens that occur
inside a full-width parenthesis group `（…）` (U+FF08 / U+FF09). A group may
contain several citations separated by `、`, `，`, spaces, or `–` (en dash,
U+2013 — used for `[a]–[b]` ranges). Recognised token forms, matched left
to right inside each group:

- `[HH:MM:SS]` — key is `HH:MM:SS` (brackets stripped).
- `§<num>¶<n>` or `§<num>` — key is the matched text as-is (`§3.2`, `§2¶3`).
- `Fig. <n>` — key is the matched text as-is (`Fig. 4`).
- `Tab. <n>` — key is the matched text as-is (`Tab. 2`).

Returns the list of keys in left-to-right order (lint only needs the keys,
not string offsets — there is no remark-style text-node splicing on the
Python side).
"""

import re

TRANSCRIPT_ANCHOR_LINE = re.compile(r"^\[(\d{2}:\d{2}:\d{2})\]\s?(.*)$")

SECTION_HEADING = re.compile(r"^##\s+§(\d+(?:\.\d+)*)\s+(.+)$")
FIG_LINE = re.compile(r"^-\s+Fig\.\s+(\d+)\s+—\s+(.+)$")
TAB_LINE = re.compile(r"^-\s+Tab\.\s+(\d+)\s+—\s+(.+)$")
QUOTE_LINE = re.compile(r'^-\s+§(\d+(?:\.\d+)*)(?:¶(\d+))?:\s+"(.*)"$')

PAREN_GROUP = re.compile(r"（([^（）]*)）")
CITATION_TOKEN = re.compile(
    r"\[(\d{2}:\d{2}:\d{2})\]|§(\d+(?:\.\d+)*)(?:¶(\d+))?|Fig\.\s+\d+|Tab\.\s+\d+"
)


def parse_transcript_anchors(text: str) -> set[str]:
    """Parse a transcript Markdown file into the set of `HH:MM:SS` keys
    that have an anchor line. Frontmatter and any text before the first
    `[HH:MM:SS]` line is ignored. See the grammar in the module docstring.
    """
    result: set[str] = set()
    for line in text.split("\n"):
        match = TRANSCRIPT_ANCHOR_LINE.match(line)
        if match:
            result.add(match.group(1))
    return result


def parse_anchors_md(text: str) -> dict[str, str]:
    """Parse an `anchors.md` file (papers/blogs) into a map of key ->
    title, figure/table caption, or quoted sentence. Matches
    `parseAnchorsMd` in `site/src/lib/anchors.ts` exactly: a quote
    overrides a section title for the same key, regardless of which line
    comes first in the file.
    """
    titles: dict[str, str] = {}
    quotes: dict[str, str] = {}

    for raw_line in text.split("\n"):
        line = raw_line.strip()

        section = SECTION_HEADING.match(line)
        if section:
            num, title = section.group(1), section.group(2)
            titles[f"§{num}"] = title.strip()
            continue

        fig = FIG_LINE.match(line)
        if fig:
            n, desc = fig.group(1), fig.group(2)
            titles[f"Fig. {n}"] = desc.strip()
            continue

        tab = TAB_LINE.match(line)
        if tab:
            n, desc = tab.group(1), tab.group(2)
            titles[f"Tab. {n}"] = desc.strip()
            continue

        quote = QUOTE_LINE.match(line)
        if quote:
            num, para, quoted_text = quote.group(1), quote.group(2), quote.group(3)
            key = f"§{num}¶{para}" if para else f"§{num}"
            quotes[key] = quoted_text
            continue

    result = dict(titles)
    result.update(quotes)
    return result


def find_citations(text: str) -> list[str]:
    """Find citation token keys inside full-width parenthesis groups
    `（…）`, left to right. See the grammar in the module docstring.
    """
    citations: list[str] = []

    for group_match in PAREN_GROUP.finditer(text):
        group_content = group_match.group(1)
        for token in CITATION_TOKEN.finditer(group_content):
            timestamp = token.group(1)
            if timestamp is not None:
                citations.append(timestamp)
            else:
                citations.append(token.group(0))

    return citations


def _normalize_whitespace(value: str) -> str:
    """Collapse runs of whitespace to a single space, trim both ends."""
    return re.sub(r"\s+", " ", value).strip()


def verify_against_fulltext(anchors: dict[str, str], fulltext: str) -> list[str]:
    """Check that every anchor's title/caption/quote appears verbatim in
    `fulltext`, after collapsing whitespace runs to a single space on both
    sides. Returns the list of keys whose value could not be found,
    preserving `anchors`' iteration order.
    """
    normalized_fulltext = _normalize_whitespace(fulltext)
    missing: list[str] = []
    for key, value in anchors.items():
        normalized_value = _normalize_whitespace(value)
        if normalized_value not in normalized_fulltext:
            missing.append(key)
    return missing
