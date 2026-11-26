import { describe, expect, test } from 'vitest';
import { parseTranscriptAnchors, parseAnchorsMd, findCitations } from '../src/lib/anchors';

describe('parseTranscriptAnchors', () => {
  test('transcript anchors truncate to 200 chars', () => {
    const m = parseTranscriptAnchors('[00:00:00] ' + '字'.repeat(300) + '\n[00:01:02] 第二段');
    expect(m.get('00:00:00')!.length).toBe(200);
    expect(m.get('00:01:02')).toBe('第二段');
  });

  test('ignores YAML frontmatter and only reads [HH:MM:SS] lines', () => {
    const md = [
      '---',
      'title: Demo',
      'url: https://example.com',
      '---',
      '',
      '[00:00:00] 第一段开场',
      '[00:01:02] 第二段',
      '',
    ].join('\n');
    const m = parseTranscriptAnchors(md);
    expect([...m.keys()]).toEqual(['00:00:00', '00:01:02']);
    expect(m.get('00:00:00')).toBe('第一段开场');
    expect(m.get('00:01:02')).toBe('第二段');
  });

  test('joins multi-line anchor text with a single space and trims', () => {
    const md = '[00:00:00] line one\nline two  \n[00:00:05] next';
    const m = parseTranscriptAnchors(md);
    expect(m.get('00:00:00')).toBe('line one line two');
  });

  test('counts truncation by Unicode code points, not UTF-16 units', () => {
    // U+1F600 is a surrogate pair in UTF-16 (2 code units) but 1 code point.
    const emoji = '\u{1F600}';
    const text = emoji.repeat(250);
    const m = parseTranscriptAnchors(`[00:00:00] ${text}`);
    const value = m.get('00:00:00')!;
    expect([...value].length).toBe(200);
  });

  test('returns empty map when there are no anchor lines', () => {
    const m = parseTranscriptAnchors('---\ntitle: x\n---\n\nno anchors here\n');
    expect(m.size).toBe(0);
  });
});

describe('parseAnchorsMd', () => {
  test('anchors.md keys', () => {
    const m = parseAnchorsMd(
      '## §3.2 Method\n- Fig. 4 — Accuracy\n- Tab. 2 — Cost\n- §3.2: "we compact every 8 turns"\n- §2¶3: "q"',
    );
    expect([...m.keys()].sort()).toEqual(['Fig. 4', 'Tab. 2', '§2¶3', '§3.2']);
    expect(m.get('§3.2')).toBe('we compact every 8 turns');
  });

  test('quote overrides title for the same key', () => {
    const m = parseAnchorsMd('## §3.2 Method\n- §3.2: "quoted sentence"');
    expect(m.get('§3.2')).toBe('quoted sentence');
  });

  test('title is used when no quote exists for the key', () => {
    const m = parseAnchorsMd('## §4 Results');
    expect(m.get('§4')).toBe('Results');
  });

  test('section heading accepts dotted numbers', () => {
    const m = parseAnchorsMd('## §3.2.1 Deep subsection');
    expect(m.get('§3.2.1')).toBe('Deep subsection');
  });

  test('ignores unrelated lines', () => {
    const m = parseAnchorsMd('some prose\n- not an anchor line\n## not a section either');
    expect(m.size).toBe(0);
  });
});

describe('findCitations', () => {
  test('citations only inside full-width parens', () => {
    expect(
      findCitations('见 §3.2 和（§3.2、Fig. 4）以及（[00:12:03]–[00:14:05]）').map((c) => c.key),
    ).toEqual(['§3.2', 'Fig. 4', '00:12:03', '00:14:05']);
  });

  test('timestamp key omits brackets but start/end cover the brackets', () => {
    const text = '（[00:12:03]）';
    const citations = findCitations(text);
    expect(citations).toHaveLength(1);
    const [c] = citations;
    expect(c.key).toBe('00:12:03');
    expect(text.slice(c.start, c.end)).toBe('[00:12:03]');
  });

  test('recognizes §<num>¶<n> paragraph anchors', () => {
    const text = '（§2¶3）';
    const citations = findCitations(text);
    expect(citations.map((c) => c.key)).toEqual(['§2¶3']);
    expect(text.slice(citations[0].start, citations[0].end)).toBe('§2¶3');
  });

  test('supports comma and space separated citations within one paren group', () => {
    const text = '（§1， §2 Fig. 3）';
    expect(findCitations(text).map((c) => c.key)).toEqual(['§1', '§2', 'Fig. 3']);
  });

  test('ignores citation-looking text inside half-width parens', () => {
    expect(findCitations('(§3.2) and (Fig. 4)')).toEqual([]);
  });

  test('returns empty array when there are no full-width parens', () => {
    expect(findCitations('plain text with §3.2 but no parens')).toEqual([]);
  });

  test('start/end are correct UTF-16 offsets into the original text', () => {
    const text = 'prefix（Fig. 4）suffix';
    const citations = findCitations(text);
    expect(citations).toHaveLength(1);
    expect(text.slice(citations[0].start, citations[0].end)).toBe('Fig. 4');
  });
});
