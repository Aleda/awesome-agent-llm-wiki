"""Tests for scripts/fetch_blog.py (Task 17; fix round 1 additions for
Markdown-emphasis/link stripping in headings and mocked `_get` behavior).

Fixture `blog_article.md` is a hand-trimmed excerpt in the shape of the
real Anthropic blog post
https://www.anthropic.com/institute/recursive-self-improvement
(frontmatter-style metadata + `##` headings + paragraphs), used to drive
`number_blog`/`slugify_title` without needing trafilatura or network access
in these unit tests.
"""

import sys
from pathlib import Path
from unittest.mock import patch

import pytest

SCRIPTS_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SCRIPTS_DIR))

from fetch_blog import _get, number_blog, slugify_title, strip_markdown_emphasis  # noqa: E402

FIXTURES = SCRIPTS_DIR / "tests" / "fixtures"
BLOG_MD = (FIXTURES / "blog_article.md").read_text(encoding="utf-8")


def test_fixture_is_small():
    assert (FIXTURES / "blog_article.md").stat().st_size < 30 * 1024


def test_number_blog():
    text, anchors = number_blog("Intro para\n\n## Evidence\n\nP1\n\nP2\n\n## Future\n\nP3")
    assert anchors == ["## §1 Evidence", "## §2 Future"]
    assert "§1¶2 P2" in text
    assert "§0¶1 Intro para" in text


def test_number_blog_on_real_fixture_has_six_sections():
    # Strip the frontmatter-style header block before numbering, same as
    # fetch_blog.py does with trafilatura's `---\n...\n---\n` metadata header.
    body = BLOG_MD.split("---\n", 2)[2].lstrip("\n")
    _text, anchors = number_blog(body)
    assert len(anchors) == 6
    assert anchors[0] == "## §1 Evidence from the outside world"


def test_number_blog_paragraph_numbering_resets_per_section():
    text, _anchors = number_blog("Intro\n\n## A\n\nA1\n\nA2\n\n## B\n\nB1")
    assert "§1¶1 A1" in text
    assert "§1¶2 A2" in text
    assert "§2¶1 B1" in text


def test_number_blog_no_leading_content():
    text, anchors = number_blog("## Only section\n\nP1")
    assert anchors == ["## §1 Only section"]
    assert "§0¶" not in text
    assert "§1¶1 P1" in text


def test_slugify_title_basic():
    assert slugify_title("When AI builds itself", fallback_url="https://x.com/a/b") == "when-ai-builds-itself"


def test_slugify_title_truncates_and_trims_trailing_dash():
    long_title = "A " * 40 + "End"
    slug = slugify_title(long_title, fallback_url="https://x.com/a/b")
    assert len(slug) <= 60
    assert not slug.endswith("-")


def test_slugify_title_falls_back_to_url_segment_for_non_ascii_title():
    slug = slugify_title("中文标题没有字母", fallback_url="https://example.com/posts/my-great-post")
    assert slug == "my-great-post"


def test_slugify_title_falls_back_to_post_when_nothing_usable():
    slug = slugify_title("中文标题", fallback_url="https://example.com/")
    assert slug == "post"


# ---------------------------------------------------------------------------
# Fix round 1, item 3: Markdown emphasis/link stripping in heading titles.
# ---------------------------------------------------------------------------


def test_strip_markdown_emphasis_bold():
    assert strip_markdown_emphasis("**Evidence from the outside world**") == "Evidence from the outside world"


def test_strip_markdown_emphasis_link():
    assert strip_markdown_emphasis("[Linked Title](https://example.com)") == "Linked Title"


def test_number_blog_strips_bold_heading():
    text, anchors = number_blog("## **Evidence from the outside world**\n\nP1")
    assert anchors == ["## §1 Evidence from the outside world"]
    assert "**" not in text


# ---------------------------------------------------------------------------
# Fix round 1, item 4: mocked _get.
# ---------------------------------------------------------------------------


def test_get_retries_once_on_503_then_succeeds():
    ok_response = type("R", (), {"status_code": 200, "text": "ok"})()
    err_response = type("R", (), {"status_code": 503, "text": "err"})()
    with patch("fetch_blog.requests.get", side_effect=[err_response, ok_response]) as mock_get, \
         patch("fetch_blog.time.sleep") as mock_sleep:
        result = _get("https://example.invalid")
    assert result is ok_response
    assert mock_get.call_count == 2
    mock_sleep.assert_called_once()


def test_get_does_not_retry_on_404():
    not_found = type("R", (), {"status_code": 404, "text": "nope"})()
    with patch("fetch_blog.requests.get", return_value=not_found) as mock_get, \
         patch("fetch_blog.time.sleep") as mock_sleep:
        result = _get("https://example.invalid")
    assert result is not_found
    assert mock_get.call_count == 1
    mock_sleep.assert_not_called()
