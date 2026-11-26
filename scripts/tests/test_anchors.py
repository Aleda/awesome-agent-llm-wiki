"""Tests for scripts/lib/anchors.py — must match site/src/lib/anchors.ts
semantics (parseAnchorsMd format, findCitations grammar, transcript anchor
keys). Run with: uv run --with pytest --with pyyaml pytest scripts/tests -q
"""

from lib.anchors import (
    find_citations,
    parse_anchors_md,
    parse_transcript_anchors,
    verify_against_fulltext,
)


def test_parse_anchors_md_matches_ts_format():
    m = parse_anchors_md(
        '## §3.2 Method\n- Fig. 4 — Accuracy\n- Tab. 2 — Cost\n'
        '- §3.2: "we compact every 8 turns"\n- §2¶3: "q"'
    )
    assert sorted(m) == ["Fig. 4", "Tab. 2", "§2¶3", "§3.2"]
    assert m["§3.2"] == "we compact every 8 turns"


def test_parse_anchors_md_quote_overrides_title_for_same_key():
    m = parse_anchors_md('## §3.2 Method\n- §3.2: "quoted sentence"')
    assert m["§3.2"] == "quoted sentence"


def test_parse_anchors_md_quote_before_title_still_overrides():
    # order in file shouldn't matter: quote always wins for the same key.
    m = parse_anchors_md('- §3.2: "quoted sentence"\n## §3.2 Method')
    assert m["§3.2"] == "quoted sentence"


def test_parse_anchors_md_ignores_unmatched_lines():
    m = parse_anchors_md("some prose\n- not a caption\n## not a section (no §)")
    assert m == {}


def test_parse_transcript_anchors_returns_key_set():
    md = (
        "---\ntitle: Demo\n---\n\n"
        "[00:00:00] first\n[00:01:02] second\n"
    )
    assert parse_transcript_anchors(md) == {"00:00:00", "00:01:02"}


def test_parse_transcript_anchors_ignores_lines_without_timestamp():
    md = "intro text\n[00:00:05] anchored\nmore text\n"
    assert parse_transcript_anchors(md) == {"00:00:05"}


def test_parse_transcript_anchors_empty_when_no_anchors():
    assert parse_transcript_anchors("---\ntitle: x\n---\n\nno anchors here\n") == set()


def test_find_citations_only_inside_fullwidth_parens():
    text = "见 §3.2 和（§3.2、Fig. 4）以及（[00:12:03]–[00:14:05]）"
    assert find_citations(text) == ["§3.2", "Fig. 4", "00:12:03", "00:14:05"]


def test_find_citations_timestamp_key_has_no_brackets():
    assert find_citations("（[00:12:03]）") == ["00:12:03"]


def test_find_citations_recognizes_paragraph_anchor():
    assert find_citations("（§2¶3）") == ["§2¶3"]


def test_find_citations_comma_and_space_separated():
    assert find_citations("（§1， §2 Fig. 3）") == ["§1", "§2", "Fig. 3"]


def test_find_citations_ignores_halfwidth_parens():
    assert find_citations("(§3.2) and (Fig. 4)") == []


def test_find_citations_empty_without_fullwidth_parens():
    assert find_citations("plain text with §3.2 but no parens") == []


def test_verify_against_fulltext_finds_missing_key():
    anchors = {"§3.2": "we compact every 8 turns"}
    assert verify_against_fulltext(anchors, "no matching text") == ["§3.2"]


def test_verify_against_fulltext_passes_when_present():
    anchors = {"§3.2": "we compact every 8 turns"}
    fulltext = "...context: we compact every 8 turns, as shown..."
    assert verify_against_fulltext(anchors, fulltext) == []


def test_verify_against_fulltext_collapses_whitespace_before_matching():
    anchors = {"§3.2": "we   compact\nevery 8 turns"}
    fulltext = "we compact every 8 turns appears here"
    assert verify_against_fulltext(anchors, fulltext) == []
