"""Tests for scripts/fetch_paper.py (Task 17; fix round 1 additions for
caption truncation without `…`, MathML annotation/alttext de-duplication,
the post-write self-check, and mocked `_get`/`_throttle` behavior; fix
round 2 / task-23_5's tag-aware `anchors_from_html` rewrite).

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
- `arxiv_html_snippet_s5.html` — real markup shape from
  https://arxiv.org/html/2609.37725, §5 area (task-19_5 defect 2): nested
  `<span>` inside a subsection title, and a table captioned with the
  `ltx_tag_figure` class instead of `ltx_tag_table`.
- `arxiv_html_2304.03442.html`, `arxiv_html_2502.12110.html`,
  `arxiv_html_2504.19413.html` — hand-trimmed snippets of real markup from
  arXiv 2304.03442 (Generative Agents), 2502.12110 (A-MEM) and 2504.19413
  (Mem0) respectively (fetched 2026-11-27; task-23_5), each exercising the
  specific LaTeXML variants the pre-rewrite regex parser missed: ACM-style
  "Figure 1. " period labels with a redundant nested `ltx_acm_description`
  span (2304.03442); the figure/table number living in its own nested
  `<span>` inside the `ltx_tag` span, with the colon in the outer span's
  trailing text (2502.12110, 2504.19413); an outer `<figure>` itself
  carrying the `ltx_figure_panel` class despite having its own number and
  direct caption (2504.19413's Figure 1); and a real nested subfigure
  group — an outer numbered `<figure id="S4.F4">` wrapping two inner
  `<figure class="ltx_figure_panel">` children with their own un-numbered
  "(a)"/"(b)" captions — that must only yield the outer "Figure 4" anchor
  (2504.19413's Figure 4).
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
HTML_S5 = (FIXTURES / "arxiv_html_snippet_s5.html").read_text(encoding="utf-8")
HTML_2304 = (FIXTURES / "arxiv_html_2304.03442.html").read_text(encoding="utf-8")
HTML_2502 = (FIXTURES / "arxiv_html_2502.12110.html").read_text(encoding="utf-8")
HTML_2504 = (FIXTURES / "arxiv_html_2504.19413.html").read_text(encoding="utf-8")


def test_fixtures_are_small():
    for name in (
        "arxiv_atom.xml",
        "arxiv_html_snippet.html",
        "arxiv_html_snippet_s5.html",
        "arxiv_html_2304.03442.html",
        "arxiv_html_2502.12110.html",
        "arxiv_html_2504.19413.html",
        "pdf_text.txt",
    ):
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


# ---------------------------------------------------------------------------
# Defect 2 (task-19_5): a subsection/subsubsection title containing a nested
# inline <span> between the ltx_tag number and the rest of the title text
# (arxiv_html_snippet_s5.html's §5.1 / §5.2), and table captions whose
# <figcaption> carries an extra attribute after class="ltx_caption" and/or
# labels the caption span `ltx_tag_figure` instead of `ltx_tag_table`
# (real-world inconsistency seen in arXiv 2609.37725's Table 1 vs Table 2).
# ---------------------------------------------------------------------------


def test_anchors_from_html_handles_nested_span_in_subsection_title():
    anchors = anchors_from_html(HTML_S5)
    assert "## §5 Results" in anchors
    assert "## §5.1 Evaluating CLMs Zero-Shot on Long-Horizon Agentic Tasks" in anchors
    assert "## §5.1.1 Coding and Deep Research Tasks" in anchors
    assert "## §5.1.2 Open Discovery Problems" in anchors
    assert (
        "## §5.2 Learning Better Context-Management Strategies in Context or in Weights"
        in anchors
    )


def test_anchors_from_html_table_captions_regardless_of_tag_class_and_extra_attrs():
    anchors = anchors_from_html(HTML_S5)
    tab1 = next(a for a in anchors if a.startswith("- Tab. 1 —"))
    tab2 = next(a for a in anchors if a.startswith("- Tab. 2 —"))
    assert tab1 == (
        "- Tab. 1 — CLMs outperform specialized OpenEvolve evolutionary "
        "workflows on mathematical optimization problems."
    )
    assert tab2.startswith("- Tab. 2 — RL results on BrowseComp-Plus with Qwen3.5-9B.")


def test_anchors_from_html_s5_sections_in_document_order():
    anchors = anchors_from_html(HTML_S5)
    section_anchors = [a for a in anchors if a.startswith("## §")]
    assert section_anchors == [
        "## §5 Results",
        "## §5.1 Evaluating CLMs Zero-Shot on Long-Horizon Agentic Tasks",
        "## §5.1.1 Coding and Deep Research Tasks",
        "## §5.1.2 Open Discovery Problems",
        "## §5.2 Learning Better Context-Management Strategies in Context or in Weights",
    ]


def test_anchors_from_html_s5_fixture_has_no_regression_on_old_cases():
    # the original fixture's section/fig/tab extraction must be unaffected
    # by the nested-span / table-class generalization.
    anchors = anchors_from_html(HTML)
    assert anchors[:2] == ["## §1 Introduction", "## §3.2 Method"]
    assert any(a.startswith("- Fig. 1 —") for a in anchors)
    assert any(a.startswith("- Tab. 2 —") for a in anchors)


# ---------------------------------------------------------------------------
# Fix round 2 (task-23_5): tag-aware `anchors_from_html` rewrite using
# `html.parser`. Each fixture below is a trimmed snippet of a real arXiv
# HTML page where the previous regex-only parser missed captions/sections
# entirely (see each fixture's own header comment for the specific markup
# variant it exercises).
# ---------------------------------------------------------------------------


def test_anchors_from_html_2304_acm_style_period_labels_and_sections():
    # Generative Agents (2304.03442): ACM-style "Figure 1. " period label
    # (no colon) directly in the ltx_tag_figure span, plus a redundant
    # nested ltx_acm_description alt-caption span after the visible text —
    # the old FIGURE_CAPTION_HTML_RE only matched "Figure N: ", so every
    # figure caption in this paper was missed.
    anchors = anchors_from_html(HTML_2304)
    assert anchors == [
        "## §1 Introduction",
        "## §2 Related Work",
        "## §3 Generative Agent Behavior and Interaction",
        "- Fig. 1 — Generative agents are believable simulacra of human "
        "behavior for interactive applications.",
        "- Fig. 2 — The Smallville sandbox world, with areas labeled. The "
        "root node describes the entire world, children describe areas (e.",
    ]


def test_anchors_from_html_2502_nested_number_span_in_tag_and_table():
    # A-MEM (2502.12110): the figure/table number sits in its own nested
    # <span> *inside* the ltx_tag span, with the ":" in the outer span's
    # trailing text (not a flat "Figure N: " run) — the old
    # FIGURE_CAPTION_HTML_RE/TABLE_CAPTION_HTML_RE never matched this shape
    # at all, so every figure AND table caption was missed. Figure 1's
    # outer <figure> also contains two un-numbered "(a)"/"(b)" subfigure
    # <p> captions (not <figcaption>s) before its own direct figcaption.
    anchors = anchors_from_html(HTML_2502)
    assert anchors == [
        "## §1 Introduction",
        "## §3 Methodolodgy",
        "## §3.1 Note Construction",
        "## §4 Experiment",
        "- Fig. 1 — Traditional memory systems require predefined memory "
        "access patterns specified in the workflow, limiting their",
        "- Tab. 1 — Experimental results on LoCoMo dataset of QA tasks "
        "across five categories (Multi Hop, Temporal, Open Domain, Single",
    ]


def test_anchors_from_html_2504_panel_class_on_numbered_figure_and_real_subfigures():
    # Mem0 (2504.19413): Figure 1's *outer* <figure> itself carries the
    # ltx_figure_panel class despite having its own number and direct
    # figcaption (panel detection must not key off that class). Figure 4 is
    # a *real* nested subfigure group: an outer numbered <figure id="S4.F4">
    # wraps two inner <figure class="ltx_figure_panel"> children with their
    # own un-numbered "(a)"/"(b)" <figcaption>s — only the outer "Figure 4"
    # caption must produce an anchor, the panels' (a)/(b) captions must not.
    anchors = anchors_from_html(HTML_2504)
    assert anchors == [
        "## §1 Introduction",
        "## §2 Proposed Methods",
        "## §3 Experimental Setup",
        "## §4 Evaluation Results, Analysis and Discussion",
        "- Fig. 1 — Illustration of memory importance in AI agents.",
        "- Fig. 4 — Latency Analysis of Different Memory Approaches.",
        "- Tab. 1 — Performance comparison of memory-enabled systems "
        "across different question types in the LOCOMO dataset.",
    ]
    assert not any("(a)" in a or "(b)" in a for a in anchors)


def test_anchors_from_html_2504_table_math_annotation_not_doubled():
    # Table 1's caption has an inline <math alttext="\uparrow"> with a
    # nested <annotation> duplicating the alttext as text; _strip_tags'
    # MathML dedup must still apply when text is collected through the
    # tag-aware walker instead of a flat regex match.
    anchors = anchors_from_html(HTML_2504)
    tab1 = next(a for a in anchors if a.startswith("- Tab. 1 —"))
    assert "annotation" not in tab1
    assert "uparrow" not in tab1


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


# ---------------------------------------------------------------------------
# Task 23b: captions and headings are collected as raw markup and rendered
# by the same `_strip_tags` as the cached full text, so every anchor value is
# an exact substring of `_strip_tags(html)` (the fetch-time self-check and
# lint's `.cache` check both depend on this). Shapes mirror arXiv
# 2307.03172 (Fig. 4 "Figure 2 ." cross-ref) and 2310.05736 (Fig. 2 math
# alttext, §5.3 "&amp;").
# ---------------------------------------------------------------------------


def _fig_html(fig_id: str, caption_inner: str) -> str:
    return (
        f'<figure id="{fig_id}" class="ltx_figure">'
        '<img src="x.png" alt="">'
        f'<figcaption class="ltx_caption">{caption_inner}</figcaption>'
        "</figure>"
    )


def _assert_anchor_is_substring_of_fulltext(anchors: list[str], prefix: str, html: str) -> str:
    line = next(a for a in anchors if a.startswith(prefix))
    value = line[len(prefix):]
    assert value in _strip_tags(html)
    return value


def test_caption_span_boundaries_keep_fulltext_spacing():
    html = _fig_html(
        "S2.F4",
        '<span class="ltx_tag ltx_tag_figure">Figure 4: </span>'
        "Modulating the input context length of the example presented in "
        '<a href="#S2.F2" class="ltx_ref"><span class="ltx_text ltx_ref_tag">Figure 2</span></a>.',
    )
    value = _assert_anchor_is_substring_of_fulltext(anchors_from_html(html), "- Fig. 4 — ", html)
    assert value.endswith("Figure 2 .")


def test_caption_math_uses_alttext_like_fulltext():
    html = _fig_html(
        "S5.F2",
        '<span class="ltx_tag ltx_tag_figure">Figure 2: </span>'
        "Generated lengths at varying compression ratios ("
        '<math alttext="1/\\tau" class="ltx_Math" display="inline"><semantics>'
        "<mrow><mn>1</mn><mo>/</mo><mi>τ</mi></mrow>"
        '<annotation encoding="application/x-tex">1/\\tau</annotation>'
        "</semantics></math>).",
    )
    value = _assert_anchor_is_substring_of_fulltext(anchors_from_html(html), "- Fig. 2 — ", html)
    assert "(1/\\tau)" in value
    assert "τ" not in value


def test_entities_decoded_once_in_caption_heading_and_fulltext():
    html = (
        '<h3 class="ltx_title ltx_title_subsection">'
        '<span class="ltx_tag ltx_tag_subsection">5.3 </span>'
        "Analysis on Reasoning &amp; ICL Tasks.</h3>"
        + _fig_html(
            "S5.F3",
            '<span class="ltx_tag ltx_tag_figure">Figure 3: </span>'
            "Q&amp;A results; literal &amp;amp; stays escaped once.",
        )
    )
    anchors = anchors_from_html(html)
    full = _strip_tags(html)
    assert "## §5.3 Analysis on Reasoning & ICL Tasks" in anchors
    assert "Analysis on Reasoning & ICL Tasks" in full
    value = _assert_anchor_is_substring_of_fulltext(anchors, "- Fig. 3 — ", html)
    assert value == "Q&A results; literal &amp; stays escaped once."


def test_label_with_space_before_colon_is_recognised():
    # Raw-markup collection renders `<span>Figure 1</span>: ` as
    # "Figure 1 :"; FIGTAB_LABEL_RE must still accept it.
    html = _fig_html(
        "S1.F1",
        '<span class="ltx_tag ltx_tag_figure"><span class="ltx_text">Figure 1</span>: </span>'
        '<span class="ltx_text">Framework of the proposed approach.</span>',
    )
    assert "Figure 1 :" in _strip_tags(html)
    value = _assert_anchor_is_substring_of_fulltext(anchors_from_html(html), "- Fig. 1 — ", html)
    assert value == "Framework of the proposed approach."
