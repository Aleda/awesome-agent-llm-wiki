"""Tests for scripts/fetch_paper.py (Task 17; fix round 1 additions for
caption truncation without `…`, MathML annotation/alttext de-duplication,
the post-write self-check, and mocked `_get`/`_throttle` behavior).

Fixtures:
- `arxiv_atom.xml` — real Atom API response for id_list=2611.05306 (retrieved
  2026-11-26, trimmed to the single `<entry>` — already small).
- `arxiv_html_snippet.html` — hand-trimmed snippet mirroring the real
  structure of https://arxiv.org/html/2611.05306 (LaTeXML HTML output):
  ltx_title_section/subsection headings, Figure/Table figcaptions, and an
  ltx_title_appendix section whose subsection (`A.1`) must be skipped
  (non-numeric per the shared `§` grammar — `\\d+(\\.\\d+)*`). Also includes
  a `<math alttext="...">` element with a nested `<annotation>` (fix round 1,
  item 2) in the Figure 1 caption.
- `pdf_text.txt` — a hand-built excerpt in the shape of pypdf's text
  extraction for the same paper (used for the HTML-absent fallback path).
"""

import sys
from pathlib import Path
from unittest.mock import patch

import pytest

SCRIPTS_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SCRIPTS_DIR))

from fetch_paper import (  # noqa: E402
    MIN_REQUEST_INTERVAL,
    _get,
    _strip_tags,
    _throttle,
    _truncate,
    anchors_from_html,
    anchors_from_pdf_text,
    merge_anchors,
    parse_arxiv_id,
    parse_atom,
    self_check_anchors,
)

FIXTURES = SCRIPTS_DIR / "tests" / "fixtures"
ATOM_XML = (FIXTURES / "arxiv_atom.xml").read_text(encoding="utf-8")
HTML = (FIXTURES / "arxiv_html_snippet.html").read_text(encoding="utf-8")
PDF_TEXT = (FIXTURES / "pdf_text.txt").read_text(encoding="utf-8")


def test_fixtures_are_small():
    for name in ("arxiv_atom.xml", "arxiv_html_snippet.html", "pdf_text.txt"):
        assert (FIXTURES / name).stat().st_size < 30 * 1024


def test_parse_arxiv_id():
    assert {
        parse_arxiv_id(s)
        for s in [
            "https://arxiv.org/abs/2611.05306",
            "https://arxiv.org/pdf/2611.05306v2",
            "2611.05306",
        ]
    } == {"2611.05306"}


def test_parse_arxiv_id_rejects_garbage():
    with pytest.raises(ValueError):
        parse_arxiv_id("not an arxiv id or url")


def test_parse_atom():
    meta = parse_atom(ATOM_XML)
    assert meta["id"] == "2611.05306"
    assert meta["title"] == "You don't need long context"
    assert meta["authors"] == [
        "Peter Belcak",
        "Saurav Muralidharan",
        "Jindong Jiang",
        "Yonggan Fu",
        "Wonmin Byeon",
        "Hanrong Ye",
        "Ryan Angilly",
        "Ali Taghibakhshi",
        "Shih-Yang Liu",
        "Siru Ouyang",
        "Greg Heinrich",
        "Pavlo Molchanov",
    ]
    assert meta["published"] == "2026-11-03T18:17:23Z"
    assert meta["updated"] == "2026-11-03T18:17:23Z"
    assert meta["abs_url"] == "https://arxiv.org/abs/2611.05306v1"
    assert meta["pdf_url"] == "https://arxiv.org/pdf/2611.05306v1"
    assert meta["primary_category"] == "cs.AI"
    assert meta["comment"] == "Technical report. 31 pages, 8 figures"


def test_anchors_from_html():
    assert anchors_from_html(HTML)[:2] == ["## §1 Introduction", "## §3.2 Method"]


def test_anchors_from_html_skips_appendix_subsections():
    anchors = anchors_from_html(HTML)
    assert not any("§A" in a for a in anchors)
    assert not any(a.startswith("## §A") for a in anchors)


def test_anchors_from_html_has_fig_and_tab():
    anchors = anchors_from_html(HTML)
    assert any(a.startswith("- Fig. 1 —") for a in anchors)
    assert any(a.startswith("- Tab. 2 —") for a in anchors)


def test_figure_caption_truncated():
    assert all(len(l) <= 140 for l in anchors_from_html(HTML) if l.startswith("- Fig."))


def test_pdf_fallback():
    assert "- Tab. 2 — Compute per trial" in anchors_from_pdf_text(PDF_TEXT)


def test_pdf_fallback_sections():
    anchors = anchors_from_pdf_text(PDF_TEXT)
    assert "## §3.2 Method" in anchors
    assert "## §6 Conclusion" in anchors


def test_merge_is_append_only():
    old = '## §1 Introduction\n- §1: "kept quote"\n'
    assert merge_anchors(old, ["## §1 Introduction (changed)", "## §2 Method"]).startswith(old)


def test_merge_appends_only_new_keys():
    old = "## §1 Introduction\n"
    merged = merge_anchors(old, ["## §1 Introduction", "## §2 Method"])
    # §1's key already existed (as a title) — not duplicated; §2 is new.
    assert merged.count("§1 Introduction") == 1
    assert "## §2 Method" in merged


def test_merge_anchors_idempotent():
    old = "## §1 Introduction\n"
    new = ["## §1 Introduction", "## §2 Method"]
    once = merge_anchors(old, new)
    twice = merge_anchors(once, new)
    assert once == twice


# ---------------------------------------------------------------------------
# Fix round 1, item 1: truncation without "…", always an exact prefix.
# ---------------------------------------------------------------------------


def test_truncate_200_char_caption_is_exact_prefix_no_ellipsis():
    caption = "A" * 80 + ". " + "B" * 120
    truncated = _truncate(caption, 120)
    assert caption.startswith(truncated)
    assert len(truncated) <= 120
    assert "…" not in truncated


def test_truncate_short_text_is_unchanged():
    assert _truncate("short text", 120) == "short text"


def test_truncate_falls_back_to_whitespace_without_punctuation():
    caption = "word " * 40  # no sentence-boundary punctuation anywhere
    truncated = _truncate(caption, 120)
    assert caption.startswith(truncated)
    assert len(truncated) <= 120
    assert "…" not in truncated
    assert not truncated.endswith(" ")  # cut lands right before a space, not on one


# ---------------------------------------------------------------------------
# Fix round 1, item 2: MathML annotation/alttext de-duplication.
# ---------------------------------------------------------------------------

MATH_SNIPPET = (
    'Dollar cost of generating <math id="m1" class="ltx_Math" alttext="1" '
    'display="inline"><semantics><mn>1</mn>'
    '<annotation encoding="application/x-tex">1</annotation></semantics></math>'
    "M output tokens."
)


def test_strip_tags_math_annotation_not_duplicated():
    text = _strip_tags(MATH_SNIPPET)
    assert text == "Dollar cost of generating 1M output tokens."


def test_anchors_from_html_fig1_caption_has_no_doubled_math():
    anchors = anchors_from_html(HTML)
    fig1 = next(a for a in anchors if a.startswith("- Fig. 1 —"))
    assert "1 1" not in fig1
    assert "annotation" not in fig1


# ---------------------------------------------------------------------------
# Fix round 1, item 1: self-check against the cached full text.
# ---------------------------------------------------------------------------


def test_self_check_anchors_passes_when_verbatim(tmp_path):
    anchors_path = tmp_path / "anchors.md"
    anchors_path.write_text("# Title\n\n## §1 Introduction\n", encoding="utf-8")
    fulltext = "Some prefix text. 1 Introduction. Some suffix text."
    assert self_check_anchors(anchors_path, fulltext) == []


def test_self_check_anchors_reports_missing_key(tmp_path):
    anchors_path = tmp_path / "anchors.md"
    anchors_path.write_text("# Title\n\n## §1 Introduction\n", encoding="utf-8")
    fulltext = "This text does not contain the section title at all."
    assert self_check_anchors(anchors_path, fulltext) == ["§1"]


# ---------------------------------------------------------------------------
# Fix round 1, item 4: mocked _get / _throttle.
# ---------------------------------------------------------------------------


def test_get_retries_once_on_503_then_succeeds():
    ok_response = type("R", (), {"status_code": 200, "text": "ok"})()
    err_response = type("R", (), {"status_code": 503, "text": "err"})()
    with patch("fetch_paper.requests.get", side_effect=[err_response, ok_response]) as mock_get, \
         patch("fetch_paper.time.sleep") as mock_sleep, \
         patch("fetch_paper._throttle"):
        result = _get("https://example.invalid")
    assert result is ok_response
    assert mock_get.call_count == 2
    mock_sleep.assert_called_once()


def test_get_does_not_retry_on_404():
    not_found = type("R", (), {"status_code": 404, "text": "nope"})()
    with patch("fetch_paper.requests.get", return_value=not_found) as mock_get, \
         patch("fetch_paper.time.sleep") as mock_sleep, \
         patch("fetch_paper._throttle"):
        result = _get("https://example.invalid")
    assert result is not_found
    assert mock_get.call_count == 1
    mock_sleep.assert_not_called()


def test_throttle_sleeps_when_calls_are_too_close():
    # _throttle reads time.monotonic() twice per call (elapsed check, then
    # to update _last_request_time); two calls 1s apart need 4 values.
    # First call: elapsed = 100 - 0 (module default) >= interval, no sleep.
    # Second call: elapsed = 101 - 100 = 1s < 3s -> sleeps ~2s.
    times = iter([100.0, 100.0, 101.0, 101.0])
    import fetch_paper

    fetch_paper._last_request_time = 0.0
    with patch("fetch_paper.time.monotonic", side_effect=lambda: next(times)), \
         patch("fetch_paper.time.sleep") as mock_sleep:
        _throttle()
        _throttle()
    mock_sleep.assert_called_once()
    (slept,), _ = mock_sleep.call_args
    assert slept == pytest.approx(MIN_REQUEST_INTERVAL - 1.0)


def test_throttle_does_not_sleep_when_calls_are_far_apart():
    times = iter([100.0, 100.0, 200.0, 200.0])
    import fetch_paper

    fetch_paper._last_request_time = 0.0
    with patch("fetch_paper.time.monotonic", side_effect=lambda: next(times)), \
         patch("fetch_paper.time.sleep") as mock_sleep:
        _throttle()
        _throttle()
    mock_sleep.assert_not_called()
